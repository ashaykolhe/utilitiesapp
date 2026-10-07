'use strict';
/* Functional tests for the text tools, part 3: markdown, checklist, freq, readtime, smscount, caesar, piglatin, nato, braille, t9, epoch, uuid, picker, scratch,
   plus pure checks of the barcode encoders. */
process.env.TZ = 'Asia/Kolkata'; // fixed zone so the "your local time" conversions have a known answer (UTC+5:30, no daylight saving)
const fs = require('fs'), path = require('path'), vm = require('vm');
const { boot, suite } = require('../helpers/page');

/* The pure logic (TX) loaded outside the page for encoder checks. */
const ctx = { module: { exports: {} }, Tools: { register() {} }, TextEncoder, TextDecoder, crypto: require('crypto').webcrypto, btoa, atob, console };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', '..', 'www', 'js', 'tools', 'text.js'), 'utf8'), ctx);
const TX = ctx.module.exports;

(async () => {
  const T = suite('text3'), page = await boot();
  const w = page.w;
  page.eval(`window.__cp = []; window.copyToClipboard = async (t) => { __cp.push(String(t)); return true; };`);
  const lastCp = () => w.__cp[w.__cp.length - 1];
  const tick = () => page.wait(20);
  const toastText = () => w.document.getElementById('toast').textContent;
  let t;

  /* ---------- Markdown ---------- */
  t = await page.open('markdown');
  const md = (v) => { t.type('#i', v); return t.q('#o').innerHTML; };
  T.eq(md('# Title\n\nSome **bold** and *italic* text.\n\n- a\n- b'), '<h1>Title</h1>\n<p>Some <b>bold</b> and <i>italic</i> text.</p>\n<ul><li>a</li><li>b</li></ul>', 'markdown: heading, emphasis and list');
  T.eq(md('1. one\n2. two'), '<ol><li>one</li><li>two</li></ol>', 'markdown: ordered list');
  T.eq(md('> quoted\n\n---\n\n~~gone~~'), '<blockquote>quoted</blockquote>\n<hr>\n<p><s>gone</s></p>', 'markdown: quote, rule, strikethrough');
  T.eq(md('```\n<b>x</b>\n```'), '<pre><code>&lt;b&gt;x&lt;/b&gt;</code></pre>', 'markdown: code block is escaped');
  T.eq(md('use `<b>` here'), '<p>use <code>&lt;b&gt;</code> here</p>', 'markdown: inline code is escaped');
  T.eq(md('snake_case_word and 2*3*4'), '<p>snake_case_word and 2<i>3</i>4</p>', 'markdown: underscores inside words are not italic');
  T.eq(md('[ok](https://a.com/x_y_z)'), '<p><a href="https://a.com/x_y_z">ok</a></p>', 'markdown: link keeps underscores in the address');
  md('<script>window.__pwn=1</script><img src=x onerror=window.__pwn=1>');
  T.ok(!t.has('#o script') && !t.has('#o img'), 'markdown: raw HTML is escaped, not run'); T.has(t.q('#o').textContent, '<script>', 'markdown: the tags show as text');
  md('[x](javascript:alert(1)) [y](JaVaScRiPt:alert(2)) [z](data:text/html,hi)');
  T.ok(!t.has('#o a'), 'markdown: javascript: and data: links are not made into links');
  md('[x](https://a.com/"onmouseover=window.__pwn=1)');
  T.ok(t.all('#o a').every(a => !a.hasAttribute('onmouseover')), 'markdown: a quote in a link address cannot add an attribute');
  T.eq(md('[m](mailto:a@b.c) [h](#top)'), '<p><a href="mailto:a@b.c">m</a> <a href="#top">h</a></p>', 'markdown: mailto and in-page links');
  T.eq(md('**unclosed *x'), '<p>**unclosed *x</p>', 'markdown: unmatched markers stay as typed');
  T.eq(md('2 * 3 * 4 and a ** b'), '<p>2 * 3 * 4 and a ** b</p>', 'markdown: spaced asterisks are not emphasis');
  T.eq(md('a\nb'), '<p>a b</p>', 'markdown: soft line break joins');
  t.type('#i', '# Hi'); t.click('#cp'); await tick(); T.eq(lastCp(), '<h1>Hi</h1>', 'markdown: copy HTML');
  t.type('#i', '[x](https://a.com)'); const ev = new w.MouseEvent('click', { bubbles: true, cancelable: true }); t.q('#o a').dispatchEvent(ev); T.ok(ev.defaultPrevented, 'markdown: tapping a link in the preview does not navigate away');
  t.close();

  /* ---------- Checklist ---------- */
  w.localStorage.clear();
  t = await page.open('checklist');
  T.has(t.text(), 'Nothing here yet', 'checklist: empty state');
  t.type('#i', '   '); t.click('#add'); T.has(t.text(), 'Nothing here yet', 'checklist: blank item ignored');
  t.type('#i', 'Milk'); t.click('#add'); t.type('#i', '<b>Eggs</b>'); t.q('#i').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  T.has(t.text(), '0 of 2 done', 'checklist: two items, Enter adds'); T.eq(t.value('#i'), '', 'checklist: field emptied after add'); T.ok(!t.has('#l b'), 'checklist: item text is escaped');
  t.click('input[data-t="0"]'); T.has(t.text(), '1 of 2 done', 'checklist: tick'); T.eq(t.q('#bar').style.width, '50%', 'checklist: progress bar');
  T.eq(JSON.parse(w.localStorage.getItem('pk.todo.items'))[0].d, true, 'checklist: tick saved');
  T.ok(t.q('input[data-t="0"]').getAttribute('aria-label').includes('Milk'), 'checklist: checkbox has a label');
  t.close(); t = await page.open('checklist'); T.has(t.text(), '1 of 2 done', 'checklist: persists after reopen');
  t.click('#cd'); T.has(t.text(), '0 of 1 done', 'checklist: clear ticked'); T.has(t.text(), 'Eggs', 'checklist: unticked item stays');
  t.click('[data-x="0"]'); T.has(t.text(), 'Nothing here yet', 'checklist: delete');
  w.localStorage.setItem('pk.todo.items', JSON.stringify(Array.from({ length: 300 }, (_, i) => ({ t: 'i' + i, d: false })))); t.close(); t = await page.open('checklist');
  t.type('#i', 'one more'); t.click('#add'); T.has(toastText(), 'List is full', 'checklist: 300 item limit'); T.has(t.text(), '0 of 300 done', 'checklist: still 300');
  t.close();

  /* ---------- Word frequency ---------- */
  t = await page.open('freq');
  const fq = () => t.all('#o .item').map(x => x.querySelector('.grow > div').textContent + ':' + x.querySelector('b').textContent).join(' ');
  t.type('#i', 'The cat and the dog and the cat');
  T.eq(fq(), 'cat:2 dog:1', 'freq: common words skipped'); T.has(t.q('#sm').textContent, '3 words counted, 2 different', 'freq: summary');
  t.check('#st', false); T.eq(fq(), 'the:3 and:2 cat:2 dog:1', 'freq: all words, ties alphabetical');
  t.type('#i', "Don't don’t DON'T"); T.eq(fq(), "don't:3", 'freq: straight and curly apostrophes count as one word');
  t.type('#i', 'Ünï ünï ÜNÏ élan'); T.eq(fq(), 'ünï:3 élan:1', 'freq: accented words are folded to lower case');
  t.type('#i', 'a a b'); t.click('#cp'); await tick(); T.eq(lastCp(), 'a\t2\nb\t1', 'freq: copy list');
  t.type('#i', ''); T.eq(fq(), '', 'freq: empty'); t.close();

  /* ---------- Reading time ---------- */
  t = await page.open('readtime');
  t.type('#i', Array(400).fill('word').join(' '));
  T.eq(t.q('#r').textContent, '2 min 0 sec', 'readtime: 400 words at 200 wpm'); T.eq(t.q('#s').textContent, '3 min 5 sec', 'readtime: 400 words spoken at 130 wpm');
  t.select('#w', '300'); T.eq(t.q('#r').textContent, '1 min 20 sec', 'readtime: fast reader'); T.eq(t.q('#n').textContent, '400 words', 'readtime: word count');
  t.type('#i', 'one'); T.eq(t.q('#n').textContent, '1 word', 'readtime: singular'); T.eq(t.q('#r').textContent, 'under 1 sec', 'readtime: one word is not "0 sec"');
  t.type('#i', ''); T.eq(t.q('#r').textContent, '0 sec', 'readtime: empty'); t.close();

  /* ---------- SMS counter ---------- */
  t = await page.open('smscount');
  t.type('#i', 'Hello'); T.eq(t.q('#sg').textContent, '1', 'sms: 1 part'); T.eq(t.q('#lf').textContent, '155', 'sms: 155 left'); T.eq(t.q('#tw').textContent, '5 / 280', 'sms: tweet length');
  t.type('#i', 'a'.repeat(160)); T.eq(t.q('#sg').textContent, '1', 'sms: 160 GSM chars fit one part'); T.eq(t.q('#lf').textContent, '0', 'sms: 0 left');
  t.type('#i', 'a'.repeat(161)); T.eq(t.q('#sg').textContent, '2', 'sms: 161 chars need 2 parts'); T.eq(t.q('#lf').textContent, '145', 'sms: 145 left in 2 parts of 153');
  t.type('#i', '€'); T.has(t.q('#en').textContent, '2 units', 'sms: euro costs 2 GSM units');
  t.type('#i', '😀'); T.eq(t.q('#lf').textContent, '68', 'sms: emoji switches to Unicode (70 per part)'); T.has(t.q('#en').textContent, 'Unicode', 'sms: Unicode label'); T.eq(t.q('#tw').textContent, '2 / 280', 'sms: emoji counts 2 for a tweet');
  t.type('#i', 'a'.repeat(71) + 'é'.repeat(0) + '😀'); T.eq(t.q('#sg').textContent, '2', 'sms: 73 Unicode units are 2 parts');
  t.type('#i', 'https://example.com/a/very/long/path hi'); T.eq(t.q('#tw').textContent, '26 / 280', 'sms: a link counts as 23');
  t.type('#i', 'a'.repeat(281)); T.eq(t.q('#tw').style.color, 'var(--danger)', 'sms: over 280 turns red');
  t.type('#i', 'ß é ü'); T.has(t.q('#en').textContent, 'GSM-7', 'sms: ß é ü are in the GSM alphabet');
  t.close();

  /* ---------- Caesar ---------- */
  t = await page.open('caesar');
  t.type('#i', 'Hello, World! é'); T.eq(t.value('#o'), 'Khoor, Zruog! é', 'caesar: shift 3, punctuation and accents untouched');
  t.select('#m', '-1'); t.type('#i', 'Khoor, Zruog!'); T.eq(t.value('#o'), 'Hello, World!', 'caesar: decode');
  t.select('#m', '1'); t.click('#r13'); t.type('#i', 'Hello'); T.eq(t.value('#o'), 'Uryyb', 'caesar: ROT13'); t.type('#i', 'Uryyb'); T.eq(t.value('#o'), 'Hello', 'caesar: ROT13 twice returns the text');
  t.type('#k', '30'); t.type('#i', 'abc'); T.eq(t.value('#o'), 'zab', 'caesar: shift is limited to 25');
  t.type('#k', '1'); t.type('#i', 'xyz XYZ'); T.eq(t.value('#o'), 'yza YZA', 'caesar: wraps around');
  t.click('#all'); T.eq(t.all('#al .item').length, 25, 'caesar: 25 shifts listed');
  t.type('#i', 'abc'); T.has(t.all('#al .item')[12].textContent, 'nop', 'caesar: list follows the input (13 shifts abc to nop)');
  t.click('#all'); T.eq(t.q('#al').innerHTML, '', 'caesar: list can be hidden');
  t.type('#i', 'abc'); t.click('#cp'); await tick(); T.eq(lastCp(), t.value('#o'), 'caesar: copy'); t.close();

  /* ---------- Pig Latin / NATO / Braille / T9 ---------- */
  t = await page.open('piglatin');
  const pg = (v) => { t.type('#i', v); return t.value('#u'); };
  T.eq(pg('Hello world'), 'Ellohay orldway', 'piglatin: Hello world'); T.eq(pg('apple eat'), 'appleway eatway', 'piglatin: vowel words get way');
  T.eq(pg('string queen'), 'ingstray eenquay', 'piglatin: consonant clusters and qu'); T.eq(pg('HELLO'), 'ELLOHAY', 'piglatin: capitals'); T.eq(pg('rhythm'), 'ythmrhay', 'piglatin: y acts as a vowel');
  T.eq(pg("Hello, World! it's 42"), "Ellohay, Orldway! it'sway 42", 'piglatin: punctuation and digits stay'); T.eq(pg(''), '', 'piglatin: empty'); t.close();

  t = await page.open('nato');
  const na = (m, v) => { t.select('#m', m); t.type('#i', v); return t.value('#u'); };
  T.eq(na('0', 'Hello 42'), 'Hotel Echo Lima Lima Oscar / Four Two', 'nato: Hello 42'); T.eq(na('0', 'sos'), 'Sierra Oscar Sierra', 'nato: SOS');
  na('0', 'a-b?'); T.has(t.q('#nt').textContent, 'Unsupported characters ignored (2)', 'nato: unsupported characters are counted');
  T.eq(na('1', 'Hotel Echo Lima Lima Oscar / Four Two'), 'HELLO 42', 'nato: decode'); T.eq(na('1', 'alpha juliet X-ray niner'), 'AJX9', 'nato: spelling variants'); T.eq(na('1', 'Foo'), '?', 'nato: unknown word is ?');
  t.close();

  t = await page.open('braille');
  const br = (m, v) => { t.select('#m', m); t.type('#i', v); return t.value('#u'); };
  T.eq(br('0', 'Hello'), '⠠⠓⠑⠇⠇⠕', 'braille: Hello (capital sign then h e l l o)'); T.eq(br('0', 'abc'), '⠁⠃⠉', 'braille: abc');
  T.eq(br('0', '2024'), '⠼⠃⠚⠃⠙', 'braille: number sign then b j b d'); T.eq(br('0', 'HELLO'), '⠠⠠⠓⠑⠇⠇⠕', 'braille: all-capitals word');
  br('0', 'a€'); T.has(t.q('#nt').textContent, 'Unsupported characters ignored (1)', 'braille: unsupported are counted');
  T.eq(br('1', '⠠⠓⠑⠇⠇⠕ ⠼⠁⠃'), 'Hello 12', 'braille: decode'); T.eq(br('0', 'Hello World 2024'), '⠠⠓⠑⠇⠇⠕ ⠠⠺⠕⠗⠇⠙ ⠼⠃⠚⠃⠙', 'braille: sentence'); t.click('#sw'); T.eq(t.value('#u'), 'Hello World 2024', 'braille: round trip'); t.close();

  t = await page.open('t9');
  const kp = (m, v) => { t.select('#m', m); t.type('#i', v); return t.value('#u'); };
  T.eq(kp('0', 'hello world'), '44 33 555 555 666 0 9 666 777 555 3', 'keypad: multi-tap'); T.eq(kp('2', 'hello'), '43556', 'keypad: T9 digits');
  T.eq(kp('1', '44 33 555 555 666 0 9 666 777 555 3'), 'hello world', 'keypad: multi-tap back'); T.eq(kp('1', '7777 9999 77777'), 'szp', 'keypad: 4 taps, 4 taps and 5 taps wrap on key 7');
  kp('0', 'ab#c'); T.has(t.q('#nt').textContent, 'Skipped 1 character', 'keypad: unsupported characters are reported');
  T.eq(kp('1', '12'), '?', 'keypad: mixed digits are ?'); T.eq(kp('0', 'a1'), '2', 'keypad: digits in the text are skipped'); t.close();

  /* ---------- Timestamp ---------- */
  t = await page.open('epoch');
  const ep = () => Object.fromEntries(t.all('.item').map(x => [x.querySelector('.muted').textContent, x.querySelector('div > div:nth-child(2)').textContent]));
  T.near(+t.q('#now').textContent, Math.floor(Date.now() / 1000), 2, 'epoch: live clock shows Unix seconds');
  t.type('#ts', '1700000000'); T.eq(ep()['UTC'], 'Tue, 14 Nov 2023 22:13:20 GMT', 'epoch: seconds to UTC'); T.eq(ep()['ISO 8601'], '2023-11-14T22:13:20.000Z', 'epoch: seconds to ISO');
  t.type('#ts', '1700000000000'); T.eq(ep()['ISO 8601'], '2023-11-14T22:13:20.000Z', 'epoch: milliseconds detected');
  t.type('#ts', '0'); T.eq(ep()['ISO 8601'], '1970-01-01T00:00:00.000Z', 'epoch: zero'); t.type('#ts', '-1'); T.eq(ep()['ISO 8601'], '1969-12-31T23:59:59.000Z', 'epoch: negative');
  t.type('#ts', '1700000000,5'); T.eq(ep()['ISO 8601'], '2023-11-14T22:13:20.500Z', 'epoch: decimal comma');
  t.type('#ts', '99999999999999999999'); T.has(t.text(), 'Enter a valid number', 'epoch: out of range is a message, not a crash');
  t.type('#ts', 'abc'); T.has(t.text(), 'Enter a valid number', 'epoch: text is a message');
  t.type('#ts', String(Math.floor(Date.now() / 1000) + 7205)); T.eq(ep()['Relative'], 'in 2 hours', 'epoch: relative future');
  t.type('#ts', String(Math.floor(Date.now() / 1000) - 86400 * 3 - 5)); T.eq(ep()['Relative'], '3 days ago', 'epoch: relative past');
  t.type('#ts', '1700000000'); t.click('#res [data-v]'); await tick(); T.eq(lastCp(), 'Tue, 14 Nov 2023 22:13:20 GMT', 'epoch: copy a row');
  t.type('#dt', '2023-11-14T22:13'); T.eq(ep()['Seconds'], '1699980180', 'epoch: local date (IST) to seconds'); T.eq(ep()['ISO 8601 (UTC)'], '2023-11-14T16:43:00.000Z', 'epoch: local date to UTC ISO'); T.eq(ep()['Milliseconds'], '1699980180000', 'epoch: milliseconds');
  t.type('#dt', ''); T.eq(t.q('#res2').innerHTML, '', 'epoch: cleared date');
  t.click('#cn'); await tick(); T.ok(/^\d{10}$/.test(lastCp()), 'epoch: copy now');
  t.close();

  /* ---------- UUID ---------- */
  t = await page.open('uuid');
  const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  let ids = t.value('#o').split('\n'); T.eq(ids.length, 5, 'uuid: five by default'); T.ok(ids.every(x => V4.test(x)), 'uuid: version 4 and variant bits');
  t.type('#n', '50'); ids = t.value('#o').split('\n'); T.eq(ids.length, 50, 'uuid: fifty'); T.eq(new Set(ids).size, 50, 'uuid: all different'); T.ok(ids.every(x => V4.test(x)), 'uuid: all valid');
  t.type('#n', '0'); T.eq(t.value('#o').split('\n').length, 1, 'uuid: zero becomes one'); t.type('#n', '99'); T.eq(t.value('#o').split('\n').length, 50, 'uuid: capped at 50');
  t.type('#n', '3'); t.check('#up', true); T.ok(t.value('#o').split('\n').every(x => /^[0-9A-F-]{36}$/.test(x)), 'uuid: upper case applies at once');
  t.check('#nd', true); T.ok(t.value('#o').split('\n').every(x => /^[0-9A-F]{32}$/.test(x)), 'uuid: no dashes');
  t.click('#g'); const a = t.value('#o'); t.click('#g'); T.ok(a !== t.value('#o'), 'uuid: Generate gives new ones');
  t.click('#cp'); await tick(); T.eq(lastCp(), t.value('#o'), 'uuid: copy all');
  T.eq(TX.uuid4([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]), '00010203-0405-4607-8809-0a0b0c0d0e0f', 'uuid: version and variant bits are forced onto known bytes');
  T.eq(TX.uuid4(new Array(16).fill(255)), 'ffffffff-ffff-4fff-bfff-ffffffffffff', 'uuid: all-ones bytes');
  t.close();

  /* ---------- Name picker ---------- */
  w.localStorage.clear();
  t = await page.open('picker');
  t.click('#pk'); T.has(toastText(), 'Add some names first', 'picker: no names');
  t.type('#n', 'Ann\n Ben \n\nCara\nDev\nEli\n<i>Fay</i>\nGus');
  T.eq(JSON.parse(w.localStorage.getItem('pk.picker.names')), 'Ann\n Ben \n\nCara\nDev\nEli\n<i>Fay</i>\nGus', 'picker: names are remembered');
  t.click('#pk'); await page.wait(1500); const names = ['Ann', 'Ben', 'Cara', 'Dev', 'Eli', '<i>Fay</i>', 'Gus'];
  T.ok(names.includes(t.q('#w').textContent), 'picker: the winner is one of the names (' + t.q('#w').textContent + ')'); T.ok(!t.has('#w i'), 'picker: winner is shown as text');
  t.select('#k', '3'); t.click('#tm');
  const cards = t.all('#o .card'); T.eq(cards.length, 3, 'picker: three teams');
  const members = cards.flatMap(c => c.querySelector('div').textContent.split(', ')); T.eq(members.slice().sort().join('|'), names.slice().sort().join('|'), 'picker: everyone is in exactly one team');
  T.eq(cards.map(c => c.querySelector('div').textContent.split(', ').length).sort().join(), '2,2,3', 'picker: 7 people in 3 teams are 3, 2 and 2'); T.ok(!t.has('#o i'), 'picker: names in teams are escaped');
  t.select('#k', '10'); t.click('#tm'); T.eq(t.all('#o .card').length, 7, 'picker: more teams than names gives one each');
  t.type('#n', 'Solo'); t.click('#tm'); T.has(toastText(), 'Add at least 2 names', 'picker: teams need two names');
  /* shuffle and teams are fair: known random source, and every size differs by at most one */
  T.eq(TX.shuffle([1, 2, 3, 4], () => 0).join(), '2,3,4,1', 'picker: shuffle with a fixed source is a permutation');
  const tm = TX.teams(Array.from({ length: 23 }, (_, i) => 'n' + i), 5); T.eq(tm.reduce((s, x) => s + x.length, 0), 23, 'picker: teams keep every name'); T.ok(Math.max(...tm.map(x => x.length)) - Math.min(...tm.map(x => x.length)) <= 1, 'picker: team sizes differ by at most one');
  const cnt = [0, 0, 0, 0]; for (let i = 0; i < 4000; i++) cnt[TX.shuffle([0, 1, 2, 3])[0]]++; T.ok(cnt.every(c => c > 800 && c < 1200), 'picker: shuffled first place is evenly spread ' + cnt);
  t.close();

  /* ---------- Scratchpad ---------- */
  w.localStorage.clear();
  t = await page.open('scratch');
  T.has(t.text(), 'No snippets yet', 'scratch: empty state');
  t.type('#i', '   '); t.click('#add'); T.has(t.text(), 'No snippets yet', 'scratch: blank not saved');
  t.type('#i', 'first <b>snippet</b>'); t.click('#add'); T.eq(t.value('#i'), '', 'scratch: field cleared'); t.type('#i', 'second'); t.click('#add');
  T.eq(JSON.parse(w.localStorage.getItem('pk.scratch.items')).join('|'), 'second|first <b>snippet</b>', 'scratch: newest first, saved'); T.ok(!t.has('#l b'), 'scratch: escaped');
  t.click('[data-c="1"]'); await tick(); T.eq(lastCp(), 'first <b>snippet</b>', 'scratch: copy a snippet');
  t.click('[data-x="0"]'); T.eq(JSON.parse(w.localStorage.getItem('pk.scratch.items')).join('|'), 'first <b>snippet</b>', 'scratch: delete');
  Object.defineProperty(w.navigator, 'clipboard', { value: { readText: async () => 'pasted text' }, configurable: true });
  t.click('#ps'); await tick(); T.eq(t.value('#i'), 'pasted text', 'scratch: paste button fills the box');
  Object.defineProperty(w.navigator, 'clipboard', { value: { readText: async () => { throw new Error('denied'); } }, configurable: true });
  t.click('#ps'); await tick(); T.has(toastText(), 'Paste is not allowed', 'scratch: paste refused gives a hint');
  w.localStorage.setItem('pk.scratch.items', JSON.stringify(Array.from({ length: 60 }, (_, i) => 's' + i))); t.close(); t = await page.open('scratch');
  t.type('#i', 'one more'); t.click('#add'); T.has(toastText(), 'Scratchpad is full', 'scratch: 60 snippet limit'); T.eq(t.value('#i'), 'one more', 'scratch: text kept when full');
  t.close();

  /* ---------- Barcode encoders (pure) ---------- */
  const c = TX.code128('PJJ123C');
  T.eq(c.values.join(','), '104,48,42,42,17,18,19,35,55,106', 'code128: PJJ123C in subset B has checksum 55 (Wikipedia example gives 54 with start A, 55 with start B)');
  T.eq(c.bits.length, 112, 'code128: 9 symbols of 11 modules plus the 13-module stop');
  T.eq(TX.C128[0] + ' ' + TX.C128[104] + ' ' + TX.C128[105] + ' ' + TX.C128[106], '212222 211214 211232 2331112', 'code128: space, start B, start C and stop patterns');
  T.ok(TX.C128.slice(0, 106).every(p => [...p].reduce((s, d) => s + +d, 0) === 11), 'code128: every symbol is 11 modules wide');
  const c4 = TX.code128('1234'); T.eq(c4.values.join(','), '105,12,34,82,106', 'code128: even digit runs use subset C'); T.eq(TX.code128('123').values[0], 104, 'code128: odd digit runs stay in subset B'); T.eq(TX.code128('é'), null, 'code128: non-ASCII not encodable');
  /* independent EAN-13 decoder: L-codes from the standard, G = reversed R, R = bitwise inverse of L */
  const LC = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'], inv = (s) => [...s].map(x => x === '1' ? '0' : '1').join('');
  const GC = LC.map(x => [...inv(x)].reverse().join('')), RC = LC.map(inv), PAR = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
  const decodeEAN = (bits) => { const s = bits.join(''); if (s.length !== 95 || s.slice(0, 3) !== '101' || s.slice(45, 50) !== '01010' || s.slice(92) !== '101') return null; let d = '', par = ''; for (let i = 0; i < 6; i++) { const ch = s.substr(3 + i * 7, 7); if (LC.includes(ch)) { d += LC.indexOf(ch); par += 'L'; } else { d += GC.indexOf(ch); par += 'G'; } } for (let i = 0; i < 6; i++) d += RC.indexOf(s.substr(50 + i * 7, 7)); return PAR.indexOf(par) + d; };
  T.eq(decodeEAN(TX.ean13('4006381333931').bits), '4006381333931', 'ean13: 4006381333931 decodes to itself (95 modules, guards in place)');
  T.eq(decodeEAN(TX.ean13('590123412345').bits), '5901234123457', 'ean13: 12 digits get check digit 7 (published example 5901234123457)');
  T.eq(decodeEAN(TX.ean13('0000000000000').bits), '0000000000000', 'ean13: all zeros'); T.eq(TX.eanCheck('400638133393'), 1, 'ean13: check digit'); T.ok(TX.ean13('123').error, 'ean13: wrong length');
  T.eq(TX.wifiString('a', 'b', 'WPA', false), 'WIFI:T:WPA;S:a;P:b;;', 'wifi: published format');

  await T.done(page);
})();
