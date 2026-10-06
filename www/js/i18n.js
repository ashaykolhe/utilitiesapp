'use strict';
/* Languages. English is the source text. A language pack (js/i18n/xx.js) fills I18N.packs.xx = { ui: {english: translated}, cats: {id: name}, tools: {id: [name, description]} }.
   Anything missing from a pack simply shows in English, so a pack can grow over time.
   Static HTML text uses data-i="English text" (and data-i-ph / data-i-label for placeholder and aria-label). */
const I18N = { lang: 'en', packs: {}, names: { en: 'English' } };
const tr = (s) => (I18N.lang !== 'en' && I18N.packs[I18N.lang] && I18N.packs[I18N.lang].ui[s]) || s;
const catName = (c) => (I18N.lang !== 'en' && I18N.packs[I18N.lang] && I18N.packs[I18N.lang].cats[c.id]) || c.name;
const toolName = (x) => { const p = I18N.lang !== 'en' && I18N.packs[I18N.lang]; return (p && p.tools[x.id] && p.tools[x.id][0]) || x.name; };
const toolDesc = (x) => { const p = I18N.lang !== 'en' && I18N.packs[I18N.lang]; return (p && p.tools[x.id] && p.tools[x.id][1]) || x.desc || ''; };
function setLang(code) {
  I18N.lang = I18N.packs[code] ? code : 'en';
  try { localStorage.setItem('pk.lang', JSON.stringify(I18N.lang)); } catch (e) {}
  document.documentElement.lang = I18N.lang;
  applyI18n();
}
function applyI18n(root) {
  (root || document).querySelectorAll('[data-i]').forEach(el => { el.textContent = tr(el.dataset.i); });
  (root || document).querySelectorAll('[data-i-ph]').forEach(el => { el.placeholder = tr(el.dataset.iPh); });
  (root || document).querySelectorAll('[data-i-label]').forEach(el => { el.setAttribute('aria-label', tr(el.dataset.iLabel)); });
}
try { const l = JSON.parse(localStorage.getItem('pk.lang') || '"en"'); if (typeof l === 'string') I18N.lang = l; } catch (e) {}
