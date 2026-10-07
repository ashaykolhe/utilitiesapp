'use strict';
/* Functional tests for the text tools, part 1: morse, qr, notes, b64, texttools, password, roman, bases. Drives the real UI. */
const { boot, suite } = require('../helpers/page');
(async () => {
  const T = suite('text1'), page = await boot();
  const w = page.w;
  // capture what the tools hand to the clipboard / share / file helpers
  page.eval(`window.__cp = []; window.__files = []; window.__pro = []; window.__qr = [];
    window.copyToClipboard = async (t) => { __cp.push(String(t)); return true; };
    window.saveTextFile = async (n, t, m) => { __files.push({ n, t, m }); return true; };
    window.shareImageBlob = async (n, b) => { __files.push({ n, img: true }); return true; };
    window.openPro = (k) => { __pro.push(k); };
    const _qr = window.qrcode; window.qrcode = function (a, b) { const q = _qr(a, b); const ad = q.addData; q.addData = (d) => { __qr.push(d); return ad.call(q, d); }; return q; };`);
  const cp = () => w.__cp.slice(), lastCp = () => w.__cp[w.__cp.length - 1];
  const tick = () => page.wait(20);

  /* ---------- Morse ---------- */
  let t = await page.open('morse');
  t.type('#i', 'SOS');
  T.eq(t.value('#o'), '... --- ...', 'morse: SOS');
  t.type('#i', 'Hello World');
  T.eq(t.value('#o'), '.... . .-.. .-.. --- / .-- --- .-. .-.. -..', 'morse: Hello World with / between words');
  t.type('#i', 'a,1?');
  T.eq(t.value('#o'), '.- --..-- .---- ..--..', 'morse: punctuation and digits');
  t.click('#cp'); await tick();
  T.eq(lastCp(), '.- --..-- .---- ..--..', 'morse: copy output');
  t.select('#m', '1');   // switching direction moves the output into the input
  T.eq(t.value('#i'), '.- --..-- .---- ..--..', 'morse: switching direction carries the result over');
  T.eq(t.value('#o'), 'A,1?', 'morse: decode back');
  t.type('#i', '... --- ... / .---- ..--- ...--');
  T.eq(t.value('#o'), 'SOS 123', 'morse: decode with word gap');
  t.type('#i', '··· −−− ···');
  T.eq(t.value('#o'), 'SOS', 'morse: typographic dots and dashes are accepted');
  t.type('#i', '.-.-.-.-.-.-.-');
  T.has(t.value('#o'), '?', 'morse: unknown pattern shows ?');
  t.type('#i', '');
  t.click('#play'); await tick();
  T.has(t.text(), '▶ Play', 'morse: play with nothing shows no stop button');
  t.select('#m', '0'); t.type('#i', 'E');
  t.click('#play'); await tick();
  T.has(t.text(), '■ Stop', 'morse: playing shows a Stop button');
  t.click('#play'); await tick();
  T.has(t.text(), '▶ Play', 'morse: Stop returns to Play');
  t.close();

  t = await page.open('morse'); t.type('#w', '22'); t.close();
  t = await page.open('morse'); T.eq(t.value('#w'), '22', 'morse: speed is remembered'); T.eq(t.q('#wv').textContent, '22', 'morse: speed label follows'); t.close();

  /* ---------- QR payloads ---------- */
  t = await page.open('qr');
  t.select('#t', 'wifi'); T.has(t.q('#f2').textContent, 'None (open network)', 'qr: Wi-Fi security options have plain labels'); T.eq(t.all('#f2 option').map(o => o.value).join(), 'WPA,WEP,nopass', 'qr: security option values');
  t.select('#t', 'text');
  const qrLast = () => w.__qr[w.__qr.length - 1];
  t.type('#f0', 'hello');
  T.eq(qrLast(), 'hello', 'qr: text payload');
  t.select('#t', 'url'); t.type('#f0', ' https://example.com/a?b=1 ');
  T.eq(qrLast(), 'https://example.com/a?b=1', 'qr: url payload is trimmed');
  t.select('#t', 'wifi'); t.type('#f0', 'Home;Net'); t.type('#f1', 'pa:ss"w\\d');
  T.eq(qrLast(), 'WIFI:T:WPA;S:Home\\;Net;P:pa\\:ss\\"w\\\\d;;', 'qr: wifi payload escapes ; : " and backslash');
  t.select('#f2', 'nopass');
  T.eq(qrLast(), 'WIFI:T:nopass;S:Home\\;Net;;', 'qr: open wifi has no password');
  t.select('#f2', 'WPA'); t.check('#f3', true);
  T.eq(qrLast(), 'WIFI:T:WPA;S:Home\\;Net;P:pa\\:ss\\"w\\\\d;H:true;;', 'qr: hidden network flag');
  t.select('#t', 'phone'); t.type('#f0', '+1 555 010 0000');
  T.eq(qrLast(), 'tel:+15550100000', 'qr: phone drops spaces');
  t.select('#t', 'email'); t.type('#f0', 'a@b.com'); t.type('#f1', 'Hi there'); t.type('#f2', 'A&B = 1');
  T.eq(qrLast(), 'mailto:a@b.com?subject=Hi%20there&body=A%26B%20%3D%201', 'qr: email subject and body are encoded');
  t.select('#t', 'sms'); t.type('#f0', '+1 555'); t.type('#f1', 'Hello');
  T.eq(qrLast(), 'SMSTO:+1555:Hello', 'qr: sms payload');
  const n0 = w.__qr.length;
  t.select('#t', 'text'); t.type('#f0', '');
  T.eq(w.__qr.length, n0, 'qr: empty text makes no code');
  t.type('#f0', 'x'.repeat(1500));
  t.select('#lv', 'H');
  T.has(t.text(), 'too much data', 'qr: 1500 chars at level H is reported as too much data');
  t.select('#t', 'ean13'); t.type('#f0', '4006381333930');
  T.has(t.text(), 'Check digit should be 1.', 'qr: EAN-13 with a wrong check digit is rejected');
  t.type('#f0', '4006381333931');
  T.ok(t.q('#e').hidden, 'qr: valid EAN-13 shows no error');
  t.type('#f0', '400638133393');
  T.ok(t.q('#e').hidden, 'qr: 12-digit EAN-13 gets its check digit');
  t.type('#f0', '12ab');
  T.has(t.text(), 'Enter 12 or 13 digits.', 'qr: EAN needs digits');
  t.select('#t', 'code128'); t.type('#f0', 'héllo');
  T.has(t.text(), 'plain keyboard characters', 'qr: Code 128 rejects accents');
  t.type('#f0', 'PJJ123C');
  T.ok(t.q('#e').hidden, 'qr: Code 128 accepts plain text');
  t.click('#sv'); await page.wait(40);
  T.ok(w.__files.some(f => f.img), 'qr: Save PNG hands a picture to the share/save helper');
  t.close();

  /* ---------- Notes ---------- */
  w.localStorage.clear();
  t = await page.open('notes');
  T.has(t.text(), 'No notes yet', 'notes: empty state');
  t.click('#new'); t.type('#t', 'Shopping'); t.type('#b', 'milk and eggs');
  t.click('#bk');
  T.has(t.text(), 'Shopping', 'notes: new note is listed after Done');
  T.has(t.text(), '1 note', 'notes: count');
  T.ok(JSON.parse(w.localStorage.getItem('pk.notes.items')).some(n => n.t === 'Shopping' && n.b === 'milk and eggs'), 'notes: saved to storage');
  t.click('#new'); t.click('#bk');
  T.has(t.text(), '1 note', 'notes: tapping New then Done leaves no empty note');
  t.click('#new'); t.type('#t', 'Ideas'); t.type('#b', 'build a <b>rocket</b>'); t.click('#pin'); t.click('#bk');
  T.ok(t.text().indexOf('Ideas') < t.text().indexOf('Shopping'), 'notes: pinned note is listed first');
  T.has(t.q('#lst').innerHTML, '&lt;b&gt;rocket', 'notes: note text is escaped in the list');
  T.ok(/\d/.test(t.q('#lst .item').textContent), 'notes: each row shows the date it was edited');
  t.type('#q', 'MILK');
  T.has(t.text(), 'Shopping', 'notes: search matches body, case-insensitive');
  T.ok(!t.text().includes('Ideas'), 'notes: search hides non-matching notes');
  t.type('#q', 'zzz');
  T.has(t.text(), 'No matches', 'notes: search with no result');
  t.type('#q', '');
  t.close();
  /* reopen: persisted */
  t = await page.open('notes');
  T.has(t.text(), '2 notes', 'notes: both notes persist after leaving the tool');
  t.all('.item').find(x => x.textContent.includes('Shopping')).click();
  T.eq(t.value('#b'), 'milk and eggs', 'notes: editing opens the saved body');
  t.type('#b', 'milk, eggs and bread'); t.click('#cp'); await tick();
  T.eq(lastCp(), 'Shopping\n\nmilk, eggs and bread', 'notes: copy gives title and body');
  t.click('#ex'); await tick();
  const ex = w.__files[w.__files.length - 1];
  T.ok(/^note-shopping-\d{4}-\d\d-\d\d\.md$/.test(ex.n), 'notes: export file name');
  T.eq(ex.t, '# Shopping\n\nmilk, eggs and bread\n', 'notes: markdown export');
  t.click('#bk');
  T.has(JSON.stringify(JSON.parse(w.localStorage.getItem('pk.notes.items')).map(n => n.b)), 'bread', 'notes: edit saved on Done');
  t.click('#exall'); await tick();
  const ea = w.__files[w.__files.length - 1];
  T.has(ea.t, '## [pinned] Ideas', 'notes: export all lists pinned first'); T.has(ea.t, '## Shopping', 'notes: export all has every note');
  /* delete needs two taps */
  t.all('.item').find(x => x.textContent.includes('Shopping')).click();
  t.click('#del'); T.has(t.text(), 'Tap again to delete', 'notes: first Delete tap asks to confirm');
  T.eq(JSON.parse(w.localStorage.getItem('pk.notes.items')).length, 2, 'notes: note still there after one tap');
  t.click('#del');
  T.has(t.text(), '1 note', 'notes: second tap deletes');
  T.ok(!JSON.parse(w.localStorage.getItem('pk.notes.items')).some(n => n.t === 'Shopping'), 'notes: deleted from storage');
  t.close();
  /* free limit of 10 */
  w.localStorage.clear(); w.__pro.length = 0;
  t = await page.open('notes');
  for (let i = 1; i <= 10; i++) { t.click('#new'); t.type('#t', 'Note ' + i); t.click('#bk'); }
  T.has(t.text(), '10 notes', 'notes: ten notes fit in the free plan');
  T.eq(w.__pro.length, 0, 'notes: no Pro sheet for the first ten');
  t.click('#new');
  T.eq(w.__pro[0], 'notes', 'notes: the 11th note opens the Pro sheet');
  T.has(t.text(), '10 notes', 'notes: still 10 notes and still on the list');
  t.close();
  /* typing and leaving in a hurry (before the debounce) still saves */
  w.localStorage.clear();
  t = await page.open('notes');
  t.click('#new'); t.type('#b', 'quick thought');
  t.close();
  T.ok(JSON.parse(w.localStorage.getItem('pk.notes.items') || '[]').some(n => n.b === 'quick thought'), 'notes: closing the tool flushes the pending save');

  /* ---------- Base64 / URL ---------- */
  t = await page.open('b64');
  const conv = (mode, v) => { t.select('#m', mode); t.type('#i', v); return t.value('#u'); };
  T.eq(conv('0', 'foobar'), 'Zm9vYmFy', 'b64: encode foobar');
  T.eq(conv('0', 'Hello, World!'), 'SGVsbG8sIFdvcmxkIQ==', 'b64: encode with padding');
  T.eq(conv('0', '€'), '4oKs', 'b64: euro sign is UTF-8');
  T.eq(conv('0', '😀'), '8J+YgA==', 'b64: emoji');
  T.eq(conv('0', ''), '', 'b64: empty');
  T.eq(conv('1', 'SGVsbG8sIFdvcmxkIQ=='), 'Hello, World!', 'b64: decode');
  T.eq(conv('1', '8J+YgA'), '😀', 'b64: decode without padding');
  T.eq(conv('1', 'SGVs\nbG8='), 'Hello', 'b64: decode ignores whitespace');
  conv('1', 'a'); T.has(t.text(), 'Not valid Base64', 'b64: invalid length is an error'); T.eq(t.value('#u'), '', 'b64: no output on error');
  conv('1', '/w=='); T.has(t.text(), 'not valid UTF-8', 'b64: bytes that are not text are reported');
  conv('1', 'ab$d'); T.has(t.text(), 'Not valid Base64', 'b64: bad characters');
  T.eq(conv('2', '??>>'), 'Pz8-Pg', 'b64: URL-safe uses - and drops padding');
  T.eq(conv('1', 'Pz8-Pg'), '??>>', 'b64: decode URL-safe');
  T.eq(conv('3', 'a b&c=é/ü'), 'a%20b%26c%3D%C3%A9%2F%C3%BC', 'url: encode');
  T.eq(conv('4', 'a+b%20c%C3%A9'), 'a b cé', 'url: decode (plus is a space)');
  conv('4', '%E0%A4%A'); T.has(t.text(), 'Not a valid URL-encoded', 'url: bad escape is an error, not a crash');
  conv('0', 'abc'); t.click('#cp'); await tick(); T.eq(lastCp(), 'YWJj', 'b64: copy');
  t.click('#sw'); T.eq(t.value('#i'), 'YWJj', 'b64: swap moves output to input'); T.eq(t.value('#m'), '1', 'b64: swap switches to decode'); T.eq(t.value('#u'), 'abc', 'b64: swap round trip');
  t.click('#cl'); T.eq(t.value('#i'), '', 'b64: clear');
  t.close();

  /* ---------- Text tools ---------- */
  t = await page.open('texttools');
  t.type('#i', 'Hello world. How are you?\n\nFine!');
  T.has(t.q('#st').textContent, 'Words', 'texttools: stats shown');
  const stat = (name) => { const d = [...t.q('#st').children].find(x => x.textContent.includes(name)); return d.firstElementChild.textContent; };
  T.eq(stat('Words'), '6', 'texttools: words'); T.eq(stat('Sentences'), '3', 'texttools: sentences'); T.eq(stat('Paragraphs'), '2', 'texttools: paragraphs'); T.eq(stat('Lines'), '3', 'texttools: lines');
  T.eq(stat('Characters'), '32', 'texttools: characters'); T.eq(stat('No spaces'), '26', 'texttools: characters without spaces');
  t.type('#i', 'a😀b'); T.eq(stat('Characters'), '3', 'texttools: an emoji counts as one character');
  const act = (label, v) => { t.type('#i', v); t.clickText(label); return t.value('#i'); };
  T.eq(act('UPPER', 'straße'), 'STRASSE', 'texttools: German sharp s upper-cases to SS');
  T.eq(act('lower', 'ISTANBUL İstanbul'), 'istanbul istanbul', 'texttools: lower-casing Turkish dotted capital I leaves a plain i');
  T.eq(act('Title Case', 'the quick-brown fox (jumps) over/under'), 'The Quick-Brown Fox (Jumps) Over/Under', 'texttools: title case after - ( /');
  T.eq(act('Title Case', 'ßa İSTANBUL ÉCOLE'), 'Ssa Istanbul École', 'texttools: title case of sharp s, Turkish dotted I and accents');
  T.eq(act('Sentence case', 'hello there. how ARE you?  fine!\nnew line'), 'Hello there. How are you?  Fine!\nNew line', 'texttools: sentence case');
  T.eq(act('Reverse', 'ab😀c'), 'c😀ba', 'texttools: reverse keeps emoji whole');
  T.eq(act('Fix spaces', '  a   b \t c \n\n\n\n d  '), 'a b c\n\nd', 'texttools: fix spaces');
  T.eq(act('Dedupe lines', 'a\nb\na\nc\nb'), 'a\nb\nc', 'texttools: dedupe keeps first');
  T.eq(act('Sort A-Z', 'b\nA\nitem10\nitem2\nc'), 'A\nb\nc\nitem2\nitem10', 'texttools: sort is natural and case-insensitive');
  T.eq(act('Sort Z-A', 'a\nc\nb'), 'c\nb\na', 'texttools: sort Z-A');
  T.eq(act('No blank lines', 'a\n\n \nb\n'), 'a\nb', 'texttools: remove blank lines');
  t.type('#i', 'keep me'); t.clickText('UPPER'); T.eq(t.value('#i'), 'KEEP ME', 'texttools: upper'); t.clickText('Undo'); T.eq(t.value('#i'), 'keep me', 'texttools: undo');
  t.click('#cp'); await tick(); T.eq(lastCp(), 'keep me', 'texttools: copy');
  t.click('#cl'); T.eq(t.value('#i'), '', 'texttools: clear'); t.clickText('Undo'); T.eq(t.value('#i'), 'keep me', 'texttools: clear can be undone');
  t.close();

  /* ---------- Password ---------- */
  w.localStorage.clear();
  t = await page.open('password');
  const pw = () => t.q('#pw').textContent;
  T.eq(pw().length, 16, 'password: default length 16');
  T.ok(/[A-Z]/.test(pw()) && /[a-z]/.test(pw()) && /[0-9]/.test(pw()) && /[^A-Za-z0-9]/.test(pw()), 'password: default has every character kind');
  T.has(t.q('#sl').textContent, 'Strong (about 104 bits)', 'password: strength for 16 chars from 89 symbols');
  const seen = new Set(); let allOk = true;
  for (let i = 0; i < 40; i++) { t.click('#gen'); seen.add(pw()); if (pw().length !== 16 || !/[A-Z]/.test(pw()) || !/[a-z]/.test(pw()) || !/[0-9]/.test(pw()) || !/[^A-Za-z0-9]/.test(pw())) allOk = false; }
  T.eq(seen.size, 40, 'password: 40 generated passwords are all different');
  T.ok(allOk, 'password: every one has all four kinds');
  t.type('#len', '64'); T.eq(pw().length, 64, 'password: length 64');
  t.type('#len', '4'); T.eq(pw().length, 4, 'password: length 4');
  T.ok(/[A-Z]/.test(pw()) && /[a-z]/.test(pw()) && /[0-9]/.test(pw()) && /[^A-Za-z0-9]/.test(pw()), 'password: even at length 4 all four kinds are present');
  t.type('#len', '30'); t.check('#upper', false); t.check('#lower', false); t.check('#symbols', false);
  T.ok(/^[0-9]{30}$/.test(pw()), 'password: digits only');
  t.check('#digits', false); T.eq(pw(), 'Pick at least one option', 'password: nothing selected message');
  t.click('#cp'); await tick(); T.ok(!cp().includes('Pick at least one option'), 'password: the message is never copied');
  t.check('#lower', true); t.check('#noAmb', true); t.type('#len', '64');
  let amb = false; for (let i = 0; i < 30; i++) { t.click('#gen'); if (/[Il1O0o]/.test(pw())) amb = true; }
  T.ok(!amb, 'password: look-alikes are never used when avoided (lower letters)');
  t.check('#upper', true); t.check('#digits', true); t.check('#symbols', true);
  amb = false; for (let i = 0; i < 30; i++) { t.click('#gen'); if (/[Il1O0o]/.test(pw())) amb = true; }
  T.ok(!amb, 'password: look-alikes are never used with every kind on');
  const cur = pw(); t.click('#cp'); await tick(); T.eq(lastCp(), cur, 'password: copy gives the shown password');
  const saved = JSON.parse(w.localStorage.getItem('pk.password.opts'));
  T.eq(saved.len, 64, 'password: length remembered'); T.eq(saved.noAmb, true, 'password: look-alike choice remembered');
  t.close();
  t = await page.open('password');
  T.eq(t.value('#len'), '64', 'password: settings restored on reopen'); T.ok(t.q('#noAmb').checked, 'password: checkbox restored');
  t.close();

  /* ---------- Roman ---------- */
  t = await page.open('roman');
  const ro = (v) => { t.type('#i', v); return t.q('#o').textContent; };
  T.eq(ro('2024'), 'MMXXIV', 'roman: 2024'); T.eq(ro('1994'), 'MCMXCIV', 'roman: 1994'); T.eq(ro('3999'), 'MMMCMXCIX', 'roman: 3999'); T.eq(ro('4'), 'IV', 'roman: 4'); T.eq(ro('49'), 'XLIX', 'roman: 49');
  T.eq(ro('MCMXCIV'), '1994', 'roman: parse MCMXCIV'); T.eq(ro('mmxxiv'), '2024', 'roman: lower case accepted'); T.eq(ro('MMMCMXCIX'), '3999', 'roman: parse max');
  T.eq(ro('4000'), '—', 'roman: 4000 has no numeral'); T.has(t.text(), 'from 1 to 3999', 'roman: range message');
  T.eq(ro('0'), '—', 'roman: zero has no numeral');
  T.eq(ro('IIII'), '—', 'roman: IIII is not canonical'); T.has(t.text(), 'Not a valid Roman', 'roman: invalid message');
  T.eq(ro('VX'), '—', 'roman: VX invalid');
  T.eq(ro(''), '—', 'roman: empty');
  ro('XIV'); t.click('#cp'); await tick(); T.eq(lastCp(), '14', 'roman: copy result');
  t.close();

  /* ---------- Number bases ---------- */
  t = await page.open('bases');
  const bv = () => t.all('#out .item').map(x => x.querySelector('div > div:nth-child(2)').textContent);
  t.type('#i', '255');
  T.eq(bv().join('|'), '11111111|377|255|FF|73', 'bases: 255 in 2, 8, 10, 16, 36');
  t.select('#f', '16'); t.type('#i', '0xff');
  T.eq(bv().join('|'), '11111111|377|255|FF|73', 'bases: hex 0xff');
  t.select('#f', '2'); t.type('#i', '1111 0000');
  T.eq(bv()[3], 'F0', 'bases: binary with a space');
  t.select('#f', '10'); t.type('#i', '123456789012345678901234567890');
  T.eq(bv()[3], '18EE90FF6C373E0EE4E3F0AD2', 'bases: big numbers are exact');
  t.type('#i', '-10'); T.eq(bv()[0], '-1010', 'bases: negative');
  t.type('#i', '12a'); T.has(t.text(), 'not a valid base-10', 'bases: invalid digit');
  t.select('#f', '0'); T.ok(!t.q('#cf').disabled, 'bases: custom base selector enabled');
  t.select('#cf', '7'); t.type('#i', '666'); T.eq(bv()[2], '342', 'bases: 666 in base 7 is 342');
  t.select('#ct', '5'); T.eq(bv()[4], '2332', 'bases: extra base 5 of 342 is 2332');
  t.type('#i', '');
  T.eq(bv().length, 0, 'bases: empty input shows nothing');
  t.type('#i', '5'); t.click('[data-c="2"]'); await tick(); T.eq(lastCp(), '101', 'bases: copy a row');
  t.close();

  await T.done(page);
})();
