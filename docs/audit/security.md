# Audit findings: security tools (www/js/tools/security.js)

Source: read-only security audit, October 2026. Native helpers now available: `PN.setSecure({enabled})` (FLAG_SECURE) and `PN.copySensitive({text, clearMs})` (global `PN` in www/js/pro.js; null in a browser, always feature-detect).

1. HIGH File Locker biometric unlock saved the password with plain setCredentials/getCredentials (not authentication-bound; verifyIdentity only a UI check). Fix: setCredentials({username, password, server, accessControl: 1 /* BIOMETRY_CURRENT_SET */, title}) and read with getSecureCredentials({server, title}); drop the separate verifyIdentity; deleteCredentials when turning off or when re-saving fails; handle key invalidation by falling back to the password prompt; honest UI text.
2. HIGH No FLAG_SECURE: PN.setSecure({enabled:true}) while a sealed tool (locker, vault, secret notes, 2FA) is unlocked, false on lock() and in tool cleanup (keep a counter for several unlocked tools).
3. Android backup is off (manifest). Keep UI claims accurate. Call navigator.storage.persist() on first vault/locker setup; warn in showSetup when files exist but the record is missing.
4. MEDIUM-HIGH File Locker memory: load() read every file's ciphertext just to list names. Store metadata in a separate store (with an IndexedDB upgrade that migrates existing data) and list from it; rekey atomic and bounded in memory (or envelope encryption with a wrapped data key); hard cap 200 MB per file, warn above 100 MB.
5. MEDIUM Strength meter overrates dictionary words; weak master passwords accepted. Realistic estimator (cap alphabetic runs ~2.5 bits/char unless random, per-word rate for recognised words); generator bit counts honest (5 words of 789 is ~48 bits: enlarge the list or default to 7 words); enforce >= 50 bits and not common/leet on locker/vault setup, change-password and Text Locker with an explicit 'Use anyway'; fix over-promising tip text.
6. MEDIUM Text Locker: maxlength 20000 also applied to the decrypt box (long ciphertext truncated, reported as wrong password): cap encryption by UTF-8 bytes (~14000), no/large maxlength when decrypting.
7. MEDIUM Decrypted exports left in CACHE/pk-export: rmdir at tool start and on every unlock, delete after Share settles and on lock; keep the 120 s timer as backup.
8. MEDIUM Blob URLs of viewed files not revoked when leaving: close dialogs and revoke tracked URLs in cleanup.
9. MEDIUM Auto-lock gaps: S.hold(...) for pickers never cleared on cancel (reset on input cancel/change and window focus); foreground idle lock (~2 min); Capacitor App appStateChange/pause; performance.now() for elapsed time; opening Settings from a tool must lock it.
10. MEDIUM Clipboard: use PN.copySensitive({text, clearMs:30000}) when available and only then say 'Clears in 30 s'; never clear unconditionally when readText is denied.
11. LOW-MED Lockout uses Date.now(): monotonic deadline (max-seen clock like secureNow in pro.js).
13. LOW TOTP import: validate ids (/^[0-9a-f]{16}$/ else regenerate), no attribute selectors built from ids (CSS.escape / dataset iteration).
14. LOW 'Avoid easy PINs' must also reject doubled pairs, ABAB, years 19xx/20xx, keypad runs, with honest bits; password generator uniform or document bias.
15. LOW Checksum: extract the first token matching /\b[0-9a-fA-F]{40,128}\b/ (handles sha256sum lines and 'sha256:' prefixes); compare length to the selected algorithm first ('wrong length for this algorithm'); keep the large-file warning.
16. LOW Export file names: strip control chars, bidi overrides, leading dots; truncate the stem not the extension; fallback 'file'.
17. LOW autocomplete="off" on master-password fields.
18. LOW Text Locker MAX_ITER cap ~1.2M; distinguish bad record format from wrong password (do not count toward lockout).
