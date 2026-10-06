## Screen Light
- id: screenlight
- category: daily
- plan: free
- needs: none
- what: Turns the whole screen into a coloured lamp. Eight presets including a warm lamp, a custom colour picker, a brightness slider and an optional keep-awake (Screen Wake Lock). Tap the screen to hide or show the controls.
- test:
  1. Open the tool: the preview shows a warm orange colour. Tap "Cool": the preview turns pale blue and the name changes.
  2. Tap "Full screen light": the whole screen fills with the colour and a control panel sits at the bottom. Tap the colour area: the panel hides; tap again: it returns.
  3. Drag the brightness slider down to 5%: the colour dims but the panel stays readable. Pick a custom colour in the picker: the screen follows.
  4. With "Keep the screen awake" on, leave the light on past the normal screen timeout: the display stays on. Tap "Close light": the screen can sleep again.
  5. Leave the tool with the back button while the light is open: the overlay disappears.

## Route Recorder
- id: routerec
- category: navigate
- plan: free with limit: 1 saved route (Pro: unlimited routes and GPX export)
- needs: location, storage
- what: Records a GPS track with watchPosition and draws it live on a canvas (auto-scaled line, green start and red end markers) with distance, duration, average and max speed. Routes are saved in IndexedDB; GPX export is Pro. Recording works in the foreground only (app open, screen on) and the screen says so; an unsaved recording is recovered if you leave the tool.
- test:
  1. Open the tool, allow location and tap Start recording: the status says it is looking for a fix, then the line and numbers update as you walk a few hundred metres outdoors.
  2. Tap Stop recording, edit the name and tap Save route: a toast confirms and the Saved routes tab lists it with distance and time.
  3. On the free plan record and save a second route: the Pro sheet opens (limit 1). With Pro the second route saves.
  4. In Saved routes tap a route: the map and stats show. Tap Export GPX: on free the Pro sheet opens; on Pro a .gpx file is shared or downloaded and opens in a GPX viewer.
  5. Delete a route: it disappears. Deny location permission: a clear message appears and nothing crashes.
  6. Start recording, leave the tool, come back: the unsaved track is offered for saving or discarding.

## My PIN Code
- id: pincode
- category: navigate
- plan: free
- needs: location, storage
- what: Shows live latitude, longitude, accuracy and altitude, the Open Location Code (Plus Code, computed on the device) and a geo: link that opens in any map app. Copy and share buttons, plus named places (Home, Parking...) with live distance and compass bearing back to each one.
- test:
  1. Open the tool outdoors: the Plus Code and coordinates fill in. Compare the Plus Code with another Plus Code source for the same spot (should match to about 14 m).
  2. Tap Copy coordinates, Copy Plus Code and Copy geo link: each shows "Copied" and pastes correctly. Tap Share: the system share sheet opens.
  3. Type "Home" (or tap the Home chip) and tap Save here. Walk 50 m away: the entry shows roughly 50 m with a direction, and the arrow turns as you rotate.
  4. Delete the place with the cross: it disappears. Saving with an empty name shows a toast.
  5. Deny location: the status explains the permission is denied.

## Parking Saver
- id: parking
- category: navigate
- plan: free
- needs: location, notifications, storage
- what: Saves the GPS spot of the parked car with an optional note and meter timer (15 min to 2 h or custom). A notification warns 5 minutes before and at expiry (scheduled with Android so it works with the app closed). Shows live distance, bearing and an arrow back to the car.
- test:
  1. Open the tool, type a note, choose 30m and tap "Save my parking spot": the screen switches to the car view with distance and a meter countdown.
  2. Walk away 100 m: the distance updates and the arrow points to the car. "Open in map app" opens the geo link.
  3. Use a custom 6 minute meter: a warning notification arrives after 1 minute and the expiry one at 6, also with the app closed and the screen off.
  4. Tap "I found my car (clear)": the saved spot and scheduled notifications are removed and the setup screen returns.
  5. Tap Save before GPS has a fix: a "Getting a GPS fix" toast appears, then it saves.

## World Clock
- id: worldclock
- category: daily
- plan: free
- needs: storage
- what: Keeps the time in cities from a built-in list of 72 IANA time zones. Shows time, date, UTC offset, the difference from your own time and a sun or moon icon. Reorder, remove, 12 or 24 hour display, saved locally.
- test:
  1. Open the tool: London, New York and Tokyo show live times with offsets such as "UTC+9".
  2. Type "Kath" in the search box, pick Kathmandu and tap Add: it shows UTC+5:45 and the correct difference from you.
  3. Use the up and down arrows to reorder; the order persists after leaving and reopening.
  4. Switch the 24-hour checkbox: all times change format. Remove a city with the cross.
  5. Add the same city twice: a toast says it is already added. A city where it is night shows the moon icon.

## Pomodoro
- id: pomodoro
- category: daily
- plan: free
- needs: notifications, storage
- what: Focus, short break and long break timers with adjustable lengths, a four-session cycle indicator, and daily and all-time session counts. Uses end timestamps so it stays accurate when the screen is off; a notification and beep fire when a period ends.
- test:
  1. Set Focus to 1 minute under "Adjust lengths", select Focus and tap Start: the display counts down and the progress bar fills.
  2. Press Pause, wait, press Resume: the remaining time resumes where it stopped.
  3. Start, lock the screen for the full minute: a notification arrives on time; on return the sessions today count has increased by one and the mode is Short break.
  4. Complete four focus sessions: the fourth is followed by a Long break and the tomatoes reset.
  5. Leave the tool mid-timer and come back: the timer continues with the correct remaining time. Reset and Skip behave as labelled.

## Alarm Clock
- id: alarmclock
- category: daily
- plan: free
- needs: notifications, storage
- what: Alarms with a time, label and weekday repeat, scheduled as Android local notifications so they ring with the app closed (in a browser they only sound while the app is open). Enable, disable and delete. The screen states the limits: it uses the notification sound and can be muted by Do Not Disturb or battery saver.
- test:
  1. Add an alarm 2 minutes ahead with no weekdays selected and the label "Test": a toast shows the time and the list shows "Once".
  2. Close the app: at the time a notification arrives with the label.
  3. Add an alarm with Mon to Fri selected: the list shows the days and the next date.
  4. Toggle an alarm off: it greys out and no notification fires. Toggle it on: it is rescheduled. Delete removes it.
  5. Deny notification permission: a message asks you to allow notifications.
  6. At most 50 alarms: adding the 51st shows a toast.

## Signal Light
- id: signallight
- category: daily
- plan: free
- needs: camera (torch, optional)
- what: Flashes the screen white and black and, when the device allows, the camera torch. Modes: SOS, your own Morse message and strobe, with a speed slider. A photosensitivity warning must be accepted before the strobe starts.
- test:
  1. Select SOS and tap Start: the screen flashes three short, three long, three short, repeated. Tap the screen: it stops.
  2. Select Morse, type "HI" and start: four short flashes, a longer pause, two short flashes, then a long gap before repeating.
  3. Move the speed slider between fastest and slowest: the flashing rate visibly changes.
  4. Select Strobe and tap Start: the warning card appears and nothing flashes until you tap "I understand, start strobe".
  5. With "Also flash the torch" on and camera permission granted, the torch follows the pattern; on a device without a torch the screen still flashes.

## To-do List
- id: todo
- category: daily
- plan: free
- needs: storage
- what: Tasks with a due date, category, done toggle, search, filter chips and a clear-completed button. Overdue tasks are highlighted. Stored locally.
- test:
  1. Add "Buy stamps" due tomorrow in category Home: it appears with "Home" and the date.
  2. Tick it: it is crossed out and moves to the bottom. The Done filter lists it.
  3. Add a task due yesterday: it shows "Overdue" in red and sorts first.
  4. Type part of a task name in Search: the list narrows.
  5. Tap Clear completed: ticked tasks disappear. Adding an empty task shows a toast.
  6. The list holds 500 tasks; when full the oldest completed task is dropped (with a toast), and open tasks are never dropped.

## Battery & Network
- id: devstatus
- category: daily
- plan: free
- needs: network, storage
- what: Live battery level with a ring, charging state and time estimates (where the Battery API exists), online or offline status, connection type, speed class, downlink and latency, plus the storage used from the Storage API.
- test:
  1. Open the tool: the battery ring shows the same percentage as the system and the right charging state.
  2. Plug in or unplug the charger: the status changes live and the time estimate updates after a moment.
  3. Turn on airplane mode: the status switches to Offline immediately; turn it off: Online returns.
  4. Switch between Wi-Fi and mobile data: connection type or speed class changes.
  5. In a browser without the Battery API the battery card says it is not available and nothing breaks.

## Quick Timers
- id: quicktimers
- category: daily
- plan: free
- needs: notifications, storage
- what: One-tap countdown presets (soft egg, hard egg, tea, coffee, pasta, plank, workout, nap) plus a custom label and minutes. Several timers can run at once; each schedules a notification so it still alerts with the screen off.
- test:
  1. Tap Soft egg: a 6:00 timer appears and counts down with a progress bar.
  2. Tap Tea as well: both run at the same time.
  3. Enter "Test" and 1 minute and press Start; at zero a beep and notification fire and the card shows Done with a Dismiss button.
  4. Cancel a running timer: it disappears and its notification does not arrive.
  5. Leave the tool and return before it ends: the timer is still running with the right time.

## Clipboard Pad
- id: clipboard
- category: daily
- plan: free
- needs: storage
- what: A scratchpad for snippets you use often: save text, copy it back with one tap, pin favourites to the top and delete. Keeps up to 50 unpinned clips on the device.
- test:
  1. Type "Hello" and tap Save clip: it appears in the list and the box clears.
  2. Tap Copy then paste into another app: the exact text arrives.
  3. Pin a clip: it moves to the top and stays there after saving more clips.
  4. Tap Paste with something on the clipboard: it fills the box (or a message explains if the system blocks it).
  5. Delete a clip with the cross. Saving an empty box shows a toast.

## Shopping List
- id: shopping
- category: daily
- plan: free
- needs: storage
- what: A shopping list with quantity steppers, quick-add chips, check-off while you shop and one tap to remove everything in the basket.
- test:
  1. Type "Apples", set quantity 3 and tap Add: it appears with 3.
  2. Tap the "+ Milk" chip twice: the quantity of Milk becomes 2 instead of a duplicate.
  3. Tick Apples: it is crossed out and moves down; the summary counts items in the basket.
  4. Press minus down to 1: it does not go lower. Tap "Remove checked items": ticked items go.
  5. Add an empty name: a toast asks you to type an item.

## Expense Tracker
- id: expenses
- category: daily
- plan: free
- needs: storage
- what: Logs spending with category, note and date. Shows the month total, a bar for each category and a six-month column chart, with month navigation and a currency symbol. Stored locally.
- test:
  1. Add 12.50 as Food and 40 as Transport: the month total shows 52.50 and two category bars appear.
  2. The "Last 6 months" chart shows a bar for the current month. Set the currency to "EUR": amounts show it.
  3. Add an expense dated last month: the view jumps to that month; use the arrows to return.
  4. Delete an entry: totals and charts update.
  5. Add with an empty or zero amount: a toast asks for an amount. The amount is limited to 0.01 to 1,000,000,000 and the list to 5000 entries.

## Tip of the Day
- id: tipday
- category: daily
- plan: free
- needs: none
- what: A short practical tip or proverb for each day from a built-in list, with next, previous, random, copy and share. Works fully offline.
- test:
  1. Open the tool: a tip is shown with "Today's pick" and the date.
  2. Tap Next and Previous: the text changes and the label shows "Tip n of 36".
  3. Close and reopen on the same day: the same tip is today's pick.
  4. Tap "Surprise me" several times: different tips appear. Copy and Share work.

## Calendar
- id: calendar
- category: daily
- plan: free
- needs: none
- what: A month grid with ISO week numbers, today highlighted, tap-a-day details (weekday, week, day of year, days from today), Monday or Sunday start, and a days-between-dates calculator.
- test:
  1. Open the tool: the current month shows with today filled in the accent colour and week numbers on the left (check one against a printed calendar).
  2. Use the arrows to go to next month and tap a day: the card shows weekday, week number, day of year and "in N days".
  3. Switch "Week starts on Monday" off: columns start on Sunday and week numbers stay correct.
  4. In Days between two dates pick 1 Jan and 31 Dec of a leap year: the result shows 365 days.
  5. Tap the month title: it jumps back to today.

## Birthdays
- id: birthdays
- category: daily
- plan: free
- needs: notifications, storage
- what: Keeps birthdays and anniversaries sorted by how soon they come, with the age being turned and a yearly 9:00 reminder scheduled through Android notifications.
- test:
  1. Add "Sam" with tomorrow's month and day and no year: Sam shows "Tomorrow".
  2. Add one with a birth year: the entry shows "turns N" with the right age.
  3. Add a birthday for today: it shows "Today!" with a party icon.
  4. Add 29 February: it is accepted and counts down correctly.
  5. Delete an entry (its reminder is cancelled). Day 32 or an empty name shows a toast.

## Multi Stopwatch
- id: multiwatch
- category: daily
- plan: free
- needs: none
- what: One clock for several runners: start it, tap a runner to record a lap, and see each runner's last lap, best lap and total. Up to 12 runners.
- test:
  1. Tap Start, then tap Lap for Runner 1 and Runner 2 at different times: each shows its own lap time and total.
  2. Tap Lap for Runner 1 again: Lap 2 appears with the new split and the best lap updates.
  3. Tap Stop then Resume: the clock continues without losing time.
  4. Add a runner called "Alex" and remove another with the cross.
  5. Tap Lap before starting: a toast says to start the clock first. Reset clears all laps.

## Moon Phase
- id: moonphase
- category: daily
- plan: free
- needs: none
- what: Draws the moon for any date with its phase name, age in days, percentage lit and the dates of the next new moon, first quarter, full moon and last quarter. Calculated on the device from the average lunar month (accurate to about half a day).
- test:
  1. Open the tool: today's phase is drawn with its name and percent illuminated.
  2. Pick a known full moon date: the moon is fully lit and named Full moon (within a day).
  3. Use the Day arrows: the lit part grows or shrinks and the age changes by one day.
  4. Tap Today to return. The next new moon date is within 29.5 days.

## Sunrise & Sunset
- id: suntimes
- category: navigate
- plan: free
- needs: location (optional)
- what: Computes sunrise, sunset, solar noon, civil dawn and dusk and day length for any latitude, longitude and date using the NOAA algorithm. Handles midnight sun and polar night. Times show in the phone's time zone.
- test:
  1. Open the tool: default London values show sunrise and sunset for today with the day length.
  2. Tap "Use my location" and allow permission: the coordinates change to yours and the times update.
  3. Enter latitude 78.2 and longitude 15.6 with a date in late June: it says 24 h of daylight; with a date in late December: polar night.
  4. Compare the times with a weather site for your city: they agree within about 2 minutes.
  5. Deny location: a message explains; the manual fields still work.

## Meeting Planner
- id: meetingplanner
- category: daily
- plan: free
- needs: storage
- what: Lines up your day against up to five cities, colouring each hour as working hours, early or late, or night, and listing the hours that fall within 9 to 17 in every place.
- test:
  1. Open the tool: rows for You, London and Tokyo show 24 coloured hour cells each.
  2. Add New York: a fourth row appears and the "Best time for everyone" list updates (it may say there is no overlap).
  3. Remove Tokyo: the list now shows a window if one exists between you, London and New York.
  4. Change the date across a daylight saving change: the hour numbers in the affected row shift by one.
  5. Add a sixth city: a toast mentions the limit of five.

## Typing Speed
- id: typingtest
- category: fun
- plan: free
- needs: storage
- what: A typing test with 30 or 60 second modes. Shows live WPM and accuracy, colours each letter right or wrong, and keeps a personal best.
- test:
  1. Tap in the box and type the first words: the timer starts, correct letters turn green and mistakes turn red.
  2. Type the whole text before the time ends: the test ends early with a result card.
  3. Let the timer run out: the box locks and the result shows WPM and accuracy.
  4. Beat your best with at least 80% accuracy: "New personal best" shows and the best line persists after reopening.
  5. Switch to 60 seconds: a longer text appears and the counter resets.
