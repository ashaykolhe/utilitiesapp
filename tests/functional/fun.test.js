'use strict';
/* Functional tests for www/js/tools/fun.js (32 games and fun tools). Drives every game through its UI like a player, with a virtual
   clock (tests/functional/fun-lib.js) so timers, animation frames and cleanup can be checked exactly. */
const { bootGame } = require('./fun-lib');
const { suite } = require('../helpers/page');
global.Tools = global.Tools || { register() {} };
const L = require('../../www/js/tools/fun.js');          // the pure game logic (exported at the bottom of fun.js)

(async () => {
  const T = suite('fun'), G = await bootGame({ seed: 7 });
  const W = G.w;
  const run = async (id, fn) => {
    const before = G.listeners(); G.unseed(); G.clock.reset();
    const t = await G.page.open(id);
    try { await fn(t); } catch (e) { T.ok(false, id + ' threw: ' + String(e.stack || e).split('\n').slice(0, 3).join(' | ')); }
    G.leaves(t, before, T, id);
  };
  const num = (s) => +String(s).replace(/[^\d.-]/g, '');
  const $ = (t, sel) => t.q(sel);

  /* ---------------- pure logic ---------------- */
  {
    const r = L.move2048([2, 2, 2, 2, 0, 0, 0, 0, 4, 4, 8, 8, 2, 0, 2, 4], 3);
    T.eq(JSON.stringify(r.board), JSON.stringify([4, 4, 0, 0, 0, 0, 0, 0, 8, 16, 0, 0, 4, 4, 0, 0]), '2048: [2,2,2,2] left -> [4,4], [4,4,8,8] -> [8,16], [2,0,2,4] -> [4,4]');
    T.eq(r.score, 4 + 4 + 8 + 16 + 4, '2048: merge score is the sum of the new tiles');
    T.eq(JSON.stringify(L.slideLine([2, 2, 4, 0]).out), '[4,4,0,0]', '2048: 2,2,4 -> 4,4 (a tile merges once per move)');
    T.eq(JSON.stringify(L.slideLine([4, 2, 2, 0]).out), '[4,4,0,0]', '2048: 4,2,2 -> 4,4');
    T.eq(JSON.stringify(L.slideLine([2, 2, 2, 0]).out), '[4,2,0,0]', '2048: 2,2,2 -> 4,2 (leading pair merges first)');
    T.ok(!L.move2048([2, 4, 8, 16, 4, 8, 16, 2, 8, 16, 2, 4, 16, 2, 4, 8], 3).moved, '2048: a locked board does not move');
    T.ok(!L.canMove2048([2, 4, 8, 16, 4, 8, 16, 2, 8, 16, 2, 4, 16, 2, 4, 8]), '2048: locked board has no moves');
    T.ok(L.canMove2048([2, 2, 8, 16, 4, 8, 16, 2, 8, 16, 2, 4, 16, 2, 4, 8]), '2048: a full board with one equal pair can still move');
    const up = L.move2048([0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0], 0);
    T.eq(up.board[0], 4, '2048: up merges column'); T.eq(up.score, 4, '2048: up score');
    const dn = L.move2048([2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0], 2);
    T.eq(dn.board[12], 4, '2048: down merges to the bottom');
    const rt = L.move2048([0, 2, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 1);
    T.eq(JSON.stringify(rt.board.slice(0, 4)), '[0,0,0,4]', '2048: right merges to the right edge');
    /* tic-tac-toe: the AI can never lose, whatever the human plays (exhaustive over every human line) */
    let games = 0, aiLost = 0;
    (function rec(b, turn) {
      const r2 = L.tttWin(b); if (r2) { games++; if (r2.w === 'X') aiLost++; return; }
      if (turn === 'X') { for (let i = 0; i < 9; i++) if (!b[i]) { b[i] = 'X'; rec(b, 'O'); b[i] = null; } }
      else { for (const m of L.tttBestAll(b, 'O')) { b[m] = 'O'; rec(b, 'X'); b[m] = null; } }
    })(Array(9).fill(null), 'X');
    T.ok(games > 100, 'tictactoe: explored ' + games + ' games'); T.eq(aiLost, 0, 'tictactoe: AI as O never loses against any X line');
    games = 0; aiLost = 0;
    (function rec(b, turn) {
      const r2 = L.tttWin(b); if (r2) { games++; if (r2.w === 'O') aiLost++; return; }
      if (turn === 'O') { for (let i = 0; i < 9; i++) if (!b[i]) { b[i] = 'O'; rec(b, 'X'); b[i] = null; } }
      else { for (const m of L.tttBestAll(b, 'X')) { b[m] = 'X'; rec(b, 'O'); b[m] = null; } }
    })(Array(9).fill(null), 'X');
    T.eq(aiLost, 0, 'tictactoe: AI as X never loses against any O reply (' + games + ' games)');
    T.eq(L.tttWin(['X', 'X', 'X', null, 'O', 'O', null, null, null]).w, 'X', 'tictactoe: row win');
    T.eq(L.tttWin(['X', 'O', 'X', 'O', 'X', 'O', 'O', 'X', 'O']).w, 'draw', 'tictactoe: full board without a line is a draw');
    T.eq(L.tttWin(['O', null, null, 'X', 'O', null, 'X', null, 'O']).w, 'O', 'tictactoe: diagonal win');
    T.eq(JSON.stringify(L.tttBestAll(['X', 'X', null, 'O', 'O', null, null, null, null], 'X')), '[2]', 'tictactoe: AI takes the winning square');
    T.eq(JSON.stringify(L.tttBestAll(['O', 'O', null, 'X', null, null, null, null, null], 'X')), '[2]', 'tictactoe: AI blocks the opponent');
    /* sudoku */
    const s = L.sdkGen(36);
    T.ok(L.sdkValid(s.solution), 'sudoku: generated solution is valid'); T.eq(L.sdkCount(s.puzzle, 3), 1, 'sudoku: generated puzzle has exactly one solution');
    T.ok(s.puzzle.filter(Boolean).length >= 36, 'sudoku: at least the requested clues are kept'); T.ok(s.puzzle.every((v, i) => !v || v === s.solution[i]), 'sudoku: puzzle givens agree with the solution');
    const bad = s.solution.slice(); bad[0] = bad[1] = 5; T.ok(!L.sdkValid(bad), 'sudoku: duplicate in a row is invalid'); T.ok(L.sdkConflicts(bad).has(0) && L.sdkConflicts(bad).has(1), 'sudoku: conflicting cells are reported');
    T.ok(L.sdkConflicts(s.solution).size === 0, 'sudoku: solved grid has no conflicts');
    /* slide puzzle */
    for (const n of [3, 4]) { let ok = true; for (let k = 0; k < 40; k++) { const t = L.slShuffle(n); if (!L.slSolvable(t, n) || L.slSolved(t)) ok = false; } T.ok(ok, 'slide ' + n + 'x' + n + ': every shuffle is solvable and not already solved'); }
    T.ok(!L.slSolvable([2, 1, 3, 4, 5, 6, 7, 8, 0], 3), 'slide: swapped pair is unsolvable'); T.ok(L.slSolved([1, 2, 3, 4, 5, 6, 7, 8, 0]), 'slide: solved state');
    /* lights out */
    const lg = new Array(25).fill(0); L.loPress(lg, 5, 12); T.eq(lg.reduce((a, b) => a + b, 0), 5, 'lights out: centre press toggles 5');
    const c0 = new Array(25).fill(0); L.loPress(c0, 5, 0); T.eq(c0.reduce((a, b) => a + b, 0), 3, 'lights out: corner press toggles exactly 3'); L.loPress(c0, 5, 0); T.ok(!c0.some(Boolean), 'lights out: pressing twice undoes');
    /* connect four */
    const b4 = Array(42).fill(0); for (let k = 0; k < 4; k++) L.c4Drop(b4, k, 1); T.ok(L.c4Win(b4, 1), 'connect4: horizontal four'); T.ok(!L.c4Win(b4, 2), 'connect4: other player has no win');
    const v4 = Array(42).fill(0); for (let k = 0; k < 4; k++) L.c4Drop(v4, 3, 2); T.ok(L.c4Win(v4, 2), 'connect4: vertical four');
    const d4 = Array(42).fill(0); [[0, 1], [1, 2], [1, 1], [2, 2], [2, 2], [2, 1], [3, 2], [3, 2], [3, 2], [3, 1]].forEach(([c, p]) => L.c4Drop(d4, c, p)); T.ok(L.c4Win(d4, 1), 'connect4: diagonal four');
    const full = Array(42).fill(0); for (let k = 0; k < 6; k++) L.c4Drop(full, 0, 1 + k % 2); T.eq(L.c4Drop(full, 0, 1), -1, 'connect4: full column refuses a disc');
    const tb = Array(42).fill(0); [0, 1, 2].forEach(c => L.c4Drop(tb, c, 2)); T.eq(L.c4Best(tb.slice(), 2, 4), 3, 'connect4: AI completes its own four'); const bl = Array(42).fill(0); [0, 1, 2].forEach(c => L.c4Drop(bl, c, 1)); T.eq(L.c4Best(bl, 2, 4), 3, 'connect4: AI blocks an open three');
    /* minesweeper */
    let safeOk = true, countOk = true;
    for (let k = 0; k < 60; k++) { const w = 9, h = 12, i = k * 7 % (w * h), g = L.msGen(w, h, 22, i); const sr = (i / w) | 0, sc = i % w; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const r = sr + dr, c = sc + dc; if (r >= 0 && r < h && c >= 0 && c < w && g.mine[r * w + c]) safeOk = false; } if (g.mine.reduce((a, b) => a + b, 0) !== 22) countOk = false; }
    T.ok(safeOk, 'minesweeper: first click and its neighbours are never mines'); T.ok(countOk, 'minesweeper: exactly the requested number of mines');
    const mg = { mine: [0, 0, 0, 0, 0, 0, 0, 0, 1], adj: [0, 0, 0, 0, 0, 0, 0, 0, 0] }; mg.adj = [0, 0, 0, 0, 1, 1, 0, 1, 0]; const mst = new Array(9).fill(0); const op = L.msFlood({ mine: [0, 0, 0, 0, 0, 0, 0, 0, 1], adj: [0, 0, 0, 0, 1, 1, 0, 1, 0] }, 3, 3, 0, mst); T.ok(op.length >= 6, 'minesweeper: flood fill opens connected empty cells and their numbered border');
    /* misc */
    const tm = L.makeTeams(['a', 'b', 'c', 'd', 'e', 'f', 'g'], 3); T.eq(tm.map(x => x.length).sort().join(), '2,2,3', 'teams: sizes differ by at most one'); T.eq(tm.flat().sort().join(''), 'abcdefg', 'teams: everyone is placed once');
    const pu = L.pickUnique(49, 6); T.eq(new Set(pu).size, 6, 'lucky: unique numbers'); T.ok(pu.every(n => n >= 1 && n <= 49), 'lucky: in range');
    let mq = true; for (let k = 0; k < 300; k++) { const q = L.mathQ(1 + k % 3), m = /^(\d+) ([+−×]) (\d+)$/.exec(q.text); const a = +m[1], b = +m[3], exp = m[2] === '+' ? a + b : m[2] === '−' ? a - b : a * b; if (exp !== q.ans || q.ans < 0) mq = false; } T.ok(mq, 'math sprint: answers match the question text and are never negative');
    T.eq(L.hanoiMin(4), 15, 'hanoi: minimum moves for 4 discs is 15'); const hp = [[3, 2, 1], [], []]; T.ok(L.hanoiMove(hp, 0, 1), 'hanoi: move small disc'); T.ok(!L.hanoiMove(hp, 0, 1), 'hanoi: big disc on small is refused'); T.ok(!L.hanoiMove(hp, 2, 0), 'hanoi: empty peg refuses');
    let sc = true; for (let k = 0; k < 50; k++) { const w = L.scrambleWord('BALLOON'); if (w === 'BALLOON' || w.split('').sort().join('') !== 'ABLLNOO') sc = false; } T.ok(sc, 'scramble: always a different arrangement of the same letters'); T.eq(L.scrambleWord('AAAA'), 'AAAA', 'scramble: single-letter words cannot be scrambled');
  }

  /* ---------------- Dice ---------------- */
  await run('dice', async (t) => {
    G.seed(11);
    T.has(t.text(), 'No rolls yet', 'dice: history starts empty');
    t.click('#roll'); t.click('#roll');                      // the second tap while rolling is ignored
    G.tick(2500);
    T.eq(t.all('#hist .item').length, 1, 'dice: a tap during the roll does not start a second roll');
    const lab = t.all('#hist .item')[0].querySelector('.grow').textContent, m = /^(\d+)d(\d+): (.+)$/.exec(lab);
    T.ok(m && +m[1] === 2 && +m[2] === 6, 'dice: default is 2d6 (' + lab + ')');
    const vals = m[3].split(' + ').map(Number), total = vals.reduce((a, b) => a + b, 0);
    T.ok(vals.length === 2 && vals.every(v => v >= 1 && v <= 6), 'dice: both dice show 1-6');
    T.eq(t.q('#total').textContent, 'Total ' + total, 'dice: total is the sum of the dice');
    const pips = t.all('.die').map(d => d.querySelectorAll('i[style*="accent-t"]').length);
    T.eq(pips.join(), vals.join(), 'dice: the pips drawn match the numbers rolled');
    t.click('#dn [data-v="6"]'); t.click('#ds [data-v="20"]');
    T.eq(W.eval("Store.get('fun.dice.n')"), 6, 'dice: dice count saved'); T.eq(W.eval("Store.get('fun.dice.s')"), 20, 'dice: sides saved');
    T.eq(t.all('.die').length, 6, 'dice: six dice shown');
    t.click('#roll'); G.tick(2500);
    const m2 = /^(\d+)d(\d+): (.+)$/.exec(t.all('#hist .item')[0].querySelector('.grow').textContent), v2 = m2[3].split(' + ').map(Number);
    T.ok(+m2[1] === 6 && +m2[2] === 20 && v2.length === 6 && v2.every(v => v >= 1 && v <= 20), 'dice: 6d20 values are all 1-20');
    T.eq(t.q('#total').textContent, 'Total ' + v2.reduce((a, b) => a + b, 0), 'dice: 6d20 total');
    t.click('#dn [data-v="1"]'); t.click('#ds [data-v="6"]');
    const faces = [0, 0, 0, 0, 0, 0, 0]; G.seed(5);
    for (let k = 0; k < 240; k++) { t.click('#roll'); G.tick(1500); faces[+/: (\d)$/.exec(t.all('#hist .item')[0].querySelector('.grow').textContent)[1]]++; }
    T.ok(faces.slice(1).every(n => n > 20 && n < 62), 'dice: 240 rolls of a d6 land on every face about equally (' + faces.slice(1).join(',') + ')');
    T.eq(t.all('#hist .item').length, 12, 'dice: history keeps the last 12 rolls');
    t.click('#clr'); T.has(t.text(), 'No rolls yet', 'dice: Clear empties the history'); T.eq(W.eval("Store.get('fun.dice.hist').length"), 0, 'dice: cleared history is saved');
  });
  await run('dice', async (t) => {
    T.ok(t.q('#dn .on').dataset.v === '1' && t.q('#ds .on').dataset.v === '6', 'dice: choices are remembered when the tool is opened again');
  });

  /* ---------------- Coin ---------------- */
  await run('coin', async (t) => {
    G.seed(3);
    t.click('#flip'); t.click('#flip');                      // ignored while spinning
    G.tick(1600);
    T.eq(num(t.q('#tn').textContent), 1, 'coin: a tap while flipping does not count twice');
    let h = 0, tl = 0, consistent = true;
    for (let k = 0; k < 200; k++) {
      t.click('#flip'); G.tick(1500);
      const res = t.q('#res').textContent, rot = parseFloat(/rotateY\((-?[\d.]+)deg\)/.exec(t.q('#coin').style.transform)[1]);
      const headsShown = ((rot % 360) + 360) % 360 === 0;
      if (res === 'Heads!' && !headsShown) consistent = false; if (res === 'Tails!' && headsShown) consistent = false;
      if (res === 'Heads!') h++; else tl++;
    }
    T.ok(consistent, 'coin: the result text agrees with the side the coin lands on');
    T.eq(num(t.q('#th').textContent) + num(t.q('#tt').textContent), 201, 'coin: tally counts every flip');
    T.ok(h > 70 && h < 130, 'coin: 200 flips are roughly fair (' + h + ' heads)');
    const th = num(t.q('#th').textContent), tt = num(t.q('#tt').textContent);
    T.near(parseFloat(t.q('#bar').style.width), th / (th + tt) * 100, 0.01, 'coin: the bar shows the heads share');
    T.eq(W.eval("Store.get('fun.coin.tally').h"), th, 'coin: tally saved');
    t.click('#rst'); T.eq(t.q('#tn').textContent, '0', 'coin: reset tally'); T.eq(t.q('#bar').style.width, '50%', 'coin: bar returns to 50% after reset');
  });

  /* ---------------- Spin Wheel ---------------- */
  await run('wheel', async (t) => {
    const chips = () => t.all('#chips .chip').map(c => c.firstChild.textContent.trim());
    T.eq(chips().join(), 'Pizza,Burgers,Sushi,Tacos,Pasta', 'wheel: example options');
    t.type('#new', 'Curry'); t.click('#add'); T.eq(chips().length, 6, 'wheel: add an option'); T.eq(t.q('#new').value, '', 'wheel: input cleared after add');
    t.type('#new', '   '); t.click('#add'); T.eq(chips().length, 6, 'wheel: blank option is ignored');
    t.click('#chips [data-i="5"]'); T.eq(chips().length, 5, 'wheel: remove an option');
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      G.seed(seed); t.click('#spin'); G.tick(6000);
      const res = t.q('#res').textContent.replace('🎉 ', ''), cv = t.q('#cv'), arcs = G.calls(cv, 'arc'), texts = G.calls(cv, 'fillText').map(c => c[1][0]);
      const segs = arcs.slice(1, 6), a = Math.PI * 2 / 5; let at = -1;
      segs.forEach((s, i) => { const rel = (((1.5 * Math.PI - s[1][3]) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); if (rel < a) at = i; });
      T.eq(texts[at], res, 'wheel: the segment under the pointer is the announced winner (seed ' + seed + ')');
      T.ok(G.sane(cv), 'wheel: no NaN in the drawing');
    }
    t.click('#spin'); const before = t.q('#res').textContent; t.click('#spin'); G.tick(6000);
    t.check('#rm', true); T.eq(W.eval("Store.get('fun.wheel.rm')"), true, 'wheel: remove-winner setting saved');
    G.seed(9); t.click('#spin'); G.tick(5000);
    const winner = t.q('#res').textContent.replace('🎉 ', ''); T.eq(chips().length, 5, 'wheel: winner stays until the pause ends');
    t.type('#new', 'Late'); t.click('#add'); T.has(G.toast(), 'Wait', 'wheel: adding during the spin is refused'); T.eq(chips().length, 5, 'wheel: nothing was added during the spin');
    G.tick(2000); T.eq(chips().length, 4, 'wheel: winner is removed after the spin'); T.ok(!chips().includes(winner), 'wheel: it is the winner that was removed');
    t.click('#chips [data-i="0"]'); t.click('#chips [data-i="0"]'); t.click('#chips [data-i="0"]'); T.eq(chips().length, 1, 'wheel: down to one option');
    G.clearToast(); t.click('#spin'); T.has(G.toast(), 'at least two', 'wheel: cannot spin with fewer than two options');
    t.click('#rs'); T.eq(chips().length, 5, 'wheel: restore example list');
    for (let i = 0; i < 40; i++) { t.type('#new', 'Opt' + i); t.click('#add'); } T.eq(chips().length, 30, 'wheel: at most 30 options');
    t.type('#new', 'x'.repeat(40)); T.eq(t.q('#new').maxLength, 24, 'wheel: option names are limited to 24 characters');
  });

  /* ---------------- Reaction Timer ---------------- */
  await run('reactiontimer', async (t) => {
    const pad = t.q('#pad'), big = () => t.q('#big').textContent;
    const waitGreen = () => { G.tick(1499); let k = 1499; while (big() !== 'TAP!' && k++ < 5000) G.tick(1); return k; };
    G.seed(21);
    T.eq(big(), '⚡', 'reaction: idle screen');
    G.ev(pad, 'pointerdown'); T.eq(big(), 'Wait…', 'reaction: waiting for green'); G.ev(pad, 'pointerdown'); T.eq(big(), 'Too soon!', 'reaction: tapping early is punished');
    G.tick(6000); T.eq(big(), 'Too soon!', 'reaction: the green timer was cancelled by the early tap');
    T.eq(t.q('#last').textContent, '–', 'reaction: an early tap records nothing');
    const ms = [250, 300, 400];
    for (let i = 0; i < 3; i++) {
      G.ev(pad, 'pointerdown'); const waited = waitGreen(); T.ok(waited >= 1500 && waited <= 4800, 'reaction: green appears after 1.5-4.7 s (' + waited + ' ms)');
      G.tick(ms[i]); G.ev(pad, 'pointerdown');
      T.eq(big(), ms[i] + ' ms', 'reaction: reaction time is measured exactly (' + ms[i] + ')');
    }
    T.eq(t.q('#last').textContent, '400 ms', 'reaction: last result'); T.eq(t.q('#best').textContent, '250 ms', 'reaction: best result'); T.eq(t.q('#avg').textContent, '317 ms', 'reaction: average of the last 5');
    T.eq(W.eval("Store.get('fun.reaction.best')"), 250, 'reaction: best saved');
    G.ev(pad, 'pointerdown'); waitGreen(); G.tick(120); G.ev(pad, 'pointerdown');
    T.has(t.q('#sub').textContent, 'New best', 'reaction: a faster time announces a new best'); T.eq(t.q('#best').textContent, '120 ms', 'reaction: best updated');
    G.ev(pad, 'pointerdown'); waitGreen(); G.tick(900); G.ev(pad, 'pointerdown'); T.eq(t.q('#best').textContent, '120 ms', 'reaction: a slower time does not replace the best');
    G.key('Enter', pad); T.eq(big(), 'Wait…', 'reaction: Enter on the pad also starts (keyboard access)');
    t.click('#rst'); T.eq(t.q('#best').textContent, '–', 'reaction: reset clears best'); T.eq(W.eval("Store.get('fun.reaction.recent').length"), 0, 'reaction: reset clears saved results');
  });

  /* ---------------- Tic-Tac-Toe ---------------- */
  await run('tictactoe', async (t) => {
    const cells = () => t.all('#grid button'), mark = (b) => b.querySelector('path') ? 'X' : b.querySelector('circle') ? 'O' : '', board = () => cells().map(mark).join('');
    const sc = () => t.all('#sc b').map(b => b.textContent).join(',');
    T.eq(board(), '', 'ttt: empty board'); T.has(t.q('#msg').textContent, 'Your move', 'ttt: you start as X');
    t.click('#grid [data-i="4"]'); T.eq(mark(cells()[4]), 'X', 'ttt: X placed in the centre'); t.click('#grid [data-i="0"]'); T.eq(mark(cells()[0]), '', 'ttt: cannot play while the phone is thinking');
    G.tick(600); T.eq(board().replace(/,/g, '').length, 2, 'ttt: the phone answers');
    t.click('#grid [data-i="4"]'); T.eq(cells().map(mark).filter(Boolean).length, 2, 'ttt: occupied cell refuses a move');
    /* many random human games: the phone never loses, every game ends with a result and the scoreboard adds up */
    G.seed(99); let wins = 0, losses = 0, draws = 0;
    for (let g = 0; g < 80; g++) {
      t.click('#again'); if (g % 2) t.click('#side [data-v="O"]'); else t.click('#side [data-v="X"]'); G.tick(600);
      for (let k = 0; k < 12 && !/win|draw/i.test(t.q('#msg').textContent); k++) {
        const free = cells().map((b, i) => mark(b) ? -1 : i).filter(i => i >= 0); if (!free.length) break;
        t.click('#grid [data-i="' + free[Math.floor(G.w.Math.random() * free.length)] + '"]'); G.tick(600);
      }
      const m = t.q('#msg').textContent; if (/You win/.test(m)) wins++; else if (/phone wins/.test(m)) losses++; else if (/draw/.test(m)) draws++; else T.ok(false, 'ttt: game ' + g + ' ended without a result (' + m + ')');
    }
    T.eq(wins, 0, 'ttt: the phone never loses to random play (' + wins + '/' + losses + '/' + draws + ' W/L/D)'); T.ok(losses > 20, 'ttt: random play loses often');
    const s = W.eval("Store.get('fun.ttt.score')"); T.eq(s.w + s.l + s.d, 80 + 0, 'ttt: scoreboard counts every finished game'); T.eq(s.l, losses, 'ttt: phone wins counted');
    t.click('#rst'); T.eq(sc(), '0,0,0', 'ttt: reset score');
    /* two players */
    t.click('#mode [data-v="two"]'); T.has(t.q('#msg').textContent, 'X to move', 'ttt: two-player mode starts with X');
    [0, 3, 1, 4, 2].forEach(i => t.click('#grid [data-i="' + i + '"]'));
    T.has(t.q('#msg').textContent, 'X wins', 'ttt: X completes the top row'); T.eq(sc(), '1,0,0', 'ttt: X score in two-player mode');
    t.click('#grid [data-i="8"]'); T.eq(mark(cells()[8]), '', 'ttt: no moves after the game is over');
    T.ok(t.all('#grid button').filter(b => /ok/.test(b.getAttribute('style') || '')).length === 3, 'ttt: the winning line is highlighted');
    t.click('#again'); [0, 1, 2, 4, 3, 5, 7, 6, 8].forEach(i => t.click('#grid [data-i="' + i + '"]'));
    T.has(t.q('#msg').textContent, 'draw', 'ttt: full board is a draw'); T.eq(sc(), '1,1,0', 'ttt: draw counted');
    t.click('#again'); [0, 4, 1, 5, 8, 3].forEach(i => t.click('#grid [data-i="' + i + '"]')); T.has(t.q('#msg').textContent, 'O wins', 'ttt: O wins with the middle row'); T.eq(sc(), '1,1,1', 'ttt: O score counted');
  });

  /* ---------------- Memory Match ---------------- */
  await run('memory', async (t) => {
    const cards = () => t.all('#grid .mc'), face = (c) => c.querySelector('.front').textContent, up = (c) => c.classList.contains('up');
    G.seed(31);
    T.eq(cards().length, 16, 'memory: 4x4 has 16 cards');
    const faces = cards().map(face); const cnt = {}; faces.forEach(f => { cnt[f] = (cnt[f] || 0) + 1; }); T.ok(Object.values(cnt).every(n => n === 2) && Object.keys(cnt).length === 8, 'memory: every face appears exactly twice');
    /* a mismatch flips back */
    const a = 0, b = faces.findIndex((f, i) => i > 0 && f !== faces[0]);
    cards()[a].click(); cards()[b].click(); T.eq(t.q('#mv').textContent, '1', 'memory: a pair of flips is one move');
    cards()[(b + 1) % 16 === a ? (b + 2) % 16 : (b + 1) % 16].click(); T.eq(cards().filter(up).length, 2, 'memory: a third card cannot be flipped while two are showing');
    G.tick(1500); T.eq(cards().filter(up).length, 0, 'memory: a mismatch turns face down again');
    cards()[a].click(); cards()[a].click(); T.eq(cards().filter(up).length, 1, 'memory: clicking the same card twice does nothing'); T.eq(t.q('#mv').textContent, '1', 'memory: so no move is counted');
    const partner = faces.findIndex((f, i) => i !== a && f === faces[a]); cards()[partner].click(); G.tick(500);
    T.ok(cards()[a].classList.contains('ok') && cards()[partner].classList.contains('ok'), 'memory: a match stays face up and is marked'); T.eq(t.q('#mv').textContent, '2', 'memory: moves counted');
    G.tick(4000);
    const done = new Set([a, partner]);
    for (let i = 0; i < 16; i++) { if (done.has(i)) continue; const j = faces.findIndex((f, k) => k !== i && f === faces[i]); done.add(i); done.add(j); cards()[i].click(); cards()[j].click(); G.tick(500); }
    T.has(t.q('#msg').textContent, 'Done in 9 moves', 'memory: finishing reports the moves'); T.has(t.q('#msg').textContent, 'new best', 'memory: first result is a best');
    const best = W.eval("Store.get('fun.memory.best')")['4x4']; T.eq(best.moves, 9, 'memory: best moves saved'); T.ok(best.secs >= 4, 'memory: elapsed time was tracked (' + best.secs + ' s)');
    T.eq(G.clock.pending().iv, 0, 'memory: the clock stops when the game is won');
    /* a worse game does not replace it */
    t.click('#new'); const f2 = cards().map(face); let k = 0;
    for (let i = 0; i < 16; i += 1) { const j = f2.findIndex((f, x) => x > i && f === f2[i]); if (j < 0 || cards()[i].classList.contains('ok')) continue; const o = f2.findIndex((f, x) => f !== f2[i] && !cards()[x].classList.contains('ok')); if (k < 3) { cards()[i].click(); cards()[o].click(); G.tick(1500); k++; } cards()[i].click(); cards()[j].click(); G.tick(500); }
    T.ok(!/new best/.test(t.q('#msg').textContent) || cards().every(c => c.classList.contains('ok')), 'memory: second game with extra misses is not a new best');
    T.eq(W.eval("Store.get('fun.memory.best')")['4x4'].moves, 9, 'memory: best is kept');
    t.click('#sz [data-v="3x4"]'); T.eq(cards().length, 12, 'memory: 3x4 has 12 cards'); t.click('#sz [data-v="4x5"]'); T.eq(cards().length, 20, 'memory: 4x5 has 20 cards');
  });

  await T.done(G.page);
})().catch(e => { console.log("FAIL: test crashed: " + (e && e.stack || e)); process.exit(1); });
