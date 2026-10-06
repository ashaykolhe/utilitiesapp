'use strict';
/* Timer (countdown with alert) and Stopwatch (with laps). */
function beep() {
  try {
    const c = new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator();
    o.connect(c.destination); o.frequency.value = 880; o.start(); setTimeout(() => { o.stop(); c.close(); }, 700);
  } catch (e) {}
  if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
}
const fmt = (ms, cs) => {
  const s = Math.floor(ms / 1000), hh = Math.floor(s / 3600), mm = Math.floor(s % 3600 / 60), ss = s % 60;
  return (hh ? pad(hh) + ':' : '') + pad(mm) + ':' + pad(ss) + (cs ? '.' + pad(Math.floor(ms % 1000 / 10)) : '');
};

Tools.register({ id: 'timer', name: 'Timer', icon: '⌛', cat: 'daily', desc: 'Count down from any time and get an alert when it ends, even with the screen off.', needs: ['notifications'], render(el) {
  /* Listeners live on a child root, so nothing is attached to the (shared) container. */
  const root = document.createElement('div'); root.style.cssText = 'display:flex;flex-direction:column;gap:12px'; el.appendChild(root);
  const ln = () => window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications;
  const NID = 710001; /* Timer owns 710001; other tools use their own blocks (see daily.js) */
  root.innerHTML = `<div class="card"><div class="big" id="d" role="timer" aria-live="off">00:00</div>
    <div class="row"><input id="m" type="number" min="0" max="999" step="1" placeholder="min" aria-label="Minutes" value="5"><input id="s" type="number" min="0" max="59" step="1" placeholder="sec" aria-label="Seconds" value="0"></div></div>
    <div class="row"><button class="btn" id="go">Start</button><button class="btn alt" id="rs">Reset</button></div>
    <div class="card" id="nb" hidden role="status" style="font-size:13px;line-height:1.5;color:var(--danger);border-color:var(--danger)">Notifications are blocked: the alert only sounds while PocketKit is open. Allow them in Android settings.</div>
    <div class="muted" style="font-size:13px;line-height:1.45;margin:0 4px">${ln() ? 'When the time is up you get a notification, even with the screen off. It can arrive a few minutes late when the phone is idle or battery saver is on.' : 'This browser cannot notify while closed, so the alert only sounds while PocketKit is open.'}</div>`;
  let end = 0, left = 0, iv = null, running = false;
  const read = () => Math.max(0, Math.max(0, Math.min(999, Math.floor(+$('#m', root).value || 0))) * 60000 + Math.max(0, Math.min(59, Math.floor(+$('#s', root).value || 0))) * 1000);
  const draw = () => { $('#d', root).textContent = fmt(left || read()); };
  const stop = () => { clearInterval(iv); iv = null; };
  const store = (v) => { try { Store.set('timer.run', v); } catch (e) {} };
  const cancelNote = async () => { const p = ln(); if (p) try { await p.cancel({ notifications: [{ id: NID }] }); } catch (e) {} };
  /* true = scheduled, false = blocked or failed, null = no native plugin (browser) */
  async function schedule(at) {
    const p = ln(); if (!p) return null;
    try {
      const perm = await p.requestPermissions();
      if (perm.display !== 'granted') return false;
      await p.schedule({ notifications: [{ id: NID, title: 'Timer finished', body: 'Time is up', schedule: { at: new Date(at), allowWhileIdle: true } }] });
      return true;
    } catch (e) { return false; }
  }
  const showBlocked = (on) => { $('#nb', root).hidden = !on; };
  const tick = () => {
    left = end - Date.now();
    if (left <= 0) {
      left = 0; stop(); running = false; store(null); cancelNote();
      $('#d', root).textContent = '00:00'; $('#go', root).textContent = 'Start'; beep(); toast('Time is up'); return;
    }
    draw();
  };
  function run() {
    end = Date.now() + left; running = true; iv = setInterval(tick, 200); $('#go', root).textContent = 'Pause'; store({ end }); tick();
  }
  $('#go', root).onclick = () => {
    if (iv) { stop(); running = false; store(null); cancelNote(); $('#go', root).textContent = 'Resume'; return; }
    if (!left) left = read();
    if (!left) return;
    run();
    const my = end;
    schedule(my).then(ok => { if (!running || end !== my) { cancelNote(); return; } showBlocked(ok === false); });
  };
  $('#rs', root).onclick = () => { stop(); running = false; store(null); cancelNote(); left = 0; showBlocked(false); $('#go', root).textContent = 'Start'; draw(); };
  root.addEventListener('input', () => { if (!iv && !left) draw(); });
  /* A timer that was running when the user left the tool carries on (its notification is still scheduled). */
  try {
    const saved = Store.get('timer.run', null);
    if (saved && saved.end > Date.now() + 500) { left = saved.end - Date.now(); run(); }
    else if (saved) store(null);
  } catch (e) {}
  const p0 = ln();
  if (p0 && p0.checkPermissions) p0.checkPermissions().then(r => { if (r.display === 'denied') showBlocked(true); }).catch(() => {});
  draw();
  return stop;
} });

Tools.register({ id: 'stopwatch', name: 'Stopwatch', icon: '⏱️', cat: 'daily', desc: 'Time anything to the hundredth of a second, with laps.', needs: [], render(el) {
  el.innerHTML = `<div class="card"><div class="big" id="d">00:00.00</div></div>
    <div class="row"><button class="btn" id="go">Start</button><button class="btn alt" id="lap">Lap</button><button class="btn alt" id="rs">Reset</button></div>
    <div class="list" id="laps"></div>`;
  let base = 0, acc = 0, iv = null, laps = [];
  const now = () => acc + (iv ? Date.now() - base : 0);
  const draw = () => { $('#d', el).textContent = fmt(now(), true); };
  $('#go', el).onclick = () => {
    if (iv) { acc = now(); clearInterval(iv); iv = null; $('#go', el).textContent = 'Resume'; }
    else { base = Date.now(); iv = setInterval(draw, 30); $('#go', el).textContent = 'Pause'; }
  };
  $('#lap', el).onclick = () => {
    if (!iv) return;
    if (laps.length >= 500) return;
    laps.unshift(now());
    $('#laps', el).innerHTML = laps.map((l, i) => `<div class="item"><span class="grow">Lap ${laps.length - i}</span><b>${fmt(l, true)}</b></div>`).join('');
  };
  $('#rs', el).onclick = () => { clearInterval(iv); iv = null; acc = 0; laps = []; $('#laps', el).innerHTML = ''; $('#go', el).textContent = 'Start'; draw(); };
  return () => clearInterval(iv);
} });
