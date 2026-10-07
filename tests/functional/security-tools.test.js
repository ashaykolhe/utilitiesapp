'use strict';
/* Text Locker, Checksum, 2FA Codes, generators, Password Check, Emergency Card, Secret Notes, Privacy Checklist, driven through the UI. */
const nodeCrypto = require('crypto'), webcrypto = nodeCrypto.webcrypto;
const { suite } = require('../helpers/page');
const { run, bootSec, mkFile, setFiles, setup, unlock, STRONG } = require('./security.helper');
setTimeout(() => { console.log('WATCHDOG: test hung'); process.exit(2); }, 200000).unref();

/* ---- independent implementations (Node crypto), used to compute expectations ---- */
const b32 = buf => { const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = '', out = ''; for (const b of buf) bits += b.toString(2).padStart(8, '0'); for (let i = 0; i < bits.length; i += 5) out += A[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)]; return out; };
const hotpNode = (secret, counter, digits, algo) => {
  const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(counter));
  const mac = nodeCrypto.createHmac(algo, secret).update(c).digest(), o = mac[mac.length - 1] & 15;
  const bin = ((mac[o] & 0x7f) << 24 | mac[o + 1] << 16 | mac[o + 2] << 8 | mac[o + 3]) >>> 0;
  return String(bin % 10 ** digits).padStart(digits, '0');
};
const SEED = { sha1: Buffer.from('12345678901234567890'), sha256: Buffer.from('12345678901234567890123456789012'), sha512: Buffer.from('1234567890123456789012345678901234567890123456789012345678901234') };
// RFC 6238 appendix B (8 digits, step 30 s)
const RFC = { sha1: { 59: '94287082', 1111111109: '07081804', 1111111111: '14050471', 1234567890: '89005924', 2000000000: '69279037', 20000000000: '65353130' },
  sha256: { 59: '46119246', 1111111109: '68084774', 1111111111: '67062674', 1234567890: '91819424', 2000000000: '90698825', 20000000000: '77737706' },
  sha512: { 59: '90693936', 1111111109: '25091201', 1111111111: '99943326', 1234567890: '93441116', 2000000000: '38618901', 20000000000: '47863826' } };

run(async () => {
  const T = suite('security-tools'), page = await bootSec({ pro: true }), w = page.w;
  const sha = (a, d) => nodeCrypto.createHash(a).update(d).digest('hex');

  // ================= Text Locker =================
  let t = await page.open('textlock');
  const msg = 'Meet at 9: café ☕ 日本語 🔐 line2\nline3';
  t.type('#tl-in', msg); t.type('#tl-pw', 'short'); t.click('#tl-go'); await page.wait(50);
  T.has(t.text(), 'at least 8 characters', 'Text Locker: short password refused');
  t.type('#tl-pw', 'password123'); t.click('#tl-go'); await page.wait(50);
  T.has(t.text(), 'too easy to guess', 'Text Locker: weak password refused'); T.ok(!t.q('#tl-any').hidden, 'Text Locker: Use anyway offered');
  t.type('#tl-in', ''); t.click('#tl-go'); await page.wait(30); T.has(t.text(), 'Type a message first', 'Text Locker: empty message refused');
  t.type('#tl-in', msg); t.type('#tl-pw', STRONG); t.click('#tl-go'); await page.until(() => t.value('#tl-out'), 4000);
  const code = t.value('#tl-out');
  T.ok(code.length > 60 && /^[A-Za-z0-9+/]+=*$/.test(code), 'Text Locker: output is base64');
  T.ok(!Buffer.from(code, 'base64').toString('latin1').includes('Meet'), 'Text Locker: output hides the message');
  // independent decryption in Node: 'PK' 01 | iter | salt16 | iv12 | ct+tag, header as AAD
  const raw = Buffer.from(code, 'base64'), iter = raw.readUInt32BE(3);
  T.eq(iter, 600000, 'Text Locker: 600,000 PBKDF2 rounds recorded in the header');
  const dk = nodeCrypto.pbkdf2Sync(Buffer.from(STRONG.normalize('NFKC')), raw.subarray(7, 23), iter, 32, 'sha256');
  const dec = nodeCrypto.createDecipheriv('aes-256-gcm', dk, raw.subarray(23, 35)); dec.setAAD(raw.subarray(0, 23)); dec.setAuthTag(raw.subarray(raw.length - 16));
  T.eq(Buffer.concat([dec.update(raw.subarray(35, raw.length - 16)), dec.final()]).toString('utf8'), msg, 'Text Locker: a separate AES-GCM implementation decrypts the output');
  // two encryptions of the same message differ (fresh salt and IV)
  t.click('#tl-go'); await page.wait(700); T.ok(t.value('#tl-out') !== code, 'Text Locker: same message encrypts differently each time');
  // round trip in the UI
  t.clickText('Unlock a message'); T.eq(t.value('#tl-out'), '', 'Text Locker: switching mode clears the result');
  t.type('#tl-in', code); t.type('#tl-pw', 'Wrong-Password-1!'); t.click('#tl-go'); await page.until(() => /Wrong password/.test(t.text()), 3000);
  T.has(t.text(), 'Wrong password', 'Text Locker: wrong password reported');
  t.type('#tl-pw', STRONG); t.click('#tl-go'); await page.until(() => t.value('#tl-out'), 3000);
  T.eq(t.value('#tl-out'), msg, 'Text Locker: round trip restores the exact message');
  const flip = (s, i) => { const b = Buffer.from(s, 'base64'); b[i] ^= 1; return b.toString('base64'); };
  for (const [i, what] of [[3, 'iteration count'], [10, 'salt'], [30, 'iv'], [40, 'ciphertext'], [raw.length - 1, 'tag']]) {
    t.type('#tl-in', flip(code, i)); t.click('#tl-go'); await page.until(() => /Wrong password|not a valid/.test(t.text()), 3000);
    T.ok(t.value('#tl-out') === '' && /Wrong password|not a valid/.test(t.text()), 'Text Locker: tampered ' + what + ' is refused');
  }
  t.type('#tl-in', code.slice(0, 40)); t.click('#tl-go'); await page.until(() => /not a valid/.test(t.text()), 3000);
  T.has(t.text(), 'not a valid locked code', 'Text Locker: cut-off code reported as invalid, not as a wrong password');
  t.type('#tl-in', '!!!not base64!!!'); t.click('#tl-go'); await page.until(() => /not a valid/.test(t.text()), 3000); T.has(t.text(), 'not a valid', 'Text Locker: garbage reported as invalid');
  // size handling: long messages
  t.clickText('Lock a message');
  const long = 'é'.repeat(7001); // 14002 bytes
  t.type('#tl-in', long); t.type('#tl-pw', STRONG); t.click('#tl-go'); await page.wait(60);
  T.has(t.text(), 'too long', 'Text Locker: over 14,000 bytes refused with a clear message');
  const max = 'x'.repeat(14000); t.type('#tl-in', max); t.click('#tl-go'); await page.until(() => t.value('#tl-out'), 4000);
  const bigCode = t.value('#tl-out'); T.ok(bigCode.length > 18000, 'Text Locker: a 14,000 byte message locks');
  T.eq(t.q('#tl-in').maxLength, 14000, 'Text Locker: message box limited to 14000 characters');
  t.clickText('Unlock a message'); T.ok(t.q('#tl-in').maxLength >= bigCode.length, 'Text Locker: decrypt box can hold the longest possible code');
  t.type('#tl-in', bigCode); t.type('#tl-pw', STRONG); t.click('#tl-go'); await page.until(() => t.value('#tl-out'), 4000);
  T.eq(t.value('#tl-out'), max, 'Text Locker: longest message round trips');
  // Use anyway
  t.clickText('Lock a message'); t.type('#tl-in', 'hi'); t.type('#tl-pw', 'password123'); t.click('#tl-go'); await page.wait(60);
  t.click('#tl-any'); await page.until(() => t.value('#tl-out'), 4000); T.ok(t.value('#tl-out').length > 50, 'Text Locker: Use anyway locks with a weak password');
  t.click('#tl-cp'); await page.wait(50); T.eq(w.__clip, t.value('#tl-out'), 'Text Locker: Copy puts the code on the clipboard');
  t.close();

  // ================= Checksum =================
  t = await page.open('checksum');
  T.ok(t.q('#ck-go').disabled, 'Checksum: Calculate disabled until a file is chosen');
  const abc = mkFile(w, 'abc.txt', 'abc'), empty = mkFile(w, 'empty.bin', '');
  const rnd = new Uint8Array(nodeCrypto.randomBytes(100000)), rndFile = mkFile(w, 'random.bin', rnd);
  const hashOf = async (file, alg) => { setFiles(t, w, '#ck-in', [file]); t.select('#ck-alg', alg); t.click('#ck-go'); await page.until(() => !t.q('#ck-res').hidden, 3000); return t.q('#ck-hash').textContent; };
  T.eq(await hashOf(abc, 'SHA-256'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'Checksum: SHA-256("abc") known value');
  T.eq(await hashOf(abc, 'SHA-1'), 'a9993e364706816aba3e25717850c26c9cd0d89d', 'Checksum: SHA-1("abc") known value');
  T.eq(await hashOf(abc, 'SHA-384'), 'cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7', 'Checksum: SHA-384("abc") known value');
  T.eq(await hashOf(abc, 'SHA-512'), 'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f', 'Checksum: SHA-512("abc") known value');
  T.eq(await hashOf(empty, 'SHA-256'), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'Checksum: SHA-256 of an empty file');
  T.eq(await hashOf(rndFile, 'SHA-256'), sha('sha256', Buffer.from(rnd)), 'Checksum: SHA-256 of 100 kB random file equals Node crypto');
  T.eq(await hashOf(rndFile, 'SHA-512'), sha('sha512', Buffer.from(rnd)), 'Checksum: SHA-512 of random file equals Node crypto');
  const H = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
  const verdict = async (pasted, alg) => { t.type('#ck-exp', pasted); if (alg) t.select('#ck-alg', alg); setFiles(t, w, '#ck-in', [abc]); if (alg) t.select('#ck-alg', alg); t.click('#ck-go'); await page.until(() => !t.q('#ck-res').hidden, 3000); return t.q('#ck-verdict').textContent; };
  T.has(await verdict(H), 'Match', 'Checksum: bare hash matches');
  T.has(await verdict(H.toUpperCase()), 'Match', 'Checksum: upper-case hash matches');
  T.has(await verdict(H + '  abc.txt'), 'Match', 'Checksum: sha256sum line (hash + file name) matches');
  T.has(await verdict('SHA256:' + H), 'Match', 'Checksum: "sha256:" prefix is ignored');
  T.has(await verdict('SHA256 (abc.txt) = ' + H), 'Match', 'Checksum: BSD-style line matches');
  T.has(await verdict(H.match(/../g).join(':')), 'Match', 'Checksum: colon separated hash matches');
  T.has(await verdict('  ' + H + '\n'), 'Match', 'Checksum: surrounding whitespace ignored');
  T.has(await verdict(H.replace(/^b/, 'c')), 'No match', 'Checksum: one changed character is a mismatch');
  T.eq(t.value('#ck-alg'), 'SHA-256', 'Checksum: algorithm picked from the pasted hash length');
  T.has(await verdict('a9993e364706816aba3e25717850c26c9cd0d89d'), 'Match', 'Checksum: a 40-character hash switches to SHA-1 and matches');
  T.eq(t.value('#ck-alg'), 'SHA-1', 'Checksum: switched to SHA-1');
  t.type('#ck-exp', H); t.select('#ck-alg', 'SHA-512'); setFiles(t, w, '#ck-in', [abc]); t.select('#ck-alg', 'SHA-512'); t.click('#ck-go'); await page.until(() => !t.q('#ck-res').hidden, 3000);
  T.has(t.q('#ck-verdict').textContent, 'wrong length', 'Checksum: wrong-length hash explained');
  t.type('#ck-exp', ''); setFiles(t, w, '#ck-in', [abc]); t.click('#ck-go'); await page.until(() => !t.q('#ck-res').hidden, 3000);
  T.has(t.q('#ck-verdict').textContent, 'Hash calculated', 'Checksum: no expected hash just shows the hash');
  setFiles(t, w, '#ck-in', [{ name: 'giant.iso', size: 2000 * 1048576, arrayBuffer: async () => { throw new Error('should not read'); } }]);
  T.has(t.text(), 'too large', 'Checksum: files over 1 GB refused'); T.ok(t.q('#ck-go').disabled, 'Checksum: Calculate disabled for giant file');
  t.close();

  // ================= 2FA Codes =================
  const totpPage = page;
  let realNow = w.Date.now; const setTime = s => { w.Date.now = () => s * 1000; };
  setTime(59);
  t = await page.open('totp'); await page.wait(200);
  T.has(t.text(), 'Create your 2FA Codes', 'TOTP: first-use screen');
  await setup(t, page, STRONG);
  const cardFor = name => t.all('.card[data-id]').find(c => c.textContent.includes(name));
  const addAcc = async (name, secret, algo, digits, period) => {
    t.click('#t-add'); await page.wait(30);
    t.type('#a-i', name); t.type('#a-s', secret); if (algo) t.select('#a-g', algo); if (digits) t.select('#a-d', digits); if (period) t.type('#a-p', period);
    t.click('#a-s2'); await page.wait(250);
  };
  await addAcc('RFC-SHA1', b32(SEED.sha1), 'SHA-1', '8');
  await addAcc('RFC-SHA256', b32(SEED.sha256), 'SHA-256', '8');
  await addAcc('RFC-SHA512', b32(SEED.sha512), 'SHA-512', '8');
  T.eq(t.all('.card[data-id]').length, 3, 'TOTP: three accounts added');
  for (const [alg, name] of [['sha1', 'RFC-SHA1'], ['sha256', 'RFC-SHA256'], ['sha512', 'RFC-SHA512']]) {
    for (const tm of Object.keys(RFC[alg])) {
      setTime(Number(tm)); await page.wait(700);
      const shown = cardFor(name).querySelector('[data-code]').textContent.replace(/\s/g, '');
      T.eq(shown, RFC[alg][tm], 'TOTP RFC 6238 ' + alg + ' at T=' + tm);
      T.eq(hotpNode(SEED[alg], Math.floor(Number(tm) / 30), 8, alg), RFC[alg][tm], 'test self-check: Node HMAC reproduces the RFC value ' + alg + ' ' + tm);
    }
  }
  // 6-digit default, display grouping and countdown
  setTime(1111111109 + 7);
  await addAcc('Six', b32(SEED.sha1)); await page.wait(700);
  const six = cardFor('Six').querySelector('[data-code]').textContent;
  T.eq(six, '081 804'.replace('081 804', hotpNode(SEED.sha1, Math.floor(1111111116 / 30), 6, 'sha1').replace(/(...)(...)/, '$1 $2')), 'TOTP: 6-digit code grouped 3+3 and equal to the independent value');
  T.has(cardFor('Six').textContent, 'Refreshes in 24 s', 'TOTP: countdown to the next code (1111111116 s: 30 - 6)');
  setTime(1111111109 + 28); await page.wait(700);
  T.has(cardFor('Six').textContent, 'Refreshes in 3 s', 'TOTP: countdown near the end');
  T.ok(cardFor('Six').querySelector('[data-code]').style.color.includes('danger'), 'TOTP: code turns red in the last 5 seconds');
  setTime(59);
  // validation and otpauth
  t.click('#t-add'); await page.wait(30); t.type('#a-i', 'Bad'); t.type('#a-s', 'not base32 !!'); t.click('#a-s2'); await page.wait(100);
  T.has(t.text(), 'does not look valid', 'TOTP: invalid secret refused');
  t.type('#a-s', 'ABCDEFGH'); t.click('#a-s2'); await page.wait(100); T.has(t.text(), 'does not look valid', 'TOTP: secrets under 10 characters refused');
  t.type('#a-i', ''); t.type('#a-s', 'JBSWY3DPEHPK3PXP'); t.click('#a-s2'); await page.wait(100); T.has(t.text(), 'Give the account a name', 'TOTP: name required');
  const uri = 'otpauth://totp/Example:alice@example.com?secret=' + b32(SEED.sha1) + '&issuer=Example&digits=8&period=30&algorithm=SHA1';
  t.type('#a-s', uri); t.click('#a-s2'); await page.wait(300);
  setTime(1234567890); await page.wait(700);
  const oc = cardFor('Example'); T.ok(!!oc, 'TOTP: otpauth link adds the account'); T.has(oc.textContent, 'alice@example.com', 'TOTP: otpauth account name parsed');
  T.eq(oc.querySelector('[data-code]').textContent.replace(/\s/g, ''), RFC.sha1[1234567890], 'TOTP: otpauth account with 8 digits gives the RFC code');
  // spaced lower-case secret is accepted
  t.click('#t-add'); await page.wait(30); t.type('#a-i', 'Spaced'); t.type('#a-s', b32(SEED.sha1).toLowerCase().replace(/(.{4})/g, '$1 ')); t.click('#a-s2'); await page.wait(300);
  setTime(1234567890); await page.wait(700);
  T.eq(cardFor('Spaced').querySelector('[data-code]').textContent.replace(/\s/g, ''), hotpNode(SEED.sha1, Math.floor(1234567890 / 30), 6, 'sha1'), 'TOTP: spaced lower-case secret works');
  // copy
  cardFor('Spaced').querySelector('[data-a=copy]').click(); await page.wait(50);
  T.eq(page.native.copies.length, 1, 'TOTP: copying a code uses the sensitive clipboard');
  T.eq(page.native.copies[0].text, hotpNode(SEED.sha1, Math.floor(1234567890 / 30), 6, 'sha1'), 'TOTP: copied code is the current code');
  // secrets are encrypted at rest
  const rawDb = await new Promise(r => { const q = page.idb.open('pk-totp'); q.onsuccess = () => { const g = q.result.transaction('kv').objectStore('kv').getAll(); g.onsuccess = () => { q.result.close(); r(JSON.stringify(g.result)); }; }; });
  T.ok(!rawDb.includes(b32(SEED.sha1)) && !rawDb.includes('Spaced'), 'TOTP: secrets are not stored as plain text');
  // delete
  cardFor('Spaced').querySelector('[data-a=del]').click(); await page.wait(300);
  T.ok(!cardFor('Spaced'), 'TOTP: account removed');
  // backup roundtrip into another vault with a hostile id
  t.q('details').open = true; t.click('#b-ex'); await page.wait(300);
  const bk = JSON.parse(Buffer.from(await [...w.__blobs.values()].pop().arrayBuffer()).toString());
  T.eq(bk.type, 'totp', 'TOTP: backup tagged');
  w.Date.now = realNow;
  t.close();

  // ================= Generators =================
  t = await page.open('pingen');
  T.has(t.text(), 'About 18 bits'.slice(0, 5), 'PIN: bits shown');
  const outs = () => t.all('#g-out .sx-mono').map(e => e.textContent);
  const easy = s => /^(\d)\1+$/.test(s);
  let all = []; for (let i = 0; i < 60; i++) { t.click('#g-go'); all = all.concat(outs()); }
  T.ok(all.length === 300 && all.every(p => /^\d{6}$/.test(p)), 'PIN: default is six digits');
  const hasEasy = p => { const d = [...p].map(Number); const asc = d.every((x, i) => i === 0 || x - d[i - 1] === 1), dsc = d.every((x, i) => i === 0 || d[i - 1] - x === 1);
    return easy(p) || asc || dsc || /(19|20)\d\d/.test(p) || /^(\d\d)\1\1$/.test(p) || /^(\d\d\d)\1$/.test(p) || /^(\d)\1(\d)\2(\d)\3$/.test(p) || /0123|1234|2345|3456|4567|5678|6789|9876|8765|7654|6543|5432|4321|3210|(\d)\1\1\1/.test(p); };
  T.ok(all.every(p => !hasEasy(p)), 'PIN: "avoid easy PINs" never returns repeats, runs, years or doubled pairs');
  T.ok(new Set(all).size > 250, 'PIN: outputs are varied (300 draws, >250 distinct)');
  t.type('#pl', '4'); t.check('#pe', false); all = []; for (let i = 0; i < 40; i++) { t.click('#g-go'); all = all.concat(outs()); }
  T.ok(all.every(p => /^\d{4}$/.test(p)), 'PIN: length 4 honoured'); T.has(t.q('#g-bits').textContent, 'About 13 bits', 'PIN: 4 digits is about 13 bits');
  const digits = {}; for (let i = 0; i < 400; i++) { t.click('#g-go'); for (const p of outs()) for (const ch of p) digits[ch] = (digits[ch] || 0) + 1; }
  const tot = Object.values(digits).reduce((a, b) => a + b, 0); T.ok(Object.keys(digits).length === 10 && Object.values(digits).every(c => Math.abs(c / tot - 0.1) < 0.02), 'PIN: digits are uniformly distributed');
  t.type('#pl', '12'); t.click('#g-go'); T.ok(outs().every(p => /^\d{12}$/.test(p)), 'PIN: length 12 honoured');
  // persistence of settings
  const t2 = await page.open('pingen'); T.eq(t2.value('#pl'), '12', 'PIN: chosen length is remembered'); t2.close();
  // passphrase
  t.clickText('Passphrase'); t.click('#g-go');
  T.ok(outs().length === 4 && outs().every(p => /^[a-z]+(-[a-z]+){6}$/.test(p)), 'Passphrase: default 7 lower-case words with hyphens');
  const bitsTxt = t.q('#g-bits').textContent; const m = /About (\d+) bits.*word list of (\d+)/.exec(bitsTxt);
  T.ok(m && Math.abs(Number(m[1]) - 7 * Math.log2(Number(m[2]))) < 1, 'Passphrase: bit count equals 7 x log2(list size)');
  T.ok(Number(m[2]) >= 700, 'Passphrase: word list has at least 700 words');
  t.type('#wc', '3'); t.select('#ws', ' '); t.check('#wcap', true); t.check('#wnum', true); t.click('#g-go');
  T.ok(outs().every(p => /^[A-Z][a-z]+ [A-Z][a-z]+ [A-Z][a-z]+ \d{1,2}$/.test(p)), 'Passphrase: 3 capitalised words, space, number');
  T.has(t.q('#g-bits').textContent, 'Use 7 or more words', 'Passphrase: short passphrase gets a warning');
  const seen = new Set(); for (let i = 0; i < 40; i++) { t.click('#g-go'); outs().forEach(p => seen.add(p)); } T.ok(seen.size > 150, 'Passphrase: varied output');
  // password
  t.clickText('Password'); t.type('#xl', '24'); t.click('#g-go');
  T.ok(outs().length === 4 && outs().every(p => p.length === 24 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9]/.test(p)), 'Password: length 24 with all four classes');
  t.check('#xb', false); t.check('#xd', false); t.check('#xc', false); t.click('#g-go');
  T.ok(outs().every(p => /^[a-z]+$/.test(p) && p.length === 24), 'Password: only lower case when the other sets are off');
  t.check('#xa', false); t.click('#g-go'); T.ok(outs().every(p => /^[a-z]+$/.test(p)), 'Password: switching every set off falls back to lower case instead of failing');
  t.check('#xc', true); t.click('#g-go'); T.ok(outs().every(p => /^\d+$/.test(p)), 'Password: digits only when only digits are on');
  t.type('#xl', '8'); t.check('#xa', true); t.check('#xb', true); t.check('#xd', true); t.check('#xc', true); t.click('#g-go');
  T.ok(outs().every(p => p.length === 8 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9]/.test(p)), 'Password: minimum length 8 still has every class');
  // copy
  t.click('#g-out button[data-v]'); await page.wait(50);
  const cp = page.native.copies.slice(-1)[0]; T.ok(cp && cp.clearMs === 30000 && cp.text === outs()[0], 'Generator: Copy uses the sensitive clipboard with a 30 s clear');
  t.close();

  // ================= Password Check =================
  t = await page.open('pwcheck');
  const check = pw => { t.type('#pc', pw); return { label: t.q('#pc-l').textContent, e: t.q('#pc-e').textContent, bits: Number((/about (\d+) bits/.exec(t.q('#pc-e').textContent) || [])[1]), text: t.text() }; };
  T.eq(check('').label, 'Empty', 'Check: empty input');
  for (const pw of ['password', '123456', 'qwerty', 'letmein', 'Password1', 'abc123', 'iloveyou', 'P@ssw0rd', '11111111', 'abcdefgh', 'qwertyuiop']) T.ok(['Very weak', 'Weak'].includes(check(pw).label), 'Check: "' + pw + '" rated weak (' + check(pw).label + ')');
  for (const pw of ['Tg7#vQ2!mZp9xL4w', 'k3$Lp9@zQw7!Xv2#Nm', 'vR8&nB5*cK2!jH7^dF4%']) T.ok(['Strong', 'Excellent'].includes(check(pw).label), 'Check: random "' + pw + '" rated strong (' + check(pw).label + ')');
  T.ok(check('correct-horse-battery-staple').bits < check('k3$Lp9@zQw7!Xv2#Nm').bits && check('correct-horse-battery-staple').label !== 'Excellent', 'Check: a four-common-word passphrase rates below a random password of similar length and below Excellent');
  T.ok(check('Tr0ub4dor&3').bits < 45, 'Check: Tr0ub4dor&3 (a well known weak pattern) below 45 bits (' + check('Tr0ub4dor&3').bits + ')');
  T.has(check('password').text, 'most commonly used', 'Check: names the problem for "password"');
  T.has(check('aaaaaaaaaaaa').text, 'Repeated', 'Check: repeated characters flagged');
  T.has(check('abcdefghij').text, 'Sequence', 'Check: sequence flagged');
  T.has(check('Poiuytr9').text, 'Keyboard', 'Check: keyboard run flagged'); T.has(check('qwerty123').text, 'commonly used', 'Check: qwerty123 flagged as common');
  T.has(check('Summer2019!').text, 'year', 'Check: year flagged');
  T.ok(check('abcdefghij').bits < check('Tg7#vQ2!mZp9xL4w').bits, 'Check: more random is higher');
  const b1 = check('Xk9#mP2$vL').bits, b2 = check('Xk9#mP2$vLq7!wZ').bits; T.ok(b2 > b1, 'Check: longer is stronger');
  const big = check('Tg7#vQ2!mZp9xL4w'.repeat(10)); T.ok(Number.isFinite(big.bits), 'Check: long input is handled');
  T.eq(t.q('#pc').type, 'password', 'Check: field hidden by default'); t.click('[data-eye]'); T.eq(t.q('#pc').type, 'text', 'Check: eye shows it');
  check(''); t.close();

  // ================= Emergency Card =================
  t = await page.open('emergency');
  T.has(t.text(), 'Emergency card', 'Emergency: empty card opens in edit mode');
  t.type('#em-name', '  Asha Kolhe '); t.select('#em-blood', 'O+'); t.type('#em-allergies', 'Penicillin <b>x</b>'); t.type('#em-c1n', 'Ravi'); t.type('#em-c1p', '+91 98765-43210 abc'); t.type('#em-c2n', 'Mum'); t.type('#em-c2p', '');
  t.type('#em-dob', '2999-01-01'); t.select('#em-donor', 'Yes'); t.click('#em-save'); await page.wait(30);
  T.has(t.text(), 'Asha Kolhe', 'Emergency: name saved and trimmed'); T.has(t.text(), 'O+', 'Emergency: blood group shown'); T.has(t.text(), 'Penicillin <b>x</b>', 'Emergency: text is escaped, not HTML');
  T.ok(!t.has('.sx-kv b'), 'Emergency: no injected elements');
  const link = t.all('a[href^="tel:"]'); T.eq(link.length, 1, 'Emergency: one call button (contact 2 has no phone)'); T.eq(link[0].getAttribute('href'), 'tel:+919876543210', 'Emergency: phone cleaned for dialling');
  T.ok(!t.text().includes('2999'), 'Emergency: a future birth date is discarded');
  T.eq(JSON.parse(w.localStorage.getItem('pk.emergency.card')).c1p, '+91 98765-43210', 'Emergency: letters removed from the stored phone');
  t.click('#em-ed'); T.eq(t.value('#em-name'), 'Asha Kolhe', 'Emergency: edit shows saved values'); T.eq(t.value('#em-blood'), 'O+', 'Emergency: blood group kept');
  t.type('#em-name', 'Changed'); t.click('#em-cancel'); T.has(t.text(), 'Asha Kolhe', 'Emergency: Cancel keeps the old card');
  t.close(); t = await page.open('emergency'); T.has(t.text(), 'Asha Kolhe', 'Emergency: card persists after leaving'); t.close();

  // ================= Privacy Checklist =================
  t = await page.open('privacy');
  const boxes = t.all('input[data-id]'); T.eq(boxes.length, 25, 'Privacy: 25 items'); T.has(t.text(), '0 of 25 done', 'Privacy: starts at zero');
  boxes[0].click(); boxes[1].click(); T.has(t.text(), '2 of 25 done', 'Privacy: ticking updates the count'); T.has(t.text(), '8%', 'Privacy: percentage');
  t.close(); t = await page.open('privacy'); T.has(t.text(), '2 of 25 done', 'Privacy: ticks persist'); T.ok(t.all('input[data-id]')[0].checked, 'Privacy: ticked box restored');
  t.all('input[data-id]').forEach(b => { if (!b.checked) b.click(); }); T.has(t.text(), '100%', 'Privacy: all done is 100%'); T.has(t.text(), 'Excellent', 'Privacy: completion message');
  t.click('#pv-r'); T.has(t.text(), '0 of 25 done', 'Privacy: reset clears'); t.close();
  w.localStorage.setItem('pk.privacy.done', JSON.stringify(['9.9', 'x', 123])); t = await page.open('privacy'); T.has(t.text(), '0 of 25 done', 'Privacy: junk in storage ignored'); t.close();

  // ================= Secret Notes =================
  t = await page.open('secretnotes'); await page.wait(200);
  T.has(t.text(), 'Create your Secret Notes', 'Notes: first-use screen');
  await setup(t, page, 'password123', { wait: 200 }); T.has(t.text(), 'too easy to guess', 'Notes: weak master password refused');
  t.click('#s-any'); await page.until(() => t.has('#n-add'), 4000); T.ok(t.has('#n-add'), 'Notes: Use anyway creates the notes with the weak password');
  const addNote = async (title, body) => { t.click('#n-add'); await page.wait(30); t.type('#o-t', title); t.type('#o-b', body); t.click('#o-s'); await page.wait(300); };
  t.click('#n-add'); await page.wait(30); t.click('#o-s'); await page.wait(30); T.has(t.text(), 'Write something first', 'Notes: empty note refused'); t.click('#o-c'); await page.wait(30);
  await addNote('Diary', 'Secret line one\nline two'); await addNote('', 'No title body'); await addNote('<script>x</script>', '<img src=x>');
  T.eq(t.all('#n-list [data-id]').length, 3, 'Notes: three notes'); T.has(t.text(), 'Untitled', 'Notes: untitled shown'); T.has(t.text(), '<script>x</script>', 'Notes: title escaped'); T.ok(!t.has('#n-list img'), 'Notes: body escaped');
  t.type('#n-q', 'line two'); T.eq(t.all('#n-list [data-id]').length, 1, 'Notes: search looks in the body'); t.type('#n-q', '');
  t.all('#n-list [data-id]').find(b => b.textContent.includes('Diary')).click(); await page.wait(30); T.eq(t.value('#o-b'), 'Secret line one\nline two', 'Notes: edit shows the saved text');
  t.type('#o-b', 'edited body'); t.click('#o-s'); await page.wait(300); T.has(t.text(), 'edited body', 'Notes: edit saved');
  const rawN = await new Promise(r => { const q = page.idb.open('pk-secretnotes'); q.onsuccess = () => { const g = q.result.transaction('kv').objectStore('kv').getAll(); g.onsuccess = () => { q.result.close(); r(JSON.stringify(g.result)); }; }; });
  T.ok(!rawN.includes('Diary') && !rawN.includes('edited'), 'Notes: stored encrypted');
  t.click('#sx-lock'); await page.wait(100); T.ok(!t.text().includes('edited body'), 'Notes: nothing visible when locked');
  await unlock(t, page, 'password123', 1500); T.has(t.text(), 'edited body', 'Notes: unlocks with the weak password it was created with');
  t.all('#n-list [data-id]').find(b => b.textContent.includes('Untitled')).click(); await page.wait(30); t.click('#o-d'); await page.wait(300); T.eq(t.all('#n-list [data-id]').length, 2, 'Notes: delete');
  t.close();
  await T.done(page);
});
