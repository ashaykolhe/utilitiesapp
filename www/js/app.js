'use strict';
/* Home (pinned, recent, collapsible categories), search, tool screen, settings, theme, Android back button. */
const APP_VERSION = '0.1.0';
let activeCleanup = null, view = 'home';

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

/* Home */
function tileHTML(t, extra) {
  const c = catOf(t.cat);
  const lock = t.pro && !isPro() ? '<span class="lock" aria-label="Pro">🔒</span>' : '';
  return `<button class="tile${extra || ''}" data-id="${t.id}" style="--c:${c.color}"><span class="ic">${t.icon}</span>${lock}<span class="nm">${esc(t.name)}</span></button>`;
}
function wireTiles(root) {
  $$('.tile', root).forEach(b => {
    let timer = null, long = false;
    b.onclick = () => { if (long) { long = false; return; } openTool(b.dataset.id); };
    b.onpointerdown = () => { long = false; timer = setTimeout(() => { long = true; const on = togglePin(b.dataset.id); toast(on ? 'Pinned' : 'Unpinned'); if (navigator.vibrate) navigator.vibrate(20); renderHome(); }, 550); };
    b.onpointerup = b.onpointerleave = b.onpointercancel = () => clearTimeout(timer);
    b.oncontextmenu = e => e.preventDefault();
  });
}
function section(title, tools, opts = {}) {
  if (!tools.length) return '';
  const closed = opts.key && Store.get('closed', []).includes(opts.key);
  return `<section class="sec${closed ? ' closed' : ''}" ${opts.key ? `data-key="${opts.key}"` : ''}>
    <header class="sec-h" ${opts.key ? 'role="button" tabindex="0"' : ''}><span class="sec-i" style="--c:${opts.color || 'var(--accent)'}">${opts.icon || ''}</span><h2>${esc(title)}</h2><span class="muted">${tools.length}</span>${opts.key ? '<span class="chev" aria-hidden="true">▾</span>' : ''}</header>
    <div class="grid">${tools.map(t => tileHTML(t)).join('')}</div></section>`;
}
function renderHome() {
  const q = $('#search').value.trim().toLowerCase(), el = $('#sections');
  $('#count').textContent = Tools.list.length + ' tools, all on your phone';
  if (q) {
    const found = Tools.list.filter(t => Tools.matches(t, q));
    el.innerHTML = found.length ? `<div class="grid flat-grid">${found.map(t => tileHTML(t)).join('')}</div>` : '<p class="muted center pad">No tool matches that.</p>';
  } else {
    el.innerHTML = section('Pinned', Prefs.pins().map(Tools.get), { icon: '📌', color: '#f59e0b' }) +
      section('Recent', Prefs.recent().map(Tools.get).slice(0, 4), { icon: '🕘', color: '#64748b' }) +
      CATS.map(c => section(c.name, Tools.list.filter(t => t.cat === c.id), { icon: c.icon, color: c.color, key: c.id })).join('') +
      (Prefs.pins().length ? '' : '<p class="muted center pad">Tip: press and hold a tool to pin it to the top.</p>');
    $$('.sec-h[data-key], .sec[data-key] > .sec-h', el).forEach(hd => {
      const sec = hd.parentElement; if (!sec.dataset.key) return;
      const flip = () => { const k = sec.dataset.key, c = Store.get('closed', []), i = c.indexOf(k); if (i >= 0) c.splice(i, 1); else c.push(k); Store.set('closed', c); sec.classList.toggle('closed'); };
      hd.onclick = flip; hd.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } };
    });
  }
  wireTiles(el);
}
$('#search').oninput = renderHome;

/* Voice search where the WebView supports it */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SR) {
  $('#mic').hidden = false;
  $('#mic').onclick = () => {
    const r = new SR(); r.lang = navigator.language;
    r.onresult = e => { $('#search').value = e.results[0][0].transcript; renderHome(); };
    r.onerror = () => toast('Could not hear you'); r.start();
  };
}

/* Pins: free users can pin a few tools, Pro unlocks the rest. Returns true when the tool is now pinned. */
function togglePin(id) {
  if (!Prefs.isPinned(id) && Prefs.pins().length >= proLimit('pins') && needPro('pins')) return false;
  return Prefs.togglePin(id);
}

/* Screens */
function show(name) {
  view = name;
  ['home', 'tool', 'settings'].forEach(s => { $('#' + s).hidden = s !== name; });
  window.scrollTo(0, 0);
}
function refreshPin(id) { $('#pinBtn').textContent = Prefs.isPinned(id) ? '★' : '☆'; }
function openTool(id) {
  const t = Tools.get(id); if (!t) return;
  if (t.pro && needPro(t.proKey || 'connect')) return;
  Prefs.touch(id);
  $('#toolTitle').textContent = t.name; $('#toolDesc').textContent = t.desc || '';
  $('#pinBtn').dataset.id = id; refreshPin(id);
  const body = $('#toolBody'); body.innerHTML = '';
  show('tool'); history.pushState({ v: 'tool' }, '');
  try { activeCleanup = t.render(body) || null; } catch (e) { body.textContent = 'This tool could not start: ' + e.message; }
}
function leaveTool() {
  if (activeCleanup) { try { activeCleanup(); } catch (e) {} activeCleanup = null; }
  $('#toolBody').innerHTML = '';
}
function goHome() { if (view === 'tool') leaveTool(); show('home'); renderHome(); }
$('#pinBtn').onclick = () => { const on = togglePin($('#pinBtn').dataset.id); refreshPin($('#pinBtn').dataset.id); toast(on ? 'Pinned to Home' : 'Unpinned'); };
$('#backBtn').onclick = () => history.back();
$('#setBack').onclick = () => history.back();
$('#settingsBtn').onclick = () => { show('settings'); history.pushState({ v: 'settings' }, ''); };
addEventListener('popstate', () => { if (view !== 'home') goHome(); });

/* Colour themes: the first two are free */
const ACCENTS = [['#7c5cff', 'Violet', 0], ['#2563eb', 'Ocean', 0], ['#16a34a', 'Forest', 1], ['#f97316', 'Sunset', 1], ['#e11d74', 'Rose', 1], ['#0891b2', 'Teal', 1]];
function applyAccent() {
  let a = Store.get('accent', ACCENTS[0][0]);
  const d = ACCENTS.find(x => x[0] === a);
  if (!d || (d[2] && !isPro())) a = ACCENTS[0][0];
  document.documentElement.style.setProperty('--accent', a);
}
function renderAccents() {
  const cur = Store.get('accent', ACCENTS[0][0]);
  $('#accents').innerHTML = ACCENTS.map(([c, n, p]) => `<button class="sw${c === cur ? ' on' : ''}" data-c="${c}" data-p="${p}" style="background:${c}" aria-label="${n}">${p && !isPro() ? '<span class="lk">🔒</span>' : ''}</button>`).join('');
  $('.sw', $('#accents')).forEach(b => b.onclick = () => {
    if (+b.dataset.p && needPro('accents')) return;
    Store.set('accent', b.dataset.c); applyAccent(); renderAccents();
  });
}
function renderProState() { $('#proState').textContent = isPro() ? (onTrial() ? 'Trial until ' + fmtUntil(coupon.expiresAt) : 'Unlocked') : 'Free'; }

/* Pro sheet */
function setProStatus(text, kind) { const el = $('#proStatus'); el.hidden = !text; el.textContent = text || ''; el.className = 'status' + (kind === 'info' ? ' info' : ''); }
function renderPro() {
  $('#proSub').innerHTML = onTrial() ? esc('You have Pro until ' + fmtUntil(coupon.expiresAt) + '. Buy once to keep it after that.')
    : isPro() ? esc("You're all set. Thank you for supporting PocketKit!")
    : esc('One-time payment. No subscription, yours forever.') + (proPrice ? ' <b>' + esc(proPrice) + '</b>' : '');
  $('#proFeat').innerHTML = PRO_FEATURES.map(f => `<li class="${f.k === proFocus ? 'hl' : ''}"><span class="fi">${f.i}</span><span>${esc(f.t)}${f.s ? '<small>' + esc(f.s) + '</small>' : ''}</span>${isPro() ? '<span class="ck">✓</span>' : ''}</li>`).join('');
  $('#proBuy').hidden = $('#proRestore').hidden = pro || devPro;
  $('#proCoupon').hidden = isPro();
  $('#proClose').textContent = isPro() ? 'Done' : 'Not now';
  $('#proBuy').textContent = 'Unlock Pro' + (proPrice ? ' · ' + proPrice : '');
}
function openPro(focus) { proFocus = focus || null; setProStatus(null); renderPro(); loadPrice(); const d = $('#proDlg'); if (!d.open) d.showModal(); }
function proChanged() { applyAccent(); if ($('#proDlg').open) renderPro(); renderProState(); renderAccents(); if (view === 'home') renderHome(); }
$('#proOpen').onclick = () => openPro();
$('#proClose').onclick = () => $('#proDlg').close();
$('#proBuy').onclick = async () => { setProStatus(null); const r = await buyPro(); if (r.ok) { renderPro(); proChanged(); toast('PocketKit Pro unlocked 🎉'); } else if (r.msg) setProStatus(r.msg); };
$('#proRestore').onclick = async () => { const r = await restorePro(); renderPro(); proChanged(); setProStatus(r.ok ? null : r.msg, 'info'); };
$('#proRedeem').onclick = async () => {
  const r = await redeemCoupon($('#proCode').value);
  const msgs = { invalid: "That code isn't valid.", expired: 'That code has expired.', 'not-yet': "That code isn't active yet.", 'already-pro': 'You already have Pro.', error: 'Could not check the code. Try again.' };
  if (!r.ok) { setProStatus(msgs[r.reason] || msgs.error); return; }
  $('#proCode').value = ''; proChanged(); toast('Trial unlocked 🎉');
};

/* Settings */
$('#themeSel').value = Store.get('theme', 'auto');
$('#themeSel').onchange = e => { Store.set('theme', e.target.value); applyTheme(); };
$('#clearRecent').onclick = () => { Store.set('recent', []); toast('Cleared'); };
$('#clearPins').onclick = () => { Store.set('pins', []); toast('Cleared'); };
$('#about').textContent = 'PocketKit ' + APP_VERSION + ' · Everything stays on your phone';

/* Capacitor's hardware back button: leave a screen first, then exit. */
const CapApp = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App;
if (CapApp) CapApp.addListener('backButton', () => { if (view !== 'home') history.back(); else CapApp.exitApp(); });

applyAccent(); renderAccents(); renderProState();
renderHome();
