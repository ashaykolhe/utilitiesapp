'use strict';
/* Multiplayer modes of fun.js: Memory, Quiz, Rock Paper Scissors and Math Sprint with several human and phone seats.
   Pure logic (seat names, set-up checks, scoring, winner / tie, phone models) and scripted games through the real screens. */
const fs = require('fs'), path = require('path');
const { bootGame } = require('./fun-lib');
const { suite } = require('../helpers/page');
global.Tools = global.Tools || { register() {} };
const L = require('../../www/js/tools/fun.js');

(async () => {
  const T = suite('fun-mp'), G = await bootGame({ seed: 11 }), W = G.w;
  const run = async (id, fn) => {
    const before = G.listeners(); G.unseed(); G.clock.reset();
    const t = await G.page.open(id);
    try { await fn(t); } catch (e) { T.ok(false, id + ' threw: ' + String(e.stack || e).split('\n').slice(0, 3).join(' | ')); }
    G.leaves(t, before, T, id);
  };
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'www', 'js', 'tools', 'fun.js'), 'utf8');
  const QUIZ = new Function('return ' + /const QUIZ = (\[[\s\S]*?\n?\]);/.exec(src)[1])();
  const sbScores = (t, re) => t.all('#sb > div').filter(d => d.querySelector('b') && re.test(d.querySelector('b').textContent)).map(d => +re.exec(d.querySelector('b').textContent)[1]);

  /* ---------------- pure logic ---------------- */
  {
    T.eq(L.cleanName('  Alexander the Great  '), 'Alexander th', 'names: cut to 12 characters');
    T.eq(L.cleanName('<b>Ann</b>'), 'bAnn/b', 'names: angle brackets are removed (plain text only)');
    T.eq(L.cleanName(null), '', 'names: null is empty'); T.eq(L.cleanName('a\u0000b\nc'), 'abc', 'names: control characters removed');
    T.eq(JSON.stringify(L.seatNames([{ h: 1 }, { h: 0 }, { h: 1 }, { h: 0 }], 4)), '["Player 1","Phone 1","Player 2","Phone 2"]', 'names: defaults count humans and phones separately');
    T.eq(JSON.stringify(L.seatNames([{ h: 1, name: 'Zed' }, { h: 1, name: 'zed' }, { h: 0 }], 3)), '["Zed","zed 2","Phone 1"]', 'names: a repeated name gets a number');
    const spec = { min: 2, max: 4, def: 2, opts: { lvl: { items: [['1', 'E'], ['2', 'N'], ['3', 'H']], def: '2' } } };
    const c0 = L.cleanSetup(null, spec); T.eq(c0.n, 2, 'setup: default 2 players'); T.eq(c0.seats.length, 4, 'setup: a seat record per possible seat');
    T.eq(c0.seats.map(s => s.h).join(''), '1100', 'setup: default two humans then phones'); T.eq(c0.opt.lvl, '2', 'setup: default option');
    const c1 = L.cleanSetup({ n: 99, seats: 'x', opt: { lvl: '7' } }, spec); T.eq(c1.n, 4, 'setup: player count clamped'); T.eq(c1.opt.lvl, '2', 'setup: unknown option value falls back');
    const c2 = L.cleanSetup({ n: 3, seats: [{ h: 0, name: 'x'.repeat(40) }], opt: { lvl: 3 } }, spec);
    T.eq(c2.seats[0].h, 0, 'setup: kept seat type'); T.eq(c2.seats[0].name.length, 12, 'setup: stored name cut'); T.eq(c2.opt.lvl, '3', 'setup: numeric option accepted');
    T.eq(JSON.stringify(L.winners([3, 5, 5, 1])), '[1,2]', 'winners: all seats on the top score');
    T.eq(L.verdict(['A', 'B'], [3, 1], 'point'), '🏆 A wins with 3 points', 'verdict: single winner');
    T.eq(L.verdict(['A', 'B', 'C'], [2, 2, 1], 'pair'), '🤝 Tie between A and B with 2 pairs', 'verdict: tie of two');
    T.eq(L.verdict(['A', 'B', 'C'], [1, 1, 1], 'pair'), '🤝 Tie between A, B and C with 1 pair', 'verdict: three-way tie, singular unit');
    /* seeded questions: same seed same sequence, and the default (unseeded) call still works */
    const seq = (seed, lvl) => { const r = L.seededRn(seed), out = []; for (let i = 0; i < 40; i++) out.push(L.mathQ(lvl, r).text); return out.join('|'); };
    T.eq(seq(5, 2), seq(5, 2), 'seeded questions repeat exactly'); T.ok(seq(5, 2) !== seq(6, 2), 'a different seed gives different questions');
    for (const lv of [1, 2, 3]) { const q = L.mathQ(lv); T.ok(Number.isInteger(q.ans) && q.ans >= 0 && /^\d+ [+−×] \d+$/.test(q.text), 'mathQ level ' + lv + ' still makes a sum: ' + q.text); }
    /* rock paper scissors scoring: one point per other seat beaten */
    T.eq(JSON.stringify(L.rpsRound([0, 2])), '[1,0]', 'rps: rock beats scissors (2 seats)'); T.eq(JSON.stringify(L.rpsRound([1, 1])), '[0,0]', 'rps: a draw scores nothing');
    T.eq(JSON.stringify(L.rpsRound([0, 1, 2])), '[1,1,1]', 'rps: rock, paper, scissors: everyone beats one seat');
    T.eq(JSON.stringify(L.rpsRound([0, 0, 1])), '[0,0,2]', 'rps: paper beats both rocks');
    T.eq(JSON.stringify(L.rpsRound([0, 2, 2, 2])), '[3,0,0,0]', 'rps: rock beats three scissors');
    T.eq(JSON.stringify(L.rpsRound([1, 1, 0, 0])), '[2,2,0,0]', 'rps: two papers each beat two rocks');
    T.ok(L.rpsBeats(1, 0) && L.rpsBeats(2, 1) && L.rpsBeats(0, 2) && !L.rpsBeats(0, 1), 'rps: paper > rock > scissors > paper');
    T.ok(!L.rpsOver('f5', [4, 3], 4), 'rps f5: nobody at 5 yet'); T.ok(L.rpsOver('f5', [5, 3], 6), 'rps f5: 5 points ends it');
    T.ok(!L.rpsOver('f5', [5, 5], 6), 'rps f5: a tie at the top plays on'); T.ok(L.rpsOver('f5', [5, 5], 30), 'rps f5: but not forever');
    T.ok(!L.rpsOver('r3', [1, 1], 2) && L.rpsOver('r3', [1, 1], 3), 'rps: 3 rounds'); T.ok(L.rpsOver('r7', [0, 0], 7) && !L.rpsOver('r7', [9, 0], 6), 'rps: 7 rounds is fixed even when someone is far ahead');
    /* memory phone model */
    const cards = ['a', 'b', 'a', 'b', 'c', 'c'], none = [false, false, false, false, false, false];
    T.eq(L.memPick1(cards, none, { 0: 'a', 2: 'a' }, 1, () => 0.5), 0, 'memory phone: takes a pair it remembers (level sure)');
    T.ok(![0, 2].includes(L.memPick1(cards, none, { 0: 'a', 2: 'a' }, 0, () => 0.5)), 'memory phone: forgets the pair when the level is 0 and flips an unknown card');
    T.eq(L.memPick2(0, cards, none, { 2: 'a' }, 1, () => 0.5), 2, 'memory phone: finds the partner of its first card when it remembers');
    T.ok(L.memPick2(0, cards, none, { 2: 'a' }, 0, () => 0.5) !== 2, 'memory phone: forgetting means it misses the partner');
    const k = {}; L.memObserve(k, 3, 'b', 1, () => 0.99); L.memObserve(k, 4, 'c', 0, () => 0); T.eq(JSON.stringify(k), '{"3":"b"}', 'memory phone: remembers a card only with the level chance');
    T.ok(L.MEM_P[1] < L.MEM_P[2] && L.MEM_P[2] < L.MEM_P[3] && L.MEM_P[3] < 1, 'memory phone: harder levels remember more but never everything');
    /* the phone really is beatable and gets better with the level: simulate a 2 phone game of 8 pairs, count turns it needs */
    const turnsToClear = (p) => {
      let seed = 3; const r = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
      const cs = []; for (let i = 0; i < 8; i++) cs.push(i, i); for (let i = cs.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cs[i], cs[j]] = [cs[j], cs[i]]; }
      const m = cs.map(() => false), kn = {}; let turns = 0, got = 0;
      while (got < 8 && turns < 500) {
        turns++; const a = L.memPick1(cs, m, kn, p, r); L.memObserve(kn, a, cs[a], p, r);
        const b = L.memPick2(a, cs, m, kn, p, r); L.memObserve(kn, b, cs[b], p, r);
        if (cs[a] === cs[b]) { m[a] = m[b] = true; got++; turns--; }
      }
      return turns;
    };
    const tE = turnsToClear(L.MEM_P[1]), tH = turnsToClear(L.MEM_P[3]); T.ok(tH < tE, 'memory phone: hard clears the board in fewer wasted turns than easy (' + tH + ' < ' + tE + ')');
    /* quiz and sprint phone models */
    T.ok(L.phoneCorrect(3, () => 0.8) && !L.phoneCorrect(1, () => 0.8) && !L.phoneCorrect(3, () => 0.95), 'quiz phone: the chance rises with the level');
    const mid = () => 0.5; const sp = (lv, ql) => L.sprintPhone(lv, ql, mid);
    T.ok(sp(1, 2) < sp(2, 2) && sp(2, 2) < sp(3, 2), 'sprint phone: faster at higher levels (' + sp(1, 2) + ',' + sp(2, 2) + ',' + sp(3, 2) + ')');
    T.ok(sp(2, 1) > sp(2, 2) && sp(2, 2) > sp(2, 3), 'sprint phone: scores less on harder questions');
    T.ok(L.sprintPhone(3, 1, () => 1) <= 40 && L.sprintPhone(1, 3, () => 0) >= 0, 'sprint phone: scores stay in a sane range');
  }

  /* ---------------- Memory: set-up screen, then 2 humans + 1 phone ---------------- */
  await run('memory', async (t) => {
    T.ok(t.has('#sz') && t.has('#mpb'), 'memory: solo screen is still the default, with a Play with friends button');
    T.ok(t.q('#mpb').textContent.includes('friends'), 'memory: button says what it does');
    t.click('#mpb'); T.ok(!t.q('#mpsetup').hidden && t.q('#mpplay').hidden, 'memory: set-up screen opens');
    T.eq(t.value('#mpn'), '2', 'memory: default 2 players'); T.eq(t.value('#st0') + t.value('#st1'), '11', 'memory: both default seats are human');
    T.eq(t.q('#nm0').placeholder, 'Player 1', 'memory: default name Player 1'); T.eq(t.q('#nm0').maxLength, 12, 'memory: names are limited to 12 characters');
    T.eq(t.q('#seat2').style.display, 'none', 'memory: unused seats are hidden');
    /* at least one human is required */
    t.type('#st0', '0'); t.type('#st1', '0'); t.click('#mpgo'); T.has(t.q('#mpmsg').textContent, 'at least one Human', 'memory: all-phone set-up is refused'); T.ok(t.q('#mpplay').hidden, 'memory: and does not start');
    t.type('#st0', '1'); t.type('#st1', '1');
    t.type('#mpn', '3'); T.eq(t.q('#seat2').style.display, '', 'memory: seat 3 appears with 3 players'); T.eq(t.value('#st2'), '0', 'memory: seat 3 defaults to a phone'); T.eq(t.q('#nm2').placeholder, 'Phone 1', 'memory: default name Phone 1');
    t.type('#nm0', 'Ann'); t.type('#nm1', 'Bob'); t.click('#x_size [data-v="3x4"]'); t.click('#x_lvl [data-v="3"]');
    T.eq(W.eval("Store.get('fun3.memory').n"), 3, 'memory: the set-up is remembered'); T.eq(W.eval("Store.get('fun3.memory').opt.size"), '3x4', 'memory: grid choice saved');
    G.seed(5); t.click('#mpgo');
    const names = ['Ann', 'Bob', 'Phone 1'], cards = () => t.all('.mc'), face = c => c.querySelector('.front').textContent;
    const cur = () => names.findIndex(n => t.q('#sb').textContent.includes('▶ ' + n));
    T.eq(cards().length, 12, 'memory: 3 x 4 grid'); T.eq(t.all('#sb > div').length, 3, 'memory: a score line per seat'); T.eq(cur(), 0, 'memory: Ann starts');
    T.has(t.q('#sb').textContent, 'now', 'memory: the current seat is marked with words, not only bold'); T.has(t.q('#msg').textContent, 'Ann: flip two cards', 'memory: status line names the player');
    T.eq(t.q('#msg').getAttribute('aria-live'), 'polite', 'memory: the status line is a live region');
    /* Ann: a mismatching pair passes the turn */
    let cs = cards(), a = 0, b = cs.findIndex((c, i) => i && face(c) !== face(cs[0]));
    cs[a].click(); T.eq(cur(), 0, 'memory: still Ann after one card'); cs[a].click(); T.eq(cs.filter(c => c.classList.contains('up')).length, 1, 'memory: the same card twice does nothing');
    cs[b].click(); const third = cs.findIndex((c, i) => i !== a && i !== b); cs[third].click(); T.eq(cs.filter(c => c.classList.contains('up')).length, 2, 'memory: a third card cannot be flipped');
    G.tick(1000); T.eq(cs.filter(c => c.classList.contains('up')).length, 0, 'memory: a mismatch turns face down'); T.eq(cur(), 1, 'memory: turn passes to Bob'); T.has(t.q('#msg').textContent, 'No match', 'memory: the status says no match');
    /* Bob: a match scores and keeps the turn */
    cs[0].click(); const mate = cs.findIndex((c, i) => i && face(c) === face(cs[0])); cs[mate].click(); G.tick(1000);
    T.eq(cur(), 1, 'memory: a match earns another turn'); T.eq(sbScores(t, /(\d+) pairs$/).join(','), '0,1,0', 'memory: Bob scored one pair'); T.has(t.q('#msg').textContent, 'Match for Bob', 'memory: match announced');
    T.ok(cs[0].classList.contains('ok') && /matched/.test(cs[0].getAttribute('aria-label')), 'memory: matched cards are marked and labelled');
    T.ok(t.q('#mpmenu').textContent.length > 0, 'memory: Change players button present');
    /* the rest: Ann never matches on purpose, Bob always does, the phone plays by itself */
    let guard = 0;
    while (!t.has('#again') && guard++ < 700) {
      const c = cur(); if (c === 2 || c < 0) { G.tick(500); continue; }
      cs = cards(); const free = cs.map((x, i) => i).filter(i => !cs[i].classList.contains('ok')), f0 = free[0];
      let g = c === 0 ? free.find(i => i !== f0 && face(cs[i]) !== face(cs[f0])) : free.find(i => i !== f0 && face(cs[i]) === face(cs[f0]));
      if (g === undefined) g = free.find(i => i !== f0);
      cs[f0].click(); cs[g].click(); G.tick(1000);
    }
    T.ok(t.has('#again'), 'memory: the game ends with a Play again button (' + guard + ' steps)');
    const sc = sbScores(t, /(\d+) pairs$/); T.eq(sc.reduce((x, y) => x + y, 0), 6, 'memory: all six pairs are scored'); T.ok(sc[1] >= 1, 'memory: Bob kept his match');
    T.eq(t.q('#msg').textContent, L.verdict(names, sc, 'pair'), 'memory: the result line names the winner or the tie'); T.ok(!t.q('#sb').textContent.includes('now'), 'memory: nobody is marked as playing after the end');
    T.eq(cards().filter(c => c.classList.contains('ok')).length, 12, 'memory: every card is matched'); T.eq(G.clock.pending().iv, 0, 'memory: no interval running');
    t.click('#again'); T.eq(cards().filter(c => c.classList.contains('ok')).length, 0, 'memory: Play again deals a new board'); T.eq(sbScores(t, /(\d+) pairs$/).join(','), '0,0,0', 'memory: scores reset');
    /* Change players asks first when a game is in progress */
    cards()[0].click(); cards()[1].click(); G.tick(1000); W.confirm = () => false; t.click('#mpmenu'); T.ok(!t.q('#mpplay').hidden, 'memory: No keeps the game');
    W.confirm = () => true; t.click('#mpmenu'); T.ok(t.q('#mpplay').hidden && !t.q('#mpsetup').hidden, 'memory: Yes goes back to the set-up'); T.eq(G.clock.idle(), 0, 'memory: leaving the game stops every timer');
    T.eq(t.value('#nm0'), 'Ann', 'memory: names are still there');
  });
  await run('memory', async (t) => {
    t.click('#mpb'); T.eq(t.value('#mpn'), '3', 'memory: last number of players remembered'); T.eq(t.value('#nm1'), 'Bob', 'memory: last names remembered');
    T.eq(t.q('#x_lvl .on').dataset.v, '3', 'memory: last phone level remembered');
    t.type('#nm0', '<b>Alexander the Great</b>'); T.eq(W.eval("Store.get('fun3.memory').seats[0].name"), 'bAlexander t', 'memory: stored name has no brackets and is 12 characters');
    t.type('#nm1', 'A&amp;B<i>'); t.click('#mpgo'); T.has(t.q('#sb').textContent, 'A&amp;Bi', 'memory: names are shown as plain text (escaped)'); T.eq(t.all('#sb i').length, 0, 'memory: no markup from a name');
    T.eq(t.all('#grid .mc').length, 12, 'memory: the remembered 3 x 4 grid is used');
  });
  await run('memory', async (t) => {
    t.click('#mpb'); t.click('#mpback'); T.ok(t.has('#sz') && !t.has('#mpsetup'), 'memory: Back to solo returns to the normal game');
    t.all('.mc')[0].click(); t.all('.mc')[1].click(); G.tick(1500);
    T.eq(t.q('#mv').textContent, '1', 'memory: solo mode still counts moves');
  });

  /* ---------------- Quiz: 2 humans + 1 phone ---------------- */
  await run('quiz', async (t) => {
    T.ok(t.has('#next') && t.has('#mpb') && t.q('#qn').textContent === '1/10', 'quiz: solo is still the default');
    t.click('#mpb'); T.eq(t.q('#mpn').options.length, 5, 'quiz: 2 to 6 players'); T.eq(t.q('#mpn').options[4].value, '6', 'quiz: up to 6');
    t.type('#mpn', '3'); t.type('#nm0', 'Ann'); t.type('#nm1', 'Bob'); t.click('#x_lvl [data-v="1"]'); G.seed(21); t.click('#mpgo');
    const names = ['Ann', 'Bob', 'Phone 1'], asked = new Set();
    for (let k = 0; k < 15; k++) {
      const turn = t.q('#turn').textContent; T.has(turn, 'Question ' + (k + 1) + ' of 15: ' + names[k % 3], 'quiz: question ' + (k + 1) + ' belongs to ' + names[k % 3]);
      const q = QUIZ.find(x => x[0] === t.q('#q').textContent); T.ok(!!q, 'quiz: question ' + (k + 1) + ' is from the shared set'); if (q) asked.add(q[0]);
      const opts = () => t.all('#opts button'), text = (b) => b.textContent.replace(/^[✔✘] /, '');
      T.eq(opts().map(text).sort().join('|'), q.slice(1).sort().join('|'), 'quiz: the four options are the question\'s answers'); T.ok(t.q('#next').hidden, 'quiz: Next hidden before the answer');
      if (k % 3 === 0) opts().find(b => text(b) === q[1]).click();
      else if (k % 3 === 1) opts().find(b => text(b) !== q[1]).click();
      else { opts()[0].click(); T.ok(t.q('#next').hidden, 'quiz: tapping during the phone\'s turn does nothing'); G.tick(1000); }
      T.ok(!t.q('#next').hidden, 'quiz: Next appears after the answer'); const m = t.q('#msg').textContent; T.has(m, names[k % 3], 'quiz: result line names the seat');
      T.ok(/Correct|Wrong/.test(m), 'quiz: result line is words (not colour only)'); if (k % 3 === 0) T.has(m, 'Correct', 'quiz: right answer acknowledged'); if (k % 3 === 1) T.has(m, 'Wrong', 'quiz: wrong answer acknowledged');
      T.eq(t.q('#next').textContent, k === 14 ? 'See result' : 'Next ➜', 'quiz: label of the Next button');
      t.click('#next');
    }
    T.eq(asked.size, 15, 'quiz: 15 different questions'); const sc = sbScores(t, /(\d+) pts$/);
    T.eq(sc[0], 5, 'quiz: Ann answered all five of hers right'); T.eq(sc[1], 0, 'quiz: Bob missed all five'); T.ok(sc[2] >= 0 && sc[2] <= 5, 'quiz: the phone scored 0 to 5');
    T.eq(t.q('#q').textContent, L.verdict(names, sc, 'point'), 'quiz: the verdict names the winner or tie'); T.has(t.q('#turn').textContent, 'Round over', 'quiz: round over'); T.ok(t.has('#again'), 'quiz: Play again offered');
    G.tick(3000); T.eq(G.clock.idle(), 0, 'quiz: nothing left running'); t.click('#again'); T.has(t.q('#turn').textContent, 'Question 1 of 15: Ann', 'quiz: a new round starts with the first seat'); T.eq(sbScores(t, /(\d+) pts$/).join(','), '0,0,0', 'quiz: scores reset');
  });
  await run('quiz', async (t) => {
    t.click('#mpb'); T.eq(t.value('#mpn'), '3', 'quiz: set-up remembered'); T.eq(t.q('#x_lvl .on').dataset.v, '1', 'quiz: phone skill remembered');
    /* six seats: 30 questions out of 40, all different */
    t.type('#mpn', '6'); t.click('#mpgo'); T.has(t.q('#turn').textContent, 'of 30', 'quiz: six seats get five questions each'); T.eq(t.all('#sb > div').length, 6, 'quiz: six score lines');
  });

  /* ---------------- Rock Paper Scissors ---------------- */
  const rpsRows = (t) => t.all('#view .card > div').map(d => { const m = /(Rock|Paper|Scissors)\s*\+(\d+)/.exec(d.textContent); return m ? { hand: ['Rock', 'Paper', 'Scissors'].indexOf(m[1]), pts: +m[2] } : null; }).filter(Boolean);
  const HAND = /✊|✋|✌|Rock|Paper|Scissors/;
  await run('rps', async (t) => {
    T.ok(t.has('#pick') && t.has('#mpb') && t.has('#rst'), 'rps: solo is still the default');
    t.click('#mpb'); t.type('#mpn', '3'); t.type('#nm0', 'Ann'); t.type('#nm1', 'Bob'); t.click('#x_series [data-v="r3"]'); T.eq(t.q('#x_series .on').textContent, '3 rounds', 'rps: series length chosen'); G.seed(8); t.click('#mpgo');
    const names = ['Ann', 'Bob', 'Phone 1'], totals = [0, 0, 0];
    for (let r = 1; r <= 3; r++) {
      /* cover screen for Ann: no hands anywhere */
      T.has(t.q('#msg').textContent, 'Pass the phone to Ann. Tap when only you can see the screen.', 'rps round ' + r + ': pass-the-phone cover for Ann');
      T.ok(!t.has('#pick') && !HAND.test(t.q('#view').textContent), 'rps round ' + r + ': the cover shows no hands (nothing left from the last round)'); T.eq(t.q('#msg').getAttribute('aria-live'), 'polite', 'rps: cover text is a live region');
      t.click('#rdy'); T.has(t.q('#msg').textContent, 'Ann, choose your move', 'rps: Ann is asked'); T.eq(t.all('#pick button').length, 3, 'rps: three hands'); T.ok(t.all('#pick button').every(b => b.getAttribute('aria-label')), 'rps: hands have names for screen readers');
      t.click('#pick [data-i="' + (r - 1) + '"]');                                              // Ann: rock, paper, scissors
      /* Bob's cover: Ann's choice is nowhere on screen or in the markup */
      T.has(t.q('#msg').textContent, 'Pass the phone to Bob', 'rps round ' + r + ': cover for Bob'); T.ok(!t.has('#pick') && !HAND.test(t.q('#view').textContent), 'rps round ' + r + ': Ann\'s choice is hidden from Bob');
      T.ok(!HAND.test(t.q('#view').innerHTML.replace(/aria-hidden="true">🙈/, '')), 'rps round ' + r + ': and not in the markup either');
      T.ok(!/(Rock|Paper|Scissors)/.test(t.q('#sb').textContent), 'rps: the scoreboard does not leak the choice');
      t.click('#rdy'); t.click('#pick [data-i="' + (r % 3) + '"]');                             // Bob: paper, scissors, rock
      const rows = rpsRows(t); T.eq(rows.length, 3, 'rps round ' + r + ': all three choices revealed together'); T.eq(rows[0].hand, r - 1, 'rps: Ann\'s revealed hand'); T.eq(rows[1].hand, r % 3, 'rps: Bob\'s revealed hand');
      const exp = L.rpsRound(rows.map(x => x.hand)); T.eq(rows.map(x => x.pts).join(), exp.join(), 'rps round ' + r + ': points are one per seat beaten (' + rows.map(x => x.hand) + ')'); exp.forEach((v, i) => { totals[i] += v; });
      T.eq(sbScores(t, /(\d+) pts$/).join(), totals.join(), 'rps round ' + r + ': running totals'); T.has(t.q('#msg').textContent, 'Round ' + r, 'rps: result line says the round');
      if (r < 3) { T.eq(t.q('#nx').textContent, 'Next round', 'rps: next round offered'); t.click('#nx'); }
    }
    T.eq(t.q('#nx').textContent, 'Play again', 'rps: 3 rounds ends the series'); T.has(t.q('#msg').textContent, L.verdict(names, totals, 'point'), 'rps: the series verdict');
    t.click('#nx'); T.eq(sbScores(t, /(\d+) pts$/).join(), '0,0,0', 'rps: Play again resets the scores'); T.has(t.q('#msg').textContent, 'Pass the phone to Ann', 'rps: and starts with a cover');
  });
  await run('rps', async (t) => {
    /* first to 5 (the remembered set-up still says 3 rounds, so switch) */
    t.click('#mpb'); T.eq(t.q('#x_series .on').dataset.v, 'r3', 'rps: series choice remembered'); t.click('#x_series [data-v="f5"]'); G.seed(3); t.click('#mpgo');
    let rounds = 0;
    while (t.has('#rdy') || t.has('#pick')) {
      if (t.has('#rdy')) t.click('#rdy'); t.click('#pick [data-i="0"]'); t.click('#rdy'); t.click('#pick [data-i="1"]'); rounds++;     // Ann always rock, Bob always paper
      const rows = rpsRows(t); T.eq(rows[1].pts >= 1, true, 'rps f5: paper beats rock every round'); if (t.q('#nx').textContent === 'Play again') break; t.click('#nx'); if (rounds > 40) break;
    }
    const sc = sbScores(t, /(\d+) pts$/); T.ok(rounds >= 3 && rounds <= 30, 'rps f5: ended after ' + rounds + ' rounds'); T.ok(Math.max(...sc) >= 5, 'rps f5: someone reached 5 points'); T.eq(L.winners(sc).length, 1, 'rps f5: a single leader at the end');
    T.eq(sc[1] >= sc[0], true, 'rps f5: Bob (paper) is not behind Ann (rock)');
  });
  await run('rps', async (t) => {
    /* one human and two phones: no pass-the-phone cover, straight to the pick */
    t.click('#mpb'); t.type('#mpn', '3'); t.type('#st1', '0'); t.type('#st2', '0'); t.click('#mpgo');
    T.ok(t.has('#pick') && !t.has('#rdy'), 'rps: a single human gets no cover screen'); T.has(t.q('#msg').textContent, 'Ann, choose your move', 'rps: remembered name');
    t.click('#pick [data-i="2"]'); const rows = rpsRows(t); T.eq(rows.length, 3, 'rps: three hands shown'); T.eq(rows[0].hand, 2, 'rps: the human\'s hand'); T.eq(t.q('#nx').textContent, 'Next round', 'rps: continues');
    const seen = new Set(); for (let k = 0; k < 20; k++) { t.click('#nx'); t.click('#pick [data-i="0"]'); rpsRows(t).slice(1).forEach(x => seen.add(x.hand)); if (t.q('#nx').textContent === 'Play again') break; }
    T.ok(seen.size >= 2, 'rps: phones throw different hands');
  });

  /* ---------------- Math Sprint ---------------- */
  await run('mathsprint', async (t) => {
    T.ok(t.has('#lv') && t.has('#mpb') && t.q('#q').textContent === 'Ready?', 'math: solo is still the default');
    t.click('#mpb'); T.eq(t.q('#mpn').options.length, 3, 'math: 2 to 4 players'); t.type('#mpn', '3'); t.type('#nm0', 'Ann'); t.type('#nm1', 'Bob'); t.click('#x_q [data-v="1"]'); t.click('#x_lvl [data-v="2"]'); t.click('#mpgo');
    const names = ['Ann', 'Bob', 'Phone 1'], q = () => t.q('#q').textContent, press = (k) => G.ev(t.q('#keys [data-k="' + k + '"]'), 'pointerdown');
    const solve = () => { const m = /^(\d+) ([+−×]) (\d+) = \?$/.exec(q()); const a = +m[1], b = +m[3]; return m[2] === '+' ? a + b : m[2] === '−' ? a - b : a * b; };
    const typeIn = (s) => String(s).split('').forEach(press);
    T.has(t.q('#turn').textContent, 'Ann: your 30 second sprint', 'math: Ann is first'); T.eq(t.q('#go').textContent, 'Start Ann (30 s)', 'math: start button names the player'); T.eq(q(), 'Ready?', 'math: no question before Start');
    press('1'); T.eq(t.q('#ans').textContent, '', 'math: keypad inactive before Start');
    G.seed(2); t.click('#go'); const q1 = [q()]; T.ok(t.q('#go').disabled, 'math: Start is disabled during a sprint');
    for (let k = 0; k < 10; k++) { typeIn(solve()); q1.push(q()); } T.eq(t.q('#cs').textContent, '10', 'math: Ann has 10');
    G.tick(31000); T.has(t.q('#msg').textContent, 'Ann scored 10.', 'math: the end of Ann\'s sprint is announced'); T.has(t.q('#turn').textContent, 'Bob: your 30 second sprint', 'math: Bob is next'); T.eq(sbScores(t, /^.*?(\d+)$/).slice(0, 1).join(), '10', 'math: Ann\'s score on the board');
    T.eq(t.q('#go').textContent, 'Start Bob (30 s)', 'math: Bob\'s start button'); T.eq(G.clock.pending().iv, 0, 'math: the clock is stopped between turns');
    /* Bob gets exactly the same questions */
    t.click('#go'); const q2 = [q()]; for (let k = 0; k < 3; k++) { typeIn(solve()); q2.push(q()); }
    G.tick(10000); G.setHidden(true); G.clock.now += 60000; G.setHidden(false); G.tick(100);
    T.ok(t.q('#go').disabled && /= \?$/.test(q()), 'math: time spent in the background does not count (sprint still running)'); T.ok(parseFloat(t.q('#bar').style.width) > 40, 'math: bar still has time (' + t.q('#bar').style.width + ')');
    for (let k = 0; k < 3; k++) { typeIn(solve()); q2.push(q()); } T.eq(t.q('#cs').textContent, '6', 'math: Bob has 6');
    const wrong = String(solve()).slice(0, -1) + ((+String(solve()).slice(-1) + 1) % 10); typeIn(wrong); T.eq(t.q('#wr').textContent, '1', 'math: a miss counts'); G.tick(300);
    G.tick(20000); T.eq(q(), 'All done', 'math: the game ends after the last seat');
    T.eq(q2.join('|'), q1.slice(0, q2.length).join('|'), 'math: every player gets the same questions in the same order (' + q2.length + ' compared)');
    const sc = t.all('#sb > div b').map(b => +b.textContent); T.eq(sc[0], 10, 'math: Ann 10'); T.eq(sc[1], 6, 'math: Bob 6'); T.ok(sc[2] >= 8 && sc[2] <= 12, 'math: the phone\'s score from the model (' + sc[2] + ')');
    T.has(t.q('#msg').textContent, 'Phone 1 scored ' + sc[2] + '.', 'math: the phone\'s score is announced'); T.has(t.q('#msg').textContent, L.verdict(names, sc, 'correct answer'), 'math: verdict');
    T.ok(t.has('#again') && t.q('#go').hidden, 'math: Play again offered'); G.tick(3000); T.eq(G.clock.idle(), 0, 'math: nothing running at the end');
    t.click('#again'); T.has(t.q('#turn').textContent, 'Ann: your 30 second sprint', 'math: Play again restarts from the first seat'); T.eq(t.all('#sb > div b')[0].textContent, '–', 'math: scores cleared');
    t.click('#go'); G.tick(5000); W.confirm = () => false; t.click('#mpmenu'); T.ok(!t.q('#mpplay').hidden, 'math: leaving mid-sprint asks first'); W.confirm = () => true; t.click('#mpmenu'); T.eq(G.clock.idle(), 0, 'math: leaving mid-sprint stops the clock');
  });
  await run('mathsprint', async (t) => {
    /* a phone in the first seat plays before the human, and a phone in the last seat after */
    t.click('#mpb'); t.type('#mpn', '3'); t.type('#st0', '0'); t.type('#st1', '1'); t.type('#st2', '0'); ['#nm0', '#nm1', '#nm2'].forEach(x => t.type(x, '')); t.click('#mpgo');
    T.has(t.q('#turn').textContent, 'Player 1: your 30 second sprint', 'math: the first human is up after the phone in seat 1'); T.has(t.q('#msg').textContent, 'Phone 1 scored', 'math: seat 1 phone already played');
    t.click('#go'); G.tick(31000); T.eq(t.q('#q').textContent, 'All done', 'math: the trailing phone plays and the game ends'); T.ok(t.all('#sb > div b').every(b => /^\d+$/.test(b.textContent)), 'math: every seat has a score');
    T.ok(/wins with|Tie between/.test(t.q('#msg').textContent), 'math: a winner or a tie is announced');
  });

  await T.done(G.page);
})();
