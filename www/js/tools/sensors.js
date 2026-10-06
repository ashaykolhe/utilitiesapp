'use strict';
/* Compass and Leveler use the device orientation sensor. iOS needs a permission tap; Android Chrome does not. */
async function orientationPermission() {
  const D = window.DeviceOrientationEvent;
  if (D && typeof D.requestPermission === 'function') return (await D.requestPermission()) === 'granted';
  return true;
}
const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

Tools.register({ id: 'compass', name: 'Compass', icon: '🧭', cat: 'navigate', desc: 'A compass that points to magnetic north with the heading in degrees.', needs: ['motion'], render(el) {
  el.innerHTML = `<div class="card center"><svg id="rose" viewBox="-100 -100 200 200" width="240" height="240" style="transition:transform .1s linear">
    <circle r="95" fill="none" stroke="currentColor" opacity=".3" stroke-width="2"/>
    ${[0, 90, 180, 270].map((a, i) => `<text y="-72" text-anchor="middle" font-size="20" font-weight="700" fill="${i ? 'currentColor' : '#dc2626'}" transform="rotate(${a})">${'NESW'[i]}</text>`).join('')}
    <path d="M0-60L8 0H-8Z" fill="#dc2626"/><path d="M0 60L8 0H-8Z" fill="currentColor" opacity=".5"/></svg>
    <div class="mid" id="deg">--</div><div class="muted" id="msg">Hold the phone flat</div></div>`;
  const on = (e) => {
    let a = e.webkitCompassHeading != null ? e.webkitCompassHeading
      : ((e.absolute || e.type === 'deviceorientationabsolute') && e.alpha != null ? 360 - e.alpha : null);
    if (a == null) return;
    a = (a + 360) % 360; $('#rose', el).style.transform = `rotate(${-a}deg)`;
    $('#deg', el).textContent = Math.round(a) + '° ' + DIRS[Math.round(a / 45) % 8]; $('#msg', el).textContent = '';
  };
  orientationPermission().then(ok => {
    if (!ok) { $('#msg', el).textContent = 'Sensor permission denied'; return; }
    addEventListener('deviceorientationabsolute', on); addEventListener('deviceorientation', on);
    setTimeout(() => { const d = $('#deg', el); if (d && d.textContent === '--') $('#msg', el).textContent = 'No compass sensor found on this device'; }, 2500);
  });
  return () => { removeEventListener('deviceorientationabsolute', on); removeEventListener('deviceorientation', on); };
} });

Tools.register({ id: 'leveler', name: 'Leveler', icon: '📐', cat: 'navigate', desc: 'A bubble level for checking whether a surface is flat, with a zero button.', needs: ['motion'], render(el) {
  el.innerHTML = `<div class="card center"><div style="position:relative;width:240px;height:240px;margin:0 auto;border:2px solid var(--line);border-radius:50%">
    <div style="position:absolute;left:50%;top:0;bottom:0;border-left:1px dashed var(--muted)"></div><div style="position:absolute;top:50%;left:0;right:0;border-top:1px dashed var(--muted)"></div>
    <div id="bub" style="position:absolute;left:50%;top:50%;width:44px;height:44px;margin:-22px;border-radius:50%;background:var(--accent)"></div></div>
    <div class="mid" id="deg">--</div><div class="muted">Lay the phone flat; the bubble shows tilt</div></div>
    <button class="btn alt" id="cal">Set current position as zero</button>`;
  let b = 0, g = 0, ob = 0, og = 0;
  const on = (e) => {
    if (e.beta == null) return;
    b = e.beta; g = e.gamma;
    const x = Math.max(-45, Math.min(45, g - og)), y = Math.max(-45, Math.min(45, b - ob));
    $('#bub', el).style.transform = `translate(${x * 2.2}px,${y * 2.2}px)`;
    $('#deg', el).textContent = `${(b - ob).toFixed(1)}° / ${(g - og).toFixed(1)}°`;
  };
  $('#cal', el).onclick = () => { ob = b; og = g; };
  orientationPermission().then(ok => { if (ok) addEventListener('deviceorientation', on); });
  return () => removeEventListener('deviceorientation', on);
} });
