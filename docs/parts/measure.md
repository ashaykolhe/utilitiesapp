## Ruler
- id: ruler
- category: measure
- plan: free
- needs: storage (saves the calibration)
- what: An on-screen ruler with centimetre and inch scales, horizontal or vertical. Calibrate it by laying a credit card (85.6 mm) on the screen and dragging the round handle (only the handle drags, so the page can still scroll) to the card's far edge; Save and Reset sit above the calibration area so they stay visible. The calibration is saved.
- test:
  1. Open Ruler. The cm scale shows on the top edge and the inch scale on the bottom. Tap Vertical: the ruler turns into a tall strip you can scroll.
  2. Tap "Calibrate with a credit card". Lay a real card lengthwise with its short edge on the top line, drag the handle to the card's other end, tap Save. The info line says "calibrated".
  3. Hold the card against the ruler: it should measure 8.6 cm (3.4 in).
  4. Leave the tool and reopen it: the calibration is still in place. Tap Reset: the info line says "not calibrated yet".
  5. Open calibration on a small phone: Save and Reset are visible without scrolling past the card area, and swiping on the empty area scrolls the page instead of moving the line.

## Protractor
- id: protractor
- category: measure
- plan: free
- needs: motion (tilt mode only)
- what: A 0 to 180 degree on-screen protractor with an arm you drag, showing degrees, supplement and complement. Tilt mode uses the phone's gravity sensor to show the angle of the phone's long axis.
- test:
  1. Drag the arm round the dial: the big number follows, and dragging below the baseline snaps to 0 or 180.
  2. Drag to 90: the supplement and complement both read 90.
  3. Tap "Tilt phone": hold the phone upright against a wall, the arm moves as you rotate it in the plane of the screen. Tap "Set current tilt as zero" and the reading becomes 0.
  4. On a device without a motion sensor the tilt mode shows "No motion sensor found".
  5. In tilt mode lay the phone flat (or nearly): "Hold the phone upright" shows instead of a jumpy reading. Hold it upright and rotate through horizontal (0 and 180): the arm moves smoothly and does not jump to 90.

## Pendulum Bob
- id: plumb
- category: measure
- plan: free
- needs: motion
- what: A plumb line that swings from the top of the screen. It shows the angle from vertical plus the sideways and forward/back tilt, using the gravity vector.
- test:
  1. Hold the phone upright: the bob hangs straight and the angle is near 0 and turns green when within 1 degree.
  2. Tilt it sideways: the line swings away from the lowered side, like a real plumb line hanging in front of the phone (bob moves left when Sideways is positive), and the Sideways value changes.
  3. Tilt the top towards or away from you: the bob grows or shrinks and Forward / back changes.
  4. Lay the phone flat: the angle reads about 90 degrees.

## Height Finder
- id: heightfinder
- category: measure
- plan: free
- needs: motion
- what: Measures the height of a tree or building from the tilt angle to its top and its base. Uses your eye height to get the distance (or a distance you type) and shows the working.
- test:
  1. Stand about 10 m from a wall. Sight along the top edge of the phone at the top of the wall and tap "Mark top"; then sight at the foot of the wall and tap "Mark base". With eye height 1.6 m the height appears.
  2. Clear the marks, mark only the top, type a distance of 10: the height shows as eye + d x tan(top).
  3. Switch to feet: the units on the labels and result change.
  4. Mark a base angle that points upward (positive): no result appears (needs a downward base angle or a distance).
  5. Switch to feet: the eye height converts (1.6 m becomes 5.25 ft). Aim almost straight up (over 85 degrees): the result shows "--" instead of a huge number.
  6. Type 50 in Eye height: a message shows and the value is limited to 10. Type -5 in Distance: the minus sign is refused.

## Distance Finder
- id: distancefinder
- category: measure
- plan: free
- needs: motion
- what: Finds the horizontal distance to an object by sighting its base and entering your eye height, using distance = eye height divided by tan of the angle downwards.
- test:
  1. Set eye height 1.6 m, point the top edge at a mark on the floor and read the distance; compare with a tape measure (expect within about 10 percent).
  2. Tap "Hold angle", move the phone: the result stays; tap Live to resume.
  3. Aim at or above the horizon: the result shows "--".
  4. Switch units to feet and check the label changes.
  5. Switch to feet: the eye height converts. Aim almost straight down (over 85 degrees): "--" is shown.
  6. Type 500 in Eye height: the value is limited to 10 with a short "Adjusted" message.

## Speed Calc
- id: speedcalc
- category: measure
- plan: free
- needs: none
- what: Calculates speed from distance and time, distance from speed and time, or time from distance and speed, with km, m, miles, feet and nautical miles, and km/h, m/s, mph and knots.
- test:
  1. Speed tab: 100 km in 1 hour gives 100 km/h and 62.14 mph.
  2. Distance tab: 60 km/h for 30 minutes gives 30 km.
  3. Time tab: 100 km at 50 km/h gives 2 h 0 min 0 s.
  4. Empty or zero fields show "--" and a hint, never an error.
  5. Enter -5 in Distance (a minus sign is refused) and 99999999999 (a message shows and the value is limited). Result stays a number or "--", never NaN.

## G Meter
- id: gmeter
- category: measure
- plan: free
- needs: motion
- what: Live g-force on X, Y and Z plus the total, a gauge, peak hold and a scrolling line graph.
- test:
  1. Lay the phone flat: the total reads about 1.00 g and Z about 1.00.
  2. Shake the phone: the gauge and graph spike and Peak increases.
  3. Tap Reset peak: peak and graph clear.
  4. Tick "Remove gravity": the total drops to about 0 when still (if the phone provides it).
  5. On a phone that does not report gravity-free acceleration, tick "Remove gravity": a message says so and the box unticks itself.

## Vibrometer
- id: vibrometer
- category: measure
- plan: free
- needs: motion
- what: Measures vibration of the surface the phone rests on (RMS acceleration), with a live graph, min and max values and a severity label from Still to Severe.
- test:
  1. Lay the phone on a still table: label says "Still" and the gauge is empty.
  2. Tap the table next to the phone or place it on a running appliance: the label rises and the graph moves.
  3. Min and Max update; Reset clears them.
  4. On a device without sensors a clear message appears.

## RPM Counter
- id: rpm
- category: measure
- plan: free
- needs: microphone (mic mode only)
- what: Tap once per revolution to read RPM averaged over the last taps, or use the microphone to estimate the repeating pulse rate of a sound such as a fan or engine.
- test:
  1. Tap the big button once every half second: RPM settles near 120. Wait 3 seconds and tap again: the series restarts.
  2. Tap Reset: taps return to 0 and RPM to "--".
  3. Switch to Microphone and allow access. Hold the phone next to a steadily ticking clock or metronome set to 60 per minute: RPM reads about 60 after a few seconds.
  4. Deny the microphone permission: "Microphone permission denied." shows.
  5. Switch quickly between Tap and Microphone several times: the microphone indicator in the status bar goes off after you leave Microphone mode (no stream is left running).

## Screen Info
- id: pixelinfo
- category: measure
- plan: free
- needs: none
- what: Shows the screen resolution in pixels and dp, pixel ratio, density, viewport, estimated size in inches and aspect ratio, with a full-screen grid overlay and a dead pixel colour test.
- test:
  1. Open the tool: resolution matches the phone's spec sheet (for example 1080 x 2400).
  2. Tap "Grid overlay": a 10 dp grid with bold lines every 100 dp fills the screen; tap to close.
  3. Tap "Dead pixel test": the screen turns red, green, blue, white, black on each tap and closes after black.
  4. Rotate the phone: the viewport row updates.

## Slope Finder
- id: slope
- category: measure
- plan: free
- needs: motion
- what: Measures roof pitch or ramp slope in degrees, percent, ratio (1:n) and rise per 12, by laying the phone on the surface or sighting along its edge.
- test:
  1. Lay the phone flat on a table: reads about 0 degrees. Prop one end on a 10 cm book on a 1 m board: about 5.7 degrees, 10 percent.
  2. Tap "Zero here" on a surface to calibrate it to 0.
  3. Tap Hold: the value freezes and the button says Release.
  4. Switch to "Sight along edge" and tilt the top edge upward: the angle reads the elevation.
  5. Turn the phone face down: the percent stays positive and the angle never exceeds 90. Tap Hold, then switch mode: the button goes back to "Hold".

## Shadow Height
- id: shadowheight
- category: measure
- plan: free
- needs: none
- what: Finds the height of a tree, pole or building from the length of its shadow compared with a stick of known height.
- test:
  1. Stick 1 m with shadow 0.8 m, tree shadow 12 m: result 15.00 m.
  2. Switch to feet: the unit label changes.
  3. Set the stick shadow to 0: result shows "--".
  4. Enter 5000 in Stick height: a message shows and the value is limited to 1000. Enter 0 in a shadow: the result shows "--".

## Stride & Pace
- id: pacecalc
- category: measure
- plan: free
- needs: storage
- what: Calculates your step length from a known distance and step count, converts steps to distance, and calculates running pace (min/km) and speed.
- test:
  1. Distance 20 m and 28 steps: 0.71 m per step. Tap "Save as my step length": the Steps to distance card fills in 0.71.
  2. Steps 10000 with step length 0.71: about 7.14 km.
  3. Running pace: 5 km in 30 minutes gives 6:00 per km and 10.0 km/h.
  4. Zero steps or empty fields show "--".
  5. Enter 3.5 in Steps taken: a "Whole numbers only" message shows. Step length above 3 m is limited to 3.

## Unit Price
- id: unitprice
- category: measure
- plan: free
- needs: none
- what: Compares up to three products by price per 100 g, 100 ml or per piece and highlights the best value, handling kg, lb, oz, litres and fl oz.
- test:
  1. Product A: 2.00 for 500 g; Product B: 3.00 for 1 kg. A shows 0.400 per 100 g, B 0.300; B is outlined green as best value.
  2. Change B's unit to ml: the message says mixed units cannot be compared.
  3. Clear everything: "Fill in at least two products".
  4. Enter -1 as a price (refused) and 99999999999 (limited to 1,000,000,000). Leave Amount at 0: that product shows "--".

## Reaction Test
- id: reaction
- category: measure
- plan: free
- needs: storage (best time)
- what: A reaction timer: tap as soon as the big button turns green and see your time in milliseconds, with last, average and best.
- test:
  1. Tap to start: the button turns red and says wait. Tap before green: "Too soon!".
  2. Start again and tap when it turns green: your time in ms shows and Last, Average, Best fill in.
  3. Leave and reopen: Best is remembered.

## Magnetometer
- id: magnet
- category: measure
- plan: free
- needs: motion
- what: Shows magnetic field strength in microtesla with X/Y/Z, peak and a graph, for finding magnets and metal. Works only on phones that expose the sensor to apps (the Android WebView often does not); otherwise it shows a clear message.
- test:
  1. On a phone with the sensor the total reads about 25 to 65 microtesla away from metal.
  2. Move the phone near a speaker or magnet: the value jumps and the gauge fills.
  3. Tap "Zero baseline" to see only the change; tap again to go back to absolute.
  4. On a device or browser without the API: "does not expose a magnetic field sensor" appears and nothing crashes.

## Light Meter
- id: lightmeter
- category: measure
- plan: free
- needs: motion (ambient light sensor)
- what: Ambient light in lux with a plain-language label and a graph, using the ambient light sensor when the phone exposes it to apps (many do not). Approximate; shows a message instead of guessing when no sensor is available.
- test:
  1. On a supported device cover the top of the phone with a hand: lux drops and the label becomes "Almost dark" or "Dim room".
  2. Point at a window: lux rises and the peak updates.
  3. On a device without the sensor API a clear message is shown.
