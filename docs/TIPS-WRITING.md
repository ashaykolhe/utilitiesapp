# Tip of the Day: writing rules

Tips live in `www/js/data/tips-*.js`. Each file adds a list with `(window.TIPS_PARTS = window.TIPS_PARTS || []).push([ ['text', 'Label'], ... ]);`.

- Text is one or two short sentences, at most 150 characters, plain language, no emoji, no hashtags, no links, no brand names.
- Label is one of: Tip, Health tip, Money tip, Phone tip, Safety tip, Home tip, Food tip, Study tip, Work tip, Travel tip, Kindness, Proverb, Saying.
- Never state medical, legal, tax or investment advice as fact. Wellbeing tips stay general and gentle ("many people find...", "try...").
- Proverbs and sayings must be genuinely traditional and widely known. No invented attributions and no quotes credited to a named person (those belong in the Quotes tools).
- Safe for all ages, no politics, no religion, no insults, nothing about dieting to lose weight, nothing that could encourage risk.
- No duplicates (case-insensitive) within or across files; `npm run test:tips` checks this.
