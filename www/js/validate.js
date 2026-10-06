'use strict';
/* Input validation for every tool, driven by the attributes on the fields (min, max, step, maxlength, pattern, required).
   attachValidation(root) is called by app.js for each tool's fresh container, so a tool only has to put sensible attributes on its inputs.
   - number fields: block e / + (and - when min >= 0), cap the typed length, show a short message when the value is not a number,
     out of range or not a whole number, and pull an out-of-range value back to the limit when the field is left;
   - text fields: pattern / required messages;
   - dates and times: min / max.
   Messages are announced to screen readers (role=alert) and the field is marked aria-invalid. */
const Valid = {
  /* The number in a field as a finite number, or null when empty or not a number (also accepts a decimal comma). */
  num(v) { if (v == null) return null; const s = String(v).trim().replace(',', '.'); if (s === '') return null; const n = +s; return Number.isFinite(n) ? n : null; },
  /* Clamp to [min, max]; NaN or null gives the fallback. */
  clamp(v, min, max, fallback) { const n = Valid.num(v); if (n === null) return fallback === undefined ? null : fallback; return Math.min(max, Math.max(min, n)); },
  /* Set or clear the message under a field. */
  mark(input, msg) {
    let e = input.nextElementSibling && input.nextElementSibling.classList && input.nextElementSibling.classList.contains('verr') ? input.nextElementSibling : null;
    if (!msg) { if (e) e.remove(); input.classList.remove('invalid'); input.removeAttribute('aria-invalid'); return; }
    if (!e) { e = document.createElement('div'); e.className = 'verr'; e.setAttribute('role', 'alert'); input.insertAdjacentElement('afterend', e); }
    e.textContent = msg; input.classList.add('invalid'); input.setAttribute('aria-invalid', 'true');
  },
  /* The message for the field's current value, or '' when it is fine. */
  check(el) {
    const type = el.type, v = el.value;
    if (type === 'number') {
      if (v === '') return el.required ? 'Enter a number' : '';
      if (el.validity && el.validity.badInput) return 'Enter a number';
      const n = +v; if (!Number.isFinite(n)) return 'Enter a number';
      const min = el.min !== '' ? +el.min : null, max = el.max !== '' ? +el.max : null, step = el.step;
      if (min !== null && n < min) return 'Minimum is ' + min;
      if (max !== null && n > max) return 'Maximum is ' + max;
      if (step === '1' && !Number.isInteger(n)) return 'Whole numbers only';
      return '';
    }
    if (type === 'date' || type === 'time' || type === 'datetime-local' || type === 'month') {
      if (v === '') return el.required ? 'Pick a value' : '';
      if (el.min && v < el.min) return 'Earliest is ' + el.min.replace('T', ' ');
      if (el.max && v > el.max) return 'Latest is ' + el.max.replace('T', ' ');
      return '';
    }
    if (type === 'text' || type === 'search' || type === 'url' || type === 'email' || type === 'tel' || el.tagName === 'TEXTAREA') {
      if (v.trim() === '' && el.required) return 'This is required';
      if (v !== '' && el.pattern && !new RegExp('^(?:' + el.pattern + ')$').test(v)) return el.title || 'Check this value';
      return '';
    }
    return '';
  }
};

function attachValidation(root) {
  const fieldOf = (e) => { const el = e.target; return el && el.tagName && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') ? el : null; };
  root.addEventListener('keydown', e => {
    const el = fieldOf(e); if (!el || el.type !== 'number' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'e' || e.key === 'E' || e.key === '+') e.preventDefault();
    if (e.key === '-' && el.min !== '' && +el.min >= 0) e.preventDefault();
  });
  root.addEventListener('input', e => {
    const el = fieldOf(e); if (!el) return;
    if (el.type === 'number' && el.value.length > 17) { el.value = el.value.slice(0, 17); }
    Valid.mark(el, Valid.check(el));
  }, true);
  /* Leaving a number field: an out-of-range value is pulled back to the limit so the tool never computes with it. */
  root.addEventListener('change', e => {
    const el = fieldOf(e); if (!el || el.type !== 'number' || el.value === '' || !Number.isFinite(+el.value)) return;
    const n = +el.value; let fix = n;
    if (el.min !== '' && n < +el.min) fix = +el.min; if (el.max !== '' && n > +el.max) fix = +el.max;
    if (el.step === '1' && !Number.isInteger(fix)) fix = Math.round(fix);
    if (fix !== n) { el.value = String(fix); el.dispatchEvent(new Event('input', { bubbles: true })); Valid.mark(el, 'Adjusted to ' + fix); setTimeout(() => Valid.mark(el, ''), 2500); }
  }, true);
}
