'use strict';
/* Daily and navigation tools. Everything lives inside one function scope so helper names never clash with other tool files. */
(function () {

/*PURE-START*/
/* ---------- pure logic (tested in Node) ---------- */
const OLC_DIGITS = '23456789CFGHJMPQRVWX';
/* Open Location Code, 10 digit (about 14 m) form, e.g. 8FVC9G8F+6W */
function plusCode(lat, lon) {
  lat = Math.min(90, Math.max(-90, lat));
  lon = ((lon + 180) % 360 + 360) % 360 - 180;
  let la = Math.floor(Math.round((lat + 90) * 8000 * 1e6) / 1e6), lo = Math.floor(Math.round((lon + 180) * 8000 * 1e6) / 1e6);
  la = Math.min(la, 180 * 8000 - 1);
  let code = '';
  for (let i = 0; i < 5; i++) {
    code = OLC_DIGITS[lo % 20] + code; code = OLC_DIGITS[la % 20] + code;
    la = Math.floor(la / 20); lo = Math.floor(lo / 20);
  }
  return code.slice(0, 8) + '+' + code.slice(8);
}

const RAD = Math.PI / 180;
function hav(a, b) {
  const dLa = (b.lat - a.lat) * RAD, dLo = (b.lon - a.lon) * RAD;
  const x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLo / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(x)));
}
function bearing(a, b) {
  const dLo = (b.lon - a.lon) * RAD, la1 = a.lat * RAD, la2 = b.lat * RAD;
  const y = Math.sin(dLo) * Math.cos(la2), x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLo);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}
const DIRS8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const compassName = (b) => DIRS8[Math.round(b / 45) % 8];
function fmtDist(m) { return m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(m < 10000 ? 2 : 1) + ' km'; }
function fmtDur(ms) {
  const s = Math.max(0, Math.floor(ms / 1000)), hh = Math.floor(s / 3600), mm = Math.floor(s % 3600 / 60), ss = s % 60;
  const p = (n) => String(n).padStart(2, '0');
  return (hh ? hh + ':' + p(mm) : mm) + ':' + p(ss);
}
function escXml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c])); }
function buildGpx(r) {
  const pts = r.pts.map(p => `<trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}"><time>${new Date(p.t).toISOString()}</time></trkpt>`).join('');
  return '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="PocketKit" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>' + escXml(r.name) + '</name><trkseg>' + pts + '</trkseg></trk></gpx>\n';
}

/* NOAA solar position. Returns UTC Dates for sunrise, solar noon and sunset on the given calendar day. */
function sunPos(jd) {
  const T = (jd - 2451545) / 36525;
  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const Mr = M * RAD;
  const C = Math.sin(Mr) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * Mr) * (0.019993 - 0.000101 * T) + Math.sin(3 * Mr) * 0.000289;
  const om = 125.04 - 1934.136 * T;
  const lam = L0 + C - 0.00569 - 0.00478 * Math.sin(om * RAD);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(om * RAD);
  const decl = Math.asin(Math.sin(eps * RAD) * Math.sin(lam * RAD));
  const y = Math.tan(eps * RAD / 2) ** 2, L0r = L0 * RAD;
  const eqt = 4 / RAD * (y * Math.sin(2 * L0r) - 2 * e * Math.sin(Mr) + 4 * e * y * Math.sin(Mr) * Math.cos(2 * L0r) - 0.5 * y * y * Math.sin(4 * L0r) - 1.25 * e * e * Math.sin(2 * Mr));
  return { decl, eqt };
}
function sunTimes(y, m, d, lat, lon, zenith) {
  zenith = zenith || 90.833;
  const base = Date.UTC(y, m - 1, d);
  let noonMin = 720 - 4 * lon;
  let sp = sunPos((base + noonMin * 60000) / 86400000 + 2440587.5);
  noonMin = 720 - 4 * lon - sp.eqt;
  sp = sunPos((base + noonMin * 60000) / 86400000 + 2440587.5);
  noonMin = 720 - 4 * lon - sp.eqt;
  const cosH = Math.cos(zenith * RAD) / (Math.cos(lat * RAD) * Math.cos(sp.decl)) - Math.tan(lat * RAD) * Math.tan(sp.decl);
  const at = (min) => new Date(base + min * 60000);
  const res = { noon: at(noonMin), rise: null, set: null, polar: null };
  if (cosH > 1) { res.polar = 'night'; return res; }
  if (cosH < -1) { res.polar = 'day'; return res; }
  const ha = Math.acos(cosH) / RAD;
  res.rise = at(noonMin - 4 * ha); res.set = at(noonMin + 4 * ha);
  return res;
}

/* Moon phase from the mean synodic month (accurate to about half a day). */
const SYNODIC = 29.530588853, MOON_REF = Date.UTC(2000, 0, 6, 18, 14);
function moonAge(d) { let a = ((d.getTime() - MOON_REF) / 86400000) % SYNODIC; if (a < 0) a += SYNODIC; return a; }
const MOON_NAMES = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
const MOON_ICONS = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
function moonInfo(d) {
  const age = moonAge(d), frac = age / SYNODIC, i = Math.round(frac * 8) % 8;
  return { age, frac, illum: (1 - Math.cos(2 * Math.PI * frac)) / 2, idx: i, name: MOON_NAMES[i], icon: MOON_ICONS[i] };
}
function nextPhase(d, target) {
  const delta = (((target * SYNODIC - moonAge(d)) % SYNODIC) + SYNODIC) % SYNODIC;
  return new Date(d.getTime() + delta * 86400000);
}

/* Dates */
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
}
const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
/* 29 Feb is celebrated on 28 Feb in years that are not leap years (a plain Date would roll over to 1 March). */
function bdayDate(y, month, day) { if (month === 2 && day === 29 && !isLeap(y)) day = 28; return new Date(y, month - 1, day); }
function daysUntil(month, day, from) {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let t = bdayDate(today.getFullYear(), month, day);
  if (t < today) t = bdayDate(today.getFullYear() + 1, month, day);
  return { days: Math.round((t - today) / 86400000), date: t };
}
function dayOfYear(d) { return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(d.getFullYear(), 0, 0)) / 86400000); }

/* Time zones */
function tzOffsetMin(tz, date) {
  const p = {};
  new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
    .formatToParts(date).forEach(x => { p[x.type] = x.value; });
  const u = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return Math.round((u - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}
function offLabel(min) {
  const s = min < 0 ? '-' : '+', a = Math.abs(min), hh = Math.floor(a / 60), mm = a % 60;
  return 'UTC' + s + hh + (mm ? ':' + String(mm).padStart(2, '0') : '');
}
function diffLabel(min) {
  if (!min) return 'Same time as you';
  const a = Math.abs(min), hh = Math.floor(a / 60), mm = a % 60;
  return (hh ? hh + 'h ' : '') + (mm ? mm + 'm ' : '') + (min > 0 ? 'ahead' : 'behind');
}
const CITIES = [
  ['London', 'Europe/London'], ['Dublin', 'Europe/Dublin'], ['Lisbon', 'Europe/Lisbon'], ['Paris', 'Europe/Paris'], ['Berlin', 'Europe/Berlin'],
  ['Madrid', 'Europe/Madrid'], ['Rome', 'Europe/Rome'], ['Amsterdam', 'Europe/Amsterdam'], ['Zurich', 'Europe/Zurich'], ['Stockholm', 'Europe/Stockholm'],
  ['Athens', 'Europe/Athens'], ['Helsinki', 'Europe/Helsinki'], ['Istanbul', 'Europe/Istanbul'], ['Moscow', 'Europe/Moscow'], ['Kyiv', 'Europe/Kiev'],
  ['Reykjavik', 'Atlantic/Reykjavik'], ['Cairo', 'Africa/Cairo'], ['Lagos', 'Africa/Lagos'], ['Nairobi', 'Africa/Nairobi'], ['Johannesburg', 'Africa/Johannesburg'],
  ['Casablanca', 'Africa/Casablanca'], ['Accra', 'Africa/Accra'], ['Jerusalem', 'Asia/Jerusalem'], ['Baghdad', 'Asia/Baghdad'], ['Riyadh', 'Asia/Riyadh'],
  ['Dubai', 'Asia/Dubai'], ['Tehran', 'Asia/Tehran'], ['Kabul', 'Asia/Kabul'], ['Karachi', 'Asia/Karachi'], ['Tashkent', 'Asia/Tashkent'],
  ['Mumbai / Delhi', 'Asia/Kolkata'], ['Colombo', 'Asia/Colombo'], ['Kathmandu', 'Asia/Kathmandu'], ['Dhaka', 'Asia/Dhaka'], ['Almaty', 'Asia/Almaty'],
  ['Yangon', 'Asia/Yangon'], ['Bangkok', 'Asia/Bangkok'], ['Ho Chi Minh City', 'Asia/Ho_Chi_Minh'], ['Jakarta', 'Asia/Jakarta'], ['Singapore', 'Asia/Singapore'],
  ['Kuala Lumpur', 'Asia/Kuala_Lumpur'], ['Hong Kong', 'Asia/Hong_Kong'], ['Shanghai / Beijing', 'Asia/Shanghai'], ['Taipei', 'Asia/Taipei'], ['Manila', 'Asia/Manila'],
  ['Seoul', 'Asia/Seoul'], ['Tokyo', 'Asia/Tokyo'], ['Perth', 'Australia/Perth'], ['Adelaide', 'Australia/Adelaide'], ['Brisbane', 'Australia/Brisbane'],
  ['Sydney / Melbourne', 'Australia/Sydney'], ['Auckland', 'Pacific/Auckland'], ['Fiji', 'Pacific/Fiji'], ['Honolulu', 'Pacific/Honolulu'], ['Anchorage', 'America/Anchorage'],
  ['Los Angeles', 'America/Los_Angeles'], ['Vancouver', 'America/Vancouver'], ['Denver', 'America/Denver'], ['Phoenix', 'America/Phoenix'], ['Chicago', 'America/Chicago'],
  ['Mexico City', 'America/Mexico_City'], ['New York', 'America/New_York'], ['Toronto', 'America/Toronto'], ['Halifax', 'America/Halifax'], ['Havana', 'America/Havana'],
  ['Bogota', 'America/Bogota'], ['Lima', 'America/Lima'], ['Caracas', 'America/Caracas'], ['Santiago', 'America/Santiago'], ['Buenos Aires', 'America/Argentina/Buenos_Aires'],
  ['Sao Paulo', 'America/Sao_Paulo'], ['UTC', 'UTC']
];

/* Alarms: weekdays are 0 (Sunday) to 6 (Saturday); an empty list means "once". */
function nextAlarm(a, now) {
  for (let k = 0; k < 8; k++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + k, a.h, a.m, 0, 0);
    if (d.getTime() > now.getTime() && (!a.days.length || a.days.includes(d.getDay()))) return d;
  }
  return null;
}

/* Morse / flashing patterns as [on, milliseconds] steps. */
const MORSE = { A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..', 0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.' };
function morseTimeline(text, unit) {
  const out = [];
  const words = String(text).toUpperCase().split(/\s+/).filter(Boolean);
  words.forEach((w, wi) => {
    const letters = [...w].filter(c => MORSE[c]);
    letters.forEach((c, li) => {
      [...MORSE[c]].forEach((s, si) => {
        out.push([true, (s === '.' ? 1 : 3) * unit]);
        if (si < MORSE[c].length - 1) out.push([false, unit]);
      });
      if (li < letters.length - 1) out.push([false, 3 * unit]);
    });
    if (wi < words.length - 1) out.push([false, 7 * unit]);
  });
  return out;
}

/* Typing speed */
function typingStats(target, typed, ms) {
  let ok = 0;
  for (let i = 0; i < typed.length; i++) if (typed[i] === target[i]) ok++;
  const min = Math.max(ms, 1000) / 60000;
  return { wpm: Math.round(ok / 5 / min), acc: typed.length ? Math.round(ok / typed.length * 100) : 100 };
}
/*PURE-END*/

/* ---------- shared helpers ---------- */
const P = () => (window.Capacitor && Capacitor.Plugins) || {};
const LN = () => P().LocalNotifications;
const GRAD = 'background:linear-gradient(150deg,color-mix(in srgb,var(--accent) 22%,var(--surface)),var(--surface) 75%)';
const H2 = 'font-weight:700;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:8px 4px 0';
const sub = (t) => `<div class="muted" style="font-size:13px;margin:0 4px;line-height:1.45">${t}</div>`;
const note = (t) => `<div class="card" style="font-size:13px;line-height:1.5;color:var(--muted)">${t}</div>`;
const empty = (icon, t) => `<div class="center muted" style="padding:26px 10px"><div style="font-size:40px;margin-bottom:6px">${icon}</div>${t}</div>`;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dayKey = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

/*EXPORT-START*/
/* ---------- export builders (pure, tested in Node) ---------- */
// A text cell that starts with = + - @ (or a tab / CR) would run as a formula in a spreadsheet, so it gets a leading quote.
const csvText = (v) => { v = v == null ? '' : String(v); return /^[=+\-@\t\r]/.test(v) ? "'" + v : v; };
const oneLine = (s) => String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').trim();
const expenseRows = (list) => [['Date', 'Category', 'Amount', 'Note']].concat(list.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)) || (a.at || 0) - (b.at || 0))
  .map((e) => [e.date, csvText(e.cat), Number.isFinite(+e.amt) ? (+e.amt).toFixed(2) : '', csvText(e.note)]));
const todoText = (items, date) => {
  const open = items.filter((t) => !t.done), done = items.filter((t) => t.done);
  const line = (t) => (t.done ? '[x] ' : '[ ] ') + oneLine(t.text) + (t.cat || t.due ? ' (' + [oneLine(t.cat), t.due ? 'due ' + t.due : ''].filter(Boolean).join(', ') + ')' : '');
  return 'To-do list, ' + date + '\n' + open.length + ' open, ' + done.length + ' done\n\n' + open.concat(done).map(line).join('\n');
};
const shopText = (items, date) => {
  const line = (i) => (i.done ? '[x] ' : '[ ] ') + i.q + ' x ' + oneLine(i.n);
  return 'Shopping list, ' + date + '\n' + items.filter((i) => !i.done).length + ' to buy, ' + items.filter((i) => i.done).length + ' in the basket\n\n' + items.filter((i) => !i.done).concat(items.filter((i) => i.done)).map(line).join('\n');
};
/* Hand a CSV (or other text file) to the share sheet / a download and say so. */
async function sendFile(name, text, mime, what) {
  if (text.length > 2e6) { toast('Too much data to export (over 2 MB)'); return false; }
  const ok = await saveTextFile(name, text, mime);
  if (ok) toast((what || 'Exported') + ': ' + name);
  return ok;
}
/*EXPORT-END*/

/* Pill buttons that behave like a segmented control. */
function segHtml(items, cur, o) {
  o = o || {};
  return `<div class="row" data-seg style="${o.row || 'gap:6px'}">` + items.map(([k, l]) => `<button class="btn ${k === cur ? '' : 'alt'}" data-k="${k}" aria-pressed="${k === cur}" style="${o.btn || 'padding:10px 4px;font-size:14px'}">${l}</button>`).join('') + '</div>';
}
function bindSeg(root, onPick) {
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-k]'); if (!b || !root.contains(b)) return;
    $$('button[data-k]', root).forEach(x => { x.classList.toggle('alt', x !== b); x.setAttribute('aria-pressed', String(x === b)); });
    onPick(b.dataset.k);
  });
}

/* Notification ids: every tool owns a block so they can never overwrite each other.
   timer 710001 (timer.js) | parking 730001-2 | pomodoro 740001 | alarms 10,000,000+ (old alarms keep 750000+n*10+k)
   quick timers 20,000,000+ (old: 760000+) | birthdays 30,000,000+ (old: 770000+) | reminders 100,000,000+ (reminders.js). */
const NOTE_BLOCK = { alarm: 10000000, qt: 20000000, bday: 30000000 };
const noteId = (kind, n) => NOTE_BLOCK[kind] + (n % 900000) * 10;
/* Resolves true only when Android really accepted the notification; false when blocked or failed or there is no plugin. */
async function notifySchedule(id, title, body, schedule) {
  const ln = LN(); if (!ln) return false;
  try {
    const p = await ln.requestPermissions();
    if (p.display !== 'granted') return false;
    await ln.schedule({ notifications: [{ id, title, body, schedule: Object.assign({ allowWhileIdle: true }, schedule) }] });
    return true;
  } catch (e) { return false; }
}
const notifyAt = (id, title, body, at) => notifySchedule(id, title, body, { at: new Date(at) });
/* The alert can only be trusted when this is true; a browser (no plugin) still alerts while the page is open, so it is not "blocked". */
const alertsOk = (ok) => ok || !LN();
const BLOCKED_TXT = 'Notifications are blocked: the alert only sounds while PocketKit is open. Allow them in Android settings.';
const blockedHtml = () => `<div class="card nblocked" hidden role="status" style="font-size:13px;line-height:1.5;color:var(--danger);border-color:var(--danger)">${BLOCKED_TXT}</div>`;
function setBlocked(root, on) { const n = $('.nblocked', root); if (n) n.hidden = !on; }
/* Shows the persistent line when notifications were already denied before the user did anything. */
async function notesDenied() {
  const ln = LN(); if (!ln || !ln.checkPermissions) return false;
  try { return (await ln.checkPermissions()).display === 'denied'; } catch (e) { return false; }
}
const probeBlocked = (root) => notesDenied().then(d => { if (d) setBlocked(root, true); });
/* Gives a tool its own child root so listeners never sit on the shared container. */
function rootOf(el) {
  const r = document.createElement('div'); r.style.cssText = 'display:flex;flex-direction:column;gap:12px';
  while (el.firstChild) r.appendChild(el.firstChild);
  el.appendChild(r); return r;
}
async function cancelNotes(ids) { const ln = LN(); if (ln) try { await ln.cancel({ notifications: ids.map(id => ({ id })) }); } catch (e) {} }
function askWebNote() { if (!LN() && window.Notification && Notification.permission === 'default') try { Notification.requestPermission(); } catch (e) {} }
function webNote(title, body) { try { if (!LN() && window.Notification && Notification.permission === 'granted') new Notification(title, { body }); } catch (e) {} }
const notesLine = () => LN() ? 'Notifications are scheduled with Android, so they still arrive when the app is closed. They can be a few minutes late when the phone is idle or battery saver is on.' : 'This browser cannot schedule notifications while closed, so alerts only fire while PocketKit is open.';

function keepAwake() {
  let lock = null, want = false, pending = false;
  const free = () => { const l = lock; lock = null; if (l) l.release().catch(() => {}); };
  const get = async () => {
    if (!want || document.hidden || !navigator.wakeLock || pending) return;
    pending = true;
    try {
      const l = await navigator.wakeLock.request('screen');
      /* off() or dispose() may have run while the request was pending: then the new lock must not survive. */
      if (!want) l.release().catch(() => {}); else { free(); lock = l; }
    } catch (e) { /* denied or unsupported */ }
    pending = false;
  };
  const vis = () => { if (!document.hidden) get(); };
  document.addEventListener('visibilitychange', vis);
  return {
    supported: !!navigator.wakeLock,
    on() { want = true; get(); },
    off() { want = false; free(); },
    dispose() { this.off(); document.removeEventListener('visibilitychange', vis); }
  };
}

function watchGps(onPos, onErr) {
  if (!navigator.geolocation) { if (onErr) onErr({ code: 0 }); return () => {}; }
  const id = navigator.geolocation.watchPosition(
    p => onPos({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, alt: p.coords.altitude, spd: p.coords.speed, t: p.timestamp || Date.now() }),
    e => { if (onErr) onErr(e); }, { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
  return () => navigator.geolocation.clearWatch(id);
}
const gpsMsg = (e) => e.code === 1 ? 'Location permission was denied. Allow it in Android settings to use this tool.' : e.code === 0 ? 'This device has no location support.' : 'Waiting for a GPS fix. Go outdoors or near a window.';

/* Compass heading of the phone, when the sensor exists. */
function watchHeading(cb) {
  const fn = (e) => {
    let hd = null;
    if (typeof e.webkitCompassHeading === 'number') hd = e.webkitCompassHeading;
    else if (e.alpha != null && (e.absolute || e.type === 'deviceorientationabsolute')) hd = (360 - e.alpha) % 360;
    if (hd != null) cb(hd);
  };
  window.addEventListener('deviceorientationabsolute', fn, true);
  return () => window.removeEventListener('deviceorientationabsolute', fn, true);
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('Copied'); return; } catch (e) {}
  try {
    const t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select();
    document.execCommand('copy'); t.remove(); toast('Copied');
  } catch (e) { toast('Could not copy'); }
}
async function shareText(title, text) {
  try {
    if (P().Share) { await P().Share.share({ title, text, dialogTitle: title }); return true; }
    if (navigator.share) { await navigator.share({ title, text }); return true; }
  } catch (e) { if (/cancel|abort/i.test(String(e && (e.message || e.name)))) return false; }
  copyText(text);
  return true;
}
async function saveFile(name, text, mime) {
  const pl = P();
  try {
    if (pl.Filesystem && pl.Share) {
      const w = await pl.Filesystem.writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' });
      await pl.Share.share({ title: name, url: w.uri, dialogTitle: 'Share ' + name }); return;
    }
  } catch (e) { if (/cancel|abort/i.test(String(e && e.message))) return; }
  try {
    const url = URL.createObjectURL(new Blob([text], { type: mime })), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000); toast('Saved ' + name);
  } catch (e) { toast('Could not save the file'); }
}

/* Small IndexedDB wrapper for saved routes. */
function idbOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('pk-daily', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('routes', { keyPath: 'id' });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function idbDo(mode, fn) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction('routes', mode), req = fn(tx.objectStore('routes'));
    tx.oncomplete = () => { db.close(); res(req ? req.result : undefined); }; tx.onerror = () => { db.close(); rej(tx.error); };
  });
}

/* Saves a route only if fewer than `limit` routes exist, checked inside the same readwrite transaction (so a double tap cannot slip two in). */
async function idbSaveLimited(rt, limit) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction('routes', 'readwrite'), st = tx.objectStore('routes');
    let full = false;
    const c = st.count();
    c.onsuccess = () => { if (c.result >= limit) full = true; else st.put(rt); };
    tx.oncomplete = () => { db.close(); res(!full); }; tx.onerror = () => { db.close(); rej(tx.error); }; tx.onabort = () => { db.close(); rej(tx.error); };
  });
}

/* Torch through the camera track (best effort). */
async function torchOpen() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const track = stream.getVideoTracks()[0];
    if (!(track.getCapabilities && track.getCapabilities().torch)) { stream.getTracks().forEach(t => t.stop()); return null; }
    return {
      set: (on) => track.applyConstraints({ advanced: [{ torch: !!on }] }).catch(() => {}),
      close: () => { try { track.applyConstraints({ advanced: [{ torch: false }] }).catch(() => {}); } catch (e) {} stream.getTracks().forEach(t => t.stop()); }
    };
  } catch (e) { return null; }
}

/* ---------- 1. Screen Light ---------- */
Tools.register({ id: 'screenlight', name: 'Screen Light', icon: '💡', cat: 'daily', desc: 'Turn the whole screen into a coloured lamp with presets, a colour picker and a brightness slider.', keys: ['lamp', 'night light', 'colour', 'color', 'torch', 'mood'], needs: [], render(el) {
  const PRE = [['Warm lamp', '#ffb35c'], ['Candle', '#ff8a3d'], ['White', '#ffffff'], ['Cool', '#cfe6ff'], ['Night red', '#ff2a1f'], ['Green', '#3dff7a'], ['Blue', '#3d7bff'], ['Pink', '#ff5fb0']];
  const st = Object.assign({ color: '#ffb35c', bright: 100, awake: true }, Store.get('daily.light', {}));
  const wake = keepAwake();
  let ov = null;
  const sw = (id) => PRE.map(([n, c]) => `<button class="sw ${id}" data-c="${c}" aria-label="${n}" title="${n}" style="background:${c};width:44px;height:44px;border:3px solid ${c === st.color ? 'var(--text)' : 'var(--line)'}"></button>`).join('');
  el.innerHTML = `
    <div class="card" style="${GRAD};text-align:center;padding:18px 14px 20px">
      <div id="pv" style="height:150px;border-radius:20px;margin-bottom:12px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)"></div>
      <div id="nm" style="font-weight:700;font-size:18px"></div>
      <div class="muted" style="font-size:13px">Lights the room using your screen</div>
    </div>
    <div style="${H2}">Colour</div>
    <div class="card"><div class="swatches" id="sws" style="gap:12px;justify-content:center">${sw('')}</div>
      <label class="f" style="margin-top:14px">Custom colour<input id="pick" type="color" value="${st.color}" style="width:100%;height:46px;border:1px solid var(--line);border-radius:12px;background:var(--surface);padding:4px"></label></div>
    <div style="${H2}">Brightness</div>
    <div class="card"><input id="br" type="range" min="5" max="100" value="${st.bright}" style="width:100%" aria-label="Brightness">
      <div class="row" style="margin-top:6px"><span class="muted" style="font-size:13px">Dim</span><span id="brv" class="center" style="font-weight:700"></span><span class="muted" style="font-size:13px;text-align:right">Full</span></div></div>
    <label class="item" style="min-height:52px"><span class="grow">Keep the screen awake<br><small class="muted" id="wkn"></small></span><input type="checkbox" id="aw" style="width:22px;height:22px"></label>
    <button class="btn" id="go" style="padding:16px;font-size:17px">Full screen light</button>
    ${sub('Tip: turn the phone brightness up for the strongest light. In full screen, tap anywhere to hide or show the controls.')}`;
  $('#aw', el).checked = st.awake;
  $('#wkn', el).textContent = wake.supported ? 'Stops the display from sleeping while the light is on' : 'Not supported on this device';
  const nameOf = (c) => (PRE.find(p => p[1] === c) || [0, 0])[0] || 'Custom colour';
  const bg = () => st.color;
  function paint() {
    $('#pv', el).style.background = st.color; $('#pv', el).style.filter = `brightness(${st.bright / 100})`;
    $('#nm', el).textContent = nameOf(st.color); $('#brv', el).textContent = st.bright + '%';
    $$('.sw', el).forEach(b => { b.style.borderColor = b.dataset.c === st.color ? 'var(--text)' : 'var(--line)'; });
    $('#pick', el).value = st.color;
    if (ov) { $('.lay', ov).style.background = st.color; $('.lay', ov).style.filter = `brightness(${st.bright / 100})`; $('.obr', ov).value = st.bright; $$('.sw', ov).forEach(b => { b.style.borderColor = b.dataset.c === st.color ? '#fff' : 'rgba(255,255,255,.4)'; }); }
    Store.set('daily.light', st);
  }
  $('#sws', el).onclick = (e) => { const b = e.target.closest('.sw'); if (b) { st.color = b.dataset.c; paint(); } };
  $('#pick', el).oninput = (e) => { st.color = e.target.value; paint(); };
  $('#br', el).oninput = (e) => { st.bright = +e.target.value; paint(); };
  $('#aw', el).onchange = (e) => { st.awake = e.target.checked; if (ov) { st.awake ? wake.on() : wake.off(); } Store.set('daily.light', st); };
  function close() { if (ov) { ov.remove(); ov = null; } wake.off(); }
  $('#go', el).onclick = () => {
    ov = h(`<div style="position:fixed;inset:0;z-index:60;background:#000">
      <div class="lay" style="position:absolute;inset:0"></div>
      <div class="hint" style="position:absolute;top:calc(env(safe-area-inset-top) + 16px);left:0;right:0;text-align:center;color:#000;opacity:.45;font-size:13px;font-weight:600;mix-blend-mode:difference;color:#fff">Tap to show controls</div>
      <div class="pnl" style="position:absolute;left:0;right:0;bottom:0;padding:16px 16px calc(env(safe-area-inset-bottom) + 16px);background:var(--surface);border-radius:24px 24px 0 0;box-shadow:0 -10px 40px rgba(0,0,0,.35);display:flex;flex-direction:column;gap:14px">
        <div class="swatches" style="gap:10px;justify-content:center">${PRE.map(([n, c]) => `<button class="sw" data-c="${c}" aria-label="${n}" style="background:${c};width:38px;height:38px;border:3px solid rgba(255,255,255,.4)"></button>`).join('')}</div>
        <input class="obr" type="range" min="5" max="100" aria-label="Brightness" style="width:100%">
        <button class="btn alt cls">Close light</button></div></div>`);
    document.body.appendChild(ov);
    const pnl = $('.pnl', ov);
    $('.lay', ov).onclick = () => { pnl.hidden = !pnl.hidden; $('.hint', ov).hidden = !pnl.hidden; };
    $('.obr', ov).oninput = (e) => { st.bright = +e.target.value; $('#br', el).value = st.bright; paint(); };
    $$('.sw', ov).forEach(b => { b.onclick = () => { st.color = b.dataset.c; paint(); }; });
    $('.cls', ov).onclick = close;
    $('.hint', ov).hidden = true;
    if (st.awake) wake.on();
    paint();
  };
  paint();
  return () => { close(); wake.dispose(); };
} });

/* ---------- 2. Route Recorder ---------- */
Tools.register({ id: 'routerec', name: 'Route Recorder', icon: '🥾', cat: 'navigate', desc: 'Record a GPS track, watch it drawn live, and keep saved routes you can export as GPX.', keys: ['gps', 'track', 'gpx', 'hike', 'run', 'walk', 'cycle', 'trail'], needs: ['location', 'storage'], render(el) {
  el.innerHTML = `<div id="tabs">${segHtml([['rec', 'Record'], ['saved', 'Saved routes']], 'rec')}</div><div id="body" class="list" style="gap:12px"></div>`;
  const body = $('#body', el), wake = keepAwake();
  let alive = true, tab = 'rec', stopGps = null, tick = null, sel = null;
  const R = { pts: [], dist: 0, max: 0, start: 0, end: 0, running: false, msg: 'Press Start to begin recording.' };
  let awake = true;
  const draft = Store.get('daily.routedraft', null);
  if (draft && draft.pts && draft.pts.length > 1) {
    Object.assign(R, draft, { running: false, msg: 'An unsaved recording was recovered. Save or discard it.' });
    /* A draft written while recording has no end time yet: use the last point, otherwise the duration would be hugely negative. */
    if (!R.end) R.end = R.pts[R.pts.length - 1].t || R.start;
  }
  let saving = false;

  function drawRoute(cv, pts, live) {
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth || 340, Hh = cv.clientHeight || 280;
    cv.width = W * dpr; cv.height = Hh * dpr;
    const c = cv.getContext('2d'); c.scale(dpr, dpr);
    const cs = getComputedStyle(document.documentElement), accent = cs.getPropertyValue('--accent').trim() || '#7c5cff';
    c.fillStyle = cs.getPropertyValue('--surface2').trim() || '#eceefa'; c.fillRect(0, 0, W, Hh);
    c.strokeStyle = cs.getPropertyValue('--line').trim() || '#ddd'; c.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, Hh); c.stroke(); }
    for (let y = 0; y < Hh; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    if (!pts.length) { c.fillStyle = cs.getPropertyValue('--muted').trim() || '#888'; c.font = '14px system-ui'; c.textAlign = 'center'; c.fillText('Your route will appear here', W / 2, Hh / 2); return; }
    const la0 = pts.reduce((s, p) => s + p.lat, 0) / pts.length, k = Math.cos(la0 * RAD);
    const xs = pts.map(p => p.lon * k), ys = pts.map(p => p.lat);
    let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const span = Math.max(x1 - x0, y1 - y0, 0.0003), pd = 28, sc = (Math.min(W, Hh) - pd * 2) / span;
    const ox = (W - (x1 - x0) * sc) / 2, oy = (Hh - (y1 - y0) * sc) / 2;
    const X = (i) => ox + (xs[i] - x0) * sc, Y = (i) => Hh - (oy + (ys[i] - y0) * sc);
    c.lineJoin = c.lineCap = 'round'; c.strokeStyle = accent; c.lineWidth = 5; c.beginPath();
    pts.forEach((p, i) => i ? c.lineTo(X(i), Y(i)) : c.moveTo(X(i), Y(i))); c.stroke();
    const dot = (i, col) => { c.fillStyle = '#fff'; c.beginPath(); c.arc(X(i), Y(i), 9, 0, 7); c.fill(); c.fillStyle = col; c.beginPath(); c.arc(X(i), Y(i), 6, 0, 7); c.fill(); };
    dot(0, '#16a34a'); if (pts.length > 1) dot(pts.length - 1, live ? accent : '#e5484d');
  }
  const stats = (r) => {
    const dur = Math.max(0, (r.end || Date.now()) - r.start), avg = dur > 0 ? r.dist / (dur / 1000) * 3.6 : 0;
    return [[fmtDist(r.dist), 'Distance'], [fmtDur(dur), 'Duration'], [avg.toFixed(1) + ' km/h', 'Average speed'], [(r.max * 3.6).toFixed(1) + ' km/h', 'Max speed']];
  };
  const statGrid = (r) => `<div class="card" style="display:grid;grid-template-columns:1fr 1fr;gap:14px 8px;text-align:center">${stats(r).map(([v, l]) => `<div><div style="font-size:24px;font-weight:700;font-variant-numeric:tabular-nums">${v}</div><small class="muted">${l}</small></div>`).join('')}</div>`;

  function persistDraft() { if (R.pts.length > 1 && R.pts.length < 8000) Store.set('daily.routedraft', { pts: R.pts, dist: R.dist, max: R.max, start: R.start, end: R.end }); }
  function onPos(p) {
    if (!R.running) return;
    R.msg = '';
    if (p.acc > 40) { R.msg = 'Weak GPS signal (±' + Math.round(p.acc) + ' m). Points are skipped until it improves.'; refreshRec(); return; }
    const last = R.pts[R.pts.length - 1];
    if (last) {
      const d = hav(last, p); if (d < 3) { refreshRec(); return; }
      R.dist += d;
      const v = p.spd != null && p.spd >= 0 ? p.spd : d / Math.max(1, (p.t - last.t) / 1000);
      if (v < 70) R.max = Math.max(R.max, v);
    }
    if (R.pts.length >= 20000) { R.msg = 'Recording is full (20000 points). Stop and save it.'; refreshRec(); return; }
    R.pts.push({ lat: p.lat, lon: p.lon, t: p.t });
    if (R.pts.length % 10 === 0) persistDraft();
    refreshRec();
  }
  function startRec() {
    Object.assign(R, { pts: [], dist: 0, max: 0, start: Date.now(), end: 0, running: true, msg: 'Looking for a GPS fix...' });
    stopGps = watchGps(onPos, (e) => { R.msg = gpsMsg(e); refreshRec(); });
    tick = setInterval(() => { if (tab === 'rec') refreshRec(true); }, 1000);
    if (awake) wake.on();
    Store.set('daily.routedraft', null); drawRec();
  }
  function stopRec() {
    R.running = false; R.end = Date.now(); R.msg = '';
    if (stopGps) stopGps(); stopGps = null; clearInterval(tick); wake.off(); persistDraft(); drawRec();
  }
  function refreshRec(light) {
    if (!alive || tab !== 'rec') return;
    const sg = $('#sg', el); if (sg) sg.outerHTML = statGrid(R).replace('<div class="card"', '<div id="sg" class="card"');
    const m = $('#rmsg', el); if (m) m.textContent = R.msg;
    if (!light) { const cv = $('#cv', el); if (cv) drawRoute(cv, R.pts, R.running); }
  }
  function drawRec() {
    if (!alive) return;
    const finished = !R.running && R.pts.length > 1;
    body.innerHTML = `<canvas id="cv" style="height:290px;display:block" aria-label="Route map"></canvas>
      <div id="rmsg" class="muted center" style="font-size:13px;min-height:18px">${esc(R.msg)}</div>
      ${statGrid(R).replace('<div class="card"', '<div id="sg" class="card"')}
      ${R.running ? '<button class="btn danger" id="stp" style="padding:16px;font-size:17px">Stop recording</button>' :
        finished ? `<label class="f">Route name<input id="rn" type="text" maxlength="40" value="${esc('Route ' + new Date(R.start).toLocaleDateString([], { day: 'numeric', month: 'short' }) + ' ' + new Date(R.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}"></label>
          <div class="row"><button class="btn" id="sv">Save route</button><button class="btn alt" id="ds">Discard</button></div>
          <button class="btn alt" id="nw">Start a new recording</button>` :
        '<button class="btn" id="stt" style="padding:16px;font-size:17px">Start recording</button>'}
      <label class="item" style="min-height:52px"><span class="grow">Keep the screen awake</span><input type="checkbox" id="aw" ${awake ? 'checked' : ''} style="width:22px;height:22px"></label>
      ${note('<b>Foreground only.</b> Recording works while PocketKit is open and the screen is on. If Android puts the app to sleep or you switch away, the track pauses and gaps are drawn as straight lines. Keep the screen awake for the best result.')}`;
    drawRoute($('#cv', el), R.pts, R.running);
    const on = (id, f) => { const b = $(id, el); if (b) b.onclick = f; };
    on('#stt', startRec); on('#stp', stopRec);
    on('#nw', () => { Object.assign(R, { pts: [], dist: 0, max: 0, start: 0, end: 0, msg: 'Press Start to begin recording.' }); Store.set('daily.routedraft', null); startRec(); });
    on('#ds', () => { Object.assign(R, { pts: [], dist: 0, max: 0, start: 0, end: 0, msg: 'Press Start to begin recording.' }); Store.set('daily.routedraft', null); drawRec(); });
    on('#sv', async () => {
      if (saving) return;
      saving = true;
      try {
        const rt = { id: uid(), name: ($('#rn', el).value.trim() || 'Route').slice(0, 40), at: R.start, dur: Math.max(0, R.end - R.start), dist: R.dist, max: R.max, pts: R.pts };
        const saved = await idbSaveLimited(rt, proLimit('routes'));
        if (!saved) { needPro('routes'); return; }
        Store.set('daily.routedraft', null);
        Object.assign(R, { pts: [], dist: 0, max: 0, start: 0, end: 0, msg: 'Saved. Press Start for another recording.' });
        toast('Route saved'); if (alive) drawRec();
      } catch (e) { toast('Could not save the route'); }
      finally { saving = false; }
    });
    const aw = $('#aw', el); if (aw) aw.onchange = () => { awake = aw.checked; if (R.running) awake ? wake.on() : wake.off(); };
  }
  async function drawSaved() {
    let list = [];
    try { list = await idbDo('readonly', s => s.getAll()); } catch (e) { body.innerHTML = note('Saved routes are not available in this browser.'); return; }
    if (!alive || tab !== 'saved') return;
    list.sort((a, b) => b.at - a.at);
    if (sel && !list.find(r => r.id === sel)) sel = null;
    const free = !isPro();
    body.innerHTML = (list.length ? `<div class="list">${list.map(r => `<div class="item" style="gap:12px;padding:12px 14px;${r.id === sel ? 'border-color:var(--accent)' : ''}" data-open="${r.id}"><span style="font-size:24px">🥾</span><span class="grow"><b>${esc(r.name)}</b><br><small class="muted">${new Date(r.at).toLocaleDateString()} · ${fmtDist(r.dist)} · ${fmtDur(r.dur)}</small></span><span class="muted" style="font-size:20px">›</span></div>`).join('')}</div>` : empty('🗺️', 'No saved routes yet.<br>Record one and tap Save.'))
      + (free ? sub(`Free plan keeps ${proLimit('routes')} saved route. Pro keeps unlimited routes and unlocks GPX export.`) : '')
      + '<div id="det"></div>';
    $$('[data-open]', body).forEach(n => { n.onclick = () => { sel = n.dataset.open; drawSaved(); }; });
    const r = list.find(x => x.id === sel); if (!r) return;
    const det = $('#det', body);
    det.innerHTML = `<div class="card list" style="gap:12px"><b style="font-size:17px">${esc(r.name)}</b><canvas id="dcv" style="height:240px;display:block"></canvas>${statGrid({ dist: r.dist, start: 0, end: r.dur, max: r.max }).replace(/Duration/, 'Duration')}
      <div class="row"><button class="btn" id="gx">${free ? '🔒 ' : ''}Export GPX</button><button class="btn danger" id="dl">Delete</button></div></div>`;
    drawRoute($('#dcv', det), r.pts, false);
    $('#gx', det).onclick = () => { if (needPro('routes')) return; saveFile((r.name.replace(/[^\w\- ]+/g, '').trim() || 'route') + '.gpx', buildGpx(r), 'application/gpx+xml'); };
    $('#dl', det).onclick = async () => { if (!confirm('Delete this route?')) return; await idbDo('readwrite', s => s.delete(r.id)); sel = null; toast('Deleted'); drawSaved(); };
    det.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  bindSeg($('#tabs', el), (k) => { tab = k; if (k === 'rec') drawRec(); else drawSaved(); });
  drawRec();
  if (R.running) startRec();
  return () => { alive = false; if (R.running) { R.running = false; R.end = Date.now(); persistDraft(); } if (stopGps) stopGps(); clearInterval(tick); wake.dispose(); };
} });

/* ---------- 3. My PIN Code ---------- */
Tools.register({ id: 'pincode', name: 'My PIN Code', icon: '📍', cat: 'navigate', desc: 'Your exact coordinates and Plus Code, a map-app-free geo link, and named places you can find your way back to.', keys: ['location', 'coordinates', 'plus code', 'olc', 'where am i', 'latitude', 'longitude', 'share location', 'home'], needs: ['location', 'storage'], render(el) {
  let places = Store.get('daily.places', []), pos = null, heading = null, alive = true;
  el.innerHTML = `
    <div class="card" style="${GRAD};text-align:center;padding:20px 14px">
      <div class="muted" style="font-size:12px;letter-spacing:.08em;text-transform:uppercase">Your Plus Code</div>
      <div id="pc" style="font-size:30px;font-weight:800;letter-spacing:1px;margin:6px 0 2px;font-variant-numeric:tabular-nums">--------+--</div>
      <div id="st" class="muted" style="font-size:13px">Waiting for GPS...</div></div>
    <div class="card list" style="gap:2px;padding:6px 14px">
      <div class="item" style="border:0;padding:12px 0"><span class="grow muted">Latitude</span><b id="la">--</b></div>
      <div class="item" style="border:0;border-top:1px solid var(--line);border-radius:0;padding:12px 0"><span class="grow muted">Longitude</span><b id="lo">--</b></div>
      <div class="item" style="border:0;border-top:1px solid var(--line);border-radius:0;padding:12px 0"><span class="grow muted">Accuracy</span><b id="ac">--</b></div>
      <div class="item" style="border:0;border-top:1px solid var(--line);border-radius:0;padding:12px 0"><span class="grow muted">Altitude</span><b id="al">--</b></div></div>
    <div class="row"><button class="btn alt" id="c1">Copy coordinates</button><button class="btn alt" id="c2">Copy Plus Code</button></div>
    <div class="row"><button class="btn alt" id="c3">Copy geo link</button><button class="btn" id="sh">Share</button></div>
    ${sub('A Plus Code is a short address that works anywhere, even offline. The geo: link opens in any map app and needs no Google account.')}
    <div style="${H2}">Saved places</div>
    <div class="card list" style="gap:10px"><div class="row"><input id="pn" type="text" maxlength="30" placeholder="Name this spot" aria-label="Place name"><button class="btn" id="ps" style="flex:0 0 auto">Save here</button></div>
      <div class="row" style="gap:6px" id="chips">${['Home', 'Parking', 'Work', 'Hotel'].map(n => `<button class="btn alt" data-n="${n}" style="padding:8px 4px;font-size:13px">${n}</button>`).join('')}</div></div>
    <div class="list" id="pl"></div>`;
  const cur = () => pos && { lat: pos.lat, lon: pos.lon };
  const geo = (p, n) => `geo:${p.lat.toFixed(6)},${p.lon.toFixed(6)}?q=${p.lat.toFixed(6)},${p.lon.toFixed(6)}${n ? '(' + encodeURIComponent(n) + ')' : ''}`;
  const coords = (p) => p.lat.toFixed(6) + ', ' + p.lon.toFixed(6);
  /* The list is built only when the saved places change. Position and compass updates only touch text and the arrow rotation,
     so a tap on Copy or the delete button is never lost to a re-render. */
  function drawPlaces() {
    $('#pl', el).innerHTML = places.map(pl => `<div class="item" style="gap:12px;padding:12px 14px"><span style="width:34px;text-align:center"><span data-ar="${pl.id}" style="display:none;font-size:26px;transition:transform .3s" aria-hidden="true">⬆️</span><span data-pin="${pl.id}">📍</span></span><span class="grow"><b>${esc(pl.name)}</b><br><small class="muted" data-info="${pl.id}">${plusCode(pl.lat, pl.lon)}</small></span><button class="btn alt" data-cp="${pl.id}" aria-label="Copy ${esc(pl.name)}" style="padding:8px 10px;min-width:44px">Copy</button><button class="btn alt" data-rm="${pl.id}" aria-label="Delete ${esc(pl.name)}" style="padding:8px 12px;min-width:44px">✕</button></div>`).join('') || empty('📌', 'No saved places yet.<br>Name a spot above and tap Save here.');
    updatePlaces();
  }
  function updatePlaces() {
    if (!pos) return;
    places.forEach(pl => {
      const d = hav(pos, pl), b = bearing(pos, pl), rot = heading != null ? b - heading : b;
      const info = $(`[data-info="${pl.id}"]`, el), ar = $(`[data-ar="${pl.id}"]`, el), pin = $(`[data-pin="${pl.id}"]`, el);
      if (info) info.innerHTML = `<b>${fmtDist(d)}</b> ${compassName(b)} · ${plusCode(pl.lat, pl.lon)}`;
      if (ar) { ar.style.display = 'inline-block'; ar.style.transform = `rotate(${rot}deg)`; }
      if (pin) pin.style.display = 'none';
    });
  }
  function show() {
    if (!pos) return;
    $('#pc', el).textContent = plusCode(pos.lat, pos.lon);
    $('#la', el).textContent = pos.lat.toFixed(6); $('#lo', el).textContent = pos.lon.toFixed(6);
    $('#ac', el).textContent = '±' + Math.round(pos.acc) + ' m'; $('#al', el).textContent = pos.alt != null ? Math.round(pos.alt) + ' m' : 'n/a';
    $('#st', el).textContent = pos.acc < 20 ? 'Good GPS fix' : 'Rough fix, go outside for better accuracy';
    updatePlaces();
  }
  const stopG = watchGps(p => { pos = p; show(); }, e => { $('#st', el).textContent = gpsMsg(e); });
  let lastH = 0;
  const stopH = watchHeading(hd => { heading = hd; const now = Date.now(); if (pos && alive && now - lastH >= 150) { lastH = now; updatePlaces(); } });
  const need = () => { if (!pos) { toast('Still waiting for GPS'); return null; } return pos; };
  $('#c1', el).onclick = () => need() && copyText(coords(pos));
  $('#c2', el).onclick = () => need() && copyText(plusCode(pos.lat, pos.lon));
  $('#c3', el).onclick = () => need() && copyText(geo(pos));
  $('#sh', el).onclick = () => need() && shareText('My location', `My location: ${coords(pos)}\nPlus Code: ${plusCode(pos.lat, pos.lon)}\n${geo(pos)}`);
  $('#chips', el).onclick = (e) => { const b = e.target.closest('[data-n]'); if (b) { $('#pn', el).value = b.dataset.n; } };
  $('#ps', el).onclick = () => {
    if (!need()) return;
    const name = $('#pn', el).value.trim().slice(0, 30); if (!name) { toast('Give the place a name'); return; }
    if (places.length >= 50) { toast('Up to 50 saved places. Delete one first.'); return; }
    places.unshift({ id: uid(), name, lat: pos.lat, lon: pos.lon, at: Date.now() }); Store.set('daily.places', places);
    $('#pn', el).value = ''; drawPlaces(); toast('Saved ' + name);
  };
  $('#pl', el).onclick = (e) => {
    const rm = e.target.closest('[data-rm]'), cp = e.target.closest('[data-cp]');
    if (rm) { places = places.filter(p => p.id !== rm.dataset.rm); Store.set('daily.places', places); drawPlaces(); }
    if (cp) { const p = places.find(x => x.id === cp.dataset.cp); if (p) copyText(`${p.name}: ${coords(p)} (${plusCode(p.lat, p.lon)})`); }
  };
  drawPlaces();
  return () => { alive = false; stopG(); stopH(); };
} });

/* ---------- 9. Parking Saver ---------- */
Tools.register({ id: 'parking', name: 'Parking Saver', icon: '🅿️', cat: 'navigate', desc: 'Remember where you parked, with a meter countdown alert and the way back.', keys: ['car', 'meter', 'park', 'find my car', 'garage'], needs: ['location', 'notifications', 'storage'], render(el) {
  let spot = Store.get('daily.parking', null), pos = null, heading = null, alive = true, iv = null, noteBlocked = false;
  const IDS = [730001, 730002];
  const root = document.createElement('div'); root.className = 'list'; root.style.gap = '12px'; el.appendChild(root);
  const stopG = watchGps(p => { pos = p; refresh(); }, e => { const m = $('#gm', el); if (m) m.textContent = gpsMsg(e); });
  const stopH = watchHeading(hd => { heading = hd; refresh(); });
  askWebNote();
  notesDenied().then(d => { if (d) { noteBlocked = true; setBlocked(root, true); } });
  const ago = (t) => { const m = Math.floor((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min ago'; };
  function refresh() {
    if (!alive || !spot) return;
    const d = $('#dist', el); if (d) {
      if (pos) { const dd = hav(pos, spot), b = bearing(pos, spot);
        d.textContent = fmtDist(dd); $('#dir', el).textContent = compassName(b) + ' · ' + Math.round(b) + '°';
        $('#arw', el).style.transform = `rotate(${heading != null ? b - heading : b}deg)`; $('#gm', el).textContent = heading != null ? 'Arrow points the way, follow it' : 'Arrow is relative to north (no compass sensor)'; }
      else $('#gm', el).textContent = 'Waiting for GPS...';
    }
    const m = $('#mt', el); if (m && spot.exp) {
      const left = spot.exp - Date.now();
      if (left <= 0) { m.textContent = 'Meter expired'; m.style.color = 'var(--danger)'; if (!spot.warned) { spot.warned = true; Store.set('daily.parking', spot); beep(); webNote('Parking meter', 'Your meter has expired'); toast('Parking meter expired'); } }
      else { m.textContent = fmtDur(left) + ' left'; m.style.color = left < 5 * 60000 ? 'var(--danger)' : 'var(--text)'; }
    }
  }
  function draw() {
    if (!alive) return;
    if (!spot) {
      root.innerHTML = `<div class="card" style="${GRAD};text-align:center;padding:26px 16px"><div style="font-size:54px">🚗</div><div style="font-weight:700;font-size:18px;margin:4px 0">Park, tap, forget</div><div class="muted" style="font-size:14px">Save the GPS spot of your car and find it again later.</div></div>
        <label class="f">Note (level, bay, landmark)<input id="nt" type="text" maxlength="60" placeholder="Level 2, near the lifts"></label>
        <div style="${H2}">Meter timer (optional)</div>
        <div id="mins">${segHtml([['0', 'None'], ['15', '15m'], ['30', '30m'], ['60', '1h'], ['120', '2h']], '0')}</div>
        <label class="f">or custom minutes<input id="cm" type="number" min="1" max="1440" inputmode="numeric" placeholder="e.g. 45"></label>
        <button class="btn" id="sv" style="padding:16px;font-size:17px">Save my parking spot</button>
        <div id="gm" class="muted center" style="font-size:13px">${pos ? 'GPS ready' : 'Waiting for GPS...'}</div>
        ${note(notesLine() + ' The meter alert comes with a 5 minute warning.')}${blockedHtml()}`;
      setBlocked(root, noteBlocked);
      let mins = 0; bindSeg($('#mins', root), k => { mins = +k; $('#cm', root).value = ''; });
      $('#sv', root).onclick = async () => {
        const go = async (p) => {
          const cm = clamp(Math.floor(+$('#cm', root).value || mins), 0, 1440);
          spot = { lat: p.lat, lon: p.lon, acc: p.acc, at: Date.now(), note: $('#nt', root).value.trim().slice(0, 60), exp: cm ? Date.now() + cm * 60000 : 0, warned: false };
          Store.set('daily.parking', spot);
          let okN = true;
          if (spot.exp) {
            const a = await notifyAt(IDS[1], 'Parking meter', 'Your meter expires in 5 minutes', spot.exp - 5 * 60000 > Date.now() ? spot.exp - 5 * 60000 : spot.exp - 1000);
            const b = await notifyAt(IDS[0], 'Parking meter expired', spot.note || 'Time to move your car', spot.exp);
            okN = alertsOk(a) && alertsOk(b);
            if (!okN) noteBlocked = true;
          }
          toast(okN ? 'Parking spot saved' : 'Spot saved, but the meter alert is blocked'); if (alive) draw();
        };
        if (pos) return go(pos);
        toast('Getting a GPS fix...');
        navigator.geolocation && navigator.geolocation.getCurrentPosition(p => go({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy }), e => toast(gpsMsg(e)), { enableHighAccuracy: true, timeout: 20000 });
      };
      return;
    }
    root.innerHTML = `<div class="card" style="${GRAD};text-align:center;padding:20px 14px">
        <div class="muted" style="font-size:13px">Parked ${ago(spot.at)}${spot.note ? ' · ' + esc(spot.note) : ''}</div>
        <div id="arw" style="font-size:78px;line-height:1.1;margin:10px 0 2px;transition:transform .3s">⬆️</div>
        <div id="dist" style="font-size:44px;font-weight:800;font-variant-numeric:tabular-nums">--</div>
        <div id="dir" class="muted" style="font-weight:600">--</div>
        <div id="gm" class="muted" style="font-size:12px;margin-top:8px">Waiting for GPS...</div></div>
      ${spot.exp ? `<div class="card center"><div class="muted" style="font-size:12px;letter-spacing:.08em;text-transform:uppercase">Meter</div><div id="mt" style="font-size:32px;font-weight:800;font-variant-numeric:tabular-nums">--</div><small class="muted">expires at ${new Date(spot.exp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></div>` : ''}
      <div class="row"><a class="btn alt linkbtn" href="${geo(spot)}">Open in map app</a><button class="btn alt" id="cp">Copy spot</button></div>
      <button class="btn danger" id="clr">I found my car (clear)</button>
      ${note('Accuracy at save time was about ±' + Math.round(spot.acc || 0) + ' m. Inside a garage the GPS can be weak, so a note about the level helps.')}${blockedHtml()}`;
    setBlocked(root, noteBlocked && !!spot.exp);
    $('#cp', root).onclick = () => copyText(`${spot.lat.toFixed(6)}, ${spot.lon.toFixed(6)} (${plusCode(spot.lat, spot.lon)})`);
    $('#clr', root).onclick = async () => { spot = null; Store.set('daily.parking', null); await cancelNotes(IDS); draw(); };
    refresh();
  }
  const geo = (p) => `geo:${p.lat.toFixed(6)},${p.lon.toFixed(6)}?q=${p.lat.toFixed(6)},${p.lon.toFixed(6)}(Parked%20car)`;
  draw(); iv = setInterval(refresh, 1000);
  return () => { alive = false; stopG(); stopH(); clearInterval(iv); };
} });

/* ---------- 4. World Clock ---------- */
Tools.register({ id: 'worldclock', name: 'World Clock', icon: '🌍', cat: 'daily', desc: 'Keep the time in cities around the world, with date, UTC offset and the difference from your own time.', keys: ['time zone', 'timezone', 'utc', 'cities', 'abroad'], needs: ['storage'], render(el) {
  const defaults = [{ n: 'London', z: 'Europe/London' }, { n: 'New York', z: 'America/New_York' }, { n: 'Tokyo', z: 'Asia/Tokyo' }];
  let list = Store.get('daily.clocks', defaults), h24 = Store.get('daily.clock24', false);
  const localName = (Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local').replace(/_/g, ' ');
  el.innerHTML = `<div class="card" style="${GRAD};text-align:center;padding:18px"><div class="muted" style="font-size:12px;letter-spacing:.08em;text-transform:uppercase">Your time · ${esc(localName)}</div><div id="me" style="font-size:44px;font-weight:800;font-variant-numeric:tabular-nums"></div><div id="md" class="muted"></div></div>
    <div class="row"><input id="cs" type="text" list="cl" placeholder="Search a city to add" aria-label="City" maxlength="40" autocomplete="off"><button class="btn" id="add" style="flex:0 0 auto">Add</button></div>
    <datalist id="cl">${CITIES.map(c => `<option value="${esc(c[0])}"></option>`).join('')}</datalist>
    <label class="item" style="min-height:48px"><span class="grow">24-hour clock</span><input type="checkbox" id="f24" ${h24 ? 'checked' : ''} style="width:22px;height:22px"></label>
    <div class="list" id="ls"></div>`;
  const save = () => Store.set('daily.clocks', list);
  const fm = (tz, o) => new Intl.DateTimeFormat([], Object.assign({ timeZone: tz }, o));
  /* The list is built only when cities or the clock format change; the clock itself only rewrites text, so taps are never lost. */
  const setText = (n, t) => { if (n && n.textContent !== t) n.textContent = t; };
  function tick() {
    const now = new Date(), me = tzOffsetMin(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', now);
    setText($('#me', el), now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: !h24 }));
    setText($('#md', el), now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' }));
    $$('[data-row]', el).forEach(row => {
      const c = list[+row.dataset.row]; if (!c) return;
      let off = 0, t = '--', d = '', hr = 12;
      try {
        off = tzOffsetMin(c.z, now); t = fm(c.z, { hour: '2-digit', minute: '2-digit', hour12: !h24 }).format(now);
        d = fm(c.z, { weekday: 'short', day: 'numeric', month: 'short' }).format(now);
        hr = +fm(c.z, { hour: 'numeric', hourCycle: 'h23' }).format(now) % 24;
      } catch (e) {}
      const day = hr >= 6 && hr < 18, sun = $('[data-sun]', row);
      setText(sun, day ? '☀️' : '🌙'); sun.title = day ? 'Daytime' : 'Night';
      setText($('[data-sub]', row), `${d} · ${offLabel(off)} · ${diffLabel(off - me)}`);
      setText($('[data-time]', row), t);
    });
  }
  const BTN = 'padding:0;min-width:44px;min-height:44px;font-size:14px';
  function draw() {
    $('#ls', el).innerHTML = list.map((c, i) => `<div class="item" data-row="${i}" style="flex-wrap:wrap;gap:6px 10px;padding:12px 14px"><span data-sun style="font-size:28px"></span>
        <span class="grow" style="min-width:110px"><b>${esc(c.n)}</b><br><small class="muted" data-sub></small></span>
        <span data-time style="font-size:24px;font-weight:700;font-variant-numeric:tabular-nums"></span>
        <span style="flex:1 0 100%;display:flex;gap:6px;justify-content:flex-end"><button class="btn alt" data-up="${i}" aria-label="Move ${esc(c.n)} up" style="${BTN}">▲</button><button class="btn alt" data-dn="${i}" aria-label="Move ${esc(c.n)} down" style="${BTN}">▼</button><button class="btn alt" data-rm="${i}" aria-label="Remove ${esc(c.n)}" style="${BTN}">✕</button></span></div>`).join('') || empty('🌍', 'No cities yet. Search above and tap Add.');
    tick();
  }
  $('#add', el).onclick = () => {
    const q = $('#cs', el).value.trim().toLowerCase(), c = CITIES.find(x => x[0].toLowerCase() === q) || CITIES.find(x => x[0].toLowerCase().includes(q));
    if (!q || !c) { toast('Pick a city from the list'); return; }
    if (list.some(x => x.z === c[1])) { toast('Already added'); return; }
    list.push({ n: c[0], z: c[1] }); save(); $('#cs', el).value = ''; draw();
  };
  $('#f24', el).onchange = (e) => { h24 = e.target.checked; Store.set('daily.clock24', h24); draw(); };
  $('#ls', el).onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset, mv = (i, j) => { if (j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]]; };
    if (d.rm != null) list.splice(+d.rm, 1); else if (d.up != null) mv(+d.up, +d.up - 1); else if (d.dn != null) mv(+d.dn, +d.dn + 1);
    save(); draw();
  };
  draw(); const iv = setInterval(tick, 1000);
  return () => clearInterval(iv);
} });

/* ---------- 5. Pomodoro ---------- */
Tools.register({ id: 'pomodoro', name: 'Pomodoro', icon: '🍅', cat: 'daily', desc: 'Focus and break cycles with adjustable lengths, an alert when each one ends, and a count of sessions today.', keys: ['focus', 'study', 'work timer', 'break', 'productivity'], needs: ['notifications', 'storage'], render(el) {
  const MODES = { focus: ['Focus', '🎯'], short: ['Short break', '☕'], long: ['Long break', '🌴'] };
  const S = Object.assign({ mins: { focus: 25, short: 5, long: 15 }, mode: 'focus', endAt: 0, left: 0, cycle: 0, auto: false }, Store.get('daily.pomo', {}));
  const NID = 740001;
  let iv = null, alive = true, cfg = false;
  const dur = (m) => S.mins[m] * 60000;
  if (!S.left) S.left = dur(S.mode);
  const todayN = () => { const t = Store.get('daily.pomoday', {}); return t.d === dayKey(new Date()) ? t.n : 0; };
  const save = () => Store.set('daily.pomo', S);
  const remain = () => S.endAt ? Math.max(0, S.endAt - Date.now()) : S.left;
  el.innerHTML = `<div id="tabs">${segHtml([['focus', 'Focus'], ['short', 'Short break'], ['long', 'Long break']], S.mode)}</div>
    <div class="card" style="${GRAD};text-align:center;padding:26px 14px"><div id="ml" class="muted" style="font-weight:600"></div>
      <div id="tm" style="font-size:72px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1.1;margin:8px 0"></div>
      <div class="progress" style="margin:6px 20px"><i id="pg" style="width:0"></i></div>
      <div id="cy" style="margin-top:14px;font-size:20px;letter-spacing:4px"></div><div id="cyn" class="muted" style="font-size:13px"></div></div>
    <div class="row"><button class="btn" id="go" style="padding:16px;font-size:17px">Start</button><button class="btn alt" id="rs" style="flex:0 0 30%">Reset</button><button class="btn alt" id="sk" style="flex:0 0 30%">Skip</button></div>
    <div class="card row center" style="gap:0"><div><div class="mid" id="td">0</div><small class="muted">Focus sessions today</small></div><div><div class="mid" id="to">0</div><small class="muted">All time</small></div></div>
    <button class="btn alt" id="cf">Adjust lengths</button><div id="cfp" hidden class="card list" style="gap:10px">
      ${['focus', 'short', 'long'].map(k => `<label class="f">${MODES[k][0]} (minutes)<input type="number" min="1" max="180" inputmode="numeric" data-m="${k}" value="${S.mins[k]}"></label>`).join('')}
      <label class="item" style="min-height:48px"><span class="grow">Start the next period automatically</span><input type="checkbox" id="au" ${S.auto ? 'checked' : ''} style="width:22px;height:22px"></label></div>
    ${sub('Every 4th focus session earns a long break. ' + notesLine() + ' The timer uses the clock, so it stays accurate even if the screen was off.')}${blockedHtml()}`;
  function draw() {
    const r = remain();
    $('#tm', el).textContent = fmtDur(r); $('#ml', el).textContent = MODES[S.mode][1] + ' ' + MODES[S.mode][0];
    $('#pg', el).style.width = (100 - r / dur(S.mode) * 100).toFixed(1) + '%';
    const n = S.cycle % 4;
    $('#cy', el).textContent = [0, 1, 2, 3].map(i => i < n ? '🍅' : '⚪').join(' ');
    $('#cyn', el).textContent = `Session ${n + 1} of 4 before a long break`;
    $('#go', el).textContent = S.endAt ? 'Pause' : (S.left < dur(S.mode) ? 'Resume' : 'Start');
    $('#td', el).textContent = todayN(); $('#to', el).textContent = Store.get('daily.pomototal', 0);
  }
  function setMode(m, autostart) {
    S.mode = m; S.endAt = 0; S.left = dur(m); save(); cancelNotes([NID]);
    $$('#tabs button', el).forEach(b => b.classList.toggle('alt', b.dataset.k !== m));
    draw(); if (autostart) start();
  }
  function start() {
    S.endAt = Date.now() + S.left; save(); askWebNote();
    const my = S.endAt;
    notifyAt(NID, MODES[S.mode][0] + ' finished', S.mode === 'focus' ? 'Nice work, time for a break.' : 'Break over, back to focus.', my).then(ok => {
      if (S.endAt !== my) { cancelNotes([NID]); return; } // paused or reset while the permission prompt was open
      if (alive) setBlocked(el, !alertsOk(ok));
    });
    draw();
  }
  function pause() { S.left = remain(); S.endAt = 0; save(); cancelNotes([NID]); draw(); }
  function finish() {
    const was = S.mode; S.endAt = 0; beep(); setTimeout(beep, 900);
    webNote(MODES[was][0] + ' finished', was === 'focus' ? 'Time for a break.' : 'Back to focus.');
    toast(was === 'focus' ? 'Focus session done. Take a break.' : 'Break over.');
    if (was === 'focus') {
      S.cycle++; const t = Store.get('daily.pomoday', {}), n = (t.d === dayKey(new Date()) ? t.n : 0) + 1;
      Store.set('daily.pomoday', { d: dayKey(new Date()), n }); Store.set('daily.pomototal', Store.get('daily.pomototal', 0) + 1);
    }
    const next = was === 'focus' ? (S.cycle % 4 === 0 ? 'long' : 'short') : 'focus';
    setMode(next, S.auto);
  }
  bindSeg($('#tabs', el), (k) => setMode(k, false));
  $('#go', el).onclick = () => S.endAt ? pause() : start();
  $('#rs', el).onclick = () => { S.cycle = 0; setMode(S.mode, false); };
  $('#sk', el).onclick = () => setMode(S.mode === 'focus' ? 'short' : 'focus', false);
  $('#cf', el).onclick = () => { cfg = !cfg; $('#cfp', el).hidden = !cfg; };
  $('#cfp', el).oninput = (e) => {
    const m = e.target.dataset.m;
    if (m) { S.mins[m] = clamp(Math.floor(+e.target.value) || S.mins[m], 1, 180); if (!S.endAt && m === S.mode) S.left = dur(m); save(); draw(); }
    if (e.target.id === 'au') { S.auto = e.target.checked; save(); }
  };
  probeBlocked(el);
  iv = setInterval(() => { if (S.endAt && Date.now() >= S.endAt) finish(); else draw(); }, 250);
  if (S.endAt && Date.now() >= S.endAt) { S.endAt = Date.now(); S.left = 0; }
  draw();
  return () => { alive = false; clearInterval(iv); };
} });

/* ---------- 6. Alarm Clock ---------- */
Tools.register({ id: 'alarmclock', name: 'Alarm Clock', icon: '⏰', cat: 'daily', desc: 'Alarms with a label and weekday repeat, scheduled as Android notifications so they ring with the app closed.', keys: ['wake', 'wake up', 'morning', 'repeat', 'clock'], needs: ['notifications', 'storage'], render(el) {
  let alarms = Store.get('daily.alarms', []), seq = Store.get('daily.alarmseq', 1), draftDays = [1, 2, 3, 4, 5], timers = [];
  const DN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'], DF = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const baseOf = (a) => a.nb != null ? a.nb : 750000 + a.n * 10; // alarms made before the id blocks keep their old ids
  const idsOf = (a) => [0, 1, 2, 3, 4, 5, 6, 7].map(k => baseOf(a) + k);
  const save = () => Store.set('daily.alarms', alarms);
  el.innerHTML = `<div class="card" style="${GRAD};padding:16px">
      <div style="display:flex;gap:12px;align-items:center"><input id="tm" type="time" min="00:00" max="23:59" maxlength="5" required value="07:00" aria-label="Alarm time" style="font-size:36px;font-weight:800;text-align:center;padding:10px;width:auto;flex:1"></div>
      <input id="lb" type="text" maxlength="40" placeholder="Label (optional)" aria-label="Label" style="margin-top:10px">
      <div style="${H2};margin-top:12px">Repeat (none selected = once)</div>
      <div id="dy" style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-top:6px">${DN.map((d, i) => `<button class="btn ${draftDays.includes(i) ? '' : 'alt'}" data-d="${i}" aria-label="${DF[i]}" aria-pressed="${draftDays.includes(i)}" style="padding:0;min-height:44px;border-radius:14px;font-size:14px">${d}</button>`).join('')}</div>
      <button class="btn" id="add" style="width:100%;margin-top:14px">Add alarm</button></div>
    ${blockedHtml()}<div class="list" id="ls"></div>
    ${note('<b>How alarms work.</b> ' + (LN() ? 'Each alarm is an Android notification, so it can ring with the app closed. Android may deliver it a few minutes late when the phone is idle or battery saver is on. It uses your notification sound, so it is not a true alarm: silent mode, Do Not Disturb or battery saver can mute it. Do not rely on it for anything critical.' : 'This is a browser, which cannot ring while closed. Alarms only sound while PocketKit stays open. On Android the app schedules real notifications.'))}`;
  const lab = (a) => `${pad(a.h)}:${pad(a.m)}`;
  async function schedule(a) {
    await cancelNotes(idsOf(a));
    if (!a.on || !LN()) return true;
    const ln = LN();
    try {
      const p = await ln.requestPermissions(); if (p.display !== 'granted') return false;
      const base = { title: a.label || 'Alarm', body: lab(a) + ' alarm', allowWhileIdle: true };
      const ns = a.days.length ? a.days.map(d => Object.assign({ id: baseOf(a) + d }, base, { schedule: { on: { weekday: d + 1, hour: a.h, minute: a.m }, allowWhileIdle: true } }))
        : [Object.assign({ id: baseOf(a) + 7 }, base, { schedule: { at: nextAlarm(a, new Date()), allowWhileIdle: true } })];
      await ln.schedule({ notifications: ns }); return true;
    } catch (e) { return false; }
  }
  function arm() { // in-app fallback while the page is open
    timers.forEach(clearTimeout); timers = [];
    alarms.filter(a => a.on).forEach(a => {
      const t = nextAlarm(a, new Date()); if (!t) return;
      const ms = t - Date.now(); if (ms > 2147e6) return;
      timers.push(setTimeout(() => ring(a), ms));
    });
  }
  function ring(a) {
    beep(); setTimeout(beep, 1000); setTimeout(beep, 2000); toast('⏰ ' + (a.label || lab(a)));
    webNote(a.label || 'Alarm', lab(a));
    if (!a.days.length) { a.on = false; save(); }
    draw(); arm();
  }
  function draw() {
    const sorted = alarms.slice().sort((a, b) => a.h * 60 + a.m - (b.h * 60 + b.m));
    $('#ls', el).innerHTML = sorted.map(a => {
      const nx = a.on ? nextAlarm(a, new Date()) : null;
      const rep = a.days.length === 7 ? 'Every day' : a.days.length ? a.days.map(d => DF[d]).join(' ') : 'Once';
      return `<div class="item" style="gap:12px;padding:14px;${a.on ? '' : 'opacity:.6'}"><span class="grow"><span style="font-size:32px;font-weight:800;font-variant-numeric:tabular-nums">${lab(a)}</span><br><small class="muted">${esc(a.label || 'Alarm')} · ${rep}${nx ? ' · next ' + nx.toLocaleDateString([], { weekday: 'short', day: 'numeric' }) : ''}</small></span>
        <label style="display:grid;place-items:center;min-width:44px;min-height:44px"><input type="checkbox" data-t="${a.n}" ${a.on ? 'checked' : ''} aria-label="Enable alarm ${lab(a)}" style="width:26px;height:26px"></label><button class="btn alt" data-x="${a.n}" aria-label="Delete alarm ${lab(a)}" style="padding:10px 12px;min-width:44px">✕</button></div>`;
    }).join('') || empty('⏰', 'No alarms yet.');
  }
  $('#dy', el).onclick = (e) => {
    const b = e.target.closest('[data-d]'); if (!b) return; const d = +b.dataset.d;
    draftDays = draftDays.includes(d) ? draftDays.filter(x => x !== d) : [...draftDays, d]; b.classList.toggle('alt', !draftDays.includes(d)); b.setAttribute('aria-pressed', String(draftDays.includes(d)));
  };
  $('#add', el).onclick = async () => {
    const v = $('#tm', el).value.split(':'); if (v.length < 2) { toast('Pick a time'); return; }
    if (alarms.length >= 50) { toast('Up to 50 alarms. Delete one first.'); return; }
    const a = { n: seq, nb: noteId('alarm', seq++), set: 0, h: clamp(+v[0] || 0, 0, 23), m: clamp(+v[1] || 0, 0, 59), label: $('#lb', el).value.trim().slice(0, 40), days: draftDays.slice().sort(), on: true };
    Store.set('daily.alarmseq', seq); alarms.push(a); save(); $('#lb', el).value = '';
    if (!a.days.length) a.set = nextAlarm(a, new Date()).getTime();
    askWebNote(); const ok = await schedule(a); draw(); arm();
    setBlocked(el, !alertsOk(ok));
    const when = nextAlarm(a, new Date()).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    toast(alertsOk(ok) ? 'Alarm set for ' + when : 'Alarm saved for ' + when + ', but notifications are blocked');
  };
  $('#ls', el).onclick = async (e) => {
    const t = e.target.closest('[data-t]'), x = e.target.closest('[data-x]');
    if (t) { const a = alarms.find(z => z.n === +t.dataset.t); a.on = t.checked; if (a.on && !a.days.length) a.set = nextAlarm(a, new Date()).getTime(); save(); const ok = await schedule(a); if (a.on) setBlocked(el, !alertsOk(ok)); draw(); arm(); }
    if (x) { const a = alarms.find(z => z.n === +x.dataset.x); alarms = alarms.filter(z => z !== a); save(); await cancelNotes(idsOf(a)); draw(); arm(); }
  };
  // one-off alarms whose time has passed while closed are switched off
  alarms.forEach(a => { if (a.on && !a.days.length && a.set && a.set < Date.now()) a.on = false; });
  probeBlocked(el);
  draw(); arm();
  return () => timers.forEach(clearTimeout);
} });

/* ---------- 7. Signal Light ---------- */
Tools.register({ id: 'signallight', name: 'Signal Light', icon: '🚨', cat: 'daily', desc: 'Flash SOS, a strobe or your own Morse message with the screen and the torch, with a speed control.', keys: ['sos', 'morse', 'strobe', 'emergency', 'flash', 'beacon'], needs: ['camera'], render(el) {
  let mode = 'sos', speed = 5, text = 'HELP', ov = null, run = 0, torch = null, useTorch = true, warned = false, starting = false, alive = true;
  const wake = keepAwake();
  el.innerHTML = `<div id="tabs">${segHtml([['sos', 'SOS'], ['morse', 'Morse'], ['strobe', 'Strobe']], mode)}</div>
    <div class="card" style="${GRAD};text-align:center;padding:22px 14px"><div id="ic" style="font-size:56px">🆘</div><div id="ds" class="muted" style="margin-top:6px"></div></div>
    <div id="mo" hidden><label class="f">Message (letters and numbers)<input id="tx" type="text" maxlength="40" value="${text}" autocapitalize="characters"></label></div>
    <div class="card"><label class="f">Speed <span id="spv" style="color:var(--text);font-weight:700"></span><input id="sp" type="range" min="1" max="10" value="${speed}" style="width:100%"></label></div>
    <label class="item" style="min-height:52px"><span class="grow">Also flash the torch<br><small class="muted">Uses the camera light if this device allows it</small></span><input type="checkbox" id="tc" checked style="width:22px;height:22px"></label>
    <div id="wn" class="card" hidden style="border-color:var(--danger)"><b style="color:var(--danger)">⚠️ Photosensitivity warning</b><div class="muted" style="font-size:14px;margin:6px 0 12px;line-height:1.5">Fast flashing lights can trigger seizures in people with photosensitive epilepsy. Do not use the strobe if you or anyone near you is at risk, and never point it at someone's face.</div><button class="btn danger" id="wok" style="width:100%">I understand, start strobe</button></div>
    <button class="btn" id="go" style="padding:16px;font-size:17px">Start</button>
    ${sub('Tap the screen while it flashes to stop. Morse and SOS are generated by the standard timing: dot 1, dash 3, gaps 1, 3 and 7 units. The speed slider changes the unit length.')}`;
  const unit = () => Math.round(60 + (10 - speed) * 55);
  function draw() {
    $('#spv', el).textContent = mode === 'strobe' ? (speed * 1).toFixed(0) + ' flashes/s' : unit() + ' ms per unit';
    $('#ic', el).textContent = { sos: '🆘', morse: '📡', strobe: '⚡' }[mode];
    $('#ds', el).textContent = { sos: 'Three short, three long, three short, repeated.', morse: 'Flash your own text as Morse code.', strobe: 'A fast, bright flashing light.' }[mode];
    $('#mo', el).hidden = mode !== 'morse'; if (mode !== 'strobe') $('#wn', el).hidden = true;
  }
  function timeline() {
    if (mode === 'strobe') { const p = 500 / speed; return [[true, p], [false, p]]; }
    const t = morseTimeline(mode === 'sos' ? 'SOS' : text, unit()); if (t.length) t.push([false, unit() * 7]); return t;
  }
  async function begin() {
    if (starting || ov) return; // a second tap while the torch is opening must not build a second overlay
    const tl = timeline(); if (!tl.length) { toast('Type a message with letters or numbers'); return; }
    starting = true; const my = ++run;
    const tch = useTorch ? await torchOpen() : null;
    starting = false;
    /* Back or a stop may have happened while the camera was opening: close the torch and build nothing. */
    if (!alive || my !== run) { if (tch) tch.close(); return; }
    torch = tch;
    ov = h('<div style="position:fixed;inset:0;z-index:60;background:#000;display:grid;place-items:center;color:#888;font-size:14px" role="button" aria-label="Tap to stop"><span style="opacity:.5;pointer-events:none">Tap to stop</span></div>');
    document.body.appendChild(ov); wake.on();
    ov.onclick = end; let i = 0;
    const step = () => {
      if (my !== run || !ov) return;
      const [on, ms] = tl[i % tl.length]; i++;
      ov.style.background = on ? '#fff' : '#000'; ov.firstChild.style.opacity = on ? 0 : .5;
      if (torch) torch.set(on);
      setTimeout(step, ms);
    };
    step();
  }
  function end() { run++; if (ov) { ov.remove(); ov = null; } if (torch) { torch.close(); torch = null; } wake.off(); }
  bindSeg($('#tabs', el), (k) => { mode = k; draw(); });
  $('#sp', el).oninput = (e) => { speed = +e.target.value; draw(); };
  $('#tx', el).oninput = (e) => { text = e.target.value; };
  $('#tc', el).onchange = (e) => { useTorch = e.target.checked; };
  $('#go', el).onclick = () => { if (mode === 'strobe' && !warned) { $('#wn', el).hidden = false; $('#wn', el).scrollIntoView({ block: 'nearest' }); return; } begin(); };
  $('#wok', el).onclick = () => { warned = true; $('#wn', el).hidden = true; begin(); };
  draw();
  return () => { alive = false; end(); wake.dispose(); };
} });

/* ---------- 8. To-do List ---------- */
Tools.register({ id: 'todo', name: 'To-do List', icon: '✅', cat: 'daily', desc: 'Tasks with due dates and categories, search, and one tap to clear what is done.', keys: ['tasks', 'checklist', 'list', 'chores', 'deadline'], needs: ['storage'], render(el) {
  const CATS_T = ['Personal', 'Work', 'Home', 'Shopping', 'Other'];
  let items = Store.get('daily.todo', []), filter = 'all', q = '';
  const save = () => Store.set('daily.todo', items);
  el.innerHTML = `<div class="card list" style="gap:10px"><input id="tx" type="text" maxlength="100" placeholder="What needs doing?" aria-label="New task">
      <div class="row"><input id="du" type="date" aria-label="Due date" min="2000-01-01" max="2100-12-31"><select id="ct" aria-label="Category">${CATS_T.map(c => `<option>${c}</option>`).join('')}</select></div>
      <button class="btn" id="add">Add task</button></div>
    <input id="se" type="search" maxlength="60" placeholder="Search tasks" aria-label="Search tasks">
    <div id="fl"></div><div class="list" id="ls"></div><button class="btn alt" id="cl">Clear completed</button><button class="btn alt" id="sh">Share checklist (text)</button>`;
  const today = dayKey(new Date());
  function draw() {
    $('#fl', el).innerHTML = segHtml([['all', 'All'], ...CATS_T.map(c => [c, c]), ['done', 'Done']], filter, { row: 'gap:6px;overflow-x:auto;padding-bottom:2px', btn: 'flex:none;padding:9px 14px' });
    const open = items.filter(t => !t.done).length;
    let v = items.filter(t => (filter === 'all' || (filter === 'done' ? t.done : t.cat === filter)) && (!q || t.text.toLowerCase().includes(q)));
    v.sort((a, b) => a.done - b.done || (a.due || '9') .localeCompare(b.due || '9') || b.at - a.at);
    $('#ls', el).innerHTML = (open ? `<div class="muted" style="font-size:13px;margin:0 4px">${open} open task${open > 1 ? 's' : ''}</div>` : '') + (v.map(t => {
      const over = t.due && !t.done && t.due < today;
      return `<div class="item" style="gap:8px;padding:6px 14px 6px 4px"><label style="display:grid;place-items:center;min-width:44px;min-height:44px;flex:none"><input type="checkbox" data-c="${t.id}" ${t.done ? 'checked' : ''} aria-label="Done: ${esc(t.text)}" style="width:26px;height:26px"></label>
        <span class="grow" style="${t.done ? 'opacity:.5;text-decoration:line-through' : ''}">${esc(t.text)}<br><small class="${over ? '' : 'muted'}" style="${over ? 'color:var(--danger);font-weight:600' : ''}">${esc(t.cat)}${t.due ? ' · ' + (t.due === today ? 'Today' : (over ? 'Overdue ' : '') + new Date(t.due + 'T00:00').toLocaleDateString([], { day: 'numeric', month: 'short' })) : ''}</small></span>
        <button class="btn alt" data-x="${t.id}" aria-label="Delete task: ${esc(t.text)}" style="padding:10px 12px;min-width:44px">✕</button></div>`;
    }).join('') || empty('✅', items.length ? 'Nothing matches.' : 'All clear. Add your first task above.'));
    $('#cl', el).hidden = !items.some(t => t.done);
  }
  $('#add', el).onclick = () => {
    const text = $('#tx', el).value.trim(); if (!text) { toast('Write a task first'); return; }
    if (items.length >= 500) {
      /* Make room by dropping the oldest finished task; an open task is never thrown away. */
      const di = items.findIndex(t => t.done);
      if (di < 0) { toast('The list is full (500 tasks). Finish or delete some tasks first.'); return; }
      items.splice(di, 1); toast('List is full: the oldest completed task was removed');
    }
    items.push({ id: uid(), text: text.slice(0, 100), due: $('#du', el).value, cat: $('#ct', el).value, done: false, at: Date.now() });
    save(); $('#tx', el).value = ''; $('#du', el).value = ''; draw();
  };
  $('#tx', el).onkeydown = (e) => { if (e.key === 'Enter') $('#add', el).click(); };
  $('#se', el).oninput = (e) => { q = e.target.value.trim().toLowerCase(); draw(); };
  $('#ls', el).onclick = (e) => {
    const c = e.target.closest('[data-c]'), x = e.target.closest('[data-x]');
    if (c) { const t = items.find(z => z.id === c.dataset.c); if (t) { t.done = c.checked; save(); } draw(); }
    if (x) { items = items.filter(z => z.id !== x.dataset.x); save(); draw(); }
  };
  $('#cl', el).onclick = () => { items = items.filter(t => !t.done); save(); draw(); };
  $('#sh', el).onclick = async () => {
    if (!items.length) { toast('Nothing to share yet. Add a task first.'); return; }
    const text = todoText(items.slice(0, 500), today);
    if (await shareText('To-do list ' + today, text)) toast('Checklist shared');
  };
  bindSeg($('#fl', el), (k) => { filter = k; draw(); });
  draw();
} });

/* ---------- 10. Battery & Network ---------- */
Tools.register({ id: 'devstatus', name: 'Battery & Network', icon: '🔋', cat: 'daily', desc: 'Live battery level and charging, online status, connection type and how much storage the app uses.', keys: ['power', 'charging', 'wifi', 'online', 'offline', 'storage', 'connection'], needs: ['network', 'storage'], render(el) {
  el.innerHTML = `<div class="card" style="${GRAD};display:flex;align-items:center;gap:18px;padding:20px">
      <div id="ring" style="width:110px;height:110px;border-radius:50%;display:grid;place-items:center;flex:none;background:var(--surface2)"><div style="width:84px;height:84px;border-radius:50%;background:var(--surface);display:grid;place-items:center;font-size:26px;font-weight:800" id="bp">--</div></div>
      <div><div style="font-weight:700;font-size:18px" id="bs">Battery</div><div class="muted" id="bt" style="margin-top:4px;font-size:14px"></div></div></div>
    <div class="card list" style="gap:0;padding:4px 14px" id="info"></div>
    <div class="card"><div class="row"><b>Storage used by apps in this browser</b></div><div class="progress" style="margin:10px 0 6px"><i id="sbar" style="width:0"></i></div><div class="muted" id="stt" style="font-size:13px">Checking...</div></div>
    ${sub('Values update live. Some details (battery, connection type) are hidden by certain browsers or devices and then show as not available.')}`;
  let bat = null;
  const row = (k, v) => `<div class="item" style="border:0;border-top:1px solid var(--line);border-radius:0;padding:13px 0"><span class="grow muted">${k}</span><b>${v}</b></div>`;
  function draw() {
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (bat) {
      const p = Math.round(bat.level * 100), col = bat.charging ? 'var(--ok)' : p <= 20 ? 'var(--danger)' : 'var(--accent)';
      $('#ring', el).style.background = `conic-gradient(${col} ${p}%,var(--surface2) 0)`; $('#bp', el).textContent = p + '%';
      $('#bs', el).textContent = bat.charging ? '⚡ Charging' : p <= 20 ? '🪫 Low battery' : '🔋 On battery';
      const fin = (s) => isFinite(s) && s > 0 ? Math.floor(s / 3600) + ' h ' + Math.round(s % 3600 / 60) + ' min' : null;
      const e = bat.charging ? fin(bat.chargingTime) : fin(bat.dischargingTime);
      $('#bt', el).textContent = e ? (bat.charging ? 'Full in about ' : 'About ') + e + (bat.charging ? '' : ' left') : (bat.charging && p >= 100 ? 'Fully charged' : 'Estimating time...');
    } else { $('#bp', el).textContent = '--'; $('#bs', el).textContent = 'Battery'; $('#bt', el).textContent = 'The battery details are not available here.'; }
    $('#info', el).innerHTML = [
      ['Network', navigator.onLine ? '<span style="color:var(--ok)">● Online</span>' : '<span style="color:var(--danger)">● Offline</span>'],
      ['Connection type', c && c.type ? esc(c.type) : 'n/a'],
      ['Speed class', c && c.effectiveType ? esc(c.effectiveType).toUpperCase() : 'n/a'],
      ['Downlink', c && c.downlink != null ? c.downlink + ' Mbit/s' : 'n/a'],
      ['Latency (RTT)', c && c.rtt != null ? c.rtt + ' ms' : 'n/a'],
      ['Data saver', c && c.saveData ? 'On' : 'Off']
    ].map(([k, v], i) => i ? row(k, v) : row(k, v).replace('border-top:1px solid var(--line);', '')).join('');
  }
  async function storage() {
    try {
      const e = await navigator.storage.estimate(), mb = (n) => (n / 1048576).toFixed(n > 1e8 ? 0 : 1) + ' MB';
      $('#sbar', el).style.width = Math.max(1, e.usage / e.quota * 100).toFixed(1) + '%';
      $('#stt', el).textContent = `${mb(e.usage)} used of about ${mb(e.quota)} available`;
    } catch (x) { $('#stt', el).textContent = 'Storage information is not available.'; }
  }
  const on = () => draw();
  window.addEventListener('online', on); window.addEventListener('offline', on);
  const c = navigator.connection; if (c && c.addEventListener) c.addEventListener('change', on);
  if (navigator.getBattery) navigator.getBattery().then(b => {
    bat = b; ['levelchange', 'chargingchange', 'chargingtimechange', 'dischargingtimechange'].forEach(ev => b.addEventListener(ev, on)); draw();
  }).catch(() => {});
  draw(); storage();
  const iv = setInterval(storage, 15000);
  return () => { clearInterval(iv); window.removeEventListener('online', on); window.removeEventListener('offline', on); if (c && c.removeEventListener) c.removeEventListener('change', on); if (bat) ['levelchange', 'chargingchange', 'chargingtimechange', 'dischargingtimechange'].forEach(ev => bat.removeEventListener(ev, on)); };
} });

/* ================= Extra everyday tools ================= */

/* ---------- Quick Timers ---------- */
Tools.register({ id: 'quicktimers', name: 'Quick Timers', icon: '🥚', cat: 'daily', desc: 'One-tap countdowns for eggs, tea, naps and workouts. Run several at once and get a notification when each ends.', keys: ['egg', 'tea', 'cooking', 'kitchen', 'countdown', 'preset', 'workout', 'nap'], needs: ['notifications', 'storage'], render(el) {
  const PRE = [['🥚', 'Soft egg', 6], ['🥚', 'Hard egg', 10], ['🍵', 'Tea', 3], ['☕', 'Coffee', 4], ['🍝', 'Pasta', 10], ['💪', 'Plank', 1], ['🏋️', 'Workout', 45], ['😴', 'Power nap', 20]];
  let run = Store.get('daily.qt', []), seq = Store.get('daily.qtseq', 1), alive = true;
  el.innerHTML = `<div class="grid" style="grid-template-columns:repeat(4,1fr);gap:10px">${PRE.map((p, i) => `<button class="btn alt" data-p="${i}" style="padding:12px 2px;display:flex;flex-direction:column;gap:4px;align-items:center;font-size:12px"><span style="font-size:26px">${p[0]}</span>${p[1]}<small class="muted">${p[2]} min</small></button>`).join('')}</div>
    <div class="card row" style="gap:8px"><input id="lb" type="text" maxlength="24" placeholder="Label" aria-label="Label"><input id="mn" type="number" min="1" max="999" inputmode="numeric" placeholder="min" aria-label="Minutes" style="flex:0 0 76px"><button class="btn" id="go" style="flex:0 0 auto">Start</button></div>
    <div style="${H2}">Running</div><div class="list" id="ls"></div>${sub(notesLine())}${blockedHtml()}`;
  const root = rootOf(el);
  const nid = (t) => t.nb != null ? t.nb : 760000 + (t.n % 900); // timers made before the id blocks keep their old ids
  const save = () => Store.set('daily.qt', run);
  async function add(label, mins) {
    mins = +mins;
    if (!(mins >= 1)) { toast('Enter minutes'); return false; }
    mins = Math.min(999, mins);
    if (run.length >= 20) { toast('Up to 20 timers at once'); return false; }
    const n = seq++;
    const t = { id: uid(), n, nb: noteId('qt', n), label: label || mins + ' min timer', endAt: Date.now() + mins * 60000, total: mins * 60000, done: false };
    Store.set('daily.qtseq', seq); run.push(t); save(); askWebNote(); draw();
    const ok = await notifyAt(nid(t), t.label, 'Time is up', t.endAt);
    if (alive) setBlocked(root, !alertsOk(ok));
    return true;
  }
  function draw() {
    $('#ls', el).innerHTML = run.map(t => {
      const left = t.endAt - Date.now(), pc = clamp(100 - left / t.total * 100, 0, 100);
      return `<div class="item" style="flex-wrap:wrap;gap:8px 12px;padding:14px"><span class="grow"><b>${esc(t.label)}</b><br><span data-l="${t.id}" style="font-size:26px;font-weight:800;font-variant-numeric:tabular-nums;${left <= 0 ? 'color:var(--ok)' : ''}">${left <= 0 ? 'Done' : fmtDur(left)}</span></span><button class="btn alt" data-x="${t.id}" aria-label="${left <= 0 ? 'Dismiss' : 'Cancel'} ${esc(t.label)}" style="padding:10px 14px;min-width:44px">${left <= 0 ? 'Dismiss' : 'Cancel'}</button><div class="progress" style="flex:1 0 100%"><i style="width:${pc}%"></i></div></div>`;
    }).join('') || empty('⏲️', 'Tap a preset to start a timer.');
  }
  function tick() {
    let changed = false;
    run.forEach(t => { if (!t.done && t.endAt <= Date.now()) { t.done = true; changed = true; beep(); webNote(t.label, 'Time is up'); toast('⏲️ ' + t.label + ' is done'); } });
    if (changed) { save(); draw(); return; }
    run.forEach(t => { const s = $(`[data-l="${t.id}"]`, el), left = t.endAt - Date.now(); if (s && left > 0) { s.textContent = fmtDur(left); s.closest('.item').querySelector('.progress i').style.width = (100 - left / t.total * 100) + '%'; } });
  }
  root.onclick = async (e) => {
    const p = e.target.closest('[data-p]'), x = e.target.closest('[data-x]');
    if (p) add(PRE[+p.dataset.p][1], PRE[+p.dataset.p][2]);
    if (x) { const t = run.find(z => z.id === x.dataset.x); if (!t) return; run = run.filter(z => z !== t); save(); await cancelNotes([nid(t)]); draw(); }
  };
  $('#go', el).onclick = async () => { if (await add($('#lb', el).value.trim(), $('#mn', el).value)) { $('#lb', el).value = ''; $('#mn', el).value = ''; } };
  probeBlocked(root);
  draw(); const iv = setInterval(tick, 500);
  return () => { alive = false; clearInterval(iv); };
} });

/* ---------- Clipboard Pad ---------- */
Tools.register({ id: 'clipboard', name: 'Clipboard Pad', icon: '📋', cat: 'daily', desc: 'Keep snippets you copy often, pin the important ones and copy them back with one tap.', keys: ['paste', 'snippets', 'copy', 'text', 'scratchpad', 'clips'], needs: ['storage'], render(el) {
  let clips = Store.get('daily.clips', []);
  const save = () => { const pinned = clips.filter(c => c.pin), rest = clips.filter(c => !c.pin).slice(0, 50 - pinned.length); clips = clips.filter(c => c.pin || rest.includes(c)); Store.set('daily.clips', clips); };
  el.innerHTML = `<div class="card list" style="gap:10px"><textarea id="tx" rows="4" maxlength="2000" placeholder="Type or paste something to keep..." aria-label="Clip text"></textarea>
      <div class="row"><button class="btn alt" id="ps">Paste</button><button class="btn" id="sv">Save clip</button></div></div>
    <div class="list" id="ls"></div>${sub('Only text you save here is kept, on this device. Android may ask permission before an app can read your clipboard.')}`;
  function draw() {
    const v = clips.slice().sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || b.at - a.at);
    $('#ls', el).innerHTML = v.map(c => `<div class="item" style="gap:10px;padding:12px 14px;align-items:flex-start"><span class="grow" data-c="${c.id}" style="white-space:pre-wrap;word-break:break-word;max-height:7.5em;overflow:hidden;cursor:pointer">${esc(c.t)}</span>
      <span style="display:flex;flex-direction:column;gap:6px"><button class="btn" data-c="${c.id}" style="padding:8px 12px;min-width:44px">Copy</button><span class="row" style="gap:6px"><button class="btn alt" data-p="${c.id}" aria-label="${c.pin ? 'Unpin' : 'Pin'} clip" aria-pressed="${!!c.pin}" style="padding:8px;min-width:44px">${c.pin ? '📌' : '📍'}</button><button class="btn alt" data-x="${c.id}" aria-label="Delete clip" style="padding:8px;min-width:44px">✕</button></span></span></div>`).join('') || empty('📋', 'Nothing saved yet.');
  }
  $('#ps', el).onclick = async () => { try { $('#tx', el).value = (await navigator.clipboard.readText()).slice(0, 2000); } catch (e) { toast('Paste with a long press in the box instead'); } };
  $('#sv', el).onclick = () => { const t = $('#tx', el).value.trim(); if (!t) { toast('Nothing to save'); return; } clips.unshift({ id: uid(), t, at: Date.now(), pin: false }); save(); $('#tx', el).value = ''; draw(); };
  $('#ls', el).onclick = (e) => {
    const c = e.target.closest('[data-c]'), p = e.target.closest('[data-p]'), x = e.target.closest('[data-x]');
    if (c) { const k = clips.find(z => z.id === c.dataset.c); if (k) copyText(k.t); }
    if (p) { const k = clips.find(z => z.id === p.dataset.p); k.pin = !k.pin; save(); draw(); }
    if (x) { clips = clips.filter(z => z.id !== x.dataset.x); save(); draw(); }
  };
  draw();
} });

/* ---------- Shopping List ---------- */
Tools.register({ id: 'shopping', name: 'Shopping List', icon: '🛒', cat: 'daily', desc: 'A shopping list with quantities, check-off while you shop and a quick clear for what is in the basket.', keys: ['groceries', 'buy', 'supermarket', 'list', 'market'], needs: ['storage'], render(el) {
  let items = Store.get('daily.shop', []);
  const save = () => Store.set('daily.shop', items);
  el.innerHTML = `<div class="card list" style="gap:10px"><div class="row"><input id="nm" type="text" maxlength="40" placeholder="Add an item" aria-label="Item"><input id="qt" type="number" min="1" max="99" value="1" inputmode="numeric" aria-label="Quantity" style="flex:0 0 64px"><button class="btn" id="add" style="flex:0 0 auto">Add</button></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">${['Milk', 'Bread', 'Eggs', 'Rice', 'Fruit', 'Water'].map(n => `<button class="btn alt" data-q="${n}" style="padding:6px 12px;font-size:13px;border-radius:99px">+ ${n}</button>`).join('')}</div></div>
    <div id="sm" class="muted" style="font-size:13px;margin:0 4px"></div><div class="list" id="ls"></div><button class="btn alt" id="cl">Remove checked items</button><button class="btn alt" id="sh">Share list (text)</button>`;
  const root = rootOf(el);
  function draw() {
    const v = items.slice().sort((a, b) => a.done - b.done || a.at - b.at), left = items.filter(i => !i.done).length;
    $('#sm', el).textContent = items.length ? `${left} to buy · ${items.length - left} in the basket` : '';
    $('#ls', el).innerHTML = v.map(i => `<div class="item" style="gap:4px 6px;padding:4px 10px 4px 4px;flex-wrap:wrap"><label style="display:grid;place-items:center;min-width:44px;min-height:44px;flex:none"><input type="checkbox" data-c="${i.id}" ${i.done ? 'checked' : ''} aria-label="In basket: ${esc(i.n)}" style="width:26px;height:26px"></label>
      <span class="grow" style="flex:1 1 90px;${i.done ? 'opacity:.5;text-decoration:line-through' : ''}">${esc(i.n)}</span>
      <span style="display:flex;align-items:center;gap:2px;margin-left:auto"><button class="btn alt" data-m="${i.id}" aria-label="Less ${esc(i.n)}" style="padding:0;min-width:44px">−</button><b style="min-width:24px;text-align:center" aria-label="Quantity ${i.q}">${i.q}</b><button class="btn alt" data-a="${i.id}" aria-label="More ${esc(i.n)}" style="padding:0;min-width:44px">+</button>
      <button class="btn alt" data-x="${i.id}" aria-label="Delete ${esc(i.n)}" style="padding:0;min-width:44px">✕</button></span></div>`).join('') || empty('🛒', 'Your list is empty.');
    $('#cl', el).hidden = !items.some(i => i.done);
  }
  const add = (n, q) => { n = n.trim().slice(0, 40); if (!n) { toast('Type an item'); return; } if (items.length >= 200 && !items.find(i => !i.done && i.n.toLowerCase() === n.toLowerCase())) { toast('Up to 200 items. Remove some first.'); return; } const f = items.find(i => !i.done && i.n.toLowerCase() === n.toLowerCase()); if (f) f.q = Math.min(99, f.q + q); else items.push({ id: uid(), n, q: clamp(q, 1, 99), done: false, at: Date.now() }); save(); draw(); };
  $('#add', el).onclick = () => { add($('#nm', el).value, Math.floor(+$('#qt', el).value) || 1); $('#nm', el).value = ''; $('#qt', el).value = 1; };
  $('#nm', el).onkeydown = (e) => { if (e.key === 'Enter') $('#add', el).click(); };
  root.addEventListener('click', (e) => {
    const q = e.target.closest('[data-q]'), c = e.target.closest('[data-c]'), m = e.target.closest('[data-m]'), a = e.target.closest('[data-a]'), x = e.target.closest('[data-x]');
    const f = (id) => items.find(i => i.id === id);
    if (q) return add(q.dataset.q, 1);
    if (c) f(c.dataset.c).done = c.checked; else if (m) { const i = f(m.dataset.m); i.q = Math.max(1, i.q - 1); } else if (a) { const i = f(a.dataset.a); i.q = Math.min(99, i.q + 1); } else if (x) items = items.filter(i => i.id !== x.dataset.x); else return;
    save(); draw();
  });
  $('#cl', el).onclick = () => { items = items.filter(i => !i.done); save(); draw(); };
  $('#sh', el).onclick = async () => {
    if (!items.length) { toast('Your list is empty, nothing to share.'); return; }
    const day = dayKey(new Date());
    if (await shareText('Shopping list ' + day, shopText(items.slice(0, 200), day))) toast('List shared');
  };
  draw();
} });

/* ---------- Expense Tracker ---------- */
Tools.register({ id: 'expenses', name: 'Expense Tracker', icon: '💸', cat: 'daily', desc: 'Log spending with categories and see the month total with a bar chart by category and by month.', keys: ['money', 'budget', 'spending', 'cost', 'finance', 'chart'], needs: ['storage'], render(el) {
  const EC = [['Food', '🍔', '#f59e0b'], ['Transport', '🚌', '#3b82f6'], ['Home', '🏠', '#22c55e'], ['Fun', '🎉', '#ec4899'], ['Health', '💊', '#ef4444'], ['Shopping', '🛍️', '#a855f7'], ['Bills', '🧾', '#06b6d4'], ['Other', '📦', '#84cc16']];
  let list = Store.get('daily.exp', []), cur = Store.get('daily.expcur', ''), vm = new Date(); vm.setDate(1);
  const save = () => Store.set('daily.exp', list);
  const money = (n) => (cur ? cur + ' ' : '') + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const moneyH = (n) => esc(money(n)); // the user's currency text must be escaped before it goes into innerHTML
  el.innerHTML = `<div class="card list" style="gap:10px"><div class="row"><input id="am" type="number" min="0.01" max="1000000000" step="0.01" inputmode="decimal" placeholder="Amount" aria-label="Amount"><select id="ct" aria-label="Category">${EC.map(c => `<option>${c[0]}</option>`).join('')}</select></div>
      <div class="row"><input id="nt" type="text" maxlength="40" placeholder="Note (optional)" aria-label="Note"><input id="dt" type="date" aria-label="Date" min="2000-01-01" max="2100-12-31" value="${dayKey(new Date())}"></div>
      <div class="row"><button class="btn" id="add">Add expense</button><input id="cu" type="text" maxlength="4" placeholder="Currency" aria-label="Currency symbol" value="${esc(cur)}" style="flex:0 0 88px"></div></div>
    <div class="row" style="gap:8px"><button class="btn alt" id="pv" aria-label="Previous month" style="flex:0 0 52px">‹</button><div id="mh" class="center" style="font-weight:700;font-size:17px"></div><button class="btn alt" id="nx" aria-label="Next month" style="flex:0 0 52px">›</button></div>
    <div class="card center" style="${GRAD}"><div class="muted" style="font-size:12px;letter-spacing:.08em;text-transform:uppercase">Month total</div><div id="tt" style="font-size:38px;font-weight:800;font-variant-numeric:tabular-nums"></div></div>
    <div class="card" id="bars"></div><div class="card"><div style="${H2};margin:0 0 8px">Last 6 months</div><canvas id="mc" style="height:150px;display:block"></canvas></div>
    <button class="btn alt" id="ex">Export all as CSV</button>
    <div class="list" id="ls"></div>`;
  const inMonth = (e, d) => e.date.startsWith(d.getFullYear() + '-' + pad(d.getMonth() + 1));
  function chart() {
    const cv = $('#mc', el), dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth || 300, Hh = cv.clientHeight || 150;
    cv.width = W * dpr; cv.height = Hh * dpr; const c = cv.getContext('2d'); c.scale(dpr, dpr);
    const cs = getComputedStyle(document.documentElement), ac = cs.getPropertyValue('--accent').trim(), mu = cs.getPropertyValue('--muted').trim();
    c.fillStyle = cs.getPropertyValue('--surface2').trim(); c.fillRect(0, 0, W, Hh);
    const ms = [...Array(6)].map((_, i) => { const d = new Date(vm.getFullYear(), vm.getMonth() - 5 + i, 1); return { d, v: list.filter(e => inMonth(e, d)).reduce((s, e) => s + e.amt, 0) }; });
    const mx = Math.max(...ms.map(m => m.v), 1), bw = W / 6;
    c.font = '11px system-ui'; c.textAlign = 'center';
    ms.forEach((m, i) => {
      const bh = (Hh - 40) * m.v / mx; c.fillStyle = i === 5 ? ac : ac + '77';
      c.beginPath(); c.roundRect ? c.roundRect(i * bw + bw * .2, Hh - 22 - bh, bw * .6, Math.max(bh, 2), 5) : c.rect(i * bw + bw * .2, Hh - 22 - bh, bw * .6, Math.max(bh, 2)); c.fill();
      c.fillStyle = mu; c.fillText(MONTHS[m.d.getMonth()].slice(0, 3), i * bw + bw / 2, Hh - 6);
      if (m.v) c.fillText(m.v >= 1000 ? Math.round(m.v / 100) / 10 + 'k' : Math.round(m.v), i * bw + bw / 2, Hh - 26 - bh);
    });
  }
  function draw() {
    $('#mh', el).textContent = MONTHS[vm.getMonth()] + ' ' + vm.getFullYear();
    const mine = list.filter(e => inMonth(e, vm)).sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at), total = mine.reduce((s, e) => s + e.amt, 0);
    $('#tt', el).textContent = money(total);
    const by = EC.map(c => [c, mine.filter(e => e.cat === c[0]).reduce((s, e) => s + e.amt, 0)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
    $('#bars', el).innerHTML = by.length ? by.map(([c, v]) => `<div style="margin:8px 0"><div class="row" style="font-size:14px"><span>${c[1]} ${c[0]}</span><b style="text-align:right">${moneyH(v)}</b></div><div class="progress" style="margin-top:4px"><i style="width:${v / by[0][1] * 100}%;background:${c[2]}"></i></div></div>`).join('') : '<div class="muted center">No spending this month.</div>';
    $('#ls', el).innerHTML = mine.map(e => { const c = EC.find(x => x[0] === e.cat) || EC[7]; return `<div class="item" style="gap:12px"><span style="font-size:22px">${c[1]}</span><span class="grow">${esc(e.note || e.cat)}<br><small class="muted">${new Date(e.date + 'T00:00').toLocaleDateString([], { day: 'numeric', month: 'short' })} · ${e.cat}</small></span><b>${moneyH(e.amt)}</b><button class="btn alt" data-x="${e.id}" aria-label="Delete expense ${esc(e.note || e.cat)}" style="padding:8px 10px;min-width:44px">✕</button></div>`; }).join('');
    chart();
  }
  $('#add', el).onclick = () => {
    const amt = Math.round((+$('#am', el).value) * 100) / 100; if (!(amt > 0)) { toast('Enter an amount'); return; }
    const date = /^\d{4}-\d{2}-\d{2}$/.test($('#dt', el).value) ? $('#dt', el).value : dayKey(new Date());
    if (list.length >= 5000) { toast('Up to 5000 expenses. Delete some old ones first.'); return; }
    list.push({ id: uid(), amt: Math.min(amt, 1e9), cat: $('#ct', el).value, note: $('#nt', el).value.trim().slice(0, 40), date, at: Date.now() });
    save(); $('#am', el).value = ''; $('#nt', el).value = ''; vm = new Date(date + 'T00:00'); vm.setDate(1); toast('Added'); draw();
  };
  $('#ex', el).onclick = () => {
    if (!list.length) { toast('No expenses to export yet. Add one first.'); return; }
    sendFile('expenses-' + dayKey(new Date()) + '.csv', '\uFEFF' + toCSV(expenseRows(list)), 'text/csv', 'Exported ' + list.length + ' expense' + (list.length === 1 ? '' : 's'));
  };
  $('#cu', el).oninput = (e) => { cur = e.target.value.trim(); Store.set('daily.expcur', cur); draw(); };
  $('#pv', el).onclick = () => { vm.setMonth(vm.getMonth() - 1); draw(); };
  $('#nx', el).onclick = () => { vm.setMonth(vm.getMonth() + 1); draw(); };
  $('#ls', el).onclick = (e) => { const x = e.target.closest('[data-x]'); if (x) { list = list.filter(z => z.id !== x.dataset.x); save(); draw(); } };
  draw();
} });

/* ---------- Tip of the Day ---------- */
Tools.register({ id: 'tipday', name: 'Tip of the Day', icon: '🌟', cat: 'daily', desc: 'A short thought or practical tip for each day, built in and available offline.', keys: ['quote', 'motivation', 'proverb', 'wisdom', 'inspiration', 'advice'], needs: [], render(el) {
  const TIPS = [
    ['Start with the smallest next step. Momentum does the rest.', 'Tip'], ['Drink a glass of water before your first coffee.', 'Tip'], ['A journey of a thousand miles begins with a single step.', 'Proverb'],
    ['Write tomorrow\'s top three tasks before you stop working today.', 'Tip'], ['If a task takes under two minutes, do it now.', 'Tip'], ['Slow is smooth, smooth is fast.', 'Saying'],
    ['Look away from the screen every 20 minutes and focus on something far away for 20 seconds.', 'Tip'], ['The best time to plant a tree was twenty years ago. The second best time is now.', 'Proverb'],
    ['Charge your phone overnight away from your bed for better sleep.', 'Tip'], ['Do one thing at a time. Multitasking is mostly task switching.', 'Tip'], ['Done is better than perfect.', 'Saying'],
    ['Keep a spare phone charger where you use it most.', 'Tip'], ['Take a five minute walk after meals. It helps digestion and clears the head.', 'Tip'], ['Many hands make light work.', 'Proverb'],
    ['Turn off notifications you do not act on within a day.', 'Tip'], ['Before buying something, wait 24 hours. Most urges fade.', 'Tip'], ['A calm mind is a quiet room: tidy your desk, tidy your thoughts.', 'Saying'],
    ['Back up your photos today. Future you will be grateful.', 'Tip'], ['Stand up and stretch for one minute every hour.', 'Tip'], ['It is not the mountain we conquer, but ourselves.', 'Saying'],
    ['Say thank you to someone today and mean it.', 'Tip'], ['Take the stairs when you can. Small habits add up.', 'Tip'], ['Rome was not built in a day.', 'Proverb'],
    ['Learn one new word in any language each day.', 'Tip'], ['Breathe in for four, hold for four, out for four. Repeat three times.', 'Tip'], ['What you do every day matters more than what you do once in a while.', 'Saying'],
    ['Use a strong, unique password for each account, and keep them in a password manager.', 'Tip'], ['Check tyre pressure once a month. It saves fuel and keeps you safe.', 'Tip'], ['Fall seven times, stand up eight.', 'Proverb'],
    ['Eat a little slower. You will notice when you are full.', 'Tip'], ['Put your keys and wallet in the same place every time.', 'Tip'], ['Every expert was once a beginner.', 'Saying'],
    ['Leave ten minutes early. Calm travel beats fast travel.', 'Tip'], ['Read ten pages before bed instead of scrolling.', 'Tip'], ['Do not wait for motivation. Start, and it will follow.', 'Tip'], ['A good laugh is the cheapest medicine.', 'Saying']
  ];
  let i = (dayOfYear(new Date()) * 7) % TIPS.length, shown = i;
  el.innerHTML = `<div class="card center" style="${GRAD};padding:34px 20px"><div style="font-size:44px">🌟</div><div id="tx" style="font-size:21px;font-weight:600;line-height:1.4;margin:14px 0 10px;min-height:5.6em;display:flex;align-items:center;justify-content:center"></div><div id="ty" class="muted" style="font-size:13px;letter-spacing:.08em;text-transform:uppercase"></div></div>
    <div class="row"><button class="btn alt" id="pv">‹ Previous</button><button class="btn alt" id="rn">Surprise me</button><button class="btn alt" id="nx">Next ›</button></div>
    <div class="row"><button class="btn alt" id="cp">Copy</button><button class="btn" id="sh">Share</button></div>
    <div class="muted center" id="dn" style="font-size:13px"></div>`;
  function draw() {
    $('#tx', el).textContent = TIPS[i][0]; $('#ty', el).textContent = TIPS[i][1];
    $('#dn', el).textContent = i === shown ? 'Today\'s pick · ' + new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' }) : 'Tip ' + (i + 1) + ' of ' + TIPS.length;
  }
  $('#pv', el).onclick = () => { i = (i + TIPS.length - 1) % TIPS.length; draw(); };
  $('#nx', el).onclick = () => { i = (i + 1) % TIPS.length; draw(); };
  $('#rn', el).onclick = () => { i = Math.floor(Math.random() * TIPS.length); draw(); };
  $('#cp', el).onclick = () => copyText(TIPS[i][0]); $('#sh', el).onclick = () => shareText('Tip of the day', TIPS[i][0]);
  draw();
} });

/* ---------- Calendar ---------- */
Tools.register({ id: 'calendar', name: 'Calendar', icon: '🗓️', cat: 'daily', desc: 'A clean month view with ISO week numbers, day-of-year, and a days-between-dates calculator.', keys: ['month', 'week number', 'date', 'days between', 'planner'], needs: [], render(el) {
  const now = new Date(); let vm = new Date(now.getFullYear(), now.getMonth(), 1), sel = new Date(now.getFullYear(), now.getMonth(), now.getDate()), mon = Store.get('daily.calmon', true);
  el.innerHTML = `<div class="row" style="gap:8px"><button class="btn alt" id="pv" aria-label="Previous month" style="flex:0 0 52px">‹</button><button class="btn alt" id="tdy" style="font-weight:700;font-size:17px"></button><button class="btn alt" id="nx" aria-label="Next month" style="flex:0 0 52px">›</button></div>
    <div class="card" style="padding:10px 8px"><div id="gr"></div></div>
    <div class="card center" id="inf" style="${GRAD}"></div>
    <label class="item" style="min-height:48px"><span class="grow">Week starts on Monday</span><input type="checkbox" id="mo" ${mon ? 'checked' : ''} style="width:22px;height:22px"></label>
    <div style="${H2}">Days between two dates</div>
    <div class="card list" style="gap:10px"><div class="row"><input id="d1" type="date" aria-label="From" min="1900-01-01" max="2200-12-31" value="${dayKey(now)}"><input id="d2" type="date" aria-label="To" min="1900-01-01" max="2200-12-31"></div><div id="df" class="center" style="font-weight:600;min-height:24px"></div></div>`;
  function draw() {
    $('#tdy', el).textContent = MONTHS[vm.getMonth()] + ' ' + vm.getFullYear();
    const first = new Date(vm.getFullYear(), vm.getMonth(), 1), lead = (first.getDay() - (mon ? 1 : 0) + 7) % 7, dim = daysInMonth(vm.getFullYear(), vm.getMonth());
    const names = mon ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    let cells = '<div class="muted center" style="font-size:11px">Wk</div>' + names.map(n => `<div class="muted center" style="font-size:12px;font-weight:700">${n}</div>`).join('');
    const total = Math.ceil((lead + dim) / 7) * 7;
    for (let k = 0; k < total; k++) {
      if (k % 7 === 0) { const rd = new Date(vm.getFullYear(), vm.getMonth(), k - lead + 1 + (mon ? 0 : 1)); cells += `<div class="muted center" style="font-size:11px;align-self:center">${isoWeek(rd)}</div>`; }
      const dn = k - lead + 1;
      if (dn < 1 || dn > dim) { cells += '<div></div>'; continue; }
      const d = new Date(vm.getFullYear(), vm.getMonth(), dn), isT = dayKey(d) === dayKey(now), isS = dayKey(d) === dayKey(sel);
      cells += `<button data-d="${dn}" aria-label="${d.toDateString()}" style="height:42px;border:2px solid ${isS ? 'var(--accent)' : 'transparent'};border-radius:12px;background:${isT ? 'var(--accent)' : 'none'};color:${isT ? 'var(--accent-t)' : 'var(--text)'};font-weight:${isT ? 700 : 500}">${dn}</button>`;
    }
    $('#gr', el).innerHTML = `<div style="display:grid;grid-template-columns:30px repeat(7,1fr);gap:3px">${cells}</div>`;
    const dd = Math.round((new Date(sel.getFullYear(), sel.getMonth(), sel.getDate()) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
    $('#inf', el).innerHTML = `<div style="font-size:19px;font-weight:700">${sel.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div><div class="muted" style="margin-top:4px">Week ${isoWeek(sel)} · day ${dayOfYear(sel)} of the year · ${dd === 0 ? 'today' : dd > 0 ? 'in ' + dd + ' day' + (dd > 1 ? 's' : '') : -dd + ' day' + (dd < -1 ? 's' : '') + ' ago'}</div>`;
  }
  function diff() {
    const a = $('#d1', el).value, b = $('#d2', el).value; if (!a || !b) { $('#df', el).textContent = 'Pick two dates'; return; }
    const n = Math.round((new Date(b + 'T00:00') - new Date(a + 'T00:00')) / 86400000), ab = Math.abs(n);
    $('#df', el).textContent = `${ab} day${ab === 1 ? '' : 's'} (${Math.floor(ab / 7)} weeks${ab % 7 ? ' and ' + ab % 7 + ' days' : ''})${n < 0 ? ' earlier' : ''}`;
  }
  $('#pv', el).onclick = () => { vm.setMonth(vm.getMonth() - 1); draw(); }; $('#nx', el).onclick = () => { vm.setMonth(vm.getMonth() + 1); draw(); };
  $('#tdy', el).onclick = () => { vm = new Date(now.getFullYear(), now.getMonth(), 1); sel = new Date(now.getFullYear(), now.getMonth(), now.getDate()); draw(); };
  $('#gr', el).onclick = (e) => { const b = e.target.closest('[data-d]'); if (b) { sel = new Date(vm.getFullYear(), vm.getMonth(), +b.dataset.d); draw(); } };
  $('#mo', el).onchange = (e) => { mon = e.target.checked; Store.set('daily.calmon', mon); draw(); };
  $('#d1', el).oninput = diff; $('#d2', el).oninput = diff;
  draw(); diff();
} });

/* ---------- Birthdays ---------- */
Tools.register({ id: 'birthdays', name: 'Birthdays', icon: '🎂', cat: 'daily', desc: 'Remember birthdays and anniversaries, see who is next and get a yearly morning reminder.', keys: ['anniversary', 'reminder', 'party', 'age', 'celebrate'], needs: ['notifications', 'storage'], render(el) {
  let list = Store.get('daily.bdays', []), seq = Store.get('daily.bseq', 1);
  const save = () => Store.set('daily.bdays', list);
  el.innerHTML = `<div class="card list" style="gap:10px"><input id="nm" type="text" maxlength="30" placeholder="Name" aria-label="Name">
      <div class="row"><select id="mo" aria-label="Month">${MONTHS.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('')}</select><input id="dy" type="number" min="1" max="31" inputmode="numeric" placeholder="Day" aria-label="Day" style="flex:0 0 72px"><input id="yr" type="number" min="1900" max="2100" inputmode="numeric" placeholder="Year?" aria-label="Birth year (optional)" style="flex:0 0 88px"></div>
      <label class="item" style="min-height:48px"><span class="grow">Remind me at 9:00 each year</span><input type="checkbox" id="rm" checked style="width:22px;height:22px"></label><button class="btn" id="add">Add birthday</button></div>
    ${blockedHtml()}<div class="list" id="ls"></div>${sub(notesLine() + ' A 29 February birthday is counted on 28 February in years that are not leap years; its reminder is renewed each time you open this tool.')}`;
  const nid = (b) => b.nb != null ? b.nb : 770000 + (b.n % 9000); // birthdays saved before the id blocks keep their old ids
  const isLeapDay = (b) => b.m === 2 && b.d === 29;
  /* Next 9:00 on the birthday; a plain Date would roll 29 Feb over to 1 March. */
  function nextBdayAt(b, now) {
    let t = bdayDate(now.getFullYear(), b.m, b.d); t.setHours(9, 0, 0, 0);
    if (t <= now) { t = bdayDate(now.getFullYear() + 1, b.m, b.d); t.setHours(9, 0, 0, 0); }
    return t;
  }
  /* The yearly repeat of Android only fires on a real 29 Feb, so leap-day birthdays get a single notification for the next
     occurrence, renewed every time the tool opens. Returns true when Android accepted it (or there is nothing to schedule). */
  async function remind(b) {
    if (!LN() || !b.rem) return true;
    const title = '🎂 ' + b.name, body = 'It is ' + b.name + '\'s birthday today';
    return isLeapDay(b) ? notifySchedule(nid(b), title, body, { at: nextBdayAt(b, new Date()) })
      : notifySchedule(nid(b), title, body, { on: { month: b.m, day: b.d, hour: 9, minute: 0 } });
  }
  function draw() {
    const now = new Date(), v = list.map(b => Object.assign({ u: daysUntil(b.m, b.d, now) }, b)).sort((a, b) => a.u.days - b.u.days);
    $('#ls', el).innerHTML = v.map(b => {
      const age = b.y ? b.u.date.getFullYear() - b.y : 0;
      const feb29 = isLeapDay(b) && !isLeap(b.u.date.getFullYear()) ? ' (28 Feb this year)' : '';
      return `<div class="item" style="gap:12px;padding:12px 14px"><span style="font-size:26px">${b.u.days === 0 ? '🎉' : '🎂'}</span><span class="grow"><b>${esc(b.name)}</b><br><small class="muted">${b.d} ${MONTHS[b.m - 1]}${feb29}${age > 0 ? ' · turns ' + age : ''}</small></span>
        <span style="text-align:right;font-weight:700;${b.u.days === 0 ? 'color:var(--ok)' : ''}">${b.u.days === 0 ? 'Today!' : b.u.days === 1 ? 'Tomorrow' : 'in ' + b.u.days + ' d'}</span><button class="btn alt" data-x="${b.id}" aria-label="Delete ${esc(b.name)}" style="padding:8px 10px;min-width:44px">✕</button></div>`;
    }).join('') || empty('🎂', 'No birthdays yet.');
  }
  $('#add', el).onclick = async () => {
    const name = $('#nm', el).value.trim(), m = +$('#mo', el).value, d = Math.floor(+$('#dy', el).value), y = Math.floor(+$('#yr', el).value) || 0;
    if (!name) { toast('Enter a name'); return; } if (list.length >= 200) { toast('Up to 200 birthdays'); return; } if (!(d >= 1 && d <= daysInMonth(2024, m - 1))) { toast('Enter a valid day'); return; }
    const n = seq++, b = { id: uid(), n, nb: noteId('bday', n), name, m, d, y: y >= 1900 && y <= 2100 ? y : 0, rem: $('#rm', el).checked };
    Store.set('daily.bseq', seq); list.push(b); save(); $('#nm', el).value = ''; $('#dy', el).value = ''; $('#yr', el).value = ''; draw();
    const ok = await remind(b);
    if (b.rem) { setBlocked(el, !alertsOk(ok)); if (!alertsOk(ok)) toast('Saved, but notifications are blocked'); }
  };
  $('#ls', el).onclick = async (e) => { const x = e.target.closest('[data-x]'); if (x) { const b = list.find(z => z.id === x.dataset.x); if (!b) return; list = list.filter(z => z !== b); save(); draw(); await cancelNotes([nid(b)]); } };
  probeBlocked(el);
  /* Leap-day reminders are one-shot, so renew them quietly (only if notifications are already allowed). */
  const leap = list.filter(b => b.rem && isLeapDay(b));
  if (leap.length && LN() && LN().checkPermissions) LN().checkPermissions().then(p => { if (p.display === 'granted') leap.forEach(remind); }).catch(() => {});
  draw();
} });

/* ---------- Multi Stopwatch ---------- */
Tools.register({ id: 'multiwatch', name: 'Multi Stopwatch', icon: '🏃', cat: 'daily', desc: 'One clock for several runners: tap each runner to record a lap and see last and best laps.', keys: ['race', 'laps', 'runners', 'swim', 'track', 'split', 'team'], needs: [], render(el) {
  let runners = [1, 2, 3].map(n => ({ name: 'Runner ' + n, laps: [] })), t0 = 0, acc = 0, iv = null;
  const now = () => acc + (iv ? Date.now() - t0 : 0);
  el.innerHTML = `<div class="card center" style="${GRAD}"><div class="big" id="d" style="margin:4px 0">00:00.00</div></div>
    <div class="row"><button class="btn" id="go">Start</button><button class="btn alt" id="rs">Reset</button></div>
    <div class="list" id="ls"></div><div class="row"><input id="nm" type="text" maxlength="20" placeholder="Add a runner" aria-label="Runner name"><button class="btn alt" id="add" style="flex:0 0 auto">Add</button></div>
    ${sub('Tap a runner while the clock runs to record a lap. Times come from the phone clock, so they stay accurate.')}`;
  const total = (r) => r.laps.reduce((s, l) => s + l, 0);
  function draw() {
    $('#ls', el).innerHTML = runners.map((r, i) => {
      const best = r.laps.length ? Math.min(...r.laps) : 0;
      return `<div class="item" style="gap:12px;padding:12px 14px"><span class="grow"><b>${esc(r.name)}</b><br><small class="muted">${r.laps.length ? `Lap ${r.laps.length}: <b>${fmt(r.laps[r.laps.length - 1], true)}</b> · best ${fmt(best, true)}<br>Total ${fmt(total(r), true)}` : 'No laps yet'}</small></span>
        <button class="btn" data-l="${i}" style="min-width:76px;padding:16px 10px">Lap</button><button class="btn alt" data-x="${i}" aria-label="Remove ${esc(r.name)}" style="padding:8px 10px;min-width:44px">✕</button></div>`;
    }).join('') || empty('🏃', 'Add a runner to begin.');
  }
  const paint = () => { $('#d', el).textContent = fmt(now(), true); };
  $('#go', el).onclick = () => { if (iv) { acc = now(); clearInterval(iv); iv = null; $('#go', el).textContent = 'Resume'; } else { t0 = Date.now(); iv = setInterval(paint, 40); $('#go', el).textContent = 'Stop'; } };
  $('#rs', el).onclick = () => { clearInterval(iv); iv = null; acc = 0; runners.forEach(r => { r.laps = []; }); $('#go', el).textContent = 'Start'; paint(); draw(); };
  $('#add', el).onclick = () => { const n = $('#nm', el).value.trim() || 'Runner ' + (runners.length + 1); if (runners.length >= 12) { toast('Up to 12 runners'); return; } runners.push({ name: n.slice(0, 20), laps: [] }); $('#nm', el).value = ''; draw(); };
  $('#ls', el).onclick = (e) => {
    const l = e.target.closest('[data-l]'), x = e.target.closest('[data-x]');
    if (l) { if (!iv) { toast('Start the clock first'); return; } const r = runners[+l.dataset.l], lap = now() - total(r); r.laps.push(lap); if (navigator.vibrate) navigator.vibrate(30); draw(); }
    if (x) { runners.splice(+x.dataset.x, 1); draw(); }
  };
  draw();
  return () => clearInterval(iv);
} });

/* ---------- Moon Phase ---------- */
Tools.register({ id: 'moonphase', name: 'Moon Phase', icon: '🌙', cat: 'daily', desc: 'See the moon\'s phase, age and lit fraction for any date, with the next new and full moon.', keys: ['lunar', 'full moon', 'new moon', 'astronomy', 'night sky'], needs: [], render(el) {
  let date = new Date();
  el.innerHTML = `<div class="card center" style="background:linear-gradient(160deg,#10163a,#1d2550);color:#fff;border-color:transparent"><canvas id="mc" width="240" height="240" style="width:210px;height:210px;background:none;border:0;display:block;margin:6px auto"></canvas><div id="nm" style="font-size:24px;font-weight:800"></div><div id="il" style="opacity:.75;margin-top:2px"></div></div>
    <div class="card list" style="gap:2px;padding:4px 14px" id="inf"></div>
    <div class="row"><button class="btn alt" id="pv" aria-label="Previous day">‹ Day</button><input id="dt" type="date" aria-label="Date" min="1900-01-01" max="2200-12-31"><button class="btn alt" id="nx" aria-label="Next day">Day ›</button></div>
    <button class="btn alt" id="td">Today</button>${sub('Calculated from the average length of the lunar month, so the date of a phase can be off by up to half a day. The picture shows the northern hemisphere view.')}`;
  function paintMoon(frac) {
    const cv = $('#mc', el), c = cv.getContext('2d'), R = 100, cx = 120, cy = 120;
    c.clearRect(0, 0, 240, 240);
    c.fillStyle = '#2a3158'; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fill();
    const k = Math.cos(2 * Math.PI * frac); c.fillStyle = '#f6efd5';
    for (let y = -R; y < R; y += 1) {
      const w = Math.sqrt(R * R - y * y), a = frac < 0.5 ? k * w : -w, b = frac < 0.5 ? w : -k * w;
      if (b > a) c.fillRect(cx + a, cy + y, b - a, 1.4);
    }
    c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.stroke();
  }
  function draw() {
    const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12), mi = moonInfo(noon);
    paintMoon(mi.frac);
    $('#nm', el).textContent = mi.icon + ' ' + mi.name; $('#il', el).textContent = Math.round(mi.illum * 100) + '% illuminated';
    $('#dt', el).value = dayKey(date);
    const f = (d) => d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
    const rows = [['Moon age', mi.age.toFixed(1) + ' days'], ['Next new moon', f(nextPhase(noon, 0))], ['Next full moon', f(nextPhase(noon, 0.5))], ['Next first quarter', f(nextPhase(noon, 0.25))], ['Next last quarter', f(nextPhase(noon, 0.75))]];
    $('#inf', el).innerHTML = rows.map(([k, v], i) => `<div class="item" style="border:0;${i ? 'border-top:1px solid var(--line);' : ''}border-radius:0;padding:12px 0"><span class="grow muted">${k}</span><b>${v}</b></div>`).join('');
  }
  const shift = (n) => { date = new Date(date.getFullYear(), date.getMonth(), date.getDate() + n); draw(); };
  $('#pv', el).onclick = () => shift(-1); $('#nx', el).onclick = () => shift(1); $('#td', el).onclick = () => { date = new Date(); draw(); };
  $('#dt', el).onchange = (e) => { if (e.target.value) { date = new Date(e.target.value + 'T12:00'); draw(); } };
  draw();
} });

/* ---------- Sunrise & Sunset ---------- */
Tools.register({ id: 'suntimes', name: 'Sunrise & Sunset', icon: '🌅', cat: 'navigate', desc: 'Sunrise, sunset, solar noon and day length for any place and date, worked out on the device from coordinates.', keys: ['sun', 'dawn', 'dusk', 'twilight', 'daylight', 'golden hour', 'solar'], needs: ['location'], render(el) {
  const st = Object.assign({ lat: 51.5074, lon: -0.1278 }, Store.get('daily.sunloc', {}));
  el.innerHTML = `<div class="card center" style="${GRAD};padding:20px"><div id="ic" style="font-size:44px">🌅</div><div id="dl" style="font-size:30px;font-weight:800;margin:4px 0"></div><div class="muted" id="ds"></div><div class="progress" style="margin:14px 10px 0"><i id="pg" style="width:0"></i></div></div>
    <div class="card list" style="gap:2px;padding:4px 14px" id="inf"></div>
    <div class="card list" style="gap:10px"><div class="row"><label class="f">Latitude<input id="la" type="number" min="-90" max="90" step="any" inputmode="decimal" value="${st.lat}"></label><label class="f">Longitude<input id="lo" type="number" min="-180" max="180" step="any" inputmode="decimal" value="${st.lon}"></label></div>
      <div class="row"><input id="dt" type="date" aria-label="Date" min="1900-01-01" max="2200-12-31" value="${dayKey(new Date())}"><button class="btn alt" id="me">Use my location</button></div></div>
    ${sub('Times are shown in this phone\'s time zone. North is positive, east is positive. Accurate to about a minute outside the polar regions.')}`;
  const root = rootOf(el);
  const tm = (d) => d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';
  function draw() {
    const lat = clamp(+$('#la', el).value || 0, -90, 90), lon = clamp(+$('#lo', el).value || 0, -180, 180), v = $('#dt', el).value;
    const [y, m, d] = (v || dayKey(new Date())).split('-').map(Number);
    Store.set('daily.sunloc', { lat, lon });
    const s = sunTimes(y, m, d, lat, lon), cv = sunTimes(y, m, d, lat, lon, 96);
    let len = '--', desc = '', pg = 0;
    if (s.polar) { len = s.polar === 'day' ? '24 h' : '0 h'; desc = s.polar === 'day' ? 'Midnight sun: the sun does not set' : 'Polar night: the sun does not rise'; pg = s.polar === 'day' ? 100 : 0; }
    else { const mins = Math.round((s.set - s.rise) / 60000); len = Math.floor(mins / 60) + ' h ' + pad(mins % 60) + ' min'; desc = 'of daylight'; pg = clamp((Date.now() - s.rise) / (s.set - s.rise) * 100, 0, 100); }
    $('#dl', el).textContent = len; $('#ds', el).textContent = desc; $('#pg', el).style.width = pg + '%';
    $('#ic', el).textContent = s.polar === 'night' ? '🌑' : '🌅';
    const rows = [['🌅 Sunrise', tm(s.rise)], ['☀️ Solar noon', tm(s.noon)], ['🌇 Sunset', tm(s.set)], ['Civil dawn', tm(cv.rise)], ['Civil dusk', tm(cv.set)]];
    $('#inf', el).innerHTML = rows.map(([k, val], i) => `<div class="item" style="border:0;${i ? 'border-top:1px solid var(--line);' : ''}border-radius:0;padding:13px 0"><span class="grow">${k}</span><b style="font-size:18px">${val}</b></div>`).join('');
  }
  root.oninput = draw;
  $('#me', el).onclick = () => {
    if (!navigator.geolocation) { toast('No location support'); return; }
    toast('Finding you...');
    navigator.geolocation.getCurrentPosition(p => { $('#la', el).value = p.coords.latitude.toFixed(4); $('#lo', el).value = p.coords.longitude.toFixed(4); draw(); }, e => toast(gpsMsg(e)), { enableHighAccuracy: false, timeout: 20000, maximumAge: 600000 });
  };
  draw();
} });

/* ---------- Meeting Planner ---------- */
Tools.register({ id: 'meetingplanner', name: 'Meeting Planner', icon: '🤝', cat: 'daily', desc: 'Compare working hours across time zones side by side and find the hours that suit everyone.', keys: ['time zone', 'call', 'schedule', 'overlap', 'remote', 'international'], needs: ['storage'], render(el) {
  const localZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  let zones = Store.get('daily.mzones', [{ n: 'London', z: 'Europe/London' }, { n: 'Tokyo', z: 'Asia/Tokyo' }]), day = dayKey(new Date());
  el.innerHTML = `<div class="row"><input id="cs" type="text" list="cl" placeholder="Add a city" aria-label="City" maxlength="40" autocomplete="off"><button class="btn" id="add" style="flex:0 0 auto">Add</button></div>
    <datalist id="cl">${CITIES.map(c => `<option value="${esc(c[0])}"></option>`).join('')}</datalist>
    <input id="dt" type="date" aria-label="Day" min="1970-01-01" max="2100-12-31" value="${day}"><div class="card list" style="gap:12px" id="gr"></div>
    <div class="card" id="bw"></div>
    ${sub('Rows show the local hour in each place for the 24 hours of your chosen day. <span style="color:var(--ok);font-weight:700">Green</span> is 9 to 17, <span style="color:#f59e0b;font-weight:700">amber</span> is early or late, grey is night.')}`;
  const save = () => Store.set('daily.mzones', zones);
  const hourIn = (z, d) => +new Intl.DateTimeFormat('en-US', { timeZone: z, hour: 'numeric', hourCycle: 'h23' }).format(d) % 24;
  function draw() {
    const [y, m, d] = ($('#dt', el).value || day).split('-').map(Number), all = [{ n: 'You', z: localZ }, ...zones], base = new Date();
    const hrs = all.map(zn => [...Array(24)].map((_, h) => { try { return hourIn(zn.z, new Date(y, m - 1, d, h)); } catch (e) { return h; } }));
    const kind = (x) => x >= 9 && x < 17 ? 0 : (x >= 7 && x < 22 ? 1 : 2);
    $('#gr', el).innerHTML = all.map((zn, i) => {
      let off = 0; try { off = tzOffsetMin(zn.z, base); } catch (e) {}
      return `<div><div class="row" style="font-size:14px;margin-bottom:5px"><b>${esc(zn.n)} <small class="muted" style="font-weight:400">${offLabel(off)}</small></b>${i ? `<button class="btn alt" data-x="${i - 1}" aria-label="Remove ${esc(zn.n)}" style="flex:0 0 auto;padding:0 10px;min-width:44px;min-height:44px">✕</button>` : '<span></span>'}</div>
        <div style="display:flex;gap:1px">${hrs[i].map(x => `<div style="flex:1;height:30px;border-radius:3px;display:grid;place-items:center;font-size:9px;font-weight:600;background:${['color-mix(in srgb,var(--ok) 55%,var(--surface))', 'color-mix(in srgb,#f59e0b 45%,var(--surface))', 'var(--surface2)'][kind(x)]};color:${kind(x) === 2 ? 'var(--muted)' : 'var(--text)'}">${x}</div>`).join('')}</div></div>`;
    }).join('');
    const good = [...Array(24)].map((_, h) => hrs.every(r => kind(r[h]) === 0));
    const wins = []; let s = -1;
    good.forEach((g, h) => { if (g && s < 0) s = h; if ((!g || h === 23) && s >= 0) { wins.push([s, g ? 24 : h]); s = -1; } });
    $('#bw', el).innerHTML = `<b>Best time for everyone</b><div style="margin-top:6px;font-size:15px">${wins.length ? wins.map(w => `<div style="padding:4px 0">🟢 ${pad(w[0])}:00 to ${pad(w[1] % 24)}:00 <span class="muted">your time</span></div>`).join('') : '<span class="muted">No hour is inside 9 to 17 for every place. Check the amber hours or pick another day.</span>'}</div>`;
  }
  $('#add', el).onclick = () => {
    const q = $('#cs', el).value.trim().toLowerCase(), c = CITIES.find(x => x[0].toLowerCase() === q) || CITIES.find(x => x[0].toLowerCase().includes(q));
    if (!q || !c) { toast('Pick a city from the list'); return; } if (zones.length >= 5) { toast('Up to 5 places'); return; } if (zones.some(z => z.z === c[1])) { toast('Already added'); return; }
    zones.push({ n: c[0], z: c[1] }); save(); $('#cs', el).value = ''; draw();
  };
  $('#dt', el).onchange = draw;
  $('#gr', el).onclick = (e) => { const x = e.target.closest('[data-x]'); if (x) { zones.splice(+x.dataset.x, 1); save(); draw(); } };
  draw();
} });

/* ---------- Typing Speed ---------- */
Tools.register({ id: 'typingtest', name: 'Typing Speed', icon: '⌨️', cat: 'fun', desc: 'Measure your typing speed in words per minute with accuracy and a personal best.', keys: ['wpm', 'keyboard', 'speed test', 'practice', 'type'], needs: ['storage'], render(el) {
  const TXT = ['The quick brown fox jumps over the lazy dog while the sun sets slowly behind the quiet hills.', 'Good habits are built one small step at a time, and every step forward counts more than waiting for a perfect start.',
    'A clear desk and a calm mind make it easier to finish the work in front of you before the day is over.', 'Travel light, ask for directions, and remember that the best stories often begin with a wrong turn.',
    'Water the plants, send that message, take a short walk, and leave a little time for doing nothing at all.', 'Practice makes progress, and progress makes patience easier, so keep your eyes on the next word and keep typing.'];
  let target = '', t0 = 0, secs = 30, iv = null, over = false, best = Store.get('daily.typebest', 0), prev = '';
  el.innerHTML = `<div id="tabs">${segHtml([['30', '30 seconds'], ['60', '60 seconds']], '30')}</div>
    <div class="card row center" style="gap:0"><div><div class="mid" id="wp">0</div><small class="muted">WPM</small></div><div><div class="mid" id="ac">100%</div><small class="muted">Accuracy</small></div><div><div class="mid" id="tl">30</div><small class="muted">Seconds</small></div></div>
    <div class="card" id="ps" style="font-size:19px;line-height:1.7;letter-spacing:.2px;word-break:break-word"></div>
    <textarea id="in" rows="3" maxlength="400" placeholder="Start typing here to begin..." aria-label="Type the text above" autocapitalize="off" autocomplete="off" spellcheck="false" style="font-size:17px"></textarea>
    <div class="card center" id="rs" hidden></div><button class="btn" id="nw">New text</button><div class="muted center" id="bs" style="font-size:13px"></div>`;
  function show(typed) {
    $('#ps', el).innerHTML = [...target].map((ch, i) => {
      const c = i < typed.length ? (typed[i] === ch ? 'color:var(--ok)' : 'color:var(--danger);background:color-mix(in srgb,var(--danger) 18%,transparent);border-radius:3px') : (i === typed.length ? 'border-bottom:2px solid var(--accent)' : 'color:var(--muted)');
      return `<span style="${c}">${esc(ch)}</span>`;
    }).join('');
  }
  function reset() {
    clearInterval(iv); iv = null; t0 = 0; over = false; prev = ''; target = TXT[Math.floor(Math.random() * TXT.length)]; if (secs === 60) target += ' ' + TXT[Math.floor(Math.random() * TXT.length)];
    $('#in', el).value = ''; $('#in', el).disabled = false; $('#rs', el).hidden = true; $('#wp', el).textContent = 0; $('#ac', el).textContent = '100%'; $('#tl', el).textContent = secs;
    $('#bs', el).textContent = best ? 'Personal best: ' + best + ' WPM' : ''; show('');
  }
  function finish() {
    clearInterval(iv); iv = null; over = true; const typed = $('#in', el).value, s = typingStats(target, typed, Math.min(Date.now() - t0, secs * 1000));
    $('#in', el).disabled = true; $('#wp', el).textContent = s.wpm; $('#ac', el).textContent = s.acc + '%';
    const nb = s.wpm > best && s.acc >= 80; if (nb) { best = s.wpm; Store.set('daily.typebest', best); }
    $('#rs', el).hidden = false; $('#rs', el).innerHTML = `<div style="font-size:30px">${nb ? '🏆' : '👏'}</div><div style="font-size:20px;font-weight:700">${s.wpm} WPM at ${s.acc}% accuracy</div><div class="muted">${nb ? 'New personal best!' : 'Keep going, you are improving.'}</div>`;
    $('#bs', el).textContent = 'Personal best: ' + best + ' WPM';
  }
  /* Pasting would finish the test in an instant with a fake 1000+ WPM, so it is blocked, and so is any burst faster than 40 ms per character. */
  $('#in', el).onpaste = (e) => { e.preventDefault(); toast('Pasting is turned off in the typing test'); };
  $('#in', el).ondrop = (e) => e.preventDefault();
  $('#in', el).oninput = (e) => {
    if (over) return; const typed = e.target.value.slice(0, target.length);
    if (typed.length >= 5 && Date.now() - (t0 || Date.now()) < typed.length * 40) { e.target.value = prev; toast('That is faster than anyone can type'); return; }
    prev = typed;
    if (!t0) { t0 = Date.now(); iv = setInterval(() => { const left = secs - (Date.now() - t0) / 1000; if (left <= 0) { $('#tl', el).textContent = 0; finish(); } else $('#tl', el).textContent = Math.ceil(left); }, 200); }
    show(typed); const s = typingStats(target, typed, Date.now() - t0); $('#wp', el).textContent = s.wpm; $('#ac', el).textContent = s.acc + '%';
    if (typed.length >= target.length) finish();
  };
  bindSeg($('#tabs', el), (k) => { secs = +k; reset(); });
  $('#nw', el).onclick = reset; reset();
  return () => clearInterval(iv);
} });

})();
