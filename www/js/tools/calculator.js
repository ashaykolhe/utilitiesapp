'use strict';
Tools.register({ id: 'calculator', name: 'Calculator', icon: '🧮', cat: 'calculate', desc: 'A simple calculator with percent and backspace.', needs: [], render(el) {
  el.innerHTML = `<div class="card"><div class="muted" id="ex" style="min-height:22px;text-align:right"></div><div class="big" id="d" style="text-align:right;font-size:40px">0</div></div><div class="keys" id="k"></div>`;
  const keys = ['C', '⌫', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', '.', '=', ''];
  let expr = '';
  const kb = $('#k', el);
  keys.forEach(k => {
    if (!k) { kb.appendChild(h('<span></span>')); return; }
    const b = h(`<button class="${'÷×−+='.includes(k) ? 'op' : ''}">${k}</button>`);
    b.onclick = () => press(k); kb.appendChild(b);
  });
  function evaluate(s) {
    const t = s.replace(/÷/g, '/').replace(/×/g, '*').replace(/−/g, '-').replace(/(\d+\.?\d*)%/g, '($1/100)');
    if (!/^[\d+\-*/().\s]+$/.test(t)) return NaN;
    return Function('"use strict";return (' + t + ')')();
  }
  function press(k) {
    if (k === 'C') expr = '';
    else if (k === '⌫') expr = expr.slice(0, -1);
    else if (k === '=') {
      try { const r = evaluate(expr); if (!isFinite(r)) throw 0; $('#ex', el).textContent = expr + ' ='; expr = String(+r.toPrecision(12)); }
      catch (e) { toast('Invalid expression'); }
    } else expr += k;
    $('#d', el).textContent = expr || '0';
  }
} });
