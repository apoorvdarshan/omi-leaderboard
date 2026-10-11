import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDataStore } from '../lib/github-data.mjs';

const now = Date.parse('2026-10-11T12:00:00Z');
const seed = { syncedAt: new Date(now - 3600000).toISOString(), prs: { 1: { n: 1, t: 'Existing merge', u: 'alice', m: new Date(now - 7200000).toISOString(), a: 1, d: 0, bot: false } }, contributors: [{ u: 'alice', c: 1, bot: false }] };
const response = value => ({ ok: true, json: async () => value });
const pr = number => ({ number, title: `Merge ${number}`, mergedAt: new Date(now - 60000).toISOString(), additions: 3, deletions: 1, author: { login: 'bob', avatarUrl: null, __typename: 'User' } });
const page = (nodes, next = null, count = nodes.length) => response({ data: { search: { nodes, issueCount: count, pageInfo: { hasNextPage: !!next, endCursor: next } } } });

async function fixture(t, request) {
  const dir = await mkdtemp(join(tmpdir(), 'omi-data-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const cachePath = join(dir, 'cache.json');
  await writeFile(cachePath, JSON.stringify(seed));
  return { cachePath, store: await createDataStore({ cachePath, request, token: 'test-token', now: () => now, log() {} }) };
}

test('sync paginates PRs, preserves history, deduplicates overlap and publishes no credentials', async t => {
  const queries = [];
  const { store, cachePath } = await fixture(t, async (url, options) => {
    if (!url.endsWith('/graphql')) return response([{ login: 'bob', contributions: 4, type: 'User' }]);
    const { variables } = JSON.parse(options.body); queries.push(variables);
    return variables.after ? page([pr(2), pr(3)]) : page([pr(2)], 'cursor-1');
  });
  const result = await store.refresh();
  assert.deepEqual(result.prs.map(p => p.n), [1, 2, 3]);
  assert.equal(result.contributors[0].c, 4);
  assert.equal(queries[1].after, 'cursor-1');
  assert.match(queries[0].q, /2026-10-10T11:00:00Z/);
  assert.equal(JSON.stringify(result).includes('test-token'), false);
  assert.equal(JSON.parse(await readFile(cachePath, 'utf8')).syncedAt, new Date(now).toISOString());
});

test('failed contributor sync leaves both the published snapshot and disk cache untouched', async t => {
  const { store, cachePath } = await fixture(t, async url => url.endsWith('/graphql') ? page([pr(2)]) : { ok: false, status: 403 });
  const before = store.snapshot();
  await assert.rejects(store.refresh(), /403/);
  assert.deepEqual(store.snapshot(), before);
  assert.deepEqual(JSON.parse(await readFile(cachePath, 'utf8')), seed);
});

test('oversized search windows split without dropping second boundaries', async t => {
  const queries = [];
  const { store } = await fixture(t, async (url, options) => {
    if (!url.endsWith('/graphql')) return response([{ login: 'bob', contributions: 4, type: 'User' }]);
    const { q } = JSON.parse(options.body).variables; queries.push(q);
    return queries.length === 1 ? page([], null, 1001) : page([pr(queries.length)]);
  });
  await store.refresh();
  assert.equal(queries.length, 3);
  const windows = queries.map(q => q.split('merged:')[1].split('..').map(Date.parse));
  assert.equal(windows[1][0], windows[0][0]);
  assert.equal(windows[1][1] + 1000, windows[2][0]);
  assert.equal(windows[2][1], windows[0][1]);
});

test('GraphQL errors fail the build instead of publishing partial rankings', async t => {
  const { store } = await fixture(t, async url => url.endsWith('/graphql') ? response({ errors: [{ message: 'Rate limit reached' }] }) : response([{ login: 'bob', contributions: 1 }]));
  await assert.rejects(store.refresh(), /Rate limit reached/);
  assert.equal(store.snapshot().syncedAt, seed.syncedAt);
});
