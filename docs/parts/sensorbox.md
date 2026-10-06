## Sensor List
- id: sensorlist
- category: measure
- plan: pro
- needs: motion
- what: Lists every hardware sensor in your phone with its type, maker and range, and shows live readings (with a graph) of any sensor you tap. Uses the native sensor plugin, so it works only in the installed app.
- test:
  1. Unlock Pro (or use a trial code), open Sensor List. A list of sensors appears with a count ("NN sensors found").
  2. Tap "Accelerometer": live numbers appear and change when you move the phone; tap Stop: they freeze and the sensor stops.
  3. Tap a sensor you cannot stream (a wake-up or one-shot sensor): a message says it cannot be read live, and the app does not crash.
  4. Leave the tool: readings stop (the phone's battery is not drained by a running sensor).
  5. In a desktop browser the tool says it works only in the installed app.

## Metal Detector
- id: metaldetect
- category: measure
- plan: free
- needs: motion
- what: Finds iron and steel near the top of your phone by the change in the magnetic field, with a bar, a graph and a beep and vibration that speed up as the change grows. Adjustable sensitivity and a "Set baseline here" button. It cannot find gold, silver, copper or aluminium.
- test:
  1. Open the tool away from other metal: it sets a baseline by itself and the value is steady (about 25 to 65 µT on Earth).
  2. Bring a steel object or a magnet near the top of the phone: the change number and bar grow and the beeps speed up and rise in pitch.
  3. Move it away and press "Set baseline here": the change goes back to about 0.
  4. Turn Sound and Vibrate off: no beeps or buzzes. Move the Sensitivity slider: the same object gives a smaller or bigger bar.
  5. Leave the tool: beeping and sensor stop. On a phone without a magnetometer a message says so.

## Barometer
- id: barometer
- category: measure
- plan: free
- needs: motion
- what: Air pressure in hPa with a smoothed reading, a trend line, a "Rising / Falling / Steady" hint, and an estimate of your height above sea level that you can calibrate with a known height or the local sea-level pressure.
- test:
  1. Open the tool on a phone with a barometer: pressure appears (about 950 to 1050 hPa near sea level) and height shows in metres and feet.
  2. Type your real height (for example 120) in "I am at this height" and press the button: the sea-level value updates and the estimate moves toward your real height.
  3. Type 5000 in Sea-level pressure: the field is limited to 1100 and a message shows. Clear it: it falls back to 1013.25.
  4. Climb a flight of stairs and wait: the height estimate changes by a few metres.
  5. On a phone without a barometer a message says so.

## Room Temperature
- id: roomtemp
- category: measure
- plan: free
- needs: motion
- what: Shows the room temperature when the phone has an ambient temperature sensor (rare). Otherwise shows the battery temperature and says clearly that it is the battery. Humidity is shown too when the phone has a humidity sensor. °C and °F.
- test:
  1. Open the tool: the label says either "Room temperature (phone sensor)" or "Battery temperature (no room sensor in this phone)".
  2. Tap °F: the number and unit change; tap °C to go back.
  3. Plug in the charger for a few minutes with the screen on (battery case): the battery temperature rises.
  4. Leave the tool: the 5-second battery polling stops.

## Proximity Test
- id: proximity
- category: measure
- plan: free
- needs: motion
- what: Tests the proximity sensor next to the speaker: a big circle shows NEAR or FAR, the reported distance in cm and how many times it was covered.
- test:
  1. Open the tool and wave a hand over the top of the screen: the circle switches between NEAR and FAR and the phone buzzes briefly.
  2. The covered counter goes up on each cover; "Reset counter" sets it to 0.
  3. Leave the tool: the sensor stops. On a phone without a proximity sensor a message says so.

## Signal Strength
- id: signal
- category: measure
- plan: free
- needs: network
- what: Shows the strength of the current Wi-Fi or mobile connection in dBm with bars, a quality word, a live graph, link speed, band, estimated speeds and whether the internet works. Updates every second so you can walk around and find the best spot.
- test:
  1. On Wi-Fi: the kind shows "Wi-Fi", a negative dBm number (for example -55), bars, a quality word and the link speed.
  2. Walk away from the router: the number drops (more negative) and the bars fall.
  3. Turn Wi-Fi off with mobile data on: the kind changes to "Mobile data" and shows a dBm value (some phones do not report one: the tool then says Android did not report a signal level).
  4. Turn on airplane mode: it shows "Not connected" and "No connection".
  5. Leave the tool: the one-second polling stops.

## Gyroscope
- id: gyro
- category: measure
- plan: free
- needs: motion
- what: Shows how fast the phone turns around each axis in degrees per second with the total, a live graph and a peak hold with a reset button.
- test:
  1. Lay the phone still: all numbers are close to 0.
  2. Spin it flat on a table: Z shows a large number, the total follows, the graph rises and the peak keeps the highest value.
  3. Tap "Reset peak": the peak goes back to 0.
  4. Leave the tool: the sensor stops. On a phone without a gyroscope a message says so.
