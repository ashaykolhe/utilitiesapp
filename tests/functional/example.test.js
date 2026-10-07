'use strict';
/* Example functional test: drives real tools like a person would. Copy this shape for other groups. */
const { boot, suite } = require('../helpers/page');
(async () => {
  const T = suite('example'), page = await boot();
  const emi = await page.open('emi');
  emi.type('input[type=number]', '500000');           // first number field is the loan amount
  await page.wait(30);
  T.has(emi.text(), '10,258.27', 'EMI for 500000 at 8.5% over 5 years is 10,258.27');
  emi.close();
  const calc = await page.open('calculator');
  calc.clickText('1'); calc.clickText('2'); calc.clickText('+'); calc.clickText('3'); calc.clickText('0'); calc.clickText('×'); calc.clickText('2'); calc.clickText('=');
  T.has(calc.text(), '72', 'calculator: 12 + 30 x 2 = 72');
  calc.close();
  await T.done(page);
})();
