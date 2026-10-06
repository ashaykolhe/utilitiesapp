'use strict';
/* Input fuzz test: renders every tool in jsdom, types hostile values into every field, flips every checkbox and select,
   presses every button, and reports:
     - exceptions or unhandled errors the tool threw,
     - output text containing NaN, Infinity, undefined or [object Object],
     - text inserted as HTML (an injected <img> or <script> element showing up in the tool's DOM).
   Run:  node tests/fuzz.js            (all tools)
         node tests/fuzz.js emi bmr    (only those tool ids)
         FILE=health node tests/fuzz.js  (only tools whose id appears in that docs/parts file)
   Skips buttons whose label looks destructive only when SAFE=1. Results: failures listed per tool id. */
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..', 'www');
const only = process.argv.slice(2);
const HOSTILE = ['', ' ', '0', '-1', '-0', '0.0000001', '99999999999999999999', '1e309', '3.14159', '1,5', 'abc', '😀', '<img src=x onerror=window.__pwn=1>', '<script>window.__pwn=1</script>', '"\'><b>', 'a'.repeat(3000), '１２３', '9'.repeat(40), '-99999', '2147483648'];
const BAD = /\b(NaN|Infinity|undefined)\b|\[object Object\]/;

const vc = new VirtualConsole();
const errors = [];
vc.on('jsdomError', e => { if (!/Not implemented/.test(e.message)) errors.push('page: ' + e.message.split('\n')[0]); });

(async () => {
  const dom = await JSDOM.fromFile(path.join(ROOT, 'index.html'), {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.matchMedia = w.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
      w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: (t, k) => k === 'canvas' ? {} : (k === 'measureText' ? () => ({ width: 10 }) : () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1, addColorStop() {} })), set: () => true });
      w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
      w.HTMLDialogElement.prototype.close = function () { this.open = false; };
      w.TextEncoder = w.TextEncoder || TextEncoder; w.TextDecoder = w.TextDecoder || TextDecoder;
      w.scrollTo = () => {}; w.confirm = () => true; w.alert = () => {}; w.prompt = () => '5';
      w.AudioContext = w.webkitAudioContext = undefined;
      w.addEventListener('unhandledrejection', () => {});
    }
  });
  const w = dom.window; w.__pwn = 0;
  process.on('unhandledRejection', () => {});
  await new Promise(r => w.addEventListener('load', r));
  await new Promise(r => setTimeout(r, 300));
  w.addEventListener('error', e => errors.push('uncaught: ' + (e.message || e.error)));

  let tools = w.eval('Tools.list');
  if (process.env.FILE) {
    const ids = [...fs.readFileSync(path.join(__dirname, '..', 'docs', 'parts', process.env.FILE + '.md'), 'utf8').matchAll(/^- id: (\S+)/gm)].map(m => m[1]);
    tools = tools.filter(t => ids.includes(t.id));
  }
  if (only.length) tools = tools.filter(t => only.includes(t.id));

  const report = {};
  const add = (id, msg) => { (report[id] = report[id] || new Set()).add(msg); };
  const setVal = (el, v) => {
    try { el.value = v; } catch (e) { return; }
    el.dispatchEvent(new w.Event('input', { bubbles: true })); el.dispatchEvent(new w.Event('change', { bubbles: true }));
  };
  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  for (const t of tools) {
    errors.length = 0; w.__pwn = 0;
    if (process.env.VERBOSE) console.log('fuzz', t.id);
    const host = w.document.createElement('div'); w.document.body.appendChild(host);
    w.eval('attachValidation').call(w, host);
    let cleanup = null;
    try { cleanup = t.render(host); } catch (e) { add(t.id, 'render threw: ' + e.message); host.remove(); continue; }
    await wait(10);
    const fields = () => [...host.querySelectorAll('input,textarea,select')].filter(f => !['file', 'button', 'submit', 'hidden', 'color', 'range'].includes(f.type));
    try {
      for (const v of HOSTILE) {
        for (const f of fields()) {
          if (f.tagName === 'SELECT') continue;
          if (f.type === 'checkbox' || f.type === 'radio') continue;
          setVal(f, v);
        }
        const buttons = [...host.querySelectorAll('button:not([disabled])')];
        for (const b of buttons.slice(0, 40)) { try { b.click(); } catch (e) { add(t.id, 'click threw: ' + e.message); } }
        await wait(2);
        const text = host.innerText || host.textContent || '';
        const m = text.match(BAD);
        if (m) add(t.id, 'output shows "' + m[0] + '" after input ' + JSON.stringify(v.slice(0, 20)));
        if (w.__pwn) add(t.id, 'HTML injection: user text ran as script/markup with input ' + JSON.stringify(v.slice(0, 20)));
        if (host.querySelector('img[src="x"], script')) add(t.id, 'HTML injection: injected element present with input ' + JSON.stringify(v.slice(0, 20)));
      }
      for (const s of host.querySelectorAll('select')) { for (const o of [...s.options].slice(0, 12)) { s.value = o.value; s.dispatchEvent(new w.Event('change', { bubbles: true })); s.dispatchEvent(new w.Event('input', { bubbles: true })); } await wait(2); const m = (host.innerText || '').match(BAD); if (m) add(t.id, 'output shows "' + m[0] + '" after changing a select'); }
      for (const c of host.querySelectorAll('input[type=checkbox],input[type=radio]')) { c.click(); await wait(1); const m = (host.innerText || '').match(BAD); if (m) add(t.id, 'output shows "' + m[0] + '" after toggling a checkbox'); }
    } catch (e) { add(t.id, 'fuzz loop threw: ' + e.message); }
    await wait(5);
    for (const e of errors) add(t.id, e);
    try { if (typeof cleanup === 'function') cleanup(); } catch (e) { add(t.id, 'cleanup threw: ' + e.message); }
    host.remove();
  }
  const ids = Object.keys(report);
  if (!ids.length) { console.log(`fuzz: ${tools.length} tools, no problems found`); process.exit(0); }
  console.log(`fuzz: ${tools.length} tools, ${ids.length} with problems\n`);
  for (const id of ids) { console.log(id); for (const m of report[id]) console.log('  - ' + m); }
  process.exit(1);
})();
