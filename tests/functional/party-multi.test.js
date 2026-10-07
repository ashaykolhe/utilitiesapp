'use strict';
/* Trivia Packs and Anagram Race: solo still works, and a 2 human + 1 phone game can be played through the real screens. */
const { boot, suite } = require('../helpers/page');

(async () => {
  const T = suite('party-multi'), page = await boot();
  const w = page.w;
  const perms = (s) => { if (s.length <= 1) return [s]; const out = new Set(); for (let i = 0; i < s.length; i++) for (const p of perms(s.slice(0, i) + s.slice(i + 1))) out.add(s[i] + p); return [...out]; };
  const setSeats = (t, n, types, names) => {
    t.select('#mpN', n);
    t.all('.mpType').forEach((s, i) => { if (types[i] !== undefined) t.select('.mpType[data-i="' + i + '"]', types[i]); });
    (names || []).forEach((nm, i) => t.type('.mpName[data-i="' + i + '"]', nm));
  };

  /* ---------------- Trivia Packs ---------------- */
  {
    let t = await page.open('triviapacks');
    T.has(t.text(), 'Daily five', 'trivia: the solo menu is still the default');
    T.has(t.text(), 'Play with others', 'trivia: there is a way into the multi-player setup');
    // solo round still works and saves its best score
    t.click('[data-a="pack"][data-p="science"]');
    for (let i = 0; i < 10; i++) { t.click('[data-a="ans"]'); t.click('[data-a="next"]'); }
    T.has(t.text(), '/10', 'trivia: a solo round still finishes');
    t.click('[data-a="menu"]');
    T.ok(/best \d+\/10/.test(t.text()), 'trivia: the solo best score is still saved');
    t.click('[data-a="mpsetup"]');
    // defaults of the setup screen
    T.eq(t.value('#mpN'), '2', 'trivia: two seats by default');
    T.eq(t.value('.mpType[data-i="0"]'), '0', 'trivia: seat 1 is human'); T.eq(t.value('.mpType[data-i="1"]'), '1', 'trivia: seat 2 is the phone');
    T.eq(t.q('.mpName[data-i="0"]').placeholder, 'Player 1', 'trivia: default human name'); T.eq(t.q('.mpName[data-i="1"]').placeholder, 'Phone 1', 'trivia: default phone name');
    T.eq(t.q('.mpName[data-i="0"]').maxLength, 12, 'trivia: names are limited to 12 characters');
    T.eq(t.all('.mpSeat').filter(r => r.style.display !== 'none').length, 2, 'trivia: only two seat rows show');
    T.eq(t.q('#mpWarn').getAttribute('role'), 'status', 'trivia: setup messages are a live region');
    T.ok(t.all('.mpName,.mpType,#mpN,#mpLevel,#mpPack,#mpLen').every(e => /min-height:\s*44px/.test(e.getAttribute('style'))), 'trivia: setup controls are at least 44 px tall');
    t.select('#mpN', 3); T.eq(t.all('.mpSeat').filter(r => r.style.display !== 'none').length, 3, 'trivia: three seats show after choosing 3');
    t.select('#mpN', 2); t.select('.mpType[data-i="0"]', 1);
    T.eq(t.value('.mpType[data-i="0"]'), '0', 'trivia: an all-phone setup is turned back into one with a human'); T.has(t.q('#mpWarn').textContent, 'At least one seat', 'trivia: and says so');
    // 2 humans + 1 phone, scripted names, 5 questions
    setSeats(t, 3, ['0', '0', '1'], ['Ann', '<b>Bo</b>']);
    T.eq(t.q('.mpName[data-i="2"]').placeholder, 'Phone 1', 'trivia: third seat default name');
    t.select('#mpPack', 'space'); t.select('#mpLen', 5); t.select('#mpLevel', 'hard');
    t.click('[data-a="mpstart"]');
    T.ok(!t.all('b').some(x => x.textContent === 'Bo'), 'trivia: names are escaped, no markup from a name');
    const tally = [0, 0, 0], asked = [];
    for (let q = 0; q < 5; q++) {
      T.has(t.q('[role=status]').textContent, 'Turn: Ann', 'trivia q' + q + ': it is Ann\'s turn (live region)');
      T.eq(t.all('#tqOpts button').length, 4, 'trivia: four options for a human');
      asked.push(t.q('.mid').textContent);
      T.has(t.text(), 'question ' + (q + 1) + ' of 5', 'trivia: progress shows');
      T.ok(t.all('#tqOpts button').every(b => /min-height:\s*48px/.test(b.getAttribute('style'))), 'trivia: options are tall enough');
      t.all('#tqOpts button')[q % 4].click();                       // Ann picks a fixed option
      T.has(t.text(), 'Pass the phone to <b>Bo</b>', 'trivia: pass-the-phone screen shows the next name as text');
      T.ok(!t.has('#tqOpts'), 'trivia: the question is hidden while passing the phone');
      t.click('[data-a="mpgo"]');
      T.has(t.q('[role=status]').textContent, 'Turn: <b>Bo</b>', 'trivia: Bo is up');
      t.all('#tqOpts button')[(q + 1) % 4].click();                 // Bo picks another one; the phone answers by itself
      const txt = t.text();
      T.has(txt, 'The correct answer is', 'trivia: the correct answer is shown after everyone answered');
      T.has(t.q('[role=status]').textContent, 'The correct answer is', 'trivia: the answer line is a live region');
      const lines = t.all('.list .item').filter(x => /Right|Wrong/.test(x.textContent));
      T.eq(lines.length, 3, 'trivia: one result line per seat'); T.ok(lines.every(x => /✓ Right|✗ Wrong/.test(x.textContent)), 'trivia: results are words and symbols, not only colour');
      lines.forEach((x, i) => { if (/✓ Right/.test(x.textContent)) tally[i]++; });
      t.click('[data-a="mpnext"]');
    }
    const fin = t.text();
    T.ok(/Winner:|It is a tie/.test(fin), 'trivia: final standings name a winner or a tie');
    T.ok(/Winner:|tie/.test(t.q('[role=status]').textContent), 'trivia: the verdict is a live region');
    const rows = t.all('[aria-label="Final standings"] .item').map(x => x.textContent);
    T.eq(rows.length, 3, 'trivia: three standing rows');
    const names = ['Ann', '<b>Bo</b>', 'Phone 1'];
    names.forEach((nm, i) => { const r = rows.find(x => x.includes(nm)); T.ok(r && new RegExp(tally[i] + ' correct').test(r), 'trivia: ' + nm + ' final score ' + tally[i] + ' matches the reveal screens (' + (r || 'none') + ')'); });
    T.ok(asked.length === 5 && new Set(asked).size === 5, 'trivia: five different questions were asked');
    // setup is remembered
    t.click('[data-a="mpsetup"]');
    T.eq(t.value('#mpN'), '3', 'trivia: seats are remembered'); T.eq(t.value('.mpName[data-i="0"]'), 'Ann', 'trivia: names are remembered'); T.eq(t.value('#mpPack'), 'space', 'trivia: pack remembered');
    T.eq(t.value('#mpLen'), '5', 'trivia: round length remembered'); T.eq(t.value('#mpLevel'), 'hard', 'trivia: level remembered'); T.eq(t.value('.mpType[data-i="2"]'), '1', 'trivia: seat types remembered');
    t.click('[data-a="mpstart"]');
    t.click('[data-a="mpquit"]'); T.has(t.text(), 'Daily five', 'trivia: quit goes back to the packs');
    // all-phone-first order: a phone in seat 1 answers on its own before the human
    t.click('[data-a="mpsetup"]'); setSeats(t, 2, ['1', '0'], ['', 'Zoe']); t.click('[data-a="mpstart"]');
    T.has(t.q('[role=status]').textContent, 'Turn: Zoe', 'trivia: a phone in seat 1 does not stall the turn');
    // solo stats were untouched by the multi-player games
    t.click('[data-a="mpquit"]'); T.ok(/best \d+\/10/.test(t.text()), 'trivia: solo bests survive');
    t.close();
  }

  /* ---------------- Anagram Race ---------------- */
  {
    const t = await page.open('anagramrace');
    w.eval('var __dn = Date.now; window.__off = 0; Date.now = function () { return __dn() + window.__off; };');
    T.has(t.text(), 'Start', 'anagram: solo start is still there'); T.has(t.text(), 'Play with others', 'anagram: multi-player entry exists');
    t.click('[data-a="mpsetup"]');
    T.eq(t.all('#mpN option').length, 3, 'anagram: 2 to 4 seats'); T.eq(t.all('.mpSeat').length, 4, 'anagram: four seat rows exist');
    t.select('#mpN', 3); setSeats(t, 3, ['0', '0', '1'], ['Ann', 'Bo']);
    t.click('[data-a="mpstart"]');
    T.has(t.text(), 'Next up: Ann', 'anagram: Ann races first'); T.eq(t.q('[role=status]').getAttribute('aria-live'), 'polite', 'anagram: result line is a live region');
    t.click('[data-a="mpgo"]');
    T.has(t.q('[role=status]').textContent, 'Racing now: Ann', 'anagram: whose race it is'); T.has(t.text(), 'Time', 'anagram: a clock shows');
    const firstWords = [];
    // solve the first word by trying every arrangement of the letters (any arrangement that is a real word is accepted)
    const letters = () => t.all('#arLetters button').map(b => b.dataset.l).join('');
    firstWords.push(letters());
    let solved = false;
    for (const p of perms(letters())) { t.type('#arIn', p); if (t.q('#arMsg').textContent === 'Correct!') { solved = true; break; } }
    T.ok(solved, 'anagram: a human can solve a word in the multi-player race'); T.ok(+t.q('#arScore').textContent > 0, 'anagram: the score grew');
    const annScore = +t.q('#arScore').textContent;
    firstWords.push(letters());
    w.__off = 70000;   // jump past the 60 seconds
    await page.wait(500); w.__off = 0;
    T.has(t.text(), 'Time is up! Ann scored ' + annScore, 'anagram: the finished race is announced');
    T.has(t.text(), 'Next up: Bo', 'anagram: Bo is next'); T.has(t.text(), 'Ann', 'anagram: scoreboard lists Ann');
    t.click('[data-a="mpgo"]');
    T.has(t.q('[role=status]').textContent, 'Racing now: Bo', 'anagram: Bo is racing');
    // fairness: Bo gets the same first scramble as Ann did
    T.eq(letters(), firstWords[0], 'anagram: every seat races the same word sequence');
    t.click('[data-a="skip"]'); T.eq(letters(), firstWords[1], 'anagram: and the same second word'); T.has(t.q('#arMsg').textContent, 'Skipped', 'anagram: skip still works');
    w.__off = 70000; await page.wait(500); w.__off = 0;
    const fin = t.text();
    T.has(fin, 'Phone 1', 'anagram: the phone seat is in the standings'); T.ok(/Winner:|It is a tie/.test(t.q('[role=status]').textContent), 'anagram: a winner or tie is announced in a live region');
    const rows = t.all('[aria-label="Final standings"] .item').map(x => x.textContent);
    T.eq(rows.length, 3, 'anagram: three standing rows');
    T.ok(rows.some(r => r.includes('Ann') && r.includes(annScore + ' points')), 'anagram: Ann score is in the standings');
    T.ok(rows.some(r => r.includes('Bo') && r.includes('0 points')), 'anagram: Bo (all skips) scored 0');
    T.ok(rows.some(r => r.includes('Phone 1') && /\d+ points/.test(r)), 'anagram: the phone has a modelled score');
    T.ok(t.all('button[data-a]').every(b => /min-height:\s*48px/.test(b.getAttribute('style') || '')), 'anagram: final buttons are tall');
    t.click('[data-a="mpagain"]'); T.has(t.text(), 'Next up: Ann', 'anagram: race again starts a new match');
    t.click('[data-a="mpgo"]'); t.close(); await page.wait(300);   // leaving mid-race stops the clock
    T.ok(true, 'anagram: leaving mid-race does not throw');
  }

  await T.done(page);
})();
