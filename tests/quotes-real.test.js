'use strict';
/* Checks the Real Quotes data. Usage: node tests/quotes-real.test.js [batchFolder]
   Without an argument it tests www/js/data/quotes-real.js (all rules). With a folder of <category>.json batches it tests those
   (categories taken from each quote, minimum 30 each, no total minimum). */
const fs = require('fs'), path = require('path');
const folder = process.argv[2];
let CATS, QUOTES;
if (folder) {
  const files = fs.readdirSync(folder).filter((f) => f.endsWith('.json'));
  QUOTES = [];
  for (const f of files) {
    let arr; try { arr = JSON.parse(fs.readFileSync(path.join(folder, f), 'utf8')); } catch (e) { console.error('BAD JSON ' + f + ': ' + e.message); process.exit(1); }
    arr.forEach((q) => QUOTES.push(q));
  }
  CATS = [...new Set(QUOTES.map((q) => q[2]))].map((c) => [c, '', '']);
} else {
  const src = fs.readFileSync(path.join(__dirname, '..', 'www', 'js', 'data', 'quotes-real.js'), 'utf8');
  ({ CATS, QUOTES } = new Function(src + '\nreturn { CATS: REAL_CATS, QUOTES: REAL_QUOTES };')());
}

/* Famous misattributions: [author fragment, text fragment]. */
const BLACKLIST = [
  ['gandhi', 'be the change'], ['einstein', 'same thing over and over'], ['einstein', 'everybody is a genius'],
  ['', 'well-behaved women'], ['burke', 'triumph of evil'], ['roosevelt', 'one thing every day that scares'],
  ['twain', 'twenty years from now'], ['wilde', 'everyone else is already taken'], ['', 'miss 100% of the shots'],
  ['ford', 'think you can or you think you can'], ['', 'if you want to go fast'], ['einstein', 'not everything that counts'],
  ['hepburn', 'impossible'], ['', 'the word itself says'], ['', 'insanity is doing']
];
const errs = [];
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, ' ').trim();
const catIds = new Set(CATS.map((c) => c[0]));
const seen = new Map(), counts = {};
CATS.forEach((c) => { counts[c[0]] = 0; });
QUOTES.forEach((q, i) => {
  const [text, author, cat] = q, tag = '#' + i + ' [' + author + '] ' + String(text).slice(0, 40);
  if (!Array.isArray(q) || typeof text !== 'string' || !text.trim()) { errs.push('empty text ' + tag); return; }
  if (!author || !String(author).trim()) errs.push('missing author ' + tag);
  if (!cat) errs.push('missing category ' + tag); else if (!catIds.has(cat)) errs.push('unknown category "' + cat + '" ' + tag);
  else counts[cat]++;
  if (text.split(/\s+/).length > 45) errs.push('over 45 words ' + tag);
  if (text.length > 280) errs.push('over 280 chars ' + tag);
  if (/^".*"$/.test(text.trim())) errs.push('wrapped in straight quotes ' + tag);
  if (/ {2,}/.test(text) || / {2,}/.test(author)) errs.push('double space ' + tag);
  if (text !== text.trim()) errs.push('untrimmed ' + tag);
  const lt = text.toLowerCase();
  BLACKLIST.forEach(([a, f]) => { if (lt.includes(f) && String(author).toLowerCase().includes(a)) errs.push('blacklisted misattribution ' + tag); });
  const k = norm(text);
  if (seen.has(k)) errs.push('duplicate of #' + seen.get(k) + ' ' + tag); else seen.set(k, i);
});
Object.keys(counts).forEach((c) => { if (counts[c] < 30) errs.push('category ' + c + ' has only ' + counts[c] + ' (need 30)'); });
if (!folder && QUOTES.length < 500) errs.push('only ' + QUOTES.length + ' quotes in total (need 500)');
if (!folder && (CATS.length < 12 || CATS.length > 16)) errs.push('need 12 to 16 categories, have ' + CATS.length);
if (errs.length) { console.error(errs.length + ' problem(s):\n' + errs.join('\n')); process.exit(1); }
console.log('OK: ' + QUOTES.length + ' quotes, ' + CATS.length + ' categories', JSON.stringify(counts));
