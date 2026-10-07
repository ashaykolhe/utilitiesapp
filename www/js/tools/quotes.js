'use strict';
/* Two quote tools on one engine: "Real Quotes" (genuine motivational quotes by real people, with the author) and "Goofy Quotes"
   (silly, original motivational quotes, plus a Mixer that builds new ones from templates).
   The text lives in www/js/data/quotes-real.js (REAL_QUOTES: [text, author, category, source?]) and www/js/data/quotes-goofy.js
   (GOOFY_QUOTES: [text, category], GOOFY_GEN: { templates, banks }). Saved favourites keep a copy of the text, so they survive data updates. */
(() => {
  const hashOf = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  const shuffled = (n) => { const a = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const FAV_MAX = 300, LIST_PAGE = 40;

  /* Picture card styles: two dark-enough colours each so white text always reads well. */
  const THEMES = [['#6d4aff', '#241269'], ['#ea580c', '#6b1d0e'], ['#0e9aa7', '#0a3550'], ['#db2777', '#4a0f2e'], ['#16a34a', '#0b3d22'], ['#2563eb', '#0f2457'], ['#d97706', '#5c3503'], ['#374151', '#0b0f19']];
  /* Break text into lines that fit a width, using the canvas's own font measuring. */
  function wrapLines(g, text, maxW) {
    const words = text.split(/\s+/), lines = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; } }
    if (cur) lines.push(cur); return lines;
  }
  /* Draw a square picture of the quote: gradient, big quote mark, auto-fitted text, author, small PocketKit line. */
  function drawQuoteCard(cv, q, styleIdx, toolName) {
    const S = 1080, g = cv.getContext('2d'); cv.width = S; cv.height = S;
    const th = THEMES[styleIdx % THEMES.length], grad = g.createLinearGradient(0, 0, S, S); grad.addColorStop(0, th[0]); grad.addColorStop(1, th[1]);
    g.fillStyle = grad; g.fillRect(0, 0, S, S);
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.arc(S * 0.88, S * 0.1, 260, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(S * 0.08, S * 0.95, 200, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.font = '700 260px Georgia, serif'; g.textBaseline = 'alphabetic'; g.fillText('“', 70, 270);
    const pad = 110, maxW = S - pad * 2, maxH = 560, text = q ? q.t : '';
    let size = 86, lines = [];
    for (; size >= 32; size -= 2) { g.font = '700 ' + size + 'px system-ui, -apple-system, Roboto, sans-serif'; lines = wrapLines(g, text, maxW); if (lines.length * size * 1.28 <= maxH) break; }
    const lh = size * 1.28, top = 300 + Math.max(0, (maxH - lines.length * lh) / 2);
    g.fillStyle = '#ffffff'; g.textAlign = 'left';
    lines.forEach((l, i) => g.fillText(l, pad, top + i * lh + size * 0.85));
    if (q && q.a) { g.font = '600 44px system-ui, -apple-system, Roboto, sans-serif'; g.fillStyle = 'rgba(255,255,255,0.88)'; wrapLines(g, '— ' + q.a, maxW).slice(0, 2).forEach((l, i) => g.fillText(l, pad, 900 + i * 54)); }
    g.font = '600 30px system-ui, -apple-system, Roboto, sans-serif'; g.fillStyle = 'rgba(255,255,255,0.6)'; g.textAlign = 'center'; g.fillText('PocketKit · ' + toolName, S / 2, 1030);
  }

  function make(cfg) {
    const data = cfg.data.map((x, i) => ({ t: String(x[0]), a: cfg.byline ? String(x[1] || '') : '', c: String(cfg.byline ? x[2] : x[1] || ''), s: cfg.byline ? String(x[3] || '') : '', h: hashOf(String(x[0])) }));
    const catLabel = Object.fromEntries(cfg.cats.map(c => [c[0], c[1]]));
    Tools.register({ id: cfg.id, name: cfg.name, icon: cfg.icon, cat: cfg.cat, desc: cfg.desc, keys: cfg.keys, needs: ['storage'], render(el) {
      const favKey = cfg.id + '.fav', favs = () => Store.arr(favKey);
      el.innerHTML =
        '<div class="card center" id="qc" style="min-height:230px;display:flex;flex-direction:column;justify-content:center;gap:12px;touch-action:pan-y;background:linear-gradient(145deg,color-mix(in srgb,var(--accent) 16%,var(--surface)),var(--surface))">' +
          '<div id="qcat" class="muted" style="font-size:12px;letter-spacing:.08em;text-transform:uppercase"></div>' +
          '<div id="qt" style="font-size:24px;font-weight:700;line-height:1.35;word-break:break-word" aria-live="polite"></div>' +
          '<div id="qa" class="muted" style="font-size:15px"></div></div>' +
        '<div class="row"><button class="btn alt" id="qp" aria-label="Previous quote" style="flex:none;width:56px">←</button><button class="btn" id="qn" style="flex:3">Next quote</button><button class="btn alt" id="qs" aria-label="Save quote" aria-pressed="false" style="flex:none;width:56px">☆</button></div>' +
        '<div class="row"><button class="btn alt" id="qd">Quote of the day</button><button class="btn alt" id="qcp">Copy</button></div>' +
        '<div class="row"><button class="btn alt" id="qsh">📤 Share text</button><button class="btn" id="qpic">🖼️ Share as picture</button></div>' +
        '<dialog id="qpv"><div class="dlg"><h2>Share as picture</h2><canvas id="qcv" width="1080" height="1080" style="width:100%;height:auto;aspect-ratio:1/1;border-radius:14px" role="img" aria-label="Preview of the quote picture"></canvas>' +
          '<div class="swatches" id="qsw" role="group" aria-label="Picture style"></div>' +
          '<div class="row"><button class="btn alt" id="qpx">Close</button><button class="btn" id="qpgo">Share picture</button></div></div></dialog>' +
        (cfg.mixer ? '<button class="btn alt" id="qmix" style="width:100%">🎲 Mix a brand new one</button>' : '') +
        '<div class="chips" id="qchips" role="group" aria-label="Categories" style="padding:0"></div>' +
        '<input type="search" id="qfind" maxlength="60" placeholder="Search quotes' + (cfg.byline ? ' or authors' : '') + '" aria-label="Search quotes" autocomplete="off">' +
        '<div class="muted center" id="qcount" style="font-size:13px"></div><div class="list" id="qlist"></div>';
      let filter = 'all', query = '', order = [], pos = -1, current = null, shown = LIST_PAGE, trail = [];
      const $q = (s) => $(s, el);

      const pool = () => {
        const q = query.trim().toLowerCase();
        if (filter === 'saved') return favs().map(f => ({ t: f.t, a: f.a || '', c: f.c || '', s: '', h: f.h })).filter(x => !q || (x.t + ' ' + x.a).toLowerCase().includes(q));
        return data.filter(x => (filter === 'all' || x.c === filter) && (!q || (x.t + ' ' + x.a).toLowerCase().includes(q)));
      };
      const isSaved = (x) => favs().some(f => f.h === x.h);
      function show(x, pushTrail) {
        if (!x) { $q('#qt').textContent = filter === 'saved' ? 'Nothing saved yet. Tap the star on a quote you like.' : 'No quote matches that.'; $q('#qa').textContent = ''; $q('#qcat').textContent = ''; current = null; paintSave(); return; }
        if (pushTrail && current) { trail.push(current); if (trail.length > 100) trail.shift(); }
        current = x;
        $q('#qt').textContent = x.t; $q('#qt').style.fontSize = x.t.length > 170 ? '18px' : x.t.length > 100 ? '21px' : '24px';
        $q('#qa').textContent = x.a ? '— ' + x.a + (x.s ? ' (' + x.s + ')' : '') : '';
        $q('#qcat').textContent = catLabel[x.c] || (x.c === 'mixer' ? 'Freshly mixed' : '');
        paintSave();
      }
      function paintSave() {
        const b = $q('#qs'), on = current && isSaved(current);
        b.textContent = on ? '★' : '☆'; b.setAttribute('aria-pressed', String(!!on)); b.setAttribute('aria-label', on ? 'Remove from saved' : 'Save quote');
      }
      function next() {
        const p = pool(); if (!p.length) return show(null);
        if (pos < 0 || pos >= order.length - 1 || order.length !== p.length) { order = shuffled(p.length); pos = -1; if (current && order.length > 1 && p[order[0]].h === current.h) order.push(order.shift()); }
        pos++; show(p[order[pos]], true);
      }
      function prev() { const x = trail.pop(); if (x) show(x, false); else toast('That is the first one'); }
      function paintChips() {
        const all = [['all', 'All'], ...cfg.cats.map(c => [c[0], (c[2] ? c[2] + ' ' : '') + c[1]]), ['saved', '★ Saved (' + favs().length + ')']];
        $q('#qchips').innerHTML = all.map(([id, l]) => '<button class="chip' + (id === filter ? ' on' : '') + '" data-f="' + esc(id) + '" aria-pressed="' + (id === filter) + '">' + esc(l) + '</button>').join('');
      }
      function paintList() {
        const p = pool(), box = $q('#qlist');
        $q('#qcount').textContent = filter === 'saved' ? p.length + ' saved' : p.length + ' quote' + (p.length === 1 ? '' : 's') + (filter === 'all' && !query ? ' in this collection' : '');
        if (!query && filter === 'all') { box.innerHTML = ''; return; } // the full list is only shown for a search or a category
        const rows = p.slice(0, shown).map((x, i) => '<button class="item" data-i="' + i + '" style="text-align:left;width:100%;min-height:52px"><span class="grow">' + esc(x.t) + (x.a ? '<br><small class="muted">— ' + esc(x.a) + '</small>' : '') + '</span></button>').join('');
        box.innerHTML = rows + (p.length > shown ? '<button class="btn alt" id="qmore">Show more (' + (p.length - shown) + ')</button>' : '');
      }
      const refresh = () => { paintChips(); paintList(); order = []; pos = -1; };

      $q('#qn').onclick = next; $q('#qp').onclick = prev;
      $q('#qs').onclick = () => {
        if (!current) return;
        const f = favs(), i = f.findIndex(x => x.h === current.h);
        if (i >= 0) { f.splice(i, 1); toast('Removed from saved'); }
        else { if (f.length >= FAV_MAX) { toast('Saved list is full (' + FAV_MAX + '). Remove one first.'); return; } f.unshift({ h: current.h, t: current.t, a: current.a, c: current.c }); toast('Saved'); }
        Store.set(favKey, f); paintSave(); paintChips(); if (filter === 'saved') paintList();
      };
      $q('#qd').onclick = () => { const d = new Date(), k = d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate(); show(data[(k * 2654435761 >>> 0) % data.length], true); toast('Today\'s quote'); };
      const plain = () => current ? '"' + current.t + '"' + (current.a ? ' — ' + current.a : '') : '';
      $q('#qcp').onclick = async () => { if (!current) return; toast(await copyToClipboard(plain()) ? 'Copied' : 'Could not copy'); };
      $q('#qsh').onclick = () => { if (current) shareText(cfg.name, plain() + '\n\nvia PocketKit'); };
      /* Share as a picture: the quote on a coloured card, with a style choice and a preview */
      let style = Math.floor(Math.random() * THEMES.length), busy = false;
      const paintPreview = () => {
        drawQuoteCard($q('#qcv'), current, style, cfg.name);
        $q('#qsw').innerHTML = THEMES.map((t, i) => '<button class="sw' + (i === style ? ' on' : '') + '" data-s="' + i + '" style="background:linear-gradient(135deg,' + t[0] + ',' + t[1] + ')" aria-label="Style ' + (i + 1) + '" aria-pressed="' + (i === style) + '"></button>').join('');
      };
      $q('#qpic').onclick = () => { if (!current) { toast('Pick a quote first'); return; } paintPreview(); $q('#qpv').showModal(); };
      $q('#qsw').onclick = (e) => { const b = e.target.closest('button[data-s]'); if (!b) return; style = +b.dataset.s; paintPreview(); };
      $q('#qpx').onclick = () => $q('#qpv').close();
      $q('#qpgo').onclick = async () => {
        if (busy || !current) return; busy = true;
        try {
          const blob = await new Promise((res) => $q('#qcv').toBlob(res, 'image/png'));
          if (!blob) { toast('Could not make the picture'); return; }
          if (await shareImageBlob('pocketkit-quote-' + current.h + '.png', blob, cfg.name)) toast('Picture ready');
        } catch (e) { toast('Could not share the picture'); } finally { busy = false; }
      };
      $q('#qchips').onclick = (e) => { const b = e.target.closest('.chip'); if (!b) return; filter = b.dataset.f; shown = LIST_PAGE; refresh(); if (filter !== 'all') next(); };
      let t = null;
      $q('#qfind').oninput = () => { clearTimeout(t); t = setTimeout(() => { query = $q('#qfind').value; shown = LIST_PAGE; refresh(); if (query.trim()) { const p = pool(); show(p[0] || null, false); } }, 150); };
      $q('#qlist').onclick = (e) => {
        if (e.target.closest('#qmore')) { shown += LIST_PAGE; paintList(); return; }
        const b = e.target.closest('button[data-i]'); if (!b) return; const x = pool()[+b.dataset.i]; if (x) { show(x, true); window.scrollTo(0, 0); }
      };
      /* swipe the card: left = next, right = previous */
      let sx = null; const card = $q('#qc');
      card.addEventListener('pointerdown', (e) => { sx = e.clientX; });
      card.addEventListener('pointerup', (e) => { if (sx == null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 60) (dx < 0 ? next : prev)(); });
      card.addEventListener('pointercancel', () => { sx = null; });
      if (cfg.mixer) $q('#qmix').onclick = () => { const q = cfg.mixer(); show({ t: q, a: '', c: 'mixer', s: '', h: hashOf(q) }, true); };

      paintChips(); paintList(); next();
      return () => { clearTimeout(t); };
    } });
  }

  /* ---------- Real Quotes ---------- */
  const REAL = typeof REAL_QUOTES !== 'undefined' ? REAL_QUOTES : [];
  if (REAL.length) make({
    id: 'realquotes', name: 'Real Quotes', icon: '💪', cat: 'daily', byline: true, data: REAL,
    cats: typeof REAL_CATS !== 'undefined' ? REAL_CATS : [['all', 'All']],
    desc: 'A big collection of genuine motivational quotes from real people, with the author. Shuffle, search, save favourites, share, and get a quote of the day.',
    keys: ['motivation', 'inspiration', 'quote', 'quotes', 'wisdom', 'daily quote']
  });

  /* ---------- Goofy Quotes ---------- */
  const GOOFY = typeof GOOFY_QUOTES !== 'undefined' ? GOOFY_QUOTES : [];
  const GEN = typeof GOOFY_GEN !== 'undefined' ? GOOFY_GEN : null;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const mixer = GEN && GEN.templates && GEN.templates.length ? () => {
    let out = pick(GEN.templates);
    for (let n = 0; n < 6 && /\{[a-z_]+\}/.test(out); n++) out = out.replace(/\{([a-z_]+)\}/g, (m, k) => GEN.banks[k] && GEN.banks[k].length ? pick(GEN.banks[k]) : m);
    return out.replace(/\{[a-z_]+\}/g, '').replace(/\s+/g, ' ').trim().replace(/^./, c => c.toUpperCase());
  } : null;
  if (GOOFY.length) make({
    id: 'goofyquotes', name: 'Goofy Quotes', icon: '🤡', cat: 'fun', byline: false, data: GOOFY, mixer,
    cats: typeof GOOFY_CATS !== 'undefined' ? GOOFY_CATS : [['all', 'All']],
    desc: 'Silly, original motivational quotes to make you smile, plus a Mixer that invents brand new ones every time. Save and share your favourites.',
    keys: ['funny', 'joke', 'silly', 'humour', 'humor', 'motivation', 'meme']
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = { hashOf, shuffled };
})();
