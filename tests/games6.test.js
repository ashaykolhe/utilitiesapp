'use strict';
/* Tests for the pure logic in www/js/tools/games6.js. Run: node tests/games6.test.js
   The logic blocks between the LOGIC-START / LOGIC-END markers are joined and evaluated here (the first block defines L). */
const fs = require('fs'), path = require('path'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'www', 'js', 'tools', 'games6.js'), 'utf8');
const blocks = [...src.matchAll(/\/\* LOGIC-START \*\/([\s\S]*?)\/\* LOGIC-END \*\//g)].map((m) => m[1]).join('\n');
const L = new Function('"use strict";\n' + blocks + '\nreturn L;')();
let passed = 0;
function test(name, fn) {
  const t = Date.now();
  try { fn(); passed++; console.log('ok   ' + name + ' (' + (Date.now() - t) + ' ms)'); } catch (e) { console.error('FAIL ' + name + '\n  ' + (e.stack || e)); process.exitCode = 1; }
}

test('word search: word list, placement and findability', () => {
  const all = L.wsAllWords();
  assert(all.length >= 400, 'need 400+ words, have ' + all.length);
  all.forEach((w) => assert(/^[A-Z]{3,10}$/.test(w), 'bad word ' + w));
  const raw = []; Object.values(L.WS_THEMES).forEach((t) => t.split(' ').forEach((w) => raw.push(w)));
  assert.strictEqual(new Set(raw).size, raw.length, 'duplicate words across themes: ' + raw.filter((w, i) => raw.indexOf(w) !== i));
  [8, 10, 12].forEach((size) => {
    for (let k = 0; k < 150; k++) {
      const themes = [''].concat(Object.keys(L.WS_THEMES)), th = themes[k % themes.length];
      const pz = L.wsGen(size, th);
      assert(pz && pz.grid.length === size && pz.grid.every((r) => r.length === size && /^[A-Z]+$/.test(r)));
      assert(pz.words.length >= L.wsCfg[size].n, 'too few words placed');
      const seen = new Set();
      pz.words.forEach((p) => {
        assert(!seen.has(p.w)); seen.add(p.w);
        for (let i = 0; i < p.w.length; i++) assert.strictEqual(pz.grid[p.r + p.dr * i][p.c + p.dc * i], p.w[i], 'placement mismatch ' + p.w);
        assert(L.wsFind(pz.grid, p.w), 'word not findable ' + p.w);
        assert(L.WS_DIRS.some((d) => d[0] === p.dr && d[1] === p.dc));
      });
    }
  });
  /* all 8 directions occur */
  const dirs = new Set(); for (let k = 0; k < 60; k++) L.wsGen(12, '').words.forEach((p) => dirs.add(p.dr + ',' + p.dc));
  assert.strictEqual(dirs.size, 8);
  /* selection line snapping */
  assert.deepStrictEqual(L.wsLine(8, 0, 0, 0, 3), [[0, 0], [0, 1], [0, 2], [0, 3]]);
  assert.deepStrictEqual(L.wsLine(8, 2, 2, 4, 4).length, 3);
  assert.deepStrictEqual(L.wsLine(8, 0, 0, 1, 7).length, 8); /* nearly horizontal snaps to horizontal */
  assert.deepStrictEqual(L.wsLine(8, 3, 3, 3, 3), [[3, 3]]);
});

test('mini crossword: dictionary and generated grids', () => {
  assert(L.MW_PAIRS.length >= 150, 'need 150+ pairs, have ' + L.MW_PAIRS.length);
  const bad = L.MW_PAIRS.filter((p) => !p[1] || p[1].length < 6 || new RegExp('\\b' + p[0] + '\\b', 'i').test(p[1]));
  assert.strictEqual(bad.length, 0, 'clue problems: ' + JSON.stringify(bad));
  const raw = L.MW_RAW.split(/[\r\n]+/).join('').split(';').map((x) => x.split(':')[0].toUpperCase());
  const dropped = raw.filter((w) => !L.MW_PAIRS.some((p) => p[0] === w));
  console.log('     pairs ' + L.MW_PAIRS.length + ' (by length ' + [3, 4, 5].map((n) => L.mwByLen[n].length) + '), dropped ' + dropped.join(','));
  let tried = 0;
  for (let k = 0; k < 120; k++) {
    const pz = L.mwGen(); tried++;
    assert(pz, 'no grid generated');
    assert(L.mwValid(pz), 'invalid grid ' + JSON.stringify(pz.cells));
    pz.entries.forEach((e) => {
      assert(e.len >= 3 && e.len <= 5);
      assert.strictEqual(e.cells.map((c) => pz.cells[c]).join(''), e.word);
      assert(L.MW_PAIRS.some((p) => p[0] === e.word && p[1] === e.clue), 'unknown clue');
    });
    /* numbering: numbers ascend in reading order of their first cell */
    const firsts = pz.entries.map((e) => e.cells[0]), ns = pz.entries.map((e) => e.n);
    for (let i = 1; i < ns.length; i++) assert(ns[i] >= ns[i - 1]);
    assert(firsts.length >= 5);
  }
  /* the validator rejects broken grids */
  const g = L.mwGen(); g.cells[g.entries[0].cells[0]] = g.cells[g.entries[0].cells[0]] === 'Z' ? 'Q' : 'Z';
  assert(!L.mwValid(g));
});

test('kenken: unique solution, valid cages', () => {
  [4, 5, 6].forEach((n) => {
    const t0 = Date.now(); let singles = 0, cells = 0;
    for (let k = 0; k < 60; k++) {
      const pz = L.kkGen(n); assert(pz, 'no puzzle');
      /* the stored solution is a Latin square */
      assert.strictEqual(L.latinConflicts(n, pz.sol).size, 0);
      assert(pz.sol.every((v) => v >= 1 && v <= n));
      /* cages cover each cell once, are connected and match the solution */
      const seen = new Set();
      pz.cages.forEach((cg) => {
        cg.cells.forEach((c) => { assert(!seen.has(c)); seen.add(c); });
        assert.strictEqual(L.components(n, cg.cells).length, 1, 'cage not connected');
        const v = cg.cells.map((c) => pz.sol[c]);
        assert(L.kkCageOk(cg, v, n), 'solution breaks its own cage');
        if (cg.op === '-' || cg.op === '÷') assert.strictEqual(cg.cells.length, 2);
        if (cg.op === '') { assert.strictEqual(cg.cells.length, 1); singles++; }
        cells++;
      });
      assert.strictEqual(seen.size, n * n);
      const r = L.kkSolve(n, pz.cages, 3);
      assert.strictEqual(r.count, 1, 'KenKen ' + n + 'x' + n + ' has ' + r.count + ' solutions');
      assert.deepStrictEqual(r.sols[0], pz.sol);
    }
    console.log('     ' + n + 'x' + n + ': 60 puzzles, ' + (Date.now() - t0) + ' ms, singleton cages ' + singles + ' of ' + cells);
  });
  /* cage arithmetic */
  const c2 = { op: '÷', t: 3, cells: [0, 1] };
  assert(L.kkCageOk(c2, [6, 2], 6) && !L.kkCageOk(c2, [6, 3], 6));
  assert(L.kkCageOk({ op: '-', t: 2, cells: [0, 1] }, [1, 3], 4) && !L.kkCageOk({ op: '-', t: 2, cells: [0, 1] }, [2, 3], 4));
  assert(!L.kkCageOk({ op: '+', t: 5, cells: [0, 1] }, [4, 4], 4));
  /* a row conflict is found */
  assert.deepStrictEqual([...L.latinConflicts(3, [1, 1, 2, 0, 0, 0, 0, 0, 0])].sort(), [0, 1]);
});

test('kenken: independent brute-force check on 4x4', () => {
  const perms = []; (function p(a, r) { if (!r.length) perms.push(a); r.forEach((x, i) => p(a.concat(x), r.filter((_, j) => j !== i))); })([], [1, 2, 3, 4]);
  const squares = [];
  for (const a of perms) for (const b of perms) { if (a.some((v, i) => v === b[i])) continue;
    for (const c of perms) { if (a.some((v, i) => v === c[i]) || b.some((v, i) => v === c[i])) continue;
      for (const d of perms) { if (a.some((v, i) => v === d[i]) || b.some((v, i) => v === d[i]) || c.some((v, i) => v === d[i])) continue; squares.push(a.concat(b, c, d)); } } }
  assert.strictEqual(squares.length, 576);
  for (let k = 0; k < 25; k++) {
    const pz = L.kkGen(4);
    const ok = squares.filter((sq) => pz.cages.every((cg) => {
      const v = cg.cells.map((c) => sq[c]);
      if (cg.op === '') return v[0] === cg.t;
      if (cg.op === '+') return v.reduce((x, y) => x + y, 0) === cg.t;
      if (cg.op === '×') return v.reduce((x, y) => x * y, 1) === cg.t;
      if (cg.op === '-') return Math.abs(v[0] - v[1]) === cg.t;
      return Math.max(...v) / Math.min(...v) === cg.t;
    }));
    assert.strictEqual(ok.length, 1);
  }
});

test('kakuro: unique solution, valid runs', () => {
  [6, 7, 8].forEach((N) => {
    const t0 = Date.now(); let givens = 0, whites = 0, maxTime = 0;
    for (let k = 0; k < 55; k++) {
      const t1 = Date.now();
      const pz = L.kkrGen(N); assert(pz, 'no board for ' + N);
      maxTime = Math.max(maxTime, Date.now() - t1);
      const runs = L.kkrRuns(N, pz.w);
      assert(runs.length >= 4);
      runs.forEach((r) => {
        assert(r.cells.length >= 2 && r.cells.length <= 5);
        const vals = r.cells.map((c) => pz.sol[c]);
        assert.strictEqual(new Set(vals).size, vals.length, 'repeat in run');
        assert(vals.every((v) => v >= 1 && v <= 9));
        const target = r.dir === 'a' ? pz.a[r.clue] : pz.d[r.clue];
        assert.strictEqual(vals.reduce((x, y) => x + y, 0), target, 'sum mismatch');
        assert(!pz.w[r.clue], 'clue cell must be black');
      });
      /* every white cell is in a run, first row and column are black */
      const inRun = new Set(); runs.forEach((r) => r.cells.forEach((c) => inRun.add(c)));
      pz.w.forEach((v, i) => { if (v) { assert(inRun.has(i)); assert(i >= N && i % N !== 0); } });
      /* givens agree with the solution */
      pz.given.forEach((v, i) => { if (v) { assert(pz.w[i] && v === pz.sol[i]); } });
      const r = L.kkrSolve({ N, w: pz.w, runs, a: pz.a, d: pz.d, given: pz.given }, 3);
      assert.strictEqual(r.count, 1, 'Kakuro ' + N + ' has ' + r.count + ' solutions');
      assert.deepStrictEqual(r.sols[0], pz.sol);
      assert.strictEqual(L.kkrConflicts(pz, pz.sol).size, 0, 'solution should have no conflicts');
      givens += pz.nGiven; whites += pz.w.reduce((x, y) => x + y, 0);
    }
    console.log('     ' + N + 'x' + N + ': 55 boards, ' + (Date.now() - t0) + ' ms (slowest ' + maxTime + ' ms), givens ' + givens + ' of ' + whites + ' white cells');
  });
  /* conflict detection */
  const p = { N: 4, w: [0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0], a: Array(16).fill(0), d: Array(16).fill(0) };
  p.a[4] = 4; p.a[8] = 9; p.d[1] = 5; p.d[2] = 8;
  const g = Array(16).fill(0); g[5] = 2; g[6] = 2;
  assert.deepStrictEqual([...L.kkrConflicts(p, g)].sort((x, y) => x - y), [5, 6]);
  g[5] = 1; g[6] = 3; g[9] = 4; g[10] = 5; /* row 2: 4 + 5 = 9, col 1: 1 + 4 = 5, col 2: 3 + 5 = 8 */
  assert.strictEqual(L.kkrConflicts(p, g).size, 0);
  g[10] = 2; /* row 2 sum 6 != 9 and col 2 sum 5 != 8 */
  assert(L.kkrConflicts(p, g).has(10));
});

test('futoshiki: unique solution, valid signs', () => {
  [4, 5, 6].forEach((n) => {
    const t0 = Date.now(); let maxT = 0, signs = 0, givens = 0;
    for (let k = 0; k < 55; k++) {
      const t1 = Date.now();
      const pz = L.futGen(n); assert(pz, 'no puzzle');
      maxT = Math.max(maxT, Date.now() - t1);
      assert.strictEqual(L.latinConflicts(n, pz.sol).size, 0);
      pz.ineq.forEach(([a, b]) => {
        assert(pz.sol[a] < pz.sol[b], 'sign contradicts the solution');
        const d = Math.abs(a - b); assert(d === 1 ? Math.floor(a / n) === Math.floor(b / n) : d === n, 'signs must join neighbours');
      });
      pz.given.forEach((v, i) => { if (v) assert.strictEqual(v, pz.sol[i]); });
      const r = L.futSolve(pz, 3);
      assert.strictEqual(r.count, 1, 'Futoshiki ' + n + ' has ' + r.count + ' solutions');
      assert.deepStrictEqual(r.sols[0], pz.sol);
      const cf = L.futConflicts(pz, pz.sol); assert.strictEqual(cf.cells.size, 0); assert.strictEqual(cf.ineqs.size, 0);
      signs += pz.ineq.length; givens += pz.given.filter(Boolean).length;
    }
    console.log('     ' + n + 'x' + n + ': 55 puzzles, ' + (Date.now() - t0) + ' ms (slowest ' + maxT + ' ms), avg signs ' + (signs / 55).toFixed(1) + ', avg givens ' + (givens / 55).toFixed(1));
  });
  /* violated sign is reported */
  const p = { n: 3, given: Array(9).fill(0), ineq: [[0, 1]] };
  assert.strictEqual(L.futConflicts(p, [2, 1, 0, 0, 0, 0, 0, 0, 0]).ineqs.size, 1);
  assert.strictEqual(L.futConflicts(p, [1, 2, 0, 0, 0, 0, 0, 0, 0]).ineqs.size, 0);
});

test('killer sudoku: shipped bank and transforms all verify with exactly one solution', () => {
  const all = [].concat(L.KS_BANK.easy, L.KS_BANK.med, L.KS_BANK.hard);
  assert(all.length >= 60, 'need 60+ puzzles, have ' + all.length);
  assert.strictEqual(new Set(all).size, all.length, 'duplicate puzzles');
  const t0 = Date.now();
  all.forEach((e, n) => {
    assert.strictEqual(e.length, 162);
    const p = L.ksDecode(e);
    assert(L.ksValid(p), 'bank puzzle ' + n + ' breaks the rules');
    assert.strictEqual(L.ksEncode(p), e);
    const r = L.ksSolve(p.cages, 3);
    assert.strictEqual(r.count, 1, 'bank puzzle ' + n + ' has ' + r.count + ' solutions');
    assert.deepStrictEqual(r.sols[0], p.sol);
    assert.strictEqual(L.ksConflicts(p, p.sol).size, 0);
    /* a rotated / reflected copy is still the same puzzle */
    const k = n % 8, q = L.ksTransform(p, k);
    assert(L.ksValid(q), 'transform ' + k + ' broke puzzle ' + n);
    assert.strictEqual(q.cages.length, p.cages.length);
    assert.strictEqual(L.ksSolve(q.cages, 3).count, 1);
  });
  console.log('     ' + all.length + ' bank puzzles verified in ' + (Date.now() - t0) + ' ms (easy ' + L.KS_BANK.easy.length + ', medium ' + L.KS_BANK.med.length + ', hard ' + L.KS_BANK.hard.length + ')');
  /* all 8 transforms of one puzzle are distinct boards of the same rules */
  const p0 = L.ksDecode(all[0]), seen = new Set(); for (let k = 0; k < 8; k++) { const q = L.ksTransform(p0, k); assert(L.ksValid(q)); seen.add(L.ksEncode(q)); }
  assert(seen.size >= 4);
  /* the generator also produces unique puzzles (50 fresh ones) */
  let made = 0;
  while (made < 50) { const p = L.ksGen(4, 100000); if (!p) continue; assert(L.ksValid(p)); assert.strictEqual(L.ksSolve(p.cages, 3).count, 1); made++; }
  /* a wrong sum or repeated digit is flagged */
  const g = p0.sol.slice(); g[0] = g[1];
  assert(L.ksConflicts(p0, g).has(0));
  const g2 = p0.sol.slice(); const cg = p0.cages.find((c) => c.cells.length > 1);
  g2[cg.cells[0]] = g2[cg.cells[0]] === 9 ? 8 : 9; assert(L.ksConflicts(p0, g2).size > 0);
});

test('tangram: pieces, silhouettes and the coverage check', () => {
  /* the seven pieces */
  const areas = L.TG_BASE.map((b) => Math.abs(L.polyArea(b)));
  assert.deepStrictEqual(areas.map((a) => Math.round(a * 1e6) / 1e6), [8, 8, 4, 2, 2, 4, 4]);
  assert(Math.abs(areas.reduce((a, b) => a + b, 0) - L.TG_AREA) < 1e-9);
  /* every orientation keeps the area and stays counter-clockwise */
  for (let i = 0; i < 7; i++) for (let k = 0; k < 8; k++) for (let f = 0; f < 2; f++) {
    const sh = L.tgShape(i, k, f); assert(Math.abs(L.polyArea(sh) - areas[i]) < 1e-9 && L.polyArea(sh) > 0);
  }
  /* the pieces can build the 8x8 style big square: two large + medium + two small + square + parallelogram = 32 = (4 sqrt 2)^2 */
  assert(Math.abs(Math.pow(4 * Math.SQRT2, 2) - 32) < 1e-9);
  assert(L.TG_BANK.length >= 20, 'need 20+ silhouettes');
  const sigs = new Set();
  const touches = (P, Q) => { /* a shared stretch of edge of positive length */
    for (let i = 0; i < P.length; i++) for (let j = 0; j < Q.length; j++) {
      const a = P[i], b = P[(i + 1) % P.length], c = Q[j], d = Q[(j + 1) % Q.length];
      const ux = b[0] - a[0], uy = b[1] - a[1], ul = Math.hypot(ux, uy);
      const cr1 = Math.abs(ux * (c[1] - a[1]) - uy * (c[0] - a[0])) / ul, cr2 = Math.abs(ux * (d[1] - a[1]) - uy * (d[0] - a[0])) / ul;
      if (cr1 > 0.01 || cr2 > 0.01) continue;
      const t1 = ((c[0] - a[0]) * ux + (c[1] - a[1]) * uy) / ul, t2 = ((d[0] - a[0]) * ux + (d[1] - a[1]) * uy) / ul;
      if (Math.min(ul, Math.max(t1, t2)) - Math.max(0, Math.min(t1, t2)) > 0.3) return true;
    }
    return false;
  };
  L.TG_BANK.forEach((lay, n) => {
    assert.strictEqual(lay.length, 7);
    assert.deepStrictEqual(lay.map((p) => p[0]).sort(), [0, 1, 2, 3, 4, 5, 6], 'silhouette ' + n + ' must use each piece once');
    const polys = lay.map(L.tgPoly);
    const total = polys.reduce((a, p) => a + Math.abs(L.polyArea(p)), 0);
    assert(Math.abs(total - L.TG_AREA) < 1e-6);
    for (let i = 0; i < 7; i++) for (let j = i + 1; j < 7; j++) assert(L.polyOverlap(polys[i], polys[j]) < 0.02, 'pieces overlap in silhouette ' + n);
    /* connected through shared edges */
    const seen = new Set([0]), st = [0];
    while (st.length) { const i = st.pop(); for (let j = 0; j < 7; j++) if (!seen.has(j) && touches(polys[i], polys[j])) { seen.add(j); st.push(j); } }
    assert.strictEqual(seen.size, 7, 'silhouette ' + n + ' is not connected');
    const m = L.tgMetrics(lay); assert(m.compact <= 1.0001 && m.w <= 11 && m.h <= 11, 'size of ' + n); sigs.add(m.sig);
    /* the original arrangement is accepted; the pieces moved a little still count; moved a lot or turned wrongly do not */
    assert(L.tgSolved(polys, polys), 'bank layout must solve itself');
    const nudged = polys.map((p, i) => p.map(([x, y]) => [x + 0.015 * (i % 2 ? 1 : -1), y + 0.01]));
    assert(L.tgSolved(polys, nudged), 'a small nudge should still solve');
    const off = polys.map((p, i) => (i === 0 ? p.map(([x, y]) => [x + 3, y + 3]) : p));
    assert(!L.tgSolved(polys, off), 'a piece moved away must not solve');
    const stacked = polys.map((p, i) => (i < 2 ? polys[0] : p));
    assert(!L.tgSolved(polys, stacked), 'overlapping pieces must not solve');
    const missing = polys.slice(0, 6); assert(!L.tgSolved(polys, missing), 'six pieces cannot cover');
  });
  assert(sigs.size >= 20, 'silhouettes should be different from each other');
  /* the generator builds valid silhouettes too */
  let made = 0;
  while (made < 40) {
    const lay = L.tgGen(); if (!lay) continue; made++;
    const polys = lay.map(L.tgPoly);
    for (let i = 0; i < 7; i++) for (let j = i + 1; j < 7; j++) assert(L.polyOverlap(polys[i], polys[j]) < 0.02);
    assert(L.tgSolved(polys, polys));
  }
  /* overlap helper: unit square halves */
  const sq = [[0, 0], [2, 0], [2, 2], [0, 2]], sq2 = [[1, 0], [3, 0], [3, 2], [1, 2]];
  assert(Math.abs(L.polyOverlap(sq, sq2) - 2) < 1e-9);
  assert.strictEqual(L.polyOverlap(sq, [[5, 5], [6, 5], [6, 6], [5, 6]]), 0);
});

test('dice five: scoring of every box against known hands', () => {
  const sc = (cat, dice, joker) => L.dfScore(cat, dice, joker);
  assert.strictEqual(sc('ones', [1, 1, 2, 3, 1]), 3); assert.strictEqual(sc('ones', [2, 3, 4, 5, 6]), 0);
  assert.strictEqual(sc('twos', [2, 2, 2, 5, 6]), 6); assert.strictEqual(sc('threes', [3, 3, 1, 1, 3]), 9);
  assert.strictEqual(sc('fours', [4, 4, 4, 4, 1]), 16); assert.strictEqual(sc('fives', [5, 5, 5, 5, 5]), 25); assert.strictEqual(sc('sixes', [6, 1, 6, 2, 3]), 12);
  assert.strictEqual(sc('three', [3, 3, 3, 4, 5]), 18); assert.strictEqual(sc('three', [3, 3, 4, 4, 5]), 0); assert.strictEqual(sc('three', [6, 6, 6, 6, 1]), 25); assert.strictEqual(sc('three', [2, 2, 2, 2, 2]), 10);
  assert.strictEqual(sc('four', [4, 4, 4, 4, 2]), 18); assert.strictEqual(sc('four', [4, 4, 4, 2, 2]), 0); assert.strictEqual(sc('four', [5, 5, 5, 5, 5]), 25);
  assert.strictEqual(sc('full', [2, 2, 3, 3, 3]), 25); assert.strictEqual(sc('full', [1, 1, 1, 6, 6]), 25); assert.strictEqual(sc('full', [2, 2, 3, 3, 4]), 0);
  assert.strictEqual(sc('full', [4, 4, 4, 4, 5]), 0); assert.strictEqual(sc('full', [2, 2, 2, 2, 2]), 0); assert.strictEqual(sc('full', [2, 2, 2, 2, 2], true), 25);
  assert.strictEqual(sc('small', [1, 2, 3, 4, 6]), 30); assert.strictEqual(sc('small', [2, 3, 4, 5, 5]), 30); assert.strictEqual(sc('small', [3, 4, 5, 6, 6]), 30);
  assert.strictEqual(sc('small', [1, 2, 3, 5, 6]), 0); assert.strictEqual(sc('small', [1, 2, 4, 5, 6]), 0); assert.strictEqual(sc('small', [1, 1, 2, 3, 3]), 0);
  assert.strictEqual(sc('small', [1, 2, 3, 4, 5]), 30); assert.strictEqual(sc('small', [3, 3, 3, 3, 3], true), 30);
  assert.strictEqual(sc('large', [1, 2, 3, 4, 5]), 40); assert.strictEqual(sc('large', [2, 3, 4, 5, 6]), 40); assert.strictEqual(sc('large', [1, 2, 3, 4, 6]), 0); assert.strictEqual(sc('large', [5, 4, 3, 2, 2]), 0);
  assert.strictEqual(sc('large', [6, 6, 6, 6, 6], true), 40);
  assert.strictEqual(sc('five', [3, 3, 3, 3, 3]), 50); assert.strictEqual(sc('five', [3, 3, 3, 3, 4]), 0);
  assert.strictEqual(sc('chance', [1, 2, 3, 4, 6]), 16);
  /* unsorted dice score the same */
  assert.strictEqual(sc('small', [4, 1, 3, 6, 2]), 30); assert.strictEqual(sc('full', [3, 2, 3, 2, 3]), 25);
});
test('dice five: sheet totals, upper bonus, extra Dice Fives', () => {
  let s = L.dfNewSheet();
  const set = (k, v) => { s[k] = v; };
  ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'].forEach((k, i) => set(k, 3 * (i + 1)));
  assert.strictEqual(L.dfUpper(s), 63); assert.strictEqual(L.dfBonus(s), 35); assert.strictEqual(L.dfTotal(s), 98);
  set('sixes', 12); assert.strictEqual(L.dfUpper(s), 57); assert.strictEqual(L.dfBonus(s), 0);
  /* a first Dice Five with the box open scores in any open box normally */
  s = L.dfNewSheet();
  assert.strictEqual(L.dfLegal(s, [4, 4, 4, 4, 4]).length, 13);
  let r = L.dfApply(s, 'five', [4, 4, 4, 4, 4]); assert.strictEqual(r.score, 50); assert(!r.bonus); s = r.sheet;
  /* second Dice Five: must use the matching upper box when open, and earns 100 */
  assert.deepStrictEqual(L.dfLegal(s, [4, 4, 4, 4, 4]).map((o) => o.cat), ['fours']);
  r = L.dfApply(s, 'fours', [4, 4, 4, 4, 4]); assert.strictEqual(r.score, 20); assert(r.bonus); s = r.sheet; assert.strictEqual(s.yb, 1);
  assert.throws(() => L.dfApply(s, 'chance', [3, 3, 3, 3, 3]), /illegal/);
  /* with the fours box filled a 4s Dice Five may go in any lower box with joker values */
  const lo = L.dfLegal(s, [4, 4, 4, 4, 4]).map((o) => o.cat + ':' + o.score).sort();
  assert.deepStrictEqual(lo, ['chance:20', 'four:20', 'full:25', 'large:40', 'small:30', 'three:20']);
  r = L.dfApply(s, 'large', [4, 4, 4, 4, 4]); assert.strictEqual(r.score, 40); assert(r.bonus); assert.strictEqual(r.sheet.yb, 2);
  assert.strictEqual(L.dfTotal(r.sheet), 50 + 20 + 40 + 200);
  /* only upper boxes left: a Dice Five scores zero there */
  const t = L.dfNewSheet(); ['three', 'four', 'full', 'small', 'large', 'chance'].forEach((k) => { t[k] = 0; }); t.five = 50; t.fours = 16;
  const o = L.dfLegal(t, [4, 4, 4, 4, 4]); assert.deepStrictEqual(o.map((x) => x.cat), ['ones', 'twos', 'threes', 'fives', 'sixes']); assert(o.every((x) => x.score === 0));
  /* Dice Five box filled with 0: an extra one scores by the joker rules but earns no bonus */
  const z = L.dfNewSheet(); z.five = 0; r = L.dfApply(z, 'sixes', [6, 6, 6, 6, 6]); assert.strictEqual(r.score, 30); assert(!r.bonus); assert.strictEqual(r.sheet.yb, 0);
  /* normal hands never use the joker rules */
  assert.strictEqual(L.dfLegal(z, [4, 4, 4, 4, 3]).length, 12);
  assert(!L.dfDone(z)); const all = L.dfNewSheet(); L.DF_CATS.forEach((k) => { all[k] = 0; }); assert(L.dfDone(all));
  assert.strictEqual(L.dfTotal(Object.assign(L.dfNewSheet(), { ones: 5, twos: 10, threes: 15, fours: 20, fives: 25, sixes: 30, three: 30, four: 30, full: 25, small: 30, large: 40, five: 50, chance: 30 })), 5 + 10 + 15 + 20 + 25 + 30 + 35 + 30 + 30 + 25 + 30 + 40 + 50 + 30);
});
test('dice five: the phone AI always makes legal moves and plays sensibly', () => {
  const roll = () => Array.from({ length: 5 }, () => 1 + Math.floor(Math.random() * 6));
  function play(depth, policy) {
    let sheet = L.dfNewSheet();
    for (let turn = 0; turn < 13; turn++) {
      let dice = roll(), left = 2;
      while (left > 0) {
        const hold = policy === 'ai' ? L.dfAIHold(sheet, dice, left, depth) : dice.map(() => Math.random() < 0.5);
        assert(Array.isArray(hold) && hold.length === 5 && hold.every((h) => typeof h === 'boolean'));
        if (hold.every(Boolean)) break;
        dice = dice.map((v, i) => (hold[i] ? v : 1 + Math.floor(Math.random() * 6))); left--;
      }
      const legal = L.dfLegal(sheet, dice); assert(legal.length > 0, 'no legal box');
      const cat = policy === 'ai' ? L.dfAIPick(sheet, dice) : legal[Math.floor(Math.random() * legal.length)].cat;
      assert(legal.some((o) => o.cat === cat), 'AI picked an illegal box ' + cat);
      sheet = L.dfApply(sheet, cat, dice).sheet;
    }
    assert(L.dfDone(sheet)); assert(L.DF_CATS.every((k) => sheet[k] !== null));
    return L.dfTotal(sheet);
  }
  let t0 = Date.now(), sum1 = 0, sumR = 0;
  for (let g = 0; g < 2000; g++) sum1 += play(1, 'ai');
  console.log('     2000 games, one-roll lookahead: average ' + (sum1 / 2000).toFixed(1) + ' in ' + (Date.now() - t0) + ' ms');
  for (let g = 0; g < 500; g++) sumR += play(1, 'random');
  t0 = Date.now(); let sum2 = 0; const G2 = 12;
  for (let g = 0; g < G2; g++) sum2 += play(2, 'ai');
  console.log('     ' + G2 + ' games, two-roll lookahead: average ' + (sum2 / G2).toFixed(1) + ' in ' + (Date.now() - t0) + ' ms; random players average ' + (sumR / 500).toFixed(1));
  assert(sum1 / 2000 > sumR / 500 + 40, 'AI should beat random play clearly');
  assert(sum2 / G2 > 150, 'two-roll AI should average over 150');
});

test('farkle: scoring table against known rolls', () => {
  const S = (d) => L.fkScoreSel(d);
  assert.strictEqual(S([1]), 100); assert.strictEqual(S([5]), 50); assert.strictEqual(S([1, 1]), 200); assert.strictEqual(S([5, 5]), 100); assert.strictEqual(S([1, 5]), 150);
  assert.strictEqual(S([1, 1, 5]), 250); assert.strictEqual(S([1, 1, 5, 5]), 300);
  assert.strictEqual(S([2]), 0); assert.strictEqual(S([2, 2]), 0); assert.strictEqual(S([2, 3]), 0); assert.strictEqual(S([1, 2]), 0, 'a non-scoring die spoils the selection');
  assert.strictEqual(S([1, 1, 1]), 1000); assert.strictEqual(S([2, 2, 2]), 200); assert.strictEqual(S([3, 3, 3]), 300); assert.strictEqual(S([4, 4, 4]), 400);
  assert.strictEqual(S([5, 5, 5]), 500); assert.strictEqual(S([6, 6, 6]), 600);
  assert.strictEqual(S([1, 1, 1, 1]), 1000); assert.strictEqual(S([2, 2, 2, 2]), 1000); assert.strictEqual(S([6, 6, 6, 6]), 1000);
  assert.strictEqual(S([3, 3, 3, 3, 3]), 2000); assert.strictEqual(S([5, 5, 5, 5, 5]), 2000); assert.strictEqual(S([4, 4, 4, 4, 4, 4]), 3000); assert.strictEqual(S([1, 1, 1, 1, 1, 1]), 3000);
  assert.strictEqual(S([2, 2, 2, 1]), 300); assert.strictEqual(S([2, 2, 2, 5]), 250); assert.strictEqual(S([6, 6, 6, 1, 5]), 750); assert.strictEqual(S([2, 2, 2, 3]), 0);
  assert.strictEqual(S([1, 2, 3, 4, 5, 6]), 1500); assert.strictEqual(S([6, 5, 4, 3, 2, 1]), 1500);
  assert.strictEqual(S([2, 2, 3, 3, 4, 4]), 1500); assert.strictEqual(S([1, 1, 5, 5, 6, 6]), 1500); assert.strictEqual(S([2, 2, 2, 3, 3, 3]), 2500); assert.strictEqual(S([1, 1, 1, 5, 5, 5]), 2500);
  assert.strictEqual(S([3, 3, 3, 3, 3, 3]), 3000);
  assert.strictEqual(S([1, 1, 1, 1, 5, 5]), 1100); assert.strictEqual(S([2, 2, 2, 2, 3, 3]), 0);
  assert.strictEqual(S([]), 0); assert.strictEqual(S([1, 1, 1, 1, 1, 1, 1]), 0);
  /* order does not matter */
  assert.strictEqual(S([5, 2, 2, 1, 2]), 350);
  /* options and farkle detection */
  assert(L.fkFarkle([2, 3, 4, 6, 2, 3])); assert(L.fkFarkle([2, 3, 4, 6])); assert(L.fkFarkle([2, 2, 3, 3, 4])); assert(L.fkFarkle([6]));
  assert(!L.fkFarkle([2, 2, 2])); assert(!L.fkFarkle([2, 2, 3, 3, 4, 4])); assert(!L.fkFarkle([1, 2, 3, 4, 6, 6])); assert(!L.fkFarkle([5]));
  const o = L.fkOptions([1, 5, 2, 3, 4, 4]); assert.deepStrictEqual(o.map((x) => x.score).sort((a, b) => a - b), [50, 100, 150]);
  assert.strictEqual(L.fkOptions([1, 2, 3, 4, 5, 6]).map((x) => x.score).reduce((a, b) => Math.max(a, b), 0), 1500);
  /* every option is a real sub-multiset of the roll and scores what fkScoreSel says */
  for (let k = 0; k < 4000; k++) {
    const d = Array.from({ length: 1 + Math.floor(Math.random() * 6) }, () => 1 + Math.floor(Math.random() * 6));
    L.fkOptions(d).forEach((x) => { assert(L.fkWithin(x.sel, d)); assert.strictEqual(x.score, L.fkScoreSel(x.sel)); assert(x.score > 0); });
    assert.strictEqual(L.fkFarkle(d), !d.some((v) => v === 1 || v === 5) && L.dfCounts(d).every((c) => c < 3) && !(d.length === 6 && L.dfCounts(d).filter((c) => c === 2).length === 3));
  }
  /* about 2.3% of six-dice rolls are a Farkle (known value 0.0231) */
  let f = 0; const N = 40000; for (let k = 0; k < N; k++) if (L.fkFarkle(Array.from({ length: 6 }, () => 1 + Math.floor(Math.random() * 6)))) f++;
  assert(Math.abs(f / N - 0.0231) < 0.006, 'six-dice farkle rate ' + f / N);
});
test('farkle: the phone AI makes only legal moves over thousands of games', () => {
  const roll = (n) => Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 6));
  let games = 0, turns = 0, farkles = 0, firstWins = 0; const lens = [];
  for (let g = 0; g < 3000; g++) {
    const np = 2 + (g % 3), open = g % 4 !== 0, scores = Array(np).fill(0);
    let turn = 0, finalBy = -1, guard = 0, n = 0;
    for (;;) {
      assert(++guard < 3000, 'game did not end');
      const me = scores[turn], top = Math.max(...scores.filter((_, i) => i !== turn));
      let tt = 0, left = 6, banked = false;
      for (let rollsThisTurn = 0; rollsThisTurn < 200; rollsThisTurn++) {
        const dice = roll(left); turns++;
        if (L.fkFarkle(dice)) { farkles++; tt = 0; break; }
        const o = L.fkAIPick(dice);
        assert(o && L.fkWithin(o.sel, dice) && o.sel.length >= 1 && o.score === L.fkScoreSel(o.sel) && o.score > 0, 'illegal selection ' + JSON.stringify(o) + ' of ' + dice);
        tt += o.score; left -= o.sel.length; if (left === 0) left = 6;
        const ctx = { score: me, topOther: top, finalRound: finalBy >= 0, open: open && me === 0 };
        const bank = L.fkAIBank(tt, left, ctx);
        if (bank) { assert(!(open && me === 0 && tt < L.FK_OPEN), 'banked before getting on the board'); assert(tt > 0); banked = true; break; }
      }
      if (banked) { scores[turn] += tt; if (scores[turn] >= L.FK_TARGET && finalBy < 0) finalBy = turn; }
      n++;
      turn = (turn + 1) % np;
      if (finalBy >= 0 && turn === finalBy) break;
    }
    games++; lens.push(n);
    const best = Math.max(...scores); assert(best >= L.FK_TARGET, 'a game ended without anyone reaching the target');
    if (scores[0] === best) firstWins++;
  }
  console.log('     ' + games + ' games, average ' + (lens.reduce((a, b) => a + b, 0) / games).toFixed(1) + ' turns per game, farkle rate ' + (farkles / turns * 100).toFixed(1) + '% of rolls');
});

test("liar's dice: bid ordering, counting and challenge resolution", () => {
  const H = L.ldHigher;
  assert(H({ q: 2, f: 3 }, { q: 1, f: 6 })); assert(H({ q: 2, f: 4 }, { q: 2, f: 3 })); assert(!H({ q: 2, f: 3 }, { q: 2, f: 3 }));
  assert(!H({ q: 2, f: 2 }, { q: 2, f: 3 })); assert(!H({ q: 1, f: 6 }, { q: 2, f: 1 })); assert(H({ q: 3, f: 1 }, { q: 2, f: 6 })); assert(H({ q: 1, f: 1 }, null));
  assert(L.ldValid({ q: 3, f: 2 }, { q: 2, f: 5 }, 10)); assert(!L.ldValid({ q: 11, f: 2 }, null, 10)); assert(!L.ldValid({ q: 0, f: 2 }, null, 10));
  assert(!L.ldValid({ q: 2, f: 7 }, null, 10)); assert(!L.ldValid({ q: 2, f: 0 }, null, 10)); assert(!L.ldValid({ q: 1.5, f: 2 }, null, 10)); assert(!L.ldValid(null, null, 10));
  /* the full list of raises is strictly increasing and complete */
  const prev = { q: 3, f: 4 }, r = L.ldRaises(prev, 7);
  assert.strictEqual(r.length, 7 * 6 - (2 * 6 + 4)); assert(r.every((b) => H(b, prev)));
  for (let i = 1; i < r.length; i++) assert(H(r[i], r[i - 1]));
  assert.strictEqual(L.ldRaises(null, 4).length, 24); assert.strictEqual(L.ldRaises({ q: 4, f: 6 }, 4).length, 0);
  /* counting with and without wild ones */
  const hands = [[1, 2, 3], [2, 2, 5]];
  assert.strictEqual(L.ldCount(hands, 2, false), 3); assert.strictEqual(L.ldCount(hands, 2, true), 4); assert.strictEqual(L.ldCount(hands, 1, true), 1); assert.strictEqual(L.ldCount(hands, 5, true), 2);
  assert.deepStrictEqual(L.ldResolve({ q: 4, f: 2 }, hands, true), { actual: 4, bidderRight: true });
  assert.deepStrictEqual(L.ldResolve({ q: 4, f: 2 }, hands, false), { actual: 3, bidderRight: false });
  assert.deepStrictEqual(L.ldResolve({ q: 3, f: 2 }, hands, false), { actual: 3, bidderRight: true });
  assert.strictEqual(L.ldResolve({ q: 2, f: 1 }, hands, true).bidderRight, false);
  assert.strictEqual(L.ldResolve({ q: 1, f: 6 }, hands, true).bidderRight, true, 'the wild one counts as a six');
  assert.strictEqual(L.ldResolve({ q: 2, f: 6 }, hands, true).bidderRight, false); assert.strictEqual(L.ldResolve({ q: 1, f: 6 }, hands, false).bidderRight, false);
  /* probabilities */
  assert(Math.abs(L.ldTail(5, 1, 1 / 6) - (1 - Math.pow(5 / 6, 5))) < 1e-12);
  assert.strictEqual(L.ldTail(4, 0, 0.5), 1); assert.strictEqual(L.ldTail(4, -3, 0.5), 1); assert.strictEqual(L.ldTail(4, 5, 0.5), 0);
  assert(Math.abs(L.ldTail(4, 4, 0.5) - 1 / 16) < 1e-12); assert(Math.abs(L.ldTail(10, 3, 1 / 3) - 0.7009) < 0.001);
  assert(Math.abs(L.ldChance({ q: 3, f: 4 }, [4, 4, 1], 8, true) - 1) < 1e-12); /* three of the bid are already in my hand (wild one counts) */
  assert(Math.abs(L.ldChance({ q: 3, f: 4 }, [4, 2, 6], 8, false) - L.ldTail(5, 2, 1 / 6)) < 1e-12);
  /* chances fall as the bid rises */
  for (let q = 1; q < 8; q++) assert(L.ldChance({ q: q + 1, f: 3 }, [3, 5], 9, true) <= L.ldChance({ q, f: 3 }, [3, 5], 9, true) + 1e-12);
});
test("liar's dice: the phone AI never makes an illegal bid over thousands of games", () => {
  const rollN = (n) => Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 6));
  let games = 0, rounds = 0, challenges = 0, bids = 0;
  for (let g = 0; g < 4000; g++) {
    const np = 2 + (g % 3), wild = g % 2 === 0, dpp = 3 + (g % 3);
    const pl = Array.from({ length: np }, (_, i) => ({ n: dpp, hand: [], risk: [0, 0.6, -0.5, 0.2][i] }));
    let starter = 0, guard = 0;
    while (pl.filter((p) => p.n > 0).length > 1) {
      assert(++guard < 500, 'game did not end');
      pl.forEach((p) => { p.hand = rollN(p.n); }); rounds++;
      const total = pl.reduce((a, p) => a + p.n, 0), nextAlive = (i) => { for (let k = 1; k <= np; k++) { const j = (i + k) % np; if (pl[j].n > 0) return j; } return i; };
      let cur = starter, prev = null, loser = -1, steps = 0;
      while (loser < 0) {
        assert(++steps < 500, 'round did not end');
        const me = pl[cur], m = L.ldAI(me.hand, total, prev, wild, me.risk);
        assert(m && (m.action === 'bid' || m.action === 'challenge'));
        if (m.action === 'challenge') {
          assert(prev, 'challenged with no bid'); challenges++;
          const r = L.ldResolve(prev, pl.map((p) => p.hand), wild); loser = r.bidderRight ? cur : prev.by;
        } else {
          assert(L.ldValid(m, prev, total), 'illegal bid ' + JSON.stringify(m) + ' after ' + JSON.stringify(prev) + ' with ' + total + ' dice'); bids++;
          prev = { q: m.q, f: m.f, by: cur }; cur = nextAlive(cur);
        }
      }
      pl[loser].n--; assert(pl[loser].n >= 0);
      starter = pl[loser].n > 0 ? loser : nextAlive(loser);
    }
    assert.strictEqual(pl.filter((p) => p.n > 0).length, 1); games++;
  }
  console.log('     ' + games + ' games, ' + rounds + ' rounds, ' + bids + ' bids, ' + challenges + ' challenges, ' + (rounds / games).toFixed(1) + ' rounds per game');
  /* sensible calls */
  let ch = 0, keep = 0;
  for (let k = 0; k < 300; k++) {
    if (L.ldAI([2, 3, 4, 5, 2], 10, { q: 9, f: 6 }, true, 0).action === 'challenge') ch++;
    if (L.ldAI([3, 3, 3, 3, 3], 10, { q: 3, f: 3 }, true, 0).action === 'bid') keep++;
  }
  assert.strictEqual(ch, 300, 'an almost impossible bid must be challenged'); assert.strictEqual(keep, 300, 'a safe bid must not be challenged');
  /* a bid at the very top cannot be raised, so the AI must call it */
  assert.strictEqual(L.ldAI([6, 6, 1], 6, { q: 6, f: 6 }, true, 0).action, 'challenge');
  /* opening bids exist and are reasonable: about the expected number of the best face */
  for (let k = 0; k < 200; k++) { const m = L.ldAI(rollN(5), 15, null, true, 0); assert(m.action === 'bid' && m.q >= 1 && m.q <= 15); }
});

test('multi-seat: names, saved setup, standings, ties and ranking', () => {
  assert.strictEqual(L.cleanName('  Bob   the <b>builder</b> long name ', 'x'), 'Bob the bbui');
  assert.strictEqual(L.cleanName('', 'Player 1'), 'Player 1'); assert.strictEqual(L.cleanName(null, 'P'), 'P'); assert.strictEqual(L.cleanName('<>', 'P'), 'P');
  assert(L.cleanName('x'.repeat(40), 'P').length <= 12);
  assert.deepStrictEqual(L.seatList(4, ['h', 'p', 'h', 'p'], ['', '', '', '']).map((s) => s.name), ['Player 1', 'Phone 1', 'Player 2', 'Phone 2']);
  assert.deepStrictEqual(L.seatList(3, ['h', 'h', 'p'], ['Ann', 'Ann', '']).map((s) => s.name), ['Ann 1', 'Ann 2', 'Phone 1'], 'duplicate names are made unique');
  assert.deepStrictEqual(L.seatList(2, ['h', 'p'], []).map((s) => s.ai), [false, true]);
  /* saved setup: defaults, bad data, at least one human */
  assert.deepStrictEqual(L.normSeats({}, { np: 1, min: 1 }), { np: 1, kinds: ['h', 'p', 'p', 'p'], names: ['', '', '', ''] });
  assert.strictEqual(L.normSeats({ np: 1 }, { np: 2, min: 2 }).np, 2); assert.strictEqual(L.normSeats({ np: 9 }, { np: 2, min: 2 }).np, 2);
  assert.strictEqual(L.normSeats({ np: 3, kinds: ['p', 'p', 'p', 'p'] }, { np: 2, min: 2 }).kinds[0], 'h');
  assert.strictEqual(L.normSeats(null, { np: 2, min: 2 }).np, 2); assert.strictEqual(L.normSeats({ names: [5, '<i>', 'ok'] }, { np: 2, min: 2 }).names[1], 'i');
  /* standings */
  let s = L.dfStandings([200, 250, 250, 100]);
  assert.deepStrictEqual(s.winners, [1, 2]); assert.strictEqual(s.top, 250); assert.deepStrictEqual(s.order.map((o) => o.rank), [1, 1, 3, 4]);
  s = L.dfStandings([10]); assert.deepStrictEqual(s.winners, [0]); assert.strictEqual(s.order[0].rank, 1);
  s = L.dfStandings([0, 0]); assert.deepStrictEqual(s.winners, [0, 1]);
  assert.deepStrictEqual([1, 2, 3, 4, 11, 12, 13, 21].map(L.ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st']);
});
test("multi-seat: Liar's Dice turn order, elimination, hidden information", () => {
  assert.strictEqual(L.ldNextAlive([3, 0, 2], 0), 2); assert.strictEqual(L.ldNextAlive([3, 0, 2], 2), 0); assert.strictEqual(L.ldNextAlive([0, 0, 4], 2), 2);
  assert.strictEqual(L.ldWinner([0, 2, 0]), 1); assert.strictEqual(L.ldWinner([1, 2, 0]), -1); assert.strictEqual(L.ldWinner([0, 0, 0]), -1);
  const hands = [[1, 2], [2, 3], [4, 4]];
  /* bidder right: the challenger loses; bidder wrong: the bidder loses */
  assert.deepStrictEqual(L.ldChallenge({ q: 3, f: 2, by: 0 }, 1, hands, true), { actual: 3, bidderRight: true, loser: 1 });
  assert.deepStrictEqual(L.ldChallenge({ q: 4, f: 2, by: 2 }, 0, hands, true), { actual: 3, bidderRight: false, loser: 2 });
  /* only the viewer sees their own dice before the reveal */
  const v = L.ldView(hands, [2, 2, 2], 1, false);
  assert.strictEqual(v[0], null); assert.deepStrictEqual(v[1], [2, 3]); assert.strictEqual(v[2], null);
  assert(L.ldView(hands, [2, 2, 2], -1, false).every((x) => x === null));
  assert(L.ldView(hands, [2, 2, 2], -1, true).every((x) => Array.isArray(x)));
  const v2 = L.ldView(hands, [2, 2, 2], 1, true); v2[0].push(9); assert.strictEqual(hands[0].length, 2, 'views are copies');
  /* the cover appears for a human only while 2 or more humans are in the game */
  assert(L.ldNeedCover([2, 2, 2], ['h', 'h', 'p'], 0)); assert(L.ldNeedCover([2, 2, 2], ['h', 'h', 'p'], 1));
  assert(!L.ldNeedCover([2, 2, 2], ['h', 'h', 'p'], 2), 'phones never need a cover');
  assert(!L.ldNeedCover([2, 2], ['h', 'p'], 0), 'a lone human keeps the single-player screen');
  assert(!L.ldNeedCover([2, 0, 2], ['h', 'h', 'p'], 0), 'a lone human left in the game needs no cover');
});
test('multi-seat: simulated full games of 2-4 seats, humans and phones, always end with a valid winner', () => {
  const rollN = (n) => Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 6));
  const patterns = [];
  for (let np = 2; np <= 4; np++) for (let m = 0; m < (1 << np); m++) { const k = Array.from({ length: np }, (_, i) => ((m >> i) & 1 ? 'h' : 'p')); if (k.includes('h')) patterns.push(k); }
  /* Liar's Dice */
  let games = 0, covers = 0, leaks = 0;
  for (let g = 0; g < 1200; g++) {
    const kinds = patterns[g % patterns.length], np = kinds.length, wild = g % 2 === 0, dpp = 3 + (g % 3);
    const seats = L.seatList(np, kinds, []), ns = Array(np).fill(dpp), hands = Array(np).fill(null).map(() => []);
    let starter = 0, guard = 0;
    while (L.ldWinner(ns) < 0) {
      assert(++guard < 800, 'game did not end');
      for (let i = 0; i < np; i++) hands[i] = rollN(ns[i]);
      const total = ns.reduce((a, b) => a + b, 0);
      let cur = starter, prev = null, loser = -1, steps = 0;
      while (loser < 0) {
        assert(++steps < 500); assert(ns[cur] > 0, 'a seat without dice was asked to act');
        if (L.ldNeedCover(ns, kinds, cur)) covers++;
        /* what the screen may show while this seat is up: nobody else's dice */
        const view = L.ldView(hands, ns, cur, false); view.forEach((x, i) => { if (i !== cur && x) leaks++; });
        let m;
        if (seats[cur].ai) m = L.ldAI(hands[cur], total, prev, wild, 0);
        else { /* scripted human: random legal bid, or a challenge about a third of the time */
          const raises = L.ldRaises(prev, total);
          m = prev && (!raises.length || Math.random() < 0.35) ? { action: 'challenge' } : (raises.length ? Object.assign({ action: 'bid' }, raises[Math.floor(Math.random() * Math.min(raises.length, 6))]) : { action: 'challenge' });
        }
        if (m.action === 'challenge') { assert(prev); loser = L.ldChallenge(prev, cur, hands, wild).loser; }
        else { assert(L.ldValid(m, prev, total), 'illegal bid'); prev = { q: m.q, f: m.f, by: cur }; cur = L.ldNextAlive(ns, cur); }
      }
      ns[loser]--; assert(ns[loser] >= 0);
      starter = ns[loser] > 0 ? loser : L.ldNextAlive(ns, loser);
    }
    const w = L.ldWinner(ns); assert(w >= 0 && w < np && ns[w] > 0 && ns.filter((n) => n > 0).length === 1); games++;
  }
  assert.strictEqual(leaks, 0, 'another seat\'s dice were visible'); assert(covers > 0);
  console.log('     liar\'s dice: ' + games + ' mixed human/phone games over ' + patterns.length + ' seat patterns, ' + covers + ' pass-the-phone covers');
  /* Dice Five */
  const all = patterns.concat([['h']]); let dg = 0, ties = 0;
  for (let g = 0; g < 400; g++) {
    const kinds = all[g % all.length], np = kinds.length, seats = L.seatList(np, kinds, []), sheets = seats.map(() => L.dfNewSheet());
    for (let round = 0; round < 13; round++) for (let t = 0; t < np; t++) {
      let dice = rollN(5), left = 2;
      while (left > 0) {
        const hold = seats[t].ai ? L.dfAIHold(sheets[t], dice, left, 1) : dice.map(() => Math.random() < 0.5);
        if (hold.every(Boolean)) break;
        dice = dice.map((v, i) => (hold[i] ? v : 1 + Math.floor(Math.random() * 6))); left--;
      }
      const legal = L.dfLegal(sheets[t], dice), cat = seats[t].ai ? L.dfAIPick(sheets[t], dice) : legal[Math.floor(Math.random() * legal.length)].cat;
      assert(legal.some((o) => o.cat === cat)); sheets[t] = L.dfApply(sheets[t], cat, dice).sheet;
    }
    assert(sheets.every(L.dfDone));
    const totals = sheets.map(L.dfTotal), st = L.dfStandings(totals);
    assert(st.winners.length >= 1 && st.winners.every((i) => totals[i] === Math.max(...totals)) && st.order.length === np && st.order[0].rank === 1);
    assert.strictEqual(st.winners.length, totals.filter((x) => x === st.top).length); if (st.winners.length > 1) ties++; dg++;
  }
  console.log('     dice five: ' + dg + ' mixed games (1 to 4 seats), ' + ties + ' ties');
});

// @@TESTS@@

console.log(passed + ' test group(s) passed' + (process.exitCode ? ', with failures' : ''));
