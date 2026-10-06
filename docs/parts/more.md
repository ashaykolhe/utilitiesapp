## Currency
- id: currency
- category: calculate
- plan: free
- needs: storage
- what: Converts between about 35 major currencies with no network, using a built-in table of approximate rates relative to the US dollar. The user can edit every rate, save them on the device, swap the two currencies and keep a favourites list that shows the converted amount for each. The date the rates were last edited is always shown and the tool states plainly that rates are manual. A clock button in the header keeps the results you settle on (the last 200 on the device) with a copy button.
- test:
  1. Open the tool: 100 USD to INR shows 8,350 INR and "1 USD = 83.5 INR". The note says rates are manual and shows "(built-in, approximate)" as the last edited date.
  2. Tap Swap: From becomes INR, To becomes USD and the result updates.
  3. Tap Edit rates, change INR to 90, tap Save rates: the tool returns to the converter, 100 USD now gives 9,000 INR and the edited date is today. Close and reopen the tool: the rate and date persist.
  4. In Edit rates, clear a field or enter 0 and tap Save: a message asks for a rate above 0 and nothing is saved. Reset restores built-in rates and the built-in date.
  5. Pick a To currency and tap Add to favourites: it appears in Favourites with a converted value; the X button removes it. Empty amount shows "Enter an amount" without errors.
  6. Enter -5 as Amount (refused) and 99999999999999 (limited to 1,000,000,000,000). In Edit rates a rate of 0 or above 1,000,000,000 is refused with a message.
  7. History: type an amount, wait 2 seconds: the clock button appears and lists "250 USD to INR" with the result and the rate used; copy works.

## Recipe Scaler
- id: recipescale
- category: calculate
- plan: free
- needs: storage
- what: Scales an ingredient list from the original servings to the number you want to serve. It understands amounts such as 1 1/2, 2.5, 3/4, unicode fractions and ranges like 2-3, keeps the units and prints results as kitchen fractions. Recipes can be saved and reopened from a list on the device. A clock button in the header keeps the results you settle on (the last 200 on the device) with a copy button.
- test:
  1. Open the tool with the sample recipe (serves 4). Set "I want to serve" to 8: 2 cups flour becomes 4 cups, 1 1/2 tsp becomes 3 tsp, 3/4 cup becomes 1 1/2 cup, 2.5 tbsp becomes 5 tbsp and "Pinch of salt" is unchanged.
  2. Tap Half: servings become 2 and amounts halve (3/4 cup becomes 3/8 cup).
  3. Type "2-3 cloves garlic" and "1/3 cup oil" and scale to triple: results are "6-9 cloves garlic" and "1 cup oil".
  4. Enter 0 in either servings box: the result says to enter servings above zero. Tap Save recipe with empty ingredients: a message asks for ingredients.
  5. Name the recipe and tap Save recipe, tap New, then open it from Saved recipes: name, servings and text return. The bin icon deletes it. Copy scaled copies the scaled text.
  6. Enter 0 or 5000 in a servings box: a message shows and the value is limited to the range 0.5 to 1000. At most 100 recipes can be saved.
  7. History: change the servings you want, wait 2 seconds: the clock button appears and lists the recipe with the scale factor. Copy scaled also records it.

## Holiday Calendar
- id: holidays
- category: daily
- plan: free
- needs: storage
- what: A month calendar showing fixed-date Indian holidays (Republic Day, Independence Day, Gandhi Jayanti and others), international fixed days, computed Easter, Good Friday and Easter Monday, and Mother's and Father's Day. Users can add their own dated events, optionally repeating yearly, which are saved on the device. Movable festivals such as Diwali are not computed, and the tool says so.
- test:
  1. Open the tool and go to January 2026: 26 has an amber dot and tapping it lists Republic Day under India. Go to April 2025: Good Friday shows on the 18th and Easter Sunday on the 20th (purple dots).
  2. Check Easter for several years using the arrows: 2024 is 31 March, 2026 is 5 April, 2027 is 28 March, 2028 is 16 April, 2029 is 1 April, 2030 is 21 April.
  3. Untick the India checkbox: the amber dots and entries disappear; tick it again to restore them.
  4. Add an event "Anniversary" on a chosen date with "Repeats every year" ticked: the calendar jumps to that month with a dot. Move to the same month in the next year: the event also appears. The bin button deletes it.
  5. Try Add event with an empty title or no date: a message appears and nothing is added. Close and reopen the tool: events and filter choices persist.
  6. The event date accepts 1900 to 2100 only; the month arrows stop at those years.

## Flashcards
- id: flashcards
- category: text
- plan: free
- needs: storage
- what: Create decks and cards and study them with a five-box Leitner system: a correct answer moves a card up a box (review after 1, 2, 4, 8 then 16 days) and a miss sends it back to box 1. Shows due counts, per-box stats and accuracy, and decks can be imported from or exported as plain text in the form "front :: back".
- test:
  1. Create a deck "Spanish", open it, go to Cards and add "hola" / "hello" and "adios" / "bye". Review shows "Card 1 of 2" and "0 due" turns into 2 due on the home list.
  2. Tap Show answer then Got it for both cards: "All caught up" appears. Stats shows both cards in Box 2 with 100% accuracy.
  3. Start another review, answer one card with Missed it: the card returns later in the same session and goes to Box 1 in Stats.
  4. Open the Text tab: export reads "# Spanish" followed by the cards. Paste "bonjour :: hello" in "Add cards from text" and add it: the card list grows. On the home screen, import "# French" with two lines to create a new deck.
  5. Try adding a card with an empty side or importing text without "::": a message appears, nothing breaks. Delete this deck asks for confirmation.
  6. Paste more than 50 decks, or enough cards to pass 2000 in a deck: a message says the limit and nothing is half-added. The import box takes at most 100,000 characters.

## Morse Trainer
- id: morsetrainer
- category: audio
- plan: free
- needs: none
- what: Plays a Morse code letter or digit as beeps using Web Audio and the user taps (or types) what they heard. Five levels grow from 4 letters to letters plus digits, speed is adjustable from 5 to 25 words per minute, and it tracks correct answers, accuracy and streak. The audio context is closed when leaving the tool.
- test:
  1. Open the tool and tap Play next: a short beep pattern plays and the display shows "?". Tap Repeat: the same letter plays again.
  2. Tap the correct letter: the letter shows in green with its dots and dashes, "Correct!" appears, counters update and the next letter plays after about a second.
  3. Tap a wrong letter: the display turns red and says what you answered and what it was; streak resets to 0.
  4. Change Level to level 3 or 5: the keypad grows. Move the speed slider to 25: the beeps are visibly faster. On a keyboard, typing a letter also answers.
  5. Leave the tool and come back: no sound continues after leaving. Tap letters before pressing Play: nothing happens and no error appears.

## Paint Mixer
- id: colourmix
- category: create
- plan: free
- needs: none
- what: Mixes two or three colours by ratio (parts 0 to 10) and shows the resulting HEX and RGB values. It then generates complementary, analogous, triadic, split-complementary and tetradic palettes from the mix, and any swatch can be copied. It explains that mixing is a screen-colour average and not real pigment mixing.
- test:
  1. Open the tool with red and navy at 1 : 1: the result shows a dark purple HEX and five palettes below it.
  2. Set colour 1 to #FF0000 and colour 2 to #0000FF with equal parts: result is #800080. Change parts to 3 : 1 and the result moves toward red.
  3. Set all parts to 0: the result says "Add some parts" and the palettes disappear.
  4. Type a HEX in a colour box such as #0f0 or ff8000: the colour picker updates. Typing an invalid value such as "zz" changes nothing.
  5. Tap a palette swatch or Copy HEX: "Copied" appears. Settings persist after reopening the tool.

## Pixel Art
- id: pixelart
- category: create
- plan: free
- needs: storage
- what: A pixel drawing board with a 16 by 16 or 32 by 32 grid, a 16 colour palette plus custom colour, pen, eraser, fill bucket and colour picker, plus undo and a grid toggle. Exports the artwork as a sharp, enlarged PNG (512 pixels wide) and automatically keeps the current drawing on the device.
- test:
  1. Draw with the pen by dragging a finger: continuous lines appear with no gaps even on fast strokes. Pick another palette colour and draw again.
  2. Choose Fill and tap an empty area: the whole connected empty area fills. Tap Undo: the fill is reverted. Tap Undo with nothing left: "Nothing to undo" appears.
  3. Choose Erase and drag over pixels: they clear back to the checkerboard. Choose Pick and tap a coloured pixel: that colour becomes the current colour and the tool returns to Pen.
  4. Tap Size: with a drawing present it asks for confirmation, then switches to a 32x32 grid. Toggle Grid off: grid lines disappear.
  5. Tap Export PNG: a file (or the Android share sheet) is produced; open it and check it is crisp, not blurred. Leave and reopen the tool: the drawing is still there.

## Signature Pad
- id: signature
- category: create
- plan: free
- needs: none
- what: A smooth finger or mouse drawing pad for signing, with four ink colours and adjustable pen thickness. It exports the signature as a transparent PNG tightly cropped to the ink, ready to place on documents, and saves or shares it through the system share sheet.
- test:
  1. Draw a signature: strokes are smooth and follow the finger. Change the thickness and colour and draw again: the new strokes use the new settings.
  2. Tap Undo: the last stroke disappears. Tap Clear: everything is erased.
  3. Draw a signature and tap Save / share PNG: the saved PNG has a transparent background (open it over a coloured background) and has only a small margin around the ink.
  4. With an empty pad tap Save / share PNG: the message "Sign first" appears and no file is produced.
  5. Tap once without dragging: a dot is drawn and saved correctly.

## Meeting Cost
- id: meetingcost
- category: daily
- plan: free
- needs: none
- what: A running clock that shows what a meeting costs in money, from the number of people and their average hourly rate, with a currency symbol of your choice. It also shows the cost per minute and per hour. Changing people or rate mid-meeting only affects time from then on, so money already spent is never rewritten.
- test:
  1. Set 6 people, rate 25, symbol $. Per minute reads $2.50 and per hour $150.00. Tap Start: the cost and the clock rise; after about 60 seconds the cost is about $2.50.
  2. Tap Pause: the cost freezes. Tap Resume: it continues from where it stopped.
  3. While running, change people to 12: the cost per minute doubles and the cost goes up faster, but the amount already spent does not jump.
  4. Tap Reset: cost and clock return to zero. Enter 0 or empty people: it is treated as at least 1 person and no error appears. Change the symbol to a rupee sign: the displays use it.
  5. Leave the tool while running: no timer keeps running. Reopen: people, rate and symbol are remembered.
  6. Enter 99999999 as the hourly rate: it is limited to 1,000,000. People above 1000 is limited to 1000.

## Life Calendar
- id: lifecal
- category: daily
- plan: free
- needs: storage
- what: Shows a lifetime as a grid of weeks, one row per year of 52 weeks, from the birth date to an expected lifespan (default 80 years). Weeks already lived are filled, this week is outlined, and the stats show weeks lived, weeks left, percentage and days lived. The birth date and expected years are saved on the device.
- test:
  1. Enter a birth date of 1 Jan 1995: the grid appears with filled squares for the weeks lived, one row per year, with year labels at 10, 20 and so on; the numbers show weeks lived, weeks left and a percentage of 80 years.
  2. Change Expected years to 90: the grid gets 10 more rows and the percentage drops.
  3. Enter a birth date in the future or leave it empty: a message asks for a valid birth date in the past and the grid is hidden.
  4. Enter an expected age younger than your age (for example 20 for someone aged 30): the grid is full, weeks left shows 0 and the percentage shows 100%.
  5. Close and reopen: date and lifespan are remembered. Check both light and dark themes keep the grid readable.
  6. The birth date picker stops at today and at 1900. Expected years 500 is limited to 120.

## Word Finder
- id: anagram
- category: text
- plan: free
- needs: none
- what: An offline word helper with a built-in list of about 3,900 common English words. It finds anagrams of a word, words that can be made from a set of letters (use ? for a blank tile, minimum length adjustable), and words matching a pattern where ? is one letter and * is any run of letters. Results are grouped by length.
- test:
  1. Anagrams tab: type "listen": "silent" is found (the word itself is not listed).
  2. From letters tab: type "tac": "cat", "act" and "at" appear, grouped by length. Raise the minimum length to 3: "at" disappears. Type "ca?": words such as "car" and "can" appear.
  3. Pattern tab: "c?t" lists cat, cut, cot and not "cart". "un*ing" lists only words that start with un and end with ing. "?o?se" lists house and horse.
  4. Type nothing or only symbols: the result area is empty or says no words found, with no error.
  5. Switch tabs: the input clears and the mode is remembered when you reopen the tool.

## Number Patterns
- id: sequences
- category: calculate
- plan: free
- needs: none
- what: Four visual explorers for number sequences. Fibonacci lists up to 150 terms (exact, using big integers) and shows how the ratio approaches the golden ratio. Primes shows a sieve grid up to 1000 with a count, and a factoriser for numbers up to about 10^12. Triangular numbers show a bar chart. Collatz shows the path, step count and highest value for any start up to a billion.
- test:
  1. Fibonacci with 20 terms: the list starts 0, 1, 1, 2, 3, 5 and ends 4181; the ratio reads about 1.618033. Set 101 terms: F(100) is 354224848179261915075.
  2. Primes up to 100: 25 primes are highlighted (2, 3, 5, 7, 11 and so on). Factorise 360: result is 2 cubed x 3 squared x 5. Factorise 97: result says it is prime. Enter 1: a message asks for 2 or more.
  3. Triangular with 6 terms shows 1, 3, 6, 10, 15, 21 and a growing bar chart.
  4. Collatz with 27: 111 steps and highest value 9,232. Collatz with 1: 0 steps. Enter 0 or empty: it falls back to a valid default without errors.
  5. Out of range numbers (for example 5000 terms) are clamped to the allowed maximum.

## Matrix Calc
- id: matrix
- category: calculate
- plan: free
- needs: none
- what: Matrix calculator for matrices up to 4 by 4: add, subtract and multiply (A times B or B times A), determinant, inverse and transpose. Cells accept integers, decimals and fractions like 1/2, results are tidied to fractions where possible, and clear messages explain size mismatches and singular matrices.
- test:
  1. Default A = [[2,1],[5,3]], B = identity. Tap A x B: result equals A. Tap det(A): result is 1. Tap A inverse: result is [[3,-1],[-5,2]].
  2. Set B to [[1,2],[3,4]] and tap A x B: result is [[5,8],[14,22]]. A + B is [[3,3],[8,7]] and A - B is [[1,-1],[2,-1]].
  3. Set A to 2 rows by 3 columns and B to 2 by 2 and tap A x B: the message says A has 3 columns but B has 2 rows. Tap det(A): the message says a square matrix is needed.
  4. Set A to [[1,2],[2,4]] and tap A inverse: the message says it is singular. det(A) is 0 with a note.
  5. Enter 1/2 and 1/3 into cells and tap Transpose: values stay exact. Enter "abc": an error line asks for numbers and nothing crashes. Test a 4x4 matrix with the inverse and multiply it back mentally or with A x B.
  6. Type 20 characters in a cell: only 12 are kept. Type abc: the result says some cells are not numbers.

## Trig Circle
- id: trig
- category: calculate
- plan: free
- needs: none
- what: An interactive unit circle with a draggable point. For any angle it shows sine, cosine and tangent, the angle in radians (and as a multiple of pi for common angles) and exact values such as sqrt(3)/2 for multiples of 30 and 45 degrees. A table of exact values for the common angles lets you tap a row to jump to it.
- test:
  1. Open the tool (30 degrees): sin 0.5, cos 0.866, tan 0.5774, and the exact line reads sin = 1/2, cos = sqrt3/2, tan = sqrt3/3.
  2. Drag the point around the circle: the angle, values and coloured sine and cosine lines update continuously. At 90 degrees tan shows "undefined".
  3. Move the slider to 150: exact values show the negative cosine; radians show 5pi/6. Slide to 360: radians show 2pi.
  4. Type 405 into Degrees: the point sits at 45 degrees. Type -30: it sits at 330 degrees. Typing non-numbers does nothing.
  5. Tap a row in the exact values table (for example 225): the circle jumps there and sin and cos read -sqrt2/2.
  6. Enter 9999999 in Degrees: a message shows and the value is limited to 100000. Choose a non-image or very large (over 40 MB) picture in the picture tools: a message says why it was refused.

## Periodic Table
- id: periodic
- category: text
- plan: free
- needs: none
- what: All 118 elements in a colour-coded periodic table (alkali metals, noble gases, lanthanides and more) with atomic number, symbol, name and atomic mass. A searchable list and a detail card show group, period, category and state at room temperature, and tapping a category chip highlights that family.
- test:
  1. Open the tool: Carbon is selected and its detail card shows number 6, mass 12.011, Group 14, Period 2, Nonmetal, Solid.
  2. Type "gold" in search: Au appears; tap it and the card shows number 79, mass 196.97. Search "Fe" and "26": iron is found. Search "xyz": "No match" appears.
  3. Swipe the table sideways: the full 18 column layout is reachable; the two bottom rows are lanthanides and actinides. Count that the table has elements up to Og (118).
  4. Tap the "Noble gas" chip: only He, Ne, Ar, Kr, Xe, Rn and Og stay bright; tap it again to clear.
  5. Tap Hg: state shows Liquid. Tap U (actinide): period shows 7 and no group number.

## Country Codes
- id: countrycodes
- category: text
- plan: free
- needs: none
- what: A searchable offline list of about 110 countries showing flag, phone dial code, ISO 2 and 3 letter codes and currency code. Search matches the country name, ISO codes, currency code or dial code (with or without a plus sign), and tapping a country copies its dial code.
- test:
  1. Open the tool: a list of countries with flags is shown with a count such as "109 of 109 countries".
  2. Search "india": India with +91, IN, IND, INR. Search "+44": United Kingdom. Search "jp": Japan.
  3. Search "EUR": many eurozone countries are listed. Search "+1": the US, Canada and others sharing the code.
  4. Search "zzz": "No match" appears. Clear the box: the full list returns.
  5. Tap a country: "Copied" appears and pasting elsewhere gives its dial code such as +91.

## Colour Blind Sim
- id: cbsim
- category: camera
- plan: free
- needs: storage
- what: Choose a photo and see it next to a simulation of protanopia, deuteranopia, tritanopia or total colour blindness, calculated on the device with published colour-vision matrices applied in linear RGB. The simulated image can be saved as a PNG.
- test:
  1. Open the tool and tap Choose a photo, pick a colourful photo: the normal and simulated versions appear stacked.
  2. Switch the type between Deuteranopia, Protanopia, Tritanopia and Achromatopsia: the lower image changes each time and the description updates. Achromatopsia is grey-scale.
  3. Use a photo with strong reds and greens (for example a traffic light): in protanopia and deuteranopia the red and green look much closer.
  4. Tap Save simulated image: a PNG is saved or shared.
  5. Cancel the picker without choosing a photo, or choose a non-image file: nothing breaks and an error message appears only for a bad file.

## ASCII Art
- id: asciiart
- category: create
- plan: free
- needs: none
- what: Converts any chosen photo into text art made of characters. The width (20 to 140 characters), character set (classic, detailed, simple, blocks) and an invert switch can be changed, with the result copied to the clipboard or saved as a text file.
- test:
  1. Tap Choose a photo and pick a high-contrast picture: a text rendering appears and the placeholder disappears.
  2. Move the width slider: the art gets coarser or finer and keeps the right proportions. Change the character set: the look changes.
  3. Tick Invert: dark and light characters swap, which helps on dark backgrounds.
  4. Tap Copy text and paste it into the Notes tool: the lines are intact. Tap Save .txt: a file is saved or shared.
  5. Tap Copy text before choosing a photo: "Pick a picture first" appears.

## Silly Names
- id: namegen
- category: fun
- plan: free
- needs: storage
- what: Generates silly nicknames, funny full names, team names and short story starters from built-in word lists. Results can be copied, and favourites are kept on the device.
- test:
  1. Open the tool: eight nicknames such as "Grumpy Walrus" are listed. Tap Generate: a fresh list appears.
  2. Switch to Silly names, Team names ("The ... Rockets") and Story starters: each shows the right kind of result, with story starters being a short sentence.
  3. Tap the star on a result: it is added to Favourites. Close and reopen the tool: favourites persist. The cross button removes one.
  4. Tap the copy button on a result: "Copied" appears.
  5. Tap Generate many times quickly: results never repeat within one list and no error occurs.

## Image Palette
- id: imgpalette
- category: camera
- plan: free
- needs: storage
- what: Pick a photo and extract its dominant colours (default six, adjustable from 2 to 10) using median cut with k-means refinement. Shows a strip with each colour in proportion, then a list with HEX, RGB and share, and lets you copy one colour, all HEX codes or a CSS variable block.
- test:
  1. Tap Choose a photo and pick a photo with a clear main colour such as a blue sky: six swatches appear with HEX codes and percentages adding up to about 100.
  2. Move the slider to 3: three larger colour groups are shown. Move to 10: more detailed colours appear.
  3. Tap a colour row: "Copied" appears and the HEX can be pasted elsewhere.
  4. Tap Copy as CSS: pasting gives a :root block with --color-1 and onwards.
  5. Choose a plain single-colour image: only one colour (or a few very similar ones) is listed and nothing breaks. Cancel the picker: no error.
