'use strict';
/* Functional tests for the maths and unit calculators in www/js/tools/calc.js. */
const { boot, suite } = require('../helpers/page');
(async () => {
  const T = suite('calc-math'), page = await boot();
  const w = page.w;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const fire = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true }));
  const F = (t, s, k) => t.q('[data-s="' + s + '"] [data-k="' + k + '"]');
  const set = (t, s, k, v) => { const e = F(t, s, k); e.value = String(v); fire(e, 'input'); fire(e, 'change'); };
  const raw = (t, s, k, v) => { const e = F(t, s, k); e.value = String(v); fire(e, 'input'); };
  const card = (t, s) => (t.q('[data-s="' + s + '"]').textContent || '').replace(/\s+/g, ' ');
  const res = (t, s) => (t.q('[data-s="' + (s || 0) + '"] [data-r]').textContent || '');
  const ns = (s) => String(s).replace(/\s+/g, '');
  const H = (txt, part, m) => T.has(ns(txt), ns(part), m);
  const row = (host, label) => { const it = [...host.querySelectorAll('.item')].find((x) => x.firstElementChild.textContent.trim() === label); return it ? it.lastElementChild.textContent.trim() : null; };
  const rowN = (host, label) => { const r = row(host, label); return r === null ? NaN : parseFloat(r.replace(/,/g, '')); };
  const hist = (id) => JSON.parse(page.eval("JSON.stringify(Hist.list('" + id + "'))"));
  const pending = [];
  const sig = (x, p) => String(+x.toPrecision(p)); // independent significant-digit rendering (en locale)

  /* ---------------- Scientific ---------------- */
  {
    const t = await page.open('sci');
    const ex = () => t.value('#ex');
    const keys = (s) => s.split(' ').forEach((k) => t.clickText(k));
    keys('1 2 + 3 0 × 2 ='); T.eq(ex(), '72', 'sci: 12 + 30 x 2 = 72 (precedence)');
    keys('AC'); T.eq(ex(), '', 'sci: AC clears');
    const calc = (src) => { t.type('#ex', src); t.clickText('='); return ex(); };
    const err = (src) => { t.type('#ex', src); t.clickText('='); return t.q('#rs').textContent; };
    T.eq(calc('sin(30)'), '0.5', 'sci: sin 30 degrees = 0.5');
    T.eq(calc('cos(60)'), '0.5', 'sci: cos 60 = 0.5'); T.eq(calc('tan(45)'), '1', 'sci: tan 45 = 1');
    T.eq(calc('sin(180)'), '0', 'sci: sin 180 is exactly 0, not 1.2e-16');
    T.eq(calc('asin(1)'), '90', 'sci: asin 1 = 90 degrees');
    t.clickText('DEG'); T.has(t.q('#st').textContent, 'RAD', 'sci: toggled to RAD');
    T.eq(calc('sin(π/2)'), '1', 'sci: sin(pi/2) = 1 rad'); T.eq(calc('cos(π)'), '-1', 'sci: cos(pi) = -1');
    t.clickText('RAD'); T.has(t.q('#st').textContent, 'DEG', 'sci: back to DEG');
    T.has(err('tan(90)'), 'Undefined', 'sci: tan 90 is undefined');
    T.eq(calc('5!'), '120', 'sci: 5! = 120'); T.eq(calc('0!'), '1', 'sci: 0! = 1');
    T.eq(calc('170!'), '7.25741561531e+306', 'sci: 170! is about 7.2574156153e306');
    T.has(err('171!'), 'Factorial needs 0 to 170', 'sci: 171! refused'); T.has(err('2.5!'), 'Factorial', 'sci: 2.5! refused');
    T.eq(calc('2^10'), '1024', 'sci: 2^10'); T.eq(calc('2^3^2'), '512', 'sci: power is right-associative'); T.eq(calc('-2^2'), '-4', 'sci: -2^2 = -4');
    T.eq(calc('2^-1'), '0.5', 'sci: 2^-1');
    T.eq(calc('1÷3'), '0.333333333333', 'sci: 1/3 to 12 digits'); T.eq(calc('0.1+0.2'), '0.3', 'sci: 0.1 + 0.2 = 0.3 exactly');
    T.eq(calc('50+10%'), '55', 'sci: 50 + 10% = 55'); T.eq(calc('200×10%'), '20', 'sci: 200 x 10% = 20'); T.eq(calc('50%'), '0.5', 'sci: 50% = 0.5');
    T.eq(calc('√(16)'), '4', 'sci: sqrt 16'); T.eq(calc('sqrt(2)'), '1.41421356237', 'sci: sqrt 2'); T.eq(calc('ln(e)'), '1', 'sci: ln e'); T.eq(calc('log(1000)'), '3', 'sci: log 1000 = 3');
    T.eq(calc('cbrt(27)'), '3', 'sci: cube root 27'); T.eq(calc('abs(-7)'), '7', 'sci: abs'); T.eq(calc('exp(0)'), '1', 'sci: exp 0');
    T.eq(calc('2π'), '6.28318530718', 'sci: implicit multiplication 2pi'); T.eq(calc('2(3+4)'), '14', 'sci: 2(3+4) = 14'); T.eq(calc('(1+2)(3+4)'), '21', 'sci: (1+2)(3+4)');
    T.eq(calc('0,5+1'), '1.5', 'sci: decimal comma 0,5 + 1 = 1.5'); T.eq(calc('7−2'), '5', 'sci: unicode minus');
    T.eq(calc('1e3+1'), '1001', 'sci: scientific notation');
    T.eq(calc('(2+3'), '5', 'sci: a missing closing bracket is tolerated');
    T.has(err('1÷0'), 'Math error', 'sci: 1/0 is a math error'); T.has(err('2+'), 'Incomplete', 'sci: "2+" incomplete');
    T.has(err('2+*3'), 'Unexpected', 'sci: "2+*3" refused'); T.has(err('foo(2)'), 'Unknown', 'sci: unknown name'); T.has(err('1..2+1'), 'Bad number', 'sci: 1..2 refused'); T.has(err('sin 5'), 'Use sin', 'sci: sin without bracket');
    t.q('#ex').value = '1+'.repeat(160) + '1'; fire(t.q('#ex'), 'input'); t.clickText('='); T.has(t.q('#rs').textContent, 'Too long', 'sci: over 300 characters is refused');
    T.eq(calc('2+2'), '4', 'sci: 2+2'); keys('× 3 ='); T.eq(ex(), '12', 'sci: operator after a result continues with it');
    keys('5'); T.eq(ex(), '5', 'sci: digit after a result starts a new sum');
    keys('AC 1 2 3 ⌫'); T.eq(ex(), '12', 'sci: backspace removes the last digit');
    keys('AC 7 M+ AC'); T.has(t.q('#st').textContent, 'M = 7', 'sci: M+ stores 7'); keys('MR'); T.eq(ex(), '7', 'sci: MR inserts the memory');
    keys('AC 2 M−'); T.has(t.q('#st').textContent, 'M = 5', 'sci: M- subtracts'); keys('MC'); T.ok(!/M =/.test(t.q('#st').textContent), 'sci: MC clears memory');
    calc('6×7'); keys('AC Ans + 1 ='); T.eq(ex(), '43', 'sci: Ans is the last result');
    const h = hist('sci'); T.ok(h.length > 5 && h.some((x) => x.l === '6×7' && x.v === '42'), 'sci: history lists 6x7 = 42');
    T.ok(h.some((x) => x.l.includes('sin(30)') && x.l.includes('[DEG]') && x.v === '0.5'), 'sci: history marks degree mode for trig');
    t.type('#ex', '1÷0'); const n0 = hist('sci').length; t.clickText('='); T.eq(hist('sci').length, n0, 'sci: errors are not stored in history');
    t.close();
  }

  /* ---------------- Fractions ---------------- */
  {
    const t = await page.open('fraction');
    const r = () => t.q('#r').textContent;
    H(r(), 'Result17/12', 'fraction: 3/4 + 2/3 = 17/12'); H(r(), 'Mixed number1 5/12', 'fraction: mixed 1 5/12'); H(r(), 'Decimal1.416666667', 'fraction: decimal'); H(r(), 'Percent141.66667%', 'fraction: percent');
    t.type('#o', '-'); t.type('#a', '1/3'); t.type('#b', '1/2'); H(r(), 'Result-1/6', 'fraction: 1/3 - 1/2 = -1/6');
    t.type('#o', '*'); t.type('#a', '1 1/2'); t.type('#b', '2'); H(r(), 'Result3', 'fraction: 1 1/2 x 2 = 3');
    t.type('#o', '/'); t.type('#a', '3/4'); t.type('#b', '0'); H(r(), 'Cannot divide by zero', 'fraction: divide by zero');
    t.type('#b', '3/4'); H(r(), 'Result1', 'fraction: x / x = 1');
    t.type('#o', '+'); t.type('#a', '0,25'); t.type('#b', '0.25'); H(r(), 'Result1/2', 'fraction: decimal comma 0,25 + 0.25 = 1/2');
    t.type('#a', '0.1'); t.type('#b', '0.2'); H(r(), 'Result3/10', 'fraction: 0.1 + 0.2 = 3/10 exactly');
    t.type('#a', '5/10'); t.type('#b', '0'); H(r(), 'Result1/2', 'fraction: 5/10 simplifies');
    t.type('#a', '-3/4'); t.type('#b', '-1/4'); H(r(), 'Result-1', 'fraction: negatives');
    t.type('#a', '7/2'); t.type('#b', '0'); H(r(), 'Mixed number3 1/2', 'fraction: mixed 3 1/2');
    t.type('#a', '-7/2'); H(r(), 'Mixed number-3 1/2', 'fraction: negative mixed');
    t.type('#a', 'abc'); H(r(), 'Enter two valid fractions', 'fraction: text refused'); t.type('#a', '1/0'); H(r(), 'Enter two valid fractions', 'fraction: zero denominator refused');
    t.type('#a', ''); H(r(), 'Enter two valid fractions', 'fraction: empty refused');
    t.type('#o', '*'); t.type('#a', '123456789'); t.type('#b', '123456789'); H(r(), 'too large', 'fraction: product beyond 2^53 is flagged, not rounded');
    t.type('#a', '3/4'); t.type('#b', '2/3'); t.type('#o', '+');
    pending.push(['fraction', '3/4 + 2/3', t]); t.el.remove();
  }

  /* ---------------- Ratio ---------------- */
  {
    const t = await page.open('ratio');
    H(card(t, 0), 'Simplest form2 : 3', 'ratio: 24:36 = 2:3'); H(card(t, 0), 'Decimal (a / b)0.66666667', 'ratio: decimal 0.6667');
    set(t, 0, 'a', -24); H(card(t, 0), 'Simplest form-2 : 3', 'ratio: negative'); raw(t, 0, 'a', 2.5); H(card(t, 0), 'Use whole numbers', 'ratio: decimals refused');
    set(t, 0, 'a', 0); H(card(t, 0), 'AandBcannotbe0', 'ratio: zero gives note'); set(t, 0, 'a', 24); set(t, 0, 'b', 36);
    H(card(t, 1), 'x20', 'ratio: 3:5 = 12:x gives 20'); set(t, 1, 'a', 0); H(card(t, 1), 'acannotbe0', 'ratio: a = 0 gives note'); set(t, 1, 'a', 7); set(t, 1, 'b', 3); set(t, 1, 'c', 14); H(card(t, 1), 'x6', 'ratio: 7:3 = 14:6');
    set(t, 1, 'a', 3); set(t, 1, 'b', 5); set(t, 1, 'c', 12);
    H(card(t, 2), 'A gets400.00', 'ratio: split 1000 in 2:3 -> 400'); H(card(t, 2), 'B gets600.00', 'ratio: B gets 600');
    set(t, 2, 'a', 0); set(t, 2, 'b', 0); H(card(t, 2), 'cannotbothbe0', 'ratio: 0:0 split gives note'); set(t, 2, 'a', 1); set(t, 2, 'b', 2); set(t, 2, 't', 100); H(card(t, 2), 'A gets33.33', 'ratio: 100 in 1:2 -> 33.33');
    set(t, 2, 'a', 2); set(t, 2, 'b', 3); set(t, 2, 't', 1000);
    pending.push(['ratio', 'Ratio', t]); t.el.remove();
  }

  /* ---------------- Statistics ---------------- */
  {
    const t = await page.open('stats');
    const d = [4, 8, 15, 16, 23, 42, 8], n = d.length, mean = d.reduce((a, b) => a + b) / n, ss = d.reduce((a, b) => a + (b - mean) ** 2, 0);
    const h = t.q('[data-r]'), rv = (l) => row(h, l);
    T.eq(h.querySelector('.mid').textContent, sig(mean, 10), 'stats: mean 116/7');
    T.eq(rv('Count'), '7', 'stats: count'); T.eq(rv('Sum'), '116', 'stats: sum'); T.eq(rv('Median'), '15', 'stats: median'); T.eq(rv('Mode'), '8', 'stats: mode');
    T.eq(rv('Min / Max'), '4 / 42', 'stats: min/max'); T.eq(rv('Range'), '38', 'stats: range');
    T.eq(rv('Std dev (population)'), sig(Math.sqrt(ss / n), 8), 'stats: population sd'); T.eq(rv('Std dev (sample)'), sig(Math.sqrt(ss / (n - 1)), 8), 'stats: sample sd'); T.eq(rv('Variance (sample)'), sig(ss / (n - 1), 8), 'stats: sample variance');
    set(t, 0, 'n', '2 4 4 4 5 5 7 9'); T.eq(rv('Std dev (population)'), '2', 'stats: classic data set has sd 2'); T.eq(rv('Mean') === null ? t.q('[data-r] .mid').textContent : '', '5', 'stats: mean 5');
    T.eq(rv('Median'), '4.5', 'stats: even count median'); set(t, 0, 'n', '1 2 2 3 3'); T.eq(rv('Mode'), '2, 3', 'stats: two modes');
    set(t, 0, 'n', '1\n2\n3\n4'); T.eq(rv('Median'), '2.5', 'stats: new-line separated');
    set(t, 0, 'n', '1;2;3'); T.eq(rv('Count'), '3', 'stats: semicolon separated');
    set(t, 0, 'n', '1,2,3'); T.eq(rv('Count'), '3', 'stats: comma separated without spaces');
    set(t, 0, 'n', '-5, 2.5, 1e2'); T.eq(rv('Sum'), '97.5', 'stats: negatives, decimals and exponent');
    set(t, 0, 'n', '7'); T.eq(rv('Count'), '1', 'stats: single value'); T.eq(rv('Std dev (sample)'), '—', 'stats: sample sd of one value is a dash'); T.eq(rv('Mode'), 'none', 'stats: no mode');
    set(t, 0, 'n', '1 2 abc'); H(t.q('[data-r]').textContent, '"abc" is not a number', 'stats: bad token named');
    set(t, 0, 'n', ''); H(card(t, 0), 'Enter the values', 'stats: empty gives note');
    set(t, 0, 'n', Array.from({ length: 1000 }, (_, i) => i + 1).join(' ')); T.eq(rv('Sum'), '500500', 'stats: 1..1000 sum');
    set(t, 0, 'n', '4, 8, 15, 16, 23, 42, 8');
    pending.push(['stats', 'Statistics', t]); t.el.remove();
  }

  /* ---------------- Prime ---------------- */
  {
    const t = await page.open('prime');
    const go = (v) => { t.type('#n', v); t.click('#go'); return t.q('#r'); };
    const goRaw = (v) => { t.q('#n').value = String(v); fire(t.q('#n'), 'input'); t.click('#go'); return t.q('#r'); }; // as typed, before the field clamps it on leaving
    let r = t.q('#r');
    T.eq(row(r, 'Prime?'), 'No, composite', 'prime: 360 composite'); T.eq(row(r, 'Prime factors'), '2^3 × 3^2 × 5', 'prime: 360 = 2^3 x 3^2 x 5');
    T.has(row(r, 'Divisors (24)'), '1, 2, 3, 4, 5, 6, 8, 9, 10, 12, 15, 18, 20, 24, 30, 36, 40, 45, 60, 72, 90, 120, 180, 360', 'prime: 24 divisors of 360 (independent list below)');
    T.eq(row(r, 'Next prime'), '367', 'prime: next prime after 360 is 367'); T.eq(row(r, 'Previous prime'), '359', 'prime: previous prime is 359');
    r = go(97); T.eq(row(r, 'Prime?'), 'Yes, prime', 'prime: 97'); T.eq(row(r, 'Prime factors'), '97', 'prime: 97 factors');
    r = go(2); T.eq(row(r, 'Prime?'), 'Yes, prime', 'prime: 2'); T.eq(row(r, 'Previous prime'), null, 'prime: nothing before 2'); T.eq(row(r, 'Next prime'), '3', 'prime: next after 2');
    r = go(4); T.eq(row(r, 'Prime factors'), '2^2', 'prime: 4 = 2^2');
    r = go(1000000007); T.eq(row(r, 'Prime?'), 'Yes, prime', 'prime: 1e9+7 is prime');
    r = go(600851475143); T.eq(row(r, 'Prime factors'), '71 × 839 × 1471 × 6857', 'prime: Project Euler 3 factors'); T.eq(row(r, 'Divisors (16)'), null, 'prime: no divisor list above 1e9');
    r = go(999999999989); T.eq(row(r, 'Prime?'), 'Yes, prime', 'prime: largest prime below 1e12'); T.eq(row(r, 'Next prime'), '1000000000039', 'prime: next prime above 1e12 is 1000000000039');
    r = go(9e15); T.eq(row(r, 'Prime factors'), '2^15 × 3^2 × 5^15', 'prime: 9e15'); H(r.textContent, 'only searched up to', 'prime: note about neighbours for huge numbers');
    r = goRaw(1); H(r.textContent, 'Enter a whole number from 2', 'prime: 1 refused'); r = goRaw(360.5); H(r.textContent, 'Enter a whole number from 2', 'prime: decimals refused'); r = goRaw(''); H(r.textContent, 'Enter a whole number', 'prime: empty refused');
    t.type('#n', 1); T.eq(t.value('#n'), '2', 'prime: leaving the field with 1 clamps it to 2'); t.type('#n', 360.5); T.eq(t.value('#n'), '361', 'prime: leaving the field with 360.5 rounds to a whole number');
    r = goRaw(9e15 + 2); H(r.textContent, 'Enter a whole number', 'prime: above limit refused');
    // Enter key
    t.type('#n', 49); t.q('#n').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); T.eq(row(t.q('#r'), 'Prime factors'), '7^2', 'prime: Enter key analyses');
    let ref = []; for (let i = 1; i <= 360; i++) if (360 % i === 0) ref.push(i); T.eq(ref.length, 24, 'prime: reference divisor count');
    t.close();
  }

  /* ---------------- GCD & LCM ---------------- */
  {
    const t = await page.open('gcdlcm');
    T.has(ns(res(t)), 'GCD(HCF)6', 'gcd: gcd 12,18,30 = 6'); H(res(t), 'LCM180', 'gcd: lcm = 180');
    set(t, 0, 'n', '48 180'); H(res(t), 'GCD(HCF)12', 'gcd: gcd 48,180 = 12'); H(res(t), 'LCM720', 'gcd: lcm 48,180 = 720');
    set(t, 0, 'n', '7, 13'); H(res(t), 'GCD(HCF)1', 'gcd: coprime'); H(res(t), 'LCM91', 'gcd: lcm 91');
    set(t, 0, 'n', '-12, 18'); H(res(t), 'GCD(HCF)6', 'gcd: negative numbers use absolute value');
    set(t, 0, 'n', '4,6,10,15'); H(res(t), 'GCD(HCF)1', 'gcd: four numbers'); H(res(t), 'LCM60', 'gcd: lcm 60');
    set(t, 0, 'n', '1000000000000, 999999999989'); H(res(t), 'LCM', 'gcd: big pair'); H(res(t), 'too large', 'gcd: lcm beyond 9e15 says too large');
    set(t, 0, 'n', '12 abc'); H(res(t), '"abc" is not a whole number', 'gcd: bad token named');
    set(t, 0, 'n', '12'); H(card(t, 0), 'Enteratleasttwowholenumbers', 'gcd: a single number needs another');
    set(t, 0, 'n', '0, 5'); H(res(t), 'Usewholenumbersfrom1', 'gcd: zero is refused with a message'); T.ok(!/GCD/.test(res(t)), 'gcd: zero gives no answer');
    set(t, 0, 'n', '12.5, 5'); H(res(t), 'Usewholenumbersfrom1', 'gcd: decimals are refused with a message');
    set(t, 0, 'n', '12 18'); pending.push(['gcdlcm', 'GCD', t]); t.el.remove();
  }

  /* ---------------- Quadratic ---------------- */
  {
    const t = await page.open('quad');
    const R = () => t.q('[data-r]');
    T.eq(row(R(), 'x₁'), '1', 'quad: x²-3x+2 root 1'); T.eq(row(R(), 'x₂'), '2', 'quad: root 2'); T.eq(row(R(), 'Discriminant'), '1', 'quad: D = 1'); T.eq(row(R(), 'Vertex'), '(1.5, -0.25)', 'quad: vertex');
    set(t, 0, 'a', 0); set(t, 0, 'b', 2); set(t, 0, 'c', -4); H(res(t), 'Linear: x2', 'quad: a=0 is linear');
    set(t, 0, 'b', 0); H(res(t), 'No equation', 'quad: a=b=0');
    set(t, 0, 'a', 1); set(t, 0, 'b', 2); set(t, 0, 'c', 1); T.eq(row(R(), 'x (double root)'), '-1', 'quad: double root'); T.eq(row(R(), 'Discriminant'), '0', 'quad: D = 0');
    set(t, 0, 'b', 2); set(t, 0, 'c', 5); T.eq(row(R(), 'x₁'), '-1 + 2i', 'quad: complex x1'); T.eq(row(R(), 'x₂'), '-1 − 2i', 'quad: complex x2'); T.eq(row(R(), 'Discriminant'), '-16', 'quad: D = -16');
    set(t, 0, 'a', 2); set(t, 0, 'b', 0); set(t, 0, 'c', -8); T.eq(row(R(), 'x₁'), '-2', 'quad: 2x²-8 root -2'); T.eq(row(R(), 'x₂'), '2', 'quad: root 2');
    set(t, 0, 'a', -1); set(t, 0, 'b', 0); set(t, 0, 'c', 4); T.eq(row(R(), 'x₁'), '-2', 'quad: negative a sorted'); T.eq(row(R(), 'Vertex'), '(0, 4)', 'quad: vertex (0,4) not (-0, 4)');
    set(t, 0, 'a', 1); set(t, 0, 'b', -1e8); set(t, 0, 'c', 1); H(row(R(), 'x₁'), '0.00000001', 'quad: stable small root of x²-1e8x+1 (no cancellation)'); H(row(R(), 'x₂').replace(/,/g, ''), '100000000', 'quad: large root 1e8');
    set(t, 0, 'a', 0.5); set(t, 0, 'b', 1); set(t, 0, 'c', -1.5); T.eq(row(R(), 'x₁'), '-3', 'quad: fractional a root -3'); T.eq(row(R(), 'x₂'), '1', 'quad: root 1');
    set(t, 0, 'a', ''); H(card(t, 0), 'Enter the values', 'quad: empty a gives note');
    raw(t, 0, 'a', 2e9); H(card(t, 0), 'enter a value from', 'quad: out of range message');
    set(t, 0, 'a', 1); set(t, 0, 'b', -3); set(t, 0, 'c', 2); pending.push(['quad', 'ax', t]); t.el.remove();
  }

  /* ---------------- Area & Volume ---------------- */
  {
    const t = await page.open('shapes');
    const R = () => t.q('#r'), PI = Math.PI;
    const inputs = () => t.all('#f input');
    const fill = (...v) => v.forEach((x, i) => { inputs()[i].value = String(x); fire(inputs()[i], 'input'); });
    const shape = (n) => { t.q('#s').value = n; fire(t.q('#s'), 'change'); };
    const isNum = (label, exp, tol) => { const g = rowN(R(), label); T.ok(Math.abs(g - exp) <= (tol || 1e-6 * Math.abs(exp)) + 1e-12, 'shapes: ' + t.q('#s').value + ' ' + label + ' = ' + exp + ' (got ' + g + ')'); };
    shape('Square'); fill(3); isNum('Area', 9); isNum('Perimeter', 12); isNum('Diagonal', 4.2426407, 1e-6);
    shape('Rectangle'); fill(10, 5); isNum('Area', 50); isNum('Perimeter', 30); isNum('Diagonal', Math.sqrt(125), 1e-5);
    shape('Triangle'); fill(10, 5); isNum('Area', 25);
    shape('Circle'); fill(5); isNum('Area', 78.539816, 1e-5); isNum('Circumference', 31.415927, 1e-5); isNum('Diameter', 10);
    shape('Trapezoid'); fill(4, 6, 3); isNum('Area', 15);
    shape('Ellipse'); fill(10, 5); isNum('Area', 157.07963, 1e-4);
    // true ellipse perimeter by numerical integration
    let per = 0; const N = 200000; for (let i = 0; i < N; i++) { const th = (i + 0.5) * (PI / 2) / N; per += Math.sqrt(100 * Math.sin(th) ** 2 + 25 * Math.cos(th) ** 2); } per *= 4 * (PI / 2) / N;
    isNum('Perimeter (approx)', per, per * 0.001);
    shape('Cube'); fill(10); isNum('Volume', 1000); isNum('Surface area', 600); isNum('Space diagonal', 17.320508, 1e-5);
    shape('Cuboid'); fill(2, 3, 4); isNum('Volume', 24); isNum('Surface area', 52); isNum('Space diagonal', Math.sqrt(29), 1e-5);
    shape('Cylinder'); fill(3, 10); isNum('Volume', 282.74334, 1e-4); isNum('Curved area', 188.49556, 1e-4); isNum('Total surface', 245.04422, 1e-4);
    shape('Sphere'); fill(10); isNum('Volume', 4188.7902, 1e-3); isNum('Surface area', 1256.6371, 1e-3);
    shape('Cone'); fill(3, 4); isNum('Volume', 37.699112, 1e-5); isNum('Slant height', 5); isNum('Total surface', 75.398224, 1e-5);
    shape('Pyramid'); fill(6, 4); isNum('Volume', 48); isNum('Slant height', 5); isNum('Total surface', 96);
    fill(0); H(R().textContent, 'Enter positive sizes', 'shapes: zero refused'); fill(''); H(R().textContent, 'Enter positive sizes', 'shapes: empty refused');
    fill(2e9, 1); H(R().textContent, 'Enter positive sizes', 'shapes: over the limit refused'); T.ok(!/NaN|Infinity/.test(R().textContent), 'shapes: no NaN');
    shape('Sphere'); fill(1e9); T.ok(!/NaN|Infinity/.test(R().textContent) && /Volume/.test(R().textContent), 'shapes: biggest allowed sphere is finite');
    shape('Circle'); fill(5); T.eq(inputs().length, 1, 'shapes: one field for a circle');
    pending.push(['shapes', 'Circle', t]); t.el.remove();
  }

  /* ---------------- Triangle ---------------- */
  {
    const t = await page.open('triangle');
    const R = () => t.q('#r'), deg = (x) => x * 180 / Math.PI;
    T.eq(row(R(), 'Angle C'), '90°', 'triangle: 3-4-5 right angle'); T.eq(row(R(), 'Angle A'), sig(deg(Math.acos(4 / 5)), 7) + '°', 'triangle: angle A = acos(4/5)'); T.eq(row(R(), 'Angle B'), sig(deg(Math.acos(3 / 5)), 7) + '°', 'triangle: angle B');
    T.eq(row(R(), 'Type'), 'scalene, right', 'triangle: scalene right'); T.eq(row(R(), 'Area'), '6', 'triangle: area 6'); T.eq(row(R(), 'Perimeter'), '12', 'triangle: perimeter 12'); T.eq(row(R(), 'Inradius'), '1', 'triangle: inradius 1'); T.eq(row(R(), 'Circumradius'), '2.5', 'triangle: circumradius 2.5');
    t.type('#a', 1); t.type('#b', 1); t.type('#c', 5); H(R().textContent, 'cannot form a triangle', 'triangle: 1,1,5 impossible');
    t.type('#a', 2); t.type('#b', 2); t.type('#c', 2); T.eq(row(R(), 'Type'), 'equilateral, acute', 'triangle: equilateral'); T.eq(row(R(), 'Angle A'), '60°', 'triangle: 60 degrees'); T.eq(row(R(), 'Area'), sig(Math.sqrt(3), 8), 'triangle: area sqrt(3)');
    t.type('#a', 5); t.type('#b', 5); t.type('#c', 6); T.eq(row(R(), 'Type'), 'isosceles, acute', 'triangle: isosceles'); T.eq(row(R(), 'Area'), '12', 'triangle: 5-5-6 area 12');
    t.type('#a', 2); t.type('#b', 3); t.type('#c', 4); T.eq(row(R(), 'Type'), 'scalene, obtuse', 'triangle: 2-3-4 obtuse');
    t.type('#a', 1); t.type('#b', 2); t.type('#c', 3); H(R().textContent, 'cannot form a triangle', 'triangle: degenerate 1,2,3 refused');
    t.select('#m', 'sas'); t.type('#a', 3); t.type('#b', 4); t.type('#c', 90); T.eq(row(R(), 'Side c'), '5', 'triangle: SAS 3,4,90 gives c=5'); T.eq(row(R(), 'Area'), '6', 'triangle: SAS area 6'); H(t.q('#cl').textContent, 'Angle C', 'triangle: label changes to angle');
    t.type('#c', 60); T.eq(row(R(), 'Side c'), sig(Math.sqrt(13), 8), 'triangle: SAS 3,4,60 gives sqrt(13)');
    t.type('#c', 180); H(R().textContent, 'Angle must be between 0 and 180', 'triangle: 180 refused'); t.type('#c', 0); H(R().textContent, 'Angle must be between 0 and 180', 'triangle: 0 refused');
    t.type('#c', 200); T.ok(!/Side c/.test(R().textContent), 'triangle: 200 degrees gives no result');
    t.type('#c', ''); T.ok(!/NaN/.test(R().textContent), 'triangle: empty angle no NaN');
    t.type('#c', 90); t.type('#a', 3); t.type('#b', 4);
    pending.push(['triangle', 'Triangle', t]); t.el.remove();
  }

  /* ---------------- Number Words ---------------- */
  {
    const t = await page.open('numwords');
    const W = () => t.q('[data-r] .card').textContent.trim();
    T.eq(W(), 'Twelve lakh thirty-four thousand five hundred sixty-seven', 'numwords: 1234567 Indian');
    set(t, 0, 's', 'int'); T.eq(W(), 'One million two hundred thirty-four thousand five hundred sixty-seven', 'numwords: 1234567 international');
    set(t, 0, 'n', 0); T.eq(W(), 'Zero', 'numwords: 0'); set(t, 0, 'n', 100); T.eq(W(), 'One hundred', 'numwords: 100'); set(t, 0, 'n', 21); T.eq(W(), 'Twenty-one', 'numwords: 21'); set(t, 0, 'n', 1000); T.eq(W(), 'One thousand', 'numwords: 1000');
    set(t, 0, 'n', 12.5); T.eq(W(), 'Twelve and fifty hundredths', 'numwords: 12.5'); set(t, 0, 'n', 12.05); T.eq(W(), 'Twelve and five hundredths', 'numwords: 12.05');
    set(t, 0, 'n', 1.999); T.eq(W(), 'Two', 'numwords: 1.999 rounds to two'); set(t, 0, 'n', 0.5); T.eq(W(), 'Zero and fifty hundredths', 'numwords: 0.5');
    set(t, 0, 'n', -5); T.eq(W(), 'Minus five', 'numwords: negative'); set(t, 0, 'n', -0.001); T.eq(W(), 'Zero', 'numwords: -0.001 is zero, not minus zero'); set(t, 0, 'n', 0.004); T.eq(W(), 'Zero', 'numwords: 0.004 is zero');
    set(t, 0, 'n', 999999999999999); T.eq(W(), 'Nine hundred ninety-nine trillion nine hundred ninety-nine billion nine hundred ninety-nine million nine hundred ninety-nine thousand nine hundred ninety-nine', 'numwords: max international');
    set(t, 0, 's', 'in'); set(t, 0, 'n', 10000000); T.eq(W(), 'One crore', 'numwords: 1e7 = one crore'); set(t, 0, 'n', 1000000); T.eq(W(), 'Ten lakh', 'numwords: 1e6 = ten lakh');
    set(t, 0, 'n', 123456789); T.eq(W(), 'Twelve crore thirty-four lakh fifty-six thousand seven hundred eighty-nine', 'numwords: 123456789 Indian');
    set(t, 0, 'n', 100000); T.eq(W(), 'One lakh', 'numwords: 1 lakh');
    raw(t, 0, 'n', 1e15); H(res(t), 'enter a value from', 'numwords: 1e15 refused'); set(t, 0, 'n', ''); H(card(t, 0), 'Enter the values', 'numwords: empty gives note');
    set(t, 0, 'n', 1234567); set(t, 0, 's', 'in'); pending.push(['numwords', 'Number Words', t]); t.el.remove();
  }

  /* ---------------- Marks & GPA ---------------- */
  {
    const t = await page.open('marks');
    H(card(t, 0), 'Percentage82.857%', 'marks: 290/350 = 82.857%'); H(card(t, 0), 'Total290 / 350', 'marks: totals'); H(card(t, 0), 'Grade (typical scale)A', 'marks: grade A');
    set(t, 0, 'm', '45\n45'); set(t, 0, 'x', 50); H(card(t, 0), 'Percentage90%', 'marks: default max 50 -> 90%'); H(card(t, 0), 'A+', 'marks: A+');
    set(t, 0, 'm', '85,5\n10/20'); set(t, 0, 'x', 100); H(card(t, 0), 'Total95.5 / 120', 'marks: decimal comma and per-line max');
    set(t, 0, 'm', '50\n40\nabc'); H(card(t, 0), 'Percentage45%', 'marks: 90/200 = 45%'); H(card(t, 0), '1 line not understood', 'marks: bad line counted'); H(card(t, 0), 'Grade (typical scale)E', 'marks: grade E');
    set(t, 0, 'm', '30'); H(card(t, 0), 'Grade (typical scale)F', 'marks: 30% is F'); set(t, 0, 'm', ''); H(card(t, 0), 'Enter the values', 'marks: empty gives note');
    set(t, 0, 'm', '0'); H(card(t, 0), 'Percentage0%', 'marks: zero marks is 0%');
    set(t, 0, 'm', '85\n72\n91\n42/50');
    H(card(t, 1), 'GPA3.66', 'gpa: default (4x4 + 3.3x3... ) = 3.66'); H(card(t, 1), 'Total credits9', 'gpa: credits 9'); H(card(t, 1), 'Grade points32.9', 'gpa: points 32.9');
    set(t, 1, 'g', 'A+ 3\nA- 3\nD- 2\nF 1'); H(card(t, 1), 'Grade points' + sig(4 * 3 + 3.7 * 3 + 0.7 * 2, 6), 'gpa: A+ A- D- F points'); H(card(t, 1), 'GPA' + (((4 * 3 + 3.7 * 3 + 0.7 * 2) / 9)).toFixed(2), 'gpa: gpa value');
    set(t, 1, 'g', 'A 4\nzz 2'); H(card(t, 1), '1 line not understood', 'gpa: bad grade'); H(card(t, 1), 'GPA4.00', 'gpa: only good lines count');
    set(t, 1, 'g', 'zz 2'); H(card(t, 1), '1 line not understood', 'gpa: only bad lines'); set(t, 1, 'g', ''); H(card(t, 1), 'Enter the values', 'gpa: empty gives note');
    set(t, 1, 'g', 'b 3.5\n10 2'); T.ok(!/NaN/.test(card(t, 1)), 'gpa: lower-case letter and numeric points');
    set(t, 1, 'g', 'A 4\nB+ 3\n3.5 2'); pending.push(['marks', 'Marks', t]); t.el.remove();
  }

  /* ---------------- Cooking ---------------- */
  {
    const t = await page.open('cooking');
    const R = () => t.q('[data-r]');
    T.eq(row(R(), 'Grams'), '120', 'cooking: 1 cup flour = 120 g'); T.eq(row(R(), 'Ounces'), sig(120 / 28.349523125, 4), 'cooking: 120 g in oz'); T.eq(row(R(), 'Tablespoons'), '16', 'cooking: 16 tbsp per cup'); T.eq(row(R(), 'Teaspoons'), '48', 'cooking: 48 tsp per cup');
    set(t, 0, 'i', 'Butter'); set(t, 0, 'u', 'tbsp'); T.eq(row(R(), 'Grams'), '14.188', 'cooking: 1 tbsp butter = 14.19 g (227/16)');
    set(t, 0, 'i', 'Sugar (white)'); set(t, 0, 'u', 'kg'); T.eq(row(R(), 'Grams'), '1000', 'cooking: 1 kg = 1000 g'); T.eq(row(R(), 'Cups'), '5', 'cooking: 1 kg sugar = 5 cups');
    set(t, 0, 'u', 'oz'); T.eq(row(R(), 'Grams'), '28.35', 'cooking: 1 oz = 28.35 g');
    set(t, 0, 'i', 'Honey'); set(t, 0, 'u', 'ml'); set(t, 0, 'a', 236.588); T.eq(row(R(), 'Grams'), '340', 'cooking: one cup of honey in ml = 340 g');
    set(t, 0, 'i', 'Flour (plain)'); set(t, 0, 'u', 'g'); set(t, 0, 'a', 250); T.eq(row(R(), 'Cups'), '2.083', 'cooking: 250 g flour = 2.083 cups');
    set(t, 0, 'a', 0); H(card(t, 0), 'valuesgivenoresult', 'cooking: 0 gives note'); set(t, 0, 'a', ''); H(card(t, 0), 'Enter the values', 'cooking: empty gives note');
    set(t, 0, 'a', 1e6); T.ok(!/NaN|Infinity/.test(card(t, 0)), 'cooking: max amount ok');
    set(t, 0, 'a', 2); set(t, 0, 'u', 'cup'); pending.push(['cooking', 'Cooking', t]); t.el.remove();
  }

  /* ---------------- Sizes ---------------- */
  {
    const t = await page.open('sizes');
    const R = (s) => t.q('[data-s="' + s + '"] [data-r]');
    T.eq(row(R(0), 'US men'), '9', 'sizes: UK 8 = US men 9'); T.eq(row(R(0), 'US women'), '10.5', 'sizes: UK 8 = US women 10.5'); T.eq(row(R(0), 'UK'), '8', 'sizes: UK echo');
    // every row converts back to itself from every system
    const rows = JSON.parse(page.eval("(function(){ var t = Tools.get('sizes'); return 1; })() && 1") ? '[]' : '[]');
    let bad = 0, n = 0;
    for (let uk = 1; uk <= 16; uk += 0.5) {
      set(t, 0, 's', 'uk'); set(t, 0, 'v', uk);
      const vals = { uk, usm: rowN(R(0), 'US men'), usw: rowN(R(0), 'US women'), eu: rowN(R(0), 'EU'), cm: rowN(R(0), 'Foot length') };
      ['usm', 'usw', 'eu', 'cm'].forEach((sys) => { set(t, 0, 's', sys); set(t, 0, 'v', vals[sys]); n++; if (rowN(R(0), 'UK') !== uk) bad++; });
      if (!(vals.usm === uk + 1 && vals.usw === uk + 2.5)) bad++;
    }
    T.eq(bad, 0, 'sizes: ' + n + ' round trips between systems land on the same UK size and US = UK+1 (men), +2.5 (women)');
    set(t, 0, 's', 'uk'); set(t, 0, 'v', 20); H(R(0).textContent, 'Size out of range', 'sizes: UK 20 refused'); set(t, 0, 'v', 0); H(card(t, 0), 'valuesgivenoresult', 'sizes: 0 gives note');
    set(t, 0, 'v', 8.25); T.ok(/Size out of range|UK/.test(R(0).textContent) && !/NaN/.test(R(0).textContent), 'sizes: quarter size does not break');
    H(card(t, 1), 'UK10', 'sizes: women UK 10'); H(card(t, 1), 'US6', 'sizes: UK 10 = US 6'); H(card(t, 1), 'EU38', 'sizes: UK 10 = EU 38');
    set(t, 1, 's', 'us'); set(t, 1, 'v', 6); H(card(t, 1), 'UK10', 'sizes: US 6 = UK 10'); set(t, 1, 's', 'eu'); set(t, 1, 'v', 40); H(card(t, 1), 'UK12', 'sizes: EU 40 = UK 12');
    H(card(t, 2), 'EU size50', 'chest: 40 in = EU 50'); H(card(t, 2), 'Letter sizeM', 'chest: 40 in is M'); H(card(t, 2), '101.6 cm', 'chest: 40 in = 101.6 cm');
    set(t, 2, 'u', 'cm'); set(t, 2, 'v', 100); H(card(t, 2), '39.37 in', 'chest: 100 cm = 39.37 in'); H(card(t, 2), 'Letter sizeM', 'chest: 100 cm is M');
    set(t, 2, 'v', 120); H(card(t, 2), 'Letter sizeXXL', 'chest: 120 cm is XXL (47.2 in)'); set(t, 2, 'v', 80); H(card(t, 2), 'Letter sizeXS', 'chest: 80 cm is XS'); set(t, 2, 'v', 0); H(card(t, 2), 'valuesgivenoresult', 'chest: 0 gives note');
    set(t, 0, 'v', 8); set(t, 2, 'v', 100); pending.push(['sizes', 'Size Converter', t]); t.el.remove();
  }

  await sleep(1800);
  for (const [id, lab, t] of pending) { const h = hist(id); T.ok(h.length > 0 && h[0].l.includes(lab) && h[0].v, 'history: ' + id + ' has a settled entry (got ' + JSON.stringify(h[0]) + ')'); t.close(); }
  await T.done(page);
})().catch((e) => { console.log("CRASH", e && e.stack || e); process.exit(1); });
