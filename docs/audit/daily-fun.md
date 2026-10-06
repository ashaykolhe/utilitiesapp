# Audit findings: daily utilities, games and basics (daily.js, fun.js, timer.js, reminders.js, calculator.js, converter.js, device.js)

Source: read-only audit, October 2026.

1. HIGH signallight: begin() awaits torchOpen() with no re-entry/alive guard: double tap leaves an unremovable full-screen overlay; Back during the prompt builds it over Home. Add starting/alive flags, check after the await (close the torch if !alive), cleanup sets alive=false then end(); same for the wake-lock path.
2. calculator.js: expressions run in "use strict" so '05+3', '007', '1+08' fail; '2××3' evaluates as exponent; '50+10%' gives 50.1 (should be 55); 1e+21 results rejected afterwards. Normalise leading zeros, collapse repeated operators (never **), percent relative to the left operand after + or -, new expression when a digit follows '='.
3. alarmclock/reminders/pomodoro/quicktimers/parking/birthdays: when notification permission is denied the UI still says 'Alarm set' or shows nothing: notifyAt/schedule return success; persistent line 'Notifications are blocked: the alert only sounds while PocketKit is open'; 'Alarm set' only on success; same in reminders.js.
4. Do NOT add exact-alarm permissions (Play policy). Alarm Clock/Reminders/Timer texts say the alert can be a few minutes late when idle or on battery saver; never promise 'the exact time'.
5. timer.js: only setInterval + beep, so a locked screen gives no alert: schedule a LocalNotifications notification at the end time (fixed id e.g. 710001, requested on Start, cancelled on Pause/Reset/finish), feature-detected, keep the in-app beep.
6. routerec: recovered draft has end 0 so Save gives a hugely negative duration: restore sets end to the last point time; dur = Math.max(0, R.end - R.start).
7. routerec Save: in-flight guard (double tap saves two routes on the free plan, limit 1) or check the count inside the same readwrite transaction.
8. pincode: deviceorientationabsolute handler rebuilds the whole list on every event (taps on Copy/X lost): throttle ~150 ms, update only the arrow transform; full redraw only on place/position changes.
10. quicktimers: empty/0/negative minutes start a 0.1-minute timer: mins=+mins; if(!(mins>=1)) toast('Enter minutes') and return; cap 999.
11. g2048/flappy: touch-action:none on the whole root: only on the board/canvas; size Flappy's canvas from available height and scale by devicePixelRatio.
12. mathsprint: switching level before end() saves the unfinished score as the new level's best.
13. wheel: with 'Remove the winner' the winner is spliced by index 1.6 s later; spinning/deleting in that window removes the wrong option: keep busy until removal ran, remove by value.
14. worldclock: list rebuilt every second (taps lost), 22px buttons, narrow name column: update text nodes each second, 44px buttons, layout for 360px.
15. expenses: money() puts the currency symbol unescaped into innerHTML: esc() it.
16. keepAwake (screenlight, signallight, routerec): lock requested but off() ran meanwhile is never released: release after the await if no longer wanted; release the previous lock before replacing.
17. whackamole: hit mole stays active 120 ms (double tap scores twice); old life timeouts hide a new mole: delete on hit, token per spawn.
18. birthdays: 29 Feb in non-leap years overflows to 1 March; show age only when > 0; yearly notification for 29 Feb handled.
19. todo: cap of 500 drops the oldest OPEN task: discard oldest DONE first and warn; reminders: never beep again for overdue items already notified natively, trim done items; cap saved places (~50).
20. snake/flappy: ctx.roundRect needs WebView 99+: rect fallback.
21. typingtest: pasting ends the test and saves ~1080 WPM: block paste, require elapsed > typed.length*40 ms.
22. scramble: Skip has no guard (double tap skips twice, resets streak): if(locked) return.
23. fun.js tracker clear(t) mixes clearTimeout/clearInterval/cancelAnimationFrame on one id: Map id -> kind.
24. notification id ranges overlap (alarms 750000+n*10+k, quick timers 760000+n%900, birthdays 770000+n%9000): disjoint blocks.
25. a11y: 44px hit areas (World Clock arrows, Meeting Planner X, Alarm checkbox and day circles, Shopping +/- and Clipboard buttons, Minesweeper/Connect Four/Sudoku cells where practical, Wheel chip X, Bottle seat selector), aria-pressed on segmented buttons, real labels on Minesweeper cells, Memory cards, the Wheel canvas, and Unit Converter inputs/selects, key handlers for Would-You-Rather role=button items.
