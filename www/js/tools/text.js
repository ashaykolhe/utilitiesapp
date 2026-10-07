'use strict';
/* Text & data tools. Pure logic lives in TX (tested in Node); the Tools.register calls below build the UI.
   Everything is wrapped in a function so no names leak into the other tool scripts. */
(function () {
const TX = {};
const enc = new TextEncoder(), dec = new TextDecoder('utf-8', { fatal: true });
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
function secureInt(n) {
  const max = Math.floor(4294967296 / n) * n, a = new Uint32Array(1);
  do { crypto.getRandomValues(a); } while (a[0] >= max);
  return a[0] % n;
}
TX.shuffle = (arr, rnd = secureInt) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/* ---------- Morse ---------- */
const MORSE = {};
const MORSE_SRC = [
  'A .-', 'B -...', 'C -.-.', 'D -..', 'E .', 'F ..-.', 'G --.', 'H ....', 'I ..', 'J .---', 'K -.-', 'L .-..', 'M --', 'N -.', 'O ---', 'P .--.', 'Q --.-', 'R .-.', 'S ...', 'T -', 'U ..-', 'V ...-', 'W .--', 'X -..-', 'Y -.--', 'Z --..',
  '0 -----', '1 .----', '2 ..---', '3 ...--', '4 ....-', '5 .....', '6 -....', '7 --...', '8 ---..', '9 ----.',
  '. .-.-.-', ', --..--', '? ..--..', "' .----.", '! -.-.--', '/ -..-.', '( -.--.', ') -.--.-', '& .-...', ': ---...', '; -.-.-.', '= -...-', '+ .-.-.', '- -....-', '_ ..--.-', '" .-..-.', '$ ...-..-', '@ .--.-.'
];
MORSE_SRC.forEach(p => { MORSE[p[0]] = p.slice(2); });
const MORSE_REV = {}; Object.keys(MORSE).forEach(k => { MORSE_REV[MORSE[k]] = k; });
TX.morseEnc = (t) => t.toUpperCase().split(/\s+/).map(w => [...w].map(c => MORSE[c]).filter(Boolean).join(' ')).filter(Boolean).join(' / ');
TX.morseDec = (m) => m.replace(/[·•]/g, '.').replace(/[−–—]/g, '-').trim().split(/\s+/).filter(Boolean)
  .map(t => (t === '/' || t === '|') ? ' ' : (MORSE_REV[t] || '?')).join('').replace(/ +/g, ' ').trim();
/* Alternating on(+) / off(-) durations in ms; unit = one dot. Letter gap 3, word gap 7. */
TX.morseTimeline = (m, unit) => {
  const ev = []; let gap = 0;
  m.trim().split(/\s+/).filter(Boolean).forEach(tok => {
    if (tok === '/' || tok === '|') { gap = 7; return; }
    if (ev.length) ev.push(-(gap || 3) * unit);
    gap = 0;
    [...tok].forEach((s, j) => { if (j) ev.push(-unit); ev.push((s === '-' ? 3 : 1) * unit); });
  });
  return ev;
};

/* Android truncates long vibration patterns (about 99 entries), so a pattern is cut into chunks that each start with an "on" entry and are re-issued one after another. */
TX.vibChunks = (ev, size = 98) => {
  const abs = ev.map(Math.abs), out = [];
  size -= size % 2; // an even length keeps every chunk starting with "on"
  for (let i = 0; i < abs.length; i += size) out.push(abs.slice(i, i + size));
  return out;
};

/* ---------- Barcodes ---------- */
const C128 = '212222,222122,222221,121223,121322,131222,122213,122312,132212,221213,221312,231212,112232,122132,122231,113222,123122,123221,223211,221132,221231,213212,223112,312131,311222,321122,321221,312212,322112,322211,212123,212321,232121,111323,131123,131321,112313,132113,132311,211313,231113,231311,112133,112331,132131,113123,113321,133121,313121,211331,231131,213113,213311,213131,311123,311321,331121,312113,312311,332111,314111,221411,431111,111224,111422,121124,121421,141122,141221,112214,112412,122114,122411,142112,142211,241211,221114,413111,241112,134111,111242,121142,121241,114212,124112,124211,411212,421112,421211,212141,214121,412121,111143,111341,131141,114113,114311,411113,411311,113141,114131,311141,411131,211412,211214,211232,2331112'.split(',');
TX.C128 = C128;
/* Returns { values, bits } or null if the text has characters outside ASCII 32-126. Uses subset C when the text is an even run of 4+ digits, else subset B. */
TX.code128 = (text) => {
  if (!text || /[^\x20-\x7e]/.test(text)) return null;
  const vals = [];
  if (/^\d{4,}$/.test(text) && text.length % 2 === 0) {
    vals.push(105); for (let i = 0; i < text.length; i += 2) vals.push(+text.substr(i, 2));
  } else { vals.push(104); for (const c of text) vals.push(c.charCodeAt(0) - 32); }
  let sum = vals[0]; for (let i = 1; i < vals.length; i++) sum += vals[i] * i;
  vals.push(sum % 103, 106);
  const bits = []; vals.forEach(v => { [...C128[v]].forEach((w, k) => { for (let j = 0; j < +w; j++) bits.push(k % 2 === 0 ? 1 : 0); }); });
  return { values: vals, bits };
};
const EL = '0001101,0011001,0010011,0111101,0100011,0110001,0101111,0111011,0110111,0001011'.split(',');
const EPAR = 'LLLLLL,LLGLGG,LLGGLG,LLGGGL,LGLLGG,LGGLLG,LGGGLL,LGLGLG,LGLGGL,LGGLGL'.split(',');
const inv = (s) => [...s].map(b => b === '1' ? '0' : '1').join('');
TX.eanCheck = (d12) => { let s = 0; for (let i = 0; i < 12; i++) s += +d12[i] * (i % 2 ? 3 : 1); return (10 - s % 10) % 10; };
/* Accepts 12 digits (check digit added) or 13 (validated). Returns { digits, bits } or { error }. */
TX.ean13 = (t) => {
  t = (t || '').replace(/\s/g, '');
  if (!/^\d{12,13}$/.test(t)) return { error: 'Enter 12 or 13 digits.' };
  const c = TX.eanCheck(t);
  if (t.length === 13 && +t[12] !== c) return { error: 'Check digit should be ' + c + '.' };
  const d = t.slice(0, 12) + c, par = EPAR[+d[0]];
  let s = '101';
  for (let i = 1; i <= 6; i++) { const L = EL[+d[i]]; s += par[i - 1] === 'L' ? L : [...inv(L)].reverse().join(''); }
  s += '01010';
  for (let i = 7; i <= 12; i++) s += inv(EL[+d[i]]);
  s += '101';
  return { digits: d, bits: [...s].map(Number) };
};
const wesc = (s) => s.replace(/([\\;,:"])/g, '\\$1');
TX.wifiString = (ssid, pass, sec, hidden) => 'WIFI:T:' + sec + ';S:' + wesc(ssid) + ';' + (sec === 'nopass' ? '' : 'P:' + wesc(pass) + ';') + (hidden ? 'H:true;' : '') + ';';

/* ---------- Text helpers ---------- */
TX.countWords = (s) => (s.match(/\S+/g) || []).length;
TX.countSentences = (s) => (s.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) || []).filter(x => /\S/.test(x)).length;
TX.countParas = (s) => s.split(/\n\s*\n/).filter(x => x.trim()).length;
// first letter in title case: German sharp s becomes "Ss" (not "SS")
const initial = (b) => { const u = b.toUpperCase(); return u.length > 1 ? u[0] + u.slice(1).toLowerCase() : u; };
TX.lower = (s) => s.toLowerCase().replace(/i\u0307/g, 'i'); // "İ".toLowerCase() is "i" + a combining dot, which would not match a plain i
TX.titleCase = (s) => TX.lower(s).replace(/(^|[\s\-(\/])(\p{L})/gu, (m, a, b) => a + initial(b)).normalize('NFC');
TX.sentenceCase = (s) => TX.lower(s).replace(/(^\s*|[.!?]\s+|\n\s*)(\p{L})/gu, (m, a, b) => a + initial(b)).normalize('NFC');
TX.squeeze = (s) => s.replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
TX.dedupeLines = (s) => { const seen = new Set(); return s.split('\n').filter(l => !seen.has(l) && seen.add(l)).join('\n'); };
TX.sortLines = (s, desc) => { const a = s.split('\n').sort((x, y) => x.localeCompare(y, undefined, { numeric: true, sensitivity: 'base' })); return (desc ? a.reverse() : a).join('\n'); };
TX.dropEmpty = (s) => s.split('\n').filter(l => l.trim()).join('\n');
TX.reverseText = (s) => [...s].reverse().join('');
TX.words = (s) => s.normalize('NFC').replace(/['’]/g, '').replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, '$1 $2').replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, '$1 $2').match(/[\p{L}\p{N}\p{M}]+/gu) || [];
const cap = (w) => { const l = TX.lower(w), f = [...l][0] || ''; return initial(f) + l.slice(f.length); };
const perLine = (f) => (s) => s.split('\n').map(l => f(TX.words(l), l)).join('\n');
// Only Latin-style combining accents are stripped (U+0300-036F); Indic and other scripts keep their vowel signs.
TX.slug = perLine((w, l) => TX.words(l.normalize('NFD').replace(/[\u0300-\u036f]/g, '')).map(x => x.toLowerCase()).join('-'));
TX.camel = perLine(w => w.map((x, i) => i ? cap(x) : TX.lower(x)).join(''));
TX.pascal = perLine(w => w.map(cap).join(''));
TX.snake = perLine(w => w.map(TX.lower).join('_'));
TX.kebab = perLine(w => w.map(TX.lower).join('-'));
TX.constant = perLine(w => w.map(x => x.toUpperCase()).join('_'));
TX.dotcase = perLine(w => w.map(TX.lower).join('.'));
TX.wordFreq = (s, opt = {}) => {
  const stop = new Set(opt.stop ? 'a an and are as at be but by for from has have he her his i in is it its of on or she that the their they this to was we were will with you your not so if do my me our us them then than there what when which who'.split(' ') : []);
  const m = new Map();
  (s.toLowerCase().normalize('NFC').replace(/’/g, "'").match(/[\p{L}\p{N}\p{M}']+/gu) || []).forEach(w => { w = w.replace(/^'+|'+$/g, ''); if (w.length >= (opt.min || 1) && !stop.has(w)) m.set(w, (m.get(w) || 0) + 1); });
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
};
TX.readTime = (words, wpm) => { const sec = Math.round(words / wpm * 60); return { sec, text: sec < 1 && words > 0 ? 'under 1 sec' : sec < 60 ? sec + ' sec' : Math.floor(sec / 60) + ' min ' + (sec % 60) + ' sec' }; };

/* ---------- Base64 / URL ---------- */
TX.b64enc = (s, urlSafe) => {
  let bin = ''; enc.encode(s).forEach(b => { bin += String.fromCharCode(b); });
  let r = btoa(bin); if (urlSafe) r = r.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return r;
};
TX.b64dec = (s) => {
  s = s.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s) || s.length % 4 === 1) throw new Error('Not valid Base64.');
  while (s.length % 4) s += '=';
  const bin = atob(s), b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  try { return dec.decode(b); } catch (e) { throw new Error('Decoded bytes are not valid UTF-8 text.'); }
};
TX.urlenc = (s) => encodeURIComponent(s);
TX.urldec = (s) => { try { return decodeURIComponent(s.replace(/\+/g, ' ')); } catch (e) { throw new Error('Not a valid URL-encoded string.'); } };

/* ---------- Bytes (binary / hex / decimal) ---------- */
const BASES = { 2: { w: 8, re: /^[01]+$/ }, 16: { w: 2, re: /^[0-9a-f]+$/i }, 10: { w: 0, re: /^\d+$/ }, 8: { w: 3, re: /^[0-7]+$/ } };
TX.toBytesStr = (s, base) => [...enc.encode(s)].map(b => b.toString(base).toUpperCase().padStart(BASES[base].w, '0')).join(' ');
TX.fromBytesStr = (s, base) => {
  const B = BASES[base]; let toks = s.trim().split(/[\s,]+/).filter(Boolean);
  if (base === 16) toks = toks.map(t => t.replace(/^0x/i, ''));
  if (toks.length === 1 && B.w && toks[0].length > B.w && toks[0].length % B.w === 0) toks = toks[0].match(new RegExp('.{' + B.w + '}', 'g'));
  if (!toks.length) return '';
  const bytes = toks.map(t => { if (!B.re.test(t)) throw new Error('"' + t + '" is not a base-' + base + ' number.'); const v = parseInt(t, base); if (v > 255) throw new Error(t + ' is bigger than one byte.'); return v; });
  try { return dec.decode(Uint8Array.from(bytes)); } catch (e) { throw new Error('Those bytes are not valid UTF-8 text.'); }
};

/* ---------- Password ---------- */
const PW = { upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', lower: 'abcdefghijklmnopqrstuvwxyz', digits: '0123456789', symbols: '!@#$%^&*()-_=+[]{};:,.<>?/~' };
TX.pwPool = (o) => ['upper', 'lower', 'digits', 'symbols'].filter(k => o[k]).map(k => o.noAmb ? PW[k].replace(/[Il1O0o]/g, '') : PW[k]);
TX.genPassword = (len, o, rnd = secureInt) => {
  const sets = TX.pwPool(o); if (!sets.length) return '';
  len = clamp(Math.round(len) || 0, 4, 64);
  const pool = sets.join(''), out = [];
  sets.forEach(s => { if (out.length < len) out.push(s[rnd(s.length)]); });
  while (out.length < len) out.push(pool[rnd(pool.length)]);
  return TX.shuffle(out, rnd).join('');
};
TX.pwStrength = (len, o) => {
  const n = TX.pwPool(o).join('').length, bits = n ? len * Math.log2(n) : 0;
  const lvl = bits < 40 ? 0 : bits < 60 ? 1 : bits < 80 ? 2 : bits < 110 ? 3 : 4;
  return { bits: Math.round(bits), lvl, label: ['Very weak', 'Weak', 'Fair', 'Strong', 'Excellent'][lvl] };
};

/* ---------- Roman numerals ---------- */
const RV = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
TX.toRoman = (n) => { if (!Number.isInteger(n) || n < 1 || n > 3999) return null; let r = ''; RV.forEach(([v, s]) => { while (n >= v) { r += s; n -= v; } }); return r; };
TX.fromRoman = (s) => {
  s = s.trim().toUpperCase();
  if (!s || !/^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/.test(s)) return null;
  let n = 0; RV.forEach(([v, r]) => { while (s.startsWith(r)) { n += v; s = s.slice(r.length); } }); return n;
};

/* ---------- Number bases ---------- */
const DIG = '0123456789abcdefghijklmnopqrstuvwxyz';
TX.parseBig = (s, b) => {
  s = s.trim().toLowerCase().replace(/[\s_,]/g, ''); let neg = false;
  if (s[0] === '-') { neg = true; s = s.slice(1); } else if (s[0] === '+') s = s.slice(1);
  if ((b === 16 && s.startsWith('0x')) || (b === 2 && s.startsWith('0b')) || (b === 8 && s.startsWith('0o'))) s = s.slice(2);
  if (!s) return null;
  let v = 0n; const B = BigInt(b);
  for (const ch of s) { const d = DIG.indexOf(ch); if (d < 0 || d >= b) return null; v = v * B + BigInt(d); }
  return neg ? -v : v;
};
TX.toBase = (v, b) => v.toString(b).toUpperCase();

/* ---------- JSON ---------- */
TX.jsonCheck = (s) => {
  let i = 0; const n = s.length;
  const fail = (msg, p = i) => { throw { pos: p, msg }; };
  const ws = () => { while (i < n && (s[i] === ' ' || s[i] === '\t' || s[i] === '\n' || s[i] === '\r')) i++; };
  const str = () => {
    i++;
    for (;;) {
      if (i >= n) fail('Unterminated string');
      const c = s[i];
      if (c === '"') { i++; return; }
      if (c < ' ') fail('Control character in string (use \\n)');
      if (c === '\\') {
        i++; const e = s[i];
        if (e !== undefined && '"\\/bfnrt'.includes(e)) i++;
        else if (e === 'u') { if (!/^[0-9a-fA-F]{4}$/.test(s.substr(i + 1, 4))) fail('Bad \\u escape'); i += 5; }
        else fail('Bad escape');
      } else i++;
    }
  };
  const num = () => { const re = /-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/y; re.lastIndex = i; const m = re.exec(s); if (!m) fail('Invalid number'); i += m[0].length; };
  const val = (d) => {
    if (d > 200) fail('Nested too deeply');
    ws(); if (i >= n) fail('Unexpected end of text');
    const c = s[i];
    if (c === '{') {
      i++; ws(); if (s[i] === '}') { i++; return; }
      for (;;) {
        ws(); if (s[i] !== '"') fail(i >= n ? 'Unexpected end of text' : 'Expected a "quoted" key');
        str(); ws(); if (s[i] !== ':') fail(i >= n ? 'Unexpected end of text' : 'Expected ":"'); i++; val(d + 1); ws();
        if (s[i] === ',') { i++; continue; } if (s[i] === '}') { i++; return; }
        fail(i >= n ? 'Unexpected end of text' : 'Expected "," or "}"');
      }
    }
    if (c === '[') {
      i++; ws(); if (s[i] === ']') { i++; return; }
      for (;;) {
        val(d + 1); ws();
        if (s[i] === ',') { i++; continue; } if (s[i] === ']') { i++; return; }
        fail(i >= n ? 'Unexpected end of text' : 'Expected "," or "]"');
      }
    }
    if (c === '"') return str();
    if (c === '-' || (c >= '0' && c <= '9')) return num();
    for (const w of ['true', 'false', 'null']) if (s.startsWith(w, i)) { i += w.length; return; }
    fail('Unexpected character "' + c + '"');
  };
  try { val(0); ws(); if (i < n) fail('Unexpected extra text after the value'); return { ok: true }; }
  catch (e) {
    if (e.pos === undefined) throw e;
    const before = s.slice(0, e.pos).split('\n');
    return { ok: false, pos: e.pos, msg: e.msg, line: before.length, col: before[before.length - 1].length + 1 };
  }
};

/* Rebuilds already-valid JSON text (check it with jsonCheck first) changing only whitespace: numbers and strings are copied exactly as written,
   so 12345678901234567890, 1.0, 1E2 and the order of keys such as "2" and "1" survive. ind is '' (minify), '  ', '    ' or '\t'. */
TX.jsonFormat = (s, ind) => {
  let i = 0; const n = s.length, nl = (d) => (ind ? '\n' + ind.repeat(d) : '');
  const ws = () => { while (i < n && (s[i] === ' ' || s[i] === '\t' || s[i] === '\n' || s[i] === '\r')) i++; };
  const str = () => { const a = i; i++; while (i < n && s[i] !== '"') i += s[i] === '\\' ? 2 : 1; i++; return s.slice(a, i); };
  const val = (d) => {
    ws(); const c = s[i];
    if (c === '{' || c === '[') {
      const close = c === '{' ? '}' : ']'; i++; ws();
      if (s[i] === close) { i++; return c + close; }
      const parts = [];
      for (;;) {
        ws();
        if (c === '{') { const k = str(); ws(); i++; parts.push(k + ':' + (ind ? ' ' : '') + val(d + 1)); } else parts.push(val(d + 1));
        ws(); if (s[i] === ',') { i++; continue; } i++; break;
      }
      return c + parts.map(p => nl(d + 1) + p).join(',') + nl(d) + close;
    }
    if (c === '"') return str();
    const m = /-?[0-9][0-9.eE+-]*|true|false|null/y; m.lastIndex = i; const t = m.exec(s)[0]; i += t.length; return t;
  };
  return val(0);
};

/* ---------- Colour ---------- */
TX.hexToRgb = (s) => { s = s.trim().replace(/^#/, ''); if (/^[0-9a-f]{3}$/i.test(s)) s = s.replace(/./g, '$&$&'); return /^[0-9a-f]{6}$/i.test(s) ? [0, 2, 4].map(i => parseInt(s.substr(i, 2), 16)) : null; };
TX.rgbToHex = (c) => '#' + c.map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('').toUpperCase();
TX.rgbToHsl = ([r, g, b]) => {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (d) { s = d / (1 - Math.abs(2 * l - 1)); h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
  return [Math.round(h) % 360, Math.round(s * 100), Math.round(l * 100)];
};
TX.hslToRgb = ([h, s, l]) => {
  h = ((h % 360) + 360) % 360; s = clamp(s, 0, 100) / 100; l = clamp(l, 0, 100) / 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)].map(v => Math.round(v * 255));
};

/* ---------- Lorem ipsum ---------- */
const LW = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum'.split(' ');
TX.lorem = (unit, n, rnd = (k) => Math.floor(Math.random() * k), classic = true) => {
  n = clamp(Math.round(n) || 1, 1, 100);
  const word = () => LW[rnd(LW.length)];
  const sentence = (first) => {
    const len = 6 + rnd(9), w = first && classic ? LW.slice(0, Math.min(len, 8)) : [];
    while (w.length < len) w.push(word());
    if (len > 8 && !(first && classic)) w[3 + rnd(3)] += ',';
    w[0] = w[0][0].toUpperCase() + w[0].slice(1);
    return w.join(' ') + '.';
  };
  if (unit === 'words') { const w = classic ? LW.slice(0, n) : []; while (w.length < n) w.push(word()); return w.slice(0, n).join(' '); }
  if (unit === 'sentences') return Array.from({ length: n }, (_, i) => sentence(!i)).join(' ');
  return Array.from({ length: n }, (_, p) => Array.from({ length: 3 + rnd(4) }, (_, i) => sentence(!p && !i)).join(' ')).join('\n\n');
};

/* ---------- Diff ---------- */
/* Longest-common-subsequence diff of two token arrays -> [{ t: '=' | '-' | '+', v }]; null when the input is too large. */
TX.diff = (a, b) => {
  const n = a.length, m = b.length; if (n * m > 4e6) return null;
  const w = m + 1, t = new Uint16Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) t[i * w + j] = a[i] === b[j] ? t[(i + 1) * w + j + 1] + 1 : Math.max(t[(i + 1) * w + j], t[i * w + j + 1]);
  const out = []; let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ t: '=', v: a[i] }); i++; j++; }
    else if (t[(i + 1) * w + j] >= t[i * w + j + 1]) out.push({ t: '-', v: a[i++] });
    else out.push({ t: '+', v: b[j++] });
  }
  while (i < n) out.push({ t: '-', v: a[i++] });
  while (j < m) out.push({ t: '+', v: b[j++] });
  return out;
};

/* ---------- Regex ---------- */
TX.regexRun = (pat, flags, text, cap = 500) => {
  let re;
  flags = [...new Set((flags || '').replace(/[^dgimsuvy]/g, ''))].join('');
  try { re = new RegExp(pat, flags.includes('g') ? flags : flags + 'g'); } catch (e) { return { error: e.message }; }
  const matches = []; let m;
  while ((m = re.exec(text)) && matches.length < cap) {
    matches.push({ i: m.index, s: m[0], g: [...m].slice(1) });
    if (m[0] === '') re.lastIndex++;
  }
  return { matches };
};
/* Source text for the regex Worker: the same two functions, so the Worker and the tests share one implementation. */
TX.regexWorkerSource = () => 'const regexRun = ' + TX.regexRun.toString() + ';\nconst regexReplace = ' + TX.regexReplace.toString() +
  ';\nonmessage = (e) => { const d = e.data, r = regexRun(d.p, d.f, d.t, 500); postMessage({ r, rep: r.error ? null : regexReplace(d.p, d.f, d.t, d.r) }); };';
TX.regexReplace = (pat, flags, text, repl) => {
  try { return { out: text.replace(new RegExp(pat, (flags || '').replace(/[^dgimsuvy]/g, '')), repl) }; } catch (e) { return { error: e.message }; }
};

/* ---------- CSV ---------- */
TX.parseCSV = (s, d) => {
  s = s.replace(/^\uFEFF/, ''); // a byte order mark (Excel exports) must not become part of the first header
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"' && f === '') q = true;
    else if (c === d) { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => !(r.length === 1 && r[0] === ''));
};
TX.detectDelim = (s) => { const l = s.split('\n')[0] || ''; return [',', ';', '\t', '|'].map(d => [d, l.split(d).length]).sort((a, b) => b[1] - a[1])[0][0]; };
TX.csvToJson = (rows, header) => {
  if (!header) return rows;
  const seen = new Set(), h = rows[0].map((x, i) => {
    const base = x.trim() || 'col' + (i + 1); let k = base;
    for (let n = 2; seen.has(k); n++) k = base + '_' + n; // duplicate headers become name_2, name_3 ...
    seen.add(k); return k;
  });
  return rows.slice(1).map(r => { const o = {}; h.forEach((k, i) => { Object.defineProperty(o, k, { value: r[i] === undefined ? '' : r[i], enumerable: true, writable: true, configurable: true }); }); return o; });
};

/* ---------- Markdown (small subset, HTML-escaped) ---------- */
const escH = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
TX.mdInline = (t) => {
  const codes = [];
  const lit = [];
  t = escH(String(t).replace(/[\u0000-\u0002]/g, '')).replace(/`([^`]+)`/g, (m, c) => { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; });
  // URLs (and link tags) are swapped for placeholders so the bold / italic passes cannot touch underscores or asterisks inside them
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, a, u) => {
    const good = /^(https?:\/\/|mailto:|#)/i.test(u);
    lit.push(good ? '<a href="' + u + '">' : ' (' + u + ')');
    return good ? '\u0001' + (lit.length - 1) + '\u0001' + a + '\u0002' : a + '\u0001' + (lit.length - 1) + '\u0001';
  })
    .replace(/\*\*(?!\s)(.+?)(?<!\s)\*\*|__(?!\s)(.+?)(?<!\s)__/g, (m, a, b) => '<b>' + (a || b) + '</b>')
    .replace(/\*(?!\s)(.+?)(?<!\s)\*|\b_(?!\s)(.+?)(?<!\s)_\b/g, (m, a, b) => '<i>' + (a || b) + '</i>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>');
  t = t.replace(/\u0001(\d+)\u0001/g, (m, i) => lit[+i]).replace(/\u0002/g, '</a>');
  return t.replace(/\u0000(\d+)\u0000/g, (m, i) => '<code>' + codes[+i] + '</code>');
};
TX.md = (src) => {
  const out = []; let para = [], list = null, quote = [], code = null;
  const flushP = () => { if (para.length) out.push('<p>' + TX.mdInline(para.join(' ')) + '</p>'); para = []; };
  const flushL = () => { if (list) out.push('<' + list.t + '>' + list.i.map(x => '<li>' + TX.mdInline(x) + '</li>').join('') + '</' + list.t + '>'); list = null; };
  const flushQ = () => { if (quote.length) out.push('<blockquote>' + TX.mdInline(quote.join(' ')) + '</blockquote>'); quote = []; };
  const flush = () => { flushP(); flushL(); flushQ(); };
  src.split('\n').forEach(line => {
    if (code !== null) { if (/^\s*```/.test(line)) { out.push('<pre><code>' + escH(code.join('\n')) + '</code></pre>'); code = null; } else code.push(line); return; }
    let m;
    if (/^\s*```/.test(line)) { flush(); code = []; }
    else if (!line.trim()) flush();
    else if ((m = /^(#{1,6})\s+(.*?)\s*#*$/.exec(line))) { flush(); out.push('<h' + m[1].length + '>' + TX.mdInline(m[2]) + '</h' + m[1].length + '>'); }
    else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flush(); out.push('<hr>'); }
    else if ((m = /^\s*>\s?(.*)$/.exec(line))) { flushP(); flushL(); quote.push(m[1]); }
    else if ((m = /^\s*[-*+]\s+(.*)$/.exec(line))) { flushP(); flushQ(); if (!list || list.t !== 'ul') { flushL(); list = { t: 'ul', i: [] }; } list.i.push(m[1]); }
    else if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(line))) { flushP(); flushQ(); if (!list || list.t !== 'ol') { flushL(); list = { t: 'ol', i: [] }; } list.i.push(m[1]); }
    else { flushL(); flushQ(); para.push(line.trim()); }
  });
  if (code !== null) out.push('<pre><code>' + escH(code.join('\n')) + '</code></pre>');
  flush();
  return out.join('\n');
};

/* ---------- SMS / tweet length ---------- */
const GSM = new Set([...'@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\u001bÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà']);
const GSMX = new Set([...'^{}\\[~]|€']);
TX.smsInfo = (t) => {
  let units = 0, ucs = false;
  for (const c of t) { if (GSM.has(c)) units++; else if (GSMX.has(c)) units += 2; else { ucs = true; break; } }
  if (ucs) units = t.length;
  const one = ucs ? 70 : 160, many = ucs ? 67 : 153, segs = !units ? 0 : units <= one ? 1 : Math.ceil(units / many);
  return { ucs, units, segs, left: segs <= 1 ? one - units : segs * many - units };
};
TX.tweetLen = (t) => {
  let n = 0; t = t.replace(/https?:\/\/\S+/g, () => { n += 23; return ''; });
  for (const c of t) { const p = c.codePointAt(0); n += (p <= 4351 || (p >= 8192 && p <= 8205) || (p >= 8208 && p <= 8223) || (p >= 8242 && p <= 8247)) ? 1 : 2; }
  return n;
};

/* ---------- Epoch / UUID ---------- */
TX.epochMs = (n) => Math.abs(n) >= 1e11 ? n : n * 1000;
TX.uuid4 = (b) => {
  b = Uint8Array.from(b); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
};
TX.newUuid = () => TX.uuid4(crypto.getRandomValues(new Uint8Array(16)));

/* ---------- Fancy Unicode text ---------- */
const range = (up, lo, dg, ex = {}) => (c) => {
  if (ex[c]) return ex[c];
  const p = c.charCodeAt(0);
  if (up && p >= 65 && p <= 90) return String.fromCodePoint(up + p - 65);
  if (lo && p >= 97 && p <= 122) return String.fromCodePoint(lo + p - 97);
  if (dg && p >= 48 && p <= 57) return String.fromCodePoint(dg + p - 48);
  return c;
};
const mapStr = (f) => (s) => [...s].map(f).join('');
const FLIP = { a: 'ɐ', b: 'q', c: 'ɔ', d: 'p', e: 'ǝ', f: 'ɟ', g: 'ƃ', h: 'ɥ', i: 'ᴉ', j: 'ɾ', k: 'ʞ', l: 'l', m: 'ɯ', n: 'u', o: 'o', p: 'd', q: 'b', r: 'ɹ', s: 's', t: 'ʇ', u: 'n', v: 'ʌ', w: 'ʍ', x: 'x', y: 'ʎ', z: 'z', '.': '˙', ',': "'", '?': '¿', '!': '¡', '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<', '_': '‾', "'": ',', '&': '⅋', 1: 'Ɩ', 2: 'ᄅ', 3: 'Ɛ', 4: 'ㄣ', 5: 'ϛ', 6: '9', 7: 'ㄥ', 8: '8', 9: '6', 0: '0' };
const SMALL = { a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ', s: 'ꜱ', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ' };
TX.fancy = {
  'Bold': mapStr(range(0x1D400, 0x1D41A, 0x1D7CE)),
  'Italic': mapStr(range(0x1D434, 0x1D44E, 0, { h: 'ℎ' })),
  'Bold italic': mapStr(range(0x1D468, 0x1D482, 0)),
  'Script': mapStr(range(0x1D49C, 0x1D4B6, 0, { B: 'ℬ', E: 'ℰ', F: 'ℱ', H: 'ℋ', I: 'ℐ', L: 'ℒ', M: 'ℳ', R: 'ℛ', e: 'ℯ', g: 'ℊ', o: 'ℴ' })),
  'Bold script': mapStr(range(0x1D4D0, 0x1D4EA, 0)),
  'Fraktur': mapStr(range(0x1D504, 0x1D51E, 0, { C: 'ℭ', H: 'ℌ', I: 'ℑ', R: 'ℜ', Z: 'ℨ' })),
  'Double-struck': mapStr(range(0x1D538, 0x1D552, 0x1D7D8, { C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ' })),
  'Sans': mapStr(range(0x1D5A0, 0x1D5BA, 0x1D7E2)),
  'Sans bold': mapStr(range(0x1D5D4, 0x1D5EE, 0x1D7EC)),
  'Sans italic': mapStr(range(0x1D608, 0x1D622, 0)),
  'Monospace': mapStr(range(0x1D670, 0x1D68A, 0x1D7F6)),
  'Fullwidth': mapStr(c => c === ' ' ? '　' : (c > ' ' && c <= '~') ? String.fromCodePoint(c.charCodeAt(0) + 0xFEE0) : c),
  'Circled': mapStr(c => /[A-Z]/.test(c) ? String.fromCodePoint(0x24B6 + c.charCodeAt(0) - 65) : /[a-z]/.test(c) ? String.fromCodePoint(0x24D0 + c.charCodeAt(0) - 97) : c === '0' ? '⓪' : /[1-9]/.test(c) ? String.fromCodePoint(0x2460 + +c - 1) : c),
  'Squared': mapStr(c => /[A-Za-z]/.test(c) ? String.fromCodePoint(0x1F130 + c.toUpperCase().charCodeAt(0) - 65) : c),
  'Small caps': mapStr(c => SMALL[c.toLowerCase()] || c),
  'Upside down': (s) => [...s].reverse().map(c => FLIP[c.toLowerCase()] || c).join(''),
  'Strikethrough': mapStr(c => c === '\n' ? c : c + '̶'),
  'Underline': mapStr(c => c === '\n' ? c : c + '̲')
};

/* ---------- Braille (grade 1, English) ---------- */
const BR = {}, BRN = {};
'a1 b12 c14 d145 e15 f124 g1245 h125 i24 j245 k13 l123 m134 n1345 o135 p1234 q12345 r1235 s234 t2345 u136 v1236 w2456 x1346 y13456 z1356'.split(' ').forEach(p => {
  let code = 0x2800; [...p.slice(1)].forEach(d => { code += 1 << (d - 1); }); BR[p[0]] = String.fromCharCode(code);
});
'1a 2b 3c 4d 5e 6f 7g 8h 9i 0j'.split(' ').forEach(p => { BRN[p[0]] = BR[p[1]]; });
const BRP = { ',': '⠂', ';': '⠆', ':': '⠒', '.': '⠲', '!': '⠖', '?': '⠦', "'": '⠄', '-': '⠤', '(': '⠶', ')': '⠶', '"': '⠦' };
const BR_NUM = '⠼', BR_CAP = '⠠';
const BR_REV = {}; Object.keys(BR).forEach(k => { BR_REV[BR[k]] = k; });
const BRN_REV = {}; Object.keys(BRN).forEach(k => { BRN_REV[BRN[k]] = k; });
TX.toBraille = (s) => {
  let out = '', num = false, capRun = false;
  const chars = [...s], isUp = (c) => !!c && /[A-Z]/.test(c);
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i], l = c.toLowerCase();
    if (/[0-9]/.test(c)) { if (!num) out += BR_NUM; out += BRN[c]; num = true; continue; }
    if (num && /[a-j]/i.test(c)) out += '⠰';
    num = false;
    if (/[a-z]/i.test(c)) {
      if (isUp(c)) {
        if (!isUp(chars[i - 1])) { let j = i; while (isUp(chars[j])) j++; capRun = j - i >= 2 && !/[a-z]/i.test(chars[j] || ''); if (capRun) out += BR_CAP + BR_CAP; }
        if (!capRun) out += BR_CAP;
      }
      out += BR[l];
    } else if (BRP[c]) out += BRP[c];
    else if (c === ' ' || c === '\n') out += c;
  }
  return out;
};
TX.brailleLost = (s) => [...s].filter(c => !/[A-Za-z0-9 \n]/.test(c) && !BRP[c]).length;
TX.fromBraille = (s) => {
  let out = '', num = false, cap = 0, capWord = false, paren = 0;
  for (const c of s) {
    if (c === ' ' || c === '\n') { out += c; num = false; capWord = false; cap = 0; continue; }
    if (c === BR_NUM) { num = true; continue; }
    if (c === BR_CAP) { num = false; if (cap === 1) { capWord = true; cap = 0; } else cap = 1; continue; }
    if (c === '⠰' && num) { num = false; continue; }
    if (num && BRN_REV[c]) { out += BRN_REV[c]; continue; }
    num = false;
    if (BR_REV[c]) { const ch = BR_REV[c]; out += (cap || capWord) ? ch.toUpperCase() : ch; cap = 0; continue; }
    cap = 0;
    if (c === '⠶') { out += paren ? ')' : '('; paren ^= 1; continue; } // one cell stands for both brackets: alternate open / close
    const p = Object.keys(BRP).find(k => BRP[k] === c);
    out += p || '?';
  }
  return out;
};

/* ---------- T9 / multi-tap ---------- */
const KEYS = { 2: 'abc', 3: 'def', 4: 'ghi', 5: 'jkl', 6: 'mno', 7: 'pqrs', 8: 'tuv', 9: 'wxyz', 1: ".,'?!-" };
const KEY_OF = {}; Object.keys(KEYS).forEach(k => { [...KEYS[k]].forEach((c, i) => { KEY_OF[c] = [k, i + 1]; }); });
TX.multitapEnc = (s) => [...s.toLowerCase()].map(c => c === ' ' ? '0' : KEY_OF[c] ? KEY_OF[c][0].repeat(KEY_OF[c][1]) : '').filter(Boolean).join(' ');
TX.multitapDec = (s) => s.trim().split(/\s+/).filter(Boolean).map(t => {
  if (/^0+$/.test(t)) return ' '.repeat(t.length);
  const k = t[0], letters = KEYS[k];
  if (!letters || t.split('').some(x => x !== k)) return '?';
  return letters[(t.length - 1) % letters.length];
}).join('');
TX.t9Digits = (s) => [...s.toLowerCase()].map(c => c === ' ' ? '0' : KEY_OF[c] ? KEY_OF[c][0] : /\d/.test(c) ? '' : '').join('');

/* ---------- NATO alphabet ---------- */
const NATO = 'Alfa Bravo Charlie Delta Echo Foxtrot Golf Hotel India Juliett Kilo Lima Mike November Oscar Papa Quebec Romeo Sierra Tango Uniform Victor Whiskey Xray Yankee Zulu'.split(' ');
const NDIG = 'Zero One Two Three Four Five Six Seven Eight Nine'.split(' ');
const NATO_REV = {}; NATO.forEach((w, i) => { NATO_REV[w.toLowerCase()] = String.fromCharCode(65 + i); }); NATO_REV.alpha = 'A'; NATO_REV.juliet = 'J'; NATO_REV.x = 'X'; NATO_REV['x-ray'] = 'X';
NDIG.forEach((w, i) => { NATO_REV[w.toLowerCase()] = String(i); }); NATO_REV.niner = '9';
TX.natoEnc = (s) => s.split(/\s+/).filter(Boolean).map(w => [...w].map(c => /[a-z]/i.test(c) ? NATO[c.toUpperCase().charCodeAt(0) - 65] : /[0-9]/.test(c) ? NDIG[+c] : '').filter(Boolean).join(' ')).filter(Boolean).join(' / ');
/* How many characters natoEnc / toBraille cannot express (they are skipped). */
TX.natoLost = (s) => [...s].filter(c => !/[\sA-Za-z0-9]/.test(c)).length;
TX.natoDec = (s) => s.trim().split(/\s+/).filter(Boolean).map(t => t === '/' ? ' ' : (NATO_REV[t.toLowerCase().replace(/[,.]/g, '')] || '?')).join('').replace(/ +/g, ' ');

/* ---------- Pig Latin / Caesar ---------- */
TX.pig = (s) => s.replace(/[A-Za-z]+(?:['’][A-Za-z]+)*/g, (w) => {
  const lw = w.toLowerCase(); let r;
  if (/^[aeiou]/.test(lw)) r = lw + 'way';
  else {
    let i = 0; while (i < lw.length && !/[aeiou]/.test(lw[i]) && !(i > 0 && lw[i] === 'y')) i++;
    if (lw[i - 1] === 'q' && lw[i] === 'u') i++;
    r = i >= lw.length ? lw + 'ay' : lw.slice(i) + lw.slice(0, i) + 'ay';
  }
  if (w.length > 1 && w === w.toUpperCase()) return r.toUpperCase();
  return w[0] === w[0].toUpperCase() ? r[0].toUpperCase() + r.slice(1) : r;
});
TX.caesar = (s, k) => { k = ((k % 26) + 26) % 26; return s.replace(/[a-z]/gi, c => { const b = c <= 'Z' ? 65 : 97; return String.fromCharCode((c.charCodeAt(0) - b + k) % 26 + b); }); };

/* ---------- Numbers ---------- */
/* Strict number list: split on whitespace / semicolons / new lines, and on a comma only when a space or line end follows it. Returns { nums, bad } (bad = first token that is not a number). */
TX.parseNumsStrict = (s) => {
  const nums = []; let bad = null;
  const NUM = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i;
  String(s).split(/[\s;]+|,(?=\s|$)/).forEach(tok => {
    if (!tok || bad !== null) return;
    if (NUM.test(tok)) { const v = Number(tok); if (Number.isFinite(v)) { nums.push(v); return; } bad = tok; return; }
    if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(tok)) { nums.push(Number(tok.replace(/,/g, ''))); return; }
    const parts = tok.split(',');
    if (parts.length > 1 && parts.every(x => NUM.test(x) && Number.isFinite(Number(x)))) { parts.forEach(x => nums.push(Number(x))); return; }
    bad = tok;
  });
  return { nums, bad };
};
TX.parseNums = (s) => TX.parseNumsStrict(s).nums;
TX.numStats = (a) => {
  if (!a.length) return null;
  const s = a.slice().sort((x, y) => x - y), sum = a.reduce((x, y) => x + y, 0), mid = s.length >> 1;
  return { n: a.length, sum, mean: sum / a.length, median: s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2, min: s[0], max: s[s.length - 1] };
};
TX.teams = (names, k, rnd) => { const t = Array.from({ length: k }, () => []); TX.shuffle(names, rnd).forEach((n, i) => t[i % k].push(n)); return t; };

/* Export of notes as Markdown (one note, or all notes in one file). */
const mdLine = (s) => String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').trim();
TX.noteMarkdown = (n) => '# ' + (mdLine(n.t) || 'Untitled') + '\n\n' + String(n.b == null ? '' : n.b).replace(/\r\n?/g, '\n').trimEnd() + '\n';
TX.notesMarkdown = (items, date) => '# Notes (' + date + ')\n\n' + items.length + ' note' + (items.length === 1 ? '' : 's') + '\n\n' +
  items.map((n) => '## ' + (n.pin ? '[pinned] ' : '') + (mdLine(n.t) || 'Untitled') + '\n\n' + String(n.b == null ? '' : n.b).replace(/\r\n?/g, '\n').trimEnd() + '\n').join('\n---\n\n');
TX.fileSlug = (s) => (String(s == null ? '' : s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 30)) || 'note';
if (typeof module === 'object' && module.exports) module.exports = TX;

/* ====================== UI helpers ====================== */
const reg = (o) => Tools.register(Object.assign({ cat: 'text', needs: [] }, o));
const WRAP = 'display:flex;flex-wrap:wrap;gap:8px', BTN = 'flex:1 1 28%;min-height:44px';
const MONO = 'font-family:ui-monospace,Consolas,monospace;word-break:break-all';

/* Hands a text file to the share sheet (or downloads it in a browser) and says so with a toast. */
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
async function sendFile(name, text, mime, what) {
  if (text.length > 2e6) { toast('Too much data to export (over 2 MB)'); return false; }
  const ok = await saveTextFile(name, text, mime);
  if (ok) toast((what || 'Exported') + ': ' + name);
  return ok;
}
/* One-tap copy through the shared helper (clipboard API with a fallback), with a toast either way. */
async function copy(s, msg) { toast(await copyToClipboard(s) ? (msg || 'Copied') : 'Could not copy'); }
const lbl = (text, inner) => `<label class="f">${text}${inner}</label>`;

/* A tool that turns one text box into another. modes: [{ n, f(text, opt), inv }]; inv = mode index to switch to on Swap. */
function xform(meta, modes, o = {}) {
  reg(Object.assign({}, meta, { render(el) {
    el.innerHTML = `<div class="list">
      ${modes.length > 1 ? `<select id="m" aria-label="Mode">${modes.map((m, i) => `<option value="${i}">${esc(m.n)}</option>`).join('')}</select>` : ''}
      ${o.opt ? lbl(esc(o.opt.label), `<input id="p" type="number" min="${o.opt.min}" max="${o.opt.max}" value="${o.opt.value}" inputmode="numeric">`) : ''}
      ${lbl(esc(o.inLabel || 'Input'), `<textarea id="i" rows="5" maxlength="200000" placeholder="${esc(o.ph || '')}"></textarea>`)}
      <div class="status" id="e" hidden></div>
      ${lbl('Output', '<textarea id="u" rows="5" maxlength="2000000" readonly></textarea>')}<div class="muted" id="nt" style="font-size:13px"></div>
      <div class="row"><button class="btn" id="cp">Copy</button><button class="btn alt" id="sw">Swap</button><button class="btn alt" id="cl">Clear</button></div></div>`;
    const sel = $('#m', el);
    const run = () => {
      const m = modes[sel ? +sel.value : 0], e = $('#e', el);
      try { $('#u', el).value = m.f($('#i', el).value, o.opt ? clamp(+$('#p', el).value || 0, o.opt.min, o.opt.max) : 0); e.hidden = true; $('#nt', el).textContent = m.note ? m.note($('#i', el).value) : ''; }
      catch (x) { $('#u', el).value = ''; e.textContent = x.message; e.hidden = false; }
    };
    el.addEventListener('input', run); if (sel) sel.onchange = run;
    $('#cp', el).onclick = () => { if ($('#u', el).value) copy($('#u', el).value); };
    $('#cl', el).onclick = () => { $('#i', el).value = ''; run(); };
    $('#sw', el).onclick = () => {
      const m = modes[sel ? +sel.value : 0];
      if ($('#u', el).value) $('#i', el).value = $('#u', el).value;
      if (sel && m.inv !== undefined) sel.value = m.inv;
      run();
    };
    run();
  } }));
}

/* ====================== 1. Morse ====================== */
reg({ id: 'morse', name: 'Morse Code', icon: '📟', desc: 'Translate text to Morse code and back, then play it as beeps and vibration at your own speed.', keys: ['sos', 'dots', 'dashes', 'telegraph', 'cw'], needs: [], render(el) {
  el.innerHTML = `<div class="list">
    <select id="m" aria-label="Direction"><option value="0">Text to Morse</option><option value="1">Morse to text</option></select>
    ${lbl('Input', '<textarea id="i" rows="4" maxlength="2000" placeholder="Type here. In Morse use . and -, spaces between letters, / between words"></textarea>')}
    ${lbl('Output', '<textarea id="o" rows="4" maxlength="20000" readonly></textarea>')}
    <div class="card list">
      ${lbl('Speed: <b id="wv">15</b> words per minute', '<input id="w" type="range" min="5" max="30" value="15">')}
      <div class="row"><label style="display:flex;gap:8px;align-items:center;min-height:44px"><input type="checkbox" id="snd" checked style="flex:none"> Sound</label><label style="display:flex;gap:8px;align-items:center;min-height:44px"><input type="checkbox" id="vib" checked style="flex:none"> Vibrate</label></div>
      <div class="row"><button class="btn" id="play">▶ Play</button><button class="btn alt" id="cp">Copy output</button></div></div></div>`;
  let ctx = null, tm = 0, vt = 0, playing = false;
  const mode = () => +$('#m', el).value, morse = () => mode() ? $('#i', el).value : $('#o', el).value;
  const conv = () => { const v = $('#i', el).value; $('#o', el).value = mode() ? TX.morseDec(v) : TX.morseEnc(v); };
  const stop = () => {
    playing = false; clearTimeout(tm); clearTimeout(vt);
    if (ctx) { try { ctx.close(); } catch (e) { /* ignore */ } ctx = null; }
    if (navigator.vibrate) navigator.vibrate(0);
    const b = $('#play', el); if (b) b.textContent = '▶ Play';
  };
  $('#play', el).onclick = () => {
    if (playing) { stop(); return; }
    const unit = 1200 / +$('#w', el).value, ev = TX.morseTimeline(morse(), unit);
    if (!ev.length) { toast('Nothing to play'); return; }
    playing = true; $('#play', el).textContent = '■ Stop';
    if ($('#snd', el).checked) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext; ctx = new AC(); ctx.resume();
        const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 650; g.gain.value = 0; o.connect(g); g.connect(ctx.destination); o.start();
        let t = ctx.currentTime + 0.05;
        ev.forEach(d => { const s = Math.abs(d) / 1000; if (d > 0) { g.gain.setTargetAtTime(0.4, t, 0.004); g.gain.setTargetAtTime(0, t + s, 0.004); } t += s; });
      } catch (e) { toast('Sound is not available'); }
    }
    if ($('#vib', el).checked && navigator.vibrate) {
      // Android cuts patterns after ~99 entries, so send them in chunks and issue the next one when the last ends
      const chunks = TX.vibChunks(ev), go = (k) => { if (!playing || k >= chunks.length) return; navigator.vibrate(chunks[k]); vt = setTimeout(() => go(k + 1), chunks[k].reduce((a, d) => a + d, 0)); };
      go(0);
    }
    tm = setTimeout(stop, ev.reduce((a, d) => a + Math.abs(d), 0) + 150);
  };
  const wpm0 = clamp(Math.round(+Store.get('morse.wpm', 15)) || 15, 5, 30); $('#w', el).value = wpm0; $('#wv', el).textContent = wpm0;
  $('#w', el).oninput = () => { $('#wv', el).textContent = $('#w', el).value; Store.set('morse.wpm', +$('#w', el).value); };
  $('#i', el).oninput = () => { conv(); };
  $('#m', el).onchange = () => { stop(); $('#i', el).value = $('#o', el).value; conv(); };
  $('#cp', el).onclick = () => { if ($('#o', el).value) copy($('#o', el).value); };
  return stop;
} });

/* ====================== 2. QR & barcode ====================== */
const QF = {
  text: { n: 'Text', f: [{ l: 'Text', t: 'area' }] },
  url: { n: 'Web link', f: [{ l: 'Web address', ph: 'https://example.com' }] },
  wifi: { n: 'Wi-Fi network', f: [{ l: 'Network name (SSID)' }, { l: 'Password' }, { l: 'Security', t: 'sel', o: [['WPA', 'WPA / WPA2 / WPA3'], ['WEP', 'WEP (old)'], ['nopass', 'None (open network)']] }, { l: 'Hidden network', t: 'chk' }] },
  phone: { n: 'Phone number', f: [{ l: 'Phone number', ty: 'tel' }] },
  email: { n: 'Email', f: [{ l: 'Email address', ty: 'email' }, { l: 'Subject' }, { l: 'Message', t: 'area' }] },
  sms: { n: 'SMS message', f: [{ l: 'Phone number', ty: 'tel' }, { l: 'Message', t: 'area' }] },
  code128: { n: 'Barcode: Code 128', f: [{ l: 'Text (letters, digits, symbols)' }] },
  ean13: { n: 'Barcode: EAN-13', f: [{ l: '12 or 13 digits', ty: 'text' }] }
};
const QS = {
  text: v => v[0], url: v => v[0].trim(),
  wifi: v => v[0] ? TX.wifiString(v[0], v[1], v[2], v[3]) : '',
  phone: v => v[0].trim() ? 'tel:' + v[0].replace(/\s/g, '') : '',
  email: v => v[0].trim() ? 'mailto:' + v[0].trim() + (v[1] || v[2] ? '?' + [v[1] && 'subject=' + encodeURIComponent(v[1]), v[2] && 'body=' + encodeURIComponent(v[2])].filter(Boolean).join('&') : '') : '',
  sms: v => v[0].trim() ? 'SMSTO:' + v[0].replace(/\s/g, '') + ':' + v[1] : ''
};
reg({ id: 'qr', name: 'QR & Barcode', icon: '🔳', desc: 'Make QR codes for text, links, Wi-Fi, phone, email and SMS, or Code 128 and EAN-13 barcodes. Save as a PNG or share.', keys: ['qr code', 'barcode', 'wifi', 'ean', 'code128', 'generator'], needs: [], render(el) {
  el.innerHTML = `<div class="list">
    <select id="t" aria-label="Type">${Object.keys(QF).map(k => `<option value="${k}">${QF[k].n}</option>`).join('')}</select>
    <div class="list" id="fs"></div>
    <div id="lv-w">${lbl('Error correction', '<select id="lv"><option value="L">Low (smallest)</option><option value="M" selected>Medium</option><option value="Q">Quartile</option><option value="H">High (sturdiest)</option></select>')}</div>
    <div class="status" id="e" hidden></div>
    <canvas id="c" width="300" height="300" style="background:#fff" aria-label="Generated code"></canvas>
    <div class="row"><button class="btn" id="sv">Save PNG</button><button class="btn alt" id="sh">Share</button></div></div>`;
  const cv = $('#c', el), type = () => $('#t', el).value;
  const fields = () => {
    $('#fs', el).innerHTML = QF[type()].f.map((f, i) => f.t === 'area' ? lbl(f.l, `<textarea id="f${i}" rows="3" maxlength="1500"></textarea>`)
      : f.t === 'sel' ? lbl(f.l, `<select id="f${i}">${f.o.map(o => `<option value="${o[0]}">${o[1]}</option>`).join('')}</select>`)
        : f.t === 'chk' ? `<label style="display:flex;gap:8px;align-items:center;min-height:44px"><input type="checkbox" id="f${i}" style="flex:none"> ${f.l}</label>`
          : lbl(f.l, `<input id="f${i}" type="${f.ty || 'text'}" maxlength="500" placeholder="${esc(f.ph || '')}">`)).join('');
    $('#lv-w', el).style.display = /code128|ean13/.test(type()) ? 'none' : '';
    draw();
  };
  const vals = () => QF[type()].f.map((f, i) => { const x = $('#f' + i, el); return f.t === 'chk' ? x.checked : x.value; });
  const blank = (msg) => { cv.width = 300; cv.height = 120; const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 300, 120); g.fillStyle = '#888'; g.font = '14px sans-serif'; g.textAlign = 'center'; g.fillText(msg, 150, 64); };
  const bars = (bits, label) => {
    const q = 10, sc = Math.max(2, Math.floor(600 / (bits.length + 2 * q))), W = (bits.length + 2 * q) * sc, H = 190;
    cv.width = W; cv.height = H; const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.fillStyle = '#000';
    for (let i = 0; i < bits.length; i++) if (bits[i]) g.fillRect((q + i) * sc, 10, sc, 140);
    g.font = '28px ui-monospace,Consolas,monospace'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText(label, W / 2, 182, W - 20);
  };
  function draw() {
    const e = $('#e', el), v = vals(), ty = type(); e.hidden = true;
    if (ty === 'code128' || ty === 'ean13') {
      const s = v[0];
      if (!s.trim()) { blank('Enter something'); return; }
      if (ty === 'code128') { const r = TX.code128(s); if (!r) { e.textContent = 'Code 128 here supports plain keyboard characters only (no accents or emoji).'; e.hidden = false; blank('Cannot encode'); return; } bars(r.bits, s); }
      else { const r = TX.ean13(s); if (r.error) { e.textContent = r.error; e.hidden = false; blank('Cannot encode'); return; } bars(r.bits, r.digits.slice(0, 1) + ' ' + r.digits.slice(1, 7) + ' ' + r.digits.slice(7)); }
      return;
    }
    const data = QS[ty](v);
    if (!data) { blank('Enter something'); return; }
    try {
      const q = qrcode(0, $('#lv', el).value); q.addData(data); q.make();
      const n = q.getModuleCount(), sc = Math.max(2, Math.floor(600 / (n + 8))), S = (n + 8) * sc;
      cv.width = S; cv.height = S; const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, S, S); g.fillStyle = '#000';
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) g.fillRect((c + 4) * sc, (r + 4) * sc, sc, sc);
    } catch (x) { e.textContent = 'That is too much data for a QR code. Try a shorter text or lower error correction.'; e.hidden = false; blank('Too much data'); }
  }
  const out = (fn) => cv.toBlob(b => b ? fn(b) : toast('Could not make the image'), 'image/png');
  $('#t', el).onchange = fields;
  el.addEventListener('input', (ev) => { if (ev.target.id !== 't') draw(); });
  el.addEventListener('change', (ev) => { if (ev.target.id !== 't') draw(); });
  const send = (name) => out(async (b) => { if (await shareImageBlob(name, b, 'PocketKit code')) toast('Picture ready'); });
  $('#sv', el).onclick = () => send((type() === 'code128' || type() === 'ean13' ? 'barcode' : 'qr') + '-' + Date.now() + '.png');
  $('#sh', el).onclick = () => send('code.png');
  fields();
} });

/* ====================== 3. Notes ====================== */
reg({ id: 'notes', name: 'Notes', icon: '📝', desc: 'Quick notes with a title and body, search and pinning, stored only on this device.', keys: ['memo', 'jot', 'write', 'notepad'], needs: ['storage'], render(el) {
  const MAX_BODY = 50000, blank = (n) => !n.t.trim() && !n.b.trim();
  let items = Store.get('notes.items', []).filter(n => !blank(n)), cur = null, q = '', delArm = 0, timer = 0, warned = false;
  /* Saves are debounced (about 400 ms) and flushed on Done, on delete and when the tool is closed. localStorage is used directly
     (same "pk." prefix as Store) so a full disk can be reported once instead of on every keystroke. */
  const persist = () => {
    clearTimeout(timer); timer = 0;
    try { localStorage.setItem('pk.notes.items', JSON.stringify(items)); warned = false; }
    catch (e) { if (!warned) { warned = true; toast('Storage is full. Copy your note somewhere safe.'); } }
  };
  const later = () => { clearTimeout(timer); timer = setTimeout(persist, 400); };
  const rows = () => {
    const f = items.filter(n => !q || (n.t + ' ' + n.b).toLowerCase().includes(q)).sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || b.ts - a.ts);
    $('#lst', el).innerHTML = f.map(n => `<div class="item" data-id="${n.id}" role="button" tabindex="0"><div class="grow"><b>${n.pin ? '📌 ' : ''}${esc(n.t || 'Untitled')}</b><div class="muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(n.b.slice(0, 90) || 'Empty note')}</div></div><div class="muted" style="font-size:12px;flex:none">${new Date(n.ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</div></div>`).join('') || `<div class="muted center">${items.length ? 'No matches' : 'No notes yet. Tap New to start.'}</div>`;
  };
  const showList = () => {
    cur = null;
    el.innerHTML = `<div class="list"><div class="row"><input type="search" id="q" maxlength="100" placeholder="Search notes" aria-label="Search notes" value="${esc(q)}"><button class="btn" id="new" style="flex:none">+ New</button></div>
      <div class="muted">${items.length} note${items.length === 1 ? '' : 's'}${isPro() ? '' : ' (free plan: up to ' + proLimit('notes') + ')'}</div><div class="list" id="lst"></div>
      <button class="btn alt" id="exall">Export all notes (.md)</button></div>`;
    rows();
    $('#exall', el).onclick = () => {
      const all = items.filter(n => !blank(n));
      if (!all.length) { toast('No notes to export yet. Write one first.'); return; }
      sendFile('notes-' + today() + '.md', TX.notesMarkdown(all.slice().sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || b.ts - a.ts), today()), 'text/markdown', 'Exported ' + all.length + ' note' + (all.length === 1 ? '' : 's'));
    };
    $('#q', el).oninput = (e) => { q = e.target.value.toLowerCase(); rows(); };
    $('#new', el).onclick = () => {
      if (items.length >= proLimit('notes') && needPro('notes')) return;
      // the note only joins the list once something is typed, so tapping New and leaving leaves nothing behind
      edit({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), t: '', b: '', pin: false, ts: Date.now() }, true);
    };
    const open = (e) => { const it = e.target.closest('.item'); if (it) edit(items.find(x => x.id === it.dataset.id)); };
    $('#lst', el).onclick = open;
    $('#lst', el).onkeydown = (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('item')) { e.preventDefault(); open(e); } };
  };
  const edit = (n, isNew) => {
    if (!n) { showList(); return; }
    cur = n; delArm = 0;
    el.innerHTML = `<div class="list"><div class="row"><button class="btn alt" id="bk">‹ Done</button><button class="btn alt" id="pin"></button></div>
      <input id="t" type="text" maxlength="120" placeholder="Title" aria-label="Title" value="${esc(n.t)}">
      <textarea id="b" rows="12" maxlength="${MAX_BODY}" placeholder="Write something..." aria-label="Note text">${esc(n.b.slice(0, MAX_BODY))}</textarea>
      <div class="row"><button class="btn alt" id="cp">Copy</button><button class="btn alt" id="ex">Export (.md)</button><button class="btn danger" id="del">Delete</button></div></div>`;
    const pinTxt = () => { $('#pin', el).textContent = n.pin ? '📌 Pinned' : 'Pin'; };
    pinTxt();
    const touch = () => {
      n.t = $('#t', el).value.slice(0, 120); n.b = $('#b', el).value.slice(0, MAX_BODY); n.ts = Date.now();
      if (!items.includes(n) && !blank(n)) items.push(n);
      if (items.includes(n)) later();
    };
    $('#t', el).oninput = touch; $('#b', el).oninput = touch;
    $('#pin', el).onclick = () => { n.pin = !n.pin; if (items.includes(n)) persist(); pinTxt(); };
    $('#cp', el).onclick = () => copy((n.t ? n.t + '\n\n' : '') + n.b);
    $('#ex', el).onclick = () => {
      if (blank(n)) { toast('This note is empty, nothing to export.'); return; }
      sendFile('note-' + TX.fileSlug(n.t) + '-' + today() + '.md', TX.noteMarkdown(n), 'text/markdown', 'Note exported');
    };
    $('#bk', el).onclick = () => { items = items.filter(x => !blank(x)); persist(); showList(); };
    $('#del', el).onclick = () => {
      if (!delArm) { delArm = 1; $('#del', el).textContent = 'Tap again to delete'; setTimeout(() => { const b = $('#del', el); if (b) { delArm = 0; b.textContent = 'Delete'; } }, 2500); return; }
      items = items.filter(x => x !== n); persist(); showList();
    };
  };
  showList();
  return () => { items = items.filter(x => !blank(x)); persist(); };
} });

/* ====================== 4. Base64 and URL ====================== */
xform({ id: 'b64', name: 'Base64 & URL', icon: '🔣', desc: 'Encode and decode Base64 and URL text, safe for accents, emoji and any language.', keys: ['base64', 'url encode', 'percent', 'decode', 'utf-8'] }, [
  { n: 'Base64 encode', f: s => TX.b64enc(s), inv: 1 },
  { n: 'Base64 decode', f: s => TX.b64dec(s), inv: 0 },
  { n: 'Base64 URL-safe encode', f: s => TX.b64enc(s, true), inv: 1 },
  { n: 'URL encode', f: s => TX.urlenc(s), inv: 4 },
  { n: 'URL decode', f: s => TX.urldec(s), inv: 3 }
]);

/* ====================== 5. Text tools ====================== */
reg({ id: 'texttools', name: 'Text Tools', icon: '✍️', desc: 'Live word, character and sentence counts, plus case changes, reverse, clean-up, sort and dedupe lines.', keys: ['word count', 'character count', 'uppercase', 'lowercase', 'title case', 'sort lines', 'reverse', 'remove duplicates'], needs: [], render(el) {
  const acts = [['UPPER', s => s.toUpperCase()], ['lower', TX.lower], ['Title Case', TX.titleCase], ['Sentence case', TX.sentenceCase], ['Reverse', TX.reverseText],
    ['Fix spaces', TX.squeeze], ['Dedupe lines', TX.dedupeLines], ['Sort A-Z', s => TX.sortLines(s)], ['Sort Z-A', s => TX.sortLines(s, true)], ['No blank lines', TX.dropEmpty]];
  el.innerHTML = `<div class="list">${lbl('Your text', '<textarea id="i" rows="8" maxlength="500000" placeholder="Type or paste text"></textarea>')}
    <div class="card" id="st" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center"></div>
    <div style="${WRAP}">${acts.map((a, i) => `<button class="btn alt" data-a="${i}" style="${BTN}">${a[0]}</button>`).join('')}</div>
    <div class="row"><button class="btn" id="cp">Copy</button><button class="btn alt" id="un">Undo</button><button class="btn alt" id="cl">Clear</button></div></div>`;
  const ta = $('#i', el); let hist = [];
  const stats = () => {
    const s = ta.value, v = [['Words', TX.countWords(s)], ['Characters', [...s].length], ['No spaces', [...s.replace(/\s/g, '')].length], ['Sentences', TX.countSentences(s)], ['Lines', s ? s.split('\n').length : 0], ['Paragraphs', TX.countParas(s)]];
    $('#st', el).innerHTML = v.map(x => `<div><div class="mid" style="font-size:22px">${x[1]}</div><div class="muted" style="font-size:12px">${x[0]}</div></div>`).join('');
  };
  ta.oninput = stats;
  $$('[data-a]', el).forEach(b => { b.onclick = () => { hist.push(ta.value); if (hist.length > 30) hist.shift(); ta.value = acts[+b.dataset.a][1](ta.value); stats(); }; });
  $('#un', el).onclick = () => { if (hist.length) { ta.value = hist.pop(); stats(); } else toast('Nothing to undo'); };
  $('#cp', el).onclick = () => { if (ta.value) copy(ta.value); };
  $('#cl', el).onclick = () => { hist.push(ta.value); ta.value = ''; stats(); };
  stats();
} });

/* ====================== 6. Password ====================== */
reg({ id: 'password', name: 'Password Maker', icon: '🔑', desc: 'Create strong random passwords with your choice of length and characters, made with the secure random generator.', keys: ['generator', 'random', 'passphrase', 'secure'], needs: [], render(el) {
  const sv = Store.get('password.opts', { len: 16, upper: true, lower: true, digits: true, symbols: true, noAmb: false });
  const chk = (id, t) => `<label style="display:flex;gap:8px;align-items:center;min-height:44px"><input type="checkbox" id="${id}" style="flex:none"> ${t}</label>`;
  el.innerHTML = `<div class="list"><div class="card"><div class="mid" id="pw" style="${MONO};font-size:22px;min-height:60px;display:flex;align-items:center;justify-content:center"></div>
    <div class="progress" style="margin-top:10px"><i id="bar" style="width:0"></i></div><div class="muted center" id="sl" style="margin-top:6px"></div></div>
    <div class="row"><button class="btn" id="gen">Generate</button><button class="btn alt" id="cp">Copy</button></div>
    <div class="card list">${lbl('Length: <b id="lv">16</b>', '<input type="range" id="len" min="4" max="64">')}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 8px">${chk('upper', 'A-Z')}${chk('lower', 'a-z')}${chk('digits', '0-9')}${chk('symbols', '!@#$')}</div>${chk('noAmb', 'Avoid look-alikes (I l 1 O 0 o)')}</div></div>`;
  $('#len', el).value = sv.len; ['upper', 'lower', 'digits', 'symbols', 'noAmb'].forEach(k => { $('#' + k, el).checked = !!sv[k]; });
  const opts = () => ({ upper: $('#upper', el).checked, lower: $('#lower', el).checked, digits: $('#digits', el).checked, symbols: $('#symbols', el).checked, noAmb: $('#noAmb', el).checked });
  const gen = () => {
    const len = +$('#len', el).value, o = opts(); $('#lv', el).textContent = len; Store.set('password.opts', Object.assign({ len }, o));
    const p = TX.genPassword(len, o), s = TX.pwStrength(len, o), col = ['var(--danger)', 'var(--danger)', '#f59e0b', 'var(--ok)', 'var(--ok)'][s.lvl];
    $('#pw', el).textContent = p || 'Pick at least one option';
    const b = $('#bar', el); b.style.width = (p ? (s.lvl + 1) * 20 : 0) + '%'; b.style.background = col;
    $('#sl', el).textContent = p ? s.label + ' (about ' + s.bits + ' bits)' : '';
  };
  el.addEventListener('input', (e) => { if (e.target.id !== 'pw') gen(); });
  $('#gen', el).onclick = gen;
  $('#cp', el).onclick = () => { const p = $('#pw', el).textContent; if (p && !p.startsWith('Pick')) copy(p, 'Password copied'); };
  gen();
} });

/* ====================== 7. Roman numerals ====================== */
reg({ id: 'roman', name: 'Roman Numerals', icon: '🏛️', desc: 'Convert numbers 1 to 3999 to Roman numerals and Roman numerals back to numbers.', keys: ['roman', 'numeral', 'xiv', 'mcm'], needs: [], render(el) {
  el.innerHTML = `<div class="list">${lbl('Number (1-3999) or Roman numeral', '<input id="i" type="text" maxlength="20" pattern="[0-9IVXLCDMivxlcdm ]*" title="Digits 0-9, or the letters I V X L C D M" autocapitalize="characters" placeholder="e.g. 2024 or MMXXIV">')}
    <div class="card"><div class="big" id="o" style="font-size:40px;word-break:break-all">—</div><div class="center muted" id="n"></div></div>
    <button class="btn" id="cp">Copy result</button>
    <div class="card muted" style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;text-align:center">${[['I', 1], ['V', 5], ['X', 10], ['L', 50], ['C', 100], ['D', 500], ['M', 1000]].map(x => `<div><b style="color:var(--text)">${x[0]}</b> ${x[1]}</div>`).join('')}</div></div>`;
  const run = () => {
    const v = $('#i', el).value.trim(), o = $('#o', el), n = $('#n', el); n.textContent = '';
    if (!v) { o.textContent = '—'; return; }
    if (/^\d+$/.test(v)) { const r = TX.toRoman(+v); o.textContent = r || '—'; n.textContent = r ? '' : 'Use a whole number from 1 to 3999'; }
    else { const r = TX.fromRoman(v); o.textContent = r === null ? '—' : r; n.textContent = r === null ? 'Not a valid Roman numeral (letters I V X L C D M, up to 3999)' : ''; }
  };
  $('#i', el).oninput = run;
  $('#cp', el).onclick = () => { const t = $('#o', el).textContent; if (t !== '—') copy(t); };
} });

/* ====================== 8. Number bases ====================== */
reg({ id: 'bases', name: 'Number Bases', icon: '🔟', desc: 'Convert whole numbers between binary, octal, decimal, hex and any base from 2 to 36, with no size limit.', keys: ['binary', 'hex', 'octal', 'decimal', 'radix', 'base'], needs: [], render(el) {
  const opt = (a, b, sel) => { let s = ''; for (let i = a; i <= b; i++) s += `<option value="${i}"${i === sel ? ' selected' : ''}>${i}</option>`; return s; };
  el.innerHTML = `<div class="list">${lbl('Number', '<input id="i" type="text" maxlength="2000" autocapitalize="none" autocomplete="off" placeholder="e.g. 255 or FF">')}
    <div class="row">${lbl('From base', `<select id="f"><option value="2">2 (binary)</option><option value="8">8 (octal)</option><option value="10" selected>10 (decimal)</option><option value="16">16 (hex)</option><option value="0">Other...</option></select>`)}
    ${lbl('Custom base', `<select id="cf" disabled>${opt(2, 36, 7)}</select>`)}</div>
    <div class="status" id="e" hidden></div><div class="list" id="out"></div>
    ${lbl('Also show in base', `<select id="ct">${opt(2, 36, 36)}</select>`)}</div>`;
  const run = () => {
    const f = +$('#f', el).value || +$('#cf', el).value; $('#cf', el).disabled = !!+$('#f', el).value;
    const s = $('#i', el).value, e = $('#e', el), out = $('#out', el);
    if (!s.trim()) { e.hidden = true; out.innerHTML = ''; return; }
    const v = TX.parseBig(s, f);
    if (v === null) { e.textContent = 'That is not a valid base-' + f + ' number.'; e.hidden = false; out.innerHTML = ''; return; }
    e.hidden = true;
    const ct = +$('#ct', el).value, rows = [[2, 'Binary'], [8, 'Octal'], [10, 'Decimal'], [16, 'Hex'], [ct, 'Base ' + ct]];
    out.innerHTML = rows.map(r => `<div class="item"><div class="grow"><div class="muted" style="font-size:12px">${r[1]}</div><div style="${MONO}">${esc(TX.toBase(v, r[0]))}</div></div><button class="btn alt" data-c="${r[0]}" style="flex:none">Copy</button></div>`).join('');
    $$('[data-c]', out).forEach(b => { b.onclick = () => copy(TX.toBase(v, +b.dataset.c)); });
  };
  el.addEventListener('input', run); el.addEventListener('change', run);
} });

/* ====================== 9. JSON ====================== */
reg({ id: 'json', name: 'JSON Tool', icon: '🧪', desc: 'Pretty-print, minify and validate JSON, with the line and column of any mistake.', keys: ['format', 'beautify', 'minify', 'validate', 'lint'], needs: [], render(el) {
  el.innerHTML = `<div class="list">${lbl('JSON', '<textarea id="i" rows="11" maxlength="1000000" spellcheck="false" autocapitalize="none" placeholder=\'{"name": "PocketKit"}\' style="font-family:ui-monospace,Consolas,monospace;font-size:13px"></textarea>')}
    <div id="st" class="status info"></div>
    <div class="row"><select id="ind" aria-label="Indent"><option value="2">2 spaces</option><option value="4">4 spaces</option><option value="tab">Tab</option></select><button class="btn" id="pp">Pretty</button><button class="btn alt" id="mn">Minify</button></div>
    <div class="row"><button class="btn alt" id="va">Validate</button><button class="btn alt" id="cp">Copy</button><button class="btn alt" id="cl">Clear</button></div></div>`;
  const ta = $('#i', el), st = $('#st', el);
  const say = (m, ok) => { st.textContent = m; st.className = 'status' + (ok === true ? '' : ok === false ? '' : ' info'); st.style.color = ok === true ? 'var(--ok)' : ''; };
  const check = () => {
    const s = ta.value; if (!s.trim()) { say('Paste some JSON.'); return null; }
    const r = TX.jsonCheck(s);
    if (r.ok) { say('Valid JSON', true); return true; }
    const line = s.split('\n')[r.line - 1] || '', from = Math.max(0, r.col - 25);
    say(r.msg + ' at line ' + r.line + ', column ' + r.col + '\n' + line.slice(from, from + 50) + '\n' + ' '.repeat(r.col - 1 - from) + '^', false);
    st.style.whiteSpace = 'pre-wrap'; st.style.fontFamily = 'ui-monospace,Consolas,monospace';
    try { ta.focus(); ta.setSelectionRange(r.pos, Math.min(s.length, r.pos + 1)); } catch (e) { /* ignore */ }
    return false;
  };
  const apply = (ind) => { if (check()) ta.value = TX.jsonFormat(ta.value, ind); };
  $('#pp', el).onclick = () => apply($('#ind', el).value === 'tab' ? '\t' : ' '.repeat(+$('#ind', el).value));
  $('#mn', el).onclick = () => apply('');
  $('#va', el).onclick = check;
  $('#cp', el).onclick = () => { if (ta.value) copy(ta.value); };
  $('#cl', el).onclick = () => { ta.value = ''; say(''); };
} });

/* ====================== 10. Hash ====================== */
reg({ id: 'hash', name: 'Hash Maker', icon: '#️⃣', desc: 'Get the SHA-1, SHA-256, SHA-384 and SHA-512 hash of any text or file, and check it against a hash you were given.', keys: ['sha', 'sha256', 'checksum', 'digest', 'integrity'], needs: [], render(el) {
  const algs = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];
  el.innerHTML = `<div class="list">${lbl('Text', '<textarea id="i" rows="4" maxlength="200000" placeholder="Type text, or choose a file below"></textarea>')}
    ${lbl('Or a file (stays on this device)', '<input type="file" id="fl">')}
    <div class="list" id="out"></div>
    ${lbl('Compare with a hash you have', '<input id="cmp" type="text" maxlength="200" autocomplete="off" autocapitalize="none" placeholder="Paste a hash to compare">')}
    <div id="cr" class="center"></div></div>`;
  const MAX_FILE = 50e6; // bigger files are read into memory whole, so keep a sensible ceiling
  let res = {}, tok = 0, file = null, timer = 0;
  const hex = (buf) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  const show = () => {
    $('#out', el).innerHTML = algs.map(a => `<div class="item"><div class="grow"><div class="muted" style="font-size:12px">${a}</div><div style="${MONO};font-size:12px">${esc(res[a] || '')}</div></div><button class="btn alt" data-a="${a}" style="flex:none">Copy</button></div>`).join('');
    $$('[data-a]', el).forEach(b => { b.onclick = () => res[b.dataset.a] && copy(res[b.dataset.a]); });
    const c = $('#cmp', el).value.trim().toLowerCase().replace(/\s/g, ''), cr = $('#cr', el);
    if (!c) { cr.textContent = ''; return; }
    const hit = algs.find(a => res[a] === c);
    cr.innerHTML = hit ? `<b style="color:var(--ok)">Match: ${hit}</b>` : '<b style="color:var(--danger)">No match</b>';
  };
  const compute = async () => {
    const my = ++tok;
    if (!(window.crypto && crypto.subtle)) { $('#out', el).innerHTML = '<div class="status">Hashing is not available in this browser.</div>'; return; }
    if (file && file.size > MAX_FILE) { $('#out', el).innerHTML = '<div class="status">File too large (50 MB maximum). Choose a smaller file.</div>'; return; }
    let data;
    try { data = file ? await file.arrayBuffer() : enc.encode($('#i', el).value); } catch (e) { toast('Could not read the file'); return; }
    const r = {};
    try { for (const a of algs) r[a] = hex(await crypto.subtle.digest(a, data)); }
    catch (e) { if (my === tok) $('#out', el).innerHTML = '<div class="status">Could not calculate the hash for this input.</div>'; return; }
    if (my === tok) { res = r; show(); }
  };
  const later = () => { clearTimeout(timer); timer = setTimeout(compute, 120); };
  $('#i', el).oninput = () => { file = null; $('#fl', el).value = ''; later(); };
  $('#fl', el).onchange = (e) => { file = e.target.files[0] || null; if (file && file.size > MAX_FILE) { toast('File too large (50 MB maximum)'); $('#out', el).innerHTML = '<div class="status">File too large (50 MB maximum). Choose a smaller file.</div>'; file = null; $('#fl', el).value = ''; res = {}; return; } later(); };
  $('#cmp', el).oninput = show;
  compute();
  return () => { clearTimeout(timer); tok++; };
} });

/* ====================== 11. Colour ====================== */
reg({ id: 'colour', name: 'Colour Convert', icon: '🪁', desc: 'Convert colours between HEX, RGB and HSL with a colour picker and a live swatch.', keys: ['color', 'hex', 'rgb', 'hsl', 'picker', 'css'], needs: [], render(el) {
  const num = (id, t, max) => lbl(t, `<input id="${id}" type="number" min="0" max="${max}" inputmode="numeric">`);
  el.innerHTML = `<div class="list"><div id="sw" style="height:110px;border-radius:16px;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:22px"></div>
    <div class="row">${lbl('Pick', '<input id="pk" type="color" style="width:100%;height:48px;padding:2px;border:1px solid var(--line);border-radius:12px;background:var(--surface)">')}${lbl('HEX', '<input id="hx" type="text" maxlength="7" pattern="#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})" title="A colour such as #7C5CFF or 7C5CFF" autocapitalize="characters" placeholder="#RRGGBB">')}</div>
    <div class="row">${num('r', 'R', 255)}${num('g', 'G', 255)}${num('b', 'B', 255)}</div>
    <div class="row">${num('h', 'H (0-360)', 360)}${num('s', 'S %', 100)}${num('l', 'L %', 100)}</div>
    <div class="list" id="css"></div></div>`;
  const set = (rgb, skip = []) => {
    const hex = TX.rgbToHex(rgb), hsl = TX.rgbToHsl(rgb), put = (id, v) => { if (!skip.includes(id)) $('#' + id, el).value = v; };
    put('hx', hex); put('r', rgb[0]); put('g', rgb[1]); put('b', rgb[2]); put('h', hsl[0]); put('s', hsl[1]); put('l', hsl[2]); $('#pk', el).value = hex.toLowerCase();
    const sw = $('#sw', el); sw.style.background = hex; sw.style.color = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000 > 140 ? '#000' : '#fff'; sw.textContent = hex;
    const lines = [hex, `rgb(${rgb.join(', ')})`, `hsl(${hsl[0]}, ${hsl[1]}%, ${hsl[2]}%)`];
    $('#css', el).innerHTML = lines.map((t, i) => `<div class="item"><div class="grow" style="${MONO}">${esc(t)}</div><button class="btn alt" data-i="${i}" style="flex:none">Copy</button></div>`).join('');
    $$('[data-i]', el).forEach(b => { b.onclick = () => copy(lines[+b.dataset.i]); });
  };
  const n = (id) => clamp(Math.round(+$('#' + id, el).value) || 0, 0, 360);
  el.addEventListener('input', (e) => {
    const id = e.target.id;
    if (id === 'pk' || id === 'hx') { const c = TX.hexToRgb($(id === 'pk' ? '#pk' : '#hx', el).value); if (c) set(c, id === 'hx' ? ['hx'] : []); }
    else if ('rgb'.includes(id) && id.length === 1) set([n('r'), n('g'), n('b')].map(v => clamp(v, 0, 255)), [id]);
    else if ('hsl'.includes(id) && id.length === 1) set(TX.hslToRgb([n('h'), n('s'), n('l')]), ['h', 's', 'l']);
  });
  set([124, 92, 255]);
} });

/* ====================== Extra tools ====================== */
const chkRow = (id, t, on) => `<label style="display:flex;gap:8px;align-items:center;min-height:44px"><input type="checkbox" id="${id}"${on ? ' checked' : ''} style="flex:none"> ${t}</label>`;
const taArea = (id, label, rows, ph, extra = '') => lbl(label, `<textarea id="${id}" rows="${rows}" ${/maxlength/.test(extra) ? '' : 'maxlength="200000"'} placeholder="${esc(ph || '')}" ${extra}></textarea>`);

/* ---------- Lorem ipsum ---------- */
reg({ id: 'lorem', name: 'Lorem Ipsum', icon: '📜', desc: 'Generate placeholder paragraphs, sentences or words for mock-ups.', keys: ['placeholder', 'dummy text', 'filler', 'ipsum'], needs: [], render(el) {
  el.innerHTML = `<div class="list"><div class="row"><select id="u" aria-label="Unit"><option value="paragraphs">Paragraphs</option><option value="sentences">Sentences</option><option value="words">Words</option></select>
    <input id="n" type="number" min="1" max="100" value="3" aria-label="How many" inputmode="numeric"></div>
    ${chkRow('cl', 'Start with "Lorem ipsum dolor sit amet"', true)}
    ${taArea('o', 'Result', 10, '', 'readonly')}<div class="row"><button class="btn" id="g">Generate</button><button class="btn alt" id="cp">Copy</button></div></div>`;
  const gen = () => { $('#o', el).value = TX.lorem($('#u', el).value, +$('#n', el).value, undefined, $('#cl', el).checked); };
  $('#g', el).onclick = gen; $('#cp', el).onclick = () => { if ($('#o', el).value) copy($('#o', el).value); }; $('#u', el).onchange = gen; $('#n', el).oninput = gen; $('#cl', el).onchange = gen; gen();
} });

/* ---------- Text <-> binary / hex / decimal ---------- */
xform({ id: 'bytes', name: 'Binary & Hex', icon: '💾', desc: 'Turn text into binary, hex, decimal or octal bytes and back, with full Unicode support.', keys: ['binary', 'hex', 'ascii', 'decimal', 'octal', 'bytes', 'utf-8'] }, [
  { n: 'Text to binary', f: s => TX.toBytesStr(s, 2), inv: 1 }, { n: 'Binary to text', f: s => TX.fromBytesStr(s, 2), inv: 0 },
  { n: 'Text to hex', f: s => TX.toBytesStr(s, 16), inv: 3 }, { n: 'Hex to text', f: s => TX.fromBytesStr(s, 16), inv: 2 },
  { n: 'Text to decimal', f: s => TX.toBytesStr(s, 10), inv: 5 }, { n: 'Decimal to text', f: s => TX.fromBytesStr(s, 10), inv: 4 },
  { n: 'Text to octal', f: s => TX.toBytesStr(s, 8), inv: 7 }, { n: 'Octal to text', f: s => TX.fromBytesStr(s, 8), inv: 6 }
]);

/* ---------- Emoji & symbols ---------- */
const EMO = {
  'Smileys': '😀 grin|😃 smile|😄 happy|😁 beam|😆 laugh|😅 sweat|😂 joy lol|🤣 rofl|🙂 slight smile|😉 wink|😊 blush|😇 angel|😍 love eyes|🥰 hearts face|😘 kiss|😋 yum|😎 cool sunglasses|🤩 star struck|🥳 party|😏 smirk|😢 cry sad|😭 sob|😡 angry|😱 scream|😴 sleep|🤔 think|🙄 eye roll|😬 grimace|🤗 hug|🤫 shush|😷 mask sick|🤒 fever|🥵 hot|🥶 cold|😐 neutral|😮 surprised|🥺 pleading|😳 flushed|🤯 mind blown|🤪 crazy',
  'Gestures': '👍 thumbs up yes|👎 thumbs down no|👏 clap|🙌 raised hands|🙏 pray thanks please|👋 wave hello|✌️ peace victory|🤞 fingers crossed luck|👌 ok|🤝 handshake deal|💪 strong muscle|👀 eyes look|🧠 brain|❤️ heart love|💔 broken heart|💯 hundred|🔥 fire hot|✨ sparkles|🎉 party popper|🎂 cake birthday|💡 idea bulb|⭐ star|✅ check done|❌ cross no|⚠️ warning|❓ question|❗ exclamation',
  'Animals': '🐶 dog|🐱 cat|🐭 mouse|🐹 hamster|🐰 rabbit|🦊 fox|🐻 bear|🐼 panda|🐨 koala|🐯 tiger|🦁 lion|🐮 cow|🐷 pig|🐸 frog|🐵 monkey|🐔 chicken|🐧 penguin|🐦 bird|🦆 duck|🦉 owl|🐴 horse|🦄 unicorn|🐝 bee|🦋 butterfly|🐢 turtle|🐍 snake|🐙 octopus|🐬 dolphin|🐳 whale|🦈 shark|🐘 elephant|🦒 giraffe',
  'Food': '🍎 apple|🍌 banana|🍇 grapes|🍓 strawberry|🍉 watermelon|🍊 orange|🍋 lemon|🍑 peach|🥭 mango|🍍 pineapple|🥑 avocado|🍅 tomato|🥕 carrot|🌽 corn|🍞 bread|🧀 cheese|🍕 pizza|🍔 burger|🍟 fries|🌭 hot dog|🌮 taco|🍣 sushi|🍜 noodles ramen|🍩 donut|🍪 cookie|🍫 chocolate|🍦 ice cream|☕ coffee|🍵 tea|🍺 beer|🍷 wine|🥤 drink',
  'Travel': '🚗 car|🚕 taxi|🚌 bus|🚲 bike|🏍️ motorcycle|🚆 train|✈️ plane|🚀 rocket|🚢 ship|⛵ boat|🏠 house home|🏢 office|🏖️ beach|🏔️ mountain|🌋 volcano|🌍 earth world|🌙 moon|☀️ sun|⛅ cloud|🌧️ rain|⚡ lightning|❄️ snow|🌈 rainbow|🌊 wave sea',
  'Objects': '📱 phone|💻 laptop|⌚ watch|📷 camera|🔋 battery|🔌 plug|💰 money|💳 card|🎁 gift|🔑 key|🔒 lock|📌 pin|📎 paperclip|✏️ pencil|📝 memo note|📚 books|🎵 music note|🎧 headphones|🎮 game|⚽ football soccer|🏀 basketball|🏆 trophy|⏰ alarm clock|🔔 bell'
};
const SYM = {
  'Arrows': '← ↑ → ↓ ↔ ↕ ↖ ↗ ↘ ↙ ⇐ ⇒ ⇔ ↩ ↪ ➜ ➔ ⟵ ⟶ ⇧ ⇩',
  'Math': '± × ÷ ≠ ≈ ≤ ≥ ∞ √ ∑ ∏ ∫ ∂ ∆ π µ ° ‰ ² ³ ½ ¼ ¾ ∈ ∉ ∪ ∩ ⊂ ⊃ ∴ ∵ ∀ ∃ ¬ ∧ ∨',
  'Currency': '$ € £ ¥ ¢ ₹ ₽ ₩ ₪ ₫ ₺ ₿ ฿ ₦ ₱ ₴ ¤',
  'Greek': 'α β γ δ ε ζ η θ ι κ λ μ ν ξ ο π ρ σ τ υ φ χ ψ ω Α Β Γ Δ Θ Λ Ξ Π Σ Φ Ψ Ω',
  'Punctuation': '© ® ™ § ¶ † ‡ • … – — ‘ ’ “ ” « » ‹ › ¿ ¡ № ‽ ·',
  'Shapes': '★ ☆ ♥ ♦ ♣ ♠ ■ □ ▲ ▼ ● ○ ◆ ◇ ✓ ✔ ✗ ✘ ☀ ☁ ☂ ☎ ♪ ♫ ☮ ☯ ✿ ❀',
  'Box': '─ │ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼ ═ ║ ╔ ╗ ╚ ╝ █ ▓ ▒ ░',
  'Super/sub': '⁰ ¹ ² ³ ⁴ ⁵ ⁶ ⁷ ⁸ ⁹ ⁺ ⁻ ₀ ₁ ₂ ₃ ₄ ₅ ₆ ₇ ₈ ₉'
};
/* Plain-English names so a search such as "euro" or "heart" finds the sign. */
const SYMN = { '€': 'euro', '£': 'pound sterling', '¥': 'yen yuan', '¢': 'cent', '₹': 'rupee inr', '₽': 'ruble rouble', '₩': 'won', '₿': 'bitcoin', '₺': 'lira', '→': 'arrow right', '←': 'arrow left', '↑': 'arrow up', '↓': 'arrow down', '♥': 'heart love', '♦': 'diamond', '♣': 'club', '♠': 'spade', '★': 'star', '☆': 'star', '©': 'copyright', '®': 'registered', '™': 'trademark tm', '°': 'degree', '±': 'plus minus', '×': 'times multiply', '÷': 'divide division', '≠': 'not equal', '≤': 'less than or equal', '≥': 'greater than or equal', '≈': 'approximately', '∞': 'infinity', '√': 'square root', 'π': 'pi', 'µ': 'micro mu', '✓': 'check tick', '✔': 'check tick', '✗': 'cross', '✘': 'cross', '☀': 'sun', '☁': 'cloud', '☂': 'umbrella', '☎': 'telephone phone', '♪': 'music note', '♫': 'music notes', '☮': 'peace', '☯': 'yin yang', '•': 'bullet', '…': 'ellipsis', '–': 'en dash', '—': 'em dash', '½': 'half', '¼': 'quarter', '¾': 'three quarters', '²': 'squared', '³': 'cubed', '‰': 'per mille', '№': 'number', '¶': 'paragraph', '§': 'section' };
reg({ id: 'symbols', name: 'Emoji & Symbols', icon: '😀', desc: 'Pick emoji and special characters (arrows, maths, currency, Greek, box drawing) and copy them.', keys: ['emoji', 'special characters', 'unicode', 'arrows', 'greek', 'symbols', 'keyboard'], needs: [], render(el) {
  const items = [];
  Object.keys(EMO).forEach(g => EMO[g].split('|').forEach(e => { const i = e.indexOf(' '); items.push({ g, c: e.slice(0, i), k: e.slice(i + 1) + ' ' + g.toLowerCase() }); }));
  Object.keys(SYM).forEach(g => SYM[g].split(' ').forEach(c => items.push({ g, c, k: g.toLowerCase() + (SYMN[c] ? ' ' + SYMN[c] : '') })));
  const groups = Object.keys(EMO).concat(Object.keys(SYM));
  el.innerHTML = `<div class="list"><div class="row"><input id="buf" type="text" maxlength="500" aria-label="Your text" placeholder="Tap characters to add them here"><button class="btn" id="cp" style="flex:none">Copy</button><button class="btn alt" id="cl" style="flex:none">Clear</button></div>
    <input type="search" id="q" maxlength="50" placeholder="Search (e.g. heart, arrow, euro)" aria-label="Search">
    <select id="g" aria-label="Group">${groups.map(g => `<option>${g}</option>`).join('')}</select><div id="grid" style="${WRAP}"></div></div>`;
  const draw = () => {
    const q = $('#q', el).value.trim().toLowerCase(), g = $('#g', el).value;
    const f = q ? items.filter(x => x.k.includes(q) || x.c === q) : items.filter(x => x.g === g);
    $('#grid', el).innerHTML = f.map(x => `<button class="btn alt" data-c="${esc(x.c)}" aria-label="${esc(x.k)}" style="width:46px;height:46px;padding:0;font-size:24px;flex:none">${esc(x.c)}</button>`).join('') || '<div class="muted">Nothing found</div>';
  };
  $('#q', el).oninput = draw; $('#g', el).onchange = () => { $('#q', el).value = ''; draw(); };
  $('#grid', el).onclick = (e) => { const b = e.target.closest('[data-c]'); if (b) { const f = $('#buf', el); f.value += b.dataset.c; } };
  $('#cp', el).onclick = () => { if ($('#buf', el).value) copy($('#buf', el).value); };
  $('#cl', el).onclick = () => { $('#buf', el).value = ''; };
  draw();
} });

/* ---------- Fancy text ---------- */
reg({ id: 'fancy', name: 'Fancy Text', icon: '✨', desc: 'Restyle your text in bold, script, gothic, circled, upside-down and many more Unicode styles to paste anywhere.', keys: ['font', 'style', 'bold', 'italic', 'cursive', 'bubble', 'upside down', 'unicode'], needs: [], render(el) {
  el.innerHTML = `<div class="list">${lbl('Your text', '<input id="i" type="text" maxlength="200" value="Hello World">')}<div class="list" id="o"></div></div>`;
  const run = () => {
    const s = $('#i', el).value || 'Hello World';
    $('#o', el).innerHTML = Object.keys(TX.fancy).map((k, i) => `<div class="item"><div class="grow"><div class="muted" style="font-size:11px">${esc(k)}</div><div style="font-size:18px;word-break:break-word">${esc(TX.fancy[k](s))}</div></div><button class="btn alt" data-i="${i}" style="flex:none">Copy</button></div>`).join('');
  };
  $('#o', el).onclick = (e) => { const b = e.target.closest('[data-i]'); if (b) copy(TX.fancy[Object.keys(TX.fancy)[+b.dataset.i]]($('#i', el).value || 'Hello World')); };
  $('#i', el).oninput = run; run();
} });

/* ---------- Diff ---------- */
reg({ id: 'diff', name: 'Text Diff', icon: '🧿', desc: 'Compare two texts and see what was added and removed, by line, word or character.', keys: ['compare', 'difference', 'changes'], needs: [], render(el) {
  el.innerHTML = `<div class="list">${taArea('a', 'Original', 5, '')}${taArea('b', 'Changed', 5, '')}
    <select id="m" aria-label="Compare by"><option value="l">Compare by line</option><option value="w">Compare by word</option><option value="c">Compare by character</option></select>
    <div class="muted" id="sm"></div><div class="card" id="o" style="white-space:pre-wrap;word-break:break-word;min-height:48px"></div></div>`;
  const run = () => {
    const a = $('#a', el).value, b = $('#b', el).value, m = $('#m', el).value;
    const tok = (s) => m === 'l' ? (s ? s.split('\n') : []) : m === 'w' ? (s.match(/\s+|[^\s]+/g) || []) : [...s];
    const d = TX.diff(tok(a), tok(b)), o = $('#o', el);
    if (!d) { o.textContent = ''; $('#sm', el).textContent = 'Texts are too long to compare. Try a shorter pair, or compare by line.'; return; }
    const add = d.filter(x => x.t === '+').length, del = d.filter(x => x.t === '-').length;
    $('#sm', el).textContent = !a && !b ? '' : (add || del) ? add + ' added, ' + del + ' removed' : 'No differences';
    const G = 'background:rgba(34,197,94,.28)', R = 'background:rgba(239,68,68,.28);text-decoration:line-through';
    o.innerHTML = d.map(x => {
      const t = esc(x.v);
      if (m === 'l') return `<div style="${x.t === '+' ? G : x.t === '-' ? R : ''};padding:0 4px">${x.t === '+' ? '+ ' : x.t === '-' ? '- ' : '  '}${t || '&nbsp;'}</div>`;
      return x.t === '=' ? t : `<span style="${x.t === '+' ? G : R}">${t}</span>`;
    }).join('');
  };
  el.addEventListener('input', run); el.addEventListener('change', run);
} });

/* ---------- Regex tester / find & replace ---------- */
reg({ id: 'regex', name: 'Regex & Replace', icon: '📌', desc: 'Test regular expressions with highlighted matches and groups, and run find and replace.', keys: ['regular expression', 'find', 'replace', 'match', 'pattern'], needs: [], render(el) {
  el.innerHTML = `<div class="list"><div class="row"><input id="p" type="text" maxlength="500" placeholder="Pattern, e.g. (\\d+)-(\\w+)" aria-label="Pattern" autocapitalize="none" autocomplete="off" spellcheck="false" style="flex:3"><input id="f" type="text" maxlength="8" value="g" aria-label="Flags" autocapitalize="none" style="flex:1"></div>
    ${taArea('t', 'Test text', 5, '', 'maxlength="20000"')}<div class="status" id="e" hidden></div>
    <div class="muted" id="cnt"></div><div class="card" id="hl" style="white-space:pre-wrap;word-break:break-word;min-height:40px"></div><div class="list" id="ml"></div>
    ${lbl('Replace with (use $1, $2 for groups)', '<input id="r" type="text" maxlength="500" autocapitalize="none" autocomplete="off">')}<div class="muted" style="font-size:12px">Flags: g all matches, i ignore case, m multiline, s dot matches newline, u unicode. Without g only the first match is replaced.</div>
    ${taArea('ro', 'Result', 4, '', 'readonly')}<button class="btn" id="cp">Copy result</button></div>`;
  /* The match and the replace run together, once, in a Worker built from a Blob (works offline). A pattern that backtracks forever
     is stopped after about a second instead of freezing the app. Without Worker support it falls back to running in the page. */
  let worker = null, wurl = '', timer = 0, killer = 0, seq = 0;
  const kill = () => { clearTimeout(killer); if (worker) { worker.terminate(); worker = null; } if (wurl) { URL.revokeObjectURL(wurl); wurl = ''; } };
  const exec = (job, done, slow) => {
    kill(); const my = ++seq;
    const inline = () => { const r = TX.regexRun(job.p, job.f, job.t); done({ r, rep: r.error ? null : TX.regexReplace(job.p, job.f, job.t, job.r) }); };
    if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || !URL.createObjectURL) { inline(); return; }
    try {
      wurl = URL.createObjectURL(new Blob([TX.regexWorkerSource()], { type: 'text/javascript' }));
      worker = new Worker(wurl);
      worker.onmessage = (ev) => { if (my !== seq) return; kill(); done(ev.data); };
      worker.onerror = () => { if (my !== seq) return; kill(); inline(); };
      worker.postMessage(job);
      killer = setTimeout(() => { if (my === seq) { kill(); slow(); } }, 1000);
    } catch (x) { kill(); inline(); }
  };
  const later = () => { clearTimeout(timer); timer = setTimeout(run, 250); };
  const run = () => {
    const p = $('#p', el).value, f = $('#f', el).value, t = $('#t', el).value, e = $('#e', el), cnt = $('#cnt', el);
    e.hidden = true; $('#ml', el).innerHTML = ''; $('#hl', el).textContent = t; $('#ro', el).value = t; cnt.textContent = '';
    if (!p) { seq++; kill(); return; }
    cnt.textContent = 'Working...';
    exec({ p, f, t, r: $('#r', el).value }, (res) => show(res, t), () => { cnt.textContent = ''; e.textContent = 'Pattern too slow (stopped after 1 second). Try a simpler pattern.'; e.hidden = false; });
  };
  const show = (res, t) => {
    const e = $('#e', el), cnt = $('#cnt', el), r = res.r;
    if (r.error) { cnt.textContent = ''; e.textContent = r.error; e.hidden = false; return; }
    cnt.textContent = r.matches.length + ' match' + (r.matches.length === 1 ? '' : 'es') + (r.matches.length >= 500 ? ' (showing first 500)' : '');
    let pos = 0, html = '';
    r.matches.forEach(m => { if (!m.s) return; html += esc(t.slice(pos, m.i)) + '<mark style="background:var(--accent);color:var(--accent-t);border-radius:3px">' + esc(m.s) + '</mark>'; pos = m.i + m.s.length; });
    $('#hl', el).innerHTML = html + esc(t.slice(pos));
    $('#ml', el).innerHTML = r.matches.slice(0, 50).map((m, i) => `<div class="item"><div class="grow"><b>#${i + 1}</b> at ${m.i}: <span style="${MONO}">${esc(m.s) || '(empty)'}</span>${m.g.map((g, k) => `<div class="muted" style="font-size:12px">group ${k + 1}: ${g === undefined ? 'undefined' : esc(g)}</div>`).join('')}</div></div>`).join('');
    const rep = res.rep;
    $('#ro', el).value = !rep || rep.error ? '' : rep.out;
  };
  el.addEventListener('input', later);
  $('#cp', el).onclick = () => copy($('#ro', el).value);
  return () => { clearTimeout(timer); seq++; kill(); };
} });

/* ---------- Case styles ---------- */
xform({ id: 'cases', name: 'Case & Slug', icon: '🐍', desc: 'Convert text to slug, camelCase, PascalCase, snake_case, kebab-case, CONSTANT_CASE and dot.case.', keys: ['camel', 'snake', 'kebab', 'slug', 'pascal', 'url', 'variable'] }, [
  { n: 'URL slug', f: TX.slug }, { n: 'camelCase', f: TX.camel }, { n: 'PascalCase', f: TX.pascal }, { n: 'snake_case', f: TX.snake },
  { n: 'kebab-case', f: TX.kebab }, { n: 'CONSTANT_CASE', f: TX.constant }, { n: 'dot.case', f: TX.dotcase }
], { ph: 'e.g. My Great Blog Post Title' });

/* ---------- Number sorter ---------- */
const fnum = (v) => String(+v.toPrecision(12));
reg({ id: 'numsort', name: 'Number Sorter', icon: '🔀', desc: 'Sort a list of numbers, remove duplicates and see the count, sum, average, median, smallest and largest.', keys: ['sort', 'dedupe', 'average', 'median', 'sum', 'statistics'], needs: [], render(el) {
  el.innerHTML = `<div class="list">${taArea('i', 'Numbers (separated by spaces, new lines, or commas followed by a space)', 5, '5, 3, 9, 3, 1')}
    <div class="row"><select id="o" aria-label="Order"><option value="a">Smallest first</option><option value="d">Largest first</option></select>${chkRow('dd', 'Remove duplicates')}</div>
    ${taArea('r', 'Sorted', 4, '', 'readonly')}<div class="card" id="st" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center"></div><button class="btn" id="cp">Copy sorted</button></div>`;
  const run = () => {
    const pn = TX.parseNumsStrict($('#i', el).value);
    if (pn.bad !== null) { $('#r', el).value = ''; $('#st', el).innerHTML = '<div class="status" style="grid-column:1/-1">"' + esc(pn.bad.slice(0, 30)) + '" is not a number. Separate numbers with spaces or new lines.</div>'; return; }
    let a = pn.nums;
    if ($('#dd', el).checked) a = [...new Set(a)];
    a.sort((x, y) => x - y); if ($('#o', el).value === 'd') a.reverse();
    $('#r', el).value = a.map(fnum).join(', ');
    const s = TX.numStats(a);
    $('#st', el).innerHTML = s ? [['Count', s.n], ['Sum', fnum(s.sum)], ['Average', fnum(s.mean)], ['Median', fnum(s.median)], ['Smallest', fnum(s.min)], ['Largest', fnum(s.max)]].map(x => `<div><div class="mid" style="font-size:18px;word-break:break-all">${x[1]}</div><div class="muted" style="font-size:12px">${x[0]}</div></div>`).join('') : '<div class="muted" style="grid-column:1/-1">No numbers yet</div>';
  };
  el.addEventListener('input', run); el.addEventListener('change', run);
  $('#cp', el).onclick = () => { if ($('#r', el).value) copy($('#r', el).value); };
  run();
} });

/* ---------- CSV viewer ---------- */
reg({ id: 'csv', name: 'CSV Viewer', icon: '🪄', desc: 'Paste CSV to see it as a table or convert it to JSON.', keys: ['table', 'spreadsheet', 'json', 'comma', 'tsv'], needs: [], render(el) {
  el.innerHTML = `<div class="list">${taArea('i', 'CSV data', 6, 'name,age\nAda,36\nLin,29', 'spellcheck="false"')}
    <div class="row"><select id="d" aria-label="Separator"><option value="">Auto separator</option><option value=",">Comma</option><option value=";">Semicolon</option><option value="&#9;">Tab</option><option value="|">Pipe</option></select><select id="v" aria-label="View"><option value="t">Table</option><option value="j">JSON</option></select></div>
    ${chkRow('hd', 'First row is the header', true)}<div class="muted" id="sm"></div><div id="o"></div><button class="btn" id="cp">Copy JSON</button></div>`;
  let json = '';
  const run = () => {
    const s = $('#i', el).value, o = $('#o', el); json = '';
    if (!s.trim()) { o.innerHTML = ''; $('#sm', el).textContent = ''; return; }
    const d = $('#d', el).value || TX.detectDelim(s), rows = TX.parseCSV(s, d), hd = $('#hd', el).checked;
    if (!rows.length) { o.innerHTML = ''; return; }
    $('#sm', el).textContent = rows.length + ' rows, ' + rows.reduce((m, r) => Math.max(m, r.length), 0) + ' columns';
    json = JSON.stringify(TX.csvToJson(rows, hd), null, 2);
    if ($('#v', el).value === 'j') { o.innerHTML = `<textarea readonly rows="12" style="${MONO};font-size:13px">${esc(json)}</textarea>`; return; }
    const cell = (c, tag) => `<${tag} style="border:1px solid var(--line);padding:6px 8px;text-align:left;white-space:nowrap">${esc(c)}</${tag}>`;
    const body = (hd ? rows.slice(1) : rows).slice(0, 300);
    o.innerHTML = `<div style="overflow:auto;max-height:55vh;border-radius:12px"><table style="border-collapse:collapse;font-size:14px;background:var(--surface)">${hd ? '<tr>' + rows[0].map(c => cell(c, 'th')).join('') + '</tr>' : ''}${body.map(r => '<tr>' + r.map(c => cell(c, 'td')).join('') + '</tr>').join('')}</table></div>${rows.length > 300 ? '<div class="muted">Showing first 300 rows</div>' : ''}`;
  };
  el.addEventListener('input', run); el.addEventListener('change', run);
  $('#cp', el).onclick = () => { if (json) copy(json); else toast('Nothing to copy'); };
} });

/* ---------- Markdown ---------- */
reg({ id: 'markdown', name: 'Markdown View', icon: '📖', desc: 'Write Markdown and see a live preview: headings, bold, italic, lists, quotes, links and code.', keys: ['md', 'preview', 'format', 'readme'], needs: [], render(el) {
  el.innerHTML = `<style>.mdv h1,.mdv h2,.mdv h3,.mdv h4{margin:.6em 0 .3em;line-height:1.2}.mdv h1{font-size:24px}.mdv h2{font-size:20px}.mdv h3{font-size:17px}.mdv p,.mdv ul,.mdv ol{margin:.5em 0}.mdv code{background:var(--surface2);padding:1px 5px;border-radius:5px;font-family:ui-monospace,Consolas,monospace;font-size:.92em}.mdv pre{background:var(--surface2);padding:10px;border-radius:10px;overflow:auto}.mdv pre code{padding:0;background:none}.mdv blockquote{margin:.5em 0;padding:2px 12px;border-left:4px solid var(--accent);color:var(--muted)}.mdv hr{border:0;border-top:1px solid var(--line)}.mdv a{color:var(--accent)}</style>
    <div class="list">${taArea('i', 'Markdown', 8, '# Title\n\nSome **bold** and *italic* text.\n\n- item one\n- item two', 'spellcheck="false"')}<div class="card mdv" id="o" style="min-height:60px;word-break:break-word"></div><button class="btn alt" id="cp">Copy HTML</button></div>`;
  const run = () => { $('#o', el).innerHTML = TX.md($('#i', el).value); };
  $('#i', el).oninput = run; $('#cp', el).onclick = () => copy(TX.md($('#i', el).value));
  el.addEventListener('click', (e) => { const a = e.target.closest && e.target.closest('a'); if (a) e.preventDefault(); });
  run();
} });

/* ---------- Checklist ---------- */
reg({ id: 'checklist', name: 'Checklist', icon: '🔭', desc: 'A simple to-do list with tick boxes and a progress bar, saved on the device.', keys: ['todo', 'tasks', 'list', 'shopping', 'checklist'], needs: ['storage'], render(el) {
  let items = Store.get('todo.items', []);
  el.innerHTML = `<div class="list"><div class="row"><input id="i" type="text" maxlength="200" placeholder="Add an item" aria-label="New item"><button class="btn" id="add" style="flex:none">Add</button></div>
    <div class="progress"><i id="bar" style="width:0"></i></div><div class="muted center" id="sm"></div><div class="list" id="l"></div><button class="btn alt" id="cd">Clear ticked items</button></div>`;
  const save = () => Store.set('todo.items', items);
  const draw = () => {
    const done = items.filter(x => x.d).length;
    $('#bar', el).style.width = (items.length ? done / items.length * 100 : 0) + '%';
    $('#sm', el).textContent = items.length ? done + ' of ' + items.length + ' done' : 'Nothing here yet';
    $('#l', el).innerHTML = items.map((x, i) => `<div class="item"><label style="flex:none;display:flex;align-items:center;justify-content:center;width:44px;min-height:44px;margin:-8px 0 -8px -8px"><input type="checkbox" data-t="${i}" ${x.d ? 'checked' : ''} aria-label="Done: ${esc(x.t)}" style="width:26px;height:26px;margin:0"></label><div class="grow" style="word-break:break-word;${x.d ? 'text-decoration:line-through;opacity:.6' : ''}">${esc(x.t)}</div><button class="btn alt" data-x="${i}" aria-label="Delete ${esc(x.t)}" style="flex:none;min-width:44px">✕</button></div>`).join('');
  };
  const add = () => { const v = $('#i', el).value.trim(); if (!v) return; if (items.length >= 300) { toast('List is full (300 items)'); return; } items.push({ t: v, d: false }); $('#i', el).value = ''; save(); draw(); };
  $('#add', el).onclick = add; $('#i', el).onkeydown = (e) => { if (e.key === 'Enter') add(); };
  $('#l', el).onclick = (e) => {
    const x = e.target.closest('[data-x]'), t = e.target.closest('[data-t]');
    if (x) { items.splice(+x.dataset.x, 1); save(); draw(); } else if (t) { items[+t.dataset.t].d = t.checked; save(); draw(); }
  };
  $('#cd', el).onclick = () => { items = items.filter(x => !x.d); save(); draw(); };
  draw();
} });

/* ---------- Word frequency ---------- */
reg({ id: 'freq', name: 'Word Frequency', icon: '🗺️', desc: 'Count how often each word appears in a text and see the most used words.', keys: ['count words', 'most common', 'repeated', 'keywords'], needs: [], render(el) {
  el.innerHTML = `<div class="list">${taArea('i', 'Text', 6, 'Paste an article, speech or essay')}${chkRow('st', 'Skip common words (the, and, of ...)', true)}<div class="muted" id="sm"></div><div class="list" id="o"></div><button class="btn" id="cp">Copy list</button></div>`;
  let list = [];
  const run = () => {
    list = TX.wordFreq($('#i', el).value, { stop: $('#st', el).checked });
    const total = list.reduce((a, b) => a + b[1], 0), top = list.slice(0, 40), mx = top.length ? top[0][1] : 1;
    $('#sm', el).textContent = list.length ? total + ' words counted, ' + list.length + ' different' : '';
    $('#o', el).innerHTML = top.map(([w, c]) => `<div class="item"><div class="grow"><div>${esc(w)}</div><div class="progress" style="margin-top:4px"><i style="width:${Math.round(c / mx * 100)}%"></i></div></div><b>${c}</b></div>`).join('');
  };
  el.addEventListener('input', run); el.addEventListener('change', run);
  $('#cp', el).onclick = () => { if (list.length) copy(list.map(x => x[0] + '\t' + x[1]).join('\n')); };
} });

/* ---------- Reading time ---------- */
reg({ id: 'readtime', name: 'Reading Time', icon: '📚', desc: 'Estimate how long a text takes to read silently or to speak aloud.', keys: ['minutes', 'speech', 'speaking', 'words per minute', 'article'], needs: [], render(el) {
  el.innerHTML = `<div class="list">${taArea('i', 'Text', 7, 'Paste your text')}${lbl('Reading speed', '<select id="w"><option value="150">Slow (150 wpm)</option><option value="200" selected>Average (200 wpm)</option><option value="300">Fast (300 wpm)</option></select>')}
    <div class="row"><div class="card center"><div class="muted">Reading</div><div class="mid" id="r" style="font-size:20px">0 sec</div></div><div class="card center"><div class="muted">Speaking</div><div class="mid" id="s" style="font-size:20px">0 sec</div></div></div>
    <div class="muted center" id="n"></div></div>`;
  const run = () => {
    const words = TX.countWords($('#i', el).value);
    $('#r', el).textContent = TX.readTime(words, +$('#w', el).value).text; $('#s', el).textContent = TX.readTime(words, 130).text;
    $('#n', el).textContent = words + ' word' + (words === 1 ? '' : 's');
  };
  el.addEventListener('input', run); el.addEventListener('change', run); run();
} });

/* ---------- SMS / tweet counter ---------- */
reg({ id: 'smscount', name: 'SMS Counter', icon: '💬', desc: 'Count SMS segments (GSM and Unicode) and tweet length as you type.', keys: ['sms', 'text message', 'twitter', 'x', '280', '160', 'characters'], needs: [], render(el) {
  el.innerHTML = `<div class="list">${taArea('i', 'Message', 6, 'Type your message')}
    <div class="card"><div class="row"><div class="center"><div class="mid" id="sg">0</div><div class="muted">SMS parts</div></div><div class="center"><div class="mid" id="lf">160</div><div class="muted">left in this part</div></div></div><div class="muted center" id="en" style="margin-top:8px"></div></div>
    <div class="card"><div class="row"><div class="mid" id="tw" style="text-align:left">0 / 280</div></div><div class="progress" style="margin-top:8px"><i id="tb" style="width:0"></i></div><div class="muted" style="margin-top:6px">Links count as 23 characters. Emoji and many non-Latin characters count as 2.</div></div></div>`;
  const run = () => {
    const t = $('#i', el).value, s = TX.smsInfo(t), n = TX.tweetLen(t);
    $('#sg', el).textContent = s.segs; $('#lf', el).textContent = s.left;
    $('#en', el).textContent = s.units + (s.ucs ? ' units, Unicode (70 per part, 67 when joined)' : ' units, GSM-7 (160 per part, 153 when joined)');
    $('#tw', el).textContent = n + ' / 280'; $('#tw', el).style.color = n > 280 ? 'var(--danger)' : '';
    const b = $('#tb', el); b.style.width = Math.min(100, n / 2.8) + '%'; b.style.background = n > 280 ? 'var(--danger)' : '';
  };
  $('#i', el).oninput = run; run();
} });

/* ---------- Caesar cipher ---------- */
reg({ id: 'caesar', name: 'Caesar Cipher', icon: '🛰️', desc: 'Encode and decode with the Caesar and ROT13 ciphers, and see all 25 shifts to crack one.', keys: ['rot13', 'cipher', 'shift', 'encrypt', 'decrypt', 'secret'], needs: [], render(el) {
  el.innerHTML = `<div class="list"><div class="row"><select id="m" aria-label="Mode"><option value="1">Encode</option><option value="-1">Decode</option></select>${lbl('Shift (1-25)', '<input id="k" type="number" min="1" max="25" value="3" inputmode="numeric">')}<button class="btn alt" id="r13" style="flex:none">ROT13</button></div>
    ${taArea('i', 'Text', 4, '')}${taArea('o', 'Result', 4, '', 'readonly')}<div class="row"><button class="btn" id="cp">Copy</button><button class="btn alt" id="all">All 25 shifts</button></div><div class="list" id="al"></div></div>`;
  const key = () => clamp(Math.round(+$('#k', el).value) || 1, 1, 25);
  const run = () => { $('#o', el).value = TX.caesar($('#i', el).value, key() * +$('#m', el).value); if ($('#al', el).innerHTML) all(); };
  const all = () => { const s = $('#i', el).value.slice(0, 300); $('#al', el).innerHTML = Array.from({ length: 25 }, (_, i) => `<div class="item"><b style="width:28px">${i + 1}</b><div class="grow" style="${MONO}">${esc(TX.caesar(s, i + 1))}</div></div>`).join(''); };
  el.addEventListener('input', run); el.addEventListener('change', run);
  $('#r13', el).onclick = () => { $('#k', el).value = 13; run(); };
  $('#cp', el).onclick = () => { if ($('#o', el).value) copy($('#o', el).value); };
  $('#all', el).onclick = () => { if ($('#al', el).innerHTML) $('#al', el).innerHTML = ''; else all(); };
} });

/* ---------- Pig Latin, NATO, Braille, T9 ---------- */
xform({ id: 'piglatin', name: 'Pig Latin', icon: '🐷', desc: 'Turn English text into Pig Latin.', keys: ['language game', 'ay', 'fun'] }, [{ n: 'English to Pig Latin', f: TX.pig }], { ph: 'e.g. Hello world' });
xform({ id: 'nato', name: 'NATO Alphabet', icon: '🛩️', desc: 'Spell words with the NATO phonetic alphabet (Alfa, Bravo, Charlie) and decode it back.', keys: ['phonetic', 'alpha bravo', 'spelling', 'radio', 'icao'] }, [
  { n: 'Text to NATO words', f: TX.natoEnc, inv: 1, note: s => { const k = TX.natoLost(s); return k ? 'Unsupported characters ignored (' + k + '). Only letters and digits are spelled out.' : ''; } }, { n: 'NATO words to text', f: TX.natoDec, inv: 0 }
], { ph: 'e.g. Hello 42' });
xform({ id: 'braille', name: 'Braille', icon: '👆', desc: 'Convert English text to Unicode Braille (grade 1) and back.', keys: ['blind', 'dots', 'tactile', 'unicode'] }, [
  { n: 'Text to Braille', f: TX.toBraille, inv: 1, note: s => { const k = TX.brailleLost(s); return k ? 'Unsupported characters ignored (' + k + ').' : ''; } }, { n: 'Braille to text', f: TX.fromBraille, inv: 0 }
], { ph: 'e.g. Hello World 2024' });
xform({ id: 't9', name: 'Phone Keypad', icon: '☎️', desc: 'Convert text to old phone keypad taps (multi-tap or T9 digits) and decode keypad taps to text.', keys: ['t9', 'multitap', 'sms', 'nokia', 'keypad', 'texting'] }, [
  { n: 'Text to multi-tap', f: TX.multitapEnc, inv: 1, note: s => { const k = [...s.toLowerCase()].filter(c => c !== ' ' && !KEY_OF[c]).length; return k ? 'Skipped ' + k + ' character' + (k === 1 ? '' : 's') + ' with no key (only letters, space and . , ? ! - work).' : ''; } }, { n: 'Multi-tap to text', f: TX.multitapDec, inv: 0 }, { n: 'Text to T9 digits', f: TX.t9Digits }
], { ph: 'e.g. hello world', inLabel: 'Input (multi-tap: groups of digits separated by spaces, 0 = space)' });

/* ---------- Epoch time ---------- */
const rel = (ms) => {
  const s = Math.round(ms / 1000), a = Math.abs(s), u = [[31536000, 'year'], [2592000, 'month'], [86400, 'day'], [3600, 'hour'], [60, 'minute'], [1, 'second']];
  if (a < 1) return 'now';
  for (const [n, name] of u) if (a >= n) { const v = Math.floor(a / n); return s > 0 ? 'in ' + v + ' ' + name + (v > 1 ? 's' : '') : v + ' ' + name + (v > 1 ? 's' : '') + ' ago'; }
  return 'now';
};
reg({ id: 'epoch', name: 'Timestamp', icon: '📻', desc: 'Convert Unix timestamps (seconds or milliseconds) to dates and dates to timestamps, with a live clock.', keys: ['epoch', 'unix', 'time', 'date', 'iso', 'utc'], needs: [], render(el) {
  el.innerHTML = `<div class="list"><div class="card center"><div class="muted">Now (Unix seconds)</div><div class="big" id="now" style="font-size:36px"></div><button class="btn alt" id="cn">Copy</button></div>
    ${lbl('Timestamp to date', '<input id="ts" type="text" inputmode="decimal" maxlength="20" pattern="-?[0-9]+([.,][0-9]+)?" title="Digits only, for example 1700000000" placeholder="e.g. 1700000000 or 1700000000000">')}<div class="list" id="res"></div>
    ${lbl('Date to timestamp (your local time)', '<input id="dt" type="datetime-local" min="1900-01-01T00:00" max="2200-12-31T23:59">')}<div class="list" id="res2"></div></div>`;
  const row = (k, v) => `<div class="item"><div class="grow"><div class="muted" style="font-size:12px">${k}</div><div style="${MONO}">${esc(v)}</div></div><button class="btn alt" data-v="${esc(v)}" style="flex:none">Copy</button></div>`;
  const tick = () => { $('#now', el).textContent = Math.floor(Date.now() / 1000); };
  const conv = () => {
    const v = $('#ts', el).value.trim().replace(/^(-?\d+),(\d+)$/, '$1.$2'), o = $('#res', el);
    if (!v) { o.innerHTML = ''; return; }
    const n = Number(v), ms = TX.epochMs(n), d = new Date(ms);
    if (!/^-?\d+(\.\d+)?$/.test(v) || isNaN(d.getTime())) { o.innerHTML = '<div class="status">Enter a valid number</div>'; return; }
    o.innerHTML = row('UTC', d.toUTCString()) + row('Local', d.toLocaleString()) + row('ISO 8601', d.toISOString()) + row('Relative', rel(ms - Date.now()));
  };
  const back = () => {
    const v = $('#dt', el).value, o = $('#res2', el), d = new Date(v);
    if (!v || isNaN(d.getTime())) { o.innerHTML = ''; return; }
    o.innerHTML = row('Seconds', String(Math.floor(d.getTime() / 1000))) + row('Milliseconds', String(d.getTime())) + row('ISO 8601 (UTC)', d.toISOString());
  };
  el.addEventListener('input', (e) => { if (e.target.id === 'ts') conv(); else if (e.target.id === 'dt') back(); });
  el.addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) copy(b.dataset.v); });
  $('#cn', el).onclick = () => copy(String(Math.floor(Date.now() / 1000)));
  tick(); const iv = setInterval(tick, 1000);
  return () => clearInterval(iv);
} });

/* ---------- UUID ---------- */
reg({ id: 'uuid', name: 'UUID Maker', icon: '🪪', desc: 'Generate random version 4 UUIDs, one or many, ready to copy.', keys: ['guid', 'unique id', 'random id', 'identifier'], needs: [], render(el) {
  el.innerHTML = `<div class="list"><div class="row">${lbl('How many (1-50)', '<input id="n" type="number" min="1" max="50" value="5" inputmode="numeric">')}<div>${chkRow('up', 'UPPERCASE')}${chkRow('nd', 'No dashes')}</div></div>
    ${taArea('o', 'UUIDs', 8, '', 'readonly style="font-family:ui-monospace,Consolas,monospace;font-size:13px"')}<div class="row"><button class="btn" id="g">Generate</button><button class="btn alt" id="cp">Copy all</button></div></div>`;
  const gen = () => {
    const n = clamp(Math.round(+$('#n', el).value) || 1, 1, 50);
    let a = Array.from({ length: n }, TX.newUuid); if ($('#up', el).checked) a = a.map(x => x.toUpperCase()); if ($('#nd', el).checked) a = a.map(x => x.replace(/-/g, ''));
    $('#o', el).value = a.join('\n');
  };
  $('#g', el).onclick = gen; $('#cp', el).onclick = () => { if ($('#o', el).value) copy($('#o', el).value); }; el.addEventListener('change', gen); gen();
} });

/* ---------- Random picker / teams ---------- */
reg({ id: 'picker', name: 'Name Picker', icon: '🧬', desc: 'Pick a random name from a list or split everyone into fair random teams.', keys: ['random', 'draw', 'raffle', 'teams', 'groups', 'lottery', 'winner'], needs: ['storage'], render(el) {
  el.innerHTML = `<div class="list">${taArea('n', 'Names (one per line)', 6, 'Ann\nBen\nCara\nDev')}
    <div class="card center"><div class="mid" id="w" style="min-height:44px;word-break:break-word">?</div></div>
    <button class="btn" id="pk">Pick one</button>
    <div class="row">${lbl('Number of teams', '<select id="k">' + [2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => `<option>${i}</option>`).join('') + '</select>')}<button class="btn alt" id="tm" style="align-self:flex-end">Make teams</button></div><div class="list" id="o"></div></div>`;
  const ta = $('#n', el); ta.value = Store.get('picker.names', '');
  const names = () => ta.value.split('\n').map(s => s.trim()).filter(Boolean);
  let timer = 0;
  ta.oninput = () => Store.set('picker.names', ta.value.slice(0, 20000));
  $('#pk', el).onclick = () => {
    const a = names(); if (!a.length) { toast('Add some names first'); return; }
    clearInterval(timer); let i = 0; const win = a[secureInt(a.length)], w = $('#w', el);
    timer = setInterval(() => { i++; w.textContent = i >= 14 ? win : a[secureInt(a.length)]; if (i >= 14) { clearInterval(timer); timer = 0; if (navigator.vibrate) navigator.vibrate(60); } }, 80);
  };
  $('#tm', el).onclick = () => {
    const a = names(), k = +$('#k', el).value; if (a.length < 2) { toast('Add at least 2 names'); return; }
    const t = TX.teams(a, Math.min(k, a.length));
    $('#o', el).innerHTML = t.map((m, i) => `<div class="card"><b>Team ${i + 1}</b> <span class="muted">(${m.length})</span><div style="margin-top:4px;word-break:break-word">${m.map(esc).join(', ')}</div></div>`).join('');
  };
  return () => clearInterval(timer);
} });

/* ---------- Scratchpad ---------- */
reg({ id: 'scratch', name: 'Scratchpad', icon: '🌡️', desc: 'Keep short snippets you reuse often and copy any of them with one tap.', keys: ['clipboard', 'snippets', 'paste', 'saved text', 'copy'], needs: ['storage'], render(el) {
  let items = Store.get('scratch.items', []);
  el.innerHTML = `<div class="list">${taArea('i', 'New snippet', 3, 'Type or paste something to keep', 'maxlength="5000"')}<div class="row"><button class="btn" id="add">Save snippet</button><button class="btn alt" id="ps">Paste</button></div><div class="list" id="l"></div></div>`;
  const draw = () => {
    $('#l', el).innerHTML = items.map((t, i) => `<div class="item"><div class="grow" style="white-space:pre-wrap;word-break:break-word;max-height:4.5em;overflow:hidden">${esc(t)}</div><button class="btn" data-c="${i}" style="flex:none">Copy</button><button class="btn alt" data-x="${i}" aria-label="Delete snippet" style="flex:none;min-width:44px">✕</button></div>`).join('') || '<div class="muted center">No snippets yet</div>';
  };
  const add = (t) => { t = t.trim(); if (!t) return false; if (items.length >= 60) { toast('Scratchpad is full (60 snippets)'); return false; } items.unshift(t); Store.set('scratch.items', items); draw(); return true; };
  $('#add', el).onclick = () => { if (add($('#i', el).value)) $('#i', el).value = ''; };
  $('#ps', el).onclick = async () => {
    try { const t = await navigator.clipboard.readText(); if (t) $('#i', el).value = t.slice(0, 5000); else toast('Clipboard is empty'); }
    catch (e) { toast('Paste is not allowed here. Long-press the box to paste.'); }
  };
  $('#l', el).onclick = (e) => {
    const c = e.target.closest('[data-c]'), x = e.target.closest('[data-x]');
    if (c) copy(items[+c.dataset.c]); else if (x) { items.splice(+x.dataset.x, 1); Store.set('scratch.items', items); draw(); }
  };
  draw();
} });
})();
