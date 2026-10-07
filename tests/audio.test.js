'use strict';
/* Pure-logic tests for the audio tools: note maths, pitch detection (YIN) on synthesized sounds, chord and scale tables, slider curves.
   The functions are cut out of www/js/tools/audio.js between the "// <pure>" markers, so this tests the real code. Run: node tests/audio.test.js */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'www', 'js', 'tools', 'audio.js'), 'utf8');
const block = src.slice(src.indexOf('// <pure>'), src.indexOf('// </pure>'));
if (!block) throw new Error('pure block not found');
const P = new Function(block + '; return { NOTE_NAMES, freqToMidi, midiToFreq, noteName, noteInfo, rms, yinPitch, median, CHORDS, SCALES, logSlider, logSliderInv };')();
let ok = 0, bad = 0;
const check = (c, m) => { if (c) ok++; else { bad++; console.log('FAIL: ' + m); } };
const near = (a, b, tol, m) => check(Math.abs(a - b) <= tol, m + ' (got ' + a + ', expected ' + b + ' +/- ' + tol + ')');

// --- note maths, with values computed from the definition A4 = 440 Hz = MIDI 69
near(P.freqToMidi(440), 69, 1e-12, 'A4 is MIDI 69'); near(P.freqToMidi(261.6256), 60, 1e-4, 'middle C is MIDI 60'); near(P.freqToMidi(880), 81, 1e-12, 'A5 is MIDI 81'); near(P.freqToMidi(27.5), 21, 1e-9, 'A0 is MIDI 21');
near(P.midiToFreq(69), 440, 1e-9, 'MIDI 69 is 440'); near(P.midiToFreq(60), 261.6256, 1e-3, 'MIDI 60 is 261.6256'); near(P.midiToFreq(0), 8.1758, 1e-3, 'MIDI 0 is 8.1758'); near(P.midiToFreq(127), 12543.85, 0.01, 'MIDI 127 is 12543.85');
for (let m = 0; m <= 127; m++) near(P.freqToMidi(P.midiToFreq(m)), m, 1e-9, 'round trip MIDI ' + m);
const names = { 60: 'C4', 61: 'C#4', 69: 'A4', 71: 'B4', 72: 'C5', 21: 'A0', 0: 'C-1', 127: 'G9', 59: 'B3' };
Object.keys(names).forEach(m => check(P.noteName(+m) === names[m], 'noteName(' + m + ') = ' + names[m] + ', got ' + P.noteName(+m)));
let n = P.noteInfo(440); check(n.name === 'A' && n.oct === 4 && n.cents === 0 && n.midi === 69, 'noteInfo(440) is A4, 0 cents');
// 445 Hz is 1200*log2(445/440) = 19.56 cents sharp -> 20; 430 Hz is -39.77 -> -40
n = P.noteInfo(445); check(n.name === 'A' && n.cents === Math.round(1200 * Math.log(445 / 440) / Math.LN2), 'noteInfo(445) is A, ' + Math.round(1200 * Math.log(445 / 440) / Math.LN2) + ' cents; got ' + n.cents);
n = P.noteInfo(430); check(n.name === 'A' && n.cents === -40, 'noteInfo(430) is A, -40 cents; got ' + n.name + ' ' + n.cents);
n = P.noteInfo(452.89); check(n.name === 'A#' || n.name === 'A', 'noteInfo(452.89) near the A/A# border, got ' + n.name);
n = P.noteInfo(466.16); check(n.name === 'A#' && Math.abs(n.cents) <= 1, 'noteInfo(466.16) is A#4');
n = P.noteInfo(8000); check(n.name === 'B' && n.oct === 8 || n.name === 'C' && n.oct === 9 || n.oct === 8, 'noteInfo(8000) is in octave 8 or 9: ' + n.name + n.oct);

// --- slider curves: 0 -> 20 Hz, 1000 -> 20 kHz, exact inverse
near(P.logSlider(0, 20, 20000), 20, 1e-9, 'slider 0 = 20 Hz'); near(P.logSlider(1000, 20, 20000), 20000, 1e-6, 'slider 1000 = 20 kHz'); near(P.logSlider(500, 20, 20000), Math.sqrt(20 * 20000), 1e-6, 'slider middle = geometric mean');
for (const f of [20, 55, 100, 440, 1000, 4000, 20000]) near(P.logSlider(P.logSliderInv(f, 20, 20000), 20, 20000), f, f * 0.0035, 'slider round trip ' + f);
check(P.logSliderInv(20, 20, 20000) === 0 && P.logSliderInv(20000, 20, 20000) === 1000, 'inverse end points');

// --- chord and scale tables (semitones above the root, from music theory)
const ch = P.CHORDS, sc = P.SCALES, eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
check(eq(ch['Major'], [0, 4, 7]) && eq(ch['Minor'], [0, 3, 7]) && eq(ch['Dominant 7'], [0, 4, 7, 10]) && eq(ch['Major 7'], [0, 4, 7, 11]) && eq(ch['Minor 7'], [0, 3, 7, 10]), 'triads and sevenths');
check(eq(ch['Diminished'], [0, 3, 6]) && eq(ch['Augmented'], [0, 4, 8]) && eq(ch['Sus2'], [0, 2, 7]) && eq(ch['Sus4'], [0, 5, 7]) && eq(ch['6th'], [0, 4, 7, 9]) && eq(ch['Add9'], [0, 4, 7, 14]), 'other chords');
const sum = (a) => a.reduce((x, y, i) => x + (i ? y - a[i - 1] : 0), 0);
check(eq(sc['Major'], [0, 2, 4, 5, 7, 9, 11]) && eq(sc['Natural minor'], [0, 2, 3, 5, 7, 8, 10]) && eq(sc['Harmonic minor'], [0, 2, 3, 5, 7, 8, 11]), 'major and minor scales');
check(eq(sc['Major pentatonic'], [0, 2, 4, 7, 9]) && eq(sc['Minor pentatonic'], [0, 3, 5, 7, 10]) && eq(sc['Blues'], [0, 3, 5, 6, 7, 10]) && eq(sc['Dorian'], [0, 2, 3, 5, 7, 9, 10]) && eq(sc['Mixolydian'], [0, 2, 4, 5, 7, 9, 10]), 'pentatonic, blues and modes');
check(sc['Chromatic'].length === 12 && sc['Chromatic'].every((v, i) => v === i), 'chromatic has 12 steps');
Object.keys(sc).forEach(k => check(sc[k].every((v, i) => i === 0 ? v === 0 : v > sc[k][i - 1]) && sc[k][sc[k].length - 1] < 12, 'scale ' + k + ' is ascending within one octave'));
check(P.NOTE_NAMES.length === 12 && P.NOTE_NAMES[9] === 'A', 'twelve note names');

// --- YIN on synthesized sounds: sine, sawtooth-like harmonics, noise, silence
const synth = (n, sr, f, amps) => { const b = new Float32Array(n); for (let i = 0; i < n; i++) { let v = 0; amps.forEach((a, h) => { v += a * Math.sin(2 * Math.PI * f * (h + 1) * i / sr); }); b[i] = v; } return b; };
for (const sr of [44100, 48000]) {
  for (const f of [41.2, 55, 82.41, 98, 110, 146.83, 196, 220, 261.63, 329.63, 440, 659.26, 880, 1174.7, 1318.5]) {
    const r = P.yinPitch(synth(4096, sr, f, [0.5]), sr, 30, 1400, 0.15);
    check(!!r && Math.abs(1200 * Math.log2(r.freq / f)) < 3 && r.prob > 0.9, 'YIN reads a ' + f + ' Hz sine at ' + sr + ' Hz as ' + (r ? r.freq.toFixed(2) : 'nothing'));
  }
  for (const f of [82.41, 110, 220, 440]) {          // strong harmonics must not trigger an octave error
    const r = P.yinPitch(synth(4096, sr, f, [0.4, 0.3, 0.2, 0.15, 0.1]), sr, 30, 1400, 0.15);
    check(!!r && Math.abs(1200 * Math.log2(r.freq / f)) < 5, 'YIN reads a harmonic-rich ' + f + ' Hz tone at ' + sr + ' as ' + (r ? r.freq.toFixed(2) : 'nothing'));
    const w2 = P.yinPitch(synth(4096, sr, f, [0.1, 0.5, 0.3]), sr, 30, 1400, 0.15);
    check(!!w2 && Math.abs(1200 * Math.log2(w2.freq / f)) < 5, 'YIN finds the fundamental of a tone whose 2nd harmonic is loudest: ' + f + ' -> ' + (w2 ? w2.freq.toFixed(2) : 'nothing'));
  }
}
check(P.yinPitch(new Float32Array(4096), 48000, 30, 1400, 0.15) === null, 'silence has no pitch');
let seed = 12345; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 * 2 - 1; };
const noise = new Float32Array(4096).map(() => rnd() * 0.5), rn = P.yinPitch(noise, 48000, 30, 1400, 0.15);
check(rn === null || rn.prob < 0.8, 'white noise is rejected by the tuner threshold (prob < 0.8)' + (rn ? ' (prob ' + rn.prob.toFixed(2) + ')' : ''));
const noisy = synth(4096, 48000, 220, [0.5]).map(v => v + rnd() * 0.1), rr = P.yinPitch(noisy, 48000, 30, 1400, 0.15);
check(!!rr && Math.abs(1200 * Math.log2(rr.freq / 220)) < 5, 'a 220 Hz tone with noise is still read: ' + (rr ? rr.freq.toFixed(2) : 'nothing'));
check(P.yinPitch(new Float32Array(100), 48000, 30, 1400, 0.15) === null, 'a buffer too short for the lowest pitch gives null instead of a crash');

// --- rms and median
near(P.rms(new Float32Array([1, -1, 1, -1])), 1, 1e-12, 'rms of +-1 is 1'); near(P.rms(synth(48000, 48000, 1000, [1])), Math.SQRT1_2, 1e-6, 'rms of a unit sine is 0.7071'); check(P.rms(new Float32Array(0)) !== P.rms(new Float32Array(0)) || true, 'rms of an empty buffer does not throw');
check(P.median([5, 1, 3]) === 3 && P.median([440, 441, 439, 440.5, 900]) === 440.5, 'median ignores an outlier');

console.log((bad ? 'FAILED' : 'passed') + ' [audio logic]: ' + ok + ' checks ok' + (bad ? ', ' + bad + ' failed' : ''));
process.exit(bad ? 1 : 0);
