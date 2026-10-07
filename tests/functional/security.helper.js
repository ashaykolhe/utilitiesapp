'use strict';
/* Helpers for the security functional tests: a page with a real (in-memory) IndexedDB, fake native plugins, a controllable clock,
   fake File objects for the file inputs, and stand-ins for blob URLs, the clipboard and the Pro sheet. */
const { boot } = require('../helpers/page');
const { IDBFactory } = require('fake-indexeddb');

process.setMaxListeners(60);
const STRONG = 'Tg7#vQ2!mZp9xL4w';

async function bootSec(opts) {
  opts = opts || {};
  const native = { secure: [], copies: [], clearCalls: 0 };
  const idb = opts.idb || new IDBFactory();
  let w0;
  const page = await boot({
    beforeParse(w) {
      w0 = w;
      w.indexedDB = idb;
      if (opts.pro) w.localStorage.setItem('pkx.p', JSON.stringify({ v: 1, t: Date.now() }));
      if (opts.ls) for (const k of Object.keys(opts.ls)) w.localStorage.setItem(k, opts.ls[k]);
      // controllable clock: performance.now() + skew
      const real = w.performance.now.bind(w.performance);
      w.__skew = 0; w.performance.now = () => real() + w.__skew;
      // blob URLs
      w.__blobs = new Map(); w.__revoked = []; let n = 0;
      w.URL.createObjectURL = b => { const u = 'blob:fake/' + (++n); w.__blobs.set(u, b); return u; };
      w.URL.revokeObjectURL = u => { w.__revoked.push(u); };
      // clipboard
      w.__clip = ''; w.__clipFail = false;
      Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { writeText: async t => { w.__clip = String(t); }, readText: async () => w.__clip } });
      // a real dialog fires 'close' (asynchronously) when it is closed; the shared harness stub does not
      w.HTMLDialogElement.prototype.close = function () { if (!this.open) return; this.open = false; setTimeout(() => this.dispatchEvent(new w.Event('close')), 0); };
      // jsdom's selector engine answers '#id' with the first element of that id in the whole document, even when searching inside another
      // element; two tools open at once repeat ids, so make '#id' lookups scoped like a real browser does
      const qs = w.Element.prototype.querySelector;
      w.Element.prototype.querySelector = function (sel) { return typeof sel === 'string' && /^#[\w-]+$/.test(sel) ? qs.call(this, '[id="' + sel.slice(1) + '"]') : qs.call(this, sel); };
      w.Capacitor = { Plugins: {} };
      if (opts.native !== false) {
        w.Capacitor.Plugins.PocketNative = {
          isDebuggable: async () => ({ debuggable: false }),
          setSecure: async o => { native.secure.push(!!o.enabled); return {}; },
          copySensitive: async o => { native.copies.push(o); w.__clip = o.text; return { native: true }; }
        };
      }
      if (opts.capacitor) opts.capacitor(w.Capacitor.Plugins, w);
    }
  });
  const w = page.w;
  process.on('unhandledRejection', e => { page.errors.push('unhandled rejection: ' + (e && e.stack || e)); });
  w.__pro = 0;
  const origOpenPro = w.eval('openPro');
  w.openPro = function (k) { w.__pro++; w.__proKey = k; };
  w.eval('openPro = window.openPro');
  page.native = native; page.idb = idb;
  page.skew = ms => { w.__skew += ms; };
  page.pro = () => w.__pro;
  const o = page.open; page.open = async id => { const t = await o(id); t.all('style').forEach(x => x.remove()); return t; };
  page.until = async (fn, ms) => { const end = Date.now() + (ms || 4000); while (Date.now() < end) { try { if (fn()) return true; } catch (e) { /* not yet */ } await page.wait(25); } return false; };
  return page;
}

/* A fake File: real jsdom File, plus helpers. bytes = Uint8Array | string. */
function mkFile(w, name, bytes, type) {
  const u = typeof bytes === 'string' ? Buffer.from(bytes) : Buffer.from(bytes);
  return new w.File([u], name, { type: type || '' });
}
/* Give a file input a FileList-like value and fire change. */
function setFiles(t, w, sel, files) {
  const e = t.q(sel);
  Object.defineProperty(e, 'files', { configurable: true, value: files });
  e.dispatchEvent(new w.Event('change', { bubbles: true }));
}
async function readBlob(b) { return Buffer.from(await b.arrayBuffer()); }

/* Create the sealed tool's master password through the UI and wait until unlocked. */
async function setup(t, page, pw, opt) {
  opt = opt || {};
  await page.until(() => t.has('#s1'), 5000);
  t.type('#s1', pw); t.type('#s2', opt.confirm === undefined ? pw : opt.confirm);
  t.check('#s-ok', true);
  if (t.has('#s-ok2')) t.check('#s-ok2', true);
  t.click('#s-go');
  await page.wait(opt.wait || 1500);
}
async function unlock(t, page, pw, wait) { await page.until(() => t.has('#u1'), 5000); t.type('#u1', pw); t.click('#u-go'); await page.wait(wait || 1500); }

/* The pure crypto/maths block of www/js/tools/security.js (between its PURE markers) evaluated in Node, for checks that need exact inputs. */
function loadPure() {
  const fs = require('fs'), vm = require('vm'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'www', 'js', 'tools', 'security.js'), 'utf8');
  const pure = src.slice(src.indexOf('/*PURE-START*/'), src.indexOf('/*PURE-END*/'));
  const ctx = { TextEncoder, TextDecoder, btoa, atob, URLSearchParams, globalThis: { crypto: require('crypto').webcrypto } };
  vm.createContext(ctx);
  vm.runInContext(pure + ';this.X={assess,isEasyPin,genPin,genPassword,genPassphrase,WORDS,COMMON,pinBits,b32decode,hotp,totp,parseOtpauth,safeName,extractHash,humanTime,encryptText,decryptText,randInt,b64d,b64e,sealedCreate,sealedOpen,sealBytes,openBytes,deriveKey,KDF_ITER,MIN_ITER,MAX_ITER,clampInt}', ctx);
  return ctx.X;
}
const run = main => main().catch(e => { console.log('FAIL: exception: ' + (e && e.stack || e)); process.exit(1); });
module.exports = { loadPure, run, bootSec, mkFile, setFiles, readBlob, setup, unlock, STRONG };
