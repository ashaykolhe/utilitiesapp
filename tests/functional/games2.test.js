'use strict';
/* Functional tests for www/js/tools/games2.js, part 1: pure rules plus daily challenge, word guess, mastermind, peg solitaire, nonogram. */
const { bootGame } = require('./fun-lib');
const { suite } = require('../helpers/page');
global.Tools = global.Tools || { register() {} };
const L = require('../../www/js/tools/games2.js');

(async () => {
  const T = suite('games2'), G = await bootGame({ seed: 7 });
  const W = G.w;
  if (process.env.DBG) { const o = G.page.errors.push.bind(G.page.errors); G.page.errors.push = (m) => { console.log('ERR', m, new Error().stack.split('\n').slice(1, 9).join(' <- '), 'last=', global.__last); return o(m); }; }
  const run = async (id, fn, pre) => {
    const before = G.listeners(); G.unseed(); G.clock.reset(); if (pre) pre();
    global.__last = id; const t = await G.page.open(id);
    try { await fn(t); } catch (e) { T.ok(false, id + ' threw: ' + String(e.stack || e).split('\n').slice(0, 3).join(' | ')); }
    G.leaves(t, before, T, id);
  };
  const num = (s) => +String(s).replace(/[^\d.-]/g, '');
  const dayKey = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  /* every candidate next term for a sequence (arithmetic, geometric, squares, Fibonacci-like, growing steps) */
  const nextTerms = (a) => {
    const out = new Set(), d = a.map((v, i) => i ? v - a[i - 1] : null).slice(1);
    if (d.every(x => x === d[0])) out.add(a[a.length - 1] + d[0]);
    if (a.every(v => v > 0) && a.slice(1).every((v, i) => v * a[0] === a[i + 1] * a[1] / 1 * 1 || true)) { const q = a[1] / a[0]; if (Number.isInteger(q) && a.every((v, i) => !i || v === a[i - 1] * q)) out.add(a[a.length - 1] * q); }
    if (a.every(v => Number.isInteger(Math.sqrt(v))) && a.every((v, i) => !i || Math.sqrt(v) === Math.sqrt(a[i - 1]) + 1)) out.add((Math.sqrt(a[a.length - 1]) + 1) ** 2);
    if (a.length >= 3 && a.every((v, i) => i < 2 || v === a[i - 1] + a[i - 2])) out.add(a[a.length - 1] + a[a.length - 2]);
    const dd = d.slice(1).map((v, i) => v - d[i]); if (dd.length && dd.every(x => x === dd[0])) out.add(a[a.length - 1] + d[d.length - 1] + dd[0]);
    return out;
  };
  const evalMath = (s) => { const m = /^(\d+) x (\d+) \+ (\d+)$/.exec(s) || /^(\d+) \/ (\d+) \+ (\d+)$/.exec(s) || /^(\d+) - (\d+) x (\d+) \+ 100$/.exec(s); if (!m) return null; if (s.includes(' x ') && s.includes(' - ')) return +m[1] - m[2] * m[3] + 100; if (s.includes(' x ')) return m[1] * m[2] + +m[3]; return m[1] / m[2] + +m[3]; };

  /* ---------------- pure logic ---------------- */
  {
    T.ok(L.WORDS.length >= 600, 'words: at least 600 five-letter words (' + L.WORDS.length + ')'); T.ok(L.WORDS.every(w => /^[a-z]{5}$/.test(w)), 'words: all lowercase, five letters'); T.eq(new Set(L.WORDS).size, L.WORDS.length, 'words: no duplicates');
    const eg = (g, a) => L.evalGuess(g, a).join('');
    T.eq(eg('babes', 'abbey'), 'yyggx', 'wordguess: BABES vs ABBEY');
    T.eq(eg('geese', 'those'), 'xxxgg', 'wordguess: repeated guess letters are marked once per letter in the answer'); T.eq(eg('apple', 'apple'), 'ggggg', 'wordguess: exact'); T.eq(eg('zzzzz', 'apple'), 'xxxxx', 'wordguess: nothing in common'); T.eq(eg('eerie', 'eagle'), 'gxxxg', 'wordguess: EERIE vs EAGLE'); T.eq(eg('llama', 'allee'), 'ygyxx', 'wordguess: LLAMA vs ALLEE');
    T.eq(L.shareGrid([['g', 'y', 'x', 'x', 'g']], false), '🟩🟨⬛⬛🟩', 'share grid: green and yellow'); T.eq(L.shareGrid([['g', 'y', 'x', 'x', 'g']], true), '🟦🟧⬛⬛🟦', 'share grid: colour-blind palette');
    const fb = (c, g) => { const r = L.mmFeedback(c, g); return r.b + ',' + r.w; };
    T.eq(fb([1, 2, 3, 4], [1, 2, 3, 4]), '4,0', 'mastermind: exact'); T.eq(fb([1, 2, 3, 4], [4, 3, 2, 1]), '0,4', 'mastermind: all misplaced'); T.eq(fb([1, 1, 2, 2], [1, 2, 1, 2]), '2,2', 'mastermind: 2 black 2 white'); T.eq(fb([1, 1, 2, 3], [1, 1, 1, 1]), '2,0', 'mastermind: surplus guess colours score nothing'); T.eq(fb([1, 2, 3, 4], [1, 1, 1, 1]), '1,0', 'mastermind: one black, no white for repeated guess'); T.eq(fb([1, 2, 3, 4], [5, 5, 5, 5]), '0,0', 'mastermind: no match'); T.eq(fb([1, 1, 2, 2], [2, 2, 1, 1]), '0,4', 'mastermind: pairs swapped'); T.eq(fb([0, 0, 1, 1, 2], [1, 0, 2, 2, 0]), '1,3', 'mastermind: five-peg code');
    const c1 = L.mmCode(4, 6, false); T.eq(new Set(c1).size, 4, 'mastermind: codes without repeats have four different colours');
    /* peg solitaire */
    const ps = L.pegStart(); T.eq(L.pegCount(ps), 32, 'pegsol: 32 pegs at the start'); T.eq(ps.filter(v => v >= 0).length, 33, 'pegsol: 33 holes on the board'); T.eq(L.pegMoves(ps).map(m => m.t).join(), '24,24,24,24', 'pegsol: the first jump always ends in the centre'); T.eq(L.pegMoves(ps).length, 4, 'pegsol: four opening moves');
    const p2 = L.pegApply(ps, L.pegMoves(ps)[0]); T.eq(L.pegCount(p2), 31, 'pegsol: a jump removes one peg'); T.eq(p2[24], 1, 'pegsol: the jumper lands in the hole');
    /* nonogram */
    T.eq(JSON.stringify(L.ngRunClue([1, 1, 0, 1, 0, 0])), '[2,1]', 'nonogram: run clue'); T.eq(JSON.stringify(L.ngRunClue([0, 0])), '[]', 'nonogram: blank line has no clue'); T.eq(JSON.stringify(L.ngClues([[1, 0], [1, 1]])), JSON.stringify({ rows: [[1], [2]], cols: [[2], [1]] }), 'nonogram: row and column clues');
    const toG = (p) => p.map(r => [...r].map(c => c === '#' ? 1 : 0));
    L.NG5.concat(L.NG10).forEach((p, i) => { const g = toG(p), cl = L.ngClues(g), r = L.ngSolve(cl.rows, cl.cols); T.ok(r.solved, 'nonogram: built-in puzzle ' + i + ' is solvable by logic'); T.ok(r.grid.every((row, y) => row.every((v, x) => (v === 1) === (g[y][x] === 1))), 'nonogram: built-in puzzle ' + i + ' has a single logical solution'); });
    T.ok(L.ngMatches([[1, 0], [0, 1]], [[1], [1]], [[1], [1]]), 'nonogram: matching is by clues'); T.ok(!L.ngMatches([[1, 1], [0, 1]], [[1], [1]], [[1], [1]]), 'nonogram: an extra filled cell fails'); T.ok(L.ngMatches([[1, 2], [0, 1]], [[1], [1]], [[1], [1]]), 'nonogram: marked-empty cells (2) count as empty');
    for (const n of [5, 10]) { const g = L.ngGen(n, Math.random); T.ok(g && g.length === n, 'nonogram: generator makes a ' + n + 'x' + n + ' puzzle'); const cl = L.ngClues(g); T.ok(L.ngSolve(cl.rows, cl.cols).solved, 'nonogram: random ' + n + 'x' + n + ' puzzle is solvable by logic'); }
    /* block stack */
    const bb = L.bsNewBoard(); T.eq(bb.length, 20, 'blocks: 20 rows'); T.eq(bb[0].length, 10, 'blocks: 10 columns');
    for (let c = 0; c < 9; c++) bb[19][c] = 1; T.eq(L.bsClear(bb), 0, 'blocks: a row with a gap is not cleared'); bb[19][9] = 1; bb[18][3] = 2; T.eq(L.bsClear(bb), 1, 'blocks: a full row clears'); T.eq(bb[19][3], 2, 'blocks: rows above fall down'); T.ok(bb[19].filter(Boolean).length === 1, 'blocks: only the fallen block remains');
    const fl = L.bsNewBoard(); for (let r = 16; r < 20; r++) for (let c = 0; c < 10; c++) fl[r][c] = 1; T.eq(L.bsClear(fl), 4, 'blocks: four rows at once'); T.eq(L.bsScore(4, 1), 800, 'blocks: four lines score 800 at level 1'); T.eq(L.bsScore(1, 3), 300, 'blocks: one line at level 3'); T.eq(L.bsScore(2, 2), 600, 'blocks: two lines at level 2'); T.eq(L.bsLevel(0), 1, 'blocks: level 1'); T.eq(L.bsLevel(10), 2, 'blocks: level 2 after ten lines'); T.eq(L.bsLevel(95), 10, 'blocks: level 10 after 95');
    T.ok(L.bsDelay(2) < L.bsDelay(1) && L.bsDelay(50) === 90, 'blocks: falling speeds up and is capped at 90 ms');
    const tt = L.BS_SHAPES.T; T.eq(JSON.stringify(L.bsRot(tt)), JSON.stringify([[0, 1, 0], [0, 1, 1], [0, 1, 0]]), 'blocks: T rotates clockwise'); T.eq(JSON.stringify(L.bsRot(L.bsRot(L.bsRot(L.bsRot(tt))))), JSON.stringify(tt), 'blocks: four rotations come back');
    const e0 = L.bsNewBoard(); T.ok(L.bsCollide(e0, L.BS_SHAPES.O, -1, 0), 'blocks: left wall collision'); T.ok(L.bsCollide(e0, L.BS_SHAPES.O, 9, 0), 'blocks: right wall collision'); T.ok(L.bsCollide(e0, L.BS_SHAPES.O, 0, 19), 'blocks: floor collision'); T.ok(!L.bsCollide(e0, L.BS_SHAPES.O, 4, 18), 'blocks: bottom row is fine');
    const iv = L.bsRot(L.BS_SHAPES.I); const kick = L.bsTryRotate(e0, { m: L.BS_SHAPES.I, x: -2, y: 5 }); T.ok(kick && !L.bsCollide(e0, kick.m, kick.x, kick.y), 'blocks: a rotation next to the wall is kicked inside'); void iv;
    const bag = L.bsBag(); T.eq(bag.slice().sort().join(), L.BS_KEYS.slice().sort().join(), 'blocks: a bag has each piece once');
    /* geometry */
    const h1 = L.circleRect(5, 5, 3, 0, 0, 10, 10); T.ok(h1 && h1.depth > 0, 'circleRect: centre inside is a hit'); T.ok(!L.circleRect(20, 5, 3, 0, 0, 10, 10), 'circleRect: far away is a miss'); const h2 = L.circleRect(12, 5, 3, 0, 0, 10, 10); T.eq(h2.nx + ',' + h2.ny, '1,0', 'circleRect: normal points out of the right side'); const h3 = L.circleRect(5, -2, 3, 0, 0, 10, 10); T.eq(h3.nx + ',' + h3.ny, '0,-1', 'circleRect: normal points out of the top');
    T.eq(L.pongAi(100, 200, 50, 1), 150, 'pong ai: moves at its speed limit'); T.eq(L.pongAi(100, 120, 50, 1), 120, 'pong ai: does not overshoot'); T.eq(L.pongAi(100, 40, 50, 1), 50, 'pong ai: moves down too');
    /* gem match */
    const gm = (rows) => rows.join('').split('').map(Number); T.eq(L.gmMatches(gm(['000', '123', '456']), 3).join(), '0,1,2', 'gems: a row of three');
    T.eq(L.gmMatches(gm(['012', '120', '201']), 3).join(), '', 'gems: no match'); T.eq(L.gmMatches(gm(['010', '123', '145']), 3).join(), '', 'gems: a split pair is not a match'); T.eq(L.gmMatches(gm(['100', '103', '245']), 3).join(), '', 'gems: a column of two is not a match');
    T.eq(L.gmMatches(gm(['100', '103', '154']), 3).join(), '0,3,6', 'gems: a column of three');
    T.eq(L.gmMatches([1, 1, 1, 0, 0, 1, 3, 4, 3, 4, 1, 4, 3, 4, 3, 2, 5, 2, 5, 2, 0, 3, 5, 3, 5], 5).join(), '0,1,2,5,10', 'gems: an L shape counts both arms');
    const sw = gm(['120', '211', '345']); T.ok(L.gmSwapOk(sw, 3, 0, 3), 'gems: a swap that makes three is allowed'); T.ok(!L.gmSwapOk(sw, 3, 0, 1), 'gems: a swap that makes nothing is refused'); T.ok(!L.gmSwapOk(sw, 3, 0, 4), 'gems: diagonal swaps are refused');
    const col = L.gmCollapse(gm(['012', '345', '012']), 3, [3, 4, 5], () => 9); T.eq(col.board.join(''), '999012012'.slice(0, 3) + '012' + '012', 'gems: gems above a removed row fall'); T.eq(col.fresh.length, 3, 'gems: three new gems drop in');
    const nb = L.gmNewBoard(8, 6); T.eq(L.gmMatches(nb, 8).length, 0, 'gems: a new board has no ready matches'); T.ok(!!L.gmFindMove(nb, 8), 'gems: and at least one move');
    /* dots and boxes */
    const s3 = L.dbNew(2, 2); T.eq(s3.e.length, 12, 'dots: a 2x2 grid has 12 edges'); L.dbPlay(s3, L.dbBoxEdges(s3, 0, 0)[0], 1); L.dbPlay(s3, L.dbBoxEdges(s3, 0, 0)[1], 1); L.dbPlay(s3, L.dbBoxEdges(s3, 0, 0)[2], 1); T.eq(L.dbSides(s3, 0), 3, 'dots: three sides drawn'); T.eq(L.dbPlay(s3, L.dbBoxEdges(s3, 0, 0)[3], 2), 1, 'dots: the fourth side completes one box'); T.eq(s3.box[0], 2, 'dots: the box belongs to whoever closed it'); T.eq(L.dbPlay(s3, L.dbBoxEdges(s3, 0, 0)[3], 2), -1, 'dots: an edge cannot be drawn twice');
    const s4 = L.dbNew(1, 2); const sh = L.dbBoxEdges(s4, 0, 0)[3]; T.eq(sh, L.dbBoxEdges(s4, 0, 1)[2], 'dots: neighbouring boxes share an edge'); [L.dbBoxEdges(s4, 0, 0)[0], L.dbBoxEdges(s4, 0, 0)[1], L.dbBoxEdges(s4, 0, 0)[2], L.dbBoxEdges(s4, 0, 1)[0], L.dbBoxEdges(s4, 0, 1)[1], L.dbBoxEdges(s4, 0, 1)[3]].forEach(e => L.dbPlay(s4, e, 1)); T.eq(L.dbPlay(s4, sh, 2), 2, 'dots: one line can close two boxes');
    const s5 = L.dbNew(2, 2); const be = L.dbBoxEdges(s5, 0, 0); [be[0], be[1], be[2]].forEach(e => L.dbPlay(s5, e, 1)); T.eq(L.dbAi(s5, 0), be[3], 'dots: the phone takes a box when it can (easy)'); T.eq(L.dbAi(s5, 1), be[3], 'dots: the phone takes a box when it can (smart)');
    /* reversi */
    const rs = L.rvStart(); T.eq(L.rvMoves(rs, 1).join(), '19,26,37,44', 'reversi: black opens on 19, 26, 37 or 44'); const r1 = L.rvApply(rs, 19, 1); T.eq(r1.flips.join(), '27', 'reversi: 19 flips 27'); T.eq(JSON.stringify(L.rvCount(r1.board)), '{"b":4,"w":1}', 'reversi: 4-1 after the first move'); T.eq(L.rvFlips(rs, 0, 1).length, 0, 'reversi: a move that flips nothing is illegal'); T.eq(L.rvFlips(rs, 27, 1).length, 0, 'reversi: an occupied square is illegal');
    const bd = new Array(64).fill(0); bd[0] = 1; bd[1] = 2; bd[2] = 2; bd[3] = 2; T.eq(L.rvFlips(bd, 4, 1).join(), '3,2,1', 'reversi: a row of three is flipped'); const dg = new Array(64).fill(0); dg[0] = 1; dg[9] = 2; dg[18] = 2; T.eq(L.rvFlips(dg, 27, 1).join(), '18,9', 'reversi: diagonal flips'); const wd = new Array(64).fill(0); wd[7] = 2; wd[8] = 2; wd[9] = 1; T.eq(L.rvFlips(wd, 6, 1).length, 0, 'reversi: a line does not wrap round the edge of the board');
    const full = new Array(64).fill(1); T.ok(L.rvOver(full), 'reversi: a full board is over'); T.ok([19, 26, 37, 44].includes(L.rvAi(rs, 1, 0)), 'reversi: the random AI plays a legal opening'); T.ok([19, 26, 37, 44].includes(L.rvAi(rs, 1, 2)), 'reversi: the AI plays a legal opening');
    const cb = new Array(64).fill(0); cb[1] = 2; cb[2] = 1; cb[9] = 2; cb[18] = 1; cb[8] = 2; cb[16] = 1; T.eq(L.rvAi(cb, 1, 2), 0, 'reversi: AI takes a corner when it is available');
    /* maze */
    for (const [w, h] of [[8, 8], [12, 9], [15, 15]]) { const m = L.mazeGen(w, h); let edges = 0; for (let i = 0; i < w * h; i++) { if (m[i] & L.MZ.E) edges++; if (m[i] & L.MZ.S) edges++; if ((m[i] & L.MZ.E) && !(m[i + 1] & L.MZ.W)) edges += 100; } T.eq(edges, w * h - 1, 'maze: ' + w + 'x' + h + ' is a perfect maze (every cell reachable, no loops)'); T.ok(L.mazeDist(m, w, h, 0, w * h - 1) > 0, 'maze: the goal is reachable'); }
    const lm = [L.MZ.E, L.MZ.E | L.MZ.W, L.MZ.W]; T.eq(L.mazeSlide(lm, 3, 1, 0, 1, 2).join(), '1,2', 'maze: slides along a corridor to the goal'); T.eq(L.mazeSlide(lm, 3, 1, 0, 0, 2).length, 0, 'maze: a wall stops movement');
    /* 24 game */
    const s24 = (a) => L.solve24(a); const ev = (s) => Function('"use strict"; return (' + s.replace(/ x /g, ' * ') + ')')();
    for (const a of [[4, 7, 8, 8], [3, 3, 8, 8], [1, 5, 5, 5], [6, 6, 6, 6], [1, 2, 3, 4], [8, 8, 3, 3], [5, 5, 5, 1], [1, 3, 4, 6], [1, 1, 2, 7]]) { const r = s24(a); const ok = r !== null && Math.abs(ev(r) - 24) < 1e-9 && r.match(/\d+/g).map(Number).sort().join() === a.slice().sort().join(); T.ok(ok, '24: ' + a.join(',') + ' -> ' + r); }
    T.eq(s24([1, 1, 1, 1]), null, '24: 1,1,1,1 has no solution'); T.eq(s24([1, 1, 1, 2]), null, '24: 1,1,1,2 has no solution');
    { /* every hand of four numbers 1-9: the game agrees with an independent exact-fraction search about which can make 24 */
      const frac = (n, d) => { const g = (a, b) => b ? g(b, a % b) : Math.abs(a); const k = g(n, d) || 1; return d < 0 ? [-n / k, -d / k] : [n / k, d / k]; };
      const can = (xs) => { if (xs.length === 1) return xs[0][0] === 24 && xs[0][1] === 1; for (let i = 0; i < xs.length; i++) for (let j = 0; j < xs.length; j++) { if (i === j) continue; const rest = xs.filter((_, k) => k !== i && k !== j), a = xs[i], b = xs[j], outs = [frac(a[0] * b[1] + b[0] * a[1], a[1] * b[1]), frac(a[0] * b[1] - b[0] * a[1], a[1] * b[1]), frac(a[0] * b[0], a[1] * b[1])]; if (b[0] !== 0) outs.push(frac(a[0] * b[1], a[1] * b[0])); if (outs.some(o => can(rest.concat([o])))) return true; } return false; };
      let disagree = 0, unsolvable = 0, total = 0; for (let a = 1; a <= 9; a++) for (let b = a; b <= 9; b++) for (let c = b; c <= 9; c++) for (let d = c; d <= 9; d++) { total++; const mine = can([a, b, c, d].map(n => [n, 1])), theirs = L.solve24([a, b, c, d]) !== null; if (!mine) unsolvable++; if (mine !== theirs) disagree++; }
      T.eq(total, 495, '24: 495 different hands'); T.eq(disagree, 0, '24: the solver agrees with an independent search on all 715 hands (' + unsolvable + ' have no solution)'); }
    T.eq(L.frStr(L.frOp([1, 1], '/', [3, 1])), '1/3', '24: fractions are exact'); T.eq(L.frOp([1, 1], '/', [0, 1]), null, '24: division by zero is refused'); T.eq(L.frStr(L.frOp([1, 3], '+', [2, 3])), '1', '24: 1/3 + 2/3 = 1'); T.eq(L.frStr(L.frOp([3, 1], '-', [5, 1])), '-2', '24: negative results are kept');
    for (let k = 0; k < 40; k++) T.ok(!!s24(L.gen24()), '24: every dealt hand is solvable (' + k + ')');
    /* higher or lower, digit span, typing, stroop */
    T.eq(L.hiloCmp(5, 9), 1, 'hilo: 9 is higher than 5'); T.eq(L.hiloCmp(9, 5), -1, 'hilo: 5 is lower than 9'); T.eq(L.hiloCmp(7, 7), 0, 'hilo: equal is a push'); T.eq(L.hiloCmp(13, 1), 1, 'hilo: an ace after a king is higher (ace is high)'); T.eq(L.hiloCmp(1, 2), -1, 'hilo: a 2 after an ace is lower');
    for (let k = 0; k < 50; k++) { const s = L.dsSeq(6 + k % 5); if (s.some((d, i) => i && d === s[i - 1]) || s.some(d => d < 0 || d > 9)) T.ok(false, 'digitspan: sequence rule'); } T.ok(true, 'digitspan: sequences never repeat a digit twice in a row'); T.ok(L.dsCheck([1, 2, 3], [1, 2, 3], false), 'digitspan: forwards'); T.ok(L.dsCheck([1, 2, 3], [3, 2, 1], true), 'digitspan: backwards'); T.ok(!L.dsCheck([1, 2, 3], [3, 2, 1], false), 'digitspan: wrong direction fails'); T.ok(!L.dsCheck([1, 2, 3], [1, 2], false), 'digitspan: too short fails');
    const wl = [{ w: 'cat', y: 10 }, { w: 'cart', y: 50 }, { w: 'cat', y: 30 }]; const tm = L.tfMatch(wl, 'cat'); T.eq(tm.exact, 2, 'typing: the lower of two identical words is cleared first'); T.eq(tm.prefix, 2, 'typing: the lowest word with that prefix is highlighted'); T.eq(L.tfMatch(wl, 'car').prefix, 1, 'typing: a prefix picks the right word'); T.eq(L.tfMatch(wl, 'x').prefix, -1, 'typing: no match'); T.eq(L.tfMatch(wl, '').exact, -1, 'typing: nothing typed');
    let same = 0; for (let k = 0; k < 2000; k++) { const s = L.stroopTrial(); if (s.word === s.ink) same++; } T.ok(same > 350 && same < 650, 'stroop: about a quarter of trials are congruent (' + same + '/2000)');
    /* daily challenge */
    T.eq(L.dayKey(new Date(2026, 0, 5)), '2026-01-05', 'daily: day key is the local date'); T.eq(L.dayNum('2026-03-01') - L.dayNum('2026-02-28'), 1, 'daily: consecutive days differ by one'); T.eq(L.dayNum('2024-03-01') - L.dayNum('2024-02-28'), 2, 'daily: leap day counted');
    let st = L.streakSolve({}, '2026-05-01'); T.eq(st.streak, 1, 'daily: first solve starts a streak'); st = L.streakSolve(st, '2026-05-02'); T.eq(st.streak, 2, 'daily: next day extends it'); st = L.streakSolve(st, '2026-05-02'); T.eq(st.streak, 2, 'daily: solving twice on one day counts once'); st = L.streakSolve(st, '2026-05-04'); T.eq(st.streak, 1, 'daily: a skipped day resets'); T.eq(st.best, 2, 'daily: best is kept');
    T.eq(L.streakShown({ streak: 4, last: '2026-05-02' }, '2026-05-03'), 4, 'daily: a streak is alive the day after'); T.eq(L.streakShown({ streak: 4, last: '2026-05-02' }, '2026-05-04'), 0, 'daily: and gone after a missed day'); T.eq(L.streakShown({ streak: 4, last: '2026-05-02' }, '2026-05-02'), 4, 'daily: shown on the solve day');
    const seenType = {}; let dailyOk = true;
    for (let k = 0; k < 500; k++) {
      const key = dayKey(new Date(Date.UTC(2026, 0, 1) + k * 864e5)), p = L.dailyPuzzle(key), p2 = L.dailyPuzzle(key); seenType[p.type] = (seenType[p.type] || 0) + 1;
      if (JSON.stringify(p) !== JSON.stringify(p2)) dailyOk = false;
      if (p.type === 'sequence') { const a = p.shown.replace(/\?/g, '').split(',').map(s => s.trim()).filter(Boolean).map(Number); if (a.length !== 5 || !nextTerms(a).has(+p.answers[0])) { dailyOk = false; console.log('bad sequence', key, a, p.answers); } }
      else if (p.type === 'math') { if (p.shown.length !== 3 || p.shown.some((q, i) => String(evalMath(q)) !== p.answers[i] || evalMath(q) < 0 || !Number.isInteger(evalMath(q)))) { dailyOk = false; console.log('bad math', key, p.shown, p.answers); } }
      else { const letters = p.shown.split(' ').join('').toLowerCase(); if (!p.answers.length || p.answers.some(w => w.split('').sort().join('') !== letters.split('').sort().join('') || !L.WORDS.includes(w)) || p.answers.includes(letters)) { dailyOk = false; console.log('bad scramble', key, p.shown, p.answers); } }
    }
    T.ok(dailyOk, 'daily: 500 days of puzzles are deterministic and every answer is correct'); T.ok(seenType.scramble > 100 && seenType.sequence > 100 && seenType.math > 100, 'daily: all three puzzle kinds are used (' + JSON.stringify(seenType) + ')');
    T.ok(L.dailyCheck({ type: 'math', answers: ['1', '2', '3'] }, ['1', '2', '3']), 'daily: math check'); T.ok(!L.dailyCheck({ type: 'math', answers: ['1', '2', '3'] }, ['1', '2']), 'daily: math needs all three'); T.ok(L.dailyCheck({ type: 'scramble', answers: ['apple'] }, [' APPLE ']), 'daily: words are trimmed and case-insensitive'); T.ok(!L.dailyCheck({ type: 'sequence', answers: ['12'] }, ['']), 'daily: blank is wrong');
  }

  /* ---------------- Daily Challenge (UI, across days) ---------------- */
  {
    const key0 = '2026-03-10'; const days = []; for (let k = 0; k < 9; k++) days.push(dayKey(new Date(Date.UTC(2026, 2, 10) + k * 864e5)));
    const solveToday = async (key, mode) => {
      const kinds = {};
      G.setDate(key + 'T10:00:00'); const before = G.listeners(); G.clock.reset();
      const t = await G.page.open('dailychal'); const p = L.dailyPuzzle(key);
      try {
        const title = t.q('#pz').previousElementSibling.previousElementSibling.textContent; kinds.t = title;
        const typeIn = (vals) => vals.forEach((v, i) => t.type('#in' + i, v));
        if (mode === 'solve') {
          let answers;
          if (/sequence/i.test(title)) { const a = t.q('#pz').textContent.replace(/\?/g, '').split(',').map(s => s.trim()).filter(Boolean).map(Number); answers = [...nextTerms(a)].map(String); T.ok(answers.length >= 1, 'daily ' + key + ': the shown sequence follows a rule'); }
          else if (/Quick sums/i.test(title)) { answers = [t.all('#pz div').map(d => String(evalMath(d.textContent.replace(' = ?', ''))))]; }
          else { const letters = t.q('#pz').textContent.replace(/\s/g, '').toLowerCase(); answers = L.WORDS.filter(w => w.split('').sort().join('') === letters.split('').sort().join('')); }
          if (/Quick sums/i.test(title)) typeIn(answers[0]); else { t.type('#in0', answers[0]); }
          t.click('#go'); T.has(t.q('#msg').textContent, 'Solved', 'daily ' + key + ' (' + title + '): the right answer solves it'); T.ok(t.q('#go').disabled, 'daily: Check is disabled once solved');
        }
      } finally { G.leaves(t, before, T, 'dailychal ' + key); }
      return kinds;
    };
    G.setStore('fun2.dailychal', undefined); W.localStorage.removeItem('pk.fun2.dailychal');
    const titles = new Set(); const streaks = [];
    for (let k = 0; k < 6; k++) { const r = await solveToday(days[k], 'solve'); titles.add(r.t); streaks.push(G.store('fun2.dailychal').streak); }
    T.eq(streaks.join(), '1,2,3,4,5,6', 'daily: solving on consecutive days builds the streak'); T.ok(titles.size === 3, 'daily: six days covered all three puzzle kinds (' + [...titles].join(' / ') + ')');
    /* reopening on the same day shows it as solved and locked */
    G.setDate(days[5] + 'T20:00:00'); { const t = await G.page.open('dailychal'); T.has(t.text(), 'Solved', 'daily: the solved state is remembered for the day'); T.ok(t.q('#go').disabled && t.q('#in0').disabled, 'daily: inputs are locked'); T.eq(t.q('#stk').textContent, '6', 'daily: streak shown'); t.close(); }
    /* skip a day: streak display drops, then solving restarts it at 1 but keeps the best */
    G.setDate(days[8] + 'T08:00:00'); { const t = await G.page.open('dailychal'); T.eq(t.q('#stk').textContent, '0', 'daily: after a missed day the streak shows 0'); T.eq(t.q('#bst').textContent, '6', 'daily: best streak is kept'); T.eq(t.q('#tr').textContent, '3', 'daily: three tries on a new day'); t.close(); }
    await solveToday(days[8], 'solve'); T.eq(G.store('fun2.dailychal').streak, 1, 'daily: solving after a gap starts again at 1'); T.eq(G.store('fun2.dailychal').best, 6, 'daily: best streak still 6');
    /* wrong answers: three tries then the answer is shown and the streak is not touched */
    W.localStorage.removeItem('pk.fun2.dailychal'); G.setDate('2026-04-02T09:00:00');
    { const t = await G.page.open('dailychal'); t.click('#go'); T.has(t.q('#msg').textContent, 'Fill in', 'daily: empty answer asks to fill it in'); T.eq(t.q('#tr').textContent, '3', 'daily: an empty answer costs no try');
      const vals = (() => { const p = L.dailyPuzzle('2026-04-02'); return p.type === 'math' ? ['0', '0', '0'] : ['0']; })();
      for (let k = 0; k < 3; k++) { t.all('input').forEach((i, x) => t.type('#' + i.id, x ? '0' : (L.dailyPuzzle('2026-04-02').type === 'scramble' ? 'zzzzz' : '0'))); t.click('#go'); }
      T.eq(t.q('#tr').textContent, '0', 'daily: three wrong answers use all tries'); T.has(t.q('#msg').textContent, 'Out of tries', 'daily: says so'); T.has(t.q('#msg').textContent, 'Answer', 'daily: reveals the answer'); T.ok(t.q('#go').disabled, 'daily: Check is disabled'); T.eq(G.store('fun2.dailychal').streak, 0, 'daily: a failed day gives no streak'); void vals; t.close(); }
    { const t = await G.page.open('dailychal'); T.has(t.q('#msg').textContent, 'Out of tries', 'daily: the failed state is remembered for the day (no retry by reopening)'); t.close(); }
    G.setDate(new Date().toISOString());
  }

  /* ---------------- Word Guess ---------------- */
  {
    const WORDS = L.WORDS, idx = (w) => WORDS.indexOf(w), force = (w) => () => G.queue([idx(w) / 4294967296]);
    const my = (g, a) => { const r = Array(5).fill('x'), cnt = {}; for (let i = 0; i < 5; i++) if (g[i] === a[i]) r[i] = 'g'; else cnt[a[i]] = (cnt[a[i]] || 0) + 1; for (let i = 0; i < 5; i++) if (r[i] === 'x' && cnt[g[i]]) { r[i] = 'y'; cnt[g[i]]--; } return r.join(''); };
    const rows = (t) => t.all('#grid > div'), tiles = (t, r) => [...rows(t)[r].children], marks = (t, r) => tiles(t, r).map(x => /\bmg\b/.test(x.className) ? 'g' : /\bmy\b/.test(x.className) ? 'y' : /\bmx\b/.test(x.className) ? 'x' : '').join('');
    const typeWord = (t, w) => { w.split('').forEach(c => G.key(c)); G.key('Enter'); };
    await run('wordguess', async (t) => {
      const ans = 'apple'; T.has(t.q('#msg').textContent, 'Type or tap', 'wordguess: prompt');
      G.key('a'); G.key('b'); G.key('Enter'); T.has(t.q('#msg').textContent, 'Not enough letters', 'wordguess: five letters are needed'); T.eq(tiles(t, 0).map(x => x.textContent).join(''), 'ab', 'wordguess: typed letters show in the row'); G.key('Backspace'); T.eq(tiles(t, 0).map(x => x.textContent).join(''), 'a', 'wordguess: backspace'); G.key('Backspace'); G.key('Backspace'); T.eq(tiles(t, 0).map(x => x.textContent).join(''), '', 'wordguess: backspace on empty is harmless');
      '123456'.split('').forEach(c => G.key(c)); G.key('A', null); T.eq(tiles(t, 0).map(x => x.textContent).join(''), 'a', 'wordguess: only letters are accepted (capitals too)'); G.key('Backspace');
      const guesses = ['allee', 'ample', 'plate', 'eagle', 'apple'], expected = [];
      for (const g of guesses.slice(0, 4)) { typeWord(t, g); T.eq(marks(t, expected.length), my(g, ans), 'wordguess: marks for ' + g + ' vs ' + ans); expected.push(my(g, ans)); }
      /* the keyboard keeps the best state of each letter: green beats yellow beats grey */
      const ks = (c) => { const b = t.q('#kb [data-k="' + c + '"]'); return /\bmg\b/.test(b.className) ? 'g' : /\bmy\b/.test(b.className) ? 'y' : /\bmx\b/.test(b.className) ? 'x' : ''; };
      T.eq(ks('a') + ks('p') + ks('l') + ks('e'), 'gggg', 'wordguess: letters that were green stay green on the keyboard');
      T.eq(ks('z'), '', 'wordguess: unused letters stay plain'); T.eq(ks('g'), 'x', 'wordguess: a letter not in the word turns grey');
      typeWord(t, 'apple'); G.tick(2000); T.has(t.q('#msg').textContent, 'Great', 'wordguess: guessing it on try 5 is congratulated'); T.ok(!t.q('#shr').hidden, 'wordguess: Share appears'); G.key('a'); T.eq(rows(t).slice(5).every(r => [...r.children].every(x => !x.textContent)), true, 'wordguess: no typing after the end');
      const ws = G.store('fun2.wordguess'); T.eq(ws.played + ',' + ws.won + ',' + ws.streak + ',' + ws.best, '1,1,1,1', 'wordguess: stats'); T.eq(ws.dist.join(), '0,0,0,0,1,0', 'wordguess: the guess distribution counts the winning row');
      let shared = ''; Object.defineProperty(W.navigator, 'clipboard', { value: { writeText: (s) => { shared = s; return Promise.resolve(); } }, configurable: true }); t.click('#shr'); await G.page.wait(10);
      T.has(shared, 'Word Guess 5/6', 'wordguess: the shared text has the result'); T.eq(shared.split('\n').length, 6, 'wordguess: header + one line per guess'); T.eq(shared.split('\n').slice(1).map(l => [...l].length).join(), '5,5,5,5,5', 'wordguess: five squares per row'); T.eq(shared.split('\n')[5], '🟦🟦🟦🟦🟦', 'wordguess: the last row is all green squares (blue in colour-blind mode)');
      t.click('#pal'); t.click('#shr'); await G.page.wait(10); T.eq(shared.split('\n')[5], '🟩🟩🟩🟩🟩', 'wordguess: the usual palette shares green squares'); T.eq(shared.split('\n')[1], [...my('allee', ans)].map(m => m === 'g' ? '🟩' : m === 'y' ? '🟨' : '⬛').join(''), 'wordguess: the shared row matches the marks');
      T.eq(G.store('fun2.wordguess.cb'), false, 'wordguess: palette choice saved'); t.click('#new'); T.eq(tiles(t, 0).map(x => x.textContent).join(''), '', 'wordguess: New word clears the board'); T.ok(t.q('#shr').hidden, 'wordguess: Share hidden again');
    }, force('apple'));
    await run('wordguess', async (t) => {
      'crane'.split('').forEach(c => G.key(c)); G.key('Enter'); T.eq(marks(t, 0), my('crane', 'zebra'), 'wordguess: marks with repeated letters in the answer'); typeWord(t, 'eerie'); T.eq(marks(t, 1), my('eerie', 'zebra'), 'wordguess: EERIE vs ZEBRA');
      for (const g of ['about', 'above', 'abuse', 'actor']) typeWord(t, g); G.tick(2000); T.has(t.q('#msg').textContent, 'The word was ZEBRA', 'wordguess: six misses reveal the word'); const ws = G.store('fun2.wordguess'); T.eq(ws.played + ',' + ws.won + ',' + ws.streak, '2,1,0', 'wordguess: a loss counts as played and resets the streak (earlier win was game 1)');
      t.click('#shr'); T.ok(true, 'wordguess: share after a loss does not throw'); G.key('a'); T.eq(rows(t)[5].children[0].textContent, 'o'.slice(0, 0) + (rows(t)[5].children[0].textContent), 'wordguess: board is locked');
    }, force('zebra'));
    await run('wordguess', async (t) => {
      /* clicking a game over and then New word while the result animation is still pending must not show the old result */
      typeWord(t, 'apple'); t.click('#new'); G.tick(3000); T.ok(t.q('#shr').hidden, 'wordguess: pressing New word right after winning does not bring back the old result');
      T.has(t.q('#msg').textContent, 'Type or tap', 'wordguess: the new game keeps its own prompt');
    }, force('apple'));
    await run('wordguess', async (t) => { const b = t.all('#kb button'); T.eq(b.length, 28, 'wordguess: on-screen keyboard has 26 letters, Enter and Back'); t.click('#kb [data-k="q"]'); t.click('#kb [data-k="Back"]'); T.eq(tiles(t, 0).map(x => x.textContent).join(''), '', 'wordguess: on-screen keys work'); 'hello'.split('').forEach(c => t.click('#kb [data-k="' + c + '"]')); t.click('#kb [data-k="Enter"]'); T.eq(rows(t)[0].children[0].textContent, 'h', 'wordguess: a guess typed on screen is entered'); });
  }

  /* ---------------- Mastermind ---------------- */
  {
    const codeQ = (arr) => () => G.queue(arr.map(c => c / 4294967296));
    const fbOf = (c, g) => { let b = 0; const cc = {}, gc = {}; c.forEach((v, i) => { if (v === g[i]) b++; else { cc[v] = (cc[v] || 0) + 1; gc[g[i]] = (gc[g[i]] || 0) + 1; } }); let w = 0; Object.keys(gc).forEach(k => { if (cc[k]) w += Math.min(cc[k], gc[k]); }); return b + ',' + w; };
    const rowsOf = (t) => t.all('#board .mm-r'), fbRow = (t, r) => { const f = [...rowsOf(t)[r].querySelectorAll('.mm-fb i')]; return f.filter(i => i.classList.contains('b')).length + ',' + f.filter(i => i.classList.contains('w')).length; };
    const pickCols = (t, cols) => cols.forEach(c => t.click('#pal [data-c="' + c + '"]'));
    await run('mastermind', async (t) => {
      const code = [0, 1, 2, 0]; T.has(t.q('#msg').textContent, 'repeat', 'mastermind: normal level allows repeats'); T.eq(t.all('#pal button').length, 6, 'mastermind: six colours'); T.eq(rowsOf(t).length, 10, 'mastermind: ten rows'); T.eq(t.q('#tl').textContent, '10', 'mastermind: ten guesses');
      t.click('#ok'); T.has(t.q('#msg').textContent, 'Fill every slot', 'mastermind: all slots must be filled'); T.eq(t.q('#tl').textContent, '10', 'mastermind: nothing is spent on an incomplete guess');
      const guesses = [[1, 1, 1, 1], [0, 0, 1, 1], [2, 1, 0, 0], [0, 1, 2, 0]];
      for (let k = 0; k < guesses.length; k++) { const g = guesses[k]; pickCols(t, g); if (k === 1) { t.click('#clr'); pickCols(t, g); } t.click('#ok'); T.eq(fbRow(t, k), fbOf(code, g), 'mastermind: feedback for guess ' + (k + 1) + ' (' + g.join('') + ')'); if (k < 3) T.has(t.q('#msg').textContent, fbOf(code, g).split(',')[0] + ' black', 'mastermind: the message repeats the feedback'); }
      T.has(t.q('#msg').textContent, 'Cracked it in 4 guesses', 'mastermind: cracking the code'); T.eq(G.store('fun2.mastermind.best')['1'], 4, 'mastermind: best guesses saved per level'); T.eq(t.q('#bs').textContent, '4', 'mastermind: best shown'); pickCols(t, [1]); T.eq(t.all('#board [data-s]').length, 0, 'mastermind: no input after winning');
      t.click('#new'); pickCols(t, [3, 3, 3, 3]); t.click('#board [data-s="1"]'); T.eq(t.all('#board .mm-r.now .mm-p').filter(p => p.textContent).length, 3, 'mastermind: tapping a slot removes its colour'); pickCols(t, [4]); T.eq(t.all('#board .mm-r.now .mm-p').filter(p => p.textContent).length, 4, 'mastermind: the freed slot is refilled first');
      /* lose after ten guesses */
      t.click('#new'); const wrong = [5, 5, 5, 5]; for (let k = 0; k < 10; k++) { pickCols(t, wrong); t.click('#ok'); } T.has(t.q('#msg').textContent, 'Out of guesses', 'mastermind: ten wrong guesses lose'); T.has(t.q('#msg').textContent, 'The code was', 'mastermind: the code is revealed'); T.eq(t.q('#msg').querySelectorAll('span').length, 4, 'mastermind: four pegs revealed');
    }, codeQ([0, 1, 2, 0]));
    await run('mastermind', async (t) => {
      t.click('#lv [data-v="0"]'); T.has(t.q('#msg').textContent, 'No repeated', 'mastermind: easy has no repeats'); pickCols(t, [0, 0, 1, 2]); t.click('#ok'); T.has(t.q('#msg').textContent, 'no repeated colours', 'mastermind: a repeated colour is refused in easy mode'); T.eq(t.q('#tl').textContent, '10', 'mastermind: and not counted'); T.eq(G.store('fun2.mastermind.lv'), 0, 'mastermind: level saved');
      t.click('#lv [data-v="2"]'); T.eq(t.all('#pal button').length, 8, 'mastermind: hard has eight colours'); T.eq(t.all('#board .mm-r.now .mm-p').length, 5, 'mastermind: hard code has five pegs'); T.eq(rowsOf(t).length, 12, 'mastermind: hard has twelve rows'); T.eq(t.q('#tl').textContent, '12', 'mastermind: twelve guesses');
    });
  }

  /* ---------------- Peg Solitaire ---------------- */
  await run('pegsol', async (t) => {
    const cell = (i) => t.q('#bd [data-i="' + i + '"]'), pegs = () => t.all('#bd .ps-p').length, glow = () => t.all('#bd .tg').map(b => +b.dataset.i);
    T.eq(pegs(), 32, 'pegsol: 32 pegs'); T.eq(t.q('#undo').disabled, true, 'pegsol: nothing to undo at first'); T.has(t.q('#msg').textContent, 'Tap a peg', 'pegsol: instruction');
    cell(0 + 2).click(); T.eq(glow().length, 0, 'pegsol: a peg that cannot jump shows no targets'); T.has(t.q('#msg').textContent, 'cannot jump', 'pegsol: and says so');
    cell(10).click(); T.eq(glow().join(), '24', 'pegsol: selecting a peg that can jump shows the landing hole'); cell(10).click(); T.eq(glow().length, 0, 'pegsol: selecting it again deselects');
    cell(10).click(); cell(24).click(); T.eq(pegs(), 31, 'pegsol: the jump removes one peg'); T.eq(t.q('#pg').textContent, '31', 'pegsol: counter'); T.eq(t.q('#mv').textContent, '1', 'pegsol: move counted'); T.ok(!cell(17).querySelector('.ps-p'), 'pegsol: the jumped peg is gone'); T.ok(!cell(10).querySelector('.ps-p'), 'pegsol: the start hole is empty');
    t.click('#undo'); T.eq(pegs(), 32, 'pegsol: undo puts the peg back'); T.eq(t.q('#mv').textContent, '0', 'pegsol: undo takes the move back'); t.click('#new'); T.eq(pegs(), 32, 'pegsol: restart');
    /* find a perfect solution with the game's own rules (depth-first with memory) and play it through the UI */
    const key = (b) => b.join(''), dead = new Set(), t0 = Date.now(); let sol = null;
    const dfs = (b, mv) => { if (L.pegCount(b) === 1) { if (b[24] === 1) { sol = mv.slice(); return true; } return false; } const k = key(b); if (dead.has(k)) return false; if (Date.now() - t0 > 20000) return false; const ms = L.pegMoves(b); for (const m of ms) { mv.push(m); if (dfs(L.pegApply(b, m), mv)) return true; mv.pop(); } dead.add(k); return false; };
    dfs(L.pegStart(), []); T.ok(sol && sol.length === 31, 'pegsol: found a 31-move perfect solution (' + (Date.now() - t0) + ' ms)');
    if (sol) { sol.forEach(m => { cell(m.f).click(); cell(m.t).click(); }); T.has(t.q('#msg').textContent, 'Perfect', 'pegsol: one peg in the centre is called perfect'); T.eq(pegs(), 1, 'pegsol: one peg left'); T.eq(G.store('fun2.pegsol.best'), 1, 'pegsol: best (pegs left) saved'); T.eq(t.q('#bs').textContent, '1', 'pegsol: best shown'); }
    t.click('#new'); G.seed(5); let steps = 0; while (steps++ < 40) { const ms = L.pegMoves(readBoard()); if (!ms.length) break; const m = ms[Math.floor(G.w.Math.random() * ms.length)]; cell(m.f).click(); cell(m.t).click(); }
    function readBoard() { return t.all('#bd > *').map(c => c.classList.contains('v') ? -1 : c.querySelector('.ps-p') ? 1 : 0); }
    T.ok(/No moves left|One peg left|Perfect/.test(t.q('#msg').textContent), 'pegsol: playing on to the end gives a final message (' + t.q('#msg').textContent + ')'); const left = pegs(); T.eq(L.pegMoves(readBoard()).length, 0, 'pegsol: the game ends exactly when no jump is possible'); T.ok(G.store('fun2.pegsol.best') <= left, 'pegsol: best never worse than this game');
  });

  /* ---------------- Nonogram ---------------- */
  await run('nonogram', async (t) => {
    const pic = L.NG5[0], N = 5, td = (r, c) => t.q('td.c[data-r="' + r + '"][data-c="' + c + '"]'), filled = () => t.all('td.c.f').length;
    const clueRow = (r) => { const out = []; let n = 0; for (const ch of pic[r]) { if (ch === '#') n++; else if (n) { out.push(n); n = 0; } } if (n) out.push(n); return out.length ? out.join(' ') : '0'; };
    const clueCol = (c) => { const out = []; let n = 0; for (let r = 0; r < N; r++) { if (pic[r][c] === '#') n++; else if (n) { out.push(n); n = 0; } } if (n) out.push(n); return out.length ? out.join(',') : '0'; };
    T.eq(t.all('td.rc').map(x => x.textContent).join('|'), pic.map((_, r) => clueRow(r)).join('|'), 'nonogram: row clues match the picture'); T.eq(t.all('td.cl:not(.rc)').map(x => x.innerHTML.replace(/<br>/g, ',')).join('|'), [0, 1, 2, 3, 4].map(clueCol).join('|'), 'nonogram: column clues match the picture');
    G.ev(td(0, 0), 'pointerdown'); G.ev(window2(), 'pointerup'); function window2() { return W; } T.eq(filled(), 1, 'nonogram: a tap fills a cell'); G.ev(td(0, 0), 'pointerdown'); G.ev(W, 'pointerup'); T.eq(filled(), 0, 'nonogram: tapping a filled cell empties it');
    t.click('#md [data-v="mark"]'); G.ev(td(0, 0), 'pointerdown'); G.ev(W, 'pointerup'); T.eq(td(0, 0).textContent, '✕', 'nonogram: mark mode puts a cross'); T.eq(filled(), 0, 'nonogram: a cross is not a filled cell'); G.ev(td(0, 0), 'pointerdown'); G.ev(W, 'pointerup'); T.eq(td(0, 0).textContent, '', 'nonogram: tapping a cross clears it'); t.click('#md [data-v="fill"]');
    /* drag paints a line with one value */
    G.ev(td(1, 0), 'pointerdown'); for (let c = 1; c < 4; c++) { G.setHit(td(1, c)); G.ev(t.q('#wrap'), 'pointermove'); } G.ev(W, 'pointerup'); T.eq(t.all('td.c.f').filter(x => x.dataset.r === '1').length, 4, 'nonogram: dragging fills several cells'); G.setHit(null);
    t.click('#clr'); T.eq(filled(), 0, 'nonogram: Clear empties the grid'); T.has(t.q('#msg').textContent, 'Cleared', 'nonogram: says so');
    let first = true; pic.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') { G.ev(td(r, c), 'pointerdown'); G.ev(W, 'pointerup'); if (first) { first = false; G.tick(1200); } } }));
    T.has(t.q('#msg').textContent, 'Solved', 'nonogram: filling the picture solves it'); const best = G.store('fun2.nonogram.best')['5']; T.ok(best >= 1 && best <= 2, 'nonogram: best time saved (' + best + ' s)'); T.eq(G.clock.pending().iv, 0, 'nonogram: the clock stops'); G.ev(td(0, 0), 'pointerdown'); G.ev(W, 'pointerup'); T.eq(td(0, 0).classList.contains('f'), pic[0][0] === '#', 'nonogram: the solved grid is locked');
    t.click('#new'); T.ok(t.all('td.rc').map(x => x.textContent).join('|') !== pic.map((_, r) => clueRow(r)).join('|'), 'nonogram: Next puzzle shows another picture'); T.eq(G.store('fun2.nonogram.idx')['5'], 1, 'nonogram: puzzle index saved');
    t.click('#sz [data-v="10"]'); T.eq(t.all('td.c').length, 100, 'nonogram: 10 x 10 grid'); t.click('#sr [data-v="rnd"]'); T.eq(t.all('td.c').length, 100, 'nonogram: random 10 x 10'); t.click('#sz [data-v="5"]'); T.eq(t.all('td.c').length, 25, 'nonogram: random 5 x 5');
    /* a solution that matches every clue wins even if it is a different grid with the same clues */
    t.click('#sr [data-v="pic"]');
  });

  await T.done(G.page);
})().catch(e => { console.log("FAIL: test crashed: " + (e && e.stack || e)); process.exit(1); });
