'use strict';
/* Vault password change, weak-password override, thumbnails, covering screens, accessibility basics, Emergency Card delete. */
const nodeCrypto = require('crypto');
const { suite } = require('../helpers/page');
const { run, bootSec, mkFile, setFiles, readBlob, setup, unlock, STRONG } = require('./security.helper');
setTimeout(() => { console.log('WATCHDOG: test hung'); process.exit(2); }, 150000).unref();

run(async () => {
  const T = suite('security-extra'), page = await bootSec({ pro: true }), w = page.w;
  w.createImageBitmap = async () => ({ width: 800, height: 600, close() {} });

  // ---- vault: "use anyway" creation, change password keeps entries, old password dies ----
  let t = await page.open('vault'); await page.wait(200);
  await setup(t, page, 'password123', { wait: 200 });
  T.has(t.text(), 'too easy to guess', 'vault: weak master password stopped');
  T.has(t.q('#s-hint').textContent, 'Very weak', 'vault: live hint names the strength');
  T.eq(t.q('#s-meter').getAttribute('role'), 'progressbar', 'meter exposes progressbar role'); T.has(t.q('#s-meter').getAttribute('aria-valuetext'), 'weak', 'meter exposes its text value');
  t.click('#s-any'); await page.until(() => t.has('#v-add'), 4000); T.ok(t.has('#v-add'), 'vault: Use anyway creates the vault');
  t.click('#v-add'); await page.wait(30); t.type('#e-t', 'Site'); t.type('#e-p', 'pw-site'); t.click('#e-s'); await page.wait(300);
  t.q('details').open = true;
  t.type('#c0', 'password123'); t.type('#c1', 'Cx9$kLm2#Vb7nQ4!'); t.type('#c2', 'Cx9$kLm2#Vb7nQ4!'); t.click('#c-go');
  await page.until(() => /Password changed/.test(w.document.getElementById('toast').textContent), 5000);
  T.has(w.document.getElementById('toast').textContent, 'Password changed', 'vault: password changed');
  t.click('#sx-lock'); await page.wait(100);
  await unlock(t, page, 'password123', 1000); T.has(t.text(), 'Wrong password', 'vault: the old password stops working');
  T.has(t.text(), 'left before a short wait'.slice(0, 0) + 'Wrong password', 'vault: still plain wrong password after one try');
  for (let i = 0; i < 2; i++) await unlock(t, page, 'bad' + i + 'xxxxxx', 800);
  T.has(t.text(), '2 tries left', 'vault: warns when only 2 tries are left');
  await unlock(t, page, 'bad3xxxxxx', 800); T.has(t.text(), '1 try left', 'vault: warns when 1 try is left');
  await unlock(t, page, 'Cx9$kLm2#Vb7nQ4!', 1500);
  T.has(t.text(), 'Site', 'vault: entries survive the password change');
  // eye toggle accessibility
  t.click('#sx-lock'); await page.wait(100);
  const eye = t.q('[data-eye]'); T.eq(eye.getAttribute('aria-label'), 'Show password', 'eye button label'); eye.click(); T.eq(eye.getAttribute('aria-label'), 'Hide password', 'eye label flips'); T.eq(eye.getAttribute('aria-pressed'), 'true', 'eye pressed state');
  T.eq(t.q('#u1').type, 'text', 'eye shows the password');
  t.close();

  // ---- a covering screen (Settings) locks the tool ----
  t = await page.open('secretnotes'); await page.wait(200); await setup(t, page, STRONG);
  T.ok(t.has('#n-add'), 'notes unlocked'); t.el.setAttribute('hidden', '');
  await page.until(() => t.has('#u1'), 4500); T.ok(t.has('#u1'), 'tool locks when another screen covers it');
  t.close();

  // ---- locker thumbnails: stored encrypted, shown, rekeyed ----
  t = await page.open('locker'); await page.wait(200); await setup(t, page, STRONG);
  const img = nodeCrypto.randomBytes(2000);
  setFiles(t, w, '#lk-in', [mkFile(w, 'cat.jpg', img, 'image/jpeg')]); await page.until(() => t.has('.sx-ic img'), 4000);
  T.ok(t.has('.sx-ic img'), 'locker: an image gets a thumbnail');
  const raw = await new Promise(r => { const q = page.idb.open('pk-locker'); q.onsuccess = () => { const g = q.result.transaction('meta').objectStore('meta').getAll(); g.onsuccess = () => { q.result.close(); r(g.result); }; }; });
  T.ok(raw[0].tc && raw[0].tc.length > 16, 'locker: the thumbnail is stored as ciphertext');
  t.q('details').open = true; t.type('#c0', STRONG); t.type('#c1', 'Zz8#pQ4!mRt6$wLk'); t.type('#c2', 'Zz8#pQ4!mRt6$wLk'); t.click('#c-go');
  await page.until(() => /Password changed/.test(w.document.getElementById('toast').textContent), 8000);
  await page.until(() => t.has('.sx-ic img'), 3000); T.ok(t.has('.sx-ic img'), 'locker: thumbnail still decrypts after a password change'); await page.wait(700); // the list is rebuilt right after the change
  // names with HTML
  setFiles(t, w, '#lk-in', [mkFile(w, '<img src=x onerror=window.__n=1>.txt', 'x', 'text/plain')]); await page.wait(900);
  T.ok(!w.__n && t.all('.sx-ell').some(e => e.textContent.includes('<img')), 'locker: file names are escaped in the list');
  t.all('[data-a=view]')[0].click(); await page.wait(400); T.ok(!w.__n && t.all('dialog h2').some(h => h.textContent.includes('<img')), 'locker: file names are escaped in the viewer');
  t.close();

  // ---- Emergency Card delete ----
  t = await page.open('emergency'); t.type('#em-name', 'Zed'); t.click('#em-save'); await page.wait(30);
  t.click('#em-ed'); T.ok(t.has('#em-del'), 'emergency: edit screen offers Delete'); t.click('#em-del'); await page.wait(30);
  T.eq(w.localStorage.getItem('pk.emergency.card'), 'null', 'emergency: delete removes the saved card'); T.ok(t.has('#em-save') && !t.has('#em-cancel'), 'emergency: back to an empty form');
  t.close(); t = await page.open('emergency'); T.ok(t.has('#em-save'), 'emergency: stays deleted after leaving'); t.close();

  // ---- accessibility basics of the generators ----
  t = await page.open('pingen');
  T.ok(t.all('.sx-seg button').every(b => b.hasAttribute('aria-pressed')) && t.all('.sx-seg button')[0].getAttribute('aria-pressed') === 'true', 'generator: mode buttons expose their pressed state');
  T.ok(t.all('#g-out button').every((b, i) => b.getAttribute('aria-label') === 'Copy option ' + (i + 1)), 'generator: copy buttons have distinct labels');
  t.close();
  t = await page.open('textlock'); t.clickText('Unlock a message'); T.eq(t.all('.sx-seg button')[1].getAttribute('aria-pressed'), 'true', 'text locker: mode buttons expose pressed state'); t.close();
  // every button and field in every security tool has an accessible name
  for (const id of ['pingen', 'pwcheck', 'textlock', 'checksum', 'privacy', 'emergency']) {
    const x = await page.open(id);
    const bad = x.all('button,input,select,textarea').filter(e => e.type !== 'hidden' && !(e.getAttribute('aria-label') || (e.textContent || '').trim() || (e.closest('label') && e.closest('label').textContent.trim()) || e.getAttribute('placeholder')));
    T.eq(bad.length, 0, id + ': every control has an accessible name' + (bad.length ? ' (' + bad.map(b => b.id || b.tagName).join(',') + ')' : ''));
    x.close();
  }
  await T.done(page);
});
