'use strict';
/* Data rules for Tip of the Day (docs/TIPS-WRITING.md): files load, labels are known, length limit, no duplicates, no links or emoji. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..', 'www', 'js');
const win = {}; const ctx = vm.createContext({ window: win });
const files = fs.readdirSync(path.join(root, 'data')).filter(f => /^tips-.*\.js$/.test(f)).sort();
let fails = 0; const fail = (m) => { fails++; console.log('FAIL ' + m); };
if (files.length < 4) fail('expected at least 4 tips-*.js data files, found ' + files.length);
const LABELS = ['Tip', 'Health tip', 'Money tip', 'Phone tip', 'Safety tip', 'Home tip', 'Food tip', 'Study tip', 'Work tip', 'Travel tip', 'Kindness', 'Proverb', 'Saying'];
for (const f of files) { try { vm.runInContext(fs.readFileSync(path.join(root, 'data', f), 'utf8'), ctx, { filename: f }); } catch (e) { fail(f + ' does not load: ' + e.message); } }
const src = fs.readFileSync(path.join(root, 'tools', 'daily.js'), 'utf8');
const a = src.indexOf('const BASE_TIPS = ['), b = src.indexOf('\n  ];', a);
const base = vm.runInContext('(' + src.slice(a + 'const BASE_TIPS ='.length, b + 4).trim().replace(/;$/, '') + ')', vm.createContext({}));
const all = base.map(t => ({ t, f: 'daily.js' })); for (const p of (win.TIPS_PARTS || [])) for (const t of p) all.push({ t, f: 'data' });
const seen = new Map(); const counts = {}; let dup = 0;
const emoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
for (const { t, f } of all) {
  if (!Array.isArray(t) || typeof t[0] !== 'string' || typeof t[1] !== 'string') { fail('bad entry in ' + f + ': ' + JSON.stringify(t)); continue; }
  const [x, l] = t, k = x.trim().toLowerCase();
  if (!LABELS.includes(l)) fail('unknown label "' + l + '" for: ' + x);
  if (x.length < 12 || x.length > 150) fail('length ' + x.length + ' (12..150): ' + x);
  if (/https?:|www\.|@|#\w/.test(x)) fail('link, handle or hashtag: ' + x);
  if (emoji.test(x)) fail('emoji in: ' + x);
  if (/\s{2,}/.test(x) || x !== x.trim()) fail('stray spaces: ' + x);
  if (!/[.!?)'"]$/.test(x)) fail('does not end like a sentence: ' + x);
  if (seen.has(k)) { dup++; fail('duplicate: ' + x); } else seen.set(k, f);
  counts[l] = (counts[l] || 0) + 1;
}
const total = seen.size;
if (total < 800) fail('expected at least 800 tips, have ' + total);
for (const l of ['Proverb', 'Kindness', 'Health tip', 'Money tip', 'Phone tip', 'Home tip', 'Study tip', 'Work tip']) if ((counts[l] || 0) < 20) fail('too few "' + l + '" tips: ' + (counts[l] || 0));
console.log('tips: ' + total + ' unique, ' + dup + ' duplicates; ' + Object.entries(counts).map(([k, v]) => k + ' ' + v).join(', '));
if (fails) { console.log(fails + ' problem(s)'); process.exit(1); } console.log('tips data checks passed');
