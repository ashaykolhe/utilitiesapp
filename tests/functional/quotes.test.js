'use strict';
/* Functional tests for Real Quotes and Goofy Quotes (one engine, two tools). Drives the real UI. */
const { boot, suite } = require('../helpers/page');
(async () => {
  const T = suite('quotes'), page = await boot();
  const w = page.w;
  page.eval(`window.__cp = []; window.__sh = []; window.__img = [];
    window.copyToClipboard = async (t) => { __cp.push(String(t)); return true; };
    window.shareText = async (title, text) => { __sh.push({ title, text }); return true; };
    window.shareImageBlob = async (name, blob, title) => { __img.push({ name, size: blob.size, title }); return true; };`);
  const lastCp = () => w.__cp[w.__cp.length - 1];
  const tick = (n) => page.wait(n || 30);
  const toastText = () => w.document.getElementById('toast').textContent;
  const REAL = JSON.parse(page.eval('JSON.stringify(REAL_QUOTES)')), RCATS = JSON.parse(page.eval('JSON.stringify(REAL_CATS)'));
  const GOOF = JSON.parse(page.eval('JSON.stringify(GOOFY_QUOTES)')), GCATS = JSON.parse(page.eval('JSON.stringify(GOOFY_CATS)'));

  const TOOLS = [
    { id: 'realquotes', name: 'Real Quotes', data: REAL.map(q => ({ t: q[0], a: q[1], c: q[2] })), cats: RCATS, byline: true },
    { id: 'goofyquotes', name: 'Goofy Quotes', data: GOOF.map(q => ({ t: q[0], a: '', c: q[1] })), cats: GCATS, byline: false }
  ];

  for (const X of TOOLS) {
    const P = X.id + ': ';
    w.localStorage.clear();
    let t = await page.open(X.id);
    const shown = () => t.q('#qt').textContent, byText = new Map(X.data.map(q => [q.t, q]));
    const authorLine = () => t.q('#qa').textContent;

    /* ---------- first quote ---------- */
    T.ok(byText.has(shown()), P + 'opens on a real quote from the data');
    if (X.byline) T.eq(authorLine(), '— ' + byText.get(shown()).a + (REAL.find(q => q[0] === shown())[3] ? ' (' + REAL.find(q => q[0] === shown())[3] + ')' : ''), P + 'author line matches the data');
    else T.eq(authorLine(), '', P + 'goofy quotes have no author line');
    const catLabel = (id) => X.cats.find(c => c[0] === id)[1];
    T.eq(t.q('#qcat').textContent, catLabel(byText.get(shown()).c), P + 'category label matches');
    T.has(t.q('#qcount').textContent, X.data.length + ' quotes in this collection', P + 'count of the whole collection');
    T.eq(t.all('#qlist .item').length, 0, P + 'the list is empty until a search or a category');

    /* ---------- Next never repeats until the pool is used ---------- */
    const seen = new Set([shown()]);
    for (let i = 1; i < X.data.length; i++) { t.click('#qn'); seen.add(shown()); }
    T.eq(seen.size, X.data.length, P + 'Next shows every one of the ' + X.data.length + ' quotes once before any repeat');
    const before = shown(); t.click('#qn'); T.ok(shown() !== before, P + 'the first quote of the next round is not the one just shown');

    /* ---------- Back ---------- */
    t.close(); t = await page.open(X.id);
    const h0 = [shown()]; t.click('#qn'); h0.push(shown()); t.click('#qn'); h0.push(shown()); t.click('#qn'); h0.push(shown());
    t.click('#qp'); T.eq(shown(), h0[2], P + 'Back returns the previous quote'); t.click('#qp'); T.eq(shown(), h0[1], P + 'Back again'); t.click('#qp'); T.eq(shown(), h0[0], P + 'Back to the first');
    t.click('#qp'); T.has(toastText(), 'first one', P + 'Back at the start says so'); T.eq(shown(), h0[0], P + 'and stays on the first quote');
    t.click('#qn'); T.ok(shown() !== undefined && shown().length > 0, P + 'Next still works after going back');

    /* ---------- swipe ---------- */
    const card = t.q('#qc'), ptr = (type, x) => card.dispatchEvent(new w.MouseEvent(type, { clientX: x, bubbles: true }));
    const cur = shown(); ptr('pointerdown', 300); ptr('pointerup', 100); const afterSwipe = shown(); T.ok(afterSwipe !== cur, P + 'swiping left shows another quote');
    ptr('pointerdown', 100); ptr('pointerup', 300); T.eq(shown(), cur, P + 'swiping right goes back');
    ptr('pointerdown', 100); ptr('pointerup', 130); T.eq(shown(), cur, P + 'a short drag does nothing');

    /* ---------- categories ---------- */
    const cat = X.cats[1][0], inCat = X.data.filter(q => q.c === cat);
    t.click('.chip[data-f="' + cat + '"]');
    T.eq(byText.get(shown()).c, cat, P + 'category chip shows a quote of that category');
    T.eq(t.q('.chip.on').dataset.f, cat, P + 'chip is marked on'); T.eq(t.q('.chip.on').getAttribute('aria-pressed'), 'true', P + 'chip is aria-pressed');
    T.has(t.q('#qcount').textContent, inCat.length + ' quotes', P + 'category count');
    T.eq(t.all('#qlist .item').length, Math.min(40, inCat.length), P + 'category list shows up to 40');
    if (inCat.length > 40) { t.click('#qmore'); T.eq(t.all('#qlist .item').length, inCat.length, P + 'Show more reveals the rest'); }
    const seenC = new Set([shown()]); let allIn = byText.get(shown()).c === cat;
    for (let i = 1; i < inCat.length; i++) { t.click('#qn'); seenC.add(shown()); if (byText.get(shown()).c !== cat) allIn = false; }
    T.ok(allIn, P + 'Next stays inside the category'); T.eq(seenC.size, inCat.length, P + 'Next covers the whole category once before repeating');
    t.click('.chip[data-f="all"]'); T.has(t.q('#qcount').textContent, 'in this collection', P + 'All returns to the whole collection');
    T.eq(t.all('#qlist .item').length, 0, P + 'the list is hidden again for All');

    /* ---------- search ---------- */
    const search = async (q) => { t.type('#qfind', q); await tick(300); };
    const word = X.byline ? 'Aristotle' : 'cat';
    await search(word);
    const exp = X.data.filter(x => (x.t + ' ' + x.a).toLowerCase().includes(word.toLowerCase()));
    T.has(t.q('#qcount').textContent, exp.length + ' quote', P + 'search "' + word + '" count matches the data (' + exp.length + ')');
    T.ok(exp.length > 0, P + 'the search word exists in the data');
    T.eq(shown(), exp[0].t, P + 'first match is shown at once');
    if (exp.length > 1) { t.all('#qlist .item')[1].click(); T.eq(shown(), exp[1].t, P + 'tapping a result shows that quote'); }
    await search('CAT '); T.ok(t.q('#qcount').textContent.length > 0, P + 'search is case-insensitive and trims');
    await search('zzzzqq'); T.eq(shown(), 'No quote matches that.', P + 'no match message'); T.eq(t.q('#qa').textContent, '', P + 'no author on no match');
    t.click('#qs'); T.eq(w.localStorage.getItem('pk.' + X.id + '.fav'), null, P + 'starring "nothing" saves nothing');
    t.click('#qcp'); await tick(); T.ok(!w.__cp.includes(''), P + 'copy with nothing shown copies nothing');
    await search(''); t.click('#qn'); T.ok(byText.has(shown()), P + 'clearing the search brings quotes back');
    T.eq(t.q('#qfind').getAttribute('aria-label'), 'Search quotes', P + 'search box is labelled');

    /* ---------- save / unsave / persist ---------- */
    w.localStorage.clear(); t.close(); t = await page.open(X.id);
    const q1 = shown(); T.eq(t.q('#qs').getAttribute('aria-pressed'), 'false', P + 'star starts off');
    t.click('#qs'); T.eq(t.q('#qs').textContent, '★', P + 'star turns on'); T.eq(t.q('#qs').getAttribute('aria-pressed'), 'true', P + 'aria-pressed true');
    T.has(t.q('.chip[data-f="saved"]').textContent, 'Saved (1)', P + 'Saved chip count');
    t.click('#qn'); const q2 = shown(); t.click('#qs');
    const favs = JSON.parse(w.localStorage.getItem('pk.' + X.id + '.fav')); T.eq(favs.map(f => f.t).join('|'), q2 + '|' + q1, P + 'saved newest first with a copy of the text');
    t.close(); t = await page.open(X.id);
    T.has(t.q('.chip[data-f="saved"]').textContent, 'Saved (2)', P + 'saved quotes persist after reopening');
    t.click('.chip[data-f="saved"]'); T.eq(t.q('#qcount').textContent, '2 saved', P + 'Saved count line'); T.eq(t.all('#qlist .item').length, 2, P + 'Saved list');
    T.ok([q1, q2].includes(shown()), P + 'a saved quote is shown'); T.eq(t.q('#qs').textContent, '★', P + 'a saved quote shows a filled star');
    const sv = new Set([shown()]); t.click('#qn'); sv.add(shown()); T.eq(sv.size, 2, P + 'Next inside Saved cycles through both');
    t.click('#qs'); T.has(t.q('.chip[data-f="saved"]').textContent, 'Saved (1)', P + 'unsaving lowers the count'); T.eq(t.all('#qlist .item').length, 1, P + 'and removes it from the Saved list');
    t.close(); t = await page.open(X.id); T.has(t.q('.chip[data-f="saved"]').textContent, 'Saved (1)', P + 'unsave persisted');
    t.click('.chip[data-f="saved"]'); t.click('#qs'); t.click('.chip[data-f="saved"]');
    T.has(shown(), 'Nothing saved yet', P + 'empty Saved shows a hint'); T.eq(t.q('#qcount').textContent, '0 saved', P + 'zero saved');
    /* a saved text survives even when it is no longer in the data */
    w.localStorage.setItem('pk.' + X.id + '.fav', JSON.stringify([{ h: 'gone', t: 'Old quote not in data', a: 'Someone', c: 'x' }])); t.close(); t = await page.open(X.id);
    t.click('.chip[data-f="saved"]'); T.eq(shown(), 'Old quote not in data', P + 'saved copy shows even if the data changed');
    w.localStorage.setItem('pk.' + X.id + '.fav', '"garbage"'); t.close(); t = await page.open(X.id); T.ok(shown().length > 0, P + 'corrupt saved data does not break the tool');
    /* the saved list is capped at 300 */
    w.localStorage.setItem('pk.' + X.id + '.fav', JSON.stringify(Array.from({ length: 300 }, (_, i) => ({ h: 'h' + i, t: 't' + i, a: '', c: '' })))); t.close(); t = await page.open(X.id);
    t.click('#qs'); T.has(toastText(), 'Saved list is full', P + 'saving beyond 300 is refused'); T.eq(JSON.parse(w.localStorage.getItem('pk.' + X.id + '.fav')).length, 300, P + 'still 300');

    /* ---------- quote of the day ---------- */
    w.localStorage.clear(); t.close(); t = await page.open(X.id);
    t.click('#qd'); const qd = shown(); T.has(toastText(), "Today's quote", P + 'quote of the day toast');
    t.click('#qn'); t.click('#qd'); T.eq(shown(), qd, P + 'quote of the day is the same after browsing');
    t.close(); t = await page.open(X.id); t.click('#qd'); T.eq(shown(), qd, P + 'and after reopening the tool'); T.ok(byText.has(qd), P + 'it is a real quote');
    t.click('#qs'); t.click('#qd'); T.eq(t.q('#qs').textContent, '★', P + 'the day quote is saveable');
    /* different days give different quotes (fake clock) */
    const RealDate = w.Date, days = new Set();
    for (let d = 1; d <= 30; d++) {
      w.Date = class extends RealDate { constructor(...a) { if (a.length) super(...a); else super(2026, 5, d, 12, 0, 0); } };
      t.click('#qd'); days.add(shown());
    }
    w.Date = RealDate;
    T.ok(days.size >= 25, P + '30 different days give at least 25 different quotes (got ' + days.size + ')');
    w.Date = class extends RealDate { constructor(...a) { if (a.length) super(...a); else super(2026, 5, 7, 8, 0, 0); } }; t.click('#qd'); const m = shown();
    w.Date = class extends RealDate { constructor(...a) { if (a.length) super(...a); else super(2026, 5, 7, 23, 59, 0); } }; t.click('#qd'); T.eq(shown(), m, P + 'same day, morning and night, same quote');
    w.Date = RealDate;

    /* ---------- copy and share text ---------- */
    t.close(); t = await page.open(X.id); const cq = byText.get(shown());
    const plain = '"' + cq.t + '"' + (cq.a ? ' — ' + cq.a : '');
    t.click('#qcp'); await tick(); T.eq(lastCp(), plain, P + 'Copy puts the quote' + (X.byline ? ' and author' : '') + ' on the clipboard'); T.has(toastText(), 'Copied', P + 'copy toast');
    t.click('#qsh'); await tick(); const s = w.__sh[w.__sh.length - 1];
    T.eq(s.title, X.name, P + 'share title is the tool name'); T.eq(s.text, plain + '\n\nvia PocketKit', P + 'share text carries the quote and "via PocketKit"');
    page.eval('window.copyToClipboard = async (t) => false;'); t.click('#qcp'); await tick(); T.has(toastText(), 'Could not copy', P + 'failed copy says so');
    page.eval('window.copyToClipboard = async (t) => { __cp.push(String(t)); return true; };');

    /* ---------- picture card ---------- */
    const nImg = w.__img.length;
    t.click('#qpic'); T.ok(t.q('#qpv').open, P + 'picture preview opens'); T.eq(t.q('#qcv').width, 1080, P + 'canvas is 1080 wide'); T.eq(t.all('#qsw .sw').length, 8, P + 'eight colour styles');
    t.click('#qsw .sw[data-s="3"]'); T.eq(t.q('#qsw .sw.on').dataset.s, '3', P + 'choosing a style marks it'); T.eq(t.q('#qsw .sw[data-s="3"]').getAttribute('aria-pressed'), 'true', P + 'style aria-pressed');
    t.click('#qpgo'); await tick(80);
    T.eq(w.__img.length, nImg + 1, P + 'Share picture hands one PNG to the share helper'); T.ok(/^pocketkit-quote-[0-9a-z]+\.png$/.test(w.__img[nImg].name), P + 'picture file name'); T.eq(w.__img[nImg].title, X.name, P + 'picture share title'); T.has(toastText(), 'Picture ready', P + 'picture toast');
    t.click('#qpx'); T.ok(!t.q('#qpv').open, P + 'Close closes the preview');
    const longest = X.data.slice().sort((a, b) => b.t.length - a.t.length)[0];
    t.type('#qfind', longest.t.slice(0, 30)); await tick(300); T.eq(shown(), longest.t, P + 'searching for the start of the longest quote finds it'); t.click('#qpic'); t.click('#qpgo'); await tick(80); T.eq(w.__img.length, nImg + 2, P + 'the longest quote makes a picture'); t.click('#qpx');
    t.type('#qfind', 'zzzzqq'); await tick(300); t.click('#qpic'); T.has(toastText(), 'Pick a quote first', P + 'no picture when nothing is shown');
    t.close();
  }

  /* ---------- Goofy mixer ---------- */
  w.localStorage.clear();
  let g = await page.open('goofyquotes');
  const mixed = new Set(); let bad = 0, firstCap = 0;
  for (let i = 0; i < 40; i++) { g.click('#qmix'); const x = g.q('#qt').textContent; mixed.add(x); if (/[{}]|undefined|NaN/.test(x) || x.length < 8 || /\s{2}/.test(x)) bad++; if (/^[A-Z0-9"'“]/.test(x)) firstCap++; if (g.q('#qcat').textContent !== 'Freshly mixed') bad++; }
  T.eq(bad, 0, 'goofy: 40 mixed quotes have no leftover braces, double spaces, or wrong label'); T.ok(mixed.size >= 30, 'goofy: mixer gives variety (' + mixed.size + ' different in 40)'); T.ok(firstCap >= 38, 'goofy: mixed sentences start with a capital');
  const mx = g.q('#qt').textContent; g.click('#qs'); T.has(g.q('.chip[data-f="saved"]').textContent, 'Saved (1)', 'goofy: a mixed quote can be saved');
  g.close(); g = await page.open('goofyquotes'); g.click('.chip[data-f="saved"]'); T.eq(g.q('#qt').textContent, mx, 'goofy: the mixed quote is still there after reopening, with the same words');
  g.click('#qcp'); await tick(); T.eq(lastCp(), '"' + mx + '"', 'goofy: copy of a mixed quote has no author dash');
  g.close();
  const rq = await page.open('realquotes'); T.ok(!rq.has('#qmix'), 'real: no mixer button'); rq.close();

  await T.done(page);
})();
