# Releasing PocketKit

Same setup as the Daytick project.

```bash
npm run release              # minified, signed .aab for Google Play -> android/app/build/outputs/bundle/release/app-release.aab
npm run release:phone-test   # a DEBUG apk with the exact release web bytes and R8 shrinking (adb install -r ...)
```

`npm run release` stops (and says why) unless: the minified copy parses with no comments left; none of the plaintext trial codes from
`coupon-codes.txt` appears in the shipped files (only hashes ship); the build is not debuggable (the debug-only Pro override and the 10-minute dev coupon stay inert);
and `android/keystore.properties` exists (an unsigned bundle is rejected by Play).

## Signing (one time)
1. `keytool -genkeypair -v -keystore android/pocketkit-release.jks -alias pocketkit -keyalg RSA -keysize 2048 -validity 10000` and back the file and passwords up somewhere safe.
2. Copy `android/keystore.properties.example` to `android/keystore.properties` and fill it in (both are gitignored).
3. Use Play App Signing in Play Console.

## Before each upload
- Bump `versionCode` and `versionName` in `android/app/build.gradle`.
- Run `npm run release:phone-test` and click through `docs/MANUAL-TEST.md` on a phone.
- Play Console: the in-app product `pocketkit_pro` (one-time purchase), the privacy policy URL (host `docs/privacy-policy.html`, e.g. with GitHub Pages from the `/docs` folder), and the data-safety form (no data collected).
- Fill in the contact email in `docs/privacy-policy.html`, then run `npm run docs`.
- Regenerate coupons with `npm run coupons` when the schedule runs out; hand out the code whose window covers today. Keep `coupon-codes.txt` private.
