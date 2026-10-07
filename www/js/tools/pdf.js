'use strict';
/* PDF tools (Pro): Images to PDF, Merge PDFs, PDF Pages, Text to PDF. Uses the vendored pdf-lib (window.PDFLib), fully offline.
   The pure parts (range parser, WinAnsi cleaner, text layout, PDF builders) are exposed as window.PdfKit so tests/pdf.test.js can run them in Node. */
(() => {
  const MB = 1048576, MAX_IN = 50 * MB, MAX_PAGES = 500, MAX_IMAGES = 60, MAX_IMG_TOTAL = 120 * MB, MAX_SIDE = 2400, MAX_OUT_PAGES = 1000;
  const tick = () => new Promise(r => setTimeout(r, 0));
  const PT_MM = 72 / 25.4;
  const SIZES = { a4: [595.28, 841.89], letter: [612, 792] };

  class PdfErr extends Error {}

  /* ---------- pure logic ---------- */
  const isPdfBytes = (u8) => {
    const n = Math.min(u8.length, 1024); let s = '';
    for (let i = 0; i < n; i++) s += String.fromCharCode(u8[i]);
    return s.indexOf('%PDF-') !== -1;
  };

  /* Open a PDF, refusing non-PDFs, encrypted files and files with too many pages. */
  async function openPdf(bytes) {
    if (!bytes || !bytes.length || !isPdfBytes(bytes)) throw new PdfErr('That file is not a PDF.');
    let doc;
    try { doc = await PDFLib.PDFDocument.load(bytes); }
    catch (e) {
      if (/encrypt/i.test(String(e && (e.name + ' ' + e.message)))) throw new PdfErr('This PDF is password protected (encrypted). Remove the password first, then try again.');
      throw new PdfErr('This PDF is damaged or of a kind that cannot be opened here.');
    }
    let count = 0;
    try { count = doc.getPageCount(); } catch (e) { throw new PdfErr('This PDF is damaged or of a kind that cannot be opened here.'); }
    if (doc.getPageCount() > MAX_PAGES) throw new PdfErr('This PDF has more than ' + MAX_PAGES + ' pages, which is too many for this tool.');
    if (doc.getPageCount() < 1) throw new PdfErr('This PDF has no pages.');
    return doc;
  }

  const finish = async (doc) => { doc.setProducer('PocketKit'); doc.setCreator('PocketKit'); return doc.save(); };

  /* "1-3,5,7-9" -> zero-based page indices, in the order typed, without repeats. */
  function parseRanges(text, n) {
    const s = String(text == null ? '' : text).trim();
    if (!s) return { ok: false, error: 'Type the pages, for example 1-3,5,7-9.' };
    const out = [], seen = new Set();
    for (const raw of s.split(/[,;\s]+/)) {
      if (!raw) continue;
      const m = /^(\d{1,6})(?:\s*[-–]\s*(\d{1,6}))?$/.exec(raw);
      if (!m) return { ok: false, error: '"' + raw.slice(0, 20) + '" is not a page or range. Use numbers like 1-3,5,7-9.' };
      const a = +m[1], b = m[2] === undefined ? a : +m[2];
      if (a < 1 || b < 1) return { ok: false, error: 'Page numbers start at 1.' };
      if (a > b) return { ok: false, error: 'The range ' + a + '-' + b + ' is backwards. Write it as ' + b + '-' + a + '.' };
      if (b > n) return { ok: false, error: 'Page ' + b + ' does not exist: the PDF has ' + n + ' page' + (n === 1 ? '' : 's') + '.' };
      for (let p = a; p <= b; p++) if (!seen.has(p)) { seen.add(p); out.push(p - 1); }
    }
    if (!out.length) return { ok: false, error: 'Type the pages, for example 1-3,5,7-9.' };
    return { ok: true, pages: out };
  }

  /* Images to PDF. items: [{ bytes, kind: 'jpg' | 'png' }]; o: { page: 'a4' | 'letter' | 'fit', margin (mm), fit: 'contain' | 'cover' }. */
  async function buildImagesPdf(items, o, progress) {
    const doc = await PDFLib.PDFDocument.create();
    const mm = Math.max(0, Math.min(40, +o.margin || 0));
    for (let k = 0; k < items.length; k++) {
      if (progress) progress(k + 1, items.length);
      const it = items[k];
      const img = it.kind === 'png' ? await doc.embedPng(it.bytes) : await doc.embedJpg(it.bytes);
      const iw = img.width, ih = img.height;
      let pw, ph, m = mm * PT_MM;
      if (o.page === 'fit') {
        pw = Math.min(14400, iw * 0.75 + 2 * m); ph = Math.min(14400, ih * 0.75 + 2 * m);
      } else {
        const [a, b] = SIZES[o.page] || SIZES.a4;
        if (iw > ih) { pw = b; ph = a; } else { pw = a; ph = b; }
      }
      m = Math.min(m, Math.min(pw, ph) / 2 - 10);
      const page = doc.addPage([pw, ph]);
      let sc, x, y, dw, dh;
      if (o.fit === 'cover' && o.page !== 'fit') sc = Math.max(pw / iw, ph / ih);
      else sc = Math.min((pw - 2 * m) / iw, (ph - 2 * m) / ih);
      dw = iw * sc; dh = ih * sc; x = (pw - dw) / 2; y = (ph - dh) / 2;
      page.drawImage(img, { x, y, width: dw, height: dh });
      if (k % 4 === 3) await tick();
    }
    return finish(doc);
  }

  /* Merge: sources is [{ name, getBytes: async () => Uint8Array }]. */
  async function mergePdfs(sources, progress) {
    const out = await PDFLib.PDFDocument.create();
    let total = 0;
    for (let k = 0; k < sources.length; k++) {
      if (progress) progress(k + 1, sources.length, sources[k].name);
      let src;
      try { src = await openPdf(await sources[k].getBytes()); }
      catch (e) { if (e instanceof PdfErr) throw new PdfErr(sources[k].name + ': ' + e.message); throw e; }
      total += src.getPageCount();
      if (total > MAX_OUT_PAGES) throw new PdfErr('The merged PDF would have more than ' + MAX_OUT_PAGES + ' pages.');
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach(p => out.addPage(p));
      await tick();
    }
    return finish(out);
  }

  /* Build a new PDF from a plan: [{ i: source page index, rot: extra degrees (multiple of 90) }], in the order given. */
  async function buildFromPlan(srcDoc, plan) {
    const out = await PDFLib.PDFDocument.create();
    const pages = await out.copyPages(srcDoc, plan.map(p => p.i));
    pages.forEach((pg, k) => {
      const extra = ((plan[k].rot || 0) % 360 + 360) % 360;
      if (extra) pg.setRotation(PDFLib.degrees((pg.getRotation().angle + extra) % 360));
      out.addPage(pg);
    });
    return finish(out);
  }

  /* WinAnsi (the Helvetica encoding): ASCII printable, Latin-1 upper half and the Windows extras. */
  const WIN_EXTRA = new Set([0x20AC, 0x201A, 0x0192, 0x201E, 0x2026, 0x2020, 0x2021, 0x02C6, 0x2030, 0x0160, 0x2039, 0x0152, 0x017D, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2013, 0x2014, 0x02DC, 0x2122, 0x0161, 0x203A, 0x0153, 0x017E, 0x0178]);
  const winAnsiOK = (cp) => (cp >= 0x20 && cp <= 0x7E) || (cp >= 0xA1 && cp <= 0xFF) || cp === 0xA0 || WIN_EXTRA.has(cp);
  /* Text with tabs as spaces, line breaks normalised and unsupported characters replaced by '?'. */
  function winAnsiClean(text) {
    let out = '', replaced = 0;
    const t = String(text == null ? '' : text).replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
    for (const ch of t) {
      const cp = ch.codePointAt(0);
      if (ch === '\n') out += ch;
      else if (cp === 0xA0) out += ' ';
      else if (winAnsiOK(cp)) out += ch;
      else if (cp === 0xAD || (cp >= 0x200B && cp <= 0x200F) || cp === 0xFEFF || (cp >= 0xFE00 && cp <= 0xFE0F)) { /* invisible: drop silently */ }
      else { out += '?'; replaced++; }
    }
    return { text: out, replaced };
  }

  /* Wrap and paginate. measure(str, size, bold) gives the width in points. Returns { pages: [[{ t, title, size, top }]], W, H, tooMany }. */
  function layoutText(text, o, measure) {
    const [W, H] = SIZES[o.page] || SIZES.a4;
    const m = Math.max(0, Math.min(40, +o.margin || 0)) * PT_MM;
    const size = Math.max(6, Math.min(36, +o.size || 12)), sp = Math.max(1, Math.min(3, +o.spacing || 1.3));
    const maxW = W - 2 * m, avail = H - 2 * m, lineH = size * sp;
    const pages = [[]]; let used = 0, tooMany = false;
    const push = (t, title, sz, h) => {
      if (used + h > avail + 0.01 && pages[pages.length - 1].length) {
        if (pages.length >= MAX_OUT_PAGES) { tooMany = true; return; }
        pages.push([]); used = 0;
      }
      pages[pages.length - 1].push({ t, title, size: sz, top: m + used, h });
      used += h;
    };
    const wrap = (para, sz, bold, emit, h) => {
      if (!para.trim()) { emit('', h); return; }
      const toks = para.match(/\s+|\S+/g) || [];
      let line = '', first = true;
      const flush = () => { emit(line.replace(/\s+$/, ''), h); line = ''; first = false; };
      for (const tk of toks) {
        if (/^\s/.test(tk)) { if (line || first) line += tk; continue; }
        if (measure(line + tk, sz, bold) <= maxW) { line += tk; continue; }
        if (line.trim()) flush();
        if (measure(tk, sz, bold) <= maxW) { line = tk; continue; }
        let chunk = '';
        for (const ch of tk) {
          if (measure(chunk + ch, sz, bold) > maxW && chunk) { line = chunk; flush(); chunk = ''; }
          chunk += ch;
        }
        line = chunk;
      }
      if (line.length) flush();
    };
    const title = String(o.title || '').replace(/[\r\n]+/g, ' ').trim();
    if (title) {
      const tsz = Math.min(40, Math.max(size + 4, size * 1.5)), th = tsz * sp;
      wrap(title, tsz, true, (t, h) => push(t, true, tsz, h), th);
      used += lineH * 0.6;
    }
    for (const para of String(text).split('\n')) {
      if (tooMany) break;
      wrap(para, size, false, (t, h) => push(t, false, size, h), lineH);
    }
    return { pages, W, H, tooMany, size };
  }

  async function buildTextPdf(text, o, progress) {
    const doc = await PDFLib.PDFDocument.create();
    const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica), bold = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    const clean = winAnsiClean(text), cleanTitle = winAnsiClean(String(o.title || '').replace(/[\r\n]+/g, ' '));
    const lay = layoutText(clean.text, Object.assign({}, o, { title: cleanTitle.text }), (s, sz, b) => (b ? bold : font).widthOfTextAtSize(s, sz));
    if (lay.tooMany) throw new PdfErr('That text makes more than ' + MAX_OUT_PAGES + ' pages. Use less text or a smaller font.');
    const [W, H] = [lay.W, lay.H];
    const m = Math.max(0, Math.min(40, +o.margin || 0)) * PT_MM;
    for (let p = 0; p < lay.pages.length; p++) {
      if (progress) progress(p + 1, lay.pages.length);
      const page = doc.addPage([W, H]);
      for (const ln of lay.pages[p]) {
        if (!ln.t) continue;
        const y = H - ln.top - ln.h / 2 - ln.size * 0.35;
        page.drawText(ln.t, { x: m, y, size: ln.size, font: ln.title ? bold : font });
      }
      if (p % 5 === 4) await tick();
    }
    return { bytes: await finish(doc), pages: lay.pages.length, replaced: clean.replaced + cleanTitle.replaced };
  }

  window.PdfKit = { openPdf, parseRanges, buildImagesPdf, mergePdfs, buildFromPlan, winAnsiClean, layoutText, buildTextPdf, isPdfBytes, PdfErr, SIZES, MAX_PAGES };

  /* ---------- shared UI helpers ---------- */
  const sizeText = (n) => n >= MB ? (n / MB).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';

  function pickPdfs(multi, cb) {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'application/pdf,.pdf'; i.multiple = !!multi;
    i.onchange = () => {
      const all = [...i.files]; if (!all.length) return;
      const pdfs = all.filter(f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
      if (!pdfs.length) { toast('That is not a PDF file. Choose a file ending in .pdf.'); return; }
      const ok = pdfs.filter(f => f.size <= MAX_IN);
      if (!ok.length) { toast('That PDF is too large (limit 50 MB).'); return; }
      const skipped = all.length - ok.length;
      if (skipped) toast(skipped + ' file(s) skipped: not a PDF or over 50 MB');
      cb(ok);
    };
    i.click();
  }
  const readBytes = async (file) => new Uint8Array(await file.arrayBuffer());
  const baseName = (n) => String(n || 'document').replace(/\.pdf$/i, '').replace(/[^\w\- ]+/g, '_').trim().slice(0, 40) || 'document';
  const stamp = () => { const d = new Date(); return d.getFullYear() + pad(d.getMonth() + 1, 2) + pad(d.getDate(), 2) + '-' + pad(d.getHours(), 2) + pad(d.getMinutes(), 2); };

  /* A box that lists finished PDFs, each with a share / save button. Bytes are dropped on clear. */
  function resultBox(box) {
    let keep = [];
    const api = {
      clear() { keep = []; box.innerHTML = ''; },
      add(name, bytes, note) {
        const row = h(`<div class="item" style="gap:8px;flex-wrap:wrap"><div class="grow"><b>${esc(name)}</b><div class="muted" style="font-size:13px">${esc(sizeText(bytes.length))}${note ? ' · ' + esc(note) : ''}</div></div><button class="btn" style="min-height:44px">Share / save</button></div>`);
        const blob = new Blob([bytes], { type: 'application/pdf' }); keep.push(blob);
        $('button', row).onclick = async () => { const ok = await shareImageBlob(name, blob, name); if (ok === false) toast('Not saved'); };
        box.appendChild(row);
      }
    };
    return api;
  }
  const errMsg = (e) => e instanceof PdfErr ? e.message : 'Something went wrong. Try again with a smaller or different file.';
  const btnStyle = 'min-height:44px;min-width:44px;padding:0 10px';

  /* ---------- Images to PDF ---------- */
  async function naturalSize(file) {
    const url = URL.createObjectURL(file);
    try { const img = await new Promise((res, rej) => { const m = new Image(); m.onload = () => res(m); m.onerror = rej; m.src = url; }); return { w: img.naturalWidth, h: img.naturalHeight }; }
    finally { URL.revokeObjectURL(url); }
  }
  /* Decode already shrunk to max side `max` (so a 12 MP photo never fills memory). */
  async function decodeSmall(file, max) {
    try {
      const d = await naturalSize(file), k = Math.max(d.w, d.h) > max ? max / Math.max(d.w, d.h) : 1;
      if (k < 1) return await createImageBitmap(file, { resizeWidth: Math.max(1, Math.round(d.w * k)), resizeHeight: Math.max(1, Math.round(d.h * k)), resizeQuality: 'high' });
    } catch (e) { /* plain decode below */ }
    return createImageBitmap(file);
  }
  /* One picture to JPEG bytes: rotated, on white, at most MAX_SIDE px on the long side. */
  async function imageToJpeg(file, rot, quality) {
    const bmp = await decodeSmall(file, MAX_SIDE);
    try {
      const sw = bmp.width, sh = bmp.height, turn = rot % 180 !== 0;
      const c = document.createElement('canvas'); c.width = turn ? sh : sw; c.height = turn ? sw : sh;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      g.translate(c.width / 2, c.height / 2); g.rotate(rot * Math.PI / 180); g.drawImage(bmp, -sw / 2, -sh / 2, sw, sh);
      const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', quality));
      c.width = c.height = 1;
      if (!blob) throw new Error('encode');
      return new Uint8Array(await blob.arrayBuffer());
    } finally { if (bmp.close) bmp.close(); }
  }
  async function thumbOf(file) {
    try {
      const bmp = await createImageBitmap(file); const k = 96 / Math.max(bmp.width, bmp.height);
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); if (bmp.close) bmp.close();
      return c.toDataURL('image/jpeg', 0.6);
    } catch (e) { return ''; }
  }

  Tools.register({
    id: 'pdfimages', pro: true, proKey: 'pdf', name: 'Images to PDF', icon: '📕', cat: 'create', pro: true, proKey: 'pdf',
    desc: 'Turn photos into one PDF: reorder and rotate pictures, pick the page size, margin and quality, then share or save.',
    keys: ['pdf', 'photos', 'convert', 'jpg', 'png', 'scan'], needs: ['storage'],
    render(el) {
      el.innerHTML = `<div class="card"><button class="btn" id="pk" style="min-height:48px">Choose pictures</button>
        <div class="muted" id="cnt" style="margin-top:6px">Up to ${MAX_IMAGES} pictures, ${MAX_IMG_TOTAL / MB} MB in all.</div></div>
        <div class="list" id="ls"></div>
        <div class="card" id="opts" hidden>
          <label class="f">Page size<select id="pg"><option value="a4">A4</option><option value="letter">Letter</option><option value="fit">Fit to each picture</option></select></label>
          <label class="f">Margin (mm)<input id="mg" type="number" inputmode="decimal" min="0" max="40" step="1" value="10"></label>
          <label class="f">Picture on page<select id="fm"><option value="contain">Whole picture, centred</option><option value="cover">Fill the page (crop edges)</option></select></label>
          <label class="f">Quality (file size)<select id="q"><option value="0.9">High (largest file)</option><option value="0.75" selected>Medium</option><option value="0.55">Low (smallest file)</option></select></label>
          <button class="btn" id="mk" style="min-height:48px;margin-top:8px">Make PDF</button>
          <div class="muted" id="st" role="status" aria-live="polite" style="margin-top:8px"></div>
        </div>
        <div class="list" id="res"></div>`;
      const ls = $('#ls', el), st = $('#st', el), res = resultBox($('#res', el));
      let items = [], busy = false, dead = false;
      const say = (t) => { if (!dead) st.textContent = t; };
      const total = () => items.reduce((s, i) => s + i.file.size, 0);
      function draw() {
        $('#opts', el).hidden = !items.length;
        $('#cnt', el).textContent = items.length ? items.length + ' picture' + (items.length === 1 ? '' : 's') + ', ' + sizeText(total()) + ' (limit ' + MAX_IMAGES + ' pictures, ' + MAX_IMG_TOTAL / MB + ' MB)' : 'Up to ' + MAX_IMAGES + ' pictures, ' + MAX_IMG_TOTAL / MB + ' MB in all.';
        ls.innerHTML = items.map((it, k) => `<div class="item" style="gap:6px;flex-wrap:wrap">
          <div style="width:56px;height:56px;display:flex;align-items:center;justify-content:center;overflow:hidden;flex:none">${it.thumb ? `<img alt="" src="${it.thumb}" style="max-width:48px;max-height:48px;transform:rotate(${it.rot}deg)">` : '🖼️'}</div>
          <div class="grow" style="min-width:90px;overflow-wrap:anywhere">${k + 1}. ${esc(it.file.name || 'picture')}<div class="muted" style="font-size:12px">${esc(sizeText(it.file.size))}${it.rot ? ' · turned ' + it.rot + '°' : ''}</div></div>
          <button class="btn alt" data-a="up" data-k="${k}" aria-label="Move picture ${k + 1} up" style="${btnStyle}" ${k === 0 ? 'disabled' : ''}>▲</button>
          <button class="btn alt" data-a="dn" data-k="${k}" aria-label="Move picture ${k + 1} down" style="${btnStyle}" ${k === items.length - 1 ? 'disabled' : ''}>▼</button>
          <button class="btn alt" data-a="rot" data-k="${k}" aria-label="Rotate picture ${k + 1}" style="${btnStyle}">↻</button>
          <button class="btn danger" data-a="rm" data-k="${k}" aria-label="Remove picture ${k + 1}" style="${btnStyle}">✕</button></div>`).join('');
      }
      ls.onclick = (ev) => {
        const b = ev.target.closest('button[data-a]'); if (!b || busy) return;
        const k = +b.dataset.k, a = b.dataset.a;
        if (a === 'up' && k > 0) [items[k - 1], items[k]] = [items[k], items[k - 1]];
        else if (a === 'dn' && k < items.length - 1) [items[k + 1], items[k]] = [items[k], items[k + 1]];
        else if (a === 'rot') items[k].rot = (items[k].rot + 90) % 360;
        else if (a === 'rm') items.splice(k, 1);
        draw();
      };
      $('#pk', el).onclick = () => { if (busy) return; pickFilesImg(async (files) => {
        const room = MAX_IMAGES - items.length; let add = files.slice(0, Math.max(0, room));
        if (files.length > add.length) toast('Only ' + MAX_IMAGES + ' pictures fit in one PDF');
        let sum = total();
        add = add.filter(f => { if (sum + f.size > MAX_IMG_TOTAL) return false; sum += f.size; return true; });
        if (!add.length) { toast('That is over the ' + MAX_IMG_TOTAL / MB + ' MB limit for one PDF'); return; }
        const fresh = add.map(f => ({ file: f, rot: 0, thumb: '' })); items = items.concat(fresh); res.clear(); draw();
        for (const it of fresh) { if (dead) return; it.thumb = await thumbOf(it.file); draw(); await tick(); }
      }); };
      function pickFilesImg(cb) {
        const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.multiple = true;
        i.onchange = () => {
          const all = [...i.files]; if (!all.length) return;
          const f = all.filter(x => (!x.type || /^image\//.test(x.type)) && x.size <= 60 * MB);
          if (!f.length) { toast('That is not a picture (or it is over 60 MB). Choose JPG, PNG or WebP images.'); return; }
          if (f.length < all.length) toast((all.length - f.length) + ' file(s) skipped: not a picture or over 60 MB');
          cb(f);
        };
        i.click();
      }
      $('#mk', el).onclick = async () => {
        if (busy || !items.length) return;
        busy = true; res.clear(); $('#mk', el).disabled = true;
        const q = Valid.clamp($('#q', el).value, 0.3, 0.95, 0.75), margin = Valid.clamp($('#mg', el).value, 0, 40, 10);
        const o = { page: $('#pg', el).value, fit: $('#fm', el).value, margin };
        try {
          const list = [];
          for (let k = 0; k < items.length; k++) {
            say('Preparing picture ' + (k + 1) + ' of ' + items.length + '...');
            await tick();
            try { list.push({ bytes: await imageToJpeg(items[k].file, items[k].rot, q), kind: 'jpg' }); }
            catch (e) { throw new PdfErr('Picture ' + (k + 1) + ' (' + (items[k].file.name || 'picture') + ') could not be read.'); }
            if (dead) return;
          }
          const bytes = await buildImagesPdf(list, o, (k, n) => say('Adding page ' + k + ' of ' + n + '...'));
          if (dead) return;
          res.add('pictures-' + stamp() + '.pdf', bytes, items.length + ' page' + (items.length === 1 ? '' : 's'));
          say('Done. Tap Share / save below.');
        } catch (e) { say(errMsg(e)); }
        finally { busy = false; if (!dead) $('#mk', el).disabled = false; }
      };
      draw();
      return () => { dead = true; items = []; res.clear(); };
    }
  });

  /* ---------- Merge PDFs ---------- */
  Tools.register({
    id: 'pdfmerge', pro: true, proKey: 'pdf', name: 'Merge PDFs', icon: '🗂️', cat: 'create', pro: true, proKey: 'pdf',
    desc: 'Join several PDF files into one, in the order you choose, then share or save it.',
    keys: ['pdf', 'combine', 'join', 'append'], needs: ['storage'],
    render(el) {
      el.innerHTML = `<div class="card"><button class="btn" id="pk" style="min-height:48px">Choose PDFs</button>
        <div class="muted" id="cnt" style="margin-top:6px">Each file up to 50 MB and ${MAX_PAGES} pages.</div></div>
        <div class="list" id="ls"></div>
        <div class="card" id="act" hidden><button class="btn" id="mk" style="min-height:48px">Merge</button>
          <div class="muted" id="st" role="status" aria-live="polite" style="margin-top:8px"></div></div>
        <div class="list" id="res"></div>`;
      const ls = $('#ls', el), st = $('#st', el), res = resultBox($('#res', el));
      let items = [], busy = false, dead = false;
      const say = (t) => { if (!dead) st.textContent = t; };
      function draw() {
        $('#act', el).hidden = !items.length;
        $('#cnt', el).textContent = items.length ? items.length + ' PDF' + (items.length === 1 ? '' : 's') + ' · ' + sizeText(items.reduce((s, i) => s + i.file.size, 0)) : 'Each file up to 50 MB and ' + MAX_PAGES + ' pages.';
        ls.innerHTML = items.map((it, k) => `<div class="item" style="gap:6px;flex-wrap:wrap">
          <div class="grow" style="min-width:110px;overflow-wrap:anywhere">${k + 1}. ${esc(it.file.name)}<div class="muted" style="font-size:12px">${esc(sizeText(it.file.size))}</div></div>
          <button class="btn alt" data-a="up" data-k="${k}" aria-label="Move ${esc(it.file.name)} up" style="${btnStyle}" ${k === 0 ? 'disabled' : ''}>▲</button>
          <button class="btn alt" data-a="dn" data-k="${k}" aria-label="Move ${esc(it.file.name)} down" style="${btnStyle}" ${k === items.length - 1 ? 'disabled' : ''}>▼</button>
          <button class="btn danger" data-a="rm" data-k="${k}" aria-label="Remove ${esc(it.file.name)}" style="${btnStyle}">✕</button></div>`).join('');
      }
      ls.onclick = (ev) => {
        const b = ev.target.closest('button[data-a]'); if (!b || busy) return;
        const k = +b.dataset.k, a = b.dataset.a;
        if (a === 'up' && k > 0) [items[k - 1], items[k]] = [items[k], items[k - 1]];
        else if (a === 'dn' && k < items.length - 1) [items[k + 1], items[k]] = [items[k], items[k + 1]];
        else if (a === 'rm') items.splice(k, 1);
        draw();
      };
      $('#pk', el).onclick = () => { if (busy) return; pickPdfs(true, (files) => {
        let sum = items.reduce((s, i) => s + i.file.size, 0);
        const add = files.filter(f => { if (sum + f.size > 4 * MAX_IN) return false; sum += f.size; return true; });
        if (add.length < files.length) toast('Some files were left out: 200 MB limit in all');
        items = items.concat(add.map(f => ({ file: f }))); res.clear(); draw();
      }); };
      $('#mk', el).onclick = async () => {
        if (busy) return;
        if (items.length < 2) { say('Choose at least two PDFs to merge.'); return; }
        busy = true; res.clear(); $('#mk', el).disabled = true;
        try {
          const bytes = await mergePdfs(items.map(it => ({ name: it.file.name, getBytes: () => readBytes(it.file) })), (k, n, name) => say('Merging ' + k + ' of ' + n + ': ' + name));
          if (dead) return;
          const pages = (await PDFLib.PDFDocument.load(bytes)).getPageCount();
          res.add('merged-' + stamp() + '.pdf', bytes, pages + ' page' + (pages === 1 ? '' : 's'));
          say('Done. Tap Share / save below.');
        } catch (e) { say(errMsg(e)); }
        finally { busy = false; if (!dead) $('#mk', el).disabled = false; }
      };
      draw();
      return () => { dead = true; items = []; res.clear(); };
    }
  });

  /* ---------- PDF Pages ---------- */
  Tools.register({
    id: 'pdfpages', pro: true, proKey: 'pdf', name: 'PDF Pages', icon: '🧷', cat: 'create', pro: true, proKey: 'pdf',
    desc: 'Open a PDF and pick pages: extract, delete, rotate, reorder or split by page ranges into a new PDF.',
    keys: ['pdf', 'split', 'extract', 'delete', 'rotate', 'reorder', 'pages'], needs: ['storage'],
    render(el) {
      el.innerHTML = `<div class="card"><button class="btn" id="pk" style="min-height:48px">Open a PDF</button>
        <div class="muted" id="inf" style="margin-top:6px">Up to 50 MB and ${MAX_PAGES} pages. Nothing leaves your phone.</div>
        <div class="muted" id="st" role="status" aria-live="polite" style="margin-top:6px"></div></div>
        <div id="work" hidden>
          <div class="card">
            <div class="row"><button class="btn alt" id="all" style="min-height:44px">Select all</button><button class="btn alt" id="none" style="min-height:44px">Select none</button></div>
            <div class="muted" id="selc" style="margin:6px 0"></div>
            <div class="row"><button class="btn alt" id="up" style="min-height:44px">▲ Move up</button><button class="btn alt" id="dn" style="min-height:44px">▼ Move down</button></div>
            <div class="row" style="margin-top:8px"><button class="btn alt" id="r90" style="min-height:44px">Rotate 90°</button><button class="btn alt" id="r180" style="min-height:44px">180°</button><button class="btn alt" id="r270" style="min-height:44px">270°</button></div>
            <div class="row" style="margin-top:8px"><button class="btn" id="ext" style="min-height:44px">Extract selected</button><button class="btn danger" id="del" style="min-height:44px">Delete selected</button></div>
          </div>
          <div class="list" id="ls"></div>
          <div class="card">
            <button class="btn" id="sv" style="min-height:48px">Make PDF of the pages as listed</button>
            <label class="f" style="margin-top:10px">Pages for a new PDF (for example 1-3,5,7-9)<input id="rg" type="text" maxlength="120" placeholder="1-3,5,7-9" autocomplete="off"></label>
            <button class="btn alt" id="rgb" style="min-height:44px;margin-top:6px">Make PDF of these pages</button>
            <label class="f" style="margin-top:10px">Split after page number<input id="sp" type="number" inputmode="numeric" min="1" max="${MAX_PAGES}" step="1" value="1"></label>
            <button class="btn alt" id="spb" style="min-height:44px;margin-top:6px">Split into two PDFs</button>
          </div>
        </div>
        <div class="list" id="res"></div>`;
      const ls = $('#ls', el), st = $('#st', el), res = resultBox($('#res', el));
      let doc = null, name = 'document', plan = [], infos = [], busy = false, dead = false;
      const say = (t) => { if (!dead) st.textContent = t; };
      const sel = () => plan.filter(p => p.sel);
      function draw() {
        $('#work', el).hidden = !plan.length && !doc;
        $('#selc', el).textContent = sel().length + ' of ' + plan.length + ' page' + (plan.length === 1 ? '' : 's') + ' selected';
        $('#sp', el).max = Math.max(1, plan.length - 1);
        ls.innerHTML = plan.map((p, k) => {
          const f = infos[p.i], r = (f.rot + p.rot) % 360;
          return `<label class="item" style="min-height:48px;gap:10px;cursor:pointer"><input type="checkbox" data-k="${k}" ${p.sel ? 'checked' : ''} aria-label="Select page ${k + 1}" style="width:22px;height:22px;flex:none">
            <span class="grow">Page ${k + 1}<span class="muted" style="font-size:12px"> (was ${p.i + 1}) · ${f.w} × ${f.h} pt${r ? ' · turned ' + r + '°' : ''}</span></span></label>`;
        }).join('');
      }
      ls.onchange = (ev) => { const c = ev.target; if (c && c.type === 'checkbox') { plan[+c.dataset.k].sel = c.checked; $('#selc', el).textContent = sel().length + ' of ' + plan.length + ' page' + (plan.length === 1 ? '' : 's') + ' selected'; } };
      const guard = (fn) => async () => { if (busy || !doc) return; busy = true; try { await fn(); } catch (e) { say(errMsg(e)); } finally { busy = false; } };
      const need = (n) => { if (n) return true; say('Tick at least one page first.'); return false; };
      const make = async (label, pl) => {
        say('Building ' + pl.length + ' page' + (pl.length === 1 ? '' : 's') + '...'); await tick();
        const bytes = await buildFromPlan(doc, pl); if (dead) return;
        res.add(baseName(name) + '-' + label + '.pdf', bytes, pl.length + ' page' + (pl.length === 1 ? '' : 's')); say('Done. Tap Share / save below.');
      };
      $('#pk', el).onclick = () => { if (busy) return; pickPdfs(false, async (files) => {
        busy = true; res.clear(); say('Opening ' + files[0].name + '...');
        try {
          const d = await openPdf(await readBytes(files[0])); if (dead) return;
          doc = d; name = files[0].name;
          infos = d.getPages().map(p => { const s = p.getSize(); return { w: Math.round(s.width), h: Math.round(s.height), rot: ((p.getRotation().angle % 360) + 360) % 360 }; });
          plan = infos.map((_, i) => ({ i, rot: 0, sel: false }));
          $('#inf', el).textContent = files[0].name + ': ' + plan.length + ' page' + (plan.length === 1 ? '' : 's') + ', ' + sizeText(files[0].size);
          say(''); draw();
        } catch (e) { doc = null; plan = []; $('#work', el).hidden = true; say(errMsg(e)); }
        finally { busy = false; }
      }); };
      $('#all', el).onclick = () => { plan.forEach(p => p.sel = true); draw(); };
      $('#none', el).onclick = () => { plan.forEach(p => p.sel = false); draw(); };
      const rot = (deg) => () => { if (busy || !need(sel().length)) return; sel().forEach(p => p.rot = (p.rot + deg) % 360); say('Turned ' + sel().length + ' page(s) by ' + deg + '°. Make a PDF to keep the change.'); draw(); };
      $('#r90', el).onclick = rot(90); $('#r180', el).onclick = rot(180); $('#r270', el).onclick = rot(270);
      $('#up', el).onclick = () => {
        if (busy || !need(sel().length)) return;
        for (let k = 1; k < plan.length; k++) if (plan[k].sel && !plan[k - 1].sel) [plan[k - 1], plan[k]] = [plan[k], plan[k - 1]];
        draw();
      };
      $('#dn', el).onclick = () => {
        if (busy || !need(sel().length)) return;
        for (let k = plan.length - 2; k >= 0; k--) if (plan[k].sel && !plan[k + 1].sel) [plan[k + 1], plan[k]] = [plan[k], plan[k + 1]];
        draw();
      };
      $('#del', el).onclick = () => {
        if (busy || !need(sel().length)) return;
        if (sel().length === plan.length) { say('That would delete every page. Leave at least one.'); return; }
        const n = sel().length; plan = plan.filter(p => !p.sel); say('Deleted ' + n + ' page(s) from the list. Make a PDF to keep the change.'); draw();
      };
      $('#ext', el).onclick = guard(async () => { const s = sel(); if (!need(s.length)) return; await make('extract', s.map(p => ({ i: p.i, rot: p.rot }))); });
      $('#sv', el).onclick = guard(async () => { await make('edited', plan.map(p => ({ i: p.i, rot: p.rot }))); });
      $('#rgb', el).onclick = guard(async () => {
        const r = parseRanges($('#rg', el).value, plan.length); if (!r.ok) { say(r.error); return; }
        await make('pages', r.pages.map(k => ({ i: plan[k].i, rot: plan[k].rot })));
      });
      $('#spb', el).onclick = guard(async () => {
        const n = Valid.clamp($('#sp', el).value, 1, plan.length - 1, 0);
        if (plan.length < 2) { say('This PDF has only one page, so it cannot be split.'); return; }
        if (!n) { say('Type the page number to split after.'); return; }
        const a = plan.slice(0, Math.round(n)), b = plan.slice(Math.round(n));
        await make('first' + a.length, a.map(p => ({ i: p.i, rot: p.rot }))); if (dead) return;
        await make('rest', b.map(p => ({ i: p.i, rot: p.rot })));
      });
      draw();
      return () => { dead = true; doc = null; plan = []; res.clear(); };
    }
  });

  /* ---------- Text to PDF ---------- */
  Tools.register({
    id: 'pdftext', pro: true, proKey: 'pdf', name: 'Text to PDF', icon: '📰', cat: 'create', pro: true, proKey: 'pdf',
    desc: 'Type or paste text and save it as a neat PDF with a title, font size, margins and line spacing.',
    keys: ['pdf', 'document', 'write', 'print', 'text'], needs: ['storage'],
    render(el) {
      el.innerHTML = `<div class="card">
        <label class="f">Title (optional)<input id="ti" type="text" maxlength="120" autocomplete="off"></label>
        <label class="f">Text<textarea id="tx" rows="9" maxlength="200000" placeholder="Type or paste your text here" style="width:100%"></textarea></label>
        <div class="muted" id="cn" style="font-size:12px">0 / 200000 characters</div>
        <label class="f">Font size (pt)<input id="fs" type="number" inputmode="decimal" min="6" max="36" step="1" value="12"></label>
        <label class="f">Page size<select id="pg"><option value="a4">A4</option><option value="letter">Letter</option></select></label>
        <label class="f">Margin (mm)<input id="mg" type="number" inputmode="decimal" min="0" max="40" step="1" value="20"></label>
        <label class="f">Line spacing<input id="sp" type="number" inputmode="decimal" min="1" max="3" step="0.1" value="1.3"></label>
        <button class="btn" id="mk" style="min-height:48px;margin-top:8px">Make PDF</button>
        <div class="muted" id="st" role="status" aria-live="polite" style="margin-top:8px"></div></div>
        <div class="list" id="res"></div>`;
      const st = $('#st', el), res = resultBox($('#res', el)), tx = $('#tx', el);
      let busy = false, dead = false;
      const say = (t) => { if (!dead) st.textContent = t; };
      tx.oninput = () => { $('#cn', el).textContent = tx.value.length + ' / 200000 characters'; };
      $('#mk', el).onclick = async () => {
        if (busy) return;
        const text = tx.value.slice(0, 200000);
        if (!text.trim()) { say('Type or paste some text first.'); return; }
        busy = true; res.clear(); $('#mk', el).disabled = true;
        const o = { title: $('#ti', el).value.slice(0, 120), page: $('#pg', el).value, size: Valid.clamp($('#fs', el).value, 6, 36, 12), margin: Valid.clamp($('#mg', el).value, 0, 40, 20), spacing: Valid.clamp($('#sp', el).value, 1, 3, 1.3) };
        try {
          say('Laying out the text...'); await tick();
          const r = await buildTextPdf(text, o, (p, n) => say('Writing page ' + p + ' of ' + n + '...'));
          if (dead) return;
          res.add((baseName(o.title) === 'document' ? 'text' : baseName(o.title)) + '-' + stamp() + '.pdf', r.bytes, r.pages + ' page' + (r.pages === 1 ? '' : 's'));
          say('Done. Tap Share / save below.' + (r.replaced ? ' ' + r.replaced + ' character' + (r.replaced === 1 ? ' was' : 's were') + ' replaced with "?" because the standard PDF font cannot show them (for example emoji or non-Latin letters).' : ''));
        } catch (e) { say(errMsg(e)); }
        finally { busy = false; if (!dead) $('#mk', el).disabled = false; }
      };
      return () => { dead = true; res.clear(); };
    }
  });

  /*END*/
})();
