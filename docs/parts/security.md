## File Locker
- id: locker
- category: security
- plan: free with limit: 3 locked files (Pro: unlimited)
- needs: storage
- what: Encrypts photos, videos and documents with AES-256-GCM using a key derived from a vault password (PBKDF2-SHA256, 600,000 rounds, random 16-byte salt, random 12-byte IV per file) and stores them, with encrypted names and thumbnails, in IndexedDB. Has a setup flow with strength hint and a no-recovery warning, a wrong-password lockout (30 s after 5 failures, doubling), preview, export (decrypt and share/download), delete, change password (re-encrypts one file at a time into a scratch store, then switches everything in a single transaction, so a failure leaves the old password and data untouched), optional biometric quick unlock (the password is kept behind the phone's secure hardware and released only after a live fingerprint or face check; it stops working if biometrics change), and auto-lock when leaving the tool, after 2 minutes without use, or after 60 s in the background. Screenshots are blocked while it is unlocked. File names and thumbnails live in a separate encrypted store so the list opens without reading file contents. Files over 100 MB show a warning; files over 200 MB, and more than 1000 files, are refused. Passwords under about 50 bits of strength need an explicit "Use anyway".
- test:
  1. Open File Locker. Enter a password under 8 characters: an error appears. Enter two different passwords: mismatch error. Enter "password123" twice and tick the box: a "too easy to guess" message and a "Use this weak password anyway" button appear. Use a strong password (for example 7 random words) twice without ticking the box: asked to confirm; tick it and tap Create: the locker opens empty.
  2. Tap Choose files and pick two photos and a PDF (free plan allows 3). They appear with names, sizes and image thumbnails. Pick one more file: the Pro sheet opens and the file is not added.
  3. Tap View on a photo: it opens in a dialog. Tap Export on a file: the share sheet (or a download in a desktop browser) offers the decrypted file. Tap Delete and confirm: it disappears.
  4. Tap Lock, then enter a wrong password 5 times: after the fifth, the Unlock button is disabled with a countdown of about 30 s. Wait, then enter the right password: it unlocks.
  5. Open Security and backup, change the password (wrong current password is rejected; a weak new password asks for "Use anyway"), then lock and unlock with the new one: all files still open and the old password is rejected. Choose a file over 200 MB: it is skipped with a message.
  6. Unlock, send the app to the background for over 60 s and return: the locker is locked. Leave it untouched for 2 minutes: it locks. Leave the tool and re-enter: it is locked. On Android the screen cannot be screenshotted while it is unlocked. On a phone with biometrics: Security and backup shows "Turn on biometric unlock" (hidden if the plugin or biometrics are missing); after enabling, the Unlock screen shows a biometrics button and a fingerprint or face check is required. Add a fingerprint in Android settings: the button stops working, a message explains it, and the password still works.

## Password Vault
- id: vault
- category: security
- plan: free with limit: 5 entries (Pro: unlimited)
- needs: storage
- what: A master-password-protected store of logins (title, username, password, website, notes) encrypted with AES-256-GCM as one blob under its own salt and key. Includes search, show/hide, copy buttons that clear the clipboard after 30 s where the phone supports it (the message says whether it will), a built-in password generator with a length field and strength meter, edit and delete, change master password, and an encrypted backup file (JSON with salt, iv, ciphertext) that can be exported and imported with a warning.
- test:
  1. Open Password Vault, create a master password (8+ characters, confirm, tick the warning box). The empty vault opens.
  2. Tap Add, type a title and username, tap Generate: a 20 character password appears and the meter fills. Save. The entry shows with dots in place of the password.
  3. Tap Show, then Copy password: the toast says it clears in 30 s only when this phone does it natively; otherwise it says it may not clear by itself. Paste elsewhere to check it, wait 30 s and paste again: on a phone with the native helper the clipboard is empty.
  4. Add entries up to 5: the sixth opens the Pro sheet. Search for part of a title: the list filters.
  5. Security and backup > Export backup: a .pkbackup.json file is shared/downloaded. Delete an entry, choose Import backup, pick the file and enter the master password: the deleted entry returns. Enter a wrong password: a clear error and nothing changes.
  6. Lock and unlock with a wrong password: "Wrong password." After 5 wrong tries a 30 s lockout appears.

## Password Check
- id: pwcheck
- category: security
- plan: free
- needs: none
- what: Live password strength checker that runs only on the phone. Shows a meter, entropy estimate in bits, estimated crack time for online guessing, slow-hash and fast-hash attacks, problems found (common passwords with leetspeak, dictionary words, repeats, sequences, keyboard runs, years) and suggestions.
- test:
  1. Type "password": Very weak, instant crack time, problem "one of the most commonly used passwords".
  2. Type "P@ssw0rd2024": still weak and the year and common word are flagged.
  3. Paste a 16 character random mix of letters, digits and symbols: Strong or Excellent with a long crack time and no problems. Type "correcthorsebattery": it is rated much lower than a random string of the same length (dictionary words are charged at a word-like rate).
  4. Clear the box: the meter empties and the time and problems cards disappear. Tap the eye icon to reveal the text.
  5. Leave the tool and return: the field is empty (nothing is remembered).

## PIN & Passphrase
- id: pingen
- category: security
- plan: free
- needs: none
- what: Generates random PINs (4 to 12 digits, optionally avoiding easy PINs: repeated digits, runs, doubled pairs such as 1122, ABAB such as 1212, years 19xx and 20xx and keypad lines such as 2580; the bits shown account for the PINs left out), word passphrases from a built-in 789 word list (3 to 10 words, 7 by default, about 9.6 bits per word; separator, capitalise, number) and random passwords (8 to 64 characters, choose character sets), all from crypto.getRandomValues with unbiased selection. Shows the bits of randomness and copies with a 30 s clipboard clear.
- test:
  1. Open the tool: PIN tab shows five 6 digit PINs. Move Length to 4 and 12: the PINs change length. With "Avoid easy PINs" on, none are 0000, 1234, 4321, 1122, 1212, 2580 or contain a year such as 1990.
  2. Passphrase tab: the default is 7 words (about 67 bits shown; fewer than 7 words adds a tip to use more). Set 6 words and a space separator: four phrases of 6 words appear with about 58 bits shown. Toggle Capitalise and Add a number: the phrases update.
  3. Password tab: untick Symbols and Digits: only letters appear. Untick everything: lowercase letters are used so it never fails.
  4. Tap Generate again: new values every time. Tap Copy and paste elsewhere to check the value.

## Text Locker
- id: textlock
- category: security
- plan: free
- needs: none
- what: Encrypts a text message with a password into a shareable Base64 string using AES-256-GCM and PBKDF2-SHA256 (600,000 rounds, random salt and IV, header authenticated), and decrypts such strings. Messages are limited to 14,000 bytes of UTF-8; the box for pasting a locked code takes up to 100,000 characters. Weak passwords need an explicit "Use anyway"; files made with more than 1.2 million rounds are rejected as invalid. A wrong password or any edit to the code makes decryption fail.
- test:
  1. Lock tab: type a message and a password under 8 characters: error. Use a 10+ character password and tap Lock message: a Base64 code appears. Tap Copy.
  2. Switch to Unlock tab, paste the code and enter the same password: the original message appears.
  3. Enter a wrong password: "Wrong password, or the code was changed."
  4. Delete one character from the middle of the code and unlock with the right password: it fails the same way. Paste random text: "not a valid locked code".
  5. Tap Share: the share sheet opens (or the text is copied on a desktop browser).
  6. Lock a message of about 14,000 characters: it works, and the long code pastes whole into the Unlock tab and opens. A message of 15,000 characters is cut off at the limit by the box. In Lock mode a password such as "password123" shows "too easy to guess" with a "Use anyway" button.

## Checksum
- id: checksum
- category: security
- plan: free
- needs: storage
- what: Hashes any chosen file with SHA-256, SHA-512, SHA-384 or SHA-1 using WebCrypto and compares it with a hash you paste (a whole sha256sum line or a "sha256:" prefix is accepted, case is ignored, the algorithm is picked from the hash length, and a hash of the wrong length for the chosen algorithm is reported as such). The whole file is read into memory because WebCrypto cannot hash in a stream, so very large files may fail.
- test:
  1. Choose a small text file and tap Calculate: a SHA-256 hash appears. Compare it with a known value from another tool.
  2. Paste that hash into Expected hash: the verdict reads Match. Change one character: No match in red.
  3. Paste a 128 character SHA-512 hash: the algorithm switches to SHA-512 automatically.
  4. Cancel the file picker without choosing: the Calculate button stays disabled. Choose a file over 500 MB: a warning shows and failure is reported gracefully if memory runs out. A file over 1 GB is refused with a message.

## Privacy Checklist
- id: privacy
- category: security
- plan: free
- needs: storage
- what: An interactive checklist of 25 phone privacy and security habits in five groups with a progress bar and percentage, saved on the device.
- test:
  1. Open the tool: progress shows 0 of 25 done.
  2. Tick three items: the count and percentage update immediately.
  3. Leave and reopen: the ticks are still there.
  4. Tap Reset checklist and confirm: all ticks clear and the progress returns to 0%. Cancel the confirm: nothing changes.

## Emergency Card
- id: emergency
- category: security
- plan: free
- needs: storage
- what: A large, easy-to-read card with name, blood group, allergies, conditions, medicines, organ donor status and two emergency contacts with one-tap call buttons, stored locally on the phone (not encrypted, by design, so first responders can read it).
- test:
  1. First open shows the edit form. Date of birth is a date picker (not in the future, not before 1900); phone fields take at most 20 characters of digits, spaces and + ( ) - only. Fill in a name, blood group O+, an allergy and a contact phone, then Save.
  2. The card shows the name in large type, a big red blood group and a Call button for the contact; tapping it opens the dialer with the number.
  3. Tap Edit card, clear the allergy, Save: it disappears from the card. Cancel on the edit screen returns to the card without changes.
  4. Close and reopen the app: the card is still there.

## 2FA Codes
- id: totp
- category: security
- plan: free
- needs: storage
- what: An offline authenticator for two-step verification (TOTP, RFC 6238 with HMAC-SHA1, SHA-256 or SHA-512 through WebCrypto, 6 to 8 digits, 10 to 120 s periods). Accounts can be added from a base32 secret or an otpauth:// link. Secrets are stored encrypted under their own master password using the same AES-256-GCM vault scheme, with lockout, auto-lock and encrypted backup/import. Codes show a countdown and copy with a 30 s clipboard clear. The engine passes the RFC 6238 and RFC 4226 test vectors.
- test:
  1. Open 2FA Codes, create a master password, tap Add account, name it and enter secret GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ: a 6 digit code appears with a countdown bar that turns red in the last 5 s and then a new code appears.
  2. Compare the code with a trusted authenticator app using the same secret: they match at the same moment.
  3. Enter an invalid secret such as "hello!" or one shorter than 10 characters: an error says it does not look valid. Paste an otpauth://totp/Example:me?secret=JBSWY3DPEHPK3PXP&issuer=Example link: issuer and secret are filled automatically.
  4. Tap the code: it copies. Tap the X on an account and confirm: it is removed (a warning explains you need the secret to add it again).
  5. Lock the tool and unlock with a wrong password: refused. Export a backup, remove an account, import the backup with the master password: the account returns.

## Secret Notes
- id: secretnotes
- category: security
- plan: free
- needs: storage
- what: Private notes encrypted with AES-256-GCM under their own master password, separate from the regular Notes tool. Includes search, create, edit, delete, change password, lockout, auto-lock and encrypted backup/import.
- test:
  1. Open Secret Notes and create a master password. Tap New, write a title and body, Save: the note appears in the list with a preview and date.
  2. Tap the note, edit it, Save: the list updates. Use Search to find it by a word from the body.
  3. Lock, then unlock with the right password: the note is still there. A wrong password shows "Wrong password."
  4. Delete the note and confirm: it is removed. Try saving an entirely empty new note: "Write something first."
  5. Export a backup, delete a note and import the backup with the master password: the note returns.
