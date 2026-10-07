'use strict';
/* Helpers shared by the daily / basics / more functional tests: a fake clock (Date + timers), a fake LocalNotifications plugin,
   a scripted GPS, a fake file-sharing plugin and an in-memory IndexedDB. Not a test itself (the runner only runs *.test.js). */
process.env.TZ = process.env.TZ || 'UTC';
const { boot } = require('../helpers/page');

/* boot() with a scripted geolocation and IndexedDB already in place. */
async function bootFx() {
  const geo = { watchers: new Map(), id: 0, deny: null, once: null, cleared: 0 };
  geo.api = {
    watchPosition(ok, err) { const id = ++geo.id; geo.watchers.set(id, { ok, err }); if (geo.deny) setTimeout(() => err({ code: geo.deny }), 0); return id; },
    clearWatch(id) { geo.watchers.delete(id); geo.cleared++; },
    getCurrentPosition(ok, err) { if (geo.once) ok(geo.once); else if (err) err({ code: geo.deny || 2 }); }
  };
  geo.emit = (lat, lon, o) => { o = o || {}; const p = { coords: { latitude: lat, longitude: lon, accuracy: o.acc == null ? 5 : o.acc, altitude: o.alt == null ? null : o.alt, speed: o.spd == null ? null : o.spd }, timestamp: o.t || Date.now() }; geo.watchers.forEach(w => w.ok(p)); };
  let idb = null; try { idb = require('fake-indexeddb'); } catch (e) { /* routes cannot be saved without it */ }
  const page = await boot({ beforeParse(w) {
    Object.defineProperty(w.navigator, 'geolocation', { value: geo.api, configurable: true });
    if (idb) { w.indexedDB = new idb.IDBFactory(); w.IDBKeyRange = idb.IDBKeyRange; }
  } });
  page.geo = geo; return page;
}

/* Replaces Date.now / new Date() and setTimeout / setInterval in the page by a clock the test moves by hand. */
function clock(page, startIso) {
  const w = page.w;
  w.eval(`(function () {
    const RD = Date; window.__now = ${Date.parse(startIso)};
    class FD extends RD { constructor(...a) { if (a.length) super(...a); else super(window.__now); } static now() { return window.__now; } }
    window.Date = FD;
    const T = []; let id = 1000;
    const add = (f, ms, rep) => { id++; T.push({ id, f, ms: Math.max(1, +ms || 0), next: window.__now + Math.max(1, +ms || 0), rep }); return id; };
    window.setInterval = (f, ms) => add(f, ms, true); window.setTimeout = (f, ms) => add(f, ms, false);
    window.clearInterval = window.clearTimeout = (i) => { const k = T.findIndex(t => t.id === i); if (k >= 0) T.splice(k, 1); };
    window.__timers = () => T.length;
    window.__set = (ms) => { const d = ms - window.__now; T.forEach(t => { t.next += d; }); window.__now = ms; };
    window.__advance = (ms) => {
      const end = window.__now + ms;
      for (let guard = 0; guard < 3000000; guard++) {
        let n = null; for (const t of T) if (t.next <= end && (!n || t.next < n.next)) n = t;
        if (!n) break;
        window.__now = Math.max(window.__now, n.next);
        if (n.rep) n.next += n.ms; else T.splice(T.indexOf(n), 1);
        try { n.f(); } catch (e) { window.dispatchEvent(new ErrorEvent('error', { message: String(e && e.message) })); }
      }
      window.__now = end;
    };
  })()`);
  return {
    advance: async (ms) => { w.__advance(ms); await page.wait(5); },
    now: () => w.__now, timers: () => w.__timers(),
    set: (iso) => w.__set(Date.parse(iso))
  };
}

/* A LocalNotifications stand-in that records every call. perm: 'granted' | 'denied'. */
function fakeNotifications(page, perm) {
  const f = { perm: perm || 'granted', scheduled: [], cancelled: [], reqs: 0 };
  f.plugin = {
    async requestPermissions() { f.reqs++; return { display: f.perm }; },
    async checkPermissions() { return { display: f.perm }; },
    async schedule(o) { o.notifications.forEach(n => f.scheduled.push(n)); return {}; },
    async cancel(o) { o.notifications.forEach(n => f.cancelled.push(n.id)); }
  };
  f.install = () => { page.w.Capacitor = page.w.Capacitor || {}; page.w.Capacitor.Plugins = Object.assign(page.w.Capacitor.Plugins || {}, { LocalNotifications: f.plugin }); };
  f.install();
  f.ids = () => f.scheduled.map(n => n.id);
  f.last = () => f.scheduled[f.scheduled.length - 1];
  f.reset = () => { f.scheduled.length = 0; f.cancelled.length = 0; };
  return f;
}

/* Filesystem + Share stand-ins: everything a tool "shares" as a file is recorded here (data is base64 for the shared saveTextFile). */
function fakeShare(page) {
  const f = { files: [], shares: [] };
  const dec = (d) => { try { return Buffer.from(d, 'base64').toString('utf8'); } catch (e) { return d; } };
  page.w.Capacitor = page.w.Capacitor || {}; page.w.Capacitor.Plugins = page.w.Capacitor.Plugins || {};
  Object.assign(page.w.Capacitor.Plugins, {
    Filesystem: { async writeFile(o) { const raw = o.encoding === 'utf8' ? o.data : dec(o.data); f.files.push({ path: o.path, data: raw }); return { uri: 'file://' + o.path }; } },
    Share: { async share(o) { f.shares.push(o); return {}; } }
  });
  f.last = () => f.files[f.files.length - 1];
  return f;
}

module.exports = { bootFx, clock, fakeNotifications, fakeShare };

/* The DOM-free (PURE-START / PURE-END) blocks of www/js/tools/more.js, evaluated on their own so tests can call the maths directly. */
function morePure(names) {
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'www', 'js', 'tools', 'more.js'), 'utf8');
  const blocks = [...src.matchAll(/\/\/ ==PURE-START==([\s\S]*?)\/\/ ==PURE-END==/g)].map((m) => m[1]).join('\n');
  return new Function('const p2 = (n) => String(n).padStart(2, "0");\n' + blocks + '\nreturn { ' + names + ' };')();
}
module.exports.morePure = morePure;
