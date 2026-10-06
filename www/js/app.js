'use strict';
/* Home (tool of the day, pinned, collections, recent, categories), search and filters, tool screen, settings, backup,
   app lock, tour, languages, theme, Android back button. */
const APP_VERSION = '0.1.0';
const WHATS_NEW = {}; // 'x.y.z': ['line', ...] shown once after an update
let activeCleanup = null, view = 'home', homeScroll = 0, searchTimer = null, filter = 'all', curTool = null;

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
  ['surprise', 'Surprise me', null],
  ['free', 'Free', t => !t.pro],
  ['pro', 'Pro', t => !!t.pro],
  ['none', 'No permissions', t => !(t.needs || []).some(n => n !== 'storage')],
  ['camera', 'Camera', t => (t.needs || []).includes('camera')],
  ['microphone', 'Microphone', t => (t.needs || []).includes('microphone')],
  ['location', 'Location', t => (t.needs || []).includes('location')],
  ['motion', 'Sensors', t => (t.needs || []).includes('motion')]
];
function tileHTML(x) {
  const c = catOf(x.cat);
  const lock = x.pro && !isPro() ? `<span class="lock" role="img" aria-label="${esc(tr('Pro'))}">🔒</span>` : '';
  return `<button class="tile" data-id="${x.id}" style="--c:${c.color}"><span class="ic" aria-hidden="true">${x.icon}</span>${lock}<span class="nm">${esc(toolName(x))}</span></button>`;
}
function gridHTML(tools) { return tools.map(tileHTML).join(''); }
function section(title, tools, opts = {}) {
  if (!tools.length) return '';
  const closed = opts.closed;
  return `<section class="sec${closed ? ' closed' : ''}" ${opts.key ? `data-key="${esc(opts.key)}"` : ''}>
    <header class="sec-h" ${opts.key ? `role="button" tabindex="0" aria-expanded="${!closed}"` : ''}><span class="sec-i" style="--c:${opts.color || 'var(--accent)'}" aria-hidden="true">${opts.icon || ''}</span><h2>${esc(title)}</h2><span class="muted">${tools.length}</span>${opts.key ? '<span class="chev" aria-hidden="true">▾</span>' : ''}</header>
    <div class="grid">${closed ? '' : gridHTML(tools)}</div></section>`;
}
/* The tools a section key stands for: a category id, or 'coll:<id>' for a collection. */
function toolsForKey(k) {
  if (k.startsWith('coll:')) { const c = Prefs.colls().find(x => x.id === k.slice(5)); return c ? c.tools.map(Tools.get) : []; }
  return Tools.list.filter(x => x.cat === k);
}
/* One tool each day, the same all day, picked from the date. */
function toolOfTheDay() {
  const d = new Date(), key = d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate();
  const pool = Tools.list.filter(x => !x.pro);
  return pool[(key * 2654435761 >>> 0) % pool.length];
}
function totdHTML() {
  const x = toolOfTheDay(); if (!x) return '';
  return `<button class="totd" data-id="${x.id}" style="--c:${catOf(x.cat).color}"><span class="ic" aria-hidden="true">${x.icon}</span><span class="grow"><small>${esc(tr('Tool of the day'))}</small><b>${esc(toolName(x))}</b><span class="muted">${esc(toolDesc(x))}</span></span></button>`;
}
function renderChips() {
  $('#filters').innerHTML = FILTERS.map(([id, label]) => `<button class="chip${id === filter ? ' on' : ''}" data-f="${id}" aria-pressed="${id === filter}">${id === 'surprise' ? '🎲 ' : ''}${esc(tr(label))}</button>`).join('');
}
/* Lower is better: name starts with it, a word in the name starts with it, name contains it, a keyword or category matches. -1 = no match. */
function searchScore(x, q) {
  const names = [x.name.toLowerCase(), toolName(x).toLowerCase()];
  if (names.some(n => n.startsWith(q))) return 0;
  if (names.some(n => n.split(/[s&-/]+/).some(w => w.startsWith(q)))) return 1;
  if (names.some(n => n.includes(q))) return 2;
  if ((x.keys || []).some(k => String(k).toLowerCase().includes(q))) return 3;
  return Tools.matches(x, q) ? 4 : -1;
}
function renderHome() {
  const q = $('#search').value.trim().toLowerCase(), el = $('#sections');
  $('#count').textContent = tr('{n} tools, all on your phone').replace('{n}', Tools.list.length);
  const fdef = (FILTERS.find(f => f[0] === filter) || FILTERS[0])[2] || (() => true);
  if (q || filter !== 'all') {
    let found = Tools.list.filter(x => fdef(x) && (!q || searchScore(x, q) >= 0));
    if (q) found = found.map(x => [searchScore(x, q), x]).sort((a, b) => a[0] - b[0]).map(p => p[1]);
    el.innerHTML = found.length ? `<div class="grid flat-grid">${gridHTML(found)}</div>` : `<p class="muted center pad">${esc(tr('No tool matches that.'))}</p>`;
    return;
  }
  const pins = Prefs.pins(), closed = Prefs.closed();
  el.innerHTML = totdHTML() +
    section(tr('Pinned'), pins.map(Tools.get), { icon: '📌', color: '#f59e0b' }) +
    Prefs.colls().map(c => section(c.name, c.tools.map(Tools.get), { icon: '📁', color: '#06b6d4', key: 'coll:' + c.id, closed: closed.includes('coll:' + c.id) })).join('') +
    section(tr('Recent'), Prefs.recent().map(Tools.get).slice(0, 4), { icon: '🕘', color: '#64748b' }) +
    CATS.map(c => section(catName(c), Tools.list.filter(x => x.cat === c.id), { icon: c.icon, color: c.color, key: c.id, closed: closed.includes(c.id) })).join('') +
    (pins.length ? '' : `<p class="muted center pad">${esc(tr('Tip: press and hold a tool to pin it to the top.'))}</p>`);
}
function setSection(sec, open) {
  const k = sec.dataset.key, c = Prefs.closed(), i = c.indexOf(k);
  if (open && i >= 0) c.splice(i, 1); else if (!open && i < 0) c.push(k);
  Store.set('closed', c);
  sec.classList.toggle('closed', !open);
  sec.firstElementChild.setAttribute('aria-expanded', open);
  sec.querySelector('.grid').innerHTML = open ? gridHTML(toolsForKey(k)) : '';
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
    toast(on ? tr('Pinned') : tr('Unpinned')); renderHome();
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
$('#filters').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  if (b.dataset.f === 'surprise') { // open a random free tool
    const pool = Tools.list.filter(x => !x.pro && !(x.needs || []).some(n => ['camera', 'microphone', 'location'].includes(n)));
    openTool(pool[Math.floor(Math.random() * pool.length)].id); return;
  }
  filter = b.dataset.f; renderChips(); renderHome();
});
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
      if (e.error === 'service-not-allowed' || e.error === 'not-allowed') { $('#mic').hidden = true; toast(tr('Voice search is not available on this phone')); }
      else toast(tr('Could not hear you'));
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
  b.textContent = on ? '★' : '☆'; b.setAttribute('aria-pressed', on); b.setAttribute('aria-label', on ? tr('Unpin tool') : tr('Pin tool'));
}
/* Tools often attach listeners to their container. A new empty container for every tool means none of them can outlive it. */
function freshBody() {
  const old = $('#toolBody'), fresh = old.cloneNode(false);
  fresh.innerHTML = ''; old.replaceWith(fresh); return fresh;
}
function openTool(id) {
  const x = Tools.get(id); if (!x) return;
  if (x.pro && needPro(x.proKey || 'connect')) return;
  if (view === 'home') homeScroll = window.scrollY;
  Prefs.touch(id); curTool = x; histChanged();
  $('#toolTitle').textContent = toolName(x); $('#toolDesc').textContent = toolDesc(x);
  $('#pinBtn').dataset.id = id; refreshPin(id);
  const body = freshBody(); attachValidation(body);
  show('tool'); history.pushState({ v: 'tool' }, '');
  try { activeCleanup = x.render(body) || null; } catch (e) { body.textContent = tr('This tool could not start:') + ' ' + e.message; activeCleanup = null; }
}
function leaveTool() {
  if (activeCleanup) { try { activeCleanup(); } catch (e) {} activeCleanup = null; }
  freshBody(); curTool = null; histChanged();
}
function goHome() { if (view === 'tool') leaveTool(); renderHome(); show('home'); }
$('#pinBtn').onclick = () => {
  const id = $('#pinBtn').dataset.id, on = togglePin(id);
  if (on === null) return;
  refreshPin(id); toast(on ? tr('Pinned to Home') : tr('Unpinned'));
};
$('#backBtn').onclick = () => history.back();
$('#setBack').onclick = () => history.back();
$('#settingsBtn').onclick = () => { homeScroll = window.scrollY; show('settings'); history.pushState({ v: 'settings' }, ''); };
addEventListener('popstate', () => { if (view !== 'home') goHome(); });

/* Share what is on screen: the tool's text plus the values typed into its fields. */
function describeScreen() {
  const body = $('#toolBody'); const lines = [];
  const walk = (n) => {
    for (const c of n.childNodes) {
      if (c.nodeType === 3) { const s = c.textContent.replace(/\s+/g, ' ').trim(); if (s) lines.push(s); }
      else if (c.nodeType === 1) {
        const tag = c.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'CANVAS' || tag === 'VIDEO' || tag === 'SVG' || c.hidden) continue;
        if (tag === 'INPUT' && !['checkbox', 'radio', 'button', 'file', 'range', 'password'].includes(c.type)) { if (c.value) lines.push((c.getAttribute('aria-label') || c.placeholder || '') + ': ' + c.value); }
        else if (tag === 'TEXTAREA') { if (c.value) lines.push(c.value); }
        else if (tag === 'SELECT') { lines.push(c.options[c.selectedIndex] ? c.options[c.selectedIndex].text : ''); }
        else if (tag !== 'BUTTON') walk(c);
      }
    }
  };
  walk(body);
  return lines.filter(Boolean).join('\n').slice(0, 4000);
}
$('#shareBtn').onclick = () => {
  const text = describeScreen();
  if (!text) { toast(tr('Nothing to share yet')); return; }
  shareText(curTool ? toolName(curTool) : 'PocketKit', (curTool ? toolName(curTool) + '\n\n' : '') + text + '\n\n' + tr('Made with PocketKit'));
};

/* History of results for the open tool (tools opt in with Hist.add). */
function histChanged() { const b = $('#histBtn'); if (b) b.hidden = !(curTool && Hist.list(curTool.id).length); }
function renderHist() {
  const list = curTool ? Hist.list(curTool.id) : [];
  $('#histList').innerHTML = list.length ? list.map((x, i) => `<div class="item"><div class="grow"><div class="muted" style="font-size:12px">${esc(new Date(x.at).toLocaleString())}</div><div>${esc(x.l)}</div><b>${esc(x.v)}</b></div><button class="btn alt" data-i="${i}" aria-label="${esc(tr('Copy'))}">⧉</button></div>`).join('') : `<p class="muted">${esc(tr('Nothing here yet.'))}</p>`;
}
$('#histBtn').onclick = () => { renderHist(); $('#histDlg').showModal(); };
$('#histClose').onclick = () => $('#histDlg').close();
$('#histClear').onclick = () => { if (curTool) Hist.clear(curTool.id); renderHist(); $('#histDlg').close(); toast(tr('Cleared')); };
$('#histList').addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (!b || !curTool) return; const x = Hist.list(curTool.id)[+b.dataset.i]; if (x) navigator.clipboard.writeText(x.l + ' = ' + x.v).then(() => toast(tr('Copied to the clipboard')), () => toast(tr('Could not share'))); });

/* Collections (Pro): named groups of tools shown on Home. */
function renderColl() {
  const id = $('#pinBtn').dataset.id, list = Prefs.colls();
  $('#collSub').textContent = list.length ? tr('Tick the collections this tool belongs to.') : tr('Make a collection, for example "Travel" or "Study".');
  $('#collList').innerHTML = list.map(c => `<div class="item"><label class="grow" style="display:flex;gap:10px;align-items:center;min-height:44px"><input type="checkbox" data-c="${esc(c.id)}"${c.tools.includes(id) ? ' checked' : ''}><span>${esc(c.name)}</span></label><button class="btn alt" data-del="${esc(c.id)}" aria-label="${esc(tr('Delete collection'))} ${esc(c.name)}">🗑</button></div>`).join('');
}
$('#collBtn').onclick = () => { renderColl(); $('#collDlg').showModal(); };
$('#collClose').onclick = () => { $('#collDlg').close(); renderHome(); };
$('#collList').addEventListener('change', e => {
  const cb = e.target.closest('input[data-c]'); if (!cb) return;
  const id = $('#pinBtn').dataset.id, list = Prefs.colls(), c = list.find(x => x.id === cb.dataset.c); if (!c) return;
  if (cb.checked) { if (!c.tools.includes(id)) c.tools.push(id); } else c.tools = c.tools.filter(x => x !== id);
  Prefs.saveColls(list);
});
$('#collList').addEventListener('click', e => {
  const b = e.target.closest('[data-del]'); if (!b) return;
  if (!confirm(tr('Delete this collection? The tools themselves stay.'))) return;
  Prefs.saveColls(Prefs.colls().filter(x => x.id !== b.dataset.del)); renderColl();
});
$('#collAdd').onclick = () => {
  const name = $('#collName').value.trim(); if (!name) return;
  if (needPro('pins')) return;
  const list = Prefs.colls(); if (list.length >= 12) { toast(tr('That is the most collections you can have')); return; }
  list.push({ id: Date.now().toString(36), name: name.slice(0, 30), tools: [$('#pinBtn').dataset.id] });
  Prefs.saveColls(list); $('#collName').value = ''; renderColl();
};

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
/* The Pro card in Settings: trial, unlocked or free (with a shortcut to enter a code). */
function renderProState() {
  const c = $('#proCard'); if (!c) return;
  if (onTrial()) c.innerHTML = `<b>PocketKit Pro</b><p class="ok" style="margin:0">✓ ${esc(tr('Pro trial until') + ' ' + fmtUntil(coupon.expiresAt))}</p><button class="btn" id="proSee">${esc(tr('See what Pro includes'))}${proPrice ? ' · ' + esc(proPrice) : ''}</button>`;
  else if (isPro()) c.innerHTML = `<b>PocketKit Pro</b><p class="ok" style="margin:0">✓ ${esc(tr('Pro unlocked'))}${devPro && !pro ? ' (dev override)' : ''}. ${esc(tr('Thank you for supporting PocketKit!'))}</p><button class="btn alt" id="proSee">${esc(tr("See what's included"))}</button>`;
  else { loadPrice(); c.innerHTML = `<b>PocketKit Pro</b><p class="muted" style="margin:0;font-size:14px">${esc(tr('One-time payment, no subscription. Extra tools, higher limits and all colour themes.'))}${proPrice ? ' <b>' + esc(proPrice) + '</b>' : ''}</p><button class="btn" id="proSee">${esc(tr('See what Pro includes'))}${proPrice ? ' · ' + esc(proPrice) : ''}</button><button class="btn alt" id="proCodeLink">${esc(tr('Have a code?'))}</button>`; }
}
$('#proCard').addEventListener('click', e => { if (e.target.closest('#proSee')) openPro(); else if (e.target.closest('#proCodeLink')) openPro('coupon'); });

/* Pro sheet */
function setProStatus(text, kind) { const el = $('#proStatus'); el.hidden = !text; el.textContent = text || ''; el.className = 'status' + (kind === 'info' ? ' info' : ''); }
function renderPro() {
  $('#proSub').innerHTML = onTrial() ? esc(tr('You have Pro until {d}. Buy once to keep it after that.').replace('{d}', fmtUntil(coupon.expiresAt)))
    : isPro() ? esc(tr("You're all set. Thank you for supporting PocketKit!"))
    : esc(tr('One-time payment. No subscription, yours forever.')) + (proPrice ? ' <b>' + esc(proPrice) + '</b>' : '');
  $('#proFeat').innerHTML = PRO_FEATURES.map(f => `<li class="${f.k === proFocus ? 'hl' : ''}"><span class="fi" aria-hidden="true">${f.i}</span><span>${esc(tr(f.t))}${f.s ? '<small>' + esc(tr(f.s)) + '</small>' : ''}</span>${isPro() ? `<span class="ck" aria-label="${esc(tr('included'))}">✓</span>` : ''}</li>`).join('');
  $('#proBuy').hidden = $('#proRestore').hidden = pro || devPro;
  $('#proCoupon').hidden = isPro();
  $('#proClose').textContent = tr(isPro() ? 'Done' : 'Not now');
  $('#proBuy').textContent = tr('Unlock Pro') + (proPrice ? ' · ' + proPrice : '');
}
function openPro(focus) { proFocus = focus || null; setProStatus(null); renderPro(); loadPrice(); const d = $('#proDlg'); if (!d.open) d.showModal(); if (focus === 'coupon' && !$('#proCoupon').hidden) setTimeout(() => $('#proCode').focus(), 50); }
/* Called by pro.js whenever Pro starts, ends or the price arrives. */
function proChanged() {
  applyAccent(); if ($('#proDlg').open) renderPro(); renderProState(); renderAccents(); if (typeof renderDriveCard === 'function') renderDriveCard();
  if (view === 'home') renderHome();
  const x = view === 'tool' && Tools.get($('#pinBtn').dataset.id);
  if (x && x.pro && !isPro()) { history.back(); openPro(x.proKey || 'connect'); } // a Pro tool is open and Pro just ended
}
$('#proClose').onclick = () => $('#proDlg').close();
$('#proBuy').onclick = async () => { setProStatus(null); const r = await buyPro(); if (r.ok) { renderPro(); proChanged(); toast(tr('PocketKit Pro unlocked 🎉')); } else if (r.msg) setProStatus(tr(r.msg), r.info ? 'info' : undefined); };
$('#proRestore').onclick = async () => { const r = await restorePro(); renderPro(); proChanged(); setProStatus(r.ok ? null : tr(r.msg), 'info'); };
$('#proRedeem').onclick = async () => {
  setProStatus(tr('Checking code…'), 'info');
  const r = await redeemCoupon($('#proCode').value);
  if (r.ok) {
    $('#proCode').value = ''; renderPro(); proChanged();
    setProStatus(r.persisted ? tr('Code accepted. Pro is on until {d}.').replace('{d}', fmtUntil(coupon.expiresAt)) : tr("Code accepted, but it couldn't be saved. Free up some space and enter it again."), r.persisted ? 'info' : undefined);
    return;
  }
  const msgs = { invalid: 'That code is not valid.', expired: 'That code has expired.', 'not-yet': 'That code is not active yet.', 'already-pro': 'You already own Pro, no code needed.', error: "Couldn't check the code on this device." };
  setProStatus(tr(msgs[r.reason] || msgs.invalid));
};
$('#proCode').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#proCode').blur(); $('#proRedeem').click(); } });

/* Backup and restore of tool settings and saved data. Pro and trial state are never part of a backup.
   Files kept in the File Locker, recordings and the Password Vault live in the phone's database and are not included. */
const BACKUP_SKIP = /^pk\.(pro|dev|coupon|clock)$/;
function makeBackup() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('pk.') && !BACKUP_SKIP.test(k)) data[k] = localStorage.getItem(k); }
  return JSON.stringify({ app: 'PocketKit', version: 1, made: new Date().toISOString(), data });
}
$('#backupBtn').onclick = async () => { if (await saveTextFile('pocketkit-backup-' + new Date().toISOString().slice(0, 10) + '.json', makeBackup(), 'application/json')) toast(tr('Backup ready')); };
$('#restoreBtn').onclick = () => $('#restoreFile').click();
/* Put a backup's contents back. Used by the file restore and by Google Drive restore. Throws when the text is not a PocketKit backup.
   Only keys in the app's own 'pk.' namespace with valid JSON values are written, so a backup can never carry Pro, the PIN or the Drive connection. */
function applyBackup(text) {
  const o = JSON.parse(text);
  if (!o || o.app !== 'PocketKit' || typeof o.data !== 'object' || o.data === null) throw new Error('not a PocketKit backup');
  let n = 0;
  for (const [k, v] of Object.entries(o.data)) {
    if (!/^pk\.[A-Za-z0-9_.-]{1,80}$/.test(k) || BACKUP_SKIP.test(k) || typeof v !== 'string' || v.length > 2e6) continue;
    try { JSON.parse(v); } catch (x) { continue; }
    localStorage.setItem(k, v); n++;
  }
  applyTheme(); applyAccent(); renderAccents(); $('#themeSel').value = Store.get('theme', 'auto'); $('#hapticsChk').checked = Store.get('haptics', true); renderHome();
  return n;
}
$('#restoreFile').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  if (f.size > 5 * 1024 * 1024) { toast(tr('That file is too large')); return; }
  try { toast(tr('Restored {n} items').replace('{n}', applyBackup(await f.text()))); }
  catch (x) { toast(tr('That is not a PocketKit backup')); }
};

/* App lock: a PIN (4 to 6 digits) asked when PocketKit opens or comes back after the chosen time away. The PIN is stored only as a
   salted PBKDF2 hash, outside the 'pk.' namespace, so backups never carry it. There is no recovery: clearing the app data removes it. */
const LOCK_KEY = 'pkx.lock', FAIL_KEY = 'pkx.lockfail', NB = () => (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.NativeBiometric) || null;
let locked = false, hiddenAt = 0, pinMode = 'set', pinDone = null;
const b64 = u8 => btoa(String.fromCharCode(...u8)), unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const lockCfg = () => { try { const o = JSON.parse(localStorage.getItem(LOCK_KEY) || 'null'); return o && o.salt && o.hash ? o : null; } catch (e) { return null; } };
async function pinHash(pin, salt) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  return b64(new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 150000 }, k, 256)));
}
async function pinOk(pin) { const c = lockCfg(); return !!c && (await pinHash(pin, unb64(c.salt))) === c.hash; }
const failState = () => { try { return JSON.parse(localStorage.getItem(FAIL_KEY) || '{"n":0,"until":0}'); } catch (e) { return { n: 0, until: 0 }; } };
/* Wrong-PIN counter that survives restarts: 5 misses, then a wait that doubles. */
async function tryPin(pin) {
  const f = failState(), now = Date.now();
  if (now < f.until) return { ok: false, wait: Math.ceil((f.until - now) / 1000) };
  if (await pinOk(pin)) { localStorage.removeItem(FAIL_KEY); return { ok: true }; }
  f.n++; if (f.n >= 5) f.until = now + Math.min(15 * 60, 30 * 2 ** (f.n - 5)) * 1000;
  try { localStorage.setItem(FAIL_KEY, JSON.stringify(f)); } catch (e) {}
  return { ok: false, wait: f.until > now ? Math.ceil((f.until - now) / 1000) : 0 };
}
function lockNow() {
  if (!lockCfg() || locked) return;
  locked = true;
  $$('dialog[open]').forEach(d => d.close());
  $('#app').setAttribute('inert', ''); $('#appLock').hidden = false; $('#lockMsg').hidden = true; $('#lockPin').value = '';
  const c = lockCfg(); $('#lockBio').hidden = !(c.bio && NB());
  setTimeout(() => $('#lockPin').focus(), 50);
  if (c.bio && NB()) setTimeout(bioUnlock, 250);
}
function unlockNow() { locked = false; $('#appLock').hidden = true; $('#app').removeAttribute('inert'); }
async function bioUnlock() {
  const nb = NB(); if (!nb) return;
  try { await nb.verifyIdentity({ reason: tr('Unlock PocketKit'), title: tr('Unlock PocketKit') }); unlockNow(); } catch (e) { /* cancelled: the PIN still works */ }
}
async function submitLock() {
  const pin = $('#lockPin').value; if (!/^\d{4,6}$/.test(pin)) return;
  const r = await tryPin(pin);
  if (r.ok) { unlockNow(); return; }
  $('#lockPin').value = '';
  const m = $('#lockMsg'); m.hidden = false; m.textContent = r.wait ? tr('Too many tries. Wait {s} seconds.').replace('{s}', r.wait) : tr('Wrong PIN.');
}
$('#lockGo').onclick = submitLock;
$('#lockPin').addEventListener('keydown', e => { if (e.key === 'Enter') submitLock(); });
$('#lockBio').onclick = bioUnlock;
/* Leaving the app on purpose (Google's consent screen, a file picker the app opened) must not count as "away": wrap such a call in outside(). */
let outsideUntil = 0;
async function outside(fn) {
  outsideUntil = Date.now() + 5 * 60000;
  try { return await fn(); } finally { outsideUntil = Date.now() + 2000; hiddenAt = 0; }
}
document.addEventListener('visibilitychange', () => {
  const c = lockCfg(); if (!c) return;
  if (document.hidden) hiddenAt = Date.now();
  else if (!locked && hiddenAt && Date.now() >= outsideUntil && Date.now() - hiddenAt >= (c.delay || 0) * 1000) lockNow();
});

/* PIN dialog: 'set' asks twice, 'verify' asks once (used to turn the lock off or change the PIN). */
function askPin(mode, done) {
  pinMode = mode; pinDone = done;
  $('#pinTitle').textContent = tr(mode === 'set' ? 'Set a PIN' : 'Enter your PIN');
  $('#pinSub').textContent = tr(mode === 'set' ? 'Choose 4 to 6 digits.' : 'To change this setting, enter your current PIN.');
  $('#pinB').hidden = mode !== 'set'; $('#pinA').value = $('#pinB').value = ''; $('#pinMsg').hidden = true;
  $('#pinDlg').showModal(); $('#pinA').focus();
}
$('#pinCancel').onclick = () => { $('#pinDlg').close(); if (pinDone) pinDone(false); pinDone = null; };
$('#pinSave').onclick = async () => {
  const a = $('#pinA').value, msg = (s) => { const m = $('#pinMsg'); m.hidden = false; m.textContent = tr(s); };
  if (!/^\d{4,6}$/.test(a)) { msg('Use 4 to 6 digits.'); return; }
  if (pinMode === 'set') {
    if (a !== $('#pinB').value) { msg('The two PINs are different.'); return; }
    if (!crypto || !crypto.subtle) { msg('This phone cannot protect a PIN safely.'); return; }
    const salt = crypto.getRandomValues(new Uint8Array(16)), old = lockCfg();
    localStorage.setItem(LOCK_KEY, JSON.stringify({ salt: b64(salt), hash: await pinHash(a, salt), delay: old ? old.delay : 30, bio: old ? old.bio : false }));
    localStorage.removeItem(FAIL_KEY);
  } else {
    const r = await tryPin(a);
    if (!r.ok) { msg(r.wait ? tr('Too many tries. Wait {s} seconds.').replace('{s}', r.wait) : 'Wrong PIN.'); return; }
  }
  $('#pinDlg').close(); const d = pinDone; pinDone = null; if (d) d(true);
};
function renderLockSettings() {
  const c = lockCfg(); $('#lockChk').checked = !!c; $('#lockOpts').hidden = !c;
  if (c) { $('#lockDelay').value = String(c.delay ?? 30); $('#bioRow').hidden = !NB(); $('#bioChk').checked = !!c.bio; }
}
function patchLock(p) { const c = lockCfg(); if (c) localStorage.setItem(LOCK_KEY, JSON.stringify({ ...c, ...p })); }
$('#lockChk').onchange = e => {
  if (e.target.checked) askPin('set', ok => { renderLockSettings(); if (ok) toast(tr('App lock is on')); });
  else askPin('verify', ok => { if (ok) { localStorage.removeItem(LOCK_KEY); localStorage.removeItem(FAIL_KEY); toast(tr('App lock is off')); } renderLockSettings(); });
};
$('#changePin').onclick = () => askPin('verify', ok => { if (ok) askPin('set', () => renderLockSettings()); });
$('#lockDelay').onchange = e => patchLock({ delay: +e.target.value });
$('#bioChk').onchange = async e => {
  if (!e.target.checked) { patchLock({ bio: false }); return; }
  const nb = NB(); try { const r = await nb.isAvailable(); if (!r.isAvailable) throw 0; await nb.verifyIdentity({ reason: tr('Turn on fingerprint unlock'), title: tr('Unlock PocketKit') }); patchLock({ bio: true }); }
  catch (x) { e.target.checked = false; toast(tr('Fingerprint is not available')); }
};

/* Tour and what's new */
const TOUR = [
  ['🔎', 'Find any tool', 'Search, filter by what a tool needs, or tap Surprise me. Everything works without internet.'],
  ['📌', 'Make it yours', 'Press and hold a tool to pin it. Collections (Pro) group tools your way, like Travel or Study.'],
  ['🔒', 'Private by design', 'Your data stays on your phone. No ads and no accounts. Everyday tools are free; Pro unlocks the extras.']
];
let tourStep = 0;
function renderTour() {
  const [ic, ti, tx] = TOUR[tourStep];
  $('#tourArt').textContent = ic; $('#tourTitle').textContent = tr(ti); $('#tourText').textContent = tr(tx);
  $('#tourDots').innerHTML = TOUR.map((_, i) => `<i class="${i === tourStep ? 'on' : ''}"></i>`).join('');
  $('#tourNext').textContent = tr(tourStep === TOUR.length - 1 ? 'Start' : 'Next');
}
function openTour() { tourStep = 0; renderTour(); $('#tourDlg').showModal(); }
$('#tourNext').onclick = () => { if (tourStep < TOUR.length - 1) { tourStep++; renderTour(); } else $('#tourDlg').close(); };
$('#tourSkip').onclick = () => $('#tourDlg').close();
$('#tourBtn').onclick = () => openTour();
$('#newsClose').onclick = () => $('#newsDlg').close();

/* Languages: only packs that have translations are offered. */
function langOptions() {
  const codes = ['en', ...Object.keys(I18N.packs).filter(c => Object.keys(I18N.packs[c].ui).length || Object.keys(I18N.packs[c].tools).length)];
  $('#langSel').innerHTML = codes.map(c => `<option value="${c}">${esc(I18N.names[c] || c)}</option>`).join('');
  $('#langSel').value = codes.includes(I18N.lang) ? I18N.lang : 'en';
  $('#langSel').closest('label').hidden = codes.length < 2;
}
$('#langSel').onchange = e => {
  setLang(e.target.value); renderChips(); renderHome(); renderProState(); renderAccents(); $('#about').textContent = tr('PocketKit {v} · Everything stays on your phone').replace('{v}', APP_VERSION);
  if (view === 'tool' && curTool) { $('#toolTitle').textContent = toolName(curTool); $('#toolDesc').textContent = toolDesc(curTool); }
};

/* Settings */
$('#themeSel').value = Store.get('theme', 'auto');
$('#themeSel').onchange = e => { Store.set('theme', e.target.value); applyTheme(); };
$('#hapticsChk').checked = Store.get('haptics', true);
$('#hapticsChk').onchange = e => Store.set('haptics', e.target.checked);
$('#clearRecent').onclick = () => { Store.set('recent', []); toast(tr('Cleared')); };
$('#clearPins').onclick = () => { Store.set('pins', []); toast(tr('Cleared')); };
$('#about').textContent = tr('PocketKit {v} · Everything stays on your phone').replace('{v}', APP_VERSION);

/* Capacitor's hardware back button: close an open sheet first, then leave a screen, then exit. Locked: do nothing. */
const CapApp = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App;
if (CapApp) CapApp.addListener('backButton', () => {
  if (locked) return;
  const d = $$('dialog[open]')[0];
  if (d) { d.close(); return; }
  if (view !== 'home') history.back(); else CapApp.exitApp();
});

setLang(I18N.lang in I18N.packs || I18N.lang === 'en' ? I18N.lang : 'en');
langOptions(); renderLockSettings();
applyAccent(); renderAccents(); renderProState(); renderChips();
renderHome();
if (lockCfg()) lockNow();
const seen = Store.get('seenVersion', null);
if (!Store.get('welcomed', false)) { Store.set('welcomed', true); Store.set('seenVersion', APP_VERSION); if (!locked) setTimeout(openTour, 500); }
else if (seen !== APP_VERSION) {
  Store.set('seenVersion', APP_VERSION);
  const lines = WHATS_NEW[APP_VERSION];
  if (lines && !locked) { $('#newsList').innerHTML = lines.map(l => `<li><span class="fi" aria-hidden="true">✨</span><span>${esc(tr(l))}</span></li>`).join(''); setTimeout(() => $('#newsDlg').showModal(), 500); }
}
