## Wi-Fi Scanner
- id: wifiscan
- category: measure
- plan: free
- needs: location
- what: Lists the Wi-Fi networks around you with signal strength, security type, band and channel, draws how many networks use each channel and suggests the least crowded common 2.4 GHz channel. Works only in the installed app. Android needs Location switched on for Wi-Fi scans; PocketKit does not use your position and keeps nothing.
- test:
  1. Open Wi-Fi Scanner and tap Scan for networks: the first time, allow the Location prompt. Networks appear sorted by signal with security, band and channel.
  2. A bar chart of channels in use and a channel suggestion appear.
  3. Switch Location off in quick settings and scan again: a message says to turn Location on. Switch Wi-Fi off: a message says Wi-Fi is off.
  4. Tap Scan again twice quickly: the second tap is ignored while scanning.

## Bluetooth Scan
- id: btscan
- category: measure
- plan: free
- needs: location
- what: Scans for nearby Bluetooth devices for 3 to 15 seconds and lists name, address and signal strength, and marks devices already paired with your phone. Works only in the installed app. Nothing is saved or sent.
- test:
  1. Open Bluetooth Scan, keep 6 s, tap Scan for devices and allow the Nearby devices prompt. The button counts down, then devices are listed with signal bars.
  2. Move the slider to 15 s and scan: the countdown starts at 15.
  3. A phone or earbuds you have paired show a Paired badge; unnamed devices show Unknown device.
  4. Turn Bluetooth off and scan: a message says Bluetooth is off.

## NFC Reader
- id: nfcreader
- category: daily
- plan: free
- needs:
- what: Reads NFC tags and cards: shows the tag ID, technologies, and any text, link or data stored on it, with a Copy button. Read only: it never writes to or copies a tag. Works only in the installed app on phones with NFC.
- test:
  1. Open NFC Reader: it says Ready (or that NFC is off, with how to turn it on).
  2. Hold an NFC tag or transit card to the back of the phone: the phone buzzes and a card shows the tag ID and type.
  3. Tap a tag with a text or link record: the value is shown and Copy puts it on the clipboard.
  4. Tap Clear list: the list empties. Leave the tool and tap a tag: nothing happens in PocketKit.

## Battery Health
- id: batteryhealth
- category: daily
- plan: free
- needs:
- what: Shows battery level, health, temperature, voltage, charging state and, where the phone reports them, current and state of health. Updates every 3 seconds. Android does not share cycle count or design capacity, so those are not shown. Works only in the installed app.
- test:
  1. Open Battery Health: percent, a bar, status and Health (usually Good) appear.
  2. Plug in a charger: status changes to Charging and Plugged in shows AC or USB within a few seconds.
  3. Temperature is shown in both °C and °F and matches the Battery Temperature in other apps closely.
  4. Leave the tool: updates stop.

## Storage Info
- id: storageinfo
- category: daily
- plan: free
- needs:
- what: Shows how full the phone storage is, free and total space, and how much space PocketKit's temporary files and saved data use, with a button to clear temporary files only. Saved notes, lists, recordings, locked files and settings are never deleted. Works only in the installed app.
- test:
  1. Open Storage Info: used percent, a bar, free and total appear and are close to the phone's Settings > Storage.
  2. Share something (for example a quote picture) so a temporary file exists, reopen the tool: Temporary files shows a size.
  3. Tap Clear temporary files: a message appears and Temporary files drops to near zero. Your notes and other data are still there.
