'use strict';
/* Functional tests for the audio tools (audio.js, speech.js, noise.js): UI states without a microphone, cleanup on leave,
   timing and level maths measured on the Web Audio calls the tools make (the fakes record every node), free limits. */
const { bootMedia, sine } = require('../helpers/media-fakes');
const { suite } = require('../helpers/page');

(async () => {
  const T = suite('audio'), { page, M } = await bootMedia();
  const w = page.w, wait = page.wait;
  const pro = (on) => page.eval('setPro(' + (on ? 'true' : 'false') + ')');
  const proAsked = []; page.eval('openPro = function (k) { window.__proAsked = (window.__proAsked || []); window.__proAsked.push(k); }');
  const asked = () => w.__proAsked || [];
  const lastCtx = () => M.ctxs[M.ctxs.length - 1];
  const base = () => M.live();
  const reset = () => { M.mode = 'ok'; M.delay = 0; M.sig = null; M.bytes = null; M.failAudio = false; M.calls.length = 0; M.now = 0; M.confirmAnswer = true; M.confirms.length = 0; };
  /* Leave a tool and check that nothing it started is still running. */
  const leaves = async (t, b0, label) => {
    t.close(); await wait(220);
    T.eq(M.liveTracks().length, 0, label + ': every microphone track is stopped after leaving');
    T.eq(M.openCtxs().length, 0, label + ': every AudioContext is closed after leaving');
    const b = M.live();
    T.eq(b.intervals, b0.intervals, label + ': no interval left running');
    T.eq(b.frames, b0.frames, label + ': no animation frame left scheduled');
  };
  const ptr = (el, type, id, x, y) => { const e = new w.MouseEvent(type, { bubbles: true, clientX: x || 0, clientY: y || 0 }); Object.defineProperty(e, 'pointerId', { value: id }); el.dispatchEvent(e); };
  const tapCount = (n, ms) => { let t = 0; return () => { const v = t; t += ms; return v; }; };

  /* ================= Metronome ================= */
  {
    reset(); const b0 = base(); let t = await page.open('metronome');
    T.has(t.text(), '100', 'metronome starts at 100 BPM'); T.has(t.text(), 'Andante', '100 BPM is Andante');
    t.click('#p5'); T.eq(t.q('#bpm').textContent, '105', '+5 BPM'); t.click('#m1'); T.eq(t.q('#bpm').textContent, '104', '-1 BPM');
    for (let i = 0; i < 60; i++) t.click('#m5'); T.eq(t.q('#bpm').textContent, '30', 'BPM stops at 30'); T.has(t.text(), 'Largo', '30 BPM is Largo');
    for (let i = 0; i < 70; i++) t.click('#p5'); T.eq(t.q('#bpm').textContent, '300', 'BPM stops at 300'); T.has(t.text(), 'Presto', '300 BPM is Presto');
    T.eq(w.localStorage.getItem('pk.metro.bpm'), '300', 'tempo is remembered');
    t.type('#sl', '120'); T.eq(t.q('#bpm').textContent, '120', 'slider sets tempo');
    // Tap tempo: taps 500 ms apart = 120 BPM, 600 ms apart = 100 BPM
    let now = 10000; Object.defineProperty(w.performance, 'now', { value: () => now, configurable: true });
    t.click('#tap'); now += 600; t.click('#tap'); now += 600; t.click('#tap'); T.eq(t.q('#bpm').textContent, '100', 'tap tempo 600 ms = 100 BPM');
    now += 3000; t.click('#tap'); now += 500; t.click('#tap'); T.eq(t.q('#bpm').textContent, '120', 'a pause over 2 s restarts tap tempo; 500 ms = 120 BPM');
    delete w.performance.now;
    // Click timing: 100 BPM, 4/4, first click 60 ms after start, every 0.6 s, accent (1600 Hz) on beat one
    t.click('#sl'); t.type('#sl', '100'); t.select('#ts', '4');
    t.click('#go'); const c = lastCtx(); T.eq(t.q('#go').textContent, 'Stop', 'Start becomes Stop');
    M.now = 5; await wait(90);
    const osc = c.oscs().filter(o => o.started), times = osc.map(o => o.startAt);
    T.eq(times.length, 9, 'clicks scheduled up to 5.12 s at 100 BPM = ceil((5.12-0.06)/0.6) = 9');
    T.ok(times.slice(1).every((x, i) => Math.abs(x - times[i] - 0.6) < 1e-9), 'every click is exactly 0.6 s after the previous');
    T.near(times[0], 0.06, 1e-9, 'first click 60 ms after pressing Start');
    T.eq(osc.map(o => o.frequency.value).slice(0, 5).join(','), '1600,1000,1000,1000,1600', 'accent on beat one of four');
    t.click('#go'); T.eq(c.state, 'closed', 'Stop closes the audio context'); T.eq(t.q('#go').textContent, 'Start', 'button back to Start');
    t.click('#go'); t.click('#go'); await wait(30); T.eq(M.openCtxs().length, 0, 'start then stop at once leaves no audio context open');
    // 1/4 has no accent, 3/4 accents every third
    t.select('#ts', '1'); t.click('#go'); M.now = 2; await wait(60);
    T.ok(lastCtx().oscs().filter(o => o.started).every(o => o.frequency.value === 1000), '1/4 has no accented click'); t.click('#go');
    T.eq(w.localStorage.getItem('pk.metro.beats'), '1', 'time signature is remembered');
    t.select('#ts', '3'); t.click('#go'); M.now = 4; await wait(60);
    T.eq(lastCtx().oscs().filter(o => o.started).map(o => o.frequency.value).slice(0, 4).join(','), '1600,1000,1000,1600', '3/4 accents every third beat');
    T.eq(t.all('#dots span').length, 3, 'three beat dots for 3/4');
    await leaves(t, b0, 'metronome (playing)');
    t = await page.open('metronome'); T.eq(t.q('#ts').value, '3', 'time signature restored on reopening'); T.eq(t.q('#bpm').textContent, '100', 'tempo restored on reopening'); t.close();
  }

  /* ================= Tone Generator ================= */
  {
    reset(); const b0 = base(); let t = await page.open('tonegen');
    T.has(t.text(), 'A4 +0 cents', 'default 440 Hz is A4');
    t.type('#num', '1000'); T.eq(t.q('#hzv').textContent, '1000', 'typed frequency is shown'); T.has(t.q('#nt').textContent, 'B5', '1000 Hz is B5');
    t.type('#num', '5'); T.eq(t.value('#num'), '20', 'frequency below 20 Hz is raised to 20');
    t.type('#num', '99999'); T.eq(t.value('#num'), '20000', 'frequency above 20 kHz is lowered to 20000');
    t.type('#num', 'abc'); T.eq(t.value('#num'), '440', 'unreadable frequency falls back to 440');
    t.type('#sl', '0'); T.eq(t.value('#num'), '20', 'slider left end is 20 Hz'); t.type('#sl', '1000'); T.eq(t.value('#num'), '20000', 'slider right end is 20 kHz');
    t.type('#sl', '500'); T.eq(t.value('#num'), String(Math.round(20 * Math.pow(1000, 0.5))), 'slider middle is the geometric mean, 632 Hz');
    t.type('#num', '440'); t.select('#wf', 'square');
    t.click('#go'); let c = lastCtx(); let o = c.oscs()[0];
    T.eq(o.type, 'square', 'waveform is used'); T.eq(o.frequency.value, 440, 'tone plays at the chosen frequency');
    const g = c.nodes.find(n => n.kind === 'gain');
    T.near(g.gain.target, 0.25 * 0.25 * 0.5, 1e-9, 'default 25% volume is a gain of 0.03125');
    T.eq(c.nodes.filter(n => n.kind === 'comp').length, 1, 'tone goes through a limiter');
    t.type('#vol', '100'); T.ok(M.confirms.length === 0, 'full volume at 440 Hz does not ask'); T.near(g.gain.target, 0.5, 1e-9, 'gain never exceeds 0.5 at 100%');
    t.type('#num', '5000'); T.eq(o.frequency.target, 5000, 'frequency changes while playing');
    t.click('#go'); await wait(160); T.eq(c.state, 'closed', 'Stop closes the context after the fade'); T.ok(o.stopped, 'oscillator stopped');
    t.type('#vol', '60'); T.ok(true, 'volume slider after Stop does not throw (regression: gain used a closed context)');
    // loud + high pitch asks first
    reset(); t.type('#vol', '80'); t.type('#num', '8000'); M.confirmAnswer = false; const n0 = M.ctxs.length; t.click('#go');
    T.eq(M.confirms.length, 1, 'loud high tone asks to confirm'); T.eq(M.ctxs.length, n0, 'declining does not start the tone'); T.eq(t.q('#go').textContent, 'Play', 'button still says Play');
    M.confirmAnswer = true; t.click('#go'); T.eq(M.ctxs.length, n0 + 1, 'confirming starts the tone'); T.eq(t.q('#go').textContent, 'Stop', 'now playing');
    // sweep stays between the two frequencies
    t.click('#go'); await wait(160); t.type('#vol', '20'); t.type('#num', '440'); t.check('#sw', true); t.type('#to', '2000'); t.select('#dur', '3');
    t.click('#go'); c = lastCtx(); o = c.oscs()[0]; const seen = [];
    for (let i = 0; i < 12; i++) { await wait(25); seen.push(o.frequency.value); }
    T.ok(seen.every(f => f >= 439.9 && f <= 2000.1), 'sweep frequency stays between 440 and 2000 Hz'); T.ok(Math.max(...seen) > seen[0] + 1, 'sweep frequency rises');
    await leaves(t, b0, 'tonegen (sweeping)');
  }

  /* ================= Tuner ================= */
  {
    reset(); const b0 = base(); let t = await page.open('tuner');
    M.mode = 'denied'; t.click('#go'); await wait(20);
    T.has(t.q('#msg').textContent, 'permission', 'denied microphone says so'); T.has(t.q('#msg').textContent, 'Settings', 'and says where to allow it'); T.eq(t.q('#go').textContent, 'Start tuner', 'still offers Start');
    M.mode = 'notfound'; t.click('#go'); await wait(20); T.has(t.q('#msg').textContent, 'No microphone', 'no microphone says so');
    M.mode = 'ok'; M.delay = 25; M.calls.length = 0; t.click('#go'); t.click('#go'); await wait(80);
    T.eq(M.calls.length, 1, 'double tap asks the microphone once'); T.eq(t.q('#go').textContent, 'Stop', 'tuner is listening');
    M.delay = 0; M.sig = sine(440, 0.5); await wait(300);
    T.eq(t.q('#note').textContent, 'A4', '440 Hz sine is read as A4'); T.has(t.q('#hz').textContent, '440.', 'frequency shown near 440 Hz'); T.has(t.q('#hint').textContent, 'In tune', 'in tune');
    M.sig = sine(261.63, 0.5); await wait(400); T.eq(t.q('#note').textContent, 'C4', '261.63 Hz is C4');
    M.sig = sine(448, 0.5); await wait(500); T.eq(t.q('#note').textContent, 'A4', '448 Hz is still A4'); T.has(t.q('#cents').textContent, '+31', '448 Hz is 31 cents sharp'); T.has(t.q('#hint').textContent, 'Too high', 'sharp gives too high');
    M.sig = sine(0, 0); await wait(100);
    t.select('#inst', 'guitar'); T.eq(t.all('#strings button').length, 6, 'guitar has six strings'); T.eq(t.all('#strings button').map(b => b.textContent.trim()).join(' '), 'E2 A2 D3 G3 B3 E4', 'guitar strings E2 A2 D3 G3 B3 E4');
    M.sig = sine(110, 0.5); await wait(500); T.eq(t.q('#note').textContent, 'A2', '110 Hz on guitar preset is the A string');
    t.select('#inst', 'ukulele'); T.eq(t.all('#strings button').map(b => b.textContent.trim()).join(' '), 'G4 C4 E4 A4', 'ukulele G C E A (re-entrant)');
    t.select('#inst', 'bass'); T.eq(t.all('#strings button').map(b => b.textContent.trim()).join(' '), 'E1 A1 D2 G2', 'bass E A D G');
    t.select('#inst', 'violin'); T.eq(t.all('#strings button').map(b => b.textContent.trim()).join(' '), 'G3 D4 A4 E5', 'violin G D A E');
    t.click('#go'); T.eq(M.liveTracks().length, 0, 'Stop releases the microphone'); T.eq(M.openCtxs().length, 0, 'Stop closes the context'); T.eq(t.q('#note').textContent, '--', 'display cleared');
    t.click('#go'); await wait(30); T.eq(t.q('#go').textContent, 'Stop', 'can start again');
    await leaves(t, b0, 'tuner');
    // leaving while the permission prompt is open
    reset(); M.delay = 40; t = await page.open('tuner'); t.click('#go'); t.close(); await wait(120);
    T.eq(M.liveTracks().length, 0, 'tuner: leaving during the permission prompt leaves no track running'); T.eq(M.openCtxs().length, 0, 'tuner: and no context');
    reset(); M.setNoMediaDevices(); t = await page.open('tuner'); t.click('#go'); await wait(20); T.has(t.q('#msg').textContent, 'No microphone', 'tuner without mediaDevices: message'); t.close();
    M.restoreMedia();
  }

  /* ================= Mike ================= */
  {
    reset(); const b0 = base(); let t = await page.open('mike');
    T.ok(t.q('#go').disabled, 'Mike: Start is disabled until the headphone box is ticked'); t.check('#ok', true); T.ok(!t.q('#go').disabled, 'ticking the box enables Start');
    M.mode = 'denied'; t.click('#go'); await wait(20); T.has(t.q('#msg').textContent, 'permission', 'Mike denied: message'); T.has(t.q('#msg').textContent, 'Settings', 'Mike denied: says where to allow it');
    M.mode = 'busy'; t.click('#go'); await wait(20); T.has(t.q('#msg').textContent, 'busy', 'Mike busy microphone: message');
    M.mode = 'ok'; M.delay = 20; M.calls.length = 0; t.check('#ec', false); t.click('#go'); t.click('#go'); await wait(70);
    T.eq(M.calls.length, 1, 'Mike: double tap asks the microphone once'); T.eq(M.calls[0].audio.echoCancellation, false, 'echo cancellation follows the checkbox'); T.eq(M.calls[0].audio.autoGainControl, false, 'no auto gain (it would feed back)');
    const c = lastCtx(); T.eq(t.q('#go').textContent, 'Stop', 'Mike is on');
    const g = c.nodes.find(n => n.kind === 'gain'); T.eq(g.gain.log.map(x => x[0] + ':' + x[1]).join(','), 'set:0,lin:0.8', 'gain fades in from 0 to 80% (no squeal)');
    T.eq(c.nodes.filter(n => n.kind === 'comp').length, 1, 'limiter present'); t.type('#gain', '300'); T.near(g.gain.target, 3, 1e-9, 'boost up to 300% maps to gain 3');
    t.click('#go'); T.eq(M.liveTracks().length, 0, 'Mike: Stop releases the microphone'); T.eq(M.openCtxs().length, 0, 'Mike: Stop closes the context');
    M.delay = 0; t.click('#go'); await wait(30); T.eq(t.q('#go').textContent, 'Stop', 'Mike can start again');
    await leaves(t, b0, 'mike');
  }

  /* ================= Voice Recorder ================= */
  {
    reset(); const b0 = base(); let t = await page.open('recorder'); await wait(50);
    T.has(t.text(), 'No recordings yet', 'recorder: empty state'); T.has(t.q('#cnt').textContent, '0 of 3 (free)', 'recorder: free limit shown'); T.ok(!t.q('#rec').disabled, 'Record enabled once the list is loaded');
    M.mode = 'denied'; t.click('#rec'); await wait(20); T.has(t.q('#msg').textContent, 'permission', 'recorder denied: message'); T.has(t.q('#msg').textContent, 'Settings', 'recorder denied: says where'); T.ok(!t.q('#rec').disabled, 'Record usable again after a denial'); T.eq(M.recorders.length, 0, 'no recorder created when denied');
    M.mode = 'ok'; M.delay = 20; M.calls.length = 0; t.click('#rec'); t.click('#rec'); await wait(60);
    T.eq(M.calls.length, 1, 'recorder: double tap asks the microphone once'); T.eq(M.recorders.length, 1, 'only one MediaRecorder'); T.has(t.q('#st').textContent, 'Recording', 'status says Recording');
    T.ok(t.q('#rec').disabled && !t.q('#sp').disabled, 'Record disabled, Stop enabled while recording');
    t.click('#pa'); T.eq(t.q('#st').textContent, 'Paused', 'paused'); T.eq(M.recorders[0].state, 'paused', 'recorder paused'); t.click('#pa'); T.eq(M.recorders[0].state, 'recording', 'resumed');
    t.click('#sp'); await wait(80); T.eq(M.liveTracks().length, 0, 'recorder: microphone released after Stop'); T.eq(t.all('#list .item').length, 1, 'recording saved to the list'); T.has(t.q('#cnt').textContent, '1 of 3', 'count updated');
    T.has(t.text(), 'Recording 20', 'default name begins with Recording and the year');
    // rename (with markup in the name) and delete needs two taps
    t.click('[data-a=ren]'); t.q('.nm').value = '<img src=x onerror=1>My memo'; t.click('[data-a=ok]'); await wait(30);
    T.ok(!t.has('#list img'), 'recording name is escaped'); T.has(t.text(), '<img src=x onerror=1>My memo', 'name shown as text');
    // share path hands the file to Filesystem + Share
    w.eval("window.__sh = []; window.__fs = []; window.Capacitor = { Plugins: { Filesystem: { writeFile: async o => { __fs.push(o.path); return { uri: 'file:///c/' + o.path }; }, appendFile: async () => {}, deleteFile: async () => {} }, Share: { share: async o => { __sh.push(o); } } } };");
    t.click('[data-a=share]'); await wait(80); T.eq(w.__sh.length, 1, 'share opens the share sheet once'); T.ok(/\.webm$/.test(w.__fs[0]), 'file saved with .webm extension'); T.has(w.__fs[0], 'My memo', 'file named after the recording (special characters dropped)'); T.ok(!/[<>=]/.test(w.__fs[0]), 'file name has no special characters');
    w.eval('delete window.Capacitor');
    t.click('[data-a=del]'); T.has(t.q('[data-a=del]').textContent, 'Sure?', 'delete asks again'); T.eq(t.all('#list .item').length, 1, 'still there after one tap'); t.click('[data-a=del]'); await wait(40); T.eq(t.all('#list .item').length, 0, 'deleted after the second tap');
    // free limit: three recordings fit, the fourth opens the Pro sheet without touching the microphone
    M.delay = 0;
    for (let i = 0; i < 3; i++) { t.click('#rec'); await wait(40); t.click('#sp'); await wait(60); }
    T.eq(t.all('#list .item').length, 3, 'three recordings saved'); T.has(t.q('#cnt').textContent, '3 of 3', 'limit reached'); M.calls.length = 0; t.click('#rec'); await wait(20);
    T.eq(asked().join(','), 'recordings', 'fourth recording opens the Pro sheet (needPro recordings)'); T.eq(M.calls.length, 0, 'and does not start the microphone');
    pro(true); t.click('#rec'); await wait(40); t.click('#sp'); await wait(60); T.eq(t.all('#list .item').length, 4, 'Pro: a fourth recording is saved'); T.eq(t.q('#cnt').textContent, 'Saved recordings: 4', 'Pro: no limit shown'); pro(false);
    // leaving during a recording releases everything and saves nothing new
    pro(true); t.click('#rec'); await wait(40); T.eq(M.liveTracks().length, 1, 'recording holds the microphone'); const n = M.recorders.length;
    await leaves(t, b0, 'recorder (recording)'); T.eq(M.recorders[n - 1].state, 'inactive', 'recorder stopped on leave'); pro(false);
    T.ok(M.db && M.db.closed, 'database closed once the memo was saved after leaving');
    t = await page.open('recorder'); await wait(50); T.eq(t.all('#list .item').length, 5, 'recordings survive reopening and a memo left mid-recording is saved, not lost (regression)'); t.close();
    // a recording that returns no data
    t = await page.open('recorder'); await wait(50); pro(true); t.click('#rec'); await wait(40); M.recorders[M.recorders.length - 1].data = null; t.click('#sp'); await wait(60); T.eq(t.all('#list .item').length, 5, 'empty recording is not saved'); T.eq(M.liveTracks().length, 0, 'empty recording still releases the microphone'); pro(false); t.close();
  }

  /* ================= Piano ================= */
  {
    reset(); let t = await page.open('piano');
    const keys = t.all('#kb > div'); T.eq(keys.length, 15, 'piano has 15 keys');
    T.eq(keys.filter(k => k.style.zIndex === '1').length, 9, '9 white keys in C to D'); T.eq(keys.filter(k => k.style.zIndex === '2').length, 6, '6 black keys in C to D'); T.has(t.q('#ol').textContent, 'C4 to D5', 'range label');
    let target = null; w.document.elementFromPoint = () => target;
    const freqOf = (i) => 440 * Math.pow(2, (60 + i - 69) / 12);
    const press = (i, id) => { target = t.all('#kb > div')[i]; ptr(t.q('#kb'), 'pointerdown', id || 1, 5, 5); };
    press(0, 1); const c = lastCtx(); T.near(c.oscs()[0].frequency.value, 261.6256, 0.001, 'first key is middle C 261.63 Hz');
    press(9, 2); T.near(c.oscs()[1].frequency.value, 440, 1e-9, 'key index 9 is A4 440 Hz'); press(14, 3); T.near(c.oscs()[2].frequency.value, freqOf(14), 1e-6, 'last key is D5');
    ptr(t.q('#kb'), 'pointerup', 1); ptr(t.q('#kb'), 'pointerup', 2); ptr(t.q('#kb'), 'pointerup', 3);
    t.click('#ou'); t.click('#ou'); t.click('#ou'); T.has(t.q('#ol').textContent, 'C6 to D7', 'octave up stops at +2');
    press(0, 4); T.near(lastCtx().oscs().slice(-1)[0].frequency.value, 1046.5023, 0.001, 'two octaves up the first key is C6 1046.5 Hz'); ptr(t.q('#kb'), 'pointerup', 4);
    for (let i = 0; i < 6; i++) t.click('#od'); T.has(t.q('#ol').textContent, 'C2 to D3', 'octave down stops at -2');
    t.select('#wf', 'square'); press(0, 5); T.eq(lastCtx().oscs().slice(-1)[0].type, 'square', 'waveform choice is used');
    ptr(t.q('#kb'), 'pointercancel', 5); t.close(); await wait(50); T.eq(M.openCtxs().length, 0, 'piano: context closed on leave');
  }

  /* ================= Spectrum ================= */
  {
    reset(); const b0 = base(); let t = await page.open('spectrum');
    M.mode = 'denied'; t.click('#go'); await wait(20); T.has(t.q('#msg').textContent, 'permission', 'spectrum denied: message'); T.eq(t.q('#go').textContent, 'Start', 'spectrum: still Start');
    M.mode = 'ok'; M.delay = 20; M.calls.length = 0; t.click('#go'); t.click('#go'); await wait(70); T.eq(M.calls.length, 1, 'spectrum: double tap asks once'); M.delay = 0;
    // peak at bin 40 with neighbours 120 and 150: parabola offset 0.5*(120-150)/(120-400+150) = 0.1154 bins; bin width 48000/2048 = 23.4375 Hz
    M.bytes = (b) => { b.fill(0); b[40] = 200; b[39] = 120; b[41] = 150; }; await wait(80);
    T.eq(t.q('#pk').textContent, String(Math.round((40 + 0.5 * (120 - 150) / (120 - 400 + 150)) * 23.4375)), 'loudest frequency interpolated between bins (940 Hz)');
    M.bytes = (b) => { b.fill(0); b[1] = 255; b[10] = 100; }; await wait(80); T.eq(t.q('#pk').textContent, '234', 'DC/rumble bin 1 is ignored; bin 10 = 234 Hz');
    M.bytes = (b) => { b.fill(0); b[10] = 50; }; await wait(80); T.eq(t.q('#pk').textContent, '--', 'a quiet room shows --');
    t.click('#go'); T.eq(M.liveTracks().length, 0, 'spectrum: Stop releases the microphone'); T.eq(M.openCtxs().length, 0, 'spectrum: Stop closes the context');
    t.click('#go'); await wait(30); await leaves(t, b0, 'spectrum');
  }

  /* ================= Sleep Sounds ================= */
  {
    reset(); const b0 = base(); let t = await page.open('sleepsounds');
    T.eq(t.all('#snd button').map(b => b.textContent).join(', '), 'White noise, Pink noise, Brown noise, Rain, Ocean, Wind', 'six sounds'); T.ok(t.q('#go').disabled, 'Play disabled until a sound is chosen'); T.has(t.text(), 'Choose a sound', 'prompt shown');
    const nc0 = M.ctxs.length; t.clickText('Pink noise'); const c = lastCtx(); T.eq(t.q('#go').textContent, 'Stop', 'tapping a sound starts it'); await wait(600); T.has(t.q('#cd').textContent, 'Sleep timer: 00:30:0', 'default 30 minute timer counting down');
    const m = c.nodes.find(n => n.kind === 'gain'); T.near(m.gain.target, 0.5 * 0.5 * 0.8, 1e-9, 'default volume 50% maps to master gain 0.2 (squared curve, max 0.8)');
    T.ok(c.nodes.filter(n => n.kind === 'bufsrc').every(s => s.loop === true), 'noise buffer loops'); const first = c.nodes.filter(n => n.kind === 'bufsrc' && n.started);
    t.clickText('Brown noise'); T.ok(first.every(n => n.stopped), 'switching sound stops the previous one'); T.eq(M.ctxs.length, nc0 + 1, 'switching reuses the same context');
    t.type('#vol', '100'); T.near(m.gain.target, 0.8, 1e-9, 'volume 100% is gain 0.8'); T.eq(w.localStorage.getItem('pk.sleep.vol'), '100', 'volume remembered');
    const ivBefore = M.live().intervals; t.clickText('Rain'); await wait(200); T.eq(M.live().intervals, ivBefore + 1, 'rain schedules drops with one timer'); const drops = c.nodes.filter(n => n.kind === 'bufsrc').length; await wait(250); T.ok(c.nodes.filter(n => n.kind === 'bufsrc').length > drops, 'rain keeps adding drops');
    t.click('#go'); T.eq(t.q('#go').textContent, 'Play', 'Stop button'); await wait(400); T.eq(M.live().intervals, ivBefore, 'the rain timer stops after Stop');
    // sleep timer fades out and says so; a faked clock jumps 31 minutes
    t.select('#tm', '30'); t.clickText('Wind'); const realNow = w.Date.now; const t0 = realNow.call(w.Date); w.Date.now = () => t0 + 31 * 60000; await wait(700);
    T.has(t.q('#cd').textContent, 'Timer finished', 'timer finished message'); T.eq(t.q('#go').textContent, 'Play', 'playback stopped when the timer ends'); w.Date.now = realNow;
    t.select('#tm', '0'); t.clickText('Ocean'); await wait(600); T.has(t.q('#cd').textContent, 'Playing: Ocean', 'no timer shows Playing');
    await leaves(t, b0, 'sleepsounds');
  }

  /* ================= Drum Pad ================= */
  {
    reset(); const b0 = base(); let t = await page.open('drumpad');
    const pads = t.all('#pads button'); T.eq(pads.map(b => b.textContent).join(','), 'Kick,Snare,Clap,Hi-hat,Open hat,Tom,Rim,Cowbell', 'eight pads');
    T.ok(pads.every(b => b.offsetHeight >= 0 && parseInt(b.style.height, 10) >= 44), 'pads are at least 44 px tall'); const nd0 = M.ctxs.length;
    ptr(pads[0], 'pointerdown', 1); const c = lastCtx(); const kick = c.oscs()[0];
    T.eq(kick.frequency.log[0].slice(0, 2).join(':'), 'set:160', 'kick starts at 160 Hz'); T.eq(kick.frequency.log[1].slice(0, 2).join(':'), 'exp:40', 'and falls to 40 Hz');
    const n1 = c.nodes.length; for (let i = 1; i < 8; i++) ptr(pads[i], 'pointerdown', i + 1); T.ok(c.nodes.length > n1 + 8, 'every pad makes sound'); T.eq(M.ctxs.length, nd0 + 1, 'one context for all pads (created on the first hit)');
    T.eq(c.nodes.filter(n => n.kind === 'osc').length > 4, true, 'oscillator pads fired');
    t.type('#vol', '30'); T.near(c.nodes.find(n => n.kind === 'gain').gain.value, 0.3, 1e-9, 'volume slider sets master level');
    await leaves(t, b0, 'drumpad');
  }

  /* ================= Hearing Test ================= */
  {
    reset(); const b0 = base(); let t = await page.open('eartest');
    T.ok(t.q('#rp').disabled, 'Replay disabled before the test starts'); T.eq(t.q('#vol').max, '60', 'volume slider is capped at 60%'); T.has(t.text(), 'headphones', 'headphone advice');
    t.select('#ear', '-1'); t.click('#go'); let c = lastCtx(); T.eq(c.oscs()[0].frequency.value, 4000, 'test starts at 4 kHz'); T.eq(c.nodes.find(n => n.kind === 'pan').pan.value, -1, 'left ear = pan -1'); T.has(t.q('#msg').textContent, '1 of 11', 'progress shown');
    T.near(c.nodes.find(n => n.kind === 'gain').gain.target, 0.04, 1e-9, 'default 20% is a gain of 0.04 (squared)');
    t.type('#vol', '60'); T.near(c.nodes.find(n => n.kind === 'gain').gain.target, 0.36, 1e-9, 'loudest setting is gain 0.36, never more');
    const seq = [4000]; for (let i = 0; i < 4; i++) { t.click('#yes'); seq.push(lastCtx().oscs().slice(-1)[0].frequency.value); } T.eq(seq.join(','), '4000,8000,10000,12000,14000', 'tones step up when heard');
    t.click('#no'); T.has(t.q('#res').textContent, '12 kHz', 'highest tone heard is the last one answered yes'); T.eq(t.q('#go').textContent, 'Start again', 'can run again'); t.click('#no'); T.has(t.q('#res').textContent, '12 kHz', 'extra tap on "Cannot hear" after finishing changes nothing');
    t.select('#ear', '1'); t.click('#go'); T.eq(lastCtx().nodes.filter(n => n.kind === 'pan').slice(-1)[0].pan.value, 1, 'right ear = pan +1'); t.click('#no'); T.has(t.q('#res').textContent, 'did not report', 'nothing heard gives a clear message');
    t.click('#go'); for (let i = 0; i < 11; i++) t.click('#yes'); T.has(t.q('#res').textContent, '20 kHz', 'hearing every tone ends at 20 kHz'); T.ok(t.q('#ans').style.display === 'none', 'answer buttons hidden after the end');
    t.click('#go'); const o = lastCtx().oscs().slice(-1)[0]; await wait(2650); T.ok(o.stopped, 'a tone stops by itself after 2.5 s');
    t.click('#go'); await leaves(t, b0, 'eartest');
  }

  /* ================= Binaural Beats ================= */
  {
    reset(); const b0 = base(); let t = await page.open('binaural');
    T.has(t.q('#cr').textContent, 'Left 200 Hz, right 210 Hz', 'default carrier 200 Hz, beat 10 Hz'); t.clickText('Delta 2 Hz (sleep)'); T.has(t.q('#cr').textContent, 'right 202 Hz', 'delta preset sets 2 Hz'); T.eq(t.q('#bt').textContent, '2', 'beat shown');
    t.clickText('Gamma 40 Hz (alert)'); T.eq(t.value('#beat'), '40', 'gamma preset is 40 Hz'); t.clickText('Theta 6 Hz (relax)'); t.type('#car', '300');
    t.click('#go'); const c = lastCtx(), os = c.oscs(), pans = c.nodes.filter(n => n.kind === 'pan');
    T.eq(os.map(o => o.frequency.value).join(','), '300,306', 'left 300 Hz, right 306 Hz'); T.eq(pans.map(p => p.pan.value).join(','), '-1,1', 'one tone per ear');
    T.near(c.nodes.find(n => n.kind === 'gain' && n.gain.target !== undefined).gain.target, 0.09 * 0.5, 1e-9, 'default 30% volume gives gain 0.045'); await wait(600); T.ok(/Stops in (20:00|19:5\d)/.test(t.q('#cd').textContent), 'default 20 minute timer');
    t.type('#beat', '10'); T.eq(os[1].frequency.target, 310, 'beat changes live'); const real = w.Date.now, t0 = real.call(w.Date); w.Date.now = () => t0 + 21 * 60000; await wait(700); w.Date.now = real;
    T.eq(t.q('#go').textContent, 'Play', 'timer stops the beats'); await wait(1000); T.eq(c.state, 'closed', 'context closed after the fade');
    t.click('#go'); await leaves(t, b0, 'binaural');
  }

  /* ================= Remembered settings (not the volume) ================= */
  {
    reset(); let t = await page.open('tonegen'); t.select('#wf', 'triangle'); t.type('#num', '1000'); t.type('#vol', '60'); t.close();
    t = await page.open('tonegen'); T.eq(t.value('#wf'), 'triangle', 'tone generator remembers the waveform'); T.eq(t.value('#num'), '1000', 'and the frequency'); T.eq(t.q('#hzv').textContent, '1000', 'and shows it'); T.eq(t.value('#vol'), '25', 'but always starts at 25% volume (safety)'); t.close();
    t = await page.open('sleepsounds'); t.select('#tm', '60'); t.close(); t = await page.open('sleepsounds'); T.eq(t.value('#tm'), '60', 'sleep sounds remembers the timer'); T.eq(t.all('#snd button').length, 6, 'sounds intact'); t.close();
    t = await page.open('binaural'); t.type('#beat', '6'); t.type('#car', '250'); t.select('#tm', '30'); t.type('#vol', '90'); t.close(); t = await page.open('binaural'); T.eq(t.value('#beat') + ',' + t.value('#car') + ',' + t.value('#tm'), '6,250,30', 'binaural remembers beat, carrier and timer'); T.has(t.q('#cr').textContent, 'Left 250 Hz, right 256 Hz', 'and shows them'); T.eq(t.value('#vol'), '30', 'volume is not remembered'); t.close();
    t = await page.open('eartest'); t.select('#ear', '1'); t.type('#vol', '50'); t.close(); t = await page.open('eartest'); T.eq(t.value('#ear'), '1', 'hearing test remembers the ear'); T.eq(t.value('#vol'), '20', 'but not the volume'); t.close();
    t = await page.open('piano'); t.select('#wf', 'square'); t.close(); t = await page.open('piano'); T.eq(t.value('#wf'), 'square', 'piano remembers the sound'); t.close();
    t = await page.open('drumpad'); t.type('#vol', '35'); t.close(); t = await page.open('drumpad'); T.eq(t.value('#vol'), '35', 'drum pad remembers the volume'); t.close();
    w.localStorage.setItem('pk.mem.tonegen', '{"wf":"bogus","num":"abc"}'); t = await page.open('tonegen'); T.eq(t.value('#wf'), 'sine', 'a corrupt remembered waveform is ignored'); t.close(); w.localStorage.setItem('pk.mem.tonegen', '5'); t = await page.open('tonegen'); T.eq(t.value('#num'), '440', 'corrupt storage is ignored'); t.close();
  }


  /* ================= Voice Recorder: long recordings are shared in pieces ================= */
  {
    reset(); pro(true); w.localStorage.clear(); const t = await page.open('recorder'); await wait(60);
    t.click('#rec'); await wait(40); M.recorders[M.recorders.length - 1].data = 'x'.repeat(7 * 1024 * 1024); t.click('#sp'); await wait(300);
    w.eval("window.__w = []; window.__a = []; window.__s = []; window.Capacitor = { Plugins: { Filesystem: { writeFile: async o => { __w.push([o.path, o.directory]); return { uri: 'file:///cache/' + o.path }; }, appendFile: async o => { __a.push(o.path); }, deleteFile: async () => {} }, Share: { share: async o => { __s.push(o); } } } };");
    t.click('[data-a=share]'); await wait(500); T.eq(w.__w.length + ',' + w.__a.length + ',' + w.__s.length, '1,2,1', 'a 7 MB recording is written as 1 + 2 pieces and shared once'); T.eq(w.__w[0][1], 'CACHE', 'in the cache folder');
    w.eval("window.Capacitor.Plugins.Filesystem.writeFile = async () => { throw new Error('x'); };"); t.click('[data-a=share]'); await wait(300); T.eq(M.downloads.length, 1, 'if the phone cannot write the file the recording is downloaded instead'); T.ok(/\.webm$/.test(M.downloads[0].name), 'as .webm'); w.eval('delete window.Capacitor'); pro(false); t.close(); await wait(50);
  }


  /* ================= Edge cases ================= */
  {
    reset(); w.localStorage.clear(); pro(true); let t = await page.open('recorder'); await wait(60); const before = t.all('#list .item').length;
    t.click('#rec'); await wait(40); t.click('#pa'); T.eq(t.q('#st').textContent, 'Paused', 'paused'); const n = M.recorders.length; t.close(); await wait(100);
    T.eq(M.liveTracks().length, 0, 'recorder: leaving while paused releases the microphone'); t = await page.open('recorder'); await wait(60); T.eq(t.all('#list .item').length, before + 1, 'and the paused recording is saved'); t.close(); pro(false);
    // piano: sliding a finger from one key to the next stops the first note and starts the next
    t = await page.open('piano'); let target = null; w.document.elementFromPoint = () => target; const keys = t.all('#kb > div');
    target = keys[0]; ptr(t.q('#kb'), 'pointerdown', 7, 5, 5); const c = lastCtx(), count = c.oscs().length; target = keys[2]; ptr(t.q('#kb'), 'pointermove', 7, 30, 5);
    T.eq(c.oscs().length, count + 1, 'sliding onto another key starts its note'); T.ok(c.oscs()[count - 1].stopAt !== undefined, 'and releases the first one'); target = keys[2]; ptr(t.q('#kb'), 'pointermove', 7, 31, 5); T.eq(c.oscs().length, count + 1, 'staying on the same key does not retrigger'); ptr(t.q('#kb'), 'pointerup', 7, 31, 5); ptr(t.q('#kb'), 'pointermove', 7, 31, 5); T.eq(c.oscs().length, count + 1, 'moving after lifting does nothing'); t.close();
  }


  await T.done(page);
})();
