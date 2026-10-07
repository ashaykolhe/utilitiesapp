'use strict';
/* Functional tests for the camera tools, part 1: Magnifier, Colour Detector, Night Cam, Blank Cam, Motion Cam, Mirror.
   The fakes hand out streams whose tracks count stop() calls; every tool must release them when left. */
const { bootMedia } = require('../helpers/media-fakes');
const { suite } = require('../helpers/page');

(async () => {
  const T = suite('camera'), { page, M } = await bootMedia();
  const w = page.w, wait = page.wait;
  const pro = (on) => page.eval('setPro(' + (on ? 'true' : 'false') + ')');
  const toastText = () => w.document.querySelector('#toast').textContent;
  const reset = () => { M.mode = 'ok'; M.delay = 0; M.torch = false; M.torchFail = false; M.zoom = null; M.failAudio = false; M.calls.length = 0; M.applied.length = 0; M.vw = 0; M.vh = 0; M.pixels = null; M.downloads.length = 0; M.canvasCalls.length = 0; M.confirmAnswer = true; M.wake.requests = M.wake.released = 0; w.document.querySelector('#toast').textContent = ''; };
  const leaves = async (t, b0, label) => {
    t.close(); await wait(150);
    T.eq(M.liveTracks().length, 0, label + ': every camera track is stopped after leaving');
    const b = M.live(); T.eq(b.intervals, b0.intervals, label + ': no interval left running'); T.eq(b.frames, b0.frames, label + ': no animation frame left');
  };
  const ptr = (el, type, x, y, id) => { const e = new w.MouseEvent(type, { bubbles: true, clientX: x || 0, clientY: y || 0 }); Object.defineProperty(e, 'pointerId', { value: id || 1 }); el.dispatchEvent(e); };
  const fileName = () => (M.downloads[M.downloads.length - 1] || {}).name || '';

  /* ================= Magnifier ================= */
  {
    reset(); const b0 = M.live(); let t = await page.open('magnifier'); await wait(30);
    const v0 = M.calls[0].video; T.eq(v0.facingMode.ideal, 'environment', 'magnifier: rear camera requested'); T.eq(M.calls[0].audio, false, 'no microphone requested'); T.eq(t.q('#msg').textContent, '', 'no message when the camera works');
    T.eq(t.q('#tc').style.display, 'none', 'torch button hidden when the camera has no torch'); T.eq(t.q('#z').max, '8', 'without hardware zoom the slider offers 1x to 8x (digital)');
    t.type('#z', '3'); T.eq(t.q('#v').style.transform, 'scale(3)', 'digital zoom scales the picture'); T.eq(t.q('#zl').textContent, '3.0×', 'zoom label');
    t.type('#br', '1.5'); t.type('#co', '2'); T.has(t.q('#v').style.filter, 'brightness(1.5)', 'brightness applied live'); T.has(t.q('#v').style.filter, 'contrast(2)', 'contrast applied live');
    t.click('#fr'); T.eq(t.q('#fr').textContent, 'Unfreeze', 'Freeze toggles'); t.click('#fr'); T.eq(t.q('#fr').textContent, 'Freeze', 'and back');
    t.click('#sv'); T.has(toastText(), 'Camera is not ready', 'saving before the picture is ready says so'); T.eq(M.downloads.length, 0, 'nothing saved');
    M.vw = 640; M.vh = 480; t.click('#sv'); await wait(50); T.ok(/^magnifier-\d{8}-\d{6}\.jpg$/.test(fileName()), 'snapshot saved as magnifier-<date>-<time>.jpg: ' + fileName());
    const dr = M.canvasCalls.filter(c => c[0] === 'drawImage').pop(), cw = 640 / 3; T.near(dr[2], (640 - cw) / 2, 1e-9, 'saved picture is the zoomed centre: x offset'); T.near(dr[3], 160, 1e-9, 'y offset'); T.near(dr[4], cw, 1e-9, 'width 640/3'); T.near(dr[5], 160, 1e-9, 'height 480/3'); T.eq(dr.slice(8).join(','), '213,160', 'output size');
    await leaves(t, b0, 'magnifier');
    // hardware zoom and torch
    reset(); M.zoom = { min: 1, max: 10, step: 0.1 }; M.torch = true; t = await page.open('magnifier'); await wait(30);
    T.eq(t.q('#z').max, '10', 'hardware zoom range is used'); t.type('#z', '4'); T.eq(JSON.stringify(M.applied.pop()), '{"advanced":[{"zoom":4}]}', 'zoom is sent to the camera'); T.eq(t.q('#v').style.transform, 'scale(1)', 'no extra digital scaling');
    T.eq(t.q('#tc').style.display, '', 'torch button shown'); t.click('#tc'); await wait(10); T.eq(JSON.stringify(M.applied.pop()), '{"advanced":[{"torch":true}]}', 'torch on'); T.eq(t.q('#tc').textContent, 'Torch off', 'label'); t.click('#tc'); await wait(10); T.eq(t.q('#tc').textContent, 'Torch', 'torch off again');
    M.torchFail = true; t.click('#tc'); await wait(10); T.has(toastText(), 'Torch is not available', 'a refusing torch is reported'); T.eq(t.q('#tc').textContent, 'Torch', 'label stays Torch');
    await leaves(t, b0, 'magnifier (zoom, torch)');
    // permission problems
    for (const [mode, text] of [['denied', 'permission was denied'], ['notfound', 'No camera was found'], ['busy', 'camera is busy']]) { reset(); M.mode = mode; t = await page.open('magnifier'); await wait(20); T.has(t.q('#msg').textContent, text, 'magnifier ' + mode + ': message'); if (mode === 'denied') T.has(t.q('#msg').textContent, 'Settings', 'denied message says where to allow it'); t.close(); }
    reset(); const ns0 = M.streams.length; M.mode = 'overconstrained'; t = await page.open('magnifier'); await wait(40); T.eq(M.streams.length - ns0, 1, 'a camera that rejects the size request is retried with plain video'); T.eq(t.q('#msg').textContent, '', 'and works'); await leaves(t, b0, 'magnifier (overconstrained)');
    reset(); M.delay = 40; t = await page.open('magnifier'); t.close(); await wait(100); T.eq(M.liveTracks().length, 0, 'magnifier: leaving during the permission prompt leaves no track running');
    reset(); M.setNoMediaDevices(); t = await page.open('magnifier'); await wait(20); T.has(t.q('#msg').textContent, 'no camera support', 'no camera API message'); t.close(); M.restoreMedia();
  }

  /* ================= Colour Detector ================= */
  {
    reset(); const b0 = M.live(); M.vw = 640; M.vh = 480; let col = [255, 0, 0]; M.pixels = (wd, ht) => { const a = new Uint8ClampedArray(wd * ht * 4); for (let i = 0; i < a.length; i += 4) { a[i] = col[0]; a[i + 1] = col[1]; a[i + 2] = col[2]; a[i + 3] = 255; } return a; };
    w.localStorage.removeItem('pk.colordetect.history'); let t = await page.open('colordetect'); await wait(350);
    T.eq(t.q('#hx').textContent, '#FF0000', 'pure red is #FF0000'); T.eq(t.q('#rgb').textContent, 'rgb(255, 0, 0)', 'rgb text'); T.eq(t.q('#nm').textContent, 'Red', 'named Red');
    col = [0, 128, 0]; await wait(300); T.eq(t.q('#hx').textContent, '#008000', 'live update to green'); T.eq(t.q('#nm').textContent, 'Green', 'named Green');
    t.click('#v'); T.eq(t.q('#lock').textContent, 'Unlock', 'tapping the picture locks'); T.eq(t.q('#lk').style.display, '', '"Locked" badge shown'); col = [0, 0, 255]; await wait(300); T.eq(t.q('#hx').textContent, '#008000', 'locked colour does not change');
    T.eq(JSON.stringify(JSON.parse(w.localStorage.getItem('pk.colordetect.history'))), '["#008000"]', 'locked colour saved to the history'); T.eq(t.all('#hist button').length, 1, 'one swatch'); T.has(t.q('#hist button').getAttribute('aria-label'), '#008000', 'swatch is labelled');
    t.click('#lock'); await wait(300); T.eq(t.q('#hx').textContent, '#0000FF', 'unlocking resumes'); t.click('#lock'); t.click('#lock'); t.click('#lock'); T.eq(t.all('#hist button').length, 2, 'a new colour adds a swatch and locking the same colour twice keeps it once');
    t.click('#cp'); await wait(10); T.eq(M.clipboard[M.clipboard.length - 1], '#0000FF', 'Copy HEX copies the colour'); t.click('#hist button'); await wait(10); T.eq(M.clipboard[M.clipboard.length - 1], '#0000FF', 'tapping a swatch copies it (newest first)');
    for (let i = 0; i < 15; i++) { t.click('#lock'); col = [i * 16, 10, 10]; await wait(200); t.click('#lock'); } T.ok(t.all('#hist button').length <= 12, 'history keeps at most 12 colours (' + t.all('#hist button').length + ')');
    t.click('#clr'); T.eq(t.all('#hist button').length, 0, 'Clear history empties it'); T.has(t.q('#hist').textContent, 'Nothing yet', 'and shows the empty state');
    await leaves(t, b0, 'colordetect');
    reset(); M.mode = 'denied'; t = await page.open('colordetect'); await wait(20); T.has(t.q('#msg').textContent, 'permission was denied', 'colour detector denied: message'); T.eq(M.live().intervals, b0.intervals, 'no sampling timer without a camera'); t.close();
  }

  /* ================= Night Cam ================= */
  {
    reset(); const b0 = M.live(); M.vw = 640; M.vh = 480; M.pixels = (wd, ht) => { const a = new Uint8ClampedArray(wd * ht * 4); for (let i = 0; i < a.length; i += 4) { a[i] = 100; a[i + 1] = 150; a[i + 2] = 200; a[i + 3] = 255; } return a; };
    let t = await page.open('nightcam'); await wait(120);
    T.eq(t.q('#brL').textContent, '2', 'brightness label'); T.eq(t.q('#coL').textContent, '1.3', 'contrast label'); T.eq(t.q('#gaL').textContent, '1.6', 'gamma label'); T.eq(t.q('#cv').width + 'x' + t.q('#cv').height, '480x360', 'preview is drawn at 480 px wide');
    // tint maths: LUT gamma 1.6, luma 0.3/0.59/0.11, green tint = (0.15 l, 1.1 l, 0.25 l)
    const lut = (x) => 255 * Math.pow(x / 255, 1 / 1.6), r = lut(100), g = lut(150), b = lut(200), l = 0.3 * r + 0.59 * g + 0.11 * b, d = t.q('#cv').__put.data;
    T.eq(d[0] + ',' + d[1] + ',' + d[2], Math.round(l * 0.15) + ',' + Math.round(Math.min(255, l * 1.1)) + ',' + Math.round(l * 0.25), 'night-vision tint pixel = gamma, luma, then green tint');
    t.check('#gr', false); await wait(80); const d2 = t.q('#cv').__put.data; T.eq(Math.round(d2[0]) + ',' + Math.round(d2[1]) + ',' + Math.round(d2[2]), Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b), 'without the tint only gamma is applied');
    t.type('#ga', '1'); t.check('#gr', false); await wait(60); const calls = M.canvasCalls.length; await wait(60); T.ok(M.canvasCalls.length > calls, 'preview keeps updating');
    t.click('#sv'); await wait(40); T.eq(M.canvases.slice(-1)[0].width + 'x' + M.canvases.slice(-1)[0].height, '640x480', 'the photo is captured at full camera size'); T.ok(/^night-\d{8}-\d{6}\.jpg$/.test(fileName()), 'saved as night-<date>-<time>.jpg: ' + fileName());
    await leaves(t, b0, 'nightcam');
    reset(); t = await page.open('nightcam'); await wait(30); t.click('#sv'); T.has(toastText(), 'Camera is not ready', 'night cam: capture before video is ready says so'); t.close();
    reset(); M.mode = 'denied'; t = await page.open('nightcam'); await wait(20); T.has(t.q('#msg').textContent, 'permission was denied', 'night cam denied: message'); t.close();
  }

  /* ================= Blank Cam ================= */
  {
    reset(); const b0 = M.live(); let t = await page.open('blankcam'); await wait(20);
    T.eq(M.calls.length, 0, 'blankcam: nothing starts until Start is pressed'); T.has(t.text(), 'may be illegal', 'consent warning is shown');
    M.mode = 'denied'; t.click('#go'); await wait(30); T.has(t.q('#msg').textContent, 'permission was denied', 'blankcam denied: message'); T.ok(!t.q('#go').disabled, 'Start usable again'); M.mode = 'ok';
    M.delay = 20; M.calls.length = 0; t.click('#go'); t.click('#go'); await wait(80); T.eq(M.calls.length, 1, 'blankcam: double tap starts one recording'); T.eq(M.recorders.length >= 1, true, 'recorder created'); const rec = M.recorders[M.recorders.length - 1]; T.eq(rec.state, 'recording', 'recording');
    T.eq(M.calls[0].audio, true, 'sound is recorded by default'); T.ok(!!w.document.querySelector('[aria-label="Stop recording"]'), 'black screen overlay with a Stop button'); T.eq(M.wake.requests, 1, 'screen kept awake while recording'); M.delay = 0;
    w.document.querySelector('[aria-label="Stop recording"]').click(); await wait(60);
    T.eq(M.liveTracks().length, 0, 'blankcam: camera and microphone released after Stop'); T.ok(!w.document.querySelector('[aria-label="Stop recording"]'), 'overlay removed'); T.eq(M.wake.released, 1, 'wake lock released'); T.has(t.q('#res').textContent, 'Recording ready', 'result card shown'); T.has(t.q('#res').innerHTML, '<video', 'with a player');
    t.click('#res #sv'); await wait(20); T.ok(/^blankcam-\d{8}-\d{6}\.webm$/.test(fileName()), 'video saved as blankcam-<date>-<time>.webm: ' + fileName());
    // the microphone being refused must not stop the recording
    M.failAudio = true; M.calls.length = 0; t.click('#go'); await wait(60); T.eq(M.calls.length, 2, 'asked for video+sound, then video only'); T.has(t.q('#msg').textContent, 'recording without sound', 'tells the user the sound is off'); T.eq(M.recorders[M.recorders.length - 1].state, 'recording', 'and still records');
    // leaving while recording keeps the video
    M.downloads.length = 0; t.close(); await wait(100); T.eq(M.liveTracks().length, 0, 'blankcam: leaving mid-recording releases the camera'); T.ok(!w.document.querySelector('[aria-label="Stop recording"]'), 'overlay removed on leave'); T.ok(/^blankcam-.*\.webm$/.test(fileName()), 'the recording is handed over to be saved, not lost'); T.eq(M.live().intervals, b0.intervals, 'no timer left');
    M.failAudio = false;
    t = await page.open('blankcam'); t.check('#au', false); t.select('#fc', 'user'); M.calls.length = 0; t.click('#go'); await wait(40); T.eq(M.calls[0].audio, false, 'sound can be switched off'); T.eq(M.calls[0].video.facingMode.ideal, 'user', 'front camera can be chosen'); M.recorders[M.recorders.length - 1].data = null; w.document.querySelector('[aria-label="Stop recording"]').click(); await wait(60); T.has(t.q('#msg').textContent, 'Nothing was recorded', 'an empty recording says so'); T.eq(M.liveTracks().length, 0, 'and releases the camera'); t.close();
    const MR = w.MediaRecorder; delete w.MediaRecorder; t = await page.open('blankcam'); t.click('#go'); await wait(20); T.has(t.q('#msg').textContent, 'not supported', 'no MediaRecorder: message'); T.eq(M.liveTracks().length, 0, 'and no camera opened'); t.close(); w.MediaRecorder = MR;
  }

  /* ================= Motion Cam ================= */
  {
    reset(); pro(false); let t = await page.open('motioncam'); T.has(t.text(), 'Pro feature', 'motion cam: free users see the Pro notice'); T.eq(M.calls.length, 0, 'no camera is opened without Pro'); t.close();
    pro(true); const b0 = M.live(); M.vw = 640; M.vh = 480; let k = 0, mode = 'small'; M.pixels = (wd, ht) => { const n = wd * ht, a = new Uint8ClampedArray(n * 4), flip = (k++) % 2, cnt = mode === 'small' ? Math.round(n * 0.03) : Math.round(n * 0.1); for (let i = 0; i < n; i++) { const v = i < cnt && flip ? 220 : 90; a[i * 4] = a[i * 4 + 1] = a[i * 4 + 2] = v; a[i * 4 + 3] = 255; } return a; };
    t = await page.open('motioncam'); await wait(40); T.eq(M.calls.length, 1, 'camera opens on entering the tool'); T.eq(t.q('#mot').textContent, 'Idle', 'idle'); T.has(t.q('#log').textContent, 'No motion logged yet', 'empty log');
    t.click('#go'); await wait(20); T.eq(t.q('#go').textContent, 'Stop watching', 'watching'); T.eq(t.q('#mot').textContent, 'Watching', 'badge'); T.eq(M.wake.requests, 1, 'screen kept awake');
    await wait(2700); T.eq(t.all('#log .item').length, 0, '3% of the frame changing is below the default sensitivity (and nothing triggers while arming)');
    mode = 'big'; await wait(1300); T.eq(t.all('#log .item').length, 1, '10% of the frame changing logs a snapshot'); T.has(t.q('#log').textContent, '10% of the frame moved', 'with the share of the frame that moved'); await wait(1500); T.eq(t.all('#log .item').length, 1, 'no second entry within the 3 s cool-down');
    t.click('#log button'); await wait(30); T.ok(/^motion-\d{8}-\d{6}\.jpg$/.test(fileName()), 'snapshot saved: ' + fileName());
    t.click('#cl'); T.has(t.q('#log').textContent, 'No motion logged yet', 'Clear log empties the list');
    t.click('#go'); T.eq(t.q('#go').textContent, 'Start watching', 'stopped'); T.eq(M.wake.released >= 1, true, 'wake lock released'); t.click('#go'); await wait(20);
    await leaves(t, b0, 'motioncam'); pro(false);
  }

  /* ================= Mirror ================= */
  {
    reset(); const b0 = M.live(); let t = await page.open('mirror'); await wait(30);
    T.eq(M.calls[0].video.facingMode.ideal, 'user', 'mirror: front camera first'); T.has(t.q('#v').style.transform, 'scaleX(-1)', 'picture is mirrored'); T.eq(t.q('#z').max, '8', 'zoom range is set from the camera (digital 1x to 8x when it has no zoom)');
    t.type('#z', '2'); T.has(t.q('#v').style.transform, 'scale(2)', 'zoom scales'); t.type('#br', '1.5'); T.has(t.q('#v').style.filter, 'brightness(1.5)', 'brightness');
    t.click('#sw'); await wait(30); T.eq(M.calls[1].video.facingMode.ideal, 'environment', 'switching asks for the rear camera'); T.eq(M.liveTracks().length, 1, 'the front camera is released when switching'); T.ok(!/scaleX\(-1\)/.test(t.q('#v').style.transform), 'rear camera picture is not mirrored'); T.eq(t.q('#sw').textContent, 'Use front camera', 'label');
    t.click('#sw'); await wait(30); T.eq(M.liveTracks().length, 1, 'still one camera after switching back'); t.click('#fr'); T.eq(t.q('#fr').textContent, 'Unfreeze', 'freeze'); t.click('#sw'); await wait(30); T.eq(t.q('#fr').textContent, 'Freeze', 'switching camera unfreezes');
    await leaves(t, b0, 'mirror');
    reset(); M.mode = 'denied'; t = await page.open('mirror'); await wait(20); T.has(t.q('#msg').textContent, 'permission was denied', 'mirror denied: message'); t.close();
  }

  /* ================= Remembered settings ================= */
  {
    reset(); let t = await page.open('nightcam'); t.type('#br', '3'); t.type('#ga', '2.5'); t.check('#gr', false); t.close();
    t = await page.open('nightcam'); T.eq(t.value('#br') + ',' + t.value('#ga') + ',' + t.q('#gr').checked, '3,2.5,false', 'night cam remembers brightness, gamma and the tint'); T.eq(t.q('#brL').textContent, '3', 'labels follow the restored values'); t.close();
  }


  /* ================= Pro gating of the audio and camera tools ================= */
  {
    reset(); pro(false); page.eval('window.__proAsked = []; openPro = function (k) { window.__proAsked.push(k); }');
    const want = { spectrum: 'audio', drumpad: 'audio', player: 'audio', toneseq: 'audio', blankcam: 'camera', docscan: 'camera', timelapse: 'camera', collage: 'camera', photofx: 'camera', motioncam: 'motion', stopmotion: 'motion' };
    for (const id of Object.keys(want)) { w.__proAsked.length = 0; page.eval('openTool(' + JSON.stringify(id) + ')'); T.eq(w.__proAsked.join(), want[id], id + ': a free user opening it gets the Pro sheet for "' + want[id] + '"'); }
    T.eq(M.calls.length, 0, 'no camera or microphone is touched by locked tools');
    const free = ['metronome', 'tonegen', 'tuner', 'mike', 'recorder', 'piano', 'sleepsounds', 'eartest', 'binaural', 'stereotest', 'speakerclean', 'dogwhistle', 'chords', 'clapcounter', 'vocalrange', 'pitchpipe', 'tts', 'stt', 'noise', 'flashlight', 'paint', 'magnifier', 'colordetect', 'nightcam', 'mirror', 'codescan', 'gridcam', 'timercam', 'imgshrink', 'imgconvert', 'exifclean', 'eyedrop', 'pixelruler'];
    T.ok(free.every(id => !page.eval('Tools.get(' + JSON.stringify(id) + ').pro')), 'every other audio and camera tool is free');
  }

  /* ================= Saving on the phone: Filesystem + Share, in pieces ================= */
  {
    reset(); const b0 = M.live(); const t = await page.open('magnifier'); await wait(30); M.vw = 640; M.vh = 480; M.blobSize = 7 * 1024 * 1024;
    w.eval("window.__w = []; window.__a = []; window.__s = []; window.__d = []; window.Capacitor = { Plugins: { Filesystem: { writeFile: async o => { __w.push([o.path, o.directory, o.data.length]); return { uri: 'file:///cache/' + o.path }; }, appendFile: async o => { __a.push([o.path, o.data.length]); }, deleteFile: async o => { __d.push(o.path); } }, Share: { share: async o => { __s.push(o); } } } };");
    t.click('#sv'); await wait(400); T.eq(w.__w.length, 1, 'save: one writeFile'); T.eq(w.__w[0][1], 'CACHE', 'into the cache folder'); T.eq(w.__a.length, 2, 'a 7 MB picture is written as 1 + 2 pieces (3 MB each)'); T.eq(w.__s.length, 1, 'then shared once'); T.eq(w.__s[0].url, 'file:///cache/' + w.__w[0][0], 'with the file address'); T.ok(/^magnifier-\d{8}-\d{6}\.jpg$/.test(w.__w[0][0]), 'named magnifier-<date>-<time>.jpg'); T.eq(M.downloads.length, 0, 'no browser download when the phone plugins exist');
    w.eval("window.Capacitor.Plugins.Filesystem.writeFile = async () => { throw new Error('disk full'); }; window.__s.length = 0;"); t.click('#sv'); await wait(300); T.eq(w.__s.length, 0, 'if writing fails nothing is shared'); T.eq(M.downloads.length, 1, 'and it falls back to a normal download');
    w.eval('delete window.Capacitor'); M.blobSize = 3; await leaves(t, b0, 'magnifier (saving)');
  }


  /* ================= Edge cases ================= */
  {
    reset(); const b0 = M.live(); let t = await page.open('mirror'); await wait(30); t.click('#sw'); t.click('#sw'); t.click('#sw'); await wait(80);
    T.eq(M.liveTracks().length, 1, 'mirror: three quick camera switches leave exactly one camera open'); T.eq(t.q('#sw').textContent, 'Use front camera', 'and the label matches the last switch (rear)'); await leaves(t, b0, 'mirror (rapid switching)');
    reset(); M.delay = 40; t = await page.open('blankcam'); t.click('#go'); t.close(); await wait(150); T.eq(M.liveTracks().length, 0, 'blankcam: leaving during the permission prompt leaves no camera or microphone running'); T.eq(M.recorders.length > 0 ? M.recorders.slice(-1)[0].state !== 'recording' : true, true, 'and no recording started');
    reset(); pro(true); M.delay = 40; t = await page.open('motioncam'); t.close(); await wait(100); T.eq(M.liveTracks().length, 0, 'motioncam: leaving during the permission prompt leaves no camera running'); pro(false);
  }


  await T.done(page);
})();
