'use strict';
/* Device tools that use the native "PocketDevice" plugin: nearby Wi-Fi networks, nearby Bluetooth devices, NFC tags, battery health and
   storage use. In a browser the plugin is missing and each tool says so. Results are shown on the screen only; nothing is stored or sent.
   Scanning stops when you leave a tool or the app goes to the background. */
(() => {
  const PD = () => (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.PocketDevice) || null;
  const native = () => !!(PD() && (typeof Capacitor.isNativePlatform !== 'function' || Capacitor.isNativePlatform()));
  const WEB_MSG = 'This tool reads the phone\'s own hardware, so it works only in the installed PocketKit app, not in a web browser.';
  const fixN = (v, d) => (Number.isFinite(v) ? v.toFixed(d) : '--');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const card = (inner, style) => '<div class="card"' + (style ? ' style="' + style + '"' : '') + '>' + inner + '</div>';
  const note = (t) => '<p class="muted center" style="font-size:12px;margin:2px 8px">' + t + '</p>';
  const bytes = (n) => { n = +n; if (!Number.isFinite(n) || n < 0) return '--'; const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0; while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; } return (i === 0 ? n.toFixed(0) : n.toFixed(n >= 100 ? 0 : 1)) + ' ' + u[i]; };
  const bars = (lvl, good, ok, weak) => (lvl >= good ? 4 : lvl >= ok ? 3 : lvl >= weak ? 2 : lvl > -127 ? 1 : 0);
  const barText = (n) => '▂▄▆█'.split('').map((c, i) => i < n ? c : '·').join('');
  const rowHtml = (title, sub, right) => '<div class="item"><span class="grow"><b>' + title + '</b><br><small class="muted">' + sub + '</small></span><span style="text-align:right;white-space:nowrap">' + right + '</span></div>';
  const errMsg = (e) => e && (e.message === 'permission' || /permission|denied/i.test(String(e.message || e))) ? 'Permission was not granted. Allow it in the prompt, or in the phone\'s Settings > Apps > PocketKit > Permissions.' : 'Could not read this (' + String((e && e.message) || e).slice(0, 60) + ').';

  /* ------------------------------------------------------------------ Wi-Fi Scanner */
  Tools.register({ id: 'wifiscan', name: 'Wi-Fi Scanner', icon: '🏠', cat: 'measure', desc: 'Lists the Wi-Fi networks around you with signal strength, security type, band and channel, and shows which channels are crowded. Nothing is saved or sent.', keys: ['wifi', 'wi-fi', 'networks', 'router', 'channel', 'signal', 'ssid'], needs: ['location'], render(el) {
    el.innerHTML = '<div id="msg" class="muted center" style="min-height:18px"></div>' +
      '<button class="btn" id="go" style="width:100%">Scan for networks</button>' +
      '<div class="card" id="chart" hidden><b>Channels in use</b><div id="bars" style="display:flex;align-items:flex-end;gap:3px;height:90px;margin-top:8px;overflow-x:auto" role="img" aria-label="Number of networks on each Wi-Fi channel"></div><div class="muted" id="advice" style="margin-top:8px;font-size:13px"></div></div>' +
      '<div class="muted" id="sum"></div><div class="list" id="list"></div>' +
      note('Android needs Location switched on to list Wi-Fi networks, and limits how often an app may scan (a few times every two minutes). PocketKit does not use your position and keeps no record of what it finds.');
    let gone = false, busy = false;
    const msg = (t) => { const m = $('#msg', el); if (m) m.textContent = t || ''; };
    async function scan() {
      if (busy) return; if (!native()) { msg(WEB_MSG); return; }
      busy = true; $('#go', el).disabled = true; $('#go', el).textContent = 'Scanning...'; msg('');
      try {
        const r = await PD().wifiScan(); if (gone) return;
        if (!r.available) { msg('This phone has no Wi-Fi.'); return; }
        if (!r.wifiOn) { msg('Wi-Fi is switched off. Turn it on to scan.'); $('#list', el).innerHTML = ''; return; }
        if (r.locationOn === false) msg('Location is switched off. Turn it on in the phone\'s quick settings, then scan again (Android requires it for Wi-Fi scans).');
        if (r.error) { msg(errMsg({ message: r.error })); return; }
        const nets = r.networks || [];
        $('#sum', el).textContent = nets.length ? nets.length + ' network' + (nets.length === 1 ? '' : 's') + ' found' + (r.fresh === false ? ' (Android reused a recent scan)' : '') : (r.locationOn === false ? '' : 'No networks found. Try again.');
        $('#list', el).innerHTML = nets.map(n => {
          const b = bars(n.level, -55, -67, -80), band = n.freq >= 5900 ? '6 GHz' : n.freq >= 4900 ? '5 GHz' : '2.4 GHz';
          return rowHtml(n.hidden ? 'Hidden network' : esc(n.ssid), esc(n.security) + ' · ' + band + ' · channel ' + (n.channel || '?'), '<b>' + esc(String(n.level)) + ' dBm</b><br><span aria-hidden="true">' + barText(b) + '</span>');
        }).join('');
        const count = {}; nets.forEach(n => { if (n.channel) { const k = (n.freq < 3000 ? '2.4:' : n.freq < 5900 ? '5:' : '6:') + n.channel; count[k] = (count[k] || 0) + 1; } });
        const keys = Object.keys(count).sort((a, b) => { const [ba, ca] = a.split(':'), [bb, cb] = b.split(':'); return (ba === bb ? 0 : parseFloat(ba) - parseFloat(bb)) || (+ca - +cb); });
        $('#chart', el).hidden = !keys.length;
        const max = Math.max(1, ...keys.map(k => count[k]));
        $('#bars', el).innerHTML = keys.map(k => '<div style="flex:1 0 26px;text-align:center"><div style="height:' + Math.round(count[k] / max * 62) + 'px;min-height:4px;background:var(--accent);border-radius:4px 4px 0 0"></div><div style="font-size:10px">' + esc(k.split(':')[1]) + '</div><div style="font-size:9px;color:var(--muted)">' + esc(k.split(':')[0] === '2.4' ? '2.4G' : k.split(':')[0] + 'G') + '</div></div>').join('');
        const c24 = [1, 6, 11].map(c => [c, count['2.4:' + c] || 0]).sort((a, b) => a[1] - b[1])[0];
        $('#advice', el).textContent = keys.some(k => k.startsWith('2.4:')) ? 'Least crowded common 2.4 GHz channel here: ' + c24[0] + (c24[1] ? ' (' + c24[1] + ' network' + (c24[1] === 1 ? '' : 's') + ')' : ' (nobody)') + '. 5 GHz is usually less crowded.' : '';
      } catch (e) { msg(errMsg(e)); }
      finally { busy = false; const g = $('#go', el); if (g) { g.disabled = false; g.textContent = 'Scan again'; } }
    }
    $('#go', el).onclick = scan;
    return () => { gone = true; };
  } });

  /* ------------------------------------------------------------------ Bluetooth Scan */
  Tools.register({ id: 'btscan', name: 'Bluetooth Scan', icon: '📲', cat: 'measure', desc: 'Finds Bluetooth devices near you (headphones, watches, speakers, trackers) and shows their name, signal and whether they are paired with your phone. Nothing is saved or sent.', keys: ['bluetooth', 'ble', 'devices', 'nearby', 'earbuds', 'tracker'], needs: ['location'], render(el) {
    el.innerHTML = '<div id="msg" class="muted center" style="min-height:18px"></div>' +
      '<label class="f">Scan time <span class="muted" id="sl">6 s</span><input type="range" id="secs" min="3" max="15" step="1" value="6" aria-label="Scan time in seconds"></label>' +
      '<button class="btn" id="go" style="width:100%">Scan for devices</button><div class="muted" id="sum"></div><div class="list" id="list"></div>' +
      note('Many devices hide their name and change their address on purpose to protect privacy, so some show as "Unknown device". Signal strength shows how close a device is, roughly: a stronger (less negative) number is closer. PocketKit does not keep what it finds.');
    let gone = false, busy = false;
    const msg = (t) => { const m = $('#msg', el); if (m) m.textContent = t || ''; };
    $('#secs', el).oninput = () => { $('#sl', el).textContent = $('#secs', el).value + ' s'; };
    $('#go', el).onclick = async () => {
      if (busy) return; if (!native()) { msg(WEB_MSG); return; }
      busy = true; $('#go', el).disabled = true; msg('');
      const secs = clamp(+$('#secs', el).value || 6, 3, 15); let left = secs;
      const tick = setInterval(() => { left--; $('#go', el).textContent = 'Scanning... ' + Math.max(left, 0) + ' s'; }, 1000); $('#go', el).textContent = 'Scanning... ' + secs + ' s';
      try {
        const r = await PD().bluetoothScan({ seconds: secs }); if (gone) return;
        if (!r.available) { msg('This phone has no Bluetooth.'); return; }
        if (!r.enabled) { msg('Bluetooth is switched off. Turn it on to scan.'); $('#list', el).innerHTML = ''; return; }
        if (r.error) { msg(errMsg({ message: r.error })); return; }
        const ds = r.devices || [];
        $('#sum', el).textContent = ds.length ? ds.length + ' device' + (ds.length === 1 ? '' : 's') + ' found' : 'No devices found. Make sure the other device is on and in range.';
        $('#list', el).innerHTML = ds.map(d => {
          const has = Number.isFinite(d.rssi), b = has ? bars(d.rssi, -60, -72, -85) : 0;
          return rowHtml(esc(d.name || 'Unknown device') + (d.paired ? ' <span class="probadge" style="font-size:11px">Paired</span>' : ''), esc(d.address || ''), has ? '<b>' + esc(String(d.rssi)) + ' dBm</b><br><span aria-hidden="true">' + barText(b) + '</span>' : '<span class="muted">not in range</span>');
        }).join('');
      } catch (e) { msg(errMsg(e)); }
      finally { clearInterval(tick); busy = false; const g = $('#go', el); if (g) { g.disabled = false; g.textContent = 'Scan again'; } }
    };
    return () => { gone = true; };
  } });

  /* ------------------------------------------------------------------ NFC Reader */
  Tools.register({ id: 'nfcreader', name: 'NFC Reader', icon: '💽', cat: 'daily', desc: 'Reads NFC tags and cards: shows the tag ID, its type and any text, link or data stored on it. Read only: it never writes to a tag.', keys: ['nfc', 'tag', 'card', 'ndef', 'tap'], needs: [], render(el) {
    el.innerHTML = '<div id="msg" class="muted center" style="min-height:18px"></div>' +
      card('<div class="center" id="state" style="font-size:18px;font-weight:700">Starting...</div><div class="center muted" id="hint" style="margin-top:6px">Hold the back of your phone against an NFC tag or card.</div>') +
      '<div class="list" id="list"></div><button class="btn alt" id="clr" style="width:100%" hidden>Clear list</button>' +
      note('The list lives only on this screen. Payment cards, ID cards and passes are protected and usually show only their type and a random ID. This tool cannot copy or clone them.');
    let gone = false, h = null, tags = [];
    const paint = () => {
      $('#clr', el).hidden = !tags.length;
      $('#list', el).innerHTML = tags.map((t, i) => card('<b>Tag ' + esc(t.id || '') + '</b><div class="muted" style="font-size:12px">' + esc((t.tech || []).join(', ')) + (t.type ? ' · ' + esc(t.type) : '') + '</div>' +
        ((t.records || []).length ? (t.records || []).map(r => '<div style="margin-top:8px;padding:8px;border-radius:10px;background:var(--surface2)"><div class="muted" style="font-size:11px;text-transform:uppercase">' + esc(r.kind === 'text' ? 'Text' + (r.lang ? ' (' + r.lang + ')' : '') : r.kind === 'uri' ? 'Link' : r.kind === 'mime' ? 'Data ' + (r.mime || '') : 'Record') + '</div>' + (r.value ? '<div style="word-break:break-all">' + esc(r.value) + '</div><button class="btn alt" data-c="' + i + ':' + (t.records || []).indexOf(r) + '" style="margin-top:6px;min-height:44px">Copy</button>' : '<div class="muted">' + esc(r.size ? r.size + ' bytes' : 'no readable text') + '</div>') + '</div>').join('') : '<div class="muted" style="margin-top:8px">No readable data stored on this tag.</div>') +
        (t.maxSize ? '<div class="muted" style="font-size:12px;margin-top:6px">Capacity ' + esc(String(t.maxSize)) + ' bytes · ' + (t.writable ? 'writable' : 'locked') + '</div>' : ''))).join('');
    };
    $('#list', el).onclick = (e) => { const b = e.target.closest('button[data-c]'); if (!b) return; const [i, j] = b.dataset.c.split(':').map(Number); const v = tags[i] && tags[i].records[j] && tags[i].records[j].value; if (v) copyToClipboard(v).then(ok => toast(ok ? 'Copied' : 'Could not copy')); };
    $('#clr', el).onclick = () => { tags = []; paint(); };
    (async () => {
      if (!native()) { $('#state', el).textContent = 'Not available'; $('#msg', el).textContent = WEB_MSG; return; }
      const p = PD(); let r;
      try { r = await p.startNfc(); } catch (e) { $('#state', el).textContent = 'Could not start'; $('#msg', el).textContent = errMsg(e); return; }
      if (gone) { try { p.stopNfc(); } catch (e) { /* ignore */ } return; }
      if (!r.available) { $('#state', el).textContent = 'No NFC in this phone'; $('#hint', el).textContent = ''; return; }
      if (!r.enabled) { $('#state', el).textContent = 'NFC is switched off'; $('#hint', el).textContent = 'Turn on NFC in the phone\'s Settings > Connected devices, then open this tool again.'; return; }
      $('#state', el).textContent = 'Ready: tap a tag';
      h = await p.addListener('nfc', (t) => { if (gone || !t) return; tags.unshift(t); if (tags.length > 20) tags.pop(); if (navigator.vibrate) navigator.vibrate(40); $('#state', el).textContent = 'Tag read'; paint(); });
    })();
    return () => { gone = true; try { if (h && h.remove) h.remove(); } catch (e) { /* ignore */ } try { const p = PD(); if (p) p.stopNfc(); } catch (e) { /* ignore */ } };
  } });

  /* ------------------------------------------------------------------ Battery Health */
  Tools.register({ id: 'batteryhealth', name: 'Battery Health', icon: '🪫', cat: 'daily', desc: 'Shows your battery level, health, temperature, voltage and charging state, and the charge or drain current when the phone reports it. Updates live.', keys: ['battery', 'charging', 'temperature', 'voltage', 'health', 'mah'], needs: [], render(el) {
    el.innerHTML = '<div id="msg" class="muted center" style="min-height:18px"></div>' +
      card('<div class="center muted" style="font-size:13px" id="st">Reading...</div><div class="big" id="pc" aria-live="polite">--</div><div class="progress" style="margin:8px 0" aria-hidden="true"><i id="pb" style="width:0%"></i></div><div class="center" id="hl" style="font-size:18px;font-weight:700"></div>') +
      '<div class="list" id="rows"></div>' +
      note('Android does not share a battery\'s age, cycle count or design capacity with apps, so those cannot be shown. "State of health" appears only on phones with Android 14 or newer that report it. Temperatures above 45 °C while charging are worth a break.');
    let gone = false, timer = null;
    async function poll() {
      if (!native()) { $('#msg', el).textContent = WEB_MSG; $('#st', el).textContent = 'Not available'; return; }
      let r; try { r = await PD().batteryHealth(); } catch (e) { $('#msg', el).textContent = errMsg(e); return; }
      if (gone) return;
      $('#st', el).textContent = r.status || '';
      $('#pc', el).textContent = Number.isFinite(r.percent) ? r.percent + '%' : '--';
      $('#pb', el).style.width = clamp(r.percent || 0, 0, 100) + '%';
      $('#hl', el).textContent = r.health ? 'Health: ' + r.health : '';
      const row = (k, v) => '<div class="item"><span class="grow">' + esc(k) + '</span><b>' + esc(v) + '</b></div>';
      $('#rows', el).innerHTML = [
        Number.isFinite(r.temperatureC) ? row('Temperature', fixN(r.temperatureC, 1) + ' °C  (' + fixN(r.temperatureC * 9 / 5 + 32, 1) + ' °F)') : '',
        Number.isFinite(r.voltageMv) ? row('Voltage', fixN(r.voltageMv / 1000, 2) + ' V') : '',
        r.plugged ? row('Plugged in', r.plugged) : '',
        Number.isFinite(r.currentMa) ? row(r.currentMa > 0 === (r.status === 'Charging') ? 'Current' : 'Current (sign varies by phone)', Math.abs(r.currentMa) + ' mA') : '',
        Number.isFinite(r.chargeMah) ? row('Charge left (approx.)', r.chargeMah + ' mAh') : '',
        Number.isFinite(r.stateOfHealth) ? row('State of health', r.stateOfHealth + '%') : '',
        r.technology ? row('Technology', r.technology) : ''
      ].join('');
      timer = setTimeout(poll, 3000);
    }
    poll();
    return () => { gone = true; clearTimeout(timer); };
  } });

  /* ------------------------------------------------------------------ Storage Info */
  Tools.register({ id: 'storageinfo', name: 'Storage Info', icon: '🗄️', cat: 'daily', desc: 'Shows how full your phone\'s storage is and how much space PocketKit uses, with a button to clear PocketKit\'s temporary files. Your saved data is never touched.', keys: ['storage', 'space', 'memory', 'free', 'cache', 'disk'], needs: [], render(el) {
    el.innerHTML = '<div id="msg" class="muted center" style="min-height:18px"></div>' +
      card('<div class="center muted" style="font-size:13px">Phone storage used</div><div class="big" id="pct" aria-live="polite">--</div><div class="progress" style="margin:8px 0" aria-hidden="true"><i id="bar" style="width:0%"></i></div><div class="row center"><div><div class="mid" id="free">--</div><small class="muted">Free</small></div><div><div class="mid" id="total">--</div><small class="muted">Total</small></div></div>') +
      card('<b>PocketKit</b><div class="list" style="margin-top:8px"><div class="item"><span class="grow">Temporary files (cache)</span><b id="cache">--</b></div><div class="item"><span class="grow">Saved data and files</span><b id="data">--</b></div></div><button class="btn alt" id="clear" style="width:100%;margin-top:10px">Clear temporary files</button>') +
      note('Temporary files are copies made when you share or export something. Clearing them frees space and does not delete notes, lists, recordings, locked files or settings. Other apps\' sizes are not visible to PocketKit.');
    let gone = false;
    async function load() {
      if (!native()) { $('#msg', el).textContent = WEB_MSG; return; }
      let r; try { r = await PD().storageInfo(); } catch (e) { $('#msg', el).textContent = errMsg(e); return; }
      if (gone) return;
      const used = (r.totalBytes || 0) - (r.freeBytes || 0), pct = r.totalBytes ? used / r.totalBytes * 100 : NaN;
      $('#pct', el).textContent = Number.isFinite(pct) ? Math.round(pct) + '%' : '--'; $('#bar', el).style.width = clamp(pct || 0, 0, 100) + '%';
      $('#free', el).textContent = bytes(r.freeBytes); $('#total', el).textContent = bytes(r.totalBytes);
      $('#cache', el).textContent = bytes(r.appCacheBytes); $('#data', el).textContent = bytes(r.appDataBytes);
    }
    $('#clear', el).onclick = async () => {
      if (!native()) { toast('Only in the installed app'); return; }
      try { const r = await PD().clearAppCache(); toast(r.ok ? 'Temporary files cleared' : 'Some files could not be removed'); load(); } catch (e) { toast('Could not clear'); }
    };
    load();
    return () => { gone = true; };
  } });
})();
