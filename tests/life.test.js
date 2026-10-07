'use strict';
/* Tests the pure logic of www/js/tools/life.js (the code between LOGIC-START and LOGIC-END markers). Run: node tests/life.test.js */
const fs = require('fs'), path = require('path'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'www', 'js', 'tools', 'life.js'), 'utf8');
const blocks = [...src.matchAll(/\/\* LOGIC-START \*\/([\s\S]*?)\/\* LOGIC-END \*\//g)].map(m => m[1]);
assert(blocks.length >= 1, 'no logic blocks found');
const LG = {};
new Function('LG', blocks.join('\n'))(LG);
let n = 0;
const t = (name, fn) => { try { fn(); n++; } catch (e) { console.error('FAIL ' + name + ': ' + e.message); process.exitCode = 1; } };
const near = (a, b, eps, m) => assert(Math.abs(a - b) <= (eps || 1e-9), (m || '') + ' expected ' + b + ' got ' + a);

t('csv escaping and formula prefixes', () => {
  assert.strictEqual(LG.csvCell('=1+1'), "'=1+1");
  assert.strictEqual(LG.csvCell('+cmd'), "'+cmd");
  assert.strictEqual(LG.csvCell('-5x'), "'-5x");
  assert.strictEqual(LG.csvCell('@SUM(A1)'), "'@SUM(A1)");
  assert.strictEqual(LG.csvCell('a,b'), '"a,b"');
  assert.strictEqual(LG.csvCell('say "hi"'), '"say ""hi"""');
  assert.strictEqual(LG.csvCell('line\nbreak'), '"line\nbreak"');
  assert.strictEqual(LG.csvCell(null), '');
  assert.strictEqual(LG.csvCell(12.5), '12.5');
  assert.strictEqual(LG.csvText([['a', '=x'], ['b,c', 1]]), "a,'=x\r\n\"b,c\",1");
});
t('dates and streaks', () => {
  assert(LG.keyOk('2024-02-29')); assert(!LG.keyOk('2023-02-29')); assert(!LG.keyOk('2023-13-01')); assert(!LG.keyOk('abc'));
  assert.strictEqual(LG.keyAdd('2024-02-28', 2), '2024-03-01');
  assert.strictEqual(LG.keyDiff('2024-03-09', '2024-03-11'), 2);
  assert.strictEqual(LG.streakOf(['2024-05-01', '2024-05-02', '2024-05-03'], '2024-05-03'), 3);
  assert.strictEqual(LG.streakOf(['2024-05-01', '2024-05-02'], '2024-05-03'), 2, 'today empty still counts yesterday');
  assert.strictEqual(LG.streakOf(['2024-05-01'], '2024-05-03'), 0);
  assert.strictEqual(LG.bestStreak(['2024-05-01', '2024-05-02', '2024-05-04', '2024-05-05', '2024-05-06']), 3);
});
t('journal search, group and export', () => {
  const L = [
    { id: '1', d: '2024-05-03', t: 'Hike', x: 'Mountain day', m: '😄', g: ['outdoors', 'fun'], at: 1 },
    { id: '2', d: '2024-04-20', t: '', x: 'Quiet one', m: '', g: [], at: 2 },
    { id: '3', d: '2024-05-10', t: 'Work', x: 'Meeting notes', m: '😐', g: ['work'], at: 3 }];
  assert.strictEqual(LG.journalSearch(L, 'mountain').length, 1);
  assert.strictEqual(LG.journalSearch(L, '#work').length, 1);
  assert.strictEqual(LG.journalSearch(L, '').length, 3);
  const g = LG.journalGroup(L);
  assert.deepStrictEqual(g.map(x => x.ym), ['2024-05', '2024-04']);
  assert.strictEqual(g[0].items[0].id, '3');
  const md = LG.journalExport(L, 'md');
  assert(md.startsWith('# My journal\n'));
  assert(md.indexOf('## 2024-04-20 - (no title)') < md.indexOf('## 2024-05-03 - Hike'), 'oldest first');
  assert(md.includes('*Mood: 😄  |  Tags: #outdoors #fun*'));
  assert(md.includes('Mountain day') && md.includes('---'));
  const tx = LG.journalExport(L, 'txt');
  assert(tx.startsWith('MY JOURNAL\n') && !tx.includes('##') && tx.includes('2024-05-10 - Work'));
  assert.deepStrictEqual(LG.parseTags('#Work, idea  Idea;family'), ['work', 'idea', 'family']);
  assert.strictEqual(LG.parseTags('a b c d e f g h i j k l').length, 10);
});

t('gratitude helpers', () => {
  const m = { '2024-05-01': ['a', ' ', ''], '2024-05-02': ['b', 'c', 'd'], '2024-05-03': ['', '', ''], 'bad': ['x'] };
  assert.deepStrictEqual(LG.gratKeys(m), ['2024-05-01', '2024-05-02']);
  assert.strictEqual(LG.gratRandomOld(m, '2024-05-02', () => 0.99), '2024-05-01');
  assert.strictEqual(LG.gratRandomOld(m, '2024-05-01', () => 0), null);
  assert.strictEqual(LG.gratExport(m), 'GRATITUDE LOG\n\n2024-05-01\n1. a\n\n2024-05-02\n1. b\n2. c\n3. d\n');
});

t('bucket list', () => {
  const it = [{ t: 'A', c: 'Travel', by: '2030-01-01', done: '', at: 1 }, { t: 'B', c: 'Money', by: '', done: '', at: 2 }, { t: 'C', c: 'Health', by: '2029-01-01', done: '', at: 3 }, { t: 'D', c: 'Other', by: '', done: '2024-02-02', at: 4 }];
  assert.deepStrictEqual(LG.bucketProgress(it), { total: 4, done: 1, pct: 25 });
  assert.deepStrictEqual(LG.bucketProgress([]), { total: 0, done: 0, pct: 0 });
  assert.deepStrictEqual(LG.bucketSort(it).map(i => i.t), ['C', 'A', 'B', 'D']);
  const x = LG.bucketExport(it);
  assert(x.includes('1 of 4 done (25%)') && x.includes('[ ] C (Health, target 2029-01-01)') && x.includes('[x] D (Other, done 2024-02-02)'));
});

t('mood calendar maths', () => {
  const g = LG.monthGrid(2024, 1); // Feb 2024 starts on Thursday, 29 days
  assert.strictEqual(g.length % 7, 0); assert.strictEqual(g.indexOf('2024-02-01'), 3); assert.strictEqual(g.filter(Boolean).length, 29);
  assert.strictEqual(LG.monthGrid(2024, 6).indexOf('2024-07-01'), 0); // Monday
  const d = { '2024-02-01': { m: 4 }, '2024-02-02': { m: 0 }, '2024-02-03': { m: 4 }, '2024-02-04': { m: 9 }, '2024-03-01': { m: 2 }, '2024-02-05': null };
  const s = LG.moodMonth(d, '2024-02');
  assert.deepStrictEqual(s.counts, [1, 0, 0, 0, 2]); assert.strictEqual(s.n, 3); near(s.avg, (5 + 1 + 5) / 3);
  assert.strictEqual(s.best.k, '2024-02-01'); assert.strictEqual(s.worst.k, '2024-02-02');
  assert.strictEqual(LG.moodMonth({}, '2024-02').avg, null);
});

const FE = (id, d, km, l, price, full) => ({ id, d, km, l, price, full });
t('fuel consumption full and partial fills', () => {
  const c = LG.fuelCompute([FE('a', '2024-01-01', 10000, 40, 60, true), FE('b', '2024-01-10', 10500, 35, 52.5, true)]);
  near(c.rows[1].kmpl, 500 / 35); near(LG.consShow(c.rows[1].kmpl, 'l100'), 7, 1e-9); assert.strictEqual(c.rows[0].kmpl, null);
  near(c.avgKmpl, 500 / 35); near(c.costPerKm, 52.5 / 500);
  // a partial fill in between: fuel is summed up to the next full fill
  const p = LG.fuelCompute([FE('a', '2024-01-01', 1000, 40, 0, true), FE('b', '2024-01-05', 1200, 15, 0, false), FE('c', '2024-01-10', 1500, 25, 0, true)]);
  assert.strictEqual(p.rows[1].kmpl, null); near(p.rows[2].kmpl, 500 / 40); near(p.rows[2].used, 40);
  // order in the array does not matter
  const o = LG.fuelCompute([FE('c', '2024-01-10', 1500, 25, 0, true), FE('a', '2024-01-01', 1000, 40, 0, true), FE('b', '2024-01-05', 1200, 15, 0, false)]);
  near(o.avgKmpl, 12.5);
  assert.strictEqual(LG.fuelCompute([]).avgKmpl, null);
  assert.strictEqual(LG.fuelCompute([FE('a', '2024-01-01', 1000, 40, 0, false), FE('b', '2024-01-05', 1200, 15, 0, false)]).avgKmpl, null, 'no full fills, no average');
});
t('fuel unit conversions', () => {
  near(LG.consShow(10, 'kmpl'), 10); near(LG.consShow(10, 'l100'), 10);
  near(LG.consShow(10, 'mpgus'), 23.5215, 1e-3); near(LG.consShow(10, 'mpguk'), 28.2481, 1e-3);
  near(LG.consShow(100 / 7, 'mpgus'), 33.6022, 1e-3);
  assert.strictEqual(LG.consShow(0, 'kmpl'), null); assert.strictEqual(LG.consShow(NaN, 'l100'), null);
  const c = LG.fuelToCanon('mpgus', 100, 10); near(c.km, 160.9344); near(c.l, 37.85411784);
  const k = LG.fuelToCanon('mpguk', 1, 1); near(k.l, 4.54609);
  // 30 mpg US end to end through the full-fill maths
  const a = LG.fuelToCanon('mpgus', 1000, 10), b = LG.fuelToCanon('mpgus', 1300, 10);
  const r = LG.fuelCompute([FE('a', '2024-01-01', a.km, a.l, 0, true), FE('b', '2024-02-01', b.km, b.l, 0, true)]);
  near(LG.consShow(r.rows[1].kmpl, 'mpgus'), 30, 1e-9);
});
t('fuel odometer validation', () => {
  const L = [FE('a', '2024-01-01', 1000, 40, 0, true), FE('b', '2024-03-01', 2000, 40, 0, true)];
  const ok = { d: '2024-02-01', km: 1500, l: 30, price: 0 };
  assert.strictEqual(LG.fuelCheck(L, ok), '');
  assert(LG.fuelCheck(L, Object.assign({}, ok, { km: 1000 })).includes('higher'));
  assert(LG.fuelCheck(L, Object.assign({}, ok, { km: 900 })).includes('higher'));
  assert(LG.fuelCheck(L, Object.assign({}, ok, { km: 2000 })).includes('lower'));
  assert.strictEqual(LG.fuelCheck(L, { d: '2024-04-01', km: 2001, l: 5, price: 0 }), '');
  assert(LG.fuelCheck(L, { d: '2024-04-01', km: 1900, l: 5, price: 0 }).includes('higher'));
  assert(LG.fuelCheck(L, Object.assign({}, ok, { l: 0 })) !== '');
  assert(LG.fuelCheck(L, Object.assign({}, ok, { km: NaN })) !== '');
  assert(LG.fuelCheck(L, Object.assign({}, ok, { d: 'x' })) !== '');
  assert.strictEqual(LG.fuelCheck(L, { d: '2024-01-01', km: 1000, l: 5, price: 0 }, 'a'), '', 'editing ignores itself');
});
t('fuel CSV', () => {
  const csv = LG.fuelCsv([FE('a', '2024-01-01', 10000, 40, 60, true), FE('b', '2024-01-10', 10500, 35, 52.5, true)], 'l100').split('\r\n');
  assert.strictEqual(csv[0], 'Date,Odometer (km),Fuel (L),Price,Full tank,Consumption (L/100km),Cost per km');
  assert.strictEqual(csv[1], '2024-01-01,10000,40,60,yes,,');
  assert.strictEqual(csv[2], '2024-01-10,10500,35,52.5,yes,7,0.105');
});

t('service urgency ordering', () => {
  const today = '2024-06-10';
  const V = [{ id: 'v1', n: 'Car', odo: 50000, items: [
    { id: 'a', n: 'Insurance', dd: '2024-06-30', dod: 0, nid: 800000 },
    { id: 'b', n: 'Oil', dd: '', dod: 50300, nid: 800001 },
    { id: 'c', n: 'Tyres', dd: '2024-06-01', dod: 0, nid: 800002 },
    { id: 'd', n: 'Idle', dd: '', dod: 0, nid: 800003 },
    { id: 'e', n: 'Brakes', dd: '', dod: 60000, nid: 800004 }] }];
  const L = LG.serviceList(V, today);
  assert.deepStrictEqual(L.map(r => r.it.id), ['c', 'b', 'a', 'e', 'd']); // overdue date, 300 km (7.5 days), 20 days, 250 days, no due
  assert.strictEqual(L[0].info.status, 'overdue'); assert.strictEqual(L[1].info.status, 'soon'); assert.strictEqual(L[2].info.status, 'ok'); assert.strictEqual(L[4].info.status, 'none');
  assert.strictEqual(LG.serviceInfo({ dd: '2024-06-10' }, 0, today).days, 0);
  assert.strictEqual(LG.serviceInfo({ dod: 49000 }, 50000, today).status, 'overdue');
  assert.strictEqual(LG.serviceInfo({ dod: 49000 }, 0, today).status, 'ok', 'unknown odometer is not overdue');
  assert.strictEqual(LG.dueText(LG.serviceInfo({ dd: '2024-06-01' }, 0, today)), '9 days overdue');
  assert.strictEqual(LG.dueText(LG.serviceInfo({ dd: '2024-06-11' }, 0, today)), 'in 1 day');
  assert.strictEqual(LG.dueText(LG.serviceInfo({ dod: 50300 }, 50000, today)), '300 km to go');
});
t('service reschedule and notification plan', () => {
  assert.strictEqual(LG.addMonthsKey('2024-01-31', 1), '2024-02-29'); assert.strictEqual(LG.addMonthsKey('2024-11-15', 3), '2025-02-15'); assert.strictEqual(LG.addMonthsKey('2024-03-31', 12), '2025-03-31');
  assert.deepStrictEqual(LG.serviceNext({ em: 6, ek: 5000 }, '2024-06-10', 50000), { dd: '2024-12-10', dod: 55000 });
  assert.deepStrictEqual(LG.serviceNext({ em: 0, ek: 0 }, '2024-06-10', 50000), { dd: '', dod: '' });
  assert.strictEqual(LG.freeNid([800000, 800001, 800003]), 800002); assert.strictEqual(LG.freeNid([]), 800000);
  assert.strictEqual(LG.freeNid(Array.from({ length: 10000 }, (_, i) => 800000 + i)), -1);
  const V = [{ n: 'Car', items: [{ n: 'Oil', dd: '2024-06-12', nid: 800005 }, { n: 'Past', dd: '2024-06-01', nid: 800006 }, { n: 'NoId', dd: '2024-07-01', nid: 5 }, { n: 'NoDate', dd: '', nid: 800007 }] }];
  const plan = LG.serviceNotifyPlan(V, new Date(2024, 5, 10, 12).getTime());
  assert.strictEqual(plan.length, 1); assert.strictEqual(plan[0].id, 800005);
  const at = new Date(plan[0].at); assert.strictEqual(at.getHours(), 9); assert.strictEqual(at.getDate(), 12);
  assert(plan[0].id >= 800000 && plan[0].id <= 809999);
  assert.strictEqual(LG.serviceNotifyPlan(V, new Date(2024, 5, 12, 9, 0).getTime()).length, 0, 'not in the past');
});

t('trip odometer GPS handling', () => {
  const st = LG.tripNew(); let tt = 0;
  const fix = (lat, acc, speed) => LG.tripFix(st, { latitude: lat, longitude: 77, accuracy: acc, speed }, tt += 1000);
  fix(12.0, 5, null); // first fix sets the start
  for (let i = 1; i <= 10; i++) fix(12 + i * 0.001, 5, null); // 10 x ~111.2 m
  near(st.d, 10 * 111.195, 15);
  const d1 = st.d;
  fix(12.0105, 80, null); assert.strictEqual(st.d, d1, 'weak fix ignored');
  fix(12.01 + 0.00001, 5, null); assert.strictEqual(st.d, d1, 'jitter inside the noise ignored');
  const v = fix(12.0125, 5, 20); near(v, 72); assert(st.max >= 72);
  assert.strictEqual(fix(12.0126, 5, 900), 0, 'glitch speed rejected');
  assert.strictEqual(LG.tripFix(st, { latitude: NaN, longitude: 1 }, 1), 0);
  near(LG.geoDist({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 }), 111195, 5);
  assert.strictEqual(LG.fmtDur(3725000), '1:02:05'); assert.strictEqual(LG.fmtDur(65000), '01:05'); assert.strictEqual(LG.fmtDur(-5), '00:00');
  near(LG.avgKmh(10000, 3600000), 10); assert.strictEqual(LG.avgKmh(500, 0), 0);
  assert.deepStrictEqual(LG.tripLaps([{ d: 1000, ms: 100000 }, { d: 2500, ms: 250000 }]), [{ n: 1, d: 1000, ms: 100000 }, { n: 2, d: 1500, ms: 150000 }]);
  assert.strictEqual(LG.tripUnit('mi').sp, 'mph'); near(LG.tripUnit('xx').f, 1000);
});

t('prepayment against closed-form amortisation', () => {
  const P = 1000000, rate = 9, n = 240, i = rate / 1200;
  const emi = P * i * Math.pow(1 + i, n) / (Math.pow(1 + i, n) - 1);
  near(LG.emiOf(P, rate, n), emi, 1e-6); near(LG.emiOf(1200, 0, 12), 100);
  const base = LG.loanRun(P, rate, n, 0, 0, 0);
  assert.strictEqual(base.months, n); near(base.interest, emi * n - P, 1e-3); near(base.paid, emi * n, 1e-3);
  // extra monthly: months from the closed form n = -ln(1 - P i / m) / ln(1 + i)
  const m = emi + 5000, nExtra = Math.ceil(-Math.log(1 - P * i / m) / Math.log(1 + i) - 1e-9);
  const ex = LG.loanRun(P, rate, n, 5000, 0, 0);
  assert.strictEqual(ex.months, nExtra); near(ex.paid - P, ex.interest, 1e-3, 'paid = principal + interest');
  assert(ex.interest < base.interest);
  // lump sum at month k: balance B_k = P(1+i)^k - emi((1+i)^k - 1)/i, minus the lump, then closed form for the rest
  const k = 24, L = 200000, Bk = P * Math.pow(1 + i, k) - emi * (Math.pow(1 + i, k) - 1) / i - L;
  const rest = Math.ceil(-Math.log(1 - Bk * i / emi) / Math.log(1 + i) - 1e-9), lp = LG.loanRun(P, rate, n, 0, L, k);
  assert.strictEqual(lp.months, k + rest); near(lp.paid - P, lp.interest + 0, 1e-3);
  // both together still reconcile
  const both = LG.loanRun(P, rate, n, 3000, 100000, 12, true);
  near(both.paid, P + both.interest, 1e-3); assert.strictEqual(both.rows.length, both.months); near(both.rows[both.rows.length - 1].bal, 0, 1e-9);
  const cmp = LG.prepayCompare(P, rate, n, 5000, 0, 1);
  near(cmp.interestSaved, base.interest - ex.interest); assert.strictEqual(cmp.monthsSaved, n - ex.months);
  // zero rate
  const z = LG.loanRun(120000, 0, 24, 1000, 0, 0); near(z.interest, 0);
  assert.strictEqual(z.months, 20); // 5000 + 1000 = 6000 a month for 120000
  const zl = LG.loanRun(120000, 0, 24, 0, 60000, 10); assert.strictEqual(zl.months, 10 + Math.ceil((120000 - 50000 - 60000) / 5000));
  // a lump sum larger than the balance just ends the loan
  const big = LG.loanRun(10000, 12, 12, 0, 1e9, 3); assert.strictEqual(big.months, 3);
  assert.strictEqual(LG.monthsText(18), '1 year 6 months'); assert.strictEqual(LG.monthsText(24), '2 years'); assert.strictEqual(LG.monthsText(1), '1 month'); assert.strictEqual(LG.monthsText(0), '0 months');
});

t('FIRE projection against closed form', () => {
  const S = 500000, m = 30000, ret = 10, infl = 5, spend = 600000, wr = 4;
  const g = 1.10 / 1.05 - 1, A = 360000, T = 15000000;
  const p = LG.fireProject(S, m, ret, infl, spend, wr);
  near(p.g, g, 1e-12); near(p.target, T, 1e-6);
  const bal = (t) => S * Math.pow(1 + g, t) + A * (Math.pow(1 + g, t) - 1) / g;
  near(bal(p.years), T, 1e-3, 'balance at the answer equals the target');
  assert(bal(Math.floor(p.years)) < T && bal(Math.ceil(p.years)) >= T);
  // the iterated table agrees with the closed form
  p.rows.forEach(r => near(r.real, bal(r.year), 1e-4)); assert.strictEqual(p.rows.length, Math.ceil(p.years));
  near(p.rows[2].nominal, p.rows[2].real * Math.pow(1.05, 3), 1e-6);
  // zero real return: straight line
  const z = LG.fireProject(100000, 1000, 5, 5, 40000, 4); near(z.years, (1000000 - 100000) / 12000);
  // already there, and never
  assert.strictEqual(LG.fireProject(2e7, 0, 5, 3, 600000, 4).years, 0);
  assert.strictEqual(LG.fireProject(100, 0, 5, 3, 600000, 4).years, null);
  assert.strictEqual(LG.fireProject(100, 10, -5, 3, 600000, 4).years, null);
  assert.strictEqual(LG.fireProject(0, 1000, 0, 5, 600000, 4).years, null, 'over 80 years is not shown');
  // zero savings and zero monthly with positive growth never reaches
  assert.strictEqual(LG.fireProject(0, 0, 8, 2, 1000, 4).years, null);
  assert.strictEqual(LG.yearsText(12.5), '12 years 6 months'); assert.strictEqual(LG.yearsText(1), '1 year'); assert.strictEqual(LG.yearsText(0), 'now');
});

t('bill split sums exactly', () => {
  assert.deepStrictEqual(LG.apportion(100, [1, 1, 1]), [34, 33, 33]);
  assert.deepStrictEqual(LG.apportion(10, [0, 0]), [0, 0]); assert.deepStrictEqual(LG.apportion(0, [1, 2]), [0, 0]);
  assert.deepStrictEqual(LG.apportion(5, [0, 3]), [0, 5]);
  const r = LG.splitBill(['a', 'b'], [{ price: 2000, who: ['a', 'b'] }, { price: 600, who: ['b'] }], 0, 0);
  assert.strictEqual(r.per.a.total, 1000); assert.strictEqual(r.per.b.total, 1600); assert.strictEqual(r.total, 2600);
  const t2 = LG.splitBill(['a', 'b'], [{ price: 2000, who: ['a', 'b'] }, { price: 600, who: ['b'] }], 10, 5);
  assert.strictEqual(t2.tax, 260); assert.strictEqual(t2.tip, 130); assert.strictEqual(t2.total, 2990);
  assert.strictEqual(t2.per.a.total + t2.per.b.total, 2990);
  const u = LG.splitBill(['a'], [{ price: 500, who: [] }, { price: 300, who: ['zz'] }, { price: 100, who: ['a'] }], 0, 0);
  assert.strictEqual(u.unassigned, 2); assert.strictEqual(u.total, 100);
  assert.strictEqual(LG.toCents(19.99), 1999); assert.strictEqual(LG.toCents(0.1 + 0.2), 30);
  // many random cases: per-person totals and every component add up to the cent
  let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  for (let c = 0; c < 3000; c++) {
    const np = 1 + Math.floor(rnd() * 8), ni = Math.floor(rnd() * 12), people = Array.from({ length: np }, (_, k) => 'p' + k);
    const items = Array.from({ length: ni }, () => ({ price: Math.floor(rnd() * 20000), who: people.filter(() => rnd() < 0.5) }));
    const tax = Math.round(rnd() * 2500) / 100, tip = Math.round(rnd() * 3000) / 100, res = LG.splitBill(people, items, tax, tip);
    const sum = (k) => people.reduce((s, p) => s + res.per[p][k], 0);
    assert.strictEqual(sum('total'), res.total, 'total case ' + c); assert.strictEqual(sum('sub'), res.subtotal); assert.strictEqual(sum('tax'), res.tax); assert.strictEqual(sum('tip'), res.tip);
    assert.strictEqual(res.total, res.subtotal + res.tax + res.tip);
    const assigned = items.filter(i => i.who.length).reduce((s, i) => s + i.price, 0); assert.strictEqual(res.subtotal, assigned);
    people.forEach(p => { Object.values(res.per[p]).forEach(v => assert(Number.isInteger(v) && v >= 0)); });
  }
  const txt = LG.splitText([['a', 'Asha'], ['b', 'Ben']], t2, 10, 5);
  assert(txt.startsWith('Bill split\nAsha: 11.50 (items 10.00, tax 1.00, tip 0.50)\nBen: 18.40')); assert(txt.includes('Total: 29.90'));
});

t('vCard builder escaping and validation', () => {
  assert.strictEqual(LG.vcardEsc('a,b;c\\d\ne'), 'a\\,b\\;c\\\\d\\ne');
  assert.strictEqual(LG.vcardEsc('x\r\ny'), 'x\\ny');
  const card = LG.vcardBuild({ first: 'Asha', last: 'Kolhe, Jr;', phone: '+91 98765 43210', email: 'a@b.co', company: 'Acme, Inc; Ltd', url: 'example.com/a,b;c', address: '1 Main St,\nPune; India' });
  const lines = card.split('\r\n');
  assert.strictEqual(lines[0], 'BEGIN:VCARD'); assert.strictEqual(lines[1], 'VERSION:3.0'); assert.strictEqual(lines[lines.length - 1], 'END:VCARD');
  assert(lines.includes('N:Kolhe\\, Jr\\;;Asha;;;')); assert(lines.includes('FN:Asha Kolhe\\, Jr\\;'));
  assert(lines.includes('ORG:Acme\\, Inc\\; Ltd')); assert(lines.includes('TEL;TYPE=CELL:+91 98765 43210'));
  assert(lines.includes('URL:https://example.com/a%2Cb%3Bc')); assert(lines.includes('ADR;TYPE=HOME:;;1 Main St\\,\\nPune\\; India;;;;'));
  assert(!card.replace(/\r\n/g, '').includes('\n'), 'no raw newlines other than line ends');
  // a value cannot start a new vCard line or property
  const inj = LG.vcardBuild({ first: 'Bob\r\nEND:VCARD\r\nBEGIN:VCARD', last: '' }).split('\r\n');
  assert.strictEqual(inj.filter(l => l === 'END:VCARD').length, 1); assert.strictEqual(inj.filter(l => l === 'BEGIN:VCARD').length, 1);
  assert.strictEqual(LG.vcardBuild({ first: 'Z' }).includes('TEL'), false);
  assert.deepStrictEqual(LG.vcardCheck({ first: 'A', phone: '+1 (555) 123-4567', email: 'a@b.com', url: 'example.com' }), {});
  assert('phone' in LG.vcardCheck({ first: 'A', phone: 'abc' })); assert('email' in LG.vcardCheck({ first: 'A', email: 'nope' })); assert('url' in LG.vcardCheck({ first: 'A', url: 'a b' }));
  assert('first' in LG.vcardCheck({ phone: '12345' })); assert('first' in LG.vcardCheck({}));
  assert.strictEqual(LG.vcardUrl(' http://x.org '), 'http://x.org'); assert.strictEqual(LG.vcardUrl(''), '');
});

t('mind map layout never overlaps', () => {
  let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  for (let c = 0; c < 300; c++) {
    const n = 1 + Math.floor(rnd() * 120), nodes = [{ id: 'n0', t: 'root', x: 5, y: 5, p: null, c: 0 }];
    for (let i = 1; i < n; i++) nodes.push({ id: 'n' + i, t: 'x', x: Math.floor(rnd() * 50), y: Math.floor(rnd() * 50), p: 'n' + Math.floor(rnd() * i), c: 0 });
    const L = LG.mmLayout(nodes);
    assert.strictEqual(L.length, n);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) assert(!LG.mmHit(L[i], L[j], 0), 'overlap in case ' + c + ' ' + i + ' ' + j);
    const root = L[0]; assert.strictEqual(root.x, 0);
    L.forEach(k => { if (k.p) { const p = L.find(z => z.id === k.p); assert(k.x > p.x, 'child is to the right of the parent'); } });
  }
});
t('mind map editing', () => {
  let nodes = LG.mmNormalize([{ id: 'r', t: 'Root', x: 0, y: 0, p: null, c: 0 }]);
  const add = (pid) => { const k = LG.mmAddChild(nodes, pid, 'child'); assert(k); nodes.push(k); return k; };
  const a = add('r'), b = add('r'), c = add('r'), a1 = add(a.id), a2 = add(a1.id);
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) assert(!LG.mmHit(nodes[i], nodes[j], 0), 'new nodes do not overlap');
  assert.strictEqual(a.p, 'r'); assert(a.x > nodes[0].x);
  assert.deepStrictEqual([...LG.mmDesc(nodes, a.id)].sort(), [a.id, a1.id, a2.id].sort());
  const after = LG.mmDelete(nodes, a.id);
  assert.strictEqual(after.length, nodes.length - 3); assert(after.some(n => n.id === b.id) && !after.some(n => n.id === a2.id));
  assert.strictEqual(LG.mmDelete(nodes, 'r').length, nodes.length, 'the root cannot be deleted');
  const full = Array.from({ length: 200 }, (_, i) => ({ id: 'q' + i, t: '', x: i * 200, y: 0, p: i ? 'q0' : null, c: 0 }));
  assert.strictEqual(LG.mmAddChild(full, 'q0', 'x'), null, 'cap of 200 nodes');
  // repair of broken stored data
  const fixed = LG.mmNormalize([{ id: 'a', p: 'zzz', t: 5, x: 'bad', y: 1e9, c: 99 }, { id: 'b', p: 'c', x: 1, y: 1 }, { id: 'c', p: 'b', x: 2, y: 2 }, { id: 'a', p: null }, null, { p: 'a' }]);
  assert.strictEqual(fixed.filter(n => n.p === null).length, 1); assert.strictEqual(fixed.length, 3);
  assert.strictEqual(fixed[0].t, '5'); assert.strictEqual(fixed[0].x, 0); assert.strictEqual(fixed[0].y, 1e5); assert.strictEqual(fixed[0].c, 0);
  fixed.forEach(n => { let k = n, g = 0; while (k.p !== null && g++ < 10) k = fixed.find(z => z.id === k.p); assert(g < 10, 'no cycles'); });
  assert.strictEqual(LG.mmNormalize('nope').length, 1);
  assert.deepStrictEqual(LG.mmLines('Hello world'), ['Hello world']);
  assert.deepStrictEqual(LG.mmLines('one two three four five six seven eight'), ['one two three four', 'five six seven…']);
  assert(LG.mmLines('x'.repeat(100))[0].length <= 18); assert.deepStrictEqual(LG.mmLines('   '), []);
  assert(LG.mmLines('a b c d e f g h i j k l m n o p q r s t u v w x y z').length <= 2);
});

t('sticky board placement and repair', () => {
  const S = LG.SB, list = [];
  for (let i = 0; i < S.MAX; i++) {
    const p = LG.sbSpot(list);
    assert(p.x >= 0 && p.y >= 0 && p.x <= S.BW - S.W && p.y <= S.BH - S.H, 'inside the board');
    if (i < 60) assert(!list.some(n => LG.sbHit(p, n)), 'first 60 notes do not overlap');
    list.push(p);
  }
  assert.deepStrictEqual(LG.sbClamp(-50, 99999), { x: 0, y: S.BH - S.H }); assert.deepStrictEqual(LG.sbClamp('x', NaN), { x: 0, y: 0 });
  const bad = LG.sbNormalize([{ id: 'a', t: 'x'.repeat(500), x: 5000, y: -3, c: 77 }, { id: 'a' }, null, { id: 9 }, { id: 'b', t: 5, x: 10.4, y: 20.6, c: 3 }]);
  assert.strictEqual(bad.length, 2); assert.strictEqual(bad[0].t.length, 200); assert.strictEqual(bad[0].x, S.BW - S.W); assert.strictEqual(bad[0].y, 0); assert.strictEqual(bad[0].c, 0);
  assert.strictEqual(bad[1].t, '5'); assert.strictEqual(bad[1].x, 10); assert.strictEqual(bad[1].y, 21); assert.strictEqual(bad[1].c, 3);
  assert.strictEqual(LG.sbNormalize(Array.from({ length: 150 }, (_, i) => ({ id: 'n' + i }))).length, 100); assert.deepStrictEqual(LG.sbNormalize('x'), []);
});

t('resume escaping, templates and text', () => {
  const evil = '<script>alert(1)</script> & "q" \'s\' <img src=x onerror=1>';
  const r = { tpl: 1, contact: { name: evil, title: evil, email: evil, phone: evil, place: evil, link: 'javascript:alert(1)' }, summary: evil + '\n- ' + evil, exp: [{ role: evil, org: evil, period: evil, desc: '- ' + evil + '\nplain ' + evil }], edu: [{ school: evil, degree: evil, period: evil, desc: evil }], skills: evil + ', b' };
  for (let tpl = 0; tpl < 3; tpl++) {
    const h = LG.resumeHtml(r, tpl);
    assert(!/<script|<img|onerror=1>/i.test(h.replace(/&lt;script&gt;|&lt;img[^]*?&gt;/g, '')), 'no live tags, template ' + tpl);
    assert(!h.includes('<script') && !h.includes('<img'), 'escaped');
    assert(h.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;q&quot; &#39;s&#39;'));
    assert(h.startsWith('<!DOCTYPE html>') && h.includes('<meta charset="utf-8">') && h.includes("default-src 'none'") && !h.includes('<a '));
    assert(h.includes('<ul><li>') && h.includes('<p>plain'));
  }
  assert(LG.resumeHtml(r, 1).includes('<span>b</span>') && !LG.resumeHtml(r, 0).includes('<span>b</span>'));
  const empty = LG.resumeHtml({}, 0); assert(empty.includes('Your name') && !empty.includes('<h2>'));
  const tx = LG.resumeText({ contact: { name: 'Asha K', title: 'Engineer', email: 'a@b.co', phone: '', place: 'Pune', link: '' }, summary: 'Builds apps.', exp: [{ role: 'Dev', org: 'Acme', period: '2020 - 2024', desc: '- Shipped things' }], edu: [{ school: 'MIT', degree: 'BSc', period: '2016', desc: '' }], skills: 'JS, Go;  Rust' });
  assert.strictEqual(tx, 'ASHA K\nEngineer\na@b.co | Pune\n\nSUMMARY\nBuilds apps.\n\nEXPERIENCE\nDev, Acme (2020 - 2024)\n- Shipped things\n\nEDUCATION\nBSc, MIT (2016)\n\nSKILLS\nJS, Go, Rust\n');
  const n = LG.resumeNormalize({ tpl: 9, contact: { name: 'x'.repeat(500) }, exp: Array.from({ length: 40 }, () => ({ role: 5 })), edu: 'nope', skills: 'y'.repeat(900) });
  assert.strictEqual(n.tpl, 0); assert.strictEqual(n.contact.name.length, 80); assert.strictEqual(n.exp.length, 15); assert.strictEqual(n.exp[0].role, '5'); assert.deepStrictEqual(n.edu, []); assert.strictEqual(n.skills.length, 500);
  assert.strictEqual(LG.resumeNormalize(null).contact.name, ''); assert.deepStrictEqual(LG.skillList('a,,b ;c\n d'), ['a', 'b', 'c', 'd']);
  assert.strictEqual(LG.htmlEsc(null), '');
});

/*TESTS-END*/
console.log(process.exitCode ? 'life tests FAILED' : 'life tests passed (' + n + ')');
