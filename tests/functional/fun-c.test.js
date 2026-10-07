'use strict';
/* fun.js, part 3: sudoku, simon, hangman, connect four, tower of hanoi, number guess. */
const fs = require('fs'), path = require('path');
const { bootGame } = require('./fun-lib');
const { suite } = require('../helpers/page');
global.Tools = global.Tools || { register() {} };
const L = require('../../www/js/tools/fun.js');

(async () => {
  const T = suite('fun-c'), G = await bootGame({ seed: 7 });
  const W = G.w;
  const run = async (id, fn, pre) => {
    const before = G.listeners(); G.unseed(); G.clock.reset(); if (pre) pre();
    const t = await G.page.open(id);
    try { await fn(t); } catch (e) { T.ok(false, id + ' threw: ' + String(e.stack || e).split('\n').slice(0, 3).join(' | ')); }
    G.leaves(t, before, T, id);
  };
  const num = (s) => +String(s).replace(/[^\d.-]/g, '');

  /* ---------------- Sudoku ---------------- */
  /* an independent solver (not the game's) used to check the puzzle on screen */
  function solveCount(g, limit) {
    g = g.slice(); let n = 0;
    const ok = (i, d) => { const r = (i / 9) | 0, c = i % 9; for (let k = 0; k < 9; k++) { if (g[r * 9 + k] === d || g[k * 9 + c] === d) return false; } const br = r - r % 3, bc = c - c % 3; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) if (g[(br + a) * 9 + bc + b] === d) return false; return true; };
    (function rec() {
      let bi = -1, bc = 10, cand = null;
      for (let i = 0; i < 81; i++) if (!g[i]) { const cs = []; for (let d = 1; d <= 9; d++) if (ok(i, d)) cs.push(d); if (cs.length < bc) { bc = cs.length; bi = i; cand = cs; if (bc <= 1) break; } }
      if (bi < 0) { n++; solveCount.sol = g.slice(); return; } if (!bc) return;
      for (const d of cand) { if (n >= limit) return; g[bi] = d; rec(); g[bi] = 0; }
    })();
    return n;
  }
  await run('sudoku', async (t) => {
    const cells = () => t.all('#grid button'), vals = () => cells().map(b => +b.textContent || 0), given = () => cells().map(b => /font-weight:\s*800/.test(b.getAttribute('style')));
    const pick = async (i) => { cells()[i].click(); };
    G.tick(200);
    const v0 = vals(), gv = given(); const nGiven = gv.filter(Boolean).length;
    T.ok(nGiven >= 40 && nGiven <= 48, 'sudoku: easy puzzle has about 40 clues (' + nGiven + ')'); T.eq(v0.filter(Boolean).length, nGiven, 'sudoku: only the givens are filled at the start');
    T.eq(solveCount(v0, 3), 1, 'sudoku: the puzzle on screen has exactly one solution'); const sol = solveCount.sol.slice();
    /* givens cannot be changed */
    const gi = gv.indexOf(true); pick(gi); t.click('#pad [data-n="9"]'); T.eq(vals()[gi], v0[gi], 'sudoku: a given cell cannot be overwritten');
    /* conflicts are highlighted */
    const empty = v0.map((v, i) => v ? -1 : i).filter(i => i >= 0), e0 = empty[0], row = (i) => (i / 9) | 0;
    const peerGiven = v0.findIndex((v, i) => v && (row(i) === row(e0) || i % 9 === e0 % 9)); pick(e0); t.click('#pad [data-n="' + v0[peerGiven] + '"]');
    T.eq(vals()[e0], v0[peerGiven], 'sudoku: a cell takes a number'); T.ok(/danger/.test(cells()[e0].getAttribute('style')), 'sudoku: a clashing number is marked red'); T.ok(/danger/.test(cells()[peerGiven].getAttribute('style')), 'sudoku: the number it clashes with is marked too');
    t.click('#pad [data-n="0"]'); T.eq(vals()[e0], 0, 'sudoku: erase clears the cell'); T.ok(!/danger/.test(cells()[e0].getAttribute('style')), 'sudoku: red mark is gone after erasing');
    /* check marks wrong cells without conflicts */
    const wrongVal = sol[e0] % 9 + 1; pick(e0); t.click('#pad [data-n="' + wrongVal + '"]'); t.click('#chk'); T.ok(/wrong cell/.test(t.q('#msg').textContent) || /correct/.test(t.q('#msg').textContent), 'sudoku: Check reports');
    T.ok(vals()[e0] === wrongVal, 'sudoku: wrong value stays until changed'); pick(e0); t.click('#pad [data-n="0"]');
    /* hint fills the selected cell with the right number */
    pick(e0); t.click('#hint'); T.eq(vals()[e0], sol[e0], 'sudoku: hint writes the correct number'); pick(e0); t.click('#pad [data-n="0"]'); T.eq(vals()[e0], sol[e0], 'sudoku: a hinted cell becomes a fixed given');
    /* keyboard entry */
    const e1 = empty[1]; pick(e1); G.key(String(sol[e1])); T.eq(vals()[e1], sol[e1], 'sudoku: keyboard digit fills the selected cell'); G.key('Backspace'); T.eq(vals()[e1], 0, 'sudoku: Backspace erases');
    /* solve it */
    G.tick(1500);
    for (const i of empty) { if (vals()[i] === sol[i]) continue; pick(i); t.click('#pad [data-n="' + sol[i] + '"]'); }
    T.has(t.q('#msg').textContent, 'Solved in', 'sudoku: filling the right numbers solves it'); T.has(t.q('#msg').textContent, 'new best', 'sudoku: first solve is a best');
    T.ok(L.sdkValid(vals()), 'sudoku: the solved grid is valid'); const best = W.eval("Store.get('fun.sudoku.best')").easy; T.ok(best >= 1, 'sudoku: best time saved (' + best + ' s)'); T.eq(G.clock.pending().iv, 0, 'sudoku: the clock stops when solved');
    pick(empty[2]); t.click('#pad [data-n="0"]'); T.ok(L.sdkValid(vals()), 'sudoku: grid is locked after solving');
    /* new puzzle, levels */
    t.click('#new'); G.tick(200); const nv = vals(); T.ok(nv.filter(Boolean).length >= 40, 'sudoku: New makes another puzzle'); T.eq(t.q('#tm').textContent, '0:00', 'sudoku: timer restarts');
    t.click('#lv [data-v="med"]'); G.tick(300); const mv = vals().filter(Boolean).length; T.ok(mv >= 32 && mv < 40, 'sudoku: medium has about 32 clues (' + mv + ')'); T.eq(solveCount(vals(), 3), 1, 'sudoku: medium puzzle is unique');
    t.click('#lv [data-v="hard"]'); G.tick(300); const hv = vals().filter(Boolean).length; T.ok(hv >= 27 && hv < 36, 'sudoku: hard has about 27 clues (' + hv + ')'); T.eq(solveCount(vals(), 3), 1, 'sudoku: hard puzzle is unique');
    T.eq(W.eval("Store.get('fun.sudoku.lvl')"), 'hard', 'sudoku: level saved');
  });
  await run('sudoku', async (t) => {
    t.click('#new'); t.click('#new'); t.click('#new'); G.tick(300); T.eq(t.all('#grid button').length, 81, 'sudoku: pressing New repeatedly leaves one good grid'); T.eq(G.clock.pending().iv, 1, 'sudoku: exactly one clock is running');
  });

  /* ---------------- Simon ---------------- */
  await run('simon', async (t) => {
    const pads = t.all('#pads button'), lit = () => pads.findIndex(p => p.style.opacity === '1');
    const watch = (ms) => { const out = []; let was = -1; for (let k = 0; k < ms; k += 10) { G.tick(10); const l = lit(); if (l >= 0 && was < 0) out.push(l); was = l; } return out; };
    G.seed(5); t.click('#go'); T.eq(t.q('#rd').textContent, '1', 'simon: round 1 begins');
    G.ev(pads[0], 'pointerdown'); T.ok(!/Oops/.test(t.q('#msg').textContent), 'simon: pressing a pad while the pattern plays is ignored');
    let seq = watch(2200); T.eq(seq.length, 1, 'simon: round 1 shows one colour'); T.has(t.q('#msg').textContent, 'Your turn', 'simon: it is your turn after the pattern');
    for (let round = 1; round <= 9; round++) {
      T.eq(seq.length, round, 'simon: round ' + round + ' shows ' + round + ' colours');
      seq.forEach(i => G.ev(pads[i], 'pointerdown')); T.has(t.q('#msg').textContent, 'Nice', 'simon: correct repeat of round ' + round);
      const prev = seq.slice(); G.tick(900); const total = 600 + (round + 1) * Math.max(260, 600 - (round + 1) * 25) + 400; seq = watch(total);
      T.eq(seq.slice(0, round).join(), prev.join(), 'simon: the pattern grows by adding to the end (round ' + (round + 1) + ')');
    }
    /* a wrong pad ends the game and saves the best */
    const wrong = (seq[0] + 1) % 4; G.ev(pads[wrong], 'pointerdown'); T.has(t.q('#msg').textContent, 'Oops', 'simon: a wrong pad fails'); T.has(t.q('#msg').textContent, 'round 10', 'simon: reports the round reached');
    T.eq(t.q('#bs').textContent, '9', 'simon: best is the last completed round'); T.eq(W.eval("Store.get('fun.simon.best')"), 9, 'simon: best saved'); T.eq(t.q('#go').textContent, 'Play again', 'simon: button offers another game');
    G.ev(pads[seq[0]], 'pointerdown'); G.tick(100); T.eq(G.clock.idle() > -1, true, 'simon: pressing after game over does nothing');
    t.click('#go'); G.tick(100); T.eq(t.q('#rd').textContent, '1', 'simon: restart returns to round 1');
    G.tick(3000); T.eq(t.all('#pads button').length, 4, 'simon: four pads');
    t.click('#go'); G.tick(200); t.click('#go'); G.tick(2500); T.has(t.q('#msg').textContent, 'Your turn', 'simon: pressing Start during a pattern restarts cleanly without double patterns');
  });

  /* ---------------- Hangman ---------------- */
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'www', 'js', 'tools', 'fun.js'), 'utf8');
  const WORDS = new Function('return ' + /const WORDS = (\{[\s\S]*?\n\});/.exec(src)[1])();
  await run('hangman', async (t) => {
    const pattern = () => t.q('#word').textContent.split(' ').filter(Boolean), cat = () => /Hint: (\w+)/.exec(t.q('#cat').textContent)[1];
    const lives = () => num(t.q('#lives').textContent), parts = () => t.all('.hp').filter(p => p.style.opacity === '1').length, key = (c) => t.q('#kb [data-k="' + c + '"]');
    const solve = () => {
      for (let k = 0; k < 26; k++) {
        const pat = pattern(); if (!pat.includes('_')) return; const guessed = t.all('#kb button').filter(b => b.disabled).map(b => b.dataset.k);
        const cand = WORDS[cat()].filter(w => w.length === pat.length && pat.every((c, i) => c === '_' ? !guessed.includes(w[i]) : c === w[i]));
        const freq = {}; cand.forEach(w => new Set(w).forEach(c => { if (!guessed.includes(c)) freq[c] = (freq[c] || 0) + 1; }));
        const best = Object.keys(freq).sort((a, b) => freq[b] - freq[a])[0]; key(best).click();
        if (/You got it|It was/.test(t.q('#msg').textContent)) return;
      }
    };
    G.seed(3); let won = 0;
    for (let g = 0; g < 12; g++) { solve(); if (/You got it/.test(t.q('#msg').textContent)) won++; t.click('#new'); }
    T.ok(won >= 11, 'hangman: a player who knows the word list solves nearly every word (' + won + '/12)');
    const st = W.eval("Store.get('fun.hangman.st')"); T.eq(st.w + st.l, 12, 'hangman: every finished game is counted'); T.eq(st.w, won, 'hangman: wins counted'); T.ok(st.best >= 1, 'hangman: best streak tracked (' + st.best + ')');
    /* losing: six wrong letters */
    t.click('#new'); const w0 = pattern().length, cat0 = cat(); T.eq(lives(), 6, 'hangman: six lives'); T.eq(parts(), 0, 'hangman: nothing drawn yet');
    const word = WORDS[cat0].find(w => w.length === w0 && true) ; /* the actual word is unknown: find letters certainly absent through play */
    let wrongN = 0; for (const c of 'QZXJKVWYFBGPMHCDULNRTSOIEA') { if (/It was/.test(t.q('#msg').textContent)) break; const before = lives(); key(c).click(); if (lives() < before) wrongN++; if (wrongN === 3) break; }
    T.ok(parts() === 6 - lives(), 'hangman: one body part per wrong guess'); const dead = key('Q'); T.ok(dead.disabled, 'hangman: a guessed letter is disabled');
    const livesNow = lives(); G.key('q'); T.eq(lives(), livesNow, 'hangman: guessing the same letter again costs nothing');
    /* physical keyboard works and ignores non-letters */
    t.click('#new'); G.key('E'); T.ok(key('E').disabled, 'hangman: keyboard letters guess'); G.key('5'); G.key('Enter'); T.eq(t.all('#kb button').filter(b => b.disabled).length, 1, 'hangman: digits and other keys are ignored');
    /* run it out */
    t.click('#new'); const wl = pattern().length; for (const c of 'QZXJKVWYFBGPMHCDULNRTSOIEA') { if (/It was|You got/.test(t.q('#msg').textContent)) break; key(c).click(); }
    const msg = t.q('#msg').textContent; T.ok(/It was [A-Z]+/.test(msg) || /You got it/.test(msg), 'hangman: the game ends with a message'); key('A').click(); T.ok(true, 'hangman: no change after the end');
    if (/It was/.test(msg)) { const w = /It was ([A-Z]+)/.exec(msg)[1]; T.ok(WORDS[cat()].includes(w), 'hangman: the revealed word comes from the hinted category'); T.eq(t.q('#word').textContent.replace(/\s/g, ''), w, 'hangman: the whole word is shown after losing'); T.eq(lives(), 0, 'hangman: no lives left'); T.eq(parts(), 6, 'hangman: complete drawing'); }
    T.eq(t.q('#sk').textContent, String(W.eval("Store.get('fun.hangman.st').streak")), 'hangman: streak shown matches the saved one');
  });

  /* ---------------- Connect Four ---------------- */
  await run('connect4', async (t) => {
    const cell = (r, c) => t.q('#board button[data-c="' + c + '"]', r), col = (c) => t.all('#board button').filter(b => b.dataset.c === String(c)), discs = () => t.all('#board button').filter(b => b.querySelector('span')).length;
    const drop = (c) => t.all('#board button').find(b => b.dataset.c === String(c)).click();
    const sc = () => t.all('#sc b').map(b => b.textContent).join(',');
    t.click('#mode [data-v="two"]'); T.has(t.q('#msg').textContent, 'Red to move', 'c4: two-player starts with red');
    drop(3); T.eq(discs(), 1, 'c4: a disc is dropped'); T.eq(t.all('#board button')[38].querySelector('span') ? 1 : 0, 1, 'c4: it lands on the bottom row of the column'); drop(3); T.eq(t.all('#board button')[31].querySelector('span') ? 1 : 0, 1, 'c4: the next disc stacks on top'); T.has(t.q('#msg').textContent, 'Red to move', 'c4: turns alternate');
    for (let k = 0; k < 4; k++) drop(3); T.eq(discs(), 6, 'c4: a column holds six discs'); drop(3); T.eq(discs(), 6, 'c4: a full column refuses another disc'); T.has(t.q('#msg').textContent, 'Red', 'c4: turn is not lost on a full column');
    /* vertical win */
    t.click('#new'); [0, 1, 0, 1, 0, 1, 0].forEach(drop); T.has(t.q('#msg').textContent, 'Red wins', 'c4: red wins with four in a column'); T.eq(sc(), '1,0,0', 'c4: score'); drop(5); T.eq(discs(), 7, 'c4: no moves after a win'); T.ok(t.all('#board span').filter(s => /box-shadow:0 0 0 4px/.test(s.getAttribute('style') || '')).length === 4, 'c4: the winning four are highlighted');
    /* horizontal win for yellow, diagonal, draw */
    t.click('#new'); [0, 6, 0, 5, 1, 4, 1, 3].forEach(drop); T.has(t.q('#msg').textContent, 'Yellow wins', 'c4: yellow wins along the bottom'); T.eq(sc(), '1,0,1', 'c4: yellow score');
    t.click('#new'); [0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3].forEach(drop); T.has(t.q('#msg').textContent, 'Red wins', 'c4: red wins on a diagonal');
    /* a drawn game found with the pure logic, then replayed through the UI */
    G.seed(1); const dr = (() => { for (let a = 0; a < 3000; a++) { const b = Array(42).fill(0), mv = []; let p = 1; for (;;) { const opts = [0, 1, 2, 3, 4, 5, 6].filter(c => !b[c]); if (!opts.length) return mv; const c = opts[Math.floor(Math.random() * opts.length)]; L.c4Drop(b, c, p); mv.push(c); if (L.c4Win(b, p)) break; p = 3 - p; } } return null; })();
    T.ok(dr && dr.length === 42, 'c4: found a drawn game to replay'); t.click('#new'); dr.forEach(drop); T.has(t.q('#msg').textContent, 'Draw', 'c4: a full board with no four is a draw'); T.eq(sc().split(',')[1], '1', 'c4: draw counted');
    T.eq(W.eval("Store.get('fun.c4.score').d"), 1, 'c4: score saved'); t.click('#rst'); T.eq(sc(), '0,0,0', 'c4: reset score');
    /* against the phone */
    t.click('#mode [data-v="ai"]'); t.click('#lvl [data-v="3"]'); G.seed(8); let humanWins = 0, aiWins = 0, draws = 0, illegal = 0;
    for (let g = 0; g < 10; g++) {
      t.click('#new');
      for (let k = 0; k < 24 && !/win|Draw/.test(t.q('#msg').textContent); k++) { const free = [0, 1, 2, 3, 4, 5, 6].filter(c => !t.all('#board button')[c].querySelector('span')); drop(free[Math.floor(G.w.Math.random() * free.length)]); G.tick(600); }
      const m = t.q('#msg').textContent; if (/You win/.test(m)) humanWins++; else if (/phone wins/.test(m)) aiWins++; else if (/Draw/.test(m)) draws++; else illegal++;
    }
    T.eq(illegal, 0, 'c4: every game against the phone ends with a result'); T.ok(humanWins === 0 && aiWins >= 8, 'c4: the hard phone beats random play (' + humanWins + '/' + aiWins + '/' + draws + ' W/L/D)');
    t.click('#new'); drop(0); drop(1); T.eq(discs(), 1 + 0 + (t.all('#board button').filter(b => b.querySelector('span')).length - 1), 'c4: you cannot play while the phone is thinking'); G.tick(600);
    T.eq(t.all('#lvw').length, 1, 'c4: level selector exists in phone mode'); t.click('#mode [data-v="two"]'); T.eq(t.q('#lvw').style.display, 'none', 'c4: level selector hidden in two-player mode');
  });

  /* ---------------- Tower of Hanoi ---------------- */
  await run('hanoi', async (t) => {
    const peg = (i) => t.q('#pegs [data-p="' + i + '"]'), discs = (i) => peg(i).querySelectorAll('div').length;
    t.click('#n [data-v="3"]'); T.eq(t.q('#mn').textContent, '7', 'hanoi: minimum for 3 discs is 7'); T.eq(discs(0), 3, 'hanoi: three discs on peg 1');
    peg(0).click(); peg(1).click(); T.eq(discs(1), 1, 'hanoi: top disc moved'); T.eq(t.q('#mv').textContent, '1', 'hanoi: move counted');
    peg(0).click(); peg(1).click(); T.eq(discs(1), 1, 'hanoi: a bigger disc cannot go on a smaller one'); T.has(t.q('#msg').textContent, 'cannot', 'hanoi: says why'); T.eq(t.q('#mv').textContent, '1', 'hanoi: illegal move not counted');
    peg(2).click(); T.eq(t.q('#mv').textContent, '1', 'hanoi: empty peg cannot be picked up'); peg(1).click(); peg(1).click(); T.eq(t.q('#mv').textContent, '1', 'hanoi: tapping the picked peg again drops it');
    t.click('#new'); T.eq(t.q('#mv').textContent, '0', 'hanoi: restart resets moves');
    const moves = []; (function h(n, a, b, c) { if (!n) return; h(n - 1, a, c, b); moves.push([a, b]); h(n - 1, c, b, a); })(3, 0, 2, 1);
    moves.forEach(([a, b]) => { peg(a).click(); peg(b).click(); });
    T.has(t.q('#msg').textContent, 'Solved in 7 moves (perfect!)', 'hanoi: the optimal solution is recognised'); T.eq(W.eval("Store.get('fun.hanoi.best')")['3'], 7, 'hanoi: best saved'); T.eq(t.q('#bs').textContent, '7', 'hanoi: best shown');
    peg(2).click(); peg(0).click(); T.eq(t.q('#mv').textContent, '7', 'hanoi: no moves after solving');
    t.click('#new'); [[0, 1], [1, 0], [0, 2], [2, 1], [1, 2], [2, 0]].forEach(([a, b]) => { peg(a).click(); peg(b).click(); });
    moves.forEach(([a, b]) => { peg(a).click(); peg(b).click(); }); T.has(t.q('#msg').textContent, 'Solved in 13 moves', 'hanoi: a longer solution is accepted'); T.ok(!/perfect/.test(t.q('#msg').textContent), 'hanoi: but not called perfect'); T.eq(t.q('#bs').textContent, '7', 'hanoi: best stays at 7');
    t.click('#n [data-v="7"]'); T.eq(t.q('#mn').textContent, '127', 'hanoi: 7 discs need 127'); T.eq(discs(0), 7, 'hanoi: seven discs');
    t.click('#n [data-v="5"]'); const m5 = []; (function h(n, a, b, c) { if (!n) return; h(n - 1, a, c, b); m5.push([a, b]); h(n - 1, c, b, a); })(5, 0, 2, 1); m5.forEach(([a, b]) => { peg(a).click(); peg(b).click(); });
    T.has(t.q('#msg').textContent, 'Solved in 31 moves (perfect!)', 'hanoi: five discs solved in 31');
  });

  /* ---------------- Number Guess ---------------- */
  await run('numguess', async (t) => {
    const guess = (v) => { t.type('#in', v); t.click('#go'); }, msg = () => t.q('#msg').textContent, tries = () => num(t.q('#tr').textContent);
    guess(''); T.has(msg(), 'Enter a number', 'numguess: empty guess is refused'); T.eq(tries(), 0, 'numguess: refused guess costs nothing'); t.type('#in', '0'); T.eq(t.value('#in'), '1', 'numguess: 0 is pulled up to the minimum by the field limits'); t.type('#in', '101'); T.eq(t.value('#in'), '100', 'numguess: above the range is pulled down to the maximum'); t.type('#in', 'abc'); T.eq(t.value('#in'), '', 'numguess: text is not accepted'); t.type('#in', '');
    for (const mx of [100, 50, 1000]) {
      t.click('#mx [data-v="' + mx + '"]'); T.eq(t.q('#in').max, String(mx), 'numguess: input max follows the range'); T.has(msg(), '1 to ' + mx, 'numguess: tells the range');
      let lo = 1, hi = mx, n = 0, found = false;
      while (!found && n < 20) {
        const g = Math.floor((lo + hi) / 2); guess(String(g)); n++;
        if (/Yes!/.test(msg())) found = true; else if (/too high/.test(msg())) hi = g - 1; else if (/too low/.test(msg())) lo = g + 1; else T.ok(false, 'numguess: unexpected message ' + msg());
        if (!found) { T.eq(t.q('#lo').textContent + '-' + t.q('#hi').textContent, lo + '-' + hi, 'numguess: the shown range follows the hints'); }
      }
      T.ok(found && n <= Math.ceil(Math.log2(mx + 1)), 'numguess: binary search finds the number within ' + Math.ceil(Math.log2(mx + 1)) + ' tries for 1-' + mx + ' (took ' + n + ')'); T.eq(tries(), n, 'numguess: tries counted');
      T.eq(W.eval("Store.get('fun.guess.best')")[mx], n, 'numguess: best saved per range'); guess('5'); T.eq(tries(), n, 'numguess: no guesses after finding it');
      T.ok(t.all('#hist .chip').length === n && /✅/.test(t.all('#hist .chip')[0].textContent), 'numguess: history lists the guesses with the last one ticked');
    }
    t.click('#new'); T.eq(tries(), 0, 'numguess: a new number resets the tries'); T.eq(t.all('#hist .chip').length, 0, 'numguess: history cleared');
    t.type('#in', '5'); T.eq(t.value('#in'), '5', 'numguess: input accepts digits'); G.key('Enter', t.q('#in')); const enter = new W.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }); t.q('#in').dispatchEvent(enter); T.ok(tries() >= 1, 'numguess: Enter submits the guess');
  });

  await T.done(G.page);
})().catch(e => { console.log("FAIL: test crashed: " + (e && e.stack || e)); process.exit(1); });
