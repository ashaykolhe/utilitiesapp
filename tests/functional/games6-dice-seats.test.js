'use strict';
/* Dice Five and Liar's Dice with several seats: setup screen, humans sharing the phone (pass and play), phone seats, hidden dice, standings. */
const { boot, suite } = require('../helpers/page');

(async () => {
  const T = suite('games6-dice-seats'), page = await boot();
  const dieLabels = (node) => (node.innerHTML.match(/aria-label="Die \d/g) || []).length;
  const saved = (id) => page.eval("Store.get('fun3." + id + "')");

  /* ---------------- Liar's Dice ---------------- */
  let t = await page.open('liarsdice');
  T.has(t.text(), 'Players', "liar's dice: setup screen shows Players");
  T.ok(t.has('#np'), "liar's dice: player count buttons"); T.eq(t.all('.seat').length, 2, "liar's dice: default is two seats");
  T.has(t.text(), 'Seat 1: 👤 Human', 'default seat 1 is human'); T.has(t.text(), 'Seat 2: 🤖 Phone', 'default seat 2 is a phone');
  t.click('#np [data-v="3"]'); T.eq(t.all('.seat').length, 3, 'three seats after choosing 3 players');
  t.clickText('Seat 2: 🤖 Phone'); T.has(t.text(), 'Seat 2: 👤 Human', 'seat 2 switched to human');
  t.type('.nm[data-s="0"]', 'Alice'); t.type('.nm[data-s="1"]', 'Bob<img src=x>');
  T.ok(t.all('.nm').every((i) => i.maxLength === 12), 'name boxes are limited to 12 characters');
  t.click('#start');
  T.eq(t.all('img').length, 0, 'a name with HTML does not create elements');
  /* Player 1 is up behind a cover with no dice anywhere in the page */
  T.has(t.text(), 'Pass the phone to Alice. Tap when only you can see the screen.', 'pass-the-phone cover for the first human');
  T.eq(dieLabels(t.el), 0, 'no dice in the page while the cover is up');
  T.ok(!t.q('#cover').hidden && t.q('#play').hidden, 'cover is shown, game screen hidden');
  const st = saved('liarsdice'); T.eq(st.np, 3, 'setup is remembered (players)'); T.eq(st.kinds.join(''), 'hhpp', 'setup is remembered (seats)');
  t.click('#show');
  const aliceDice = t.all('#me button.die').map((b) => b.getAttribute('aria-label'));
  T.eq(aliceDice.length, 5, "Alice sees her five dice"); T.eq(dieLabels(t.q('#tb')), 0, "the table shows no one's dice");
  T.has(t.text(), 'Alice: your dice', 'dice are labelled with the player');
  T.ok(t.all('#tb [aria-label="Hidden die"]').length === 15, 'all 15 dice on the table are hidden (5 x 3 seats)');
  t.click('[data-a="bid"]');
  /* now the other human */
  T.has(t.text(), 'Pass the phone to Bobimg src=x', 'cover for the second human (tags stripped, 12 characters)');
  T.eq(dieLabels(t.el), 0, "Alice's dice are gone from the page when Bob is up");
  T.has(t.text(), 'Tap when only you can see the screen', 'cover wording');
  t.click('#show');
  T.eq(t.all('#me button.die').length, 5, "the second human sees five dice");
  T.eq(dieLabels(t.q('#tb')), 0, "table still hides everyone's dice");
  T.has(t.text(), 'bids 1 ×', "the first bid is announced"); T.has(t.text(), 'Current bid', 'current bid is shown');
  /* Bob raises; Phone 1 acts on its own */
  t.click('[data-a="qp"]'); t.click('[data-a="bid"]');
  T.has(t.text(), 'Phone 1', 'phone seat is up next'); T.eq(dieLabels(t.el), 0, 'no dice visible while the phone plays');
  await page.wait(1500);
  const txt = t.text();
  T.ok(/Phone 1 bids|Phone 1 calls Liar/.test(txt) || /Pass the phone to/.test(txt), 'phone seat acted on its own: ' + txt.slice(0, 80));
  if (/Pass the phone to/.test(txt)) { T.eq(dieLabels(t.el), 0, 'cover again before the next human'); t.click('#show'); T.eq(t.all('#me button.die').length > 0, true, 'dice appear after the tap'); t.click('[data-a="liar"]'); }
  else if (t.has('[data-a="liar"]')) t.click('[data-a="liar"]');
  T.has(t.text(), 'calls Liar', 'a challenge reveals the dice');
  T.ok(dieLabels(t.q('#tb')) >= 3, 'after the challenge all dice are revealed on the table');
  T.ok(t.has('[data-a="next"]'), 'next round button');
  t.click('#menu'); T.has(t.text(), 'Players', 'New game returns to the setup');
  t.close();

  /* one human and one phone: the default experience has no cover */
  t = await page.open('liarsdice');
  t.click('#np [data-v="2"]');
  t.clickText('Seat 2: 👤 Human'); t.clickText('Seat 1: 👤 Human'); T.ok(t.q('#start').disabled, 'no human seat: Start is disabled'); T.has(t.text(), 'Pick at least one human seat', 'message explains it');
  t.clickText('Seat 1: 🤖 Phone'); T.has(t.text(), 'Seat 2: 🤖 Phone', 'seat 2 is a phone');
  t.click('#start');
  await page.wait(1400);
  T.ok(!/Pass the phone/.test(t.text()), 'a single human gets no cover');
  T.eq(t.all('#me button.die').length > 0 || /Phone 1/.test(t.text()), true, 'game runs with one human');
  t.close(); /* leaving cancels the phone's timers */
  await page.wait(1300);

  /* ---------------- Dice Five ---------------- */
  t = await page.open('dicefive');
  T.has(t.text(), 'Players', 'dice five: setup screen'); T.eq(t.all('.seat').length, 1, 'dice five: default is one human playing alone');
  t.click('#start'); T.eq(t.all('#sc th').length, 2, 'solo: one scorecard column');
  t.click('#roll'); T.has(t.text(), 'Roll again (2 left)', 'solo roll works');
  t.click('button[data-c]'); T.has(t.text(), 'scored', 'solo: a box is filled');
  T.eq(saved('dicefive').np, 1, 'dice five remembers one seat');
  t.click('#new'); T.has(t.text(), 'Players', 'New game returns to the setup');
  t.click('#np [data-v="2"]'); t.clickText('Seat 2: 🤖 Phone'); T.has(t.text(), 'Seat 2: 👤 Human', 'seat 2 now human');
  t.type('.nm[data-s="0"]', 'Ann'); t.type('.nm[data-s="1"]', 'Ben');
  t.click('#start');
  T.eq(t.all('#sc th').length, 3, 'two scorecards'); T.has(t.text(), '▶ Ann', 'current seat is marked with an arrow');
  T.has(t.text(), 'Turn order: [Ann] → Ben', 'turn order is shown');
  let turns = 0;
  while (!/Final standings/.test(t.text()) && turns < 40) {
    t.click('#roll'); const b = t.all('button[data-c]'); T.ok(b.length > 0, 'a legal box exists'); if (!b.length) break;
    b[Math.floor(Math.random() * b.length)].click(); turns++;
    if (turns === 1) T.has(t.text(), 'Ben: your turn, roll!', 'the next human is told it is their turn');
  }
  T.eq(turns, 26, 'two humans fill 13 boxes each'); T.has(t.text(), 'Final standings', 'standings shown');
  const totals = t.all('#sc tr').find((r) => /^Total/.test(r.textContent)).querySelectorAll('td'), a = +totals[1].textContent, b2 = +totals[2].textContent;
  const msg = t.q('#msg').textContent;
  if (a === b2) T.has(msg, 'Tie', 'a tie is announced'); else T.has(msg, (a > b2 ? 'Ann' : 'Ben') + ' wins with ' + Math.max(a, b2), 'the higher total wins');
  T.has(t.q('#stand').textContent, a + ' points', 'standings list the totals'); T.has(t.q('#stand').textContent, '1st', 'standings are ranked');
  T.eq(saved('dicefive').gp >= 1, true, 'games played is saved for Human 1');
  T.ok(t.q('#msg').getAttribute('aria-live') === 'polite', 'result line is a live region');
  t.close();

  /* a human and a phone: the phone seat plays by itself, and leaving mid-game is clean */
  t = await page.open('dicefive');
  t.click('#np [data-v="2"]'); t.clickText('Seat 2: 👤 Human'); T.has(t.text(), 'Seat 2: 🤖 Phone', 'seat 2 is a phone'); t.click('#start');
  t.click('#roll'); t.click('button[data-c]');
  T.has(t.text(), 'Phone 1', 'the phone is up');
  await page.wait(700); T.has(t.q('#msg').textContent, 'Phone 1', 'phone message names the seat');
  t.close(); await page.wait(1500);

  await T.done(page);
})();
