'use strict';
/* Tests for the pure data and logic in www/js/tools/party.js (plain Node, no network): node tests/party.test.js */
const assert = require('assert');
const P = require('../www/js/tools/party.js');
let n = 0, failed = 0;
function t(name, fn) { try { fn(); n++; } catch (e) { failed++; console.log('FAIL ' + name + ': ' + e.message); } }
const dups = (arr) => arr.filter((x, i) => arr.indexOf(x) !== i);

/* ---- Charades ---- */
t('charades: enough words, no duplicates per category', () => {
  assert(P.chCount() >= 600, 'only ' + P.chCount());
  for (const c of Object.keys(P.CH)) {
    const all = P.chItems([c], 'mixed').map(x => x.w.toLowerCase());
    assert.deepStrictEqual(dups(all), [], c + ' has duplicates');
    for (const lv of ['easy', 'medium', 'hard']) assert(P.chItems([c], lv).length >= 15, c + ' ' + lv + ' too few');
  }
});
t('charades: timer logic', () => {
  assert.strictEqual(P.chRemaining(1000, 60, 1000), 60);
  assert.strictEqual(P.chRemaining(1000, 60, 1000 + 59500), 1);
  assert.strictEqual(P.chRemaining(1000, 60, 61000), 0);
  assert.strictEqual(P.chRemaining(1000, 60, 999999), 0);
  assert.strictEqual(P.chRemaining(1000, 30, 0), 30);
  assert.strictEqual(P.chRemaining(0, 'x', 1000), 59);
  assert.deepStrictEqual(P.chTurn(0, 3), { team: 0, round: 1 });
  assert.deepStrictEqual(P.chTurn(4, 3), { team: 1, round: 2 });
  assert.deepStrictEqual(P.chWinners([3, 5, 5]), [1, 2]);
});
t('charades: deck never repeats before exhausted', () => {
  const items = P.chItems(['animals'], 'easy'), d = P.chDeck(items), seen = new Set();
  for (let i = 0; i < items.length; i++) { const x = d.next(); assert(!seen.has(x.w)); seen.add(x.w); }
  let prev = d.next(); for (let i = 0; i < 300; i++) { const x = d.next(); assert(x !== prev); prev = x; }
});

/* ---- Heads Up ---- */
t('headsup: 8+ decks of 60+ unique words', () => {
  const ids = Object.keys(P.HU); assert(ids.length >= 8);
  for (const id of ids) { const w = P.huWords(id).map(x => x.toLowerCase()); assert(w.length >= 60, id + ' has ' + w.length); assert.deepStrictEqual(dups(w), [], id); }
});
t('headsup: tilt detection', () => {
  const st = { armed: false };
  assert.strictEqual(P.huTilt(9.8, st), null);          // starts face up: not armed
  assert.strictEqual(P.huTilt(0.5, st), null); assert(st.armed);
  assert.strictEqual(P.huTilt(-8, st), 'ok'); assert(!st.armed);
  assert.strictEqual(P.huTilt(-9, st), null);           // must return to neutral first
  assert.strictEqual(P.huTilt(1, st), null);
  assert.strictEqual(P.huTilt(8, st), 'pass');
  assert.strictEqual(P.huTilt(NaN, st), null);
});

/* ---- Who Am I ---- */
t('whoami: 150+ unique identities, deals are distinct', () => {
  const a = P.waAll().map(x => x.w.toLowerCase()); assert(a.length >= 150);
  assert.deepStrictEqual(dups(a), []);
  for (let n = 2; n <= 12; n++) { const d = P.waDeal(n).map(x => x.w); assert.strictEqual(d.length, n); assert.strictEqual(new Set(d).size, n); }
  assert.strictEqual(P.waDeal(99).length, 12); assert.strictEqual(P.waDeal(0).length, 2);
  const one = P.waDeal(5, ['jobs']); assert(one.every(x => x.cat === 'jobs'));
});

/* ---- Mafia Moderator ---- */
t('mafia: role counts and assignment for many setups', () => {
  for (let i = 0; i < 3000; i++) {
    const n = Math.floor(Math.random() * 40) - 5, want = { mafia: Math.floor(Math.random() * 30) - 3, doctor: Math.floor(Math.random() * 4), detective: Math.floor(Math.random() * 4), vigilante: Math.floor(Math.random() * 4) };
    const c = P.mfCounts(n, want), N = Math.min(20, Math.max(4, n));
    const total = c.mafia + c.doctor + c.detective + c.vigilante + c.villager;
    assert.strictEqual(total, N);
    assert(c.mafia >= 1 && c.mafia * 2 < N, 'mafia ' + c.mafia + ' of ' + N);
    for (const k of ['doctor', 'detective', 'vigilante', 'villager']) assert(c[k] >= 0);
    const roles = P.mfAssign(N, c);
    assert.strictEqual(roles.length, N);
    for (const k of ['mafia', 'doctor', 'detective', 'vigilante', 'villager']) assert.strictEqual(roles.filter(r => r === k).length, c[k], k);
    assert.strictEqual(P.mfWin(roles.map(r => ({ role: r, alive: true }))), null); // never an instant win
  }
  for (let n = 4; n <= 20; n++) { const s = P.mfSuggest(n); const c = P.mfCounts(n, s); assert.strictEqual(c.note, ''); assert.strictEqual(c.mafia, s.mafia); }
});
t('mafia: win conditions', () => {
  const mk = (s) => s.split('').map(ch => ({ role: ch.toLowerCase() === 'm' ? 'mafia' : 'villager', alive: ch === ch.toUpperCase() }));
  assert.strictEqual(P.mfWin(mk('MVVv')), null);
  assert.strictEqual(P.mfWin(mk('MMVv')), 'mafia');
  assert.strictEqual(P.mfWin(mk('MVv')), 'mafia');
  assert.strictEqual(P.mfWin(mk('mVVV')), 'town');
  assert.strictEqual(P.mfWin(mk('MVVV')), null);
  assert.strictEqual(P.mfWin(mk('MV')), 'mafia');
  assert.strictEqual(P.mfWin(mk('mmvv')), 'town');
});
t('mafia: night resolution', () => {
  const pl = ['mafia', 'villager', 'doctor', 'detective', 'vigilante', 'villager'].map(r => ({ role: r, alive: true }));
  assert.deepStrictEqual(P.mfNight(pl, { kill: 1 }).died, [1]);
  let r = P.mfNight(pl, { kill: 1, save: 1 }); assert.deepStrictEqual(r.died, []); assert.deepStrictEqual(r.saved, [1]);
  r = P.mfNight(pl, { kill: 1, save: 2, shoot: 0 }); assert.deepStrictEqual(r.died.sort(), [0, 1]);
  r = P.mfNight(pl, { kill: 1, shoot: 1 }); assert.deepStrictEqual(r.died, [1]);
  assert.strictEqual(P.mfNight(pl, { check: 0 }).check, 'mafia');
  assert.strictEqual(P.mfNight(pl, { check: 5 }).check, 'town');
  assert.strictEqual(P.mfNight(pl, { check: 99 }).check, null);
  pl[1].alive = false; assert.deepStrictEqual(P.mfNight(pl, { kill: 1 }).died, []);
  assert.deepStrictEqual(P.mfNight(pl, { kill: null, save: undefined }).died, []);
});
t('mafia: random full games always end with a winner', () => {
  for (let g = 0; g < 500; g++) {
    const n = 4 + Math.floor(Math.random() * 17), c = P.mfCounts(n, { mafia: 1 + Math.floor(Math.random() * 5), doctor: 1, detective: 1, vigilante: Math.floor(Math.random() * 2) });
    const pl = P.mfAssign(n, c).map(r => ({ role: r, alive: true }));
    let w = null, rounds = 0, vig = false;
    while (!w && rounds++ < 100) {
      const alive = pl.map((p, i) => p.alive ? i : -1).filter(i => i >= 0), pk = () => alive[Math.floor(Math.random() * alive.length)];
      const steps = P.mfSteps(pl, vig); assert(steps[0].key === 'mafia');
      const res = P.mfNight(pl, { kill: pk(), save: pk(), shoot: steps.some(s => s.key === 'shoot' && s.active) ? pk() : null });
      if (steps.some(s => s.key === 'shoot' && s.active)) vig = true;
      res.died.forEach(i => { pl[i].alive = false; });
      w = P.mfWin(pl); if (w) break;
      const al = pl.map((p, i) => p.alive ? i : -1).filter(i => i >= 0); pl[al[Math.floor(Math.random() * al.length)]].alive = false;
      w = P.mfWin(pl);
    }
    assert(w === 'town' || w === 'mafia', 'no winner');
  }
});
t('mafia: names are unique and sized', () => {
  const nm = P.mfNames('Ann\nann, Bob <b>', 6);
  assert.strictEqual(nm.length, 6); assert.strictEqual(new Set(nm.map(x => x.toLowerCase())).size, 6);
  assert(nm.every(x => !/[<>]/.test(x) && x.length <= 20));
  assert.strictEqual(P.mfNames('', 4)[0], 'Player 1');
});

/* ---- Trivia packs ---- */
t('trivia: static packs have 70+ unique questions with 4 distinct options and the answer included', () => {
  for (const id of ['science', 'geography', 'general', 'body', 'space']) {
    const qs = P.TQ[id]; assert(qs.length >= 70, id + ' has ' + qs.length);
    assert.deepStrictEqual(dups(qs.map(x => x.q.toLowerCase())), [], id + ' duplicate questions');
    for (const x of qs) {
      const o = [x.a].concat(x.d); assert(o.every(s => s && s.trim()), id + ': empty option in ' + x.q);
      assert.strictEqual(new Set(o.map(s => s.toLowerCase())).size, 4, id + ': options repeat in ' + x.q);
      assert(x.q.trim().endsWith('?') || x.q.includes('...'), id + ': question without ? ' + x.q);
    }
    for (let k = 0; k < 20; k++) for (const sp of P.tqSpecs(id)) { const b = P.tqBuild(sp); assert.strictEqual(b.opts.length, 4); assert.strictEqual(new Set(b.opts).size, 4); assert.strictEqual(b.opts[b.ans], sp.x.a); if (k > 0) break; }
  }
});
t('trivia: countries are internally consistent', () => {
  const c = P.COUNTRIES;
  assert(c.length >= 190, 'countries ' + c.length);
  assert.deepStrictEqual(dups(c.map(x => x.name)), [], 'duplicate country name');
  assert.deepStrictEqual(dups(c.map(x => x.iso)), [], 'duplicate iso');
  const caps = c.filter(x => x.cap).map(x => x.cap);
  assert(caps.length >= 150);
  assert.deepStrictEqual(dups(caps), [], 'a capital belongs to two countries');
  for (const x of c) {
    assert(/^[A-Z]{2}$/.test(x.iso), x.iso); assert(/^[AEFNSO]$/.test(x.r));
    assert.strictEqual(P.flag(x.iso).length, 4);
  }
  const names = c.map(x => x.name);
  for (const bad of ['Taiwan', 'Kosovo', 'Palestine', 'Western Sahara']) assert(!names.includes(bad), bad + ' must stay out');
  for (const skip of ['Israel', 'Bolivia', 'South Africa', 'Sri Lanka']) assert.strictEqual(c.find(x => x.name === skip).cap, '');
  assert(P.tqSpecs('flags').length >= 190 && P.tqSpecs('capitals').length >= 150);
  assert(P.tqSpecs('flags').length + P.tqSpecs('capitals').length >= 250);
});
t('trivia: generated flag and capital questions are valid', () => {
  for (const pack of ['flags', 'capitals']) for (const sp of P.tqSpecs(pack)) {
    const b = P.tqBuild(sp);
    assert.strictEqual(b.opts.length, 4, sp.id); assert.strictEqual(new Set(b.opts).size, 4, sp.id);
    assert.strictEqual(b.opts[b.ans], pack === 'flags' ? sp.c.name : sp.c.cap);
    assert(pack !== 'flags' || b.big.length === 4);
  }
});
t('trivia: rounds and the daily five', () => {
  for (const p of P.tqPackIds()) { const r = P.tqRound(p, 10); assert.strictEqual(r.length, 10); assert.strictEqual(new Set(r.map(x => x.id)).size, 10); }
  const a = P.tqDaily('2030-01-02'), b = P.tqDaily('2030-01-02'), c = P.tqDaily('2030-01-03');
  assert.strictEqual(a.length, 5); assert.deepStrictEqual(a, b);
  assert.notDeepStrictEqual(a.map(x => x.id), c.map(x => x.id));
  for (const q of a) assert.strictEqual(new Set(q.opts).size, 4);
});

/* ---- Spelling Bee ---- */
const BANNED_IN_TEST = 'ass asses asshole bastard bitch bitches bloody boob boobs cock crap cunt damn damned dick dicks fuck fucked fucker fucking hell kill killed killer killing kills murder murdered murderer nazi nigger nude naked penis piss porn pornography prick rape raped retard retarded sex sexy sexual shit shits slut sluts suicide torture twat vagina whore whores wank drunk drug drugs heroin cocaine hate stupid idiot idiots moron fool ugly slave slaves'.split(' ');
t('bee: dictionary is big, clean and has no banned words', () => {
  const w = P.sbWords(); assert(w.length >= 3000, 'only ' + w.length);
  assert.deepStrictEqual(dups(w), [], 'duplicate dictionary words');
  for (const x of w) { assert(/^[a-z]{4,15}$/.test(x), 'bad word ' + x); }
  const set = new Set(w);
  for (const b of BANNED_IN_TEST.concat(P.SB_BAN)) assert(!set.has(b), 'banned word present: ' + b);
  for (const common of ['house', 'water', 'garden', 'planet', 'happy', 'family']) assert(set.has(common), common + ' missing');
});
t('bee: generator always gives a pangram and 15+ valid words', () => {
  const dict = new Set(P.sbWords());
  const check = (p) => {
    assert(p, 'no puzzle'); assert.strictEqual(p.letters.length, 7); assert.strictEqual(new Set(p.letters).size, 7);
    assert(p.letters.includes(p.center)); assert(p.words.length >= 15, 'only ' + p.words.length); assert(p.pangrams.length >= 1);
    for (const w of p.words) { assert(dict.has(w)); assert(w.length >= 4); assert(w.includes(p.center)); assert(w.split('').every(c => p.letters.includes(c)), w); }
    for (const w of p.pangrams) assert(p.letters.every(c => w.includes(c)), 'pangram ' + w);
    assert.strictEqual(p.max, p.words.reduce((s, w) => s + P.sbPoints(w, p.mask), 0));
    // the solver finds nothing the brute force misses
    const brute = P.sbWords().filter(w => w.includes(p.center) && w.split('').every(c => p.letters.includes(c)));
    assert.deepStrictEqual(brute.sort(), p.words.slice().sort());
  };
  for (let i = 0; i < 150; i++) check(P.sbPuzzle());
  for (let d = 1; d <= 60; d++) check(P.sbDaily('2031-03-' + String(d).padStart(2, '0')));
  assert.deepStrictEqual(P.sbDaily('2031-03-01'), P.sbDaily('2031-03-01'));
});
t('bee: scoring and ranks', () => {
  const mask = P.sbMask('abcdefg');
  assert.strictEqual(P.sbPoints('abed', mask), 1); assert.strictEqual(P.sbPoints('faced', mask), 5); assert.strictEqual(P.sbPoints('feedback', P.sbMask('abcdefk')), 15); assert.strictEqual(P.sbPoints('feedback', P.sbMask('abcdefkz')), 8);
  assert.strictEqual(P.sbPoints('abcdefg', mask), 7 + 7); // pangram bonus
  assert.strictEqual(P.sbRank(0, 100).name, 'Beginner'); assert.strictEqual(P.sbRank(2, 100).name, 'Good Start');
  assert.strictEqual(P.sbRank(69, 100).name, 'Amazing'); assert.strictEqual(P.sbRank(70, 100).name, 'Genius');
  assert.strictEqual(P.sbRank(100, 100).name, 'Genius'); assert.strictEqual(P.sbRank(5, 0).name, 'Genius');
  let last = -1; for (let s = 0; s <= 200; s++) { const r = P.sbRank(s, 200).idx; assert(r >= last); last = r; }
});
t('bee: word checking messages', () => {
  const p = P.sbDaily('2031-04-01'), found = new Set();
  const w = p.words[0];
  assert.strictEqual(P.sbCheck(p, 'abc', found).ok, false);
  assert.strictEqual(P.sbCheck(p, '', found).ok, false);
  assert(/Missing/.test(P.sbCheck(p, p.outer.join('') + p.outer[0], found).msg));
  const nl = 'abcdefghijklmnopqrstuvwxyz'.split('').find(c => !p.letters.includes(c)); assert(/Bad letters/.test(P.sbCheck(p, w + nl, found).msg));
  const r = P.sbCheck(p, w.toUpperCase(), found); assert(r.ok && r.pts === P.sbPoints(w, p.mask));
  found.add(w); assert(/Already/.test(P.sbCheck(p, w, found).msg));
  const pg = P.sbCheck(p, p.pangrams[0], new Set()); assert(pg.ok && pg.pangram);
  assert(/Not in/.test(P.sbCheck(p, p.center.repeat(5), new Set()).msg));
  assert.strictEqual(P.sbCheck(p, null, found).ok, false);
});

/* ---- Anagram Race ---- */
t('anagram: 400+ unique clean words and a difficulty ladder', () => {
  const raw = []; P.AR.forEach(l => raw.push(...l.w.split(' ').filter(Boolean)));
  assert(raw.length >= 400, 'only ' + raw.length); assert.deepStrictEqual(dups(raw), [], 'duplicate words');
  for (const w of raw) { assert(/^[a-z]{4,15}$/.test(w), 'bad ' + w); assert(!BANNED_IN_TEST.includes(w), 'banned ' + w); }
  assert(P.AR.length >= 4); const avg = (l) => P.arWords(l).reduce((s, w) => s + w.length, 0) / P.arWords(l).length;
  for (let i = 1; i < P.AR.length; i++) assert(avg(i) > avg(i - 1), 'level ' + i + ' is not harder');
  assert.strictEqual(P.arLevel(0), 0); assert.strictEqual(P.arLevel(4), 1); assert.strictEqual(P.arLevel(999), P.AR.length - 1);
});
t('anagram: scrambles are never the word, keep the letters, and answers check out', () => {
  const dict = new Set(P.sbWords());
  for (const w of P.arAll()) {
    for (let k = 0; k < 5; k++) {
      const s = P.arScramble(w, undefined, (x) => dict.has(x));
      assert.notStrictEqual(s, w, w); assert.strictEqual(s.split('').sort().join(''), w.split('').sort().join(''), w);
    }
    assert(P.arCheck(w, w.toUpperCase(), (x) => dict.has(x)));
  }
  assert.strictEqual(P.arCheck('listen', 'silent', (x) => dict.has(x)), dict.has('silent'));
  assert.strictEqual(P.arCheck('listen', 'listex', (x) => true), false);
  assert.strictEqual(P.arCheck('listen', 'liste', (x) => true), false);
  assert.strictEqual(P.arCheck('listen', null, null), false);
  assert.strictEqual(P.arPoints(5, 0), 5); assert.strictEqual(P.arPoints(5, 3), 8); assert.strictEqual(P.arPoints(5, 99), 10); assert.strictEqual(P.arPoints(5, -4), 5);
  assert.notStrictEqual(P.arScramble('aa'), 'ab');
});

/* ---- Family friendly scan of all party word lists ---- */
t('content: no banned word in any party word list', () => {
  const ban = new Set(BANNED_IN_TEST);
  const bag = [];
  for (const c of Object.values(P.CH)) bag.push(c.e, c.m, c.h);
  for (const c of Object.values(P.HU)) bag.push(c.w);
  for (const c of Object.values(P.WA)) bag.push(c.w);
  for (const q of Object.values(P.TQ)) for (const x of q) bag.push(x.q, x.a, x.d.join(' '), x.ex);
  for (const l of P.AR) bag.push(l.w);
  for (const text of bag) for (const tok of text.toLowerCase().split(/[^a-z]+/)) assert(!ban.has(tok), 'banned word in content: ' + tok);
});

/* ---- Multi-seat setup, turn order, scoring, ties and phone models ---- */
const seq = (vals) => { let i = 0; return (n) => vals[i++ % vals.length] % n; };   // scripted "random" source
t('multi: setup is normalised (seat counts, human seat, names, level)', () => {
  const d = P.tqSetup(null); assert.strictEqual(d.n, 2); assert.deepStrictEqual(d.ai.slice(0, 3), [false, true, true]); assert.strictEqual(d.pack, 'general'); assert.strictEqual(d.len, 10); assert.strictEqual(d.level, 'normal');
  assert.strictEqual(P.tqSetup({ n: 99 }).n, 6); assert.strictEqual(P.tqSetup({ n: 1 }).n, 2); assert.strictEqual(P.tqSetup({ n: 'x' }).n, 2);
  assert.strictEqual(P.mpSetup({ n: 9 }, 4).n, 4); assert.strictEqual(P.mpSetup({ n: 3 }, 4).ai.length, 4);
  assert.strictEqual(P.mpSetup({ n: 2, ai: [true, true] }, 4).ai[0], false, 'all-phone setup gets a human seat');
  assert.strictEqual(P.mpSetup({ n: 3, ai: [true, true, false] }, 4).ai[0], true, 'one human is enough');
  assert.strictEqual(P.mpSetup({ level: 'insane' }, 4).level, 'normal'); assert.strictEqual(P.mpSetup({ level: 'hard' }, 4).level, 'hard');
  assert.strictEqual(P.tqSetup({ pack: '__proto__', len: 7 }).pack, 'general'); assert.strictEqual(P.tqSetup({ pack: 'space', len: '15' }).pack, 'space'); assert.strictEqual(P.tqSetup({ len: 7 }).len, 10);
  assert.doesNotThrow(() => { P.mpSetup('x', 4); P.mpSetup([], 4); P.mpSetup({ ai: 5, names: 'q' }, 4); });
});
t('multi: names are plain, at most 12 characters, defaulted and unique', () => {
  assert.strictEqual(P.mpClean('  Alexandria the Great  '), 'Alexandria t'); assert.strictEqual(P.mpClean(null), ''); assert.strictEqual(P.mpClean('a\nb\tc'), 'a b c');
  const c = P.mpSetup({ n: 4, ai: [false, true, false, true], names: ['', '', 'Zed', ''] }, 6);
  assert.deepStrictEqual(P.mpNames(c), ['Player 1', 'Phone 1', 'Zed', 'Phone 2']);
  const u = P.mpNames(P.mpSetup({ n: 3, ai: [false, false, false], names: ['Sam', 'sam', 'SAM'] }, 6));
  assert.strictEqual(new Set(u.map(x => x.toLowerCase())).size, 3); assert(u.every(x => x.length <= 12));
  const long = P.mpNames(P.mpSetup({ n: 2, ai: [false, false], names: ['abcdefghijkl', 'abcdefghijkl'] }, 6)); assert(long[1].length <= 12 && long[1] !== long[0]);
  assert.deepStrictEqual(P.mpDefaults([false, true, true, false], 4), ['Player 1', 'Phone 1', 'Phone 2', 'Player 2']);
});
t('multi: standings, winners and ties', () => {
  let s = P.mpStandings([3, 7, 5]); assert.deepStrictEqual(s.rows.map(r => r.seat), [1, 2, 0]); assert.deepStrictEqual(s.winners, [1]); assert(!s.tie); assert.deepStrictEqual(s.rows.map(r => r.rank), [1, 2, 3]);
  s = P.mpStandings([4, 9, 9, 1]); assert.deepStrictEqual(s.winners, [1, 2]); assert(s.tie); assert.deepStrictEqual(s.rows.map(r => r.rank), [1, 1, 3, 4]);
  s = P.mpStandings([0, 0]); assert(s.tie && s.winners.length === 2);
  s = P.mpStandings([5]); assert(!s.tie && s.winners[0] === 0);
});
t('trivia match: turn order, same questions for every seat, reveal after the last seat', () => {
  const cfg = P.tqSetup({ n: 3, ai: [false, false, false], pack: 'space', len: 5 }), qs = P.tqRound('space', 5), m = P.tqNew(cfg, qs);
  const order = [];
  while (P.tqPhase(m) !== 'done') {
    if (P.tqPhase(m) === 'reveal') { assert.strictEqual(m.k % 3, 0); P.tqNext(m); continue; }
    const c = P.tqCur(m); order.push(c.qi + ':' + c.seat); assert.strictEqual(P.tqPlay(m, qs[c.qi].ans).right, true);
  }
  assert.deepStrictEqual(order.slice(0, 7), ['0:0', '0:1', '0:2', '1:0', '1:1', '1:2', '2:0']); assert.strictEqual(order.length, 15);
  assert.deepStrictEqual(m.scores, [5, 5, 5]); assert.strictEqual(P.tqPlay(m, 0), null);
  assert(m.picks.every(row => row.every(x => x >= 0)));
});
t('trivia match: invalid picks are refused, no play during a reveal', () => {
  const qs = P.tqRound('space', 5), m = P.tqNew(P.tqSetup({ n: 2, ai: [false, false], len: 5 }), qs);
  assert.strictEqual(P.tqPlay(m, 4), null); assert.strictEqual(P.tqPlay(m, -1), null); assert.strictEqual(P.tqPlay(m, 1.5), null); assert.strictEqual(P.tqPlay(m, 'a'), null); assert.strictEqual(m.k, 0);
  P.tqPlay(m, 0); P.tqPlay(m, 0); assert.strictEqual(P.tqPhase(m), 'reveal'); assert.strictEqual(P.tqPlay(m, 0), null);
  P.tqNext(m); assert.strictEqual(P.tqPhase(m), 'turn'); P.tqNext(m); assert.strictEqual(m.shown, 1, 'next outside a reveal does nothing');
});
t('trivia match: phone accuracy follows the level and stays in range', () => {
  const q = { opts: ['a', 'b', 'c', 'd'], ans: 2 };
  for (const lv of ['easy', 'normal', 'hard']) {
    let right = 0; const N = 6000;
    for (let i = 0; i < N; i++) { const p = P.tqPhonePick(q, lv); assert(p >= 0 && p <= 3 && Number.isInteger(p)); if (p === q.ans) right++; }
    const rate = right / N; assert(Math.abs(rate - P.TQ_ACC[lv]) < 0.04, lv + ' rate ' + rate);
  }
  assert(P.TQ_ACC.easy < P.TQ_ACC.normal && P.TQ_ACC.normal < P.TQ_ACC.hard && P.TQ_ACC.hard < 1 && P.TQ_ACC.easy > 0.25);
  assert.strictEqual(P.tqPhonePick(q, 'hard', () => 0), 2, 'low roll is right'); assert.notStrictEqual(P.tqPhonePick(q, 'hard', seq([999, 0])), 2, 'high roll is wrong');
  assert.strictEqual(P.tqPhonePick(q, 'bogus', () => 0), 2);
  for (let i = 0; i < 200; i++) assert.notStrictEqual(P.tqPhonePick(q, 'easy', seq([900, i])), 2);
});
t('trivia match: scripted 2 humans + 1 phone game finishes with the right scores', () => {
  const qs = P.tqRound('science', 5), cfg = P.tqSetup({ n: 3, ai: [false, false, true], level: 'hard', pack: 'science', len: 5 }), m = P.tqNew(cfg, qs);
  const wrongOf = (q) => (q.ans + 1) % 4;
  let humanTurns = 0, expect = [0, 0];
  P.tqAuto(m, () => 0); assert.strictEqual(P.tqCur(m).seat, 0, 'a human is up first');
  while (P.tqPhase(m) !== 'done') {
    if (P.tqPhase(m) === 'reveal') { P.tqNext(m); P.tqAuto(m, () => 0); continue; }
    const c = P.tqCur(m), q = qs[c.qi]; assert(!c.ai); humanTurns++;
    const good = (c.qi + c.seat) % 2 === 0;   // seat 0 right on even questions, seat 1 right on odd ones
    if (good) expect[c.seat]++;
    P.tqPlay(m, good ? q.ans : wrongOf(q)); P.tqAuto(m, () => 0);
  }
  assert.strictEqual(humanTurns, 10); assert.deepStrictEqual(m.scores.slice(0, 2), expect); assert.strictEqual(m.scores[2], 5, 'phone with roll 0 is always right');
  const s = P.mpStandings(m.scores); assert.deepStrictEqual(s.winners, [2]);
});
t('trivia match: a phone-first game, ties and every setup size finish', () => {
  for (let n = 2; n <= 6; n++) for (const first of [false, true]) {
    const ai = []; for (let i = 0; i < 6; i++) ai.push(i === 0 ? first : i % 2 === 1); if (ai.slice(0, n).every(Boolean)) ai[0] = false;
    const cfg = P.tqSetup({ n, ai, len: 10, level: ['easy', 'normal', 'hard'][n % 3] }), qs = P.tqRound('flags', 10), m = P.tqNew(cfg, qs); let guard = 0;
    P.tqAuto(m);
    while (P.tqPhase(m) !== 'done' && guard++ < 1000) {
      if (P.tqPhase(m) === 'reveal') { P.tqNext(m); P.tqAuto(m); continue; }
      const c = P.tqCur(m); assert(!c.ai, 'phones never stall the turn'); P.tqPlay(m, rnd4()); P.tqAuto(m);
    }
    assert.strictEqual(P.tqPhase(m), 'done'); assert.strictEqual(m.k, 10 * n); assert(m.scores.every(x => x >= 0 && x <= 10));
    const st = P.mpStandings(m.scores); assert.strictEqual(st.winners.length >= 1, true); assert.strictEqual(st.tie, st.winners.length > 1);
  }
  function rnd4() { return Math.floor(Math.random() * 4); }
  const m = P.tqNew(P.tqSetup({ n: 2, ai: [false, false], len: 5 }), P.tqRound('space', 5));
  for (let q = 0; q < 5; q++) { P.tqPlay(m, m.qs[q].ans); P.tqPlay(m, m.qs[q].ans); P.tqNext(m); }
  assert(P.mpStandings(m.scores).tie, 'equal scores are a tie');
});
t('anagram match: shared word sequence is fair, harder by position and unique', () => {
  const sq = P.arSequence(80); assert.strictEqual(sq.length, 80);
  const dict = new Set(P.sbWords());
  for (let j = 0; j < sq.length; j++) { const e = sq[j]; assert.strictEqual(e.lv, P.arLevel(j)); assert(P.arWords(e.lv).includes(e.w)); assert.notStrictEqual(e.s, e.w); assert.strictEqual(e.s.split('').sort().join(''), e.w.split('').sort().join('')); }
  assert.strictEqual(new Set(sq.map(e => e.w)).size, 80, 'no repeats within 80 words');
  assert(dict.size > 1000);
  const m = P.arNew(P.mpSetup({ n: 3, ai: [false, true, false] }, 4)); assert.strictEqual(m.seq.length, 80);
  const again = P.arSequence(10, () => 0); assert.strictEqual(again.length, 10);
});
t('anagram match: phone score model stays in range and rises with level', () => {
  const mean = (lv) => { let s = 0; for (let i = 0; i < 4000; i++) { const v = P.arPhoneScore(lv); assert(Number.isInteger(v) && v >= 0 && v <= 140, 'score ' + v); s += v; } return s / 4000; };
  const e = mean('easy'), nrm = mean('normal'), h = mean('hard');
  assert(e < nrm && nrm < h, e + ' ' + nrm + ' ' + h); assert(Math.abs(nrm - P.AR_MEAN.normal) < 3); assert(Math.abs(h - P.AR_MEAN.hard) < 4);
  assert(P.arPhoneScore('easy', () => 0) >= 0 && P.arPhoneScore('hard', () => 1000) <= 140); assert.strictEqual(typeof P.arPhoneScore('zzz'), 'number');
});
t('anagram match: scripted 2 humans + 1 phone race finishes with winner or tie', () => {
  const m = P.arNew(P.mpSetup({ n: 3, ai: [false, true, false], level: 'normal' }, 4));
  assert.strictEqual(P.arPhase(m), 'turn'); P.arAuto(m, () => 0); assert.strictEqual(m.cur, 0, 'human first, phone waits its turn');
  P.arRecord(m, 40); assert.strictEqual(m.cur, 1); P.arAuto(m, () => 500); assert.strictEqual(m.cur, 2, 'phone raced'); assert(m.scores[1] > 0);
  P.arRecord(m, m.scores[1]); assert.strictEqual(P.arPhase(m), 'done'); assert.strictEqual(P.arRecord(m, 5), false);
  const fin = P.mpStandings(m.scores); assert.strictEqual(fin.tie, new Set(m.scores).size < 3 && fin.winners.length > 1); assert(fin.winners.length >= 1);
  const t2 = P.arNew(P.mpSetup({ n: 2, ai: [false, false] }, 4)); P.arRecord(t2, 25); P.arRecord(t2, 25);
  const st = P.mpStandings(t2.scores); assert(st.tie && st.winners.length === 2);
  const t3 = P.arNew(P.mpSetup({ n: 4, ai: [true, false, true, false] }, 4)); P.arAuto(t3); assert.strictEqual(t3.cur, 1); P.arRecord(t3, -5); P.arAuto(t3); P.arRecord(t3, NaN); assert.deepStrictEqual([t3.scores[1], t3.scores[3], P.arPhase(t3)], [0, 0, 'done']); assert(t3.scores[0] !== null && t3.scores[2] !== null);
});

/*@@TESTS@@*/
console.log(failed ? failed + ' FAILED' : 'party tests: ' + n + ' passed');
process.exit(failed ? 1 : 0);
