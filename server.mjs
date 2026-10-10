import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const CACHE = join(ROOT, "data", "cache.json");
const PORT = Number(process.env.PORT || 3000);
const OWNER = "BasedHardware";
const REPO = "omi";
const REFRESH_MS = 30 * 60 * 1000;
const MIME = { png: "image/png", jpg: "image/jpeg", svg: "image/svg+xml", webp: "image/webp" };

const token =
  process.env.GITHUB_TOKEN ||
  execFileSync("gh", ["auth", "token"], { encoding: "utf8" }).trim();

const headers = {
  Authorization: `Bearer ${token}`,
  "User-Agent": "omi-leaderboard",
  Accept: "application/vnd.github+json",
};

let cache = { prs: {}, contributors: [], syncedAt: null };
let refreshing = null;

async function gql(query, variables) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  return body.data;
}

const SEARCH_QUERY = `
query($q: String!, $after: String) {
  search(query: $q, type: ISSUE, first: 100, after: $after) {
    issueCount
    pageInfo { hasNextPage endCursor }
    nodes {
      ... on PullRequest {
        number title mergedAt additions deletions
        author { login avatarUrl __typename }
      }
    }
  }
}`;

const REPO_START = Date.parse("2024-03-01T00:00:00Z");
const CONCURRENCY = 8;
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
const windowQuery = ([from, to]) =>
  `repo:${OWNER}/${REPO} is:pr is:merged merged:${iso(from)}..${iso(to)}`;

function store(pr) {
  if (!pr?.number) return;
  cache.prs[pr.number] = {
    n: pr.number,
    t: pr.title,
    m: pr.mergedAt,
    a: pr.additions,
    d: pr.deletions,
    u: pr.author?.login ?? "ghost",
    av: pr.author?.avatarUrl ?? null,
    bot: pr.author?.__typename === "Bot" || /\[bot\]$/.test(pr.author?.login ?? ""),
  };
}

// GitHub search caps each query at 1,000 results, so date windows that are
// too full get halved until every window fits, then each window is paged.
async function fetchWindow(win, onDone) {
  let after = null;
  for (;;) {
    const { search } = await gql(SEARCH_QUERY, { q: windowQuery(win), after });
    if (!after && search.issueCount > 1000) {
      const mid = Math.floor((win[0] + win[1]) / 2);
      return [[win[0], mid], [mid + 1000, win[1]]];
    }
    search.nodes.forEach(store);
    onDone(search.nodes.length);
    if (!search.pageInfo.hasNextPage) return [];
    after = search.pageInfo.endCursor;
  }
}

// Full history on first run; afterwards only PRs merged since the last sync
// (with a day of overlap), since merged PRs don't move.
async function syncPullRequests() {
  const now = Date.now();
  const start = cache.syncedAt ? Date.parse(cache.syncedAt) - 864e5 : REPO_START;
  const month = 30 * 864e5;
  const queue = [];
  for (let t = start; t < now; t += month) queue.push([t, Math.min(t + month - 1000, now)]);

  let fetched = 0;
  const worker = async () => {
    while (queue.length) {
      const win = queue.shift();
      const split = await fetchWindow(win, (n) => {
        fetched += n;
        process.stdout.write(`\r  merged PRs fetched: ${fetched}`);
      });
      queue.push(...split);
    }
  };
  // Workers can finish while a sibling is still splitting windows, so loop
  // until the queue stays empty after a full round.
  do await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  while (queue.length);
  process.stdout.write("\n");
}

async function syncContributors() {
  const all = [];
  for (let page = 1; ; page++) {
    const res = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contributors?per_page=100&page=${page}`,
      { headers }
    );
    const list = await res.json();
    if (!Array.isArray(list) || list.length === 0) break;
    for (const c of list) {
      all.push({ u: c.login, av: c.avatar_url, c: c.contributions, bot: c.type === "Bot" });
    }
    if (list.length < 100) break;
  }
  cache.contributors = all;
}

async function refresh() {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const started = new Date().toISOString();
    console.log(`Syncing ${OWNER}/${REPO}…`);
    await Promise.all([syncPullRequests(), syncContributors()]);
    cache.syncedAt = started;
    await mkdir(dirname(CACHE), { recursive: true });
    await writeFile(CACHE, JSON.stringify(cache));
    console.log(`Synced: ${Object.keys(cache.prs).length} merged PRs, ${cache.contributors.length} contributors`);
  })().finally(() => (refreshing = null));
  return refreshing;
}

function payload() {
  return JSON.stringify({
    repo: `${OWNER}/${REPO}`,
    syncedAt: cache.syncedAt,
    prs: Object.values(cache.prs),
    contributors: cache.contributors,
  });
}

try {
  cache = JSON.parse(await readFile(CACHE, "utf8"));
} catch {}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname === "/api/data") {
      if (!cache.syncedAt) await refresh();
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(payload());
    }
    if (url.pathname === "/api/refresh" && req.method === "POST") {
      await refresh();
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ syncedAt: cache.syncedAt }));
    }
    if (url.pathname.startsWith("/assets/")) {
      const name = url.pathname.slice("/assets/".length);
      if (!/^[\w.-]+$/.test(name)) throw Object.assign(new Error("Not found"), { status: 404 });
      const file = await readFile(join(ROOT, "public", "assets", name));
      res.writeHead(200, {
        "Content-Type": MIME[name.split(".").pop()] || "application/octet-stream",
        "Cache-Control": "public, max-age=86400",
      });
      return res.end(file);
    }
    const html = await readFile(join(ROOT, "public", "index.html"));
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  } catch (err) {
    if (err.code !== "ENOENT" && err.status !== 404) console.error(err);
    res.writeHead(err.code === "ENOENT" || err.status === 404 ? 404 : 500, { "Content-Type": "text/plain" });
    res.end(String(err.message || err));
  }
});

server.listen(PORT, () => console.log(`Omi leaderboard on http://localhost:${PORT}`));
refresh().catch((err) => console.error("Initial sync failed:", err.message));
setInterval(() => refresh().catch((err) => console.error("Refresh failed:", err.message)), REFRESH_MS);
