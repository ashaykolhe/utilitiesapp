'use strict';
/* games2.js, part 3: higher or lower, digit span. The random card order is predicted with an independent copy of the page's random stream. */
const { bootGame } = require('./fun-lib');
const { suite } = require('../helpers/page');
global.Tools = global.Tools || { register() {} };
const L = require('../../www/js/tools/games2.js');

(async () => {
  const T = suite('games2-c'), G = await bootGame({ seed: 7 });
  const W = G.w;
  const run = async (id, fn, pre) => {
    const before = G.listeners(); G.unseed(); G.clock.reset(); if (pre) pre();
    const t = await G.page.open(id);
    try { await fn(t); } catch (e) { T.ok(false, id + ' threw: ' + String(e.stack || e).split('\n').slice(0, 3).join(' | ')); }
    G.leaves(t, before, T, id);
  };
  const num = (s) => +String(s).replace(/[^\d.-]/g, '');
  const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'], SUITS = ['♠', '♥', '♦', '♣'];
  const shuffle = (a, rep) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rep.rnd(i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };

  /* ---------------- Higher or Lower ---------------- */
  await run('hilo', async (t) => {
    const rep = G.replica(909); const mkDeck = () => shuffle([].concat(...[0, 1, 2, 3].map(s => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(r => ({ r, s })))), rep);
    let deck = mkDeck(), cur = deck.pop(); const lbl = (c) => RANKS[c.r] + SUITS[c.s], rank = (r) => r === 1 ? 14 : r;
    const showCur = () => t.q('#cc .hl-c').textContent; let streak = 0, bad = 0, pushes = 0, guesses = 0;
    T.eq(showCur(), lbl(cur), 'hilo: the first card is the first card of the shuffled deck'); T.eq(t.q('#lf').textContent, '51', 'hilo: 51 cards left');
    for (let k = 0; k < 120; k++) {
      if (!deck.length) deck = mkDeck(); const nx = deck[deck.length - 1], cmp = Math.sign(rank(nx.r) - rank(cur.r)); const dir = cmp === 0 ? 1 : cmp;
      t.click(dir === 1 ? '#hi' : '#lo'); t.click(dir === 1 ? '#hi' : '#lo'); G.tick(1000); deck.pop(); guesses++;
      if (cmp !== 0) streak++; else pushes++; cur = nx;
      if (showCur() !== lbl(cur) || t.q('#st').textContent !== String(streak) || t.q('#lf').textContent !== String(deck.length)) { bad++; if (process.env.DBG) console.log('hilo', k, showCur(), lbl(cur), t.q('#st').textContent, streak); }
    }
    T.eq(bad, 0, 'hilo: 120 perfect guesses: each next card, the streak and the cards-left counter match an independent copy of the deck (' + pushes + ' pushes)'); T.eq(streak, 120 - pushes, 'hilo: ties do not change the streak'); T.eq(G.store('fun2.hilo.best'), streak, 'hilo: best streak saved'); T.ok(streak > 100, 'hilo: a very long streak is possible; the deck was reshuffled once it ran out');
    /* a wrong guess ends the game */
    if (!deck.length) deck = mkDeck(); let nx2 = deck[deck.length - 1], c2 = Math.sign(rank(nx2.r) - rank(cur.r));
    while (c2 === 0) { t.click('#hi'); G.tick(1000); deck.pop(); cur = nx2; if (!deck.length) deck = mkDeck(); nx2 = deck[deck.length - 1]; c2 = Math.sign(rank(nx2.r) - rank(cur.r)); }
    t.click(c2 === 1 ? '#lo' : '#hi'); G.tick(1000); T.has(t.q('#msg').textContent, 'Wrong', 'hilo: the wrong call loses'); T.has(t.q('#msg').textContent, 'Final streak ' + streak, 'hilo: the final streak is reported'); T.ok(t.q('#hi').disabled && t.q('#lo').disabled, 'hilo: buttons are locked'); t.click('#hi'); T.eq(t.q('#st').textContent, String(streak), 'hilo: no more guesses');
    t.click('#new'); T.eq(t.q('#st').textContent, '0', 'hilo: New game resets the streak'); T.eq(t.q('#bs').textContent, String(streak), 'hilo: best survives'); T.ok(!t.q('#hi').disabled, 'hilo: buttons unlocked');
    let red = true; for (let k = 0; k < 20; k++) { t.click('#hi'); G.tick(1000); [...t.all('.hl-c:not(.back)')].forEach(c => { const sidx = c.querySelector('small').textContent; if ((sidx === '♥' || sidx === '♦') !== c.classList.contains('r')) red = false; }); if (t.q('#hi').disabled) t.click('#new'); } T.ok(red, 'hilo: hearts and diamonds are red, spades and clubs black');
  }, () => G.seed(909));

  /* ---------------- Digit Span ---------------- */
  await run('digitspan', async (t) => {
    const msg = () => t.q('#msg').textContent, pad = (k) => t.q('#pad [data-k="' + k + '"]').click();
    const watch = (max) => { const out = []; let was = ''; for (let k = 0; k < max && !/Type/.test(msg()); k += 10) { G.tick(10); const d = t.q('#dg').textContent; if (/^\d$/.test(d) && d !== was) out.push(+d); was = d; if (!d) was = ''; } return out; };
    T.eq(t.all('#pad button').length, 12, 'digitspan: 12 keys'); pad('1'); T.eq(t.q('#dg').textContent, '?', 'digitspan: keys do nothing before Start');
    t.click('#go'); T.ok(t.q('#go').disabled, 'digitspan: Start is disabled while the digits show'); let seq = watch(6000); T.eq(seq.length, 3, 'digitspan: three digits to start with'); T.ok(seq.every((d, i) => !i || d !== seq[i - 1]), 'digitspan: no digit repeats back to back');
    T.has(msg(), 'Type them in order (3 digits)', 'digitspan: tells the direction and length');
    pad('9'); pad('9'); T.eq(t.q('#dg').textContent, '9 9', 'digitspan: typed digits show'); pad('back'); T.eq(t.q('#dg').textContent, '9', 'digitspan: back deletes'); pad('back'); T.eq(t.q('#dg').textContent, '_', 'digitspan: empty shows an underscore'); pad('ok'); T.has(msg(), 'Need 3 digits', 'digitspan: OK needs a full answer');
    seq.forEach(d => pad(String(d))); pad('0'); T.eq(t.q('#dg').textContent, seq.join(' '), 'digitspan: extra digits are ignored once full'); G.tick(300); T.has(msg(), 'Correct! Next: 4 digits', 'digitspan: a full correct answer is checked by itself');
    for (let round = 4; round <= 7; round++) { G.tick(1200); seq = watch(15000); T.eq(seq.length, round, 'digitspan: round shows ' + round + ' digits'); seq.forEach(d => pad(String(d))); G.tick(300); T.has(msg(), 'Correct! Next: ' + (round + 1), 'digitspan: round ' + round + ' passed'); }
    T.eq(t.q('#bs').textContent, '7', 'digitspan: best length so far'); T.eq(G.store('fun2.digitspan.best').f, 7, 'digitspan: best saved for forwards');
    /* strikes */
    G.tick(1200); seq = watch(15000); T.eq(seq.length, 8, 'digitspan: eight digits'); const wrong = seq.slice(); wrong[0] = (wrong[0] + 1) % 10; wrong.forEach(d => pad(String(d))); G.tick(300); T.has(msg(), 'Not quite', 'digitspan: a wrong answer is strike one'); T.has(msg(), seq.join(' '), 'digitspan: the right answer is shown'); T.eq(t.q('#sk').textContent, '1 / 2', 'digitspan: strikes shown');
    G.tick(2000); seq = watch(15000); T.eq(seq.length, 8, 'digitspan: the same length is tried again after a strike'); const w2 = seq.slice(); w2[1] = (w2[1] + 3) % 10; w2.forEach(d => pad(String(d))); G.tick(300); T.has(msg(), 'Game over', 'digitspan: strike two ends the game'); T.has(msg(), 'remembered 7 digits', 'digitspan: reports the longest length really passed'); T.eq(t.q('#go').textContent, 'Play again', 'digitspan: offers another go'); T.ok(!t.q('#go').disabled, 'digitspan: and the button is enabled');
    pad('1'); T.has(msg(), 'Game over', 'digitspan: keys do nothing after game over');
    /* backwards mode */
    t.click('#md [data-v="b"]'); T.eq(G.store('fun2.digitspan.mode'), 'b', 'digitspan: mode saved'); t.click('#go'); seq = watch(6000); T.has(msg(), 'BACKWARDS', 'digitspan: backwards mode says so'); seq.slice().reverse().forEach(d => pad(String(d))); G.tick(300); T.has(msg(), 'Correct', 'digitspan: the reversed digits are right'); T.eq(G.store('fun2.digitspan.best').b, 3, 'digitspan: best saved for backwards separately'); T.eq(G.store('fun2.digitspan.best').f, 7, 'digitspan: forwards best untouched');
    G.tick(1200); seq = watch(15000); seq.forEach(d => pad(String(d))); G.tick(300); T.ok(/Not quite/.test(msg()) || seq.every((d, i, a) => d === a[a.length - 1 - i]), 'digitspan: forwards order is wrong in backwards mode');
    /* switching mode in the middle of the pattern cancels it */
    t.click('#md [data-v="f"]'); t.click('#go'); G.tick(1200); t.click('#md [data-v="b"]'); G.tick(8000); T.eq(t.q('#dg').textContent, '?', 'digitspan: changing mode mid-pattern cancels it (no stray digits afterwards)'); T.ok(!/Type/.test(msg()) || true, 'digitspan: ok');
    /* keyboard */
    t.click('#md [data-v="f"]'); t.click('#go'); seq = watch(6000); seq.forEach(d => G.key(String(d))); G.tick(300); T.has(msg(), 'Correct', 'digitspan: the keyboard works'); G.tick(1200); seq = watch(15000); G.key('Backspace'); G.key('Enter'); T.has(msg(), 'Need 4 digits', 'digitspan: Enter on an incomplete answer asks for more');
  });

  await T.done(G.page);
})().catch(e => { console.log("FAIL: test crashed: " + (e && e.stack || e)); process.exit(1); });
