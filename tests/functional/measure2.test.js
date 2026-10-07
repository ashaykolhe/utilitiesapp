'use strict';
/* Functional tests for the Measure group, part 2: dials, sensors, RPM, reaction, screen info; plus the pure maths of measure.js. */
const { boot } = require('./mh-fakes');
const { suite } = require('../helpers/page');
const D = Math.PI / 180;
global.Tools = { register() {} };
const M = require('../../www/js/tools/measure.js');

(async () => {
  const T = suite('measure2'), page = await boot(), G = page.G, w = page.w;
  const elev = (deg) => ({ x: 0, y: G * Math.sin(deg * D), z: G * Math.cos(deg * D) });
  const press = (el, type, props) => { const e = new w.Event(type, { bubbles: true, cancelable: true }); Object.assign(e, props || {}); el.dispatchEvent(e); };
  w.Element.prototype.setPointerCapture = function () {};
  const rect = (el, r) => { el.getBoundingClientRect = () => Object.assign({ left: 0, top: 0, right: r.width, bottom: r.height }, r); };

  /* ---------------------------------------------------------------- pure maths */
  T.near(M.elevationDeg(0, 5, 5), 45, 1e-9, 'elevationDeg 45');
  T.near(M.flatTiltDeg(0, 0, 9.8), 0, 1e-9, 'flatTiltDeg flat');
  T.near(M.flatTiltDeg(9.8, 0, 0), 90, 1e-9, 'flatTiltDeg upright');
  T.near(M.plumbAngles(0, 9.8, 0).off, 0, 1e-9, 'plumb upright 0');
  T.eq(M.heightFromAngles(45, null, 1.6, null), null, 'height without base or distance is null');
  T.eq(M.heightFromAngles(90, null, 1.6, 10), null, 'looking straight up is refused');
  T.eq(M.heightFromAngles(NaN, null, 1.6, 10), null, 'NaN angle is refused');
  T.near(M.heightFromAngles(30, null, 1.7, 40).height, 1.7 + 40 * Math.tan(30 * D), 1e-9, 'tree: eye + d tan');
  T.eq(M.distanceFromAngle(1.6, 0), null, 'level gaze has no distance');
  T.eq(M.distanceFromAngle(1.6, -89), null, 'almost straight down is refused (below -85)');
  T.near(M.distanceFromAngle(2, -45), 2, 1e-9, 'distance at 45 down = eye height');
  T.eq(M.slopeFromDeg(45).pct.toFixed(1), '100.0', '45 deg = 100 percent');
  T.eq(M.slopeFromDeg(45).pitch12.toFixed(1), '12.0', '45 deg = 12 per 12');
  T.eq(M.luxLabel(0.5), 'Almost dark', 'lux 0.5'); T.eq(M.luxLabel(1), 'Dim room', 'lux 1'); T.eq(M.luxLabel(50), 'Living room', 'lux 50');
  T.eq(M.luxLabel(200), 'Bright indoor / office', 'lux 200'); T.eq(M.luxLabel(2000), 'Overcast day', 'lux 2000'); T.eq(M.luxLabel(20000), 'Direct sunlight', 'lux 20000');
  T.eq(M.severity(0.049).label, 'Still', 'severity 0.049'); T.eq(M.severity(0.05).label, 'Light vibration', 'severity 0.05');
  T.eq(M.severity(0.3).label, 'Moderate', 'severity 0.3'); T.eq(M.severity(1).label, 'Strong', 'severity 1'); T.eq(M.severity(3).label, 'Severe', 'severity 3');
  T.eq(M.hms(3725), '1 h 2 min 5 s', 'hms 3725'); T.eq(M.hms(59.6), '1 min 0 s', 'hms rounds up into the next minute'); T.eq(M.hms(NaN), '--', 'hms NaN');
  T.near(M.rpmFromTaps([0, 500, 1000, 1500], 5), 120, 1e-9, 'rpm from taps every 500 ms = 120');
  T.near(M.rpmFromTaps([0, 500, 1000, 9000, 9250, 9500], 5), 240, 1e-9, 'a gap over 3 s starts a new series');
  T.eq(M.rpmFromTaps([100], 5), null, 'one tap is not enough');
  {
    const fs = 50, env = []; for (let i = 0; i < 300; i++) env.push(i % 25 < 5 ? 1 : 0.05);   // 2 pulses per second
    const r = M.rpmFromEnvelope(env, fs); T.ok(r && Math.abs(r.rpm - 120) < 2, 'rpm from a synthetic 2 Hz pulse train is 120 (got ' + (r && r.rpm) + ')');
    const flat = new Array(300).fill(0.3); T.eq(M.rpmFromEnvelope(flat, fs), null, 'steady sound has no rpm');
    T.eq(M.rpmFromEnvelope(env.slice(0, 50), fs), null, 'too short an envelope has no rpm');
    const env2 = []; for (let i = 0; i < 400; i++) env2.push(i % 10 < 2 ? 1 : 0.02);  // 5 per second = 300 rpm
    const r2 = M.rpmFromEnvelope(env2, 50); T.ok(r2 && Math.abs(r2.rpm - 300) < 6, '300 rpm pulse train (got ' + (r2 && r2.rpm) + ')');
  }
  T.near(M.unitPrice(10, 1, 'oz').perBase, 10 / 28.3495, 1e-12, 'unit price oz');
  T.eq(M.unitPrice(10, 0, 'g'), null, 'zero amount'); T.eq(M.unitPrice(10, 1, 'xx'), null, 'unknown unit');

  /* ---------------------------------------------------------------- Ruler */
  {
    const t = await page.open('ruler');
    T.has(t.q('#info').textContent, '160.0 px per inch', 'ruler default 160 px per inch');
    T.has(t.q('#info').textContent, 'not calibrated yet', 'ruler not calibrated at first');
    t.click('#cal'); T.eq(t.q('#calbox').style.display, 'block', 'calibration box opens');
    rect(t.q('#area'), { width: 300, height: 900 });
    const DEF = 160 / 25.4, yFor = (ppmm) => 16 + 85.6 * ppmm;
    press(t.q('#grip'), 'pointerdown', { clientX: 10, clientY: yFor(8), pointerId: 1 });
    t.click('#save');
    T.near(page.store('ruler.ppmm', 0), 8, 0.01, 'saved calibration: card edge at 8 px/mm');
    T.has(t.q('#info').textContent, '203.2 px per inch', '8 px/mm = 203.2 px per inch');
    T.has(t.q('#info').textContent, 'calibrated', 'now calibrated');
    t.clickText('Vertical'); T.eq(t.q('#cv').style.width, '150px', 'vertical ruler narrows the canvas');
    T.eq(t.q('#cv').style.height, Math.round(185 * 8) + 'px', 'vertical ruler is 185 mm long on screen');
    t.click('#rst'); T.eq(page.store('ruler.ppmm', 1), 0, 'reset clears calibration'); T.has(t.q('#info').textContent, '160.0 px per inch', 'reset back to default');
    press(t.q('#grip'), 'pointerdown', { clientX: 10, clientY: 5, pointerId: 1 }); t.click('#save');
    T.eq(page.store('ruler.ppmm', 0) >= 2, true, 'calibration is clamped to at least 2 px/mm even with the handle dragged to the top');
    t.close();
  }

  /* ---------------------------------------------------------------- Protractor */
  {
    const t = await page.open('protractor'); const sv = t.q('#sv'); rect(sv, { width: 220, height: 130 });
    T.has(t.q('#deg').textContent, '45.0°', 'protractor starts at 45');
    press(sv, 'pointerdown', { clientX: 50 + 110, clientY: -86.6 + 110, pointerId: 1 });
    T.has(t.q('#deg').textContent, '60.0°', 'drag to 60 degrees');
    T.has(t.q('#comp').textContent, 'Supplement 120.0°  ·  Complement 30.0°', 'supplement and complement');
    press(sv, 'pointerdown', { clientX: 50 + 110, clientY: 20 + 110, pointerId: 1 }); T.has(t.q('#deg').textContent, '0.0°', 'below the baseline on the right clamps to 0');
    press(sv, 'pointerdown', { clientX: -50 + 110, clientY: 20 + 110, pointerId: 1 }); T.has(t.q('#deg').textContent, '180.0°', 'below the baseline on the left clamps to 180');
    press(sv, 'pointerdown', { clientX: -100 + 110, clientY: 0 + 110, pointerId: 1 }); T.has(t.q('#deg').textContent, '180.0°', 'left end is 180');
    T.eq(page.live('devicemotion'), 0, 'drag mode does not listen to the motion sensor');
    t.clickText('Tilt phone'); T.eq(page.live('devicemotion'), 1, 'tilt mode listens to the motion sensor');
    page.motion({ x: G * Math.cos(30 * D), y: G * Math.sin(30 * D), z: 0 }, null, 3);
    T.has(t.q('#deg').textContent, '30.0°', 'tilt mode reads 30 degrees');
    page.motion({ x: 0.5, y: 0.5, z: G }, null, 1); T.has(t.text(), 'Hold the phone upright', 'lying flat asks to hold the phone upright');
    page.motion({ x: G * Math.cos(30 * D), y: G * Math.sin(30 * D), z: 0 }, null, 60);
    t.click('#zero'); page.motion({ x: G * Math.cos(50 * D), y: G * Math.sin(50 * D), z: 0 }, null, 60);
    T.has(t.q('#deg').textContent, '20.0°', 'zero at 30 then 50 reads 20');
    t.clickText('Drag arm'); T.eq(page.live('devicemotion'), 0, 'back to drag mode stops listening');
    t.clickText('Tilt phone'); t.close(); T.eq(page.live('devicemotion'), 0, 'leaving the tool stops listening');
    page.noMotionApi(); const n = await page.open('protractor'); n.clickText('Tilt phone'); T.has(n.text(), 'No motion sensor found', 'protractor without a sensor says so'); n.close(); page.motionApi();
  }

  /* ---------------------------------------------------------------- Pendulum bob */
  {
    const t = await page.open('plumb');
    page.motion({ x: 0, y: G, z: 0 }, null, 60); await page.wait(40);
    T.has(t.q('#deg').textContent, '0.0°', 'plumb upright 0 degrees');
    page.motion({ x: G * Math.sin(10 * D), y: G * Math.cos(10 * D), z: 0 }, null, 80); await page.wait(40);
    T.has(t.q('#deg').textContent, '10.0°', 'plumb 10 degrees sideways');
    T.has(t.q('#sd').textContent, '+10.0°', 'sideways +10'); T.has(t.q('#fb').textContent, '+0.0°', 'forward 0');
    page.motion({ x: 0, y: 0, z: G }, null, 120); await page.wait(40);
    T.has(t.q('#deg').textContent, '90.0°', 'phone flat = 90 degrees');
    t.close(); T.eq(page.live('devicemotion'), 0, 'plumb removes listener');
    page.noMotionApi(); const n = await page.open('plumb'); T.has(n.text(), 'No motion sensor found', 'plumb without sensor'); n.close(); page.motionApi();
  }

  /* ---------------------------------------------------------------- G meter */
  {
    const t = await page.open('gmeter');
    page.motion({ x: 0.6 * G, y: 0, z: 0.8 * G }); await page.wait(40);
    T.has(t.q('#tot').textContent, '1.00', 'g total 1.00'); T.has(t.q('#gx').textContent, '0.60', 'gx 0.60'); T.has(t.q('#gz').textContent, '0.80', 'gz 0.80');
    page.motion({ x: 0, y: 0, z: 2.5 * G }); await page.wait(40);
    T.has(t.q('#tot').textContent, '2.50', 'g total 2.50'); T.has(t.q('#pk').textContent, '2.50 g', 'peak 2.50 g');
    page.motion({ x: 0, y: 0, z: G }); await page.wait(40);
    T.has(t.q('#pk').textContent, '2.50 g', 'peak holds'); T.has(t.q('#tot').textContent, '1.00', 'total back to 1.00');
    t.click('#rs'); page.motion({ x: 0, y: 0, z: G }); await page.wait(40); T.has(t.q('#pk').textContent, '1.00 g', 'reset peak restarts from the current reading');
    t.check('#ng', true); page.motion({ x: 0, y: 0, z: G }, null); await page.wait(40);
    T.has(t.q('#msg').textContent, 'cannot remove gravity', 'remove gravity without a linear sensor explains itself'); T.eq(t.q('#ng').checked, false, 'checkbox unticks');
    t.check('#ng', true); page.motion({ x: 0, y: 0, z: G }, { x: 0, y: 0, z: 0.49033 }); await page.wait(40);
    T.has(t.q('#tot').textContent, '0.05', 'remove gravity: 0.49 m/s2 = 0.05 g');
    t.close(); T.eq(page.live('devicemotion'), 0, 'gmeter removes listener');
  }

  /* ---------------------------------------------------------------- Vibrometer */
  {
    const t = await page.open('vibrometer');
    for (let i = 0; i < 45; i++) { page.tick(50); page.motion({ x: 0, y: 0, z: G }, { x: 0.2, y: 0, z: 0 }); }
    await page.wait(40);
    T.has(t.q('#v').textContent, '0.200', 'RMS 0.200'); T.has(t.q('#sev').textContent, 'Light vibration', '0.2 is light vibration');
    T.has(t.q('#mn').textContent, '0.200', 'min 0.200'); T.has(t.q('#mx').textContent, '0.200', 'max 0.200');
    t.click('#rs'); T.has(t.q('#mx').textContent, '0.200', 'reset keeps showing until the next paint');
    for (let i = 0; i < 45; i++) { page.tick(50); page.motion({ x: 0, y: 0, z: G }, { x: 0, y: 2, z: 0 }); }
    await page.wait(40); T.has(t.q('#sev').textContent, 'Strong', '2 m/s2 is strong'); T.has(t.q('#v').textContent, '2.000', 'RMS 2.000');
    for (let i = 0; i < 45; i++) { page.tick(50); page.motion({ x: 0, y: 0, z: G }, { x: 4, y: 3, z: 0 }); }
    await page.wait(40); T.has(t.q('#sev').textContent, 'Severe', '5 m/s2 is severe');
    t.close(); T.eq(page.live('devicemotion'), 0, 'vibrometer removes listener');
    const f = await page.open('vibrometer');   // phones without a linear-acceleration field: gravity is high-passed away
    for (let i = 0; i < 60; i++) { page.tick(50); page.motion({ x: 0.1, y: 0.2, z: G }, null); }
    await page.wait(40); T.has(f.q('#sev').textContent, 'Still', 'a motionless phone without linear acceleration reads Still'); f.close();
  }

  /* ---------------------------------------------------------------- RPM counter */
  {
    const t = await page.open('rpm'); const pad = t.q('#pad');
    for (let i = 0; i < 4; i++) { press(pad, 'pointerdown'); page.tick(500); }
    T.eq(t.q('#r').textContent, '120', 'taps every 500 ms read 120 rpm'); T.eq(t.q('#n').textContent, '4', 'tap counter');
    page.tick(4000); press(pad, 'pointerdown'); T.eq(t.q('#r').textContent, '--', 'a long gap starts over (one tap, no rpm)');
    page.tick(250); press(pad, 'pointerdown'); T.eq(t.q('#r').textContent, '240', 'quarter-second taps = 240 rpm');
    t.click('#rs'); T.eq(t.q('#r').textContent, '--', 'reset clears rpm'); T.eq(t.q('#n').textContent, '0', 'reset clears taps');
    // microphone mode
    const stops = []; const mkStream = () => ({ getTracks: () => [{ stop: () => stops.push(1) }] });
    Object.defineProperty(w.navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: () => Promise.reject(Object.assign(new Error('x'), { name: 'NotAllowedError' })) } });
    t.clickText('Microphone'); await page.wait(30); T.has(t.q('#msg').textContent, 'Microphone permission denied', 'rpm mic: permission denied');
    Object.defineProperty(w.navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: () => Promise.reject(Object.assign(new Error('x'), { name: 'NotFoundError' })) } });
    t.clickText('Tap'); t.clickText('Microphone'); await page.wait(30); T.has(t.q('#msg').textContent, 'Microphone not available', 'rpm mic: no microphone');
    Object.defineProperty(w.navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: () => Promise.resolve(mkStream()) } });
    t.clickText('Tap'); t.clickText('Microphone'); await page.wait(30); T.has(t.q('#msg').textContent, 'Listening', 'rpm mic: listening');
    t.close(); T.eq(stops.length, 1, 'leaving the RPM tool stops the microphone stream');
    const t2 = await page.open('rpm'); t2.clickText('Microphone'); await page.wait(10); t2.clickText('Tap'); await page.wait(30);
    T.eq(stops.length, 2, 'switching back to Tap stops the microphone'); t2.close();
  }

  /* ---------------------------------------------------------------- Screen info */
  {
    Object.defineProperty(w.screen, 'width', { configurable: true, value: 360 }); Object.defineProperty(w.screen, 'height', { configurable: true, value: 800 });
    w.devicePixelRatio = 3;
    const t = await page.open('pixelinfo');
    T.has(t.q('#res').textContent, '1080 × 2400', 'physical pixels 1080 x 2400');
    T.has(t.text(), '5.5 in', 'diagonal estimate 5.5 in (hypot(360,800)/160 = 5.48)'); T.has(t.text(), '2.22 : 1', 'aspect ratio 2.22 : 1'); T.has(t.text(), '480 dpi', 'density 480 dpi');
    const clip = []; Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { writeText: (x) => { clip.push(x); return Promise.resolve(); } } });
    t.click('#cp'); await page.wait(20); T.ok(clip[0] && clip[0].includes('Physical pixels: 1080 × 2400') && clip[0].startsWith('Screen info'), 'Copy these details copies the table');
    t.click('#grid'); T.ok(w.document.querySelectorAll('canvas').length >= 1 && !!w.document.body.lastElementChild.style.cssText.includes('fixed'), 'grid overlay opens');
    const ov = w.document.body.lastElementChild; ov.click(); T.ok(!w.document.body.contains(ov), 'tapping the grid closes it');
    t.click('#dead'); const ov2 = w.document.body.lastElementChild; T.eq(ov2.style.background, 'rgb(255, 0, 0)', 'dead pixel test starts red');
    ov2.click(); ov2.click(); ov2.click(); ov2.click(); T.ok(w.document.body.contains(ov2), 'still open on the last colour'); ov2.click(); T.ok(!w.document.body.contains(ov2), 'closes after the fifth colour');
    t.click('#grid'); const ov3 = w.document.body.lastElementChild; t.close(); T.ok(!w.document.body.contains(ov3), 'leaving the tool removes an open overlay');
    Object.defineProperty(w.screen, 'width', { configurable: true, value: 0 }); Object.defineProperty(w.screen, 'height', { configurable: true, value: 0 });
    const z = await page.open('pixelinfo'); T.ok(!/NaN|Infinity|undefined/.test(z.text()), 'a zero-size screen never prints NaN (got: ' + z.text().slice(0, 200) + ')'); z.close();
  }

  /* ---------------------------------------------------------------- Reaction test */
  {
    w.Math.random = () => 0;
    const t = await page.open('reaction'); const pad = t.q('#pad');
    T.has(t.text(), 'Tap to start', 'reaction idle');
    press(pad, 'pointerdown'); T.has(pad.textContent, 'Wait for green', 'waiting state');
    press(pad, 'pointerdown'); T.has(pad.textContent, 'Too soon', 'tapping early is "too soon"');
    press(pad, 'pointerdown'); await page.wait(1300); T.has(pad.textContent, 'TAP NOW', 'turns green after 1.2 s');
    page.tick(237); press(pad, 'pointerdown');
    T.has(t.q('#la').textContent, '237 ms', 'last reaction 237 ms'); T.has(t.q('#be').textContent, '237 ms', 'best 237'); T.has(pad.textContent, '237 ms. Tap to go again', 'result on the pad');
    press(pad, 'pointerdown'); await page.wait(1300); page.tick(300); press(pad, 'pointerdown');
    T.has(t.q('#av').textContent, '269 ms', 'average of 237 and 300 = 268.5 -> 269'); T.has(t.q('#be').textContent, '237 ms', 'best stays 237');
    T.eq(page.store('reaction.best', 0), 237, 'best is saved');
    press(pad, 'pointerdown'); await page.wait(1300); page.tick(180); press(pad, 'pointerdown'); T.eq(page.store('reaction.best', 0), 180, 'new best saved');
    t.close();
    const t2 = await page.open('reaction'); T.has(t2.q('#be').textContent, '180 ms', 'best survives reopening');
    press(t2.q('#pad'), 'pointerdown'); t2.close(); await page.wait(1400); T.ok(true, 'closing while waiting leaves no timer that throws');
  }

  /* ---------------------------------------------------------------- Magnetometer / Light meter (fake native sensor) */
  {
    page.fake.avail.magnetic = true; page.fake.avail.light = true;
    const t = await page.open('magnet'); await page.wait(30);
    page.fake.emit('magnetic', [30, 40, 0]); T.has(t.q('#v').textContent, '50', 'magnetometer total 50 uT');
    T.has(t.q('#x').textContent, '30', 'x 30'); T.has(t.q('#y').textContent, '40', 'y 40');
    T.has(t.q('#msg').textContent, 'Live reading', 'live reading label');
    t.click('#rs'); T.has(t.q('#rs').textContent, 'Show absolute field', 'zero baseline button changes');
    page.fake.emit('magnetic', [0, 0, 80]); T.has(t.q('#v').textContent, '30', 'change from baseline = |80 - 50| = 30');
    T.has(t.q('#msg').textContent, 'change from baseline', 'baseline label'); T.has(t.q('#pk').textContent, '30', 'peak 30');
    t.click('#rs'); page.fake.emit('magnetic', [0, 0, 80]); T.has(t.q('#v').textContent, '80', 'back to absolute');
    t.close(); await page.wait(10); T.ok(page.fake.stopLog.includes('magnetic'), 'magnetometer stops the native sensor on leaving');
    page.fake.avail.magnetic = false; const n = await page.open('magnet'); await page.wait(30); T.has(n.q('#msg').textContent, 'does not have a magnetic field sensor', 'magnetometer: no sensor'); n.close();
    page.fake.native = false; const wb = await page.open('magnet'); T.has(wb.q('#msg').textContent, 'does not expose a magnetic field sensor', 'magnetometer in a browser says so'); wb.close(); page.fake.native = true;

    const l = await page.open('lightmeter'); await page.wait(30);
    page.fake.emit('light', [0.5]); T.eq(l.q('#v').textContent, '0.5', 'light 0.5 lux shows a decimal'); T.eq(l.q('#lab').textContent, 'Almost dark', 'label dark');
    page.fake.emit('light', [300]); T.eq(l.q('#v').textContent, '300', '300 lux'); T.eq(l.q('#lab').textContent, 'Bright indoor / office', 'label office');
    page.fake.emit('light', [25000]); T.eq(l.q('#lab').textContent, 'Direct sunlight', 'label sun'); T.eq(l.q('#pk').textContent, '25000', 'peak 25000');
    page.fake.emit('light', [null]); T.eq(l.q('#v').textContent, '25000', 'a null reading is ignored');
    l.close(); await page.wait(10); T.ok(page.fake.stopLog.includes('light'), 'light meter stops the native sensor on leaving');
    page.fake.native = false; const lw = await page.open('lightmeter'); T.has(lw.q('#msg').textContent, 'does not expose its light sensor', 'light meter in a browser says so'); lw.close(); page.fake.native = true;
  }

  await T.done(page);
})().catch(e => { console.log('FAIL: test crashed: ' + (e && e.stack || e)); process.exit(1); });
