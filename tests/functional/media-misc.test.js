'use strict';
/* Functional tests: Text to Speech and Speech to Text (speech.js), Sound Intensity (noise.js), Flashlight, Paint. */
const { bootMedia } = require('../helpers/media-fakes');
const { suite } = require('../helpers/page');

(async () => {
  const T = suite('media-misc'), { page, M } = await bootMedia();
  const w = page.w, wait = page.wait;
  const toastText = () => w.document.querySelector('#toast').textContent;
  const reset = () => { M.mode = 'ok'; M.delay = 0; M.sig = null; M.torch = false; M.torchFail = false; M.calls.length = 0; M.applied.length = 0; };
  const ptr = (el, type, x, y) => { const e = new w.MouseEvent(type, { bubbles: true, clientX: x || 0, clientY: y || 0 }); Object.defineProperty(e, 'pointerId', { value: 1 }); el.dispatchEvent(e); };

  /* ================= Text to Speech ================= */
  {
    let t = await page.open('tts'); T.has(t.text(), 'Speech is not supported', 'tts: no speech engine gives a clear message'); t.close();
    const spoken = []; let cancels = 0;
    w.speechSynthesis = { voices: [{ name: 'Anna', lang: 'en-GB' }, { name: '<b>Bob</b>', lang: 'de-DE' }], getVoices() { return this.voices; }, speak(u) { spoken.push(u); }, cancel() { cancels++; }, onvoiceschanged: null };
    w.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
    t = await page.open('tts'); T.eq(t.all('#v option').length, 2, 'tts: voices listed'); T.has(t.q('#v').innerHTML, '&lt;b&gt;Bob', 'voice names are escaped');
    t.click('#go'); T.has(toastText(), 'Type some text first', 'tts: empty text asks for text'); T.eq(spoken.length, 0, 'nothing spoken for empty text');
    t.type('#t', '  Hello world  '); t.select('#v', '1'); t.type('#r', '1.5'); t.click('#go'); T.eq(spoken.length, 1, 'tts: speaks once'); T.eq(spoken[0].text, 'Hello world', 'text is trimmed'); T.eq(spoken[0].voice.name, '<b>Bob</b>', 'chosen voice is used'); T.eq(spoken[0].rate, 1.5, 'speed is used'); T.ok(cancels >= 1, 'queued speech is cancelled before speaking');
    const c0 = cancels; t.click('#st'); T.eq(cancels, c0 + 1, 'Stop cancels speech');
    w.speechSynthesis.voices = [{ name: 'Late', lang: 'fr' }]; w.speechSynthesis.onvoiceschanged(); T.eq(t.all('#v option').length, 1, 'voices that load late are picked up');
    const c1 = cancels; t.close(); T.eq(cancels, c1 + 1, 'tts: speech is cancelled on leave'); T.eq(w.speechSynthesis.onvoiceschanged, null, 'listener removed on leave');
    delete w.speechSynthesis;
  }

  /* ================= Speech to Text ================= */
  {
    let t = await page.open('stt'); T.has(t.q('#msg').textContent, 'not available', 'stt: no recognition gives a clear message'); T.ok(t.q('#go').disabled, 'Start is disabled without recognition'); t.close();
    const recs = [];
    w.webkitSpeechRecognition = class { constructor() { recs.push(this); this.started = 0; this.stopped = 0; this.aborted = 0; } start() { this.started++; } stop() { this.stopped++; } abort() { this.aborted++; } };
    t = await page.open('stt'); t.click('#go'); const r = recs[0]; T.eq(r.started, 1, 'stt: starts listening'); T.eq(t.q('#go').textContent, 'Stop', 'button says Stop'); T.eq(r.continuous, true, 'continuous');
    r.onresult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: 'hello' } }] }); r.onresult({ resultIndex: 1, results: [{ isFinal: true, 0: { transcript: 'hello' } }, { isFinal: false, 0: { transcript: 'wor' } }] }); T.eq(t.value('#t'), 'hello ', 'final results are appended; interim ones are not');
    r.onresult({ resultIndex: 1, results: [{ isFinal: true, 0: { transcript: 'hello' } }, { isFinal: true, 0: { transcript: 'world' } }] }); T.eq(t.value('#t'), 'hello world ', 'next sentence is appended');
    r.onerror({ error: 'not-allowed' }); T.has(t.q('#msg').textContent, 'permission was denied', 'denied message'); r.onerror({ error: 'no-speech' }); T.has(t.q('#msg').textContent, 'No speech', 'no-speech message'); r.onerror({ error: 'network' }); T.has(t.q('#msg').textContent, 'connection', 'network message'); r.onerror({ error: 'weird' }); T.has(t.q('#msg').textContent, 'weird', 'unknown error is shown');
    t.click('#go'); T.eq(r.stopped, 1, 'second tap stops'); r.onend(); T.eq(t.q('#go').textContent, 'Start listening', 'button resets when the engine ends'); t.click('#go'); T.eq(recs.length, 2, 'a fresh recogniser for the next session'); T.eq(recs[1].started, 1, 'started again');
    t.click('#cp'); await wait(10); T.has(toastText(), 'Copied', 'copy shows a toast'); T.eq(M.clipboard[0], 'hello world ', 'copied the text'); t.type('#t', ''); t.click('#cp'); T.has(toastText(), 'Nothing to copy', 'nothing to copy when empty');
    t.close(); T.eq(recs[1].aborted, 1, 'stt: recognition aborted on leave'); T.eq(recs[1].onend, null, 'handlers removed on leave');
    w.webkitSpeechRecognition = class { start() { throw new Error('InvalidStateError'); } }; t = await page.open('stt'); t.click('#go'); T.has(t.q('#msg').textContent, 'Could not start', 'a failing start is reported, not thrown'); T.eq(t.q('#go').textContent, 'Start listening', 'button stays Start'); t.close(); delete w.webkitSpeechRecognition;
  }

  /* ================= Sound Intensity ================= */
  {
    reset(); let level = 0.1; M.sig = (b) => b.fill(level); const b0 = M.live(); let t = await page.open('noise');
    await wait(800); T.eq(t.q('#db').textContent, '70', 'DC level 0.1 is 20 log10(0.1) + 90 = 70 dB'); T.eq(t.q('#mn').textContent, '70', 'min 70'); T.eq(t.q('#mx').textContent, '70', 'max 70');
    level = 0.5; await wait(100); T.eq(t.q('#db').textContent, '84', '0.5 is 84 dB (83.98)'); T.eq(t.q('#mx').textContent, '84', 'max follows'); level = 0.01; await wait(100); T.eq(t.q('#db').textContent, '50', '0.01 is 50 dB'); T.eq(t.q('#mn').textContent, '50', 'min follows'); T.eq(t.q('#mx').textContent, '84', 'max stays');
    level = 1e-7; await wait(100); T.eq(t.q('#db').textContent, '0', 'a very quiet room is shown as 0, never negative'); level = 0; await wait(60); T.eq(t.q('#db').textContent, '0', 'an empty frame is ignored');
    t.close(); await wait(50); T.eq(M.liveTracks().length, 0, 'noise: microphone released on leave'); T.eq(M.openCtxs().length, 0, 'noise: context closed on leave'); T.eq(M.live().frames, b0.frames, 'noise: no frame left');
    M.mode = 'denied'; t = await page.open('noise'); await wait(30); T.has(t.q('#msg').textContent, 'permission', 'noise denied: message'); T.has(t.q('#msg').textContent, 'Settings', 'says where to allow it'); t.close();
    M.mode = 'notfound'; t = await page.open('noise'); await wait(30); T.has(t.q('#msg').textContent, 'No microphone', 'noise: no microphone message'); t.close(); M.mode = 'ok';
    M.setNoMediaDevices(); t = await page.open('noise'); T.has(t.q('#msg').textContent, 'not available', 'noise: no mediaDevices'); t.close(); M.restoreMedia();
    M.delay = 40; t = await page.open('noise'); t.close(); await wait(100); T.eq(M.liveTracks().length, 0, 'noise: leaving during the permission prompt leaves nothing running'); T.eq(M.streams.length > 0, true, 'a stream was handed out and then stopped'); M.delay = 0;
  }

  /* ================= Flashlight ================= */
  {
    reset(); M.torch = true; let t = await page.open('flashlight');
    T.has(t.text(), 'Tap to switch on', 'flashlight: starts off'); t.click('#b'); await wait(30);
    T.eq(M.calls[0].video.facingMode, 'environment', 'asks for the rear camera'); T.eq(JSON.stringify(M.applied[0]), '{"advanced":[{"torch":true}]}', 'turns the torch on'); T.eq(t.q('#b').textContent, 'Turn off', 'button says Turn off'); T.eq(t.q('#msg').textContent, 'On', 'status On');
    t.click('#b'); T.eq(M.liveTracks().length, 0, 'turning off releases the camera'); T.has(t.q('#msg').textContent, 'Tap to switch on', 'status back'); T.eq(t.q('#b').textContent, 'Turn on', 'button back');
    M.delay = 30; M.calls.length = 0; t.click('#b'); t.click('#b'); await wait(90); T.eq(M.calls.length, 1, 'double tap uses one stream'); T.eq(M.liveTracks().length, 1, 'one live track'); M.delay = 0;
    M.streams[M.streams.length - 1].getVideoTracks()[0].fire('ended'); T.has(t.q('#msg').textContent, 'released', 'if the camera is taken away the torch is shown as off'); T.eq(t.q('#b').textContent, 'Turn on', 'button back after the camera is taken away');
    t.click('#b'); await wait(30); t.close(); T.eq(M.liveTracks().length, 0, 'flashlight: leaving while on releases the camera');
    M.delay = 40; t = await page.open('flashlight'); t.click('#b'); t.close(); await wait(120); T.eq(M.liveTracks().length, 0, 'leaving during the permission prompt leaves nothing running'); M.delay = 0;
    M.torch = false; t = await page.open('flashlight'); t.click('#b'); await wait(30); T.has(t.q('#msg').textContent, 'Torch is not available', 'a phone without a torch says so'); T.eq(M.liveTracks().length, 0, 'and the camera is released'); t.close();
    M.torch = true; M.torchFail = true; t = await page.open('flashlight'); t.click('#b'); await wait(30); T.has(t.q('#msg').textContent, 'Torch is not available', 'a torch that refuses is reported'); T.eq(M.liveTracks().length, 0, 'and the camera is released'); t.close(); M.torchFail = false;
    M.mode = 'denied'; t = await page.open('flashlight'); t.click('#b'); await wait(30); T.has(t.q('#msg').textContent, 'permission', 'denied camera: message'); T.has(t.q('#msg').textContent, 'Settings', 'says where to allow it'); T.eq(t.q('#b').textContent, 'Turn on', 'can retry'); t.close(); M.mode = 'ok';
    M.setNoMediaDevices(); t = await page.open('flashlight'); t.click('#b'); T.has(t.q('#msg').textContent, 'not available', 'no camera API'); t.close(); M.restoreMedia();
  }

  /* ================= Paint ================= */
  {
    w.Element.prototype.setPointerCapture = function () {};
    const calls = []; const ctx = new Proxy({}, { get: (t2, k) => { if (k in t2) return t2[k]; if (k === 'getImageData') return (...a) => { calls.push(['getImageData']); return { data: new Uint8ClampedArray(4), tag: calls.length }; }; return (...a) => { calls.push([String(k), ...a]); }; }, set: (t2, k, v) => { t2[k] = v; return true; } });
    w.HTMLCanvasElement.prototype.getContext = () => ctx;
    const t = await page.open('paint'); const cv = t.q('#c'); cv.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 400 });
    const n = (name) => calls.filter(c => c[0] === name).length;
    T.eq(JSON.stringify(calls.find(c => c[0] === 'fillRect')), '["fillRect",0,0,800,800]', 'paint: canvas starts white');
    ptr(cv, 'pointerdown', 100, 50); ptr(cv, 'pointermove', 150, 60); ptr(cv, 'pointerup'); T.ok(calls.some(c => c[0] === 'moveTo' && c[1] === 200 && c[2] === 100), 'touch (100,50) on a 400 px wide view draws at (200,100) on the 800 px canvas'); T.eq(ctx.strokeStyle, '#0f766e', 'default colour'); T.eq(ctx.lineWidth, 6, 'default size 6');
    t.type('#col', '#ff0000'); t.type('#sz', '20'); ptr(cv, 'pointerdown', 10, 10); ptr(cv, 'pointerup'); T.eq(ctx.strokeStyle, '#ff0000', 'colour changes'); T.eq(ctx.lineWidth, 20, 'size changes');
    t.click('#er'); T.eq(t.q('#er').textContent, 'Pen', 'Eraser toggles to Pen'); ptr(cv, 'pointerdown', 10, 10); ptr(cv, 'pointerup'); T.eq(ctx.strokeStyle, '#fff', 'eraser paints white'); t.click('#er'); T.eq(t.q('#er').textContent, 'Eraser', 'back to Eraser');
    const g0 = n('getImageData'), p0 = n('putImageData'); t.click('#un'); T.eq(n('putImageData'), p0 + 1, 'Undo restores the previous picture'); T.eq(g0 >= 3, true, 'a snapshot is taken before each stroke');
    for (let i = 0; i < 25; i++) { ptr(cv, 'pointerdown', 5, 5); ptr(cv, 'pointerup'); } const p1 = n('putImageData'); for (let i = 0; i < 40; i++) t.click('#un'); T.eq(n('putImageData') - p1, 15, 'undo history keeps the last 15 steps');
    const f0 = n('fillRect'); t.click('#cl'); T.eq(n('fillRect'), f0 + 1, 'Clear paints the canvas white'); const p2 = n('putImageData'); t.click('#un'); T.eq(n('putImageData'), p2 + 1, 'Clear can be undone');
    // saving goes through Filesystem + Share on the phone
    w.eval("window.__sh = []; window.__fs = []; window.Capacitor = { Plugins: { Filesystem: { writeFile: async o => { __fs.push(o.path); return { uri: 'file:///c/' + o.path }; }, appendFile: async () => {}, deleteFile: async () => {} }, Share: { share: async o => { __sh.push(o); } } } };");
    t.click('#sv'); await wait(100); T.eq(w.__sh.length, 1, 'Save opens the share sheet'); T.ok(/^drawing-\d+\.png$/.test(w.__fs[0]), 'saved as drawing-<time>.png: ' + w.__fs[0]); w.eval('delete window.Capacitor');
    t.click('#sv'); await wait(100); T.has(toastText(), 'Saved', 'without the phone plugins Save downloads and says Saved'); T.ok(/^drawing-\d+\.png$/.test((M.downloads[0] || {}).name || ''), 'the download is named drawing-<time>.png');
    t.close();
  }

  /* ================= Improvements: remembered voice, noise reset, paint colours ================= */
  {
    const spoken = [];
    w.speechSynthesis = { voices: [{ name: 'Hans', lang: 'de-DE' }, { name: 'Zoe', lang: 'fr-FR' }, { name: 'Ann', lang: 'en-GB' }], getVoices() { return this.voices; }, speak(u) { spoken.push(u); }, cancel() {}, onvoiceschanged: null };
    w.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
    let t = await page.open('tts'); T.eq(t.value('#v'), '2', 'tts: the voice matching the phone language (en) is chosen by default'); t.select('#v', '1'); t.type('#r', '1.5'); t.close();
    t = await page.open('tts'); T.eq(t.value('#v'), '1', 'tts remembers the chosen voice'); T.eq(t.value('#r'), '1.5', 'and the speed'); t.type('#t', 'Hi'); t.click('#go'); T.eq(spoken[0].voice.name, 'Zoe', 'and speaks with it'); t.close();
    w.speechSynthesis.voices = [{ name: 'Only', lang: 'xx' }]; w.localStorage.setItem('pk.tts.rate', '"fast"'); t = await page.open('tts'); T.eq(t.value('#v'), '0', 'a remembered voice that no longer exists falls back to the first voice'); T.eq(t.value('#r'), '1', 'a corrupt remembered speed is ignored'); t.close();
    w.speechSynthesis.voices = []; t = await page.open('tts'); T.eq(t.all('#v option').length, 1, 'tts: with no voices listed the box offers the default voice'); t.type('#t', 'Hi'); t.click('#go'); T.eq(spoken.slice(-1)[0].text, 'Hi', 'and still speaks'); t.close();
    reset(); let level = 0.1; M.sig = (b) => b.fill(level); t = await page.open('noise'); await wait(800); level = 0.5; await wait(100); T.eq(t.q('#mx').textContent, '84', 'max before reset'); t.click('#rs'); T.eq(t.q('#mn').textContent + t.q('#mx').textContent, '----', 'Reset clears min and max'); await wait(100); T.eq(t.q('#mn').textContent + ',' + t.q('#mx').textContent, '84,84', 'and they start again from the next reading'); t.close();
    // paint
    w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => ({ data: new Uint8ClampedArray(4) }), set: () => true });
    t = await page.open('paint'); T.eq(t.all('#pal button').length, 8, 'paint: eight quick colours'); T.ok(t.all('#pal button').every(b => b.getAttribute('aria-label').startsWith('Colour #')), 'each is labelled'); t.click('#er'); T.eq(t.q('#er').textContent, 'Pen', 'eraser on'); t.q('#pal button[data-c="#ef4444"]').click(); T.eq(t.value('#col'), '#ef4444', 'a swatch sets the brush colour'); T.eq(t.q('#er').textContent, 'Eraser', 'and switches the eraser off'); t.type('#sz', '25'); t.close();
    t = await page.open('paint'); T.eq(t.value('#col'), '#ef4444', 'paint remembers the colour'); T.eq(t.value('#sz'), '25', 'and the brush size'); t.close();
    w.localStorage.setItem('pk.paint.col', '"red;x"'); w.localStorage.setItem('pk.paint.sz', '"big"'); t = await page.open('paint'); T.eq(t.value('#col'), '#0f766e', 'a corrupt remembered colour is ignored'); T.eq(t.value('#sz'), '6', 'and size'); t.close();
  }


  await T.done(page);
})();
