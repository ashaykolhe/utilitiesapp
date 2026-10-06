# PocketKit: manual test

Tick each box on a real phone. Test on a debug build first (`cd android && ./gradlew assembleDebug`, then `adb install -r app/build/outputs/apk/debug/app-debug.apk`).
Allow each permission when the app asks, and also try denying it once: the tool must show a message and not crash.

_Generated from docs/parts/*.md by scripts/build-docs.js on 2026-10-06._

## 0. App-level checks

- [ ] The app opens to the Home screen with the PocketKit name and the tool count.
- [ ] Search "tim" shows Timer and other matches; clearing the box brings the categories back.
- [ ] Tap a category header: it collapses and stays collapsed after closing and reopening the app.
- [ ] Press and hold a tool: "Pinned" appears and a Pinned row shows on top. Pin 4 tools, then a fifth: the Pro sheet opens.
- [ ] Open a tool, press the phone's Back button: it returns to Home. Press Back on Home: the app closes.
- [ ] Settings: change Theme to Dark and Light; the whole app follows. Tap a locked colour: the Pro sheet opens.
- [ ] Settings > Privacy policy opens the policy page.
- [ ] Open a Pro tool (Motion Cam): the Pro sheet opens with the feature highlighted.
- [ ] Pro sheet: enter a wrong code: "That code isn't valid". Enter a code from coupon-codes.txt for today: Pro turns on, locks disappear, Settings shows "Trial until ...".
- [ ] Rotate the phone and send the app to the background and back: nothing breaks.
- [ ] Turn on airplane mode: every tool except those marked "network" still works.

## 1. Daily

### Alarm Clock
_Free. Needs: notifications, storage_

- [ ] Add an alarm 2 minutes ahead with no weekdays selected and the label "Test": a toast shows the time and the list shows "Once".
- [ ] Close the app: at the time a notification arrives with the label.
- [ ] Add an alarm with Mon to Fri selected: the list shows the days and the next date.
- [ ] Toggle an alarm off: it greys out and no notification fires. Toggle it on: it is rescheduled. Delete removes it.
- [ ] Deny notification permission: a message asks you to allow notifications.

### Battery & Network
_Free. Needs: network, storage_

- [ ] Open the tool: the battery ring shows the same percentage as the system and the right charging state.
- [ ] Plug in or unplug the charger: the status changes live and the time estimate updates after a moment.
- [ ] Turn on airplane mode: the status switches to Offline immediately; turn it off: Online returns.
- [ ] Switch between Wi-Fi and mobile data: connection type or speed class changes.
- [ ] In a browser without the Battery API the battery card says it is not available and nothing breaks.

### Birthdays
_Free. Needs: notifications, storage_

- [ ] Add "Sam" with tomorrow's month and day and no year: Sam shows "Tomorrow".
- [ ] Add one with a birth year: the entry shows "turns N" with the right age.
- [ ] Add a birthday for today: it shows "Today!" with a party icon.
- [ ] Add 29 February: it is accepted and counts down correctly.
- [ ] Delete an entry (its reminder is cancelled). Day 32 or an empty name shows a toast.

### Calendar
_Free_

- [ ] Open the tool: the current month shows with today filled in the accent colour and week numbers on the left (check one against a printed calendar).
- [ ] Use the arrows to go to next month and tap a day: the card shows weekday, week number, day of year and "in N days".
- [ ] Switch "Week starts on Monday" off: columns start on Sunday and week numbers stay correct.
- [ ] In Days between two dates pick 1 Jan and 31 Dec of a leap year: the result shows 365 days.
- [ ] Tap the month title: it jumps back to today.

### Clipboard Pad
_Free. Needs: storage_

- [ ] Type "Hello" and tap Save clip: it appears in the list and the box clears.
- [ ] Tap Copy then paste into another app: the exact text arrives.
- [ ] Pin a clip: it moves to the top and stays there after saving more clips.
- [ ] Tap Paste with something on the clipboard: it fills the box (or a message explains if the system blocks it).
- [ ] Delete a clip with the cross. Saving an empty box shows a toast.

### Device Info
_Free_

- [ ] Open it. All rows have values. Battery matches the phone's level.
- [ ] Turn on airplane mode and reopen. Online shows No.

### Expense Tracker
_Free. Needs: storage_

- [ ] Add 12.50 as Food and 40 as Transport: the month total shows 52.50 and two category bars appear.
- [ ] The "Last 6 months" chart shows a bar for the current month. Set the currency to "EUR": amounts show it.
- [ ] Add an expense dated last month: the view jumps to that month; use the arrows to return.
- [ ] Delete an entry: totals and charts update.
- [ ] Add with an empty or zero amount: a toast asks for an amount.

### Flashlight
_Free. Needs: camera_

- [ ] Tap Turn on and allow the camera. The torch lights and the button says Turn off.
- [ ] Tap Turn off. The torch goes out.
- [ ] Leave the tool while on. The torch goes out.
- [ ] Deny the permission. A message says the torch is not available.

### Meeting Planner
_Free. Needs: storage_

- [ ] Open the tool: rows for You, London and Tokyo show 24 coloured hour cells each.
- [ ] Add New York: a fourth row appears and the "Best time for everyone" list updates (it may say there is no overlap).
- [ ] Remove Tokyo: the list now shows a window if one exists between you, London and New York.
- [ ] Change the date across a daylight saving change: the hour numbers in the affected row shift by one.
- [ ] Add a sixth city: a toast mentions the limit of five.

### Moon Phase
_Free_

- [ ] Open the tool: today's phase is drawn with its name and percent illuminated.
- [ ] Pick a known full moon date: the moon is fully lit and named Full moon (within a day).
- [ ] Use the Day arrows: the lit part grows or shrinks and the age changes by one day.
- [ ] Tap Today to return. The next new moon date is within 29.5 days.

### Multi Stopwatch
_Free_

- [ ] Tap Start, then tap Lap for Runner 1 and Runner 2 at different times: each shows its own lap time and total.
- [ ] Tap Lap for Runner 1 again: Lap 2 appears with the new split and the best lap updates.
- [ ] Tap Stop then Resume: the clock continues without losing time.
- [ ] Add a runner called "Alex" and remove another with the cross.
- [ ] Tap Lap before starting: a toast says to start the clock first. Reset clears all laps.

### Pomodoro
_Free. Needs: notifications, storage_

- [ ] Set Focus to 1 minute under "Adjust lengths", select Focus and tap Start: the display counts down and the progress bar fills.
- [ ] Press Pause, wait, press Resume: the remaining time resumes where it stopped.
- [ ] Start, lock the screen for the full minute: a notification arrives on time; on return the sessions today count has increased by one and the mode is Short break.
- [ ] Complete four focus sessions: the fourth is followed by a Long break and the tomatoes reset.
- [ ] Leave the tool mid-timer and come back: the timer continues with the correct remaining time. Reset and Skip behave as labelled.

### Quick Timers
_Free. Needs: notifications, storage_

- [ ] Tap Soft egg: a 6:00 timer appears and counts down with a progress bar.
- [ ] Tap Tea as well: both run at the same time.
- [ ] Enter "Test" and 1 minute and press Start; at zero a beep and notification fire and the card shows Done with a Dismiss button.
- [ ] Cancel a running timer: it disappears and its notification does not arrive.
- [ ] Leave the tool and return before it ends: the timer is still running with the right time.

### Reminders
_Free (limit: 3 active reminders (Pro: unlimited)). Needs: notifications_

- [ ] Add a reminder for 2 minutes from now. Allow notifications when asked. Close the app. A notification appears at the time.
- [ ] Add reminders until there are 3 active ones, then add a fourth. The Pro sheet opens.
- [ ] Delete a reminder with the cross. It disappears and no notification arrives for it.
- [ ] Try a time in the past. A message says to enter a future time.

### Screen Light
_Free_

- [ ] Open the tool: the preview shows a warm orange colour. Tap "Cool": the preview turns pale blue and the name changes.
- [ ] Tap "Full screen light": the whole screen fills with the colour and a control panel sits at the bottom. Tap the colour area: the panel hides; tap again: it returns.
- [ ] Drag the brightness slider down to 5%: the colour dims but the panel stays readable. Pick a custom colour in the picker: the screen follows.
- [ ] With "Keep the screen awake" on, leave the light on past the normal screen timeout: the display stays on. Tap "Close light": the screen can sleep again.
- [ ] Leave the tool with the back button while the light is open: the overlay disappears.

### Shopping List
_Free. Needs: storage_

- [ ] Type "Apples", set quantity 3 and tap Add: it appears with 3.
- [ ] Tap the "+ Milk" chip twice: the quantity of Milk becomes 2 instead of a duplicate.
- [ ] Tick Apples: it is crossed out and moves down; the summary counts items in the basket.
- [ ] Press minus down to 1: it does not go lower. Tap "Remove checked items": ticked items go.
- [ ] Add an empty name: a toast asks you to type an item.

### Signal Light
_Free. Needs: camera (torch, optional)_

- [ ] Select SOS and tap Start: the screen flashes three short, three long, three short, repeated. Tap the screen: it stops.
- [ ] Select Morse, type "HI" and start: four short flashes, a longer pause, two short flashes, then a long gap before repeating.
- [ ] Move the speed slider between fastest and slowest: the flashing rate visibly changes.
- [ ] Select Strobe and tap Start: the warning card appears and nothing flashes until you tap "I understand, start strobe".
- [ ] With "Also flash the torch" on and camera permission granted, the torch follows the pattern; on a device without a torch the screen still flashes.

### Stopwatch
_Free_

- [ ] Tap Start. The time runs. Tap Lap three times. Three laps appear, newest first.
- [ ] Tap Pause, wait, tap Resume. The time continues without jumping.
- [ ] Tap Reset. Time and laps clear.

### Timer
_Free_

- [ ] Open Timer, set 0 min 5 sec, tap Start. The display counts down and a tone plays at 00:00 with a "Time is up" message.
- [ ] Start 1 min, tap Pause after 5 s, then Resume. It continues from where it stopped.
- [ ] Tap Reset. The display shows the entered time again.
- [ ] Leave the tool while running and come back. The timer is stopped (no sound plays later).

### Tip of the Day
_Free_

- [ ] Open the tool: a tip is shown with "Today's pick" and the date.
- [ ] Tap Next and Previous: the text changes and the label shows "Tip n of 36".
- [ ] Close and reopen on the same day: the same tip is today's pick.
- [ ] Tap "Surprise me" several times: different tips appear. Copy and Share work.

### To-do List
_Free. Needs: storage_

- [ ] Add "Buy stamps" due tomorrow in category Home: it appears with "Home" and the date.
- [ ] Tick it: it is crossed out and moves to the bottom. The Done filter lists it.
- [ ] Add a task due yesterday: it shows "Overdue" in red and sorts first.
- [ ] Type part of a task name in Search: the list narrows.
- [ ] Tap Clear completed: ticked tasks disappear. Adding an empty task shows a toast.

### World Clock
_Free. Needs: storage_

- [ ] Open the tool: London, New York and Tokyo show live times with offsets such as "UTC+9".
- [ ] Type "Kath" in the search box, pick Kathmandu and tap Add: it shows UTC+5:45 and the correct difference from you.
- [ ] Use the up and down arrows to reorder; the order persists after leaving and reopening.
- [ ] Switch the 24-hour checkbox: all times change format. Remove a city with the cross.
- [ ] Add the same city twice: a toast says it is already added. A city where it is night shows the moon icon.

## 2. Navigate

### Altitude
_Free. Needs: location_

- [ ] Open it outdoors and allow location. Altitude, latitude, longitude and accuracy fill in.
- [ ] On a phone without altitude data the value shows "n/a".

### Compass
_Free. Needs: motion_

- [ ] Hold the phone flat and turn around. The dial rotates and the heading changes. North matches another compass app within about 15 degrees.
- [ ] On a phone without a compass sensor a message says so after a few seconds.

### Leveler
_Free. Needs: motion_

- [ ] Lay the phone on a flat table. The bubble is near the centre and the angles are close to 0.
- [ ] Lift one edge. The bubble moves toward the lower side and the angle grows.
- [ ] Tap "Set current position as zero" on a slightly tilted surface. The readout becomes 0.

### My PIN Code
_Free. Needs: location, storage_

- [ ] Open the tool outdoors: the Plus Code and coordinates fill in. Compare the Plus Code with another Plus Code source for the same spot (should match to about 14 m).
- [ ] Tap Copy coordinates, Copy Plus Code and Copy geo link: each shows "Copied" and pastes correctly. Tap Share: the system share sheet opens.
- [ ] Type "Home" (or tap the Home chip) and tap Save here. Walk 50 m away: the entry shows roughly 50 m with a direction, and the arrow turns as you rotate.
- [ ] Delete the place with the cross: it disappears. Saving with an empty name shows a toast.
- [ ] Deny location: the status explains the permission is denied.

### Parking Saver
_Free. Needs: location, notifications, storage_

- [ ] Open the tool, type a note, choose 30m and tap "Save my parking spot": the screen switches to the car view with distance and a meter countdown.
- [ ] Walk away 100 m: the distance updates and the arrow points to the car. "Open in map app" opens the geo link.
- [ ] Use a custom 6 minute meter: a warning notification arrives after 1 minute and the expiry one at 6, also with the app closed and the screen off.
- [ ] Tap "I found my car (clear)": the saved spot and scheduled notifications are removed and the setup screen returns.
- [ ] Tap Save before GPS has a fix: a "Getting a GPS fix" toast appears, then it saves.

### Route Recorder
_Free (limit: 1 saved route (Pro: unlimited routes and GPX export)). Needs: location, storage_

- [ ] Open the tool, allow location and tap Start recording: the status says it is looking for a fix, then the line and numbers update as you walk a few hundred metres outdoors.
- [ ] Tap Stop recording, edit the name and tap Save route: a toast confirms and the Saved routes tab lists it with distance and time.
- [ ] On the free plan record and save a second route: the Pro sheet opens (limit 1). With Pro the second route saves.
- [ ] In Saved routes tap a route: the map and stats show. Tap Export GPX: on free the Pro sheet opens; on Pro a .gpx file is shared or downloaded and opens in a GPX viewer.
- [ ] Delete a route: it disappears. Deny location permission: a clear message appears and nothing crashes.
- [ ] Start recording, leave the tool, come back: the unsaved track is offered for saving or discarding.

### Speedometer
_Free. Needs: location_

- [ ] Open it outdoors and allow location. "Waiting for GPS" disappears and speed shows 0 when standing still.
- [ ] Walk or ride. The speed and distance rise. Max speed keeps the highest value.
- [ ] Tap Reset trip. Max and distance go back to 0.
- [ ] Deny the permission. A message says location permission was denied.

### Sunrise & Sunset
_Free. Needs: location (optional)_

- [ ] Open the tool: default London values show sunrise and sunset for today with the day length.
- [ ] Tap "Use my location" and allow permission: the coordinates change to yours and the times update.
- [ ] Enter latitude 78.2 and longitude 15.6 with a date in late June: it says 24 h of daylight; with a date in late December: polar night.
- [ ] Compare the times with a weather site for your city: they agree within about 2 minutes.
- [ ] Deny location: a message explains; the manual fields still work.

## 3. Measure

### Distance Finder
_Free. Needs: motion_

- [ ] Set eye height 1.6 m, point the top edge at a mark on the floor and read the distance; compare with a tape measure (expect within about 10 percent).
- [ ] Tap "Hold angle", move the phone: the result stays; tap Live to resume.
- [ ] Aim at or above the horizon: the result shows "--".
- [ ] Switch units to feet and check the label changes.

### G Meter
_Free. Needs: motion_

- [ ] Lay the phone flat: the total reads about 1.00 g and Z about 1.00.
- [ ] Shake the phone: the gauge and graph spike and Peak increases.
- [ ] Tap Reset peak: peak and graph clear.
- [ ] Tick "Remove gravity": the total drops to about 0 when still (if the phone provides it).

### Height Finder
_Free. Needs: motion_

- [ ] Stand about 10 m from a wall. Sight along the top edge of the phone at the top of the wall and tap "Mark top"; then sight at the foot of the wall and tap "Mark base". With eye height 1.6 m the height appears.
- [ ] Clear the marks, mark only the top, type a distance of 10: the height shows as eye + d x tan(top).
- [ ] Switch to feet: the units on the labels and result change.
- [ ] Mark a base angle that points upward (positive): no result appears (needs a downward base angle or a distance).

### Light Meter
_Free. Needs: motion (ambient light sensor)_

- [ ] On a supported device cover the top of the phone with a hand: lux drops and the label becomes "Almost dark" or "Dim room".
- [ ] Point at a window: lux rises and the peak updates.
- [ ] On a device without the sensor API a clear message is shown.

### Magnetometer
_Free. Needs: motion_

- [ ] On a phone with the sensor the total reads about 25 to 65 microtesla away from metal.
- [ ] Move the phone near a speaker or magnet: the value jumps and the gauge fills.
- [ ] Tap "Zero baseline" to see only the change; tap again to go back to absolute.
- [ ] On a device or browser without the API: "does not provide a magnetic field sensor" appears and nothing crashes.

### Pendulum Bob
_Free. Needs: motion_

- [ ] Hold the phone upright: the bob hangs straight and the angle is near 0 and turns green when within 1 degree.
- [ ] Tilt it sideways: the line swings the same way and the Sideways value changes.
- [ ] Tilt the top towards or away from you: the bob grows or shrinks and Forward / back changes.
- [ ] Lay the phone flat: the angle reads about 90 degrees.

### Protractor
_Free. Needs: motion (tilt mode only)_

- [ ] Drag the arm round the dial: the big number follows, and dragging below the baseline snaps to 0 or 180.
- [ ] Drag to 90: the supplement and complement both read 90.
- [ ] Tap "Tilt phone": hold the phone upright against a wall, the arm moves as you rotate it in the plane of the screen. Tap "Set current tilt as zero" and the reading becomes 0.
- [ ] On a device without a motion sensor the tilt mode shows "No motion sensor found".

### Reaction Test
_Free. Needs: storage (best time)_

- [ ] Tap to start: the button turns red and says wait. Tap before green: "Too soon!".
- [ ] Start again and tap when it turns green: your time in ms shows and Last, Average, Best fill in.
- [ ] Leave and reopen: Best is remembered.

### RPM Counter
_Free. Needs: microphone (mic mode only)_

- [ ] Tap the big button once every half second: RPM settles near 120. Wait 3 seconds and tap again: the series restarts.
- [ ] Tap Reset: taps return to 0 and RPM to "--".
- [ ] Switch to Microphone and allow access. Hold the phone next to a steadily ticking clock or metronome set to 60 per minute: RPM reads about 60 after a few seconds.
- [ ] Deny the microphone permission: "Microphone permission denied." shows.

### Ruler
_Free. Needs: storage (saves the calibration)_

- [ ] Open Ruler. The cm scale shows on the top edge and the inch scale on the bottom. Tap Vertical: the ruler turns into a tall strip you can scroll.
- [ ] Tap "Calibrate with a credit card". Lay a real card lengthwise with its short edge on the top line, drag the handle to the card's other end, tap Save. The info line says "calibrated".
- [ ] Hold the card against the ruler: it should measure 8.6 cm (3.4 in).
- [ ] Leave the tool and reopen it: the calibration is still in place. Tap Reset: the info line says "not calibrated yet".

### Screen Info
_Free_

- [ ] Open the tool: resolution matches the phone's spec sheet (for example 1080 x 2400).
- [ ] Tap "Grid overlay": a 10 dp grid with bold lines every 100 dp fills the screen; tap to close.
- [ ] Tap "Dead pixel test": the screen turns red, green, blue, white, black on each tap and closes after black.
- [ ] Rotate the phone: the viewport row updates.

### Shadow Height
_Free_

- [ ] Stick 1 m with shadow 0.8 m, tree shadow 12 m: result 15.00 m.
- [ ] Switch to feet: the unit label changes.
- [ ] Set the stick shadow to 0: result shows "--".

### Slope Finder
_Free. Needs: motion_

- [ ] Lay the phone flat on a table: reads about 0 degrees. Prop one end on a 10 cm book on a 1 m board: about 5.7 degrees, 10 percent.
- [ ] Tap "Zero here" on a surface to calibrate it to 0.
- [ ] Tap Hold: the value freezes and the button says Release.
- [ ] Switch to "Sight along edge" and tilt the top edge upward: the angle reads the elevation.

### Sound Intensity
_Free. Needs: microphone_

- [ ] Open it and allow the microphone. The value changes with the sound around you.
- [ ] Clap near the phone. The maximum jumps up.
- [ ] Deny the permission. A message says it was denied.

### Speed Calc
_Free_

- [ ] Speed tab: 100 km in 1 hour gives 100 km/h and 62.14 mph.
- [ ] Distance tab: 60 km/h for 30 minutes gives 30 km.
- [ ] Time tab: 100 km at 50 km/h gives 2 h 0 min 0 s.
- [ ] Empty or zero fields show "--" and a hint, never an error.

### Stride & Pace
_Free. Needs: storage_

- [ ] Distance 20 m and 28 steps: 0.71 m per step. Tap "Save as my step length": the Steps to distance card fills in 0.71.
- [ ] Steps 10000 with step length 0.71: about 7.14 km.
- [ ] Running pace: 5 km in 30 minutes gives 6:00 per km and 10.0 km/h.
- [ ] Zero steps or empty fields show "--".

### Unit Price
_Free_

- [ ] Product A: 2.00 for 500 g; Product B: 3.00 for 1 kg. A shows 0.400 per 100 g, B 0.300; B is outlined green as best value.
- [ ] Change B's unit to ml: the message says mixed units cannot be compared.
- [ ] Clear everything: "Fill in at least two products".

### Vibrometer
_Free. Needs: motion_

- [ ] Lay the phone on a still table: label says "Still" and the gauge is empty.
- [ ] Tap the table next to the phone or place it on a running appliance: the label rises and the graph moves.
- [ ] Min and Max update; Reset clears them.
- [ ] On a device without sensors a clear message appears.

## 4. Calculate

### Age Calculator
_Free_

- [ ] Date of birth 1995-06-15, "Age on" 2026-10-06: shows 31 years 3 months 21 days, next birthday in 252 days (turning 32).
- [ ] Set "Age on" to a birthday itself: it says "Today! Turning N".
- [ ] Birth date 2000-02-29: it works in non-leap years (birthday counts as Mar 1).
- [ ] Set "Age on" earlier than the birth date: shows the prompt, no error.

### Area & Volume
_Free_

- [ ] Rectangle 10 by 5: area 50, perimeter 30, diagonal 11.18034.
- [ ] Circle radius 1: area 3.1415927, circumference 6.2831853.
- [ ] Sphere radius 3: volume 113.09734. Cone radius 3 height 4: slant height 5.
- [ ] Change shape: the input boxes change to match. Zero or empty values show a prompt.

### Billing
_Free. Needs: storage_

- [ ] Enter an item "Widget", qty 2, price 25, tax 10: total shows 55.00. Add a second item and remove it with the cross: totals update.
- [ ] Set discount type "%" with 10: subtotal 50, discount -5, tax 4.50, total 49.50.
- [ ] Tap Save: "Invoice #1 saved" and it appears under Saved invoices. Tap Save again: it updates the same entry, not a new one.
- [ ] Tap New invoice, save a different one, then tap View on the first: its items, customer and tax load back into the editor.
- [ ] Tap Copy and paste elsewhere: the text starts "INVOICE #1" and ends with "TOTAL: ...". Tap Share to open the system share sheet.
- [ ] Save more than 20 invoices: only the newest 20 stay. Tap the cross on one: it is deleted. Close and reopen the tool: business name, tax and saved invoices are still there.

### Break-even
_Free_

- [ ] Fixed 50,000, price 250, variable 150: 500 units, revenue 125,000, profit per unit 100.
- [ ] Add profit target 20,000: 700 units needed.
- [ ] Price equal to or below variable cost shows an explanatory message.

### Calculator
_Free_

- [ ] Enter 12 + 30 × 2 and press =. The result is 72.
- [ ] Press 50 % . The expression shows 0.5.
- [ ] Enter 1 ÷ 0 and press =. A message says the expression is invalid.
- [ ] Use backspace and clear.

### Cooking Units
_Free_

- [ ] 1 cup of plain flour: 120 g, 16 tablespoons, 48 teaspoons.
- [ ] 227 g of butter in grams: 1 cup.
- [ ] Switch ingredient to honey with the same 1 cup: 340 g.
- [ ] Amount 0 shows the prompt.

### Days Counter
_Free. Needs: storage_

- [ ] Set From 2024-01-01 and To 2024-03-01: shows 60 days, 8 w 4 d, 0y 2m 0d.
- [ ] Swap the dates (To earlier than From): the label says "To is earlier" and the same number of days is shown.
- [ ] Start 2024-02-28, 2 days, tap Add: 2024-03-01 (Friday). Tap Subtract: 2024-02-26.
- [ ] Save an event "Trip" a week from now: "in 7 days". Save one in the past: "N days ago". Save one today: "Today".
- [ ] Close and reopen: the events are still listed. Delete one with the cross.

### Discount & GST
_Free_

- [ ] Price 1000, discount 10%, tax 18%, "Without tax": final price 1,062.00, you save 100.00, tax 162.00.
- [ ] Price 1180, discount 0, tax 18%, "Including tax": price before tax 1,000.00, tax 180.00, final 1,180.00.
- [ ] Discount above 100 or a negative number shows the prompt, not a wrong result.

### EMI Calculator
_Free_

- [ ] Open it with the defaults (500,000, 8.5%, 5 years): Monthly EMI shows about 10,258.27 and a 12-row table appears.
- [ ] Set loan 1,000,000, rate 10, tenure 10 years: EMI is about 13,215.07.
- [ ] Set rate 0, loan 1200, tenure 12 months: EMI is 100.00 and total interest is 0.00.
- [ ] Switch "Tenure in" to Months and enter 6: the table shows 6 rows ending with balance 0.00.
- [ ] Clear the loan amount: the result is replaced by "Enter the values above." with no error.

### FD / RD
_Free_

- [ ] FD 100,000 at 7% for 5 years, quarterly: maturity about 141,478.
- [ ] RD 5,000 per month at 6.5% for 24 months: maturity a little above 120,000 deposited (interest roughly 8,000).
- [ ] Zero months or years shows the prompt.

### Fractions
_Free_

- [ ] 3/4 + 2/3 = 17/12, mixed number 1 5/12.
- [ ] 1/2 - 1/3 = 1/6; 2/3 x 3/4 = 1/2; 1/2 / 1/4 = 2.
- [ ] Enter "1 1/2" and "0.25" with +: result 7/4.
- [ ] Divide by 0 shows "Cannot divide by zero"; typing "abc" shows a prompt.

### Fuel Cost
_Free_

- [ ] 250 km at 15 km/L and price 100: fuel 16.67 L, cost 1,666.67.
- [ ] Change the unit to L/100 km and enter 8: efficiency shows 12.50 km/L.
- [ ] Unit mpg with 30: efficiency about 12.75 km/L.
- [ ] Mileage: 420 km with 30 L gives 14.00 km/L and 7.14 L per 100 km.
- [ ] Efficiency 0 shows the prompt.

### GCD & LCM
_Free_

- [ ] 12, 18, 30 gives GCD 6 and LCM 180.
- [ ] 4 6 10 gives GCD 2 and LCM 60.
- [ ] A single number, a zero or a decimal shows the prompt.

### Growth Rate
_Free_

- [ ] 10,000 to 18,000 over 5 years: about 12.47% per year, total growth 80%.
- [ ] 100 to 200 over 1 year: 100% per year.
- [ ] Zero or negative values show the prompt.

### Investment
_Free_

- [ ] Lump sum 1000, 10%, 2 years, Yearly: final value 1,210.00.
- [ ] Lump sum 1000, 12%, 1 year, Monthly: about 1,126.83.
- [ ] SIP 5000 per month, 12%, 10 years: future value about 1,161,695, invested 600,000.
- [ ] Set return to 0 for the SIP: value equals the amount invested.
- [ ] Years 0 or empty: shows the prompt.

### Loan Compare
_Free_

- [ ] Defaults (1,000,000; A 9% 120 months; B 8.5% 144 months): the table shows both EMIs and totals and names the cheaper offer with the difference.
- [ ] Make both offers identical: shows "Same total cost".
- [ ] Months 0 shows the prompt.

### Marks & GPA
_Free_

- [ ] Default marks (85, 72, 91, 42/50 with max 100): total 290 / 350, 82.857%.
- [ ] GPA lines "A 3" and "B 4": GPA 3.43 with 7 credits.
- [ ] Add a line of garbage text: it is ignored, the rest still calculates.
- [ ] Empty box shows the prompt.

### Markup & Margin
_Free_

- [ ] Cost 80, price 100: margin 20%, markup 25%, profit 20.
- [ ] Cost 80, 25% margin: price 106.67. Cost 80, 25% markup: price 100.
- [ ] A margin of 100% or more shows the prompt.

### Net Worth
_Free_

- [ ] Defaults: assets 450,000, debts 120,000, net worth 330,000.
- [ ] Amounts with commas (1,500) and decimals (80.50) are read correctly; lines without a number are ignored.
- [ ] Close and reopen: the lists are still there.

### Number Words
_Free_

- [ ] 123456789 Indian: "Twelve crore thirty-four lakh fifty-six thousand seven hundred eighty-nine".
- [ ] Same number International: "One hundred twenty-three million four hundred fifty-six thousand seven hundred eighty-nine".
- [ ] 12.5 gives "... and fifty hundredths"; -5 starts with "Minus".
- [ ] 0 gives "Zero". A number of one quadrillion or more shows the prompt.

### Percentage
_Free_

- [ ] 15% of 200 shows 30.
- [ ] 30 is what % of 120 shows 25%.
- [ ] From 80 to 100 shows "Increase 25%"; from 100 to 80 shows "Decrease 20%".
- [ ] Value 250 and 12%: plus 280, minus 220, percent itself 30.
- [ ] "X is what % of Y" with Y = 0 and "percent change" from 0 show the prompt instead of an error.

### Power Cost
_Free_

- [ ] 1500 W, 1 unit, 2 h/day, 8 per kWh: 3 kWh per day, 24.00 per day, 90 kWh and 720.00 per month, 8,760.00 per year.
- [ ] Hours per day above 24 shows the prompt.

### Prime Check
_Free_

- [ ] 360 gives composite, factors 2^3 × 3^2 × 5, 24 divisors.
- [ ] 97 gives "Yes, prime", next prime 101, previous 89.
- [ ] 999999937 is reported prime almost instantly.
- [ ] 1, a decimal or a negative number shows the prompt.

### Quadratic
_Free_

- [ ] a=1, b=-3, c=2: roots 1 and 2, discriminant 1, vertex (1.5, -0.25).
- [ ] a=1, b=2, c=1: one double root -1.
- [ ] a=1, b=0, c=1: roots 0 + 1i and 0 - 1i.
- [ ] a=0, b=2, c=-4: "Linear: x = 2". a=0 and b=0 shows a message.

### Random
_Free_

- [ ] Min 1, Max 6, tap Draw several times: always a whole number 1 to 6.
- [ ] Min 1, Max 3, How many 5, "No repeats" ticked: shows 3 different numbers only (the range is used up). Tapping Draw again says all numbers are drawn; "Reset no-repeat list" clears it.
- [ ] Min 10 and Max 1 (reversed): still works, giving a number from 1 to 10.
- [ ] Enter three names, tap Pick one: one of them is shown. Tap Shuffle: the lines are reordered. With an empty list a message asks to add items.
- [ ] Pick a random date between two dates: a date inside the range and its weekday appear.

### Ratio
_Free_

- [ ] 24 : 36 simplifies to 2 : 3.
- [ ] Proportion 3 : 5 = 12 : x gives x = 20.
- [ ] Split 1000 as 2 : 3: A gets 400.00 and B gets 600.00.
- [ ] Decimals in the simplify box show "Use whole numbers".

### Salary Convert
_Free_

- [ ] 25 per hour, 40 h/week, 52 weeks: per year 52,000.00, per month 4,333.33, per week 1,000.00, per day 200.00.
- [ ] Change "Per" to Year and enter 60,000: per hour 28.85.
- [ ] Hours per week 0 shows the prompt.

### Scientific
_Free_

- [ ] Type 7 x 6 and tap =: shows 42. Then tap Ans, + and 1: preview 43.
- [ ] In DEG, sin(30) gives 0.5, cos(60) gives 0.5, tan(90) shows an "Undefined" error. Tap DEG to switch to RAD: sin(pi/2) gives 1.
- [ ] 2^3^2 = 512, -2^2 = -4, 5! = 120, sqrt(144) = 12, log(1000) = 3, ln(e) = 1.
- [ ] 1/0 and sqrt(-1) show an error in red, nothing crashes. A missing closing bracket is accepted.
- [ ] M+ stores the current result (shown as "M = ..." at the top), MR inserts it, MC clears it. Tap the display to type with the keyboard.

### Simple Interest
_Free_

- [ ] 50,000 at 7% for 3 years: interest 10,500.00, total 60,500.00.
- [ ] Change time to 6 months at the same inputs (time 6): interest 1,750.00.
- [ ] Negative values show the prompt.

### Size Converter
_Free_

- [ ] Shoes UK 9: US men 10, US women 11.5, EU about 43.
- [ ] Foot length 27 cm gives US men 10.
- [ ] Women's clothing UK 10: US 6, EU 38.
- [ ] Chest 40 inches: 101.6 cm, EU 50, letter M.

### Statistics
_Free_

- [ ] Default list: mean 16.57, median 15, mode 8, range 38.
- [ ] 2 4 4 4 5 5 7 9: population std dev 2, sample std dev 2.1380899, median 4.5, mode 4.
- [ ] 1 2 3 4: mode shows "none".
- [ ] A single number: sample deviation shows a dash. Text with stray letters is skipped.

### Tally Counter
_Free. Needs: storage_

- [ ] Tap + three times then - once: shows 2 (the phone vibrates briefly on each tap).
- [ ] Set Step to 5 and tap +: the value goes up by 5.
- [ ] Tap Reset once: a toast asks to tap again. Tap again within 3 seconds: value is 0. Wait more than 3 seconds between taps: it does not reset.
- [ ] Type a name, tap Add: a new counter is selected. Tap the first counter in the list: its own value shows.
- [ ] Close and reopen the tool: all counters and values are kept. Delete a counter with the cross (needs a second tap); the last remaining counter has no delete button.

### Time Calc
_Free_

- [ ] Default list (1:30, 2h 15m, -0:45): total 3:00, decimal hours 3.
- [ ] Add a line "abc": a note says one line was not understood; the total is unchanged.
- [ ] Start 09:00, End 17:30, break 30: worked 8:00.
- [ ] Start 22:00, End 06:00: 8:00 and a "passes midnight" note.
- [ ] Break longer than the shift shows an error message.

### Tip Splitter
_Free_

- [ ] Bill 1200, tip 10%, 4 people, Exact: each pays 330.00, tip total 120.00.
- [ ] Bill 100, tip 15%, 3 people, "Round each share up": each pays 39.00, total 117.00, tip total 17.00.
- [ ] People 0 or blank shows the prompt instead of dividing by zero.

### Triangle
_Free_

- [ ] Sides 3, 4, 5: angles 36.8699, 53.1301, 90 degrees, area 6, type "scalene, right".
- [ ] Sides 1, 2, 3: message that they cannot form a triangle.
- [ ] Switch to "Two sides and the angle": 3, 4 and 90 degrees gives side c = 5.
- [ ] Angle 0 or 180 shows an error message.

### Unit Converter
_Free_

- [ ] Length: 1 mile to km gives 1.609344.
- [ ] Temperature: 100 C to F gives 212.
- [ ] Data: 1 GB to MB gives 1024.
- [ ] Clear the number box. The result shows a dash.

### Work Days
_Free_

- [ ] Start Friday 2024-01-05, 1 working day: Monday 2024-01-08.
- [ ] Start 2024-01-01, 10 working days: 2024-01-15.
- [ ] Working days from 2024-01-01 to 2024-01-12: 10 (both dates included).
- [ ] Choose "Fri + Sat" weekend: the result skips Fridays and Saturdays instead.
- [ ] End date before start date shows the prompt.

## 5. Text & Data

### Base64 & URL
_Free_

- [ ] Mode "Base64 encode", input `Hello, World!`. Output is `SGVsbG8sIFdvcmxkIQ==`.
- [ ] Tap Swap: the mode changes to decode and the input becomes the Base64; output is `Hello, World!`.
- [ ] Encode `héllo € 😀 日本語`, Swap: you get the exact original text back.
- [ ] Decode `@@@`: a red message "Not valid Base64." appears and the output is empty. Decode `SGk` (no padding): `Hi`.
- [ ] "URL encode" `a b&c=d/é` gives `a%20b%26c%3Dd%2F%C3%A9`; "URL decode" `%E0%A4%A` shows an error message.

### Binary & Hex
_Free_

- [ ] "Text to binary", `Hi`: `01001000 01101001`. "Text to hex": `48 69`. "Text to decimal": `72 105`.
- [ ] Tap Swap after "Text to hex": mode flips to "Hex to text" and the output returns `Hi`.
- [ ] "Hex to text" with `4869` (no spaces) and `0x48 0x69`: both give `Hi`.
- [ ] Round trip `héllo €😀` through each format: identical text.
- [ ] "Binary to text" with `12`: an error message appears. "Decimal to text" with `300`: "bigger than one byte".

### Braille
_Free_

- [ ] `abc` gives `⠁⠃⠉`. `Hello` gives `⠠⠓⠑⠇⠇⠕`. `123` gives `⠼⠁⠃⠉`.
- [ ] `HELLO` (all capitals) gives `⠠⠠⠓⠑⠇⠇⠕`.
- [ ] Swap to "Braille to text": the original text returns exactly, including capitals and numbers.
- [ ] Unknown Braille cells decode as `?`; unsupported characters are skipped when encoding.

### Caesar Cipher
_Free_

- [ ] Encode `Hello, World!` with shift 3: `Khoor, Zruog!`. Paste that result into the input and switch to Decode with shift 3: `Hello, World!`.
- [ ] Tap ROT13 and enter `Hello`: `Uryyb`. Apply again via Decode: `Hello`.
- [ ] Enter `Khoor` and tap "All 25 shifts": 25 rows appear, and row 23 reads `Hello`. Tap the button again to hide the list.
- [ ] Digits, punctuation and accented letters are left unchanged.

### Case & Slug
_Free_

- [ ] "URL slug" with `Crème Brûlée & Co.!` gives `creme-brulee-co`.
- [ ] "camelCase" with `hello big world` gives `helloBigWorld`; "PascalCase" gives `HelloBigWorld`.
- [ ] "snake_case" with `HTTPServer error` gives `http_server_error`.
- [ ] Two lines of input produce two lines of output. Empty input gives empty output.

### Checklist
_Free. Needs: storage_

- [ ] Type `Milk` and tap Add (or press Enter): it appears; "0 of 1 done".
- [ ] Add more, tick one: it is struck through; progress bar and "1 of 3 done" update.
- [ ] Close and reopen the app: items and ticks are kept.
- [ ] Tap ✕ on an item: removed. Tap "Clear ticked items": ticked ones disappear.
- [ ] Adding empty text does nothing.

### Colour Convert
_Free_

- [ ] Type `#FF8000` in HEX: RGB becomes 255, 128, 0 and HSL 30, 100, 50. The swatch turns orange.
- [ ] Type the short form `f80`: it is accepted and expanded.
- [ ] Change the R field to 0: HEX and HSL update. Change the H field to 240: the colour becomes blue-ish and the other fields follow.
- [ ] Tap the picker, choose a colour: all fields update. The swatch text switches between black and white for readability.
- [ ] Tap Copy on the `rgb(...)` line and paste elsewhere.

### CSV Viewer
_Free_

- [ ] Paste `name,age` / `Ada,36` / `Lin,29`: a table with header and 2 rows; "3 rows, 2 columns".
- [ ] Switch the view to JSON: array of objects `{"name":"Ada","age":"36"}`. Untick header: array of arrays.
- [ ] Paste `a,"x,y"` : the quoted comma stays in one cell. Paste a semicolon-separated file: auto separator handles it.
- [ ] Tap Copy JSON and paste elsewhere. Empty input shows nothing.

### Emoji & Symbols
_Free_

- [ ] Open the tool: Smileys shown. Tap three emoji: they appear in the text box at the top.
- [ ] Choose Currency from the group list: euro, pound, rupee and other symbols appear.
- [ ] Search `heart`: matching emoji appear across groups. Search `arrow`: arrows appear. Search nonsense: "Nothing found".
- [ ] Tap Copy and paste in another app: the characters appear. Tap Clear: the box is emptied.

### Fancy Text
_Free_

- [ ] Default text `Hello World` is shown in about 18 styles.
- [ ] Type `Test 123`: every style updates, digits included where the style has digits.
- [ ] Tap Copy on "Bold" and paste into a chat: bold-looking text appears.
- [ ] "Upside down" reverses and flips the text; clearing the box falls back to `Hello World`.

### Hash Maker
_Free_

- [ ] Type `abc`: SHA-256 is `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`. SHA-1 starts `a9993e36`.
- [ ] Clear the text: the hashes are those of an empty string (SHA-256 starts `e3b0c442`).
- [ ] Paste the SHA-256 above into "Compare": "Match: SHA-256" in green. Change one character: "No match" in red.
- [ ] Choose a small file: its hashes appear and match what another tool reports. Typing in the text box afterwards switches back to text.
- [ ] Tap Copy next to a hash and paste it elsewhere.

### JSON Tool
_Free_

- [ ] Paste `{"a":1,"b":[1,2]}`, tap Pretty: it becomes indented. Tap Minify: back to one line. Status shows "Valid JSON".
- [ ] Paste `{"a": 1,}` and tap Validate: red message with line 1 and the column of the stray `}`.
- [ ] Paste a multi-line object with a missing value on line 3: message says line 3 and the column, with a caret under it.
- [ ] Paste `[1, 2` (incomplete): "Unexpected end of text".
- [ ] Pretty with Tab indent uses tab characters. Tap Clear: box and status are emptied. Note: numbers larger than 15 digits may lose precision when pretty-printing.

### Lorem Ipsum
_Free_

- [ ] Choose Paragraphs, 3, tap Generate: three paragraphs separated by blank lines, starting with "Lorem ipsum dolor sit amet".
- [ ] Untick the classic start and Generate: starts differently.
- [ ] Choose Words, 5: exactly 5 words. Type 500 in the count: it is limited to 100.
- [ ] Tap Copy and paste elsewhere.

### Markdown View
_Free_

- [ ] Type `# Title` then a blank line and `Some **bold** and *italic*`: heading and styled text appear in the preview.
- [ ] Add `- a` / `- b` lines and `1. x` / `2. y` lines: bullet and numbered lists render.
- [ ] Type `<script>alert(1)</script>`: shown as plain text, nothing runs.
- [ ] Type `[bad](javascript:alert(1))`: not a link. `[ok](https://example.com)` is a link and tapping it does not navigate away.
- [ ] Tap Copy HTML: the generated HTML is copied.

### Morse Code
_Free_

- [ ] Choose "Text to Morse", type `SOS`. Output is `... --- ...`.
- [ ] Type `Hello World`. Output is `.... . .-.. .-.. --- / .-- --- .-. .-.. -..` (words separated by `/`).
- [ ] Switch to "Morse to text" (the output moves into the input). Output reads back `HELLO WORLD`. Type `...... ` and the result is `?`.
- [ ] Tap Play: you hear beeps matching the dots and dashes and the phone vibrates. Move the speed slider and play again: faster or slower. Tap Stop mid-play: sound and vibration stop at once.
- [ ] Untick Sound and Vibrate, tap Play: nothing plays and nothing crashes. Leave the tool while playing: sound stops.

### Name Picker
_Free. Needs: storage_

- [ ] Enter `Ann`, `Ben`, `Cara`, `Dev` and tap Pick one: names flash, then a winner stays.
- [ ] Choose 2 teams and tap Make teams: two cards with 2 names each; every name appears once. With 5 names and 2 teams the sizes are 3 and 2.
- [ ] With an empty list, tap Pick one: "Add some names first". With 1 name, Make teams asks for at least 2.
- [ ] Leave and reopen the tool: the list is still there. Leave during the animation: no errors.

### NATO Alphabet
_Free_

- [ ] "Text to NATO words" with `Hi 5`: `Hotel India / Five`.
- [ ] Tap Swap: mode becomes "NATO words to text", output `HI 5`.
- [ ] Decode `Foo`: shows `?`.
- [ ] Mixed case input works; punctuation passes through unchanged when encoding.

### Notes
_Free (limit: 10 notes (unlimited with Pro)). Needs: storage_

- [ ] Tap New, type a title and body, tap Done. The note appears in the list. Close and reopen the app: it is still there.
- [ ] Create a second note and pin it, then pin the first: pinned notes (with 📌) sort above others; newest edited first within each group.
- [ ] Type part of a word in Search: the list filters. Search for something absent: "No matches".
- [ ] Tap New and then Done without typing: the empty note is discarded.
- [ ] Tap Delete once: the button says "Tap again to delete". Tap again: note is removed. As a free user, create notes up to 10, then tap New for the 11th: the Pro sheet opens and no note is added.

### Number Bases
_Free_

- [ ] From base 10, type `255`: binary `11111111`, octal `377`, decimal `255`, hex `FF`.
- [ ] Choose From base 16, type `ff` or `0xFF`: same results.
- [ ] Type `123456789012345678901234567890` in base 10: the hex result is exact, and converting that hex back gives the same decimal.
- [ ] Choose binary and type `12`: a message says it is not a valid base-2 number.
- [ ] Choose "Other..." and set the custom base to 36, type `zz`: decimal `1295`. Tap a Copy button to copy a row.

### Number Sorter
_Free_

- [ ] Enter `5, 3, 9, 3, 1`: sorted `1, 3, 3, 5, 9`; count 5, sum 21, average 4.2, median 3.
- [ ] Tick "Remove duplicates": `1, 3, 5, 9`.
- [ ] Choose "Largest first": order reverses.
- [ ] Enter text with no numbers: "No numbers yet". Enter `-2.5 1e2`: both parsed.

### Password Maker
_Free_

- [ ] Open the tool: a 16 character password is shown with a strength bar. Tap Generate: a different password appears.
- [ ] Drag the length slider to 4 and then 64: the password length follows, and the strength label changes (Very weak up to Excellent).
- [ ] Untick everything except digits: the password is digits only. Untick the last option as well: it shows "Pick at least one option".
- [ ] Tick "Avoid look-alikes": generate several times and confirm no `I`, `l`, `1`, `O`, `0`, `o`.
- [ ] Tap Copy and paste elsewhere: the same password. Close and reopen the tool: your options are remembered.

### Phone Keypad
_Free_

- [ ] "Text to multi-tap" with `hello`: `44 33 555 555 666`. Swap: output `hello`.
- [ ] `hi you` gives `44 444 0 999 666 88` (0 is space).
- [ ] "Text to T9 digits" with `hello world`: `43556096753`.
- [ ] Decoding `27` (mixed digits) shows `?`.

### Pig Latin
_Free_

- [ ] `hello` gives `ellohay`; `apple` gives `appleway`; `string` gives `ingstray`.
- [ ] `Hello, World!` gives `Ellohay, Orldway!`.
- [ ] `Quiet` gives `Ietquay`; `my` gives `ymay`.
- [ ] Numbers and symbols pass through unchanged.

### QR & Barcode
_Free_

- [ ] Type: Text, enter `hello`. A QR code appears. Scan it with another phone: it reads `hello`.
- [ ] Type: Wi-Fi, enter a network name and password, security WPA. Scan with a phone camera: it offers to join that network. A name containing `;` or `:` still works.
- [ ] Type: Barcode EAN-13, enter `400638133393` (12 digits): the barcode shows `4 006381 333931` (check digit added). Enter `4006381333930`: an error says the check digit should be 1.
- [ ] Type: Barcode Code 128, enter `Hello 123`: barcode appears with the text underneath. Enter `héllo`: a message says only plain keyboard characters are supported.
- [ ] Enter 3000+ characters in Text: a "too much data" message shows, no crash. Tap Save PNG and Share: on Android the share sheet opens with the image; in a desktop browser a PNG downloads.

### Reading Time
_Free_

- [ ] Paste 400 words with Average speed: reading about 2 min 0 sec, speaking about 3 min 5 sec.
- [ ] Switch to Fast: reading time drops to about 1 min 20 sec.
- [ ] Empty text shows 0 sec and "0 words".

### Regex & Replace
_Free_

- [ ] Pattern `(\d+)-(\w)` flags `g`, text `a 12-x b 7-y`: 2 matches highlighted; list shows group 1 and 2 values.
- [ ] Replace with `$2$1`: result `a x12 b y7`.
- [ ] Pattern `(` shows the browser's error message in red and no crash.
- [ ] Flags `gi` with pattern `HELLO` matches `hello`. Pattern `a*` (can match empty) does not hang.
- [ ] Tap Copy result.

### Roman Numerals
_Free_

- [ ] Type `1994`: result `MCMXCIV`. Type `3999`: `MMMCMXCIX`.
- [ ] Type `mcmxciv` (lower case): result `1994`.
- [ ] Type `0` or `4000`: the result is `—` with a range message.
- [ ] Type `IIII` or `VX`: "Not a valid Roman numeral".
- [ ] Tap Copy result: the converted value is copied.

### Scratchpad
_Free. Needs: storage_

- [ ] Type text and tap Save snippet: it appears at the top of the list and the box clears.
- [ ] Tap Copy on a snippet and paste elsewhere.
- [ ] Tap Paste: the clipboard text fills the box (or a message explains how to paste manually if blocked).
- [ ] Tap ✕ to delete a snippet. Close and reopen the app: the remaining snippets persist.

### SMS Counter
_Free_

- [ ] Type 160 letters: 1 part, 0 left. Add one more: 2 parts.
- [ ] Type `€`: counts as 2 units. Type an emoji or `日本語`: switches to Unicode (70 per part).
- [ ] Type text with a `https://...` link: tweet count adds 23 for the link.
- [ ] Go above 280: tweet counter and bar turn red.

### Text Diff
_Free_

- [ ] Original `a`, `b`, `c` on three lines and Changed `a`, `c`, `d`: by line, `b` shows red and `d` green; summary says "1 added, 1 removed".
- [ ] Make both identical: "No differences".
- [ ] Switch to word mode with `the quick fox` vs `the slow fox`: `quick` red, `slow` green.
- [ ] Paste two very large texts (thousands of lines each): a message says they are too long, and nothing freezes.

### Text Tools
_Free_

- [ ] Type `Hello big world. How are you?` The counts show 6 words, 2 sentences, 1 line.
- [ ] Tap UPPER, then lower, then Title Case: the text changes each time. Tap Undo three times to return to the original.
- [ ] Paste lines `b`, `a`, `b`, `c` and tap Dedupe lines, then Sort Z-A: result is `c`, `b`, `a`.
- [ ] Tap Fix spaces on `a    b` (several spaces): result is `a b`. Tap Reverse on text containing an emoji: the emoji stays intact.
- [ ] Tap Copy with empty text: nothing happens. Paste 100,000 characters: the counts update without freezing.

### Timestamp
_Free_

- [ ] The "Now" number ticks every second; Copy copies it.
- [ ] Enter `1700000000`: UTC `Tue, 14 Nov 2023 22:13:20 GMT`, ISO `2023-11-14T22:13:20.000Z`. Enter `1700000000000`: same date (milliseconds detected).
- [ ] Enter `abc`: "Enter a valid number".
- [ ] Pick a date and time in the date field: seconds and milliseconds appear (in your local time zone). Leave the tool: the clock stops.

### UUID Maker
_Free_

- [ ] Open the tool: 5 UUIDs in the form `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx` (y is 8, 9, a or b).
- [ ] Tick UPPERCASE and No dashes, Generate: 32 upper-case characters per line.
- [ ] Set the count to 100: limited to 50. Set 0: becomes 1.
- [ ] Tap Copy all and paste elsewhere.

### Word Frequency
_Free_

- [ ] Paste `the cat and the dog and the bird`: with "Skip common words" off, `the` is first with 3; on, it shows cat, bird, dog with 1 each.
- [ ] The summary shows total and different word counts.
- [ ] Empty text shows an empty list. Words in other languages (accents, non-Latin) are counted.
- [ ] Tap Copy list: `word<TAB>count` lines are copied.

## 6. Audio

### Audio Player
_Free. Needs: storage_

- [ ] Press "Choose audio files" and pick one or more songs: the first loads; press Play and it plays. The time and seek bar update and dragging the bar seeks.
- [ ] Set Speed to 0.5x: playback slows. Untick "Keep pitch": the pitch now drops with the speed.
- [ ] During playback press Set A, then later Set B: the section A to B loops. Clear removes the loop.
- [ ] Tap the "Bass boost" preset: bass is louder and the 60 Hz slider shows +8. Move a band slider manually.
- [ ] With several files, let one end: the next one starts. Pick a non-audio file: a message says no audio files were chosen. Leaving stops playback.

### Binaural Beats
_Free_

- [ ] With headphones press Play: a steady tone is heard and the text shows left and right frequencies (for example left 200 Hz, right 210 Hz).
- [ ] Tap "Theta 6 Hz": the beat value changes to 6 and the right tone updates live. Move the carrier slider: both tones shift.
- [ ] Set the timer to 10 minutes: the "Stops in" countdown appears.
- [ ] Press Stop: the sound fades out. Leave while playing: sound stops.

### Chords & Scales
_Free_

- [ ] Pick root C and Chord Major: the notes show C E G and three keys highlight. Press Play: a strummed chord sounds.
- [ ] Choose root A and type Minor: A C E. Choose Dominant 7: four notes.
- [ ] Switch Show to Scale and pick Blues: six notes show and Play plays them one by one upward and then the octave.
- [ ] Reopen the tool: the last selected root is remembered.

### Clap Counter
_Free. Needs: microphone_

- [ ] Press Start listening and allow the microphone. Clap once: the counter goes to 1 and the phone vibrates briefly.
- [ ] Clap about 10 times in 5 seconds: the count rises by 10 (not more) and claps per minute shows about 120.
- [ ] Raise sensitivity if quiet claps are missed; lower it if background noise counts. The red marker on the level bar moves.
- [ ] Press Reset: count and rate go to 0. Deny the permission: a message is shown.

### Dog Whistle
_Free_

- [ ] Set 12000 Hz and press Play: a high tone is clearly audible. Raise the frequency: it becomes fainter or inaudible to you.
- [ ] Tap the 15k, 17k, 19k and 21k presets: the frequency value and slider update, the sound changes live.
- [ ] Choose Pulsing: the tone beeps on and off. Choose Sweep: the pitch glides around the chosen value.
- [ ] Press Stop or leave the tool: sound stops.

### Drum Pad
_Free_

- [ ] Tap each pad: a different drum sound plays instantly and the pad flashes with a short vibration.
- [ ] Tap two pads at the same time with two fingers: both sounds play.
- [ ] Tap one pad rapidly: no delay or missed hits.
- [ ] Lower the volume slider: hits become quieter.
- [ ] Leave the tool: no sound continues.

### Hearing Test
_Free_

- [ ] With headphones, press Start test: a tone plays for 2.5 seconds and the frequency is shown. Press "I hear it": the next, higher tone plays.
- [ ] Press "Cannot hear": the test ends and shows the highest frequency you confirmed (or none).
- [ ] Press Replay tone: the current tone plays again.
- [ ] Choose Left ear: the tone plays only in the left earphone.
- [ ] Answer yes to every tone: after 20 kHz the result says 20 kHz. Leave mid-tone: sound stops.

### Metronome
_Free_

- [ ] Open the tool, press Start: a click plays and the dots light in turn, the first dot (accent) is a higher pitch. Press Stop: the sound stops and the dots reset.
- [ ] Move the slider to 60 and count: one click per second. Use -5, -1, +1, +5 buttons: the number changes and stays within 30 to 300.
- [ ] Change the time signature to 3/4 while playing: three dots appear and the accent comes every third beat.
- [ ] Tap "Tap tempo" about 5 times at an even pace: the BPM follows your taps. Wait 3 seconds then tap twice: the tempo restarts from the new taps.
- [ ] Leave the tool while it plays: the sound stops. Reopen: the last BPM and signature are remembered.

### Mike
_Free. Needs: microphone_

- [ ] The Start button is disabled until the headphone/low-volume checkbox is ticked.
- [ ] With headphones on, tick it and press Start, allow the microphone, then speak: your voice is heard in the headphones and the level bar moves.
- [ ] Move the volume boost slider: the voice gets louder or quieter. At 0% it is silent.
- [ ] Press Stop: sound stops and the bar empties. Leave the tool while running: the microphone is released.
- [ ] Deny the permission: a message says the microphone permission was denied.

### Piano
_Free_

- [ ] Tap white and black keys: the matching notes sound and the key highlights while pressed.
- [ ] Press three keys with different fingers: all three sound together (chord) and release independently.
- [ ] Press Oct + : labels change to the next range (for example C5 to C7) and the pitch is higher. Oct - at the lowest range does nothing more.
- [ ] Change Sound to Retro: the timbre changes on the next key press.
- [ ] Slide a finger across the keys: notes change as the finger crosses each key, with no stuck notes after lifting.

### Pitch Pipe
_Free_

- [ ] Tap A with octave 4: a steady tone plays, the button is highlighted and the display shows A4 at 440.0 Hz.
- [ ] Tap another note: the first stops and the new one plays. Tap the same note again: it stops.
- [ ] Change the octave while a note plays: the tone stops. Move the volume slider: loudness changes live.
- [ ] Leave the tool: sound stops.

### Sleep Sounds
_Free_

- [ ] Tap Rain: it starts playing at once with a fade-in and the button highlights. Tap Ocean: the sound switches and slow waves are heard.
- [ ] Move the volume slider: loudness changes; reopen the tool and the volume is remembered.
- [ ] Choose a 15 minute timer: the countdown appears and runs. (Quick check: it should show about 00:15:00 minus elapsed time.)
- [ ] Press Stop: sound fades out and text says Stopped. Press Play again: it resumes.
- [ ] Leave the tool while playing: sound stops completely.

### Speaker Cleaner
_Free_

- [ ] Read the 3-step instructions, turn media volume up and press Start: a loud low tone plays and the countdown runs down.
- [ ] Pick the sweep mode and start: the pitch wobbles slowly between low notes.
- [ ] Press Stop early: sound stops and the progress resets.
- [ ] Let it finish: sound stops, the display says Done, the phone vibrates and a message appears.

### Spectrum
_Free. Needs: microphone_

- [ ] Press Start and allow the microphone: bars move with ambient sound and the waveform scrolls.
- [ ] Whistle or play a steady tone: one tall bar appears at the matching band and the "loudest frequency" number matches roughly.
- [ ] Stay quiet: bars fall and the frequency shows "--".
- [ ] Press Stop: drawing clears. Leave the tool: the microphone indicator in Android goes away.
- [ ] Deny the permission: a permission message appears.

### Speech to Text
_Free. Needs: microphone_

- [ ] Tap Start listening, allow the microphone and speak a sentence. The words appear.
- [ ] Tap Copy and paste elsewhere. The text is pasted.
- [ ] On a phone without speech recognition a message says it is not available.

### Stereo Test
_Free_

- [ ] Press Left: sound only comes from the left side and the L box lights up. Press Right: only right.
- [ ] Press Alternate: the sound switches sides every second and the L/R boxes alternate.
- [ ] Change Sound to Pink noise while playing: the sound changes without stopping the mode.
- [ ] Press Stop: silence and indicators clear. Leave the tool: sound stops.

### Text to Speech
_Free_

- [ ] Type a sentence and tap Speak. It is read aloud.
- [ ] Change the speed and speak again. The pace changes.
- [ ] Tap Stop while speaking. It stops. Leaving the tool also stops it.

### Tone Generator
_Free_

- [ ] Press Play at the default 440 Hz: a steady tone plays at low volume and the note reads A4. Press Stop: it fades out.
- [ ] Drag the slider while playing: the pitch changes smoothly and the number box follows. Type 1000 in the box: pitch jumps to 1 kHz. Type 5 or 99999: it clamps to 20 or 20000.
- [ ] Change waveform to square: the timbre becomes buzzier. Raise volume above 70%: label shows "(loud!)".
- [ ] Tick Sweep, set To 2000 and 5 seconds, press Play: the frequency glides up and down repeatedly and the readout moves.
- [ ] Leave the tool while playing: sound stops.

### Tone Sequencer
_Free_

- [ ] Tap several cells (they turn colored) and press Play: the notes play in order and a green outline marks the current step. Higher rows are higher notes.
- [ ] Change the tempo slider while playing: the speed changes smoothly.
- [ ] Press Random: a new pattern appears. Press Clear: the grid empties and playback is silent.
- [ ] Press Stop: playback stops and the outline clears. Reopen: the last pattern and tempo return.

### Tuner
_Free. Needs: microphone_

- [ ] Press Start tuner and allow the microphone. Play or whistle a steady note (or play a 440 Hz tone from another device): the note shows A, around 0 cents, needle near the centre, green when within 5 cents.
- [ ] Sing slightly flat or sharp: the cents value goes negative or positive and the hint says tighten or loosen.
- [ ] Choose Guitar: six string buttons appear; the nearest string highlights as you play. Tap a string button to lock it (lock icon) and tap again to unlock.
- [ ] Stay silent for a second: the display returns to "Listening...".
- [ ] Deny the microphone permission: a clear permission message appears and nothing crashes. Leaving the tool stops the microphone.

### Vocal Range
_Free. Needs: microphone_

- [ ] Press Start, allow the microphone and sing a steady low note: the current note shows, and after about half a second it becomes the Lowest value.
- [ ] Slide up to a high note and hold: Highest updates; the range text shows semitones and octaves and a voice type guess.
- [ ] Brief noises or speech do not change the range (only held notes do).
- [ ] Reopen the tool: the saved range is displayed. Press Reset range: both values clear.

### Voice Recorder
_Free (limit: 3 saved recordings (Pro: unlimited)). Needs: microphone, storage_

- [ ] Press Record, allow the microphone, speak for a few seconds: the timer counts and status says Recording. Press Pause: the timer freezes; Resume continues; Stop saves a "Recording <date time>" item.
- [ ] Press play on an item: it plays and the button becomes a stop square. Press it again: playback stops.
- [ ] Press the pencil, change the name and press Save: the new name shows and is still there after reopening the tool. Press the share arrow: the share sheet (Android) or a download (browser) appears.
- [ ] Press the bin once: it turns into "Sure?"; press again to delete. Without the second press it resets after 3 seconds.
- [ ] As a free user with 3 recordings, press Record: the Pro sheet opens and nothing records.
- [ ] Deny the microphone: a permission message shows.

## 7. Camera

### Blank Cam
_Free. Needs: camera, microphone_

- [ ] Open the tool. Expected: the legal note about consent is visible.
- [ ] Choose a camera, keep Record sound ticked and tap Start recording; allow permissions. Expected: the screen goes fully black with a faint timer and a Stop button.
- [ ] Wait ten seconds, then tap Stop. Expected: the black screen closes and a video player with the file size appears.
- [ ] Tap Save / share video. Expected: the share sheet or a download of a WebM file.
- [ ] Untick Record sound and record again, or deny the microphone. Expected: it still records video only or shows a clear message. Leaving the tool mid-recording stops the camera.

### Code Scanner
_Free. Needs: camera_

- [ ] Open the tool and point at a QR code containing https://example.com. Expected: a result card shows the text, the phone vibrates, and Open link and Copy are available.
- [ ] Scan a QR code with plain text. Expected: the text is shown and no Open link button appears.
- [ ] Tap Scan again, then Copy. Expected: scanning resumes; copied text can be pasted.
- [ ] Tap Scan from a picture and choose a screenshot of a code. Expected: the code is decoded; a picture with no code shows No code found.
- [ ] Check History keeps the last 20 scans and Clear history empties it. Denied camera shows a message.

### Collage
_Free. Needs: storage_

- [ ] Tap Pick pictures and choose 4 photos. Expected: a 2 x 2 collage appears.
- [ ] Change Layout to 3 across. Expected: the collage re-arranges; with fewer pictures than cells, pictures repeat.
- [ ] Move Spacing and change Background. Expected: gaps and colour update live.
- [ ] Tap Shuffle. Expected: the picture order changes.
- [ ] Tap Save collage. Expected: a JPEG is offered. Pressing Save before picking pictures shows a message.

### Colour Detector
_Free. Needs: camera_

- [ ] Open the tool and point the crosshair at a red object. Expected: the swatch, HEX, RGB and a name such as Red or Crimson update live.
- [ ] Tap the camera view. Expected: a Locked badge appears, values stop changing and the colour is added to the history.
- [ ] Tap Copy HEX, then paste somewhere. Expected: the HEX value such as #C0392B is pasted.
- [ ] Tap a history swatch. Expected: its HEX is copied. Tap Clear history. Expected: the list empties.
- [ ] Leave and reopen the tool. Expected: history is kept. With camera denied, a permission message shows.

### Doc Scanner
_Free. Needs: camera, storage_

- [ ] Tap Take photo (or Pick image) and choose a photo of a sheet of paper taken at an angle. Expected: the photo shows with four draggable circles.
- [ ] Drag the circles onto the page corners. Expected: the blue outline follows.
- [ ] Tap Straighten and crop. Expected: a flat, rectangular page appears in black and white.
- [ ] Switch Look between Colour, Grey and Black and white, and tap Rotate. Expected: the result updates.
- [ ] Tap Save as JPEG. Expected: the image is offered for saving. Tap Adjust corners to go back and refine.

### Eye Dropper
_Free. Needs: storage_

- [ ] Tap Pick a picture. Expected: the picture and a ring marker appear, with the centre colour read out.
- [ ] Touch and drag across the picture. Expected: the ring follows and the swatch, HEX, RGB and name update.
- [ ] Tap Copy HEX. Expected: the value can be pasted elsewhere.
- [ ] Tap a main colour swatch. Expected: that colour becomes the selected one.
- [ ] Pick a very small image. Expected: it still works without errors.

### Grid Cam
_Free. Needs: camera, motion_

- [ ] Open the tool. Expected: camera view with thirds lines and a yellow horizon line.
- [ ] Tilt the phone left and right. Expected: the line rotates against the tilt and the angle badge changes; within 1.5 degrees it turns green and says Level.
- [ ] Change Grid to Cross and None. Expected: the overlay changes.
- [ ] Tap Capture photo. Expected: a clean photo (no grid drawn in) is offered for saving.
- [ ] On a device with no motion sensor or denied permission, a message says the level line is off and the camera still works.

### Image Shrink
_Free. Needs: storage_

- [ ] Tap Pick pictures and select 2 large photos. Expected: the count is shown.
- [ ] Choose 1024 px, JPEG, quality 60 and tap Shrink pictures. Expected: each file is listed with the original and new size and a percentage smaller.
- [ ] Tap Save on a result. Expected: the smaller file is offered for saving.
- [ ] Choose Keep size with quality 100 on a small PNG. Expected: it may say no saving instead of failing.
- [ ] Include a non-image file. Expected: that entry says Could not read this file, others still work.

### Img Convert
_Free. Needs: storage_

- [ ] Pick a PNG and convert to JPEG. Expected: a result named like photo.jpg with its size.
- [ ] Pick a JPEG and convert to PNG. Expected: a larger .png result with the same pixel size.
- [ ] Convert to WebP. Expected: a .webp file, or a note that the device saved PNG if WebP is unsupported.
- [ ] Change Quality and convert again to JPEG. Expected: file size changes.
- [ ] Tap Save on a result. Expected: the file is offered for saving.

### Magnifier
_Free. Needs: camera_

- [ ] Open the tool and allow the camera. Expected: a live rear-camera view appears.
- [ ] Drag Zoom to the right. Expected: the view enlarges and the label shows the factor.
- [ ] Tap Freeze, move the phone, then tap Unfreeze. Expected: the picture stays still while frozen and goes live again after.
- [ ] Tap Torch (shown only if the phone supports it). Expected: the light switches on and off.
- [ ] Tap Save. Expected: the share sheet (or a download in a desktop browser) offers a JPEG with the zoom and filters applied.
- [ ] Deny the camera permission and reopen. Expected: a clear message about permission, no crash.

### Mirror
_Free. Needs: camera_

- [ ] Open the tool and allow the camera. Expected: your face appears mirrored (raise your right hand, the right side of the screen moves).
- [ ] Drag Zoom up. Expected: the view enlarges.
- [ ] Tap Freeze then Unfreeze. Expected: the picture holds still and then resumes.
- [ ] Tap Use rear camera. Expected: the rear camera shows without mirroring.
- [ ] Deny the camera. Expected: a clear permission message.

### Motion Cam (Pro)
_Pro. Needs: camera_

- [ ] As a free user open the tool. Expected: the Pro sheet appears. With Pro, the tool opens.
- [ ] Point the phone at a still scene and tap Start watching. Expected: Watching badge, level bar near zero, no log entries after the 2 second arming time.
- [ ] Wave a hand in front of the camera. Expected: a beep and vibration, and a log entry with a thumbnail and the time.
- [ ] Raise Sensitivity to 10 and move slightly. Expected: it triggers more easily; at 1 only large movement triggers. Repeated motion logs at most once per 3 seconds.
- [ ] Tap Save on a log entry, then Clear log. Expected: a JPEG is offered; the list empties. Denied camera shows a message.

### Night Cam
_Free. Needs: camera_

- [ ] Open the tool in a dim room. Expected: a live, brightened picture with a green tint.
- [ ] Untick the green tint. Expected: the picture becomes normal colour.
- [ ] Raise Gamma boost and Brightness. Expected: dark areas get visibly lighter (and noisier).
- [ ] Tap Capture photo. Expected: a processed JPEG is offered for saving.
- [ ] Deny the camera. Expected: a clear message, no crash.

### Photo Cleaner
_Free. Needs: storage_

- [ ] Pick a photo taken with the phone camera with location on. Expected: the result says Removed metadata including location.
- [ ] Tap Save and open the saved file in an EXIF viewer. Expected: no GPS or camera data remains and the picture size is unchanged.
- [ ] Pick a screenshot (PNG). Expected: it says Re-encoded without metadata and saves as PNG.
- [ ] Pick several photos at once. Expected: each is listed with its own Save button.
- [ ] Pick a file that is not a picture. Expected: Could not read this file for that item only.

### Photo FX
_Free. Needs: storage_

- [ ] Tap Pick a picture. Expected: it shows in the preview with its pixel size.
- [ ] Choose Look grey, then sepia. Expected: the preview changes accordingly.
- [ ] Move Brightness, Contrast and Saturation. Expected: the preview updates live; Reset restores the original.
- [ ] Tap Rotate twice and Flip. Expected: the picture turns upside down and mirrors.
- [ ] Tap Save JPEG. Expected: the edited full-size picture is offered for saving.

### Pixel Ruler
_Free. Needs: camera, storage_

- [ ] Tap Take photo or Pick picture and choose a photo containing a credit card. Expected: the photo shows with two circles and a line.
- [ ] Drag the circles apart. Expected: the pixel distance updates live.
- [ ] Place the points on the card long edge, enter 85.6 with unit mm, tap Set scale. Expected: the big number now shows about 85.60 mm.
- [ ] Move the points to another object. Expected: the length is shown in mm.
- [ ] Tap Clear scale. Expected: it goes back to pixels. Entering no length shows a message.

### Stop Motion (Pro)
_Pro. Needs: camera_

- [ ] As a free user open the tool. Expected: the Pro sheet appears. With Pro, the live camera shows.
- [ ] Tap Capture frame, move the subject slightly, capture again. Expected: each frame appears in the list and the previous frame is faintly overlaid on the live view.
- [ ] Use the arrows and the cross on a frame. Expected: frames reorder or are removed and the count and duration update.
- [ ] Set the speed to 4 fps and tap Play. Expected: frames cycle in the preview; Stop returns to the camera.
- [ ] Tap Export WebM video with at least 2 frames. Expected: a progress count, then a save/share offer of a WebM file. With fewer than 2 frames a message appears.

### Time-lapse
_Free. Needs: camera_

- [ ] Choose Every 1 s and tap Start capturing. Expected: the frame counter climbs once per second.
- [ ] Tap Stop capturing after about 10 frames, then Make video. Expected: progress text, then a video player and a Save / share video button.
- [ ] Play the video. Expected: the frames play quickly as a time-lapse.
- [ ] Tap Discard frames. Expected: the counter returns to 0. Make video with under 2 frames shows a message.
- [ ] Deny the camera. Expected: a clear message.

### Timer Cam
_Free. Needs: camera_

- [ ] Set Delay 3 s, Shots 1 and tap Start timer. Expected: a 3, 2, 1 countdown on screen then a thumbnail appears.
- [ ] Set Shots 3 and start. Expected: three pictures are taken a couple of seconds apart.
- [ ] Start the timer and tap Cancel mid-countdown. Expected: the countdown stops and no picture is added.
- [ ] Tap a thumbnail. Expected: the picture is offered for saving.
- [ ] Switch to the front camera and capture. Expected: the saved photo is mirrored like the preview. Denied camera shows a message.

## 8. Health

### BMI Calculator
_Free. Needs: storage_

- [ ] 175 cm and 70 kg: BMI 22.9, "Healthy weight", marker in the green part, range about 56.7 to 76.3 kg.
- [ ] Switch to Imperial, enter 5 ft 9 in and 200 lb: category Overweight.
- [ ] Clear the weight field: shows "--" and "Enter height and weight".
- [ ] Reopen the tool: last values and unit are restored.

### Body Fat
_Free. Needs: storage_

- [ ] Male, 180 cm, neck 38, waist 85: about 16.1 percent, "Fitness" or "Average" band.
- [ ] Switch to Female: a hip field appears; leave it empty and the result is "--", then enter 100 and a value appears.
- [ ] Waist smaller than neck: result "--" with no error.

### Breathing
_Free. Needs: none (vibration optional)_

- [ ] Box 4-4-4-4, 1 minute, press Start: the circle grows while "Breathe in", stays during Hold, shrinks on "Breathe out"; the countdown counts each phase.
- [ ] Choose 4-7-8 and run: hold lasts 7 seconds, out 8.
- [ ] Custom with in 3, hold 0, out 6: the hold phase is skipped.
- [ ] Press Stop mid-session: the circle resets. Let a session finish: "Well done" and a vibration.
- [ ] Leave the tool while running: the timer and vibration stop.

### Calorie & BMR
_Free. Needs: storage_

- [ ] Male, 30, 175 cm, 75 kg: BMR 1699, Sedentary maintenance 2039.
- [ ] Switch to Female: BMR drops by 166.
- [ ] Choose "Lose 0.5 kg a week": target is 500 below maintenance; for small bodies a warning about going below 1200 or 1500 appears.
- [ ] Empty a field: results show "--" with no error.

### Cycle Tracker
_Free. Needs: storage_

- [ ] Add a start date: it predicts the next period 28 days later and shows the fertile window.
- [ ] Add start dates 29 and 58 days ago: cycle length shows 29 d and the text says it was learned from your cycles.
- [ ] Delete a date with the cross: the list and prediction update.
- [ ] Adding the same date twice does not duplicate it.

### Due Date
_Free. Needs: storage_

- [ ] Pick a last period date 10 weeks ago: the due date is 280 days after it, "10 weeks 0 days", trimester 1.
- [ ] Change the cycle length to 32: the due date moves 4 days later.
- [ ] Pick a future date: "Date is in the future".
- [ ] Reopen: the date is remembered.

### Eye Rest 20-20-20
_Free. Needs: storage_

- [ ] Set work minutes to 5, press Start: the ring counts down.
- [ ] When it ends a beep plays and "Look 20 feet away now" shows for 20 seconds, then work time restarts and Breaks today goes up by one.
- [ ] Press Stop: the timer resets. Leave the tool: nothing keeps beeping.

### Fasting Timer
_Free. Needs: storage_

- [ ] Choose 16:8 and tap Start fast: the ring and "0h 00m" appear and the button becomes End fast.
- [ ] Leave and reopen the tool: the fast is still running with the elapsed time.
- [ ] End the fast after more than a minute: it appears in History.
- [ ] Change the goal during a fast: "of N hours" updates.

### Habit Streaks
_Free. Needs: storage_

- [ ] Add a habit "Read": it shows 0 days. Tap "Mark done": streak 1 and today's dot turns green.
- [ ] Tap again to untick: streak returns to 0.
- [ ] Delete a habit: a confirmation appears and the habit goes.
- [ ] Reopen the tool: habits and ticks are kept.

### Health Log
_Free. Needs: storage_

- [ ] Add weight 70, then 69.5 on another date: the chart draws two points and both appear in the list.
- [ ] BP tab: enter 120 and 80: the chart draws two lines (systolic and diastolic).
- [ ] Custom: name "Temperature", unit "C", value 36.6: it shows in the list and charts on the Custom tab while the name matches.
- [ ] Tap the cross on an entry and confirm: it is removed. Tap "Export as text" and "Copy text": the text contains all entries with dates.
- [ ] Add with an empty value: "Enter a value" toast.

### Heart Rate
_Free. Needs: camera_

- [ ] Tap Start measuring and allow the camera. The flash turns on. Without a finger on the lens the message says to cover the camera and flash.
- [ ] Rest a fingertip lightly over the lens and flash and hold still: the countdown runs, a live waveform shows and a BPM appears after about 10 seconds; the final value is within about 5 to 10 BPM of a reference at rest.
- [ ] Lift the finger mid-measurement: the timer restarts when you cover it again.
- [ ] Deny the camera: "Camera permission denied." Leave the tool: the camera and flash switch off.
- [ ] The "Approximate, not medical" notice is always visible.

### Ideal Weight
_Free_

- [ ] Male, 175 cm: four formula values around 66 to 72 kg and a healthy range of about 56.7 to 76.3 kg.
- [ ] Switch to Imperial, 5 ft 9 in: values are shown in pounds.
- [ ] Height under 100 cm: "Enter a height".

### Macro Calculator
_Free. Needs: storage_

- [ ] 2000 kcal Balanced (40/30/30): carbs 200 g, protein 150 g, fat 67 g.
- [ ] Choose Keto: fat rises to about 156 g and carbs falls to 25 g.
- [ ] Custom with 50, 30, 30: a note says the percentages add to 110 and are scaled.
- [ ] Empty calories: results "--".

### Meditation
_Free_

- [ ] Choose 5 minutes and tap Begin: a bell sounds, the ring fills and the time counts down.
- [ ] Set Interval bell to Every minute: a bell sounds each minute.
- [ ] Type 1 as custom minutes: the display shows 1:00; Begin and wait: the end bell rings 3 times and "Session complete" shows.
- [ ] End session early: the ring resets.

### Mood Log
_Free. Needs: storage_

- [ ] Tap Save today with no face chosen: "Pick a face first".
- [ ] Pick a face, add a note and Save: today's bar appears and the entry shows in the list.
- [ ] Reopen the tool: today's face and note are pre-selected; saving again replaces today's entry.

### Sleep Calculator
_Free_

- [ ] Wake at 07:00: bedtimes include 9:45 PM (6 cycles) and 11:15 PM (5 cycles); the first two are marked recommended.
- [ ] Switch to "I go to bed at" 23:00: the first suggestion is 8:15 AM (6 cycles = 9 hours, plus 15 minutes to fall asleep).
- [ ] Tap "Use the current time": the field fills with now.
- [ ] Clear the time field: the list empties without error.

### Step Counter
_Free. Needs: motion, storage_

- [ ] Open the tool, allow motion if asked, and walk 20 steps holding the phone: the count is within about 10 percent and the ring grows.
- [ ] Shake the phone gently while standing: no big jump in steps. Lay it on a table: no steps.
- [ ] Tap Pause, walk: no steps. Tap Start counting to resume.
- [ ] Change the goal to 1000: the ring and "of 1000 steps" update. Reopen the tool: today's total and the history bars are kept.
- [ ] "Reset today" asks for confirmation then zeroes the count.

### Waist-Hip Ratio
_Free_

- [ ] Female, waist 70, hip 100: ratio 0.70, "Low risk" in green.
- [ ] Male, waist 105, hip 100: ratio 1.05, "High risk" in red.
- [ ] Empty or zero fields: "--".

### Water Tracker
_Free. Needs: storage_

- [ ] Tap +250 a few times: the water rises with a smooth animation and the ml total and percentage update.
- [ ] Enter 330 as a custom amount and tap Add; tap Undo to remove the last addition.
- [ ] Reach the goal: a "Daily goal reached" toast appears and the bar turns green.
- [ ] Change the goal to 3000: level and percentage recalculate. Reopen the tool: data is kept.

### Workout Timer
_Free. Needs: storage_

- [ ] Set work 5, rest 3, rounds 2 and press Start: Get ready (amber), Work (green), Rest (red), Work, then "Done" with a beep.
- [ ] Pause then Resume: the countdown continues where it stopped.
- [ ] Reset returns to Ready and the total time shown.
- [ ] Leave during a run: no beeps continue.

## 9. Security

### 2FA Codes
_Free. Needs: storage_

- [ ] Open 2FA Codes, create a master password, tap Add account, name it and enter secret GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ: a 6 digit code appears with a countdown bar that turns red in the last 5 s and then a new code appears.
- [ ] Compare the code with a trusted authenticator app using the same secret: they match at the same moment.
- [ ] Enter an invalid secret such as "hello!": an error says it does not look valid. Paste an otpauth://totp/Example:me?secret=JBSWY3DPEHPK3PXP&issuer=Example link: issuer and secret are filled automatically.
- [ ] Tap the code: it copies. Tap the X on an account and confirm: it is removed (a warning explains you need the secret to add it again).
- [ ] Lock the tool and unlock with a wrong password: refused. Export a backup, remove an account, import the backup with the master password: the account returns.

### Checksum
_Free. Needs: storage_

- [ ] Choose a small text file and tap Calculate: a SHA-256 hash appears. Compare it with a known value from another tool.
- [ ] Paste that hash into Expected hash: the verdict reads Match. Change one character: No match in red.
- [ ] Paste a 128 character SHA-512 hash: the algorithm switches to SHA-512 automatically.
- [ ] Cancel the file picker without choosing: the Calculate button stays disabled. Choose a file over 500 MB: a warning shows and failure is reported gracefully if memory runs out.

### Emergency Card
_Free. Needs: storage_

- [ ] First open shows the edit form. Fill in a name, blood group O+, an allergy and a contact phone, then Save.
- [ ] The card shows the name in large type, a big red blood group and a Call button for the contact; tapping it opens the dialer with the number.
- [ ] Tap Edit card, clear the allergy, Save: it disappears from the card. Cancel on the edit screen returns to the card without changes.
- [ ] Close and reopen the app: the card is still there.

### File Locker
_Free (limit: 3 locked files (Pro: unlimited)). Needs: storage_

- [ ] Open File Locker. Enter a password under 8 characters: an error appears. Enter two different passwords: mismatch error. Enter a valid password twice without ticking the box: asked to confirm; tick it and tap Create: the locker opens empty.
- [ ] Tap Choose files and pick two photos and a PDF (free plan allows 3). They appear with names, sizes and image thumbnails. Pick one more file: the Pro sheet opens and the file is not added.
- [ ] Tap View on a photo: it opens in a dialog. Tap Export on a file: the share sheet (or a download in a desktop browser) offers the decrypted file. Tap Delete and confirm: it disappears.
- [ ] Tap Lock, then enter a wrong password 5 times: after the fifth, the Unlock button is disabled with a countdown of about 30 s. Wait, then enter the right password: it unlocks.
- [ ] Open Security and backup, change the password (wrong current password is rejected), then lock and unlock with the new one: all files still open and the old password is rejected.
- [ ] Unlock, send the app to the background for over 60 s and return: the locker is locked. Leave the tool and re-enter: it is locked. On a phone with biometrics: Security and backup shows "Turn on biometric unlock" (hidden if the plugin or biometrics are missing); after enabling, the Unlock screen shows a biometrics button.

### Password Check
_Free_

- [ ] Type "password": Very weak, instant crack time, problem "one of the most commonly used passwords".
- [ ] Type "P@ssw0rd2024": still weak and the year and common word are flagged.
- [ ] Paste a 16 character random mix of letters, digits and symbols: Strong or Excellent with a long crack time and no problems.
- [ ] Clear the box: the meter empties and the time and problems cards disappear. Tap the eye icon to reveal the text.
- [ ] Leave the tool and return: the field is empty (nothing is remembered).

### Password Vault
_Free (limit: 5 entries (Pro: unlimited)). Needs: storage_

- [ ] Open Password Vault, create a master password (8+ characters, confirm, tick the warning box). The empty vault opens.
- [ ] Tap Add, type a title and username, tap Generate: a 20 character password appears and the meter fills. Save. The entry shows with dots in place of the password.
- [ ] Tap Show, then Copy password: a toast says it clears in 30 s. Paste elsewhere to check it, wait 30 s with the app open and paste again: the clipboard is empty (may not clear if Android blocks background clipboard access).
- [ ] Add entries up to 5: the sixth opens the Pro sheet. Search for part of a title: the list filters.
- [ ] Security and backup > Export backup: a .pkbackup.json file is shared/downloaded. Delete an entry, choose Import backup, pick the file and enter the master password: the deleted entry returns. Enter a wrong password: a clear error and nothing changes.
- [ ] Lock and unlock with a wrong password: "Wrong password." After 5 wrong tries a 30 s lockout appears.

### PIN & Passphrase
_Free_

- [ ] Open the tool: PIN tab shows five 6 digit PINs. Move Length to 4 and 12: the PINs change length. With "Avoid easy PINs" on, none are 0000, 1234 or 4321.
- [ ] Passphrase tab: set 6 words and a space separator: four phrases of 6 words appear with about 57 bits shown. Toggle Capitalise and Add a number: the phrases update.
- [ ] Password tab: untick Symbols and Digits: only letters appear. Untick everything: lowercase letters are used so it never fails.
- [ ] Tap Generate again: new values every time. Tap Copy and paste elsewhere to check the value.

### Privacy Checklist
_Free. Needs: storage_

- [ ] Open the tool: progress shows 0 of 25 done.
- [ ] Tick three items: the count and percentage update immediately.
- [ ] Leave and reopen: the ticks are still there.
- [ ] Tap Reset checklist and confirm: all ticks clear and the progress returns to 0%. Cancel the confirm: nothing changes.

### Secret Notes
_Free. Needs: storage_

- [ ] Open Secret Notes and create a master password. Tap New, write a title and body, Save: the note appears in the list with a preview and date.
- [ ] Tap the note, edit it, Save: the list updates. Use Search to find it by a word from the body.
- [ ] Lock, then unlock with the right password: the note is still there. A wrong password shows "Wrong password."
- [ ] Delete the note and confirm: it is removed. Try saving an entirely empty new note: "Write something first."
- [ ] Export a backup, delete a note and import the backup with the master password: the note returns.

### Text Locker
_Free_

- [ ] Lock tab: type a message and a password under 8 characters: error. Use a 10+ character password and tap Lock message: a Base64 code appears. Tap Copy.
- [ ] Switch to Unlock tab, paste the code and enter the same password: the original message appears.
- [ ] Enter a wrong password: "Wrong password, or the code was changed."
- [ ] Delete one character from the middle of the code and unlock with the right password: it fails the same way. Paste random text: "not a valid locked code".
- [ ] Tap Share: the share sheet opens (or the text is copied on a desktop browser).

## 10. Create

### Paint
_Free. Needs: storage_

- [ ] Draw with a finger in two colours. Lines follow the finger.
- [ ] Tap Undo. The last stroke disappears. Tap Eraser and erase part of a line.
- [ ] Tap Save. The picture is saved or shared as an image.

## 11. Fun

### 2048
_Free_

- [ ] Swipe left/right/up/down: tiles slide and equal tiles merge, adding to Score; one new tile appears after each move.
- [ ] A swipe that changes nothing shakes the board and spawns nothing.
- [ ] Fill the board with no merges: Game over shows. New game restarts; Best remains after reopening.

### Bingo Caller
_Free_

- [ ] Tap Call next: a ball with a letter and number animates in; the matching board cell highlights.
- [ ] Never repeats a number; after 75 a message says all are called.
- [ ] Enable Read numbers aloud: the number is spoken. New game clears the board.

### Bottle Spinner
_Free_

- [ ] Choose 6 seats and tap the bottle or Spin: it turns for about 4 s.
- [ ] The bottle points at the highlighted seat and the message says Seat N.

### Coin Flip
_Free_

- [ ] Tap the coin or Flip: it spins about 1.4 s, then shows Heads! or Tails! and the tally increases by one.
- [ ] Flip 10 times: Flips counter reads 10 and Heads + Tails = 10; the bar reflects the ratio.
- [ ] Reset tally sets everything to 0 (also after reopening the tool).

### Connect Four
_Free_

- [ ] Tap any column: a red disc falls to the bottom; the phone answers with yellow.
- [ ] Make four in a row: the winning discs glow and the score updates.
- [ ] Hard level takes a moment to think; 2 Players alternates red and yellow. Fill the board: Draw.

### Dice Roller
_Free_

- [ ] Choose 3 dice and d20, tap Roll: dice tumble about 1 second, then show values 1-20 and Total equals their sum.
- [ ] Switch to d6: dice show pip faces. Tap Roll twice quickly: the second tap is ignored while rolling.
- [ ] History lists each roll; Clear empties it. Leave and reopen the tool: dice count and sides are remembered.

### Finger Chooser
_Free_

- [ ] Put two or more fingers down: coloured circles follow them and Hold still 3,2,1 counts down.
- [ ] At the end the winner enlarges and the others fade. Lift all fingers to play again.
- [ ] Changing the finger count (adding or lifting one) restarts the countdown. With one finger it asks for more.

### Flappy Tap
_Free_

- [ ] Tap the game to start; each tap lifts the bird. Passing a pipe adds 1.
- [ ] Hit a pipe or the ground: Game over; tap after half a second to retry.

### Hangman
_Free_

- [ ] Tap letters: correct ones appear in the word and the key turns green; wrong ones turn red, a body part appears and a heart is lost.
- [ ] Guess the word: You got it and Won increases. Use all 6 lives: the word is revealed in red.
- [ ] New word starts again.

### Lights Out
_Free_

- [ ] Tap a lit cell: it and its neighbours toggle, Moves increases.
- [ ] Turn all off: success message; Restart level resets the same pattern, New level generates another.

### Lucky Numbers
_Free_

- [ ] Choose 6 of 49 and tap Draw: six different numbers 1-49 appear in ascending order.
- [ ] Choose 5/50 + 2: five balls plus two stars (1-12).
- [ ] Custom: Pick 3 from 1 to 10 gives three different numbers; Pick 20 from 5 is limited to 5.

### Magic 8-Ball
_Free. Needs: motion_

- [ ] Tap the ball: it wobbles and a random answer fades into the window with a hint (good / hazy / bad).
- [ ] Shake the phone: a new answer appears (at most one per 1.5 s).
- [ ] Where shake sensor access is missing or denied, a message tells you to tap the ball; tapping still works. On iOS an Enable shake button asks for permission.

### Math Sprint
_Free_

- [ ] Tap Start and answer using the keypad: right answers advance instantly and increase Score.
- [ ] A wrong answer shakes, counts as a miss and clears your input.
- [ ] When the bar runs out Time! shows your score; Best updates per level.

### Memory Match
_Free_

- [ ] Tap two cards: matching ones stay up with a green border, others flip back after ~0.7 s.
- [ ] Timer starts at the first flip; Moves counts pairs tried.
- [ ] Clear the board: message shows moves and time and Best updates. Changing size starts a new game.

### Minesweeper
_Free_

- [ ] Tap a cell: a safe area opens and the timer starts. Numbers show neighbouring mines.
- [ ] Long-press a cell (or switch to Flag mode): a flag appears and Left decreases; again removes it.
- [ ] Tap a mine: all mines show and Boom appears. Clear all safe cells: win message and Best time.

### Number Guess
_Free_

- [ ] Enter 50 and tap Guess: message says too high or too low and the range bar narrows.
- [ ] Enter 0 or leave empty: an error shake and message, guess count unchanged.
- [ ] Guess the number: success message with tries; New number starts over.

### Reaction Timer
_Free_

- [ ] Tap to start: the pad turns red (Wait...). After 1.5-4.7 s it turns green; tap and your time in ms shows (about 200-400).
- [ ] Tap while red: Too soon! with a shake, no result recorded.
- [ ] Best and Average update after several tries; Reset records clears them.

### RPS Showdown
_Free_

- [ ] Tap a hand: both fists bounce 3 times, then reveal; the message says who won.
- [ ] Win twice in a row: Streak shows 2; a loss resets it to 0 while Best streak keeps the record.
- [ ] Reset stats clears everything.

### Scoreboard
_Free_

- [ ] Tap +1 on Player 1 three times: score 3 with a crown. Tap -1: score 2.
- [ ] Set the custom amount to 10 and tap + custom: score increases by 10. Rename a player by typing in the name field.
- [ ] Add player adds a card; the cross removes one. Reset scores zeroes all. Reopen the tool: players and scores remain.

### Simon Says
_Free_

- [ ] Tap Start: the pattern plays (watch and listen), then Your turn.
- [ ] Repeat correctly: Nice, the pattern grows by one. A wrong tap shakes and shows the round reached.
- [ ] Best updates to your highest completed round.

### Slide Puzzle
_Free_

- [ ] Tap a tile next to the empty space: it slides in. Tapping a far tile shakes it.
- [ ] Solve the puzzle: message with moves and time. Shuffle starts a new one.

### Snake
_Free_

- [ ] Tap the board to start; swipe or use the arrows to turn. Eating an apple grows the snake and adds 1.
- [ ] Pressing the opposite direction does nothing (no instant reversal).
- [ ] Hit a wall or yourself: Game over with score; tap to play again.

### Spin Wheel
_Free_

- [ ] Add options Pizza, Tacos, Sushi: chips appear and the wheel redraws. Remove one with its x.
- [ ] Tap Spin: it spins ~4 s, slows down and the pointer at the top lands on the winner, shown below the wheel.
- [ ] Enable Remove the winner after each spin: after a spin the winner vanishes from the list.
- [ ] With fewer than 2 options, Spin shows the message Add at least two options. Options persist after reopening.

### Sudoku
_Free_

- [ ] Open: Making a puzzle appears briefly, then a grid. Tap an empty cell and a number: it fills in accent colour.
- [ ] Enter a duplicate in a row: both cells turn red. Check marks entries that differ from the solution.
- [ ] Hint fills the selected (or a random) cell. Fill the grid correctly: solved message with time.

### Team Maker
_Free_

- [ ] Enter Ava, Ben, Chloe, Dev, Eli and choose 2 teams: two cards with 3 and 2 names.
- [ ] Tap Make teams again: different groupings. Fewer names than teams shows a message.

### Tic-Tac-Toe
_Free_

- [ ] In vs Phone, tap a cell: your X draws with an animation and the phone replies in under a second. Try to win: the best you can get is a draw.
- [ ] Choose I play O (second): the phone moves first automatically.
- [ ] 2 Players: taps alternate X and O; a win highlights the line and updates the score. Reset score zeroes it.

### Tower of Hanoi
_Free_

- [ ] Tap the first peg: its top disc lifts; tap another peg: it moves.
- [ ] Try placing a big disc on a small one: a message says it cannot, and the disc is dropped.
- [ ] Solve with 3 discs in 7 moves: message says perfect.

### Trivia Quiz
_Free_

- [ ] Tap an answer: right turns green with Correct, wrong turns red and shows the right answer.
- [ ] Tap Next 10 times: final score. Play again gives a new random round.

### Truth or Dare
_Free_

- [ ] Tap Truth: a blue card shows a question. Tap Dare: a red card shows a challenge.
- [ ] Tap the same button repeatedly: the same card never repeats twice in a row.

### Typing Speed
_Free. Needs: storage_

- [ ] Tap in the box and type the first words: the timer starts, correct letters turn green and mistakes turn red.
- [ ] Type the whole text before the time ends: the test ends early with a result card.
- [ ] Let the timer run out: the box locks and the result shows WPM and accuracy.
- [ ] Beat your best with at least 80% accuracy: "New personal best" shows and the best line persists after reopening.
- [ ] Switch to 60 seconds: a longer text appears and the counter resets.

### Whack-a-Mole
_Free_

- [ ] Tap Start: moles pop up randomly. Tap one: it shows a hit and Score increases.
- [ ] Moles that are not hit hide on their own; at 0 s the game ends with the final score.

### Word Scramble
_Free_

- [ ] Tap letter tiles in order: letters fill the slots; tap a slot to take a letter back.
- [ ] Spell it correctly: success message and a new word. A wrong word shakes and clears.
- [ ] Skip breaks the streak and reveals the word.

### Would You Rather
_Free_

- [ ] Tap the first option: it grows and the other fades.
- [ ] Tap Next question: two new options appear and the counter increases.

