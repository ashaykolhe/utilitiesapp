'use strict';
/* Measuring tools: ruler, protractor, plumb bob, height / distance finders, speed calculator,
   G meter, vibrometer, RPM counter, screen info and more.
   Everything is wrapped in a function so helper names never clash with other tool files. */
(function () {
  /* ------------------------------------------------------------------ pure maths (tested in Node) */
  const RAD = Math.PI / 180;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const hyp = Math.hypot;

  /* Elevation of the phone's top edge above the horizon, from the gravity vector (device axes). */
  function elevationDeg(ax, ay, az) { return Math.atan2(ay, hyp(ax, az)) / RAD; }
  /* Tilt of the phone's back from flat (0 = lying flat, 90 = standing up). */
  function flatTiltDeg(ax, ay, az) { return Math.atan2(hyp(ax, ay), az) / RAD; }
  /* Angle from vertical of the phone's long axis when held upright. */
  function plumbAngles(ax, ay, az) {
    const g = hyp(ax, ay, az) || 1;
    return { off: Math.acos(clamp(ay / g, -1, 1)) / RAD, side: Math.atan2(ax, ay) / RAD, fore: Math.atan2(az, ay) / RAD };
  }
  /* topDeg/baseDeg: elevation to the top / base (base is negative when looking down). */
  function heightFromAngles(topDeg, baseDeg, eye, dist) {
    if (topDeg == null || !isFinite(topDeg) || Math.abs(topDeg) > 85) return null;
    if (baseDeg != null && (!isFinite(baseDeg) || Math.abs(baseDeg) > 85)) return null;
    let d = dist > 0 ? dist : null;
    if (d == null && baseDeg != null && baseDeg < -0.5 && eye > 0) d = eye / Math.tan(-baseDeg * RAD);
    if (d == null) return null;
    let h;
    if (baseDeg != null) h = d * (Math.tan(topDeg * RAD) - Math.tan(baseDeg * RAD));
    else if (eye > 0) h = eye + d * Math.tan(topDeg * RAD);
    else return null;
    if (!(h > 0) || !isFinite(h)) return null;
    return { height: h, distance: d };
  }
  function distanceFromAngle(eye, downDeg) {
    if (!(eye > 0) || !(downDeg < -0.5) || downDeg < -85) return null;
    return eye / Math.tan(-downDeg * RAD);
  }
  /* Face-down readings (90..180) fold back so the slope is never negative or past 90. */
  const foldDeg = d => d > 90 ? 180 - d : d;
  function slopeFromDeg(d) {
    const a = Math.abs(d), t = Math.tan(a * RAD);
    return { deg: a, pct: t * 100, run: t > 0.0005 ? 1 / t : Infinity, pitch12: t * 12 };
  }
  function shadowHeight(refH, refS, objS) {
    if (!(refH > 0) || !(refS > 0) || !(objS > 0)) return null;
    return refH * objS / refS;
  }
  const DIST = { m: 1, km: 1000, mi: 1609.344, ft: 0.3048, nmi: 1852 };
  const SPEED = { kmh: 1 / 3.6, ms: 1, mph: 0.44704, kn: 1852 / 3600 };
  const SPEED_NAMES = { kmh: 'km/h', ms: 'm/s', mph: 'mph', kn: 'knots' };
  const speedOf = (dMeters, tSec) => (dMeters > 0 && tSec > 0) ? dMeters / tSec : null;
  const distOf = (vMs, tSec) => (vMs > 0 && tSec > 0) ? vMs * tSec : null;
  const timeOf = (dMeters, vMs) => (dMeters > 0 && vMs > 0) ? dMeters / vMs : null;
  function hms(sec) {
    if (sec == null || !isFinite(sec)) return '--';
    sec = Math.round(sec);
    const hh = Math.floor(sec / 3600), mm = Math.floor(sec % 3600 / 60), ss = sec % 60;
    return (hh ? hh + ' h ' : '') + (hh || mm ? mm + ' min ' : '') + ss + ' s';
  }
  function severity(rms) {
    if (rms < 0.05) return { label: 'Still', level: 0 };
    if (rms < 0.3) return { label: 'Light vibration', level: 1 };
    if (rms < 1) return { label: 'Moderate', level: 2 };
    if (rms < 3) return { label: 'Strong', level: 3 };
    return { label: 'Severe', level: 4 };
  }
  /* times: tap timestamps in ms. Average of the last n intervals; a gap over 3 s starts a new series. */
  function rpmFromTaps(times, n) {
    n = n || 5;
    let t = times.slice();
    for (let i = t.length - 1; i > 0; i--) if (t[i] - t[i - 1] > 3000) { t = t.slice(i); break; }
    t = t.slice(-(n + 1));
    if (t.length < 2) return null;
    return 60000 / ((t[t.length - 1] - t[0]) / (t.length - 1));
  }
  /* env: amplitude envelope sampled at fs Hz. Autocorrelation, shortest strong peak between 30 and 600 rpm. */
  function rpmFromEnvelope(env, fs) {
    const n = env.length;
    if (n < fs * 3) return null;
    let mean = 0; for (const v of env) mean += v; mean /= n;
    const x = env.map(v => v - mean);
    let r0 = 0; for (const v of x) r0 += v * v;
    if (r0 < 1e-12) return null;
    const minLag = Math.max(2, Math.floor(fs * 0.1)), maxLag = Math.min(Math.floor(fs * 2), Math.floor(n / 2));
    const ac = [];
    for (let lag = 0; lag <= maxLag + 1; lag++) {
      let s = 0; for (let i = 0; i + lag < n; i++) s += x[i] * x[i + lag];
      ac[lag] = s / r0 * (n / (n - lag)); // unbiased
    }
    let best = 0;
    for (let lag = minLag; lag <= maxLag; lag++) best = Math.max(best, ac[lag]);
    if (best < 0.3) return null;
    for (let lag = minLag; lag <= maxLag; lag++) {
      if (ac[lag] >= 0.85 * best && ac[lag] >= ac[lag - 1] && ac[lag] >= ac[lag + 1]) {
        // parabolic refinement
        const a = ac[lag - 1], b = ac[lag], c = ac[lag + 1], den = a - 2 * b + c;
        const off = den ? 0.5 * (a - c) / den : 0;
        return { rpm: 60 * fs / (lag + clamp(off, -1, 1)), strength: best };
      }
    }
    return null;
  }
  const BASE = { g: ['g', 1], kg: ['g', 1000], mg: ['g', 0.001], oz: ['g', 28.3495], lb: ['g', 453.592],
    ml: ['ml', 1], l: ['ml', 1000], floz: ['ml', 29.5735], pc: ['pc', 1], m: ['m', 1], ft: ['m', 0.3048] };
  function unitPrice(price, qty, unit) {
    const b = BASE[unit];
    if (!b || !(price > 0) || !(qty > 0)) return null;
    const per = price / (qty * b[1]);
    return { dim: b[0], perBase: per, label: b[0] === 'pc' ? per : per * (b[0] === 'm' ? 1 : 100) };
  }
  const stepLength = (dist, steps) => (dist > 0 && steps > 0) ? dist / steps : null;
  function paceMinPerKm(distKm, minutes) {
    if (!(distKm > 0) || !(minutes > 0)) return null;
    return minutes / distKm;
  }
  function luxLabel(lux) {
    if (lux < 1) return 'Almost dark';
    if (lux < 50) return 'Dim room';
    if (lux < 200) return 'Living room';
    if (lux < 500) return 'Bright indoor / office';
    if (lux < 2000) return 'Very bright indoor';
    if (lux < 20000) return 'Overcast day';
    return 'Direct sunlight';
  }

  /* ------------------------------------------------------------------ shared UI helpers */
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const num = (el, sel) => { const e = $(sel, el); const v = e ? parseFloat(String(e.value).replace(',', '.')) : NaN; return isFinite(v) ? v : NaN; };
  const f1 = (v, d) => (v == null || !isFinite(v)) ? '--' : v.toFixed(d == null ? 1 : d);
  const MUTED = 'font-size:13px;color:var(--muted)';
  const LBL = 'font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:600';
  const NOTE = 'font-size:12px;color:var(--muted);text-align:center;margin:2px 8px 0';
  const wrap = 'display:flex;flex-direction:column;gap:14px;padding-bottom:12px';

  function say(el, text) { const m = $('#msg', el); if (m) m.textContent = text || ''; }

  /* Segmented control: markup and binding. */
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
  /* Convert the numbers in the given inputs when the unit switches between metres and feet. */
  function convertFields(el, ids, from, to) {
    if (from === to) return;
    const k = to === 'ft' ? 3.28084 : 1 / 3.28084;
    ids.forEach(id => { const i = $(id, el), n = num(el, id); if (i && isFinite(n)) i.value = +(n * k).toFixed(2); });
  }
  function field(id, label, attrs) {
    return `<label class="f">${label}<input id="${id}" type="number" inputmode="decimal" ${attrs || ''}></label>`;
  }

  /* 270 degree gauge. Update with setGauge(). */
  function gaugeSVG(id, size) {
    const r = 80, c = (a) => [Math.cos(a * RAD) * r, Math.sin(a * RAD) * r];
    const s = c(135), e = c(405 - 0.01);
    const d = `M${s[0].toFixed(2)} ${s[1].toFixed(2)}A${r} ${r} 0 1 1 ${e[0].toFixed(2)} ${e[1].toFixed(2)}`;
    return `<svg id="${id}" role="img" aria-label="Gauge" viewBox="-100 -100 200 200" width="${size || 220}" height="${size || 220}" style="display:block;margin:0 auto">
      <path d="${d}" pathLength="100" fill="none" stroke="var(--surface2)" stroke-width="14" stroke-linecap="round"/>
      <path class="gv" d="${d}" pathLength="100" fill="none" stroke="var(--accent)" stroke-width="14" stroke-linecap="round" stroke-dasharray="0 100" style="transition:stroke-dasharray .25s ease,stroke .25s"/></svg>`;
  }
  function setGauge(svg, pct, color) {
    const p = $('.gv', svg); if (!p) return;
    p.setAttribute('stroke-dasharray', clamp(pct, 0, 1) * 100 + ' 100');
    if (color) p.style.stroke = color;
  }
  const LEVEL_COL = ['var(--ok)', '#84cc16', '#f59e0b', '#f97316', 'var(--danger)'];

  /* Right-half clinometer dial: needle shows elevation -90..90. */
  function clinoSVG(id) {
    let t = '';
    for (let a = -90; a <= 90; a += 10) {
      const big = a % 30 === 0, r1 = big ? 78 : 86, x1 = Math.cos(a * RAD), y1 = -Math.sin(a * RAD);
      t += `<line x1="${(x1 * r1).toFixed(1)}" y1="${(y1 * r1).toFixed(1)}" x2="${(x1 * 94).toFixed(1)}" y2="${(y1 * 94).toFixed(1)}" stroke="var(--muted)" stroke-width="${big ? 2 : 1}"/>`;
      if (big) t += `<text x="${(x1 * 64).toFixed(1)}" y="${(y1 * 64 + 4).toFixed(1)}" text-anchor="middle" font-size="10" fill="var(--muted)">${a}</text>`;
    }
    return `<svg id="${id}" role="img" aria-label="Angle dial" viewBox="-10 -100 110 200" width="150" height="272" style="display:block;margin:0 auto;max-width:60%">
      <path d="M0-94A94 94 0 0 1 0 94Z" fill="var(--surface2)" opacity=".6"/>${t}
      <line x1="-6" y1="0" x2="100" y2="0" stroke="var(--line)" stroke-width="1" stroke-dasharray="3 3"/>
      <g class="needle" style="transition:transform .12s linear"><line x1="0" y1="0" x2="88" y2="0" stroke="var(--accent)" stroke-width="4" stroke-linecap="round"/><circle r="7" fill="var(--accent)"/></g></svg>`;
  }
  const setClino = (svg, deg) => { const n = $('.needle', svg); if (n) n.style.transform = `rotate(${-clamp(deg, -90, 90)}deg)`; };

  /* Motion sensor wrapper. cb(accelIncludingGravity, event). Returns a stop function. */
  function motion(el, cb, need) {
    let dead = false, got = false;
    const on = e => {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x == null) return;
      got = true; cb(a, e);
    };
    const start = () => {
      if (dead) return;
      addEventListener('devicemotion', on);
      setTimeout(() => { if (!got && !dead) say(el, 'No motion sensor found on this device.'); }, 2500);
    };
    const D = window.DeviceMotionEvent;
    if (!D) say(el, 'No motion sensor found on this device.');
    else if (typeof D.requestPermission === 'function') D.requestPermission().then(r => r === 'granted' ? start() : say(el, 'Motion permission denied.')).catch(() => say(el, 'Motion permission denied.'));
    else start();
    return () => { dead = true; removeEventListener('devicemotion', on); };
  }
  /* Low pass filter factory. */
  const lp = k => { let v = null; return x => (v = v == null ? x : v + (x - v) * k); };

  function fitCanvas(c) {
    const dpr = window.devicePixelRatio || 1, w = c.clientWidth || 300, h = c.clientHeight || 140;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { x, w, h };
  }
  /* Simple line graph. */
  function graph(c, data, o) {
    const { x, w, h } = fitCanvas(c);
    x.clearRect(0, 0, w, h);
    const lo = o.min, hi = o.max, Y = v => h - 6 - (clamp(v, lo, hi) - lo) / (hi - lo) * (h - 12);
    x.strokeStyle = css('--line'); x.lineWidth = 1; x.fillStyle = css('--muted'); x.font = '10px system-ui';
    (o.lines || []).forEach(l => { x.beginPath(); x.moveTo(0, Y(l)); x.lineTo(w, Y(l)); x.stroke(); x.fillText(String(l), 4, Y(l) - 3); });
    if (data.length < 2) return;
    const col = o.color || css('--accent');
    x.beginPath();
    data.forEach((v, i) => { const px = i / (o.len - 1) * w + (w - (data.length - 1) / (o.len - 1) * w); i ? x.lineTo(px, Y(v)) : x.moveTo(px, Y(v)); });
    x.strokeStyle = col; x.lineWidth = 2; x.lineJoin = 'round'; x.stroke();
    x.lineTo(w, h); x.lineTo(w - (data.length - 1) / (o.len - 1) * w, h); x.closePath();
    x.globalAlpha = .15; x.fillStyle = col; x.fill(); x.globalAlpha = 1;
  }
  const GRAPH_STYLE = 'height:150px;background:var(--surface2);border:0;border-radius:14px;display:block';

  /* ================================================================== 1. Ruler */
  Tools.register({ id: 'ruler', name: 'Ruler', icon: '🔆', cat: 'measure', desc: 'On-screen ruler in centimetres and inches, horizontal or vertical, calibrated with a credit card.', keys: ['measure', 'cm', 'inch', 'length'], needs: ['storage'], render(el) {
    const DEF = 160 / 25.4; // Android: 160 dp per inch
    let ppmm = Store.get('ruler.ppmm', 0) || DEF, vertical = false, calib = false;
    el.innerHTML = `<div style="${wrap}">
      ${seg('ori', [['h', 'Horizontal'], ['v', 'Vertical']], 'h')}
      <div class="card" style="padding:8px;overflow:hidden"><canvas id="cv" style="background:var(--surface);border:0;display:block;height:230px"></canvas></div>
      <div id="info" class="center" style="${MUTED}"></div>
      <button class="btn alt" id="cal">Calibrate with a credit card</button>
      <div id="calbox" style="display:none" class="card">
        <div style="font-weight:600;margin-bottom:4px">Calibrate</div>
        <div style="${MUTED};margin-bottom:10px">Lay a credit card lengthwise on the screen with its short edge on the top line. Drag the handle down to the card's far edge (85.6 mm).</div>
        <div class="row" style="margin-bottom:10px"><button class="btn" id="save">Save</button><button class="btn alt" id="rst">Reset</button></div>
        <div id="area" style="position:relative;background:var(--surface2);border-radius:12px;overflow:hidden">
          <div style="position:absolute;left:0;right:0;top:16px;border-top:2px solid var(--muted)"></div>
          <div id="hd" style="position:absolute;left:0;right:0;height:44px;margin-top:-22px"><div style="position:absolute;left:0;right:0;top:21px;border-top:3px solid var(--accent)"></div>
            <div id="grip" role="slider" aria-label="Card edge position" style="position:absolute;right:12px;top:6px;width:44px;height:44px;margin-top:-6px;border-radius:50%;background:var(--accent);color:var(--accent-t);display:grid;place-items:center;font-size:16px;touch-action:pan-x;cursor:ns-resize">⇅</div></div>
        </div>
      </div></div>`;
    const cv = $('#cv', el);
    function draw() {
      const W = vertical ? 150 : null;
      cv.style.height = vertical ? Math.round(185 * ppmm) + 'px' : '230px';
      cv.style.width = vertical ? '150px' : '100%'; cv.style.margin = vertical ? '0 auto' : '0';
      const { x, w, h } = fitCanvas(cv);
      x.clearRect(0, 0, w, h);
      const len = vertical ? h : w, thick = vertical ? w : h;
      const P = (a, b) => vertical ? [b, a] : [a, b];
      const text = css('--text'), muted = css('--muted');
      x.lineWidth = 1; x.font = '600 12px system-ui'; x.textBaseline = 'middle';
      const line = (a, b0, b1, c, wd) => { const p = P(a, b0), q = P(a, b1); x.beginPath(); x.moveTo(p[0] + .5, p[1] + .5); x.lineTo(q[0] + .5, q[1] + .5); x.strokeStyle = c; x.lineWidth = wd || 1; x.stroke(); };
      for (let i = 0; i * ppmm <= len; i++) {
        const a = i * ppmm, big = i % 10 === 0, mid = i % 5 === 0;
        line(a, 0, big ? 30 : mid ? 21 : 13, text, big ? 1.5 : 1);
        if (big && i) { x.fillStyle = text; x.textAlign = 'center'; const p = P(a, 44); if (vertical) { x.textAlign = 'left'; p[0] = 36; p[1] = a; } x.fillText(String(i / 10), p[0], p[1]); }
      }
      const ppi = ppmm * 25.4;
      for (let i = 0; i * ppi / 16 <= len; i++) {
        const a = i * ppi / 16, L = i % 16 === 0 ? 30 : i % 8 === 0 ? 24 : i % 4 === 0 ? 18 : i % 2 === 0 ? 13 : 8;
        line(a, thick, thick - L, muted, i % 16 === 0 ? 1.5 : 1);
        if (i % 16 === 0 && i) { x.fillStyle = muted; const p = vertical ? [thick - 36, a] : [a, thick - 44]; x.textAlign = vertical ? 'right' : 'center'; x.fillText(String(i / 16), p[0], p[1]); }
      }
      x.fillStyle = muted; x.font = '11px system-ui'; x.textAlign = 'center';
      const lab = P(len / 2, thick / 2);
      x.save(); x.translate(lab[0], lab[1]); if (vertical) x.rotate(-Math.PI / 2); x.fillText('cm  ↑   ↓  inch', 0, 0); x.restore();
      $('#info', el).textContent = `${(ppmm * 25.4).toFixed(1)} px per inch  ·  ${Store.get('ruler.ppmm', 0) ? 'calibrated' : 'not calibrated yet'}`;
    }
    segBind(el, 'ori', v => { vertical = v === 'v'; draw(); });
    // calibration
    const area = $('#area', el), hd = $('#hd', el);
    let y = 16 + 85.6 * ppmm;
    function layoutCal() {
      area.style.height = Math.round(16 + 85.6 * Math.max(ppmm, DEF) * 1.12 + 40) + 'px'; // card length plus margin
      hd.style.top = y + 'px';
    }
    const move = e => { const r = area.getBoundingClientRect(); y = clamp(e.clientY - r.top, 66, r.height - 10); hd.style.top = y + 'px'; };
    const grip = $('#grip', el);
    grip.onpointerdown = e => { grip.setPointerCapture(e.pointerId); move(e); grip.onpointermove = move; };
    grip.onpointerup = grip.onpointercancel = () => { grip.onpointermove = null; };
    $('#cal', el).onclick = () => { calib = !calib; $('#calbox', el).style.display = calib ? 'block' : 'none'; y = 16 + 85.6 * ppmm; layoutCal(); };
    $('#save', el).onclick = () => { ppmm = clamp((y - 16) / 85.6, 2, 30); Store.set('ruler.ppmm', ppmm); toast('Calibration saved'); draw(); };
    $('#rst', el).onclick = () => { ppmm = DEF; Store.set('ruler.ppmm', 0); y = 16 + 85.6 * ppmm; hd.style.top = y + 'px'; draw(); toast('Calibration reset'); };
    const rs = () => draw(); addEventListener('resize', rs);
    draw();
    return () => removeEventListener('resize', rs);
  } });

  /* ================================================================== 2. Protractor */
  Tools.register({ id: 'protractor', name: 'Protractor', icon: '📐', cat: 'measure', desc: 'Drag the arm of an on-screen protractor to read degrees, or tilt the phone to measure an angle.', keys: ['angle', 'degrees', 'measure'], needs: ['motion'], render(el) {
    let ang = 45, mode = 'drag', zero = 0, stopMotion = null;
    let ticks = '';
    for (let a = 0; a <= 180; a += 5) {
      const big = a % 10 === 0, r1 = big ? 86 : 91, x = Math.cos(a * RAD), y = -Math.sin(a * RAD);
      ticks += `<line x1="${(x * r1).toFixed(1)}" y1="${(y * r1).toFixed(1)}" x2="${(x * 98).toFixed(1)}" y2="${(y * 98).toFixed(1)}" stroke="var(--muted)" stroke-width="${a % 30 === 0 ? 2 : 1}"/>`;
      if (a % 30 === 0) ticks += `<text x="${(x * 74).toFixed(1)}" y="${(y * 74 + 4).toFixed(1)}" text-anchor="middle" font-size="11" fill="var(--muted)">${a}</text>`;
    }
    el.innerHTML = `<div style="${wrap}">
      ${seg('md', [['drag', 'Drag arm'], ['tilt', 'Tilt phone']], 'drag')}
      <div class="card center" style="padding:16px 8px">
        <svg id="sv" viewBox="-110 -110 220 130" style="width:100%;max-width:420px;touch-action:none;display:block;margin:0 auto">
          <path d="M-100 0A100 100 0 0 1 100 0Z" fill="var(--surface2)"/>
          <path id="wedge" d="" fill="var(--accent)" opacity=".18"/>${ticks}
          <line x1="-104" y1="0" x2="104" y2="0" stroke="var(--text)" stroke-width="1.5"/>
          <g id="arm" style="transition:transform .08s linear"><line x1="0" y1="0" x2="100" y2="0" stroke="var(--accent)" stroke-width="3.5" stroke-linecap="round"/><circle cx="100" cy="0" r="9" fill="var(--accent)"/></g>
          <circle r="5" fill="var(--text)"/></svg>
        <div class="big" id="deg" style="margin:0" aria-live="polite">45.0°</div>
        <div id="comp" style="${MUTED}">Supplement 135.0°</div>
        <div id="msg" style="${MUTED};min-height:18px"></div>
      </div>
      <button class="btn alt" id="zero" style="display:none">Set current tilt as zero</button>
      <div style="${NOTE}">Tilt mode: hold the phone against the surface, screen towards you. 0° is when the phone's right edge is level.</div></div>`;
    const svg = $('#sv', el), arm = $('#arm', el);
    function show() {
      arm.style.transform = `rotate(${-ang}deg)`;
      const r = 40, ex = Math.cos(ang * RAD) * r, ey = -Math.sin(ang * RAD) * r;
      $('#wedge', el).setAttribute('d', `M0 0L${r} 0A${r} ${r} 0 0 0 ${ex.toFixed(2)} ${ey.toFixed(2)}Z`);
      $('#deg', el).textContent = ang.toFixed(1) + '°'; $('#comp', el).textContent = `Supplement ${(180 - ang).toFixed(1)}°  ·  Complement ${Math.abs(90 - ang).toFixed(1)}°`;
    }
    const drag = e => {
      if (mode !== 'drag') return;
      const r = svg.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 220 - 110, y = (e.clientY - r.top) / r.height * 130 - 110;
      let a = Math.atan2(-y, x) / RAD; if (a < 0) a = a > -90 ? 0 : 180;
      ang = Math.round(a * 2) / 2; show();
    };
    svg.onpointerdown = e => { svg.setPointerCapture(e.pointerId); drag(e); svg.onpointermove = drag; };
    svg.onpointerup = svg.onpointercancel = () => { svg.onpointermove = null; };
    let raw = 0; const sc = lp(0.2), ss = lp(0.2);
    function startTilt() {
      // smooth the doubled-angle unit vector so the 0/180 wrap-around does not average to 90
      stopMotion = motion(el, a => {
        if (hyp(a.x, a.y) < 2) { say(el, 'Hold the phone upright'); return; }
        say(el, '');
        const t = Math.atan2(a.y, a.x);
        raw = (Math.atan2(ss(Math.sin(2 * t)), sc(Math.cos(2 * t))) / RAD / 2 + 180) % 180;
        ang = ((raw - zero) % 180 + 180) % 180; show();
      });
    }
    segBind(el, 'md', v => {
      mode = v; say(el, ''); $('#zero', el).style.display = v === 'tilt' ? 'block' : 'none';
      if (stopMotion) { stopMotion(); stopMotion = null; }
      if (v === 'tilt') startTilt();
    });
    $('#zero', el).onclick = () => { zero = raw; };
    show();
    return () => { if (stopMotion) stopMotion(); };
  } });

  /* ================================================================== 3. Pendulum bob */
  Tools.register({ id: 'plumb', name: 'Pendulum Bob', icon: '🪀', cat: 'measure', desc: 'A plumb-line indicator that swings like a bob and shows how far the phone is from vertical.', keys: ['plumb', 'vertical', 'tilt', 'level'], needs: ['motion'], render(el) {
    el.innerHTML = `<div style="${wrap}"><div class="card center" style="padding:16px 8px">
      <svg id="sv" viewBox="-100 -10 200 240" style="width:100%;max-width:300px;height:340px;display:block;margin:0 auto">
        <line x1="-60" y1="0" x2="60" y2="0" stroke="var(--muted)" stroke-width="4" stroke-linecap="round"/>
        <line x1="0" y1="0" x2="0" y2="200" stroke="var(--line)" stroke-width="1" stroke-dasharray="4 4"/>
        <path id="arc" d="" fill="none" stroke="var(--accent)" stroke-width="2" opacity=".5"/>
        <g id="pend" style="transform-origin:0 0"><line x1="0" y1="0" x2="0" y2="170" stroke="var(--text)" stroke-width="1.6"/>
          <circle id="bob" cx="0" cy="184" r="16" fill="var(--accent)"/><circle cx="-5" cy="178" r="4" fill="#fff" opacity=".4"/></g>
        <circle r="4" fill="var(--text)"/></svg>
      <div class="big" id="deg" style="margin:0" aria-live="polite">--</div><div style="${MUTED}">from vertical</div>
      <div class="row" style="margin-top:12px"><div><div class="mid" id="sd">--</div><small class="muted">Sideways (+ = bob swings left)</small></div><div><div class="mid" id="fb">--</div><small class="muted">Forward / back</small></div></div>
      <div id="msg" style="${MUTED};margin-top:8px;min-height:18px"></div></div>
      <div style="${NOTE}">Hold the phone upright, like a plumb line. Lay it flat and the bob stays down but the angle jumps to 90 degrees.</div></div>`;
    const pend = $('#pend', el), bob = $('#bob', el), fs = lp(0.25), fz = lp(0.25), fy = lp(0.25);
    let ax = 0, ay = 0, az = 0, raf = 0, dirty = false;
    const stop = motion(el, a => { ax = fs(a.x); ay = fy(a.y); az = fz(a.z); if (!dirty) { dirty = true; raf = requestAnimationFrame(paint); } });
    function paint() {
      dirty = false;
      const p = plumbAngles(ax, ay, az);
      pend.style.transform = `rotate(${clamp(p.side, -80, 80)}deg)`;
      bob.setAttribute('r', (16 * (1 + clamp(p.fore, -60, 60) / 150)).toFixed(1));
      $('#deg', el).textContent = p.off.toFixed(1) + '°';
      $('#sd', el).textContent = (p.side >= 0 ? '+' : '') + p.side.toFixed(1) + '°';
      $('#fb', el).textContent = (p.fore >= 0 ? '+' : '') + p.fore.toFixed(1) + '°';
      const near = p.off < 1; $('#deg', el).style.color = near ? 'var(--ok)' : 'var(--text)';
    }
    return () => { stop(); cancelAnimationFrame(raf); };
  } });

  /* ================================================================== 4. Height finder */
  Tools.register({ id: 'heightfinder', name: 'Height Finder', icon: '🏢', cat: 'measure', desc: 'Measure the height of a tree or building from the tilt angles to its top and base, using your eye height or distance.', keys: ['clinometer', 'tree', 'building', 'tall'], needs: ['motion'], render(el) {
    let ang = 0, top = null, base = null;
    el.innerHTML = `<div style="${wrap}">
      <div class="card center" style="padding:14px">${clinoSVG('cl')}
        <div class="big" id="deg" style="margin:4px 0 0">0.0°</div><div style="${MUTED}">Sight along the phone's top edge</div><div id="msg" style="${MUTED};min-height:18px"></div></div>
      <div class="row"><button class="btn" id="mt">Mark top</button><button class="btn alt" id="mb">Mark base</button></div>
      <div class="row" style="${MUTED};text-align:center"><div>Top: <b id="vt" style="color:var(--text)">--</b></div><div>Base: <b id="vb" style="color:var(--text)">--</b></div></div>
      <div class="card list">
        ${seg('un', [['m', 'metres'], ['ft', 'feet']], 'm')}
        <div class="row">${field('eye', 'Eye height (<span class="u">m</span>)', 'value="1.6" min="0" step="0.05"')}${field('dst', 'Distance (<span class="u">m</span>), optional', 'min="0" step="0.5"')}</div>
        <div class="center" style="padding:8px 0"><div style="${LBL}">Height</div><div class="big" id="res" style="margin:2px 0" aria-live="polite">--</div><div id="sub" style="${MUTED}"></div></div>
      </div>
      <div style="${NOTE}">Stand on level ground. Mark the top, then the base of the object. With a base mark the distance is worked out from your eye height. Without it, enter the distance. Tilt errors of a degree or two matter.</div>
      <button class="btn alt" id="rs">Clear marks</button></div>`;
    const sm = lp(0.25); let unit = 'm';
    const stop = motion(el, a => { ang = sm(elevationDeg(a.x, a.y, a.z)); setClino($('#cl', el), ang); $('#deg', el).textContent = ang.toFixed(1) + '°'; });
    function calc() {
      $('#vt', el).textContent = top == null ? '--' : top.toFixed(1) + '°'; $('#vb', el).textContent = base == null ? '--' : base.toFixed(1) + '°';
      const r = heightFromAngles(top, base, num(el, '#eye'), num(el, '#dst'));
      $('#res', el).textContent = r ? r.height.toFixed(1) + ' ' + unit : '--';
      $('#sub', el).textContent = r ? `Distance ${r.distance.toFixed(1)} ${unit}` + (base != null ? ' · height = d × (tan top − tan base)' : ' · height = eye + d × tan top') : 'Mark the top and give a distance or mark the base';
    }
    $('#mt', el).onclick = () => { top = ang; calc(); };
    $('#mb', el).onclick = () => { base = ang; calc(); };
    $('#rs', el).onclick = () => { top = base = null; calc(); };
    segBind(el, 'un', v => { convertFields(el, ['#eye', '#dst'], unit, v); unit = v; $$('.u', el).forEach(u => u.textContent = v); calc(); });
    el.addEventListener('input', calc); calc();
    return stop;
  } });

  /* ================================================================== 5. Distance finder */
  Tools.register({ id: 'distancefinder', name: 'Distance Finder', icon: '↔️', cat: 'measure', desc: 'Find the horizontal distance to an object by aiming at its base and entering your eye height.', keys: ['range', 'far', 'clinometer'], needs: ['motion'], render(el) {
    let ang = 0, held = null;
    el.innerHTML = `<div style="${wrap}">
      <div class="card center" style="padding:14px">${clinoSVG('cl')}<div class="big" id="deg" style="margin:4px 0 0">0.0°</div><div style="${MUTED}">Aim the top edge at the object's base</div><div id="msg" style="${MUTED};min-height:18px"></div></div>
      <div class="card list">${seg('un', [['m', 'metres'], ['ft', 'feet']], 'm')}
        ${field('eye', 'Eye height (<span class="u">m</span>)', 'value="1.6" min="0" step="0.05"')}
        <div class="center" style="padding:8px 0"><div style="${LBL}">Distance</div><div class="big" id="res" style="margin:2px 0">--</div><div id="sub" style="${MUTED}">distance = eye height ÷ tan(angle down)</div></div>
        <div class="row"><button class="btn" id="hold">Hold angle</button><button class="btn alt" id="rel">Live</button></div></div>
      <div style="${NOTE}">Point at the spot where the object meets the ground, so the phone tilts downward. Works best between 5 and 50 times your eye height.</div></div>`;
    const sm = lp(0.25); let unit = 'm';
    function calc() {
      const a = held != null ? held : ang, d = distanceFromAngle(num(el, '#eye'), a);
      $('#res', el).textContent = d ? d.toFixed(1) + ' ' + unit : '--';
      $('#sub', el).textContent = d ? `Angle ${a.toFixed(1)}° down${held != null ? ' (held)' : ''}` : 'Tilt the phone downward to see a distance';
    }
    const stop = motion(el, a => { ang = sm(elevationDeg(a.x, a.y, a.z)); setClino($('#cl', el), ang); $('#deg', el).textContent = ang.toFixed(1) + '°'; calc(); });
    $('#hold', el).onclick = () => { held = ang; calc(); }; $('#rel', el).onclick = () => { held = null; calc(); };
    segBind(el, 'un', v => { convertFields(el, ['#eye'], unit, v); unit = v; $$('.u', el).forEach(u => u.textContent = v); calc(); });
    el.addEventListener('input', calc); calc();
    return stop;
  } });

  /* ================================================================== 6. Speed calculator */
  Tools.register({ id: 'speedcalc', name: 'Speed Calc', icon: '🩺', cat: 'measure', desc: 'Work out speed, distance or time from the other two, with km, miles, metres, feet and knots.', keys: ['velocity', 'pace', 'distance', 'time', 'mph'], needs: [], render(el) {
    let mode = 'speed';
    const du = Object.keys(DIST).map(k => `<option value="${k}">${k === 'nmi' ? 'nautical mi' : k}</option>`).join('');
    const su = Object.keys(SPEED).map(k => `<option value="${k}">${SPEED_NAMES[k]}</option>`).join('');
    el.innerHTML = `<div style="${wrap}">
      ${seg('md', [['speed', 'Speed'], ['dist', 'Distance'], ['time', 'Time']], 'speed')}
      <div class="card list">
        <div id="gd" class="row"><label class="f">Distance<input id="d" type="number" inputmode="decimal" min="0" value="100"></label><label class="f">Unit<select id="du">${du}</select></label></div>
        <div id="gs" class="row" style="display:none"><label class="f">Speed<input id="s" type="number" inputmode="decimal" min="0" value="60"></label><label class="f">Unit<select id="su">${su}</select></label></div>
        <div id="gt"><div style="${MUTED};margin-bottom:4px">Time</div><div class="row">${field('th', 'hours', 'min="0" value="1"')}${field('tm', 'minutes', 'min="0" value="0"')}${field('ts', 'seconds', 'min="0" value="0"')}</div></div>
      </div>
      <div class="card center"><div id="rl" style="${LBL}">Speed</div><div class="big" id="res" style="margin:4px 0;font-size:44px" aria-live="polite">--</div><div id="sub" style="${MUTED};line-height:1.7"></div></div></div>`;
    $('#du', el).value = 'km'; $('#su', el).value = 'kmh'; $('#d', el).value = '100';
    const vis = () => { $('#gd', el).style.display = mode === 'dist' ? 'none' : ''; $('#gs', el).style.display = mode === 'speed' ? 'none' : ''; $('#gt', el).style.display = mode === 'time' ? 'none' : ''; };
    function calc() {
      const D = num(el, '#d') * DIST[$('#du', el).value], V = num(el, '#s') * SPEED[$('#su', el).value];
      const T = (num(el, '#th') || 0) * 3600 + (num(el, '#tm') || 0) * 60 + (num(el, '#ts') || 0);
      const out = $('#res', el), sub = $('#sub', el);
      const spLines = v => Object.keys(SPEED).map(k => `${(v / SPEED[k]).toFixed(2)} ${SPEED_NAMES[k]}`).join('  ·  ');
      if (mode === 'speed') {
        const v = speedOf(D, T); $('#rl', el).textContent = 'Speed';
        out.textContent = v ? (v / SPEED[$('#su', el).value]).toFixed(2) + ' ' + SPEED_NAMES[$('#su', el).value] : '--';
        sub.textContent = v ? spLines(v) + `  ·  pace ${hms(1000 / v)} per km` : 'Enter a distance and a time';
      } else if (mode === 'dist') {
        const d = distOf(V, T); $('#rl', el).textContent = 'Distance';
        out.textContent = d ? (d / DIST[$('#du', el).value]).toFixed(2) + ' ' + $('#du', el).value : '--';
        sub.textContent = d ? Object.keys(DIST).map(k => `${(d / DIST[k]).toFixed(2)} ${k}`).join('  ·  ') : 'Enter a speed and a time';
      } else {
        const t = timeOf(D, V); $('#rl', el).textContent = 'Time';
        out.textContent = t ? hms(t) : '--'; sub.textContent = t ? `${(t / 3600).toFixed(3)} hours` : 'Enter a distance and a speed';
      }
    }
    segBind(el, 'md', v => { mode = v; vis(); calc(); });
    el.addEventListener('input', calc); el.addEventListener('change', calc); vis(); calc();
  } });

  /* ================================================================== 7. G meter */
  Tools.register({ id: 'gmeter', name: 'G Meter', icon: '🏎️', cat: 'measure', desc: 'Live g-force on every axis with total, peak hold and a scrolling graph.', keys: ['acceleration', 'g force', 'accelerometer'], needs: ['motion'], render(el) {
    const LEN = 240, hist = []; let peak = 0, a0 = { x: 0, y: 0, z: 0 }, tot = 0, raf = 0, dirty = false, noG = false;
    const col = (v, c) => `<div class="card center" style="padding:10px 4px"><div style="${LBL}">${v}</div><div id="${c}" class="mid" style="font-size:24px">0.00</div></div>`;
    el.innerHTML = `<div style="${wrap}">
      <div class="card center" style="padding:14px 8px">${gaugeSVG('ga', 200)}<div style="margin-top:-128px;height:128px"><div class="big" id="tot" style="margin:0;font-size:46px" aria-live="off">1.00</div><div style="${MUTED}">g total</div></div>
        <div id="msg" style="${MUTED};min-height:18px"></div></div>
      <div class="row">${col('X', 'gx')}${col('Y', 'gy')}${col('Z', 'gz')}</div>
      <div class="card"><canvas id="cv" style="${GRAPH_STYLE}"></canvas><div class="row" style="margin-top:8px;${MUTED}"><div>Peak <b id="pk" style="color:var(--text)">0.00 g</b></div><div style="text-align:right"><label style="display:inline-flex;gap:6px;align-items:center;min-height:44px"><input type="checkbox" id="ng" style="width:auto"> Remove gravity</label></div></div></div>
      <button class="btn alt" id="rs">Reset peak</button></div>`;
    $('#ng', el).onchange = e => { noG = e.target.checked; peak = 0; hist.length = 0; };
    $('#rs', el).onclick = () => { peak = 0; hist.length = 0; };
    const stop = motion(el, (a, e) => {
      let x = a.x, y = a.y, z = a.z;
      if (noG) {
        if (e.acceleration && e.acceleration.x != null) { x = e.acceleration.x; y = e.acceleration.y; z = e.acceleration.z; }
        else { noG = false; $('#ng', el).checked = false; say(el, 'This phone cannot remove gravity, showing the raw reading.'); }
      }
      a0 = { x: x / 9.80665, y: y / 9.80665, z: z / 9.80665 }; tot = hyp(a0.x, a0.y, a0.z);
      peak = Math.max(peak, tot); hist.push(tot); if (hist.length > LEN) hist.shift();
      if (!dirty) { dirty = true; raf = requestAnimationFrame(paint); }
    });
    function paint() {
      dirty = false;
      $('#tot', el).textContent = tot.toFixed(2); $('#gx', el).textContent = a0.x.toFixed(2); $('#gy', el).textContent = a0.y.toFixed(2); $('#gz', el).textContent = a0.z.toFixed(2);
      $('#pk', el).textContent = peak.toFixed(2) + ' g';
      setGauge($('#ga', el), tot / 3, tot > 2 ? 'var(--danger)' : tot > 1.5 ? '#f59e0b' : 'var(--accent)');
      graph($('#cv', el), hist, { min: 0, max: Math.max(3, Math.ceil(peak)), len: LEN, lines: [1, 2] });
    }
    return () => { stop(); cancelAnimationFrame(raf); };
  } });

  /* ================================================================== 8. Vibrometer */
  Tools.register({ id: 'vibrometer', name: 'Vibrometer', icon: '📳', cat: 'measure', desc: 'Measures vibration of the surface the phone rests on, with a live graph, min / max and a severity label.', keys: ['vibration', 'shake', 'tremor', 'accelerometer'], needs: ['motion'], render(el) {
    const LEN = 200, hist = [], win = []; let rms = 0, mn = Infinity, mx = 0, prev = null, last = 0, raf = 0, dirty = false;
    el.innerHTML = `<div style="${wrap}">
      <div class="card center" style="padding:14px 8px">${gaugeSVG('ga', 200)}<div style="margin-top:-132px;height:132px"><div class="big" id="v" style="margin:0;font-size:44px">0.000</div><div style="${MUTED}">m/s² RMS</div></div>
        <div id="sev" style="font-size:20px;font-weight:700;transition:color .25s">Still</div><div id="msg" style="${MUTED};min-height:18px"></div></div>
      <div class="card"><canvas id="cv" style="${GRAPH_STYLE}"></canvas></div>
      <div class="row"><div class="card center" style="padding:10px"><div style="${LBL}">Min</div><div class="mid" id="mn" style="font-size:22px">--</div></div><div class="card center" style="padding:10px"><div style="${LBL}">Max</div><div class="mid" id="mx" style="font-size:22px">0.000</div></div></div>
      <button class="btn alt" id="rs">Reset</button>
      <div style="${NOTE}">Lay the phone flat on the surface you want to test. Values are approximate and depend on the phone's sensor.</div></div>`;
    $('#rs', el).onclick = () => { mn = Infinity; mx = 0; hist.length = 0; win.length = 0; };
    const stop = motion(el, (a, e) => {
      let m;
      if (e.acceleration && e.acceleration.x != null) m = hyp(e.acceleration.x, e.acceleration.y, e.acceleration.z);
      else { // high-pass the gravity-included reading
        if (!prev) prev = { x: a.x, y: a.y, z: a.z };
        prev.x += (a.x - prev.x) * .05; prev.y += (a.y - prev.y) * .05; prev.z += (a.z - prev.z) * .05;
        m = hyp(a.x - prev.x, a.y - prev.y, a.z - prev.z);
      }
      win.push(m); if (win.length > 40) win.shift();
      rms = Math.sqrt(win.reduce((s, v) => s + v * v, 0) / win.length);
      const now = performance.now(); if (now - last > 40) { last = now; hist.push(rms); if (hist.length > LEN) hist.shift(); if (win.length > 20) { mn = Math.min(mn, rms); mx = Math.max(mx, rms); } }
      if (!dirty) { dirty = true; raf = requestAnimationFrame(paint); }
    });
    function paint() {
      dirty = false; const s = severity(rms);
      $('#v', el).textContent = rms.toFixed(3); $('#sev', el).textContent = s.label; $('#sev', el).style.color = LEVEL_COL[s.level];
      $('#mn', el).textContent = isFinite(mn) ? mn.toFixed(3) : '--'; $('#mx', el).textContent = mx.toFixed(3);
      setGauge($('#ga', el), Math.log10(1 + rms * 10) / Math.log10(41), LEVEL_COL[s.level]);
      graph($('#cv', el), hist, { min: 0, max: Math.max(1, Math.ceil(Math.max.apply(null, hist.concat([0])))), len: LEN, color: css('--accent') });
    }
    return () => { stop(); cancelAnimationFrame(raf); };
  } });

  /* ================================================================== 9. RPM counter */
  Tools.register({ id: 'rpm', name: 'RPM Counter', icon: '⚙️', cat: 'measure', desc: 'Tap once per revolution to read RPM, or let the microphone estimate the rate of a repeating sound.', keys: ['revolutions', 'tachometer', 'fan', 'engine'], needs: ['microphone'], render(el) {
    let mode = 'tap'; const taps = []; let stream = null, ctx = null, iv = 0, an = null, buf = null, env = [], ts = [], gen = 0, dead = false;
    el.innerHTML = `<div style="${wrap}">
      ${seg('md', [['tap', 'Tap'], ['mic', 'Microphone']], 'tap')}
      <div class="card center" style="padding:14px 8px">${gaugeSVG('ga', 200)}<div style="margin-top:-130px;height:130px"><div class="big" id="r" style="margin:0;font-size:46px">--</div><div style="${MUTED}">RPM</div></div><div id="msg" style="${MUTED};min-height:18px"></div></div>
      <div id="tapbox"><button class="btn" id="pad" style="width:100%;height:140px;font-size:22px;border-radius:22px;touch-action:manipulation;user-select:none">Tap once per revolution</button>
        <div class="row" style="margin-top:8px;${MUTED}"><div>Taps <b id="n" style="color:var(--text)">0</b></div><div style="text-align:right"><button class="btn alt" id="rs" style="padding:8px 16px">Reset</button></div></div></div>
      <div id="micbox" style="display:none" class="card center"><canvas id="cv" style="${GRAPH_STYLE}"></canvas><div style="${MUTED};margin-top:8px">Hold the phone near the spinning or pulsing thing. Needs a steady, repeating sound between 30 and 600 per minute.</div></div></div>`;
    const showRpm = v => { $('#r', el).textContent = v == null ? '--' : Math.round(v); setGauge($('#ga', el), v == null ? 0 : Math.log10(1 + v) / Math.log10(1001)); };
    const pad = $('#pad', el);
    pad.onpointerdown = e => {
      e.preventDefault(); taps.push(performance.now()); if (taps.length > 40) taps.shift();
      $('#n', el).textContent = taps.length; showRpm(rpmFromTaps(taps, 5));
      pad.style.transform = 'scale(.97)'; setTimeout(() => { pad.style.transform = ''; }, 80);
      if (navigator.vibrate) navigator.vibrate(8);
    };
    $('#rs', el).onclick = () => { taps.length = 0; $('#n', el).textContent = '0'; showRpm(null); };
    async function startMic() {
      const my = ++gen; // a newer start/stop invalidates this one
      say(el, 'Starting microphone...');
      let st = null;
      try {
        st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
        if (dead || my !== gen) { st.getTracks().forEach(t => t.stop()); return; }
        stream = st;
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        an = ctx.createAnalyser(); an.fftSize = 1024; ctx.createMediaStreamSource(stream).connect(an);
        buf = new Float32Array(an.fftSize); env = []; ts = []; say(el, 'Listening...');
        iv = setInterval(() => {
          an.getFloatTimeDomainData(buf); let s = 0; for (let i = buf.length - 882; i < buf.length; i++) s += buf[i] * buf[i];
          env.push(Math.sqrt(s / 882)); ts.push(performance.now()); if (env.length > 400) { env.shift(); ts.shift(); }
          // real sampling rate of the envelope, measured from timestamps (timers drift on a busy WebView)
          const span = (ts[ts.length - 1] - ts[0]) / 1000, fs = span > 0 ? (env.length - 1) / span : 0;
          if (env.length > 150 && env.length % 10 === 0 && fs > 10) {
            const r = rpmFromEnvelope(env, fs);
            showRpm(r ? r.rpm : null); say(el, r ? 'Listening...' : 'No steady pulse heard');
          }
          graph($('#cv', el), env.slice(-200), { min: 0, max: Math.max(0.02, Math.max.apply(null, env.slice(-200))), len: 200 });
        }, 20);
      } catch (e) {
        if (my === gen) { stopMic(); say(el, e && e.name === 'NotAllowedError' ? 'Microphone permission denied.' : 'Microphone not available.'); }
        else if (st) st.getTracks().forEach(t => t.stop());
      }
    }
    function stopMic() { gen++; clearInterval(iv); iv = 0; if (stream) stream.getTracks().forEach(t => t.stop()); if (ctx) ctx.close().catch(() => {}); stream = ctx = null; }
    segBind(el, 'md', v => {
      mode = v; say(el, ''); showRpm(null); stopMic();
      $('#tapbox', el).style.display = v === 'tap' ? '' : 'none'; $('#micbox', el).style.display = v === 'mic' ? '' : 'none';
      if (v === 'mic') startMic();
    });
    showRpm(null);
    return () => { dead = true; stopMic(); };
  } });

  /* ================================================================== 10. Screen pixel info */
  Tools.register({ id: 'pixelinfo', name: 'Screen Info', icon: '🖥️', cat: 'measure', desc: 'Screen size in pixels, dp and inches, pixel ratio and viewport size, with a grid and dead pixel test.', keys: ['resolution', 'dpi', 'density', 'display', 'pixel'], needs: [], render(el) {
    let overlay = null;
    el.innerHTML = `<div style="${wrap}"><div class="card center"><div style="${LBL}">Resolution</div><div class="big" id="res" style="margin:4px 0;font-size:40px">--</div><div id="sub" style="${MUTED}"></div></div>
      <div class="card list" id="rows"></div>
      <div class="row"><button class="btn" id="grid">Grid overlay</button><button class="btn alt" id="dead">Dead pixel test</button></div>
      <div style="${NOTE}">Inches are an estimate that assumes Android's standard of 160 dp per inch. Real panel sizes can differ a little.</div></div>`;
    function info() {
      const s = window.screen, dpr = window.devicePixelRatio || 1, w = s.width, h = s.height;
      const pw = Math.round(w * dpr), ph = Math.round(h * dpr), dI = Math.hypot(w, h) / 160;
      $('#res', el).textContent = `${pw} × ${ph}`; $('#sub', el).textContent = `${w} × ${h} dp  ·  ratio ${dpr.toFixed(2)}×`;
      const rows = [['Physical pixels', `${pw} × ${ph} px`], ['Screen in dp (CSS px)', `${w} × ${h}`], ['Pixel ratio', dpr.toFixed(3)], ['Density (approx.)', Math.round(dpr * 160) + ' dpi'],
        ['Viewport', `${innerWidth} × ${innerHeight} dp`], ['Size estimate', `${(w / 160).toFixed(2)} × ${(h / 160).toFixed(2)} in`], ['Diagonal estimate', dI.toFixed(1) + ' in'],
        ['Aspect ratio', (Math.max(w, h) / Math.min(w, h)).toFixed(2) + ' : 1'], ['Color depth', (s.colorDepth || '--') + ' bit'], ['Orientation', (s.orientation && s.orientation.type) || (innerWidth > innerHeight ? 'landscape' : 'portrait')]];
      $('#rows', el).innerHTML = rows.map(r => `<div class="item"><span class="grow" style="color:var(--muted)">${esc(r[0])}</span><b>${esc(r[1])}</b></div>`).join('');
    }
    function close() { if (overlay) { overlay.remove(); overlay = null; } }
    function open(kind) {
      close();
      overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;touch-action:manipulation;user-select:none;-webkit-user-select:none';
      if (kind === 'grid') {
        const c = document.createElement('canvas'); c.style.cssText = 'width:100%;height:100%;border:0;border-radius:0;background:#0b1020;display:block';
        overlay.appendChild(c); document.body.appendChild(overlay);
        const dpr = devicePixelRatio || 1; c.width = innerWidth * dpr; c.height = innerHeight * dpr;
        const x = c.getContext('2d'); x.scale(dpr, dpr); x.font = '10px system-ui'; x.fillStyle = '#9aa3d4';
        for (let i = 0; i <= innerWidth; i += 10) { x.strokeStyle = i % 100 ? 'rgba(154,163,212,.18)' : 'rgba(154,163,212,.6)'; x.beginPath(); x.moveTo(i + .5, 0); x.lineTo(i + .5, innerHeight); x.stroke(); if (i % 100 === 0 && i) x.fillText(i, i + 2, 12); }
        for (let j = 0; j <= innerHeight; j += 10) { x.strokeStyle = j % 100 ? 'rgba(154,163,212,.18)' : 'rgba(154,163,212,.6)'; x.beginPath(); x.moveTo(0, j + .5); x.lineTo(innerWidth, j + .5); x.stroke(); if (j % 100 === 0 && j) x.fillText(j, 2, j - 2); }
        x.font = '600 15px system-ui'; x.textAlign = 'center'; x.fillStyle = '#fff';
        x.fillText('Grid: 10 dp squares, bold every 100 dp', innerWidth / 2, innerHeight / 2 - 10); x.fillText('Tap to close', innerWidth / 2, innerHeight / 2 + 14);
        overlay.onclick = close;
      } else {
        const cols = ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000']; let i = 0;
        overlay.style.background = cols[0]; overlay.innerHTML = '<div style="position:absolute;bottom:24px;left:0;right:0;text-align:center;font:600 14px system-ui;color:#888;mix-blend-mode:difference">Tap for next colour. Look for dots that stay different.</div>';
        overlay.onclick = () => { i++; if (i >= cols.length) close(); else overlay.style.background = cols[i]; };
        document.body.appendChild(overlay);
      }
    }
    $('#grid', el).onclick = () => open('grid'); $('#dead', el).onclick = () => open('dead');
    const rs = () => info(); addEventListener('resize', rs); info();
    return () => { removeEventListener('resize', rs); close(); };
  } });

  /* ================================================================== 11. Slope / angle finder */
  Tools.register({ id: 'slope', name: 'Slope Finder', icon: '📈', cat: 'measure', desc: 'Roof pitch and ramp slope in degrees, percent, ratio and rise per 12, by laying the phone on the surface or sighting along it.', keys: ['roof', 'pitch', 'ramp', 'incline', 'gradient', 'angle'], needs: ['motion'], render(el) {
    let mode = 'flat', ang = 0, zero = 0, held = null, raw = 0;
    el.innerHTML = `<div style="${wrap}">
      ${seg('md', [['flat', 'Lay on surface'], ['sight', 'Sight along edge']], 'flat')}
      <div class="card center" style="padding:14px 8px">${gaugeSVG('ga', 200)}<div style="margin-top:-130px;height:130px"><div class="big" id="deg" style="margin:0;font-size:46px">0.0°</div><div style="${MUTED}" id="hint">Phone lying on the slope</div></div><div id="msg" style="${MUTED};min-height:18px"></div></div>
      <div class="row"><div class="card center" style="padding:10px"><div style="${LBL}">Percent</div><div class="mid" id="pc" style="font-size:24px">0%</div></div><div class="card center" style="padding:10px"><div style="${LBL}">Ratio</div><div class="mid" id="ra" style="font-size:24px">--</div></div><div class="card center" style="padding:10px"><div style="${LBL}">Per 12</div><div class="mid" id="p12" style="font-size:24px">0</div></div></div>
      <div class="row"><button class="btn" id="hold">Hold</button><button class="btn alt" id="zero">Zero here</button></div></div>`;
    const sm = lp(.25);
    const stop = motion(el, a => { raw = sm(mode === 'flat' ? foldDeg(flatTiltDeg(a.x, a.y, a.z)) : elevationDeg(a.x, a.y, a.z)); ang = raw - zero; paint(); });
    function paint() {
      const v = held != null ? held : ang, s = slopeFromDeg(v);
      $('#deg', el).textContent = (mode === 'sight' && v < 0 ? '-' : '') + s.deg.toFixed(1) + '°';
      $('#pc', el).textContent = (s.pct > 999 ? '999+' : s.pct.toFixed(1)) + '%'; $('#ra', el).textContent = s.run === Infinity ? 'flat' : '1:' + (s.run > 99 ? '99+' : s.run.toFixed(1));
      $('#p12', el).textContent = s.pitch12 > 99 ? '99+' : s.pitch12.toFixed(1);
      setGauge($('#ga', el), s.deg / 90, held != null ? 'var(--ok)' : 'var(--accent)');
    }
    segBind(el, 'md', v => { mode = v; zero = 0; held = null; $('#hold', el).textContent = 'Hold'; $('#hint', el).textContent = v === 'flat' ? 'Phone lying on the slope' : 'Top edge sighted along the slope'; });
    $('#hold', el).onclick = () => { held = held == null ? ang : null; $('#hold', el).textContent = held == null ? 'Hold' : 'Release'; paint(); };
    $('#zero', el).onclick = () => { zero = raw; };
    paint(); return stop;
  } });

  /* ================================================================== 12. Shadow height */
  Tools.register({ id: 'shadowheight', name: 'Shadow Height', icon: '🌲', cat: 'measure', desc: 'Find the height of a tree, pole or building from its shadow compared with a stick of known height.', keys: ['tree', 'sun', 'shadow', 'tall'], needs: [], render(el) {
    el.innerHTML = `<div style="${wrap}"><div class="card list">${seg('un', [['m', 'metres'], ['ft', 'feet']], 'm')}
      <div class="row">${field('rh', 'Stick height', 'value="1" min="0" step="0.01"')}${field('rs', 'Stick shadow', 'value="0.8" min="0" step="0.01"')}</div>
      ${field('os', 'Object shadow', 'value="12" min="0" step="0.01"')}</div>
      <div class="card center"><svg viewBox="0 0 300 110" style="width:100%;max-width:320px"><line x1="0" y1="100" x2="300" y2="100" stroke="var(--line)" stroke-width="2"/>
        <circle cx="262" cy="22" r="14" fill="#f59e0b"/><line x1="250" y1="30" x2="40" y2="100" stroke="#f59e0b" stroke-width="1" stroke-dasharray="4 4" opacity=".6"/>
        <rect x="150" y="30" width="10" height="70" fill="var(--accent)" rx="3"/><rect x="150" y="97" width="-1" height="3" fill="none"/><line x1="155" y1="100" x2="50" y2="100" stroke="var(--muted)" stroke-width="5"/></svg>
        <div style="${LBL}">Object height</div><div class="big" id="res" style="margin:2px 0">--</div><div id="sub" style="${MUTED}">height = stick × object shadow ÷ stick shadow</div></div>
      <div style="${NOTE}">Measure both shadows at the same moment, on level ground, with the stick standing straight up.</div></div>`;
    let unit = 'm';
    const calc = () => { const h = shadowHeight(num(el, '#rh'), num(el, '#rs'), num(el, '#os')); $('#res', el).textContent = h ? h.toFixed(2) + ' ' + unit : '--'; };
    segBind(el, 'un', v => { unit = v; calc(); }); el.addEventListener('input', calc); calc();
  } });

  /* ================================================================== 13. Stride and pace */
  Tools.register({ id: 'pacecalc', name: 'Stride & Pace', icon: '👟', cat: 'measure', desc: 'Work out your step length from a known distance, estimate distance from steps, and calculate running pace.', keys: ['step length', 'pace', 'running', 'walk', 'stride'], needs: ['storage'], render(el) {
    el.innerHTML = `<div style="${wrap}">
      <div class="card list"><div style="font-weight:700">Step length</div><div style="${MUTED}">Walk a known distance and count your steps.</div>
        <div class="row">${field('sd', 'Distance (m)', 'value="20" min="0"')}${field('sn', 'Steps taken', 'min="0" placeholder="e.g. 28"')}</div>
        <div class="center"><div class="mid" id="sl">--</div><div style="${MUTED}">metres per step</div></div><button class="btn alt" id="sv">Save as my step length</button></div>
      <div class="card list"><div style="font-weight:700">Steps to distance</div>
        <div class="row">${field('st', 'Steps', 'min="0" value="10000"')}${field('sl2', 'Step length (m)', 'min="0" step="0.01"')}</div>
        <div class="center"><div class="mid" id="sdist">--</div></div></div>
      <div class="card list"><div style="font-weight:700">Running pace</div>
        <div class="row">${field('pd', 'Distance (km)', 'value="5" min="0" step="0.1"')}${field('pm', 'Minutes', 'value="30" min="0"')}</div>
        <div class="row"><div class="center"><div class="mid" id="pp">--</div><small class="muted">per km</small></div><div class="center"><div class="mid" id="pk">--</div><small class="muted">km/h</small></div></div></div></div>`;
    const saved = Store.get('pace.step', 0); if (saved) $('#sl2', el).value = saved;
    const mmss = m => { if (m == null) return '--'; const t = Math.round(m * 60); return Math.floor(t / 60) + ':' + pad(t % 60, 2); };
    function calc() {
      const L = stepLength(num(el, '#sd'), num(el, '#sn')); $('#sl', el).textContent = L ? L.toFixed(2) + ' m' : '--';
      const sl = num(el, '#sl2'), st = num(el, '#st'); $('#sdist', el).textContent = sl > 0 && st > 0 ? (st * sl / 1000).toFixed(2) + ' km  (' + Math.round(st * sl) + ' m)' : '--';
      const p = paceMinPerKm(num(el, '#pd'), num(el, '#pm')); $('#pp', el).textContent = mmss(p); $('#pk', el).textContent = p ? (60 / p).toFixed(1) : '--';
    }
    $('#sv', el).onclick = () => { const L = stepLength(num(el, '#sd'), num(el, '#sn')); if (!L) return toast('Enter distance and steps'); Store.set('pace.step', +L.toFixed(3)); $('#sl2', el).value = L.toFixed(2); calc(); toast('Saved'); };
    el.addEventListener('input', calc); calc();
  } });

  /* ================================================================== 14. Unit price */
  Tools.register({ id: 'unitprice', name: 'Unit Price', icon: '🏷️', cat: 'measure', desc: 'Compare shop prices per 100 g, 100 ml or per piece to find the best value.', keys: ['shopping', 'compare', 'price per', 'cheaper'], needs: [], render(el) {
    const units = [['g', 'g'], ['kg', 'kg'], ['mg', 'mg'], ['oz', 'oz'], ['lb', 'lb'], ['ml', 'ml'], ['l', 'L'], ['floz', 'fl oz'], ['pc', 'pcs']];
    const row = i => `<div class="card list" id="r${i}"><div style="font-weight:700">Product ${'ABC'[i]}</div><div class="row">${field('p' + i, 'Price', 'min="0" step="0.01"')}${field('q' + i, 'Amount', 'min="0"')}<label class="f">Unit<select id="u${i}">${units.map(u => `<option value="${u[0]}">${u[1]}</option>`).join('')}</select></label></div>
      <div id="o${i}" class="center" style="min-height:26px;font-weight:700">--</div></div>`;
    el.innerHTML = `<div style="${wrap}">${row(0)}${row(1)}${row(2)}<div id="best" class="card center" style="font-weight:600">Fill in at least two products</div></div>`;
    function calc() {
      const r = [0, 1, 2].map(i => unitPrice(num(el, '#p' + i), num(el, '#q' + i), $('#u' + i, el).value));
      const ok = r.map((x, i) => x ? { i, x } : null).filter(Boolean);
      [0, 1, 2].forEach(i => { $('#r' + i, el).style.outline = ''; const x = r[i]; $('#o' + i, el).textContent = x ? (x.dim === 'pc' ? x.label.toFixed(3) + ' per piece' : x.label.toFixed(3) + ' per ' + (x.dim === 'm' ? 'metre' : '100 ' + x.dim)) : '--'; });
      const best = $('#best', el);
      if (ok.length < 2) { best.textContent = 'Fill in at least two products'; return; }
      if (ok.some(o => o.x.dim !== ok[0].x.dim)) { best.textContent = 'Mixed units (weight, volume, pieces) cannot be compared'; return; }
      const b = ok.reduce((a, c) => c.x.perBase < a.x.perBase ? c : a), w = ok.reduce((a, c) => c.x.perBase > a.x.perBase ? c : a);
      $('#r' + b.i, el).style.outline = '2px solid var(--ok)'; $('#r' + b.i, el).style.outlineOffset = '-2px';
      best.textContent = b.x.perBase === w.x.perBase ? 'Same price per unit' : `Best value: product ${'ABC'[b.i]}, ${((1 - b.x.perBase / w.x.perBase) * 100).toFixed(0)}% cheaper than the dearest`;
    }
    el.addEventListener('input', calc); el.addEventListener('change', calc);
  } });

  /* ================================================================== 15. Reaction timer */
  Tools.register({ id: 'reaction', name: 'Reaction Test', icon: '⚡', cat: 'measure', desc: 'Tap as soon as the screen turns green and see your reaction time in milliseconds, with your best and average.', keys: ['reflex', 'speed test', 'game', 'ms'], needs: ['storage'], render(el) {
    let state = 'idle', t = 0, to = 0; const runs = []; let best = Store.get('reaction.best', 0);
    el.innerHTML = `<div style="${wrap}"><button id="pad" style="width:100%;height:280px;border:0;border-radius:24px;font-size:24px;font-weight:700;touch-action:manipulation;transition:background .15s;background:var(--accent);color:var(--accent-t)">Tap to start</button>
      <div class="row"><div class="card center" style="padding:10px"><div style="${LBL}">Last</div><div class="mid" id="la" style="font-size:24px">--</div></div><div class="card center" style="padding:10px"><div style="${LBL}">Average</div><div class="mid" id="av" style="font-size:24px">--</div></div><div class="card center" style="padding:10px"><div style="${LBL}">Best</div><div class="mid" id="be" style="font-size:24px">${best ? best + ' ms' : '--'}</div></div></div>
      <div style="${NOTE}">Average human reaction time to a visual signal is about 250 ms.</div></div>`;
    const pad = $('#pad', el);
    const set = (txt, bg, fg) => { pad.textContent = txt; pad.style.background = bg; pad.style.color = fg || '#fff'; };
    pad.onpointerdown = e => {
      e.preventDefault();
      if (state === 'idle') { state = 'wait'; set('Wait for green...', 'var(--danger)'); to = setTimeout(() => { state = 'go'; t = performance.now(); set('TAP NOW', 'var(--ok)'); }, 1200 + Math.random() * 2800); }
      else if (state === 'wait') { clearTimeout(to); state = 'idle'; set('Too soon! Tap to try again', 'var(--accent)', 'var(--accent-t)'); }
      else {
        const ms = Math.round(performance.now() - t); state = 'idle'; runs.push(ms);
        $('#la', el).textContent = ms + ' ms'; $('#av', el).textContent = Math.round(runs.reduce((a, b) => a + b, 0) / runs.length) + ' ms';
        if (!best || ms < best) { best = ms; Store.set('reaction.best', best); $('#be', el).textContent = best + ' ms'; }
        set(ms + ' ms. Tap to go again', 'var(--accent)', 'var(--accent-t)');
      }
    };
    return () => clearTimeout(to);
  } });

  /* ================================================================== 16. Magnetometer */
  Tools.register({ id: 'magnet', name: 'Magnetometer', icon: '🧲', cat: 'measure', desc: 'Magnetic field strength in microtesla, handy for finding magnets and metal. Works only on phones that expose the sensor to apps.', keys: ['magnetic', 'metal detector', 'tesla', 'field'], needs: ['motion'], render(el) {
    const LEN = 200, hist = []; let sensor = null, peak = 0, base = null;
    el.innerHTML = `<div style="${wrap}"><div class="card center" style="padding:14px 8px">${gaugeSVG('ga', 200)}<div style="margin-top:-130px;height:130px"><div class="big" id="v" style="margin:0;font-size:46px">--</div><div style="${MUTED}">µT total</div></div><div id="msg" style="${MUTED};min-height:18px">Starting sensor...</div></div>
      <div class="row"><div class="card center" style="padding:10px"><div style="${LBL}">X</div><div class="mid" id="x" style="font-size:22px">--</div></div><div class="card center" style="padding:10px"><div style="${LBL}">Y</div><div class="mid" id="y" style="font-size:22px">--</div></div><div class="card center" style="padding:10px"><div style="${LBL}">Z</div><div class="mid" id="z" style="font-size:22px">--</div></div></div>
      <div class="card"><canvas id="cv" style="${GRAPH_STYLE}"></canvas><div style="${MUTED};margin-top:8px">Peak <b id="pk" style="color:var(--text)">0</b> µT · Earth's field is about 25 to 65 µT</div></div>
      <button class="btn alt" id="rs">Zero baseline</button></div>`;
    let last = 0;
    if (!('Magnetometer' in window)) say(el, 'This phone does not expose a magnetic field sensor to apps.');
    else {
      try {
        sensor = new window.Magnetometer({ frequency: 20 });
        sensor.addEventListener('reading', () => {
          const x = sensor.x, y = sensor.y, z = sensor.z;
          if (x == null || y == null || z == null) return;
          const m = hyp(x, y, z), v = base == null ? m : Math.abs(m - base);
          say(el, base == null ? 'Live reading' : 'Showing change from baseline');
          $('#v', el).textContent = v.toFixed(0); $('#x', el).textContent = x.toFixed(0); $('#y', el).textContent = y.toFixed(0); $('#z', el).textContent = z.toFixed(0);
          peak = Math.max(peak, v); $('#pk', el).textContent = peak.toFixed(0);
          setGauge($('#ga', el), v / 200, v > 120 ? 'var(--danger)' : v > 80 ? '#f59e0b' : 'var(--accent)');
          const n = performance.now(); if (n - last > 50) { last = n; hist.push(v); if (hist.length > LEN) hist.shift(); graph($('#cv', el), hist, { min: 0, max: Math.max(100, Math.ceil(peak / 50) * 50), len: LEN }); }
          sensor._m = m;
        });
        sensor.addEventListener('error', e => say(el, e.error && e.error.name === 'NotAllowedError' ? 'Magnetometer permission denied.' : 'Magnetometer not available on this device.'));
        sensor.start();
      } catch (e) { say(el, 'Magnetometer not available on this device.'); }
    }
    $('#rs', el).onclick = () => { if (sensor && sensor._m) { base = base == null ? sensor._m : null; peak = 0; hist.length = 0; $('#rs', el).textContent = base == null ? 'Zero baseline' : 'Show absolute field'; } };
    return () => { try { if (sensor) sensor.stop(); } catch (e) {} };
  } });

  /* ================================================================== 17. Light meter */
  Tools.register({ id: 'lightmeter', name: 'Light Meter', icon: '🗒️', cat: 'measure', desc: 'Ambient light in lux with a plain-language label. Works only on phones that expose the sensor to apps.', keys: ['lux', 'brightness', 'illuminance', 'light'], needs: ['motion'], render(el) {
    const LEN = 200, hist = []; let sensor = null, peak = 0;
    el.innerHTML = `<div style="${wrap}"><div class="card center" style="padding:14px 8px">${gaugeSVG('ga', 200)}<div style="margin-top:-130px;height:130px"><div class="big" id="v" style="margin:0;font-size:46px">--</div><div style="${MUTED}">lux</div></div><div id="lab" style="font-size:18px;font-weight:700">--</div><div id="msg" style="${MUTED};min-height:18px">Starting sensor...</div></div>
      <div class="card"><canvas id="cv" style="${GRAPH_STYLE}"></canvas><div style="${MUTED};margin-top:8px">Peak <b id="pk" style="color:var(--text)">0</b> lux</div></div>
      <div style="${NOTE}">Approximate. Many phones do not expose the light sensor to apps; if so this tool says so instead of guessing. Typical: candle-lit 10 lux, office 400, overcast day 1000 to 10000.</div></div>`;
    if (!('AmbientLightSensor' in window)) say(el, 'This phone does not expose its light sensor to apps.');
    else {
      try {
        sensor = new window.AmbientLightSensor({ frequency: 10 });
        sensor.addEventListener('reading', () => {
          const l = sensor.illuminance; if (l == null || !isFinite(l)) return;
          say(el, 'Live reading'); peak = Math.max(peak, l);
          $('#v', el).textContent = l < 10 ? l.toFixed(1) : Math.round(l); $('#lab', el).textContent = luxLabel(l); $('#pk', el).textContent = Math.round(peak);
          setGauge($('#ga', el), Math.log10(1 + l) / 5);
          hist.push(Math.log10(1 + l)); if (hist.length > LEN) hist.shift(); graph($('#cv', el), hist, { min: 0, max: 5, len: LEN });
        });
        sensor.addEventListener('error', e => say(el, e.error && e.error.name === 'NotAllowedError' ? 'Light sensor permission denied.' : 'Light sensor not available on this device.'));
        sensor.start();
      } catch (e) { say(el, 'Light sensor not available on this device.'); }
    }
    return () => { try { if (sensor) sensor.stop(); } catch (e) {} };
  } });

  if (typeof module !== 'undefined' && module.exports) module.exports = { elevationDeg, flatTiltDeg, foldDeg, plumbAngles, heightFromAngles, distanceFromAngle, slopeFromDeg, shadowHeight, speedOf, distOf, timeOf, hms, severity, rpmFromTaps, rpmFromEnvelope, unitPrice, stepLength, paceMinPerKm, luxLabel, DIST, SPEED };
})();
