'use strict';
Tools.register({ id: 'paint', name: 'Paint', icon: '🎨', cat: 'create', desc: 'Draw with colours and brush sizes, undo, and save the picture as an image.', needs: ['storage'], render(el) {
  el.innerHTML = `<canvas id="c" width="800" height="800"></canvas>
    <div class="row"><input id="col" type="color" value="#0f766e" style="height:44px"><input id="sz" type="range" min="2" max="40" value="6"><button class="btn alt" id="er">Eraser</button></div>
    <div class="row"><button class="btn alt" id="un">Undo</button><button class="btn alt" id="cl">Clear</button><button class="btn" id="sv">Save</button></div>`;
  const cv = $('#c', el), x = cv.getContext('2d');
  let down = false, erase = false, hist = [];
  const blank = () => { x.fillStyle = '#fff'; x.fillRect(0, 0, 800, 800); };
  const snap = () => { hist.push(x.getImageData(0, 0, 800, 800)); if (hist.length > 15) hist.shift(); };
  const pt = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * 800 / r.width, (e.clientY - r.top) * 800 / r.height]; };
  blank();
  cv.onpointerdown = e => {
    snap(); down = true; cv.setPointerCapture(e.pointerId);
    x.lineCap = x.lineJoin = 'round'; x.lineWidth = +$('#sz', el).value; x.strokeStyle = erase ? '#fff' : $('#col', el).value;
    const [a, b] = pt(e); x.beginPath(); x.moveTo(a, b); x.lineTo(a + .01, b); x.stroke();
  };
  cv.onpointermove = e => { if (!down) return; const [a, b] = pt(e); x.lineTo(a, b); x.stroke(); };
  cv.onpointerup = cv.onpointercancel = () => { down = false; };
  $('#er', el).onclick = e => { erase = !erase; e.target.textContent = erase ? 'Pen' : 'Eraser'; };
  $('#un', el).onclick = () => { const s = hist.pop(); if (s) x.putImageData(s, 0, 0); };
  $('#cl', el).onclick = () => { snap(); blank(); };
  $('#sv', el).onclick = () => {
    const a = document.createElement('a'); a.href = cv.toDataURL('image/png'); a.download = 'drawing-' + Date.now() + '.png'; a.click(); toast('Saved');
  };
} });
