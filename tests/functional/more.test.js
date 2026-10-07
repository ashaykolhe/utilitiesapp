'use strict';
/* Functional tests, more.js part 1: Currency, Recipe Scaler, Holidays, Flashcards, Morse Trainer, Paint Mixer, Pixel Art, Signature Pad.
   Pure logic is also checked by running the PURE blocks of more.js directly against independent reference values. */
const fs = require('fs'), path = require('path');
const { suite } = require('../helpers/page');
const { bootFx, clock, fakeShare } = require('./fx');

/* The DOM-free blocks of more.js, evaluated on their own. */
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'www', 'js', 'tools', 'more.js'), 'utf8');
const blocks = [...src.matchAll(/\/\/ ==PURE-START==([\s\S]*?)\/\/ ==PURE-END==/g)].map((m) => m[1]).join('\n');
const P = new Function('const p2 = (n) => String(n).padStart(2, "0");\n' + blocks + '\nreturn { easter, holidaysOf, nthDow, fcReview, fcNew, fcParse, fcExport, fcStats, mtSegments, mtUnit, hex2rgb, rgb2hex, mixColours, rotateHue, palettes, pxFill, pxLine, sigBounds, meetingCost, clock, weeksLived, dayFromStr, findAnagrams, findFrom, findPattern, WORDS, fibList, primesTo, collatz, factorise, mxAdd, mxMul, mxDet, mxInv, mxT, mxParseCell, trigExact, radLabel, ELEMENTS, EL_CATS, COUNTRIES, ccSearch, flagOf, cbPixel, asciiArt, genName, NG, medianCut, scaleLine, scaleRecipe, fmtQty, parseQty, curConvert, CUR };')();

(async () => {
  const T = suite('more-1'), page = await bootFx(), w = page.w;
  const log = (m) => { if (process.env.V) console.log('>> ' + m + ' errors=' + page.errors.length); };
  const toastText = () => w.document.querySelector('#toast').textContent;
  const defNav = (name, value) => Object.defineProperty(w.navigator, name, { value, configurable: true });
  const copied = []; defNav('clipboard', { writeText: async (t) => { copied.push(t); }, readText: async () => '' });
  const store = (k) => JSON.parse(w.localStorage.getItem('pk.' + k) || 'null');
  const put = (k, v) => w.localStorage.setItem('pk.' + k, JSON.stringify(v));
  w.Element.prototype.scrollIntoView = function () {};
  w.Element.prototype.setPointerCapture = function () {};
  w.HTMLCanvasElement.prototype.getBoundingClientRect = function () { return { left: 0, top: 0, width: 512, height: 512 }; };
  const clk = clock(page, '2026-03-10T10:00:00Z');
  const share = fakeShare(page);
  const loc = (n, d) => n.toLocaleString(undefined, { maximumFractionDigits: d });

  /* ---------- Currency ---------- */
  log('currency');
  {
    let t = await page.open('currency');
    T.has(t.q('#out').textContent, loc(8350, 2) + ' INR', 'currency: 100 USD at 83.5 is 8,350 INR');
    T.has(t.q('#out').textContent, '1 USD = 83.5 INR', 'currency: rate line');
    t.type('#am', '250'); T.has(t.q('#out').textContent, loc(20875, 2) + ' INR', 'currency: 250 USD is 20,875 INR');
    t.select('#fr', 'JPY'); t.select('#to', 'USD'); t.type('#am', '100');
    T.has(t.q('#out').textContent, '0.666667 USD', 'currency: 100 JPY at 150 per USD is 0.666667 USD');
    t.select('#fr', 'EUR'); t.select('#to', 'GBP'); t.type('#am', '100');
    T.has(t.q('#out').textContent, loc(100 / 0.92 * 0.79, 4) + ' GBP', 'currency: EUR to GBP goes through USD (85.8696)');
    t.click('#sw'); T.has(t.q('#out').textContent, loc(100 / 0.79 * 0.92, 4) + ' EUR', 'currency: swap makes GBP to EUR');
    T.eq(store('currency.from'), 'GBP', 'currency: swap remembered');
    t.type('#am', ''); T.has(t.q('#out').textContent, 'Enter an amount', 'currency: empty amount');
    t.type('#am', '1e30'); T.ok(!/NaN|Infinity/.test(t.text()), 'currency: huge amount shows no NaN');
    /* favourites */
    t.select('#to', 'JPY'); t.click('#fv');
    T.ok(store('currency.favs').includes('JPY'), 'currency: add to favourites');
    t.click('[data-r="JPY"]'); T.ok(!store('currency.favs').includes('JPY'), 'currency: remove favourite');
    /* edit rates */
    t.select('#fr', 'USD'); t.select('#to', 'INR'); t.type('#am', '100');
    t.click('#ed');
    t.type('[data-c="INR"]', '85'); t.type('[data-c="EUR"]', '0.9');
    t.click('#sa');
    T.eq(toastText(), 'Rates saved', 'currency: rates saved');
    T.has(t.text(), 'last edited: 2026-03-10', 'currency: edited date shown');
    T.has(t.q('#out').textContent, loc(8500, 2) + ' INR', 'currency: edited rate used (100 USD = 8,500 INR)');
    t.select('#fr', 'EUR'); T.has(t.q('#out').textContent, loc(100 / 0.9 * 85, 2) + ' INR', 'currency: edited cross rate 100 EUR = 9,444.44 INR');
    t.click('#ed'); t.type('[data-c="INR"]', ''); t.click('#sa');
    T.has(toastText(), 'Check INR', 'currency: an empty rate is refused');
    t.click('#cn');
    T.has(t.q('#out').textContent, loc(100 / 0.9 * 85, 2), 'currency: Cancel keeps the saved rates');
    t.close();
    t = await page.open('currency');
    T.has(t.q('#out').textContent, loc(100 / 0.9 * 85, 2) + ' INR', 'currency: edited rates remembered after reopening');
    t.click('#ed'); t.click('#rs'); T.eq(toastText(), 'Built-in rates restored', 'currency: reset');
    t.select('#fr', 'USD'); T.has(t.q('#out').textContent, loc(8350, 2) + ' INR', 'currency: built-in rate back');
    await clk.advance(1600);
    T.ok((store('hist') || []).some((x) => x.t === 'currency'), 'currency: settled result goes to the history');
    t.close();
    for (const [a, b, r, want] of [['USD', 'EUR', { USD: 1, EUR: 0.5 }, 5], ['EUR', 'USD', { USD: 1, EUR: 0.5 }, 20]]) T.eq(P.curConvert(10, a, b, r), want, 'currency: pure ' + a + ' to ' + b);
    T.ok(Number.isNaN(P.curConvert(10, 'USD', 'XXX', { USD: 1 })), 'currency: unknown currency gives NaN');
    T.eq(P.CUR.length, 37, 'currency: 37 currencies listed'); T.eq(new Set(P.CUR.map((c) => c[0])).size, 37, 'currency: codes are unique');
  }

  /* ---------- Recipe Scaler ---------- */
  log('recipescale');
  {
    let t = await page.open('recipescale');
    t.type('#to', '6');
    T.eq(t.q('#res').textContent, '3 cups flour\n2 1/4 tsp baking powder\n1 1/8 cup sugar\n3 3/4 tbsp butter\n1 1/2 egg\n3/4 cup milk\nPinch of salt', 'recipescale: default recipe from 4 to 6 servings (x1.5)');
    T.eq(t.q('#kk').textContent, '1.5', 'recipescale: factor shown');
    t.type('#tx', '1 1/2 cups milk\n2-3 tbsp oil\n1 to 2 tsp salt\n1½ cups rice\n200g flour\n1/3 cup water\n0.25 tsp pepper\n¾ cup sugar\n2 tomatoes\nSalt to taste\n\nAdd 2 eggs');
    t.type('#fr', '2'); t.type('#to', '4');
    T.eq(t.q('#res').textContent, '3 cups milk\n4-6 tbsp oil\n2-4 tsp salt\n3 cups rice\n400g flour\n2/3 cup water\n1/2 tsp pepper\n1 1/2 cup sugar\n4 tomatoes\nSalt to taste\n\nAdd 2 eggs', 'recipescale: mixed fractions, ranges, unicode fractions, attached units, text lines (x2)');
    t.type('#to', '3'); T.eq(t.q('#res').textContent.split('\n')[0], '2 1/4 cups milk', 'recipescale: 1 1/2 x 1.5 = 2 1/4');
    t.type('#to', '1'); T.eq(t.q('#res').textContent.split('\n').slice(0, 2).join('|'), '3/4 cups milk|1-1 1/2 tbsp oil', 'recipescale: x0.5 (3/4, and the range 1-1 1/2)');
    t.click('[data-m="2"]'); T.eq(t.value('#to'), '4', 'recipescale: Double button sets servings to twice the original');
    t.click('[data-m="0.5"]'); T.eq(t.value('#to'), '1', 'recipescale: Half button');
    t.type('#nm', 'Test cake'); t.click('#sa');
    T.eq(store('recipescale.list').length, 1, 'recipescale: recipe saved');
    T.eq(store('recipescale.list')[0].name, 'Test cake', 'recipescale: saved name');
    t.click('#nw'); T.eq(t.value('#tx'), '', 'recipescale: New clears the text');
    t.click('[data-o]'); T.has(t.value('#tx'), '1 1/2 cups milk', 'recipescale: opening a saved recipe loads it');
    t.click('#cp'); await page.wait(10); T.has(copied[copied.length - 1], '3/4 cups milk', 'recipescale: Copy scaled');
    t.click('[data-d]'); T.eq(store('recipescale.list').length, 0, 'recipescale: delete saved recipe');
    t.type('#tx', ''); t.click('#sa'); T.eq(toastText(), 'Add some ingredients first', 'recipescale: empty recipe not saved');
    t.close();
    /* pure formatting */
    for (const [n, want] of [[0.5, '1/2'], [1 / 3, '1/3'], [2 / 3, '2/3'], [0.125, '1/8'], [0.1, '0.1'], [2.25, '2 1/4'], [3, '3'], [2.999, '3'], [0.87, '7/8'], [0, '0'], [12.5, '12 1/2'], [1.5 * 2 / 3, '1']]) T.eq(P.fmtQty(n), want, 'recipescale: fmtQty(' + n + ')');
    T.eq(P.scaleLine('2 cups flour', 0.5), '1 cups flour', 'recipescale: units are not made singular');
    T.eq(P.scaleLine('Pinch of salt', 3), 'Pinch of salt', 'recipescale: no quantity, no change');
    T.eq(P.scaleLine('1,5 kg potatoes', 2), '3 kg potatoes', 'recipescale: decimal comma');
    T.eq(P.scaleRecipe('1 egg', 0, 4), '1 egg', 'recipescale: zero original servings leaves the text alone');
  }

  /* ---------- Holiday Calendar ---------- */
  log('holidays');
  {
    /* independent Easter: Gauss/Oudin algorithm (different from the code under test), checked against published dates */
    const easterOudin = (y) => { const g = y % 19, c = Math.floor(y / 100), h = (c - Math.floor(c / 4) - Math.floor((8 * c + 13) / 25) + 19 * g + 15) % 30, i = h - Math.floor(h / 28) * (1 - Math.floor(29 / (h + 1)) * Math.floor((21 - g) / 11)), j = (y + Math.floor(y / 4) + i + 2 - c + Math.floor(c / 4)) % 7, l = i - j, m = 3 + Math.floor((l + 40) / 44), d = l + 28 - 31 * Math.floor(m / 4); return [m, d]; };
    const known = { 2024: [3, 31], 2025: [4, 20], 2026: [4, 5], 2027: [3, 28], 2028: [4, 16], 2029: [4, 1], 2030: [4, 21], 2031: [4, 13], 2000: [4, 23], 1999: [4, 4], 2038: [4, 25], 2019: [4, 21] };
    for (const y of Object.keys(known)) { const e = P.easter(+y); T.eq((e.m + 1) + '/' + e.d, known[y].join('/'), 'holidays: Easter ' + y + ' is ' + known[y].join('/') + ' (month/day)'); }
    let bad = 0; for (let y = 1900; y <= 2100; y++) { const e = P.easter(y), o = easterOudin(y); if (e.m + 1 !== o[0] || e.d !== o[1]) bad++; }
    T.eq(bad, 0, 'holidays: Easter 1900 to 2100 matches an independent algorithm');
    for (const [y, m, d] of [[2024, 4, 12], [2025, 4, 11], [2026, 4, 10]]) T.eq(P.nthDow(y, m, 0, 2), d, 'holidays: second Sunday of May ' + y + ' is the ' + d + 'th');
    for (const [y, d] of [[2024, 16], [2025, 15], [2026, 21]]) T.eq(P.nthDow(y, 5, 0, 3), d, 'holidays: third Sunday of June ' + y + ' is the ' + d + 'th');
    /* the screen: month list for each Easter */
    const monthItems = (t) => t.all('.card').find((c) => c.textContent.startsWith('This month')).querySelectorAll('.item');
    const listOf = (t) => [...monthItems(t)].map((i) => i.querySelector('b').textContent + ' ' + i.querySelector('.grow').textContent);
    for (const [y, m, d] of [[2024, 3, 31], [2025, 4, 20], [2026, 4, 5], [2027, 3, 28], [2028, 4, 16], [2029, 4, 1], [2030, 4, 21]]) {
      clk.set(y + '-' + String(m).padStart(2, '0') + '-01T10:00:00Z');
      const t = await page.open('holidays');
      T.ok(listOf(t).includes(d + ' Easter Sunday'), 'holidays: screen lists Easter Sunday ' + y + ' on ' + d + ' ' + ['', '', '', 'March', 'April'][m]);
      t.close();
    }
    clk.set('2024-03-01T10:00:00Z'); let t = await page.open('holidays');
    T.ok(listOf(t).includes('29 Good Friday'), 'holidays: Good Friday 2024 is 29 March');
    t.click('#nx'); T.ok(listOf(t).includes('1 Easter Monday'), 'holidays: Easter Monday 2024 is 1 April');
    t.click('#nx'); T.ok(listOf(t).includes('12 Mother\'s Day'), 'holidays: Mother\'s Day 2024 is 12 May');
    t.click('#nx'); T.ok(listOf(t).includes('16 Father\'s Day'), 'holidays: Father\'s Day 2024 is 16 June');
    t.close();
    clk.set('2026-01-10T10:00:00Z'); t = await page.open('holidays');
    T.ok(listOf(t).includes('26 Republic Day'), 'holidays: Republic Day 26 January');
    t.click('[data-k="in"]'); T.ok(!listOf(t).includes('26 Republic Day'), 'holidays: unticking India hides Indian holidays');
    T.ok(listOf(t).includes('1 New Year\'s Day'), 'holidays: international holidays stay');
    T.eq(store('holidays.show').in, false, 'holidays: filter remembered');
    t.click('[data-k="in"]');
    /* own events */
    t.type('#et', 'Anniversary'); t.type('#ed', '2026-01-20'); t.check('#ey', true); t.click('#ea');
    T.eq(toastText(), 'Event added', 'holidays: own event added');
    T.ok(listOf(t).includes('20 Anniversary'), 'holidays: own event listed');
    t.close();
    clk.set('2028-01-05T10:00:00Z'); t = await page.open('holidays');
    T.ok(listOf(t).includes('20 Anniversary'), 'holidays: a yearly event repeats in later years');
    t.close();
    clk.set('2025-01-05T10:00:00Z'); t = await page.open('holidays');
    T.ok(!listOf(t).includes('20 Anniversary'), 'holidays: a yearly event does not appear before its first year');
    t.type('#et', ''); t.click('#ea'); T.eq(toastText(), 'Give the event a title', 'holidays: title required');
    t.click('[data-d="2025-01-26"]'); T.has(t.text(), 'Republic Day', 'holidays: selecting a day shows its events');
    t.close(); w.localStorage.removeItem('pk.holidays.events'); w.localStorage.removeItem('pk.holidays.show');
    clk.set('2026-03-10T10:00:00Z');
  }

  /* ---------- Flashcards ---------- */
  log('flashcards');
  {
    const day = (iso) => Math.floor(Date.parse(iso) / 864e5);
    const today = day('2026-03-10');
    /* Leitner schedule (pure) */
    let c = P.fcNew('q', 'a', today, 'id1'), dues = [];
    for (let i = 0; i < 6; i++) { c = P.fcReview(c, true, today); dues.push(c.box + ':' + (c.due - today)); }
    T.eq(dues.join(), '2:2,3:4,4:8,5:16,5:16,5:16', 'flashcards: Leitner boxes and intervals 2, 4, 8, 16, 16 days');
    c = P.fcReview(c, false, today); T.eq(c.box + ':' + (c.due - today), '1:1', 'flashcards: a miss sends the card to box 1, due in 1 day');
    T.eq(c.seen, 7, 'flashcards: seen count'); T.eq(c.right, 6, 'flashcards: right count');
    T.eq(JSON.stringify(P.fcParse('# Spanish\nhola :: hello\n\ngracias\tthank you\nbad line\n:: nothing\nno answer ::\n# Empty')), JSON.stringify([{ name: 'Spanish', cards: [{ q: 'hola', a: 'hello' }, { q: 'gracias', a: 'thank you' }] }, { name: 'Empty', cards: [] }]), 'flashcards: text import format');
    let t = await page.open('flashcards');
    T.has(t.text(), 'No decks yet', 'flashcards: empty state');
    t.click('#da'); T.eq(toastText(), 'Name the deck', 'flashcards: deck needs a name');
    t.type('#im', '# Spanish\nhola :: hello\ngracias :: thank you'); t.click('#ib');
    T.eq(toastText(), 'Imported 2 cards', 'flashcards: imported 2 cards');
    T.has(t.text(), '2 due', 'flashcards: 2 due');
    t.click('[data-o]');
    const q1 = t.q('.card.center').textContent;
    t.click('#sh'); t.click('#yes');
    let decks = store('flashcards.decks'), d = decks[0];
    T.eq(d.cards.filter((x) => x.box === 2).length, 1, 'flashcards: a correct answer moves the card to box 2');
    T.eq(d.cards.find((x) => x.box === 2).due, today + 2, 'flashcards: box 2 card is due in 2 days');
    t.click('#sh'); t.click('#no');
    d = store('flashcards.decks')[0];
    T.eq(d.cards.filter((x) => x.box === 1 && x.seen === 1).length, 1, 'flashcards: a miss keeps the card in box 1');
    T.has(t.text(), 'Card 3 of 3', 'flashcards: a missed card is asked again at the end of this round (3 cards in the queue)');
    t.click('#sh'); t.click('#yes');
    d = store('flashcards.decks')[0];
    T.eq(d.cards.map((x) => x.box).join(), '2,2', 'flashcards: both cards in box 2 after the round');
    T.has(t.text(), 'All caught up', 'flashcards: finished the round');
    T.has(t.text(), 'Next card is due in 2 days', 'flashcards: next due in 2 days');
    t.clickText('Stats'); T.has(t.text(), '67%', 'flashcards: accuracy 2 of 3 = 67%');
    T.has(t.text(), 'Total reviews: 3', 'flashcards: total reviews');
    t.clickText('Cards'); t.type('#q', 'uno'); t.type('#a', 'one'); t.click('#ad');
    T.eq(store('flashcards.decks')[0].cards.length, 3, 'flashcards: add a card');
    t.type('#q', 'only front'); t.click('#ad'); T.eq(toastText(), 'Fill both sides', 'flashcards: both sides needed');
    t.clickText('Text'); T.has(t.q('#ex').value, '# Spanish\nhola :: hello\ngracias :: thank you\nuno :: one', 'flashcards: export text');
    t.type('#im', 'dos :: two'); t.click('#ib'); T.eq(store('flashcards.decks')[0].cards.length, 4, 'flashcards: add cards from text');
    t.type('#im', Array.from({ length: 2100 }, (_, i) => 'q' + i + ' :: a' + i).join('\n')); t.click('#ib');
    T.eq(store('flashcards.decks')[0].cards.length, 2000, 'flashcards: deck is capped at 2000 cards');
    t.clickText('Cards'); t.click('#dd');
    T.has(t.text(), 'No decks yet', 'flashcards: deck deleted');
    t.close();
    /* due dates follow the clock */
    put('flashcards.decks', [{ id: 'd1', name: 'D', cards: [{ id: 'a', q: 'Q', a: 'A', box: 2, due: today + 2, seen: 1, right: 1 }] }]);
    t = await page.open('flashcards'); T.has(t.text(), '0 due', 'flashcards: not due yet'); t.close();
    clk.set('2026-03-12T10:00:00Z'); t = await page.open('flashcards'); T.has(t.text(), '1 due', 'flashcards: due two days later'); t.close();
    clk.set('2026-03-10T10:00:00Z'); w.localStorage.removeItem('pk.flashcards.decks');
  }

  /* ---------- Morse Trainer ---------- */
  log('morsetrainer');
  {
    T.eq(JSON.stringify(P.mtSegments('.-', 0.1).segs.map((s) => [s.at.toFixed(2), s.len.toFixed(2)])), JSON.stringify([['0.00', '0.10'], ['0.20', '0.30']]), 'morse: A is a dot then a dash with a one unit gap');
    T.near(P.mtSegments('.-', 0.1).total, 0.5, 1e-9, 'morse: A lasts 5 units');
    T.near(P.mtUnit(12), 0.1, 1e-9, 'morse: 12 wpm is a 100 ms unit'); T.near(P.mtUnit(20), 0.06, 1e-9, 'morse: 20 wpm is a 60 ms unit'); T.near(P.mtUnit(1), 0.24, 1e-9, 'morse: speed floors at 5 wpm');
    const seq = [0, 0.26, 0.51, 0.76]; let si = 0; const rnd = w.Math.random; w.Math.random = () => seq[si++ % 4];
    let t = await page.open('morsetrainer');
    t.click('#pl'); T.eq(t.q('#msg').textContent, 'Which character was that?', 'morse: Play asks for an answer');
    t.click('[data-c="E"]');
    T.eq(t.q('#big').textContent, 'E', 'morse: answer revealed'); T.eq(t.q('#msg').textContent, 'Correct!', 'morse: correct');
    T.eq(t.q('#s1').textContent, '1', 'morse: 1 correct'); T.eq(t.q('#s2').textContent, '100%', 'morse: 100% accuracy'); T.eq(t.q('#pat').textContent, '•', 'morse: E is one dot');
    await clk.advance(1500);
    T.eq(t.q('#big').textContent, '?', 'morse: next letter starts after 1.4 s');
    t.click('[data-c="N"]');
    T.has(t.q('#msg').textContent, 'You answered N. It was T.', 'morse: wrong answer shows the right one');
    T.eq(t.q('#s2').textContent, '50%', 'morse: accuracy 1 of 2'); T.eq(t.q('#s3').textContent, '0', 'morse: streak resets');
    T.eq(t.q('#pat').textContent, '–', 'morse: T is one dash');
    t.click('[data-c="E"]'); T.eq(t.q('#s2').textContent, '50%', 'morse: a second answer to the same letter is ignored');
    await clk.advance(1500);
    w.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'a' })); T.ok(t.q('#msg').textContent !== 'Which character was that?', 'morse: keyboard answers too');
    t.select('#lv', '3'); T.eq(t.all('#pad button').length, 26, 'morse: level 4 has 26 letters');
    t.select('#lv', '4'); T.eq(t.all('#pad button').length, 36, 'morse: level 5 has letters and digits');
    T.eq(t.q('#s1').textContent + t.q('#s2').textContent, '0—', 'morse: changing level resets the score on screen');
    t.type('#wp', '20'); T.eq(t.q('#wv').textContent, '20', 'morse: speed label'); T.eq(store('morsetrainer.wpm'), 20, 'morse: speed remembered'); T.eq(store('morsetrainer.level'), 4, 'morse: level remembered');
    t.close(); w.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'e' })); T.eq(page.errors.length, 0, 'morse: no key handler left behind');
    w.Math.random = rnd; w.localStorage.removeItem('pk.morsetrainer.level');
  }

  /* ---------- Paint Mixer ---------- */
  log('colourmix');
  {
    T.eq(P.mixColours([{ hex: '#E63946', w: 1 }, { hex: '#1D3557', w: 1 }]), '#82374F', 'colourmix: red and navy 1:1 is #82374F');
    T.eq(P.mixColours([{ hex: '#E63946', w: 2 }, { hex: '#1D3557', w: 1 }]), '#A3384C', 'colourmix: 2:1 weights the first colour');
    T.eq(P.mixColours([{ hex: '#FF0000', w: 1 }, { hex: '#0000FF', w: 1 }, { hex: '#00FF00', w: 1 }]), '#555555', 'colourmix: three primaries mix to #555555');
    T.eq(P.mixColours([{ hex: '#FFF', w: 0 }]), null, 'colourmix: zero parts gives nothing');
    T.eq(P.rotateHue('#FF0000', 180), '#00FFFF', 'colourmix: complement of red is cyan');
    T.eq(P.rotateHue('#336699', 180), '#996633', 'colourmix: complement of #336699 is #996633');
    T.eq(JSON.stringify(P.palettes('#FF0000').Triadic), JSON.stringify(['#FF0000', '#00FF00', '#0000FF']), 'colourmix: triadic of red');
    T.eq(JSON.stringify(P.palettes('#FF0000').Analogous), JSON.stringify(['#FF0080', '#FF0000', '#FF8000']), 'colourmix: analogous of red');
    T.eq(P.hex2rgb('#abc').join(), '170,187,204', 'colourmix: 3 digit hex'); T.eq(P.hex2rgb('xyz'), null, 'colourmix: bad hex');
    const t = await page.open('colourmix');
    T.has(t.q('#rh').textContent, '#82374F', 'colourmix: default mix shown'); T.has(t.q('#rr').textContent, 'RGB 130, 55, 79', 'colourmix: RGB line');
    t.type('[data-w="0"]', '2'); T.has(t.q('#rh').textContent, '#A3384C', 'colourmix: weight slider changes the mix');
    t.type('[data-h="0"]', '#FF0000'); t.type('[data-w="1"]', '0');
    T.eq(t.q('#rh').textContent, '#FF0000', 'colourmix: a single colour with the other at 0 parts');
    T.has(t.q('#pal').textContent, '#00FFFF', 'colourmix: complementary swatch'); T.eq(t.all('#pal .card').length, 5, 'colourmix: five palettes');
    t.type('[data-w="0"]', '0'); T.has(t.q('#rh').textContent, 'Add some parts', 'colourmix: nothing to mix');
    t.type('[data-w="0"]', '3'); t.click('#cp'); await page.wait(10); T.eq(copied[copied.length - 1], '#FF0000', 'colourmix: copy HEX');
    t.type('[data-h="2"]', 'nonsense'); T.eq(t.value('[data-p="2"]'), '#f1fa3b', 'colourmix: an invalid hex is ignored');
    T.eq(store('colourmix.cols')[0].hex, '#FF0000', 'colourmix: mix remembered');
    t.close();
  }

  /* ---------- Pixel Art ---------- */
  log('pixelart');
  {
    T.eq(P.pxLine(0, 0, 3, 3).map((p) => p.join(':')).join(), '0:0,1:1,2:2,3:3', 'pixelart: diagonal line');
    T.eq(P.pxLine(0, 0, 5, 0).length, 6, 'pixelart: horizontal line has no gaps');
    T.eq(P.pxLine(4, 4, 4, 4).length, 1, 'pixelart: a single point');
    let g = new Array(16).fill(null); [1, 5, 9, 13].forEach((i) => { g[i] = '#000'; }); // a vertical wall in a 4x4 grid
    const f = P.pxFill(g, 4, 0, 0, '#f00');
    T.eq(f.filter((x) => x === '#f00').length, 4, 'pixelart: fill stays left of a wall (the left column is 4 cells)');
    T.eq(P.pxFill(new Array(16).fill(null), 4, 2, 2, '#0f0').filter((x) => x === '#0f0').length, 16, 'pixelart: fill on an empty grid fills everything');
    T.eq(P.pxFill(f, 4, 0, 0, '#f00').join(), f.join(), 'pixelart: filling with the same colour changes nothing');
    const ptr = (el, type, x, y) => el.dispatchEvent(new w.MouseEvent(type, { clientX: x, clientY: y, bubbles: true }));
    const t = await page.open('pixelart');
    const cv = t.q('#cv'); const cellXY = (cx, cy) => [cx * 32 + 5, cy * 32 + 5];
    t.click('[data-pc="#06d6a0"]');
    ptr(cv, 'pointerdown', ...cellXY(3, 2)); ptr(cv, 'pointerup', ...cellXY(3, 2));
    await clk.advance(500);
    T.eq(store('pixelart.state').grid[2 * 16 + 3], '#06d6a0', 'pixelart: pen paints the cell under the finger');
    ptr(cv, 'pointerdown', ...cellXY(0, 0)); ptr(cv, 'pointermove', ...cellXY(5, 0)); ptr(cv, 'pointerup', ...cellXY(5, 0));
    await clk.advance(500);
    T.eq(store('pixelart.state').grid.slice(0, 6).filter((x) => x === '#06d6a0').length, 6, 'pixelart: a fast stroke leaves no gaps');
    t.click('#un'); await clk.advance(500);
    T.eq(store('pixelart.state').grid.slice(0, 6).filter(Boolean).length, 0, 'pixelart: undo removes the last stroke');
    t.clickText('🧽 Erase'); ptr(cv, 'pointerdown', ...cellXY(3, 2)); ptr(cv, 'pointerup', ...cellXY(3, 2)); await clk.advance(500);
    T.eq(store('pixelart.state').grid[2 * 16 + 3], null, 'pixelart: eraser clears a cell');
    t.clickText('🪣 Fill'); t.click('[data-pc="#e63946"]'); t.clickText('🪣 Fill'); ptr(cv, 'pointerdown', ...cellXY(8, 8)); ptr(cv, 'pointerup', ...cellXY(8, 8)); await clk.advance(500);
    T.eq(store('pixelart.state').grid.filter((x) => x === '#e63946').length, 256, 'pixelart: bucket fills the whole empty canvas');
    t.click('#sz'); T.has(t.text(), 'Size: 32×32', 'pixelart: size toggles to 32x32 (the confirm is accepted)'); await clk.advance(500);
    T.eq(store('pixelart.state') && store('pixelart.state').grid.length, 1024, 'pixelart: 32 x 32 grid has 1024 cells');
    t.click('#ex'); await page.wait(30);
    T.has((share.last() || {}).path || '', 'pixel-art-32x32.png', 'pixelart: export PNG file name');
    t.click('#gr'); T.has(t.q('#gr').textContent, 'off', 'pixelart: grid toggle');
    t.close();
  }

  /* ---------- Signature Pad ---------- */
  log('signature');
  {
    const b = P.sigBounds([{ c: '#000', w: 3, pts: [[10, 10], [50, 30]] }], 8);
    T.eq(JSON.stringify(b), JSON.stringify({ x: 0, y: 0, w: 59, h: 39 }), 'signature: crop box includes pen width and padding');
    T.eq(P.sigBounds([], 8), null, 'signature: nothing drawn gives no box');
    const ptr = (el, type, x, y) => el.dispatchEvent(new w.MouseEvent(type, { clientX: x, clientY: y, bubbles: true }));
    const t = await page.open('signature');
    t.click('#sv'); T.eq(toastText(), 'Sign first', 'signature: saving an empty pad is refused');
    const cv = t.q('#cv'); share.files.length = 0;
    ptr(cv, 'pointerdown', 100, 100); ptr(cv, 'pointermove', 200, 150); ptr(cv, 'pointermove', 300, 120); ptr(cv, 'pointerup', 300, 120);
    t.click('#sv'); await page.wait(40);
    T.has((share.last() || {}).path || '', 'signature.png', 'signature: PNG exported after signing');
    t.click('#un'); t.click('#sv'); T.eq(toastText(), 'Sign first', 'signature: undo removes the only stroke');
    t.type('#wd', '7'); T.eq(t.q('#wv').textContent, '7', 'signature: thickness label');
    t.click('[data-c="#1d4ed8"]'); ptr(cv, 'pointerdown', 10, 10); ptr(cv, 'pointerup', 10, 10);
    t.click('#cl'); t.click('#sv'); T.eq(toastText(), 'Sign first', 'signature: clear empties the pad');
    t.close();
  }

  await T.done(page);
})().catch((e) => { console.log("CRASH: " + (e && e.stack || e)); process.exit(1); });
