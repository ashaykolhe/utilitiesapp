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
