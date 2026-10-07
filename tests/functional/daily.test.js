'use strict';
/* Functional tests, daily.js part 1: Screen Light, Route Recorder, My PIN Code, Parking, World Clock, Pomodoro, Alarm Clock, Signal Light.
   Uses a fake clock, a fake LocalNotifications plugin and a scripted GPS (tests/functional/fx.js). */
const { suite } = require('../helpers/page');
const { bootFx, clock, fakeNotifications, fakeShare } = require('./fx');
(async () => {
  const T = suite('daily-1'), page = await bootFx(), w = page.w;
  const toastText = () => w.document.querySelector('#toast').textContent;
  const defNav = (name, value) => Object.defineProperty(w.navigator, name, { value, configurable: true });
  const copied = []; defNav('clipboard', { writeText: async (t) => { copied.push(t); }, readText: async () => 'pasted text' });
  const store = (k) => JSON.parse(w.localStorage.getItem('pk.' + k) || 'null');
  w.Element.prototype.scrollIntoView = function () {};
  const clk = clock(page, '2026-03-10T10:00:00Z');
  const note = fakeNotifications(page, 'granted');
  const emit = (lat, lon, o) => page.geo.emit(lat, lon, Object.assign({ t: clk.now() }, o));

  if (process.env.V) console.log('>> Screen Light ' + Math.round(process.uptime()) + 's');
  /* ---------- Screen Light ---------- */
  {
    let locks = 0, released = 0;
    defNav('wakeLock', { request: async () => { locks++; return { release: async () => { released++; } }; } });
    const t = await page.open('screenlight');
    T.has(t.text(), 'Warm lamp', 'screenlight: default colour name is Warm lamp');
    t.all('.sw')[2].click();
    T.eq(store('daily.light').color, '#ffffff', 'screenlight: White preset is saved');
    T.has(t.text(), 'White', 'screenlight: colour name shows White');
    t.type('#br', '40');
    T.eq(store('daily.light').bright, 40, 'screenlight: brightness saved as 40');
    T.has(t.text(), '40%', 'screenlight: brightness label 40%');
    t.type('#pick', '#123456');
    T.has(t.text(), 'Custom colour', 'screenlight: custom colour is named Custom colour');
    t.click('#go'); await page.wait(10);
    const lay = w.document.querySelector('.lay');
    T.ok(!!lay, 'screenlight: full screen overlay opens');
    T.eq(locks, 1, 'screenlight: screen wake lock requested once');
    const ov = lay.parentElement;
    ov.querySelector('.obr').value = '70'; ov.querySelector('.obr').dispatchEvent(new w.Event('input', { bubbles: true }));
    T.eq(store('daily.light').bright, 70, 'screenlight: overlay slider updates brightness');
    T.eq(t.value('#br'), '70', 'screenlight: main slider follows the overlay slider');
    ov.querySelector('.cls').click();
    T.ok(!w.document.querySelector('.lay'), 'screenlight: Close light removes the overlay');
    T.eq(released, 1, 'screenlight: wake lock released on close');
    t.click('#go'); await page.wait(10); T.ok(!!w.document.querySelector('.lay'), 'screenlight: overlay reopens');
    t.close();
    T.ok(!w.document.querySelector('.lay'), 'screenlight: leaving the tool removes the overlay');
    T.eq(released, 2, 'screenlight: wake lock released on leaving');
    const t2 = await page.open('screenlight');
    T.eq(t2.value('#br'), '70', 'screenlight: brightness remembered');
    T.eq(t2.value('#pick'), '#123456', 'screenlight: colour remembered');
    t2.close();
  }

  if (process.env.V) console.log('>> Route Recorder ' + Math.round(process.uptime()) + 's');
  /* ---------- Route Recorder ---------- */
  {
    const share = fakeShare(page);
    let t = await page.open('routerec');
    T.has(t.text(), 'Start recording', 'routerec: start button');
    T.has(t.text(), 'Press Start to begin', 'routerec: empty hint');
    t.click('#stt'); await page.wait(5);
    emit(51.5, -0.1);
    for (let i = 1; i <= 5; i++) { await clk.advance(10000); emit(51.5 + 0.001 * i, -0.1); }
    const s1 = t.text();
    T.has(s1, '556 m', 'routerec: 5 x 0.001 deg of latitude is 556 m');
    T.has(s1, '0:50', 'routerec: duration 50 s');
    T.has(s1, '40.0 km/h', 'routerec: 556 m in 50 s is 40.0 km/h');
    emit(51.5 + 0.005 + 0.00001, -0.1);
    T.has(t.text(), '556 m', 'routerec: a 1 m wobble is ignored');
    emit(51.52, -0.1, { acc: 100 });
    T.has(t.text(), 'Weak GPS signal', 'routerec: weak fix message');
    T.has(t.text(), '556 m', 'routerec: weak fix point is skipped');
    t.click('#stp');
    T.has(t.text(), 'Save route', 'routerec: after Stop the Save button shows');
    T.has(t.text(), '556 m', 'routerec: distance kept after stop');
    T.eq(page.geo.watchers.size, 0, 'routerec: GPS watcher stopped');
    t.close();
    t = await page.open('routerec');
    T.has(t.text(), 'unsaved recording was recovered', 'routerec: unsaved draft is recovered');
    T.has(t.text(), '556 m', 'routerec: recovered distance');
    t.type('#rn', 'Morning loop');
    t.click('#sv'); await page.wait(60);
    T.eq(toastText(), 'Route saved', 'routerec: route saved');
    T.eq(store('daily.routedraft'), null, 'routerec: draft cleared after save');
    t.clickText('Saved routes'); await page.wait(60);
    T.has(t.text(), 'Morning loop', 'routerec: saved route is listed');
    T.has(t.text(), '556 m', 'routerec: saved route distance');
    t.click('[data-open]'); await page.wait(60);
    T.ok(t.has('#gx'), 'routerec: route detail shows Export GPX');
    t.click('#gx'); await page.wait(30);
    T.eq(share.files.length, 0, 'routerec: free plan cannot export GPX');
    w.eval('pro = true');
    t.click('#gx'); await page.wait(30);
    const gpx = (share.last() || {}).data || '';
    T.has(gpx, '<name>Morning loop</name>', 'routerec: GPX has the route name');
    T.eq((gpx.match(/<trkpt /g) || []).length, 6, 'routerec: GPX has 6 track points');
    T.has(gpx, '<trkpt lat="51.500000" lon="-0.100000"><time>2026-03-10T10:00:00.000Z</time></trkpt>', 'routerec: GPX first point and time');
    T.has(gpx, 'lat="51.505000"', 'routerec: GPX last point');
    T.has((share.last() || {}).path || '', 'Morning loop.gpx', 'routerec: GPX file name');
    t.click('#dl'); await page.wait(60);
    T.has(t.text(), 'No saved routes yet', 'routerec: delete removes the route');
    t.clickText('Record');
    /* permission denied */
    page.geo.deny = 1;
    t.click('#stt'); await page.wait(30);
    T.has(t.text(), 'Location permission was denied', 'routerec: permission denied message');
    t.click('#stp');
    page.geo.deny = null;
    /* free plan keeps one route */
    w.eval('pro = false');
    for (let r = 0; r < 2; r++) {
      const c0 = t.has('#nw') ? '#nw' : '#stt';
      if (t.has('#ds')) { t.click('#ds'); }
      t.click('#stt'); await page.wait(5);
      emit(10, 10); await clk.advance(5000); emit(10.001, 10); await clk.advance(5000); emit(10.002, 10);
      t.click('#stp'); t.click('#sv'); await page.wait(60);
    }
    t.clickText('Saved routes'); await page.wait(60);
    T.eq(t.all('[data-open]').length, 1, 'routerec: free plan keeps only 1 saved route');
    t.close();
    /* leaving while recording keeps the track as a draft, even a long one */
    w.localStorage.removeItem('pk.daily.routedraft'); w.eval('pro = true');
    t = await page.open('routerec'); t.click('#stt'); await page.wait(5); t.clickText('Saved routes'); await page.wait(30);
    for (let i = 0; i < 9001; i++) { emit(20 + i * 0.00005, 30); w.__advance(1000); }
    t.clickText('Record'); T.has(t.text(), '50.0 km', 'routerec: long recording keeps counting while another tab is shown (9001 points x 5.56 m = 50.0 km)');
    t.close();
    T.eq(page.geo.watchers.size, 0, 'routerec: GPS watcher stopped when leaving mid-recording');
    T.eq((store('daily.routedraft') || { pts: [] }).pts.length, 9001, 'routerec: a 9001 point recording is kept as a draft when leaving');
    t = await page.open('routerec'); T.has(t.text(), 'unsaved recording was recovered', 'routerec: long draft is recovered'); T.has(t.text(), 'Save route', 'routerec: recovered draft can be saved'); t.close();
    w.localStorage.removeItem('pk.daily.routedraft'); w.eval('pro = false');
    T.eq(page.geo.watchers.size, 0, 'routerec: no GPS watcher left');
  }

  if (process.env.V) console.log('>> My PIN Code ' + Math.round(process.uptime()) + 's');
  /* ---------- My PIN Code ---------- */
  {
    /* Independent Open Location Code encoder (reference algorithm with integer arithmetic) */
    const D = '23456789CFGHJMPQRVWX';
    const olc = (lat, lon) => {
      let la = Math.floor(Math.round((Math.min(90, Math.max(-90, lat)) + 90) * 2.5e7) / 3125), lo = Math.floor(Math.round((lon + 180) * 8.192e6) / 1024), s = '';
      for (let i = 0; i < 5; i++) { s = D[lo % 20] + s; s = D[la % 20] + s; la = Math.floor(la / 20); lo = Math.floor(lo / 20); }
      return s.slice(0, 8) + '+' + s.slice(8);
    };
    const t = await page.open('pincode');
    t.click('#c1'); T.eq(toastText(), 'Still waiting for GPS', 'pincode: copy before a fix says waiting');
    t.type('#pn', 'Home'); t.click('#ps'); T.eq(toastText(), 'Still waiting for GPS', 'pincode: saving before a fix says waiting');
    emit(47.36559, 8.524997, { acc: 5, alt: 408 });
    T.eq(t.q('#pc').textContent, olc(47.36559, 8.524997), 'pincode: Zurich matches the reference encoder');
    emit(47.0000625, 8.0000625); T.eq(t.q('#pc').textContent, '8FVC2222+22', 'pincode: 47.0000625, 8.0000625 is 8FVC2222+22 (OLC test vector)');
    emit(20.3700625, 2.7821875); T.eq(t.q('#pc').textContent, '7FG49QCJ+2V', 'pincode: 20.3700625, 2.7821875 is 7FG49QCJ+2V (OLC test vector)');
    emit(-41.2730625, 174.7859375); T.eq(t.q('#pc').textContent, '4VCPPQGP+Q9', 'pincode: Wellington vector 4VCPPQGP+Q9');
    emit(47.36559, 8.524997, { acc: 5, alt: 408 });
    T.eq(t.q('#la').textContent, '47.365590', 'pincode: latitude shown');
    T.eq(t.q('#lo').textContent, '8.524997', 'pincode: longitude shown');
    T.eq(t.q('#ac').textContent, '±5 m', 'pincode: accuracy');
    T.eq(t.q('#al').textContent, '408 m', 'pincode: altitude');
    T.has(t.q('#st').textContent, 'Good GPS fix', 'pincode: good fix message');
    emit(0, 0); T.eq(t.q('#pc').textContent, '6FG22222+22', 'pincode: 0,0 is 6FG22222+22');
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    let bad = 0; for (let i = 0; i < 40; i++) { const la = rnd() * 178 - 89, lo = rnd() * 358 - 179; emit(la, lo); if (t.q('#pc').textContent !== olc(la, lo)) bad++; }
    T.eq(bad, 0, 'pincode: 40 random points match the reference encoder');
    emit(47.36559, 8.524997, { acc: 5, alt: 408 });
    t.click('#c1'); await page.wait(5); T.eq(copied[copied.length - 1], '47.365590, 8.524997', 'pincode: copy coordinates');
    t.click('#c2'); await page.wait(5); T.eq(copied[copied.length - 1], olc(47.36559, 8.524997), 'pincode: copy plus code');
    t.click('#c3'); await page.wait(5); T.eq(copied[copied.length - 1], 'geo:47.365590,8.524997?q=47.365590,8.524997', 'pincode: copy geo link');
    t.click('#ps'); T.eq(toastText(), 'Saved Home', 'pincode: save here with a name');
    T.eq(store('daily.places').length, 1, 'pincode: one place stored');
    emit(47.36559 + 0.001, 8.524997, { acc: 5 });
    T.has(t.q('#pl').textContent, '111 m S', 'pincode: 0.001 deg north is 111 m, place is south');
    t.q('#pn').value = ''; t.click('#ps'); T.eq(toastText(), 'Give the place a name', 'pincode: name required');
    t.click('[data-n="Work"]'); T.eq(t.value('#pn'), 'Work', 'pincode: chip fills the name');
    t.click('#ps');
    T.eq(store('daily.places').length, 2, 'pincode: second place stored');
    t.click('[data-rm]'); T.eq(store('daily.places').length, 1, 'pincode: delete a place');
    t.close();
    T.eq(page.geo.watchers.size, 0, 'pincode: GPS watcher stopped when leaving');
    page.geo.deny = 1;
    const t2 = await page.open('pincode'); await page.wait(20);
    T.has(t2.q('#st').textContent, 'Location permission was denied', 'pincode: permission denied message');
    t2.close(); page.geo.deny = null;
  }

  if (process.env.V) console.log('>> Parking Saver ' + Math.round(process.uptime()) + 's');
  /* ---------- Parking Saver ---------- */
  {
    note.reset(); clk.set('2026-03-10T10:00:00Z');
    let t = await page.open('parking');
    emit(12.97, 77.59, { acc: 8 });
    t.type('#nt', 'Level 2');
    t.clickText('15m'); t.click('#sv'); await page.wait(30);
    T.eq(toastText(), 'Parking spot saved', 'parking: saved with a meter');
    T.eq(note.ids().join(), '730002,730001', 'parking: warning id 730002 and expiry id 730001 scheduled');
    T.eq(note.scheduled[0].schedule.at.toISOString(), '2026-03-10T10:10:00.000Z', 'parking: 5 minute warning at 10:10');
    T.eq(note.scheduled[1].schedule.at.toISOString(), '2026-03-10T10:15:00.000Z', 'parking: expiry at 10:15');
    T.has(t.text(), 'Level 2', 'parking: note shown');
    await clk.advance(11 * 60000 + 1000);
    T.has(t.text(), '3:59 left', 'parking: meter counts down (3:59 left after 11 min 1 s)');
    await clk.advance(5 * 60000);
    T.has(t.text(), 'Meter expired', 'parking: meter expired text');
    T.eq(store('daily.parking').warned, true, 'parking: expiry marked as warned');
    t.click('#clr'); await page.wait(20);
    T.ok(note.cancelled.includes(730001) && note.cancelled.includes(730002), 'parking: clearing cancels both notifications');
    T.eq(store('daily.parking'), null, 'parking: spot cleared');
    T.has(t.text(), 'Save my parking spot', 'parking: back to the save screen');
    note.reset();
    t.type('#cm', '1'); t.click('#sv'); await page.wait(30);
    T.eq(note.scheduled[0].schedule.at.getTime(), clk.now() + 60000 - 1000, 'parking: a 1 minute meter warns 1 s before expiry');
    t.click('#clr'); await page.wait(20);
    note.perm = 'denied'; note.reset();
    t.clickText('30m'); t.click('#sv'); await page.wait(30);
    T.eq(toastText(), 'Spot saved, but the meter alert is blocked', 'parking: denied notifications message');
    T.ok(!t.q('.nblocked').hidden, 'parking: blocked card is visible');
    t.close();
    t = await page.open('parking');
    T.has(t.text(), 'Open in map app', 'parking: saved spot survives reopening');
    T.ok(t.q('.linkbtn').getAttribute('href').startsWith('geo:12.970000,77.590000'), 'parking: map link uses the saved coordinates');
    t.close(); note.perm = 'granted';
    w.localStorage.removeItem('pk.daily.parking');
  }

  if (process.env.V) console.log('>> World Clock ' + Math.round(process.uptime()) + 's');
  /* ---------- World Clock ---------- */
  {
    clk.set('2026-03-10T12:00:00Z');
    const t = await page.open('worldclock');
    await clk.advance(1000);
    const row = (name) => t.all('[data-row]').find(r => r.textContent.includes(name));
    T.has(row('London').textContent, 'UTC+0', 'worldclock: London is UTC+0 in early March');
    T.has(row('London').textContent, 'Same time as you', 'worldclock: London equals local (UTC)');
    T.has(row('New York').textContent, 'UTC-4', 'worldclock: New York is UTC-4 (US summer time started 8 March 2026)');
    T.has(row('New York').textContent, '4h behind', 'worldclock: New York is 4h behind');
    T.has(row('Tokyo').textContent, 'UTC+9', 'worldclock: Tokyo UTC+9');
    T.has(row('Tokyo').textContent, '9h ahead', 'worldclock: Tokyo 9h ahead');
    T.ok(/09:00\s*PM/i.test(row('Tokyo').textContent), 'worldclock: Tokyo shows 09:00 PM at 12:00 UTC');
    T.ok(/08:00\s*AM/i.test(row('New York').textContent), 'worldclock: New York shows 08:00 AM');
    T.has(row('Tokyo').textContent, '🌙', 'worldclock: Tokyo is night');
    T.has(row('New York').textContent, '☀️', 'worldclock: New York is day');
    t.check('#f24', true); await clk.advance(1000);
    T.has(row('Tokyo').textContent, '21:00', 'worldclock: 24 hour clock shows 21:00');
    T.eq(store('daily.clock24'), true, 'worldclock: 24 hour setting remembered');
    t.type('#cs', 'Mumbai'); t.click('#add');
    T.has(row('Mumbai').textContent, 'UTC+5:30', 'worldclock: Mumbai is UTC+5:30');
    T.has(row('Mumbai').textContent, '5h 30m ahead', 'worldclock: Mumbai 5h 30m ahead');
    T.has(row('Mumbai').textContent, '17:30', 'worldclock: Mumbai 17:30');
    t.type('#cs', 'Kathmandu'); t.click('#add');
    T.has(row('Kathmandu').textContent, 'UTC+5:45', 'worldclock: Kathmandu UTC+5:45');
    t.type('#cs', 'Mumbai'); t.click('#add'); T.eq(toastText(), 'Already added', 'worldclock: duplicate refused');
    t.type('#cs', 'Atlantis'); t.click('#add'); T.eq(toastText(), 'Pick a city from the list', 'worldclock: unknown city refused');
    /* DST changes */
    clk.set('2026-03-29T12:00:00Z'); await clk.advance(1000);
    T.has(row('London').textContent, 'UTC+1', 'worldclock: London on British Summer Time 29 March');
    T.has(row('London').textContent, '1h ahead', 'worldclock: London 1h ahead during BST');
    clk.set('2026-11-01T12:00:00Z'); await clk.advance(1000);
    T.has(row('New York').textContent, 'UTC-5', 'worldclock: New York back to UTC-5 on 1 November');
    T.has(row('London').textContent, 'UTC+0', 'worldclock: London back to UTC+0');
    /* order and removal */
    const names = () => t.all('[data-row] b').map(b => b.textContent);
    T.eq(names()[0], 'London', 'worldclock: London first');
    t.click('[data-dn="0"]'); T.eq(names()[0], 'New York', 'worldclock: move down');
    t.click('[data-up="1"]'); T.eq(names()[0], 'London', 'worldclock: move up');
    t.click('[data-rm="0"]'); T.ok(!names().includes('London'), 'worldclock: remove a city');
    T.eq(store('daily.clocks').length, 4, 'worldclock: list saved');
    const n0 = clk.timers(); t.close(); T.ok(clk.timers() < n0, 'worldclock: interval cleared on leaving');
    w.localStorage.removeItem('pk.daily.clocks'); w.localStorage.removeItem('pk.daily.clock24');
  }

  if (process.env.V) console.log('>> Pomodoro ' + Math.round(process.uptime()) + 's');
  /* ---------- Pomodoro ---------- */
  {
    clk.set('2026-03-10T09:00:00Z'); note.reset();
    let t = await page.open('pomodoro');
    T.eq(t.q('#tm').textContent, '25:00', 'pomodoro: focus is 25:00');
    T.has(t.q('#cyn').textContent, 'Session 1 of 4', 'pomodoro: session counter');
    t.click('#go'); await page.wait(10);
    T.eq(note.last().id, 740001, 'pomodoro: notification id 740001');
    T.eq(note.last().schedule.at.toISOString(), '2026-03-10T09:25:00.000Z', 'pomodoro: notification at +25 min');
    T.eq(note.last().title, 'Focus finished', 'pomodoro: notification title');
    await clk.advance(10 * 60000);
    T.eq(t.q('#tm').textContent, '15:00', 'pomodoro: 15:00 left after 10 min');
    t.click('#go'); await page.wait(10);
    T.ok(note.cancelled.includes(740001), 'pomodoro: pause cancels the notification');
    T.eq(t.q('#go').textContent, 'Resume', 'pomodoro: Resume shown while paused');
    await clk.advance(5 * 60000);
    T.eq(t.q('#tm').textContent, '15:00', 'pomodoro: paused clock does not run');
    note.reset(); t.click('#go'); await page.wait(10);
    T.eq(note.last().schedule.at.getTime(), clk.now() + 15 * 60000, 'pomodoro: resume reschedules the remaining 15 min');
    await clk.advance(15 * 60000 + 300);
    T.has(t.q('#ml').textContent, 'Short break', 'pomodoro: short break follows focus');
    T.eq(t.q('#tm').textContent, '5:00', 'pomodoro: short break 5:00');
    T.eq(t.q('#td').textContent, '1', 'pomodoro: 1 session today');
    T.eq(t.q('#to').textContent, '1', 'pomodoro: 1 session all time');
    T.has(t.q('#cy').textContent, '🍅 ⚪ ⚪ ⚪', 'pomodoro: one tomato');
    for (let i = 2; i <= 4; i++) {
      t.click('#sk'); t.click('#go'); await page.wait(5);
      await clk.advance(25 * 60000 + 300);
    }
    T.has(t.q('#ml').textContent, 'Long break', 'pomodoro: 4th focus session earns a long break');
    T.eq(t.q('#tm').textContent, '15:00', 'pomodoro: long break 15:00');
    T.eq(t.q('#td').textContent, '4', 'pomodoro: 4 sessions today');
    t.click('#rs'); T.has(t.q('#cyn').textContent, 'Session 1 of 4', 'pomodoro: reset clears the cycle');
    /* lengths */
    t.clickText('Focus'); t.click('#cf');
    t.type('[data-m="focus"]', '50'); T.eq(t.q('#tm').textContent, '50:00', 'pomodoro: custom focus length 50');
    t.type('[data-m="focus"]', '0'); T.eq(t.q('#tm').textContent, '1:00', 'pomodoro: 0 minutes is raised to the 1 minute minimum');
    t.type('[data-m="focus"]', '999'); T.eq(t.q('#tm').textContent, '3:00:00', 'pomodoro: lengths are capped at 180 minutes (3:00:00)');
    t.type('[data-m="focus"]', '1');
    t.check('#au', true);
    t.click('#go'); await page.wait(5); await clk.advance(60000 + 300);
    T.eq(t.q('#go').textContent, 'Pause', 'pomodoro: next period starts automatically');
    T.has(t.q('#ml').textContent, 'Short break', 'pomodoro: auto-start went to the break');
    /* survives leaving the tool and finishing while away */
    t.close();
    await clk.advance(10 * 60000);
    t = await page.open('pomodoro'); await clk.advance(300);
    T.has(t.q('#ml').textContent, 'Focus', 'pomodoro: a period that ended while away is finished on return');
    t.close();
    /* denied permission */
    note.perm = 'denied'; w.localStorage.removeItem('pk.daily.pomo');
    t = await page.open('pomodoro'); t.click('#go'); await page.wait(20);
    T.ok(!t.q('.nblocked').hidden, 'pomodoro: blocked message when notifications are denied');
    t.close(); note.perm = 'granted';
  }

  if (process.env.V) console.log('>> Alarm Clock ' + Math.round(process.uptime()) + 's');
  /* ---------- Alarm Clock ---------- */
  {
    clk.set('2026-03-10T06:00:00Z'); note.reset();
    let t = await page.open('alarmclock');
    T.has(t.text(), 'No alarms yet', 'alarmclock: empty state');
    t.type('#tm', '07:00'); t.type('#lb', 'Wake'); t.click('#add'); await page.wait(30);
    const a = store('daily.alarms')[0];
    T.eq(a.h * 60 + a.m, 420, 'alarmclock: 07:00 stored');
    T.eq(a.days.join(), '1,2,3,4,5', 'alarmclock: default repeat Monday to Friday');
    const idsA = note.scheduled.map(n => n.id);
    T.eq(idsA.join(), [11, 12, 13, 14, 15].map(d => 10000010 + d - 10).join(), 'alarmclock: weekday ids are block base + weekday');
    T.eq(note.scheduled[0].schedule.on.weekday, 2, 'alarmclock: Monday is weekday 2 for Android');
    T.eq(note.scheduled[0].schedule.on.hour, 7, 'alarmclock: hour 7');
    T.eq(note.scheduled[0].title, 'Wake', 'alarmclock: label is the title');
    T.eq(note.cancelled.length, 8, 'alarmclock: 8 old ids cleared before scheduling');
    T.ok(note.cancelled.includes(10000010) && note.cancelled.includes(10000017), 'alarmclock: ids cleared cover base+0..7');
    T.has(t.text(), 'Mon Tue Wed Thu Fri', 'alarmclock: repeat text');
    /* a one-time alarm: deselect all days */
    ['1', '2', '3', '4', '5'].forEach(d => t.click('[data-d="' + d + '"]'));
    note.reset(); t.type('#tm', '05:30'); t.click('#add'); await page.wait(30);
    const b = store('daily.alarms')[1];
    T.eq(b.days.length, 0, 'alarmclock: no days means once');
    T.eq(note.last().id, 10000020 + 7, 'alarmclock: one-time alarm uses base+7');
    T.eq(note.last().schedule.at.toISOString(), '2026-03-11T05:30:00.000Z', 'alarmclock: 05:30 already passed today so it is tomorrow');
    T.has(t.text(), 'Once', 'alarmclock: Once label');
    /* an alarm in the next hour rings in the page */
    note.reset(); t.type('#tm', '06:30'); t.type('#lb', 'Soon'); t.click('#add'); await page.wait(30);
    T.eq(note.last().schedule.at.toISOString(), '2026-03-10T06:30:00.000Z', 'alarmclock: one-time 06:30 is today');
    await clk.advance(31 * 60000);
    T.has(toastText(), 'Soon', 'alarmclock: in-app alarm rings');
    T.eq(store('daily.alarms').find(x => x.label === 'Soon').on, false, 'alarmclock: a one-time alarm switches itself off after ringing');
    /* toggle and delete */
    note.reset();
    const cb = t.all('[data-t]')[0]; cb.click(); await page.wait(20);
    T.ok(note.cancelled.length >= 8, 'alarmclock: switching off cancels the notifications');
    T.eq(store('daily.alarms').filter(x => x.on).length, 1, 'alarmclock: toggled alarm is off');
    note.reset(); t.all('[data-x]').forEach(x => x.click()); await page.wait(20);
    T.eq(store('daily.alarms').length, 0, 'alarmclock: delete removes alarms');
    T.ok(note.cancelled.includes(10000010) && note.cancelled.includes(10000020), 'alarmclock: delete cancels each alarm\'s ids');
    /* denied */
    note.perm = 'denied'; t.type('#tm', '08:00'); t.click('#add'); await page.wait(30);
    T.ok(!t.q('.nblocked').hidden, 'alarmclock: blocked message');
    T.has(toastText(), 'notifications are blocked', 'alarmclock: toast says blocked');
    t.close(); note.perm = 'granted';
    /* old alarms switch off when their time has passed while away */
    w.localStorage.setItem('pk.daily.alarms', JSON.stringify([{ n: 9, nb: 10000090, set: clk.now() - 1000, h: 1, m: 0, label: '', days: [], on: true }]));
    t = await page.open('alarmclock');
    T.eq(t.all('[data-t]')[0].checked, false, 'alarmclock: expired one-time alarm shown as off');
    t.close();
  }

  if (process.env.V) console.log('>> Signal Light ' + Math.round(process.uptime()) + 's');
  /* ---------- Signal Light ---------- */
  {
    clk.set('2026-03-10T10:00:00Z');
    const t = await page.open('signallight');
    const ovEl = () => w.document.querySelector('[aria-label="Tap to stop"]');
    const white = () => /255, 255, 255|#fff/.test(ovEl().style.background);
    t.click('#go'); await page.wait(10);
    T.ok(!!ovEl(), 'signallight: SOS overlay opens');
    const u = 60 + 5 * 55;
    const pat = '1010100000' + '1110111011100000'.replace(/^/, '') ; // S: 1 0 1 0 1, gap 000, O: 111 0 111 0 111
    /* expected units: S = 10101, gap 000, O = 1110111011 1, gap 000, S = 10101, then the 7 unit pause before repeating */
    const units = '10101' + '000' + '111' + '0' + '111' + '0' + '111' + '000' + '10101' + '0000000';
    let wrong = 0; await clk.advance(u / 2);
    for (let i = 0; i < units.length; i++) { if (white() !== (units[i] === '1')) wrong++; await clk.advance(u); }
    T.eq(wrong, 0, 'signallight: SOS timing follows dot 1, dash 3, gaps 1/3/7 units (' + u + ' ms unit)');
    ovEl().click(); T.ok(!ovEl(), 'signallight: tap stops the light');
    await clk.advance(5000);
    t.clickText('Morse'); t.type('#tx', '###'); t.click('#go'); await page.wait(10);
    T.eq(toastText(), 'Type a message with letters or numbers', 'signallight: empty Morse message is refused');
    T.ok(!ovEl(), 'signallight: no overlay for an empty message');
    t.clickText('Strobe'); t.click('#go');
    T.ok(!t.q('#wn').hidden, 'signallight: strobe shows the photosensitivity warning first');
    T.ok(!ovEl(), 'signallight: no strobe before the warning is accepted');
    t.click('#wok'); await page.wait(10);
    T.ok(!!ovEl(), 'signallight: strobe starts after accepting the warning');
    t.close();
    T.ok(!ovEl(), 'signallight: leaving the tool removes the overlay');
  }

  await T.done(page);
})().catch((e) => { console.log("CRASH: " + (e && e.stack || e)); process.exit(1); });
