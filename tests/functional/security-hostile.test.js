'use strict';
/* Hostile and unusual input: crafted backups, damaged records, lockout persistence, biometrics (fake plugin), old locker data (v1 migration),
   native file export, plus exact-value checks of the pure helpers. */
const nodeCrypto = require('crypto');
const { suite } = require('../helpers/page');
const { loadPure, run, bootSec, mkFile, setFiles, readBlob, setup, unlock, STRONG } = require('./security.helper');
setTimeout(() => { console.log('WATCHDOG: test hung'); process.exit(2); }, 200000).unref();

const P = loadPure();
const kvGet = (idb, name) => new Promise(r => { const q = idb.open(name); q.onsuccess = () => { const g = q.result.transaction('kv').objectStore('kv').get('rec'); g.onsuccess = () => { q.result.close(); r(g.result); }; }; });
const kvPut = (idb, name, rec) => new Promise(r => { const q = idb.open(name); q.onsuccess = () => { const tx = q.result.transaction('kv', 'readwrite'); tx.objectStore('kv').put(rec, 'rec'); tx.oncomplete = () => { q.result.close(); r(); }; }; });
async function craft(type, pw, obj) { const r = await P.sealedCreate(type, pw, obj, 310000); return JSON.stringify(Object.assign({ app: 'PocketKit', type }, r.rec)); }

run(async () => {
  const T = suite('security-hostile');

  // ---------- pure helpers: exact values ----------
  T.eq(P.safeName('../../etc/passwd'), 'etc_passwd', 'safeName: path traversal flattened');
  T.eq(P.safeName('..hidden.txt'), 'hidden.txt', 'safeName: leading dots removed');
  T.eq(P.safeName('a‮gnp.exe'), 'agnp.exe', 'safeName: bidi override removed');
  T.eq(P.safeName('line\nbreak\u0000.txt'), 'linebreak.txt', 'safeName: control characters removed');
  T.eq(P.safeName(''), 'file', 'safeName: empty falls back');
  T.eq(P.safeName('...'), 'file', 'safeName: only dots falls back');
  T.eq(P.safeName('a:b*c?.pdf'), 'a_b_c_.pdf', 'safeName: reserved characters replaced');
  const long = P.safeName('x'.repeat(300) + '.pdf'); T.ok(long.length <= 100 && long.endsWith('.pdf'), 'safeName: the stem is shortened, not the extension');
  T.eq(P.extractHash('SHA256 (f) = ' + 'AB'.repeat(32)), 'ab'.repeat(32), 'extractHash: BSD line');
  T.eq(P.extractHash('xyz'), '', 'extractHash: nothing found');
  T.eq(P.extractHash('ab:cd:ef'), 'abcdef', 'extractHash: colon separated short value falls back to stripping');
  T.eq(Array.from(P.b32decode('MFRGG===')).join(','), '97,98,99', 'b32decode: "abc" (MFRGG)');
  let threw = false; try { P.b32decode('1'); } catch (e) { threw = true; } T.ok(threw, 'b32decode: invalid digit refused');
  const o = P.parseOtpauth('otpauth://totp/Acme%20Co:bob%40x.com?secret=jbsw y3dp&issuer=Acme%20Co&digits=9&period=99999&algorithm=md5');
  T.eq(o.issuer, 'Acme Co', 'otpauth: issuer'); T.eq(o.account, 'bob@x.com', 'otpauth: account'); T.eq(o.digits, 6, 'otpauth: digits 9 clamped to 6');
  T.eq(o.period, 120, 'otpauth: period capped at 120'); T.eq(o.algo, 'SHA-1', 'otpauth: unknown algorithm falls back to SHA-1'); T.eq(o.secret, 'JBSWY3DP', 'otpauth: secret cleaned');
  threw = false; try { P.parseOtpauth('otpauth://hotp/x?secret=AA'); } catch (e) { threw = true; } T.ok(threw, 'otpauth: hotp links refused');
  // RFC 4226 appendix D (HOTP, secret 12345678901234567890, 6 digits)
  const hs = ['755224', '287082', '359152', '969429', '338314', '254676', '287922', '162583', '399871', '520489'];
  for (let i = 0; i < 10; i++) T.eq(await P.hotp(Buffer.from('12345678901234567890'), i), hs[i], 'HOTP RFC 4226 counter ' + i);
  const hi = (() => { const c = Buffer.alloc(8); c.writeBigUInt64BE(4294967301n); const m = nodeCrypto.createHmac('sha1', '12345678901234567890').update(c).digest(), q = m[19] & 15; return String((((m[q] & 127) << 24 | m[q + 1] << 16 | m[q + 2] << 8 | m[q + 3]) >>> 0) % 1e6).padStart(6, '0'); })();
  T.eq(await P.hotp(Buffer.from('12345678901234567890'), 4294967296 + 5), hi, 'HOTP: counters above 2^32 use the high word');
  T.eq(P.humanTime(0.2), 'instantly', 'humanTime: instantly'); T.has(P.humanTime(86400 * 800), 'years', 'humanTime: years');
  // PIN rules
  for (const e of ['0000', '1234', '4321', '1122', '1212', '123123', '2580', '1990', '2024', '369369', '9876', '5555', '000000', '112233']) T.ok(P.isEasyPin(e), 'easy PIN recognised: ' + e);
  for (const g of ['4821', '703519', '5927', '381604']) T.ok(!P.isEasyPin(g), 'normal PIN accepted: ' + g);
  T.ok(P.pinBits(6, true) < 6 * Math.log2(10) && P.pinBits(6, true) > 18, 'pinBits: avoiding easy PINs lowers the count a little, honestly');
  T.ok(Math.abs(P.pinBits(6, false) - 19.93) < 0.01, 'pinBits: 6 digits = 19.93 bits');
  const cnt = new Array(7).fill(0); for (let i = 0; i < 70000; i++) cnt[P.randInt(7)]++; T.ok(cnt.every(c => Math.abs(c - 10000) < 500), 'randInt(7) is uniform');
  // text format: iteration bounds
  threw = false; try { await P.deriveKey('x', new Uint8Array(16), 5000000); } catch (e) { threw = true; } T.ok(threw, 'deriveKey refuses a crafted huge iteration count');
  const enc = await P.encryptText('hi', STRONG, 310000); T.eq(await P.decryptText(enc, STRONG), 'hi', 'text format round trip at the minimum iteration count');
  threw = false; try { await P.encryptText('hi', STRONG, 1000); } catch (e) { threw = true; } T.ok(threw, 'encryptText refuses a weak (too low) iteration count');
  T.eq(await P.decryptText(enc.replace(/(.{20})/g, '$1\n  '), STRONG), 'hi', 'text code pasted with line breaks and spaces still decrypts');
  // password strength: a spread of known examples with the order they must come in
  const order = ['password', 'Summer2019', 'Tr0ub4dor&3', 'k3$Lp9@zQw7!Xv2#Nm'].map(p => P.assess(p).entropy);
  T.ok(order.every((v, i) => i === 0 || v > order[i - 1]), 'assess: weak to strong examples come out in the right order: ' + order.join(' < '));
  T.ok(P.assess('x'.repeat(5000)).entropy < 40, 'assess: 5000 repeated characters is weak, and fast');
  const t0 = Date.now(); P.assess('aB3$'.repeat(64)); T.ok(Date.now() - t0 < 500, 'assess: 256-character input is fast');
  T.eq(P.genPassword(3).length, 8, 'genPassword clamps to length 8'); T.eq(P.genPassword(1000).length, 64, 'genPassword clamps to length 64');
  T.eq(P.genPin(2).length, 4, 'genPin clamps to 4'); T.eq(P.genPin('abc').length, 6, 'genPin non-numeric falls back to 6');
  T.eq(P.genPassphrase(99).split('-').length, 10, 'genPassphrase clamps to 10 words'); T.eq(P.genPassphrase(0).split('-').length, 3, 'genPassphrase clamps to 3 words');
  T.ok(new Set(P.WORDS).size === P.WORDS.length, 'word list has no duplicates'); T.ok(P.WORDS.every(w => /^[a-z]+$/.test(w)), 'word list is lower-case letters only');

  // ---------- crafted backups through the UI ----------
  const page = await bootSec(), w = page.w;
  let t = await page.open('vault'); await page.wait(200); await setup(t, page, STRONG);
  t.q('details').open = true;
  const imp = async (text, pw) => { setFiles(t, w, '#b-file', [new w.File([text], 'b.json')]); await page.wait(150); if (pw !== null) { t.type('#ap', pw); t.clickText('Continue'); await page.until(() => /Imported|Could not/.test(t.q('#b-msg').textContent) && !/Decrypting/.test(t.q('#b-msg').textContent), 5000); await page.wait(100); } return t.q('#b-msg').textContent; };
  T.has(await imp(await craft('vault', 'pw-for-backup-1', { items: 'not an array' }), 'pw-for-backup-1'), 'Imported 0', 'backup with items that is not an array imports nothing, no crash');
  T.has(await imp(await craft('vault', 'pw-for-backup-1', { items: [null, 5, 'x', { id: 7 }, {}, { id: 'a1', title: { x: 1 }, pass: 12345, user: null, url: [1], notes: undefined }, { id: 'a1', title: 'dup' }, { id: '__proto__', title: 'proto' }] }), 'pw-for-backup-1'), 'Imported 2', 'hostile entries: only the two valid ids are imported');
  T.ok(t.has('#v-list [data-id]') && !w.Object.prototype.title, 'no prototype pollution from "__proto__" id');
  T.has(t.text(), '[object Object]', 'object-valued title is stringified, not executed');
  T.has(await imp(await craft('vault', 'pw-for-backup-1', { items: [{ id: 'z9', title: '<img src=x onerror=window.__pwn=1>', user: '"><script>window.__pwn=2</script>' }] }), 'pw-for-backup-1'), 'Imported 1', 'HTML in an imported entry');
  T.ok(!w.__pwn && !t.has('#v-list img'), 'imported HTML is escaped');
  T.has(await imp(await craft('notes', 'pw-for-backup-1', { items: [] }), null), 'different tool', 'a notes backup is refused by the vault');
  const relabel = JSON.parse(await craft('notes', 'pw-for-backup-1', { items: [{ id: 'q1', title: 'smuggled' }] })); relabel.type = 'vault';
  T.has(await imp(JSON.stringify(relabel), 'pw-for-backup-1'), 'Could not open', 'a backup of another tool relabelled as a vault backup does not decrypt');
  T.has(await imp(JSON.stringify({ app: 'PocketKit', type: 'vault', v: 1, iter: 600000, salt: 'AAAA', iv: 'AAAA', ct: 123 }), 'x'), 'Could not open', 'record with a non-string field refused');
  T.has(await imp('[]', null), 'not a PocketKit', 'JSON array refused'); T.has(await imp('null', null), 'not a PocketKit', 'JSON null refused');
  // the free limit applies to imports
  const seven = Array.from({ length: 7 }, (_, i) => ({ id: 'imp' + i, title: 'Imp ' + i, user: '', pass: 'x' }));
  const before = t.all('#v-list [data-id]').length, p0 = page.pro();
  await imp(await craft('vault', 'pw-for-backup-1', { items: seven }), 'pw-for-backup-1');
  T.eq(t.all('#v-list [data-id]').length, 5, 'free vault: import stops at the 5-entry limit (had ' + before + ')'); T.ok(page.pro() > p0, 'free vault: import over the limit opens the Pro sheet');
  t.close();

  // ---------- Pro: 1000-entry cap on import ----------
  const pp = await bootSec({ pro: true }); const pw2 = pp.w;
  let v = await pp.open('vault'); await pp.wait(200); await setup(v, pp, STRONG); v.q('details').open = true;
  const many = Array.from({ length: 6000 }, (_, i) => ({ id: 'm' + i, title: 'M' + i, pass: 'p' }));
  setFiles(v, pw2, '#b-file', [new pw2.File([await craft('vault', 'pw-for-backup-1', { items: many })], 'b.json')]); await pp.wait(150);
  v.type('#ap', 'pw-for-backup-1'); v.clickText('Continue'); await pp.until(() => /Imported/.test(v.q('#b-msg').textContent), 8000);
  T.has(v.q('#b-msg').textContent, 'Imported 1000 items', 'Pro vault: import stops at the 1000-entry cap');
  v.close(); pp.close();

  // ---------- TOTP hostile import ----------
  const tp = await bootSec({ pro: true }); const tw = tp.w;
  let tt = await tp.open('totp'); await tp.wait(200); await setup(tt, tp, STRONG); tt.q('details').open = true;
  const hostile = [{ id: '"] ,[x', secret: 'JBSWY3DPEHPK3PXP', issuer: 'X<b>', account: 'a' }, { secret: '!!!' }, { id: '0123456789abcdef', secret: 'JBSWY3DPEHPK3PXP', issuer: 'Y', digits: 9, period: 99999, algo: 'MD5' }, { id: '0123456789abcdef', secret: 'GEZDGNBVGY3TQOJQ' }, { secret: 5 }];
  setFiles(tt, tw, '#b-file', [new tw.File([await craft('totp', 'pw-for-backup-1', { items: hostile })], 'b.json')]); await tp.wait(150);
  tt.type('#ap', 'pw-for-backup-1'); tt.clickText('Continue'); await tp.until(() => /Imported/.test(tt.q('#b-msg').textContent), 5000);
  T.has(tt.q('#b-msg').textContent, 'Imported 2 items', 'TOTP: hostile import keeps only entries with valid secrets and unique ids');
  const ids = tt.all('.card[data-id]').map(c => c.dataset.id); T.ok(ids.length === 2 && ids.every(i => /^[0-9a-f]{16}$/.test(i)), 'TOTP: every imported id is a clean 16-hex string');
  T.ok(!tt.has('.card b b'), 'TOTP: issuer HTML is escaped');
  tt.close(); tp.close();

  // ---------- damaged and tampered key records ----------
  const dp = await bootSec(); const dw = dp.w;
  let d = await dp.open('vault'); await dp.wait(200); await setup(d, dp, STRONG);
  d.click('#sx-lock'); await dp.wait(100);
  const rec = await kvGet(dp.idb, 'pk-vault');
  await kvPut(dp.idb, 'pk-vault', Object.assign({}, rec, { iter: 5 }));
  d.close(); d = await dp.open('vault'); await dp.wait(300);
  for (let i = 0; i < 6; i++) await unlock(d, dp, STRONG, 200);
  T.has(d.text(), 'damaged', 'a damaged record is reported as damaged, not as a wrong password'); T.ok(!/Too many/.test(d.text()), 'a damaged record never triggers the lockout');
  await kvPut(dp.idb, 'pk-vault', rec); d.close(); d = await dp.open('vault'); await dp.wait(300);
  await unlock(d, dp, STRONG, 1500); T.ok(d.has('#sx-lock'), 'the original record still opens afterwards');
  const bad = JSON.parse(JSON.stringify(rec)); const ct = Buffer.from(bad.ct, 'base64'); ct[0] ^= 1; bad.ct = ct.toString('base64');
  d.click('#sx-lock'); await dp.wait(100); await kvPut(dp.idb, 'pk-vault', bad); d.close(); d = await dp.open('vault'); await dp.wait(300);
  await unlock(d, dp, STRONG, 1500); T.has(d.text(), 'Wrong password', 'a tampered ciphertext does not open (even with the right password)'); T.ok(!d.has('#sx-lock'), 'tampered record stays locked');
  // ---------- lockout persists across leaving and re-opening ----------
  await kvPut(dp.idb, 'pk-vault', rec); d.close(); dp.w.localStorage.removeItem('pk.sec.lock.vault');
  d = await dp.open('vault'); await dp.wait(300);
  for (let i = 0; i < 5; i++) await unlock(d, dp, 'nope-' + i, 1000);
  T.has(d.text(), 'Too many wrong attempts', 'lockout after five wrong passwords');
  d.close(); d = await dp.open('vault'); await dp.wait(400);
  T.has(d.text(), 'Too many wrong attempts', 'lockout survives leaving and re-opening the tool'); T.ok(d.q('#u-go').disabled, 'unlock button stays disabled');
  const realNow = dw.Date.now; dw.Date.now = () => realNow() - 3600 * 1000; await dp.wait(700);
  T.ok(d.q('#u-go').disabled, 'setting the clock back does not skip the lockout'); dw.Date.now = realNow;
  dp.skew(31000); await dp.wait(700); T.ok(!d.q('#u-go').disabled, 'lockout ends after 30 s');
  for (let i = 0; i < 5; i++) await unlock(d, dp, 'nope2-' + i, 800);
  const left = /in (\d+) s/.exec(d.text()); T.ok(left && Number(left[1]) > 40, 'second round of lockout is longer (60 s): ' + (left && left[1]));
  d.close(); dp.close();

  // ---------- biometrics (fake plugin) ----------
  const calls = [], store = {}; let failMode = '';
  const bp = await bootSec({ capacitor: P2 => { P2.NativeBiometric = {
    isAvailable: async () => ({ isAvailable: true }),
    setCredentials: async o => { calls.push(['set', o]); if (failMode === 'set') throw new Error('x'); store.c = o; },
    getSecureCredentials: async o => { calls.push(['get', o]); if (failMode === 'cancel') throw { message: 'User cancelled', code: 16 }; if (failMode === 'invalid') throw { message: 'Key permanently invalidated', code: 21 }; return { username: store.c.username, password: store.c.password }; },
    deleteCredentials: async o => { calls.push(['del', o]); delete store.c; },
    verifyIdentity: async () => { calls.push(['verify']); }
  }; } });
  let b = await bp.open('locker'); await bp.wait(200); await setup(b, bp, STRONG);
  b.q('details').open = true; await bp.until(() => b.has('#bio-t'), 3000);
  T.ok(b.has('#bio-t'), 'biometric: the option is offered when the phone supports it');
  b.click('#bio-t'); await bp.wait(100); b.type('#ap', 'not-the-password'); b.clickText('Continue'); await bp.wait(800);
  T.has(b.text(), 'not correct', 'biometric: enabling needs the correct password'); T.ok(!calls.some(c => c[0] === 'set'), 'biometric: a wrong password is never stored');
  failMode = 'set'; b.click('#bio-t'); await bp.wait(100); b.type('#ap', STRONG); b.clickText('Continue'); await bp.wait(800);
  T.has(b.text(), 'Could not turn on', 'biometric: failure to store is reported'); T.ok(calls.some(c => c[0] === 'del'), 'biometric: leftovers are deleted after a failed save'); failMode = '';
  b.click('#bio-t'); await bp.wait(100); b.type('#ap', STRONG); b.clickText('Continue'); await bp.wait(800);
  const sc = calls.filter(c => c[0] === 'set').pop(); T.ok(sc && sc[1].accessControl === 1 && sc[1].password === STRONG, 'biometric: the password is stored with BIOMETRY_CURRENT_SET access control');
  T.ok(!calls.some(c => c[0] === 'verify'), 'biometric: no UI-only verifyIdentity check is relied on');
  b.click('#sx-lock'); await bp.wait(100); T.ok(b.has('#u-bio'), 'biometric: button on the unlock screen');
  failMode = 'cancel'; b.click('#u-bio'); await bp.wait(200); T.has(b.text(), 'cancelled', 'biometric: cancel falls back to the password');
  failMode = ''; b.click('#u-bio'); await bp.until(() => b.has('#sx-lock'), 4000); T.ok(b.has('#sx-lock'), 'biometric: unlocks with the secure credentials');
  b.click('#sx-lock'); await bp.wait(100); failMode = 'invalid'; b.click('#u-bio'); await bp.wait(300);
  T.has(b.text(), 'stopped working', 'biometric: an invalidated key switches the feature off and says why'); T.ok(b.q('#u-bio').hidden, 'biometric: the button is hidden afterwards');
  T.ok(calls.filter(c => c[0] === 'del').length >= 2, 'biometric: the stale credentials are deleted');
  failMode = ''; await unlock(b, bp, STRONG, 1500); T.ok(b.has('#sx-lock'), 'biometric: the password still works');
  b.close(); bp.close();
  // an old (pre-binding) biometric setting is switched off with an explanation
  const op = await bootSec({ ls: { 'pk.sec.bio.locker': 'true' }, capacitor: P2 => { P2.NativeBiometric = { isAvailable: async () => ({ isAvailable: true }), deleteCredentials: async () => { calls.push(['olddel']); } }; } });
  let ob = await op.open('locker'); await op.wait(200); await setup(ob, op, STRONG); ob.click('#sx-lock'); await op.wait(100);
  T.has(ob.text(), 'switched off because it now uses stronger protection', 'biometric: old unprotected setting is removed with an explanation'); T.ok(calls.some(c => c[0] === 'olddel'), 'biometric: old stored credentials deleted');
  ob.close(); op.close();

  // ---------- native export and cache cleanup ----------
  const fsCalls = []; let shareFail = '';
  const np = await bootSec({ capacitor: P2 => {
    P2.Filesystem = { writeFile: async o => { fsCalls.push(['write', o]); return {}; }, getUri: async o => ({ uri: 'file:///cache/' + o.path }), rmdir: async o => { fsCalls.push(['rmdir', o]); }, deleteFile: async o => { fsCalls.push(['delete', o]); return {}; } };
    P2.Share = { share: async o => { fsCalls.push(['share', o]); if (shareFail) throw new Error(shareFail); return {}; } }; } });
  const nw = np.w; let n = await np.open('locker'); await np.wait(200);
  T.ok(fsCalls.some(c => c[0] === 'rmdir' && c[1].path === 'pk-export' && c[1].directory === 'CACHE'), 'export folder is cleared when the tool opens');
  await setup(n, np, STRONG);
  const payload = nodeCrypto.randomBytes(3000);
  setFiles(n, nw, '#lk-in', [mkFile(nw, '../evil‮nam<e>.bin', payload, 'application/octet-stream')]); await np.wait(1000);
  n.q('[data-a=exp]').click(); await np.wait(600);
  const wr = fsCalls.find(c => c[0] === 'write'); T.ok(wr && wr[1].path.startsWith('pk-export/') && !/\.\.|‮|[<>]/.test(wr[1].path), 'native export: path is inside the export folder with a sanitised name (' + (wr && wr[1].path) + ')');
  T.ok(wr && Buffer.from(wr[1].data, 'base64').equals(payload), 'native export: the file written for sharing is the decrypted original');
  T.ok(fsCalls.some(c => c[0] === 'share' && c[1].files && c[1].files.length === 1), 'native export: the share sheet receives the file');
  fsCalls.length = 0; n.click('#sx-lock'); await np.wait(100);
  T.ok(fsCalls.some(c => c[0] === 'rmdir'), 'locking removes the decrypted export folder');
  await unlock(n, np, STRONG, 1500);
  shareFail = 'Share canceled'; n.q('[data-a=exp]').click(); await np.wait(600);
  T.ok(!/Exported/.test(n.q('#lk-msg').textContent), 'a cancelled share is not reported as exported (' + n.q('#lk-msg').textContent + ')');
  shareFail = 'boom'; n.q('[data-a=exp]').click(); await np.wait(600);
  T.ok(!n.text().includes('undefined'), 'share failure does not break the screen');
  n.close(); np.close();

  // ---------- old (v1) locker data is migrated ----------
  const { IDBFactory } = require('fake-indexeddb'); const oldIdb = new IDBFactory();
  const made = await P.sealedCreate('locker', 'Old-Locker-Pw-4321!', { ok: 1 }, 600000);
  const fid = 'abcdef0123456789', fbytes = nodeCrypto.randomBytes(777);
  const m1 = await P.sealBytes(made.key, Buffer.from(JSON.stringify({ name: 'old.dat', size: 777, type: 'application/octet-stream', added: 1700000000000 })), 'pk1/locker/m/' + fid), f1 = await P.sealBytes(made.key, fbytes, 'pk1/locker/f/' + fid);
  await new Promise((res, rej) => { const q = oldIdb.open('pk-locker', 1); q.onupgradeneeded = () => { q.result.createObjectStore('kv'); q.result.createObjectStore('files'); };
    q.onsuccess = () => { const tx = q.result.transaction(['kv', 'files'], 'readwrite'); tx.objectStore('kv').put(made.rec, 'rec'); tx.objectStore('files').put({ id: fid, mi: m1.iv, mc: m1.ct, ti: null, tc: null, di: f1.iv, dc: f1.ct }, fid); tx.oncomplete = () => { q.result.close(); res(); }; tx.onerror = () => rej(tx.error); }; });
  const mp = await bootSec({ idb: oldIdb }); const mw = mp.w;
  let ml = await mp.open('locker'); await mp.wait(300);
  T.has(ml.text(), 'is locked', 'migration: existing locker asks for the password (no setup screen)');
  await unlock(ml, mp, 'Old-Locker-Pw-4321!', 1500); await mp.until(() => ml.text().includes('old.dat'), 3000);
  T.has(ml.text(), 'old.dat', 'migration: old file is listed after the upgrade');
  ml.q('[data-a=exp]').click(); await mp.wait(500);
  T.ok((await readBlob([...mw.__blobs.values()].pop())).equals(fbytes), 'migration: old file decrypts to the original bytes');
  ml.close(); mp.close();

  await T.done(page);
});
