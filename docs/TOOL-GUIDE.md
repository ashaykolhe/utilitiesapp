# PocketKit: how to write a tool

PocketKit is a plain HTML / CSS / vanilla JS app (no framework, no bundler) wrapped with Capacitor for Android.
Every tool is one `Tools.register({...})` call inside a file in `www/js/tools/`. Scripts share globals (no modules).

## Registering a tool

```js
Tools.register({
  id: 'emi',                 // unique, lowercase, no spaces
  name: 'EMI Calculator',    // shown under the icon (keep it short, max ~16 chars)
  icon: '🏦',                // one emoji
  cat: 'calculate',          // daily | navigate | measure | calculate | text | audio | camera | health | security | connect | create | fun
  desc: 'One sentence saying what the tool does, for the feature list.',
  keys: ['loan', 'interest'],// extra search words (optional)
  needs: ['storage'],        // device features used: camera, microphone, location, motion, notifications, storage, network (or [])
  pro: false,                // true = the whole tool is Pro (a lock shows on the tile; opening it shows the Pro sheet). Add proKey: 'motion' to pick which Pro feature the sheet highlights.
  render(el) {               // build the UI inside `el`; return a cleanup function (or nothing)
    el.innerHTML = `...`;
    return () => { /* stop timers, sensors, streams, listeners, audio contexts */ };
  }
});
```

The cleanup function is called when the user leaves the tool. Always stop what you start: camera and microphone streams
(`track.stop()`), `setInterval`, `requestAnimationFrame`, `watchPosition`, event listeners added on `window`, `AudioContext.close()`.

## Globals you can use (see `www/js/core.js`)

| Name | What |
|---|---|
| `$('#id', el)` / `$$('.x', el)` | `querySelector` / `querySelectorAll` as an array. Always pass `el` as the root so tools do not clash. |
| `h(html)` | Turn an HTML string into one element. |
| `esc(str)` | HTML-escape. **Escape every user-provided string you put into `innerHTML`.** |
| `pad(n, w)` | Zero pad. |
| `toast(msg)` | Short message at the bottom. |
| `Store.get(key, default)` / `Store.set(key, value)` | JSON in `localStorage` (prefix `pk.`). For small data only. Use IndexedDB for blobs/large data. Prefix your keys with your tool id, e.g. `emi.history`. |
| `beep()` | Short tone + vibration (from `tools/timer.js`). |
| `fmt(ms, withCentis)` | `mm:ss` formatter (from `tools/timer.js`). |

## Pro and free

Free: every everyday utility. Pro: heavy features and higher limits. Free limits live in `FREE` in `www/js/pro.js`:
`pins 4, reminders 3, notes 10, recordings 3, routes 1, locker 3, vault 5`.

```js
if (items.length >= proLimit('notes') && needPro('notes')) return;  // proLimit() is Infinity for Pro users
```
`needPro(key)` returns `true` (and opens the Pro sheet) if the user is not Pro, so the pattern above stops the action.
Use only those keys: `connect, motion, locker, routes, reminders, notes, recordings, pins, accents`.
Show a small 🔒 on a locked button when `!isPro()`.

## Styling (use the shared classes; do not add global CSS)

Look in `www/css/style.css`. Useful classes: `card`, `btn` (`btn alt`, `btn danger`), `row` (children share the width), `list`, `item` (+ `grow`),
`big` (huge number), `mid`, `muted`, `center`, `keys` (4-column key grid), `progress`, `label.f` (label above an input), `canvas`, `video`.
Colours: use CSS variables only (`var(--accent)`, `var(--surface)`, `var(--surface2)`, `var(--text)`, `var(--muted)`, `var(--line)`, `var(--danger)`, `var(--ok)`)
so dark and light themes both work. For one-off layout use inline `style=""` inside your tool's HTML. Tap targets at least 44px. The app is used on a phone (about 360-420px wide), portrait.

## Rules

* No network calls, no CDN, no analytics, no ads. The app works offline and all data stays on the device. (Pure-local tools only for now.)
* A third-party library is allowed only if vendored: install it with npm into a temp folder, copy the minified file into `www/js/vendor/`, keep its licence header, and add a `<script src="js/vendor/xxx.js">` line to `www/index.html` **before** the tool scripts (the only change you may make to index.html). Prefer writing the small thing yourself.
* Permissions: ask only when the tool is opened/used (the browser permission prompt does that). If denied or no sensor, show a clear message in the tool, never throw.
* Works inside the Android WebView (Chrome): `getUserMedia`, `Geolocation`, `DeviceOrientation`, `DeviceMotion`, `Web Audio`, `MediaRecorder`, `IndexedDB`, `WebCrypto`, `SpeechSynthesis`, `Canvas`, `Vibration`.
* Capacitor plugins you may use via `Capacitor.Plugins`: `LocalNotifications`, `Share`, `Filesystem`, `NativeBiometric`. Always feature-detect and fall back to the web API (the app is also tested in a desktop browser).
* Saving files: create a `Blob` and trigger a download via an `<a download>`; on Android use `Share`/`Filesystem` when `Capacitor.Plugins.Filesystem` exists. Keep this simple and tolerant of failure.
* Input validation: limit lengths (`maxlength`), clamp numbers, handle empty/NaN, never crash on bad input.
* Accessibility: every button has text or `aria-label`; inputs have labels.
* Code style: `'use strict'`, 2-space indent, small functions, comments only where the reason is not obvious.
* Keep each file self-contained. Do not edit files you do not own.

## How to check your work (do NOT use the shared Browser pane or start servers; other builders are working in parallel)

1. `node --check www/js/tools/<yourfile>.js` must pass.
2. Test pure logic (maths, parsing, formatting, encoders) in plain Node by extracting the functions into a temp script in the scratchpad directory and running assertions. Do this for every calculator / encoder.
3. A headless smoke test of `render()` is welcome if cheap (e.g. with jsdom if available), but not required.

## What to deliver

* The tool code in your file(s).
* A notes file `docs/parts/<yourfile>.md` with one section per tool, exactly in this shape (it is merged into FEATURES.md and MANUAL-TEST.md):

```
## EMI Calculator
- id: emi
- category: calculate
- plan: free            (free | pro | free with limit: <what>)
- needs: none           (or: camera, microphone, ...)
- what: Two or three sentences describing the feature for the feature list.
- test:
  1. Concrete manual step with the expected result (3 to 6 steps; include an edge case and, if relevant, the permission-denied case).
```
* Do NOT run `git`. Do not edit `index.html` (except vendor script lines), `app.js`, `core.js`, `pro.js`, CSS or docs other than your notes file.
* Final message: list each tool (id, name, plan) and anything not finished or limited.

## Added after the first builders

* Wrap your whole file in an IIFE `(() => { ... })();` so helper names never clash with other tool files.
* Every tool id, name and emoji must be unique across ALL files in www/js/tools/. Before choosing, grep the other files for your candidate icons and ids (`grep -h "icon:" www/js/tools/*.js`). Names should be 16 characters or fewer.
* Checkboxes/radios and small buttons must still have a hit area of at least 44px (wrap in a label with padding). Every input needs a visible label or aria-label. Use theme variables only, so light and dark both stay readable.
* Escape user text in innerHTML with esc().
