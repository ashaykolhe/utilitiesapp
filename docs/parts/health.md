## BMI Calculator
- id: bmi
- category: health
- plan: free
- needs: storage
- what: Body mass index in metric or imperial, with the category, a colour scale with a marker and the healthy weight range for your height. Inputs are remembered.
- test:
  1. 175 cm and 70 kg: BMI 22.9, "Healthy weight", marker in the green part, range about 56.7 to 76.3 kg.
  2. Switch to Imperial, enter 5 ft 9 in and 200 lb: category Overweight.
  3. Clear the weight field: shows "--" and "Enter height and weight".
  4. Reopen the tool: last values and unit are restored.
  5. The colour bar bands match the categories: BMI 18.4 is in the narrow blue band, 18.6 in the green band, 26 in the amber band; the arrow and the 15/18.5/25/30/35/40 labels sit at the same positions.

## Step Counter
- id: steps
- category: health
- plan: free
- needs: motion, storage
- what: Counts steps with the motion sensor while the app is open, with a daily goal ring, distance and calorie estimates, and a 14 day history. It cannot count in the background and stops its sensor when you leave.
- test:
  1. Open the tool, allow motion if asked, and walk 20 steps holding the phone: the count is within about 10 percent and the ring grows.
  2. Shake the phone gently while standing: no big jump in steps. Lay it on a table: no steps.
  3. Tap Pause, walk: no steps. Tap Start counting to resume.
  4. Change the goal to 1000: the ring and "of 1000 steps" update. Reopen the tool: today's total and the history bars are kept.
  5. "Reset today" asks for confirmation then zeroes the count.
  6. Shake the phone hard for 10 seconds, then walk normally for 30 seconds: steps are still counted for the walk.

## Water Tracker
- id: water
- category: health
- plan: free
- needs: storage
- what: Track daily water with quick-add glass buttons, a custom amount, an animated water level, an adjustable goal and a 14 day bar history.
- test:
  1. Tap +250 a few times: the water rises with a smooth animation and the ml total and percentage update.
  2. Enter 330 as a custom amount and tap Add; tap Undo to remove the last addition.
  3. Reach the goal: a "Daily goal reached" toast appears and the bar turns green.
  4. Change the goal to 3000: level and percentage recalculate. Reopen the tool: data is kept.
  5. In the light theme with the glass nearly empty the "0 ml" label is dark and readable; once the water is over half full it turns white. Enter 0 or 9999 as a custom amount and tap Add: a message asks for 1 to 5000 ml.

## Calorie & BMR
- id: bmr
- category: health
- plan: free
- needs: storage
- what: Basal metabolic rate using Mifflin-St Jeor, daily maintenance calories for an activity level and a target for a weight goal, with a warning for very low targets.
- test:
  1. Male, 30, 175 cm, 75 kg: BMR 1699, Sedentary maintenance 2039.
  2. Switch to Female: BMR drops by 166.
  3. Choose "Lose 0.5 kg a week": target is 500 below maintenance; for small bodies a warning about going below 1200 or 1500 appears.
  4. Empty a field: results show "--" with no error.
  5. Enter age 5, or height 50, or weight 500: results show "--" and a message gives the allowed ranges.

## Breathing
- id: breathe
- category: health
- plan: free
- needs: none (vibration optional)
- what: Guided breathing with an animated circle for box breathing (4-4-4-4), 4-7-8, 5-5 or a custom pattern, with a session timer and optional vibration cues.
- test:
  1. Box 4-4-4-4, 1 minute, press Start: the circle grows while "Breathe in", stays during Hold, shrinks on "Breathe out"; the countdown counts each phase.
  2. Choose 4-7-8 and run: hold lasts 7 seconds, out 8.
  3. Custom with in 3, hold 0, out 6: the hold phase is skipped.
  4. Press Stop mid-session: the circle resets. Let a session finish: "Well done" and a vibration.
  5. Leave the tool while running: the timer and vibration stop.
  6. Start a session and lock the screen: the screen stays on while it runs (and where the app can, an end-of-session notification is scheduled). If neither is available a note says to keep the screen on.

## Sleep Calculator
- id: sleepcalc
- category: health
- plan: free
- needs: none
- what: Suggests bedtimes for a wake-up time, or wake-up times for a bedtime, using 90 minute cycles and 15 minutes to fall asleep.
- test:
  1. Wake at 07:00: bedtimes include 9:45 PM (6 cycles) and 11:15 PM (5 cycles); the first two are marked recommended.
  2. Switch to "I go to bed at" 23:00: the first suggestion is 8:15 AM (6 cycles = 9 hours, plus 15 minutes to fall asleep).
  3. Tap "Use the current time": the field fills with now.
  4. Clear the time field: the list empties without error.

## Health Log
- id: healthlog
- category: health
- plan: free
- needs: storage
- what: Log weight, blood pressure, blood sugar or your own named measures with a date and note, see a line chart, and export the log as text (Share sheet on Android, download elsewhere).
- test:
  1. Add weight 70, then 69.5 on another date: the chart draws two points and both appear in the list.
  2. BP tab: enter 120 and 80: the chart draws two lines (systolic and diastolic).
  3. Custom: name "Temperature", unit "C", value 36.6: it shows in the list and charts on the Custom tab while the name matches.
  4. Tap the cross on an entry and confirm: it is removed. Tap "Export as text" and "Copy text": the text contains all entries with dates.
  5. Add with an empty value: "Enter a value" toast.
  6. Try to add a weight of 0, -5 or 9999: "That value looks out of range" shows and nothing is saved.

## Heart Rate
- id: heartrate
- category: health
- plan: free
- needs: camera
- what: An approximate pulse estimate. With a fingertip on the rear camera and flash, it reads the red brightness pulses for 20 seconds, filters the signal, counts the beats and shows a live waveform. It is an estimate, not a medical device, and says so on the screen.
- test:
  1. Tap Start measuring and allow the camera. The flash turns on. Without a finger on the lens the message says to cover the camera and flash.
  2. Rest a fingertip lightly over the lens and flash and hold still: the countdown runs, a live waveform shows and a BPM appears after about 10 seconds; the final value is within about 5 to 10 BPM of a reference at rest.
  3. Lift the finger mid-measurement: the timer restarts when you cover it again.
  4. Deny the camera: "Camera permission denied." Leave the tool: the camera and flash switch off.
  5. The "Approximate, not medical" notice is always visible.
  6. Double-tap Start quickly: only one camera session starts (the camera light does not stay on after Stop). Lift your finger off for a moment mid-measurement: the measurement restarts. A resting pulse of 45 to 55 BPM is measured, not rejected.

## Body Fat
- id: bodyfat
- category: health
- plan: free
- needs: storage
- what: Estimates body fat percentage with the US Navy tape-measure method (height, neck, waist and, for women, hip) and gives a category.
- test:
  1. Male, 180 cm, neck 38, waist 85: about 16.1 percent, "Fitness" or "Average" band.
  2. Switch to Female: a hip field appears; leave it empty and the result is "--", then enter 100 and a value appears.
  3. Waist smaller than neck: result "--" with no error.

## Ideal Weight
- id: idealweight
- category: health
- plan: free
- needs: none
- what: Ideal body weight from the Devine, Robinson, Miller and Hamwi formulas plus the healthy BMI range for your height, in metric or imperial.
- test:
  1. Male, 175 cm: four formula values around 66 to 72 kg and a healthy range of about 56.7 to 76.3 kg.
  2. Switch to Imperial, 5 ft 9 in: values are shown in pounds.
  3. Height under 100 cm: "Enter a height".

## Waist-Hip Ratio
- id: whr
- category: health
- plan: free
- needs: none
- what: Waist-to-hip ratio against the WHO cut-offs (0.90 men, 0.85 women).
- test:
  1. Female, waist 70, hip 100: ratio 0.70, "At or below the WHO cut-off" in green.
  2. Male, waist 105, hip 100: ratio 1.05, "Above the WHO cut-off (increased risk)" in red.
  3. Empty or zero fields: "--".
  4. Men above 0.90 and women above 0.85 show "Above the WHO cut-off"; at or below shows "At or below the WHO cut-off". Absurd ratios (under 0.3 or over 2) show "--".

## Due Date
- id: duedate
- category: health
- plan: free
- needs: storage
- what: Estimated due date from the first day of the last period (Naegele's rule, adjustable for cycle length), with weeks and days pregnant, trimester, progress bar and days to go.
- test:
  1. Pick a last period date 10 weeks ago: the due date is 280 days after it, "10 weeks 0 days", trimester 1.
  2. Change the cycle length to 32: the due date moves 4 days later.
  3. Pick a future date: "Date is in the future".
  4. Reopen: the date is remembered.
  5. Pick a last-period date that is across a daylight saving change from today: the weeks and days count is still whole (no off-by-one day).

## Cycle Tracker
- id: period
- category: health
- plan: free
- needs: storage
- what: A private period tracker kept on the device: log start dates, it learns your cycle length, predicts the next period and shows the likely fertile window. Not suitable for contraception.
- test:
  1. Add a start date: it predicts the next period 28 days later and shows the fertile window.
  2. Add start dates 29 and 58 days ago: cycle length shows 29 d and the text says it was learned from your cycles.
  3. Delete a date with the cross: the list and prediction update.
  4. Adding the same date twice does not duplicate it.
  5. Across a daylight saving change the "in N days" and cycle day numbers stay whole and consistent.

## Fasting Timer
- id: fasting
- category: health
- plan: free
- needs: storage
- what: An intermittent fasting timer with 12, 16:8, 18:6, 20:4 and 24 hour goals, a progress ring, a phase hint and a history of past fasts. A running fast survives leaving the tool.
- test:
  1. Choose 16:8 and tap Start fast: the ring and "0h 00m" appear and the button becomes End fast.
  2. Leave and reopen the tool: the fast is still running with the elapsed time.
  3. End the fast after more than a minute: it appears in History.
  4. Change the goal during a fast: "of N hours" updates.
  5. During a fast the caption under the ring reads like "Hours 4-12 of your fast" (neutral wording, no health claims).

## Workout Timer
- id: hiit
- category: health
- plan: free
- needs: storage
- what: An interval timer for HIIT and circuits with work, rest and rounds, a 5 second get-ready, colour-coded phases, sound and vibration cues, pause and reset.
- test:
  1. Set work 5, rest 3, rounds 2 and press Start: Get ready (amber), Work (green), Rest (red), Work, then "Done" with a beep.
  2. Pause then Resume: the countdown continues where it stopped.
  3. Reset returns to Ready and the total time shown.
  4. Leave during a run: no beeps continue.
  5. Start a workout and lock the screen: the screen stays on (and in the Android app an end-of-workout notification is scheduled). Pause then Resume: the timing carries on correctly.

## Meditation
- id: meditate
- category: health
- plan: free
- needs: none
- what: A silent meditation timer with a soft synthesised bell at the start and end, optional interval bells, a progress ring and your last duration remembered.
- test:
  1. Choose 5 minutes and tap Begin: a bell sounds, the ring fills and the time counts down.
  2. Set Interval bell to Every minute: a bell sounds each minute.
  3. Type 1 as custom minutes: the display shows 1:00; Begin and wait: the end bell rings 3 times and "Session complete" shows.
  4. End session early: the ring resets.
  5. Begin a session: the screen is kept awake and, in the Android app, an end-of-session notification is scheduled; leaving the tool cancels it.

## Habit Streaks
- id: habits
- category: health
- plan: free
- needs: storage
- what: Track daily habits with a one-tap "Mark done", current and best streaks and a 7 day dot row. Everything is stored on the device.
- test:
  1. Add a habit "Read": it shows 0 days. Tap "Mark done": streak 1 and today's dot turns green.
  2. Tap again to untick: streak returns to 0.
  3. Delete a habit: a confirmation appears and the habit goes.
  4. Reopen the tool: habits and ticks are kept.

## Macro Calculator
- id: macros
- category: health
- plan: free
- needs: storage
- what: Splits a daily calorie target into grams of carbs, protein and fat using Balanced, High protein, Low carb, Keto or custom percentages, with a split bar.
- test:
  1. 2000 kcal Balanced (40/30/30): carbs 200 g, protein 150 g, fat 67 g.
  2. Choose Keto: fat rises to about 156 g and carbs falls to 25 g.
  3. Custom with 50, 30, 30: a note says the percentages add to 110 and are scaled.
  4. Empty calories: results "--".
  5. In Custom, type a negative percentage: it is treated as 0. Daily calories under 500 or over 10000 show "--".

## Eye Rest 20-20-20
- id: eyerest
- category: health
- plan: free
- needs: storage
- what: Reminds you every 20 minutes to look 20 feet away for 20 seconds, with a countdown ring, a beep and vibration, and a count of breaks taken today. Reminders work while the app is open.
- test:
  1. Set work minutes to 5, press Start: the ring counts down.
  2. When it ends a beep plays and "Look 20 feet away now" shows for 20 seconds, then work time restarts and Breaks today goes up by one.
  3. Press Stop: the timer resets. Leave the tool: nothing keeps beeping.
  4. Start the timer: the screen stays on and, in the Android app, a notification for the next break is scheduled. Old daily break counters (over 30 days) are removed automatically.

## Mood Log
- id: mood
- category: health
- plan: free
- needs: storage
- what: Record how you feel each day with a face and an optional note, and see the last 14 days as coloured bars plus a recent list. Stored on the device.
- test:
  1. Tap Save today with no face chosen: "Pick a face first".
  2. Pick a face, add a note and Save: today's bar appears and the entry shows in the list.
  3. Reopen the tool: today's face and note are pre-selected; saving again replaces today's entry.
  4. A damaged saved entry shows as "Okay" instead of breaking the page.
