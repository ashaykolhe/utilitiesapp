'use strict';
/* More tools: currency, recipes, holidays, flashcards, trainers, creative and reference tools.
   Everything is wrapped in one function so helper names never leak. Blocks between PURE-START/PURE-END are DOM-free and unit-tested in Node. */
(() => {
const reg = (o) => Tools.register(Object.assign({ cat: 'calculate', needs: [] }, o));
const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
const fmtN = (n, d = 2) => (Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: d }) : '—');
const ld = (k, d) => Store.get(k, d);
const sv = (k, v) => { try { Store.set(k, v); } catch (e) { toast('Could not save (storage full?)'); } };
const p2 = (n) => String(n).padStart(2, '0');
const dstr = (y, m, d) => y + '-' + p2(m + 1) + '-' + p2(d);
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
/* Result history: add() stores one settled result (never throws); soon() waits about 1.5 s after the last call so only a result the person stopped on is kept. */
const kit = (id) => {
  let t = null;
  return {
    add(label, value) { try { if (typeof Hist !== 'undefined' && label && value) Hist.add(id, String(label), String(value)); } catch (e) { /* history is optional */ } },
    soon(fn) { clearTimeout(t); t = setTimeout(() => { try { fn(); } catch (e) { /* ignore */ } }, 1500); },
    stop() { clearTimeout(t); }
  };
};
const tbl = (cv, type) => new Promise((res) => cv.toBlob(res, type || 'image/png'));
const readB64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
async function saveBlob(blob, name) {
  const P = window.Capacitor && window.Capacitor.Plugins;
  if (P && P.Filesystem && P.Share) {
    try {
      const r = await P.Filesystem.writeFile({ path: name, data: await readB64(blob), directory: 'CACHE' });
      try { await P.Share.share({ title: name, url: r.uri }); } catch (e) { /* sheet closed */ }
      return;
    } catch (e) { /* fall back to download */ }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
  toast('Saved ' + name);
}
const saveText = (name, text) => saveBlob(new Blob([text], { type: 'text/plain' }), name);
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast('Copied'); }
  catch (e) {
    const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('Copied'); } catch (e2) { toast('Could not copy'); }
    ta.remove();
  }
}
/* Pick an image file and hand back a loaded HTMLImageElement (object URL revoked by cleanup). */
function pickImage(onImg) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = () => {
    const f = inp.files && inp.files[0]; if (!f) return;
    if (f.type && !/^image\//.test(f.type)) { toast('That is not a picture. Choose a JPG, PNG or WebP image.'); return; }
    if (f.size > 40 * 1048576) { toast('That picture is too large (limit 40 MB).'); return; }
    const url = URL.createObjectURL(f), im = new Image();
    im.onload = () => { URL.revokeObjectURL(url); onImg(im); };
    im.onerror = () => { URL.revokeObjectURL(url); toast('Could not open that image'); };
    im.src = url;
  };
  inp.click();
}
const chipStyle = 'padding:10px 14px;min-height:44px;border:1px solid var(--line);border-radius:99px;background:var(--surface);color:var(--text)';
const tabBar = (id, tabs, cur) => `<div id="${id}" class="row" style="gap:6px">${tabs.map(([k, l]) => `<button class="btn ${k === cur ? '' : 'alt'}" data-t="${k}" style="padding:10px 4px;min-height:44px">${l}</button>`).join('')}</div>`;

/* ================= 1. Currency Converter ================= */
// ==PURE-START==
const CUR = [['USD', 'US Dollar', 1], ['EUR', 'Euro', 0.92], ['GBP', 'British Pound', 0.79], ['INR', 'Indian Rupee', 83.5], ['JPY', 'Japanese Yen', 150], ['CNY', 'Chinese Yuan', 7.2], ['AUD', 'Australian Dollar', 1.52], ['CAD', 'Canadian Dollar', 1.36], ['CHF', 'Swiss Franc', 0.88], ['SGD', 'Singapore Dollar', 1.34], ['AED', 'UAE Dirham', 3.6725], ['SAR', 'Saudi Riyal', 3.75], ['HKD', 'Hong Kong Dollar', 7.8], ['NZD', 'New Zealand Dollar', 1.65], ['KRW', 'South Korean Won', 1330], ['MXN', 'Mexican Peso', 17.2], ['BRL', 'Brazilian Real', 5], ['ZAR', 'South African Rand', 18.5], ['RUB', 'Russian Ruble', 92], ['TRY', 'Turkish Lira', 32], ['SEK', 'Swedish Krona', 10.5], ['NOK', 'Norwegian Krone', 10.7], ['DKK', 'Danish Krone', 6.9], ['PLN', 'Polish Zloty', 4], ['THB', 'Thai Baht', 35.5], ['MYR', 'Malaysian Ringgit', 4.7], ['IDR', 'Indonesian Rupiah', 15700], ['PHP', 'Philippine Peso', 56], ['PKR', 'Pakistani Rupee', 278], ['BDT', 'Bangladeshi Taka', 110], ['LKR', 'Sri Lankan Rupee', 300], ['NPR', 'Nepalese Rupee', 133.5], ['EGP', 'Egyptian Pound', 48], ['NGN', 'Nigerian Naira', 1500], ['KES', 'Kenyan Shilling', 130], ['ILS', 'Israeli Shekel', 3.7], ['CZK', 'Czech Koruna', 23]];
const CUR_DATE = '2025-01-01';
// rates = { CODE: units of that currency per 1 USD }
const curConvert = (amt, from, to, rates) => {
  const a = rates[from], b = rates[to];
  if (!(a > 0) || !(b > 0) || !Number.isFinite(amt)) return NaN;
  return amt / a * b;
};
const curCross = (from, to, rates) => curConvert(1, from, to, rates);
const curDigits = (n) => (Math.abs(n) >= 1000 ? 2 : Math.abs(n) >= 1 ? 4 : 6);
// ==PURE-END==
reg({ id: 'currency', name: 'Currency', icon: '💱', desc: 'Convert between about 35 major currencies offline using rates you can edit and save yourself, with favourites and a swap button.', keys: ['exchange', 'forex', 'money', 'rupee', 'dollar', 'euro', 'rates'], needs: ['storage'], render(el) {
  const saved = ld('currency.data', null);
  const rates = {};
  CUR.forEach(([c, , r]) => { rates[c] = saved && saved.rates && saved.rates[c] > 0 ? saved.rates[c] : r; });
  const committed = Object.assign({}, rates);
  let edited = saved && saved.edited ? saved.edited : CUR_DATE + ' (built-in, approximate)';
  let favs = ld('currency.favs', ['USD', 'EUR', 'INR']);
  let from = ld('currency.from', 'USD'), to = ld('currency.to', 'INR'), editing = false;
  const names = {}; CUR.forEach(([c, n]) => { names[c] = n; });
  const hk = kit('currency');
  let lastRes = null; // [label, value] of the conversion on screen
  const later = () => hk.soon(() => { if (lastRes) hk.add(lastRes[0], lastRes[1]); });
  const opts = (sel) => CUR.map(([c, n]) => `<option value="${c}"${c === sel ? ' selected' : ''}>${c} - ${esc(n)}</option>`).join('');
  function draw() {
    if (editing) return drawEdit();
    el.innerHTML = `<div class="card" style="display:flex;flex-direction:column;gap:12px;padding:18px">
      <label class="f">Amount<input id="am" type="number" inputmode="decimal" min="0" max="1000000000000" step="any" value="${esc(String(ld('currency.amt', '100')))}" style="font-size:22px"></label>
      <label class="f">From<select id="fr">${opts(from)}</select></label>
      <button class="btn alt" id="sw" aria-label="Swap currencies" style="min-height:44px">⇅ Swap</button>
      <label class="f">To<select id="to">${opts(to)}</select></label>
      <div id="out" class="center" style="padding:6px 0"></div>
      <div class="row"><button class="btn alt" id="fv">${favs.includes(to) ? '★ In favourites' : '☆ Add ' + esc(to) + ' to favourites'}</button><button class="btn alt" id="ed">Edit rates</button></div>
    </div>
    <div class="card"><b>Favourites</b><div id="fl" class="list" style="margin-top:8px"></div></div>
    <div class="card muted" style="font-size:13px">Rates are <b>manual</b>: they are approximations typed in by hand and are never updated automatically (this app works offline). Rates last edited: <b>${esc(edited)}</b>. Use Edit rates to enter current rates from your bank or app.</div>`;
    const am = $('#am', el), fr = $('#fr', el), tt = $('#to', el);
    function calc() {
      let a = num(am.value); if (!(a >= 0 && a <= 1e12)) a = NaN; sv('currency.amt', am.value); sv('currency.from', from); sv('currency.to', to);
      const r = curConvert(a, from, to, rates), x = curCross(from, to, rates);
      lastRes = Number.isFinite(r) ? [fmtN(a, 4) + ' ' + from + ' to ' + to, fmtN(r, curDigits(r)) + ' ' + to + ' (1 ' + from + ' = ' + fmtN(x, 6) + ' ' + to + ')'] : null;
      $('#out', el).innerHTML = Number.isFinite(r) ? `<div class="muted">${fmtN(a, 4)} ${from} =</div><div class="mid" style="word-break:break-all">${fmtN(r, curDigits(r))} ${to}</div><div class="muted" style="font-size:13px;margin-top:4px">1 ${from} = ${fmtN(x, 6)} ${to}</div>` : '<div class="muted">Enter an amount</div>';
      $('#fl', el).innerHTML = favs.length ? favs.map((c) => { const v = curConvert(a, from, c, rates); return `<div class="item"><span class="grow"><b>${c}</b><div class="muted" style="font-size:12px">${esc(names[c] || '')}</div></span><span>${Number.isFinite(v) ? fmtN(v, curDigits(v)) : '—'}</span><button class="btn alt" data-r="${c}" aria-label="Remove ${c}" style="padding:8px 12px;min-height:44px">✕</button></div>`; }).join('') : '<div class="muted">No favourites yet. Pick a currency in To and tap Add to favourites.</div>';
      $$('[data-r]', el).forEach((b) => { b.onclick = () => { favs = favs.filter((c) => c !== b.dataset.r); sv('currency.favs', favs); draw(); }; });
    }
    am.oninput = () => { calc(); later(); }; fr.onchange = () => { from = fr.value; calc(); later(); }; tt.onchange = () => { to = tt.value; draw(); later(); };
    $('#sw', el).onclick = () => { const t = from; from = to; to = t; draw(); later(); };
    $('#fv', el).onclick = () => { if (!favs.includes(to)) favs.push(to); sv('currency.favs', favs); draw(); };
    $('#ed', el).onclick = () => { editing = true; draw(); };
    calc();
  }
  function drawEdit() {
    el.innerHTML = `<div class="card muted" style="font-size:13px">Enter how many units of each currency equal <b>1 US Dollar</b>. Rates last edited: <b>${esc(edited)}</b></div>
      <div class="list">${CUR.map(([c, n]) => `<label class="item"><span class="grow"><b>${c}</b><div class="muted" style="font-size:12px">${esc(n)}</div></span><input data-c="${c}" type="number" inputmode="decimal" min="0.000001" max="1000000000" step="any" value="${rates[c]}" style="width:130px" aria-label="${esc(n)} per US Dollar"></label>`).join('')}</div>
      <div class="row"><button class="btn" id="sa">Save rates</button><button class="btn alt" id="rs">Reset</button><button class="btn alt" id="cn">Cancel</button></div>`;
    $('#sa', el).onclick = () => {
      const nr = {};
      for (const i of $$('[data-c]', el)) { const v = num(i.value); if (!(v > 0 && v <= 1e9)) { toast('Check ' + i.dataset.c + ': rate must be above 0 and at most 1,000,000,000'); return; } nr[i.dataset.c] = v; }
      nr.USD = 1; Object.assign(rates, nr); Object.assign(committed, nr);
      const d = new Date(); edited = dstr(d.getFullYear(), d.getMonth(), d.getDate());
      sv('currency.data', { rates: nr, edited }); editing = false; toast('Rates saved'); draw();
    };
    $('#rs', el).onclick = () => { CUR.forEach(([c, , r]) => { rates[c] = r; committed[c] = r; }); edited = CUR_DATE + ' (built-in, approximate)'; sv('currency.data', null); editing = false; toast('Built-in rates restored'); draw(); };
    $('#cn', el).onclick = () => { Object.assign(rates, committed); editing = false; draw(); };
  }
  draw();
  return hk.stop;
} });

/* ================= 2. Recipe Scaler ================= */
// ==PURE-START==
const UFR = { '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8, '⅙': 1 / 6, '⅚': 5 / 6, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 };
const NUMRE = '(?:\\d+(?:[ -]\\d+\\/\\d+|[ ]?[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])|\\d+\\/\\d+|\\d*[.,]\\d+|\\d+|[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])';
const toNum = (s) => {
  s = s.trim();
  let m = /^(\d+)[ -](\d+)\/(\d+)$/.exec(s);
  if (m) return +m[3] ? +m[1] + m[2] / m[3] : NaN;
  m = /^(\d+)\/(\d+)$/.exec(s);
  if (m) return +m[2] ? m[1] / m[2] : NaN;
  m = /^(\d+) ?([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])$/.exec(s);
  if (m) return +m[1] + UFR[m[2]];
  if (UFR[s] !== undefined) return UFR[s];
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};
// Parse leading quantity (or range) of a line: { lo, hi|null, rest } or null.
const parseQty = (line) => {
  const re = new RegExp('^\\s*(' + NUMRE + ')(?:\\s*(?:-|–|to)\\s*(' + NUMRE + '))?(?![\\d/])\\s*(.*)$', 'i');
  const m = re.exec(line);
  if (!m) return null;
  const lo = toNum(m[1]), hi = m[2] ? toNum(m[2]) : null;
  if (!Number.isFinite(lo) || (m[2] && !Number.isFinite(hi))) return null;
  return { lo, hi, rest: m[3] };
};
// Format a quantity with kitchen fractions when close, else up to 2 decimals.
const fmtQty = (n) => {
  if (!Number.isFinite(n) || n < 0) return '';
  if (n === 0) return '0';
  const whole = Math.floor(n + 1e-9), f = n - whole;
  const fr = [[0, ''], [1 / 8, '1/8'], [1 / 4, '1/4'], [1 / 3, '1/3'], [3 / 8, '3/8'], [1 / 2, '1/2'], [5 / 8, '5/8'], [2 / 3, '2/3'], [3 / 4, '3/4'], [7 / 8, '7/8'], [1, '1']];
  let best = fr[0], bd = 9;
  for (const x of fr) { const d = Math.abs(f - x[0]); if (d < bd) { bd = d; best = x; } }
  if (bd < 0.02) {
    let w = whole; const t = best[1];
    if (t === '1') { w += 1; return String(w); }
    if (!t) return String(w);
    return (w ? w + ' ' : '') + t;
  }
  return String(Math.round(n * 100) / 100);
};
const scaleLine = (line, k) => {
  const q = parseQty(line);
  if (!q) return line;
  const a = fmtQty(q.lo * k), b = q.hi !== null ? fmtQty(q.hi * k) : '';
  return (b ? a + '-' + b : a) + (q.rest ? ' ' + q.rest : '');
};
const scaleRecipe = (text, from, to) => {
  const k = from > 0 && to > 0 ? to / from : NaN;
  if (!Number.isFinite(k)) return text;
  return text.split('\n').map((l) => (l.trim() ? scaleLine(l, k) : l)).join('\n');
};
// ==PURE-END==
reg({ id: 'recipescale', name: 'Recipe Scaler', icon: '🍲', desc: 'Scale a recipe ingredient list to any number of servings, understanding amounts like 1 1/2, 2.5 or 3/4 cup, and save recipes on your device.', keys: ['cooking', 'servings', 'ingredients', 'portion', 'double', 'halve'], needs: ['storage'], render(el) {
  let recipes = ld('recipescale.list', []);
  let cur = { id: null, name: '', from: 4, to: 4, text: '2 cups flour\n1 1/2 tsp baking powder\n3/4 cup sugar\n2.5 tbsp butter\n1 egg\n1/2 cup milk\nPinch of salt' };
  el.innerHTML = `<div class="card" style="display:flex;flex-direction:column;gap:12px;padding:18px">
    <label class="f">Recipe name<input id="nm" type="text" maxlength="60" placeholder="e.g. Pancakes"></label>
    <div class="row"><label class="f">Original serves<input id="fr" type="number" inputmode="decimal" min="0.5" max="1000" step="any"></label><label class="f">I want to serve<input id="to" type="number" inputmode="decimal" min="0.5" max="1000" step="any"></label></div>
    <div class="row" style="gap:6px"><button class="btn alt" data-m="0.5">Half</button><button class="btn alt" data-m="2">Double</button><button class="btn alt" data-m="3">Triple</button></div>
    <label class="f">Ingredients (one per line)<textarea id="tx" rows="8" maxlength="4000" style="font-size:15px"></textarea></label></div>
    <div class="card"><div class="muted" style="font-size:13px">Scaled to <b id="sv2"></b> servings (x<span id="kk"></span>)</div><pre id="res" style="white-space:pre-wrap;font:inherit;font-size:17px;line-height:1.7;margin:8px 0 0"></pre></div>
    <div class="row"><button class="btn" id="cp">Copy scaled</button><button class="btn alt" id="sa">Save recipe</button><button class="btn alt" id="nw">New</button></div>
    <div class="card"><b>Saved recipes</b><div id="ls" class="list" style="margin-top:8px"></div></div>
    <div class="muted" style="font-size:12px">Lines without a leading amount (like "Pinch of salt") are left as they are. Units are kept; no unit conversion is done.</div>`;
  const nm = $('#nm', el), fr = $('#fr', el), to = $('#to', el), tx = $('#tx', el);
  const hk = kit('recipescale');
  const record = () => {
    const a = num(fr.value), b = num(to.value);
    if (!(a >= 0.5 && b >= 0.5 && a <= 1000 && b <= 1000) || !tx.value.trim()) return;
    hk.add((nm.value.trim().slice(0, 40) || 'Recipe') + ': serves ' + fmtQty(a) + ' to ' + fmtQty(b), 'x' + fmtN(b / a, 3) + ' (' + tx.value.split('\n').filter((l) => l.trim()).length + ' lines scaled)');
  };
  const load = (r) => { cur = Object.assign({}, r); nm.value = cur.name; fr.value = cur.from; to.value = cur.to; tx.value = cur.text; upd(); };
  function upd() {
    const a = num(fr.value), b = num(to.value), ok = a >= 0.5 && b >= 0.5 && a <= 1000 && b <= 1000;
    $('#res', el).textContent = ok ? scaleRecipe(tx.value, a, b) : 'Enter servings from 0.5 to 1000';
    $('#sv2', el).textContent = ok ? fmtQty(b) || b : '?'; $('#kk', el).textContent = ok ? fmtN(b / a, 3) : '?';
  }
  function list() {
    $('#ls', el).innerHTML = recipes.length ? recipes.map((r) => `<div class="item"><button class="btn alt grow" data-o="${r.id}" style="text-align:left;min-height:44px">${esc(r.name || 'Untitled')}<div class="muted" style="font-size:12px">serves ${esc(String(r.from))}</div></button><button class="btn alt" data-d="${r.id}" aria-label="Delete ${esc(r.name || 'recipe')}" style="min-height:44px">🗑</button></div>`).join('') : '<div class="muted">Nothing saved yet.</div>';
    $$('[data-o]', el).forEach((b) => { b.onclick = () => load(recipes.find((r) => r.id === b.dataset.o)); });
    $$('[data-d]', el).forEach((b) => { b.onclick = () => { recipes = recipes.filter((r) => r.id !== b.dataset.d); sv('recipescale.list', recipes); list(); }; });
  }
  [nm, fr, to, tx].forEach((i) => { i.oninput = () => { upd(); hk.soon(record); }; });
  $$('[data-m]', el).forEach((b) => { b.onclick = () => { const a = num(fr.value); if (a > 0) { to.value = Math.round(a * +b.dataset.m * 100) / 100; upd(); hk.soon(record); } }; });
  $('#cp', el).onclick = () => { record(); copyText($('#res', el).textContent); };
  $('#nw', el).onclick = () => load({ id: null, name: '', from: 4, to: 4, text: '' });
  $('#sa', el).onclick = () => {
    const a = num(fr.value), b = num(to.value);
    if (!tx.value.trim()) { toast('Add some ingredients first'); return; }
    if (!(a >= 0.5 && a <= 1000) || !(b >= 0.5 && b <= 1000)) { toast('Servings must be from 0.5 to 1000'); return; }
    if (recipes.length >= 100 && !recipes.some((x) => x.id === cur.id)) { toast('Saved recipes limit reached (100)'); return; }
    const r = { id: cur.id || rid(), name: nm.value.trim().slice(0, 60), from: a, to: b, text: tx.value };
    cur.id = r.id; const i = recipes.findIndex((x) => x.id === r.id);
    if (i >= 0) recipes[i] = r; else recipes.unshift(r);
    sv('recipescale.list', recipes); list(); toast('Recipe saved');
  };
  load(cur); list();
  return hk.stop;
} });

/* ================= 3. Holiday Calendar ================= */
// ==PURE-START==
// Anonymous Gregorian algorithm (Meeus/Jones/Butcher). Returns {m: 0-11, d}.
const easter = (y) => {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return { m: mo - 1, d: da };
};
// nth (1-based) weekday (0=Sun) of a month
const nthDow = (y, m, dow, n) => 1 + ((dow - new Date(Date.UTC(y, m, 1)).getUTCDay() + 7) % 7) + (n - 1) * 7;
const FIXED = [
  [0, 1, 'New Year\'s Day', 'world'], [0, 12, 'National Youth Day', 'in'], [0, 26, 'Republic Day', 'in'], [1, 14, 'Valentine\'s Day', 'world'],
  [2, 8, 'International Women\'s Day', 'world'], [3, 14, 'Ambedkar Jayanti', 'in'], [3, 22, 'Earth Day', 'world'], [4, 1, 'Labour Day', 'world'],
  [5, 5, 'World Environment Day', 'world'], [5, 21, 'International Yoga Day', 'in'], [6, 4, 'US Independence Day', 'world'], [7, 15, 'Independence Day (India)', 'in'],
  [8, 5, 'Teachers\' Day', 'in'], [9, 2, 'Gandhi Jayanti', 'in'], [9, 31, 'Halloween', 'world'], [10, 14, 'Children\'s Day (India)', 'in'],
  [11, 10, 'Human Rights Day', 'world'], [11, 24, 'Christmas Eve', 'world'], [11, 25, 'Christmas Day', 'world'], [11, 31, 'New Year\'s Eve', 'world']
];
const addDays = (y, m, d, k) => { const t = new Date(Date.UTC(y, m, d + k)); return { m: t.getUTCMonth(), d: t.getUTCDate() }; };
// All holidays of a year: [{m, d, name, kind}] sorted by date. kind: in | world | easter
const holidaysOf = (y) => {
  const out = FIXED.map(([m, d, name, kind]) => ({ m, d, name, kind }));
  const e = easter(y);
  [[-2, 'Good Friday'], [0, 'Easter Sunday'], [1, 'Easter Monday']].forEach(([k, name]) => { const t = addDays(y, e.m, e.d, k); out.push({ m: t.m, d: t.d, name, kind: 'easter' }); });
  out.push({ m: 4, d: nthDow(y, 4, 0, 2), name: 'Mother\'s Day', kind: 'world' }, { m: 5, d: nthDow(y, 5, 0, 3), name: 'Father\'s Day', kind: 'world' });
  return out.sort((a, b) => a.m - b.m || a.d - b.d);
};
// ==PURE-END==
reg({ id: 'holidays', name: 'Holiday Calendar', icon: '🎉', cat: 'daily', desc: 'Month calendar with fixed Indian and international holidays plus computed Easter and Good Friday, and your own dated events saved on the device.', keys: ['festival', 'republic day', 'independence day', 'easter', 'events', 'public holiday'], needs: ['storage'], render(el) {
  const now = new Date();
  let y = now.getFullYear(), mo = now.getMonth(), sel = dstr(y, mo, now.getDate());
  let events = ld('holidays.events', []);
  let show = ld('holidays.show', { in: true, world: true, easter: true });
  const MN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const kindDot = { in: '#f59e0b', world: '#3b82f6', easter: '#a855f7', mine: 'var(--accent)' };
  const kindName = { in: 'India', world: 'International', easter: 'Easter', mine: 'Mine' };
  function eventsOn(Y, M, D) {
    const r = holidaysOf(Y).filter((h) => h.m === M && h.d === D && show[h.kind]);
    const ds = dstr(Y, M, D);
    events.forEach((e) => { if (e.date === ds || (e.yearly && e.date.slice(5) === ds.slice(5) && +e.date.slice(0, 4) <= Y)) r.push({ name: e.title, kind: 'mine', id: e.id }); });
    return r;
  }
  function draw() {
    const first = new Date(Date.UTC(y, mo, 1)).getUTCDay(), dim = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
    const today = dstr(now.getFullYear(), now.getMonth(), now.getDate());
    let cells = '';
    for (let i = 0; i < first; i++) cells += '<span></span>';
    for (let d = 1; d <= dim; d++) {
      const ds = dstr(y, mo, d), ev = eventsOn(y, mo, d), kinds = [...new Set(ev.map((e) => e.kind))];
      cells += `<button data-d="${ds}" aria-label="${d} ${MN[mo]}${ev.length ? ', ' + ev.length + ' events' : ''}" style="min-height:48px;border-radius:12px;border:${ds === sel ? '2px solid var(--accent)' : '1px solid var(--line)'};background:${ds === today ? 'var(--surface2)' : 'var(--surface)'};color:var(--text);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-weight:${ds === today ? 700 : 400}">${d}<span style="display:flex;gap:3px;height:6px">${kinds.map((k) => `<i style="width:6px;height:6px;border-radius:50%;background:${kindDot[k]}"></i>`).join('')}</span></button>`;
    }
    const month = [];
    for (let d = 1; d <= dim; d++) eventsOn(y, mo, d).forEach((e) => month.push({ d, e }));
    const selEv = (() => { const [Y, M, D] = sel.split('-').map(Number); return eventsOn(Y, M - 1, D); })();
    el.innerHTML = `<div class="card" style="padding:14px"><div class="row" style="margin-bottom:10px"><button class="btn alt" id="pv" aria-label="Previous month" style="flex:0 0 52px;min-height:44px">‹</button><div class="mid" style="font-size:20px">${MN[mo]} ${y}</div><button class="btn alt" id="nx" aria-label="Next month" style="flex:0 0 52px;min-height:44px">›</button></div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center;font-size:12px;margin-bottom:4px" class="muted">${['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((x) => `<span>${x}</span>`).join('')}</div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">${cells}</div>
      <div class="row" style="flex-wrap:wrap;gap:6px;margin-top:12px">${['in', 'world', 'easter'].map((k) => `<label style="display:flex;align-items:center;gap:6px;min-height:44px;padding:0 8px;font-size:13px"><input type="checkbox" data-k="${k}"${show[k] ? ' checked' : ''}><i style="width:10px;height:10px;border-radius:50%;background:${kindDot[k]}"></i>${kindName[k]}</label>`).join('')}</div></div>
      <div class="card"><b>${esc(sel)}</b><div class="list" style="margin-top:8px">${selEv.length ? selEv.map((e) => `<div class="item"><i style="width:10px;height:10px;border-radius:50%;background:${kindDot[e.kind]}"></i><span class="grow">${esc(e.name)}<div class="muted" style="font-size:12px">${kindName[e.kind]}</div></span>${e.id ? `<button class="btn alt" data-x="${e.id}" aria-label="Delete event" style="min-height:44px">🗑</button>` : ''}</div>`).join('') : '<div class="muted">No events on this day.</div>'}</div></div>
      <div class="card" style="display:flex;flex-direction:column;gap:10px"><b>Add your own event</b>
        <label class="f">Title<input id="et" type="text" maxlength="60" placeholder="e.g. Anniversary"></label>
        <label class="f">Date<input id="ed" type="date" min="1900-01-01" max="2100-12-31" value="${sel}"></label>
        <label style="display:flex;align-items:center;gap:8px;min-height:44px"><input type="checkbox" id="ey"> Repeats every year</label>
        <button class="btn" id="ea">Add event</button></div>
      <div class="card"><b>This month</b><div class="list" style="margin-top:8px">${month.length ? month.map((x) => `<div class="item"><b style="width:28px">${x.d}</b><span class="grow">${esc(x.e.name)}</span></div>`).join('') : '<div class="muted">Nothing this month.</div>'}</div></div>
      <div class="muted" style="font-size:12px">Only holidays with fixed dates are listed (plus Easter and Mother's/Father's Day). Movable festivals such as Diwali, Holi and Eid change every year and are not included. Add them as your own events.</div>`;
    $$('[data-d]', el).forEach((b) => { b.onclick = () => { sel = b.dataset.d; draw(); }; });
    $('#pv', el).onclick = () => { if (y <= 1900 && mo === 0) return; mo--; if (mo < 0) { mo = 11; y--; } draw(); };
    $('#nx', el).onclick = () => { if (y >= 2100 && mo === 11) return; mo++; if (mo > 11) { mo = 0; y++; } draw(); };
    $$('[data-k]', el).forEach((c) => { c.onchange = () => { show[c.dataset.k] = c.checked; sv('holidays.show', show); draw(); }; });
    $$('[data-x]', el).forEach((b) => { b.onclick = () => { events = events.filter((e) => e.id !== b.dataset.x); sv('holidays.events', events); draw(); }; });
    $('#ea', el).onclick = () => {
      const t = $('#et', el).value.trim(), dt = $('#ed', el).value;
      if (!t) { toast('Give the event a title'); return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dt)) { toast('Pick a date'); return; }
      if (dt < '1900-01-01' || dt > '2100-12-31') { toast('Pick a date between 1900 and 2100'); return; }
      if (events.length >= 300) { toast('Event limit reached (300)'); return; }
      events.push({ id: rid(), date: dt, title: t.slice(0, 60), yearly: $('#ey', el).checked });
      sv('holidays.events', events); sel = dt; y = +dt.slice(0, 4); mo = +dt.slice(5, 7) - 1; toast('Event added'); draw();
    };
  }
  draw();
} });

/* ================= 4. Flashcards ================= */
// ==PURE-START==
const LEITNER = [1, 2, 4, 8, 16]; // days until the next review for box 1..5
const dayNum = (d) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
const fcNew = (q, a, today, id) => ({ id, q, a, box: 1, due: today, seen: 0, right: 0 });
const fcReview = (c, correct, today) => {
  const box = correct ? Math.min(5, c.box + 1) : 1;
  return Object.assign({}, c, { box, due: today + LEITNER[box - 1], seen: c.seen + 1, right: c.right + (correct ? 1 : 0) });
};
const fcDue = (cards, today) => cards.filter((c) => c.due <= today);
const fcStats = (cards, today) => {
  const boxes = [0, 0, 0, 0, 0]; let seen = 0, right = 0;
  cards.forEach((c) => { boxes[c.box - 1]++; seen += c.seen; right += c.right; });
  return { total: cards.length, due: fcDue(cards, today).length, boxes, seen, acc: seen ? Math.round(right / seen * 100) : null, mastered: boxes[4] };
};
// Text format: lines "front :: back" (or tab-separated); "# Deck name" starts a deck.
const fcParse = (text) => {
  const decks = []; let cur = null;
  String(text).split(/\r?\n/).forEach((raw) => {
    const line = raw.trim();
    if (!line) return;
    const hm = /^#\s*(.+)$/.exec(line);
    if (hm) { cur = { name: hm[1].trim(), cards: [] }; decks.push(cur); return; }
    let i = line.indexOf('::'), w = 2;
    if (i < 0) { i = line.indexOf('\t'); w = 1; }
    if (i <= 0) return;
    const q = line.slice(0, i).trim(), a = line.slice(i + w).trim();
    if (!q || !a) return;
    if (!cur) { cur = { name: 'Imported', cards: [] }; decks.push(cur); }
    cur.cards.push({ q, a });
  });
  return decks;
};
const fcExport = (decks) => decks.map((d) => '# ' + d.name + '\n' + d.cards.map((c) => c.q.replace(/\n/g, ' ') + ' :: ' + c.a.replace(/\n/g, ' ')).join('\n')).join('\n\n');
// ==PURE-END==
reg({ id: 'flashcards', name: 'Flashcards', icon: '📇', cat: 'text', desc: 'Make decks of flashcards and study them with Leitner-box spaced repetition, with due dates, stats and import or export as plain text.', keys: ['study', 'learn', 'spaced repetition', 'leitner', 'revision', 'memorise', 'quiz'], needs: ['storage'], render(el) {
  let decks = ld('flashcards.decks', []);
  let view = 'home', deckId = null, tab = 'review', queue = [], shown = false, qi = 0;
  const today = () => dayNum(new Date());
  const save = () => sv('flashcards.decks', decks);
  const deck = () => decks.find((d) => d.id === deckId);
  function home() {
    const t = today();
    el.innerHTML = `<div class="card" style="display:flex;flex-direction:column;gap:10px"><b>New deck</b><div class="row"><input id="dn" type="text" maxlength="40" placeholder="Deck name" aria-label="Deck name"><button class="btn" id="da" style="flex:0 0 90px;min-height:44px">Add</button></div></div>
      <div class="list">${decks.length ? decks.map((d) => { const s = fcStats(d.cards, t); return `<button class="item" data-o="${d.id}" style="width:100%;text-align:left;color:var(--text);min-height:60px"><span class="grow"><b>${esc(d.name)}</b><div class="muted" style="font-size:12px">${s.total} cards</div></span><span class="probadge" style="${s.due ? '' : 'background:var(--surface2);color:var(--muted)'}">${s.due} due</span></button>`; }).join('') : '<div class="card muted center" style="padding:28px">No decks yet. Create one above, or import text in a deck.</div>'}</div>
      <div class="card" style="display:flex;flex-direction:column;gap:8px"><b>Import decks from text</b><textarea id="im" rows="4" maxlength="100000" placeholder="# Spanish&#10;hola :: hello&#10;gracias :: thank you" aria-label="Text to import"></textarea><button class="btn alt" id="ib">Import</button></div>`;
    $('#da', el).onclick = () => {
      const n = $('#dn', el).value.trim(); if (!n) { toast('Name the deck'); return; }
      if (decks.length >= 50) { toast('Deck limit reached (50)'); return; }
      decks.push({ id: rid(), name: n, cards: [] }); save(); home();
    };
    $$('[data-o]', el).forEach((b) => { b.onclick = () => { deckId = b.dataset.o; view = 'deck'; tab = 'review'; startQueue(); draw(); }; });
    $('#ib', el).onclick = () => {
      const ps = fcParse($('#im', el).value); if (!ps.length) { toast('Nothing to import. Use: front :: back'); return; }
      const t2 = today(); let n = 0; if (decks.length + ps.length > 50) { toast('That would go over 50 decks. Import fewer decks.'); return; }
      ps.forEach((p) => { decks.push({ id: rid(), name: p.name.slice(0, 40), cards: p.cards.slice(0, 2000).map((c) => fcNew(c.q.slice(0, 300), c.a.slice(0, 300), t2, rid())) }); n += p.cards.length; });
      save(); toast('Imported ' + n + ' cards'); home();
    };
  }
  function startQueue() { queue = fcDue(deck().cards, today()).map((c) => c.id).sort(() => Math.random() - 0.5); qi = 0; shown = false; }
  function draw() { if (view === 'home') home(); else deckView(); }
  function deckView() {
    const d = deck(); if (!d) { view = 'home'; home(); return; }
    el.innerHTML = `<div class="row" style="gap:6px"><button class="btn alt" id="bk" style="flex:0 0 auto;min-height:44px">‹ Decks</button><b class="grow" style="text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(d.name)}</b></div>${tabBar('tb', [['review', 'Review'], ['cards', 'Cards'], ['stats', 'Stats'], ['io', 'Text']], tab)}<div id="pane" style="display:flex;flex-direction:column;gap:12px"></div>`;
    $('#bk', el).onclick = () => { view = 'home'; draw(); };
    $$('#tb button', el).forEach((b) => { b.onclick = () => { tab = b.dataset.t; if (tab === 'review') startQueue(); deckView(); }; });
    const p = $('#pane', el);
    ({ review, cards, stats, io })[tab](d, p);
  }
  function review(d, p) {
    const c = d.cards.find((x) => x.id === queue[qi]);
    if (!d.cards.length) { p.innerHTML = '<div class="card muted center" style="padding:28px">This deck is empty. Add cards in the Cards tab.</div>'; return; }
    if (!c) {
      const nextDue = d.cards.map((x) => x.due).sort((a, b) => a - b)[0], dd = nextDue - today();
      p.innerHTML = `<div class="card center" style="padding:30px"><div style="font-size:42px">🎉</div><div class="mid">All caught up</div><div class="muted" style="margin-top:6px">${dd > 0 ? 'Next card is due in ' + dd + ' day' + (dd === 1 ? '' : 's') : 'Nothing due right now.'}</div></div><button class="btn alt" id="all">Practise all cards anyway</button>`;
      $('#all', el).onclick = () => { queue = d.cards.map((x) => x.id).sort(() => Math.random() - 0.5); qi = 0; shown = false; deckView(); };
      return;
    }
    p.innerHTML = `<div class="muted center" style="font-size:13px">Card ${qi + 1} of ${queue.length} · Box ${c.box}</div>
      <div class="card center" style="padding:28px 18px;min-height:170px;display:flex;flex-direction:column;justify-content:center;gap:14px"><div style="font-size:22px;font-weight:600;word-break:break-word">${esc(c.q)}</div>${shown ? `<hr style="border:0;border-top:1px solid var(--line);width:100%"><div style="font-size:20px;color:var(--accent);word-break:break-word">${esc(c.a)}</div>` : ''}</div>
      ${shown ? '<div class="row"><button class="btn danger" id="no" style="min-height:52px">Missed it</button><button class="btn" id="yes" style="min-height:52px;background:var(--ok)">Got it</button></div>' : '<button class="btn" id="sh" style="min-height:52px">Show answer</button>'}`;
    if (!shown) $('#sh', el).onclick = () => { shown = true; deckView(); };
    else {
      const ans = (ok) => { const i = d.cards.findIndex((x) => x.id === c.id); d.cards[i] = fcReview(c, ok, today()); save(); if (!ok) queue.push(c.id); qi++; shown = false; deckView(); };
      $('#yes', el).onclick = () => ans(true); $('#no', el).onclick = () => ans(false);
    }
  }
  function cards(d, p) {
    p.innerHTML = `<div class="card" style="display:flex;flex-direction:column;gap:10px"><b>Add card</b><label class="f">Front<input id="q" type="text" maxlength="300"></label><label class="f">Back<input id="a" type="text" maxlength="300"></label><button class="btn" id="ad">Add card</button></div>
      <div class="list">${d.cards.map((c) => `<div class="item"><span class="grow"><b>${esc(c.q)}</b><div class="muted" style="font-size:13px">${esc(c.a)}</div><div class="muted" style="font-size:11px">Box ${c.box} · due ${c.due <= today() ? 'now' : 'in ' + (c.due - today()) + 'd'}</div></span><button class="btn alt" data-x="${c.id}" aria-label="Delete card" style="min-height:44px">🗑</button></div>`).join('')}</div>
      <button class="btn danger" id="dd">Delete this deck</button>`;
    $('#ad', el).onclick = () => {
      const q = $('#q', el).value.trim(), a = $('#a', el).value.trim(); if (!q || !a) { toast('Fill both sides'); return; }
      if (d.cards.length >= 2000) { toast('Deck limit reached (2000 cards)'); return; }
      d.cards.push(fcNew(q, a, today(), rid())); save(); deckView();
    };
    $$('[data-x]', el).forEach((b) => { b.onclick = () => { d.cards = d.cards.filter((c) => c.id !== b.dataset.x); save(); deckView(); }; });
    $('#dd', el).onclick = () => { if (!confirm('Delete deck "' + d.name + '" and all its cards?')) return; decks = decks.filter((x) => x.id !== d.id); save(); view = 'home'; draw(); };
  }
  function stats(d, p) {
    const s = fcStats(d.cards, today()), mx = Math.max(1, ...s.boxes);
    p.innerHTML = `<div class="card"><div class="row center"><div><div class="mid">${s.total}</div><div class="muted" style="font-size:12px">cards</div></div><div><div class="mid">${s.due}</div><div class="muted" style="font-size:12px">due now</div></div><div><div class="mid">${s.acc === null ? '—' : s.acc + '%'}</div><div class="muted" style="font-size:12px">accuracy</div></div></div></div>
      <div class="card"><b>Leitner boxes</b><div style="margin-top:10px;display:flex;flex-direction:column;gap:8px">${s.boxes.map((n, i) => `<div style="display:flex;align-items:center;gap:8px"><span style="width:70px;font-size:13px" class="muted">Box ${i + 1} · ${LEITNER[i]}d</span><div class="progress grow" style="flex:1"><i style="width:${n / mx * 100}%"></i></div><b style="width:28px;text-align:right">${n}</b></div>`).join('')}</div><div class="muted" style="font-size:12px;margin-top:10px">A correct answer moves a card up one box (longer wait). A miss sends it back to box 1. Mastered (box 5): ${s.mastered}. Total reviews: ${s.seen}.</div></div>`;
  }
  function io(d, p) {
    p.innerHTML = `<div class="card" style="display:flex;flex-direction:column;gap:8px"><b>Export</b><textarea id="ex" rows="6" readonly aria-label="Exported deck text">${esc(fcExport([d]))}</textarea><div class="row"><button class="btn alt" id="cx">Copy</button><button class="btn alt" id="sx">Save file</button></div></div>
      <div class="card" style="display:flex;flex-direction:column;gap:8px"><b>Add cards from text</b><textarea id="im" rows="5" maxlength="100000" placeholder="front :: back" aria-label="Text to import"></textarea><button class="btn" id="ib">Add to this deck</button></div>`;
    $('#cx', el).onclick = () => copyText($('#ex', el).value);
    $('#sx', el).onclick = () => saveText((d.name.replace(/[^\w\- ]+/g, '') || 'deck') + '.txt', $('#ex', el).value);
    $('#ib', el).onclick = () => {
      const ps = fcParse($('#im', el).value), cs = [].concat(...ps.map((x) => x.cards)); if (!cs.length) { toast('Nothing to import. Use: front :: back'); return; }
      const t = today(), add = cs.slice(0, Math.max(0, 2000 - d.cards.length)); if (!add.length) { toast('Deck limit reached (2000 cards)'); return; } add.forEach((c) => d.cards.push(fcNew(c.q.slice(0, 300), c.a.slice(0, 300), t, rid())));
      save(); toast('Added ' + add.length + ' cards' + (cs.length > add.length ? ' (deck limit 2000)' : '')); deckView();
    };
  }
  draw();
} });

/* ================= 5. Morse Trainer ================= */
// ==PURE-START==
const MT = { A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..', 0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.' };
const MT_LEVELS = [['Level 1: E T A N', 'ETAN'], ['Level 2: 8 letters', 'ETANISMO'], ['Level 3: 16 letters', 'ETANISMOHDRLUCWF'], ['Level 4: all letters', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'], ['Level 5: letters + digits', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789']];
// Tone segments for one character: [{at, len}] in seconds. Dot = 1 unit, dash = 3, gap inside a letter = 1 unit.
const mtSegments = (code, unit) => {
  const out = []; let t = 0;
  for (let i = 0; i < code.length; i++) {
    const len = (code[i] === '.' ? 1 : 3) * unit;
    out.push({ at: t, len }); t += len + unit;
  }
  return { segs: out, total: t - unit };
};
const mtUnit = (wpm) => 1.2 / Math.max(5, wpm); // PARIS standard: 50 units per word
// ==PURE-END==
reg({ id: 'morsetrainer', name: 'Morse Trainer', icon: '🎶', cat: 'audio', desc: 'Learn to hear Morse code: it plays a letter as beeps, you tap or type what you heard, with five levels, adjustable speed and an accuracy score.', keys: ['morse', 'cw', 'ham radio', 'telegraph', 'learn', 'listen'], needs: [], render(el) {
  let ctx = null, level = ld('morsetrainer.level', 0), wpm = ld('morsetrainer.wpm', 12), cur = '', answered = true, ok = 0, tot = 0, streak = 0, best = ld('morsetrainer.best', 0);
  const timers = [];
  el.innerHTML = `<div class="card" style="display:flex;flex-direction:column;gap:12px;padding:18px">
    <label class="f">Level<select id="lv">${MT_LEVELS.map((l, i) => `<option value="${i}"${i === level ? ' selected' : ''}>${l[0]}</option>`).join('')}</select></label>
    <label class="f">Speed: <b id="wv">${wpm}</b> words per minute<input id="wp" type="range" min="5" max="25" value="${wpm}" style="min-height:44px"></label>
    <div class="center" style="min-height:120px;display:flex;flex-direction:column;align-items:center;justify-content:center"><div id="big" class="big" style="margin:0">?</div><div id="pat" class="muted" style="letter-spacing:4px;font-size:22px;min-height:30px"></div><div id="msg" class="muted" style="font-size:14px">Press Play to hear a letter</div></div>
    <div class="row"><button class="btn" id="pl" style="min-height:52px">▶ Play next</button><button class="btn alt" id="rp" style="min-height:52px">↺ Repeat</button></div></div>
    <div id="pad" style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px"></div>
    <div class="card"><div class="row center"><div><div class="mid" id="s1">0</div><div class="muted" style="font-size:12px">correct</div></div><div><div class="mid" id="s2">—</div><div class="muted" style="font-size:12px">accuracy</div></div><div><div class="mid" id="s3">0</div><div class="muted" style="font-size:12px">streak (best <span id="s4">${best}</span>)</div></div></div></div>
    <div class="muted" style="font-size:12px">Tip: listen for the rhythm rather than counting dots and dashes. You can also type the letter on a keyboard.</div>`;
  const $m = (s) => $(s, el);
  function ensure() {
    if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) { $m('#msg').textContent = 'Audio is not supported on this device'; return null; } ctx = new AC(); }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function playChar(ch) {
    const c = ensure(); if (!c) return;
    const u = mtUnit(wpm), s = mtSegments(MT[ch], u), t0 = c.currentTime + 0.08;
    s.segs.forEach((g) => {
      const o = c.createOscillator(), gn = c.createGain();
      o.type = 'sine'; o.frequency.value = 640; o.connect(gn); gn.connect(c.destination);
      gn.gain.setValueAtTime(0, t0 + g.at); gn.gain.linearRampToValueAtTime(0.4, t0 + g.at + 0.008);
      gn.gain.setValueAtTime(0.4, t0 + g.at + g.len - 0.008); gn.gain.linearRampToValueAtTime(0, t0 + g.at + g.len);
      o.start(t0 + g.at); o.stop(t0 + g.at + g.len + 0.02);
    });
  }
  function next() {
    const set = MT_LEVELS[level][1]; let n = cur;
    while (n === cur && set.length > 1) n = set[Math.floor(Math.random() * set.length)];
    cur = n; answered = false; $m('#big').textContent = '?'; $m('#pat').textContent = ''; $m('#msg').textContent = 'Which character was that?';
    playChar(cur);
  }
  function answer(ch) {
    if (!cur || answered) return;
    answered = true; tot++;
    const good = ch === cur;
    if (good) { ok++; streak++; if (streak > best) { best = streak; sv('morsetrainer.best', best); } } else streak = 0;
    $m('#big').textContent = cur; $m('#big').style.color = good ? 'var(--ok)' : 'var(--danger)';
    $m('#pat').textContent = MT[cur].replace(/\./g, '•').replace(/-/g, '–');
    $m('#msg').textContent = good ? 'Correct!' : 'You answered ' + ch + '. It was ' + cur + '.';
    $m('#s1').textContent = ok; $m('#s2').textContent = Math.round(ok / tot * 100) + '%'; $m('#s3').textContent = streak; $m('#s4').textContent = best;
    timers.push(setTimeout(() => { $m('#big').style.color = ''; if (el.isConnected) next(); }, 1400));
  }
  function pad() {
    const set = MT_LEVELS[level][1];
    $m('#pad').innerHTML = set.split('').map((ch) => `<button class="btn alt" data-c="${ch}" style="min-height:48px;padding:0;font-size:18px">${ch}</button>`).join('');
    $$('[data-c]', el).forEach((b) => { b.onclick = () => answer(b.dataset.c); });
  }
  const onKey = (e) => { if (e.ctrlKey || e.metaKey || e.altKey) return; const k = e.key.toUpperCase(); if (k.length === 1 && MT_LEVELS[level][1].includes(k)) answer(k); };
  window.addEventListener('keydown', onKey);
  $m('#lv').onchange = (e) => { level = +e.target.value; sv('morsetrainer.level', level); cur = ''; answered = true; ok = tot = streak = 0; pad(); };
  $m('#wp').oninput = (e) => { wpm = +e.target.value; $m('#wv').textContent = wpm; sv('morsetrainer.wpm', wpm); };
  $m('#pl').onclick = () => { timers.forEach(clearTimeout); next(); };
  $m('#rp').onclick = () => { if (cur) playChar(cur); };
  pad();
  return () => { window.removeEventListener('keydown', onKey); timers.forEach(clearTimeout); if (ctx) { try { ctx.close(); } catch (e) { /* already closed */ } ctx = null; } };
} });

/* ================= 6. Paint Mixer ================= */
// ==PURE-START==
const hex2rgb = (h) => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(h).trim());
  if (!m) return null;
  let s = m[1]; if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
};
const rgb2hex = (r) => '#' + r.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
// Weighted mix of [{hex, w}]; null when nothing valid.
const mixColours = (list) => {
  let tw = 0; const acc = [0, 0, 0];
  list.forEach((c) => { const r = hex2rgb(c.hex); if (r && c.w > 0) { tw += c.w; for (let i = 0; i < 3; i++) acc[i] += r[i] * c.w; } });
  return tw > 0 ? rgb2hex(acc.map((v) => v / tw)) : null;
};
const rgb2hsl = ([r, g, b]) => {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let h = 0, s = 0;
  if (d) {
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [h, s * 100, l * 100];
};
const hsl2rgb = ([h, s, l]) => {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
};
const rotateHue = (hex, deg) => { const r = hex2rgb(hex); if (!r) return null; const [h, s, l] = rgb2hsl(r); return rgb2hex(hsl2rgb([h + deg, s, l])); };
const palettes = (hex) => ({
  Complementary: [hex, rotateHue(hex, 180)],
  Analogous: [rotateHue(hex, -30), hex, rotateHue(hex, 30)],
  Triadic: [hex, rotateHue(hex, 120), rotateHue(hex, 240)],
  'Split complementary': [hex, rotateHue(hex, 150), rotateHue(hex, 210)],
  Tetradic: [hex, rotateHue(hex, 90), rotateHue(hex, 180), rotateHue(hex, 270)]
});
// ==PURE-END==
reg({ id: 'colourmix', name: 'Paint Mixer', icon: '🪣', cat: 'create', desc: 'Mix two or three colours by ratio to see the resulting HEX code, then generate complementary, analogous, triadic and other matching palettes.', keys: ['colour mix', 'color mix', 'blend', 'palette', 'hex', 'complementary', 'triadic', 'analogous', 'swatch'], needs: [], render(el) {
  let cols = ld('colourmix.cols', [{ hex: '#E63946', w: 1 }, { hex: '#1D3557', w: 1 }, { hex: '#F1FA3B', w: 0 }]);
  const row = (c, i) => `<div class="item" style="flex-wrap:wrap"><input type="color" data-p="${i}" value="${esc(rgb2hex(hex2rgb(c.hex) || [0, 0, 0]).toLowerCase())}" aria-label="Colour ${i + 1}" style="width:54px;height:48px;padding:2px;border:0;background:none;flex:0 0 54px"><input type="text" data-h="${i}" value="${esc(c.hex)}" maxlength="7" aria-label="HEX of colour ${i + 1}" style="flex:1;min-width:90px;font-family:monospace"><label class="f" style="flex:1 1 100%">Parts: <b data-wv="${i}">${c.w}</b><input type="range" data-w="${i}" min="0" max="10" step="1" value="${c.w}" style="min-height:44px"></label></div>`;
  el.innerHTML = `<div class="card" style="display:flex;flex-direction:column;gap:10px;padding:18px"><b>Colours to mix</b><div class="list">${cols.map(row).join('')}</div><div class="muted" style="font-size:12px">Set parts to 0 to leave a colour out. Mixing 2 : 1 gives the first colour twice as much weight.</div></div>
    <div class="card center"><div class="muted" style="font-size:13px">Result</div><div id="rs" style="height:110px;border-radius:16px;margin:8px 0;border:1px solid var(--line)"></div><div class="mid" id="rh" style="font-family:monospace"></div><div id="rr" class="muted" style="font-size:13px"></div><button class="btn alt" id="cp" style="margin-top:10px;min-height:44px">Copy HEX</button></div>
    <div id="pal" style="display:flex;flex-direction:column;gap:12px"></div>
    <div class="muted" style="font-size:12px">Mixing is a simple average of screen colours (RGB), so blue plus yellow gives grey rather than the green you get with real paint. Treat it as a guide.</div>`;
  let result = '#000000';
  const sw = (hx) => `<button data-cp="${hx}" aria-label="Copy ${hx}" style="flex:1;min-height:64px;border:1px solid var(--line);border-radius:12px;background:${hx};color:${(rgb2hsl(hex2rgb(hx))[2] > 55) ? '#000' : '#fff'};font:600 11px monospace">${hx}</button>`;
  function upd() {
    sv('colourmix.cols', cols);
    const m = mixColours(cols);
    if (!m) { $('#rh', el).textContent = 'Add some parts'; $('#rs', el).style.background = 'var(--surface2)'; $('#pal', el).innerHTML = ''; $('#rr', el).textContent = ''; return; }
    result = m; $('#rs', el).style.background = m; $('#rh', el).textContent = m;
    const [r, g, b] = hex2rgb(m); $('#rr', el).textContent = `RGB ${r}, ${g}, ${b}`;
    $('#pal', el).innerHTML = Object.entries(palettes(m)).map(([n, a]) => `<div class="card"><b style="font-size:14px">${n}</b><div class="row" style="margin-top:8px;gap:6px">${a.map(sw).join('')}</div></div>`).join('');
    $$('[data-cp]', el).forEach((b) => { b.onclick = () => copyText(b.dataset.cp); });
  }
  $$('[data-p]', el).forEach((i) => { i.oninput = () => { const k = +i.dataset.p; cols[k].hex = i.value.toUpperCase(); $(`[data-h="${k}"]`, el).value = cols[k].hex; upd(); }; });
  $$('[data-h]', el).forEach((i) => { i.oninput = () => { const k = +i.dataset.h, r = hex2rgb(i.value); if (r) { cols[k].hex = rgb2hex(r); $(`[data-p="${k}"]`, el).value = cols[k].hex.toLowerCase(); upd(); } }; });
  $$('[data-w]', el).forEach((i) => { i.oninput = () => { const k = +i.dataset.w; cols[k].w = +i.value; $(`[data-wv="${k}"]`, el).textContent = i.value; upd(); }; });
  $('#cp', el).onclick = () => copyText(result);
  upd();
} });

/* ================= 7. Pixel Art Maker ================= */
// ==PURE-START==
// grid = flat array of n*n cells (null or colour string). Returns a new array.
const pxFill = (grid, n, x, y, colour) => {
  const out = grid.slice(), target = out[y * n + x];
  if (target === colour) return out;
  const stack = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop();
    if (cx < 0 || cy < 0 || cx >= n || cy >= n || out[cy * n + cx] !== target) continue;
    out[cy * n + cx] = colour;
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  return out;
};
// Cells on the straight line between two points (so fast strokes leave no gaps).
const pxLine = (x0, y0, x1, y1) => {
  const pts = []; let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
  for (;;) {
    pts.push([x0, y0]);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
  return pts;
};
// ==PURE-END==
reg({ id: 'pixelart', name: 'Pixel Art', icon: '👾', cat: 'create', desc: 'Draw pixel art on a 16 by 16 or 32 by 32 grid with a colour palette, fill bucket, eraser and undo, then export a sharp enlarged PNG.', keys: ['sprite', 'draw', 'pixel', 'icon', 'retro', '8-bit', 'paint'], needs: ['storage'], render(el) {
  const PAL = ['#000000', '#ffffff', '#7f7f7f', '#c3c3c3', '#e63946', '#f4845f', '#ffd166', '#f1fa3b', '#06d6a0', '#2a9d4a', '#118ab2', '#073b4c', '#7c5cff', '#d946ef', '#8b5a2b', '#ffc8a2'];
  const saved = ld('pixelart.state', null);
  let n = saved && (saved.n === 16 || saved.n === 32) ? saved.n : 16;
  let grid = saved && saved.grid && saved.grid.length === n * n ? saved.grid : new Array(n * n).fill(null);
  let colour = '#e63946', tool = 'pen', undo = [], down = false, last = null, showGrid = true, savedTimer = 0;
  el.innerHTML = `<div class="card" style="padding:10px"><canvas id="cv" width="512" height="512" style="background:#fff;image-rendering:pixelated;touch-action:none;border-radius:10px" aria-label="Pixel drawing area"></canvas></div>
    <div class="row" style="gap:6px">${[['pen', '✏️ Pen'], ['er', '🧽 Erase'], ['fl', '🪣 Fill'], ['ey', '💧 Pick']].map(([k, l]) => `<button class="btn alt" data-t="${k}" style="padding:8px 2px;min-height:48px;font-size:13px">${l}</button>`).join('')}</div>
    <div class="card"><div id="pal" style="display:grid;grid-template-columns:repeat(8,1fr);gap:8px"></div><div class="row" style="margin-top:10px"><label class="f">Custom colour<input type="color" id="cc" value="#e63946" style="height:48px;padding:2px"></label><div id="cur" style="height:48px;border-radius:12px;border:1px solid var(--line);margin-top:20px"></div></div></div>
    <div class="row"><button class="btn alt" id="un" style="min-height:48px">↶ Undo</button><button class="btn alt" id="gr" style="min-height:48px">Grid: on</button><button class="btn alt" id="sz" style="min-height:48px"></button></div>
    <div class="row"><button class="btn" id="ex" style="min-height:48px">Export PNG</button><button class="btn danger" id="cl" style="min-height:48px">Clear</button></div>`;
  const cv = $('#cv', el), g = cv.getContext('2d');
  function draw() {
    const s = 512 / n; g.clearRect(0, 0, 512, 512);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const c = grid[y * n + x];
      g.fillStyle = c || ((x + y) % 2 ? '#eeeeee' : '#ffffff'); g.fillRect(x * s, y * s, s, s);
    }
    if (showGrid) { g.strokeStyle = 'rgba(0,0,0,.15)'; g.lineWidth = 1; g.beginPath(); for (let i = 0; i <= n; i++) { g.moveTo(i * s + .5, 0); g.lineTo(i * s + .5, 512); g.moveTo(0, i * s + .5); g.lineTo(512, i * s + .5); } g.stroke(); }
    clearTimeout(savedTimer); savedTimer = setTimeout(() => sv('pixelart.state', { n, grid }), 400);
  }
  const cell = (e) => { const r = cv.getBoundingClientRect(); return [Math.max(0, Math.min(n - 1, Math.floor((e.clientX - r.left) / r.width * n))), Math.max(0, Math.min(n - 1, Math.floor((e.clientY - r.top) / r.height * n)))]; };
  const push = () => { undo.push(grid.slice()); if (undo.length > 50) undo.shift(); };
  function setColour(c) { colour = c; $('#cur', el).style.background = c; $$('[data-pc]', el).forEach((b) => { b.style.outline = b.dataset.pc === c ? '3px solid var(--accent)' : 'none'; }); if (tool === 'er' || tool === 'ey') setTool('pen'); }
  function setTool(t) { tool = t; $$('[data-t]', el).forEach((b) => { b.className = 'btn ' + (b.dataset.t === t ? '' : 'alt'); }); }
  $('#pal', el).innerHTML = PAL.map((c) => `<button data-pc="${c}" aria-label="Colour ${c}" style="aspect-ratio:1;min-height:36px;border-radius:10px;border:1px solid var(--line);background:${c}"></button>`).join('');
  $$('[data-pc]', el).forEach((b) => { b.onclick = () => setColour(b.dataset.pc); });
  $$('[data-t]', el).forEach((b) => { b.onclick = () => setTool(b.dataset.t); });
  $('#cc', el).oninput = (e) => setColour(e.target.value);
  function apply(e, first) {
    const [x, y] = cell(e);
    if (tool === 'fl') { if (first) { push(); grid = pxFill(grid, n, x, y, colour); } return; }
    if (tool === 'ey') { if (first) { const c = grid[y * n + x]; if (c) { setTool('pen'); colour = c; $('#cur', el).style.background = c; $('#cc', el).value = c; } } return; }
    const pts = last && !first ? pxLine(last[0], last[1], x, y) : [[x, y]];
    pts.forEach(([px, py]) => { grid[py * n + px] = tool === 'er' ? null : colour; }); last = [x, y];
  }
  cv.onpointerdown = (e) => { e.preventDefault(); cv.setPointerCapture(e.pointerId); down = true; if (tool === 'pen' || tool === 'er') push(); last = null; apply(e, true); draw(); };
  cv.onpointermove = (e) => { if (!down || tool === 'fl' || tool === 'ey') return; apply(e, false); draw(); };
  const up = () => { down = false; last = null; };
  cv.onpointerup = up; cv.onpointercancel = up;
  $('#un', el).onclick = () => { if (undo.length) { grid = undo.pop(); draw(); } else toast('Nothing to undo'); };
  $('#gr', el).onclick = (e) => { showGrid = !showGrid; e.target.textContent = 'Grid: ' + (showGrid ? 'on' : 'off'); draw(); };
  const szBtn = () => { $('#sz', el).textContent = 'Size: ' + n + '×' + n; };
  $('#sz', el).onclick = () => {
    if (grid.some(Boolean) && !confirm('Changing size clears the drawing. Continue?')) return;
    n = n === 16 ? 32 : 16; grid = new Array(n * n).fill(null); undo = []; szBtn(); draw();
  };
  $('#cl', el).onclick = () => { if (grid.some(Boolean) && !confirm('Clear the whole drawing?')) return; push(); grid = new Array(n * n).fill(null); draw(); };
  $('#ex', el).onclick = async () => {
    const sc = n === 16 ? 32 : 16, o = document.createElement('canvas'); o.width = o.height = n * sc;
    const x = o.getContext('2d'); x.imageSmoothingEnabled = false;
    grid.forEach((c, i) => { if (c) { x.fillStyle = c; x.fillRect((i % n) * sc, Math.floor(i / n) * sc, sc, sc); } });
    const b = await tbl(o); if (!b) { toast('Could not export'); return; }
    saveBlob(b, 'pixel-art-' + n + 'x' + n + '.png');
  };
  szBtn(); setTool('pen'); setColour(colour); draw();
  return () => { clearTimeout(savedTimer); sv('pixelart.state', { n, grid }); };
} });

/* ================= 8. Signature Pad ================= */
// ==PURE-START==
// strokes = [{c, w, pts:[[x,y],...]}]; returns {x,y,w,h} bounding box including pen width plus padding, or null.
const sigBounds = (strokes, pad) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  strokes.forEach((s) => s.pts.forEach(([x, y]) => { const r = s.w / 2; x0 = Math.min(x0, x - r); y0 = Math.min(y0, y - r); x1 = Math.max(x1, x + r); y1 = Math.max(y1, y + r); }));
  if (!Number.isFinite(x0)) return null;
  return { x: Math.floor(x0 - pad), y: Math.floor(y0 - pad), w: Math.ceil(x1 - x0 + pad * 2), h: Math.ceil(y1 - y0 + pad * 2) };
};
// ==PURE-END==
reg({ id: 'signature', name: 'Signature Pad', icon: '✒️', cat: 'create', desc: 'Sign with your finger on a smooth drawing pad and export the signature as a tightly cropped transparent PNG to save or share.', keys: ['sign', 'autograph', 'handwriting', 'transparent', 'png', 'pdf signature'], needs: [], render(el) {
  let strokes = [], cur = null, colour = '#111111', width = 3;
  const W = 640, H = 300;
  el.innerHTML = `<div class="card" style="padding:10px"><canvas id="cv" width="${W}" height="${H}" style="background:#fff;border-radius:10px;touch-action:none" aria-label="Signature drawing area"></canvas><div class="muted center" style="font-size:12px;margin-top:6px">Sign above with your finger or mouse</div></div>
    <div class="card" style="display:flex;flex-direction:column;gap:10px"><div class="row" style="gap:8px">${['#111111', '#1d4ed8', '#b91c1c', '#15803d'].map((c) => `<button data-c="${c}" aria-label="Ink ${c}" style="height:44px;border-radius:12px;border:2px solid var(--line);background:${c}"></button>`).join('')}</div>
    <label class="f">Pen thickness: <b id="wv">${width}</b><input id="wd" type="range" min="1" max="10" value="${width}" style="min-height:44px"></label></div>
    <div class="row"><button class="btn alt" id="un" style="min-height:48px">↶ Undo</button><button class="btn danger" id="cl" style="min-height:48px">Clear</button></div>
    <div class="row"><button class="btn" id="sv" style="min-height:48px">Save / share PNG</button></div>
    <div class="card muted" style="font-size:12px">The exported image has a transparent background and is cropped to your signature, ready to place on documents. Nothing is uploaded.</div>`;
  const cv = $('#cv', el), g = cv.getContext('2d');
  function paint(ctx, list, ox, oy, k) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    list.forEach((s) => {
      ctx.strokeStyle = s.c; ctx.fillStyle = s.c; ctx.lineWidth = s.w * k;
      const p = s.pts;
      if (p.length === 1) { ctx.beginPath(); ctx.arc((p[0][0] - ox) * k, (p[0][1] - oy) * k, s.w * k / 2, 0, 7); ctx.fill(); return; }
      ctx.beginPath(); ctx.moveTo((p[0][0] - ox) * k, (p[0][1] - oy) * k);
      for (let i = 1; i < p.length - 1; i++) { const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2; ctx.quadraticCurveTo((p[i][0] - ox) * k, (p[i][1] - oy) * k, (mx - ox) * k, (my - oy) * k); }
      const l = p[p.length - 1]; ctx.lineTo((l[0] - ox) * k, (l[1] - oy) * k); ctx.stroke();
    });
  }
  const redraw = () => { g.clearRect(0, 0, W, H); paint(g, cur ? strokes.concat([cur]) : strokes, 0, 0, 1); };
  const pt = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; };
  cv.onpointerdown = (e) => { e.preventDefault(); cv.setPointerCapture(e.pointerId); cur = { c: colour, w: width, pts: [pt(e)] }; redraw(); };
  cv.onpointermove = (e) => { if (!cur) return; const p = pt(e), l = cur.pts[cur.pts.length - 1]; if (Math.hypot(p[0] - l[0], p[1] - l[1]) > 1.5) { cur.pts.push(p); redraw(); } };
  const end = () => { if (cur) { strokes.push(cur); cur = null; redraw(); } };
  cv.onpointerup = end; cv.onpointercancel = end;
  $$('[data-c]', el).forEach((b) => { b.onclick = () => { colour = b.dataset.c; $$('[data-c]', el).forEach((x) => { x.style.borderColor = x === b ? 'var(--accent)' : 'var(--line)'; }); }; });
  $$('[data-c]', el)[0].style.borderColor = 'var(--accent)';
  $('#wd', el).oninput = (e) => { width = +e.target.value; $('#wv', el).textContent = width; };
  $('#un', el).onclick = () => { strokes.pop(); redraw(); };
  $('#cl', el).onclick = () => { strokes = []; cur = null; redraw(); };
  $('#sv', el).onclick = async () => {
    const b = sigBounds(strokes, 8); if (!b) { toast('Sign first'); return; }
    const k = 2, o = document.createElement('canvas'); o.width = b.w * k; o.height = b.h * k;
    paint(o.getContext('2d'), strokes, b.x, b.y, k);
    const blob = await tbl(o); if (!blob) { toast('Could not export'); return; }
    saveBlob(blob, 'signature.png');
  };
} });

/* ================= 9. Meeting Cost Timer ================= */
// ==PURE-START==
const meetingCost = (people, hourly, ms) => (people > 0 && hourly >= 0 && ms >= 0 ? people * hourly * ms / 36e5 : NaN);
const clock = (ms) => { const s = Math.floor(ms / 1000); return (s >= 3600 ? Math.floor(s / 3600) + ':' : '') + p2(Math.floor(s / 60) % 60) + ':' + p2(s % 60); };
// ==PURE-END==
reg({ id: 'meetingcost', name: 'Meeting Cost', icon: '🪑', cat: 'daily', desc: 'A running clock that shows what a meeting is costing in real money, from the number of people and their average hourly rate.', keys: ['meeting', 'cost', 'salary', 'hourly rate', 'time is money', 'timer', 'office'], needs: [], render(el) {
  let people = ld('meetingcost.people', 6), rate = ld('meetingcost.rate', 25), sym = ld('meetingcost.sym', '$');
  let accMs = 0, accCost = 0, last = 0, running = false, tm = 0;
  el.innerHTML = `<div class="card" style="padding:22px" ><div class="center muted" style="font-size:13px">Meeting has cost</div><div id="cost" class="big" style="font-size:54px;word-break:break-all">0</div><div id="clk" class="mid" style="font-variant-numeric:tabular-nums;color:var(--muted)">00:00</div><div id="pm" class="center muted" style="font-size:13px;margin-top:6px"></div></div>
    <div class="row"><button class="btn" id="go" style="min-height:56px;font-size:18px">Start</button><button class="btn alt" id="rs" style="min-height:56px">Reset</button></div>
    <div class="card" style="display:flex;flex-direction:column;gap:12px"><div class="row"><label class="f">People<input id="pp" type="number" inputmode="numeric" min="1" max="1000" value="${people}"></label><label class="f">Avg hourly rate<input id="rt" type="number" inputmode="decimal" min="0" max="1000000" step="any" value="${rate}"></label><label class="f">Symbol<input id="sy" type="text" maxlength="3" value="${esc(sym)}"></label></div>
    <div class="muted" style="font-size:12px">Tip: divide yearly salary by 2000 for an hourly rate. Changing the numbers mid-meeting only affects time from then on.</div></div>`;
  // Money is accumulated per tick at the rate in force, so edits never rewrite what has already been spent.
  function tick() { if (!running) return; const n = Date.now(), dt = n - last; last = n; accMs += dt; const c = meetingCost(people, rate, dt); if (Number.isFinite(c)) accCost += c; }
  function upd() {
    tick();
    $('#cost', el).textContent = sym + accCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    $('#clk', el).textContent = clock(accMs);
    const pm = meetingCost(people, rate, 6e4);
    $('#pm', el).textContent = Number.isFinite(pm) ? sym + pm.toFixed(2) + ' per minute · ' + sym + (pm * 60).toFixed(2) + ' per hour' : 'Enter people and rate';
  }
  function read() { tick(); people = Math.max(1, Math.min(1000, Math.round(num($('#pp', el).value) || 1))); rate = Math.max(0, Math.min(1e6, num($('#rt', el).value) || 0)); sym = $('#sy', el).value.slice(0, 3); sv('meetingcost.people', people); sv('meetingcost.rate', rate); sv('meetingcost.sym', sym); }
  ['#pp', '#rt', '#sy'].forEach((s) => { $(s, el).oninput = () => { read(); upd(); }; });
  $('#go', el).onclick = (e) => {
    if (running) { tick(); running = false; clearInterval(tm); e.target.textContent = 'Resume'; }
    else { read(); last = Date.now(); running = true; tm = setInterval(upd, 200); e.target.textContent = 'Pause'; }
    upd();
  };
  $('#rs', el).onclick = () => { running = false; clearInterval(tm); accMs = 0; accCost = 0; $('#go', el).textContent = 'Start'; upd(); };
  upd();
  return () => { clearInterval(tm); };
} });

/* ================= 10. Life Calendar ================= */
// ==PURE-START==
// Whole weeks lived between two day numbers (days since epoch). Negative -> NaN.
const weeksLived = (birthDay, todayDay) => (todayDay >= birthDay ? Math.floor((todayDay - birthDay) / 7) : NaN);
const dayFromStr = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m && +m[1] >= 1900 ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5 : NaN; };
// ==PURE-END==
reg({ id: 'lifecal', name: 'Life Calendar', icon: '🟦', cat: 'daily', desc: 'See your life as a grid of weeks from your birth date to an expected lifespan, with the weeks already lived filled in.', keys: ['weeks', 'lifetime', 'birthday', 'age', 'memento mori', 'life in weeks'], needs: ['storage'], render(el) {
  let dob = ld('lifecal.dob', ''), span = ld('lifecal.span', 80);
  el.innerHTML = `<div class="card" style="display:flex;flex-direction:column;gap:12px"><div class="row"><label class="f">Date of birth<input id="db" type="date" min="1900-01-01" max="${dstr(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())}" value="${esc(dob)}"></label><label class="f">Expected years<input id="sp" type="number" inputmode="numeric" min="1" max="120" step="1" value="${span}"></label></div></div>
    <div id="st"></div><div class="card" style="padding:10px"><canvas id="cv" style="background:var(--surface);border:0;border-radius:8px" aria-label="Life in weeks grid"></canvas><div class="muted" style="font-size:12px;margin-top:6px">Each row is one year of 52 weeks, starting from your birth. Filled squares are weeks you have lived; the outlined square is this week.</div></div>`;
  const cv = $('#cv', el), g = cv.getContext('2d');
  function css(v) { return getComputedStyle(el).getPropertyValue(v).trim() || '#888'; }
  function upd() {
    dob = $('#db', el).value; span = Math.max(1, Math.min(120, Math.round(num($('#sp', el).value) || 80)));
    sv('lifecal.dob', dob); sv('lifecal.span', span);
    const b = dayFromStr(dob), now = new Date(), t = dayNum(now), wl = weeksLived(b, t), total = span * 52;
    if (!Number.isFinite(b) || !Number.isFinite(wl)) { $('#st', el).innerHTML = '<div class="card muted center" style="padding:20px">Enter a valid birth date in the past.</div>'; cv.width = cv.height = 0; cv.style.display = 'none'; return; }
    cv.style.display = '';
    const years = Math.floor(wl / 52), pct = Math.min(100, wl / total * 100);
    $('#st', el).innerHTML = `<div class="card"><div class="row center"><div><div class="mid">${wl.toLocaleString()}</div><div class="muted" style="font-size:12px">weeks lived</div></div><div><div class="mid">${Math.max(0, total - wl).toLocaleString()}</div><div class="muted" style="font-size:12px">weeks left</div></div><div><div class="mid">${pct.toFixed(1)}%</div><div class="muted" style="font-size:12px">of ${span} years</div></div></div><div class="progress" style="margin-top:12px"><i style="width:${pct}%"></i></div><div class="muted center" style="font-size:13px;margin-top:8px">${(t - b).toLocaleString()} days · about ${years} years old</div></div>`;
    const cols = 52, cell = Math.floor(Math.min(el.clientWidth || 360, 460) / (cols + 3)) || 6, left = cell * 2, W = left + cols * cell + 2, H = span * cell + 2;
    cv.width = W; cv.height = H; cv.style.width = W + 'px'; cv.style.height = H + 'px'; cv.style.maxWidth = '100%';
    const acc = css('--accent'), ln = css('--line'), mu = css('--muted');
    g.clearRect(0, 0, W, H); g.font = Math.max(8, cell) + 'px system-ui'; g.fillStyle = mu; g.textBaseline = 'middle';
    for (let i = 0; i < total; i++) {
      const x = left + (i % cols) * cell, y = Math.floor(i / cols) * cell;
      if (i < wl) { g.fillStyle = acc; g.fillRect(x + .5, y + .5, cell - 1, cell - 1); } else { g.strokeStyle = ln; g.strokeRect(x + .5, y + .5, cell - 1, cell - 1); }
    }
    if (wl < total) { const x = left + (wl % cols) * cell, y = Math.floor(wl / cols) * cell; g.strokeStyle = css('--text'); g.lineWidth = 2; g.strokeRect(x + 1, y + 1, cell - 2, cell - 2); g.lineWidth = 1; }
    g.fillStyle = mu; for (let yr = 10; yr < span; yr += 10) g.fillText(String(yr), 0, yr * cell);
  }
  $('#db', el).onchange = upd; $('#sp', el).oninput = upd;
  upd();
} });

/* ================= 11. Anagram Solver & Word Finder ================= */
// ==PURE-START==
const WORDS = (`
a able about above absent absolute abuse academy accept access account ace achieve acid acquire acre across
act action active actor actual ad adapt add address adjust admire admit adopt adult advance adventure adverse
advice affair affect afford afraid after afternoon again age aged agency agenda agent ago agree ah ahead aid
aim air airport alarm album alcohol alert alien align alike alive all allow almost alone along alphabet
already also alter always am amaze amazing amber ambition among amount ample an analysis ancient and angel
anger angle angry animal ankle annoy annual another answer ant ants anxious any anybody anymore anyone anytime
anyway apart apartment ape apes apology apparel apparent appeal appear appetite apple applied apply approve
april apron arc arcs are area arena argue argument arise arm armchair armor army aroma around arrange array
arrest arrive arrow art article artist artistic arts as ash aside ask aspect assembly asset assign assist
assume at ate athlete atlas atmosphere attach attack attempt attend attic attract auction audience audio
august author autumn avenue average avoid awake award aware away awe awful ax axe baby back backpack backup
bacon bad badge badger bag bagel bags baker bakery balance ball ballet balloon ban banana band bank banner bar
barely bargain barrel barrier base baseball basement basic basil basin basis basket bat batch bath bathroom
bats battery battle bay be beach bean bear beard bearing beast beat beautiful beauty because become bed
bedroom beds bee beef been beer bees before beg begin beginning behalf behave behind being belief believe bell
belly belong below belt bench bend beneath benefit berry beside best bet better between beyond bible bicycle
bid big bike bill billion bin bingo biography bird birds birth birthday biscuit bishop bit bite bitter black
blade blame blank blanket blast blaze blazer bleed blend bless blind blink block blond blood bloom blossom
blouse blow blown blue blueberry blues bluff boa board boast boat body boil boiling bold bolt bomb bonanza
bone bonus book booking boom boost boot booth border born borough borrow boss both bottle bottom bounce bound
boundary bow bowl bowls box boxes boy boys bracket brain brake branch brand brass brave bread break breakfast
breath breed brick bride bridge brief bright brilliant bring brisk broad broadcast broke broken bronze brook
broom brother brought brown brush bubble bucket bud buddy budget buffalo buffer bug bugs build builder
building built bulk bunch bundle burden bureau burn burst bus bush business busy but butter butterfly button
buy buyer buyers by cab cabin cabinet cable cactus cafe cake cakes calcium calendar call calm came camel
camera camp campaign can cancel candle candy canoe canvas cap capable capacity capital captain capture car
carbon card care career careful carpenter carpet carrot carry cars cart cartoon carve case cash casino cast
castle casual cat catalog catch category cats cattle caught cause caution cave cedar ceiling cell center
central century cereal ceremony certain chain chair chalk chamber champ champion chance change channel chaos
chapel chapter charge charity charm chart chase chat cheap cheat check cheek cheer cheese chef chemical cherry
chess chest chick chicken chief child children chill chimney chin chip chocolate choir chord chosen chunk
church cider cigar cinnamon circle circuit citizen citrus city civic civil civilian claim clap clash class
classic classroom claw clay clean cleaning clear clerk clever click client cliff climate climb cling clinic
clip cloak clock clockwise close closed closer cloth clothe clothes cloud clown club cluster coach coal coast
coastal coat cocoa code coffee coin cold collapse collar collect college colon colony color colorful column
combat combined come comedian comedy comet comfort comic command comment commerce commit common commonly
community company compare compete complete complex comply computer concept concern concert conclude concrete
conduct confirm conflict confused congress connect consent consider constant consumer contact content contest
context continue contract contrast control convert convince cook cooking cool cooperate cop cope copper copy
copyright coral cord core corn corner cornerstone corporate corridor cost costume cottage cotton couch cough
could council count counter country county couple courage course court cousin cover cow cowboy cows cozy crab
crack cradle craft crane crash crawl crazy cream create creation creative creature credit creek creep crest
crew crime criminal crisis crisp critic critical crop cross crossing crow crowd crown crucial crude cruel
crush cry crystal cub cube cucumber cuddly culture cup cupboard cups cure curl current curve cushion custom
customer cut cute cycle cycling dad dagger daily dairy daisy dam damage dance dancer dancing danger dare dark
data database date dated daughter dawn day daylight days dead deaf deal dealer deals dear death debate debt
debut decade decay december decent decide decimal decision deck declare decorate deed deep deeply deer default
defeat defend define degree delay deliver delivery delta demand democracy den dense density dentist deny
departure depend deposit depot depth deputy derby describe desert design designer desire desk desks despite
detail detailed detect detector develop device devil devote dew diagnose dial dialog dialogue diamond diary
dice dictator did die diet different dig digit digital dim dimension dine diner dinner dip direct director
dirt dirty discount discover disease dish disk display distance district disturb ditch dive diver divide
dividend do dock doctor document dodge does dog dogs doing doll dollar dolphin domain dome domestic dominate
donate done donkey donor door dose dot double doubt dough down download dozen draft drag dragon drain drama
dramatic drank draw drawer drawing drawn dream dreaming dress dresser drew dried drift drill drink drinking
drip drive driver driveway driving drop drown drum drums dry dub duck dud due dug dull dumpling dune duo
during dusk dust duty dye dying dynamic each eager eagle ear early earn earnings ears earth earthquake ease
easel easily east eastern easy eat eaten eating economic economy edge edition editor educate education eel
effect effort egg eggs ego eight eighteen eighth either elbow elder elderly elect election electric element
elephant elevator eleven elf elite elk elm else email embrace emerge emission emotion emperor emphasis empire
employ employee employer empty emu enable encourage end endure enemy energy engage engine engineer enhance
enjoy enormous enough enquiry enroll ensure enter entire entitle entrance entry envelope episode equal
equation equator equipment equity era error escape essay essence estate estimate eternal evaluate eve even
evening event eventual ever every evidence evident evil exact exactly exam examine example exceed except
exchange excite excited exciting exclude excuse exercise exhaust exhibit exist existing exotic expand expect
expected expense expert explain explore explorer exposure express extended extent external extra extreme eye
eyes fable fabric face facility fact factor factory fad fade fail failure faint fair fairly fairy faith fall
fallen false fame familiar family famous fan fancy fans far fare farewell farm farmer farms fashion fast
fasten fat fatal fate father faucet fault favorite fax fear feast feature fed federal fee feeble feed feedback
feel fell fellow felt fence ferry festival fever few fiber fiction field fierce fifteen fifth fifty fig fight
fighter fighting figure file fill film filter fin final finally finance find finding fine finger finish
finished fir fire fireman fireplace firm firmly first fiscal fish fishing fist fit fitness fitted five fives
fix flag flags flagship flame flash flat flavor flavour flaw flea fled fleet flesh flew flexible flight flip
float floating flock flood floor flour flow flower flu fluid flush flute fly flying foam focal focus foe fog
foggy fold folk follow fond food foods fool foolish foot footage football for force ford forecast foreign
forest forever forge forget forgive fork form formal former formerly formula fort forth fortune forty forum
forward foster found fountain four fours fourth fox fraction fragile frame frank fraud free freedom freely
freeze freight french frequent fresh friar friction fried friend friendly frog from front frontier frost
frosting frozen fruit fry fuel full fully fumble fun function fund funding funeral funny fur furnace furniture
further fuse future gadget gag gain galaxy gallery game gamma gang gap garage garbage garden garlic gas
gasoline gate gather gauge gave gaze gear gel gem general generate generous genetics gentle gently genuine
geometry gesture get ghost giant gift gifts gin ginger giraffe girl girlfriend girls give giveaway given glad
glance glass glasses glimpse global globe gloom glorious glory glove glow glue go goal goals goat goblin god
goddess going gold golden golf gone good goodness gospel got govern governor gown grab grace graceful grade
gradual graduate grain grammar grand grant grape graph graphic graphics grasp grass gratitude grave gray
grease great greed greedy green greet greeting grew grid grief grill grin grind grip groan grocery groom gross
ground grounded group grove grow growing growl grown growth guarantee guard guardian guess guest guidance
guide guideline guilt guitar gulf gum gun guru gut gutter guy gym habit habitat had hail hair hairbrush hairy
half halfway hall hals ham hammer hand handful handle handsome handy hang happen happily happy harbor hard
hardly hardware harm harmony harsh harvest has haste hasty hat hate hats haunt have haven hawk hay hazard he
head heading headline heal health healthy heap hear hearing heart heat heater heaviest heavily heavy hedge
heel height held helicopter hell hello helmet help helpful hen hence hens her herb herbal here heritage hero
hesitate hi hid hidden hide high highland highly highway hill hills him hint hip hire his historic history hit
hockey hog hold holder hole holiday holy home homework honest honestly honey honor hood hook hop hope horizon
horn horse hospital host hostile hosting hot hotel hour house housing hover how however hub hue hug huge hum
human humanity humid humor hundred hundreds hung hunger hunt hunter hurricane hurry hurt husband hut hybrid
hymn ice icon icy id idea ideal identify if ignore ill illegal illusion image imagine imagined immediate imp
impact implied imply import important impose improve improved in inch incident include included income
increase indeed index indicate indoor industry infinite inflate inform informal inherit initial injured injury
ink inn inner innocent input inquire inquiry inside insight insist inspire install instant instead insurance
intact integral intend intended interest interior internal internet interval into invasion invent invented
invest invite involve involved ion ire irk iron irony is island isle isolated issue it item its itself ivory
ivy jab jacket jail jam jar jaw jay jazz jealous jeep jelly jersey jet jewel jewelry jig jingle job jobs
jockey jog join joint joke joker jolly journal journey joy judge judgment jug juice juicy jumbo jump june
jungle junior junk jury just justice kayak keen keep keg kept kernel kettle key keyboard keys kick kid kidney
kids kill kin kind kindle kindness king kingdom kings kiss kit kitchen kite kitten knack knee kneel knew knife
knit knitted knock knot know knowing knowledge known lab label labor lace lack lad ladder lady lag laid lake
lamb lame lamp lamps lance land landlord lane language lantern lap large laser lash last late lately later
laugh laughter launch laundry law lawn lawyer lay layer lazy lea lead leader leadership leaf league leak lean
leap learn learning lease least leather leave lecture led left leg legal legend legs leisure lemon lend lender
length lens less lesson let letter lettuce level lever liberty library license lick lid lie life lifetime lift
lifted light lighting lightly like likely likewise lily limb lime limit limited line linen liner lines linger
link lion lip lips liquid list listen listing lists lit literal literary little live lived lively liver lizard
load loading loaf loan lobby local locally locate location lock locks lodge loft log logic logical lone lonely
lonesome long look loop loose lord lose loss lost lot lottery loud love lovely lover low lower loyal luck
lucky lumber lump lunar lunch lung lure lush lying lyrics machine mad magazine magic magnet magnetic mail
mailbox main mainly maintain major majority make maker male mall mammal man manage manager mandate mane mango
manner mansion manual many map maple maps marathon marble march margin marine mariner mark market marriage
marry marsh mask masks mass massive master mat match mate material maternal math matter maximum may mayor maze
me meadow meal mean meaning meant meantime measure meat medal media medical medicine meet meeting melodies
melon melt member membrane memo memorial memory men mental mention mentor menu merchant mercy mere merely
merge merit merry mess message met metal meter method middle midnight midst midwife might migrate mild mile
military militia milk mill million mind mine mineral minimum minister minor minority mint minus minute miracle
mirror mirrored miss mission mist mistake mix mixed mixture moan mob mobile mobility mode model moderate
modern modest moist molecule mom moment momentum money monitor monkey monopoly month monthly mood moon mop
moral more morning moss most moth mother motion motive motor mount mountain mouse mouth move movement movie
much mud muddy mug mule multiple muscle museum music musician must mustard mutation mutual my myself
mysterious mystery myth nag nail naive name nap narrow nasty nation national natural nature naval navy near
nearby nearest nearly neat neck need needle negative neighbor nephew nerve nest net nets network neutral never
new newly news next nice nickel night nil nine nip no noble nobody nod node noise none nonsense noon nor norm
normal north northern nose not notch note notebook noted nothing notice noun novel november now nowhere
nuclear number numerous nun nurse nursery nut nuts nylon oak oar oasis oat oath obey object observe obstacle
obtain obvious occasion occupied ocean october odd of off offer office officer official oft often oh oil oils
ok old olive on once one ongoing onion online only onto open opening opera operate opinion opponent opposite
opt optical optimism option or oral orange orb orbit orchid order ordinary ore organ organic origin original
orphan other otter ought ounce our out outcome outdoor outdoors outer outfit outline outlook output outside
oval oven over overall overcome overhead oversee ow owe owl own owner ox oxide oxygen ozone pace pacific pack
package pad paddle page paid pain paint painter painting pair pal palace pale palette palm pan pane panel
panic pans panther pap paper par parade paradise parallel parcel pardon parent parents park parka parking
parrot part particle partly partner party pass passage passed passion passport past pasta pastry pasture pat
patch path patience patrol patron pattern pause pave paw pay payment pea peace peaceful peach peak pear pearl
peasant peculiar pedal pedestal peel peer peg pen penalty pencil penny pens pension people pepper perceive
perch perfect perform perhaps peril period permit person personal persuade pet pets phantom phase phone photo
phrase physical physics piano pick picnic picture pie piece pier pierce pies pig pigs pile pill pillow pilot
pin pinch pine pink pins pioneer pipe pipeline pirate pit pitch pity pizza place plain plan plane planet plans
plant plastic plate platform play player playful plays plaza plead pleasant please pleased pleasure pledge
plenty plot pluck plug plum plumber plumbing plump plus plush ply poach pocket pod poem poet poetry point
pointer pointing poker polar pole police policy polish polite politics polka poll pollen polygon pond pony
pool poor pop pope popular pork port portal portion portrait pose position positive possible post poster posts
pot potato potatoes pots pound pour poverty powder power powerful practice prank pray precious precise predict
prefer pregnant prepare presence present preserve press pressure pretend pretty prevent previous prey price
pride primary prime prince princess print printer prior priority prison prisoner privacy private prize pro
probable probe problem process produce produced producer product profile profit profound program progress
project promise promote prompt prone proof proper property proposal prospect protect protein protocol proud
prove provide provided province pub public publicly publish pudding pug pull pulse pump pumpkin pun punch pup
pupil puppet puppy purchase pure purple purpose purse pursue pursuit pus push puzzle pyramid quack quality
quantity quarter queen query quest question queue quick quickly quiet quietly quilt quirk quit quite quiz
quote rabbit race racing rack radar radio radish rag rage raid rail rain rainbow raise raisin rally ram ran
ranch random range rank rap rapid rare rarely rat rate rather ratio rational rats raven raw ray reach reached
react reaction read reader reading ready real reality realize really realm reap rear reason reasonable rebel
rebuild recall receipt receive receiver recent recently recipe record recorded recover recovery red reduce
reducing reed refer referee reflect reform refresh refugee refuse region regional register regular reign
reject relate related relation relative relax relaxed relay release reliable relief religion rely remain
remarks remedy remember remind reminder remix remote removal remove render renew renewal rent repair repeat
repeated replace reply report reporter republic request require rescue rescued research reserve reserved
resident resolve resolved resort resource respect respond response rest restaurant restore result resulted
retail retire return reveal revenue reverse review revision reward rhythm rhythmic rib ribbon rice rich rid
ride rider ridge rife rifle rig right rigid rim ring rings rinse riot rip rise rising risk risky rival river
road roam roar roast rob robe robot robust rock rocket rocks rocky rod rode rogue role roll rolling roman
romantic roof rooftop room rooms root roots rope rose rot rough round route routine row royal rub rubber rug
rugby ruin rule ruler rules ruling rum run runner running rural rush rust rut rye sacred sad saddle sadly safe
safer safety sag sage said sail sailing saint sake salad sale salmon salon salt same sample sand sandal
sandwich sandy sang sank sap sat satellite satire satisfy saturday sauce sauna save saving saw say scale scar
scarce scarf scenario scene scent schedule scheme scholar school science scissors scold scone scoop scope
score scout scrap scratch scream screen screw script sea seal search season seasonal seasons seat seats second
secondly secret section sector secure security see seed seek seem seen select selected self sell semester
senator send senior sense sensor sent sentence separate sequence series serious serve server service session
set sets setting settle setup seven seventh several sew shade shadow shaft shake shall shallow shame shape
share sharing shark sharp shave she shed sheep sheer sheet shelf shell shelter shield shift shine shining
shiny ship shipping ships shirt shock shoe shoes shop shopping shore short shorter shortly shot shoulder shout
show shower showing shown shrug shut shy sick side sidewalk sigh sight sigma sign signal signature signs
silence silent silently silk silly silver similar simple simplify sin since sing singer single sink sip sir
sis sister sit site sitting situation six sixth sixty size skate skeleton sketch ski skies skiing skill skin
skip skirt skull sky slam slap slate sleep sleeping slender slice slid slide slight slightly slim slip slogan
slope slow sly small smart smell smile smiling smoke smoking smooth snack snake snap snappy sneak sniff snow
snowman so soak soap sob soccer social sock socket sod soft soften software soil solar sold soldier sole
solemn solid solution solve solving some somebody somehow someone somewhere son song songs sonic soon sore
sorry sort soul sound soup sour source south southern sow soy spa space span spare spark speak speaker
speaking special species specific specify spectrum speed spell spelling spend spice spicy spider spike spin
spine spirit spirits spit splash splendid spoil spoken sponge sponsor spoon sport sporting spot spotlight
spots spray spread spring spy squad square squirrel stable stack stadium staff stage stain stair stake stale
stamp stand standard star stare stars start starting state stations status stay staying steady steak steal
steam steel steep steer stem step stepping stereo stern stew stick sticky stiff still sting stir stirring
stock stomach stone stood stool stop stops storage store stored storm story stout stove straight strain strand
strange strap strategy straw stray stream street strength stress stretch strict stride strike striking string
strip stroke strong strongly struggle stub stuck student students studio study stuff stunning style sub
subject submit suburban success such sudden suddenly sue suffer sugar suggest suit suitable suite sum summary
summer summit sun sunny sunrise sunset sunshine super superior supplies supply support suppose supposed sure
surely surf surface surge surgeon surgery surplus surprise survey survival survive suspect sustain swallow
swamp swan swear sweat sweater sweep sweet swell swift swim swimmer swimming swing switch sword symbol
symphony system tab table tablet taboo tacit tackle tactical tag tail take tale talent tales talk tall tan
tangible tank tap tape tar target task tasked taste taught tax taxi tea teach teacher teaching team tear
technical teem teen teenager teeth telegram tell telling temple tempo ten tenant tend tendency tender tends
tennis tens tense tension tent tenth term tern terrace terrible territory test testing tests text textile than
thank thankful thanks that the theater theatre theft them theme then theory therapy there they thick thief
thin thing think thinking third thirst thirteen this thorn those though thought thousand thread threat three
threw throne throw thrown thumb thump thunder thus tick ticket tickets tide tidy tie tied tiger tight tile
till timber time timer tin tiny tip tips tiptoe tire tired tissue title to toad toast tobacco today toe
together toggle toil token told toll tomato tomb tomorrow ton tone tongue tonight too took tool tooth top
topic topping tops torch tore torn tornado toss total touch touching tough tour tourism tourist tow toward
tower town toxic toy toys trace track tracker tractor trade trading tradition traffic trail train trainer
training trait transfer transit transmit trap trash travel tray treasure treat treatment treaty tree trees
trend trial triangle tribe tribute trick tried trillion trim trio trip troop trophy tropical trouble truck
true truly trumpet trunk trust trusted truth try tub tube tuck tuesday tug tulip tumor tune tuner tunnel
turkey turn turning turnover turtle twelfth twelve twenty twice twilight twin twist two twos type typical ugly
ultimate umbrella unable uncle under undergo unfair uniform union unique unit unite unity universe unknown
unless unlike unlikely until unusual up upcoming update upgrade upload upon upper upset urban urge urgent urn
us usage use used useful user usual utility utter vacancy vacation vaccine vain valid valley valuable value
valve van vapor variable variety various vary vase vast vat vault vehicle veil vein velocity vendor venture
venue verb verbal verdict verse version vertical very vest vet veteran via victim victory video vie view
viewer vigor vile villa village vine vintage vinyl viola violence violent viral virtual virus visa visible
vision visit visitor vista visual vital vitamin vitamins vivid vocal voice void volcano voltage volume
volunteer vote voter vow voyage wade wag wage wager wagon waist wait wake walk walking wall walls walnut waltz
wander want wanting war wardrobe warm warmth warn warning warrant warrior was wash waste watch water waterfall
wave wax way ways we weak wealth wealthy weapon wear wearing weary weather weave web website wed wedding wedge
wee week weekday weekend weekly weigh weight weird welcome welfare well went were west western wet wets whale
what whatever wheat wheel when whenever where whereas whether which while whisper whistle white who whole whom
whose why wide widen widow width wield wife wig wild wildfire wildlife will willing win wind window windows
wine wing wings wink winner winning winter wipe wire wireless wisdom wise wish wishing wit witch with within
without witness wizard woe wok woke wolf woman won wonder wonderful woo wood wooden wool word words wore work
worker working workshop world worm worn worried worry worse worst worth would wound woven wow wrap wrath wrist
write writer writing written wrong wrote yacht yak yam yap yard yards yarn yaw year yell yellow yen yes
yesterday yet yew yield yoga yogurt you young younger youngster your youth zap zealous zebra zero zip zipper
zone zones zoo zoom
`).trim().split(/\s+/);
const keyOf = (w) => w.split('').sort().join('');
// Words using exactly the given letters (same multiset). Skips the input word itself.
const findAnagrams = (letters, list) => {
  const k = keyOf(letters.toLowerCase().replace(/[^a-z]/g, '')), self = letters.toLowerCase();
  return k ? list.filter((w) => w !== self && w.length === k.length && keyOf(w) === k) : [];
};
// Words buildable from the letters (each used at most once). '?' in letters is a blank tile.
const findFrom = (letters, list, minLen) => {
  const s = letters.toLowerCase(), cnt = {}; let blanks = 0;
  for (const ch of s) { if (ch === '?') blanks++; else if (ch >= 'a' && ch <= 'z') cnt[ch] = (cnt[ch] || 0) + 1; }
  const total = Object.values(cnt).reduce((a, b) => a + b, 0) + blanks;
  if (!total) return [];
  return list.filter((w) => {
    if (w.length < (minLen || 2) || w.length > total) return false;
    const c = Object.assign({}, cnt); let b = blanks;
    for (const ch of w) { if (c[ch] > 0) c[ch]--; else if (b > 0) b--; else return false; }
    return true;
  });
};
// Pattern search: ? = one letter, * = any run of letters (including none).
const findPattern = (pat, list) => {
  const p = pat.toLowerCase().replace(/[^a-z?*]/g, '');
  if (!p) return [];
  const re = new RegExp('^' + p.replace(/\*+/g, '[a-z]*').replace(/\?/g, '[a-z]') + '$');
  return list.filter((w) => re.test(w));
};
// ==PURE-END==
reg({ id: 'anagram', name: 'Word Finder', icon: '🪧', cat: 'text', desc: 'Offline word helper with a built-in list of common English words: find anagrams, words you can make from letters (blanks allowed), and words matching a pattern like c?t or ab*.', keys: ['anagram', 'scrabble', 'wordle', 'crossword', 'letters', 'unscramble', 'words with friends', 'solver'], needs: [], render(el) {
  let mode = ld('anagram.mode', 'from');
  const HELP = { anagram: 'Type a word or letters: finds words that use exactly all of them.', from: 'Type your letters (use ? for a blank tile): finds words you can make from some or all of them.', pat: 'Use ? for one unknown letter and * for any run of letters. Example: c?t, ?o?se, un*ing.' };
  el.innerHTML = `${tabBar('tb', [['from', 'From letters'], ['anagram', 'Anagrams'], ['pat', 'Pattern']], mode)}
    <div class="card" style="display:flex;flex-direction:column;gap:10px;padding:18px"><label class="f"><span id="lb"></span><input id="q" type="text" maxlength="20" autocapitalize="none" autocomplete="off" spellcheck="false" style="font-size:22px;letter-spacing:2px"></label><div id="hp" class="muted" style="font-size:13px"></div><label class="f" id="mlw">Minimum word length: <b id="mv">3</b><input id="ml" type="range" min="2" max="8" value="3" style="min-height:44px"></label></div>
    <div id="out"></div><div class="muted" style="font-size:12px">Built-in list of ${WORDS.length.toLocaleString()} common English words, so rare words may be missing.</div>`;
  const q = $('#q', el);
  function run() {
    const v = q.value.trim(), ml = +$('#ml', el).value; let res = [];
    if (v) res = mode === 'anagram' ? findAnagrams(v, WORDS) : mode === 'from' ? findFrom(v, WORDS, ml) : findPattern(v, WORDS);
    const out = $('#out', el);
    if (!v) { out.innerHTML = ''; return; }
    if (!res.length) { out.innerHTML = '<div class="card muted center" style="padding:24px">No words found.</div>'; return; }
    res = res.slice().sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
    const groups = {}; res.forEach((w) => { (groups[w.length] = groups[w.length] || []).push(w); });
    out.innerHTML = `<div class="muted" style="margin:0 4px 8px">${res.length} word${res.length === 1 ? '' : 's'} found</div>` + Object.keys(groups).sort((a, b) => b - a).map((k) => `<div class="card" style="margin-bottom:10px"><div class="muted" style="font-size:12px;margin-bottom:8px">${k} letters (${groups[k].length})</div><div style="display:flex;flex-wrap:wrap;gap:6px">${groups[k].slice(0, 300).map((w) => `<span style="padding:6px 10px;border-radius:99px;background:var(--surface2);font-size:15px">${esc(w)}</span>`).join('')}</div></div>`).join('');
  }
  function setMode(m) {
    mode = m; sv('anagram.mode', m);
    $$('#tb button', el).forEach((b) => { b.className = 'btn ' + (b.dataset.t === m ? '' : 'alt'); });
    $('#lb', el).textContent = m === 'pat' ? 'Pattern' : 'Letters'; $('#hp', el).textContent = HELP[m]; $('#mlw', el).hidden = m !== 'from'; q.value = ''; run();
  }
  $$('#tb button', el).forEach((b) => { b.onclick = () => setMode(b.dataset.t); });
  q.oninput = run; $('#ml', el).oninput = (e) => { $('#mv', el).textContent = e.target.value; run(); };
  setMode(mode);
} });

/* ================= 12. Number Sequences ================= */
// ==PURE-START==
const fibList = (count) => { const out = []; let a = 0n, b = 1n; for (let i = 0; i < count; i++) { out.push(a); const t = a + b; a = b; b = t; } return out; };
const sieve = (n) => { const is = new Uint8Array(n + 1).fill(1); is[0] = 0; if (n >= 1) is[1] = 0; for (let i = 2; i * i <= n; i++) if (is[i]) for (let j = i * i; j <= n; j += i) is[j] = 0; return is; };
const primesTo = (n) => { const s = sieve(n), out = []; for (let i = 2; i <= n; i++) if (s[i]) out.push(i); return out; };
const triList = (count) => { const out = []; for (let i = 1; i <= count; i++) out.push(i * (i + 1) / 2); return out; };
// Collatz: n even -> n/2, odd -> 3n+1 until 1. Returns {seq, steps, peak} (seq capped by maxLen, steps always exact).
const collatz = (n, maxLen) => {
  if (!Number.isInteger(n) || n < 1) return null;
  const seq = [n]; let steps = 0, peak = n, x = n;
  while (x !== 1 && steps < 100000) { x = x % 2 ? 3 * x + 1 : x / 2; steps++; if (x > peak) peak = x; if (seq.length < (maxLen || 2000)) seq.push(x); }
  return { seq, steps, peak, done: x === 1 };
};
const factorise = (n) => { const f = []; for (let p = 2; p * p <= n; p++) while (n % p === 0) { f.push(p); n /= p; } if (n > 1) f.push(n); return f; };
// ==PURE-END==
reg({ id: 'sequences', name: 'Number Patterns', icon: '🌀', desc: 'Explore number sequences visually: Fibonacci with the golden ratio, a prime sieve grid with factorisation, triangular numbers and a Collatz path chart.', keys: ['fibonacci', 'prime', 'sieve', 'triangular', 'collatz', 'golden ratio', 'sequence', 'maths'], needs: [], render(el) {
  let mode = ld('sequences.mode', 'fib');
  el.innerHTML = `${tabBar('tb', [['fib', 'Fibonacci'], ['prime', 'Primes'], ['tri', 'Triangular'], ['col', 'Collatz']], mode)}<div id="pane" style="display:flex;flex-direction:column;gap:12px"></div>`;
  const pane = $('#pane', el);
  const inp = (id, label, v, mn, mx) => `<label class="f">${label}<input id="${id}" type="number" inputmode="numeric" min="${mn}" max="${mx}" step="1" value="${v}"></label>`;
  const clamp = (v, a, b, d) => { const n = Math.round(num(v)); return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : d; };
  const chart = (vals, h) => { const mx = Math.max(...vals, 1); return `<div style="display:flex;align-items:flex-end;gap:2px;height:${h}px">${vals.map((v) => `<i style="flex:1;min-width:2px;height:${Math.max(2, v / mx * 100)}%;background:var(--accent);border-radius:2px 2px 0 0"></i>`).join('')}</div>`; };
  const views = {
    fib() {
      pane.innerHTML = `<div class="card" style="display:flex;flex-direction:column;gap:10px">${inp('n', 'How many terms (2 to 150)', 20, 2, 150)}<div id="r"></div></div>`;
      const run = () => {
        const n = clamp($('#n', el).value, 2, 150, 20), f = fibList(n);
        const ratio = n > 2 ? Number(f[n - 1] * 10n ** 12n / f[n - 2]) / 1e12 : NaN;
        $('#r', el).innerHTML = `<div class="muted" style="font-size:13px">Each term is the sum of the two before it.</div>${n > 2 ? `<div class="center" style="margin:8px 0"><div class="muted" style="font-size:12px">F(${n}) / F(${n - 1})</div><div class="mid" style="font-variant-numeric:tabular-nums">${ratio.toFixed(10)}</div><div class="muted" style="font-size:12px">The golden ratio is 1.6180339887</div></div>` : ''}<div style="display:flex;flex-wrap:wrap;gap:6px">${f.map((v, i) => `<span style="padding:6px 10px;border-radius:10px;background:var(--surface2);font-size:14px;word-break:break-all"><span class="muted" style="font-size:11px">${i}:</span> ${v.toString()}</span>`).join('')}</div>`;
      };
      $('#n', el).oninput = run; run();
    },
    prime() {
      pane.innerHTML = `<div class="card" style="display:flex;flex-direction:column;gap:10px">${inp('n', 'Show numbers up to (10 to 1000)', 100, 10, 1000)}<div id="r"></div></div><div class="card" style="display:flex;flex-direction:column;gap:10px">${inp('f', 'Factorise a number', 360, 2, 999999999999)}<div id="fr" class="muted"></div></div>`;
      const run = () => {
        const n = clamp($('#n', el).value, 10, 1000, 100), s = sieve(n), pr = primesTo(n);
        $('#r', el).innerHTML = `<div class="muted" style="font-size:13px"><b>${pr.length}</b> primes up to ${n} (${(pr.length / n * 100).toFixed(1)}%). Highlighted numbers are prime; the rest are crossed out by smaller factors.</div><div style="display:grid;grid-template-columns:repeat(10,1fr);gap:3px">${Array.from({ length: n }, (_, i) => i + 1).map((v) => `<span style="text-align:center;padding:6px 0;border-radius:6px;font-size:${n > 400 ? 9 : 12}px;${s[v] ? 'background:var(--accent);color:var(--accent-t);font-weight:700' : 'background:var(--surface2);color:var(--muted)'}">${v}</span>`).join('')}</div>`;
      };
      const fac = () => {
        const v = Math.round(num($('#f', el).value));
        if (!(v >= 2) || v > 999999999999) { $('#fr', el).textContent = 'Enter a whole number from 2 to 999,999,999,999'; return; }
        const f = factorise(v), cnt = {}; f.forEach((p) => { cnt[p] = (cnt[p] || 0) + 1; });
        $('#fr', el).innerHTML = f.length === 1 ? `<b style="color:var(--ok)">${v.toLocaleString()} is prime</b>` : `${v.toLocaleString()} = <b style="color:var(--text)">${Object.entries(cnt).map(([p, e]) => (e > 1 ? p + '<sup>' + e + '</sup>' : p)).join(' × ')}</b>`;
      };
      $('#n', el).oninput = run; $('#f', el).oninput = fac; run(); fac();
    },
    tri() {
      pane.innerHTML = `<div class="card" style="display:flex;flex-direction:column;gap:10px">${inp('n', 'How many terms (1 to 100)', 15, 1, 100)}<div id="r"></div></div>`;
      const run = () => {
        const n = clamp($('#n', el).value, 1, 100, 15), t = triList(n);
        $('#r', el).innerHTML = `<div class="muted" style="font-size:13px">T(n) = n × (n + 1) / 2. Dots stack into a triangle, so each term adds a new row.</div>${chart(t, 90)}<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px">${t.map((v, i) => `<span style="padding:6px 10px;border-radius:10px;background:var(--surface2);font-size:14px"><span class="muted" style="font-size:11px">${i + 1}:</span> ${v}</span>`).join('')}</div>`;
      };
      $('#n', el).oninput = run; run();
    },
    col() {
      pane.innerHTML = `<div class="card" style="display:flex;flex-direction:column;gap:10px">${inp('n', 'Starting number (1 to 1,000,000,000)', 27, 1, 1000000000)}<div id="r"></div></div>`;
      const run = () => {
        const n = clamp($('#n', el).value, 1, 1000000000, 27), c = collatz(n, 400);
        const lg = c.seq.map((v) => Math.log(v + 1));
        $('#r', el).innerHTML = `<div class="muted" style="font-size:13px">Halve if even, triple and add 1 if odd. Every start tried so far reaches 1.</div><div class="row center" style="margin:10px 0"><div><div class="mid">${c.steps}</div><div class="muted" style="font-size:12px">steps</div></div><div><div class="mid">${c.peak.toLocaleString()}</div><div class="muted" style="font-size:12px">highest value</div></div></div>${chart(lg, 100)}<div class="muted" style="font-size:11px;margin:4px 0 8px">Bar height is on a log scale${c.seq.length < c.steps + 1 ? '; first ' + c.seq.length + ' terms shown' : ''}.</div><div style="display:flex;flex-wrap:wrap;gap:4px;max-height:200px;overflow:auto">${c.seq.map((v) => `<span style="padding:3px 8px;border-radius:8px;background:var(--surface2);font-size:12px">${v}</span>`).join('')}</div>`;
      };
      $('#n', el).oninput = run; run();
    }
  };
  function setMode(m) { mode = m; sv('sequences.mode', m); $$('#tb button', el).forEach((b) => { b.className = 'btn ' + (b.dataset.t === m ? '' : 'alt'); }); views[m](); }
  $$('#tb button', el).forEach((b) => { b.onclick = () => setMode(b.dataset.t); });
  setMode(mode);
} });

/* ================= 13. Matrix Calculator ================= */
// ==PURE-START==
const mxSnap = (x) => { const r = Math.round(x); return Math.abs(x - r) < 1e-9 ? (r === 0 ? 0 : r) : Math.round(x * 1e9) / 1e9 || 0; };
const mxDims = (A) => [A.length, A[0] ? A[0].length : 0];
const mxAdd = (A, B, sign) => {
  const [r, c] = mxDims(A), [r2, c2] = mxDims(B);
  if (r !== r2 || c !== c2) return null;
  return A.map((row, i) => row.map((v, j) => mxSnap(v + (sign || 1) * B[i][j])));
};
const mxMul = (A, B) => {
  const [r, c] = mxDims(A), [r2, c2] = mxDims(B);
  if (c !== r2) return null;
  return Array.from({ length: r }, (_, i) => Array.from({ length: c2 }, (_, j) => { let s = 0; for (let k = 0; k < c; k++) s += A[i][k] * B[k][j]; return mxSnap(s); }));
};
const mxT = (A) => A[0].map((_, j) => A.map((row) => row[j]));
const mxDet = (A) => {
  const n = A.length; if (!n || A[0].length !== n) return NaN;
  const M = A.map((r) => r.slice()); let det = 1;
  for (let i = 0; i < n; i++) {
    let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;
    if (Math.abs(M[p][i]) < 1e-12) return 0;
    if (p !== i) { [M[p], M[i]] = [M[i], M[p]]; det = -det; }
    det *= M[i][i];
    for (let r = i + 1; r < n; r++) { const f = M[r][i] / M[i][i]; for (let c = i; c < n; c++) M[r][c] -= f * M[i][c]; }
  }
  return mxSnap(det);
};
const mxInv = (A) => {
  const n = A.length; if (!n || A[0].length !== n) return null;
  const M = A.map((r, i) => r.concat(Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))));
  for (let i = 0; i < n; i++) {
    let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;
    if (Math.abs(M[p][i]) < 1e-12) return null;
    [M[p], M[i]] = [M[i], M[p]];
    const d = M[i][i]; for (let c = 0; c < 2 * n; c++) M[i][c] /= d;
    for (let r = 0; r < n; r++) if (r !== i) { const f = M[r][i]; if (f) for (let c = 0; c < 2 * n; c++) M[r][c] -= f * M[i][c]; }
  }
  return M.map((r) => r.slice(n).map(mxSnap));
};
const mxParseCell = (s) => { s = String(s).trim(); if (!s) return 0; const m = /^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/.exec(s); if (m) return +m[2] ? m[1] / m[2] : NaN; const n = Number(s.replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
// ==PURE-END==
reg({ id: 'matrix', name: 'Matrix Calc', icon: '📑', desc: 'Add, subtract and multiply matrices up to 4 by 4, and find determinants, inverses and transposes, with fractions accepted in cells.', keys: ['matrix', 'determinant', 'inverse', 'linear algebra', 'multiply', 'transpose', 'maths'], needs: [], render(el) {
  const sz = ld('matrix.sz', { a: [2, 2], b: [2, 2] });
  const vals = { a: [['2', '1'], ['5', '3']], b: [['1', '0'], ['0', '1']] };
  const OPS = [['add', 'A + B'], ['sub', 'A − B'], ['mul', 'A × B'], ['det', 'det(A)'], ['inv', 'A⁻¹'], ['tr', 'Aᵀ'], ['bmul', 'B × A']];
  let op = ld('matrix.op', 'mul');
  const dimSel = (k) => `<div class="row"><label class="f">Rows<select data-k="${k}" data-d="0">${[1, 2, 3, 4].map((n) => `<option${n === sz[k][0] ? ' selected' : ''}>${n}</option>`).join('')}</select></label><label class="f">Columns<select data-k="${k}" data-d="1">${[1, 2, 3, 4].map((n) => `<option${n === sz[k][1] ? ' selected' : ''}>${n}</option>`).join('')}</select></label></div>`;
  el.innerHTML = `<div class="card" style="display:flex;flex-direction:column;gap:10px"><b>Matrix A</b>${dimSel('a')}<div id="ga"></div></div>
    <div class="card" style="display:flex;flex-direction:column;gap:10px"><b>Matrix B</b>${dimSel('b')}<div id="gb"></div></div>
    <div class="card" style="display:flex;flex-direction:column;gap:10px"><div style="display:flex;flex-wrap:wrap;gap:6px">${OPS.map(([k, l]) => `<button class="btn alt" data-op="${k}" style="flex:1 1 30%;min-height:44px">${l}</button>`).join('')}</div><div id="res" style="min-height:60px"></div></div>`;
  function grid(k) {
    const [r, c] = sz[k], v = vals[k];
    for (let i = 0; i < r; i++) { v[i] = v[i] || []; for (let j = 0; j < c; j++) if (v[i][j] === undefined) v[i][j] = '0'; }
    $('#g' + k, el).innerHTML = `<div style="display:grid;grid-template-columns:repeat(${c},1fr);gap:6px">${Array.from({ length: r * c }, (_, n) => { const i = Math.floor(n / c), j = n % c; return `<input type="text" inputmode="decimal" maxlength="12" data-k="${k}" data-i="${i}" data-j="${j}" value="${esc(String(v[i][j]))}" aria-label="Matrix ${k.toUpperCase()} row ${i + 1} column ${j + 1}" style="text-align:center;padding:10px 2px;min-height:44px">`; }).join('')}</div>`;
    $$('#g' + k + ' input', el).forEach((inp) => { inp.oninput = () => { vals[k][+inp.dataset.i][+inp.dataset.j] = inp.value; calc(); }; });
  }
  const read = (k) => { const [r, c] = sz[k]; return Array.from({ length: r }, (_, i) => Array.from({ length: c }, (_, j) => mxParseCell(vals[k][i][j]))); };
  const show = (M) => `<div style="display:inline-grid;grid-template-columns:repeat(${M[0].length},auto);gap:6px 16px;padding:8px 14px;border-left:3px solid var(--text);border-right:3px solid var(--text);border-radius:8px;font-variant-numeric:tabular-nums;font-size:18px">${[].concat(...M).map((v) => `<span style="text-align:right">${mxFmt(v)}</span>`).join('')}</div>`;
  const mxFmt = (v) => { if (Number.isInteger(v)) return String(v); const f = fracOf(v); return f || String(Math.round(v * 1e6) / 1e6); };
  function fracOf(v) { for (let d = 2; d <= 24; d++) { const n = v * d; if (Math.abs(n - Math.round(n)) < 1e-9) return Math.round(n) + '/' + d; } return ''; }
  function calc() {
    $$('[data-op]', el).forEach((b) => { b.className = 'btn ' + (b.dataset.op === op ? '' : 'alt'); });
    sv('matrix.op', op);
    const A = read('a'), B = read('b'), out = $('#res', el), bad = (M) => [].concat(...M).some((x) => !Number.isFinite(x));
    const need = op === 'add' || op === 'sub' || op === 'mul' || op === 'bmul';
    if (bad(A) || (need && bad(B))) { out.innerHTML = '<div class="status">Some cells are not numbers. Use digits, decimals or fractions like 1/2.</div>'; return; }
    let r, msg = '';
    if (op === 'add' || op === 'sub') { r = mxAdd(A, B, op === 'add' ? 1 : -1); if (!r) msg = 'A and B must have the same size.'; }
    else if (op === 'mul') { r = mxMul(A, B); if (!r) msg = `A has ${sz.a[1]} columns but B has ${sz.b[0]} rows. They must match.`; }
    else if (op === 'bmul') { r = mxMul(B, A); if (!r) msg = `B has ${sz.b[1]} columns but A has ${sz.a[0]} rows. They must match.`; }
    else if (op === 'tr') r = mxT(A);
    else if (op === 'det') { if (sz.a[0] !== sz.a[1]) msg = 'Determinant needs a square matrix.'; else { const d = mxDet(A); out.innerHTML = `<div class="muted" style="font-size:13px">det(A)</div><div class="mid" style="text-align:left">${mxFmt(d)}</div>${d === 0 ? '<div class="muted">Determinant is 0, so A has no inverse.</div>' : ''}`; return; } }
    else if (op === 'inv') { if (sz.a[0] !== sz.a[1]) msg = 'Inverse needs a square matrix.'; else { r = mxInv(A); if (!r) msg = 'This matrix is singular (determinant 0), so it has no inverse.'; } }
    if (!msg && r && [].concat(...r).some((x) => !Number.isFinite(x))) msg = 'The result is too large to show.';
    out.innerHTML = msg ? `<div class="status">${esc(msg)}</div>` : `<div class="muted" style="font-size:13px;margin-bottom:6px">Result (${r.length}×${r[0].length})</div><div style="overflow:auto">${show(r)}</div>`;
  }
  $$('select', el).forEach((s) => { s.onchange = () => { sz[s.dataset.k][+s.dataset.d] = +s.value; sv('matrix.sz', sz); grid(s.dataset.k); calc(); }; });
  $$('[data-op]', el).forEach((b) => { b.onclick = () => { op = b.dataset.op; calc(); }; });
  grid('a'); grid('b'); calc();
} });

/* ================= 14. Unit Circle & Trig Table ================= */
// ==PURE-START==
const SIN_EX = { 0: '0', 30: '1/2', 45: '√2/2', 60: '√3/2', 90: '1' };
const TAN_EX = { 0: '0', 30: '√3/3', 45: '1', 60: '√3', 90: 'undefined' };
const norm360 = (d) => ((d % 360) + 360) % 360;
// Exact value strings for angles that are multiples of 30 or 45 degrees; null otherwise.
const trigExact = (deg) => {
  const d = norm360(deg); if (Math.abs(d - Math.round(d)) > 1e-9) return null;
  const a = Math.round(d) % 360; if (a % 30 && a % 45) return null;
  const ref = a <= 90 ? a : a <= 180 ? 180 - a : a <= 270 ? a - 180 : 360 - a;
  const sgnS = a > 180 ? '-' : '', sgnC = a > 90 && a < 270 ? '-' : '', sgnT = (a > 0 && a < 90) || (a > 180 && a < 270) ? '' : '-';
  const z = (s, g) => (s === '0' ? '0' : g + s);
  const t = (a === 90 || a === 270) ? 'undefined' : z(TAN_EX[ref], sgnT);
  return { sin: z(SIN_EX[ref], sgnS), cos: z(SIN_EX[90 - ref], sgnC), tan: t };
};
// Radians as a multiple of pi, e.g. 150 -> "5π/6".
const radLabel = (deg) => {
  if (Math.round(deg) === 360) return '2π';
  const d = Math.round(norm360(deg));
  if (d === 0) return '0';
  const g = (function gcd(a, b) { return b ? gcd(b, a % b) : a; })(d, 180), n = d / g, m = 180 / g;
  return (n === 1 ? '' : n) + 'π' + (m === 1 ? '' : '/' + m);
};
const trigVals = (deg) => { const r = deg * Math.PI / 180, s = Math.sin(r), c = Math.cos(r); return { sin: Math.abs(s) < 1e-12 ? 0 : s, cos: Math.abs(c) < 1e-12 ? 0 : c, tan: Math.abs(c) < 1e-12 ? NaN : s / c }; };
// ==PURE-END==
reg({ id: 'trig', name: 'Trig Circle', icon: '♾️', desc: 'An interactive unit circle with sine, cosine and tangent for any angle, plus a table of exact values for the common angles in degrees and radians.', keys: ['trigonometry', 'sine', 'cosine', 'tangent', 'unit circle', 'radians', 'degrees', 'maths', 'sin cos tan'], needs: [], render(el) {
  let deg = 30;
  const R = 100, C = 120;
  el.innerHTML = `<div class="card" style="padding:14px"><svg id="sv" viewBox="0 0 240 240" style="width:100%;max-width:340px;display:block;margin:0 auto;touch-action:none" role="img" aria-label="Unit circle"></svg>
    <label class="f" style="margin-top:8px">Angle: <b id="av"></b><input id="sl" type="range" min="0" max="360" step="1" value="${deg}" style="min-height:44px"></label>
    <div class="row" style="margin-top:6px"><label class="f">Degrees<input id="dg" type="number" inputmode="decimal" min="-100000" max="100000" step="any" value="${deg}"></label><div class="f">Radians<div id="rd" style="padding:11px 0;font-size:16px;color:var(--text)"></div></div></div></div>
    <div class="card"><div class="row center"><div><div class="muted" style="font-size:12px">sin</div><div class="mid" id="s" style="color:#e5484d"></div></div><div><div class="muted" style="font-size:12px">cos</div><div class="mid" id="c" style="color:#3b82f6"></div></div><div><div class="muted" style="font-size:12px">tan</div><div class="mid" id="t"></div></div></div><div id="ex" class="muted center" style="font-size:13px;margin-top:8px"></div></div>
    <div class="card"><b>Exact values</b><div style="overflow:auto;margin-top:8px"><table style="width:100%;border-collapse:collapse;font-size:14px;text-align:center"><thead><tr class="muted"><th>deg</th><th>rad</th><th>sin</th><th>cos</th><th>tan</th></tr></thead><tbody id="tb"></tbody></table></div></div>`;
  const f4 = (v) => (Number.isFinite(v) ? (Math.round(v * 10000) / 10000).toString() : 'undefined');
  function upd(fromInput) {
    const d = norm360(deg), v = trigVals(d), r = d * Math.PI / 180, px = C + R * Math.cos(r), py = C - R * Math.sin(r), ex = trigExact(d);
    $('#sv', el).innerHTML = `<line x1="10" y1="${C}" x2="230" y2="${C}" stroke="var(--line)"/><line x1="${C}" y1="10" x2="${C}" y2="230" stroke="var(--line)"/><circle cx="${C}" cy="${C}" r="${R}" fill="none" stroke="var(--muted)" stroke-width="1.5"/>
      <path d="M ${C + 22} ${C} A 22 22 0 ${d > 180 ? 1 : 0} 0 ${C + 22 * Math.cos(r)} ${C - 22 * Math.sin(r)}" fill="none" stroke="var(--accent)" stroke-width="2"/>
      <line x1="${C}" y1="${C}" x2="${px}" y2="${py}" stroke="var(--accent)" stroke-width="2.5"/><line x1="${px}" y1="${py}" x2="${px}" y2="${C}" stroke="#e5484d" stroke-width="3"/><line x1="${C}" y1="${C}" x2="${px}" y2="${C}" stroke="#3b82f6" stroke-width="3"/>
      <circle cx="${px}" cy="${py}" r="9" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/><text x="226" y="${C - 4}" font-size="9" fill="var(--muted)">0°</text><text x="${C + 3}" y="18" font-size="9" fill="var(--muted)">90°</text><text x="12" y="${C - 4}" font-size="9" fill="var(--muted)">180°</text><text x="${C + 3}" y="236" font-size="9" fill="var(--muted)">270°</text>`;
    $('#av', el).textContent = (Math.round(d * 100) / 100) + '°';
    if (!fromInput) { $('#dg', el).value = Math.round(d * 100) / 100; }
    $('#sl', el).value = Math.round(d); $('#rd', el).textContent = (Math.round(r * 10000) / 10000) + ' rad' + (Number.isInteger(d) && (d % 30 === 0 || d % 45 === 0) ? ' = ' + radLabel(d) : '');
    $('#s', el).textContent = f4(v.sin); $('#c', el).textContent = f4(v.cos); $('#t', el).textContent = f4(v.tan);
    $('#ex', el).textContent = ex ? `Exact: sin = ${ex.sin}, cos = ${ex.cos}, tan = ${ex.tan}` : 'Exact forms are shown for multiples of 30° and 45°';
  }
  const pick = (e) => { const svg = $('#sv', el), rc = svg.getBoundingClientRect(), x = (e.clientX - rc.left) / rc.width * 240 - C, y = C - (e.clientY - rc.top) / rc.height * 240; deg = Math.round(norm360(Math.atan2(y, x) * 180 / Math.PI)); upd(); };
  let drag = false;
  const svg = $('#sv', el);
  svg.onpointerdown = (e) => { drag = true; svg.setPointerCapture(e.pointerId); pick(e); };
  svg.onpointermove = (e) => { if (drag) pick(e); };
  svg.onpointerup = svg.onpointercancel = () => { drag = false; };
  $('#sl', el).oninput = (e) => { deg = +e.target.value; upd(); };
  $('#dg', el).oninput = (e) => { const v = num(e.target.value); if (Number.isFinite(v) && Math.abs(v) <= 100000) { deg = v; upd(true); } };
  const rows = []; for (let a = 0; a <= 360; a += 15) { const ex = trigExact(a); if (ex) rows.push([a, ex]); }
  $('#tb', el).innerHTML = rows.map(([a, ex]) => `<tr data-a="${a}" style="border-top:1px solid var(--line);cursor:pointer;height:40px"><td><b>${a}°</b></td><td>${radLabel(a)}${a === 360 ? '' : ''}</td><td>${ex.sin}</td><td>${ex.cos}</td><td>${ex.tan}</td></tr>`).join('');
  $$('[data-a]', el).forEach((r) => { r.onclick = () => { deg = +r.dataset.a; upd(); }; });
  upd();
} });

/* ================= 15. Periodic Table ================= */
// ==PURE-START==
const EL_DATA = 'H Hydrogen 1.008|He Helium 4.0026|Li Lithium 6.94|Be Beryllium 9.0122|B Boron 10.81|C Carbon 12.011|N Nitrogen 14.007|O Oxygen 15.999|F Fluorine 18.998|Ne Neon 20.18|Na Sodium 22.99|Mg Magnesium 24.305|Al Aluminium 26.982|Si Silicon 28.085|P Phosphorus 30.974|S Sulfur 32.06|Cl Chlorine 35.45|Ar Argon 39.948|K Potassium 39.098|Ca Calcium 40.078|Sc Scandium 44.956|Ti Titanium 47.867|V Vanadium 50.942|Cr Chromium 51.996|Mn Manganese 54.938|Fe Iron 55.845|Co Cobalt 58.933|Ni Nickel 58.693|Cu Copper 63.546|Zn Zinc 65.38|Ga Gallium 69.723|Ge Germanium 72.63|As Arsenic 74.922|Se Selenium 78.971|Br Bromine 79.904|Kr Krypton 83.798|Rb Rubidium 85.468|Sr Strontium 87.62|Y Yttrium 88.906|Zr Zirconium 91.224|Nb Niobium 92.906|Mo Molybdenum 95.95|Tc Technetium 98|Ru Ruthenium 101.07|Rh Rhodium 102.91|Pd Palladium 106.42|Ag Silver 107.87|Cd Cadmium 112.41|In Indium 114.82|Sn Tin 118.71|Sb Antimony 121.76|Te Tellurium 127.6|I Iodine 126.9|Xe Xenon 131.29|Cs Caesium 132.91|Ba Barium 137.33|La Lanthanum 138.91|Ce Cerium 140.12|Pr Praseodymium 140.91|Nd Neodymium 144.24|Pm Promethium 145|Sm Samarium 150.36|Eu Europium 151.96|Gd Gadolinium 157.25|Tb Terbium 158.93|Dy Dysprosium 162.5|Ho Holmium 164.93|Er Erbium 167.26|Tm Thulium 168.93|Yb Ytterbium 173.05|Lu Lutetium 174.97|Hf Hafnium 178.49|Ta Tantalum 180.95|W Tungsten 183.84|Re Rhenium 186.21|Os Osmium 190.23|Ir Iridium 192.22|Pt Platinum 195.08|Au Gold 196.97|Hg Mercury 200.59|Tl Thallium 204.38|Pb Lead 207.2|Bi Bismuth 208.98|Po Polonium 209|At Astatine 210|Rn Radon 222|Fr Francium 223|Ra Radium 226|Ac Actinium 227|Th Thorium 232.04|Pa Protactinium 231.04|U Uranium 238.03|Np Neptunium 237|Pu Plutonium 244|Am Americium 243|Cm Curium 247|Bk Berkelium 247|Cf Californium 251|Es Einsteinium 252|Fm Fermium 257|Md Mendelevium 258|No Nobelium 259|Lr Lawrencium 266|Rf Rutherfordium 267|Db Dubnium 268|Sg Seaborgium 269|Bh Bohrium 270|Hs Hassium 277|Mt Meitnerium 278|Ds Darmstadtium 281|Rg Roentgenium 282|Cn Copernicium 285|Nh Nihonium 286|Fl Flerovium 289|Mc Moscovium 290|Lv Livermorium 293|Ts Tennessine 294|Og Oganesson 294';
const EL_CATS = { alkali: ['Alkali metal', '#ef4444'], alkaline: ['Alkaline earth metal', '#f97316'], trans: ['Transition metal', '#eab308'], post: ['Post-transition metal', '#22c55e'], metalloid: ['Metalloid', '#14b8a6'], nonmetal: ['Nonmetal', '#3b82f6'], halogen: ['Halogen', '#8b5cf6'], noble: ['Noble gas', '#ec4899'], lanth: ['Lanthanide', '#06b6d4'], actin: ['Actinide', '#a16207'] };
const elCat = (z) => {
  if ([3, 11, 19, 37, 55, 87].includes(z)) return 'alkali';
  if ([4, 12, 20, 38, 56, 88].includes(z)) return 'alkaline';
  if (z >= 57 && z <= 71) return 'lanth';
  if (z >= 89 && z <= 103) return 'actin';
  if ([9, 17, 35, 53, 85, 117].includes(z)) return 'halogen';
  if ([2, 10, 18, 36, 54, 86, 118].includes(z)) return 'noble';
  if ([5, 14, 32, 33, 51, 52].includes(z)) return 'metalloid';
  if ([1, 6, 7, 8, 15, 16, 34].includes(z)) return 'nonmetal';
  if ([13, 31, 49, 50, 81, 82, 83, 84, 113, 114, 115, 116].includes(z)) return 'post';
  return 'trans';
};
const elState = (z) => ([1, 2, 7, 8, 9, 10, 17, 18, 36, 54, 86].includes(z) ? 'Gas' : [35, 80].includes(z) ? 'Liquid' : z >= 104 ? 'Unknown (synthetic)' : 'Solid');
// Table position: {r: row 1-7 (f-block rows 9 and 10), c: column 1-18}; group is null for the f-block.
const elPos = (z) => {
  if (z === 1) return { r: 1, c: 1, g: 1 };
  if (z === 2) return { r: 1, c: 18, g: 18 };
  const P = [[3, 10, 2], [11, 18, 3], [19, 36, 4], [37, 54, 5], [55, 86, 6], [87, 118, 7]];
  const [s, , r] = P.find(([a, b]) => z >= a && z <= b);
  const o = z - s;
  if (r <= 3) return { r, c: o < 2 ? o + 1 : o + 11, g: o < 2 ? o + 1 : o + 11 };
  if (r <= 5) return { r, c: o + 1, g: o + 1 };
  if (o < 2) return { r, c: o + 1, g: o + 1 };
  const f0 = r === 6 ? 57 : 89;
  if (z >= f0 && z < f0 + 15) return { r: r === 6 ? 9 : 10, c: z - f0 + 3, g: null };
  return { r, c: z - f0 - 15 + 4, g: z - f0 - 15 + 4 };
};
const ELEMENTS = EL_DATA.split('|').map((s, i) => { const [sym, name, mass] = s.split(' '); return Object.assign({ z: i + 1, sym, name, mass: parseFloat(mass), cat: elCat(i + 1), state: elState(i + 1) }, elPos(i + 1)); });
// ==PURE-END==
reg({ id: 'periodic', name: 'Periodic Table', icon: '⚛️', cat: 'text', desc: 'All 118 elements in a colour-coded periodic table with symbol, name, atomic number and mass, a searchable list and a detail card for each element.', keys: ['chemistry', 'elements', 'atomic number', 'atomic mass', 'science', 'symbol', 'noble gas', 'metal'], needs: [], render(el) {
  let sel = ld('periodic.sel', 6), hi = '';
  const cell = (e) => `<button data-z="${e.z}" aria-label="${esc(e.name)}, atomic number ${e.z}" style="grid-row:${e.r};grid-column:${e.c};min-height:42px;padding:2px 0;border:2px solid ${e.z === sel ? 'var(--text)' : 'transparent'};border-radius:8px;background:color-mix(in srgb,${EL_CATS[e.cat][1]} 28%,var(--surface));color:var(--text);line-height:1.05;display:flex;flex-direction:column;align-items:center;justify-content:center"><span style="font-size:8px;color:var(--muted)">${e.z}</span><b style="font-size:14px">${e.sym}</b></button>`;
  el.innerHTML = `<div class="card" style="padding:14px"><label class="f">Search by name, symbol or number<input id="q" type="search" maxlength="20" autocomplete="off" placeholder="e.g. gold, Fe, 26"></label><div id="hits" class="list" style="margin-top:8px"></div></div>
    <div id="det"></div>
    <div class="card" style="padding:10px"><div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">${Object.entries(EL_CATS).map(([k, [n, c]]) => `<button data-cat="${k}" style="display:flex;align-items:center;gap:6px;padding:6px 10px;min-height:36px;border:1px solid var(--line);border-radius:99px;background:var(--surface);color:var(--text);font-size:12px"><i style="width:10px;height:10px;border-radius:50%;background:${c}"></i>${n}</button>`).join('')}</div>
    <div style="overflow-x:auto"><div id="tb" style="display:grid;grid-template-columns:repeat(18,38px);grid-template-rows:repeat(7,42px) 12px repeat(2,42px);gap:3px;width:max-content"></div></div><div class="muted" style="font-size:12px;margin-top:6px">Swipe sideways to see the whole table. Lanthanides and actinides are the two rows at the bottom. Tap a group name to highlight it.</div></div>`;
  function draw() {
    $('#tb', el).innerHTML = ELEMENTS.map(cell).join('') + `<span style="grid-row:6;grid-column:3;font-size:9px;display:grid;place-items:center" class="muted">57-71</span><span style="grid-row:7;grid-column:3;font-size:9px;display:grid;place-items:center" class="muted">89-103</span>`;
    $$('#tb [data-z]', el).forEach((b) => { const e = ELEMENTS[+b.dataset.z - 1]; if (hi && e.cat !== hi) b.style.opacity = '.22'; b.onclick = () => { sel = e.z; sv('periodic.sel', sel); draw(); detail(); }; });
  }
  function detail() {
    const e = ELEMENTS[sel - 1], [cn, cc] = EL_CATS[e.cat];
    $('#det', el).innerHTML = `<div class="card" style="display:flex;gap:16px;align-items:center;border-left:6px solid ${cc}"><div style="width:96px;height:96px;border-radius:16px;background:color-mix(in srgb,${cc} 25%,var(--surface));display:flex;flex-direction:column;align-items:center;justify-content:center;flex:0 0 96px"><span class="muted" style="font-size:13px">${e.z}</span><b style="font-size:36px;line-height:1">${e.sym}</b><span class="muted" style="font-size:11px">${e.mass}</span></div>
      <div style="min-width:0"><div class="mid" style="text-align:left;font-size:24px">${esc(e.name)}</div><div style="color:${cc};font-weight:600;font-size:14px">${cn}</div><div class="muted" style="font-size:13px;margin-top:6px">Atomic number ${e.z}<br>Atomic mass ${e.mass} u<br>${e.g ? 'Group ' + e.g + ', ' : ''}${e.cat === 'lanth' || e.cat === 'actin' ? 'Period ' + (e.r === 9 ? 6 : 7) : 'Period ' + e.r}<br>State at room temp: ${e.state}</div></div></div>`;
  }
  $('#q', el).oninput = (ev) => {
    const q = ev.target.value.trim().toLowerCase(), h = $('#hits', el);
    if (!q) { h.innerHTML = ''; return; }
    const m = ELEMENTS.filter((e) => e.name.toLowerCase().includes(q) || e.sym.toLowerCase() === q || String(e.z) === q).slice(0, 8);
    h.innerHTML = m.length ? m.map((e) => `<button class="item" data-h="${e.z}" style="width:100%;text-align:left;color:var(--text);min-height:48px"><b style="width:34px">${e.sym}</b><span class="grow">${esc(e.name)}</span><span class="muted">${e.z}</span></button>`).join('') : '<div class="muted">No match.</div>';
    $$('[data-h]', el).forEach((b) => { b.onclick = () => { sel = +b.dataset.h; sv('periodic.sel', sel); draw(); detail(); }; });
  };
  $$('[data-cat]', el).forEach((b) => { b.onclick = () => { hi = hi === b.dataset.cat ? '' : b.dataset.cat; $$('[data-cat]', el).forEach((x) => { x.style.borderColor = x.dataset.cat === hi ? 'var(--text)' : 'var(--line)'; }); draw(); }; });
  draw(); detail();
} });

/* ================= 16. Country Codes ================= */
// ==PURE-START==
// ISO2 ISO3 dial currency Name
const CC_DATA = 'AF AFG 93 AFN Afghanistan|AR ARG 54 ARS Argentina|AU AUS 61 AUD Australia|AT AUT 43 EUR Austria|BD BGD 880 BDT Bangladesh|BE BEL 32 EUR Belgium|BT BTN 975 BTN Bhutan|BO BOL 591 BOB Bolivia|BR BRA 55 BRL Brazil|BG BGR 359 EUR Bulgaria|KH KHM 855 KHR Cambodia|CA CAN 1 CAD Canada|CL CHL 56 CLP Chile|CN CHN 86 CNY China|CO COL 57 COP Colombia|CR CRI 506 CRC Costa Rica|HR HRV 385 EUR Croatia|CU CUB 53 CUP Cuba|CY CYP 357 EUR Cyprus|CZ CZE 420 CZK Czechia|DK DNK 45 DKK Denmark|DO DOM 1 DOP Dominican Republic|EC ECU 593 USD Ecuador|EG EGY 20 EGP Egypt|EE EST 372 EUR Estonia|ET ETH 251 ETB Ethiopia|FJ FJI 679 FJD Fiji|FI FIN 358 EUR Finland|FR FRA 33 EUR France|DE DEU 49 EUR Germany|GH GHA 233 GHS Ghana|GR GRC 30 EUR Greece|GT GTM 502 GTQ Guatemala|HK HKG 852 HKD Hong Kong|HU HUN 36 HUF Hungary|IS ISL 354 ISK Iceland|IN IND 91 INR India|ID IDN 62 IDR Indonesia|IR IRN 98 IRR Iran|IQ IRQ 964 IQD Iraq|IE IRL 353 EUR Ireland|IL ISR 972 ILS Israel|IT ITA 39 EUR Italy|JM JAM 1 JMD Jamaica|JP JPN 81 JPY Japan|JO JOR 962 JOD Jordan|KZ KAZ 7 KZT Kazakhstan|KE KEN 254 KES Kenya|KW KWT 965 KWD Kuwait|LA LAO 856 LAK Laos|LV LVA 371 EUR Latvia|LB LBN 961 LBP Lebanon|LY LBY 218 LYD Libya|LT LTU 370 EUR Lithuania|LU LUX 352 EUR Luxembourg|MY MYS 60 MYR Malaysia|MV MDV 960 MVR Maldives|MT MLT 356 EUR Malta|MU MUS 230 MUR Mauritius|MX MEX 52 MXN Mexico|MN MNG 976 MNT Mongolia|MA MAR 212 MAD Morocco|MM MMR 95 MMK Myanmar|NP NPL 977 NPR Nepal|NL NLD 31 EUR Netherlands|NZ NZL 64 NZD New Zealand|NG NGA 234 NGN Nigeria|KP PRK 850 KPW North Korea|NO NOR 47 NOK Norway|OM OMN 968 OMR Oman|PK PAK 92 PKR Pakistan|PA PAN 507 PAB Panama|PY PRY 595 PYG Paraguay|PE PER 51 PEN Peru|PH PHL 63 PHP Philippines|PL POL 48 PLN Poland|PT PRT 351 EUR Portugal|QA QAT 974 QAR Qatar|RO ROU 40 RON Romania|RU RUS 7 RUB Russia|SA SAU 966 SAR Saudi Arabia|RS SRB 381 RSD Serbia|SG SGP 65 SGD Singapore|SK SVK 421 EUR Slovakia|SI SVN 386 EUR Slovenia|ZA ZAF 27 ZAR South Africa|KR KOR 82 KRW South Korea|ES ESP 34 EUR Spain|LK LKA 94 LKR Sri Lanka|SE SWE 46 SEK Sweden|CH CHE 41 CHF Switzerland|SY SYR 963 SYP Syria|TW TWN 886 TWD Taiwan|TZ TZA 255 TZS Tanzania|TH THA 66 THB Thailand|TN TUN 216 TND Tunisia|TR TUR 90 TRY Turkey|UG UGA 256 UGX Uganda|UA UKR 380 UAH Ukraine|AE ARE 971 AED United Arab Emirates|GB GBR 44 GBP United Kingdom|US USA 1 USD United States|UY URY 598 UYU Uruguay|UZ UZB 998 UZS Uzbekistan|VE VEN 58 VES Venezuela|VN VNM 84 VND Vietnam|YE YEM 967 YER Yemen|ZM ZMB 260 ZMW Zambia|ZW ZWE 263 ZWL Zimbabwe';
const COUNTRIES = CC_DATA.split('|').map((s) => { const p = s.split(' '); return { a2: p[0], a3: p[1], dial: p[2], cur: p[3], name: p.slice(4).join(' ') }; });
const flagOf = (a2) => String.fromCodePoint(...a2.split('').map((c) => 0x1F1E6 + c.charCodeAt(0) - 65));
const ccSearch = (q, list) => {
  q = String(q).trim().toLowerCase().replace(/^\+/, '');
  if (!q) return list;
  return list.filter((c) => c.name.toLowerCase().includes(q) || c.a2.toLowerCase() === q || c.a3.toLowerCase() === q || c.cur.toLowerCase() === q || c.dial.startsWith(q));
};
// ==PURE-END==
reg({ id: 'countrycodes', name: 'Country Codes', icon: '🏳️', cat: 'text', desc: 'Searchable list of about 100 countries with flag, phone dial code, ISO 2 and 3 letter codes and currency code, all available offline.', keys: ['dial code', 'phone code', 'iso', 'country', 'calling code', 'currency code', 'isd', 'flag'], needs: [], render(el) {
  el.innerHTML = `<div class="card" style="padding:14px"><label class="f">Search country, code, currency or +dial<input id="q" type="search" maxlength="30" autocomplete="off" placeholder="e.g. india, JP, EUR, +44"></label><div id="n" class="muted" style="font-size:12px;margin-top:6px"></div></div><div id="ls" class="list"></div><div class="muted" style="font-size:12px">Tap a country to copy its dial code. Shared codes (such as +1 or +7) cover more than one country.</div>`;
  function run() {
    const m = ccSearch($('#q', el).value, COUNTRIES);
    $('#n', el).textContent = m.length + ' of ' + COUNTRIES.length + ' countries';
    $('#ls', el).innerHTML = m.length ? m.map((c) => `<button class="item" data-d="${c.dial}" style="width:100%;text-align:left;color:var(--text);min-height:60px"><span style="font-size:28px">${flagOf(c.a2)}</span><span class="grow"><b>${esc(c.name)}</b><div class="muted" style="font-size:12px">${c.a2} · ${c.a3} · ${c.cur}</div></span><b style="color:var(--accent)">+${c.dial}</b></button>`).join('') : '<div class="card muted center" style="padding:24px">No match.</div>';
    $$('[data-d]', el).forEach((b) => { b.onclick = () => copyText('+' + b.dataset.d); });
  }
  $('#q', el).oninput = run; run();
} });

/* ================= 17. Colour Blindness Simulator ================= */
// ==PURE-START==
// Machado et al. (2009) matrices at full severity, applied in linear RGB.
const CB_MAT = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]]
};
const toLin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const toSrgb = (l) => { l = Math.max(0, Math.min(1, l)); return Math.round(255 * (l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055)); };
const cbPixel = (r, g, b, type) => {
  const lr = toLin(r), lg = toLin(g), lb = toLin(b);
  if (type === 'achro') { const y = toSrgb(0.2126 * lr + 0.7152 * lg + 0.0722 * lb); return [y, y, y]; }
  const m = CB_MAT[type];
  if (!m) return [r, g, b];
  return m.map((row) => toSrgb(row[0] * lr + row[1] * lg + row[2] * lb));
};
// ==PURE-END==
reg({ id: 'cbsim', name: 'Colour Blind Sim', icon: '🕶️', cat: 'camera', desc: 'Choose a photo and see how it looks to people with protanopia, deuteranopia, tritanopia or total colour blindness, then save the simulated image.', keys: ['colour blindness', 'color blind', 'daltonism', 'accessibility', 'protanopia', 'deuteranopia', 'tritanopia', 'vision', 'simulator'], needs: ['storage'], render(el) {
  let img = null, type = 'deutan';
  const TYPES = [['deutan', 'Deuteranopia', 'No green cones. The most common type (about 6% of men).'], ['protan', 'Protanopia', 'No red cones. Reds look dark and muddy.'], ['tritan', 'Tritanopia', 'No blue cones. Blues and yellows are confused. Rare.'], ['achro', 'Achromatopsia', 'No colour vision at all: a grey-scale view.']];
  el.innerHTML = `<div class="card" style="display:flex;flex-direction:column;gap:12px"><button class="btn" id="pk" style="min-height:52px">Choose a photo</button>
    <label class="f">Type of colour blindness<select id="ty">${TYPES.map(([k, n]) => `<option value="${k}"${k === type ? ' selected' : ''}>${n}</option>`).join('')}</select></label><div id="ds" class="muted" style="font-size:13px"></div></div>
    <div id="vw" hidden style="display:flex;flex-direction:column;gap:12px"><div class="card" style="padding:10px"><div class="muted" style="font-size:12px;margin-bottom:6px">Normal vision</div><canvas id="c0" style="background:var(--surface2)"></canvas></div><div class="card" style="padding:10px"><div class="muted" style="font-size:12px;margin-bottom:6px" id="tl"></div><canvas id="c1" style="background:var(--surface2)"></canvas></div><button class="btn" id="sv" style="min-height:48px">Save simulated image</button></div>
    <div class="muted" style="font-size:12px">An approximation based on published colour-vision models. Real experiences vary between people. The photo never leaves your device.</div>`;
  const c0 = $('#c0', el), c1 = $('#c1', el);
  function run() {
    $('#ds', el).textContent = TYPES.find((t) => t[0] === type)[2];
    if (!img) return;
    $('#vw', el).hidden = false; $('#vw', el).style.display = 'flex';
    $('#tl', el).textContent = TYPES.find((t) => t[0] === type)[1];
    const k = Math.min(1, 720 / Math.max(img.naturalWidth, img.naturalHeight)), w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
    c0.width = c1.width = w; c0.height = c1.height = h;
    c0.getContext('2d').drawImage(img, 0, 0, w, h);
    const d = c0.getContext('2d').getImageData(0, 0, w, h), o = c1.getContext('2d').createImageData(w, h), cache = new Map();
    for (let i = 0; i < d.data.length; i += 4) {
      const key = (d.data[i] << 16) | (d.data[i + 1] << 8) | d.data[i + 2];
      let v = cache.get(key);
      if (!v) { v = cbPixel(d.data[i], d.data[i + 1], d.data[i + 2], type); cache.set(key, v); }
      o.data[i] = v[0]; o.data[i + 1] = v[1]; o.data[i + 2] = v[2]; o.data[i + 3] = d.data[i + 3];
    }
    c1.getContext('2d').putImageData(o, 0, 0);
  }
  $('#pk', el).onclick = () => pickImage((im) => { img = im; run(); });
  $('#ty', el).onchange = (e) => { type = e.target.value; run(); };
  $('#sv', el).onclick = async () => { const b = await tbl(c1); if (b) saveBlob(b, 'colour-blind-' + type + '.png'); else toast('Could not save'); };
  run();
  return () => { img = null; c0.width = c0.height = c1.width = c1.height = 0; };
} });


/* ================= 18. Image to ASCII Art ================= */
// ==PURE-START==
const ASCII_RAMPS = { detailed: ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$', classic: ' .:-=+*#%@', simple: ' .oO@', blocks: ' ░▒▓█' };
// luma: Float array/Uint8 of w*h values 0..255 (0 = black). Characters are about twice as tall as wide, so rows are halved.
const asciiArt = (luma, w, h, cols, ramp, invert) => {
  cols = Math.max(1, Math.min(w, cols)); const rows = Math.max(1, Math.round(h / w * cols * 0.5));
  const cw = w / cols, ch = h / rows, chars = Array.from(ramp), out = [];
  for (let r = 0; r < rows; r++) {
    let line = '';
    for (let c = 0; c < cols; c++) {
      let s = 0, n = 0;
      const x0 = Math.floor(c * cw), x1 = Math.max(x0 + 1, Math.floor((c + 1) * cw)), y0 = Math.floor(r * ch), y1 = Math.max(y0 + 1, Math.floor((r + 1) * ch));
      for (let y = y0; y < Math.min(h, y1); y++) for (let x = x0; x < Math.min(w, x1); x++) { s += luma[y * w + x]; n++; }
      let v = n ? s / n / 255 : 0; if (invert) v = 1 - v;
      line += chars[Math.min(chars.length - 1, Math.floor((1 - v) * chars.length))];
    }
    out.push(line.replace(/\s+$/, ''));
  }
  return out.join('\n');
};
// ==PURE-END==
reg({ id: 'asciiart', name: 'ASCII Art', icon: '🅰️', cat: 'create', desc: 'Turn any photo into text art made of characters, with adjustable width, several character sets and an invert option, then copy or save it.', keys: ['ascii', 'text art', 'image to text', 'picture', 'characters', 'convert'], needs: [], render(el) {
  let img = null, text = '';
  el.innerHTML = `<div class="card" style="display:flex;flex-direction:column;gap:12px"><button class="btn" id="pk" style="min-height:52px">Choose a photo</button>
    <label class="f">Width: <b id="cv">60</b> characters<input id="cl" type="range" min="20" max="140" value="60" style="min-height:44px"></label>
    <label class="f">Characters<select id="rp"><option value="classic">Classic</option><option value="detailed">Detailed</option><option value="simple">Simple</option><option value="blocks">Blocks</option></select></label>
    <label style="display:flex;align-items:center;gap:8px;min-height:44px"><input type="checkbox" id="iv"> Invert (light characters on dark pictures)</label></div>
    <div class="card" style="padding:10px"><div style="overflow:auto;max-height:70vh;background:var(--surface2);border-radius:10px;padding:8px"><pre id="pre" style="margin:0;font-family:ui-monospace,Menlo,Consolas,monospace;line-height:1;white-space:pre;color:var(--text)"></pre></div><div class="muted center" id="ph" style="padding:20px">Pick a picture to begin</div></div>
    <div class="row"><button class="btn" id="cp" style="min-height:48px">Copy text</button><button class="btn alt" id="sv" style="min-height:48px">Save .txt</button></div>`;
  const pre = $('#pre', el);
  function run() {
    if (!img) return;
    const cols = +$('#cl', el).value, k = Math.min(1, 600 / Math.max(img.naturalWidth, img.naturalHeight)), w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data, luma = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) luma[i] = 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2];
    // On a light page, dark pixels should print dense characters; the invert switch flips that.
    text = asciiArt(luma, w, h, cols, ASCII_RAMPS[$('#rp', el).value], $('#iv', el).checked);
    pre.textContent = text; $('#ph', el).hidden = true;
    pre.style.fontSize = Math.max(4, Math.min(14, Math.floor(((el.clientWidth || 360) - 60) / (cols * 0.6)))) + 'px';
  }
  $('#pk', el).onclick = () => pickImage((im) => { img = im; run(); });
  $('#cl', el).oninput = (e) => { $('#cv', el).textContent = e.target.value; run(); };
  $('#rp', el).onchange = run; $('#iv', el).onchange = run;
  $('#cp', el).onclick = () => { if (text) copyText(text); else toast('Pick a picture first'); };
  $('#sv', el).onclick = () => { if (text) saveText('ascii-art.txt', text); else toast('Pick a picture first'); };
  return () => { img = null; };
} });

/* ================= 19. Random Name & Story Generator ================= */
// ==PURE-START==
const NG = {
  adj: 'Grumpy Sneaky Wobbly Fluffy Cosmic Sleepy Dizzy Mighty Sparkly Crunchy Bouncy Cheeky Funky Giggly Jolly Lazy Mellow Nifty Quirky Rowdy Salty Spicy Squishy Wacky Zesty Brave Clumsy Dapper Epic Fancy Gentle Hasty Jazzy Lucky Mystic Noisy Plucky Rusty Silly Tipsy Velvet'.split(' '),
  noun: 'Penguin Waffle Dragon Pickle Muffin Walrus Noodle Cactus Badger Llama Taco Pancake Wizard Potato Ninja Robot Panda Narwhal Biscuit Otter Goblin Unicorn Pretzel Yeti Sloth Banana Falcon Hedgehog Meerkat Octopus Pirate Turnip Gecko Moose Donut Comet Raccoon Kraken Dumpling Toaster'.split(' '),
  first: 'Alex Bella Charlie Dev Ella Finn Gina Hugo Isla Jasper Kira Leo Maya Noah Olive Priya Quinn Rohan Sana Theo Uma Vik Wren Xavi Yara Zane Anya Bruno Cleo Dara Eli Farah Gus Hana Ivan Jade Kai Lena Milo Nora'.split(' '),
  last: 'Pepperpot Bumblesnatch Wigglesworth Fizzlebottom Snickerdoodle Muddlepuddle Cabbagepatch Thistlewick Honeybunch Crumpetson Doodlebug Flapjack Gigglesby Hullabaloo Jellybean Knucklebone Lollygag Marshmallow Noodlesby Pumpernickel Quibblesnort Razzmatazz Sockpuppet Tumbleweed Umbrellabird Whippersnap'.split(' '),
  team: 'Rockets Thunder Wolves Titans Ninjas Dragons Comets Vipers Phoenix Falcons Sharks Storm Legends Raiders Blazers Mavericks Pandas Knights Cyclones Jaguars'.split(' '),
  who: ['a retired space pirate', 'a nervous baker', 'two mismatched twins', 'a talking cat', 'an overworked wizard', 'a very tiny giant', 'a forgetful detective', 'the last dragon librarian', 'a timid robot', 'a lighthouse keeper', 'a bored astronaut', 'a clumsy knight'],
  where: ['in a floating castle', 'at the bottom of the ocean', 'on the last train home', 'inside an old clock', 'beside a glowing swamp', 'in a village with no doors', 'on a runaway cloud', 'under the city market', 'at the edge of the map'],
  what: ['discovered a map that kept changing', 'lost the only key to everything', 'found a door that was not there yesterday', 'woke up with a mysterious superpower', 'received a letter from the future', 'accidentally swapped places with a stranger', 'heard a song nobody else could hear', 'inherited a very suspicious sandwich', 'was challenged to a duel at dawn'],
  twist: ['But the key was hidden in plain sight.', 'Then the lights went out.', 'Nobody knew the real reason.', 'And that was only the beginning.', 'Unfortunately, it was a Tuesday.', 'Then a tiny voice said, "Finally!"', 'The only clue was a single feather.']
};
const pickOne = (a, rnd) => a[Math.floor((rnd || Math.random)() * a.length) % a.length];
const genName = (kind, rnd) => {
  if (kind === 'silly') return pickOne(NG.first, rnd) + ' ' + pickOne(NG.last, rnd);
  if (kind === 'team') return 'The ' + pickOne(NG.adj, rnd) + ' ' + pickOne(NG.team, rnd);
  if (kind === 'story') return pickOne(NG.who, rnd).replace(/^./, (c) => c.toUpperCase()) + ' ' + pickOne(NG.where, rnd) + ' ' + pickOne(NG.what, rnd) + '. ' + pickOne(NG.twist, rnd);
  return pickOne(NG.adj, rnd) + ' ' + pickOne(NG.noun, rnd);
};
// ==PURE-END==
reg({ id: 'namegen', name: 'Silly Names', icon: '🤪', cat: 'fun', desc: 'Generate silly names, funny nicknames, team names and story starters from built-in word lists, and keep the ones you love.', keys: ['random', 'name generator', 'story starter', 'team name', 'writing prompt', 'nickname', 'funny'], needs: ['storage'], render(el) {
  let kind = ld('namegen.kind', 'nick'), favs = ld('namegen.favs', []), items = [];
  const KINDS = [['nick', 'Nicknames'], ['silly', 'Silly names'], ['team', 'Team names'], ['story', 'Story starters']];
  el.innerHTML = `${tabBar('tb', KINDS, kind)}<button class="btn" id="go" style="min-height:56px;font-size:18px">🎲 Generate</button><div id="ls" class="list"></div>
    <div class="card"><b>Favourites</b><div id="fv" class="list" style="margin-top:8px"></div></div>`;
  const row = (t, fav) => `<div class="item" style="align-items:flex-start"><span class="grow" style="font-size:${kind === 'story' ? 15 : 19}px;font-weight:${kind === 'story' ? 400 : 600};word-break:break-word">${esc(t)}</span><button class="btn alt" data-${fav ? 'rm' : 'sv'}="${esc(t)}" aria-label="${fav ? 'Remove favourite' : 'Save favourite'}" style="min-height:44px;min-width:44px">${fav ? '✕' : '☆'}</button><button class="btn alt" data-cp="${esc(t)}" aria-label="Copy" style="min-height:44px;min-width:44px">⧉</button></div>`;
  function draw() {
    $('#ls', el).innerHTML = items.map((t) => row(t, false)).join('');
    $('#fv', el).innerHTML = favs.length ? favs.map((t) => row(t, true)).join('') : '<div class="muted">Tap ☆ to keep a result.</div>';
    $$('[data-cp]', el).forEach((b) => { b.onclick = () => copyText(b.dataset.cp); });
    $$('[data-sv]', el).forEach((b) => { b.onclick = () => { if (!favs.includes(b.dataset.sv)) { favs.unshift(b.dataset.sv); favs = favs.slice(0, 100); sv('namegen.favs', favs); } draw(); }; });
    $$('[data-rm]', el).forEach((b) => { b.onclick = () => { favs = favs.filter((x) => x !== b.dataset.rm); sv('namegen.favs', favs); draw(); }; });
  }
  function gen() { const s = new Set(); let guard = 0; const n = kind === 'story' ? 4 : 8; while (s.size < n && guard++ < 100) s.add(genName(kind)); items = [...s]; draw(); }
  $$('#tb button', el).forEach((b) => { b.onclick = () => { kind = b.dataset.t; sv('namegen.kind', kind); $$('#tb button', el).forEach((x) => { x.className = 'btn ' + (x === b ? '' : 'alt'); }); gen(); }; });
  $('#go', el).onclick = gen; gen();
} });

/* ================= 20. Palette from Image ================= */
// ==PURE-START==
// Median cut + k-means refinement: pixels = [[r,g,b],...]. Returns [{rgb:[r,g,b], share}] sorted by share, at most k entries.
const medianCut = (pixels, k) => {
  if (!pixels.length) return [];
  let boxes = [pixels.slice()];
  const range = (box) => { const lo = [255, 255, 255], hi = [0, 0, 0]; box.forEach((p) => { for (let i = 0; i < 3; i++) { if (p[i] < lo[i]) lo[i] = p[i]; if (p[i] > hi[i]) hi[i] = p[i]; } }); return [0, 1, 2].map((i) => hi[i] - lo[i]); };
  while (boxes.length < k) {
    let bi = -1, bs = 0, bc = 0;
    boxes.forEach((b, i) => { if (b.length < 2) return; const r = range(b), mx = Math.max(...r), score = mx * Math.sqrt(b.length); if (mx > 0 && score > bs) { bs = score; bi = i; bc = r.indexOf(mx); } });
    if (bi < 0) break;
    const b = boxes[bi].sort((p, q) => p[bc] - q[bc]), mid = b.length >> 1;
    boxes.splice(bi, 1, b.slice(0, mid), b.slice(mid));
  }
  // Median cut gives the starting colours; a few k-means passes then move them onto the real clusters.
  let cents = boxes.filter((b) => b.length).map((b) => { const s = [0, 0, 0]; b.forEach((p) => { s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; }); return s.map((v) => v / b.length); });
  let counts = [];
  for (let it = 0; it < 8; it++) {
    const sums = cents.map(() => [0, 0, 0, 0]);
    pixels.forEach((p) => {
      let bi = 0, bd = Infinity;
      for (let i = 0; i < cents.length; i++) { const c = cents[i], d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (d < bd) { bd = d; bi = i; } }
      const s = sums[bi]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++;
    });
    cents = cents.map((c, i) => (sums[i][3] ? [sums[i][0] / sums[i][3], sums[i][1] / sums[i][3], sums[i][2] / sums[i][3]] : c));
    counts = sums.map((s) => s[3]);
  }
  return cents.map((c, i) => ({ rgb: c.map(Math.round), share: counts[i] / pixels.length })).filter((c) => c.share > 0).sort((a, b) => b.share - a.share);
};
// ==PURE-END==
reg({ id: 'imgpalette', name: 'Image Palette', icon: '🖌️', cat: 'camera', desc: 'Pick a photo and pull out its six dominant colours as HEX codes using median cut with k-means refinement, then copy any colour or the whole palette.', keys: ['color palette', 'dominant colours', 'extract colours', 'swatches', 'hex', 'design', 'eyedropper'], needs: [], render(el) {
  let img = null, pal = [];
  el.innerHTML = `<div class="card" style="display:flex;flex-direction:column;gap:12px"><button class="btn" id="pk" style="min-height:52px">Choose a photo</button><label class="f">Number of colours: <b id="kv">6</b><input id="k" type="range" min="2" max="10" value="6" style="min-height:44px"></label></div>
    <div id="out"></div>`;
  function run() {
    if (!img) return;
    const sc = Math.min(1, 120 / Math.max(img.naturalWidth, img.naturalHeight)), w = Math.max(1, Math.round(img.naturalWidth * sc)), h = Math.max(1, Math.round(img.naturalHeight * sc));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d'); g.drawImage(img, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data, px = [];
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) px.push([d[i], d[i + 1], d[i + 2]]);
    pal = medianCut(px, +$('#k', el).value).map((c) => ({ hex: rgb2hex(c.rgb), share: c.share, rgb: c.rgb }));
    const prev = document.createElement('canvas'); prev.width = 480; prev.height = Math.round(480 * h / w);
    prev.getContext('2d').drawImage(img, 0, 0, prev.width, prev.height);
    $('#out', el).innerHTML = `<div class="card" style="padding:10px"><img alt="Chosen photo" src="${prev.toDataURL('image/jpeg', 0.8)}" style="width:100%;border-radius:10px;display:block"></div>
      <div style="display:flex;height:56px;border-radius:14px;overflow:hidden;margin:12px 0">${pal.map((c) => `<i style="flex:${c.share};background:${c.hex}"></i>`).join('')}</div>
      <div class="list">${pal.map((c) => `<button class="item" data-cp="${c.hex}" style="width:100%;text-align:left;color:var(--text);min-height:56px"><i style="width:40px;height:40px;border-radius:10px;background:${c.hex};border:1px solid var(--line);flex:0 0 40px"></i><span class="grow"><b style="font-family:monospace">${c.hex}</b><div class="muted" style="font-size:12px">RGB ${c.rgb.join(', ')}</div></span><span class="muted">${Math.round(c.share * 100)}%</span></button>`).join('')}</div>
      <div class="row" style="margin-top:12px"><button class="btn" id="ca" style="min-height:48px">Copy all HEX</button><button class="btn alt" id="cs" style="min-height:48px">Copy as CSS</button></div>`;
    $$('[data-cp]', el).forEach((b) => { b.onclick = () => copyText(b.dataset.cp); });
    $('#ca', el).onclick = () => copyText(pal.map((c) => c.hex).join(', '));
    $('#cs', el).onclick = () => copyText(':root {\n' + pal.map((c, i) => '  --color-' + (i + 1) + ': ' + c.hex + ';').join('\n') + '\n}');
  }
  $('#pk', el).onclick = () => pickImage((im) => { img = im; run(); });
  $('#k', el).oninput = (e) => { $('#kv', el).textContent = e.target.value; run(); };
  return () => { img = null; };
} });
})();
