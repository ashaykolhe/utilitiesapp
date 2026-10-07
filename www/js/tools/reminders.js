'use strict';
/* Reminders: stored locally. On Android a Capacitor local notification is scheduled; in a browser a Notification fires while the app is open. */
Tools.register({ id: 'reminders', name: 'Reminders', icon: '🔔', cat: 'daily', desc: 'Set reminders with a date and time; notifications fire even when the app is closed.', needs: ['notifications'], render(el) {
  const LN = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications;
  el.innerHTML = `<div class="card list"><label class="f" for="t">Remind me to</label><input id="t" type="text" maxlength="80" required placeholder="Remind me to..."><label class="f" for="w">When</label><input id="w" type="datetime-local" required><button class="btn" id="add">Add reminder</button></div>
    <div class="card" id="nb" hidden role="status" style="font-size:13px;line-height:1.5;color:var(--danger);border-color:var(--danger)">Notifications are blocked: the alert only sounds while PocketKit is open. Allow them in Android settings.</div>
    <div class="muted" style="font-size:13px;line-height:1.45;margin:0 4px">${LN ? 'Each reminder is an Android notification. It can arrive a few minutes late when the phone is idle or battery saver is on, so do not rely on it for anything time-critical.' : 'This browser cannot notify while closed, so reminders only sound while PocketKit is open.'}</div>
    <div class="list" id="l"></div><button class="btn alt" id="clr" hidden>Clear finished</button>`;
  const KEEP_DONE = 20, MAX_ITEMS = 200;
  const lt = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 16); };
  { const w = $('#w', el), now = new Date(), far = new Date(now.getTime()); far.setFullYear(far.getFullYear() + 5); w.min = lt(now); w.max = lt(far); }
  /* Only well-formed saved reminders are kept, so wrong stored data cannot stop the tool from opening. */
  let items = Store.arr('reminders').filter(r => r && typeof r === 'object' && typeof r.text === 'string' && Number.isFinite(r.at) && Number.isFinite(r.id)).map(r => ({ id: r.id, text: r.text.slice(0, 80), at: r.at, done: r.done === true, nat: r.nat === true })), timers = [];
  /* Keep only the newest finished reminders so the list and storage cannot grow forever. */
  const trim = () => {
    const done = items.filter(r => r.done).sort((a, b) => b.at - a.at), drop = new Set(done.slice(KEEP_DONE));
    if (drop.size) items = items.filter(r => !drop.has(r));
  };
  const save = () => { trim(); Store.set('reminders', items); };
  const showBlocked = (on) => { $('#nb', el).hidden = !on; };
  /* New ids come from a counter in their own block (100000000+); older reminders keep the id they were saved with. */
  const nextId = () => { const sq = Store.get('reminders.seq', 0), n = (Number.isFinite(sq) && sq >= 0 ? Math.floor(sq) : 0) + 1; Store.set('reminders.seq', n); return 100000000 + n % 900000000; };
  const fire = (r, quiet) => {
    if (!quiet) { beep(); toast('🔔 ' + r.text); }
    if (!LN && window.Notification && Notification.permission === 'granted') try { new Notification('Reminder', { body: r.text }); } catch (x) {}
    r.done = true; save(); draw();
  };
  const arm = () => {
    timers.forEach(clearTimeout); timers = [];
    let sounded = false, silent = false;
    items.filter(r => !r.done).forEach(r => {
      const ms = r.at - Date.now();
      if (ms <= 0) {
        /* Already delivered by Android while the app was closed: just tick it off, no second beep. */
        if (r.nat) { r.done = true; silent = true; } else { fire(r, sounded); sounded = true; }
      } else if (ms < 2147e6) timers.push(setTimeout(() => fire(r), ms));
    });
    if (silent) { save(); draw(); }
  };
  function draw() {
    items.sort((a, b) => a.at - b.at);
    $('#clr', el).hidden = !items.some(r => r.done);
    $('#l', el).innerHTML = items.map(r => `<div class="item"><span class="grow"${r.done ? ' style="opacity:.5;text-decoration:line-through"' : ''}>${esc(r.text)}<br><small class="muted">${new Date(r.at).toLocaleString()}</small></span><button class="btn alt" data-id="${r.id}" aria-label="Delete reminder: ${esc(r.text)}" style="min-width:44px">✕</button></div>`).join('') || '<p class="muted center">No reminders yet.</p>';
  }
  $('#l', el).onclick = async (e) => {
    const b = e.target.closest('[data-id]'), id = b && b.dataset.id; if (!id) return;
    items = items.filter(r => String(r.id) !== id); save(); draw(); arm();
    if (LN) try { await LN.cancel({ notifications: [{ id: +id }] }); } catch (x) {}
  };
  $('#clr', el).onclick = () => { items = items.filter(r => !r.done); save(); draw(); };
  $('#add', el).onclick = async () => {
    const text = $('#t', el).value.trim(), at = new Date($('#w', el).value).getTime();
    if (!text || isNaN(at) || at <= Date.now()) { toast('Enter text and a future time'); return; }
    if (at > Date.now() + 5 * 366 * 864e5) { toast('Pick a time within 5 years'); return; }
    if (items.length >= MAX_ITEMS) { toast('Too many reminders: delete some first'); return; }
    if (items.filter(x => !x.done).length >= proLimit('reminders') && needPro('reminders')) return;
    const r = { id: nextId(), text, at, done: false, nat: false };
    items.push(r); save();
    let ok = null, blocked = false; // ok: true = scheduled with Android, false = not scheduled, null = browser
    try {
      if (LN) {
        const p = await LN.requestPermissions();
        if (p.display !== 'granted') { ok = false; blocked = true; }
        else { await LN.schedule({ notifications: [{ id: r.id, title: 'Reminder', body: text, schedule: { at: new Date(at), allowWhileIdle: true } }] }); ok = true; }
      } else if (window.Notification && Notification.permission === 'default') Notification.requestPermission();
    } catch (x) { ok = false; }
    r.nat = ok === true; save();
    if (LN) showBlocked(blocked);
    toast(ok === false ? (blocked ? 'Saved, but notifications are blocked' : 'Saved, but could not schedule a notification') : 'Reminder set');
    $('#t', el).value = ''; draw(); arm();
  };
  if (LN && LN.checkPermissions) LN.checkPermissions().then(p => { if (p.display === 'denied') showBlocked(true); }).catch(() => {});
  draw(); arm();
  return () => timers.forEach(clearTimeout);
} });
