'use strict';
/* Smoke test: loads www/index.html with every script in jsdom, then checks the tool registry and renders every tool.
   Run with:  npm test
   It cannot test sensors, camera, audio output or layout; those stay in docs/MANUAL-TEST.md. */
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..', 'www');
const CATS = ['daily', 'navigate', 'measure', 'calculate', 'text', 'audio', 'camera', 'health', 'security', 'connect', 'create', 'fun'];
const NEEDS = ['camera', 'microphone', 'location', 'motion', 'notifications', 'storage', 'network'];
const failures = [];
const fail = m => failures.push(m);
/* A tool that asks for a camera, microphone or storage in jsdom gets a rejected promise; that is expected (the tool must show a message, not crash the page). */
process.on('unhandledRejection', e => { if (process.env.VERBOSE) console.log('ignored rejection:', e && (e.name || e.message || e)); });

const vc = new VirtualConsole();
vc.on('jsdomError', e => { if (!/Not implemented/.test(e.message)) fail('page error: ' + e.message.split('\n')[0]); });

(async () => {
  const dom = await JSDOM.fromFile(path.join(ROOT, 'index.html'), {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.matchMedia = w.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
      w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: (t, k) => k === 'canvas' ? {} : (k === 'measureText' ? () => ({ width: 10 }) : () => ({ data: [], width: 1, height: 1, addColorStop() {} })), set: () => true });
      w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
      w.HTMLDialogElement.prototype.close = function () { this.open = false; };
      w.crypto.subtle = w.crypto.subtle || require('crypto').webcrypto.subtle;
      w.TextEncoder = w.TextEncoder || TextEncoder; w.TextDecoder = w.TextDecoder || TextDecoder;
      w.scrollTo = () => {};
      w.AudioContext = w.webkitAudioContext = undefined;
    }
  });
  const w = dom.window;
  await new Promise(r => w.addEventListener('load', r));
  await new Promise(r => setTimeout(r, 300));

  const L = w.eval('Tools.list');
  if (!L || L.length < 200) fail('expected at least 200 tools, found ' + (L && L.length));
  const seen = { id: new Set(), name: new Set(), icon: new Set() };
  for (const t of L) {
    for (const k of ['id', 'name', 'icon']) { if (seen[k].has(t[k])) fail(`duplicate ${k}: ${t[k]}`); seen[k].add(t[k]); }
    if (!CATS.includes(t.cat)) fail(`${t.id}: unknown category ${t.cat}`);
    if (!t.desc) fail(`${t.id}: missing desc`);
    if (!Array.isArray(t.needs) || t.needs.some(n => !NEEDS.includes(n))) fail(`${t.id}: bad needs`);
    if (typeof t.render !== 'function') fail(`${t.id}: no render()`);
    if (t.name.length > 18) fail(`${t.id}: name too long (${t.name.length})`);
  }

  /* docs stay in step with the code */
  const docs = fs.readdirSync(path.join(__dirname, '..', 'docs', 'parts')).flatMap(f =>
    [...fs.readFileSync(path.join(__dirname, '..', 'docs', 'parts', f), 'utf8').matchAll(/^- id: (\S+)/gm)].map(m => m[1]));
  for (const t of L) if (!docs.includes(t.id)) fail(`${t.id}: not documented in docs/parts (run npm run features after adding it)`);
  for (const d of docs) if (!L.some(t => t.id === d)) fail(`docs/parts mentions ${d} but no tool has that id`);

  /* render and clean up every tool (sensor tools included: they must fail gracefully, not throw) */
  let rendered = 0;
  for (const t of L) {
    const host = w.document.createElement('div'); w.document.body.appendChild(host);
    try {
      if (process.env.VERBOSE) console.log('render', t.id);
      const cleanup = t.render(host);
      if (!host.innerHTML.trim()) fail(`${t.id}: rendered nothing`);
      await new Promise(r => setTimeout(r, 5));
      if (typeof cleanup === 'function') cleanup();
      rendered++;
    } catch (e) { fail(`${t.id}: render threw: ${e.message}`); }
    host.remove();
  }

  /* Pro: locked tools show the sheet, limits are enforced */
  if (w.eval('isPro()')) fail('a fresh install must not be Pro');
  if (w.eval('proLimit("notes")') !== 10) fail('free note limit should be 10');
  const hash = require('crypto').createHash('sha256').update('PocketKit/coupon/v1PKT-NOT-A-REAL-CODE').digest('hex');
  if (w.eval('COUPONS').some(c => c.hash === hash)) fail('a made-up code matched a coupon hash');
  if (w.eval('JSON.stringify(COUPONS)').match(/PKT-[A-Z2-9]{4}-/)) fail('plaintext coupon code found in coupons.js');

  console.log(`tools: ${L.length}, rendered: ${rendered}`);
  if (failures.length) { console.error('\nFAILED (' + failures.length + '):\n - ' + failures.join('\n - ')); process.exit(1); }
  console.log('smoke test passed');
  process.exit(0);
})();
