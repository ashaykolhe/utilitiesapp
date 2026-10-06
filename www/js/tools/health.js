'use strict';
/* Health and wellbeing tools. Estimates only, never medical advice. All data stays on the device.
   Wrapped in a function so helper names never clash with other tool files. */
(function () {
  /* ------------------------------------------------------------------ pure maths (tested in Node) */
  const RAD = Math.PI / 180;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const hyp = Math.hypot;

  const bmiOf = (kg, m) => (kg > 0 && m > 0) ? kg / (m * m) : null;
  function bmiCat(b) {
    if (b < 16) return { label: 'Severely underweight', col: '#3b82f6' };
    if (b < 18.5) return { label: 'Underweight', col: '#38bdf8' };
    if (b < 25) return { label: 'Healthy weight', col: 'var(--ok)' };
    if (b < 30) return { label: 'Overweight', col: '#f59e0b' };
    if (b < 35) return { label: 'Obese (class I)', col: '#f97316' };
    return { label: 'Obese (class II+)', col: 'var(--danger)' };
  }
  const healthyRange = m => [18.5 * m * m, 24.9 * m * m];
  function bmr(sex, kg, cm, age) { return 10 * kg + 6.25 * cm - 5 * age + (sex === 'm' ? 5 : -161); }
  const ACT = [['Sedentary (little exercise)', 1.2], ['Light (1-3 days a week)', 1.375], ['Moderate (3-5 days)', 1.55], ['Active (6-7 days)', 1.725], ['Very active (hard daily)', 1.9]];
  const GOALS = [['Lose 0.5 kg a week', -500], ['Lose 0.25 kg a week', -250], ['Maintain weight', 0], ['Gain 0.25 kg a week', 250], ['Gain 0.5 kg a week', 500]];
  /* Sleep: 90 minute cycles, 15 minutes to fall asleep. Times are minutes since midnight. */
  const wrapDay = m => ((Math.round(m) % 1440) + 1440) % 1440;
  function sleepTimes(minutes, mode, cycles) {
    cycles = cycles || [6, 5, 4, 3];
    return cycles.map(c => ({ cycles: c, hours: c * 1.5, at: wrapDay(mode === 'wake' ? minutes - (c * 90 + 15) : minutes + 15 + c * 90) }));
  }
  /* Step detector: gravity baseline removed, smoothed, peaks above an adaptive threshold at least 280 ms apart. */
  function StepDetector() {
    let base = null, s = 0, prev = 0, prev2 = 0, lastT = -1e9, avg = 2.5, count = 0;
    const MIN = 1.1;
    return {
      get count() { return count; },
      feed(t, ax, ay, az) {
        const m = hyp(ax, ay, az);
        base = base == null ? m : base + (m - base) * 0.02;
        s += ((m - base) - s) * 0.35;
        let step = false;
        const thr = Math.max(MIN, 0.45 * avg);
        if (prev > prev2 && prev >= s && prev > thr && t - lastT >= 280) {
          count++; lastT = t; avg = clamp(avg * 0.75 + prev * 0.25, 1.5, 6); step = true;
        } else if (t - lastT > 2000) {
          avg += (2.5 - avg) * 0.01; // no step for 2 s: relax the threshold so a later gentle walk is still seen
        }
        prev2 = prev; prev = s;
        return step;
      }
    };
  }
  /* PPG: resample to a fixed rate, high-pass (moving average removal), smooth, then peak counting. */
  function resample(ts, vals, fs) {
    const out = []; if (ts.length < 2) return out;
    let j = 0;
    for (let t = ts[0]; t <= ts[ts.length - 1]; t += 1000 / fs) {
      while (j < ts.length - 2 && ts[j + 1] < t) j++;
      const a = ts[j], b = ts[j + 1], k = b > a ? (t - a) / (b - a) : 0;
      out.push(vals[j] + (vals[j + 1] - vals[j]) * clamp(k, 0, 1));
    }
    return out;
  }
  function movAvg(a, w) {
    const n = a.length, out = new Array(n), pre = [0];
    for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + a[i];
    const h = Math.floor(w / 2);
    for (let i = 0; i < n; i++) { const lo = Math.max(0, i - h), hi = Math.min(n, i + h + 1); out[i] = (pre[hi] - pre[lo]) / (hi - lo); }
    return out;
  }
  function ppgFilter(sig, fs) {
    const slow = movAvg(sig, Math.max(3, Math.round(fs * 1.6)));
    return movAvg(sig.map((v, i) => v - slow[i]), Math.max(2, Math.round(fs * 0.12)));
  }
  function ppgBpm(sig, fs) {
    if (sig.length < fs * 8) return null;
    const bp = ppgFilter(sig, fs), n = bp.length;
    const edge = Math.round(fs * 0.8), core = bp.slice(edge, n - edge);
    let sd = 0; for (const v of core) sd += v * v; sd = Math.sqrt(sd / core.length);
    if (sd < 1e-6) return null;
    const minD = Math.round(fs * 0.33), peaks = [];
    for (let i = edge + 1; i < n - edge - 1; i++) {
      if (bp[i] > bp[i - 1] && bp[i] >= bp[i + 1] && bp[i] > 0.3 * sd) {
        if (peaks.length && i - peaks[peaks.length - 1] < minD) { if (bp[i] > bp[peaks[peaks.length - 1]]) peaks[peaks.length - 1] = i; }
        else peaks.push(i);
      }
    }
    const iv = []; for (let i = 1; i < peaks.length; i++) iv.push((peaks[i] - peaks[i - 1]) / fs);
    const good = iv.filter(v => v >= 0.33 && v <= 1.5);
    if (good.length < 4) return null;
    const sorted = good.slice().sort((a, b) => a - b), med = sorted[Math.floor(sorted.length / 2)];
    const dev = good.map(v => Math.abs(v - med)).sort((a, b) => a - b)[Math.floor(good.length / 2)];
    return { bpm: 60 / med, quality: clamp(1 - dev / med * 4, 0, 1), beats: good.length + 1 };
  }
  /* Body measurements */
  function navyBodyFat(sex, cm, waist, neck, hip) {
    if (!(cm > 0 && waist > 0 && neck > 0)) return null;
    let v;
    if (sex === 'm') { if (waist <= neck) return null; v = 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(cm)) - 450; }
    else { if (!(hip > 0) || waist + hip <= neck) return null; v = 495 / (1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.221 * Math.log10(cm)) - 450; }
    return isFinite(v) ? clamp(v, 2, 60) : null;
  }
  function bodyFatCat(sex, bf) {
    const t = sex === 'm' ? [6, 14, 18, 25] : [14, 21, 25, 32];
    return bf < t[0] ? 'Essential fat' : bf < t[1] ? 'Athletic' : bf < t[2] ? 'Fitness' : bf < t[3] ? 'Average' : 'Above average';
  }
  function idealWeights(sex, cm) {
    const inch = cm / 2.54, over = Math.max(0, inch - 60), m = sex === 'm';
    return {
      Devine: (m ? 50 : 45.5) + 2.3 * over, Robinson: (m ? 52 : 49) + (m ? 1.9 : 1.7) * over,
      Miller: (m ? 56.2 : 53.1) + (m ? 1.41 : 1.36) * over, Hamwi: (m ? 48 : 45.5) + (m ? 2.7 : 2.2) * over
    };
  }
  function whrOf(waist, hip) { return (waist > 0 && hip > 0) ? waist / hip : null; }
  function whrRisk(sex, r) {
    const cut = sex === 'm' ? 0.90 : 0.85; // WHO cut-offs for abdominal obesity
    return r <= cut ? { label: 'At or below the WHO cut-off', col: 'var(--ok)' } : { label: 'Above the WHO cut-off (increased risk)', col: 'var(--danger)' };
  }
  /* Dates: always noon local to dodge daylight saving jumps. */
  const parseD = s => { const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : null; };
  const dkey = (d) => { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const addDays = (d, n) => { const x = new Date(d.getTime()); x.setDate(x.getDate() + n); x.setHours(12, 0, 0, 0); return x; };
  const atNoon = d => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  /* Whole calendar days from a to b: both moved to local noon first so a 23 or 25 hour DST day still counts as one. */
  const diffDays = (a, b) => Math.round((atNoon(b).getTime() - atNoon(a).getTime()) / 864e5);
  function dueDate(lmp, cycle, today) {
    cycle = clamp(cycle || 28, 20, 45);
    const edd = addDays(lmp, 280 + (cycle - 28)), days = diffDays(lmp, today || new Date());
    return { edd, days, weeks: Math.floor(days / 7), rem: days % 7, tri: days < 91 ? 1 : days < 189 ? 2 : 3, left: diffDays(today || new Date(), edd) };
  }
  function periodPredict(starts, today) {
    const s = starts.map(parseD).filter(Boolean).sort((a, b) => a - b);
    if (!s.length) return null;
    const gaps = []; for (let i = 1; i < s.length; i++) gaps.push(diffDays(s[i - 1], s[i]));
    const recent = gaps.filter(g => g >= 18 && g <= 50).slice(-6);
    const cycle = recent.length ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length) : 28;
    const last = s[s.length - 1], next = addDays(last, cycle), ov = addDays(next, -14);
    return { cycle, last, next, ovulation: ov, fertileFrom: addDays(ov, -5), fertileTo: addDays(ov, 1), day: diffDays(last, today || new Date()) + 1, learned: recent.length };
  }
  function streakOf(days, today) {
    const set = new Set(days); let d = parseD(today || dkey()), n = 0;
    if (!set.has(dkey(d))) d = addDays(d, -1); // today may still be pending
    while (set.has(dkey(d))) { n++; d = addDays(d, -1); }
    return n;
  }
  function macros(kcal, c, p, f) {
    const t = c + p + f || 1;
    return { carbs: kcal * c / t / 4, protein: kcal * p / t / 4, fat: kcal * f / t / 9 };
  }
  /* Breathing / interval phases: pat = [{name, sec}]; returns phase index and time into it. */
  function phaseAt(pat, t) {
    const total = pat.reduce((a, p) => a + p.sec, 0); if (!(total > 0)) return null;
    t = t % total;
    for (let i = 0; i < pat.length; i++) { if (t < pat[i].sec) return { i, into: t, left: pat[i].sec - t }; t -= pat[i].sec; }
    return { i: pat.length - 1, into: 0, left: 0 };
  }
  function hiitSchedule(work, rest, rounds, prep) {
    const s = []; if (prep > 0) s.push({ name: 'Get ready', sec: prep, round: 0 });
    for (let r = 1; r <= rounds; r++) { s.push({ name: 'Work', sec: work, round: r }); if (rest > 0 && r < rounds) s.push({ name: 'Rest', sec: rest, round: r }); }
    return s;
  }
  const mmss = sec => { sec = Math.max(0, Math.ceil(sec)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); };
  const hm = ms => { const m = Math.floor(ms / 60000); return Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm'; };

  /* ------------------------------------------------------------------ shared UI helpers */
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const num = (el, sel) => { const e = $(sel, el); const v = e ? parseFloat(String(e.value).replace(',', '.')) : NaN; return isFinite(v) ? v : NaN; };
  const MUTED = 'font-size:13px;color:var(--muted)';
  const LBL = 'font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:600';
  const NOTE = 'font-size:12px;color:var(--muted);text-align:center;margin:2px 8px 0';
  const MED = 'Estimate only. Not medical advice.';
  const wrap = 'display:flex;flex-direction:column;gap:14px;padding-bottom:12px';
  const say = (el, t) => { const m = $('#msg', el); if (m) m.textContent = t || ''; };
  const stat = (id, label, init) => `<div class="card center" style="padding:10px 4px"><div style="${LBL}">${label}</div><div class="mid" id="${id}" style="font-size:22px">${init || '--'}</div></div>`;
  function seg(id, opts, sel) {
    return `<div id="${id}" class="row" style="gap:4px;padding:4px;background:var(--surface2);border-radius:14px">${opts.map(o =>
      `<button type="button" data-v="${o[0]}" aria-pressed="${o[0] === sel}" style="padding:10px 4px;border:0;border-radius:11px;font-weight:600;font-size:14px;min-height:44px;transition:background .15s,color .15s;${o[0] === sel ? 'background:var(--accent);color:var(--accent-t)' : 'background:transparent;color:var(--muted)'}">${o[1]}</button>`).join('')}</div>`;
  }
  function segBind(el, id, cb) {
    const box = $('#' + id, el);
    box.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      $$('button', box).forEach(x => { const on = x === b; x.setAttribute('aria-pressed', on); x.style.background = on ? 'var(--accent)' : 'transparent'; x.style.color = on ? 'var(--accent-t)' : 'var(--muted)'; });
      cb(b.dataset.v);
    };
  }
  const field = (id, label, attrs) => `<label class="f">${label}<input id="${id}" type="number" inputmode="decimal" ${attrs || ''}></label>`;
  const select = (id, label, opts) => `<label class="f">${label}<select id="${id}">${opts.map((o, i) => `<option value="${i}">${esc(o[0])}</option>`).join('')}</select></label>`;
  /* Progress ring */
  function ringSVG(id, size, col) {
    return `<svg id="${id}" role="img" aria-label="Progress ring" viewBox="-100 -100 200 200" width="${size || 220}" height="${size || 220}" style="display:block;margin:0 auto;transform:rotate(-90deg)">
      <circle r="84" fill="none" stroke="var(--surface2)" stroke-width="14"/>
      <circle class="rv" r="84" fill="none" stroke="${col || 'var(--accent)'}" stroke-width="14" stroke-linecap="round" pathLength="100" stroke-dasharray="0 100" style="transition:stroke-dasharray .5s ease"/></svg>`;
  }
  const setRing = (svg, pct) => { const c = $('.rv', svg); if (c) c.setAttribute('stroke-dasharray', clamp(pct, 0, 1) * 100 + ' 100'); };
  function fitCanvas(c) {
    const dpr = window.devicePixelRatio || 1, w = c.clientWidth || 300, h = c.clientHeight || 140;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { x, w, h };
  }
  const CANVAS = 'height:160px;background:var(--surface2);border:0;border-radius:14px;display:block';
  /* Line chart for a list of series [{pts:[{v}], col}] */
  function lineChart(c, series, unit) {
    const { x, w, h } = fitCanvas(c); x.clearRect(0, 0, w, h);
    const all = []; series.forEach(s => s.pts.forEach(v => all.push(v)));
    x.font = '11px system-ui'; x.fillStyle = css('--muted');
    if (all.length < 1) { x.textAlign = 'center'; x.fillText('No entries yet', w / 2, h / 2); return; }
    let lo = Math.min.apply(null, all), hi = Math.max.apply(null, all); if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.15; lo -= pad; hi += pad;
    const L = 36, R = w - 10, T = 10, B = h - 12, X = (i, n) => n < 2 ? (L + R) / 2 : L + i / (n - 1) * (R - L), Y = v => B - (v - lo) / (hi - lo) * (B - T);
    x.strokeStyle = css('--line'); x.lineWidth = 1; x.textAlign = 'right';
    for (let g = 0; g < 3; g++) { const v = lo + (hi - lo) * g / 2, yy = Y(v); x.beginPath(); x.moveTo(L, yy); x.lineTo(R, yy); x.stroke(); x.fillText(v.toFixed(Math.abs(hi - lo) < 5 ? 1 : 0), L - 4, yy + 4); }
    series.forEach(s => {
      x.strokeStyle = s.col; x.fillStyle = s.col; x.lineWidth = 2.5; x.lineJoin = 'round'; x.beginPath();
      s.pts.forEach((v, i) => i ? x.lineTo(X(i, s.pts.length), Y(v)) : x.moveTo(X(i, s.pts.length), Y(v))); x.stroke();
      s.pts.forEach((v, i) => { x.beginPath(); x.arc(X(i, s.pts.length), Y(v), 3.5, 0, 7); x.fill(); });
    });
  }
  /* Bar chart of the last days; days = [{label, v}] */
  function bars(c, days, goal) {
    const { x, w, h } = fitCanvas(c); x.clearRect(0, 0, w, h);
    const mx = Math.max(goal || 1, ...days.map(d => d.v), 1), bw = (w - 8) / days.length, B = h - 18;
    x.font = '10px system-ui'; x.textAlign = 'center';
    days.forEach((d, i) => {
      const bh = d.v / mx * (B - 8), px = 4 + i * bw + bw * 0.15, ww = bw * 0.7;
      x.fillStyle = d.v >= goal ? css('--ok') : css('--accent'); x.globalAlpha = d.v ? 1 : .25;
      x.beginPath(); (x.roundRect ? x.roundRect(px, B - Math.max(bh, 3), ww, Math.max(bh, 3), 4) : x.rect(px, B - Math.max(bh, 3), ww, Math.max(bh, 3))); x.fill(); x.globalAlpha = 1;
      x.fillStyle = css('--muted'); x.fillText(d.label, px + ww / 2, h - 4);
    });
    if (goal) { const gy = B - goal / mx * (B - 8); x.strokeStyle = css('--muted'); x.setLineDash([4, 4]); x.beginPath(); x.moveTo(0, gy); x.lineTo(w, gy); x.stroke(); x.setLineDash([]); }
  }
  function saveText(name, text) {
    try {
      const P = window.Capacitor && Capacitor.Plugins;
      if (P && P.Share) { P.Share.share({ title: name, text }).catch(() => {}); return; }
    } catch (e) {}
    try {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); a.download = name;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    } catch (e) { toast('Could not save'); }
  }
  /* Timers and sounds stop when the screen locks, so timed tools hold a screen wake lock and, in the
     Android app, schedule a local notification for the end. Both are best effort. */
  function keepAwake() {
    let lock = null, dead = false;
    const ask = () => navigator.wakeLock ? navigator.wakeLock.request('screen').then(l => {
      if (dead) { l.release().catch(() => {}); return false; }
      lock = l; l.addEventListener('release', () => { if (lock === l) lock = null; }); return true;
    }).catch(() => false) : Promise.resolve(false);
    const vis = () => { if (!document.hidden && !lock && !dead) ask(); };
    document.addEventListener('visibilitychange', vis);
    return { ready: ask(), off() { dead = true; document.removeEventListener('visibilitychange', vis); if (lock) lock.release().catch(() => {}); lock = null; } };
  }
  const LN = () => window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications;
  async function notifyAt(id, title, body, atMs) {
    const ln = LN(); if (!ln || !(atMs > Date.now())) return false;
    try {
      const p = await ln.requestPermissions(); if (p.display !== 'granted') return false;
      await ln.schedule({ notifications: [{ id, title, body, schedule: { at: new Date(atMs), allowWhileIdle: true } }] });
      return true;
    } catch (e) { return false; }
  }
  function cancelNote(id) { const ln = LN(); if (ln) { try { Promise.resolve(ln.cancel({ notifications: [{ id }] })).catch(() => {}); } catch (e) {} } }
  /* Says what protects a running timer; asks to keep the screen on when nothing does. */
  function awakeNote(el, wl, scheduled) {
    Promise.all([wl.ready, scheduled]).then(r => { const m = $('#aw', el); if (m) m.textContent = r[0] || r[1] ? '' : 'Keep the screen on: the timer and sounds can stop when the screen locks.'; });
  }
  const lastDays = (n) => { const out = []; for (let i = n - 1; i >= 0; i--) out.push(addDays(new Date(), -i)); return out; };
  const DAYL = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const safe = (fn) => { try { return fn(); } catch (e) { return undefined; } };
  const bell = (ctx, freq, dur) => {
    try {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = freq; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      o.start(); o.stop(ctx.currentTime + dur + 0.05);
    } catch (e) {}
  };

  /* ================================================================== 1. BMI */
  Tools.register({ id: 'bmi', name: 'BMI Calculator', icon: '⚖️', cat: 'health', desc: 'Body mass index in metric or imperial with the category, a colour scale and your healthy weight range.', keys: ['weight', 'body mass', 'obesity', 'height'], needs: ['storage'], render(el) {
    let unit = Store.get('bmi.unit', 'm');
    el.innerHTML = `<div style="${wrap}">${seg('un', [['m', 'Metric'], ['i', 'Imperial']], unit)}
      <div class="card list" id="inp"></div>
      <div class="card center"><div style="${LBL}">Your BMI</div><div class="big" id="b" style="margin:4px 0;font-size:56px">--</div><div id="cat" style="font-size:19px;font-weight:700;transition:color .25s">Enter height and weight</div>
        <div style="position:relative;margin:26px 6px 6px"><div style="display:flex;height:14px;border-radius:99px;overflow:hidden"><i style="flex:3.5;background:#38bdf8"></i><i style="flex:6.5;background:var(--ok)"></i><i style="flex:5;background:#f59e0b"></i><i style="flex:5;background:#f97316"></i><i style="flex:5;background:var(--danger)"></i></div>
          <div id="mk" style="position:absolute;top:-14px;left:0;width:0;height:0;margin-left:-8px;border-left:8px solid transparent;border-right:8px solid transparent;border-top:12px solid var(--text);transition:left .4s ease;opacity:0"></div>
          <div style="position:relative;height:18px;${MUTED};margin-top:4px">${[15, 18.5, 25, 30, 35, 40].map(v => `<span style="position:absolute;left:${(v - 15) / 25 * 100}%;transform:translateX(${v === 15 ? '0' : v === 40 ? '-100%' : '-50%'})">${v}</span>`).join('')}</div></div>
        <div id="rng" style="${MUTED};margin-top:10px"></div></div>
      <div style="${NOTE}">BMI ignores muscle, age and body shape. ${MED}</div></div>`;
    function build() {
      $('#inp', el).innerHTML = unit === 'm'
        ? `<div class="row">${field('cm', 'Height (cm)', 'value="' + Store.get('bmi.cm', 170) + '" min="50" max="260"')}${field('kg', 'Weight (kg)', 'value="' + Store.get('bmi.kg', 70) + '" min="10" max="400" step="0.1"')}</div>`
        : `<div class="row">${field('ft', 'Feet', 'value="' + Store.get('bmi.ft', 5) + '" min="1" max="8"')}${field('inch', 'Inches', 'value="' + Store.get('bmi.in', 7) + '" min="0" max="11"')}${field('lb', 'Weight (lb)', 'value="' + Store.get('bmi.lb', 154) + '" min="20" max="900"')}</div>`;
    }
    function calc() {
      let m, kg;
      if (unit === 'm') { m = num(el, '#cm') / 100; kg = num(el, '#kg'); Store.set('bmi.cm', num(el, '#cm') || 170); Store.set('bmi.kg', kg || 70); }
      else { m = ((num(el, '#ft') || 0) * 12 + (num(el, '#inch') || 0)) * 0.0254; kg = num(el, '#lb') * 0.45359237; Store.set('bmi.ft', num(el, '#ft') || 5); Store.set('bmi.in', num(el, '#inch') || 0); Store.set('bmi.lb', num(el, '#lb') || 154); }
      const b = bmiOf(kg, m), mk = $('#mk', el);
      if (!b || m < 0.5 || m > 2.7) { $('#b', el).textContent = '--'; $('#cat', el).textContent = 'Enter height and weight'; $('#rng', el).textContent = ''; mk.style.opacity = 0; return; }
      const c = bmiCat(b), r = healthyRange(m);
      $('#b', el).textContent = b.toFixed(1); $('#cat', el).textContent = c.label; $('#cat', el).style.color = c.col;
      mk.style.opacity = 1; mk.style.left = (clamp((b - 15) / 25, 0, 1) * 100) + '%';
      $('#rng', el).textContent = unit === 'm' ? `Healthy range for your height: ${r[0].toFixed(1)} to ${r[1].toFixed(1)} kg` : `Healthy range for your height: ${(r[0] / 0.45359237).toFixed(0)} to ${(r[1] / 0.45359237).toFixed(0)} lb`;
    }
    segBind(el, 'un', v => { unit = v; Store.set('bmi.unit', v); build(); calc(); });
    el.addEventListener('input', calc); build(); calc();
  } });

  /* ================================================================== 2. Step counter */
  Tools.register({ id: 'steps', name: 'Step Counter', icon: '👣', cat: 'health', desc: 'Counts steps with the motion sensor while the app is open, with a daily goal ring, 14 day history, distance and calories.', keys: ['pedometer', 'walking', 'steps', 'activity'], needs: ['motion', 'storage'], render(el) {
    let days = Store.get('steps.days', {}), goal = Store.get('steps.goal', 8000), height = Store.get('steps.height', 170), kg = Store.get('steps.kg', 70);
    let running = false, dead = false, det = null, got = false, saveTick = 0, raf = 0;
    const today = () => dkey();
    const n = () => days[today()] || 0;
    el.innerHTML = `<div style="${wrap}"><div class="card center" style="padding:16px 8px"><div style="position:relative;width:220px;margin:0 auto">${ringSVG('rg', 220)}
        <div style="position:absolute;inset:0;display:grid;place-content:center"><div class="big" id="n" style="margin:0;font-size:46px">0</div><div style="${MUTED}" id="of"></div></div></div>
        <div id="msg" style="${MUTED};margin-top:8px;min-height:18px"></div></div>
      <div class="row"><button class="btn" id="go">Start counting</button><button class="btn alt" id="rs">Reset today</button></div>
      <div class="row">${stat('km', 'Distance', '0 km')}${stat('kc', 'Calories', '0')}</div>
      <div class="card"><div style="${LBL};margin-bottom:8px">Last 14 days</div><canvas id="cv" style="${CANVAS};height:130px"></canvas></div>
      <div class="card list"><div style="${LBL}">Settings</div><div class="row">${field('gl', 'Daily goal', 'min="100" max="100000" step="500"')}${field('ht', 'Height (cm)', 'min="100" max="250"')}${field('kg', 'Weight (kg)', 'min="20" max="300"')}</div></div>
      <div style="${NOTE}">Steps are only counted while this tool is open and counting, because the phone does not let apps count in the background. Results are estimates.</div></div>`;
    $('#gl', el).value = goal; $('#ht', el).value = height; $('#kg', el).value = kg;
    function paint() {
      raf = 0; const c = n();
      $('#n', el).textContent = c.toLocaleString(); $('#of', el).textContent = `of ${goal.toLocaleString()} steps`;
      setRing($('#rg', el), c / goal);
      const stride = height * 0.415 / 100;
      $('#km', el).textContent = (c * stride / 1000).toFixed(2) + ' km'; $('#kc', el).textContent = Math.round(c * 0.00057 * kg) + ' kcal';
      bars($('#cv', el), lastDays(14).map(d => ({ label: DAYL[d.getDay()], v: days[dkey(d)] || 0 })), goal);
    }
    const save = () => { const keys = Object.keys(days).sort(); while (keys.length > 60) delete days[keys.shift()]; Store.set('steps.days', days); };
    const onMotion = e => {
      const a = e.accelerationIncludingGravity; if (!a || a.x == null) return; got = true;
      if (det.feed(e.timeStamp || performance.now(), a.x, a.y, a.z)) {
        days[today()] = n() + 1; if (++saveTick % 10 === 0) save(); if (!raf) raf = requestAnimationFrame(paint);
      }
    };
    function start() {
      if (running) return; det = StepDetector(); got = false;
      const D = window.DeviceMotionEvent;
      const go = () => { if (dead) return; running = true; addEventListener('devicemotion', onMotion); $('#go', el).textContent = 'Pause'; say(el, 'Counting... keep the phone in a pocket or hand.');
        setTimeout(() => { if (!got && !dead) say(el, 'No motion sensor found on this device.'); }, 2500); };
      if (!D) { say(el, 'No motion sensor found on this device.'); return; }
      if (typeof D.requestPermission === 'function') D.requestPermission().then(r => r === 'granted' ? go() : say(el, 'Motion permission denied.')).catch(() => say(el, 'Motion permission denied.'));
      else go();
    }
    function stop() { removeEventListener('devicemotion', onMotion); running = false; save(); if ($('#go', el)) { $('#go', el).textContent = 'Start counting'; say(el, 'Paused'); } }
    $('#go', el).onclick = () => running ? stop() : start();
    $('#rs', el).onclick = () => { if (!n() || confirm('Reset today\'s steps to zero?')) { days[today()] = 0; save(); paint(); } };
    el.addEventListener('input', () => {
      goal = clamp(num(el, '#gl') || 8000, 100, 100000); height = clamp(num(el, '#ht') || 170, 100, 250); kg = clamp(num(el, '#kg') || 70, 20, 300);
      Store.set('steps.goal', goal); Store.set('steps.height', height); Store.set('steps.kg', kg); paint();
    });
    paint(); start();
    return () => { dead = true; removeEventListener('devicemotion', onMotion); cancelAnimationFrame(raf); save(); };
  } });

  /* ================================================================== 3. Water tracker */
  Tools.register({ id: 'water', name: 'Water Tracker', icon: '⌚', cat: 'health', desc: 'Track daily water intake with quick-add glasses, an animated water level, a goal and 14 day history.', keys: ['hydration', 'drink', 'glass'], needs: ['storage'], render(el) {
    let days = Store.get('water.days', {}), goal = Store.get('water.goal', 2000); const log = [];
    const today = () => dkey(), cur = () => days[today()] || 0;
    el.innerHTML = `<div style="${wrap}"><div class="card center" style="padding:16px 8px"><div style="position:relative;width:200px;height:240px;margin:0 auto">
        <svg viewBox="0 0 200 240" width="200" height="240" style="display:block"><defs><clipPath id="cp"><path d="M30 10H170L158 220Q157 232 145 232H55Q43 232 42 220Z"/></clipPath></defs>
          <path d="M30 10H170L158 220Q157 232 145 232H55Q43 232 42 220Z" fill="var(--surface2)"/>
          <g clip-path="url(#cp)"><g id="lv" style="transition:transform .8s cubic-bezier(.3,.7,.3,1)" transform="translate(0 232)"><g><animateTransform attributeName="transform" type="translate" from="-100 0" to="0 0" dur="3s" repeatCount="indefinite"/>
            <path d="M0 0Q25 -9 50 0T100 0T150 0T200 0T250 0T300 0V260H0Z" fill="var(--accent)" opacity=".85"/></g></g></g>
          <path d="M30 10H170L158 220Q157 232 145 232H55Q43 232 42 220Z" fill="none" stroke="var(--line)" stroke-width="3"/></svg>
        <div style="position:absolute;inset:0;display:grid;place-content:center"><div class="big" id="ml" style="margin:0;font-size:38px" aria-live="polite">0</div><div style="text-align:center;font-size:13px" id="of"></div></div></div></div>
      <div class="row">${[150, 250, 330, 500].map(v => `<button class="btn alt add" data-v="${v}" style="padding:12px 0;font-size:15px">+${v}</button>`).join('')}</div>
      <div class="row"><input id="cu" type="number" inputmode="numeric" placeholder="Custom ml" min="1" max="5000" aria-label="Custom amount in ml"><button class="btn" id="ca">Add</button><button class="btn alt" id="un">Undo</button></div>
      <div class="card"><div style="${LBL};margin-bottom:8px">Last 14 days (ml)</div><canvas id="cv" style="${CANVAS};height:130px"></canvas></div>
      <div class="card">${field('gl', 'Daily goal (ml)', 'min="500" max="10000" step="100"')}</div>
      <div style="${NOTE}">Needs vary with weather, size and activity. A common guide is about 2 litres a day. ${MED}</div></div>`;
    $('#gl', el).value = goal;
    const save = () => { const k = Object.keys(days).sort(); while (k.length > 60) delete days[k.shift()]; Store.set('water.days', days); };
    function paint() {
      const c = cur(), p = clamp(c / goal, 0, 1);
      $('#lv', el).setAttribute('transform', `translate(0 ${232 - p * 215})`); $('#ml', el).textContent = c; $('#of', el).textContent = `of ${goal} ml · ${Math.round(c / goal * 100)}%`;
      // white text only reads on the water once it is more than half full; otherwise use the theme text colour
      const lbl = p < 0.5 ? ['var(--text)', 'none'] : ['#fff', '0 1px 6px rgba(0,0,0,.35)'];
      [$('#ml', el), $('#of', el)].forEach(n => { n.style.color = lbl[0]; n.style.textShadow = lbl[1]; });
      bars($('#cv', el), lastDays(14).map(d => ({ label: DAYL[d.getDay()], v: days[dkey(d)] || 0 })), goal);
    }
    const add = v => { v = Math.round(v); if (!(v > 0) || v > 5000) return; days[today()] = cur() + v; log.push(v); save(); paint(); if (cur() >= goal && cur() - v < goal) { toast('Daily goal reached'); if (navigator.vibrate) navigator.vibrate(120); } };
    $$('.add', el).forEach(b => b.onclick = () => add(+b.dataset.v));
    $('#ca', el).onclick = () => {
      const v = num(el, '#cu');
      if (!(v >= 1 && v <= 5000)) { toast('Enter an amount from 1 to 5000 ml'); return; }
      add(v); $('#cu', el).value = '';
    };
    $('#un', el).onclick = () => { const v = log.pop(); if (v) { days[today()] = Math.max(0, cur() - v); save(); paint(); } else toast('Nothing to undo this session'); };
    $('#gl', el).oninput = () => { goal = clamp(num(el, '#gl') || 2000, 500, 10000); Store.set('water.goal', goal); paint(); };
    requestAnimationFrame(paint);
  } });

  /* ================================================================== 4. Calorie and BMR */
  Tools.register({ id: 'bmr', name: 'Calorie & BMR', icon: '🔥', cat: 'health', desc: 'Basal metabolic rate (Mifflin-St Jeor), daily calories for your activity level and a weight goal.', keys: ['calories', 'tdee', 'metabolism', 'diet', 'kcal'], needs: ['storage'], render(el) {
    const S = Store.get('bmr.s', { sex: 'm', age: 30, cm: 175, kg: 75, act: 1, goal: 2 });
    el.innerHTML = `<div style="${wrap}"><div class="card list">${seg('sx', [['m', 'Male'], ['f', 'Female']], S.sex)}
      <div class="row">${field('age', 'Age', 'min="10" max="110"')}${field('cm', 'Height (cm)', 'min="100" max="250"')}${field('kg', 'Weight (kg)', 'min="20" max="300" step="0.1"')}</div>
      ${select('act', 'Activity level', ACT)}${select('gl', 'Goal', GOALS)}</div>
      <div class="card center"><div style="${LBL}">Daily target</div><div class="big" id="tg" style="margin:2px 0">--</div><div style="${MUTED}">kcal per day</div></div>
      <div class="row">${stat('bm', 'BMR')}${stat('td', 'Maintenance')}</div>
      <div id="wn" style="${MUTED};text-align:center"></div>
      <div style="${NOTE}">BMR is what your body burns at rest. Maintenance adds daily activity. ${MED} Do not eat far below 1200 (women) or 1500 (men) kcal without medical advice.</div></div>`;
    $('#age', el).value = S.age; $('#cm', el).value = S.cm; $('#kg', el).value = S.kg; $('#act', el).value = S.act; $('#gl', el).value = S.goal;
    function calc() {
      S.age = num(el, '#age'); S.cm = num(el, '#cm'); S.kg = num(el, '#kg'); S.act = +$('#act', el).value; S.goal = +$('#gl', el).value; Store.set('bmr.s', S);
      const ok = S.age >= 10 && S.age <= 110 && S.cm >= 100 && S.cm <= 250 && S.kg >= 20 && S.kg <= 300;
      if (!ok) { $('#tg', el).textContent = '--'; $('#bm', el).textContent = $('#td', el).textContent = '--'; $('#wn', el).textContent = 'Enter age 10 to 110, height 100 to 250 cm and weight 20 to 300 kg.'; return; }
      const b = bmr(S.sex, S.kg, S.cm, S.age), t = b * ACT[S.act][1], g = t + GOALS[S.goal][1], floor = S.sex === 'm' ? 1500 : 1200;
      $('#bm', el).textContent = Math.round(b); $('#td', el).textContent = Math.round(t); $('#tg', el).textContent = Math.round(g).toLocaleString();
      $('#wn', el).textContent = g < floor ? `That target is below ${floor} kcal, which is usually too low. Aim higher or talk to a professional.` : '';
    }
    segBind(el, 'sx', v => { S.sex = v; calc(); }); el.addEventListener('input', calc); el.addEventListener('change', calc); calc();
  } });

  /* ================================================================== 5. Breathing */
  Tools.register({ id: 'breathe', name: 'Breathing', icon: '🌬️', cat: 'health', desc: 'Guided breathing with an animated circle: box breathing, 4-7-8 or your own pattern, with a session timer and optional vibration cues.', keys: ['relax', 'calm', 'box breathing', '4-7-8', 'stress', 'anxiety'], needs: [], render(el) {
    const PRE = { box: [4, 4, 4, 4], '478': [4, 7, 8, 0], calm: [5, 0, 5, 0], custom: null };
    let key = 'box', pat = PRE.box.slice(), mins = 3, running = false, iv = 0, t0 = 0, lastI = -1, wl = null;
    el.innerHTML = `<div style="${wrap}">${seg('pr', [['box', 'Box 4-4-4-4'], ['478', '4-7-8'], ['calm', '5-5'], ['custom', 'Custom']], 'box')}
      <div id="cu" class="card row" style="display:none">${field('c0', 'In', 'min="0" max="30" value="4"')}${field('c1', 'Hold', 'min="0" max="30" value="4"')}${field('c2', 'Out', 'min="0" max="30" value="4"')}${field('c3', 'Hold', 'min="0" max="30" value="0"')}</div>
      <div class="card center" style="padding:20px 8px"><div style="position:relative;width:240px;height:240px;margin:0 auto;display:grid;place-items:center">
        <div style="position:absolute;inset:0;border-radius:50%;border:2px dashed var(--line)"></div>
        <div id="ci" style="width:240px;height:240px;border-radius:50%;background:radial-gradient(circle at 35% 30%,color-mix(in srgb,var(--accent) 60%,#fff),var(--accent));opacity:.9;transform:scale(.45);transition:transform 1s ease-in-out"></div>
        <div style="position:absolute;inset:0;display:grid;place-content:center;text-align:center"><div id="ph" style="font-size:24px;font-weight:700;color:#fff;text-shadow:0 1px 8px rgba(0,0,0,.4)">Ready</div><div id="ct" style="font-size:38px;font-weight:700;color:#fff;text-shadow:0 1px 8px rgba(0,0,0,.4)"></div></div></div>
        <div id="tm" style="${MUTED};margin-top:10px">Session 3:00</div></div>
      <div class="row">${field('mn', 'Session (minutes)', 'min="1" max="60" value="3"')}<label class="f">Vibration cues<select id="vb"><option value="1">On</option><option value="0">Off</option></select></label></div>
      <button class="btn" id="go" style="min-height:52px">Start</button>
      <div id="aw" style="${NOTE};min-height:16px"></div>
      <div style="${NOTE}">Breathe through your nose if you can. Stop if you feel dizzy. ${MED}</div></div>`;
    const names = ['Breathe in', 'Hold', 'Breathe out', 'Hold'];
    const build = () => names.map((nm, i) => ({ name: nm, sec: pat[i] })).filter(p => p.sec > 0);
    const circle = (scale, sec) => { const c = $('#ci', el); c.style.transitionDuration = sec + 's'; c.style.transform = `scale(${scale})`; };
    function readPat() { if (key === 'custom') pat = [0, 1, 2, 3].map(i => clamp(Math.round(num(el, '#c' + i)) || 0, 0, 30)); else pat = PRE[key].slice(); }
    function stop(done) {
      clearInterval(iv); running = false; $('#go', el).textContent = 'Start'; circle(.45, 1); if (wl) { wl.off(); wl = null; } cancelNote(9101); $('#aw', el).textContent = ''; $('#ph', el).textContent = done ? 'Well done' : 'Ready'; $('#ct', el).textContent = ''; $('#tm', el).textContent = `Session ${mmss(mins * 60)}`;
      if (done && navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }
    function tick() {
      const t = (Date.now() - t0) / 1000, total = mins * 60;
      if (t >= total) { stop(true); return; }
      const sched = build(), p = phaseAt(sched, t); if (!p) { stop(false); return; }
      $('#tm', el).textContent = `Remaining ${mmss(total - t)}`; $('#ct', el).textContent = Math.ceil(p.left);
      if (p.i !== lastI || Math.floor(t / sched.reduce((a, s) => a + s.sec, 0)) !== cycleN) {
        lastI = p.i; cycleN = Math.floor(t / sched.reduce((a, s) => a + s.sec, 0)); const ph = sched[p.i];
        $('#ph', el).textContent = ph.name;
        if (ph.name === 'Breathe in') circle(1, ph.sec); else if (ph.name === 'Breathe out') circle(.45, ph.sec);
        if ($('#vb', el).value === '1' && navigator.vibrate) navigator.vibrate(ph.name === 'Breathe in' ? 60 : ph.name === 'Breathe out' ? [40, 60, 40] : 25);
      }
    }
    let cycleN = -1;
    $('#go', el).onclick = () => {
      if (running) { stop(false); return; }
      readPat(); mins = clamp(Math.round(num(el, '#mn')) || 3, 1, 60); if (!build().length) { toast('Set at least one time above 0'); return; }
      running = true; lastI = -1; cycleN = -1; t0 = Date.now(); $('#go', el).textContent = 'Stop'; iv = setInterval(tick, 100); tick();
      wl = keepAwake(); awakeNote(el, wl, notifyAt(9101, 'Breathing session complete', 'Well done.', t0 + mins * 60000 + 1000));
    };
    segBind(el, 'pr', v => { key = v; $('#cu', el).style.display = v === 'custom' ? '' : 'none'; if (running) stop(false); });
    $('#mn', el).oninput = () => { if (!running) $('#tm', el).textContent = 'Session ' + mmss((clamp(Math.round(num(el, '#mn')) || 3, 1, 60)) * 60); };
    return () => { clearInterval(iv); if (wl) wl.off(); cancelNote(9101); if (navigator.vibrate) navigator.vibrate(0); };
  } });

  /* ================================================================== 6. Sleep calculator */
  Tools.register({ id: 'sleepcalc', name: 'Sleep Calculator', icon: '🗃️', cat: 'health', desc: 'Suggests bedtimes or wake-up times that fit 90 minute sleep cycles, with 15 minutes allowed to fall asleep.', keys: ['bedtime', 'wake up', 'cycles', 'alarm', 'rest'], needs: ['storage'], render(el) {
    let mode = 'wake'; const fmtT = m => { const d = new Date(2000, 0, 1, Math.floor(m / 60), m % 60); return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
    el.innerHTML = `<div style="${wrap}">${seg('md', [['wake', 'I need to wake at'], ['bed', 'I go to bed at']], 'wake')}
      <div class="card list"><label class="f"><span id="lb">Wake-up time</span><input id="tm" type="time" value="07:00" style="font-size:28px;text-align:center;font-weight:700"></label><button class="btn alt" id="nw" style="display:none">Use the current time</button></div>
      <div id="out" class="list"></div>
      <div style="${NOTE}">An average cycle is about 90 minutes and most adults need 5 to 6 cycles (7.5 to 9 hours). ${MED}</div></div>`;
    function calc() {
      const v = $('#tm', el).value; if (!v) { $('#out', el).innerHTML = ''; return; }
      const [h, m] = v.split(':').map(Number), list = sleepTimes(h * 60 + m, mode);
      $('#out', el).innerHTML = (mode === 'wake' ? 'Go to bed at' : 'Wake up at').replace(/^/, `<div style="${LBL};padding:0 4px">`) + '</div>' + list.map((s, i) =>
        `<div class="item" style="padding:14px 16px;${i < 2 ? 'border-color:var(--ok)' : ''}"><div class="grow"><div style="font-size:26px;font-weight:700">${fmtT(s.at)}</div><div style="${MUTED}">${s.cycles} cycles · ${s.hours} hours of sleep${i < 2 ? ' · recommended' : ''}</div></div></div>`).join('');
    }
    segBind(el, 'md', v => { mode = v; $('#lb', el).textContent = v === 'wake' ? 'Wake-up time' : 'Bedtime'; $('#nw', el).style.display = v === 'bed' ? '' : 'none'; calc(); });
    $('#nw', el).onclick = () => { const d = new Date(); $('#tm', el).value = pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2); calc(); };
    el.addEventListener('input', calc); calc();
  } });

  /* ================================================================== 7. Health log */
  Tools.register({ id: 'healthlog', name: 'Health Log', icon: '🛌', cat: 'health', desc: 'Log weight, blood pressure, blood sugar or your own measures with dates, see a line chart and export the log as text.', keys: ['weight', 'blood pressure', 'sugar', 'glucose', 'diary', 'journal'], needs: ['storage'], render(el) {
    let entries = Store.get('hlog.entries', []), type = 'weight';
    const TYPES = { weight: ['Weight', 'kg', 'var(--accent)'], bp: ['Blood pressure', 'mmHg', 'var(--accent)'], sugar: ['Sugar', 'mg/dL', 'var(--accent)'], custom: ['Custom', '', 'var(--accent)'] };
    el.innerHTML = `<div style="${wrap}">${seg('ty', [['weight', 'Weight'], ['bp', 'BP'], ['sugar', 'Sugar'], ['custom', 'Custom']], 'weight')}
      <div class="card list"><div id="cus" class="row" style="display:none"><label class="f">Name<input id="nm" type="text" maxlength="20" placeholder="e.g. Temperature"></label><label class="f">Unit<input id="un" type="text" maxlength="8" placeholder="e.g. °C"></label></div>
        <div class="row" id="vals"></div><div class="row"><label class="f">Date<input id="dt" type="date"></label><label class="f">Note<input id="nt" type="text" maxlength="60" placeholder="optional"></label></div>
        <button class="btn" id="add">Add entry</button></div>
      <div class="card"><canvas id="cv" style="${CANVAS}"></canvas><div id="lg" style="${MUTED};margin-top:8px"></div></div>
      <div id="ls" class="list"></div>
      <div class="row"><button class="btn alt" id="ex">Export as text</button><button class="btn alt" id="cp">Copy text</button></div>
      <div style="${NOTE}">Stored only on this device. ${MED}</div></div>`;
    $('#dt', el).value = dkey();
    const series = e => e.type === 'custom' ? 'c:' + (e.name || '') : e.type;
    const curSeries = () => type === 'custom' ? 'c:' + ($('#nm', el).value.trim()) : type;
    const unitOf = e => e.type === 'custom' ? (e.unit || '') : TYPES[e.type][1];
    const valStr = e => e.type === 'bp' ? `${e.v}/${e.v2}` : String(e.v);
    function vals() {
      $('#vals', el).innerHTML = type === 'bp' ? field('v', 'Systolic', 'min="40" max="300"') + field('v2', 'Diastolic', 'min="20" max="200"') : field('v', type === 'weight' ? 'Weight (kg)' : type === 'sugar' ? 'Sugar (mg/dL)' : 'Value', 'step="any"');
      $('#cus', el).style.display = type === 'custom' ? '' : 'none';
    }
    function paint() {
      const cs = curSeries(), mine = entries.filter(e => series(e) === cs).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id), last = mine.slice(-30);
      const ser = type === 'bp' ? [{ pts: last.map(e => e.v), col: css('--danger') }, { pts: last.map(e => e.v2), col: css('--accent') }] : [{ pts: last.map(e => e.v), col: css('--accent') }];
      lineChart($('#cv', el), ser);
      $('#lg', el).innerHTML = last.length ? (type === 'bp' ? '<b style="color:var(--danger)">●</b> systolic  <b style="color:var(--accent)">●</b> diastolic · ' : '') + `${last.length} entries, ${esc(last[0].date)} to ${esc(last[last.length - 1].date)}` : 'Add your first entry above';
      $('#ls', el).innerHTML = entries.slice().sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id).slice(0, 30).map(e =>
        `<div class="item"><div class="grow"><b>${esc(e.type === 'custom' ? e.name || 'Custom' : TYPES[e.type][0])}</b> ${esc(valStr(e))} <span class="muted">${esc(unitOf(e))}</span><div style="${MUTED}">${esc(e.date)}${e.note ? ' · ' + esc(e.note) : ''}</div></div><button class="btn alt del" data-id="${e.id}" aria-label="Delete entry" style="padding:8px 12px">✕</button></div>`).join('');
    }
    const text = () => 'PocketKit health log\n' + entries.slice().sort((a, b) => a.date < b.date ? -1 : 1).map(e => `${e.date}  ${e.type === 'custom' ? e.name : TYPES[e.type][0]}: ${valStr(e)} ${unitOf(e)}${e.note ? '  (' + e.note + ')' : ''}`).join('\n');
    $('#add', el).onclick = () => {
      const v = num(el, '#v'), v2 = num(el, '#v2'), date = $('#dt', el).value || dkey();
      if (!isFinite(v) || (type === 'bp' && !isFinite(v2))) { toast('Enter a value'); return; }
      const R = type === 'weight' ? [20, 500] : type === 'sugar' ? [10, 1500] : type === 'bp' ? [40, 300] : [0, 1e6];
      if (!(v > 0) || v < R[0] || v > R[1] || (type === 'bp' && !(v2 >= 20 && v2 <= 200))) { toast('That value looks out of range'); return; }
      if (type === 'custom' && !$('#nm', el).value.trim()) { toast('Give the measure a name'); return; }
      if (entries.length >= 1000) { toast('Log is full (1000 entries)'); return; }
      entries.push({ id: Date.now() + Math.floor(Math.random() * 1000), type, v: +v.toFixed(2), v2: type === 'bp' ? +v2.toFixed(1) : undefined, date, note: $('#nt', el).value.trim().slice(0, 60), name: type === 'custom' ? $('#nm', el).value.trim().slice(0, 20) : undefined, unit: type === 'custom' ? $('#un', el).value.trim().slice(0, 8) : undefined });
      Store.set('hlog.entries', entries); $('#v', el).value = ''; if ($('#v2', el)) $('#v2', el).value = ''; $('#nt', el).value = ''; paint(); toast('Added');
    };
    $('#ls', el).onclick = e => { const b = e.target.closest('.del'); if (!b || !confirm('Delete this entry?')) return; entries = entries.filter(x => String(x.id) !== b.dataset.id); Store.set('hlog.entries', entries); paint(); };
    $('#ex', el).onclick = () => saveText('health-log.txt', text());
    $('#cp', el).onclick = () => { safe(() => navigator.clipboard.writeText(text()).then(() => toast('Copied'), () => toast('Could not copy'))); };
    segBind(el, 'ty', v => { type = v; vals(); paint(); });
    $('#nm', el).oninput = paint;
    vals(); requestAnimationFrame(paint);
  } });

  /* ================================================================== 8. Heart rate (camera PPG) */
  Tools.register({ id: 'heartrate', name: 'Heart Rate', icon: '❤️', cat: 'health', desc: 'Approximate pulse estimate: rest a fingertip on the rear camera and flash and the app counts the brightness pulses. An estimate only, not a medical device.', keys: ['pulse', 'bpm', 'heartbeat', 'ppg'], needs: ['camera'], render(el) {
    const DUR = 20; let stream = null, vid = null, raf = 0, track = null, dead = false, running = false, starting = false;
    let ts = [], vals = [], tStart = 0, lastCalc = 0, bpmNow = null;
    el.innerHTML = `<div style="${wrap}"><div class="card center" style="padding:16px 8px"><div style="position:relative;width:200px;margin:0 auto">${ringSVG('rg', 200, 'var(--danger)')}
        <div style="position:absolute;inset:0;display:grid;place-content:center"><div id="hr" style="font-size:20px;color:var(--danger)">❤️</div><div class="big" id="bpm" style="margin:0;font-size:52px" aria-live="polite">--</div><div style="${MUTED}">BPM</div></div></div>
        <div id="msg" style="font-size:14px;margin-top:10px;min-height:20px">Press start, then cover the rear camera and flash with your fingertip.</div></div>
      <div class="card"><canvas id="cv" style="${CANVAS};height:110px"></canvas></div>
      <button class="btn" id="go" style="min-height:52px">Start measuring</button>
      <video id="v" playsinline muted style="display:none"></video>
      <div class="card" style="border-color:var(--danger)"><b>Approximate, not medical.</b><div style="${MUTED}">This is an estimate from camera brightness changes. It can be wrong and must not be used to diagnose, treat or monitor any condition. If you feel unwell, contact a doctor.</div></div>
      <div style="${NOTE}">Rest your finger lightly (no pressure), hold still, and keep the phone steady for ${DUR} seconds.</div></div>`;
    const cv2 = document.createElement('canvas'); cv2.width = cv2.height = 16; const cx = cv2.getContext('2d', { willReadFrequently: true });
    function finish() { stopCam(); const r = ppgBpm(resample(ts, vals, 30), 30);
      if (r && r.quality > 0.35) { $('#bpm', el).textContent = Math.round(r.bpm); say(el, `Estimate: ${Math.round(r.bpm)} BPM (signal ${r.quality > 0.7 ? 'good' : 'fair'}). Approximate only.`); }
      else { $('#bpm', el).textContent = '--'; say(el, 'Could not get a clear pulse. Try again with a steadier finger.'); }
      setRing($('#rg', el), 1); }
    function stopCam() {
      running = false; cancelAnimationFrame(raf);
      if (track) { const tr = track; safe(() => tr.applyConstraints({ advanced: [{ torch: false }] }).catch(() => {})); }
      if (stream) stream.getTracks().forEach(t => t.stop());
      stream = track = null; $('#go', el).textContent = 'Start measuring';
    }
    function loop() {
      if (!running || dead) return;
      raf = requestAnimationFrame(loop);
      if (!vid.videoWidth) return;
      cx.drawImage(vid, 0, 0, 16, 16); const d = cx.getImageData(0, 0, 16, 16).data; let r = 0, g = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; } const N = d.length / 4; r /= N; g /= N; b /= N;
      const covered = r > 110 && r > g * 1.6 && r > b * 1.6, now = performance.now();
      if (!covered) { if (ts.length) { ts = []; vals = []; tStart = 0; setRing($('#rg', el), 0); } say(el, 'Cover the camera and flash with your fingertip.'); $('#bpm', el).textContent = '--'; return; }
      if (ts.length && now - ts[ts.length - 1] > 300) { ts = []; vals = []; tStart = 0; setRing($('#rg', el), 0); say(el, 'Signal interrupted, measuring again. Hold still.'); }
      if (!tStart) tStart = now;
      ts.push(now); vals.push(r);
      const el_s = (now - tStart) / 1000; setRing($('#rg', el), el_s / DUR); say(el, `Measuring... ${Math.max(0, Math.ceil(DUR - el_s))} s. Hold still.`);
      if (now - lastCalc > 500) {
        lastCalc = now; const fs = 30, sig = resample(ts.slice(-300), vals.slice(-300), fs);
        if (sig.length > fs * 3) {
          const bp = ppgFilter(sig, fs).slice(-fs * 5), c = $('#cv', el); const { x, w, h } = fitCanvas(c); x.clearRect(0, 0, w, h);
          let mx = 0; bp.forEach(v => mx = Math.max(mx, Math.abs(v))); mx = mx || 1; x.beginPath();
          bp.forEach((v, i) => { const px = i / (bp.length - 1) * w, py = h / 2 - v / mx * (h / 2 - 8); i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.strokeStyle = css('--danger'); x.lineWidth = 2.5; x.lineJoin = 'round'; x.stroke();
        }
        if (el_s > 10) { const r2 = ppgBpm(resample(ts, vals, 30), 30); if (r2) $('#bpm', el).textContent = Math.round(r2.bpm); }
      }
      if (el_s >= DUR) finish();
    }
    async function start() {
      if (running) { stopCam(); say(el, 'Stopped.'); return; }
      if (starting) return;
      starting = true;
      stopCam(); // never leave an earlier stream running
      ts = []; vals = []; tStart = 0; bpmNow = null; setRing($('#rg', el), 0); $('#bpm', el).textContent = '--'; say(el, 'Starting camera...');
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 30 } }, audio: false });
        if (dead) { stream.getTracks().forEach(t => t.stop()); stream = null; return; }
        track = stream.getVideoTracks()[0]; vid = $('#v', el); vid.srcObject = stream; await vid.play();
        const caps = track.getCapabilities ? track.getCapabilities() : {};
        if (caps.torch) await track.applyConstraints({ advanced: [{ torch: true }] }).catch(() => {}); else toast('No flash found. Use a bright light instead.');
        running = true; $('#go', el).textContent = 'Stop'; loop();
      } catch (e) { stopCam(); say(el, e && e.name === 'NotAllowedError' ? 'Camera permission denied.' : 'Camera not available.'); }
      finally { starting = false; }
    }
    $('#go', el).onclick = start;
    return () => { dead = true; stopCam(); };
  } });

  /* ================================================================== 9. Body fat */
  Tools.register({ id: 'bodyfat', name: 'Body Fat', icon: '📏', cat: 'health', desc: 'Estimate body fat percentage from tape measurements using the US Navy method.', keys: ['navy', 'fat', 'percentage', 'body composition'], needs: ['storage'], render(el) {
    const S = Store.get('bodyfat.s', { sex: 'm' });
    el.innerHTML = `<div style="${wrap}"><div class="card list">${seg('sx', [['m', 'Male'], ['f', 'Female']], S.sex)}
      <div class="row">${field('cm', 'Height (cm)', 'min="100" max="250"')}${field('nk', 'Neck (cm)', 'min="20" max="70"')}</div>
      <div class="row">${field('wa', 'Waist (cm)', 'min="40" max="200"')}<div id="hw" style="display:none">${field('hi', 'Hip (cm)', 'min="50" max="200"')}</div></div>
      <div style="${MUTED}">Waist: at the navel (men) or narrowest point (women). Neck: below the larynx. Hip: widest point.</div></div>
      <div class="card center"><div style="${LBL}">Estimated body fat</div><div class="big" id="bf" style="margin:2px 0">--</div><div id="ct" style="font-weight:700;font-size:18px"></div></div>
      <div style="${NOTE}">The Navy formula can be off by several percent. ${MED}</div></div>`;
    ['cm', 'nk', 'wa', 'hi'].forEach(k => { if (S[k]) $('#' + k, el).value = S[k]; });
    function calc() {
      $('#hw', el).style.display = S.sex === 'f' ? '' : 'none';
      ['cm', 'nk', 'wa', 'hi'].forEach(k => S[k] = num(el, '#' + k)); Store.set('bodyfat.s', S);
      const v = navyBodyFat(S.sex, S.cm, S.wa, S.nk, S.hi);
      $('#bf', el).textContent = v == null ? '--' : v.toFixed(1) + '%'; $('#ct', el).textContent = v == null ? '' : bodyFatCat(S.sex, v);
    }
    segBind(el, 'sx', v => { S.sex = v; calc(); }); el.addEventListener('input', calc); calc();
  } });

  /* ================================================================== 10. Ideal weight */
  Tools.register({ id: 'idealweight', name: 'Ideal Weight', icon: '🎯', cat: 'health', desc: 'Ideal body weight from four classic formulas plus the healthy BMI range for your height.', keys: ['target weight', 'devine', 'hamwi', 'healthy weight'], needs: [], render(el) {
    let sex = 'm', imp = false;
    el.innerHTML = `<div style="${wrap}"><div class="card list">${seg('sx', [['m', 'Male'], ['f', 'Female']], 'm')}${seg('un', [['m', 'Metric'], ['i', 'Imperial']], 'm')}
      <div id="hh" class="row"></div></div><div class="card list" id="out"></div>
      <div style="${NOTE}">Formulas ignore build and age. They are rough guides. ${MED}</div></div>`;
    const build = () => { $('#hh', el).innerHTML = imp ? field('ft', 'Feet', 'value="5" min="1" max="8"') + field('inch', 'Inches', 'value="9" min="0" max="11"') : field('cm', 'Height (cm)', 'value="175" min="100" max="250"'); };
    function calc() {
      const cm = imp ? ((num(el, '#ft') || 0) * 12 + (num(el, '#inch') || 0)) * 2.54 : num(el, '#cm');
      if (!(cm >= 100 && cm <= 250)) { $('#out', el).innerHTML = `<div class="center muted">Enter a height</div>`; return; }
      const w = idealWeights(sex, cm), r = healthyRange(cm / 100), f = k => imp ? (k / 0.45359237).toFixed(0) + ' lb' : k.toFixed(1) + ' kg';
      $('#out', el).innerHTML = Object.keys(w).map(k => `<div class="item"><span class="grow">${k}</span><b>${f(w[k])}</b></div>`).join('') + `<div class="item" style="border-color:var(--ok)"><span class="grow">Healthy BMI range</span><b>${f(r[0])} to ${f(r[1])}</b></div>`;
    }
    segBind(el, 'sx', v => { sex = v; calc(); }); segBind(el, 'un', v => { imp = v === 'i'; build(); calc(); });
    el.addEventListener('input', calc); build(); calc();
  } });

  /* ================================================================== 11. Waist to hip */
  Tools.register({ id: 'whr', name: 'Waist-Hip Ratio', icon: '🧵', cat: 'health', desc: 'Waist-to-hip ratio with the WHO cut-offs (0.90 men, 0.85 women), a quick check of where body fat is carried.', keys: ['waist', 'hip', 'ratio', 'whr'], needs: [], render(el) {
    let sex = 'm';
    el.innerHTML = `<div style="${wrap}"><div class="card list">${seg('sx', [['m', 'Male'], ['f', 'Female']], 'm')}<div class="row">${field('wa', 'Waist (any unit)', 'min="0" step="0.1"')}${field('hi', 'Hip (same unit)', 'min="0" step="0.1"')}</div></div>
      <div class="card center"><div style="${LBL}">Ratio</div><div class="big" id="r" style="margin:2px 0">--</div><div id="rk" style="font-size:19px;font-weight:700"></div></div>
      <div style="${NOTE}">Measure waist at the narrowest point and hips at the widest, both over thin clothes. ${MED}</div></div>`;
    function calc() { let r = whrOf(num(el, '#wa'), num(el, '#hi')); if (r && (r < 0.3 || r > 2)) r = null; $('#r', el).textContent = r ? r.toFixed(2) : '--'; const k = r ? whrRisk(sex, r) : null; $('#rk', el).textContent = k ? k.label : ''; if (k) $('#rk', el).style.color = k.col; }
    segBind(el, 'sx', v => { sex = v; calc(); }); el.addEventListener('input', calc);
  } });

  /* ================================================================== 12. Due date */
  Tools.register({ id: 'duedate', name: 'Due Date', icon: '🤰', cat: 'health', desc: 'Estimated pregnancy due date from the last period, with weeks, trimester and days to go.', keys: ['pregnancy', 'baby', 'edd', 'trimester', 'gestation'], needs: ['storage'], render(el) {
    el.innerHTML = `<div style="${wrap}"><div class="card list"><div class="row"><label class="f">First day of last period<input id="lm" type="date"></label>${field('cy', 'Cycle length (days)', 'min="20" max="45" value="28"')}</div></div>
      <div class="card center"><div style="${LBL}">Estimated due date</div><div class="big" id="edd" style="margin:4px 0;font-size:32px">--</div><div id="wk" style="font-weight:700;font-size:18px"></div><div id="tr" style="${MUTED}"></div>
        <div class="progress" style="margin-top:12px"><i id="pg" style="width:0;transition:width .5s"></i></div><div id="lf" style="${MUTED};margin-top:8px"></div></div>
      <div style="${NOTE}">Only about 5 in 100 babies arrive on the due date. Confirm dates with your midwife or doctor. ${MED}</div></div>`;
    $('#lm', el).value = Store.get('due.lmp', '');
    function calc() {
      const l = parseD($('#lm', el).value); Store.set('due.lmp', $('#lm', el).value || '');
      if (!l) { $('#edd', el).textContent = '--'; return; }
      const d = dueDate(l, num(el, '#cy') || 28);
      $('#edd', el).textContent = d.edd.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
      if (d.days < 0) { $('#wk', el).textContent = 'Date is in the future'; $('#tr', el).textContent = ''; $('#lf', el).textContent = ''; $('#pg', el).style.width = '0'; return; }
      $('#wk', el).textContent = `${d.weeks} weeks ${d.rem} days`; $('#tr', el).textContent = `Trimester ${d.tri}`;
      $('#pg', el).style.width = clamp(d.days / 280, 0, 1) * 100 + '%'; $('#lf', el).textContent = d.left >= 0 ? `${d.left} days to go` : `${-d.left} days past the estimated date`;
    }
    el.addEventListener('input', calc); calc();
  } });

  /* ================================================================== 13. Period tracker */
  Tools.register({ id: 'period', name: 'Cycle Tracker', icon: '🌸', cat: 'health', desc: 'Private period tracker kept only on this device: logs start dates, learns your cycle length and shows the next period and fertile window.', keys: ['period', 'menstrual', 'ovulation', 'fertile', 'cycle'], needs: ['storage'], render(el) {
    let starts = Store.get('period.starts', []);
    el.innerHTML = `<div style="${wrap}"><div class="card center"><div style="${LBL}">Next period</div><div class="big" id="nx" style="margin:4px 0;font-size:34px">--</div><div id="in" style="font-weight:700"></div></div>
      <div class="row">${stat('cd', 'Cycle day')}${stat('cl', 'Cycle length')}</div>
      <div class="card list"><div class="row"><label class="f">Period started on<input id="dt" type="date"></label><button class="btn" id="add" style="flex:0 0 auto">Add</button></div></div>
      <div id="fw" class="card" style="${MUTED}"></div><div id="ls" class="list"></div>
      <div style="${NOTE}">Predictions are averages and are not reliable for contraception. Data never leaves this device. ${MED}</div></div>`;
    $('#dt', el).value = dkey();
    const fd = d => d.toLocaleDateString([], { day: 'numeric', month: 'short' });
    function paint() {
      const p = periodPredict(starts);
      if (!p) { $('#nx', el).textContent = '--'; $('#in', el).textContent = 'Add the first day of your last period'; $('#cd', el).textContent = '--'; $('#cl', el).textContent = '--'; $('#fw', el).textContent = ''; }
      else {
        const left = diffDays(new Date(), p.next);
        $('#nx', el).textContent = fd(p.next); $('#in', el).textContent = left > 0 ? `in ${left} days` : left === 0 ? 'expected today' : `${-left} days late (or not yet logged)`;
        $('#cd', el).textContent = p.day; $('#cl', el).textContent = p.cycle + ' d';
        $('#fw', el).innerHTML = `Likely fertile window: <b style="color:var(--text)">${fd(p.fertileFrom)} to ${fd(p.fertileTo)}</b> (ovulation about ${fd(p.ovulation)}).<br>${p.learned ? `Cycle length learned from your last ${p.learned} cycles.` : 'Using a 28 day cycle until you log two or more periods.'}`;
      }
      $('#ls', el).innerHTML = starts.slice().sort().reverse().slice(0, 12).map(s => `<div class="item"><span class="grow">${esc(s)}</span><button class="btn alt del" data-d="${esc(s)}" aria-label="Delete ${esc(s)}" style="padding:8px 12px">✕</button></div>`).join('');
    }
    $('#add', el).onclick = () => { const v = $('#dt', el).value; if (!parseD(v)) return; if (!starts.includes(v)) { starts.push(v); starts.sort(); starts = starts.slice(-60); Store.set('period.starts', starts); } paint(); };
    $('#ls', el).onclick = e => { const b = e.target.closest('.del'); if (!b) return; starts = starts.filter(s => s !== b.dataset.d); Store.set('period.starts', starts); paint(); };
    paint();
  } });

  /* ================================================================== 14. Fasting timer */
  Tools.register({ id: 'fasting', name: 'Fasting Timer', icon: '⏳', cat: 'health', desc: 'Intermittent fasting timer with 16:8, 18:6, 20:4 and custom goals, a progress ring and history.', keys: ['intermittent', '16:8', 'fast', 'diet'], needs: ['storage'], render(el) {
    let st = Store.get('fast.state', null), hist = Store.get('fast.hist', []), goalH = Store.get('fast.goal', 16), iv = 0;
    el.innerHTML = `<div style="${wrap}">${seg('pr', [['12', '12h'], ['16', '16:8'], ['18', '18:6'], ['20', '20:4'], ['24', '24h']], String(goalH))}
      <div class="card center" style="padding:16px 8px"><div style="position:relative;width:220px;margin:0 auto">${ringSVG('rg', 220)}<div style="position:absolute;inset:0;display:grid;place-content:center"><div class="big" id="t" style="margin:0;font-size:38px">0h 00m</div><div id="sb" style="${MUTED}">Not fasting</div></div></div><div id="ph" style="margin-top:8px;font-weight:600"></div></div>
      <button class="btn" id="go" style="min-height:52px">Start fast</button>
      <div class="card"><div style="${LBL};margin-bottom:6px">History</div><div id="hs" class="list"></div></div>
      <div style="${NOTE}">Fasting is not suitable for everyone, including pregnancy, diabetes, under-18s and eating disorders. Talk to a doctor first. ${MED}</div></div>`;
    const PH = [[4, 'Hours 0-4 of your fast'], [12, 'Hours 4-12 of your fast'], [16, 'Hours 12-16 of your fast'], [24, 'Hours 16-24 of your fast']];
    function paint() {
      const run = !!st, ms = run ? Date.now() - st.start : 0, h = ms / 36e5;
      $('#t', el).textContent = hm(ms); $('#sb', el).textContent = run ? `of ${st.goal} hours` : 'Not fasting'; setRing($('#rg', el), run ? h / st.goal : 0);
      $('#go', el).textContent = run ? 'End fast' : 'Start fast'; $('#go', el).className = run ? 'btn danger' : 'btn';
      $('#ph', el).textContent = run ? (h >= st.goal ? 'Goal reached' : (PH.find(p => h < p[0]) || [0, 'Over 24 hours. Check in with a doctor about long fasts.'])[1]) : '';
      $('#hs', el).innerHTML = hist.slice(0, 8).map(x => `<div class="item"><span class="grow">${esc(new Date(x.start).toLocaleDateString([], { day: 'numeric', month: 'short' }))}</span><b>${hm(x.end - x.start)}</b><span class="muted">${x.end - x.start >= x.goal * 36e5 ? '✅' : ''}</span></div>`).join('') || `<div class="muted center">No fasts yet</div>`;
    }
    $('#go', el).onclick = () => {
      if (st) { if (Date.now() - st.start > 60000) { hist.unshift({ start: st.start, end: Date.now(), goal: st.goal }); hist = hist.slice(0, 30); Store.set('fast.hist', hist); } st = null; }
      else st = { start: Date.now(), goal: goalH };
      Store.set('fast.state', st); paint();
    };
    segBind(el, 'pr', v => { goalH = +v; Store.set('fast.goal', goalH); if (st) { st.goal = goalH; Store.set('fast.state', st); } paint(); });
    iv = setInterval(paint, 15000); paint();
    return () => clearInterval(iv);
  } });

  /* ================================================================== 15. Interval (HIIT) timer */
  Tools.register({ id: 'hiit', name: 'Workout Timer', icon: '🏋️', cat: 'health', desc: 'Interval timer for HIIT and circuits with work, rest and round settings, colour phases, sound and vibration.', keys: ['interval', 'hiit', 'tabata', 'exercise', 'workout', 'circuit'], needs: ['storage'], render(el) {
    const S = Store.get('hiit.s', { work: 30, rest: 10, rounds: 8, prep: 5 });
    let running = false, iv = 0, t0 = 0, sched = [], lastI = -1, pausedAt = 0, wl = null;
    el.innerHTML = `<div style="${wrap}"><div id="box" class="card center" style="padding:28px 8px;transition:background .3s,color .3s"><div id="ph" style="font-size:20px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Ready</div><div class="big" id="ct" style="margin:6px 0;font-size:84px">0:30</div><div id="rd" style="font-size:15px;opacity:.8">8 rounds</div><div class="progress" style="margin:14px 20px 0;background:rgba(127,127,127,.3)"><i id="pg" style="width:0;background:currentColor"></i></div></div>
      <div class="row"><button class="btn" id="go" style="min-height:52px">Start</button><button class="btn alt" id="rs" style="min-height:52px">Reset</button></div>
      <div class="card row">${field('w', 'Work (s)', 'min="1" max="3600"')}${field('r', 'Rest (s)', 'min="0" max="3600"')}${field('n', 'Rounds', 'min="1" max="99"')}</div>
      <div id="aw" style="${NOTE};min-height:16px"></div>
      <div style="${NOTE}">Warm up first and stop if you feel pain or dizziness. ${MED}</div></div>`;
    $('#w', el).value = S.work; $('#r', el).value = S.rest; $('#n', el).value = S.rounds;
    const total = () => sched.reduce((a, s) => a + s.sec, 0);
    function read() {
      S.work = clamp(Math.round(num(el, '#w')) || 30, 1, 3600); S.rest = clamp(Math.round(num(el, '#r')) || 0, 0, 3600); S.rounds = clamp(Math.round(num(el, '#n')) || 8, 1, 99); Store.set('hiit.s', S);
      sched = hiitSchedule(S.work, S.rest, S.rounds, S.prep);
    }
    function look(ph) {
      const b = $('#box', el); const c = ph === 'Work' ? ['var(--ok)', '#fff'] : ph === 'Rest' ? ['var(--danger)', '#fff'] : ph === 'Get ready' ? ['#f59e0b', '#fff'] : ['var(--surface)', 'var(--text)'];
      b.style.background = c[0]; b.style.color = c[1];
    }
    function cue() { if (typeof beep === 'function') safe(beep); else if (navigator.vibrate) navigator.vibrate(200); }
    function idle(txt) { $('#ph', el).textContent = txt; look(''); $('#ct', el).textContent = mmss(S.work); $('#rd', el).textContent = S.rounds + ' rounds · ' + mmss(total()) + ' total'; $('#pg', el).style.width = '0'; }
    function tick() {
      const t = (Date.now() - t0) / 1000;
      if (t >= total()) { stop(); idle('Done'); cue(); toast('Workout complete'); return; }
      const p = phaseAt(sched, t), ph = sched[p.i];
      if (p.i !== lastI) { lastI = p.i; look(ph.name); $('#ph', el).textContent = ph.name; if (lastI > 0 || ph.name !== 'Get ready') cue(); $('#rd', el).textContent = ph.round ? `Round ${ph.round} of ${S.rounds}` : 'Starting soon'; }
      $('#ct', el).textContent = Math.ceil(p.left); $('#pg', el).style.width = (p.into / ph.sec * 100) + '%';
    }
    function stop() { clearInterval(iv); running = false; $('#go', el).textContent = 'Start'; if (wl) { wl.off(); wl = null; } cancelNote(9103); $('#aw', el).textContent = ''; }
    $('#go', el).onclick = () => {
      if (running) { stop(); pausedAt = Date.now(); $('#go', el).textContent = 'Resume'; return; }
      if (pausedAt && sched.length) { t0 += Date.now() - pausedAt; pausedAt = 0; }
      else { read(); t0 = Date.now(); lastI = -1; }
      running = true; $('#go', el).textContent = 'Pause'; iv = setInterval(tick, 100); tick();
      wl = keepAwake(); awakeNote(el, wl, notifyAt(9103, 'Workout complete', 'Nice work.', t0 + total() * 1000 + 1000));
    };
    $('#rs', el).onclick = () => { stop(); pausedAt = 0; read(); idle('Ready'); };
    el.addEventListener('input', () => { if (!running && !pausedAt) { read(); idle('Ready'); } });
    read(); idle('Ready');
    return () => { clearInterval(iv); if (wl) wl.off(); cancelNote(9103); };
  } });

  /* ================================================================== 16. Meditation timer */
  Tools.register({ id: 'meditate', name: 'Meditation', icon: '🧘', cat: 'health', desc: 'Silent meditation timer with a soft bell at the start and end and optional interval bells.', keys: ['mindfulness', 'zen', 'bell', 'calm', 'timer'], needs: [], render(el) {
    let mins = Store.get('med.mins', 10), running = false, iv = 0, end = 0, ctx = null, nextI = 0, intv = 0, total = 0, wl = null;
    el.innerHTML = `<div style="${wrap}">${seg('pr', [['5', '5'], ['10', '10'], ['15', '15'], ['20', '20'], ['30', '30']], String(mins))}
      <div class="card center" style="padding:16px 8px"><div style="position:relative;width:220px;margin:0 auto">${ringSVG('rg', 220)}<div style="position:absolute;inset:0;display:grid;place-content:center"><div class="big" id="t" style="margin:0;font-size:44px">10:00</div><div style="${MUTED}" id="sb">minutes</div></div></div></div>
      <div class="row">${field('mn', 'Custom minutes', 'min="1" max="180"')}<label class="f">Interval bell<select id="ib"><option value="0">None</option><option value="1">Every minute</option><option value="5">Every 5 min</option><option value="10">Every 10 min</option></select></label></div>
      <button class="btn" id="go" style="min-height:52px">Begin</button>
      <div id="aw" style="${NOTE};min-height:16px"></div>
      <div style="${NOTE}">Sit comfortably, close your eyes, follow your breath. The screen is kept on during a session; where the app can, it also schedules an end-of-session notification.</div></div>`;
    const draw = () => { $('#t', el).textContent = running ? mmss((end - Date.now()) / 1000) : mmss(mins * 60); };
    const ac = () => { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); return ctx; };
    const ring = n => { const c = safe(ac); if (!c) return; for (let i = 0; i < n; i++) setTimeout(() => { bell(c, 528, 4); bell(c, 1056, 2.5); }, i * 900); if (navigator.vibrate) navigator.vibrate(150); };
    function stop(done) { clearInterval(iv); running = false; if (wl) { wl.off(); wl = null; } cancelNote(9102); $('#aw', el).textContent = ''; $('#go', el).textContent = 'Begin'; setRing($('#rg', el), done ? 1 : 0); $('#sb', el).textContent = done ? 'Session complete' : 'minutes'; draw(); }
    function tick() {
      const left = end - Date.now();
      if (left <= 0) { ring(3); stop(true); return; }
      setRing($('#rg', el), 1 - left / total); draw();
      if (intv && left < nextI) { ring(1); nextI -= intv * 60000; }
    }
    $('#go', el).onclick = () => {
      if (running) { stop(false); return; }
      total = mins * 60000; end = Date.now() + total; intv = +$('#ib', el).value; nextI = total - intv * 60000;
      running = true; $('#go', el).textContent = 'End session'; $('#sb', el).textContent = 'remaining'; ring(1); iv = setInterval(tick, 250); tick();
      wl = keepAwake(); awakeNote(el, wl, notifyAt(9102, 'Meditation complete', 'Your session has ended.', end + 1000));
    };
    const setM = v => { mins = clamp(Math.round(v) || 10, 1, 180); Store.set('med.mins', mins); if (!running) draw(); };
    segBind(el, 'pr', v => { $('#mn', el).value = ''; setM(+v); });
    $('#mn', el).oninput = () => { if (num(el, '#mn') > 0) setM(num(el, '#mn')); };
    draw();
    return () => { clearInterval(iv); if (wl) wl.off(); cancelNote(9102); if (ctx) ctx.close().catch(() => {}); };
  } });

  /* ================================================================== 17. Habit streaks */
  Tools.register({ id: 'habits', name: 'Habit Streaks', icon: '🚰', cat: 'health', desc: 'Track daily habits, tick them off each day and keep your streaks going. Stored on this device.', keys: ['habit', 'streak', 'routine', 'goal', 'daily'], needs: ['storage'], render(el) {
    let list = Store.get('habit.list', []);
    el.innerHTML = `<div style="${wrap}"><div class="row"><input id="nm" type="text" maxlength="30" placeholder="New habit, e.g. Read 10 pages" aria-label="New habit name"><button class="btn" id="add" style="flex:0 0 auto">Add</button></div><div id="ls" class="list"></div>
      <div style="${NOTE}">A streak counts consecutive days ending today (or yesterday, if you have not ticked today yet).</div></div>`;
    const save = () => Store.set('habit.list', list);
    function paint() {
      const t = dkey(), week = lastDays(7);
      $('#ls', el).innerHTML = list.map(hb => {
        const on = hb.days.includes(t), s = streakOf(hb.days, t);
        return `<div class="card" style="padding:12px"><div class="row"><div style="flex:1"><div style="font-weight:700;font-size:17px">${esc(hb.name)}</div><div style="${MUTED}">🔥 ${s} day${s === 1 ? '' : 's'} · best ${hb.best || s}</div></div>
          <button class="btn tg ${on ? '' : 'alt'}" data-id="${hb.id}" style="flex:0 0 auto;min-width:96px;min-height:48px">${on ? '✓ Done' : 'Mark done'}</button></div>
          <div class="row" style="margin-top:10px;gap:4px">${week.map(d => `<div style="text-align:center"><div role="img" aria-label="${d.toLocaleDateString([], { weekday: 'long' })}: ${hb.days.includes(dkey(d)) ? 'done' : 'not done'}" style="width:100%;aspect-ratio:1;max-width:30px;margin:0 auto;border-radius:50%;background:${hb.days.includes(dkey(d)) ? 'var(--ok)' : 'var(--surface2)'}"></div><small class="muted">${DAYL[d.getDay()]}</small></div>`).join('')}
          <button class="btn alt rm" data-id="${hb.id}" aria-label="Delete habit ${esc(hb.name)}" style="flex:0 0 auto;padding:6px 10px">✕</button></div></div>`;
      }).join('') || `<div class="center muted" style="padding:24px">No habits yet. Add one above.</div>`;
    }
    $('#add', el).onclick = () => { const n = $('#nm', el).value.trim().slice(0, 30); if (!n) return; if (list.length >= 30) { toast('Up to 30 habits'); return; } list.push({ id: Date.now(), name: n, days: [], best: 0 }); $('#nm', el).value = ''; save(); paint(); };
    $('#nm', el).onkeydown = e => { if (e.key === 'Enter') $('#add', el).click(); };
    $('#ls', el).onclick = e => {
      const tg = e.target.closest('.tg'), rm = e.target.closest('.rm');
      if (tg) { const hb = list.find(x => String(x.id) === tg.dataset.id), t = dkey(); if (!hb) return; if (hb.days.includes(t)) hb.days = hb.days.filter(d => d !== t); else { hb.days.push(t); hb.days = hb.days.slice(-400); } hb.best = Math.max(hb.best || 0, streakOf(hb.days, t)); save(); paint(); }
      if (rm && confirm('Delete this habit and its history?')) { list = list.filter(x => String(x.id) !== rm.dataset.id); save(); paint(); }
    };
    paint();
  } });

  /* ================================================================== 18. Macros */
  Tools.register({ id: 'macros', name: 'Macro Calculator', icon: '🥗', cat: 'health', desc: 'Split a daily calorie target into grams of carbs, protein and fat with balanced, high-protein, low-carb or custom ratios.', keys: ['protein', 'carbs', 'fat', 'diet', 'nutrition', 'calories'], needs: ['storage'], render(el) {
    const PRE = { bal: [40, 30, 30], hp: [35, 40, 25], lc: [20, 35, 45], keto: [5, 25, 70], custom: null };
    let key = 'bal', r = PRE.bal.slice();
    el.innerHTML = `<div style="${wrap}"><div class="card list">${field('kc', 'Daily calories (kcal)', 'min="500" max="10000" step="50"')}
      ${seg('pr', [['bal', 'Balanced'], ['hp', 'High protein'], ['lc', 'Low carb'], ['keto', 'Keto'], ['custom', 'Custom']], 'bal')}
      <div id="cu" class="row" style="display:none">${field('rc', 'Carb %', 'min="0" max="100"')}${field('rp', 'Protein %', 'min="0" max="100"')}${field('rf', 'Fat %', 'min="0" max="100"')}</div></div>
      <div class="card"><div style="display:flex;height:16px;border-radius:99px;overflow:hidden"><i id="bc" style="background:#f59e0b;transition:flex .4s"></i><i id="bp" style="background:var(--accent);transition:flex .4s"></i><i id="bf" style="background:#38bdf8;transition:flex .4s"></i></div>
        <div class="row" style="margin-top:14px;text-align:center"><div><div class="mid" id="gc" style="color:#f59e0b">--</div><small class="muted" id="pc">Carbs</small></div><div><div class="mid" id="gp" style="color:var(--accent)">--</div><small class="muted" id="pp">Protein</small></div><div><div class="mid" id="gf" style="color:#38bdf8">--</div><small class="muted" id="pf">Fat</small></div></div></div>
      <div id="wn" style="${MUTED};text-align:center"></div>
      <div style="${NOTE}">Carbs and protein give 4 kcal per gram, fat gives 9. Use the Calorie & BMR tool to find a target. ${MED}</div></div>`;
    $('#kc', el).value = Store.get('macro.kc', 2000);
    function calc() {
      const kc0 = num(el, '#kc'), kc = kc0 >= 500 && kc0 <= 10000 ? kc0 : NaN; if (kc > 0) Store.set('macro.kc', kc);
      if (key === 'custom') r = [num(el, '#rc'), num(el, '#rp'), num(el, '#rf')].map(v => isFinite(v) ? clamp(v, 0, 100) : 0);
      const sum = r[0] + r[1] + r[2];
      $('#wn', el).textContent = key === 'custom' && Math.abs(sum - 100) > 0.5 ? `Percentages add to ${sum}%, they are scaled to 100%.` : '';
      [['bc', 0], ['bp', 1], ['bf', 2]].forEach(x => $('#' + x[0], el).style.flex = (r[x[1]] || 0.01));
      ['pc', 'pp', 'pf'].forEach((id, i) => $('#' + id, el).textContent = ['Carbs', 'Protein', 'Fat'][i] + ' · ' + Math.round(r[i] / (sum || 1) * 100) + '%');
      if (!(kc > 0) || !sum) { $('#gc', el).textContent = $('#gp', el).textContent = $('#gf', el).textContent = '--'; return; }
      const m = macros(kc, r[0], r[1], r[2]); $('#gc', el).textContent = Math.round(m.carbs) + ' g'; $('#gp', el).textContent = Math.round(m.protein) + ' g'; $('#gf', el).textContent = Math.round(m.fat) + ' g';
    }
    segBind(el, 'pr', v => { key = v; $('#cu', el).style.display = v === 'custom' ? '' : 'none'; if (v !== 'custom') r = PRE[v].slice(); else { $('#rc', el).value = r[0]; $('#rp', el).value = r[1]; $('#rf', el).value = r[2]; } calc(); });
    el.addEventListener('input', calc); calc();
  } });

  /* ================================================================== 19. Eye rest 20-20-20 */
  Tools.register({ id: 'eyerest', name: 'Eye Rest 20-20-20', icon: '👀', cat: 'health', desc: 'Reminds you every 20 minutes to look at something 20 feet away for 20 seconds, and counts the breaks you take.', keys: ['eye strain', 'screen break', '20-20-20', 'rest', 'computer'], needs: ['storage'], render(el) {
    let running = false, phase = 'work', end = 0, iv = 0, work = 20, wl = null;
    const key = () => 'eye.' + dkey();
    // keep only the last 30 daily counters
    safe(() => { const cut = dkey(addDays(new Date(), -30)); Object.keys(localStorage).forEach(k => { const m = /^pk\.eye\.(\d{4}-\d\d-\d\d)$/.exec(k); if (m && m[1] < cut) localStorage.removeItem(k); }); });
    el.innerHTML = `<div style="${wrap}"><div class="card center" style="padding:20px 8px"><div style="position:relative;width:220px;margin:0 auto">${ringSVG('rg', 220)}<div style="position:absolute;inset:0;display:grid;place-content:center"><div class="big" id="t" style="margin:0;font-size:46px">20:00</div><div id="sb" style="${MUTED}">Next break in</div></div></div><div id="ms" style="margin-top:10px;font-weight:700;font-size:18px;min-height:26px"></div></div>
      <button class="btn" id="go" style="min-height:52px">Start</button>
      <div class="row">${stat('br', 'Breaks today', String(Store.get(key(), 0)))}${field('wk', 'Work minutes', 'min="5" max="120" value="20"')}</div>
      <div style="${NOTE}">Every 20 minutes, look at something about 6 metres (20 feet) away for 20 seconds. The screen is kept on while the timer runs; where the app can, it also schedules a notification for the next break. ${MED}</div><div id="aw" style="${NOTE};min-height:16px"></div></div>`;
    const cue = () => { if (typeof beep === 'function') safe(beep); else if (navigator.vibrate) navigator.vibrate([200, 100, 200]); };
    function paint() {
      const left = Math.max(0, end - Date.now()), tot = (phase === 'work' ? work * 60 : 20) * 1000;
      $('#t', el).textContent = running ? mmss(left / 1000) : mmss(work * 60);
      setRing($('#rg', el), running ? 1 - left / tot : 0);
      $('#sb', el).textContent = running ? (phase === 'work' ? 'Next break in' : 'Look far away') : 'Next break in';
      $('#ms', el).textContent = running && phase === 'rest' ? 'Look 20 feet away now' : '';
    }
    function tick() {
      if (Date.now() < end) { paint(); return; }
      cue();
      if (phase === 'work') { phase = 'rest'; end = Date.now() + 20000; }
      else { phase = 'work'; end = Date.now() + work * 60000; Store.set(key(), Store.get(key(), 0) + 1); $('#br', el).textContent = Store.get(key(), 0); notifyAt(9104, 'Eye break', 'Look 20 feet away for 20 seconds.', end); }
      paint();
    }
    $('#go', el).onclick = () => {
      if (running) { running = false; clearInterval(iv); if (wl) { wl.off(); wl = null; } cancelNote(9104); $('#aw', el).textContent = ''; $('#go', el).textContent = 'Start'; paint(); return; }
      work = clamp(Math.round(num(el, '#wk')) || 20, 5, 120); phase = 'work'; end = Date.now() + work * 60000; running = true; $('#go', el).textContent = 'Stop'; iv = setInterval(tick, 500); paint();
      wl = keepAwake(); awakeNote(el, wl, notifyAt(9104, 'Eye break', 'Look 20 feet away for 20 seconds.', end));
    };
    $('#wk', el).oninput = () => { if (!running) { work = clamp(Math.round(num(el, '#wk')) || 20, 5, 120); paint(); } };
    paint();
    return () => { clearInterval(iv); if (wl) wl.off(); cancelNote(9104); };
  } });

  /* ================================================================== 20. Mood log */
  Tools.register({ id: 'mood', name: 'Mood Log', icon: '🙂', cat: 'health', desc: 'Record how you feel each day with one tap and a note, and see your last 14 days at a glance. Stored on this device.', keys: ['mood', 'feelings', 'diary', 'journal', 'wellbeing', 'emotion'], needs: ['storage'], render(el) {
    let days = Store.get('mood.days', {}); let pick = 0;
    const FACES = [['😞', 'Awful', 'var(--danger)'], ['🙁', 'Bad', '#f97316'], ['😐', 'Okay', '#f59e0b'], ['🙂', 'Good', '#84cc16'], ['😄', 'Great', 'var(--ok)']];
    const fc = m => FACES[m && m.m] || FACES[2]; // tolerate a bad stored value
    el.innerHTML = `<div style="${wrap}"><div class="card center"><div style="${LBL}">How are you today?</div><div class="row" id="fc" style="margin-top:12px;gap:6px">${FACES.map((f, i) => `<button class="btn alt fc" data-i="${i}" aria-label="${f[1]}" style="font-size:30px;padding:10px 0;min-height:60px;border-radius:16px;transition:transform .15s">${f[0]}</button>`).join('')}</div>
        <label class="f" style="margin-top:12px;text-align:left">Note<input id="nt" type="text" maxlength="80" placeholder="optional"></label><button class="btn" id="sv" style="width:100%;margin-top:10px">Save today</button></div>
      <div class="card"><div style="${LBL};margin-bottom:8px">Last 14 days</div><div id="gr" class="row" style="gap:3px;align-items:flex-end;height:90px"></div></div><div id="ls" class="list"></div>
      <div style="${NOTE}">If low mood lasts for weeks, please talk to someone you trust or a health professional. ${MED}</div></div>`;
    const sel = i => { pick = i; $$('.fc', el).forEach((b, j) => { b.style.transform = j === i ? 'scale(1.12)' : ''; b.style.borderColor = j === i ? FACES[i][2] : ''; b.style.opacity = i === -1 || j === i ? 1 : .55; }); };
    function paint() {
      $('#gr', el).innerHTML = lastDays(14).map(d => { const m = days[dkey(d)]; return `<div style="flex:1;text-align:center"><div title="${m ? fc(m)[1] : 'no entry'}" style="height:${m ? 14 + (FACES[m.m] ? m.m : 2) * 14 : 6}px;border-radius:6px;background:${m ? fc(m)[2] : 'var(--surface2)'};transition:height .4s"></div><small class="muted" style="font-size:10px">${DAYL[d.getDay()]}</small></div>`; }).join('');
      $('#ls', el).innerHTML = Object.keys(days).sort().reverse().slice(0, 10).map(k => `<div class="item"><span style="font-size:24px">${fc(days[k])[0]}</span><div class="grow"><b>${fc(days[k])[1]}</b> <span class="muted">${esc(k)}</span>${days[k].n ? `<div style="${MUTED}">${esc(days[k].n)}</div>` : ''}</div></div>`).join('');
    }
    $('#fc', el).onclick = e => { const b = e.target.closest('.fc'); if (b) sel(+b.dataset.i); };
    $('#sv', el).onclick = () => { if (pick < 0) { toast('Pick a face first'); return; } days[dkey()] = { m: pick, n: $('#nt', el).value.trim().slice(0, 80) }; const k = Object.keys(days).sort(); while (k.length > 400) delete days[k.shift()]; Store.set('mood.days', days); paint(); toast('Saved'); };
    const t = days[dkey()]; if (t) { $('#nt', el).value = t.n || ''; sel(t.m); } else sel(-1);
    pick = t ? t.m : -1; paint();
  } });

  if (typeof module !== 'undefined' && module.exports) module.exports = { bmiOf, bmiCat, healthyRange, bmr, sleepTimes, StepDetector, resample, ppgFilter, ppgBpm, navyBodyFat, idealWeights, whrOf, whrRisk, dueDate, periodPredict, streakOf, macros, phaseAt, hiitSchedule, parseD, dkey, addDays, ACT };
})();
