'use strict';
/* fun.js, part 6: the improvements (restart confirmations, pause and background time, snake speeds and pause, easy tic-tac-toe, confetti, live regions). */
const { bootGame } = require('./fun-lib');
const { suite } = require('../helpers/page');
global.Tools = global.Tools || { register() {} };
const L = require('../../www/js/tools/fun.js');

(async () => {
  const T = suite('fun-f'), G = await bootGame({ seed: 7 });
  const W = G.w;
  const run = async (id, fn, pre) => {
    const before = G.listeners(); G.unseed(); G.clock.reset(); if (pre) pre();
    const t = await G.page.open(id);
    try { await fn(t); } catch (e) { T.ok(false, id + ' threw: ' + String(e.stack || e).split('\n').slice(0, 3).join(' | ')); }
    G.leaves(t, before, T, id);
  };
  const num = (s) => +String(s).replace(/[^\d.-]/g, '');
  /* confirm() stand-in: counts the questions and answers with "answer" */
  let asked = 0, answer = true; W.confirm = () => { asked++; return answer; };
  const cell = (b) => b.querySelector('path') ? 'X' : b.querySelector('circle') ? 'O' : '';

  /* ---------------- every result line is a live region; hangman keys are big enough ---------------- */
  for (const id of ['tictactoe', 'memory', 'g2048', 'minesweeper', 'snake', 'sudoku', 'simon', 'hangman', 'connect4', 'hanoi', 'numguess', 'mathsprint', 'whackamole', 'slide15', 'lightsout', 'quiz', 'scramble', 'bingo', 'bottle', 'wheel', 'rps', 'coin', 'eightball', 'reactiontimer']) {
    await run(id, async (t) => { const m = t.all('.msg'); T.ok(m.length === 0 || m.every(x => x.getAttribute('role') === 'status' && x.getAttribute('aria-live') === 'polite'), id + ': result lines are announced to screen readers'); });
  }
  await run('hangman', async (t) => { T.ok(t.all('#kb button').every(b => /min-height:\s*44px/.test(b.getAttribute('style'))), 'hangman: letter keys are at least 44 px tall'); });

  /* ---------------- Tic-tac-toe: easy phone ---------------- */
  await run('tictactoe', async (t) => {
    const cells = () => t.all('#grid button'), board = () => cells().map(cell);
    const playGames = (n, lvl) => {
      t.click('#lvl [data-v="' + lvl + '"]'); let w = 0, l = 0, d = 0; G.seed(lvl === 'easy' ? 3 : 4);
      for (let g = 0; g < n; g++) {
        t.click('#again');
        for (let k = 0; k < 12 && !/win|draw/i.test(t.q('#msg').textContent); k++) { const b = board().map(v => v || null); const mv = L.tttBest(b, 'X'); t.click('#grid [data-i="' + mv + '"]'); G.tick(600); }
        const m = t.q('#msg').textContent; if (/You win/.test(m)) w++; else if (/phone wins/.test(m)) l++; else d++;
      }
      return { w, l, d };
    };
    T.ok(t.has('#lvl'), 'ttt: the phone has a level choice'); T.eq(t.q('#lvl .on').dataset.v, 'hard', 'ttt: the unbeatable phone is the default');
    const hard = playGames(40, 'hard'); T.eq(hard.w + hard.l, 0, 'ttt: a perfect player only draws against the unbeatable phone (' + hard.d + ' draws)');
    const easy = playGames(40, 'easy'); T.ok(easy.w >= 8, 'ttt: a good player beats the easy phone often (' + easy.w + ' of 40)'); T.ok(easy.w + easy.l + easy.d === 40, 'ttt: every easy game finishes');
    T.eq(W.eval("Store.get('fun.ttt.lvl')"), 'easy', 'ttt: level saved');
    /* confirm before throwing a game away */
    t.click('#lvl [data-v="hard"]'); t.click('#again'); asked = 0; t.click('#again'); T.eq(asked, 0, 'ttt: no question for a board nobody has played on');
    t.click('#grid [data-i="4"]'); asked = 0; answer = false; t.click('#again'); T.eq(asked, 1, 'ttt: New game asks while a game is in progress'); T.eq(cells().filter(b => cell(b)).length >= 1, true, 'ttt: saying no keeps the game');
    t.click('#mode [data-v="two"]'); T.eq(t.q('#mode .on').dataset.v, 'ai', 'ttt: saying no to a mode change keeps the old mode selected'); answer = true; t.click('#mode [data-v="two"]'); T.eq(t.q('#mode .on').dataset.v, 'two', 'ttt: saying yes switches'); T.eq(board().filter(Boolean).length, 0, 'ttt: and starts a fresh board');
  });

  /* ---------------- restart confirmations ---------------- */
  await run('memory', async (t) => {
    const cards = () => t.all('#grid .mc'), faces = () => cards().map(c => c.querySelector('.front').textContent);
    G.seed(2); asked = 0; t.click('#new'); T.eq(asked, 0, 'memory: no question before the first flip');
    cards()[0].click(); const f0 = faces().join(); cards()[1].click(); G.tick(1500); asked = 0; answer = false; t.click('#new'); T.eq(asked, 1, 'memory: asks once a move has been made'); T.eq(faces().join(), f0, 'memory: no keeps the same cards'); T.eq(t.q('#mv').textContent, '1', 'memory: and the move counter');
    t.click('#sz [data-v="3x4"]'); T.eq(cards().length, 16, 'memory: no to a size change keeps the old grid'); T.eq(t.q('#sz .on').dataset.v, '4x4', 'memory: and the old size stays selected'); answer = true; t.click('#sz [data-v="3x4"]'); T.eq(cards().length, 12, 'memory: yes changes the size');
    T.has(t.q('#msg').textContent, 'matching pair', 'memory: a how-to line is shown');
    /* background time: hidden minutes are not counted */
    cards()[0].click(); const fx = faces(), p = fx.findIndex((v, i) => i && v === fx[0]); cards()[p].click(); G.tick(500); G.tick(4000);
    G.setHidden(true); G.tick(120000); G.setHidden(false); G.tick(1000); const secs = (() => { const m = /(\d+):(\d+)/.exec(t.q('#tm').textContent); return +m[1] * 60 + +m[2]; })(); T.ok(secs >= 5 && secs <= 8, 'memory: two minutes in the background are not counted (' + t.q('#tm').textContent + ')');
  });
  await run('g2048', async (t) => {
    asked = 0; answer = false; t.click('#new'); T.eq(asked, 0, '2048: no question at the start'); G.key('ArrowLeft'); G.tick(200); G.key('ArrowRight'); G.tick(200); G.key('ArrowUp'); G.tick(200); G.key('ArrowDown'); G.tick(200);
    if (num(t.q('#sc').textContent) === 0) { for (let k = 0; k < 60 && num(t.q('#sc').textContent) === 0; k++) { G.key(['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'][k % 4]); G.tick(200); } }
    const sc = num(t.q('#sc').textContent); T.ok(sc > 0, '2048: a few moves score'); t.click('#new'); T.eq(asked, 1, '2048: New game asks once you have a score'); T.eq(num(t.q('#sc').textContent), sc, '2048: no keeps the game'); answer = true; t.click('#new'); T.eq(num(t.q('#sc').textContent), 0, '2048: yes starts over');
  });
  await run('minesweeper', async (t) => {
    asked = 0; answer = false; t.click('#new'); T.eq(asked, 0, 'mines: no question before the first dig'); G.seed(9); t.q('#grid [data-i="27"]').click(); asked = 0; t.click('#new'); T.eq(asked, 1, 'mines: asks while a board is being cleared');
    t.click('#lv [data-v="hard"]'); T.eq(t.all('#grid button').length, 64, 'mines: no keeps the board'); T.eq(t.q('#lv .on').dataset.v, 'easy', 'mines: and the level choice'); answer = true; t.click('#lv [data-v="hard"]'); T.eq(t.all('#grid button').length, 126, 'mines: yes switches level'); T.has(t.q('#msg').textContent, 'Long-press', 'mines: the how-to line mentions flagging');
    G.setHidden(false); t.q('#grid [data-i="60"]').click(); G.tick(3000); G.setHidden(true); G.tick(300000); G.setHidden(false); G.tick(1000); const m = /(\d+):(\d+)/.exec(t.q('#tm').textContent); T.ok(+m[1] * 60 + +m[2] <= 6, 'mines: time spent in the background is not counted (' + t.q('#tm').textContent + ')');
  });
  await run('sudoku', async (t) => {
    G.tick(200); const cells = () => t.all('#grid button'), vals = () => cells().map(b => +b.textContent || 0);
    asked = 0; answer = false; t.click('#new'); G.tick(200); T.eq(asked, 0, 'sudoku: no question for an untouched puzzle'); const v0 = vals(), e = v0.findIndex(v => !v); cells()[e].click(); t.click('#pad [data-n="1"]'); asked = 0; t.click('#new'); T.eq(asked, 1, 'sudoku: asks when you have entered numbers'); T.eq(vals().join(), v0.map((v, i) => i === e ? 1 : v).join(), 'sudoku: no keeps the puzzle and your numbers');
    t.click('#lv [data-v="hard"]'); T.eq(t.q('#lv .on').dataset.v, 'easy', 'sudoku: no to a level change keeps the level'); answer = true; t.click('#new'); G.tick(200); T.ok(vals().join() !== v0.join(), 'sudoku: yes makes a new puzzle'); T.has(t.q('#msg').textContent, 'Tap a cell', 'sudoku: a how-to line is shown');
    G.tick(2000); G.setHidden(true); G.tick(600000); G.setHidden(false); G.tick(1000); const m = /(\d+):(\d+)/.exec(t.q('#tm').textContent); T.ok(+m[1] * 60 + +m[2] <= 5, 'sudoku: the clock ignores time in the background (' + t.q('#tm').textContent + ')');
  });
  await run('slide15', async (t) => {
    const moveAny = () => { const b = t.all('#board button'); for (const x of b) { x.click(); if (t.q('#mv').textContent !== '0') return; } };
    asked = 0; answer = false; t.click('#new'); T.eq(asked, 0, 'slide: no question before the first move'); moveAny(); asked = 0; t.click('#new'); T.eq(asked, 1, 'slide: asks after a move'); T.eq(t.q('#mv').textContent, '1', 'slide: no keeps the move'); t.click('#n [data-v="3"]'); T.eq(t.q('#n .on').dataset.v, '4', 'slide: and the size'); answer = true; t.click('#new'); T.eq(t.q('#mv').textContent, '0', 'slide: yes reshuffles');
    moveAny(); G.tick(2000); G.setHidden(true); G.tick(300000); G.setHidden(false); G.tick(1000); const m = /(\d+):(\d+)/.exec(t.q('#tm').textContent); T.ok(+m[1] * 60 + +m[2] <= 5, 'slide: the clock ignores time in the background (' + t.q('#tm').textContent + ')');
  });
  await run('hanoi', async (t) => {
    asked = 0; answer = false; t.click('#new'); T.eq(asked, 0, 'hanoi: no question before the first move'); t.q('#pegs [data-p="0"]').click(); t.q('#pegs [data-p="1"]').click(); asked = 0; t.click('#new'); T.eq(asked, 1, 'hanoi: asks after a move'); T.eq(t.q('#mv').textContent, '1', 'hanoi: no keeps the move'); t.click('#n [data-v="5"]'); T.eq(t.q('#n .on').dataset.v, '4', 'hanoi: and the disc count'); answer = true; t.click('#new'); T.eq(t.q('#mv').textContent, '0', 'hanoi: yes restarts');
  });
  await run('connect4', async (t) => {
    asked = 0; answer = false; t.click('#new'); T.eq(asked, 0, 'c4: no question on an empty board'); t.q('#board button').click(); asked = 0; t.click('#new'); T.eq(asked, 1, 'c4: asks during a game'); t.click('#mode [data-v="two"]'); T.eq(t.q('#mode .on').dataset.v, 'ai', 'c4: no keeps the mode'); answer = true; t.click('#new'); T.eq(t.all('#board span').length, 0, 'c4: yes clears the board');
  });
  await run('lightsout', async (t) => {
    asked = 0; answer = false; t.click('#new'); T.eq(asked, 0, 'lights: no question before the first press'); t.q('#grid [data-i="12"]').click(); asked = 0; t.click('#new'); T.eq(asked, 1, 'lights: asks after a press'); T.eq(t.q('#mv').textContent, '1', 'lights: no keeps the game'); t.click('#redo'); T.eq(t.q('#mv').textContent, '0', 'lights: Restart level never asks'); answer = true;
  });
  await run('numguess', async (t) => {
    asked = 0; answer = false; t.type('#in', '50'); t.click('#go'); t.click('#mx [data-v="50"]'); T.eq(asked, 1, 'numguess: changing the range asks once you have guessed'); T.eq(t.q('#mx .on').dataset.v, '100', 'numguess: no keeps the range'); T.eq(num(t.q('#tr').textContent), 1, 'numguess: and the guess'); answer = true;
  });

  /* ---------------- screen reader labels ---------------- */
  await run('tictactoe', async (t) => { t.click('#mode [data-v="two"]'); T.eq(t.q('#grid [data-i="0"]').getAttribute('aria-label'), 'Cell 1, empty', 'ttt: an empty cell is announced as empty'); t.click('#grid [data-i="4"]'); T.eq(t.q('#grid [data-i="4"]').getAttribute('aria-label'), 'Cell 5, X', 'ttt: a played cell says who is in it'); });
  await run('sudoku', async (t) => { G.tick(200); const cells = t.all('#grid button'), g = cells.findIndex(b => /given/.test(b.getAttribute('aria-label'))), e = cells.findIndex(b => /empty/.test(b.getAttribute('aria-label'))); T.ok(g >= 0 && e >= 0, 'sudoku: givens and empty cells are announced differently'); T.ok(/^Row \d column \d, \d, given$/.test(cells[g].getAttribute('aria-label')), 'sudoku: a given says its number'); cells[e].click(); t.click('#pad [data-n="4"]'); T.ok(/, 4$/.test(t.all('#grid button')[e].getAttribute('aria-label')), 'sudoku: an entered number is announced'); });

  /* ---------------- confetti ---------------- */
  await run('hanoi', async (t) => {
    t.click('#n [data-v="3"]'); const moves = []; (function h(n, a, b, c) { if (!n) return; h(n - 1, a, c, b); moves.push([a, b]); h(n - 1, c, b, a); })(3, 0, 2, 1);
    T.eq(t.all('.cf').length, 0, 'confetti: none before a win'); moves.forEach(([a, b]) => { t.q('#pegs [data-p="' + a + '"]').click(); t.q('#pegs [data-p="' + b + '"]').click(); });
    T.eq(t.all('.cf i').length, 16, 'confetti: a burst after solving'); T.eq(t.q('.cf').getAttribute('aria-hidden'), 'true', 'confetti: hidden from screen readers'); T.eq(t.q('.cf').style.pointerEvents || 'css', 'css', 'confetti: never blocks taps (css pointer-events)'); G.tick(2500); T.eq(t.all('.cf').length, 0, 'confetti: removes itself');
    t.click('#new'); moves.forEach(([a, b]) => { t.q('#pegs [data-p="' + a + '"]').click(); t.q('#pegs [data-p="' + b + '"]').click(); }); t.click('#new'); T.ok(true, 'confetti: restarting right after is fine');
  });
  await run('hanoi', async (t) => {
    t.click('#n [data-v="3"]'); const moves = []; (function h(n, a, b, c) { if (!n) return; h(n - 1, a, c, b); moves.push([a, b]); h(n - 1, c, b, a); })(3, 0, 2, 1); moves.forEach(([a, b]) => { t.q('#pegs [data-p="' + a + '"]').click(); t.q('#pegs [data-p="' + b + '"]').click(); });
    T.eq(t.all('.cf').length, 0, 'confetti: skipped for people who asked for reduced motion');
  }, () => { W.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} }); });
  W.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

  /* ---------------- snake: speeds, pause, background ---------------- */
  await run('snake', async (t) => {
    const cv = t.q('#cv');
    const frame = () => { const all = G.calls(cv); let k = all.length - 1; while (k > 0 && !(all[k][0] === 'fillRect' && all[k][1].join() === '0,0,40,40')) k--; return all.slice(k); };
    const head = () => { const a = frame().filter(c => c[0] === 'roundRect')[0][1]; return Math.round((a[0] - 1) / 40) + ',' + Math.round((a[1] - 1) / 40); };
    const msg = () => t.q('#msg').textContent, tap = () => { G.ev(cv, 'pointerdown', { x: 50, y: 50 }); G.ev(cv, 'pointerup', { x: 50, y: 50 }); };
    T.eq(t.q('#sp .on').dataset.v, 'normal', 'snake: normal speed by default'); T.eq(t.q('#bs').textContent, '12', 'snake: an old saved best (a plain number) is kept for the normal speed');
    t.click('#sp [data-v="fast"]'); T.eq(t.q('#bs').textContent, '0', 'snake: each speed has its own best'); tap(); G.tick(109); T.eq(head(), '7,7', 'snake: fast starts moving after 110 ms'); G.tick(2); T.eq(head(), '8,7', 'snake: fast moves every 110 ms');
    /* pause */
    t.click('#pz'); T.has(msg(), 'Paused', 'snake: Pause says so'); T.has(t.q('#pz').textContent, 'Resume', 'snake: the button becomes Resume'); const h0 = head(); G.tick(3000); T.eq(head(), h0, 'snake: the snake stays put while paused'); G.key('ArrowDown'); T.eq(msg(), 'Go!', 'snake: steering resumes the game'); G.tick(300); T.ok(head() !== h0, 'snake: and it moves again');
    t.click('#pz'); G.tick(500); const h1 = head(); tap(); T.eq(msg(), 'Go!', 'snake: tapping the board resumes'); G.tick(200); T.ok(head() !== h1, 'snake: and the snake moves');
    G.setHidden(true); T.has(msg(), 'Paused', 'snake: leaving the app pauses'); const h2 = head(); G.tick(5000); T.eq(head(), h2, 'snake: nothing moves in the background'); G.setHidden(false); T.has(msg(), 'Paused', 'snake: coming back does not resume by itself'); G.key('p'); T.eq(msg(), 'Go!', 'snake: P resumes'); G.key('p'); T.has(msg(), 'Paused', 'snake: P pauses');
    answer = false; asked = 0; t.click('#sp [data-v="slow"]'); T.eq(asked, 1, 'snake: changing the speed mid-game asks'); T.eq(t.q('#sp .on').dataset.v, 'fast', 'snake: no keeps the speed'); answer = true; t.click('#sp [data-v="slow"]'); T.has(msg(), 'Tap the board', 'snake: yes goes back to the start'); T.eq(W.eval("Store.get('fun.snake.sp')"), 'slow', 'snake: speed saved');
    tap(); G.tick(189); T.eq(head(), '7,7', 'snake: slow waits 190 ms'); G.tick(2); T.eq(head(), '8,7', 'snake: then moves'); t.click('#pz'); t.click('#pz'); T.ok(true, 'snake: pause and resume repeatedly is fine');
    G.tick(20000); T.has(msg(), 'Game over', 'snake: slow snake still crashes into the wall'); t.click('#pz'); T.has(msg(), 'Game over', 'snake: Pause does nothing after game over');
  }, () => G.setStore('fun.snake.best', 12));

  await T.done(G.page);
})().catch(e => { console.log('FAIL: test crashed: ' + (e && e.stack || e)); process.exit(1); });
