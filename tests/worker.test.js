import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';

const origin = 'https://omi-leaderboard.apoorvdarshan.com';
const snapshot = {
  repo: 'BasedHardware/omi', syncedAt: '2026-10-11T00:00:00Z',
  prs: [{ n: 1, t: 'A real merge', u: 'alice', m: '2026-10-10T00:00:00Z', a: 1, d: 0, bot: false }],
  contributors: [{ u: 'alice', c: 1, bot: false }],
};
function environment(data = snapshot) {
  const state = { data, writes: 0 };
  return { state, OMI_PUBLISH_TOKEN: 'test-publish-token',
    OMI_DATA: {
      async getWithMetadata() { return { value: state.data ? new Response(JSON.stringify(state.data)).body : null, metadata: state.data ? { syncedAt: state.data.syncedAt } : null }; },
      async put(key, value) { assert.equal(key, 'leaderboard'); state.data = JSON.parse(value); state.writes++; },
    },
    ASSETS: { fetch: async request => new Response(new URL(request.url).pathname === '/data/leaderboard.json' ? JSON.stringify(snapshot) : '<h1>Omi</h1>') },
  };
}
const upload = (body, token = 'test-publish-token') => new Request(`${origin}/api/publish`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
});

test('Cloudflare serves the latest KV snapshot and regular site assets', async () => {
  const env = environment();
  const response = await worker.fetch(new Request(`${origin}/data/leaderboard.json`), env);
  assert.deepEqual(await response.json(), snapshot);
  assert.equal(response.headers.get('X-Data-Source'), 'cloudflare-kv');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(await (await worker.fetch(new Request(origin), env)).text(), '<h1>Omi</h1>');
});

test('the publish endpoint rejects unauthorized requests before accessing data', async () => {
  const env = environment();
  env.OMI_DATA.getWithMetadata = () => { throw new Error('Must not access storage'); };
  assert.equal((await worker.fetch(upload(snapshot, 'wrong-token'), env)).status, 401);
  delete env.OMI_PUBLISH_TOKEN;
  assert.equal((await worker.fetch(upload(snapshot), env)).status, 401);
  assert.equal(env.state.writes, 0);
});

test('publishing accepts a complete snapshot and preserves the previous one on invalid or older uploads', async () => {
  const env = environment();
  const newer = { ...snapshot, syncedAt: '2026-10-11T00:01:00Z' };
  assert.equal((await worker.fetch(upload(newer), env)).status, 200);
  assert.deepEqual(env.state.data, newer);
  assert.equal((await worker.fetch(upload(snapshot), env)).status, 409);
  assert.equal((await worker.fetch(upload({ ...newer, prs: [] }), env)).status, 400);
  assert.equal((await worker.fetch(upload({ ...newer, prs: [null] }), env)).status, 400);
  assert.equal((await worker.fetch(upload({ ...newer, prs: [snapshot.prs[0], snapshot.prs[0]] }), env)).status, 400);
  assert.equal(env.state.writes, 1);
  assert.deepEqual(env.state.data, newer);
});

test('the bundled snapshot remains available before the first publish or during KV failure', async () => {
  const env = environment(null);
  let response = await worker.fetch(new Request(`${origin}/data/leaderboard.json`), env);
  assert.equal(response.headers.get('X-Data-Source'), 'bundled-snapshot');
  assert.deepEqual(await response.json(), snapshot);
  env.OMI_DATA.getWithMetadata = () => { throw new Error('Temporary KV outage'); };
  response = await worker.fetch(new Request(`${origin}/data/leaderboard.json`), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), snapshot);
});

test('storage failures fail publishing without replacing the last good snapshot', async () => {
  const env = environment();
  env.OMI_DATA.put = () => { throw new Error('Temporary KV outage'); };
  assert.equal((await worker.fetch(upload(snapshot), env)).status, 503);
  assert.deepEqual(env.state.data, snapshot);
});
