# Quotes: sourcing policy

PocketKit has two quote tools. Their text lives in `www/js/data/` and the engine is `www/js/tools/quotes.js`.

## Real Quotes (`quotes-real.js`, 567 quotes, 146 authors, 16 categories)
Only genuine quotes where both the **author and the wording** are well documented. A wrong attribution counts as a bug.

- Format: `['text', 'Author Name', 'categoryId', 'optional source (work or speech, year)']`. 450 of 567 have a source.
- Short quotes only (at most about 35 words). Proverbs are credited as `Proverb` / `Japanese proverb` / `Chinese proverb`.
- Ancient and translated authors (Marcus Aurelius, Seneca, Epictetus, Confucius, Lao Tzu, Sun Tzu) follow common English translations, so wording differs slightly between editions.
- **Deliberately left out** (famous but misattributed or unreliable): Gandhi "Be the change", Einstein "Insanity..." and "Everybody is a genius", "Well-behaved women...", Burke "triumph of evil", Roosevelt "Do one thing every day that scares you", Twain "Twenty years from now", Wilde "Be yourself", "You miss 100% of the shots", Ford "Whether you think you can...", "If you want to go fast...", Einstein "Not everything that counts", Hepburn "Impossible", and a long list of Churchill, Edison, Lincoln, Aristotle, Plato, Eleanor Roosevelt, Twain, C. S. Lewis, Angelou, Jordan, Ruth and Dr. Seuss lines whose attribution is weak. See the test for the enforced blacklist.
- Quotes kept with a thinner paper trail, worth a spot check before a big marketing push: a few Michael Jordan lines, Marie Curie "Nothing in life is to be feared", Amelia Earhart, John Wooden, Muhammad Ali, Steve Jobs interview quotes and one Edison line.
- To add quotes: append to `REAL_QUOTES`, then run `npm run test:quotes`. It fails on duplicates, unknown categories, long quotes, blacklisted misattributions, fewer than 30 per category, or fewer than 500 in total.

## Goofy Quotes (`quotes-goofy.js`, 812 quotes, 14 categories, plus the Mixer)
All original, warm and family friendly: no swearing, no insults, no real people or brands.

- `GOOFY_QUOTES` is `['text', 'categoryId']`. `GOOFY_GEN` holds 79 templates and 18 word banks (millions of combinations; about 17,700 distinct results in 20,000 draws). Bank entries carry their own article ("a llama"), and no template writes `a {x}`.
- To add: edit the arrays, then run `npm run test:quotes`. It checks duplicates, length, braces, doubled words, empty or duplicate bank entries, the number of distinct Mixer results and a basic word blacklist (not a full moderation pass: read new lines yourself).
