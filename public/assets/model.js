export const DAY = 86400000, WEEK = 7 * DAY, REPO = 'BasedHardware/omi';
export const LABELS = { prs: 'Merged PRs', lines: 'Lines changed', commits: 'Commits' };
export const PERIODS = { all: 'all time', 365: 'in the past year', 90: 'in the past 90 days', 30: 'in the past 30 days', 7: 'in the past 7 days' };
export const DEFAULT_PERIOD = '30';
export const UNITS = { prs: ['merged PR', 'merged PRs'], lines: ['line changed', 'lines changed'], commits: ['commit', 'commits'] };
export const fmt = n => Math.round(n).toLocaleString('en-US');
export const compact = n => n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : fmt(n);
export const formatValue = (n, metric) => metric === 'lines' ? compact(n) : fmt(n);
export const units = (n, metric) => UNITS[metric][n === 1 ? 0 : 1];
export const validUsername = value => /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(value);
export const normalizeUsername = value => String(value || '').trim().replace(/^@/, '').toLowerCase();

export function parseSettings(search) {
  const p = new URLSearchParams(search);
  const requested = normalizeUsername(p.get('me'));
  return {
    metric: Object.hasOwn(LABELS, p.get('metric')) ? p.get('metric') : 'prs',
    period: Object.hasOwn(PERIODS, p.get('period')) ? p.get('period') : DEFAULT_PERIOD,
    me: validUsername(requested) ? requested : '',
    hideBots: p.get('bots') !== '1',
  };
}

export function rank(list) {
  list.sort((a, b) => b.value - a.value || a.username.localeCompare(b.username));
  list.forEach((row, i) => { row.rank = i && list[i - 1].value === row.value ? list[i - 1].rank : i + 1; });
  return list;
}

function aggregate(data, metric, hideBots, from, to, withWeeks) {
  const users = new Map();
  for (const pr of data.prs) {
    const date = Date.parse(pr.m);
    if (!Number.isFinite(date) || date >= to || (hideBots && pr.bot)) continue;
    if (date < from && (!withWeeks || date < to - 12 * WEEK)) continue;
    // GitHub login names are case insensitive, including renamed capitalization.
    const key = pr.u.toLowerCase();
    let user = users.get(key);
    if (!user) {
      user = { username: pr.u, bot: pr.bot, prs: 0, lines: 0, value: 0, weeks: withWeeks ? Array(12).fill(0) : null };
      users.set(key, user);
    }
    const lines = pr.a + pr.d;
    if (date >= from) { user.prs++; user.lines += lines; }
    if (withWeeks) {
      const bucket = Math.floor((to - date) / WEEK);
      if (bucket < 12) user.weeks[11 - bucket] += metric === 'lines' ? lines : 1;
    }
  }
  return rank([...users.values()].map(row => ({ ...row, value: metric === 'lines' ? row.lines : row.prs })).filter(row => row.value > 0));
}

export function buildRankings(data, settings, now = Date.now()) {
  if (settings.metric === 'commits') {
    return { list: rank(data.contributors.filter(c => c.c > 0 && !(settings.hideBots && c.bot)).map(c => ({ username: c.u, bot: c.bot, value: c.c, weeks: null }))), previous: null };
  }
  const span = settings.period === 'all' ? Infinity : Number(settings.period) * DAY;
  const list = aggregate(data, settings.metric, settings.hideBots, now - span, now, true);
  const before = aggregate(data, settings.metric, settings.hideBots, now - WEEK - span, now - WEEK, false);
  const previous = new Map(before.map(row => [row.username.toLowerCase(), row.rank]));
  return { list, previous };
}

export function movement(row, previous) {
  if (!previous) return null;
  const old = previous.get(row.username.toLowerCase());
  return old == null ? { kind: 'new', delta: 0 } : { kind: 'change', delta: old - row.rank };
}

export function personalRank(list, username) {
  const index = list.findIndex(row => row.username.toLowerCase() === username.toLowerCase());
  if (index < 0) return null;
  const me = list[index];
  const ahead = list.slice(0, index).reverse().find(row => row.value > me.value);
  return { me, total: list.length, top: Math.max(1, Math.ceil(me.rank / list.length * 100)), ahead, needed: ahead ? ahead.value - me.value + 1 : 0 };
}

export function repositoryTotals(data) {
  return {
    prs: data.prs.length,
    contributors: new Set(data.prs.filter(pr => !pr.bot).map(pr => pr.u.toLowerCase())).size,
    lines: data.prs.reduce((total, pr) => total + pr.a + pr.d, 0),
  };
}
