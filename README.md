# PocketKit

Every everyday utility in one offline Android app: calculators, converters, sensors, measuring tools, audio and camera tools, health, security, games and more.
Plain HTML / CSS / vanilla JavaScript in `www/`, wrapped for Android with Capacitor.

## Files that matter
| Path | What |
|---|---|
| `www/` | The app. `js/core.js` (registry and helpers), `js/pro.js` (Pro and coupons), `js/app.js` (screens), `js/tools/*.js` (one file per group of tools). |
| `docs/TOOL-GUIDE.md` | How to write a tool. |
| `docs/FEATURES.md` | Description of every feature (kept up to date). |
| `docs/MANUAL-TEST.md` | Manual test checklist for the phone. |
| `docs/privacy-policy.html` | Privacy policy (kept up to date; `npm run docs` copies it into the app). |
| `docs/ROADMAP.md` | Ideas not built yet. |
| `RELEASE.md` | Building and signing a release. |
| `tools/generate-coupons.js` | Makes the trial coupons (`coupon-codes.txt` stays private and is never committed). |

## Run
```bash
npm run serve        # the app in a desktop browser at http://localhost:5173
npm run sync         # copy www/ into the Android project
npm run android      # open Android Studio
```
Debug build on a phone: `cd android && ./gradlew assembleDebug`, then `adb install -r app/build/outputs/apk/debug/app-debug.apk`.
