'use strict';
/* Functional tests for the date, counter and randomness calculators in www/js/tools/calc.js. */
const { boot, suite } = require('../helpers/page');
(async () => {
  const T = suite('calc-date'), page = await boot();
  const w = page.w;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const fire = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true }));
  const F = (t, s, k) => t.q('[data-s="' + s + '"] [data-k="' + k + '"]');
  const set = (t, s, k, v) => { const e = F(t, s, k); e.value = String(v); fire(e, 'input'); fire(e, 'change'); };
  const card = (t, s) => (t.q('[data-s="' + s + '"]').textContent || '').replace(/\s+/g, ' ');
  const ns = (s) => String(s).replace(/\s+/g, '');
  const H = (txt, part, m) => T.has(ns(txt), ns(part), m);
  const hist = (id) => JSON.parse(page.eval("JSON.stringify(Hist.list('" + id + "'))"));
  const store = (k, d) => JSON.parse(page.eval("JSON.stringify(Store.get(" + JSON.stringify(k) + ", " + JSON.stringify(d) + "))"));
  const pending = [];
  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const todayIso = (plus) => { const d = new Date(); d.setDate(d.getDate() + (plus || 0)); return iso(d); };
  const dayName = (s) => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(s + 'T00:00:00Z').getUTCDay()];
  const msBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);

  /* ---------------- Days counter ---------------- */
  {
    const t = await page.open('days');
    t.type('#a', '2024-01-01'); t.type('#b', '2024-03-01');
    H(t.q('#r1').textContent, 'Days60', 'days: 2024-01-01 to 2024-03-01 = 60 days');
    H(t.q('#r1').textContent, 'Weeks8 w 4 d', 'days: 8 w 4 d');
    H(t.q('#r1').textContent, '0y 2m 0d', 'days: 0y 2m 0d');
    H(t.q('#r1').textContent, 'Total hours1,440', 'days: 60 days = 1440 hours');
    t.type('#a', '2024-03-01'); t.type('#b', '2024-01-01');
    H(t.q('#r1').textContent, 'Days (To is earlier)60', 'days: swapped dates, same count with a note');
    t.type('#a', '2023-12-31'); t.type('#b', '2024-12-31'); H(t.q('#r1').textContent, 'Days366', 'days: leap year span is 366');
    t.type('#a', '2024-01-31'); t.type('#b', '2024-02-29'); H(t.q('#r1').textContent, '0y 1m 0d', 'days: 31 Jan to 29 Feb = 1 month (month end clamps)');
    t.type('#a', '2024-01-01'); t.type('#b', '2024-01-01'); H(t.q('#r1').textContent, 'Days0', 'days: same date is 0');
    t.type('#a', ''); H(t.q('#r1').textContent, 'Pick both dates', 'days: empty date shows note');
    t.type('#s', '2024-02-28'); t.type('#n', '2'); t.click('#plus');
    H(t.q('#r2').textContent, '2024-03-01', 'days: 2024-02-28 + 2 = 2024-03-01 (leap)'); H(t.q('#r2').textContent, 'Friday', 'days: that is a Friday');
    t.click('#minus'); H(t.q('#r2').textContent, '2024-02-26', 'days: 2024-02-28 - 2 = 2024-02-26');
    t.type('#s', '2023-02-28'); t.type('#n', '1'); t.click('#plus'); H(t.q('#r2').textContent, '2023-03-01', 'days: non-leap 28 Feb + 1 = 1 Mar');
    t.type('#n', '-10'); t.click('#plus'); H(t.q('#r2').textContent, '2023-02-18', 'days: negative days with Add goes back');
    t.type('#n', '0'); t.click('#plus'); H(t.q('#r2').textContent, '2023-02-28', 'days: 0 days keeps the date');
    t.type('#s', '2200-01-01'); t.type('#n', '2900000'); t.click('#plus'); H(t.q('#r2').textContent, 'out of range', 'days: huge add is rejected with a message');
    T.ok(!/NaN|Invalid/.test(t.q('#r2').textContent), 'days: no NaN for huge');
    t.type('#n', ''); t.click('#plus'); H(t.q('#r2').textContent, 'Enter a date and number of days', 'days: empty days shows note');
    t.type('#s', '2024-02-28'); t.type('#n', '2'); t.click('#plus');
    const dh = hist('days'); T.ok(dh.length && dh[0].l.includes('2024-02-28 + 2 days') && dh[0].v.includes('2024-03-01'), 'days: Add result goes to history');
    // events
    t.type('#en', 'Trip'); t.click('#ea');
    H(t.q('#ev').textContent, 'Trip', 'days: event saved'); H(t.q('#ev').textContent, 'in 7 days', 'days: default event is in 7 days');
    t.type('#en', 'Now'); t.type('#ed', todayIso(0)); t.click('#ea'); H(t.q('#ev').textContent, 'Today', 'days: event today');
    t.type('#en', 'Old'); t.type('#ed', todayIso(-3)); t.click('#ea'); H(t.q('#ev').textContent, '3 days ago', 'days: past event');
    t.type('#en', 'Tomorrow'); t.type('#ed', todayIso(1)); t.click('#ea'); H(t.q('#ev').textContent, 'in 1 day', 'days: singular day');
    const order = t.all('#ev .item b:first-child').map((x) => x.textContent).join(',');
    T.eq(order, 'Old,Now,Tomorrow,Trip', 'days: events sorted by date');
    t.close();
    const t2 = await page.open('days');
    T.eq(t2.all('#ev .item').length, 4, 'days: events persist after reopening');
    t2.click('#ev [data-del]'); T.eq(t2.all('#ev .item').length, 3, 'days: delete event');
    t2.type('#ed', ''); t2.click('#ea'); T.eq(t2.all('#ev .item').length, 3, 'days: event without a date is not saved');
    t2.close();
  }

  /* ---------------- Tally counter ---------------- */
  {
    const files = [];
    w.saveTextFile = async (name, text, mime) => { files.push({ name, text, mime }); return true; };
    const t = await page.open('tally');
    const v = () => t.q('#v').textContent;
    T.eq(v(), '0', 'tally: starts at 0');
    t.click('#plus'); t.click('#plus'); t.click('#plus'); T.eq(v(), '3', 'tally: 3 taps = 3');
    t.type('#step', 5); t.click('#plus'); T.eq(v(), '8', 'tally: step 5 adds 5');
    t.click('#minus'); t.click('#minus'); T.eq(v(), '-2', 'tally: goes negative');
    t.type('#step', ''); t.click('#plus'); T.eq(v(), '-1', 'tally: empty step counts as 1');
    t.type('#step', 0); t.click('#plus'); T.eq(v(), '0', 'tally: step 0 counts as 1');
    t.type('#step', 1);
    t.click('#plus'); t.click('#plus');
    t.click('#reset'); T.eq(v(), '2', 'tally: first Reset tap only asks for confirmation');
    t.click('#reset'); T.eq(v(), '0', 'tally: second Reset tap zeroes');
    t.click('#plus');
    t.type('#newn', 'Cars'); t.click('#addc'); T.eq(t.q('#nm').textContent, 'Cars', 'tally: new counter selected');
    t.click('#plus'); t.click('#plus'); T.eq(v(), '2', 'tally: counters are independent');
    T.eq(t.all('#list .item').length, 2, 'tally: two counters listed');
    t.click('#list [data-sel="0"]'); T.eq(v(), '1', 'tally: selecting a counter shows its value');
    t.type('#newn', ''); t.click('#addc'); T.eq(t.q('#nm').textContent, 'Counter 3', 'tally: default name');
    t.click('#exp'); await sleep(20);
    T.ok(files.length === 1 && /^tally-\d{4}-\d\d-\d\d\.csv$/.test(files[0].name), 'tally: export file name');
    T.has(files[0].text, 'Counter,Value', 'tally: csv header'); T.has(files[0].text, 'Cars,2', 'tally: csv Cars row'); T.has(files[0].text, 'Counter 1,1', 'tally: csv counter 1 row');
    t.close();
    const t2 = await page.open('tally');
    T.eq(t2.all('#list .item').length, 3, 'tally: counters persist'); T.eq(t2.q('#nm').textContent, 'Counter 3', 'tally: selection persists');
    t2.click('#list [data-del="2"]'); T.eq(t2.all('#list .item').length, 3, 'tally: delete needs a second tap');
    t2.click('#list [data-del="2"]'); T.eq(t2.all('#list .item').length, 2, 'tally: second tap deletes');
    t2.close();
    page.eval("Store.set('tally.state', { list: [{ n: 'Big', v: 999999999999999 }], sel: 0, step: 1000000 })");
    const t3 = await page.open('tally'); t3.click('#plus'); T.ok(Number(t3.q('#v').textContent) <= 1e15, 'tally: value is capped at 1e15');
    t3.type('#newn', '<img src=x onerror=alert(1)>'); t3.click('#addc'); T.ok(!t3.has('#list img'), 'tally: counter names are escaped');
    t3.close();
  }

  /* ---------------- Random ---------------- */
  {
    const t = await page.open('random');
    const toasts = []; // read toast text from the DOM if present
    t.type('#mn', 1); t.type('#mx', 6);
    const counts = [0, 0, 0, 0, 0, 0, 0]; let bad = 0, n = 0;
    t.type('#cnt', 500);
    for (let k = 0; k < 12; k++) { t.click('#gn'); const xs = t.q('#rn').textContent.split(', ').map(Number); n += xs.length; xs.forEach((x) => { if (x >= 1 && x <= 6 && Number.isInteger(x)) counts[x]++; else bad++; }); }
    T.eq(bad, 0, 'random: every draw is an integer in 1..6'); T.eq(n, 6000, 'random: 12 x 500 numbers');
    T.ok(counts.slice(1).every((c) => c > 850 && c < 1150), 'random: roughly uniform ' + counts.slice(1).join('/'));
    t.type('#cnt', 1); t.type('#mn', 10); t.type('#mx', 5);
    let ok = true; for (let k = 0; k < 40; k++) { t.click('#gn'); const x = +t.q('#rn').textContent; if (!(x >= 5 && x <= 10)) ok = false; }
    T.ok(ok, 'random: min greater than max is swapped');
    t.type('#mn', 7); t.type('#mx', 7); t.click('#gn'); T.eq(t.q('#rn').textContent, '7', 'random: min = max gives that number');
    t.type('#mn', -3); t.type('#mx', -1); ok = true; for (let k = 0; k < 40; k++) { t.click('#gn'); const x = +t.q('#rn').textContent; if (!(x >= -3 && x <= -1)) ok = false; } T.ok(ok, 'random: negative range');
    t.type('#mn', 1); t.type('#mx', 6); t.type('#cnt', 6); t.check('#nr', true); t.click('#gn');
    T.eq(t.q('#rn').textContent.split(', ').map(Number).sort().join(','), '1,2,3,4,5,6', 'random: no-repeat draw of all 6 is a permutation');
    t.click('#gn'); T.eq(t.q('#rn').textContent, '', 'random: no numbers left after all were drawn');
    t.click('#rst'); t.click('#gn'); T.eq(t.q('#rn').textContent.split(', ').length, 6, 'random: after reset draws again');
    t.check('#nr', false);
    t.type('#mn', ''); t.type('#cnt', 1); t.type('#rn', ''); t.q('#rn').textContent = 'keep'; t.click('#gn'); T.eq(t.q('#rn').textContent, 'keep', 'random: empty min leaves the result untouched');
    t.type('#mn', -1e9); t.type('#mx', 1e9); t.click('#gn'); T.eq(t.q('#rn').textContent, 'keep', 'random: range over 1e9 is refused');
    t.type('#li', 'Anna\n\n  Ben  \nChloe'); let picks = new Set();
    for (let k = 0; k < 60; k++) { t.click('#pk'); picks.add(t.q('#rl').textContent); }
    T.eq([...picks].sort().join(','), 'Anna,Ben,Chloe', 'random: pick one yields only (and all) trimmed list items');
    t.click('#sh'); T.eq(t.value('#li').split('\n').sort().join(','), 'Anna,Ben,Chloe', 'random: shuffle keeps the items and drops blanks');
    t.type('#li', ''); t.q('#rl').textContent = 'x'; t.click('#pk'); T.eq(t.q('#rl').textContent, 'x', 'random: empty list picks nothing');
    t.type('#d1', '2024-01-01'); t.type('#d2', '2024-01-03'); const days = new Set();
    for (let k = 0; k < 60; k++) { t.click('#gd'); const d = t.q('#rd').textContent; days.add(d); T.ok(t.q('#rw').textContent === dayName(d), 'random: weekday matches the date ' + d); }
    T.eq([...days].sort().join(','), '2024-01-01,2024-01-02,2024-01-03', 'random: dates stay in range and cover it');
    t.type('#d1', '2024-01-03'); t.type('#d2', '2024-01-01'); t.click('#gd'); T.ok(['2024-01-01', '2024-01-02', '2024-01-03'].includes(t.q('#rd').textContent), 'random: reversed dates are swapped');
    t.close();
  }

  /* ---------------- Age ---------------- */
  {
    const t = await page.open('age');
    set(t, 0, 'dob', '1995-06-15'); set(t, 0, 'on', '2024-06-14');
    H(card(t, 0), 'Age28 years 11 months 30 days', 'age: 1995-06-15 on 2024-06-14 = 28y 11m 30d');
    const dd = msBetween('1995-06-15', '2024-06-14');
    H(card(t, 0), 'Total days lived' + String(dd).replace(/\B(?=(\d{3})+(?!\d))/g, ','), 'age: days lived ' + dd);
    H(card(t, 0).replace(/,/g, ''), 'Total days lived' + dd, 'age: days lived (any grouping)');
    H(card(t, 0).replace(/,/g, ''), 'Total weeks' + Math.floor(dd / 7), 'age: total weeks');
    H(card(t, 0), 'Born on a' + dayName('1995-06-15'), 'age: weekday of birth');
    H(card(t, 0), 'Next birthday1 day (Saturday, turning 29)', 'age: next birthday tomorrow, Saturday');
    set(t, 0, 'on', '2024-06-13'); H(card(t, 0), 'Next birthday2 days (Saturday, turning 29)', 'age: plural days');
    set(t, 0, 'on', '2024-06-15'); H(card(t, 0), 'Age29 years 0 months 0 days', 'age: on the birthday'); H(card(t, 0), 'Today! Turning 29', 'age: birthday today');
    set(t, 0, 'dob', '2000-02-29'); set(t, 0, 'on', '2023-03-01'); H(card(t, 0), 'Age23 years', 'age: leap baby on 1 Mar 2023 is 23');
    set(t, 0, 'on', '2024-02-29'); H(card(t, 0), 'Age24 years 0 months 0 days', 'age: leap baby on a real 29 Feb');
    set(t, 0, 'dob', '2024-06-16'); set(t, 0, 'on', '2024-06-15');
    H(t.q('[data-r]').textContent, 'Date of birth is after', 'age: birth after the date explains instead of a blank');
    set(t, 0, 'dob', ''); T.ok(!/NaN|undefined/.test(card(t, 0)), 'age: empty date has no NaN');
    set(t, 0, 'dob', '1995-06-15'); set(t, 0, 'on', '2024-06-14');
    pending.push(['age', 'Age', t]); t.el.remove();
  }

  /* ---------------- Time Calc ---------------- */
  {
    const t = await page.open('timecalc');
    H(card(t, 0), 'Total3:00', 'timecalc: 1:30 + 2h 15m - 0:45 = 3:00');
    H(card(t, 0), 'Decimal hours3', 'timecalc: decimal hours 3'); H(card(t, 0), 'Minutes180', 'timecalc: 180 minutes');
    set(t, 0, 't', '1:30\n1h30\n90m'); H(card(t, 0), 'Total4:30', 'timecalc: three ways to write 1.5 h = 4:30');
    set(t, 0, 't', '2 hours 15 minutes\n30 seconds'); H(card(t, 0), 'Total2:15:30', 'timecalc: words and seconds = 2:15:30');
    set(t, 0, 't', '45'); H(card(t, 0), 'Total0:45', 'timecalc: plain 45 means minutes');
    set(t, 0, 't', '1.5h'); H(card(t, 0), 'Total1:30', 'timecalc: 1.5h');
    set(t, 0, 't', '1:30\nabc'); H(card(t, 0), '1 line(s) not understood', 'timecalc: bad line is reported'); H(card(t, 0), 'Total1:30', 'timecalc: good lines still counted');
    set(t, 0, 't', '0:30\n-1:00'); H(card(t, 0), 'Total-0:30', 'timecalc: negative total');
    set(t, 0, 't', '25:00\n25:00'); H(card(t, 0), 'Total50:00', 'timecalc: hours beyond 24');
    set(t, 0, 't', ''); T.ok(!/NaN|undefined/.test(card(t, 0)), 'timecalc: empty has no NaN'); H(card(t, 0), 'Total0:00', 'timecalc: empty total 0:00');
    H(card(t, 1), 'Worked8:00', 'timecalc: 09:00-17:30 less 30 min = 8:00'); H(card(t, 1), 'Decimal hours8', 'timecalc: 8 decimal hours');
    set(t, 1, 'a', '22:00'); set(t, 1, 'b', '06:00'); set(t, 1, 'k', 0); H(card(t, 1), 'Worked8:00', 'timecalc: overnight 22:00-06:00 = 8:00'); H(card(t, 1), 'passes midnight', 'timecalc: midnight note');
    set(t, 1, 'a', '09:00'); set(t, 1, 'b', '10:00'); set(t, 1, 'k', 90); H(card(t, 1), 'Break is longer than the shift', 'timecalc: break longer than shift');
    set(t, 1, 'a', '09:15'); set(t, 1, 'b', '12:50'); set(t, 1, 'k', 0); H(card(t, 1), 'Worked3:35', 'timecalc: 09:15-12:50 = 3:35'); H(card(t, 1), 'Decimal hours3.5833', 'timecalc: 3.5833 h');
    set(t, 1, 'a', ''); H(card(t, 1), 'Enter the values', 'timecalc: empty start gives note');
    set(t, 1, 'a', '09:00'); set(t, 1, 'b', '17:30'); set(t, 1, 'k', 30);
    pending.push(['timecalc', 'Time Calc', t]); t.el.remove();
  }

  /* ---------------- Work Days ---------------- */
  {
    const t = await page.open('workdays');
    set(t, 0, 's', '2024-01-05'); set(t, 0, 'n', 1); H(card(t, 0), 'Date2024-01-08', 'workdays: Fri 5 Jan + 1 working day = Mon 8 Jan'); H(card(t, 0), 'Monday (3 calendar days)', 'workdays: weekday name and calendar days');
    set(t, 0, 's', '2024-01-01'); set(t, 0, 'n', 10); H(card(t, 0), 'Date2024-01-15', 'workdays: Mon 1 Jan + 10 = Mon 15 Jan');
    set(t, 0, 's', '2024-01-08'); set(t, 0, 'n', -1); H(card(t, 0), 'Date2024-01-05', 'workdays: Mon 8 Jan - 1 = Fri 5 Jan');
    set(t, 0, 'n', 0); H(card(t, 0), 'Date2024-01-08', 'workdays: 0 keeps the date');
    set(t, 0, 's', '2024-01-04'); set(t, 0, 'n', 1); set(t, 0, 'w', '5,6'); H(card(t, 0), 'Date2024-01-07', 'workdays: Fri+Sat weekend, Thu + 1 = Sun');
    set(t, 0, 'w', '0'); set(t, 0, 'n', 6); H(card(t, 0), 'Date2024-01-11', 'workdays: Sun only, Thu 4 Jan + 6 = Thu 11 Jan (Sat counts)');
    set(t, 0, 'n', 20000); T.ok(!/NaN|Invalid|undefined/.test(card(t, 0)), 'workdays: 20000 days is ok');
    set(t, 0, 'n', ''); H(card(t, 0), 'Enter the values', 'workdays: empty days gives note');
    set(t, 1, 'a', '2024-01-01'); set(t, 1, 'b', '2024-01-31');
    H(card(t, 1), 'Working days (both dates included)23', 'workdays: Jan 2024 has 23 weekdays'); H(card(t, 1), 'Calendar days31', 'workdays: 31 calendar days');
    set(t, 1, 'w', '5,6'); H(card(t, 1), 'days (both dates included)23', 'workdays: Fri+Sat weekend in Jan 2024 is also 23 (4 Fri + 4 Sat + 4 Sat... ) check');
    set(t, 1, 'w', '0,6'); set(t, 1, 'b', '2023-12-01'); H(card(t, 1), 'before the start date', 'workdays: end before start');
    set(t, 1, 'a', '2024-01-06'); set(t, 1, 'b', '2024-01-07'); H(card(t, 1), 'both dates included)0', 'workdays: a weekend only has 0');
    set(t, 1, 'a', '1900-01-01'); set(t, 1, 'b', '2100-01-01'); H(card(t, 1), 'less than 100 years', 'workdays: span over 100 years refused');
    set(t, 1, 'a', '2024-01-01'); set(t, 1, 'b', '2024-01-31');
    pending.push(['workdays', 'Work Days', t]); t.el.remove();
  }

  // settled history: age, timecalc, workdays were typed to their final values above
  await sleep(1800);
  for (const [id, lab, t] of pending) { const h = hist(id); T.ok(h.length > 0 && h[0].l.includes(lab) && h[0].v, 'history: ' + id + ' has a settled entry (got ' + JSON.stringify(h[0]) + ')'); t.close(); }
  await T.done(page);
})().catch((e) => { console.log("CRASH", e && e.stack || e); process.exit(1); });
