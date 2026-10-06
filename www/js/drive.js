'use strict';
/* Google Drive backup.
   Backups live in Drive's hidden app-data folder (scope drive.appdata): they do not appear in the person's Drive file list and only
   PocketKit can read them. Sign-in uses Google's Authorization API through the native PocketDrive plugin, which hands back a short-lived
   access token; everything else is plain Drive REST over fetch.
     manual backup  - free: settings and tool data as a small .json file
     automatic      - Pro: at most once a day, only when something changed, with a silent sign-in (no screen pops up by surprise)
   Restore lists the backups of the account and puts the chosen one back with the same code as the file restore (applyBackup).
   What is not in a backup: Pro status, the app-lock PIN, voice recordings, locked files and the Password Vault (they live in the phone's
   database). The connection itself is kept outside the 'pk.' data (localStorage pkx.drive) so no backup file can carry it. */
const DRIVE_KEY = 'pkx.drive';
const DRIVE_API = 'https://www.googleapis.com/drive/v3', DRIVE_UP = 'https://www.googleapis.com/upload/drive/v3';
const DRIVE_KEEP = { manual: 10, auto: 7 };       // newest backups kept per kind; older ones are deleted after each upload
const DRIVE_AUTO_EVERY = 24 * 3600 * 1000;
const DRIVE_PREFIX = 'pocketkit-backup-';
let drive = { connected: false, auto: false, email: '', lastAt: 0, lastHash: '', attention: false };
try { Object.assign(drive, JSON.parse(localStorage.getItem(DRIVE_KEY) || '{}')); } catch (e) { /* start disconnected */ }
const saveDrive = () => { try { localStorage.setItem(DRIVE_KEY, JSON.stringify(drive)); } catch (e) { /* storage full: the connection just is not remembered */ } };
let driveToken = null, driveTokenAt = 0, driveBusy = false;
const PD = () => (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.PocketDrive) || null;

class DriveError extends Error { constructor(code, detail) { super(detail || code); this.code = code; } }

/* ---- sign-in (native) ---- */
async function driveAuth(interactive) {
  if (driveToken && Date.now() - driveTokenAt < 50 * 60000) return driveToken; // tokens last about an hour
  const p = PD(); if (!p || !p.authorize) throw new DriveError('unavailable');
  const call = () => p.authorize({ interactive: !!interactive });
  const r = await (typeof outside === 'function' ? outside(call) : call()); // Google's screen leaves the app: do not treat that as being away
  if (!r || !r.accessToken) throw new DriveError((r && r.error) || 'cancelled');
  driveToken = r.accessToken; driveTokenAt = Date.now();
  return driveToken;
}
async function driveFetch(url, opts, interactive, retried) {
  opts = opts || {};
  const token = await driveAuth(interactive);
  let res;
  try { res = await fetch(url, Object.assign({}, opts, { headers: Object.assign({}, opts.headers || {}, { Authorization: 'Bearer ' + token }) })); }
  catch (e) { throw new DriveError('network'); }
  if (res.status === 401 && !retried) { driveToken = null; return driveFetch(url, opts, interactive, true); }
  if (!res.ok) { let d = ''; try { d = (await res.text()).slice(0, 120); } catch (e) { /* no body */ } throw new DriveError('http', res.status + (d ? ' ' + d : '')); }
  return res;
}

/* ---- Drive REST ---- */
async function driveList(interactive) {
  const q = new URLSearchParams({ spaces: 'appDataFolder', orderBy: 'modifiedTime desc', pageSize: '100', fields: 'files(id,name,size,modifiedTime,appProperties)' });
  const res = await driveFetch(DRIVE_API + '/files?' + q, {}, interactive);
  const body = await res.json();
  return (body.files || []).filter(f => typeof f.name === 'string' && f.name.startsWith(DRIVE_PREFIX));
}
async function driveUpload(file, props) {
  const meta = { name: file.name, parents: ['appDataFolder'], appProperties: props };
  const boundary = 'pk' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  const body = new Blob(['--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) + '\r\n--' + boundary + '\r\nContent-Type: ' + file.mime + '\r\n\r\n', file.body, '\r\n--' + boundary + '--']);
  const res = await driveFetch(DRIVE_UP + '/files?uploadType=multipart&fields=id,name,size,modifiedTime', { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body }, false);
  return res.json();
}
async function driveDownloadText(id) { return (await driveFetch(DRIVE_API + '/files/' + encodeURIComponent(id) + '?alt=media', {}, true)).text(); }
async function drivePrune() { // keep the newest few of each kind; cleanup never fails a backup
  try {
    const files = await driveList(false), seen = { manual: 0, auto: 0 };
    for (const f of files) {
      const kind = f.appProperties && f.appProperties.kind === 'auto' ? 'auto' : 'manual';
      if (++seen[kind] > DRIVE_KEEP[kind]) await driveFetch(DRIVE_API + '/files/' + encodeURIComponent(f.id), { method: 'DELETE' }, false).catch(() => {});
    }
  } catch (e) { /* ignore */ }
}

/* ---- building a backup ---- */
const hashStr = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h) + ':' + s.length; };
function driveBuild() {
  const text = makeBackup(), o = JSON.parse(text);
  return { name: DRIVE_PREFIX + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.json', mime: 'application/json', body: new Blob([text], { type: 'application/json' }), hash: hashStr(JSON.stringify(o.data)), items: Object.keys(o.data).length };
}
/* One backup to Drive. auto=true is the Pro one: silent sign-in only. */
async function driveBackupNow(opts) {
  const auto = !!(opts && opts.auto);
  if (driveBusy) return null;
  driveBusy = true;
  try {
    const file = driveBuild();
    const out = await driveUpload(file, { kind: auto ? 'auto' : 'manual', items: String(file.items), v: '1' });
    drive.lastAt = Date.now(); drive.lastHash = file.hash; drive.attention = false; saveDrive();
    await drivePrune();
    return out;
  } finally { driveBusy = false; }
}

/* ---- connect / disconnect ---- */
async function driveConnect() {
  await driveAuth(true);
  try { // the email is only for the "Connected as ..." line; failing to read it is not failing to connect
    const res = await driveFetch('https://www.googleapis.com/oauth2/v3/userinfo', {}, false);
    drive.email = String((await res.json()).email || '').slice(0, 120);
  } catch (e) { drive.email = ''; }
  drive.connected = true; drive.attention = false; saveDrive();
}
function driveDisconnect() { drive = { connected: false, auto: false, email: '', lastAt: 0, lastHash: '', attention: false }; driveToken = null; saveDrive(); }

/* ---- automatic backup (Pro): at most once a day, only when something changed ---- */
async function driveAutoCheck() {
  if (!drive.connected || !drive.auto || !isPro() || driveBusy) return;
  if (Date.now() - drive.lastAt < DRIVE_AUTO_EVERY) return;
  let file; try { file = driveBuild(); } catch (e) { return; }
  if (file.hash === drive.lastHash) return; // nothing changed since the last backup
  try { await driveBackupNow({ auto: true }); renderDriveCard(); }
  catch (e) { if (e.code === 'cancelled' || e.code === 'consent') { drive.attention = true; saveDrive(); renderDriveCard(); } /* network and the rest: try again next time */ }
}

/* ---- UI ---- */
const fmtWhen = ms => { try { return new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return new Date(ms).toISOString(); } };
const fmtSize = n => { n = +n || 0; return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; };
function driveErrText(e) {
  switch (e && e.code) {
    case 'network': return tr("Couldn't reach Google Drive. Check your connection and try again.");
    case 'unavailable': case 'setup': return tr("Google Drive isn't set up in this version yet.");
    case 'cancelled': case 'consent': return tr('Sign-in was cancelled.');
    default: return tr('Backup failed.') + ((e && e.message) ? ' ' + String(e.message).slice(0, 80) : '');
  }
}
function renderDriveCard() {
  const c = $('#driveCard'); if (!c) return;
  const btn = (id, label, cls) => '<button class="' + (cls || 'btn alt') + '" id="' + id + '">' + esc(label) + '</button>';
  let h = '<b>' + esc(tr('Google Drive backup')) + '</b>';
  if (!drive.connected) {
    h += '<p class="muted" style="margin:0;font-size:13px">' + esc(tr('Back up to your own Google Drive and restore on any phone signed in to the same Google account. Only PocketKit can see these backups.')) + '</p>' +
      '<div class="row">' + btn('driveConnectBtn', tr('Connect Google Drive'), 'btn') + btn('driveRestoreBtn', tr('Restore from Google Drive')) + '</div>';
  } else {
    h += '<p class="ok" style="margin:0">✓ ' + esc(drive.email ? tr('Connected as {e}').replace('{e}', drive.email) : tr('Connected')) + '</p>' +
      '<p class="muted" style="margin:0;font-size:13px">' + esc(drive.lastAt ? tr('Last backup: {d}').replace('{d}', fmtWhen(drive.lastAt)) : tr('No backup yet')) + '</p>' +
      (drive.attention ? '<p class="status" style="margin:0">' + esc(tr('Reconnect Google Drive to keep backing up.')) + '</p>' : '') +
      '<div class="row">' + btn('driveBackupBtn', tr('Back up now'), 'btn') + btn('driveRestoreBtn', tr('Restore from Google Drive')) + '</div>' +
      '<label class="item"><span class="grow">' + esc(tr('Automatic backup')) + (isPro() ? '' : ' 🔒') + '<br><small class="muted">' + esc(tr('Once a day when something changed.')) + '</small></span><input type="checkbox" id="driveAutoToggle"' + (drive.auto && isPro() ? ' checked' : '') + ' aria-label="' + esc(tr('Automatic backup')) + '"></label>' +
      btn('driveOffBtn', tr('Disconnect'));
  }
  h += '<p class="muted" style="margin:0;font-size:12px">' + esc(tr('Not included: recordings, locked files and the Password Vault.')) + '</p>';
  c.innerHTML = h;
  const on = (id, fn) => { const b = $('#' + id, c); if (b) b.onclick = fn; };
  on('driveConnectBtn', async () => { try { await driveConnect(); renderDriveCard(); } catch (e) { toast(driveErrText(e)); } });
  on('driveBackupBtn', driveManualBackup);
  on('driveRestoreBtn', driveRestoreFlow);
  on('driveOffBtn', () => { driveDisconnect(); renderDriveCard(); toast(tr('Disconnected from Google Drive.')); });
  const tg = $('#driveAutoToggle', c);
  if (tg) tg.onchange = () => {
    if (tg.checked && needPro('drive')) { tg.checked = false; return; }
    drive.auto = tg.checked; saveDrive(); if (drive.auto) driveAutoCheck();
  };
}
async function driveManualBackup() {
  if (driveBusy) return;
  toast(tr('Backing up…'));
  try { await driveBackupNow({ auto: false }); renderDriveCard(); toast(tr('Backup saved to Google Drive.')); }
  catch (e) { toast(driveErrText(e)); }
}
/* Restore: connect if needed, list the account's backups, pick one, confirm, download, put it back. */
async function driveRestoreFlow() {
  if (driveBusy) return;
  let files;
  try {
    if (!drive.connected) await driveConnect();
    files = await driveList(true);
    renderDriveCard();
  } catch (e) { return toast(driveErrText(e)); }
  if (!files.length) return toast(tr('No backups found in Google Drive for this account.'));
  const list = $('#driveList');
  list.innerHTML = files.map((f, i) => {
    const p = f.appProperties || {}, items = +p.items || 0;
    return '<button class="item" data-i="' + i + '" style="text-align:left;width:100%;min-height:56px"><span class="grow"><b>' + esc(fmtWhen(Date.parse(f.modifiedTime))) + '</b><br><small class="muted">' + esc(p.kind === 'auto' ? tr('Automatic') : tr('Manual')) + (items ? ' · ' + items + ' ' + esc(tr('items')) : '') + ' · ' + esc(fmtSize(f.size)) + '</small></span></button>';
  }).join('');
  list.onclick = async e => {
    const b = e.target.closest('button[data-i]'); if (!b) return;
    const f = files[+b.dataset.i]; if (!f) return;
    if (!confirm(tr('Put this backup back? It replaces the matching settings and saved data in PocketKit.'))) return;
    $('#driveDlg').close(); toast(tr('Restoring…'));
    try {
      const text = await driveDownloadText(f.id);
      if (text.length > 6 * 1024 * 1024) throw new Error('too large');
      const n = applyBackup(text);
      drive.lastHash = driveBuild().hash; saveDrive(); // the data now matches this backup: no automatic backup needed
      toast(tr('Restored {n} items').replace('{n}', n));
    } catch (err) { toast(err && err.code ? driveErrText(err) : tr('That is not a PocketKit backup')); }
  };
  $('#driveCancel').onclick = () => $('#driveDlg').close();
  $('#driveDlg').showModal();
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) driveAutoCheck(); });
renderDriveCard();
setTimeout(driveAutoCheck, 4000);
