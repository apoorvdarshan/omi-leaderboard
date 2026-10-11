import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createDataStore, githubToken } from "./lib/github-data.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const CACHE = join(ROOT, "data", "cache.json");
const PORT = Number(process.env.PORT || 3000);
const REFRESH_MS = 30 * 60 * 1000;
const MIME = { png: "image/png", jpg: "image/jpeg", svg: "image/svg+xml", webp: "image/webp", css: "text/css; charset=utf-8", js: "text/javascript; charset=utf-8" };

const store = await createDataStore({ cachePath: CACHE, token: githubToken() });
const refresh = store.refresh;
const payload = () => JSON.stringify(store.snapshot());

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname === "/api/data") {
      if (!store.snapshot().syncedAt) await refresh();
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(payload());
    }
    if (url.pathname === "/api/refresh" && req.method === "POST") {
      await refresh();
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ syncedAt: store.snapshot().syncedAt }));
    }
    if (url.pathname.startsWith("/assets/")) {
      const name = url.pathname.slice("/assets/".length);
      if (!/^[\w.-]+$/.test(name)) throw Object.assign(new Error("Not found"), { status: 404 });
      const file = await readFile(join(ROOT, "public", "assets", name));
      res.writeHead(200, {
        "Content-Type": MIME[name.split(".").pop()] || "application/octet-stream",
        "Cache-Control": /\.(css|js)$/.test(name) ? "no-cache" : "public, max-age=86400",
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
