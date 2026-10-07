'use strict';
/* Checks the Goofy Quotes data (www/js/data/quotes-goofy.js): categories, counts, lengths, duplicates, and the Mixer.
   Run: node tests/quotes-goofy.test.js */
const fs = require('fs'), path = require('path'), vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'www', 'js', 'data', 'quotes-goofy.js'), 'utf8');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(src + '\nthis.CATS = GOOFY_CATS; this.QUOTES = GOOFY_QUOTES; this.GEN = GOOFY_GEN;', ctx);
const { CATS, QUOTES, GEN } = ctx;

let fails = 0;
const fail = (m) => { fails++; if (fails <= 60) console.log('FAIL: ' + m); };
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

/* The Mixer, copied from www/js/tools/quotes.js */
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const mixer = () => {
  let out = pick(GEN.templates);
  for (let n = 0; n < 6 && /\{[a-z_]+\}/.test(out); n++) out = out.replace(/\{([a-z_]+)\}/g, (m, k) => GEN.banks[k] && GEN.banks[k].length ? pick(GEN.banks[k]) : m);
  return out.replace(/\{[a-z_]+\}/g, '').replace(/\s+/g, ' ').trim().replace(/^./, c => c.toUpperCase());
};

/* Words that must never appear. Written as split fragments so this file stays clean. */
const BAD = [['f', 'uck'], ['sh', 'it'], ['b', 'itch'], ['c', 'unt'], ['d', 'ick'], ['p', 'iss'], ['as', 'shole'], ['bas', 'tard'], ['d', 'amn'], ['cr', 'ap'], ['wh', 'ore'], ['sl', 'ut'], ['n', 'igger'], ['f', 'aggot'], ['r', 'etard'], ['k', 'ill'], ['mur', 'der'], ['su', 'icide'], ['d', 'rugs'], ['co', 'caine'], ['s', 'ex'], ['pr', 'ick'], ['id', 'iot'], ['stu', 'pid'], ['du', 'mb'], ['hate you']].map(p => p.join(''));
const badHit = (s) => { const t = ' ' + s.toLowerCase().replace(/[^a-z\s]/g, ' ') + ' '; return BAD.find(b => t.includes(' ' + b + ' ') || t.includes(' ' + b + 's ') || (b.length > 4 && t.includes(b))); };

/* ---- categories ---- */
const catIds = new Set();
if (!Array.isArray(CATS) || CATS.length < 12 || CATS.length > 14) fail('GOOFY_CATS must have 12 to 14 entries, has ' + (CATS && CATS.length));
for (const c of CATS) {
  if (!Array.isArray(c) || c.length < 3 || !c[0] || !c[1] || !c[2]) fail('bad category entry ' + JSON.stringify(c));
  else if (catIds.has(c[0])) fail('duplicate category ' + c[0]); else catIds.add(c[0]);
}

/* ---- quotes ---- */
const seen = new Map(), perCat = {};
for (const id of catIds) perCat[id] = 0;
for (const q of QUOTES) {
  const [t, c] = q;
  if (typeof t !== 'string' || !t.trim()) { fail('empty quote text in ' + JSON.stringify(q)); continue; }
  if (!catIds.has(c)) fail('category not in GOOFY_CATS: ' + c + ' for "' + t + '"'); else perCat[c]++;
  if (t.length > 160) fail('quote over 160 chars (' + t.length + '): ' + t);
  if (/\s\s/.test(t) || t !== t.trim()) fail('double or edge spaces: ' + t);
  if (/[{}]/.test(t)) fail('brace in quote: ' + t);
  if (!/^[A-Z]/.test(t)) fail('quote does not start with a capital: ' + t);
  if (/\b(\w+) \1\b/i.test(t)) fail('doubled word in quote: ' + t);
  const k = norm(t);
  if (seen.has(k)) fail('duplicate quote: ' + t); else seen.set(k, 1);
  const b = badHit(t); if (b) fail('blacklisted word in quote: ' + t);
}
for (const id of catIds) if (perCat[id] < 50) fail('category ' + id + ' has only ' + perCat[id] + ' quotes');
if (QUOTES.length < 700) fail('only ' + QUOTES.length + ' quotes, need at least 700');

/* ---- Mixer data ---- */
if (!GEN || !Array.isArray(GEN.templates) || GEN.templates.length < 60) fail('need at least 60 templates');
const tplSeen = new Set(); let combos = 0;
for (const t of GEN.templates) {
  if (tplSeen.has(t)) fail('duplicate template: ' + t); tplSeen.add(t);
  let o = 0, c = 0; for (const ch of t) { if (ch === '{') o++; if (ch === '}') c++; }
  if (o !== c) fail('unmatched braces in template: ' + t);
  const ph = t.match(/\{[^}]*\}/g) || [];
  let n = 1;
  for (const p of ph) {
    if (!/^\{[a-z_]+\}$/.test(p)) { fail('bad placeholder ' + p + ' in ' + t); continue; }
    const k = p.slice(1, -1);
    if (!GEN.banks[k] || !GEN.banks[k].length) fail('placeholder ' + p + ' has no bank: ' + t); else n *= GEN.banks[k].length;
  }
  if (/\b[aA]n? \{/.test(t)) fail('template uses "a {x}" / "an {x}": ' + t);
  if (/\bthe \{/i.test(t)) { /* allowed only for plural_thing style banks without articles */ const m = t.match(/\bthe \{([a-z_]+)\}/i); if (m && GEN.banks[m[1]] && GEN.banks[m[1]].some(e => /^(a|an|the) /i.test(e))) fail('"the {x}" with an article inside the bank: ' + t); }
  if (t.length > 160) fail('template too long: ' + t);
  combos += n;
}
for (const [k, list] of Object.entries(GEN.banks)) {
  if (list.length < 25) fail('bank ' + k + ' has only ' + list.length + ' entries');
  const s = new Set();
  for (const e of list) {
    if (typeof e !== 'string' || !e.trim()) { fail('empty entry in bank ' + k); continue; }
    if (e !== e.trim() || /\s\s/.test(e)) fail('stray spaces in bank ' + k + ': "' + e + '"');
    if (/[{}]/.test(e)) fail('brace in bank ' + k + ': ' + e);
    const n = norm(e); if (s.has(n)) fail('duplicate entry in bank ' + k + ': ' + e); s.add(n);
    if (badHit(e)) fail('blacklisted word in bank ' + k + ': ' + e);
  }
}
const unusedBanks = Object.keys(GEN.banks).filter(k => !GEN.templates.some(t => t.includes('{' + k + '}')));
if (unusedBanks.length) fail('banks never used by a template: ' + unusedBanks.join(', '));
if (combos < 100000) fail('only ' + combos + ' combinations in total, aim for 100000 or more');

/* ---- Mixer output ---- */
const N = 20000, results = new Set();
for (let i = 0; i < N; i++) {
  const r = mixer();
  results.add(r);
  if (/[{}]/.test(r)) fail('mixer left a brace: ' + r);
  if (/\b(\w+) \1\b/i.test(r)) fail('mixer doubled word: ' + r);
  if (/^[a-z]/.test(r)) fail('mixer starts lowercase: ' + r);
  if (r.length > 200) fail('mixer result too long (' + r.length + '): ' + r);
  if (/\s\s/.test(r) || r !== r.trim()) fail('mixer spacing: ' + r);
  if (/\b(a|an) (a|an|the) /i.test(r)) fail('mixer double article: ' + r);
  if (/ [.,:?!]/.test(r)) fail('mixer space before punctuation: ' + r);
  const b = badHit(r); if (b) fail('mixer blacklisted word: ' + r);
}
if (results.size <= 5000) fail('only ' + results.size + ' distinct mixer results in ' + N + ' draws, need more than 5000');

/* The real quotes must also look sane after the card engine capitalises nothing: print a summary */
console.log('quotes: ' + QUOTES.length + ' in ' + CATS.length + ' categories: ' + CATS.map(c => c[0] + '=' + perCat[c[0]]).join(' '));
console.log('templates: ' + GEN.templates.length + ', banks: ' + Object.keys(GEN.banks).length + ', combinations (sum over templates): ' + combos + ', distinct in ' + N + ' draws: ' + results.size);
if (fails) { console.log('\n' + fails + ' problem(s).'); process.exit(1); }
console.log('quotes-goofy: all checks passed');
