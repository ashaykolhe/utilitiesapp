## Journal
- id: journal
- category: health
- plan: free
- needs: storage
- what: A private dated journal with title, text (up to 20000 characters), a mood emoji and tags. Entries are listed by month, searchable, editable and deletable, with a writing streak. All entries export as Markdown or plain text. Up to 2000 entries, kept on the device.
- test:
  1. Tap New entry, type a title and text, pick a mood, add tags "work, idea" and Save: the entry appears under the current month.
  2. Search for a word from the text: only matching entries stay. Search for a tag: same.
  3. Open the entry, change the text, Save: the list shows the edit. Delete it and confirm: it disappears.
  4. Tap Export Markdown: a .md file is saved or shared and contains the date, title, mood and tags.
  5. Try saving an entry with empty title and text: a message says to write something and nothing is saved.

## Gratitude Log
- id: gratitude
- category: health
- plan: free
- needs: storage
- what: Write three things you are grateful for each day. Shows the current and best streak, a "Remember this" button that shows a random older entry, and exports all entries as text.
- test:
  1. Fill in the three lines and Save: today shows as saved and the streak shows 1 day.
  2. Edit today's lines and Save again: the entry is replaced, not duplicated.
  3. With older entries present tap Remember this: a random older day is shown.
  4. Save with all three lines empty: a message asks for at least one and nothing is saved.
  5. Tap Export: a text file with dates and the three lines is saved or shared.

## Bucket List
- id: bucketlist
- category: health
- plan: free
- needs: storage
- what: A list of life goals with a category and an optional target date. Tick an item to record the day it was done, see a progress bar of how many are done, filter by category and export the list as text.
- test:
  1. Add an item "See the Northern Lights", category Travel, target date next year: it appears in the list.
  2. Tick it done: it shows today's date as done and the progress bar moves.
  3. Untick it: the done date is removed.
  4. Delete an item: it is removed after confirming.
  5. Tap Export: a text file lists done and open items.

## Mood Calendar
- id: moodcal
- category: health
- plan: free
- needs: storage
- what: A month grid coloured by the moods saved in the Mood Log tool (read only). Move between months and see the month average, best and worst day and the count per mood. It never changes the Mood Log data.
- test:
  1. Log a few moods in Mood Log, then open Mood Calendar: those days are coloured.
  2. Tap the previous month arrow: the grid changes and an empty month says there is no data.
  3. Tap a coloured day: the mood and note for that day are shown.
  4. Check the best and worst day and the counts match what was logged.
  5. With no Mood Log data the grid is plain and a hint points to Mood Log.

## Fuel Log
- id: fuellog
- category: daily
- plan: free
- needs: storage
- what: Record fill-ups with date, odometer, fuel amount, price and a full-tank flag. Works out consumption per full-to-full fill-up and the average, cost per distance, and draws a line chart. Units: km/L, L/100km, mpg (US) and mpg (UK). Exports CSV. Up to 3000 entries.
- test:
  1. Add a full-tank fill-up at 10000 km with 40 L, then another at 10500 km with 35 L: consumption shows 14.3 km/L (7.0 L/100km).
  2. Switch the unit to mpg (US): the same figures convert.
  3. Try adding an entry with an odometer lower than the previous one: a message refuses it.
  4. Add a partial fill: its consumption is not shown, and the next full fill includes the partial amounts.
  5. Tap Export CSV: a file with all entries is saved or shared.

## Vehicle Service
- id: vehicleservice
- category: daily
- plan: free
- needs: storage, notifications
- what: Keep service items (oil, tyres, insurance, pollution check...) for each vehicle with a due date or due odometer. A reminders list is sorted by urgency, items can be marked done and rescheduled, and an optional notification fires at 9:00 on each due date where the device supports it.
- test:
  1. Add a vehicle, then a service item "Oil change" due in 5 days: it shows in the list with "in 5 days".
  2. Add an item due by odometer and enter the current odometer: the remaining distance shows and urgent items rise to the top.
  3. Tap Done on an item and choose a new due date: the due date moves.
  4. Turn on notifications and allow the permission: a note says reminders are set. Deny: a message says reminders are off.
  5. Delete an item and a vehicle: they are removed after confirming.

## Trip Odometer
- id: tripodometer
- category: daily
- plan: free
- needs: location
- what: Measures a trip with GPS: distance, time, average and maximum speed, pause and resume, and laps. Keeps the screen awake while running. It works in the foreground only, so keep the app open. The last 20 trips are saved.
- test:
  1. Tap Start and allow location: the distance, time and speed begin to update outdoors.
  2. Tap Pause: the time stops. Tap Resume: it carries on.
  3. Tap Lap: a lap row appears with its distance and time.
  4. Tap Stop and save: the trip is listed under Saved trips; delete it to remove.
  5. Deny location permission: a clear message appears and nothing crashes.

## Loan Prepayment
- id: prepay
- category: calculate
- plan: free
- needs: none
- what: Shows what an extra monthly payment or a one-time lump sum does to an EMI loan: the new tenure, the interest saved and a side-by-side comparison with and without prepayment. A 0% rate is handled.
- test:
  1. Enter 1000000 principal, 9% a year, 20 years, extra 5000 a month: the new tenure is much shorter and interest saved is positive.
  2. Set extra to 0 and a lump sum of 200000 at month 24: tenure is reduced.
  3. Set rate to 0: EMI is principal divided by months and interest saved is 0.
  4. Press Save result: it appears in the history (clock button).
  5. Empty or zero principal shows a message instead of a result.

## FIRE Calculator
- id: fire
- category: calculate
- plan: free
- needs: none
- what: Estimates the years until financial independence from your savings, monthly saving, expected return, inflation and withdrawal rate, with a year-by-year table. It is an illustration, not financial advice.
- test:
  1. Use the defaults: a number of years and a target amount appear with the note "illustration, not advice".
  2. Raise the monthly saving: the years go down.
  3. Set the return equal to inflation: the result still shows without error.
  4. If the target is already reached the tool says so.
  5. Very low saving that never reaches the target within 80 years shows "not within 80 years".

## Split by Items
- id: splititems
- category: calculate
- plan: free
- needs: none
- what: Split a bill by what each person had. Add people and items, tick who shared each item, add tax and tip, which are split in proportion to what each person owes. Per-person totals add up exactly to the total to the cent. Share the result as text.
- test:
  1. Add people Asha, Ben; add Pizza 20 shared by both and Beer 6 for Ben only: Asha 10.00, Ben 16.00 before tax.
  2. Add tax 10% and tip 5%: each person's extra is proportional and the totals sum to the grand total.
  3. Add an item with no one ticked: a warning says it is unassigned.
  4. Remove a person: items shared by them are re-split.
  5. Tap Share: a text summary is shared or copied.

## Contact QR
- id: vcardqr
- category: create
- plan: free
- needs: none
- what: Makes a QR code containing a contact card (vCard 3.0) from name, phone, email, company, website and address. Scanning it on a phone offers to save the contact. Save the QR as a PNG picture.
- test:
  1. Enter a name and phone and tap Create: a QR code appears.
  2. Scan it with another phone: it offers to add the contact.
  3. Use commas, semicolons and a new line in the address: the QR still builds and scans correctly.
  4. Enter an invalid email: a message asks to fix it.
  5. Tap Save PNG: an image is shared or downloaded.

## Mind Map
- id: mindmap
- category: create
- plan: free
- needs: storage
- what: Build a mind map by tapping a node and adding children. Drag nodes, rename, colour, delete a branch, auto layout, pan and zoom. Keeps several maps and exports a PNG picture.
- test:
  1. Create a map, tap the centre node and tap Add child twice: two child nodes appear.
  2. Drag a node: it moves. Tap Auto layout: nodes arrange without overlapping.
  3. Rename a node and change its colour.
  4. Delete a branch: the node and its children are removed (the centre cannot be deleted).
  5. Drag the background to pan, pinch or use + / - to zoom. Export PNG saves a picture.

## Sticky Board
- id: stickyboard
- category: create
- plan: free
- needs: storage
- what: A board of colourful sticky notes you can drag around, edit, recolour and delete. Saved on the device, up to 100 notes.
- test:
  1. Tap Add note, type text: a yellow note appears.
  2. Drag it to a new place, reload the tool: it stays there.
  3. Change its colour and edit its text.
  4. Delete the note.
  5. Add notes until 100: a message says the board is full.

## Resume Builder
- id: resumebuilder
- category: text
- plan: free
- needs: storage
- what: Build a resume from contact, summary, experience, education and skills sections, with add and remove for entries and three clean templates. Preview it, then export a printable standalone HTML file (print it to PDF from a browser) or plain text.
- test:
  1. Fill in name, email and a summary, add one job and one school: the preview updates.
  2. Switch templates: the preview style changes.
  3. Enter text with < and & characters: they show literally in the preview and in the HTML export.
  4. Export HTML, open it and print: it is a clean page.
  5. Export text: a plain text resume is saved or shared.
