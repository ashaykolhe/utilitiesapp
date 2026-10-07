'use strict';
/* games2.js, part 6: the improvements (restart confirmations, background time, confetti, live regions, digit span wording, old-WebView drawing). */
const { bootGame } = require('./fun-lib');
const { suite } = require('../helpers/page');
global.Tools = global.Tools || { register() {} };
const L = require('../../www/js/tools/games2.js');

(async () => {
  const T = suite('games2-f'), G = await bootGame({ seed: 7 });
  const W = G.w;
  const run = async (id, fn, pre) => {
    const before = G.listeners(); G.unseed(); G.clock.reset(); if (pre) pre();
    const t = await G.page.open(id);
    try { await fn(t); } catch (e) { T.ok(false, id + ' threw: ' + String(e.stack || e).split('\n').slice(0, 3).join(' | ')); }
    G.leaves(t, before, T, id);
  };
  const num = (s) => +String(s).replace(/[^\d.-]/g, '');
  let asked = 0, answer = true; W.confirm = () => { asked++; return answer; };
  const mins = (t) => { const m = /(\d+):(\d+)/.exec(t.q('#tm').textContent); return +m[1] * 60 + +m[2]; };

  /* every result line is announced; no tool leaves its drawing unchecked */
  for (const id of ['dailychal', 'wordguess', 'mastermind', 'pegsol', 'nonogram', 'blockstack', 'breakout', 'pong', 'dodge', 'gemmatch', 'dotsboxes', 'reversi', 'stroop', 'mazerun', 'balanceball', 'game24', 'hilo', 'digitspan', 'typingfalls']) {
    await run(id, async (t) => { const m = t.all('.msg'); T.ok(m.length === 0 || m.every(x => x.getAttribute('role') === 'status' && x.getAttribute('aria-live') === 'polite'), id + ': result lines are announced to screen readers'); });
  }

  /* ---------------- restart confirmations ---------------- */
  await run('wordguess', async (t) => {
    const w = t.all('#grid > div'); asked = 0; answer = false; t.click('#new'); T.eq(asked, 0, 'wordguess: no question before the first guess');
    'crane'.split('').forEach(c => G.key(c)); G.key('Enter'); G.tick(1000); t.click('#new'); T.eq(asked, 1, 'wordguess: New word asks once you have guessed'); T.ok(t.all('#grid > div')[0].children[0].textContent === 'c', 'wordguess: no keeps your guesses'); answer = true; t.click('#new'); T.eq(t.all('#grid > div')[0].children[0].textContent, '', 'wordguess: yes starts a new word'); void w;
  }, () => G.queue([5 / 4294967296]));
  await run('mastermind', async (t) => {
    asked = 0; answer = false; t.click('#new'); T.eq(asked, 0, 'mastermind: no question before a guess'); [0, 1, 2, 3].forEach(c => t.click('#pal [data-c="' + c + '"]')); t.click('#ok'); asked = 0; t.click('#new'); T.eq(asked, 1, 'mastermind: asks after a guess'); T.eq(t.q('#tl').textContent, '9', 'mastermind: no keeps the game');
    t.click('#lv [data-v="2"]'); T.eq(t.q('#lv .on').dataset.v, '1', 'mastermind: no keeps the level'); T.eq(t.all('#pal button').length, 6, 'mastermind: and the colours'); answer = true; t.click('#lv [data-v="2"]'); T.eq(t.all('#pal button').length, 8, 'mastermind: yes switches');
  });
  await run('pegsol', async (t) => {
    asked = 0; answer = false; t.click('#new'); T.eq(asked, 0, 'pegsol: no question before the first jump'); t.q('#bd [data-i="10"]').click(); t.q('#bd [data-i="24"]').click(); asked = 0; t.click('#new'); T.eq(asked, 1, 'pegsol: asks after a jump'); T.eq(t.q('#pg').textContent, '31', 'pegsol: no keeps the game'); answer = true; t.click('#new'); T.eq(t.q('#pg').textContent, '32', 'pegsol: yes restarts');
  });
  await run('nonogram', async (t) => {
    const td = (r, c) => t.q('td.c[data-r="' + r + '"][data-c="' + c + '"]'); asked = 0; answer = false; t.click('#new'); T.eq(asked, 0, 'nonogram: no question for an empty grid'); t.click('#clr'); T.eq(asked, 0, 'nonogram: Clear asks nothing on an empty grid');
    G.ev(td(2, 2), 'pointerdown'); G.ev(W, 'pointerup'); asked = 0; t.click('#clr'); T.eq(asked, 1, 'nonogram: Clear asks once cells are filled'); T.eq(t.all('td.c.f').length, 1, 'nonogram: no keeps the cells'); t.click('#new'); T.eq(asked, 2, 'nonogram: Next puzzle asks'); t.click('#sz [data-v="10"]'); T.eq(t.all('td.c').length, 25, 'nonogram: no keeps the size'); T.eq(t.q('#sz .on').dataset.v, '5', 'nonogram: and the selection'); t.click('#sr [data-v="rnd"]'); T.eq(t.q('#sr .on').dataset.v, 'pic', 'nonogram: and the puzzle source');
    answer = true; t.click('#clr'); T.eq(t.all('td.c.f').length, 0, 'nonogram: yes clears');
    G.ev(td(2, 2), 'pointerdown'); G.ev(W, 'pointerup'); G.tick(3000); G.setHidden(true); G.tick(240000); G.setHidden(false); G.tick(1000); T.ok(mins(t) <= 6, 'nonogram: the clock ignores time in the background (' + t.q('#tm').textContent + ')');
  });
  await run('gemmatch', async (t) => {
    const N = 8, gems = () => t.all('#bd .gm-g'); const board = () => { const b = new Array(64).fill(-1); gems().forEach(g => { b[Math.round(parseFloat(g.style.top) / 12.5) * 8 + Math.round(parseFloat(g.style.left) / 12.5)] = +g.dataset.t; }); return b; };
    const matches = (b) => { const s = new Set(); for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const v = b[r * N + c]; let k = c; while (k < N && b[r * N + k] === v) k++; if (k - c >= 3) for (let i = c; i < k; i++) s.add(r * N + i); k = r; while (k < N && b[k * N + c] === v) k++; if (k - r >= 3) for (let i = r; i < k; i++) s.add(i * N + c); } return s; };
    G.seed(3); t.click('#new'); asked = 0; answer = false; t.click('#new'); T.eq(asked, 0, 'gems: no question before the first move'); const b = board(); let mv = null; for (let i = 0; i < 64 && !mv; i++) { for (const j of [i + 1, i + 8]) { if (j > 63 || (j === i + 1 && i % 8 === 7)) continue; const x = b.slice(); x[i] = b[j]; x[j] = b[i]; if (matches(x).size) { mv = [i, j]; break; } } }
    const at = (i) => gems().find(g => Math.round(parseFloat(g.style.left) / 12.5) === i % 8 && Math.round(parseFloat(g.style.top) / 12.5) === ((i / 8) | 0)); [mv[0], mv[1]].forEach(i => { G.ev(at(i), 'pointerdown', { x: 5, y: 5 }); G.ev(t.q('#bd'), 'pointerup', { x: 5, y: 5 }); }); await G.advance(4000);
    asked = 0; t.click('#new'); T.eq(asked, 1, 'gems: New game asks after a move'); T.eq(t.q('#mv').textContent, '29', 'gems: no keeps the game'); answer = true; t.click('#new'); T.eq(t.q('#mv').textContent, '30', 'gems: yes starts over');
  });
  await run('dotsboxes', async (t) => {
    asked = 0; answer = false; t.click('#new'); T.eq(asked, 0, 'dots: no question on an empty board'); t.q('#svg [data-e="0"]').dispatchEvent(new W.MouseEvent('click', { bubbles: true })); asked = 0; t.click('#new'); T.eq(asked, 1, 'dots: asks after a line is drawn'); t.click('#sz [data-v="3"]'); T.eq(t.q('#sz .on').dataset.v, '4', 'dots: no keeps the grid size'); answer = true; G.tick(1500); t.click('#sz [data-v="3"]'); T.eq(t.q('#sz .on').dataset.v, '3', 'dots: yes changes it');
  });
  await run('reversi', async (t) => {
    asked = 0; answer = false; t.click('#new'); T.eq(asked, 0, 'reversi: no question at the start'); t.q('#bd [data-i="19"]').click(); G.tick(1500); asked = 0; t.click('#new'); T.eq(asked, 1, 'reversi: asks after moves'); T.ok(num(t.q('#bk').textContent) + num(t.q('#wh').textContent) > 5, 'reversi: no keeps the game'); answer = true; t.click('#new'); T.eq(t.q('#bk').textContent + t.q('#wh').textContent, '22', 'reversi: yes restarts');
  });
  await run('mazerun', async (t) => {
    asked = 0; answer = false; t.click('#nw'); T.eq(asked, 0, 'maze: no question before running'); for (const k of ['ArrowRight', 'ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) G.key(k); G.tick(300);
    const tm = t.q('#tm').textContent; asked = 0; t.click('#nw'); T.ok(asked <= 1, 'maze: New maze asks at most once'); answer = true;
    for (const k of ['ArrowRight', 'ArrowDown']) G.key(k); G.tick(3000); G.setHidden(true); G.tick(300000); G.setHidden(false); G.tick(1000); T.ok(mins(t) <= 8, 'maze: the clock ignores time in the background (' + t.q('#tm').textContent + ')'); void tm;
  });
  await run('game24', async (t) => {
    const cards = () => t.all('#cards button'); cards()[0].click(); t.q('#ops [data-o="+"]').click(); cards()[1].click(); G.tick(3000); G.setHidden(true); G.tick(300000); G.setHidden(false); G.tick(1000); T.ok(mins(t) <= 5, '24: the clock ignores time in the background (' + t.q('#tm').textContent + ')');
  });
  await run('stroop', async (t) => {
    t.click('#go'); G.tick(10000); G.setHidden(true); G.tick(10000); G.setHidden(false); G.tick(300); T.ok(num(t.q('#tl').textContent) >= 19 && num(t.q('#tl').textContent) <= 21, 'stroop: ten seconds in the background are not taken off the clock (' + t.q('#tl').textContent + ' s left)'); G.tick(21000); T.has(t.q('#msg').textContent, 'accurate', 'stroop: the round still ends');
  });

  /* ---------------- confetti ---------------- */
  await run('wordguess', async (t) => {
    'apple'.split('').forEach(c => G.key(c)); G.key('Enter'); T.eq(t.all('.cf').length, 0, 'confetti: not before the result is shown'); G.tick(1500); T.eq(t.all('.cf i').length, 16, 'confetti: a burst when the word is guessed'); G.tick(2500); T.eq(t.all('.cf').length, 0, 'confetti: it removes itself');
  }, () => G.queue([L.WORDS.indexOf('apple') / 4294967296]));
  await run('wordguess', async (t) => { 'zebra'.split('').forEach(c => G.key(c)); G.key('Enter'); G.tick(1500); T.eq(t.all('.cf').length, 0, 'confetti: none after a loss or a wrong guess'); }, () => G.queue([L.WORDS.indexOf('apple') / 4294967296]));
  await run('mastermind', async (t) => { [0, 1, 2, 3].forEach(c => t.click('#pal [data-c="' + c + '"]')); t.click('#ok'); T.eq(t.all('.cf i').length, 16, 'confetti: cracking the code'); }, () => { G.setStore('fun2.mastermind.lv', 1); G.queue([0, 1 / 4294967296, 2 / 4294967296, 3 / 4294967296]); });
  await run('mastermind', async (t) => { [0, 1, 2, 3].forEach(c => t.click('#pal [data-c="' + c + '"]')); t.click('#ok'); T.eq(t.all('.cf').length, 0, 'confetti: reduced motion switches it off'); }, () => { G.setStore('fun2.mastermind.lv', 1); G.queue([0, 1 / 4294967296, 2 / 4294967296, 3 / 4294967296]); W.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} }); });
  W.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

  /* ---------------- digit span wording ---------------- */
  await run('digitspan', async (t) => {
    const msg = () => t.q('#msg').textContent, pad = (k) => t.q('#pad [data-k="' + k + '"]').click();
    const watch = () => { const out = []; let was = ''; for (let k = 0; k < 6000 && !/Type/.test(msg()); k += 10) { G.tick(10); const d = t.q('#dg').textContent; if (/^\d$/.test(d) && d !== was) out.push(+d); was = /^\d$/.test(d) ? d : ''; } return out; };
    t.click('#go'); let seq = watch(); seq.map(d => (d + 1) % 10).forEach(d => pad(String(d))); G.tick(300); T.has(msg(), 'Not quite', 'digitspan: first strike'); G.tick(2000); seq = watch(); seq.map(d => (d + 1) % 10).forEach(d => pad(String(d))); G.tick(300);
    T.has(msg(), 'Game over', 'digitspan: second strike'); T.has(msg(), 'remembered 0 digits', 'digitspan: failing the first round does not claim any digits were remembered'); T.eq(t.q('#bs').textContent, '0', 'digitspan: and the best stays 0');
    t.click('#go'); seq = watch(); seq.forEach(d => pad(String(d))); G.tick(300); G.tick(1200); seq = watch(); seq.map(d => (d + 1) % 10).forEach(d => pad(String(d))); G.tick(300); G.tick(2000); seq = watch(); seq.map(d => (d + 1) % 10).forEach(d => pad(String(d))); G.tick(300); T.has(msg(), 'remembered 3 digits in a row', 'digitspan: passing one round then failing twice reports 3');
    t.click('#go'); seq = watch(); G.tick(10); t.click('#md [data-v="b"]'); t.click('#md [data-v="f"]'); t.click('#go'); seq = watch(); seq.forEach(d => pad(String(d))); G.tick(300); T.has(msg(), 'Correct', 'digitspan: switching mode and starting again begins a clean run');
  });

  /* ---------------- drawing without ctx.roundRect (older WebView) ---------------- */
  G.noRoundRect = true;
  for (const id of ['blockstack', 'breakout', 'pong', 'typingfalls']) {
    await run(id, async (t) => {
      const o = t.el.querySelector('.ov'); o.click(); G.tick(600); for (let k = 0; k < 20; k++) { G.key('ArrowLeft'); G.key('ArrowUp'); G.tick(100); } G.tick(2000);
      const cv = t.q('#cv'); T.ok(G.calls(cv).some(c => c[0] === 'rect') && G.calls(cv).every(c => c[0] !== 'roundRect'), id + ': draws plain rectangles when ctx.roundRect is missing'); T.ok(G.sane(cv), id + ': and stays finite');
    });
  }
  G.noRoundRect = false;

  await T.done(G.page);
})().catch(e => { console.log('FAIL: test crashed: ' + (e && e.stack || e)); process.exit(1); });
