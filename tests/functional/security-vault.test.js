'use strict';
const { suite } = require('../helpers/page');
const { run, bootSec, mkFile, setFiles, readBlob, setup, unlock, STRONG } = require('./security.helper');
setTimeout(() => { console.log('WATCHDOG: test hung'); process.exit(2); }, 100000).unref();
run(async () => {
  const T = suite('security-vault'), page = await bootSec(), w = page.w;
  let t = await page.open('vault');
  await page.wait(300);
  T.has(t.text(), 'Create your Password Vault', 'first-use screen offers to create the vault');
  T.has(t.text(), 'no way to recover', 'first-use screen warns that a forgotten password cannot be recovered');

  // --- setup validation ---
  t.type('#s1', 'short'); t.type('#s2', 'short'); t.click('#s-go'); await page.wait(50);
  T.has(t.text(), 'at least 8 characters', 'short master password refused');
  t.type('#s1', STRONG); t.type('#s2', STRONG + 'x'); t.click('#s-go'); await page.wait(50);
  T.has(t.text(), 'do not match', 'mismatched confirmation refused');
  t.type('#s2', STRONG); t.click('#s-go'); await page.wait(50);
  T.has(t.text(), 'tick the box', 'must confirm the no-recovery warning');
  t.check('#s-ok', true);
  t.type('#s1', 'password1'); t.type('#s2', 'password1'); t.click('#s-go'); await page.wait(50);
  T.has(t.text(), 'too easy to guess', 'common password refused by the strength gate');
  T.ok(!t.q('#s-any').hidden, '"Use anyway" button appears after the gate');
  T.eq(await new Promise(r => { const q = w.indexedDB.open('pk-vault'); q.onsuccess = () => { const g = q.result.transaction('kv').objectStore('kv').get('rec'); g.onsuccess = () => { q.result.close(); r(g.result); }; }; }), undefined, 'no password record is stored before the user accepts');
  t.type('#s1', 'Qwerty123456'); t.type('#s2', 'Qwerty123456'); t.click('#s-go'); await page.wait(50);
  T.has(t.text(), 'too easy to guess', 'leet/keyboard pattern password refused');
  t.type('#s1', STRONG); t.type('#s2', STRONG);
  T.ok(t.q('#s-any').hidden, 'Use anyway hides again when the password changes');
  t.click('#s-go'); await page.wait(1500);
  T.has(t.text(), 'Password Vault', 'unlocked after creating');
  T.has(t.text(), 'No passwords saved yet', 'empty state text');
  T.eq(page.native.secure[page.native.secure.length - 1], true, 'FLAG_SECURE turned on when unlocked');
  T.has(t.text(), '0 of 5 free entries used', 'free limit shown');

  // --- add entries ---
  const addEntry = async (title, user, pass, url) => {
    t.click('#v-add'); await page.wait(30);
    t.type('#e-t', title); t.type('#e-u', user); t.type('#e-p', pass); t.type('#e-w', url || '');
    t.click('#e-s'); await page.wait(400);
  };
  t.click('#v-add'); await page.wait(30);
  t.click('#e-s'); await page.wait(30);
  T.has(t.text(), 'Give the entry a title', 'entry without title refused');
  t.click('#e-c'); await page.wait(30);
  T.ok(!t.has('dialog[open]') || t.all('dialog').length === 0, 'cancel closes the dialog');
  await addEntry('Bank', 'me@bank.com', 'P@ss-One-1', 'bank.com');
  await addEntry('Mail', 'me@mail.com', 'P@ss-Two-2');
  T.has(t.text(), 'Bank', 'entry listed'); T.has(t.text(), '2 of 5 free entries used', 'count updates');
  T.ok(!t.text().includes('P@ss-One-1'), 'password hidden by default');
  t.click('[data-id] [data-a=sh]'); await page.wait(20);
  T.ok(t.text().includes('P@ss-One-1') || t.text().includes('P@ss-Two-2'), 'Show reveals the password');
  // search
  t.type('#v-q', 'bank'); T.ok(t.text().includes('Bank') && !t.text().includes('Mail'), 'search filters'); t.type('#v-q', 'zzz'); T.has(t.text(), 'No entries match', 'no match text'); t.type('#v-q', '');
  // generate
  t.click('[data-id] [data-a=ed]'); await page.wait(30);
  t.type('#e-len', '30'); t.click('#e-gen'); await page.wait(20);
  const gen = t.value('#e-p'); T.eq(gen.length, 30, 'generate honours length 30');
  T.ok(/[a-z]/.test(gen) && /[A-Z]/.test(gen) && /[0-9]/.test(gen) && /[^A-Za-z0-9]/.test(gen), 'generated password has all classes');
  t.type('#e-t', 'Bank 2'); t.click('#e-s'); await page.wait(400);
  T.has(t.text(), 'Bank 2', 'edit saved title');
  // XSS safety
  await addEntry('<img src=x onerror=window.__x=1>', '<b>u</b>', 'x');
  T.ok(!w.__x && !t.has('[data-id] img'), 'titles are escaped (no HTML injection)');
  // copy
  const cards = () => t.all('[data-id]');
  const pwdCard = cards().find(c => c.textContent.includes('Mail'));
  pwdCard.querySelector('[data-a=cp]').click(); await page.wait(50);
  T.eq(page.native.copies.length, 1, 'copy password uses the native sensitive copy');
  T.eq(page.native.copies[0].text, 'P@ss-Two-2', 'native copy gets the password');
  T.eq(page.native.copies[0].clearMs, 30000, 'native copy clears after 30 s');
  pwdCard.querySelector('[data-a=cu]').click(); await page.wait(50);
  T.eq(w.__clip, 'me@mail.com', 'copy user uses normal copy');
  T.eq(page.native.copies.length, 1, 'username copy is not treated as sensitive');
  // free limit
  await addEntry('Four', 'a', 'a'); await addEntry('Five', 'a', 'a');
  T.eq(cards().length, 5, 'five entries stored');
  t.click('#v-add'); await page.wait(30);
  T.eq(page.pro(), 1, 'the sixth entry opens the Pro sheet');
  T.ok(!t.has('#e-t'), 'no entry dialog while over the free limit');
  // delete
  t.click('[data-id] [data-a=ed]'); await page.wait(30); t.click('#e-d'); await page.wait(400);
  T.eq(cards().length, 4, 'delete removes an entry');

  // --- lock / unlock ---
  t.click('#sx-lock'); await page.wait(100);
  T.has(t.text(), 'Password Vault is locked', 'lock screen'); T.ok(!t.text().includes('Bank'), 'no entries visible while locked');
  T.eq(page.native.secure[page.native.secure.length - 1], false, 'FLAG_SECURE off after lock');
  await unlock(t, page, 'wrong-password-1', 1200);
  T.has(t.text(), 'Wrong password', 'wrong password message');
  for (let i = 0; i < 3; i++) { await unlock(t, page, 'wrong-pw-' + i, 1200); }
  T.has(t.text(), 'Wrong password', 'still plain wrong password before 5');
  await unlock(t, page, 'wrong-pw-5', 1200);
  T.has(t.text(), 'Too many wrong attempts', 'lockout after 5 failures');
  T.ok(t.q('#u-go').disabled, 'unlock button disabled during lockout');
  t.q('#u-go').disabled = false; t.type('#u1', STRONG); t.click('#u-go'); await page.wait(1200);
  T.has(t.text(), 'Too many wrong attempts', 'correct password refused while locked out');
  page.skew(31000); await page.wait(700);
  T.ok(!t.q('#u-go').disabled, 'lockout ends after 30 s');
  await unlock(t, page, STRONG, 1500);
  T.has(t.text(), 'Bank 2', 'unlock with the right password restores entries');
  T.ok(t.text().includes('Mail'), 'all entries back');
  // lockout counter reset after success
  t.click('#sx-lock'); await page.wait(100); await unlock(t, page, 'wrong', 1200); T.has(t.text(), 'Wrong password', 'counter reset after success: no immediate lockout');
  await unlock(t, page, STRONG, 1500);

  // --- backup export / import ---
  const det = t.q('details'); det.open = true;
  t.click('#b-ex'); await page.wait(400);
  const blobs = [...w.__blobs.values()];
  const bk = blobs[blobs.length - 1]; const raw = (await readBlob(bk)).toString();
  T.ok(!/Bank|me@bank|P@ss-/.test(raw), 'backup file contains no plaintext');
  const bj = JSON.parse(raw); T.eq(bj.type, 'vault', 'backup is tagged as a vault backup');
  T.has(t.text(), 'Backup exported', 'export confirmation');

  const page2 = await bootSec(); const w2 = page2.w;
  let t2 = await page2.open('vault'); await page2.wait(300);
  await setup(t2, page2, 'Another-Strong-Pw-77!'); T.has(t2.text(), 'Password Vault', 'second page vault created');
  t2.q('details').open = true;
  const doImport = async (text, pw, tt, pg, ww) => {
    setFiles(tt, ww, '#b-file', [new ww.File([text], 'b.json')]); await pg.wait(200);
    if (pw !== null) { tt.type('#ap', pw); tt.clickText('Continue'); await pg.wait(1500); }
  };
  await doImport(raw, STRONG, t2, page2, w2);
  T.has(t2.text(), 'Imported 4 items', 'backup imports 4 items into a clean vault');
  T.has(t2.text(), 'Mail', 'imported entry visible');
  await doImport(raw, STRONG, t2, page2, w2);
  T.has(t2.text(), 'Imported 0 items', 'importing the same backup again adds nothing (no duplicates)');
  await doImport(raw, 'not the password', t2, page2, w2);
  T.has(t2.text(), 'Could not open the backup', 'wrong backup password refused');
  const tam = JSON.parse(raw); const ctb = Buffer.from(tam.ct, 'base64'); ctb[3] ^= 1; tam.ct = ctb.toString('base64');
  await doImport(JSON.stringify(tam), STRONG, t2, page2, w2);
  T.has(t2.text(), 'Could not open the backup', 'tampered ciphertext refused');
  const tam2 = JSON.parse(raw); tam2.iter = 310001;
  await doImport(JSON.stringify(tam2), STRONG, t2, page2, w2);
  T.has(t2.text(), 'Could not open the backup', 'tampered iteration count refused');
  const tam3 = JSON.parse(raw); tam3.iter = 99999999;
  await doImport(JSON.stringify(tam3), STRONG, t2, page2, w2);
  T.has(t2.text(), 'Could not open the backup', 'absurd iteration count refused without freezing');
  await doImport('{"app":"PocketKit","type":"notes"}', null, t2, page2, w2);
  T.has(t2.text(), 'different tool', 'backup of another tool refused');
  await doImport('not json', null, t2, page2, w2);
  T.has(t2.text(), 'not a PocketKit backup', 'garbage file refused');
  // a backup written for another tool name cannot be replayed (AAD binds the name)
  page2.close();

  // --- leaving the tool ---
  const before = page.native.secure.length;
  t.close(); await page.wait(50);
  T.eq(page.native.secure[page.native.secure.length - 1], false, 'FLAG_SECURE off when leaving the tool');
  await T.done(page);
});
