# Audit findings: calculators and text tools (www/js/tools/calc.js, text.js)

Source: read-only audit, October 2026 (ids are tool ids).

1. HIGH sci: '=', Enter and MR write sig(r,12) (toLocaleString) back into the expression, so decimal-comma locales get '0,333...' and the parser fails. Use String(+r.toPrecision(12)) for anything entering the expression; sig for display only. Also: remove inputmode="none" or drop the hint; '50+10%' must give 55; after '=' a digit starts a new expression.
2. HIGH json: Pretty/Minify via JSON.stringify(JSON.parse(x)) corrupts big numbers (12345678901234567890), 1.0, 1E2 and key order. Rebuild from the token stream jsonCheck walks, copying number/string literals verbatim, changing only whitespace. Test: {"id":12345678901234567890,"v":1.0,"2":1,"1":2,"e":1E2}.
3. HIGH regex: catastrophic backtracking ((a+)+$ on 26 a's + '!' = 5.6 s, freezes the WebView). Run match/replace in a Worker from a Blob URL, terminate after ~1 s ('Pattern too slow'); debounce input; run replace once.
4. quad and L.sig/L.fx: negative zero shows '-0': Object.is(n,-0) -> 0; fx zeroes values smaller than 0.5*10^-d.
5. numwords: 1.999 and 0.995 give 100 hundredths: cents = Math.round(a*100+1e-6), whole = floor(cents/100), frac = cents%100.
6. billing: round each line with L.r2(q*p) before summing; re-saving an edited invoice keeps its date.
7. texttools/cases/freq: Indic/combining marks split: use [\p{L}\p{N}\p{M}]+; slug strips only [̀-ͯ] after NFD.
8. hash: cap file size (~50 MB) with a clear message, try/catch around digests.
9. prime: trial division up to 9e15 on every keystroke: Analyse button or debounce; cap neighbour/divisor search (~1e12) or BigInt Miller-Rabin.
10. notes: 'New' saved an empty note immediately (ghost notes count toward the free limit): add on first edit; cleanup drops empty notes and flushes saves. Keep proLimit('notes')/needPro('notes').
11. notes: every keystroke Store.set on all notes: debounce ~400 ms, flush on Done and cleanup, cap note body 50,000 chars, warn once when storage is full.
12. stats and numsort: '1,000, 2,500' parses wrongly and '1-2-3' as [1,-2,-3]: split on whitespace/semicolons/newlines, comma only when followed by space/newline, reject tokens not matching ^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$ and report the bad token.
13. timecalc: accept '2 hours 15 minutes', '15 minutes', '30 seconds', '1h30'.
14. days: range-check the day count (abs <= 2.9e6 or finite date) so NaN-NaN-NaN/undefined never show.
15. fraction: intermediate products exceed 2^53: BigInt or null with a message when not a safe integer.
16. marks: add D- 0.7 and E/FX 0 and show 'N lines not understood'; networth: amount is the number at the END of the line (so 'Phone 2024-25' is not -25).
17. tally: font size by digit count (clamp(28px,15vw,72px), word-break:break-all).
18. checklist: 44px checkbox hit area (label wrapper).
19. notes and tally list rows with role="button" tabindex="0" need Enter/Space handlers.
21. csv: duplicate headers get _2; replace Math.max(...spread) with reduce.
22. markdown: protect URLs with placeholders before bold/italic passes.
23. morse: vibrate patterns truncated at ~99 entries: chunk or document.
24. piglatin tokenise with [A-Za-z]+(?:'[A-Za-z]+)*; nato and braille: 'unsupported characters ignored'; braille ')' decoding as '('.
25. invest/fdrd: cap rate at 200% (or result 1e15), word-break:break-all on result cells.
26. sizes: shoe conversion consistent both ways (lookup table).
27. age: 29 February birthday treated as 1 March in non-leap years consistently.
