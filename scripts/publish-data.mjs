import { readFile } from 'node:fs/promises';

const token = process.env.OMI_PUBLISH_TOKEN;
if (!token) throw new Error('OMI_PUBLISH_TOKEN is required to publish ranking data.');
const body = await readFile(new URL('../dist/data/leaderboard.json', import.meta.url), 'utf8');
const response = await fetch('https://omi-leaderboard.apoorvdarshan.com/api/publish', {
  method: 'POST', redirect: 'error', signal: AbortSignal.timeout(60000),
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body,
});
if (!response.ok) throw new Error(`Cloudflare snapshot publish failed (${response.status}).`);
const result = await response.json();
console.log(`Published ${result.prs} merged PRs and ${result.contributors} contributors to Cloudflare at ${result.syncedAt}.`);
