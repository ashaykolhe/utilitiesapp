'use strict';
/* Tests www/js/drive.js (the real file) against a fake Google Drive kept in memory and a fake native sign-in.
   Covers: connect, manual backup (free), automatic backup rules (Pro, once a day, only when changed, silent sign-in), keeping the newest
   few backups, restore, an expired token, no network, and a build with no Google setup. Run: node tests/drive-flow.js */
const fs = require('fs'), path = require('path'), vm = require('vm');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL: ' + m); } else console.log('ok:   ' + m); };

function world() {
  const files = []; let nextId = 1, calls = { authorize: [], fetch: 0 }, tokenGen = 1, validToken = 'tok1', offline = false;
  const store = {}; const toasts = [];
  const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  let data = { 'pk.theme': '"dark"', 'pk.notes': '[]' }, pro = false, consentNeeded = false, setupMissing = false, pluginPresent = true;
  const applied = [];
  const fetchFake = async (url, opts) => {
    calls.fetch++;
    if (offline) throw new TypeError('Failed to fetch');
    const auth = (opts && opts.headers && opts.headers.Authorization) || '';
    const res = (status, body, text) => ({ status, ok: status >= 200 && status < 300, json: async () => body, text: async () => (text != null ? text : JSON.stringify(body)) });
    if (auth !== 'Bearer ' + validToken) return res(401, {}, 'unauthorized');
    const u = new URL(url), method = (opts && opts.method) || 'GET';
    if (u.pathname === '/oauth2/v3/userinfo') return res(200, { email: 'tester@example.com' });
    if (u.pathname === '/drive/v3/files' && method === 'GET') {
      const list = files.slice().sort((a, b) => b.t - a.t).map(f => ({ id: f.id, name: f.name, size: String(f.text.length), modifiedTime: new Date(f.t).toISOString(), appProperties: f.props }));
      return res(200, { files: list });
    }
    if (u.pathname === '/upload/drive/v3/files' && method === 'POST') {
      const body = Buffer.from(await opts.body.arrayBuffer()).toString('utf8'), b = /boundary=(.+)$/.exec(opts.headers['Content-Type'])[1];
      const parts = body.split('--' + b).filter(p => p.trim() && p.trim() !== '--');
      const meta = JSON.parse(parts[0].split('\r\n\r\n')[1].replace(/\r\n$/, '')), text = parts[1].split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, '');
      if (!(meta.parents || []).includes('appDataFolder')) return res(400, {}, 'bad parent');
      const f = { id: 'f' + nextId++, name: meta.name, text, props: meta.appProperties, t: Date.now() + nextId * 1000 }; files.push(f);
      return res(200, { id: f.id, name: f.name });
    }
    const m = /^\/drive\/v3\/files\/(.+)$/.exec(u.pathname);
    if (m && method === 'DELETE') { const i = files.findIndex(f => f.id === decodeURIComponent(m[1])); if (i >= 0) files.splice(i, 1); return res(204, {}); }
    if (m && u.searchParams.get('alt') === 'media') { const f = files.find(f => f.id === decodeURIComponent(m[1])); return f ? res(200, {}, f.text) : res(404, {}, 'nf'); }
    return res(404, {}, 'unknown ' + u.pathname);
  };
  const ctx = {
    console, setTimeout: () => 0, clearTimeout() {}, URL, URLSearchParams, Blob, Date, JSON, Math, encodeURIComponent, String, Number, Object, Array, Promise, Error, TypeError,
    fetch: fetchFake, localStorage: ls, document: { addEventListener() {}, hidden: false },
    window: { Capacitor: { Plugins: {} } },
    $: () => null, esc: s => String(s), tr: s => s, toast: m => toasts.push(m), confirm: () => true,
    isPro: () => pro, needPro: () => { toasts.push('NEEDPRO'); return !pro; },
    makeBackup: () => JSON.stringify({ app: 'PocketKit', version: 1, made: new Date().toISOString(), data }),
    applyBackup: (text) => { const o = JSON.parse(text); applied.push(o); return Object.keys(o.data).length; },
    outside: fn => fn()
  };
  ctx.Capacitor = ctx.window.Capacitor; // in the WebView window.Capacitor is also a global
  Object.defineProperty(ctx.window.Capacitor.Plugins, 'PocketDrive', { get: () => pluginPresent ? { authorize: async (o) => { calls.authorize.push(!!o.interactive); if (setupMissing) return { error: 'setup' }; if (consentNeeded && !o.interactive) return { error: 'consent' }; return { accessToken: validToken }; } } : undefined });
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'www', 'js', 'drive.js'), 'utf8').replace(/\nrenderDriveCard\(\);\nsetTimeout\(driveAutoCheck, 4000\);\s*$/, '\n') +
    '\nthis.api = { get drive() { return drive; }, set drive(v) { drive = v; }, driveConnect, driveBackupNow, driveList, driveAutoCheck, driveRestoreFlow, driveErrText, driveDisconnect, driveBuild, expireToken() { driveToken = null; } };', ctx);
  return { api: ctx.api, store, files, calls, toasts, applied, set: { data: v => { data = v; }, pro: v => { pro = v; }, consentNeeded: v => { consentNeeded = v; }, setupMissing: v => { setupMissing = v; }, pluginPresent: v => { pluginPresent = v; }, offline: v => { offline = v; }, validToken: v => { validToken = v; } } };
}

(async () => {
  let w = world(), a = w.api;
  await a.driveConnect();
  ok(a.drive.connected && a.drive.email === 'tester@example.com', 'connect: signed in and shows the account email');
  ok('pkx.drive' in w.store && !Object.keys(w.store).some(k => k.startsWith('pk.')), 'the connection is remembered under pkx.drive, outside the pk. data that backups carry');

  await a.driveBackupNow({ auto: false });
  ok(w.files.length === 1 && /^pocketkit-backup-.*\.json$/.test(w.files[0].name), 'manual backup uploads one .json file to the app data folder');
  ok(JSON.parse(w.files[0].text).data['pk.theme'] === '"dark"' && w.files[0].props.kind === 'manual', 'the uploaded file holds the app data and is marked manual');
  ok(!w.files[0].text.includes('pkx.'), 'the backup carries no Pro, PIN or Drive keys');

  /* keeping only the newest 10 manual backups */
  for (let i = 0; i < 12; i++) await a.driveBackupNow({ auto: false });
  ok(w.files.filter(f => f.props.kind === 'manual').length === 10, 'only the newest 10 manual backups are kept');

  /* automatic backup rules */
  w = world(); a = w.api; await a.driveConnect(); a.drive.auto = true;
  await a.driveAutoCheck(); ok(w.files.length === 0, 'auto backup does nothing for a free user');
  w.set.pro(true); await a.driveAutoCheck(); ok(w.files.length === 1 && w.files[0].props.kind === 'auto', 'auto backup runs for Pro when something changed');
  await a.driveAutoCheck(); ok(w.files.length === 1, 'auto backup does not run again within a day');
  a.drive.lastAt = Date.now() - 25 * 3600 * 1000; await a.driveAutoCheck(); ok(w.files.length === 1, 'after a day, nothing changed: still no new backup');
  w.set.data({ 'pk.theme': '"light"' }); a.expireToken(); await a.driveAutoCheck(); ok(w.files.length === 2, 'after a day with a change: a new automatic backup');
  ok(w.calls.authorize.slice(-1)[0] === false, 'the automatic backup signs in silently (no screen)');

  w = world(); a = w.api; await a.driveConnect(); a.drive.auto = true; w.set.pro(true); a.drive.lastAt = 0; w.set.consentNeeded(true); a.expireToken();
  await a.driveAutoCheck(); ok(a.drive.attention === true && w.files.length === 0, 'when Google needs consent again, auto backup stops quietly and asks the user to reconnect');

  /* restore */
  w = world(); a = w.api; await a.driveConnect(); w.set.data({ 'pk.theme': '"light"', 'pk.x': '1' }); await a.driveBackupNow({}); w.set.data({ 'pk.theme': '"dark"' });
  const list = await a.driveList(true); ok(list.length === 1 && list[0].appProperties.kind === 'manual', 'restore: the backup is listed with its kind');
  const text = await (async () => { const url = list[0].id; return w.files.find(f => f.id === url).text; })();
  ok(JSON.parse(text).data['pk.x'] === '1', 'restore: the stored backup has the saved data');

  /* errors */
  w = world(); a = w.api; await a.driveConnect(); w.set.validToken('tok2'); a.expireToken();
  const before = w.calls.authorize.length; w.set.validToken('tok1'); a.expireToken(); await a.driveBackupNow({}); ok(w.files.length === 1, 'an expired token is renewed and the backup still works');
  w.set.offline(true); a.expireToken(); try { await a.driveBackupNow({}); ok(false, 'offline should throw'); } catch (e) { ok(e.code === 'network' && /reach Google Drive/.test(a.driveErrText(e)), 'no network: a clear "could not reach Google Drive" message'); }
  w = world(); a = w.api; w.set.setupMissing(true); try { await a.driveConnect(); ok(false, 'setup should throw'); } catch (e) { ok(e.code === 'setup' && /isn't set up/.test(a.driveErrText(e)), 'a build Google does not know gives the "isn\'t set up in this version yet" message'); }
  w = world(); a = w.api; w.set.pluginPresent(false); try { await a.driveConnect(); ok(false, 'unavailable should throw'); } catch (e) { ok(e.code === 'unavailable', 'in a browser (no native plugin) connecting says Drive is unavailable'); }
  w = world(); a = w.api; await a.driveConnect(); a.driveDisconnect(); ok(!a.drive.connected && !a.drive.auto, 'disconnect forgets the account on the phone');
  console.log(fails ? '\n' + fails + ' check(s) failed' : '\ndrive flow: all checks passed'); process.exit(fails ? 1 : 0);
})();
