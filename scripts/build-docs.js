'use strict';
/* Builds docs/FEATURES.md and docs/MANUAL-TEST.md from the per-group notes in docs/parts/*.md.
   Run after adding or changing a tool:  npm run features   (then commit the two generated files).
   Each tool section in a parts file looks like the shape described in docs/TOOL-GUIDE.md. */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), PARTS = path.join(ROOT, 'docs', 'parts');
const CATS = [['daily', 'Daily'], ['navigate', 'Navigate'], ['measure', 'Measure'], ['calculate', 'Calculate'], ['text', 'Text & Data'], ['audio', 'Audio'],
  ['camera', 'Camera'], ['health', 'Health'], ['security', 'Security'], ['connect', 'Connect'], ['create', 'Create'], ['fun', 'Fun']];
const SKIP = new Set(process.env.SKIP_IDS ? process.env.SKIP_IDS.split(',') : []);

const tools = [];
for (const f of fs.readdirSync(PARTS).filter(f => f.endsWith('.md')).sort()) {
  const text = fs.readFileSync(path.join(PARTS, f), 'utf8').replace(/\r\n/g, '\n');
  for (const block of text.split(/^## /m).slice(1)) {
    const lines = block.split('\n'), name = lines.shift().trim();
    const t = { name, file: f, test: [] }; let inTest = false, last = null;
    for (const line of lines) {
      let m;
      if ((m = line.match(/^- (id|category|plan|needs|what): ?(.*)$/))) { t[m[1]] = m[2].trim(); last = m[1]; inTest = false; }
      else if (/^- test:/.test(line)) { inTest = true; last = null; }
      else if (inTest && /^\s+\d+\.\s/.test(line)) t.test.push(line.trim().replace(/^\d+\.\s*/, ''));
      else if (!inTest && last === 'what' && line.trim() && /^\s+/.test(line)) t.what += ' ' + line.trim();
    }
    if (t.id && !SKIP.has(t.id)) tools.push(t);
  }
}
const seen = new Set(), dup = [];
tools.forEach(t => { if (seen.has(t.id)) dup.push(t.id); seen.add(t.id); });
if (dup.length) console.warn('duplicate ids in parts:', dup.join(', '));

const planLabel = p => /^free with limit/i.test(p) ? 'Free (limit: ' + p.replace(/^free with limit:\s*/i, '') + ')' : /^pro/i.test(p) ? 'Pro' : 'Free';
const byCat = c => tools.filter(t => t.category === c).sort((a, b) => a.name.localeCompare(b.name));
const stamp = new Date().toISOString().slice(0, 10);

let F = `# PocketKit: features\n\nPocketKit has ${tools.length} tools in ${CATS.filter(c => byCat(c[0]).length).length} categories. Everything works offline and all data stays on the phone.\n` +
  `**Free** = every everyday utility. **Pro** = a one-time purchase (no subscription) for the heavier features and higher limits.\n\n` +
  `_Generated from docs/parts/*.md by scripts/build-docs.js on ${stamp}. Edit the parts files, not this file._\n\n` +
  `## App features\n\n| Feature | What it does |\n|---|---|\n` +
  `| **Home** | Pinned tools on top, then recent tools, then every category as a collapsible card. Press and hold a tool to pin it. |\n` +
  `| **Search** | Finds a tool by name, category or keyword. A microphone button searches by voice where the phone supports it. |\n` +
  `| **Themes** | Follow the phone, light or dark, and six accent colours (two free, four Pro). |\n` +
  `| **Pro** | One-time purchase \`pocketkit_pro\` through Google Play, or a trial code. Unlocks the Connect suite (planned), Motion cam, Stop motion, all colour themes and removes the free limits. |\n` +
  `| **Trial codes** | A code gives Pro until a fixed date. It is checked on the device against a built-in hash list, and the clock cannot be wound back to extend it. |\n` +
  `| **Free limits** | 4 pinned tools, 3 reminders, 10 notes, 3 voice recordings, 1 saved route, 3 locked files, 5 vault entries. |\n` +
  `| **Tool of the day** | A different free tool is suggested on Home every day. |\n` +
  `| **Filters and Surprise me** | Filter by Free, Pro, no permissions, camera, microphone, location or sensors, or open a random tool. |\n` +
  `| **Collections (Pro)** | Make named groups of tools, for example Travel or Study, shown on Home. |\n` +
  `| **Share** | A button in every tool shares the text on screen (results, inputs) through the Android share sheet. |\n` +
  `| **App lock** | A 4 to 6 digit PIN (and optionally fingerprint or face) asked when the app opens or returns after 0 seconds, 30 seconds or 5 minutes. The PIN is stored only as a salted hash. 5 wrong tries cause a growing wait. |\n` +
  `| **Backup and restore** | Saves settings and tool data to a file and restores it. Pro state, the PIN, recordings, locked files and the vault are not included. |\n` +
  `| **Tour and What's new** | A three-step tour on first launch (replay in Settings) and a short note after updates. |\n` +
  `| **Languages** | English only for now. The app is built so a translation pack can be added later; none is planned. |
` +
  `| **Haptics** | Optional vibration feedback, switchable in Settings. |\n` +
  `| **Privacy** | No accounts, no ads, no analytics. See privacy-policy.html. |\n\n`;
for (const [id, label] of CATS) {
  const list = byCat(id); if (!list.length) continue;
  F += `## ${label} (${list.length})\n\n| Tool | Plan | Needs | What it does |\n|---|---|---|---|\n`;
  for (const t of list) F += `| **${t.name}** | ${planLabel(t.plan || 'free')} | ${(t.needs || 'none').replace(/^none$/i, '-')} | ${(t.what || '').replace(/\|/g, '/')} |\n`;
  F += '\n';
}
fs.writeFileSync(path.join(ROOT, 'docs', 'FEATURES.md'), F);

let T = `# PocketKit: manual test\n\nTick each box on a real phone. Test on a debug build first (\`cd android && ./gradlew assembleDebug\`, then \`adb install -r app/build/outputs/apk/debug/app-debug.apk\`).\n` +
  `Allow each permission when the app asks, and also try denying it once: the tool must show a message and not crash.\n\n` +
  `_Generated from docs/parts/*.md by scripts/build-docs.js on ${stamp}._\n\n## 0. App-level checks\n\n` +
  `- [ ] The app opens to the Home screen with the PocketKit name and the tool count.\n- [ ] Search "tim" shows Timer and other matches; clearing the box brings the categories back.\n` +
  `- [ ] Tap a category header: it collapses and stays collapsed after closing and reopening the app.\n- [ ] Press and hold a tool: "Pinned" appears and a Pinned row shows on top. Pin 4 tools, then a fifth: the Pro sheet opens.\n` +
  `- [ ] Open a tool, press the phone's Back button: it returns to Home. Press Back on Home: the app closes.\n- [ ] Settings: change Theme to Dark and Light; the whole app follows. Tap a locked colour: the Pro sheet opens.\n` +
  `- [ ] Settings > Privacy policy opens the policy page.\n- [ ] Open a Pro tool (Motion Cam): the Pro sheet opens with the feature highlighted.\n` +
  `- [ ] Pro sheet: enter a wrong code: "That code isn't valid". Enter a code from coupon-codes.txt for today: Pro turns on, locks disappear, Settings shows "Trial until ...".\n` +
  `- [ ] First launch shows a 3-step tour; Settings > Show the tour again replays it.\n- [ ] Tap "Surprise me": a random free tool opens. Tool of the day card opens its tool.\n` +
  `- [ ] Filter chips (Free, Pro, No permissions, Camera...) narrow the grid; All brings the categories back.\n` +
  `- [ ] In a tool, tap the share button: the Android share sheet opens with the tool's text; the folder button opens Collections (free: asks for Pro; Pro: make "Travel", tick the tool, Done, see it on Home, delete it).\n` +
  `- [ ] Settings > App lock: turn on, set a PIN twice. Leave the app for longer than the chosen time: the lock screen appears; wrong PIN shows an error; 5 wrong tries cause a wait; the right PIN unlocks. Fingerprint option appears only if the phone has one. Turn the lock off (asks for the PIN).\n` +
  `- [ ] Settings > Back up saves a .json file through the share sheet; change something; Restore that file: the change is undone. A random .json file is refused.\n` +
  `- [ ] Settings > Language appears only when a translation pack exists; switching it translates the home screen.\n` +
  `- [ ] Rotate the phone and send the app to the background and back: nothing breaks.\n- [ ] Turn on airplane mode: every tool except those marked "network" still works.\n\n`;
let n = 1;
for (const [id, label] of CATS) {
  const list = byCat(id); if (!list.length) continue;
  T += `## ${n++}. ${label}\n\n`;
  for (const t of list) {
    T += `### ${t.name}${/^pro/i.test(t.plan || '') ? ' (Pro)' : ''}\n_${planLabel(t.plan || 'free')}${t.needs && !/^none$/i.test(t.needs) ? '. Needs: ' + t.needs : ''}_\n\n`;
    (t.test.length ? t.test : ['Open the tool and use every control once; nothing crashes.']).forEach(s => { T += `- [ ] ${s}\n`; });
    T += '\n';
  }
}
fs.writeFileSync(path.join(ROOT, 'docs', 'MANUAL-TEST.md'), T);
console.log(`FEATURES.md and MANUAL-TEST.md written for ${tools.length} tools`);
