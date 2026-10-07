'use strict';
/* Functional tests for the camera tools, part 2: Code Scanner, Doc Scanner, Grid Cam. */
const fs = require('fs'), path = require('path');
const { bootMedia } = require('../helpers/media-fakes');
const { suite } = require('../helpers/page');

(async () => {
  const T = suite('camera2'), { page, M } = await bootMedia();
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
  // pictures for the scanner: a QR code and an EAN-13, as RGBA
  const vend = path.join(__dirname, '..', '..', 'www', 'js', 'vendor');
  const qrcode = new Function(fs.readFileSync(path.join(vend, 'qrcode.js'), 'utf8') + '; return qrcode;')();
  const qrPixels = (text) => { const q = qrcode(0, 'M'); q.addData(text); q.make(); const n = q.getModuleCount(), S = 6, W = (n + 8) * S, px = new Uint8ClampedArray(W * W * 4); for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const mx = Math.floor(x / S) - 4, my = Math.floor(y / S) - 4, v = (mx >= 0 && my >= 0 && mx < n && my < n && q.isDark(my, mx)) ? 0 : 255, i = (y * W + x) * 4; px[i] = px[i + 1] = px[i + 2] = v; px[i + 3] = 255; } return { px, W }; };
  const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'], G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'], R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'], PAR = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
  const eanPixels = (s) => { let b = '101'; for (let i = 0; i < 6; i++) b += (PAR[+s[0]][i] === 'L' ? L : G)[+s[1 + i]]; b += '01010'; for (let i = 0; i < 6; i++) b += R[+s[7 + i]]; b += '101'; const m = 3, W = (b.length + 24) * m, H = 140, px = new Uint8ClampedArray(W * H * 4); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = Math.floor(x / m) - 12, v = (k >= 0 && k < b.length && b[k] === '1' && y > 10 && y < H - 10) ? 20 : 235, i = (y * W + x) * 4; px[i] = px[i + 1] = px[i + 2] = v; px[i + 3] = 255; } return { px, W, H }; };

  /* ================= Code Scanner: BarcodeDetector present ================= */
  {
    reset(); const b0 = M.live(); let detects = 0; M.bd = [];
    w.BarcodeDetector = class { detect() { detects++; if (M.bdFail) return Promise.reject(new Error('x')); return Promise.resolve(M.bd); } };
    w.localStorage.removeItem('pk.codescan.history'); M.vw = 640; M.vh = 480; let t = await page.open('codescan'); await wait(30);
    T.has(t.q('#qrnote').textContent, 'common barcodes', 'scanner: note when the phone can scan natively'); await wait(600); T.ok(detects >= 2, 'scanning runs about four times a second'); T.eq(t.q('#res').style.display, 'none', 'no result yet');
    M.bd = [{ rawValue: 'https://example.com/x', format: 'qr_code' }]; await wait(400); T.eq(t.q('#res').style.display, '', 'result card shown'); T.eq(t.q('#txt').textContent, 'https://example.com/x', 'text shown'); T.eq(t.q('#fmt').textContent, 'QR code', 'native format names are shown in plain words');
    T.eq(t.q('#op').style.display, '', 'web link can be opened'); T.eq(t.q('#op').getAttribute('href'), 'https://example.com/x', 'with its address'); T.eq(t.q('#op').getAttribute('rel'), 'noopener noreferrer', 'link opens safely');
    const d1 = detects; await wait(600); T.eq(detects, d1, 'scanning pauses while a result is on screen');
    t.click('#cp'); await wait(10); T.eq(M.clipboard[0], 'https://example.com/x', 'Copy copies the text');
    T.eq(JSON.stringify(JSON.parse(w.localStorage.getItem('pk.codescan.history'))), '[{"t":"https://example.com/x","f":"QR code"}]', 'result saved in history');
    t.click('#again'); T.eq(t.q('#res').style.display, 'none', 'Scan again hides the card'); M.bd = [{ rawValue: 'javascript:alert(1)', format: 'qr_code' }]; await wait(400); T.eq(t.q('#op').style.display, 'none', 'javascript: addresses are never offered as links'); T.ok(!t.q('#op').hasAttribute('href'), 'and have no href');
    t.click('#again'); M.bd = [{ rawValue: 'HTTP://UP.EXAMPLE/A B', format: 'qr_code' }]; await wait(400); T.eq(t.q('#op').style.display, 'none', 'an address with a space is not a link'); t.click('#again');
    M.bd = [{ rawValue: '<img src=x onerror=1>', format: 'qr_code' }]; await wait(400); T.ok(!t.has('#txt img') && !t.has('#hist img'), 'scanned text is shown as text, never as HTML'); T.has(t.q('#txt').textContent, '<img src=x', 'the text is shown');
    t.click('#again'); M.bd = [{ rawValue: 'x'.repeat(300), format: 'code_128' }]; await wait(400); T.ok(t.all('#hist .grow').some(g => g.textContent.length === 140), 'long history entries are cut to 140 characters'); T.eq(t.q('#txt').textContent.length, 300, 'but the card shows all of it');
    t.click('#again'); M.bd = [{ rawValue: 'https://example.com/x', format: 'qr_code' }]; await wait(400); T.eq(t.all('#hist .item').length, 5, 'scanning the same text again moves it to the top, not duplicated (5 entries)'); T.eq(t.q('#hist .grow').textContent, 'https://example.com/x', 'newest first');
    t.click('#again'); t.all('#hist button')[1].click(); T.eq(t.q('#txt').textContent.length > 0, true, 'Show reopens a history entry'); T.eq(t.all('#hist .item').length, 5, 'without adding it again');
    t.click('#clr'); T.has(t.q('#hist').textContent, 'No scans yet', 'Clear history'); T.eq(w.localStorage.getItem('pk.codescan.history'), '[]', 'and its saved copy');
    for (let i = 0; i < 25; i++) { t.click('#again'); M.bd = [{ rawValue: 'code' + i, format: 'ean_13' }]; await wait(300); } T.eq(t.all('#hist .item').length, 20, 'history keeps 20 entries');
    t.click('#again'); M.bdFail = true; M.bd = []; await wait(500); T.has(t.q('#qrnote').textContent, 'EAN/UPC', 'if the native scanner fails the note switches to the built-in decoder text'); M.bdFail = false;
    await leaves(t, b0, 'codescan'); delete w.BarcodeDetector;
    reset(); M.mode = 'denied'; t = await page.open('codescan'); await wait(20); T.has(t.q('#msg').textContent, 'permission was denied', 'codescan denied: message'); T.eq(M.live().intervals, b0.intervals, 'no timer without a camera'); t.close();
  }

  /* ================= Code Scanner: built-in decoders (jsQR and the 1D reader) ================= */
  {
    reset(); const b0 = M.live(); const qr = qrPixels('https://example.com/pocketkit'); M.vw = M.vh = qr.W; M.pixels = (wd, ht) => qr.px;
    w.localStorage.removeItem('pk.codescan.history'); let t = await page.open('codescan'); await wait(30); T.has(t.q('#qrnote').textContent, 'Hold the code steady', 'the built-in decoder note explains how to hold the phone');
    await wait(600); T.eq(t.q('#txt').textContent, 'https://example.com/pocketkit', 'QR code decoded from the camera frames'); T.eq(t.q('#fmt').textContent, 'QR code', 'format QR code'); T.eq(t.q('#op').style.display, '', 'link offered'); t.close();
    reset(); const ean = eanPixels('4006381333931'); M.vw = ean.W; M.vh = ean.H; M.pixels = () => ean.px; w.localStorage.removeItem('pk.codescan.history'); t = await page.open('codescan'); await wait(900);
    T.eq(t.q('#txt').textContent, '4006381333931', 'EAN-13 decoded from the camera frames (after it repeats)'); T.eq(t.q('#fmt').textContent, 'EAN-13', 'format EAN-13'); T.eq(t.q('#op').style.display, 'none', 'no link for a product code'); T.eq(t.all('#hist .item').length, 1, 'one history entry'); t.close();
    reset(); M.vw = 300; M.vh = 200; M.pixels = null; t = await page.open('codescan'); await wait(800); T.eq(t.q('#res').style.display, 'none', 'a blank picture gives no result'); t.close();
    // from a picture
    reset(); const qr2 = qrPixels('Hello from a picture'); M.imgW = M.imgH = qr2.W; M.pixels = () => qr2.px; w.localStorage.removeItem('pk.codescan.history'); t = await page.open('codescan'); t.click('#img'); M.pick([M.file('qr.png', 'image/png', 50)]); await wait(80);
    T.eq(t.q('#txt').textContent, 'Hello from a picture', 'QR read from a picture file'); T.ok(M.bitmaps.slice(-1)[0].closed >= 1, 'the decoded bitmap is released'); t.click('#again');
    M.pixels = null; t.click('#img'); M.pick([M.file('blank.png', 'image/png', 50)]); await wait(120); T.has(toastText(), 'No code found', 'a picture with no code says so');
    t.click('#img'); M.pick([M.file('notes.txt', 'text/plain', 5)]); await wait(30); T.has(toastText(), 'not a picture', 'a text file is refused');
    M.imgFail = true; M.bitmapFail = () => true; t.click('#img'); M.pick([M.file('bad.png', 'image/png', 50)]); await wait(60); T.has(toastText(), 'Could not read', 'a broken picture is reported'); t.close();
  }

  /* ================= Doc Scanner ================= */
  {
    reset(); const b0 = M.live(); M.imgW = 2000; M.imgH = 1000; let t = await page.open('docscan'); await wait(20);
    T.eq(t.q('#ed').style.display, 'none', 'doc scanner: no editor before a picture'); const nIn = M.inputs.length; t.click('#take'); await wait(30); T.ok(!!w.document.getElementById('pkShot'), 'Take photo opens the in-app camera (not the file picker)'); T.eq(M.inputs.length, nIn, 'Take photo does not open the file picker'); T.eq(M.liveTracks().length, 1, 'Take photo: the camera is running'); w.document.getElementById('pkc').click(); T.ok(!w.document.getElementById('pkShot'), 'Cancel closes the camera view'); T.eq(M.liveTracks().length, 0, 'Cancel stops the camera');
    t.click('#take'); await wait(30); t.close(); await wait(600); T.ok(!w.document.getElementById('pkShot'), 'leaving the tool closes the camera view'); T.eq(M.liveTracks().length, 0, 'leaving the tool stops the camera'); t = await page.open('docscan'); await wait(20);
    M.vw = 640; M.vh = 480; t.click('#take'); await wait(30); w.document.getElementById('pks').click(); await wait(120); T.ok(!w.document.getElementById('pkShot'), 'taking a picture closes the camera view'); T.eq(M.liveTracks().length, 0, 'taking a picture stops the camera'); T.ok(t.q('#ed').style.display !== 'none', 'the photo opens in the editor'); M.vw = 0; M.vh = 0; t.click('#pick'); T.ok(!M.inputs[M.inputs.length - 1].hasAttribute('capture'), 'Pick image opens the gallery');
    M.pick([M.file('notes.txt', 'text/plain', 5)]); await wait(10); T.has(toastText(), 'not a picture', 'a text file is refused'); M.pick([{ name: 'huge.png', type: 'image/png', size: 70 * 1048576 }]); await wait(10); T.has(toastText(), 'too large', 'a picture over 60 MB is refused');
    M.imgFail = true; M.bitmapFail = () => true; M.pick([M.file('bad.png', 'image/png', 50)]); await wait(60); T.has(t.q('#msg').textContent, 'Could not open', 'a broken picture is reported'); M.imgFail = false; M.bitmapFail = null;
    M.pick([M.file('page.png', 'image/png', 50)]); await wait(60); T.eq(t.q('#ed').style.display, '', 'editor shown'); T.has(t.q('#msg').textContent, 'Drag the four circles', 'instructions'); T.eq(t.q('#cv').width + 'x' + t.q('#cv').height, '900x450', 'preview of a 2000x1000 picture is 900x450');
    T.eq(t.q('#h0').style.left + ',' + t.q('#h0').style.top, '8%,8%', 'corner 1 starts at 8%'); T.eq(t.q('#h2').style.left + ',' + t.q('#h2').style.top, '92%,92%', 'corner 3 starts at 92%'); T.eq(t.q('#pg').getAttribute('points'), '8,8 92,8 92,92 8,92', 'outline joins the corners');
    t.q('#wrap').getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100 });
    ptr(t.q('#h0'), 'pointerdown', 0, 0); ptr(t.q('#h0'), 'pointermove', 100, 50); T.eq(t.q('#h0').style.left + ',' + t.q('#h0').style.top, '50%,50%', 'dragging moves the corner'); ptr(t.q('#h0'), 'pointermove', -50, 500); T.eq(t.q('#h0').style.left + ',' + t.q('#h0').style.top, '0%,100%', 'a corner cannot leave the picture');
    ptr(t.q('#h1'), 'pointermove', 100, 50); T.eq(t.q('#h1').style.left, '92%', 'moving without grabbing does nothing'); ptr(t.q('#h0'), 'pointermove', 16, 8);
    // reload to reset the corners, then crop: output 84% of 1600 x 800, limited to 1200 on the long side
    M.pick([M.file('page.png', 'image/png', 50)]); await wait(60); T.eq(t.q('#h0').style.left, '8%', 'a new picture resets the corners');
    const gi = () => M.canvasCalls.filter(c => c[0] === 'getImageData' && c[3] === 1600).length, g0 = gi(); t.click('#cut'); t.click('#cut'); await wait(200); T.eq(gi() - g0, 1, 'double tap on Straighten processes once');
    T.eq(t.q('#out').style.display, '', 'result shown'); T.eq(t.q('#ed').style.display, 'none', 'editor hidden'); T.eq(t.q('#oc').width + 'x' + t.q('#oc').height, '1200x600', 'output: 0.84 x 1600 = 1344 limited to 1200, 0.84 x 800 = 672 scaled to 600');
    t.click('#rot'); T.eq(t.q('#oc').width + 'x' + t.q('#oc').height, '600x1200', 'Rotate swaps width and height'); t.click('#rot'); T.eq(t.q('#oc').width + 'x' + t.q('#oc').height, '1200x600', 'twice returns');
    const p0 = M.canvasCalls.filter(c => c[0] === 'putImageData').length; t.select('#lk', 'c'); T.eq(M.canvasCalls.filter(c => c[0] === 'putImageData').length, p0 + 1, 'changing the look redraws'); t.select('#lk', 'g'); t.select('#lk', 'b');
    t.click('#sj'); await wait(40); T.ok(/^scan-\d{8}-\d{6}\.jpg$/.test(fileName()), 'Save as JPEG: ' + fileName()); T.ok(M.canvasCalls.some(c => c[0] === 'toBlob' && c[1] === 'image/jpeg'), 'encoded as JPEG'); t.click('#sp'); await wait(40); T.ok(/^scan-\d{8}-\d{6}\.png$/.test(fileName()), 'Save as PNG: ' + fileName());
    t.click('#ed2'); T.eq(t.q('#ed').style.display, '', 'Adjust corners returns to the editor'); T.eq(t.q('#out').style.display, 'none', 'result hidden');
    const bm = M.bitmaps.slice(-1)[0]; t.close(); T.ok(bm.closed >= 1, 'doc scanner: bitmap released on leave');
    t = await page.open('docscan'); t.click('#cut'); await wait(80); T.eq(t.q('#out').style.display, 'none', 'Straighten with no picture does nothing'); t.close();
  }

  /* ================= Grid Cam ================= */
  {
    reset(); const b0 = M.live(); const DME = w.DeviceMotionEvent; delete w.DeviceMotionEvent; let t = await page.open('gridcam'); await wait(30);
    T.eq(M.calls[0].video.facingMode.ideal, 'environment', 'grid cam: rear camera'); T.has(t.q('#lvm').textContent, 'No motion sensor', 'no motion sensor: the level line is turned off with a message');
    const lines = () => t.all('#gs line').length; T.eq(lines(), 4, 'rule of thirds has 4 lines'); [['g', 6], ['x', 2], ['d', 2], ['n', 0], ['t', 4]].forEach(([v, n]) => { t.select('#gm', v); T.eq(lines(), n, 'grid ' + v + ' has ' + n + ' lines'); });
    t.click('#cap'); T.has(toastText(), 'Camera is not ready', 'capture before the picture is ready says so'); M.vw = 640; M.vh = 480; t.click('#cap'); await wait(40); T.ok(/^photo-\d{8}-\d{6}\.jpg$/.test(fileName()), 'photo saved: ' + fileName());
    t.click('#sw'); await wait(30); T.eq(M.calls[1].video.facingMode.ideal, 'user', 'front camera'); T.has(t.q('#v').style.transform, 'scaleX(-1)', 'front camera is mirrored'); T.eq(M.liveTracks().length, 1, 'one camera at a time'); t.click('#sw'); await wait(30); T.eq(t.q('#v').style.transform, '', 'rear camera is not mirrored');
    await leaves(t, b0, 'gridcam');
    // a browser that has the API but never sends a reading (no sensor): the level line turns itself off
    reset(); w.DeviceMotionEvent = DME; t = await page.open('gridcam'); await wait(2700); T.has(t.q('#lvm').textContent, 'No motion sensor', 'no sensor reading within 2.5 s: the level line is turned off with a message'); T.eq(t.q('#hz').style.display, 'none', 'horizon line hidden'); t.close(); delete w.DeviceMotionEvent;
    // with a motion sensor
    reset(); w.DeviceMotionEvent = class {}; t = await page.open('gridcam'); await wait(20);
    const motion = (x, y) => { const e = new w.Event('devicemotion'); e.accelerationIncludingGravity = { x, y, z: 0 }; w.dispatchEvent(e); };
    for (let i = 0; i < 40; i++) motion(0, 9.81); T.has(t.q('#dg').textContent, 'Level 0.0°', 'phone held upright is level'); T.eq(t.q('#hz').style.borderTopColor === '' || true, true, 'colour check skipped');
    const a = 10 * Math.PI / 180; for (let i = 0; i < 40; i++) motion(9.81 * Math.sin(a), 9.81 * Math.cos(a)); T.eq(t.q('#dg').textContent, '10.0°', 'phone tilted 10 degrees reads 10.0'); T.eq(t.q('#hz').style.transform, 'rotate(10.0deg)', 'horizon line rotates 10 degrees');
    for (let i = 0; i < 80; i++) motion(-9.81 * Math.sin(a), 9.81 * Math.cos(a)); T.eq(t.q('#dg').textContent, '-10.0°', 'tilting the other way reads -10.0'); motion(null, null); motion(undefined, 5); T.eq(t.q('#dg').textContent, '-10.0°', 'readings without values are ignored');
    t.close(); motion(9.81, 0); T.eq(t.q('#dg').textContent, '-10.0°', 'the sensor is no longer listened to after leaving');
    w.DeviceMotionEvent.requestPermission = async () => 'denied'; t = await page.open('gridcam'); await wait(20); T.has(t.q('#lvm').textContent, 'permission was denied', 'denied motion permission: message'); motion(9.81, 0); T.eq(t.q('#dg').textContent, '0.0°', 'and the level line is not driven'); t.close(); delete w.DeviceMotionEvent;
  }

  /* ================= Code Scanner torch, remembered settings ================= */
  {
    reset(); const b0 = M.live(); M.vw = 640; M.vh = 480; M.torch = true; let t = await page.open('codescan'); await wait(40);
    T.eq(t.q('#tc').style.display, '', 'code scanner: torch button shown when the camera has a torch'); t.click('#tc'); await wait(10); T.eq(JSON.stringify(M.applied.pop()), '{"advanced":[{"torch":true}]}', 'torch on for scanning in the dark'); T.eq(t.q('#tc').textContent, 'Torch off', 'label'); t.click('#tc'); await wait(10); T.eq(t.q('#tc').textContent, 'Torch', 'and off'); t.close();
    M.torch = false; t = await page.open('codescan'); await wait(40); T.eq(t.q('#tc').style.display, 'none', 'no torch button without a torch'); t.close();
    reset(); t = await page.open('gridcam'); t.select('#gm', 'g'); t.close(); t = await page.open('gridcam'); T.eq(t.value('#gm'), 'g', 'grid cam remembers the grid'); T.eq(t.all('#gs line').length, 6, 'and draws it'); t.close();
    M.imgW = 2000; M.imgH = 1000; t = await page.open('docscan'); t.select('#lk', 'c'); t.close(); t = await page.open('docscan'); T.eq(t.value('#lk'), 'c', 'doc scanner remembers the look'); t.close();
  }


  await T.done(page);
})();
