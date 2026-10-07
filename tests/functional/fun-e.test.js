'use strict';
/* fun.js, part 5: flappy tap, slide puzzle, lights out, trivia quiz, finger chooser, team maker, bottle spinner, word scramble. */
const fs = require('fs'), path = require('path');
const { bootGame } = require('./fun-lib');
const { suite } = require('../helpers/page');

(async () => {
  const T = suite('fun-e'), G = await bootGame({ seed: 7 });
  const W = G.w;
  const run = async (id, fn, pre) => {
    const before = G.listeners(); G.unseed(); G.clock.reset(); if (pre) pre();
    const t = await G.page.open(id);
    try { await fn(t); } catch (e) { T.ok(false, id + ' threw: ' + String(e.stack || e).split('\n').slice(0, 3).join(' | ')); }
    G.leaves(t, before, T, id);
  };
  const num = (s) => +String(s).replace(/[^\d.-]/g, '');
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'www', 'js', 'tools', 'fun.js'), 'utf8');
  const grab = (name) => new Function('return ' + new RegExp('const ' + name + ' = (\\[[\\s\\S]*?\\n?\\]);').exec(src)[1])();

  /* ---------------- Flappy Tap ---------------- */
  await run('flappy', async (t) => {
    const cv = t.q('#cv');
    const frame = () => { const all = G.calls(cv); let k = all.length - 1; while (k > 0 && !(all[k][0] === 'fillRect' && all[k][1].join() === '0,0,360,520')) k--; return all.slice(k); };
    const bird = () => { const f = frame(), i = f.findIndex(c => c[0] === 'fillText' && c[1][0] === '🐦'); let y = null; for (let k = i; k >= 0; k--) if (f[k][0] === 'translate') { y = f[k][1][1]; break; } return y; };
    const pipes = () => { const f = frame().filter(c => c[0] === 'roundRect'); const out = []; for (let i = 0; i + 1 < f.length; i += 2) out.push({ x: f[i][1][0], gy: f[i][1][3] - 10 }); return out; };
    const texts = () => frame().filter(c => c[0] === 'fillText' || c[0] === 'strokeText').map(c => String(c[1][0]));
    G.tick(100); T.ok(texts().includes('Tap to start'), 'flappy: waits for a tap'); const y0 = bird(); G.tick(500); T.ok(Math.abs(bird() - y0) < 30 && bird() > 150 && bird() < 300, 'flappy: the bird hovers before the start (y=' + bird().toFixed(0) + ')');
    G.seed(2); G.ev(cv, 'pointerdown'); G.tick(32); const y1 = bird(); G.tick(400); T.ok(bird() > y1 - 50, 'flappy: gravity pulls the bird down'); for (let k = 0; k < 500 && !texts().includes('Game over'); k++) G.tick(16);
    T.ok(texts().includes('Game over'), 'flappy: falling to the ground ends the game'); T.eq(t.q('#sc').textContent, '0', 'flappy: no score for falling');
    G.ev(cv, 'pointerdown'); T.ok(texts().includes('Game over'), 'flappy: an immediate tap after dying does not restart (so a frantic tap cannot skip the result)'); G.tick(600); G.ev(cv, 'pointerdown'); G.tick(50); T.ok(texts().includes('Tap to start'), 'flappy: a later tap returns to the start screen');
    /* an autopilot flapping at the gap centre passes pipes */
    G.ev(cv, 'pointerdown'); let best = 0, steps = 0, crashed = false;
    for (let k = 0; k < 4000; k++) {
      G.tick(16); steps++; const f = frame(); const y = bird(), ps = pipes().filter(p => p.x + 60 >= 85).sort((a, b) => a.x - b.x), target = ps.length ? ps[0].gy + 75 : 230;
      if (y > target + 12) G.ev(cv, 'pointerdown');
      best = num(t.q('#sc').textContent); if (texts().includes('Game over')) { crashed = true; break; } if (best >= 6) break;
    }
    T.ok(best >= 4, 'flappy: an autopilot passes several pipes (score ' + best + ' after ' + steps + ' frames)'); T.ok(G.sane(cv), 'flappy: every number drawn is finite');
    if (!crashed) { for (let k = 0; k < 4000 && !texts().includes('Game over'); k++) G.tick(16); } T.ok(texts().includes('Game over'), 'flappy: an unattended bird eventually crashes');
    T.ok(W.eval("Store.get('fun.flappy.best')") >= best, 'flappy: best saved'); T.eq(t.q('#bs').textContent, String(W.eval("Store.get('fun.flappy.best')")), 'flappy: best shown');
    G.key(' '); T.ok(true, 'flappy: space key does not throw');
  });

  /* ---------------- Slide Puzzle ---------------- */
  await run('slide15', async (t) => {
    const n = () => num(t.q('#sz') ? 3 : 3), tileIdx = () => { const m = {}; t.all('#board button').forEach(b => { const l = parseFloat(b.style.left), tp = parseFloat(b.style.top); m[+b.dataset.v] = null; b._p = [l, tp]; }); return m; };
    const state = (N) => { const g = new Array(N * N).fill(0); t.all('#board button').forEach(b => { const c = Math.round(parseFloat(b.style.left) / (100 / N)), r = Math.round(parseFloat(b.style.top) / (100 / N)); g[r * N + c] = +b.dataset.v; }); return g; };
    const click = (v) => t.q('#board [data-v="' + v + '"]').click();
    t.click('#n [data-v="3"]'); let g = state(3); T.eq(t.all('#board button').length, 8, 'slide: 3x3 has eight tiles'); T.eq(g.slice().sort().join(), [0, 1, 2, 3, 4, 5, 6, 7, 8].join(), 'slide: every tile appears once');
    const inv = g.filter(Boolean).reduce((a, v, i, arr) => a + arr.slice(i + 1).filter(w => w < v).length, 0); T.eq(inv % 2, 0, 'slide: the shuffle is solvable (even inversions)');
    /* a non-adjacent tile does nothing, an adjacent one slides */
    const z = g.indexOf(0), far = g.findIndex((v, i) => v && Math.abs(((i / 3) | 0) - ((z / 3) | 0)) + Math.abs(i % 3 - z % 3) > 1); click(g[far]); T.eq(t.q('#mv').textContent, '0', 'slide: a tile that is not next to the gap does not move'); T.eq(state(3).join(), g.join(), 'slide: board unchanged');
    const near = g.findIndex((v, i) => v && Math.abs(((i / 3) | 0) - ((z / 3) | 0)) + Math.abs(i % 3 - z % 3) === 1); click(g[near]); T.eq(t.q('#mv').textContent, '1', 'slide: an adjacent tile slides'); const s1 = state(3); T.eq(s1[z], g[near], 'slide: it moves into the gap'); T.eq(s1[near], 0, 'slide: and leaves a gap behind');
    /* solve with breadth-first search */
    const goal = '1,2,3,4,5,6,7,8,0'; const start = state(3); const prev = new Map([[start.join(), null]]); const q = [start];
    for (let k = 0; k < q.length && !prev.has(goal); k++) { const c = q[k], zi = c.indexOf(0), r = (zi / 3) | 0, cc = zi % 3; [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => { const rr = r + dr, c2 = cc + dc; if (rr < 0 || rr > 2 || c2 < 0 || c2 > 2) return; const ni = rr * 3 + c2, nx = c.slice(); nx[zi] = nx[ni]; nx[ni] = 0; if (!prev.has(nx.join())) { prev.set(nx.join(), { from: c, tile: c[ni] }); q.push(nx); } }); }
    T.ok(prev.has(goal), 'slide: the shuffled position is solvable (search found a solution)'); const path2 = []; for (let c = goal; prev.get(c);) { const p = prev.get(c); path2.push(p.tile); c = p.from.join(); } path2.reverse();
    G.tick(2200); path2.forEach(click);
    T.has(t.q('#msg').textContent, 'Solved in ' + (1 + path2.length) + ' moves', 'slide: solved after ' + (1 + path2.length) + ' moves'); T.has(t.q('#msg').textContent, 'new best', 'slide: first solve is a best'); T.eq(W.eval("Store.get('fun.slide.best')")['3'], 1 + path2.length, 'slide: best moves saved'); T.eq(G.clock.pending().iv, 0, 'slide: the clock stops after solving');
    click(1); T.eq(t.q('#mv').textContent, String(1 + path2.length), 'slide: no moves after solving');
    t.click('#new'); T.eq(t.q('#mv').textContent, '0', 'slide: Shuffle resets'); T.eq(t.all('#board button').length, 8, 'slide: new board'); t.click('#n [data-v="4"]'); T.eq(t.all('#board button').length, 15, 'slide: 4x4 has fifteen tiles');
    const g4 = state(4), inv4 = g4.filter(Boolean).reduce((a, v, i, arr) => a + arr.slice(i + 1).filter(w => w < v).length, 0), zr = 4 - (g4.indexOf(0) / 4 | 0); T.eq((inv4 + zr) % 2, 1, 'slide: the 4x4 shuffle is solvable (inversions + blank row parity)');
    /* a long random walk never "solves" by accident without the message matching the board */
    G.seed(3); let ok = true; for (let k = 0; k < 300; k++) { const s = state(4), zi = s.indexOf(0), opts = [zi - 4, zi + 4, zi - 1, zi + 1].filter(i => i >= 0 && i < 16 && !(Math.abs(i - zi) === 1 && ((i / 4 | 0) !== (zi / 4 | 0)))); click(s[opts[Math.floor(G.w.Math.random() * opts.length)]]); const done = /Solved/.test(t.q('#msg').textContent), solved = state(4).join() === '1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,0'; if (done !== solved) ok = false; if (done) break; }
    T.ok(ok, 'slide: the solved message appears exactly when the board is solved');
  });

  /* ---------------- Lights Out ---------------- */
  await run('lightsout', async (t) => {
    const lights = () => t.all('#grid button').map(b => / on$/.test(b.getAttribute('aria-label')) ? 1 : 0), press = (i) => t.q('#grid [data-i="' + i + '"]').click();
    const solutions = (g) => { /* all press sets (over GF(2)) that switch every light off, by Gaussian elimination */
      const N = 25, A = []; for (let r = 0; r < N; r++) { const row = new Array(N + 1).fill(0); row[r] = 1; if (r >= 5) row[r - 5] = 1; if (r < 20) row[r + 5] = 1; if (r % 5 > 0) row[r - 1] = 1; if (r % 5 < 4) row[r + 1] = 1; row[N] = g[r]; A.push(row); }
      const piv = []; let rr = 0; for (let c = 0; c < N && rr < N; c++) { let p = -1; for (let r = rr; r < N; r++) if (A[r][c]) { p = r; break; } if (p < 0) continue; [A[rr], A[p]] = [A[p], A[rr]]; for (let r = 0; r < N; r++) if (r !== rr && A[r][c]) for (let k = c; k <= N; k++) A[r][k] ^= A[rr][k]; piv.push(c); rr++; }
      for (let r = rr; r < N; r++) if (A[r][N]) return [];
      const free = [...Array(N).keys()].filter(c => !piv.includes(c)), out = [];
      for (let m = 0; m < 1 << free.length; m++) { const x = new Array(N).fill(0); free.forEach((c, i) => { x[c] = (m >> i) & 1; }); piv.forEach((c, r) => { let v = A[r][N]; free.forEach(f => { if (A[r][f]) v ^= x[f]; }); x[c] = v; }); out.push(x.map((v, i) => v ? i : -1).filter(i => i >= 0)); }
      return out;
    };
    for (const lv of ['easy', 'med', 'hard']) {
      t.click('#lv [data-v="' + lv + '"]'); const par = num(t.q('#pr').textContent), g = lights(); T.eq(par, { easy: 3, med: 6, hard: 10 }[lv], 'lights: par for ' + lv); T.ok(g.some(Boolean), 'lights: a level is never already solved');
      const sols = solutions(g); T.ok(sols.length > 0, 'lights: ' + lv + ' level is solvable'); const bestSol = sols.reduce((a, b) => b.length < a.length ? b : a); T.ok(bestSol.length <= par, 'lights: it can be solved in ' + bestSol.length + ' presses (par ' + par + ')');
      press(12); T.eq(t.q('#mv').textContent, '1', 'lights: a press counts a move'); const after = lights(); T.ok(after[12] !== g[12] && after[7] !== g[7] && after[17] !== g[17] && after[11] !== g[11] && after[13] !== g[13] && after[0] === g[0], 'lights: a press toggles the light and its four neighbours only');
      t.click('#redo'); T.eq(lights().join(), g.join(), 'lights: Restart level puts the same pattern back'); T.eq(t.q('#mv').textContent, '0', 'lights: moves reset');
      bestSol.forEach(press); T.has(t.q('#msg').textContent, 'Lights out in ' + bestSol.length + ' moves', 'lights: solving shows the move count'); T.ok(lights().every(v => !v), 'lights: every light is off');
      T.eq(W.eval("Store.get('fun.lights.best')")[lv], bestSol.length, 'lights: best moves saved for ' + lv); press(0); T.eq(t.q('#mv').textContent, String(bestSol.length), 'lights: the board is locked after winning');
    }
    t.click('#new'); T.eq(t.q('#mv').textContent, '0', 'lights: New level resets');
  });

  /* ---------------- Trivia Quiz ---------------- */
  await run('quiz', async (t) => {
    const QUIZ = grab('QUIZ'); T.eq(QUIZ.length, 40, 'quiz: 40 questions'); T.eq(new Set(QUIZ.map(q => q[0])).size, 40, 'quiz: no duplicate questions'); T.ok(QUIZ.every(q => q.length === 5 && new Set(q.slice(1)).size === 4 && q.every(s => typeof s === 'string' && s)), 'quiz: every question has one right answer and three different wrong ones');
    const find = () => QUIZ.find(q => q[0] === t.q('#q').textContent), opts = () => t.all('#opts button');
    G.seed(50); const asked = new Set(); let optionsOk = true;
    for (let k = 0; k < 10; k++) {
      const q = find(); T.ok(!!q, 'quiz: question ' + (k + 1) + ' is from the list'); asked.add(q[0]); if (opts().map(b => b.textContent).sort().join('|') !== q.slice(1).sort().join('|')) optionsOk = false;
      T.eq(t.q('#qn').textContent, (k + 1) + '/10', 'quiz: question counter'); T.ok(t.q('#next').hidden, 'quiz: Next is hidden until you answer');
      opts().find(b => b.textContent === q[1]).click(); T.has(t.q('#msg').textContent, 'Correct', 'quiz: right answer is acknowledged'); T.ok(!t.q('#next').hidden, 'quiz: Next appears'); opts().forEach(b => b.click()); T.eq(t.q('#sc').textContent, String(k + 1), 'quiz: answering twice does not score twice');
      T.eq(t.q('#next').textContent, k === 9 ? 'See result' : 'Next ➜', 'quiz: the last question offers the result'); t.click('#next');
    }
    T.ok(optionsOk, 'quiz: the four options are exactly the question\'s answers'); T.eq(asked.size, 10, 'quiz: ten different questions in a round'); T.has(t.q('#q').textContent, '10 / 10 - perfect', 'quiz: a perfect round'); T.eq(W.eval("Store.get('fun.quiz.best')"), 10, 'quiz: best saved'); T.eq(t.q('#next').textContent, 'Play again', 'quiz: offers another round');
    t.click('#next'); T.eq(t.q('#sc').textContent, '0', 'quiz: a new round resets the score'); T.eq(t.q('#qn').textContent, '1/10', 'quiz: back to question 1');
    /* wrong answers */
    for (let k = 0; k < 10; k++) { const q = find(); const wrong = opts().find(b => b.textContent !== q[1]); wrong.click(); if (k === 0) { T.has(t.q('#msg').textContent, 'It was ' + q[1], 'quiz: a wrong answer shows the right one'); T.ok(opts().find(b => b.textContent === q[1]).style.background.includes('ok'), 'quiz: the right option is highlighted green'); } t.click('#next'); }
    T.has(t.q('#q').textContent, '0 / 10', 'quiz: all wrong scores 0'); T.eq(W.eval("Store.get('fun.quiz.best')"), 10, 'quiz: a worse round keeps the best'); T.has(t.q('#q').textContent, 'keep going', 'quiz: encouragement');
    t.click('#next'); for (let k = 0; k < 10; k++) { const q = find(); (k < 7 ? opts().find(b => b.textContent === q[1]) : opts().find(b => b.textContent !== q[1])).click(); t.click('#next'); } T.has(t.q('#q').textContent, '7 / 10 - great job', 'quiz: 7 of 10 is great');
  });

  /* ---------------- Finger Chooser ---------------- */
  await run('fingers', async (t) => {
    const area = t.q('#area'), say = () => t.q('#hint').textContent, dots = () => [...area.children].filter(e => e.id !== 'hint');
    T.has(say(), 'touch and hold', 'fingers: asks everyone to touch');
    G.ev(area, 'pointerdown', { id: 1, x: 50, y: 60 }); T.has(say(), 'more fingers', 'fingers: one finger is not enough'); G.tick(5000); T.eq(dots().length, 1, 'fingers: a lone finger is never chosen');
    G.ev(area, 'pointerdown', { id: 2, x: 150, y: 100 }); T.has(say(), 'Hold still… 3', 'fingers: countdown starts with two fingers'); G.tick(1000); T.has(say(), '2', 'fingers: counts down'); G.ev(area, 'pointermove', { id: 2, x: 200, y: 130 }); T.eq(dots()[1].style.left, '200px', 'fingers: the dot follows the finger');
    G.ev(area, 'pointerup', { id: 2 }); T.has(say(), 'more fingers', 'fingers: lifting a finger cancels the countdown'); G.tick(5000); T.ok(!/Chosen/.test(say()), 'fingers: and nothing is chosen');
    G.ev(area, 'pointerdown', { id: 3, x: 90, y: 200 }); G.tick(3100); T.has(say(), 'Chosen', 'fingers: a winner is chosen after three seconds'); T.eq(dots().filter(d => d.textContent === '🏆').length, 1, 'fingers: exactly one winner'); T.eq(dots().filter(d => d.style.opacity === '0').length, 1, 'fingers: the other finger fades out');
    G.ev(area, 'pointerdown', { id: 9, x: 10, y: 10 }); T.eq(dots().length, 2, 'fingers: new touches are ignored while the result is shown');
    G.ev(area, 'pointerup', { id: 1 }); T.has(say(), 'Chosen', 'fingers: the result stays until everyone lifts'); G.ev(area, 'pointerup', { id: 3 }); T.has(say(), 'touch and hold', 'fingers: all lifted: ready again');
    /* several winners */
    t.click('#w [data-v="2"]'); G.ev(area, 'pointerdown', { id: 1, x: 10, y: 10 }); G.ev(area, 'pointerdown', { id: 2, x: 20, y: 10 }); T.has(say(), 'Need more fingers than winners', 'fingers: two winners need three fingers'); G.ev(area, 'pointerdown', { id: 3, x: 30, y: 10 }); G.tick(3100);
    T.eq(dots().filter(d => d.textContent === '🏆').length, 2, 'fingers: two winners of three'); [1, 2, 3].forEach(id => G.ev(area, 'pointerup', { id }));
    T.eq(W.eval("Store.get('fun.fingers.n')"), 2, 'fingers: winner count saved');
    /* changing the winner count while fingers are down restarts the countdown */
    t.click('#w [data-v="1"]'); [1, 2, 3].forEach(id => G.ev(area, 'pointerdown', { id, x: 10 * id, y: 10 })); G.tick(1500); t.click('#w [data-v="2"]'); T.has(say(), 'Hold still… 3', 'fingers: the countdown restarts when the rule changes'); G.tick(3100); T.eq(dots().filter(d => d.textContent === '🏆').length, 2, 'fingers: with the new rule'); [1, 2, 3].forEach(id => G.ev(area, 'pointerup', { id }));
    /* fairness */
    t.click('#w [data-v="1"]'); G.unseed(); const wins = [0, 0, 0];
    for (let r = 0; r < 240; r++) { [0, 1, 2].forEach(i => G.ev(area, 'pointerdown', { id: 10 + i, x: 30 * i, y: 5 })); G.tick(3100); const ds = dots(); const wi = ds.findIndex(d => d.textContent === '🏆'); if (wi >= 0) wins[wi]++; [0, 1, 2].forEach(i => G.ev(area, 'pointerup', { id: 10 + i })); }
    T.eq(wins.reduce((a, b) => a + b, 0), 240, 'fingers: every round has a winner'); T.ok(wins.every(w => w > 45 && w < 118), 'fingers: three fingers win about equally often (' + wins.join('/') + ')');
  });

  /* ---------------- Team Maker ---------------- */
  await run('teams', async (t) => {
    const teams = () => t.all('#out .card').map(c => [...c.querySelectorAll('.chip')].map(x => x.textContent));
    t.type('#names', 'Ava, Ben\nChloe,  Dev , ava, ,Eli\nFay,Gus,Hal'); t.click('#go'); let tm = teams(); T.eq(tm.length, 2, 'teams: two teams by default'); T.eq(tm.flat().sort().join(), 'Ava,Ben,Chloe,Dev,Eli,Fay,Gus,Hal', 'teams: names are split on commas and lines, trimmed, duplicates (any case) removed, everyone placed once');
    T.ok(Math.abs(tm[0].length - tm[1].length) <= 1, 'teams: sizes differ by at most one (' + tm.map(x => x.length).join('/') + ')');
    T.eq(t.all('#out .card b').map(b => b.textContent).join(), 'Team 1,Team 2', 'teams: teams are numbered');
    for (const k of [3, 4, 5, 6]) { t.click('#k [data-v="' + k + '"]'); t.type('#names', Array.from({ length: 13 }, (_, i) => 'P' + i).join('\n')); t.click('#go'); tm = teams(); T.eq(tm.length, k, 'teams: ' + k + ' teams'); const sz = tm.map(x => x.length); T.ok(Math.max(...sz) - Math.min(...sz) <= 1 && sz.reduce((a, b) => a + b) === 13, 'teams: 13 people split evenly into ' + k + ' (' + sz.join('/') + ')'); }
    t.type('#names', 'Solo'); G.clearToast(); t.click('#go'); T.has(G.toast(), 'Add at least 6 names', 'teams: too few names for the teams is refused');
    t.click('#k [data-v="2"]'); t.type('#names', '<img src=x onerror=alert(1)>, A'); t.click('#go'); T.eq(t.all('#out img').length, 0, 'teams: names are shown as text'); T.eq(teams().flat().sort().join('|'), '<img src=x onerror=alert(1)>|A', 'teams: the markup-like name is kept literally');
    T.eq(W.eval("Store.get('fun.teams.k')"), 2, 'teams: team count saved'); T.has(W.eval("Store.get('fun.teams.names')"), 'img', 'teams: the names are saved'); t.type('#names', Array.from({ length: 80 }, (_, i) => 'N' + i).join(',')); t.click('#go'); T.eq(teams().flat().length, 60, 'teams: at most 60 names');
    G.seed(5); const seen = new Set(); t.type('#names', 'a,b,c,d'); for (let i = 0; i < 40; i++) { t.click('#go'); seen.add(teams().map(x => x.slice().sort().join('')).sort().join('/')); } T.ok(seen.size >= 3, 'teams: each press gives a fresh random split (' + seen.size + ' different results)');
    T.eq(t.q('#names').maxLength, 3000, 'teams: the name box is limited');
  });

  /* ---------------- Bottle Spinner ---------------- */
  await run('bottle', async (t) => {
    G.tick(10); const seats = () => t.all('#ring .seat'), hl = () => seats().findIndex(s => /scale\(1\.4\)/.test(s.getAttribute('style')));
    T.eq(seats().length, 6, 'bottle: six seats by default'); T.eq(hl(), -1, 'bottle: nobody is highlighted before a spin');
    G.seed(15); const hits = new Array(6).fill(0); let consistent = true;
    for (let k = 0; k < 120; k++) {
      t.click('#go'); t.click('#bt'); T.eq(t.q('#msg').textContent, 'Spinning…', 'bottle: spinning'); if (hl() !== -1) consistent = false; G.tick(4400);
      const rot = parseFloat(/rotate\((-?[\d.]+)deg\)/.exec(t.q('#bt').style.transform)[1]), seat = hl(), say = num(t.q('#msg').textContent) - 1;
      /* seat i sits at i x 60 degrees clockwise from the top; the bottle's neck points at rot degrees */
      const exp = Math.round((((rot % 360) + 360) % 360) / 60) % 6; if (seat !== exp || say !== exp) consistent = false; hits[seat]++;
    }
    T.ok(consistent, 'bottle: the announced and highlighted seat is the one the bottle points at'); T.ok(hits.every(h => h > 8), 'bottle: every seat gets chosen (' + hits.join('/') + ')');
    t.click('#n [data-v="2"]'); T.eq(seats().length, 2, 'bottle: two seats'); t.click('#n [data-v="12"]'); T.eq(seats().length, 12, 'bottle: twelve seats'); T.eq(W.eval("Store.get('fun.bottle.n')"), 12, 'bottle: seat count saved');
    t.click('#go'); G.tick(4400); const rot12 = parseFloat(/rotate\((-?[\d.]+)deg\)/.exec(t.q('#bt').style.transform)[1]); T.eq(hl(), Math.round((((rot12 % 360) + 360) % 360) / 30) % 12, 'bottle: the chosen seat is right for 12 seats');
  });

  /* ---------------- Word Scramble ---------------- */
  await run('scramble', async (t) => {
    const WORDS = new Function('return ' + /const WORDS = (\{[\s\S]*?\n\});/.exec(src)[1])(), all = Object.keys(WORDS).reduce((a, k) => a.concat(WORDS[k].map(w => [w, k])), []);
    const tiles = () => t.all('#tiles button'), slots = () => t.all('#slots button'), letters = () => tiles().map(b => b.textContent);
    const wordFor = () => { const L2 = letters().sort().join(''); return all.filter(([w]) => w.split('').sort().join('') === L2).map(x => x[0]); };
    const solve = (w) => { const used = new Set(); w.split('').forEach(ch => { const i = tiles().findIndex((b, k) => b.textContent === ch && !used.has(k)); used.add(i); tiles()[i].click(); }); };
    G.seed(60); const stats0 = W.eval("Store.get('fun.scramble.st')"); T.ok(stats0 == null, 'scramble: nothing saved before the first game');
    let solved = 0; for (let k = 0; k < 12; k++) { const cands = wordFor(); T.ok(cands.length >= 1, 'scramble: the scrambled letters spell a list word'); const shown = letters().join(''); T.ok(!cands.includes(shown) || cands.length > 1, 'scramble: the tiles are not already in order'); solve(cands[0]); T.has(t.q('#msg').textContent, cands[0], 'scramble: solved ' + cands[0]); solved++; G.tick(1200); }
    T.eq(t.q('#sc').textContent, '12', 'scramble: solved counter'); T.eq(t.q('#sk').textContent, '12', 'scramble: streak'); T.eq(W.eval("Store.get('fun.scramble.st').best"), 12, 'scramble: best streak saved');
    /* wrong order */
    const cands = wordFor(), w = cands[0], wrongOrder = w.split('').reverse().join(''); const bad = w === wrongOrder || cands.includes(wrongOrder) ? w.slice(1) + w[0] : wrongOrder; if (!cands.includes(bad)) { solve(bad); T.has(t.q('#msg').textContent, 'Not quite', 'scramble: a wrong arrangement is rejected'); G.tick(600); T.eq(slots().filter(s => s.textContent).length, 0, 'scramble: the slots clear after a miss'); T.eq(t.q('#sk').textContent, '12', 'scramble: a miss does not break the streak'); }
    /* tap a slot to take a letter back, Clear, hint */
    tiles()[0].click(); tiles()[1].click(); T.eq(slots().filter(s => s.textContent).length, 2, 'scramble: letters go into the slots'); slots()[0].click(); T.eq(slots().filter(s => s.textContent).length, 1, 'scramble: tapping a filled slot returns its letter'); t.click('#clr'); T.eq(slots().filter(s => s.textContent).length, 0, 'scramble: Clear empties the slots');
    T.eq(t.q('#cat').textContent, '?', 'scramble: the category is hidden at first'); t.click('#hint'); const cat = t.q('#cat').textContent; T.ok(wordFor().some(x => WORDS[cat].includes(x)), 'scramble: the hint names the right category (' + cat + ')');
    /* skip */
    const sw = wordFor()[0]; t.click('#skip'); T.has(t.q('#msg').textContent, 'It was', 'scramble: Skip reveals the word'); T.eq(t.q('#sk').textContent, '0', 'scramble: skipping resets the streak'); tiles()[0].click(); T.eq(slots().filter(s => s.textContent).length, 0, 'scramble: no input while the answer is shown'); t.click('#skip'); G.tick(1100); T.has(t.q('#msg').textContent, 'Tap the letters', 'scramble: a new word follows'); T.eq(t.q('#bs').textContent, '12', 'scramble: best streak kept after a reset');
    T.eq(letters().length >= 5, true, 'scramble: next word has tiles');
  });

  await T.done(G.page);
})().catch(e => { console.log("FAIL: test crashed: " + (e && e.stack || e)); process.exit(1); });
