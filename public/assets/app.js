import { icon, mountIcons } from './icons.js';
import { REPO, LABELS, PERIODS, DEFAULT_PERIOD, fmt, compact, formatValue, units, parseSettings, buildRankings, personalRank, repositoryTotals, movement, validUsername, normalizeUsername } from './model.js';
import { createShareCard, downloadCanvas } from './share.js';

const $ = id => document.getElementById(id);
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const avatar = (username, size = 80) => `https://avatars.githubusercontent.com/${encodeURIComponent(username)}?s=${size}`;
const save = (key, value) => { try { localStorage.setItem(key, value); } catch { /* Preferences still work for this visit. */ } };
const INITIAL_ROWS = 4;
const STATIC_MODE = document.querySelector('meta[name="omi-data-mode"]')?.content === 'static';
const DATA_URL = STATIC_MODE ? './data/leaderboard.json' : './api/data';
const REFRESH_LABEL = STATIC_MODE ? 'Load latest published rankings' : 'Refresh GitHub data';
const state = { ...parseSettings(location.search), query: '', limit: INITIAL_ROWS, data: null };
let rankings = { list: [], previous: null }, personal = null, observer, shareCanvas, shareSettings, sharePersonal;
let toastTimer, searchTimer, shareRequest = 0, loading;
const showValue = value => formatValue(value, state.metric);
const selectedPeriod = () => state.metric === 'commits' ? 'all time' : PERIODS[state.period];
const scrollTo = element => element?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });

function ago(iso) {
  const seconds = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (!Number.isFinite(seconds)) return 'recently';
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function applyTheme(value) {
  const theme = ['system', 'light', 'dark'].includes(value) ? value : 'system';
  document.documentElement.dataset.theme = theme;
  save('omi-theme', theme);
  document.querySelectorAll('#theme button').forEach(button => {
    const checked = button.dataset.v === theme;
    button.setAttribute('aria-checked', checked);
    button.tabIndex = checked ? 0 : -1;
  });
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]').content = dark ? '#0b0c0f' : '#ffffff';
}

function shareUrl(settings = state) {
  const url = new URL(location.href);
  const params = new URLSearchParams();
  if (settings.me) params.set('me', settings.me);
  if (settings.metric !== 'prs') params.set('metric', settings.metric);
  if (settings.metric !== 'commits' && settings.period !== DEFAULT_PERIOD) params.set('period', settings.period);
  if (!settings.hideBots) params.set('bots', '1');
  url.search = params.toString(); url.hash = '';
  return url.href;
}

function movementView(row, previous) {
  const change = movement(row, previous);
  if (!change) return { text: '—', cls: '', title: 'Weekly commit rank history is unavailable' };
  if (change.kind === 'new') return { text: 'New', cls: 'up', title: 'Not ranked in the comparison period 7 days ago' };
  if (change.delta > 0) return { text: `+${change.delta}`, cls: 'up', title: `Up ${change.delta} places versus 7 days ago` };
  if (change.delta < 0) return { text: `−${-change.delta}`, cls: 'down', title: `Down ${-change.delta} places versus 7 days ago` };
  return { text: '—', cls: '', title: 'Same rank as 7 days ago' };
}

function renderProfile() {
  $('profile').classList.toggle('profile-discovery', !state.me);
  $('profile').setAttribute('aria-busy', 'false');
  $('profile').setAttribute('aria-label', state.me ? 'Your contribution' : 'Find your rank');
  if (!state.me) {
    $('profile').innerHTML = `<div class="discovery-copy"><h2>What’s your GitHub username?</h2><p>Find your rank and see what you’ve shipped to Omi.</p></div>
      <form id="rank-form" class="rank-form"><label class="sr" for="rank-username">GitHub username</label><div class="rank-input-row"><div class="username-input"><span aria-hidden="true">@</span><input id="rank-username" name="username" maxlength="39" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Your username" required aria-describedby="rank-error"></div><button class="button primary" type="submit">Show my rank ${icon('right')}</button></div><p class="field-error" id="rank-error" role="alert"></p></form>`;
    bindIdentityForm($('rank-form'), $('rank-username'), $('rank-error'));
    return;
  }
  const username = personal?.me.username || state.me;
  const identity = `<div class="profile-identity"><img class="profile-avatar" src="${avatar(username, 144)}" alt="" width="72" height="72"><div class="identity-text"><div class="identity-name"><strong>${esc(username)}</strong><button class="icon-button" id="edit-user" type="button" aria-label="Change GitHub username" title="Change GitHub username">${icon('pencil')}</button></div><span>Your contribution</span></div></div>`;
  if (personal) {
    const change = movementView(personal.me, rankings.previous);
    $('profile').innerHTML = `${identity}
      <div class="profile-stat rank"><strong class="profile-value num" id="your-rank">#${personal.me.rank}</strong><span class="label">Your rank</span><small title="Among ${fmt(personal.total)} ranked contributors">Top ${personal.top}%</small></div>
      <div class="profile-stat"><strong class="profile-value num" title="${fmt(personal.me.value)}">${showValue(personal.me.value)}</strong><span class="label">${LABELS[state.metric]}</span>${state.period !== 'all' && state.metric !== 'commits' ? `<small>${selectedPeriod()}</small>` : ''}</div>
      <div class="profile-stat"><strong class="profile-value num ${change.cls}" title="${esc(change.title)}">${change.text}</strong><span class="label">Places this week</span>${!rankings.previous ? '<small>All-time counts only</small>' : ''}</div>
      <div class="profile-action"><button class="button primary" type="button" id="share-rank">${icon('share')}Share my rank</button></div>`;
    $('share-rank').onclick = openShare;
  } else {
    $('profile').innerHTML = `${identity}<div class="profile-empty"><strong>No contributions in this view.</strong>No ${units(0, state.metric)} ${selectedPeriod()}. Try another range or username.</div><div class="profile-action"><button class="button secondary" type="button" id="change-empty">Find your rank</button></div>`;
    $('change-empty').onclick = openIdentity;
  }
  $('edit-user').onclick = openIdentity;
}

function renderFacts() {
  const totals = repositoryTotals(state.data);
  $('facts').innerHTML = `<div class="fact"><strong class="num">${fmt(totals.prs)}</strong><span>merged PRs</span></div><div class="fact"><strong class="num">${fmt(totals.contributors)}</strong><span>contributors</span></div><div class="fact"><strong class="num" title="${fmt(totals.lines)}">${compact(totals.lines)}</strong><span>lines changed</span></div>`;
  updateSync();
}

function updateSync() {
  if (!state.data) return;
  $('synced').querySelector('span').textContent = `Updated ${ago(state.data.syncedAt)}`;
  $('synced').title = `Last successful GitHub sync: ${new Date(state.data.syncedAt).toLocaleString()}`;
}

function renderLeaders() {
  $('leaders').innerHTML = rankings.list.slice(0, 3).map((row, index) => `<a class="leader ${index === 0 ? 'first' : ''} ${row === personal?.me ? 'mine' : ''}" ${row === personal?.me ? 'id="my-leader"' : ''} href="https://github.com/${encodeURIComponent(row.username)}" target="_blank" rel="noopener" aria-label="Rank ${row.rank}, ${esc(row.username)}, ${fmt(row.value)} ${units(row.value, state.metric)}">
      <span class="leader-place num">#${row.rank}</span><img class="leader-avatar" src="${avatar(row.username, 120)}" width="60" height="60" alt=""><span class="leader-copy"><strong class="leader-name">${esc(row.username)}</strong><span class="leader-unit">${units(row.value, state.metric)}</span></span><strong class="leader-value num" title="${fmt(row.value)}">${showValue(row.value)}</strong>
    </a>`).join('');
}

function contributionUrl(username) {
  if (state.metric === 'commits') return `https://github.com/${REPO}/commits?author=${encodeURIComponent(username)}`;
  return `https://github.com/${REPO}/pulls?q=${encodeURIComponent(`is:pr is:merged author:${username}`)}`;
}

function bars(weeks) {
  const max = Math.max(1, ...weeks);
  return `<span class="activity-bars" role="img" aria-label="Weekly activity, oldest to newest: ${weeks.map(fmt).join(', ')}" title="Weekly ${units(0, state.metric)}, oldest to newest: ${weeks.map(fmt).join(', ')}">${weeks.map(count => `<i aria-hidden="true" class="${count ? '' : 'inactive'}" style="--height:${count ? Math.max(12, count / max * 100) : 7}%"></i>`).join('')}</span>`;
}

function tableRow(row) {
  const mine = row === personal?.me;
  const change = movementView(row, rankings.previous);
  return `<tr class="${mine ? 'my-row' : ''}" ${mine ? 'id="my-row"' : ''}>
    <td class="rank-cell num">${row.rank}</td>
    <td><a class="contributor-link" href="https://github.com/${encodeURIComponent(row.username)}" target="_blank" rel="noopener" title="${esc(row.username)} on GitHub"><img src="${avatar(row.username, 76)}" width="38" height="38" loading="lazy" alt=""><span class="username">${esc(row.username)}</span>${mine ? '<span class="you-label">you</span>' : ''}${row.bot ? '<span class="bot-label">bot</span>' : ''}</a></td>
    <td class="activity-column">${row.weeks ? bars(row.weeks) : ''}</td>
    <td class="value-cell num"><a href="${contributionUrl(row.username)}" target="_blank" rel="noopener" title="View ${esc(row.username)}'s ${units(0, state.metric === 'lines' ? 'prs' : state.metric)} on GitHub">${showValue(row.value)}<span class="sr"> ${units(row.value, state.metric)}</span></a></td>
    <td class="movement-cell movement-column num ${change.cls}" title="${esc(change.title)}"><span aria-hidden="true">${change.text}</span><span class="sr">${esc(change.title)}</span></td>
  </tr>`;
}

function renderTable() {
  const query = state.query.trim().toLowerCase();
  const pool = query ? rankings.list.filter(row => row.username.toLowerCase().includes(query)) : rankings.list.slice(3);
  const shown = pool.slice(0, state.limit);
  const pin = personal && !query && rankings.list.indexOf(personal.me) >= 3 && !shown.includes(personal.me);
  $('board').setAttribute('aria-busy', 'false');
  if (!shown.length && !pin) {
    $('board').innerHTML = `<div class="empty-state"><h3>${query ? 'No matching contributors.' : rankings.list.length ? 'Everyone is up top.' : 'No contributions in this range.'}</h3><p>${query ? `Nothing matches “${esc(state.query)}”. Try part of a GitHub username.` : rankings.list.length ? 'All contributors for this view are shown above.' : 'Try all time to explore the full leaderboard.'}</p>${query ? '<button class="button secondary" type="button" id="clear-search">Clear search</button>' : !rankings.list.length ? '<button class="button secondary" type="button" id="reset-range">Show all time</button>' : ''}</div>`;
    if ($('clear-search')) $('clear-search').onclick = clearSearch;
    if ($('reset-range')) $('reset-range').onclick = () => { state.period = 'all'; render(); };
  } else {
    $('board').innerHTML = `<table class="ranking-table"><caption class="sr">${LABELS[state.metric]} leaderboard, ${selectedPeriod()}. ${state.hideBots ? 'Bots hidden.' : 'Including bots.'} Equal totals share a rank. Weekly movement compares this view with seven days ago.</caption><thead><tr><th scope="col">Rank</th><th scope="col">Contributor</th><th scope="col" class="activity-column">${state.metric === 'commits' ? '' : 'Last 12 weeks'}</th><th scope="col" class="value-column">${LABELS[state.metric].replace(' changed', '')}</th><th scope="col" class="movement-column"><abbr title="Rank movement versus 7 days ago">7d</abbr></th></tr></thead><tbody>${shown.map(tableRow).join('')}${pin ? `<tr class="gap-row" aria-hidden="true"><td>…</td><td>…</td><td class="activity-column"></td><td></td><td class="movement-column"></td></tr>${tableRow(personal.me)}` : ''}</tbody></table>`;
  }
  const remaining = pool.length - shown.length;
  $('board-pagination').innerHTML = remaining > 0 ? `<button class="button secondary" type="button" id="show-more">Show more contributors ${icon('down')}</button><span class="pagination-count">${fmt(remaining)} more</span>` : '';
  if ($('show-more')) $('show-more').onclick = () => { state.limit += 20; renderTable(); };
  $('results-announcement').textContent = query ? `${fmt(pool.length)} contributors match your search.` : `${fmt(rankings.list.length)} contributors ranked by ${LABELS[state.metric].toLowerCase()}, ${selectedPeriod()}.`;
  watchDock();
}

function renderFeed() {
  const prs = state.data.prs.filter(pr => !(state.hideBots && pr.bot)).sort((a, b) => Date.parse(b.m) - Date.parse(a.m)).slice(0, 4);
  const href = `https://github.com/${REPO}/pulls?q=is%3Apr+is%3Amerged+sort%3Aupdated-desc`;
  $('feed').innerHTML = `<div class="feed-header"><h3 class="feed-title"><i aria-hidden="true"></i>Just merged</h3><a href="${href}" target="_blank" rel="noopener" aria-label="View merged pull requests on GitHub">${icon('external')}</a></div>
    <ol class="feed-list">${prs.map(pr => `<li class="feed-item ${pr.u.toLowerCase() === state.me ? 'mine' : ''}"><a href="https://github.com/${REPO}/pull/${pr.n}" target="_blank" rel="noopener"><span class="merge-node">${icon('merge')}</span><span class="feed-content"><span class="feed-name">${esc(pr.t)}</span><span class="feed-meta"><span class="author">${esc(pr.u)}</span><span>#${pr.n}</span><time datetime="${esc(pr.m)}" title="${esc(new Date(pr.m).toLocaleString())}">${ago(pr.m)}</time></span></span></a></li>`).join('')}</ol>
    <div class="feed-footer"><a class="text-link" href="${href}" target="_blank" rel="noopener">View all merged PRs ${icon('external')}</a><p>${STATIC_MODE ? 'Updates scheduled every 30 minutes.' : 'GitHub data, refreshed every 30 minutes.'}</p></div>`;
}

function renderDock() {
  $('rank-dock').hidden = true;
  $('rank-dock').innerHTML = personal ? `<img src="${avatar(personal.me.username, 60)}" width="30" height="30" alt=""><strong class="num">#${personal.me.rank}</strong><button class="button primary" type="button" id="dock-find">Your rank ${icon('target')}</button>` : '';
  if ($('dock-find')) $('dock-find').onclick = findMe;
}

function watchDock() {
  observer?.disconnect();
  if (!personal) { $('rank-dock').hidden = true; return; }
  let profilePassed = false, rowVisible = false;
  observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.target.id === 'profile') profilePassed = !entry.isIntersecting && entry.boundingClientRect.bottom < 80;
      else rowVisible = entry.isIntersecting;
    }
    $('rank-dock').hidden = !profilePassed || rowVisible;
  }, { rootMargin: '-80px 0px -40px' });
  [$('profile'), $('my-row') || $('my-leader')].filter(Boolean).forEach(el => observer.observe(el));
}

function render() {
  if (!state.data) return;
  rankings = buildRankings(state.data, state);
  personal = personalRank(rankings.list, state.me);
  document.querySelectorAll('#metric button').forEach(button => button.setAttribute('aria-pressed', button.dataset.v === state.metric));
  $('period').disabled = state.metric === 'commits';
  $('period').value = state.metric === 'commits' ? 'all' : state.period;
  $('period-note').hidden = state.metric !== 'commits';
  $('bots').checked = state.hideBots;
  $('ranking-description').textContent = (state.metric === 'commits' ? 'Ranked by commits on the default branch.' : 'Ranked by what landed on main.') + (personal ? ' The blue light marks you.' : ' Every contribution counts.');
  renderProfile(); renderLeaders(); renderDock(); renderTable(); renderFeed();
  history.replaceState(null, '', shareUrl());
}

function clearSearch() {
  state.query = ''; state.limit = INITIAL_ROWS; $('q').value = ''; renderTable(); $('q').focus({ preventScroll: true });
}

function findMe() {
  if (!state.data) { toast('Rankings are still loading.'); return; }
  if (!personal) { openIdentity(); return; }
  state.query = ''; $('q').value = ''; renderTable();
  const target = $('my-row') || $('my-leader');
  scrollTo(target || $('profile'));
  if (target) {
    target.classList.remove('row-flash');
    requestAnimationFrame(() => target.classList.add('row-flash'));
    const link = target.matches('a') ? target : target.querySelector('a');
    link?.focus({ preventScroll: true });
  }
}

function openIdentity() {
  $('username').value = state.me;
  $('username-error').textContent = '';
  $('username').removeAttribute('aria-invalid');
  $('identity-dialog').showModal();
  $('username').focus(); $('username').select();
}

function bindIdentityForm(form, input, error) {
  form.onsubmit = event => {
    event.preventDefault();
    const username = normalizeUsername(input.value);
    if (!validUsername(username)) {
      error.textContent = 'Use a GitHub username: letters, numbers and single hyphens, up to 39 characters.';
      input.setAttribute('aria-invalid', 'true'); input.focus(); return;
    }
    state.me = username; state.limit = INITIAL_ROWS;
    $('identity-dialog').close(); render();
    scrollTo($('profile')); $('edit-user')?.focus({ preventScroll: true });
  };
  input.oninput = () => { error.textContent = ''; input.removeAttribute('aria-invalid'); };
}

function toast(message) {
  const el = $('toast'); el.textContent = message;
  // A manual popover stays visible above the native share dialog's top layer.
  if (el.showPopover) { el.setAttribute('popover', 'manual'); if (!el.matches(':popover-open')) el.showPopover(); }
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove('show'); if (el.hidePopover && el.matches(':popover-open')) el.hidePopover(); }, 2800);
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('Copied to clipboard'); }
  catch {
    $('copy-fallback').hidden = false; $('copy-value').value = text; $('copy-value').focus(); $('copy-value').select();
  }
}

async function openShare() {
  if (!personal) return;
  const request = ++shareRequest;
  sharePersonal = personal; shareSettings = { ...state }; shareCanvas = null;
  $('share-error').textContent = ''; $('copy-fallback').hidden = true;
  $('share-preview').textContent = 'Creating your card…'; $('share-preview').setAttribute('aria-busy', 'true');
  $('download-card').disabled = true;
  const context = personal.ahead ? `${fmt(personal.needed)} more ${units(personal.needed, state.metric)} to pass ${personal.ahead.username}.` : 'You’re leading the way.';
  $('share-context').textContent = `${context} Ranked ${selectedPeriod()}.`;
  $('share-dialog').showModal();
  try {
    const canvas = await createShareCard(sharePersonal, shareSettings);
    if (request !== shareRequest) return;
    shareCanvas = canvas;
    $('share-preview').replaceChildren(shareCanvas); $('download-card').disabled = false;
  } catch {
    if (request !== shareRequest) return;
    $('share-preview').textContent = 'The card couldn’t load.';
    $('share-error').textContent = 'Close and reopen to retry, or copy your rank as text or a link.';
  } finally { if (request === shareRequest) $('share-preview').setAttribute('aria-busy', 'false'); }
}

function load() {
  if (loading) return loading;
  loading = fetchData().finally(() => { loading = null; });
  return loading;
}

async function fetchData() {
  const response = await fetch(DATA_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error('GitHub data is temporarily unavailable.');
  const data = await response.json();
  if (!Array.isArray(data.prs) || !Array.isArray(data.contributors) || !data.syncedAt) throw new Error('The server returned incomplete rankings.');
  const changed = state.data?.syncedAt !== data.syncedAt;
  state.data = data;
  $('synced').classList.remove('error');
  if (changed) {
    // Background updates preserve text being entered and do not steal focus.
    const draft = $('rank-username')?.value, activeId = document.activeElement?.id;
    const selection = document.activeElement instanceof HTMLInputElement ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
    renderFacts(); render();
    if (draft != null && $('rank-username')) $('rank-username').value = draft;
    if (activeId && $(activeId)) {
      $(activeId).focus({ preventScroll: true });
      if (selection && selection[0] != null) $(activeId).setSelectionRange(...selection);
    }
  } else updateSync();
}

function showLoadError() {
  $('profile').innerHTML = '<div class="profile-empty"><strong>Rankings couldn’t load.</strong>Use Refresh to reconnect to GitHub.</div>';
  $('profile').setAttribute('aria-busy', 'false');
  $('board').setAttribute('aria-busy', 'false');
  $('board').innerHTML = '<div class="empty-state"><h3>Let’s try that again.</h3><p>The data service is unavailable right now.</p><button class="button primary" type="button" id="retry-load">Retry loading</button></div>';
  $('facts').innerHTML = '<span class="loading-label">Community totals unavailable</span>';
  $('synced').classList.add('error'); $('synced').querySelector('span').textContent = 'Connection unavailable';
  $('retry-load').onclick = async () => { $('retry-load').disabled = true; try { await load(); } catch { showLoadError(); } };
}

mountIcons();
applyTheme(document.documentElement.dataset.theme);
const themeButtons = [...document.querySelectorAll('#theme button')];
themeButtons.forEach(button => { button.onclick = () => applyTheme(button.dataset.v); });
$('theme').onkeydown = event => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const current = themeButtons.indexOf(document.activeElement);
  const index = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (current + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : 2)) % 3;
  applyTheme(themeButtons[index].dataset.v); themeButtons[index].focus();
};
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(document.documentElement.dataset.theme));
document.querySelectorAll('#metric button').forEach(button => { button.onclick = () => { state.metric = button.dataset.v; state.limit = INITIAL_ROWS; render(); }; });
$('period').onchange = event => { state.period = event.target.value; state.limit = INITIAL_ROWS; render(); };
$('bots').onchange = event => { state.hideBots = event.target.checked; state.limit = INITIAL_ROWS; render(); };
$('q').oninput = event => {
  state.query = event.target.value; state.limit = INITIAL_ROWS;
  clearTimeout(searchTimer); searchTimer = setTimeout(() => { if (state.data) renderTable(); }, 100);
};
$('find-me').onclick = findMe;
bindIdentityForm($('identity-form'), $('username'), $('username-error'));
document.querySelectorAll('[data-close]').forEach(button => { button.onclick = () => button.closest('dialog').close(); });
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
});
$('copy-text').onclick = () => {
  const { me, total } = sharePersonal;
  const settings = shareSettings;
  const period = settings.metric === 'commits' ? 'all time' : PERIODS[settings.period];
  copyText(`I'm #${me.rank} of ${fmt(total)} contributors to Omi with ${fmt(me.value)} ${units(me.value, settings.metric)} ${period}. Every merged PR, remembered.\nhttps://github.com/${REPO}`);
};
$('copy-link').onclick = () => copyText(shareUrl(shareSettings));
$('download-card').onclick = async () => {
  if (!shareCanvas) return;
  $('download-card').disabled = true;
  try { await downloadCanvas(shareCanvas, sharePersonal.me.username); toast('Share card downloaded'); }
  catch { $('share-error').textContent = 'The download failed. Please try again.'; }
  finally { $('download-card').disabled = false; }
};
$('refresh').onclick = async () => {
  $('refresh').disabled = true; $('refresh').setAttribute('aria-busy', 'true');
  $('refresh').setAttribute('aria-label', STATIC_MODE ? 'Loading latest rankings' : 'Refreshing GitHub data');
  try {
    if (!STATIC_MODE) {
      const response = await fetch('./api/refresh', { method: 'POST' });
      if (!response.ok) throw new Error('Refresh failed');
    }
    await load(); toast(STATIC_MODE ? 'Latest published rankings loaded' : 'Rankings are up to date');
  } catch {
    if (!state.data) showLoadError();
    else { $('synced').classList.add('error'); toast('Couldn’t refresh. Showing the last successful sync.'); }
  } finally {
    $('refresh').disabled = false; $('refresh').setAttribute('aria-busy', 'false');
    $('refresh').setAttribute('aria-label', REFRESH_LABEL);
  }
};
$('refresh').setAttribute('aria-label', REFRESH_LABEL);
$('refresh').title = REFRESH_LABEL;
load().catch(showLoadError);
setInterval(updateSync, 60000);
// Check the published snapshot without requiring visitors to reload the tab.
const backgroundRefresh = () => {
  if (document.hidden || $('refresh').disabled || document.querySelector('dialog[open]')) return;
  load().catch(() => {
    if (!state.data) showLoadError();
    else { $('synced').classList.add('error'); $('synced').querySelector('span').textContent = `Offline · Updated ${ago(state.data.syncedAt)}`; }
  });
};
setInterval(backgroundRefresh, 5 * 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) backgroundRefresh(); });
