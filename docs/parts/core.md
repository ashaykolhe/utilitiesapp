## Timer
- id: timer
- category: daily
- plan: free
- needs: none
- what: Count down from any minutes and seconds with start, pause and reset. A tone and vibration play when time is up.
- test:
  1. Open Timer, set 0 min 5 sec, tap Start. The display counts down and a tone plays at 00:00 with a "Time is up" message.
  2. Start 1 min, tap Pause after 5 s, then Resume. It continues from where it stopped.
  3. Tap Reset. The display shows the entered time again.
  4. Leave the tool while running and come back. The timer is stopped (no sound plays later).

## Stopwatch
- id: stopwatch
- category: daily
- plan: free
- needs: none
- what: Time anything to the hundredth of a second, with pause, resume, laps and reset.
- test:
  1. Tap Start. The time runs. Tap Lap three times. Three laps appear, newest first.
  2. Tap Pause, wait, tap Resume. The time continues without jumping.
  3. Tap Reset. Time and laps clear.

## Reminders
- id: reminders
- category: daily
- plan: free with limit: 3 active reminders (Pro: unlimited)
- needs: notifications
- what: Set reminders with a date and time. On Android a notification is scheduled so it appears even when the app is closed.
- test:
  1. Add a reminder for 2 minutes from now. Allow notifications when asked. Close the app. A notification appears at the time.
  2. Add reminders until there are 3 active ones, then add a fourth. The Pro sheet opens.
  3. Delete a reminder with the cross. It disappears and no notification arrives for it.
  4. Try a time in the past. A message says to enter a future time.

## Calculator
- id: calculator
- category: calculate
- plan: free
- needs: none
- what: A simple calculator with add, subtract, multiply, divide, percent, backspace and clear.
- test:
  1. Enter 12 + 30 × 2 and press =. The result is 72.
  2. Press 50 % . The expression shows 0.5.
  3. Enter 1 ÷ 0 and press =. A message says the expression is invalid.
  4. Use backspace and clear.

## Unit Converter
- id: converter
- category: calculate
- plan: free
- needs: none
- what: Convert length, weight, volume, area, speed, data, time and temperature between common units.
- test:
  1. Length: 1 mile to km gives 1.609344.
  2. Temperature: 100 C to F gives 212.
  3. Data: 1 GB to MB gives 1024.
  4. Clear the number box. The result shows a dash.

## Compass
- id: compass
- category: navigate
- plan: free
- needs: motion
- what: A compass dial that points to north with the heading in degrees and a direction label.
- test:
  1. Hold the phone flat and turn around. The dial rotates and the heading changes. North matches another compass app within about 15 degrees.
  2. On a phone without a compass sensor a message says so after a few seconds.

## Leveler
- id: leveler
- category: navigate
- plan: free
- needs: motion
- what: A bubble level that shows how far the phone is tilted in two directions, with a zero button.
- test:
  1. Lay the phone on a flat table. The bubble is near the centre and the angles are close to 0.
  2. Lift one edge. The bubble moves toward the lower side and the angle grows.
  3. Tap "Set current position as zero" on a slightly tilted surface. The readout becomes 0.

## Speedometer
- id: speedometer
- category: navigate
- plan: free
- needs: location
- what: Live speed in km/h from GPS with top speed and trip distance.
- test:
  1. Open it outdoors and allow location. "Waiting for GPS" disappears and speed shows 0 when standing still.
  2. Walk or ride. The speed and distance rise. Max speed keeps the highest value.
  3. Tap Reset trip. Max and distance go back to 0.
  4. Deny the permission. A message says location permission was denied.

## Altitude
- id: altitude
- category: navigate
- plan: free
- needs: location
- what: Height above sea level from GPS with latitude, longitude and accuracy.
- test:
  1. Open it outdoors and allow location. Altitude, latitude, longitude and accuracy fill in.
  2. On a phone without altitude data the value shows "n/a".

## Device Info
- id: deviceinfo
- category: daily
- plan: free
- needs: none
- what: Shows screen size, pixel ratio, language, processor cores, memory, online state, touch points, battery and the browser string.
- test:
  1. Open it. All rows have values. Battery matches the phone's level.
  2. Turn on airplane mode and reopen. Online shows No.

## Flashlight
- id: flashlight
- category: daily
- plan: free
- needs: camera
- what: Turns the camera torch on and off.
- test:
  1. Tap Turn on and allow the camera. The torch lights and the button says Turn off.
  2. Tap Turn off. The torch goes out.
  3. Leave the tool while on. The torch goes out.
  4. Deny the permission. A message says the torch is not available.

## Sound Intensity
- id: noise
- category: measure
- plan: free
- needs: microphone
- what: Approximate sound level in decibels from the microphone with minimum and maximum.
- test:
  1. Open it and allow the microphone. The value changes with the sound around you.
  2. Clap near the phone. The maximum jumps up.
  3. Deny the permission. A message says it was denied.

## Text to Speech
- id: tts
- category: audio
- plan: free
- needs: none
- what: Reads typed text aloud with a choice of voice and speed.
- test:
  1. Type a sentence and tap Speak. It is read aloud.
  2. Change the speed and speak again. The pace changes.
  3. Tap Stop while speaking. It stops. Leaving the tool also stops it.

## Speech to Text
- id: stt
- category: audio
- plan: free
- needs: microphone
- what: Turns your speech into text that you can copy.
- test:
  1. Tap Start listening, allow the microphone and speak a sentence. The words appear.
  2. Tap Copy and paste elsewhere. The text is pasted.
  3. On a phone without speech recognition a message says it is not available.

## Paint
- id: paint
- category: create
- plan: free
- needs: storage
- what: Draw with any colour and brush size, use an eraser, undo, clear and save the picture as an image.
- test:
  1. Draw with a finger in two colours. Lines follow the finger.
  2. Tap Undo. The last stroke disappears. Tap Eraser and erase part of a line.
  3. Tap Save. The picture is saved or shared as an image.
