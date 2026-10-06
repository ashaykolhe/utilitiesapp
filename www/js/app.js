'use strict';
/* Home (tool of the day, pinned, recent, collapsible categories), search and filters, tool screen, settings, backup,
   theme, Android back button. */
const APP_VERSION = '0.1.0';
let activeCleanup = null, view = 'home', homeScroll = 0, searchTimer = null, filter = 'all';

/* Theme */
const mq = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const pref = Store.get('theme', 'auto');
  const dark = pref === 'dark' || (pref === 'auto' && mq.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = dark ? '#0b1020' : '#f3f4fb';
}
mq.addEventListener && mq.addEventListener('change', applyTheme);
applyTheme();
const haptic = (ms) => { if (Store.get('haptics', true) && navigator.vibrate) navigator.vibrate(ms || 15); };

/* Home */
const FILTERS = [
  ['all', 'All', () => true],
  ['free', 'Free', t => !t.pro],
  ['pro', 'Pro', t => !!t.pro],
  ['none', 'No permissions', t => !(t.needs || []).some(n => n !== 'storage')],
  ['camera', 'Camera', t => (t.needs || []).includes('camera')],
  ['microphone', 'Microphone', t => (t.needs || []).includes('microphone')],
  ['location', 'Location', t => (t.needs || []).includes('location')],
  ['motion', 'Sensors', t => (t.needs || []).includes('motion')]
];
function tileHTML(t) {
  const c = catOf(t.cat);
  const lock = t.pro && !isPro() ? '<span class="lock" role="img" aria-label="Pro">🔒</span>' : '';
  return `<button class="tile" data-id="${t.id}" style="--c:${c.color}"><span class="ic" aria-hidden="true">${t.icon}</span>${lock}<span class="nm">${esc(t.name)}</span></button>`;
}
function gridHTML(tools) { return tools.map(tileHTML).join(''); }
function section(title, tools, opts = {}) {
  if (!tools.length) return '';
  const closed = opts.closed;
  return `<section class="sec${closed ? ' closed' : ''}" ${opts.key ? `data-key="${opts.key}"` : ''}>
    <header class="sec-h" ${opts.key ? `role="button" tabindex="0" aria-expanded="${!closed}"` : ''}><span class="sec-i" style="--c:${opts.color || 'var(--accent)'}" aria-hidden="true">${opts.icon || ''}</span><h2>${esc(title)}</h2><span class="muted">${tools.length}</span>${opts.key ? '<span class="chev" aria-hidden="true">▾</span>' : ''}</header>
    <div class="grid">${closed ? '' : gridHTML(tools)}</div></section>`;
}
/* One tool each day, the same all day, picked from the date. */
function toolOfTheDay() {
  const d = new Date(), key = d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate();
  const pool = Tools.list.filter(t => !t.pro);
  return pool[(key * 2654435761 >>> 0) % pool.length];
}
function totdHTML() {
  const t = toolOfTheDay(); if (!t) return '';
  return `<button class="totd" data-id="${t.id}" style="--c:${catOf(t.cat).color}"><span class="ic" aria-hidden="true">${t.icon}</span><span class="grow"><small>Tool of the day</small><b>${esc(t.name)}</b><span class="muted">${esc(t.desc || '')}</span></span></button>`;
}
function renderChips() {
  $('#filters').innerHTML = FILTERS.map(([id, label]) => `<button class="chip${id === filter ? ' on' : ''}" data-f="${id}" aria-pressed="${id === filter}">${esc(label)}</button>`).join('');
}
function renderHome() {
  const q = $('#search').value.trim().toLowerCase(), el = $('#sections');
  $('#count').textContent = Tools.list.length + ' tools, all on your phone';
  const fdef = FILTERS.find(f => f[0] === filter)[2];
  if (q || filter !== 'all') {
    const found = Tools.list.filter(t => fdef(t) && (!q || Tools.matches(t, q)));
    el.innerHTML = found.length ? `<div class="grid flat-grid">${gridHTML(found)}</div>` : '<p class="muted center pad">No tool matches that.</p>';
    return;
  }
  const pins = Prefs.pins(), closed = Prefs.closed();
  el.innerHTML = totdHTML() +
    section('Pinned', pins.map(Tools.get), { icon: '📌', color: '#f59e0b' }) +
    section('Recent', Prefs.recent().map(Tools.get).slice(0, 4), { icon: '🕘', color: '#64748b' }) +
    CATS.map(c => section(c.name, Tools.list.filter(t => t.cat === c.id), { icon: c.icon, color: c.color, key: c.id, closed: closed.includes(c.id) })).join('') +
    (pins.length ? '' : '<p class="muted center pad">Tip: press and hold a tool to pin it to the top.</p>');
}
function setSection(sec, open) {
  const k = sec.dataset.key, c = Prefs.closed(), i = c.indexOf(k);
  if (open && i >= 0) c.splice(i, 1); else if (!open && i < 0) c.push(k);
  Store.set('closed', c);
  sec.classList.toggle('closed', !open);
  sec.firstElementChild.setAttribute('aria-expanded', open);
  const grid = sec.querySelector('.grid');
  grid.innerHTML = open ? gridHTML(Tools.list.filter(t => t.cat === k)) : '';
}

/* One set of handlers for the whole home screen: tap opens, press and hold pins. */
let pressTimer = null, longPressed = false;
const sectionsEl = $('#sections');
sectionsEl.addEventListener('pointerdown', e => {
  const tile = e.target.closest('.tile'); if (!tile) return;
  longPressed = false;
  pressTimer = setTimeout(() => {
    longPressed = true; haptic(20);
    const on = togglePin(tile.dataset.id);
    if (on === null) return;
    toast(on ? 'Pinned' : 'Unpinned'); renderHome();
  }, 550);
});
['pointerup', 'pointerleave', 'pointercancel', 'scroll'].forEach(ev => sectionsEl.addEventListener(ev, () => clearTimeout(pressTimer), true));
sectionsEl.addEventListener('contextmenu', e => { if (e.target.closest('.tile')) e.preventDefault(); });
sectionsEl.addEventListener('click', e => {
  const hd = e.target.closest('.sec-h[role=button]');
  if (hd) { const sec = hd.parentElement; setSection(sec, sec.classList.contains('closed')); return; }
  const tile = e.target.closest('.tile, .totd');
  if (tile) { if (longPressed) { longPressed = false; return; } openTool(tile.dataset.id); }
});
sectionsEl.addEventListener('keydown', e => {
  const hd = e.target.closest('.sec-h[role=button]');
  if (hd && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); const sec = hd.parentElement; setSection(sec, sec.classList.contains('closed')); }
});
$('#filters').addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; filter = b.dataset.f; renderChips(); renderHome(); });
$('#search').oninput = () => { clearTimeout(searchTimer); searchTimer = setTimeout(renderHome, 80); };

/* Voice search where the WebView supports it */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recog = null;
if (SR) {
  $('#mic').hidden = false;
  $('#mic').onclick = () => {
    if (recog) return;
    recog = new SR(); recog.lang = navigator.language;
    recog.onresult = e => { $('#search').value = e.results[0][0].transcript; renderHome(); };
    recog.onerror = e => {
      if (e.error === 'service-not-allowed' || e.error === 'not-allowed') { $('#mic').hidden = true; toast('Voice search is not available on this phone'); }
      else toast('Could not hear you');
    };
    recog.onend = () => { recog = null; };
    try { recog.start(); } catch (e) { recog = null; }
  };
}

/* Pins: free users can pin a few tools, Pro unlocks the rest. Returns true (pinned), false (unpinned) or null (blocked by the free limit). */
function togglePin(id) {
  if (!Prefs.isPinned(id) && Prefs.pins().length >= proLimit('pins') && needPro('pins')) return null;
  return Prefs.togglePin(id);
}

/* Screens */
function show(name) {
  view = name;
  ['home', 'tool', 'settings'].forEach(s => { $('#' + s).hidden = s !== name; });
  if (name === 'home') window.scrollTo(0, homeScroll);
  else { window.scrollTo(0, 0); const h1 = name === 'tool' ? $('#toolTitle') : $('#settingsTitle'); h1.focus({ preventScroll: true }); }
}
function refreshPin(id) {
  const on = Prefs.isPinned(id), b = $('#pinBtn');
  b.textContent = on ? '★' : '☆'; b.setAttribute('aria-pressed', on); b.setAttribute('aria-label', on ? 'Unpin tool' : 'Pin tool');
}
function openTool(id) {
  const t = Tools.get(id); if (!t) return;
  if (t.pro && needPro(t.proKey || 'connect')) return;
  if (view === 'home') homeScroll = window.scrollY;
  Prefs.touch(id);
  $('#toolTitle').textContent = t.name; $('#toolDesc').textContent = t.desc || '';
  $('#pinBtn').dataset.id = id; refreshPin(id);
  const body = freshBody();
  show('tool'); history.pushState({ v: 'tool' }, '');
  try { activeCleanup = t.render(body) || null; } catch (e) { body.textContent = 'This tool could not start: ' + e.message; activeCleanup = null; }
}
/* Tools often attach listeners to their container. A new empty container for every tool means none of them can outlive it. */
function freshBody() {
  const old = $('#toolBody'), fresh = old.cloneNode(false);
  fresh.innerHTML = ''; old.replaceWith(fresh); return fresh;
}
function leaveTool() {
  if (activeCleanup) { try { activeCleanup(); } catch (e) {} activeCleanup = null; }
  freshBody();
}
function goHome() { if (view === 'tool') leaveTool(); renderHome(); show('home'); }
$('#pinBtn').onclick = () => {
  const id = $('#pinBtn').dataset.id, on = togglePin(id);
  if (on === null) return;
  refreshPin(id); toast(on ? 'Pinned to Home' : 'Unpinned');
};
$('#backBtn').onclick = () => history.back();
$('#setBack').onclick = () => history.back();
$('#settingsBtn').onclick = () => { homeScroll = window.scrollY; show('settings'); history.pushState({ v: 'settings' }, ''); };
addEventListener('popstate', () => { if (view !== 'home') goHome(); });

/* Colour themes: the first two are free. Button text is black or white, whichever reads better on the colour. */
const ACCENTS = [['#6d4aff', 'Violet', 0], ['#2563eb', 'Ocean', 0], ['#15803d', 'Forest', 1], ['#c2410c', 'Sunset', 1], ['#be185d', 'Rose', 1], ['#0e7490', 'Teal', 1]];
function textOn(hex) {
  const [r, g, b] = [1, 3, 5].map(i => { const v = parseInt(hex.slice(i, i + 2), 16) / 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
  const l = .2126 * r + .7152 * g + .0722 * b;
  return 1.05 / (l + .05) >= 4.5 ? '#ffffff' : '#0b1020';
}
function applyAccent() {
  let a = Store.get('accent', ACCENTS[0][0]);
  const d = ACCENTS.find(x => x[0] === a);
  if (!d || (d[2] && !isPro())) a = ACCENTS[0][0];
  const s = document.documentElement.style;
  s.setProperty('--accent', a); s.setProperty('--accent-t', textOn(a));
}
function renderAccents() {
  const cur = Store.get('accent', ACCENTS[0][0]);
  $('#accents').innerHTML = ACCENTS.map(([c, n, p]) => `<button class="sw${c === cur ? ' on' : ''}" data-c="${c}" data-p="${p}" style="background:${c}" aria-label="${n}${p && !isPro() ? ' (Pro)' : ''}" aria-pressed="${c === cur}">${p && !isPro() ? '<span class="lk" aria-hidden="true">🔒</span>' : ''}</button>`).join('');
}
$('#accents').addEventListener('click', e => {
  const b = e.target.closest('.sw'); if (!b) return;
  if (+b.dataset.p && needPro('accents')) return;
  Store.set('accent', b.dataset.c); applyAccent(); renderAccents();
});
function renderProState() { $('#proState').textContent = isPro() ? (onTrial() ? 'Trial until ' + fmtUntil(coupon.expiresAt) : 'Unlocked') : 'Free'; }

/* Pro sheet */
function setProStatus(text, kind) { const el = $('#proStatus'); el.hidden = !text; el.textContent = text || ''; el.className = 'status' + (kind === 'info' ? ' info' : ''); }
function renderPro() {
  $('#proSub').innerHTML = onTrial() ? esc('You have Pro until ' + fmtUntil(coupon.expiresAt) + '. Buy once to keep it after that.')
    : isPro() ? esc("You're all set. Thank you for supporting PocketKit!")
    : esc('One-time payment. No subscription, yours forever.') + (proPrice ? ' <b>' + esc(proPrice) + '</b>' : '');
  $('#proFeat').innerHTML = PRO_FEATURES.map(f => `<li class="${f.k === proFocus ? 'hl' : ''}"><span class="fi" aria-hidden="true">${f.i}</span><span>${esc(f.t)}${f.s ? '<small>' + esc(f.s) + '</small>' : ''}</span>${isPro() ? '<span class="ck" aria-label="included">✓</span>' : ''}</li>`).join('');
  $('#proBuy').hidden = $('#proRestore').hidden = pro || devPro;
  $('#proCoupon').hidden = isPro();
  $('#proClose').textContent = isPro() ? 'Done' : 'Not now';
  $('#proBuy').textContent = 'Unlock Pro' + (proPrice ? ' · ' + proPrice : '');
}
function openPro(focus) { proFocus = focus || null; setProStatus(null); renderPro(); loadPrice(); const d = $('#proDlg'); if (!d.open) d.showModal(); }
/* Called by pro.js whenever Pro starts, ends or the price arrives. */
function proChanged() {
  applyAccent(); if ($('#proDlg').open) renderPro(); renderProState(); renderAccents();
  if (view === 'home') renderHome();
  const t = view === 'tool' && Tools.get($('#pinBtn').dataset.id);
  if (t && t.pro && !isPro()) { history.back(); openPro(t.proKey || 'connect'); } // a Pro tool is open and Pro just ended
}
$('#proOpen').onclick = () => openPro();
$('#proClose').onclick = () => $('#proDlg').close();
$('#proBuy').onclick = async () => { setProStatus(null); const r = await buyPro(); if (r.ok) { renderPro(); proChanged(); toast('PocketKit Pro unlocked 🎉'); } else if (r.msg) setProStatus(r.msg, r.info ? 'info' : undefined); };
$('#proRestore').onclick = async () => { const r = await restorePro(); renderPro(); proChanged(); setProStatus(r.ok ? null : r.msg, 'info'); };
$('#proRedeem').onclick = async () => {
  const r = await redeemCoupon($('#proCode').value);
  const msgs = { invalid: "That code isn't valid.", expired: 'That code has expired.', 'not-yet': "That code isn't active yet.", 'already-pro': 'You already have Pro.', error: 'Could not check the code. Try again.' };
  if (!r.ok) { setProStatus(msgs[r.reason] || msgs.error); return; }
  $('#proCode').value = ''; proChanged(); toast('Trial unlocked 🎉');
};

/* Backup and restore of tool settings and saved data. Pro and trial state are never part of a backup.
   Files kept in the File Locker, recordings and the Password Vault live in the phone's database and are not included. */
const BACKUP_SKIP = /^pk\.(pro|dev|coupon|clock)$/;
function makeBackup() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('pk.') && !BACKUP_SKIP.test(k)) data[k] = localStorage.getItem(k); }
  return JSON.stringify({ app: 'PocketKit', version: 1, made: new Date().toISOString(), data });
}
async function saveFile(name, text, type) {
  const FS = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.Filesystem, SH = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.Share;
  if (FS && SH) {
    try {
      const r = await FS.writeFile({ path: name, data: btoa(unescape(encodeURIComponent(text))), directory: 'CACHE' });
      await SH.share({ title: name, url: r.uri }); return;
    } catch (e) { if (/cancel/i.test(String(e && e.message))) return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
$('#backupBtn').onclick = () => { saveFile('pocketkit-backup-' + new Date().toISOString().slice(0, 10) + '.json', makeBackup(), 'application/json'); toast('Backup ready'); };
$('#restoreBtn').onclick = () => $('#restoreFile').click();
$('#restoreFile').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  if (f.size > 5 * 1024 * 1024) { toast('That file is too large'); return; }
  try {
    const o = JSON.parse(await f.text());
    if (!o || o.app !== 'PocketKit' || typeof o.data !== 'object' || o.data === null) throw 0;
    let n = 0;
    for (const [k, v] of Object.entries(o.data)) {
      if (!/^pk\.[A-Za-z0-9_.-]{1,80}$/.test(k) || BACKUP_SKIP.test(k) || typeof v !== 'string' || v.length > 2e6) continue;
      try { JSON.parse(v); } catch (x) { continue; }
      localStorage.setItem(k, v); n++;
    }
    toast('Restored ' + n + ' items'); applyTheme(); applyAccent(); renderAccents(); $('#themeSel').value = Store.get('theme', 'auto'); renderHome();
  } catch (x) { toast('That is not a PocketKit backup'); }
};

/* Settings */
$('#themeSel').value = Store.get('theme', 'auto');
$('#themeSel').onchange = e => { Store.set('theme', e.target.value); applyTheme(); };
$('#hapticsChk').checked = Store.get('haptics', true);
$('#hapticsChk').onchange = e => Store.set('haptics', e.target.checked);
$('#clearRecent').onclick = () => { Store.set('recent', []); toast('Cleared'); };
$('#clearPins').onclick = () => { Store.set('pins', []); toast('Cleared'); };
$('#about').textContent = 'PocketKit ' + APP_VERSION + ' · Everything stays on your phone';

/* Capacitor's hardware back button: close an open sheet first, then leave a screen, then exit. */
const CapApp = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App;
if (CapApp) CapApp.addListener('backButton', () => {
  const d = $('#proDlg');
  if (d.open) { d.close(); return; }
  if (view !== 'home') history.back(); else CapApp.exitApp();
});

applyAccent(); renderAccents(); renderProState(); renderChips();
renderHome();
if (!Store.get('welcomed', false)) { Store.set('welcomed', true); setTimeout(() => toast('Welcome! Press and hold a tool to pin it.'), 600); }
