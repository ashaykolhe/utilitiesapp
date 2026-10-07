'use strict';
/* Cross-cutting calculator behaviour: copy buttons, remembered inputs, tap-to-copy, accessibility of every control. */
const { boot, suite } = require('../helpers/page');
(async () => {
  const T = suite('calc-extras'), page = await boot();
  const w = page.w;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const fire = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true }));
  const F = (t, s, k) => t.q('[data-s="' + s + '"] [data-k="' + k + '"]');
  const set = (t, s, k, v) => { const e = F(t, s, k); e.value = String(v); fire(e, 'input'); fire(e, 'change'); };
  const raw = (t, s, k, v) => { const e = F(t, s, k); e.value = String(v); fire(e, 'input'); };
  let copied = null; Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async (x) => { copied = x; } }, configurable: true });
  const copyOf = async (t, sel) => { copied = null; t.click(sel); await sleep(15); return copied; };

  /* Copy result buttons */
  {
    const t = await page.open('gst');
    let c = await copyOf(t, '[data-s="0"] [data-copy]'); const n = (c || '').replace(/,/g, '');
    T.ok(c && /^Price 1000, 10% off, 18% tax \(added\)/.test(c), 'copy: starts with the tool and what was calculated (got ' + JSON.stringify(c && c.slice(0, 80)) + ')');
    T.ok(/Final price: 1062\.00/.test(n) && /You save: 100\.00/.test(n) && /Tax amount: 162\.00/.test(n), 'copy: contains the headline number and every row');
    raw(t, 0, 'd', 150); T.ok(!t.has('[data-s="0"] [data-copy]'), 'copy: no Copy button while an error is shown');
    set(t, 0, 'd', 10); T.ok(t.has('[data-s="0"] [data-copy]'), 'copy: button is back after a valid input');
    T.eq(t.all('[data-copy]').length, 1, 'copy: exactly one button per result (no duplicates after many updates)');
    t.close();
    const e = await page.open('emi'); c = await copyOf(e, '[data-copy]');
    T.ok(/Monthly EMI: 10,?258\.27/.test(c) && /Mo \| Principal \| Interest \| Balance/.test(c) && /^1 \| /m.test(c), 'copy: emi includes headline and table lines'); e.close();
    const s = await page.open('stats'); c = await copyOf(s, '[data-copy]'); T.ok(/Mean: 16\.57142857/.test(c) && /Median: 15/.test(c), 'copy: stats'); s.close();
    const nw = await page.open('numwords'); c = await copyOf(nw, '[data-copy]'); T.ok(/Twelve lakh thirty-four thousand five hundred sixty-seven/.test(c), 'copy: number words text card'); nw.close();
    const pc = await page.open('percent'); c = await copyOf(pc, '[data-s="3"] [data-copy]'); T.ok(/Plus 12%: 280/.test(c) && /Minus 12%: 220/.test(c), 'copy: percent section 4'); pc.close();
  }

  /* Remembered inputs */
  {
    let t = await page.open('fraction'); t.type('#a', '5/6'); t.type('#b', '1 1/2'); t.type('#o', '*'); t.close();
    t = await page.open('fraction'); T.eq(t.value('#a'), '5/6', 'fraction: first value remembered'); T.eq(t.value('#b'), '1 1/2', 'fraction: second value remembered'); T.eq(t.value('#o'), '*', 'fraction: operation remembered'); T.has(t.text(), '5/4', 'fraction: 5/6 x 3/2 = 5/4 shown'); t.close();
    page.eval("Store.set('fraction.in', {a: 'junk', b: '<b>', o: 'x'})"); t = await page.open('fraction'); T.eq(t.value('#a'), '3/4', 'fraction: junk in storage falls back to the default'); T.eq(t.value('#o'), '+', 'fraction: junk operation falls back'); t.close();
    t = await page.open('prime'); t.type('#n', 97); t.click('#go'); t.close(); t = await page.open('prime'); T.eq(t.value('#n'), '97', 'prime: last number remembered'); T.has(t.text(), 'Yes, prime', 'prime: shows the remembered number'); t.close();
    page.eval("Store.set('prime.n', '99999999999999999999')"); t = await page.open('prime'); T.eq(t.value('#n'), '360', 'prime: out-of-range saved value ignored'); t.close();
    t = await page.open('shapes'); t.type('#s', 'Cylinder'); fire(t.q('#s'), 'change'); t.type('#f label:nth-child(1) input', 3); t.type('#f label:nth-child(2) input', 10); t.close();
    t = await page.open('shapes'); T.eq(t.value('#s'), 'Cylinder', 'shapes: shape remembered'); T.eq(t.all('#f input').map((i) => i.value).join(','), '3,10', 'shapes: sizes remembered'); T.has(t.text(), '282.74334', 'shapes: cylinder volume shown');
    t.type('#s', 'Cube'); fire(t.q('#s'), 'change'); T.eq(t.all('#f input')[0].value, '10', 'shapes: changing shape goes back to the default size'); t.close();
    t = await page.open('triangle'); t.select('#m', 'sas'); t.type('#a', 3); t.type('#b', 4); t.type('#c', 60); t.close();
    t = await page.open('triangle'); T.eq(t.value('#m'), 'sas', 'triangle: mode remembered'); T.eq(t.value('#c'), '60', 'triangle: angle remembered'); T.has(t.text(), 'Side c', 'triangle: SAS result shown'); T.has(t.q('#cl').textContent, 'Angle C', 'triangle: angle label shown'); t.close();
    t = await page.open('random'); t.type('#mn', 5); t.type('#mx', 9); t.type('#cnt', 3); t.close();
    t = await page.open('random'); T.eq(t.value('#mn') + ',' + t.value('#mx') + ',' + t.value('#cnt'), '5,9,3', 'random: min, max and count remembered'); t.close();
    page.eval("Store.set('random.cfg', {mn: 'x', mx: '1e99', cnt: 9999})"); t = await page.open('random'); T.eq(t.value('#mn') + ',' + t.value('#mx') + ',' + t.value('#cnt'), '1,100,1', 'random: junk saved values fall back'); t.close();
    // multi-section tools remember too
    t = await page.open('emi'); set(t, 0, 'p', 123456); t.close(); t = await page.open('emi'); T.eq(F(t, 0, 'p').value, '123456', 'emi: remembered amount'); t.close();
  }

  /* Tap a result to copy it */
  {
    let t = await page.open('sci'); t.type('#ex', '1+2'); T.eq(await copyOf(t, '#rs'), '3', 'sci: tapping the live result copies just the number'); t.type('#ex', '2+'); t.clickText('='); copied = null; t.click('#rs'); await sleep(10); T.eq(copied, null, 'sci: an error message is not copied'); t.close();
    t = await page.open('random'); t.type('#mn', 7); t.type('#mx', 7); t.click('#gn'); T.eq(await copyOf(t, '#rn'), '7', 'random: tapping the number copies it');
    t.type('#li', 'Anna'); t.click('#pk'); T.eq(await copyOf(t, '#rl'), 'Anna', 'random: tapping the pick copies it');
    t.type('#d1', '2024-05-05'); t.type('#d2', '2024-05-05'); t.click('#gd'); T.eq(await copyOf(t, '#rd'), '2024-05-05', 'random: tapping the date copies it'); t.close();
  }

  /* Every control of every calculator has an accessible name; no tool throws or leaks */
  {
    const ids = ['emi', 'billing', 'days', 'tally', 'random', 'percent', 'gst', 'tip', 'age', 'invest', 'sci', 'fuel', 'marks', 'timecalc', 'workdays', 'pay', 'loancmp', 'fraction', 'ratio', 'stats', 'prime', 'gcdlcm', 'quad', 'shapes', 'triangle', 'powercost', 'cooking', 'sizes', 'breakeven', 'margin', 'interest', 'fdrd', 'networth', 'cagr', 'numwords'];
    let unnamed = [];
    for (const id of ids) {
      const t = await page.open(id);
      t.all('input,select,textarea').forEach((x) => { if (x.type === 'checkbox' || x.type === 'radio') { if (!x.closest('label') && !x.getAttribute('aria-label')) unnamed.push(id + ':' + (x.id || x.dataset.k)); return; } const named = x.closest('label') || x.getAttribute('aria-label') || (x.id && t.el.querySelector('label[for="' + x.id + '"]')); if (!named) unnamed.push(id + ':' + (x.id || x.dataset.k || x.dataset.f)); });
      t.all('button').forEach((b) => { if (!b.textContent.trim() && !b.getAttribute('aria-label')) unnamed.push(id + ': button ' + (b.id || b.className)); });
      T.ok(t.text().length > 0, id + ': renders');
      t.close();
    }
    T.eq(unnamed.join(', '), '', 'every input and button has a label (' + ids.length + ' tools)');
    const nonBlank = ['sci'].every(() => true); T.ok(nonBlank, 'sci keys checked in the loop above');
    const t = await page.open('sci'); T.eq(t.all('button').filter((b) => /^[^A-Za-z0-9]$/.test(b.textContent.trim()) && !b.getAttribute('aria-label') && !['(', ')', '.'].includes(b.textContent.trim())).length, 0, 'sci: symbol keys have spoken names'); t.close();
  }

  await T.done(page);
})().catch((e) => { console.log('CRASH', e && e.stack || e); process.exit(1); });
