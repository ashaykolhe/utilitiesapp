'use strict';
/* Shared harness for functional tests: loads the real www/index.html with all its scripts in jsdom (with stand-ins for Web Audio,
   canvas, element.animate and localStorage) and lets a test drive a tool like a person: type into fields, press buttons, read the screen.

     const { boot } = require('../helpers/page');
     const page = await boot();
     const t = await page.open('emi');            // renders the tool into a fresh container
     t.type('#amt', '500000');                     // sets the value and fires input + change
     t.click('#go');                               // clicks a button (by selector) or t.clickText('Add')
     t.text();                                     // visible text of the tool
     t.value('#out'); t.has('#id'); t.all('button')
     await page.wait(50);
     page.close();                                 // finishes (clears timers)
   Exposes page.w (the jsdom window), page.eval(code) to run code in the page, page.errors (uncaught page errors). */
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const ROOT = path.join(__dirname, '..', '..', 'www');

async function boot(opts) {
  opts = opts || {};
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/Not implemented/.test(e.message)) errors.push(e.message.split('\n')[0]); });
  const dom = await JSDOM.fromFile(path.join(ROOT, 'index.html'), {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.matchMedia = w.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
      const node = () => new Proxy(function () {}, { get: (t, k) => typeof k === 'symbol' ? (k === Symbol.toPrimitive ? () => 0 : undefined) : (k === 'connect' ? (x) => x : (k === 'value' ? 0 : node())), set: () => true, apply: () => node(), construct: () => node() });
      w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: (t, k) => k === 'canvas' ? {} : (k === 'measureText' ? () => ({ width: 10 }) : () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1, addColorStop() {} })), set: () => true });
      w.HTMLCanvasElement.prototype.toBlob = function (cb) { cb(new w.Blob(['png'], { type: 'image/png' })); };
      w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
      w.HTMLDialogElement.prototype.close = function () { this.open = false; };
      w.TextEncoder = w.TextEncoder || TextEncoder; w.TextDecoder = w.TextDecoder || TextDecoder;
      try { Object.defineProperty(w, 'crypto', { value: require('crypto').webcrypto, configurable: true }); } catch (e) { /* keep jsdom's */ }
      const mem = new Map();
      Object.defineProperty(w, 'localStorage', { value: { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); }, removeItem: k => { mem.delete(k); }, clear: () => mem.clear(), key: i => [...mem.keys()][i] || null, get length() { return mem.size; } } });
      let fakeY = 0; Object.defineProperty(w, 'scrollY', { get: () => fakeY, configurable: true }); w.scrollTo = (x, y) => { fakeY = y; };
      w.confirm = () => true; w.alert = () => {}; w.prompt = () => '5';
      w.AudioContext = w.webkitAudioContext = class { constructor() { return new Proxy({}, { get: (t, k) => k === 'state' ? 'running' : (k === 'currentTime' ? 0 : (k === 'sampleRate' ? 44100 : (k === 'close' || k === 'resume' ? () => Promise.resolve() : node()))), set: () => true }); } };
      w.Element.prototype.animate = function () { return { finished: Promise.resolve(), cancel() {}, onfinish: null, addEventListener() {} }; };
      w.navigator.vibrate = () => true;
      if (opts.beforeParse) opts.beforeParse(w);
    }
  });
  process.on('unhandledRejection', () => {});
  const w = dom.window;
  await new Promise(r => w.addEventListener('load', r));
  await new Promise(r => setTimeout(r, 250));
  w.addEventListener('error', e => errors.push('uncaught: ' + (e.message || e.error)));
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const fire = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true }));

  const open = async (id) => {
    const tool = w.eval('Tools.get(' + JSON.stringify(id) + ')'); if (!tool) throw new Error('no tool with id ' + id);
    const host = w.document.createElement('div'); w.document.body.appendChild(host);
    w.eval('attachValidation').call(w, host);
    const cleanup = tool.render(host); await wait(15);
    const q = (sel) => { const e = host.querySelector(sel); if (!e) throw new Error('no element ' + sel + ' in tool ' + id); return e; };
    const api = {
      el: host, tool,
      q, has: (sel) => !!host.querySelector(sel), all: (sel) => [...host.querySelectorAll(sel)],
      text: () => (host.innerText || host.textContent || '').replace(/\s+/g, ' ').trim(),
      value: (sel) => q(sel).value,
      type(sel, v) { const e = q(sel); e.value = String(v); fire(e, 'input'); fire(e, 'change'); return api; },
      select(sel, v) { const e = q(sel); e.value = String(v); fire(e, 'change'); fire(e, 'input'); return api; },
      check(sel, on) { const e = q(sel); if (e.checked !== !!on) e.click(); return api; },
      click(sel) { q(sel).click(); return api; },
      clickText(label) { const b = [...host.querySelectorAll('button,[role=button],.item,.chip')].find(x => (x.textContent || '').trim() === label || (x.getAttribute('aria-label') || '') === label); if (!b) throw new Error('no button "' + label + '" in tool ' + id); b.click(); return api; },
      wait,
      close() { try { if (typeof cleanup === 'function') cleanup(); } catch (e) { errors.push('cleanup threw: ' + e.message); } host.remove(); }
    };
    return api;
  };
  return { w, open, wait, errors, eval: (c) => w.eval(c), close() { try { w.close(); } catch (e) { /* ignore */ } } };
}

/* A tiny assertion runner with readable output: const T = suite('name'); T.ok(cond, 'what'); T.eq(a, b, 'what'); await T.done(); */
function suite(name) {
  let passed = 0, failed = 0;
  const fail = (m, extra) => { failed++; console.log('FAIL: [' + name + '] ' + m + (extra ? ' -> ' + extra : '')); };
  return {
    ok(c, m) { if (c) passed++; else fail(m); },
    eq(a, b, m) { if (a === b) passed++; else fail(m, 'got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(b)); },
    near(a, b, tol, m) { if (Math.abs(a - b) <= tol) passed++; else fail(m, 'got ' + a + ', expected ' + b + ' +/- ' + tol); },
    has(text, part, m) { if (String(text).includes(part)) passed++; else fail(m, 'text did not contain ' + JSON.stringify(part) + ' (text: ' + String(text).slice(0, 160) + ')'); },
    async done(page) {
      if (page && page.errors.length) { failed++; console.log('FAIL: [' + name + '] page errors: ' + page.errors.slice(0, 3).join(' | ')); }
      console.log((failed ? 'FAILED' : 'passed') + ' [' + name + ']: ' + passed + ' checks ok' + (failed ? ', ' + failed + ' failed' : ''));
      if (page) page.close();
      process.exit(failed ? 1 : 0);
    }
  };
}
module.exports = { boot, suite };
