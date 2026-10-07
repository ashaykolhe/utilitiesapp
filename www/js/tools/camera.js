'use strict';
/* Camera tools. Everything runs on the device; nothing is uploaded. */
(function () {

/* ---------- shared helpers ---------- */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const show = (e, on) => { if (e) e.style.display = on ? '' : 'none'; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const hex2 = (n) => pad(Math.round(clamp(n, 0, 255)).toString(16), 2).toUpperCase();
const toHex = (r, g, b) => '#' + hex2(r) + hex2(g) + hex2(b);
const kb = (n) => n >= 1048576 ? (n / 1048576).toFixed(2) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
const stamp = () => { const d = new Date(); return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()); };
/* Screen wake lock held while a long capture runs. Re-acquired when the page becomes visible again. */
function wakeLock() {
  let lock = null, want = false;
  const get = async () => {
    if (!want || lock || !navigator.wakeLock || document.visibilityState !== 'visible') return;
    try {
      const l = await navigator.wakeLock.request('screen');
      if (!want) { l.release().catch(() => {}); return; }
      lock = l; l.addEventListener('release', () => { if (lock === l) lock = null; });
    } catch (e) { /* not supported or refused */ }
  };
  const vis = () => { if (want) get(); };
  document.addEventListener('visibilitychange', vis);
  const w = {
    on() { want = true; get(); },
    off() { want = false; if (lock) { const l = lock; lock = null; l.release().catch(() => {}); } },
    dispose() { w.off(); document.removeEventListener('visibilitychange', vis); }
  };
  return w;
}
const tick = () => { if (typeof beep === 'function') { try { beep(); } catch (e) { /* ignore */ } } else if (navigator.vibrate) navigator.vibrate(60); };

function camMsg(e) {
  const n = e && e.name;
  if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') return 'Camera permission was denied. Allow the camera for PocketKit in your phone Settings (Apps, PocketKit, Permissions), then reopen this tool.';
  if (n === 'NotFoundError' || n === 'DevicesNotFoundError' || n === 'OverconstrainedError') return 'No camera was found on this device.';
  if (n === 'NotReadableError' || n === 'AbortError') return 'The camera is busy. Close other apps that use it and try again.';
  return (e && e.message) || 'The camera is not available.';
}

/* Owns one camera stream attached to a <video>. start() resolves true on success and writes a message on failure. */
function makeCam(video, msgEl) {
  let stream = null, tok = 0;
  const say = (t) => { if (msgEl) msgEl.textContent = t || ''; };
  const c = {
    track: null,
    get stream() { return stream; },
    async start(facing, audio) {
      const my = ++tok;
      c.release();
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { say('This device or browser has no camera support.'); return false; }
      let s;
      try {
        try { s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing || 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: !!audio }); }
        catch (e) { if (e && e.name === 'OverconstrainedError') s = await navigator.mediaDevices.getUserMedia({ video: true, audio: !!audio }); else throw e; }
      } catch (e) { if (my === tok) say(camMsg(e)); return false; }
      if (my !== tok) { s.getTracks().forEach(t => t.stop()); return false; }
      stream = s; c.track = s.getVideoTracks()[0];
      video.muted = true; video.setAttribute('playsinline', ''); video.srcObject = s;
      try { await video.play(); } catch (e) { /* autoplay handled by attribute */ }
      if (my !== tok) { if (stream === s) c.release(); return false; }
      say('');
      return true;
    },
    release() { if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; c.track = null; if (video) video.srcObject = null; },
    stop() { tok++; c.release(); },
    caps() { try { return (c.track && c.track.getCapabilities && c.track.getCapabilities()) || {}; } catch (e) { return {}; } },
    async torch(on) { try { await c.track.applyConstraints({ advanced: [{ torch: !!on }] }); return true; } catch (e) { return false; } }
  };
  return c;
}

/* Zoom slider: real camera zoom when the track supports it, else CSS scaling (tracked in css()). */
function zoomCtl(cam, slider, label, onCss) {
  let hw = false, cssZ = 1;
  const z = {
    css: () => cssZ,
    init() {
      const zc = cam.caps().zoom; hw = !!(zc && zc.max > zc.min);
      slider.min = hw ? zc.min : 1; slider.max = hw ? Math.min(zc.max, 20) : 8; slider.step = hw && zc.step ? Math.max(zc.step, 0.05) : 0.1;
      slider.value = slider.min; cssZ = 1; z.set(slider.min);
    },
    set(v) {
      v = +v; label.textContent = v.toFixed(1) + '×';
      if (hw) { cssZ = 1; try { cam.track.applyConstraints({ advanced: [{ zoom: v }] }).catch(() => {}); } catch (e) { /* ignore */ } }
      else cssZ = v;
      if (onCss) onCss(cssZ);
    }
  };
  slider.oninput = () => z.set(slider.value);
  return z;
}

/* Draw the (optionally cropped for CSS zoom) video frame onto a new canvas. */
function grab(video, o) {
  o = o || {};
  const w = video.videoWidth, h = video.videoHeight;
  if (!w || !h) return null;
  const k = o.css || 1, cw = w / k, ch = h / k;
  const maxS = o.max ? Math.min(1, o.max / Math.max(cw, ch)) : 1;
  const cv = document.createElement('canvas'); cv.width = Math.round(cw * maxS); cv.height = Math.round(ch * maxS);
  const g = cv.getContext('2d');
  if (o.filter && 'filter' in g) g.filter = o.filter;
  if (o.mirror) { g.translate(cv.width, 0); g.scale(-1, 1); }
  g.drawImage(video, (w - cw) / 2, (h - ch) / 2, cw, ch, 0, 0, cv.width, cv.height);
  return cv;
}

const toBlob = (cv, type, q) => new Promise(res => cv.toBlob(res, type || 'image/png', q));
const b64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });

/* Save: native share sheet on Android (Filesystem + Share), else a normal download. */
const CHUNK = 3 * 1024 * 1024; // multiple of 3 so each base64 piece joins cleanly
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
    } catch (e) { uri = null; /* fall back to download */ }
    if (uri) {
      try { await P.Share.share({ title: name, url: uri }); } catch (e) { /* user closed the sheet */ }
      // Delete the cache copy later so the receiving app has time to read it.
      setTimeout(() => { try { P.Filesystem.deleteFile({ path: name, directory: 'CACHE' }).catch(() => {}); } catch (e) { /* ignore */ } }, 60000);
      return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
  toast('Saved ' + name);
}
async function saveCanvas(cv, base, type, q) {
  type = type || 'image/jpeg';
  const blob = await toBlob(cv, type, q || 0.92);
  if (!blob) { toast('Could not save the picture'); return; }
  await saveBlob(blob, base + '-' + stamp() + (type === 'image/png' ? '.png' : type === 'image/webp' ? '.webp' : '.jpg'));
}

function copyText(t) {
  const fb = () => { const a = document.createElement('textarea'); a.value = t; a.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); toast('Copied'); } catch (e) { toast('Copy failed'); } a.remove(); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(() => toast('Copied'), fb); else fb();
}

function pickFiles(multi, cb, capture, accept) {
  const i = document.createElement('input'); i.type = 'file'; i.accept = accept || 'image/*'; i.multiple = !!multi; if (capture) i.setAttribute('capture', capture);
  i.onchange = () => {
    let f = [...i.files]; if (!f.length) return;
    if (!accept || /^image\//.test(accept)) { // default: pictures only, up to 60 MB each
      const notImg = f.filter(x => x.type && !/^image\//.test(x.type)), big = f.filter(x => x.size > 60 * 1048576);
      f = f.filter(x => !(x.type && !/^image\//.test(x.type)) && x.size <= 60 * 1048576);
      if (!f.length) { toast(notImg.length ? 'That is not a picture. Choose a JPG, PNG or WebP image.' : 'That picture is too large (limit 60 MB).'); return; }
      if (notImg.length || big.length) toast((notImg.length + big.length) + ' file(s) skipped: not a picture or over 60 MB');
    }
    cb(f);
  };
  i.click();
}

/* Take a picture with the live camera. The "capture" hint on a file input is ignored by the Android WebView (it opens the picker),
   so this opens the camera itself: preview, shutter, switch camera, cancel. cb gets [File]. Falls back to the picker when there is no camera.
   owner: the tool's element; the camera closes by itself if the person leaves the tool. */
async function takePhoto(owner, cb) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast('No camera here, choose a picture instead'); pickFiles(false, cb); return; }
  if (document.getElementById('pkShot')) return;
  let facing = 'environment', stream = null, closed = false, watch = null;
  const ov = document.createElement('div'); ov.id = 'pkShot';
  ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#000;display:flex;flex-direction:column;color:#fff';
  ov.innerHTML = '<video id="pkv" playsinline muted autoplay style="flex:1;min-height:0;width:100%;object-fit:contain;background:#000"></video>' +
    '<div id="pkm" style="text-align:center;padding:6px 12px;min-height:22px;font-size:14px"></div>' +
    '<div style="display:flex;justify-content:space-around;align-items:center;padding:12px 8px calc(18px + env(safe-area-inset-bottom,0px))">' +
    '<button id="pkc" aria-label="Cancel" style="min-width:88px;min-height:48px;border-radius:24px;border:1px solid #fff5;background:#0000;color:#fff;font-size:16px">Cancel</button>' +
    '<button id="pks" aria-label="Take picture" style="width:72px;height:72px;border-radius:50%;border:5px solid #fff;background:#fff3;min-height:72px"></button>' +
    '<button id="pkf" aria-label="Switch camera" style="min-width:88px;min-height:48px;border-radius:24px;border:1px solid #fff5;background:#0000;color:#fff;font-size:16px">Flip</button></div>';
  document.body.appendChild(ov);
  const v = ov.querySelector('#pkv'), msg = (t) => { ov.querySelector('#pkm').textContent = t || ''; };
  const close = () => { if (closed) return; closed = true; clearInterval(watch); if (stream) stream.getTracks().forEach(t => t.stop()); v.srcObject = null; ov.remove(); };
  async function open() {
    if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; msg('Starting camera...');
    try {
      let s;
      try { s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 2560 }, height: { ideal: 1440 } }, audio: false }); }
      catch (e) { if (e && e.name === 'OverconstrainedError') s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); else throw e; }
      if (closed) { s.getTracks().forEach(t => t.stop()); return; }
      stream = s; v.srcObject = s; try { await v.play(); } catch (e) { /* autoplay covers it */ } msg('');
    } catch (e) { if (!closed) msg(camMsg(e)); }
  }
  ov.querySelector('#pkc').onclick = close;
  ov.querySelector('#pkf').onclick = () => { facing = facing === 'environment' ? 'user' : 'environment'; open(); };
  ov.querySelector('#pks').onclick = () => {
    if (!stream || !v.videoWidth) { msg('Camera is not ready yet'); return; }
    const cv = document.createElement('canvas'); cv.width = v.videoWidth; cv.height = v.videoHeight; cv.getContext('2d').drawImage(v, 0, 0);
    cv.toBlob(b => { if (!b) { msg('Could not take the picture'); return; } close(); cb([new File([b], 'photo-' + Date.now() + '.jpg', { type: 'image/jpeg' })]); }, 'image/jpeg', 0.92);
  };
  watch = setInterval(() => { if (owner && !owner.isConnected) close(); }, 400);
  open();
}

/* Natural size of an image file without decoding it into a bitmap (the browser decodes lazily). */
async function imageSize(file) {
  const url = URL.createObjectURL(file);
  try { const img = await new Promise((res, rej) => { const m = new Image(); m.onload = () => res(m); m.onerror = rej; m.src = url; }); return { w: img.naturalWidth, h: img.naturalHeight }; }
  finally { URL.revokeObjectURL(url); }
}
/* max: longest side to decode at. Large photos are decoded already shrunk, so 12 MP pictures do not exhaust memory. bmp.origW/origH keep the real size. */
async function loadBitmap(file, max) {
  if (max) {
    try {
      const d = await imageSize(file);
      if (d.w && d.h && Math.max(d.w, d.h) > max) {
        const [w, hh] = fitSize(d.w, d.h, max);
        const b = await createImageBitmap(file, { resizeWidth: w, resizeHeight: hh, resizeQuality: 'high' });
        b.origW = d.w; b.origH = d.h; return b;
      }
    } catch (e) { /* fall back to a normal decode */ }
  }
  try { return await createImageBitmap(file); } catch (e) { /* fall through to <img> */ }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const m = new Image(); m.onload = () => res(m); m.onerror = rej; m.src = url; });
    return { width: img.naturalWidth, height: img.naturalHeight, _img: img, close() {} };
  } finally { setTimeout(() => URL.revokeObjectURL(url), 5000); }
}
const drawSrc = (g, b, ...a) => g.drawImage(b._img || b, ...a);

function fitSize(w, h, max) { const k = max && Math.max(w, h) > max ? max / Math.max(w, h) : 1; return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))]; }

function pickMime() {
  if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
  return ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find(t => MediaRecorder.isTypeSupported(t)) || '';
}

/* Turn JPEG blobs into one WebM by replaying them on a canvas that is being recorded. */
/* ctl.cancel = true aborts the export (checked every frame). */
async function framesToWebm(blobs, fps, prog, ctl) {
  ctl = ctl || {};
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) throw new Error('Video export is not supported on this device.');
  if (!blobs.length) throw new Error('No frames to export.');
  const first = await createImageBitmap(blobs[0]);
  const cv = document.createElement('canvas'); cv.width = first.width & ~1 || 2; cv.height = first.height & ~1 || 2;
  const g = cv.getContext('2d');
  const stream = cv.captureStream(fps), mime = pickMime();
  let rec;
  try { rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 4000000 } : undefined); }
  catch (e) { first.close(); stream.getTracks().forEach(t => t.stop()); throw e; }
  const chunks = []; rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  const done = new Promise(r => { rec.onstop = r; });
  const paint = (b) => { g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height); const k = Math.min(cv.width / b.width, cv.height / b.height); const w = b.width * k, hh = b.height * k; g.drawImage(b, (cv.width - w) / 2, (cv.height - hh) / 2, w, hh); };
  let cancelled = false;
  try {
    paint(first); rec.start();
    for (let i = 0; i < blobs.length; i++) {
      if (ctl.cancel) { cancelled = true; break; }
      if (i) { const b = await createImageBitmap(blobs[i]); paint(b); b.close(); }
      if (prog) prog(i + 1, blobs.length);
      await sleep(1000 / fps);
    }
    if (!cancelled) await sleep(1000 / fps);
  } finally {
    first.close();
    if (rec.state !== 'inactive') { try { rec.stop(); } catch (e) { /* ignore */ } }
  }
  await Promise.race([done, sleep(5000)]);
  stream.getTracks().forEach(t => t.stop());
  if (cancelled || ctl.cancel) throw new Error('Export cancelled.');
  return new Blob(chunks, { type: (mime || 'video/webm').split(';')[0] });
}
const videoExt = (blob) => /mp4/.test(blob.type) ? '.mp4' : '.webm';

/* ---------- colour names ---------- */
const COLOR_DATA = 'Black:000000,White:ffffff,Red:ff0000,Lime:00ff00,Blue:0000ff,Yellow:ffff00,Cyan:00ffff,Magenta:ff00ff,Silver:c0c0c0,Gray:808080,Maroon:800000,Olive:808000,Green:008000,Purple:800080,Teal:008080,Navy:000080,Orange:ffa500,Dark Orange:ff8c00,Coral:ff7f50,Tomato:ff6347,Salmon:fa8072,Light Salmon:ffa07a,Crimson:dc143c,Firebrick:b22222,Dark Red:8b0000,Brown:a52a2a,Saddle Brown:8b4513,Sienna:a0522d,Chocolate:d2691e,Peru:cd853f,Tan:d2b48c,Wheat:f5deb3,Beige:f5f5dc,Khaki:f0e68c,Gold:ffd700,Goldenrod:daa520,Dark Khaki:bdb76b,Lemon Chiffon:fffacd,Ivory:fffff0,Linen:faf0e6,Lavender:e6e6fa,Pink:ffc0cb,Hot Pink:ff69b4,Deep Pink:ff1493,Orchid:da70d6,Plum:dda0dd,Violet:ee82ee,Medium Purple:9370db,Indigo:4b0082,Blue Violet:8a2be2,Slate Blue:6a5acd,Royal Blue:4169e1,Dodger Blue:1e90ff,Sky Blue:87ceeb,Light Blue:add8e6,Steel Blue:4682b4,Cornflower Blue:6495ed,Midnight Blue:191970,Dark Blue:00008b,Aquamarine:7fffd4,Turquoise:40e0d0,Medium Turquoise:48d1cc,Dark Cyan:008b8b,Cadet Blue:5f9ea0,Light Cyan:e0ffff,Mint Cream:f5fffa,Spring Green:00ff7f,Sea Green:2e8b57,Forest Green:228b22,Dark Green:006400,Lime Green:32cd32,Light Green:90ee90,Olive Drab:6b8e23,Yellow Green:9acd32,Chartreuse:7fff00,Dark Olive Green:556b2f,Dim Gray:696969,Dark Gray:a9a9a9,Light Gray:d3d3d3,Gainsboro:dcdcdc,Slate Gray:708090,Charcoal:36454f,Snow:fffafa,Ghost White:f8f8ff,Rose:ff007f,Raspberry:e30b5c,Burgundy:800020,Wine:722f37,Peach:ffdab9,Apricot:fbceb1,Amber:ffbf00,Mustard:ffdb58,Blush:fff0f5,Misty Rose:ffe4e1,Rust:b7410e,Copper:b87333,Bronze:cd7f32,Terracotta:e2725b,Mauve:e0b0ff,Lilac:c8a2c8,Emerald:50c878,Jade:00a86b,Mint:98ff98,Sage:9caf88,Moss:8a9a5b,Azure:007fff,Cobalt:0047ab,Sand:c2b280,Cream:fffdd0,Eggplant:614051,Denim:1560bd,Lemon:fff44f,Taupe:483c32,Ash Gray:b2beb5';
const COLORS = COLOR_DATA.split(',').map(s => { const [n, x] = s.split(':'); return { n, r: parseInt(x.slice(0, 2), 16), g: parseInt(x.slice(2, 4), 16), b: parseInt(x.slice(4, 6), 16) }; });
function nearestName(r, g, b) {
  let best = null, bd = Infinity;
  for (const c of COLORS) {
    const m = (r + c.r) / 2, dr = r - c.r, dg = g - c.g, db = b - c.b;
    const d = (2 + m / 256) * dr * dr + 4 * dg * dg + (2 + (255 - m) / 256) * db * db;
    if (d < bd) { bd = d; best = c; }
  }
  return best.n;
}

/* Remember chosen settings between visits: restores the listed controls from Store ('mem.<tool id>') and saves them when changed.
   Call it at the end of render, after the handlers are attached, so a restore goes through the same code as a tap. */
function remember(el, id, ids) {
  const key = 'mem.' + id; let saved = Store.get(key, null); if (!saved || typeof saved !== 'object') saved = {};
  ids.forEach(i => {
    const n = $('#' + i, el); if (!n || !(i in saved)) return; const v = saved[i];
    if (n.type === 'checkbox') { if (typeof v === 'boolean' && n.checked !== v) { n.checked = v; n.dispatchEvent(new Event('change', { bubbles: true })); } return; }
    if (typeof v !== 'string') return;
    const old = n.value; n.value = v;
    if (n.value !== v) { n.value = old; return; }          // no longer allowed here (option removed, outside the range)
    n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const save = () => { const o = {}; ids.forEach(i => { const n = $('#' + i, el); if (n) o[i] = n.type === 'checkbox' ? n.checked : n.value; }); Store.set(key, o); };
  el.addEventListener('change', save); el.addEventListener('input', save);
}

/* Reusable camera viewport markup. */
const VIEW = (extra) => '<div class="card" style="padding:0;overflow:hidden;position:relative;line-height:0;min-height:160px"><video id="v" playsinline muted autoplay style="width:100%;display:block;border:0;border-radius:0;transform-origin:center;touch-action:pan-y"></video>' + (extra || '') + '</div><div class="muted center" id="msg" style="margin:6px 0;min-height:18px"></div>';
const SLIDER = (id, label, min, max, step, val) => '<label class="f">' + label + ' <span class="muted" id="' + id + 'L"></span><input type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '"></label>';

/* ---------- 1. Magnifier ---------- */
Tools.register({ id: 'magnifier', name: 'Magnifier', icon: '🔎', cat: 'camera', desc: 'Use the rear camera as a magnifying glass with zoom, freeze, torch, brightness and contrast, and save a snapshot.', keys: ['zoom', 'loupe', 'read small text', 'magnify'], needs: ['camera'], render(el) {
  el.innerHTML = VIEW() +
    '<label class="f">Zoom <span class="muted" id="zl">1.0×</span><input type="range" id="z" min="1" max="8" step="0.1" value="1"></label>' +
    '<label class="f">Brightness<input type="range" id="br" min="0.5" max="2" step="0.05" value="1"></label>' +
    '<label class="f">Contrast<input type="range" id="co" min="0.5" max="2.5" step="0.05" value="1"></label>' +
    '<div class="row"><button class="btn alt" id="fr">Freeze</button><button class="btn alt" id="tc">Torch</button><button class="btn" id="sv">Save</button></div>';
  const v = $('#v', el), cam = makeCam(v, $('#msg', el));
  const apply = () => { v.style.filter = 'brightness(' + $('#br', el).value + ') contrast(' + $('#co', el).value + ')'; v.style.transform = 'scale(' + zc.css() + ')'; };
  const zc = zoomCtl(cam, $('#z', el), $('#zl', el), apply);
  let frozen = false, torch = false;
  show($('#tc', el), false);
  cam.start('environment').then(ok => { if (!ok) return; zc.init(); show($('#tc', el), !!cam.caps().torch); apply(); });
  $('#br', el).oninput = $('#co', el).oninput = apply;
  $('#fr', el).onclick = () => { frozen = !frozen; if (frozen) v.pause(); else v.play(); $('#fr', el).textContent = frozen ? 'Unfreeze' : 'Freeze'; };
  $('#tc', el).onclick = async () => { torch = !torch; if (!(await cam.torch(torch))) { torch = false; toast('Torch is not available'); } $('#tc', el).textContent = torch ? 'Torch off' : 'Torch'; };
  $('#sv', el).onclick = () => { const cv = grab(v, { css: zc.css(), filter: 'brightness(' + $('#br', el).value + ') contrast(' + $('#co', el).value + ')' }); if (cv) saveCanvas(cv, 'magnifier'); else toast('Camera is not ready'); };
  return () => cam.stop();
} });

/* ---------- 2. Colour Detector ---------- */
Tools.register({ id: 'colordetect', name: 'Colour Detector', icon: '🌈', cat: 'camera', desc: 'Point the camera at anything and read the HEX and RGB value and the nearest colour name under the crosshair. Tap to lock a colour.', keys: ['color', 'colour picker', 'hex', 'rgb', 'eyedropper'], needs: ['camera'], render(el) {
  const cross = '<div style="position:absolute;left:50%;top:50%;width:34px;height:34px;margin:-17px 0 0 -17px;border:2px solid #fff;border-radius:50%;box-shadow:0 0 0 1px #000,inset 0 0 0 1px #000;pointer-events:none"></div><div id="lk" style="position:absolute;left:8px;top:8px;line-height:1.2;font-size:12px;padding:3px 8px;border-radius:99px;background:rgba(0,0,0,.6);color:#fff;display:none">Locked</div>';
  el.innerHTML = VIEW(cross) +
    '<div class="card"><div class="row" style="align-items:center"><div id="sw" style="height:56px;border-radius:12px;border:1px solid var(--line);background:#000;flex:0 0 72px"></div><div style="flex:1 1 auto"><div class="mid" id="hx">#000000</div><div class="muted" id="rgb">rgb(0, 0, 0)</div><div id="nm">-</div></div></div></div>' +
    '<div class="row"><button class="btn alt" id="lock">Lock</button><button class="btn" id="cp">Copy HEX</button></div>' +
    '<div class="card"><div class="muted">History (tap to copy)</div><div id="hist" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px"></div><button class="btn alt" id="clr" style="margin-top:8px">Clear history</button></div>';
  const v = $('#v', el), cam = makeCam(v, $('#msg', el)), sc = document.createElement('canvas'); sc.width = sc.height = 8;
  const g = sc.getContext('2d', { willReadFrequently: true });
  let locked = false, cur = { r: 0, g: 0, b: 0 }, timer = null, hist = Store.get('colordetect.history', []);
  function paint() {
    const x = toHex(cur.r, cur.g, cur.b);
    $('#sw', el).style.background = x; $('#hx', el).textContent = x; $('#rgb', el).textContent = 'rgb(' + cur.r + ', ' + cur.g + ', ' + cur.b + ')'; $('#nm', el).textContent = nearestName(cur.r, cur.g, cur.b);
  }
  function drawHist() {
    const box = $('#hist', el); box.innerHTML = hist.length ? '' : '<span class="muted">Nothing yet. Lock a colour to keep it.</span>';
    hist.forEach(x => { const b = h('<button aria-label="Copy ' + esc(x) + '" style="width:44px;height:44px;border-radius:10px;border:1px solid var(--line);background:' + esc(x) + '"></button>'); b.onclick = () => copyText(x); box.appendChild(b); });
  }
  function sample() {
    if (locked || !v.videoWidth) return;
    const s = Math.max(4, Math.min(v.videoWidth, v.videoHeight) * 0.03);
    g.drawImage(v, v.videoWidth / 2 - s / 2, v.videoHeight / 2 - s / 2, s, s, 0, 0, 8, 8);
    const d = g.getImageData(0, 0, 8, 8).data; let r = 0, gg = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
    const n = d.length / 4; cur = { r: Math.round(r / n), g: Math.round(gg / n), b: Math.round(b / n) }; paint();
  }
  function toggle() {
    locked = !locked; $('#lock', el).textContent = locked ? 'Unlock' : 'Lock'; show($('#lk', el), locked);
    if (locked) { const x = toHex(cur.r, cur.g, cur.b); hist = [x].concat(hist.filter(y => y !== x)).slice(0, 12); Store.set('colordetect.history', hist); drawHist(); }
  }
  $('#lock', el).onclick = toggle; v.onclick = toggle;
  $('#cp', el).onclick = () => copyText(toHex(cur.r, cur.g, cur.b));
  $('#clr', el).onclick = () => { hist = []; Store.set('colordetect.history', hist); drawHist(); };
  drawHist(); paint();
  cam.start('environment').then(ok => { if (ok) timer = setInterval(sample, 120); });
  return () => { clearInterval(timer); cam.stop(); };
} });

/* ---------- 3. Night Mode Cam ---------- */
Tools.register({ id: 'nightcam', name: 'Night Cam', icon: '🦉', cat: 'camera', desc: 'Brighten dark scenes live with brightness, contrast and gamma boost, with an optional green night-vision tint, and capture a photo.', keys: ['night vision', 'dark', 'low light'], needs: ['camera'], render(el) {
  el.innerHTML = '<div class="card" style="padding:0;overflow:hidden;line-height:0;min-height:160px"><canvas id="cv" style="display:block;border:0;border-radius:0;touch-action:pan-y"></canvas></div><video id="v" playsinline muted style="display:none"></video><div class="muted center" id="msg" style="margin:6px 0;min-height:18px"></div>' +
    SLIDER('br', 'Brightness', 1, 4, 0.1, 2) + SLIDER('co', 'Contrast', 0.8, 2.5, 0.05, 1.3) + SLIDER('ga', 'Gamma boost', 1, 3, 0.1, 1.6) +
    '<label class="item" style="gap:10px"><input type="checkbox" id="gr" checked> <span class="grow">Green night-vision tint</span></label>' +
    '<div class="row"><button class="btn alt" id="tc">Torch</button><button class="btn" id="sv">Capture photo</button></div>';
  const v = $('#v', el), cv = $('#cv', el), cam = makeCam(v, $('#msg', el));
  let raf = 0, torch = false, stopped = false, busy = false;
  const val = (id) => +$('#' + id, el).value;
  function process(target, w, hh) {
    if (target.width !== w) target.width = w; if (target.height !== hh) target.height = hh;
    const g = target.getContext('2d', { willReadFrequently: true });
    if ('filter' in g) g.filter = 'brightness(' + val('br') + ') contrast(' + val('co') + ')';
    g.drawImage(v, 0, 0, w, hh); g.filter = 'none';
    const gamma = val('ga'), tint = $('#gr', el).checked;
    if (gamma === 1 && !tint) return;
    const img = g.getImageData(0, 0, w, hh), d = img.data, lut = new Uint8ClampedArray(256);
    for (let i = 0; i < 256; i++) lut[i] = 255 * Math.pow(i / 255, 1 / gamma);
    for (let i = 0; i < d.length; i += 4) {
      const r = lut[d[i]], gg = lut[d[i + 1]], b = lut[d[i + 2]];
      if (tint) { const l = 0.3 * r + 0.59 * gg + 0.11 * b; d[i] = l * 0.15; d[i + 1] = Math.min(255, l * 1.1); d[i + 2] = l * 0.25; } else { d[i] = r; d[i + 1] = gg; d[i + 2] = b; }
    }
    g.putImageData(img, 0, 0);
  }
  function loop() {
    if (stopped) return;
    if (v.videoWidth && !busy) { const k = Math.min(1, 480 / v.videoWidth); process(cv, Math.round(v.videoWidth * k), Math.round(v.videoHeight * k)); }
    raf = requestAnimationFrame(loop);
  }
  show($('#tc', el), false);
  cam.start('environment').then(ok => { if (ok) { show($('#tc', el), !!cam.caps().torch); loop(); } });
  $('#tc', el).onclick = async () => { torch = !torch; if (!(await cam.torch(torch))) { torch = false; toast('Torch is not available'); } $('#tc', el).textContent = torch ? 'Torch off' : 'Torch'; };
  $('#sv', el).onclick = () => {
    if (!v.videoWidth) { toast('Camera is not ready'); return; }
    busy = true; const out = document.createElement('canvas'); process(out, v.videoWidth, v.videoHeight); busy = false; saveCanvas(out, 'night');
  };
  ['br', 'co', 'ga'].forEach(id => { const u = () => { $('#' + id + 'L', el).textContent = val(id); }; $('#' + id, el).addEventListener('input', u); u(); });
  remember(el, 'nightcam', ['br', 'co', 'ga', 'gr']);
  return () => { stopped = true; cancelAnimationFrame(raf); cam.stop(); };
} });

/* ---------- 4. Blank Cam ---------- */
Tools.register({ id: 'blankcam', pro: true, proKey: 'camera', name: 'Blank Cam', icon: '⚫', cat: 'camera', desc: 'Record video with the screen showing black so recording is discreet. A large stop button ends the recording (up to 30 minutes) and lets you save or share it. The screen stays awake while recording.', keys: ['spy', 'secret', 'discreet', 'video recorder', 'hidden'], needs: ['camera', 'microphone'], render(el) {
  el.innerHTML = '<div class="card"><b>Record with a black screen</b><div class="muted" style="margin-top:6px">Recording other people without their knowledge or consent may be illegal where you live. Use this only where it is lawful and fair to everyone involved.</div></div>' +
    '<label class="f">Camera<select id="fc"><option value="environment">Rear camera</option><option value="user">Front camera</option></select></label>' +
    '<label class="item" style="gap:10px"><input type="checkbox" id="au" checked> <span class="grow">Record sound</span></label>' +
    '<div class="muted center" id="msg" style="margin:6px 0;min-height:18px"></div><button class="btn" id="go">Start recording</button><div id="res"></div>';
  const MAX_MS = 30 * 60 * 1000;
  const wl = wakeLock();
  let overlay = null, stream = null, rec = null, timer = null, resUrl = null, t0 = 0, stopping = false, starting = false, gone = false;
  const say = (t) => { const m = $('#msg', el); if (m) m.textContent = t; };
  const dropStream = (s) => { if (s) s.getTracks().forEach(t => { try { t.stop(); } catch (e) { /* ignore */ } }); };
  function cleanupRec() {
    clearInterval(timer); timer = null; if (overlay) overlay.remove(); overlay = null;
    dropStream(stream); stream = null; wl.off();
  }
  function stopRec() { if (!stopping && rec && rec.state !== 'inactive') { stopping = true; try { rec.stop(); } catch (e) { stopping = false; cleanupRec(); } } }
  async function openStream(facing, wantAudio) {
    const video = { facingMode: { ideal: facing } };
    try { return { s: await navigator.mediaDevices.getUserMedia({ video, audio: wantAudio }), noAudio: false }; }
    catch (e) {
      if (!wantAudio) throw e;
      // The microphone may be the only thing that failed: retry with video only.
      const s = await navigator.mediaDevices.getUserMedia({ video, audio: false });
      return { s, noAudio: true, name: e && e.name };
    }
  }
  async function start() {
    if (starting || rec && rec.state !== 'inactive') return;
    say('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) { say('Video recording is not supported on this device.'); return; }
    starting = true; const go = $('#go', el); if (go) go.disabled = true;
    let s = null;
    try {
      let r;
      try { r = await openStream($('#fc', el) ? $('#fc', el).value : 'environment', $('#au', el) ? $('#au', el).checked : false); }
      catch (e) { if (!gone) say(camMsg(e)); return; }
      s = r.s;
      if (gone) { dropStream(s); s = null; return; }
      if (r.noAudio) say(r.name === 'NotAllowedError' || r.name === 'SecurityError' ? 'Microphone permission was denied, recording without sound.' : 'No microphone, recording without sound.');
      const mime = pickMime(), chunks = [];
      let mr;
      try { mr = new MediaRecorder(s, mime ? { mimeType: mime } : undefined); } catch (e) { say('Recording is not supported on this device.'); dropStream(s); s = null; return; }
      mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunks, { type: (mime || 'video/webm').split(';')[0] }); cleanupRec(); stopping = false; rec = null;
        if (!blob.size) { if (!gone) say('Nothing was recorded.'); return; }
        // Left the tool while recording: keep what was captured and hand it to the share sheet.
        if (gone) { toast('Recording stopped, saving it'); saveBlob(blob, 'blankcam-' + stamp() + videoExt(blob)); return; }
        finish(blob);
      };
      stream = s; rec = mr; s = null; stopping = false;
      try { mr.start(1000); } catch (e) { say('Could not start recording on this device.'); cleanupRec(); rec = null; return; }
      t0 = Date.now(); wl.on();
      overlay = h('<div style="position:fixed;inset:0;background:#000;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px"><div id="bt" style="color:#333;font-size:14px">00:00</div><button id="bs" aria-label="Stop recording" style="width:70vw;max-width:300px;height:90px;border-radius:24px;border:2px solid #333;background:#111;color:#666;font-size:20px">Stop</button><div style="color:#2a2a2a;font-size:12px;padding:0 24px;text-align:center">Recording. Tap Stop to finish.</div></div>');
      document.body.appendChild(overlay);
      $('#bs', overlay).onclick = stopRec;
      timer = setInterval(() => {
        const ms = Date.now() - t0, sec = Math.floor(ms / 1000); const b = overlay && $('#bt', overlay); if (b) b.textContent = pad(Math.floor(sec / 60)) + ':' + pad(sec % 60);
        if (ms >= MAX_MS) { toast('30 minute limit reached, saving'); stopRec(); }
      }, 500);
    } finally { starting = false; if (s) dropStream(s); const g2 = $('#go', el); if (g2 && !gone) g2.disabled = false; }
  }
  function finish(blob) {
    if (resUrl) URL.revokeObjectURL(resUrl);
    resUrl = URL.createObjectURL(blob);
    const res = $('#res', el); if (!res) return;
    res.innerHTML = '<div class="card"><b>Recording ready</b><div class="muted">' + kb(blob.size) + '</div><video controls playsinline src="' + resUrl + '" style="margin-top:8px"></video></div><button class="btn" id="sv">Save / share video</button>';
    $('#sv', res).onclick = () => saveBlob(blob, 'blankcam-' + stamp() + videoExt(blob));
  }
  $('#go', el).onclick = start;
  return () => {
    gone = true;
    // If a recording is running, stop it normally so onstop saves the captured data; otherwise just release everything.
    if (rec && rec.state !== 'inactive') { clearInterval(timer); if (overlay) overlay.remove(); overlay = null; stopRec(); }
    else cleanupRec();
    wl.dispose(); if (resUrl) URL.revokeObjectURL(resUrl);
  };
} });

/* ---------- 5. Motion Cam (Pro) ---------- */
Tools.register({ id: 'motioncam', pro: true, proKey: 'motion', name: 'Motion Cam', icon: '🕵️', cat: 'camera', pro: true, proKey: 'motion', desc: 'Watches the camera for movement. When something moves it beeps, vibrates and keeps a snapshot with the time in a list for this session only (save the ones you want before leaving). The screen stays awake while watching.', keys: ['motion detector', 'security camera', 'intruder', 'surveillance'], needs: ['camera'], render(el) {
  if (typeof isPro === 'function' && !isPro()) { el.innerHTML = '<div class="card center"><b>Pro feature</b><div class="muted">This tool is part of PocketKit Pro.</div></div>'; return; }
  el.innerHTML = VIEW('<div id="mot" style="position:absolute;left:8px;top:8px;line-height:1.2;font-size:12px;padding:3px 8px;border-radius:99px;background:rgba(0,0,0,.6);color:#fff">Idle</div>') +
    SLIDER('se', 'Sensitivity (1 low, 10 high)', 1, 10, 1, 5) +
    '<div class="progress" aria-label="Movement level"><i id="lvl" style="width:0"></i></div>' +
    '<label class="item" style="gap:10px;margin-top:8px"><input type="checkbox" id="snd" checked> <span class="grow">Beep and vibrate on motion</span></label>' +
    '<div class="row"><button class="btn" id="go">Start watching</button><button class="btn alt" id="cl">Clear log</button></div><div class="list" id="log" style="margin-top:8px"></div>';
  const v = $('#v', el), cam = makeCam(v, $('#msg', el)), W = 64, H = 48;
  const sc = document.createElement('canvas'); sc.width = W; sc.height = H; const g = sc.getContext('2d', { willReadFrequently: true });
  let running = false, timer = null, prev = null, hits = 0, last = 0, armedAt = 0, log = [], gone = false, starting = false;
  const wl = wakeLock();
  const sens = () => +$('#se', el).value;
  function drawLog() {
    const box = $('#log', el); box.innerHTML = log.length ? '' : '<div class="muted center">No motion logged yet.</div>';
    log.forEach(e => {
      const row = h('<div class="item"><img src="' + e.url + '" alt="Snapshot" style="width:72px;height:54px;object-fit:cover;border-radius:8px;border:0"><div class="grow"><div>' + esc(e.time) + '</div><div class="muted">' + e.pct + '% of the frame moved</div></div><button class="btn alt" aria-label="Save snapshot" style="min-height:44px">Save</button></div>');
      $('button', row).onclick = () => saveBlob(e.blob, 'motion-' + e.file + '.jpg'); box.appendChild(row);
    });
  }
  async function trigger(pct) {
    const cv = grab(v, { max: 640 }); if (!cv) return;
    const blob = await toBlob(cv, 'image/jpeg', 0.8); if (!blob || gone) return;
    const d = new Date();
    log.unshift({ url: URL.createObjectURL(blob), blob, time: d.toLocaleTimeString() + ' ' + d.toLocaleDateString(), pct, file: stamp() });
    while (log.length > 30) URL.revokeObjectURL(log.pop().url);
    drawLog(); if ($('#snd', el).checked) { tick(); if (navigator.vibrate) navigator.vibrate([200, 100, 200]); }
  }
  function check() {
    if (!v.videoWidth) return;
    g.drawImage(v, 0, 0, W, H); const d = g.getImageData(0, 0, W, H).data, cur = new Uint8Array(W * H);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) cur[j] = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
    if (prev) {
      let n = 0; for (let j = 0; j < cur.length; j++) if (Math.abs(cur[j] - prev[j]) > 28) n++;
      const ratio = n / cur.length, thr = 0.12 - sens() * 0.011;
      $('#lvl', el).style.width = Math.min(100, ratio / thr * 50) + '%';
      const now = Date.now();
      if (now > armedAt && ratio > thr) hits++; else hits = 0;
      if (hits >= 2 && now - last > 3000) { last = now; hits = 0; trigger(Math.round(ratio * 100)); }
    }
    prev = cur;
  }
  function stopWatch() { running = false; clearInterval(timer); timer = null; wl.off(); $('#go', el).textContent = 'Start watching'; $('#mot', el).textContent = 'Idle'; $('#lvl', el).style.width = '0'; }
  $('#go', el).onclick = async () => {
    if (running) { stopWatch(); return; }
    if (starting) return;
    starting = true;
    try { if (!cam.stream && !(await cam.start('environment'))) return; } finally { starting = false; }
    if (gone || running) return;
    wl.on(); running = true; prev = null; hits = 0; armedAt = Date.now() + 2000;
    $('#go', el).textContent = 'Stop watching'; $('#mot', el).textContent = 'Watching';
    timer = setInterval(check, 200);
  };
  $('#cl', el).onclick = () => { log.forEach(e => URL.revokeObjectURL(e.url)); log = []; drawLog(); };
  $('#se', el).addEventListener('input', () => { $('#seL', el).textContent = sens(); }); $('#seL', el).textContent = sens();
  drawLog();
  cam.start('environment');
  return () => { gone = true; running = false; clearInterval(timer); wl.dispose(); cam.stop(); log.forEach(e => URL.revokeObjectURL(e.url)); };
} });

/* ---------- 6. Stop Motion (Pro) ---------- */
Tools.register({ id: 'stopmotion', pro: true, proKey: 'motion', name: 'Stop Motion', icon: '🎬', cat: 'camera', pro: true, proKey: 'motion', desc: 'Make stop-motion films: capture frames with an onion-skin view of the previous frame, reorder or delete frames, preview at your chosen speed and export a WebM video.', keys: ['animation', 'frames', 'claymation', 'onion skin'], needs: ['camera'], render(el) {
  if (typeof isPro === 'function' && !isPro()) { el.innerHTML = '<div class="card center"><b>Pro feature</b><div class="muted">This tool is part of PocketKit Pro.</div></div>'; return; }
  el.innerHTML = VIEW('<img id="onion" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:fill;opacity:.4;pointer-events:none;display:none;border:0"><img id="pv" alt="Preview" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000;display:none;border:0">') +
    '<div class="row"><button class="btn" id="cap">Capture frame</button><button class="btn alt" id="play">Play</button></div>' +
    '<label class="f">Playback speed <span class="muted" id="fpL"></span><input type="range" id="fp" min="1" max="24" step="1" value="8"></label>' +
    '<label class="f">Onion skin strength<input type="range" id="on" min="0" max="0.8" step="0.05" value="0.4"></label>' +
    '<div class="row"><button class="btn alt" id="ex">Export WebM video</button><button class="btn danger" id="clr">Delete all</button></div><div class="muted center" id="st" style="margin:6px 0"></div><div class="list" id="fl"></div>';
  const v = $('#v', el), cam = makeCam(v, $('#msg', el));
  let frames = [], playing = null, gone = false, exporting = false;
  const ctl = { cancel: false }, MAXF = 300;
  const fps = () => +$('#fp', el).value;
  function onion() {
    const o = $('#onion', el), f = frames[frames.length - 1];
    if (f && !playing) { o.src = f.url; o.style.display = ''; o.style.opacity = $('#on', el).value; } else o.style.display = 'none';
  }
  function list() {
    const box = $('#fl', el); box.innerHTML = frames.length ? '' : '<div class="muted center">No frames yet. Move your subject a little, then capture again.</div>';
    frames.forEach((f, i) => {
      const row = h('<div class="item"><img src="' + f.thumb + '" alt="Frame ' + (i + 1) + '" style="width:64px;height:48px;object-fit:cover;border-radius:8px;border:0"><div class="grow">Frame ' + (i + 1) + '</div><button class="btn alt" data-a="up" aria-label="Move earlier" style="min-width:44px;min-height:44px">◀</button><button class="btn alt" data-a="dn" aria-label="Move later" style="min-width:44px;min-height:44px">▶</button><button class="btn danger" data-a="rm" aria-label="Delete frame" style="min-width:44px;min-height:44px">✕</button></div>');
      $$('button', row).forEach(b => b.onclick = () => {
        const a = b.dataset.a;
        if (a === 'rm') { URL.revokeObjectURL(f.url); frames.splice(i, 1); }
        else if (a === 'up' && i > 0) { frames.splice(i - 1, 0, frames.splice(i, 1)[0]); }
        else if (a === 'dn' && i < frames.length - 1) { frames.splice(i + 1, 0, frames.splice(i, 1)[0]); }
        list(); onion();
      });
      box.appendChild(row);
    });
    $('#st', el).textContent = frames.length + ' frames, about ' + (frames.length / fps()).toFixed(1) + ' s at ' + fps() + ' fps';
  }
  $('#cap', el).onclick = async () => {
    if (playing) return;
    if (frames.length >= MAXF) { toast('Frame limit reached (' + MAXF + ')'); return; }
    const cv = grab(v, { max: 720 }); if (!cv) { toast('Camera is not ready'); return; }
    const blob = await toBlob(cv, 'image/jpeg', 0.85); if (!blob || gone) return;
    const tc = document.createElement('canvas'), k = 96 / Math.max(cv.width, cv.height); tc.width = Math.max(1, Math.round(cv.width * k)); tc.height = Math.max(1, Math.round(cv.height * k));
    tc.getContext('2d').drawImage(cv, 0, 0, tc.width, tc.height);
    frames.push({ blob, url: URL.createObjectURL(blob), thumb: tc.toDataURL('image/jpeg', 0.6) }); list(); onion();
  };
  function stopPlay() { clearInterval(playing); playing = null; $('#pv', el).style.display = 'none'; $('#play', el).textContent = 'Play'; onion(); }
  $('#play', el).onclick = () => {
    if (playing) { stopPlay(); return; }
    if (frames.length < 2) { toast('Capture at least 2 frames'); return; }
    let i = 0; const pv = $('#pv', el); pv.style.display = ''; $('#onion', el).style.display = 'none'; $('#play', el).textContent = 'Stop';
    pv.src = frames[0].url;
    playing = setInterval(() => { i = (i + 1) % frames.length; pv.src = frames[i].url; }, 1000 / fps());
  };
  $('#fp', el).oninput = () => { $('#fpL', el).textContent = fps() + ' fps'; if (playing) { stopPlay(); } list(); };
  $('#on', el).oninput = onion;
  $('#clr', el).onclick = () => { if (!frames.length) return; if (!confirm('Delete all frames?')) return; stopPlay(); frames.forEach(f => URL.revokeObjectURL(f.url)); frames = []; list(); onion(); };
  $('#ex', el).onclick = async () => {
    if (exporting) return;
    if (frames.length < 2) { toast('Capture at least 2 frames'); return; }
    exporting = true; stopPlay();
    try {
      const blob = await framesToWebm(frames.map(f => f.blob), fps(), (i, n) => { const s = $('#st', el); if (s) s.textContent = 'Exporting ' + i + ' / ' + n + ' ...'; }, ctl);
      if (!gone) { await saveBlob(blob, 'stopmotion-' + stamp() + videoExt(blob)); list(); }
    } catch (e) { if (!gone) { toast(e.message || 'Export failed'); list(); } }
    exporting = false;
  };
  $('#fpL', el).textContent = fps() + ' fps'; list();
  cam.start('environment');
  return () => { gone = true; ctl.cancel = true; clearInterval(playing); cam.stop(); frames.forEach(f => URL.revokeObjectURL(f.url)); };
} });

/* ---------- 7. Mirror ---------- */
Tools.register({ id: 'mirror', name: 'Mirror', icon: '🪞', cat: 'camera', desc: 'Use the front camera as a mirror with zoom and freeze.', keys: ['selfie', 'front camera', 'face'], needs: ['camera'], render(el) {
  el.innerHTML = VIEW() +
    '<label class="f">Zoom <span class="muted" id="zl">1.0×</span><input type="range" id="z" min="1" max="4" step="0.1" value="1"></label>' +
    '<label class="f">Brightness<input type="range" id="br" min="0.7" max="1.8" step="0.05" value="1"></label>' +
    '<div class="row"><button class="btn alt" id="fr">Freeze</button><button class="btn alt" id="sw">Use rear camera</button></div>';
  const v = $('#v', el), cam = makeCam(v, $('#msg', el));
  let facing = 'user', frozen = false;
  const apply = () => { v.style.transform = (facing === 'user' ? 'scaleX(-1) ' : '') + 'scale(' + zc.css() + ')'; v.style.filter = 'brightness(' + $('#br', el).value + ')'; };
  const zc = zoomCtl(cam, $('#z', el), $('#zl', el), apply);
  async function go() { if (await cam.start(facing)) { zc.init(); apply(); frozen = false; $('#fr', el).textContent = 'Freeze'; } }
  $('#br', el).oninput = apply;
  $('#fr', el).onclick = () => { frozen = !frozen; if (frozen) v.pause(); else v.play(); $('#fr', el).textContent = frozen ? 'Unfreeze' : 'Freeze'; };
  $('#sw', el).onclick = () => { facing = facing === 'user' ? 'environment' : 'user'; $('#sw', el).textContent = facing === 'user' ? 'Use rear camera' : 'Use front camera'; go(); };
  go();
  return () => cam.stop();
} });

/* BARDEC-START: self-contained 1D barcode decoder (EAN-13, EAN-8, UPC-A, UPC-E, Code 128). Pure functions, no DOM; tested in Node.
   Works on run-lengths of bars/spaces, so it does not care about bar colour (inverted codes work) and a reversed run list gives the upside-down read. */
const BarDec = (() => {
  const P = (s) => Array.from(s, Number);
  const C128 = '212222,222122,222221,121223,121322,131222,122213,122312,132212,221213,221312,231212,112232,122132,122231,113222,123122,123221,223211,221132,221231,213212,223112,312131,311222,321122,321221,312212,322112,322211,212123,212321,232121,111323,131123,131321,112313,132113,132311,211313,231113,231311,112133,112331,132131,113123,113321,133121,313121,211331,231131,213113,213311,213131,311123,311321,331121,312113,312311,332111,314111,221411,431111,111224,111422,121124,121421,141122,141221,112214,112412,122114,122411,142112,142211,241211,221114,413111,241112,134111,111242,121142,121241,114212,124112,124211,411212,421112,421211,212141,214121,412121,111143,111341,131141,114113,114311,411113,411311,113141,114131,311141,411131,211412,211214,211232,2331112'.split(',').map(P);
  const L = '3211,2221,2122,1411,1132,1231,1114,1312,1213,3112'.split(',').map(P);
  const LG = L.concat(L.map(p => p.slice().reverse()));       // 0-9 = L codes, 10-19 = G codes
  const PAR = 'LLLLLL,LLGLGG,LLGGLG,LLGGGL,LGLLGG,LGGLLG,LGGGLL,LGLGLG,LGLGGL,LGGLGL'.split(',');
  const UPE = 'GGGLLL,GGLGLL,GGLLGL,GGLLLG,GLGGLL,GLLGGL,GLLLGG,GLGLGL,GLGLLG,GLLGLG'.split(',');
  const STOP = C128[106], G1 = [1, 1, 1], G5 = [1, 1, 1, 1, 1], G6 = [1, 1, 1, 1, 1, 1];
  const BIG = 1e9;

  /* Average deviation of runs r[i..] from a pattern scaled to fit them (after ZXing); 9 means no match. */
  function vr(r, i, pat) {
    let tot = 0, pl = 0; const n = pat.length;
    for (let k = 0; k < n; k++) { tot += r[i + k]; pl += pat[k]; }
    if (!(tot >= pl * 0.7) || tot > 1e5) return 9;
    const u = tot / pl, mi = 0.7 * u; let tv = 0;
    for (let k = 0; k < n; k++) { const d = Math.abs(r[i + k] - pat[k] * u); if (d > mi) return 9; tv += d; }
    return tv / tot;
  }
  const sumOk = (r, i, n, pl, u) => { let t = 0; for (let k = 0; k < n; k++) t += r[i + k]; return t > 0.65 * pl * u && t < 1.35 * pl * u; };
  function best(r, i, tabs, pl, u, lim) {
    if (!sumOk(r, i, tabs[0].length, pl, u)) return -1;
    let bi = -1, bv = lim;
    for (let k = 0; k < tabs.length; k++) { const v = vr(r, i, tabs[k]); if (v < bv) { bv = v; bi = k; } }
    return bi;
  }
  const guard = (r, s) => {
    if (s < 1 || s + 4 > r.length) return 0;
    const u = (r[s] + r[s + 1] + r[s + 2]) / 3;
    if (!(u >= 0.7 && u < 1e4) || vr(r, s, G1) > 0.3) return 0;
    if (s > 2 && r[s - 1] < 4 * u) return 0;       // quiet zone (a leading partial run at index 1 counts as quiet)
    return u;
  };
  const quietR = (r, e, u) => e >= r.length - 2 || r[e] >= 4 * u;
  function digits(r, i, n, tabs, u, lim) {
    const out = [];
    for (let k = 0; k < n; k++) { const d = best(r, i + 4 * k, tabs, 7, u, lim || 0.48); if (d < 0) return null; out.push(d); }
    return out;
  }
  const ean13Check = (d) => { let s = 0; for (let i = 0; i < 12; i++) s += d[i] * (i % 2 ? 3 : 1); return (10 - s % 10) % 10; };

  function ean13At(r, s, u) {
    const c = s + 27, end = c + 29;
    if (end + 3 > r.length - 1) return null;
    const left = digits(r, s + 3, 6, LG, u); if (!left) return null;
    const f = PAR.indexOf(left.map(k => k < 10 ? 'L' : 'G').join('')); if (f < 0) return null;
    if (vr(r, c, G5) > 0.35 || !sumOk(r, c, 5, 5, u)) return null;
    const right = digits(r, c + 5, 6, L, u); if (!right) return null;
    if (vr(r, end, G1) > 0.3 || !sumOk(r, end, 3, 3, u) || !quietR(r, end + 3, u)) return null;
    const d = [f].concat(left.map(k => k % 10), right);
    if (ean13Check(d) !== d[12]) return null;
    return f === 0 ? { type: 'UPC-A', text: d.slice(1).join('') } : { type: 'EAN-13', text: d.join('') };
  }
  function ean8At(r, s, u) {
    const c = s + 19, end = c + 21;
    if (end + 3 > r.length - 1) return null;
    const left = digits(r, s + 3, 4, L, u); if (!left) return null;
    if (vr(r, c, G5) > 0.35 || !sumOk(r, c, 5, 5, u)) return null;
    const right = digits(r, c + 5, 4, L, u); if (!right) return null;
    if (vr(r, end, G1) > 0.3 || !sumOk(r, end, 3, 3, u) || !quietR(r, end + 3, u)) return null;
    const d = left.concat(right); let sum = 0;
    for (let i = 0; i < 7; i++) sum += d[i] * (i % 2 ? 1 : 3);
    if ((10 - sum % 10) % 10 !== d[7]) return null;
    return { type: 'EAN-8', text: d.join('') };
  }
  function upceAt(r, s, u) {
    const end = s + 27;
    if (end + 6 > r.length - 1) return null;
    // Short code, so be stricter than for EAN: wider quiet zones, tighter fit, whole-pixel module size.
    if (u < 1 || (s > 2 && r[s - 1] < 7 * u) || !(end + 6 >= r.length - 2 || r[end + 6] >= 7 * u)) return null;
    const left = digits(r, s + 3, 6, LG, u, 0.4); if (!left) return null;
    if (vr(r, end, G6) > 0.3 || !sumOk(r, end, 6, 6, u)) return null;
    const par = left.map(k => k < 10 ? 'L' : 'G').join('');
    let sys = 0, chk = UPE.indexOf(par);
    if (chk < 0) { sys = 1; chk = UPE.indexOf(par.replace(/[LG]/g, (m) => m === 'L' ? 'G' : 'L')); }
    if (chk < 0) return null;
    const x = left.map(k => k % 10), last = x[5];
    let body;     // the 10 digits between number system and check digit, as in UPC-A
    if (last < 3) body = [x[0], x[1], last, 0, 0, 0, 0, x[2], x[3], x[4]];
    else if (last === 3) body = [x[0], x[1], x[2], 0, 0, 0, 0, 0, x[3], x[4]];
    else if (last === 4) body = [x[0], x[1], x[2], x[3], 0, 0, 0, 0, 0, x[4]];
    else body = [x[0], x[1], x[2], x[3], x[4], 0, 0, 0, 0, last];
    if (ean13Check([0, sys].concat(body)) !== chk) return null;
    // Cannot be a plain digit-run noise match: both the parity pattern and the check digit agreed.
    return { type: 'UPC-E', text: sys + x.join('') + chk };
  }

  function code128At(r, s) {
    if (s < 1 || s + 20 > r.length) return null;
    let st = -1, bv = 0.35;
    for (let k = 103; k < 106; k++) { const v = vr(r, s, C128[k]); if (v < bv) { bv = v; st = k; } }
    if (st < 0) return null;
    const u = (r[s] + r[s + 1] + r[s + 2] + r[s + 3] + r[s + 4] + r[s + 5]) / 11;
    if (!(u >= 0.7) || (s > 2 && r[s - 1] < 4 * u)) return null;
    const vals = [st]; let pos = s + 6;
    for (;;) {
      if (pos + 7 > r.length - 1 || vals.length > 90) return null;
      if (sumOk(r, pos, 7, 13, u) && vr(r, pos, STOP) < 0.3) { pos += 7; break; }
      const k = best(r, pos, C128.slice(0, 106), 11, u, 0.35);
      if (k < 0) return null;
      vals.push(k); pos += 6;
    }
    if (vals.length < 4 || !quietR(r, pos, u)) return null;
    const chk = vals[vals.length - 1]; let sum = vals[0];
    for (let i = 1; i < vals.length - 1; i++) sum += vals[i] * i;
    if (sum % 103 !== chk) return null;
    let set = st === 103 ? 'A' : st === 104 ? 'B' : 'C', text = '', shift = false;
    for (let i = 1; i < vals.length - 1; i++) {
      const v = vals[i]; let cs = shift ? (set === 'A' ? 'B' : 'A') : set; shift = false;
      if (cs === 'C') {
        if (v < 100) text += (v < 10 ? '0' : '') + v; else if (v === 100) set = 'B'; else if (v === 101) set = 'A';
      } else if (v < 96) {
        const code = cs === 'A' ? (v < 64 ? v + 32 : v - 64) : v + 32;
        if (code < 32 || code > 126) return null;      // control characters: treat as a misread
        text += String.fromCharCode(code);
      } else if (v === 98) shift = true;
      else if (v === 99) set = 'C';
      else if (v === 100 && cs === 'A') set = 'B';
      else if (v === 101 && cs === 'B') set = 'A';
    }
    return text.length >= 2 ? { type: 'Code 128', text } : null;
  }

  /* Decode one run list (a leading and trailing BIG run are added by lineRuns). Tries both reading directions. */
  function decodeRuns(r0) {
    for (let dir = 0; dir < 2; dir++) {
      const r = dir ? r0.slice().reverse() : r0;
      for (let s = 1; s < r.length - 4; s++) {
        const u = guard(r, s);
        if (u) { const x = ean13At(r, s, u) || ean8At(r, s, u) || upceAt(r, s, u); if (x) return x; }
        const c = code128At(r, s); if (c) return c;
      }
    }
    return null;
  }

  /* Turn samples into run-lengths with a local (windowed min/max) threshold, hysteresis, and sub-sample edge positions. */
  function lineRuns(a, gc) {
    const n = a.length;
    if (n < 40) return null;
    const B = 8, nb = Math.ceil(n / B), bmn = new Float32Array(nb).fill(1e9), bmx = new Float32Array(nb).fill(-1e9);
    for (let i = 0; i < n; i++) { const b = i >> 3; if (a[i] < bmn[b]) bmn[b] = a[i]; if (a[i] > bmx[b]) bmx[b] = a[i]; }
    const hb = Math.max(2, Math.min(8, Math.round(n / 6 / B / 2)));
    const thr = new Float32Array(n), con = new Float32Array(n);
    for (let b = 0; b < nb; b++) {
      let mn = 1e9, mx = -1e9;
      for (let k = Math.max(0, b - hb); k <= Math.min(nb - 1, b + hb); k++) { if (bmn[k] < mn) mn = bmn[k]; if (bmx[k] > mx) mx = bmx[k]; }
      for (let i = b * B; i < Math.min(n, b * B + B); i++) { thr[i] = (mn + mx) / 2; con[i] = mx - mn; }
    }
    const minCon = Math.max(25, 0.3 * gc), pos = [];
    let state = -1, last = 0;
    for (let i = 0; i < n; i++) {
      if (con[i] < minCon) continue;
      const hy = Math.max(3, 0.12 * con[i]), d = a[i] - thr[i];
      if (state < 0) { state = d < 0 ? 1 : 0; continue; }       // 1 = dark
      if ((state === 0 && d < -hy) || (state === 1 && d > hy)) {
        let j = i;
        while (j - 1 > last && (state === 0 ? a[j - 1] < thr[j - 1] : a[j - 1] > thr[j - 1])) j--;
        const d0 = a[j - 1] - thr[j - 1], d1 = a[j] - thr[j];
        let x = j - 1 + (d0 === d1 ? 0 : d0 / (d0 - d1));
        if (!(x > last)) x = last + 0.01;
        pos.push(x); last = j; state = 1 - state;
      }
    }
    if (pos.length < 8) return null;
    const r = [BIG, pos[0]];
    for (let i = 1; i < pos.length; i++) r.push(pos[i] - pos[i - 1]);
    r.push(n - 1 - pos[pos.length - 1], BIG);
    return r;
  }

  function sampleLine(g, w, h, cx, cy, ang) {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    let t0 = -1e9, t1 = 1e9;
    if (Math.abs(dx) > 1e-6) { const a = (1 - cx) / dx, b = (w - 2.001 - cx) / dx; t0 = Math.max(t0, Math.min(a, b)); t1 = Math.min(t1, Math.max(a, b)); }
    if (Math.abs(dy) > 1e-6) { const a = (1 - cy) / dy, b = (h - 2.001 - cy) / dy; t0 = Math.max(t0, Math.min(a, b)); t1 = Math.min(t1, Math.max(a, b)); }
    const n = Math.floor(t1 - t0);
    if (!(n >= 40)) return null;
    const out = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      let acc = 0;      // average three parallel lines (1 px apart) to cut sensor noise
      for (let o = -1; o <= 1; o++) {
        const x = cx + (t0 + k) * dx - o * dy, y = cy + (t0 + k) * dy + o * dx, xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi, p = yi * w + xi;
        acc += (g[p] * (1 - fx) + g[p + 1] * fx) * (1 - fy) + (g[p + w] * (1 - fx) + g[p + w + 1] * fx) * fy;
      }
      out[k] = acc / 3;
    }
    return out;
  }
  function smooth(a, k) {
    const n = a.length, o = new Float32Array(n);
    if (k === 1) { for (let i = 0; i < n; i++) o[i] = (a[Math.max(0, i - 1)] + 2 * a[i] + a[Math.min(n - 1, i + 1)]) / 4; }
    else for (let i = 0; i < n; i++) o[i] = (a[Math.max(0, i - 2)] + 2 * a[Math.max(0, i - 1)] + 3 * a[i] + 2 * a[Math.min(n - 1, i + 1)] + a[Math.min(n - 1, i + 2)]) / 9;
    return o;
  }
  function decodeLine(a) {
    let mn = 255, mx = 0;
    for (let i = 0; i < a.length; i++) { if (a[i] < mn) mn = a[i]; if (a[i] > mx) mx = a[i]; }
    if (mx - mn < 25) return null;
    for (let v = 0; v < 3; v++) {
      const b = v === 0 ? a : smooth(a, v - 1), r = lineRuns(b, v === 0 ? mx - mn : (mx - mn) * 0.8);
      const x = r && decodeRuns(r); if (x) return x;
    }
    return null;
  }

  /* gray: Uint8 / Uint8ClampedArray / Float array of w*h. opt.dense: more scanlines (for pictures). Returns { type, text } or null. */
  function scanGray(g, w, h, opt) {
    if (w < 40 || h < 10) return null;
    const dense = opt && opt.dense, lines = [];
    const rows = dense ? [] : [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8, 0.1, 0.9];
    if (dense) for (let i = 0; i < 25; i++) rows.push(0.5 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.04);
    rows.forEach(f => lines.push([w / 2, f * h, 0]));
    const offs = dense ? [0.5, 0.35, 0.65, 0.2, 0.8] : [0.5, 0.3, 0.7], D = Math.PI / 180;
    [5, -5, 10, -10, 17, -17].forEach(a => offs.forEach(f => lines.push([w / 2, f * h, a * D])));
    [90, 85, 95, 80, 100, 73, 107].forEach(a => offs.forEach(f => lines.push([f * w, h / 2, a * D])));
    // Weak formats (UPC-E, very short Code 128) are only trusted when several scanlines agree and nothing else disagrees.
    const tally = {};
    for (const [cx, cy, ang] of lines) {
      const a = sampleLine(g, w, h, cx, cy, ang), x = a && decodeLine(a);
      if (!x) continue;
      if (x.type !== 'UPC-E' && !(x.type === 'Code 128' && x.text.length < 4)) return x;
      const k = x.type + '|' + x.text; (tally[k] || (tally[k] = { x, n: 0 })).n++;
    }
    const t = Object.keys(tally).map(k => tally[k]).sort((p, q) => q.n - p.n);
    return t.length && t[0].n >= 2 && (t.length < 2 || t[0].n >= 2 * t[1].n) ? t[0].x : null;
  }
  function toGray(rgba, w, h) {
    const g = new Uint8Array(w * h);
    for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = (rgba[j] * 77 + rgba[j + 1] * 150 + rgba[j + 2] * 29) >> 8;
    return g;
  }
  return { scanGray, toGray, decodeRuns, lineRuns, ean13Check };
})();
/* BARDEC-END */

/* ---------- 8. Code Scanner ---------- */
Tools.register({ id: 'codescan', name: 'Code Scanner', icon: '📷', cat: 'camera', desc: 'Scan QR codes and EAN/UPC product barcodes (also Code 128) with the camera or from a picture. Copy the result, or open it if it is a web link.', keys: ['qr', 'barcode', 'scan', 'reader', 'ean', 'upc', 'product', 'isbn'], needs: ['camera'], render(el) {
  el.innerHTML = VIEW('<div style="position:absolute;left:15%;right:15%;top:20%;bottom:20%;border:2px solid rgba(255,255,255,.8);border-radius:16px;box-shadow:0 0 0 9999px rgba(0,0,0,.25);pointer-events:none"></div>') +
    '<div class="muted center" id="qrnote" style="margin-bottom:6px"></div>' +
    '<button class="btn alt" id="tc" style="display:none;width:100%;margin-bottom:8px">Torch</button>' +
    '<div class="card" id="res" style="display:none"><div class="muted" id="fmt"></div><div id="txt" style="word-break:break-all;margin:6px 0"></div><div class="row"><button class="btn" id="cp">Copy</button><a class="btn alt" id="op" target="_blank" rel="noopener noreferrer" style="text-align:center;text-decoration:none;display:none">Open link</a></div><button class="btn alt" id="again" style="margin-top:8px">Scan again</button></div>' +
    '<button class="btn alt" id="img">Scan from a picture</button>' +
    '<div class="card"><div class="muted">History</div><div class="list" id="hist"></div><button class="btn alt" id="clr" style="margin-top:8px">Clear history</button></div>';
  const v = $('#v', el), cam = makeCam(v, $('#msg', el)), sc = document.createElement('canvas'), g = sc.getContext('2d', { willReadFrequently: true });
  let bd = null, timer = null, paused = false, busy = false, lastKey = '', lastAt = 0, hist = Store.get('codescan.history', []), gone = false;
  if ('BarcodeDetector' in window) { try { bd = new BarcodeDetector(); } catch (e) { bd = null; } }
  const FMT = { qr_code: 'QR code', ean_13: 'EAN-13', ean_8: 'EAN-8', upc_a: 'UPC-A', upc_e: 'UPC-E', code_128: 'Code 128', code_39: 'Code 39', code_93: 'Code 93', codabar: 'Codabar', itf: 'ITF', data_matrix: 'Data Matrix', aztec: 'Aztec', pdf417: 'PDF417' };
  let torch = false;
  $('#tc', el).onclick = async () => { torch = !torch; if (!(await cam.torch(torch))) { torch = false; toast('Torch is not available'); } $('#tc', el).textContent = torch ? 'Torch off' : 'Torch'; };
  const NOTE = 'Scans QR codes and EAN/UPC product barcodes (also Code 128). Hold the code steady, with a little white space around it.';
  $('#qrnote', el).textContent = bd ? 'Scans QR codes and common barcodes.' : NOTE;
  const isUrl = (t) => /^https?:\/\/\S+$/i.test(t);
  function drawHist() {
    const box = $('#hist', el); box.innerHTML = hist.length ? '' : '<div class="muted center">No scans yet.</div>';
    hist.forEach(x => { const r = h('<div class="item"><div class="grow" style="word-break:break-all">' + esc(x.t.slice(0, 140)) + '</div><button class="btn alt" style="min-height:44px">Show</button></div>'); $('button', r).onclick = () => showRes(x.t, x.f, false); box.appendChild(r); });
  }
  function showRes(text, fmt, add) {
    $('#res', el).style.display = ''; $('#fmt', el).textContent = fmt || 'Code'; $('#txt', el).textContent = text;
    const op = $('#op', el); if (isUrl(text)) { op.href = text; op.style.display = ''; } else { op.removeAttribute('href'); op.style.display = 'none'; }
    $('#cp', el).onclick = () => copyText(text);
    if (add) { hist = [{ t: text, f: fmt }].concat(hist.filter(x => x.t !== text)).slice(0, 20); Store.set('codescan.history', hist); drawHist(); }
  }
  async function decode(source, w, hh, maxSide, dense) {
    if (bd) { try { const r = await bd.detect(source); if (r && r.length) return { t: r[0].rawValue, f: FMT[r[0].format] || r[0].format }; return null; } catch (e) { bd = null; if (!gone) $('#qrnote', el).textContent = NOTE; } }
    const k = Math.min(1, (maxSide || 800) / Math.max(w, hh)), cw = Math.round(w * k), ch = Math.round(hh * k);
    sc.width = cw; sc.height = ch; g.drawImage(source, 0, 0, cw, ch);
    const px = g.getImageData(0, 0, cw, ch).data, c = typeof jsQR === 'function' ? jsQR(px, cw, ch) : null;
    if (c && c.data) return { t: c.data, f: 'QR code' };
    // jsQR found nothing: look for a 1D product barcode in the same pixels.
    const b = BarDec.scanGray(BarDec.toGray(px, cw, ch), cw, ch, { dense: !!dense });
    return b ? { t: b.text, f: b.type, oneD: true } : null;
  }
  async function loop() {
    if (gone || paused || busy || !v.videoWidth) return;
    busy = true;
    try { let r = await decode(v, v.videoWidth, v.videoHeight); if (r && r.t && !gone && r.oneD) { // a 1D read must repeat on a second scan before it is trusted
        const key = r.f + '|' + r.t, now = Date.now(), ok = key === lastKey && now - lastAt < 2000; lastKey = key; lastAt = now; if (!ok) r = null;
      }
      if (r && r.t && !gone) { paused = true; if (navigator.vibrate) navigator.vibrate(80); showRes(r.t, r.f, true); } } catch (e) { /* keep scanning */ }
    busy = false;
  }
  $('#again', el).onclick = () => { $('#res', el).style.display = 'none'; paused = false; };
  $('#img', el).onclick = () => pickFiles(false, async (f) => {
    try {
      const b = await loadBitmap(f[0], 2400); let r = null;
      // Small codes need a large scale, big or blurry ones a small one: try several.
      for (const m of [1600, 1000, 640, 400]) { r = await decode(b._img || b, b.width, b.height, m, true); if (r || gone) break; await sleep(0); }
      if (b.close) b.close();
      if (gone) return;
      if (r && r.t) { paused = true; showRes(r.t, r.f, true); } else toast('No code found in that picture');
    } catch (e) { if (!gone) toast('Could not read that picture'); }
  });
  $('#clr', el).onclick = () => { hist = []; Store.set('codescan.history', hist); drawHist(); };
  drawHist();
  cam.start('environment').then(ok => { if (ok && !gone) { timer = setInterval(loop, 250); show($('#tc', el), !!cam.caps().torch); } });
  return () => { gone = true; clearInterval(timer); cam.stop(); };
} });

/* ---------- 9. Document Scanner ---------- */
/* Homography from the unit square to the quad p[0..3] (TL, TR, BR, BL), after Heckbert. */
function quadMap(p) {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = [p[0].x, p[0].y, p[1].x, p[1].y, p[2].x, p[2].y, p[3].x, p[3].y];
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const gg = den ? (dx3 * dy2 - dx2 * dy3) / den : 0, hh = den ? (dx1 * dy3 - dx3 * dy1) / den : 0;
  const a = x1 - x0 + gg * x1, b = x3 - x0 + hh * x3, d = y1 - y0 + gg * y1, e = y3 - y0 + hh * y3;
  // Pass an array as the third argument to reuse it instead of allocating one per call.
  return (u, v, res) => { const w = gg * u + hh * v + 1, px = (a * u + b * v + x0) / w, py = (d * u + e * v + y0) / w; if (res) { res[0] = px; res[1] = py; return res; } return [px, py]; };
}
function warpImage(src, sw, sh, quad, ow, oh) {
  const out = new ImageData(ow, oh), map = quadMap(quad), s = src.data, o = out.data, pt = [0, 0];
  for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
    map(x / (ow - 1 || 1), y / (oh - 1 || 1), pt); const fx = pt[0], fy = pt[1];
    const x0 = clamp(Math.floor(fx), 0, sw - 1), y0 = clamp(Math.floor(fy), 0, sh - 1), x1 = Math.min(sw - 1, x0 + 1), y1 = Math.min(sh - 1, y0 + 1);
    const tx = clamp(fx - x0, 0, 1), ty = clamp(fy - y0, 0, 1), oi = (y * ow + x) * 4;
    for (let c = 0; c < 4; c++) {
      const a = s[(y0 * sw + x0) * 4 + c], b = s[(y0 * sw + x1) * 4 + c], cc = s[(y1 * sw + x0) * 4 + c], dd = s[(y1 * sw + x1) * 4 + c];
      o[oi + c] = (a * (1 - tx) + b * tx) * (1 - ty) + (cc * (1 - tx) + dd * tx) * ty;
    }
  }
  return out;
}
/* Local-mean threshold using an integral image; good for pages with uneven lighting. */
function adaptiveBW(img, grayOnly) {
  const w = img.width, hh = img.height, d = img.data, gray = new Uint8ClampedArray(w * hh);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) gray[j] = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
  let res = gray;
  if (!grayOnly) {
    const ii = new Float64Array((w + 1) * (hh + 1));
    for (let y = 0; y < hh; y++) { let row = 0; for (let x = 0; x < w; x++) { row += gray[y * w + x]; ii[(y + 1) * (w + 1) + x + 1] = ii[y * (w + 1) + x + 1] + row; } }
    const r = Math.max(4, Math.round(Math.max(w, hh) / 40)); res = new Uint8ClampedArray(w * hh);
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1), y0 = Math.max(0, y - r), y1 = Math.min(hh, y + r + 1);
      const sum = ii[y1 * (w + 1) + x1] - ii[y0 * (w + 1) + x1] - ii[y1 * (w + 1) + x0] + ii[y0 * (w + 1) + x0];
      res[y * w + x] = gray[y * w + x] * (x1 - x0) * (y1 - y0) < sum * 0.9 ? 0 : 255;
    }
  }
  for (let i = 0, j = 0; i < d.length; i += 4, j++) { d[i] = d[i + 1] = d[i + 2] = res[j]; d[i + 3] = 255; }
  return img;
}
/* Draggable normalised point inside a wrapper. */
function dragPoint(wrap, handle, pt, onMove) {
  handle.style.touchAction = 'none';
  const place = () => { handle.style.left = pt.x * 100 + '%'; handle.style.top = pt.y * 100 + '%'; };
  handle.onpointerdown = (e) => { handle.setPointerCapture(e.pointerId); e.preventDefault(); };
  handle.onpointermove = (e) => {
    if (!handle.hasPointerCapture || !handle.hasPointerCapture(e.pointerId)) return;
    const r = wrap.getBoundingClientRect(); pt.x = clamp((e.clientX - r.left) / r.width, 0, 1); pt.y = clamp((e.clientY - r.top) / r.height, 0, 1); place(); if (onMove) onMove();
  };
  place();
  return place;
}
const HANDLE = (id) => '<div id="' + id + '" style="position:absolute;width:32px;height:32px;margin:-16px 0 0 -16px;border-radius:50%;border:3px solid var(--accent);background:rgba(255,255,255,.35);box-sizing:border-box"></div>';

Tools.register({ id: 'docscan', pro: true, proKey: 'camera', name: 'Doc Scanner', icon: '📄', cat: 'camera', desc: 'Photograph or pick a page, drag the four corners to straighten it, choose colour, grey or black-and-white, and save it as an image.', keys: ['document', 'scan', 'paper', 'receipt', 'crop', 'perspective'], needs: ['camera', 'storage'], render(el) {
  el.innerHTML = '<div class="row"><button class="btn" id="take">Take photo</button><button class="btn alt" id="pick">Pick image</button></div><div class="muted center" id="msg" style="margin:6px 0">Take a photo of a page on a plain background.</div>' +
    '<div id="ed" style="display:none"><div id="wrap" style="position:relative;line-height:0;touch-action:pan-y;user-select:none"><canvas id="cv" style="display:block"></canvas><svg id="sv" viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none"><polygon id="pg" fill="rgba(80,140,255,.2)" stroke="#4a8cff" stroke-width=".6" vector-effect="non-scaling-stroke"/></svg>' + HANDLE('h0') + HANDLE('h1') + HANDLE('h2') + HANDLE('h3') + '</div>' +
    '<button class="btn" id="cut" style="margin-top:8px">Straighten and crop</button></div>' +
    '<div id="out" style="display:none"><canvas id="oc" style="display:block"></canvas><label class="f">Look<select id="lk"><option value="c">Colour</option><option value="g">Grey</option><option value="b" selected>Black and white</option></select></label><div class="row"><button class="btn alt" id="rot">Rotate</button><button class="btn alt" id="ed2">Adjust corners</button></div><div class="row"><button class="btn" id="sj">Save as JPEG</button><button class="btn alt" id="sp">Save as PNG</button></div></div>';
  let bmp = null, base = null, pts = [{ x: .08, y: .08 }, { x: .92, y: .08 }, { x: .92, y: .92 }, { x: .08, y: .92 }], rawOut = null;
  const cv = $('#cv', el), oc = $('#oc', el);
  function poly() { $('#pg', el).setAttribute('points', pts.map(p => (p.x * 100) + ',' + (p.y * 100)).join(' ')); }
  const places = pts.map((p, i) => dragPoint($('#wrap', el), $('#h' + i, el), p, poly));
  function load(files) {
    loadBitmap(files[0], 3000).then(b => {
      if (bmp && bmp.close) bmp.close();
      bmp = b; const [w, hh] = fitSize(b.width, b.height, 1600); base = document.createElement('canvas'); base.width = w; base.height = hh; drawSrc(base.getContext('2d'), b, 0, 0, w, hh);
      const [dw, dh] = fitSize(w, hh, 900); cv.width = dw; cv.height = dh; cv.style.width = '100%'; cv.getContext('2d').drawImage(base, 0, 0, dw, dh);
      [[.08, .08], [.92, .08], [.92, .92], [.08, .92]].forEach((c, i) => { pts[i].x = c[0]; pts[i].y = c[1]; places[i](); }); poly();
      $('#ed', el).style.display = ''; $('#out', el).style.display = 'none'; $('#msg', el).textContent = 'Drag the four circles to the corners of the page.';
    }).catch(() => { $('#msg', el).textContent = 'Could not open that image.'; });
  }
  const dist = (a, b) => Math.hypot((a.x - b.x) * base.width, (a.y - b.y) * base.height);
  let working = false, gone = false;
  async function cut() {
    if (!base || working) return;
    working = true; $('#msg', el).textContent = 'Processing...'; $('#cut', el).disabled = true;
    await sleep(40); // let the browser paint the message before the heavy loop
    try { if (!gone) cutNow(); } finally { working = false; const c = $('#cut', el); if (c) c.disabled = false; if (!gone) $('#msg', el).textContent = ''; }
  }
  function cutNow() {
    const ow = Math.max(8, Math.round(Math.max(dist(pts[0], pts[1]), dist(pts[3], pts[2])))), oh = Math.max(8, Math.round(Math.max(dist(pts[0], pts[3]), dist(pts[1], pts[2]))));
    const k = Math.min(1, 1200 / Math.max(ow, oh)), W = Math.max(8, Math.round(ow * k)), H = Math.max(8, Math.round(oh * k));
    const src = base.getContext('2d').getImageData(0, 0, base.width, base.height);
    const q = pts.map(p => ({ x: p.x * (base.width - 1), y: p.y * (base.height - 1) }));
    rawOut = warpImage(src, base.width, base.height, q, W, H); look();
    $('#ed', el).style.display = 'none'; $('#out', el).style.display = '';
  }
  function look() {
    if (!rawOut) return; const m = $('#lk', el).value;
    const img = new ImageData(new Uint8ClampedArray(rawOut.data), rawOut.width, rawOut.height);
    if (m !== 'c') adaptiveBW(img, m === 'g');
    oc.width = img.width; oc.height = img.height; oc.style.width = '100%'; oc.getContext('2d').putImageData(img, 0, 0);
  }
  $('#take', el).onclick = () => takePhoto(el, load);
  $('#pick', el).onclick = () => pickFiles(false, load);
  $('#cut', el).onclick = cut; $('#lk', el).onchange = look;
  $('#ed2', el).onclick = () => { $('#ed', el).style.display = ''; $('#out', el).style.display = 'none'; };
  $('#rot', el).onclick = () => {
    if (!rawOut) return; const t = document.createElement('canvas'); t.width = rawOut.width; t.height = rawOut.height; t.getContext('2d').putImageData(rawOut, 0, 0);
    const r = document.createElement('canvas'); r.width = t.height; r.height = t.width; const g = r.getContext('2d'); g.translate(r.width, 0); g.rotate(Math.PI / 2); g.drawImage(t, 0, 0);
    rawOut = g.getImageData(0, 0, r.width, r.height); look();
  };
  $('#sj', el).onclick = () => saveCanvas(oc, 'scan', 'image/jpeg', 0.9);
  $('#sp', el).onclick = () => saveCanvas(oc, 'scan', 'image/png');
  remember(el, 'docscan', ['lk']);
  return () => { gone = true; if (bmp && bmp.close) bmp.close(); };
} });

/* ---------- 10. Grid Cam (grid + horizon level) ---------- */
Tools.register({ id: 'gridcam', name: 'Grid Cam', icon: '🔲', cat: 'camera', desc: 'Camera with composition grids (thirds, grid, diagonals, cross) and a live horizon line that shows how level the phone is. Capture straight photos.', keys: ['level', 'horizon', 'rule of thirds', 'composition', 'straight'], needs: ['camera', 'motion'], render(el) {
  const ov = '<svg id="gs" viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none"></svg><div id="hz" style="position:absolute;left:-10%;right:-10%;top:50%;height:0;border-top:2px solid #ffd400;pointer-events:none;transition:border-color .2s"></div><div id="dg" style="position:absolute;right:8px;top:8px;line-height:1.2;font-size:12px;padding:3px 8px;border-radius:99px;background:rgba(0,0,0,.6);color:#fff">0.0°</div>';
  el.innerHTML = VIEW(ov) + '<label class="f">Grid<select id="gm"><option value="t">Rule of thirds</option><option value="g">4 x 4 grid</option><option value="x">Cross</option><option value="d">Diagonals</option><option value="n">None</option></select></label><div class="row"><button class="btn alt" id="sw">Front camera</button><button class="btn" id="cap">Capture photo</button></div><div class="muted center" id="lvm"></div>';
  const v = $('#v', el), cam = makeCam(v, $('#msg', el)); let facing = 'environment', ang = 0;
  function grid() {
    const m = $('#gm', el).value, L = (a, b, c, d) => '<line x1="' + a + '" y1="' + b + '" x2="' + c + '" y2="' + d + '" vector-effect="non-scaling-stroke"/>';
    let s = '';
    if (m === 't') s = L(33.3, 0, 33.3, 100) + L(66.6, 0, 66.6, 100) + L(0, 33.3, 100, 33.3) + L(0, 66.6, 100, 66.6);
    else if (m === 'g') for (let i = 1; i < 4; i++) s += L(i * 25, 0, i * 25, 100) + L(0, i * 25, 100, i * 25);
    else if (m === 'x') s = L(50, 0, 50, 100) + L(0, 50, 100, 50);
    else if (m === 'd') s = L(0, 0, 100, 100) + L(100, 0, 0, 100);
    $('#gs', el).innerHTML = '<g stroke="rgba(255,255,255,.75)" stroke-width="1">' + s + '</g>';
  }
  let gotMotion = false, noSensorT = 0;
  const levelOff = (msg) => { $('#lvm', el).textContent = msg; $('#hz', el).style.display = 'none'; $('#dg', el).style.display = 'none'; };
  function motion(e) {
    const a = e.accelerationIncludingGravity; if (!a || a.x == null || a.y == null) return;
    if (!gotMotion) { gotMotion = true; clearTimeout(noSensorT); }
    const raw = Math.atan2(a.x, a.y) * 180 / Math.PI;
    ang = ang * 0.8 + raw * 0.2;
    $('#hz', el).style.transform = 'rotate(' + ang.toFixed(1) + 'deg)';
    const lvl = Math.abs(ang) < 1.5; $('#hz', el).style.borderTopColor = lvl ? '#3ddc84' : '#ffd400'; $('#dg', el).textContent = (lvl ? 'Level ' : '') + ang.toFixed(1) + '°';
  }
  async function startMotion() {
    try { if (window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === 'function') { const r = await DeviceMotionEvent.requestPermission(); if (r !== 'granted') throw new Error('denied'); } } catch (e) { levelOff('Motion sensor permission was denied, so the level line is off.'); return; }
    if (!window.DeviceMotionEvent) { levelOff('No motion sensor on this device, so the level line is off.'); return; }
    window.addEventListener('devicemotion', motion);
    // Some browsers have the API but no sensor: if no reading arrives, say so instead of showing a level line stuck at 0.
    noSensorT = setTimeout(() => { if (!gotMotion) levelOff('No motion sensor reading on this device, so the level line is off.'); }, 2500);
  }
  $('#gm', el).onchange = grid;
  $('#sw', el).onclick = () => { facing = facing === 'user' ? 'environment' : 'user'; $('#sw', el).textContent = facing === 'user' ? 'Rear camera' : 'Front camera'; v.style.transform = facing === 'user' ? 'scaleX(-1)' : ''; cam.start(facing); };
  $('#cap', el).onclick = () => { const cv = grab(v, { mirror: facing === 'user' }); if (cv) saveCanvas(cv, 'photo'); else toast('Camera is not ready'); };
  grid(); cam.start(facing); startMotion(); remember(el, 'gridcam', ['gm']);
  return () => { clearTimeout(noSensorT); window.removeEventListener('devicemotion', motion); cam.stop(); };
} });

/* ---------- 11. Timer Cam ---------- */
Tools.register({ id: 'timercam', name: 'Timer Cam', icon: '⏲️', cat: 'camera', desc: 'Self-timer camera: pick a delay and how many shots to take, put the phone down and get in the picture.', keys: ['self timer', 'selfie', 'group photo', 'delay'], needs: ['camera'], render(el) {
  el.innerHTML = VIEW('<div id="cd" style="position:absolute;inset:0;display:none;align-items:center;justify-content:center;font-size:120px;font-weight:700;color:#fff;text-shadow:0 2px 12px #000;line-height:1;pointer-events:none"></div>') +
    '<div class="row"><label class="f">Delay<select id="dl"><option value="3">3 s</option><option value="5">5 s</option><option value="10" selected>10 s</option><option value="15">15 s</option></select></label><label class="f">Shots<select id="sh"><option>1</option><option>3</option><option>5</option></select></label></div>' +
    '<div class="row"><button class="btn alt" id="sw">Front camera</button><button class="btn" id="go">Start timer</button></div><div id="gal" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px"></div>';
  const v = $('#v', el), cam = makeCam(v, $('#msg', el)); let facing = 'environment', seq = 0, active = false, urls = [];
  function addShot(cv) {
    cv.toBlob(b => {
      if (!b) return; const url = URL.createObjectURL(b); urls.push(url);
      const t = h('<button aria-label="Save photo" style="padding:0;border:1px solid var(--line);border-radius:10px;overflow:hidden;width:90px;height:90px;background:var(--surface2)"><img src="' + url + '" alt="Shot" style="width:100%;height:100%;object-fit:cover;border:0"></button>');
      t.onclick = () => saveBlob(b, 'timer-' + stamp() + '.jpg'); const gal = $('#gal', el); if (gal) gal.appendChild(t);
    }, 'image/jpeg', 0.92);
  }
  async function go() {
    if (active) { seq++; active = false; $('#go', el).textContent = 'Start timer'; $('#cd', el).style.display = 'none'; return; }
    if (!v.videoWidth) { toast('Camera is not ready'); return; }
    const my = ++seq, delay = +$('#dl', el).value, n = +$('#sh', el).value; active = true; $('#go', el).textContent = 'Cancel';
    for (let s = 0; s < n; s++) {
      for (let t = s === 0 ? delay : 2; t > 0; t--) {
        const c = $('#cd', el); if (!c || my !== seq) return; c.style.display = 'flex'; c.textContent = t; if (t <= 3) tick(); await sleep(1000);
      }
      if (my !== seq) return;
      const c = $('#cd', el); c.style.display = 'none'; const cv = grab(v, { mirror: facing === 'user' }); if (cv) addShot(cv);
      if (navigator.vibrate) navigator.vibrate(40); await sleep(300);
    }
    if (my === seq) { active = false; $('#go', el).textContent = 'Start timer'; toast('Done. Tap a picture to save it.'); }
  }
  $('#go', el).onclick = go;
  $('#sw', el).onclick = () => { facing = facing === 'user' ? 'environment' : 'user'; $('#sw', el).textContent = facing === 'user' ? 'Rear camera' : 'Front camera'; v.style.transform = facing === 'user' ? 'scaleX(-1)' : ''; cam.start(facing); };
  cam.start(facing); remember(el, 'timercam', ['dl', 'sh']);
  return () => { seq += 1e9; cam.stop(); urls.forEach(u => URL.revokeObjectURL(u)); };
} });

/* ---------- 12. Time-lapse ---------- */
Tools.register({ id: 'timelapse', pro: true, proKey: 'camera', name: 'Time-lapse', icon: '🎥', cat: 'camera', desc: 'Capture a frame every few seconds with the camera and turn them into a time-lapse WebM video. Keep the app open and the phone steady; the screen stays awake while capturing.', keys: ['interval', 'timelapse', 'video'], needs: ['camera'], render(el) {
  el.innerHTML = VIEW() + '<div class="row"><label class="f">Every<select id="iv"><option value="1">1 s</option><option value="2">2 s</option><option value="5" selected>5 s</option><option value="10">10 s</option><option value="30">30 s</option><option value="60">60 s</option></select></label><label class="f">Video speed<select id="fp"><option value="8">8 fps</option><option value="12" selected>12 fps</option><option value="24">24 fps</option></select></label></div>' +
    '<div class="row"><button class="btn" id="go">Start capturing</button><button class="btn alt" id="mk">Make video</button></div><div class="muted center" id="st" style="margin:6px 0">0 frames</div><button class="btn danger" id="clr">Discard frames</button><div id="res"></div>';
  const v = $('#v', el), cam = makeCam(v, $('#msg', el)), MAXF = 600, wl = wakeLock(), ctl = { cancel: false }; let blobs = [], timer = null, gone = false, making = false, resUrl = null;
  const upd = () => { const s = $('#st', el); if (s && !making) s.textContent = blobs.length + ' frames' + (timer ? ', capturing' : ''); };
  async function snap() {
    if (blobs.length >= MAXF) { stop(); toast('Frame limit reached'); return; }
    const cv = grab(v, { max: 720 }); if (!cv) return; const b = await toBlob(cv, 'image/jpeg', 0.8); if (b && !gone) { blobs.push(b); upd(); }
  }
  function stop() { clearInterval(timer); timer = null; wl.off(); const g = $('#go', el); if (g) g.textContent = 'Start capturing'; upd(); }
  $('#go', el).onclick = () => {
    if (timer) { stop(); return; }
    if (!v.videoWidth) { toast('Camera is not ready'); return; }
    wl.on(); snap(); timer = setInterval(snap, +$('#iv', el).value * 1000); $('#go', el).textContent = 'Stop capturing'; upd();
  };
  $('#clr', el).onclick = () => { stop(); blobs = []; upd(); };
  $('#mk', el).onclick = async () => {
    if (making) return; if (blobs.length < 2) { toast('Capture at least 2 frames'); return; } stop(); making = true;
    try {
      const blob = await framesToWebm(blobs, +$('#fp', el).value, (i, n) => { const s = $('#st', el); if (s) s.textContent = 'Building video ' + i + ' / ' + n + ' ...'; }, ctl);
      if (!gone) {
        if (resUrl) URL.revokeObjectURL(resUrl); resUrl = URL.createObjectURL(blob);
        $('#res', el).innerHTML = '<div class="card"><video controls playsinline src="' + resUrl + '"></video><div class="muted">' + kb(blob.size) + '</div></div><button class="btn" id="sv">Save / share video</button>';
        $('#sv', el).onclick = () => saveBlob(blob, 'timelapse-' + stamp() + videoExt(blob));
      }
    } catch (e) { if (!gone) toast(e.message || 'Could not make the video'); }
    making = false; if (!gone) upd();
  };
  cam.start('environment'); remember(el, 'timelapse', ['iv', 'fp']);
  return () => { gone = true; ctl.cancel = true; clearInterval(timer); wl.dispose(); cam.stop(); if (resUrl) URL.revokeObjectURL(resUrl); };
} });
/* ---------- picture tools (pick images from the phone) ---------- */
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const baseName = (f) => (f.name || 'image').replace(/\.[^.]+$/, '').slice(0, 40) || 'image';

async function encodeImage(bmp, o) {
  const [w, hh] = fitSize(bmp.width, bmp.height, o.max || 0), cv = document.createElement('canvas'); cv.width = w; cv.height = hh;
  const g = cv.getContext('2d');
  if (o.type === 'image/jpeg') { g.fillStyle = '#fff'; g.fillRect(0, 0, w, hh); }
  drawSrc(g, bmp, 0, 0, w, hh);
  return toBlob(cv, o.type, o.q);
}

/* Shared UI for "pick several images, process each, save each" tools. */
function batchTool(el, opts) {
  el.innerHTML = '<button class="btn" id="pk">Pick pictures</button>' + opts.controls + '<button class="btn" id="run" style="margin-top:8px">' + opts.run + '</button><div class="muted center" id="st" style="margin:6px 0">Pick up to 40 pictures, then tap ' + opts.run + '.</div><div class="list" id="ls"></div>';
  let files = [], gone = false, outs = [];
  const ls = $('#ls', el);
  $('#pk', el).onclick = () => pickFiles(true, f => { files = f.slice(0, 40); $('#st', el).textContent = files.length + ' picture' + (files.length === 1 ? '' : 's') + ' selected'; ls.innerHTML = ''; outs = []; });
  let running = false;
  $('#run', el).onclick = async () => {
    if (!files.length) { toast('Pick pictures first'); return; }
    if (running) return;     // a second tap while working would run the whole batch again and double the list
    running = true; $('#run', el).disabled = true; $('#pk', el).disabled = true;
    ls.innerHTML = ''; outs = [];
    for (let i = 0; i < files.length && !gone; i++) {
      const f = files[i]; $('#st', el).textContent = 'Working ' + (i + 1) + ' / ' + files.length + ' ...';
      try {
        const bmp = await loadBitmap(f, opts.max), r = await opts.process(bmp, f); if (bmp.close) bmp.close();
        if (!r.blob) throw new Error('encode failed');
        outs.push(r);
        const row = h('<div class="item"><div class="grow" style="min-width:0"><div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(r.name) + '</div><div class="muted">' + esc(r.info) + '</div></div><button class="btn" style="min-height:44px">Save</button></div>');
        $('button', row).onclick = () => saveBlob(r.blob, r.name); ls.appendChild(row);
      } catch (e) { ls.appendChild(h('<div class="item"><div class="grow">' + esc(f.name || 'Picture') + '</div><div class="muted">Could not read this file</div></div>')); }
    }
    running = false;
    if (!gone) { $('#run', el).disabled = false; $('#pk', el).disabled = false; $('#st', el).textContent = 'Done: ' + outs.length + ' of ' + files.length + '. Tap Save on each one.'; }
  };
  return () => { gone = true; };
}

/* ---------- 13. Photo Collage ---------- */
Tools.register({ id: 'collage', pro: true, proKey: 'camera', name: 'Collage', icon: '🏞️', cat: 'camera', desc: 'Combine several pictures into one collage with a choice of grid layouts, spacing and background colour, then save it.', keys: ['grid', 'photo grid', 'combine', 'merge pictures'], needs: ['storage'], render(el) {
  const LAY = [['2 side by side', 2, 1], ['2 stacked', 1, 2], ['2 x 2', 2, 2], ['3 across', 3, 1], ['3 stacked', 1, 3], ['2 x 3', 2, 3], ['3 x 3', 3, 3]];
  el.innerHTML = '<button class="btn" id="pk">Pick pictures (up to 9)</button><canvas id="cv" style="margin-top:8px;display:none"></canvas>' +
    '<label class="f">Layout<select id="ly">' + LAY.map((l, i) => '<option value="' + i + '"' + (i === 2 ? ' selected' : '') + '>' + l[0] + '</option>').join('') + '</select></label>' +
    SLIDER('gp', 'Spacing', 0, 40, 2, 8) + '<label class="f">Background<input type="color" id="bg" value="#ffffff" style="height:44px"></label>' +
    '<div class="row"><button class="btn alt" id="sh">Shuffle</button><button class="btn" id="sv">Save collage</button></div><div class="muted center" id="st" style="margin-top:6px">Pick up to 9 pictures to make a collage.</div>';
  let bmps = [], gone = false; const cv = $('#cv', el);
  function draw() {
    if (!bmps.length) return;
    const [, c, r] = LAY[+$('#ly', el).value], gap = +$('#gp', el).value, W = 1080, cw = (W - gap * (c + 1)) / c, H = Math.round(gap * (r + 1) + cw * r);
    cv.width = W; cv.height = H; cv.style.display = ''; const g = cv.getContext('2d');
    g.fillStyle = $('#bg', el).value; g.fillRect(0, 0, W, H);
    for (let i = 0; i < c * r; i++) {
      const b = bmps[i % bmps.length], x = gap + (i % c) * (cw + gap), y = gap + Math.floor(i / c) * (cw + gap), k = Math.max(cw / b.width, cw / b.height), sw = cw / k, sh = cw / k;
      g.save(); g.beginPath(); g.rect(x, y, cw, cw); g.clip(); drawSrc(g, b, (b.width - sw) / 2, (b.height - sh) / 2, sw, sh, x, y, cw, cw); g.restore();
    }
  }
  $('#pk', el).onclick = () => pickFiles(true, async (f) => {
    $('#st', el).textContent = 'Loading ...'; bmps.forEach(b => b.close && b.close()); bmps = [];
    for (const x of f.slice(0, 9)) { try { const b = await loadBitmap(x, 1400); if (gone) { if (b.close) b.close(); return; } bmps.push(b); } catch (e) { /* skip unreadable file */ } }
    if (gone) return; $('#st', el).textContent = bmps.length ? bmps.length + ' pictures. Pictures repeat if the layout has more cells.' : 'None of those files could be read.'; draw();
  });
  ['ly', 'gp', 'bg'].forEach(id => $('#' + id, el).addEventListener('input', () => { if (id === 'gp') $('#gpL', el).textContent = $('#gp', el).value + ' px'; draw(); }));
  $('#gpL', el).textContent = '8 px'; remember(el, 'collage', ['ly', 'gp', 'bg']);
  $('#sh', el).onclick = () => { for (let i = bmps.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bmps[i], bmps[j]] = [bmps[j], bmps[i]]; } draw(); };
  $('#sv', el).onclick = () => { if (!bmps.length) { toast('Pick pictures first'); return; } saveCanvas(cv, 'collage', 'image/jpeg', 0.92); };
  return () => { gone = true; bmps.forEach(b => b.close && b.close()); };
} });

/* ---------- 14. Image Shrinker ---------- */
Tools.register({ id: 'imgshrink', name: 'Image Shrink', icon: '🗜️', cat: 'camera', desc: 'Make pictures smaller: choose a maximum size and quality, and see how much space you save. Works on many pictures at once.', keys: ['compress', 'resize', 'reduce size', 'smaller photo'], needs: ['storage'], render(el) {
  const controls = '<label class="f">Longest side<select id="mx"><option value="0">Keep size</option><option value="640">640 px</option><option value="1024">1024 px</option><option value="1600" selected>1600 px</option><option value="2048">2048 px</option></select></label>' +
    '<label class="f">Format<select id="ty"><option value="image/jpeg">JPEG</option><option value="image/webp">WebP</option></select></label>' + SLIDER('q', 'Quality', 30, 100, 5, 75);
  const stop = batchTool(el, { controls, run: 'Shrink pictures', async process(bmp, f) {
    const type = $('#ty', el).value, blob = await encodeImage(bmp, { max: +$('#mx', el).value, type, q: +$('#q', el).value / 100 }), ty = blob.type || type;
    const diff = f.size ? Math.round((1 - blob.size / f.size) * 100) : 0;
    return { blob, name: baseName(f) + '-small' + (EXT[ty] || '.jpg'), info: kb(f.size) + ' to ' + kb(blob.size) + (diff > 0 ? ' (' + diff + '% smaller)' : ' (no saving)') };
  } });
  const q = $('#q', el), u = () => { $('#qL', el).textContent = q.value + '%'; }; q.addEventListener('input', u); u(); remember(el, 'imgshrink', ['mx', 'ty', 'q']);
  return stop;
} });

/* ---------- 15. Image Converter ---------- */
Tools.register({ id: 'imgconvert', name: 'Img Convert', icon: '🔄', cat: 'camera', desc: 'Convert pictures between PNG, JPEG and WebP. Pick several files and save each result.', keys: ['png', 'jpeg', 'jpg', 'webp', 'format', 'convert image'], needs: ['storage'], render(el) {
  const controls = '<label class="f">Convert to<select id="ty"><option value="image/png">PNG</option><option value="image/jpeg" selected>JPEG</option><option value="image/webp">WebP</option></select></label>' + SLIDER('q', 'Quality (JPEG and WebP)', 40, 100, 5, 90);
  const stop = batchTool(el, { controls, run: 'Convert pictures', async process(bmp, f) {
    const type = $('#ty', el).value, blob = await encodeImage(bmp, { type, q: +$('#q', el).value / 100 });
    const ok = blob && blob.type === type;
    return { blob, name: baseName(f) + (EXT[blob && blob.type] || EXT[type]), info: (ok ? '' : 'This device cannot make that format, saved as PNG. ') + bmp.width + ' x ' + bmp.height + ', ' + kb(blob.size) };
  } });
  const q = $('#q', el), u = () => { $('#qL', el).textContent = q.value + '%'; }; q.addEventListener('input', u); u(); remember(el, 'imgconvert', ['ty', 'q']);
  return stop;
} });

/* ---------- 16. Photo FX ---------- */
Tools.register({ id: 'photofx', pro: true, proKey: 'camera', name: 'Photo FX', icon: '🖼️', cat: 'camera', desc: 'Edit a picture: grey, sepia, invert and colour looks, brightness, contrast and saturation sliders, rotate and flip, then save.', keys: ['filter', 'grayscale', 'black and white', 'sepia', 'edit photo', 'rotate'], needs: ['storage'], render(el) {
  const LOOKS = { none: '', grey: 'grayscale(1)', sepia: 'sepia(1)', invert: 'invert(1)', vivid: 'saturate(1.8) contrast(1.1)', cool: 'hue-rotate(20deg) saturate(1.2)', warm: 'sepia(.4) saturate(1.4)', soft: 'blur(2px)' };
  el.innerHTML = '<button class="btn" id="pk">Pick a picture</button><canvas id="cv" style="margin-top:8px;display:none"></canvas>' +
    '<label class="f">Look<select id="lk">' + Object.keys(LOOKS).map(k => '<option>' + k + '</option>').join('') + '</select></label>' +
    SLIDER('br', 'Brightness', 0.4, 1.8, 0.05, 1) + SLIDER('co', 'Contrast', 0.4, 2, 0.05, 1) + SLIDER('sa', 'Saturation', 0, 3, 0.1, 1) +
    '<div class="row"><button class="btn alt" id="rt">Rotate</button><button class="btn alt" id="fl">Flip</button><button class="btn alt" id="rs">Reset</button></div><div class="row"><button class="btn" id="sj">Save JPEG</button><button class="btn alt" id="sp">Save PNG</button></div><div class="muted center" id="st" style="margin-top:6px">Pick a picture to start.</div>';
  let bmp = null, rot = 0, flip = false; const cv = $('#cv', el);
  const val = (id) => $('#' + id, el).value;
  function render(target, max) {
    const sw = rot % 2 ? bmp.height : bmp.width, sh = rot % 2 ? bmp.width : bmp.height, [w, hh] = fitSize(sw, sh, max);
    target.width = w; target.height = hh; const g = target.getContext('2d');
    if ('filter' in g) g.filter = (LOOKS[val('lk')] + ' brightness(' + val('br') + ') contrast(' + val('co') + ') saturate(' + val('sa') + ')').trim();
    g.translate(w / 2, hh / 2); g.rotate(rot * Math.PI / 2); if (flip) g.scale(-1, 1);
    const dw = rot % 2 ? hh : w, dh = rot % 2 ? w : hh; drawSrc(g, bmp, -dw / 2, -dh / 2, dw, dh);
  }
  const draw = () => { if (bmp) { cv.style.display = ''; render(cv, 900); } };
  $('#pk', el).onclick = () => pickFiles(false, async (f) => { try { if (bmp && bmp.close) bmp.close(); bmp = await loadBitmap(f[0], 3000); rot = 0; flip = false; draw(); $('#st', el).textContent = (bmp.origW || bmp.width) + ' x ' + (bmp.origH || bmp.height) + (bmp.origW ? ' (editing a copy shrunk to ' + bmp.width + ' x ' + bmp.height + ')' : ''); } catch (e) { toast('Could not open that picture'); } });
  ['lk', 'br', 'co', 'sa'].forEach(id => $('#' + id, el).addEventListener('input', () => { if ($('#' + id + 'L', el)) $('#' + id + 'L', el).textContent = val(id); draw(); }));
  $('#rt', el).onclick = () => { rot = (rot + 1) % 4; draw(); }; $('#fl', el).onclick = () => { flip = !flip; draw(); };
  $('#rs', el).onclick = () => { $('#lk', el).value = 'none'; $('#br', el).value = $('#co', el).value = $('#sa', el).value = 1; ['br', 'co', 'sa'].forEach(i => { $('#' + i + 'L', el).textContent = '1'; }); rot = 0; flip = false; draw(); };
  const full = (type) => { if (!bmp) { toast('Pick a picture first'); return; } const o = document.createElement('canvas'); render(o, 4096); saveCanvas(o, 'photofx', type, 0.92); };
  $('#sj', el).onclick = () => full('image/jpeg'); $('#sp', el).onclick = () => full('image/png');
  if (!('filter' in document.createElement('canvas').getContext('2d'))) $('#st', el).textContent = 'This device does not support canvas filters, so looks and sliders will not show.';
  ['br', 'co', 'sa'].forEach(i => { $('#' + i + 'L', el).textContent = '1'; });
  return () => { if (bmp && bmp.close) bmp.close(); };
} });

/* ---------- 17. Photo Cleaner (metadata stripper) ---------- */
/* Looks for an EXIF block in a JPEG and for a GPS entry inside it. */
function exifInfo(buf) {
  const d = new DataView(buf), n = d.byteLength;
  if (n < 4 || d.getUint16(0) !== 0xFFD8) return { jpeg: false, exif: false, gps: false };
  let p = 2, other = false;
  while (p + 4 < n) {
    if (d.getUint8(p) !== 0xFF) break;
    const m = d.getUint8(p + 1), len = d.getUint16(p + 2);
    if (m === 0xDA) break;
    if (m === 0xE1 && p + 10 < n && d.getUint32(p + 4) === 0x45786966) {
      const t = p + 10, le = d.getUint16(t) === 0x4949; let gps = false;
      try {
        const ifd = t + d.getUint32(t + 4, le), cnt = d.getUint16(ifd, le);
        for (let i = 0; i < cnt; i++) if (d.getUint16(ifd + 2 + i * 12, le) === 0x8825) gps = true;
      } catch (e) { /* truncated block */ }
      return { jpeg: true, exif: true, gps };
    }
    if (m === 0xE1 || m === 0xED || m === 0xFE) other = true;   // XMP, Photoshop/IPTC data or a text comment
    p += 2 + len;
  }
  return { jpeg: true, exif: false, gps: false, other };
}
Tools.register({ id: 'exifclean', name: 'Photo Cleaner', icon: '🧼', cat: 'camera', desc: 'Remove hidden data such as location, camera model and time from photos before you share them. Pictures are re-encoded without metadata; anything larger than 4096 px on its longest side is scaled down to 4096 px.', keys: ['exif', 'metadata', 'privacy', 'gps', 'location', 'strip'], needs: ['storage'], render(el) {
  const controls = '<div class="muted" style="margin:6px 0">Each picture is redrawn and saved fresh, so location, camera details and timestamps are left behind. Pictures keep their size, except that very large ones (over 4096 px on the longest side) are scaled down to 4096 px to avoid running out of memory.</div>';
  const stop = batchTool(el, { controls, run: 'Clean pictures', max: 4096, async process(bmp, f) {
    let note = 'No metadata found'; try { const e = exifInfo(await f.arrayBuffer()); if (e.exif) note = e.gps ? 'Removed metadata including location' : 'Removed metadata'; else if (e.other) note = 'Removed other embedded data'; else if (!e.jpeg) note = 'Re-encoded without metadata'; } catch (e) { /* unreadable header */ }
    const type = f.type === 'image/png' ? 'image/png' : f.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
    const blob = await encodeImage(bmp, { type, q: 0.95 });
    return { blob, name: baseName(f) + '-clean' + (EXT[blob && blob.type] || '.jpg'), info: note + ', ' + kb(blob.size) };
  } });
  return stop;
} });

/* ---------- 18. Eye Dropper (from a picture) ---------- */
function dominantColors(data, count) {
  const bins = new Map();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const k = (data[i] >> 4) << 8 | (data[i + 1] >> 4) << 4 | (data[i + 2] >> 4), e = bins.get(k) || { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += data[i]; e.g += data[i + 1]; e.b += data[i + 2]; bins.set(k, e);
  }
  const arr = [...bins.values()].sort((a, b) => b.n - a.n), out = [];
  for (const e of arr) {
    const c = { r: Math.round(e.r / e.n), g: Math.round(e.g / e.n), b: Math.round(e.b / e.n) };
    if (out.every(o => Math.abs(o.r - c.r) + Math.abs(o.g - c.g) + Math.abs(o.b - c.b) > 70)) out.push(c);
    if (out.length >= count) break;
  }
  return out;
}
Tools.register({ id: 'eyedrop', name: 'Eye Dropper', icon: '🖍️', cat: 'camera', desc: 'Pick a picture, touch any point to read its colour as HEX and RGB with the nearest colour name, and see the main colours of the picture.', keys: ['colour picker', 'color from image', 'palette', 'hex'], needs: ['storage'], render(el) {
  el.innerHTML = '<button class="btn" id="pk">Pick a picture</button><div id="wrap" style="position:relative;line-height:0;margin-top:8px;display:none;touch-action:none"><canvas id="cv" style="display:block"></canvas><div id="ring" style="position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;border:2px solid #fff;border-radius:50%;box-shadow:0 0 0 1px #000;pointer-events:none"></div></div>' +
    '<div class="card"><div class="row" style="align-items:center"><div id="sw" style="height:56px;border-radius:12px;border:1px solid var(--line);flex:0 0 72px;background:var(--surface2)"></div><div style="flex:1 1 auto"><div class="mid" id="hx">-</div><div class="muted" id="rgb">Pick a picture, then touch it</div><div id="nm"></div></div></div><button class="btn" id="cp" style="margin-top:8px">Copy HEX</button></div>' +
    '<div class="card"><div class="muted">Main colours (tap to select)</div><div id="pal" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px"></div></div>';
  const cv = $('#cv', el), g = cv.getContext('2d', { willReadFrequently: true }); let cur = null, bmp = null;
  function setCol(c) { cur = c; const x = toHex(c.r, c.g, c.b); $('#sw', el).style.background = x; $('#hx', el).textContent = x; $('#rgb', el).textContent = 'rgb(' + c.r + ', ' + c.g + ', ' + c.b + ')'; $('#nm', el).textContent = nearestName(c.r, c.g, c.b); }
  function at(e) {
    const r = cv.getBoundingClientRect(), px = clamp((e.clientX - r.left) / r.width, 0, 1), py = clamp((e.clientY - r.top) / r.height, 0, 1);
    $('#ring', el).style.left = px * 100 + '%'; $('#ring', el).style.top = py * 100 + '%';
    const x = clamp(Math.round(px * (cv.width - 1)), 1, cv.width - 2), y = clamp(Math.round(py * (cv.height - 1)), 1, cv.height - 2), d = g.getImageData(x - 1, y - 1, 3, 3).data; let R = 0, G = 0, B = 0;
    for (let i = 0; i < d.length; i += 4) { R += d[i]; G += d[i + 1]; B += d[i + 2]; }
    setCol({ r: Math.round(R / 9), g: Math.round(G / 9), b: Math.round(B / 9) });
  }
  cv.onpointerdown = (e) => { if (cv.width < 3) return; cv.setPointerCapture(e.pointerId); at(e); };
  cv.onpointermove = (e) => { if (cv.hasPointerCapture(e.pointerId)) at(e); };
  $('#pk', el).onclick = () => pickFiles(false, async (f) => {
    try {
      if (bmp && bmp.close) bmp.close(); bmp = await loadBitmap(f[0]); const [w, hh] = fitSize(bmp.width, bmp.height, 1000); cv.width = w; cv.height = hh; cv.style.width = '100%'; drawSrc(g, bmp, 0, 0, w, hh);
      $('#wrap', el).style.display = ''; $('#ring', el).style.left = '50%'; $('#ring', el).style.top = '50%'; at({ clientX: cv.getBoundingClientRect().left + cv.getBoundingClientRect().width / 2, clientY: cv.getBoundingClientRect().top + cv.getBoundingClientRect().height / 2 });
      const s = document.createElement('canvas'); s.width = s.height = 64; s.getContext('2d').drawImage(cv, 0, 0, 64, 64); const pal = $('#pal', el); pal.innerHTML = '';
      dominantColors(s.getContext('2d').getImageData(0, 0, 64, 64).data, 6).forEach(c => { const b = h('<button aria-label="' + toHex(c.r, c.g, c.b) + '" style="width:44px;height:44px;border-radius:10px;border:1px solid var(--line);background:' + toHex(c.r, c.g, c.b) + '"></button>'); b.onclick = () => setCol(c); pal.appendChild(b); });
    } catch (e) { toast('Could not open that picture'); }
  });
  $('#cp', el).onclick = () => { if (cur) copyText(toHex(cur.r, cur.g, cur.b)); else toast('Pick a colour first'); };
  return () => { if (bmp && bmp.close) bmp.close(); };
} });

/* ---------- 19. Pixel Ruler ---------- */
Tools.register({ id: 'pixelruler', name: 'Pixel Ruler', icon: '🎚️', cat: 'camera', desc: 'Take or pick a photo, drag two points over it to measure the distance in pixels, and calibrate with an object of known length to read real units.', keys: ['measure', 'distance', 'photo ruler', 'size of object', 'calibrate'], needs: ['camera', 'storage'], render(el) {
  el.innerHTML = '<div class="row"><button class="btn" id="take">Take photo</button><button class="btn alt" id="pick">Pick picture</button></div>' +
    '<div id="wrap" style="position:relative;line-height:0;margin-top:8px;display:none;touch-action:pan-y;user-select:none"><img id="im" alt="Photo to measure" style="display:block;width:100%;border:0"><svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none"><line id="ln" stroke="#ffd400" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>' + HANDLE('a') + HANDLE('b') + '</div>' +
    '<div class="card center"><div class="big" id="out">-</div><div class="muted" id="px">Pick a photo, then drag the two circles.</div></div>' +
    '<div class="card"><b>Calibrate</b><div class="muted">Place the two points on an object whose length you know (a coin, a ruler, a card) and enter it. All later measurements use that scale.</div><div class="row" style="margin-top:8px"><label class="f">Known length<input id="kl" type="number" inputmode="decimal" min="0" max="1000000000" step="any" placeholder="e.g. 85.6"></label><label class="f">Unit<input id="ku" maxlength="6" value="mm"></label></div><div class="row"><button class="btn" id="cal">Set scale</button><button class="btn alt" id="rs">Clear scale</button></div></div>';
  const A = { x: .3, y: .5 }, B = { x: .7, y: .5 }; let url = null, nat = null, scale = null;
  const upd = () => {
    $('#ln', el).setAttribute('x1', A.x * 100); $('#ln', el).setAttribute('y1', A.y * 100); $('#ln', el).setAttribute('x2', B.x * 100); $('#ln', el).setAttribute('y2', B.y * 100);
    if (!nat) return; const px = Math.hypot((A.x - B.x) * nat.w, (A.y - B.y) * nat.h);
    $('#px', el).textContent = px.toFixed(1) + ' px' + (scale ? '' : ' (not calibrated)');
    const real = scale ? px * scale.k : px;
    $('#out', el).textContent = !isFinite(real) || real > 1e12 ? '--' : scale ? real.toFixed(2) + ' ' + scale.u : px.toFixed(0) + ' px';
  };
  dragPoint($('#wrap', el), $('#a', el), A, upd); dragPoint($('#wrap', el), $('#b', el), B, upd);
  function load(f) {
    if (url) URL.revokeObjectURL(url); url = URL.createObjectURL(f[0]); const im = $('#im', el);
    im.onload = () => { nat = { w: im.naturalWidth, h: im.naturalHeight }; $('#wrap', el).style.display = ''; upd(); };
    im.onerror = () => { toast('Could not open that picture'); }; im.src = url;
  }
  $('#take', el).onclick = () => takePhoto(el, load); $('#pick', el).onclick = () => pickFiles(false, load);
  $('#cal', el).onclick = () => {
    const len = Valid.num($('#kl', el).value); if (!nat || !(len > 0) || len > 1e9) { toast('Pick a photo and enter a length above 0 (up to 1,000,000,000)'); return; }
    const px = Math.hypot((A.x - B.x) * nat.w, (A.y - B.y) * nat.h); if (px < 1) { toast('Move the two points apart first'); return; }
    scale = { k: len / px, u: ($('#ku', el).value.trim() || 'units').slice(0, 6) }; upd();
  };
  $('#rs', el).onclick = () => { scale = null; upd(); };
  return () => { if (url) URL.revokeObjectURL(url); };
} });

if (typeof module !== 'undefined' && module.exports) module.exports = { BarDec, nearestName, quadMap, warpImage, adaptiveBW, exifInfo, dominantColors, fitSize, toHex };
})();
