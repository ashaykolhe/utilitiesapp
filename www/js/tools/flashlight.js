'use strict';
/* Torch through the camera track. Works on Android WebView where the camera permission is granted. */
Tools.register({ id: 'flashlight', name: 'Flashlight', icon: '🔦', cat: 'daily', desc: 'Turn the camera torch on and off.', needs: ['camera'], render(el) {
  el.innerHTML = '<div class="card center"><div class="big" id="ic">🔦</div><div class="muted" id="msg">Tap to switch on</div></div><button class="btn" id="b">Turn on</button>';
  let stream = null, track = null, gone = false, busy = false;
  const say = (t) => { const m = $('#msg', el); if (m && !gone) m.textContent = t; };
  function off() {
    const s = stream; stream = track = null;
    if (s) s.getTracks().forEach(t => { try { t.stop(); } catch (e) { /* ignore */ } });
    const b = $('#b', el), i = $('#ic', el); if (b) b.textContent = 'Turn on'; if (i) i.style.opacity = .4;
  }
  $('#ic', el).style.opacity = .4;
  $('#b', el).onclick = async () => {
    if (busy) return;
    if (track) { off(); say('Tap to switch on'); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { say('Torch is not available on this device'); return; }
    busy = true;
    let s = null;
    try {
      s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (gone) { s.getTracks().forEach(t => t.stop()); s = null; return; }
      const t = s.getVideoTracks()[0];
      if (!(t && t.getCapabilities && t.getCapabilities().torch)) throw new Error('notorch');
      await t.applyConstraints({ advanced: [{ torch: true }] });
      if (gone) { s.getTracks().forEach(x => x.stop()); s = null; return; }
      stream = s; track = t; s = null;
      t.addEventListener('ended', () => { if (track === t) { off(); say('The camera was released, torch is off'); } });
      $('#b', el).textContent = 'Turn off'; $('#ic', el).style.opacity = 1; say('On');
    } catch (e) {
      if (s) s.getTracks().forEach(t => t.stop());
      off();
      say(e && (e.name === 'NotAllowedError' || e.name === 'SecurityError' || e.name === 'PermissionDeniedError') ? 'Camera permission was denied. Allow the camera for PocketKit in your phone settings.' : 'Torch is not available on this device');
    } finally { busy = false; }
  };
  return () => { gone = true; off(); };
} });
