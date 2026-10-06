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

Tools.register({ id: 'timer', name: 'Timer', icon: '⏳', cat: 'daily', desc: 'Count down from any time and get an alert when it ends.', needs: [], render(el) {
  el.innerHTML = `<div class="card"><div class="big" id="d">00:00</div>
    <div class="row"><input id="m" type="number" min="0" max="999" placeholder="min" value="5"><input id="s" type="number" min="0" max="59" placeholder="sec" value="0"></div></div>
    <div class="row"><button class="btn" id="go">Start</button><button class="btn alt" id="rs">Reset</button></div>`;
  let end = 0, left = 0, iv = null;
  const read = () => Math.max(0, (+$('#m', el).value || 0) * 60000 + (Math.min(59, +$('#s', el).value || 0)) * 1000);
  const draw = () => { $('#d', el).textContent = fmt(left || read()); };
  const stop = () => { clearInterval(iv); iv = null; };
  const tick = () => {
    left = end - Date.now();
    if (left <= 0) { left = 0; stop(); $('#d', el).textContent = '00:00'; $('#go', el).textContent = 'Start'; beep(); toast('Time is up'); return; }
    draw();
  };
  $('#go', el).onclick = () => {
    if (iv) { stop(); $('#go', el).textContent = 'Resume'; return; }
    if (!left) left = read();
    if (!left) return;
    end = Date.now() + left; iv = setInterval(tick, 200); $('#go', el).textContent = 'Pause'; tick();
  };
  $('#rs', el).onclick = () => { stop(); left = 0; $('#go', el).textContent = 'Start'; draw(); };
  el.addEventListener('input', () => { if (!iv && !left) draw(); });
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
    laps.unshift(now());
    $('#laps', el).innerHTML = laps.map((l, i) => `<div class="item"><span class="grow">Lap ${laps.length - i}</span><b>${fmt(l, true)}</b></div>`).join('');
  };
  $('#rs', el).onclick = () => { clearInterval(iv); iv = null; acc = 0; laps = []; $('#laps', el).innerHTML = ''; $('#go', el).textContent = 'Start'; draw(); };
  return () => clearInterval(iv);
} });
