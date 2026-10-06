## EMI Calculator
- id: emi
- category: calculate
- plan: free
- needs: none
- what: Works out the monthly loan instalment (EMI) from amount, yearly interest rate and tenure in years or months. Shows total interest, total payment and the first 12 months of the repayment schedule (principal, interest, balance). A 0% rate is handled as a plain split. A clock button in the header keeps the results you settle on (the last 200 on the device) with a copy button.
- test:
  1. Open it with the defaults (500,000, 8.5%, 5 years): Monthly EMI shows about 10,258.27 and a 12-row table appears.
  2. Set loan 1,000,000, rate 10, tenure 10 years: EMI is about 13,215.07.
  3. Set rate 0, loan 1200, tenure 12 months: EMI is 100.00 and total interest is 0.00.
  4. Switch "Tenure in" to Months and enter 6: the table shows 6 rows ending with balance 0.00.
  5. Clear the loan amount: the result is replaced by "Enter the values above." with no error.
  6. Limits: type 250 in the interest field: a red "Maximum is 200" appears under it, the result says "enter a value from 0 up to 200", and leaving the field sets it back to 200. Tenure 101 years shows "Maximum is 100"; switching the unit to Months allows up to 1200. Letters, e and + cannot be typed.
  7. History: change a value (type a new number), wait 2 seconds: the clock button appears in the header. Open it: the result is listed with what was calculated and the answer, and its copy button copies it. Opening the tool without typing adds nothing, and an empty or invalid input is never added.

## Billing
- id: billing
- category: calculate
- plan: pro
- needs: storage
- what: Invoice maker with business name, customer, currency symbol, line items (quantity and price), tax percentage and a discount in percent or amount. Shows subtotal, discount, tax and total live. Saves the last 20 invoices on the device, where they can be viewed again, deleted, copied or shared as plain text. An invoice can be exported as a standalone printable HTML page (escaped text, inline styles), and all saved invoices as one CSV file.
- test:
  1. Enter an item "Widget", qty 2, price 25, tax 10: total shows 55.00. Add a second item and remove it with the cross: totals update.
  2. Set discount type "%" with 10: subtotal 50, discount -5, tax 4.50, total 49.50.
  3. Tap Save: "Invoice #1 saved" and it appears under Saved invoices. Tap Save again: it updates the same entry, not a new one.
  4. Tap New invoice, save a different one, then tap View on the first: its items, customer and tax load back into the editor.
  5. Tap Copy and paste elsewhere: the text starts "INVOICE #1" and ends with "TOTAL: ...". Tap Share to open the system share sheet.
  6. Save more than 20 invoices: only the newest 20 stay. Tap the cross on one: it is deleted. Close and reopen the tool: business name, tax and saved invoices are still there.
  7. Export: with no items tap "Export page (HTML)": a message asks for at least one item. Add an item named <b>Pen</b> and tap it: the share sheet opens with invoice-N-YYYY-MM-DD.html that opens in a browser as a printable page showing the text <b>Pen</b> literally (no bold). Save the invoice and tap "Export all (CSV)": a .csv with one row per item opens correctly in a spreadsheet. The 🖨️ button on a saved invoice exports that invoice as HTML.

## Days Counter
- id: days
- category: calculate
- plan: free
- needs: storage
- what: Shows the days between two dates with a weeks and years/months/days breakdown, adds or subtracts any number of days from a date (with the weekday), and keeps a list of named events with a live countdown. A clock button in the header keeps the results you settle on (the last 200 on the device) with a copy button.
- test:
  1. Set From 2024-01-01 and To 2024-03-01: shows 60 days, 8 w 4 d, 0y 2m 0d.
  2. Swap the dates (To earlier than From): the label says "To is earlier" and the same number of days is shown.
  3. Start 2024-02-28, 2 days, tap Add: 2024-03-01 (Friday). Tap Subtract: 2024-02-26.
  4. Save an event "Trip" a week from now: "in 7 days". Save one in the past: "N days ago". Save one today: "Today".
  5. Close and reopen: the events are still listed. Delete one with the cross.
  6. History: change the "To" date and wait 2 seconds: the clock button appears and lists "Days from ... to ..."; pressing Add or Subtract lists the date it gives. Opening the tool adds nothing.

## Tally Counter
- id: tally
- category: calculate
- plan: free
- needs: storage
- what: A tally counter with very large plus and minus buttons, a configurable step and a light vibration on each tap. Keep several named counters, switch between them by tapping, and everything is saved on the device. Reset and delete ask for a second tap. Counters can be exported as a CSV file.
- test:
  1. Tap + three times then - once: shows 2 (the phone vibrates briefly on each tap).
  2. Set Step to 5 and tap +: the value goes up by 5.
  3. Tap Reset once: a toast asks to tap again. Tap again within 3 seconds: value is 0. Wait more than 3 seconds between taps: it does not reset.
  4. Type a name, tap Add: a new counter is selected. Tap the first counter in the list: its own value shows.
  5. Close and reopen the tool: all counters and values are kept. Delete a counter with the cross (needs a second tap); the last remaining counter has no delete button.
  6. Export: tap "Export CSV": the share sheet opens with tally-YYYY-MM-DD.csv (Counter, Value) listing every counter, which opens correctly in a spreadsheet.

## Random
- id: random
- category: calculate
- plan: free
- needs: none
- what: Draws random numbers in a range (one or many, optionally without repeats until the range is exhausted), picks one item from a list or shuffles the list, and picks a random date between two dates with its weekday. Uses the secure random generator.
- test:
  1. Min 1, Max 6, tap Draw several times: always a whole number 1 to 6.
  2. Min 1, Max 3, How many 5, "No repeats" ticked: shows 3 different numbers only (the range is used up). Tapping Draw again says all numbers are drawn; "Reset no-repeat list" clears it.
  3. Min 10 and Max 1 (reversed): still works, giving a number from 1 to 10.
  4. Enter three names, tap Pick one: one of them is shown. Tap Shuffle: the lines are reordered. With an empty list a message asks to add items.
  5. Pick a random date between two dates: a date inside the range and its weekday appear.

## Percentage
- id: percent
- category: calculate
- plan: free
- needs: none
- what: Four quick percentage calculators on one screen: X% of Y, X is what percent of Y, percent change between two values, and add or subtract a percentage from a value. A clock button in the header keeps the results you settle on (the last 200 on the device) with a copy button.
- test:
  1. 15% of 200 shows 30.
  2. 30 is what % of 120 shows 25%.
  3. From 80 to 100 shows "Increase 25%"; from 100 to 80 shows "Decrease 20%".
  4. Value 250 and 12%: plus 280, minus 220, percent itself 30.
  5. "X is what % of Y" with Y = 0 and "percent change" from 0 show the prompt instead of an error.
  6. History: change a value (type a new number), wait 2 seconds: the clock button appears in the header. Open it: the result is listed with what was calculated and the answer, and its copy button copies it. Opening the tool without typing adds nothing, and an empty or invalid input is never added.

## Discount & GST
- id: gst
- category: calculate
- plan: free
- needs: none
- what: Final price after a discount and tax (GST or VAT). Works when the entered price excludes tax (tax is added) or includes tax (tax is split out). Shows what you save, the price before tax and the tax amount. A clock button in the header keeps the results you settle on (the last 200 on the device) with a copy button.
- test:
  1. Price 1000, discount 10%, tax 18%, "Without tax": final price 1,062.00, you save 100.00, tax 162.00.
  2. Price 1180, discount 0, tax 18%, "Including tax": price before tax 1,000.00, tax 180.00, final 1,180.00.
  3. Discount above 100 or a negative number shows the prompt, not a wrong result.
  4. History: change a value (type a new number), wait 2 seconds: the clock button appears in the header. Open it: the result is listed with what was calculated and the answer, and its copy button copies it. Opening the tool without typing adds nothing, and an empty or invalid input is never added.

## Tip Splitter
- id: tip
- category: calculate
- plan: free
- needs: none
- what: Splits a restaurant bill between any number of people with a tip percentage, and can round each person's share up to a whole number. A clock button in the header keeps the results you settle on (the last 200 on the device) with a copy button.
- test:
  1. Bill 1200, tip 10%, 4 people, Exact: each pays 330.00, tip total 120.00.
  2. Bill 100, tip 15%, 3 people, "Round each share up": each pays 39.00, total 117.00, tip total 17.00.
  3. People 0 or blank shows the prompt instead of dividing by zero.
  4. History: change a value (type a new number), wait 2 seconds: the clock button appears in the header. Open it: the result is listed with what was calculated and the answer, and its copy button copies it. Opening the tool without typing adds nothing, and an empty or invalid input is never added.

## Age Calculator
- id: age
- category: calculate
- plan: free
- needs: none
- what: Exact age in years, months and days from a date of birth (on today or any chosen date), total days, weeks and months lived, the weekday of birth and the countdown to the next birthday. A clock button in the header keeps the results you settle on (the last 200 on the device) with a copy button.
- test:
  1. Date of birth 1995-06-15, "Age on" 2026-10-06: shows 31 years 3 months 21 days, next birthday in 252 days (turning 32).
  2. Set "Age on" to a birthday itself: it says "Today! Turning N".
  3. Birth date 2000-02-29: it works in non-leap years (birthday counts as Mar 1).
  4. The date fields accept 1900 to 2200 only; a date outside that shows an "Earliest is..." or "Latest is..." message.
  4. Set "Age on" earlier than the birth date: shows the prompt, no error.
  5. History: change a value (type a new number), wait 2 seconds: the clock button appears in the header. Open it: the result is listed with what was calculated and the answer, and its copy button copies it. Opening the tool without typing adds nothing, and an empty or invalid input is never added.

## Investment
- id: invest
- category: calculate
- plan: free
- needs: none
- what: Two calculators. Lump-sum compound interest with yearly, half-yearly, quarterly or monthly compounding, and the future value of a monthly SIP (instalments at the start of each month). Both show a year-by-year growth table. A clock button in the header keeps the results you settle on (the last 200 on the device) with a copy button.
- test:
  1. Lump sum 1000, 10%, 2 years, Yearly: final value 1,210.00.
  2. Lump sum 1000, 12%, 1 year, Monthly: about 1,126.83.
  3. SIP 5000 per month, 12%, 10 years: future value about 1,161,695, invested 600,000.
  4. Set return to 0 for the SIP: value equals the amount invested.
  5. Years 0 or empty: shows the prompt.
  6. History: change a value (type a new number), wait 2 seconds: the clock button appears in the header. Open it: the result is listed with what was calculated and the answer, and its copy button copies it. Opening the tool without typing adds nothing, and an empty or invalid input is never added.

## Scientific
- id: sci
- category: calculate
- plan: free
- needs: none
- what: Scientific calculator with brackets, sin/cos/tan and inverses in degrees or radians, log, ln, square root, power, factorial, pi, e, percent, Ans and memory keys (MC, MR, M+, M-). Uses a hand-written expression parser (no eval) and shows a live preview of the result. A clock button in the header keeps the results you settle on (the last 200 on the device) with a copy button.
- test:
  1. Type 7 x 6 and tap =: shows 42. Then tap Ans, + and 1: preview 43.
  2. In DEG, sin(30) gives 0.5, cos(60) gives 0.5, tan(90) shows an "Undefined" error. Tap DEG to switch to RAD: sin(pi/2) gives 1.
  3. 2^3^2 = 512, -2^2 = -4, 5! = 120, sqrt(144) = 12, log(1000) = 3, ln(e) = 1.
  4. 1/0 and sqrt(-1) show an error in red, nothing crashes. A missing closing bracket is accepted.
  4a. A decimal comma works: type 0,5+1 and the preview shows 1.5 (or 1,5 in a comma locale). Tap = on 1/3 then tap +, 1, =: the box shows plain digits and the sum works.
  5. M+ stores the current result (shown as "M = ..." at the top), MR inserts it, MC clears it. Tap the display to type with the keyboard.
  6. History: type sqrt(16)+2 and press = (or Enter): the clock button appears and lists "sqrt(16)+2" with 6; copy works. Live typing before = adds nothing. Trig results are labelled [DEG] or [RAD].

## Fuel Cost
- id: fuel
- category: calculate
- plan: free
- needs: none
- what: Trip fuel and cost from distance, efficiency (km/L, L/100 km or mpg) and fuel price, plus a second calculator that finds your mileage from distance driven and fuel used. A clock button in the header keeps the results you settle on (the last 200 on the device) with a copy button.
- test:
  1. 250 km at 15 km/L and price 100: fuel 16.67 L, cost 1,666.67.
  2. Change the unit to L/100 km and enter 8: efficiency shows 12.50 km/L.
  3. Unit mpg with 30: efficiency about 12.75 km/L.
  4. Mileage: 420 km with 30 L gives 14.00 km/L and 7.14 L per 100 km.
  5. Efficiency 0 shows the prompt.
  6. History: change a value (type a new number), wait 2 seconds: the clock button appears in the header. Open it: the result is listed with what was calculated and the answer, and its copy button copies it. Opening the tool without typing adds nothing, and an empty or invalid input is never added.

## Marks & GPA
- id: marks
- category: calculate
- plan: free
- needs: none
- what: Adds up exam marks (one subject per line, optionally as 42/50) into a total and percentage with a typical grade, and computes a credit-weighted GPA from letter grades or grade points. Inputs are remembered. A clock button in the header keeps the results you settle on (the last 200 on the device) with a copy button.
- test:
  1. Default marks (85, 72, 91, 42/50 with max 100): total 290 / 350, 82.857%.
  2. GPA lines "A 3" and "B 4": GPA 3.43 with 7 credits.
  3. Add a line of garbage text: it is ignored, the rest still calculates.
  4. Empty box shows the prompt.
  5. History: change a value (type a new number), wait 2 seconds: the clock button appears in the header. Open it: the result is listed with what was calculated and the answer, and its copy button copies it. Opening the tool without typing adds nothing, and an empty or invalid input is never added.

## Time Calc
- id: timecalc
- category: calculate
- plan: free
- needs: none
- what: Adds and subtracts durations typed as 1:30, 2h 15m, 90m or 45s (a leading minus subtracts), and works out the hours between two clock times with an unpaid break, including shifts past midnight. A clock button in the header keeps the results you settle on (the last 200 on the device) with a copy button.
- test:
  1. Default list (1:30, 2h 15m, -0:45): total 3:00, decimal hours 3.
  2. Add a line "abc": a note says one line was not understood; the total is unchanged.
  3. Start 09:00, End 17:30, break 30: worked 8:00.
  4. Start 22:00, End 06:00: 8:00 and a "passes midnight" note.
  5. Break longer than the shift shows an error message.
  6. History: change a value (type a new number), wait 2 seconds: the clock button appears in the header. Open it: the result is listed with what was calculated and the answer, and its copy button copies it. Opening the tool without typing adds nothing, and an empty or invalid input is never added.

## Work Days
- id: workdays
- category: calculate
- plan: free
- needs: none
- what: Finds the date after N working days (skipping weekends, negative numbers go backwards) and counts working days between two dates. The weekend can be Sat+Sun, Fri+Sat or Sun only. A clock button in the header keeps the results you settle on (the last 200 on the device) with a copy button.
- test:
  1. Start Friday 2024-01-05, 1 working day: Monday 2024-01-08.
  2. Start 2024-01-01, 10 working days: 2024-01-15.
  3. Working days from 2024-01-01 to 2024-01-12: 10 (both dates included).
  4. Choose "Fri + Sat" weekend: the result skips Fridays and Saturdays instead.
  5. End date before start date shows the prompt.
  6. History: change a value (type a new number), wait 2 seconds: the clock button appears in the header. Open it: the result is listed with what was calculated and the answer, and its copy button copies it. Opening the tool without typing adds nothing, and an empty or invalid input is never added.

## Salary Convert
- id: pay
- category: calculate
- plan: free
- needs: none
- what: Converts pay between hourly, daily, weekly, monthly and yearly using your hours per week, weeks per year and days per week. A clock button in the header keeps the results you settle on (the last 200 on the device) with a copy button.
- test:
  1. 25 per hour, 40 h/week, 52 weeks: per year 52,000.00, per month 4,333.33, per week 1,000.00, per day 200.00.
  1a. Hours per week above 168, weeks above 53 or days above 7 are flagged with a "Maximum is..." message and the result asks for a value in range.
  2. Change "Per" to Year and enter 60,000: per hour 28.85.
  3. Hours per week 0 shows the prompt.
  4. History: change a value (type a new number), wait 2 seconds: the clock button appears in the header. Open it: the result is listed with what was calculated and the answer, and its copy button copies it. Opening the tool without typing adds nothing, and an empty or invalid input is never added.

## Loan Compare
- id: loancmp
- category: calculate
- plan: free
- needs: none
- what: Compares two loan offers for the same amount (rate and months for each): EMI, total interest, total cost, and which offer is cheaper by how much. A clock button in the header keeps the results you settle on (the last 200 on the device) with a copy button.
- test:
  1. Defaults (1,000,000; A 9% 120 months; B 8.5% 144 months): the table shows both EMIs and totals and names the cheaper offer with the difference.
  2. Make both offers identical: shows "Same total cost".
  3. Months 0 shows the prompt.
  4. History: change a value (type a new number), wait 2 seconds: the clock button appears in the header. Open it: the result is listed with what was calculated and the answer, and its copy button copies it. Opening the tool without typing adds nothing, and an empty or invalid input is never added.

## Fractions
- id: fraction
- category: calculate
- plan: free
- needs: none
- what: Adds, subtracts, multiplies and divides fractions, mixed numbers (1 1/2), decimals and whole numbers, giving a simplified fraction, mixed number, decimal and percent. A clock button in the header keeps the results you settle on (the last 200 on the device) with a copy button.
- test:
  1. 3/4 + 2/3 = 17/12, mixed number 1 5/12.
  2. 1/2 - 1/3 = 1/6; 2/3 x 3/4 = 1/2; 1/2 / 1/4 = 2.
  3. Enter "1 1/2" and "0.25" with +: result 7/4.
  4. Divide by 0 shows "Cannot divide by zero"; typing "abc" shows a prompt.
  5. History: change a value (type a new number), wait 2 seconds: the clock button appears in the header. Open it: the result is listed with what was calculated and the answer, and its copy button copies it. Opening the tool without typing adds nothing, and an empty or invalid input is never added.

## Ratio
- id: ratio
- category: calculate
- plan: free
- needs: none
- what: Simplifies a ratio to lowest terms, solves a proportion (a : b = c : x) and splits an amount in a given ratio. A clock button in the header keeps the results you settle on (the last 200 on the device) with a copy button.
- test:
  1. 24 : 36 simplifies to 2 : 3.
  2. Proportion 3 : 5 = 12 : x gives x = 20.
  3. Split 1000 as 2 : 3: A gets 400.00 and B gets 600.00.
  4. Decimals in the simplify box show "Use whole numbers".
  5. History: change a value (type a new number), wait 2 seconds: the clock button appears in the header. Open it: the result is listed with what was calculated and the answer, and its copy button copies it. Opening the tool without typing adds nothing, and an empty or invalid input is never added.

## Statistics
- id: stats
- category: calculate
- plan: free
- needs: none
- what: Paste or type a list of numbers (spaces, commas or new lines) and get count, sum, mean, median, mode, min, max, range, population and sample standard deviation and variance. A clock button in the header keeps the results you settle on (the last 200 on the device) with a copy button.
- test:
  1. Default list: mean 16.57, median 15, mode 8, range 38.
  2. 2 4 4 4 5 5 7 9: population std dev 2, sample std dev 2.1380899, median 4.5, mode 4.
  3. 1 2 3 4: mode shows "none".
  4. A single number: sample deviation shows a dash. Text with stray letters is skipped.
  5. History: change a value (type a new number), wait 2 seconds: the clock button appears in the header. Open it: the result is listed with what was calculated and the answer, and its copy button copies it. Opening the tool without typing adds nothing, and an empty or invalid input is never added.

## Prime Check
- id: prime
- category: calculate
- plan: free
- needs: none
- what: Tells whether a whole number is prime, shows its prime factorisation, its divisors (for numbers up to a billion) and the next and previous prime.
- test:
  1. 360 gives composite, factors 2^3 × 3^2 × 5, 24 divisors.
  2. 97 gives "Yes, prime", next prime 101, previous 89.
  3. 999999937 is reported prime almost instantly.
  4. 1, a decimal or a negative number shows the prompt.

## GCD & LCM
- id: gcdlcm
- category: calculate
- plan: free
- needs: none
- what: Greatest common divisor (HCF) and least common multiple of two or more whole numbers. A clock button in the header keeps the results you settle on (the last 200 on the device) with a copy button.
- test:
  1. 12, 18, 30 gives GCD 6 and LCM 180.
  2. 4 6 10 gives GCD 2 and LCM 60.
  3. A single number, a zero or a decimal shows the prompt.
  4. History: change a value (type a new number), wait 2 seconds: the clock button appears in the header. Open it: the result is listed with what was calculated and the answer, and its copy button copies it. Opening the tool without typing adds nothing, and an empty or invalid input is never added.

## Quadratic
- id: quad
- category: calculate
- plan: free
- needs: none
- what: Solves ax² + bx + c = 0 with real, repeated or complex roots, the discriminant and the vertex of the parabola. Also handles the linear case when a is 0. A clock button in the header keeps the results you settle on (the last 200 on the device) with a copy button.
- test:
  1. a=1, b=-3, c=2: roots 1 and 2, discriminant 1, vertex (1.5, -0.25).
  2. a=1, b=2, c=1: one double root -1.
  3. a=1, b=0, c=1: roots 0 + 1i and 0 - 1i.
  4. a=0, b=2, c=-4: "Linear: x = 2". a=0 and b=0 shows a message.
  5. History: change a value (type a new number), wait 2 seconds: the clock button appears in the header. Open it: the result is listed with what was calculated and the answer, and its copy button copies it. Opening the tool without typing adds nothing, and an empty or invalid input is never added.

## Area & Volume
- id: shapes
- category: calculate
- plan: free
- needs: none
- what: Area, perimeter, surface area, volume and diagonals for square, rectangle, triangle, circle, trapezoid, ellipse, cube, cuboid, cylinder, sphere, cone and square pyramid. A clock button in the header keeps the results you settle on (the last 200 on the device) with a copy button.
- test:
  1. Rectangle 10 by 5: area 50, perimeter 30, diagonal 11.18034.
  2. Circle radius 1: area 3.1415927, circumference 6.2831853.
  3. Sphere radius 3: volume 113.09734. Cone radius 3 height 4: slant height 5.
  4. Change shape: the input boxes change to match. Zero or empty values show a prompt.
  5. History: change a value (type a new number), wait 2 seconds: the clock button appears in the header. Open it: the result is listed with what was calculated and the answer, and its copy button copies it. Opening the tool without typing adds nothing, and an empty or invalid input is never added.

## Triangle
- id: triangle
- category: calculate
- plan: free
- needs: none
- what: Solves a triangle from three sides, or from two sides and the angle between them. Gives all three angles, type (scalene/isosceles/equilateral, acute/right/obtuse), area, perimeter, inradius and circumradius. A clock button in the header keeps the results you settle on (the last 200 on the device) with a copy button.
- test:
  1. Sides 3, 4, 5: angles 36.8699, 53.1301, 90 degrees, area 6, type "scalene, right".
  2. Sides 1, 2, 3: message that they cannot form a triangle.
  3. Switch to "Two sides and the angle": 3, 4 and 90 degrees gives side c = 5.
  4. Angle 0 or 180 shows an error message.
  5. History: change a value (type a new number), wait 2 seconds: the clock button appears in the header. Open it: the result is listed with what was calculated and the answer, and its copy button copies it. Opening the tool without typing adds nothing, and an empty or invalid input is never added.

## Power Cost
- id: powercost
- category: calculate
- plan: free
- needs: none
- what: Electricity use and cost of an appliance per day, 30-day month and year from its watts, quantity, hours per day and price per kWh. A clock button in the header keeps the results you settle on (the last 200 on the device) with a copy button.
- test:
  1. 1500 W, 1 unit, 2 h/day, 8 per kWh: 3 kWh per day, 24.00 per day, 90 kWh and 720.00 per month, 8,760.00 per year.
  2. Hours per day above 24 shows the prompt.
  3. History: change a value (type a new number), wait 2 seconds: the clock button appears in the header. Open it: the result is listed with what was calculated and the answer, and its copy button copies it. Opening the tool without typing adds nothing, and an empty or invalid input is never added.

## Cooking Units
- id: cooking
- category: calculate
- plan: free
- needs: none
- what: Converts between cups, tablespoons, teaspoons, grams, kilograms, ounces and millilitres for common ingredients (flour, sugar, brown sugar, icing sugar, butter, rice, water/milk, honey, oil, salt, cocoa, oats). A clock button in the header keeps the results you settle on (the last 200 on the device) with a copy button.
- test:
  1. 1 cup of plain flour: 120 g, 16 tablespoons, 48 teaspoons.
  2. 227 g of butter in grams: 1 cup.
  3. Switch ingredient to honey with the same 1 cup: 340 g.
  4. Amount 0 shows the prompt.
  5. History: change a value (type a new number), wait 2 seconds: the clock button appears in the header. Open it: the result is listed with what was calculated and the answer, and its copy button copies it. Opening the tool without typing adds nothing, and an empty or invalid input is never added.

## Size Converter
- id: sizes
- category: calculate
- plan: free
- needs: none
- what: Approximate shoe sizes (UK, US men, US women, EU, foot length in cm), women's clothing sizes (UK, US, EU) and chest or jacket size in inches or cm with an EU size and a letter size. A note reminds that brands differ. A clock button in the header keeps the results you settle on (the last 200 on the device) with a copy button.
- test:
  1. Shoes UK 9: US men 10, US women 11.5, EU about 43.
  2. Foot length 27 cm gives US men 10.
  3. Women's clothing UK 10: US 6, EU 38.
  4. Chest 40 inches: 101.6 cm, EU 50, letter M.
  5. History: change a value (type a new number), wait 2 seconds: the clock button appears in the header. Open it: the result is listed with what was calculated and the answer, and its copy button copies it. Opening the tool without typing adds nothing, and an empty or invalid input is never added.

## Break-even
- id: breakeven
- category: calculate
- plan: free
- needs: none
- what: Units and revenue needed to cover fixed costs from price and variable cost per unit, the contribution margin, and optionally the units needed to reach a profit target. A clock button in the header keeps the results you settle on (the last 200 on the device) with a copy button.
- test:
  1. Fixed 50,000, price 250, variable 150: 500 units, revenue 125,000, profit per unit 100.
  2. Add profit target 20,000: 700 units needed.
  3. Price equal to or below variable cost shows an explanatory message.
  4. History: change a value (type a new number), wait 2 seconds: the clock button appears in the header. Open it: the result is listed with what was calculated and the answer, and its copy button copies it. Opening the tool without typing adds nothing, and an empty or invalid input is never added.

## Markup & Margin
- id: margin
- category: calculate
- plan: free
- needs: none
- what: Profit, margin and markup from cost and selling price, and the selling price you need for a target margin (of price) or markup (on cost). A clock button in the header keeps the results you settle on (the last 200 on the device) with a copy button.
- test:
  1. Cost 80, price 100: margin 20%, markup 25%, profit 20.
  2. Cost 80, 25% margin: price 106.67. Cost 80, 25% markup: price 100.
  3. A margin of 100% or more shows the prompt.
  4. History: change a value (type a new number), wait 2 seconds: the clock button appears in the header. Open it: the result is listed with what was calculated and the answer, and its copy button copies it. Opening the tool without typing adds nothing, and an empty or invalid input is never added.

## Simple Interest
- id: interest
- category: calculate
- plan: free
- needs: none
- what: Simple interest and total amount for a principal, annual rate and time given in years, months or days. A clock button in the header keeps the results you settle on (the last 200 on the device) with a copy button.
- test:
  1. 50,000 at 7% for 3 years: interest 10,500.00, total 60,500.00.
  2. Change time to 6 months at the same inputs (time 6): interest 1,750.00.
  3. Negative values show the prompt.
  4. History: change a value (type a new number), wait 2 seconds: the clock button appears in the header. Open it: the result is listed with what was calculated and the answer, and its copy button copies it. Opening the tool without typing adds nothing, and an empty or invalid input is never added.

## FD / RD
- id: fdrd
- category: calculate
- plan: free
- needs: none
- what: Maturity amount of a fixed deposit with quarterly, monthly, half-yearly or yearly compounding, and of a monthly recurring deposit with quarterly compounding, showing the interest earned. A clock button in the header keeps the results you settle on (the last 200 on the device) with a copy button.
- test:
  1. FD 100,000 at 7% for 5 years, quarterly: maturity about 141,478.
  2. RD 5,000 per month at 6.5% for 24 months: maturity a little above 120,000 deposited (interest roughly 8,000).
  3. Zero months or years shows the prompt.
  4. History: change a value (type a new number), wait 2 seconds: the clock button appears in the header. Open it: the result is listed with what was calculated and the answer, and its copy button copies it. Opening the tool without typing adds nothing, and an empty or invalid input is never added.

## Net Worth
- id: networth
- category: calculate
- plan: free
- needs: none
- what: Type assets and debts, one per line with the amount at the end of the line, and see total assets, total debts and net worth. Lists are remembered on the device. A clock button in the header keeps the results you settle on (the last 200 on the device) with a copy button.
- test:
  1. Defaults: assets 450,000, debts 120,000, net worth 330,000.
  2. Amounts with commas (1,500) and decimals (80.50) are read correctly; lines without a number are ignored.
  3. Close and reopen: the lists are still there.
  4. History: change a value (type a new number), wait 2 seconds: the clock button appears in the header. Open it: the result is listed with what was calculated and the answer, and its copy button copies it. Opening the tool without typing adds nothing, and an empty or invalid input is never added.

## Growth Rate
- id: cagr
- category: calculate
- plan: free
- needs: none
- what: Compound annual growth rate between a start and end value over a number of years, with total growth and the time to double. A clock button in the header keeps the results you settle on (the last 200 on the device) with a copy button.
- test:
  1. 10,000 to 18,000 over 5 years: about 12.47% per year, total growth 80%.
  2. 100 to 200 over 1 year: 100% per year.
  3. Zero or negative values show the prompt.
  4. History: change a value (type a new number), wait 2 seconds: the clock button appears in the header. Open it: the result is listed with what was calculated and the answer, and its copy button copies it. Opening the tool without typing adds nothing, and an empty or invalid input is never added.

## Number Words
- id: numwords
- category: calculate
- plan: free
- needs: none
- what: Writes a number out in words (for cheques and invoices) using the Indian system (lakh, crore) or the international system (million, billion), including negatives and two decimal places. A clock button in the header keeps the results you settle on (the last 200 on the device) with a copy button.
- test:
  1. 123456789 Indian: "Twelve crore thirty-four lakh fifty-six thousand seven hundred eighty-nine".
  2. Same number International: "One hundred twenty-three million four hundred fifty-six thousand seven hundred eighty-nine".
  3. 12.5 gives "... and fifty hundredths"; -5 starts with "Minus".
  4. 0 gives "Zero". A number of one quadrillion or more shows the prompt.
  5. History: change a value (type a new number), wait 2 seconds: the clock button appears in the header. Open it: the result is listed with what was calculated and the answer, and its copy button copies it. Opening the tool without typing adds nothing, and an empty or invalid input is never added.

