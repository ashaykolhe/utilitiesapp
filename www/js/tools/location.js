'use strict';
/* Speedometer and Altitude read the GPS through the WebView's geolocation. */
(() => {
  function gps(el, onPos) {
    const set = t => { const m = $('#msg', el); if (m) m.textContent = t; };
    if (!navigator.geolocation) { set('This device has no location support.'); return () => {}; }
    const id = navigator.geolocation.watchPosition(onPos, e => {
      set(e.code === 1 ? 'Location permission denied. Allow location for PocketKit in Settings.'
        : e.code === 2 ? 'Location unavailable. Check that GPS is on and you have a clear sky view.'
        : e.code === 3 ? 'Timed out waiting for GPS. Still trying...' : 'Waiting for GPS...');
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
    return () => navigator.geolocation.clearWatch(id);
  }
  function dist(a, b) {
    const R = 6371000, r = Math.PI / 180, dLa = (b.latitude - a.latitude) * r, dLo = (b.longitude - a.longitude) * r;
    const x = Math.sin(dLa / 2) ** 2 + Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  /* One GPS fix: c = {latitude, longitude, accuracy, speed|null}, t in ms. st = {last, hist, d}.
     Distance only grows when we moved further than the noise (max(3 m, accuracy/2)) from the last counted point,
     and `last` only advances when that movement is counted, so slow walking accumulates and drift does not. */
  function trackFix(st, c, t) {
    const good = c.accuracy != null && c.accuracy < 30;
    if (good) {
      if (!st.last) st.last = c;
      else {
        const s = dist(st.last, c), thr = Math.max(3, c.accuracy * 0.5);
        if (s > thr) { st.d += s; st.last = c; }
      }
    }
    let v = 0;
    if (c.speed != null && isFinite(c.speed) && c.speed >= 0) v = c.speed * 3.6;
    else if (good && st.hist.length) {
      // no Doppler speed: use the newest earlier fix that is at least 3 s old (or the oldest we have)
      let ref = st.hist[0];
      for (let i = st.hist.length - 1; i >= 0; i--) if (t - st.hist[i].t >= 3000) { ref = st.hist[i]; break; }
      const dt = (t - ref.t) / 1000, s = dist(ref.c, c);
      if (dt > 0.3 && s > Math.max(3, c.accuracy * 0.5)) v = s / dt * 3.6;
    }
    if (good) { st.hist.push({ c, t }); while (st.hist.length && t - st.hist[0].t > 8000) st.hist.shift(); }
    if (v < 1) v = 0;
    return v;
  }

  Tools.register({ id: 'speedometer', name: 'Speedometer', icon: '🚗', cat: 'navigate', desc: 'Live speed from GPS with top speed and trip distance.', needs: ['location'], render(el) {
    el.innerHTML = `<div class="card center"><div class="big" id="sp" aria-live="polite">0</div><div class="muted">km/h</div><div class="muted" id="msg">Waiting for GPS...</div></div>
      <div class="card row center"><div><div class="mid" id="mx">0</div><small class="muted">Max km/h</small></div><div><div class="mid" id="di" aria-live="polite">0.00</div><small class="muted">Distance km</small></div></div>
      <button class="btn alt" id="rs">Reset trip</button>`;
    let st = { last: null, hist: [], d: 0 }, max = 0;
    const stop = gps(el, p => {
      const c = p.coords; if (!c || !isFinite(c.latitude) || !isFinite(c.longitude)) return;
      const v = trackFix(st, c, p.timestamp || Date.now());
      max = Math.max(max, isFinite(v) ? v : 0);
      $('#sp', el).textContent = isFinite(v) ? Math.round(v) : '--'; $('#mx', el).textContent = Math.round(max);
      $('#di', el).textContent = (st.d / 1000).toFixed(2);
      $('#msg', el).textContent = c.accuracy >= 30 ? 'Weak GPS signal (±' + Math.round(c.accuracy) + ' m); distance paused' : '';
    });
    $('#rs', el).onclick = () => { max = 0; st = { last: null, hist: [], d: 0 }; $('#mx', el).textContent = '0'; $('#di', el).textContent = '0.00'; };
    return stop;
  } });
  Tools.register({ id: 'altitude', name: 'Altitude', icon: '⛰️', cat: 'navigate', desc: 'Approximate height above sea level from GPS, with your coordinates. GPS altitude can be off by tens of metres.', needs: ['location'], render(el) {
    el.innerHTML = `<div class="card center"><div class="big" id="al" aria-live="polite">--</div><div class="muted">GPS altitude (approximate), metres</div><div class="muted" id="ac2"></div><div class="muted" id="msg">Waiting for GPS...</div></div>
      <div class="card list"><div class="item"><span class="grow">Latitude</span><b id="la">--</b></div><div class="item"><span class="grow">Longitude</span><b id="lo">--</b></div><div class="item"><span class="grow">Position accuracy</span><b id="ac">--</b></div></div>`;
    return gps(el, p => {
      const c = p.coords; if (!c || !isFinite(c.latitude) || !isFinite(c.longitude)) return;
      $('#al', el).textContent = c.altitude != null && isFinite(c.altitude) ? Math.round(c.altitude) : 'n/a';
      $('#ac2', el).textContent = c.altitude != null && c.altitudeAccuracy != null ? '±' + Math.round(c.altitudeAccuracy) + ' m' : '';
      $('#la', el).textContent = c.latitude.toFixed(5); $('#lo', el).textContent = c.longitude.toFixed(5);
      $('#ac', el).textContent = isFinite(c.accuracy) ? '±' + Math.round(c.accuracy) + ' m' : '--'; $('#msg', el).textContent = c.altitude == null || !isFinite(c.altitude) ? 'This device did not report an altitude.' : '';
    });
  } });

  if (typeof module !== 'undefined' && module.exports) module.exports = { trackFix, dist };
})();
