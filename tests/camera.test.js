'use strict';
/* Pure-logic tests for the camera tools: barcode decoder on synthesized EAN-13 / EAN-8 / UPC-A / UPC-E / Code 128 images, colour names,
   perspective warp, black-and-white threshold, EXIF detection, dominant colours, size fitting. camera.js is loaded in a vm with stubs
   (it exports its pure helpers when `module` exists). Run: node tests/camera.test.js */
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'www', 'js', 'tools', 'camera.js'), 'utf8');
class ImageData { constructor(a, b, c) { if (typeof a === 'number') { this.width = a; this.height = b; this.data = new Uint8ClampedArray(a * b * 4); } else { this.data = a; this.width = b; this.height = c; } } }
const mod = { exports: {} };
vm.runInNewContext(SRC, { module: mod, Tools: { register() {} }, pad: (n, w) => String(n).padStart(w || 2, '0'), toast() {}, ImageData, console, Math, Uint8Array, Uint8ClampedArray, Float32Array, Float64Array, Map, Array, Object, JSON, Number, String, Date, isFinite, parseInt, Infinity, NaN });
const { BarDec, nearestName, quadMap, warpImage, adaptiveBW, exifInfo, dominantColors, fitSize, toHex } = mod.exports;
let ok = 0, bad = 0;
const check = (c, m) => { if (c) ok++; else { bad++; console.log('FAIL: ' + m); } };
const near = (a, b, tol, m) => check(Math.abs(a - b) <= tol, m + ' (got ' + a + ', expected ' + b + ' +/- ' + tol + ')');

/* ---------- independent barcode encoders (standard tables written out here, not read from the tool) ---------- */
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const PAR = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
const UPCE_PAR = ['EEEOOO', 'EEOEOO', 'EEOOEO', 'EEOOOE', 'EOEEOO', 'EOOEEO', 'EOOOEE', 'EOEOEO', 'EOEOOE', 'EOOEOE'];   // number system 0, by check digit; O = L code, E = G code
const d = (s) => Array.from(s, Number);
const ean13Check = (s) => { let t = 0; d(s).slice(0, 12).forEach((x, i) => { t += x * (i % 2 ? 3 : 1); }); return (10 - t % 10) % 10; };
const ean8Check = (s) => { let t = 0; d(s).slice(0, 7).forEach((x, i) => { t += x * (i % 2 ? 1 : 3); }); return (10 - t % 10) % 10; };
function encEan13(s) { const f = +s[0], p = PAR[f]; let b = '101'; for (let i = 0; i < 6; i++) b += (p[i] === 'L' ? L : G)[+s[1 + i]]; b += '01010'; for (let i = 0; i < 6; i++) b += R[+s[7 + i]]; return b + '101'; }
function encEan8(s) { let b = '101'; for (let i = 0; i < 4; i++) b += L[+s[i]]; b += '01010'; for (let i = 0; i < 4; i++) b += R[+s[4 + i]]; return b + '101'; }
function upceToUpcA(six, sys) {                       // expansion rules of the UPC-E standard
  const x = d(six); let body;
  if (x[5] <= 2) body = [x[0], x[1], x[5], 0, 0, 0, 0, x[2], x[3], x[4]];
  else if (x[5] === 3) body = [x[0], x[1], x[2], 0, 0, 0, 0, 0, x[3], x[4]];
  else if (x[5] === 4) body = [x[0], x[1], x[2], x[3], 0, 0, 0, 0, 0, x[4]];
  else body = [x[0], x[1], x[2], x[3], x[4], 0, 0, 0, 0, x[5]];
  return String(sys) + body.join('');
}
function encUpce(six, sys) {
  const a = upceToUpcA(six, sys), chk = ean13Check('0' + a + '0'); let b = '101';
  const pat = sys === 0 ? UPCE_PAR[chk] : UPCE_PAR[chk].replace(/[EO]/g, c => c === 'E' ? 'O' : 'E');
  for (let i = 0; i < 6; i++) b += (pat[i] === 'O' ? L : G)[+six[i]];
  return { bits: b + '010101', text: sys + six + chk };
}
/* Code 128: patterns as element widths. Taken from the tool's table, but first verified against the standard's structural rules and known entries. */
const C128 = SRC.match(/const C128 = '([0-9,]+)'/)[1].split(',');
function enc128(values) {          // values already include the start code; adds checksum and stop
  let sum = values[0]; for (let i = 1; i < values.length; i++) sum += values[i] * i;
  const all = values.concat([sum % 103, 106]); let bits = '', bar = true;
  for (const v of all) for (const ch of C128[v]) { bits += (bar ? '1' : '0').repeat(+ch); bar = !bar; }
  return bits;
}
const b128 = (text) => enc128([104].concat(Array.from(text, c => c.charCodeAt(0) - 32)));
const c128 = (digits) => { const v = [105]; for (let i = 0; i < digits.length; i += 2) v.push(+digits.slice(i, i + 2)); return enc128(v); };
const a128 = (text) => enc128([103].concat(Array.from(text, c => { const k = c.charCodeAt(0); return k < 32 ? k + 64 : k - 32; })));

/* ---------- picture synthesis: modules -> grey pixels, with scale, blur, noise, rotation, polarity ---------- */
let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7;
function render(bits, o) {
  o = o || {}; const m = o.m || 3, quiet = (o.quiet === undefined ? 12 : o.quiet) * m, W = o.W || (bits.length * m + 2 * quiet + 80), H = o.H || 120, ang = (o.angle || 0) * Math.PI / 180;
  const dark = o.invert ? 235 : 20, light = o.invert ? 20 : 235, lo = o.lo === undefined ? dark : dark + (light - dark) * o.lo, hi = o.hi === undefined ? light : light - (light - dark) * (o.hi);
  const cx = W / 2, cy = H / 2, len = bits.length * m, x0 = cx - len / 2, g = new Float32Array(W * H);
  const SS = 2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let acc = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const px = x + (sx + 0.5) / SS - cx, py = y + (sy + 0.5) / SS - cy, u = px * Math.cos(ang) + py * Math.sin(ang) + cx, v = -px * Math.sin(ang) + py * Math.cos(ang) + cy;
      let val = hi;
      if (v >= 8 && v <= H - 8 && u >= x0 && u < x0 + len) { const k = Math.floor((u - x0) / m); if (bits[o.flip ? bits.length - 1 - k : k] === '1') val = lo; }
      acc += val;
    }
    g[y * W + x] = acc / (SS * SS);
  }
  let out = g;
  if (o.blur) { out = new Float32Array(W * H); const r = o.blur; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0, n = 0; for (let k = -r; k <= r; k++) { const xx = Math.min(W - 1, Math.max(0, x + k)); s += g[y * W + xx]; n++; } out[y * W + x] = s / n; } }
  const u8 = new Uint8Array(W * H); for (let i = 0; i < u8.length; i++) u8[i] = Math.max(0, Math.min(255, Math.round(out[i] + (o.noise ? gauss() * o.noise : 0))));
  return { g: u8, W, H };
}
const scan = (bits, o, dense) => { const im = render(bits, o); return BarDec.scanGray(im.g, im.W, im.H, { dense: !!dense }); };
const expect = (r, type, text, label) => check(!!r && r.type === type && r.text === text, label + ' -> ' + (r ? r.type + ' ' + r.text : 'null'));

/* ---------- 1. The encoders and the check-digit rules agree with published values ---------- */
['4006381333931', '5901234123457', '9780201379624', '0012345678905'].forEach(s => check(ean13Check(s) === +s[12], 'published EAN-13 ' + s + ' has a valid check digit'));
['96385074', '73513537', '40170725'].forEach(s => check(ean8Check(s) === +s[7], 'published EAN-8 ' + s + ' has a valid check digit'));
check(ean13Check('036000291452') !== undefined && ean13Check('0' + '03600029145') === 2, 'UPC-A 036000291452 check digit 2');
check(C128.length === 107 && new Set(C128).size === 107, 'Code 128 table: 107 unique patterns');
check(C128.every((p, i) => p.length === (i === 106 ? 7 : 6) && Array.from(p, Number).reduce((a, b) => a + b, 0) === (i === 106 ? 13 : 11)), 'every Code 128 pattern spans 11 modules (stop 13)');
check(C128.every((p, i) => i === 106 || (+p[0] + +p[2] + +p[4]) % 2 === 0), 'Code 128 bars total an even number of modules in every character (the standard\'s parity rule)');
check(C128.every(p => Array.from(p, Number).every(x => x >= 1 && x <= 4)), 'Code 128 elements are 1 to 4 modules wide');
check(C128[0] === '212222' && C128[1] === '222122' && C128[103] === '211412' && C128[104] === '211214' && C128[105] === '211232' && C128[106] === '2331112', 'known entries: space, !, Start A/B/C, Stop');

/* ---------- 2. Decoder: EAN-13 ---------- */
['4006381333931', '5901234123457', '9780201379624'].forEach(s => { if (ean13Check(s) === +s[12]) expect(scan(encEan13(s)), 'EAN-13', s, 'EAN-13 ' + s + ' clean'); });
expect(scan(encEan13('4006381333931'), { m: 2 }), 'EAN-13', '4006381333931', 'EAN-13 at 2 px per module');
expect(scan(encEan13('4006381333931'), { m: 5 }), 'EAN-13', '4006381333931', 'EAN-13 at 5 px per module');
expect(scan(encEan13('4006381333931'), { m: 3, blur: 1 }), 'EAN-13', '4006381333931', 'EAN-13 blurred (3 px box on 3 px modules)');
expect(scan(encEan13('4006381333931'), { m: 4, blur: 2 }), 'EAN-13', '4006381333931', 'EAN-13 blurred (5 px box on 4 px modules)');
expect(scan(encEan13('4006381333931'), { m: 3, noise: 12 }), 'EAN-13', '4006381333931', 'EAN-13 with sensor noise');
expect(scan(encEan13('4006381333931'), { m: 3, flip: true }), 'EAN-13', '4006381333931', 'EAN-13 upside down');
expect(scan(encEan13('4006381333931'), { m: 3, invert: true }), 'EAN-13', '4006381333931', 'EAN-13 light bars on dark');
expect(scan(encEan13('4006381333931'), { m: 3, lo: 0.35, hi: 0.35 }), 'EAN-13', '4006381333931', 'EAN-13 low contrast (30% range)');
expect(scan(encEan13('4006381333931'), { m: 3, angle: 6 }), 'EAN-13', '4006381333931', 'EAN-13 tilted 6 degrees');
expect(scan(encEan13('4006381333931'), { m: 3, angle: -12 }), 'EAN-13', '4006381333931', 'EAN-13 tilted -12 degrees');
expect(scan(encEan13('4006381333931'), { m: 3, angle: 5, blur: 1, noise: 6 }, true), 'EAN-13', '4006381333931', 'EAN-13 tilted, blurred and noisy (dense scan)');
check(scan(encEan13('4006381333930')) === null, 'EAN-13 with a wrong check digit is rejected');
const bitsE = encEan13('4006381333931');
check(scan(bitsE.slice(0, 80)) === null, 'EAN-13 cut off in the middle gives null');
check(scan(bitsE, { m: 3, quiet: 0.3, W: bitsE.length * 3 + 2 }) === null || true, 'no quiet zone does not crash');

/* ---------- 3. UPC-A (an EAN-13 with a leading zero) ---------- */
expect(scan(encEan13('0036000291452')), 'UPC-A', '036000291452', 'UPC-A 036000291452');
expect(scan(encEan13('0012345678905')), 'UPC-A', '012345678905', 'UPC-A 012345678905');

/* ---------- 4. EAN-8 ---------- */
['96385074', '73513537', '40170725'].forEach(s => expect(scan(encEan8(s)), 'EAN-8', s, 'EAN-8 ' + s));
expect(scan(encEan8('96385074'), { m: 4, flip: true }), 'EAN-8', '96385074', 'EAN-8 upside down');
check(scan(encEan8('96385075')) === null, 'EAN-8 with a wrong check digit is rejected');

/* ---------- 5. UPC-E (weak format: needs agreement across scan lines) ---------- */
['123456', '654321', '012340', '420005', '000023', '123453', '123454', '123457', '123459'].forEach(six => {
  const e = encUpce(six, 0); expect(scan(e.bits, { m: 3, quiet: 14 }), 'UPC-E', e.text, 'UPC-E 0' + six);
});
{ const e = encUpce('123456', 1); expect(scan(e.bits, { m: 3, quiet: 14 }), 'UPC-E', e.text, 'UPC-E number system 1'); }

/* ---------- 6. Code 128 ---------- */
['PocketKit-42', 'Hello World', 'ab', 'ABC-abc-123', 'https://x.y/z?q=1', '~tilde~'].forEach(s => expect(scan(b128(s), { m: 3, quiet: 12 }), 'Code 128', s, 'Code 128 B "' + s + '"'));
['123456', '0000', '9876543210', '12345678901234'].forEach(s => expect(scan(c128(s), { m: 3 }), 'Code 128', s, 'Code 128 C "' + s + '"'));
expect(scan(a128('HELLO 42'), { m: 3 }), 'Code 128', 'HELLO 42', 'Code 128 A "HELLO 42"');
expect(scan(enc128([104, 33, 34, 35, 99, 12, 34, 56, 100, 23]), { m: 3 }), 'Code 128', 'ABC123456' + String.fromCharCode(23 + 32), 'Code 128 switching B to C and back to B');
expect(scan(b128('PocketKit-42'), { m: 2, blur: 1 }), 'Code 128', 'PocketKit-42', 'Code 128 at 2 px per module, blurred');
expect(scan(b128('PocketKit-42'), { m: 3, flip: true }), 'Code 128', 'PocketKit-42', 'Code 128 upside down');
expect(scan(b128('PocketKit-42'), { m: 3, angle: 8, noise: 8 }), 'Code 128', 'PocketKit-42', 'Code 128 tilted and noisy');
expect(scan(b128('PocketKit-42'), { m: 3, invert: true }), 'Code 128', 'PocketKit-42', 'Code 128 inverted');
{ const bits = b128('PocketKit-42'); const bad = bits.slice(0, 11 * 5) + (bits[11 * 5] === '1' ? '0' : '1') + bits.slice(11 * 5 + 1); check(scan(bad, { m: 3 }) === null || scan(bad, { m: 3 }).text !== 'PocketKit-42', 'Code 128 with a damaged module is not read as the original'); }
{ // wrong checksum
  const v = [104, 48, 49, 50, 51]; let sum = v[0]; for (let i = 1; i < v.length; i++) sum += v[i] * i; const bits = (() => { const all = v.concat([(sum + 1) % 103, 106]); let b = '', bar = true; for (const x of all) for (const ch of C128[x]) { b += (bar ? '1' : '0').repeat(+ch); bar = !bar; } return b; })();
  check(scan(bits, { m: 3 }) === null, 'Code 128 with a wrong checksum is rejected');
}

/* ---------- 7. Things that must NOT read as a code ---------- */
{
  const W = 400, H = 120; let g = new Uint8Array(W * H).fill(200); check(BarDec.scanGray(g, W, H) === null, 'blank grey picture: null');
  g = new Uint8Array(W * H).map(() => Math.floor(rnd() * 256)); check(BarDec.scanGray(g, W, H) === null, 'random noise: null');
  g = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g[y * W + x] = (Math.floor(x / 4) % 2) * 255; check(BarDec.scanGray(g, W, H) === null, 'regular stripes: null');
  g = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g[y * W + x] = x * 255 / W; check(BarDec.scanGray(g, W, H) === null, 'gradient: null');
  check(BarDec.scanGray(new Uint8Array(10 * 5), 10, 5) === null, 'tiny picture: null, no crash'); check(BarDec.scanGray(new Uint8Array(0), 0, 0) === null, 'empty picture: null, no crash');
  // 200 random "barcode-like" stripe pictures never produce a false read
  let falses = 0; for (let k = 0; k < 150; k++) { let bits = ''; const n = 60 + Math.floor(rnd() * 80); for (let i = 0; i < n; i++) bits += rnd() < 0.5 ? '1' : '0'; const r = scan(bits, { m: 3 }); if (r) { falses++; console.log('  false read:', r.type, r.text); } }
  check(falses === 0, 'random stripe patterns give no false barcode reads (' + falses + ' of 150)');
  const t = BarDec.toGray(new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]), 4, 1); check(t.join(',') === '76,149,28,255', 'toGray uses luma weights 77/150/29: ' + t.join(','));
}

/* ---------- 8. Colour names ---------- */
const NAMES = Object.fromEntries(SRC.match(/const COLOR_DATA = '([^']+)'/)[1].split(',').map(s => { const [n, x] = s.split(':'); return [x, n]; }));
const cdata = SRC.match(/const COLOR_DATA = '([^']+)'/)[1].split(',').map(s => s.split(':'));
check(new Set(cdata.map(c => c[1])).size === cdata.length, 'every named colour has its own value (' + cdata.length + ' colours)');
cdata.forEach(([n, x]) => { const r = parseInt(x.slice(0, 2), 16), g = parseInt(x.slice(2, 4), 16), b = parseInt(x.slice(4, 6), 16); if (nearestName(r, g, b) !== n) check(false, 'exact ' + n + ' #' + x + ' is named ' + nearestName(r, g, b)); else ok++; });
const known = [[255, 0, 0, 'Red'], [0, 0, 0, 'Black'], [255, 255, 255, 'White'], [0, 128, 0, 'Green'], [255, 165, 0, 'Orange'], [128, 0, 128, 'Purple'], [135, 206, 235, 'Sky Blue'], [250, 128, 114, 'Salmon'], [64, 224, 208, 'Turquoise'], [255, 192, 203, 'Pink'], [252, 4, 3, 'Red'], [8, 9, 12, 'Black'], [254, 254, 254, 'White'], [128, 128, 128, 'Gray'], [0, 0, 250, 'Blue'], [255, 255, 10, 'Yellow'], [10, 250, 12, 'Lime']];
known.forEach(([r, g, b, n]) => check(nearestName(r, g, b) === n, 'colour (' + r + ',' + g + ',' + b + ') is ' + n + ', got ' + nearestName(r, g, b)));
check(toHex(255, 0, 128) === '#FF0080' && toHex(300, -5, 0.5) === '#FF0001' && toHex(0, 0, 0) === '#000000' && toHex(171, 205, 239) === '#ABCDEF', 'toHex pads, clamps and upper-cases');

/* ---------- 9. Perspective warp ---------- */
{
  const m = quadMap([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 }]);
  [[0, 0, 0, 0], [1, 0, 100, 0], [1, 1, 100, 50], [0, 1, 0, 50], [0.5, 0.5, 50, 25], [0.25, 0.8, 25, 40]].forEach(([u, v, x, y]) => { const p = m(u, v); near(p[0], x, 1e-9, 'rectangle map x(' + u + ',' + v + ')'); near(p[1], y, 1e-9, 'rectangle map y(' + u + ',' + v + ')'); });
  const tr = quadMap([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 80, y: 100 }, { x: 20, y: 100 }]);
  [[0, 0, 0, 0], [1, 0, 100, 0], [1, 1, 80, 100], [0, 1, 20, 100]].forEach(([u, v, x, y]) => { const p = tr(u, v); near(p[0], x, 1e-9, 'trapezoid corner x'); near(p[1], y, 1e-9, 'trapezoid corner y'); });
  const c = tr(0.5, 0.5); near(c[0], 50, 1e-9, 'trapezoid centre x (diagonals cross at 50)'); near(c[1], 62.5, 1e-9, 'trapezoid centre y (diagonals cross at 62.5)');
  const par = quadMap([{ x: 10, y: 10 }, { x: 110, y: 20 }, { x: 120, y: 80 }, { x: 20, y: 70 }]); const pc = par(0.5, 0.5); near(pc[0], 65, 1e-9, 'parallelogram centre x'); near(pc[1], 45, 1e-9, 'parallelogram centre y');
  const res = [0, 0]; check(par(0, 0, res) === res && res[0] === 10, 'quadMap fills the array it is given');
  // identity warp: the whole picture mapped onto a same-size output leaves every pixel unchanged
  const w = 17, h = 11, src = new ImageData(w, h); for (let i = 0; i < w * h; i++) { src.data[i * 4] = (i * 7) % 256; src.data[i * 4 + 1] = (i * 13) % 256; src.data[i * 4 + 2] = (i * 29) % 256; src.data[i * 4 + 3] = 255; }
  const out = warpImage(src, w, h, [{ x: 0, y: 0 }, { x: w - 1, y: 0 }, { x: w - 1, y: h - 1 }, { x: 0, y: h - 1 }], w, h); let diff = 0; for (let i = 0; i < out.data.length; i++) diff = Math.max(diff, Math.abs(out.data[i] - src.data[i])); check(diff <= 1, 'identity warp reproduces the picture (max difference ' + diff + ')');
  // a 2x downscale picks the average between neighbours, and a half-picture crop shows the right half
  const half = warpImage(src, w, h, [{ x: 8, y: 0 }, { x: w - 1, y: 0 }, { x: w - 1, y: h - 1 }, { x: 8, y: h - 1 }], 9, h); check(half.data[0] === src.data[(0 * w + 8) * 4] && half.data[(8) * 4] === src.data[(0 * w + 16) * 4], 'cropping the right half starts at column 8');
  const flat = new ImageData(8, 8); flat.data.fill(77); const wf = warpImage(flat, 8, 8, [{ x: 1, y: 1 }, { x: 6, y: 2 }, { x: 5, y: 7 }, { x: 0, y: 6 }], 20, 20); check(wf.data.every(v => v === 77), 'warping a flat picture gives the same flat picture (no edge artefacts)');
}

/* ---------- 10. Black-and-white and grey ---------- */
{
  const mk = (w, h, f) => { const im = new ImageData(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = f(x, y), i = (y * w + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } return im; };
  let im = adaptiveBW(mk(60, 60, () => 128), false); check(im.data.every((v, i) => i % 4 === 3 ? v === 255 : v === 255), 'a uniform grey page becomes all white');
  // a dark line on a page whose lighting fades from 100 (left) to 250 (right)
  im = mk(120, 60, (x, y) => (y >= 28 && y < 32 && x > 10 && x < 110) ? 20 : 100 + x * 150 / 119); adaptiveBW(im, false);
  const px = (x, y) => im.data[(y * 120 + x) * 4]; check(px(30, 30) === 0 && px(100, 30) === 0, 'the line is black in both the dark and the bright part'); check(px(30, 10) === 255 && px(100, 10) === 255 && px(60, 50) === 255, 'the uneven background is white everywhere');
  check(im.data.every((v, i) => i % 4 === 3 ? v === 255 : (v === 0 || v === 255)), 'output is strictly black or white');
  const g = new ImageData(new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]), 4, 1); adaptiveBW(g, true); check(Array.from(g.data).join(',') === '76,76,76,255,149,149,149,255,28,28,28,255,255,255,255,255', 'grey mode uses luma 0.30/0.59/0.11 weights');
  check(adaptiveBW(new ImageData(1, 1), false) !== null, 'one pixel picture does not crash'); check(adaptiveBW(mk(5, 3, () => 0), false).data[0] === 255, 'a uniformly black picture has no dark-against-neighbours pixels, so it is white');
}

/* ---------- 11. EXIF detection ---------- */
{
  const u16 = (v, le) => le ? [v & 255, v >> 8] : [v >> 8, v & 255], u32 = (v, le) => le ? [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255] : [(v >>> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255];
  const exif = (tags, le, pre) => {
    const tiff = [].concat(le ? [0x49, 0x49] : [0x4D, 0x4D], u16(42, le), u32(8, le), u16(tags.length, le)); tags.forEach(t => { tiff.push(...u16(t, le), ...u16(4, le), ...u32(1, le), ...u32(0, le)); }); tiff.push(0, 0, 0, 0);
    const body = [0x45, 0x78, 0x69, 0x66, 0, 0].concat(tiff), seg = [0xFF, 0xE1].concat(u16(body.length + 2, false), body);
    return new Uint8Array([0xFF, 0xD8].concat(pre || [], seg, [0xFF, 0xDA, 0, 2])).buffer;
  };
  let e = exifInfo(exif([0x010F, 0x8825], false)); check(e.jpeg && e.exif && e.gps, 'big-endian EXIF with a GPS tag: GPS found');
  e = exifInfo(exif([0x010F, 0x0110], false)); check(e.jpeg && e.exif && !e.gps, 'EXIF with camera make/model only: no GPS');
  e = exifInfo(exif([0x0110, 0x8825, 0x9003], true)); check(e.jpeg && e.exif && e.gps, 'little-endian EXIF with a GPS tag: GPS found');
  e = exifInfo(exif([0x0110], true)); check(e.exif && !e.gps, 'little-endian EXIF without GPS');
  const jfif = [0xFF, 0xE0, 0, 16, 0x4A, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]; e = exifInfo(exif([0x8825], false, jfif)); check(e.exif && e.gps, 'EXIF after a JFIF header is found');
  e = exifInfo(new Uint8Array([0xFF, 0xD8, 0xFF, 0xDA, 0, 2, 1, 2]).buffer); check(e.jpeg && !e.exif && !e.gps, 'JPEG with no metadata');
  const segm = (m, txt) => { const b = Array.from(txt, c => c.charCodeAt(0)); return [0xFF, m, (b.length + 2) >> 8, (b.length + 2) & 255].concat(b); };
  e = exifInfo(new Uint8Array([0xFF, 0xD8].concat(segm(0xE1, 'http://ns.adobe.com/xap/1.0/\0<x/>'), [0xFF, 0xDA, 0, 2]) ).buffer); check(e.jpeg && !e.exif && e.other, 'XMP-only JPEG: no EXIF but other embedded data');
  e = exifInfo(new Uint8Array([0xFF, 0xD8].concat(segm(0xED, 'Photoshop 3.0\0'), [0xFF, 0xDA, 0, 2])).buffer); check(!e.exif && e.other, 'Photoshop/IPTC block counts as other embedded data');
  e = exifInfo(new Uint8Array([0xFF, 0xD8].concat(segm(0xFE, 'a comment'), [0xFF, 0xDA, 0, 2])).buffer); check(!e.exif && e.other, 'a JPEG comment counts as other embedded data');
  e = exifInfo(new Uint8Array([0xFF, 0xD8].concat(segm(0xE0, 'JFIF\0abcdefgh'), [0xFF, 0xDA, 0, 2])).buffer); check(!e.exif && !e.other, 'a plain JFIF header is not metadata');
  e = exifInfo(new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0, 0, 0, 0]).buffer); check(!e.jpeg && !e.exif, 'PNG is not a JPEG');
  e = exifInfo(new Uint8Array(0).buffer); check(!e.jpeg, 'empty file is not a JPEG, no crash'); e = exifInfo(new Uint8Array([0xFF, 0xD8]).buffer); check(!e.jpeg || !e.exif, 'two bytes: no crash');
  const tr = new Uint8Array(exif([0x8825], false)).slice(0, 24).buffer; let threw = false; try { exifInfo(tr); } catch (x) { threw = true; } check(!threw, 'a truncated EXIF block does not throw');
  const junk = new Uint8Array(200).map((_, i) => (i * 37) % 256); junk[0] = 0xFF; junk[1] = 0xD8; threw = false; try { exifInfo(junk.buffer); } catch (x) { threw = true; } check(!threw, 'random bytes after a JPEG header do not throw');
}

/* ---------- 12. Dominant colours and sizing ---------- */
{
  const px = (r, g, b, a) => [r, g, b, a === undefined ? 255 : a], mk = (arr) => new Uint8ClampedArray([].concat(...arr));
  const data = mk([].concat(Array(60).fill(px(250, 0, 0)), Array(40).fill(px(0, 0, 250))));
  let c = dominantColors(data, 6); check(c.length === 2 && c[0].r > 240 && c[0].b < 20 && c[1].b > 240, 'red (60%) then blue (40%): ' + JSON.stringify(c));
  c = dominantColors(mk([].concat(Array(30).fill(px(250, 0, 0)), Array(30).fill(px(244, 6, 6)), Array(10).fill(px(0, 250, 0)))), 6); check(c.length === 2, 'two similar reds merge into one swatch');
  c = dominantColors(mk([].concat(Array(50).fill(px(0, 0, 0, 0)), Array(5).fill(px(10, 200, 10)))), 6); check(c.length === 1 && c[0].g > 190, 'transparent pixels are ignored');
  const many = []; for (let i = 0; i < 16; i++) for (let k = 0; k < 4; k++) many.push(px(i * 16, 255 - i * 16, (i * 37) % 256)); check(dominantColors(mk(many), 4).length === 4, 'the count limit is respected');
  check(dominantColors(new Uint8ClampedArray(0), 6).length === 0, 'no pixels: no colours');
  check(fitSize(4000, 3000, 1600).join() === '1600,1200' && fitSize(3000, 4000, 1600).join() === '1200,1600' && fitSize(100, 50, 0).join() === '100,50' && fitSize(100, 50, 200).join() === '100,50' && fitSize(1, 1, 1600).join() === '1,1' && fitSize(10000, 1, 100).join() === '100,1' && fitSize(1, 10000, 100).join() === '1,100', 'fitSize keeps proportions, never enlarges, never reaches 0');
}


/* ---------- 13. QR codes through the vendored jsQR (what Code Scanner uses first) ---------- */
{
  const vend = path.join(__dirname, '..', 'www', 'js', 'vendor');
  const jsQR = require(path.join(vend, 'jsQR.js'));
  const qrsrc = fs.readFileSync(path.join(vend, 'qrcode.js'), 'utf8');
  const qrcode = new Function(qrsrc + '; return qrcode;')();
  const draw = (text, scale, ecl, margin) => {
    const q = qrcode(0, ecl || 'M'); q.addData(text); q.make(); const n = q.getModuleCount(), M = margin === undefined ? 4 : margin, W = (n + 2 * M) * scale, px = new Uint8ClampedArray(W * W * 4);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const mx = Math.floor(x / scale) - M, my = Math.floor(y / scale) - M, dk = mx >= 0 && my >= 0 && mx < n && my < n && q.isDark(my, mx), v = dk ? 0 : 255, i = (y * W + x) * 4; px[i] = px[i + 1] = px[i + 2] = v; px[i + 3] = 255; }
    return { px, W };
  };
  ['https://example.com/a?b=1&c=2', 'Hello', 'WIFI:T:WPA;S:Home;P:secret pass;;', '1234567890', 'x'.repeat(300), 'BEGIN:VCARD\nFN:Ann\nEND:VCARD'].forEach(t => {
    for (const [scale, ecl] of [[3, 'M'], [5, 'L'], [8, 'H']]) { const im = draw(t, scale, ecl), r = jsQR(im.px, im.W, im.W); check(!!r && r.data === t, 'QR "' + t.slice(0, 20) + '" scale ' + scale + ' level ' + ecl + ' -> ' + (r ? r.data.slice(0, 20) : 'null')); }
  });
  { const im = draw('Hallo Welt', 4, 'M'); const r = jsQR(im.px, im.W, im.W); check(r && r.data === 'Hallo Welt', 'plain text QR'); }
  { const im = draw('https://example.com', 4, 'M'); const blank = new Uint8ClampedArray(im.px.length).fill(255); check(jsQR(blank, im.W, im.W) === null, 'blank picture has no QR'); const noise = im.px.map((v, i) => i % 4 === 3 ? 255 : Math.floor(rnd() * 256)); check(jsQR(noise, im.W, im.W) === null, 'noise has no QR'); }
}

console.log((bad ? 'FAILED' : 'passed') + ' [camera logic]: ' + ok + ' checks ok' + (bad ? ', ' + bad + ' failed' : ''));
process.exit(bad ? 1 : 0);
