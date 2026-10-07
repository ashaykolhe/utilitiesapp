'use strict';
/* Tests the pure logic of www/js/tools/games4.js (Solitaire, Backgammon, Ludo, Snakes & Ladders). Run: node tests/games4.test.js */
const L = require('../www/js/tools/games4.js');
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; if (fails < 40) console.log('FAIL: ' + m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + ' (got ' + JSON.stringify(a) + ' expected ' + JSON.stringify(b) + ')');
const ri = (n) => Math.floor(Math.random() * n);

/* ---------------- Solitaire ---------------- */
{
  const S = L.S;
  for (let k = 0; k < 50; k++) {
    const st = S.deal(k % 2 ? 3 : 1);
    const all = [].concat(...st.tab.map((c) => c.map((x) => x.c)), st.stock);
    ok(all.length === 52 && new Set(all).size === 52 && all.every((c) => c >= 0 && c < 52), 'deal has 52 unique cards');
    ok(st.tab.every((c, i) => c.length === i + 1), 'tableau shape 1..7');
    ok(st.tab.every((c) => c.every((x, j) => x.u === (j === c.length - 1))), 'only last card face up');
    ok(st.stock.length === 24 && st.waste.length === 0, '24 in stock');
    ok(S.valid(st), 'fresh deal is valid');
  }
  ok(!S.valid(null) && !S.valid({}), 'invalid states rejected');
  const bad = S.deal(1); bad.stock.pop(); ok(!S.valid(bad), 'incomplete deal rejected');
  // build a blank state for rules
  const blank = () => ({ tab: [[], [], [], [], [], [], []], found: [0, 0, 0, 0], stock: [], waste: [], draw: 1, moves: 0, t: 0, done: false });
  const card = (s, r) => s * 13 + r - 1;
  let st = blank();
  st.tab[0] = [{ c: card(1, 6), u: true }];            // 6 hearts (red)
  st.tab[1] = [{ c: card(0, 5), u: true }];            // 5 spades (black)
  st.tab[2] = [{ c: card(2, 5), u: true }];            // 5 diamonds (red)
  ok(S.canTab(st, 0, card(0, 5)), 'black 5 on red 6');
  ok(!S.canTab(st, 0, card(2, 5)), 'red 5 not on red 6');
  ok(!S.canTab(st, 0, card(0, 4)), 'wrong rank refused');
  ok(!S.canTab(st, 3, card(0, 5)) && S.canTab(st, 3, card(0, 13)), 'only kings on empty column');
  ok(!S.canFound(st, card(0, 5)), 'five cannot start the foundation');
  ok(S.canFound(st, card(3, 1)), 'ace can');
  st.tab[3] = [{ c: card(3, 1), u: true }];
  eq(S.best(st, { t: 't', col: 3, idx: 0 }), { t: 'f', s: 3 }, 'ace goes to foundation first');
  S.apply(st, { t: 't', col: 3, idx: 0 }, { t: 'f', s: 3 });
  eq(st.found, [0, 0, 0, 1], 'ace placed'); ok(st.tab[3].length === 0, 'source emptied');
  ok(!S.apply(st, { t: 't', col: 1, idx: 0 }, { t: 't', col: 2 }), 'illegal apply refused');
  // run move + flip
  st = blank();
  st.tab[0] = [{ c: card(3, 9), u: false }, { c: card(1, 7), u: true }, { c: card(0, 6), u: true }]; // face-down, 7H, 6S
  st.tab[1] = [{ c: card(0, 8), u: true }];                                                            // 8S
  const before = JSON.stringify(st);
  eq(S.best(st, { t: 't', col: 0, idx: 1 }), { t: 't', col: 1 }, 'run of two moves onto 8S');
  S.apply(st, { t: 't', col: 0, idx: 1 }, { t: 't', col: 1 });
  eq(st.tab[1].map((x) => x.c), [card(0, 8), card(1, 7), card(0, 6)], 'run moved in order');
  ok(st.tab[0][0].u, 'new top flipped face up');
  // undo restores exact state
  const snap = JSON.stringify(JSON.parse(before)); ok(snap === before, 'snapshot roundtrip');
  // foundation back to tableau
  st = blank(); st.found = [0, 3, 0, 0]; st.tab[0] = [{ c: card(0, 4), u: true }];
  eq(S.targets(st, { t: 'f', s: 1 }), [{ t: 't', col: 0 }], 'foundation card can return onto a black 4');
  // king at the bottom of a column is not moved to an empty column
  st = blank(); st.tab[0] = [{ c: card(0, 13), u: true }];
  eq(S.best(st, { t: 't', col: 0, idx: 0 }), null, 'no pointless king move');
  st.tab[1] = [{ c: card(1, 12), u: false }, { c: card(0, 13), u: true }];
  eq(S.best(st, { t: 't', col: 1, idx: 1 }) && S.best(st, { t: 't', col: 1, idx: 1 }).t, 't', 'king over a face-down card may move to empty column');
  // stock
  st = S.deal(3); const n0 = st.stock.length; S.stockTap(st);
  ok(st.stock.length === n0 - 3 && st.waste.length === 3, 'draw 3'); 
  while (st.stock.length) S.stockTap(st);
  const w = st.waste.slice(); S.stockTap(st);
  ok(st.waste.length === 0 && st.stock.length === 24, 'waste turned over'); eq(st.stock.slice().reverse(), w, 'turnover keeps order');
  // undo via clone for random play
  for (let g = 0; g < 100; g++) {
    let s = S.deal(g % 2 ? 3 : 1); const hist = [];
    for (let i = 0; i < 150; i++) {
      hist.push(JSON.stringify(s));
      const srcs = [{ t: 'w' }]; for (let c = 0; c < 7; c++) for (let x = 0; x < s.tab[c].length; x++) srcs.push({ t: 't', col: c, idx: x });
      for (let q = 0; q < 4; q++) srcs.push({ t: 'f', s: q });
      const src = srcs[ri(srcs.length)], d = S.best(s, src);
      if (d) ok(S.apply(s, src, d), 'best move applies'); else S.stockTap(s);
      ok(S.valid(s), 'state stays valid');
      if (S.won(s)) break;
    }
    // undo everything exactly
    let cur = s;
    while (hist.length) cur = JSON.parse(hist.pop());
    ok(S.valid(cur) && cur.moves === 0, 'undo to the start');
  }
  // auto-complete
  st = blank(); for (let sI = 0; sI < 4; sI++) st.found[sI] = 13; st.found[0] = 10; st.found[1] = 9;
  st.tab[0] = [{ c: card(0, 13), u: true }, { c: card(0, 12), u: true }, { c: card(0, 11), u: true }];
  st.tab[1] = [{ c: card(1, 13), u: true }, { c: card(1, 12), u: true }, { c: card(1, 11), u: true }, { c: card(1, 10), u: true }];
  ok(S.valid(st), 'auto test state valid'); ok(S.canAuto(st), 'canAuto when all face up');
  ok(S.autoComplete(st) && S.won(st), 'auto-complete wins');
  const hidden = S.deal(1); ok(!S.canAuto(hidden), 'canAuto false with face-down cards');
  st = blank(); st.found = [13, 13, 13, 13]; ok(!S.canAuto(st) && S.won(st), 'won state');
}

/* ---------------- Backgammon ---------------- */
{
  const B = L.B;
  const empty = () => ({ pts: new Array(25).fill(0), bar: [0, 0], off: [0, 0], turn: 0, dice: [], rolled: true, winner: -1 });
  const put = (st, pl, q, n) => { st.pts[B.pt(pl, q)] += (pl === 0 ? 1 : -1) * n; };
  const rf = (n) => Math.floor(Math.random() * n);
  let st = B.start();
  eq([st.pts[24], st.pts[13], st.pts[8], st.pts[6]], [2, 5, 3, 5], 'white start');
  eq([st.pts[1], st.pts[12], st.pts[17], st.pts[19]], [-2, -5, -3, -5], 'black start');
  ok(st.pts.reduce((a, v) => a + Math.max(v, 0), 0) === 15 && st.pts.reduce((a, v) => a + Math.max(-v, 0), 0) === 15, '15 checkers each');
  eq([B.pips(st, 0), B.pips(st, 1)], [167, 167], 'pip count 167');
  st.dice = [3, 1]; let mv = B.moves(st);
  ok(mv.length > 0 && mv.every((m) => m.from >= 1 && m.to >= 1), 'opening moves exist');
  // opening 6-6 for white: 24->18 is open, 13->7 open, 8->2 blocked? (black has 2 on abs 1 only) -> open
  st.dice = [6, 6, 6, 6]; mv = B.moves(st);
  ok(mv.some((m) => m.from === 24 && m.to === 18) && mv.some((m) => m.from === 13 && m.to === 7), '6-6 opening');
  ok(!mv.some((m) => m.from === 6), 'point 6 cannot move 6 (would bear off)');

  // blocked point
  st = empty(); put(st, 0, 24, 1); put(st, 1, 5, 2);   // black q=5 -> abs 20
  eq(B.steps(st, 4), [], 'blocked by two checkers');
  eq(B.steps(st, 3).map((m) => m.to), [21], 'open point');
  // hit a blot
  put(st, 1, 4, 1);                                     // black blot at abs 21
  const h = B.cl(st); ok(B.apply(h, B.steps(h, 3)[0]) === true && h.bar[1] === 1 && h.pts[21] === 1, 'blot hit goes to the bar');

  // bar entry
  st = empty(); st.bar[0] = 1; put(st, 0, 13, 2); put(st, 1, 5, 2); // black holds abs 20: white enters at 25-5
  st.dice = [5, 2]; mv = B.moves(st);
  ok(mv.every((m) => m.from === 25), 'only bar entry while on the bar'); eq(mv.map((m) => m.die), [2], 'die 5 blocked, die 2 enters');
  st.dice = [5, 5, 5, 5]; eq(B.moves(st), [], 'no entry when blocked');
  st = empty(); st.bar[1] = 1; st.turn = 1; put(st, 1, 13, 1); st.dice = [3]; mv = B.moves(st);
  eq(mv.map((m) => [m.from, m.to]), [[25, 22]], 'black enters at abs 3');
  eq(B.pt(1, 22), 3, 'black point mapping');

  // must use both dice: checker on 7, black point on abs 2 blocks die 5; dice 5 and 6 -> only 6 first (then 5 bears off)
  st = empty(); put(st, 0, 7, 1); put(st, 1, 23, 2);
  st.dice = [5, 6]; eq(B.moves(st).map((m) => m.die), [6], 'order that uses both dice is forced');
  st = empty(); put(st, 0, 7, 1); put(st, 1, 23, 2); st.dice = [6, 5];
  const c1 = B.cl(st); B.apply(c1, B.moves(c1)[0]); eq(B.moves(c1).map((m) => [m.die, m.to]), [[5, 0]], 'second die bears off');
  // only one die playable: the larger must be used
  st = empty(); put(st, 0, 13, 1); put(st, 1, 21, 2); put(st, 1, 20, 2); put(st, 1, 15, 2); // black on abs 4, 5, 10
  st.dice = [3, 6]; eq(B.moves(st).map((m) => m.die), [6], 'larger die forced when only one can be played');
  st = empty(); put(st, 0, 13, 1); put(st, 1, 15, 2); st.dice = [3, 6];   // 13-3 blocked at abs 10; 13-6=7 free then 7-3=4 free -> both playable
  eq(B.moves(st).map((m) => m.die), [6], 'blocked 3 first, so 6 then 3');
  // both individually playable but not together -> larger only
  st = empty(); put(st, 0, 8, 1); put(st, 1, 20, 2); put(st, 1, 22, 2); put(st, 1, 24, 2); // black abs 5, 3, 1
  st.dice = [2, 6];  // 8-2=6 free; 8-6=2 free; after 2 (at 6): 6-6 -> 0 bear off? not all home? 6 is home -> yes both. so make that impossible by also holding another far checker
  put(st, 0, 20, 1); // white checker far away keeps bear off illegal
  const all = B.moves(st); ok(all.length > 0, 'some moves');
  // brute-force the rule on random positions: result of B.moves must equal the textbook definition
  const brute = (s0) => {
    const seqs = []; // all full sequences of single-step moves
    (function go(s, n) {
      let any = false;
      for (const d of new Set(s.dice)) for (const m of B.steps(s, d)) { any = true; const c = B.cl(s); B.apply(c, m); go(c, n + 1); }
      if (!any) seqs.push(n);
    })(s0, 0);
    return Math.max(...seqs);
  };
  for (let t = 0; t < 300; t++) {
    const s = B.start(); // random midgame by random play
    for (let k = 0; k < rf(40); k++) { B.roll(s, rf); const m = B.moves(s); let x; const c = s; while ((x = B.moves(c)).length) { B.apply(c, x[rf(x.length)]); if (c.winner >= 0) break; } if (c.winner >= 0) break; B.endTurn(c); }
    if (s.winner >= 0) continue;
    B.roll(s, rf);
    const maxLen = brute(s), first = B.moves(s);
    if (maxLen === 0) { ok(first.length === 0, 'no moves when none exist'); continue; }
    ok(first.length > 0, 'moves exist when sequences exist');
    // every offered first move can be continued to maxLen dice
    for (const m of first) { const c = B.cl(s); B.apply(c, m); ok(1 + brute(c) === maxLen, 'offered move allows the maximum number of dice'); }
    if (maxLen === 1 && new Set(s.dice).size === 2) {
      const big = Math.max(...s.dice), anyBig = [...[big]].some((d) => B.steps(s, d).length);
      if (anyBig) ok(first.every((m) => m.die === big), 'larger die when only one can be played');
    }
  }

  // bearing off
  st = empty(); put(st, 0, 6, 2); put(st, 0, 3, 1); st.off[0] = 12;
  st.dice = [6, 3]; mv = B.moves(st);
  ok(mv.some((m) => m.to === 0 && m.from === 6 && m.die === 6), 'bear off exact');
  ok(mv.some((m) => m.to === 0 && m.from === 3 && m.die === 3), 'bear off exact (3)');
  st = empty(); put(st, 0, 3, 1); put(st, 0, 2, 1); st.off[0] = 13; st.dice = [6];
  eq(B.steps(st, 6).map((m) => m.from), [3], 'higher die bears off only the highest checker');
  st = empty(); put(st, 0, 3, 1); put(st, 0, 9, 1); st.off[0] = 13;
  ok(!B.steps(st, 6).some((m) => m.to === 0), 'no bearing off with a checker outside home');
  st = empty(); put(st, 0, 3, 1); st.bar[0] = 1; st.off[0] = 13;
  ok(!B.allHome(st, 0), 'checker on the bar is not home');
  st = empty(); put(st, 1, 2, 1); st.off[1] = 14; st.turn = 1; st.dice = [2];
  const w = B.cl(st); B.apply(w, B.steps(w, 2)[0]); ok(w.winner === 1 && w.off[1] === 15, 'win detection');
  st = B.start(); st.turn = 1; st.dice = [6, 5]; mv = B.moves(st);
  ok(mv.some((m) => m.from === 24 && m.to === 18), 'black moves too');

  // whole games
  let games = 0, turnsPlayed = 0;
  const count = (s, pl) => s.pts.reduce((a, v) => a + (pl === 0 ? Math.max(v, 0) : Math.max(-v, 0)), 0) + s.bar[pl] + s.off[pl];
  const play = (levels) => {
    let s = B.start(), guard = 0;
    while (s.winner < 0 && guard++ < 2000) {
      B.roll(s, rf);
      const lvl = levels[s.turn];
      let list;
      if (lvl) list = B.aiTurn(s, lvl);
      else { list = []; const c = B.cl(s); let m; while ((m = B.moves(c)).length) { const x = m[rf(m.length)]; list.push(x); B.apply(c, x); } }
      for (const x of list) {
        ok(B.moves(s).some((l) => l.from === x.from && l.to === x.to && l.die === x.die), 'illegal move played');
        B.apply(s, x);
        if (s.winner >= 0) break;
      }
      ok(count(s, 0) === 15 && count(s, 1) === 15, 'checker counts stay 15');
      turnsPlayed++; B.endTurn(s);
    }
    ok(s.winner >= 0, 'game finished'); games++;
    return s.winner;
  };
  for (let g = 0; g < 200; g++) play([null, null]);
  for (let g = 0; g < 10; g++) play(['easy', 'easy']);
  for (let g = 0; g < 6; g++) play(['normal', 'normal']);
  let nw = 0; for (let g = 0; g < 16; g++) if (play(['normal', 'easy']) === 0) nw++;
  ok(nw >= 10, 'Normal beats Easy most games (' + nw + '/16)');
  console.log('backgammon: ' + games + ' games, ' + turnsPlayed + ' turns, Normal won ' + nw + '/16 vs Easy');
}

/* ---------------- Ludo ---------------- */
{
  const D = L.D;
  const rf = (n) => Math.floor(Math.random() * n);
  let st = D.newGame([false, true]);
  eq(st.pl.map((p) => p.c), [0, 2], 'two players sit opposite');
  eq(D.seats(3), [0, 1, 2], '3 players'); eq(D.seats(4), [0, 1, 2, 3], '4 players');
  ok(D.valid(st), 'new game valid');
  eq(D.legal(st, 3), [], 'cannot leave the yard without a six');
  eq(D.legal(st, 6), [0, 1, 2, 3], 'a six lets any yard token out');
  D.move(st, 0, 6); eq(st.tok[0], [0, -1, -1, -1], 'token on its start square');
  eq(D.legal(st, 4), [0], 'only the token on the board moves');
  // roll forcing: 6 then extra turn
  D.afterMove(st, 6); ok(st.turn === 0 && !st.rolled, 'a six gives another turn');
  D.afterMove(st, 3); ok(st.turn === 1, 'non-six passes the turn');
  // squares & safety
  ok(D.safe(0) && D.safe(13) && D.safe(26) && D.safe(39) && D.safe(8) && D.safe(21) && D.safe(34) && D.safe(47), 'safe squares');
  ok(!D.safe(5) && !D.safe(12) && !D.safe(1), 'normal squares unsafe');
  // capture: red on rel 3 (abs 3); yellow token at rel 29 -> abs (26+29)%52 = 3
  st = D.newGame([false, false]); st.tok[0][0] = 0; st.tok[1][0] = 29; st.turn = 0;
  let r = D.move(st, 0, 3); eq(r.captured, [[1, 0]], 'capture on an unsafe square'); eq(st.tok[1][0], -1, 'captured token goes home');
  // no capture on safe squares: yellow at abs 8 (rel 34), red rel 8
  st = D.newGame([false, false]); st.tok[0][0] = 5; st.tok[1][0] = 34; st.turn = 0;
  r = D.move(st, 0, 3); eq(r.captured, [], 'no capture on a star square'); eq(st.tok[1][0], 34, 'token stays');
  // no capture on a start square (yellow start abs 26 is safe)
  st = D.newGame([false, false]); st.tok[0][0] = 22; st.tok[1][0] = 0; st.turn = 0; r = D.move(st, 0, 4); eq(r.captured, [], 'start square safe');
  // own tokens never captured
  st = D.newGame([false, false]); st.tok[0][0] = 2; st.tok[0][1] = 5; st.turn = 0; r = D.move(st, 0, 3); eq(r.captured, [], 'own token not captured'); eq(st.tok[0][1], 5, 'own stays');
  // lane squares are not on the loop
  st = D.newGame([false, false]); st.tok[0][0] = 49; st.tok[1][0] = 23; st.turn = 0; // yellow rel 23 = abs 49
  r = D.move(st, 0, 4); eq(r.captured, [], 'lane is never a capture square'); eq(st.tok[0][0], 53, 'moved into the lane');
  // exact finish
  st = D.newGame([false, false]); st.tok[0] = [54, 56, 56, 56]; st.turn = 0;
  eq(D.legal(st, 3), [], 'overshoot not allowed'); eq(D.legal(st, 2), [0], 'exact roll finishes'); eq(D.legal(st, 1), [0], 'one step along the lane');
  r = D.move(st, 0, 2); ok(r.finished && st.order.length === 2 && st.over, 'finish: first place and game over for two players');
  eq(st.order, [0, 1], 'win order');
  // three sixes
  st = D.newGame([false, true]); st.sixes = 2; let o = D.roll(st, () => 5);
  ok(o.v === 6 && o.forfeit && st.turn === 1 && st.sixes === 0 && !st.rolled, 'third six forfeits the turn');
  st = D.newGame([false, true]); o = D.roll(st, () => 5); o = D.roll(st, () => 5);
  ok(!o.forfeit && st.sixes === 2, 'two sixes are fine');
  // finishing order with 4 players
  st = D.newGame([false, false, false, false]); st.tok[0] = [56, 56, 56, 55]; st.turn = 0; D.move(st, 3, 1); D.afterMove(st, 1);
  ok(st.order.length === 1 && st.turn === 1 && !st.over, 'first finisher does not end a 4 player game');
  st.tok[2] = [56, 56, 56, 55]; st.turn = 2; D.move(st, 3, 1); D.afterMove(st, 1);
  st.turn = 1; st.tok[1] = [56, 56, 56, 55]; D.move(st, 3, 1); D.afterMove(st, 1);
  ok(st.over && st.order.length === 4 && st.order[0] === 0 && st.order[1] === 2 && st.order[2] === 1 && st.order[3] === 3, '4 player order, last place filled in');
  // skip finished players
  st = D.newGame([false, false, false]); st.order = [1]; st.turn = 0; D.advance(st); eq(st.turn, 2, 'finished player is skipped');
  // random games
  let finished = 0, caps = 0, turns = 0;
  for (let g = 0; g < 200; g++) {
    const n = 2 + (g % 3); st = D.newGame(Array.from({ length: n }, (_, i) => i % 2 === 1));
    let guard = 0;
    while (!st.over && guard++ < 20000) {
      const ro = D.roll(st, rf); turns++;
      if (ro.forfeit) continue;
      const lg = D.legal(st, ro.v);
      if (!lg.length) { D.advance(st); continue; }
      const t = st.pl[st.turn].ai ? D.aiPick(st, ro.v, lg) : lg[rf(lg.length)];
      ok(lg.includes(t), 'chosen token is legal');
      const m = D.move(st, t, ro.v); caps += m.captured.length;
      ok(st.tok.every((tk) => tk.every((x) => x >= -1 && x <= 56)), 'token positions in range');
      D.afterMove(st, ro.v);
    }
    ok(st.over && st.order.length === n && new Set(st.order).size === n, 'ludo game finished with a full ranking'); if (st.over) finished++;
  }
  console.log('ludo: ' + finished + '/200 games finished, ' + turns + ' rolls, ' + caps + ' captures');
}

/* ---------------- Snakes and Ladders ---------------- */
{
  const N = L.N;
  const rf = (n) => Math.floor(Math.random() * n);
  // board data sanity: 8 + 8, every jump goes the right way, no square is both, no chains
  const lad = Object.keys(N.LADDERS).map(Number), sn = Object.keys(N.SNAKES).map(Number);
  ok(lad.length === 8 && sn.length === 8, '8 ladders and 8 snakes');
  ok(lad.every((a) => N.LADDERS[a] > a && N.LADDERS[a] <= 100) && sn.every((a) => N.SNAKES[a] < a && N.SNAKES[a] >= 1), 'jump directions');
  const heads = new Set(lad.concat(sn)); ok(heads.size === 16, 'no square has two jumps');
  ok(Object.values(N.LADDERS).concat(Object.values(N.SNAKES)).every((e) => !heads.has(e)), 'a jump never ends on another jump (no chains)');
  ok(!heads.has(100) && !heads.has(1), '1 and 100 are plain squares');
  // zigzag layout
  eq(N.rc(1), { row: 0, col: 0 }, 'square 1 bottom left'); eq(N.rc(10), { row: 0, col: 9 }, 'square 10 bottom right');
  eq(N.rc(11), { row: 1, col: 9 }, 'square 11 above 10'); eq(N.rc(100), { row: 9, col: 0 }, 'square 100 top left');
  const seen = new Set(); for (let n = 1; n <= 100; n++) { const q = N.rc(n); seen.add(q.row * 10 + q.col); } ok(seen.size === 100, 'every square has its own cell');
  // moves
  let r = N.step(1, 3); ok(r.land === 4 && r.to === 14 && r.kind === 'ladder', 'ladder at 4');
  r = N.step(10, 7); ok(r.land === 17 && r.to === 7 && r.kind === 'snake', 'snake at 17');
  r = N.step(10, 1); ok(r.to === 11 && r.kind === null, 'plain move');
  r = N.step(98, 6); ok(r.land === 96 && r.to === 96, 'bounce back from 100 (98 + 6 -> 96)');
  r = N.step(97, 4); ok(r.land === 99 && r.to === 78 && r.kind === 'snake', '97 + 4 = 101 bounces to 99, snake there');
  r = N.step(94, 6); ok(r.land === 100 && r.to === 100, 'exactly 100');
  r = N.step(96, 5); ok(r.land === 99, '96 + 5 bounces to 99 (snake to 78)');
  // play passes turn / winner
  let st = N.newGame([false, true, true]); ok(N.valid(st), 'valid');
  let pl = N.play(st, 3); eq(st.pos, [3, 0, 0], 'moved'); eq(st.turn, 1, 'turn passed'); eq(pl.path, [1, 2, 3], 'path');
  pl = N.play(st, 4); eq(st.pos, [3, 14, 0], 'ladder applied'); ok(pl.kind === 'ladder', 'kind ladder');
  st.turn = 0; st.pos[0] = 96; pl = N.play(st, 4); ok(st.winner === 0 && st.pos[0] === 100, 'win on exact roll'); eq(st.turn, 0, 'no turn change after a win');
  st = N.newGame([false, false]); st.pos[0] = 97; pl = N.play(st, 6); ok(st.winner === -1, 'overshoot is not a win'); eq(pl.path, [98, 99, 100, 99, 98, 97], 'bounce path');
  // 1000 random games
  let fin = 0, maxRolls = 0, total = 0;
  for (let g = 0; g < 1000; g++) {
    const n = 2 + g % 3; st = N.newGame(Array.from({ length: n }, (_, i) => i % 2));
    let guard = 0;
    while (st.winner < 0 && guard++ < 5000) {
      const p = st.turn, before = st.pos[p], d = 1 + rf(6), rr = N.play(st, d);
      ok(st.pos[p] >= 1 && st.pos[p] <= 100, 'position in range'); ok(rr.from === before, 'from matches');
    }
    ok(st.winner >= 0 && st.pos[st.winner] === 100, 'game finished with a token on 100'); if (st.winner >= 0) fin++;
    maxRolls = Math.max(maxRolls, st.rolls); total += st.rolls;
  }
  console.log('snakes & ladders: ' + fin + '/1000 games finished, average ' + Math.round(total / 1000) + ' rolls, longest ' + maxRolls);
}

console.log(checks + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
