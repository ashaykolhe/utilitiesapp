'use strict';
/* Torch through the camera track. Works on Android WebView where the camera permission is granted. */
Tools.register({ id: 'flashlight', name: 'Flashlight', icon: '🔦', cat: 'daily', desc: 'Turn the camera torch on and off.', needs: ['camera'], render(el) {
  el.innerHTML = '<div class="card center"><div class="big" id="ic">🔦</div><div class="muted" id="msg">Tap to switch on</div></div><button class="btn" id="b">Turn on</button>';
  let stream = null, track = null;
  function off() {
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = track = null;
    const b = $('#b', el), i = $('#ic', el); if (b) b.textContent = 'Turn on'; if (i) i.style.opacity = .4;
  }
  $('#ic', el).style.opacity = .4;
  $('#b', el).onclick = async () => {
    if (track) { off(); return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      track = stream.getVideoTracks()[0];
      if (!(track.getCapabilities && track.getCapabilities().torch)) throw new Error('no torch');
      await track.applyConstraints({ advanced: [{ torch: true }] });
      $('#b', el).textContent = 'Turn off'; $('#ic', el).style.opacity = 1; $('#msg', el).textContent = 'On';
    } catch (e) { off(); $('#msg', el).textContent = 'Torch is not available on this device'; }
  };
  return off;
} });
