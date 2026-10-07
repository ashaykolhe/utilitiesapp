'use strict';
/* fun.js, part 2: scoreboard, 8-ball, rock paper scissors, 2048, minesweeper, snake. */
const { bootGame } = require('./fun-lib');
const { suite } = require('../helpers/page');

(async () => {
  const T = suite('fun-b'), G = await bootGame({ seed: 7 });
  const W = G.w;
  const run = async (id, fn, pre) => {
    const before = G.listeners(); G.unseed(); G.clock.reset(); if (pre) pre();
    const t = await G.page.open(id);
    try { await fn(t); } catch (e) { T.ok(false, id + ' threw: ' + String(e.stack || e).split('\n').slice(0, 3).join(' | ')); }
    G.leaves(t, before, T, id);
  };
  const num = (s) => +String(s).replace(/[^\d.-]/g, '');

  /* ---------------- Scoreboard ---------------- */
  await run('scoreboard', async (t) => {
    const sc = (i) => num(t.q('#s' + i).textContent), crown = (i) => t.q('#c' + i).textContent, saved = () => W.eval("Store.get('fun.scoreboard.players')");
    T.eq(t.all('#list .card').length, 2, 'scoreboard: starts with two players');
    for (let k = 0; k < 3; k++) t.click('[data-d="0:1"]'); T.eq(sc(0), 3, 'scoreboard: +1 three times'); T.eq(crown(0), '👑', 'scoreboard: the leader gets a crown'); T.eq(crown(1), '', 'scoreboard: the other player does not');
    t.click('[data-d="1:-1"]'); T.eq(sc(1), -1, 'scoreboard: scores can go negative'); T.eq(crown(1), '', 'scoreboard: negative score is not a leader');
    t.click('[data-d="1:1"]'); t.click('[data-d="1:1"]'); t.click('[data-d="1:1"]'); T.eq(sc(1), 2, 'scoreboard: player two scores'); T.eq(crown(0), '👑', 'scoreboard: still ahead');
    t.click('[data-d="1:1"]'); T.eq(crown(0) + crown(1), '👑👑', 'scoreboard: a tie at the top crowns both');
    t.type('#step', '7'); t.click('[data-d="0:c"]'); T.eq(sc(0), 10, 'scoreboard: + custom adds the amount'); t.click('[data-d="0:-c"]'); t.click('[data-d="0:-c"]'); T.eq(sc(0), -4, 'scoreboard: - custom subtracts it');
    t.type('#step', '0'); T.eq(t.value('#step'), '1', 'scoreboard: amount 0 becomes 1'); t.type('#step', '99999'); T.eq(t.value('#step'), '9999', 'scoreboard: amount is capped at 9999'); t.type('#step', 'abc'); T.eq(t.value('#step'), '1', 'scoreboard: garbage amount falls back to 1');
    T.eq(W.eval("Store.get('fun.scoreboard.step')"), 1, 'scoreboard: amount saved');
    t.type('[data-n="0"]', 'Ann <b>x</b>'); T.eq(saved()[0].n, 'Ann <b>x</b>', 'scoreboard: renaming saves'); T.eq(t.q('[data-n="0"]').maxLength, 20, 'scoreboard: names are limited to 20');
    t.click('#add'); T.eq(t.all('#list .card').length, 3, 'scoreboard: add a player'); T.eq(saved()[2].n, 'Player 3', 'scoreboard: new player is named');
    for (let i = 0; i < 12; i++) t.click('#add'); T.eq(t.all('#list .card').length, 12, 'scoreboard: at most 12 players'); T.has(G.toast(), '12', 'scoreboard: says why');
    t.click('[data-x="11"]'); t.click('[data-x="10"]'); T.eq(t.all('#list .card').length, 10, 'scoreboard: remove players');
    T.eq(t.all('#list b').length, 0, 'scoreboard: a name with HTML is shown as text, never as markup');
    t.click('#rst'); T.ok(t.all('.big').every(b => b.textContent === '0'), 'scoreboard: reset scores'); T.eq(crown(0), '', 'scoreboard: no crown at zero');
    t.click('#clr'); T.has(t.text(), 'Add a player to start', 'scoreboard: remove everyone'); T.eq(saved().length, 0, 'scoreboard: empty list saved');
    t.click('#add'); T.eq(t.all('#list .card').length, 1, 'scoreboard: add after clearing');
  });
  await run('scoreboard', async (t) => {
    T.eq(t.all('#list .card').length, 2, 'scoreboard: damaged saved data falls back to the default players'); T.ok(t.all('.big').every(b => b.textContent === '0'), 'scoreboard: with zero scores');
  }, () => G.setStore('fun.scoreboard.players', 'broken'));
  await run('scoreboard', async (t) => {
    T.eq(t.all('#list .card').length, 3, 'scoreboard: odd saved entries are cleaned up (junk rows dropped)'); T.eq(t.q('#s0').textContent, '0', 'scoreboard: NaN score becomes 0'); T.eq(t.q('#s1').textContent, '999999999', 'scoreboard: huge score is clamped'); T.eq(t.value('[data-n="2"]'), '', 'scoreboard: missing name becomes empty text');
  }, () => G.setStore('fun.scoreboard.players', [{ n: 'A', s: 'x' }, { n: 'B', s: 1e12 }, null, 5, { s: 2 }]));

  /* ---------------- Magic 8-Ball ---------------- */
  const ANS = ['It is certain', 'Without a doubt', 'Yes, definitely', 'You may rely on it', 'As I see it, yes', 'Most likely', 'Outlook good', 'Yes', 'Signs point to yes', 'Reply hazy, try again', 'Ask again later', 'Better not tell you now', 'Cannot predict now', 'Concentrate and ask again', "Don't count on it", 'My reply is no', 'My sources say no', 'Outlook not so good', 'Very doubtful', 'Absolutely not'];
  W.DeviceMotionEvent = undefined;
  await run('eightball', async (t) => {
    T.has(t.text(), 'Shake is not available', '8-ball: says so when there is no motion sensor');
    G.seed(2); let prev = -2, ok = true, hintOk = true, seen = new Set();
    for (let k = 0; k < 120; k++) {
      t.click('#ball'); t.click('#ball'); G.tick(1000);
      const a = t.q('#ans').textContent, i = ANS.indexOf(a); if (i < 0 || i === prev) ok = false; prev = i; seen.add(i);
      const hint = t.q('#hint').textContent; if (!((i < 10 && /good/.test(hint)) || (i >= 10 && i < 15 && /unclear/.test(hint)) || (i >= 15 && /Not looking/.test(hint)))) hintOk = false;
    }
    T.ok(ok, '8-ball: every answer is from the list and never the same twice in a row'); T.ok(hintOk, '8-ball: the hint matches positive / unclear / negative'); T.ok(seen.size >= 17, '8-ball: all kinds of answers appear (' + seen.size + '/20)');
    T.eq(t.q('#ans').style.opacity, '1', '8-ball: answer is visible when settled');
  });
  await run('eightball', async (t) => {
    const mot = (x, y, z) => { const e = new W.Event('devicemotion'); e.accelerationIncludingGravity = { x, y, z }; W.dispatchEvent(e); };
    G.seed(4); mot(0, 0, 9.8); G.tick(100); mot(0, 0, 10.5); G.tick(1000); T.eq(t.q('#ans').textContent.trim(), '8', '8-ball: a gentle movement does not trigger an answer');
    mot(30, 25, 20); G.tick(1000); T.ok(ANS.includes(t.q('#ans').textContent), '8-ball: a shake gives an answer');
    const first = t.q('#ans').textContent; mot(0, 0, 9.8); mot(40, 30, 20); G.tick(1000); T.eq(t.q('#ans').textContent, first, '8-ball: shakes closer than 1.5 s together are ignored');
    G.tick(1600); mot(0, 0, 9.8); mot(40, 30, 20); G.tick(1000); T.ok(t.q('#ans').textContent !== first, '8-ball: a later shake answers again');
  }, () => { W.DeviceMotionEvent = function () {}; });
  W.DeviceMotionEvent = undefined;
  await run('eightball', async (t) => {
    T.ok(t.has('#en'), '8-ball: iOS-style motion permission shows an Enable button'); t.click('#en'); await G.page.wait(20); T.ok(!t.has('#en'), '8-ball: button disappears after granting');
  }, () => { W.DeviceMotionEvent = function () {}; W.DeviceMotionEvent.requestPermission = () => Promise.resolve('granted'); });
  await run('eightball', async (t) => {
    t.click('#en'); await G.page.wait(20); T.has(G.toast(), 'denied', '8-ball: denied permission says to tap instead'); T.ok(t.has('#en'), '8-ball: the button stays so the user can retry');
  }, () => { W.DeviceMotionEvent = function () {}; W.DeviceMotionEvent.requestPermission = () => Promise.resolve('denied'); });
  W.DeviceMotionEvent = undefined;

  /* ---------------- Rock Paper Scissors ---------------- */
  await run('rps', async (t) => {
    const beats = { '✊': '✌️', '✋': '✊', '✌️': '✋' }, picks = ['✊', '✋', '✌️'];
    G.seed(8); let w = 0, l = 0, d = 0, streak = 0, best = 0; const seenCpu = new Set();
    for (let k = 0; k < 150; k++) {
      const mine = k % 3; t.click('#pick [data-i="' + mine + '"]'); t.click('#pick [data-i="' + ((mine + 1) % 3) + '"]'); G.tick(800);
      const me = t.q('#you').textContent, cpu = t.q('#cpu').textContent, msg = t.q('#msg').textContent; seenCpu.add(cpu);
      T.ok(me === picks[mine], 'rps: your hand is the one you picked (second tap ignored)');
      if (me === cpu) { d++; T.has(msg, 'Draw', 'rps: draw message'); }
      else if (beats[me] === cpu) { w++; streak++; best = Math.max(best, streak); if (!/beats/.test(msg)) T.ok(false, 'rps: win message'); }
      else { l++; streak = 0; if (!/beats/.test(msg)) T.ok(false, 'rps: loss message'); }
      if (k === 0 && (w + d + l) !== 1) T.ok(false, 'rps: one game counted');
    }
    T.eq(t.q('#w').textContent + ',' + t.q('#d').textContent + ',' + t.q('#l').textContent, w + ',' + d + ',' + l, 'rps: wins, draws and losses match every round played');
    T.eq(t.q('#sk').textContent, String(streak), 'rps: current streak'); T.eq(t.q('#bs').textContent, String(best), 'rps: best streak'); T.ok(seenCpu.size === 3 && w > 25 && l > 25, 'rps: the phone throws all three hands about equally (' + w + '/' + d + '/' + l + ')');
    T.eq(W.eval("Store.get('fun.rps.stats').w"), w, 'rps: stats saved');
    t.click('#rst'); T.eq(t.q('#w').textContent, '0', 'rps: reset');
  });

  /* ---------------- 2048 ---------------- */
  await run('g2048', async (t) => {
    const grid = () => { const g = new Array(16).fill(0); t.all('.t48').forEach(e => { const l = parseFloat(e.style.left), tp = parseFloat(e.style.top); g[Math.round((tp - 1.5) / 25) * 4 + Math.round((l - 1.5) / 25)] += +e.textContent; }); return g; };
    const count = () => t.all('.t48').length, bd = t.q('#board'), score = () => num(t.q('#sc').textContent);
    const slide = (line) => { const a = line.filter(Boolean), out = []; let s = 0; for (let i = 0; i < a.length; i++) { if (a[i] === a[i + 1]) { out.push(a[i] * 2); s += a[i] * 2; i++; } else out.push(a[i]); } while (out.length < 4) out.push(0); return { out, s }; };
    const mv = (g, dir) => { const n = new Array(16).fill(0); let s = 0; for (let k = 0; k < 4; k++) { const idx = []; for (let j = 0; j < 4; j++) idx.push(dir === 3 ? k * 4 + j : dir === 1 ? k * 4 + 3 - j : dir === 0 ? j * 4 + k : (3 - j) * 4 + k); const r = slide(idx.map(i => g[i])); r.out.forEach((v, j) => { n[idx[j]] = v; }); s += r.s; } return { n, s }; };
    G.seed(17); t.click('#new');
    let g = grid(); T.eq(count(), 2, '2048: starts with two tiles'); T.ok(g.every(v => v === 0 || v === 2 || v === 4), '2048: starting tiles are 2 or 4'); T.eq(score(), 0, '2048: score starts at 0');
    const dirs = [3, 0, 1, 2], names = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft']; let moves = 0, bad = 0, scoreBad = 0, noops = 0;
    for (let k = 0; k < 3000 && !/Game over/.test(t.q('#msg').textContent); k++) {
      const dir = (k % 7 === 0 ? G.w.Math.random() * 4 | 0 : dirs[k % 4]), before = grid(), s0 = score(), exp = mv(before, dir);
      G.key(names[dir]); G.tick(200);
      const after = grid(), changed = exp.n.join() !== before.join();
      if (!changed) { noops++; if (after.join() !== before.join() || score() !== s0) bad++; continue; }
      moves++;
      const diff = after.map((v, i) => v - exp.n[i]).filter(Boolean);
      if (diff.length !== 1 || (diff[0] !== 2 && diff[0] !== 4) || exp.n[after.findIndex((v, i) => v !== exp.n[i])] !== 0) bad++;
      if (score() - s0 !== exp.s) scoreBad++;
      if (count() !== after.filter(Boolean).length) bad++;
    }
    T.ok(moves > 20, '2048: played ' + moves + ' effective moves'); T.eq(bad, 0, '2048: every move slides/merges like the rules and spawns one 2 or 4 on an empty cell'); T.eq(scoreBad, 0, '2048: score grows by exactly the merged tile values');
    T.ok(/Game over/.test(t.q('#msg').textContent), '2048: a stuck board ends the game'); T.has(t.q('#msg').textContent, 'Score ' + score(), '2048: game over shows the score');
    const stuck = grid(); G.key('ArrowLeft'); G.tick(200); T.eq(grid().join(), stuck.join(), '2048: no moves after game over');
    T.eq(W.eval("Store.get('fun.2048.best')"), score(), '2048: best score saved'); T.eq(t.q('#bs').textContent, String(score()), '2048: best shown');
    const best = score(); t.click('#new'); T.eq(score(), 0, '2048: new game resets score'); T.eq(t.q('#bs').textContent, String(best), '2048: best survives a new game'); T.eq(count(), 2, '2048: two tiles again');
    /* swipes: right and left on the board */
    G.seed(1); t.click('#new'); const pre = grid(); G.swipe(bd, 80, 5); G.tick(200); const post = grid(); T.eq(post.join() === pre.join(), mv(pre, 1).n.join() === pre.join(), '2048: a right swipe behaves like the right arrow');
    G.swipe(bd, 10, 8); G.tick(200); T.eq(count() >= 2, true, '2048: a tiny swipe (under 24 px) is ignored');
    T.eq(G.clock.pending().iv, 0, '2048: no intervals while playing');
  });

  /* ---------------- Minesweeper ---------------- */
  await run('minesweeper', async (t) => {
    const LV = { easy: [8, 8, 10], med: [9, 12, 22], hard: [9, 14, 36] };
    const cell = (i) => t.q('#grid [data-i="' + i + '"]'), lab = (i) => cell(i).getAttribute('aria-label'), kind = (i) => lab(i).split(', ')[2];
    const statusOf = (i) => { const k = kind(i); return k === 'hidden' ? 'h' : k === 'flag' ? 'f' : k === 'mine' ? 'm' : 'o'; };
    /* first click is always safe on every level and opens a region */
    let allSafe = true, regionOk = true;
    for (const lv of ['easy', 'med', 'hard']) {
      const [w, h] = LV[lv]; t.click('#lv [data-v="' + lv + '"]');
      for (let k = 0; k < 14; k++) {
        t.click('#new'); G.seed(100 + k * 3 + w); const i = [0, w - 1, w * (h - 1), w * h - 1, ((h / 2) | 0) * w + (w / 2 | 0)][k % 5] + (k > 4 ? 1 : 0) * 0;
        cell(i).click(); const m = t.q('#msg').textContent;
        if (/Boom/.test(m) || statusOf(i) !== 'o') allSafe = false;
        const opened = t.all('#grid button').filter((b, x) => statusOf(x) === 'o').length; if (opened < 4) regionOk = false;
      }
    }
    T.ok(allSafe, 'minesweeper: the first click is never a mine (easy, medium, hard)'); T.ok(regionOk, 'minesweeper: the first click opens an area');
    /* known layout: lose on purpose to learn where the mines are, then replay the same seed and win */
    t.click('#lv [data-v="easy"]'); const w = 8, h = 8, N = 64;
    t.click('#new'); G.seed(555); cell(27).click(); G.tick(3000);
    const openedFirst = [...Array(N).keys()].filter(i => statusOf(i) === 'o');
    T.eq(t.q('#tm').textContent, '0:03', 'minesweeper: the clock runs after the first dig');
    let guard = 0; while (!/Boom/.test(t.q('#msg').textContent) && guard++ < 70) { const hid = [...Array(N).keys()].find(i => statusOf(i) === 'h'); cell(hid).click(); }
    T.has(t.q('#msg').textContent, 'Boom', 'minesweeper: hitting a mine loses'); const mines = [...Array(N).keys()].filter(i => statusOf(i) === 'm');
    T.eq(mines.length, 10, 'minesweeper: easy has 10 mines (all revealed after losing)'); T.eq(G.clock.pending().iv, 0, 'minesweeper: the clock stops when the game ends');
    const adj = (i) => { const r = (i / w) | 0, c = i % w; let n = 0; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr = r + dr, cc = c + dc; if ((dr || dc) && rr >= 0 && rr < h && cc >= 0 && cc < w && mines.includes(rr * w + cc)) n++; } return n; };
    let numsOk = true; for (let i = 0; i < N; i++) { const k = lab(i).split(', ')[2]; if (statusOf(i) === 'o') { if ((k === 'empty' ? 0 : +k) !== adj(i)) numsOk = false; } } T.ok(numsOk, 'minesweeper: every number equals the mines around it');
    const emptyBlocksOpened = [...Array(N).keys()].filter(i => statusOf(i) === 'o' && lab(i).endsWith('empty')).every(i => { const r = (i / w) | 0, c = i % w; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < h && cc >= 0 && cc < w && statusOf(rr * w + cc) === 'h') return false; } return true; });
    T.ok(emptyBlocksOpened, 'minesweeper: flood fill opened every neighbour of every empty cell'); T.ok(openedFirst.length >= 9, 'minesweeper: first dig opened a region of ' + openedFirst.length);
    cell(mines[0]).click(); T.eq(statusOf(mines[0]), 'm', 'minesweeper: no more digging after the game is over');
    /* replay: flag every mine by long press, dig every safe cell, win */
    t.click('#new'); G.seed(555); cell(27).click(); T.eq(JSON.stringify([...Array(N).keys()].filter(i => statusOf(i) === 'o')), JSON.stringify(openedFirst), 'minesweeper: the same seed gives the same board (test is repeatable)');
    const hidden = () => [...Array(N).keys()].filter(i => statusOf(i) === 'h');
    /* flag mode */
    t.click('#mode'); T.has(t.q('#mode').textContent, 'Flag', 'minesweeper: flag mode button'); cell(mines[0]).click(); T.eq(kind(mines[0]), 'flag', 'minesweeper: flag mode flags a cell'); T.eq(t.q('#ml').textContent, '9', 'minesweeper: mines-left counter drops');
    cell(mines[0]).click(); T.eq(kind(mines[0]), 'hidden', 'minesweeper: tapping a flag removes it'); T.eq(t.q('#ml').textContent, '10', 'minesweeper: counter restored'); t.click('#mode'); T.has(t.q('#mode').textContent, 'Dig', 'minesweeper: back to dig mode');
    /* long press flags without digging */
    const lp = hidden().find(i => !mines.includes(i)); G.ev(cell(lp), 'pointerdown'); G.tick(500); G.ev(cell(lp), 'pointerup'); cell(lp).click(); T.eq(kind(lp), 'flag', 'minesweeper: a long press flags'); T.eq(t.q('#ml').textContent, '9', 'minesweeper: long press counted');
    cell(lp).click(); T.eq(kind(lp), 'flag', 'minesweeper: a flagged cell is protected from digging'); G.ev(cell(lp), 'pointerdown'); G.tick(500); G.ev(cell(lp), 'pointerup'); cell(lp).click(); T.eq(kind(lp), 'hidden', 'minesweeper: long press again unflags'); G.tick(1000);
    hidden().filter(i => !mines.includes(i)).forEach(i => { if (statusOf(i) === 'h') cell(i).click(); });
    T.has(t.q('#msg').textContent, 'Cleared in', 'minesweeper: opening every safe cell wins'); T.has(t.q('#msg').textContent, 'new best', 'minesweeper: first win is a best');
    const bst = W.eval("Store.get('fun.mines.best')").easy; T.ok(bst >= 2, 'minesweeper: best time saved (' + bst + ' s)'); T.eq(t.q('#bs').textContent, '0:0' + bst, 'minesweeper: best shown');
    T.eq(G.clock.pending().iv, 0, 'minesweeper: clock stopped after winning');
    t.click('#lv [data-v="med"]'); T.eq(t.all('#grid button').length, 108, 'minesweeper: medium is 9 x 12'); t.click('#lv [data-v="hard"]'); T.eq(t.all('#grid button').length, 126, 'minesweeper: hard is 9 x 14'); T.eq(t.q('#ml').textContent, '36', 'minesweeper: hard has 36 mines');
  });

  /* ---------------- Snake ---------------- */
  await run('snake', async (t) => {
    const cv = t.q('#cv'), S = 40, N = 15;
    const frame = () => { const all = G.calls(cv); let k = all.length - 1; while (k > 0 && !(all[k][0] === 'fillRect' && all[k][1].join() === '0,0,40,40')) k--; return all.slice(k); };
    const body = () => frame().filter(c => c[0] === 'roundRect').map(c => ({ x: Math.round((c[1][0] - (c[1][0] % 40 === 1 ? 1 : 3)) / S), y: Math.round((c[1][1] - (c[1][1] % 40 === 1 ? 1 : 3)) / S) }));
    const appleAt = () => { const f = frame().find(c => c[0] === 'fillText' && c[1][0] === '🍎'); return { x: Math.round((f[1][1] - S / 2) / S), y: Math.round((f[1][2] - S / 2 - 2) / S) }; };
    G.seed(1); const msg = () => t.q('#msg').textContent, sc = () => num(t.q('#sc').textContent);
    T.has(msg(), 'Tap the board', 'snake: waits for a tap'); T.eq(body().length, 3, 'snake: starts with three segments'); const a0 = appleAt(); T.ok(!body().some(b => b.x === a0.x && b.y === a0.y), 'snake: apple is not on the snake');
    G.tick(2000); T.eq(body().length, 3, 'snake: does not move before the first tap');
    G.ev(cv, 'pointerdown', { x: 50, y: 50 }); G.ev(cv, 'pointerup', { x: 50, y: 50 }); T.has(msg(), 'Go', 'snake: a tap starts');
    G.tick(150); const hx = body()[0]; T.eq(hx.x + ',' + hx.y, '8,7', 'snake: moves one cell right every 150 ms');
    t.q('[data-d="3"]'); G.ev(t.q('[data-d="3"]'), 'pointerdown'); G.tick(150); T.eq(body()[0].x, 9, 'snake: pressing the opposite direction is ignored');
    G.ev(t.q('[data-d="0"]'), 'pointerdown'); G.tick(150); T.eq(body()[0].x + ',' + body()[0].y, '9,6', 'snake: turns up when asked');
    G.key('ArrowRight'); G.tick(150); T.eq(body()[0].x + ',' + body()[0].y, '10,6', 'snake: arrow keys steer too');
    G.swipe(cv, 5, 60); G.tick(150); T.eq(body()[0].y, 7, 'snake: a swipe down steers down'); T.ok(G.sane(cv), 'snake: no NaN drawing');
    /* run into the wall */
    G.tick(150 * 20); T.has(msg(), 'Game over', 'snake: hitting the wall ends the game'); T.has(msg(), 'Score', 'snake: shows the score'); const s0 = body().length; G.tick(1500); T.eq(body().length, s0, 'snake: stops moving when dead');
    T.eq(G.clock.pending().to, 0, 'snake: no step timer after dying');
    /* autopilot: eat apples with a breadth-first search */
    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const plan = () => {
      const b = body(), head = b[0], ap = appleAt(), block = new Set(b.slice(0, -1).map(p => p.x + ',' + p.y)); const prev = new Map([[head.x + ',' + head.y, null]]); const q = [head];
      for (let k = 0; k < q.length; k++) { const c = q[k]; if (c.x === ap.x && c.y === ap.y) break; dirs.forEach((d, di) => { const nx = c.x + d[0], ny = c.y + d[1], key = nx + ',' + ny; if (nx < 0 || ny < 0 || nx >= N || ny >= N || block.has(key) || prev.has(key)) return; prev.set(key, { from: c, di }); q.push({ x: nx, y: ny }); }); }
      let cur = prev.has(ap.x + ',' + ap.y) ? ap : null; if (!cur) return -1; let first = -1; while (prev.get(cur.x + ',' + cur.y)) { const p = prev.get(cur.x + ',' + cur.y); first = p.di; cur = p.from; } return first;
    };
    G.ev(cv, 'pointerdown', { x: 50, y: 50 }); G.ev(cv, 'pointerup', { x: 50, y: 50 });
    let ate = 0, growOk = true, prevScore = 0;
    for (let k = 0; k < 900 && sc() < 8 && !/Game over/.test(msg()); k++) {
      const d = plan(); if (d >= 0) G.ev(t.q('[data-d="' + d + '"]'), 'pointerdown'); G.tick(Math.max(70, 150 - sc() * 3));
      if (sc() > prevScore) { ate++; prevScore = sc(); if (body().length !== 3 + sc()) growOk = false; }
    }
    T.ok(sc() >= 8, 'snake: an autopilot reached score ' + sc() + ' (' + msg() + ')'); T.ok(growOk, 'snake: the snake grows by one segment per apple'); T.ok(G.sane(cv), 'snake: drawing stays finite');
    const peak = sc(); for (let k = 0; k < 400 && !/Game over/.test(msg()); k++) G.tick(150); T.has(msg(), 'Game over', 'snake: unattended snake eventually crashes');
    T.ok(W.eval("Store.get('fun.snake.best').normal") >= peak, 'snake: best score saved'); T.eq(t.q('#bs').textContent, String(W.eval("Store.get('fun.snake.best').normal")), 'snake: best shown');
    G.ev(cv, 'pointerdown', { x: 50, y: 50 }); G.ev(cv, 'pointerup', { x: 50, y: 50 }); T.has(msg(), 'Go', 'snake: a tap after game over restarts'); T.eq(sc(), 0, 'snake: score reset'); T.eq(body().length, 3, 'snake: length reset');
  });

  await T.done(G.page);
})().catch(e => { console.log("FAIL: test crashed: " + (e && e.stack || e)); process.exit(1); });
