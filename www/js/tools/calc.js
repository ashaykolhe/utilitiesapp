'use strict';
/* Calculators (category "calculate"). Everything is wrapped in one function so helper names do not leak into other tools.
   The block between PURE-START and PURE-END holds DOM-free maths; it is unit-tested in plain Node. */
(() => {
// ==PURE-START==
const L = {};
const p2 = (n) => String(n).padStart(2, '0');
L.gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a; };
L.lcm = (a, b) => (a && b ? Math.abs(a / L.gcd(a, b) * b) : 0);
L.fx = (n, d = 2) => {
  if (!Number.isFinite(n)) return '—';
  if (Object.is(n, -0) || Math.abs(n) < 0.5 * Math.pow(10, -d)) n = 0; // never show -0 or -0.00
  return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
};
// Display only (locale aware). Anything that must be parsed again uses L.num.
L.sig = (n, p = 10) => { if (!Number.isFinite(n)) return '—'; if (Object.is(n, -0)) n = 0; return n.toLocaleString(undefined, { maximumSignificantDigits: p, useGrouping: false }); };
L.num = (r) => String(+(+r).toPrecision(12)); // locale-proof text that L.calc can read back
L.r2 = (x) => Math.round((x + Math.sign(x) * 1e-9) * 100) / 100;
L.ok = (...a) => a.every(Number.isFinite);

/* ---- loans ---- */
L.emi = (P, rate, n) => {
  if (!(P > 0) || !(n > 0) || !(rate >= 0)) return NaN;
  const r = rate / 1200;
  return r === 0 ? P / n : P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
};
L.schedule = (P, rate, n, count) => {
  const e = L.emi(P, rate, n), r = rate / 1200, rows = [];
  let b = P;
  for (let m = 1; m <= Math.min(count, n); m++) {
    const i = b * r, pr = e - i;
    b = Math.max(0, b - pr);
    rows.push({ m, emi: e, interest: i, principal: pr, balance: b });
  }
  return rows;
};

/* ---- invoice ---- */
L.invoice = (items, taxPct, discType, discVal) => {
  const sub = L.r2(items.reduce((s, i) => s + L.r2((i.q || 0) * (i.p || 0)), 0));
  let disc = discType === 'pct' ? sub * (discVal || 0) / 100 : (discVal || 0);
  disc = L.r2(Math.min(Math.max(disc, 0), sub));
  const taxable = L.r2(sub - disc), tax = L.r2(taxable * (taxPct || 0) / 100);
  return { sub, disc, taxable, tax, total: L.r2(taxable + tax) };
};
L.invoiceText = (inv) => {
  const t = L.invoice(inv.items, inv.tax, inv.dt, inv.dv), c = inv.cur || '', m = (n) => c + L.fx(n);
  const out = ['INVOICE #' + inv.no];
  if (inv.biz) out.push(inv.biz);
  out.push('Date: ' + inv.date);
  if (inv.cust) out.push('Bill to: ' + inv.cust);
  out.push('------------------------');
  inv.items.forEach((i, k) => out.push((k + 1) + '. ' + (i.d || 'Item') + '  ' + L.sig(i.q || 0) + ' x ' + m(i.p || 0) + ' = ' + m(L.r2((i.q || 0) * (i.p || 0)))));
  out.push('------------------------', 'Subtotal: ' + m(t.sub));
  if (t.disc) out.push('Discount' + (inv.dt === 'pct' ? ' (' + L.sig(inv.dv) + '%)' : '') + ': -' + m(t.disc));
  if (inv.tax) out.push('Tax (' + L.sig(inv.tax) + '%): ' + m(t.tax));
  out.push('TOTAL: ' + m(t.total));
  return out.join('\n');
};

/* ---- export (CSV rows and a printable invoice page) ---- */
// A text cell that starts with = + - @ (or a tab / CR) would run as a formula in a spreadsheet, so it gets a leading quote.
L.csvText = (v) => { v = v == null ? '' : String(v); return /^[=+\-@\t\r]/.test(v) ? "'" + v : v; };
L.escHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
L.invoiceRows = (list) => {
  const rows = [['Invoice', 'Date', 'Business', 'Customer', 'Item', 'Quantity', 'Price', 'Line total', 'Subtotal', 'Discount', 'Tax', 'Total']];
  list.forEach((inv) => {
    const t = L.invoice(inv.items, inv.tax, inv.dt, inv.dv);
    const items = inv.items.length ? inv.items : [{ d: '', q: 0, p: 0 }];
    items.forEach((i, k) => rows.push([inv.no, inv.date, L.csvText(inv.biz), L.csvText(inv.cust), L.csvText(i.d), i.q || 0, i.p || 0, L.r2((i.q || 0) * (i.p || 0))].concat(k ? ['', '', '', ''] : [t.sub, t.disc, t.tax, t.total])));
  });
  return rows;
};
L.invoiceHtml = (inv) => {
  const t = L.invoice(inv.items, inv.tax, inv.dt, inv.dv), c = inv.cur || '', m = (n) => L.escHtml(c + L.fx(n)), e = L.escHtml;
  const lines = inv.items.map((i, k) => '<tr><td>' + (k + 1) + '</td><td>' + e(i.d || 'Item') + '</td><td class="r">' + e(L.sig(i.q || 0)) + '</td><td class="r">' + m(i.p || 0) + '</td><td class="r">' + m(L.r2((i.q || 0) * (i.p || 0))) + '</td></tr>').join('');
  const sum = [['Subtotal', m(t.sub)]];
  if (t.disc) sum.push(['Discount' + (inv.dt === 'pct' ? ' (' + e(L.sig(inv.dv)) + '%)' : ''), '-' + m(t.disc)]);
  if (inv.tax) sum.push(['Tax (' + e(L.sig(inv.tax)) + '%)', m(t.tax)]);
  const css = 'body{font-family:Arial,Helvetica,sans-serif;color:#111;max-width:720px;margin:24px auto;padding:0 16px}h1{margin:0 0 4px;font-size:26px}.m{color:#555;margin:2px 0}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{padding:8px 6px;border-bottom:1px solid #ddd;text-align:left}th{background:#f3f3f3}.r{text-align:right}.s td{border:0;padding:4px 6px}.tot td{font-weight:bold;font-size:18px;border-top:2px solid #111}@media print{body{margin:0}}';
  return '<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invoice ' + e(inv.no) + '</title>\n<style>' + css + '</style></head><body>\n<h1>INVOICE #' + e(inv.no) + '</h1>' +
    (inv.biz ? '<p class="m"><b>' + e(inv.biz) + '</b></p>' : '') + '<p class="m">Date: ' + e(inv.date) + '</p>' + (inv.cust ? '<p class="m">Bill to: ' + e(inv.cust) + '</p>' : '') +
    '\n<table><tr><th>#</th><th>Item</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Amount</th></tr>' + lines + '</table>\n<table style="width:50%;margin-left:50%">' +
    sum.map((r) => '<tr class="s"><td>' + r[0] + '</td><td class="r">' + r[1] + '</td></tr>').join('') + '<tr class="tot"><td>Total</td><td class="r">' + m(t.total) + '</td></tr></table>\n</body></html>';
};
L.tallyRows = (list) => [['Counter', 'Value']].concat(list.map((x) => [L.csvText(x.n), x.v]));

/* ---- dates (day numbers = days since 1970-01-01, UTC, so DST never matters) ---- */
L.pd = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  return m && +m[1] >= 1000 ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5 : NaN;
};
L.ds = (n) => { const d = new Date(n * 864e5); return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate()); };
L.today = () => { const d = new Date(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5; };
L.dow = (n) => new Date(n * 864e5).getUTCDay();
L.DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const addM = (A, k, roll) => {
  const mo = A.m + k, ty = A.y + Math.floor(mo / 12), tm = ((mo % 12) + 12) % 12;
  const dim = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  if (roll && A.d > dim) return Date.UTC(ty, tm + 1, 1) / 864e5; // 29 Feb counts as 1 March in non-leap years
  return Date.UTC(ty, tm, Math.min(A.d, dim)) / 864e5;
};
L.ymd = (a, b, roll) => { // a <= b, both day numbers
  const A = new Date(a * 864e5), B = new Date(b * 864e5);
  const S = { y: A.getUTCFullYear(), m: A.getUTCMonth(), d: A.getUTCDate() };
  let tm = (B.getUTCFullYear() - S.y) * 12 + (B.getUTCMonth() - S.m);
  roll = !!roll && S.m === 1 && S.d === 29;
  if (addM(S, tm, roll) > b) tm--;
  return { y: Math.floor(tm / 12), m: tm % 12, d: b - addM(S, tm, roll) };
};
L.age = (dob, asof) => {
  const D = new Date(dob * 864e5), A = new Date(asof * 864e5);
  let next = Date.UTC(A.getUTCFullYear(), D.getUTCMonth(), D.getUTCDate()) / 864e5;
  if (next < asof) next = Date.UTC(A.getUTCFullYear() + 1, D.getUTCMonth(), D.getUTCDate()) / 864e5;
  return Object.assign(L.ymd(dob, asof, true), { days: asof - dob, next, nextIn: next - asof, turning: new Date(next * 864e5).getUTCFullYear() - D.getUTCFullYear() });
};
L.isWork = (n, wk) => !wk.includes(L.dow(n));
L.addWork = (n, k, wk) => { // move k working days (k may be negative)
  const step = k < 0 ? -1 : 1;
  for (let left = Math.abs(k); left > 0;) { n += step; if (L.isWork(n, wk)) left--; }
  return n;
};
L.countWork = (a, b, wk) => { let c = 0; for (let n = a; n <= b; n++) if (L.isWork(n, wk)) c++; return c; };

/* ---- percentages and money ---- */
L.pctChange = (a, b) => (b - a) / Math.abs(a) * 100;
L.gst = (price, disc, tax, inclusive) => {
  const d = price * (1 - disc / 100), saving = price - d;
  if (inclusive) { const base = d / (1 + tax / 100); return { after: d, base, tax: d - base, final: d, saving }; }
  const t = d * tax / 100;
  return { after: d, base: d, tax: t, final: d + t, saving };
};
L.tip = (bill, pct, people, roundUp) => {
  const tip = bill * pct / 100;
  let per = (bill + tip) / people;
  if (roundUp) per = Math.ceil(per - 1e-9);
  const total = per * people;
  return { tip: total - bill, total, per, billPer: bill / people };
};
L.compound = (P, rate, years, n) => P * Math.pow(1 + rate / 100 / n, n * years);
L.sip = (m, rate, months) => {
  const i = rate / 1200;
  return i === 0 ? m * months : m * ((Math.pow(1 + i, months) - 1) / i) * (1 + i);
};
L.cagr = (a, b, years) => (Math.pow(b / a, 1 / years) - 1) * 100;
L.rd = (R, rate, months) => { // quarterly compounding, deposit at start of each month (common bank method)
  let v = 0;
  for (let k = 1; k <= months; k++) v += R * Math.pow(1 + rate / 400, (months - k + 1) / 3);
  return v;
};
L.margin = (cost, price) => ({ profit: price - cost, margin: (price - cost) / price * 100, markup: (price - cost) / cost * 100 });
L.breakeven = (fixed, price, vc, target) => {
  const cm = price - vc;
  if (!(cm > 0)) return null;
  return { cm, cmPct: cm / price * 100, units: Math.ceil(fixed / cm - 1e-9), unitsT: Math.ceil((fixed + (target || 0)) / cm - 1e-9) };
};
L.pay = (amount, per, hpw, wpy, dpw) => {
  const annual = { hour: amount * hpw * wpy, day: amount * dpw * wpy, week: amount * wpy, month: amount * 12, year: amount }[per];
  return { hour: annual / (hpw * wpy), day: annual / (dpw * wpy), week: annual / wpy, biweek: annual / wpy * 2, month: annual / 12, year: annual };
};
L.sumLines = (text) => { // the amount is the number at the END of each line; lines without one are counted in bad
  let sum = 0, bad = 0;
  String(text).split('\n').forEach((line) => {
    line = line.replace(/,/g, '').replace(/[−–]/g, '-').trim();
    if (!line) return;
    const m = /(?<![\w.])-?\d+(?:\.\d+)?[eE][-+]?\d+$/.exec(line) || /(?<![\d.])-?\d+(?:\.\d+)?$/.exec(line);
    if (m && Number.isFinite(parseFloat(m[0]))) sum += parseFloat(m[0]); else bad++;
  });
  return { sum, bad };
};
L.sumAmounts = (text) => L.sumLines(text).sum;

/* ---- fuel ---- */
L.kmPerL = (x, unit) => (unit === 'l100' ? 100 / x : unit === 'mpg' ? x * 1.609344 / 3.785411784 : x);

/* ---- marks / GPA ---- */
L.marks = (text, defMax) => {
  let got = 0, max = 0, bad = 0;
  String(text).split('\n').forEach((line) => {
    if (!line.trim()) return;
    const m = /^\s*(\d*\.?\d+)\s*(?:\/\s*(\d*\.?\d+))?\s*$/.exec(line.replace(/,/g, '.'));
    if (m) { got += parseFloat(m[1]); max += m[2] ? parseFloat(m[2]) : defMax; } else bad++;
  });
  return { got, max, bad, pct: max ? got / max * 100 : NaN };
};
L.GRADE = { 'A+': 4, A: 4, 'A-': 3.7, 'B+': 3.3, B: 3, 'B-': 2.7, 'C+': 2.3, C: 2, 'C-': 1.7, 'D+': 1.3, D: 1, 'D-': 0.7, E: 0, FX: 0, F: 0 };
L.gpa = (text) => {
  let pts = 0, cr = 0, bad = 0;
  String(text).split('\n').forEach((line) => {
    if (!line.trim()) return;
    const m = /^\s*([A-Za-z]{1,2}[+-]?|\d*\.?\d+)\s+(\d*\.?\d+)\s*$/.exec(line);
    const g = m ? (/\d/.test(m[1]) ? parseFloat(m[1]) : L.GRADE[m[1].toUpperCase()]) : undefined;
    if (g === undefined) { bad++; return; }
    pts += g * parseFloat(m[2]); cr += parseFloat(m[2]);
  });
  return { pts, cr, bad, gpa: cr ? pts / cr : NaN };
};

/* ---- time ---- */
L.parseDur = (s) => { // seconds, or NaN. "1:30", "1:30:15", "2h 15m", "90m", "45s", "1.5h", plain number = minutes
  s = s.trim().toLowerCase();
  if (!s) return NaN;
  let m = /^(\d+):(\d{1,2})(?::(\d{1,2}))?$/.exec(s);
  if (m) return +m[1] * 3600 + +m[2] * 60 + (+m[3] || 0);
  m = /^(\d*\.?\d+)\s*h(?:(?:ou)?rs?)?\s*(\d+)$/.exec(s); // 1h30 = 1 hour 30 minutes
  if (m) return +m[1] * 3600 + +m[2] * 60;
  m = /^(?:(\d*\.?\d+)\s*d(?:ays?)?)?\s*(?:(\d*\.?\d+)\s*h(?:(?:ou)?rs?)?)?\s*(?:(\d*\.?\d+)\s*m(?:in(?:ute)?s?)?)?\s*(?:(\d*\.?\d+)\s*s(?:ec(?:ond)?s?)?)?$/.exec(s);
  if (m && (m[1] || m[2] || m[3] || m[4])) return (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0);
  if (/^\d*\.?\d+$/.test(s)) return parseFloat(s) * 60;
  return NaN;
};
L.sumDurs = (text) => {
  let total = 0, bad = 0;
  String(text).split('\n').forEach((line) => {
    line = line.trim();
    if (!line) return;
    let sign = 1;
    if (line[0] === '-' || line[0] === '−') { sign = -1; line = line.slice(1); } else if (line[0] === '+') line = line.slice(1);
    const v = L.parseDur(line);
    if (Number.isNaN(v)) bad++; else total += sign * v;
  });
  return { total, bad };
};
L.fmtDur = (sec) => {
  const neg = sec < 0 ? '-' : '', a = Math.round(Math.abs(sec)), h = Math.floor(a / 3600), m = Math.floor(a % 3600 / 60), s = a % 60;
  return neg + h + ':' + p2(m) + (s ? ':' + p2(s) : '');
};
L.tdiff = (a, b, brk) => { // "HH:MM" strings -> minutes, overnight aware
  const pm = (t) => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : NaN; };
  let d = pm(b) - pm(a);
  if (d <= 0) d += 1440;
  return d - (brk || 0);
};

/* ---- number theory, fractions, stats ---- */
L.isPrime = (n) => {
  if (n < 2) return false;
  if (n < 4) return true;
  if (n % 2 === 0 || n % 3 === 0) return false;
  for (let i = 5; i * i <= n; i += 6) if (n % i === 0 || n % (i + 2) === 0) return false;
  return true;
};
L.factor = (n) => {
  const f = [];
  const take = (p) => { let e = 0; while (n % p === 0) { n /= p; e++; } if (e) f.push([p, e]); };
  take(2); take(3);
  for (let i = 5; i * i <= n; i += 6) { take(i); take(i + 2); }
  if (n > 1) f.push([n, 1]);
  return f;
};
L.divisors = (n) => {
  const d = [];
  for (let i = 1; i * i <= n; i++) if (n % i === 0) { d.push(i); if (i !== n / i) d.push(n / i); }
  return d.sort((a, b) => a - b);
};
L.nextPrime = (n) => { do n++; while (!L.isPrime(n)); return n; };
L.prevPrime = (n) => { if (n <= 2) return null; do n--; while (!L.isPrime(n)); return n; };
// Prime check is heavy for big numbers, so the UI only runs it when Analyse is tapped.
L.NEIGHBOUR_MAX = 1e12; // next/previous prime are only searched up to this size
L.analyse = (n) => {
  if (!Number.isInteger(n) || n < 2 || n > 9e15) return null;
  const f = L.factor(n), pr = f.length === 1 && f[0][1] === 1, out = { n, prime: pr, factors: f };
  if (n <= 1e9) out.divisors = L.divisors(n);
  if (n <= L.NEIGHBOUR_MAX) { out.next = L.nextPrime(n); out.prev = L.prevPrime(n); }
  return out;
};
L.parseNums = (text) => { // strict: { nums, bad } where bad is the first token that is not a number (or null)
  const nums = []; let bad = null;
  const NUM = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i;
  String(text).split(/[\s;]+|,(?=\s|$)/).forEach((tok) => {
    if (!tok || bad !== null) return;
    if (NUM.test(tok)) { nums.push(parseFloat(tok)); return; }
    if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(tok)) { nums.push(parseFloat(tok.replace(/,/g, ''))); return; }
    const parts = tok.split(',');
    if (parts.length > 1 && parts.every((x) => NUM.test(x))) { parts.forEach((x) => nums.push(parseFloat(x))); return; }
    bad = tok;
  });
  return { nums, bad };
};
L.nums = (text) => L.parseNums(text).nums;
L.stats = (a) => {
  const n = a.length, s = a.reduce((x, y) => x + y, 0), mean = s / n, so = a.slice().sort((x, y) => x - y);
  const median = n % 2 ? so[(n - 1) / 2] : (so[n / 2 - 1] + so[n / 2]) / 2;
  const cnt = new Map();
  a.forEach((v) => cnt.set(v, (cnt.get(v) || 0) + 1));
  const top = [...cnt.values()].reduce((x, y) => (y > x ? y : x), 0);
  const mode = top > 1 ? [...cnt].filter((e) => e[1] === top).map((e) => e[0]).sort((x, y) => x - y) : [];
  const ss = a.reduce((x, y) => x + (y - mean) * (y - mean), 0);
  return { n, sum: s, mean, median, mode, min: so[0], max: so[n - 1], range: so[n - 1] - so[0], varP: ss / n, sdP: Math.sqrt(ss / n), varS: n > 1 ? ss / (n - 1) : NaN, sdS: n > 1 ? Math.sqrt(ss / (n - 1)) : NaN };
};
L.fr = (n, d) => { if (d < 0) { n = -n; d = -d; } const g = L.gcd(n, d) || 1; return { n: n / g, d: d / g }; };
const safe = (...x) => x.every(Number.isSafeInteger);
const frSafe = (n, d) => (safe(n, d) ? L.fr(n, d) : null);
L.pfrac = (s) => {
  s = String(s).trim().replace('−', '-').replace(/^(-?\d*),(\d+)$/, '$1.$2'); // decimal comma: 0,25 = 0.25
  let m = /^(-?)(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(s);
  if (m) return +m[4] ? frSafe((m[1] ? -1 : 1) * (+m[2] * +m[4] + +m[3]), +m[4]) : null;
  m = /^(-?\d+)\s*\/\s*(-?\d+)$/.exec(s);
  if (m) return +m[2] ? frSafe(+m[1], +m[2]) : null;
  m = /^(-?)(\d*)\.?(\d*)$/.exec(s);
  if (m && (m[2] || m[3]) && m[3].length <= 9) { const k = Math.pow(10, m[3].length); return frSafe((m[1] ? -1 : 1) * Math.round(+(m[2] + m[3])), k); }
  return null;
};
// Returns a fraction, null for division by zero, or { over: true } when an intermediate product leaves the safe integer range.
L.fop = (a, b, op) => {
  const OVER = { over: true };
  let x, y, z, w;
  if (op === '+' || op === '-') { x = a.n * b.d; y = b.n * a.d; z = op === '+' ? x + y : x - y; w = a.d * b.d; if (!safe(x, y, z, w)) return OVER; return L.fr(z, w); }
  if (op === '*') { x = a.n * b.n; w = a.d * b.d; if (!safe(x, w)) return OVER; return L.fr(x, w); }
  if (b.n === 0) return null;
  x = a.n * b.d; w = a.d * b.n;
  return safe(x, w) ? L.fr(x, w) : OVER;
};
L.fstr = (f) => (f.d === 1 ? String(f.n) : f.n + '/' + f.d);
L.fmixed = (f) => {
  if (f.d === 1 || Math.abs(f.n) < f.d) return L.fstr(f);
  const w = Math.trunc(f.n / f.d), r = Math.abs(f.n) % f.d;
  return r ? w + ' ' + r + '/' + f.d : String(w);
};

/* ---- algebra and geometry ---- */
L.quad = (a, b, c) => {
  if (a === 0) return b === 0 ? { type: 'none' } : { type: 'linear', x: -c / b };
  const D = b * b - 4 * a * c, vx = -b / (2 * a), vy = c - b * b / (4 * a);
  if (D > 0) {
    const q = -(b + Math.sign(b || 1) * Math.sqrt(D)) / 2, x1 = q / a, x2 = c / q;
    return { type: 'two', D, x1: Math.min(x1, x2), x2: Math.max(x1, x2), vx, vy };
  }
  if (D === 0) return { type: 'one', D, x1: vx, vx, vy };
  return { type: 'complex', D, re: vx, im: Math.sqrt(-D) / (2 * Math.abs(a)), vx, vy };
};
const PI = Math.PI;
L.shapes = {
  Square: { d: ['Side'], f: (s) => [['Area', s * s], ['Perimeter', 4 * s], ['Diagonal', s * Math.SQRT2]] },
  Rectangle: { d: ['Length', 'Width'], f: (l, w) => [['Area', l * w], ['Perimeter', 2 * (l + w)], ['Diagonal', Math.hypot(l, w)]] },
  Triangle: { d: ['Base', 'Height'], f: (b, h) => [['Area', b * h / 2]] },
  Circle: { d: ['Radius'], f: (r) => [['Area', PI * r * r], ['Circumference', 2 * PI * r], ['Diameter', 2 * r]] },
  Trapezoid: { d: ['Side a', 'Side b', 'Height'], f: (a, b, h) => [['Area', (a + b) / 2 * h]] },
  Ellipse: { d: ['Semi-axis a', 'Semi-axis b'], f: (a, b) => [['Area', PI * a * b], ['Perimeter (approx)', PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)))]] },
  Cube: { d: ['Side'], f: (s) => [['Volume', s ** 3], ['Surface area', 6 * s * s], ['Space diagonal', s * Math.sqrt(3)]] },
  Cuboid: { d: ['Length', 'Width', 'Height'], f: (l, w, h) => [['Volume', l * w * h], ['Surface area', 2 * (l * w + w * h + l * h)], ['Space diagonal', Math.sqrt(l * l + w * w + h * h)]] },
  Cylinder: { d: ['Radius', 'Height'], f: (r, h) => [['Volume', PI * r * r * h], ['Curved area', 2 * PI * r * h], ['Total surface', 2 * PI * r * (r + h)]] },
  Sphere: { d: ['Radius'], f: (r) => [['Volume', 4 / 3 * PI * r ** 3], ['Surface area', 4 * PI * r * r]] },
  Cone: { d: ['Radius', 'Height'], f: (r, h) => { const s = Math.hypot(r, h); return [['Volume', PI * r * r * h / 3], ['Slant height', s], ['Total surface', PI * r * (r + s)]]; } },
  Pyramid: { d: ['Base side', 'Height'], f: (a, h) => [['Volume', a * a * h / 3], ['Slant height', Math.hypot(h, a / 2)], ['Total surface', a * a + 2 * a * Math.hypot(h, a / 2)]] }
};
const DEG = 180 / PI;
L.triSSS = (a, b, c) => {
  if (!(a > 0 && b > 0 && c > 0) || a + b <= c || a + c <= b || b + c <= a) return null;
  const cl = (x) => Math.max(-1, Math.min(1, x));
  const A = Math.acos(cl((b * b + c * c - a * a) / (2 * b * c))) * DEG, B = Math.acos(cl((a * a + c * c - b * b) / (2 * a * c))) * DEG, C = 180 - A - B;
  const s = (a + b + c) / 2, area = Math.sqrt(s * (s - a) * (s - b) * (s - c));
  const sq = [a * a, b * b, c * c].sort((x, y) => x - y), tol = 1e-9 * sq[2];
  const ang = Math.abs(sq[0] + sq[1] - sq[2]) <= tol ? 'right' : sq[0] + sq[1] > sq[2] ? 'acute' : 'obtuse';
  const eq = (x, y) => Math.abs(x - y) <= 1e-9 * Math.max(x, y);
  const side = eq(a, b) && eq(b, c) ? 'equilateral' : eq(a, b) || eq(b, c) || eq(a, c) ? 'isosceles' : 'scalene';
  return { A, B, C, area, perimeter: a + b + c, type: side + ', ' + ang, inradius: area / s, circumradius: a * b * c / (4 * area) };
};
L.triSAS = (a, b, Cdeg) => (Cdeg > 0 && Cdeg < 180 ? { c: Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(Cdeg / DEG)) } : null);

/* ---- cooking and sizes ---- */
L.ING = { 'Flour (plain)': 120, 'Sugar (white)': 200, 'Sugar (brown)': 213, 'Icing sugar': 120, 'Butter': 227, 'Rice (raw)': 185, 'Water / milk': 237, 'Honey': 340, 'Oil': 218, 'Salt (table)': 288, 'Cocoa powder': 85, 'Oats': 90 };
L.cook = (gPerCup, amt, unit) => {
  const g = { cup: gPerCup, tbsp: gPerCup / 16, tsp: gPerCup / 48, g: 1, kg: 1000, oz: 28.349523125, ml: gPerCup / 236.588 }[unit] * amt;
  return { g, oz: g / 28.349523125, cup: g / gPerCup, tbsp: g / gPerCup * 16, tsp: g / gPerCup * 48, ml: g / gPerCup * 236.588 };
};
const half = (x) => Math.round(x * 2) / 2;
/* Shoe sizes come from one lookup table (UK 1 to 16 in half sizes, approximate Brannock-style), so converting A to B and back to A always lands on the same row. */
L.SHOES = (() => {
  const t = [];
  for (let uk = 1; uk <= 16; uk += 0.5) {
    const usm = uk + 1, cm = (usm + 22) / 3 * 2.54;
    t.push({ uk, usm, usw: usm + 1.5, eu: half((cm + 1.5) * 1.5), cm: Math.round(cm * 10) / 10 });
  }
  return t;
})();
L.shoe = (sys, size) => {
  const tol = { uk: 0.5, usm: 0.5, usw: 0.5, eu: 1, cm: 0.5 }[sys];
  let best = null;
  L.SHOES.forEach((r) => { if (best === null || Math.abs(r[sys] - size) < Math.abs(best[sys] - size)) best = r; });
  return best && Math.abs(best[sys] - size) <= tol ? best : null;
};
L.dress = (sys, size) => { const uk = sys === 'uk' ? size : sys === 'us' ? size + 4 : size - 28; return { uk, us: uk - 4, eu: uk + 28 }; };
L.chest = (unit, v) => {
  const inch = unit === 'in' ? v : v / 2.54, cm = inch * 2.54;
  const letter = inch < 35 ? 'XS' : inch < 38 ? 'S' : inch < 41 ? 'M' : inch < 44 ? 'L' : inch < 47 ? 'XL' : 'XXL';
  return { inch, cm, eu: Math.round(cm / 2 / 2) * 2, letter };
};

/* ---- number words, bases, roman ---- */
const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const w999 = (n) => {
  const o = [];
  if (n >= 100) { o.push(ONES[Math.floor(n / 100)] + ' hundred'); n %= 100; }
  if (n >= 20) { o.push(TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '')); } else if (n) o.push(ONES[n]);
  return o.join(' ');
};
L.words = (n, indian) => { // integer 0 .. 999,999,999,999,999
  if (n === 0) return 'zero';
  const out = [];
  if (indian) {
    const crore = Math.floor(n / 1e7); n %= 1e7;
    if (crore) out.push(L.words(crore, true) + ' crore');
    const lakh = Math.floor(n / 1e5); n %= 1e5;
    if (lakh) out.push(w999(lakh) + ' lakh');
    const th = Math.floor(n / 1e3); n %= 1e3;
    if (th) out.push(w999(th) + ' thousand');
    if (n) out.push(w999(n));
    return out.join(' ');
  }
  const names = ['', ' thousand', ' million', ' billion', ' trillion'];
  for (let i = 4; i >= 0; i--) {
    const u = Math.pow(1000, i), g = Math.floor(n / u);
    n -= g * u;
    if (g) out.push(w999(g) + names[i]);
  }
  return out.join(' ');
};
L.splitAmount = (n) => { // whole part and hundredths of |n|, rounded as one number so 1.999 is "two", not "one and 100 hundredths"
  const a = Math.abs(n), big = a >= 9e13; // above this, hundredths no longer fit exactly in a double
  const cents = big ? Math.round(a) * 100 : Math.round(a * 100 + 1e-6);
  const whole = big ? Math.round(a) : Math.floor(cents / 100), frac = big ? 0 : cents % 100;
  return { whole, frac, neg: n < 0 && (whole > 0 || frac > 0) };
};
L.toBase = (str, from, to) => {
  str = String(str).trim().toLowerCase();
  let neg = false;
  if (str[0] === '-') { neg = true; str = str.slice(1); }
  if (!str) return null;
  let v = 0n;
  const B = BigInt(from);
  for (const c of str) {
    const d = parseInt(c, 36);
    if (Number.isNaN(d) || d >= from) return null;
    v = v * B + BigInt(d);
  }
  return (neg && v ? '-' : '') + v.toString(to).toUpperCase();
};
const RM = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
L.toRoman = (n) => { let s = ''; RM.forEach(([v, r]) => { while (n >= v) { s += r; n -= v; } }); return s; };
L.fromRoman = (s) => {
  s = s.toUpperCase().trim();
  const val = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let t = 0;
  for (let i = 0; i < s.length; i++) {
    const a = val[s[i]], b = val[s[i + 1]];
    if (!a) return NaN;
    t += b > a ? -a : a;
  }
  return t >= 1 && t <= 3999 && L.toRoman(t) === s ? t : NaN;
};

/* ---- random ---- */
L.rnd = (n) => { // uniform integer in [0, n)
  if (n <= 4294967296 && typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const lim = 4294967296 - (4294967296 % n), a = new Uint32Array(1);
    do crypto.getRandomValues(a); while (a[0] >= lim);
    return a[0] % n;
  }
  return Math.floor(Math.random() * n);
};
L.randInt = (min, max) => min + L.rnd(max - min + 1);
L.shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = L.rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/* ---- scientific expression parser (no eval) ---- */
L.calc = (src, deg, ans) => {
  if (src.length > 300) throw new Error('Too long');
  src = src.replace(/(\d),(?=\d)/g, '$1.'); // decimal comma: 0,5 means 0.5 (a comma has no other meaning here)
  const s = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-').replace(/π/g, 'pi').replace(/√/g, 'sqrt').toLowerCase();
  if (/\.\d*\./.test(s)) throw new Error('Bad number');
  const toks = [];
  for (let i = 0; i < s.length;) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    let m;
    if (/[0-9.]/.test(c)) {
      m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/.exec(s.slice(i));
      if (!m) throw new Error('Bad number');
      toks.push({ t: 'n', v: parseFloat(m[0]) }); i += m[0].length;
    } else if (/[a-z]/.test(c)) {
      m = /^[a-z]+/.exec(s.slice(i))[0];
      toks.push({ t: 'id', v: m }); i += m.length;
    } else if ('+-*/^()!%'.includes(c)) { toks.push({ t: c }); i++; } else throw new Error('Unexpected ' + c);
  }
  let p = 0;
  const peek = () => (p < toks.length ? toks[p].t : null);
  const FN = {
    sin: (x) => trig(Math.sin, x), cos: (x) => trig(Math.cos, x), tan: (x) => { if (deg && (x - 90) % 180 === 0) throw new Error('Undefined'); return trig(Math.tan, x); },
    asin: (x) => (deg ? Math.asin(x) * DEG : Math.asin(x)), acos: (x) => (deg ? Math.acos(x) * DEG : Math.acos(x)), atan: (x) => (deg ? Math.atan(x) * DEG : Math.atan(x)),
    log: Math.log10, ln: Math.log, sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, exp: Math.exp, floor: Math.floor, ceil: Math.ceil, round: Math.round
  };
  const trig = (f, x) => {
    if (deg) x = (x % 360) * PI / 180;
    const r = f(x);
    return Math.abs(r) < 1e-14 ? 0 : r;
  };
  const fact = (x) => {
    if (!Number.isInteger(x) || x < 0 || x > 170) throw new Error('Factorial needs 0 to 170');
    let r = 1; for (let i = 2; i <= x; i++) r *= i; return r;
  };
  function expr() {
    let v = term();
    while (peek() === '+' || peek() === '-') {
      const o = toks[p++].t, start = p;
      let r = term();
      // "50+10%" means 50 + 10% of 50 (a bare number followed by % after + or -)
      if (p - start === 2 && toks[start].t === 'n' && toks[start + 1].t === '%') r = v * r;
      v = o === '+' ? v + r : v - r;
    }
    return v;
  }
  function term() {
    let v = unary();
    for (;;) {
      const t = peek();
      if (t === '*' || t === '/') { p++; const r = unary(); v = t === '*' ? v * r : v / r; } else if (t === 'n' || t === 'id' || t === '(') v *= unary(); else return v;
    }
  }
  function unary() {
    if (peek() === '-') { p++; return -unary(); }
    if (peek() === '+') { p++; return unary(); }
    return power();
  }
  function power() {
    const b = postfix();
    if (peek() === '^') { p++; return Math.pow(b, unary()); }
    return b;
  }
  function postfix() {
    let v = primary();
    while (peek() === '!' || peek() === '%') v = toks[p++].t === '!' ? fact(v) : v / 100;
    return v;
  }
  function primary() {
    const t = toks[p++];
    if (!t) throw new Error('Incomplete');
    if (t.t === 'n') return t.v;
    if (t.t === '(') { const v = expr(); if (peek() === ')') p++; else if (p < toks.length) throw new Error('Missing )'); return v; }
    if (t.t === 'id') {
      if (t.v === 'pi') return PI;
      if (t.v === 'e') return Math.E;
      if (t.v === 'ans') return ans || 0;
      if (FN[t.v]) {
        if (peek() !== '(') throw new Error('Use ' + t.v + '( )');
        p++;
        const v = expr();
        if (peek() === ')') p++; else if (p < toks.length) throw new Error('Missing )');
        return FN[t.v](v);
      }
      throw new Error('Unknown ' + t.v);
    }
    throw new Error('Unexpected ' + t.t);
  }
  const r = expr();
  if (p < toks.length) throw new Error('Unexpected ' + (toks[p].t === 'n' ? toks[p].v : toks[p].t));
  if (!Number.isFinite(r)) throw new Error('Math error');
  return +r.toPrecision(12);
};
// ==PURE-END==

if (typeof Tools === 'undefined') { if (typeof module !== 'undefined') module.exports = L; return; }

/* ================= UI helpers ================= */
const fx = L.fx, sig = L.sig;
const reg = (o) => Tools.register(Object.assign({ cat: 'calculate', needs: [] }, o));
const rows = (list) => list.map((r) => `<div class="item"><span class="grow muted">${esc(r[0])}</span><b style="text-align:right;word-break:break-all">${esc(r[1])}</b></div>`).join('');
const big = (label, value) => `<div class="center muted">${esc(label)}</div><div class="mid" style="word-break:break-all">${esc(value)}</div>`;
const table = (head, body) => `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums"><tr>${head.map((x) => `<th style="text-align:right;padding:4px 6px;color:var(--muted);font-weight:600;border-bottom:1px solid var(--line)">${esc(x)}</th>`).join('')}</tr>${body.map((r) => `<tr>${r.map((x) => `<td style="text-align:right;padding:4px 6px;border-bottom:1px solid var(--line)">${esc(x)}</td>`).join('')}</tr>`).join('')}</table></div>`;
const copyText = async (t) => {
  try { await navigator.clipboard.writeText(t); toast('Copied'); return; } catch (e) { /* fall through */ }
  try { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove(); toast('Copied'); } catch (e) { toast('Could not copy'); }
};
const shareText = async (title, text) => {
  try {
    const C = window.Capacitor, sh = C && C.Plugins && C.Plugins.Share;
    if (sh) { await sh.share({ title, text }); return; }
    if (navigator.share) { await navigator.share({ title, text }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  copyText(text);
};
/* Result history. kit(id).add(label, value) stores a settled result (never throws, skips empty ones);
   kit(id).soon(key, fn) runs fn about 1.5 s after the last call with the same key, so only a result the user stopped on is kept. */
const kit = (id) => {
  const t = {};
  return {
    add(label, value) { try { if (typeof Hist !== 'undefined' && label && value) Hist.add(id, String(label), String(value)); } catch (e) { /* history is optional */ } },
    soon(key, fn) { clearTimeout(t[key]); t[key] = setTimeout(() => { try { fn(); } catch (e) { /* ignore */ } }, 1500); },
    stop() { Object.keys(t).forEach((k) => clearTimeout(t[k])); }
  };
};
/* Hands a text file to the share sheet (or downloads it in a browser). Returns true when it was sent; a toast says so. */
const sendFile = async (name, text, mime, what) => {
  if (text.length > 2e6) { toast('Too much data to export (over 2 MB)'); return false; }
  const done = await saveTextFile(name, text, mime);
  if (done) toast((what || 'Exported') + ': ' + name);
  return done;
};
const buzz = (ms = 12) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ } };
const todayStr = () => L.ds(L.today());

function fieldHtml(f, val) {
  const lab = esc(f.l);
  if (f.t === 'select') return `<label class="f">${lab}<select data-k="${f.k}">${f.o.map((o) => `<option value="${esc(o[0])}"${String(o[0]) === String(val) ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select></label>`;
  if (f.t === 'textarea') return `<label class="f">${lab}<textarea data-k="${f.k}" rows="${f.rows || 4}" maxlength="3000" placeholder="${esc(f.p || '')}">${esc(val)}</textarea></label>`;
  const t = f.t || 'number', lim = (x) => (typeof x === 'function' ? x() : x);
  let attr;
  if (t === 'number') {
    const by = f.by ? ` data-by="${f.by}"` : '';
    attr = `inputmode="${f.step === 1 ? 'numeric' : 'decimal'}" step="${f.step || 'any'}" min="${lim(f.min)}" max="${lim(f.max)}"${by}`;
  } else if (t === 'date') attr = `min="${lim(f.min) || '1900-01-01'}" max="${lim(f.max) || '2200-12-31'}"`;
  else if (t === 'time') attr = 'maxlength="5" min="00:00" max="23:59"';
  else attr = `maxlength="${f.len || 60}"`;
  return `<label class="f">${lab}<input data-k="${f.k}" type="${t}" ${attr} value="${esc(val)}" placeholder="${esc(f.p || '')}"></label>`;
}

/* Builds one card per section: fields -> live result. Returns a cleanup function. */
function multi(el, id, sections, name) {
  const hk = kit(id);
  const saved = Store.get('calc.' + id, {});
  const dflt = (f) => (typeof f.v === 'function' ? f.v() : f.v === undefined ? '' : f.v);
  // a saved value is reused only when it still fits the field's limits (older versions had none)
  const fits = (f, v) => { if ((f.t || 'number') !== 'number') return true; if (v === '') return true; const n = +v; return Number.isFinite(n) && n >= (typeof f.min === 'function' ? f.min() : f.min) && n <= (typeof f.max === 'function' ? f.max() : f.max); };
  const initial = (f, i) => (typeof saved[i + '.' + f.k] === 'string' && f.keep !== false && fits(f, saved[i + '.' + f.k]) ? saved[i + '.' + f.k] : dflt(f));
  el.innerHTML = sections.map((s, i) => `<div class="card list" data-s="${i}">${s.title ? `<b>${esc(s.title)}</b>` : ''}${s.note ? `<div class="muted" style="font-size:13px">${esc(s.note)}</div>` : ''}${s.fields.map((f) => (Array.isArray(f) ? `<div class="row">${f.map((g) => fieldHtml(g, initial(g, i))).join('')}</div>` : fieldHtml(f, initial(f, i)))).join('')}<div class="list" data-r></div></div>`).join('');
  // limits that depend on a unit selector (years / months / days ...): data-by names the selector, the table gives min and max per unit
  const byFields = sections.map((s) => s.fields.flat().filter((f) => f.by));
  const applyBy = (card) => byFields[+card.dataset.s].forEach((f) => {
    const sel = $('[data-k="' + f.by[0] + '"]', card), inp = $('[data-k="' + f.k + '"]', card), lim = f.by[1][sel.value] || f.by[1][Object.keys(f.by[1])[0]];
    inp.min = lim[0]; inp.max = lim[1];
  });
  // an empty, non-numeric or out-of-range number becomes NaN, so every calculator shows its "enter the values" note instead of a wild result; -0 becomes 0
  let outOfRange = null;
  const read = (card) => {
    const v = {}; outOfRange = null;
    $$('[data-k]', card).forEach((x) => {
      if (x.type !== 'number') { v[x.dataset.k] = x.value; return; }
      let n = Valid.num(x.value);
      if (n !== null && ((x.min !== '' && n < +x.min) || (x.max !== '' && n > +x.max))) { if (!outOfRange) outOfRange = { l: x.parentNode.firstChild.textContent, a: x.min, b: x.max }; n = null; }
      v[x.dataset.k] = n === null ? NaN : (n === 0 ? 0 : n);
    });
    return v;
  };
  const run = (i) => {
    const card = $$('.card', el)[i], out = $('[data-r]', card);
    applyBy(card);
    const v = read(card);
    let html = null;
    try { html = sections[i].calc(v); } catch (e) { html = null; }
    if (outOfRange) html = '<div class="status">' + esc(outOfRange.l) + ': enter a value from ' + esc(outOfRange.a) + ' up to ' + esc(outOfRange.b) + '.</div>';
    if (html && /(NaN|Infinity|undefined)/.test(html.replace(/<[^>]*>/g, ' '))) html = BIG;
    out.innerHTML = html || '<div class="muted center" style="font-size:13px">Enter the values above.</div>';
    card._ok = !!html && !outOfRange && !out.querySelector('.status') && html !== BIG;
    return v;
  };
  /* Headline of a result: the big number (with its caption), or the first rows, or the text card. */
  const headline = (out) => {
    const tx = (n) => (n ? n.textContent.replace(/\s+/g, ' ').trim() : '');
    const mid = out.querySelector('.mid');
    if (mid) { const cap = tx(mid.previousElementSibling && mid.previousElementSibling.classList.contains('muted') ? mid.previousElementSibling : null); return (cap ? cap + ': ' : '') + tx(mid); }
    const items = $$('.item', out).slice(0, 3).map((r) => tx(r.firstElementChild) + ': ' + tx(r.lastElementChild));
    return items.length ? items.join('; ') : tx(out.querySelector('.card'));
  };
  /* What was calculated: the tool, the section and every input the person typed (long text is cut short). */
  const labelOf = (i, card) => {
    const s = sections[i], parts = $$('[data-k]', card).map((x) => {
      const lab = x.parentNode && x.parentNode.firstChild ? x.parentNode.firstChild.textContent.trim() : x.dataset.k;
      const val = x.tagName === 'SELECT' ? x.options[x.selectedIndex].textContent : x.value.replace(/\s*\n\s*/g, ' / ').trim();
      return (lab.length > 28 ? lab.slice(0, 26) + '..' : lab) + ' ' + (val.length > 40 ? val.slice(0, 38) + '..' : val);
    });
    return (name || id) + (s.title ? ' · ' + s.title : '') + ': ' + parts.join(', ');
  };
  const settle = (i) => {
    const card = $$('.card', el)[i];
    if (!card || !card._ok) return;
    const v = headline($('[data-r]', card)); if (!v) return;
    const s = sections[i], custom = typeof s.lab === 'function' ? s.lab(read(card)) : '';
    hk.add(custom || labelOf(i, card), v);
  };
  const all = () => sections.forEach((s, i) => run(i));
  el.addEventListener('input', (e) => {
    const card = e.target.closest && e.target.closest('.card');
    if (!card) return;
    run(+card.dataset.s);
    const si = +card.dataset.s; hk.soon('s' + si, () => settle(si));
    const s = Store.get('calc.' + id, {}), keep = sections[+card.dataset.s].fields.flat().filter((f) => f.keep !== false).map((f) => f.k);
    $$('[data-k]', card).forEach((x) => { if (keep.includes(x.dataset.k)) s[card.dataset.s + '.' + x.dataset.k] = x.value; });
    Store.set('calc.' + id, s);
  });
  all();
  return hk.stop;
}
const simple = (def) => reg({ id: def.id, name: def.name, icon: def.icon, desc: def.desc, keys: def.keys, needs: def.needs || [], render(el) { return multi(el, def.id, def.sections, def.name); } });
const sec = (title, fields, calc, note, lab) => ({ title, fields, calc, note, lab });
/* N(key, label, default, min, max, step): every number field has real limits; step 1 means whole numbers only. by = [selector key, { unit: [min, max] }] */
const N = (k, l, v, min = 0, max = 1e12, step, by) => ({ k, l, v, min, max, step, by });
const BIG = '<div class="status">That value gives a result that is too large to show.</div>';
const S = (k, l, o, v) => ({ k, l, t: 'select', o, v });
const ok = L.ok;
const CAPMSG = '<div class="status">Rate up to 200% a year, and a result below 1,000,000,000,000,000.</div>';

/* ================= 1. EMI ================= */
simple({ id: 'emi', name: 'EMI Calculator', icon: '🏦', desc: 'Monthly loan instalment, total interest and the first 12 months of the repayment schedule.', keys: ['loan', 'mortgage', 'interest', 'instalment', 'amortisation'], sections: [sec('', [
  N('p', 'Loan amount', 500000, 0, 1e12), [N('r', 'Interest % per year', 8.5, 0, 200), N('t', 'Tenure', 5, 0, 100, undefined, ['u', { y: [0, 100], m: [0, 1200] }])], S('u', 'Tenure in', [['y', 'Years'], ['m', 'Months']], 'y')
], (v) => {
  const n = Math.round(v.u === 'y' ? v.t * 12 : v.t);
  if (!ok(v.p, v.r, n) || v.p <= 0 || v.r < 0) return null;
  if (n < 1 || n > 1200) return '<div class="status">Tenure must be between 1 month and 100 years.</div>';
  const e = L.emi(v.p, v.r, n), total = e * n;
  const sch = L.schedule(v.p, v.r, n, 12);
  return big('Monthly EMI', fx(e)) + rows([['Total interest', fx(total - v.p)], ['Total payment', fx(total)], ['Months', String(n)]]) +
    '<b style="margin-top:6px">First 12 months</b>' + table(['Mo', 'Principal', 'Interest', 'Balance'], sch.map((r) => [r.m, fx(r.principal), fx(r.interest), fx(r.balance)]));
}, undefined, (v) => 'EMI ' + sig(v.p) + ' @ ' + sig(v.r) + '% x ' + sig(v.t) + (v.u === 'y' ? ' years' : ' months'))] });

/* ================= 2. Billing ================= */
reg({ id: 'billing', pro: true, proKey: 'trackers', name: 'Billing', icon: '📃', desc: 'Make an invoice with line items, tax and discount, save the last 20 and share or copy it as text.', keys: ['invoice', 'bill', 'receipt', 'gst', 'quotation'], needs: ['storage'], render(el) {
  let items = [{ d: '', q: 1, p: 0 }], editing = null;
  const meta = Object.assign({ biz: '', cur: '', tax: 0, dt: 'pct', dv: 0 }, Store.get('billing.meta', {}));
  let cust = '';
  el.innerHTML = `<div class="card list">
    <label class="f">Your business name<input id="biz" type="text" maxlength="60" value="${esc(meta.biz)}"></label>
    <div class="row"><label class="f">Customer<input id="cust" type="text" maxlength="60"></label><label class="f">Currency symbol<input id="cur" type="text" maxlength="4" value="${esc(meta.cur)}" placeholder="optional"></label></div>
    <b>Items</b><div class="list" id="items"></div>
    <button class="btn alt" id="add">+ Add item</button>
    <div class="row"><label class="f">Tax %<input id="tax" type="number" inputmode="decimal" step="any" min="0" max="100" value="${esc(meta.tax)}"></label>
    <label class="f">Discount<input id="dv" type="number" inputmode="decimal" step="any" min="0" max="1000000000000" value="${esc(meta.dv)}"></label>
    <label class="f">Type<select id="dt"><option value="pct">%</option><option value="amt">Amount</option></select></label></div>
    <div class="list" id="tot"></div>
    <div class="row"><button class="btn" id="save">Save</button><button class="btn alt" id="copy">Copy</button><button class="btn alt" id="share">Share</button></div>
    <div class="row"><button class="btn alt" id="exh">Export page (HTML)</button><button class="btn alt" id="new">New invoice</button></div></div>
    <div class="row" style="align-items:center"><b class="grow">Saved invoices (last 20)</b><button class="btn alt" id="exc">Export all (CSV)</button></div><div class="list" id="saved"></div>`;
  $('#dt', el).value = meta.dt;
  const num = (id, max) => Math.min(max, Math.max(0, Valid.num($('#' + id, el).value) || 0));
  const cur = () => ({ biz: $('#biz', el).value.trim(), cur: $('#cur', el).value.trim(), tax: num('tax', 100), dt: $('#dt', el).value, dv: num('dv', 1e12) });
  const clean = () => items.filter((i) => i.d.trim() || i.p * i.q);
  const totals = () => L.invoice(items, cur().tax, cur().dt, cur().dv);
  const drawItems = () => {
    $('#items', el).innerHTML = items.map((it, i) => `<div class="item" style="flex-wrap:wrap"><input data-i="${i}" data-f="d" type="text" maxlength="60" placeholder="Item" aria-label="Item name" value="${esc(it.d)}" style="flex:1 1 100%">
      <input data-i="${i}" data-f="q" type="number" inputmode="decimal" step="any" min="0" max="1000000000" aria-label="Quantity" placeholder="Qty" value="${esc(it.q)}" style="flex:1 1 70px">
      <input data-i="${i}" data-f="p" type="number" inputmode="decimal" step="any" min="0" max="1000000000000" aria-label="Price" placeholder="Price" value="${esc(it.p)}" style="flex:2 1 100px">
      <button class="btn alt" data-rm="${i}" aria-label="Remove item" style="flex:0 0 44px;padding:12px 0">✕</button></div>`).join('');
  };
  const drawTot = () => {
    const t = totals(), c = cur().cur;
    $('#tot', el).innerHTML = rows([['Subtotal', c + fx(t.sub)], ['Discount', '-' + c + fx(t.disc)], ['Tax', c + fx(t.tax)]]) + `<div class="center muted">Total</div><div class="mid">${esc(c + fx(t.total))}</div>`;
  };
  const record = () => {
    const c = cur(), list = Store.get('billing.list', []);
    const prev = editing ? list.find((x) => x.id === editing) : null;
    let no = prev ? prev.no : null;
    if (!no) { no = Store.get('billing.next', 1); }
    return { id: editing || Date.now(), no, date: prev && prev.date ? prev.date : todayStr(), biz: c.biz, cust: $('#cust', el).value.trim(), cur: c.cur, items: clean().map((i) => ({ d: i.d.trim(), q: i.q, p: i.p })), tax: c.tax, dt: c.dt, dv: c.dv };
  };
  const text = () => L.invoiceText(record());
  const drawSaved = () => {
    const list = Store.get('billing.list', []);
    $('#saved', el).innerHTML = list.length ? list.map((x) => `<div class="item"><div class="grow"><b>#${esc(x.no)} ${esc(x.cust || 'No name')}</b><div class="muted" style="font-size:13px">${esc(x.date)} · ${esc(x.cur + fx(L.invoice(x.items, x.tax, x.dt, x.dv).total))}</div></div>
      <button class="btn alt" data-view="${x.id}" aria-label="View invoice">View</button><button class="btn alt" data-sh="${x.id}" aria-label="Share invoice">📤</button><button class="btn alt" data-exh="${x.id}" aria-label="Export invoice as a printable page">🖨️</button><button class="btn danger" data-del="${x.id}" aria-label="Delete invoice">✕</button></div>`).join('') : '<div class="muted center">Nothing saved yet.</div>';
  };
  const persistMeta = () => { const c = cur(); Store.set('billing.meta', { biz: c.biz, cur: c.cur, tax: c.tax, dt: c.dt, dv: c.dv }); };
  el.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.i !== undefined) { const it = items[+t.dataset.i]; it[t.dataset.f] = t.dataset.f === 'd' ? t.value : Math.min(t.dataset.f === 'q' ? 1e9 : 1e12, Math.max(0, Valid.num(t.value) || 0)); }
    drawTot(); persistMeta();
  });
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'add') { if (items.length >= 50) { toast('Max 50 items'); return; } items.push({ d: '', q: 1, p: 0 }); drawItems(); drawTot(); return; }
    if (b.dataset.rm !== undefined) { items.splice(+b.dataset.rm, 1); if (!items.length) items.push({ d: '', q: 1, p: 0 }); drawItems(); drawTot(); return; }
    if (b.id === 'copy') { copyText(text()); return; }
    if (b.id === 'share') { shareText('Invoice', text()); return; }
    if (b.id === 'exh') {
      if (!clean().length) { toast('Add at least one item to export'); return; }
      const r = record(); sendFile('invoice-' + r.no + '-' + todayStr() + '.html', L.invoiceHtml(r), 'text/html', 'Invoice exported'); return;
    }
    if (b.id === 'exc') {
      const all = Store.get('billing.list', []);
      if (!all.length) { toast('No saved invoices to export yet'); return; }
      sendFile('invoices-' + todayStr() + '.csv', '\uFEFF' + toCSV(L.invoiceRows(all)), 'text/csv', 'Exported ' + all.length + ' invoice' + (all.length === 1 ? '' : 's')); return;
    }
    if (b.id === 'new') { items = [{ d: '', q: 1, p: 0 }]; editing = null; $('#cust', el).value = ''; drawItems(); drawTot(); return; }
    if (b.id === 'save') {
      if (!clean().length) { toast('Add at least one item'); return; }
      const r = record(), list = Store.get('billing.list', []), at = list.findIndex((x) => x.id === r.id);
      if (at >= 0) list[at] = r; else { list.unshift(r); Store.set('billing.next', r.no + 1); }
      if (list.length > 20) { list.length = 20; toast('Saved (oldest invoice removed)'); } else toast('Invoice #' + r.no + ' saved');
      Store.set('billing.list', list); editing = r.id; drawSaved(); return;
    }
    const list = Store.get('billing.list', []);
    if (b.dataset.view) {
      const x = list.find((y) => String(y.id) === b.dataset.view);
      if (!x) return;
      items = x.items.map((i) => Object.assign({}, i)); editing = x.id;
      $('#biz', el).value = x.biz; $('#cust', el).value = x.cust; $('#cur', el).value = x.cur; $('#tax', el).value = x.tax; $('#dv', el).value = x.dv; $('#dt', el).value = x.dt;
      drawItems(); drawTot(); toast('Loaded invoice #' + x.no); window.scrollTo(0, 0);
    } else if (b.dataset.exh) {
      const x = list.find((y) => String(y.id) === b.dataset.exh);
      if (x) sendFile('invoice-' + x.no + '-' + x.date + '.html', L.invoiceHtml(x), 'text/html', 'Invoice exported');
    } else if (b.dataset.sh) {
      const x = list.find((y) => String(y.id) === b.dataset.sh);
      if (x) shareText('Invoice #' + x.no, L.invoiceText(x));
    } else if (b.dataset.del) {
      Store.set('billing.list', list.filter((y) => String(y.id) !== b.dataset.del));
      if (String(editing) === b.dataset.del) editing = null;
      drawSaved(); toast('Deleted');
    }
  });
  drawItems(); drawTot(); drawSaved();
} });

/* ================= 3. Days counter ================= */
reg({ id: 'days', name: 'Days Counter', icon: '📆', desc: 'Days between two dates, add or subtract days, and countdowns to your saved events.', keys: ['date', 'difference', 'countdown', 'weeks', 'event'], needs: ['storage'], render(el) {
  const t = L.today();
  el.innerHTML = `<div class="card list"><b>Between two dates</b>
    <div class="row"><label class="f">From<input id="a" type="date" min="1900-01-01" max="2200-12-31" value="${L.ds(t)}"></label><label class="f">To<input id="b" type="date" min="1900-01-01" max="2200-12-31" value="${L.ds(t + 30)}"></label></div><div class="list" id="r1"></div></div>
    <div class="card list"><b>Add or subtract days</b>
    <div class="row"><label class="f">Start<input id="s" type="date" min="1900-01-01" max="2200-12-31" value="${L.ds(t)}"></label><label class="f">Days<input id="n" type="number" inputmode="numeric" step="1" min="-2900000" max="2900000" value="30"></label></div>
    <div class="row"><button class="btn" id="plus">Add</button><button class="btn alt" id="minus">Subtract</button></div><div class="list" id="r2"></div></div>
    <div class="card list"><b>Countdown to events</b>
    <div class="row"><label class="f">Event name<input id="en" type="text" maxlength="40"></label><label class="f">Date<input id="ed" type="date" min="1900-01-01" max="2200-12-31" value="${L.ds(t + 7)}"></label></div>
    <button class="btn" id="ea">Save event</button><div class="list" id="ev"></div></div>`;
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  const hk = kit('days');
  const r1 = (quiet) => {
    const a = L.pd($('#a', el).value), b = L.pd($('#b', el).value);
    if (!ok(a, b)) { $('#r1', el).innerHTML = '<div class="muted center">Pick both dates.</div>'; return; }
    const lo = Math.min(a, b), hi = Math.max(a, b), d = hi - lo, y = L.ymd(lo, hi);
    if (!quiet) hk.soon('r1', () => hk.add('Days from ' + L.ds(a) + ' to ' + L.ds(b), plural(d, 'day') + ' (' + y.y + 'y ' + y.m + 'm ' + y.d + 'd)'));
    $('#r1', el).innerHTML = big(b < a ? 'Days (To is earlier)' : 'Days', String(d)) + rows([['Weeks', Math.floor(d / 7) + ' w ' + (d % 7) + ' d'], ['Years, months, days', y.y + 'y ' + y.m + 'm ' + y.d + 'd'], ['Total weeks', sig(d / 7, 5)], ['Total hours', fx(d * 24, 0)]]);
  };
  const r2 = (sign, quiet) => {
    const s = L.pd($('#s', el).value), n = Math.round(Valid.num($('#n', el).value));
    if (!ok(s, n)) { $('#r2', el).innerHTML = '<div class="muted center">Enter a date and number of days.</div>'; return; }
    const r = s + sign * n;
    if (Math.abs(n) > 2.9e6 || !(r >= L.pd('1000-01-01') && r <= L.pd('9999-12-31'))) { $('#r2', el).innerHTML = '<div class="status">That date is out of range (years 1000 to 9999).</div>'; return; }
    $('#r2', el).innerHTML = big(sign > 0 ? 'Date after' : 'Date before', L.ds(r)) + `<div class="center muted">${L.DAYS[L.dow(r)]}</div>`;
    if (!quiet) hk.add(L.ds(s) + (sign > 0 ? ' + ' : ' − ') + plural(Math.abs(n), 'day'), L.ds(r) + ' (' + L.DAYS[L.dow(r)] + ')');
  };
  const events = () => Store.get('days.events', []);
  const drawEv = () => {
    const list = events().filter((x) => ok(L.pd(x.d))).sort((x, y) => L.pd(x.d) - L.pd(y.d)), now = L.today();
    $('#ev', el).innerHTML = list.length ? list.map((x) => {
      const k = L.pd(x.d) - now;
      const lab = k === 0 ? 'Today' : k > 0 ? 'in ' + plural(k, 'day') : plural(-k, 'day') + ' ago';
      return `<div class="item"><div class="grow"><b>${esc(x.n)}</b><div class="muted" style="font-size:13px">${esc(x.d)}</div></div><b>${esc(lab)}</b><button class="btn danger" data-del="${esc(x.id)}" aria-label="Delete event">✕</button></div>`;
    }).join('') : '<div class="muted center">No events yet.</div>';
  };
  el.addEventListener('input', (e) => { if (e.target.id === 'a' || e.target.id === 'b') r1(); });
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'plus') r2(1); else if (b.id === 'minus') r2(-1);
    else if (b.id === 'ea') {
      const n = $('#en', el).value.trim() || 'Event', d = $('#ed', el).value, list = events();
      if (!ok(L.pd(d))) { toast('Pick a date'); return; }
      if (list.length >= 50) { toast('Max 50 events'); return; }
      list.push({ id: String(Date.now()), n, d }); Store.set('days.events', list); $('#en', el).value = ''; drawEv();
    } else if (b.dataset.del) { Store.set('days.events', events().filter((x) => x.id !== b.dataset.del)); drawEv(); }
  });
  r1(true); r2(1, true); drawEv();
  return hk.stop;
} });

/* ================= 4. Tally counter ================= */
reg({ id: 'tally', name: 'Tally Counter', icon: '🔘', desc: 'Big plus and minus buttons with a step size, and several named counters that are saved on the device.', keys: ['count', 'counter', 'clicker', 'tap', 'number counter'], needs: ['storage'], render(el) {
  const st = Object.assign({ list: [{ n: 'Counter 1', v: 0 }], sel: 0, step: 1 }, Store.get('tally.state', {}));
  if (!st.list.length) st.list = [{ n: 'Counter 1', v: 0 }];
  st.sel = Math.min(st.sel, st.list.length - 1);
  let armed = null, armT = null;
  el.innerHTML = `<div class="card"><div class="center muted" id="nm"></div><div class="big" id="v" style="font-size:clamp(28px,15vw,72px);word-break:break-all"></div>
    <div class="row"><button class="btn alt" id="minus" aria-label="Subtract" style="min-height:96px;font-size:44px">−</button><button class="btn" id="plus" aria-label="Add" style="min-height:96px;font-size:44px">+</button></div></div>
    <div class="row"><label class="f">Step<input id="step" type="number" inputmode="numeric" step="1" min="1" max="1000000" value="${esc(st.step)}"></label><button class="btn alt" id="reset" style="align-self:flex-end">Reset</button></div>
    <div class="card list"><b>Counters</b><div class="list" id="list"></div>
    <div class="row"><input id="newn" type="text" maxlength="30" placeholder="New counter name" aria-label="New counter name"><button class="btn" id="addc" style="flex:0 0 auto">Add</button></div>
    <button class="btn alt" id="exp">Export CSV</button></div>`;
  const save = () => Store.set('tally.state', st);
  const draw = () => {
    const c = st.list[st.sel];
    const vEl = $('#v', el), len = String(c.v).length;
    $('#nm', el).textContent = c.n; vEl.textContent = c.v;
    vEl.style.fontSize = 'clamp(20px,' + Math.min(15, 130 / len).toFixed(1) + 'vw,72px)'; // shrink as the digit count grows
    $('#list', el).innerHTML = st.list.map((x, i) => `<div class="item" data-sel="${i}" role="button" tabindex="0" style="${i === st.sel ? 'border-color:var(--accent)' : ''}"><span class="grow">${esc(x.n)}</span><b>${esc(x.v)}</b>${st.list.length > 1 ? `<button class="btn danger" data-del="${i}" aria-label="Delete counter">✕</button>` : ''}</div>`).join('');
  };
  const stepV = () => Math.max(1, Math.min(1e6, Math.round(Valid.num($('#step', el).value) || 1)));
  const disarm = () => { armed = null; clearTimeout(armT); };
  const arm = (what, msg) => { if (armed === what) { disarm(); return true; } armed = what; clearTimeout(armT); armT = setTimeout(() => { armed = null; }, 3000); toast(msg); return false; };
  el.addEventListener('input', (e) => { if (e.target.id === 'step') { st.step = stepV(); save(); } });
  el.addEventListener('keydown', (e) => { // list rows act as buttons: Enter or Space selects
    const row = e.target.closest && e.target.closest('[data-sel]');
    if (row && row === e.target && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); st.sel = +row.dataset.sel; save(); draw(); const nr = $('[data-sel="' + st.sel + '"]', el); if (nr) nr.focus(); }
  });
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button'), c = st.list[st.sel];
    if (b && (b.id === 'plus' || b.id === 'minus')) { c.v = Math.max(-1e15, Math.min(1e15, c.v + (b.id === 'plus' ? 1 : -1) * stepV())); buzz(12); save(); draw(); return; }
    if (b && b.id === 'reset') { if (arm('reset', 'Tap Reset again to confirm')) { c.v = 0; buzz(30); save(); draw(); } return; }
    if (b && b.id === 'exp') { sendFile('tally-' + todayStr() + '.csv', '\uFEFF' + toCSV(L.tallyRows(st.list)), 'text/csv', 'Counters exported'); return; }
    if (b && b.id === 'addc') {
      if (st.list.length >= 20) { toast('Max 20 counters'); return; }
      st.list.push({ n: $('#newn', el).value.trim() || 'Counter ' + (st.list.length + 1), v: 0 }); st.sel = st.list.length - 1; $('#newn', el).value = ''; save(); draw(); return;
    }
    if (b && b.dataset.del !== undefined) {
      const i = +b.dataset.del;
      if (arm('del' + i, 'Tap again to delete "' + st.list[i].n + '"')) { st.list.splice(i, 1); st.sel = Math.min(st.sel, st.list.length - 1); save(); draw(); }
      return;
    }
    const it = e.target.closest('[data-sel]');
    if (it) { st.sel = +it.dataset.sel; save(); draw(); }
  });
  draw();
  return disarm;
} });

/* ================= 5. Random ================= */
reg({ id: 'random', name: 'Random', icon: '🎰', desc: 'Random numbers (with a no-repeat option), pick or shuffle items from a list, and random dates.', keys: ['dice', 'draw', 'lottery', 'pick', 'shuffle', 'raffle'], render(el) {
  const drawn = new Set();
  el.innerHTML = `<div class="card list"><b>Random number</b>
    <div class="row"><label class="f">Min<input id="mn" type="number" inputmode="numeric" step="1" min="-1000000000" max="1000000000" value="1"></label><label class="f">Max<input id="mx" type="number" inputmode="numeric" step="1" min="-1000000000" max="1000000000" value="100"></label><label class="f">How many<input id="cnt" type="number" inputmode="numeric" step="1" value="1" min="1" max="500"></label></div>
    <label class="item"><input id="nr" type="checkbox" style="width:22px;height:22px;flex:0 0 auto"><span class="grow">No repeats until all are drawn</span></label>
    <button class="btn" id="gn">Draw</button><div class="mid" id="rn" style="word-break:break-word"></div><button class="btn alt" id="rst">Reset no-repeat list</button></div>
    <div class="card list"><b>Pick or shuffle a list</b><label class="f">One item per line<textarea id="li" rows="5" maxlength="3000" placeholder="Anna&#10;Ben&#10;Chloe"></textarea></label>
    <div class="row"><button class="btn" id="pk">Pick one</button><button class="btn alt" id="sh">Shuffle</button></div><div class="mid" id="rl" style="word-break:break-word"></div></div>
    <div class="card list"><b>Random date</b><div class="row"><label class="f">From<input id="d1" type="date" min="1900-01-01" max="2200-12-31" value="${L.ds(L.today())}"></label><label class="f">To<input id="d2" type="date" min="1900-01-01" max="2200-12-31" value="${L.ds(L.today() + 365)}"></label></div>
    <button class="btn" id="gd">Pick a date</button><div class="mid" id="rd"></div><div class="center muted" id="rw"></div></div>`;
  const key = () => $('#mn', el).value + ':' + $('#mx', el).value;
  let lastKey = '';
  const out = (id, t) => { $(id, el).textContent = t; };
  const lines = () => $('#li', el).value.split('\n').map((x) => x.trim()).filter(Boolean);
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'gn') {
      let mn = Math.round(parseFloat($('#mn', el).value)), mx = Math.round(parseFloat($('#mx', el).value));
      const cnt = Math.max(1, Math.min(500, Math.round(parseFloat($('#cnt', el).value) || 1)));
      if (!ok(mn, mx)) { toast('Enter min and max'); return; }
      if (mn > mx) [mn, mx] = [mx, mn];
      if (mx - mn > 1e9) { toast('Range too large'); return; }
      const nr = $('#nr', el).checked, size = mx - mn + 1;
      if (key() !== lastKey) { drawn.clear(); lastKey = key(); }
      const res = [];
      for (let i = 0; i < cnt; i++) {
        let v;
        if (nr) {
          if (drawn.size >= size) { if (!res.length) { toast('All numbers drawn. Reset the list.'); } break; }
          if (size - drawn.size < 2000) {
            const left = []; for (let x = mn; x <= mx; x++) if (!drawn.has(x)) left.push(x);
            v = left[L.rnd(left.length)];
          } else { do v = L.randInt(mn, mx); while (drawn.has(v)); }
          drawn.add(v);
        } else v = L.randInt(mn, mx);
        res.push(v);
      }
      out('#rn', res.join(', ')); buzz(10);
    } else if (b.id === 'rst') { drawn.clear(); toast('No-repeat list cleared'); }
    else if (b.id === 'pk') { const l = lines(); if (!l.length) { toast('Add some items'); return; } out('#rl', l[L.rnd(l.length)]); buzz(10); }
    else if (b.id === 'sh') { const l = lines(); if (!l.length) { toast('Add some items'); return; } $('#li', el).value = L.shuffle(l).join('\n'); out('#rl', 'Shuffled'); }
    else if (b.id === 'gd') {
      let a = L.pd($('#d1', el).value), c = L.pd($('#d2', el).value);
      if (!ok(a, c)) { toast('Pick both dates'); return; }
      if (a > c) [a, c] = [c, a];
      const d = L.randInt(a, c); out('#rd', L.ds(d)); out('#rw', L.DAYS[L.dow(d)]);
    }
  });
} });

/* ================= 6. Percentage ================= */
simple({ id: 'percent', name: 'Percentage', icon: '％', desc: 'X% of Y, X is what percent of Y, percent change, and add or subtract a percentage.', keys: ['percent', 'increase', 'decrease', 'change', 'ratio'], sections: [
  sec('What is X% of Y?', [[N('x', 'X (%)', 15, -1e6, 1e6), N('y', 'Y', 200, -1e12, 1e12)]], (v) => ok(v.x, v.y) ? big('Result', sig(v.x * v.y / 100)) : null),
  sec('X is what % of Y?', [[N('x', 'X', 30, -1e12, 1e12), N('y', 'Y', 120, -1e12, 1e12)]], (v) => ok(v.x, v.y) && v.y !== 0 ? big('Percentage', sig(v.x / v.y * 100) + '%') : null),
  sec('Percent change', [[N('a', 'From', 80, -1e12, 1e12), N('b', 'To', 100, -1e12, 1e12)]], (v) => { if (!ok(v.a, v.b) || v.a === 0) return null; const c = L.pctChange(v.a, v.b); return big(c >= 0 ? 'Increase' : 'Decrease', sig(Math.abs(c), 8) + '%'); }),
  sec('Add or subtract a percentage', [[N('v', 'Value', 250, -1e12, 1e12), N('p', 'Percent', 12, -1e6, 1e6)]], (v) => ok(v.v, v.p) ? rows([['Plus ' + sig(v.p) + '%', sig(v.v * (1 + v.p / 100))], ['Minus ' + sig(v.p) + '%', sig(v.v * (1 - v.p / 100))], ['The percent itself', sig(v.v * v.p / 100)]]) : null)
] });

/* ================= 7. Discount & GST ================= */
simple({ id: 'gst', name: 'Discount & GST', icon: '🔖', desc: 'Final price after discount and tax (GST or VAT), tax inclusive or exclusive, with the amount you save.', keys: ['sale', 'vat', 'tax', 'price', 'offer', 'off'], sections: [sec('', [
  N('p', 'Price', 1000, 0, 1e12), [N('d', 'Discount %', 10, 0, 100), N('t', 'Tax % (GST/VAT)', 18, 0, 100)], S('m', 'Entered price is', [['ex', 'Without tax (add tax)'], ['in', 'Including tax (split it)']], 'ex')
], (v) => {
  if (!ok(v.p, v.d, v.t) || v.p < 0 || v.d < 0 || v.d > 100 || v.t < 0) return null;
  const r = L.gst(v.p, v.d, v.t, v.m === 'in');
  return big('Final price', fx(r.final)) + rows([['You save', fx(r.saving)], ['Price after discount', fx(r.after)], ['Price before tax', fx(r.base)], ['Tax amount', fx(r.tax)]]);
}, undefined, (v) => 'Price ' + sig(v.p) + ', ' + sig(v.d) + '% off, ' + sig(v.t) + '% tax ' + (v.m === 'in' ? '(included)' : '(added)'))] });

/* ================= 8. Tip ================= */
simple({ id: 'tip', name: 'Tip Splitter', icon: '🍽️', desc: 'Split a bill between friends with a tip, optionally rounding each share up.', keys: ['bill', 'split', 'restaurant', 'gratuity'], sections: [sec('', [
  N('b', 'Bill amount', 1200, 0, 1e12), [N('t', 'Tip %', 10, 0, 100), N('n', 'People', 4, 1, 1000, 1)], S('r', 'Rounding', [['no', 'Exact'], ['up', 'Round each share up']], 'no')
], (v) => {
  const n = Math.round(v.n);
  if (!ok(v.b, v.t, n) || v.b < 0 || v.t < 0 || n < 1 || n > 1000) return null;
  const r = L.tip(v.b, v.t, n, v.r === 'up');
  return big('Each person pays', fx(r.per)) + rows([['Tip total', fx(r.tip)], ['Total with tip', fx(r.total)], ['Bill share (no tip)', fx(r.billPer)]]);
}, undefined, (v) => 'Bill ' + sig(v.b) + ' + ' + sig(v.t) + '% tip, ' + Math.round(v.n) + ' people')] });

/* ================= 9. Age ================= */
simple({ id: 'age', name: 'Age Calculator', icon: '🎈', desc: 'Exact age in years, months and days, total days lived and the countdown to the next birthday.', keys: ['birthday', 'dob', 'born', 'years old'], sections: [sec('', [
  { k: 'dob', l: 'Date of birth', t: 'date', v: '1995-06-15', min: '1900-01-01', max: '2200-12-31' }, { k: 'on', l: 'Age on', t: 'date', v: todayStr, keep: false, min: '1900-01-01', max: '2200-12-31' }
], (v) => {
  const a = L.pd(v.dob), b = L.pd(v.on);
  if (!ok(a, b) || b < a) return null;
  const r = L.age(a, b);
  return big('Age', r.y + ' years ' + r.m + ' months ' + r.d + ' days') + rows([['Total days lived', fx(r.days, 0)], ['Total weeks', fx(Math.floor(r.days / 7), 0)], ['Total months', fx(r.y * 12 + r.m, 0)], ['Born on a', L.DAYS[L.dow(a)]],
    ['Next birthday', r.nextIn === 0 ? 'Today! Turning ' + r.turning : r.nextIn + ' days (' + L.DAYS[L.dow(r.next)] + ', turning ' + r.turning + ')']]);
})] });

/* ================= 10. Investment ================= */
simple({ id: 'invest', name: 'Investment', icon: '🌱', desc: 'Compound interest on a lump sum, and the future value of a monthly SIP, with a year-by-year growth table.', keys: ['sip', 'compound', 'savings', 'mutual fund', 'returns'], sections: [
  sec('Lump sum (compound interest)', [N('p', 'Amount invested', 100000, 0, 1e12), [N('r', 'Return % per year', 8, 0, 200), N('y', 'Years', 10, 1, 100, 1)], S('n', 'Compounded', [[1, 'Yearly'], [2, 'Half-yearly'], [4, 'Quarterly'], [12, 'Monthly']], 1)], (v) => {
    const n = +v.n, y = Math.round(v.y);
    if (!ok(v.p, v.r, y) || v.p <= 0 || v.r < 0 || y < 1 || y > 100) return null;
    if (v.r > 200 || !(L.compound(v.p, v.r, y, n) < 1e15)) return CAPMSG;
    const fv = L.compound(v.p, v.r, y, n), body = [];
    for (let i = 1; i <= y; i++) body.push([i, fx(L.compound(v.p, v.r, i, n), 0), fx(L.compound(v.p, v.r, i, n) - v.p, 0)]);
    return big('Final value', fx(fv)) + rows([['Interest earned', fx(fv - v.p)], ['Growth', sig((fv / v.p - 1) * 100, 6) + '%']]) + table(['Year', 'Value', 'Gain'], body);
  }),
  sec('Monthly SIP', [N('m', 'Monthly investment', 5000, 0, 1e12), [N('r', 'Return % per year', 12, 0, 200), N('y', 'Years', 10, 1, 60, 1)]], (v) => {
    const y = Math.round(v.y);
    if (!ok(v.m, v.r, y) || v.m <= 0 || v.r < 0 || y < 1 || y > 60) return null;
    if (v.r > 200 || !(L.sip(v.m, v.r, y * 12) < 1e15)) return CAPMSG;
    const fv = L.sip(v.m, v.r, y * 12), inv = v.m * y * 12, body = [];
    for (let i = 1; i <= y; i++) body.push([i, fx(v.m * 12 * i, 0), fx(L.sip(v.m, v.r, i * 12), 0)]);
    return big('Future value', fx(fv)) + rows([['Total invested', fx(inv)], ['Estimated gain', fx(fv - inv)]]) + table(['Year', 'Invested', 'Value'], body) + '<div class="muted" style="font-size:12px">Each instalment is invested at the start of the month. Returns are not guaranteed.</div>';
  })
] });

/* ================= 11. Scientific ================= */
reg({ id: 'sci', name: 'Scientific', icon: '🔬', desc: 'Scientific calculator with brackets, trig in degrees or radians, logs, roots, powers, factorial and memory keys.', keys: ['sin', 'cos', 'tan', 'log', 'sqrt', 'calculator', 'factorial', 'scientific'], needs: [], render(el) {
  const hk = kit('sci');
  let deg = true, mem = 0, ans = 0, shown = false, fresh = false; // fresh: the box holds a result, so a digit starts a new sum
  const layout = [['DEG', 'MC', 'MR', 'M+', 'M−'], ['sin', 'cos', 'tan', 'ln', 'log'], ['asin', 'acos', 'atan', '√', '^'], ['(', ')', '!', 'π', 'e'], ['7', '8', '9', '÷', '⌫'], ['4', '5', '6', '×', 'AC'], ['1', '2', '3', '−', 'Ans'], ['0', '.', '%', '+', '=']];
  el.innerHTML = `<div class="card"><div class="muted" id="st" style="min-height:20px;font-size:13px"></div>
    <input id="ex" type="text" autocomplete="off" aria-label="Expression" maxlength="200" style="font-size:24px;text-align:right">
    <div class="mid" id="rs" style="text-align:right;min-height:40px;word-break:break-all"></div></div>
    <div id="kp" style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px">${layout.flat().map((k) => `<button data-k="${k}" style="padding:14px 0;font-size:${k.length > 2 ? 15 : 19}px;border:1px solid var(--line);border-radius:12px;background:${'=÷×−+'.includes(k) && k ? 'var(--accent)' : 'var(--surface)'};color:${'=÷×−+'.includes(k) && k ? 'var(--accent-t)' : 'var(--text)'}">${k}</button>`).join('')}</div>
    <div class="muted center" style="font-size:12px">Tip: tap the display to edit with the keyboard.</div>`;
  const ex = $('#ex', el);
  const status = () => { $('#st', el).textContent = (deg ? 'DEG' : 'RAD') + (mem ? '   M = ' + sig(mem, 8) : ''); $('[data-k="DEG"]', el).textContent = deg ? 'DEG' : 'RAD'; };
  const preview = () => {
    const s = ex.value.trim();
    if (!s) { $('#rs', el).textContent = ''; return null; }
    try { const r = L.calc(s, deg, ans); $('#rs', el).textContent = '= ' + sig(r, 12); $('#rs', el).style.color = ''; return r; } catch (e) { $('#rs', el).textContent = shown ? e.message : ''; $('#rs', el).style.color = 'var(--danger)'; return null; }
  };
  const ins = (t) => {
    const a = ex.selectionStart == null ? ex.value.length : ex.selectionStart, b = ex.selectionEnd == null ? a : ex.selectionEnd;
    ex.value = ex.value.slice(0, a) + t + ex.value.slice(b);
    const c = a + t.length; try { ex.setSelectionRange(c, c); } catch (e) { /* ignore */ }
  };
  const FN = ['sin', 'cos', 'tan', 'ln', 'log', 'asin', 'acos', 'atan', '√'];
  // '=' and Enter: the result goes back into the box as plain text (L.num), never as locale text such as 0,333
  const equals = () => { shown = true; const src = ex.value.trim(), r = preview(); if (r !== null) { hk.add(src + (/sin|cos|tan/i.test(src) ? (deg ? ' [DEG]' : ' [RAD]') : ''), sig(r, 12)); ans = r; ex.value = L.num(r); fresh = true; shown = false; $('#rs', el).textContent = ''; } };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]');
    if (!b) return;
    const k = b.dataset.k;
    buzz(8);
    if (fresh && (/^[0-9.]$/.test(k) || ['π', 'e', '(', 'Ans', 'MR'].includes(k) || FN.includes(k))) { ex.value = ''; try { ex.setSelectionRange(0, 0); } catch (er) { /* ignore */ } }
    if (k !== '=') fresh = false;
    if (k === 'DEG') deg = !deg;
    else if (k === 'AC') { ex.value = ''; shown = false; }
    else if (k === '⌫') { const a = ex.selectionStart == null ? ex.value.length : ex.selectionStart; if (a > 0) { ex.value = ex.value.slice(0, a - 1) + ex.value.slice(ex.selectionEnd == null ? a : ex.selectionEnd); try { ex.setSelectionRange(a - 1, a - 1); } catch (er) { /* ignore */ } } }
    else if (k === '=') equals();
    else if (k === 'MC') mem = 0;
    else if (k === 'MR') ins(L.num(mem));
    else if (k === 'M+' || k === 'M−') { const r = preview(); const v = r !== null ? r : ex.value.trim() ? null : ans; if (v === null) toast('Fix the expression first'); else mem += k === 'M+' ? v : -v; }
    else if (FN.includes(k)) ins(k + '(');
    else ins(k === 'Ans' ? 'Ans' : k);
    status(); if (k !== '=') { shown = false; preview(); }
  });
  ex.addEventListener('input', () => { fresh = false; shown = false; preview(); });
  ex.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') equals();
    else if (fresh && e.key.length === 1 && /[0-9.a-zπ(]/i.test(e.key) && !e.ctrlKey && !e.metaKey) { ex.value = ''; fresh = false; }
  });
  status();
  return hk.stop;
} });

/* ================= more calculators ================= */
simple({ id: 'fuel', name: 'Fuel Cost', icon: '⛽', desc: 'Trip fuel and cost from distance, mileage and fuel price, plus mileage from a fill-up.', keys: ['petrol', 'diesel', 'mileage', 'mpg', 'trip', 'km/l'], sections: [
  sec('Trip cost', [N('d', 'Distance (km)', 250, 0, 1e7), [N('e', 'Efficiency', 15, 0, 1000), S('u', 'Unit', [['kmpl', 'km/L'], ['l100', 'L/100 km'], ['mpg', 'mpg (US)']], 'kmpl')], N('p', 'Fuel price per litre', 100, 0, 1e6)], (v) => {
    const k = L.kmPerL(v.e, v.u);
    if (!ok(v.d, k, v.p) || v.d < 0 || k <= 0 || v.p < 0) return null;
    const lit = v.d / k;
    return big('Trip cost', fx(lit * v.p)) + rows([['Fuel needed', fx(lit) + ' L'], ['Cost per km', fx(lit * v.p / (v.d || 1))], ['Efficiency', fx(k) + ' km/L = ' + fx(100 / k) + ' L/100km']]);
  }),
  sec('Find my mileage', [[N('d', 'Distance driven (km)', 420, 0, 1e7), N('f', 'Fuel used (litres)', 30, 0, 1e6)]], (v) => ok(v.d, v.f) && v.d > 0 && v.f > 0 ? big('Mileage', fx(v.d / v.f) + ' km/L') + rows([['L per 100 km', fx(100 * v.f / v.d)], ['Miles per US gallon', fx(v.d / v.f * 3.785411784 / 1.609344)]]) : null)
] });

simple({ id: 'marks', name: 'Marks & GPA', icon: '🎓', desc: 'Total marks and percentage from subject scores, and weighted GPA from grades and credits.', keys: ['percentage', 'grade', 'gpa', 'exam', 'score', 'cgpa'], sections: [
  sec('Percentage', [{ k: 'm', l: 'Marks, one subject per line (85 or 42/50)', t: 'textarea', rows: 5, v: '85\n72\n91\n42/50' }, N('x', 'Default maximum per subject', 100, 0, 1e6)], (v) => {
    const r = L.marks(v.m, v.x);
    if (!(r.max > 0)) return null;
    const p = r.pct, g = p >= 90 ? 'A+' : p >= 80 ? 'A' : p >= 70 ? 'B' : p >= 60 ? 'C' : p >= 50 ? 'D' : p >= 40 ? 'E' : 'F';
    return big('Percentage', sig(p, 5) + '%') + rows([['Total', sig(r.got) + ' / ' + sig(r.max)], ['Grade (typical scale)', g]]) + (r.bad ? `<div class="status">${r.bad} line${r.bad === 1 ? '' : 's'} not understood</div>` : '');
  }),
  sec('GPA', [{ k: 'g', l: 'One per line: grade (A, B+, ...) or points, then credits', t: 'textarea', rows: 5, v: 'A 4\nB+ 3\n3.5 2' }], (v) => {
    const r = L.gpa(v.g);
    const note = r.bad ? `<div class="status">${r.bad} line${r.bad === 1 ? '' : 's'} not understood</div>` : '';
    return r.cr > 0 ? big('GPA', fx(r.gpa)) + rows([['Total credits', sig(r.cr)], ['Grade points', sig(r.pts, 6)]]) + note + '<div class="muted" style="font-size:12px">Letters use a 4.0 scale (A 4.0, B 3.0, D- 0.7, E and F 0).</div>' : (note || null);
  })
] });

simple({ id: 'timecalc', name: 'Time Calc', icon: '🕒', desc: 'Add and subtract durations such as 1:30 or 2h 15m, and work out hours between two clock times.', keys: ['hours', 'minutes', 'duration', 'timesheet', 'shift', 'add time'], sections: [
  sec('Add and subtract durations', [{ k: 't', l: 'One per line. Start with - to subtract. Formats: 1:30, 2h 15m, 1h30, 2 hours 15 minutes, 90m, 30 seconds', t: 'textarea', rows: 5, v: '1:30\n2h 15m\n-0:45' }], (v) => {
    const r = L.sumDurs(v.t);
    return big('Total', L.fmtDur(r.total)) + rows([['Decimal hours', sig(r.total / 3600, 6)], ['Minutes', sig(r.total / 60, 8)]]) + (r.bad ? `<div class="status">${r.bad} line(s) not understood</div>` : '');
  }),
  sec('Hours between two times', [[{ k: 'a', l: 'Start', t: 'time', v: '09:00' }, { k: 'b', l: 'End', t: 'time', v: '17:30' }], N('k', 'Unpaid break (minutes)', 30, 0, 1440, 1)], (v) => {
    if (!v.a || !v.b) return null;
    const m = L.tdiff(v.a, v.b, Math.max(0, v.k || 0));
    return m < 0 ? '<div class="status">Break is longer than the shift.</div>' : big('Worked', L.fmtDur(m * 60)) + rows([['Decimal hours', sig(m / 60, 5)]]) + (v.b <= v.a ? '<div class="muted center">Shift passes midnight.</div>' : '');
  })
] });

simple({ id: 'workdays', name: 'Work Days', icon: '💼', desc: 'Add working days to a date, or count working days between two dates, skipping weekends.', keys: ['business days', 'deadline', 'weekdays', 'working days'], sections: [
  sec('Date after N working days', [[{ k: 's', l: 'Start', t: 'date', v: todayStr, keep: false }, N('n', 'Working days', 10, -20000, 20000, 1)], S('w', 'Weekend', [['0,6', 'Sat + Sun'], ['5,6', 'Fri + Sat'], ['0', 'Sun only']], '0,6')], (v) => {
    const s = L.pd(v.s), n = Math.round(v.n);
    if (!ok(s, n)) return null;
    const wk = v.w.split(',').map(Number), r = L.addWork(s, n, wk);
    return big('Date', L.ds(r)) + `<div class="center muted">${L.DAYS[L.dow(r)]} (${r - s} calendar days)</div>`;
  }),
  sec('Working days between dates', [[{ k: 'a', l: 'From', t: 'date', v: todayStr, keep: false }, { k: 'b', l: 'To', t: 'date', v: () => L.ds(L.today() + 30), keep: false }], S('w', 'Weekend', [['0,6', 'Sat + Sun'], ['5,6', 'Fri + Sat'], ['0', 'Sun only']], '0,6')], (v) => {
    const a = L.pd(v.a), b = L.pd(v.b);
    if (!ok(a, b)) return null;
    if (b < a) return '<div class="status">The end date is before the start date.</div>';
    if (b - a > 36500) return '<div class="status">Pick dates less than 100 years apart.</div>';
    return big('Working days (both dates included)', String(L.countWork(a, b, v.w.split(',').map(Number)))) + rows([['Calendar days', String(b - a + 1)]]);
  })
] });

simple({ id: 'pay', name: 'Salary Convert', icon: '💵', desc: 'Convert pay between hourly, daily, weekly, monthly and yearly amounts.', keys: ['hourly', 'wage', 'annual', 'income', 'salary', 'ctc'], sections: [sec('', [
  [N('a', 'Amount', 25, 0, 1e12), S('u', 'Per', [['hour', 'Hour'], ['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year']], 'hour')], [N('h', 'Hours per week', 40, 0, 168), N('w', 'Weeks per year', 52, 0, 53)], N('d', 'Days per week', 5, 0, 7)
], (v) => {
  if (!ok(v.a, v.h, v.w, v.d) || v.h <= 0 || v.w <= 0 || v.d <= 0) return null;
  const r = L.pay(v.a, v.u, v.h, v.w, v.d);
  return big('Per year', fx(r.year)) + rows([['Per month', fx(r.month)], ['Per 2 weeks', fx(r.biweek)], ['Per week', fx(r.week)], ['Per day', fx(r.day)], ['Per hour', fx(r.hour)]]);
})] });

simple({ id: 'loancmp', name: 'Loan Compare', icon: '🆚', desc: 'Compare two loan offers side by side: EMI, total interest and total cost.', keys: ['emi', 'loan', 'compare', 'mortgage', 'offer'], sections: [sec('', [
  N('p', 'Loan amount (both)', 1000000, 0, 1e12), [N('r1', 'Offer A rate %', 9, 0, 200), N('n1', 'A months', 120, 1, 1200, 1)], [N('r2', 'Offer B rate %', 8.5, 0, 200), N('n2', 'B months', 144, 1, 1200, 1)]
], (v) => {
  const n1 = Math.round(v.n1), n2 = Math.round(v.n2);
  if (!ok(v.p, v.r1, v.r2, n1, n2) || v.p <= 0 || n1 < 1 || n2 < 1 || n1 > 1200 || n2 > 1200 || v.r1 < 0 || v.r2 < 0) return null;
  const e1 = L.emi(v.p, v.r1, n1), e2 = L.emi(v.p, v.r2, n2), c1 = e1 * n1, c2 = e2 * n2;
  return table(['', 'A', 'B'], [['EMI', fx(e1), fx(e2)], ['Interest', fx(c1 - v.p), fx(c2 - v.p)], ['Total', fx(c1), fx(c2)]]) + big(c1 === c2 ? 'Same total cost' : (c1 < c2 ? 'Offer A' : 'Offer B') + ' costs less by', c1 === c2 ? '' : fx(Math.abs(c1 - c2)));
})] });

reg({ id: 'fraction', name: 'Fractions', icon: '➗', desc: 'Add, subtract, multiply and divide fractions and mixed numbers, simplified with the decimal value.', keys: ['fraction', 'mixed number', 'simplify', 'numerator'], render(el) {
  el.innerHTML = `<div class="card list"><label class="f">First (3/4, 1 1/2, 0.25 or 2)<input id="a" type="text" maxlength="30" value="3/4"></label>
    <label class="f">Operation<select id="o"><option value="+">+  add</option><option value="-">−  subtract</option><option value="*">×  multiply</option><option value="/">÷  divide</option></select></label>
    <label class="f">Second<input id="b" type="text" maxlength="30" value="2/3"></label><div class="list" id="r"></div></div>`;
  const run = () => {
    const a = L.pfrac($('#a', el).value), b = L.pfrac($('#b', el).value);
    if (!a || !b) { $('#r', el).innerHTML = '<div class="muted center">Enter two valid fractions.</div>'; return; }
    const r = L.fop(a, b, $('#o', el).value);
    $('#r', el).innerHTML = r && r.over ? '<div class="status">These numbers are too large to calculate exactly. Use smaller fractions.</div>' : r ? big('Result', L.fstr(r)) + rows([['Mixed number', L.fmixed(r)], ['Decimal', sig(r.n / r.d, 10)], ['Percent', sig(r.n / r.d * 100, 8) + '%']]) : '<div class="status">Cannot divide by zero.</div>';
  };
  const hk = kit('fraction');
  const run2 = () => { run(); const a = L.pfrac($('#a', el).value), b = L.pfrac($('#b', el).value); if (!a || !b) return; const o = $('#o', el).value, r = L.fop(a, b, o); if (r && !r.over) hk.soon('f', () => hk.add(L.fstr(a) + ' ' + ({ '+': '+', '-': '−', '*': '×', '/': '÷' })[o] + ' ' + L.fstr(b), L.fstr(r) + ' (' + sig(r.n / r.d, 10) + ')')); };
  el.addEventListener('input', run2); run();
  return hk.stop;
} });

simple({ id: 'ratio', name: 'Ratio', icon: '⚗️', desc: 'Simplify a ratio, solve a proportion (a : b = c : x) and split an amount in a ratio.', keys: ['proportion', 'divide in ratio', 'simplify', 'scale'], sections: [
  sec('Simplify a : b', [[N('a', 'A', 24, -1e12, 1e12, 1), N('b', 'B', 36, -1e12, 1e12, 1)]], (v) => { if (!ok(v.a, v.b) || !Number.isInteger(v.a) || !Number.isInteger(v.b) || !v.a || !v.b) return v.a === 0 || v.b === 0 ? null : '<div class="muted center">Use whole numbers.</div>'; const g = L.gcd(v.a, v.b); return big('Simplest form', v.a / g + ' : ' + v.b / g) + rows([['Decimal (a / b)', sig(v.a / v.b, 8)]]); }),
  sec('Proportion  a : b = c : x', [[N('a', 'a', 3, -1e12, 1e12), N('b', 'b', 5, -1e12, 1e12)], N('c', 'c', 12, -1e12, 1e12)], (v) => ok(v.a, v.b, v.c) && v.a !== 0 ? big('x', sig(v.b * v.c / v.a, 10)) : null),
  sec('Split an amount', [N('t', 'Total', 1000, 0, 1e12), [N('a', 'Share A', 2, 0, 1e9), N('b', 'Share B', 3, 0, 1e9)]], (v) => ok(v.t, v.a, v.b) && v.a + v.b > 0 && v.a >= 0 && v.b >= 0 ? rows([['A gets', fx(v.t * v.a / (v.a + v.b))], ['B gets', fx(v.t * v.b / (v.a + v.b))]]) : null)
] });

simple({ id: 'stats', name: 'Statistics', icon: '📉', desc: 'Mean, median, mode, range, variance and standard deviation of a list of numbers.', keys: ['average', 'mean', 'median', 'mode', 'deviation', 'variance'], sections: [sec('', [{ k: 'n', l: 'Numbers (spaces, new lines, or commas followed by a space)', t: 'textarea', rows: 4, v: '4, 8, 15, 16, 23, 42, 8' }], (v) => {
  const pn = L.parseNums(v.n), a = pn.nums;
  if (pn.bad !== null) return `<div class="status">"${esc(pn.bad.slice(0, 30))}" is not a number. Separate numbers with spaces or new lines.</div>`;
  if (!a.length || a.length > 5000) return null;
  const s = L.stats(a);
  return big('Mean', sig(s.mean, 10)) + rows([['Count', String(s.n)], ['Sum', sig(s.sum, 12)], ['Median', sig(s.median, 10)], ['Mode', s.mode.length ? s.mode.map((x) => sig(x)).join(', ') : 'none'], ['Min / Max', sig(s.min) + ' / ' + sig(s.max)], ['Range', sig(s.range, 10)],
    ['Std dev (population)', sig(s.sdP, 8)], ['Std dev (sample)', sig(s.sdS, 8)], ['Variance (sample)', sig(s.varS, 8)]]);
})] });

reg({ id: 'prime', name: 'Prime Check', icon: '🔍', desc: 'Check whether a number is prime, see its prime factors and divisors, and find the nearest primes.', keys: ['factor', 'factorisation', 'divisors', 'prime number'], render(el) {
  el.innerHTML = `<div class="card list"><label class="f">Whole number (up to 9,000,000,000,000,000)<input id="n" type="number" inputmode="numeric" step="1" min="2" max="9000000000000000" value="360"></label>
    <button class="btn" id="go">Analyse</button><div class="list" id="r"></div></div>`;
  const run = () => {
    const n = parseFloat($('#n', el).value), out = $('#r', el);
    if (!Number.isInteger(n) || n < 2 || n > 9e15) { out.innerHTML = '<div class="muted center" style="font-size:13px">Enter a whole number from 2 to 9,000,000,000,000,000.</div>'; return; }
    const r = L.analyse(n), rs = [['Prime?', r.prime ? 'Yes, prime' : 'No, composite'], ['Prime factors', r.prime ? String(n) : r.factors.map((x) => x[1] > 1 ? x[0] + '^' + x[1] : x[0]).join(' × ')]];
    if (r.divisors) rs.push(['Divisors (' + r.divisors.length + ')', r.divisors.length > 40 ? r.divisors.slice(0, 40).join(', ') + ' ...' : r.divisors.join(', ')]);
    if (r.next !== undefined) { rs.push(['Next prime', String(r.next)]); if (r.prev) rs.push(['Previous prime', String(r.prev)]); }
    out.innerHTML = rows(rs) + (n > L.NEIGHBOUR_MAX ? '<div class="muted" style="font-size:12px">Nearest primes are only searched up to 1,000,000,000,000.</div>' : '');
  };
  $('#go', el).onclick = run;
  $('#n', el).addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
  run();
} });

simple({ id: 'gcdlcm', name: 'GCD & LCM', icon: '🧩', desc: 'Greatest common divisor and least common multiple of two or more whole numbers.', keys: ['hcf', 'gcf', 'lcm', 'multiple', 'common factor'], sections: [sec('', [{ k: 'n', l: 'Whole numbers (spaces or commas)', t: 'text', v: '12, 18, 30', len: 200 }], (v) => {
  const pn = L.parseNums(v.n), a = pn.nums.map(Math.abs);
  if (pn.bad !== null) return `<div class="status">"${esc(pn.bad.slice(0, 30))}" is not a whole number.</div>`;
  if (a.length < 2 || a.length > 30 || a.some((x) => !Number.isInteger(x) || x === 0 || x > 1e12)) return null;
  const g = a.reduce(L.gcd), l = a.reduce(L.lcm);
  return rows([['GCD (HCF)', fx(g, 0)], ['LCM', l > 9e15 ? 'too large' : fx(l, 0)]]);
})] });

simple({ id: 'quad', name: 'Quadratic', icon: '🎢', desc: 'Solve ax² + bx + c = 0 with real or complex roots, discriminant and the vertex of the parabola.', keys: ['equation', 'roots', 'algebra', 'parabola', 'discriminant'], sections: [sec('ax² + bx + c = 0', [[N('a', 'a', 1, -1e9, 1e9), N('b', 'b', -3, -1e9, 1e9), N('c', 'c', 2, -1e9, 1e9)]], (v) => {
  if (!ok(v.a, v.b, v.c)) return null;
  const r = L.quad(v.a, v.b, v.c);
  if (r.type === 'none') return '<div class="status">No equation: a and b are both 0.</div>';
  if (r.type === 'linear') return big('Linear: x', sig(r.x, 10));
  const v2 = [['Discriminant', sig(r.D, 10)], ['Vertex', '(' + sig(r.vx, 8) + ', ' + sig(r.vy, 8) + ')']];
  if (r.type === 'two') return rows([['x₁', sig(r.x1, 10)], ['x₂', sig(r.x2, 10)]].concat(v2));
  if (r.type === 'one') return rows([['x (double root)', sig(r.x1, 10)]].concat(v2));
  return rows([['x₁', sig(r.re, 8) + ' + ' + sig(r.im, 8) + 'i'], ['x₂', sig(r.re, 8) + ' − ' + sig(r.im, 8) + 'i']].concat(v2));
})] });

reg({ id: 'shapes', name: 'Area & Volume', icon: '🔷', desc: 'Area, perimeter, surface area and volume of common 2D and 3D shapes.', keys: ['geometry', 'circle', 'cylinder', 'sphere', 'rectangle', 'cone', 'perimeter'], render(el) {
  const names = Object.keys(L.shapes), hk = kit('shapes');
  el.innerHTML = `<div class="card list"><label class="f">Shape<select id="s">${names.map((n) => `<option>${n}</option>`).join('')}</select></label><div class="list" id="f"></div><div class="list" id="r"></div></div>`;
  const run = (ev) => {
    const sh = L.shapes[$('#s', el).value], v = $$('input', el).map((i) => { const n = Valid.num(i.value); return n !== null && n <= +i.max ? n : NaN; });
    const good = v.length && v.every((x) => Number.isFinite(x) && x > 0);
    $('#r', el).innerHTML = good ? rows(sh.f(...v).map((r) => [r[0], sig(r[1], 8)])) : '<div class="muted center">Enter positive sizes.</div>';
    if (good && ev) hk.soon('s', () => hk.add($('#s', el).value + ' ' + sh.d.map((d, i) => d + ' ' + sig(v[i])).join(', '), sh.f(...v).slice(0, 2).map((r) => r[0] + ' ' + sig(r[1], 8)).join('; ')));
  };
  const build = () => {
    const sh = L.shapes[$('#s', el).value];
    $('#f', el).innerHTML = sh.d.map((d, i) => `<label class="f">${esc(d)}<input type="number" inputmode="decimal" step="any" min="0" max="1000000000" value="${[10, 5, 4][i]}"></label>`).join('');
    run();
  };
  $('#s', el).onchange = build; el.addEventListener('input', (e) => { if (e.target.tagName === 'INPUT') run(e); });
  build();
  return hk.stop;
} });

reg({ id: 'triangle', name: 'Triangle', icon: '🔺', desc: 'Solve a triangle from three sides or from two sides and the angle between them: angles, area, type and radii.', keys: ['trigonometry', 'heron', 'angles', 'sides', 'geometry'], render(el) {
  const hk = kit('triangle');
  el.innerHTML = `<div class="card list"><label class="f">Known<select id="m"><option value="sss">Three sides (a, b, c)</option><option value="sas">Two sides and the angle between (a, b, C°)</option></select></label>
    <div class="row"><label class="f"><span>Side a</span><input id="a" type="number" inputmode="decimal" step="any" min="0" max="1000000000" value="3"></label><label class="f"><span>Side b</span><input id="b" type="number" inputmode="decimal" step="any" min="0" max="1000000000" value="4"></label><label class="f"><span id="cl">Side c</span><input id="c" type="number" inputmode="decimal" step="any" min="0" max="1000000000" value="5"></label></div><div class="list" id="r"></div></div>`;
  const run = (ev) => {
    const sas = $('#m', el).value === 'sas';
    $('#cl', el).textContent = sas ? 'Angle C (°)' : 'Side c';
    $('#c', el).max = sas ? '180' : '1000000000';
    const num = (id) => { const x = $('#' + id, el), n = Valid.num(x.value); return n === null || n < 0 || (x.max !== '' && n > +x.max) ? NaN : n; };
    const a = num('a'), b = num('b');
    let c = num('c'), pre = '';
    if (sas) { const s = ok(a, b, c) && a > 0 && b > 0 ? L.triSAS(a, b, c) : null; if (!s) { $('#r', el).innerHTML = '<div class="status">Angle must be between 0 and 180.</div>'; return; } pre = rows([['Side c', sig(s.c, 8)]]); c = s.c; }
    const t = ok(a, b, c) ? L.triSSS(a, b, c) : null;
    if (t && ev && ev.type) hk.soon('t', () => hk.add('Triangle ' + (sas ? 'a ' + sig(a) + ', b ' + sig(b) + ', C ' + sig(Valid.num($('#c', el).value)) + '°' : 'sides ' + sig(a) + ', ' + sig(b) + ', ' + sig(c)), 'Area ' + sig(t.area, 8) + '; ' + t.type));
    $('#r', el).innerHTML = t ? pre + rows([['Angle A', sig(t.A, 7) + '°'], ['Angle B', sig(t.B, 7) + '°'], ['Angle C', sig(t.C, 7) + '°'], ['Type', t.type], ['Area', sig(t.area, 8)], ['Perimeter', sig(t.perimeter, 8)], ['Inradius', sig(t.inradius, 6)], ['Circumradius', sig(t.circumradius, 6)]]) : '<div class="status">These sides cannot form a triangle.</div>';
  };
  el.addEventListener('input', run); el.addEventListener('change', run); run();
  return hk.stop;
} });

simple({ id: 'powercost', name: 'Power Cost', icon: '🔌', desc: 'Electricity used and cost of an appliance per day, month and year from its watts and daily hours.', keys: ['electricity', 'kwh', 'watt', 'bill', 'appliance', 'energy'], sections: [sec('', [
  [N('w', 'Power (watts)', 1500, 0, 1e6), N('q', 'How many', 1, 0, 10000, 1)], [N('h', 'Hours per day', 2, 0, 24), N('r', 'Price per kWh', 8, 0, 10000)]
], (v) => {
  if (!ok(v.w, v.q, v.h, v.r) || v.w < 0 || v.q < 0 || v.h < 0 || v.h > 24 || v.r < 0) return null;
  const day = v.w * v.q * v.h / 1000;
  return big('Cost per month (30 days)', fx(day * 30 * v.r)) + rows([['Energy per day', fx(day, 3) + ' kWh'], ['Cost per day', fx(day * v.r)], ['Energy per month', fx(day * 30) + ' kWh'], ['Cost per year', fx(day * 365 * v.r)]]);
})] });

simple({ id: 'cooking', name: 'Cooking Units', icon: '🥣', desc: 'Convert cups, spoons, grams and ounces for common ingredients such as flour, sugar and butter.', keys: ['recipe', 'cups to grams', 'baking', 'tablespoon', 'teaspoon', 'kitchen'], sections: [sec('', [
  S('i', 'Ingredient', Object.keys(L.ING).map((k) => [k, k]), 'Flour (plain)'), [N('a', 'Amount', 1, 0, 1e6), S('u', 'Unit', [['cup', 'cup (US)'], ['tbsp', 'tablespoon'], ['tsp', 'teaspoon'], ['g', 'gram'], ['kg', 'kilogram'], ['oz', 'ounce'], ['ml', 'millilitre']], 'cup')]
], (v) => {
  if (!ok(v.a) || v.a <= 0 || !L.ING[v.i]) return null;
  const r = L.cook(L.ING[v.i], v.a, v.u);
  return rows([['Grams', sig(r.g, 5)], ['Ounces', sig(r.oz, 4)], ['Cups', sig(r.cup, 4)], ['Tablespoons', sig(r.tbsp, 4)], ['Teaspoons', sig(r.tsp, 4)], ['Millilitres', sig(r.ml, 4)]]) + '<div class="muted" style="font-size:12px">Typical densities; real weights vary by brand and packing.</div>';
})] });

simple({ id: 'sizes', name: 'Size Converter', icon: '👕', desc: 'Approximate shoe, clothing and chest size conversions between UK, US and EU sizing.', keys: ['shoe', 'clothing', 'dress', 'shirt', 'eu', 'uk', 'us'], sections: [
  sec('Shoes', [[S('s', 'System', [['uk', 'UK'], ['usm', 'US men'], ['usw', 'US women'], ['eu', 'EU'], ['cm', 'Foot length cm']], 'uk'), N('v', 'Size', 8, 0, 60)]], (v) => {
    if (!ok(v.v) || v.v <= 0) return null;
    const r = L.shoe(v.s, v.v);
    if (!r) return '<div class="status">Size out of range (UK 1 to 16).</div>';
    return rows([['UK', sig(r.uk)], ['US men', sig(r.usm)], ['US women', sig(r.usw)], ['EU', sig(r.eu)], ['Foot length', sig(r.cm, 3) + ' cm']]) + '<div class="muted" style="font-size:12px">Approximate (nearest half size). Brands differ, so check their chart.</div>';
  }),
  sec('Women\'s clothing', [[S('s', 'System', [['uk', 'UK'], ['us', 'US'], ['eu', 'EU']], 'uk'), N('v', 'Size', 10, 0, 60)]], (v) => { if (!ok(v.v)) return null; const r = L.dress(v.s, v.v); return rows([['UK', sig(r.uk)], ['US', sig(r.us)], ['EU', sig(r.eu)]]); }),
  sec('Chest / jacket', [[N('v', 'Chest', 40, 0, 300), S('u', 'Unit', [['in', 'inches'], ['cm', 'cm']], 'in')]], (v) => { if (!ok(v.v) || v.v <= 0) return null; const r = L.chest(v.u, v.v); return rows([['Chest', sig(r.inch, 4) + ' in / ' + sig(r.cm, 4) + ' cm'], ['EU size', sig(r.eu)], ['Letter size', r.letter]]); })
] });

simple({ id: 'breakeven', name: 'Break-even', icon: '🏁', desc: 'Units you must sell to cover costs, and to reach a profit target, from fixed and variable costs.', keys: ['business', 'profit', 'cost', 'units', 'contribution'], sections: [sec('', [
  N('f', 'Fixed costs', 50000, 0, 1e12), [N('p', 'Price per unit', 250, 0, 1e9), N('v', 'Variable cost per unit', 150, 0, 1e9)], N('t', 'Profit target (optional)', 20000, 0, 1e12)
], (v) => {
  if (!ok(v.f, v.p, v.v) || v.f < 0) return null;
  const r = L.breakeven(v.f, v.p, v.v, Number.isFinite(v.t) ? v.t : 0);
  if (!r) return '<div class="status">Price must be higher than the variable cost.</div>';
  return big('Break-even units', fx(r.units, 0)) + rows([['Break-even revenue', fx(r.units * v.p)], ['Profit per unit', fx(r.cm)], ['Contribution margin', fx(r.cmPct) + '%']].concat(Number.isFinite(v.t) && v.t > 0 ? [['Units for the profit target', fx(r.unitsT, 0)], ['Revenue for target', fx(r.unitsT * v.p)]] : []));
})] });

simple({ id: 'margin', name: 'Markup & Margin', icon: '💹', desc: 'Profit, margin and markup from cost and price, or the selling price for a margin or markup you want.', keys: ['profit', 'selling price', 'cost', 'retail', 'gross margin'], sections: [
  sec('From cost and price', [[N('c', 'Cost', 80, 0, 1e12), N('p', 'Selling price', 100, 0, 1e12)]], (v) => { if (!ok(v.c, v.p) || v.c <= 0 || v.p <= 0) return null; const r = L.margin(v.c, v.p); return big('Margin', sig(r.margin, 6) + '%') + rows([['Markup', sig(r.markup, 6) + '%'], ['Profit', fx(r.profit)]]); }),
  sec('Price I need', [[N('c', 'Cost', 80, 0, 1e12), N('x', 'Percent', 25, 0, 1000)], S('m', 'Percent is', [['mg', 'Margin (of price)'], ['mk', 'Markup (on cost)']], 'mg')], (v) => {
    if (!ok(v.c, v.x) || v.c <= 0 || v.x < 0 || (v.m === 'mg' && v.x >= 100)) return null;
    const p = v.m === 'mg' ? v.c / (1 - v.x / 100) : v.c * (1 + v.x / 100);
    return big('Selling price', fx(p)) + rows([['Profit', fx(p - v.c)]]);
  })
] });

simple({ id: 'interest', name: 'Simple Interest', icon: '💰', desc: 'Simple interest and total amount for a principal, rate and time in years or months.', keys: ['principal', 'rate', 'loan', 'deposit'], sections: [sec('', [
  N('p', 'Principal', 50000, 0, 1e12), [N('r', 'Rate % per year', 7, 0, 200), N('t', 'Time', 3, 0, 100, undefined, ['u', { y: [0, 100], m: [0, 1200], d: [0, 36500] }])], S('u', 'Time in', [['y', 'Years'], ['m', 'Months'], ['d', 'Days']], 'y')
], (v) => {
  if (!ok(v.p, v.r, v.t) || v.p < 0 || v.r < 0 || v.t < 0) return null;
  const yrs = v.u === 'y' ? v.t : v.u === 'm' ? v.t / 12 : v.t / 365, i = v.p * v.r * yrs / 100;
  if (!(i + v.p < 1e15)) return BIG;
  return big('Interest', fx(i)) + rows([['Total amount', fx(v.p + i)], ['Per year', fx(v.p * v.r / 100)]]);
})] });

simple({ id: 'fdrd', name: 'FD / RD', icon: '🏧', desc: 'Maturity amount of a fixed deposit with compounding, and of a monthly recurring deposit.', keys: ['fixed deposit', 'recurring deposit', 'bank', 'maturity', 'savings'], sections: [
  sec('Fixed deposit', [N('p', 'Deposit', 100000, 0, 1e12), [N('r', 'Rate % per year', 7, 0, 200), N('y', 'Years', 5, 0, 50)], S('n', 'Compounded', [[4, 'Quarterly'], [12, 'Monthly'], [2, 'Half-yearly'], [1, 'Yearly']], 4)], (v) => {
    if (!ok(v.p, v.r, v.y) || v.p <= 0 || v.r < 0 || v.y <= 0 || v.y > 50) return null;
    if (v.r > 200 || !(L.compound(v.p, v.r, v.y, +v.n) < 1e15)) return CAPMSG;
    const m = L.compound(v.p, v.r, v.y, +v.n);
    return big('Maturity amount', fx(m)) + rows([['Interest earned', fx(m - v.p)]]);
  }),
  sec('Recurring deposit', [N('m', 'Monthly deposit', 5000, 0, 1e12), [N('r', 'Rate % per year', 6.5, 0, 200), N('t', 'Months', 24, 1, 600, 1)]], (v) => {
    const n = Math.round(v.t);
    if (!ok(v.m, v.r, n) || v.m <= 0 || v.r < 0 || n < 1 || n > 600) return null;
    if (v.r > 200 || !(L.rd(v.m, v.r, n) < 1e15)) return CAPMSG;
    const m = L.rd(v.m, v.r, n);
    return big('Maturity amount', fx(m)) + rows([['Total deposited', fx(v.m * n)], ['Interest earned', fx(m - v.m * n)]]) + '<div class="muted" style="font-size:12px">Quarterly compounding. Banks may differ slightly.</div>';
  })
] });

simple({ id: 'networth', name: 'Net Worth', icon: '💎', desc: 'Add up assets and debts from simple lists to see your net worth.', keys: ['assets', 'liabilities', 'wealth', 'savings', 'debt'], sections: [sec('One item per line, amount at the end of the line', [
  { k: 'a', l: 'Assets', t: 'textarea', rows: 4, v: 'Savings 150000\nInvestments 300000', p: 'Cash 5000' }, { k: 'l', l: 'Debts', t: 'textarea', rows: 4, v: 'Car loan 120000', p: 'Loan 20000' }
], (v) => {
  const A = L.sumLines(v.a), D = L.sumLines(v.l), a = A.sum, l = D.sum, bad = A.bad + D.bad;
  return big('Net worth', fx(a - l)) + rows([['Total assets', fx(a)], ['Total debts', fx(l)]]) + (bad ? `<div class="status">${bad} line${bad === 1 ? '' : 's'} without an amount at the end were ignored</div>` : '');
})] });

simple({ id: 'cagr', name: 'Growth Rate', icon: '🚀', desc: 'Compound annual growth rate between a start and end value over a number of years.', keys: ['cagr', 'return', 'annualised', 'growth', 'investment'], sections: [sec('', [
  [N('a', 'Start value', 10000, 0, 1e12), N('b', 'End value', 18000, 0, 1e12)], N('y', 'Years', 5, 0, 100)
], (v) => {
  if (!ok(v.a, v.b, v.y) || v.a <= 0 || v.b <= 0 || v.y <= 0) return null;
  return big('CAGR', sig(L.cagr(v.a, v.b, v.y), 6) + '% per year') + rows([['Total growth', sig((v.b / v.a - 1) * 100, 6) + '%'], ['Doubles in about', sig(Math.log(2) / Math.log(1 + L.cagr(v.a, v.b, v.y) / 100), 4) + ' years']].slice(0, L.cagr(v.a, v.b, v.y) > 0 ? 2 : 1));
})] });

simple({ id: 'numwords', name: 'Number Words', icon: '🔤', desc: 'Write a number in words using the Indian (lakh, crore) or international (million, billion) system.', keys: ['cheque', 'check', 'spell', 'amount in words', 'lakh', 'crore'], sections: [sec('', [
  N('n', 'Number (up to 999 trillion)', 1234567, -999999999999999, 999999999999999), S('s', 'System', [['in', 'Indian (lakh, crore)'], ['int', 'International']], 'in')
], (v) => {
  if (!Number.isFinite(v.n) || Math.abs(v.n) >= 1e15) return null;
  const sp = L.splitAmount(v.n), whole = sp.whole, frac = sp.frac, neg = sp.neg ? 'minus ' : '';
  let w = neg + L.words(whole, v.s === 'in');
  if (frac) w += ' and ' + L.words(frac, v.s === 'in') + ' hundredths';
  return `<div class="card" style="font-size:18px;line-height:1.5">${esc(w.charAt(0).toUpperCase() + w.slice(1))}</div>`;
})] });

})();
