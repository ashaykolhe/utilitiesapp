'use strict';
/* Calculator. The expression is parsed by a small hand-written parser (no eval), so leading zeros, repeated operators,
   percent and results such as 1e+21 are all handled predictably. The pure functions are exported for the Node tests. */
(function () {

/* ---------- pure logic ---------- */
const NUM_RE = /(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/y;

/* Turns '50+10%' into tokens. Repeated operators collapse to the last one (so '2××3' is 2*3, never a power),
   a leading minus is a sign, a trailing operator is ignored. Returns null for anything it cannot read. */
function tokenize(s) {
  const t = String(s).replace(/÷/g, '/').replace(/×/g, '*').replace(/−/g, '-').replace(/\s+/g, '');
  const out = []; let neg = false, i = 0;
  while (i < t.length) {
    const c = t[i];
    if ('+-*/'.includes(c)) {
      const prev = out[out.length - 1];
      if (!prev) { if (c === '-') neg = true; else if (c !== '+') return null; }
      else if (prev.k === 'op') prev.v = c;
      else out.push({ k: 'op', v: c });
      i++;
    } else if (c === '%') {
      const prev = out[out.length - 1];
      if (!prev || prev.k !== 'num') return null;
      prev.pct++; i++;
    } else {
      NUM_RE.lastIndex = i;
      const m = NUM_RE.exec(t);
      if (!m) return null;
      if (out.length && out[out.length - 1].k === 'num') return null;
      out.push({ k: 'num', v: Number(m[0]) * (neg && !out.length ? -1 : 1), pct: 0 });
      i += m[0].length;
    }
  }
  while (out.length && out[out.length - 1].k === 'op') out.pop();
  return out.length ? out : null;
}

/* Percent after + or - is a share of the value on the left (50+10% = 55); anywhere else it is just /100. */
function evaluate(s) {
  const tk = tokenize(s);
  if (!tk) return NaN;
  let pos = 0;
  const pctVal = (n) => { let v = n.v; for (let k = 0; k < n.pct; k++) v /= 100; return v; };
  function term() {
    const first = tk[pos++];
    let v = pctVal(first), usedOp = false;
    while (pos < tk.length && (tk[pos].v === '*' || tk[pos].v === '/')) {
      const op = tk[pos++].v, r = tk[pos++]; usedOp = true;
      if (!r || r.k !== 'num') return { v: NaN };
      v = op === '*' ? v * pctVal(r) : v / pctVal(r);
    }
    return { v, pctOnly: !usedOp && first.pct > 0, first };
  }
  if (tk[0].k !== 'num') return NaN;
  let acc = term().v;
  while (pos < tk.length) {
    const op = tk[pos++];
    if (op.k !== 'op' || pos >= tk.length) return NaN;
    const t = term();
    let r = t.v;
    if (t.pctOnly) { r = acc * pctVal(t.first); }
    acc = op.v === '+' ? acc + r : acc - r;
  }
  return acc;
}

/* Formats a result so it can be used as the start of the next expression. */
const fmtResult = (r) => String(+r.toPrecision(12));

/* Applies one key press to the expression. Returns the new state { expr, fresh } (fresh = a result is shown). */
function pressKey(state, k) {
  let expr = state.expr, fresh = state.fresh;
  const isOp = (c) => '+−×÷'.includes(c);
  const last = expr.slice(-1);
  if (k === 'C') return { expr: '', fresh: false };
  if (k === '⌫') return { expr: fresh ? '' : expr.slice(0, -1), fresh: false };
  if (/^\d$/.test(k) || k === '.') {
    if (fresh) { expr = ''; fresh = false; }
    const seg = expr.match(/[\d.]*$/)[0];
    if (/%$/.test(expr) || expr.length >= 60) return { expr, fresh };
    if (k === '.') {
      if (seg.includes('.')) return { expr, fresh };
      return { expr: expr + (seg ? '.' : '0.'), fresh: false };
    }
    if (seg === '0') return { expr: expr.slice(0, -1) + k, fresh: false };
    return { expr: expr + k, fresh: false };
  }
  if (k === '%') {
    if (!expr || isOp(last) || last === '.' || expr.length >= 60) return { expr, fresh };
    return { expr: expr + '%', fresh: false };
  }
  if (isOp(k)) {
    if (!expr) return { expr: k === '−' ? '−' : '', fresh: false };
    if (expr === '−') return { expr, fresh };
    if (isOp(last)) return { expr: expr.slice(0, -1) + k, fresh: false };
    if (expr.length >= 60) return { expr, fresh };
    if (last === '.') expr = expr.slice(0, -1);
    return { expr: expr + k, fresh: false };
  }
  return { expr, fresh };
}
if (typeof module !== 'undefined' && module.exports) module.exports = { tokenize, evaluate, fmtResult, pressKey };

/* ---------- UI ---------- */
if (typeof Tools === 'undefined') return;
Tools.register({ id: 'calculator', name: 'Calculator', icon: '🧮', cat: 'calculate', desc: 'A simple calculator with percent and backspace.', needs: [], render(el) {
  el.innerHTML = `<div class="card"><div class="muted" id="ex" style="min-height:22px;text-align:right"></div><div class="big" id="d" style="text-align:right;font-size:40px" role="status" aria-live="polite">0</div></div><div class="keys" id="k"></div>`;
  const keys = ['C', '⌫', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', '.', '=', ''];
  let st = { expr: '', fresh: false };
  const kb = $('#k', el);
  keys.forEach(k => {
    if (!k) { kb.appendChild(h('<span></span>')); return; }
    const b = h(`<button class="${'÷×−+='.includes(k) ? 'op' : ''}">${k}</button>`);
    if (k === '⌫') b.setAttribute('aria-label', 'Backspace');
    if (k === 'C') b.setAttribute('aria-label', 'Clear');
    b.onclick = () => press(k); kb.appendChild(b);
  });
  function press(k) {
    if (k === '=') {
      try {
        const r = evaluate(st.expr);
        if (!isFinite(r)) throw 0;
        $('#ex', el).textContent = st.expr + ' =';
        try { if (typeof Hist !== 'undefined') Hist.add('calculator', st.expr, fmtResult(r)); } catch (e2) { /* history is optional */ }
        st = { expr: fmtResult(r), fresh: true };
      } catch (e) { toast('Invalid expression'); }
    } else st = pressKey(st, k);
    $('#d', el).textContent = st.expr || '0';
  }
} });
})();
