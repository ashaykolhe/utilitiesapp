'use strict';
/* Functional tests: Timer, Stopwatch, Reminders, Calculator, Unit Converter, Device Info. */
const { suite } = require('../helpers/page');
const { bootFx, clock, fakeNotifications } = require('./fx');
(async () => {
  const T = suite('basics'), page = await bootFx(), w = page.w;
  const log = (m) => { if (process.env.V) console.log('>> ' + m + ' errors=' + page.errors.length); };
  const toastText = () => w.document.querySelector('#toast').textContent;
  const store = (k) => JSON.parse(w.localStorage.getItem('pk.' + k) || 'null');
  const put = (k, v) => w.localStorage.setItem('pk.' + k, JSON.stringify(v));
  w.Element.prototype.scrollIntoView = function () {};
  const clk = clock(page, '2026-03-10T10:00:00Z');
  const copied = []; Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async (x) => { copied.push(x); } }, configurable: true });
  const note = fakeNotifications(page, 'granted');

  /* ---------- Timer ---------- */
  log('timer');
  {
    let t = await page.open('timer');
    T.eq(t.q('#d').textContent, '05:00', 'timer: default 05:00');
    t.type('#m', '1'); t.type('#s', '30'); T.eq(t.q('#d').textContent, '01:30', 'timer: 1 min 30 s shows 01:30');
    t.click('#go'); await page.wait(10);
    T.eq(note.last().id, 710001, 'timer: notification id 710001');
    T.eq(note.last().schedule.at.toISOString(), '2026-03-10T10:01:30.000Z', 'timer: notification at +90 s');
    await clk.advance(30000);
    T.eq(t.q('#d').textContent, '01:00', 'timer: 01:00 after 30 s');
    t.click('#go'); T.eq(t.q('#go').textContent, 'Resume', 'timer: pause');
    T.ok(note.cancelled.includes(710001), 'timer: pause cancels the notification');
    await clk.advance(20000); T.eq(t.q('#d').textContent, '01:00', 'timer: paused clock holds');
    note.reset(); t.click('#go'); await page.wait(10);
    T.eq(note.last().schedule.at.getTime(), clk.now() + 60000, 'timer: resume reschedules for the remaining minute');
    t.close();
    t = await page.open('timer');
    T.eq(t.q('#go').textContent, 'Pause', 'timer: a running timer carries on after leaving the tool');
    await clk.advance(30000); T.eq(t.q('#d').textContent, '00:30', 'timer: continues (30 s left)');
    await clk.advance(30000);
    T.eq(t.q('#d').textContent, '00:00', 'timer: reaches 00:00');
    T.eq(toastText(), 'Time is up', 'timer: toast when done');
    T.eq(t.q('#go').textContent, 'Start', 'timer: button back to Start');
    T.eq(store('timer.run'), null, 'timer: stored run cleared');
    t.click('#go'); await page.wait(10); await clk.advance(5000); note.reset();
    t.click('#rs'); await page.wait(10);
    T.ok(note.cancelled.includes(710001), 'timer: reset cancels the notification');
    T.eq(t.q('#d').textContent, '01:30', 'timer: reset shows the time in the fields again (the remembered 01:30)');
    t.type('#m', '999'); t.type('#s', '59'); T.eq(t.q('#d').textContent, '16:39:59', 'timer: 999 min 59 s shows 16:39:59');
    t.type('#m', '0'); t.type('#s', '0'); t.click('#go'); T.eq(t.q('#go').textContent, 'Start', 'timer: 0 time does not start');
    const n0 = clk.timers(); t.type('#m', '1'); t.click('#go'); t.close(); T.ok(clk.timers() <= n0, 'timer: interval cleared on leaving');
    w.localStorage.removeItem('pk.timer.run');
    t = await page.open('timer');
    T.eq(t.q('#m').value + ':' + t.q('#s').value, '1:0', 'timer: the last time started is remembered (1 min 0 s)');
    t.click('[data-pm="10"]'); T.eq(t.q('#d').textContent, '10:00', 'timer: the 10m button sets 10:00'); T.eq(t.q('#s').value, '0', 'timer: preset clears the seconds');
    t.click('#go'); await page.wait(10); T.eq(note.last().schedule.at.getTime(), clk.now() + 600000, 'timer: a preset starts a 10 minute timer');
    t.click('[data-pm="3"]'); T.eq(toastText(), 'Reset the timer first', 'timer: presets are refused while running'); T.eq(t.q('#m').value, '10', 'timer: running timer unchanged by a preset');
    t.click('#go'); t.click('[data-pm="3"]'); T.eq(t.q('#d').textContent, '03:00', 'timer: preset replaces a paused timer'); T.eq(t.q('#go').textContent, 'Start', 'timer: button says Start again');
    t.close(); w.localStorage.removeItem('pk.timer.run'); w.localStorage.removeItem('pk.timer.last'); note.perm = 'denied';
    t = await page.open('timer'); await page.wait(10);
    T.ok(!t.q('#nb').hidden, 'timer: blocked message is shown when notifications are denied');
    t.close(); note.perm = 'granted';
  }

  /* ---------- Stopwatch ---------- */
  log('stopwatch');
  {
    const t = await page.open('stopwatch');
    T.eq(t.q('#d').textContent, '00:00.00', 'stopwatch: starts at zero');
    t.click('#lap'); T.eq(t.all('#laps .item').length, 0, 'stopwatch: lap while stopped is ignored');
    t.click('#go'); await clk.advance(12360);
    T.eq(t.q('#d').textContent, '00:12.36', 'stopwatch: 12.36 s');
    t.click('#lap'); await clk.advance(7020); t.click('#lap');
    const rows = t.all('#laps .item').map(r => r.textContent);
    T.has(rows[0], 'Lap 2', 'stopwatch: newest lap first');
    T.has(rows[0], '00:07.02', 'stopwatch: lap time is the split (7.02 s)');
    T.has(rows[0], '00:19.38', 'stopwatch: total shown beside it');
    T.has(rows[1], '00:12.36', 'stopwatch: first lap');
    t.click('#go'); T.eq(t.q('#go').textContent, 'Resume', 'stopwatch: pause shows Resume');
    const frozen = t.q('#d').textContent; await clk.advance(9000); T.eq(t.q('#d').textContent, frozen, 'stopwatch: stays paused');
    t.click('#go'); await clk.advance(1620); T.eq(t.q('#d').textContent, '00:21.00', 'stopwatch: resumes from 19.38 s: 19.38 + 1.62 = 21.00');
    await clk.advance(3600000 - 21000 + 60); T.eq(t.q('#d').textContent, '01:00:00.06', 'stopwatch: hours are shown after 60 minutes');
    for (let i = 0; i < 510; i++) t.click('#lap');
    T.eq(t.all('#laps .item').length, 500, 'stopwatch: 500 lap cap');
    t.click('#rs'); T.eq(t.q('#d').textContent, '00:00.00', 'stopwatch: reset'); T.eq(t.all('#laps .item').length, 0, 'stopwatch: laps cleared');
    t.click('#go'); const n0 = clk.timers(); t.close(); T.ok(clk.timers() < n0, 'stopwatch: interval cleared on leaving');
  }

  /* ---------- Reminders ---------- */
  log('reminders');
  {
    note.reset(); clk.set('2026-03-10T10:00:00Z');
    let t = await page.open('reminders');
    T.has(t.text(), 'No reminders yet', 'reminders: empty state');
    t.type('#t', 'Call dentist'); t.type('#w', '2026-03-10T11:30'); t.click('#add'); await page.wait(20);
    T.eq(note.last().id, 100000001, 'reminders: first id is in block 100,000,000');
    T.eq(note.last().schedule.at.toISOString(), '2026-03-10T11:30:00.000Z', 'reminders: scheduled at the chosen time');
    T.eq(note.last().body, 'Call dentist', 'reminders: body is the text');
    T.eq(toastText(), 'Reminder set', 'reminders: confirmation');
    T.eq(t.value('#t'), '', 'reminders: text cleared');
    T.has(t.q('#l').textContent, 'Call dentist', 'reminders: listed');
    t.type('#t', 'Past'); t.type('#w', '2026-03-10T09:00'); t.click('#add'); T.eq(toastText(), 'Enter text and a future time', 'reminders: past time refused');
    t.type('#t', ''); t.type('#w', '2026-03-10T12:00'); t.click('#add'); T.eq(toastText(), 'Enter text and a future time', 'reminders: empty text refused');
    t.type('#t', 'Second'); t.type('#w', '2026-03-10T10:20'); t.click('#add'); await page.wait(20);
    T.eq(note.last().id, 100000002, 'reminders: second id');
    T.ok(t.q('#l').textContent.indexOf('Second') < t.q('#l').textContent.indexOf('Call dentist'), 'reminders: sorted by time');
    t.type('#t', 'Third'); t.type('#w', '2026-03-12T08:00'); t.click('#add'); await page.wait(20);
    const n3 = store('reminders').length;
    t.type('#t', 'Fourth'); t.type('#w', '2026-03-13T08:00'); t.click('#add'); await page.wait(20);
    T.eq(store('reminders').length, n3, 'reminders: free plan allows 3 active reminders');
    /* fires in the page */
    await clk.advance(20 * 60000 + 1000);
    T.has(toastText(), 'Second', 'reminders: in-app alert fires');
    T.eq(store('reminders').find(r => r.text === 'Second').done, true, 'reminders: fired reminder marked done');
    note.reset(); t.click('[data-id="100000002"]'); await page.wait(20);
    T.eq(note.cancelled.join(), '100000002', 'reminders: delete cancels that id');
    t.close();
    /* a reminder Android already delivered while away is ticked off silently */
    await clk.advance(2 * 3600000);
    t = await page.open('reminders'); await page.wait(10);
    T.eq(store('reminders').filter(r => !r.done).length, 2 - 1, 'reminders: past reminders are done on return');
    t.close();
    t = await page.open('reminders');
    T.ok(!t.q('#clr').hidden, 'reminders: Clear finished shows when something has finished');
    t.click('#clr'); T.ok(store('reminders').every((r) => !r.done), 'reminders: Clear finished removes done reminders and keeps the others'); T.ok(t.q('#clr').hidden, 'reminders: button hides again');
    t.close();
    /* many finished ones are trimmed */
    put('reminders', Array.from({ length: 30 }, (_, i) => ({ id: 5000 + i, text: 'old' + i, at: 1000 + i, done: true, nat: true })));
    t = await page.open('reminders'); t.type('#t', 'New one'); t.type('#w', '2026-03-20T08:00'); t.click('#add'); await page.wait(20);
    T.ok(store('reminders').filter(r => r.done).length <= 20, 'reminders: only the newest 20 finished reminders are kept');
    t.close();
    /* denied */
    w.localStorage.removeItem('pk.reminders'); note.perm = 'denied';
    t = await page.open('reminders'); await page.wait(10);
    T.ok(!t.q('#nb').hidden, 'reminders: blocked line is visible when notifications are denied');
    t.type('#t', 'X'); t.type('#w', '2026-03-21T08:00'); t.click('#add'); await page.wait(20);
    T.eq(toastText(), 'Saved, but notifications are blocked', 'reminders: permission denied message');
    t.close(); note.perm = 'granted'; w.localStorage.removeItem('pk.reminders');
  }

  /* ---------- Calculator ---------- */
  log('calculator');
  {
    const t = await page.open('calculator');
    const calc = (keys) => { t.clickText('C'); [...keys].forEach(k => t.clickText(k)); return t.q('#d').textContent; };
    const run = (keys) => calc(keys + '=');
    T.eq(run('12+30×2'), '72', 'calculator: 12 + 30 x 2 = 72 (precedence)');
    T.eq(run('0.1+0.2'), '0.3', 'calculator: 0.1 + 0.2 = 0.3');
    T.eq(run('50+10%'), '55', 'calculator: 50 + 10% = 55');
    T.eq(run('200×10%'), '20', 'calculator: 200 x 10% = 20');
    T.eq(run('200−10%'), '180', 'calculator: 200 - 10% = 180');
    T.eq(run('1÷3'), '0.333333333333', 'calculator: 1 / 3 to 12 digits');
    T.eq(run('2−5'), '-3', 'calculator: 2 - 5 = -3');
    T.eq(run('−5×2'), '-10', 'calculator: leading minus');
    T.eq(run('7÷2'), '3.5', 'calculator: 7 / 2');
    T.eq(run('3×3×3×3'), '81', 'calculator: chained multiply');
    T.eq(run('100÷8÷5'), '2.5', 'calculator: left to right division');
    T.eq(run('9999999999×9999999999'), '99999999980000000000', 'calculator: 9999999999 x 9999999999 keeps 12 significant digits');
    T.eq(run('99999999999×99999999999'), '9.9999999998e+21', 'calculator: results above 1e21 use exponent form');
    t.clickText('÷'); t.clickText('2'); t.clickText('='); T.eq(t.q('#d').textContent, '4.9999999999e+21', 'calculator: an exponent result can be used in the next calculation');
    T.eq(calc('007'), '7', 'calculator: leading zeros are removed');
    T.eq(calc('.5'), '0.5', 'calculator: .5 shows 0.5');
    T.eq(calc('1..2'), '1.2', 'calculator: second decimal point ignored');
    T.eq(calc('5+×3'), '5×3', 'calculator: operator replaced by the last one');
    T.eq(calc('12⌫'), '1', 'calculator: backspace');
    T.eq(calc('1+2=⌫'), '0', 'calculator: backspace after a result clears it');
    T.eq(run('5÷0'), '5÷0', 'calculator: division by zero keeps the expression');
    T.eq(toastText(), 'Invalid expression', 'calculator: division by zero toast');
    T.eq(calc('1+2=') , '3', 'calculator: result shown');
    t.clickText('×'); t.clickText('4'); t.clickText('='); T.eq(t.q('#d').textContent, '12', 'calculator: an operator after a result continues from it (3 x 4)');
    t.clickText('5'); T.eq(t.q('#d').textContent, '5', 'calculator: a digit after a result starts fresh');
    T.eq(calc('9'.repeat(70)).length, 60, 'calculator: expression capped at 60 characters');
    t.clickText('C'); T.eq(t.q('#d').textContent, '0', 'calculator: clear');
    t.clickText('2'); t.clickText('+'); t.clickText('2'); t.clickText('=');
    const h = JSON.parse(w.localStorage.getItem('pk.hist') || '[]');
    T.ok(h.some(x => x.t === 'calculator' && x.l === '2+2' && x.v === '4'), 'calculator: result goes to the history');
    t.close();
  }

  /* ---------- Unit Converter ---------- */
  log('converter');
  {
    const t = await page.open('converter');
    const conv = (cat, from, to, v) => { t.select('#t', cat); t.select('#a', from); t.select('#b', to); t.type('#v', v); return t.q('#o').textContent; };
    T.eq(conv('Length', 'mile', 'km', 1), '1.609344 km', 'converter: 1 mile = 1.609344 km');
    T.eq(conv('Length', 'inch', 'cm', 1), '2.54 cm', 'converter: 1 inch = 2.54 cm');
    T.eq(conv('Length', 'foot', 'm', 100), '30.48 m', 'converter: 100 ft = 30.48 m');
    T.eq(conv('Weight', 'lb', 'kg', 1), '0.45359237 kg', 'converter: 1 lb = 0.45359237 kg');
    T.eq(conv('Weight', 'oz', 'g', 1), '28.34952313 g', 'converter: 1 oz = 28.34952313 g');
    T.eq(conv('Weight', 'kg', 'lb', 70), '154.3235835 lb', 'converter: 70 kg = 154.3235835 lb');
    T.eq(conv('Volume', 'gal (US)', 'L', 1), '3.785411784 L', 'converter: 1 US gallon = 3.785411784 L');
    T.eq(conv('Volume', 'fl oz (US)', 'mL', 1), '29.57352956 mL', 'converter: 1 US fl oz = 29.57352956 mL');
    T.eq(conv('Volume', 'cup (US)', 'mL', 1), '236.5882365 mL', 'converter: 1 US cup = 236.5882365 mL');
    T.eq(conv('Area', 'acre', 'm²', 1), '4046.856422 m²', 'converter: 1 acre = 4046.856422 m2');
    T.eq(conv('Area', 'hectare', 'acre', 1), '2.471053815 acre', 'converter: 1 hectare = 2.471053815 acres');
    T.eq(conv('Speed', 'mph', 'km/h', 60), '96.56064 km/h', 'converter: 60 mph = 96.56064 km/h');
    T.eq(conv('Speed', 'knot', 'km/h', 1), '1.852 km/h', 'converter: 1 knot = 1.852 km/h exactly');
    T.eq(conv('Speed', 'km/h', 'm/s', 36), '10 m/s', 'converter: 36 km/h = 10 m/s');
    T.eq(conv('Data', 'GB', 'MB', 1), '1024 MB', 'converter: 1 GB = 1024 MB');
    T.eq(conv('Time', 'week', 'hour', 1), '168 hour', 'converter: 1 week = 168 hours');
    T.eq(conv('Time', 'day', 'min', 1), '1440 min', 'converter: 1 day = 1440 minutes');
    T.eq(conv('Temperature', 'C', 'F', 100), '212 F', 'converter: 100 C = 212 F');
    T.eq(conv('Temperature', 'F', 'C', -40), '-40 C', 'converter: -40 F = -40 C');
    T.eq(conv('Temperature', 'K', 'C', 0), '-273.15 C', 'converter: 0 K = -273.15 C');
    T.eq(conv('Temperature', 'C', 'K', 36.6), '309.75 K', 'converter: 36.6 C = 309.75 K');
    T.eq(conv('Temperature', 'F', 'K', 32), '273.15 K', 'converter: 32 F = 273.15 K');
    T.eq(conv('Length', 'm', 'm', 5), '5 m', 'converter: same unit');
    T.eq(conv('Length', 'km', 'm', 0), '0 m', 'converter: zero');
    T.eq(conv('Length', 'km', 'mm', -2.5), '-2500000 mm', 'converter: negative numbers');
    t.type('#v', ''); T.eq(t.q('#o').textContent, '—', 'converter: empty value shows a dash');
    T.eq(conv('Length', 'mm', 'km', 1e12), '1000000 km', 'converter: very large input');
    T.ok(!/NaN|Infinity/.test(t.text()), 'converter: no NaN or Infinity');
    conv('Length', 'mile', 'km', 2); t.click('#sw');
    T.eq(t.value('#a') + '>' + t.value('#b'), 'km>mile', 'converter: Swap exchanges the two units'); T.eq(t.q('#o').textContent, '1.242742384 mile', 'converter: after Swap, 2 km = 1.242742384 miles');
    t.select('#t', 'Weight'); T.eq(t.all('#a option').length, 6, 'converter: category change refills the units');
    await clk.advance(1600);
    const h = JSON.parse(w.localStorage.getItem('pk.hist') || '[]');
    T.ok(h.some(x => x.t === 'converter'), 'converter: settled results go to the history');
    t.close();
    const t2 = await page.open('converter');
    T.eq(t2.value('#t') + '|' + t2.value('#a') + '|' + t2.value('#b'), 'Weight|kg|g', 'converter: the last category and units are remembered');
    t2.select('#t', 'Length'); t2.select('#a', 'yard'); t2.select('#b', 'foot'); t2.type('#v', '1'); t2.close();
    const t3 = await page.open('converter'); T.eq(t3.q('#o').textContent, '3 foot', 'converter: yard and foot come back after reopening (1 yard = 3 feet)');
    t3.close();
  }

  /* ---------- Device Info ---------- */
  log('deviceinfo');
  {
    Object.defineProperty(w.navigator, 'getBattery', { value: () => Promise.resolve({ level: 0.42, charging: true }), configurable: true });
    const t = await page.open('deviceinfo'); await page.wait(10);
    for (const k of ['Screen', 'Pixel ratio', 'Language', 'CPU cores', 'Memory', 'Online', 'Touch points', 'User agent']) T.has(t.text(), k, 'deviceinfo: ' + k + ' row');
    T.has(t.text(), '42% (charging)', 'deviceinfo: battery row');
    t.click('#cp'); await page.wait(10);
    T.eq(toastText(), 'Details copied', 'deviceinfo: Copy details confirms'); T.has(copied[copied.length - 1], 'Screen: ', 'deviceinfo: copied text has the Screen line'); T.has(copied[copied.length - 1], 'Battery: 42% (charging)', 'deviceinfo: copied text has the battery line');
    T.ok(!/undefined|NaN/.test(t.text()), 'deviceinfo: no undefined or NaN');
    t.close();
  }


  /* ---------- Wrong saved data never stops a tool from opening ---------- */
  log('corrupt');
  {
    const mine = 'screenlight routerec pincode parking worldclock pomodoro alarmclock signallight todo devstatus quicktimers clipboard shopping expenses tipday calendar birthdays multiwatch moonphase suntimes meetingplanner typingtest timer stopwatch reminders calculator converter deviceinfo currency recipescale holidays flashcards morsetrainer colourmix pixelart signature meetingcost lifecal anagram sequences matrix trig periodic countrycodes cbsim asciiart namegen imgpalette'.split(' ');
    Object.defineProperty(w.navigator, 'getBattery', { value: undefined, configurable: true });
    const bad = [null, {}, 'x', 5, [null], [{}], [1, 2], [{ id: 1, text: 5, name: 7, t: {} }]];
    const Store = w.eval('Store'); w.Element.prototype.setPointerCapture = function () {};
    let problems = 0, tried = 0; const shown = [];
    for (const id of mine) {
      const keys = new Set(), orig = Store.get; Store.get = (k, d) => { keys.add(k); return orig.call(Store, k, d); };
      const t0 = await page.open(id); t0.close(); Store.get = orig;
      for (const k of keys) for (const v of bad) {
        w.localStorage.clear(); w.localStorage.setItem('pk.' + k, JSON.stringify(v)); tried++;
        const before = page.errors.length, nb = w.document.body.children.length; let msg = '';
        try { const t = await page.open(id); const txt = t.text(); if (/undefined|NaN|\[object|Infinity/.test(txt)) msg = 'bad text'; t.close(); } catch (e) { msg = 'threw ' + e.message.slice(0, 60); }
        while (w.document.body.children.length > nb) w.document.body.lastChild.remove();
        if (page.errors.length > before) { msg += ' page error'; page.errors.length = before; }
        if (msg) { problems++; if (shown.length < 5) shown.push(id + ' ' + k + ' ' + JSON.stringify(v) + ': ' + msg); }
      }
      w.localStorage.clear();
    }
    T.eq(problems, 0, 'corrupt: wrong data in saved keys (' + tried + ' combinations) never breaks a tool' + (shown.length ? ' -> ' + shown.join(' | ') : ''));
  }


  /* ---------- Leaving a tool leaves nothing behind (timers, window and document listeners, overlays) ---------- */
  log('cleanup');
  {
    const mine = 'screenlight routerec pincode parking worldclock pomodoro alarmclock signallight todo devstatus quicktimers clipboard shopping expenses tipday calendar birthdays multiwatch moonphase suntimes meetingplanner typingtest timer stopwatch reminders calculator converter deviceinfo currency recipescale holidays flashcards morsetrainer colourmix pixelart signature meetingcost lifecal anagram sequences matrix trig periodic countrycodes cbsim asciiart namegen imgpalette'.split(' ');
    const live = new Map(); let seen = 0;
    const wrap = (target, name) => { const add = target.addEventListener, rem = target.removeEventListener;
      target.addEventListener = function (t, f, o) { const k = name + ':' + t; live.set(k, (live.get(k) || 0) + 1); return add.call(this, t, f, o); };
      target.removeEventListener = function (t, f, o) { const k = name + ':' + t; live.set(k, (live.get(k) || 0) - 1); return rem.call(this, t, f, o); }; };
    wrap(w, 'window'); wrap(w.document, 'document');
    const leaks = [];
    for (const id of mine) {
      w.localStorage.clear(); const l0 = new Map(live), n0 = clk.timers(), b0 = w.document.body.children.length;
      const t = await page.open(id); await page.wait(10); t.close(); await page.wait(10);
      if (clk.timers() > n0) leaks.push(id + ' timers +' + (clk.timers() - n0));
      for (const [k, v] of live) if (v !== (l0.get(k) || 0)) leaks.push(id + ' ' + k + ' ' + (v - (l0.get(k) || 0)));
      if (w.document.body.children.length !== b0) leaks.push(id + ' left ' + (w.document.body.children.length - b0) + ' element(s) in the page');
    }
    T.eq(leaks.join(' | '), '', 'cleanup: no tool leaves timers, listeners or overlays behind');
  }

  await T.done(page);
})().catch((e) => { console.log("CRASH: " + (e && e.stack || e)); process.exit(1); });
