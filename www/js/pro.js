'use strict';
/* PocketKit Pro: a one-time purchase (Google Play product PRO_ID) plus trial coupons.
   Free: every everyday utility. Pro: the Connect suite, motion / stop-motion cameras, and higher limits.
   Pro lives outside the saved tool data, so no backup or export can grant it, and it is re-checked with Google Play on every start.
   Trial coupons ship as salted hashes only (coupons.js, made by tools/generate-coupons.js) with absolute expiry windows,
   so reinstalling cannot renew a trial. */
const PRO_ID = 'pocketkit_pro';
const PL = window.Capacitor && Capacitor.Plugins || {};
/* Native plugins are reached as Capacitor.Plugins.<Name> (the bridge makes them on demand). PN is the helper plugin: debug check, FLAG_SECURE, sensitive clipboard. */
const NP = PL.NativePurchases, PN = PL.PocketNative || null;

/* Free limits. Tools ask proLimit(name); Pro removes every one of them. */
const FREE = { pins: 4, reminders: 3, notes: 10, recordings: 3, routes: 1, locker: 3, vault: 5 };
const PRO_FEATURES = [
  { k: 'motion', i: '🎥', t: 'Motion cam and Stop motion animation' },
  { k: 'camera', i: '🎞️', t: 'Advanced camera tools', s: 'Doc Scanner, Time-lapse, Blank Cam, Photo FX, Collage and Colour Blind Simulator' },
  { k: 'audio', i: '🎹', t: 'Pro audio tools', s: 'Audio Player with equalizer and A-B loop, Drum Pad, Tone Sequencer and Spectrum Analyzer' },
  { k: 'trackers', i: '📒', t: 'Trackers and invoices', s: 'Expense Tracker, Billing (invoices), Health Log and Habit Streaks, with exports' },
  { k: 'create', i: '🖌️', t: 'Creative studio', s: 'Pixel Art and Signature Pad' },
  { k: 'study', i: '🎓', t: 'Study tools', s: 'Flashcards with spaced repetition and the Matrix Calculator' },
  { k: 'sensors', i: '🧲', t: 'Advanced sensor tools', s: 'Sensor List with live readings of every sensor in your phone' },
  { k: 'locker', i: '🔐', t: 'Unlimited locked files and vault entries, and 2FA codes', s: 'Free: 3 files and 5 vault entries, no 2FA codes' },
  { k: 'routes', i: '🛣️', t: 'Unlimited saved routes and GPX export', s: 'Free: 1 saved route' },
  { k: 'reminders', i: '🔔', t: 'Unlimited reminders', s: 'Free: 3 active reminders' },
  { k: 'notes', i: '📝', t: 'Unlimited notes', s: 'Free: 10 notes' },
  { k: 'recordings', i: '🎙️', t: 'Unlimited voice recordings', s: 'Free: 3 recordings' },
  { k: 'pins', i: '📌', t: 'Unlimited pinned tools and collections', s: 'Free: 4 pinned tools, no collections' },
  { k: 'drive', i: '☁️', t: 'Automatic Google Drive backup', s: 'Free: back up and restore by hand' },
  { k: 'accents', i: '🎨', t: 'All colour themes' }
];

let pro = false, devPro = false, debuggable = false, devWanted = false, proPrice = null, priceTried = false, proFocus = null;
/* Pro state is kept under keys outside the 'pk.' namespace used by tools and backups. The cached flag is only trusted for 14 days
   without a successful Google Play check, and never when its timestamp is in the future. */
const PRO_KEY = 'pkx.p', PRO_OFFLINE_MS = 14 * 86400000;
try {
  const o = JSON.parse(localStorage.getItem(PRO_KEY) || 'null');
  pro = !!(o && o.v === 1 && o.t <= Date.now() + 60000 && Date.now() - o.t < PRO_OFFLINE_MS);
  devWanted = localStorage.getItem('pkx.dev') === '1';
} catch (e) {}
const COUPON_SALT = 'PocketKit/coupon/v1', COUPON_KEY = 'pkx.coupon', CLOCK_KEY = 'pkx.clock';
let coupon = null, clockMax = 0, clockSaved = 0, trialOn = false, trialTimer = null;
try { coupon = JSON.parse(localStorage.getItem(COUPON_KEY) || 'null'); clockMax = Number(localStorage.getItem(CLOCK_KEY)) || 0; } catch (e) {}

/* Monotonic clock: it may move forward but never back, so winding the phone's clock back cannot revive an expired trial. */
function secureNow() {
  const n = Date.now();
  if (n > clockMax) {
    clockMax = n;
    if (coupon && n - clockSaved > 60000) { clockSaved = n; try { localStorage.setItem(CLOCK_KEY, String(n)); } catch (e) {} }
  }
  return clockMax;
}
function couponActive() {
  if (!coupon || typeof coupon !== 'object') return false;
  const def = COUPONS.find(c => c.hash === coupon.codeHash);
  if (!def) return false; // checked against the shipped table, so editing storage cannot extend a trial
  const known = def.devMinutes ? debuggable && Number.isFinite(coupon.expiresAt)
    : Date.parse(def.expiresAt) === coupon.expiresAt && (!def.opensAt || coupon.redeemedAt >= Date.parse(def.opensAt));
  return known && secureNow() < coupon.expiresAt;
}
const isPro = () => pro || devPro || couponActive();
const onTrial = () => !pro && !devPro && couponActive();
const proLimit = (name) => isPro() ? Infinity : FREE[name];
const fmtUntil = ms => { try { return new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return new Date(ms).toISOString(); } };
async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
/* -> { ok: true, persisted } or { ok: false, reason: 'invalid' | 'expired' | 'not-yet' | 'already-pro' | 'error' } */
async function redeemCoupon(raw) {
  const code = String(raw || '').trim().toUpperCase();
  if (!code) return { ok: false, reason: 'invalid' };
  if (pro) return { ok: false, reason: 'already-pro' };
  let hash;
  try { hash = await sha256Hex(COUPON_SALT + code); } catch (e) { return { ok: false, reason: 'error' }; }
  const def = COUPONS.find(c => c.hash === hash);
  if (!def || (def.devMinutes && !debuggable)) return { ok: false, reason: 'invalid' };
  const now = secureNow();
  if (def.opensAt && now < Date.parse(def.opensAt)) return { ok: false, reason: 'not-yet' }; // a later fortnight's code cannot be used early
  const expiresAt = def.devMinutes ? now + def.devMinutes * 60000 : Date.parse(def.expiresAt);
  if (!(now < expiresAt)) return { ok: false, reason: 'expired' };
  coupon = { codeHash: hash, redeemedAt: now, expiresAt };
  let persisted = true;
  try { localStorage.setItem(COUPON_KEY, JSON.stringify(coupon)); localStorage.setItem(CLOCK_KEY, String(now)); clockSaved = now; } catch (e) { persisted = false; }
  watchTrial();
  return { ok: true, persisted };
}
/* Re-renders when a trial starts or lapses and says so once when it has ended, even if it ended while the app was closed. */
function watchTrial() {
  clearTimeout(trialTimer);
  const on = onTrial(), changed = on !== trialOn;
  trialOn = on;
  if (changed && typeof proChanged === 'function') proChanged();
  if (!on && coupon && !coupon.noticed && !pro && !devPro && secureNow() >= coupon.expiresAt) {
    coupon.noticed = true;
    try { localStorage.setItem(COUPON_KEY, JSON.stringify(coupon)); } catch (e) {}
    if (typeof toast === 'function') toast('Your Pro trial has ended.');
  }
  if (on) trialTimer = setTimeout(watchTrial, Math.min(Math.max(coupon.expiresAt - secureNow(), 0) + 500, 2147000000));
}
function setPro(v) { pro = v; try { if (v) localStorage.setItem(PRO_KEY, JSON.stringify({ v: 1, t: Date.now() })); else localStorage.removeItem(PRO_KEY); } catch (e) {} }
/* Returns true (and shows the Pro sheet) when the feature is locked. */
function needPro(key) { if (isPro()) return false; if (typeof openPro === 'function') openPro(key); return true; }

async function loadPrice() {
  if (!NP || proPrice || priceTried) return;
  priceTried = true;
  try {
    const { products } = await NP.getProducts({ productIdentifiers: [PRO_ID], productType: 'inapp' });
    proPrice = products[0] && products[0].priceString || null;
  } catch (e) { console.warn('price lookup failed', e); }
  if (proPrice && typeof proChanged === 'function') proChanged();
}
async function refreshPro() {
  if (!NP) return;
  loadPrice();
  try {
    if (!(await NP.isBillingSupported()).isBillingSupported) return;
    const { purchases } = await NP.getPurchases({ productType: 'inapp' });
    setPro(purchases.some(p => p.productIdentifier === PRO_ID && (p.purchaseState == null || p.purchaseState === '1')));
  } catch (e) { console.warn('pro check failed', e); } // keep the cached value if Play cannot be reached
  if (typeof proChanged === 'function') proChanged();
}
function billingMessage(e) {
  const m = String(e && e.message || e);
  if (/already own/i.test(m)) return 'You already own PocketKit Pro. Tap "Restore purchase".';
  if (/not found|item_unavailable/i.test(m)) return "PocketKit Pro isn't available from Google Play yet. Please try again later.";
  if (/timed out|timeout|service|network|disconnected|unavailable/i.test(m)) return "Couldn't reach Google Play. Check your connection and try again.";
  return "The purchase couldn't be completed. Please try again.";
}
async function buyPro() {
  if (!NP) return { ok: false, msg: 'Purchases are only available in the installed app.' };
  try {
    await NP.purchaseProduct({ productIdentifier: PRO_ID, productType: 'inapp' });
    await refreshPro(); // unlock only once Google Play lists the purchase as complete (a slow payment can still be pending)
    return pro ? { ok: true } : { ok: false, info: true, msg: 'Your purchase is pending. Pro unlocks as soon as the payment completes.' };
  }
  catch (e) { if (/cancel/i.test(String(e && e.message || e))) return { ok: false, msg: null }; return { ok: false, msg: billingMessage(e) }; }
}
async function restorePro() {
  if (!NP) return { ok: false, msg: 'Purchases are only available in the installed app.' };
  priceTried = false; await refreshPro();
  return isPro() ? { ok: true } : { ok: false, msg: 'No previous purchase found for this Google account.' };
}

/* Debug builds only: a dev override and the 10-minute dev coupon. Both stay inert in a release build. */
if (PN) PN.isDebuggable().then(r => { debuggable = !!r.debuggable; devPro = debuggable && devWanted; watchTrial(); if (typeof proChanged === 'function') proChanged(); }).catch(() => {});
refreshPro();
watchTrial();
