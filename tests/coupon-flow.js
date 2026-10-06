'use strict';
/* End-to-end check of the trial-coupon flow using the real www/js/coupons.js and www/js/pro.js and, when it exists, the private
   coupon-codes.txt (never printed). Run:  node tests/coupon-flow.js
   Covers: valid code today, wrong code, a code whose window has not opened, tampered storage, expiry, clock moved backwards,
   reinstall, the dev code in a release build, and that no plaintext code ships in www/. */
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL: ' + m); } else console.log('ok:   ' + m); };

const codesFile = path.join(ROOT, 'coupon-codes.txt');
if (!fs.existsSync(codesFile)) { console.log('coupon-codes.txt not found (it is private and gitignored): skipping the flow test.'); process.exit(0); }
const rows = fs.readFileSync(codesFile, 'utf8').split(/\r?\n/).filter(l => /^\d\d\s+PKT-/.test(l)).map(l => l.trim().split(/\s+/)); // [n, code, opens, ends]
const dev = (fs.readFileSync(codesFile, 'utf8').match(/PKT-DEV-[A-Z2-9-]+/) || [])[0];
const dayMs = 86400000;

function boot(nowMs, storage) {
  const store = storage || {};
  const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const ctx = { window: {}, localStorage: ls, navigator: {}, crypto: crypto.webcrypto, TextEncoder, console, setTimeout: () => 0, clearTimeout() {}, toast() {}, Date: class extends Date { constructor(...a) { super(...(a.length ? a : [nowMs])); } static now() { return nowMs; } } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'www/js/coupons.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'www/js/pro.js'), 'utf8') + '\nthis.api = { isPro, onTrial, redeemCoupon, couponInfo: () => coupon };', ctx);
  return { api: ctx.api, store };
}
(async () => {
  const now = Date.now(), today = new Date(now).toISOString().slice(0, 10);
  const cur = rows.find(r => r[2] <= today && today <= r[3]), future = rows[rows.length - 1];
  ok(!!cur, 'there is a code whose window covers today');
  let { api, store } = boot(now);
  ok(!api.isPro(), 'a fresh install is not Pro');
  let r = await api.redeemCoupon('PKT-AAAA-BBBB-CCCC-DDDD'); ok(!r.ok && r.reason === 'invalid', 'a wrong code is refused as invalid');
  r = await api.redeemCoupon(''); ok(!r.ok && r.reason === 'invalid', 'an empty code is refused');
  r = await api.redeemCoupon(future[1]); ok(!r.ok && r.reason === 'not-yet', 'a code from a later window says "not yet"');
  ok(!api.isPro(), 'still not Pro after refused codes');
  r = await api.redeemCoupon(' ' + cur[1].toLowerCase() + ' '); ok(r.ok && r.persisted, 'today\'s code works (lower case, spaces around)');
  ok(api.isPro() && api.onTrial(), 'Pro is on as a trial');
  const stored = JSON.stringify(store);
  ok(!stored.includes(cur[1]), 'the plaintext code is not stored on the device');
  const endsAt = Date.parse(cur[3] + 'T23:59:59Z');
  ok(api.couponInfo().expiresAt === endsAt, 'the trial ends at the end of the code window (absolute, not 14 days from redeeming)');
  r = await api.redeemCoupon(cur[1]); ok(r.ok, 'redeeming the same code again is harmless');

  ({ api } = boot(now + 1000, store)); ok(api.isPro(), 'Pro survives an app restart');
  const t2 = JSON.parse(store['pkx.coupon']); t2.expiresAt = endsAt + 30 * dayMs; store['pkx.coupon'] = JSON.stringify(t2);
  ({ api } = boot(now + 2000, store)); ok(!api.isPro(), 'editing the stored expiry does not extend the trial');
  t2.expiresAt = endsAt; store['pkx.coupon'] = JSON.stringify(t2);
  ({ api } = boot(endsAt + 1000, store)); ok(!api.isPro(), 'the trial is over after its end date');
  ({ api } = boot(endsAt + 1000, { 'pkx.clock': String(endsAt + 5000), 'pkx.coupon': store['pkx.coupon'] }));
  ({ api } = boot(endsAt - 1000, { 'pkx.clock': String(endsAt + 5000), 'pkx.coupon': store['pkx.coupon'] })); ok(!api.isPro(), 'winding the phone clock back after expiry does not bring the trial back');
  ({ api } = boot(now, {})); r = await api.redeemCoupon(cur[1]); ok(r.ok, 'after a reinstall the same code gives only the rest of its window (same end date)');
  ok(api.couponInfo().expiresAt === endsAt, 'reinstall does not renew the trial');
  if (dev) { ({ api } = boot(now, {})); r = await api.redeemCoupon(dev); ok(!r.ok && r.reason === 'invalid', 'the dev code is refused in a non-debug (release) build'); }
  ({ api } = boot(now, { 'pkx.p': JSON.stringify({ v: 1, t: now - 20 * dayMs }) })); ok(!api.isPro(), 'a cached Pro flag older than 14 days without a Play check is not trusted');
  ({ api } = boot(now, { 'pkx.p': JSON.stringify({ v: 1, t: now - 2 * dayMs }) })); ok(api.isPro(), 'a recent cached Pro flag is trusted until Play can be asked');
  ({ api } = boot(now, { 'pkx.p': JSON.stringify({ v: 1, t: now + 9 * dayMs }) })); ok(!api.isPro(), 'a Pro flag dated in the future is ignored');

  const shipped = []; (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); f.isDirectory() ? walk(p) : shipped.push(p); } })(path.join(ROOT, 'www'));
  const all = rows.map(x => x[1]).concat(dev ? [dev] : []);
  const leak = shipped.filter(f => /\.(js|html|css|json|txt|md)$/.test(f)).filter(f => { const s = fs.readFileSync(f, 'utf8'); return all.some(c => s.includes(c)); });
  ok(leak.length === 0, 'no plaintext coupon code appears in any file under www/');
  console.log(fails ? `\n${fails} check(s) failed` : '\ncoupon flow: all checks passed'); process.exit(fails ? 1 : 0);
})();
