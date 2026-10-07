'use strict';
/* Compass and Leveler use the device orientation sensor. iOS needs a permission tap; Android Chrome does not. */
(() => {
  const RAD = Math.PI / 180;

  async function orientationPermission() {
    const D = window.DeviceOrientationEvent;
    if (D && typeof D.requestPermission === 'function') return (await D.requestPermission()) === 'granted';
    return true;
  }
  const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

  /* Tilt-compensated compass heading (0..360, clockwise from north) from absolute alpha/beta/gamma.
     Flat phone: heading of the top edge. Standing up: heading of the rear camera (W3C formula). */
  function compassHeading(alpha, beta, gamma) {
    const a = alpha * RAD, b = beta * RAD, g = gamma * RAD;
    const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cg = Math.cos(g), sg = Math.sin(g);
    const zUp = cb * cg; // 1 = flat face up
    let east, north;
    if (Math.abs(zUp) > 0.7) { east = -sa * cb; north = ca * cb; }            // top edge direction
    else { east = -ca * sg - sa * sb * cg; north = -sa * sg + ca * sb * cg; } // rear camera direction
    return (Math.atan2(east, north) / RAD + 360) % 360;
  }

  Tools.register({ id: 'compass', name: 'Compass', icon: '🧭', cat: 'navigate', desc: 'A compass that points to magnetic north with the heading in degrees.', needs: ['motion'], render(el) {
    el.innerHTML = `<div class="card center"><svg id="rose" role="img" aria-label="Compass rose" viewBox="-100 -100 200 200" width="240" height="240" style="transition:transform .1s linear">
      <circle r="95" fill="none" stroke="currentColor" opacity=".3" stroke-width="2"/>
      ${[0, 90, 180, 270].map((a, i) => `<text y="-72" text-anchor="middle" font-size="20" font-weight="700" fill="${i ? 'currentColor' : '#dc2626'}" transform="rotate(${a})">${'NESW'[i]}</text>`).join('')}
      <path d="M0-60L8 0H-8Z" fill="#dc2626"/><path d="M0 60L8 0H-8Z" fill="currentColor" opacity=".5"/></svg>
      <div class="mid" id="deg" aria-live="polite">--</div><div class="muted" id="msg">Hold the phone flat</div></div>
      <p class="muted center" style="font-size:12px;margin:2px 8px">Keep away from magnets, speaker cases and metal. If the heading drifts or looks wrong, wave the phone in a figure 8 a few times. The arrow points to magnetic north.</p>`;
    let dead = false, cur = null, to = 0;
    const on = (e) => {
      let a = null;
      if (e.webkitCompassHeading != null) a = e.webkitCompassHeading;
      else if ((e.absolute || e.type === 'deviceorientationabsolute') && e.alpha != null) {
        a = e.beta != null && e.gamma != null ? compassHeading(e.alpha, e.beta, e.gamma) : (360 - e.alpha) % 360;
      }
      if (a == null || !isFinite(a)) return;
      a = (a + 360) % 360;
      // unwrap so the rose takes the short way across 359/0
      if (cur == null) cur = a; else cur += ((a - cur) % 360 + 540) % 360 - 180;
      $('#rose', el).style.transform = `rotate(${-cur}deg)`;
      $('#deg', el).textContent = Math.round(a) % 360 + '° ' + DIRS[Math.round(a / 45) % 8]; $('#msg', el).textContent = '';
    };
    const off = () => { removeEventListener('deviceorientationabsolute', on); removeEventListener('deviceorientation', on); };
    orientationPermission().then(ok => {
      if (dead) return;
      if (!ok) { $('#msg', el).textContent = 'Sensor permission denied'; return; }
      addEventListener('deviceorientationabsolute', on); addEventListener('deviceorientation', on);
      to = setTimeout(() => { const d = $('#deg', el); if (!dead && d && d.textContent === '--') $('#msg', el).textContent = 'No compass sensor found on this device'; }, 2500);
    }).catch(() => { if (!dead) $('#msg', el).textContent = 'Sensor permission denied'; });
    return () => { dead = true; clearTimeout(to); off(); };
  } });

  Tools.register({ id: 'leveler', name: 'Leveler', icon: '📶', cat: 'navigate', desc: 'A bubble level for checking whether a surface is flat, with a zero button.', needs: ['motion'], render(el) {
    el.innerHTML = `<div class="card center"><div role="img" aria-label="Bubble level" style="position:relative;width:240px;height:240px;margin:0 auto;border:2px solid var(--line);border-radius:50%">
      <div style="position:absolute;left:50%;top:0;bottom:0;border-left:1px dashed var(--muted)"></div><div style="position:absolute;top:50%;left:0;right:0;border-top:1px dashed var(--muted)"></div>
      <div id="bub" style="position:absolute;left:50%;top:50%;width:44px;height:44px;margin:-22px;border-radius:50%;background:var(--accent)"></div></div>
      <div class="mid" id="deg" aria-live="polite">--</div><div class="muted" id="msg">Lay the phone flat; the bubble shows tilt</div></div>
      <button class="btn alt" id="cal">Set current position as zero</button>
      <p class="muted center" style="font-size:12px;margin:2px 8px">Lay the phone flat on the surface. The bubble turns green within half a degree of level. To check the phone itself, flip it 180 degrees: a true level reads the same both ways.</p>`;
    let b = 0, g = 0, ob = 0, og = 0, dead = false, to = 0;
    const on = (e) => {
      if (e.beta == null || e.gamma == null) return;
      b = e.beta; g = e.gamma;
      const x = Math.max(-45, Math.min(45, g - og)), y = Math.max(-45, Math.min(45, b - ob));
      $('#bub', el).style.transform = `translate(${Math.round(x * 22) / 10}px,${Math.round(y * 22) / 10}px)`;
      $('#deg', el).textContent = `${(b - ob).toFixed(1)}° / ${(g - og).toFixed(1)}°`;
      const lv = Math.abs(b - ob) < 0.5 && Math.abs(g - og) < 0.5; $('#bub', el).style.background = lv ? 'var(--ok)' : 'var(--accent)'; $('#msg', el).textContent = lv ? 'Level' : 'Front-back tilt / left-right tilt, in degrees';
    };
    $('#cal', el).onclick = () => { ob = b; og = g; };
    orientationPermission().then(ok => {
      if (dead) return;
      if (!ok) { $('#msg', el).textContent = 'Sensor permission denied'; return; }
      addEventListener('deviceorientation', on);
      to = setTimeout(() => { const d = $('#deg', el); if (!dead && d && d.textContent === '--') $('#msg', el).textContent = 'No orientation sensor found on this device'; }, 2500);
    }).catch(() => { if (!dead) $('#msg', el).textContent = 'Sensor permission denied'; });
    return () => { dead = true; clearTimeout(to); removeEventListener('deviceorientation', on); };
  } });

  if (typeof module !== 'undefined' && module.exports) module.exports = { compassHeading };
})();
