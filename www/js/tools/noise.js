'use strict';
/* Sound meter: relative level in dB from the microphone (not a calibrated SPL reading). */
Tools.register({ id: 'noise', name: 'Sound Intensity', icon: '📢', cat: 'measure', desc: 'Approximate sound level in decibels from the microphone, with minimum and maximum.', needs: ['microphone'], render(el) {
  el.innerHTML = `<div class="card center"><div class="big" id="db">--</div><div class="muted">dB (approximate)</div><div class="muted" id="msg"></div></div>
    <div class="card row center"><div><div class="mid" id="mn">--</div><small class="muted">Min</small></div><div><div class="mid" id="mx">--</div><small class="muted">Max</small></div></div>`;
  let ctx, stream, raf, alive = true, mn = 999, mx = 0;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { $('#msg', el).textContent = 'Microphone is not available on this device'; return () => {}; }
  navigator.mediaDevices.getUserMedia({ audio: true }).then(s => {
    if (!alive) { s.getTracks().forEach(t => t.stop()); return; }
    stream = s; ctx = new (window.AudioContext || window.webkitAudioContext)();
    const an = ctx.createAnalyser(); an.fftSize = 2048; ctx.createMediaStreamSource(s).connect(an);
    const buf = new Float32Array(an.fftSize);
    (function loop() {
      an.getFloatTimeDomainData(buf);
      let sum = 0; for (const v of buf) sum += v * v;
      const db = Math.max(0, Math.round(20 * Math.log10(Math.sqrt(sum / buf.length) || 1e-5) + 90));
      mn = Math.min(mn, db); mx = Math.max(mx, db);
      $('#db', el).textContent = db; $('#mn', el).textContent = mn; $('#mx', el).textContent = mx;
      raf = requestAnimationFrame(loop);
    })();
  }).catch(() => { $('#msg', el).textContent = 'Microphone permission denied'; });
  return () => { alive = false; cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach(t => t.stop()); if (ctx) ctx.close(); };
} });
