'use strict';
/* One place that says which tools are Pro. Run:  node scripts/set-pro-tools.js
   It rewrites `pro: true, proKey: '...'` on those tools in www/js/tools/*.js and the `- plan:` line in docs/parts/*.md, so code and docs agree.
   (The keys must exist in PRO_FEATURES in www/js/pro.js; they pick which line the Pro sheet highlights.)
   Free forever: every everyday tool. Pro: power tools that are heavier to build or serve people who use them a lot. */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const PRO = {
  motion: ['motioncam', 'stopmotion'],
  camera: ['docscan', 'timelapse', 'blankcam', 'photofx', 'collage', 'cbsim'],
  audio: ['player', 'drumpad', 'toneseq', 'spectrum'],
  trackers: ['expenses', 'billing', 'healthlog', 'habits'],
  create: ['pixelart', 'signature'],
  study: ['flashcards', 'matrix'],
  locker: ['totp'],
  sensors: ['sensorlist']
};
const keyOf = {}; for (const [k, ids] of Object.entries(PRO)) for (const id of ids) keyOf[id] = k;

const dir = path.join(ROOT, 'www', 'js', 'tools'), seen = new Set();
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
  const p = path.join(dir, f); let s = fs.readFileSync(p, 'utf8'), changed = false;
  for (const id of Object.keys(keyOf)) {
    const re = new RegExp("(id:\\s*'" + id + "',)(\\s*pro:\\s*true,\\s*proKey:\\s*'[a-z]+',)?");
    if (re.test(s)) { seen.add(id); const out = s.replace(re, (m, a) => a + " pro: true, proKey: '" + keyOf[id] + "',"); if (out !== s) { s = out; changed = true; } }
  }
  if (changed) fs.writeFileSync(p, s);
}
const missing = Object.keys(keyOf).filter(id => !seen.has(id));
if (missing.length) console.log('not found in the tool files (yet): ' + missing.join(', '));

const pdir = path.join(ROOT, 'docs', 'parts');
for (const f of fs.readdirSync(pdir).filter(f => f.endsWith('.md'))) {
  const p = path.join(pdir, f); const text = fs.readFileSync(p, 'utf8'); const nl = text.includes('\r\n') ? '\r\n' : '\n';
  const blocks = text.split(/^(?=## )/m).map(b => {
    const m = b.match(/^- id: (\S+)/m); if (!m || !keyOf[m[1]]) return b;
    return b.replace(/^- plan: .*$/m, '- plan: pro');
  });
  const out = blocks.join(''); if (out !== text) fs.writeFileSync(p, out);
}
console.log('Pro tools set: ' + Object.values(PRO).flat().length + ' (' + Object.keys(PRO).map(k => k + ':' + PRO[k].length).join(', ') + ')');
