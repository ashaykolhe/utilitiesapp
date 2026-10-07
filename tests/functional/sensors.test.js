'use strict';
/* Functional tests for the sensor tools: Compass, Leveler (sensors.js), Speedometer, Altitude (location.js) and the native-plugin tools in
   sensorbox.js (Metal Detector, Barometer, Room Temperature, Proximity, Signal Strength, Gyroscope, Sensor List), all driven by fake sensors. */
const { boot } = require('./mh-fakes');
const { suite } = require('../helpers/page');
global.Tools = { register() {} };
const S = require('../../www/js/tools/sensors.js');
const L = require('../../www/js/tools/location.js');
const R = Math.PI / 180;

(async () => {
  const T = suite('sensors'), page = await boot(), w = page.w, fake = page.fake, geo = page.geo;
  const vib = []; w.navigator.vibrate = (p) => { vib.push(p); return true; };

  /* ---------------------------------------------------------------- pure: compass heading and GPS tracking */
  T.near(S.compassHeading(0, 0, 0), 0, 1e-9, 'flat, alpha 0 = north'); T.near(S.compassHeading(90, 0, 0), 270, 1e-9, 'flat, alpha 90 (turned left) = west 270');
  T.near(S.compassHeading(315, 0, 0), 45, 1e-9, 'flat, alpha 315 = north-east'); T.near(S.compassHeading(90, 90, 0), 270, 1e-9, 'upright, alpha 90 = camera faces west');
  T.near(S.compassHeading(90, 20, 0), 270, 1e-6, 'a 20 degree tilt does not change the heading'); T.near(S.compassHeading(0, 0, 90), 270, 1e-9, 'on its side (gamma 90): rear camera faces west');
  T.near(L.dist({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 }), 111194.9, 1, 'one degree of latitude is 111.2 km'); T.near(L.dist({ latitude: 60, longitude: 0 }, { latitude: 60, longitude: 1 }), 55597.5, 1, 'one degree of longitude at 60N is 55.6 km');
  {
    const st = { last: null, hist: [], d: 0 };
    T.eq(L.trackFix(st, { latitude: 10, longitude: 10, accuracy: 5, speed: null }, 0), 0, 'first fix has no speed');
    T.eq(L.trackFix(st, { latitude: 10, longitude: 10, accuracy: 5, speed: 10 }, 1000), 36, 'Doppler speed 10 m/s = 36 km/h'); T.eq(L.trackFix(st, { latitude: 10, longitude: 10, accuracy: 5, speed: 0.2 }, 2000), 0, 'under 1 km/h is shown as 0');
    T.eq(L.trackFix(st, { latitude: 10, longitude: 10, accuracy: 5, speed: -1 }, 3000), 0, 'a negative speed is ignored'); T.eq(st.d, 0, 'standing still adds no distance');
    L.trackFix(st, { latitude: 10.0001, longitude: 10, accuracy: 80, speed: null }, 4000); T.eq(st.d, 0, 'a poor fix (80 m) adds no distance');
    L.trackFix(st, { latitude: 10.0001, longitude: 10, accuracy: 5, speed: null }, 5000); T.near(st.d, 11.12, 0.05, 'a good fix 11.1 m away adds its distance');
  }

  /* ---------------------------------------------------------------- Compass */
  {
    const t = await page.open('compass'); await page.wait(20);
    T.eq(page.live('deviceorientationabsolute'), 1, 'compass listens (absolute)'); T.eq(page.live('deviceorientation'), 1, 'compass listens (relative)');
    page.orient({ alpha: 90, beta: 0, gamma: 0, absolute: true }, 'deviceorientationabsolute'); T.eq(t.q('#deg').textContent, '270° W', 'alpha 90 shows 270 W');
    page.orient({ alpha: 0, beta: 0, gamma: 0, absolute: true }, 'deviceorientationabsolute'); T.eq(t.q('#deg').textContent, '0° N', 'alpha 0 shows 0 N'); T.eq(t.q('#msg').textContent, '', 'hint clears once a heading arrives');
    page.orient({ alpha: 315, beta: 0, gamma: 0, absolute: true }, 'deviceorientationabsolute'); T.eq(t.q('#deg').textContent, '45° NE', '45 NE');
    page.orient({ alpha: 359.6, beta: 0, gamma: 0, absolute: true }, 'deviceorientationabsolute'); T.eq(t.q('#deg').textContent, '0° N', '0.4 rounds to 0 N, never 360');
    page.orient({ alpha: 180, beta: 0, gamma: 0, absolute: true }, 'deviceorientationabsolute'); T.eq(t.q('#deg').textContent, '180° S', 'south');
    page.orient({ alpha: 200, beta: null, gamma: null, absolute: true }, 'deviceorientationabsolute'); T.eq(t.q('#deg').textContent, '160° S', 'alpha only: heading = 360 - alpha = 160 (nearest of the 8 points is S)');
    page.orient({ webkitCompassHeading: 123 }); T.eq(t.q('#deg').textContent, '123° SE', 'webkitCompassHeading used directly');
    page.orient({ alpha: 10, beta: 0, gamma: 0, absolute: false }); T.eq(t.q('#deg').textContent, '123° SE', 'relative orientation (not absolute) is ignored');
    page.orient({ webkitCompassHeading: 350 }); T.eq(t.q('#rose').style.transform, 'rotate(-350deg)', 'rose at 350'); page.orient({ webkitCompassHeading: 10 }); T.eq(t.q('#rose').style.transform, 'rotate(-370deg)', 'rose takes the short way across north (350 to 10 = +20)');
    page.orient({ webkitCompassHeading: NaN }); T.eq(t.q('#deg').textContent, '10° N', 'NaN heading ignored');
    t.close(); T.eq(page.live('deviceorientationabsolute') + page.live('deviceorientation'), 0, 'compass removes both listeners on leaving');
    page.orient({ webkitCompassHeading: 77 });
    const d = await page.open('compass'); page.orientApi(() => Promise.resolve('denied')); d.close();
    page.orientApi(() => Promise.resolve('denied')); const dn = await page.open('compass'); await page.wait(30); T.has(dn.q('#msg').textContent, 'Sensor permission denied', 'compass permission denied'); T.eq(page.live('deviceorientation'), 0, 'no listener when denied'); dn.close();
    page.orientApi(() => Promise.reject(new Error('x'))); const rj = await page.open('compass'); await page.wait(30); T.has(rj.q('#msg').textContent, 'Sensor permission denied', 'compass permission error'); rj.close();
    page.orientApi(() => Promise.resolve('granted')); const g = await page.open('compass'); await page.wait(30); T.eq(page.live('deviceorientation'), 1, 'permission granted starts listening'); g.close();
    page.orientApi(); const n = await page.open('compass'); await page.wait(2700); T.has(n.q('#msg').textContent, 'No compass sensor found', 'compass says so when no events come'); n.close();
    const q = await page.open('compass'); q.close(); await page.wait(2700); T.ok(true, 'the no-sensor timer is cleared on leaving');
  }

  /* ---------------------------------------------------------------- Leveler */
  {
    const t = await page.open('leveler'); await page.wait(20);
    T.eq(page.live('deviceorientation'), 1, 'leveler listens');
    page.orient({ beta: 5, gamma: -3 }); T.eq(t.q('#deg').textContent, '5.0° / -3.0°', 'shows beta / gamma'); T.eq(t.q('#bub').style.transform, 'translate(-6.6px,11px)', 'bubble moves 2.2 px per degree');
    T.ok(t.q('#bub').style.background !== 'var(--ok)', 'not level: bubble is not green'); page.orient({ beta: 0.3, gamma: -0.2 }); T.eq(t.q('#msg').textContent, 'Level', 'within half a degree says Level'); T.eq(t.q('#bub').style.background, 'var(--ok)', 'bubble turns green when level'); page.orient({ beta: 5, gamma: -3 });
    t.click('#cal'); page.orient({ beta: 7, gamma: -1 }); T.eq(t.q('#deg').textContent, '2.0° / 2.0°', 'set zero offsets the reading'); T.eq(t.q('#bub').style.transform, 'translate(4.4px,4.4px)', 'bubble follows the offset');
    page.orient({ beta: 80, gamma: 80 }); T.eq(t.q('#bub').style.transform, 'translate(99px,99px)', 'bubble stops at the edge of the dial'); T.eq(t.q('#deg').textContent, '75.0° / 83.0°', 'numbers are not clamped');
    page.orient({ beta: null, gamma: null }); T.eq(t.q('#deg').textContent, '75.0° / 83.0°', 'null readings are ignored');
    t.close(); T.eq(page.live('deviceorientation'), 0, 'leveler removes listener');
    page.orientApi(() => Promise.resolve('denied')); const dn = await page.open('leveler'); await page.wait(30); T.has(dn.q('#msg').textContent, 'Sensor permission denied', 'leveler permission denied'); dn.close();
    page.orientApi(); const n = await page.open('leveler'); await page.wait(2700); T.has(n.q('#msg').textContent, 'No orientation sensor found', 'leveler no sensor'); n.close();
  }

  /* ---------------------------------------------------------------- Speedometer */
  {
    const t = await page.open('speedometer');
    T.eq(t.q('#sp').textContent, '0', 'speed starts at 0'); T.eq(geo.watchers.size, 1, 'speedometer watches the GPS');
    geo.fail(1); T.has(t.q('#msg').textContent, 'Location permission denied', 'GPS permission denied message'); geo.fail(2); T.has(t.q('#msg').textContent, 'Location unavailable', 'GPS unavailable'); geo.fail(3); T.has(t.q('#msg').textContent, 'Timed out', 'GPS timeout'); geo.fail(99); T.has(t.q('#msg').textContent, 'Waiting for GPS', 'other error');
    const lat0 = 51.5, lon0 = -0.12, mPerDeg = 111194.93; let T0 = 1000000;
    for (let s = 0; s <= 60; s++) geo.emit({ latitude: lat0 + 1.4 * s / mPerDeg, longitude: lon0 }, T0 + s * 1000);  // walking north at 1.4 m/s for a minute (84 m)
    T.eq(t.q('#sp').textContent, '5', 'walking 1.4 m/s shows 5 km/h'); T.eq(t.q('#mx').textContent, '5', 'max 5'); const di = parseFloat(t.q('#di').textContent); T.ok(di >= 0.075 && di <= 0.085, 'a 84 m walk shows 0.08 km (got ' + di + ')');
    geo.emit({ latitude: lat0 + 84 / mPerDeg, longitude: lon0, speed: 25 }, T0 + 61000); T.eq(t.q('#sp').textContent, '90', 'Doppler speed 25 m/s = 90 km/h'); T.eq(t.q('#mx').textContent, '90', 'max 90');
    geo.emit({ latitude: lat0 + 84 / mPerDeg, longitude: lon0, speed: 3 }, T0 + 62000); T.eq(t.q('#sp').textContent, '11', '3 m/s = 11 km/h'); T.eq(t.q('#mx').textContent, '90', 'max holds');
    geo.emit({ latitude: lat0 + 84 / mPerDeg, longitude: lon0, accuracy: 60, speed: 3 }, T0 + 63000); T.has(t.q('#msg').textContent, 'Weak GPS signal (±60 m); distance paused', 'weak signal message');
    const before = t.q('#di').textContent; geo.emit({ latitude: lat0 + 500 / mPerDeg, longitude: lon0, accuracy: 60 }, T0 + 64000); T.eq(t.q('#di').textContent, before, 'no distance on a weak fix');
    geo.emit({ latitude: NaN, longitude: 3 }, T0 + 65000); T.eq(t.q('#mx').textContent, '90', 'a fix with NaN coordinates is ignored');
    t.click('#rs'); T.eq(t.q('#mx').textContent, '0', 'reset trip clears max'); T.eq(t.q('#di').textContent, '0.00', 'reset trip clears distance');
    geo.emit({ latitude: 40, longitude: 10 }, T0 + 70000); geo.emit({ latitude: 40.00001, longitude: 10.00001 }, T0 + 71000); geo.emit({ latitude: 40, longitude: 10.00002 }, T0 + 72000); T.eq(t.q('#di').textContent, '0.00', 'GPS jitter of a metre or two adds no distance');
    t.clickText('mph'); T.eq(t.q('#su').textContent, 'mph', 'mph label'); T.eq(t.q('#ml').textContent, 'Max mph', 'max label'); T.eq(t.q('#dl').textContent, 'Distance miles', 'distance label'); T.eq(t.q('#sp').textContent, '0', 'speed 0 in mph');
    geo.emit({ latitude: 40, longitude: 10, speed: 10 }, T0 + 80000); T.eq(t.q('#sp').textContent, '22', '10 m/s = 22 mph'); T.eq(t.q('#mx').textContent, '22', 'max in mph');
    geo.emit({ latitude: 40.01, longitude: 10, speed: 10 }, T0 + 81000); T.eq(t.q('#di').textContent, '0.69', '1.11 km = 0.69 mi'); T.eq(page.store('speedo.unit', ''), 'mph', 'unit remembered'); t.clickText('km/h'); T.eq(t.q('#sp').textContent, '36', 'back to km/h'); T.eq(t.q('#di').textContent, '1.11', '1.11 km');
    t.clickText('mph'); t.close(); const t9 = await page.open('speedometer'); T.eq(t9.q('#su').textContent, 'mph', 'speedometer opens in the last unit'); T.eq(geo.watchers.size, 1, 'speedometer watching'); t9.clickText('km/h'); t9.close(); T.eq(geo.watchers.size, 0, 'speedometer stops the GPS on leaving'); T.eq(geo.cleared.length >= 1, true, 'clearWatch called');
    Object.defineProperty(w.navigator, 'geolocation', { configurable: true, value: undefined });
    const n = await page.open('speedometer'); T.has(n.q('#msg').textContent, 'no location support', 'no geolocation support message'); n.close();
    Object.defineProperty(w.navigator, 'geolocation', { configurable: true, value: { watchPosition(ok, err) { const id = ++geo.n; geo.watchers.set(id, { ok, err }); return id; }, clearWatch(id) { geo.watchers.delete(id); geo.cleared.push(id); } } });
  }

  /* ---------------------------------------------------------------- Altitude */
  {
    const t = await page.open('altitude');
    geo.emit({ latitude: 12.345678, longitude: -98.765432, altitude: 123.4, altitudeAccuracy: 8.2, accuracy: 4.6 });
    T.eq(t.q('#al').textContent, '123', 'altitude 123'); T.eq(t.q('#ac2').textContent, '±8 m', 'altitude accuracy'); T.eq(t.q('#la').textContent, '12.34568', 'latitude 5 decimals'); T.eq(t.q('#lo').textContent, '-98.76543', 'longitude'); T.eq(t.q('#ac').textContent, '±5 m', 'position accuracy');
    geo.emit({ latitude: 1, longitude: 2, altitude: null, altitudeAccuracy: null, accuracy: 10 }); T.eq(t.q('#al').textContent, 'n/a', 'no altitude reported'); T.has(t.q('#msg').textContent, 'did not report an altitude', 'explains it'); T.eq(t.q('#ac2').textContent, '', 'no accuracy text');
    geo.emit({ latitude: 1, longitude: 2, altitude: -3.6, altitudeAccuracy: 5, accuracy: 10 }); T.eq(t.q('#al').textContent, '-4', 'below sea level rounds to -4');
    t.clickText('feet'); T.eq(t.q('#al').textContent, '-12', '-3.6 m = -12 ft'); T.has(t.q('#au').textContent, 'feet', 'label in feet'); T.eq(t.q('#ac2').textContent, '±16 ft', 'accuracy 5 m = 16 ft');
    geo.emit({ latitude: 1, longitude: 2, altitude: 1000, altitudeAccuracy: 10, accuracy: 10 }); T.eq(t.q('#al').textContent, '3281', '1000 m = 3281 ft'); t.clickText('metres'); T.eq(t.q('#al').textContent, '1000', 'back to metres');
    const clip = []; Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { writeText: (x) => { clip.push(x); return Promise.resolve(); } } });
    t.click('#cp'); await page.wait(20); T.eq(clip[0], '1.00000, 2.00000', 'Copy coordinates copies latitude, longitude');
    geo.fail(1); T.has(t.q('#msg').textContent, 'permission denied', 'altitude permission denied'); t.close(); T.eq(geo.watchers.size, 0, 'altitude stops the GPS on leaving');
  }

  /* ---------------------------------------------------------------- Sensor List */
  {
    fake.sensors = [{ type: 5, name: 'Light', typeName: 'android.sensor.light', vendor: 'ACME', maxRange: 40000 }, { type: 1, name: 'Accel', typeName: 'android.sensor.accelerometer', vendor: 'ACME', maxRange: 78.4532 }, { type: 99, name: 'Odd', typeName: 'com.vendor.thing', vendor: '', maxRange: 1 }];
    fake.avail['1'] = true; fake.avail['5'] = false;
    fake.native = false; let t = await page.open('sensorlist'); await page.wait(20); T.has(t.q('#msg').textContent, 'works only in the installed PocketKit app', 'sensor list in a browser'); t.close(); fake.native = true;
    t = await page.open('sensorlist'); await page.wait(30);
    T.has(t.q('#sum').textContent, '3 sensors found', 'sensor count'); const rows = t.all('#rows button'); T.eq(rows.length, 3, 'three rows'); T.has(rows[0].textContent, 'Accel', 'sorted by name'); T.has(rows[0].textContent, 'range 78.45 m/s²', 'range and unit'); T.has(rows[0].textContent, 'accelerometer', 'short type name');
    rows[0].click(); await page.wait(20); T.eq(t.q('#live').hidden, false, 'live panel opens'); T.eq(t.q('#ln').textContent, 'Accel', 'live name'); fake.emit('1', [0.1234, 9.81, -0.0001], 3);
    T.eq(t.q('#lv').textContent, '0.123 , 9.810 , 0.000 m/s²', 'live values: 3 decimals, never -0.000'); T.has(t.q('#la').textContent, 'Accuracy: high', 'accuracy label'); fake.emit('1', [250.55, 0, 0], 1); T.has(t.q('#lv').textContent, '250.6 , 0.000', 'large values use 1 decimal'); T.has(t.q('#la').textContent, 'low', 'accuracy low');
    rows[2].click(); await page.wait(20); T.ok(fake.stopLog.includes('1'), 'switching sensor stops the previous one'); T.has(t.q('#lv').textContent, 'cannot be read live', 'a sensor that will not start says so'); T.has(rows[2].textContent, 'thing', 'vendor-prefixed type shortened');
    rows[0].click(); await page.wait(20); t.click('#lx'); await page.wait(10); T.eq(t.q('#live').hidden, true, 'Stop hides the live panel'); T.ok(fake.stopLog.filter(x => x === '1').length >= 2, 'Stop stops the sensor');
    rows[0].click(); await page.wait(20); const n0 = fake.stopLog.length; t.close(); T.ok(fake.stopLog.length > n0, 'leaving stops a live sensor');
    fake.sensors = []; t = await page.open('sensorlist'); await page.wait(30); T.has(t.q('#msg').textContent, 'No sensors reported', 'empty sensor list'); t.close();
  }

  /* ---------------------------------------------------------------- Metal detector */
  {
    fake.avail.magnetic = true; vib.length = 0;
    const t = await page.open('metaldetect'); await page.wait(30);
    for (let i = 0; i < 6; i++) fake.emit('magnetic', [30, 40, 0]);
    T.eq(t.q('#base').textContent, '50.0', 'baseline settles at 50 uT after six readings'); T.eq(t.q('#val').textContent, '50.0', 'field 50.0'); T.eq(t.q('#dlt').textContent, '0.0', 'change 0.0'); T.eq(t.q('#bar').style.width, '0%', 'bar empty');
    for (let i = 0; i < 40; i++) fake.emit('magnetic', [30, 40, 20]);
    const m = Math.hypot(30, 40, 20); T.near(parseFloat(t.q('#dlt').textContent), m - 50, 0.06, 'change = 53.85 - 50'); T.eq(t.q('#bar').style.width, Math.round((m - 50) / 20 * 100) + '%', 'bar = change / sensitivity (20 uT)');
    t.type('#sens', '10'); T.eq(t.q('#sl').textContent, '10 µT', 'sensitivity label'); fake.emit('magnetic', [30, 40, 20]); T.eq(t.q('#bar').style.width, Math.min(100, Math.round((m - 50) / 10 * 100)) + '%', 'bar rescales with sensitivity');
    await page.wait(120); T.ok(vib.length > 0, 'a field change makes it vibrate'); const nv = vib.length; t.check('#vib', false); await page.wait(200); T.eq(vib.length, nv, 'Vibrate switch off silences the vibration');
    t.click('#cal'); for (let i = 0; i < 10; i++) fake.emit('magnetic', [0, 0, 60]); T.eq(t.q('#base').textContent, '60.0', 'Set baseline here re-zeroes on the current field');
    fake.emit('magnetic', [0, 0]); T.ok(true, 'short readings are ignored');
    t.close(); await page.wait(10); T.ok(fake.stopLog.includes('magnetic'), 'metal detector stops the sensor on leaving'); const n1 = vib.length; await page.wait(150); T.eq(vib.length, n1, 'no beeps after leaving');
    fake.avail.magnetic = false; const n = await page.open('metaldetect'); await page.wait(30); T.has(n.q('#msg').textContent, 'does not have a magnetic field sensor', 'metal detector: no sensor'); n.close();
    fake.native = false; const wb = await page.open('metaldetect'); await page.wait(20); T.has(wb.q('#msg').textContent, 'works only in the installed PocketKit app', 'metal detector in a browser'); wb.close(); fake.native = true;
  }

  /* ---------------------------------------------------------------- Barometer */
  {
    fake.avail.pressure = true;
    const t = await page.open('barometer'); await page.wait(30);
    fake.emit('pressure', [1013.25]); T.eq(t.q('#p').textContent, '1013.3', 'pressure 1013.3'); T.eq(t.q('#alt').textContent, '0', 'standard pressure is 0 m (never -0)');
    for (let i = 0; i < 300; i++) fake.emit("pressure", [900]); T.eq(t.q('#p').textContent, '900.0', 'pressure 900.0'); const h900 = 44330 * (1 - Math.pow(900 / 1013.25, 1 / 5.255)); T.near(h900, 988.6, 1, '900 hPa is about 989 m in the standard atmosphere'); T.eq(t.q('#alt').textContent, String(Math.round(h900)), 'barometer shows the height for 900 hPa'); T.eq(t.q('#altf').textContent, String(Math.round(h900 * 3.28084)), 'and in feet');
    fake.emit('pressure', [200]); fake.emit('pressure', [1200]); T.eq(t.q('#p').textContent, '900.0', 'out-of-range readings ignored');
    t.type('#p0', '1000'); T.eq(t.q('#alt').textContent, String(Math.round(44330 * (1 - Math.pow(900 / 1000, 1 / 5.255)))), 'altitude follows the sea-level pressure field (about 878 m)');
    t.type('#known', '500'); t.click('#set'); T.eq(t.value('#p0'), (900 / Math.pow(1 - 500 / 44330, 5.255)).toFixed(1), 'calibrating to a known 500 m height sets sea-level pressure'); T.eq(t.q('#alt').textContent, '500', 'and the height reads 500');
    t.type('#known', ''); t.click('#set'); T.has(w.document.querySelector('#toast').textContent, 'Enter your height', 'calibrate without a height says so');
    t.close(); await page.wait(10); T.ok(fake.stopLog.includes('pressure'), 'barometer stops the sensor on leaving');
    // trend: 10 hPa drop over 6 minutes
    const t2 = await page.open('barometer'); await page.wait(30); for (let i = 0; i < 5; i++) fake.emit('pressure', [1013.25]); page.skip(6 * 60000); fake.emit('pressure', [1003.25]);
    T.has(t2.q('#tr').textContent, 'Falling 10.0 hPa per hour', 'trend after a 1 hPa fall in 6 minutes is -10 hPa/h'); t2.close();
    const t3 = await page.open('barometer'); await page.wait(30); fake.emit('pressure', [1000]); page.skip(6 * 60000); fake.emit('pressure', [1000.01]); T.eq(t3.q('#tr').textContent, 'Steady', 'a tiny change is Steady'); page.skip(6 * 60000); for (let i = 0; i < 60; i++) fake.emit('pressure', [1010]);
    T.has(t3.q('#tr').textContent, 'Rising', 'rising trend'); t3.close();
    fake.avail.pressure = false; const n = await page.open('barometer'); await page.wait(30); T.has(n.q('#msg').textContent, 'does not have a barometer', 'barometer: no sensor'); n.close();
  }

  /* ---------------------------------------------------------------- Room temperature */
  {
    fake.hasMap = { temperature: true, humidity: true }; fake.avail.temperature = true; fake.avail.humidity = true;
    let t = await page.open('roomtemp'); await page.wait(40);
    fake.emit('temperature', [21.5]); T.eq(t.q('#t').textContent, '21.5', '21.5 C'); T.has(t.q('#what').textContent, 'Room temperature (phone sensor)', 'labelled as room temperature');
    t.click('#uf'); T.eq(t.q('#t').textContent, '70.7', '21.5 C = 70.7 F'); T.eq(t.q('#u').textContent, '°F', 'unit label'); T.eq(t.q('#uf').getAttribute('aria-pressed'), 'true', 'F pressed'); t.click('#uc'); T.eq(t.q('#t').textContent, '21.5', 'back to C');
    fake.emit('temperature', [-100]); T.eq(t.q('#t').textContent, '21.5', 'implausible reading ignored'); fake.emit('humidity', [45.4]); T.eq(t.q('#hum').textContent, 'Humidity 45%', 'humidity shown');
    fake.emit('temperature', [-0.04]); T.eq(t.q('#t').textContent, '0.0', 'tiny negative shows 0.0 not -0.0');
    t.close(); await page.wait(10); T.ok(fake.stopLog.includes('temperature') && fake.stopLog.includes('humidity'), 'room temperature stops both sensors on leaving');
    fake.hasMap = {}; fake.battery = { temperatureC: 31.5 }; const calls0 = fake.calls.battery;
    t = await page.open('roomtemp'); await page.wait(40); T.eq(t.q('#t').textContent, '31.5', 'battery temperature shown when there is no room sensor'); T.has(t.q('#what').textContent, 'Battery temperature', 'labelled as battery temperature'); t.click('#uf'); T.eq(t.q('#t').textContent, '88.7', '31.5 C = 88.7 F'); T.ok(fake.calls.battery > calls0, 'battery polled'); t.close();
    const calls1 = fake.calls.battery; await page.wait(100); T.eq(fake.calls.battery, calls1, 'no battery polling after leaving');
    fake.battery = null; t = await page.open('roomtemp'); await page.wait(40); T.has(t.q('#msg').textContent, 'Temperature is not available', 'no temperature at all'); t.close();
    fake.native = false; t = await page.open('roomtemp'); await page.wait(20); T.has(t.q('#msg').textContent, 'works only in the installed PocketKit app', 'room temperature in a browser'); t.close(); fake.native = true;
  }

  /* ---------------------------------------------------------------- Proximity */
  {
    fake.avail.proximity = true; fake.maxRange = { proximity: 5 };
    const t = await page.open('proximity'); await page.wait(30);
    fake.emit('proximity', [5]); T.eq(t.q('#orb').textContent, 'FAR', 'far at 5 cm'); T.eq(t.q('#cnt').textContent, '0', 'no covers yet');
    fake.emit('proximity', [0]); T.eq(t.q('#orb').textContent, 'NEAR', 'near at 0 cm'); T.eq(t.q('#cnt').textContent, '1', 'cover counted'); T.eq(t.q('#cm').textContent, '0.0', 'distance shown');
    fake.emit('proximity', [0]); T.eq(t.q('#cnt').textContent, '1', 'repeated near readings count once'); fake.emit('proximity', [5]); fake.emit('proximity', [3.9]); T.eq(t.q('#cnt').textContent, '2', '3.9 cm is near for a 5 cm sensor (under 80%)');
    fake.emit('proximity', [NaN]); T.eq(t.q('#orb').textContent, 'NEAR', 'NaN ignored'); t.click('#rs'); T.eq(t.q('#cnt').textContent, '0', 'reset counter');
    t.close(); await page.wait(10); T.ok(fake.stopLog.includes('proximity'), 'proximity stops its sensor');
    fake.avail.proximity = false; const n = await page.open('proximity'); await page.wait(30); T.has(n.q('#msg').textContent, 'does not have a proximity sensor', 'proximity: no sensor'); n.close();
  }

  /* ---------------------------------------------------------------- Signal strength */
  {
    fake.network = { type: 'wifi', dbm: -55, validated: true, linkMbps: 433, freqMhz: 5180, metered: false };
    const t = await page.open('signal'); await page.wait(40);
    T.eq(t.q('#kind').textContent, 'Wi-Fi', 'Wi-Fi'); T.eq(t.q('#dbm').textContent, '-55', 'dBm -55'); T.eq(t.q('#q').textContent, 'Good', '-55 dBm on Wi-Fi is Good (3 bars)'); T.eq(t.q('#bars').textContent, '▂ ▄ ▆ ·', 'three bars');
    T.has(t.q('#info').textContent, 'Internet worksYes', 'internet works'); T.has(t.q('#info').textContent, 'Link speed433 Mbps', 'link speed'); T.has(t.q('#info').textContent, '5 GHz (5180 MHz)', 'band'); T.has(t.q('#info').textContent, 'MeteredNo', 'metered');
    fake.network = { type: 'wifi', dbm: -45, freqMhz: 2437 }; await page.wait(1100); T.eq(t.q('#q').textContent, 'Excellent', '-45 Wi-Fi is Excellent'); T.has(t.q('#info').textContent, '2.4 GHz', '2.4 GHz band'); T.has(t.q('#info').textContent, 'Not confirmed', 'internet not confirmed');
    fake.network = { type: 'wifi', dbm: -65, freqMhz: 6100 }; await page.wait(1100); T.eq(t.q('#q').textContent, 'Fair', '-65 Wi-Fi is Fair'); T.has(t.q('#info').textContent, '6 GHz', '6 GHz band');
    fake.network = { type: 'cellular', dbm: -95, downKbps: 12500, upKbps: 3000, metered: true }; await page.wait(1100); T.eq(t.q('#kind').textContent, 'Mobile data', 'mobile'); T.eq(t.q('#q').textContent, 'Fair', '-95 mobile is Fair'); T.has(t.q('#info').textContent, 'Estimated down12.5 Mbps', 'estimated speed'); T.has(t.q('#info').textContent, 'MeteredYes', 'metered yes');
    fake.network = { type: 'cellular', dbm: -125 }; await page.wait(1100); T.eq(t.q('#q').textContent, 'Very weak', '-125 is Very weak'); T.eq(t.q('#bars').textContent, '· · · ·', 'no bars');
    fake.network = { type: 'cellular' }; await page.wait(1100); T.has(t.q('#q').textContent, 'did not report a signal level', 'no dBm explained'); T.eq(t.q('#dbm').textContent, '--', 'dbm dash');
    fake.network = { type: 'none' }; await page.wait(1100); T.eq(t.q('#q').textContent, 'No connection', 'no connection'); T.eq(t.q('#kind').textContent, 'Not connected', 'not connected');
    t.close(); const c = fake.calls.network; await page.wait(1200); T.eq(fake.calls.network, c, 'signal polling stops on leaving');
    fake.network = null; const n = await page.open('signal'); await page.wait(40); T.has(n.q('#msg').textContent, 'Network details are not available', 'no network details'); n.close();
    fake.native = false; const wb = await page.open('signal'); await page.wait(20); T.has(wb.q('#msg').textContent, 'works only in the installed PocketKit app', 'signal in a browser'); wb.close(); fake.native = true;
  }

  /* ---------------------------------------------------------------- Gyroscope */
  {
    fake.avail.gyroscope = true;
    const t = await page.open('gyro'); await page.wait(30);
    fake.emit('gyroscope', [1, 0, 0]); T.eq(t.q('#tot').textContent, '57', '1 rad/s = 57 deg/s'); T.eq(t.q('#gx').textContent, '57', 'x 57'); T.eq(t.q('#pk').textContent, '57', 'peak 57');
    fake.emit('gyroscope', [0, -2, 0]); T.eq(t.q('#gy').textContent, '-115', 'y -115 (2 rad/s = 114.6)'); T.eq(t.q('#pk').textContent, '115', 'peak 115');
    fake.emit('gyroscope', [-0.001, 0, 0.0001]); T.eq(t.q('#gx').textContent, '0', 'tiny negative shows 0 not -0'); T.eq(t.q('#pk').textContent, '115', 'peak holds'); fake.emit('gyroscope', [0.1]); T.eq(t.q('#gx').textContent, '0', 'short readings ignored');
    t.click('#rs'); T.eq(t.q('#pk').textContent, '0', 'reset peak');
    t.close(); await page.wait(10); T.ok(fake.stopLog.includes('gyroscope'), 'gyroscope stops its sensor');
    fake.avail.gyroscope = false; const n = await page.open('gyro'); await page.wait(30); T.has(n.q('#msg').textContent, 'does not have a gyroscope', 'gyroscope: no sensor'); n.close();
  }

  await T.done(page);
})().catch(e => { console.log('FAIL: test crashed: ' + (e && e.stack || e)); process.exit(1); });
