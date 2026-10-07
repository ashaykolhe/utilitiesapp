'use strict';
const nodeCrypto = require('crypto').webcrypto;
const { suite } = require('../helpers/page');
const { run, bootSec, mkFile, setFiles, readBlob, setup, unlock, STRONG } = require('./security.helper');
setTimeout(() => { console.log('WATCHDOG: test hung'); process.exit(2); }, 150000).unref();

const idbDump = (idb, name, ver) => new Promise((res, rej) => {
  const q = idb.open(name); q.onerror = () => rej(q.error);
  q.onsuccess = () => {
    const db = q.result, out = {}, names = [...db.objectStoreNames];
    let left = names.length; if (!left) { db.close(); res(out); }
    names.forEach(n => { const g = db.transaction(n).objectStore(n).getAll(); g.onsuccess = () => { out[n] = g.result; if (!--left) { db.close(); res(out); } }; });
  };
});
const idbPut = (idb, name, store, key, val) => new Promise((res, rej) => {
  const q = idb.open(name); q.onsuccess = () => { const db = q.result, tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(val, key); tx.oncomplete = () => { db.close(); res(); }; tx.onerror = () => rej(tx.error); };
});
const rb = n => Buffer.from(nodeCrypto.getRandomValues(new Uint8Array(n)));

run(async () => {
  const T = suite('security-locker');
  if (process.env.SECDBG) for (const k of ['ok', 'eq', 'has']) { const f = T[k].bind(T); T[k] = (...a) => { console.log(k, a[a.length - 1]); return f(...a); }; }
  const page = await bootSec(), w = page.w;
  const t = await page.open('locker'); await page.wait(300);
  T.has(t.text(), 'Create your File Locker', 'first-use screen');
  await setup(t, page, STRONG);
  T.has(t.text(), '0 locked files', 'unlocked locker'); T.has(t.text(), 'Nothing here yet', 'empty state');
  T.eq(page.native.secure.slice(-1)[0], true, 'FLAG_SECURE on while unlocked');

  const bytesA = rb(5000), bytesB = Buffer.from('hello locker, line 2\nünïcode ✓'), bytesC = Buffer.alloc(0);
  const add = async (files, ms) => { setFiles(t, w, '#lk-in', files); await page.wait(ms || 900); };
  await add([mkFile(w, 'photo.bin', bytesA, 'application/octet-stream'), mkFile(w, 'note ünï.txt', bytesB, 'text/plain')], 1200);
  T.has(t.text(), '2 locked files', 'two files counted');
  T.has(t.text(), 'photo.bin', 'name listed (decrypted)'); T.has(t.text(), 'note ünï.txt', 'unicode name listed');
  T.has(t.text(), 'free limit 2 of 3', 'free limit shown');
  // nothing readable on disk
  const dump = JSON.stringify(await idbDump(page.idb, 'pk-locker'));
  T.ok(!dump.includes('photo') && !dump.includes('hello'), 'no file name or content in storage as plain text');
  const raw = await idbDump(page.idb, 'pk-locker');
  T.ok(raw.blobs.length === 2 && raw.meta.length === 2, 'two blob and two meta records');
  T.ok(!Buffer.from(raw.blobs[0].dc).includes(bytesA.subarray(0, 32)) && !Buffer.from(raw.blobs[1].dc).includes(bytesA.subarray(0, 32)), 'ciphertext does not contain the plaintext');

  const card = name => t.all('[data-id]').find(c => c.textContent.includes(name));
  const lastBlob = () => [...w.__blobs.values()].pop();
  card('photo.bin').querySelector('[data-a=exp]').click(); await page.wait(500);
  const exp1 = await readBlob(lastBlob());
  T.ok(exp1.equals(bytesA), 'export of the binary file decrypts to identical bytes');
  T.has(t.text(), 'NOT encrypted', 'export warns the copy is not encrypted');
  card('note').querySelector('[data-a=exp]').click(); await page.wait(500);
  T.ok((await readBlob(lastBlob())).equals(bytesB), 'export of the text file is identical');
  // view
  card('note').querySelector('[data-a=view]').click(); await page.wait(500);
  const dlg = t.all('dialog')[0];
  T.ok(dlg && dlg.textContent.includes('hello locker'), 'view shows the text content');
  const viewUrlsBefore = w.__blobs.size;
  dlg.querySelector('#v-x').click(); await page.wait(50);
  T.ok(w.__revoked.length >= 1, 'blob URL revoked when the viewer is closed');
  card('photo.bin').querySelector('[data-a=view]').click(); await page.wait(500);
  T.has(t.all('dialog')[0].textContent, 'No preview', 'unknown type has no preview but offers Export');
  t.all('dialog')[0].querySelector('#v-x').click(); await page.wait(50);

  // empty file and a file that fails to be there
  await add([mkFile(w, 'empty.txt', bytesC, 'text/plain')], 800);
  T.has(t.text(), '3 locked files', 'empty file can be locked');
  card('empty.txt').querySelector('[data-a=exp]').click(); await page.wait(400);
  T.eq((await readBlob(lastBlob())).length, 0, 'empty file exports as empty');

  // free limit
  const p0 = page.pro();
  await add([mkFile(w, 'fourth.txt', 'x', 'text/plain')], 600);
  T.eq(page.pro(), p0 + 1, 'fourth file opens the Pro sheet');
  T.has(t.text(), '3 locked files', 'fourth file not stored'); T.ok(!t.text().includes('fourth.txt'), 'fourth not listed');
  T.has(t.text(), 'Free limit reached', 'message explains the limit');

  // delete
  card('empty.txt').querySelector('[data-a=del]').click(); await page.wait(400);
  T.has(t.text(), '2 locked files', 'delete removes the file'); T.ok(!t.text().includes('empty.txt'), 'deleted file gone');
  T.eq((await idbDump(page.idb, 'pk-locker')).blobs.length, 2, 'deleted file removed from storage too');

  // 200 MB cap and large-file warning (fake File objects: size is checked before anything is read)
  let read = 0;
  const big = (name, size) => ({ name, size, type: 'video/mp4', arrayBuffer: async () => { read++; return new ArrayBuffer(8); } });
  await add([big('huge.mp4', 201 * 1048576)], 300);
  T.has(t.text(), 'over 200 MB', 'file over 200 MB refused with a message'); T.eq(read, 0, 'oversized file is never read into memory');
  T.ok(!t.text().includes('huge.mp4 ·') && t.all('[data-id]').length === 2, 'oversized file not stored');
  let asked = '';
  w.confirm = m => { asked = m; return false; };
  await add([big('long.mp4', 150 * 1048576)], 300);
  T.has(asked, 'long.mp4', 'files over 100 MB ask for confirmation'); T.eq(read, 0, 'declined large file not read');
  w.confirm = () => true;

  // change password
  t.q('details').open = true;
  t.type('#c0', 'wrong-current-pw'); t.type('#c1', 'Brand-New-Pw-9876!'); t.type('#c2', 'Brand-New-Pw-9876!'); t.click('#c-go'); await page.wait(700);
  T.has(t.text(), 'Current password is not correct', 'wrong current password refused when changing');
  t.type('#c0', STRONG); t.type('#c1', 'abc'); t.type('#c2', 'abc'); t.click('#c-go'); await page.wait(100);
  T.has(t.text(), 'at least 8 characters', 'short new password refused');
  t.type('#c1', 'password123'); t.type('#c2', 'password123'); t.click('#c-go'); await page.wait(100);
  T.has(t.text(), 'too easy to guess', 'weak new password refused (Use anyway offered)');
  t.type('#c1', 'Brand-New-Pw-9876!'); t.type('#c2', 'different'); t.click('#c-go'); await page.wait(100);
  T.has(t.text(), 'do not match', 'mismatched new password refused');
  t.type('#c2', 'Brand-New-Pw-9876!'); t.click('#c-go');
  await page.until(() => /Password changed/.test(w.document.getElementById('toast').textContent), 8000);
  T.has(w.document.getElementById('toast').textContent, 'Password changed', 'password changed');
  await page.until(() => t.all('[data-id]').length === 2, 3000);
  T.ok(t.all('[data-id]').length === 2 && t.text().includes('photo.bin'), 'files still listed after change');
  t.click('#sx-lock'); await page.wait(100);
  await unlock(t, page, STRONG, 1000); T.has(t.text(), 'Wrong password', 'old password no longer works');
  await unlock(t, page, 'Brand-New-Pw-9876!', 1500);
  T.has(t.text(), 'photo.bin', 'new password unlocks');
  card('photo.bin').querySelector('[data-a=exp]').click(); await page.wait(500);
  T.ok((await readBlob(lastBlob())).equals(bytesA), 'file readable and identical after the password change');
  card('note').querySelector('[data-a=exp]').click(); await page.wait(500);
  T.ok((await readBlob(lastBlob())).equals(bytesB), 'second file identical after the password change');

  // tamper: flip a byte of one ciphertext
  let d = await idbDump(page.idb, 'pk-locker');
  const target = d.blobs[0]; const kk = target.id; const bad = new Uint8Array(target.dc); bad[10] ^= 4;
  await idbPut(page.idb, 'pk-locker', 'blobs', kk, { id: kk, di: target.di, dc: bad });
  t.click('#sx-lock'); await page.wait(100); await unlock(t, page, 'Brand-New-Pw-9876!', 1500);
  const badCard = t.all('[data-id]').find(c => c.dataset.id === kk);
  badCard.querySelector('[data-a=exp]').click(); await page.wait(400);
  T.has(t.text(), 'Could not export', 'tampered file refuses to export');
  badCard.querySelector('[data-a=view]').click(); await page.wait(400);
  T.has(t.text(), 'Could not decrypt', 'tampered file refuses to open');
  // swap two files' ciphertexts: AAD binds each to its own id
  const o = d.blobs[1];
  await idbPut(page.idb, 'pk-locker', 'blobs', kk, { id: kk, di: o.di, dc: o.dc });
  t.click('#sx-lock'); await page.wait(100); await unlock(t, page, 'Brand-New-Pw-9876!', 1500);
  t.all('[data-id]').find(c => c.dataset.id === kk).querySelector('[data-a=exp]').click(); await page.wait(400);
  T.has(t.text(), 'Could not export', 'ciphertext swapped between files is detected');
  // damaged metadata
  const m = d.meta[0]; const mb = new Uint8Array(m.mc); mb[2] ^= 1;
  await idbPut(page.idb, 'pk-locker', 'meta', m.id, { id: m.id, mi: m.mi, mc: mb, ti: null, tc: null });
  t.click('#sx-lock'); await page.wait(100); await unlock(t, page, 'Brand-New-Pw-9876!', 1500);
  T.has(t.text(), '(damaged item)', 'damaged metadata shown as a damaged item');
  T.ok(t.all('[data-id]').find(c => c.textContent.includes('damaged')).querySelector('[data-a=del]'), 'damaged item can still be deleted');

  // auto-lock: idle
  T.ok(t.has('#sx-lock'), 'unlocked before idling');
  page.skew(121000); await page.until(() => t.has('#u1'), 4500);
  T.has(t.text(), 'File Locker is locked', 'idle for 2 minutes locks the locker');
  T.eq(page.native.secure.slice(-1)[0], false, 'FLAG_SECURE off after idle lock');
  await unlock(t, page, 'Brand-New-Pw-9876!', 1500);
  // away in background > 60 s
  let hidden = false; Object.defineProperty(w.document, 'hidden', { configurable: true, get: () => hidden });
  hidden = true; w.document.dispatchEvent(new w.Event('visibilitychange')); page.skew(30000);
  hidden = false; w.document.dispatchEvent(new w.Event('visibilitychange')); await page.wait(50);
  T.ok(t.has('#sx-lock'), 'back after 30 s stays unlocked');
  hidden = true; w.document.dispatchEvent(new w.Event('visibilitychange')); page.skew(61000);
  hidden = false; w.document.dispatchEvent(new w.Event('visibilitychange')); await page.wait(100);
  T.ok(t.has('#u1'), 'away for over 60 s locks on return');
  await unlock(t, page, 'Brand-New-Pw-9876!', 1500);
  // picker hold: away while the file chooser is open does not lock
  t.click('#lk-add');
  hidden = true; w.document.dispatchEvent(new w.Event('visibilitychange')); page.skew(70000);
  hidden = false; w.document.dispatchEvent(new w.Event('visibilitychange')); await page.wait(100);
  T.ok(t.has('#sx-lock'), 'no lock while a file picker is open');

  // leaving the tool locks and clears FLAG_SECURE
  t.close(); await page.wait(50);
  T.eq(page.native.secure.slice(-1)[0], false, 'FLAG_SECURE off after leaving the tool');

  // two sealed tools at once: FLAG_SECURE stays on until both are locked
  const a = await page.open('vault'), b = await page.open('secretnotes'); await page.wait(200);
  await setup(a, page, STRONG); await setup(b, page, STRONG);
  a.click('#sx-lock'); await page.wait(50);
  T.eq(page.native.secure.slice(-1)[0], true, 'FLAG_SECURE stays on while another sealed tool is unlocked');
  b.click('#sx-lock'); await page.wait(50);
  T.eq(page.native.secure.slice(-1)[0], false, 'FLAG_SECURE off after the last one locks');
  a.close(); b.close();
  await T.done(page);
});
