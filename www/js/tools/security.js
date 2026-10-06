'use strict';
/* PocketKit security tools: File Locker, Password Vault, Password Check, PIN & Passphrase, Text Locker,
   Checksum, Privacy Checklist, Emergency Card, 2FA Codes, Secret Notes.
   All cryptography is WebCrypto only (PBKDF2-SHA256 -> AES-256-GCM, HMAC for TOTP). Nothing leaves the device.
   Wrapped in an IIFE so helper names cannot clash with other tool files. */
(() => {

/*PURE-START*/
const SC = globalThis.crypto;
const KDF_ITER = 600000, MIN_ITER = 310000, MAX_ITER = 5000000;
const te = new TextEncoder(), td = new TextDecoder();
const rnd = n => SC.getRandomValues(new Uint8Array(n));
const hex = u8 => [...u8].map(b => b.toString(16).padStart(2, '0')).join('');

/* Unbiased random integer in [0, max) by rejection sampling. */
function randInt(max) {
  const lim = Math.floor(0x100000000 / max) * max, b = new Uint32Array(1);
  do { SC.getRandomValues(b); } while (b[0] >= lim);
  return b[0] % max;
}
function b64e(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
function b64d(s) {
  const t = String(s).replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(t) || t.length % 4 === 1) throw new Error('bad base64');
  const bin = atob(t), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
const iterOk = n => Number.isInteger(n) && n >= MIN_ITER && n <= MAX_ITER;

/* Password -> non-extractable AES-256-GCM key. */
async function deriveKey(pw, salt, iter) {
  if (!iterOk(iter)) throw new Error('bad iterations');
  const base = await SC.subtle.importKey('raw', te.encode(String(pw).normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return SC.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
/* AES-GCM with a fresh random 96-bit IV per message; `aad` binds the ciphertext to its purpose / record id. */
async function sealBytes(key, bytes, aad) {
  const iv = rnd(12);
  const ct = new Uint8Array(await SC.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: te.encode(aad) }, key, bytes));
  return { iv, ct };
}
async function openBytes(key, iv, ct, aad) {
  return new Uint8Array(await SC.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: te.encode(aad) }, key, ct));
}

/* ---- Text Locker format: base64( 'PK' 0x01 | iter u32be | salt16 | iv12 | ciphertext+tag ). Header is authenticated. ---- */
async function encryptText(text, pw, iter = KDF_ITER) {
  const salt = rnd(16), iv = rnd(12), head = new Uint8Array(23);
  head.set([0x50, 0x4B, 0x01]); new DataView(head.buffer).setUint32(3, iter); head.set(salt, 7);
  const key = await deriveKey(pw, salt, iter);
  const ct = new Uint8Array(await SC.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: head }, key, te.encode(text)));
  const out = new Uint8Array(23 + 12 + ct.length);
  out.set(head); out.set(iv, 23); out.set(ct, 35);
  return b64e(out);
}
async function decryptText(b64, pw) {
  let raw;
  try { raw = b64d(b64); } catch (e) { throw new Error('not a PocketKit message'); }
  if (raw.length < 35 + 16 || raw[0] !== 0x50 || raw[1] !== 0x4B || raw[2] !== 0x01) throw new Error('not a PocketKit message');
  const head = raw.slice(0, 23), iter = new DataView(raw.buffer, raw.byteOffset).getUint32(3);
  if (!iterOk(iter)) throw new Error('not a PocketKit message');
  const key = await deriveKey(pw, head.slice(7, 23), iter);
  try {
    const pt = await SC.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(23, 35), additionalData: head }, key, raw.slice(35));
    return td.decode(pt);
  } catch (e) { throw new Error('wrong password or damaged message'); }
}

/* ---- Sealed store: a JSON object encrypted under a password-derived key. Used by the vault, notes, 2FA and locker header. ---- */
async function sealedCreate(name, pw, obj, iter = KDF_ITER) {
  const salt = rnd(16), key = await deriveKey(pw, salt, iter);
  const s = await sealBytes(key, te.encode(JSON.stringify(obj)), 'pk1/' + name);
  return { key, rec: { v: 1, kdf: 'PBKDF2-SHA256', iter, salt: b64e(salt), iv: b64e(s.iv), ct: b64e(s.ct) } };
}
async function sealedOpen(name, rec, pw) {
  if (!rec || rec.v !== 1 || !iterOk(rec.iter) || typeof rec.salt !== 'string' || typeof rec.iv !== 'string' || typeof rec.ct !== 'string') throw new Error('bad record');
  const key = await deriveKey(pw, b64d(rec.salt), rec.iter);
  const pt = await openBytes(key, b64d(rec.iv), b64d(rec.ct), 'pk1/' + name); // throws when the password is wrong or data was changed
  return { key, obj: JSON.parse(td.decode(pt)) };
}
async function sealedSave(name, rec, key, obj) {
  const s = await sealBytes(key, te.encode(JSON.stringify(obj)), 'pk1/' + name);
  return { v: 1, kdf: rec.kdf, iter: rec.iter, salt: rec.salt, iv: b64e(s.iv), ct: b64e(s.ct) };
}

/* ---- Password strength ---- */
const COMMON = ('password 123456 123456789 12345678 12345 1234567 1234567890 qwerty qwertyuiop abc123 password1 111111 123123 iloveyou admin ' +
  'welcome login letmein monkey dragon master sunshine princess football baseball shadow superman michael jennifer jordan hunter ' +
  'batman trustno1 freedom whatever starwars summer winter spring autumn pokemon charlie donald robert thomas andrew daniel ' +
  'ashley nicole jessica pepper ginger cookie secret hello hello123 test testing guest root toor changeme default access ' +
  'flower mustang soccer hockey killer george harley ranger buster tigger matrix computer internet cheese banana orange ' +
  'purple yellow silver golden diamond forever lovely angel angels family friend friends passw0rd p@ssw0rd qazwsx zxcvbn ' +
  'asdfgh asdfghjkl zxcvbnm azerty samsung google iphone android india cricket krishna shiva ganesh mumbai delhi bollywood ' +
  'sachin rahul rohit kumar singh sharma babydoll sweety darling money love lover mother father brother sister ' +
  'welcome1 admin123 pass1234 abcd1234 qwerty123 1q2w3e4r 1qaz2wsx letmein1 monkey1 dragon1 master1 000000 654321 666666 121212 112233 ' +
  'trustno loveyou biteme access14 whatever1 football1 baseball1 superman1 iloveu nothing school college student teacher').split(' ');
const CW = COMMON.filter(w => w.length >= 4).sort((a, b) => b.length - a.length);
const COMMON_SET = new Set(COMMON);
const KEYB = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890', 'qazwsxedcrfvtgbyhnujmikolp'];
const KEYB_ALL = KEYB.concat(KEYB.map(r => [...r].reverse().join('')));
const leetA = s => s.toLowerCase().replace(/[@4]/g, 'a').replace(/0/g, 'o').replace(/[1!|]/g, 'i').replace(/3/g, 'e').replace(/[5$]/g, 's').replace(/7/g, 't').replace(/8/g, 'b');
const leetB = s => leetA(s.replace(/1/g, 'l'));

function assess(pw) {
  pw = String(pw || '');
  const n = pw.length;
  if (!n) return { len: 0, entropy: 0, level: 0, label: 'Empty', issues: [], tips: ['Type a password to see how strong it is.'], times: [] };
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/[0-9]/.test(pw)) pool += 10;
  if (/[^A-Za-z0-9]/.test(pw)) pool += 33;
  const bpc = Math.log2(pool || 10);
  const cov = new Array(n).fill(null), issues = [];
  const claim = (i, j, bits, msg) => {
    for (let k = i; k < j; k++) if (cov[k] !== null) return false;
    for (let k = i; k < j; k++) cov[k] = bits / (j - i);
    if (msg && !issues.includes(msg)) issues.push(msg);
    return true;
  };
  const low = pw.toLowerCase(), cbits = Math.log2(COMMON.length);
  if (COMMON_SET.has(low) || COMMON_SET.has(leetA(pw)) || COMMON_SET.has(leetB(pw))) {
    claim(0, n, cbits, 'This is one of the most commonly used passwords');
  }
  for (const v of [leetA(pw), leetB(pw)]) {
    for (const w of CW) {
      let i = v.indexOf(w);
      while (i >= 0) {
        claim(i, i + w.length, cbits + (v !== low ? 1 : 0) + 1, 'Contains a common word or password: "' + w + '"');
        i = v.indexOf(w, i + 1);
      }
    }
  }
  const wbits = Math.log2(WORDS.length) + 1;
  for (const w of WORDS) {
    if (w.length < 5) continue;
    let i = low.indexOf(w);
    while (i >= 0) { claim(i, i + w.length, wbits, 'Contains an ordinary dictionary word: "' + w + '"'); i = low.indexOf(w, i + 1); }
  }
  let m;
  const reRun = /(.)\1{2,}/g;
  while ((m = reRun.exec(pw))) claim(m.index, m.index + m[0].length, bpc + Math.log2(m[0].length), 'Repeated characters');
  const reChunk = /(.{2,4})\1+/g;
  while ((m = reChunk.exec(pw))) claim(m.index, m.index + m[0].length, bpc * m[1].length + Math.log2(m[0].length / m[1].length), 'Repeated pattern');
  for (let i = 0; i < n - 2;) {
    const d = low.charCodeAt(i + 1) - low.charCodeAt(i);
    let j = i + 1;
    if (Math.abs(d) === 1 && /[a-z0-9]/.test(low[i])) {
      while (j < n && low.charCodeAt(j) - low.charCodeAt(j - 1) === d && /[a-z0-9]/.test(low[j])) j++;
      if (j - i >= 3) { claim(i, j, bpc + Math.log2(j - i) + 1, 'Sequence such as abc or 321'); i = j; continue; }
    }
    i++;
  }
  for (let i = 0; i < n - 2; i++) {
    let best = 0;
    for (const r of KEYB_ALL) { let l = 3; while (i + l <= n && r.includes(low.slice(i, i + l))) l++; best = Math.max(best, l - 1); }
    if (best >= 3) { if (claim(i, i + best, bpc + Math.log2(best) + 2, 'Keyboard pattern such as qwerty')) i += best - 1; }
  }
  const reYear = /(?:19|20)\d{2}/g;
  while ((m = reYear.exec(pw))) claim(m.index, m.index + 4, 7, 'Contains a year');
  let entropy = 0;
  for (let k = 0; k < n; k++) entropy += cov[k] === null ? bpc : cov[k];
  entropy = Math.round(entropy * 10) / 10;
  const level = entropy < 28 ? 0 : entropy < 40 ? 1 : entropy < 60 ? 2 : entropy < 80 ? 3 : 4;
  const label = ['Very weak', 'Weak', 'Fair', 'Strong', 'Excellent'][level];
  const rate = [['Online guessing (100 per second)', 1e2], ['Stolen hash, slow hashing (10,000 per second)', 1e4], ['Stolen hash, fast hashing (10 billion per second)', 1e10]];
  const times = rate.map(r => ({ name: r[0], text: humanTime(Math.pow(2, Math.max(0, entropy - 1)) / r[1]) }));
  const tips = [];
  if (n < 12) tips.push('Use at least 12 characters. Length helps more than symbols.');
  if (!/[A-Z]/.test(pw) || !/[a-z]/.test(pw)) tips.push('Mix upper and lower case letters.');
  if (!/[0-9]/.test(pw)) tips.push('Add a few digits in unexpected places.');
  if (!/[^A-Za-z0-9]/.test(pw)) tips.push('Add a symbol or two.');
  if (issues.length) tips.push('Avoid words, years, keyboard runs and repeats. Random beats clever.');
  if (level < 3) tips.push('Try a passphrase of 5 or more random words. It is long, strong and easy to remember.');
  return { len: n, entropy, level, label, issues, tips, times };
}
function humanTime(sec) {
  if (sec < 1) return 'instantly';
  if (sec < 60) return Math.round(sec) + ' seconds';
  if (sec < 3600) return Math.round(sec / 60) + ' minutes';
  if (sec < 86400) return Math.round(sec / 3600) + ' hours';
  const d = sec / 86400;
  if (d < 365.25) return Math.round(d) + ' days';
  const y = d / 365.25;
  if (y < 1e3) return Math.round(y) + ' years';
  if (y < 1e6) return Math.round(y / 1e3) + ' thousand years';
  if (y < 1e9) return Math.round(y / 1e6) + ' million years';
  if (y < 1e12) return Math.round(y / 1e9) + ' billion years';
  return 'trillions of years or more';
}

/* ---- Generators ---- */
function genPin(len, avoidEasy) {
  for (;;) {
    let s = '';
    for (let i = 0; i < len; i++) s += randInt(10);
    if (!avoidEasy) return s;
    const d = [...s].map(Number);
    const same = d.every(x => x === d[0]);
    const up = d.every((x, i) => i === 0 || x === d[i - 1] + 1), dn = d.every((x, i) => i === 0 || x === d[i - 1] - 1);
    if (!same && !up && !dn) return s;
  }
}
const SETS = { lower: 'abcdefghijklmnopqrstuvwxyz', upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', digit: '0123456789', symbol: '!@#$%^&*()-_=+[]{};:,.?/' };
function genPassword(len, opt = { lower: true, upper: true, digit: true, symbol: true }) {
  const sets = Object.keys(SETS).filter(k => opt[k]).map(k => SETS[k]);
  if (!sets.length) sets.push(SETS.lower);
  len = Math.max(len, sets.length);
  const all = sets.join(''), out = sets.map(s => s[randInt(s.length)]);
  while (out.length < len) out.push(all[randInt(all.length)]);
  for (let i = out.length - 1; i > 0; i--) { const j = randInt(i + 1); [out[i], out[j]] = [out[j], out[i]]; }
  return out.join('');
}
const WORDS = ('able acid acorn actor adapt adult agent agree ahead alarm album alert alien alley allow alone alpha amber ample angle ankle apple april arena argue armor army arrow ' +
  'aspen atlas atom attic audio autumn avoid awake award aware bacon badge bagel baker balance ballot bamboo banjo barn basil basin batch beach beam beard beast bench berry bike ' +
  'birch bison blade blank blast blaze blend bliss block bloom blue blush board boat bonus boost boot border bottle bounce brain brave bread brick bridge brief bright brisk broad ' +
  'bronze brook broom brown brush bubble bucket buddy buffalo build bulb bunch burst butter button cabin cable cactus cadet cake calm camel camp canal candle candy canoe canvas ' +
  'canyon cape captain carbon cargo carpet carrot cart castle cedar cello cement chain chalk chant charm chase cheer cherry chess chest chief child chill chip choir chord cider ' +
  'cinema circle citrus civic clam clay clean clear clerk click cliff climb clock cloud clover clown coach coast cobra cocoa coconut coin comet comic coral cork corn cosmic cotton ' +
  'couch cove craft crane crate crayon cream creek crest crisp crowd crown crumb crystal cube cuddle curve cycle daisy dance dandy dawn deer delta denim desert desk dial diary ' +
  'diner disk ditch dive dock dolphin dome donkey donut door dough dove draft dragon drama dream dress drift drill drink drum duck dune dust eagle earth easel echo eclipse edge ' +
  'elbow elder elect elf elk ember emerald empire empty engine enjoy envoy epic equal essay ether event exact exit extra fable fabric face fairy faith falcon fame fancy farm ' +
  'fashion feast feather fence fern ferry fever fiber field fig film final finch fire first fish fist flag flame flash flax fleet flint float flock flood floor flour flute foam ' +
  'focus fog folk forest forge fork fort fossil fox frame fresh frog frost fruit fudge fun galaxy gallop game garden garlic gate gear gecko gem ghost giant gift giraffe glacier ' +
  'glad glass glide globe glove glow glue goat gold golf goose grace grain grape grass gravel green grid grin grove guard guest guide guitar gull habit hammer hamster hand happy ' +
  'harbor hare harp harvest hat hawk hazel heart heat hedge heel helix helmet herb heron hill hint hippo hobby holly home honey hood hope horizon horn horse hotel hound house ' +
  'hover humble humor hurdle hut icing idea igloo image inch index indigo ink insect iris iron island ivory ivy jacket jade jaguar jam jar jazz jelly jewel jigsaw jolly journey ' +
  'joy judge juice jungle junior jury kayak kettle key kick kid kind king kiosk kitchen kite kiwi knee knife knit knob knot koala label lace ladder lagoon lake lamp lance land ' +
  'lantern lapel laser latch laugh lava lawn layer leaf lemon lens leopard letter level lever lilac lily limb lime linen lion lizard llama lobby lobster lock lodge loft log ' +
  'lotus lucky lumber lunar lunch lychee lynx magic magnet maiden mango maple marble march marsh mask match meadow medal melon memo mentor mercy merit mesh meteor mild mill mint ' +
  'mirror mist mitten moat model mole monkey moon moose moss motor mount mouse movie muffin mug mural music mustard myth nacho napkin navy nectar needle nest net nickel night ' +
  'noble noodle north nose notch novel nugget nut oak oasis oat ocean olive onion opal opera orbit orchid otter oval oven owl oyster paddle paint palace palm panda panel paper ' +
  'parade parrot pasta patch path peace peach peak pearl pebble pecan pedal pelican pencil penguin pepper piano picnic pie pigeon pilot pine pink pixel pizza planet plank plant ' +
  'plaza plum plush pocket poem polar pond pony pool poppy porch potato pouch prairie prism prize pulse pumpkin puppy puzzle quail quartz queen quest quick quiet quill quilt ' +
  'quote rabbit raccoon radar radio raft rain ranch raven razor reef relay ribbon rice ridge river road robin robot rocket rodeo roof rose round ruby rug rumor saddle safari ' +
  'sage sail salad salmon salt sand sapphire satin sauce scarf scene school scout seal season seed shade shark sheep shell shield ship shirt shore signal silk silver sketch ' +
  'skate sky slate sled slope smile smoke snail snake snow soap solar sonic soup spark spice spider spoon spring spruce square squid stable stamp star steam steel stone storm ' +
  'straw stream street studio sugar summer sun swan sweet swing sword table tablet talent tango tape taxi teapot tent thistle thorn thread thumb thunder ticket tiger timber ' +
  'tin toast tomato topaz torch tower toy trail train tree tribe trout truck tulip tuna tunnel turtle twig umbrella unicorn upper valley vanilla velvet vessel video village ' +
  'vine violet violin visor voice volcano voyage wagon walnut walrus water wave wheat wheel whale willow wind window wing winter wizard wolf wonder wool yacht yard yarn yellow ' +
  'yogurt zebra zenith zero zigzag zinc zone zoom').split(' ');
function genPassphrase(count, sep = '-', cap = false, addNum = false) {
  const w = [];
  for (let i = 0; i < count; i++) { let x = WORDS[randInt(WORDS.length)]; if (cap) x = x[0].toUpperCase() + x.slice(1); w.push(x); }
  let s = w.join(sep);
  if (addNum) s += sep + randInt(100);
  return s;
}

/* ---- TOTP (RFC 6238) / HOTP (RFC 4226) ---- */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32decode(s) {
  const t = String(s).toUpperCase().replace(/[\s=-]+/g, '');
  if (!t || /[^A-Z2-7]/.test(t)) throw new Error('bad base32');
  const out = [];
  let bits = 0, val = 0;
  for (const c of t) {
    val = (val << 5) | B32.indexOf(c); bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; val &= (1 << bits) - 1; }
  }
  if (!out.length) throw new Error('bad base32');
  return new Uint8Array(out);
}
async function hotp(secret, counter, digits = 6, algo = 'SHA-1') {
  const key = await SC.subtle.importKey('raw', secret, { name: 'HMAC', hash: algo }, false, ['sign']);
  const buf = new ArrayBuffer(8), dv = new DataView(buf);
  dv.setUint32(0, Math.floor(counter / 4294967296)); dv.setUint32(4, counter >>> 0);
  const mac = new Uint8Array(await SC.subtle.sign('HMAC', key, buf));
  const o = mac[mac.length - 1] & 15;
  const bin = (((mac[o] & 0x7f) << 24) | (mac[o + 1] << 16) | (mac[o + 2] << 8) | mac[o + 3]) >>> 0;
  return String(bin % Math.pow(10, digits)).padStart(digits, '0');
}
const totp = (secret, ms, o = {}) => hotp(secret, Math.floor(ms / 1000 / (o.period || 30)), o.digits || 6, o.algo || 'SHA-1');
function parseOtpauth(uri) {
  const m = /^otpauth:\/\/totp\/([^?]*)\?(.*)$/i.exec(String(uri).trim());
  if (!m) throw new Error('Not a valid otpauth totp link');
  const q = new URLSearchParams(m[2]);
  const label = decodeURIComponent(m[1]);
  let issuer = q.get('issuer') || '', account = label;
  if (label.includes(':')) { const i = label.indexOf(':'); if (!issuer) issuer = label.slice(0, i); account = label.slice(i + 1); }
  const a = (q.get('algorithm') || 'SHA1').toUpperCase().replace(/^SHA-?/, 'SHA-');
  const algo = ['SHA-1', 'SHA-256', 'SHA-512'].includes(a) ? a : 'SHA-1';
  const digits = [6, 7, 8].includes(Number(q.get('digits'))) ? Number(q.get('digits')) : 6;
  const period = Math.min(120, Math.max(10, Number(q.get('period')) || 30));
  return { issuer: issuer.trim(), account: account.trim(), secret: (q.get('secret') || '').replace(/\s+/g, '').toUpperCase(), algo, digits, period };
}
/*PURE-END*/

/* ================= UI helpers ================= */
const CSS = `
.sx{display:flex;flex-direction:column;gap:16px;padding-bottom:12px}
.sx *{min-width:0}
.sx-hero{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;padding:14px 6px 2px}
.sx-badge{width:76px;height:76px;border-radius:24px;display:grid;place-items:center;font-size:38px;box-shadow:var(--shadow);background:linear-gradient(145deg,color-mix(in srgb,var(--accent) 38%,var(--surface)),color-mix(in srgb,var(--accent) 12%,var(--surface)))}
.sx-hero h2{margin:8px 0 0;font-size:22px;letter-spacing:-.2px}
.sx-hero p{margin:0;color:var(--muted);font-size:14px;max-width:330px}
.sx-warn,.sx-note{display:flex;gap:10px;padding:12px 14px;border-radius:14px;font-size:13.5px;line-height:1.45}
.sx-warn{background:color-mix(in srgb,var(--danger) 10%,var(--surface));border:1px solid color-mix(in srgb,var(--danger) 38%,var(--line))}
.sx-note{background:color-mix(in srgb,var(--accent) 9%,var(--surface));border:1px solid color-mix(in srgb,var(--accent) 28%,var(--line))}
.sx-warn>span:first-child,.sx-note>span:first-child{font-size:18px;line-height:1.2}
.sx-card{display:flex;flex-direction:column;gap:12px}
.sx-meter{height:8px;border-radius:99px;background:var(--surface2);overflow:hidden}
.sx-meter i{display:block;height:100%;width:0;border-radius:99px;transition:width .25s,background .25s}
.sx-head{display:flex;align-items:center;gap:10px}
.sx-head .grow{flex:1;min-width:0}
.sx-head b{display:block;font-size:18px}
.sx-head small{color:var(--muted)}
.sx-seg{display:flex;padding:4px;border-radius:14px;background:var(--surface2);gap:4px}
.sx-seg button{flex:1;min-height:44px;border:0;border-radius:11px;background:none;font-weight:600;color:var(--muted)}
.sx-seg button.on{background:var(--surface);color:var(--text);box-shadow:var(--shadow)}
.sx-pw{position:relative}
.sx-pw input{padding-right:52px}
.sx-eye{position:absolute;right:2px;top:0;bottom:0;width:48px;border:0;background:none;font-size:18px}
.sx-ic{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;font-size:22px;font-weight:700;background:color-mix(in srgb,var(--accent) 16%,var(--surface2));flex:none;overflow:hidden}
.sx-ic img{width:100%;height:100%;object-fit:cover}
.sx-act{display:flex;gap:8px;flex-wrap:wrap}
.sx-act button{flex:1;min-height:44px;padding:0 12px;border-radius:12px;border:1px solid var(--line);background:var(--surface);font-weight:600;font-size:14px}
.sx-act button.dg{color:var(--danger)}
.sx-drop{border:2px dashed var(--line);border-radius:18px;padding:22px 16px;text-align:center;background:var(--surface);display:flex;flex-direction:column;gap:8px;align-items:center}
.sx-mono{font-family:ui-monospace,Menlo,Consolas,monospace;word-break:break-all}
.sx-code{font:700 36px ui-monospace,Menlo,Consolas,monospace;letter-spacing:.06em;font-variant-numeric:tabular-nums}
.sx-empty{text-align:center;color:var(--muted);padding:24px 10px;font-size:14px}
.sx-ell{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sx-t{display:flex;align-items:center;gap:12px;min-height:44px}
.sx-t input[type=checkbox]{width:24px;height:24px;flex:none;accent-color:var(--accent)}
.sx-kv{display:flex;justify-content:space-between;gap:12px;font-size:14px;padding:6px 0;border-bottom:1px solid var(--line)}
.sx-kv:last-child{border-bottom:0}
.sx-kv span:first-child{color:var(--muted)}
.sx-kv span:last-child{text-align:right;font-weight:600}
.sx-sec details>summary{cursor:pointer;font-weight:600;min-height:44px;display:flex;align-items:center}
.sx h3{margin:0;font-size:16px}
.sx-lbl{font-size:13px;color:var(--muted);margin:0}
`;
const mount = el => { el.innerHTML = '<style>' + CSS + '</style><div class="sx"></div>'; return $('.sx', el); };
const hero = (icon, title, text) => `<div class="sx-hero"><div class="sx-badge">${icon}</div><h2>${esc(title)}</h2><p>${esc(text)}</p></div>`;
const NB = () => (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.NativeBiometric) || null;
const fmtSize = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : n < 1073741824 ? (n / 1048576).toFixed(1) + ' MB' : (n / 1073741824).toFixed(2) + ' GB';
const METER = ['var(--danger)', '#f97316', '#eab308', '#84cc16', 'var(--ok)'];
function paintMeter(meter, a) {
  const bar = $('i', meter);
  bar.style.width = a.len ? Math.min(100, 12 + a.level * 22) + '%' : '0';
  bar.style.background = METER[a.level];
}
function pwField(id, label, ph, auto) {
  return `<label class="f">${esc(label)}<div class="sx-pw"><input type="password" id="${id}" placeholder="${esc(ph || '')}" autocomplete="${auto || 'off'}" autocapitalize="off" spellcheck="false" maxlength="256"><button type="button" class="sx-eye" data-eye="${id}" aria-label="Show or hide password">👁</button></div></label>`;
}
function wireEyes(root) {
  $$('[data-eye]', root).forEach(b => b.addEventListener('click', () => {
    const i = $('#' + b.dataset.eye, root);
    if (i) i.type = i.type === 'password' ? 'text' : 'password';
  }));
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* Open a modal dialog inside the tool; it removes itself on close. */
function dialog(root, html) {
  const d = document.createElement('dialog');
  d.innerHTML = '<div class="dlg">' + html + '</div>';
  root.appendChild(d);
  d.addEventListener('close', () => d.remove());
  d.addEventListener('cancel', () => {});
  try { d.showModal(); } catch (e) { d.setAttribute('open', ''); }
  return d;
}
function askPassword(root, title, text) {
  return new Promise(res => {
    const d = dialog(root, `<h2>${esc(title)}</h2><p class="muted" style="margin:0">${esc(text)}</p>${pwField('ap', 'Password', '', 'off')}<div class="row"><button class="btn alt" data-x="0">Cancel</button><button class="btn" data-x="1">Continue</button></div>`);
    wireEyes(d);
    let done = false;
    const fin = v => { if (done) return; done = true; const x = $('#ap', d); if (x) x.value = ''; try { d.close(); } catch (e) { d.remove(); } res(v); };
    $('[data-x="0"]', d).onclick = () => fin(null);
    $('[data-x="1"]', d).onclick = () => fin($('#ap', d).value);
    $('#ap', d).addEventListener('keydown', e => { if (e.key === 'Enter') fin($('#ap', d).value); });
    d.addEventListener('close', () => fin(null));
  });
}

/* Clipboard with optional auto-clear (best effort: Android may refuse while the app is in the background). */
let clipVal = null, clipExp = 0, clipT = 0;
async function clipWrite(t) {
  try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(t); return true; } } catch (e) { /* fall through */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = t; ta.style.cssText = 'position:fixed;opacity:0;top:0'; document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch (e) { return false; }
}
async function clipClear() {
  clearTimeout(clipT);
  const v = clipVal; clipVal = null;
  if (v === null) return;
  try {
    let cur = null;
    try { cur = await navigator.clipboard.readText(); } catch (e) { /* reading may be blocked: clear anyway */ }
    if (cur === null || cur === v) await navigator.clipboard.writeText('');
  } catch (e) { /* not allowed right now */ }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && clipVal !== null && Date.now() >= clipExp) clipClear(); });
async function copyText(t, clearMs) {
  const ok = await clipWrite(t);
  if (!ok) { toast('Could not copy'); return false; }
  if (clearMs) { clearTimeout(clipT); clipVal = t; clipExp = Date.now() + clearMs; clipT = setTimeout(clipClear, clearMs); toast('Copied. Clears in ' + Math.round(clearMs / 1000) + ' s'); }
  else toast('Copied');
  return true;
}

/* Save or share a Blob: native share sheet on Android, a normal download elsewhere. */
async function saveFile(blob, name) {
  const P = (window.Capacitor && Capacitor.Plugins) || {};
  const safe = String(name || 'file').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 100) || 'file';
  if (P.Filesystem && P.Share) {
    try {
      const path = 'pk-export/' + safe;
      await P.Filesystem.writeFile({ path, data: b64e(new Uint8Array(await blob.arrayBuffer())), directory: 'CACHE', recursive: true });
      const r = await P.Filesystem.getUri({ path, directory: 'CACHE' });
      await P.Share.share({ title: safe, files: [r.uri] });
      setTimeout(() => { try { P.Filesystem.deleteFile({ path, directory: 'CACHE' }).catch(() => {}); } catch (e) { /* ignore */ } }, 120000);
      return true;
    } catch (e) {
      if (/cancel/i.test(String(e && (e.message || e)))) return false;
    }
  }
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = safe; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return true;
}
async function shareText(text) {
  const P = (window.Capacitor && Capacitor.Plugins) || {};
  try { if (P.Share) { await P.Share.share({ text }); return true; } } catch (e) { return false; }
  try { if (navigator.share) { await navigator.share({ text }); return true; } } catch (e) { return false; }
  return copyText(text);
}

/* Tiny IndexedDB wrapper (out-of-line keys). */
function idb(name, stores) {
  let p = null;
  const open = () => p || (p = new Promise((res, rej) => {
    const r = indexedDB.open(name, 1);
    r.onupgradeneeded = () => { for (const s of stores) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const run = async (store, mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction(store, mode), r = fn(t.objectStore(store));
      t.oncomplete = () => res(r && r.result);
      t.onerror = t.onabort = () => rej(t.error || new Error('db'));
    });
  };
  return {
    get: (s, k) => run(s, 'readonly', o => o.get(k)),
    put: (s, k, v) => run(s, 'readwrite', o => o.put(v, k)),
    del: (s, k) => run(s, 'readwrite', o => o.delete(k)),
    all: s => run(s, 'readonly', o => o.getAll()),
    count: s => run(s, 'readonly', o => o.count()),
    async batch(ops) {
      const db = await open();
      return new Promise((res, rej) => {
        const t = db.transaction([...new Set(ops.map(o => o.s))], 'readwrite');
        ops.forEach(o => { const os = t.objectStore(o.s); if (o.del) os.delete(o.k); else os.put(o.v, o.k); });
        t.oncomplete = () => res(); t.onerror = t.onabort = () => rej(t.error || new Error('db'));
      });
    },
    close() { if (p) { p.then(d => d.close()).catch(() => {}); p = null; } }
  };
}

/* Failed-attempt lockout: 30 s after every 5 failures, doubling each round (max 15 min). Stored on the device. */
function lockout(name) {
  const k = 'sec.lock.' + name, get = () => Store.get(k, { n: 0, until: 0 });
  return {
    left() { return Math.max(0, get().until - Date.now()); },
    fail() { const s = get(); s.n++; if (s.n % 5 === 0) s.until = Date.now() + Math.min(900000, 30000 * Math.pow(2, s.n / 5 - 1)); Store.set(k, s); return s.n; },
    ok() { Store.set(k, { n: 0, until: 0 }); }
  };
}

/* ================= Sealed shell: setup / unlock / lock / settings for every password-protected tool ================= */
/* cfg: { name, db, stores, icon, title, blurb, init(), build(body, S), rekey?, backup?, bio? } */
function sealedShell(el, cfg) {
  const box = mount(el);
  const db = idb('pk-' + cfg.db, ['kv'].concat(cfg.stores || []));
  const lk = lockout(cfg.name), BIO_KEY = 'sec.bio.' + cfg.name, BIO_SRV = 'pocketkit.' + cfg.name;
  let rec = null, key = null, data = null, alive = true, hiddenAt = 0, holdUntil = 0, hideT = 0, cdT = 0, bodyClean = null, busy = false;
  const S = {
    db, root: el,
    get data() { return data; }, get key() { return key; },
    hold(ms) { holdUntil = Math.max(holdUntil, Date.now() + ms); },
    async save() { rec = await sealedSave(cfg.name, rec, key, data); await db.put('kv', 'rec', rec); },
    lock, refresh: buildBody,
    progress(msg) { const e = $('#sx-cpmsg', box); if (e) e.textContent = msg; }
  };

  function clearTimers() { clearInterval(cdT); clearTimeout(hideT); }
  function lock() {
    if (bodyClean) { try { bodyClean(); } catch (e) { /* ignore */ } bodyClean = null; }
    key = null; data = null; clearTimers();
    $$('dialog', el).forEach(d => { try { d.close(); } catch (e) { d.remove(); } });
    if (alive) showUnlock();
  }

  async function start() {
    try { rec = await db.get('kv', 'rec'); } catch (e) { box.innerHTML = '<div class="sx-warn"><span>⚠️</span><span>Secure storage is not available in this browser, so this tool cannot work here.</span></div>'; return; }
    if (!alive) return;
    rec ? showUnlock() : showSetup();
  }

  function showSetup() {
    box.innerHTML = hero(cfg.icon, 'Create your ' + cfg.title, cfg.blurb) +
      `<div class="card sx-card">
        ${pwField('s1', 'Choose a strong password', 'At least 8 characters', 'new-password')}
        <div class="sx-meter" id="s-meter"><i></i></div><div class="muted" id="s-hint" style="font-size:13px">Use a long phrase you can remember.</div>
        ${pwField('s2', 'Confirm password', '', 'new-password')}
        <div class="sx-warn"><span>⚠️</span><span><b>There is no way to recover a forgotten password.</b> Nobody, including the app maker, can open your data without it. Write it down and keep it somewhere safe.</span></div>
        <label class="sx-t"><input type="checkbox" id="s-ok"><span>I understand I cannot recover my data if I forget this password.</span></label>
        <div class="status" id="s-err" role="alert"></div>
        <button class="btn" id="s-go" style="min-height:48px">Create ${esc(cfg.title)}</button>
      </div>`;
    wireEyes(box);
    const m = $('#s-meter', box), hint = $('#s-hint', box);
    $('#s1', box).addEventListener('input', e => {
      const a = assess(e.target.value);
      paintMeter(m, a); hint.textContent = a.len ? a.label + ' (about ' + Math.round(a.entropy) + ' bits)' + (a.issues[0] ? '. ' + a.issues[0] : '') : 'Use a long phrase you can remember.';
    });
    $('#s-go', box).addEventListener('click', async () => {
      if (busy) return;
      const p1 = $('#s1', box).value, p2 = $('#s2', box).value, err = $('#s-err', box);
      err.textContent = '';
      if (p1.length < 8) { err.textContent = 'Use at least 8 characters.'; return; }
      if (p1 !== p2) { err.textContent = 'The two passwords do not match.'; return; }
      if (!$('#s-ok', box).checked) { err.textContent = 'Please tick the box to confirm you understand.'; return; }
      busy = true; const b = $('#s-go', box); b.disabled = true; b.textContent = 'Securing…';
      try {
        const init = cfg.init(), r = await sealedCreate(cfg.name, p1, init);
        await db.put('kv', 'rec', r.rec);
        rec = r.rec; key = r.key; data = init;
        $('#s1', box).value = ''; $('#s2', box).value = '';
        busy = false; showUnlocked();
      } catch (e) { busy = false; b.disabled = false; b.textContent = 'Create ' + cfg.title; err.textContent = 'Could not create it: ' + (e && e.message || 'error'); }
    });
  }

  function showUnlock() {
    const bioOn = cfg.bio && NB() && Store.get(BIO_KEY, false);
    box.innerHTML = hero('🔒', cfg.title + ' is locked', 'Enter your password to open it. It stays encrypted on this device.') +
      `<div class="card sx-card">
        ${pwField('u1', 'Password', '', 'current-password')}
        <div class="status" id="u-err" role="alert"></div>
        <button class="btn" id="u-go" style="min-height:48px">Unlock</button>
        ${bioOn ? '<button class="btn alt" id="u-bio" style="min-height:48px">👆 Unlock with biometrics</button>' : ''}
      </div>`;
    wireEyes(box);
    const err = $('#u-err', box), go = $('#u-go', box), inp = $('#u1', box);
    function cd() {
      clearInterval(cdT);
      const upd = () => {
        const left = lk.left();
        if (left > 0) { err.textContent = 'Too many wrong attempts. Try again in ' + Math.ceil(left / 1000) + ' s.'; go.disabled = true; inp.disabled = true; }
        else { clearInterval(cdT); go.disabled = false; inp.disabled = false; if (/Too many/.test(err.textContent)) err.textContent = ''; }
      };
      if (lk.left() > 0) { upd(); cdT = setInterval(upd, 500); }
    }
    async function attempt(pw) {
      if (busy || lk.left() > 0) return;
      if (!pw) { err.textContent = 'Enter your password.'; return; }
      busy = true; go.disabled = true; go.textContent = 'Unlocking…'; err.textContent = '';
      try {
        const r = await sealedOpen(cfg.name, rec, pw);
        lk.ok(); key = r.key; data = r.obj; busy = false; inp.value = '';
        showUnlocked();
      } catch (e) {
        busy = false; if (!alive) return;
        go.textContent = 'Unlock'; go.disabled = false;
        lk.fail(); inp.value = ''; inp.focus();
        err.textContent = 'Wrong password.';
        cd();
      }
    }
    go.addEventListener('click', () => attempt(inp.value));
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') attempt(inp.value); });
    const bio = $('#u-bio', box);
    if (bio) bio.addEventListener('click', async () => {
      try {
        await NB().verifyIdentity({ reason: 'Unlock ' + cfg.title, title: 'Unlock ' + cfg.title });
        const c = await NB().getCredentials({ server: BIO_SRV });
        await attempt(c.password);
      } catch (e) { err.textContent = 'Biometric unlock was cancelled or is unavailable. Use your password.'; }
    });
    cd();
  }

  function showUnlocked() {
    box.innerHTML = `<div class="sx-head"><div class="grow"><b>${cfg.icon} ${esc(cfg.title)}</b><small>Unlocked. Locks when you leave or after 60 s away.</small></div><button class="btn alt" id="sx-lock" style="min-height:44px">🔒 Lock</button></div>
      <div class="sx" id="sx-body"></div>
      <div class="card sx-sec"><details><summary>⚙️ Security and backup</summary><div class="sx-card" style="margin-top:8px" id="sx-set"></div></details></div>`;
    $('#sx-lock', box).addEventListener('click', lock);
    buildSettings();
    buildBody();
  }
  function buildBody() {
    if (bodyClean) { try { bodyClean(); } catch (e) { /* ignore */ } bodyClean = null; }
    const body = $('#sx-body', box);
    if (!body || !key) return;
    body.innerHTML = '';
    bodyClean = cfg.build(body, S) || null;
  }

  async function bioInit(set) {
    const avail = cfg.bio && NB();
    if (!avail) return;
    let ok = false;
    try { const r = await NB().isAvailable(); ok = !!(r && r.isAvailable); } catch (e) { ok = false; }
    if (!ok || !alive) return;
    const on = Store.get(BIO_KEY, false), c = h(`<div class="sx-card" id="sx-bio"><h3>Biometric quick unlock</h3>
      <p class="muted" style="margin:0;font-size:13.5px">If you turn this on, your password is saved in the Android secure credential store and released only after your fingerprint or face check. Anyone who can pass a biometric check on this phone could then open the vault. Leave it off if you share biometrics or want maximum protection.</p>
      <button class="btn ${on ? 'alt' : ''}" id="bio-t" style="min-height:44px">${on ? 'Turn off biometric unlock' : 'Turn on biometric unlock'}</button><div class="status" id="bio-e"></div></div>`);
    set.appendChild(c);
    $('#bio-t', c).addEventListener('click', async () => {
      const e = $('#bio-e', c);
      if (Store.get(BIO_KEY, false)) {
        try { await NB().deleteCredentials({ server: BIO_SRV }); } catch (x) { /* ignore */ }
        Store.set(BIO_KEY, false); toast('Biometric unlock is off'); buildSettings(); return;
      }
      const pw = await askPassword(el, 'Confirm your password', 'Enter your password once to store it behind biometrics.');
      if (pw === null) return;
      try {
        await sealedOpen(cfg.name, rec, pw);
      } catch (x) { e.textContent = 'That password is not correct.'; return; }
      try {
        await NB().verifyIdentity({ reason: 'Turn on biometric unlock', title: 'Biometric unlock' });
        await NB().setCredentials({ username: cfg.name, password: pw, server: BIO_SRV });
        Store.set(BIO_KEY, true); toast('Biometric unlock is on'); buildSettings();
      } catch (x) { e.textContent = 'Could not turn on biometric unlock.'; }
    });
  }

  function buildSettings() {
    const set = $('#sx-set', box);
    if (!set) return;
    set.innerHTML = `<h3>Change password</h3>
      ${pwField('c0', 'Current password', '', 'current-password')}
      ${pwField('c1', 'New password', 'At least 8 characters', 'new-password')}
      <div class="sx-meter" id="c-meter"><i></i></div>
      ${pwField('c2', 'Confirm new password', '', 'new-password')}
      <div class="status" id="c-err" role="alert"></div><div class="status info" id="sx-cpmsg"></div>
      <button class="btn" id="c-go" style="min-height:44px">Change password</button>
      <p class="muted" style="margin:0;font-size:13px">A new password creates a new encryption key and re-encrypts everything. It cannot be undone, and the old password stops working.</p>`;
    wireEyes(set);
    $('#c1', set).addEventListener('input', e => paintMeter($('#c-meter', set), assess(e.target.value)));
    $('#c-go', set).addEventListener('click', async () => {
      if (busy) return;
      const cur = $('#c0', set).value, n1 = $('#c1', set).value, n2 = $('#c2', set).value, err = $('#c-err', set);
      err.textContent = '';
      if (n1.length < 8) { err.textContent = 'The new password needs at least 8 characters.'; return; }
      if (n1 !== n2) { err.textContent = 'The new passwords do not match.'; return; }
      busy = true; const b = $('#c-go', set); b.disabled = true;
      try {
        try { await sealedOpen(cfg.name, rec, cur); } catch (e) { err.textContent = 'Current password is not correct.'; return; }
        S.progress('Creating a new key…');
        const nu = await sealedCreate(cfg.name, n1, data);
        if (cfg.rekey) await cfg.rekey(S, key, nu.key, nu.rec); else await db.put('kv', 'rec', nu.rec);
        key = nu.key; rec = nu.rec;
        if (cfg.bio && NB() && Store.get(BIO_KEY, false)) {
          try { await NB().setCredentials({ username: cfg.name, password: n1, server: BIO_SRV }); }
          catch (e) { Store.set(BIO_KEY, false); }
        }
        toast('Password changed'); buildSettings(); buildBody();
      } catch (e) {
        err.textContent = 'Could not change the password: ' + (e && e.message || 'error') + '. Nothing was changed.';
        S.progress('');
      } finally { busy = false; b.disabled = false; }
    });
    if (cfg.backup) buildBackup(set);
    bioInit(set);
  }

  function buildBackup(set) {
    const c = h(`<div class="sx-card"><h3>Encrypted backup</h3>
      <div class="sx-warn"><span>⚠️</span><span>The backup file is encrypted with your <b>current master password</b>. Keep the file and remember that password: without it the backup is useless, and a weak password makes the backup easy to attack.</span></div>
      <div class="row"><button class="btn alt" id="b-ex" style="min-height:44px">Export backup</button><button class="btn alt" id="b-im" style="min-height:44px">Import backup</button></div>
      <input type="file" id="b-file" accept=".json,application/json" hidden><div class="status info" id="b-msg"></div></div>`);
    set.appendChild(c);
    const msg = t => { $('#b-msg', c).textContent = t; };
    $('#b-ex', c).addEventListener('click', async () => {
      S.hold(60000);
      const out = JSON.stringify(Object.assign({ app: 'PocketKit', type: cfg.name }, rec));
      const d = new Date();
      const ok = await saveFile(new Blob([out], { type: 'application/json' }), 'pocketkit-' + cfg.name + '-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '.pkbackup.json');
      if (ok) msg('Backup exported. Store it somewhere safe.');
    });
    $('#b-im', c).addEventListener('click', () => { S.hold(120000); $('#b-file', c).click(); });
    $('#b-file', c).addEventListener('change', async ev => {
      const f = ev.target.files && ev.target.files[0]; ev.target.value = '';
      if (!f || !key) return;
      if (f.size > 30 * 1048576) { msg('That file is too big to be a backup.'); return; }
      let b;
      try { b = JSON.parse(await f.text()); } catch (e) { msg('That is not a PocketKit backup file.'); return; }
      if (!b || b.app !== 'PocketKit' || b.type !== cfg.name) { msg('That backup belongs to a different tool.'); return; }
      const pw = await askPassword(el, 'Backup password', 'Enter the master password the backup was made with. Entries that are not already here will be added.');
      if (pw === null) return;
      msg('Decrypting…');
      try {
        const r = await sealedOpen(cfg.name, b, pw);
        const added = cfg.backup.merge(data, r.obj);
        await S.save();
        msg('Imported ' + added + ' item' + (added === 1 ? '' : 's') + '.');
        buildBody();
      } catch (e) { msg('Could not open the backup. Wrong password or damaged file.'); }
    });
  }

  function onVis() {
    if (document.hidden) {
      hiddenAt = Date.now(); clearTimeout(hideT);
      hideT = setTimeout(() => { if (document.hidden && key && Date.now() > holdUntil) lock(); }, 60000);
    } else {
      clearTimeout(hideT);
      if (hiddenAt && key && Date.now() - hiddenAt >= 60000 && Date.now() > holdUntil) lock();
      hiddenAt = 0;
    }
  }
  document.addEventListener('visibilitychange', onVis);
  start();
  return () => {
    alive = false; document.removeEventListener('visibilitychange', onVis); clearTimers();
    if (bodyClean) { try { bodyClean(); } catch (e) { /* ignore */ } }
    key = null; data = null; rec = null; db.close();
  };
}

/* ================= 1. File Locker ================= */
const fAad = (k, id) => 'pk1/locker/' + k + '/' + id;
const typeIcon = t => /^image/.test(t) ? '🖼️' : /^video/.test(t) ? '🎬' : /^audio/.test(t) ? '🎵' : /pdf/.test(t) ? '📕' : /^text/.test(t) ? '📄' : /zip|rar|7z|tar|gzip/.test(t) ? '🗜️' : '📎';
const guessType = n => {
  const e = (String(n).split('.').pop() || '').toLowerCase();
  return ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
    mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', pdf: 'application/pdf', txt: 'text/plain', md: 'text/plain', csv: 'text/csv', zip: 'application/zip' })[e] || 'application/octet-stream';
};

async function makeThumb(file) {
  try {
    if (!/^image\/(jpeg|png|webp|gif)/.test(file.type) || file.size > 40 * 1048576) return null;
    const bmp = await createImageBitmap(file), s = Math.min(1, 160 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * s)); c.height = Math.max(1, Math.round(bmp.height * s));
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    if (bmp.close) bmp.close();
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.7));
    return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
  } catch (e) { return null; }
}

function lockerBuild(body, S) {
  const db = S.db;
  let urls = [], dead = false;
  const lim = () => proLimit('locker');
  body.innerHTML = `<div class="card sx-card"><div class="sx-head"><div class="grow"><b id="lk-sum">Your files</b><small id="lk-sub"></small></div></div>
      <div class="progress"><i id="lk-bar" style="width:0"></i></div></div>
    <div class="sx-drop"><div style="font-size:36px">🗂️</div><b>Add files to the locker</b>
      <span class="muted" style="font-size:13.5px">Photos, videos and documents. Each file is encrypted with AES-256 before it is stored.</span>
      <button class="btn" id="lk-add" style="min-height:48px;padding:0 24px">＋ Choose files</button>
      <input type="file" id="lk-in" multiple hidden></div>
    <div class="status info" id="lk-msg" role="status"></div>
    <div class="list" id="lk-list"></div>
    <div class="sx-note"><span>ℹ️</span><span>The originals stay in your gallery or Files app until you delete them yourself. Deleting from here removes only the locked copy.</span></div>`;
  const msg = t => { if (!dead) $('#lk-msg', body).textContent = t; };
  const aad = fAad;

  async function load() {
    urls.forEach(u => URL.revokeObjectURL(u)); urls = [];
    let recs = [];
    try { recs = await db.all('files'); } catch (e) { msg('Could not read the locker storage.'); return; }
    const items = [];
    for (const r of recs) {
      if (dead || !S.key) return;
      try {
        const meta = JSON.parse(td.decode(await openBytes(S.key, r.mi, r.mc, aad('m', r.id))));
        let th = null;
        if (r.tc) { try { th = URL.createObjectURL(new Blob([await openBytes(S.key, r.ti, r.tc, aad('t', r.id))], { type: 'image/jpeg' })); urls.push(th); } catch (e) { th = null; } }
        items.push({ id: r.id, meta, th });
      } catch (e) { items.push({ id: r.id, meta: { name: '(damaged item)', size: 0, type: '', added: 0 }, th: null, bad: true }); }
    }
    if (dead) return;
    items.sort((a, b) => (b.meta.added || 0) - (a.meta.added || 0));
    const total = items.reduce((s, i) => s + (i.meta.size || 0), 0), l = lim();
    $('#lk-sum', body).textContent = items.length + (items.length === 1 ? ' locked file' : ' locked files');
    $('#lk-sub', body).textContent = fmtSize(total) + (l === Infinity ? ' · Pro: unlimited' : ' · free limit ' + items.length + ' of ' + l);
    $('#lk-bar', body).style.width = (l === Infinity ? Math.min(100, items.length * 4) : Math.min(100, items.length / l * 100)) + '%';
    const list = $('#lk-list', body);
    if (!items.length) { list.innerHTML = '<div class="sx-empty">Nothing here yet.<br>Add a photo or document to protect it.</div>'; return; }
    list.innerHTML = items.map(i => `<div class="card sx-card" data-id="${esc(i.id)}">
        <div style="display:flex;gap:12px;align-items:center"><div class="sx-ic">${i.th ? `<img alt="" src="${i.th}">` : typeIcon(i.meta.type || '')}</div>
        <div class="grow" style="flex:1"><b class="sx-ell">${esc(i.meta.name)}</b><small class="muted">${fmtSize(i.meta.size || 0)}${i.meta.added ? ' · ' + esc(new Date(i.meta.added).toLocaleDateString()) : ''}</small></div></div>
        <div class="sx-act">${i.bad ? '' : '<button data-a="view">👁 View</button><button data-a="exp">⬇ Export</button>'}<button data-a="del" class="dg">🗑 Delete</button></div></div>`).join('');
  }

  async function addFiles(files) {
    const arr = [...files];
    let done = 0;
    for (const f of arr) {
      if (dead || !S.key) return;
      const count = await db.count('files');
      if (count >= lim() && needPro('locker')) { msg('Free limit reached. Upgrade to Pro for unlimited files.'); break; }
      if (f.size > 100 * 1048576 && !confirm(f.name + ' is ' + fmtSize(f.size) + '. Large files use a lot of memory and may fail on some phones. Continue?')) continue;
      msg('Encrypting ' + (done + 1) + ' of ' + arr.length + ': ' + f.name);
      try {
        const buf = new Uint8Array(await f.arrayBuffer()), id = hex(rnd(8)), type = f.type || guessType(f.name);
        const d = await sealBytes(S.key, buf, aad('f', id));
        buf.fill(0);
        const m = await sealBytes(S.key, te.encode(JSON.stringify({ name: f.name, size: f.size, type, added: Date.now() })), aad('m', id));
        const tb = await makeThumb(f);
        const t = tb ? await sealBytes(S.key, tb, aad('t', id)) : null;
        await db.put('files', id, { id, di: d.iv, dc: d.ct, mi: m.iv, mc: m.ct, ti: t && t.iv, tc: t && t.ct });
        done++;
      } catch (e) { msg('Could not add ' + f.name + ' (the file may be too large for this device).'); await sleep(1500); }
    }
    if (done) msg(done + (done === 1 ? ' file locked.' : ' files locked.')); else if (!$('#lk-msg', body).textContent) msg('');
    await load();
  }

  async function plain(id) {
    const r = await db.get('files', id), meta = JSON.parse(td.decode(await openBytes(S.key, r.mi, r.mc, aad('m', id))));
    const bytes = await openBytes(S.key, r.di, r.dc, aad('f', id));
    return { meta, bytes };
  }
  async function view(id) {
    msg('Decrypting…');
    try {
      const { meta, bytes } = await plain(id);
      msg('');
      const t = meta.type || '', url = URL.createObjectURL(new Blob([bytes], { type: t }));
      let inner;
      if (/^image\//.test(t)) inner = `<img alt="" src="${url}" style="max-width:100%;max-height:60vh;border-radius:12px;display:block;margin:0 auto">`;
      else if (/^video\//.test(t)) inner = `<video src="${url}" controls playsinline style="max-height:60vh"></video>`;
      else if (/^audio\//.test(t)) inner = `<audio src="${url}" controls style="width:100%"></audio>`;
      else if (/^text\//.test(t)) inner = `<pre style="white-space:pre-wrap;word-break:break-word;max-height:55vh;overflow:auto;margin:0;font-size:13px">${esc(td.decode(bytes.subarray(0, 20000)))}${bytes.length > 20000 ? '\n…' : ''}</pre>`;
      else inner = '<p class="muted" style="margin:0">No preview for this type of file. Use Export to open it in another app.</p>';
      const d = dialog(S.root, `<h2 class="sx-ell">${esc(meta.name)}</h2>${inner}<button class="btn" id="v-x" style="min-height:48px">Close</button>`);
      $('#v-x', d).onclick = () => d.close();
      d.addEventListener('close', () => URL.revokeObjectURL(url));
    } catch (e) { msg('Could not decrypt this file.'); }
  }
  async function exportFile(id) {
    S.hold(90000); msg('Decrypting…');
    try {
      const { meta, bytes } = await plain(id);
      await saveFile(new Blob([bytes], { type: meta.type || 'application/octet-stream' }), meta.name);
      msg('Exported. The exported copy is NOT encrypted; delete it when you are done.');
    } catch (e) { msg('Could not export this file.'); }
  }

  $('#lk-add', body).addEventListener('click', () => { S.hold(180000); $('#lk-in', body).click(); });
  $('#lk-in', body).addEventListener('change', ev => { const fs = ev.target.files; if (fs && fs.length) addFiles(fs).finally(() => { ev.target.value = ''; }); });
  $('#lk-list', body).addEventListener('click', async ev => {
    const b = ev.target.closest('button[data-a]');
    if (!b) return;
    const id = b.closest('[data-id]').dataset.id;
    if (b.dataset.a === 'view') view(id);
    else if (b.dataset.a === 'exp') exportFile(id);
    else if (b.dataset.a === 'del' && confirm('Delete this locked file permanently? This cannot be undone.')) { await db.del('files', id); load(); }
  });
  load();
  return () => { dead = true; urls.forEach(u => URL.revokeObjectURL(u)); urls = []; };
}

async function lockerRekey(S, oldKey, newKey, newRec) {
  const recs = await S.db.all('files'), ops = [];
  let i = 0;
  for (const r of recs) {
    S.progress('Re-encrypting ' + (++i) + ' of ' + recs.length + '…');
    const n = { id: r.id };
    for (const [k, iv, ct] of [['f', 'di', 'dc'], ['m', 'mi', 'mc'], ['t', 'ti', 'tc']]) {
      if (!r[ct]) continue;
      const pt = await openBytes(oldKey, r[iv], r[ct], fAad(k, r.id));
      const s = await sealBytes(newKey, pt, fAad(k, r.id));
      pt.fill(0); n[iv] = s.iv; n[ct] = s.ct;
    }
    ops.push({ s: 'files', k: r.id, v: n });
  }
  ops.push({ s: 'kv', k: 'rec', v: newRec });
  S.progress('Saving…');
  await S.db.batch(ops); // one transaction: either everything switches to the new key or nothing does
}

Tools.register({
  id: 'locker', name: 'File Locker', icon: '🔐', cat: 'security',
  desc: 'Lock photos, videos and documents with AES-256 encryption behind your own password, with optional biometric unlock.',
  keys: ['vault', 'encrypt', 'private', 'hide', 'photos', 'safe'], needs: ['storage'],
  render(el) {
    return sealedShell(el, {
      name: 'locker', db: 'locker', stores: ['files'], icon: '🔐', title: 'File Locker', bio: true,
      blurb: 'Photos, videos and documents are encrypted with AES-256 and a key made from your password. Everything stays on this phone.',
      init: () => ({ ok: 1 }), build: lockerBuild, rekey: lockerRekey
    });
  }
});

/* ================= 2. Password Vault ================= */
function vaultBuild(body, S) {
  let q = '', shown = new Set(), dead = false;
  body.innerHTML = `<div class="row"><input type="search" id="v-q" placeholder="Search entries" aria-label="Search entries" maxlength="80"><button class="btn" id="v-add" style="flex:0 0 auto;min-height:46px">＋ Add</button></div>
    <div class="status info" id="v-lim"></div><div class="list" id="v-list"></div>`;
  const items = () => S.data.items;

  function render() {
    if (dead) return;
    const l = proLimit('vault'), all = items();
    $('#v-lim', body).textContent = l === Infinity ? all.length + ' entries · Pro: unlimited' : all.length + ' of ' + l + ' free entries used';
    const t = q.trim().toLowerCase();
    const rows = all.filter(e => !t || (e.title + ' ' + e.user + ' ' + e.url).toLowerCase().includes(t)).sort((a, b) => a.title.localeCompare(b.title));
    const list = $('#v-list', body);
    if (!rows.length) { list.innerHTML = `<div class="sx-empty">${all.length ? 'No entries match your search.' : 'No passwords saved yet.<br>Tap Add to store your first one.'}</div>`; return; }
    list.innerHTML = rows.map(e => `<div class="card sx-card" data-id="${esc(e.id)}">
      <div style="display:flex;gap:12px;align-items:center"><div class="sx-ic">${esc((e.title[0] || '?').toUpperCase())}</div>
        <div style="flex:1"><b class="sx-ell">${esc(e.title)}</b><small class="muted sx-ell">${esc(e.user || 'No username')}</small></div></div>
      <div class="sx-mono" style="padding:8px 12px;border-radius:10px;background:var(--surface2);font-size:14px">${shown.has(e.id) ? esc(e.pass) : '••••••••••••'}</div>
      ${e.url ? `<small class="muted sx-ell">${esc(e.url)}</small>` : ''}
      <div class="sx-act"><button data-a="cu">Copy user</button><button data-a="cp">Copy password</button><button data-a="sh">${shown.has(e.id) ? 'Hide' : 'Show'}</button><button data-a="ed">Edit</button></div></div>`).join('');
  }

  function edit(id) {
    const cur = id ? items().find(e => e.id === id) : null;
    if (!cur && items().length >= proLimit('vault') && needPro('vault')) return;
    const e = cur || { id: hex(rnd(8)), title: '', user: '', pass: '', url: '', notes: '' };
    const d = dialog(S.root, `<h2>${cur ? 'Edit entry' : 'New entry'}</h2>
      <label class="f">Title<input type="text" id="e-t" maxlength="80" autocomplete="off" value="${esc(e.title)}"></label>
      <label class="f">Username or email<input type="text" id="e-u" maxlength="160" autocomplete="off" autocapitalize="off" value="${esc(e.user)}"></label>
      <label class="f">Password<div class="sx-pw"><input type="password" id="e-p" maxlength="256" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(e.pass)}"><button type="button" class="sx-eye" data-eye="e-p" aria-label="Show or hide password">👁</button></div></label>
      <div class="sx-meter" id="e-m"><i></i></div>
      <div class="row"><label class="f">Length<input type="number" id="e-len" min="8" max="64" value="20"></label><button class="btn alt" id="e-gen" style="margin-top:18px;min-height:44px">🎲 Generate</button></div>
      <label class="f">Website<input type="text" id="e-w" maxlength="200" autocomplete="off" autocapitalize="off" value="${esc(e.url)}"></label>
      <label class="f">Notes<textarea id="e-n" rows="3" maxlength="2000">${esc(e.notes)}</textarea></label>
      <div class="status" id="e-err"></div>
      <div class="row"><button class="btn alt" id="e-c">Cancel</button><button class="btn" id="e-s">Save</button></div>
      ${cur ? '<button class="btn danger" id="e-d" style="min-height:44px">Delete entry</button>' : ''}`);
    wireEyes(d);
    const pi = $('#e-p', d), meter = () => paintMeter($('#e-m', d), assess(pi.value));
    pi.addEventListener('input', meter); meter();
    $('#e-gen', d).onclick = () => { pi.value = genPassword(Math.min(64, Math.max(8, Number($('#e-len', d).value) || 20))); pi.type = 'text'; meter(); };
    $('#e-c', d).onclick = () => d.close();
    $('#e-s', d).onclick = async () => {
      const t = $('#e-t', d).value.trim();
      if (!t) { $('#e-err', d).textContent = 'Give the entry a title.'; return; }
      Object.assign(e, { title: t, user: $('#e-u', d).value.trim(), pass: pi.value, url: $('#e-w', d).value.trim(), notes: $('#e-n', d).value, updated: Date.now() });
      if (!cur) items().push(e);
      try { await S.save(); } catch (x) { $('#e-err', d).textContent = 'Could not save.'; return; }
      d.close(); render();
    };
    const del = $('#e-d', d);
    if (del) del.onclick = async () => {
      if (!confirm('Delete this entry permanently?')) return;
      S.data.items = items().filter(x => x.id !== e.id);
      await S.save(); d.close(); render();
    };
  }

  $('#v-q', body).addEventListener('input', ev => { q = ev.target.value; render(); });
  $('#v-add', body).addEventListener('click', () => edit(null));
  $('#v-list', body).addEventListener('click', ev => {
    const b = ev.target.closest('button[data-a]');
    if (!b) return;
    const id = b.closest('[data-id]').dataset.id, e = items().find(x => x.id === id);
    if (!e) return;
    if (b.dataset.a === 'cu') copyText(e.user);
    else if (b.dataset.a === 'cp') copyText(e.pass, 30000);
    else if (b.dataset.a === 'sh') { if (!shown.delete(id)) shown.add(id); render(); }
    else edit(id);
  });
  render();
  return () => { dead = true; shown.clear(); };
}
Tools.register({
  id: 'vault', name: 'Password Vault', icon: '🗝️', cat: 'security',
  desc: 'Store logins in an encrypted vault protected by one master password, with a built-in generator and encrypted backups.',
  keys: ['passwords', 'logins', 'manager', 'credentials', 'encrypt'], needs: ['storage'],
  render(el) {
    return sealedShell(el, {
      name: 'vault', db: 'vault', icon: '🗝️', title: 'Password Vault',
      blurb: 'One master password protects all your logins. Entries are encrypted with AES-256 and never leave this phone.',
      init: () => ({ items: [] }), build: vaultBuild,
      backup: {
        merge(data, inc) {
          let n = 0;
          for (const e of (inc && inc.items) || []) {
            if (!e || typeof e.id !== 'string' || data.items.some(x => x.id === e.id)) continue;
            if (data.items.length >= proLimit('vault') && needPro('vault')) break;
            data.items.push({ id: e.id, title: String(e.title || '').slice(0, 80), user: String(e.user || '').slice(0, 160), pass: String(e.pass || '').slice(0, 256), url: String(e.url || '').slice(0, 200), notes: String(e.notes || '').slice(0, 2000), updated: Number(e.updated) || 0 });
            n++;
          }
          return n;
        }
      }
    });
  }
});

/* ================= Secret Notes ================= */
function notesBuild(body, S) {
  let q = '', dead = false;
  body.innerHTML = `<div class="row"><input type="search" id="n-q" placeholder="Search notes" aria-label="Search notes" maxlength="80"><button class="btn" id="n-add" style="flex:0 0 auto;min-height:46px">＋ New</button></div><div class="list" id="n-list"></div>`;
  const items = () => S.data.items;
  function render() {
    if (dead) return;
    const t = q.trim().toLowerCase();
    const rows = items().filter(n => !t || (n.title + ' ' + n.body).toLowerCase().includes(t)).sort((a, b) => (b.updated || 0) - (a.updated || 0));
    const list = $('#n-list', body);
    list.innerHTML = rows.length ? rows.map(n => `<button class="card sx-card" data-id="${esc(n.id)}" style="text-align:left;width:100%;gap:4px"><b class="sx-ell">${esc(n.title || 'Untitled')}</b><span class="muted sx-ell" style="font-size:13.5px">${esc((n.body || '').replace(/\s+/g, ' ').slice(0, 90)) || 'Empty note'}</span><small class="muted">${n.updated ? esc(new Date(n.updated).toLocaleString()) : ''}</small></button>`).join('')
      : `<div class="sx-empty">${items().length ? 'No notes match your search.' : 'No secret notes yet.<br>Tap New to write one.'}</div>`;
  }
  function edit(id) {
    const cur = id ? items().find(n => n.id === id) : null, n = cur || { id: hex(rnd(8)), title: '', body: '' };
    const d = dialog(S.root, `<h2>${cur ? 'Edit note' : 'New note'}</h2>
      <label class="f">Title<input type="text" id="o-t" maxlength="80" autocomplete="off" value="${esc(n.title)}"></label>
      <label class="f">Note<textarea id="o-b" rows="9" maxlength="20000">${esc(n.body)}</textarea></label>
      <div class="status" id="o-e"></div>
      <div class="row"><button class="btn alt" id="o-c">Cancel</button><button class="btn" id="o-s">Save</button></div>
      ${cur ? '<button class="btn danger" id="o-d" style="min-height:44px">Delete note</button>' : ''}`);
    $('#o-c', d).onclick = () => d.close();
    $('#o-s', d).onclick = async () => {
      Object.assign(n, { title: $('#o-t', d).value.trim(), body: $('#o-b', d).value, updated: Date.now() });
      if (!n.title && !n.body) { $('#o-e', d).textContent = 'Write something first.'; return; }
      if (!cur) items().push(n);
      try { await S.save(); } catch (e) { $('#o-e', d).textContent = 'Could not save.'; return; }
      d.close(); render();
    };
    const del = $('#o-d', d);
    if (del) del.onclick = async () => { if (!confirm('Delete this note permanently?')) return; S.data.items = items().filter(x => x.id !== n.id); await S.save(); d.close(); render(); };
  }
  $('#n-q', body).addEventListener('input', ev => { q = ev.target.value; render(); });
  $('#n-add', body).addEventListener('click', () => edit(null));
  $('#n-list', body).addEventListener('click', ev => { const b = ev.target.closest('[data-id]'); if (b) edit(b.dataset.id); });
  render();
  return () => { dead = true; };
}
Tools.register({
  id: 'secretnotes', name: 'Secret Notes', icon: '🤫', cat: 'security',
  desc: 'Write private notes that are encrypted with AES-256 behind their own password, with encrypted backups.',
  keys: ['notes', 'private', 'diary', 'journal', 'encrypted'], needs: ['storage'],
  render(el) {
    return sealedShell(el, {
      name: 'notes', db: 'secretnotes', icon: '🤫', title: 'Secret Notes',
      blurb: 'Private notes encrypted with AES-256 under a password only you know. Separate from your normal notes.',
      init: () => ({ items: [] }), build: notesBuild,
      backup: {
        merge(data, inc) {
          let n = 0;
          for (const e of (inc && inc.items) || []) {
            if (!e || typeof e.id !== 'string' || data.items.some(x => x.id === e.id)) continue;
            data.items.push({ id: e.id, title: String(e.title || '').slice(0, 80), body: String(e.body || '').slice(0, 20000), updated: Number(e.updated) || 0 });
            n++;
          }
          return n;
        }
      }
    });
  }
});

/* ================= 2FA Codes (TOTP) ================= */
function totpBuild(body, S) {
  let dead = false, tick = 0;
  const cache = new Map(); // id -> { step, code }
  body.innerHTML = `<div class="sx-note"><span>⏱️</span><span>Codes depend on your phone's clock. Turn on automatic date and time in Android settings if a site rejects a code.</span></div>
    <button class="btn" id="t-add" style="min-height:48px">＋ Add account</button><div class="list" id="t-list"></div>`;
  const items = () => S.data.items;
  const fmt = c => c.length === 6 ? c.slice(0, 3) + ' ' + c.slice(3) : c.length === 8 ? c.slice(0, 4) + ' ' + c.slice(4) : c;

  function layout() {
    const list = $('#t-list', body);
    list.innerHTML = items().length ? items().map(a => `<div class="card sx-card" data-id="${esc(a.id)}">
      <div style="display:flex;align-items:center;gap:12px"><div class="sx-ic">${esc((a.issuer || a.account || '?')[0].toUpperCase())}</div>
        <div style="flex:1"><b class="sx-ell">${esc(a.issuer || a.account)}</b><small class="muted sx-ell">${a.issuer ? esc(a.account) : ''}</small></div><button data-a="del" class="btn alt" style="min-height:44px" aria-label="Remove ${esc(a.issuer || a.account)}">✕</button></div>
      <button data-a="copy" style="all:unset;cursor:pointer;display:block;text-align:center;padding:6px 0"><div class="sx-code" data-code>------</div></button>
      <div class="progress"><i data-bar style="width:100%"></i></div><small class="muted center" data-sec></small></div>`).join('')
      : '<div class="sx-empty">No accounts yet.<br>Add one using the secret key (or otpauth link) that a website shows when you turn on two-step verification.</div>';
    cache.clear(); update();
  }
  async function update() {
    if (dead) return;
    const now = Date.now();
    for (const a of items()) {
      const card = $('[data-id="' + a.id + '"]', body);
      if (!card) continue;
      const step = Math.floor(now / 1000 / a.period), left = a.period - (Math.floor(now / 1000) % a.period);
      let c = cache.get(a.id);
      if (!c || c.step !== step) {
        try { c = { step, code: await totp(b32decode(a.secret), now, a) }; } catch (e) { c = { step, code: 'ERROR' }; }
        cache.set(a.id, c);
      }
      if (dead) return;
      $('[data-code]', card).textContent = fmt(c.code);
      $('[data-code]', card).style.color = left <= 5 ? 'var(--danger)' : '';
      $('[data-bar]', card).style.width = (left / a.period * 100) + '%';
      $('[data-sec]', card).textContent = 'Refreshes in ' + left + ' s · tap to copy';
    }
  }
  function add() {
    const d = dialog(S.root, `<h2>Add account</h2>
      <label class="f">Service<input type="text" id="a-i" maxlength="60" placeholder="Example: GitHub" autocomplete="off"></label>
      <label class="f">Account (optional)<input type="text" id="a-a" maxlength="100" placeholder="you@example.com" autocomplete="off" autocapitalize="off"></label>
      <label class="f">Secret key or otpauth:// link<input type="password" id="a-s" maxlength="400" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="JBSWY3DPEHPK3PXP"></label>
      <details><summary style="min-height:44px;display:flex;align-items:center">Advanced</summary>
        <div class="row"><label class="f">Digits<select id="a-d"><option>6</option><option>7</option><option>8</option></select></label><label class="f">Period (s)<input type="number" id="a-p" min="10" max="120" value="30"></label></div>
        <label class="f" style="margin-top:8px">Algorithm<select id="a-g"><option value="SHA-1">SHA-1 (default)</option><option value="SHA-256">SHA-256</option><option value="SHA-512">SHA-512</option></select></label></details>
      <div class="status" id="a-e"></div>
      <div class="row"><button class="btn alt" id="a-c">Cancel</button><button class="btn" id="a-s2">Add</button></div>`);
    $('#a-c', d).onclick = () => d.close();
    $('#a-s2', d).onclick = async () => {
      const err = $('#a-e', d);
      let acc = { issuer: $('#a-i', d).value.trim(), account: $('#a-a', d).value.trim(), secret: $('#a-s', d).value.trim(), algo: $('#a-g', d).value, digits: Number($('#a-d', d).value), period: Math.min(120, Math.max(10, Number($('#a-p', d).value) || 30)) };
      try {
        if (/^otpauth:/i.test(acc.secret)) { const p = parseOtpauth(acc.secret); acc = Object.assign(acc, p, { issuer: p.issuer || acc.issuer, account: p.account || acc.account }); }
        acc.secret = acc.secret.replace(/[\s-]+/g, '').toUpperCase();
        await totp(b32decode(acc.secret), Date.now(), acc); // must produce a code
      } catch (e) { err.textContent = 'That secret key does not look valid. It should use letters A to Z and digits 2 to 7.'; return; }
      if (!acc.issuer && !acc.account) { err.textContent = 'Give the account a name.'; return; }
      acc.id = hex(rnd(8)); items().push(acc);
      try { await S.save(); } catch (e) { err.textContent = 'Could not save.'; return; }
      $('#a-s', d).value = ''; d.close(); layout();
    };
  }
  $('#t-add', body).addEventListener('click', add);
  $('#t-list', body).addEventListener('click', async ev => {
    const b = ev.target.closest('button[data-a]');
    if (!b) return;
    const id = b.closest('[data-id]').dataset.id;
    if (b.dataset.a === 'copy') { const c = cache.get(id); if (c && c.code !== 'ERROR') copyText(c.code, 30000); }
    else if (b.dataset.a === 'del' && confirm('Remove this account? You will need its secret key to add it again, or you may be locked out of the service.')) { S.data.items = items().filter(x => x.id !== id); await S.save(); layout(); }
  });
  tick = setInterval(update, 500);
  layout();
  return () => { dead = true; clearInterval(tick); cache.clear(); };
}
Tools.register({
  id: 'totp', name: '2FA Codes', icon: '🔢', cat: 'security',
  desc: 'Generate two-step verification codes (TOTP, RFC 6238) offline, with secrets encrypted behind your own password.',
  keys: ['totp', 'authenticator', 'otp', 'two factor', '2fa', 'google authenticator'], needs: ['storage'],
  render(el) {
    return sealedShell(el, {
      name: 'totp', db: 'totp', icon: '🔢', title: '2FA Codes',
      blurb: 'Time-based one-time codes, calculated on this phone. The secret keys are encrypted with AES-256 under a password only you know.',
      init: () => ({ items: [] }), build: totpBuild,
      backup: {
        merge(data, inc) {
          let n = 0;
          for (const e of (inc && inc.items) || []) {
            if (!e || typeof e.id !== 'string' || typeof e.secret !== 'string' || data.items.some(x => x.id === e.id)) continue;
            try { b32decode(e.secret); } catch (x) { continue; }
            data.items.push({ id: e.id, issuer: String(e.issuer || '').slice(0, 60), account: String(e.account || '').slice(0, 100), secret: e.secret, algo: ['SHA-1', 'SHA-256', 'SHA-512'].includes(e.algo) ? e.algo : 'SHA-1', digits: [6, 7, 8].includes(e.digits) ? e.digits : 6, period: Math.min(120, Math.max(10, Number(e.period) || 30)) });
            n++;
          }
          return n;
        }
      }
    });
  }
});

/* ================= 3. Password Strength Checker ================= */
Tools.register({
  id: 'pwcheck', name: 'Password Check', icon: '🛡️', cat: 'security',
  desc: 'Estimate how strong a password is, how long it would take to crack, and how to improve it. Nothing leaves your phone.',
  keys: ['strength', 'entropy', 'crack', 'password strength', 'checker'], needs: [],
  render(el) {
    const box = mount(el);
    box.innerHTML = hero('🛡️', 'Password strength', 'Type a password to test it. It is analysed on this phone only and is never saved or sent anywhere.') +
      `<div class="card sx-card">${pwField('pc', 'Password to test', 'Type or paste here', 'off')}
        <div class="sx-meter" id="pc-m"><i></i></div>
        <div style="display:flex;justify-content:space-between;align-items:baseline"><b id="pc-l" style="font-size:20px">Empty</b><span class="muted" id="pc-e"></span></div></div>
      <div class="card sx-card" id="pc-t" hidden><h3>Estimated time to crack</h3><div id="pc-times"></div></div>
      <div class="card sx-card" id="pc-i" hidden><h3>Problems found</h3><div id="pc-il"></div></div>
      <div class="card sx-card"><h3>How to improve it</h3><div id="pc-s" class="muted" style="font-size:14px"></div></div>
      <div class="sx-note"><span>ℹ️</span><span>This is an estimate. It assumes the attacker knows common words and patterns but not your personal details. Real dictionary words are weaker than the number suggests, and a password reused on any site is only as safe as the weakest site.</span></div>`;
    wireEyes(box);
    const inp = $('#pc', box);
    const upd = () => {
      const a = assess(inp.value);
      paintMeter($('#pc-m', box), a);
      $('#pc-l', box).textContent = a.label; $('#pc-l', box).style.color = a.len ? METER[a.level] : '';
      $('#pc-e', box).textContent = a.len ? a.len + ' characters · about ' + Math.round(a.entropy) + ' bits' : '';
      $('#pc-t', box).hidden = !a.len; $('#pc-i', box).hidden = !a.issues.length;
      $('#pc-times', box).innerHTML = a.times.map(t => `<div class="sx-kv"><span>${esc(t.name)}</span><span>${esc(t.text)}</span></div>`).join('');
      $('#pc-il', box).innerHTML = a.issues.map(i => `<div style="font-size:14px">• ${esc(i)}</div>`).join('');
      $('#pc-s', box).innerHTML = a.len && a.level >= 4 ? 'Excellent. Store it in a password manager and use it for one account only.' : a.tips.map(t => `<div style="margin-bottom:6px">• ${esc(t)}</div>`).join('');
    };
    inp.addEventListener('input', upd); upd();
    return () => { inp.value = ''; };
  }
});

/* ================= 4. PIN & Passphrase Generator ================= */
Tools.register({
  id: 'pingen', name: 'PIN & Passphrase', icon: '🔏', cat: 'security',
  desc: 'Generate random PINs, memorable word passphrases and strong passwords using the secure random generator.',
  keys: ['generator', 'random', 'diceware', 'passphrase', 'pin', 'password generator'], needs: [],
  render(el) {
    const box = mount(el);
    const st = Object.assign({ mode: 'pin', pinLen: 6, easy: true, words: 5, sep: '-', cap: false, num: false, pwLen: 16, opt: { lower: true, upper: true, digit: true, symbol: true } }, Store.get('pingen.s', {}));
    st.mode = 'pin';
    box.innerHTML = `<div class="sx-seg" role="tablist"><button data-m="pin">PIN</button><button data-m="phrase">Passphrase</button><button data-m="pw">Password</button></div>
      <div class="card sx-card" id="g-opt"></div>
      <button class="btn" id="g-go" style="min-height:50px;font-size:17px">🎲 Generate</button>
      <div class="list" id="g-out"></div>
      <div class="status info" id="g-bits" style="text-align:center"></div>
      <div class="sx-note"><span>🔐</span><span>Made with your phone's cryptographic random generator. Nothing is stored or sent. Copied values clear from the clipboard after 30 s where Android allows it.</span></div>`;
    const range = (id, label, v, min, max) => `<label class="f">${label}: <b id="${id}-v" style="color:var(--text)">${v}</b><input type="range" id="${id}" min="${min}" max="${max}" value="${v}" style="width:100%;accent-color:var(--accent);min-height:36px"></label>`;
    const chk = (id, label, on) => `<label class="sx-t"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><span>${label}</span></label>`;
    function opts() {
      const o = $('#g-opt', box);
      if (st.mode === 'pin') o.innerHTML = range('pl', 'Length', st.pinLen, 4, 12) + chk('pe', 'Avoid easy PINs (0000, 1234)', st.easy);
      else if (st.mode === 'phrase') o.innerHTML = range('wc', 'Words', st.words, 3, 10) + `<label class="f">Separator<select id="ws"><option value="-">Hyphen -</option><option value=" ">Space</option><option value=".">Dot .</option><option value="_">Underscore _</option><option value="">None</option></select></label>` + chk('wcap', 'Capitalise words', st.cap) + chk('wnum', 'Add a number at the end', st.num);
      else o.innerHTML = range('xl', 'Length', st.pwLen, 8, 64) + chk('xa', 'Lowercase a-z', st.opt.lower) + chk('xb', 'Uppercase A-Z', st.opt.upper) + chk('xc', 'Digits 0-9', st.opt.digit) + chk('xd', 'Symbols !@#', st.opt.symbol);
      const ws = $('#ws', box); if (ws) ws.value = st.sep;
      $$('input[type=range]', o).forEach(r => r.addEventListener('input', () => { $('#' + r.id + '-v', o).textContent = r.value; }));
    }
    function read() {
      const v = id => { const e = $('#' + id, box); return e; };
      if (st.mode === 'pin') { st.pinLen = Number(v('pl').value); st.easy = v('pe').checked; }
      else if (st.mode === 'phrase') { st.words = Number(v('wc').value); st.sep = v('ws').value; st.cap = v('wcap').checked; st.num = v('wnum').checked; }
      else { st.pwLen = Number(v('xl').value); st.opt = { lower: v('xa').checked, upper: v('xb').checked, digit: v('xc').checked, symbol: v('xd').checked }; if (!Object.values(st.opt).some(Boolean)) st.opt.lower = true; }
    }
    function gen() {
      read();
      let vals, bits;
      if (st.mode === 'pin') { vals = Array.from({ length: 5 }, () => genPin(st.pinLen, st.easy)); bits = st.pinLen * Math.log2(10); }
      else if (st.mode === 'phrase') { vals = Array.from({ length: 4 }, () => genPassphrase(st.words, st.sep, st.cap, st.num)); bits = st.words * Math.log2(WORDS.length) + (st.num ? Math.log2(100) : 0); }
      else { vals = Array.from({ length: 4 }, () => genPassword(st.pwLen, st.opt)); bits = st.pwLen * Math.log2(Object.keys(SETS).filter(k => st.opt[k]).map(k => SETS[k]).join('').length || 26); }
      $('#g-out', box).innerHTML = vals.map(v => `<div class="item" style="gap:8px"><span class="grow sx-mono" style="font-size:${st.mode === 'pin' ? 22 : 15}px;font-weight:${st.mode === 'pin' ? 700 : 500};letter-spacing:${st.mode === 'pin' ? '.1em' : '0'}">${esc(v)}</span><button class="btn alt" data-v="${esc(v)}" style="min-height:44px">Copy</button></div>`).join('');
      $('#g-bits', box).textContent = 'About ' + Math.round(bits) + ' bits of randomness' + (st.mode === 'phrase' ? ' (word list of ' + WORDS.length + ')' : '');
      Store.set('pingen.s', { pinLen: st.pinLen, easy: st.easy, words: st.words, sep: st.sep, cap: st.cap, num: st.num, pwLen: st.pwLen, opt: st.opt });
    }
    $$('.sx-seg button', box).forEach(b => b.addEventListener('click', () => { const m = b.dataset.m; $$('.sx-seg button', box).forEach(x => x.classList.toggle('on', x.dataset.m === m)); st.mode = m; opts(); gen(); }));
    $('#g-go', box).addEventListener('click', gen);
    $('#g-opt', box).addEventListener('change', gen);
    $('#g-out', box).addEventListener('click', ev => { const b = ev.target.closest('button[data-v]'); if (b) copyText(b.dataset.v, 30000); });
    $$('.sx-seg button', box)[0].classList.add('on'); opts(); gen();
    return () => { box.innerHTML = ''; };
  }
});

/* ================= 5. Text Locker ================= */
Tools.register({
  id: 'textlock', name: 'Text Locker', icon: '✉️', cat: 'security',
  desc: 'Encrypt a message with a password into a text code you can send anywhere, and decrypt codes you receive.',
  keys: ['encrypt', 'decrypt', 'message', 'secret', 'aes', 'cipher', 'base64'], needs: [],
  render(el) {
    const box = mount(el);
    let mode = 'enc', busy = false;
    box.innerHTML = `<div class="sx-seg"><button data-m="enc" class="on">Lock a message</button><button data-m="dec">Unlock a message</button></div>
      <div class="card sx-card">
        <label class="f" id="tl-lab">Message<textarea id="tl-in" rows="6" maxlength="20000" placeholder="Type the secret message" spellcheck="false"></textarea></label>
        ${pwField('tl-pw', 'Password', 'Share it separately, never in the same chat', 'off')}
        <div class="sx-meter" id="tl-m"><i></i></div>
        <div class="status" id="tl-e" role="alert"></div>
        <button class="btn" id="tl-go" style="min-height:48px">🔒 Lock message</button>
      </div>
      <div class="card sx-card" id="tl-oc" hidden><h3 id="tl-ot">Result</h3>
        <textarea id="tl-out" rows="6" readonly spellcheck="false" class="sx-mono" style="font-size:13px"></textarea>
        <div class="row"><button class="btn alt" id="tl-cp" style="min-height:44px">Copy</button><button class="btn alt" id="tl-sh" style="min-height:44px">Share</button></div></div>
      <div class="sx-note"><span>ℹ️</span><span>Uses AES-256-GCM with a key made from your password (PBKDF2-SHA256, ${KDF_ITER.toLocaleString()} rounds). A wrong password or any change to the code makes unlocking fail. The recipient needs this app and the password. A weak password can still be guessed offline, so use a long one.</span></div>`;
    wireEyes(box);
    const pw = $('#tl-pw', box), inp = $('#tl-in', box), out = $('#tl-out', box), err = $('#tl-e', box);
    const setMode = m => {
      mode = m; $$('.sx-seg button', box).forEach(b => b.classList.toggle('on', b.dataset.m === m));
      $('#tl-lab', box).firstChild.textContent = m === 'enc' ? 'Message' : 'Locked code';
      inp.placeholder = m === 'enc' ? 'Type the secret message' : 'Paste the locked code here';
      $('#tl-go', box).textContent = m === 'enc' ? '🔒 Lock message' : '🔓 Unlock message';
      $('#tl-m', box).hidden = m !== 'enc'; $('#tl-oc', box).hidden = true; out.value = ''; err.textContent = '';
      $('#tl-ot', box).textContent = m === 'enc' ? 'Locked code' : 'Decrypted message';
    };
    $$('.sx-seg button', box).forEach(b => b.addEventListener('click', () => setMode(b.dataset.m)));
    pw.addEventListener('input', () => paintMeter($('#tl-m', box), assess(pw.value)));
    $('#tl-go', box).addEventListener('click', async () => {
      if (busy) return;
      err.textContent = '';
      if (!inp.value.trim()) { err.textContent = mode === 'enc' ? 'Type a message first.' : 'Paste a locked code first.'; return; }
      if (mode === 'enc' && pw.value.length < 8) { err.textContent = 'Use a password of at least 8 characters.'; return; }
      if (!pw.value) { err.textContent = 'Enter the password.'; return; }
      busy = true; const b = $('#tl-go', box), label = b.textContent; b.disabled = true; b.textContent = 'Working…';
      try {
        out.value = mode === 'enc' ? await encryptText(inp.value, pw.value) : await decryptText(inp.value, pw.value);
        $('#tl-oc', box).hidden = false;
      } catch (e) {
        $('#tl-oc', box).hidden = true; out.value = '';
        err.textContent = mode === 'dec' ? (/not a PocketKit/.test(e.message) ? 'That is not a valid locked code.' : 'Wrong password, or the code was changed.') : 'Could not lock the message.';
      } finally { busy = false; b.disabled = false; b.textContent = label; }
    });
    $('#tl-cp', box).addEventListener('click', () => copyText(out.value, mode === 'dec' ? 30000 : 0));
    $('#tl-sh', box).addEventListener('click', () => shareText(out.value));
    return () => { pw.value = ''; inp.value = ''; out.value = ''; };
  }
});

/* ================= 6. Checksum Verifier ================= */
Tools.register({
  id: 'checksum', name: 'Checksum', icon: '🧾', cat: 'security',
  desc: 'Compute the SHA-256, SHA-512, SHA-384 or SHA-1 hash of any file and compare it with a hash you paste.',
  keys: ['hash', 'sha256', 'sha512', 'verify', 'integrity', 'download', 'apk'], needs: ['storage'],
  render(el) {
    const box = mount(el);
    let file = null, token = 0;
    box.innerHTML = hero('🧾', 'Verify a file', 'Check that a download is exactly what the publisher released. The file is hashed on this phone and never uploaded.') +
      `<div class="card sx-card">
        <button class="btn alt" id="ck-pick" style="min-height:48px">📂 Choose a file</button><input type="file" id="ck-in" hidden>
        <div id="ck-file" class="muted" style="font-size:14px">No file chosen</div>
        <label class="f">Algorithm<select id="ck-alg"><option value="SHA-256">SHA-256</option><option value="SHA-512">SHA-512</option><option value="SHA-384">SHA-384</option><option value="SHA-1">SHA-1 (legacy)</option></select></label>
        <label class="f">Expected hash (optional)<textarea id="ck-exp" rows="2" maxlength="300" class="sx-mono" autocapitalize="off" spellcheck="false" placeholder="Paste the hash published by the source"></textarea></label>
        <button class="btn" id="ck-go" style="min-height:48px" disabled>Calculate</button>
        <div class="status info" id="ck-st" role="status"></div></div>
      <div class="card sx-card" id="ck-res" hidden><div id="ck-verdict" class="center" style="font-size:20px;font-weight:700"></div>
        <div class="sx-lbl">Calculated hash</div><div class="sx-mono" id="ck-hash" style="font-size:13px"></div>
        <button class="btn alt" id="ck-cp" style="min-height:44px">Copy hash</button></div>
      <div class="sx-note"><span>ℹ️</span><span>The phone's crypto engine hashes a whole file at once, so very large files (over about 500 MB) may fail on low-memory phones. Prefer SHA-256 or SHA-512; SHA-1 is only for old checklists.</span></div>`;
    const st = t => { $('#ck-st', box).textContent = t; };
    const norm = s => s.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
    $('#ck-pick', box).addEventListener('click', () => $('#ck-in', box).click());
    $('#ck-in', box).addEventListener('change', ev => {
      file = ev.target.files && ev.target.files[0] || null; token++;
      $('#ck-file', box).textContent = file ? file.name + ' · ' + fmtSize(file.size) : 'No file chosen';
      $('#ck-go', box).disabled = !file; $('#ck-res', box).hidden = true; st('');
      if (file && file.size > 500 * 1048576) st('This file is large. Hashing may be slow or fail on this phone.');
    });
    $('#ck-exp', box).addEventListener('input', ev => {
      const n = norm(ev.target.value).length, a = { 40: 'SHA-1', 64: 'SHA-256', 96: 'SHA-384', 128: 'SHA-512' }[n];
      if (a) $('#ck-alg', box).value = a;
    });
    $('#ck-go', box).addEventListener('click', async () => {
      if (!file) return;
      const my = ++token, b = $('#ck-go', box);
      b.disabled = true; st('Calculating…'); $('#ck-res', box).hidden = true;
      try {
        const buf = await file.arrayBuffer();
        const dig = hex(new Uint8Array(await SC.subtle.digest($('#ck-alg', box).value, buf)));
        if (my !== token) return;
        $('#ck-hash', box).textContent = dig;
        const exp = norm($('#ck-exp', box).value), v = $('#ck-verdict', box);
        if (!exp) { v.textContent = 'Hash calculated'; v.style.color = ''; }
        else if (exp === dig) { v.textContent = '✅ Match. The file is intact.'; v.style.color = 'var(--ok)'; }
        else { v.textContent = '❌ No match. Do not trust this file.'; v.style.color = 'var(--danger)'; }
        $('#ck-res', box).hidden = false; st('');
      } catch (e) { if (my === token) st('Could not read or hash this file (it may be too large).'); }
      finally { if (my === token) b.disabled = !file; }
    });
    $('#ck-cp', box).addEventListener('click', () => copyText($('#ck-hash', box).textContent));
    return () => { token++; file = null; };
  }
});

/* ================= 7. Privacy Checklist ================= */
const PRIVACY = [
  ['Lock down your phone', [
    ['Use a screen lock of 6+ digits or a password', 'A 4-digit PIN is guessed quickly. Longer is better.'],
    ['Turn on biometric unlock as a convenience, not the only lock', 'Know how to disable it fast (lockdown mode).'],
    ['Hide sensitive notifications on the lock screen', 'Settings > Notifications > Lock screen.'],
    ['Set the screen to lock after 30 seconds', 'A short timeout limits snooping.'],
    ['Install system and security updates promptly', 'Most attacks use bugs that are already fixed.']]],
  ['Accounts and passwords', [
    ['Use a unique password for every important account', 'A password manager makes this easy.'],
    ['Turn on two-step verification for email, banking and social accounts', 'Prefer an authenticator app over SMS codes.'],
    ['Secure your email account first', 'Whoever controls email can reset everything else.'],
    ['Save account recovery codes somewhere offline', 'Print them or store them in an encrypted vault.'],
    ['Review which apps have access to your Google account', 'Remove ones you no longer use.']]],
  ['Apps and permissions', [
    ['Review app permissions: camera, microphone, location, contacts', 'Settings > Privacy > Permission manager.'],
    ['Set location to "only while using the app" wherever possible', 'Deny "all the time" unless it is essential.'],
    ['Delete apps you no longer use', 'Fewer apps means fewer places your data can leak.'],
    ['Install apps only from the official store', 'Avoid APK files from random websites.'],
    ['Turn off ad personalisation and reset your advertising ID', 'Settings > Privacy > Ads.']]],
  ['Network and browsing', [
    ['Do not join unknown open Wi-Fi without a VPN', 'Public networks can be watched or spoofed.'],
    ['Turn off Wi-Fi and Bluetooth auto-connect for unknown networks', 'Stops silent connections.'],
    ['Check that sites show a padlock (HTTPS) before signing in', 'Never enter passwords on a plain http page.'],
    ['Be cautious with links in messages and emails', 'If it creates urgency or asks for a code, stop and check.'],
    ['Never share one-time codes (OTP) with anyone', 'Real banks and services never ask for them.']]],
  ['Data and backups', [
    ['Back up photos and files to a place you control', 'Keep an encrypted copy of anything important.'],
    ['Turn on Find My Device', 'You can locate, lock or erase a lost phone.'],
    ['Encrypt sensitive files before sharing or storing them', 'Use File Locker or Text Locker in this app.'],
    ['Strip location data from photos before sharing publicly', 'Photos can reveal where they were taken.'],
    ['Erase the phone before selling or recycling it', 'Back up first, then do a factory reset.']]]
];
Tools.register({
  id: 'privacy', name: 'Privacy Checklist', icon: '🧰', cat: 'security',
  desc: 'An interactive checklist of phone privacy and security habits with a progress score, saved on your phone.',
  keys: ['checklist', 'tips', 'safety', 'audit', 'hardening'], needs: ['storage'],
  render(el) {
    const box = mount(el);
    let done = new Set(Store.get('privacy.done', []));
    const total = PRIVACY.reduce((s, g) => s + g[1].length, 0);
    function paint() {
      const n = [...done].filter(i => PRIVACY.some((g, gi) => g[1].some((_, ti) => gi + '.' + ti === i))).length, pct = Math.round(n / total * 100);
      $('#pv-n', box).textContent = n + ' of ' + total + ' done';
      $('#pv-p', box).textContent = pct + '%';
      $('#pv-b', box).style.width = pct + '%';
      $('#pv-m', box).textContent = pct === 100 ? 'Excellent. Your phone habits are in great shape.' : pct >= 60 ? 'Good progress. A few more to go.' : pct > 0 ? 'A solid start. Small steps add up.' : 'Tick each item as you finish it.';
    }
    box.innerHTML = `<div class="card sx-card"><div style="display:flex;align-items:baseline;justify-content:space-between"><b style="font-size:17px" id="pv-n"></b><b style="font-size:28px;color:var(--accent)" id="pv-p"></b></div>
        <div class="progress"><i id="pv-b"></i></div><div class="muted" style="font-size:13.5px" id="pv-m"></div></div>` +
      PRIVACY.map((g, gi) => `<div class="card sx-card"><h3>${esc(g[0])}</h3>${g[1].map((t, ti) => { const id = gi + '.' + ti; return `<label class="sx-t" style="align-items:flex-start;padding:4px 0"><input type="checkbox" data-id="${id}" ${done.has(id) ? 'checked' : ''}><span><span style="font-weight:600">${esc(t[0])}</span><br><span class="muted" style="font-size:13px">${esc(t[1])}</span></span></label>`; }).join('')}</div>`).join('') +
      '<button class="btn alt" id="pv-r" style="min-height:48px">Reset checklist</button>';
    box.addEventListener('change', ev => {
      const c = ev.target.closest('input[data-id]');
      if (!c) return;
      if (c.checked) done.add(c.dataset.id); else done.delete(c.dataset.id);
      Store.set('privacy.done', [...done]); paint();
    });
    $('#pv-r', box).addEventListener('click', () => {
      if (!confirm('Clear all ticks?')) return;
      done = new Set(); Store.set('privacy.done', []); $$('input[data-id]', box).forEach(c => { c.checked = false; }); paint();
    });
    paint();
  }
});

/* ================= Emergency Info Card ================= */
Tools.register({
  id: 'emergency', name: 'Emergency Card', icon: '🚑', cat: 'security',
  desc: 'Keep your blood group, allergies, medicines and emergency contacts in a big, easy-to-read card for first responders.',
  keys: ['ice', 'medical', 'blood', 'allergy', 'contact', 'first aid', 'in case of emergency'], needs: ['storage'],
  render(el) {
    const box = mount(el);
    const F = [['name', 'Full name'], ['dob', 'Date of birth'], ['blood', 'Blood group'], ['allergies', 'Allergies'], ['conditions', 'Medical conditions'], ['meds', 'Medicines'], ['donor', 'Organ donor'], ['c1n', 'Contact 1 name'], ['c1p', 'Contact 1 phone'], ['c2n', 'Contact 2 name'], ['c2p', 'Contact 2 phone'], ['notes', 'Other notes']];
    let card = Store.get('emergency.card', null), editing = !card;
    const tel = p => String(p || '').replace(/[^0-9+]/g, '');
    function view() {
      const c = card, row = (k, v) => v ? `<div class="sx-kv" style="font-size:16px"><span>${esc(k)}</span><span>${esc(v)}</span></div>` : '';
      const contact = (n, p) => p ? `<a class="btn linkbtn" href="tel:${esc(tel(p))}" style="min-height:52px;display:flex;align-items:center;justify-content:center;font-size:17px">📞 Call ${esc(n || p)}</a>` : '';
      box.innerHTML = `<div class="card sx-card" style="border:2px solid var(--danger)">
          <div style="display:flex;align-items:center;gap:12px"><div class="sx-badge" style="width:56px;height:56px;font-size:28px;background:var(--danger)">🚑</div><div><div class="muted" style="font-size:12px;font-weight:700;letter-spacing:.08em">EMERGENCY INFORMATION</div><b style="font-size:24px;line-height:1.15">${esc(c.name || 'Name not set')}</b></div></div>
          ${c.blood ? `<div class="center" style="padding:10px;border-radius:14px;background:color-mix(in srgb,var(--danger) 12%,var(--surface))"><div class="muted" style="font-size:12px">BLOOD GROUP</div><div style="font-size:44px;font-weight:800;color:var(--danger);line-height:1.1">${esc(c.blood)}</div></div>` : ''}
          ${row('Allergies', c.allergies)}${row('Conditions', c.conditions)}${row('Medicines', c.meds)}${row('Date of birth', c.dob)}${row('Organ donor', c.donor)}${row('Notes', c.notes)}
          ${contact(c.c1n, c.c1p)}${contact(c.c2n, c.c2p)}</div>
        <button class="btn alt" id="em-ed" style="min-height:48px">✏️ Edit card</button>
        <div class="sx-note"><span>💡</span><span>This card is stored on this phone and is not encrypted, so keep it free of anything you would not want a stranger to read. To show it on the lock screen, also fill in Android's own emergency information: Settings > About phone > Emergency information.</span></div>`;
      $('#em-ed', box).addEventListener('click', () => { editing = true; edit(); });
    }
    function edit() {
      const c = card || {};
      box.innerHTML = hero('🚑', 'Emergency card', 'Fill in what a paramedic would need. Leave blank anything you prefer not to show.') +
        `<div class="card sx-card">${F.map(([k, l]) => k === 'blood'
          ? `<label class="f">${l}<select id="em-${k}"><option value=""></option>${['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(b => `<option${c[k] === b ? ' selected' : ''}>${b}</option>`).join('')}</select></label>`
          : k === 'donor' ? `<label class="f">${l}<select id="em-${k}"><option value=""></option><option${c[k] === 'Yes' ? ' selected' : ''}>Yes</option><option${c[k] === 'No' ? ' selected' : ''}>No</option></select></label>`
          : /allergies|conditions|meds|notes/.test(k) ? `<label class="f">${l}<textarea id="em-${k}" rows="2" maxlength="400">${esc(c[k] || '')}</textarea></label>`
          : `<label class="f">${l}<input type="${/p$/.test(k) && k !== 'dob' ? 'tel' : 'text'}" id="em-${k}" maxlength="80" autocomplete="off" value="${esc(c[k] || '')}"></label>`).join('')}
          <button class="btn" id="em-save" style="min-height:48px">Save card</button>${card ? '<button class="btn alt" id="em-cancel" style="min-height:44px">Cancel</button>' : ''}</div>`;
      $('#em-save', box).addEventListener('click', () => {
        const n = {};
        F.forEach(([k]) => { n[k] = $('#em-' + k, box).value.trim(); });
        card = n; Store.set('emergency.card', n); editing = false; view(); toast('Saved');
      });
      const cn = $('#em-cancel', box); if (cn) cn.addEventListener('click', () => { editing = false; view(); });
    }
    editing ? edit() : view();
  }
});

})();
