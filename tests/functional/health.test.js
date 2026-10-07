'use strict';
/* Functional tests for the Health group, part 1: calculators and their pure maths (www/js/tools/health.js). Expected values are computed here independently. */
const { boot } = require('./mh-fakes');
const { suite } = require('../helpers/page');
global.Tools = { register() {} };
const H = require('../../www/js/tools/health.js');

const dkey = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const shift = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
const fd = (d) => d.toLocaleDateString([], { day: 'numeric', month: 'short' });

(async () => {
  const T = suite('health'), page = await boot(), w = page.w;
  const toast = () => w.document.querySelector('#toast').textContent;

  /* ---------------------------------------------------------------- pure maths */
  T.near(H.bmiOf(70, 1.75), 22.857, 0.001, 'bmiOf'); T.eq(H.bmiOf(0, 1.7), null, 'bmiOf zero weight'); T.eq(H.bmiOf(70, 0), null, 'bmiOf zero height');
  T.eq(H.bmiCat(15.99).label, 'Severely underweight', 'bmi 15.99'); T.eq(H.bmiCat(16).label, 'Underweight', 'bmi 16'); T.eq(H.bmiCat(18.5).label, 'Healthy weight', 'bmi 18.5');
  T.eq(H.bmiCat(24.99).label, 'Healthy weight', 'bmi 24.99'); T.eq(H.bmiCat(25).label, 'Overweight', 'bmi 25'); T.eq(H.bmiCat(30).label, 'Obese (class I)', 'bmi 30'); T.eq(H.bmiCat(35).label, 'Obese (class II+)', 'bmi 35');
  T.eq(H.bmr('m', 75, 175, 30), 1698.75, 'Mifflin-St Jeor male 30y 175cm 75kg'); T.eq(H.bmr('f', 60, 165, 25), 10 * 60 + 6.25 * 165 - 125 - 161, 'Mifflin female');
  T.eq(H.sleepTimes(7 * 60, 'wake').map(s => s.at).join(), [1305, 1395, 45, 135].join(), 'sleep: wake 07:00 means bed 21:45, 23:15, 00:45, 02:15');
  T.eq(H.sleepTimes(23 * 60, 'bed').map(s => s.at).join(), [495, 405, 315, 225].join(), 'sleep: bed 23:00 means wake 08:15, 06:45, 05:15, 03:45');
  T.eq(H.sleepTimes(30, 'wake', [6]).map(s => s.at).join(), String(((30 - 555) % 1440 + 1440) % 1440), 'sleep wraps past midnight');
  const m1 = H.macros(2000, 40, 30, 30); T.near(m1.carbs, 200, 1e-9, 'macros carbs 200 g'); T.near(m1.protein, 150, 1e-9, 'macros protein 150 g'); T.near(m1.fat, 66.667, 0.001, 'macros fat 66.7 g');
  T.near(H.navyBodyFat('m', 180, 90, 40), 18.38, 0.02, 'Navy male 180/90/40 = 18.4'); T.eq(H.navyBodyFat('m', 180, 40, 40), null, 'Navy: waist = neck refused');
  T.eq(H.navyBodyFat('f', 165, 75, 32, 0), null, 'Navy female without hip is refused');
  {
    const f = H.navyBodyFat('f', 165, 75, 32, 100), expect = 495 / (1.29579 - 0.35004 * Math.log10(75 + 100 - 32) + 0.221 * Math.log10(165)) - 450;
    T.near(f, expect, 1e-9, 'Navy female formula');
  }
  T.eq(H.whrOf(80, 100), 0.8, 'whr'); T.eq(H.whrOf(0, 100), null, 'whr zero waist');
  T.eq(H.whrRisk('m', 0.9).label, 'At or below the WHO cut-off', 'whr man 0.90'); T.eq(H.whrRisk('m', 0.91).col, 'var(--danger)', 'whr man 0.91 above');
  T.eq(H.whrRisk('f', 0.85).label, 'At or below the WHO cut-off', 'whr woman 0.85'); T.ok(/Above/.test(H.whrRisk('f', 0.86).label), 'whr woman 0.86 above');
  {
    const p = [{ name: 'in', sec: 4 }, { name: 'hold', sec: 4 }, { name: 'out', sec: 4 }, { name: 'hold2', sec: 4 }];
    T.eq(H.phaseAt(p, 0).i, 0, 'phase at 0'); T.eq(H.phaseAt(p, 3.9).i, 0, 'phase 3.9'); T.eq(H.phaseAt(p, 4).i, 1, 'phase at 4'); T.eq(H.phaseAt(p, 15.9).i, 3, 'phase 15.9');
    T.eq(H.phaseAt(p, 16).i, 0, 'cycle wraps at 16'); T.near(H.phaseAt(p, 18).left, 2, 1e-9, 'time left in phase'); T.eq(H.phaseAt([], 5), null, 'empty pattern');
    const s = H.hiitSchedule(20, 10, 3, 5); T.eq(s.map(x => x.name + x.sec).join(), 'Get ready5,Work20,Rest10,Work20,Rest10,Work20', 'HIIT schedule has no rest after the last round');
    T.eq(H.hiitSchedule(30, 0, 2, 0).map(x => x.name).join(), 'Work,Work', 'no rest, no prep');
  }
  {
    const e = H.dueDate(new Date(2026, 0, 1, 12), 28, new Date(2026, 0, 1, 12)); T.eq(H.dkey(e.edd), '2026-10-08', 'Naegele: LMP 2026-01-01 -> 2026-10-08');
    T.eq(H.dkey(H.dueDate(new Date(2026, 0, 1, 12), 35, new Date(2026, 0, 1, 12)).edd), '2026-10-15', '35 day cycle adds 7 days');
    T.eq(H.dkey(H.dueDate(new Date(2026, 0, 1, 12), 99, new Date(2026, 0, 1, 12)).edd), '2026-10-25', 'cycle is clamped to 45 days (+17)');
    const d = H.dueDate(new Date(2026, 0, 1, 12), 28, new Date(2026, 3, 11, 12)); T.eq(d.days, 100, '100 days'); T.eq(d.weeks + 'w' + d.rem + 'd', '14w2d', '14 weeks 2 days'); T.eq(d.tri, 2, 'trimester 2'); T.eq(d.left, 180, '180 days left');
    T.eq(H.dueDate(new Date(2026, 0, 1, 12), 28, new Date(2026, 3, 1, 12)).tri, 1, 'day 90 is still trimester 1'); T.eq(H.dueDate(new Date(2026, 0, 1, 12), 28, new Date(2026, 3, 2, 12)).tri, 2, 'day 91 starts trimester 2');
    T.eq(H.dueDate(new Date(2026, 0, 1, 12), 28, new Date(2026, 6, 9, 12)).tri, 3, 'day 189 starts trimester 3');
  }
  {
    const p = H.periodPredict(['2026-01-01', '2026-01-29', '2026-02-26'], new Date(2026, 1, 28, 12)); T.eq(p.cycle, 28, 'learned cycle 28'); T.eq(H.dkey(p.next), '2026-03-26', 'next period');
    T.eq(H.dkey(p.ovulation), '2026-03-12', 'ovulation 14 days before'); T.eq(H.dkey(p.fertileFrom), '2026-03-07', 'fertile from'); T.eq(H.dkey(p.fertileTo), '2026-03-13', 'fertile to'); T.eq(p.day, 3, 'cycle day 3');
    T.eq(H.periodPredict(['2026-01-01', '2026-01-11', '2026-01-21'], new Date(2026, 1, 1, 12)).cycle, 28, 'gaps under 18 days are ignored');
    T.eq(H.periodPredict(['2026-01-01', '2026-01-31', '2026-03-02'], new Date(2026, 3, 1, 12)).cycle, 30, 'average of 30 and 30'); T.eq(H.periodPredict([], new Date()), null, 'no data');
  }
  T.eq(H.streakOf(['2026-03-01', '2026-03-02', '2026-03-03'], '2026-03-03'), 3, 'streak ending today'); T.eq(H.streakOf(['2026-03-01', '2026-03-02'], '2026-03-03'), 2, 'streak ending yesterday still counts');
  T.eq(H.streakOf(['2026-03-01'], '2026-03-03'), 0, 'streak broken'); T.eq(H.streakOf(['2026-02-28', '2026-03-01', '2026-03-02'], '2026-03-02'), 3, 'streak across month end');
  T.eq(H.streakOf(['2024-02-28', '2024-02-29', '2024-03-01'], '2024-03-01'), 3, 'streak across a leap day');
  T.eq(H.csvText('=1+1'), "'=1+1", 'csv formula guard'); T.eq(H.csvText('plain'), 'plain', 'csv plain'); T.eq(H.csvText(null), '', 'csv null');
  {
    const rows = H.healthRows([{ id: 2, type: 'bp', v: 120, v2: 80, date: '2026-02-01', note: '' }, { id: 1, type: 'weight', v: 70, date: '2026-01-01', note: '=x' }, { id: 3, type: 'custom', name: 'Temp', unit: '°C', v: 36.6, date: '2026-02-01', note: 'a' }]);
    T.eq(rows[0].join('|'), 'Date|Measure|Value|Value 2 (diastolic)|Unit|Note', 'health csv header'); T.eq(rows[1].join('|'), "2026-01-01|Weight|70||kg|'=x", 'weight row first by date, note guarded');
    T.eq(rows[2].join('|'), '2026-02-01|Blood pressure|120|80|mmHg|', 'bp row'); T.eq(rows[3].join('|'), '2026-02-01|Temp|36.6||°C|a', 'custom row');
  }
  {
    const wr = H.waterRows({ '2026-01-02': 500, '2026-01-01': 0, 'bad': 5, '2026-01-03': 2000 }, 2000);
    T.eq(wr.map(r => r.join('|')).join(';'), 'Date|Water (ml)|Goal (ml);2026-01-02|500|2000;2026-01-03|2000|2000', 'water rows skip zero and bad keys');
    T.eq(H.stepsRows({ '2026-01-01': 10000 }, 8000, 180, 70)[1].join('|'), '2026-01-01|10000|8000|7.47|399', 'steps row: 10000 steps at 180 cm = 7.47 km, 399 kcal at 70 kg');
    T.eq(H.moodRows({ '2026-01-01': { m: 3, n: '+bad' }, '2026-01-02': { m: 99 } }).map(r => r.join('|')).join(';'), "Date|Mood|Score (1-5)|Note;2026-01-01|Good|4|'+bad;2026-01-02|Okay|3|", 'mood rows tolerate bad values');
  }
  {
    // PPG: 30 fps, 20 s, heartbeat plus slow drift and deterministic noise
    const sig = (bpm, secs, noise) => { const fs = 30, out = []; for (let i = 0; i < fs * secs; i++) { const t = i / fs; out.push(150 + 8 * t / secs * 5 + 2 * Math.sin(2 * Math.PI * bpm / 60 * t) + noise * Math.sin(i * 12.9898) * 0.5); } return out; };
    for (const bpm of [48, 72, 100, 150]) { const r = H.ppgBpm(sig(bpm, 20, 0.2), 30); T.ok(r && Math.abs(r.bpm - bpm) <= 2.5, 'ppgBpm recovers ' + bpm + ' bpm (got ' + (r && r.bpm.toFixed(1)) + ')'); }
    T.eq(H.ppgBpm(new Array(600).fill(150), 30), null, 'a flat signal gives no pulse'); T.eq(H.ppgBpm(sig(72, 5, 0), 30), null, 'under 8 seconds gives no pulse');
    const noisy = []; for (let i = 0; i < 600; i++) noisy.push(150 + 3 * Math.sin(i * 12.9898) * Math.cos(i * 78.233)); const rn = H.ppgBpm(noisy, 30); T.ok(rn === null || rn.quality < 0.6, 'pure noise has no confident pulse (quality ' + (rn && rn.quality.toFixed(2)) + ')');
    const ts = [], vs = []; for (let i = 0; i < 400; i++) { const t = i * 33 + (i % 3) * 7; ts.push(t); vs.push(150 + 2 * Math.sin(2 * Math.PI * 1.2 * t / 1000)); }
    const rs = H.resample(ts, vs, 30); const r2 = H.ppgBpm(rs, 30); T.ok(r2 && Math.abs(r2.bpm - 72) <= 2.5, 'jittery timestamps are resampled before counting (got ' + (r2 && r2.bpm.toFixed(1)) + ')');
  }
  {
    // step detector on synthetic walking: 1.8 steps per second for 20 s, 50 Hz
    const walk = (hz, amp, secs) => { const d = H.StepDetector(); for (let i = 0; i < 50 * secs; i++) { const t = i * 20; d.feed(t, 0, 0, 9.8 + amp * Math.sin(2 * Math.PI * hz * t / 1000)); } return d.count; };
    const c = walk(1.8, 3, 20); T.ok(c >= 33 && c <= 38, '1.8 Hz walk for 20 s gives about 36 steps (got ' + c + ')');
    const c2 = walk(2.8, 4, 20); T.ok(c2 >= 52 && c2 <= 58, '2.8 Hz run gives about 56 steps (got ' + c2 + ')');
    T.eq(walk(1.8, 0.3, 20), 0, 'small shaking is not counted'); T.eq(walk(1.8, 0, 20), 0, 'a motionless phone counts nothing');
  }

  /* ---------------------------------------------------------------- BMI */
  {
    const t = await page.open('bmi');
    T.has(t.q('#b').textContent, '24.2', 'BMI default 170 cm 70 kg = 24.2'); T.has(t.q('#cat').textContent, 'Healthy weight', 'default category');
    t.type('#cm', '200');
    const cases = [[60, '15.0', 'Severely underweight'], [63.9, '16.0', 'Underweight'], [64, '16.0', 'Underweight'], [73.9, '18.5', 'Healthy weight'], [74, '18.5', 'Healthy weight'], [99.9, '25.0', 'Overweight'], [100, '25.0', 'Overweight'],
      [119.9, '30.0', 'Obese (class I)'], [120, '30.0', 'Obese (class I)'], [139.9, '35.0', 'Obese (class II+)'], [140, '35.0', 'Obese (class II+)']];
    for (const c of cases) { t.type('#kg', c[0]); T.eq(t.q('#b').textContent, c[1], 'BMI value at 200 cm / ' + c[0] + ' kg'); T.eq(t.q('#cat').textContent, c[2], 'BMI category at ' + c[0] + ' kg (shown ' + c[1] + ')'); }
    t.type('#kg', 80); T.has(t.q('#rng').textContent, '74.0 to 99.6 kg', 'healthy range for 200 cm');
    t.type('#cm', '0'); T.eq(t.value('#cm'), '50', 'zero height is adjusted to the 50 cm minimum, never a divide by zero'); t.type('#cm', '300'); T.eq(t.value('#cm'), '260', '300 cm is adjusted to the 260 cm maximum'); t.type('#cm', ''); T.eq(t.q('#b').textContent, '--', 'empty height gives no BMI');
    t.type('#cm', '170'); t.type('#kg', ''); T.eq(t.q('#b').textContent, '--', 'empty weight');
    t.clickText('Imperial'); t.type('#ft', '5'); t.type('#inch', '7'); t.type('#lb', '154');
    const m = 67 * 0.0254, kg = 154 * 0.45359237, bmi = kg / (m * m);
    T.eq(t.q('#b').textContent, bmi.toFixed(1), 'imperial 5 ft 7 in, 154 lb = ' + bmi.toFixed(1));
    T.has(t.q('#rng').textContent, (18.5 * m * m / 0.45359237).toFixed(0) + ' to ' + (24.9 * m * m / 0.45359237).toFixed(0) + ' lb', 'imperial healthy range in lb');
    t.close();
    const t2 = await page.open('bmi'); T.ok(t2.has('#ft'), 'the unit choice is remembered'); T.eq(t2.value('#lb'), '154', 'the weight is remembered'); t2.close();
  }

  /* ---------------------------------------------------------------- Calorie and BMR */
  {
    const t = await page.open('bmr');
    t.type('#age', '30'); t.type('#cm', '175'); t.type('#kg', '75'); t.select('#act', '1'); t.select('#gl', '2');
    T.eq(t.q('#bm').textContent, '1699', 'BMR male 30y 175 cm 75 kg = 1698.75'); T.eq(t.q('#td').textContent, String(Math.round(1698.75 * 1.375)), 'maintenance x1.375');
    T.eq(t.q('#tg').textContent, Math.round(1698.75 * 1.375).toLocaleString(), 'target = maintenance');
    t.select('#gl', '0'); T.eq(t.q('#tg').textContent, Math.round(1698.75 * 1.375 - 500).toLocaleString(), 'lose 0.5 kg a week = -500');
    t.select('#gl', '4'); T.eq(t.q('#tg').textContent, Math.round(1698.75 * 1.375 + 500).toLocaleString(), 'gain 0.5 kg a week = +500');
    t.select('#gl', '2'); t.select('#act', '4'); T.eq(t.q('#td').textContent, String(Math.round(1698.75 * 1.9)), 'very active x1.9');
    t.clickText('Female'); T.eq(t.q('#bm').textContent, '1533', 'female is 166 kcal lower: 1532.75');
    t.type('#age', '60'); t.type('#cm', '150'); t.type('#kg', '40'); t.select('#act', '0'); t.select('#gl', '0');
    T.has(t.q('#wn').textContent, 'below 1200', 'low female target warns about 1200 kcal');
    t.clickText('Male'); T.has(t.q('#wn').textContent, 'below 1500', 'low male target warns about 1500 kcal');
    t.type('#age', '5'); T.eq(t.value('#age'), '10', 'age 5 is adjusted to the minimum of 10');
    t.type('#age', ''); T.eq(t.q('#bm').textContent, '--', 'empty age gives no result'); T.has(t.q('#wn').textContent, 'Enter age 10 to 110', 'range message');
    t.close();
    const t2 = await page.open('bmr'); T.eq(t2.value('#cm'), '150', 'BMR inputs are remembered'); t2.close();
  }

  /* ---------------------------------------------------------------- Macros */
  {
    const t = await page.open('macros');
    t.type('#kc', '2000'); T.eq(t.q('#gc').textContent, '200 g', 'balanced carbs 200 g'); T.eq(t.q('#gp').textContent, '150 g', 'balanced protein 150 g'); T.eq(t.q('#gf').textContent, '67 g', 'balanced fat 66.7 -> 67 g');
    T.has(t.q('#pc').textContent, '40%', 'carb percentage label');
    t.clickText('Keto'); T.eq(t.q('#gc').textContent, '25 g', 'keto carbs 25 g'); T.eq(t.q('#gp').textContent, '125 g', 'keto protein 125 g'); T.eq(t.q('#gf').textContent, '156 g', 'keto fat 155.6 -> 156 g');
    t.clickText('High protein'); T.eq(t.q('#gp').textContent, '200 g', 'high protein 35/40/25: 200 g protein');
    t.clickText('Custom'); t.type('#rc', '50'); t.type('#rp', '30'); t.type('#rf', '30');
    T.has(t.q('#wn').textContent, 'add to 110%', 'custom percentages that do not add to 100 are explained');
    T.eq(t.q('#gc').textContent, Math.round(2000 * 50 / 110 / 4) + ' g', 'custom carbs scaled to 100%'); T.eq(t.q('#gf').textContent, Math.round(2000 * 30 / 110 / 9) + ' g', 'custom fat scaled');
    t.type('#rc', '0'); t.type('#rp', '0'); t.type('#rf', '0'); T.eq(t.q('#gc').textContent, '--', 'all zero percentages give no grams');
    t.type('#kc', '100'); T.eq(t.q('#gp').textContent, '--', 'below 500 kcal gives no grams');
    t.close();
  }

  /* ---------------------------------------------------------------- Body fat */
  {
    const t = await page.open('bodyfat');
    t.type('#cm', '180'); t.type('#nk', '40'); t.type('#wa', '90');
    T.eq(t.q('#bf').textContent, '18.4%', 'male 180/40/90 = 18.4%'); T.eq(t.q('#ct').textContent, 'Average', 'male 18.4% is Average (18 to 25)');
    t.type('#wa', '75'); { const v = 495 / (1.0324 - 0.19077 * Math.log10(35) + 0.15456 * Math.log10(180)) - 450; T.eq(t.q('#bf').textContent, v.toFixed(1) + '%', 'male waist 75 = ' + v.toFixed(1)); }
    t.type('#wa', '40'); T.eq(t.q('#bf').textContent, '--', 'waist equal to neck gives no result'); T.eq(t.q('#ct').textContent, '', 'no category');
    t.clickText('Female'); T.ok(t.q('#hw').style.display !== 'none', 'hip field appears for women');
    t.type('#cm', '165'); t.type('#nk', '32'); t.type('#wa', '75'); T.eq(t.q('#bf').textContent, '--', 'woman without hip gives no result');
    t.type('#hi', '100'); { const v = 495 / (1.29579 - 0.35004 * Math.log10(143) + 0.221 * Math.log10(165)) - 450; T.eq(t.q('#bf').textContent, v.toFixed(1) + '%', 'female result ' + v.toFixed(1)); T.eq(t.q('#ct').textContent, H.navyBodyFat && ({ 'Essential fat': 1, Athletic: 1, Fitness: 1, Average: 1, 'Above average': 1 }[t.q('#ct').textContent] ? t.q('#ct').textContent : '?'), 'a category is shown'); }
    t.close();
  }

  /* ---------------------------------------------------------------- Ideal weight */
  {
    const t = await page.open('idealweight');
    const iw = (male, cm) => { const o = Math.max(0, cm / 2.54 - 60); return male ? [50 + 2.3 * o, 52 + 1.9 * o, 56.2 + 1.41 * o, 48 + 2.7 * o] : [45.5 + 2.3 * o, 49 + 1.7 * o, 53.1 + 1.36 * o, 45.5 + 2.2 * o]; };
    const shown = (male, cm) => iw(male, cm).map(v => v.toFixed(1) + ' kg');
    let txt = t.text(); const lbl = ['Devine', 'Robinson', 'Miller', 'Hamwi'];
    shown(true, 175).forEach((s, i) => T.has(txt, lbl[i] + s, 'male 175 cm ' + lbl[i] + ' = ' + s));
    T.has(txt, '56.7 kg to 76.3 kg', 'healthy BMI range for 175 cm (18.5 and 24.9)');
    t.clickText('Female'); txt = t.text(); shown(false, 175).forEach((s, i) => T.has(txt, lbl[i] + s, 'female 175 cm ' + lbl[i] + ' = ' + s));
    t.type('#cm', '150'); T.has(t.text(), 'Devine45.5 kg', 'under 5 ft adds nothing: female Devine is 45.5 kg'); T.has(t.text(), 'Hamwi45.5 kg', 'female Hamwi base');
    t.type('#cm', '50'); T.eq(t.value('#cm'), '100', 'height below 100 cm is adjusted to 100'); t.type('#cm', ''); T.has(t.text(), 'Enter a height', 'empty height asks for a height');
    t.clickText('Imperial'); t.type('#ft', '5'); t.type('#inch', '9');
    const cm = 69 * 2.54; T.has(t.text(), 'Devine' + (iw(false, cm)[0] / 0.45359237).toFixed(0) + ' lb', 'imperial shows pounds'); t.close();
  }

  /* ---------------------------------------------------------------- Waist-hip ratio */
  {
    const t = await page.open('whr');
    const set = (wa, hi) => { t.type('#wa', wa); t.type('#hi', hi); return [t.q('#r').textContent, t.q('#rk').textContent]; };
    let r = set(80, 100); T.eq(r[0], '0.80', 'ratio 0.80'); T.has(r[1], 'At or below', 'man 0.80 is below the cut-off');
    r = set(90, 100); T.has(r[1], 'At or below', 'man exactly 0.90 is at the cut-off'); r = set(91, 100); T.has(r[1], 'Above the WHO cut-off', 'man 0.91 is above');
    t.clickText('Female'); r = set(85, 100); T.has(r[1], 'At or below', 'woman 0.85 at the cut-off'); r = set(86, 100); T.has(r[1], 'Above', 'woman 0.86 above');
    r = set(10, 100); T.eq(r[0], '--', 'implausible ratio 0.10 gives no result'); r = set(0, 100); T.eq(r[0], '--', 'zero waist'); r = set('', ''); T.eq(r[0], '--', 'empty');
    r = set(31.5, 39.4); T.eq(r[0], '0.80', 'inches work as well (ratio is unit free)'); t.close();
  }

  /* ---------------------------------------------------------------- Due date */
  {
    const t = await page.open('duedate');
    T.eq(t.q('#edd').textContent, '--', 'due date empty at first');
    t.type('#lm', '2026-01-01'); const oct = n => { const s = t.q('#edd').textContent; return s.includes('October ' + n + ', 2026') || s.includes(n + ' October 2026'); };
    T.ok(oct(8), 'LMP 2026-01-01 gives 8 October 2026');
    t.type('#cy', '35'); T.ok(oct(15), 'cycle 35 gives 15 October');
    t.type('#cy', '28'); t.type('#lm', dkey(shift(-100)));
    T.has(t.q('#wk').textContent, '14 weeks 2 days', '100 days = 14 weeks 2 days'); T.has(t.q('#tr').textContent, 'Trimester 2', 'trimester 2'); T.has(t.q('#lf').textContent, '180 days to go', '180 days to go');
    t.type('#lm', dkey(shift(-300))); T.has(t.q('#lf').textContent, '20 days past', '300 days = 20 days past'); T.has(t.q('#tr').textContent, 'Trimester 3', 'trimester 3');
    t.type('#lm', dkey(shift(10))); T.has(t.q('#wk').textContent, 'in the future', 'a future date is flagged'); T.eq(t.q('#pg').style.width, '0px', 'progress bar empty for a future date');
    t.type('#lm', dkey(shift(-10))); t.type('#lm', ''); T.eq(t.q('#edd').textContent, '--', 'clearing the date clears the result');
    t.type('#lm', '2026-01-01'); t.close();
    const t2 = await page.open('duedate'); T.eq(t2.value('#lm'), '2026-01-01', 'the last period date is remembered'); t2.close();
  }

  /* ---------------------------------------------------------------- Cycle tracker */
  {
    const t = await page.open('period');
    T.has(t.q('#in').textContent, 'Add the first day', 'cycle tracker empty state');
    [-84, -56, -28].forEach(n => { t.type('#dt', dkey(shift(n))); t.click('#add'); });
    T.eq(t.q('#cl').textContent, '28 d', 'learned cycle 28'); T.eq(t.q('#cd').textContent, '29', 'cycle day 29'); T.has(t.q('#in').textContent, 'expected today', 'next period expected today');
    T.has(t.q('#fw').textContent, fd(shift(-19)) + ' to ' + fd(shift(-13)), 'fertile window dates'); T.has(t.q('#fw').textContent, 'last 2 cycles', 'learned from 2 cycles');
    t.click('#add'); T.eq(t.all('#ls .item').length, 3, 'adding the same date twice does not duplicate');
    t.type('#dt', dkey(shift(5))); t.click('#add'); T.has(toast(), 'not in the future', 'a future start date is refused'); T.eq(t.all('#ls .item').length, 3, 'nothing added');
    t.type('#dt', ''); t.click('#add'); T.has(toast(), 'valid date', 'an empty date is refused');
    t.q('#ls .del').click(); T.eq(t.all('#ls .item').length, 2, 'delete removes a start date');
    t.close();
    const t2 = await page.open('period'); T.eq(t2.all('#ls .item').length, 2, 'dates are remembered'); t2.close();
    w.eval("Store.set('period.starts', ['" + dkey(shift(-100)) + "','" + dkey(shift(-90)) + "'])");
    const t3 = await page.open('period'); T.has(t3.q('#fw').textContent, 'Using a 28 day cycle', 'a 10 day gap is not learned'); T.has(t3.q('#in').textContent, 'days late', 'late period is flagged'); t3.close();
  }

  /* ---------------------------------------------------------------- Sleep calculator */
  {
    const t = await page.open('sleepcalc');
    const T12 = (m) => new Date(2000, 0, 1, Math.floor(m / 60), m % 60).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s+/g, ' ');
    let txt = t.text(); [1305, 1395, 45, 135].forEach(m => T.has(txt, T12(m), 'wake 07:00: bed at ' + T12(m)));
    T.has(txt, '6 cycles · 9 hours of sleep · recommended', '6 cycles = 9 hours recommended'); T.has(txt, '3 cycles · 4.5 hours of sleep', '3 cycles = 4.5 hours'); T.eq((txt.match(/recommended/g) || []).length, 2, 'two recommended times');
    t.clickText('I go to bed at'); t.type('#tm', '23:00'); txt = t.text(); [495, 405, 315, 225].forEach(m => T.has(txt, T12(m), 'bed 23:00: wake at ' + T12(m))); T.has(txt, 'Wake up at', 'heading flips');
    t.type('#tm', ''); T.eq(t.q('#out').textContent, '', 'empty time clears the list');
    const a = new Date(); t.click('#nw'); const v = t.value('#tm'), b = new Date();
    T.ok([a, b].some(d => v === String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')), '"Use the current time" fills the clock (' + v + ')');
    t.close();
  }

  /* ---------------------------------------------------------------- history keeps results only */
  {
    const t = await page.open('bmi'); t.clickText('Metric'); t.type('#cm', '180'); t.type('#kg', '90');
    const d = await page.open('duedate'); d.type('#lm', '2026-01-01');
    await page.wait(1700);
    const hist = JSON.parse(w.localStorage.getItem('pk.hist') || '[]');
    const b = hist.find(x => x.t === 'bmi'); T.ok(b && b.l === 'BMI' && /27\.8 \(Overweight\)/.test(b.v), 'BMI history keeps only the result (got ' + JSON.stringify(b) + ')');
    T.ok(!hist.some(x => x.t === 'duedate'), 'pregnancy dates are never put into the history'); t.close(); d.close();
  }

  await T.done(page);
})().catch(e => { console.log('FAIL: test crashed: ' + (e && e.stack || e)); process.exit(1); });
