'use strict';
/* Speedometer and Altitude read the GPS through the WebView's geolocation. */
function gps(el, onPos) {
  if (!navigator.geolocation) { toast('No location support'); return () => {}; }
  const id = navigator.geolocation.watchPosition(onPos, e => {
    const m = $('#msg', el); if (m) m.textContent = e.code === 1 ? 'Location permission denied' : 'Waiting for GPS...';
  }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  return () => navigator.geolocation.clearWatch(id);
}
function dist(a, b) {
  const R = 6371000, r = Math.PI / 180, dLa = (b.latitude - a.latitude) * r, dLo = (b.longitude - a.longitude) * r;
  const x = Math.sin(dLa / 2) ** 2 + Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
Tools.register({ id: 'speedometer', name: 'Speedometer', icon: '🚗', cat: 'navigate', desc: 'Live speed from GPS with top speed and trip distance.', needs: ['location'], render(el) {
  el.innerHTML = `<div class="card center"><div class="big" id="sp">0</div><div class="muted">km/h</div><div class="muted" id="msg">Waiting for GPS...</div></div>
    <div class="card row center"><div><div class="mid" id="mx">0</div><small class="muted">Max km/h</small></div><div><div class="mid" id="di">0.00</div><small class="muted">Distance km</small></div></div>
    <button class="btn alt" id="rs">Reset trip</button>`;
  let last = null, max = 0, d = 0;
  const stop = gps(el, p => {
    const c = p.coords; let v = c.speed != null ? c.speed * 3.6 : 0;
    if (c.accuracy < 50 && last) { const s = dist(last, c); if (s > 2) d += s; }
    if (c.accuracy < 50) last = c;
    if (v < 1) v = 0;
    max = Math.max(max, v);
    $('#sp', el).textContent = Math.round(v); $('#mx', el).textContent = Math.round(max);
    $('#di', el).textContent = (d / 1000).toFixed(2); $('#msg', el).textContent = '';
  });
  $('#rs', el).onclick = () => { max = 0; d = 0; last = null; $('#mx', el).textContent = '0'; $('#di', el).textContent = '0.00'; };
  return stop;
} });
Tools.register({ id: 'altitude', name: 'Altitude', icon: '⛰️', cat: 'navigate', desc: 'Height above sea level from GPS, with your coordinates.', needs: ['location'], render(el) {
  el.innerHTML = `<div class="card center"><div class="big" id="al">--</div><div class="muted">metres above sea level (GPS)</div><div class="muted" id="msg">Waiting for GPS...</div></div>
    <div class="card list"><div class="item"><span class="grow">Latitude</span><b id="la">--</b></div><div class="item"><span class="grow">Longitude</span><b id="lo">--</b></div><div class="item"><span class="grow">Accuracy</span><b id="ac">--</b></div></div>`;
  return gps(el, p => {
    const c = p.coords;
    $('#al', el).textContent = c.altitude != null ? Math.round(c.altitude) : 'n/a';
    $('#la', el).textContent = c.latitude.toFixed(5); $('#lo', el).textContent = c.longitude.toFixed(5);
    $('#ac', el).textContent = '±' + Math.round(c.accuracy) + ' m'; $('#msg', el).textContent = '';
  });
} });
