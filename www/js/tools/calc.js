'use strict';
/* Calculators (category "calculate"). Everything is wrapped in one function so helper names do not leak into other tools.
   The block between PURE-START and PURE-END holds DOM-free maths; it is unit-tested in plain Node. */
(() => {
// ==PURE-START==
const L = {};
const p2 = (n) => String(n).padStart(2, '0');
L.gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a; };
L.lcm = (a, b) => (a && b ? Math.abs(a / L.gcd(a, b) * b) : 0);
L.fx = (n, d = 2) => (Number.isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
L.sig = (n, p = 10) => (Number.isFinite(n) ? n.toLocaleString(undefined, { maximumSignificantDigits: p, useGrouping: false }) : '—');
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
  const sub = L.r2(items.reduce((s, i) => s + (i.q || 0) * (i.p || 0), 0));
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
  inv.items.forEach((i, k) => out.push((k + 1) + '. ' + (i.d || 'Item') + '  ' + L.sig(i.q || 0) + ' x ' + m(i.p || 0) + ' = ' + m((i.q || 0) * (i.p || 0))));
  out.push('------------------------', 'Subtotal: ' + m(t.sub));
  if (t.disc) out.push('Discount' + (inv.dt === 'pct' ? ' (' + L.sig(inv.dv) + '%)' : '') + ': -' + m(t.disc));
  if (inv.tax) out.push('Tax (' + L.sig(inv.tax) + '%): ' + m(t.tax));
  out.push('TOTAL: ' + m(t.total));
  return out.join('\n');
};

/* ---- dates (day numbers = days since 1970-01-01, UTC, so DST never matters) ---- */
L.pd = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  return m && +m[1] >= 1000 ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5 : NaN;
};
L.ds = (n) => { const d = new Date(n * 864e5); return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate()); };
L.today = () => { const d = new Date(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5; };
L.dow = (n) => new Date(n * 864e5).getUTCDay();
L.DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const addM = (A, k) => {
  const mo = A.m + k, ty = A.y + Math.floor(mo / 12), tm = ((mo % 12) + 12) % 12;
  const dim = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return Date.UTC(ty, tm, Math.min(A.d, dim)) / 864e5;
};
L.ymd = (a, b) => { // a <= b, both day numbers
  const A = new Date(a * 864e5), B = new Date(b * 864e5);
  const S = { y: A.getUTCFullYear(), m: A.getUTCMonth(), d: A.getUTCDate() };
  let tm = (B.getUTCFullYear() - S.y) * 12 + (B.getUTCMonth() - S.m);
  if (addM(S, tm) > b) tm--;
  return { y: Math.floor(tm / 12), m: tm % 12, d: b - addM(S, tm) };
};
L.age = (dob, asof) => {
  const D = new Date(dob * 864e5), A = new Date(asof * 864e5);
  let next = Date.UTC(A.getUTCFullYear(), D.getUTCMonth(), D.getUTCDate()) / 864e5;
  if (next < asof) next = Date.UTC(A.getUTCFullYear() + 1, D.getUTCMonth(), D.getUTCDate()) / 864e5;
  return Object.assign(L.ymd(dob, asof), { days: asof - dob, next, nextIn: next - asof, turning: new Date(next * 864e5).getUTCFullYear() - D.getUTCFullYear() });
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
L.sumAmounts = (text) => {
  let s = 0;
  String(text).split('\n').forEach((line) => {
    const m = line.replace(/,/g, '').match(/-?\d*\.?\d+/g);
    if (m) s += parseFloat(m[m.length - 1]);
  });
  return s;
};

/* ---- fuel ---- */
L.kmPerL = (x, unit) => (unit === 'l100' ? 100 / x : unit === 'mpg' ? x * 1.609344 / 3.785411784 : x);

/* ---- marks / GPA ---- */
L.marks = (text, defMax) => {
  let got = 0, max = 0;
  String(text).split('\n').forEach((line) => {
    const m = /^\s*(\d*\.?\d+)\s*(?:\/\s*(\d*\.?\d+))?\s*$/.exec(line.replace(/,/g, '.'));
    if (m) { got += parseFloat(m[1]); max += m[2] ? parseFloat(m[2]) : defMax; }
  });
  return { got, max, pct: max ? got / max * 100 : NaN };
};
L.GRADE = { 'A+': 4, A: 4, 'A-': 3.7, 'B+': 3.3, B: 3, 'B-': 2.7, 'C+': 2.3, C: 2, 'C-': 1.7, 'D+': 1.3, D: 1, F: 0 };
L.gpa = (text) => {
  let pts = 0, cr = 0;
  String(text).split('\n').forEach((line) => {
    const m = /^\s*([A-Za-z][+-]?|\d*\.?\d+)\s+(\d*\.?\d+)\s*$/.exec(line);
    if (!m) return;
    const g = /\d/.test(m[1]) ? parseFloat(m[1]) : L.GRADE[m[1].toUpperCase()];
    if (g === undefined) return;
    pts += g * parseFloat(m[2]); cr += parseFloat(m[2]);
  });
  return { pts, cr, gpa: cr ? pts / cr : NaN };
};

/* ---- time ---- */
L.parseDur = (s) => { // seconds, or NaN. "1:30", "1:30:15", "2h 15m", "90m", "45s", "1.5h", plain number = minutes
  s = s.trim().toLowerCase();
  if (!s) return NaN;
  let m = /^(\d+):(\d{1,2})(?::(\d{1,2}))?$/.exec(s);
  if (m) return +m[1] * 3600 + +m[2] * 60 + (+m[3] || 0);
  m = /^(?:(\d*\.?\d+)\s*d)?\s*(?:(\d*\.?\d+)\s*h(?:rs?|ours?)?)?\s*(?:(\d*\.?\d+)\s*m(?:ins?)?)?\s*(?:(\d*\.?\d+)\s*s(?:ecs?)?)?$/.exec(s);
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
L.nums = (text) => String(text).split(/[\s,;]+/).map(parseFloat).filter(Number.isFinite);
L.stats = (a) => {
  const n = a.length, s = a.reduce((x, y) => x + y, 0), mean = s / n, so = a.slice().sort((x, y) => x - y);
  const median = n % 2 ? so[(n - 1) / 2] : (so[n / 2 - 1] + so[n / 2]) / 2;
  const cnt = new Map();
  a.forEach((v) => cnt.set(v, (cnt.get(v) || 0) + 1));
  const top = Math.max(...cnt.values());
  const mode = top > 1 ? [...cnt].filter((e) => e[1] === top).map((e) => e[0]).sort((x, y) => x - y) : [];
  const ss = a.reduce((x, y) => x + (y - mean) * (y - mean), 0);
  return { n, sum: s, mean, median, mode, min: so[0], max: so[n - 1], range: so[n - 1] - so[0], varP: ss / n, sdP: Math.sqrt(ss / n), varS: n > 1 ? ss / (n - 1) : NaN, sdS: n > 1 ? Math.sqrt(ss / (n - 1)) : NaN };
};
L.fr = (n, d) => { if (d < 0) { n = -n; d = -d; } const g = L.gcd(n, d) || 1; return { n: n / g, d: d / g }; };
L.pfrac = (s) => {
  s = String(s).trim().replace('−', '-');
  let m = /^(-?)(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(s);
  if (m) return +m[4] ? L.fr((m[1] ? -1 : 1) * (+m[2] * +m[4] + +m[3]), +m[4]) : null;
  m = /^(-?\d+)\s*\/\s*(-?\d+)$/.exec(s);
  if (m) return +m[2] ? L.fr(+m[1], +m[2]) : null;
  m = /^(-?)(\d*)\.?(\d*)$/.exec(s);
  if (m && (m[2] || m[3]) && m[3].length <= 9) { const k = Math.pow(10, m[3].length); return L.fr((m[1] ? -1 : 1) * Math.round(+(m[2] + m[3])), k); }
  return null;
};
L.fop = (a, b, op) => {
  if (op === '+') return L.fr(a.n * b.d + b.n * a.d, a.d * b.d);
  if (op === '-') return L.fr(a.n * b.d - b.n * a.d, a.d * b.d);
  if (op === '*') return L.fr(a.n * b.n, a.d * b.d);
  return b.n === 0 ? null : L.fr(a.n * b.d, a.d * b.n);
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
L.shoe = (sys, size) => { // approximate (Brannock-style)
  let cm;
  if (sys === 'cm') cm = size;
  else if (sys === 'eu') cm = size / 1.5 - 1.5;
  else { const usm = sys === 'usm' ? size : sys === 'uk' ? size + 1 : size - 1.5; cm = (usm + 22) / 3 * 2.54; }
  const usm = 3 * cm / 2.54 - 22;
  return { cm, eu: half((cm + 1.5) * 1.5), uk: half(usm - 1), usm: half(usm), usw: half(usm + 1.5) };
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
    while (peek() === '+' || peek() === '-') { const o = toks[p++].t; const r = term(); v = o === '+' ? v + r : v - r; }
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
const rows = (list) => list.map((r) => `<div class="item"><span class="grow muted">${esc(r[0])}</span><b style="text-align:right">${esc(r[1])}</b></div>`).join('');
const big = (label, value) => `<div class="center muted">${esc(label)}</div><div class="mid">${esc(value)}</div>`;
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
const buzz = (ms = 12) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ } };
const todayStr = () => L.ds(L.today());

function fieldHtml(f, val) {
  const lab = esc(f.l);
  if (f.t === 'select') return `<label class="f">${lab}<select data-k="${f.k}">${f.o.map((o) => `<option value="${esc(o[0])}"${String(o[0]) === String(val) ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select></label>`;
  if (f.t === 'textarea') return `<label class="f">${lab}<textarea data-k="${f.k}" rows="${f.rows || 4}" maxlength="3000" placeholder="${esc(f.p || '')}">${esc(val)}</textarea></label>`;
  const t = f.t || 'number';
  return `<label class="f">${lab}<input data-k="${f.k}" type="${t}" ${t === 'number' ? 'inputmode="decimal" step="any"' : 'maxlength="60"'} value="${esc(val)}" placeholder="${esc(f.p || '')}"></label>`;
}

/* Builds one card per section: fields -> live result. Returns a cleanup function. */
function multi(el, id, sections) {
  const saved = Store.get('calc.' + id, {});
  const values = {};
  const initial = (f, i) => (typeof saved[i + '.' + f.k] === 'string' && f.keep !== false ? saved[i + '.' + f.k] : typeof f.v === 'function' ? f.v() : f.v === undefined ? '' : f.v);
  el.innerHTML = sections.map((s, i) => `<div class="card list" data-s="${i}">${s.title ? `<b>${esc(s.title)}</b>` : ''}${s.note ? `<div class="muted" style="font-size:13px">${esc(s.note)}</div>` : ''}${s.fields.map((f) => (Array.isArray(f) ? `<div class="row">${f.map((g) => fieldHtml(g, initial(g, i))).join('')}</div>` : fieldHtml(f, initial(f, i)))).join('')}<div class="list" data-r></div></div>`).join('');
  const read = (card) => {
    const v = {};
    $$('[data-k]', card).forEach((x) => { v[x.dataset.k] = x.type === 'number' ? parseFloat(x.value) : x.value; });
    return v;
  };
  const run = (i) => {
    const card = $$('.card', el)[i], out = $('[data-r]', card), v = read(card);
    let html = null;
    try { html = sections[i].calc(v); } catch (e) { html = null; }
    out.innerHTML = html || '<div class="muted center" style="font-size:13px">Enter the values above.</div>';
    return v;
  };
  const all = () => sections.forEach((s, i) => run(i));
  el.addEventListener('input', (e) => {
    const card = e.target.closest && e.target.closest('.card');
    if (!card) return;
    run(+card.dataset.s);
    const s = Store.get('calc.' + id, {}), keep = sections[+card.dataset.s].fields.flat().filter((f) => f.keep !== false).map((f) => f.k);
    $$('[data-k]', card).forEach((x) => { if (keep.includes(x.dataset.k)) s[card.dataset.s + '.' + x.dataset.k] = x.value; });
    Store.set('calc.' + id, s);
  });
  all();
}
const simple = (def) => reg({ id: def.id, name: def.name, icon: def.icon, desc: def.desc, keys: def.keys, needs: def.needs || [], render(el) { multi(el, def.id, def.sections); } });
const sec = (title, fields, calc, note) => ({ title, fields, calc, note });
const N = (k, l, v, p) => ({ k, l, v, p });
const S = (k, l, o, v) => ({ k, l, t: 'select', o, v });
const ok = L.ok;

/* ================= 1. EMI ================= */
simple({ id: 'emi', name: 'EMI Calculator', icon: '🏦', desc: 'Monthly loan instalment, total interest and the first 12 months of the repayment schedule.', keys: ['loan', 'mortgage', 'interest', 'instalment', 'amortisation'], sections: [sec('', [
  N('p', 'Loan amount', 500000), [N('r', 'Interest % per year', 8.5), N('t', 'Tenure', 5)], S('u', 'Tenure in', [['y', 'Years'], ['m', 'Months']], 'y')
], (v) => {
  const n = Math.round(v.u === 'y' ? v.t * 12 : v.t);
  if (!ok(v.p, v.r, n) || v.p <= 0 || n < 1 || n > 1200 || v.r < 0) return null;
  const e = L.emi(v.p, v.r, n), total = e * n;
  const sch = L.schedule(v.p, v.r, n, 12);
  return big('Monthly EMI', fx(e)) + rows([['Total interest', fx(total - v.p)], ['Total payment', fx(total)], ['Months', String(n)]]) +
    '<b style="margin-top:6px">First 12 months</b>' + table(['Mo', 'Principal', 'Interest', 'Balance'], sch.map((r) => [r.m, fx(r.principal), fx(r.interest), fx(r.balance)]));
})] });

/* ================= 2. Billing ================= */
reg({ id: 'billing', name: 'Billing', icon: '📃', desc: 'Make an invoice with line items, tax and discount, save the last 20 and share or copy it as text.', keys: ['invoice', 'bill', 'receipt', 'gst', 'quotation'], needs: ['storage'], render(el) {
  let items = [{ d: '', q: 1, p: 0 }], editing = null;
  const meta = Object.assign({ biz: '', cur: '', tax: 0, dt: 'pct', dv: 0 }, Store.get('billing.meta', {}));
  let cust = '';
  el.innerHTML = `<div class="card list">
    <label class="f">Your business name<input id="biz" type="text" maxlength="60" value="${esc(meta.biz)}"></label>
    <div class="row"><label class="f">Customer<input id="cust" type="text" maxlength="60"></label><label class="f">Currency symbol<input id="cur" type="text" maxlength="4" value="${esc(meta.cur)}" placeholder="optional"></label></div>
    <b>Items</b><div class="list" id="items"></div>
    <button class="btn alt" id="add">+ Add item</button>
    <div class="row"><label class="f">Tax %<input id="tax" type="number" inputmode="decimal" step="any" value="${esc(meta.tax)}"></label>
    <label class="f">Discount<input id="dv" type="number" inputmode="decimal" step="any" value="${esc(meta.dv)}"></label>
    <label class="f">Type<select id="dt"><option value="pct">%</option><option value="amt">Amount</option></select></label></div>
    <div class="list" id="tot"></div>
    <div class="row"><button class="btn" id="save">Save</button><button class="btn alt" id="copy">Copy</button><button class="btn alt" id="share">Share</button></div>
    <button class="btn alt" id="new">New invoice</button></div>
    <b>Saved invoices (last 20)</b><div class="list" id="saved"></div>`;
  $('#dt', el).value = meta.dt;
  const num = (id) => Math.max(0, parseFloat($('#' + id, el).value) || 0);
  const cur = () => ({ biz: $('#biz', el).value.trim(), cur: $('#cur', el).value.trim(), tax: Math.min(100, num('tax')), dt: $('#dt', el).value, dv: num('dv') });
  const clean = () => items.filter((i) => i.d.trim() || i.p * i.q);
  const totals = () => L.invoice(items, cur().tax, cur().dt, cur().dv);
  const drawItems = () => {
    $('#items', el).innerHTML = items.map((it, i) => `<div class="item" style="flex-wrap:wrap"><input data-i="${i}" data-f="d" type="text" maxlength="60" placeholder="Item" aria-label="Item name" value="${esc(it.d)}" style="flex:1 1 100%">
      <input data-i="${i}" data-f="q" type="number" inputmode="decimal" step="any" aria-label="Quantity" placeholder="Qty" value="${esc(it.q)}" style="flex:1 1 70px">
      <input data-i="${i}" data-f="p" type="number" inputmode="decimal" step="any" aria-label="Price" placeholder="Price" value="${esc(it.p)}" style="flex:2 1 100px">
      <button class="btn alt" data-rm="${i}" aria-label="Remove item" style="flex:0 0 44px;padding:12px 0">✕</button></div>`).join('');
  };
  const drawTot = () => {
    const t = totals(), c = cur().cur;
    $('#tot', el).innerHTML = rows([['Subtotal', c + fx(t.sub)], ['Discount', '-' + c + fx(t.disc)], ['Tax', c + fx(t.tax)]]) + `<div class="center muted">Total</div><div class="mid">${esc(c + fx(t.total))}</div>`;
  };
  const record = () => {
    const c = cur(), list = Store.get('billing.list', []);
    let no = editing ? (list.find((x) => x.id === editing) || {}).no : null;
    if (!no) { no = Store.get('billing.next', 1); }
    return { id: editing || Date.now(), no, date: todayStr(), biz: c.biz, cust: $('#cust', el).value.trim(), cur: c.cur, items: clean().map((i) => ({ d: i.d.trim(), q: i.q, p: i.p })), tax: c.tax, dt: c.dt, dv: c.dv };
  };
  const text = () => L.invoiceText(record());
  const drawSaved = () => {
    const list = Store.get('billing.list', []);
    $('#saved', el).innerHTML = list.length ? list.map((x) => `<div class="item"><div class="grow"><b>#${esc(x.no)} ${esc(x.cust || 'No name')}</b><div class="muted" style="font-size:13px">${esc(x.date)} · ${esc(x.cur + fx(L.invoice(x.items, x.tax, x.dt, x.dv).total))}</div></div>
      <button class="btn alt" data-view="${x.id}" aria-label="View invoice">View</button><button class="btn alt" data-sh="${x.id}" aria-label="Share invoice">📤</button><button class="btn danger" data-del="${x.id}" aria-label="Delete invoice">✕</button></div>`).join('') : '<div class="muted center">Nothing saved yet.</div>';
  };
  const persistMeta = () => { const c = cur(); Store.set('billing.meta', { biz: c.biz, cur: c.cur, tax: c.tax, dt: c.dt, dv: c.dv }); };
  el.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.i !== undefined) { const it = items[+t.dataset.i]; it[t.dataset.f] = t.dataset.f === 'd' ? t.value : Math.max(0, parseFloat(t.value) || 0); }
    drawTot(); persistMeta();
  });
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'add') { if (items.length >= 50) { toast('Max 50 items'); return; } items.push({ d: '', q: 1, p: 0 }); drawItems(); drawTot(); return; }
    if (b.dataset.rm !== undefined) { items.splice(+b.dataset.rm, 1); if (!items.length) items.push({ d: '', q: 1, p: 0 }); drawItems(); drawTot(); return; }
    if (b.id === 'copy') { copyText(text()); return; }
    if (b.id === 'share') { shareText('Invoice', text()); return; }
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
    <div class="row"><label class="f">From<input id="a" type="date" value="${L.ds(t)}"></label><label class="f">To<input id="b" type="date" value="${L.ds(t + 30)}"></label></div><div class="list" id="r1"></div></div>
    <div class="card list"><b>Add or subtract days</b>
    <div class="row"><label class="f">Start<input id="s" type="date" value="${L.ds(t)}"></label><label class="f">Days<input id="n" type="number" inputmode="numeric" value="30"></label></div>
    <div class="row"><button class="btn" id="plus">Add</button><button class="btn alt" id="minus">Subtract</button></div><div class="list" id="r2"></div></div>
    <div class="card list"><b>Countdown to events</b>
    <div class="row"><label class="f">Event name<input id="en" type="text" maxlength="40"></label><label class="f">Date<input id="ed" type="date" value="${L.ds(t + 7)}"></label></div>
    <button class="btn" id="ea">Save event</button><div class="list" id="ev"></div></div>`;
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  const r1 = () => {
    const a = L.pd($('#a', el).value), b = L.pd($('#b', el).value);
    if (!ok(a, b)) { $('#r1', el).innerHTML = '<div class="muted center">Pick both dates.</div>'; return; }
    const lo = Math.min(a, b), hi = Math.max(a, b), d = hi - lo, y = L.ymd(lo, hi);
    $('#r1', el).innerHTML = big(b < a ? 'Days (To is earlier)' : 'Days', String(d)) + rows([['Weeks', Math.floor(d / 7) + ' w ' + (d % 7) + ' d'], ['Years, months, days', y.y + 'y ' + y.m + 'm ' + y.d + 'd'], ['Total weeks', sig(d / 7, 5)], ['Total hours', fx(d * 24, 0)]]);
  };
  const r2 = (sign) => {
    const s = L.pd($('#s', el).value), n = Math.round(parseFloat($('#n', el).value));
    if (!ok(s, n)) { $('#r2', el).innerHTML = '<div class="muted center">Enter a date and number of days.</div>'; return; }
    const r = s + sign * n;
    $('#r2', el).innerHTML = big(sign > 0 ? 'Date after' : 'Date before', L.ds(r)) + `<div class="center muted">${L.DAYS[L.dow(r)]}</div>`;
  };
  const events = () => Store.get('days.events', []);
  const drawEv = () => {
    const list = events().slice().sort((x, y) => L.pd(x.d) - L.pd(y.d)), now = L.today();
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
  r1(); r2(1); drawEv();
} });

/* ================= 4. Tally counter ================= */
reg({ id: 'tally', name: 'Tally Counter', icon: '🔘', desc: 'Big plus and minus buttons with a step size, and several named counters that are saved on the device.', keys: ['count', 'counter', 'clicker', 'tap', 'number counter'], needs: ['storage'], render(el) {
  const st = Object.assign({ list: [{ n: 'Counter 1', v: 0 }], sel: 0, step: 1 }, Store.get('tally.state', {}));
  if (!st.list.length) st.list = [{ n: 'Counter 1', v: 0 }];
  st.sel = Math.min(st.sel, st.list.length - 1);
  let armed = null, armT = null;
  el.innerHTML = `<div class="card"><div class="center muted" id="nm"></div><div class="big" id="v" style="font-size:72px"></div>
    <div class="row"><button class="btn alt" id="minus" aria-label="Subtract" style="min-height:96px;font-size:44px">−</button><button class="btn" id="plus" aria-label="Add" style="min-height:96px;font-size:44px">+</button></div></div>
    <div class="row"><label class="f">Step<input id="step" type="number" inputmode="numeric" min="1" value="${esc(st.step)}"></label><button class="btn alt" id="reset" style="align-self:flex-end">Reset</button></div>
    <div class="card list"><b>Counters</b><div class="list" id="list"></div>
    <div class="row"><input id="newn" type="text" maxlength="30" placeholder="New counter name" aria-label="New counter name"><button class="btn" id="addc" style="flex:0 0 auto">Add</button></div></div>`;
  const save = () => Store.set('tally.state', st);
  const draw = () => {
    const c = st.list[st.sel];
    $('#nm', el).textContent = c.n; $('#v', el).textContent = c.v;
    $('#list', el).innerHTML = st.list.map((x, i) => `<div class="item" data-sel="${i}" role="button" tabindex="0" style="${i === st.sel ? 'border-color:var(--accent)' : ''}"><span class="grow">${esc(x.n)}</span><b>${esc(x.v)}</b>${st.list.length > 1 ? `<button class="btn danger" data-del="${i}" aria-label="Delete counter">✕</button>` : ''}</div>`).join('');
  };
  const stepV = () => Math.max(1, Math.min(1e6, Math.round(parseFloat($('#step', el).value) || 1)));
  const disarm = () => { armed = null; clearTimeout(armT); };
  const arm = (what, msg) => { if (armed === what) { disarm(); return true; } armed = what; clearTimeout(armT); armT = setTimeout(() => { armed = null; }, 3000); toast(msg); return false; };
  el.addEventListener('input', (e) => { if (e.target.id === 'step') { st.step = stepV(); save(); } });
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button'), c = st.list[st.sel];
    if (b && (b.id === 'plus' || b.id === 'minus')) { c.v += (b.id === 'plus' ? 1 : -1) * stepV(); buzz(12); save(); draw(); return; }
    if (b && b.id === 'reset') { if (arm('reset', 'Tap Reset again to confirm')) { c.v = 0; buzz(30); save(); draw(); } return; }
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
    <div class="row"><label class="f">Min<input id="mn" type="number" inputmode="numeric" value="1"></label><label class="f">Max<input id="mx" type="number" inputmode="numeric" value="100"></label><label class="f">How many<input id="cnt" type="number" inputmode="numeric" value="1" min="1"></label></div>
    <label class="item"><input id="nr" type="checkbox" style="width:22px;height:22px;flex:0 0 auto"><span class="grow">No repeats until all are drawn</span></label>
    <button class="btn" id="gn">Draw</button><div class="mid" id="rn" style="word-break:break-word"></div><button class="btn alt" id="rst">Reset no-repeat list</button></div>
    <div class="card list"><b>Pick or shuffle a list</b><label class="f">One item per line<textarea id="li" rows="5" maxlength="3000" placeholder="Anna&#10;Ben&#10;Chloe"></textarea></label>
    <div class="row"><button class="btn" id="pk">Pick one</button><button class="btn alt" id="sh">Shuffle</button></div><div class="mid" id="rl" style="word-break:break-word"></div></div>
    <div class="card list"><b>Random date</b><div class="row"><label class="f">From<input id="d1" type="date" value="${L.ds(L.today())}"></label><label class="f">To<input id="d2" type="date" value="${L.ds(L.today() + 365)}"></label></div>
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
  sec('What is X% of Y?', [[N('x', 'X (%)', 15), N('y', 'Y', 200)]], (v) => ok(v.x, v.y) ? big('Result', sig(v.x * v.y / 100)) : null),
  sec('X is what % of Y?', [[N('x', 'X', 30), N('y', 'Y', 120)]], (v) => ok(v.x, v.y) && v.y !== 0 ? big('Percentage', sig(v.x / v.y * 100) + '%') : null),
  sec('Percent change', [[N('a', 'From', 80), N('b', 'To', 100)]], (v) => { if (!ok(v.a, v.b) || v.a === 0) return null; const c = L.pctChange(v.a, v.b); return big(c >= 0 ? 'Increase' : 'Decrease', sig(Math.abs(c), 8) + '%'); }),
  sec('Add or subtract a percentage', [[N('v', 'Value', 250), N('p', 'Percent', 12)]], (v) => ok(v.v, v.p) ? rows([['Plus ' + sig(v.p) + '%', sig(v.v * (1 + v.p / 100))], ['Minus ' + sig(v.p) + '%', sig(v.v * (1 - v.p / 100))], ['The percent itself', sig(v.v * v.p / 100)]]) : null)
] });

/* ================= 7. Discount & GST ================= */
simple({ id: 'gst', name: 'Discount & GST', icon: '🔖', desc: 'Final price after discount and tax (GST or VAT), tax inclusive or exclusive, with the amount you save.', keys: ['sale', 'vat', 'tax', 'price', 'offer', 'off'], sections: [sec('', [
  N('p', 'Price', 1000), [N('d', 'Discount %', 10), N('t', 'Tax % (GST/VAT)', 18)], S('m', 'Entered price is', [['ex', 'Without tax (add tax)'], ['in', 'Including tax (split it)']], 'ex')
], (v) => {
  if (!ok(v.p, v.d, v.t) || v.p < 0 || v.d < 0 || v.d > 100 || v.t < 0) return null;
  const r = L.gst(v.p, v.d, v.t, v.m === 'in');
  return big('Final price', fx(r.final)) + rows([['You save', fx(r.saving)], ['Price after discount', fx(r.after)], ['Price before tax', fx(r.base)], ['Tax amount', fx(r.tax)]]);
})] });

/* ================= 8. Tip ================= */
simple({ id: 'tip', name: 'Tip Splitter', icon: '🍽️', desc: 'Split a bill between friends with a tip, optionally rounding each share up.', keys: ['bill', 'split', 'restaurant', 'gratuity'], sections: [sec('', [
  N('b', 'Bill amount', 1200), [N('t', 'Tip %', 10), N('n', 'People', 4)], S('r', 'Rounding', [['no', 'Exact'], ['up', 'Round each share up']], 'no')
], (v) => {
  const n = Math.round(v.n);
  if (!ok(v.b, v.t, n) || v.b < 0 || v.t < 0 || n < 1 || n > 1000) return null;
  const r = L.tip(v.b, v.t, n, v.r === 'up');
  return big('Each person pays', fx(r.per)) + rows([['Tip total', fx(r.tip)], ['Total with tip', fx(r.total)], ['Bill share (no tip)', fx(r.billPer)]]);
})] });

/* ================= 9. Age ================= */
simple({ id: 'age', name: 'Age Calculator', icon: '🎈', desc: 'Exact age in years, months and days, total days lived and the countdown to the next birthday.', keys: ['birthday', 'dob', 'born', 'years old'], sections: [sec('', [
  { k: 'dob', l: 'Date of birth', t: 'date', v: '1995-06-15' }, { k: 'on', l: 'Age on', t: 'date', v: todayStr, keep: false }
], (v) => {
  const a = L.pd(v.dob), b = L.pd(v.on);
  if (!ok(a, b) || b < a) return null;
  const r = L.age(a, b);
  return big('Age', r.y + ' years ' + r.m + ' months ' + r.d + ' days') + rows([['Total days lived', fx(r.days, 0)], ['Total weeks', fx(Math.floor(r.days / 7), 0)], ['Total months', fx(r.y * 12 + r.m, 0)], ['Born on a', L.DAYS[L.dow(a)]],
    ['Next birthday', r.nextIn === 0 ? 'Today! Turning ' + r.turning : r.nextIn + ' days (' + L.DAYS[L.dow(r.next)] + ', turning ' + r.turning + ')']]);
})] });

/* ================= 10. Investment ================= */
simple({ id: 'invest', name: 'Investment', icon: '🌱', desc: 'Compound interest on a lump sum, and the future value of a monthly SIP, with a year-by-year growth table.', keys: ['sip', 'compound', 'savings', 'mutual fund', 'returns'], sections: [
  sec('Lump sum (compound interest)', [N('p', 'Amount invested', 100000), [N('r', 'Return % per year', 8), N('y', 'Years', 10)], S('n', 'Compounded', [[1, 'Yearly'], [2, 'Half-yearly'], [4, 'Quarterly'], [12, 'Monthly']], 1)], (v) => {
    const n = +v.n, y = Math.round(v.y);
    if (!ok(v.p, v.r, y) || v.p <= 0 || v.r < 0 || y < 1 || y > 100) return null;
    const fv = L.compound(v.p, v.r, y, n), body = [];
    for (let i = 1; i <= y; i++) body.push([i, fx(L.compound(v.p, v.r, i, n), 0), fx(L.compound(v.p, v.r, i, n) - v.p, 0)]);
    return big('Final value', fx(fv)) + rows([['Interest earned', fx(fv - v.p)], ['Growth', sig((fv / v.p - 1) * 100, 6) + '%']]) + table(['Year', 'Value', 'Gain'], body);
  }),
  sec('Monthly SIP', [N('m', 'Monthly investment', 5000), [N('r', 'Return % per year', 12), N('y', 'Years', 10)]], (v) => {
    const y = Math.round(v.y);
    if (!ok(v.m, v.r, y) || v.m <= 0 || v.r < 0 || y < 1 || y > 60) return null;
    const fv = L.sip(v.m, v.r, y * 12), inv = v.m * y * 12, body = [];
    for (let i = 1; i <= y; i++) body.push([i, fx(v.m * 12 * i, 0), fx(L.sip(v.m, v.r, i * 12), 0)]);
    return big('Future value', fx(fv)) + rows([['Total invested', fx(inv)], ['Estimated gain', fx(fv - inv)]]) + table(['Year', 'Invested', 'Value'], body) + '<div class="muted" style="font-size:12px">Each instalment is invested at the start of the month. Returns are not guaranteed.</div>';
  })
] });

/* ================= 11. Scientific ================= */
reg({ id: 'sci', name: 'Scientific', icon: '🔬', desc: 'Scientific calculator with brackets, trig in degrees or radians, logs, roots, powers, factorial and memory keys.', keys: ['sin', 'cos', 'tan', 'log', 'sqrt', 'calculator', 'factorial', 'scientific'], needs: [], render(el) {
  let deg = true, mem = 0, ans = 0, shown = false;
  const layout = [['DEG', 'MC', 'MR', 'M+', 'M−'], ['sin', 'cos', 'tan', 'ln', 'log'], ['asin', 'acos', 'atan', '√', '^'], ['(', ')', '!', 'π', 'e'], ['7', '8', '9', '÷', '⌫'], ['4', '5', '6', '×', 'AC'], ['1', '2', '3', '−', 'Ans'], ['0', '.', '%', '+', '=']];
  el.innerHTML = `<div class="card"><div class="muted" id="st" style="min-height:20px;font-size:13px"></div>
    <input id="ex" type="text" inputmode="none" autocomplete="off" aria-label="Expression" maxlength="200" style="font-size:24px;text-align:right">
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
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]');
    if (!b) return;
    const k = b.dataset.k;
    buzz(8);
    if (k === 'DEG') deg = !deg;
    else if (k === 'AC') { ex.value = ''; shown = false; }
    else if (k === '⌫') { const a = ex.selectionStart == null ? ex.value.length : ex.selectionStart; if (a > 0) { ex.value = ex.value.slice(0, a - 1) + ex.value.slice(ex.selectionEnd == null ? a : ex.selectionEnd); try { ex.setSelectionRange(a - 1, a - 1); } catch (er) { /* ignore */ } } }
    else if (k === '=') { shown = true; const r = preview(); if (r !== null) { ans = r; ex.value = sig(r, 12); shown = false; $('#rs', el).textContent = ''; } }
    else if (k === 'MC') mem = 0;
    else if (k === 'MR') ins(sig(mem, 12));
    else if (k === 'M+' || k === 'M−') { const r = preview(); const v = r !== null ? r : ex.value.trim() ? null : ans; if (v === null) toast('Fix the expression first'); else mem += k === 'M+' ? v : -v; }
    else if (FN.includes(k)) ins(k + '(');
    else ins(k === 'Ans' ? 'Ans' : k);
    status(); if (k !== '=') { shown = false; preview(); }
  });
  ex.addEventListener('input', () => { shown = false; preview(); });
  ex.addEventListener('keydown', (e) => { if (e.key === 'Enter') { shown = true; const r = preview(); if (r !== null) { ans = r; ex.value = sig(r, 12); shown = false; $('#rs', el).textContent = ''; } } });
  status();
} });

/* ================= more calculators ================= */
simple({ id: 'fuel', name: 'Fuel Cost', icon: '⛽', desc: 'Trip fuel and cost from distance, mileage and fuel price, plus mileage from a fill-up.', keys: ['petrol', 'diesel', 'mileage', 'mpg', 'trip', 'km/l'], sections: [
  sec('Trip cost', [N('d', 'Distance (km)', 250), [N('e', 'Efficiency', 15), S('u', 'Unit', [['kmpl', 'km/L'], ['l100', 'L/100 km'], ['mpg', 'mpg (US)']], 'kmpl')], N('p', 'Fuel price per litre', 100)], (v) => {
    const k = L.kmPerL(v.e, v.u);
    if (!ok(v.d, k, v.p) || v.d < 0 || k <= 0 || v.p < 0) return null;
    const lit = v.d / k;
    return big('Trip cost', fx(lit * v.p)) + rows([['Fuel needed', fx(lit) + ' L'], ['Cost per km', fx(lit * v.p / (v.d || 1))], ['Efficiency', fx(k) + ' km/L = ' + fx(100 / k) + ' L/100km']]);
  }),
  sec('Find my mileage', [[N('d', 'Distance driven (km)', 420), N('f', 'Fuel used (litres)', 30)]], (v) => ok(v.d, v.f) && v.d > 0 && v.f > 0 ? big('Mileage', fx(v.d / v.f) + ' km/L') + rows([['L per 100 km', fx(100 * v.f / v.d)], ['Miles per US gallon', fx(v.d / v.f * 3.785411784 / 1.609344)]]) : null)
] });

simple({ id: 'marks', name: 'Marks & GPA', icon: '🎓', desc: 'Total marks and percentage from subject scores, and weighted GPA from grades and credits.', keys: ['percentage', 'grade', 'gpa', 'exam', 'score', 'cgpa'], sections: [
  sec('Percentage', [{ k: 'm', l: 'Marks, one subject per line (85 or 42/50)', t: 'textarea', rows: 5, v: '85\n72\n91\n42/50' }, N('x', 'Default maximum per subject', 100)], (v) => {
    const r = L.marks(v.m, v.x);
    if (!(r.max > 0)) return null;
    const p = r.pct, g = p >= 90 ? 'A+' : p >= 80 ? 'A' : p >= 70 ? 'B' : p >= 60 ? 'C' : p >= 50 ? 'D' : p >= 40 ? 'E' : 'F';
    return big('Percentage', sig(p, 5) + '%') + rows([['Total', sig(r.got) + ' / ' + sig(r.max)], ['Grade (typical scale)', g]]);
  }),
  sec('GPA', [{ k: 'g', l: 'One per line: grade (A, B+, ...) or points, then credits', t: 'textarea', rows: 5, v: 'A 4\nB+ 3\n3.5 2' }], (v) => {
    const r = L.gpa(v.g);
    return r.cr > 0 ? big('GPA', fx(r.gpa)) + rows([['Total credits', sig(r.cr)], ['Grade points', sig(r.pts, 6)]]) + '<div class="muted" style="font-size:12px">Letters use a 4.0 scale (A 4.0, B 3.0 ...).</div>' : null;
  })
] });

simple({ id: 'timecalc', name: 'Time Calc', icon: '🕒', desc: 'Add and subtract durations such as 1:30 or 2h 15m, and work out hours between two clock times.', keys: ['hours', 'minutes', 'duration', 'timesheet', 'shift', 'add time'], sections: [
  sec('Add and subtract durations', [{ k: 't', l: 'One per line. Start with - to subtract. Formats: 1:30, 2h 15m, 90m, 45s', t: 'textarea', rows: 5, v: '1:30\n2h 15m\n-0:45' }], (v) => {
    const r = L.sumDurs(v.t);
    return big('Total', L.fmtDur(r.total)) + rows([['Decimal hours', sig(r.total / 3600, 6)], ['Minutes', sig(r.total / 60, 8)]]) + (r.bad ? `<div class="status">${r.bad} line(s) not understood</div>` : '');
  }),
  sec('Hours between two times', [[{ k: 'a', l: 'Start', t: 'time', v: '09:00' }, { k: 'b', l: 'End', t: 'time', v: '17:30' }], N('k', 'Unpaid break (minutes)', 30)], (v) => {
    if (!v.a || !v.b) return null;
    const m = L.tdiff(v.a, v.b, Math.max(0, v.k || 0));
    return m < 0 ? '<div class="status">Break is longer than the shift.</div>' : big('Worked', L.fmtDur(m * 60)) + rows([['Decimal hours', sig(m / 60, 5)]]) + (v.b <= v.a ? '<div class="muted center">Shift passes midnight.</div>' : '');
  })
] });

simple({ id: 'workdays', name: 'Work Days', icon: '💼', desc: 'Add working days to a date, or count working days between two dates, skipping weekends.', keys: ['business days', 'deadline', 'weekdays', 'working days'], sections: [
  sec('Date after N working days', [[{ k: 's', l: 'Start', t: 'date', v: todayStr, keep: false }, N('n', 'Working days', 10)], S('w', 'Weekend', [['0,6', 'Sat + Sun'], ['5,6', 'Fri + Sat'], ['0', 'Sun only']], '0,6')], (v) => {
    const s = L.pd(v.s), n = Math.round(v.n);
    if (!ok(s, n) || Math.abs(n) > 20000) return null;
    const wk = v.w.split(',').map(Number), r = L.addWork(s, n, wk);
    return big('Date', L.ds(r)) + `<div class="center muted">${L.DAYS[L.dow(r)]} (${r - s} calendar days)</div>`;
  }),
  sec('Working days between dates', [[{ k: 'a', l: 'From', t: 'date', v: todayStr, keep: false }, { k: 'b', l: 'To', t: 'date', v: () => L.ds(L.today() + 30), keep: false }], S('w', 'Weekend', [['0,6', 'Sat + Sun'], ['5,6', 'Fri + Sat'], ['0', 'Sun only']], '0,6')], (v) => {
    const a = L.pd(v.a), b = L.pd(v.b);
    if (!ok(a, b) || b < a || b - a > 36500) return null;
    return big('Working days (both dates included)', String(L.countWork(a, b, v.w.split(',').map(Number)))) + rows([['Calendar days', String(b - a + 1)]]);
  })
] });

simple({ id: 'pay', name: 'Salary Convert', icon: '💵', desc: 'Convert pay between hourly, daily, weekly, monthly and yearly amounts.', keys: ['hourly', 'wage', 'annual', 'income', 'salary', 'ctc'], sections: [sec('', [
  [N('a', 'Amount', 25), S('u', 'Per', [['hour', 'Hour'], ['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year']], 'hour')], [N('h', 'Hours per week', 40), N('w', 'Weeks per year', 52)], N('d', 'Days per week', 5)
], (v) => {
  if (!ok(v.a, v.h, v.w, v.d) || v.h <= 0 || v.w <= 0 || v.d <= 0) return null;
  const r = L.pay(v.a, v.u, v.h, v.w, v.d);
  return big('Per year', fx(r.year)) + rows([['Per month', fx(r.month)], ['Per 2 weeks', fx(r.biweek)], ['Per week', fx(r.week)], ['Per day', fx(r.day)], ['Per hour', fx(r.hour)]]);
})] });

simple({ id: 'loancmp', name: 'Loan Compare', icon: '🆚', desc: 'Compare two loan offers side by side: EMI, total interest and total cost.', keys: ['emi', 'loan', 'compare', 'mortgage', 'offer'], sections: [sec('', [
  N('p', 'Loan amount (both)', 1000000), [N('r1', 'Offer A rate %', 9), N('n1', 'A months', 120)], [N('r2', 'Offer B rate %', 8.5), N('n2', 'B months', 144)]
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
    $('#r', el).innerHTML = r ? big('Result', L.fstr(r)) + rows([['Mixed number', L.fmixed(r)], ['Decimal', sig(r.n / r.d, 10)], ['Percent', sig(r.n / r.d * 100, 8) + '%']]) : '<div class="status">Cannot divide by zero.</div>';
  };
  el.addEventListener('input', run); run();
} });

simple({ id: 'ratio', name: 'Ratio', icon: '⚗️', desc: 'Simplify a ratio, solve a proportion (a : b = c : x) and split an amount in a ratio.', keys: ['proportion', 'divide in ratio', 'simplify', 'scale'], sections: [
  sec('Simplify a : b', [[N('a', 'A', 24), N('b', 'B', 36)]], (v) => { if (!ok(v.a, v.b) || !Number.isInteger(v.a) || !Number.isInteger(v.b) || !v.a || !v.b) return v.a === 0 || v.b === 0 ? null : '<div class="muted center">Use whole numbers.</div>'; const g = L.gcd(v.a, v.b); return big('Simplest form', v.a / g + ' : ' + v.b / g) + rows([['Decimal (a / b)', sig(v.a / v.b, 8)]]); }),
  sec('Proportion  a : b = c : x', [[N('a', 'a', 3), N('b', 'b', 5)], N('c', 'c', 12)], (v) => ok(v.a, v.b, v.c) && v.a !== 0 ? big('x', sig(v.b * v.c / v.a, 10)) : null),
  sec('Split an amount', [N('t', 'Total', 1000), [N('a', 'Share A', 2), N('b', 'Share B', 3)]], (v) => ok(v.t, v.a, v.b) && v.a + v.b > 0 && v.a >= 0 && v.b >= 0 ? rows([['A gets', fx(v.t * v.a / (v.a + v.b))], ['B gets', fx(v.t * v.b / (v.a + v.b))]]) : null)
] });

simple({ id: 'stats', name: 'Statistics', icon: '📉', desc: 'Mean, median, mode, range, variance and standard deviation of a list of numbers.', keys: ['average', 'mean', 'median', 'mode', 'deviation', 'variance'], sections: [sec('', [{ k: 'n', l: 'Numbers (spaces, commas or new lines)', t: 'textarea', rows: 4, v: '4, 8, 15, 16, 23, 42, 8' }], (v) => {
  const a = L.nums(v.n);
  if (!a.length || a.length > 5000) return null;
  const s = L.stats(a);
  return big('Mean', sig(s.mean, 10)) + rows([['Count', String(s.n)], ['Sum', sig(s.sum, 12)], ['Median', sig(s.median, 10)], ['Mode', s.mode.length ? s.mode.map((x) => sig(x)).join(', ') : 'none'], ['Min / Max', sig(s.min) + ' / ' + sig(s.max)], ['Range', sig(s.range, 10)],
    ['Std dev (population)', sig(s.sdP, 8)], ['Std dev (sample)', sig(s.sdS, 8)], ['Variance (sample)', sig(s.varS, 8)]]);
})] });

simple({ id: 'prime', name: 'Prime Check', icon: '🔍', desc: 'Check whether a number is prime, see its prime factors and divisors, and find the nearest primes.', keys: ['factor', 'factorisation', 'divisors', 'prime number'], sections: [sec('', [N('n', 'Whole number (up to 9,000,000,000,000,000)', 360)], (v) => {
  const n = v.n;
  if (!Number.isInteger(n) || n < 2 || n > 9e15) return null;
  const f = L.factor(n), pr = f.length === 1 && f[0][1] === 1;
  const out = [[pr ? 'Prime?' : 'Prime?', pr ? 'Yes, prime' : 'No, composite'], ['Prime factors', pr ? String(n) : f.map((x) => x[1] > 1 ? x[0] + '^' + x[1] : x[0]).join(' × ')]];
  if (n <= 1e9) { const d = L.divisors(n); out.push(['Divisors (' + d.length + ')', d.length > 40 ? d.slice(0, 40).join(', ') + ' ...' : d.join(', ')]); }
  if (n < 9e15 - 1000) out.push(['Next prime', String(L.nextPrime(n))]);
  const pp = L.prevPrime(n); if (pp) out.push(['Previous prime', String(pp)]);
  return rows(out);
})] });

simple({ id: 'gcdlcm', name: 'GCD & LCM', icon: '🧩', desc: 'Greatest common divisor and least common multiple of two or more whole numbers.', keys: ['hcf', 'gcf', 'lcm', 'multiple', 'common factor'], sections: [sec('', [{ k: 'n', l: 'Whole numbers (spaces or commas)', t: 'text', v: '12, 18, 30' }], (v) => {
  const a = L.nums(v.n).map(Math.abs);
  if (a.length < 2 || a.length > 30 || a.some((x) => !Number.isInteger(x) || x === 0 || x > 1e12)) return null;
  const g = a.reduce(L.gcd), l = a.reduce(L.lcm);
  return rows([['GCD (HCF)', fx(g, 0)], ['LCM', l > 9e15 ? 'too large' : fx(l, 0)]]);
})] });

simple({ id: 'quad', name: 'Quadratic', icon: '🎢', desc: 'Solve ax² + bx + c = 0 with real or complex roots, discriminant and the vertex of the parabola.', keys: ['equation', 'roots', 'algebra', 'parabola', 'discriminant'], sections: [sec('ax² + bx + c = 0', [[N('a', 'a', 1), N('b', 'b', -3), N('c', 'c', 2)]], (v) => {
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
  const names = Object.keys(L.shapes);
  el.innerHTML = `<div class="card list"><label class="f">Shape<select id="s">${names.map((n) => `<option>${n}</option>`).join('')}</select></label><div class="list" id="f"></div><div class="list" id="r"></div></div>`;
  const run = () => {
    const sh = L.shapes[$('#s', el).value], v = $$('input', el).map((i) => parseFloat(i.value));
    $('#r', el).innerHTML = v.length && v.every((x) => Number.isFinite(x) && x > 0) ? rows(sh.f(...v).map((r) => [r[0], sig(r[1], 8)])) : '<div class="muted center">Enter positive sizes.</div>';
  };
  const build = () => {
    const sh = L.shapes[$('#s', el).value];
    $('#f', el).innerHTML = sh.d.map((d, i) => `<label class="f">${esc(d)}<input type="number" inputmode="decimal" step="any" min="0" value="${[10, 5, 4][i]}"></label>`).join('');
    run();
  };
  $('#s', el).onchange = build; el.addEventListener('input', (e) => { if (e.target.tagName === 'INPUT') run(); });
  build();
} });

reg({ id: 'triangle', name: 'Triangle', icon: '🔺', desc: 'Solve a triangle from three sides or from two sides and the angle between them: angles, area, type and radii.', keys: ['trigonometry', 'heron', 'angles', 'sides', 'geometry'], render(el) {
  el.innerHTML = `<div class="card list"><label class="f">Known<select id="m"><option value="sss">Three sides (a, b, c)</option><option value="sas">Two sides and the angle between (a, b, C°)</option></select></label>
    <div class="row"><label class="f"><span>Side a</span><input id="a" type="number" inputmode="decimal" step="any" value="3"></label><label class="f"><span>Side b</span><input id="b" type="number" inputmode="decimal" step="any" value="4"></label><label class="f"><span id="cl">Side c</span><input id="c" type="number" inputmode="decimal" step="any" value="5"></label></div><div class="list" id="r"></div></div>`;
  const run = () => {
    const sas = $('#m', el).value === 'sas';
    $('#cl', el).textContent = sas ? 'Angle C (°)' : 'Side c';
    const a = parseFloat($('#a', el).value), b = parseFloat($('#b', el).value);
    let c = parseFloat($('#c', el).value), pre = '';
    if (sas) { const s = ok(a, b, c) && a > 0 && b > 0 ? L.triSAS(a, b, c) : null; if (!s) { $('#r', el).innerHTML = '<div class="status">Angle must be between 0 and 180.</div>'; return; } pre = rows([['Side c', sig(s.c, 8)]]); c = s.c; }
    const t = ok(a, b, c) ? L.triSSS(a, b, c) : null;
    $('#r', el).innerHTML = t ? pre + rows([['Angle A', sig(t.A, 7) + '°'], ['Angle B', sig(t.B, 7) + '°'], ['Angle C', sig(t.C, 7) + '°'], ['Type', t.type], ['Area', sig(t.area, 8)], ['Perimeter', sig(t.perimeter, 8)], ['Inradius', sig(t.inradius, 6)], ['Circumradius', sig(t.circumradius, 6)]]) : '<div class="status">These sides cannot form a triangle.</div>';
  };
  el.addEventListener('input', run); el.addEventListener('change', run); run();
} });

simple({ id: 'powercost', name: 'Power Cost', icon: '🔌', desc: 'Electricity used and cost of an appliance per day, month and year from its watts and daily hours.', keys: ['electricity', 'kwh', 'watt', 'bill', 'appliance', 'energy'], sections: [sec('', [
  [N('w', 'Power (watts)', 1500), N('q', 'How many', 1)], [N('h', 'Hours per day', 2), N('r', 'Price per kWh', 8)]
], (v) => {
  if (!ok(v.w, v.q, v.h, v.r) || v.w < 0 || v.q < 0 || v.h < 0 || v.h > 24 || v.r < 0) return null;
  const day = v.w * v.q * v.h / 1000;
  return big('Cost per month (30 days)', fx(day * 30 * v.r)) + rows([['Energy per day', fx(day, 3) + ' kWh'], ['Cost per day', fx(day * v.r)], ['Energy per month', fx(day * 30) + ' kWh'], ['Cost per year', fx(day * 365 * v.r)]]);
})] });

simple({ id: 'cooking', name: 'Cooking Units', icon: '🥣', desc: 'Convert cups, spoons, grams and ounces for common ingredients such as flour, sugar and butter.', keys: ['recipe', 'cups to grams', 'baking', 'tablespoon', 'teaspoon', 'kitchen'], sections: [sec('', [
  S('i', 'Ingredient', Object.keys(L.ING).map((k) => [k, k]), 'Flour (plain)'), [N('a', 'Amount', 1), S('u', 'Unit', [['cup', 'cup (US)'], ['tbsp', 'tablespoon'], ['tsp', 'teaspoon'], ['g', 'gram'], ['kg', 'kilogram'], ['oz', 'ounce'], ['ml', 'millilitre']], 'cup')]
], (v) => {
  if (!ok(v.a) || v.a <= 0 || !L.ING[v.i]) return null;
  const r = L.cook(L.ING[v.i], v.a, v.u);
  return rows([['Grams', sig(r.g, 5)], ['Ounces', sig(r.oz, 4)], ['Cups', sig(r.cup, 4)], ['Tablespoons', sig(r.tbsp, 4)], ['Teaspoons', sig(r.tsp, 4)], ['Millilitres', sig(r.ml, 4)]]) + '<div class="muted" style="font-size:12px">Typical densities; real weights vary by brand and packing.</div>';
})] });

simple({ id: 'sizes', name: 'Size Converter', icon: '👕', desc: 'Approximate shoe, clothing and chest size conversions between UK, US and EU sizing.', keys: ['shoe', 'clothing', 'dress', 'shirt', 'eu', 'uk', 'us'], sections: [
  sec('Shoes', [[S('s', 'System', [['uk', 'UK'], ['usm', 'US men'], ['usw', 'US women'], ['eu', 'EU'], ['cm', 'Foot length cm']], 'uk'), N('v', 'Size', 8)]], (v) => {
    if (!ok(v.v) || v.v <= 0) return null;
    const r = L.shoe(v.s, v.v);
    return rows([['UK', sig(r.uk)], ['US men', sig(r.usm)], ['US women', sig(r.usw)], ['EU', sig(r.eu)], ['Foot length', sig(r.cm, 3) + ' cm']]) + '<div class="muted" style="font-size:12px">Approximate. Brands differ, so check their chart.</div>';
  }),
  sec('Women\'s clothing', [[S('s', 'System', [['uk', 'UK'], ['us', 'US'], ['eu', 'EU']], 'uk'), N('v', 'Size', 10)]], (v) => { if (!ok(v.v)) return null; const r = L.dress(v.s, v.v); return rows([['UK', sig(r.uk)], ['US', sig(r.us)], ['EU', sig(r.eu)]]); }),
  sec('Chest / jacket', [[N('v', 'Chest', 40), S('u', 'Unit', [['in', 'inches'], ['cm', 'cm']], 'in')]], (v) => { if (!ok(v.v) || v.v <= 0) return null; const r = L.chest(v.u, v.v); return rows([['Chest', sig(r.inch, 4) + ' in / ' + sig(r.cm, 4) + ' cm'], ['EU size', sig(r.eu)], ['Letter size', r.letter]]); })
] });

simple({ id: 'breakeven', name: 'Break-even', icon: '🏁', desc: 'Units you must sell to cover costs, and to reach a profit target, from fixed and variable costs.', keys: ['business', 'profit', 'cost', 'units', 'contribution'], sections: [sec('', [
  N('f', 'Fixed costs', 50000), [N('p', 'Price per unit', 250), N('v', 'Variable cost per unit', 150)], N('t', 'Profit target (optional)', 20000)
], (v) => {
  if (!ok(v.f, v.p, v.v) || v.f < 0) return null;
  const r = L.breakeven(v.f, v.p, v.v, Number.isFinite(v.t) ? v.t : 0);
  if (!r) return '<div class="status">Price must be higher than the variable cost.</div>';
  return big('Break-even units', fx(r.units, 0)) + rows([['Break-even revenue', fx(r.units * v.p)], ['Profit per unit', fx(r.cm)], ['Contribution margin', fx(r.cmPct) + '%']].concat(Number.isFinite(v.t) && v.t > 0 ? [['Units for the profit target', fx(r.unitsT, 0)], ['Revenue for target', fx(r.unitsT * v.p)]] : []));
})] });

simple({ id: 'margin', name: 'Markup & Margin', icon: '💹', desc: 'Profit, margin and markup from cost and price, or the selling price for a margin or markup you want.', keys: ['profit', 'selling price', 'cost', 'retail', 'gross margin'], sections: [
  sec('From cost and price', [[N('c', 'Cost', 80), N('p', 'Selling price', 100)]], (v) => { if (!ok(v.c, v.p) || v.c <= 0 || v.p <= 0) return null; const r = L.margin(v.c, v.p); return big('Margin', sig(r.margin, 6) + '%') + rows([['Markup', sig(r.markup, 6) + '%'], ['Profit', fx(r.profit)]]); }),
  sec('Price I need', [[N('c', 'Cost', 80), N('x', 'Percent', 25)], S('m', 'Percent is', [['mg', 'Margin (of price)'], ['mk', 'Markup (on cost)']], 'mg')], (v) => {
    if (!ok(v.c, v.x) || v.c <= 0 || v.x < 0 || (v.m === 'mg' && v.x >= 100)) return null;
    const p = v.m === 'mg' ? v.c / (1 - v.x / 100) : v.c * (1 + v.x / 100);
    return big('Selling price', fx(p)) + rows([['Profit', fx(p - v.c)]]);
  })
] });

simple({ id: 'interest', name: 'Simple Interest', icon: '💰', desc: 'Simple interest and total amount for a principal, rate and time in years or months.', keys: ['principal', 'rate', 'loan', 'deposit'], sections: [sec('', [
  N('p', 'Principal', 50000), [N('r', 'Rate % per year', 7), N('t', 'Time', 3)], S('u', 'Time in', [['y', 'Years'], ['m', 'Months'], ['d', 'Days']], 'y')
], (v) => {
  if (!ok(v.p, v.r, v.t) || v.p < 0 || v.r < 0 || v.t < 0) return null;
  const yrs = v.u === 'y' ? v.t : v.u === 'm' ? v.t / 12 : v.t / 365, i = v.p * v.r * yrs / 100;
  return big('Interest', fx(i)) + rows([['Total amount', fx(v.p + i)], ['Per year', fx(v.p * v.r / 100)]]);
})] });

simple({ id: 'fdrd', name: 'FD / RD', icon: '🏧', desc: 'Maturity amount of a fixed deposit with compounding, and of a monthly recurring deposit.', keys: ['fixed deposit', 'recurring deposit', 'bank', 'maturity', 'savings'], sections: [
  sec('Fixed deposit', [N('p', 'Deposit', 100000), [N('r', 'Rate % per year', 7), N('y', 'Years', 5)], S('n', 'Compounded', [[4, 'Quarterly'], [12, 'Monthly'], [2, 'Half-yearly'], [1, 'Yearly']], 4)], (v) => {
    if (!ok(v.p, v.r, v.y) || v.p <= 0 || v.r < 0 || v.y <= 0 || v.y > 50) return null;
    const m = L.compound(v.p, v.r, v.y, +v.n);
    return big('Maturity amount', fx(m)) + rows([['Interest earned', fx(m - v.p)]]);
  }),
  sec('Recurring deposit', [N('m', 'Monthly deposit', 5000), [N('r', 'Rate % per year', 6.5), N('t', 'Months', 24)]], (v) => {
    const n = Math.round(v.t);
    if (!ok(v.m, v.r, n) || v.m <= 0 || v.r < 0 || n < 1 || n > 600) return null;
    const m = L.rd(v.m, v.r, n);
    return big('Maturity amount', fx(m)) + rows([['Total deposited', fx(v.m * n)], ['Interest earned', fx(m - v.m * n)]]) + '<div class="muted" style="font-size:12px">Quarterly compounding. Banks may differ slightly.</div>';
  })
] });

simple({ id: 'networth', name: 'Net Worth', icon: '💎', desc: 'Add up assets and debts from simple lists to see your net worth.', keys: ['assets', 'liabilities', 'wealth', 'savings', 'debt'], sections: [sec('One item per line, amount at the end of the line', [
  { k: 'a', l: 'Assets', t: 'textarea', rows: 4, v: 'Savings 150000\nInvestments 300000', p: 'Cash 5000' }, { k: 'l', l: 'Debts', t: 'textarea', rows: 4, v: 'Car loan 120000', p: 'Loan 20000' }
], (v) => {
  const a = L.sumAmounts(v.a), l = L.sumAmounts(v.l);
  return big('Net worth', fx(a - l)) + rows([['Total assets', fx(a)], ['Total debts', fx(l)]]);
})] });

simple({ id: 'cagr', name: 'Growth Rate', icon: '🚀', desc: 'Compound annual growth rate between a start and end value over a number of years.', keys: ['cagr', 'return', 'annualised', 'growth', 'investment'], sections: [sec('', [
  [N('a', 'Start value', 10000), N('b', 'End value', 18000)], N('y', 'Years', 5)
], (v) => {
  if (!ok(v.a, v.b, v.y) || v.a <= 0 || v.b <= 0 || v.y <= 0) return null;
  return big('CAGR', sig(L.cagr(v.a, v.b, v.y), 6) + '% per year') + rows([['Total growth', sig((v.b / v.a - 1) * 100, 6) + '%'], ['Doubles in about', sig(Math.log(2) / Math.log(1 + L.cagr(v.a, v.b, v.y) / 100), 4) + ' years']].slice(0, L.cagr(v.a, v.b, v.y) > 0 ? 2 : 1));
})] });

simple({ id: 'numwords', name: 'Number Words', icon: '🔤', desc: 'Write a number in words using the Indian (lakh, crore) or international (million, billion) system.', keys: ['cheque', 'check', 'spell', 'amount in words', 'lakh', 'crore'], sections: [sec('', [
  N('n', 'Number (up to 999 trillion)', 1234567), S('s', 'System', [['in', 'Indian (lakh, crore)'], ['int', 'International']], 'in')
], (v) => {
  if (!Number.isFinite(v.n) || Math.abs(v.n) >= 1e15) return null;
  const neg = v.n < 0 ? 'minus ' : '', a = Math.abs(v.n), whole = Math.floor(a + 1e-9), frac = Math.round((a - whole) * 100);
  let w = neg + L.words(whole, v.s === 'in');
  if (frac) w += ' and ' + L.words(frac, v.s === 'in') + ' hundredths';
  return `<div class="card" style="font-size:18px;line-height:1.5">${esc(w.charAt(0).toUpperCase() + w.slice(1))}</div>`;
})] });

})();
