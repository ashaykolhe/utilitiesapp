'use strict';
/* Shared helpers for the fun.test.js / games2.test.js functional tests (not itself a test: the runner only runs *.test.js).
   - bootGame(): boots the app with a virtual clock (setTimeout / setInterval / requestAnimationFrame / Date.now / performance.now),
     stand-ins for pointer capture, canvas geometry and elementFromPoint, a visibility switch and a seedable random source.
   - The clock only takes over after clock.arm(), so the app's own start-up runs on real timers. */
const { boot } = require('../helpers/page');

function mulberry(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function makeClock() {
  const c = { armed: false, now: 0, tid: 1000, rid: 1000, timers: new Map(), rafs: new Map(), nextFrame: 16 };
  c.install = function (w) {
    const real = { st: w.setTimeout.bind(w), si: w.setInterval.bind(w), ct: w.clearTimeout.bind(w), ci: w.clearInterval.bind(w), raf: w.requestAnimationFrame.bind(w), caf: w.cancelAnimationFrame.bind(w) };
    const realDate = w.Date.now.bind(w.Date), realPerf = w.performance.now.bind(w.performance);
    let base = 0, perfBase = 0;
    c.base = () => base;
    w.setTimeout = (fn, ms, ...a) => { if (!c.armed) return real.st(fn, ms, ...a); const id = ++c.tid; c.timers.set(id, { fn: () => fn(...a), due: c.now + Math.max(0, +ms || 0), iv: 0 }); return id; };
    w.setInterval = (fn, ms, ...a) => { if (!c.armed) return real.si(fn, ms, ...a); const id = ++c.tid, p = Math.max(1, +ms || 1); c.timers.set(id, { fn: () => fn(...a), due: c.now + p, iv: p }); return id; };
    w.clearTimeout = w.clearInterval = (id) => { if (c.timers.has(id)) c.timers.delete(id); else real.ct(id); };
    w.requestAnimationFrame = (fn) => { if (!c.armed) return real.raf(fn); const id = ++c.rid; c.rafs.set(id, fn); return id; };
    w.cancelAnimationFrame = (id) => { if (c.rafs.has(id)) c.rafs.delete(id); else real.caf(id); };
    w.Date.now = () => c.armed ? base + c.now : realDate();
    try { Object.defineProperty(w.performance, 'now', { value: () => c.armed ? perfBase + c.now : realPerf(), configurable: true }); } catch (e) { /* keep real */ }
    c.arm = () => { c.armed = true; c.now = 0; base = realDate(); perfBase = realPerf(); c.nextFrame = 16; };
  };
  /* Advances virtual time by ms, running timers in order and one animation frame every 16 ms. */
  c.tick = function (ms) {
    const end = c.now + ms;
    for (;;) {
      let dueT = Infinity, dueId = 0;
      c.timers.forEach((t, id) => { if (t.due < dueT || (t.due === dueT && id < dueId)) { dueT = t.due; dueId = id; } });
      const frame = c.rafs.size ? c.nextFrame : Infinity;
      const nxt = Math.min(dueT, frame);
      if (nxt > end) break;
      c.now = Math.max(c.now, nxt);
      if (dueT <= frame) {
        const t = c.timers.get(dueId); if (t.iv) t.due += t.iv; else c.timers.delete(dueId);
        t.fn();
      } else {
        const list = [...c.rafs.entries()]; c.rafs.clear(); c.nextFrame += 16;
        list.forEach(([, fn]) => fn(c.now));
      }
      if (!c.rafs.size && c.nextFrame < c.now) c.nextFrame = c.now + 16;
    }
    c.now = end; if (c.nextFrame <= c.now && !c.rafs.size) c.nextFrame = c.now + 16;
  };
  c.pending = () => ({ to: [...c.timers.values()].filter(t => !t.iv).length, iv: [...c.timers.values()].filter(t => t.iv).length, raf: c.rafs.size });
  c.idle = () => { const p = c.pending(); return p.to + p.iv + p.raf; };
  c.reset = () => { c.timers.clear(); c.rafs.clear(); };
  return c;
}

async function bootGame(opts) {
  opts = opts || {};
  const clock = makeClock();
  const state = { hit: null, hidden: false, rng: mulberry(opts.seed || 1) };
  const page = await boot({
    beforeParse(w) {
      clock.install(w);
      w.Element.prototype.setPointerCapture = function () {}; w.Element.prototype.releasePointerCapture = function () {};
      const gb = w.Element.prototype.getBoundingClientRect;
      w.Element.prototype.getBoundingClientRect = function () {
        if (this.tagName === 'CANVAS') { const W = this._lw || this.width || 1, H = this._lh || this.height || 1; return { left: 0, top: 0, right: W, bottom: H, width: W, height: H, x: 0, y: 0 }; }
        return gb.call(this);
      };
      w.document.elementFromPoint = () => state.hit;
      Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { get() { return this._cw || 340; }, configurable: true });
      /* recording canvas: cv._log holds the drawing calls since the last clearRect (see G.calls) */
      w.HTMLCanvasElement.prototype.getContext = function () {
        if (this._ctx) return this._ctx;
        const log = [], store = {}; this._log = log;
        const canvas = this;
        this._ctx = new Proxy(store, {
          get(t, k) {
            if (k === 'canvas') return canvas; if (typeof k === 'symbol') return undefined;
            if (k === 'measureText') return (s) => ({ width: String(s).length * 8 });
            if (k === 'roundRect' && state.noRoundRect) return undefined;   // an older WebView without ctx.roundRect
            if (k in t) return t[k];
            return (...a) => {
              if (k === 'clearRect') log.length = 0;
              if (log.length >= 6000) log.splice(0, 3000); log.push([k, a]);
              if (/^create(Linear|Radial)Gradient$|^createPattern$/.test(k)) return { addColorStop() {} };
              return undefined;
            };
          },
          set(t, k, v) { t[k] = v; if (k === 'fillStyle' || k === 'font' || k === 'globalAlpha') { if (log.length >= 6000) log.splice(0, 3000); log.push(['set:' + k, [v]]); } return true; }
        });
        return this._ctx;
      };
      /* count window / document listeners so tests can prove a tool removes what it added */
      const lset = new Set();
      [['w', w], ['d', w.document]].forEach(([nm, tg]) => {
        const add = tg.addEventListener.bind(tg), rem = tg.removeEventListener.bind(tg), ids = new Map();
        const idOf = (f) => { if (!ids.has(f)) ids.set(f, ids.size + 1); return ids.get(f); };
        tg.addEventListener = function (t, f, o) { if (f) lset.add(nm + ':' + t + ':' + idOf(f) + ':' + (o && o.capture ? 1 : (o === true ? 1 : 0))); return add(t, f, o); };
        tg.removeEventListener = function (t, f, o) { if (f) lset.delete(nm + ':' + t + ':' + idOf(f) + ':' + (o && o.capture ? 1 : (o === true ? 1 : 0))); return rem(t, f, o); };
      });
      state.listeners = () => lset.size;
      Object.defineProperty(w.document, 'hidden', { get: () => state.hidden, configurable: true });
      /* same random source for Math.random and crypto.getRandomValues, switchable with seed() */
      const nodeCrypto = require('crypto').webcrypto;
      Object.defineProperty(w, 'crypto', { configurable: true, value: { getRandomValues: (a) => { if (!state.seeded) return nodeCrypto.getRandomValues(a); for (let i = 0; i < a.length; i++) a[i] = Math.floor(state.rng() * 4294967296); return a; }, subtle: nodeCrypto.subtle, randomUUID: () => nodeCrypto.randomUUID() } });
      const realRandom = w.Math.random;
      w.Math.random = () => state.seeded ? state.rng() : realRandom();
    }
  });
  const w = page.w;
  clock.arm();
  const api = {
    page, w, clock, T: null,
    seed(n) { state.rng = mulberry(n); state.seeded = true; },
    set noRoundRect(v) { state.noRoundRect = v; },
    /* an independent copy of the page's random stream for seed n (same values the tool will draw), so a test can predict shuffles and deals */
    replica(n) {
      const r = mulberry(n);
      return { raw: r, rnd(k) { if (k <= 1) return 0; const lim = Math.floor(4294967296 / k) * k; let x; do { x = Math.floor(r() * 4294967296); } while (x >= lim); return x % k; } };
    },
    unseed() { state.seeded = false; },
    /* queue of values handed out first by Math.random AND crypto (as fractions 0..1); afterwards falls back to the seeded rng */
    queue(vals) { const q = vals.slice(), r = state.rng; state.rng = () => (q.length ? q.shift() : r()); state.seeded = true; },
    /* makes `new Date()` inside the page return this moment (the virtual clock still advances it) */
    setDate(iso) {
      const Real = w.__RealDate || (w.__RealDate = w.Date), t0 = new Real(iso).getTime();
      class F extends Real { constructor(...a) { if (a.length) super(...a); else super(t0 + clock.now); } static now() { return t0 + clock.now; } }
      w.Date = F;
    },
    setHidden(h) { state.hidden = h; w.document.dispatchEvent(new w.Event('visibilitychange')); },
    setHit(el) { state.hit = el; },
    /* pointer event helper: ev(el,'pointerdown',{x,y,id,buttons}) */
    ev(el, type, o) {
      o = o || {};
      const e = new w.PointerEvent(type, { bubbles: true, cancelable: true, clientX: o.x || 0, clientY: o.y || 0, pointerId: o.id == null ? 1 : o.id, buttons: o.buttons == null ? (type === 'pointerup' ? 0 : 1) : o.buttons, pointerType: o.type || 'touch', button: 0 });
      el.dispatchEvent(e); return e;
    },
    tap(el, o) { api.ev(el, 'pointerdown', o); api.ev(el, 'pointerup', o); el.click && el.click(); },
    key(k, target) { const e = new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }); (target || w).dispatchEvent(e); return e; },
    swipe(el, dx, dy, o) { o = o || {}; const x = o.x || 100, y = o.y || 100; api.ev(el, 'pointerdown', { x, y }); api.ev(el, 'pointermove', { x: x + dx / 2, y: y + dy / 2 }); api.ev(w, 'pointerup', { x: x + dx, y: y + dy }); api.ev(el, 'pointerup', { x: x + dx, y: y + dy }); },
    tick(ms) { clock.tick(ms); },
    /* for async/await code in the tools (promises resolve between timer callbacks): advance in small steps, letting microtasks run */
    flush: () => new Promise(r => setImmediate(r)),
    async advance(ms, step) { step = step || 50; for (let t = 0; t < ms; t += step) { clock.tick(Math.min(step, ms - t)); await api.flush(); } },
    listeners() { return state.listeners(); },
    toast() { const t = w.document.getElementById('toast'); return t && !t.hidden ? t.textContent : ''; },
    clearToast() { const t = w.document.getElementById('toast'); if (t) { t.hidden = true; t.textContent = ''; } },
    /* drawing calls (name filter optional) since the last clearRect on this canvas */
    calls(cv, name) { return (cv._log || []).filter(c => !name || c[0] === name); },
    /* every number drawn on screen looks sane (no NaN / Infinity in the last frame's calls) */
    sane(cv) { return (cv._log || []).every(c => c[1].every(v => typeof v !== 'number' || Number.isFinite(v))); },
    /* closes a tool, runs the clock on and checks nothing is left running or listening. before = G.listeners() taken before open. */
    leaves(t, before, T, label) {
      t.close(); clock.tick(6000);
      T.eq(clock.idle(), 0, label + ': no timers / intervals / frames left after leaving');
      if (before != null) T.eq(api.listeners(), before, label + ': window/document listeners removed after leaving');
    },
    store(key, d) { const raw = w.localStorage.getItem('pk.' + key); return raw == null ? d : JSON.parse(raw); },
    setStore(key, v) { w.localStorage.setItem('pk.' + key, JSON.stringify(v)); }
  };
  return api;
}

module.exports = { bootGame, mulberry, makeClock };
