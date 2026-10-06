'use strict';
/* Lists every input a tool shows that has no limits: a number field without min and max, a text field or textarea without maxlength,
   a date field without min/max where one makes sense, and any input with no label or aria-label.
   Run:  node tests/validation-audit.js            (summary per tool)
         node tests/validation-audit.js --count    (only totals)
   Exit code 1 when anything is found, so it can run in CI once the list is clean. */
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const ROOT = path.join(__dirname, '..', 'www');
const countOnly = process.argv.includes('--count');

(async () => {
  const dom = await JSDOM.fromFile(path.join(ROOT, 'index.html'), {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
    beforeParse(w) {
      w.matchMedia = w.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
      w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: (t, k) => k === 'canvas' ? {} : () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1, addColorStop() {} }), set: () => true });
      w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
      w.TextEncoder = w.TextEncoder || TextEncoder; w.scrollTo = () => {}; w.confirm = () => true;
      const node = () => new Proxy(function () {}, { get: (t, k) => k === 'connect' ? (x) => x : node(), set: () => true, apply: () => node(), construct: () => node() });
      w.AudioContext = w.webkitAudioContext = class { constructor() { return new Proxy({}, { get: (t, k) => k === 'state' ? 'running' : (k === 'close' || k === 'resume' ? () => Promise.resolve() : node()), set: () => true }); } };
      w.Element.prototype.animate = function () { return { finished: Promise.resolve(), cancel() {} }; };
    }
  });
  process.on('unhandledRejection', () => {});
  const w = dom.window;
  await new Promise(r => w.addEventListener('load', r)); await new Promise(r => setTimeout(r, 300));
  const report = {}, totals = { number: 0, text: 0, date: 0, label: 0 };
  const add = (id, kind, msg) => { totals[kind]++; (report[id] = report[id] || []).push(msg); };
  for (const t of w.eval('Tools.list')) {
    const host = w.document.createElement('div'); w.document.body.appendChild(host);
    let cleanup; try { cleanup = t.render(host); } catch (e) { host.remove(); continue; }
    await new Promise(r => setTimeout(r, 5));
    for (const f of host.querySelectorAll('input,textarea,select')) {
      const type = f.type, name = f.id || f.getAttribute('aria-label') || f.placeholder || f.tagName.toLowerCase();
      if (['hidden', 'file', 'button', 'submit', 'checkbox', 'radio', 'range', 'color'].includes(type) || f.tagName === 'SELECT') {
        if (f.tagName !== 'SELECT' && !['hidden'].includes(type) && !(f.getAttribute('aria-label') || f.closest('label') || (f.id && host.querySelector('label[for="' + f.id + '"]')) || f.title)) add(t.id, 'label', `${name}: no label`);
        continue;
      }
      if (type === 'number') { if (f.min === '' || f.max === '') add(t.id, 'number', `#${name}: number field without ${f.min === '' && f.max === '' ? 'min and max' : f.min === '' ? 'min' : 'max'}`); }
      else if (type === 'date' || type === 'datetime-local') { if (!f.min && !f.max) add(t.id, 'date', `#${name}: date field without min or max`); }
      else if (!f.maxLength || f.maxLength < 0) add(t.id, 'text', `#${name}: ${f.tagName === 'TEXTAREA' ? 'textarea' : 'text field'} without maxlength`);
      if (!(f.getAttribute('aria-label') || f.closest('label') || (f.id && host.querySelector('label[for="' + f.id + '"]')) || f.title)) add(t.id, 'label', `#${name}: no label`);
    }
    try { if (typeof cleanup === 'function') cleanup(); } catch (e) {}
    host.remove();
  }
  console.log(`fields without limits: number ${totals.number}, text ${totals.text}, date ${totals.date}; unlabeled ${totals.label}; tools affected ${Object.keys(report).length}`);
  if (!countOnly) for (const [id, list] of Object.entries(report)) { console.log(id); for (const m of list) console.log('  - ' + m); }
  process.exit(Object.keys(report).length ? 1 : 0);
})();
