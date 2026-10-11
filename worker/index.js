import { timingSafeEqual } from 'node:crypto';

const KEY = 'leaderboard';
const MAX_BYTES = 24 * 1024 * 1024;
const encoder = new TextEncoder();
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

function authorized(request, secret) {
  if (!secret) return false;
  const actual = encoder.encode(request.headers.get('Authorization') || '');
  const expected = encoder.encode(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function validSnapshot(data) {
  const count = n => Number.isSafeInteger(n) && n >= 0;
  const username = u => typeof u === 'string' && u.length > 0 && u.length <= 100;
  return data?.repo === 'BasedHardware/omi'
    && Number.isFinite(Date.parse(data.syncedAt)) && Date.parse(data.syncedAt) <= Date.now() + 300000
    && Array.isArray(data.prs) && data.prs.length > 0
    && Array.isArray(data.contributors) && data.contributors.length > 0
    && data.prs.every(pr => pr && count(pr.n) && pr.n > 0 && typeof pr.t === 'string' && username(pr.u)
      && Number.isFinite(Date.parse(pr.m)) && count(pr.a) && count(pr.d) && typeof pr.bot === 'boolean')
    && new Set(data.prs.map(pr => pr.n)).size === data.prs.length
    && data.contributors.every(c => c && username(c.u) && count(c.c) && typeof c.bot === 'boolean');
}

async function readBoundedBody(request) {
  if (Number(request.headers.get('Content-Length')) > MAX_BYTES) return null;
  const reader = request.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder(), parts = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) { await reader.cancel(); return null; }
    parts.push(decoder.decode(value, { stream: true }));
  }
  return parts.join('') + decoder.decode();
}

async function publish(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!authorized(request, env.OMI_PUBLISH_TOKEN)) return json({ error: 'Unauthorized' }, 401);
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json({ error: 'JSON required' }, 415);
  const body = await readBoundedBody(request);
  if (body === null) return json({ error: 'Snapshot exceeds the storage limit' }, 413);
  let data;
  try { data = JSON.parse(body); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (!validSnapshot(data)) return json({ error: 'Incomplete or invalid snapshot' }, 400);

  const current = await env.OMI_DATA.getWithMetadata(KEY, { type: 'stream', cacheTtl: 60 });
  if (current.value) await current.value.cancel();
  if (current.metadata?.syncedAt && Date.parse(data.syncedAt) < Date.parse(current.metadata.syncedAt)) {
    return json({ error: 'Snapshot is older than the published data' }, 409);
  }
  await env.OMI_DATA.put(KEY, JSON.stringify(data), { metadata: { syncedAt: data.syncedAt } });
  return json({ syncedAt: data.syncedAt, prs: data.prs.length, contributors: data.contributors.length });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/publish') {
      try { return await publish(request, env); }
      catch { return json({ error: 'Publishing temporarily unavailable; previous data preserved' }, 503); }
    }
    if (pathname === '/data/leaderboard.json') {
      if (!['GET', 'HEAD'].includes(request.method)) return json({ error: 'Method not allowed' }, 405);
      try {
        const { value, metadata } = await env.OMI_DATA.getWithMetadata(KEY, { type: 'stream', cacheTtl: 60 });
        if (value) {
          if (request.method === 'HEAD') await value.cancel();
          return new Response(request.method === 'HEAD' ? null : value, {
            headers: {
              'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
              'X-Content-Type-Options': 'nosniff', 'X-Data-Source': 'cloudflare-kv',
              ...(metadata?.syncedAt ? { 'Last-Modified': new Date(metadata.syncedAt).toUTCString() } : {}),
            },
          });
        }
      } catch { /* The bundled snapshot keeps the site usable during a KV outage. */ }
      const fallback = await env.ASSETS.fetch(request);
      const response = new Response(fallback.body, fallback);
      response.headers.set('Cache-Control', 'no-store');
      response.headers.set('X-Data-Source', 'bundled-snapshot');
      return response;
    }
    return env.ASSETS.fetch(request);
  },
};
