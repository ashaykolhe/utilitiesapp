'use strict';
/* Shared helpers and the tool registry. Every file in js/tools/ calls Tools.register(). */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n, w = 2) => String(n).padStart(w, '0');

const Store = {
  get(k, d) { try { const v = localStorage.getItem('pk.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('pk.' + k, JSON.stringify(v)); } catch (e) { toast('Storage is full'); } }
};

/* A stored list that is always an array, even if something wrote the wrong thing there. */
Store.arr = (k) => { const v = Store.get(k, []); return Array.isArray(v) ? v : []; };

let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
}

/* The twelve categories, in home-screen order. A tool's `cat` must be one of these ids. */
const CATS = [
  { id: 'daily', name: 'Daily', icon: '🛠️', color: '#7c5cff' },
  { id: 'navigate', name: 'Navigate', icon: '🧭', color: '#2dd4bf' },
  { id: 'measure', name: 'Measure', icon: '📏', color: '#f59e0b' },
  { id: 'calculate', name: 'Calculate', icon: '🧮', color: '#3b82f6' },
  { id: 'text', name: 'Text & Data', icon: '🔤', color: '#ec4899' },
  { id: 'audio', name: 'Audio', icon: '🎧', color: '#a855f7' },
  { id: 'camera', name: 'Camera', icon: '📷', color: '#ef4444' },
  { id: 'health', name: 'Health', icon: '❤️', color: '#f43f5e' },
  { id: 'security', name: 'Security', icon: '🔒', color: '#22c55e' },
  { id: 'connect', name: 'Connect', icon: '📡', color: '#06b6d4' },
  { id: 'create', name: 'Create', icon: '🎨', color: '#f97316' },
  { id: 'fun', name: 'Fun', icon: '🎲', color: '#84cc16' }
];
const catOf = (id) => CATS.find(c => c.id === id) || CATS[0];

/* A tool is { id, name, icon, cat, desc, keys, needs, render(el) -> optional cleanup function }.
   desc  = one sentence for the feature list;  keys = extra search words;
   needs = device features used, from: camera, microphone, location, motion, notifications, storage, network. */
const Tools = {
  list: [],
  register(t) {
    if (this.list.some(x => x.id === t.id)) { console.warn('duplicate tool id', t.id); return; }
    if (!CATS.some(c => c.id === t.cat)) console.warn('unknown category', t.id, t.cat);
    this.list.push(t);
  },
  _map: null,
  get(id) { if (!this._map || this._map.size !== this.list.length) this._map = new Map(this.list.map(t => [t.id, t])); return this._map.get(id); },
  matches(t, q) { return (t.name + ' ' + (t.keys || []).join(' ') + ' ' + catOf(t.cat).name).toLowerCase().includes(q); }
};

/* Pinned tools and recently opened tools, both kept on the device. */
const Prefs = {
  pins() { return Store.arr('pins').filter(id => Tools.get(id)); },
  isPinned(id) { return this.pins().includes(id); },
  togglePin(id) {
    const p = Store.arr('pins'), i = p.indexOf(id);
    if (i >= 0) p.splice(i, 1); else p.push(id);
    Store.set('pins', p); return i < 0;
  },
  recent() { return Store.arr('recent').filter(id => Tools.get(id)); },
  touch(id) { Store.set('recent', [id, ...Store.arr('recent').filter(x => x !== id)].slice(0, 8)); },
  closed() { return Store.arr('closed'); },
  /* Collections: named groups of tools made by the user, shown on Home. */
  colls() { return Store.arr('colls').filter(x => x && typeof x.id === 'string' && Array.isArray(x.tools)).map(x => ({ id: x.id, name: String(x.name || 'Collection').slice(0, 30), tools: x.tools.filter(id => Tools.get(id)) })); },
  saveColls(list) { Store.set('colls', list); }
};

/* Save or share a text file (CSV, JSON, GPX...). On Android it goes through the share sheet; in a browser it downloads. Returns true when it worked. */
async function saveTextFile(name, text, type) {
  const C = window.Capacitor && Capacitor.Plugins || {}, FS = C.Filesystem, SH = C.Share;
  const safe = String(name || 'file.txt').replace(/[\u0000-\u001f‪-‮⁦-⁩\\/:*?"<>|]+/g, '_').replace(/^\.+/, '') || 'file.txt';
  if (FS && SH) {
    try {
      const r = await FS.writeFile({ path: 'pk-share/' + safe, data: btoa(unescape(encodeURIComponent(text))), directory: 'CACHE', recursive: true });
      await SH.share({ title: safe, url: r.uri }); return true;
    } catch (e) { if (/cancel/i.test(String(e && e.message))) return false; }
  }
  try {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain' })); a.download = safe;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); return true;
  } catch (e) { return false; }
}
/* Share plain text (Android share sheet, then the Web Share API, then the clipboard). */
async function shareText(title, text) {
  const C = window.Capacitor && Capacitor.Plugins || {};
  try { if (C.Share) { await C.Share.share({ title, text }); return true; } } catch (e) { if (/cancel/i.test(String(e && e.message))) return false; }
  try { if (navigator.share) { await navigator.share({ title, text }); return true; } } catch (e) { if (e && e.name === 'AbortError') return false; }
  try { await navigator.clipboard.writeText(text); toast('Copied to the clipboard'); return true; } catch (e) { toast('Could not share'); return false; }
}
/* Rows (arrays of cells) to CSV text with correct quoting. */
const toCSV = (rows) => rows.map(r => r.map(v => { v = v == null ? '' : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',')).join('\r\n');
