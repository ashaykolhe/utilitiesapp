'use strict';
/* Functional tests for the money calculators in www/js/tools/calc.js. Expected values are computed here with separate formulas or published figures. */
const { boot, suite } = require('../helpers/page');
(async () => {
  const T = suite('calc-money'), page = await boot();
  const w = page.w;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const fire = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true }));
  // field of section s with data-k k
  const F = (t, s, k) => t.q('[data-s="' + s + '"] [data-k="' + k + '"]');
  const set = (t, s, k, v) => { const e = F(t, s, k); e.value = String(v); fire(e, 'input'); fire(e, 'change'); };
  const raw = (t, s, k, v) => { const e = F(t, s, k); e.value = String(v); fire(e, 'input'); }; // no change event, so the limit message stays visible
  const card = (t, s) => (t.q('[data-s="' + s + '"]').innerText || t.q('[data-s="' + s + '"]').textContent).replace(/\s+/g, ' ');
  const hist = (id) => JSON.parse(page.eval("JSON.stringify(Hist.list('" + id + "'))"));
  const pending = [];
  const ns = (s) => String(s).replace(/\s+/g, '');
  const H = (txt, part, m) => T.has(ns(txt), ns(part), m);
  const money = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // independent EMI: bisect the payment so that the balance after n months is zero
  const bisectEmi = (P, rate, n) => { const r = rate / 1200; let lo = 0, hi = P * 2; for (let k = 0; k < 200; k++) { const m = (lo + hi) / 2; let b = P; for (let i = 0; i < n; i++) b = b * (1 + r) - m; if (b > 0) lo = m; else hi = m; } return (lo + hi) / 2; };

  /* ---------------- EMI ---------------- */
  {
    const t = await page.open('emi');
    H(t.text(), '10,258.27', 'emi: default 500000 @ 8.5% x 5y');
    T.near(bisectEmi(500000, 8.5, 60), 10258.27, 0.005, 'emi: reference check');
    set(t, 0, 'p', 1000000); set(t, 0, 'r', 10); set(t, 0, 't', 10);
    H(t.text(), money(Math.round(bisectEmi(1e6, 10, 120) * 100) / 100), 'emi: 1,000,000 @ 10% x 10y = 13,215.07');
    H(t.text(), '13,215.07', 'emi: published figure 13,215.07');
    const e120 = bisectEmi(1e6, 10, 120); H(t.text().replace(/,/g, ''), money(e120 * 120 - 1e6).replace(/,/g, ''), 'emi: total interest (independent bisection)');
    H(t.text(), 'Months 120', 'emi: months row');
    set(t, 0, 'p', 1200); set(t, 0, 'r', 0); set(t, 0, 't', 12); set(t, 0, 'u', 'm');
    H(t.text(), 'Monthly EMI 100.00', 'emi: 0% over 12 months = 100.00');
    H(t.text(), 'Total interest 0.00', 'emi: 0% means 0 interest');
    set(t, 0, 't', 6);
    T.eq(t.all('table tr').length, 7, 'emi: 6 months = header + 6 rows');
    const last = t.all('table tr').pop().textContent;
    H(last, '0.00', 'emi: final balance 0.00');
    set(t, 0, 'p', ''); H(t.text(), 'Enter the values above', 'emi: empty loan shows note');
    set(t, 0, 'p', 500000); raw(t, 0, 'r', 250);
    H(t.text(), 'enter a value from 0 up to 200', 'emi: rate 250 gives message, no number');
    T.ok(!/Monthly EMI/.test(t.text()), 'emi: no EMI shown for out-of-range rate');
    set(t, 0, 'r', 8.5); set(t, 0, 'u', 'y'); raw(t, 0, 't', 101);
    H(t.text(), 'enter a value from 0 up to 100', 'emi: tenure 101 years rejected');
    set(t, 0, 'u', 'm'); set(t, 0, 't', 101);
    H(t.text(), 'Monthly EMI', 'emi: 101 months allowed');
    set(t, 0, 't', 0); H(t.text(), 'Tenure must be between', 'emi: tenure 0 message');
    set(t, 0, 'p', 1e12); set(t, 0, 'r', 200); set(t, 0, 't', 1);
    T.ok(!/NaN|Infinity|undefined/.test(t.text()), 'emi: huge loan shows no NaN');
    set(t, 0, 'p', 750000); set(t, 0, 't', 18); set(t, 0, 'r', 9); // for history and persistence
    pending.push(['emi', 'EMI 750000', t]); t.el.remove();
    const t2 = await page.open('emi');
    T.eq(F(t2, 0, 'p').value, '750000', 'emi: last loan amount is remembered');
    t2.close();
  }

  /* ---------------- Billing ---------------- */
  {
    const exp = []; // intercepted files
    w.saveTextFile = async (name, text, mime) => { exp.push({ name, text, mime }); return true; };
    let copied = null; Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async (x) => { copied = x; } }, configurable: true });
    const t = await page.open('billing');
    const item = (i, f, v) => { const e = t.q('[data-i="' + i + '"][data-f="' + f + '"]'); e.value = String(v); fire(e, 'input'); fire(e, 'change'); };
    item(0, 'd', 'Widget'); item(0, 'q', 2); item(0, 'p', 25); t.type('#tax', 10);
    H(t.text(), 'Subtotal 50.00', 'billing: subtotal 2 x 25');
    H(t.text(), 'Total 55.00', 'billing: 50 + 10% = 55.00');
    t.click('#add'); T.eq(t.all('[data-f="d"]').length, 2, 'billing: second item added');
    t.click('[data-rm="1"]'); T.eq(t.all('[data-f="d"]').length, 1, 'billing: item removed');
    t.type('#dv', 10); // discount type is % by default
    H(t.text(), 'Discount -5.00', 'billing: 10% discount');
    H(t.text(), 'Tax 4.50', 'billing: tax after discount');
    H(t.text(), 'Total 49.50', 'billing: total 49.50');
    t.type('#dt', 'amt'); t.type('#dv', 500);
    H(t.text(), 'Discount -50.00', 'billing: discount capped at subtotal');
    H(t.text(), 'Total 0.00', 'billing: total 0 when discount >= subtotal');
    t.select('#dt', 'pct'); t.type('#dv', 10);
    item(0, 'q', 0.333); item(0, 'p', 3); t.type('#tax', 0); t.type('#dv', 0);
    H(t.text(), 'Subtotal 1.00', 'billing: 0.333 x 3 = 0.999 rounds to 1.00');
    item(0, 'q', 2); item(0, 'p', 25); t.type('#tax', 10); t.type('#dv', 10); t.type('#cust', 'Acme Ltd');
    t.type('#biz', 'My Shop'); t.type('#cur', '$');
    H(t.text(), 'Total $49.50', 'billing: currency symbol shows');
    t.click('#save');
    let list = JSON.parse(page.eval("JSON.stringify(Store.get('billing.list', []))"));
    T.eq(list.length, 1, 'billing: one saved invoice'); T.eq(list[0].no, 1, 'billing: invoice number 1');
    H(t.text(), '#1 Acme Ltd', 'billing: saved list shows invoice');
    t.click('#save'); list = JSON.parse(page.eval("JSON.stringify(Store.get('billing.list', []))"));
    T.eq(list.length, 1, 'billing: saving again updates same entry');
    t.click('#new'); item(0, 'd', 'Pen <b>x</b>'); item(0, 'q', 3); item(0, 'p', 1.5); t.type('#cust', '=SUM(A1)');
    t.click('#save'); list = JSON.parse(page.eval("JSON.stringify(Store.get('billing.list', []))"));
    T.eq(list.length, 2, 'billing: second invoice saved'); T.eq(list[0].no, 2, 'billing: invoice number 2');
    t.click('#copy'); await sleep(20);
    T.ok(copied && copied.startsWith('INVOICE #2') && /TOTAL: \$?.*\d/.test(copied) && copied.includes('4.50') , 'billing: copy text starts with INVOICE #2 and has total');
    H(copied || '', 'TOTAL: $4.46', 'billing: 4.50 - 10% = 4.05, tax 0.41 (0.405 rounds up), total 4.46');
    t.click('#exh'); await sleep(20);
    T.ok(exp.length === 1 && /^invoice-2-\d{4}-\d\d-\d\d\.html$/.test(exp[0].name), 'billing: html file name');
    T.ok(exp[0].text.includes('&lt;b&gt;x&lt;/b&gt;') && !exp[0].text.includes('<b>x</b>'), 'billing: html escapes item name');
    t.click('#exc'); await sleep(20);
    T.ok(exp.length === 2 && exp[1].text.charCodeAt(0) === 0xFEFF && exp[1].name.endsWith('.csv'), 'billing: csv has BOM and name');
    H(exp[1].text, "'=SUM(A1)", 'billing: CSV text starting with = is quoted');
    H(exp[1].text, 'Invoice,Date,Business,Customer,Item,Quantity,Price,Line total,Subtotal,Discount,Tax,Total', 'billing: csv header');
    H(exp[1].text, ',My Shop,Acme Ltd,Widget,2,25,50,50,5,4.5,49.5', 'billing: csv row of invoice 1');
    // view the first invoice again
    const view = t.all('[data-view]'); view[view.length - 1].click();
    T.eq(t.value('#cust'), 'Acme Ltd', 'billing: view loads customer'); T.eq(t.value('#tax'), '10', 'billing: view loads tax');
    T.eq(t.value('[data-i="0"][data-f="d"]'), 'Widget', 'billing: view loads items');
    // empty export
    t.click('#new'); exp.length = 0; t.click('#exh'); await sleep(20); T.eq(exp.length, 0, 'billing: nothing exported without items');
    t.click('#save'); T.eq(JSON.parse(page.eval("JSON.stringify(Store.get('billing.list', []))")).length, 2, 'billing: empty invoice not saved');
    // 20 limit
    for (let k = 0; k < 22; k++) { t.click('#new'); item(0, 'd', 'Item ' + k); item(0, 'p', k + 1); t.click('#save'); }
    list = JSON.parse(page.eval("JSON.stringify(Store.get('billing.list', []))"));
    T.eq(list.length, 20, 'billing: only the newest 20 stay'); T.eq(list[0].items[0].d, 'Item 21', 'billing: newest first');
    t.click('[data-del]'); list = JSON.parse(page.eval("JSON.stringify(Store.get('billing.list', []))"));
    T.eq(list.length, 19, 'billing: delete removes one');
    item(0, 'q', 5e9); T.ok(!/NaN|Infinity/.test(t.text()), 'billing: huge quantity stays finite');
    t.close();
    const t2 = await page.open('billing');
    T.eq(t2.value('#biz'), 'My Shop', 'billing: business name persists'); T.eq(t2.value('#cur'), '$', 'billing: currency persists');
    T.eq(t2.all('[data-view]').length, 19, 'billing: saved invoices persist');
    t2.close();
  }

  /* ---------------- Percentage ---------------- */
  {
    const t = await page.open('percent');
    H(card(t, 0), 'Result 30', 'percent: 15% of 200 = 30');
    set(t, 0, 'x', 12.5); set(t, 0, 'y', 80); H(card(t, 0), 'Result 10', 'percent: 12.5% of 80 = 10');
    set(t, 0, 'x', -20); set(t, 0, 'y', 50); H(card(t, 0), 'Result -10', 'percent: negative percent');
    H(card(t, 1), 'Percentage 25%', 'percent: 30 is 25% of 120');
    set(t, 1, 'y', 0); H(card(t, 1), 'Ycannotbe0', 'percent: Y = 0 gives note');
    set(t, 1, 'x', 1); set(t, 1, 'y', 3); H(card(t, 1), '33.33333333', 'percent: 1 of 3 = 33.333...%');
    H(card(t, 2), 'Increase 25%', 'percent: 80 -> 100 is +25%');
    set(t, 2, 'a', 100); set(t, 2, 'b', 80); H(card(t, 2), 'Decrease 20%', 'percent: 100 -> 80 is -20%');
    set(t, 2, 'a', 0); H(card(t, 2), 'changefrom0cannotbeshown', 'percent: change from 0 gives note');
    set(t, 2, 'a', -50); set(t, 2, 'b', -25); H(card(t, 2), 'Increase 50%', 'percent: -50 -> -25 is +50% (towards zero)');
    H(card(t, 3), 'Plus 12% 280', 'percent: 250 + 12% = 280');
    H(card(t, 3), 'Minus 12% 220', 'percent: 250 - 12% = 220');
    H(card(t, 3), 'The percent itself 30', 'percent: 12% of 250 = 30');
    raw(t, 0, 'x', 5e6); H(card(t, 0), 'enter a value from', 'percent: out of range message');
    set(t, 0, 'x', 15); set(t, 0, 'y', 999999999999); T.ok(!/NaN|Infinity|undefined/.test(card(t, 0)), 'percent: huge value ok');
    set(t, 2, 'a', 80); set(t, 2, 'b', 100);
    pending.push(['percent', 'Percentage', t]); t.el.remove();
  }

  /* ---------------- Discount & GST ---------------- */
  {
    const t = await page.open('gst');
    H(t.text(), 'Final price 1,062.00', 'gst: 1000 -10% +18% = 1062');
    H(t.text(), 'You save 100.00', 'gst: saving 100'); H(t.text(), 'Tax amount 162.00', 'gst: tax 162');
    set(t, 0, 'm', 'in');
    H(t.text(), 'Final price 900.00', 'gst: inclusive keeps 900'); H(t.text(), 'Price before tax 762.71', 'gst: 900/1.18 = 762.71');
    H(t.text(), 'Tax amount 137.29', 'gst: inclusive tax 137.29');
    set(t, 0, 'd', 0); set(t, 0, 't', 0); set(t, 0, 'm', 'ex'); H(t.text(), 'Final price 1,000.00', 'gst: no discount no tax');
    set(t, 0, 'p', 0); H(t.text(), 'Final price 0.00', 'gst: price 0');
    set(t, 0, 'p', 19.99); set(t, 0, 'd', 100); H(t.text(), 'Final price 0.00', 'gst: 100% discount');
    raw(t, 0, 'd', 150); H(t.text(), 'enter a value from 0 up to 100', 'gst: discount 150 rejected');
    set(t, 0, 'p', 1000); set(t, 0, 'd', 10); set(t, 0, 't', 18);
    pending.push(['gst', 'Price 1000', t]); t.el.remove();
  }

  /* ---------------- Tip splitter ---------------- */
  {
    const t = await page.open('tip');
    H(t.text(), 'Each person pays 330.00', 'tip: 1200 + 10% over 4 = 330');
    H(t.text(), 'Tip total 120.00', 'tip: total tip 120'); H(t.text(), 'Bill share (no tip) 300.00', 'tip: bill share 300');
    set(t, 0, 'b', 1000); set(t, 0, 't', 15); set(t, 0, 'n', 3); set(t, 0, 'r', 'up');
    H(t.text(), 'Each person pays 384.00', 'tip: 1150/3 = 383.33 up to 384');
    H(t.text(), 'Total with tip 1,152.00', 'tip: total 1152'); H(t.text(), 'Tip total 152.00', 'tip: tip becomes 152');
    set(t, 0, 'r', 'no'); H(t.text(), 'Each person pays 383.33', 'tip: exact share 383.33');
    raw(t, 0, 'n', 0); H(t.text(), 'People: enter a value from 1 up to 1000', 'tip: 0 people rejected');
    set(t, 0, 'n', 1); set(t, 0, 'b', 0); H(t.text(), 'Each person pays 0.00', 'tip: bill 0');
    set(t, 0, 'b', 250.5); set(t, 0, 't', 0); H(t.text(), 'Each person pays 250.50', 'tip: 0% tip, 1 person');
    set(t, 0, 'b', 1200); set(t, 0, 't', 10); set(t, 0, 'n', 4);
    pending.push(['tip', 'Bill 1200', t]); t.el.remove();
  }

  await sleep(1800);
  for (const [id, lab, t] of pending) { const h = hist(id); T.ok(h.length > 0 && h[0].l.includes(lab) && h[0].v, 'history: ' + id + ' has a settled entry starting "' + lab + '" (got ' + JSON.stringify(h[0]) + ')'); t.close(); }
  await T.done(page);
})().catch((e) => { console.log("CRASH", e && e.stack || e); process.exit(1); });
