'use strict';
/* Functional tests for the camera tools, Stop Motion.
   The fakes hand out streams whose tracks count stop() calls; every tool must release them when left. */
const { bootMedia } = require('../helpers/media-fakes');
const { suite } = require('../helpers/page');

(async () => {
  const T = suite('stopmotion'), { page, M } = await bootMedia();
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

  /* ================= Stop Motion ================= */
  {
    reset(); pro(false); let t = await page.open('stopmotion'); T.has(t.text(), 'Pro feature', 'stop motion: free users see the Pro notice'); T.eq(M.calls.length, 0, 'no camera without Pro'); t.close();
    pro(true); const b0 = M.live(); const revoked = []; w.URL.revokeObjectURL = (u) => revoked.push(u);
    t = await page.open('stopmotion'); await wait(30); T.has(t.q('#fl').textContent, 'No frames yet', 'empty state explains what to do');
    t.click('#cap'); await wait(20); T.has(toastText(), 'Camera is not ready', 'capture before the picture is ready says so');
    M.vw = 640; M.vh = 480; for (let i = 0; i < 3; i++) { t.click('#cap'); await wait(20); }
    T.eq(t.all('#fl .item').length, 3, 'three frames'); T.eq(t.q('#st').textContent, '3 frames, about 0.4 s at 8 fps', 'duration = frames / fps (3/8 = 0.4 s)'); t.type('#fp', '24'); T.eq(t.q('#st').textContent, '3 frames, about 0.1 s at 24 fps', 'speed change updates the duration'); T.eq(t.q('#fpL').textContent, '24 fps', 'speed label');
    const onion = () => t.q('#onion').src, urls = () => { const u = []; return u; };
    const u3 = onion(); T.has(u3, 'blob:fake/', 'onion skin shows the last frame'); t.all('#fl .item')[2].querySelector('[data-a=up]').click(); T.ok(onion() !== u3, 'moving the last frame earlier changes which frame is the onion skin'); t.all('#fl .item')[1].querySelector('[data-a=dn]').click(); T.eq(onion(), u3, 'moving it back restores it');
    t.all('#fl .item')[0].querySelector('[data-a=up]').click(); T.eq(t.all('#fl .item').length, 3, 'moving the first frame earlier does nothing');
    t.all('#fl .item')[0].querySelector('[data-a=rm]').click(); T.eq(t.all('#fl .item').length, 2, 'frame deleted'); T.eq(revoked.length, 1, 'its picture URL is released');
    // playback cycles through the frames
    t.click('#cap'); await wait(20); t.click('#play'); T.eq(t.q('#play').textContent, 'Stop', 'playing'); const seen = new Set(); for (let i = 0; i < 12; i++) { await wait(45); seen.add(t.q('#pv').src); } T.eq(seen.size, 3, 'playback shows all three frames'); T.eq(t.q('#pv').style.display, '', 'preview visible'); t.click('#cap'); T.eq(t.all('#fl .item').length, 3, 'capturing is ignored while playing'); t.click('#play'); T.eq(t.q('#pv').style.display, 'none', 'Stop hides the preview'); T.eq(M.live().intervals, b0.intervals + 0, 'playback timer stopped');
    M.confirmAnswer = false; t.click('#clr'); T.eq(t.all('#fl .item').length, 3, 'Delete all asks first; Cancel keeps the frames'); M.confirmAnswer = true;
    // export
    t.type('#fp', '24'); M.downloads.length = 0; t.click('#ex'); t.click('#ex'); await wait(700); T.eq(M.downloads.length, 1, 'export runs once for a double tap'); T.ok(/^stopmotion-\d{8}-\d{6}\.webm$/.test(fileName()), 'video saved as stopmotion-<date>-<time>.webm: ' + fileName());
    const cs = w.HTMLCanvasElement.prototype.captureStream; delete w.HTMLCanvasElement.prototype.captureStream; t.click('#ex'); await wait(40); T.has(toastText(), 'not supported', 'a phone without video export says so'); w.HTMLCanvasElement.prototype.captureStream = cs;
    t.click('#clr'); T.eq(t.all('#fl .item').length, 0, 'Delete all removes every frame after confirming'); t.click('#play'); T.has(toastText(), 'at least 2', 'Play needs two frames'); t.click('#ex'); T.has(toastText(), 'at least 2', 'Export needs two frames');
    for (let i = 0; i < 300; i++) { t.click('#cap'); await wait(0); } await wait(40); t.click('#cap'); await wait(20); T.eq(t.all('#fl .item').length, 300, 'frames are capped at 300'); T.has(toastText(), 'Frame limit reached (300)', 'limit message');
    revoked.length = 0; await leaves(t, b0, 'stopmotion'); T.eq(revoked.length, 300, 'every frame URL is released on leave'); w.URL.revokeObjectURL = () => {}; pro(false);
  }

  await T.done(page);
})();
