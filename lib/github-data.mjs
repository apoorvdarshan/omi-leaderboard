import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname } from 'node:path';

export const REPOSITORY = 'BasedHardware/omi';
const START = Date.parse('2024-03-01T00:00:00Z');
const DAY = 86400000;
const iso = ms => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
const SEARCH = `query($q: String!, $after: String) {
  search(query: $q, type: ISSUE, first: 100, after: $after) {
    issueCount pageInfo { hasNextPage endCursor }
    nodes { ... on PullRequest {
      number title mergedAt additions deletions
      author { login avatarUrl __typename }
    } }
  }
}`;

export function githubToken() {
  return process.env.GITHUB_TOKEN || execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
}

export async function createDataStore({ cachePath, token, request = fetch, now = Date.now, log = console.log }) {
  let cache = { prs: {}, contributors: [], syncedAt: null }, refreshing;
  try {
    const saved = JSON.parse(await readFile(cachePath, 'utf8'));
    if (saved.prs && !Array.isArray(saved.prs) && Array.isArray(saved.contributors) && Number.isFinite(Date.parse(saved.syncedAt))) cache = saved;
  } catch (error) {
    if (error.code !== 'ENOENT') log('Ignoring an unreadable data cache; rebuilding from GitHub.');
  }

  const headers = { Authorization: `Bearer ${token}`, 'User-Agent': 'omi-leaderboard', Accept: 'application/vnd.github+json' };
  async function api(path, body) {
    const response = await request(`https://api.github.com${path}`, {
      headers, signal: AbortSignal.timeout(45000),
      ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error(`GitHub request failed (${response.status}) for ${path.split('?')[0]}.`);
    const result = await response.json();
    if (result.errors?.length) throw new Error(`GitHub GraphQL failed: ${result.errors.map(e => e.message).join('; ')}`);
    return result;
  }

  async function pullRequests(target, until) {
    const start = Math.floor((cache.syncedAt ? Date.parse(cache.syncedAt) - DAY : START) / 1000) * 1000;
    const end = Math.floor(until / 1000) * 1000;
    const month = 30 * DAY, queue = [];
    for (let t = start; t <= end; t += month) queue.push([t, Math.min(t + month - 1000, end)]);
    const worker = async () => {
      while (queue.length) {
        const [from, to] = queue.shift();
        let after = null;
        do {
          const result = await api('/graphql', { query: SEARCH, variables: { q: `repo:${REPOSITORY} is:pr is:merged merged:${iso(from)}..${iso(to)}`, after } });
          const search = result.data?.search;
          if (!search || !Array.isArray(search.nodes)) throw new Error('GitHub returned incomplete pull request data.');
          // Search caps results at 1,000. Split into adjacent whole-second
          // windows so even merges exactly on a boundary are included.
          if (!after && search.issueCount > 1000) {
            if (to <= from) throw new Error('Too many pull requests in one second to index completely.');
            const mid = Math.floor((from + to) / 2000) * 1000;
            queue.push([from, mid], [mid + 1000, to]);
            break;
          }
          for (const pr of search.nodes) {
            if (!pr?.number || !pr.mergedAt) continue;
            target[pr.number] = {
              n: pr.number, t: pr.title, m: pr.mergedAt, a: pr.additions, d: pr.deletions,
              u: pr.author?.login ?? 'ghost', av: pr.author?.avatarUrl ?? null,
              bot: pr.author?.__typename === 'Bot' || /\[bot\]$/.test(pr.author?.login ?? ''),
            };
          }
          if (!search.pageInfo?.hasNextPage) break;
          if (!search.pageInfo.endCursor || search.pageInfo.endCursor === after) throw new Error('GitHub returned an invalid pagination cursor.');
          after = search.pageInfo.endCursor;
        } while (true);
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
  }

  async function contributors() {
    const all = [];
    for (let page = 1; ; page++) {
      const list = await api(`/repos/${REPOSITORY}/contributors?per_page=100&page=${page}`);
      if (!Array.isArray(list)) throw new Error('GitHub returned incomplete contributor data.');
      all.push(...list.map(c => ({ u: c.login, av: c.avatar_url, c: c.contributions, bot: c.type === 'Bot' })));
      if (list.length < 100) return all;
    }
  }

  function snapshot() {
    return { repo: REPOSITORY, syncedAt: cache.syncedAt, prs: Object.values(cache.prs), contributors: cache.contributors };
  }

  function refresh() {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      const started = now(), next = { prs: { ...cache.prs }, contributors: [], syncedAt: new Date(started).toISOString() };
      log(`Syncing ${REPOSITORY}…`);
      const results = await Promise.allSettled([pullRequests(next.prs, started), contributors()]);
      const failed = results.find(result => result.status === 'rejected');
      if (failed) throw failed.reason;
      next.contributors = results[1].value;
      if (!Object.keys(next.prs).length || !next.contributors.length) throw new Error('Refusing to publish empty ranking data.');
      await mkdir(dirname(cachePath), { recursive: true });
      const temporary = `${cachePath}.${process.pid}.tmp`;
      await writeFile(temporary, JSON.stringify(next));
      await rename(temporary, cachePath);
      cache = next;
      log(`Synced ${Object.keys(cache.prs).length} merged PRs and ${cache.contributors.length} contributors.`);
      return snapshot();
    })().finally(() => { refreshing = null; });
    return refreshing;
  }
  return { snapshot, refresh };
}
