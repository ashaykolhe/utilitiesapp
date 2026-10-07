'use strict';
/* Functional tests, more.js part 2: Meeting Cost, Life Calendar, Word Finder, Number Patterns, Matrix, Trig Circle, Periodic Table,
   Country Codes, Colour Blind Sim, ASCII Art, Silly Names, Image Palette. */
const { suite } = require('../helpers/page');
const { bootFx, clock, fakeShare, morePure } = require('./fx');
const P = morePure('meetingCost, clock, weeksLived, dayFromStr, findAnagrams, findFrom, findPattern, WORDS, fibList, primesTo, collatz, factorise, mxAdd, mxMul, mxDet, mxInv, mxT, mxParseCell, trigExact, radLabel, trigVals, ELEMENTS, EL_CATS, COUNTRIES, ccSearch, flagOf, cbPixel, asciiArt, genName, NG, medianCut, rgb2hex');

(async () => {
  const T = suite('more-2'), page = await bootFx(), w = page.w;
  const log = (m) => { if (process.env.V) console.log('>> ' + m + ' errors=' + page.errors.length); };
  const toastText = () => w.document.querySelector('#toast').textContent;
  const defNav = (name, value) => Object.defineProperty(w.navigator, name, { value, configurable: true });
  const copied = []; defNav('clipboard', { writeText: async (t) => { copied.push(t); }, readText: async () => '' });
  const store = (k) => JSON.parse(w.localStorage.getItem('pk.' + k) || 'null');
  w.Element.prototype.scrollIntoView = function () {};
  const clk = clock(page, '2026-03-10T10:00:00Z');
  const share = fakeShare(page);

  /* ---------- Meeting Cost ---------- */
  log('meetingcost');
  {
    T.near(P.meetingCost(6, 25, 60000), 2.5, 1e-9, 'meetingcost: 6 people x 25/h for a minute is 2.50');
    T.ok(Number.isNaN(P.meetingCost(0, 25, 1000)), 'meetingcost: 0 people is not a cost');
    T.eq(P.clock(3725000), '1:02:05', 'meetingcost: clock formats hours'); T.eq(P.clock(59000), '00:59', 'meetingcost: clock formats seconds');
    const t = await page.open('meetingcost');
    T.has(t.q('#pm').textContent, '$2.50 per minute · $150.00 per hour', 'meetingcost: per minute and per hour');
    t.click('#go'); await clk.advance(60000);
    T.eq(t.q('#cost').textContent, '$2.50', 'meetingcost: $2.50 after one minute'); T.eq(t.q('#clk').textContent, '01:00', 'meetingcost: clock 01:00');
    t.click('#go'); T.eq(t.q('#go').textContent, 'Resume', 'meetingcost: pause'); await clk.advance(30000); T.eq(t.q('#cost').textContent, '$2.50', 'meetingcost: paused meter holds');
    t.type('#rt', '50'); t.click('#go'); await clk.advance(60000);
    T.eq(t.q('#cost').textContent, '$7.50', 'meetingcost: new rate only applies from then on (2.50 + 5.00)');
    T.eq(t.q('#clk').textContent, '02:00', 'meetingcost: running time 02:00');
    t.type('#pp', '10'); await clk.advance(60000); T.eq(t.q('#cost').textContent, '$15.83', 'meetingcost: 10 people at 50/h for another minute adds 8.33');
    t.type('#sy', '€'); T.has(t.q('#cost').textContent, '€', 'meetingcost: symbol');
    await clk.advance(3600000); T.has(t.q('#clk').textContent, '1:0', 'meetingcost: an hour shows h:mm:ss');
    t.click('#rs'); T.eq(t.q('#clk').textContent, '00:00', 'meetingcost: reset'); T.eq(t.q('#go').textContent, 'Start', 'meetingcost: back to Start');
    T.eq(store('meetingcost.people'), 10, 'meetingcost: people remembered');
    const n0 = clk.timers(); t.click('#go'); t.close(); T.ok(clk.timers() <= n0, 'meetingcost: interval cleared on leaving');
    w.localStorage.removeItem('pk.meetingcost.people'); w.localStorage.removeItem('pk.meetingcost.rate'); w.localStorage.removeItem('pk.meetingcost.sym');
  }

  /* ---------- Life Calendar ---------- */
  log('lifecal');
  {
    const days = (Date.UTC(2026, 2, 10) - Date.UTC(1990, 4, 15)) / 864e5, wl = Math.floor(days / 7);
    T.eq(P.weeksLived(P.dayFromStr('1990-05-15'), Date.UTC(2026, 2, 10) / 864e5), wl, 'lifecal: weeks lived (pure)');
    T.ok(Number.isNaN(P.weeksLived(10, 5)), 'lifecal: a birth date in the future is not valid');
    T.ok(Number.isNaN(P.dayFromStr('1850-01-01')), 'lifecal: years before 1900 are refused');
    const t = await page.open('lifecal');
    T.has(t.q('#st').textContent, 'Enter a valid birth date', 'lifecal: asks for a date at first');
    t.type('#db', '1990-05-15');
    T.has(t.q('#st').textContent, wl.toLocaleString() + 'weeks lived', 'lifecal: weeks lived ' + wl);
    T.has(t.q('#st').textContent, (4160 - wl).toLocaleString() + 'weeks left', 'lifecal: weeks left in 80 years');
    T.has(t.q('#st').textContent, (wl / 4160 * 100).toFixed(1) + '%', 'lifecal: percentage');
    T.has(t.q('#st').textContent, days.toLocaleString() + ' days · about 35 years old', 'lifecal: days and years');
    t.type('#sp', '90'); T.has(t.q('#st').textContent, (4680 - wl).toLocaleString() + 'weeks left', 'lifecal: 90 expected years');
    t.type('#db', '2030-01-01'); T.has(t.q('#st').textContent, 'Enter a valid birth date in the past', 'lifecal: future date refused');
    t.type('#db', '2026-03-10'); T.has(t.q('#st').textContent, '0weeks lived', 'lifecal: born today has 0 weeks');
    t.type('#db', '1900-01-01'); T.ok(!/NaN/.test(t.text()), 'lifecal: a very old date works');
    t.close();
    const t2 = await page.open('lifecal'); T.eq(t2.value('#sp'), '90', 'lifecal: expected years remembered'); t2.close();
  }

  /* ---------- Word Finder ---------- */
  log('anagram');
  {
    const key = (s) => s.split('').sort().join('');
    const brute = (letters, minLen) => { const have = {}; let blanks = 0; for (const ch of letters) { if (ch === '?') blanks++; else have[ch] = (have[ch] || 0) + 1; } const total = letters.length; return P.WORDS.filter((word) => { if (word.length < minLen || word.length > total) return false; const need = {}; for (const ch of word) need[ch] = (need[ch] || 0) + 1; let miss = 0; for (const ch in need) miss += Math.max(0, need[ch] - (have[ch] || 0)); return miss <= blanks; }); };
    for (const letters of ['listen', 'retains', 'a?e', 'plnet?', 'crazy', 'qxz']) {
      const got = P.findFrom(letters, P.WORDS, 3).slice().sort().join(), want = brute(letters, 3).slice().sort().join();
      T.eq(got, want, 'anagram: words from "' + letters + '" match a brute-force count');
    }
    T.eq(P.findAnagrams('listen', P.WORDS).slice().sort().join(), P.WORDS.filter((x) => x !== 'listen' && key(x) === key('listen')).sort().join(), 'anagram: anagrams of listen');
    T.ok(P.findAnagrams('listen', P.WORDS).includes('silent'), 'anagram: silent is an anagram of listen');
    T.ok(P.findPattern('c?t', P.WORDS).includes('cat') && P.findPattern('c?t', P.WORDS).every((x) => /^c.t$/.test(x)), 'anagram: pattern c?t');
    T.ok(P.findPattern('un*ing', P.WORDS).every((x) => /^un[a-z]*ing$/.test(x)), 'anagram: pattern un*ing');
    T.eq(P.findFrom('', P.WORDS, 2).length, 0, 'anagram: nothing typed finds nothing');
    const t = await page.open('anagram');
    const chips = () => t.all('#out span[style*="border-radius:99px"]').map((s) => s.textContent);
    t.type('#q', 'listen'); t.type('#ml', '6');
    T.eq(chips().sort().join(), brute('listen', 6).sort().join(), 'anagram: screen lists the 6 letter words from "listen"');
    t.type('#ml', '2'); T.eq(chips().length, brute('listen', 2).length, 'anagram: minimum length 2 shows more words');
    T.has(t.q('#out').textContent, brute('listen', 2).length + ' words found', 'anagram: count line');
    t.clickText('Anagrams'); T.eq(t.value('#q'), '', 'anagram: switching tab clears the box');
    t.type('#q', 'listen'); T.ok(chips().includes('silent') && !chips().includes('listen'), 'anagram: the word itself is not offered');
    t.clickText('Pattern'); t.type('#q', 'c?t'); T.ok(chips().includes('cat'), 'anagram: pattern tab');
    t.type('#q', 'zzzzqq'); T.has(t.q('#out').textContent, 'No words found', 'anagram: no match message');
    T.eq(store('anagram.mode'), 'pat', 'anagram: mode remembered');
    t.type('#q', '<b>'); T.ok(!t.has('#out b'), 'anagram: input is not treated as HTML');
    t.close();
  }

  /* ---------- Number Patterns ---------- */
  log('sequences');
  {
    T.eq(P.fibList(20).slice(-1)[0].toString(), '4181', 'sequences: F(19) = 4181'); const fd = (n) => { if (n === 0n) return [0n, 1n]; const [a, b] = fd(n / 2n), c = a * (2n * b - a), d = a * a + b * b; return n % 2n ? [d, c + d] : [c, d]; };
    const F149 = fd(149n)[0].toString();
    T.eq(P.fibList(150).slice(-1)[0].toString(), F149, 'sequences: F(149) matches a fast-doubling calculation (' + F149 + ')');
    T.eq(fd(90n)[0].toString(), '2880067194370816120', 'sequences: reference F(90) = 2880067194370816120');
    T.eq(P.primesTo(100).length, 25, 'sequences: 25 primes up to 100'); T.eq(P.primesTo(1000).length, 168, 'sequences: 168 primes up to 1000');
    T.eq(P.factorise(360).join(), '2,2,2,3,3,5', 'sequences: 360 = 2^3 x 3^2 x 5'); T.eq(P.factorise(999999999999).join(), '3,3,3,7,11,13,37,101,9901', 'sequences: 999999999999 factors');
    let c = P.collatz(27, 5000); T.eq(c.steps + ':' + c.peak, '111:9232', 'sequences: Collatz 27 takes 111 steps and peaks at 9232');
    c = P.collatz(97, 5000); T.eq(c.steps, 118, 'sequences: Collatz 97 takes 118 steps'); T.eq(P.collatz(1).steps, 0, 'sequences: Collatz 1 takes 0 steps'); T.eq(P.collatz(0), null, 'sequences: Collatz 0 refused');
    const t = await page.open('sequences');
    T.has(t.q('#r').textContent, '1.6180339887', 'sequences: golden ratio reference');
    T.has(t.q('#r').textContent, '1.6180339887'.slice(0, 5), 'sequences: ratio of F(19)/F(18)'); T.has(t.q('#r').textContent, '4181', 'sequences: 20 Fibonacci terms end at 4181');
    T.has(t.q('#r').textContent, (4181 / 2584).toFixed(10), 'sequences: F19/F18 = ' + (4181 / 2584).toFixed(10));
    t.type('#n', '150'); T.has(t.q('#r').textContent, F149, 'sequences: 150 terms are exact (BigInt)');
    t.type('#n', '2'); T.ok(!/NaN/.test(t.q('#r').textContent), 'sequences: two terms show no ratio');
    t.clickText('Primes'); T.has(t.q('#r').textContent, '25 primes up to 100 (25.0%)', 'sequences: primes up to 100');
    T.has(t.q('#fr').innerHTML, '2<sup>3</sup> × 3<sup>2</sup> × 5', 'sequences: factorise 360');
    t.type('#f', '97'); T.has(t.q('#fr').textContent, '97 is prime', 'sequences: 97 is prime');
    t.type('#f', '999999999989'); T.has(t.q('#fr').textContent, 'is prime', 'sequences: 999999999989 is prime');
    t.type('#f', ''); T.has(t.q('#fr').textContent, 'Enter a whole number from 2', 'sequences: an empty number is refused');
    t.type('#n', '1000'); T.has(t.q('#r').textContent, '168 primes up to 1000', 'sequences: 168 primes up to 1000 on screen');
    t.clickText('Triangular'); T.has(t.q('#r').textContent, '15: 120', 'sequences: 15th triangular number is 120');
    t.clickText('Collatz'); T.has(t.q('#r').textContent, '111', 'sequences: Collatz steps'); T.has(t.q('#r').textContent, '9,232', 'sequences: Collatz peak 9,232');
    t.type('#n', '1'); T.ok(!/NaN|Infinity/.test(t.text()), 'sequences: Collatz of 1 is fine');
    t.close();
  }

  /* ---------- Matrix Calc ---------- */
  log('matrix');
  {
    const A = [[1, 2, 3], [0, 1, 4], [5, 6, 0]];
    T.eq(JSON.stringify(P.mxInv(A)), JSON.stringify([[-24, 18, 5], [20, -15, -4], [-5, 4, 1]]), 'matrix: inverse of the classic 3x3');
    T.eq(P.mxDet(A), 1, 'matrix: its determinant is 1');
    const D4 = [[1, 0, 2, -1], [3, 0, 0, 5], [2, 1, 4, -3], [1, 0, 5, 0]];
    const cof = (M) => M.length === 1 ? M[0][0] : M[0].reduce((s, v, j) => s + (j % 2 ? -1 : 1) * v * cof(M.slice(1).map((r) => r.filter((_, k) => k !== j))), 0);
    T.eq(cof(D4), 30, 'matrix: reference cofactor determinant is 30'); T.eq(P.mxDet(D4), 30, 'matrix: 4x4 determinant 30');
    T.eq(JSON.stringify(P.mxMul([[1, 2, 3], [4, 5, 6]], [[7, 8], [9, 10], [11, 12]])), JSON.stringify([[58, 64], [139, 154]]), 'matrix: 2x3 times 3x2');
    T.eq(P.mxMul([[1, 2]], [[1, 2]]), null, 'matrix: mismatched sizes give null'); T.eq(P.mxInv([[1, 2], [2, 4]]), null, 'matrix: singular has no inverse');
    T.eq(P.mxParseCell('1/2'), 0.5, 'matrix: fraction cell'); T.eq(P.mxParseCell('-3/4'), -0.75, 'matrix: negative fraction'); T.ok(Number.isNaN(P.mxParseCell('abc')), 'matrix: junk is NaN'); T.ok(Number.isNaN(P.mxParseCell('1/0')), 'matrix: 1/0 is NaN');
    const t = await page.open('matrix');
    const cells = () => t.all('#res span').map((s) => s.textContent);
    const set = (k, i, j, v) => t.type('input[data-k="' + k + '"][data-i="' + i + '"][data-j="' + j + '"]', v);
    T.eq(cells().join(), '2,1,5,3', 'matrix: A x I = A on the default matrices');
    t.click('[data-op="det"]'); T.has(t.q('#res').textContent, '1', 'matrix: det([[2,1],[5,3]]) = 1');
    t.click('[data-op="inv"]'); T.eq(cells().join(), '3,-1,-5,2', 'matrix: inverse of [[2,1],[5,3]]');
    t.click('[data-op="tr"]'); T.eq(cells().join(), '2,5,1,3', 'matrix: transpose');
    set('a', 0, 0, '1'); set('a', 0, 1, '2'); set('a', 1, 0, '3'); set('a', 1, 1, '4');
    t.click('[data-op="inv"]'); T.eq(cells().join(), '-2,1,3/2,-1/2', 'matrix: inverse of [[1,2],[3,4]] shows fractions');
    t.click('[data-op="add"]'); T.eq(cells().join(), '2,2,3,5', 'matrix: A + I');
    t.click('[data-op="sub"]'); T.eq(cells().join(), '0,2,3,3', 'matrix: A - I');
    set('a', 0, 0, '1/2'); t.click('[data-op="add"]'); T.eq(cells().join(), '3/2,2,3,5', 'matrix: fractions in cells');
    set('a', 0, 0, 'x'); T.has(t.q('#res').textContent, 'not numbers', 'matrix: junk cell message');
    set('a', 0, 0, '1');
    t.select('select[data-k="a"][data-d="0"]', '3'); T.eq(t.all('#ga input').length, 6, 'matrix: A is now 3 rows by 2 columns');
    t.click('[data-op="add"]'); T.has(t.q('#res').textContent, 'same size', 'matrix: size mismatch message');
    t.click('[data-op="det"]'); T.has(t.q('#res').textContent, 'square', 'matrix: determinant needs a square matrix');
    t.click('[data-op="bmul"]'); T.has(t.q('#res').textContent, 'columns', 'matrix: product mismatch message');
    t.select('select[data-k="a"][data-d="0"]', '2');
    set('a', 0, 0, '1'); set('a', 0, 1, '2'); set('a', 1, 0, '2'); set('a', 1, 1, '4');
    t.click('[data-op="inv"]'); T.has(t.q('#res').textContent, 'singular', 'matrix: singular message');
    t.click('[data-op="det"]'); T.has(t.q('#res').textContent, 'no inverse', 'matrix: zero determinant note');
    t.select('select[data-k="a"][data-d="0"]', '4'); t.select('select[data-k="a"][data-d="1"]', '4');
    const rows = [[1, 0, 2, -1], [3, 0, 0, 5], [2, 1, 4, -3], [1, 0, 5, 0]];
    rows.forEach((r, i) => r.forEach((v, j) => set('a', i, j, String(v))));
    t.click('[data-op="det"]'); T.has(t.q('#res .mid').textContent, '30', 'matrix: 4x4 determinant on screen');
    t.close();
  }

  /* ---------- Trig Circle ---------- */
  log('trig');
  {
    const e = (d) => P.trigExact(d);
    T.eq(JSON.stringify(e(30)), JSON.stringify({ sin: '1/2', cos: '√3/2', tan: '√3/3' }), 'trig: exact values at 30');
    T.eq(JSON.stringify(e(150)), JSON.stringify({ sin: '1/2', cos: '-√3/2', tan: '-√3/3' }), 'trig: exact values at 150');
    T.eq(JSON.stringify(e(225)), JSON.stringify({ sin: '-√2/2', cos: '-√2/2', tan: '1' }), 'trig: exact values at 225');
    T.eq(JSON.stringify(e(300)), JSON.stringify({ sin: '-√3/2', cos: '1/2', tan: '-√3' }), 'trig: exact values at 300');
    T.eq(e(90).tan, 'undefined', 'trig: tan 90 undefined'); T.eq(e(270).cos, '0', 'trig: cos 270 is 0'); T.eq(e(360).sin, '0', 'trig: sin 360 is 0'); T.eq(e(-30).sin, '-1/2', 'trig: negative angles'); T.eq(e(37), null, 'trig: 37 has no exact form');
    T.eq(P.radLabel(150), '5π/6', 'trig: 150 degrees is 5π/6'); T.eq(P.radLabel(180), 'π', 'trig: 180 degrees is π'); T.eq(P.radLabel(360), '2π', 'trig: 360 degrees is 2π'); T.eq(P.radLabel(45), 'π/4', 'trig: 45 degrees is π/4'); T.eq(P.radLabel(0), '0', 'trig: 0');
    let worst = 0; for (let a = 0; a < 360; a += 15) { const x = e(a); if (!x) continue; const v = P.trigVals(a), ev = (s) => s === 'undefined' ? NaN : eval(s.replace(/√(\d)/g, 'Math.sqrt($1)')); const dd = Math.max(Math.abs(v.sin - ev(x.sin)), Math.abs(v.cos - ev(x.cos)), Number.isNaN(v.tan) ? 0 : Math.abs(v.tan - ev(x.tan))); worst = Math.max(worst, dd); }
    T.ok(worst < 1e-9, 'trig: every exact string agrees with Math.sin/cos/tan (worst error ' + worst + ')');
    const t = await page.open('trig');
    T.eq(t.q('#s').textContent, '0.5', 'trig: sin 30'); T.eq(t.q('#c').textContent, '0.866', 'trig: cos 30'); T.eq(t.q('#t').textContent, '0.5774', 'trig: tan 30');
    T.has(t.q('#ex').textContent, 'sin = 1/2, cos = √3/2, tan = √3/3', 'trig: exact line');
    t.type('#dg', '150'); T.eq(t.q('#s').textContent, '0.5', 'trig: sin 150'); T.eq(t.q('#c').textContent, '-0.866', 'trig: cos 150'); T.eq(t.q('#t').textContent, '-0.5774', 'trig: tan 150'); T.has(t.q('#rd').textContent, '5π/6', 'trig: radians shown as a multiple of pi'); T.has(t.q('#rd').textContent, '2.618 rad', 'trig: radians value');
    t.type('#dg', '90'); T.eq(t.q('#t').textContent, 'undefined', 'trig: tan 90 shows undefined'); T.eq(t.q('#c').textContent, '0', 'trig: cos 90 is exactly 0');
    t.type('#dg', '750'); T.has(t.q('#av').textContent, '30°', 'trig: 750 degrees wraps to 30');
    t.type('#dg', '-30'); T.has(t.q('#av').textContent, '330°', 'trig: -30 degrees wraps to 330');
    t.type('#dg', '45'); T.eq(t.q('#t').textContent, '1', 'trig: tan 45'); t.type('#dg', ''); T.ok(!/NaN/.test(t.text()), 'trig: empty angle is ignored');
    T.eq(t.all('#tb tr').length, 17, 'trig: table has 17 exact angles'); t.click('[data-a="225"]'); T.eq(t.q('#s').textContent, '-0.7071', 'trig: clicking a table row selects it');
    t.type('#sl', '180'); T.eq(t.q('#s').textContent, '0', 'trig: slider to 180');
    t.close();
  }

  /* ---------- Periodic Table ---------- */
  log('periodic');
  {
    const SYMS = 'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'.split(' ');
    T.eq(SYMS.length, 118, 'periodic: reference list has 118 symbols'); T.eq(P.ELEMENTS.map((x) => x.sym).join(' '), SYMS.join(' '), 'periodic: all 118 symbols are in the right order');
    const cnt = {}; P.ELEMENTS.forEach((x) => { cnt[x.cat] = (cnt[x.cat] || 0) + 1; });
    T.eq(['nonmetal', 'noble', 'alkali', 'alkaline', 'metalloid', 'post', 'trans', 'halogen', 'lanth', 'actin'].map((k) => k + cnt[k]).join(), 'nonmetal7,noble7,alkali6,alkaline6,metalloid6,post12,trans38,halogen6,lanth15,actin15', 'periodic: category counts (7 nonmetals, 7 noble gases, 6 alkali, 6 alkaline earth, 6 metalloids, 12 post-transition, 38 transition, 6 halogens, 15 + 15 f-block)');
    T.eq(Object.keys(P.EL_CATS).length, 10, 'periodic: ten categories');
    const by = (s) => P.ELEMENTS.find((x) => x.sym === s);
    T.eq(by('Fe').z + ':' + by('Fe').r + ':' + by('Fe').c, '26:4:8', 'periodic: Fe is element 26 at period 4 group 8'); T.eq(by('He').r + ':' + by('He').c, '1:18', 'periodic: He at the far right');
    T.eq(by('La').r + ':' + by('La').c, '9:3', 'periodic: La starts the lanthanide row'); T.eq(by('Hf').r + ':' + by('Hf').c, '6:4', 'periodic: Hf is group 4'); T.eq(by('Og').r + ':' + by('Og').c, '7:18', 'periodic: Og last'); T.eq(by('Rf').r + ':' + by('Rf').c, '7:4', 'periodic: Rf group 4');
    T.eq(by('B').c, 13, 'periodic: B is group 13'); T.eq(by('Al').r + ':' + by('Al').c, '3:13', 'periodic: Al');
    T.eq(P.ELEMENTS.filter((x) => x.state === 'Gas').length, 11, 'periodic: 11 gases'); T.eq(P.ELEMENTS.filter((x) => x.state === 'Liquid').map((x) => x.sym).join(), 'Br,Hg', 'periodic: liquids are Br and Hg');
    T.near(by('C').mass, 12.011, 1e-9, 'periodic: carbon mass'); T.near(by('U').mass, 238.03, 1e-9, 'periodic: uranium mass'); T.near(by('Au').mass, 196.97, 1e-9, 'periodic: gold mass');
    const pos = new Set(P.ELEMENTS.map((x) => x.r + ':' + x.c)); T.eq(pos.size, 118, 'periodic: no two elements share a cell');
    const t = await page.open('periodic');
    T.eq(t.all('#tb [data-z]').length, 118, 'periodic: 118 cells on screen');
    T.has(t.q('#det').textContent, 'Carbon', 'periodic: carbon is selected at first'); T.has(t.q('#det').textContent, 'Atomic mass 12.011 u', 'periodic: detail mass');
    t.type('#q', 'gold'); t.click('[data-h]'); T.has(t.q('#det').textContent, 'Gold', 'periodic: search by name'); T.has(t.q('#det').textContent, 'Atomic number 79', 'periodic: gold is 79'); T.has(t.q('#det').textContent, 'Transition metal', 'periodic: gold category');
    t.type('#q', 'fe'); t.click('[data-h]'); T.has(t.q('#det').textContent, 'Iron', 'periodic: search by symbol');
    t.type('#q', '92'); t.click('[data-h]'); T.has(t.q('#det').textContent, 'Uranium', 'periodic: search by number');
    t.type('#q', 'zzz'); T.has(t.q('#hits').textContent, 'No match', 'periodic: no match');
    t.click('[data-z="10"]'); T.has(t.q('#det').textContent, 'Neon', 'periodic: tapping a cell selects it'); T.has(t.q('#det').textContent, 'Gas', 'periodic: neon is a gas');
    T.eq(store('periodic.sel'), 10, 'periodic: selection remembered');
    t.click('[data-cat="noble"]'); T.eq(t.all('#tb [data-z]').filter((b) => b.style.opacity === '0.22').length, 111, 'periodic: highlighting a group dims the other 111 elements');
    t.click('[data-cat="noble"]'); T.eq(t.all('#tb [data-z]').filter((b) => b.style.opacity === '0.22').length, 0, 'periodic: tap again to clear');
    t.close();
  }

  /* ---------- Country Codes ---------- */
  log('countrycodes');
  {
    T.ok(P.COUNTRIES.length >= 100, 'countrycodes: about 100 countries (' + P.COUNTRIES.length + ')');
    T.eq(new Set(P.COUNTRIES.map((c) => c.a2)).size, P.COUNTRIES.length, 'countrycodes: ISO2 codes are unique'); T.eq(new Set(P.COUNTRIES.map((c) => c.a3)).size, P.COUNTRIES.length, 'countrycodes: ISO3 codes are unique');
    const get = (a2) => P.COUNTRIES.find((c) => c.a2 === a2);
    const known = { IN: ['IND', '91', 'INR', 'India'], JP: ['JPN', '81', 'JPY', 'Japan'], US: ['USA', '1', 'USD', 'United States'], GB: ['GBR', '44', 'GBP', 'United Kingdom'], DE: ['DEU', '49', 'EUR', 'Germany'], FR: ['FRA', '33', 'EUR', 'France'], AU: ['AUS', '61', 'AUD', 'Australia'], BR: ['BRA', '55', 'BRL', 'Brazil'], ZA: ['ZAF', '27', 'ZAR', 'South Africa'], CH: ['CHE', '41', 'CHF', 'Switzerland'], AE: ['ARE', '971', 'AED', 'United Arab Emirates'], KR: ['KOR', '82', 'KRW', 'South Korea'], NP: ['NPL', '977', 'NPR', 'Nepal'], LK: ['LKA', '94', 'LKR', 'Sri Lanka'], SG: ['SGP', '65', 'SGD', 'Singapore'], CA: ['CAN', '1', 'CAD', 'Canada'] };
    for (const k of Object.keys(known)) { const c = get(k); T.eq(c ? [c.a3, c.dial, c.cur, c.name].join('|') : null, known[k].join('|'), 'countrycodes: ' + k + ' data'); }
    T.eq(P.flagOf('IN'), '🇮🇳', 'countrycodes: flag of India'); T.eq(P.flagOf('US'), '🇺🇸', 'countrycodes: flag of the US');
    T.eq(P.ccSearch('+44', P.COUNTRIES).map((c) => c.a2).join(), 'GB', 'countrycodes: +44 is the UK only'); T.eq(P.ccSearch('+1', P.COUNTRIES).map((c) => c.a2).sort().join(), 'CA,DO,JM,US', 'countrycodes: +1 is shared by 4 countries here');
    const t = await page.open('countrycodes');
    T.eq(t.all('#ls [data-d]').length, P.COUNTRIES.length, 'countrycodes: all countries listed first'); T.has(t.q('#n').textContent, P.COUNTRIES.length + ' of ' + P.COUNTRIES.length, 'countrycodes: count line');
    t.type('#q', 'india'); T.eq(t.all('#ls [data-d]').length, 1, 'countrycodes: search by name'); T.has(t.q('#ls').textContent, '+91', 'countrycodes: India dial code'); T.has(t.q('#ls').textContent, 'IN · IND · INR', 'countrycodes: India codes'); T.has(t.q('#ls').textContent, '🇮🇳', 'countrycodes: India flag');
    t.click('[data-d]'); await page.wait(5); T.eq(copied[copied.length - 1], '+91', 'countrycodes: tapping copies the dial code');
    t.type('#q', 'JP'); T.has(t.q('#ls').textContent, 'Japan', 'countrycodes: search by ISO2'); t.type('#q', 'eur'); T.ok(t.all('#ls [data-d]').length > 15, 'countrycodes: search by currency code finds the euro countries');
    t.type('#q', '+9'); T.ok(t.all('#ls [data-d]').length > 5, 'countrycodes: dial prefix search'); t.type('#q', 'zzz'); T.has(t.q('#ls').textContent, 'No match', 'countrycodes: no match');
    t.type('#q', '<img src=x>'); T.ok(!t.has('#ls img'), 'countrycodes: input is not HTML');
    t.close();
  }

  /* ---------- picture tools (fake canvas pixels) ---------- */
  const pic = { w: 2, h: 2, px: (i) => [0, 0, 0, 255] };
  const origClick = w.HTMLInputElement.prototype.click;
  w.HTMLInputElement.prototype.click = function () { if (this.type === 'file') { Object.defineProperty(this, 'files', { value: [{ type: 'image/png', size: 100, name: 'x.png' }] }); if (this.onchange) this.onchange(); } else origClick.call(this); };
  w.URL.createObjectURL = () => 'blob:fake'; w.URL.revokeObjectURL = () => {};
  w.Image = function () { const o = { naturalWidth: 0, naturalHeight: 0 }; Object.defineProperty(o, 'src', { set() { o.naturalWidth = pic.w; o.naturalHeight = pic.h; Promise.resolve().then(() => o.onload && o.onload()); } }); return o; };
  w.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/jpeg;base64,AA';
  w.HTMLCanvasElement.prototype.getContext = function () {
    const cv = this, noop = () => {};
    return new Proxy({}, { get: (t, k) => {
      if (k === 'getImageData') return (x, y, ww, hh) => { const d = new Uint8ClampedArray(ww * hh * 4); for (let i = 0; i < ww * hh; i++) { const v = pic.px(i, ww, hh); d.set(v, i * 4); } return { data: d, width: ww, height: hh }; };
      if (k === 'createImageData') return (ww, hh) => ({ data: new Uint8ClampedArray(ww * hh * 4), width: ww, height: hh });
      if (k === 'putImageData') return (im) => { cv.__put = im; };
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'canvas') return cv;
      return noop;
    }, set: () => true });
  };

  /* ---------- Colour Blind Sim ---------- */
  log('cbsim');
  {
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const srgb = (l) => { l = Math.min(1, Math.max(0, l)); return Math.round(255 * (l <= 0.0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055)); };
    const gray = (r, g, b) => { const y = srgb(0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)); return [y, y, y]; };
    T.eq(P.cbPixel(255, 0, 0, 'achro').join(), gray(255, 0, 0).join(), 'cbsim: pure red as grey scale');
    for (const ty of ['protan', 'deutan', 'tritan', 'achro']) { T.eq(P.cbPixel(255, 255, 255, ty).join(), '255,255,255', 'cbsim: white stays white (' + ty + ')'); T.eq(P.cbPixel(0, 0, 0, ty).join(), '0,0,0', 'cbsim: black stays black (' + ty + ')'); T.eq(P.cbPixel(128, 128, 128, ty).join(), '128,128,128', 'cbsim: grey stays grey (' + ty + ')'); }
    const M = { deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]] };
    T.eq(P.cbPixel(255, 0, 0, 'deutan').join(), M.deutan.map((r) => srgb(r[0])).join(), 'cbsim: deuteranopia turns pure red into ' + M.deutan.map((r) => srgb(r[0])).join(','));
    pic.w = 2; pic.h = 2; pic.px = (i) => [[255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255], [255, 255, 255, 200]][i];
    const t = await page.open('cbsim');
    T.has(t.q('#ds').textContent, 'No green cones', 'cbsim: description of the default type'); T.ok(t.q('#vw').hidden, 'cbsim: no pictures before a photo is chosen');
    t.click('#pk'); await page.wait(20);
    T.ok(!t.q('#vw').hidden, 'cbsim: pictures appear after choosing a photo');
    const out = () => [...t.q('#c1').__put.data];
    const want = (ty) => [[255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255], [255, 255, 255, 200]].flatMap(([r, g, b, a]) => [...P.cbPixel(r, g, b, ty), a]);
    T.eq(out().join(), want('deutan').join(), 'cbsim: deuteranopia output for the 4 test pixels (alpha kept)');
    t.select('#ty', 'tritan'); T.eq(out().join(), want('tritan').join(), 'cbsim: tritanopia output'); T.has(t.q('#tl').textContent, 'Tritanopia', 'cbsim: label follows the type');
    t.select('#ty', 'achro'); T.eq(out().slice(0, 3).join(), gray(255, 0, 0).join(), 'cbsim: achromatopsia red pixel');
    share.files.length = 0; t.click('#sv'); await page.wait(40); T.has((share.last() || {}).path || '', 'colour-blind-achro.png', 'cbsim: save file name');
    t.close();
  }

  /* ---------- ASCII Art ---------- */
  log('asciiart');
  {
    const ramp = ' .:-=+*#%@';
    T.eq(P.asciiArt(new Float32Array(8 * 4).fill(0), 8, 4, 4, ramp, false), '@@@@', 'asciiart: black prints the densest character');
    T.eq(P.asciiArt(new Float32Array(8 * 4).fill(255), 8, 4, 4, ramp, false), '', 'asciiart: white prints blanks (trailing spaces trimmed)');
    T.eq(P.asciiArt(new Float32Array(8 * 4).fill(255), 8, 4, 4, ramp, true), '@@@@', 'asciiart: invert flips it');
    const half = new Float32Array(8 * 4); for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) half[y * 8 + x] = x < 4 ? 0 : 255;
    T.eq(P.asciiArt(half, 8, 4, 8, ramp, false), '@@@@\n@@@@', 'asciiart: left black right white');
    pic.w = 60; pic.h = 30; pic.px = (i, ww) => { const v = (i % ww) < 30 ? 0 : 255; return [v, v, v, 255]; };
    const t = await page.open('asciiart');
    t.click('#cp'); T.eq(toastText(), 'Pick a picture first', 'asciiart: copy before choosing a picture');
    t.click('#pk'); await page.wait(20); t.type('#cl', '20');
    T.eq(t.q('#pre').textContent, Array(5).fill('@'.repeat(10)).join('\n'), 'asciiart: a 60x30 picture, left half black, at 20 characters wide');
    t.click('#iv'); T.eq(t.q('#pre').textContent, Array(5).fill(' '.repeat(10) + '@'.repeat(10)).join('\n'), 'asciiart: invert');
    t.click('#iv'); t.select('#rp', 'blocks'); T.has(t.q('#pre').textContent, '█', 'asciiart: block characters'); T.ok(!/@/.test(t.q('#pre').textContent), 'asciiart: only block characters');
    t.type('#cl', '40'); T.eq(t.q('#pre').textContent.split('\n').length, 10, 'asciiart: 40 characters wide gives 10 rows'); T.eq(t.q('#cv').textContent, '40', 'asciiart: width label');
    t.click('#cp'); await page.wait(10); T.eq(copied[copied.length - 1], t.q('#pre').textContent, 'asciiart: copy gives the art');
    share.files.length = 0; t.click('#sv'); await page.wait(40); T.has((share.last() || {}).path || '', 'ascii-art.txt', 'asciiart: save .txt');
    t.close();
  }

  /* ---------- Silly Names ---------- */
  log('namegen');
  {
    const z = () => 0;
    T.eq(P.genName('nick', z), 'Grumpy Penguin', 'namegen: first nickname from the lists'); T.eq(P.genName('silly', z), 'Alex Pepperpot', 'namegen: silly name'); T.eq(P.genName('team', z), 'The Grumpy Rockets', 'namegen: team name');
    T.ok(/^A retired space pirate in a floating castle discovered a map that kept changing\. But the key was hidden in plain sight\.$/.test(P.genName('story', z)), 'namegen: story starter is a full sentence');
    const seq = (() => { let i = 0; return () => ((i++ * 0.137) % 1); })();
    for (const kind of ['nick', 'silly', 'team', 'story']) T.ok(Array.from({ length: 50 }, () => P.genName(kind, seq)).every((s) => s && !/undefined|NaN/.test(s)), 'namegen: ' + kind + ' never gives undefined');
    const t = await page.open('namegen');
    T.eq(t.all('#ls .item').length, 8, 'namegen: 8 nicknames at first');
    const first = t.all('#ls .grow')[0].textContent; T.ok(/^[A-Z][a-z]+ [A-Z][a-z]+$/.test(first), 'namegen: nickname looks like Adjective Noun (' + first + ')');
    t.clickText('Story starters'); T.eq(t.all('#ls .item').length, 4, 'namegen: 4 story starters'); t.clickText('Team names'); T.ok(t.all('#ls .grow').every((s) => s.textContent.startsWith('The ')), 'namegen: team names start with The');
    t.click('[data-sv]'); T.eq(store('namegen.favs').length, 1, 'namegen: star keeps a result'); t.all('[data-sv]')[1].click(); T.eq(store('namegen.favs').length, 2, 'namegen: second favourite');
    const fav = store('namegen.favs')[0]; t.click('[data-sv="' + fav.replace(/"/g, '&quot;') + '"]'); T.eq(store('namegen.favs').length, 2, 'namegen: no duplicate favourites');
    t.click('[data-rm]'); T.eq(store('namegen.favs').length, 1, 'namegen: remove a favourite');
    t.click('[data-cp]'); await page.wait(10); T.ok(copied.length > 0, 'namegen: copy works');
    t.click('#go'); T.eq(t.all('#ls .item').length, 8, 'namegen: Generate makes more'); T.eq(store('namegen.kind'), 'team', 'namegen: kind remembered');
    t.close();
  }

  /* ---------- Image Palette ---------- */
  log('imgpalette');
  {
    const pxs = [...Array(50)].map(() => [255, 0, 0]).concat([...Array(50)].map(() => [0, 0, 255]));
    const m = P.medianCut(pxs, 6); T.eq(m.length, 2, 'imgpalette: two distinct colours give two entries even when 6 are asked for'); T.eq(m.map((c) => P.rgb2hex(c.rgb)).sort().join(), '#0000FF,#FF0000', 'imgpalette: exact colours'); T.eq(m.map((c) => c.share).join(), '0.5,0.5', 'imgpalette: shares are 50% each');
    const three = [...Array(30)].map(() => [255, 0, 0]).concat([...Array(30)].map(() => [0, 255, 0]), [...Array(40)].map(() => [0, 0, 255]));
    const m3 = P.medianCut(three, 3); T.eq(m3.map((c) => P.rgb2hex(c.rgb)).sort().join(), '#00FF00,#0000FF,#FF0000'.split(',').sort().join(), 'imgpalette: three colours found'); T.eq(m3[0].share, 0.4, 'imgpalette: biggest share first (blue 40%)');
    T.eq(P.medianCut([], 5).length, 0, 'imgpalette: no pixels, no colours');
    pic.w = 10; pic.h = 10; pic.px = (i) => (i % 10 < 5 ? [255, 0, 0, 255] : [0, 0, 255, 255]);
    const t = await page.open('imgpalette');
    t.click('#pk'); await page.wait(20);
    T.eq(t.all('#out [data-cp]').map((b) => b.dataset.cp).sort().join(), '#0000FF,#FF0000', 'imgpalette: screen shows the two colours'); T.has(t.q('#out').textContent, '50%', 'imgpalette: share shown');
    t.click('#ca'); await page.wait(10); T.eq(copied[copied.length - 1].split(', ').sort().join(), '#0000FF, #FF0000'.split(', ').sort().join(), 'imgpalette: copy all HEX');
    t.click('#cs'); await page.wait(10); T.has(copied[copied.length - 1], ':root {\n  --color-1: #', 'imgpalette: copy as CSS');
    pic.px = (i) => (i < 50 ? [10, 200, 30, 255] : [0, 0, 0, 0]);
    t.type('#k', '3'); T.eq(t.all('#out [data-cp]').map((b) => b.dataset.cp).join(), '#0AC81E', 'imgpalette: transparent pixels are ignored');
    t.close();
  }

  await T.done(page);
})().catch((e) => { console.log('CRASH: ' + (e && e.stack || e)); process.exit(1); });
