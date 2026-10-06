'use strict';
/* Audio tools: metronome, tone generator, tuner, mike, recorder, piano, spectrum, sleep sounds and more.
   Everything runs offline with Web Audio. Each tool cleans up its AudioContexts, streams and timers on leave. */
(function () {

// <pure>
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function freqToMidi(f) { return 69 + 12 * Math.log2(f / 440); }
function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }
function noteName(m) { return NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1); }
function noteInfo(f) {
  const m = freqToMidi(f), r = Math.round(m);
  return { midi: r, name: NOTE_NAMES[((r % 12) + 12) % 12], oct: Math.floor(r / 12) - 1, cents: Math.round((m - r) * 100), freq: f };
}
function rms(buf) { let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i]; return Math.sqrt(s / buf.length); }
/* YIN pitch detection. Returns { freq, prob } or null when no clear pitch is found. */
function yinPitch(buf, sr, minF, maxF, thr) {
  minF = minF || 30; maxF = maxF || 2000; thr = thr || 0.12;
  const W = Math.floor(buf.length / 2);
  const tauMax = Math.min(W - 1, Math.floor(sr / minF)), tauMin = Math.max(2, Math.floor(sr / maxF));
  if (tauMax <= tauMin + 2) return null;
  const d = new Float32Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let s = 0;
    for (let j = 0; j < W; j++) { const x = buf[j] - buf[j + tau]; s += x * x; }
    d[tau] = s;
  }
  let run = 0; d[0] = 1;
  for (let tau = 1; tau <= tauMax; tau++) { run += d[tau]; d[tau] = run ? d[tau] * tau / run : 1; }
  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (d[t] < thr) { while (t + 1 <= tauMax && d[t + 1] < d[t]) t++; tau = t; break; }
  }
  if (tau < 0) return null;
  let better = tau;
  if (tau > 1 && tau < tauMax) {
    const a = d[tau - 1], b = d[tau], c = d[tau + 1], den = 2 * (a - 2 * b + c);
    if (den !== 0) better = tau + (a - c) / den;
  }
  return { freq: sr / better, prob: Math.max(0, 1 - d[tau]) };
}
function median(a) { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; }
const CHORDS = { 'Major': [0, 4, 7], 'Minor': [0, 3, 7], 'Dominant 7': [0, 4, 7, 10], 'Major 7': [0, 4, 7, 11], 'Minor 7': [0, 3, 7, 10], 'Diminished': [0, 3, 6], 'Augmented': [0, 4, 8], 'Sus2': [0, 2, 7], 'Sus4': [0, 5, 7], '6th': [0, 4, 7, 9], 'Add9': [0, 4, 7, 14] };
const SCALES = { 'Major': [0, 2, 4, 5, 7, 9, 11], 'Natural minor': [0, 2, 3, 5, 7, 8, 10], 'Harmonic minor': [0, 2, 3, 5, 7, 8, 11], 'Major pentatonic': [0, 2, 4, 7, 9], 'Minor pentatonic': [0, 3, 5, 7, 10], 'Blues': [0, 3, 5, 6, 7, 10], 'Dorian': [0, 2, 3, 5, 7, 9, 10], 'Mixolydian': [0, 2, 4, 5, 7, 9, 10], 'Chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] };
function logSlider(v, lo, hi) { return lo * Math.pow(hi / lo, v / 1000); }
function logSliderInv(f, lo, hi) { return Math.round(1000 * Math.log(f / lo) / Math.log(hi / lo)); }
// </pure>

const clamp = (v, a, b) => Math.min(b, Math.max(a, isNaN(v) ? a : v));
const setText = (el, sel, t) => { const n = $(sel, el); if (n) n.textContent = t; };
/* close() on an already closed AudioContext rejects, so guard it and swallow the rejection. */
const closeCtx = (c) => { try { if (c && c.state !== 'closed') { const p = c.close(); if (p && p.catch) p.catch(() => {}); } } catch (e) { /* ignore */ } };
const stopStream = (s) => { if (s) s.getTracks().forEach(t => { try { t.stop(); } catch (e) { /* ignore */ } }); };
/* Safety limiter for generated tones: a compressor in front of the speakers. */
function limiter(ctx) { const c = ctx.createDynamicsCompressor(); c.threshold.value = -18; c.knee.value = 6; c.ratio.value = 12; c.attack.value = 0.003; c.release.value = 0.1; c.connect(ctx.destination); return c; }
/* Fade a tone to silence, then run the real cleanup, so leaving the tool does not click. */
function fadeLeave(L, ctx, g) {
  if (ctx && g && ctx.state !== 'closed') { try { g.gain.cancelScheduledValues(ctx.currentTime); g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.015); } catch (e) { /* ignore */ } setTimeout(() => L.stop(), 90); }
  else L.stop();
}

/* Lifecycle helper: tracks contexts, streams, timers so one stop() cleans everything. */
function life() {
  const o = {
    alive: true, ctxs: [], streams: [], fns: [],
    ctx() { const C = window.AudioContext || window.webkitAudioContext; const c = new C(); o.ctxs.push(c); if (c.resume) c.resume(); return c; },
    mic(c) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Promise.reject(new Error('nomic'));
      return navigator.mediaDevices.getUserMedia({ audio: c || { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }).then(s => {
        if (!o.alive) { s.getTracks().forEach(t => t.stop()); throw new Error('gone'); }
        o.streams.push(s); return s;
      });
    },
    drop(s) { stopStream(s); o.streams = o.streams.filter(x => x !== s); },
    on(fn) { o.fns.push(fn); },
    raf(fn) { let id; const loop = () => { if (!o.alive) return; try { fn(); } catch (e) { } id = requestAnimationFrame(loop); }; loop(); o.fns.push(() => cancelAnimationFrame(id)); },
    every(fn, ms) { const id = setInterval(fn, ms); o.fns.push(() => clearInterval(id)); return id; },
    stop() {
      o.alive = false;
      o.fns.forEach(f => { try { f(); } catch (e) { } });
      o.streams.forEach(stopStream);
      o.ctxs.forEach(closeCtx);
    }
  };
  return o;
}
function micFail(el, e, sel) {
  if (e && e.message === 'gone') return;
  const m = $(sel || '#msg', el); if (!m) return;
  m.textContent = (e && e.name === 'NotAllowedError') ? 'Microphone permission was denied. Allow it in the app settings.' : 'Microphone is not available on this device.';
}
/* loop: true crossfades the end of the buffer into its start (0.3 s, equal power) so a looped source has no click at the seam. */
function noiseBuf(ctx, type, secs, loop) {
  const n = Math.floor(ctx.sampleRate * secs), X = loop ? Math.min(Math.floor(ctx.sampleRate * 0.3), n >> 1) : 0, tot = n + X;
  const b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0), raw = X ? new Float32Array(tot) : d;
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < tot; i++) {
    const w = Math.random() * 2 - 1;
    if (type === 'pink') {
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      raw[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
    } else if (type === 'brown') { last = (last + 0.02 * w) / 1.02; raw[i] = last * 3.5; }
    else raw[i] = w;
  }
  if (X) {
    // The extra X samples after the end are the natural continuation; fade them in over the start.
    for (let i = 0; i < n; i++) d[i] = raw[i];
    for (let i = 0; i < X; i++) { const a = (i + 0.5) / X * Math.PI / 2; d[i] = raw[i] * Math.sin(a) + raw[n + i] * Math.cos(a); }
  }
  return b;
}
function blobToB64(blob) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
}
const CHUNK = 3 * 1024 * 1024; // multiple of 3 so each base64 piece joins cleanly
async function saveBlob(blob, name) {
  const P = window.Capacitor && Capacitor.Plugins;
  if (P && P.Filesystem && P.Share) {
    let uri = null;
    try {
      // Write in pieces so a long recording is never held as one huge base64 string.
      for (let off = 0; off === 0 || off < blob.size; off += CHUNK) {
        const data = await blobToB64(blob.slice(off, off + CHUNK));
        if (off === 0) uri = (await P.Filesystem.writeFile({ path: name, data, directory: 'CACHE' })).uri;
        else await P.Filesystem.appendFile({ path: name, data, directory: 'CACHE' });
      }
    } catch (e) { uri = null; }
    if (uri) {
      try { await P.Share.share({ title: name, url: uri }); } catch (e) { /* sheet closed or cancelled */ }
      // Delete the cache copy later so the receiving app has time to read it.
      setTimeout(() => { try { P.Filesystem.deleteFile({ path: name, directory: 'CACHE' }).catch(() => {}); } catch (e) { /* ignore */ } }, 60000);
      return;
    }
  }
  try {
    const f = new File([blob], name, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f] }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const u = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 4000);
}
/* Piano-style keys placed inside box. Returns [{el, midi, white}]; startMidi should be a C. */
function buildKeys(box, startMidi, count) {
  const white = [0, 2, 4, 5, 7, 9, 11];
  let nw = 0; for (let i = 0; i < count; i++) if (white.includes(i % 12)) nw++;
  const w = 100 / nw, keys = []; let wi = 0; box.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const pc = i % 12, isW = white.includes(pc), e = document.createElement('div');
    e.dataset.k = i;
    if (isW) {
      e.style.cssText = 'position:absolute;top:0;bottom:0;left:' + (wi * w) + '%;width:' + w + '%;box-sizing:border-box;background:#f4f4f4;border:1px solid #888;border-radius:0 0 6px 6px;z-index:1;display:flex;align-items:flex-end;justify-content:center;color:#555;font-size:10px;padding-bottom:3px;touch-action:none;user-select:none';
      if (pc === 0) e.textContent = 'C' + (Math.floor((startMidi + i) / 12) - 1);
      wi++;
    } else {
      const bw = w * 0.62;
      e.style.cssText = 'position:absolute;top:0;height:62%;left:' + (wi * w - bw / 2) + '%;width:' + bw + '%;background:#222;border-radius:0 0 4px 4px;z-index:2;touch-action:none';
    }
    box.appendChild(e); keys.push({ el: e, midi: startMidi + i, white: isW });
  }
  return keys;
}
function setKeyOn(k, on, color) { k.el.style.background = on ? color : (k.white ? '#f4f4f4' : '#222'); }
function newMaster(ctx, vol) {
  const g = ctx.createGain(); g.gain.value = vol;
  const c = ctx.createDynamicsCompressor(); g.connect(c); c.connect(ctx.destination);
  return g;
}
function cssVar(el, name, fb) { return (getComputedStyle(el).getPropertyValue(name) || '').trim() || fb; }

/* ---------------------------------------------------------------- Metronome */
Tools.register({ id: 'metronome', name: 'Metronome', icon: '🕰️', cat: 'audio', desc: 'Steady click from 30 to 300 BPM with accented first beat, time signatures and tap tempo, timed precisely with Web Audio.', keys: ['bpm', 'tempo', 'beat', 'tap', 'rhythm', 'music'], needs: [], render(el) {
  const L = life();
  let bpm = clamp(+Store.get('metro.bpm', 100), 30, 300), beats = clamp(+Store.get('metro.beats', 4), 1, 12) | 0;
  let playing = false, ctx = null, next = 0, beat = 0, timer = null, queue = [], taps = [], lit = -1;
  el.innerHTML = `<div class="card center"><div class="big" id="bpm">100</div><div class="muted" id="tempo">BPM</div>
    <input id="sl" type="range" min="30" max="300" aria-label="Tempo in BPM" style="width:100%">
    <div class="row"><button class="btn alt" id="m5">-5</button><button class="btn alt" id="m1">-1</button><button class="btn alt" id="p1">+1</button><button class="btn alt" id="p5">+5</button></div></div>
    <div class="card center"><div id="dots" style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;min-height:30px"></div></div>
    <label class="f">Time signature<select id="ts"></select></label>
    <div class="row"><button class="btn" id="go">Start</button><button class="btn alt" id="tap">Tap tempo</button></div>`;
  const ts = $('#ts', el);
  ts.innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9, 12].map(n => `<option value="${n}">${n}/4${n === 1 ? ' (no accent)' : ''}</option>`).join('');
  ts.value = String(beats);
  const name = b => b < 60 ? 'Largo' : b < 76 ? 'Adagio' : b < 108 ? 'Andante' : b < 120 ? 'Moderato' : b < 156 ? 'Allegro' : b < 176 ? 'Vivace' : 'Presto';
  function drawDots() {
    $('#dots', el).innerHTML = Array.from({ length: beats }, (_, i) => `<span style="width:${i === 0 ? 28 : 22}px;height:${i === 0 ? 28 : 22}px;border-radius:50%;background:var(--surface2);border:2px solid ${i === 0 ? 'var(--accent)' : 'var(--line)'};display:inline-block"></span>`).join('');
    lit = -1;
  }
  function showBpm() {
    $('#bpm', el).textContent = bpm; $('#sl', el).value = bpm; $('#tempo', el).textContent = 'BPM · ' + name(bpm);
    Store.set('metro.bpm', bpm);
  }
  function setBpm(v) { bpm = clamp(Math.round(v), 30, 300); showBpm(); }
  function click(t, accent) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = accent ? 1600 : 1000; o.type = 'square';
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(accent ? 0.7 : 0.4, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.06);
  }
  function sched() {
    while (next < ctx.currentTime + 0.12) {
      click(next, beats > 1 && beat === 0); queue.push({ t: next, b: beat });
      next += 60 / bpm; beat = (beat + 1) % beats;
    }
  }
  function start() {
    ctx = L.ctx(); playing = true; beat = 0; next = ctx.currentTime + 0.06; queue = [];
    sched(); timer = setInterval(sched, 25); $('#go', el).textContent = 'Stop';
  }
  function stop() {
    playing = false; clearInterval(timer); timer = null; queue = [];
    if (ctx) { closeCtx(ctx); ctx = null; }
    $('#go', el).textContent = 'Start'; drawDots();
  }
  L.on(() => clearInterval(timer));
  L.raf(() => {
    if (!playing || !ctx) return;
    let cur = -1;
    while (queue.length && queue[0].t <= ctx.currentTime) cur = queue.shift().b;
    if (cur >= 0 && cur !== lit) {
      const d = $$('#dots span', el);
      if (d[lit]) d[lit].style.background = 'var(--surface2)';
      if (d[cur]) d[cur].style.background = cur === 0 && beats > 1 ? 'var(--accent)' : 'var(--ok)';
      lit = cur;
    }
  });
  $('#go', el).onclick = () => playing ? stop() : start();
  $('#sl', el).oninput = e => setBpm(+e.target.value);
  [['m5', -5], ['m1', -1], ['p1', 1], ['p5', 5]].forEach(([id, d]) => $('#' + id, el).onclick = () => setBpm(bpm + d));
  ts.onchange = () => { beats = +ts.value; Store.set('metro.beats', beats); beat = 0; drawDots(); };
  $('#tap', el).onclick = () => {
    const n = performance.now();
    if (taps.length && n - taps[taps.length - 1] > 2000) taps = [];
    taps.push(n); if (taps.length > 6) taps.shift();
    if (taps.length >= 2) setBpm(60000 / ((taps[taps.length - 1] - taps[0]) / (taps.length - 1)));
  };
  showBpm(); drawDots();
  return () => { playing = false; L.stop(); };
} });

/* ---------------------------------------------------------------- Sound Generator */
Tools.register({ id: 'tonegen', name: 'Tone Generator', icon: '〰️', cat: 'audio', desc: 'Play a pure tone from 20 Hz to 20 kHz with sine, square, triangle or sawtooth waves, volume control and an optional frequency sweep.', keys: ['frequency', 'hz', 'sine', 'oscillator', 'sweep', 'signal'], needs: [], render(el) {
  const L = life();
  let ctx = null, osc = null, gain = null, playing = false, freq = 440, t0 = 0;
  el.innerHTML = `<div class="card center"><div class="big"><span id="hzv">440</span> Hz</div><div class="muted" id="nt"></div>
    <input id="sl" type="range" min="0" max="1000" aria-label="Frequency slider" style="width:100%">
    <label class="f">Frequency (Hz)<input id="num" type="number" inputmode="decimal" min="20" max="20000" step="1" value="440"></label></div>
    <label class="f">Waveform<select id="wf"><option value="sine">Sine</option><option value="square">Square</option><option value="triangle">Triangle</option><option value="sawtooth">Sawtooth</option></select></label>
    <label class="f">Volume <span id="vv">25</span>%<input id="vol" type="range" min="1" max="100" value="25" style="width:100%"></label>
    <div class="card"><label class="row" style="justify-content:flex-start"><input id="sw" type="checkbox" style="flex:none;width:auto"> <span>Sweep to a second frequency</span></label>
    <div class="row"><label class="f">To (Hz)<input id="to" type="number" inputmode="decimal" min="20" max="20000" step="1" value="2000"></label><label class="f">Seconds<select id="dur"><option>3</option><option selected>5</option><option>10</option><option>20</option></select></label></div></div>
    <button class="btn" id="go" style="width:100%">Play</button>
    <p class="muted center" style="font-size:13px">Warning: loud or very high tones can hurt your ears and damage speakers. Start at low volume and never use headphones at high volume.</p>`;
  const sl = $('#sl', el), num = $('#num', el);
  function show(f, fromSweep) {
    freq = clamp(f, 20, 20000); $('#hzv', el).textContent = Math.round(freq * 10) / 10;
    const n = noteInfo(freq); $('#nt', el).textContent = n.name + n.oct + ' ' + (n.cents >= 0 ? '+' : '') + n.cents + ' cents';
    if (!fromSweep) { sl.value = logSliderInv(freq, 20, 20000); if (osc) osc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.01); }
  }
  sl.oninput = () => { const f = Math.round(logSlider(+sl.value, 20, 20000)); num.value = f; t0 = performance.now(); show(f); };
  num.onchange = () => { num.value = clamp(Valid.num(num.value) === null ? 440 : Valid.num(num.value), 20, 20000); t0 = performance.now(); show(+num.value); };
  $('#wf', el).onchange = e => { if (osc) osc.type = e.target.value; };
  // Level is capped at 0.5 amplitude and passes through a compressor, so even 100% cannot be painfully loud.
  const level = v => Math.pow(v / 100, 2) * 0.5;
  const loudHigh = () => +$('#vol', el).value > 70 && Math.max(freq, $('#sw', el).checked ? clamp(+$('#to', el).value, 20, 20000) : 0) > 1000;
  const sure = () => confirm('The volume is high for a high-pitched tone, which can hurt your ears and damage speakers or headphones. Play anyway?');
  $('#vol', el).oninput = e => {
    const v = +e.target.value; $('#vv', el).textContent = v + (v > 70 ? ' (loud!)' : '');
    if (v > 70 && playing && loudHigh() && !sure()) { e.target.value = 70; $('#vv', el).textContent = '70'; }
    if (gain) gain.gain.setTargetAtTime(level(+e.target.value), ctx.currentTime, 0.02);
  };
  function start() {
    if (loudHigh() && !sure()) return;
    ctx = L.ctx(); osc = ctx.createOscillator(); gain = ctx.createGain();
    osc.type = $('#wf', el).value; osc.frequency.value = freq; gain.gain.value = 0.0001;
    osc.connect(gain); gain.connect(limiter(ctx)); osc.start();
    gain.gain.setTargetAtTime(level(+$('#vol', el).value), ctx.currentTime, 0.03);
    playing = true; t0 = performance.now(); $('#go', el).textContent = 'Stop';
  }
  function stop() {
    playing = false; const c = ctx, o = osc;
    if (c) { gain.gain.setTargetAtTime(0.0001, c.currentTime, 0.02); setTimeout(() => { try { o.stop(); } catch (e) { } closeCtx(c); }, 120); }
    osc = null; ctx = null; $('#go', el).textContent = 'Play';
  }
  $('#go', el).onclick = () => playing ? stop() : start();
  L.raf(() => {
    if (!playing || !$('#sw', el).checked || !osc) return;
    const to = clamp(+$('#to', el).value, 20, 20000), from = clamp(+num.value, 20, 20000), dur = +$('#dur', el).value * 1000;
    let p = ((performance.now() - t0) % (2 * dur)) / dur; if (p > 1) p = 2 - p;
    const f = from * Math.pow(to / from, p);
    osc.frequency.value = f; show(f, true);
  });
  show(440);
  return () => { playing = false; fadeLeave(L, ctx, gain); };
} });

/* ---------------------------------------------------------------- Tuner */
Tools.register({ id: 'tuner', name: 'Tuner', icon: '🎸', cat: 'audio', desc: 'Chromatic tuner using the microphone, with note, cents off and a needle, plus guitar, ukulele, bass and violin presets.', keys: ['guitar', 'ukulele', 'bass', 'violin', 'pitch', 'note', 'tune'], needs: ['microphone'], render(el) {
  const L = life();
  const INST = {
    chromatic: ['Chromatic (any note)', []], guitar: ['Guitar (E A D G B E)', [40, 45, 50, 55, 59, 64]],
    ukulele: ['Ukulele (G C E A)', [67, 60, 64, 69]], bass: ['Bass (E A D G)', [28, 33, 38, 43]], violin: ['Violin (G D A E)', [55, 62, 69, 76]]
  };
  let ctx = null, an = null, buf = null, frame = 0, miss = 0, hist = [], inst = Store.get('tuner.inst', 'chromatic'), locked = -1, running = false, pending = false;
  if (!INST[inst]) inst = 'chromatic';
  el.innerHTML = `<div class="card center"><div class="big" id="note">--</div><div class="muted" id="hz">Press Start and play a note</div>
    <div style="position:relative;height:54px;margin:12px 4px;background:var(--surface2);border-radius:10px;border:1px solid var(--line)" aria-hidden="true">
      <div style="position:absolute;left:50%;top:0;bottom:0;width:2px;background:var(--ok)"></div>
      <div id="ticks"></div><div id="needle" style="position:absolute;top:4px;bottom:4px;left:50%;width:6px;margin-left:-3px;border-radius:3px;background:var(--muted);transition:left .12s"></div></div>
    <div class="mid" id="cents">&nbsp;</div><div class="muted" id="hint">&nbsp;</div></div>
    <label class="f">Instrument<select id="inst"></select></label><div id="strings" class="row" style="flex-wrap:wrap;margin:8px 0"></div>
    <button class="btn" id="go" style="width:100%">Start tuner</button><div class="muted center" id="msg"></div>`;
  $('#ticks', el).innerHTML = [-40, -30, -20, -10, 10, 20, 30, 40].map(c => `<div style="position:absolute;left:${50 + c * 0.9}%;top:40%;bottom:40%;width:1px;background:var(--line)"></div>`).join('');
  $('#inst', el).innerHTML = Object.keys(INST).map(k => `<option value="${k}">${INST[k][0]}</option>`).join('');
  $('#inst', el).value = inst;
  function drawStrings(active) {
    $('#strings', el).innerHTML = INST[inst][1].map((m, i) => `<button class="btn ${i === active || i === locked ? '' : 'alt'}" data-i="${i}" style="flex:1;min-width:48px;padding:10px 4px">${noteName(m)}${i === locked ? ' 🔒' : ''}</button>`).join('');
    $$('#strings button', el).forEach(b => b.onclick = () => { locked = locked === +b.dataset.i ? -1 : +b.dataset.i; drawStrings(-1); });
  }
  $('#inst', el).onchange = e => { inst = e.target.value; locked = -1; Store.set('tuner.inst', inst); drawStrings(-1); };
  function idle() {
    setText(el, '#note', '--'); setText(el, '#hz', running ? 'Listening...' : 'Press Start and play a note'); setText(el, '#cents', ' '); setText(el, '#hint', ' ');
    const n = $('#needle', el); if (n) { n.style.left = '50%'; n.style.background = 'var(--muted)'; }
  }
  function show(f) {
    const m = freqToMidi(f), s = INST[inst][1]; let tm = Math.round(m), idx = -1;
    if (s.length) {
      if (locked >= 0) idx = locked;
      else { let best = 1e9; s.forEach((x, i) => { if (Math.abs(m - x) < best) { best = Math.abs(m - x); idx = i; } }); }
      tm = s[idx];
    }
    const cents = (m - tm) * 100, c = Math.round(cents), ok = Math.abs(cents) <= 5;
    setText(el, '#note', noteName(tm)); setText(el, '#hz', f.toFixed(1) + ' Hz');
    setText(el, '#cents', (c > 0 ? '+' : '') + c + ' cents');
    setText(el, '#hint', ok ? 'In tune' : cents < 0 ? 'Too low: tighten' : 'Too high: loosen');
    const n = $('#needle', el); n.style.left = (50 + clamp(cents, -50, 50) * 0.9) + '%';
    n.style.background = ok ? 'var(--ok)' : Math.abs(cents) < 20 ? 'var(--accent)' : 'var(--danger)';
    if (s.length) drawStrings(idx);
  }
  L.raf(() => {
    if (!running || !an) return;
    if ((frame++) % 2) return;
    an.getFloatTimeDomainData(buf);
    if (rms(buf) < 0.008) { if (++miss > 20) { hist = []; idle(); } return; }
    const p = yinPitch(buf, ctx.sampleRate, 30, 1400, 0.15);
    if (!p || p.prob < 0.8) { if (++miss > 20) { hist = []; idle(); } return; }
    miss = 0;
    if (hist.length && Math.abs(Math.log2(p.freq / hist[hist.length - 1])) > 0.1) hist = [];
    hist.push(p.freq); if (hist.length > 5) hist.shift();
    show(median(hist));
  });
  $('#go', el).onclick = () => {
    if (running) {
      running = false; closeCtx(ctx);
      L.streams.forEach(stopStream); L.streams = []; ctx = null; an = null;
      $('#go', el).textContent = 'Start tuner'; idle(); return;
    }
    if (pending) return;
    pending = true; setText(el, '#msg', '');
    L.mic().then(s => {
      try {
        ctx = L.ctx(); an = ctx.createAnalyser(); an.fftSize = 4096; ctx.createMediaStreamSource(s).connect(an);
        buf = new Float32Array(an.fftSize); running = true; $('#go', el).textContent = 'Stop'; idle();
      } catch (e) { L.drop(s); closeCtx(ctx); ctx = an = null; throw e; }
    }).catch(e => micFail(el, e)).then(() => { pending = false; });
  };
  drawStrings(-1);
  return () => { running = false; L.stop(); };
} });

/* ---------------------------------------------------------------- Mike */
Tools.register({ id: 'mike', name: 'Mike', icon: '📣', cat: 'audio', desc: 'Use the microphone as a loudspeaker: your voice from the mic to the phone speaker or headphones with a gain control.', keys: ['microphone', 'loudspeaker', 'amplifier', 'megaphone', 'karaoke'], needs: ['microphone'], render(el) {
  const L = life();
  let ctx = null, g = null, an = null, on = false, pending = false;
  el.innerHTML = `<div class="card" style="border-color:var(--danger)"><b>Feedback warning</b><div class="muted" style="font-size:13px;margin-top:4px">If the speaker is near the microphone you will hear a loud screech. Use wired or Bluetooth headphones, or keep the volume low. A limiter is on, but it cannot remove feedback.</div>
    <label class="row" style="justify-content:flex-start;margin-top:8px"><input id="ok" type="checkbox" style="flex:none;width:auto"> <span>I am using headphones or will keep the volume low</span></label></div>
    <div class="card center"><div class="muted">Input level</div><div class="progress" style="height:12px"><div id="lv" style="height:100%;width:0;background:var(--ok)"></div></div></div>
    <label class="f">Volume boost <span id="gv">80</span>%<input id="gain" type="range" min="0" max="300" value="80" style="width:100%"></label>
    <label class="row" style="justify-content:flex-start"><input id="ec" type="checkbox" checked style="flex:none;width:auto"> <span>Echo cancellation (reduces feedback)</span></label>
    <button class="btn" id="go" style="width:100%;margin-top:8px" disabled>Start</button><div class="muted center" id="msg"></div>`;
  $('#ok', el).onchange = e => { $('#go', el).disabled = !e.target.checked && !on; };
  $('#gain', el).oninput = e => { const v = +e.target.value; setText(el, '#gv', v); if (g) g.gain.setTargetAtTime(v / 100, ctx.currentTime, 0.02); };
  function stop() {
    on = false;
    // Stop every stream and close every context this tool opened, not just the latest.
    L.ctxs.forEach(closeCtx); L.ctxs = [];
    L.streams.forEach(stopStream); L.streams = [];
    ctx = g = an = null; $('#go', el).textContent = 'Start'; $('#lv', el).style.width = '0';
  }
  $('#go', el).onclick = () => {
    if (on) { stop(); return; }
    if (pending) return;
    pending = true; setText(el, '#msg', '');
    L.mic({ echoCancellation: $('#ec', el).checked, noiseSuppression: true, autoGainControl: false }).then(s => {
      try {
        ctx = L.ctx();
        const src = ctx.createMediaStreamSource(s); g = ctx.createGain();
        const target = +$('#gain', el).value / 100, t = ctx.currentTime;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(target, t + 0.3); // fade in so a loud start does not squeal
        const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -12; lim.ratio.value = 20; lim.attack.value = 0.003;
        an = ctx.createAnalyser(); an.fftSize = 512;
        src.connect(an); src.connect(g); g.connect(lim); lim.connect(ctx.destination);
        on = true; $('#go', el).textContent = 'Stop';
      } catch (e) { L.drop(s); closeCtx(ctx); ctx = g = an = null; throw e; }
    }).catch(e => micFail(el, e)).then(() => { pending = false; });
  };
  L.raf(() => {
    if (!on || !an) return;
    const b = new Float32Array(an.fftSize); an.getFloatTimeDomainData(b);
    $('#lv', el).style.width = Math.min(100, rms(b) * 400) + '%';
  });
  return () => { on = false; L.stop(); };
} });

/* ---------------------------------------------------------------- Voice Recorder */
Tools.register({ id: 'recorder', name: 'Voice Recorder', icon: '📼', cat: 'audio', desc: 'Record voice memos with pause and resume, then play, rename, share or delete them. Recordings are stored on the device.', keys: ['record', 'voice memo', 'dictaphone', 'audio'], needs: ['microphone', 'storage'], render(el) {
  const L = life();
  const MAX_MS = 60 * 60 * 1000; // longest single recording: 1 hour
  let db = null, list = [], rec = null, chunks = [], state = 'idle', acc = 0, tStart = 0, mime = '', stream = null, starting = false, ready = false;
  let au = null, playId = null, playUrl = null, editId = null, armId = null;
  el.innerHTML = `<div class="card center"><div class="big" id="tm">00:00</div><div class="muted" id="st">Ready</div>
    <div class="row" style="margin-top:8px"><button class="btn" id="rec">Record</button><button class="btn alt" id="pa" disabled>Pause</button><button class="btn alt" id="sp" disabled>Stop</button></div>
    <div class="muted" id="msg" style="margin-top:6px"></div></div>
    <div class="muted" id="cnt" style="margin:6px 2px"></div><div class="list" id="list"></div>`;
  const openDb = () => new Promise((res, rej) => {
    if (!window.indexedDB) return rej(new Error('noidb'));
    const r = indexedDB.open('pk.recorder', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('rec', { keyPath: 'id', autoIncrement: true });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const tx = (mode, fn) => new Promise((res, rej) => {
    const t = db.transaction('rec', mode); let rq;
    try { rq = fn(t.objectStore('rec')); } catch (e) { return rej(e); }
    t.oncomplete = () => res(rq ? rq.result : undefined); t.onerror = t.onabort = () => rej(t.error);
  });
  const reload = () => tx('readonly', s => s.getAll()).then(a => { list = (a || []).sort((x, y) => y.date - x.date); draw(); }).catch(() => { setText(el, '#msg', 'Storage is not available.'); });
  const loaded = () => { ready = true; ui(); };
  const dur = ms => { const s = Math.round(ms / 1000); return pad(Math.floor(s / 60), 2) + ':' + pad(s % 60, 2); };
  const kb = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  function limitTxt() { const l = proLimit('recordings'); return 'Saved recordings: ' + list.length + (l === Infinity ? '' : ' of ' + l + ' (free)'); }
  function draw() {
    if (!L.alive) return;
    setText(el, '#cnt', limitTxt());
    $('#list', el).innerHTML = list.length ? list.map(r => `<div class="item" data-id="${r.id}"><div class="grow">
      ${editId === r.id ? `<input class="nm" maxlength="40" value="${esc(r.name)}" aria-label="Recording name">` : `<b style="word-break:break-word">${esc(r.name)}</b>`}
      <div class="muted" style="font-size:12px">${esc(new Date(r.date).toLocaleString())} · ${dur(r.ms)} · ${kb(r.blob.size)}</div></div>
      ${editId === r.id ? '<button class="btn" data-a="ok" style="flex:none;padding:10px 12px">Save</button>' : `<button class="btn alt" data-a="play" aria-label="${playId === r.id ? 'Stop' : 'Play'}" style="flex:none;min-width:44px;padding:10px">${playId === r.id ? '⏹' : '▶'}</button>
      <button class="btn alt" data-a="ren" aria-label="Rename" style="flex:none;min-width:44px;padding:10px">✏️</button>
      <button class="btn alt" data-a="share" aria-label="Share or download" style="flex:none;min-width:44px;padding:10px">⤴</button>
      <button class="btn ${armId === r.id ? 'danger' : 'alt'}" data-a="del" aria-label="Delete" style="flex:none;min-width:44px;padding:10px">${armId === r.id ? 'Sure?' : '🗑'}</button>`}</div>`).join('') : '<p class="muted center">No recordings yet.</p>';
    $$('#list .item', el).forEach(it => {
      const id = +it.dataset.id, r = list.find(x => x.id === id);
      $$('button', it).forEach(b => b.onclick = () => act(b.dataset.a, r, it));
    });
  }
  function stopPlay() {
    if (au) { au.pause(); au = null; }
    if (playUrl) { URL.revokeObjectURL(playUrl); playUrl = null; }
    playId = null;
  }
  function act(a, r, it) {
    if (a === 'play') {
      const was = playId === r.id; stopPlay();
      if (!was) {
        playUrl = URL.createObjectURL(r.blob); au = new Audio(playUrl); playId = r.id;
        au.onended = () => { stopPlay(); draw(); }; au.play().catch(() => { toast('Cannot play this recording'); stopPlay(); draw(); });
      }
      draw();
    } else if (a === 'ren') { editId = r.id; armId = null; draw(); const i = $('.nm', el); if (i) i.focus(); }
    else if (a === 'ok') {
      const nm = ($('.nm', it).value || '').trim().slice(0, 40) || r.name; r.name = nm; editId = null;
      tx('readwrite', s => s.put(r)).then(draw, () => toast('Could not rename'));
    } else if (a === 'share') {
      const ext = /mp4|aac/.test(r.mime) ? 'm4a' : /ogg/.test(r.mime) ? 'ogg' : 'webm';
      saveBlob(r.blob, (r.name.replace(/[^\w\- ]+/g, '').trim() || 'recording') + '.' + ext).catch(() => toast('Could not share'));
    } else if (a === 'del') {
      if (armId !== r.id) { armId = r.id; draw(); setTimeout(() => { if (armId === r.id) { armId = null; draw(); } }, 3000); return; }
      armId = null; if (playId === r.id) stopPlay();
      tx('readwrite', s => s.delete(r.id)).then(reload, () => toast('Could not delete'));
    }
  }
  function ticker() {
    const total = acc + (state === 'rec' ? performance.now() - tStart : 0);
    setText(el, '#tm', dur(total));
    if (state === 'rec' && total >= MAX_MS) { toast('One hour limit reached, saving'); stopRec(); }
  }
  function ui() {
    // Record stays disabled until the saved list has loaded (so the free limit is known) and while a start is in flight.
    $('#rec', el).disabled = state !== 'idle' || starting || !ready; $('#pa', el).disabled = state === 'idle'; $('#sp', el).disabled = state === 'idle';
    $('#pa', el).textContent = state === 'pause' ? 'Resume' : 'Pause';
    setText(el, '#st', state === 'rec' ? 'Recording...' : state === 'pause' ? 'Paused' : 'Ready');
  }
  function release() { if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } }
  $('#rec', el).onclick = () => {
    if (starting || state !== 'idle') return;
    if (!ready) { setText(el, '#msg', 'Still loading your recordings, try again in a moment.'); return; }
    if (!window.MediaRecorder) { setText(el, '#msg', 'Recording is not supported on this device.'); return; }
    if (list.length >= proLimit('recordings') && needPro('recordings')) return;
    starting = true; ui(); // disable the button straight away so a double tap cannot start two recordings
    stopPlay(); setText(el, '#msg', '');
    L.mic({ echoCancellation: true, noiseSuppression: true }).then(s => {
      stream = s; chunks = []; acc = 0;
      try {
        const pref = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
        mime = pref.find(m => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || '';
        rec = mime ? new MediaRecorder(s, { mimeType: mime }) : new MediaRecorder(s);
        rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = () => {
          const ms = acc, type = rec.mimeType || mime || 'audio/webm', cs = chunks; chunks = []; release(); state = 'idle'; ui(); ticker();
          if (!cs.length) { toast('Nothing was recorded'); return; }
          if (!db) { toast('Storage is not available, the recording could not be saved'); return; }
          const blob = new Blob(cs, { type });
          const rd = new Date(), name = 'Recording ' + rd.getFullYear() + '-' + pad(rd.getMonth() + 1, 2) + '-' + pad(rd.getDate(), 2) + ' ' + pad(rd.getHours(), 2) + '.' + pad(rd.getMinutes(), 2);
          // Re-check the free limit now: it may have changed while recording.
          if (list.length >= proLimit('recordings')) {
            toast('Free recording limit reached, choose where to keep this one'); needPro('recordings');
            saveBlob(blob, name.replace(/[^\w\- ]+/g, '') + '.' + (/mp4|aac/.test(type) ? 'm4a' : /ogg/.test(type) ? 'ogg' : 'webm')).catch(() => {});
            return;
          }
          tx('readwrite', st => st.add({ name, blob, ms, mime: type, date: Date.now() })).then(() => { toast('Saved'); return reload(); }).catch(() => toast('Could not save (storage full?)'));
        };
        rec.start(1000); state = 'rec'; tStart = performance.now();
      } catch (e) { release(); rec = null; state = 'idle'; throw e; }
    }).catch(e => { if (e && e.message !== 'gone') micFail(el, e); }).then(() => { starting = false; ui(); });
  };
  $('#pa', el).onclick = () => {
    if (!rec) return;
    if (state === 'rec' && rec.pause) { rec.pause(); acc += performance.now() - tStart; state = 'pause'; }
    else if (state === 'pause' && rec.resume) { rec.resume(); tStart = performance.now(); state = 'rec'; }
    ui(); ticker();
  };
  function stopRec() {
    if (!rec || state === 'idle') return;
    if (state === 'rec') acc += performance.now() - tStart;
    state = 'idle'; try { rec.stop(); } catch (e) { release(); ui(); }
  }
  $('#sp', el).onclick = stopRec;
  L.every(ticker, 250);
  openDb().then(d => { if (!L.alive) { d.close(); return; } db = d; return reload().then(loaded); }).catch(() => { setText(el, '#msg', 'Storage is not available, recordings cannot be saved.'); });
  ui(); draw();
  return () => {
    stopPlay();
    if (rec && rec.state !== 'inactive') { rec.onstop = null; try { rec.stop(); } catch (e) { } }
    L.stop(); if (db) db.close();
  };
} });

/* ---------------------------------------------------------------- Piano */
Tools.register({ id: 'piano', name: 'Piano', icon: '🎹', cat: 'audio', desc: 'On-screen piano with wide keys (15 keys, a little over an octave), multi-touch chords, octave shift and a choice of sound waveforms.', keys: ['keyboard', 'keys', 'synth', 'music', 'chords'], needs: [], render(el) {
  const L = life();
  let ctx = null, master = null, oct = 0, wave = 'triangle', keys = [];
  const voices = new Map();
  el.innerHTML = `<div class="row"><button class="btn alt" id="od" aria-label="Octave down">Oct -</button><div class="center" id="ol" style="flex:1.2"></div><button class="btn alt" id="ou" aria-label="Octave up">Oct +</button></div>
    <label class="f">Sound<select id="wf"><option value="triangle">Soft (triangle)</option><option value="sine">Pure (sine)</option><option value="square">Retro (square)</option><option value="sawtooth">Bright (sawtooth)</option></select></label>
    <div id="kb" style="position:relative;height:200px;margin:10px 0;touch-action:none;user-select:none"></div>
    <p class="muted center" style="font-size:13px">Press several keys at once for chords. Slide a finger across the keys to glide.</p>`;
  const box = $('#kb', el), accent = cssVar(el, '--accent', '#4a90e2');
  function build() { keys = buildKeys(box, 60 + 12 * oct, 15); setText(el, '#ol', 'C' + (4 + oct) + ' to D' + (5 + oct)); }
  function ensure() { if (!ctx) { ctx = L.ctx(); master = newMaster(ctx, 0.5); } else if (ctx.state === 'suspended') ctx.resume(); }
  function on(pid, i) {
    ensure(); const k = keys[i]; if (!k) return;
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
    o.type = wave; o.frequency.value = midiToFreq(k.midi);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.01); g.gain.setTargetAtTime(0.3, t + 0.02, 0.4);
    o.connect(g); g.connect(master); o.start(t);
    voices.set(pid, { i, o, g }); setKeyOn(k, true, accent);
  }
  function off(pid) {
    const v = voices.get(pid); if (!v) return; voices.delete(pid);
    const t = ctx.currentTime; v.g.gain.cancelScheduledValues(t); v.g.gain.setValueAtTime(Math.max(v.g.gain.value, 0.0001), t); v.g.gain.setTargetAtTime(0.0001, t, 0.08);
    try { v.o.stop(t + 0.5); } catch (e) { }
    if (keys[v.i] && ![...voices.values()].some(x => x.i === v.i)) setKeyOn(keys[v.i], false);
  }
  const keyAt = e => { const n = document.elementFromPoint(e.clientX, e.clientY); return n && box.contains(n) && n.dataset.k !== undefined ? +n.dataset.k : -1; };
  box.onpointerdown = e => { const i = keyAt(e); if (i >= 0) { e.preventDefault(); on(e.pointerId, i); } };
  box.onpointermove = e => {
    const v = voices.get(e.pointerId); if (!v) return;
    const i = keyAt(e); if (i >= 0 && i !== v.i) { off(e.pointerId); on(e.pointerId, i); }
  };
  const up = e => off(e.pointerId);
  box.onpointerup = up; box.onpointercancel = up;
  box.oncontextmenu = e => e.preventDefault();
  $('#od', el).onclick = () => { if (oct > -2) { [...voices.keys()].forEach(off); oct--; build(); } };
  $('#ou', el).onclick = () => { if (oct < 2) { [...voices.keys()].forEach(off); oct++; build(); } };
  $('#wf', el).onchange = e => { wave = e.target.value; };
  build();
  return () => { L.stop(); };
} });

/* ---------------------------------------------------------------- Spectrum Analyzer */
Tools.register({ id: 'spectrum', pro: true, proKey: 'audio', name: 'Spectrum', icon: '📊', cat: 'audio', desc: 'Live frequency spectrum bars and waveform from the microphone, with the loudest frequency shown.', keys: ['analyzer', 'frequency', 'fft', 'waveform', 'oscilloscope', 'equalizer'], needs: ['microphone'], render(el) {
  const L = life();
  let ctx = null, an = null, running = false, pending = false;
  el.innerHTML = `<div class="card center"><div class="big" id="pk">--</div><div class="muted">loudest frequency (Hz)</div></div>
    <canvas id="sp" class="canvas" style="touch-action:pan-y;width:100%;height:200px;background:var(--surface2);border-radius:12px;display:block"></canvas>
    <canvas id="wv" class="canvas" style="touch-action:pan-y;width:100%;height:90px;background:var(--surface2);border-radius:12px;display:block;margin-top:8px"></canvas>
    <div class="row" style="margin:6px 0;font-size:12px;justify-content:space-between"><span class="muted">30 Hz</span><span class="muted">1 kHz</span><span class="muted">16 kHz</span></div>
    <button class="btn" id="go" style="width:100%">Start</button><div class="muted center" id="msg"></div>`;
  const cs = $('#sp', el), cw = $('#wv', el), BANDS = 48, caps = new Array(BANDS).fill(0);
  function size(c) { const r = window.devicePixelRatio || 1, w = c.clientWidth || 300, h = c.clientHeight || 100; if (c.width !== Math.round(w * r)) { c.width = Math.round(w * r); c.height = Math.round(h * r); } }
  L.raf(() => {
    size(cs); size(cw);
    const g = cs.getContext('2d'), W = cs.width, H = cs.height, acc = cssVar(el, '--accent', '#4a90e2'), ok = cssVar(el, '--ok', '#3c3');
    g.clearRect(0, 0, W, H); const gw = cw.getContext('2d'); gw.clearRect(0, 0, cw.width, cw.height);
    if (!running || !an) return;
    const fb = new Uint8Array(an.frequencyBinCount), tb = new Uint8Array(an.fftSize), sr = ctx.sampleRate, binHz = sr / an.fftSize;
    an.getByteFrequencyData(fb); an.getByteTimeDomainData(tb);
    // Skip bins 0 and 1 (DC and rumble); refine the peak with a parabola through its neighbours.
    let pi = 2; for (let i = 3; i < fb.length - 1; i++) if (fb[i] > fb[pi]) pi = i;
    let off = 0; if (pi > 2 && pi < fb.length - 1) { const a = fb[pi - 1], b = fb[pi], c = fb[pi + 1], den = a - 2 * b + c; if (den < 0) off = clamp(0.5 * (a - c) / den, -0.5, 0.5); }
    setText(el, '#pk', fb[pi] > 60 ? Math.round((pi + off) * binHz) : '--');
    const bw = W / BANDS, lo = 30, hi = Math.min(16000, sr / 2);
    for (let b = 0; b < BANDS; b++) {
      const f0 = lo * Math.pow(hi / lo, b / BANDS), f1 = lo * Math.pow(hi / lo, (b + 1) / BANDS);
      const i0 = Math.max(1, Math.floor(f0 / binHz)), i1 = Math.max(i0, Math.ceil(f1 / binHz)); let m = 0;
      for (let i = i0; i <= i1 && i < fb.length; i++) m = Math.max(m, fb[i]);
      const v = m / 255, bh = v * H;
      g.fillStyle = acc; g.fillRect(b * bw + 1, H - bh, bw - 2, bh);
      caps[b] = Math.max(v, caps[b] - 0.008);
      g.fillStyle = ok; g.fillRect(b * bw + 1, H - caps[b] * H - 3, bw - 2, 3);
    }
    gw.strokeStyle = acc; gw.lineWidth = 2 * (window.devicePixelRatio || 1); gw.beginPath();
    for (let i = 0; i < tb.length; i += 4) {
      const x = i / tb.length * cw.width, y = tb[i] / 255 * cw.height;
      i ? gw.lineTo(x, y) : gw.moveTo(x, y);
    }
    gw.stroke();
  });
  $('#go', el).onclick = () => {
    if (running) {
      running = false; closeCtx(ctx); L.streams.forEach(stopStream); L.streams = [];
      ctx = an = null; $('#go', el).textContent = 'Start'; setText(el, '#pk', '--'); return;
    }
    if (pending) return;
    pending = true; setText(el, '#msg', '');
    L.mic().then(s => {
      try {
        ctx = L.ctx(); an = ctx.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0.78;
        ctx.createMediaStreamSource(s).connect(an); running = true; $('#go', el).textContent = 'Stop';
      } catch (e) { L.drop(s); closeCtx(ctx); ctx = an = null; throw e; }
    }).catch(e => micFail(el, e)).then(() => { pending = false; });
  };
  return () => { running = false; L.stop(); };
} });

/* ---------------------------------------------------------------- Sleep Sounds */
Tools.register({ id: 'sleepsounds', name: 'Sleep Sounds', icon: '😴', cat: 'audio', desc: 'Relaxing white, pink and brown noise plus synthesized rain, ocean waves and wind, with volume and a sleep timer that fades out.', keys: ['white noise', 'pink noise', 'brown noise', 'rain', 'ocean', 'relax', 'sleep', 'timer', 'wind'], needs: [], render(el) {
  const L = life();
  const SOUNDS = [['white', 'White noise'], ['pink', 'Pink noise'], ['brown', 'Brown noise'], ['rain', 'Rain'], ['ocean', 'Ocean'], ['wind', 'Wind']];
  let ctx = null, master = null, cur = null, nodes = [], dropTimer = null, endAt = 0, playing = false, vol = clamp(+Store.get('sleep.vol', 50), 1, 100), bufs = {};
  el.innerHTML = `<div class="keys" id="snd" style="grid-template-columns:repeat(2,1fr)"></div>
    <label class="f" style="margin-top:10px">Volume <span id="vv"></span>%<input id="vol" type="range" min="1" max="100" style="width:100%"></label>
    <label class="f">Sleep timer<select id="tm"><option value="0">Off</option><option value="15">15 minutes</option><option value="30" selected>30 minutes</option><option value="60">1 hour</option><option value="120">2 hours</option><option value="480">8 hours</option></select></label>
    <div class="card center"><div class="mid" id="cd">Choose a sound</div></div>
    <button class="btn" id="go" style="width:100%" disabled>Play</button>`;
  $('#vol', el).value = vol; setText(el, '#vv', vol);
  $('#snd', el).innerHTML = SOUNDS.map(s => `<button data-s="${s[0]}">${s[1]}</button>`).join('');
  function mark() { $$('#snd button', el).forEach(b => { const a = b.dataset.s === cur; b.style.background = a ? 'var(--accent)' : ''; b.style.color = a ? 'var(--accent-t)' : ''; }); }
  const vv = () => Math.pow(vol / 100, 2) * 0.8;
  function buffer(type) { if (!bufs[type]) bufs[type] = noiseBuf(ctx, type, 8, true); return bufs[type]; }
  function src(type) { const s = ctx.createBufferSource(); s.buffer = buffer(type); s.loop = true; s.start(); nodes.push(s); return s; }
  function lfo(freq, depth, target) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = freq; g.gain.value = depth; o.connect(g); g.connect(target); o.start(); nodes.push(o); return o;
  }
  function build() {
    teardown();
    const out = ctx.createGain(); out.connect(master); nodes.push(out);
    if (cur === 'white' || cur === 'pink' || cur === 'brown') {
      const g = ctx.createGain(); g.gain.value = cur === 'white' ? 0.35 : cur === 'pink' ? 0.6 : 0.8; src(cur).connect(g); g.connect(out);
    } else if (cur === 'rain') {
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 700;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 9000;
      const g = ctx.createGain(); g.gain.value = 0.35; src('white').connect(hp); hp.connect(lp); lp.connect(g); g.connect(out);
      const drop = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.04), ctx.sampleRate), dd = drop.getChannelData(0);
      for (let i = 0; i < dd.length; i++) dd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / dd.length, 3);
      dropTimer = setInterval(() => {
        const n = 1 + Math.floor(Math.random() * 4);
        for (let k = 0; k < n; k++) {
          const s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), dg = ctx.createGain();
          s.buffer = drop; bp.type = 'bandpass'; bp.frequency.value = 1500 + Math.random() * 4500; bp.Q.value = 1.5;
          dg.gain.value = 0.2 + Math.random() * 0.5; s.connect(bp); bp.connect(dg); dg.connect(out);
          s.start(ctx.currentTime + Math.random() * 0.12);
        }
      }, 110);
    } else if (cur === 'ocean') {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
      const wave = ctx.createGain(); wave.gain.value = 0.5; src('brown').connect(lp); lp.connect(wave); wave.connect(out);
      lfo(0.11, 0.42, wave.gain); lfo(0.11, 350, lp.frequency);
      const hiss = ctx.createBiquadFilter(); hiss.type = 'highpass'; hiss.frequency.value = 2500;
      const hg = ctx.createGain(); hg.gain.value = 0.05; src('pink').connect(hiss); hiss.connect(hg); hg.connect(out); lfo(0.11, 0.04, hg.gain);
    } else if (cur === 'wind') {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.9;
      const g = ctx.createGain(); g.gain.value = 0.8; src('pink').connect(bp); bp.connect(g); g.connect(out);
      lfo(0.07, 250, bp.frequency); lfo(0.19, 0.3, g.gain);
    }
  }
  function teardown() {
    clearInterval(dropTimer); dropTimer = null;
    nodes.forEach(n => { try { if (n.stop) n.stop(); n.disconnect(); } catch (e) { } }); nodes = [];
  }
  function startPlay() {
    if (!cur) return;
    if (!ctx) { ctx = L.ctx(); master = ctx.createGain(); master.gain.value = 0.0001; master.connect(ctx.destination); }
    build(); master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(vv(), ctx.currentTime, 0.4);
    const m = +$('#tm', el).value; endAt = m ? Date.now() + m * 60000 : 0;
    playing = true; setText(el, '#go', 'Stop');
  }
  function stopPlay(fade) {
    playing = false; setText(el, '#go', 'Play'); endAt = 0;
    if (ctx) { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(0.0001, ctx.currentTime, fade ? 2 : 0.05); }
    const t = setTimeout(() => { if (!playing) teardown(); }, fade ? 8000 : 300); L.on(() => clearTimeout(t));
    setText(el, '#cd', cur ? 'Stopped' : 'Choose a sound');
  }
  $('#snd', el).onclick = e => {
    const b = e.target.closest('button'); if (!b) return; cur = b.dataset.s; mark(); $('#go', el).disabled = false;
    if (playing) { build(); } else startPlay();
  };
  $('#go', el).onclick = () => playing ? stopPlay(false) : startPlay();
  $('#vol', el).oninput = e => { vol = +e.target.value; setText(el, '#vv', vol); Store.set('sleep.vol', vol); if (playing) master.gain.setTargetAtTime(vv(), ctx.currentTime, 0.05); };
  $('#tm', el).onchange = () => { if (playing) { const m = +$('#tm', el).value; endAt = m ? Date.now() + m * 60000 : 0; } };
  L.every(() => {
    if (!playing) return;
    if (!endAt) { setText(el, '#cd', 'Playing: ' + (SOUNDS.find(s => s[0] === cur) || [0, ''])[1]); return; }
    const left = Math.max(0, endAt - Date.now()), s = Math.ceil(left / 1000);
    setText(el, '#cd', 'Sleep timer: ' + pad(Math.floor(s / 3600), 2) + ':' + pad(Math.floor(s / 60) % 60, 2) + ':' + pad(s % 60, 2));
    if (left <= 0) { stopPlay(true); setText(el, '#cd', 'Timer finished'); }
  }, 500);
  return () => { playing = false; teardown(); L.stop(); };
} });

/* ---------------------------------------------------------------- Drum Pad */
Tools.register({ id: 'drumpad', pro: true, proKey: 'audio', name: 'Drum Pad', icon: '🥁', cat: 'audio', desc: 'Eight synthesized drum pads (kick, snare, clap, hi-hats, tom, rim, cowbell) that respond to multi-touch.', keys: ['drums', 'beat', 'percussion', 'kick', 'snare', 'hihat'], needs: [], render(el) {
  const L = life();
  const PADS = ['Kick', 'Snare', 'Clap', 'Hi-hat', 'Open hat', 'Tom', 'Rim', 'Cowbell'];
  let ctx = null, master = null, nb = null;
  el.innerHTML = `<div id="pads" style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;touch-action:none"></div>
    <label class="f" style="margin-top:10px">Volume<input id="vol" type="range" min="1" max="100" value="80" style="width:100%"></label>`;
  $('#pads', el).innerHTML = PADS.map((p, i) => `<button class="btn alt" data-i="${i}" style="height:84px;font-size:16px;touch-action:none;user-select:none">${p}</button>`).join('');
  function noise(t, dur, type, freq, vol, q) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = nb; f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  function tone(t, type, f0, f1, dur, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.8);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function hit(i) {
    if (!ctx) { ctx = L.ctx(); master = newMaster(ctx, +$('#vol', el).value / 100); nb = noiseBuf(ctx, 'white', 1); }
    else if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;
    if (i === 0) { tone(t, 'sine', 160, 40, 0.45, 1); tone(t, 'triangle', 80, 40, 0.1, 0.5); }
    else if (i === 1) { noise(t, 0.2, 'highpass', 1500, 0.8); tone(t, 'triangle', 220, 150, 0.12, 0.7); }
    else if (i === 2) { [0, 0.012, 0.024].forEach(d => noise(t + d, 0.03, 'bandpass', 1500, 0.9, 1.2)); noise(t + 0.03, 0.18, 'bandpass', 1400, 0.7, 1.2); }
    else if (i === 3) noise(t, 0.05, 'highpass', 7500, 0.7);
    else if (i === 4) noise(t, 0.4, 'highpass', 7000, 0.6);
    else if (i === 5) tone(t, 'sine', 220, 90, 0.35, 0.9);
    else if (i === 6) { tone(t, 'square', 800, 800, 0.03, 0.35); tone(t, 'sine', 1700, 1700, 0.04, 0.5); }
    else { tone(t, 'square', 540, 540, 0.3, 0.25); tone(t, 'square', 800, 800, 0.3, 0.25); }
  }
  $('#vol', el).oninput = e => { if (master) master.gain.value = +e.target.value / 100; };
  $$('#pads button', el).forEach(b => {
    b.onpointerdown = e => {
      e.preventDefault(); hit(+b.dataset.i); b.style.background = 'var(--accent)'; b.style.color = 'var(--accent-t)';
      if (navigator.vibrate) navigator.vibrate(8);
    };
    const rel = () => { b.style.background = ''; b.style.color = ''; };
    b.onpointerup = rel; b.onpointercancel = rel; b.onpointerleave = rel; b.oncontextmenu = e => e.preventDefault();
  });
  return () => L.stop();
} });

/* ---------------------------------------------------------------- Ear Test */
Tools.register({ id: 'eartest', name: 'Hearing Test', icon: '👂', cat: 'audio', desc: 'Find the highest pitch you can hear: tones step up from 4 kHz to 20 kHz, left, right or both ears. Not a medical test.', keys: ['ear', 'hearing', 'frequency', 'age', 'high pitch', 'mosquito'], needs: [], render(el) {
  const L = life();
  const FREQS = [4000, 8000, 10000, 12000, 14000, 15000, 16000, 17000, 18000, 19000, 20000];
  let ctx = null, osc = null, g = null, idx = -1, heard = 0, stopT = null;
  el.innerHTML = `<div class="card center"><div class="muted">Use headphones in a quiet room. Set your volume low first, then raise it a little.</div>
    <div class="big" id="fq">-- Hz</div><div class="muted" id="msg">Press Start to begin</div></div>
    <label class="f">Ear<select id="ear"><option value="0">Both ears</option><option value="-1">Left ear</option><option value="1">Right ear</option></select></label>
    <label class="f">Volume <span id="vv">20</span>%<input id="vol" type="range" min="1" max="60" value="20" style="width:100%"></label>
    <div class="row" id="ans" style="display:none"><button class="btn" id="yes">I hear it</button><button class="btn alt" id="no">Cannot hear</button></div>
    <div class="row" style="margin-top:8px"><button class="btn" id="go">Start test</button><button class="btn alt" id="rp" disabled>Replay tone</button></div>
    <div class="card center" id="res" style="display:none;margin-top:10px"></div>
    <p class="muted center" style="font-size:13px">Results depend on your headphones and device. Many adults cannot hear above 15 to 17 kHz and that is normal. If you have concerns about your hearing, see a professional.</p>`;
  const vol = () => Math.pow(+$('#vol', el).value / 100, 2);
  function silence() {
    clearTimeout(stopT);
    if (osc) { try { g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.01); osc.stop(ctx.currentTime + 0.1); } catch (e) { } osc = null; }
  }
  function play() {
    silence(); if (!ctx) ctx = L.ctx();
    const f = FREQS[idx]; osc = ctx.createOscillator(); g = ctx.createGain(); const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    osc.frequency.value = f; g.gain.value = 0.0001;
    osc.connect(g); if (pan) { pan.pan.value = +$('#ear', el).value; g.connect(pan); pan.connect(ctx.destination); } else g.connect(ctx.destination);
    osc.start(); g.gain.setTargetAtTime(vol(), ctx.currentTime, 0.02);
    setText(el, '#fq', (f / 1000) + ' kHz'); setText(el, '#msg', 'Do you hear a tone? (' + (idx + 1) + ' of ' + FREQS.length + ')');
    stopT = setTimeout(silence, 2500);
  }
  function finish() {
    silence(); $('#ans', el).style.display = 'none'; $('#rp', el).disabled = true; idx = -1; setText(el, '#go', 'Start again');
    setText(el, '#fq', heard ? heard / 1000 + ' kHz' : 'None'); setText(el, '#msg', 'Test finished');
    const r = $('#res', el); r.style.display = '';
    r.innerHTML = heard ? 'The highest tone you heard was <b>' + (heard / 1000) + ' kHz</b>.' : 'You did not report hearing any of the tones. Try a higher volume or different headphones.';
  }
  $('#go', el).onclick = () => { idx = 0; heard = 0; $('#res', el).style.display = 'none'; $('#ans', el).style.display = ''; $('#rp', el).disabled = false; play(); };
  $('#yes', el).onclick = () => { if (idx < 0) return; heard = FREQS[idx]; if (idx + 1 >= FREQS.length) finish(); else { idx++; play(); } };
  $('#no', el).onclick = () => { if (idx >= 0) finish(); };
  $('#rp', el).onclick = () => { if (idx >= 0) play(); };
  $('#vol', el).oninput = e => { setText(el, '#vv', e.target.value); if (osc) g.gain.setTargetAtTime(vol(), ctx.currentTime, 0.02); };
  return () => { clearTimeout(stopT); L.stop(); };
} });

/* ---------------------------------------------------------------- Binaural Beats */
Tools.register({ id: 'binaural', name: 'Binaural Beats', icon: '🧠', cat: 'audio', desc: 'Two slightly different tones, one per ear, for relaxation, focus or sleep. Presets for delta, theta, alpha, beta and gamma. Needs headphones.', keys: ['focus', 'relax', 'meditation', 'sleep', 'brainwave', 'delta', 'theta', 'alpha'], needs: [], render(el) {
  const L = life();
  const PRE = [['Delta 2 Hz (sleep)', 2], ['Theta 6 Hz (relax)', 6], ['Alpha 10 Hz (calm)', 10], ['Beta 20 Hz (focus)', 20], ['Gamma 40 Hz (alert)', 40]];
  let ctx = null, oL = null, oR = null, g = null, playing = false, endAt = 0;
  el.innerHTML = `<div class="card center"><div class="muted">Headphones are required. The effect needs a different tone in each ear.</div><div class="big"><span id="bt">10</span> Hz</div><div class="muted" id="cr"></div></div>
    <div id="pre" class="row" style="flex-wrap:wrap;margin-bottom:8px"></div>
    <label class="f">Beat frequency <span id="bv"></span> Hz<input id="beat" type="range" min="0.5" max="40" step="0.5" value="10" style="width:100%"></label>
    <label class="f">Carrier tone <span id="cv"></span> Hz<input id="car" type="range" min="100" max="500" step="5" value="200" style="width:100%"></label>
    <label class="f">Volume <span id="vv">30</span>%<input id="vol" type="range" min="1" max="100" value="30" style="width:100%"></label>
    <label class="f">Timer<select id="tm"><option value="0">Off</option><option value="10">10 minutes</option><option value="20" selected>20 minutes</option><option value="30">30 minutes</option><option value="60">60 minutes</option></select></label>
    <div class="muted center" id="cd"></div>
    <button class="btn" id="go" style="width:100%">Play</button>`;
  $('#pre', el).innerHTML = PRE.map((p, i) => `<button class="btn alt" data-i="${i}" style="flex:1 1 45%;font-size:13px">${p[0]}</button>`).join('');
  const beat = () => +$('#beat', el).value, car = () => +$('#car', el).value, vol = () => Math.pow(+$('#vol', el).value / 100, 2) * 0.5;
  function upd() {
    setText(el, '#bt', beat()); setText(el, '#bv', beat()); setText(el, '#cv', car());
    setText(el, '#cr', 'Left ' + car() + ' Hz, right ' + (car() + beat()) + ' Hz');
    if (playing) { const t = ctx.currentTime; oL.frequency.setTargetAtTime(car(), t, 0.05); oR.frequency.setTargetAtTime(car() + beat(), t, 0.05); }
  }
  function start() {
    ctx = L.ctx(); g = ctx.createGain(); g.gain.value = 0.0001; g.connect(ctx.destination);
    const mk = (pan, f) => {
      const o = ctx.createOscillator(), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null; o.frequency.value = f;
      if (p) { p.pan.value = pan; o.connect(p); p.connect(g); } else o.connect(g); o.start(); return o;
    };
    oL = mk(-1, car()); oR = mk(1, car() + beat());
    g.gain.setTargetAtTime(vol(), ctx.currentTime, 0.5);
    playing = true; const m = +$('#tm', el).value; endAt = m ? Date.now() + m * 60000 : 0; setText(el, '#go', 'Stop');
  }
  function stop() {
    playing = false; setText(el, '#go', 'Play'); setText(el, '#cd', '');
    const c = ctx, a = oL, b = oR;
    if (c) { g.gain.setTargetAtTime(0.0001, c.currentTime, 0.2); setTimeout(() => { try { a.stop(); b.stop(); } catch (e) { } closeCtx(c); }, 900); }
    ctx = null;
  }
  $$('#pre button', el).forEach(b => b.onclick = () => { $('#beat', el).value = PRE[+b.dataset.i][1]; upd(); });
  ['beat', 'car'].forEach(i => $('#' + i, el).oninput = upd);
  $('#vol', el).oninput = e => { setText(el, '#vv', e.target.value); if (playing) g.gain.setTargetAtTime(vol(), ctx.currentTime, 0.05); };
  $('#go', el).onclick = () => playing ? stop() : start();
  L.every(() => {
    if (!playing || !endAt) return;
    const s = Math.max(0, Math.ceil((endAt - Date.now()) / 1000)); setText(el, '#cd', 'Stops in ' + pad(Math.floor(s / 60), 2) + ':' + pad(s % 60, 2));
    if (!s) stop();
  }, 500);
  upd();
  return () => { playing = false; L.stop(); };
} });

/* ---------------------------------------------------------------- Audio Player + EQ */
Tools.register({ id: 'player', pro: true, proKey: 'audio', name: 'Audio Player', icon: '🎧', cat: 'audio', desc: 'Play audio files from your device with speed control, A-B loop and a five-band equalizer.', keys: ['music', 'mp3', 'speed', 'loop', 'equalizer', 'eq', 'bass', 'slow down', 'practice'], needs: ['storage'], render(el) {
  const L = life();
  const BANDS = [60, 230, 910, 3600, 14000], PRESETS = { Flat: [0, 0, 0, 0, 0], 'Bass boost': [8, 5, 0, 0, 0], Vocal: [-3, 0, 4, 3, 0], 'Treble boost': [0, 0, 0, 5, 8], Loudness: [6, 2, -2, 2, 5] };
  let list = [], cur = -1, ctx = null, filters = [], A = null, B = null, seeking = false;
  const au = new Audio(); au.preload = 'metadata';
  el.innerHTML = `<label class="btn" style="display:block;text-align:center">Choose audio files<input id="file" type="file" accept="audio/*" multiple style="display:none"></label>
    <div class="card center"><div id="nm" style="font-weight:600;word-break:break-word">No file selected</div><div class="muted" id="tt">00:00 / 00:00</div>
    <input id="seek" type="range" min="0" max="1000" value="0" aria-label="Seek" style="width:100%">
    <div class="row"><button class="btn alt" id="bk" aria-label="Back 10 seconds">-10s</button><button class="btn" id="pl">Play</button><button class="btn alt" id="fw" aria-label="Forward 10 seconds">+10s</button></div></div>
    <div class="card"><label class="f">Speed <span id="spv">1.00</span>x<input id="sp" type="range" min="0.5" max="2" step="0.05" value="1" style="width:100%"></label>
    <label class="row" style="justify-content:flex-start"><input id="pp" type="checkbox" checked style="flex:none;width:auto"> <span>Keep pitch when changing speed</span></label>
    <label class="f">Volume<input id="vol" type="range" min="0" max="100" value="100" style="width:100%"></label></div>
    <div class="card"><b>A-B loop</b> <span class="muted" id="ab">off</span><div class="row" style="margin-top:6px"><button class="btn alt" id="sa">Set A</button><button class="btn alt" id="sb">Set B</button><button class="btn alt" id="ca">Clear</button></div></div>
    <div class="card"><b>Equalizer</b><div class="row" id="pre" style="flex-wrap:wrap;margin:6px 0"></div><div id="eq"></div></div>
    <div class="list" id="list"></div><div class="muted center" id="msg"></div>`;
  const fmtT = s => isFinite(s) ? pad(Math.floor(s / 60), 2) + ':' + pad(Math.floor(s % 60), 2) : '00:00';
  $('#pre', el).innerHTML = Object.keys(PRESETS).map(k => `<button class="btn alt" data-p="${esc(k)}" style="flex:1 1 30%;font-size:12px;padding:8px 4px">${esc(k)}</button>`).join('');
  $('#eq', el).innerHTML = BANDS.map((f, i) => `<label class="f" style="margin:0">${f >= 1000 ? f / 1000 + ' kHz' : f + ' Hz'} <span data-v="${i}">0</span> dB<input data-b="${i}" type="range" min="-12" max="12" step="1" value="0" style="width:100%"></label>`).join('');
  function ensureCtx() {
    if (ctx) return;
    ctx = L.ctx(); const src = ctx.createMediaElementSource(au); let prev = src;
    filters = BANDS.map((f, i) => { const b = ctx.createBiquadFilter(); b.type = i === 0 ? 'lowshelf' : i === BANDS.length - 1 ? 'highshelf' : 'peaking'; b.frequency.value = f; b.Q.value = 1; b.gain.value = +$$('#eq input', el)[i].value; prev.connect(b); prev = b; return b; });
    prev.connect(ctx.destination);
  }
  function setEq(arr) { $$('#eq input', el).forEach((s, i) => { s.value = arr[i]; s.oninput(); }); }
  $$('#eq input', el).forEach((s, i) => s.oninput = () => { setText(el, '[data-v="' + i + '"]', s.value); if (filters[i]) filters[i].gain.value = +s.value; });
  $$('#pre button', el).forEach(b => b.onclick = () => setEq(PRESETS[b.dataset.p]));
  function drawList() {
    $('#list', el).innerHTML = list.map((t, i) => `<div class="item" data-i="${i}" style="${i === cur ? 'border-color:var(--accent)' : ''}"><div class="grow" style="word-break:break-word">${esc(t.name)}</div><span>${i === cur ? '🔊' : '▶'}</span></div>`).join('');
    $$('#list .item', el).forEach(it => it.onclick = () => load(+it.dataset.i, true));
  }
  function load(i, play) {
    if (i < 0 || i >= list.length) return; cur = i; A = B = null; au.src = list[i].url; au.load();
    applySpeed(); setText(el, '#nm', list[i].name); abShow(); drawList(); setText(el, '#msg', '');
    if (play) go();
  }
  function go() { ensureCtx(); if (ctx.state === 'suspended') ctx.resume(); au.play().catch(() => setText(el, '#msg', 'This file cannot be played here.')); }
  function applySpeed() { const v = +$('#sp', el).value; au.playbackRate = v; const k = $('#pp', el).checked; au.preservesPitch = k; au.mozPreservesPitch = k; au.webkitPreservesPitch = k; setText(el, '#spv', v.toFixed(2)); }
  function abShow() { setText(el, '#ab', A === null ? 'off' : 'A ' + fmtT(A) + (B !== null ? ' to B ' + fmtT(B) : ' (set B)')); }
  $('#file', el).onchange = e => {
    const fs = [...e.target.files].filter(f => f.type.startsWith('audio/') || /\.(mp3|m4a|aac|wav|ogg|opus|flac|webm)$/i.test(f.name));
    if (!fs.length) { setText(el, '#msg', 'No audio files were chosen.'); return; }
    const room = 100 - list.length; if (room <= 0) { setText(el, '#msg', 'The playlist is full (100 tracks). Remove some first.'); return; }
    if (fs.length > room) setText(el, '#msg', 'Only the first ' + room + ' files were added (playlist limit 100).');
    const first = list.length; fs.slice(0, room).forEach(f => list.push({ name: String(f.name).slice(0, 120), url: URL.createObjectURL(f) }));
    drawList(); if (cur < 0) load(first, false);
  };
  $('#pl', el).onclick = () => { if (cur < 0) { $('#file', el).click(); return; } au.paused ? go() : au.pause(); };
  $('#bk', el).onclick = () => { au.currentTime = Math.max(0, au.currentTime - 10); };
  $('#fw', el).onclick = () => { au.currentTime = Math.min(au.duration || 0, au.currentTime + 10); };
  $('#sp', el).oninput = applySpeed; $('#pp', el).onchange = applySpeed;
  $('#vol', el).oninput = e => { au.volume = +e.target.value / 100; };
  $('#sa', el).onclick = () => { A = au.currentTime; if (B !== null && B <= A) B = null; abShow(); };
  $('#sb', el).onclick = () => { if (A === null) A = 0; if (au.currentTime > A + 0.2) { B = au.currentTime; abShow(); } };
  $('#ca', el).onclick = () => { A = B = null; abShow(); };
  const sk = $('#seek', el);
  sk.oninput = () => { seeking = true; if (au.duration) au.currentTime = sk.value / 1000 * au.duration; };
  sk.onchange = () => { seeking = false; };
  au.onended = () => { if (cur + 1 < list.length) load(cur + 1, true); };
  au.onerror = () => { if (cur >= 0) setText(el, '#msg', 'This file cannot be played here.'); };
  L.raf(() => {
    if (B !== null && A !== null && au.currentTime >= B) au.currentTime = A;
    setText(el, '#pl', au.paused ? 'Play' : 'Pause');
    setText(el, '#tt', fmtT(au.currentTime) + ' / ' + fmtT(au.duration));
    if (!seeking && au.duration) sk.value = au.currentTime / au.duration * 1000;
  });
  return () => { au.pause(); au.removeAttribute('src'); au.load(); list.forEach(t => URL.revokeObjectURL(t.url)); L.stop(); };
} });

/* ---------------------------------------------------------------- Stereo Test */
Tools.register({ id: 'stereotest', name: 'Stereo Test', icon: '🔈', cat: 'audio', desc: 'Check that left and right speakers or headphones work and are not swapped, using tones or noise.', keys: ['left', 'right', 'speaker', 'headphone', 'balance', 'channel'], needs: [], render(el) {
  const L = life();
  let ctx = null, src = null, pan = null, g = null, mode = null, altT = null, altSide = -1;
  el.innerHTML = `<div class="row" style="margin-bottom:10px"><div class="card center" id="L" style="font-size:36px;font-weight:700;padding:24px 0">L</div><div class="card center" id="R" style="font-size:36px;font-weight:700;padding:24px 0">R</div></div>
    <div class="keys" style="grid-template-columns:repeat(2,1fr)"><button data-m="left">Left</button><button data-m="right">Right</button><button data-m="both">Both</button><button data-m="alt">Alternate</button></div>
    <label class="f" style="margin-top:10px">Sound<select id="snd"><option value="440">Tone 440 Hz</option><option value="1000">Tone 1 kHz</option><option value="pink">Pink noise</option></select></label>
    <label class="f">Volume <span id="vv">30</span>%<input id="vol" type="range" min="1" max="100" value="30" style="width:100%"></label>
    <button class="btn alt" id="st" style="width:100%">Stop</button>
    <p class="muted center" style="font-size:13px">If the left sound comes from the right side, the speakers or headphones are reversed.</p>`;
  const vol = () => Math.pow(+$('#vol', el).value / 100, 2) * 0.8;
  function lights(p) {
    [['L', p < 0 || p === 0 && mode], ['R', p > 0 || p === 0 && mode]].forEach(([id, on]) => { const n = $('#' + id, el); n.style.background = on ? 'var(--accent)' : ''; n.style.color = on ? 'var(--accent-t)' : ''; });
  }
  function halt() {
    clearInterval(altT); altT = null;
    if (src) { try { src.stop(); src.disconnect(); } catch (e) { } src = null; }
    mode = null; lights(NaN); $$('.keys button', el).forEach(b => { b.style.background = ''; b.style.color = ''; });
  }
  function begin(m) {
    halt(); if (!ctx) ctx = L.ctx(); mode = m; const s = $('#snd', el).value;
    if (s === 'pink') { src = ctx.createBufferSource(); src.buffer = noiseBuf(ctx, 'pink', 3, true); src.loop = true; }
    else { src = ctx.createOscillator(); src.frequency.value = +s; }
    pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null; g = ctx.createGain(); g.gain.value = vol();
    src.connect(g); if (pan) { g.connect(pan); pan.connect(ctx.destination); } else g.connect(ctx.destination);
    const set = p => { if (pan) pan.pan.value = p; lights(p); };
    if (m === 'left') set(-1); else if (m === 'right') set(1); else if (m === 'both') set(0);
    else { altSide = -1; set(-1); altT = setInterval(() => { altSide = -altSide; set(altSide); }, 1000); }
    src.start();
    $$('.keys button', el).forEach(b => { const on = b.dataset.m === m; b.style.background = on ? 'var(--accent)' : ''; b.style.color = on ? 'var(--accent-t)' : ''; });
  }
  $$('.keys button', el).forEach(b => b.onclick = () => begin(b.dataset.m));
  $('#st', el).onclick = halt;
  $('#snd', el).onchange = () => { if (mode) begin(mode); };
  $('#vol', el).oninput = e => { setText(el, '#vv', e.target.value); if (g) g.gain.value = vol(); };
  return () => { halt(); L.stop(); };
} });

/* ---------------------------------------------------------------- Speaker Cleaner */
Tools.register({ id: 'speakerclean', name: 'Speaker Cleaner', icon: '💧', cat: 'audio', desc: 'Play a low 165 Hz tone or a low sweep to help push water or dust out of the phone speaker.', keys: ['water', 'eject', 'dust', 'speaker', 'clean', 'wet'], needs: [], render(el) {
  const L = life();
  let ctx = null, osc = null, g = null, endAt = 0, total = 0, running = false, t0 = 0;
  el.innerHTML = `<div class="card"><b>How to use</b><ol class="muted" style="margin:6px 0 0 18px;padding:0;font-size:14px"><li>Unplug headphones and earbuds first, and keep the phone away from your ear.</li><li>Turn the media volume up (it is loud, so start lower if you are unsure).</li><li>Hold the phone with the speaker facing down.</li><li>Press Start and let the sound run. Wipe the phone afterwards.</li></ol></div>
    <label class="f">Mode<select id="md"><option value="165">Water eject (165 Hz)</option><option value="sweep">Dust shake (sweep 100 to 450 Hz)</option></select></label>
    <label class="f">Duration<select id="du"><option value="15">15 seconds</option><option value="30" selected>30 seconds</option><option value="60">60 seconds</option><option value="120">2 minutes</option></select></label>
    <div class="card center"><div class="big" id="cd">--</div><div class="progress" style="height:10px"><div id="pg" style="height:100%;width:0;background:var(--accent)"></div></div></div>
    <button class="btn" id="go" style="width:100%">Start</button>
    <p class="muted center" style="font-size:13px">The tone is loud and low. Keep the phone away from your ear. This cannot fix a damaged speaker, and a wet phone should be dried properly.</p>`;
  function stop(done) {
    running = false; const c = ctx, o = osc;
    if (c) { g.gain.setTargetAtTime(0.0001, c.currentTime, 0.02); setTimeout(() => { try { o.stop(); } catch (e) { } closeCtx(c); }, 150); }
    ctx = osc = null; setText(el, '#go', 'Start'); setText(el, '#cd', done ? 'Done' : '--'); if (!done) $('#pg', el).style.width = '0';
    if (done) { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); toast('Speaker cleaning finished'); }
  }
  function start() {
    ctx = L.ctx(); osc = ctx.createOscillator(); g = ctx.createGain(); osc.type = 'sine'; osc.frequency.value = 165; g.gain.value = 0.0001;
    osc.connect(g); g.connect(limiter(ctx)); osc.start(); g.gain.setTargetAtTime(0.5, ctx.currentTime, 0.05);
    total = +$('#du', el).value * 1000; t0 = Date.now(); endAt = t0 + total; running = true; setText(el, '#go', 'Stop');
  }
  $('#go', el).onclick = () => running ? stop(false) : start();
  L.raf(() => {
    if (!running) return;
    const now = Date.now(), left = Math.max(0, endAt - now); setText(el, '#cd', Math.ceil(left / 1000) + ' s');
    $('#pg', el).style.width = (100 - left / total * 100) + '%';
    if ($('#md', el).value === 'sweep') { const ph = ((now - t0) % 4000) / 4000; osc.frequency.value = 100 + 350 * (ph < 0.5 ? ph * 2 : 2 - ph * 2); } else osc.frequency.value = 165;
    if (!left) stop(true);
  });
  return () => { running = false; fadeLeave(L, ctx, g); };
} });

/* ---------------------------------------------------------------- Dog Whistle */
Tools.register({ id: 'dogwhistle', name: 'Dog Whistle', icon: '🐕', cat: 'audio', desc: 'High-pitched whistle from 8 to 22 kHz in steady, pulsing or sweeping modes for training pets. Phone speakers may not reach the top range.', keys: ['dog', 'cat', 'pet', 'ultrasonic', 'whistle', 'training', 'high frequency'], needs: [], render(el) {
  const L = life();
  let ctx = null, osc = null, g = null, playing = false, t0 = 0;
  el.innerHTML = `<div class="card center"><div class="big"><span id="hz">18000</span> Hz</div><div class="muted">Humans may hear the lower values</div>
    <input id="fr" type="range" min="8000" max="22000" step="100" value="18000" aria-label="Frequency" style="width:100%"></div>
    <div class="row" id="pre" style="margin-bottom:8px"><button class="btn alt" data-f="15000">15k</button><button class="btn alt" data-f="17000">17k</button><button class="btn alt" data-f="19000">19k</button><button class="btn alt" data-f="21000">21k</button></div>
    <label class="f">Pattern<select id="md"><option value="steady">Steady</option><option value="pulse">Pulsing</option><option value="sweep">Sweep up and down</option></select></label>
    <label class="f">Volume <span id="vv">25</span>%<input id="vol" type="range" min="1" max="100" value="25" style="width:100%"></label>
    <button class="btn" id="go" style="width:100%">Play</button>
    <p class="muted center" style="font-size:13px">Keep the volume low and the phone at a distance from animals. Stop if your pet shows signs of distress. Many phone speakers cannot play above 18 to 20 kHz.</p>`;
  const vol = () => Math.pow(+$('#vol', el).value / 100, 2) * 0.5, fr = () => +$('#fr', el).value;
  const sure = () => confirm('The volume is high for a high-pitched sound, which can hurt your ears and upset animals nearby. Play anyway?');
  function show() { setText(el, '#hz', fr()); if (osc && $('#md', el).value !== 'sweep') osc.frequency.setTargetAtTime(fr(), ctx.currentTime, 0.02); }
  function start() {
    if (+$('#vol', el).value > 70 && !sure()) return;
    ctx = L.ctx(); osc = ctx.createOscillator(); g = ctx.createGain(); osc.frequency.value = fr(); g.gain.value = 0.0001;
    osc.connect(g); g.connect(limiter(ctx)); osc.start(); playing = true; t0 = Date.now(); setText(el, '#go', 'Stop');
  }
  function stop() {
    playing = false; const c = ctx, o = osc;
    if (c) { g.gain.setTargetAtTime(0.0001, c.currentTime, 0.02); setTimeout(() => { try { o.stop(); } catch (e) { } closeCtx(c); }, 120); }
    ctx = osc = null; setText(el, '#go', 'Play');
  }
  L.raf(() => {
    if (!playing || !ctx) return;
    const m = $('#md', el).value, t = (Date.now() - t0);
    let on = 1;
    if (m === 'pulse') on = (t % 600) < 300 ? 1 : 0;
    if (m === 'sweep') { const ph = (t % 3000) / 3000; osc.frequency.value = clamp(fr() - 2000 + 4000 * (ph < 0.5 ? ph * 2 : 2 - ph * 2), 6000, 22000); }
    g.gain.setTargetAtTime(on ? vol() : 0.0001, ctx.currentTime, 0.01);
  });
  $('#fr', el).oninput = show; $('#md', el).onchange = show;
  $$('#pre button', el).forEach(b => b.onclick = () => { $('#fr', el).value = b.dataset.f; show(); });
  $('#vol', el).oninput = e => { const v = +e.target.value; setText(el, '#vv', v); if (v > 70 && playing && !sure()) { e.target.value = 70; setText(el, '#vv', 70); } };
  $('#go', el).onclick = () => playing ? stop() : start();
  return () => { playing = false; fadeLeave(L, ctx, g); };
} });

/* ---------------------------------------------------------------- Chords and Scales */
Tools.register({ id: 'chords', name: 'Chords & Scales', icon: '🎼', cat: 'audio', desc: 'Look up the notes of any chord or scale in all 12 keys, see them on a keyboard and hear them played.', keys: ['chord', 'scale', 'music theory', 'notes', 'major', 'minor', 'blues', 'pentatonic'], needs: [], render(el) {
  const L = life();
  let root = Store.get('chords.root', 0), mode = 'chord', ctx = null, master = null;
  el.innerHTML = `<div class="row"><label class="f">Show<select id="md"><option value="chord">Chord</option><option value="scale">Scale</option></select></label><label class="f">Type<select id="ty"></select></label></div>
    <div class="keys" id="rt" style="margin:8px 0"></div>
    <div class="card center"><div class="mid" id="ti"></div><div class="big" id="nt" style="font-size:30px"></div></div>
    <div id="kb" style="position:relative;height:120px;margin:10px 0;user-select:none"></div>
    <button class="btn" id="pl" style="width:100%">Play</button>`;
  $('#rt', el).innerHTML = NOTE_NAMES.map((n, i) => `<button data-r="${i}">${n}</button>`).join('');
  let keys = buildKeys($('#kb', el), 60, 25);
  const accent = cssVar(el, '--accent', '#4a90e2');
  const table = () => mode === 'chord' ? CHORDS : SCALES;
  function fillTypes() { $('#ty', el).innerHTML = Object.keys(table()).map(k => `<option>${esc(k)}</option>`).join(''); }
  function current() { const iv = table()[$('#ty', el).value] || [0, 4, 7]; return iv; }
  function show() {
    const iv = current(); $$('#rt button', el).forEach(b => { const a = +b.dataset.r === root; b.style.background = a ? 'var(--accent)' : ''; b.style.color = a ? 'var(--accent-t)' : ''; });
    const names = iv.map(i => NOTE_NAMES[(root + i) % 12]);
    setText(el, '#ti', NOTE_NAMES[root] + ' ' + $('#ty', el).value + (mode === 'chord' ? ' chord' : ' scale'));
    setText(el, '#nt', names.join('  '));
    keys.forEach(k => setKeyOn(k, false));
    iv.forEach(i => { const k = keys[root + i]; if (k) setKeyOn(k, true, accent); });
    Store.set('chords.root', root);
  }
  $('#rt', el).onclick = e => { const b = e.target.closest('button'); if (b) { root = +b.dataset.r; show(); } };
  $('#md', el).onchange = e => { mode = e.target.value; fillTypes(); show(); };
  $('#ty', el).onchange = show;
  $('#pl', el).onclick = () => {
    if (!ctx) { ctx = L.ctx(); master = newMaster(ctx, 0.5); } else if (ctx.state === 'suspended') ctx.resume();
    const iv = current(), t0 = ctx.currentTime + 0.05, notes = iv.map(i => 60 + root + i);
    const tone = (m, t, d) => {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = midiToFreq(m);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.05);
    };
    if (mode === 'chord') { notes.forEach((m, i) => tone(m, t0 + i * 0.12, 1.6)); notes.forEach(m => tone(m, t0 + 0.9, 1.4)); }
    else { notes.forEach((m, i) => tone(m, t0 + i * 0.3, 0.5)); tone(notes[0] + 12, t0 + notes.length * 0.3, 0.8); }
  };
  fillTypes(); show();
  return () => L.stop();
} });

/* ---------------------------------------------------------------- Clap Counter */
Tools.register({ id: 'clapcounter', name: 'Clap Counter', icon: '👏', cat: 'audio', desc: 'Counts claps or sharp sounds with the microphone, shows claps per minute, with adjustable sensitivity.', keys: ['clap', 'count', 'tally', 'applause', 'beat', 'sound counter'], needs: ['microphone'], render(el) {
  const L = life();
  let ctx = null, an = null, buf = null, on = false, count = 0, last = 0, prev = 0, times = [], pending = false;
  el.innerHTML = `<div class="card center"><div class="big" id="n">0</div><div class="muted"><span id="cpm">0</span> claps per minute</div>
    <div style="position:relative;height:14px;background:var(--surface2);border-radius:7px;margin-top:10px;overflow:hidden"><div id="lv" style="height:100%;width:0;background:var(--ok)"></div><div id="th" style="position:absolute;top:0;bottom:0;width:2px;background:var(--danger)"></div></div></div>
    <label class="f">Sensitivity<input id="sens" type="range" min="1" max="10" value="5" style="width:100%"></label>
    <div class="row"><button class="btn" id="go">Start listening</button><button class="btn alt" id="rs">Reset</button></div><div class="muted center" id="msg"></div>`;
  const thr = () => 0.5 - (+$('#sens', el).value) * 0.045;
  function paintThr() { $('#th', el).style.left = Math.min(100, thr() * 100) + '%'; }
  $('#sens', el).oninput = paintThr; paintThr();
  $('#rs', el).onclick = () => { count = 0; times = []; setText(el, '#n', 0); setText(el, '#cpm', 0); };
  L.raf(() => {
    if (!on || !an) return;
    an.getFloatTimeDomainData(buf); let pk = 0; for (let i = 0; i < buf.length; i++) { const a = Math.abs(buf[i]); if (a > pk) pk = a; }
    $('#lv', el).style.width = Math.min(100, pk * 100) + '%';
    const now = performance.now(), t = thr();
    if (pk > t && prev <= t && now - last > 180) {
      last = now; count++; times.push(now); setText(el, '#n', count);
      if (navigator.vibrate) navigator.vibrate(15);
    }
    prev = pk;
    times = times.filter(x => now - x < 10000);
    setText(el, '#cpm', times.length > 1 ? Math.round(times.length * 6) : 0);
  });
  $('#go', el).onclick = () => {
    if (on) { on = false; closeCtx(ctx); L.streams.forEach(stopStream); L.streams = []; ctx = an = null; setText(el, '#go', 'Start listening'); return; }
    if (pending) return;
    pending = true; setText(el, '#msg', '');
    L.mic().then(s => {
      try {
        ctx = L.ctx(); an = ctx.createAnalyser(); an.fftSize = 1024; ctx.createMediaStreamSource(s).connect(an);
        buf = new Float32Array(an.fftSize); on = true; prev = 1; setText(el, '#go', 'Stop');
      } catch (e) { L.drop(s); closeCtx(ctx); ctx = an = null; throw e; }
    }).catch(e => micFail(el, e)).then(() => { pending = false; });
  };
  return () => { on = false; L.stop(); };
} });

/* ---------------------------------------------------------------- Vocal Range */
Tools.register({ id: 'vocalrange', name: 'Vocal Range', icon: '🎤', cat: 'audio', desc: 'Sing your lowest and highest notes and see your vocal range in notes and octaves, with a rough voice type guess.', keys: ['voice', 'sing', 'singing', 'pitch', 'soprano', 'tenor', 'bass', 'alto', 'range'], needs: ['microphone'], render(el) {
  const L = life();
  let ctx = null, an = null, buf = null, on = false, frame = 0, lo = null, hi = null, stable = 0, lastM = null, pending = false;
  const saved = Store.get('vocal.range', null);
  if (saved && typeof saved.lo === 'number' && typeof saved.hi === 'number') { lo = saved.lo; hi = saved.hi; }
  el.innerHTML = `<div class="card center"><div class="big" id="cn">--</div><div class="muted" id="cf">Sing a steady note</div></div>
    <div class="row"><div class="card center"><div class="muted">Lowest</div><div class="mid" id="lo">--</div></div><div class="card center"><div class="muted">Highest</div><div class="mid" id="hi">--</div></div></div>
    <div class="card center"><div id="rg">Sing from your lowest to your highest comfortable note.</div><div class="muted" id="vt"></div></div>
    <div class="row"><button class="btn" id="go">Start</button><button class="btn alt" id="rs">Reset range</button></div><div class="muted center" id="msg"></div>`;
  function type(mid) { return mid < 50 ? 'Bass' : mid < 55 ? 'Baritone' : mid < 60 ? 'Tenor' : mid < 66 ? 'Alto' : mid < 70 ? 'Mezzo-soprano' : 'Soprano'; }
  function paint() {
    setText(el, '#lo', lo === null ? '--' : noteName(lo)); setText(el, '#hi', hi === null ? '--' : noteName(hi));
    if (lo !== null && hi !== null && hi > lo) {
      const st = hi - lo; setText(el, '#rg', st + ' semitones (' + (st / 12).toFixed(1) + ' octaves)');
      setText(el, '#vt', 'Rough guess: ' + type((lo + hi) / 2) + '. This is only an estimate.');
    } else { setText(el, '#rg', 'Sing from your lowest to your highest comfortable note.'); setText(el, '#vt', ''); }
  }
  $('#rs', el).onclick = () => { lo = hi = null; Store.set('vocal.range', null); paint(); };
  L.raf(() => {
    if (!on || !an || (frame++) % 3) return;
    an.getFloatTimeDomainData(buf);
    if (rms(buf) < 0.012) { stable = 0; return; }
    const p = yinPitch(buf, ctx.sampleRate, 60, 1400, 0.12);
    if (!p || p.prob < 0.85) { stable = 0; return; }
    const m = freqToMidi(p.freq), r = Math.round(m);
    setText(el, '#cn', noteName(r)); setText(el, '#cf', p.freq.toFixed(1) + ' Hz');
    if (lastM !== null && Math.abs(m - lastM) < 0.7) stable++; else stable = 0;
    lastM = m;
    if (stable >= 6) {
      let ch = false;
      if (lo === null || r < lo) { lo = r; ch = true; } if (hi === null || r > hi) { hi = r; ch = true; }
      if (ch) { Store.set('vocal.range', { lo, hi }); paint(); }
    }
  });
  $('#go', el).onclick = () => {
    if (on) { on = false; closeCtx(ctx); L.streams.forEach(stopStream); L.streams = []; ctx = an = null; setText(el, '#go', 'Start'); return; }
    if (pending) return;
    pending = true; setText(el, '#msg', '');
    L.mic().then(s => {
      try {
        ctx = L.ctx(); an = ctx.createAnalyser(); an.fftSize = 4096; ctx.createMediaStreamSource(s).connect(an);
        buf = new Float32Array(an.fftSize); on = true; stable = 0; lastM = null; setText(el, '#go', 'Stop');
      } catch (e) { L.drop(s); closeCtx(ctx); ctx = an = null; throw e; }
    }).catch(e => micFail(el, e)).then(() => { pending = false; });
  };
  paint();
  return () => { on = false; L.stop(); };
} });

/* ---------------------------------------------------------------- Tone Sequencer */
Tools.register({ id: 'toneseq', pro: true, proKey: 'audio', name: 'Tone Sequencer', icon: '🎛️', cat: 'audio', desc: 'Compose a looping 16-step melody on a pentatonic grid with adjustable tempo and sound.', keys: ['sequencer', 'melody', 'loop', 'synth', 'compose', 'music maker', 'step'], needs: [], render(el) {
  const L = life();
  const ROWS = [72, 69, 67, 64, 62, 60, 57, 55], STEPS = 16;
  let grid = Store.get('toneseq.grid', null);
  if (!Array.isArray(grid) || grid.length !== ROWS.length || grid.some(r => !Array.isArray(r) || r.length !== STEPS)) grid = ROWS.map(() => new Array(STEPS).fill(false));
  let bpm = clamp(+Store.get('toneseq.bpm', 110), 60, 200), playing = false, ctx = null, master = null, next = 0, step = 0, timer = null, queue = [], lit = -1;
  el.innerHTML = `<div style="overflow-x:auto;padding-bottom:6px"><div id="g" style="display:grid;grid-template-columns:repeat(${STEPS},34px);gap:4px;width:max-content"></div></div>
    <label class="f" style="margin-top:8px">Tempo <span id="bv"></span> BPM<input id="bpm" type="range" min="60" max="200" style="width:100%"></label>
    <label class="f">Sound<select id="wf"><option value="triangle">Soft</option><option value="sine">Pure</option><option value="square">Retro</option><option value="sawtooth">Bright</option></select></label>
    <div class="row"><button class="btn" id="go">Play</button><button class="btn alt" id="rn">Random</button><button class="btn alt" id="cl">Clear</button></div>`;
  const cells = [];
  const gridEl = $('#g', el);
  for (let r = 0; r < ROWS.length; r++) for (let s = 0; s < STEPS; s++) {
    const c = document.createElement('button'); c.setAttribute('aria-label', noteName(ROWS[r]) + ' step ' + (s + 1));
    c.style.cssText = 'height:34px;border-radius:8px;border:1px solid var(--line);padding:0';
    c.onclick = () => { grid[r][s] = !grid[r][s]; paintCell(r, s); Store.set('toneseq.grid', grid); };
    gridEl.appendChild(c); (cells[r] = cells[r] || [])[s] = c;
  }
  function paintCell(r, s) { const c = cells[r][s]; c.setAttribute('aria-pressed', grid[r][s] ? 'true' : 'false'); c.style.background = grid[r][s] ? 'var(--accent)' : (s % 4 === 0 ? 'var(--surface2)' : 'var(--surface)'); c.style.outline = s === lit ? '2px solid var(--ok)' : 'none'; }
  function paintAll() { for (let r = 0; r < ROWS.length; r++) for (let s = 0; s < STEPS; s++) paintCell(r, s); }
  function play(m, t, d) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = $('#wf', el).value; o.frequency.value = midiToFreq(m);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.05);
  }
  function sched() {
    while (next < ctx.currentTime + 0.12) {
      const d = 60 / bpm / 2;
      for (let r = 0; r < ROWS.length; r++) if (grid[r][step]) play(ROWS[r], next, d * 1.6);
      queue.push({ t: next, s: step }); next += d; step = (step + 1) % STEPS;
    }
  }
  function stop() {
    playing = false; clearInterval(timer); timer = null; queue = [];
    if (ctx) { closeCtx(ctx); ctx = null; }
    setText(el, '#go', 'Play'); const o = lit; lit = -1; if (o >= 0) for (let r = 0; r < ROWS.length; r++) paintCell(r, o);
  }
  $('#go', el).onclick = () => {
    if (playing) { stop(); return; }
    ctx = L.ctx(); master = newMaster(ctx, 0.6); playing = true; step = 0; next = ctx.currentTime + 0.06; queue = []; sched(); timer = setInterval(sched, 25); setText(el, '#go', 'Stop');
  };
  L.on(() => clearInterval(timer));
  L.raf(() => {
    if (!playing || !ctx) return;
    let cur = -1; while (queue.length && queue[0].t <= ctx.currentTime) cur = queue.shift().s;
    if (cur >= 0 && cur !== lit) { const o = lit; lit = cur; for (let r = 0; r < ROWS.length; r++) { if (o >= 0) paintCell(r, o); paintCell(r, cur); } }
  });
  $('#bpm', el).value = bpm; setText(el, '#bv', bpm);
  $('#bpm', el).oninput = e => { bpm = +e.target.value; setText(el, '#bv', bpm); Store.set('toneseq.bpm', bpm); };
  $('#cl', el).onclick = () => { grid = ROWS.map(() => new Array(STEPS).fill(false)); Store.set('toneseq.grid', grid); paintAll(); };
  $('#rn', el).onclick = () => { grid = ROWS.map(() => new Array(STEPS).fill(false)); for (let s = 0; s < STEPS; s++) if (Math.random() < 0.6) grid[Math.floor(Math.random() * ROWS.length)][s] = true; Store.set('toneseq.grid', grid); paintAll(); };
  paintAll();
  return () => { playing = false; L.stop(); };
} });

/* ---------------------------------------------------------------- Pitch Pipe */
Tools.register({ id: 'pitchpipe', name: 'Pitch Pipe', icon: '🎺', cat: 'audio', desc: 'Play a steady reference note for any of the 12 notes in three octaves, handy for tuning voice or instruments by ear.', keys: ['reference', 'note', 'a440', 'tuning fork', 'choir', 'sing'], needs: [], render(el) {
  const L = life();
  let ctx = null, g = null, oscs = [], cur = -1;
  el.innerHTML = `<label class="f">Octave<select id="oc"><option value="3">3 (low)</option><option value="4" selected>4 (middle)</option><option value="5">5 (high)</option></select></label>
    <div class="keys" id="nt" style="margin:8px 0"></div>
    <label class="f">Volume <span id="vv">40</span>%<input id="vol" type="range" min="1" max="100" value="40" style="width:100%"></label>
    <div class="card center"><div class="mid" id="info">Tap a note. Tap it again to stop.</div></div>`;
  $('#nt', el).innerHTML = NOTE_NAMES.map((n, i) => `<button data-n="${i}">${n}</button>`).join('');
  const vol = () => Math.pow(+$('#vol', el).value / 100, 2) * 0.6;
  function silence() {
    if (g && ctx) { g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.03); const o = oscs; setTimeout(() => o.forEach(x => { try { x.stop(); } catch (e) { } }), 200); }
    oscs = []; cur = -1; $$('#nt button', el).forEach(b => { b.style.background = ''; b.style.color = ''; }); setText(el, '#info', 'Tap a note. Tap it again to stop.');
  }
  $('#nt', el).onclick = e => {
    const b = e.target.closest('button'); if (!b) return; const n = +b.dataset.n;
    const was = cur === n; silence(); if (was) return;
    if (!ctx) ctx = L.ctx();
    const m = 12 * (+$('#oc', el).value + 1) + n, f = midiToFreq(m);
    g = ctx.createGain(); g.gain.value = 0.0001; g.connect(ctx.destination);
    oscs = [['triangle', f, 1], ['sine', f * 2, 0.25]].map(([t, fq, a]) => { const o = ctx.createOscillator(), og = ctx.createGain(); o.type = t; o.frequency.value = fq; og.gain.value = a; o.connect(og); og.connect(g); o.start(); return o; });
    g.gain.setTargetAtTime(vol(), ctx.currentTime, 0.03); cur = n; b.style.background = 'var(--accent)'; b.style.color = 'var(--accent-t)';
    setText(el, '#info', noteName(m) + ' · ' + f.toFixed(1) + ' Hz');
  };
  $('#oc', el).onchange = () => silence();
  $('#vol', el).oninput = e => { setText(el, '#vv', e.target.value); if (g && cur >= 0) g.gain.setTargetAtTime(vol(), ctx.currentTime, 0.03); };
  return () => L.stop();
} });

})();
