'use strict';
/* Pure-logic tests for the PDF tools (www/js/tools/pdf.js + vendored pdf-lib). Plain Node, no network.  Run: node tests/pdf.test.js */
const fs = require('fs'), path = require('path'), vm = require('vm'), zlib = require('zlib');
const ROOT = path.join(__dirname, '..', 'www', 'js');
/* Load into this Node realm (the library checks instanceof Array, so a separate vm realm would break). */
const ctx = global; ctx.self = ctx; ctx.window = ctx; ctx.Tools = { register() {} };
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'vendor', 'pdf-lib.min.js'), 'utf8'));
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'tools', 'pdf.js'), 'utf8'));
const { PDFDocument, degrees, StandardFonts } = ctx.PDFLib, K = ctx.PdfKit;

let fails = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log('FAIL: ' + m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')');
const near = (a, b, m) => ok(Math.abs(a - b) < 0.6, m + ' (got ' + a + ', want ' + b + ')');

/* Tiny valid PNG (solid colour) and JPEG test images. */
function crc32(buf) { let c, crc = ~0; for (let i = 0; i < buf.length; i++) { c = (crc ^ buf[i]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xEDB88320 : c >>> 1; crc = (crc >>> 8) ^ c; } return ~crc >>> 0; }
function png(w, h) {
  const chunk = (t, d) => { const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length, 0); b.write(t, 4); d.copy(b, 8); b.writeUInt32BE(crc32(b.slice(4, 8 + d.length)), 8 + d.length); return b; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { raw[y * (w * 3 + 1) + 1 + x * 3] = 200; raw[y * (w * 3 + 1) + 2 + x * 3] = 60; }
  return new Uint8Array(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
/* A JPEG with only the header pdf-lib needs to read the size (pdf-lib does not decode the pixels). */
function jpeg(w, h) {
  const sof = Buffer.alloc(15); sof.writeUInt16BE(0xFFC0, 0); sof.writeUInt16BE(11, 2); sof[4] = 8; sof.writeUInt16BE(h, 5); sof.writeUInt16BE(w, 7); sof[9] = 1; sof[10] = 1; sof[11] = 0x11; sof[12] = 0;
  return new Uint8Array(Buffer.concat([Buffer.from([0xFF, 0xD8]), sof.slice(0, 13), Buffer.from([0xFF, 0xD9])]));
}
const arr = (...x) => x;
const load = (bytes) => PDFDocument.load(bytes);
const sizes = (d) => d.getPages().map(p => { const s = p.getSize(); return [Math.round(s.width), Math.round(s.height)]; });

/* A PDF whose page i has width 100+i, so page order can be tracked. */
async function marked(count) { const d = await PDFDocument.create(); for (let i = 0; i < count; i++) d.addPage(arr(100 + i, 200)); return new Uint8Array(await d.save()); }
const order = (d) => d.getPages().map(p => Math.round(p.getWidth()) - 100);

(async () => {
  /* ---- range parser ---- */
  eq(K.parseRanges('1-3,5,7-9', 10).pages, [0, 1, 2, 4, 6, 7, 8], 'ranges 1-3,5,7-9');
  eq(K.parseRanges(' 2 , 4-4 ', 5).pages, [1, 3], 'ranges with spaces');
  eq(K.parseRanges('3,1,3', 5).pages, [2, 0], 'ranges keep order, drop repeats');
  eq(K.parseRanges('1,2;3 4', 5).pages, [0, 1, 2, 3], 'ranges mixed separators');
  ok(!K.parseRanges('', 5).ok, 'empty range rejected');
  ok(!K.parseRanges('abc', 5).ok, 'letters rejected');
  ok(!K.parseRanges('1-', 5).ok, 'open range rejected');
  ok(!K.parseRanges('0', 5).ok, 'page 0 rejected');
  ok(!K.parseRanges('1-6', 5).ok && /does not exist/.test(K.parseRanges('1-6', 5).error), 'out of range rejected');
  ok(!K.parseRanges('6', 5).ok, 'single out of range rejected');
  ok(!K.parseRanges('5-3', 9).ok && /backwards/.test(K.parseRanges('5-3', 9).error), 'reversed range rejected');
  ok(!K.parseRanges('-3', 9).ok, 'negative rejected');
  ok(!K.parseRanges('99999999999', 9).ok, 'huge number rejected');
  ok(!K.parseRanges(null, 9).ok, 'null rejected');

  /* ---- images to PDF ---- */
  const imgs = [{ bytes: png(40, 20), kind: 'png' }, { bytes: jpeg(20, 40), kind: 'jpg' }, { bytes: png(10, 10), kind: 'png' }];
  let d = await load(await K.buildImagesPdf(imgs, { page: 'a4', margin: 10, fit: 'contain' }));
  eq(d.getPageCount(), 3, 'images: 3 pages');
  eq(sizes(d), [[842, 595], [595, 842], [595, 842]], 'images: A4 with landscape for wide image');
  d = await load(await K.buildImagesPdf(imgs, { page: 'letter', margin: 0, fit: 'cover' }));
  eq(sizes(d), [[792, 612], [612, 792], [612, 792]], 'images: Letter sizes');
  d = await load(await K.buildImagesPdf(imgs, { page: 'fit', margin: 0, fit: 'contain' }));
  eq(sizes(d), [[30, 15], [15, 30], [8, 8]], 'images: fit-to-image sizes');
  d = await load(await K.buildImagesPdf(imgs, { page: 'fit', margin: 10, fit: 'contain' }));
  near(d.getPage(0).getWidth(), 40 * 0.75 + 2 * 10 * 72 / 25.4, 'images: fit with margin width');
  d = await load(await K.buildImagesPdf([{ bytes: png(3000, 100), kind: 'png' }], { page: 'fit', margin: 0 }));
  ok(d.getPage(0).getWidth() <= 14400, 'images: huge page capped');

  /* ---- merge ---- */
  const A = await marked(3), B = await marked(2);
  const src = (name, bytes) => ({ name, getBytes: async () => bytes });
  d = await load(await K.mergePdfs([src('a', A), src('b', B), src('c', A)]));
  eq(d.getPageCount(), 8, 'merge: page counts add up');
  eq(order(d), [0, 1, 2, 0, 1, 0, 1, 2], 'merge: order kept');
  let err = '';
  try { await K.mergePdfs([src('a', A), src('bad.pdf', new Uint8Array([1, 2, 3, 4]))]); } catch (e) { err = e.message; }
  ok(/bad\.pdf: That file is not a PDF/.test(err), 'merge: names the bad file (' + err + ')');

  /* ---- extract / delete / rotate / reorder via plan ---- */
  const src5 = await load(await marked(5));
  const plan = [0, 1, 2, 3, 4].map(i => ({ i, rot: 0 }));
  d = await load(await K.buildFromPlan(src5, [plan[1], plan[3]]));
  eq(order(d), [1, 3], 'extract 2 and 4');
  d = await load(await K.buildFromPlan(src5, plan.filter(p => p.i !== 0 && p.i !== 4)));
  eq(order(d), [1, 2, 3], 'delete first and last');
  d = await load(await K.buildFromPlan(src5, [plan[4], plan[0], plan[2]]));
  eq(order(d), [4, 0, 2], 'reorder');
  d = await load(await K.buildFromPlan(src5, [{ i: 0, rot: 90 }, { i: 1, rot: 0 }, { i: 2, rot: 270 }, { i: 3, rot: 180 }, { i: 4, rot: 450 }]));
  eq(d.getPages().map(p => p.getRotation().angle), [90, 0, 270, 180, 90], 'rotation values');
  /* rotation adds to what the page already has */
  const pre = await PDFDocument.create(); const pg = pre.addPage(arr(100, 200)); pg.setRotation(degrees(90));
  const r2 = await load(await K.buildFromPlan(await load(await pre.save()), [{ i: 0, rot: 270 }]));
  eq(r2.getPage(0).getRotation().angle, 0, 'rotation adds to existing (90 + 270 = 0)');
  /* split: first 2 and rest */
  const a = await load(await K.buildFromPlan(src5, plan.slice(0, 2))), b = await load(await K.buildFromPlan(src5, plan.slice(2)));
  eq([a.getPageCount(), b.getPageCount()], [2, 3], 'split first N / rest');
  const rg = K.parseRanges('1-3,5', 5).pages;
  d = await load(await K.buildFromPlan(src5, rg.map(i => ({ i, rot: 0 }))));
  eq(order(d), [0, 1, 2, 4], 'range extract');

  /* ---- open / refuse ---- */
  let e1 = ''; try { await K.openPdf(new Uint8Array(Buffer.from('hello world, not a pdf'))); } catch (e) { e1 = e.message; }
  ok(/not a PDF/.test(e1), 'non-PDF refused');
  let e2 = ''; try { await K.openPdf(new Uint8Array(Buffer.from('%PDF-1.4\ngarbage'))); } catch (e) { e2 = e.message; }
  ok(/damaged/.test(e2), 'damaged PDF refused (' + e2 + ')');
  const enc = await PDFDocument.create(); enc.addPage(arr(100, 100)); enc.context.trailerInfo.Encrypt = enc.context.obj({ Filter: 'Standard' });
  let e3 = ''; try { await K.openPdf(new Uint8Array(await enc.save())); } catch (e) { e3 = e.message; }
  ok(/encrypted/.test(e3), 'encrypted PDF refused (' + e3 + ')');
  ok(K.isPdfBytes(A) && !K.isPdfBytes(new Uint8Array([1, 2])), 'isPdfBytes');

  /* ---- WinAnsi cleaner ---- */
  let w = K.winAnsiClean('Hello café €5 “quoted”');
  eq([w.text, w.replaced], ['Hello café €5 “quoted”', 0], 'winansi keeps supported');
  w = K.winAnsiClean('a中文b 😀 Ω');
  eq([w.text, w.replaced], ['a??b ? ?', 4], 'winansi replaces CJK, emoji (one each), Greek');
  w = K.winAnsiClean('x\ty\r\nz\rw');
  eq([w.text, w.replaced], ['x    y\nz\nw', 0], 'winansi tabs and line breaks');
  w = K.winAnsiClean('a​b﻿c');
  eq([w.text, w.replaced], ['abc', 0], 'winansi drops invisible characters silently');
  eq(K.winAnsiClean(null).text, '', 'winansi null');
  /* everything the cleaner keeps must really be drawable by Helvetica */
  const td = await PDFDocument.create(); const hf = await td.embedFont(StandardFonts.Helvetica); let all = '';
  for (let cp = 0x20; cp < 0x3000; cp++) { const s = String.fromCodePoint(cp); if (K.winAnsiClean(s).replaced === 0 && K.winAnsiClean(s).text === s) all += s; }
  let drew = true; try { hf.widthOfTextAtSize(all, 10); td.addPage().drawText(all.slice(0, 400), { font: hf, size: 8 }); } catch (e) { drew = false; console.log(e.message); }
  ok(drew && all.length > 200, 'every kept character is encodable (' + all.length + ' kept)');

  /* ---- text layout and PDF ---- */
  const fixed = (s, sz) => s.length * sz * 0.5;           // every char half the font size wide
  let lay = K.layoutText('', { page: 'a4', size: 10, margin: 0, spacing: 1 }, fixed);
  eq(lay.pages.length, 1, 'empty text: one page');
  // A4 height 841.89 / 10pt lines = 84 lines per page
  lay = K.layoutText(Array(84).fill('x').join('\n'), { page: 'a4', size: 10, margin: 0, spacing: 1 }, fixed);
  eq(lay.pages.length, 1, '84 lines fit on one page');
  lay = K.layoutText(Array(85).fill('x').join('\n'), { page: 'a4', size: 10, margin: 0, spacing: 1 }, fixed);
  eq(lay.pages.length, 2, '85 lines need two pages');
  lay = K.layoutText(Array(250).fill('x').join('\n'), { page: 'a4', size: 10, margin: 0, spacing: 1 }, fixed);
  eq(lay.pages.length, 3, '250 lines need three pages');
  // width 595.28 / 5pt per char = 119 chars per line
  lay = K.layoutText('a'.repeat(119), { page: 'a4', size: 10, margin: 0, spacing: 1 }, fixed);
  eq(lay.pages[0].length, 1, 'exactly one line of 119 chars');
  lay = K.layoutText('a'.repeat(120), { page: 'a4', size: 10, margin: 0, spacing: 1 }, fixed);
  eq(lay.pages[0].map(l => l.t.length), [119, 1], 'long word is broken');
  lay = K.layoutText(('word ').repeat(100).trim(), { page: 'a4', size: 10, margin: 0, spacing: 1 }, fixed);
  ok(lay.pages[0].every(l => l.t.length <= 119 && !/^\s|\s$/.test(l.t)), 'words wrap with no stray spaces');
  lay = K.layoutText('x\n\n\nx', { page: 'a4', size: 10, margin: 0, spacing: 1 }, fixed);
  eq(lay.pages[0].length, 4, 'blank lines are kept');
  lay = K.layoutText(Array(40).fill('x').join('\n'), { page: 'a4', size: 10, margin: 20, spacing: 2 }, fixed);
  // usable height 841.89 - 2*56.69 = 728.5 ; 20pt lines -> 36 per page
  eq(lay.pages.map(p => p.length), [36, 4], 'margin and line spacing change pagination');
  lay = K.layoutText('body', { page: 'letter', size: 10, margin: 0, spacing: 1, title: 'Title' }, fixed);
  ok(lay.pages[0][0].title && lay.pages[0][1].t === 'body', 'title comes first');
  eq([lay.W, lay.H], [612, 792], 'letter layout size');
  lay = K.layoutText('  indented', { page: 'a4', size: 10, margin: 0, spacing: 1 }, fixed);
  eq(lay.pages[0][0].t, '  indented', 'leading indent kept');
  lay = K.layoutText('x\n'.repeat(150000), { page: 'a4', size: 6, margin: 0, spacing: 1 }, fixed);
  ok(lay.tooMany, 'page cap flagged');

  let t = await K.buildTextPdf('Hello 中 world\n'.repeat(100), { page: 'a4', size: 12, margin: 20, spacing: 1.3, title: 'My title' });
  eq(t.replaced, 100, 'text pdf: replacement count');
  d = await load(t.bytes);
  eq(d.getPageCount(), t.pages, 'text pdf: page count matches layout');
  ok(t.pages >= 2 && t.pages <= 3, 'text pdf: 100 lines at 12pt take 2-3 pages (' + t.pages + ')');
  eq(sizes(d)[0], [595, 842], 'text pdf: A4');
  t = await K.buildTextPdf('', { page: 'letter', size: 12, margin: 20, spacing: 1.3, title: '' });
  d = await load(t.bytes); eq([d.getPageCount(), sizes(d)[0]], [1, [612, 792]], 'text pdf: empty text gives one letter page');
  t = await K.buildTextPdf('x', { page: 'a4', size: 12, margin: 20, spacing: 1.3, title: 'T中' });
  eq(t.replaced, 1, 'text pdf: title replacement counted');
  let e4 = ''; try { await K.buildTextPdf('x\n'.repeat(150000), { page: 'a4', size: 6, margin: 0, spacing: 1 }); } catch (e) { e4 = e.message; }
  ok(/more than/.test(e4), 'text pdf: too many pages refused');

  console.log(n + ' checks, ' + fails + ' failed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('CRASH', e); process.exit(1); });
