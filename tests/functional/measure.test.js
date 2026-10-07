'use strict';
/* Functional tests for the Measure group (www/js/tools/measure.js): known answers computed independently of the tool code. */
const { boot } = require('./mh-fakes');
const { suite } = require('../helpers/page');
const D = Math.PI / 180;

(async () => {
  const T = suite('measure'), page = await boot(), G = page.G;
  const elev = (deg) => ({ x: 0, y: G * Math.sin(deg * D), z: G * Math.cos(deg * D) });

  /* ---------------------------------------------------------------- Speed calculator */
  {
    const t = await page.open('speedcalc');
    T.has(t.text(), '100.00 km/h', 'speedcalc default: 100 km in 1 h = 100.00 km/h');
    T.has(t.text(), '27.78 m/s', 'speedcalc shows m/s (100 km/h = 27.78)');
    T.has(t.text(), '62.14 mph', 'speedcalc shows mph');
    T.has(t.text(), '54.00 knots', 'speedcalc shows knots');
    T.has(t.text(), 'pace 36 s per km', 'speedcalc pace 36 s per km at 100 km/h');
    t.type('#d', '42.195'); t.type('#th', '3'); t.type('#tm', '30');
    T.has(t.text(), '12.06 km/h', 'marathon in 3:30 = 12.06 km/h');
    t.select('#su', 'mph'); T.has(t.text(), '7.49 mph', 'speed result follows the chosen unit (12.0557 km/h = 7.49 mph)');
    t.select('#du', 'mi'); t.type('#d', '26.2'); t.type('#th', '4'); t.type('#tm', '0');
    T.has(t.text(), '6.55 mph', '26.2 miles in 4 h = 6.55 mph');
    t.type('#th', '0'); t.type('#tm', '0'); t.type('#ts', '0');
    T.has(t.q('#res').textContent, '--', 'zero time gives no speed (no divide by zero)');
    t.clickText('Distance'); t.select('#su', 'kmh'); t.type('#s', '60'); t.type('#th', '1'); t.select('#du', 'km');
    T.has(t.q('#res').textContent, '60.00 km', 'distance mode: 60 km/h for 1 h = 60 km');
    t.type('#tm', '30'); T.has(t.q('#res').textContent, '90.00 km', 'distance mode with 1 h 30 min = 90 km');
    t.select('#du', 'mi'); T.has(t.q('#res').textContent, '55.92 mi', '90 km = 55.92 mi');
    t.clickText('Time'); t.select('#du', 'km'); t.type('#d', '100'); t.select('#su', 'kmh'); t.type('#s', '50');
    T.has(t.q('#res').textContent, '2 h 0 min 0 s', 'time mode: 100 km at 50 km/h = 2 h');
    t.type('#s', '0'); T.has(t.q('#res').textContent, '--', 'time mode: zero speed gives no time');
    t.type('#s', '-5'); T.has(t.q('#res').textContent, '--', 'time mode: negative speed gives no time');
    t.close();
  }

  /* ---------------------------------------------------------------- Shadow height */
  {
    const t = await page.open('shadowheight');
    T.has(t.q('#res').textContent, '15.00 m', 'shadow: stick 1 / shadow 0.8, object shadow 12 = 15 m');
    t.type('#os', '9.6'); T.has(t.q('#res').textContent, '12.00 m', 'shadow 9.6 gives 12.00 m');
    t.clickText('feet'); T.has(t.q('#res').textContent, '12.00 ft', 'unit toggle relabels the answer');
    t.type('#rs', '0'); T.has(t.q('#res').textContent, '--', 'zero stick shadow gives no result');
    t.type('#rs', ''); T.has(t.q('#res').textContent, '--', 'empty field gives no result');
    t.type('#rs', '2'); t.type('#rh', '1.8'); t.type('#os', '25'); T.has(t.q('#res').textContent, '22.50 ft', '1.8 stick, 2 shadow, 25 object = 22.5');
    t.close();
  }

  /* ---------------------------------------------------------------- Stride and pace */
  {
    const t = await page.open('pacecalc');
    t.type('#sn', '28');
    T.has(t.q('#sl').textContent, '0.71 m', 'step length = 20 m / 28 steps = 0.71 m');
    t.type('#sl2', '0.75'); T.has(t.q('#sdist').textContent, '7.50 km  (7500 m)', '10000 steps at 0.75 m = 7.5 km');
    T.has(t.q('#pp').textContent, '6:00', 'pace 5 km in 30 min = 6:00 per km');
    T.has(t.q('#pk').textContent, '10.0', 'speed 5 km in 30 min = 10.0 km/h');
    t.type('#pd', '10'); t.type('#pm', '47.5'); T.has(t.q('#pp').textContent, '4:45', '10 km in 47.5 min = 4:45 per km');
    t.type('#pm', '0'); T.has(t.q('#pp').textContent, '--', 'zero minutes gives no pace');
    t.click('#sv');
    T.near(page.store('pace.step', 0), 0.714, 0.0006, 'Save stores the step length (20/28 = 0.714)');
    t.close();
    const t2 = await page.open('pacecalc');
    T.near(parseFloat(t2.value('#sl2')), 0.714, 0.01, 'saved step length comes back when the tool reopens');
    t2.type('#sn', '0'); t2.click('#sv'); T.near(page.store('pace.step', 0), 0.714, 0.0006, 'Save with no steps keeps the old value');
    t2.close();
  }

  /* ---------------------------------------------------------------- Unit price */
  {
    const t = await page.open('unitprice');
    T.has(t.q('#best').textContent, 'Fill in at least two', 'unit price empty state');
    t.type('#p0', '2'); t.type('#q0', '500'); t.select('#u0', 'g');
    t.type('#p1', '3'); t.type('#q1', '1'); t.select('#u1', 'kg');
    T.has(t.q('#o0').textContent, '0.400 per 100 g', 'A: 2.00 per 500 g = 0.400 per 100 g');
    T.has(t.q('#o1').textContent, '0.300 per 100 g', 'B: 3.00 per 1 kg = 0.300 per 100 g');
    T.has(t.q('#best').textContent, 'Best value: product B, 25% cheaper', 'B is the best value, 25% cheaper');
    t.select('#u1', 'ml'); T.has(t.q('#best').textContent, 'cannot be compared', 'weight vs volume is refused');
    t.select('#u1', 'lb'); t.type('#q1', '2');
    T.has(t.q('#o1').textContent, '0.331 per 100 g', '3.00 per 2 lb = 0.331 per 100 g (907.184 g)');
    t.select('#u0', 'pc'); t.select('#u1', 'pc'); t.type('#q0', '12'); t.type('#q1', '10');
    T.has(t.q('#o0').textContent, '0.167 per piece', 'per piece 2/12');
    t.type('#p2', '1'); t.type('#q2', '10'); t.select('#u2', 'pc');
    T.has(t.q('#best').textContent, 'Best value: product C', 'three products: C (0.1 each) wins');
    t.type('#p2', '0'); T.has(t.q('#o2').textContent, '--', 'zero price gives no per-unit price');
    t.close();
  }

  /* ---------------------------------------------------------------- Height finder (fake accelerometer) */
  {
    page.noMotionApi();
    const n = await page.open('heightfinder'); T.has(n.text(), 'No motion sensor found', 'height finder: no sensor message'); n.close();
    page.motionApi(() => Promise.resolve('denied'));
    const dn = await page.open('heightfinder'); await page.wait(20); T.has(dn.text(), 'Motion permission denied', 'height finder: permission denied message'); dn.close();
    page.motionApi();
    const t = await page.open('heightfinder');
    T.eq(page.live('devicemotion'), 1, 'height finder listens to the motion sensor');
    page.motion(elev(45), null, 60);
    T.has(t.q('#deg').textContent, '45.0', 'reads 45.0 degrees');
    t.click('#mt'); T.has(t.text(), 'Top: 45.0°', 'top marked at 45');
    t.type('#dst', '20'); T.has(t.q('#res').textContent, '21.6 m', 'eye 1.6 + 20 x tan45 = 21.6 m');
    t.clickText('Mark base');  // no base reading yet: marks the current (45 deg) angle, which is invalid for height with base
    t.click('#rs'); T.has(t.q('#res').textContent, '--', 'clear marks resets the result');
    page.motion(elev(-Math.atan(0.08) / D), null, 80);
    t.click('#mb'); page.motion(elev(45), null, 80); t.click('#mt'); t.type('#dst', '');
    T.has(t.q('#res').textContent, '21.6 m', 'with base mark: distance = 1.6 / tan(4.57 deg) = 20, height 21.6 m');
    T.has(t.q('#sub').textContent, 'Distance 20.0 m', 'distance is shown');
    t.clickText('feet');
    T.has(t.q('#eye').value, '5.25', 'eye height converts to feet (1.6 m = 5.25 ft)');
    t.type('#eye', '0'); t.click('#rs'); t.click('#mt'); t.type('#dst', '10');
    T.has(t.q('#res').textContent, '--', 'zero eye height without base gives no result');
    t.close();
    T.eq(page.live('devicemotion'), 0, 'height finder removes its motion listener on leaving');
  }

  /* ---------------------------------------------------------------- Distance finder */
  {
    const t = await page.open('distancefinder'); T.eq(t.value('#eye'), '5.25', 'eye height and unit are remembered from the Height Finder (feet)'); t.clickText('metres'); T.eq(t.value('#eye'), '1.6', 'switching back to metres converts the remembered eye height');
    page.motion(elev(-10), null, 80);
    T.has(t.q('#deg').textContent, '-10.0', 'reads -10 degrees');
    T.has(t.q('#res').textContent, '9.1 m', 'eye 1.6 m, 10 deg down: 9.07 m');
    t.type('#eye', '1.8'); page.motion(elev(-45), null, 80);
    T.has(t.q('#res').textContent, '1.8 m', 'eye 1.8, 45 deg: 1.8 m');
    t.click('#hold'); page.motion(elev(-20), null, 80);
    T.has(t.q('#res').textContent, '1.8 m', 'held angle stays');
    t.click('#rel'); T.has(t.q('#res').textContent, '4.9 m', 'live again: 1.8 / tan20 = 4.95 m');
    page.motion(elev(5), null, 80); T.has(t.q('#res').textContent, '--', 'aiming up gives no distance');
    t.close();
    T.eq(page.live('devicemotion'), 0, 'distance finder removes listener');
  }

  /* ---------------------------------------------------------------- Slope finder */
  {
    const t = await page.open('slope');
    page.motion(elev(20), null, 80);
    T.has(t.q('#deg').textContent, '20.0', 'lay-flat 20 degrees');
    T.has(t.q('#pc').textContent, '36.4%', 'tan 20 = 36.4 percent');
    T.has(t.q('#ra').textContent, '1:2.7', 'ratio 1:2.7');
    T.has(t.q('#p12').textContent, '4.4', 'pitch 4.4 per 12');
    page.motion({ x: 0, y: 0, z: G }, null, 120);
    T.has(t.q('#ra').textContent, 'flat', 'flat reading says flat');
    page.motion({ x: 0, y: 0, z: -G }, null, 120);
    T.has(t.q('#deg').textContent, '0.0', 'face-down flat folds to 0 degrees');
    page.motion(elev(26.565), null, 120); t.click('#hold');
    page.motion(elev(5), null, 120);
    T.has(t.q('#pc').textContent, '50.0%', 'hold keeps 50 percent (tan 26.565)');
    T.has(t.q('#hold').textContent, 'Release', 'hold button turns into Release');
    t.click('#hold'); T.has(t.q('#pc').textContent, '8.', 'release goes live again');
    t.click('#zero'); page.motion(elev(5), null, 120); T.has(t.q('#deg').textContent, '0.0', 'Zero here');
    t.clickText('Sight along edge'); page.motion(elev(-30), null, 120);
    T.has(t.q('#deg').textContent, '-30.0', 'sight mode shows -30 for downhill');
    t.close(); T.eq(page.live('devicemotion'), 0, 'slope removes listener');
  }

  /* ---------------------------------------------------------------- things the tools remember */
  {
    const a = await page.open('speedcalc'); a.clickText('Time'); a.select('#du', 'mi'); a.select('#su', 'mph'); a.close();
    const b = await page.open('speedcalc'); T.eq(b.value('#du'), 'mi', 'speed calc remembers the distance unit'); T.eq(b.value('#su'), 'mph', 'speed calc remembers the speed unit'); T.eq(b.q('#md [aria-pressed=true]').dataset.v, 'time', 'speed calc remembers the mode');
    T.eq(b.q('#gt').style.display, 'none', 'and hides the time fields in time mode'); b.close();
    const c = await page.open('unitprice'); c.select('#u0', 'oz'); c.select('#u2', 'floz'); c.close();
    const d = await page.open('unitprice'); T.eq(d.value('#u0'), 'oz', 'unit price remembers unit A'); T.eq(d.value('#u2'), 'floz', 'unit price remembers unit C'); d.close();
    const e = await page.open('heightfinder'); e.clickText('feet'); e.type('#eye', '6'); e.close();
    T.near(page.store('measure.eye', {}).m, 1.829, 0.001, 'eye height is stored in metres (6 ft = 1.829 m)');
    const f = await page.open('heightfinder'); T.eq(f.value('#eye'), '6', 'height finder shows 6 ft again'); T.eq(f.q('#eye').max, '33', 'feet allow up to 33 ft of eye height'); T.has(f.text(), 'Eye height (ft)', 'label follows the unit'); f.clickText('metres'); T.eq(f.q('#eye').max, '10', 'metres limit back to 10'); f.close();
    const g = await page.open('rpm'); g.q('#pad').click(); g.q('#pad').click(); T.eq(g.q('#n').textContent, '2', 'RPM pad works from the keyboard (click without a pointer)'); g.close();
    const h = await page.open('reaction'); h.q('#pad').click(); T.has(h.q('#pad').textContent, 'Wait for green', 'reaction pad works from the keyboard'); h.close();
  }

  await T.done(page);
})().catch(e => { console.log('FAIL: test crashed: ' + (e && e.stack || e)); process.exit(1); });
