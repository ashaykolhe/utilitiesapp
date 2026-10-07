'use strict';
/* Everyday life tools: Journal, Gratitude Log, Bucket List, Mood Calendar, Fuel Log, Vehicle Service, Trip Odometer, Loan Prepayment,
   FIRE Calculator, Split by Items, Contact QR, Mind Map, Sticky Board, Resume Builder. All data stays on this device.
   Pure logic sits between LOGIC-START and LOGIC-END markers and is tested in Node (tests/life.test.js). */
(() => {
  const LG = {};
  const NOTE = 'font-size:13px;line-height:1.5;color:var(--muted)';
  const msgTo = (root, t) => { const m = $('.lmsg', root); if (m) { m.textContent = t || ''; m.hidden = !t; } };

  /* LOGIC-START */
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pd2 =n => String(n).padStart(2, '0');
  const dkey = (d) => { d = d || new Date(); return d.getFullYear() + '-' + pd2(d.getMonth() + 1) + '-' + pd2(d.getDate()); };
  const keyOk = (s) => { const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(String(s || '')); if (!m) return false; const d = new Date(+m[1], +m[2] - 1, +m[3], 12); return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3]; };
  const keyDate = (k) => { const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(k || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : new Date(NaN); };
  const keyDiff = (a, b) => Math.round((keyDate(b) - keyDate(a)) / 864e5);
  const keyAdd = (k, n) => { const d = keyDate(k); d.setDate(d.getDate() + n); return dkey(d); };
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthLabel = (ym) => { const p = String(ym).split('-'); return (MONTHS[+p[1] - 1] || '?') + ' ' + p[0]; };
  /* CSV cell: quotes when needed and a leading ' so a spreadsheet never runs text as a formula. */
  const csvCell = (v) => { v = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const csvLine = (r) => r.map(csvCell).join(',');
  const csvText = (rows) => rows.map(csvLine).join('\r\n');
  /* Consecutive days with at least one entry, counted back from today (or from yesterday when today is still empty). */
  function streakOf(keys, today) {
    const set = new Set(keys); let k = set.has(today) ? today : keyAdd(today, -1), n = 0;
    while (set.has(k)) { n++; k = keyAdd(k, -1); }
    return n;
  }
  function bestStreak(keys) {
    const u = [...new Set(keys)].filter(keyOk).sort(); let best = 0, run = 0, prev = null;
    for (const k of u) { run = prev && keyDiff(prev, k) === 1 ? run + 1 : 1; if (run > best) best = run; prev = k; }
    return best;
  }
  /* ---- Journal ---- */
  const JMAX = 2000;
  function parseTags(s) {
    const out = [];
    for (let t of String(s || '').split(/[,;\s]+/)) { t = t.replace(/^#+/, '').toLowerCase().slice(0, 20); if (t && !out.includes(t)) out.push(t); if (out.length >= 10) break; }
    return out;
  }
  function journalSearch(list, q) {
    q = String(q || '').trim().toLowerCase().replace(/^#/, ''); if (!q) return list.slice();
    return list.filter(e => (e.t || '').toLowerCase().includes(q) || (e.x || '').toLowerCase().includes(q) || (e.g || []).some(t => t.includes(q)));
  }
  const journalSort = (list) => list.slice().sort((a, b) => a.d < b.d ? 1 : a.d > b.d ? -1 : (b.at || 0) - (a.at || 0));
  function journalGroup(list) {
    const out = [];
    for (const e of journalSort(list)) { const ym = e.d.slice(0, 7); let g = out[out.length - 1]; if (!g || g.ym !== ym) { g = { ym, items: [] }; out.push(g); } g.items.push(e); }
    return out;
  }
  /* Everything as Markdown ('md') or plain text ('txt'), oldest first. */
  function journalExport(list, fmt) {
    const rows = list.slice().sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : (a.at || 0) - (b.at || 0)), md = fmt === 'md', L = [];
    L.push(md ? '# My journal' : 'MY JOURNAL', '');
    for (const e of rows) {
      const title = e.t || '(no title)', tags = (e.g || []).map(t => '#' + t).join(' ');
      L.push(md ? '## ' + e.d + ' - ' + title : e.d + ' - ' + title);
      const meta = [e.m ? 'Mood: ' + e.m : '', tags ? 'Tags: ' + tags : ''].filter(Boolean).join('  |  ');
      if (meta) L.push(md ? '*' + meta + '*' : meta);
      L.push('', e.x || '', '');
      if (md) L.push('---', '');
    }
    return L.join('\n').replace(/\n{4,}/g, '\n\n\n').trimEnd() + '\n';
  }
  Object.assign(LG, { dkey, keyOk, keyDiff, keyAdd, csvCell, csvText, streakOf, bestStreak, parseTags, journalSearch, journalGroup, journalExport, JMAX });
  /* LOGIC-END */

  /* Journal entries can be large (20000 characters each), so they live in IndexedDB, with localStorage as the fallback. */
  const jstore = (() => {
    let dbp = null;
    const open = () => dbp || (dbp = new Promise(res => {
      try {
        if (!window.indexedDB) return res(null);
        const r = indexedDB.open('pk-life', 1);
        r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('journal')) r.result.createObjectStore('journal', { keyPath: 'id' }); };
        r.onsuccess = () => res(r.result); r.onerror = () => res(null); r.onblocked = () => res(null);
      } catch (e) { res(null); }
    }));
    const run = (db, mode, fn) => new Promise((res, rej) => { const t = db.transaction('journal', mode), r = fn(t.objectStore('journal')); t.oncomplete = () => res(r && r.result); t.onerror = t.onabort = () => rej(t.error); });
    const lsPut = (e) => { const a = Store.arr('life.journal').filter(x => x && x.id !== e.id); a.push(e); Store.set('life.journal', a); return true; };
    return {
      async all() { const db = await open(); if (!db) return Store.arr('life.journal'); try { return (await run(db, 'readonly', s => s.getAll())) || []; } catch (e) { return []; } },
      async put(e) { const db = await open(); if (!db) return lsPut(e); try { await run(db, 'readwrite', s => s.put(e)); return true; } catch (er) { toast('Could not save (storage full?)'); return false; } },
      async del(id) { const db = await open(); if (!db) { Store.set('life.journal', Store.arr('life.journal').filter(x => x && x.id !== id)); return true; } try { await run(db, 'readwrite', s => s.delete(id)); return true; } catch (e) { return false; } }
    };
  })();

  /* ====================== 1. Journal ====================== */
  Tools.register({ id: 'journal', name: 'Journal', icon: '📔', cat: 'health', desc: 'A private dated journal with title, text, mood and tags, listed by month with search, a writing streak and export as Markdown or text. Stored only on this device.', keys: ['diary', 'write', 'notes', 'daily', 'log', 'reflect'], needs: ['storage'], render(el) {
    const MOODS = ['😄', '🙂', '😐', '🙁', '😞', '😡', '😴', '🥰'];
    let list = [], q = '', cur = null, mood = '', gone = false;
    const today = dkey();
    el.innerHTML = `<div id="vl"><div class="card center"><div class="mid" id="st" aria-live="polite">Loading...</div>
        <button class="btn" id="nw" style="width:100%;margin-top:10px">New entry</button></div>
      <label class="f">Search entries<input id="q" type="search" maxlength="60" placeholder="word or #tag"></label>
      <div id="ls"></div>
      <div class="row" style="margin-top:8px"><button class="btn alt" id="em">Export Markdown</button><button class="btn alt" id="et">Export text</button></div>
      <div class="muted" style="${NOTE};margin-top:8px">Entries stay on this device. Up to ${JMAX} entries.</div></div>
      <div id="ve" hidden><div class="card">
        <label class="f">Date<input id="jd" type="date" min="2000-01-01" max="2100-12-31"></label>
        <label class="f">Title<input id="jt" type="text" maxlength="120" placeholder="optional"></label>
        <label class="f">Entry<textarea id="jx" rows="9" maxlength="20000" placeholder="What is on your mind?"></textarea></label>
        <div class="muted" id="cn" style="font-size:12px;text-align:right">0 / 20000</div>
        <div class="muted" style="font-size:13px;margin-top:6px">Mood</div><div class="chips" id="md" style="padding:6px 0"></div>
        <label class="f">Tags<input id="jg" type="text" maxlength="100" placeholder="work, idea, family"></label>
        <div class="lmsg" role="alert" hidden style="color:var(--danger);font-size:13px;margin:6px 0"></div>
        <div class="row" style="margin-top:8px"><button class="btn" id="sv">Save</button><button class="btn alt" id="cx">Cancel</button></div>
        <button class="btn danger" id="dl" style="width:100%;margin-top:8px" hidden>Delete entry</button></div></div>`;
    const show = (v) => { $('#vl', el).hidden = v !== 'l'; $('#ve', el).hidden = v !== 'e'; };
    function paint() {
      const keys = list.map(e => e.d);
      $('#st', el).textContent = list.length ? `${streakOf(keys, today)} day streak, ${list.length} ${list.length === 1 ? 'entry' : 'entries'}` : 'No entries yet';
      const rows = journalGroup(journalSearch(list, q));
      $('#ls', el).innerHTML = rows.length ? rows.map(g => `<div class="muted" style="font-weight:700;margin:12px 4px 4px">${esc(monthLabel(g.ym))} <small>(${g.items.length})</small></div><div class="list">${g.items.map(e => `<button class="item" data-id="${esc(e.id)}" style="text-align:left;width:100%;min-height:56px;align-items:flex-start">
        <span style="min-width:34px;text-align:center"><b>${esc(e.d.slice(8))}</b><br><small class="muted">${esc(keyDate(e.d).toLocaleDateString(undefined, { weekday: 'short' }))}</small></span>
        <span class="grow" style="min-width:0"><b>${esc(e.t || '(no title)')}</b><br><small class="muted" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc((e.x || '').slice(0, 90))}</small>${(e.g || []).length ? `<small class="muted">${esc(e.g.map(t => '#' + t).join(' '))}</small>` : ''}</span>
        <span style="font-size:22px">${esc(e.m || '')}</span></button>`).join('')}</div>`).join('') : `<div class="center muted" style="padding:24px">${q ? 'No entries match.' : 'Tap New entry to write your first one.'}</div>`;
    }
    function edit(e) {
      cur = e; mood = e ? e.m || '' : '';
      $('#jd', el).value = e ? e.d : today; $('#jt', el).value = e ? e.t || '' : ''; $('#jx', el).value = e ? e.x || '' : ''; $('#jg', el).value = e ? (e.g || []).join(', ') : '';
      $('#cn', el).textContent = $('#jx', el).value.length + ' / 20000'; $('#dl', el).hidden = !e; msgTo(el, ''); paintMood(); show('e');
    }
    function paintMood() { $('#md', el).innerHTML = MOODS.map(m => `<button class="chip${m === mood ? ' on' : ''}" data-m="${m}" aria-label="Mood ${m}" style="font-size:20px">${m}</button>`).join(''); }
    $('#md', el).onclick = (ev) => { const b = ev.target.closest('[data-m]'); if (!b) return; mood = mood === b.dataset.m ? '' : b.dataset.m; paintMood(); };
    $('#jx', el).oninput = () => { $('#cn', el).textContent = $('#jx', el).value.length + ' / 20000'; };
    $('#q', el).oninput = (ev) => { q = ev.target.value; paint(); };
    $('#nw', el).onclick = () => { if (list.length >= JMAX) { toast('Journal is full: export and delete old entries'); return; } edit(null); };
    $('#ls', el).onclick = (ev) => { const b = ev.target.closest('[data-id]'); if (!b) return; const e = list.find(x => x.id === b.dataset.id); if (e) edit(e); };
    $('#cx', el).onclick = () => show('l');
    $('#sv', el).onclick = async () => {
      const t = $('#jt', el).value.trim(), x = $('#jx', el).value.trim();
      if (!t && !x) { msgTo(el, 'Write a title or some text first.'); return; }
      let d = $('#jd', el).value; if (!keyOk(d)) d = today;
      if (!cur && list.length >= JMAX) { msgTo(el, 'Journal is full (' + JMAX + ' entries).'); return; }
      const e = cur || { id: uid(), at: Date.now() };
      const next = Object.assign({}, e, { d, t: t.slice(0, 120), x: x.slice(0, 20000), m: mood, g: parseTags($('#jg', el).value) });
      if (await jstore.put(next)) { if (gone) return; const i = list.findIndex(z => z.id === next.id); if (i >= 0) list[i] = next; else list.push(next); paint(); show('l'); toast('Saved'); }
    };
    $('#dl', el).onclick = async () => { if (!cur || !confirm('Delete this entry?')) return; if (await jstore.del(cur.id)) { list = list.filter(x => x.id !== cur.id); paint(); show('l'); toast('Deleted'); } };
    const exp = async (fmt) => { if (!list.length) { toast('Nothing to export yet'); return; } await saveTextFile('journal-' + today + (fmt === 'md' ? '.md' : '.txt'), journalExport(list, fmt), fmt === 'md' ? 'text/markdown' : 'text/plain'); };
    $('#em', el).onclick = () => exp('md'); $('#et', el).onclick = () => exp('txt');
    jstore.all().then(a => { if (gone) return; list = (Array.isArray(a) ? a : []).filter(e => e && typeof e.id === 'string' && keyOk(e.d)).slice(0, JMAX); paint(); });
    paint();
    return () => { gone = true; };
  } });

  /* LOGIC-START */
  const GMAX_DAYS = 3650;
  const gratLines = (v) => (Array.isArray(v) ? v : []).map(s => String(s == null ? '' : s).trim().slice(0, 200)).filter(Boolean);
  /* Days that have at least one line, as sorted keys. */
  const gratKeys = (map) => Object.keys(map || {}).filter(k => keyOk(k) && gratLines(map[k]).length).sort();
  /* A random day before today ('remember this'); rnd is injectable for tests. */
  function gratRandomOld(map, today, rnd) { const ks = gratKeys(map).filter(k => k < today); return ks.length ? ks[Math.min(ks.length - 1, Math.floor((rnd || Math.random)() * ks.length))] : null; }
  function gratExport(map) {
    const L = ['GRATITUDE LOG', ''];
    for (const k of gratKeys(map)) { L.push(k); gratLines(map[k]).forEach((s, i) => L.push((i + 1) + '. ' + s)); L.push(''); }
    return L.join('\n').trimEnd() + '\n';
  }
  Object.assign(LG, { gratLines, gratKeys, gratRandomOld, gratExport, GMAX_DAYS });
  /* LOGIC-END */

  /* ====================== 2. Gratitude Log ====================== */
  Tools.register({ id: 'gratitude', name: 'Gratitude Log', icon: '🙏', cat: 'health', desc: 'Write three things you are grateful for each day, keep a streak, look back at a random old entry and export everything as text.', keys: ['thankful', 'grateful', 'daily', 'diary', 'positive', 'wellbeing'], needs: ['storage'], render(el) {
    const today = dkey();
    let map = Store.get('life.gratitude', {}); if (!map || typeof map !== 'object' || Array.isArray(map)) map = {};
    el.innerHTML = `<div class="card center"><div class="mid" id="st" aria-live="polite"></div><small class="muted" id="bs"></small></div>
      <div class="card"><div style="font-weight:700;margin-bottom:6px">Today I am grateful for</div>
        <label class="f">First thing<input id="g0" type="text" maxlength="200"></label>
        <label class="f">Second thing<input id="g1" type="text" maxlength="200"></label>
        <label class="f">Third thing<input id="g2" type="text" maxlength="200"></label>
        <div class="lmsg" role="alert" hidden style="color:var(--danger);font-size:13px;margin:6px 0"></div>
        <button class="btn" id="sv" style="width:100%;margin-top:8px">Save today</button></div>
      <div class="card" id="rm" hidden></div>
      <div class="row"><button class="btn alt" id="rb">Remember this</button><button class="btn alt" id="ex">Export</button></div>
      <div class="muted" style="${NOTE};margin-top:8px">Entries stay on this device.</div>`;
    function stats() {
      const ks = gratKeys(map), cur = streakOf(ks, today);
      $('#st', el).textContent = cur ? cur + ' day streak' : 'Start your streak today';
      $('#bs', el).textContent = ks.length ? `Best streak ${bestStreak(ks)} days, ${ks.length} days written` : '';
    }
    function fill() { const l = gratLines(map[today]); for (let i = 0; i < 3; i++) $('#g' + i, el).value = (map[today] && map[today][i]) || ''; $('#sv', el).textContent = l.length ? 'Update today' : 'Save today'; }
    $('#sv', el).onclick = () => {
      const v = [0, 1, 2].map(i => $('#g' + i, el).value.trim().slice(0, 200));
      if (!v.some(Boolean)) { msgTo(el, 'Write at least one thing.'); return; }
      msgTo(el, '');
      if (!map[today] && Object.keys(map).length >= GMAX_DAYS) { msgTo(el, 'Log is full (' + GMAX_DAYS + ' days). Export it first.'); return; }
      map[today] = v; Store.set('life.gratitude', map); stats(); fill(); toast('Saved');
    };
    $('#rb', el).onclick = () => {
      const k = gratRandomOld(map, today), box = $('#rm', el);
      if (!k) { box.hidden = false; box.innerHTML = '<div class="muted center">No older entries yet. Come back after a few days.</div>'; return; }
      box.hidden = false; box.innerHTML = `<div class="muted" style="font-size:12px">Remember this, ${esc(k)}</div>` + gratLines(map[k]).map(s => `<div style="margin-top:6px">&bull; ${esc(s)}</div>`).join('');
    };
    $('#ex', el).onclick = async () => { if (!gratKeys(map).length) { toast('Nothing to export yet'); return; } await saveTextFile('gratitude-' + today + '.txt', gratExport(map), 'text/plain'); };
    stats(); fill();
  } });

  /* LOGIC-START */
  const BCATS = ['Travel', 'Adventure', 'Learning', 'Career', 'Money', 'Family', 'Health', 'Creative', 'Other'], BMAX = 500;
  const bucketProgress = (items) => { const total = items.length, done = items.filter(i => i.done).length; return { total, done, pct: total ? Math.round(done / total * 100) : 0 }; };
  /* Open items first (soonest target date first, undated last), then done items, newest first. */
  function bucketSort(items) {
    return items.slice().sort((a, b) => {
      if (!!a.done !== !!b.done) return a.done ? 1 : -1;
      if (a.done) return a.done < b.done ? 1 : a.done > b.done ? -1 : 0;
      const x = a.by || '9999', y = b.by || '9999'; return x < y ? -1 : x > y ? 1 : (a.at || 0) - (b.at || 0);
    });
  }
  function bucketExport(items) {
    const p = bucketProgress(items), L = ['BUCKET LIST', p.done + ' of ' + p.total + ' done (' + p.pct + '%)', '', 'TO DO'];
    const open = bucketSort(items.filter(i => !i.done)), done = bucketSort(items.filter(i => i.done));
    open.forEach(i => L.push('[ ] ' + i.t + ' (' + i.c + (i.by ? ', target ' + i.by : '') + ')'));
    L.push('', 'DONE');
    done.forEach(i => L.push('[x] ' + i.t + ' (' + i.c + ', done ' + i.done + ')'));
    return L.join('\n') + '\n';
  }
  Object.assign(LG, { bucketProgress, bucketSort, bucketExport, BCATS });
  /* LOGIC-END */

  /* ====================== 3. Bucket List ====================== */
  Tools.register({ id: 'bucketlist', name: 'Bucket List', icon: '🌠', cat: 'health', desc: 'A list of life goals with category and target date, a done toggle that records the day, a progress bar and export as text.', keys: ['goals', 'dreams', 'wishlist', 'things to do', 'life'], needs: ['storage'], render(el) {
    const today = dkey();
    let items = Store.arr('life.bucket').filter(i => i && typeof i.id === 'string' && typeof i.t === 'string').slice(0, BMAX).map(i => Object.assign({}, i, { c: BCATS.includes(i.c) ? i.c : 'Other', by: keyOk(i.by) ? i.by : '', done: keyOk(i.done) ? i.done : '' })), filt = 'All';
    const save = () => Store.set('life.bucket', items);
    el.innerHTML = `<div class="card"><div class="row" style="align-items:center"><b id="pt">0 of 0 done</b><b id="pp" style="text-align:right">0%</b></div><div class="progress" style="margin-top:8px"><i id="pb" style="width:0"></i></div></div>
      <div class="card"><label class="f">New goal<input id="nt" type="text" maxlength="100" placeholder="See the Northern Lights"></label>
        <div class="row"><label class="f">Category<select id="nc">${BCATS.map(c => `<option>${c}</option>`).join('')}</select></label>
        <label class="f">Target date (optional)<input id="nd" type="date" min="2000-01-01" max="2100-12-31"></label></div>
        <div class="lmsg" role="alert" hidden style="color:var(--danger);font-size:13px;margin:6px 0"></div>
        <button class="btn" id="ad" style="width:100%;margin-top:8px">Add to list</button></div>
      <div class="chips" id="fl" style="padding:6px 0"></div><div class="list" id="ls"></div>
      <button class="btn alt" id="ex" style="width:100%;margin-top:10px">Export list</button>`;
    function paint() {
      const p = bucketProgress(items); $('#pt', el).textContent = p.done + ' of ' + p.total + ' done'; $('#pp', el).textContent = p.pct + '%'; $('#pb', el).style.width = p.pct + '%';
      $('#fl', el).innerHTML = ['All'].concat(BCATS).map(c => `<button class="chip${c === filt ? ' on' : ''}" data-c="${c}">${c}</button>`).join('');
      const rows = bucketSort(items.filter(i => filt === 'All' || i.c === filt));
      $('#ls', el).innerHTML = rows.length ? rows.map(i => `<div class="item"><label style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;min-height:44px"><input type="checkbox" data-id="${esc(i.id)}" ${i.done ? 'checked' : ''} aria-label="Done: ${esc(i.t)}"><span class="grow"><b${i.done ? ' style="text-decoration:line-through;opacity:.7"' : ''}>${esc(i.t)}</b><br><small class="muted">${esc(i.c)}${i.by && !i.done ? ' &middot; target ' + esc(i.by) + (i.by < today ? ' (past)' : '') : ''}${i.done ? ' &middot; done ' + esc(i.done) : ''}</small></span></label><button class="btn alt" data-del="${esc(i.id)}" aria-label="Delete ${esc(i.t)}" style="min-width:44px">&times;</button></div>`).join('') : '<div class="center muted" style="padding:20px">Nothing here yet.</div>';
    }
    $('#fl', el).onclick = (ev) => { const b = ev.target.closest('[data-c]'); if (b) { filt = b.dataset.c; paint(); } };
    $('#ls', el).onchange = (ev) => { const c = ev.target.closest('[data-id]'); if (!c) return; const i = items.find(x => x.id === c.dataset.id); if (i) { i.done = c.checked ? dkey() : ''; save(); paint(); } };
    $('#ls', el).onclick = (ev) => { const b = ev.target.closest('[data-del]'); if (!b || !confirm('Delete this goal?')) return; items = items.filter(x => x.id !== b.dataset.del); save(); paint(); };
    $('#ad', el).onclick = () => {
      const t = $('#nt', el).value.trim().slice(0, 100); if (!t) { msgTo(el, 'Write the goal first.'); return; }
      if (items.length >= BMAX) { msgTo(el, 'The list is full (' + BMAX + ' goals).'); return; }
      const by = $('#nd', el).value; msgTo(el, '');
      items.push({ id: uid(), t, c: BCATS.includes($('#nc', el).value) ? $('#nc', el).value : 'Other', by: keyOk(by) ? by : '', done: '', at: Date.now() });
      save(); $('#nt', el).value = ''; $('#nd', el).value = ''; paint();
    };
    $('#ex', el).onclick = async () => { if (!items.length) { toast('Nothing to export yet'); return; } await saveTextFile('bucket-list-' + today + '.txt', bucketExport(items), 'text/plain'); };
    paint();
  } });

  /* LOGIC-START */
  const MOOD_FACES = [['😞', 'Awful', 'var(--danger)'], ['🙁', 'Bad', '#f97316'], ['😐', 'Okay', '#f59e0b'], ['🙂', 'Good', '#84cc16'], ['😄', 'Great', 'var(--ok)']];
  /* Weeks (Monday first) for a month: day keys, null for padding cells. */
  function monthGrid(y, m0) {
    const first = new Date(y, m0, 1, 12), lead = (first.getDay() + 6) % 7, days = new Date(y, m0 + 1, 0).getDate(), cells = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push(y + '-' + pd2(m0 + 1) + '-' + pd2(d));
    while (cells.length % 7) cells.push(null);
    return cells;
  }
  /* Summary of the Mood Log data (days = { 'YYYY-MM-DD': { m: 0..4, n } }) for one month 'YYYY-MM'. Bad stored values are skipped. */
  function moodMonth(days, ym) {
    const counts = [0, 0, 0, 0, 0]; let sum = 0, n = 0, best = null, worst = null;
    for (const k of Object.keys(days || {}).sort()) {
      if (k.slice(0, 7) !== ym || !keyOk(k)) continue;
      const m = days[k] && days[k].m; if (!Number.isInteger(m) || m < 0 || m > 4) continue;
      counts[m]++; sum += m + 1; n++;
      if (!best || m > best.m) best = { k, m }; if (!worst || m < worst.m) worst = { k, m };
    }
    return { counts, n, avg: n ? sum / n : null, best, worst };
  }
  Object.assign(LG, { monthGrid, moodMonth });
  /* LOGIC-END */

  /* ====================== 4. Mood Calendar ====================== */
  Tools.register({ id: 'moodcal', name: 'Mood Calendar', icon: '🌦️', cat: 'health', desc: 'A month grid coloured by the moods you saved in Mood Log, with month navigation, the average, best and worst day and a count per mood. Read only.', keys: ['mood', 'calendar', 'feelings', 'month', 'wellbeing'], needs: ['storage'], render(el) {
    const now = new Date(); let y = now.getFullYear(), m0 = now.getMonth(), pick = '';
    const days = Store.get('mood.days', {}), safe = days && typeof days === 'object' && !Array.isArray(days) ? days : {};
    el.innerHTML = `<div class="card"><div class="row" style="align-items:center"><button class="btn alt" id="pv" aria-label="Previous month">&lsaquo;</button><b id="mt" class="center" style="flex:2;text-align:center" aria-live="polite"></b><button class="btn alt" id="nx" aria-label="Next month">&rsaquo;</button></div>
      <div id="gr" style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:10px"></div></div>
      <div class="card" id="dt" hidden></div><div class="card" id="sm"></div>
      <div class="muted" style="${NOTE}">Colours come from Mood Log (read only). Save moods there and they show up here.</div>`;
    const ym = () => y + '-' + pd2(m0 + 1);
    function paint() {
      $('#mt', el).textContent = MONTHS[m0] + ' ' + y;
      const s = moodMonth(safe, ym()), grid = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => `<div class="muted center" style="font-size:12px;text-align:center">${d}</div>`);
      for (const k of monthGrid(y, m0)) {
        if (!k) { grid.push('<div></div>'); continue; }
        const e = safe[k], mi = e && Number.isInteger(e.m) && e.m >= 0 && e.m <= 4 ? e.m : -1, f = MOOD_FACES[mi];
        grid.push(`<button class="btn alt" data-k="${k}" aria-label="${k}${f ? ' ' + f[1] : ' no mood'}" style="padding:0;min-height:44px;font-size:13px;border-radius:10px;${f ? 'background:' + f[2] + ';color:#000;border-color:transparent' : ''};${k === pick ? 'outline:2px solid var(--text)' : ''}">${+k.slice(8)}</button>`);
      }
      $('#gr', el).innerHTML = grid.join('');
      const nm = k => `${k.slice(8)} ${MONTHS[m0].slice(0, 3)}`;
      $('#sm', el).innerHTML = s.n ? `<div class="row"><div class="center"><div class="mid">${s.avg.toFixed(1)}</div><small class="muted">Average of 5</small></div><div class="center"><div class="mid">${MOOD_FACES[s.best.m][0]}</div><small class="muted">Best: ${esc(nm(s.best.k))}</small></div><div class="center"><div class="mid">${MOOD_FACES[s.worst.m][0]}</div><small class="muted">Worst: ${esc(nm(s.worst.k))}</small></div></div>
        <div class="row" style="margin-top:10px">${MOOD_FACES.map((f, i) => `<div class="center"><div style="font-size:22px">${f[0]}</div><b>${s.counts[i]}</b></div>`).join('')}</div>` : '<div class="center muted">No moods saved this month. Add them in the Mood Log tool.</div>';
      const d = $('#dt', el), e = pick && pick.slice(0, 7) === ym() ? safe[pick] : null;
      d.hidden = !pick || pick.slice(0, 7) !== ym();
      if (!d.hidden) { const f = e && MOOD_FACES[e.m]; d.innerHTML = f ? `<b>${esc(pick)}</b>: ${f[0]} ${f[1]}${e.n ? '<br>' + esc(String(e.n).slice(0, 200)) : ''}` : `<b>${esc(pick)}</b>: no mood saved`; }
    }
    const go = (n) => { m0 += n; if (m0 < 0) { m0 = 11; y--; } if (m0 > 11) { m0 = 0; y++; } y = Math.min(2100, Math.max(2000, y)); pick = ''; paint(); };
    $('#pv', el).onclick = () => go(-1); $('#nx', el).onclick = () => go(1);
    $('#gr', el).onclick = (ev) => { const b = ev.target.closest('[data-k]'); if (b) { pick = b.dataset.k; paint(); } };
    paint();
  } });

  /* LOGIC-START */
  const KM_PER_MI = 1.609344, L_PER_USGAL = 3.785411784, L_PER_UKGAL = 4.54609, FMAX = 3000;
  /* Entries are stored in kilometres and litres; the unit only changes what is typed and shown. */
  const FUEL_UNITS = {
    kmpl: { label: 'km/L', dist: 'km', vol: 'L', kmF: 1, lF: 1 },
    l100: { label: 'L/100km', dist: 'km', vol: 'L', kmF: 1, lF: 1 },
    mpgus: { label: 'mpg (US)', dist: 'mi', vol: 'gal', kmF: KM_PER_MI, lF: L_PER_USGAL },
    mpguk: { label: 'mpg (UK)', dist: 'mi', vol: 'gal', kmF: KM_PER_MI, lF: L_PER_UKGAL }
  };
  const fuelUnit = (u) => FUEL_UNITS[u] || FUEL_UNITS.kmpl;
  const fuelToCanon = (u, odo, vol) => ({ km: odo * fuelUnit(u).kmF, l: vol * fuelUnit(u).lF });
  /* km per litre to the chosen display unit */
  function consShow(kmpl, u) {
    if (!(kmpl > 0) || !isFinite(kmpl)) return null;
    if (u === 'l100') return 100 / kmpl;
    if (u === 'mpgus') return kmpl / KM_PER_MI * L_PER_USGAL;
    if (u === 'mpguk') return kmpl / KM_PER_MI * L_PER_UKGAL;
    return kmpl;
  }
  const fuelSorted = (list) => list.slice().sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : a.km - b.km);
  /* Full-to-full method: a full fill-up works out consumption from the distance since the previous full fill-up and all fuel
     added since then (partial fills in between included). The first full fill-up only sets the starting point. */
  function fuelCompute(list) {
    const rows = fuelSorted(list).map(e => Object.assign({}, e, { dist: null, used: null, cost: null, kmpl: null }));
    let base = -1, tKm = 0, tL = 0, tCost = 0;
    rows.forEach((r, i) => {
      if (!r.full) return;
      if (base >= 0) {
        let used = 0, cost = 0; for (let j = base + 1; j <= i; j++) { used += rows[j].l; cost += rows[j].price || 0; }
        const dist = r.km - rows[base].km;
        if (dist > 0 && used > 0) { r.dist = dist; r.used = used; r.cost = cost; r.kmpl = dist / used; tKm += dist; tL += used; tCost += cost; }
      }
      base = i;
    });
    return { rows, avgKmpl: tL > 0 ? tKm / tL : null, costPerKm: tKm > 0 ? tCost / tKm : null, totalKm: tKm, totalL: tL, totalCost: tCost, spent: rows.reduce((s, r) => s + (r.price || 0), 0) };
  }
  /* The odometer must be above every earlier fill-up and below every later one. Returns an error text or ''. */
  function fuelCheck(list, e, ignoreId) {
    if (!keyOk(e.d)) return 'Pick a valid date.';
    if (!(e.km > 0) || e.km > 9999999) return 'Enter the odometer reading.';
    if (!(e.l > 0) || e.l > 9999) return 'Enter the amount of fuel.';
    if (!(e.price >= 0) || e.price > 999999) return 'Price must be 0 or more.';
    const others = list.filter(x => x.id !== ignoreId);
    const before = others.filter(x => x.d <= e.d), after = others.filter(x => x.d > e.d);
    const lo = before.length ? Math.max(...before.map(x => x.km)) : -Infinity, hi = after.length ? Math.min(...after.map(x => x.km)) : Infinity;
    if (e.km <= lo) return 'The odometer must be higher than the previous fill-up (' + +lo.toFixed(1) + ' km).';
    if (e.km >= hi) return 'The odometer must be lower than the next fill-up (' + +hi.toFixed(1) + ' km).';
    return '';
  }
  function fuelCsv(list, u) {
    const f = fuelUnit(u), c = fuelCompute(list);
    const rows = [['Date', 'Odometer (' + f.dist + ')', 'Fuel (' + f.vol + ')', 'Price', 'Full tank', 'Consumption (' + f.label + ')', 'Cost per ' + f.dist]];
    for (const r of c.rows) {
      const cs = consShow(r.kmpl, u);
      rows.push([r.d, +(r.km / f.kmF).toFixed(1), +(r.l / f.lF).toFixed(2), r.price || 0, r.full ? 'yes' : 'no', cs == null ? '' : +cs.toFixed(2), r.cost != null && r.dist > 0 ? +(r.cost / (r.dist / f.kmF)).toFixed(3) : '']);
    }
    return csvText(rows);
  }
  Object.assign(LG, { fuelUnit, fuelToCanon, consShow, fuelCompute, fuelCheck, fuelCsv, FUEL_UNITS, FMAX });
  /* LOGIC-END */

  /* ====================== 5. Fuel Log ====================== */
  Tools.register({ id: 'fuellog', name: 'Fuel Log', icon: '🛢️', cat: 'daily', desc: 'Log fill-ups with odometer, fuel and price, see consumption per fill-up, the average and cost per distance on a line chart, in km/L, L/100km or mpg, and export CSV.', keys: ['petrol', 'diesel', 'mileage', 'mpg', 'car', 'fill up', 'gas', 'consumption'], needs: ['storage'], render(el) {
    let list = Store.arr('life.fuel').filter(e => e && typeof e.id === 'string' && keyOk(e.d) && e.km > 0 && e.l > 0).map(e => ({ id: e.id, d: e.d, km: +e.km, l: +e.l, price: e.price > 0 ? +e.price : 0, full: !!e.full })).slice(0, FMAX);
    let unit = Store.get('life.fuel.unit', 'kmpl'); if (!FUEL_UNITS[unit]) unit = 'kmpl';
    const save = () => Store.set('life.fuel', list), today = dkey();
    el.innerHTML = `<div class="card"><label class="f">Units<select id="un">${Object.keys(FUEL_UNITS).map(k => `<option value="${k}">${FUEL_UNITS[k].label}</option>`).join('')}</select></label></div>
      <div class="card"><label class="f">Date<input id="fd" type="date" min="2000-01-01" max="2100-12-31"></label>
        <div class="row"><label class="f"><span id="lo">Odometer</span><input id="fo" type="number" inputmode="decimal" min="0" max="9999999" step="0.1"></label>
        <label class="f"><span id="lq">Fuel</span><input id="fq" type="number" inputmode="decimal" min="0" max="9999" step="0.01"></label></div>
        <label class="f">Total price<input id="fp" type="number" inputmode="decimal" min="0" max="999999" step="0.01" placeholder="optional"></label>
        <label class="item" style="margin-top:8px;min-height:48px"><input type="checkbox" id="ff" checked><span class="grow">Full tank</span></label>
        <div class="lmsg" role="alert" hidden style="color:var(--danger);font-size:13px;margin:6px 0"></div>
        <button class="btn" id="ad" style="width:100%;margin-top:8px">Add fill-up</button></div>
      <div class="card" id="sm"></div><div class="card"><canvas id="ch" width="600" height="260" style="width:100%;height:auto" role="img" aria-label="Consumption per fill-up"></canvas></div>
      <div class="list" id="ls"></div><button class="btn alt" id="ex" style="width:100%;margin-top:10px">Export CSV</button>
      <div class="muted" style="${NOTE};margin-top:8px">Consumption is worked out from full tank to full tank, so tick Full tank when you fill up completely. Up to ${FMAX} entries.</div>`;
    $('#un', el).value = unit; $('#fd', el).value = today;
    const num = (id) => Valid.num($(id, el).value);
    function chart(vals) {
      const cv = $('#ch', el), g = cv.getContext && cv.getContext('2d'); if (!g) return;
      const W = cv.width, H = cv.height, cs = getComputedStyle(el), acc = cs.getPropertyValue('--accent').trim() || '#4f8cff', mut = cs.getPropertyValue('--muted').trim() || '#888';
      g.clearRect(0, 0, W, H); g.font = '20px sans-serif'; g.fillStyle = mut; g.strokeStyle = mut;
      if (vals.length < 2) { g.textAlign = 'center'; g.fillText('Add two full fill-ups to see the chart', W / 2, H / 2); return; }
      const lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi - lo) * 0.15 || 1, a = lo - pad, b = hi + pad, L = 56, R = 14, T = 14, B = 26;
      const X = i => L + (W - L - R) * i / (vals.length - 1), Y = v => T + (H - T - B) * (1 - (v - a) / (b - a));
      g.textAlign = 'right'; g.lineWidth = 1; g.globalAlpha = .5;
      for (let k = 0; k <= 3; k++) { const v = a + (b - a) * k / 3, y = Y(v); g.beginPath(); g.moveTo(L, y); g.lineTo(W - R, y); g.stroke(); g.globalAlpha = 1; g.fillText(v.toFixed(1), L - 6, y + 6); g.globalAlpha = .5; }
      g.globalAlpha = 1; g.strokeStyle = acc; g.fillStyle = acc; g.lineWidth = 3; g.beginPath();
      vals.forEach((v, i) => { if (i) g.lineTo(X(i), Y(v)); else g.moveTo(X(i), Y(v)); }); g.stroke();
      vals.forEach((v, i) => { g.beginPath(); g.arc(X(i), Y(v), 4, 0, 6.2832); g.fill(); });
    }
    function paint() {
      const f = fuelUnit(unit), c = fuelCompute(list), good = c.rows.filter(r => r.kmpl);
      $('#lo', el).textContent = 'Odometer (' + f.dist + ')'; $('#lq', el).textContent = 'Fuel (' + f.vol + ')';
      const avg = consShow(c.avgKmpl, unit), last = good.length ? consShow(good[good.length - 1].kmpl, unit) : null;
      $('#sm', el).innerHTML = avg ? `<div class="row"><div class="center"><div class="mid">${avg.toFixed(2)}</div><small class="muted">Average ${esc(f.label)}</small></div><div class="center"><div class="mid">${last.toFixed(2)}</div><small class="muted">Last fill-up</small></div><div class="center"><div class="mid">${c.costPerKm != null && c.totalCost > 0 ? (c.costPerKm * f.kmF).toFixed(3) : '--'}</div><small class="muted">Cost per ${esc(f.dist)}</small></div></div><div class="muted center" style="margin-top:8px;font-size:13px">${list.length} fill-ups, ${c.spent.toFixed(2)} spent in total</div>` : `<div class="center muted">${list.length ? 'Add another full fill-up to see consumption.' : 'No fill-ups yet. Add your first one above.'}</div>`;
      chart(good.map(r => consShow(r.kmpl, unit)));
      $('#ls', el).innerHTML = c.rows.slice().reverse().map(r => { const cs = consShow(r.kmpl, unit); return `<div class="item"><span class="grow"><b>${esc(r.d)}</b> ${r.full ? '' : '<small class="muted">(partial)</small>'}<br><small class="muted">${+(r.km / f.kmF).toFixed(1)} ${esc(f.dist)} &middot; ${+(r.l / f.lF).toFixed(2)} ${esc(f.vol)}${r.price ? ' &middot; ' + r.price.toFixed(2) : ''}</small></span><b>${cs ? cs.toFixed(2) : ''}</b><button class="btn alt" data-del="${esc(r.id)}" aria-label="Delete fill-up ${esc(r.d)}" style="min-width:44px">&times;</button></div>`; }).join('');
    }
    $('#un', el).onchange = (ev) => { unit = FUEL_UNITS[ev.target.value] ? ev.target.value : 'kmpl'; Store.set('life.fuel.unit', unit); paint(); };
    $('#ad', el).onclick = () => {
      const cn = fuelToCanon(unit, num('#fo') || 0, num('#fq') || 0), price = num('#fp');
      const e = { id: uid(), d: $('#fd', el).value, km: cn.km, l: cn.l, price: price == null ? 0 : price, full: $('#ff', el).checked };
      if (list.length >= FMAX) { msgTo(el, 'The log is full (' + FMAX + ' entries). Export and delete old ones.'); return; }
      const err = fuelCheck(list, e); if (err) { msgTo(el, err.replace(/\((\S+) km\)/, (m, v) => '(' + +(+v / fuelUnit(unit).kmF).toFixed(1) + ' ' + fuelUnit(unit).dist + ')')); return; }
      msgTo(el, ''); list.push(e); save(); $('#fq', el).value = ''; $('#fp', el).value = ''; paint(); toast('Added');
    };
    $('#ls', el).onclick = (ev) => { const b = ev.target.closest('[data-del]'); if (!b || !confirm('Delete this fill-up?')) return; list = list.filter(x => x.id !== b.dataset.del); save(); paint(); };
    $('#ex', el).onclick = async () => { if (!list.length) { toast('Nothing to export yet'); return; } await saveTextFile('fuel-log-' + today + '.csv', fuelCsv(list, unit), 'text/csv'); };
    paint();
  } });

  /* LOGIC-START */
  const NID_BASE = 800000, NID_COUNT = 10000, KM_PER_DAY = 40, VMAX = 10, SMAX = 30;
  function addMonthsKey(k, n) {
    const d = keyDate(k), day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); return dkey(d);
  }
  /* Urgency of one service item. Distance is turned into days at 40 km a day so date and odometer items sort together. */
  function serviceInfo(it, odo, today) {
    const days = keyOk(it.dd) ? keyDiff(today, it.dd) : null, km = it.dod > 0 && odo > 0 ? it.dod - odo : null;
    const eq = [days, km == null ? null : km / KM_PER_DAY].filter(x => x != null), score = eq.length ? Math.min(...eq) : Infinity;
    const hasDue = keyOk(it.dd) || it.dod > 0;
    const status = !hasDue ? 'none' : (days != null && days < 0) || (km != null && km < 0) ? 'overdue' : (days != null && days <= 14) || (km != null && km <= 500) ? 'soon' : 'ok';
    return { days, km, score, status, hasDue };
  }
  /* Every item of every vehicle, most urgent first; items with nothing due go last. */
  function serviceList(vehicles, today) {
    const out = [];
    for (const v of vehicles) for (const it of v.items || []) out.push({ v, it, info: serviceInfo(it, v.odo, today) });
    return out.sort((a, b) => (a.info.hasDue === b.info.hasDue ? 0 : a.info.hasDue ? -1 : 1) || (a.info.score === b.info.score ? 0 : a.info.score < b.info.score ? -1 : 1) || String(a.it.n).localeCompare(String(b.it.n)));
  }
  /* Defaults offered when an item is marked done: repeat months from the done date, repeat distance from the odometer. */
  function serviceNext(it, doneKey, odo) {
    return { dd: it.em > 0 ? addMonthsKey(doneKey, it.em) : '', dod: it.ek > 0 && odo > 0 ? Math.round(odo + it.ek) : '' };
  }
  const freeNid = (used) => { const s = new Set(used); for (let i = 0; i < NID_COUNT; i++) if (!s.has(NID_BASE + i)) return NID_BASE + i; return -1; };
  const dueAt9 = (k) => { const d = keyDate(k); d.setHours(9, 0, 0, 0); return d; };
  /* One notification per item due date at 9:00, only for dates still ahead. */
  function serviceNotifyPlan(vehicles, now) {
    const out = [];
    for (const v of vehicles) for (const it of v.items || []) {
      if (!keyOk(it.dd) || !(it.nid >= NID_BASE && it.nid < NID_BASE + NID_COUNT)) continue;
      const at = dueAt9(it.dd); if (at.getTime() <= now) continue;
      out.push({ id: it.nid, at: at.getTime(), title: 'Service due: ' + it.n, body: v.n + ' is due for ' + it.n + ' today.' });
    }
    return out;
  }
  const dueText = (info) => {
    const p = [];
    if (info.days != null) p.push(info.days < 0 ? -info.days + (info.days === -1 ? ' day' : ' days') + ' overdue' : info.days === 0 ? 'due today' : 'in ' + info.days + (info.days === 1 ? ' day' : ' days'));
    if (info.km != null) p.push(info.km < 0 ? Math.round(-info.km) + ' km over' : Math.round(info.km) + ' km to go');
    return p.join(', ') || (info.hasDue ? 'set the odometer to see the distance' : 'nothing due');
  };
  Object.assign(LG, { addMonthsKey, serviceInfo, serviceList, serviceNext, freeNid, serviceNotifyPlan, dueText, NID_BASE, NID_COUNT });
  /* LOGIC-END */

  /* ====================== 6. Vehicle Service ====================== */
  Tools.register({ id: 'vehicleservice', name: 'Vehicle Service', icon: '🔧', cat: 'daily', desc: 'Keep service items such as oil, tyres, insurance and pollution check for each vehicle with a due date or odometer, see the most urgent first, mark done and reschedule, and get an optional 9:00 reminder.', keys: ['car', 'bike', 'maintenance', 'oil', 'insurance', 'puc', 'reminder', 'tyres'], needs: ['storage', 'notifications'], render(el) {
    const LNP = () => (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications) || null;
    let veh = Store.arr('life.veh').filter(v => v && typeof v.id === 'string' && typeof v.n === 'string').map(v => ({ id: v.id, n: v.n.slice(0, 40), odo: v.odo > 0 ? +v.odo : 0, items: (Array.isArray(v.items) ? v.items : []).filter(i => i && typeof i.id === 'string' && typeof i.n === 'string').slice(0, SMAX).map(i => ({ id: i.id, n: i.n.slice(0, 40), dd: keyOk(i.dd) ? i.dd : '', dod: i.dod > 0 ? +i.dod : 0, em: i.em > 0 ? +i.em : 0, ek: i.ek > 0 ? +i.ek : 0, nid: i.nid, last: keyOk(i.last) ? i.last : '' })) })).slice(0, VMAX);
    let sel = veh[0] ? veh[0].id : '', notify = !!Store.get('life.veh.notify', false), doneFor = null, gone = false;
    const save = () => Store.set('life.veh', veh), today = dkey();
    el.innerHTML = `<div class="card"><div class="chips" id="vc" style="padding:0 0 6px"></div>
        <div class="row" style="align-items:flex-end"><label class="f">New vehicle<input id="vn" type="text" maxlength="40" placeholder="Honda City"></label><button class="btn alt" id="va" style="flex:none">Add vehicle</button></div>
        <div id="vo" hidden><div class="row" style="align-items:flex-end"><label class="f">Current odometer (km)<input id="od" type="number" inputmode="decimal" min="0" max="9999999" step="1"></label><button class="btn alt" id="os" style="flex:none">Update</button></div>
        <button class="btn danger" id="vd" style="width:100%;margin-top:8px">Delete this vehicle</button></div>
        <div class="lmsg" role="alert" hidden style="color:var(--danger);font-size:13px;margin:6px 0"></div></div>
      <div class="card" id="af" hidden><b>Add a service item</b>
        <label class="f">Item<input id="in" type="text" maxlength="40" list="svn" placeholder="Oil change"><datalist id="svn"><option value="Oil change"><option value="Tyres"><option value="Insurance"><option value="Pollution check"><option value="Battery"><option value="Brake pads"><option value="General service"></datalist></label>
        <div class="row"><label class="f">Due date<input id="id" type="date" min="2000-01-01" max="2100-12-31"></label><label class="f">Due at km<input id="ik" type="number" inputmode="decimal" min="0" max="9999999" step="1"></label></div>
        <div class="row"><label class="f">Repeat (months)<input id="im" type="number" inputmode="numeric" min="0" max="120" step="1" placeholder="optional"></label><label class="f">Repeat (km)<input id="ie" type="number" inputmode="numeric" min="0" max="500000" step="1" placeholder="optional"></label></div>
        <button class="btn" id="ia" style="width:100%;margin-top:8px">Add item</button></div>
      <div class="card" id="dn" hidden></div><div class="list" id="ls"></div>
      <label class="item" style="margin-top:10px;min-height:48px"><input type="checkbox" id="nt"><span class="grow">Remind me at 9:00 on the due date</span></label>
      <div class="muted" id="nm" style="${NOTE};margin-top:6px"></div>`;
    const cur = () => veh.find(v => v.id === sel) || null;
    const allNids = () => veh.flatMap(v => v.items.map(i => i.nid)).filter(n => n >= NID_BASE);
    async function sync() {
      const ln = LNP(); if (!ln) return;
      try {
        const ids = allNids(); if (ids.length) await ln.cancel({ notifications: ids.map(id => ({ id })) });
        if (notify) { const plan = serviceNotifyPlan(veh, Date.now()); if (plan.length) await ln.schedule({ notifications: plan.map(p => ({ id: p.id, title: p.title, body: p.body, schedule: { at: new Date(p.at), allowWhileIdle: true } })) }); }
      } catch (e) { /* the plugin may refuse; the list still works */ }
    }
    const cancelIds = (ids) => { const ln = LNP(); if (ln && ids.length) { try { Promise.resolve(ln.cancel({ notifications: ids.map(id => ({ id })) })).catch(() => {}); } catch (e) { /* ignore */ } } };
    function paint() {
      $('#vc', el).innerHTML = veh.length ? veh.map(v => `<button class="chip${v.id === sel ? ' on' : ''}" data-v="${esc(v.id)}">${esc(v.n)}</button>`).join('') : '<span class="muted">Add a vehicle to start.</span>';
      const v = cur(); $('#vo', el).hidden = !v; $('#af', el).hidden = !v; if (v) $('#od', el).value = v.odo || '';
      const rows = serviceList(veh, today), col = { overdue: 'var(--danger)', soon: '#f59e0b', ok: 'var(--ok)', none: 'var(--muted)' };
      $('#ls', el).innerHTML = rows.length ? rows.map(r => `<div class="item" style="flex-wrap:wrap"><span class="grow"><b>${esc(r.it.n)}</b> <small class="muted">${esc(r.v.n)}</small><br><small style="color:${col[r.info.status]}">${esc(dueText(r.info))}</small>${r.it.dd ? `<small class="muted"> &middot; ${esc(r.it.dd)}</small>` : ''}${r.it.dod ? `<small class="muted"> &middot; ${r.it.dod} km</small>` : ''}${r.it.last ? `<br><small class="muted">Last done ${esc(r.it.last)}</small>` : ''}</span><button class="btn alt" data-done="${esc(r.it.id)}" style="min-width:64px">Done</button><button class="btn alt" data-del="${esc(r.it.id)}" aria-label="Delete ${esc(r.it.n)}" style="min-width:44px">&times;</button></div>`).join('') : '<div class="center muted" style="padding:20px">No service items yet.</div>';
      $('#nt', el).checked = notify;
      $('#nm', el).textContent = LNP() ? 'Reminders are scheduled with Android, one per due date at 9:00. They may arrive a few minutes late when the phone is idle.' : 'This browser cannot schedule reminders. The Android app can; the list works everywhere.';
    }
    function openDone(id) {
      const v = veh.find(x => x.items.some(i => i.id === id)), it = v && v.items.find(i => i.id === id), box = $('#dn', el); if (!it) return;
      doneFor = { v, it }; const nx = serviceNext(it, today, v.odo);
      box.hidden = false; box.innerHTML = `<b>${esc(it.n)}</b> done today. Next time:
        <div class="row"><label class="f">Next due date<input id="nd" type="date" min="2000-01-01" max="2100-12-31" value="${esc(nx.dd)}"></label><label class="f">Next due km<input id="nk" type="number" inputmode="decimal" min="0" max="9999999" step="1" value="${esc(nx.dod)}"></label></div>
        <div class="row" style="margin-top:8px"><button class="btn" id="ds">Save</button><button class="btn alt" id="dc">Cancel</button></div>`;
      $('#dc', el).onclick = () => { box.hidden = true; doneFor = null; };
      $('#ds', el).onclick = () => {
        const d = $('#nd', el).value, k = Valid.num($('#nk', el).value);
        it.last = today; it.dd = keyOk(d) ? d : ''; it.dod = k > 0 ? Math.min(9999999, k) : 0; save(); box.hidden = true; doneFor = null; paint(); sync(); toast('Marked done');
      };
      box.scrollIntoView && box.scrollIntoView({ block: 'nearest' });
    }
    $('#vc', el).onclick = (ev) => { const b = ev.target.closest('[data-v]'); if (b) { sel = b.dataset.v; paint(); } };
    $('#va', el).onclick = () => {
      const n = $('#vn', el).value.trim().slice(0, 40); if (!n) { msgTo(el, 'Name the vehicle first.'); return; }
      if (veh.length >= VMAX) { msgTo(el, 'Up to ' + VMAX + ' vehicles.'); return; }
      msgTo(el, ''); const v = { id: uid(), n, odo: 0, items: [] }; veh.push(v); sel = v.id; save(); $('#vn', el).value = ''; paint();
    };
    $('#os', el).onclick = () => { const v = cur(), n = Valid.num($('#od', el).value); if (!v) return; if (n == null || n < 0 || n > 9999999) { msgTo(el, 'Enter the odometer in km.'); return; } msgTo(el, ''); v.odo = n; save(); paint(); toast('Odometer updated'); };
    $('#vd', el).onclick = () => { const v = cur(); if (!v || !confirm('Delete this vehicle and its items?')) return; cancelIds(v.items.map(i => i.nid).filter(n => n >= NID_BASE)); veh = veh.filter(x => x !== v); sel = veh[0] ? veh[0].id : ''; save(); paint(); };
    $('#ia', el).onclick = () => {
      const v = cur(); if (!v) return; const n = $('#in', el).value.trim().slice(0, 40);
      if (!n) { msgTo(el, 'Name the service item.'); return; }
      if (v.items.length >= SMAX) { msgTo(el, 'Up to ' + SMAX + ' items per vehicle.'); return; }
      const dd = $('#id', el).value, dod = Valid.num($('#ik', el).value), em = Valid.num($('#im', el).value), ek = Valid.num($('#ie', el).value);
      if (!keyOk(dd) && !(dod > 0)) { msgTo(el, 'Set a due date or a due odometer.'); return; }
      const nid = freeNid(allNids());
      msgTo(el, ''); v.items.push({ id: uid(), n, dd: keyOk(dd) ? dd : '', dod: dod > 0 ? Math.min(9999999, dod) : 0, em: em > 0 ? Math.min(120, Math.round(em)) : 0, ek: ek > 0 ? Math.min(500000, Math.round(ek)) : 0, nid, last: '' });
      save(); ['#in', '#id', '#ik', '#im', '#ie'].forEach(s => { $(s, el).value = ''; }); paint(); sync();
    };
    $('#ls', el).onclick = (ev) => {
      const d = ev.target.closest('[data-done]'), x = ev.target.closest('[data-del]');
      if (d) openDone(d.dataset.done);
      if (x && confirm('Delete this item?')) { for (const v of veh) { const it = v.items.find(i => i.id === x.dataset.del); if (it) { if (it.nid >= NID_BASE) cancelIds([it.nid]); v.items = v.items.filter(i => i !== it); } } save(); paint(); }
    };
    $('#nt', el).onchange = async (ev) => {
      if (!ev.target.checked) { notify = false; Store.set('life.veh.notify', false); sync(); return; }
      const ln = LNP();
      if (ln) {
        let ok = false; try { const p = await ln.requestPermissions(); ok = p && p.display === 'granted'; } catch (e) { ok = false; }
        if (gone) return;
        if (!ok) { notify = false; ev.target.checked = false; toast('Notifications are blocked: reminders are off. Allow them in Android settings.'); return; }
        toast('Reminders are set for upcoming due dates');
      } else toast('This browser cannot show reminders; they work in the Android app');
      notify = true; Store.set('life.veh.notify', true); sync();
    };
    paint(); if (notify) sync();
    return () => { gone = true; };
  } });

  /* LOGIC-START */
  const TRIP_MAX = 20;
  function geoDist(a, b) {
    const R = 6371000, r = Math.PI / 180, dLa = (b.latitude - a.latitude) * r, dLo = (b.longitude - a.longitude) * r;
    const x = Math.sin(dLa / 2) ** 2 + Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
  }
  const tripNew = () => ({ last: null, hist: [], d: 0, max: 0 });
  /* One GPS fix c = {latitude, longitude, accuracy, speed}, time t in ms. Same rules as the Speedometer: only fixes better than 30 m
     count, and distance only grows once we moved further than the noise (max 3 m, half the accuracy) from the last counted point.
     Returns the current speed in km/h. */
  function tripFix(st, c, t) {
    if (!c || !isFinite(c.latitude) || !isFinite(c.longitude)) return 0;
    const good = c.accuracy != null && c.accuracy < 30;
    if (good) {
      if (!st.last) st.last = c;
      else { const s = geoDist(st.last, c), thr = Math.max(3, c.accuracy * 0.5); if (s > thr) { st.d += s; st.last = c; } }
    }
    let v = 0;
    if (c.speed != null && isFinite(c.speed) && c.speed >= 0) v = c.speed * 3.6;
    else if (good && st.hist.length) {
      let ref = st.hist[0];
      for (let i = st.hist.length - 1; i >= 0; i--) if (t - st.hist[i].t >= 3000) { ref = st.hist[i]; break; }
      const dt = (t - ref.t) / 1000, s = geoDist(ref.c, c);
      if (dt > 0.3 && s > Math.max(3, c.accuracy * 0.5)) v = s / dt * 3.6;
    }
    if (good) { st.hist.push({ c, t }); while (st.hist.length && t - st.hist[0].t > 8000) st.hist.shift(); }
    if (v < 1 || !isFinite(v)) v = 0;
    if (v > 400) v = 0; // a GPS glitch, not a speed
    if (v > st.max) st.max = v;
    return v;
  }
  const fmtDur = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600); return (h ? h + ':' : '') + pd2(Math.floor(s % 3600 / 60)) + ':' + pd2(s % 60); };
  const avgKmh = (distM, ms) => ms > 1000 ? distM / 1000 / (ms / 3600000) : 0;
  const tripUnit = (u) => u === 'mi' ? { n: 'mi', f: 1609.344, sp: 'mph' } : { n: 'km', f: 1000, sp: 'km/h' };
  /* Lap rows from cumulative marks [{d, ms}]. */
  const tripLaps = (marks) => marks.map((m, i) => ({ n: i + 1, d: m.d - (i ? marks[i - 1].d : 0), ms: m.ms - (i ? marks[i - 1].ms : 0) }));
  Object.assign(LG, { geoDist, tripNew, tripFix, fmtDur, avgKmh, tripUnit, tripLaps, TRIP_MAX });
  /* LOGIC-END */

  /* ====================== 7. Trip Odometer ====================== */
  Tools.register({ id: 'tripodometer', name: 'Trip Odometer', icon: '🛣️', cat: 'daily', desc: 'Measure a trip with GPS: distance, time, average and top speed, pause and resume, laps, with the screen kept awake. Works in the foreground only. Saves your last 20 trips.', keys: ['gps', 'distance', 'drive', 'ride', 'walk', 'run', 'speed', 'lap', 'trip meter'], needs: ['location', 'storage'], render(el) {
    let unit = Store.get('life.trip.unit', 'km') === 'mi' ? 'mi' : 'km', state = 'idle', st = tripNew(), acc = 0, t0 = 0, marks = [], watch = null, timer = 0, lock = null, speed = 0, gone = false;
    let trips = Store.arr('life.trips').filter(x => x && typeof x.id === 'string' && x.d >= 0 && x.ms >= 0).map(x => ({ id: x.id, at: +x.at || 0, d: +x.d, ms: +x.ms, max: +x.max > 0 ? +x.max : 0, laps: +x.laps > 0 ? +x.laps : 0 })).slice(0, TRIP_MAX);
    el.innerHTML = `<div class="card center"><div class="big" id="di" aria-live="polite">0.00</div><div class="muted" id="du">km</div>
        <div class="row" style="margin-top:10px"><div><div class="mid" id="tm">00:00</div><small class="muted">Time</small></div><div><div class="mid" id="sp">0</div><small class="muted" id="spu">km/h</small></div></div>
        <div class="row" style="margin-top:10px"><div><div class="mid" id="av">0.0</div><small class="muted">Average</small></div><div><div class="mid" id="mx">0</div><small class="muted">Top speed</small></div></div>
        <div class="muted" id="msg" role="status" style="margin-top:8px;min-height:20px"></div></div>
      <div class="row"><button class="btn" id="go">Start</button><button class="btn alt" id="lp" disabled>Lap</button></div>
      <div class="row" style="margin-top:8px"><button class="btn alt" id="sv" disabled>Stop and save</button><button class="btn alt" id="rs">Reset</button></div>
      <div class="list" id="lps" style="margin-top:10px"></div>
      <label class="f" style="margin-top:10px">Units<select id="un"><option value="km">km, km/h</option><option value="mi">miles, mph</option></select></label>
      <div class="muted" style="${NOTE}">Foreground only: keep PocketKit open and the screen on while the trip is running. The screen is kept awake for you. Weak GPS (worse than 30 m) is ignored.</div>
      <div style="font-weight:700;margin:14px 4px 6px">Saved trips</div><div class="list" id="tr"></div>`;
    $('#un', el).value = unit;
    const U = () => tripUnit(unit), elapsed = () => acc + (state === 'running' ? Date.now() - t0 : 0);
    async function wake(on) {
      try {
        if (on) { if (navigator.wakeLock && !lock && !document.hidden) { const l = await navigator.wakeLock.request('screen'); if (state !== 'running' || gone) l.release().catch(() => {}); else lock = l; } }
        else if (lock) { const l = lock; lock = null; l.release().catch(() => {}); }
      } catch (e) { /* not supported or denied */ }
    }
    const vis = () => { if (state === 'running' && !document.hidden) wake(true); };
    document.addEventListener('visibilitychange', vis);
    function show() {
      const u = U(), ms = elapsed();
      $('#di', el).textContent = (st.d / u.f).toFixed(2); $('#du', el).textContent = u.n; $('#spu', el).textContent = u.sp;
      $('#tm', el).textContent = fmtDur(ms); $('#sp', el).textContent = Math.round(speed * 1000 / u.f);
      $('#av', el).textContent = (avgKmh(st.d, ms) * 1000 / u.f).toFixed(1); $('#mx', el).textContent = Math.round(st.max * 1000 / u.f);
      $('#go', el).textContent = state === 'idle' ? 'Start' : state === 'running' ? 'Pause' : 'Resume';
      $('#lp', el).disabled = state !== 'running'; $('#sv', el).disabled = state === 'idle' || (st.d === 0 && ms < 1000);
    }
    function showLaps() {
      const u = U(), laps = tripLaps(marks);
      $('#lps', el).innerHTML = laps.slice().reverse().map(l => `<div class="item"><b>Lap ${l.n}</b><span class="grow muted">${fmtDur(l.ms)}</span><b>${(l.d / u.f).toFixed(2)} ${u.n}</b></div>`).join('');
    }
    function showTrips() {
      const u = U();
      $('#tr', el).innerHTML = trips.length ? trips.map(x => `<div class="item"><span class="grow"><b>${esc(new Date(x.at).toLocaleString())}</b><br><small class="muted">${(x.d / u.f).toFixed(2)} ${u.n} &middot; ${fmtDur(x.ms)} &middot; avg ${(avgKmh(x.d, x.ms) * 1000 / u.f).toFixed(1)} ${u.sp} &middot; top ${Math.round(x.max * 1000 / u.f)} ${u.sp}${x.laps ? ' &middot; ' + x.laps + ' laps' : ''}</small></span><button class="btn alt" data-del="${esc(x.id)}" aria-label="Delete trip" style="min-width:44px">&times;</button></div>`).join('') : '<div class="muted center" style="padding:12px">No saved trips yet.</div>';
    }
    const setMsg = (t) => { $('#msg', el).textContent = t || ''; };
    function onPos(p) {
      if (state !== 'running') return; const c = p.coords; if (!c) return;
      speed = tripFix(st, c, p.timestamp || Date.now());
      setMsg(c.accuracy != null && c.accuracy >= 30 ? 'Weak GPS signal (' + Math.round(c.accuracy) + ' m): distance paused' : ''); show();
    }
    function onErr(e) {
      setMsg(e && e.code === 1 ? 'Location permission denied. Allow location for PocketKit in Settings.' : e && e.code === 2 ? 'Location unavailable. Check that GPS is on.' : e && e.code === 3 ? 'Timed out waiting for GPS. Still trying...' : 'Waiting for GPS...');
    }
    function startGps() {
      if (watch != null) return;
      if (!navigator.geolocation) { setMsg('This device has no location support.'); return; }
      try { watch = navigator.geolocation.watchPosition(onPos, onErr, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }); } catch (e) { setMsg('Could not start GPS.'); }
    }
    function stopGps() { if (watch != null && navigator.geolocation) { try { navigator.geolocation.clearWatch(watch); } catch (e) { /* ignore */ } } watch = null; }
    function begin() { state = 'running'; t0 = Date.now(); st.last = null; st.hist = []; setMsg('Waiting for GPS...'); startGps(); wake(true); if (!timer) timer = setInterval(show, 500); show(); }
    function pause() { acc = elapsed(); state = 'paused'; speed = 0; stopGps(); wake(false); setMsg('Paused'); show(); }
    function reset() { state = 'idle'; st = tripNew(); acc = 0; marks = []; speed = 0; stopGps(); wake(false); clearInterval(timer); timer = 0; setMsg(''); show(); showLaps(); }
    $('#go', el).onclick = () => { if (state === 'running') pause(); else begin(); };
    $('#lp', el).onclick = () => { marks.push({ d: st.d, ms: elapsed() }); showLaps(); };
    $('#rs', el).onclick = () => { if ((state !== 'idle') && (st.d > 0 || elapsed() > 2000) && !confirm('Reset the trip without saving?')) return; reset(); };
    $('#sv', el).onclick = () => {
      const ms = elapsed(); if (st.d === 0 && ms < 1000) { toast('Nothing to save yet'); return; }
      trips.unshift({ id: uid(), at: Date.now(), d: Math.round(st.d), ms: Math.round(ms), max: Math.round(st.max * 10) / 10, laps: marks.length });
      trips = trips.slice(0, TRIP_MAX); Store.set('life.trips', trips); reset(); showTrips(); toast('Trip saved');
    };
    $('#tr', el).onclick = (ev) => { const b = ev.target.closest('[data-del]'); if (!b || !confirm('Delete this trip?')) return; trips = trips.filter(x => x.id !== b.dataset.del); Store.set('life.trips', trips); showTrips(); };
    $('#un', el).onchange = (ev) => { unit = ev.target.value === 'mi' ? 'mi' : 'km'; Store.set('life.trip.unit', unit); show(); showLaps(); showTrips(); };
    show(); showTrips();
    return () => { gone = true; state = 'idle'; stopGps(); clearInterval(timer); document.removeEventListener('visibilitychange', vis); if (lock) { lock.release().catch(() => {}); lock = null; } };
  } });

  /* LOGIC-START */
  /* Monthly instalment of a standard EMI loan; rate is the yearly percentage, n the number of months. 0% is simply P / n. */
  function emiOf(P, rate, n) {
    const i = rate / 1200; if (!(P > 0) || !(n > 0)) return 0;
    if (i === 0) return P / n;
    const g = Math.pow(1 + i, n); return P * i * g / (g - 1);
  }
  /* Runs the loan month by month. extra is added to every instalment; lump is paid at the end of month lumpAt. The last instalment
     is trimmed to what is left. Returns months taken, total interest and total paid (rows only when asked, for the table). */
  function loanRun(P, rate, n, extra, lump, lumpAt, wantRows) {
    const i = rate / 1200, emi = emiOf(P, rate, n), pay = emi + Math.max(0, extra || 0), rows = [];
    let bal = P, interest = 0, paid = 0, m = 0;
    while (bal > 0.005 && m < 1200) {
      m++;
      const it = bal * i; let p = Math.min(pay, bal + it); const prin = p - it;
      interest += it; paid += p; bal -= prin;
      if (lump > 0 && m === lumpAt && bal > 0) { const l = Math.min(lump, bal); bal -= l; paid += l; p += l; }
      if (bal < 0.005) bal = 0;
      if (wantRows) rows.push({ m, pay: p, interest: it, bal });
    }
    return { emi, months: m, interest, paid, rows, capped: bal > 0.005 };
  }
  function prepayCompare(P, rate, n, extra, lump, lumpAt) {
    const base = loanRun(P, rate, n, 0, 0, 0), plan = loanRun(P, rate, n, extra, lump, lumpAt);
    return { base, plan, monthsSaved: base.months - plan.months, interestSaved: base.interest - plan.interest };
  }
  const monthsText = (m) => { const y = Math.floor(m / 12), r = m % 12; return (y ? y + (y === 1 ? ' year' : ' years') : '') + (y && r ? ' ' : '') + (r || !y ? r + (r === 1 ? ' month' : ' months') : ''); };
  Object.assign(LG, { emiOf, loanRun, prepayCompare, monthsText });
  /* LOGIC-END */

  /* ====================== 8. Loan Prepayment ====================== */
  Tools.register({ id: 'prepay', name: 'Loan Prepayment', icon: '💳', cat: 'calculate', desc: 'See what an extra monthly payment or a one-time lump sum does to an EMI loan: the new tenure, the interest saved and a table with and without prepayment.', keys: ['emi', 'loan', 'prepayment', 'part payment', 'mortgage', 'interest', 'foreclose', 'extra payment'], needs: [], render(el) {
    el.innerHTML = `<div class="card"><label class="f">Loan amount<input id="p" type="number" inputmode="decimal" min="1" max="10000000000" step="any" value="1000000"></label>
        <div class="row"><label class="f">Interest (% a year)<input id="r" type="number" inputmode="decimal" min="0" max="60" step="any" value="9"></label><label class="f">Tenure (years)<input id="y" type="number" inputmode="decimal" min="0.25" max="50" step="any" value="20"></label></div>
        <div class="row"><label class="f">Extra every month<input id="x" type="number" inputmode="decimal" min="0" max="1000000000" step="any" value="5000"></label><label class="f">One-time lump sum<input id="l" type="number" inputmode="decimal" min="0" max="10000000000" step="any" value="0"></label></div>
        <label class="f">Lump sum paid in month number<input id="lm" type="number" inputmode="numeric" min="1" max="600" step="1" value="12"></label></div>
      <div class="card" id="out" aria-live="polite"></div>
      <button class="btn alt" id="sv" style="width:100%">Save result to history</button>
      <div class="muted" style="${NOTE};margin-top:8px">Assumes a fixed rate, monthly instalments and no prepayment charges. Check your lender's terms; many lenders charge a fee or apply the extra differently.</div>`;
    let last = null;
    const f = (n) => Math.round(n).toLocaleString();
    function calc() {
      const P = Valid.num($('#p', el).value), r = Valid.num($('#r', el).value), y = Valid.num($('#y', el).value), x = Valid.num($('#x', el).value) || 0, l = Valid.num($('#l', el).value) || 0;
      const out = $('#out', el); last = null;
      if (!(P > 0) || r == null || r < 0 || r > 60 || !(y >= 0.25) || y > 50 || x < 0 || l < 0) { out.innerHTML = '<div class="center muted">Enter the loan amount, rate and tenure.</div>'; return; }
      const n = Math.max(1, Math.round(y * 12)), at = Math.min(n, Math.max(1, Math.round(Valid.num($('#lm', el).value) || 1))), lump = Math.min(l, P);
      const c = prepayCompare(P, r, n, x, lump, at), b = c.base, p = c.plan;
      if (b.capped || p.capped) { out.innerHTML = '<div class="center muted">That loan does not finish within 100 years. Check the numbers.</div>'; return; }
      last = { label: `${f(P)} at ${r}% for ${monthsText(n)}${x ? ', +' + f(x) + '/month' : ''}${lump ? ', lump ' + f(lump) + ' in month ' + at : ''}`, value: `Tenure ${monthsText(p.months)}, interest saved ${f(c.interestSaved)}` };
      const row = (k, a, z) => `<tr><td style="padding:4px 0">${k}</td><td style="text-align:right">${a}</td><td style="text-align:right"><b>${z}</b></td></tr>`;
      out.innerHTML = `<div class="center"><div class="muted">Interest saved</div><div class="big" style="color:var(--ok)">${f(c.interestSaved)}</div><div class="muted">${c.monthsSaved > 0 ? 'You finish ' + esc(monthsText(c.monthsSaved)) + ' earlier' : 'No time saved yet. Add an extra payment or lump sum.'}</div></div>
        <table style="width:100%;margin-top:12px;border-collapse:collapse;font-size:14px"><thead><tr class="muted"><th style="text-align:left"></th><th style="text-align:right">Without</th><th style="text-align:right">With</th></tr></thead><tbody>
        ${row('Monthly payment', f(b.emi), f(b.emi + x))}${row('Tenure', esc(monthsText(b.months)), esc(monthsText(p.months)))}${row('Total interest', f(b.interest), f(p.interest))}${row('Total paid', f(b.paid), f(p.paid))}</tbody></table>`;
    }
    el.addEventListener('input', calc); calc();
    $('#sv', el).onclick = () => { if (!last) { toast('Enter valid numbers first'); return; } if (typeof Hist !== 'undefined') Hist.add('prepay', last.label, last.value); toast('Saved to history'); };
  } });

  /* LOGIC-START */
  const FIRE_MAX_YEARS = 80;
  /* Works in today's money: savings grow at the real return g = (1 + return) / (1 + inflation) - 1 and the yearly saving (12 x monthly,
     added at the end of each year) keeps its buying power. Target = yearly spending / withdrawal rate.
     Closed form for the balance after t years: S(1+g)^t + A((1+g)^t - 1)/g, which gives the years to reach the target. */
  function fireProject(S, monthly, ret, infl, spend, wr) {
    const g = (1 + ret / 100) / (1 + infl / 100) - 1, A = 12 * monthly, T = spend / (wr / 100);
    let years = null;
    if (S >= T) years = 0;
    else if (Math.abs(g) < 1e-12) { if (A > 0) years = (T - S) / A; }
    else {
      const num = T * g + A, den = S * g + A;
      if (den > 0 && num > 0) { const t = Math.log(num / den) / Math.log(1 + g); if (isFinite(t) && t >= 0) years = t; }
    }
    if (years != null && years > FIRE_MAX_YEARS) years = null;
    const rows = []; let bal = S;
    const last = years == null ? FIRE_MAX_YEARS : Math.ceil(years);
    for (let y = 1; y <= last; y++) { bal = bal * (1 + g) + A; rows.push({ year: y, real: bal, nominal: bal * Math.pow(1 + infl / 100, y), pct: T > 0 ? bal / T : 0 }); }
    return { g, A, target: T, years, rows };
  }
  const yearsText = (y) => { const m = Math.ceil(y * 12 - 1e-9), yy = Math.floor(m / 12), mm = m % 12; return y <= 0 ? 'now' : (yy ? yy + (yy === 1 ? ' year' : ' years') : '') + (yy && mm ? ' ' : '') + (mm ? mm + (mm === 1 ? ' month' : ' months') : ''); };
  Object.assign(LG, { fireProject, yearsText, FIRE_MAX_YEARS });
  /* LOGIC-END */

  /* ====================== 9. FIRE Calculator ====================== */
  Tools.register({ id: 'fire', name: 'FIRE Calculator', icon: '🏖️', cat: 'calculate', desc: 'Estimate how many years until financial independence from your savings, monthly saving, expected return, inflation and withdrawal rate, with a year-by-year table. An illustration, not advice.', keys: ['financial independence', 'retire early', 'retirement', 'savings', 'withdrawal', '4 percent', 'invest'], needs: [], render(el) {
    el.innerHTML = `<div class="card"><label class="f">Savings today<input id="s" type="number" inputmode="decimal" min="0" max="10000000000" step="any" value="500000"></label>
        <div class="row"><label class="f">Saving each month<input id="m" type="number" inputmode="decimal" min="0" max="100000000" step="any" value="30000"></label><label class="f">Yearly spending (today's money)<input id="e" type="number" inputmode="decimal" min="1" max="1000000000" step="any" value="600000"></label></div>
        <div class="row"><label class="f">Expected return (% a year)<input id="r" type="number" inputmode="decimal" min="-10" max="30" step="any" value="10"></label><label class="f">Inflation (% a year)<input id="i" type="number" inputmode="decimal" min="-5" max="30" step="any" value="5"></label></div>
        <label class="f">Withdrawal rate (% of the pot a year)<input id="w" type="number" inputmode="decimal" min="0.5" max="15" step="any" value="4"></label></div>
      <div class="card" id="out" aria-live="polite"></div><div class="card" id="tb" hidden style="overflow-x:auto"></div>
      <button class="btn alt" id="sv" style="width:100%">Save result to history</button>
      <div class="card" style="${NOTE}"><b>An illustration, not advice.</b> Real markets are uneven and nobody knows future returns, inflation or tax. This uses one steady return, yearly steps, savings that keep their buying power and a fixed withdrawal rate. Talk to a qualified adviser before making money decisions.</div>`;
    let last = null;
    const f = (n) => Math.round(n).toLocaleString();
    function calc() {
      const v = id => Valid.num($(id, el).value), S = v('#s'), m = v('#m') || 0, E = v('#e'), r = v('#r'), i = v('#i'), w = v('#w'), out = $('#out', el), tb = $('#tb', el);
      last = null; tb.hidden = true;
      if (S == null || S < 0 || m < 0 || !(E > 0) || r == null || i == null || r < -10 || r > 30 || i < -5 || i > 30 || !(w >= 0.5) || w > 15) { out.innerHTML = '<div class="center muted">Fill in every field with sensible numbers.</div>'; return; }
      const p = fireProject(S, m, r, i, E, w);
      if (p.years == null) { out.innerHTML = `<div class="center"><div class="mid">Not within ${FIRE_MAX_YEARS} years</div><div class="muted">Target pot ${f(p.target)}. Try saving more, spending less or a higher return.</div></div>`; return; }
      last = { label: `Save ${f(m)}/month, ${f(S)} now, ${r}% return, ${i}% inflation, ${w}% withdrawal`, value: p.years === 0 ? 'Already at the target' : 'About ' + yearsText(p.years) + ' to ' + f(p.target) };
      out.innerHTML = `<div class="center"><div class="muted">Financial independence in about</div><div class="big">${p.years === 0 ? 'Already there' : esc(yearsText(p.years))}</div><div class="muted">Target pot ${f(p.target)} in today's money, supporting ${f(E)} a year at a ${w}% withdrawal rate. Real return ${(p.g * 100).toFixed(2)}% a year.</div></div>`;
      tb.hidden = !p.rows.length;
      tb.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr class="muted"><th style="text-align:left">Year</th><th style="text-align:right">Today's money</th><th style="text-align:right">Future money</th><th style="text-align:right">Of target</th></tr></thead><tbody>${p.rows.map(x => `<tr><td style="padding:3px 0">${x.year}</td><td style="text-align:right">${f(x.real)}</td><td style="text-align:right">${f(x.nominal)}</td><td style="text-align:right">${Math.min(999, Math.round(x.pct * 100))}%</td></tr>`).join('')}</tbody></table>`;
    }
    el.addEventListener('input', calc); calc();
    $('#sv', el).onclick = () => { if (!last) { toast('Enter valid numbers first'); return; } if (typeof Hist !== 'undefined') Hist.add('fire', last.label, last.value); toast('Saved to history'); };
  } });

  /* LOGIC-START */
  /* Splits a whole number of cents between weights (whole numbers) so the parts add up to the total exactly: each part gets its
     proportional floor, then the leftover cents go to the largest fractional remainders (earlier index wins a tie). BigInt keeps it exact. */
  function apportion(total, weights) {
    const out = weights.map(() => 0), n = weights.length; total = Math.round(total);
    if (!n || !(total > 0)) return out;
    const W = weights.map(w => BigInt(Math.max(0, Math.round(w)))), sum = W.reduce((a, b) => a + b, 0n), T = BigInt(total);
    if (sum === 0n) return out;
    const parts = W.map((w, i) => ({ i, q: (T * w) / sum, r: (T * w) % sum }));
    let left = Number(T - parts.reduce((a, p) => a + p.q, 0n));
    parts.slice().sort((a, b) => (a.r === b.r ? a.i - b.i : a.r > b.r ? -1 : 1)).forEach(p => { if (left > 0 && W[p.i] > 0n) { p.q += 1n; left--; } });
    parts.forEach(p => { out[p.i] = Number(p.q); });
    return out;
  }
  const toCents = (v) => Math.round(v * 100);
  /* people: ids; items: [{price (cents), who: [ids]}]. Tax and tip are percentages of the shared items and are split in proportion to
     what each person owes. Returns per-person cents that add up to the total exactly. Items nobody shares are left out and counted. */
  function splitBill(people, items, taxPct, tipPct) {
    const sub = {}; people.forEach(p => { sub[p] = 0; }); let unassigned = 0;
    for (const it of items) {
      const who = (it.who || []).filter(w => w in sub);
      if (!who.length) { unassigned++; continue; }
      apportion(it.price, who.map(() => 1)).forEach((c, k) => { sub[who[k]] += c; });
    }
    const subtotal = people.reduce((s, p) => s + sub[p], 0), w = people.map(p => sub[p]);
    const tax = Math.round(subtotal * Math.max(0, taxPct || 0) / 100), tip = Math.round(subtotal * Math.max(0, tipPct || 0) / 100);
    const tx = apportion(tax, w), tp = apportion(tip, w), per = {};
    people.forEach((p, k) => { per[p] = { sub: sub[p], tax: tx[k], tip: tp[k], total: sub[p] + tx[k] + tp[k] }; });
    return { per, subtotal, tax, tip, total: subtotal + tax + tip, unassigned };
  }
  const money = (c) => (c / 100).toFixed(2);
  function splitText(names, r, taxPct, tipPct) {
    const L = ['Bill split'];
    for (const [id, nm] of names) { const p = r.per[id]; if (p) L.push(nm + ': ' + money(p.total) + (p.tax || p.tip ? ' (items ' + money(p.sub) + ', tax ' + money(p.tax) + ', tip ' + money(p.tip) + ')' : '')); }
    L.push('Total: ' + money(r.total) + (r.tax || r.tip ? ' (items ' + money(r.subtotal) + ', tax ' + money(r.tax) + ' at ' + (taxPct || 0) + '%, tip ' + money(r.tip) + ' at ' + (tipPct || 0) + '%)' : ''));
    return L.join('\n');
  }
  Object.assign(LG, { apportion, toCents, splitBill, splitText, money });
  /* LOGIC-END */

  /* ====================== 10. Split by Items ====================== */
  Tools.register({ id: 'splititems', name: 'Split by Items', icon: '🍕', cat: 'calculate', desc: 'Split a bill by what each person had: add people and items, tick who shared each one, add tax and tip, and get exact per-person totals to share as text.', keys: ['bill', 'restaurant', 'tip', 'tax', 'share', 'split', 'dinner', 'roommates'], needs: [], render(el) {
    const PMAX = 20, IMAX = 100;
    const saved = Store.get('life.split', {}) || {};
    let people = (Array.isArray(saved.people) ? saved.people : []).filter(p => p && typeof p.id === 'string' && typeof p.n === 'string').map(p => ({ id: p.id, n: p.n.slice(0, 30) })).slice(0, PMAX);
    let items = (Array.isArray(saved.items) ? saved.items : []).filter(i => i && typeof i.id === 'string' && typeof i.n === 'string' && i.p >= 0 && i.p <= 1e8).map(i => ({ id: i.id, n: i.n.slice(0, 40), p: Math.round(i.p), who: Array.isArray(i.who) ? i.who.filter(w => people.some(p => p.id === w)) : [] })).slice(0, IMAX);
    let tax = +saved.tax >= 0 && +saved.tax <= 100 ? +saved.tax : 0, tip = +saved.tip >= 0 && +saved.tip <= 100 ? +saved.tip : 0;
    const save = () => Store.set('life.split', { people, items, tax, tip });
    el.innerHTML = `<div class="card"><div class="row" style="align-items:flex-end"><label class="f">Person<input id="pn" type="text" maxlength="30" placeholder="Name"></label><button class="btn alt" id="pa" style="flex:none">Add person</button></div><div class="chips" id="pl" style="padding:6px 0 0;flex-wrap:wrap"></div>
        <div class="lmsg" role="alert" hidden style="color:var(--danger);font-size:13px;margin:6px 0"></div></div>
      <div class="card"><div class="row" style="align-items:flex-end"><label class="f">Item<input id="in" type="text" maxlength="40" placeholder="Pizza"></label><label class="f">Price<input id="ip" type="number" inputmode="decimal" min="0" max="1000000" step="0.01"></label></div>
        <button class="btn" id="ia" style="width:100%;margin-top:8px">Add item (shared by everyone)</button></div>
      <div id="il"></div>
      <div class="card"><div class="row"><label class="f">Tax %<input id="tx" type="number" inputmode="decimal" min="0" max="100" step="any"></label><label class="f">Tip %<input id="tp" type="number" inputmode="decimal" min="0" max="100" step="any"></label></div></div>
      <div class="card" id="out" aria-live="polite"></div>
      <button class="btn alt" id="sh" style="width:100%">Share as text</button>`;
    $('#tx', el).value = tax || ''; $('#tp', el).value = tip || '';
    const nameOf = id => (people.find(p => p.id === id) || {}).n || '?';
    const result = () => splitBill(people.map(p => p.id), items.map(i => ({ price: i.p, who: i.who })), tax, tip);
    function paint() {
      $('#pl', el).innerHTML = people.length ? people.map(p => `<span class="chip on" style="display:inline-flex;align-items:center;gap:6px">${esc(p.n)} <button class="linkbtn" data-rp="${esc(p.id)}" aria-label="Remove ${esc(p.n)}" style="min-width:32px;min-height:32px">&times;</button></span>`).join('') : '<span class="muted">Add the people first.</span>';
      $('#il', el).innerHTML = items.map(i => `<div class="card"><div class="row" style="align-items:center"><b class="grow" style="flex:3;min-width:0;overflow-wrap:anywhere">${esc(i.n)}</b><b style="text-align:right">${money(i.p)}</b><button class="btn alt" data-ri="${esc(i.id)}" aria-label="Remove ${esc(i.n)}" style="flex:none;min-width:44px">&times;</button></div>
        <div class="chips" style="padding:6px 0 0;flex-wrap:wrap">${people.map(p => `<button class="chip${i.who.includes(p.id) ? ' on' : ''}" data-i="${esc(i.id)}" data-p="${esc(p.id)}" aria-pressed="${i.who.includes(p.id)}" style="min-height:44px">${esc(p.n)}</button>`).join('')}</div>${people.length && !i.who.length ? '<div style="color:var(--danger);font-size:13px;margin-top:4px">Nobody is sharing this item yet, so it is not counted.</div>' : ''}</div>`).join('');
      const r = result(), out = $('#out', el);
      out.innerHTML = people.length && items.length ? `<div class="list">${people.map(p => `<div class="item"><span class="grow"><b>${esc(p.n)}</b><br><small class="muted">items ${money(r.per[p.id].sub)}${r.tax || r.tip ? ', tax ' + money(r.per[p.id].tax) + ', tip ' + money(r.per[p.id].tip) : ''}</small></span><b class="mid">${money(r.per[p.id].total)}</b></div>`).join('')}</div>
        <div class="center" style="margin-top:10px"><div class="muted">Total ${r.tax || r.tip ? '(items ' + money(r.subtotal) + ', tax ' + money(r.tax) + ', tip ' + money(r.tip) + ')' : ''}</div><div class="big">${money(r.total)}</div>${r.unassigned ? `<div style="color:var(--danger);font-size:13px">${r.unassigned} item${r.unassigned === 1 ? ' is' : 's are'} not shared by anyone and not counted.</div>` : ''}</div>` : '<div class="center muted">Add people and items to see who owes what.</div>';
    }
    $('#pa', el).onclick = () => {
      const n = $('#pn', el).value.trim().slice(0, 30); if (!n) { msgTo(el, 'Type a name first.'); return; }
      if (people.length >= PMAX) { msgTo(el, 'Up to ' + PMAX + ' people.'); return; }
      if (people.some(p => p.n.toLowerCase() === n.toLowerCase())) { msgTo(el, 'That name is already there.'); return; }
      msgTo(el, ''); people.push({ id: uid(), n }); $('#pn', el).value = ''; save(); paint();
    };
    $('#ia', el).onclick = () => {
      const n = $('#in', el).value.trim().slice(0, 40), p = Valid.num($('#ip', el).value);
      if (!people.length) { msgTo(el, 'Add at least one person first.'); return; }
      if (!n || p == null || p < 0 || p > 1e6) { msgTo(el, 'Give the item a name and a price.'); return; }
      if (items.length >= IMAX) { msgTo(el, 'Up to ' + IMAX + ' items.'); return; }
      msgTo(el, ''); items.push({ id: uid(), n, p: toCents(p), who: people.map(x => x.id) }); $('#in', el).value = ''; $('#ip', el).value = ''; save(); paint();
    };
    $('#pl', el).onclick = (ev) => { const b = ev.target.closest('[data-rp]'); if (!b) return; const id = b.dataset.rp; people = people.filter(p => p.id !== id); items.forEach(i => { i.who = i.who.filter(w => w !== id); }); save(); paint(); };
    $('#il', el).onclick = (ev) => {
      const c = ev.target.closest('[data-p]'), d = ev.target.closest('[data-ri]');
      if (c) { const i = items.find(x => x.id === c.dataset.i); if (i) { i.who = i.who.includes(c.dataset.p) ? i.who.filter(w => w !== c.dataset.p) : i.who.concat(c.dataset.p); save(); paint(); } }
      if (d) { items = items.filter(x => x.id !== d.dataset.ri); save(); paint(); }
    };
    const pct = (id) => Math.min(100, Math.max(0, Valid.num($(id, el).value) || 0));
    $('#tx', el).oninput = () => { tax = pct('#tx'); save(); paint(); }; $('#tp', el).oninput = () => { tip = pct('#tp'); save(); paint(); };
    $('#sh', el).onclick = () => { if (!people.length || !items.length) { toast('Add people and items first'); return; } shareText('Bill split', splitText(people.map(p => [p.id, p.n]), result(), tax, tip)); };
    paint();
  } });

  /* LOGIC-START */
  /* vCard 3.0 text values: backslash, comma, semicolon and line breaks must be escaped. */
  const vcardEsc = (s) => String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const vcardLine1 = (s) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
  function vcardUrl(u) { u = vcardLine1(u); if (!u) return ''; return /^[a-z][a-z0-9+.-]*:\/\//i.test(u) ? u : 'https://' + u; }
  /* Field checks; returns { field: message } (empty when everything is fine). */
  function vcardCheck(f) {
    const e = {}, first = vcardLine1(f.first), last = vcardLine1(f.last), phone = vcardLine1(f.phone), email = vcardLine1(f.email), url = vcardUrl(f.url);
    if (!first && !last) e.first = 'Enter a first or last name.';
    if (phone && !/^\+?[0-9()\-. ]{3,25}$/.test(phone)) e.phone = 'Use digits, spaces and + ( ) - . only (3 to 25 characters).';
    if (email && !/^[^\s@;,<>]+@[^\s@;,<>]+\.[^\s@;,<>]{2,}$/.test(email)) e.email = 'That does not look like an email address.';
    if (url && (!/^https?:\/\/[^\s]+\.[^\s]{2,}$/i.test(url))) e.url = 'Enter a web address like example.com.';
    if (!first && !last && !phone && !email) e.first = 'Enter a name, phone or email.';
    return e;
  }
  function vcardBuild(f) {
    const first = vcardLine1(f.first), last = vcardLine1(f.last), L = ['BEGIN:VCARD', 'VERSION:3.0'];
    L.push('N:' + vcardEsc(last) + ';' + vcardEsc(first) + ';;;', 'FN:' + vcardEsc([first, last].filter(Boolean).join(' ')));
    if (vcardLine1(f.company)) L.push('ORG:' + vcardEsc(vcardLine1(f.company)));
    if (vcardLine1(f.phone)) L.push('TEL;TYPE=CELL:' + vcardEsc(vcardLine1(f.phone)));
    if (vcardLine1(f.email)) L.push('EMAIL;TYPE=INTERNET:' + vcardEsc(vcardLine1(f.email)));
    if (vcardUrl(f.url)) L.push('URL:' + vcardUrl(f.url).replace(/\\/g, '%5C').replace(/,/g, '%2C').replace(/;/g, '%3B'));
    const adr = String(f.address == null ? '' : f.address).replace(/[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f]+/g, ' ').trim();
    if (adr) L.push('ADR;TYPE=HOME:;;' + vcardEsc(adr) + ';;;;');
    L.push('END:VCARD');
    return L.join('\r\n');
  }
  /* The QR library reads one byte per character, so text goes in as UTF-8 bytes. */
  const utf8Bin = (s) => unescape(encodeURIComponent(s));
  Object.assign(LG, { vcardEsc, vcardCheck, vcardBuild, vcardUrl });
  /* LOGIC-END */

  /* ====================== 11. Contact QR ====================== */
  Tools.register({ id: 'vcardqr', name: 'Contact QR', icon: '👤', cat: 'create', desc: 'Turn a contact (name, phone, email, company, website, address) into a QR code in vCard format that phones can scan to save the contact. Save it as a picture.', keys: ['vcard', 'business card', 'contact', 'qr', 'address book', 'share contact'], needs: [], render(el) {
    el.innerHTML = `<div class="card"><div class="row"><label class="f">First name<input id="fn" type="text" maxlength="60" autocomplete="off"></label><label class="f">Last name<input id="ln" type="text" maxlength="60" autocomplete="off"></label></div>
        <label class="f">Phone<input id="ph" type="tel" maxlength="25" pattern="\\+?[0-9()\\-. ]{3,25}" title="Digits, spaces and + ( ) - . only" placeholder="+91 98765 43210"></label>
        <label class="f">Email<input id="em" type="email" maxlength="100" placeholder="name@example.com"></label>
        <label class="f">Company<input id="co" type="text" maxlength="80"></label>
        <label class="f">Website<input id="ur" type="text" maxlength="200" placeholder="example.com"></label>
        <label class="f">Address<textarea id="ad" rows="2" maxlength="300"></textarea></label></div>
      <div class="card center"><canvas id="cv" width="300" height="300" style="max-width:100%;height:auto;background:#fff;border-radius:12px" role="img" aria-label="Contact QR code"></canvas>
        <div class="lmsg" role="alert" hidden style="color:var(--danger);font-size:13px;margin:8px 0"></div>
        <div class="row" style="margin-top:10px"><button class="btn" id="sv">Save PNG</button><button class="btn alt" id="sh">Share</button></div></div>
      <div class="muted" style="${NOTE}">Phones show an "add contact" prompt when they scan this code. The code is made on this device; nothing is uploaded.</div>`;
    const cv = $('#cv', el), g = cv.getContext('2d'); let ok = false;
    const vals = () => ({ first: $('#fn', el).value, last: $('#ln', el).value, phone: $('#ph', el).value, email: $('#em', el).value, company: $('#co', el).value, url: $('#ur', el).value, address: $('#ad', el).value });
    function blank(t) { cv.width = 300; cv.height = 300; g.fillStyle = '#fff'; g.fillRect(0, 0, 300, 300); g.fillStyle = '#666'; g.font = '16px sans-serif'; g.textAlign = 'center'; g.fillText(t, 150, 155); ok = false; }
    function draw() {
      const v = vals(), errs = vCheck(v), keys = Object.keys(errs);
      if (keys.length) { msgTo(el, vcardEmpty(v) ? '' : errs[keys[0]]); blank('Fill in the contact'); return; }
      if (typeof qrcode === 'undefined') { msgTo(el, 'The QR library did not load.'); blank('Not available'); return; }
      try {
        const q = qrcode(0, 'M'); q.addData(utf8Bin(vcardBuild(v))); q.make();
        const n = q.getModuleCount(), sc = Math.max(2, Math.floor(600 / (n + 8))), S = (n + 8) * sc;
        cv.width = S; cv.height = S; g.fillStyle = '#fff'; g.fillRect(0, 0, S, S); g.fillStyle = '#000';
        for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) g.fillRect((c + 4) * sc, (r + 4) * sc, sc, sc);
        ok = true; msgTo(el, '');
      } catch (x) { msgTo(el, 'That is too much text for one QR code. Shorten the address or company.'); blank('Too much data'); }
    }
    const vCheck = vcardCheck, vcardEmpty = (v) => !Object.values(v).some(s => String(s).trim());
    const out = (fn) => { if (!ok) { toast('Fill in the contact first'); return; } cv.toBlob(b => b ? fn(b) : toast('Could not make the image'), 'image/png'); };
    el.addEventListener('input', draw);
    $('#sv', el).onclick = () => out(b => shareImageBlob('contact-qr-' + Date.now() + '.png', b, 'Contact QR'));
    $('#sh', el).onclick = () => out(b => shareImageBlob('contact-qr.png', b, 'Contact QR'));
    draw();
  } });

  /* LOGIC-START */
  const MM_W = 140, MM_H = 44, MM_GX = 60, MM_GY = 18, MM_MAXN = 200, MM_MAXMAPS = 20;
  const MM_COLORS = ['#fde68a', '#a7f3d0', '#bfdbfe', '#fbcfe8', '#ddd6fe', '#fed7aa', '#fecaca', '#e5e7eb'];
  /* Maps from storage are repaired: exactly one root, every other node has an existing parent, sane coordinates, at most 200 nodes. */
  function mmNormalize(nodes) {
    const src = (Array.isArray(nodes) ? nodes : []).filter(n => n && typeof n.id === 'string').slice(0, MM_MAXN), seen = new Set(), out = [];
    for (const n of src) {
      if (seen.has(n.id)) continue; seen.add(n.id);
      out.push({ id: n.id, t: String(n.t == null ? '' : n.t).slice(0, 60), x: Math.max(-1e5, Math.min(1e5, +n.x || 0)), y: Math.max(-1e5, Math.min(1e5, +n.y || 0)), p: typeof n.p === 'string' ? n.p : null, c: Number.isInteger(n.c) && n.c >= 0 && n.c < MM_COLORS.length ? n.c : 0 });
    }
    if (!out.length) out.push({ id: 'root', t: 'Central idea', x: 0, y: 0, p: null, c: 0 });
    const root = out.find(n => n.p === null) || out[0]; root.p = null;
    const ids = new Set(out.map(n => n.id));
    for (const n of out) if (n !== root && (!ids.has(n.p) || n.p === n.id)) n.p = root.id;
    for (const n of out) { // break any cycle by reattaching to the root
      let k = n, guard = 0; while (k && k.p !== null && guard++ <= out.length) k = out.find(z => z.id === k.p);
      if (guard > out.length) n.p = root.id;
    }
    return out;
  }
  function mmDesc(nodes, id) {
    const set = new Set([id]); let grew = true;
    while (grew) { grew = false; for (const n of nodes) if (n.p !== null && set.has(n.p) && !set.has(n.id)) { set.add(n.id); grew = true; } }
    return set;
  }
  /* Deletes a node and everything below it. The root stays. */
  function mmDelete(nodes, id) { const root = nodes.find(n => n.p === null); if (!root || root.id === id) return nodes; const d = mmDesc(nodes, id); return nodes.filter(n => !d.has(n.id)); }
  const mmHit = (a, b, pad) => a.x < b.x + MM_W + pad && b.x < a.x + MM_W + pad && a.y < b.y + MM_H + pad && b.y < a.y + MM_H + pad;
  /* The free spot nearest to (x, y), going down and up in steps, where a new box overlaps nothing. */
  function mmFreeSpot(nodes, x, y) {
    for (let k = 0; k < 400; k++) {
      const off = Math.ceil(k / 2) * (MM_H + MM_GY) * (k % 2 ? 1 : -1), c = { x, y: y + off };
      if (!nodes.some(n => mmHit(c, n, 6))) return c;
    }
    return { x, y: y + 400 * (MM_H + MM_GY) };
  }
  function mmAddChild(nodes, pid, text, color) {
    const p = nodes.find(n => n.id === pid); if (!p || nodes.length >= MM_MAXN) return null;
    const spot = mmFreeSpot(nodes, p.x + MM_W + MM_GX, p.y);
    return { id: uid(), t: String(text || 'New idea').slice(0, 60), x: spot.x, y: spot.y, p: pid, c: Number.isInteger(color) ? color : p.c };
  }
  /* Tidy left-to-right tree: one column per level, leaves one row each, parents centred on their children. Boxes never overlap. */
  function mmLayout(nodes) {
    const root = nodes.find(n => n.p === null); if (!root) return nodes;
    const kids = {}; nodes.forEach(n => { if (n.p !== null) (kids[n.p] = kids[n.p] || []).push(n); });
    const pos = {}, seen = new Set(); let row = 0;
    const rec = (n, depth) => {
      seen.add(n.id); const ch = (kids[n.id] || []).filter(c => !seen.has(c.id));
      let y; if (!ch.length) { y = row * (MM_H + MM_GY); row++; } else { const ys = ch.map(c => rec(c, depth + 1)); y = (ys[0] + ys[ys.length - 1]) / 2; }
      pos[n.id] = { x: depth * (MM_W + MM_GX), y }; return y;
    };
    rec(root, 0);
    return nodes.map(n => pos[n.id] ? Object.assign({}, n, pos[n.id]) : n);
  }
  function mmBounds(nodes) {
    if (!nodes.length) return { x0: 0, y0: 0, x1: MM_W, y1: MM_H };
    return { x0: Math.min(...nodes.map(n => n.x)), y0: Math.min(...nodes.map(n => n.y)), x1: Math.max(...nodes.map(n => n.x + MM_W)), y1: Math.max(...nodes.map(n => n.y + MM_H)) };
  }
  /* Node text wrapped to at most two lines of 18 characters. */
  function mmLines(t) {
    const words = String(t || '').trim().split(/\s+/).filter(Boolean), lines = ['']; let cut = false;
    for (let w of words) {
      if (w.length > 18) w = w.slice(0, 17) + '…';
      const cur = lines[lines.length - 1];
      if (!cur) lines[lines.length - 1] = w;
      else if ((cur + ' ' + w).length <= 18) lines[lines.length - 1] = cur + ' ' + w;
      else if (lines.length < 2) lines.push(w);
      else { cut = true; break; }
    }
    if (cut) { const l = lines[1]; lines[1] = (l.length > 17 ? l.slice(0, 17) : l) + '…'; }
    return lines.filter(Boolean);
  }
  Object.assign(LG, { mmNormalize, mmDesc, mmDelete, mmFreeSpot, mmAddChild, mmLayout, mmBounds, mmLines, mmHit, MM_W, MM_H, MM_MAXN, MM_COLORS });
  /* LOGIC-END */

  /* ====================== 12. Mind Map ====================== */
  Tools.register({ id: 'mindmap', name: 'Mind Map', icon: '🕸️', cat: 'create', desc: 'Build mind maps: tap a node to add children, drag nodes, rename, colour, delete a branch, auto layout, pan and zoom. Keeps several maps and exports a PNG picture.', keys: ['brainstorm', 'ideas', 'diagram', 'concept map', 'planning', 'nodes', 'chart'], needs: ['storage'], render(el) {
    const NS = 'http://www.w3.org/2000/svg';
    let maps = Store.arr('life.maps').filter(m => m && typeof m.id === 'string').slice(0, MM_MAXMAPS).map(m => ({ id: m.id, name: String(m.name || 'Map').slice(0, 40), nodes: mmNormalize(m.nodes) }));
    const mk = (name) => ({ id: uid(), name, nodes: [{ id: uid(), t: 'Central idea', x: 0, y: 0, p: null, c: 0 }] });
    if (!maps.length) maps.push(mk('My first map'));
    let cur = maps.find(m => m.id === Store.get('life.maps.cur', '')) || maps[0], sel = null, view = { x: 20, y: 20, z: 1 }, gone = false;
    const save = () => Store.set('life.maps', maps);
    el.innerHTML = `<div class="card"><div class="row" style="align-items:flex-end"><label class="f">Map<select id="mp"></select></label><button class="btn alt" id="nm" style="flex:none">New map</button></div>
        <label class="f">Map name<input id="mn" type="text" maxlength="40"></label>
        <div class="lmsg" role="alert" hidden style="color:var(--danger);font-size:13px;margin:6px 0"></div></div>
      <svg id="sv" role="img" aria-label="Mind map canvas" style="width:100%;height:55vh;min-height:300px;touch-action:none;background:var(--surface);border:1px solid var(--line);border-radius:14px;display:block"></svg>
      <div class="row" style="margin-top:8px"><button class="btn alt" id="zo" aria-label="Zoom out">-</button><button class="btn alt" id="zi" aria-label="Zoom in">+</button><button class="btn alt" id="ft">Fit</button><button class="btn alt" id="al">Auto layout</button></div>
      <div class="card" id="ed" style="margin-top:8px"></div>
      <div class="row"><button class="btn alt" id="ex">Export PNG</button><button class="btn danger" id="dm">Delete map</button></div>
      <div class="muted" style="${NOTE};margin-top:8px">Tap a node to select it, drag to move, drag the background to pan, pinch or use + and - to zoom. Up to ${MM_MAXN} nodes per map and ${MM_MAXMAPS} maps.</div>`;
    const svg = $('#sv', el), vp = document.createElementNS(NS, 'g'); svg.appendChild(vp);
    const node = (id) => cur.nodes.find(n => n.id === id);
    const size = () => ({ w: svg.clientWidth || 360, h: svg.clientHeight || 400 });
    function applyView() { vp.setAttribute('transform', `translate(${view.x},${view.y}) scale(${view.z})`); }
    function fit() {
      const b = mmBounds(cur.nodes), s = size(), w = b.x1 - b.x0 + 40, h = b.y1 - b.y0 + 40;
      view.z = Math.max(0.3, Math.min(1.5, s.w / w, s.h / h)); view.x = (s.w - (b.x1 - b.x0) * view.z) / 2 - b.x0 * view.z; view.y = (s.h - (b.y1 - b.y0) * view.z) / 2 - b.y0 * view.z; applyView();
    }
    function draw() {
      const edges = cur.nodes.filter(n => n.p !== null && node(n.p)).map(n => { const p = node(n.p), x1 = p.x + MM_W / 2, y1 = p.y + MM_H / 2, x2 = n.x + MM_W / 2, y2 = n.y + MM_H / 2, mx = (x1 + x2) / 2; return `<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}" fill="none" style="stroke:var(--muted)" stroke-width="2"/>`; }).join('');
      const nodes = cur.nodes.map(n => { const ls = mmLines(n.t), on = n.id === sel; return `<g data-n="${esc(n.id)}" transform="translate(${n.x},${n.y})" style="cursor:grab"><rect width="${MM_W}" height="${MM_H}" rx="12" fill="${MM_COLORS[n.c] || MM_COLORS[0]}" style="stroke:${on ? 'var(--text)' : 'rgba(0,0,0,.3)'}" stroke-width="${on ? 3 : 1}"/><text text-anchor="middle" font-size="13" fill="#111" style="pointer-events:none">${ls.map((l, i) => `<tspan x="${MM_W / 2}" y="${ls.length === 1 ? MM_H / 2 + 5 : MM_H / 2 - 3 + i * 16}">${esc(l)}</tspan>`).join('')}</text></g>`; }).join('');
      vp.innerHTML = edges + nodes; applyView();
    }
    function panel() {
      const n = sel && node(sel), box = $('#ed', el);
      if (!n) { box.innerHTML = '<div class="muted center">Tap a node to edit it.</div>'; return; }
      box.innerHTML = `<label class="f">Node text<input id="nt" type="text" maxlength="60"></label>
        <div class="swatches" style="margin:8px 0;gap:8px">${MM_COLORS.map((c, i) => `<button class="sw" data-c="${i}" aria-label="Colour ${i + 1}" style="background:${c};border-color:${i === n.c ? 'var(--text)' : 'var(--line)'}"></button>`).join('')}</div>
        <div class="row"><button class="btn" id="ac">Add child</button><button class="btn danger" id="dl"${n.p === null ? ' disabled' : ''}>Delete branch</button></div>`;
      $('#nt', el).value = n.t;
    }
    function pick(id) { sel = id; draw(); panel(); }
    function load() {
      const mp = $('#mp', el); mp.innerHTML = maps.map(m => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join(''); mp.value = cur.id; $('#mn', el).value = cur.name;
      Store.set('life.maps.cur', cur.id); sel = null; fit(); draw(); panel();
    }
    /* ---- gestures: one finger moves a node or pans, two fingers pinch ---- */
    const pts = new Map(); let drag = null;
    const world = (cx, cy) => { const r = svg.getBoundingClientRect(); return { x: (cx - r.left - view.x) / view.z, y: (cy - r.top - view.y) / view.z, rx: cx - r.left, ry: cy - r.top }; };
    const dist2 = () => { const a = [...pts.values()]; return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1; };
    svg.onpointerdown = (e) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { svg.setPointerCapture(e.pointerId); } catch (x) { /* not supported */ }
      if (pts.size === 2) { const a = [...pts.values()], w = world((a[0].x + a[1].x) / 2, (a[0].y + a[1].y) / 2); drag = { type: 'pinch', d0: dist2(), z0: view.z, wx: w.x, wy: w.y, moved: true }; return; }
      const g = e.target.closest && e.target.closest('[data-n]'), n = g && node(g.dataset.n);
      drag = n ? { type: 'node', id: n.id, sx: e.clientX, sy: e.clientY, nx: n.x, ny: n.y, moved: false } : { type: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false };
    };
    svg.onpointermove = (e) => {
      if (!pts.has(e.pointerId) || !drag) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (drag.type === 'pinch') { if (pts.size < 2) return; const a = [...pts.values()], r = svg.getBoundingClientRect(), mx = (a[0].x + a[1].x) / 2 - r.left, my = (a[0].y + a[1].y) / 2 - r.top; view.z = Math.max(0.3, Math.min(3, drag.z0 * dist2() / drag.d0)); view.x = mx - drag.wx * view.z; view.y = my - drag.wy * view.z; applyView(); return; }
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy; if (!drag.moved && Math.hypot(dx, dy) < 5) return; drag.moved = true;
      if (drag.type === 'node') { const n = node(drag.id); if (n) { n.x = Math.round(drag.nx + dx / view.z); n.y = Math.round(drag.ny + dy / view.z); draw(); } }
      else { view.x = drag.vx + dx; view.y = drag.vy + dy; applyView(); }
    };
    const up = (e) => {
      pts.delete(e.pointerId); if (!drag) return; const d = drag; if (pts.size) return; drag = null;
      if (d.type === 'node') { if (d.moved) save(); pick(d.id); } else if (d.type === 'pan' && !d.moved) pick(null);
    };
    svg.onpointerup = up; svg.onpointercancel = up;
    svg.onwheel = (e) => { e.preventDefault(); const w = world(e.clientX, e.clientY); view.z = Math.max(0.3, Math.min(3, view.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15))); view.x = w.rx - w.x * view.z; view.y = w.ry - w.y * view.z; applyView(); };
    const zoom = (f) => { const s = size(), w = world(svg.getBoundingClientRect().left + s.w / 2, svg.getBoundingClientRect().top + s.h / 2); view.z = Math.max(0.3, Math.min(3, view.z * f)); view.x = w.rx - w.x * view.z; view.y = w.ry - w.y * view.z; applyView(); };
    $('#zi', el).onclick = () => zoom(1.25); $('#zo', el).onclick = () => zoom(0.8); $('#ft', el).onclick = fit;
    $('#al', el).onclick = () => { cur.nodes = mmLayout(cur.nodes); save(); fit(); draw(); toast('Laid out'); };
    $('#ed', el).addEventListener('input', (ev) => { if (ev.target.id !== 'nt') return; const n = sel && node(sel); if (n) { n.t = ev.target.value.slice(0, 60); save(); draw(); } });
    $('#ed', el).addEventListener('click', (ev) => {
      const n = sel && node(sel); if (!n) return;
      const c = ev.target.closest('[data-c]');
      if (c) { n.c = +c.dataset.c; save(); draw(); panel(); return; }
      if (ev.target.closest('#ac')) {
        if (cur.nodes.length >= MM_MAXN) { msgTo(el, 'This map is full (' + MM_MAXN + ' nodes).'); return; }
        msgTo(el, ''); const k = mmAddChild(cur.nodes, n.id, 'New idea'); if (k) { cur.nodes.push(k); save(); pick(k.id); const nt = $('#nt', el); if (nt) { nt.focus(); nt.select(); } }
      }
      if (ev.target.closest('#dl') && n.p !== null) {
        const cnt = mmDesc(cur.nodes, n.id).size; if (cnt > 1 && !confirm('Delete this node and ' + (cnt - 1) + ' below it?')) return;
        cur.nodes = mmDelete(cur.nodes, n.id); save(); pick(null);
      }
    });
    $('#mp', el).onchange = (ev) => { cur = maps.find(m => m.id === ev.target.value) || maps[0]; load(); };
    $('#mn', el).oninput = (ev) => { cur.name = ev.target.value.slice(0, 40) || 'Map'; save(); const o = $$('option', $('#mp', el)).find(x => x.value === cur.id); if (o) o.textContent = cur.name; };
    $('#nm', el).onclick = () => { if (maps.length >= MM_MAXMAPS) { msgTo(el, 'Up to ' + MM_MAXMAPS + ' maps. Delete one first.'); return; } msgTo(el, ''); cur = mk('Map ' + (maps.length + 1)); maps.push(cur); save(); load(); };
    $('#dm', el).onclick = () => { if (!confirm('Delete the map "' + cur.name + '"?')) return; maps = maps.filter(m => m !== cur); if (!maps.length) maps.push(mk('My first map')); cur = maps[0]; save(); load(); };
    $('#ex', el).onclick = () => {
      const b = mmBounds(cur.nodes), pad = 40, w = b.x1 - b.x0 + pad * 2, h = b.y1 - b.y0 + pad * 2, sc = Math.min(2, 2400 / Math.max(w, h));
      const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(w * sc)); cv.height = Math.max(1, Math.round(h * sc));
      const g = cv.getContext('2d'); if (!g) { toast('Could not make the image'); return; }
      g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.scale(sc, sc); g.translate(pad - b.x0, pad - b.y0);
      g.strokeStyle = '#888'; g.lineWidth = 2;
      for (const n of cur.nodes) { const p = n.p !== null && node(n.p); if (!p) continue; const x1 = p.x + MM_W / 2, y1 = p.y + MM_H / 2, x2 = n.x + MM_W / 2, y2 = n.y + MM_H / 2, mx = (x1 + x2) / 2; g.beginPath(); g.moveTo(x1, y1); g.bezierCurveTo(mx, y1, mx, y2, x2, y2); g.stroke(); }
      g.textAlign = 'center'; g.font = '13px sans-serif'; g.lineWidth = 1;
      for (const n of cur.nodes) {
        g.fillStyle = MM_COLORS[n.c] || MM_COLORS[0]; g.strokeStyle = 'rgba(0,0,0,.35)'; g.beginPath();
        if (g.roundRect) g.roundRect(n.x, n.y, MM_W, MM_H, 12); else g.rect(n.x, n.y, MM_W, MM_H); g.fill(); g.stroke();
        g.fillStyle = '#111'; const ls = mmLines(n.t); ls.forEach((l, i) => g.fillText(l, n.x + MM_W / 2, ls.length === 1 ? n.y + MM_H / 2 + 5 : n.y + MM_H / 2 - 3 + i * 16));
      }
      cv.toBlob(bl => bl ? shareImageBlob('mindmap-' + Date.now() + '.png', bl, cur.name) : toast('Could not make the image'), 'image/png');
    };
    load();
    return () => { gone = true; pts.clear(); drag = null; save(); };
  } });

  /* LOGIC-START */
  const SB = { W: 150, H: 140, BW: 1000, BH: 1600, MAX: 100, TXT: 200 };
  const SB_COLORS = ['#fef08a', '#fbcfe8', '#bbf7d0', '#bfdbfe', '#fed7aa', '#ddd6fe'];
  const sbClamp = (x, y) => ({ x: Math.max(0, Math.min(SB.BW - SB.W, Math.round(+x || 0))), y: Math.max(0, Math.min(SB.BH - SB.H, Math.round(+y || 0))) });
  const sbHit = (a, b) => a.x < b.x + SB.W && b.x < a.x + SB.W && a.y < b.y + SB.H && b.y < a.y + SB.H;
  /* First free grid slot for a new note (a second, half-shifted grid when the first is full). Always inside the board. */
  function sbSpot(list) {
    const cols = Math.floor((SB.BW - 12) / (SB.W + 12)), rows = Math.floor((SB.BH - 12) / (SB.H + 12));
    for (const shift of [0, 1]) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const p = sbClamp(12 + c * (SB.W + 12) + shift * 40, 12 + r * (SB.H + 12) + shift * 40);
      if (!list.some(n => sbHit(p, n))) return p;
    }
    return sbClamp(Math.random() * SB.BW, Math.random() * SB.BH);
  }
  function sbNormalize(list) {
    const seen = new Set();
    return (Array.isArray(list) ? list : []).filter(n => n && typeof n.id === 'string' && !seen.has(n.id) && seen.add(n.id)).slice(0, SB.MAX).map(n => Object.assign(sbClamp(n.x, n.y), { id: n.id, t: String(n.t == null ? '' : n.t).slice(0, SB.TXT), c: Number.isInteger(n.c) && n.c >= 0 && n.c < SB_COLORS.length ? n.c : 0 }));
  }
  Object.assign(LG, { sbSpot, sbNormalize, sbClamp, sbHit, SB, SB_COLORS });
  /* LOGIC-END */

  /* ====================== 13. Sticky Board ====================== */
  Tools.register({ id: 'stickyboard', name: 'Sticky Board', icon: '🟨', cat: 'create', desc: 'A board of colourful sticky notes you can type on, drag around, recolour and delete. Saved on this device, up to 100 notes.', keys: ['sticky notes', 'post-it', 'board', 'notes', 'reminders', 'kanban', 'ideas'], needs: ['storage'], render(el) {
    let notes = sbNormalize(Store.arr('life.stickies'));
    const save = () => Store.set('life.stickies', notes);
    el.innerHTML = `<div class="row" style="align-items:center"><button class="btn" id="ad">Add note</button><span class="muted center" id="ct" style="flex:1;text-align:center"></span></div>
      <div class="lmsg" role="alert" hidden style="color:var(--danger);font-size:13px;margin:6px 0"></div>
      <div id="bd" style="position:relative;height:60vh;min-height:320px;overflow:auto;margin-top:8px;border:1px solid var(--line);border-radius:14px;background:var(--surface2)"><div id="cv" style="position:relative;width:${SB.BW}px;height:${SB.BH}px"></div></div>
      <div class="muted" style="${NOTE};margin-top:8px">Drag a note by its top bar. Scroll the board to find more room. Up to ${SB.MAX} notes.</div>`;
    const cv = $('#cv', el);
    function paint(focusId) {
      $('#ct', el).textContent = notes.length + ' / ' + SB.MAX + ' notes';
      cv.innerHTML = notes.map(n => `<div class="sn" data-id="${esc(n.id)}" style="position:absolute;left:${n.x}px;top:${n.y}px;width:${SB.W}px;height:${SB.H}px;background:${SB_COLORS[n.c]};border-radius:6px;box-shadow:0 3px 8px rgba(0,0,0,.25);display:flex;flex-direction:column;color:#111">
        <div class="hd" style="height:34px;display:flex;align-items:center;justify-content:space-between;background:rgba(0,0,0,.08);border-radius:6px 6px 0 0;touch-action:none;cursor:grab"><span class="drag" style="flex:1;height:34px;display:flex;align-items:center;padding-left:8px;font-weight:700" aria-hidden="true">::::</span>
          <button data-col="${esc(n.id)}" aria-label="Change colour" style="width:44px;height:34px;border:0;background:none;font-size:16px;color:#111">&#127912;</button><button data-del="${esc(n.id)}" aria-label="Delete note" style="width:44px;height:34px;border:0;background:none;font-size:18px;color:#111">&times;</button></div>
        <textarea data-t="${esc(n.id)}" aria-label="Note text" maxlength="${SB.TXT}" placeholder="Write here" style="flex:1;width:100%;border:0;background:transparent;color:#111;resize:none;padding:6px 8px;font-size:15px;outline:none;box-sizing:border-box">${esc(n.t)}</textarea></div>`).join('');
      if (focusId) { const t = cv.querySelector('[data-t="' + focusId + '"]'); if (t) t.focus(); }
    }
    $('#ad', el).onclick = () => {
      if (notes.length >= SB.MAX) { msgTo(el, 'The board is full (' + SB.MAX + ' notes). Delete one first.'); return; }
      msgTo(el, ''); const p = sbSpot(notes), n = { id: uid(), t: '', x: p.x, y: p.y, c: notes.length % SB_COLORS.length };
      notes.push(n); save(); paint(n.id); const bd = $('#bd', el); bd.scrollTop = Math.max(0, n.y - 20); bd.scrollLeft = Math.max(0, n.x - 20);
    };
    cv.addEventListener('input', (ev) => { const id = ev.target.dataset && ev.target.dataset.t, n = id && notes.find(z => z.id === id); if (n) { n.t = ev.target.value.slice(0, SB.TXT); save(); } });
    cv.addEventListener('click', (ev) => {
      const c = ev.target.closest('[data-col]'), d = ev.target.closest('[data-del]');
      if (c) { const n = notes.find(z => z.id === c.dataset.col); if (n) { n.c = (n.c + 1) % SB_COLORS.length; save(); const box = c.closest('.sn'); box.style.background = SB_COLORS[n.c]; } }
      if (d) { const n = notes.find(z => z.id === d.dataset.del); if (n && (!n.t.trim() || confirm('Delete this note?'))) { notes = notes.filter(z => z !== n); save(); paint(); } }
    });
    let drag = null;
    cv.addEventListener('pointerdown', (ev) => {
      const h = ev.target.closest('.hd'); if (!h || ev.target.closest('button')) return;
      const box = h.closest('.sn'), n = notes.find(z => z.id === box.dataset.id); if (!n) return;
      drag = { n, box, sx: ev.clientX, sy: ev.clientY, nx: n.x, ny: n.y }; try { h.setPointerCapture(ev.pointerId); } catch (e) { /* not supported */ }
      box.style.zIndex = 5; ev.preventDefault();
    });
    cv.addEventListener('pointermove', (ev) => { if (!drag) return; const p = sbClamp(drag.nx + ev.clientX - drag.sx, drag.ny + ev.clientY - drag.sy); drag.n.x = p.x; drag.n.y = p.y; drag.box.style.left = p.x + 'px'; drag.box.style.top = p.y + 'px'; });
    const end = () => { if (!drag) return; drag.box.style.zIndex = ''; drag = null; save(); };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    paint();
    return () => { drag = null; save(); };
  } });

  /* LOGIC-START */
  const RB = { EXP: 15, EDU: 10, TPLS: ['Classic', 'Modern', 'Compact'] };
  const htmlEsc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const cut = (v, n) => String(v == null ? '' : v).slice(0, n);
  function resumeNormalize(raw) {
    raw = raw && typeof raw === 'object' ? raw : {}; const c = raw.contact && typeof raw.contact === 'object' ? raw.contact : {};
    const list = (a, max, fields) => (Array.isArray(a) ? a : []).filter(x => x && typeof x === 'object').slice(0, max).map(x => { const o = {}; for (const [k, n] of fields) o[k] = cut(x[k], n); return o; });
    return {
      tpl: Number.isInteger(raw.tpl) && raw.tpl >= 0 && raw.tpl < RB.TPLS.length ? raw.tpl : 0,
      contact: { name: cut(c.name, 80), title: cut(c.title, 80), email: cut(c.email, 100), phone: cut(c.phone, 30), place: cut(c.place, 80), link: cut(c.link, 150) },
      summary: cut(raw.summary, 800),
      exp: list(raw.exp, RB.EXP, [['role', 80], ['org', 80], ['period', 40], ['desc', 600]]),
      edu: list(raw.edu, RB.EDU, [['school', 100], ['degree', 100], ['period', 40], ['desc', 300]]),
      skills: cut(raw.skills, 500)
    };
  }
  const skillList = (s) => String(s || '').split(/[,;\n]+/).map(x => x.trim()).filter(Boolean).slice(0, 60);
  const contactBits = (r) => [r.contact.email, r.contact.phone, r.contact.place, r.contact.link].map(x => String(x || '').trim()).filter(Boolean);
  /* Description text: lines starting with "- " become bullets, other lines paragraphs. All text is escaped. */
  function richHtml(s) {
    const out = []; let open = false;
    for (const raw of String(s || '').split(/\r?\n/)) {
      const l = raw.trim(); if (!l) continue;
      if (/^[-*•]\s+/.test(l)) { if (!open) { out.push('<ul>'); open = true; } out.push('<li>' + htmlEsc(l.replace(/^[-*•]\s+/, '')) + '</li>'); }
      else { if (open) { out.push('</ul>'); open = false; } out.push('<p>' + htmlEsc(l) + '</p>'); }
    }
    if (open) out.push('</ul>'); return out.join('');
  }
  const RB_CSS = [
    'body{font-family:Georgia,"Times New Roman",serif;color:#111;margin:0;background:#fff}main{max-width:780px;margin:0 auto;padding:36px 32px}header{text-align:center;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:14px}h1{margin:0;font-size:30px;letter-spacing:.04em}.sub{font-size:16px;margin-top:4px}.ct{font-size:13px;margin-top:6px;color:#333}h2{font-size:14px;text-transform:uppercase;letter-spacing:.12em;border-bottom:1px solid #999;padding-bottom:3px;margin:20px 0 8px}.it{margin:0 0 10px}.hd{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}.hd b{font-size:15px}.pd{color:#444;font-size:13px}p,li{font-size:14px;line-height:1.45;margin:2px 0}ul{margin:2px 0 2px 18px;padding:0}.sk{font-size:14px;line-height:1.6}',
    'body{font-family:"Segoe UI",Helvetica,Arial,sans-serif;color:#1f2937;margin:0;background:#fff}main{max-width:780px;margin:0 auto;padding:0 0 36px}header{background:#1e3a8a;color:#fff;padding:28px 32px}h1{margin:0;font-size:32px}.sub{font-size:17px;margin-top:4px;opacity:.9}.ct{font-size:13px;margin-top:8px;opacity:.9}section{padding:0 32px}h2{font-size:15px;color:#1e3a8a;text-transform:uppercase;letter-spacing:.1em;margin:22px 0 8px}.it{margin:0 0 12px;padding-left:10px;border-left:3px solid #93c5fd}.hd{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}.hd b{font-size:15px}.pd{color:#6b7280;font-size:13px}p,li{font-size:14px;line-height:1.5;margin:2px 0}ul{margin:2px 0 2px 18px;padding:0}.sk span{display:inline-block;background:#dbeafe;border-radius:12px;padding:2px 10px;margin:0 6px 6px 0;font-size:13px}',
    'body{font-family:Arial,Helvetica,sans-serif;color:#000;margin:0;background:#fff}main{max-width:780px;margin:0 auto;padding:24px 28px}header{margin-bottom:8px}h1{margin:0;font-size:24px}.sub{font-size:14px;margin-top:2px;color:#444}.ct{font-size:12px;margin-top:4px;color:#444}h2{font-size:12px;text-transform:uppercase;letter-spacing:.08em;margin:12px 0 4px;background:#eee;padding:2px 6px}.it{margin:0 0 6px}.hd{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}.hd b{font-size:13px}.pd{color:#555;font-size:12px}p,li{font-size:12.5px;line-height:1.35;margin:1px 0}ul{margin:1px 0 1px 16px;padding:0}.sk{font-size:12.5px;line-height:1.5}'
  ];
  const PRINT_CSS = '@page{margin:14mm}@media print{main{padding:0}header{-webkit-print-color-adjust:exact;print-color-adjust:exact}.it{break-inside:avoid}}';
  /* A complete standalone page, safe to print: no scripts, a strict content policy and every value escaped. */
  function resumeHtml(raw, tpl) {
    const r = resumeNormalize(raw), t = Number.isInteger(tpl) ? Math.min(RB.TPLS.length - 1, Math.max(0, tpl)) : r.tpl, e = htmlEsc, c = r.contact, bits = contactBits(r), body = [];
    const sec = (title, inner) => { body.push('<section><h2>' + e(title) + '</h2>' + inner + '</section>'); };
    if (r.summary.trim()) sec('Summary', richHtml(r.summary));
    const exp = r.exp.filter(x => x.role.trim() || x.org.trim() || x.desc.trim());
    if (exp.length) sec('Experience', exp.map(x => '<div class="it"><div class="hd"><b>' + e([x.role, x.org].map(s => s.trim()).filter(Boolean).join(', ')) + '</b><span class="pd">' + e(x.period) + '</span></div>' + richHtml(x.desc) + '</div>').join(''));
    const edu = r.edu.filter(x => x.school.trim() || x.degree.trim());
    if (edu.length) sec('Education', edu.map(x => '<div class="it"><div class="hd"><b>' + e([x.degree, x.school].map(s => s.trim()).filter(Boolean).join(', ')) + '</b><span class="pd">' + e(x.period) + '</span></div>' + richHtml(x.desc) + '</div>').join(''));
    const sk = skillList(r.skills);
    if (sk.length) sec('Skills', t === 1 ? '<div class="sk">' + sk.map(s => '<span>' + e(s) + '</span>').join('') + '</div>' : '<div class="sk">' + e(sk.join(' · ')) + '</div>');
    return '<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><title>' + e(c.name.trim() || 'Resume') + '</title><style>' + RB_CSS[t] + PRINT_CSS + '</style></head><body><main><header><h1>' + e(c.name.trim() || 'Your name') + '</h1>' + (c.title.trim() ? '<div class="sub">' + e(c.title) + '</div>' : '') + (bits.length ? '<div class="ct">' + e(bits.join('  |  ')) + '</div>' : '') + '</header>' + body.join('') + '</main></body></html>\n';
  }
  function resumeText(raw) {
    const r = resumeNormalize(raw), c = r.contact, L = [];
    L.push((c.name.trim() || 'YOUR NAME').toUpperCase()); if (c.title.trim()) L.push(c.title.trim()); if (contactBits(r).length) L.push(contactBits(r).join(' | '));
    if (r.summary.trim()) L.push('', 'SUMMARY', r.summary.trim());
    const exp = r.exp.filter(x => x.role.trim() || x.org.trim() || x.desc.trim());
    if (exp.length) { L.push('', 'EXPERIENCE'); exp.forEach(x => { L.push([x.role, x.org].map(s => s.trim()).filter(Boolean).join(', ') + (x.period.trim() ? ' (' + x.period.trim() + ')' : '')); if (x.desc.trim()) L.push(x.desc.trim()); L.push(''); }); L.pop(); }
    const edu = r.edu.filter(x => x.school.trim() || x.degree.trim());
    if (edu.length) { L.push('', 'EDUCATION'); edu.forEach(x => { L.push([x.degree, x.school].map(s => s.trim()).filter(Boolean).join(', ') + (x.period.trim() ? ' (' + x.period.trim() + ')' : '')); if (x.desc.trim()) L.push(x.desc.trim()); }); }
    const sk = skillList(r.skills); if (sk.length) L.push('', 'SKILLS', sk.join(', '));
    return L.join('\n') + '\n';
  }
  Object.assign(LG, { htmlEsc, resumeNormalize, resumeHtml, resumeText, skillList, RB });
  /* LOGIC-END */

  /* ====================== 14. Resume Builder ====================== */
  Tools.register({ id: 'resumebuilder', name: 'Resume Builder', icon: '🧑‍💼', cat: 'text', desc: 'Build a resume from contact, summary, experience, education and skills with three clean templates, preview it, and export a printable HTML file or plain text.', keys: ['cv', 'curriculum vitae', 'job', 'career', 'resume', 'apply', 'print'], needs: ['storage'], render(el) {
    let r = resumeNormalize(Store.get('life.resume', {})), timer = 0;
    const save = () => Store.set('life.resume', r);
    const inp = (lab, sec, i, f, max, extra) => `<label class="f">${lab}<input type="text" maxlength="${max}" data-s="${sec}" data-i="${i}" data-f="${f}" ${extra || ''}></label>`;
    const area = (lab, sec, i, f, max, rows) => `<label class="f">${lab}<textarea rows="${rows}" maxlength="${max}" data-s="${sec}" data-i="${i}" data-f="${f}"></textarea></label>`;
    el.innerHTML = `<div class="card"><b>Contact</b>${inp('Full name', 'contact', '', 'name', 80)}${inp('Job title', 'contact', '', 'title', 80)}
        <div class="row">${inp('Email', 'contact', '', 'email', 100)}${inp('Phone', 'contact', '', 'phone', 30)}</div>${inp('Location', 'contact', '', 'place', 80)}${inp('Website or profile', 'contact', '', 'link', 150)}</div>
      <div class="card"><b>Summary</b>${area('A few lines about you', 'root', '', 'summary', 800, 4)}</div>
      <div class="card"><b>Experience</b><div id="ex"></div><button class="btn alt" id="ae" style="width:100%;margin-top:8px">Add experience</button></div>
      <div class="card"><b>Education</b><div id="ed"></div><button class="btn alt" id="ad" style="width:100%;margin-top:8px">Add education</button></div>
      <div class="card"><b>Skills</b>${area('Separate with commas', 'root', '', 'skills', 500, 3)}</div>
      <div class="card"><b>Template</b><div class="chips" id="tp" style="padding:8px 0 0"></div></div>
      <div class="lmsg" role="alert" hidden style="color:var(--danger);font-size:13px;margin:6px 0"></div>
      <div class="card"><b>Preview</b><iframe id="pv" title="Resume preview" sandbox="" style="width:100%;height:480px;border:1px solid var(--line);border-radius:8px;background:#fff;margin-top:8px"></iframe></div>
      <div class="row"><button class="btn" id="eh">Export HTML</button><button class="btn alt" id="et">Export text</button></div>
      <div class="muted" style="${NOTE};margin-top:8px">Open the HTML file in a browser and use Print to save it as a PDF. Tip: start description lines with "- " for bullet points.</div>`;
    const entry = (sec, i, x) => sec === 'exp'
      ? `<div style="border-top:1px solid var(--line);padding-top:8px;margin-top:8px">${inp('Role', sec, i, 'role', 80)}${inp('Company', sec, i, 'org', 80)}${inp('Period', sec, i, 'period', 40, 'placeholder="2021 - Now"')}${area('What you did', sec, i, 'desc', 600, 3)}<button class="btn danger" data-rm="${sec}" data-i="${i}" style="width:100%;margin-top:6px">Remove this experience</button></div>`
      : `<div style="border-top:1px solid var(--line);padding-top:8px;margin-top:8px">${inp('School', sec, i, 'school', 100)}${inp('Degree or course', sec, i, 'degree', 100)}${inp('Period', sec, i, 'period', 40)}${area('Notes (optional)', sec, i, 'desc', 300, 2)}<button class="btn danger" data-rm="${sec}" data-i="${i}" style="width:100%;margin-top:6px">Remove this education</button></div>`;
    const target = (f) => { const s = f.dataset.s, i = f.dataset.i; return s === 'contact' ? r.contact : s === 'root' ? r : (r[s] && r[s][+i]) || null; };
    function fill() { $$('[data-s]', el).forEach(f => { const o = target(f); f.value = o ? o[f.dataset.f] || '' : ''; }); }
    function lists() {
      $('#ex', el).innerHTML = r.exp.map((x, i) => entry('exp', i, x)).join(''); $('#ed', el).innerHTML = r.edu.map((x, i) => entry('edu', i, x)).join('');
      $('#tp', el).innerHTML = RB.TPLS.map((n, i) => `<button class="chip${i === r.tpl ? ' on' : ''}" data-t="${i}">${n}</button>`).join(''); fill();
    }
    const preview = () => { $('#pv', el).srcdoc = resumeHtml(r, r.tpl); };
    const later = () => { clearTimeout(timer); timer = setTimeout(preview, 300); };
    el.addEventListener('input', (ev) => { const f = ev.target; if (!f.dataset || !f.dataset.f) return; const o = target(f); if (!o) return; o[f.dataset.f] = f.value.slice(0, +f.maxLength > 0 ? +f.maxLength : 800); save(); later(); });
    el.addEventListener('click', (ev) => {
      const t = ev.target.closest('[data-t]'), rm = ev.target.closest('[data-rm]');
      if (t) { r.tpl = +t.dataset.t; save(); lists(); preview(); }
      if (rm) { r[rm.dataset.rm].splice(+rm.dataset.i, 1); save(); lists(); preview(); }
    });
    $('#ae', el).onclick = () => { if (r.exp.length >= RB.EXP) { msgTo(el, 'Up to ' + RB.EXP + ' experience entries.'); return; } msgTo(el, ''); r.exp.push({ role: '', org: '', period: '', desc: '' }); save(); lists(); };
    $('#ad', el).onclick = () => { if (r.edu.length >= RB.EDU) { msgTo(el, 'Up to ' + RB.EDU + ' education entries.'); return; } msgTo(el, ''); r.edu.push({ school: '', degree: '', period: '', desc: '' }); save(); lists(); };
    const named = () => { if (!r.contact.name.trim()) { msgTo(el, 'Enter your name first.'); return false; } msgTo(el, ''); return true; };
    const fname = () => (r.contact.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'resume');
    $('#eh', el).onclick = async () => { if (named()) await saveTextFile(fname() + '-resume.html', resumeHtml(r, r.tpl), 'text/html'); };
    $('#et', el).onclick = async () => { if (named()) await saveTextFile(fname() + '-resume.txt', resumeText(r), 'text/plain'); };
    lists(); preview();
    return () => { clearTimeout(timer); save(); };
  } });
})();
