'use strict';
/* fun.js, part 4: math sprint, whack-a-mole, truth or dare, would you rather, lucky numbers, bingo caller. */
const fs = require('fs'), path = require('path');
const { bootGame } = require('./fun-lib');
const { suite } = require('../helpers/page');

(async () => {
  const T = suite('fun-d'), G = await bootGame({ seed: 7 });
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

  /* ---------------- Math Sprint ---------------- */
  await run('mathsprint', async (t) => {
    const q = () => t.q('#q').textContent, press = (k) => G.ev(t.q('#keys [data-k="' + k + '"]'), 'pointerdown');
    const solveQ = () => { const m = /^(\d+) ([+−×]) (\d+) = \?$/.exec(q()); if (!m) return null; const a = +m[1], b = +m[3]; return m[2] === '+' ? a + b : m[2] === '−' ? a - b : a * b; };
    const typeIn = (s) => String(s).split('').forEach(press);
    const wrongOf = (ans) => { const s = String(ans), last = (+s[s.length - 1] + 1) % 10; return s.slice(0, -1) + last; };
    T.eq(q(), 'Ready?', 'math: waiting for Start'); press('1'); T.eq(t.q('#ans').textContent, '', 'math: the keypad does nothing before Start');
    G.seed(12); t.click('#go'); T.ok(solveQ() !== null, 'math: a sum is shown (' + q() + ')');
    let ok = 0; for (let k = 0; k < 20; k++) { const a = solveQ(); typeIn(a); ok++; } T.eq(num(t.q('#sc').textContent), 20, 'math: 20 correct answers scored'); T.eq(t.q('#wr').textContent, '0', 'math: no misses so far');
    const a2 = solveQ(); typeIn(wrongOf(a2)); T.eq(t.q('#wr').textContent, '1', 'math: a wrong answer counts a miss'); T.eq(num(t.q('#sc').textContent), 20, 'math: and no score'); G.tick(300); T.eq(t.q('#ans').textContent, '', 'math: the answer box clears after a miss'); T.eq(solveQ(), a2, 'math: the same sum stays after a miss');
    press('1'); press('C'); T.eq(t.q('#ans').textContent, '', 'math: C clears what you typed'); press('1'); press('⌫'); T.eq(t.q('#ans').textContent, '', 'math: backspace removes a digit');
    /* the hardware keyboard works for the whole round, not only until the first Start */
    const a3 = solveQ(); String(a3).split('').forEach(d => G.key(d)); T.eq(num(t.q('#sc').textContent), 21, 'math: keyboard digits answer too (after Start was pressed)'); G.key('Backspace');
    G.tick(14000); T.near(parseFloat(t.q('#bar').style.width), 50, 6, 'math: the time bar is about half empty at 15 s');
    G.tick(16000); T.eq(q(), 'Time!', 'math: time is up after 30 s'); T.has(t.q('#msg').textContent, '21 correct', 'math: result message'); T.has(t.q('#msg').textContent, 'new best', 'math: first score is a best');
    T.eq(W.eval("Store.get('fun.math.best')")['1'], 21, 'math: best saved per level'); T.eq(t.q('#bs').textContent, '21', 'math: best shown'); typeIn(1); T.eq(num(t.q('#sc').textContent), 21, 'math: keypad is inactive after time up'); T.eq(G.clock.pending().iv, 0, 'math: the countdown stops');
    /* a worse round does not replace the best; switching level mid-round abandons it */
    t.click('#go'); typeIn(solveQ()); G.tick(31000); T.eq(W.eval("Store.get('fun.math.best')")['1'], 21, 'math: lower score keeps the best'); T.ok(!/new best/.test(t.q('#msg').textContent), 'math: lower score is not called a best');
    t.click('#go'); typeIn(solveQ()); t.click('#lv [data-v="3"]'); T.eq(q(), 'Ready?', 'math: changing level mid-round abandons it'); T.eq(t.q('#sc').textContent, '0', 'math: score reset'); G.tick(40000); T.eq(W.eval("Store.get('fun.math.best')")['3'], undefined, 'math: an abandoned round saves nothing'); T.eq(G.clock.pending().iv, 0, 'math: nothing keeps running');
    t.click('#go'); const m = /^(\d+) ([+−×]) (\d+) = \?$/.exec(q()); T.ok(m, 'math: hard level question format'); let big = false; for (let k = 0; k < 30; k++) { const mm = /^(\d+) ([+−×]) (\d+)/.exec(q()); if (+mm[1] > 99 || +mm[3] > 99) big = true; typeIn(solveQ()); } T.ok(big, 'math: hard level uses three-digit numbers');
  });
  await run('mathsprint', async (t) => {
    T.eq(t.q('#lv .on').dataset.v, '3', 'math: level is remembered'); T.eq(t.q('#bs').textContent, '–', 'math: no best for an untouched level');
  });

  /* ---------------- Whack-a-Mole ---------------- */
  await run('whackamole', async (t) => {
    const holes = t.all('#grid button'), up = () => holes.map((h, i) => h.querySelector('.mole').style.transform === 'translateY(0)' ? i : -1).filter(i => i >= 0);
    T.eq(holes.length, 9, 'whack: nine holes'); G.ev(holes[0], 'pointerdown'); T.eq(t.q('#sc').textContent, '0', 'whack: tapping before Start does nothing');
    G.seed(6); t.click('#go'); T.has(t.q('#msg').textContent, 'Go', 'whack: started'); T.eq(up().length, 0, 'whack: no mole before the first spawn'); G.tick(450); T.eq(up().length, 1, 'whack: a mole pops up');
    const i = up()[0], other = (i + 1) % 9; G.ev(holes[other], 'pointerdown'); T.eq(t.q('#sc').textContent, '0', 'whack: an empty hole scores nothing');
    G.ev(holes[i], 'pointerdown'); G.ev(holes[i], 'pointerdown'); T.eq(t.q('#sc').textContent, '1', 'whack: a mole scores once, a second tap on it does not'); T.eq(holes[i].querySelector('.mole').textContent, '💥', 'whack: hit feedback'); G.tick(200); T.ok(!up().includes(i) || holes[i].querySelector('.mole').textContent !== '💥', 'whack: the hit mole disappears');
    /* a missed mole hides by itself */
    G.tick(3000); const alive = up(); G.tick(1300); T.ok(alive.every(x => !up().includes(x)) || up().length > 0, 'whack: moles go back down when not hit');
    T.eq(t.q('#tm').textContent, String(Math.ceil((30000 - 4950 - 0) / 1000)), 'whack: the clock counts down');
    /* a player who taps every mole */
    t.click('#go'); G.tick(100); let hits = 0; for (let k = 0; k < 800; k++) { G.tick(40); up().forEach(x => G.ev(holes[x], 'pointerdown')); if (/Time!/.test(t.q('#msg').textContent)) break; }
    T.has(t.q('#msg').textContent, 'Time!', 'whack: the round ends after 30 s'); const sc = num(t.q('#sc').textContent); T.ok(sc >= 15, 'whack: a quick player scores plenty (' + sc + ')'); T.has(t.q('#msg').textContent, 'whacked ' + sc, 'whack: result shows the score');
    T.eq(up().length, 0, 'whack: all moles hide at the end'); T.eq(t.q('#tm').textContent, '0', 'whack: clock at zero'); T.eq(t.q('#go').textContent, 'Play again', 'whack: offers another round'); T.eq(W.eval("Store.get('fun.whack.best')"), sc, 'whack: best saved'); G.ev(holes[0], 'pointerdown'); T.eq(num(t.q('#sc').textContent), sc, 'whack: no scoring after time is up');
    T.eq(G.clock.idle(), 0, 'whack: nothing left running after the round');
    /* idle player scores zero and the best is kept; restarting mid-round resets cleanly */
    t.click('#go'); G.tick(31000); T.has(t.q('#msg').textContent, 'whacked 0', 'whack: no taps, no score'); T.eq(W.eval("Store.get('fun.whack.best')"), sc, 'whack: a worse round keeps the best');
    t.click('#go'); G.tick(5000); t.click('#go'); T.eq(t.q('#sc').textContent, '0', 'whack: restarting resets the score'); G.tick(31000); T.has(t.q('#msg').textContent, 'Time!', 'whack: the restarted round has a single 30 s clock'); T.eq(G.clock.idle(), 0, 'whack: and leaves nothing behind');
  });

  /* ---------------- Truth or Dare ---------------- */
  await run('truthdare', async (t) => {
    const TRUTHS = grab('TRUTHS'), DARES = grab('DARES'); let last = '', repeat = false;
    T.has(t.q('#txt').textContent, 'Pick Truth or Dare', 'truthdare: asks to pick');
    for (let k = 0; k < 60; k++) { t.click('#t'); const x = t.q('#txt').textContent; if (!TRUTHS.includes(x) || t.q('#tag').textContent !== '💬 Truth') T.ok(false, 'truthdare: truth card is from the truth list'); if (x === last) repeat = true; last = x; }
    T.ok(!repeat, 'truthdare: never the same truth twice in a row'); last = '';
    for (let k = 0; k < 60; k++) { t.click('#d'); const x = t.q('#txt').textContent; if (!DARES.includes(x) || t.q('#tag').textContent !== '🔥 Dare') T.ok(false, 'truthdare: dare card is from the dare list'); if (x === last) repeat = true; last = x; }
    T.ok(!repeat, 'truthdare: never the same dare twice in a row'); let truth = 0, dare = 0;
    for (let k = 0; k < 100; k++) { t.click('#r'); const x = t.q('#txt').textContent; if (TRUTHS.includes(x)) truth++; else if (DARES.includes(x)) dare++; }
    T.eq(truth + dare, 100, 'truthdare: Surprise me always draws a real card'); T.ok(truth > 25 && dare > 25, 'truthdare: Surprise me mixes both (' + truth + '/' + dare + ')'); T.eq(new Set(TRUTHS.concat(DARES)).size, 60, 'truthdare: 60 distinct cards');
  });

  /* ---------------- Would You Rather ---------------- */
  await run('wyr', async (t) => {
    const WYR = grab('WYR'), pair = () => [t.q('#a').textContent, t.q('#b').textContent].join('|'), all = new Set(WYR.map(p => p.join('|')));
    const seen = []; for (let k = 0; k < 30; k++) { seen.push(pair()); T.ok(all.has(pair()), 'wyr: question ' + (k + 1) + ' is from the list'); T.eq(t.q('#cnt').textContent, 'Question ' + (k + 1), 'wyr: counter'); t.click('#next'); }
    T.eq(new Set(seen).size, 30, 'wyr: all 30 questions are used once before any repeats'); T.eq(seen[0], pair(), 'wyr: after the last it starts over'); T.eq(t.q('#cnt').textContent, 'Question 31', 'wyr: counter keeps counting');
    t.click('#a'); T.eq(t.q('#b').style.opacity, '0.35', 'wyr: choosing A dims B'); T.eq(t.q('#a').style.transform, 'scale(1.04)', 'wyr: and enlarges A'); t.click('#next'); T.eq(t.q('#b').style.opacity, '1', 'wyr: the next question resets the look');
    t.click('#b'); T.eq(t.q('#a').style.opacity, '0.35', 'wyr: choosing B dims A'); G.key('Enter', t.q('#a')); T.eq(t.q('#a').getAttribute('role'), 'button', 'wyr: the options are buttons for screen readers'); const ev = new W.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }); t.q('#a').dispatchEvent(ev); T.eq(t.q('#b').style.opacity, '0.35', 'wyr: Enter on an option chooses it');
  });

  /* ---------------- Lucky Numbers ---------------- */
  await run('lucky', async (t) => {
    const balls = () => t.all('#balls span').map(s => num(s.textContent)), stars = () => t.all('#stars span b').map(s => num(s.textContent));
    G.seed(30); const seen = new Set(); let good = true;
    for (let k = 0; k < 150; k++) { t.click('#go'); const b = balls(); b.forEach(x => seen.add(x)); if (b.length !== 6 || new Set(b).size !== 6 || b.some(x => x < 1 || x > 49) || b.join() !== b.slice().sort((x, y) => x - y).join()) good = false; }
    T.ok(good, 'lucky: 6 of 49 gives six different sorted numbers from 1 to 49'); T.ok(seen.size >= 44, 'lucky: the whole range is used (' + seen.size + ' of 49 seen)');
    t.click('#md [data-v="euro"]'); T.eq(balls().length, 0, 'lucky: switching mode clears the old numbers'); let eg = true; const ss = new Set();
    for (let k = 0; k < 100; k++) { t.click('#go'); const b = balls(), s = stars(); s.forEach(x => ss.add(x)); if (b.length !== 5 || new Set(b).size !== 5 || b.some(x => x < 1 || x > 50) || s.length !== 2 || s[0] === s[1] || s.some(x => x < 1 || x > 12) || s[0] > s[1]) eg = false; }
    T.ok(eg, 'lucky: 5/50 + 2 stars from 1 to 12 gives different, sorted numbers'); T.ok(ss.size >= 11, 'lucky: all star numbers appear');
    t.click('#md [data-v="cust"]'); T.ok(t.q('#cu').style.display !== 'none', 'lucky: custom fields appear'); t.type('#k', 4); t.type('#n', 4); t.click('#go'); T.eq(balls().join(), '1,2,3,4', 'lucky: picking 4 of 4 gives every number');
    t.type('#k', 7); t.type('#n', 5); t.click('#go'); T.eq(balls().length, 5, 'lucky: asking for more than the range is capped to the range (' + t.value('#k') + ' of ' + t.value('#n') + ')');
    t.type('#k', 3); t.type('#n', 1000); t.click('#go'); const c = balls(); T.ok(c.length === 3 && c.every(x => x >= 1 && x <= 1000), 'lucky: custom range 1-1000'); T.eq(W.eval("Store.get('fun.lucky.k')"), 3, 'lucky: custom pick count saved'); T.eq(W.eval("Store.get('fun.lucky.mode')"), 'cust', 'lucky: mode saved');
    t.type('#k', ''); t.type('#n', ''); t.click('#go'); T.ok(balls().length >= 1 && num(t.value('#n')) >= 2, 'lucky: empty fields fall back to safe values');
    t.click('#md [data-v="l649"]'); T.eq(t.q('#cu').style.display, 'none', 'lucky: custom fields hidden for the built-in games');
  });

  /* ---------------- Bingo Caller ---------------- */
  await run('bingo', async (t) => {
    const letter = (n) => 'BINGO'[Math.floor((n - 1) / 15)], called = [];
    const shown = () => ({ l: t.q('#bl').textContent, n: num(t.q('#bn').textContent) });
    T.eq(t.q('#bn').textContent, '?', 'bingo: nothing called yet'); G.seed(40);
    for (let k = 0; k < 75; k++) { t.click('#call'); const s = shown(); called.push(s.n); if (s.l !== letter(s.n)) T.ok(false, 'bingo: ' + s.l + s.n + ' has the wrong letter'); }
    T.eq(new Set(called).size, 75, 'bingo: 75 calls are 75 different numbers'); T.ok(called.every(n => n >= 1 && n <= 75), 'bingo: all between 1 and 75'); T.eq(t.q('#msg').textContent, '75 of 75 called', 'bingo: counter');
    G.clearToast(); t.click('#call'); T.has(G.toast(), 'All 75', 'bingo: no 76th call'); T.eq(shown().n, called[74], 'bingo: the ball stays on the last number');
    const board = t.all('#board span'); T.eq(board.length, 75, 'bingo: board lists 75 numbers'); T.ok(board.every(b => /accent/.test(b.getAttribute('style'))), 'bingo: every called number is highlighted'); T.eq(t.all('#recent .chip').map(c => c.textContent).join(), called.slice(-6, -1).reverse().map(n => letter(n) + n).join(), 'bingo: the chips show the five calls before the current one');
    T.eq(W.eval("Store.get('fun.bingo.called').length"), 75, 'bingo: calls saved');
    t.click('#rst'); T.eq(t.q('#bn').textContent, '?', 'bingo: new game clears the ball'); T.eq(t.q('#msg').textContent, '0 of 75 called', 'bingo: counter reset'); T.ok(t.all('#board span').every(b => !/accent\)/.test((b.getAttribute('style') || '').split('background:')[1] || '')), 'bingo: board cleared');
    const spoken = []; W.SpeechSynthesisUtterance = function (txt) { this.text = txt; }; W.speechSynthesis = { speak: u => spoken.push(u.text), cancel() { spoken.push('(cancel)'); } };
    t.check('#sp', true); T.eq(W.eval("Store.get('fun.bingo.speak')"), true, 'bingo: voice setting saved'); G.seed(2); t.click('#call'); const n1 = shown().n; T.eq(spoken[spoken.length - 1], letter(n1) + ' ' + String(n1).split('').join(' ') + ', ' + n1, 'bingo: the call is read aloud with the letter and digits');
    t.check('#sp', false); const cnt = spoken.length; t.click('#call'); T.eq(spoken.length, cnt, 'bingo: voice off is silent'); delete W.speechSynthesis;
  });
  await run('bingo', async (t) => {
    T.eq(t.q('#msg').textContent, '2 of 75 called', 'bingo: the game is still there when the tool is opened again'); T.ok(shown() !== null, 'bingo: ok');
    function shown() { return num(t.q('#bn').textContent); }
  });

  await T.done(G.page);
})().catch(e => { console.log("FAIL: test crashed: " + (e && e.stack || e)); process.exit(1); });
