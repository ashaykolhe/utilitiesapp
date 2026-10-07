'use strict';
/* Functional tests for the camera tools, part 3: Timer Cam and Time-lapse (these wait in real time). */
const { bootMedia } = require('../helpers/media-fakes');
const { suite } = require('../helpers/page');

(async () => {
  const T = suite('camera-timers'), { page, M } = await bootMedia();
  const w = page.w, wait = page.wait;
  const pro = (on) => page.eval('setPro(' + (on ? 'true' : 'false') + ')');
  const toastText = () => w.document.querySelector('#toast').textContent;
  const reset = () => { M.mode = 'ok'; M.delay = 0; M.torch = false; M.zoom = null; M.calls.length = 0; M.applied.length = 0; M.vw = 0; M.vh = 0; M.pixels = null; M.downloads.length = 0; M.canvasCalls.length = 0; M.confirmAnswer = true; M.wake.requests = M.wake.released = 0; M.imgFail = false; M.bitmapFail = null; M.imgW = 640; M.imgH = 480; M.clipboard.length = 0; w.document.querySelector('#toast').textContent = ''; };
  const leaves = async (t, b0, label) => {
    t.close(); await wait(150);
    T.eq(M.liveTracks().length, 0, label + ': every camera track is stopped after leaving');
    const b = M.live(); T.eq(b.intervals, b0.intervals, label + ': no interval left running'); T.eq(b.frames, b0.frames, label + ': no animation frame left');
  };
  const ptr = (el, type, x, y, id) => { const e = new w.MouseEvent(type, { bubbles: true, clientX: x || 0, clientY: y || 0 }); Object.defineProperty(e, 'pointerId', { value: id || 1 }); el.dispatchEvent(e); };
  const fileName = () => (M.downloads[M.downloads.length - 1] || {}).name || '';
  /* ================= Timer Cam ================= */
  {
    reset(); const b0 = M.live(); let t = await page.open('timercam'); await wait(30);
    t.click('#go'); T.has(toastText(), 'Camera is not ready', 'timer cam: starting before the picture is ready says so'); T.eq(t.q('#go').textContent, 'Start timer', 'no timer started');
    M.vw = 640; M.vh = 480; t.select('#dl', '10'); t.click('#go'); T.eq(t.q('#go').textContent, 'Cancel', 'timer running'); await wait(1300); T.eq(t.q('#cd').style.display, 'flex', 'countdown shown'); T.ok(/^(10|9)$/.test(t.q('#cd').textContent), 'counts down from 10 (' + t.q('#cd').textContent + ')');
    t.click('#go'); T.eq(t.q('#go').textContent, 'Start timer', 'Cancel stops it'); T.eq(t.q('#cd').style.display, 'none', 'countdown hidden'); await wait(1200); T.eq(t.all('#gal button').length, 0, 'a cancelled timer takes no picture');
    t.select('#dl', '3'); t.select('#sh', '1'); t.click('#go'); await wait(3700); T.eq(t.all('#gal button').length, 1, 'one picture after the 3 s delay'); T.eq(t.q('#go').textContent, 'Start timer', 'finished'); T.has(toastText(), 'Done', 'done message');
    t.q('#gal button').click(); await wait(30); T.ok(/^timer-\d{8}-\d{6}\.jpg$/.test(fileName()), 'tapping a picture saves it: ' + fileName());
    t.click('#sw'); await wait(30); T.eq(M.calls[M.calls.length - 1].video.facingMode.ideal, 'user', 'front camera for group selfies'); t.click('#sw'); await wait(30);
    t.select('#sh', '3'); t.click('#go'); await wait(8300); T.eq(t.all('#gal button').length, 4, 'three more pictures for a 3-shot series (3 s, then 2 s apart)'); T.eq(t.q('#go').textContent, 'Start timer', 'series finished');
    t.click('#go'); await wait(1000); const n = M.canvasCalls.filter(c => c[0] === 'toBlob').length; t.close(); await wait(1600); T.eq(M.canvasCalls.filter(c => c[0] === 'toBlob').length, n, 'leaving during the countdown takes no picture'); T.eq(M.liveTracks().length, 0, 'timer cam: camera released on leave');
    reset(); M.mode = 'denied'; t = await page.open('timercam'); await wait(20); T.has(t.q('#msg').textContent, 'permission was denied', 'timer cam denied: message'); t.close();
  }

  /* ================= Time-lapse ================= */
  {
    reset(); pro(true); const b0 = M.live(); let t = await page.open('timelapse'); await wait(30);
    t.click('#go'); T.has(toastText(), 'Camera is not ready', 'time-lapse: starting before the picture is ready says so'); M.vw = 640; M.vh = 480; t.select('#iv', '1'); t.click('#mk'); T.has(toastText(), 'at least 2', 'Make video needs two frames');
    t.click('#go'); T.eq(t.q('#go').textContent, 'Stop capturing', 'capturing'); T.eq(M.wake.requests, 1, 'screen kept awake'); await wait(2400); T.ok(/^[34] frames, capturing$/.test(t.q('#st').textContent), 'one frame at once then one per second: ' + t.q('#st').textContent);
    t.click('#go'); T.eq(M.wake.released, 1, 'wake lock released when stopped'); T.has(t.q('#st').textContent, 'frames', 'status'); const fr = parseInt(t.q('#st').textContent, 10); await wait(1300); T.eq(parseInt(t.q('#st').textContent, 10), fr, 'no more frames after Stop');
    t.select('#fp', '24'); t.click('#mk'); t.click('#mk'); await wait(500); T.has(t.q('#res').innerHTML, '<video', 'video result shown'); T.eq(t.all('#res video').length, 1, 'double tap makes one video'); t.click('#res #sv'); await wait(20); T.ok(/^timelapse-\d{8}-\d{6}\.webm$/.test(fileName()), 'saved as timelapse-<date>-<time>.webm: ' + fileName());
    t.click('#clr'); T.eq(t.q('#st').textContent, '0 frames', 'Discard frames'); t.click('#go'); await wait(100); T.eq(M.wake.requests, 2, 'screen awake again'); await leaves(t, b0, 'timelapse'); T.eq(M.wake.released, 2, 'wake lock released on leave'); pro(false);
  }

  /* ================= Remembered settings ================= */
  {
    reset(); let t = await page.open('timercam'); t.select('#dl', '5'); t.select('#sh', '3'); t.close(); t = await page.open('timercam'); T.eq(t.value('#dl') + ',' + t.value('#sh'), '5,3', 'timer cam remembers delay and shots'); t.close();
    t = await page.open('timelapse'); t.select('#iv', '10'); t.select('#fp', '24'); t.close(); t = await page.open('timelapse'); T.eq(t.value('#iv') + ',' + t.value('#fp'), '10,24', 'time-lapse remembers interval and speed'); t.close();
  }


  /* ================= Edge cases ================= */
  {
    reset(); pro(true); const b0 = M.live(); M.vw = 640; M.vh = 480; let t = await page.open('timelapse'); await wait(30); t.select('#fp', '8'); t.click('#go'); await wait(80); t.click('#go');
    for (let i = 0; i < 3; i++) { t.click('#go'); await wait(20); t.click('#go'); } M.downloads.length = 0; t.click('#mk'); t.close(); await wait(600);
    T.eq(M.downloads.length, 0, 'time-lapse: leaving while the video is being built stops the build and saves nothing'); T.eq(M.liveTracks().length, 0, 'camera released'); T.eq(M.live().intervals, b0.intervals, 'no timer left'); pro(false);
  }


  await T.done(page);
})();
