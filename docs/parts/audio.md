## Metronome
- id: metronome
- category: audio
- plan: free
- needs: none
- what: Steady click from 30 to 300 BPM with an accented first beat, time signatures from 1/4 to 12/4 and tap tempo. Clicks are scheduled ahead with Web Audio so timing stays accurate, and beat dots show the current beat.
- test:
  1. Open the tool, press Start: a click plays and the dots light in turn, the first dot (accent) is a higher pitch. Press Stop: the sound stops and the dots reset.
  2. Move the slider to 60 and count: one click per second. Use -5, -1, +1, +5 buttons: the number changes and stays within 30 to 300.
  3. Change the time signature to 3/4 while playing: three dots appear and the accent comes every third beat.
  4. Tap "Tap tempo" about 5 times at an even pace: the BPM follows your taps. Wait 3 seconds then tap twice: the tempo restarts from the new taps.
  5. Leave the tool while it plays: the sound stops. Reopen: the last BPM and signature are remembered.

## Tone Generator
- id: tonegen
- category: audio
- plan: free
- needs: none
- what: Plays a pure tone from 20 Hz to 20 kHz (log slider plus number box) as sine, square, triangle or sawtooth, with a volume control and an optional looping frequency sweep. Shows the nearest note and warns about loud sound. Output is capped at about half amplitude and runs through a limiter; a confirmation appears before playing above 70% volume at more than 1 kHz.
- test:
  1. Press Play at the default 440 Hz: a steady tone plays at low volume and the note reads A4. Press Stop: it fades out.
  2. Drag the slider while playing: the pitch changes smoothly and the number box follows. Type 1000 in the box: pitch jumps to 1 kHz. Type 5 or 99999: it clamps to 20 or 20000.
  3. Change waveform to square: the timbre becomes buzzier. Raise volume above 70%: label shows "(loud!)".
  4. Tick Sweep, set To 2000 and 5 seconds, press Play: the frequency glides up and down repeatedly and the readout moves.
  5. Set volume above 70% and press Play at 5000 Hz: a confirmation about hearing damage appears; Cancel keeps it stopped.
  6. Leave the tool while playing: sound fades out without a click.
  7. Enter 99999 in Frequency: a message shows and the value is limited to 20000. Clear the field and leave it: it returns to 440.

## Tuner
- id: tuner
- category: audio
- plan: free
- needs: microphone
- what: Chromatic tuner using YIN pitch detection on the microphone. Shows note, frequency, cents off and a needle, and has guitar, ukulele, bass and violin presets that match your note to the nearest string.
- test:
  1. Press Start tuner and allow the microphone. Play or whistle a steady note (or play a 440 Hz tone from another device): the note shows A, around 0 cents, needle near the centre, green when within 5 cents.
  2. Sing slightly flat or sharp: the cents value goes negative or positive and the hint says tighten or loosen.
  3. Choose Guitar: six string buttons appear; the nearest string highlights as you play. Tap a string button to lock it (lock icon) and tap again to unlock.
  4. Stay silent for a second: the display returns to "Listening...".
  5. Deny the microphone permission: a clear permission message appears and nothing crashes. Leaving the tool stops the microphone.

## Mike
- id: mike
- category: audio
- plan: free
- needs: microphone
- what: Uses the microphone as a loudspeaker: mic to phone speaker or headphones with a gain control up to 300%, a limiter, an echo-cancellation option and a level meter. Shows a strong feedback warning first.
- test:
  1. The Start button is disabled until the headphone/low-volume checkbox is ticked.
  2. With headphones on, tick it and press Start, allow the microphone, then speak: your voice is heard in the headphones and the level bar moves.
  3. Move the volume boost slider: the voice gets louder or quieter. At 0% it is silent.
  4. Press Stop: sound stops and the bar empties. Leave the tool while running: the microphone is released.
  5. Deny the permission: a message says the microphone permission was denied.
  6. Double tap Start quickly. Expected: only one loop starts (no doubled echo) and Stop silences everything. The sound fades in over about a third of a second.

## Voice Recorder
- id: recorder
- category: audio
- plan: free with limit: 3 saved recordings (Pro: unlimited)
- needs: microphone, storage
- what: Records voice memos with MediaRecorder with pause, resume and stop. Recordings are kept in IndexedDB on the device and listed with play, rename, share or download and delete. The free plan keeps 3 recordings, then shows the Pro sheet. The Record button is disabled until the saved list has loaded and while a recording is starting, a recording stops by itself after 1 hour, and the free limit is checked again when a recording ends.
- test:
  1. Press Record, allow the microphone, speak for a few seconds: the timer counts and status says Recording. Press Pause: the timer freezes; Resume continues; Stop saves a "Recording <date time>" item.
  2. Press play on an item: it plays and the button becomes a stop square. Press it again: playback stops.
  3. Press the pencil, change the name and press Save: the new name shows and is still there after reopening the tool. Press the share arrow: the share sheet (Android) or a download (browser) appears.
  4. Press the bin once: it turns into "Sure?"; press again to delete. Without the second press it resets after 3 seconds.
  5. As a free user with 3 recordings, press Record: the Pro sheet opens and nothing records.
  6. Deny the microphone: a permission message shows.
  7. Double tap Record quickly: only one recording starts.

## Piano
- id: piano
- category: audio
- plan: free
- needs: none
- what: On-screen piano with 15 wide keys (C to D an octave higher), multi-touch chords, finger sliding between keys, octave shift of two octaves either way and four waveform sounds.
- test:
  1. Tap white and black keys: the matching notes sound and the key highlights while pressed.
  2. Press three keys with different fingers: all three sound together (chord) and release independently.
  3. Press Oct + : labels change to the next range (for example C5 to D6) and the pitch is higher. Oct - at the lowest range does nothing more.
  4. Change Sound to Retro: the timbre changes on the next key press.
  5. Slide a finger across the keys: notes change as the finger crosses each key, with no stuck notes after lifting.

## Spectrum
- id: spectrum
- category: audio
- plan: pro
- needs: microphone
- what: Live frequency spectrum bars (48 log-spaced bands, 30 Hz to 16 kHz, with falling peak caps) and a waveform trace from the microphone, plus the loudest frequency in Hz (ignores the lowest bins and interpolates between them for a steadier reading).
- test:
  1. Press Start and allow the microphone: bars move with ambient sound and the waveform scrolls.
  2. Whistle or play a steady tone: one tall bar appears at the matching band and the "loudest frequency" number matches roughly.
  3. Stay quiet: bars fall and the frequency shows "--".
  4. Press Stop: drawing clears. Leave the tool: the microphone indicator in Android goes away.
  5. Deny the permission: a permission message appears.

## Sleep Sounds
- id: sleepsounds
- category: audio
- plan: free
- needs: none
- what: Looping relaxing sounds synthesized offline: white, pink and brown noise, rain, ocean waves and wind. Has a volume slider, a sleep timer (15 minutes to 8 hours) and a fade-out when the timer ends.
- test:
  1. Tap Rain: it starts playing at once with a fade-in and the button highlights. Tap Ocean: the sound switches and slow waves are heard.
  2. Move the volume slider: loudness changes; reopen the tool and the volume is remembered.
  3. Choose a 15 minute timer: the countdown appears and runs. (Quick check: it should show about 00:15:00 minus elapsed time.)
  4. Press Stop: sound fades out and text says Stopped. Press Play again: it resumes.
  5. Leave the tool while playing: sound stops completely.

## Drum Pad
- id: drumpad
- category: audio
- plan: pro
- needs: none
- what: Eight large synthesized drum pads (kick, snare, clap, hi-hat, open hat, tom, rim, cowbell) with multi-touch and a master volume. No sound files are used.
- test:
  1. Tap each pad: a different drum sound plays instantly and the pad flashes with a short vibration.
  2. Tap two pads at the same time with two fingers: both sounds play.
  3. Tap one pad rapidly: no delay or missed hits.
  4. Lower the volume slider: hits become quieter.
  5. Leave the tool: no sound continues.

## Hearing Test
- id: eartest
- category: audio
- plan: free
- needs: none
- what: A guided high-frequency hearing test: tones at 4, 8, 10, 12, 14, 15, 16, 17, 18, 19 and 20 kHz in both ears, left or right, and the highest tone you can hear is reported. It is for fun and not a medical test.
- test:
  1. With headphones, press Start test: a tone plays for 2.5 seconds and the frequency is shown. Press "I hear it": the next, higher tone plays.
  2. Press "Cannot hear": the test ends and shows the highest frequency you confirmed (or none).
  3. Press Replay tone: the current tone plays again.
  4. Choose Left ear: the tone plays only in the left earphone.
  5. Answer yes to every tone: after 20 kHz the result says 20 kHz. Leave mid-tone: sound stops.

## Binaural Beats
- id: binaural
- category: audio
- plan: free
- needs: none
- what: Plays a slightly different tone in each ear to create a binaural beat, with presets for delta, theta, alpha, beta and gamma, adjustable beat and carrier frequency, volume and an auto-stop timer. Needs headphones.
- test:
  1. With headphones press Play: a steady tone is heard and the text shows left and right frequencies (for example left 200 Hz, right 210 Hz).
  2. Tap "Theta 6 Hz": the beat value changes to 6 and the right tone updates live. Move the carrier slider: both tones shift.
  3. Set the timer to 10 minutes: the "Stops in" countdown appears.
  4. Press Stop: the sound fades out. Leave while playing: sound stops.

## Audio Player
- id: player
- category: audio
- plan: pro
- needs: storage
- what: Plays audio files you pick from the device (several at once as a playlist), with seek bar, +/-10 second skip, speed from 0.5x to 2x with optional pitch preservation, an A-B loop and a five-band equalizer with presets.
- test:
  1. Press "Choose audio files" and pick one or more songs: the first loads; press Play and it plays. The time and seek bar update and dragging the bar seeks.
  2. Set Speed to 0.5x: playback slows. Untick "Keep pitch": the pitch now drops with the speed.
  3. During playback press Set A, then later Set B: the section A to B loops. Clear removes the loop.
  4. Tap the "Bass boost" preset: bass is louder and the 60 Hz slider shows +8. Move a band slider manually.
  5. With several files, let one end: the next one starts. Pick a non-audio file: a message says no audio files were chosen. Leaving stops playback.
  6. Choose a non-audio file: it is ignored with a message. The playlist holds at most 100 tracks.

## Stereo Test
- id: stereotest
- category: audio
- plan: free
- needs: none
- what: Checks speakers or headphones channel by channel with a tone or pink noise on left, right, both or alternating every second, with L and R indicators on screen.
- test:
  1. Press Left: sound only comes from the left side and the L box lights up. Press Right: only right.
  2. Press Alternate: the sound switches sides every second and the L/R boxes alternate.
  3. Change Sound to Pink noise while playing: the sound changes without stopping the mode.
  4. Press Stop: silence and indicators clear. Leave the tool: sound stops.

## Speaker Cleaner
- id: speakerclean
- category: audio
- plan: free
- needs: none
- what: Plays a low 165 Hz tone (or a 100 to 450 Hz sweep for dust) for 15 seconds to 2 minutes to help shake water out of a phone speaker, with a countdown and progress bar. Reminds you to unplug headphones; output is limited to about half amplitude.
- test:
  1. Read the instructions (including "Unplug headphones and earbuds first"), turn media volume up and press Start: a low tone plays and the countdown runs down.
  2. Pick the sweep mode and start: the pitch wobbles slowly between low notes.
  3. Press Stop early: sound stops and the progress resets.
  4. Let it finish: sound stops, the display says Done, the phone vibrates and a message appears.

## Dog Whistle
- id: dogwhistle
- category: audio
- plan: free
- needs: none
- what: High-pitched tone from 8 to 22 kHz with presets and steady, pulsing or sweeping patterns for attracting or training pets. Warns about volume and that many phone speakers cannot reach the top range. Output is limited to about half amplitude and starting above 70% volume asks for confirmation.
- test:
  1. Set 12000 Hz and press Play: a high tone is clearly audible. Raise the frequency: it becomes fainter or inaudible to you.
  2. Tap the 15k, 17k, 19k and 21k presets: the frequency value and slider update, the sound changes live.
  3. Choose Pulsing: the tone beeps on and off. Choose Sweep: the pitch glides around the chosen value.
  4. Raise volume above 70% and press Play: a confirmation appears.
  5. Press Stop or leave the tool: sound fades out and stops.

## Chords & Scales
- id: chords
- category: audio
- plan: free
- needs: none
- what: Reference for 11 chord types and 9 scales in all 12 keys. Shows the note names, highlights them on a two-octave keyboard and plays them (strummed chord or ascending scale).
- test:
  1. Pick root C and Chord Major: the notes show C E G and three keys highlight. Press Play: a strummed chord sounds.
  2. Choose root A and type Minor: A C E. Choose Dominant 7: four notes.
  3. Switch Show to Scale and pick Blues: six notes show and Play plays them one by one upward and then the octave.
  4. Reopen the tool: the last selected root is remembered.

## Clap Counter
- id: clapcounter
- category: audio
- plan: free
- needs: microphone
- what: Counts claps or sharp sounds from the microphone with adjustable sensitivity, a level bar with threshold marker and a claps-per-minute rate.
- test:
  1. Press Start listening and allow the microphone. Clap once: the counter goes to 1 and the phone vibrates briefly.
  2. Clap about 10 times in 5 seconds: the count rises by 10 (not more) and claps per minute shows about 120.
  3. Raise sensitivity if quiet claps are missed; lower it if background noise counts. The red marker on the level bar moves.
  4. Press Reset: count and rate go to 0. Deny the permission: a message is shown.

## Vocal Range
- id: vocalrange
- category: audio
- plan: free
- needs: microphone
- what: Sing your lowest and highest comfortable notes; the stable notes are tracked with pitch detection and the range is shown in notes, semitones and octaves with a rough voice type guess. The range is saved on the device.
- test:
  1. Press Start, allow the microphone and sing a steady low note: the current note shows, and after about half a second it becomes the Lowest value.
  2. Slide up to a high note and hold: Highest updates; the range text shows semitones and octaves and a voice type guess.
  3. Brief noises or speech do not change the range (only held notes do).
  4. Reopen the tool: the saved range is displayed. Press Reset range: both values clear.

## Tone Sequencer
- id: toneseq
- category: audio
- plan: pro
- needs: none
- what: A 16-step by 8-note pentatonic grid for composing a looping melody, with tempo from 60 to 200 BPM, four sounds, random and clear buttons. The pattern and tempo are remembered.
- test:
  1. Tap several cells (they turn colored) and press Play: the notes play in order and a green outline marks the current step. Higher rows are higher notes.
  2. Change the tempo slider while playing: the speed changes smoothly.
  3. Press Random: a new pattern appears. Press Clear: the grid empties and playback is silent.
  4. Press Stop: playback stops and the outline clears. Reopen: the last pattern and tempo return.

## Pitch Pipe
- id: pitchpipe
- category: audio
- plan: free
- needs: none
- what: Plays a steady reference note for any of the 12 notes in octaves 3, 4 or 5, useful for tuning voice or an instrument by ear. Shows the note name and frequency.
- test:
  1. Tap A with octave 4: a steady tone plays, the button is highlighted and the display shows A4 at 440.0 Hz.
  2. Tap another note: the first stops and the new one plays. Tap the same note again: it stops.
  3. Change the octave while a note plays: the tone stops. Move the volume slider: loudness changes live.
  4. Leave the tool: sound stops.
