'use strict';
/* Functional tests for the finance and business calculators in www/js/tools/calc.js (invest, fuel, pay, loancmp, breakeven, margin, interest, fdrd, networth, cagr, powercost). */
const { boot, suite } = require('../helpers/page');
(async () => {
  const T = suite('calc-fin'), page = await boot();
  const w = page.w;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const fire = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true }));
  const F = (t, s, k) => t.q('[data-s="' + s + '"] [data-k="' + k + '"]');
  const set = (t, s, k, v) => { const e = F(t, s, k); e.value = String(v); fire(e, 'input'); fire(e, 'change'); };
  const raw = (t, s, k, v) => { const e = F(t, s, k); e.value = String(v); fire(e, 'input'); };
  const card = (t, s) => (t.q('[data-s="' + s + '"]').textContent || '').replace(/\s+/g, '').replace(/,/g, ''); // no spaces, no thousands separators
  const hist = (id) => JSON.parse(page.eval("JSON.stringify(Hist.list('" + id + "'))"));
  const pending = [];
  const H = (txt, part, m) => T.has(String(txt).replace(/\s+/g, '').replace(/,/g, ''), String(part).replace(/\s+/g, ''), m);
  const m2 = (x) => (Math.round(x * 100) / 100).toFixed(2); // plain 2-decimal text
  const bisectEmi = (P, rate, n) => { const r = rate / 1200; let lo = 0, hi = P * 2; for (let k = 0; k < 200; k++) { const m = (lo + hi) / 2; let b = P; for (let i = 0; i < n; i++) b = b * (1 + r) - m; if (b > 0) lo = m; else hi = m; } return (lo + hi) / 2; };
  const keep = (id, lab, t) => { pending.push([id, lab, t]); t.el.remove(); };

  /* ---------------- Investment ---------------- */
  {
    const t = await page.open('invest');
    let v = 100000; for (let i = 0; i < 10; i++) v *= 1.08;
    H(card(t, 0), 'Finalvalue' + m2(v), 'invest: 100000 @ 8% for 10 years yearly');
    H(card(t, 0), 'Interestearned' + m2(v - 100000), 'invest: interest earned');
    H(card(t, 0), 'Growth' + String(+((v / 100000 - 1) * 100).toPrecision(6)) + '%', 'invest: growth %');
    T.eq(t.all('[data-s="0"] table tr').length, 11, 'invest: 10 table rows + header');
    set(t, 0, 'n', 12); v = 100000; for (let i = 0; i < 120; i++) v *= 1 + 0.08 / 12; H(card(t, 0), 'Finalvalue' + m2(v), 'invest: monthly compounding');
    set(t, 0, 'r', 0); H(card(t, 0), 'Finalvalue100000.00', 'invest: 0% keeps the amount'); set(t, 0, 'r', 8);
    set(t, 0, 'y', 1); T.eq(t.all('[data-s="0"] table tr').length, 2, 'invest: 1 year has one row');
    raw(t, 0, 'y', 101); H(card(t, 0), 'enteravaluefrom1upto100', 'invest: 101 years refused'); T.ok(!/Finalvalue/.test(card(t, 0)), 'invest: no number for 101 years');
    set(t, 0, 'y', 100); set(t, 0, 'p', 1e12); set(t, 0, 'r', 200); H(card(t, 0), 'Rateupto200%', 'invest: absurd growth gives the cap message'); T.ok(!/NaN|Infinity/.test(card(t, 0)), 'invest: no NaN/Infinity');
    set(t, 0, 'p', 100000); set(t, 0, 'r', 8); set(t, 0, 'y', 10); set(t, 0, 'n', 1);
    // SIP: each instalment invested at the start of its month
    let s = 0; for (let i = 0; i < 120; i++) s = (s + 5000) * 1.01;
    H(card(t, 1), 'Futurevalue' + m2(s), 'invest: SIP 5000 @ 12% for 10 years'); H(card(t, 1), 'Totalinvested600000.00', 'invest: invested 600000'); H(card(t, 1), 'Estimatedgain' + m2(s - 600000), 'invest: SIP gain');
    T.eq(t.all('[data-s="1"] table tr').length, 11, 'invest: SIP table rows');
    set(t, 1, 'r', 0); H(card(t, 1), 'Futurevalue600000.00', 'invest: SIP at 0% = sum of instalments');
    set(t, 1, 'm', 0); H(card(t, 1), 'valuesgivenoresult', 'invest: SIP 0 monthly gives note'); raw(t, 1, 'y', 61); H(card(t, 1), 'enteravaluefrom1upto60', 'invest: SIP 61 years refused');
    set(t, 1, 'm', 5000); set(t, 1, 'r', 12); set(t, 1, 'y', 10); keep('invest', 'Investment', t);
  }

  /* ---------------- Fuel ---------------- */
  {
    const t = await page.open('fuel');
    H(card(t, 0), 'Tripcost1666.67', 'fuel: 250 km at 15 km/L and 100 per litre'); H(card(t, 0), 'Fuelneeded16.67L', 'fuel: 16.67 litres'); H(card(t, 0), 'Costperkm6.67', 'fuel: 6.67 per km');
    set(t, 0, 'u', 'l100'); set(t, 0, 'e', 8); H(card(t, 0), 'Fuelneeded20.00L', 'fuel: 8 L/100 km over 250 km is 20 L'); H(card(t, 0), 'Tripcost2000.00', 'fuel: cost 2000'); H(card(t, 0), '12.50km/L', 'fuel: 8 L/100 = 12.5 km/L');
    set(t, 0, 'u', 'mpg'); set(t, 0, 'e', 30); const kpl = 30 * 1.609344 / 3.785411784; H(card(t, 0), 'Fuelneeded' + m2(250 / kpl) + 'L', 'fuel: 30 mpg (US)');
    set(t, 0, 'u', 'kmpl'); set(t, 0, 'e', 0); H(card(t, 0), 'valuesgivenoresult', 'fuel: 0 efficiency gives note');
    set(t, 0, 'e', 15); set(t, 0, 'd', 0); H(card(t, 0), 'Tripcost0.00', 'fuel: 0 km costs 0');
    raw(t, 0, 'd', 2e7); H(card(t, 0), 'enteravaluefrom0upto10000000', 'fuel: huge distance refused'); set(t, 0, 'd', 250);
    H(card(t, 1), 'Mileage14.00km/L', 'fuel: 420 km on 30 L = 14 km/L'); H(card(t, 1), 'Lper100km7.14', 'fuel: 7.14 L/100 km'); H(card(t, 1), 'MilesperUSgallon' + m2(14 * 3.785411784 / 1.609344), 'fuel: mpg');
    set(t, 1, 'f', 0); H(card(t, 1), 'valuesgivenoresult', 'fuel: 0 litres gives note'); set(t, 1, 'f', 30); keep('fuel', 'Fuel Cost', t);
  }

  /* ---------------- Salary convert ---------------- */
  {
    const t = await page.open('pay');
    H(card(t, 0), 'Peryear52000.00', 'pay: 25/h = 52000/yr'); H(card(t, 0), 'Permonth4333.33', 'pay: monthly'); H(card(t, 0), 'Per2weeks2000.00', 'pay: fortnight'); H(card(t, 0), 'Perweek1000.00', 'pay: week'); H(card(t, 0), 'Perday200.00', 'pay: day'); H(card(t, 0), 'Perhour25.00', 'pay: hour');
    set(t, 0, 'u', 'year'); set(t, 0, 'a', 60000); H(card(t, 0), 'Perhour' + m2(60000 / 2080), 'pay: 60000/yr = 28.85/h'); H(card(t, 0), 'Perday' + m2(60000 / 260), 'pay: per day'); H(card(t, 0), 'Permonth5000.00', 'pay: 5000/month');
    set(t, 0, 'u', 'month'); set(t, 0, 'a', 5000); H(card(t, 0), 'Peryear60000.00', 'pay: 5000/month = 60000/yr');
    set(t, 0, 'u', 'week'); set(t, 0, 'a', 1000); H(card(t, 0), 'Peryear52000.00', 'pay: 1000/week = 52000/yr');
    set(t, 0, 'u', 'day'); set(t, 0, 'a', 200); H(card(t, 0), 'Peryear52000.00', 'pay: 200/day x 5 x 52');
    set(t, 0, 'd', 0); H(card(t, 0), 'valuesgivenoresult', 'pay: 0 days gives note'); set(t, 0, 'd', 5); set(t, 0, 'h', 0); H(card(t, 0), 'valuesgivenoresult', 'pay: 0 hours gives note'); set(t, 0, 'h', 40);
    raw(t, 0, 'w', 60); H(card(t, 0), 'enteravaluefrom0upto53', 'pay: 60 weeks refused'); set(t, 0, 'w', 52);
    set(t, 0, 'u', 'hour'); set(t, 0, 'a', 25); keep('pay', 'Salary', t);
  }

  /* ---------------- Loan compare ---------------- */
  {
    const t = await page.open('loancmp');
    const e1 = bisectEmi(1e6, 9, 120), e2 = bisectEmi(1e6, 8.5, 144);
    const c1 = e1 * 120 - 1e6, c2 = e2 * 144 - 1e6;
    const rowsT = t.all('[data-s="0"] table tr').map((r) => [...r.children].map((c) => c.textContent.replace(/,/g, '')));
    T.eq(rowsT[1].join('|'), 'EMI|' + m2(e1) + '|' + m2(e2), 'loancmp: EMI of both offers');
    T.eq(rowsT[2].join('|'), 'Interest|' + m2(c1) + '|' + m2(c2), 'loancmp: interest of both offers');
    T.eq(rowsT[3].join('|'), 'Total|' + m2(c1 + 1e6) + '|' + m2(c2 + 1e6), 'loancmp: total of both offers');
    H(card(t, 0), (c1 < c2 ? 'OfferA' : 'OfferB') + 'costslessby' + m2(Math.abs(c1 - c2)), 'loancmp: winner and difference');
    set(t, 0, 'r2', 9); set(t, 0, 'n2', 120); H(card(t, 0), 'Samecostotal'.replace('Samecostotal', 'Sametotalcost'), 'loancmp: identical offers tie');
    set(t, 0, 'r1', 0); set(t, 0, 'n1', 10); H(card(t, 0), 'EMI100000.00', 'loancmp: 0% over 10 months'); set(t, 0, 'p', 0); H(card(t, 0), 'valuesgivenoresult', 'loancmp: 0 loan gives note');
    raw(t, 0, 'n1', 1300); H(card(t, 0), 'enteravaluefrom1upto1200', 'loancmp: 1300 months refused');
    set(t, 0, 'p', 1000000); set(t, 0, 'r1', 9); set(t, 0, 'n1', 120); set(t, 0, 'r2', 8.5); set(t, 0, 'n2', 144); keep('loancmp', 'Loan Compare', t);
  }

  /* ---------------- Break-even ---------------- */
  {
    const t = await page.open('breakeven');
    H(card(t, 0), 'Break-evenunits500', 'breakeven: 50000 / (250-150) = 500'); H(card(t, 0), 'Break-evenrevenue125000.00', 'breakeven: revenue'); H(card(t, 0), 'Profitperunit100.00', 'breakeven: cm'); H(card(t, 0), 'Contributionmargin40.00%', 'breakeven: 40%');
    H(card(t, 0), 'Unitsfortheprofittarget700', 'breakeven: target 20000 needs 700'); H(card(t, 0), 'Revenuefortarget175000.00', 'breakeven: revenue for target');
    set(t, 0, 'f', 1050); set(t, 0, 't', 0); H(card(t, 0), 'Break-evenunits11', 'breakeven: 10.5 rounds up to 11'); T.ok(!/profittarget/.test(card(t, 0)), 'breakeven: no target rows when target is 0');
    set(t, 0, 't', ''); T.ok(/Break-evenunits11/.test(card(t, 0)), 'breakeven: empty target is optional');
    set(t, 0, 'f', 0); H(card(t, 0), 'Break-evenunits0', 'breakeven: no fixed costs'); set(t, 0, 'f', 50000);
    set(t, 0, 'v', 250); H(card(t, 0), 'Pricemustbehigherthanthevariablecost', 'breakeven: price = variable cost refused'); set(t, 0, 'v', 300); H(card(t, 0), 'Pricemustbehigher', 'breakeven: price below cost refused');
    set(t, 0, 'p', 0); set(t, 0, 'v', 0); H(card(t, 0), 'Pricemustbehigher', 'breakeven: zero price refused');
    set(t, 0, 'f', ''); H(card(t, 0), 'Enterthevalues', 'breakeven: empty fixed costs gives note');
    set(t, 0, 'f', 50000); set(t, 0, 'p', 250); set(t, 0, 'v', 150); set(t, 0, 't', 20000); keep('breakeven', 'Break-even', t);
  }

  /* ---------------- Markup & Margin ---------------- */
  {
    const t = await page.open('margin');
    H(card(t, 0), 'Margin20%', 'margin: cost 80, price 100 = 20%'); H(card(t, 0), 'Markup25%', 'margin: markup 25%'); H(card(t, 0), 'Profit20.00', 'margin: profit 20');
    set(t, 0, 'c', 100); set(t, 0, 'p', 80); H(card(t, 0), 'Margin-25%', 'margin: selling below cost is -25% margin'); H(card(t, 0), 'Markup-20%', 'margin: markup -20%'); H(card(t, 0), 'Profit-20.00', 'margin: loss -20');
    set(t, 0, 'c', 0); H(card(t, 0), 'valuesgivenoresult', 'margin: cost 0 gives note'); set(t, 0, 'c', 80); set(t, 0, 'p', 100);
    H(card(t, 1), 'Sellingprice106.67', 'margin: 25% margin on cost 80 = 106.67'); H(card(t, 1), 'Profit26.67', 'margin: profit 26.67');
    set(t, 1, 'm', 'mk'); H(card(t, 1), 'Sellingprice100.00', 'margin: 25% markup on cost 80 = 100'); set(t, 1, 'x', 100); H(card(t, 1), 'Sellingprice160.00', 'margin: 100% markup doubles');
    set(t, 1, 'm', 'mg'); set(t, 1, 'x', 100); H(card(t, 1), 'Amarginmustbebelow100%', 'margin: 100% margin is refused with a message'); T.ok(!/Sellingprice/.test(card(t, 1)), 'margin: 100% margin has no price'); raw(t, 1, 'x', 1500); H(card(t, 1), 'enteravaluefrom0upto1000', 'margin: 1500 percent refused');
    set(t, 1, 'x', 25); set(t, 1, 'm', 'mg'); keep('margin', 'Markup', t);
  }

  /* ---------------- Simple interest ---------------- */
  {
    const t = await page.open('interest');
    H(card(t, 0), 'Interest10500.00', 'interest: 50000 x 7% x 3'); H(card(t, 0), 'Totalamount60500.00', 'interest: total'); H(card(t, 0), 'Peryear3500.00', 'interest: per year');
    set(t, 0, 'u', 'm'); set(t, 0, 't', 18); H(card(t, 0), 'Interest5250.00', 'interest: 18 months'); set(t, 0, 'u', 'd'); set(t, 0, 't', 100); H(card(t, 0), 'Interest' + m2(50000 * 0.07 * 100 / 365), 'interest: 100 days');
    raw(t, 0, 't', 40000); H(card(t, 0), 'enteravaluefrom0upto36500', 'interest: days limit'); set(t, 0, 'u', 'y'); raw(t, 0, 't', 150); H(card(t, 0), 'enteravaluefrom0upto100', 'interest: years limit tightens with unit');
    set(t, 0, 't', 0); H(card(t, 0), 'Interest0.00', 'interest: 0 time'); set(t, 0, 'p', 1e12); set(t, 0, 'r', 200); set(t, 0, 't', 100); T.ok(!/NaN|Infinity/.test(card(t, 0)), 'interest: huge input is finite');
    set(t, 0, 'p', ''); H(card(t, 0), 'Enterthevalues', 'interest: empty principal gives note');
    set(t, 0, 'p', 50000); set(t, 0, 'r', 7); set(t, 0, 't', 3); keep('interest', 'Simple Interest', t);
  }

  /* ---------------- FD / RD ---------------- */
  {
    const t = await page.open('fdrd');
    let v = 100000; for (let i = 0; i < 20; i++) v *= 1 + 0.07 / 4;
    H(card(t, 0), 'Maturityamount' + m2(v), 'fdrd: FD 100000 @ 7% 5y quarterly'); H(card(t, 0), 'Interestearned' + m2(v - 100000), 'fdrd: FD interest');
    set(t, 0, 'n', 12); v = 100000; for (let i = 0; i < 60; i++) v *= 1 + 0.07 / 12; H(card(t, 0), 'Maturityamount' + m2(v), 'fdrd: monthly compounding');
    set(t, 0, 'n', 1); H(card(t, 0), 'Maturityamount' + m2(100000 * Math.pow(1.07, 5)), 'fdrd: yearly compounding'); set(t, 0, 'y', 2.5); set(t, 0, 'n', 2); H(card(t, 0), 'Maturityamount' + m2(100000 * Math.pow(1.035, 5)), 'fdrd: 2.5 years half-yearly');
    set(t, 0, 'y', 0); H(card(t, 0), 'valuesgivenoresult', 'fdrd: 0 years gives note'); raw(t, 0, 'y', 60); H(card(t, 0), 'enteravaluefrom0upto50', 'fdrd: 60 years refused');
    set(t, 0, 'y', 5); set(t, 0, 'n', 4);
    // RD: 5000 a month, 6.5%, 24 months, quarterly compounding, deposit at the start of the month
    let rd = 0; for (let k = 0; k < 24; k++) rd += 5000 * Math.pow(1 + 0.065 / 4, (24 - k) / 3);
    H(card(t, 1), 'Maturityamount' + m2(rd), 'fdrd: RD 5000 x 24 months @ 6.5%'); H(card(t, 1), 'Totaldeposited120000.00', 'fdrd: RD deposits'); H(card(t, 1), 'Interestearned' + m2(rd - 120000), 'fdrd: RD interest');
    T.ok(rd > 120000 + 5000 * 0.065 * (24 * 25 / 2) / 12 * 0.99 && rd < 120000 + 5000 * 0.0665 * (24 * 25 / 2) / 12 * 1.1, 'fdrd: RD reference sits near simple-interest bounds');
    set(t, 1, 'r', 0); H(card(t, 1), 'Maturityamount120000.00', 'fdrd: RD at 0%'); set(t, 1, 't', 1); set(t, 1, 'r', 6.5); H(card(t, 1), 'Totaldeposited5000.00', 'fdrd: RD one month');
    raw(t, 1, 't', 700); H(card(t, 1), 'enteravaluefrom1upto600', 'fdrd: 700 months refused');
    set(t, 1, 't', 24); keep('fdrd', 'FD / RD', t);
  }

  /* ---------------- Net worth ---------------- */
  {
    const t = await page.open('networth');
    H(card(t, 0), 'Networth330000.00', 'networth: 450000 - 120000'); H(card(t, 0), 'Totalassets450000.00', 'networth: assets'); H(card(t, 0), 'Totaldebts120000.00', 'networth: debts');
    set(t, 0, 'a', 'Cash 5,000\nGold\nRefund -500\nStock 1e3\n2024 Car 2.5'); H(card(t, 0), 'Totalassets' + m2(5000 - 500 + 1000 + 2.5), 'networth: comma, negative, exponent and decimal amounts'); H(card(t, 0), '1linewithoutanamount', 'networth: Gold has no amount and is reported');
    set(t, 0, 'a', ''); set(t, 0, 'l', ''); H(card(t, 0), 'Networth0.00', 'networth: empty lists give 0'); set(t, 0, 'a', '100'); set(t, 0, 'l', '250'); H(card(t, 0), 'Networth-150.00', 'networth: negative net worth');
    set(t, 0, 'a', 'Loan 1\nGold\nPhone'); H(card(t, 0), '2lineswithoutanamount', 'networth: plural message');
    set(t, 0, 'a', 'Savings 150000\nInvestments 300000'); set(t, 0, 'l', 'Car loan 120000'); keep('networth', 'Net Worth', t);
  }

  /* ---------------- Growth rate (CAGR) ---------------- */
  {
    const t = await page.open('cagr');
    const g = (Math.pow(1.8, 1 / 5) - 1) * 100;
    H(card(t, 0), 'CAGR' + String(+g.toPrecision(6)) + '%peryear', 'cagr: 10000 -> 18000 in 5 years'); H(card(t, 0), 'Totalgrowth80%', 'cagr: total growth 80%'); H(card(t, 0), 'Doublesinabout' + String(+(Math.log(2) / Math.log(1 + g / 100)).toPrecision(4)) + 'years', 'cagr: doubling time');
    set(t, 0, 'b', 10000); H(card(t, 0), 'CAGR0%peryear', 'cagr: flat is 0%');
    set(t, 0, 'b', 5000); H(card(t, 0), 'CAGR' + String(+((Math.pow(0.5, 1 / 5) - 1) * 100).toPrecision(6)) + '%peryear', 'cagr: decline is negative'); T.ok(!/Doubles/.test(card(t, 0)), 'cagr: no doubling time for a decline'); T.ok(!/NaN|Infinity/.test(card(t, 0)), 'cagr: no NaN for decline');
    set(t, 0, 'b', 0); H(card(t, 0), 'valuesgivenoresult', 'cagr: end 0 gives note'); set(t, 0, 'b', 18000); set(t, 0, 'y', 0); H(card(t, 0), 'valuesgivenoresult', 'cagr: 0 years gives note');
    set(t, 0, 'y', 0.5); H(card(t, 0), 'CAGR' + String(+((1.8 * 1.8 - 1) * 100).toPrecision(6)) + '%', 'cagr: half a year annualises');
    set(t, 0, 'a', 1); set(t, 0, 'b', 1e12); set(t, 0, 'y', 0.01); T.ok(!/NaN|undefined/.test(card(t, 0)), 'cagr: extreme growth does not give NaN');
    set(t, 0, 'a', 10000); set(t, 0, 'b', 18000); set(t, 0, 'y', 5); keep('cagr', 'Growth Rate', t);
  }

  /* ---------------- Power cost ---------------- */
  {
    const t = await page.open('powercost');
    H(card(t, 0), 'Costpermonth(30days)720.00', 'powercost: 1500 W x 2 h x 30 days x 8'); H(card(t, 0), 'Energyperday3.000kWh', 'powercost: 3 kWh a day'); H(card(t, 0), 'Costperday24.00', 'powercost: 24 a day'); H(card(t, 0), 'Energypermonth90.00kWh', 'powercost: 90 kWh a month'); H(card(t, 0), 'Costperyear8760.00', 'powercost: 8760 a year');
    set(t, 0, 'q', 3); set(t, 0, 'w', 100); set(t, 0, 'h', 24); set(t, 0, 'r', 10); H(card(t, 0), 'Energyperday7.200kWh', 'powercost: 3 x 100 W x 24 h = 7.2 kWh'); H(card(t, 0), 'Costperyear' + m2(7.2 * 365 * 10), 'powercost: yearly');
    raw(t, 0, 'h', 25); H(card(t, 0), 'enteravaluefrom0upto24', 'powercost: 25 hours refused'); set(t, 0, 'h', 0); H(card(t, 0), 'Costperday0.00', 'powercost: 0 hours');
    set(t, 0, 'w', ''); H(card(t, 0), 'Enterthevalues', 'powercost: empty watts gives note');
    set(t, 0, 'w', 1500); set(t, 0, 'q', 1); set(t, 0, 'h', 2); set(t, 0, 'r', 8); keep('powercost', 'Power Cost', t);
  }

  await sleep(1800);
  for (const [id, lab, t] of pending) { const h = hist(id); T.ok(h.length > 0 && h[0].l.includes(lab) && h[0].v, 'history: ' + id + ' has a settled entry (got ' + JSON.stringify(h[0]) + ')'); t.close(); }
  await T.done(page);
})().catch((e) => { console.log('CRASH', e && e.stack || e); process.exit(1); });
