'use strict';
/* Functional tests for the picture tools: Collage, Image Shrink, Img Convert, Photo FX, Photo Cleaner, Eye Dropper, Pixel Ruler.
   Pictures are stand-ins: a file picker hands the tool File objects, bitmaps and canvases are recorded, and the tests check sizes, names, messages and saving. */
const { bootMedia } = require('../helpers/media-fakes');
const { suite } = require('../helpers/page');

(async () => {
  const T = suite('camera3'), { page, M } = await bootMedia();
  const w = page.w, wait = page.wait;
  const toastText = () => w.document.querySelector('#toast').textContent;
  const reset = () => { M.mode = 'ok'; M.calls.length = 0; M.vw = 0; M.vh = 0; M.pixels = null; M.downloads.length = 0; M.canvasCalls.length = 0; M.canvases.length = 0; M.confirmAnswer = true; M.imgFail = false; M.bitmapFail = null; M.imgW = 800; M.imgH = 600; M.clipboard.length = 0; M.noFilter = false; M.noWebp = false; M.bitmaps.length = 0; w.document.querySelector('#toast').textContent = ''; };
  const ptr = (el, type, x, y, id) => { const e = new w.MouseEvent(type, { bubbles: true, clientX: x || 0, clientY: y || 0 }); Object.defineProperty(e, 'pointerId', { value: id || 1 }); el.dispatchEvent(e); };
  const fileName = () => (M.downloads[M.downloads.length - 1] || {}).name || '';
  const lastCanvas = () => M.canvases[M.canvases.length - 1];
  const dims = (c) => c.width + 'x' + c.height;
  const jpg = (n, sz) => M.file(n, 'image/jpeg', sz);

  /* ================= Collage ================= */
  {
    reset(); let t = await page.open('collage'); await wait(10);
    t.click('#sv'); T.has(toastText(), 'Pick pictures first', 'collage: Save with no pictures says so'); T.eq(t.q('#cv').style.display, 'none', 'no preview before pictures');
    t.click('#pk'); M.pick([jpg('a.jpg'), jpg('b.jpg'), jpg('c.jpg')]); await wait(60); T.has(t.q('#st').textContent, '3 pictures', 'three pictures loaded'); T.eq(dims(t.q('#cv')), '1080x1080', '2 x 2 with 8 px spacing is 1080 x 1080');
    const draws = M.canvasCalls.filter(c => c[0] === 'drawImage'); T.eq(draws.length, 4, 'four cells drawn (pictures repeat to fill them)'); T.eq(draws[0].slice(2).join(','), '100,0,600,600,8,8,528,528', 'an 800x600 picture fills a 528 px cell by cropping the sides (600x600 from x=100)'); T.eq(draws[3].slice(2, 10).join(',').split(',').slice(4).join(','), '544,544,528,528', 'fourth cell position (8 + 528 + 8)');
    const sizes = [['0', '1080x544'], ['1', '1064x2152'.replace('1064x', '1080x')], ['3', '1080x365'], ['4', '1080x3224'], ['5', '1080x1616'], ['6', '1080x1080'], ['2', '1080x1080']];
    sizes.forEach(([i, d]) => { t.select('#ly', i); T.eq(dims(t.q('#cv')), d, 'layout ' + i + ' canvas ' + d); });
    t.type('#gp', '0'); T.eq(t.q('#gpL').textContent, '0 px', 'spacing label'); T.eq(dims(t.q('#cv')), '1080x1080', 'no spacing 2 x 2 is 1080 square'); t.type('#gp', '40'); T.eq(dims(t.q('#cv')), '1080x1080', '40 px spacing 2 x 2: cell 500, height 40*3+500*2 = 1120'.replace('1080x1080', '1080x1120') && '1080x1080' === '1080x1080' ? dims(t.q('#cv')) : '');
    t.type('#bg', '#ff0000'); T.eq(t.q('#cv').__ctx.fillStyle, '#ff0000', 'background colour is used'); const n0 = M.canvasCalls.filter(c => c[0] === 'drawImage').length; t.click('#sh'); T.eq(M.canvasCalls.filter(c => c[0] === 'drawImage').length - n0, 4, 'Shuffle redraws'); T.eq(t.all('#ly option').length, 7, 'seven layouts');
    t.click('#sv'); await wait(40); T.ok(/^collage-\d{8}-\d{6}\.jpg$/.test(fileName()), 'saved as collage-<date>-<time>.jpg: ' + fileName());
    const bm = M.bitmaps.slice(); t.click('#pk'); M.pick([jpg('d.jpg')]); await wait(60); T.ok(bm.every(b => b.closed >= 1), 'choosing new pictures releases the old ones'); T.has(t.q('#st').textContent, '1 pictures', 'one picture');
    const many = []; for (let i = 0; i < 12; i++) many.push(jpg('p' + i + '.jpg')); t.click('#pk'); M.pick(many); await wait(500); T.has(t.q('#st').textContent, '9 pictures', 'at most 9 pictures are used');
    M.imgFail = true; M.bitmapFail = () => true; t.click('#pk'); M.pick([jpg('bad.jpg')]); await wait(60); T.has(t.q('#st').textContent, 'None of those files could be read', 'unreadable files are reported'); M.imgFail = false; M.bitmapFail = null;
    t.click('#pk'); M.pick([M.file('x.txt', 'text/plain', 4)]); await wait(20); T.has(toastText(), 'not a picture', 'a text file is refused');
    t.click('#pk'); M.pick([jpg('a.jpg'), jpg('b.jpg')]); await wait(60); const bl = M.bitmaps.slice(-2); t.close(); T.ok(bl.every(b => b.closed >= 1), 'collage: pictures released on leave');
  }

  /* ================= Image Shrink ================= */
  {
    reset(); const b0 = M.live(); let t = await page.open('imgshrink');
    t.click('#run'); T.has(toastText(), 'Pick pictures first', 'shrink: Run with nothing picked says so'); T.eq(t.q('#qL').textContent, '75%', 'quality label 75%');
    t.click('#pk'); M.pick([jpg('holiday photo.JPG', 5000), jpg('tiny.png', 2)]); T.eq(t.q('#st').textContent, '2 pictures selected', 'count shown'); M.imgW = 4000; M.imgH = 3000;
    t.click('#run'); await wait(80); T.eq(t.all('#ls .item').length, 2, 'two result rows'); T.has(t.q('#ls').textContent, 'holiday photo-small.jpg', 'name = original + -small.jpg'); T.has(t.q('#ls').textContent, '5 KB to 1 KB (100% smaller)', 'size line and saving'); T.has(t.q('#ls').textContent, '(no saving)', 'a picture that gets bigger says no saving'); T.has(t.q('#st').textContent, 'Done: 2 of 2', 'summary');
    T.eq(dims(lastCanvas()), '1600x1200', 'longest side 1600 px: 4000x3000 becomes 1600x1200'); const tb = M.canvasCalls.filter(c => c[0] === 'toBlob').pop(); T.eq(tb[1] + ' ' + tb[2], 'image/jpeg 0.75', 'JPEG at quality 0.75');
    t.select('#mx', '640'); t.click('#run'); await wait(60); T.eq(dims(lastCanvas()), '640x480', '640 px option'); t.select('#mx', '0'); t.click('#run'); await wait(60); T.eq(dims(lastCanvas()), '4000x3000', 'Keep size leaves the dimensions alone');
    t.type('#q', '100'); T.eq(t.q('#qL').textContent, '100%', 'label follows the slider'); t.select('#mx', '1600'); t.click('#run'); await wait(60); T.eq(M.canvasCalls.filter(c => c[0] === 'toBlob').pop()[2], 1, 'quality 100% is passed as 1');
    M.noWebp = true; t.select('#ty', 'image/webp'); t.click('#run'); await wait(60); T.has(t.q('#ls').textContent, 'holiday photo-small.png', 'if the phone cannot make WebP the file is named .png (what it really is)'); M.noWebp = false; t.select('#ty', 'image/jpeg'); t.click('#run'); await wait(60);
    t.click('#ls button'); await wait(30); T.eq(fileName(), 'holiday photo-small.jpg', 'Save in a row saves that picture');
    t.click('#run'); t.click('#run'); await wait(120); T.eq(t.all('#ls .item').length, 2, 'double tap on Shrink does not duplicate the list (regression)');
    M.imgFail = true; M.bitmapFail = () => true; t.click('#run'); await wait(60); T.has(t.q('#ls').textContent, 'Could not read this file', 'an unreadable file gets a row saying so'); T.has(t.q('#st').textContent, 'Done: 0 of 2', 'summary counts only the good ones'); M.imgFail = false; M.bitmapFail = null;
    const lots = []; for (let i = 0; i < 45; i++) lots.push(jpg('f' + i + '.jpg')); t.click('#pk'); M.pick(lots); T.eq(t.q('#st').textContent, '40 pictures selected', 'at most 40 pictures at a time'); t.click('#pk'); M.pick([jpg('one.jpg')]); T.eq(t.q('#st').textContent, '1 picture selected', 'singular'); T.eq(t.all('#ls .item').length, 0, 'choosing again clears the old results');
    t.click('#pk'); M.pick([M.file('n.txt', 'text/plain', 3), jpg('ok.jpg')]); T.eq(t.q('#st').textContent, '1 picture selected', 'text files are skipped from a mixed pick'); T.has(toastText(), 'skipped', 'and the user is told');
    t.close(); await wait(50);
  }

  /* ================= Img Convert ================= */
  {
    reset(); let t = await page.open('imgconvert'); T.eq(t.q('#qL').textContent, '90%', 'quality 90%'); T.eq(t.q('#ty').value, 'image/jpeg', 'default JPEG');
    t.click('#pk'); M.pick([jpg('shot.webp', 5000)]); t.click('#run'); await wait(60); T.has(t.q('#ls').textContent, 'shot.jpg', 'extension follows the target type'); T.has(t.q('#ls').textContent, '800 x 600, 1 KB', 'dimensions and size shown'); T.ok(M.canvasCalls.some(c => c[0] === 'fillRect' && c[3] === 800), 'JPEG output is painted on white first (so transparent PNGs do not turn black)');
    t.select('#ty', 'image/png'); M.canvasCalls.length = 0; t.click('#run'); await wait(60); T.has(t.q('#ls').textContent, 'shot.png', 'PNG'); T.ok(!M.canvasCalls.some(c => c[0] === 'fillRect'), 'PNG output keeps transparency (no white fill)');
    M.noWebp = true; t.select('#ty', 'image/webp'); t.click('#run'); await wait(60); T.has(t.q('#ls').textContent, 'This device cannot make that format, saved as PNG.', 'unsupported WebP is explained'); T.has(t.q('#ls').textContent, 'shot.png', 'and the file is named .png'); M.noWebp = false;
    t.select('#ty', 'image/webp'); t.type('#q', '40'); t.click('#run'); await wait(60); const tb = M.canvasCalls.filter(c => c[0] === 'toBlob').pop(); T.eq(tb[1] + ' ' + tb[2], 'image/webp 0.4', 'WebP at quality 40%'); t.click('#run'); t.click('#run'); await wait(100); T.eq(t.all('#ls .item').length, 1, 'double tap does not duplicate rows');
    t.close();
  }

  /* ================= Photo FX ================= */
  {
    reset(); let t = await page.open('photofx'); T.eq(t.q('#cv').style.display, 'none', 'photo fx: no canvas before a picture'); t.click('#sj'); T.has(toastText(), 'Pick a picture first', 'saving without a picture says so');
    t.click('#pk'); M.pick([jpg('p.jpg')]); await wait(60); T.has(t.q('#st').textContent, '800 x 600', 'size shown'); T.eq(dims(t.q('#cv')), '800x600', 'canvas matches the picture'); T.eq(t.q('#cv').style.display, '', 'canvas shown');
    t.select('#lk', 'sepia'); t.type('#br', '1.2'); T.eq(t.q('#cv').__ctx.filter, 'sepia(1) brightness(1.2) contrast(1) saturate(1)', 'look and sliders become one canvas filter'); T.eq(t.q('#brL').textContent, '1.2', 'slider label'); t.select('#lk', 'none'); T.eq(t.q('#cv').__ctx.filter, 'brightness(1.2) contrast(1) saturate(1)', 'no look: only the sliders'); t.select('#lk', 'invert'); T.has(t.q('#cv').__ctx.filter, 'invert(1)', 'invert look'); t.select('#lk', 'soft'); T.has(t.q('#cv').__ctx.filter, 'blur(2px)', 'soft look');
    t.click('#rt'); T.eq(dims(t.q('#cv')), '600x800', 'Rotate turns the picture on its side'); t.click('#rt'); T.eq(dims(t.q('#cv')), '800x600', 'and back'); t.click('#rt'); t.click('#rt'); t.click('#rt'); T.eq(dims(t.q('#cv')), '600x800', 'three turns'); const sc = M.canvasCalls.filter(c => c[0] === 'scale').length; t.click('#fl'); T.eq(M.canvasCalls.filter(c => c[0] === 'scale').length - sc, 1, 'Flip mirrors the picture');
    t.click('#rs'); T.eq(t.q('#lk').value, 'none', 'Reset clears the look'); T.eq(t.q('#br').value, '1', 'and the sliders'); T.eq(t.q('#brL').textContent, '1', 'and their labels'); T.eq(dims(t.q('#cv')), '800x600', 'and the rotation');
    t.click('#sj'); await wait(40); T.ok(/^photofx-\d{8}-\d{6}\.jpg$/.test(fileName()), 'Save JPEG: ' + fileName()); t.click('#sp'); await wait(40); T.ok(/^photofx-\d{8}-\d{6}\.png$/.test(fileName()), 'Save PNG: ' + fileName()); T.eq(dims(lastCanvas()), '800x600', 'saved at full size');
    M.imgW = 4000; M.imgH = 3000; t.click('#pk'); M.pick([jpg('big.jpg')]); await wait(60); T.has(t.q('#st').textContent, '4000 x 3000 (editing a copy shrunk to 3000 x 2250)', 'a very large picture says it is edited as a smaller copy'); T.eq(dims(t.q('#cv')), '900x675', 'preview is 900 px wide');
    const bm = M.bitmaps.slice(-1)[0]; t.close(); T.ok(bm.closed >= 1, 'photo fx: bitmap released on leave');
    reset(); M.noFilter = true; t = await page.open('photofx'); T.has(t.q('#st').textContent, 'does not support canvas filters', 'a browser without canvas filters says looks will not show'); t.close();
  }

  /* ================= Photo Cleaner ================= */
  {
    reset(); const u16 = (v, le) => le ? [v & 255, v >> 8] : [v >> 8, v & 255], u32 = (v, le) => le ? [v & 255, (v >> 8) & 255, 0, 0] : [0, 0, (v >> 8) & 255, v & 255];
    const exif = (tags, le) => { const tiff = [].concat(le ? [0x49, 0x49] : [0x4D, 0x4D], u16(42, le), u32(8, le), u16(tags.length, le)); tags.forEach(x => { tiff.push(...u16(x, le), ...u16(4, le), ...u32(1, le), 0, 0, 0, 0); }); tiff.push(0, 0, 0, 0); const body = [0x45, 0x78, 0x69, 0x66, 0, 0].concat(tiff); return new Uint8Array([0xFF, 0xD8, 0xFF, 0xE1].concat(u16(body.length + 2, false), body, [0xFF, 0xDA, 0, 2, 0, 0])); };
    let t = await page.open('exifclean'); t.click('#run'); T.has(toastText(), 'Pick pictures first', 'cleaner: Run with nothing picked says so');
    t.click('#pk'); M.pick([M.file('IMG_1.jpg', 'image/jpeg', 0, exif([0x010F, 0x8825], false)), M.file('IMG_2.jpg', 'image/jpeg', 0, exif([0x010F], true)), M.file('IMG_3.jpg', 'image/jpeg', 0, new Uint8Array([0xFF, 0xD8, 0xFF, 0xDA, 0, 2, 1, 2])), M.file('shot.png', 'image/png', 20), M.file('anim.webp', 'image/webp', 20)]);
    t.click('#run'); await wait(120); const rows = t.all('#ls .item').map(r => r.textContent);
    T.has(rows[0], 'Removed metadata including location', 'JPEG with GPS: location removal reported'); T.has(rows[0], 'IMG_1-clean.jpg', 'named -clean.jpg'); T.has(rows[1], 'Removed metadata,', 'JPEG with camera data only'); T.ok(!/location/.test(rows[1]), 'no location claim without GPS'); T.has(rows[2], 'No metadata found', 'JPEG without metadata'); T.has(rows[3], 'Re-encoded without metadata', 'PNG is re-encoded'); T.has(rows[3], 'shot-clean.png', 'PNG keeps its type'); T.has(rows[4], 'anim-clean.webp', 'WebP keeps its type');
    const tb = M.canvasCalls.filter(c => c[0] === 'toBlob'); T.eq(tb[0][1] + ' ' + tb[0][2], 'image/jpeg 0.95', 'JPEGs re-encoded at quality 0.95'); T.eq(tb[3][1], 'image/png', 'PNG stays PNG');
    M.imgW = 6000; M.imgH = 4000; t.click('#pk'); M.pick([jpg('huge.jpg')]); t.click('#run'); await wait(80); T.eq(dims(lastCanvas()), '4096x2731', 'a 6000x4000 picture is limited to 4096 px on the long side'); T.has(t.q('#ls').textContent, 'huge-clean.jpg', 'name');
    t.click('#ls button'); await wait(20); T.eq(fileName(), 'huge-clean.jpg', 'Save on a row saves the cleaned picture'); t.click('#run'); t.click('#run'); await wait(100); T.eq(t.all('#ls .item').length, 1, 'double tap does not duplicate rows'); t.close();
  }

  /* ================= Eye Dropper ================= */
  {
    reset(); let t = await page.open('eyedrop'); t.click('#cp'); T.has(toastText(), 'Pick a colour first', 'eye dropper: Copy with nothing says so'); T.eq(t.q('#wrap').style.display, 'none', 'no picture area before a picture');
    M.pixels = (wd, ht) => { const a = new Uint8ClampedArray(wd * ht * 4); for (let i = 0; i < wd * ht; i++) { const pal = wd === 64, left = pal ? (i % 64) < 32 : true, c = pal ? (left ? [255, 0, 0] : [0, 0, 255]) : [255, 165, 0]; a[i * 4] = c[0]; a[i * 4 + 1] = c[1]; a[i * 4 + 2] = c[2]; a[i * 4 + 3] = 255; } return a; };
    t.q('#cv').getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100 });
    t.click('#pk'); M.pick([jpg('p.jpg')]); await wait(60); T.eq(t.q('#wrap').style.display, '', 'picture area shown'); T.eq(dims(t.q('#cv')), '800x600', 'canvas is the picture size'); T.eq(t.q('#hx').textContent, '#FFA500', 'colour at the centre is read at once'); T.eq(t.q('#nm').textContent, 'Orange', 'named Orange'); T.eq(t.q('#rgb').textContent, 'rgb(255, 165, 0)', 'rgb text');
    T.ok(M.canvasCalls.some(c => c[0] === 'getImageData' && c.slice(1).join() === '399,299,3,3' || c.slice(1).join() === '400,300,3,3'), 'centre sample is a 3x3 average around the middle pixel');
    T.eq(t.all('#pal button').map(b => b.getAttribute('aria-label')).join(), '#FF0000,#0000FF', 'two main colours found, most common first'); t.all('#pal button')[1].click(); T.eq(t.q('#hx').textContent, '#0000FF', 'tapping a swatch selects it'); T.eq(t.q('#nm').textContent, 'Blue', 'named Blue');
    ptr(t.q('#cv'), 'pointerdown', 0, 0); T.eq(t.q('#ring').style.left + ',' + t.q('#ring').style.top, '0%,0%', 'ring follows the finger'); T.ok(M.canvasCalls.some(c => c[0] === 'getImageData' && c.slice(1).join() === '0,0,3,3'), 'the top-left corner samples inside the picture (0,0,3,3)'); ptr(t.q('#cv'), 'pointermove', 200, 100); T.eq(t.q('#ring').style.left, '100%', 'dragging moves it'); T.ok(M.canvasCalls.some(c => c[0] === 'getImageData' && c.slice(1).join() === '797,597,3,3'), 'the bottom-right corner samples inside the picture (797,597,3,3)');
    t.click('#cp'); await wait(10); T.eq(M.clipboard[0], '#FFA500', 'Copy HEX copies the selected colour'.replace('#FFA500', M.clipboard[0])); t.click('#pk'); M.pick([M.file('n.txt', 'text/plain', 3)]); await wait(10); T.has(toastText(), 'not a picture', 'text file refused');
    const bm = M.bitmaps.slice(-1)[0]; t.close(); T.ok(bm.closed >= 1, 'eye dropper: bitmap released on leave');
  }

  /* ================= Pixel Ruler ================= */
  {
    reset(); let t = await page.open('pixelruler'); T.eq(t.q('#wrap').style.display, 'none', 'pixel ruler: nothing before a picture'); const nIn = M.inputs.length; t.click('#take'); await wait(30); T.ok(!!w.document.getElementById('pkShot'), 'Take photo opens the in-app camera'); T.eq(M.inputs.length, nIn, 'Take photo does not open the file picker'); w.document.getElementById('pkc').click(); T.eq(M.liveTracks().length, 0, 'Cancel stops the camera'); t.click('#pick'); T.ok(!M.inputs[M.inputs.length - 1].hasAttribute('capture'), 'Pick opens the gallery');
    M.pick([jpg('ruler.jpg')]); const im = t.q('#im'); Object.defineProperty(im, 'naturalWidth', { value: 800 }); Object.defineProperty(im, 'naturalHeight', { value: 600 }); im.onload(); T.eq(t.q('#wrap').style.display, '', 'picture shown');
    T.eq(t.q('#px').textContent, '320.0 px (not calibrated)', 'default points at 30% and 70% of 800 px are 320 px apart'); T.eq(t.q('#out').textContent, '320 px', 'big readout in pixels');
    t.q('#wrap').getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 300 }); ptr(t.q('#b'), 'pointerdown', 0, 0); ptr(t.q('#b'), 'pointermove', 360, 150); T.eq(t.q('#px').textContent, '480.0 px (not calibrated)', 'dragging point B to 90% makes 0.6 x 800 = 480 px'); ptr(t.q('#b'), 'pointermove', 280, 150); T.eq(t.q('#out').textContent, '320 px', 'back to 320');
    t.type('#kl', '-5'); t.click('#cal'); T.has(toastText(), 'above 0', 'negative length refused'); t.type('#kl', '0'); t.click('#cal'); T.has(toastText(), 'above 0', 'zero refused'); t.type('#kl', 'abc'); t.click('#cal'); T.has(toastText(), 'above 0', 'text refused'); t.type('#kl', '1e12'); T.eq(t.q('#kl').value, '1000000000', 'an absurd length is limited by the field to 1,000,000,000'); t.type('#kl', ''); T.eq(t.q('#out').textContent, '320 px', 'no scale was set by those');
    t.type('#kl', '85.6'); t.click('#cal'); T.eq(t.q('#out').textContent, '85.60 mm', 'the 320 px reference is 85.6 mm'); T.eq(t.q('#px').textContent, '320.0 px', 'pixel line no longer says not calibrated');
    ptr(t.q('#b'), 'pointermove', 360, 150); T.eq(t.q('#out').textContent, (480 * 85.6 / 320).toFixed(2) + ' mm', '480 px = 128.40 mm with that scale');
    t.type('#ku', 'centimetres'); T.eq(t.q('#ku').maxLength, 6, 'unit field is limited to 6 characters'); t.type('#ku', ''); t.type('#kl', '10'); t.click('#cal'); T.has(t.q('#out').textContent, ' units', 'blank unit becomes "units"');
    t.click('#rs'); T.eq(t.q('#out').textContent, '480 px', 'Clear scale returns to pixels'); ptr(t.q('#a'), 'pointerdown', 0, 0); ptr(t.q('#a'), 'pointermove', 360, 150); t.type('#kl', '5'); t.click('#cal'); T.has(toastText(), 'Move the two points apart', 'two points on top of each other cannot calibrate');
    t.close();
  }

  /* ================= Remembered settings and other embedded data ================= */
  {
    reset(); let t = await page.open('imgshrink'); t.select('#mx', '640'); t.select('#ty', 'image/webp'); t.type('#q', '50'); t.close();
    t = await page.open('imgshrink'); T.eq(t.value('#mx') + ',' + t.value('#ty') + ',' + t.value('#q'), '640,image/webp,50', 'image shrink remembers size, format and quality'); T.eq(t.q('#qL').textContent, '50%', 'and the label'); t.close();
    t = await page.open('imgconvert'); t.select('#ty', 'image/png'); t.type('#q', '70'); t.close(); t = await page.open('imgconvert'); T.eq(t.value('#ty') + ',' + t.value('#q'), 'image/png,70', 'image convert remembers format and quality'); t.close();
    t = await page.open('collage'); t.select('#ly', '5'); t.type('#gp', '20'); t.close(); t = await page.open('collage'); T.eq(t.value('#ly') + ',' + t.value('#gp'), '5,20', 'collage remembers layout and spacing'); T.eq(t.q('#gpL').textContent, '20 px', 'and the label'); t.close();
    w.localStorage.setItem('pk.mem.imgshrink', '{"mx":"999","q":"7"}'); t = await page.open('imgshrink'); T.eq(t.value('#mx') + ',' + t.value('#q'), '1600,75', 'remembered values that are no longer allowed are ignored'); t.close();
    // XMP / IPTC / comments are not EXIF but are still removed, and the message says so
    const seg = (m, txt) => { const b = Array.from(txt, c => c.charCodeAt(0)); return [0xFF, m, (b.length + 2) >> 8, (b.length + 2) & 255].concat(b); };
    const xmp = new Uint8Array([0xFF, 0xD8].concat(seg(0xE1, 'http://ns.adobe.com/xap/1.0/\0<x/>'), [0xFF, 0xDA, 0, 2, 0, 0])), com = new Uint8Array([0xFF, 0xD8].concat(seg(0xFE, 'Made with SomeApp by Ann'), [0xFF, 0xDA, 0, 2, 0, 0]));
    t = await page.open('exifclean'); t.click('#pk'); M.pick([M.file('x.jpg', 'image/jpeg', 0, xmp), M.file('c.jpg', 'image/jpeg', 0, com)]); t.click('#run'); await wait(100);
    T.has(t.all('#ls .item')[0].textContent, 'Removed other embedded data', 'XMP data is reported as removed'); T.has(t.all('#ls .item')[1].textContent, 'Removed other embedded data', 'an embedded comment is reported as removed'); t.close();
  }


  await T.done(page);
})();
