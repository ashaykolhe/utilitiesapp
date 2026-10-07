# PocketKit testing guide

Run everything with these commands from the project folder (no phone needed):

| Command | What it checks |
|---|---|
| `npm test` | Smoke test: loads the whole app, every tool renders, ids/names/emoji are unique, docs match, Home flows (pins, recents, collections, search, scroll position). |
| `npm run test:functional` | **Functional tests** (`tests/functional/*.test.js`): drive real tools like a person (type, click, read the screen) and check answers against known values. |
| `npm run fuzz` | Types hostile input into every field of every tool; finds crashes and NaN/Infinity/undefined output. |
| `npm run audit:inputs` | Every input has limits (min/max/maxlength) and a label. |
| `npm run test:coupons`, `test:drive`, `test:quotes` | Pro coupons, Google Drive backup logic, quote data rules. |
| `node tests/<name>.test.js` | Pure-logic tests of individual tool groups (chess perft, puzzle solvers, crypto vectors...). |

## Writing a functional test

```js
const { boot, suite } = require('../helpers/page');
(async () => {
  const T = suite('emi'), page = await boot();
  const t = await page.open('emi');          // renders the tool in a fresh container
  t.type('#amount', '500000');               // sets the value and fires input + change
  t.click('#go'); t.clickText('Add');        // by selector, or by the visible button text
  await page.wait(30);
  T.has(t.text(), '10,258.27', 'EMI for 500000 at 8.5% over 5 years');
  T.eq(t.value('#out'), '42', 'field value');
  t.close();
  await T.done(page);                        // prints a summary, fails on uncaught page errors, exits with 0/1
})();
```

Rules of thumb:
- Test **behaviour a user relies on**: known-answer calculations (check against an independent calculation or a published value), saving and reloading state, limits and error messages, empty and extreme input, buttons that change what is shown, cleanup (leave the tool and make sure nothing keeps running).
- The harness has stand-ins for the camera/microphone/sensors (they are missing in jsdom), so test those tools' no-permission and no-sensor messages, and their pure logic; real hardware is covered by `docs/MANUAL-TEST.md`.
- A functional test file must run in under about 60 seconds, need no network and leave no files behind.
- When a test finds a bug, fix the tool, keep the test, and mention it in the report.
