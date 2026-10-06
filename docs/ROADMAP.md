# PocketKit roadmap (the pipeline)

Ideas that need more than the web layer, extra hardware, or a network. Not built yet. Move an item to FEATURES.md when it ships.

## Needs a native Android plugin or special permission
| Tool | What is needed |
|---|---|
| Text Recognition (OCR) | An on-device OCR model (adds about 10 MB or more to the app). |
| Signal Strength | Native telephony / Wi-Fi API for real dBm values. |
| Metal Detector | Magnetometer through a native plugin (the web API is not reliable on all phones). |
| Atmospheric Light | Ambient light sensor through a native plugin. |
| Room Temperature | Only a few phones have an ambient temperature sensor; show only when present. |
| Internet Speed | A speed-test server and an internet connection. |
| IR Remote | Infrared blaster hardware, very rare on phones. |
| Bluetooth Controller | Android does not expose Bluetooth HID to normal apps; replace with a gamepad tester. |
| Background route recording | A foreground service so recording continues with the screen off. |
| Home screen widgets and quick-settings tiles | Native Android code (as done in Daytick). |

## Peer-to-peer over local Wi-Fi (experimental, last)
File Transfer, Walkie Talkie, Wi-Fi Calls, CCTV, Music Group, Peer link. Plan: WebRTC between two phones with the connection code exchanged by QR or copy and paste, no server. Some Wi-Fi networks block device-to-device traffic. Needs testing on two real phones. Marked as Pro (the `connect` Pro feature).

## App-level
- Languages: not planned for now (the app has a translation hook in `www/js/i18n.js` if this changes).
- Backup and restore of tool data to a file.
- Optional Google Drive backup for Pro.
- Release build set up for Google Play (see RELEASE.md).
