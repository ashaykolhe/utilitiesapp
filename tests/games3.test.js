'use strict';
/* Tests for the pure engines in www/js/tools/games3.js (Chess and Checkers). Run: node tests/games3.test.js */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'www', 'js', 'tools', 'games3.js'), 'utf8');
function extract(a, b, ctor) {
  const i = src.indexOf('/* ' + a + ' */'), j = src.indexOf('/* ' + b + ' */');
  if (i < 0 || j < 0) throw new Error('markers ' + a + '/' + b + ' not found');
  return new Function(src.slice(i, j) + '\nreturn ' + ctor + '();')();
}
let fails = 0, checks = 0;
function eq(a, b, msg) { checks++; if (JSON.stringify(a) !== JSON.stringify(b)) { fails++; console.log('FAIL ' + msg + ': got ' + JSON.stringify(a) + ' expected ' + JSON.stringify(b)); } }
function ok(c, msg) { checks++; if (!c) { fails++; console.log('FAIL ' + msg); } }

/* ===================== CHESS ===================== */
const E = extract('ENGINE-START', 'ENGINE-END', 'chessEngine');
const report = [];
function perfts(name, fen, expect) {
  const p = E.fromFEN(fen), got = [];
  for (let d = 1; d <= expect.length; d++) got.push(E.perft(p, d));
  eq(got, expect, 'perft ' + name); eq(E.toFEN(p), E.toFEN(E.fromFEN(fen)), 'perft restores position ' + name);
  report.push('perft ' + name + ': ' + got.join(', '));
}
perfts('start', E.START, [20, 400, 8902, 197281]);
perfts('kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -', [48, 2039, 97862]);
perfts('pos3', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - -', [14, 191, 2812, 43238]);
perfts('pos4', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]);
perfts('pos5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]);

eq(E.toFEN(E.fromFEN(E.START)), E.START, 'FEN round trip');

/* checkmate / stalemate / draws */
eq(E.status(E.fromFEN('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3')), 'checkmate', 'fools mate');
eq(E.status(E.fromFEN('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')), 'stalemate', 'stalemate');
eq(E.status(E.fromFEN('8/8/8/4k3/8/8/8/4K3 w - - 0 1')), 'insufficient', 'K v K');
eq(E.status(E.fromFEN('8/8/8/4k3/8/8/3B4/4K3 w - - 0 1')), 'insufficient', 'K+B v K');
eq(E.status(E.fromFEN('8/8/8/4k3/8/8/3N4/4K3 w - - 0 1')), 'insufficient', 'K+N v K');
eq(E.status(E.fromFEN('8/8/8/4kb2/8/8/3B4/4K3 w - - 0 1')), 'playing', 'K+B v K+B opposite colour is not drawn by material');
eq(E.status(E.fromFEN('8/8/8/4k1b1/8/8/3B4/4K3 w - - 0 1')), 'insufficient', 'same colour bishops');
eq(E.status(E.fromFEN('8/8/8/4k3/8/8/3NN3/4K3 w - - 0 1')), 'playing', 'two knights can still mate');
eq(E.status(E.fromFEN('8/8/8/4k3/8/8/3P4/4K3 w - - 0 1')), 'playing', 'pawn is enough');
eq(E.status(E.fromFEN('8/8/8/4k3/8/8/3R4/4K3 w - - 100 80')), 'fifty', 'fifty-move rule');
eq(E.status(E.fromFEN('8/8/8/4k3/8/8/3R4/4K3 w - - 99 80')), 'playing', 'not yet fifty');
(function () { /* threefold by shuffling knights */
  const p = E.fromFEN(E.START), keys = [E.posKey(p)];
  const mv = (s) => { const m = E.legalMoves(p).find((x) => E.moveStr(x) === s); ok(!!m, 'move ' + s); E.make(p, m); keys.push(E.posKey(p)); };
  for (let i = 0; i < 2; i++) { mv('g1f3'); mv('g8f6'); mv('f3g1'); mv('f6g8'); if (i === 0) eq(E.status(p, keys), 'playing', 'twice is not yet a draw'); }
  eq(E.status(p, keys), 'threefold', 'threefold repetition');
})();

/* castling conditions */
function movesOf(fen) { const p = E.fromFEN(fen); return E.legalMoves(p).map(E.moveStr); }
ok(movesOf('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1').includes('e1g1') && movesOf('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1').includes('e1c1'), 'castle both sides');
ok(!movesOf('r3k2r/8/8/8/8/8/8/R3K2R w Qkq - 0 1').includes('e1g1'), 'no right, no castle');
ok(!movesOf('r3k2r/8/8/8/8/8/8/R3KN1R w KQkq - 0 1').includes('e1g1'), 'blocked');
ok(!movesOf('r3k2r/8/8/8/8/5r2/8/R3K2R w KQkq - 0 1').includes('e1g1'), 'cannot castle through attacked square');
ok(movesOf('r3k2r/8/8/8/8/6r1/8/R3K2R w KQkq - 0 1').includes('e1c1'), 'queen side ok when only g1 attacked');
ok(!movesOf('r3k2r/8/8/8/8/4r3/8/R3K2R w KQkq - 0 1').includes('e1g1'), 'cannot castle out of check');
ok(movesOf('r3k2r/8/8/8/8/1r6/8/R3K2R w KQkq - 0 1').includes('e1c1'), 'b1 attacked does not stop queen-side castling');
ok(movesOf('r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1').includes('e8c8') && movesOf('r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1').includes('e8g8'), 'black castles');
(function () {
  const p = E.fromFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  E.make(p, E.legalMoves(p).find((m) => E.moveStr(m) === 'e1g1'));
  eq(E.toFEN(p).split(' ')[0], 'r3k2r/8/8/8/8/8/8/R4RK1', 'rook moved when castling');
  eq(E.toFEN(p).split(' ')[2], 'kq', 'rights gone after castling');
  const q = E.fromFEN('r3k2r/8/8/8/8/8/6b1/R3K2R b KQkq - 0 1');
  E.make(q, E.legalMoves(q).find((m) => E.moveStr(m) === 'g2h1'));
  eq(E.toFEN(q).split(' ')[2], 'Qkq', 'capturing the h1 rook removes K');
})();
/* en passant and promotion */
(function () {
  const p = E.fromFEN(E.START);
  const mv = (s) => { const m = E.legalMoves(p).find((x) => E.moveStr(x) === s); ok(!!m, 'move ' + s); E.make(p, m); };
  mv('e2e4'); mv('a7a6'); mv('e4e5'); mv('d7d5');
  ok(E.legalMoves(p).map(E.moveStr).includes('e5d6'), 'en passant offered');
  mv('e5d6'); eq(E.toFEN(p).split(' ')[0], 'rnbqkbnr/1pp1pppp/p2P4/8/8/8/PPPP1PPP/RNBQKBNR', 'en passant removes the pawn');
  const q = E.fromFEN('4k3/8/8/8/3pP3/8/8/4K3 b - e3 0 1');
  ok(E.legalMoves(q).map(E.moveStr).includes('d4e3'), 'black en passant');
  const q2 = E.fromFEN('4k3/8/8/8/3pP3/8/8/4K3 b - - 0 1');
  ok(!E.legalMoves(q2).map(E.moveStr).includes('d4e3'), 'no en passant without the right');
  const pr = movesOf('4k3/P7/8/8/8/8/8/4K3 w - - 0 1').filter((s) => s.startsWith('a7a8'));
  eq(pr.sort(), ['a7a8b', 'a7a8n', 'a7a8q', 'a7a8r'], 'four promotions');
  ok(!movesOf('8/8/8/KPp4r/8/8/8/7k w - c6 0 1').includes('b5c6'), 'en passant pinned along rank is illegal');
})();
/* SAN */
(function () {
  const p = E.fromFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  const find = (s) => E.legalMoves(p).find((x) => E.moveStr(x) === s);
  eq(E.san(p, find('e1g1')), 'O-O', 'san castle'); eq(E.san(p, find('a1a8')), 'Rxa8+', 'san capture check');
  const q = E.fromFEN('4k3/8/8/8/8/8/4K3/R6R w - - 0 1');
  eq(E.san(q, E.legalMoves(q).find((x) => E.moveStr(x) === 'a1d1')), 'Rad1', 'san disambiguation');
  const s = E.fromFEN(E.START); eq(E.san(s, E.legalMoves(s).find((x) => E.moveStr(x) === 'g1f3')), 'Nf3', 'san knight');
})();

/* AI: mate in one */
const mates = [
  ['6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', 'a1a8'],
  ['k7/8/1K6/8/8/8/8/7R w - - 0 1', 'h1h8'],
  ['r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 1', 'f3f7'],
  ['rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 1', 'd8h4'],
  ['7k/8/5K2/8/8/8/8/6Q1 w - - 0 1', 'g1g7']
];
for (const [fen, mv] of mates) for (const d of [2, 3, 4]) eq(E.moveStr(E.search(E.fromFEN(fen), d)), mv, 'mate in 1 depth ' + d + ' ' + fen);
eq(E.moveStr(E.search(E.fromFEN('4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1'), 3)), 'd1d5', 'wins the queen');

/* AI never illegal over 100 random positions, and timings */
(function () {
  const t = {}; let n = 0;
  for (let g = 0; g < 30 && n < 100; g++) {
    const p = E.fromFEN(E.START);
    for (let ply = 0; ply < 40 && n < 100; ply++) {
      const ms = E.legalMoves(p);
      if (!ms.length || E.status(p) !== 'playing') break;
      if (ply >= 6) {
        const depth = 2 + (n % 3), t0 = Date.now();
        const m = E.search(p, depth, { noise: depth === 2 ? 80 : 0 });
        t[depth] = (t[depth] || []).concat(Date.now() - t0); n++;
        ok(ms.includes(m), 'AI move is legal (' + E.toFEN(p) + ')');
      }
      E.make(p, ms[Math.floor(Math.random() * ms.length)]);
    }
  }
  ok(n >= 100, 'ran ' + n + ' positions');
  for (const d of [2, 3, 4]) { const a = t[d] || [0]; report.push('AI depth ' + d + ': avg ' + Math.round(a.reduce((x, y) => x + y, 0) / a.length) + ' ms, max ' + Math.max(...a) + ' ms over ' + a.length + ' random positions'); }
})();
console.log(report.join('\n'));

/* ===================== CHECKERS ===================== */
const C = extract('CHECKERS-START', 'CHECKERS-END', 'checkersEngine');
(function () {
  const strs = (p) => C.moves(p).map(C.moveStr).sort();
  const s0 = C.start();
  eq(C.moves(s0).length, 7, 'checkers: 7 moves from the start');
  eq(C.moves(Object.assign({}, s0, { turn: 1 })).length, 7, 'checkers: 7 moves for the second player too');
  eq(s0.b.filter((v) => v === 1).length + s0.b.filter((v) => v === 3).length, 24, '24 pieces');
  /* forced capture: only the jump is legal although other moves exist */
  let p = C.fromRows(['........', '........', '........', '........', '...b....', '..r.....', '........', 'r.......'], 0);
  eq(strs(p), ['c3xe5'], 'checkers: forced capture hides simple moves');
  /* multi-jump chain */
  p = C.fromRows(['........', '........', '........', '........', '...b....', '........', '.b......', 'r.......'], 0);
  eq(strs(p), ['a1xc3xe5'], 'checkers: multi-jump chain');
  const q = C.apply(p, C.moves(p)[0]);
  eq(q.b.filter((v) => v === 3).length, 0, 'both jumped men are removed'); eq(q.turn, 1, 'turn passes');
  /* men do not capture backwards, kings do */
  p = C.fromRows(['........', '........', '........', '........', '...r....', '..b.....', '........', '........'], 0);
  eq(strs(p), ['d4-c5', 'd4-e5'].sort(), 'checkers: a man cannot jump backwards');
  p = C.fromRows(['........', '........', '........', '........', '...R....', '..b.....', '........', '........'], 0);
  eq(strs(p), ['d4xb2'], 'checkers: a king jumps backwards');
  /* king movement */
  p = C.fromRows(['b.......', '........', '........', '........', '...R....', '........', '........', '.......r'], 0);
  eq(strs(p).filter((s) => s.startsWith('d4')).length, 4, 'checkers: king moves in 4 directions');
  /* promotion ends a jump: a man reaching the far row stops there even if a king could go on */
  p = { b: new Array(64).fill(0), turn: 0, quiet: 0 };
  p.b[5 * 8 + 1] = 1; p.b[6 * 8 + 2] = 3; p.b[6 * 8 + 4] = 3; p.b[0] = 3;
  const jm = C.moves(p).filter((m) => m.caps.length);
  eq(jm.map(C.moveStr), ['b6xd8'], 'checkers: a man reaching the king row stops jumping');
  eq(C.apply(p, jm[0]).b[7 * 8 + 3], 2, 'it becomes a king');
  /* game end */
  p = C.fromRows(['........', '........', '........', '........', '........', '........', '........', 'r.......'], 1);
  eq(C.status(p), 'red', 'black has no pieces: red wins');
  p = { b: new Array(64).fill(0), turn: 1, quiet: 0 }; p.b[56] = 3; p.b[49] = 1; p.b[42] = 1;     /* black man a8... blocked by b7 backed by c6 */
  eq(C.status(p), 'red', 'black blocked: red wins');
  eq(C.status(Object.assign(C.start(), { quiet: 80 })), 'draw', 'draw after 80 quiet half-moves');
  eq(C.status(C.start()), 'playing', 'start is playing');
  /* the AI finds a winning double jump and never plays illegally */
  const t = {}; let games = 0, illegal = 0, plies = 0;
  for (let g = 0; g < 60; g++) {
    let pos = C.start();
    for (let ply = 0; ply < 160 && C.status(pos) === 'playing'; ply++) {
      const ms = C.moves(pos), key = ms.map(C.moveStr);
      let m;
      if (ply % 2 === g % 2) m = ms[Math.floor(Math.random() * ms.length)];
      else {
        const depth = [2, 4, 6][(g + (ply >> 1)) % 3], t0 = Date.now();
        m = C.search(pos, depth, { noise: depth === 2 ? 40 : 0 });
        (t[depth] = t[depth] || []).push(Date.now() - t0); plies++;
        if (!m || !key.includes(C.moveStr(m))) illegal++;
      }
      pos = C.apply(pos, m);
    }
    games++;
  }
  eq(illegal, 0, 'checkers AI never illegal over ' + games + ' games / ' + plies + ' AI moves');
  for (const d of [2, 4, 6]) { const a = t[d] || [0]; report.push('checkers AI depth ' + d + ': avg ' + Math.round(a.reduce((x, y) => x + y, 0) / a.length) + ' ms, max ' + Math.max(...a) + ' ms over ' + a.length + ' moves'); }
  /* AI vs AI: the deeper level should beat the shallow one most of the time */
  let hard = 0, easy = 0, draws = 0;
  for (let g = 0; g < 6; g++) {
    let pos = C.start();
    const hardSide = g % 2;
    for (let ply = 0; ply < 200 && C.status(pos) === 'playing'; ply++) pos = C.apply(pos, C.search(pos, pos.turn === hardSide ? 6 : 2, { noise: pos.turn === hardSide ? 0 : 40 }));
    const s = C.status(pos);
    if (s === 'draw' || s === 'playing') draws++; else if ((s === 'red' ? 0 : 1) === hardSide) hard++; else easy++;
  }
  report.push('checkers depth 6 vs depth 2 (6 games): deeper wins ' + hard + ', shallower wins ' + easy + ', draws ' + draws);
  ok(hard > easy, 'deeper search beats the shallow one');
})();
console.log(report.join('\n'));

console.log(checks + ' checks, ' + fails + ' failed');
process.exit(fails ? 1 : 0);
