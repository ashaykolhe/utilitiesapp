'use strict';
/* Reminders: stored locally. On Android a Capacitor local notification is scheduled; in a browser a Notification fires while the app is open. */
Tools.register({ id: 'reminders', name: 'Reminders', icon: '🔔', cat: 'daily', desc: 'Set reminders with a date and time; notifications fire even when the app is closed.', needs: ['notifications'], render(el) {
  el.innerHTML = `<div class="card list"><input id="t" type="text" maxlength="80" placeholder="Remind me to..."><input id="w" type="datetime-local"><button class="btn" id="add">Add reminder</button></div><div class="list" id="l"></div>`;
  const LN = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications;
  let items = Store.get('reminders', []), timers = [];
  const save = () => Store.set('reminders', items);
  const fire = (r) => {
    beep(); toast('🔔 ' + r.text);
    if (!LN && window.Notification && Notification.permission === 'granted') new Notification('Reminder', { body: r.text });
    r.done = true; save(); draw();
  };
  const arm = () => {
    timers.forEach(clearTimeout); timers = [];
    items.filter(r => !r.done).forEach(r => {
      const ms = r.at - Date.now();
      if (ms <= 0) fire(r); else if (ms < 2147e6) timers.push(setTimeout(() => fire(r), ms));
    });
  };
  function draw() {
    items.sort((a, b) => a.at - b.at);
    $('#l', el).innerHTML = items.map(r => `<div class="item"><span class="grow"${r.done ? ' style="opacity:.5;text-decoration:line-through"' : ''}>${esc(r.text)}<br><small class="muted">${new Date(r.at).toLocaleString()}</small></span><button class="btn alt" data-id="${r.id}">✕</button></div>`).join('') || '<p class="muted center">No reminders yet.</p>';
  }
  $('#l', el).onclick = async (e) => {
    const id = e.target.dataset.id; if (!id) return;
    items = items.filter(r => String(r.id) !== id); save(); draw(); arm();
    if (LN) try { await LN.cancel({ notifications: [{ id: +id }] }); } catch (x) {}
  };
  $('#add', el).onclick = async () => {
    const text = $('#t', el).value.trim(), at = new Date($('#w', el).value).getTime();
    if (!text || isNaN(at) || at <= Date.now()) { toast('Enter text and a future time'); return; }
    if (items.filter(x => !x.done).length >= proLimit('reminders') && needPro('reminders')) return;
    const r = { id: Math.floor(Date.now() % 2e9), text, at, done: false };
    items.push(r); save();
    try {
      if (LN) {
        if ((await LN.requestPermissions()).display === 'granted') await LN.schedule({ notifications: [{ id: r.id, title: 'Reminder', body: text, schedule: { at: new Date(at), allowWhileIdle: true } }] });
      } else if (window.Notification && Notification.permission === 'default') Notification.requestPermission();
    } catch (x) { toast('Could not schedule a notification'); }
    $('#t', el).value = ''; draw(); arm();
  };
  draw(); arm();
  return () => timers.forEach(clearTimeout);
} });
