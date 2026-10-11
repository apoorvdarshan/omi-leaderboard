import test from 'node:test';
import assert from 'node:assert/strict';
import { DAY, WEEK, buildRankings, personalRank, parseSettings, movement, repositoryTotals } from '../public/assets/model.js';

const now = Date.parse('2026-10-11T12:00:00Z');
const pr = (u, age, a = 10, d = 2, bot = false) => ({ u, m: new Date(now - age).toISOString(), a, d, bot });
const settings = { metric: 'prs', period: 'all', hideBots: true };
const data = {
  prs: [pr('alice', 10 * DAY), pr('alice', DAY), pr('bob', 9 * DAY), pr('bob', 2 * DAY), pr('cara', DAY), pr('robot', DAY, 100, 50, true)],
  contributors: [{ u: 'alice', c: 10, bot: false }, { u: 'bob', c: 2, bot: false }, { u: 'robot', c: 100, bot: true }],
};

test('equal contribution totals share a competition rank and bots are excluded', () => {
  const { list } = buildRankings(data, settings, now);
  assert.deepEqual(list.map(r => [r.username, r.value, r.rank]), [['alice', 2, 1], ['bob', 2, 1], ['cara', 1, 3]]);
  assert.equal(buildRankings(data, { ...settings, hideBots: false }, now).list.length, 4);
});

test('rolling windows compare with the same window one week earlier', () => {
  const fixture = { prs: [pr('alice', 8 * DAY), pr('alice', DAY), pr('bob', 10 * DAY), pr('bob', 9 * DAY)], contributors: [] };
  const { list, previous } = buildRankings(fixture, { ...settings, period: '7' }, now);
  assert.deepEqual(list.map(r => [r.username, r.value]), [['alice', 1]]);
  assert.equal(previous.get('alice'), 2);
  assert.deepEqual(movement(list[0], previous), { kind: 'change', delta: 1 });
});

test('time boundaries, invalid dates and future merges do not inflate totals', () => {
  const fixture = { prs: [pr('alice', WEEK), pr('alice', WEEK + 1), pr('alice', -1), { ...pr('alice', DAY), m: 'invalid' }], contributors: [] };
  const { list } = buildRankings(fixture, { ...settings, period: '7' }, now);
  assert.equal(list[0].value, 1);
  assert.equal(list[0].weeks.reduce((a, b) => a + b, 0), 2);
});

test('line rankings count additions and deletions; weeks stay chronological', () => {
  const fixture = { prs: [pr('alice', 8 * DAY, 20, 10), pr('alice', DAY, 2, 3), pr('bob', DAY, 1, 1)], contributors: [] };
  const { list } = buildRankings(fixture, { ...settings, metric: 'lines' }, now);
  assert.equal(list[0].value, 35);
  assert.deepEqual(list[0].weeks.slice(-2), [30, 5]);
});

test('commits ignore the time filter and have no fabricated weekly movement', () => {
  const { list, previous } = buildRankings(data, { ...settings, metric: 'commits', period: '7' }, now);
  assert.deepEqual(list.map(r => [r.username, r.value]), [['alice', 10], ['bob', 2]]);
  assert.equal(previous, null);
  assert.equal(movement(list[0], previous), null);
});

test('personal rank lookup is case insensitive and uses the next distinct score', () => {
  const { list } = buildRankings(data, settings, now);
  const cara = personalRank(list, 'CARA');
  assert.equal(cara.me.rank, 3);
  assert.equal(cara.needed, 2);
  assert.equal(cara.ahead.value, 2);
  assert.equal(personalRank(list, 'unknown'), null);
  assert.equal(personalRank(list, 'alice').needed, 0);
});

test('case changes to GitHub logins do not create duplicate contributors', () => {
  const fixture = { prs: [pr('Alice', DAY), pr('alice', 2 * DAY)], contributors: [] };
  assert.equal(buildRankings(fixture, settings, now).list[0].value, 2);
  assert.equal(repositoryTotals(fixture).contributors, 1);
});

test('invalid shared URL settings fall back safely and valid preferences survive', () => {
  assert.deepEqual(parseSettings('?metric=__proto__&period=bad&me=%3Cscript%3E'), { metric: 'prs', period: 'all', me: '', hideBots: true });
  assert.deepEqual(parseSettings('?metric=lines&period=30&me=%40Alice&bots=1'), { metric: 'lines', period: '30', me: 'alice', hideBots: false });
});

test('the public leaderboard starts neutral, including with legacy saved identities', () => {
  for (const search of ['', '?me=', '?me=bad--name', '?metric=commits']) {
    const parsed = parseSettings(search, 'apoorvdarshan');
    assert.equal(parsed.me, '');
    assert.equal(personalRank(buildRankings(data, settings, now).list, parsed.me), null);
  }
  assert.equal(parseSettings('?me=Bob', 'alice').me, 'bob');
});
