'use strict';
/* Functional tests for the text tools, part 2: json, hash, colour, lorem, bytes, symbols, fancy, diff, regex, cases, numsort, csv. */
const nodeCrypto = require('crypto');
const { boot, suite } = require('../helpers/page');
(async () => {
  const T = suite('text2'), page = await boot();
  const w = page.w;
  page.eval(`window.__cp = []; window.copyToClipboard = async (t) => { __cp.push(String(t)); return true; };`);
  const lastCp = () => w.__cp[w.__cp.length - 1];
  const tick = () => page.wait(20);
  let t;

  /* ---------- JSON ---------- */
  t = await page.open('json');
  const src = '{"a":1,"b":[1,2],"n":12345678901234567890,"f":1.0,"e":1E2,"2":"x","1":"y"}';
  t.type('#i', src); t.click('#pp');
  T.eq(t.value('#i'), '{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ],\n  "n": 12345678901234567890,\n  "f": 1.0,\n  "e": 1E2,\n  "2": "x",\n  "1": "y"\n}', 'json: pretty keeps big numbers, 1.0, 1E2 and key order');
  T.has(t.text(), 'Valid JSON', 'json: valid message');
  t.click('#mn'); T.eq(t.value('#i'), src, 'json: minify restores the compact form exactly');
  t.select('#ind', '4'); t.type('#i', '[1,{"a":null}]'); t.click('#pp');
  T.eq(t.value('#i'), '[\n    1,\n    {\n        "a": null\n    }\n]', 'json: 4 space indent');
  t.select('#ind', 'tab'); t.type('#i', '{"a":[true,false]}'); t.click('#pp');
  T.eq(t.value('#i'), '{\n\t"a": [\n\t\ttrue,\n\t\tfalse\n\t]\n}', 'json: tab indent');
  t.type('#i', '{ }'); t.click('#pp'); T.eq(t.value('#i'), '{}', 'json: empty object stays {}');
  t.type('#i', '[ ]'); t.click('#pp'); T.eq(t.value('#i'), '[]', 'json: empty array stays []');
  t.type('#i', '"caf\\u00e9 \\n \\" é 😀"'); t.click('#pp'); T.eq(t.value('#i'), '"caf\\u00e9 \\n \\" é 😀"', 'json: string escapes are copied unchanged');
  t.type('#i', '{"a":1,}'); t.click('#va');
  T.has(t.q('#st').textContent, 'Expected a "quoted" key at line 1, column 8', 'json: trailing comma points at column 8');
  t.click('#pp'); T.eq(t.value('#i'), '{"a":1,}', 'json: invalid JSON is left untouched by Pretty');
  t.type('#i', '{\n  "a": 1\n  "b": 2\n}'); t.click('#va');
  T.has(t.q('#st').textContent, 'line 3, column 3', 'json: missing comma reported on line 3');
  t.type('#i', "{'a':1}"); t.click('#va'); T.has(t.q('#st').textContent, 'column 2', 'json: single quotes rejected');
  t.type('#i', '[01]'); t.click('#va'); T.has(t.q('#st').textContent, 'column 3', 'json: leading zero rejected');
  t.type('#i', '[NaN]'); t.click('#va'); T.has(t.q('#st').textContent, 'Unexpected character', 'json: NaN rejected');
  t.type('#i', '{"a":"x\ny"}'); t.click('#va'); T.has(t.q('#st').textContent, 'Control character', 'json: raw newline in string rejected');
  t.type('#i', '[1,2'); t.click('#va'); T.has(t.q('#st').textContent, 'Unexpected end', 'json: unterminated array');
  t.type('#i', '['.repeat(500) + ']'.repeat(500)); t.click('#va'); T.has(t.q('#st').textContent, 'Nested too deeply', 'json: absurd nesting does not crash');
  t.type('#i', '   '); t.click('#va'); T.has(t.q('#st').textContent, 'Paste some JSON', 'json: empty hint');
  t.type('#i', '[1]'); t.click('#cp'); await tick(); T.eq(lastCp(), '[1]', 'json: copy');
  t.click('#cl'); T.eq(t.value('#i'), '', 'json: clear');
  t.close();

  /* ---------- Hash ---------- */
  t = await page.open('hash');
  const H = (alg, s) => nodeCrypto.createHash(alg).update(s).digest('hex');
  const hv = () => Object.fromEntries(t.all('#out .item').map(x => [x.querySelector('.muted').textContent, x.querySelector('div > div:nth-child(2)').textContent]));
  t.type('#i', 'abc'); await page.wait(500);
  T.eq(hv()['SHA-1'], 'a9993e364706816aba3e25717850c26c9cd0d89d', 'hash: SHA-1 of abc (published vector)');
  T.eq(hv()['SHA-256'], 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'hash: SHA-256 of abc (published vector)');
  T.eq(hv()['SHA-384'], H('sha384', 'abc'), 'hash: SHA-384 of abc'); T.eq(hv()['SHA-512'], H('sha512', 'abc'), 'hash: SHA-512 of abc');
  t.type('#i', 'héllo €😀'); await page.wait(500);
  T.eq(hv()['SHA-256'], H('sha256', 'héllo €😀'), 'hash: SHA-256 of UTF-8 text');
  t.type('#i', ''); await page.wait(500);
  T.eq(hv()['SHA-256'], 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'hash: SHA-256 of empty text');
  t.type('#i', 'abc'); await page.wait(500);
  t.type('#cmp', 'BA7816BF 8F01CFEA 414140DE 5DAE2223 B00361A3 96177A9C B410FF61 F20015AD'); T.has(t.q('#cr').textContent, 'Match: SHA-256', 'hash: compare ignores case and spaces');
  t.type('#cmp', 'a9993e364706816aba3e25717850c26c9cd0d89d'); T.has(t.q('#cr').textContent, 'Match: SHA-1', 'hash: compare finds SHA-1');
  t.type('#cmp', 'deadbeef'); T.has(t.q('#cr').textContent, 'No match', 'hash: compare says no match');
  t.type('#cmp', ''); T.eq(t.q('#cr').textContent, '', 'hash: compare cleared');
  t.click('[data-a="SHA-256"]'); await tick(); T.eq(lastCp(), hv()['SHA-256'], 'hash: copy SHA-256');
  /* a chosen file */
  const fl = t.q('#fl'), bytes = Buffer.from('file contents');
  Object.defineProperty(fl, 'files', { value: [{ size: bytes.length, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) }], configurable: true });
  fl.dispatchEvent(new w.Event('change', { bubbles: true })); await page.wait(500);
  T.eq(hv()['SHA-256'], H('sha256', 'file contents'), 'hash: SHA-256 of a chosen file');
  Object.defineProperty(fl, 'files', { value: [{ size: 60e6, arrayBuffer: async () => new ArrayBuffer(1) }], configurable: true });
  fl.dispatchEvent(new w.Event('change', { bubbles: true })); await page.wait(300);
  T.has(t.text(), 'File too large', 'hash: a file over 50 MB is refused politely');
  t.close();

  /* ---------- Colour ---------- */
  t = await page.open('colour');
  T.eq(t.value('#hx'), '#7C5CFF', 'colour: default hex'); T.eq(t.value('#r') + ',' + t.value('#g') + ',' + t.value('#b'), '124,92,255', 'colour: default rgb');
  t.type('#hx', '#FF0000'); T.eq(t.value('#r') + ',' + t.value('#g') + ',' + t.value('#b'), '255,0,0', 'colour: red rgb'); T.eq(t.value('#h') + ',' + t.value('#s') + ',' + t.value('#l'), '0,100,50', 'colour: red hsl');
  t.type('#hx', '00ff00'); T.eq(t.value('#h') + ',' + t.value('#s') + ',' + t.value('#l'), '120,100,50', 'colour: green hsl (no # typed)');
  t.type('#hx', '#abc'); T.eq(t.value('#pk'), '#aabbcc', 'colour: 3-digit hex is expanded');
  T.has(t.q('#css').textContent, 'rgb(170, 187, 204)', 'colour: css rgb line');
  t.type('#hx', '#xyz'); T.has(t.q('#css').textContent, 'rgb(170, 187, 204)', 'colour: invalid hex leaves the colour alone');
  t.type('#h', '210'); t.type('#s', '50'); t.type('#l', '50'); T.eq(t.value('#hx'), '#4080BF', 'colour: HSL 210,50,50 is #4080BF');
  t.type('#r', '10'); t.type('#g', '20'); t.type('#b', '30'); T.eq(t.value('#hx'), '#0A141E', 'colour: rgb to hex');
  T.eq(t.value('#h') + ',' + t.value('#s') + ',' + t.value('#l'), '210,50,8', 'colour: rgb to hsl');
  t.type('#r', '999'); T.eq(t.q('#sw').textContent, '#FF141E', 'colour: out of range channel is clamped in the swatch');
  t.type('#pk', '#112233'); T.eq(t.value('#hx'), '#112233', 'colour: picker updates hex');
  t.click('[data-i="1"]'); await tick(); T.eq(lastCp(), 'rgb(17, 34, 51)', 'colour: copy rgb');
  t.close();

  /* ---------- Lorem ---------- */
  t = await page.open('lorem');
  t.select('#u', 'words'); t.type('#n', '5'); t.click('#g');
  T.eq(t.value('#o'), 'lorem ipsum dolor sit amet', 'lorem: 5 words start the classic text');
  t.type('#n', '100'); t.click('#g'); T.eq(t.value('#o').split(' ').length, 100, 'lorem: 100 words');
  t.type('#n', '500'); t.click('#g'); T.eq(t.value('#o').split(' ').length, 100, 'lorem: counts above 100 are limited to 100');
  t.type('#n', '0'); t.click('#g'); T.eq(t.value('#o').split(' ').length, 1, 'lorem: zero becomes one');
  t.select('#u', 'sentences'); t.type('#n', '3');
  T.ok(t.value('#o').startsWith('Lorem ipsum dolor sit amet'), 'lorem: first sentence is the classic opening');
  T.eq((t.value('#o').match(/\./g) || []).length, 3, 'lorem: 3 sentences end in 3 full stops');
  t.select('#u', 'paragraphs'); t.type('#n', '4'); t.click('#g');
  T.eq(t.value('#o').split('\n\n').length, 4, 'lorem: 4 paragraphs'); T.ok(/^[A-Z]/.test(t.value('#o')), 'lorem: starts with a capital');
  t.check('#cl', false); t.select('#u', 'words'); t.type('#n', '8'); let anyOther = false; for (let i = 0; i < 20; i++) { t.click('#g'); if (!t.value('#o').startsWith('lorem ipsum dolor sit amet')) anyOther = true; }
  T.ok(anyOther, 'lorem: with the classic opening off the text is random');
  t.click('#cp'); await tick(); T.eq(lastCp(), t.value('#o'), 'lorem: copy');
  t.close();

  /* ---------- Binary & hex ---------- */
  t = await page.open('bytes');
  const bt = (mode, v) => { t.select('#m', mode); t.type('#i', v); return t.value('#u'); };
  T.eq(bt('0', 'A'), '01000001', 'bytes: A in binary'); T.eq(bt('0', 'Hi'), '01001000 01101001', 'bytes: Hi in binary');
  T.eq(bt('2', 'Hi'), '48 69', 'bytes: Hi in hex'); T.eq(bt('2', '€'), 'E2 82 AC', 'bytes: euro is three UTF-8 bytes');
  T.eq(bt('4', 'Hi'), '72 105', 'bytes: Hi in decimal'); T.eq(bt('6', 'A'), '101', 'bytes: A in octal');
  T.eq(bt('1', '01001000 01101001'), 'Hi', 'bytes: binary back to text'); T.eq(bt('1', '0100100001101001'), 'Hi', 'bytes: binary without spaces');
  T.eq(bt('3', '4869'), 'Hi', 'bytes: hex without spaces'); T.eq(bt('3', '0x48, 0x69'), 'Hi', 'bytes: hex with 0x and commas');
  T.eq(bt('3', 'E2 82 AC'), '€', 'bytes: hex to euro'); T.eq(bt('5', '72 105'), 'Hi', 'bytes: decimal to text'); T.eq(bt('7', '110 151'), 'Hi', 'bytes: octal to text');
  bt('5', '256'); T.has(t.text(), 'bigger than one byte', 'bytes: 256 is not a byte');
  bt('3', 'GG'); T.has(t.text(), 'not a base-16', 'bytes: bad hex digit');
  bt('3', 'FF'); T.has(t.text(), 'not valid UTF-8', 'bytes: invalid UTF-8 is reported');
  bt('0', '😀'); t.click('#sw'); T.eq(t.value('#u'), '😀', 'bytes: swap round trip for emoji');
  t.close();

  /* ---------- Emoji & symbols ---------- */
  t = await page.open('symbols');
  t.type('#q', 'heart'); T.ok(t.all('#grid button').some(b => b.dataset.c === '❤️'), 'symbols: search heart finds the red heart'); T.ok(t.all('#grid button').some(b => b.dataset.c === '♥'), 'symbols: search heart finds the heart suit');
  t.type('#q', 'euro'); T.ok(t.all('#grid button').some(b => b.dataset.c === '€'), 'symbols: search euro finds the euro sign');
  t.type('#q', 'rupee'); T.ok(t.all('#grid button').some(b => b.dataset.c === '₹'), 'symbols: search rupee finds ₹');
  t.type('#q', 'arrow'); T.ok(t.all('#grid button').some(b => b.dataset.c === '→'), 'symbols: search arrow finds →');
  t.type('#q', 'qqqq'); T.has(t.text(), 'Nothing found', 'symbols: nothing found message');
  t.type('#q', ''); t.select('#g', 'Greek'); T.ok(t.all('#grid button').some(b => b.dataset.c === 'ω'), 'symbols: Greek group');
  t.click('#grid button[data-c="α"]'); t.click('#grid button[data-c="β"]'); T.eq(t.value('#buf'), 'αβ', 'symbols: tapping adds to the text box');
  t.click('#cp'); await tick(); T.eq(lastCp(), 'αβ', 'symbols: copy'); t.click('#cl'); T.eq(t.value('#buf'), '', 'symbols: clear');
  T.ok(t.all('#grid button').every(b => b.getAttribute('aria-label')), 'symbols: every button has a label');
  t.close();

  /* ---------- Fancy text ---------- */
  t = await page.open('fancy');
  const fv = () => Object.fromEntries(t.all('#o .item').map(x => [x.querySelector('.muted').textContent, x.querySelector('div > div:nth-child(2)').textContent]));
  T.eq(fv()['Bold'], '𝐇𝐞𝐥𝐥𝐨 𝐖𝐨𝐫𝐥𝐝', 'fancy: default text is Hello World in bold');
  t.type('#i', 'Hello1');
  T.eq(fv()['Bold'], String.fromCodePoint(0x1D407, 0x1D41E, 0x1D425, 0x1D425, 0x1D428, 0x1D7CF), 'fancy: bold letters and digit by code point');
  T.eq(fv()['Italic'], String.fromCodePoint(0x1D43B) + String.fromCodePoint(0x1D452, 0x1D459, 0x1D459, 0x1D45C) + '1', 'fancy: italic');
  t.type('#i', 'h'); T.eq(fv()['Italic'], 'ℎ', 'fancy: italic h uses the Planck constant sign');
  t.type('#i', 'Hello'); T.eq(fv()['Upside down'], 'ollǝɥ', 'fancy: upside down reverses and flips');
  t.type('#i', 'A1'); T.eq(fv()['Circled'], 'Ⓐ①', 'fancy: circled'); T.eq(fv()['Fullwidth'], 'Ａ１', 'fancy: fullwidth');
  t.type('#i', 'Ab'); T.eq(fv()['Double-struck'], '𝔸𝕓', 'fancy: double-struck');
  t.type('#i', 'e'); T.eq(fv()['Script'], 'ℯ', 'fancy: script e exception');
  t.type('#i', '<b>x</b>'); T.ok(!t.has('#o b'), 'fancy: input is never injected as HTML');
  t.type('#i', 'ab'); t.click('[data-i="0"]'); await tick(); T.eq(lastCp(), '𝐚𝐛', 'fancy: copy a style');
  T.eq(Object.keys(fv()).length, 18, 'fancy: 18 styles offered');
  t.close();

  /* ---------- Diff ---------- */
  t = await page.open('diff');
  t.type('#a', 'a\nb\nc'); t.type('#b', 'a\nc\nd');
  T.has(t.q('#sm').textContent, '1 added, 1 removed', 'diff: line diff counts');
  T.has(t.q('#o').textContent, '- b', 'diff: removed line shown'); T.has(t.q('#o').textContent, '+ d', 'diff: added line shown');
  t.select('#m', 'w'); t.type('#a', 'the cat sat'); t.type('#b', 'the dog sat');
  T.has(t.q('#sm').textContent, '1 added, 1 removed', 'diff: word diff counts'); T.eq(t.all('#o span').map(s => s.textContent).join('|'), 'cat|dog', 'diff: word diff marks cat and dog');
  t.select('#m', 'c'); t.type('#a', 'kitten'); t.type('#b', 'sitting');
  T.has(t.q('#sm').textContent, '3 added, 2 removed', 'diff: character diff of kitten/sitting (LCS 4)');
  t.type('#b', 'kitten'); T.eq(t.q('#sm').textContent, 'No differences', 'diff: identical texts');
  t.select('#m', 'l'); t.type('#a', '<img src=x onerror=1>'); t.type('#b', '');
  T.ok(!t.has('#o img'), 'diff: html in the text is escaped');
  const long = Array.from({ length: 2100 }, (_, i) => 'l' + i).join('\n'), long2 = Array.from({ length: 2100 }, (_, i) => 'm' + i).join('\n');
  t.type('#a', long); t.type('#b', long2); T.has(t.q('#sm').textContent, 'too long', 'diff: very long texts give a message, not a freeze');
  t.type('#a', ''); t.type('#b', ''); T.eq(t.q('#sm').textContent, '', 'diff: empty has no summary');
  t.close();

  /* ---------- Regex ---------- */
  t = await page.open('regex');
  const rx = async (p, f, text, rep) => { t.type('#p', p); t.type('#f', f); t.type('#t', text); t.type('#r', rep || ''); await page.wait(400); };
  await rx('(\\d+)-(\\w+)', 'g', 'a 12-ab, 7-z', '$2:$1');
  T.eq(t.q('#cnt').textContent, '2 matches', 'regex: two matches'); T.eq(t.value('#ro'), 'a ab:12, z:7', 'regex: replace with groups');
  T.has(t.q('#ml').textContent, 'group 1: 12', 'regex: group 1 shown'); T.has(t.q('#ml').textContent, 'group 2: ab', 'regex: group 2 shown');
  T.eq(t.all('#hl mark').map(m => m.textContent).join('|'), '12-ab|7-z', 'regex: highlighted matches');
  await rx('cat', 'gi', 'Cat CAT dog', 'X'); T.eq(t.q('#cnt').textContent, '2 matches', 'regex: ignore case flag'); T.eq(t.value('#ro'), 'X X dog', 'regex: replace all');
  await rx('cat', 'g', 'a cat', 'X'); T.eq(t.q('#cnt').textContent, '1 match', 'regex: singular match');
  await rx('x*', 'g', 'abc', '-'); T.eq(t.q('#cnt').textContent, '4 matches', 'regex: empty matches are counted once per position');
  await rx('(', 'g', 'abc'); T.ok(!t.q('#e').hidden, 'regex: invalid pattern shows an error'); T.has(t.q('#e').textContent, 'nvalid', 'regex: error text from the engine');
  await rx('<b>', 'g', 'a <b> c'); T.ok(!t.has('#hl b'), 'regex: highlighted text is escaped'); T.eq(t.q('#cnt').textContent, '1 match', 'regex: angle bracket match');
  await rx('\\p{L}+', 'gu', 'héllo wörld', '[$&]'); T.eq(t.value('#ro'), '[héllo] [wörld]', 'regex: unicode flag and $&');
  await rx('a', 'g', 'a'.repeat(600)); T.has(t.q('#cnt').textContent, 'showing first 500', 'regex: match list is capped at 500');
  await rx('', 'g', 'keep'); T.eq(t.value('#ro'), 'keep', 'regex: empty pattern leaves the text unchanged'); T.eq(t.q('#cnt').textContent, '', 'regex: empty pattern has no count');
  await rx('b', 'g', 'abc'); t.click('#cp'); await tick(); T.eq(lastCp(), 'ac', 'regex: copy result');
  t.close();

  /* ---------- Case & slug ---------- */
  t = await page.open('cases');
  const cs = (mode, v) => { t.select('#m', mode); t.type('#i', v); return t.value('#u'); };
  const S = 'My Great Blog Post Title';
  T.eq(cs('0', S), 'my-great-blog-post-title', 'cases: slug'); T.eq(cs('1', S), 'myGreatBlogPostTitle', 'cases: camel'); T.eq(cs('2', S), 'MyGreatBlogPostTitle', 'cases: pascal');
  T.eq(cs('3', S), 'my_great_blog_post_title', 'cases: snake'); T.eq(cs('4', S), 'my-great-blog-post-title', 'cases: kebab'); T.eq(cs('5', S), 'MY_GREAT_BLOG_POST_TITLE', 'cases: constant'); T.eq(cs('6', S), 'my.great.blog.post.title', 'cases: dot');
  T.eq(cs('3', 'XMLHttpRequest'), 'xml_http_request', 'cases: acronym boundary'); T.eq(cs('3', 'userID2Name'), 'user_id2_name', 'cases: digits stay attached');
  T.eq(cs('0', "Don't Stop — Crème Brûlée!"), 'dont-stop-creme-brulee', 'cases: slug drops accents and punctuation'); T.eq(cs('0', 'नमस्ते दुनिया'), 'नमस्ते-दुनिया', 'cases: slug keeps Devanagari vowel signs');
  T.eq(cs('4', 'İstanbul İZMİR'), 'istanbul-izmir', 'cases: Turkish dotted I gives plain i'); T.eq(cs('5', 'straße'), 'STRASSE', 'cases: sharp s in constant case'); T.eq(cs('2', 'ßa x'), 'SsaX', 'cases: pascal of sharp s uses Ss');
  T.eq(cs('1', 'one two\nthree four'), 'oneTwo\nthreeFour', 'cases: each line converted separately');
  T.eq(cs('4', ''), '', 'cases: empty');
  t.type('#i', 'a b'); t.click('#cp'); await tick(); T.eq(lastCp(), 'a-b', 'cases: copy');
  t.close();

  /* ---------- Number sorter ---------- */
  t = await page.open('numsort');
  const ns = (v) => { t.type('#i', v); return t.value('#r'); }, st = (n) => { const d = [...t.q('#st').children].find(x => x.textContent.includes(n)); return d.firstElementChild.textContent; };
  T.eq(ns('5, 3, 9, 3, 1'), '1, 3, 3, 5, 9', 'numsort: sorted'); T.eq(st('Count'), '5', 'numsort: count'); T.eq(st('Sum'), '21', 'numsort: sum'); T.eq(st('Average'), '4.2', 'numsort: average'); T.eq(st('Median'), '3', 'numsort: median odd'); T.eq(st('Smallest'), '1', 'numsort: min'); T.eq(st('Largest'), '9', 'numsort: max');
  t.check('#dd', true); T.eq(t.value('#r'), '1, 3, 5, 9', 'numsort: remove duplicates'); t.check('#dd', false);
  t.select('#o', 'd'); T.eq(t.value('#r'), '9, 5, 3, 3, 1', 'numsort: largest first'); t.select('#o', 'a');
  ns('4 1 3 2'); T.eq(st('Median'), '2.5', 'numsort: median even'); T.eq(ns('0.1 0.2'), '0.1, 0.2', 'numsort: decimals'); T.eq(st('Sum'), '0.3', 'numsort: 0.1 + 0.2 shows 0.3');
  T.eq(ns('1,234 5'), '5, 1234', 'numsort: 1,234 is a thousands separator'); T.eq(ns('-2\n+3\n1e2'), '-2, 3, 100', 'numsort: signs and exponent on separate lines');
  ns('1 abc 3'); T.has(t.q('#st').textContent, '"abc" is not a number', 'numsort: bad token named'); T.eq(t.value('#r'), '', 'numsort: no result with a bad token');
  ns(''); T.has(t.q('#st').textContent, 'No numbers yet', 'numsort: empty state');
  ns('3 1 2'); t.click('#cp'); await tick(); T.eq(lastCp(), '1, 2, 3', 'numsort: copy');
  t.close();

  /* ---------- CSV ---------- */
  t = await page.open('csv');
  const csv = 'name,age\n"Smith, Jo",36\n"He said ""hi""",29\n"two\nlines",1';
  t.type('#i', csv);
  T.has(t.q('#sm').textContent, '4 rows, 2 columns', 'csv: row and column count');
  const cells = () => t.all('#o td').map(x => x.textContent);
  T.eq(cells().join('|'), 'Smith, Jo|36|He said "hi"|29|two\nlines|1', 'csv: quoted commas, doubled quotes and embedded newlines');
  T.eq(t.all('#o th').map(x => x.textContent).join('|'), 'name|age', 'csv: header row');
  t.select('#v', 'j');
  T.eq(JSON.parse(t.q('#o textarea').value)[1].name, 'He said "hi"', 'csv: JSON view'); T.eq(JSON.parse(t.q('#o textarea').value).length, 3, 'csv: JSON has one object per data row');
  t.click('#cp'); await tick(); T.eq(JSON.parse(lastCp())[0].age, '36', 'csv: copy JSON (values stay text)');
  t.check('#hd', false); T.eq(JSON.parse(t.q('#o textarea').value)[0].join('|'), 'name|age', 'csv: no header gives an array of arrays');
  t.check('#hd', true); t.select('#v', 't');
  t.type('#i', 'a;b\n1;2'); T.has(t.q('#sm').textContent, '2 rows, 2 columns', 'csv: semicolon detected'); T.eq(cells().join('|'), '1|2', 'csv: semicolon cells');
  t.type('#i', 'a\tb\n1\t2'); T.eq(cells().join('|'), '1|2', 'csv: tab detected');
  t.type('#i', 'a|b\n1|2'); T.eq(cells().join('|'), '1|2', 'csv: pipe detected');
  t.type('#i', 'a,b\r\n1,2\r\n'); T.has(t.q('#sm').textContent, '2 rows', 'csv: Windows line endings');
  t.type('#i', '﻿name,age\nAda,36'); T.eq(t.all('#o th').map(x => x.textContent).join('|'), 'name|age', 'csv: a byte order mark does not stick to the first header');
  t.type('#i', 'x,x,\n1,2,3'); t.select('#v', 'j'); T.eq(Object.keys(JSON.parse(t.q('#o textarea').value)[0]).join('|'), 'x|x_2|col3', 'csv: duplicate and empty headers made unique');
  t.type('#i', '__proto__,b\n1,2'); T.eq(Object.keys(JSON.parse(t.q('#o textarea').value)[0]).join('|'), '__proto__|b', 'csv: __proto__ is just a column name');
  t.select('#v', 't'); t.type('#i', 'h\n<img src=x onerror=1>'); T.ok(!t.has('#o img'), 'csv: cells are escaped');
  t.type('#i', 'h\n' + Array.from({ length: 350 }, (_, i) => i).join('\n')); T.has(t.text(), 'Showing first 300 rows', 'csv: large tables are cut at 300 rows');
  t.select('#d', ';'); t.type('#i', 'a;b\n1;2'); T.eq(cells().join('|'), '1|2', 'csv: chosen separator');
  t.type('#i', ''); T.eq(t.q('#sm').textContent, '', 'csv: empty'); t.click('#cp'); await tick(); T.ok(true, 'csv: copy with nothing does not throw');
  t.close();

  await T.done(page);
})();
