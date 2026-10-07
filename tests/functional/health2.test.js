'use strict';
/* Functional tests for the Health group, part 2: trackers that store data (water, steps, log, mood, habits), timers (breathing, workout,
   fasting, meditation, eye rest, with a controllable clock) and the camera heart rate. */
const { boot } = require('./mh-fakes');
const { suite } = require('../helpers/page');

(async () => {
  const T = suite('health2'), page = await boot(), w = page.w;
  const toast = () => w.document.querySelector('#toast').textContent;
  const dkey = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const today = () => dkey(new Date(w.eval('+new Date()')));
  const shiftKey = (n) => { const d = new Date(w.eval('+new Date()')); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return dkey(d); };
  const shown = (s) => String(s).replace(/[^\d]/g, '');
  const cap = []; w.saveTextFile = async (name, text, mime) => { cap.push({ name, text, mime }); return true; };
  const shared = []; w.Capacitor.Plugins.Share = { share: (o) => { shared.push(o); return Promise.resolve(); } };
  const clip = []; Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { writeText: (t) => { clip.push(t); return Promise.resolve(); } } });
  const set = (k, v) => w.eval('Store.set(' + JSON.stringify(k) + ',' + JSON.stringify(v) + ')');
  const vib = []; w.navigator.vibrate = (p) => { vib.push(p); return true; };

  /* ---------------------------------------------------------------- Water tracker */
  {
    set('water.days', {});
    const t = await page.open('water'); await page.wait(30);
    T.eq(t.q('#ml').textContent, '0', 'water starts at 0'); T.has(t.q('#of').textContent, 'of 2000 ml', 'default goal 2000');
    t.clickText('+250'); t.clickText('+250'); T.eq(t.q('#ml').textContent, '500', 'two glasses = 500 ml'); T.has(t.q('#of').textContent, '25%', '25 percent');
    t.type('#cu', '330'); t.click('#ca'); T.eq(t.q('#ml').textContent, '830', 'custom 330 added'); T.eq(t.value('#cu'), '', 'custom box clears');
    t.type('#cu', ''); t.click('#ca'); T.has(toast(), 'Enter an amount from 1 to 5000', 'empty custom amount is refused');
    t.click('#un'); T.eq(t.q('#ml').textContent, '500', 'undo removes the last add'); t.click('#un'); t.click('#un'); T.eq(t.q('#ml').textContent, '0', 'undo all'); t.click('#un'); T.has(toast(), 'Nothing to undo', 'undo with nothing says so');
    T.eq(t.q('#lv').getAttribute('transform'), 'translate(0 232)', 'empty glass: water level at the bottom');
    t.type('#gl', '500'); t.clickText('+500'); T.has(toast(), 'Daily goal reached', 'reaching the goal says so'); T.eq(t.q('#lv').getAttribute('transform'), 'translate(0 17)', 'full glass: level at the top');
    t.clickText('+500'); T.eq(t.q('#ml').textContent, '1000', 'going over the goal keeps counting'); T.has(t.q('#of').textContent, '200%', '200 percent');
    T.eq(page.store('water.days', {})[today()], 1000, 'intake is stored for today'); T.eq(page.store('water.goal', 0), 500, 'goal is stored');
    cap.length = 0; t.click('#ex');
    await page.wait(20); T.eq(cap.length, 1, 'export produced a file'); T.eq(cap[0].name, 'water-' + today() + '.csv', 'water file name');
    T.eq(cap[0].text, '﻿Date,Water (ml),Goal (ml)\r\n' + today() + ',1000,500', 'water CSV content (BOM, CRLF)');
    t.close();
    const t2 = await page.open('water'); await page.wait(20); T.eq(t2.q('#ml').textContent, '1000', 'water is remembered when reopening'); t2.close();
    set('water.days', {}); const t3 = await page.open('water'); cap.length = 0; t3.click('#ex'); T.has(toast(), 'No water history', 'empty export says so'); T.eq(cap.length, 0, 'no file for an empty export'); t3.close();
  }

  /* ---------------------------------------------------------------- Step counter */
  {
    set('steps.days', { [today()]: 10000 }); set('steps.height', 180); set('steps.kg', 70); set('steps.goal', 8000);
    const t = await page.open('steps'); await page.wait(40);
    T.eq(shown(t.q('#n').textContent), '10000', 'steps shows 10000'); T.has(t.q('#of').textContent, '8000'.slice(0, 1), 'goal line');
    T.has(t.q('#km').textContent, '7.47 km', '10000 steps at 180 cm = 7.47 km'); T.has(t.q('#kc').textContent, '399 kcal', '10000 steps at 70 kg = 399 kcal');
    T.eq(t.q('#rg .rv').getAttribute('stroke-dasharray'), '100 100', 'ring is full above the goal');
    t.type('#gl', '20000'); T.eq(t.q('#rg .rv').getAttribute('stroke-dasharray'), '50 100', 'ring half full at 10000 of 20000');
    t.type('#ht', '90'); T.eq(t.value('#ht'), '100', 'height is limited to at least 100 cm');
    T.eq(t.q('#go').textContent, 'Pause', 'counting starts automatically'); T.eq(page.live('devicemotion'), 1, 'listening to the motion sensor');
    t.click('#rs'); T.eq(shown(t.q('#n').textContent), '0', 'reset today'); T.eq(page.store('steps.days', {})[today()], 0, 'reset is stored');
    const walk = (hz, amp, secs, t0) => { for (let i = 0; i < 50 * secs; i++) { const ts = t0 + i * 20; page.motion({ x: 0, y: 0, z: 9.8 + amp * Math.sin(2 * Math.PI * hz * i * 0.02) }, null, 1, ts); } };
    walk(1.8, 3, 20, 1000); await page.wait(60);
    const n = +shown(t.q('#n').textContent); T.ok(n >= 33 && n <= 38, '20 s of walking at 1.8 steps/s shows about 36 steps (got ' + n + ')');
    walk(1.8, 0.2, 10, 40000); await page.wait(60); T.eq(+shown(t.q('#n').textContent), n, 'tiny vibration adds no steps');
    t.click('#go'); T.eq(t.q('#go').textContent, 'Start counting', 'pause'); T.eq(page.live('devicemotion'), 0, 'pausing stops listening'); T.has(t.q('#msg').textContent, 'Paused', 'paused message');
    T.eq(page.store('steps.days', {})[today()], n, 'steps are stored when paused');
    walk(1.8, 3, 5, 60000); await page.wait(40); T.eq(+shown(t.q('#n').textContent), n, 'no counting while paused');
    t.click('#go'); T.eq(page.live('devicemotion'), 1, 'resume listens again'); t.close(); T.eq(page.live('devicemotion'), 0, 'leaving stops listening');
    // export
    set('steps.days', { [shiftKey(-1)]: 4000, [today()]: 0 }); const e = await page.open('steps'); cap.length = 0; e.click('#ex'); await page.wait(20);
    T.eq(cap.length, 1, 'steps export'); T.eq(cap[0].text, '﻿Date,Steps,Goal,Distance (km),Calories (kcal)\r\n' + shiftKey(-1) + ',4000,20000,1.66,160', 'steps CSV: 4000 steps at 100 cm (the clamped height) = 1.66 km, 160 kcal, days with 0 skipped'); e.close();
    set('steps.days', {}); const e2 = await page.open('steps'); cap.length = 0; e2.click('#ex'); T.has(toast(), 'No step history', 'empty steps export says so'); e2.close();
    page.noMotionApi(); const ns = await page.open('steps'); T.has(ns.q('#msg').textContent, 'No motion sensor found', 'steps without a sensor'); T.eq(ns.q('#go').textContent, 'Start counting', 'button stays Start'); ns.close();
    page.motionApi(() => Promise.resolve('denied')); const dn = await page.open('steps'); await page.wait(30); T.has(dn.q('#msg').textContent, 'Motion permission denied', 'steps permission denied'); T.eq(page.live('devicemotion'), 0, 'no listener when denied'); dn.close();
    page.motionApi(() => Promise.reject(new Error('x'))); const rj = await page.open('steps'); await page.wait(30); T.has(rj.q('#msg').textContent, 'Motion permission denied', 'steps permission error'); rj.close();
    page.motionApi(); const idle = await page.open('steps'); await page.wait(2700); T.has(idle.q('#msg').textContent, 'No motion sensor found', 'sensor API present but silent: says no sensor after a few seconds'); idle.close();
  }

  /* ---------------------------------------------------------------- Health log */
  {
    set('hlog.entries', []);
    const t = await page.open('healthlog'); await page.wait(30);
    T.has(t.q('#lg').textContent, 'Add your first entry', 'health log empty state');
    t.type('#dt', '2026-01-02'); t.click('#add'); T.has(toast(), 'Enter a value', 'adding without a value is refused');
    t.type('#v', '72.5'); t.type('#nt', 'AM'); t.click('#add'); T.has(toast(), 'Added', 'entry added');
    T.has(t.q('#ls').textContent, 'Weight 72.5 kg', 'weight entry listed'); T.has(t.q('#ls').textContent, 'AM', 'note listed'); T.has(t.q('#lg').textContent, '1 entries', 'legend counts entries');
    t.type('#dt', '2026-01-01'); t.type('#v', '70'); t.type('#nt', '=x'); t.click('#add');
    t.type('#dt', '2026-01-03'); t.clickText('BP'); t.type('#v', '120'); t.click('#add'); T.has(toast(), 'Enter a value', 'blood pressure needs both numbers');
    t.type('#v2', '80'); t.click('#add'); T.has(t.q('#ls').textContent, '120/80', 'blood pressure listed as 120/80');
    t.type('#dt', '2026-01-04'); t.clickText('Custom'); t.type('#v', '36.6'); t.click('#add'); T.has(toast(), 'Give the measure a name', 'custom measure needs a name');
    t.type('#nm', 'Temp'); t.type('#un', '°C'); t.click('#add'); T.has(t.q('#ls').textContent, 'Temp 36.6 °C', 'custom measure listed');
    T.eq(page.store('hlog.entries', []).length, 4, 'four entries stored');
    cap.length = 0; t.click('#csv'); await page.wait(20);
    const lines = cap[0].text.replace('﻿', '').split('\r\n');
    T.eq(lines[0], 'Date,Measure,Value,Value 2 (diastolic),Unit,Note', 'health CSV header'); T.eq(lines[1], "2026-01-01,Weight,70,,kg,'=x", 'oldest first, formula-looking note is defused');
    T.eq(lines[2], '2026-01-02,Weight,72.5,,kg,AM', 'second row'); T.ok(/^2026-01-04,Temp,36.6,,°C,$/.test(lines[4]) && /^2026-01-03,Blood pressure,120,80,mmHg,$/.test(lines[3]), 'dates in order'); T.ok(lines.some(l => /^\d{4}-\d\d-\d\d,Blood pressure,120,80,mmHg,$/.test(l)), 'BP row has both values'); T.ok(lines.some(l => /,Temp,36.6,,°C,$/.test(l)), 'custom row');
    T.ok(/^health-log-\d{4}-\d\d-\d\d\.csv$/.test(cap[0].name), 'CSV name');
    shared.length = 0; t.click('#ex'); T.ok(shared[0] && shared[0].text.startsWith('PocketKit health log\n2026-01-01  Weight: 70 kg  (=x)\n2026-01-02  Weight: 72.5 kg  (AM)\n2026-01-03  Blood pressure: 120/80 mmHg'), 'text export lists the log oldest first');
    clip.length = 0; t.click('#cp'); await page.wait(10); T.eq(clip.length, 1, 'copy puts the text on the clipboard'); T.eq(clip[0], shared[0].text, 'clipboard text equals the export text');
    t.q('#ls .del').click(); T.eq(page.store('hlog.entries', []).length, 3, 'delete removes an entry');
    t.close();
    const t2 = await page.open('healthlog'); await page.wait(30); T.has(t2.q('#ls').textContent, 'Weight', 'entries come back when reopening'); t2.close();
    set('hlog.entries', []); const t3 = await page.open('healthlog'); cap.length = 0; t3.click('#csv'); T.has(toast(), 'Nothing to export', 'empty CSV export says so'); t3.close();
  }

  /* ---------------------------------------------------------------- Mood log */
  {
    set('mood.days', {});
    const t = await page.open('mood');
    t.click('#sv'); T.has(toast(), 'Pick a face first', 'saving without a face is refused');
    t.clickText('Good'); t.type('#nt', 'ok day'); t.click('#sv'); T.has(toast(), 'Saved', 'mood saved');
    const rec = page.store('mood.days', {})[today()]; T.ok(rec && rec.m === 3 && rec.n === 'ok day', 'mood record {m:3, n} stored (got ' + JSON.stringify(rec) + ')');
    T.has(t.q('#ls').textContent, 'Good', 'log lists the mood'); T.has(t.q('#ls').textContent, 'ok day', 'log lists the note');
    cap.length = 0; t.click('#ex'); await page.wait(20); T.eq(cap[0].text, '﻿Date,Mood,Score (1-5),Note\r\n' + today() + ',Good,4,ok day', 'mood CSV');
    t.close();
    const t2 = await page.open('mood'); T.eq(t2.value('#nt'), 'ok day', "today's note is shown again"); T.eq(t2.q('.fc[data-i="3"]').style.opacity, '1', "today's face is selected"); t2.close();
    set('mood.days', { '2026-01-01': null, '2026-01-02': { m: 99 }, '2026-01-03': 5 });
    const t3 = await page.open('mood'); T.ok(t3.text().length > 0, 'mood log survives damaged stored values'); cap.length = 0; t3.click('#ex'); await page.wait(20);
    T.has(cap[0].text, '2026-01-02,Okay,3,', 'damaged mood exports as Okay'); t3.close();
    set('mood.days', {}); const t4 = await page.open('mood'); cap.length = 0; t4.click('#ex'); T.has(toast(), 'Nothing to export', 'empty mood export says so'); t4.close();
  }

  /* ---------------------------------------------------------------- Habit streaks */
  {
    set('habit.list', [{ id: 1, name: 'Stretch', days: [shiftKey(-1), shiftKey(-2)], best: 0 }]);
    const t = await page.open('habits');
    T.has(t.text(), '🔥 2 days · best 2', 'streak ending yesterday still counts as 2'); T.has(t.q('.tg').textContent, 'Mark done', 'today not done yet');
    t.click('.tg'); T.has(t.text(), '🔥 3 days · best 3', 'ticking today makes 3'); T.has(t.q('.tg').textContent, '✓ Done', 'button shows done');
    t.click('.tg'); T.has(t.text(), '🔥 2 days · best 3', 'untick keeps the best streak');
    t.type('#nm', 'Read'); t.click('#add'); T.eq(t.all('.tg').length, 2, 'new habit added'); T.has(t.text(), '🔥 0 days', 'new habit has 0 days'); T.eq(t.value('#nm'), '', 'name box clears');
    t.type('#nm', '   '); t.click('#add'); T.eq(t.all('.tg').length, 2, 'blank name is ignored');
    t.type('#nm', 'Journal'); const ke = new w.Event('keydown'); ke.key = 'Enter'; t.q('#nm').dispatchEvent(ke); T.eq(t.all('.tg').length, 3, 'Enter adds a habit');
    t.all('.rm')[2].click(); T.eq(t.all('.tg').length, 2, 'delete removes a habit'); T.eq(page.store('habit.list', []).length, 2, 'stored list updated');
    t.close();
    set('habit.list', []); const t2 = await page.open('habits'); T.has(t2.text(), 'No habits yet', 'habits empty state'); t2.close();
  }

  /* ---------------------------------------------------------------- Breathing */
  {
    const t = await page.open('breathe');
    T.eq(t.q('#ph').textContent, 'Ready', 'breathing ready'); T.has(t.q('#tm').textContent, '3:00', 'default session 3:00');
    t.type('#mn', '1'); T.has(t.q('#tm').textContent, '1:00', 'session length follows the field');
    t.click('#go'); T.eq(t.q('#ph').textContent, 'Breathe in', 'box breathing starts with breathe in'); T.eq(t.q('#go').textContent, 'Stop', 'button becomes Stop'); T.eq(t.q('#ct').textContent, '4', 'count 4');
    T.eq(t.q('#ci').style.transform, 'scale(1)', 'circle grows on the inhale');
    for (const [skip, name] of [[4000, 'Hold'], [4000, 'Breathe out'], [4000, 'Hold'], [4000, 'Breathe in']]) { page.skip(skip); await page.wait(160); T.eq(t.q('#ph').textContent, name, 'box breathing phase ' + name + ' at ' + skip); }
    T.eq(t.q('#ci').style.transform, 'scale(1)', 'second cycle inhales again');
    page.skip(4000); await page.wait(160); page.skip(4000); await page.wait(160); T.eq(t.q('#ci').style.transform, 'scale(0.45)', 'circle shrinks on the exhale'); T.has(t.q('#tm').textContent, 'Remaining', 'remaining time shown');
    page.skip(60000); await page.wait(160); T.eq(t.q('#ph').textContent, 'Well done', 'session ends with Well done'); T.eq(t.q('#go').textContent, 'Start', 'button back to Start');
    t.clickText('4-7-8'); t.click('#go'); T.eq(t.q('#ct').textContent, '4', '4-7-8 inhale 4'); page.skip(4000); await page.wait(160); T.eq(t.q('#ph').textContent, 'Hold', '4-7-8 hold'); page.skip(7000); await page.wait(160); T.eq(t.q('#ph').textContent, 'Breathe out', '4-7-8 exhale');
    t.clickText('Custom'); T.eq(t.q('#go').textContent, 'Start', 'changing pattern stops the session');
    t.type('#c0', '0'); t.type('#c1', '0'); t.type('#c2', '0'); t.type('#c3', '0'); t.click('#go'); T.has(toast(), 'Set at least one time above 0', 'all-zero custom pattern is refused');
    t.type('#c0', '3'); t.type('#c2', '3'); t.click('#go'); T.eq(t.q('#ph').textContent, 'Breathe in', 'custom pattern 3-0-3-0 starts'); page.skip(3000); await page.wait(160); T.eq(t.q('#ph').textContent, 'Breathe out', 'custom skips the zero-length hold');
    t.click('#go'); T.eq(t.q('#ph').textContent, 'Ready', 'stopping returns to Ready');
    t.click('#go'); t.close(); await page.wait(300);
  }

  /* ---------------------------------------------------------------- remembered settings */
  {
    const b = await page.open('breathe'); b.clickText('Custom'); b.type('#c0', '3'); b.type('#c1', '0'); b.type('#c2', '3'); b.type('#c3', '0'); b.type('#mn', '7'); b.select('#vb', '0'); b.close();
    const b2 = await page.open('breathe'); T.eq(b2.q('#pr [aria-pressed=true]').dataset.v, 'custom', 'breathing remembers the pattern'); T.eq(b2.q('#cu').style.display, '', 'custom boxes are shown'); T.eq(b2.value('#c0') + b2.value('#c1') + b2.value('#c2'), '303', 'custom times remembered');
    T.eq(b2.value('#mn'), '7', 'session minutes remembered'); T.eq(b2.value('#vb'), '0', 'vibration choice remembered'); T.has(b2.q('#tm').textContent, '7:00', 'session label shows 7:00'); b2.close();
    const s = await page.open('sleepcalc'); s.clickText('I go to bed at'); s.type('#tm', '23:30'); s.close();
    const s2 = await page.open('sleepcalc'); T.eq(s2.q('#md [aria-pressed=true]').dataset.v, 'bed', 'sleep calculator remembers the mode'); T.eq(s2.value('#tm'), '23:30', 'and the time'); T.eq(s2.q('#lb').textContent, 'Bedtime', 'label follows the mode'); T.eq(s2.q('#nw').style.display, '', 'current-time button is shown in bed mode'); s2.close();
    const i = await page.open('idealweight'); i.clickText('Female'); i.clickText('Imperial'); i.type('#ft', '5'); i.type('#inch', '4'); i.close();
    const i2 = await page.open('idealweight'); T.eq(i2.q('#sx [aria-pressed=true]').dataset.v, 'f', 'ideal weight remembers the sex'); T.eq(i2.q('#un [aria-pressed=true]').dataset.v, 'i', 'and the unit'); T.eq(i2.value('#ft') + '/' + i2.value('#inch'), '5/4', 'and the height'); i2.close();
  }

  /* ---------------------------------------------------------------- Workout (HIIT) timer */
  {
    set('hiit.s', { work: 30, rest: 10, rounds: 8, prep: 5 });
    const t = await page.open('hiit');
    t.type('#w', '20'); t.type('#r', '10'); t.type('#n', '2'); T.has(t.q('#rd').textContent, '2 rounds · 0:55 total', 'schedule 5 + 20 + 10 + 20 = 55 s');
    t.click('#go'); T.eq(t.q('#ph').textContent, 'Get ready', 'starts with get ready'); T.eq(t.q('#ct').textContent, '5', 'prep count 5'); T.eq(t.q('#go').textContent, 'Pause', 'Pause button');
    const step = async (ms, name, round, bg) => { page.skip(ms); await page.wait(160); T.eq(t.q('#ph').textContent, name, 'HIIT phase ' + name + ' after +' + ms); if (round) T.has(t.q('#rd').textContent, round, 'round label ' + round); if (bg) T.eq(t.q('#box').style.background, bg, name + ' colour'); };
    await step(5000, 'Work', 'Round 1 of 2', 'var(--ok)'); await step(20000, 'Rest', 'Round 1 of 2', 'var(--danger)'); await step(10000, 'Work', 'Round 2 of 2');
    page.skip(20000); await page.wait(160); T.eq(t.q('#ph').textContent, 'Done', 'workout ends'); T.has(toast(), 'Workout complete', 'completion toast'); T.eq(t.q('#go').textContent, 'Start', 'button back to Start');
    t.click('#go'); page.skip(7000); await page.wait(160); T.eq(t.q('#ph').textContent, 'Work', 'second run reaches Work'); t.click('#go'); T.eq(t.q('#go').textContent, 'Resume', 'pause shows Resume');
    page.skip(100000); await page.wait(160); T.eq(t.q('#ph').textContent, 'Work', 'time does not run while paused');
    t.click('#go'); await page.wait(160); T.eq(t.q('#ph').textContent, 'Work', 'resume continues where it stopped'); T.eq(t.q('#go').textContent, 'Pause', 'Pause again');
    t.click('#rs'); T.eq(t.q('#ph').textContent, 'Ready', 'reset'); T.eq(t.q('#go').textContent, 'Start', 'reset button'); T.eq(page.store('hiit.s', {}).rounds, 2, 'settings are stored');
    t.type('#n', '999'); T.eq(t.value('#n'), '99', 'rounds limited to 99'); t.click('#go'); t.close(); await page.wait(250);
  }

  /* ---------------------------------------------------------------- Meditation */
  {
    set('med.mins', 10);
    const t = await page.open('meditate');
    T.eq(t.q('#t').textContent, '10:00', 'default 10 minutes'); t.clickText('5'); T.eq(t.q('#t').textContent, '5:00', 'preset 5'); T.eq(page.store('med.mins', 0), 5, 'minutes remembered');
    t.type('#mn', '12'); T.eq(t.q('#t').textContent, '12:00', 'custom minutes'); t.clickText('5'); T.eq(t.value('#mn'), '', 'preset clears the custom box');
    t.select('#ib', '1'); vib.length = 0; t.click('#go'); T.eq(t.q('#go').textContent, 'End session', 'running'); T.eq(vib.length, 1, 'start bell vibrates once');
    page.skip(61000); await page.wait(300); T.eq(t.q('#t').textContent, '3:59', 'about 4 minutes left after 61 s'); T.eq(vib.length, 2, 'one interval bell after a minute');
    page.skip(250000); await page.wait(300); T.has(t.q('#sb').textContent, 'Session complete', 'session completes'); T.eq(t.q('#go').textContent, 'Begin', 'back to Begin'); T.eq(t.q('#rg .rv').getAttribute('stroke-dasharray'), '100 100', 'ring full');
    t.click('#go'); t.click('#go'); T.has(t.q('#sb').textContent, 'minutes', 'ending early resets'); T.eq(t.q('#rg .rv').getAttribute('stroke-dasharray'), '0 100', 'ring empty'); t.close();
  }

  /* ---------------------------------------------------------------- Eye rest */
  {
    w.localStorage.setItem('pk.eye.2020-01-01', '3'); w.localStorage.setItem('pk.eye.' + today(), '2');
    const t = await page.open('eyerest');
    T.eq(t.q('#br').textContent, '2', "today's breaks count is shown");
    t.type('#wk', '5'); T.eq(t.q('#t').textContent, '5:00', 'work minutes'); t.type('#wk', '1'); T.eq(t.value('#wk'), '5', 'work minutes limited to at least 5');
    t.click('#go'); T.eq(t.q('#go').textContent, 'Stop', 'eye rest running');
    page.skip(301000); await page.wait(700); T.has(t.q('#ms').textContent, 'Look 20 feet away now', 'break message after 5 minutes'); T.has(t.q('#sb').textContent, 'Look far away', 'break label');
    page.skip(21000); await page.wait(700); T.eq(t.q('#ms').textContent, '', 'message clears after the 20 second break'); T.eq(t.q('#br').textContent, '3', 'break counted');
    T.eq(page.store(('eye.' + today()), 0), 3, 'break count stored for today');
    t.click('#go'); T.eq(t.q('#go').textContent, 'Start', 'stopped'); t.close();
  }

  /* ---------------------------------------------------------------- Fasting timer */
  {
    set('fast.state', null); set('fast.hist', []); set('fast.goal', 16);
    const t = await page.open('fasting');
    T.eq(t.q('#sb').textContent, 'Not fasting', 'not fasting'); T.has(t.text(), 'No fasts yet', 'fasting history empty');
    t.click('#go'); t.click('#go'); T.has(t.text(), 'No fasts yet', 'a fast shorter than a minute is not recorded'); T.eq(page.store('fast.state', 1), null, 'state cleared');
    t.click('#go'); T.eq(t.q('#go').textContent, 'End fast', 'End fast button'); T.has(t.q('#sb').textContent, 'of 16 hours', 'goal 16 hours'); T.ok(page.store('fast.state', null).start > 0, 'running fast is stored');
    const at = async (ms, text, phase) => { page.skip(ms); t.clickText('16:8'); T.eq(t.q('#t').textContent, text, 'fast clock ' + text); if (phase) T.has(t.q('#ph').textContent, phase, 'phase text at ' + text); };
    await at(3 * 3600e3, '3h 00m', 'Hours 0-4'); await at(5 * 3600e3, '8h 00m', 'Hours 4-12'); await at(5 * 3600e3, '13h 00m', 'Hours 12-16');
    T.near(parseFloat(t.q('#rg .rv').getAttribute('stroke-dasharray')), 81.25, 0.01, 'ring at 13 of 16 hours'); await at(4 * 3600e3, '17h 00m', 'Goal reached'); T.eq(t.q('#rg .rv').getAttribute('stroke-dasharray'), '100 100', 'ring full at goal');
    t.close(); const r = await page.open('fasting'); T.eq(r.q('#t').textContent, '17h 00m', 'a running fast survives leaving the tool'); r.click('#go');
    T.has(r.q('#hs').textContent, '17h 00m', 'finished fast is in the history'); T.has(r.q('#hs').textContent, '✅', 'goal reached tick'); T.eq(r.q('#sb').textContent, 'Not fasting', 'fast ended');
    r.clickText('20:4'); T.eq(page.store('fast.goal', 0), 20, 'goal choice remembered'); r.close();
  }

  /* ---------------------------------------------------------------- Heart rate (camera) */
  {
    const mkStream = (log) => ({ getTracks() { return [track]; }, getVideoTracks() { return [track]; } });
    const log = { stopped: 0, constraints: [] };
    const track = { stop() { log.stopped++; }, getCapabilities() { return { torch: true }; }, applyConstraints(c) { log.constraints.push(JSON.stringify(c)); return Promise.resolve(); } };
    const media = (fn) => Object.defineProperty(w.navigator, 'mediaDevices', { configurable: true, value: fn ? { getUserMedia: fn } : undefined });
    media(null);
    let t = await page.open('heartrate'); t.click('#go'); await page.wait(20); T.has(t.q('#msg').textContent, 'Camera not available', 'heart rate: no camera API'); t.close();
    media(() => Promise.reject(Object.assign(new Error('x'), { name: 'NotAllowedError' }))); t = await page.open('heartrate'); t.click('#go'); await page.wait(20); T.has(t.q('#msg').textContent, 'Camera permission denied', 'heart rate: permission denied'); T.eq(t.q('#go').textContent, 'Start measuring', 'button resets'); t.close();
    media(() => Promise.resolve(mkStream())); t = await page.open('heartrate'); t.click('#go'); await page.wait(30);
    T.eq(t.q('#go').textContent, 'Stop', 'measuring'); T.ok(log.constraints.some(c => c.includes('"torch":true')), 'torch switched on'); t.click('#go'); T.has(t.q('#msg').textContent, 'Stopped', 'stop message');
    T.eq(log.stopped, 1, 'stopping releases the camera'); T.ok(log.constraints.some(c => c.includes('"torch":false')), 'torch switched off');
    t.click('#go'); await page.wait(30); t.close(); T.eq(log.stopped, 2, 'leaving the tool releases the camera');
    // a full run on a synthetic fingertip signal (72 bpm), the clock moves 100 ms per frame
    const proto = w.HTMLCanvasElement.prototype, orig = proto.getContext;
    proto.getContext = function (type, o) {
      if (this.width === 16 && this.height === 16) return { drawImage() {}, getImageData() { const r = 180 + 12 * Math.sin(2 * Math.PI * 1.2 * page.clock.t / 1000); const d = new Uint8ClampedArray(16 * 16 * 4); for (let i = 0; i < d.length; i += 4) { d[i] = r; d[i + 1] = 30; d[i + 2] = 30; d[i + 3] = 255; } return { data: d }; } };
      return orig.call(this, type, o);
    };
    t = await page.open('heartrate'); Object.defineProperty(t.q('#v'), 'videoWidth', { value: 16 });
    w.performance.now = () => (page.clock.t += 100);
    log.stopped = 0; t.click('#go');
    for (let i = 0; i < 60 && !/Estimate:|Could not/.test(t.q('#msg').textContent); i++) await page.wait(100);
    const m = /Estimate: (\d+) BPM/.exec(t.q('#msg').textContent);
    T.ok(m && Math.abs(+m[1] - 72) <= 3, 'a 72 bpm fingertip signal reads about 72 (message: ' + t.q('#msg').textContent + ')'); T.has(t.q('#msg').textContent, 'Approximate only', 'result is labelled approximate');
    T.eq(t.q('#go').textContent, 'Start measuring', 'measurement ends by itself'); T.eq(log.stopped, 1, 'camera released after the run'); t.close();
    w.performance.now = () => page.clock.t; proto.getContext = orig;
    t = await page.open('heartrate'); Object.defineProperty(t.q('#v'), 'videoWidth', { value: 16 }); t.click('#go'); await page.wait(200); T.has(t.q('#msg').textContent, 'Cover the camera', 'uncovered lens asks for a fingertip'); t.close();
    T.ok(/Not medical|not medical/.test((await page.open('heartrate')).text()), 'heart rate shows the not-medical warning');
  }

  await T.done(page);
})().catch(e => { console.log('FAIL: test crashed: ' + (e && e.stack || e)); process.exit(1); });
