'use strict';
/* PocketKit "Fun" category: party games and trivia (Charades & Draw, Heads Up, Who Am I?, Mafia Moderator,
   Trivia Packs, Spelling Bee, Anagram Race). One IIFE so no globals leak. Pure logic and data are on the object P,
   exported for tests/party.test.js at the very bottom (Node only). All content is family friendly. */
(function () {

/* ---------- shared helpers ---------- */
function rnd(n) {
  if (n <= 1) return 0;
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
  if (!c || !c.getRandomValues) return Math.floor(Math.random() * n);
  const a = new Uint32Array(1), lim = Math.floor(4294967296 / n) * n;
  let x;
  do { c.getRandomValues(a); x = a[0]; } while (x >= lim);
  return x % n;
}
const pick = (arr) => arr[rnd(arr.length)];
function shuffle(a, rf) {
  a = a.slice(); rf = rf || rnd;
  for (let i = a.length - 1; i > 0; i--) { const j = rf(i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
/* seeded random so "daily" content is the same all day */
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function seeded(seed) {
  let a = (typeof seed === 'string' ? hashStr(seed) : seed) >>> 0;
  return function (n) {
    a = (a + 0x6D2B79F5) >>> 0; let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return n === undefined ? r : Math.floor(r * n);
  };
}
function todayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
const split = (s) => s.split('|').map(x => x.trim()).filter(Boolean);
const clampInt = (v, lo, hi, fb) => { const n = Math.round(+v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fb; };
const reg = (t) => { if (typeof Tools !== 'undefined') Tools.register(t); };
const sget = (k, d) => (typeof Store !== 'undefined' ? Store.get('fun3.' + k, d) : d);
const sset = (k, v) => { if (typeof Store !== 'undefined') Store.set('fun3.' + k, v); };
const P = { rnd, shuffle, seeded, hashStr, todayKey, clampInt };

/* a tool-scoped bag for timers and listeners, cleaned up when the user leaves */
function bag() {
  const ints = [], tos = [], offs = [];
  return {
    every(fn, ms) { const i = setInterval(fn, ms); ints.push(i); return i; },
    after(fn, ms) { const i = setTimeout(fn, ms); tos.push(i); return i; },
    on(target, ev, fn, opt) { target.addEventListener(ev, fn, opt); offs.push(() => target.removeEventListener(ev, fn, opt)); },
    stop(i) { clearInterval(i); clearTimeout(i); },
    clear() { ints.forEach(clearInterval); tos.forEach(clearTimeout); offs.forEach(f => f()); ints.length = tos.length = offs.length = 0; }
  };
}

/*@@END@@*/

if (typeof module !== 'undefined' && module.exports) module.exports = P;
})();
