'use strict';
(function () {

/* Save a blob: native share sheet on Android (Filesystem in chunks + Share), else a normal download. Resolves true when handed off. */
const CHUNK = 3 * 1024 * 1024; // multiple of 3 so each base64 piece joins cleanly
const b64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
async function saveBlob(blob, name) {
  const P = window.Capacitor && window.Capacitor.Plugins;
  if (P && P.Filesystem && P.Share) {
    let uri = null;
    try {
      for (let off = 0; off === 0 || off < blob.size; off += CHUNK) {
        const data = await b64(blob.slice(off, off + CHUNK));
        if (off === 0) uri = (await P.Filesystem.writeFile({ path: name, data, directory: 'CACHE' })).uri;
        else await P.Filesystem.appendFile({ path: name, data, directory: 'CACHE' });
      }
    } catch (e) { uri = null; }
    if (uri) {
      try { await P.Share.share({ title: name, url: uri }); } catch (e) { /* user closed the sheet */ }
      setTimeout(() => { try { P.Filesystem.deleteFile({ path: name, directory: 'CACHE' }).catch(() => {}); } catch (e) { /* ignore */ } }, 60000);
      return true;
    }
  }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
    return true;
  } catch (e) { return false; }
}

Tools.register({ id: 'paint', name: 'Paint', icon: '🎨', cat: 'create', desc: 'Draw with colours and brush sizes, undo, and save the picture as an image.', needs: ['storage'], render(el) {
  el.innerHTML = `<canvas id="c" width="800" height="800"></canvas>
    <div class="row"><input id="col" type="color" value="#0f766e" style="height:44px" aria-label="Brush colour"><input id="sz" type="range" min="2" max="40" value="6" aria-label="Brush size"><button class="btn alt" id="er">Eraser</button></div>
    <div class="row"><button class="btn alt" id="un">Undo</button><button class="btn alt" id="cl">Clear</button><button class="btn" id="sv">Save</button></div>`;
  const cv = $('#c', el), x = cv.getContext('2d');
  cv.style.touchAction = 'none';
  let down = false, erase = false, hist = [], gone = false;
  const blank = () => { x.fillStyle = '#fff'; x.fillRect(0, 0, 800, 800); };
  const snap = () => { hist.push(x.getImageData(0, 0, 800, 800)); if (hist.length > 15) hist.shift(); };
  const pt = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * 800 / r.width, (e.clientY - r.top) * 800 / r.height]; };
  blank();
  cv.onpointerdown = e => {
    snap(); down = true; cv.setPointerCapture(e.pointerId);
    x.lineCap = x.lineJoin = 'round'; x.lineWidth = +$('#sz', el).value; x.strokeStyle = erase ? '#fff' : $('#col', el).value;
    const [a, b] = pt(e); x.beginPath(); x.moveTo(a, b); x.lineTo(a + .01, b); x.stroke();
    x.beginPath(); x.moveTo(a, b);
  };
  cv.onpointermove = e => { if (!down) return; const [a, b] = pt(e); x.lineTo(a, b); x.stroke(); x.beginPath(); x.moveTo(a, b); };
  cv.onpointerup = cv.onpointercancel = () => { down = false; };
  $('#er', el).onclick = e => { erase = !erase; e.target.textContent = erase ? 'Pen' : 'Eraser'; };
  $('#un', el).onclick = () => { const s = hist.pop(); if (s) x.putImageData(s, 0, 0); };
  $('#cl', el).onclick = () => { snap(); blank(); };
  $('#sv', el).onclick = () => {
    cv.toBlob(async blob => {
      if (!blob) { toast('Could not save the picture'); return; }
      const ok = await saveBlob(blob, 'drawing-' + Date.now() + '.png');
      if (ok && !gone && !(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share)) toast('Saved');
      else if (!ok) toast('Could not save the picture');
    }, 'image/png');
  };
  return () => { gone = true; down = false; };
} });

})();
