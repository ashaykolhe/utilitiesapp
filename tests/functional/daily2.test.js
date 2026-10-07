'use strict';
/* Functional tests, daily.js part 2: To-do, Battery & Network, Quick Timers, Clipboard Pad, Shopping, Expenses, Tip of the Day, Calendar,
   Birthdays, Multi Stopwatch, Moon Phase, Sunrise & Sunset, Meeting Planner, Typing Speed. */
const { suite } = require('../helpers/page');
const { bootFx, clock, fakeNotifications, fakeShare } = require('./fx');
(async () => {
  const T = suite('daily-2'), page = await bootFx(), w = page.w;
  const log = (m) => { if (process.env.V) console.log('>> ' + m + ' errors=' + page.errors.length); };
  const toastText = () => w.document.querySelector('#toast').textContent;
  const defNav = (name, value) => Object.defineProperty(w.navigator, name, { value, configurable: true });
  const copied = []; defNav('clipboard', { writeText: async (t) => { copied.push(t); }, readText: async () => 'pasted text' });
  const store = (k) => JSON.parse(w.localStorage.getItem('pk.' + k) || 'null');
  const put = (k, v) => w.localStorage.setItem('pk.' + k, JSON.stringify(v));
  w.Element.prototype.scrollIntoView = function () {};
  const clk = clock(page, '2026-03-10T10:00:00Z');
  const note = fakeNotifications(page, 'granted');
  const share = fakeShare(page);
  const stub = (n) => Array.from({ length: n }, (_, i) => i);

  /* ---------- To-do ---------- */
  log('todo');
  {
    const t = await page.open('todo');
    T.has(t.text(), 'All clear', 'todo: empty state');
    t.click('#add'); T.eq(toastText(), 'Write a task first', 'todo: empty task refused');
    t.type('#tx', 'Pay rent'); t.type('#du', '2026-03-09'); t.click('#add');
    t.type('#tx', 'Call mom'); t.type('#du', '2026-03-10'); t.select('#ct', 'Home'); t.click('#add');
    t.select('#ct', 'Personal');
    t.type('#tx', 'Buy gift'); t.type('#du', '2026-03-20'); t.click('#add');
    t.type('#tx', 'No date <b>x</b>'); t.click('#add');
    const order = () => t.all('#ls .item .grow').map(n => n.textContent.split('\n')[0]);
    T.has(order()[0], 'Pay rent', 'todo: earliest due first');
    T.has(t.q('#ls').textContent, 'Overdue', 'todo: overdue marked');
    T.has(t.q('#ls').textContent, 'Today', 'todo: due today marked');
    T.ok(order()[3].includes('No date'), 'todo: undated tasks last');
    T.ok(!t.has('#ls b'), 'todo: task text is escaped');
    T.has(t.text(), '4 open tasks', 'todo: open count');
    t.click('[data-c]'); T.has(t.text(), '3 open tasks', 'todo: checking a task lowers the open count');
    T.eq(store('daily.todo').filter(x => x.done).length, 1, 'todo: done state saved');
    T.ok(order()[3].includes('Pay rent'), 'todo: completed task moves to the bottom');
    t.clickText('Home'); T.eq(t.all('#ls .item').length, 1, 'todo: category filter');
    t.clickText('All'); t.type('#se', 'gift'); T.eq(t.all('#ls .item').length, 1, 'todo: search');
    t.type('#se', '');
    t.clickText('Done'); T.eq(t.all('#ls .item').length, 1, 'todo: Done filter');
    t.clickText('All');
    t.click('#sh'); await page.wait(10);
    const sh = share.shares[share.shares.length - 1];
    T.eq(sh.text, 'To-do list, 2026-03-10\n3 open, 1 done\n\n[ ] Call mom (Home, due 2026-03-10)\n[ ] Buy gift (Personal, due 2026-03-20)\n[ ] No date <b>x</b> (Personal)\n[x] Pay rent (Personal, due 2026-03-09)', 'todo: shared checklist text');
    t.click('#cl'); T.eq(store('daily.todo').length, 3, 'todo: clear completed');
    t.click('[data-x]'); T.eq(store('daily.todo').length, 2, 'todo: delete');
    t.close();
    /* caps */
    put('daily.todo', stub(500).map(i => ({ id: 'a' + i, text: 't' + i, due: '', cat: 'Other', done: i === 7, at: i })));
    const t2 = await page.open('todo');
    t2.type('#tx', 'one more'); t2.click('#add');
    T.has(toastText(), 'oldest completed task was removed', 'todo: full list drops the oldest done task');
    T.eq(store('daily.todo').length, 500, 'todo: stays at 500');
    t2.type('#tx', 'again'); t2.click('#add');
    T.has(toastText(), 'The list is full (500 tasks)', 'todo: no done tasks left, add is refused');
    T.eq(store('daily.todo').length, 500, 'todo: open tasks never dropped');
    t2.close(); w.localStorage.removeItem('pk.daily.todo');
  }

  /* ---------- Battery & Network ---------- */
  log('devstatus');
  {
    const bat = { level: 0.5, charging: false, dischargingTime: 7200, chargingTime: Infinity, addEventListener() {}, removeEventListener() {} };
    defNav('getBattery', () => Promise.resolve(bat));
    defNav('connection', { type: 'wifi', effectiveType: '4g', downlink: 10, rtt: 50, saveData: false, addEventListener() {}, removeEventListener() {} });
    defNav('storage', { estimate: async () => ({ usage: 5242880, quota: 524288000 }) });
    let t = await page.open('devstatus'); await page.wait(20);
    T.eq(t.q('#bp').textContent, '50%', 'devstatus: battery 50%');
    T.has(t.q('#bs').textContent, 'On battery', 'devstatus: on battery');
    T.has(t.q('#bt').textContent, 'About 2 h 0 min left', 'devstatus: 7200 s is 2 h 0 min');
    T.has(t.text(), 'wifi', 'devstatus: connection type');
    T.has(t.text(), '4G', 'devstatus: speed class');
    T.has(t.text(), '10 Mbit/s', 'devstatus: downlink');
    T.has(t.q('#stt').textContent, '5.0 MB used of about 500 MB', 'devstatus: storage line');
    T.has(t.text(), 'Online', 'devstatus: online');
    t.close();
    bat.level = 0.15; t = await page.open('devstatus'); await page.wait(20);
    T.has(t.q('#bs').textContent, 'Low battery', 'devstatus: low battery at 15%');
    t.close();
    bat.level = 1; bat.charging = true; t = await page.open('devstatus'); await page.wait(20);
    T.has(t.q('#bs').textContent, 'Charging', 'devstatus: charging');
    T.has(t.q('#bt').textContent, 'Fully charged', 'devstatus: fully charged at 100%');
    bat.level = 0.4; bat.chargingTime = 5400; t.close(); t = await page.open('devstatus'); await page.wait(20);
    T.has(t.q('#bt').textContent, 'Full in about 1 h 30 min', 'devstatus: charging time 5400 s is 1 h 30 min');
    defNav('onLine', false); w.dispatchEvent(new w.Event('offline'));
    T.has(t.text(), 'Offline', 'devstatus: goes offline live');
    const n0 = clk.timers(); t.close(); T.ok(clk.timers() < n0, 'devstatus: interval cleared');
    defNav('onLine', true); defNav('getBattery', undefined);
    const t3 = await page.open('devstatus'); await page.wait(20);
    T.has(t3.q('#bt').textContent, 'not available', 'devstatus: no battery API message'); t3.close();
  }

  /* ---------- Quick Timers ---------- */
  log('quicktimers');
  {
    note.reset();
    let t = await page.open('quicktimers');
    T.has(t.text(), 'Tap a preset', 'quicktimers: empty state');
    t.click('[data-p="0"]'); await page.wait(20);
    T.eq(note.last().id, 20000010, 'quicktimers: first timer id is in block 20,000,000');
    T.eq(note.last().schedule.at.toISOString(), '2026-03-10T10:06:00.000Z', 'quicktimers: soft egg is 6 minutes');
    T.eq(note.last().title, 'Soft egg', 'quicktimers: title');
    T.has(t.q('#ls').textContent, '6:00', 'quicktimers: shows 6:00');
    await clk.advance(60000);
    T.has(t.q('#ls').textContent, '5:00', 'quicktimers: 5:00 after a minute');
    t.type('#lb', 'Tea'); t.type('#mn', '3'); t.click('#go'); await page.wait(20);
    T.eq(note.last().id, 20000020, 'quicktimers: second timer id');
    T.eq(note.last().schedule.at.getTime(), clk.now() + 180000, 'quicktimers: custom 3 minutes');
    T.eq(t.value('#mn'), '', 'quicktimers: minutes field cleared');
    await clk.advance(180000);
    T.has(t.q('#ls').textContent, 'Done', 'quicktimers: finished timer shows Done');
    T.has(toastText(), 'Tea is done', 'quicktimers: toast when done');
    note.reset(); t.click('[data-x]'); await page.wait(20);
    T.eq(note.cancelled.length, 1, 'quicktimers: cancel removes one notification');
    T.eq(store('daily.qt').length, 1, 'quicktimers: stored list shrinks');
    t.type('#mn', ''); t.click('#go'); T.eq(toastText(), 'Enter minutes', 'quicktimers: no minutes refused');
    t.type('#mn', '5000'); t.click('#go'); await page.wait(20);
    T.eq(note.last().schedule.at.getTime(), clk.now() + 999 * 60000, 'quicktimers: minutes are capped at 999');
    t.close();
    t = await page.open('quicktimers');
    T.ok(t.all('[data-l]').length >= 1, 'quicktimers: running timers survive leaving the tool');
    t.close();
    put('daily.qt', stub(20).map(i => ({ id: 'x' + i, n: i, nb: 20000000 + i * 10, label: 'L' + i, endAt: clk.now() + 99999999, total: 99999999, done: false })));
    t = await page.open('quicktimers'); t.click('[data-p="0"]'); T.eq(toastText(), 'Up to 20 timers at once', 'quicktimers: 20 timer cap'); t.close();
    w.localStorage.removeItem('pk.daily.qt'); note.perm = 'denied';
    t = await page.open('quicktimers'); await page.wait(10); t.click('[data-p="1"]'); await page.wait(20);
    T.ok(!t.q('.nblocked').hidden, 'quicktimers: blocked message when notifications are denied');
    t.close(); note.perm = 'granted'; w.localStorage.removeItem('pk.daily.qt');
  }

  /* ---------- Clipboard Pad ---------- */
  log('clipboard');
  {
    const t = await page.open('clipboard');
    t.click('#sv'); T.eq(toastText(), 'Nothing to save', 'clipboard: empty save refused');
    t.type('#tx', 'first <i>clip</i>'); t.click('#sv');
    T.has(t.q('#ls').textContent, 'first <i>clip</i>', 'clipboard: text shown escaped');
    T.ok(!t.has('#ls i'), 'clipboard: no html injected');
    t.click('button[data-c]'); await page.wait(5); T.eq(copied[copied.length - 1], 'first <i>clip</i>', 'clipboard: copy gives the text back');
    t.click('#ps'); await page.wait(10); T.eq(t.value('#tx'), 'pasted text', 'clipboard: paste button reads the clipboard');
    t.click('#sv');
    T.eq(store('daily.clips').length, 2, 'clipboard: two clips');
    t.all('[data-p]').pop().click();
    T.eq(store('daily.clips').filter(c => c.pin).length, 1, 'clipboard: pin');
    t.close();
    put('daily.clips', stub(50).map(i => ({ id: 'c' + i, t: 'c' + i, at: 5000 - i, pin: i >= 47 })));
    const t2 = await page.open('clipboard');
    t2.type('#tx', 'newest'); t2.click('#sv');
    const clips = store('daily.clips');
    T.eq(clips.length, 50, 'clipboard: capped at 50');
    T.ok(clips.filter(c => c.pin).length === 3, 'clipboard: pinned clips are never dropped');
    T.ok(clips.some(c => c.t === 'newest') && !clips.some(c => c.t === 'c46'), 'clipboard: the oldest unpinned clip makes room');
    t2.close(); w.localStorage.removeItem('pk.daily.clips');
  }

  /* ---------- Shopping List ---------- */
  log('shopping');
  {
    let t = await page.open('shopping');
    t.type('#nm', 'Milk'); t.type('#qt', '2'); t.click('#add');
    T.eq(store('daily.shop')[0].q, 2, 'shopping: quantity 2');
    t.type('#nm', 'milk'); t.click('#add');
    T.eq(store('daily.shop').length, 1, 'shopping: same item merges (case-insensitive)');
    T.eq(store('daily.shop')[0].q, 3, 'shopping: merged quantity 3');
    T.eq(t.value('#qt'), '1', 'shopping: quantity resets to 1');
    t.clickText('+ Bread'); T.eq(store('daily.shop').length, 2, 'shopping: quick chip adds');
    t.type('#nm', '  '); t.click('#add'); T.eq(toastText(), 'Type an item', 'shopping: blank item refused');
    t.click('[data-a]'); T.eq(store('daily.shop')[0].q, 4, 'shopping: + raises quantity');
    for (let i = 0; i < 3; i++) t.click('[data-m]');
    T.eq(store('daily.shop')[0].q, 1, 'shopping: - lowers quantity');
    t.click('[data-m]'); T.eq(store('daily.shop')[0].q, 1, 'shopping: quantity never below 1');
    t.type('#nm', 'Rice'); t.type('#qt', '500'); t.click('#add');
    T.ok(store('daily.shop').every(i => i.q <= 99), 'shopping: quantity capped at 99');
    t.click('[data-c]');
    T.has(t.q('#sm').textContent, '2 to buy · 1 in the basket', 'shopping: summary line');
    t.click('#sh'); await page.wait(10);
    T.eq(share.shares[share.shares.length - 1].text, 'Shopping list, 2026-03-10\n2 to buy, 1 in the basket\n\n[ ] 1 x Bread\n[ ] 99 x Rice\n[x] 1 x Milk', 'shopping: shared text');
    t.click('#cl'); T.eq(store('daily.shop').length, 2, 'shopping: remove checked');
    t.close();
    put('daily.shop', stub(200).map(i => ({ id: 's' + i, n: 'Item' + i, q: 1, done: false, at: i })));
    t = await page.open('shopping');
    t.type('#nm', 'Brand new'); t.click('#add'); T.eq(toastText(), 'Up to 200 items. Remove some first.', 'shopping: 200 item cap');
    t.type('#nm', 'item5'); t.click('#add'); T.eq(store('daily.shop').find(i => i.n === 'Item5').q, 2, 'shopping: merging still works at the cap');
    t.close(); w.localStorage.removeItem('pk.daily.shop');
  }

  /* ---------- Expense Tracker ---------- */
  log('expenses');
  {
    let t = await page.open('expenses');
    T.has(t.text(), 'March 2026', 'expenses: opens on the current month');
    T.has(t.q('#bars').textContent, 'No spending this month', 'expenses: empty month');
    t.type('#cu', '$');
    T.eq(t.value('#ct'), 'Food', 'expenses: Food is the first category');
    t.type('#am', '12.5'); t.select('#ct', 'Food'); t.type('#nt', 'Lunch, "big"'); t.click('#add');
    t.type('#am', '7.25'); t.select('#ct', 'Transport'); t.type('#nt', '=cmd|calc'); t.click('#add');
    T.eq(t.q('#tt').textContent, '$ 19.75', 'expenses: month total 12.50 + 7.25 = 19.75');
    t.type('#am', '0.1'); t.click('#add'); t.type('#am', '0.2'); t.click('#add');
    T.eq(t.q('#tt').textContent, '$ 20.05', 'expenses: 0.1 + 0.2 added to 19.75 gives 20.05');
    t.type('#am', '0'); t.click('#add'); T.eq(toastText(), 'Enter an amount', 'expenses: zero refused');
    t.type('#am', '100'); t.select('#ct', 'Bills'); t.type('#dt', '2026-02-14'); t.click('#add');
    T.has(t.text(), 'February 2026', 'expenses: adding to another month shows that month');
    T.eq(t.q('#tt').textContent, '$ 100.00', 'expenses: February total');
    T.has(t.q('#bars').textContent, 'Bills', 'expenses: category bar');
    t.click('#nx'); T.has(t.text(), 'March 2026', 'expenses: next month');
    const bars = t.q('#bars').textContent;
    T.ok(bars.indexOf('Food') < bars.indexOf('Transport'), 'expenses: bars sorted by amount');
    t.click('#ex'); await page.wait(30);
    const csv = share.last().data;
    T.eq(csv.charCodeAt(0), 0xFEFF, 'expenses: CSV starts with a byte order mark for Excel');
    const lines = csv.slice(1).trim().split('\n').map(l => l.replace(/\r$/, ''));
    T.eq(lines[0], 'Date,Category,Amount,Note', 'expenses: CSV header');
    T.eq(lines[1], '2026-02-14,Bills,100.00,', 'expenses: CSV first row is the oldest date');
    T.eq(lines[2], '2026-03-10,Food,12.50,"Lunch, ""big"""', 'expenses: CSV quotes commas and quotes');
    T.eq(lines[3], "2026-03-10,Transport,7.25,'=cmd|calc", 'expenses: CSV neutralises a formula');
    T.eq(lines.length, 6, 'expenses: CSV has all 5 rows');
    T.has(share.last().path, 'expenses-2026-03-10.csv', 'expenses: CSV file name');
    t.click('[data-x]'); T.eq(store('daily.exp').length, 4, 'expenses: delete one');
    t.close();
    t = await page.open('expenses');
    T.eq(t.value('#cu'), '$', 'expenses: currency remembered');
    T.eq(t.value('#ct'), 'Bills', 'expenses: the category used last is selected again');
    T.eq(store('daily.exp').length, 4, 'expenses: stored');
    t.close();
    put('daily.exp', stub(5000).map(i => ({ id: 'e' + i, amt: 1, cat: 'Food', note: '', date: '2026-03-01', at: i })));
    t = await page.open('expenses'); t.type('#am', '5'); t.click('#add');
    T.has(toastText(), 'Up to 5000 expenses', 'expenses: 5000 cap');
    t.close(); w.localStorage.removeItem('pk.daily.exp'); w.localStorage.removeItem('pk.daily.expcur');
  }

  /* ---------- Tip of the Day ---------- */
  log('tipday');
  {
    const t = await page.open('tipday');
    const first = t.q('#tx').textContent;
    T.ok(first.length > 10, 'tipday: a tip is shown');
    T.has(t.q('#dn').textContent, "Today's pick", 'tipday: marked as today\'s pick');
    t.click('#nx'); T.ok(t.q('#tx').textContent !== first, 'tipday: next tip differs');
    T.ok(/Tip \d+ of \d{3,5}$/.test(t.q('#dn').textContent), 'tipday: counter shows the position in the full list of hundreds of tips');
    { const fl = t.q('#fl'); T.ok(fl && fl.options.length >= 8, 'tipday: a filter lists the kinds of tips'); const kinds = [...fl.options].map(o => o.value);
      const allN = +/\((\d+)\)/.exec(fl.options[0].textContent)[1]; let sum = 0; for (const o of [...fl.options].slice(1)) sum += +/\((\d+)\)/.exec(o.textContent)[1]; T.eq(sum, allN, 'tipday: the kind counts add up to the total');
      const pv = kinds.find(k => k === 'Proverb'); T.ok(!!pv, 'tipday: has Proverb kind'); t.select('#fl', 'Proverb'); await page.wait(10); T.eq(t.q('#ty').textContent, 'Proverb', 'tipday: filtered to proverbs'); T.has(t.q('#dn').textContent, 'Today', 'tipday: filtered list also has a pick of the day'); t.click('#nx'); T.eq(t.q('#ty').textContent, 'Proverb', 'tipday: next stays within the kind');
      t.select('#fl', ''); await page.wait(10); t.click('#nx'); }
    t.click('#pv'); T.eq(t.q('#tx').textContent, first, 'tipday: previous returns');
    const sameDay = (await (async () => { t.close(); const t2 = await page.open('tipday'); const r = t2.q('#tx').textContent; t2.close(); return r; })());
    T.eq(sameDay, first, 'tipday: same tip all day');
    clk.set('2026-03-11T10:00:00Z');
    const t3 = await page.open('tipday'); T.ok(t3.q('#tx').textContent !== first, 'tipday: the tip changes with the date');
    t3.click('#cp'); await page.wait(5); T.eq(copied[copied.length - 1], t3.q('#tx').textContent, 'tipday: copy');
    t3.click('#sh'); await page.wait(10); T.eq(share.shares[share.shares.length - 1].text, t3.q('#tx').textContent, 'tipday: share');
    t3.close(); clk.set('2026-03-10T10:00:00Z');
  }

  /* ---------- Calendar ---------- */
  log('calendar');
  {
    const isoWk = (y, m, d) => { const t = new Date(Date.UTC(y, m - 1, d)); const dn = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - dn + 3); const f = new Date(Date.UTC(t.getUTCFullYear(), 0, 4)); return 1 + Math.round(((t - f) / 864e5 - 3 + ((f.getUTCDay() + 6) % 7)) / 7); };
    T.eq(isoWk(2026, 3, 10), 11, 'calendar: reference week number of 10 March 2026 is 11');
    let t = await page.open('calendar');
    T.has(t.q('#tdy').textContent, 'March 2026', 'calendar: title');
    T.eq(t.all('#gr [data-d]').length, 31, 'calendar: 31 days in March');
    T.has(t.q('#inf').textContent, 'Week 11 · day 69 of the year · today', 'calendar: info for 10 March 2026 (week 11, day 69)');
    const weeks = () => t.all('#gr > div > div.muted').filter(d => /^\d+$/.test(d.textContent.trim()) && d.style.fontSize === '11px').map(d => +d.textContent);
    T.eq(weeks().join(), '9,10,11,12,13,14', 'calendar: week numbers in a Monday-first month view (9..14)');
    const cells = () => [...t.q('#gr > div').children];
    T.eq(cells().slice(0, 8).map(c => c.textContent.trim()).join('|'), 'Wk|M|T|W|T|F|S|S', 'calendar: Monday-first headings');
    T.eq(cells().slice(9, 16).map(c => c.textContent.trim()).join('|'), '||||||1', 'calendar: 1 March 2026 is a Sunday (6 blanks, then 1)');
    t.check('#mo', false);
    T.eq(cells().slice(0, 8).map(c => c.textContent.trim()).join('|'), 'Wk|S|M|T|W|T|F|S', 'calendar: Sunday-first headings');
    T.eq(cells()[8].textContent.trim(), '10', 'calendar: Sunday-first row 1 shows ISO week of its Monday (2 March = week 10)');
    T.eq(store('daily.calmon'), false, 'calendar: week start remembered');
    t.check('#mo', true);
    T.eq(t.q('[data-d="10"]').getAttribute('aria-current'), 'date', 'calendar: today is marked aria-current'); T.eq(t.q('[data-d="10"]').getAttribute('aria-pressed'), 'true', 'calendar: the selected day is aria-pressed'); T.eq(t.q('[data-d="11"]').getAttribute('aria-pressed'), 'false', 'calendar: other days are not pressed');
    t.click('[data-d="15"]'); T.has(t.q('#inf').textContent, 'in 5 days', 'calendar: selecting 15 March is in 5 days');
    T.has(t.q('#inf').textContent, 'Week 11 · day 74', 'calendar: 15 March is week 11, day 74');
    t.click('#nx'); T.has(t.q('#tdy').textContent, 'April 2026', 'calendar: next month');
    T.eq(t.all('#gr [data-d]').length, 30, 'calendar: April has 30 days');
    t.click('#pv'); t.click('#pv'); T.eq(t.all('#gr [data-d]').length, 28, 'calendar: February 2026 has 28 days');
    t.click('#tdy'); T.has(t.q('#tdy').textContent, 'March 2026', 'calendar: month title jumps back to today');
    t.type('#d1', '2026-03-10'); t.type('#d2', '2026-03-24'); T.eq(t.q('#df').textContent, '14 days (2 weeks)', 'calendar: 14 days between');
    t.type('#d2', '2026-03-11'); T.eq(t.q('#df').textContent, '1 day', 'calendar: singular day');
    t.type('#d2', '2026-03-20'); T.eq(t.q('#df').textContent, '10 days (1 week and 3 days)', 'calendar: weeks and days');
    t.type('#d2', '2026-03-03'); T.eq(t.q('#df').textContent, '7 days (1 week) earlier', 'calendar: earlier date, singular week');
    t.type('#d1', '2024-02-28'); t.type('#d2', '2024-03-01'); T.eq(t.q('#df').textContent, '2 days', 'calendar: 28 Feb to 1 Mar 2024 is 2 days (leap year)');
    t.type('#d1', '2025-02-28'); t.type('#d2', '2025-03-01'); T.eq(t.q('#df').textContent, '1 day', 'calendar: 28 Feb to 1 Mar 2025 is 1 day');
    t.type('#d1', '2000-01-01'); t.type('#d2', '2026-03-10'); T.eq(t.q('#df').textContent.split(' ')[0], String(Math.round((Date.UTC(2026, 2, 10) - Date.UTC(2000, 0, 1)) / 864e5)), 'calendar: long span of days');
    t.close();
    for (const [iso, days, name] of [['2028-02-10T10:00:00Z', 29, 'leap year 2028'], ['2100-02-10T10:00:00Z', 28, '2100 (not a leap year)'], ['2000-02-10T10:00:00Z', 29, '2000 (leap year, divisible by 400)'], ['2026-12-31T10:00:00Z', 31, 'December']]) {
      clk.set(iso); const c = await page.open('calendar');
      T.eq(c.all('#gr [data-d]').length, days, 'calendar: ' + name + ' has ' + days + ' days'); c.close();
    }
    clk.set('2026-12-31T10:00:00Z'); t = await page.open('calendar');
    T.has(t.q('#inf').textContent, 'Week 53 · day 365', 'calendar: 31 Dec 2026 is ISO week 53, day 365');
    t.click('#nx'); t.click('[data-d="1"]'); T.has(t.q('#inf').textContent, 'Week 53 · day 1', '1 Jan 2027 still belongs to ISO week 53 of 2026');
    t.close(); clk.set('2026-03-10T10:00:00Z');
  }

  /* ---------- Birthdays ---------- */
  log('birthdays');
  {
    note.reset(); clk.set('2026-03-10T08:00:00Z');
    let t = await page.open('birthdays');
    t.type('#nm', 'Ann'); t.select('#mo', '3'); t.type('#dy', '10'); t.type('#yr', '1990'); t.click('#add'); await page.wait(30);
    T.has(t.q('#ls').textContent, 'Today!', 'birthdays: today is flagged');
    T.has(t.q('#ls').textContent, 'turns 36', 'birthdays: age turns 36');
    T.eq(note.last().id, 30000010, 'birthdays: id in block 30,000,000');
    T.eq(JSON.stringify(note.last().schedule.on), JSON.stringify({ month: 3, day: 10, hour: 9, minute: 0 }), 'birthdays: yearly repeat at 9:00');
    T.eq(note.last().schedule.at, undefined, 'birthdays: normal birthday uses the yearly rule');
    t.type('#nm', 'Bob'); t.select('#mo', '3'); t.type('#dy', '11'); t.click('#add'); await page.wait(30);
    T.has(t.q('#ls').textContent, 'Tomorrow', 'birthdays: tomorrow');
    t.type('#nm', 'Leap'); t.select('#mo', '2'); t.type('#dy', '29'); t.type('#yr', '2000'); t.click('#add'); await page.wait(30);
    const days27 = Math.round((Date.UTC(2027, 1, 28) - Date.UTC(2026, 2, 10)) / 864e5);
    T.eq(days27, 355, 'birthdays: reference days to 28 Feb 2027');
    T.has(t.q('#ls').textContent, 'in 355 d', 'birthdays: 29 Feb is counted on 28 Feb in a common year (355 days)');
    T.has(t.q('#ls').textContent, '(28 Feb this year)', 'birthdays: note about 28 Feb');
    T.has(t.q('#ls').textContent, 'turns 27', 'birthdays: leap day born 2000 turns 27 in 2027');
    T.eq(note.last().schedule.at.toISOString(), '2027-02-28T09:00:00.000Z', 'birthdays: leap day reminder is a single notification on 28 Feb 2027 at 9:00');
    const order = t.all('#ls .grow b').map(b => b.textContent);
    T.eq(order.join(), 'Ann,Bob,Leap', 'birthdays: soonest first');
    t.type('#nm', 'Bad'); t.select('#mo', '2'); t.type('#dy', '30'); t.click('#add'); T.eq(toastText(), 'Enter a valid day', 'birthdays: 30 Feb refused');
    t.select('#mo', '4'); t.type('#dy', '31'); t.click('#add'); T.eq(toastText(), 'Enter a valid day', 'birthdays: 31 April refused');
    t.type('#nm', ''); t.type('#dy', '5'); t.click('#add'); T.eq(toastText(), 'Enter a name', 'birthdays: name required');
    note.reset(); t.all('[data-x]')[0].click(); await page.wait(20);
    T.eq(note.cancelled.join(), '30000010', 'birthdays: delete cancels the notification');
    t.close();
    clk.set('2027-03-10T08:00:00Z'); note.reset();
    t = await page.open('birthdays'); await page.wait(30);
    const d28 = Math.round((Date.UTC(2028, 1, 29) - Date.UTC(2027, 2, 10)) / 864e5);
    T.has(t.q('#ls').textContent, 'in ' + d28 + ' d', 'birthdays: next 29 Feb 2028 is ' + d28 + ' days away');
    T.has(t.q('#ls').textContent, 'turns 28', 'birthdays: turns 28 in 2028');
    T.ok(!t.q('#ls').textContent.includes('28 Feb this year'), 'birthdays: no 28 Feb note in a leap year');
    T.eq(note.scheduled.filter(n => n.id === 30000030).map(n => n.schedule.at.toISOString()).join(), '2028-02-29T09:00:00.000Z', 'birthdays: leap day reminder renewed on opening for 29 Feb 2028');
    t.close();
    w.localStorage.removeItem('pk.daily.bdays'); note.perm = 'denied';
    t = await page.open('birthdays'); t.type('#nm', 'Zed'); t.select('#mo', '5'); t.type('#dy', '1'); t.click('#add'); await page.wait(30);
    T.ok(!t.q('.nblocked').hidden, 'birthdays: blocked message when denied');
    T.has(toastText(), 'notifications are blocked', 'birthdays: toast');
    t.close(); note.perm = 'granted'; w.localStorage.removeItem('pk.daily.bdays'); clk.set('2026-03-10T10:00:00Z');
  }

  /* ---------- Multi Stopwatch ---------- */
  log('multiwatch');
  {
    const t = await page.open('multiwatch');
    t.click('[data-l="0"]'); T.eq(toastText(), 'Start the clock first', 'multiwatch: lap before start refused');
    t.click('#go'); await clk.advance(12360);
    T.eq(t.q('#d').textContent, '00:12.36', 'multiwatch: clock shows 00:12.36');
    t.click('[data-l="0"]');
    T.has(t.q('#ls').textContent, 'Lap 1: 00:12.36', 'multiwatch: first lap');
    await clk.advance(7000); t.click('[data-l="0"]');
    T.has(t.q('#ls').textContent, 'Lap 2: 00:07.00', 'multiwatch: second lap is the time since the first');
    T.has(t.q('#ls').textContent, 'best 00:07.00', 'multiwatch: best lap');
    T.has(t.q('#ls').textContent, 'Total 00:19.36', 'multiwatch: total');
    t.click('[data-l="1"]'); T.has(t.all('#ls .item')[1].textContent, 'Lap 1: 00:19.36', 'multiwatch: another runner laps against the same clock');
    t.click('#go'); const frozen = t.q('#d').textContent; await clk.advance(5000); T.eq(t.q('#d').textContent, frozen, 'multiwatch: clock stops');
    T.eq(t.q('#go').textContent, 'Resume', 'multiwatch: Resume label');
    t.click('#go'); await clk.advance(1000); T.eq(t.q('#d').textContent, '00:20.36', 'multiwatch: resumes from where it stopped');
    t.type('#nm', 'Zoe'); t.click('#add'); T.eq(t.all('#ls .item').length, 4, 'multiwatch: add a runner');
    t.type('#nm', ''); for (let i = 0; i < 12; i++) t.click('#add');
    T.eq(t.all('#ls .item').length, 12, 'multiwatch: 12 runner cap');
    t.click('#rs'); T.eq(t.q('#d').textContent, '00:00.00', 'multiwatch: reset'); T.has(t.q('#ls').textContent, 'No laps yet', 'multiwatch: laps cleared');
    t.click('#go'); const n0 = clk.timers(); t.close(); T.ok(clk.timers() < n0, 'multiwatch: interval cleared on leaving');
  }

  /* ---------- Moon Phase ---------- */
  log('moonphase');
  {
    const SYN = 29.530588853, REF = Date.UTC(2000, 0, 6, 18, 14);
    const age = (iso) => { let a = ((Date.parse(iso) - REF) / 864e5) % SYN; return a < 0 ? a + SYN : a; };
    const t = await page.open('moonphase');
    const at = async (ymd) => { t.type('#dt', ymd); await page.wait(2); return t.text(); };
    let s = await at('2024-04-08');
    T.has(s, 'New moon', 'moonphase: 8 April 2024 (new moon) is a New moon');
    T.has(s, age('2024-04-08T12:00:00Z').toFixed(1) + ' days', 'moonphase: age matches the mean-month formula (' + age('2024-04-08T12:00:00Z').toFixed(1) + ' days)');
    T.ok(/(^|\D)[0-4]% illuminated/.test(s), 'moonphase: almost 0% lit at new moon');
    T.ok(/(Apr 2[34]|2[34] Apr)/.test(t.q('#inf').textContent.split('Next full moon')[1].slice(0, 20)), 'moonphase: next full moon 23/24 April 2024 (true 23 Apr 23:49 UTC)');
    s = await at('2024-04-15'); T.has(s, 'First quarter', 'moonphase: 15 April 2024 is First quarter'); T.ok(/(4\d|5\d)% illuminated/.test(s), 'moonphase: first quarter 40-59% lit');
    s = await at('2024-04-24'); T.has(s, 'Full moon', 'moonphase: 24 April 2024 is Full moon'); T.ok(/(9\d|100)% illuminated/.test(s), 'moonphase: full moon is about 100% lit');
    s = await at('2024-05-01'); T.has(s, 'Last quarter', 'moonphase: 1 May 2024 is Last quarter');
    s = await at('2024-04-19'); T.has(s, 'Waxing gibbous', 'moonphase: 19 April 2024 is Waxing gibbous');
    s = await at('1999-12-31'); T.ok(/\d+(\.\d)? days/.test(s) && !/NaN/.test(s), 'moonphase: dates before the reference epoch work');
    T.has(s, age('1999-12-31T12:00:00Z').toFixed(1) + ' days', 'moonphase: age before 2000 uses a positive modulo');
    await at('2024-04-08'); t.click('#nx'); T.eq(t.value('#dt'), '2024-04-09', 'moonphase: next day button');
    t.click('#pv'); t.click('#pv'); T.eq(t.value('#dt'), '2024-04-07', 'moonphase: previous day button');
    t.click('#td'); T.eq(t.value('#dt'), '2026-03-10', 'moonphase: Today button');
    t.close();
  }

  /* ---------- Sunrise & Sunset ---------- */
  log('suntimes');
  {
    const t = await page.open('suntimes');
    const mins = (txt) => { const m = /(\d{1,2}):(\d{2})\s*([AP]M)?/i.exec(txt); if (!m) return NaN; let h = +m[1] % 24; if (m[3] && /p/i.test(m[3])) h = (h % 12) + 12; else if (m[3]) h = h % 12; return h * 60 + +m[2]; };
    const row = (lbl) => t.all('#inf .item').find(i => i.textContent.includes(lbl)).querySelector('b').textContent;
    const go = async (lat, lon, d) => { t.type('#la', lat); t.type('#lo', lon); t.type('#dt', d); await page.wait(2); };
    await go(51.5074, -0.1278, '2024-06-21');
    T.near(mins(row('Sunrise')), 3 * 60 + 43, 2, 'suntimes: London 21 Jun 2024 sunrise 03:43 UTC (04:43 BST)');
    T.near(mins(row('Sunset')), 20 * 60 + 21, 2, 'suntimes: London 21 Jun 2024 sunset 20:21 UTC (21:21 BST)');
    T.near(mins(row('Solar noon')), 12 * 60 + 2, 3, 'suntimes: London solar noon about 13:02 BST');
    T.has(t.q('#dl').textContent, '16 h 3', 'suntimes: London midsummer day is about 16 h 38 min');
    await go(51.5074, -0.1278, '2023-12-21');
    T.near(mins(row('Sunrise')), 8 * 60 + 3, 2, 'suntimes: London 21 Dec sunrise 08:03');
    T.near(mins(row('Sunset')), 15 * 60 + 53, 2, 'suntimes: London 21 Dec sunset 15:53');
    T.has(t.q('#dl').textContent, '7 h 5', 'suntimes: London midwinter day is about 7 h 50 min');
    await go(0, 0, '2024-03-20');
    T.ok(/^12 h 0[5-9] min$/.test(t.q('#dl').textContent), 'suntimes: equator at the equinox has about 12 h 07 min of daylight (' + t.q('#dl').textContent + ')');
    await go(-33.8688, 151.2093, '2024-06-21');
    T.ok(/^9 h 5[2-6] min$/.test(t.q('#dl').textContent), 'suntimes: Sydney midwinter day is about 9 h 54 min (' + t.q('#dl').textContent + ')');
    await go(69.6492, 18.9553, '2024-06-21');
    T.eq(t.q('#dl').textContent, '24 h', 'suntimes: Tromso midnight sun is 24 h');
    T.has(t.q('#ds').textContent, 'Midnight sun', 'suntimes: midnight sun text');
    await go(69.6492, 18.9553, '2024-12-21');
    T.eq(t.q('#dl').textContent, '0 h', 'suntimes: Tromso polar night is 0 h');
    T.has(t.q('#ds').textContent, 'Polar night', 'suntimes: polar night text');
    T.eq(row('Sunrise'), '--', 'suntimes: no sunrise in polar night');
    T.eq(store('daily.sunloc').lat, 69.6492, 'suntimes: location remembered');
    t.type('#la', '95'); T.ok(store('daily.sunloc').lat <= 90, 'suntimes: latitude clamped to 90');
    page.geo.once = { coords: { latitude: 12.97161, longitude: 77.59457, accuracy: 20 } };
    t.click('#me'); await page.wait(5);
    T.eq(t.value('#la'), '12.9716', 'suntimes: Use my location fills latitude');
    T.eq(t.value('#lo'), '77.5946', 'suntimes: Use my location fills longitude');
    page.geo.once = null; t.close();
  }

  /* ---------- Meeting Planner ---------- */
  log('meetingplanner');
  {
    const t = await page.open('meetingplanner');
    const txt = () => t.q('#bw').textContent;
    T.has(txt(), 'No hour is inside 9 to 17', 'meetingplanner: London + Tokyo have no common working hour');
    t.click('[data-x="1"]');
    T.has(txt(), '09:00 to 17:00', 'meetingplanner: with only London (same as local) the whole 9 to 17 window');
    t.type('#cs', 'New York'); t.click('#add');
    T.has(txt(), '13:00 to 17:00', 'meetingplanner: London + New York (UTC-4 on 10 March 2026) overlap 13:00 to 17:00');
    t.type('#dt', '2026-03-05');
    T.has(txt(), '14:00 to 17:00', 'meetingplanner: before US summer time (UTC-5) the overlap is 14:00 to 17:00');
    T.ok(t.q('#gr').textContent.includes('UTC-4'), 'meetingplanner: offset label uses the current date');
    t.type('#cs', 'New York'); t.click('#add'); T.eq(toastText(), 'Already added', 'meetingplanner: duplicate refused');
    for (const c of ['Paris', 'Cairo', 'Dubai']) { t.type('#cs', c); t.click('#add'); }
    t.type('#cs', 'Rome'); t.click('#add'); T.eq(toastText(), 'Up to 5 places', 'meetingplanner: 5 place cap');
    T.eq(store('daily.mzones').length, 5, 'meetingplanner: zones saved');
    t.type('#cs', 'Atlantis'); t.click('#add');
    t.close();
    w.localStorage.removeItem('pk.daily.mzones');
  }

  /* ---------- Typing Speed ---------- */
  log('typingtest');
  {
    const rnd = w.Math.random; w.Math.random = () => 0;
    const t = await page.open('typingtest');
    const target = () => t.q('#ps').textContent;
    const tg = target();
    T.ok(tg.startsWith('The quick brown fox'), 'typingtest: deterministic text for the test');
    const typeIn = async (str, gap) => { for (let i = 1; i <= str.length; i++) { const e = t.q('#in'); e.value = str.slice(0, i); e.dispatchEvent(new w.Event('input', { bubbles: true })); if (i < str.length) await clk.advance(gap); } };
    await typeIn(tg, 200);
    const ms = (tg.length - 1) * 200, wpm = Math.round(tg.length / 5 / (ms / 60000));
    T.eq(t.q('#wp').textContent, String(wpm), 'typingtest: WPM = chars / 5 per minute (' + wpm + ')');
    T.eq(t.q('#ac').textContent, '100%', 'typingtest: 100% accuracy');
    T.has(t.q('#rs').textContent, wpm + ' WPM at 100% accuracy', 'typingtest: result card');
    T.has(t.q('#rs').textContent, 'New personal best', 'typingtest: personal best');
    T.eq(store('daily.typebest'), wpm, 'typingtest: best saved');
    T.ok(t.q('#in').disabled, 'typingtest: input locked after finishing');
    t.click('#nw'); T.ok(!t.q('#in').disabled, 'typingtest: New text unlocks');
    /* mistakes */
    let bad = tg.split(''); bad[3] = bad[3] === 'x' ? 'y' : 'x'; bad[10] = bad[10] === 'x' ? 'y' : 'x'; bad = bad.join('');
    await typeIn(bad, 300);
    const ok2 = tg.length - 2, ms2 = (tg.length - 1) * 300;
    T.eq(t.q('#ac').textContent, Math.round(ok2 / tg.length * 100) + '%', 'typingtest: accuracy counts wrong characters');
    T.eq(t.q('#wp').textContent, String(Math.round(ok2 / 5 / (ms2 / 60000))), 'typingtest: WPM counts only correct characters');
    T.eq(store('daily.typebest'), wpm, 'typingtest: a slower run does not replace the best');
    /* time limit, burst and paste */
    t.click('#nw');
    await typeIn(tg.slice(0, 10), 100);
    await clk.advance(31000);
    T.ok(t.q('#in').disabled, 'typingtest: time limit ends the test');
    T.eq(t.q('#wp').textContent, String(Math.round(10 / 5 / 0.5)), 'typingtest: 10 chars in 30 s is 4 WPM');
    t.click('#nw');
    const e = t.q('#in'); e.value = tg.slice(0, 30); e.dispatchEvent(new w.Event('input', { bubbles: true }));
    T.has(toastText(), 'faster than anyone can type', 'typingtest: an instant burst is refused');
    T.eq(t.value('#in'), '', 'typingtest: the burst is removed');
    const ev = new w.Event('paste', { bubbles: true, cancelable: true }); t.q('#in').dispatchEvent(ev);
    T.ok(ev.defaultPrevented, 'typingtest: paste is blocked');
    t.clickText('60 seconds'); T.eq(t.q('#tl').textContent, '60', 'typingtest: 60 second mode'); T.ok(target().length > tg.length, 'typingtest: longer text in 60 s mode');
    const n0 = clk.timers(); await typeIn('The', 100); t.close(); T.ok(clk.timers() < n0 + 1, 'typingtest: no timer left');
    w.Math.random = rnd;
  }


  /* ---------- Local time zone and summer-time changes (the phone's zone is America/New_York here) ---------- */
  log('timezone');
  {
    process.env.TZ = 'America/New_York';
    clk.set('2026-03-07T15:00:00Z'); note.reset();
    let t = await page.open('calendar');
    t.type('#d1', '2026-03-07'); t.type('#d2', '2026-03-09'); T.eq(t.q('#df').textContent, '2 days', 'timezone: 7 to 9 March 2026 is 2 days across the US clock change');
    t.type('#d1', '2026-11-01'); t.type('#d2', '2026-11-02'); T.eq(t.q('#df').textContent, '1 day', 'timezone: 1 to 2 November 2026 (25 hour day) is 1 day');
    T.has(t.q('#inf').textContent, 'Week 10 · day 66', 'timezone: 7 March 2026 is week 10, day 66 in the local zone');
    t.close();
    t = await page.open('birthdays'); t.type('#nm', 'Zed'); t.select('#mo', '3'); t.type('#dy', '15'); t.click('#add'); await page.wait(20);
    T.has(t.q('#ls').textContent, 'in 8 d', 'timezone: 7 to 15 March is 8 days even though a clock change falls in between'); t.close();
    w.localStorage.removeItem('pk.daily.bdays'); note.reset();
    clk.set('2026-03-08T05:00:00Z');
    t = await page.open('alarmclock'); t.type('#tm', '09:00');
    ['1', '2', '3', '4', '5'].forEach((d) => t.click('[data-d="' + d + '"]')); t.click('#add'); await page.wait(30);
    T.eq(note.last().schedule.at.toISOString(), '2026-03-08T13:00:00.000Z', 'timezone: 09:00 on the morning the clocks go forward is 13:00 UTC (EDT)');
    t.close(); w.localStorage.removeItem('pk.daily.alarms');
    clk.set('2026-03-10T12:00:00Z');
    t = await page.open('worldclock'); await clk.advance(1000);
    const row = (name) => t.all('[data-row]').find((r) => r.textContent.includes(name)).textContent;
    T.has(row('New York'), 'Same time as you', 'timezone: New York equals the local time');
    T.has(row('London'), '4h ahead', 'timezone: London is 4h ahead of New York on 10 March 2026 (UK summer time not started)');
    T.has(row('Tokyo'), '13h ahead', 'timezone: Tokyo is 13h ahead');
    t.close(); w.localStorage.removeItem('pk.daily.clocks');
    /* the Pomodoro "today" counter rolls over at local midnight */
    clk.set('2026-03-10T03:30:00Z'); w.localStorage.removeItem('pk.daily.pomo'); w.localStorage.removeItem('pk.daily.pomoday'); w.localStorage.removeItem('pk.daily.pomototal');
    t = await page.open('pomodoro'); t.click('#go'); await page.wait(5); await clk.advance(25 * 60000 + 300);
    T.eq(t.q('#td').textContent, '1', 'timezone: focus finished at 23:55 local counts for today');
    await clk.advance(10 * 60000);
    T.eq(t.q('#td').textContent, '0', 'timezone: the count for today restarts after local midnight');
    T.eq(t.q('#to').textContent, '1', 'timezone: the all time count stays');
    t.close(); w.localStorage.removeItem('pk.daily.pomo');
    process.env.TZ = 'UTC'; clk.set('2026-03-10T10:00:00Z');
  }

  await T.done(page);
})().catch((e) => { console.log("CRASH: " + (e && e.stack || e)); process.exit(1); });
