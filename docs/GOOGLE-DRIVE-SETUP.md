# Google Drive backup: one-time setup

The app code is done. Google only lets an app sign people in and use Drive after you register the app in Google Cloud. Nothing here costs money.
Until it is done, tapping "Connect Google Drive" says "Google Drive isn't set up in this version yet."

## What the feature does

- Backups live in Drive's hidden **app data folder** (scope `drive.appdata`): they do not show up in the person's Drive file list, only PocketKit can read them, and they do count toward the person's Drive storage.
- **Manual backup and restore are free.** A backup is a small `.json` file with the app's settings and saved tool data (notes, lists, history, colours, pins, collections...).
- **Automatic backup is Pro:** at most once a day, only when something changed, with a silent sign-in (no screen pops up by surprise). If Google needs the person's consent again it stops quietly and shows "Reconnect Google Drive".
- The newest 10 manual and 7 automatic backups are kept; older ones are deleted after each upload.
- Restore (Settings > Google Drive backup > Restore from Google Drive) lists the account's backups (date, manual or automatic, item count, size). Pick one, confirm, and the matching settings and saved data are put back. On a new phone: install PocketKit, connect the same Google account, restore.
- **Not in a backup:** Pro status, the app-lock PIN, voice recordings, locked files and the Password Vault (they live in the phone's database, are encrypted or large). The connection itself is stored outside the backed-up data, so a backup file cannot carry it.
- Sign-in uses Google's Authorization API on the phone (no password or secret in the app). The app also asks for the `email` scope, only to show "Connected as you@gmail.com".

## Steps (Google Cloud Console, console.cloud.google.com)

1. **Create a project** (for example "PocketKit").
2. **Enable the API:** APIs & Services > Library > "Google Drive API" > Enable.
3. **OAuth consent screen** (Google Auth platform > Branding / Audience / Data access):
   - App name "PocketKit", a support email, and your developer contact email.
   - Audience: **External**.
   - Data access / scopes: add `.../auth/drive.appdata` and `.../auth/userinfo.email` (both are non-sensitive scopes, so no Google verification review is needed).
   - While the app is in **Testing**, only the test users you list can sign in. Press **Publish app** (In production) before the public release.
4. **Create an OAuth client ID** (Clients > Create client): type **Android**.
   - Package name: `com.atlasstudio.pocketkit` (change it everywhere first if you ever rename the app id).
   - SHA-1 certificate fingerprint. Create one client per signing key:
     - **debug build (this PC):** `EE:F6:E7:2F:A2:E6:F0:24:B4:FC:66:7C:78:7E:AA:8B:EC:AD:10:D6`
     - **your upload key** (after you create the keystore, see RELEASE.md): `keytool -list -v -keystore android/pocketkit-release.jks -alias pocketkit`
     - **Google Play app signing key:** Play Console > Test and release > App integrity > App signing > "App signing key certificate" SHA-1. This is the one real users get, so the Play build only signs in once this client exists.
   - There is no client ID to paste into the app: Android matches the app by package name plus signing fingerprint.
5. Wait a few minutes for Google to pick the settings up, then install and try Connect.

## Checking it

- Debug build: Settings > Google Drive backup > Connect Google Drive. A Google account chooser and a consent screen appear; then "Back up now" and "Restore from Google Drive" should list the backup.
- A sign-in that fails with "isn't set up in this version yet" almost always means the package name or SHA-1 in the OAuth client does not match the build that is installed (debug vs release vs Play).
- Users can revoke access any time at myaccount.google.com > Security > Third-party access. PocketKit's "Disconnect" only forgets the connection on the phone; the backups stay in the user's Drive until they remove them.
- `npm run test:drive` runs 20 automatic checks of the backup logic against a fake Drive (connect, upload, keep newest, automatic rules, restore, expired token, no network). It cannot test Google's real sign-in.

## Privacy notes for the Play listing

The app sends the user's own settings and saved tool data to the user's own Google Drive, only after they connect and press Back up (or turn on automatic backup, a Pro feature). The privacy policy says so. In the Play data-safety form answer that data is **not collected by the developer**; the user's data goes to the user's own Google account at their request.
