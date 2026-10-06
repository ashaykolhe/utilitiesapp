## Morse Code
- id: morse
- category: text
- plan: free
- needs: none
- what: Translates text to Morse code and Morse back to text (letters, digits and common punctuation). The Morse can be played as beeps and phone vibration at a speed of 5 to 30 words per minute.
- test:
  1. Choose "Text to Morse", type `SOS`. Output is `... --- ...`.
  2. Type `Hello World`. Output is `.... . .-.. .-.. --- / .-- --- .-. .-.. -..` (words separated by `/`).
  3. Switch to "Morse to text" (the output moves into the input). Output reads back `HELLO WORLD`. Type `...... ` and the result is `?`.
  4. Tap Play: you hear beeps matching the dots and dashes and the phone vibrates. Move the speed slider and play again: faster or slower. Tap Stop mid-play: sound and vibration stop at once.
  5. Untick Sound and Vibrate, tap Play: nothing plays and nothing crashes. Leave the tool while playing: sound stops.

## QR & Barcode
- id: qr
- category: text
- plan: free
- needs: none
- what: Makes QR codes from text, web links, Wi-Fi details, phone numbers, email and SMS templates, plus Code 128 and EAN-13 barcodes drawn on a canvas. The picture can be saved as a PNG or shared.
- test:
  1. Type: Text, enter `hello`. A QR code appears. Scan it with another phone: it reads `hello`.
  2. Type: Wi-Fi, enter a network name and password, security WPA. Scan with a phone camera: it offers to join that network. A name containing `;` or `:` still works.
  3. Type: Barcode EAN-13, enter `400638133393` (12 digits): the barcode shows `4 006381 333931` (check digit added). Enter `4006381333930`: an error says the check digit should be 1.
  4. Type: Barcode Code 128, enter `Hello 123`: barcode appears with the text underneath. Enter `héllo`: a message says only plain keyboard characters are supported.
  5. Enter 3000+ characters in Text: a "too much data" message shows, no crash. Tap Save PNG and Share: on Android the share sheet opens with the image; in a desktop browser a PNG downloads.

## Notes
- id: notes
- category: text
- plan: free with limit: 10 notes (unlimited with Pro)
- needs: storage
- what: Quick notes with a title and body. Search, pin notes to the top, copy or delete. Everything is saved on the device as you type.
- test:
  1. Tap New, type a title and body, tap Done. The note appears in the list. Close and reopen the app: it is still there.
  2. Create a second note and pin it, then pin the first: pinned notes (with 📌) sort above others; newest edited first within each group.
  3. Type part of a word in Search: the list filters. Search for something absent: "No matches".
  4. Tap New and then Done without typing: the empty note is discarded.
  5. Tap Delete once: the button says "Tap again to delete". Tap again: note is removed. As a free user, create notes up to 10, then tap New for the 11th: the Pro sheet opens and no note is added.

## Base64 & URL
- id: b64
- category: text
- plan: free
- needs: none
- what: Encodes and decodes Base64 (standard and URL-safe) and URL percent-encoding. It is UTF-8 safe, so accents, emoji and non-Latin scripts round-trip correctly.
- test:
  1. Mode "Base64 encode", input `Hello, World!`. Output is `SGVsbG8sIFdvcmxkIQ==`.
  2. Tap Swap: the mode changes to decode and the input becomes the Base64; output is `Hello, World!`.
  3. Encode `héllo € 😀 日本語`, Swap: you get the exact original text back.
  4. Decode `@@@`: a red message "Not valid Base64." appears and the output is empty. Decode `SGk` (no padding): `Hi`.
  5. "URL encode" `a b&c=d/é` gives `a%20b%26c%3Dd%2F%C3%A9`; "URL decode" `%E0%A4%A` shows an error message.

## Text Tools
- id: texttools
- category: text
- plan: free
- needs: none
- what: Live counts of words, characters, characters without spaces, sentences, lines and paragraphs, plus one-tap UPPER, lower, Title and Sentence case, reverse, space clean-up, dedupe lines, sort lines and remove blank lines, with Undo and Copy.
- test:
  1. Type `Hello big world. How are you?` The counts show 6 words, 2 sentences, 1 line.
  2. Tap UPPER, then lower, then Title Case: the text changes each time. Tap Undo three times to return to the original.
  3. Paste lines `b`, `a`, `b`, `c` and tap Dedupe lines, then Sort Z-A: result is `c`, `b`, `a`.
  4. Tap Fix spaces on `a    b` (several spaces): result is `a b`. Tap Reverse on text containing an emoji: the emoji stays intact.
  5. Tap Copy with empty text: nothing happens. Paste 100,000 characters: the counts update without freezing.

## Password Maker
- id: password
- category: text
- plan: free
- needs: none
- what: Creates random passwords of 4 to 64 characters using the secure random generator. Choose upper case, lower case, digits and symbols, optionally avoid look-alike characters, see a strength meter and copy.
- test:
  1. Open the tool: a 16 character password is shown with a strength bar. Tap Generate: a different password appears.
  2. Drag the length slider to 4 and then 64: the password length follows, and the strength label changes (Very weak up to Excellent).
  3. Untick everything except digits: the password is digits only. Untick the last option as well: it shows "Pick at least one option".
  4. Tick "Avoid look-alikes": generate several times and confirm no `I`, `l`, `1`, `O`, `0`, `o`.
  5. Tap Copy and paste elsewhere: the same password. Close and reopen the tool: your options are remembered.

## Roman Numerals
- id: roman
- category: text
- plan: free
- needs: none
- what: Converts whole numbers from 1 to 3999 to Roman numerals and Roman numerals back to numbers, in one box that detects which way to convert.
- test:
  1. Type `1994`: result `MCMXCIV`. Type `3999`: `MMMCMXCIX`.
  2. Type `mcmxciv` (lower case): result `1994`.
  3. Type `0` or `4000`: the result is `—` with a range message.
  4. Type `IIII` or `VX`: "Not a valid Roman numeral".
  5. Tap Copy result: the converted value is copied.

## Number Bases
- id: bases
- category: text
- plan: free
- needs: none
- what: Converts whole numbers between binary, octal, decimal and hex and any other base from 2 to 36, using big integers so very long numbers stay exact. Negative numbers work.
- test:
  1. From base 10, type `255`: binary `11111111`, octal `377`, decimal `255`, hex `FF`.
  2. Choose From base 16, type `ff` or `0xFF`: same results.
  3. Type `123456789012345678901234567890` in base 10: the hex result is exact, and converting that hex back gives the same decimal.
  4. Choose binary and type `12`: a message says it is not a valid base-2 number.
  5. Choose "Other..." and set the custom base to 36, type `zz`: decimal `1295`. Tap a Copy button to copy a row.

## JSON Tool
- id: json
- category: text
- plan: free
- needs: none
- what: Pretty-prints (2 spaces, 4 spaces or tab), minifies and validates JSON. Errors show the line and column with a pointer, and the cursor jumps to the problem.
- test:
  1. Paste `{"a":1,"b":[1,2]}`, tap Pretty: it becomes indented. Tap Minify: back to one line. Status shows "Valid JSON".
  2. Paste `{"a": 1,}` and tap Validate: red message with line 1 and the column of the stray `}`.
  3. Paste a multi-line object with a missing value on line 3: message says line 3 and the column, with a caret under it.
  4. Paste `[1, 2` (incomplete): "Unexpected end of text".
  5. Pretty with Tab indent uses tab characters. Tap Clear: box and status are emptied. Note: numbers larger than 15 digits may lose precision when pretty-printing.

## Hash Maker
- id: hash
- category: text
- plan: free
- needs: none
- what: Computes SHA-1, SHA-256, SHA-384 and SHA-512 hashes of typed text or a chosen file, all on the device, and compares the result against a hash you paste.
- test:
  1. Type `abc`: SHA-256 is `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`. SHA-1 starts `a9993e36`.
  2. Clear the text: the hashes are those of an empty string (SHA-256 starts `e3b0c442`).
  3. Paste the SHA-256 above into "Compare": "Match: SHA-256" in green. Change one character: "No match" in red.
  4. Choose a small file: its hashes appear and match what another tool reports. Typing in the text box afterwards switches back to text.
  5. Tap Copy next to a hash and paste it elsewhere.

## Colour Convert
- id: colour
- category: text
- plan: free
- needs: none
- what: Converts colours between HEX, RGB and HSL with a native colour picker and a large live swatch. Shows ready-to-copy CSS values.
- test:
  1. Type `#FF8000` in HEX: RGB becomes 255, 128, 0 and HSL 30, 100, 50. The swatch turns orange.
  2. Type the short form `f80`: it is accepted and expanded.
  3. Change the R field to 0: HEX and HSL update. Change the H field to 240: the colour becomes blue-ish and the other fields follow.
  4. Tap the picker, choose a colour: all fields update. The swatch text switches between black and white for readability.
  5. Tap Copy on the `rgb(...)` line and paste elsewhere.

## Lorem Ipsum
- id: lorem
- category: text
- plan: free
- needs: none
- what: Generates placeholder text as paragraphs, sentences or words (1 to 100), optionally starting with the classic "Lorem ipsum dolor sit amet".
- test:
  1. Choose Paragraphs, 3, tap Generate: three paragraphs separated by blank lines, starting with "Lorem ipsum dolor sit amet".
  2. Untick the classic start and Generate: starts differently.
  3. Choose Words, 5: exactly 5 words. Type 500 in the count: it is limited to 100.
  4. Tap Copy and paste elsewhere.

## Binary & Hex
- id: bytes
- category: text
- plan: free
- needs: none
- what: Converts text to binary, hex, decimal or octal byte values and back using UTF-8, so accents and emoji work.
- test:
  1. "Text to binary", `Hi`: `01001000 01101001`. "Text to hex": `48 69`. "Text to decimal": `72 105`.
  2. Tap Swap after "Text to hex": mode flips to "Hex to text" and the output returns `Hi`.
  3. "Hex to text" with `4869` (no spaces) and `0x48 0x69`: both give `Hi`.
  4. Round trip `héllo €😀` through each format: identical text.
  5. "Binary to text" with `12`: an error message appears. "Decimal to text" with `300`: "bigger than one byte".

## Emoji & Symbols
- id: symbols
- category: text
- plan: free
- needs: none
- what: A keyboard of emoji and special characters (arrows, maths, currency, Greek, punctuation, shapes, box drawing, super and subscripts) with search. Tap characters to build text and copy it.
- test:
  1. Open the tool: Smileys shown. Tap three emoji: they appear in the text box at the top.
  2. Choose Currency from the group list: euro, pound, rupee and other symbols appear.
  3. Search `heart`: matching emoji appear across groups. Search `arrow`: arrows appear. Search nonsense: "Nothing found".
  4. Tap Copy and paste in another app: the characters appear. Tap Clear: the box is emptied.

## Fancy Text
- id: fancy
- category: text
- plan: free
- needs: none
- what: Restyles your text into many Unicode looks (bold, italic, script, gothic, double-struck, monospace, circled, squared, fullwidth, small caps, upside down, strikethrough, underline) that can be pasted anywhere.
- test:
  1. Default text `Hello World` is shown in about 18 styles.
  2. Type `Test 123`: every style updates, digits included where the style has digits.
  3. Tap Copy on "Bold" and paste into a chat: bold-looking text appears.
  4. "Upside down" reverses and flips the text; clearing the box falls back to `Hello World`.

## Text Diff
- id: diff
- category: text
- plan: free
- needs: none
- what: Compares two texts and highlights what was added (green) and removed (red, struck through), by line, word or character.
- test:
  1. Original `a`, `b`, `c` on three lines and Changed `a`, `c`, `d`: by line, `b` shows red and `d` green; summary says "1 added, 1 removed".
  2. Make both identical: "No differences".
  3. Switch to word mode with `the quick fox` vs `the slow fox`: `quick` red, `slow` green.
  4. Paste two very large texts (thousands of lines each): a message says they are too long, and nothing freezes.

## Regex & Replace
- id: regex
- category: text
- plan: free
- needs: none
- what: Tests regular expressions against sample text with highlighted matches, match positions and capture groups, and does find and replace with $1 style groups.
- test:
  1. Pattern `(\d+)-(\w)` flags `g`, text `a 12-x b 7-y`: 2 matches highlighted; list shows group 1 and 2 values.
  2. Replace with `$2$1`: result `a x12 b y7`.
  3. Pattern `(` shows the browser's error message in red and no crash.
  4. Flags `gi` with pattern `HELLO` matches `hello`. Pattern `a*` (can match empty) does not hang.
  5. Tap Copy result.

## Case & Slug
- id: cases
- category: text
- plan: free
- needs: none
- what: Converts text into URL slug, camelCase, PascalCase, snake_case, kebab-case, CONSTANT_CASE or dot.case, line by line. Accents are removed for slugs.
- test:
  1. "URL slug" with `Crème Brûlée & Co.!` gives `creme-brulee-co`.
  2. "camelCase" with `hello big world` gives `helloBigWorld`; "PascalCase" gives `HelloBigWorld`.
  3. "snake_case" with `HTTPServer error` gives `http_server_error`.
  4. Two lines of input produce two lines of output. Empty input gives empty output.

## Number Sorter
- id: numsort
- category: text
- plan: free
- needs: none
- what: Sorts a pasted list of numbers (separated by spaces, commas or lines), optionally removes duplicates, and shows count, sum, average, median, smallest and largest.
- test:
  1. Enter `5, 3, 9, 3, 1`: sorted `1, 3, 3, 5, 9`; count 5, sum 21, average 4.2, median 3.
  2. Tick "Remove duplicates": `1, 3, 5, 9`.
  3. Choose "Largest first": order reverses.
  4. Enter text with no numbers: "No numbers yet". Enter `-2.5 1e2`: both parsed.

## CSV Viewer
- id: csv
- category: text
- plan: free
- needs: none
- what: Shows pasted CSV (comma, semicolon, tab or pipe, auto-detected) as a scrollable table or converts it to JSON. Handles quoted fields, embedded commas and line breaks.
- test:
  1. Paste `name,age` / `Ada,36` / `Lin,29`: a table with header and 2 rows; "3 rows, 2 columns".
  2. Switch the view to JSON: array of objects `{"name":"Ada","age":"36"}`. Untick header: array of arrays.
  3. Paste `a,"x,y"` : the quoted comma stays in one cell. Paste a semicolon-separated file: auto separator handles it.
  4. Tap Copy JSON and paste elsewhere. Empty input shows nothing.

## Markdown View
- id: markdown
- category: text
- plan: free
- needs: none
- what: Live preview of Markdown: headings, bold, italic, strike, inline and fenced code, lists, quotes, rules and links. All text is HTML-escaped and unsafe link types are not made clickable.
- test:
  1. Type `# Title` then a blank line and `Some **bold** and *italic*`: heading and styled text appear in the preview.
  2. Add `- a` / `- b` lines and `1. x` / `2. y` lines: bullet and numbered lists render.
  3. Type `<script>alert(1)</script>`: shown as plain text, nothing runs.
  4. Type `[bad](javascript:alert(1))`: not a link. `[ok](https://example.com)` is a link and tapping it does not navigate away.
  5. Tap Copy HTML: the generated HTML is copied.

## Checklist
- id: checklist
- category: text
- plan: free
- needs: storage
- what: A simple to-do or shopping list with tick boxes, a progress bar and Clear ticked, saved on the device (up to 300 items).
- test:
  1. Type `Milk` and tap Add (or press Enter): it appears; "0 of 1 done".
  2. Add more, tick one: it is struck through; progress bar and "1 of 3 done" update.
  3. Close and reopen the app: items and ticks are kept.
  4. Tap ✕ on an item: removed. Tap "Clear ticked items": ticked ones disappear.
  5. Adding empty text does nothing.

## Word Frequency
- id: freq
- category: text
- plan: free
- needs: none
- what: Counts how often each word appears, ranks the top 40 with bars, and can skip common words like "the" and "and". Copy the list as tab-separated text.
- test:
  1. Paste `the cat and the dog and the bird`: with "Skip common words" off, `the` is first with 3; on, it shows cat, bird, dog with 1 each.
  2. The summary shows total and different word counts.
  3. Empty text shows an empty list. Words in other languages (accents, non-Latin) are counted.
  4. Tap Copy list: `word<TAB>count` lines are copied.

## Reading Time
- id: readtime
- category: text
- plan: free
- needs: none
- what: Estimates silent reading time (150, 200 or 300 words per minute) and speaking time (130 words per minute) for pasted text.
- test:
  1. Paste 400 words with Average speed: reading about 2 min 0 sec, speaking about 3 min 5 sec.
  2. Switch to Fast: reading time drops to about 1 min 20 sec.
  3. Empty text shows 0 sec and "0 words".

## SMS Counter
- id: smscount
- category: text
- plan: free
- needs: none
- what: Shows how many SMS parts a message needs (GSM-7: 160 or 153 per part; Unicode: 70 or 67 per part) and how long it is as a tweet out of 280, with links counted as 23.
- test:
  1. Type 160 letters: 1 part, 0 left. Add one more: 2 parts.
  2. Type `€`: counts as 2 units. Type an emoji or `日本語`: switches to Unicode (70 per part).
  3. Type text with a `https://...` link: tweet count adds 23 for the link.
  4. Go above 280: tweet counter and bar turn red.

## Caesar Cipher
- id: caesar
- category: text
- plan: free
- needs: none
- what: Encodes and decodes the Caesar cipher with a shift of 1 to 25, a ROT13 shortcut, and a list of all 25 shifts for cracking a message.
- test:
  1. Encode `Hello, World!` with shift 3: `Khoor, Zruog!`. Paste that result into the input and switch to Decode with shift 3: `Hello, World!`.
  2. Tap ROT13 and enter `Hello`: `Uryyb`. Apply again via Decode: `Hello`.
  3. Enter `Khoor` and tap "All 25 shifts": 25 rows appear, and row 23 reads `Hello`. Tap the button again to hide the list.
  4. Digits, punctuation and accented letters are left unchanged.

## Pig Latin
- id: piglatin
- category: text
- plan: free
- needs: none
- what: Turns English text into Pig Latin, keeping capital letters and punctuation.
- test:
  1. `hello` gives `ellohay`; `apple` gives `appleway`; `string` gives `ingstray`.
  2. `Hello, World!` gives `Ellohay, Orldway!`.
  3. `Quiet` gives `Ietquay`; `my` gives `ymay`.
  4. Numbers and symbols pass through unchanged.

## NATO Alphabet
- id: nato
- category: text
- plan: free
- needs: none
- what: Spells text with the NATO phonetic alphabet (Alfa, Bravo, Charlie, digits as words) and decodes the words back to letters.
- test:
  1. "Text to NATO words" with `Hi 5`: `Hotel India / Five`.
  2. Tap Swap: mode becomes "NATO words to text", output `HI 5`.
  3. Decode `Foo`: shows `?`.
  4. Mixed case input works; punctuation passes through unchanged when encoding.

## Braille
- id: braille
- category: text
- plan: free
- needs: none
- what: Converts English text to Unicode Braille (grade 1, with capital and number indicators) and back.
- test:
  1. `abc` gives `⠁⠃⠉`. `Hello` gives `⠠⠓⠑⠇⠇⠕`. `123` gives `⠼⠁⠃⠉`.
  2. `HELLO` (all capitals) gives `⠠⠠⠓⠑⠇⠇⠕`.
  3. Swap to "Braille to text": the original text returns exactly, including capitals and numbers.
  4. Unknown Braille cells decode as `?`; unsupported characters are skipped when encoding.

## Phone Keypad
- id: t9
- category: text
- plan: free
- needs: none
- what: Converts text to old phone keypad key presses (multi-tap such as `44 33 555 555 666`, or single T9 digits) and decodes multi-tap digits back to text.
- test:
  1. "Text to multi-tap" with `hello`: `44 33 555 555 666`. Swap: output `hello`.
  2. `hi you` gives `44 444 0 999 666 88` (0 is space).
  3. "Text to T9 digits" with `hello world`: `43556096753`.
  4. Decoding `27` (mixed digits) shows `?`.

## Timestamp
- id: epoch
- category: text
- plan: free
- needs: none
- what: Shows the live Unix time and converts timestamps (seconds or milliseconds, auto-detected) to UTC, local and ISO dates with a relative time, and converts a chosen date and time to seconds and milliseconds.
- test:
  1. The "Now" number ticks every second; Copy copies it.
  2. Enter `1700000000`: UTC `Tue, 14 Nov 2023 22:13:20 GMT`, ISO `2023-11-14T22:13:20.000Z`. Enter `1700000000000`: same date (milliseconds detected).
  3. Enter `abc`: "Enter a valid number".
  4. Pick a date and time in the date field: seconds and milliseconds appear (in your local time zone). Leave the tool: the clock stops.

## UUID Maker
- id: uuid
- category: text
- plan: free
- needs: none
- what: Generates random version 4 UUIDs, 1 to 50 at a time, with upper-case and no-dash options.
- test:
  1. Open the tool: 5 UUIDs in the form `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx` (y is 8, 9, a or b).
  2. Tick UPPERCASE and No dashes, Generate: 32 upper-case characters per line.
  3. Set the count to 100: limited to 50. Set 0: becomes 1.
  4. Tap Copy all and paste elsewhere.

## Name Picker
- id: picker
- category: text
- plan: free
- needs: storage
- what: Picks a random name from a list with a short shuffle animation, or splits the names into 2 to 10 fair random teams. The name list is remembered.
- test:
  1. Enter `Ann`, `Ben`, `Cara`, `Dev` and tap Pick one: names flash, then a winner stays.
  2. Choose 2 teams and tap Make teams: two cards with 2 names each; every name appears once. With 5 names and 2 teams the sizes are 3 and 2.
  3. With an empty list, tap Pick one: "Add some names first". With 1 name, Make teams asks for at least 2.
  4. Leave and reopen the tool: the list is still there. Leave during the animation: no errors.

## Scratchpad
- id: scratch
- category: text
- plan: free
- needs: storage
- what: Stores short snippets you reuse (addresses, replies, codes) so any of them can be copied with one tap. Holds up to 60 snippets on the device.
- test:
  1. Type text and tap Save snippet: it appears at the top of the list and the box clears.
  2. Tap Copy on a snippet and paste elsewhere.
  3. Tap Paste: the clipboard text fills the box (or a message explains how to paste manually if blocked).
  4. Tap ✕ to delete a snippet. Close and reopen the app: the remaining snippets persist.
