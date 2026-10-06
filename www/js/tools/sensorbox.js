'use strict';
/* Hardware sensor tools. Android's WebView cannot read most phone sensors from a web page (magnetometer, light, pressure,
   temperature, proximity, gyroscope...), so these tools use the native "PocketSensors" plugin through the Sens helper below.
   In a browser the plugin is missing and each tool says so instead of failing. Everything stops when you leave a tool. */
(() => {
  const SP = (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.PocketSensors) || null; // the native bridge exposes plugins as Capacitor.Plugins.<Name>
  const isNative = () => !!(SP && (typeof Capacitor.isNativePlatform !== 'function' || Capacitor.isNativePlatform()));
  const subs = new Map();
  let listening = false;
  function ensure() {
    if (listening || !SP) return; listening = true;
    SP.addListener('sensor', ev => { const s = subs.get(String(ev.type)); if (s) s.forEach(cb => { try { cb(ev); } catch (e) { /* a tool's own bug must not stop the others */ } }); });
  }
  /* Sens.start('magnetic', cb) -> { available, info, stop() }. cb gets { type, values:[...], accuracy, t }. */
  const Sens = {
    native: isNative,
    async has(type) { if (!isNative()) return false; try { return !!(await SP.hasSensor({ type })).available; } catch (e) { return false; } },
    async list() { if (!isNative()) return []; try { return (await SP.listSensors()).sensors || []; } catch (e) { return []; } },
    async battery() { if (!isNative()) return null; try { return await SP.batteryInfo(); } catch (e) { return null; } },
    async network() { if (!isNative()) return null; try { return await SP.networkSignal(); } catch (e) { return null; } },
    async start(type, cb, opts) {
      if (!isNative()) return { available: false, reason: 'web', stop() {} };
      ensure();
      const key = String(type); let set = subs.get(key); if (!set) subs.set(key, set = new Set());
      set.add(cb);
      let info;
      try { info = await SP.startSensor(Object.assign({ type: key }, opts || {})); } catch (e) { set.delete(cb); return { available: false, reason: 'error', stop() {} }; }
      if (!info || !info.available) { set.delete(cb); return { available: false, reason: 'none', stop() {} }; }
      let done = false;
      return { available: true, info, stop() { if (done) return; done = true; set.delete(cb); if (!set.size) { subs.delete(key); try { SP.stopSensor({ type: key }); } catch (e) { /* ignore */ } } } };
    }
  };
  window.Sens = Sens;

  const WEB_MSG = 'This tool reads a hardware sensor, so it works only in the installed PocketKit app, not in a web browser.';
  const NONE_MSG = (what) => 'This phone does not have ' + what + ', or Android does not let apps read it.';
  const card = (inner, style) => '<div class="card"' + (style ? ' style="' + style + '"' : '') + '>' + inner + '</div>';
  const note = (t) => '<p class="muted center" style="font-size:12px;margin:2px 8px">' + t + '</p>';
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fix = (v, d) => (Number.isFinite(v) ? (Math.abs(v) < 0.5 * Math.pow(10, -d) ? 0 : v).toFixed(d) : '--'); // never shows -0
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';

  /* A small line chart on a canvas, drawn from an array of numbers. */
  function spark(cv, arr, lo, hi) {
    if (!cv || !cv.getContext) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2), w = cv.clientWidth || 300, h = cv.clientHeight || 90;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    g.fillStyle = css('--surface2'); g.fillRect(0, 0, w, h);
    if (arr.length < 2) return;
    let a = lo, b = hi; if (a == null) a = Math.min(...arr); if (b == null) b = Math.max(...arr); if (b - a < 1e-9) { a -= 1; b += 1; }
    g.strokeStyle = css('--accent'); g.lineWidth = 2; g.beginPath();
    arr.forEach((v, i) => { const x = i / (arr.length - 1) * (w - 8) + 4, y = h - 6 - (clamp(v, a, b) - a) / (b - a) * (h - 12); i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.stroke();
  }
  const CANVAS = (id) => '<canvas id="' + id + '" style="width:100%;height:90px;display:block;border-radius:12px;touch-action:pan-y;background:var(--surface2);border:0"></canvas>';

  /* Common start-up for a one-sensor tool: shows a message when it cannot run. */
  async function begin(el, key, what, onValue, opts) {
    const msg = $('#msg', el);
    if (!isNative()) { msg.textContent = WEB_MSG; return null; }
    const h = await Sens.start(key, onValue, opts);
    if (!h.available) { msg.textContent = h.reason === 'none' ? NONE_MSG(what) : 'The sensor could not be started.'; return null; }
    msg.textContent = '';
    return h;
  }

  /* ------------------------------------------------------------------ Sensor List (Pro) */
  const UNITS = { accelerometer: 'm/s²', gyroscope: 'rad/s', magnetic_field: 'µT', light: 'lx', pressure: 'hPa', ambient_temperature: '°C', relative_humidity: '%', proximity: 'cm', gravity: 'm/s²', linear_acceleration: 'm/s²', step_counter: 'steps', heart_rate: 'bpm' };
  const shortType = (t) => String(t || '').replace(/^android\.sensor\./, '').replace(/^com\.[a-z0-9_.]+\./, '');
  Tools.register({ id: 'sensorlist', pro: true, proKey: 'sensors', name: 'Sensor List', icon: '🪐', cat: 'measure', pro: true, proKey: 'sensors', desc: 'Lists every sensor in your phone with its range and maker, and shows live readings of any sensor you tap.', keys: ['sensors', 'hardware', 'accelerometer', 'gyroscope', 'magnetometer'], needs: ['motion'], render(el) {
    el.innerHTML = '<div id="msg" class="muted center" style="min-height:18px"></div>' +
      '<div class="card" id="live" hidden><b id="ln"></b><div class="muted" id="lt" style="font-size:12px"></div><div class="mid" id="lv" style="margin:8px 0;word-break:break-all" aria-live="polite">--</div><div class="muted center" id="la" style="font-size:12px"></div>' + CANVAS('lc') + '<button class="btn alt" id="lx" style="width:100%;margin-top:8px">Stop</button></div>' +
      '<div class="muted" id="sum"></div><div class="list" id="rows"></div>';
    let h = null, gone = false, series = [];
    const stopLive = () => { if (h) h.stop(); h = null; $('#live', el).hidden = true; series = []; };
    async function pick(s) {
      stopLive(); series = [];
      const unit = UNITS[shortType(s.typeName)] || '';
      $('#live', el).hidden = false; $('#ln', el).textContent = s.name; $('#lt', el).textContent = shortType(s.typeName) + (s.vendor ? ' · ' + s.vendor : ''); $('#lv', el).textContent = '...'; $('#la', el).textContent = '';
      const hh = await Sens.start(String(s.type), ev => {
        if (gone) return;
        const v = ev.values || [];
        $('#lv', el).textContent = v.map(x => fix(x, Math.abs(x) >= 100 ? 1 : 3)).join(' , ') + (unit ? ' ' + unit : '');
        $('#la', el).textContent = 'Accuracy: ' + (['unreliable', 'low', 'medium', 'high'][ev.accuracy] || '--');
        series.push(Math.hypot(...v)); if (series.length > 120) series.shift(); spark($('#lc', el), series);
      });
      if (gone) { hh.stop(); return; }
      if (!hh.available) { $('#lv', el).textContent = 'This sensor cannot be read live (it may be a one-shot or wake-up sensor).'; return; }
      h = hh;
    }
    $('#lx', el).onclick = stopLive;
    (async () => {
      if (!isNative()) { $('#msg', el).textContent = WEB_MSG; return; }
      const list = (await Sens.list()).filter(s => !/wake-?up/i.test(s.name) || true).sort((a, b) => a.name.localeCompare(b.name));
      if (gone) return;
      if (!list.length) { $('#msg', el).textContent = 'No sensors reported.'; return; }
      $('#sum', el).textContent = list.length + ' sensors found. Tap one for live readings.';
      $('#rows', el).innerHTML = list.map((s, i) => '<button class="item" data-i="' + i + '" style="text-align:left;width:100%;min-height:56px;cursor:pointer"><span class="grow"><b>' + esc(s.name) + '</b><br><small class="muted">' + esc(shortType(s.typeName)) + ' · range ' + esc(fix(s.maxRange, 2)) + (UNITS[shortType(s.typeName)] ? ' ' + UNITS[shortType(s.typeName)] : '') + ' · ' + esc(s.vendor || '') + '</small></span></button>').join('');
      $('#rows', el).onclick = (e) => { const b = e.target.closest('button[data-i]'); if (b) pick(list[+b.dataset.i]); };
    })();
    return () => { gone = true; stopLive(); };
  } });

  /* ------------------------------------------------------------------ Metal Detector */
  Tools.register({ id: 'metaldetect', name: 'Metal Detector', icon: '⛏️', cat: 'measure', desc: 'Detects magnetic metal (iron and steel) near the top of your phone by the change in the magnetic field, with a rising beep. It will not find gold, silver, copper or aluminium.', keys: ['magnetometer', 'magnet', 'iron', 'steel', 'stud'], needs: ['motion'], render(el) {
    el.innerHTML = '<div id="msg" class="muted center" style="min-height:18px"></div>' +
      card('<div class="center muted" style="font-size:13px">Magnetic field</div><div class="big" id="val" aria-live="polite">--</div><div class="center muted">µT</div><div class="progress" style="margin:12px 0" aria-hidden="true"><i id="bar" style="width:0%"></i></div><div class="row center"><div><div class="mid" id="base">--</div><small class="muted">Baseline µT</small></div><div><div class="mid" id="dlt">--</div><small class="muted">Change µT</small></div></div>' + CANVAS('mc')) +
      '<label class="f">Sensitivity <span class="muted" id="sl">20 µT</span><input type="range" id="sens" min="2" max="100" step="1" value="20" aria-label="Sensitivity"></label>' +
      '<label class="item"><span class="grow">Sound</span><input type="checkbox" id="snd" checked></label><label class="item"><span class="grow">Vibrate</span><input type="checkbox" id="vib" checked></label>' +
      '<button class="btn" id="cal" style="width:100%">Set baseline here</button>' + note('Hold the phone away from metal, speakers and magnetic cases, press "Set baseline here", then sweep slowly. The sensor sits near the top of the phone. Never use this to look for anything dangerous.');
    let h = null, gone = false, ema = null, base = null, calUntil = 0, calSum = 0, calN = 0, series = [], ctx = null, osc = null, gain = null, nextBeep = 0, timer = null;
    const level = () => base == null || ema == null ? 0 : clamp(Math.abs(ema - base) / +$('#sens', el).value, 0, 1);
    $('#sens', el).oninput = () => { $('#sl', el).textContent = $('#sens', el).value + ' µT'; };
    $('#cal', el).onclick = () => { calUntil = Date.now() + 1200; calSum = 0; calN = 0; };
    function beepLoop() {
      if (gone) return; const lv = level(), now = Date.now();
      if (lv > 0.08 && now >= nextBeep) {
        const gap = 700 - lv * 620; nextBeep = now + gap;
        if ($('#snd', el).checked) {
          try {
            ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume();
            const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 400 + lv * 1400; g.gain.value = 0.12; o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.06);
          } catch (e) { /* no audio */ }
        }
        if ($('#vib', el).checked && navigator.vibrate) navigator.vibrate(30);
      }
      timer = setTimeout(beepLoop, 40);
    }
    begin(el, 'magnetic', 'a magnetic field sensor', ev => {
      if (gone) return; const v = ev.values; if (!v || v.length < 3) return;
      const m = Math.hypot(v[0], v[1], v[2]); ema = ema == null ? m : ema * 0.7 + m * 0.3;
      if (base == null) { calSum += m; calN++; if (calN >= 6) { base = calSum / calN; } }
      else if (Date.now() < calUntil) { calSum += m; calN++; if (calN) base = calSum / calN; }
      else if (calUntil && Date.now() >= calUntil) { calUntil = 0; }
      $('#val', el).textContent = fix(ema, 1); $('#base', el).textContent = base == null ? '...' : fix(base, 1); $('#dlt', el).textContent = base == null ? '--' : fix(ema - base, 1);
      $('#bar', el).style.width = Math.round(level() * 100) + '%';
      series.push(ema); if (series.length > 120) series.shift(); spark($('#mc', el), series, base == null ? null : base - Math.max(5, +$('#sens', el).value), base == null ? null : base + Math.max(5, +$('#sens', el).value));
    }, { minGapMs: 40 }).then(hh => { if (gone) { if (hh) hh.stop(); return; } h = hh; if (hh) beepLoop(); });
    return () => { gone = true; clearTimeout(timer); if (h) h.stop(); try { if (ctx) ctx.close(); } catch (e) { /* ignore */ } };
  } });

  /* ------------------------------------------------------------------ Barometer */
  Tools.register({ id: 'barometer', name: 'Barometer', icon: '☁️', cat: 'measure', desc: 'Air pressure in hPa with a trend line, a rising or falling hint, and an estimate of your height above sea level.', keys: ['pressure', 'weather', 'altitude', 'hpa', 'mbar'], needs: ['motion'], render(el) {
    el.innerHTML = '<div id="msg" class="muted center" style="min-height:18px"></div>' +
      card('<div class="center muted" style="font-size:13px">Air pressure</div><div class="big" id="p" aria-live="polite">--</div><div class="center muted">hPa</div><div class="center" id="tr" style="margin:6px 0;font-weight:600"></div>' + CANVAS('pc')) +
      card('<div class="row"><div class="center"><div class="mid" id="alt">--</div><small class="muted">Height (m)</small></div><div class="center"><div class="mid" id="altf">--</div><small class="muted">Height (ft)</small></div></div>' +
        '<label class="f" style="margin-top:10px">Sea-level pressure (hPa)<input type="number" id="p0" min="900" max="1100" step="0.1" value="1013.25" inputmode="decimal"></label>' +
        '<label class="f" style="margin-top:8px">Or: I am at this height (m)<input type="number" id="known" min="-400" max="9000" step="1" placeholder="e.g. 120" inputmode="numeric"></label>' +
        '<button class="btn alt" id="set" style="width:100%;margin-top:8px">Set sea-level pressure from my height</button>') +
      note('Pressure changes with weather as well as height, so the height is only an estimate (often 10 to 50 m off). Calibrate with a known height for a better figure.');
    let h = null, gone = false, p = null, hist = [], lastPush = 0;
    const p0 = () => { const v = Valid.num($('#p0', el).value); return v && v >= 900 && v <= 1100 ? v : 1013.25; };
    const heightM = (pp) => 44330 * (1 - Math.pow(pp / p0(), 1 / 5.255));
    function show() {
      if (p == null) return;
      $('#p', el).textContent = fix(p, 1);
      const a = heightM(p); $('#alt', el).textContent = fix(a, 0); $('#altf', el).textContent = fix(a * 3.28084, 0);
    }
    $('#p0', el).oninput = show;
    $('#set', el).onclick = () => { const k = Valid.num($('#known', el).value); if (p == null || k == null || k < -400 || k > 9000) { toast('Enter your height in metres first'); return; } $('#p0', el).value = fix(p / Math.pow(1 - k / 44330, 5.255), 1); show(); };
    begin(el, 'pressure', 'a barometer', ev => {
      if (gone) return; const v = ev.values && ev.values[0]; if (!Number.isFinite(v) || v < 300 || v > 1100) return;
      p = p == null ? v : p * 0.9 + v * 0.1; show();
      const now = Date.now(); if (now - lastPush > 3000) { lastPush = now; hist.push({ t: now, p }); if (hist.length > 200) hist.shift(); spark($('#pc', el), hist.map(x => x.p));
        const old = hist.find(x => now - x.t <= 10 * 60000 && now - x.t >= 5 * 60000);
        if (old) { const d = (p - old.p) / ((now - old.t) / 3600000); $('#tr', el).textContent = Math.abs(d) < 0.5 ? 'Steady' : (d > 0 ? 'Rising ' : 'Falling ') + fix(Math.abs(d), 1) + ' hPa per hour'; } }
    }).then(hh => { if (gone) { if (hh) hh.stop(); return; } h = hh; });
    return () => { gone = true; if (h) h.stop(); };
  } });

  /* ------------------------------------------------------------------ Room Temperature */
  Tools.register({ id: 'roomtemp', name: 'Room Temperature', icon: '💨', cat: 'measure', desc: 'Room temperature from the phone sensor when it has one. Most phones do not, so it also shows the battery temperature and says which one it is.', keys: ['temperature', 'thermometer', 'humidity', 'battery temperature'], needs: ['motion'], render(el) {
    el.innerHTML = '<div id="msg" class="muted center" style="min-height:18px"></div>' +
      card('<div class="center muted" style="font-size:13px" id="what">Reading...</div><div class="big" id="t" aria-live="polite">--</div><div class="center muted" id="u">°C</div><div class="center muted" id="hum" style="margin-top:6px"></div>') +
      '<div class="row"><button class="btn alt" id="uc" aria-pressed="true">°C</button><button class="btn alt" id="uf" aria-pressed="false">°F</button></div>' +
      note('Phones rarely have a room-temperature sensor. The battery temperature is not the room temperature: it is usually several degrees warmer, especially while charging.');
    let h = null, hh = null, gone = false, f = false, c = null, kind = '', timer = null;
    const paint = () => { if (c == null) return; $('#t', el).textContent = fix(f ? c * 9 / 5 + 32 : c, 1); $('#u', el).textContent = f ? '°F' : '°C'; $('#what', el).textContent = kind === 'room' ? 'Room temperature (phone sensor)' : 'Battery temperature (no room sensor in this phone)'; };
    const mark = () => { $('#uc', el).className = 'btn' + (f ? ' alt' : ''); $('#uf', el).className = 'btn' + (f ? '' : ' alt'); $('#uc', el).setAttribute('aria-pressed', String(!f)); $('#uf', el).setAttribute('aria-pressed', String(f)); };
    $('#uc', el).onclick = () => { f = false; mark(); paint(); };
    $('#uf', el).onclick = () => { f = true; mark(); paint(); };
    mark();
    (async () => {
      if (!isNative()) { $('#msg', el).textContent = WEB_MSG; return; }
      const hasRoom = await Sens.has('temperature');
      if (gone) return;
      if (hasRoom) {
        kind = 'room';
        h = await Sens.start('temperature', ev => { if (gone) return; const v = ev.values && ev.values[0]; if (Number.isFinite(v) && v > -60 && v < 100) { c = v; paint(); } });
        if (gone && h) h.stop();
      } else {
        kind = 'battery';
        const poll = async () => { const b = await Sens.battery(); if (gone) return; if (b && Number.isFinite(b.temperatureC)) { c = b.temperatureC; paint(); } else $('#msg', el).textContent = 'Temperature is not available on this phone.'; timer = setTimeout(poll, 5000); };
        poll();
      }
      if (await Sens.has('humidity')) { hh = await Sens.start('humidity', ev => { if (gone) return; const v = ev.values && ev.values[0]; if (Number.isFinite(v)) $('#hum', el).textContent = 'Humidity ' + fix(v, 0) + '%'; }); if (gone && hh) hh.stop(); }
    })();
    return () => { gone = true; clearTimeout(timer); if (h) h.stop(); if (hh) hh.stop(); };
  } });

  /* ------------------------------------------------------------------ Proximity */
  Tools.register({ id: 'proximity', name: 'Proximity Test', icon: '🖐️', cat: 'measure', desc: 'Tests the proximity sensor next to your phone speaker: wave a hand over the top of the screen and watch near and far change.', keys: ['proximity', 'sensor test', 'near', 'far'], needs: ['motion'], render(el) {
    el.innerHTML = '<div id="msg" class="muted center" style="min-height:18px"></div>' +
      card('<div id="orb" style="width:140px;height:140px;border-radius:50%;margin:8px auto;display:grid;place-items:center;font-size:22px;font-weight:700;background:var(--surface2);transition:background .15s" aria-live="polite">--</div><div class="mid" id="cm">--</div><div class="center muted">distance reported (cm)</div><div class="center muted" style="margin-top:6px">Times covered: <b id="cnt">0</b></div>') +
      '<button class="btn alt" id="rs" style="width:100%">Reset counter</button>' + note('Most phones report only two values: near (0 cm) and far (about 5 cm).');
    let h = null, gone = false, near = null, count = 0, max = 5;
    $('#rs', el).onclick = () => { count = 0; $('#cnt', el).textContent = '0'; };
    begin(el, 'proximity', 'a proximity sensor', ev => {
      if (gone) return; const v = ev.values && ev.values[0]; if (!Number.isFinite(v)) return;
      const n = v < Math.min(max, 5) * 0.8 || v < 1; $('#cm', el).textContent = fix(v, 1);
      if (n !== near) { near = n; if (n) { count++; $('#cnt', el).textContent = String(count); if (navigator.vibrate) navigator.vibrate(20); } $('#orb', el).textContent = n ? 'NEAR' : 'FAR'; $('#orb', el).style.background = n ? 'var(--accent)' : 'var(--surface2)'; $('#orb', el).style.color = n ? 'var(--accent-t)' : 'var(--text)'; }
    }).then(hh => { if (gone) { if (hh) hh.stop(); return; } h = hh; if (hh && hh.info && hh.info.maxRange) max = hh.info.maxRange; });
    return () => { gone = true; if (h) h.stop(); };
  } });

  /* ------------------------------------------------------------------ Signal Strength */
  const bars = (type, dbm) => {
    if (!Number.isFinite(dbm)) return 0;
    const t = type === 'wifi' ? [-50, -60, -70, -80] : [-80, -90, -100, -110];
    return dbm >= t[0] ? 4 : dbm >= t[1] ? 3 : dbm >= t[2] ? 2 : dbm >= t[3] ? 1 : 0;
  };
  Tools.register({ id: 'signal', name: 'Signal Strength', icon: '🛜', cat: 'measure', desc: 'Shows how strong your current Wi-Fi or mobile signal is in dBm, with bars, link speed and a live graph, so you can find the best spot in a room.', keys: ['wifi', 'wi-fi', 'network', 'dbm', 'cellular', 'mobile', 'reception'], needs: ['network'], render(el) {
    el.innerHTML = '<div id="msg" class="muted center" style="min-height:18px"></div>' +
      card('<div class="center muted" id="kind" style="font-size:13px">Checking...</div><div class="big" id="dbm" aria-live="polite">--</div><div class="center muted">dBm</div><div class="center" id="bars" style="font-size:34px;letter-spacing:4px;margin:6px 0" aria-hidden="true"></div><div class="center" id="q" style="font-weight:700"></div>' + CANVAS('sc')) +
      card('<div class="list" id="info"></div>') +
      note('Closer to 0 is stronger: Wi-Fi above -60 dBm is good, below -80 is weak. Mobile above -90 is good, below -105 is weak. Walk around and watch the number.');
    let gone = false, timer = null, series = [];
    const row = (k, v) => '<div class="item"><span class="grow">' + esc(k) + '</span><b>' + esc(v) + '</b></div>';
    async function poll() {
      const n = await Sens.network(); if (gone) return;
      if (!n) { $('#msg', el).textContent = isNative() ? 'Network details are not available.' : WEB_MSG; return; }
      const names = { wifi: 'Wi-Fi', cellular: 'Mobile data', ethernet: 'Ethernet', bluetooth: 'Bluetooth', other: 'Other network', none: 'Not connected' };
      $('#kind', el).textContent = names[n.type] || n.type;
      const has = Number.isFinite(n.dbm);
      $('#dbm', el).textContent = has ? String(n.dbm) : '--';
      const b = bars(n.type, n.dbm);
      $('#bars', el).textContent = has ? '▂▄▆█'.split('').map((ch, i) => i < b ? ch : '·').join(' ') : '';
      $('#q', el).textContent = !has ? (n.type === 'none' ? 'No connection' : 'Android did not report a signal level') : ['Very weak', 'Weak', 'Fair', 'Good', 'Excellent'][b];
      if (has) { series.push(n.dbm); if (series.length > 90) series.shift(); spark($('#sc', el), series, -120, -30); }
      $('#info', el).innerHTML = [n.type !== 'none' ? row('Internet works', n.validated ? 'Yes' : 'Not confirmed') : '', n.linkMbps ? row('Link speed', n.linkMbps + ' Mbps') : '', n.freqMhz ? row('Band', (n.freqMhz >= 5900 ? '6 GHz' : n.freqMhz >= 4900 ? '5 GHz' : '2.4 GHz') + ' (' + n.freqMhz + ' MHz)') : '', n.downKbps ? row('Estimated down', fix(n.downKbps / 1000, 1) + ' Mbps') : '', n.upKbps ? row('Estimated up', fix(n.upKbps / 1000, 1) + ' Mbps') : '', n.type !== 'none' ? row('Metered', n.metered ? 'Yes' : 'No') : ''].join('');
      timer = setTimeout(poll, 1000);
    }
    poll();
    return () => { gone = true; clearTimeout(timer); };
  } });

  /* ------------------------------------------------------------------ Gyroscope */
  Tools.register({ id: 'gyro', name: 'Gyroscope', icon: '🌪️', cat: 'measure', desc: 'Shows how fast your phone is turning around each axis in degrees per second, with a live graph and a peak hold.', keys: ['rotation', 'spin', 'angular velocity', 'turn rate'], needs: ['motion'], render(el) {
    el.innerHTML = '<div id="msg" class="muted center" style="min-height:18px"></div>' +
      card('<div class="center muted" style="font-size:13px">Total turning speed</div><div class="big" id="tot" aria-live="off">--</div><div class="center muted">degrees per second</div>' + CANVAS('gc') + '<div class="row center" style="margin-top:8px"><div><div class="mid" id="gx">--</div><small class="muted">X</small></div><div><div class="mid" id="gy">--</div><small class="muted">Y</small></div><div><div class="mid" id="gz">--</div><small class="muted">Z</small></div></div>') +
      card('<div class="row center"><div><div class="mid" id="pk">0</div><small class="muted">Peak °/s</small></div><button class="btn alt" id="rs" style="flex:none">Reset peak</button></div>') +
      note('X runs across the screen, Y up the screen and Z out of the screen. Spin the phone slowly flat on a table to see Z.');
    let h = null, gone = false, series = [], peak = 0, lastDraw = 0;
    $('#rs', el).onclick = () => { peak = 0; $('#pk', el).textContent = '0'; };
    begin(el, 'gyroscope', 'a gyroscope', ev => {
      if (gone) return; const v = ev.values; if (!v || v.length < 3) return;
      const d = v.map(x => x * 180 / Math.PI), t = Math.hypot(d[0], d[1], d[2]);
      $('#tot', el).textContent = fix(t, 0); $('#gx', el).textContent = fix(d[0], 0); $('#gy', el).textContent = fix(d[1], 0); $('#gz', el).textContent = fix(d[2], 0);
      if (t > peak) { peak = t; $('#pk', el).textContent = fix(peak, 0); }
      series.push(t); if (series.length > 120) series.shift(); const now = Date.now(); if (now - lastDraw > 80) { lastDraw = now; spark($('#gc', el), series, 0, Math.max(30, ...series)); }
    }, { minGapMs: 30 }).then(hh => { if (gone) { if (hh) hh.stop(); return; } h = hh; });
    return () => { gone = true; if (h) h.stop(); };
  } });
})();
