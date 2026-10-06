# PocketKit: features

PocketKit has 224 tools in 11 categories. Everything works offline and all data stays on the phone.
**Free** = every everyday utility. **Pro** = a one-time purchase (no subscription) for the heavier features and higher limits.

_Generated from docs/parts/*.md by scripts/build-docs.js on 2026-10-06. Edit the parts files, not this file._

## App features

| Feature | What it does |
|---|---|
| **Home** | Pinned tools on top, then recent tools, then every category as a collapsible card. Press and hold a tool to pin it. |
| **Search** | Finds a tool by name, category or keyword. A microphone button searches by voice where the phone supports it. |
| **Themes** | Follow the phone, light or dark, and six accent colours (two free, four Pro). |
| **Pro** | One-time purchase `pocketkit_pro` through Google Play, or a trial code. Unlocks the Connect suite (planned), Motion cam, Stop motion, all colour themes and removes the free limits. |
| **Trial codes** | A code gives Pro until a fixed date. It is checked on the device against a built-in hash list, and the clock cannot be wound back to extend it. |
| **Free limits** | 4 pinned tools, 3 reminders, 10 notes, 3 voice recordings, 1 saved route, 3 locked files, 5 vault entries. |
| **Privacy** | No accounts, no ads, no analytics. See privacy-policy.html. |

## Daily (22)

| Tool | Plan | Needs | What it does |
|---|---|---|---|
| **Alarm Clock** | Free | notifications, storage | Alarms with a time, label and weekday repeat, scheduled as Android local notifications so they ring with the app closed (in a browser they only sound while the app is open). Enable, disable and delete. The screen states the limits: it uses the notification sound and can be muted by Do Not Disturb or battery saver. |
| **Battery & Network** | Free | network, storage | Live battery level with a ring, charging state and time estimates (where the Battery API exists), online or offline status, connection type, speed class, downlink and latency, plus the storage used from the Storage API. |
| **Birthdays** | Free | notifications, storage | Keeps birthdays and anniversaries sorted by how soon they come, with the age being turned and a yearly 9:00 reminder scheduled through Android notifications. |
| **Calendar** | Free | - | A month grid with ISO week numbers, today highlighted, tap-a-day details (weekday, week, day of year, days from today), Monday or Sunday start, and a days-between-dates calculator. |
| **Clipboard Pad** | Free | storage | A scratchpad for snippets you use often: save text, copy it back with one tap, pin favourites to the top and delete. Keeps up to 50 unpinned clips on the device. |
| **Device Info** | Free | - | Shows screen size, pixel ratio, language, processor cores, memory, online state, touch points, battery and the browser string. |
| **Expense Tracker** | Free | storage | Logs spending with category, note and date. Shows the month total, a bar for each category and a six-month column chart, with month navigation and a currency symbol. Stored locally. |
| **Flashlight** | Free | camera | Turns the camera torch on and off. |
| **Meeting Planner** | Free | storage | Lines up your day against up to five cities, colouring each hour as working hours, early or late, or night, and listing the hours that fall within 9 to 17 in every place. |
| **Moon Phase** | Free | - | Draws the moon for any date with its phase name, age in days, percentage lit and the dates of the next new moon, first quarter, full moon and last quarter. Calculated on the device from the average lunar month (accurate to about half a day). |
| **Multi Stopwatch** | Free | - | One clock for several runners: start it, tap a runner to record a lap, and see each runner's last lap, best lap and total. Up to 12 runners. |
| **Pomodoro** | Free | notifications, storage | Focus, short break and long break timers with adjustable lengths, a four-session cycle indicator, and daily and all-time session counts. Uses end timestamps so it stays accurate when the screen is off; a notification and beep fire when a period ends. |
| **Quick Timers** | Free | notifications, storage | One-tap countdown presets (soft egg, hard egg, tea, coffee, pasta, plank, workout, nap) plus a custom label and minutes. Several timers can run at once; each schedules a notification so it still alerts with the screen off. |
| **Reminders** | Free (limit: 3 active reminders (Pro: unlimited)) | notifications | Set reminders with a date and time. On Android a notification is scheduled so it appears even when the app is closed. |
| **Screen Light** | Free | - | Turns the whole screen into a coloured lamp. Eight presets including a warm lamp, a custom colour picker, a brightness slider and an optional keep-awake (Screen Wake Lock). Tap the screen to hide or show the controls. |
| **Shopping List** | Free | storage | A shopping list with quantity steppers, quick-add chips, check-off while you shop and one tap to remove everything in the basket. |
| **Signal Light** | Free | camera (torch, optional) | Flashes the screen white and black and, when the device allows, the camera torch. Modes: SOS, your own Morse message and strobe, with a speed slider. A photosensitivity warning must be accepted before the strobe starts. |
| **Stopwatch** | Free | - | Time anything to the hundredth of a second, with pause, resume, laps and reset. |
| **Timer** | Free | - | Count down from any minutes and seconds with start, pause and reset. A tone and vibration play when time is up. |
| **Tip of the Day** | Free | - | A short practical tip or proverb for each day from a built-in list, with next, previous, random, copy and share. Works fully offline. |
| **To-do List** | Free | storage | Tasks with a due date, category, done toggle, search, filter chips and a clear-completed button. Overdue tasks are highlighted. Stored locally. |
| **World Clock** | Free | storage | Keeps the time in cities from a built-in list of 72 IANA time zones. Shows time, date, UTC offset, the difference from your own time and a sun or moon icon. Reorder, remove, 12 or 24 hour display, saved locally. |

## Navigate (8)

| Tool | Plan | Needs | What it does |
|---|---|---|---|
| **Altitude** | Free | location | Height above sea level from GPS with latitude, longitude and accuracy. |
| **Compass** | Free | motion | A compass dial that points to north with the heading in degrees and a direction label. |
| **Leveler** | Free | motion | A bubble level that shows how far the phone is tilted in two directions, with a zero button. |
| **My PIN Code** | Free | location, storage | Shows live latitude, longitude, accuracy and altitude, the Open Location Code (Plus Code, computed on the device) and a geo: link that opens in any map app. Copy and share buttons, plus named places (Home, Parking...) with live distance and compass bearing back to each one. |
| **Parking Saver** | Free | location, notifications, storage | Saves the GPS spot of the parked car with an optional note and meter timer (15 min to 2 h or custom). A notification warns 5 minutes before and at expiry (scheduled with Android so it works with the app closed). Shows live distance, bearing and an arrow back to the car. |
| **Route Recorder** | Free (limit: 1 saved route (Pro: unlimited routes and GPX export)) | location, storage | Records a GPS track with watchPosition and draws it live on a canvas (auto-scaled line, green start and red end markers) with distance, duration, average and max speed. Routes are saved in IndexedDB; GPX export is Pro. Recording works in the foreground only (app open, screen on) and the screen says so; an unsaved recording is recovered if you leave the tool. |
| **Speedometer** | Free | location | Live speed in km/h from GPS with top speed and trip distance. |
| **Sunrise & Sunset** | Free | location (optional) | Computes sunrise, sunset, solar noon, civil dawn and dusk and day length for any latitude, longitude and date using the NOAA algorithm. Handles midnight sun and polar night. Times show in the phone's time zone. |

## Measure (18)

| Tool | Plan | Needs | What it does |
|---|---|---|---|
| **Distance Finder** | Free | motion | Finds the horizontal distance to an object by sighting its base and entering your eye height, using distance = eye height divided by tan of the angle downwards. |
| **G Meter** | Free | motion | Live g-force on X, Y and Z plus the total, a gauge, peak hold and a scrolling line graph. |
| **Height Finder** | Free | motion | Measures the height of a tree or building from the tilt angle to its top and its base. Uses your eye height to get the distance (or a distance you type) and shows the working. |
| **Light Meter** | Free | motion (ambient light sensor) | Ambient light in lux with a plain-language label and a graph, using the ambient light sensor when the phone exposes it. Approximate; shows a message instead of guessing when no sensor is available. |
| **Magnetometer** | Free | motion | Shows magnetic field strength in microtesla with X/Y/Z, peak and a graph, for finding magnets and metal. Shows a clear message when the phone does not expose a magnetometer to apps. |
| **Pendulum Bob** | Free | motion | A plumb line that swings from the top of the screen. It shows the angle from vertical plus the sideways and forward/back tilt, using the gravity vector. |
| **Protractor** | Free | motion (tilt mode only) | A 0 to 180 degree on-screen protractor with an arm you drag, showing degrees, supplement and complement. Tilt mode uses the phone's gravity sensor to show the angle of the phone's long axis. |
| **Reaction Test** | Free | storage (best time) | A reaction timer: tap as soon as the big button turns green and see your time in milliseconds, with last, average and best. |
| **RPM Counter** | Free | microphone (mic mode only) | Tap once per revolution to read RPM averaged over the last taps, or use the microphone to estimate the repeating pulse rate of a sound such as a fan or engine. |
| **Ruler** | Free | storage (saves the calibration) | An on-screen ruler with centimetre and inch scales, horizontal or vertical. Calibrate it by laying a credit card (85.6 mm) on the screen and dragging a line to the card's far edge; the calibration is saved. |
| **Screen Info** | Free | - | Shows the screen resolution in pixels and dp, pixel ratio, density, viewport, estimated size in inches and aspect ratio, with a full-screen grid overlay and a dead pixel colour test. |
| **Shadow Height** | Free | - | Finds the height of a tree, pole or building from the length of its shadow compared with a stick of known height. |
| **Slope Finder** | Free | motion | Measures roof pitch or ramp slope in degrees, percent, ratio (1:n) and rise per 12, by laying the phone on the surface or sighting along its edge. |
| **Sound Intensity** | Free | microphone | Approximate sound level in decibels from the microphone with minimum and maximum. |
| **Speed Calc** | Free | - | Calculates speed from distance and time, distance from speed and time, or time from distance and speed, with km, m, miles, feet and nautical miles, and km/h, m/s, mph and knots. |
| **Stride & Pace** | Free | storage | Calculates your step length from a known distance and step count, converts steps to distance, and calculates running pace (min/km) and speed. |
| **Unit Price** | Free | - | Compares up to three products by price per 100 g, 100 ml or per piece and highlights the best value, handling kg, lb, oz, litres and fl oz. |
| **Vibrometer** | Free | motion | Measures vibration of the surface the phone rests on (RMS acceleration), with a live graph, min and max values and a severity label from Still to Severe. |

## Calculate (37)

| Tool | Plan | Needs | What it does |
|---|---|---|---|
| **Age Calculator** | Free | - | Exact age in years, months and days from a date of birth (on today or any chosen date), total days, weeks and months lived, the weekday of birth and the countdown to the next birthday. |
| **Area & Volume** | Free | - | Area, perimeter, surface area, volume and diagonals for square, rectangle, triangle, circle, trapezoid, ellipse, cube, cuboid, cylinder, sphere, cone and square pyramid. |
| **Billing** | Free | storage | Invoice maker with business name, customer, currency symbol, line items (quantity and price), tax percentage and a discount in percent or amount. Shows subtotal, discount, tax and total live. Saves the last 20 invoices on the device, where they can be viewed again, deleted, copied or shared as plain text. |
| **Break-even** | Free | - | Units and revenue needed to cover fixed costs from price and variable cost per unit, the contribution margin, and optionally the units needed to reach a profit target. |
| **Calculator** | Free | - | A simple calculator with add, subtract, multiply, divide, percent, backspace and clear. |
| **Cooking Units** | Free | - | Converts between cups, tablespoons, teaspoons, grams, kilograms, ounces and millilitres for common ingredients (flour, sugar, brown sugar, icing sugar, butter, rice, water/milk, honey, oil, salt, cocoa, oats). |
| **Days Counter** | Free | storage | Shows the days between two dates with a weeks and years/months/days breakdown, adds or subtracts any number of days from a date (with the weekday), and keeps a list of named events with a live countdown. |
| **Discount & GST** | Free | - | Final price after a discount and tax (GST or VAT). Works when the entered price excludes tax (tax is added) or includes tax (tax is split out). Shows what you save, the price before tax and the tax amount. |
| **EMI Calculator** | Free | - | Works out the monthly loan instalment (EMI) from amount, yearly interest rate and tenure in years or months. Shows total interest, total payment and the first 12 months of the repayment schedule (principal, interest, balance). A 0% rate is handled as a plain split. |
| **FD / RD** | Free | - | Maturity amount of a fixed deposit with quarterly, monthly, half-yearly or yearly compounding, and of a monthly recurring deposit with quarterly compounding, showing the interest earned. |
| **Fractions** | Free | - | Adds, subtracts, multiplies and divides fractions, mixed numbers (1 1/2), decimals and whole numbers, giving a simplified fraction, mixed number, decimal and percent. |
| **Fuel Cost** | Free | - | Trip fuel and cost from distance, efficiency (km/L, L/100 km or mpg) and fuel price, plus a second calculator that finds your mileage from distance driven and fuel used. |
| **GCD & LCM** | Free | - | Greatest common divisor (HCF) and least common multiple of two or more whole numbers. |
| **Growth Rate** | Free | - | Compound annual growth rate between a start and end value over a number of years, with total growth and the time to double. |
| **Investment** | Free | - | Two calculators. Lump-sum compound interest with yearly, half-yearly, quarterly or monthly compounding, and the future value of a monthly SIP (instalments at the start of each month). Both show a year-by-year growth table. |
| **Loan Compare** | Free | - | Compares two loan offers for the same amount (rate and months for each): EMI, total interest, total cost, and which offer is cheaper by how much. |
| **Marks & GPA** | Free | - | Adds up exam marks (one subject per line, optionally as 42/50) into a total and percentage with a typical grade, and computes a credit-weighted GPA from letter grades or grade points. Inputs are remembered. |
| **Markup & Margin** | Free | - | Profit, margin and markup from cost and selling price, and the selling price you need for a target margin (of price) or markup (on cost). |
| **Net Worth** | Free | - | Type assets and debts, one per line with the amount at the end of the line, and see total assets, total debts and net worth. Lists are remembered on the device. |
| **Number Words** | Free | - | Writes a number out in words (for cheques and invoices) using the Indian system (lakh, crore) or the international system (million, billion), including negatives and two decimal places. |
| **Percentage** | Free | - | Four quick percentage calculators on one screen: X% of Y, X is what percent of Y, percent change between two values, and add or subtract a percentage from a value. |
| **Power Cost** | Free | - | Electricity use and cost of an appliance per day, 30-day month and year from its watts, quantity, hours per day and price per kWh. |
| **Prime Check** | Free | - | Tells whether a whole number is prime, shows its prime factorisation, its divisors (for numbers up to a billion) and the next and previous prime. |
| **Quadratic** | Free | - | Solves ax² + bx + c = 0 with real, repeated or complex roots, the discriminant and the vertex of the parabola. Also handles the linear case when a is 0. |
| **Random** | Free | - | Draws random numbers in a range (one or many, optionally without repeats until the range is exhausted), picks one item from a list or shuffles the list, and picks a random date between two dates with its weekday. Uses the secure random generator. |
| **Ratio** | Free | - | Simplifies a ratio to lowest terms, solves a proportion (a : b = c : x) and splits an amount in a given ratio. |
| **Salary Convert** | Free | - | Converts pay between hourly, daily, weekly, monthly and yearly using your hours per week, weeks per year and days per week. |
| **Scientific** | Free | - | Scientific calculator with brackets, sin/cos/tan and inverses in degrees or radians, log, ln, square root, power, factorial, pi, e, percent, Ans and memory keys (MC, MR, M+, M-). Uses a hand-written expression parser (no eval) and shows a live preview of the result. |
| **Simple Interest** | Free | - | Simple interest and total amount for a principal, annual rate and time given in years, months or days. |
| **Size Converter** | Free | - | Approximate shoe sizes (UK, US men, US women, EU, foot length in cm), women's clothing sizes (UK, US, EU) and chest or jacket size in inches or cm with an EU size and a letter size. A note reminds that brands differ. |
| **Statistics** | Free | - | Paste or type a list of numbers (spaces, commas or new lines) and get count, sum, mean, median, mode, min, max, range, population and sample standard deviation and variance. |
| **Tally Counter** | Free | storage | A tally counter with very large plus and minus buttons, a configurable step and a light vibration on each tap. Keep several named counters, switch between them by tapping, and everything is saved on the device. Reset and delete ask for a second tap. |
| **Time Calc** | Free | - | Adds and subtracts durations typed as 1:30, 2h 15m, 90m or 45s (a leading minus subtracts), and works out the hours between two clock times with an unpaid break, including shifts past midnight. |
| **Tip Splitter** | Free | - | Splits a restaurant bill between any number of people with a tip percentage, and can round each person's share up to a whole number. |
| **Triangle** | Free | - | Solves a triangle from three sides, or from two sides and the angle between them. Gives all three angles, type (scalene/isosceles/equilateral, acute/right/obtuse), area, perimeter, inradius and circumradius. |
| **Unit Converter** | Free | - | Convert length, weight, volume, area, speed, data, time and temperature between common units. |
| **Work Days** | Free | - | Finds the date after N working days (skipping weekends, negative numbers go backwards) and counts working days between two dates. The weekend can be Sat+Sun, Fri+Sat or Sun only. |

## Text & Data (34)

| Tool | Plan | Needs | What it does |
|---|---|---|---|
| **Base64 & URL** | Free | - | Encodes and decodes Base64 (standard and URL-safe) and URL percent-encoding. It is UTF-8 safe, so accents, emoji and non-Latin scripts round-trip correctly. |
| **Binary & Hex** | Free | - | Converts text to binary, hex, decimal or octal byte values and back using UTF-8, so accents and emoji work. |
| **Braille** | Free | - | Converts English text to Unicode Braille (grade 1, with capital and number indicators) and back. |
| **Caesar Cipher** | Free | - | Encodes and decodes the Caesar cipher with a shift of 1 to 25, a ROT13 shortcut, and a list of all 25 shifts for cracking a message. |
| **Case & Slug** | Free | - | Converts text into URL slug, camelCase, PascalCase, snake_case, kebab-case, CONSTANT_CASE or dot.case, line by line. Accents are removed for slugs. |
| **Checklist** | Free | storage | A simple to-do or shopping list with tick boxes, a progress bar and Clear ticked, saved on the device (up to 300 items). |
| **Colour Convert** | Free | - | Converts colours between HEX, RGB and HSL with a native colour picker and a large live swatch. Shows ready-to-copy CSS values. |
| **CSV Viewer** | Free | - | Shows pasted CSV (comma, semicolon, tab or pipe, auto-detected) as a scrollable table or converts it to JSON. Handles quoted fields, embedded commas and line breaks. |
| **Emoji & Symbols** | Free | - | A keyboard of emoji and special characters (arrows, maths, currency, Greek, punctuation, shapes, box drawing, super and subscripts) with search. Tap characters to build text and copy it. |
| **Fancy Text** | Free | - | Restyles your text into many Unicode looks (bold, italic, script, gothic, double-struck, monospace, circled, squared, fullwidth, small caps, upside down, strikethrough, underline) that can be pasted anywhere. |
| **Hash Maker** | Free | - | Computes SHA-1, SHA-256, SHA-384 and SHA-512 hashes of typed text or a chosen file, all on the device, and compares the result against a hash you paste. |
| **JSON Tool** | Free | - | Pretty-prints (2 spaces, 4 spaces or tab), minifies and validates JSON. Errors show the line and column with a pointer, and the cursor jumps to the problem. |
| **Lorem Ipsum** | Free | - | Generates placeholder text as paragraphs, sentences or words (1 to 100), optionally starting with the classic "Lorem ipsum dolor sit amet". |
| **Markdown View** | Free | - | Live preview of Markdown: headings, bold, italic, strike, inline and fenced code, lists, quotes, rules and links. All text is HTML-escaped and unsafe link types are not made clickable. |
| **Morse Code** | Free | - | Translates text to Morse code and Morse back to text (letters, digits and common punctuation). The Morse can be played as beeps and phone vibration at a speed of 5 to 30 words per minute. |
| **Name Picker** | Free | storage | Picks a random name from a list with a short shuffle animation, or splits the names into 2 to 10 fair random teams. The name list is remembered. |
| **NATO Alphabet** | Free | - | Spells text with the NATO phonetic alphabet (Alfa, Bravo, Charlie, digits as words) and decodes the words back to letters. |
| **Notes** | Free (limit: 10 notes (unlimited with Pro)) | storage | Quick notes with a title and body. Search, pin notes to the top, copy or delete. Everything is saved on the device as you type. |
| **Number Bases** | Free | - | Converts whole numbers between binary, octal, decimal and hex and any other base from 2 to 36, using big integers so very long numbers stay exact. Negative numbers work. |
| **Number Sorter** | Free | - | Sorts a pasted list of numbers (separated by spaces, commas or lines), optionally removes duplicates, and shows count, sum, average, median, smallest and largest. |
| **Password Maker** | Free | - | Creates random passwords of 4 to 64 characters using the secure random generator. Choose upper case, lower case, digits and symbols, optionally avoid look-alike characters, see a strength meter and copy. |
| **Phone Keypad** | Free | - | Converts text to old phone keypad key presses (multi-tap such as `44 33 555 555 666`, or single T9 digits) and decodes multi-tap digits back to text. |
| **Pig Latin** | Free | - | Turns English text into Pig Latin, keeping capital letters and punctuation. |
| **QR & Barcode** | Free | - | Makes QR codes from text, web links, Wi-Fi details, phone numbers, email and SMS templates, plus Code 128 and EAN-13 barcodes drawn on a canvas. The picture can be saved as a PNG or shared. |
| **Reading Time** | Free | - | Estimates silent reading time (150, 200 or 300 words per minute) and speaking time (130 words per minute) for pasted text. |
| **Regex & Replace** | Free | - | Tests regular expressions against sample text with highlighted matches, match positions and capture groups, and does find and replace with $1 style groups. |
| **Roman Numerals** | Free | - | Converts whole numbers from 1 to 3999 to Roman numerals and Roman numerals back to numbers, in one box that detects which way to convert. |
| **Scratchpad** | Free | storage | Stores short snippets you reuse (addresses, replies, codes) so any of them can be copied with one tap. Holds up to 60 snippets on the device. |
| **SMS Counter** | Free | - | Shows how many SMS parts a message needs (GSM-7: 160 or 153 per part; Unicode: 70 or 67 per part) and how long it is as a tweet out of 280, with links counted as 23. |
| **Text Diff** | Free | - | Compares two texts and highlights what was added (green) and removed (red, struck through), by line, word or character. |
| **Text Tools** | Free | - | Live counts of words, characters, characters without spaces, sentences, lines and paragraphs, plus one-tap UPPER, lower, Title and Sentence case, reverse, space clean-up, dedupe lines, sort lines and remove blank lines, with Undo and Copy. |
| **Timestamp** | Free | - | Shows the live Unix time and converts timestamps (seconds or milliseconds, auto-detected) to UTC, local and ISO dates with a relative time, and converts a chosen date and time to seconds and milliseconds. |
| **UUID Maker** | Free | - | Generates random version 4 UUIDs, 1 to 50 at a time, with upper-case and no-dash options. |
| **Word Frequency** | Free | - | Counts how often each word appears, ranks the top 40 with bars, and can skip common words like "the" and "and". Copy the list as tab-separated text. |

## Audio (22)

| Tool | Plan | Needs | What it does |
|---|---|---|---|
| **Audio Player** | Free | storage | Plays audio files you pick from the device (several at once as a playlist), with seek bar, +/-10 second skip, speed from 0.5x to 2x with optional pitch preservation, an A-B loop and a five-band equalizer with presets. |
| **Binaural Beats** | Free | - | Plays a slightly different tone in each ear to create a binaural beat, with presets for delta, theta, alpha, beta and gamma, adjustable beat and carrier frequency, volume and an auto-stop timer. Needs headphones. |
| **Chords & Scales** | Free | - | Reference for 11 chord types and 9 scales in all 12 keys. Shows the note names, highlights them on a two-octave keyboard and plays them (strummed chord or ascending scale). |
| **Clap Counter** | Free | microphone | Counts claps or sharp sounds from the microphone with adjustable sensitivity, a level bar with threshold marker and a claps-per-minute rate. |
| **Dog Whistle** | Free | - | High-pitched tone from 8 to 22 kHz with presets and steady, pulsing or sweeping patterns for attracting or training pets. Warns about volume and that many phone speakers cannot reach the top range. |
| **Drum Pad** | Free | - | Eight large synthesized drum pads (kick, snare, clap, hi-hat, open hat, tom, rim, cowbell) with multi-touch and a master volume. No sound files are used. |
| **Hearing Test** | Free | - | A guided high-frequency hearing test: tones at 4, 8, 10, 12, 14, 15, 16, 17, 18, 19 and 20 kHz in both ears, left or right, and the highest tone you can hear is reported. It is for fun and not a medical test. |
| **Metronome** | Free | - | Steady click from 30 to 300 BPM with an accented first beat, time signatures from 1/4 to 12/4 and tap tempo. Clicks are scheduled ahead with Web Audio so timing stays accurate, and beat dots show the current beat. |
| **Mike** | Free | microphone | Uses the microphone as a loudspeaker: mic to phone speaker or headphones with a gain control up to 300%, a limiter, an echo-cancellation option and a level meter. Shows a strong feedback warning first. |
| **Piano** | Free | - | Two-octave (25 key) on-screen piano with multi-touch chords, finger sliding between keys, octave shift of two octaves either way and four waveform sounds. |
| **Pitch Pipe** | Free | - | Plays a steady reference note for any of the 12 notes in octaves 3, 4 or 5, useful for tuning voice or an instrument by ear. Shows the note name and frequency. |
| **Sleep Sounds** | Free | - | Looping relaxing sounds synthesized offline: white, pink and brown noise, rain, ocean waves and wind. Has a volume slider, a sleep timer (15 minutes to 8 hours) and a fade-out when the timer ends. |
| **Speaker Cleaner** | Free | - | Plays a low 165 Hz tone (or a 100 to 450 Hz sweep for dust) for 15 seconds to 2 minutes to help shake water out of a phone speaker, with a countdown and progress bar. |
| **Spectrum** | Free | microphone | Live frequency spectrum bars (48 log-spaced bands, 30 Hz to 16 kHz, with falling peak caps) and a waveform trace from the microphone, plus the loudest frequency in Hz. |
| **Speech to Text** | Free | microphone | Turns your speech into text that you can copy. |
| **Stereo Test** | Free | - | Checks speakers or headphones channel by channel with a tone or pink noise on left, right, both or alternating every second, with L and R indicators on screen. |
| **Text to Speech** | Free | - | Reads typed text aloud with a choice of voice and speed. |
| **Tone Generator** | Free | - | Plays a pure tone from 20 Hz to 20 kHz (log slider plus number box) as sine, square, triangle or sawtooth, with a volume control and an optional looping frequency sweep. Shows the nearest note and warns about loud sound. |
| **Tone Sequencer** | Free | - | A 16-step by 8-note pentatonic grid for composing a looping melody, with tempo from 60 to 200 BPM, four sounds, random and clear buttons. The pattern and tempo are remembered. |
| **Tuner** | Free | microphone | Chromatic tuner using YIN pitch detection on the microphone. Shows note, frequency, cents off and a needle, and has guitar, ukulele, bass and violin presets that match your note to the nearest string. |
| **Vocal Range** | Free | microphone | Sing your lowest and highest comfortable notes; the stable notes are tracked with pitch detection and the range is shown in notes, semitones and octaves with a rough voice type guess. The range is saved on the device. |
| **Voice Recorder** | Free (limit: 3 saved recordings (Pro: unlimited)) | microphone, storage | Records voice memos with MediaRecorder with pause, resume and stop. Recordings are kept in IndexedDB on the device and listed with play, rename, share or download and delete. The free plan keeps 3 recordings, then shows the Pro sheet. |

## Camera (19)

| Tool | Plan | Needs | What it does |
|---|---|---|---|
| **Blank Cam** | Free | camera, microphone | Records video from the front or rear camera while the whole screen is black so recording is discreet. A large dim Stop button ends the recording, then the video can be previewed and saved or shared. A clear note warns that recording others without consent may be illegal. |
| **Code Scanner** | Free | camera | Scans QR codes and barcodes with the camera using the built-in BarcodeDetector when the phone has it, otherwise a bundled jsQR for QR codes. It shows the result, copies it, offers an Open link button only for http and https text, keeps a history, and can also scan a picture from the phone. |
| **Collage** | Free | storage | Combine up to 9 pictures from the phone into one collage using layouts from two side by side up to 3 by 3, with spacing and background colour, a shuffle button, and save as JPEG. |
| **Colour Detector** | Free | camera | Live camera with a centre crosshair that shows the colour under it as HEX and RGB with the nearest of about 110 named colours. Tap the view to lock a colour, copy the HEX, and keep a history of the last 12 locked colours. |
| **Doc Scanner** | Free | camera, storage | Take or pick a photo of a page, drag four corners over it, straighten it with a perspective correction, then choose colour, grey or black-and-white (adaptive threshold for uneven light), rotate and save as JPEG or PNG. |
| **Eye Dropper** | Free | storage | Pick a picture, touch or drag over it to read any pixel colour as HEX and RGB with the nearest colour name, copy the HEX, and tap one of the six main colours automatically extracted from the picture. |
| **Grid Cam** | Free | camera, motion | Camera with composition overlays (rule of thirds, 4 by 4 grid, cross, diagonals) and a live horizon line driven by the accelerometer that turns green when the phone is level. Capture a photo with front or rear camera. |
| **Image Shrink** | Free | storage | Reduces picture file size by limiting the longest side and setting JPEG or WebP quality, for many pictures at once, showing the before and after sizes and the percentage saved. |
| **Img Convert** | Free | storage | Converts pictures between PNG, JPEG and WebP, for several files at once. Transparent areas become white when saving as JPEG. |
| **Magnifier** | Free | camera | Turns the rear camera into a magnifying glass with a zoom slider (real camera zoom when available, otherwise digital zoom), freeze frame, torch toggle, brightness and contrast sliders, and a button that saves the current view as a picture. |
| **Mirror** | Free | camera | Uses the front camera as a mirror: the picture is flipped like a real mirror, with zoom, brightness, freeze and a switch to the rear camera. |
| **Motion Cam** | Pro | camera | Watches the camera and detects movement by comparing small frames, ignoring small noise. When enough of the picture changes it beeps and vibrates, and saves a snapshot with the time to a log in the app. Sensitivity can be changed and the log entries can be saved. |
| **Night Cam** | Free | camera | Brightens dark scenes live by boosting brightness, contrast and gamma on a canvas, with an optional green night-vision tint, a torch toggle when supported, and a button to capture a photo at full camera resolution. |
| **Photo Cleaner** | Free | storage | Removes hidden metadata such as GPS location, camera model and time from photos by re-encoding them at full size, and tells you whether metadata was found in each JPEG. Nothing is uploaded. |
| **Photo FX** | Free | storage | Simple photo editor: look presets (grey, sepia, invert, vivid, cool, warm, soft), brightness, contrast and saturation sliders, rotate and flip, and save at full size as JPEG or PNG. |
| **Pixel Ruler** | Free | camera, storage | Take or pick a photo, drag two points over it to measure the distance in image pixels, then calibrate with an object of known length (a coin or card) to show real units such as mm. |
| **Stop Motion** | Pro | camera | Build stop-motion films: capture frames with a see-through onion-skin of the previous frame, delete or reorder frames, play them back at a chosen frames-per-second and export a WebM video recorded from a canvas. |
| **Time-lapse** | Free | camera | Captures a frame every 1 to 60 seconds and builds them into a WebM time-lapse video at 8, 12 or 24 fps. Keep the app open and the phone steady; up to 600 frames are kept in memory. |
| **Timer Cam** | Free | camera | Self-timer camera: choose a 3, 5, 10 or 15 second delay and take 1, 3 or 5 shots in a row, with a big on-screen countdown and a beep for the last seconds. Photos collect below and a tap saves each. |

## Health (20)

| Tool | Plan | Needs | What it does |
|---|---|---|---|
| **BMI Calculator** | Free | storage | Body mass index in metric or imperial, with the category, a colour scale with a marker and the healthy weight range for your height. Inputs are remembered. |
| **Body Fat** | Free | storage | Estimates body fat percentage with the US Navy tape-measure method (height, neck, waist and, for women, hip) and gives a category. |
| **Breathing** | Free | none (vibration optional) | Guided breathing with an animated circle for box breathing (4-4-4-4), 4-7-8, 5-5 or a custom pattern, with a session timer and optional vibration cues. |
| **Calorie & BMR** | Free | storage | Basal metabolic rate using Mifflin-St Jeor, daily maintenance calories for an activity level and a target for a weight goal, with a warning for very low targets. |
| **Cycle Tracker** | Free | storage | A private period tracker kept on the device: log start dates, it learns your cycle length, predicts the next period and shows the likely fertile window. Not suitable for contraception. |
| **Due Date** | Free | storage | Estimated due date from the first day of the last period (Naegele's rule, adjustable for cycle length), with weeks and days pregnant, trimester, progress bar and days to go. |
| **Eye Rest 20-20-20** | Free | storage | Reminds you every 20 minutes to look 20 feet away for 20 seconds, with a countdown ring, a beep and vibration, and a count of breaks taken today. Reminders work while the app is open. |
| **Fasting Timer** | Free | storage | An intermittent fasting timer with 12, 16:8, 18:6, 20:4 and 24 hour goals, a progress ring, a phase hint and a history of past fasts. A running fast survives leaving the tool. |
| **Habit Streaks** | Free | storage | Track daily habits with a one-tap "Mark done", current and best streaks and a 7 day dot row. Everything is stored on the device. |
| **Health Log** | Free | storage | Log weight, blood pressure, blood sugar or your own named measures with a date and note, see a line chart, and export the log as text (Share sheet on Android, download elsewhere). |
| **Heart Rate** | Free | camera | An approximate pulse estimate. With a fingertip on the rear camera and flash, it reads the red brightness pulses for 20 seconds, filters the signal, counts the beats and shows a live waveform. It is an estimate, not a medical device, and says so on the screen. |
| **Ideal Weight** | Free | - | Ideal body weight from the Devine, Robinson, Miller and Hamwi formulas plus the healthy BMI range for your height, in metric or imperial. |
| **Macro Calculator** | Free | storage | Splits a daily calorie target into grams of carbs, protein and fat using Balanced, High protein, Low carb, Keto or custom percentages, with a split bar. |
| **Meditation** | Free | - | A silent meditation timer with a soft synthesised bell at the start and end, optional interval bells, a progress ring and your last duration remembered. |
| **Mood Log** | Free | storage | Record how you feel each day with a face and an optional note, and see the last 14 days as coloured bars plus a recent list. Stored on the device. |
| **Sleep Calculator** | Free | - | Suggests bedtimes for a wake-up time, or wake-up times for a bedtime, using 90 minute cycles and 15 minutes to fall asleep. |
| **Step Counter** | Free | motion, storage | Counts steps with the motion sensor while the app is open, with a daily goal ring, distance and calorie estimates, and a 14 day history. It cannot count in the background and stops its sensor when you leave. |
| **Waist-Hip Ratio** | Free | - | Waist-to-hip ratio with the WHO risk bands for men and women. |
| **Water Tracker** | Free | storage | Track daily water with quick-add glass buttons, a custom amount, an animated water level, an adjustable goal and a 14 day bar history. |
| **Workout Timer** | Free | storage | An interval timer for HIIT and circuits with work, rest and rounds, a 5 second get-ready, colour-coded phases, sound and vibration cues, pause and reset. |

## Security (10)

| Tool | Plan | Needs | What it does |
|---|---|---|---|
| **2FA Codes** | Free | storage | An offline authenticator for two-step verification (TOTP, RFC 6238 with HMAC-SHA1, SHA-256 or SHA-512 through WebCrypto, 6 to 8 digits, 10 to 120 s periods). Accounts can be added from a base32 secret or an otpauth:// link. Secrets are stored encrypted under their own master password using the same AES-256-GCM vault scheme, with lockout, auto-lock and encrypted backup/import. Codes show a countdown and copy with a 30 s clipboard clear. The engine passes the RFC 6238 and RFC 4226 test vectors. |
| **Checksum** | Free | storage | Hashes any chosen file with SHA-256, SHA-512, SHA-384 or SHA-1 using WebCrypto and compares it with a hash you paste (spaces, colons and case are ignored; the algorithm is picked from the hash length). The whole file is read into memory because WebCrypto cannot hash in a stream, so very large files may fail. |
| **Emergency Card** | Free | storage | A large, easy-to-read card with name, blood group, allergies, conditions, medicines, organ donor status and two emergency contacts with one-tap call buttons, stored locally on the phone (not encrypted, by design, so first responders can read it). |
| **File Locker** | Free (limit: 3 locked files (Pro: unlimited)) | storage | Encrypts photos, videos and documents with AES-256-GCM using a key derived from a vault password (PBKDF2-SHA256, 600,000 rounds, random 16-byte salt, random 12-byte IV per file) and stores them, with encrypted names and thumbnails, in IndexedDB. Has a setup flow with strength hint and a no-recovery warning, a wrong-password lockout (30 s after 5 failures, doubling), preview, export (decrypt and share/download), delete, change password (re-encrypts every file in one transaction), optional biometric quick unlock when the NativeBiometric plugin exists, and auto-lock when leaving the tool or after 60 s in the background. Files over 100 MB show a warning. |
| **Password Check** | Free | - | Live password strength checker that runs only on the phone. Shows a meter, entropy estimate in bits, estimated crack time for online guessing, slow-hash and fast-hash attacks, problems found (common passwords with leetspeak, dictionary words, repeats, sequences, keyboard runs, years) and suggestions. |
| **Password Vault** | Free (limit: 5 entries (Pro: unlimited)) | storage | A master-password-protected store of logins (title, username, password, website, notes) encrypted with AES-256-GCM as one blob under its own salt and key. Includes search, show/hide, copy buttons that clear the clipboard after 30 s where Android allows it, a built-in password generator with a length field and strength meter, edit and delete, change master password, and an encrypted backup file (JSON with salt, iv, ciphertext) that can be exported and imported with a warning. |
| **PIN & Passphrase** | Free | - | Generates random PINs (4 to 12 digits, optionally avoiding 0000 or 1234 style PINs), word passphrases from a built-in 789 word list (3 to 10 words, separator, capitalise, number) and random passwords (8 to 64 characters, choose character sets), all from crypto.getRandomValues with unbiased selection. Shows the bits of randomness and copies with a 30 s clipboard clear. |
| **Privacy Checklist** | Free | storage | An interactive checklist of 25 phone privacy and security habits in five groups with a progress bar and percentage, saved on the device. |
| **Secret Notes** | Free | storage | Private notes encrypted with AES-256-GCM under their own master password, separate from the regular Notes tool. Includes search, create, edit, delete, change password, lockout, auto-lock and encrypted backup/import. |
| **Text Locker** | Free | - | Encrypts a text message with a password into a shareable Base64 string using AES-256-GCM and PBKDF2-SHA256 (600,000 rounds, random salt and IV, header authenticated), and decrypts such strings. A wrong password or any edit to the code makes decryption fail. |

## Create (1)

| Tool | Plan | Needs | What it does |
|---|---|---|---|
| **Paint** | Free | storage | Draw with any colour and brush size, use an eraser, undo, clear and save the picture as an image. |

## Fun (33)

| Tool | Plan | Needs | What it does |
|---|---|---|---|
| **2048** | Free | - | Swipe to slide and merge tiles with smooth sliding and pop animations. Score and best score (saved). Arrow keys also work on desktop. |
| **Bingo Caller** | Free | - | Calls bingo numbers 1 to 75 with the B-I-N-G-O letter, shows all called numbers on a board and the last few calls, optionally read aloud. Saved between sessions. |
| **Bottle Spinner** | Free | - | Spin a bottle in the middle of a circle of 2 to 12 numbered seats. It slows to a stop and highlights the seat it points at. |
| **Coin Flip** | Free | - | Flip a gold 3D coin that spins and hops, landing on Heads or Tails. Keeps a saved tally with a heads/tails ratio bar. |
| **Connect Four** | Free | - | Drop discs and connect four. Play a minimax phone at Easy, Normal or Hard, or two players on one phone. Score saved. |
| **Dice Roller** | Free | - | Roll 1 to 6 dice of d4, d6, d8, d10, d12 or d20 with a tumbling animation. Shows each die (pips for d6), the total and a saved history of the last rolls. Uses crypto.getRandomValues. |
| **Finger Chooser** | Free | - | Everyone holds a finger on the screen; after a 3 second countdown the phone picks 1, 2 or 3 random fingers as the winners. |
| **Flappy Tap** | Free | - | Tap to flap a bird between pipes. Canvas animation with gravity, scoring per pipe and a saved best. |
| **Hangman** | Free | - | Guess a hidden word from a built-in list of 80 words with a category hint. A gallows drawing builds up with each miss (6 lives). Win/loss and streaks saved. |
| **Lights Out** | Free | - | Tap a light to toggle it and its four neighbours; turn them all off. Three difficulty levels, every level is solvable, best moves saved. |
| **Lucky Numbers** | Free | - | Random number picker with presets for 6 of 49 and 5 of 50 plus 2 stars, or a custom amount from any range up to 1000. Balls pop in one by one, sorted and unique. |
| **Magic 8-Ball** | Free | motion | Ask a question, then shake the phone or tap the ball for one of 20 classic answers shown in the blue window with a shaking animation. |
| **Math Sprint** | Free | - | Answer as many arithmetic questions as possible in 30 seconds with a built-in number pad. Auto-checks when you type enough digits. Three levels, best saved. |
| **Memory Match** | Free | - | Flip cards to find matching emoji pairs on 3x4, 4x4 or 4x5 grids. Counts moves and time and saves the best result per size. |
| **Minesweeper** | Free | - | Classic mine hunting at three sizes. Tap digs, long-press or Flag mode places flags. The first tap is always safe; best times are saved. |
| **Number Guess** | Free | - | Guess the secret number from 1 to 50, 100 or 1000 using too-high / too-low hints, a narrowing range bar and a guess history. Best number of tries saved. |
| **Reaction Timer** | Free | - | Screen turns red, then green after a random delay. Tap as soon as it is green to get your time in ms, with best and average of the last 5 saved. |
| **RPS Showdown** | Free | - | Rock paper scissors against the phone with a shaking hands animation, win/draw/loss counts and a current and best winning streak (saved). |
| **Scoreboard** | Free | - | Score keeper for any game: add up to 12 players, edit names, tap -1, +1 or add/subtract a custom amount. Leader gets a crown. Saved automatically. |
| **Simon Says** | Free | - | Four coloured pads light up with musical tones in a growing pattern; repeat it from memory. Best round saved. |
| **Slide Puzzle** | Free | - | Classic sliding tile puzzle in 3x3 and 4x4 with smooth tile movement. Shuffles are always solvable. Moves, time and best saved. |
| **Snake** | Free | - | Steer a snake with swipes, the on-screen arrow pad or arrow keys to eat apples. Speeds up as you grow; best score saved. |
| **Spin Wheel** | Free | - | A canvas wheel with coloured segments built from your own list of options. Spins with an easing slowdown, highlights the winner and can remove the winner after each spin. |
| **Sudoku** | Free | - | Generates a new Sudoku with exactly one solution at Easy, Medium or Hard. Conflicts show red, a number pad fills cells, hints and a check button help. Best times saved. |
| **Team Maker** | Free | - | Paste names (lines or commas) and split them into 2 to 6 fair random teams. Duplicates are removed and names are remembered. |
| **Tic-Tac-Toe** | Free | - | Play X and O against an unbeatable minimax phone (choose to play first or second) or against a friend on the same phone. Scoreboard is saved. |
| **Tower of Hanoi** | Free | - | Move a stack of 3 to 7 discs to the right peg, one at a time, never a larger disc on a smaller one. Shows minimum moves; best saved. |
| **Trivia Quiz** | Free | - | Ten random questions per round from 40 built-in general knowledge questions with four options each. Correct answer shown in green; best score saved. |
| **Truth or Dare** | Free | - | Draws a family-friendly truth question or a silly dare from 30 of each, with a card flip animation. Surprise me chooses one randomly. |
| **Typing Speed** | Free | storage | A typing test with 30 or 60 second modes. Shows live WPM and accuracy, colours each letter right or wrong, and keeps a personal best. |
| **Whack-a-Mole** | Free | - | Tap moles popping from nine holes for 30 seconds; they appear faster as you score. Best score saved. |
| **Word Scramble** | Free | - | Unscramble jumbled letters by tapping tiles into slots. Category hint, skip, streak and best streak saved. |
| **Would You Rather** | Free | - | Two silly choices at a time from 30 built-in dilemmas. Tap one to pick it, then go to the next question. |

