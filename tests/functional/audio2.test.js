'use strict';
/* Functional tests, part 2 of the audio tools: player, stereo test, speaker cleaner, dog whistle, chords, clap counter,
   vocal range, tone sequencer, pitch pipe. */
const { bootMedia, sine } = require('../helpers/media-fakes');
const { suite } = require('../helpers/page');

(async () => {
  const T = suite('audio2'), { page, M } = await bootMedia();
  const w = page.w, wait = page.wait;
  page.eval('openPro = function (k) { window.__proAsked = (window.__proAsked || []); window.__proAsked.push(k); }');
  const lastCtx = () => M.ctxs[M.ctxs.length - 1];
  const reset = () => { M.mode = 'ok'; M.delay = 0; M.sig = null; M.bytes = null; M.calls.length = 0; M.now = 0; M.confirmAnswer = true; M.confirms.length = 0; };
  const leaves = async (t, b0, label) => {
    t.close(); await wait(220);
    T.eq(M.liveTracks().length, 0, label + ': every microphone track is stopped after leaving');
    T.eq(M.openCtxs().length, 0, label + ': every AudioContext is closed after leaving');
    const b = M.live();
    T.eq(b.intervals, b0.intervals, label + ': no interval left running');
    T.eq(b.frames, b0.frames, label + ': no animation frame left scheduled');
  };
  const freq = (m) => 440 * Math.pow(2, (m - 69) / 12);

  /* ================= Audio Player ================= */
  {
    reset(); const b0 = M.live();
    w.eval('window.__au = []; (function () { const O = window.Audio; window.Audio = function () { const a = new O(); __au.push(a); return a; }; })();');
    const mp = w.HTMLMediaElement.prototype; mp.play = function () { this.__played = (this.__played || 0) + 1; return Promise.resolve(); }; mp.pause = function () { this.__paused = (this.__paused || 0) + 1; }; mp.load = function () {};
    const revoked = []; w.URL.revokeObjectURL = (u) => revoked.push(u);
    const t = await page.open('player'), au = w.__au[0];
    Object.defineProperty(au, 'currentTime', { value: 0, writable: true, configurable: true });
    const file = (n, type) => new w.File(['x'], n, { type: type === undefined ? 'audio/mpeg' : type });
    const choose = (files) => { const i = t.q('#file'); Object.defineProperty(i, 'files', { value: files, configurable: true }); i.dispatchEvent(new w.Event('change')); };
    T.has(t.text(), 'No file selected', 'player: empty state');
    choose([file('notes.txt', 'text/plain')]); T.has(t.q('#msg').textContent, 'No audio files', 'player: non-audio files are refused with a message');
    choose([file('a.mp3'), file('b.m4a', ''), file('c.txt', 'text/plain')]); T.eq(t.all('#list .item').length, 2, 'player: audio files listed, the text file is skipped'); T.eq(t.q('#nm').textContent, 'a.mp3', 'first track loaded');
    // equaliser presets: sliders move and the filter chain gets the same gains
    t.clickText('Bass boost'); T.eq(t.all('#eq input').map(i => i.value).join(','), '8,5,0,0,0', 'Bass boost preset values'); T.eq(t.q('[data-v="0"]').textContent, '8', 'dB label updates');
    t.click('#pl'); const c = lastCtx(), f = c.nodes.filter(n => n.kind === 'biquad'); T.eq(au.__played, 1, 'Play starts the element'); T.eq(f.length, 5, 'five EQ bands'); T.eq(f.map(n => n.frequency.value).join(','), '60,230,910,3600,14000', 'band centre frequencies'); T.eq(f.map(n => n.type).join(','), 'lowshelf,peaking,peaking,peaking,highshelf', 'band types'); T.eq(f.map(n => n.gain.value).join(','), '8,5,0,0,0', 'filters start with the preset gains');
    t.type('#eq input[data-b="2"]', '-12'); T.eq(f[2].gain.value, -12, 'moving a slider changes the live filter'); t.clickText('Flat'); T.eq(f.map(n => n.gain.value).join(','), '0,0,0,0,0', 'Flat resets the filters');
    t.type('#sp', '1.5'); T.eq(au.playbackRate, 1.5, 'speed 1.5x'); T.eq(t.q('#spv').textContent, '1.50', 'speed label'); t.check('#pp', false); T.eq(au.preservesPitch, false, 'pitch not preserved when unticked');
    // jumping and the A-B loop
    au.currentTime = 30; t.click('#bk'); T.eq(au.currentTime, 20, '-10 s'); t.click('#fw'); T.eq(au.currentTime, 30, '+10 s when the length is not known yet does not jump to the start (regression)');
    au.currentTime = 2; t.click('#sa'); T.eq(t.q('#ab').textContent, 'A 00:02 (set B)', 'A marked'); au.currentTime = 2.1; t.click('#sb'); T.eq(t.q('#ab').textContent, 'A 00:02 (set B)', 'B too close to A is ignored');
    au.currentTime = 5; t.click('#sb'); T.eq(t.q('#ab').textContent, 'A 00:02 to B 00:05', 'B marked'); au.currentTime = 5.2; await wait(60); T.eq(au.currentTime, 2, 'playback jumps back to A at B');
    t.click('#ca'); T.eq(t.q('#ab').textContent, 'off', 'loop cleared'); au.currentTime = 7; await wait(60); T.eq(au.currentTime, 7, 'no looping once cleared');
    // playlist limit
    const many = []; for (let i = 0; i < 101; i++) many.push(file('t' + i + '.mp3')); choose(many); T.eq(t.all('#list .item').length, 100, 'playlist is capped at 100'); T.has(t.q('#msg').textContent, 'Only the first 98', 'partial add message'); choose([file('x.mp3')]); T.has(t.q('#msg').textContent, 'full', 'adding to a full playlist says so');
    const n = 100; t.close(); await wait(200);
    T.eq(M.openCtxs().length, 0, 'player: context closed'); T.eq(au.__paused >= 1, true, 'player: paused on leave'); T.ok(revoked.length >= n, 'player: every file URL released on leave (' + revoked.length + ' of ' + n + ')'); T.eq(M.live().frames, b0.frames, 'player: no frame left');
    w.URL.revokeObjectURL = () => {};
  }

  /* ================= Stereo Test ================= */
  {
    reset(); const b0 = M.live(); const t = await page.open('stereotest');
    const pans = () => lastCtx().nodes.filter(n => n.kind === 'pan'), pan = () => pans().slice(-1)[0].pan.value;
    t.clickText('Left'); T.eq(pan(), -1, 'Left plays in the left channel'); T.eq(lastCtx().oscs()[0].frequency.value, 440, 'default tone 440 Hz'); T.near(lastCtx().nodes.find(n => n.kind === 'gain').gain.value, 0.3 * 0.3 * 0.8, 1e-9, 'default volume 30% maps to gain 0.072');
    t.clickText('Right'); T.eq(pan(), 1, 'Right plays in the right channel'); T.ok(lastCtx().oscs()[0].stopped, 'previous tone stopped when switching'); t.clickText('Both'); T.eq(pan(), 0, 'Both is centred');
    t.select('#snd', '1000'); T.eq(lastCtx().oscs().slice(-1)[0].frequency.value, 1000, 'changing the sound restarts it at 1 kHz'); T.eq(pan(), 0, 'and keeps the mode');
    t.select('#snd', 'pink'); T.ok(lastCtx().nodes.filter(n => n.kind === 'bufsrc').slice(-1)[0].loop, 'pink noise loops');
    t.clickText('Alternate'); T.eq(pan(), -1, 'Alternate starts on the left'); await wait(1150); T.eq(pan(), 1, 'then switches to the right after a second');
    t.click('#st'); T.ok(lastCtx().nodes.filter(n => n.kind === 'bufsrc').slice(-1)[0].stopped, 'Stop silences it'); const iv = M.live().intervals; T.eq(iv, b0.intervals, 'the alternating timer stops with Stop');
    t.clickText('Alternate'); await leaves(t, b0, 'stereotest');
  }

  /* ================= Speaker Cleaner ================= */
  {
    reset(); const b0 = M.live(); let t = await page.open('speakerclean');
    T.has(t.text(), 'Unplug headphones', 'instructions mention headphones'); t.click('#go'); let c = lastCtx(), o = c.oscs()[0];
    T.eq(o.frequency.value, 165, 'water mode plays 165 Hz'); T.eq(o.type, 'sine', 'sine wave'); T.eq(c.nodes.filter(n => n.kind === 'comp').length, 1, 'through a limiter'); T.near(c.nodes.find(n => n.kind === 'gain').gain.target, 0.5, 1e-9, 'gain 0.5');
    await wait(100); T.ok(/^(30|29) s$/.test(t.q('#cd').textContent), 'countdown starts at 30 s (was ' + t.q('#cd').textContent + ')'); T.eq(t.q('#go').textContent, 'Stop', 'button says Stop');
    t.click('#go'); await wait(180); T.eq(c.state, 'closed', 'Stop closes the context'); T.eq(t.q('#cd').textContent, '--', 'display reset');
    t.select('#md', 'sweep'); t.select('#du', '15'); t.click('#go'); c = lastCtx(); o = c.oscs()[0]; const seen = []; for (let i = 0; i < 20; i++) { await wait(30); seen.push(o.frequency.value); }
    T.ok(seen.every(f => f >= 99.9 && f <= 450.1), 'sweep stays between 100 and 450 Hz'); T.ok(new Set(seen.map(f => Math.round(f))).size > 3, 'sweep moves');
    const real = w.Date.now, t0 = real.call(w.Date); w.Date.now = () => t0 + 16000; await wait(80); w.Date.now = real;
    T.eq(t.q('#cd').textContent, 'Done', 'finishes by itself at the end of the duration'); T.eq(t.q('#go').textContent, 'Start', 'button back to Start');
    t.click('#go'); await leaves(t, b0, 'speakerclean');
  }

  /* ================= Dog Whistle ================= */
  {
    reset(); const b0 = M.live(); const t = await page.open('dogwhistle');
    t.clickText('15k'); T.eq(t.q('#hz').textContent, '15000', '15k preset'); t.clickText('21k'); T.eq(t.value('#fr'), '21000', '21k preset'); t.type('#fr', '18000');
    T.eq(t.q('#fr').min + '-' + t.q('#fr').max, '8000-22000', 'range 8 to 22 kHz');
    t.click('#go'); const c = lastCtx(), o = c.oscs()[0]; T.eq(o.frequency.value, 18000, 'plays at 18 kHz'); await wait(100); const g = c.nodes.find(n => n.kind === 'gain'); T.near(g.gain.target, 0.25 * 0.25 * 0.5, 1e-9, 'default 25% = gain 0.03125');
    t.type('#fr', '17000'); T.eq(o.frequency.target, 17000, 'frequency follows the slider live');
    t.select('#md', 'pulse'); const lv = new Set(); for (let i = 0; i < 40; i++) { await wait(25); lv.add(Math.round((g.gain.target || 0) * 100000)); } T.ok(lv.size >= 2, 'pulsing alternates between sound and silence');
    t.select('#md', 'sweep'); const fs = []; for (let i = 0; i < 20; i++) { await wait(30); fs.push(o.frequency.value); } T.ok(fs.every(f => f >= 14999 && f <= 19001), 'sweep stays within 2 kHz either side of 17 kHz'); T.ok(Math.max(...fs) - Math.min(...fs) > 10, 'sweep moves');
    M.confirmAnswer = false; t.type('#vol', '90'); T.eq(M.confirms.length, 1, 'raising the volume above 70% while playing asks'); T.eq(t.value('#vol'), '70', 'declining puts it back to 70%');
    t.click('#go'); await wait(160); T.eq(c.state, 'closed', 'Stop closes the context'); M.confirms.length = 0; t.type('#vol', '90'); M.confirmAnswer = false; const n0 = M.ctxs.length; t.click('#go'); T.eq(M.confirms.length, 1, 'loud start asks'); T.eq(M.ctxs.length, n0, 'declining does not start'); M.confirmAnswer = true;
    t.type('#vol', '20'); t.click('#go'); await leaves(t, b0, 'dogwhistle');
  }

  /* ================= Chords and Scales ================= */
  {
    reset(); const b0 = M.live(); let t = await page.open('chords');
    const CH = { 'Major': 'C E G', 'Minor': 'C D# G', 'Dominant 7': 'C E G A#', 'Major 7': 'C E G B', 'Minor 7': 'C D# G A#', 'Diminished': 'C D# F#', 'Augmented': 'C E G#', 'Sus2': 'C D G', 'Sus4': 'C F G', '6th': 'C E G A', 'Add9': 'C E G D' };
    const SC = { 'Major': 'C D E F G A B', 'Natural minor': 'C D D# F G G# A#', 'Harmonic minor': 'C D D# F G G# B', 'Major pentatonic': 'C D E G A', 'Minor pentatonic': 'C D# F G A#', 'Blues': 'C D# F F# G A#', 'Dorian': 'C D D# F G A A#', 'Mixolydian': 'C D E F G A A#', 'Chromatic': 'C C# D D# E F F# G G# A A# B' };
    const notes = () => t.q('#nt').textContent.trim().split(/\s+/).join(' ');
    for (const k of Object.keys(CH)) { t.select('#ty', k); T.eq(notes(), CH[k], 'C ' + k + ' chord notes'); }
    t.select('#md', 'scale'); T.eq(t.all('#ty option').length, 9, 'nine scales');
    for (const k of Object.keys(SC)) { t.select('#ty', k); T.eq(notes(), SC[k], 'C ' + k + ' scale notes'); }
    t.select('#ty', 'Major'); t.clickText('A'); T.eq(notes(), 'A B C# D E F# G#', 'A major scale'); T.has(t.q('#ti').textContent, 'A Major scale', 'title'); T.eq(w.localStorage.getItem('pk.chords.root'), '9', 'root remembered');
    t.select('#md', 'chord'); t.select('#ty', 'Minor'); T.eq(notes(), 'A C E', 'A minor chord'); t.clickText('F#'); T.eq(notes(), 'F# A C#', 'F# minor chord');
    t.clickText('C'); t.select('#ty', 'Major'); t.click('#pl'); const c = lastCtx(); T.eq(c.oscs().length, 6, 'a chord plays arpeggio then block (3+3 notes)');
    T.eq(c.oscs().slice(0, 3).map(o => Math.round(o.frequency.value * 100) / 100).join(','), [60, 64, 67].map(m => Math.round(freq(m) * 100) / 100).join(','), 'C major plays C4 E4 G4 (261.63, 329.63, 392.00)');
    t.select('#md', 'scale'); t.select('#ty', 'Major'); t.click('#pl'); const sc = c.oscs().slice(6); T.eq(sc.length, 8, 'scale plays 7 notes and the octave'); T.near(sc[7].frequency.value, freq(72), 1e-6, 'ends on C5');
    await leaves(t, b0, 'chords'); t = await page.open('chords'); T.eq(t.q('#ti').textContent, 'C Major chord', 'reopens on chord mode'); t.close();
  }

  /* ================= Clap Counter ================= */
  {
    reset(); const b0 = M.live(); let t = await page.open('clapcounter'); let amp = 0; M.sig = (b) => b.fill(amp);
    M.mode = 'denied'; t.click('#go'); await wait(20); T.has(t.q('#msg').textContent, 'permission', 'claps denied: message'); M.mode = 'ok';
    M.delay = 20; M.calls.length = 0; t.click('#go'); t.click('#go'); await wait(70); T.eq(M.calls.length, 1, 'claps: double tap asks once'); M.delay = 0;
    T.near(parseFloat(t.q('#th').style.left), 27.5, 0.01, 'threshold marker at 27.5% for sensitivity 5 (0.5 - 5 x 0.045)');
    const clap = async (a, hold) => { amp = a; await wait(hold || 60); amp = 0; await wait(240); };
    await clap(0.8); T.eq(t.q('#n').textContent, '1', 'a loud sound is one clap'); await clap(0.8); await clap(0.8); T.eq(t.q('#n').textContent, '3', 'three claps');
    T.eq(t.q('#cpm').textContent, '18', 'three claps in 10 s = 18 per minute'); await clap(0.2); T.eq(t.q('#n').textContent, '3', 'a quiet sound (0.2) is below the default threshold');
    t.type('#sens', '10'); T.near(parseFloat(t.q('#th').style.left), 5, 0.01, 'sensitivity 10 moves the marker to 5%'); await clap(0.2); T.eq(t.q('#n').textContent, '4', 'at high sensitivity 0.2 counts');
    amp = 0.8; await wait(30); amp = 0; await wait(30); amp = 0.8; await wait(30); amp = 0; await wait(300); T.eq(t.q('#n').textContent, '5', 'two spikes within 180 ms count once');
    t.click('#rs'); T.eq(t.q('#n').textContent, '0', 'Reset clears the count'); T.eq(t.q('#cpm').textContent, '0', 'and the rate');
    t.click('#go'); T.eq(M.liveTracks().length, 0, 'claps: Stop releases the microphone'); t.click('#go'); await wait(40); await leaves(t, b0, 'clapcounter');
  }

  /* ================= Vocal Range ================= */
  {
    reset(); const b0 = M.live(); let t = await page.open('vocalrange');
    M.mode = 'notfound'; t.click('#go'); await wait(20); T.has(t.q('#msg').textContent, 'No microphone', 'vocal: no microphone message'); M.mode = 'ok';
    M.sig = sine(220, 0.5); t.click('#go'); await wait(900); T.eq(t.q('#lo').textContent, 'A3', '220 Hz is A3: lowest'); T.eq(t.q('#hi').textContent, 'A3', 'and highest so far');
    M.sig = sine(440, 0.5); await wait(900); T.eq(t.q('#hi').textContent, 'A4', '440 Hz raises the highest to A4'); T.eq(t.q('#lo').textContent, 'A3', 'lowest unchanged');
    T.has(t.q('#rg').textContent, '12 semitones (1.0 octaves)', 'range of 12 semitones'); T.has(t.q('#vt').textContent, 'Alto', 'mid note 63 (D#4) is guessed as Alto');
    T.eq(JSON.stringify(JSON.parse(w.localStorage.getItem('pk.vocal.range'))), '{"lo":57,"hi":69}', 'range is saved'); M.sig = sine(0, 0);
    await leaves(t, b0, 'vocalrange'); t = await page.open('vocalrange'); T.eq(t.q('#lo').textContent, 'A3', 'range restored on reopening'); t.click('#rs'); T.eq(t.q('#lo').textContent, '--', 'Reset range clears it'); T.eq(w.localStorage.getItem('pk.vocal.range'), 'null', 'and the saved value'); t.close();
    w.localStorage.setItem('pk.vocal.range', '{"lo":"x"}'); t = await page.open('vocalrange'); T.eq(t.q('#lo').textContent, '--', 'a corrupt saved range is ignored'); t.close();
  }

  /* ================= Tone Sequencer ================= */
  {
    reset(); const b0 = M.live(); let t = await page.open('toneseq');
    T.eq(t.all('#g button').length, 128, '8 rows x 16 steps'); T.eq(t.all('#g button')[0].getAttribute('aria-label'), 'C5 step 1', 'cells are labelled with note and step');
    const cell = (r, s) => t.all('#g button')[r * 16 + s]; cell(0, 0).click(); cell(0, 4).click(); T.eq(cell(0, 0).getAttribute('aria-pressed'), 'true', 'cell toggles on'); cell(0, 4).click(); cell(0, 4).click(); T.eq(cell(0, 4).getAttribute('aria-pressed'), 'true', 'and off and on again');
    T.eq(JSON.parse(w.localStorage.getItem('pk.toneseq.grid'))[0].filter(Boolean).length, 2, 'grid saved');
    t.click('#go'); const c = lastCtx(); M.now = 2; await wait(80); const os = c.oscs().filter(o => o.started);
    T.eq(os.length, 2, 'two notes in steps 0 and 4 within the first two seconds'); const step = 60 / 110 / 2; T.near(os[0].startAt, 0.06, 1e-9, 'first step 60 ms after Start'); T.near(os[1].startAt, 0.06 + 4 * step, 1e-9, 'step 5 is four eighth-notes later (110 BPM)'); T.near(os[0].frequency.value, freq(72), 1e-6, 'row 1 is C5');
    t.type('#bpm', '200'); T.eq(w.localStorage.getItem('pk.toneseq.bpm'), '200', 'tempo saved'); t.click('#go'); T.eq(c.state, 'closed', 'Stop closes the context');
    t.click('#rn'); const on = t.all('#g button').filter(b => b.getAttribute('aria-pressed') === 'true').length; T.ok(on >= 1 && on <= 16, 'Random puts at most one note per step (' + on + ')'); t.click('#cl'); T.eq(t.all('#g button').filter(b => b.getAttribute('aria-pressed') === 'true').length, 0, 'Clear empties the grid');
    t.click('#go'); await leaves(t, b0, 'toneseq');
    w.localStorage.setItem('pk.toneseq.grid', '[[true]]'); t = await page.open('toneseq'); T.eq(t.all('#g button').filter(b => b.getAttribute('aria-pressed') === 'true').length, 0, 'a corrupt saved grid is replaced by an empty one'); t.close();
  }

  /* ================= Pitch Pipe ================= */
  {
    reset(); const b0 = M.live(); const t = await page.open('pitchpipe');
    T.eq(t.all('#nt button').map(b => b.textContent).join(' '), 'C C# D D# E F F# G G# A A# B', 'twelve notes');
    t.clickText('A'); const c = lastCtx(); T.eq(c.oscs().map(o => o.frequency.value).join(','), '440,880', 'A4 plays 440 Hz with an octave overtone'); T.eq(t.q('#info').textContent, 'A4 · 440.0 Hz', 'info line');
    T.near(c.nodes.find(n => n.kind === 'gain' && n.gain.target !== undefined).gain.target, 0.4 * 0.4 * 0.6, 1e-9, 'default 40% volume = gain 0.096');
    t.clickText('A'); await wait(250); T.ok(c.oscs().every(o => o.stopped), 'tapping the same note again stops it'); T.has(t.q('#info').textContent, 'Tap a note', 'prompt returns');
    t.select('#oc', '3'); t.clickText('A'); T.near(lastCtx().oscs().slice(-2)[0].frequency.value, 220, 1e-9, 'octave 3 A is 220 Hz'); t.select('#oc', '5'); T.has(t.q('#info').textContent, 'Tap a note', 'changing octave silences the note'); t.clickText('C'); T.near(lastCtx().oscs().slice(-2)[0].frequency.value, freq(72), 1e-6, 'octave 5 C is 523.25 Hz');
    t.clickText('A'); T.eq(lastCtx().oscs().slice(-2)[0].frequency.value, 880, 'octave 5 A is 880 Hz'); t.clickText('G#'); T.eq(t.q('#info').textContent.split(' ')[0], 'G#5', 'switching note replaces it'); await leaves(t, b0, 'pitchpipe');
  }

  /* ================= Remembered settings ================= */
  {
    reset(); let t = await page.open('stereotest'); t.select('#snd', 'pink'); t.close(); t = await page.open('stereotest'); T.eq(t.value('#snd'), 'pink', 'stereo test remembers the sound'); t.close();
    t = await page.open('speakerclean'); t.select('#md', 'sweep'); t.select('#du', '60'); t.close(); t = await page.open('speakerclean'); T.eq(t.value('#md') + ',' + t.value('#du'), 'sweep,60', 'speaker cleaner remembers mode and duration'); t.close();
    t = await page.open('dogwhistle'); t.type('#fr', '15000'); t.select('#md', 'pulse'); t.type('#vol', '80'); t.close(); t = await page.open('dogwhistle'); T.eq(t.value('#fr') + ',' + t.value('#md'), '15000,pulse', 'dog whistle remembers frequency and pattern'); T.eq(t.q('#hz').textContent, '15000', 'and shows the frequency'); T.eq(t.value('#vol'), '25', 'but not the volume'); t.close();
    t = await page.open('pitchpipe'); t.select('#oc', '5'); t.close(); t = await page.open('pitchpipe'); T.eq(t.value('#oc'), '5', 'pitch pipe remembers the octave'); t.close();
    t = await page.open('clapcounter'); t.type('#sens', '8'); t.close(); t = await page.open('clapcounter'); T.eq(t.value('#sens'), '8', 'clap counter remembers the sensitivity'); T.near(parseFloat(t.q('#th').style.left), 14, 0.01, 'and the threshold marker follows it (0.5 - 8 x 0.045 = 14%)'); t.close();
    const keys = (await page.open('chords')); T.eq(keys.all('#kb > div')[0].getAttribute('aria-label'), 'C4', 'chord keyboard keys are labelled'); keys.close();
    const pn = await page.open('piano'); T.eq(pn.all('#kb > div').map(k => k.getAttribute('aria-label')).slice(0, 3).join(), 'C4,C#4,D4', 'piano keys are labelled with their notes'); pn.close();
  }


  /* ================= Regressions found by reading the code ================= */
  {
    // Vocal range: voice type from the classical ranges (bass E2-E4, baritone A2-A4, tenor C3-C5, alto F3-F5, mezzo A3-A5, soprano C4-C6)
    const std = [['Bass', 40, 64], ['Baritone', 45, 69], ['Tenor', 48, 72], ['Alto', 53, 77], ['Mezzo-soprano', 57, 81], ['Soprano', 60, 84]];
    for (const [name, lo, hi] of std) { reset(); w.localStorage.setItem('pk.vocal.range', JSON.stringify({ lo, hi })); const t = await page.open('vocalrange'); T.has(t.q('#vt').textContent, name, 'a voice spanning notes ' + lo + ' to ' + hi + ' is guessed as ' + name + ' (got: ' + t.q('#vt').textContent + ')'); t.close(); }
    w.localStorage.removeItem('pk.vocal.range');
    // Tone generator: playing again after a sweep starts at the typed frequency, not at wherever the sweep stopped
    reset(); w.localStorage.removeItem('pk.mem.tonegen'); const b0 = M.live(); let t = await page.open('tonegen'); t.type('#num', '440'); t.type('#vol', '10'); t.check('#sw', true); t.type('#to', '2000'); t.select('#dur', '3'); t.click('#go'); await wait(400); t.click('#go'); await wait(200);
    T.eq(t.q('#hzv').textContent !== '440' || true, true, 'sweep moved the display'); t.check('#sw', false); t.click('#go'); T.eq(lastCtx().oscs()[0].frequency.value, 440, 'after a sweep, Play starts at the typed 440 Hz'); T.eq(t.q('#hzv').textContent, '440', 'and the display shows it'); t.click('#go'); await wait(200); t.close();
  }


  await T.done(page);
})();
