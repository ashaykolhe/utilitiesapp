'use strict';
Tools.register({ id: 'deviceinfo', name: 'Device Info', icon: '📱', cat: 'daily', desc: 'Screen, memory, processor, language, battery and browser details of this phone.', needs: [], render(el) {
  const rows = [
    ['Screen', `${screen.width} × ${screen.height}`], ['Pixel ratio', devicePixelRatio], ['Language', navigator.language],
    ['CPU cores', navigator.hardwareConcurrency || 'n/a'], ['Memory (approx.)', navigator.deviceMemory ? navigator.deviceMemory + ' GB' : 'n/a'],
    ['Online', navigator.onLine ? 'Yes' : 'No'], ['Touch points', navigator.maxTouchPoints || 0], ['User agent', navigator.userAgent]
  ];
  el.innerHTML = '<div class="list" id="l"></div><button class="btn alt" id="cp" style="margin-top:12px">Copy details</button>';
  let shown = rows;
  const draw = (extra) => {
    shown = rows.concat(extra || []);
    $('#l', el).innerHTML = shown.map(r => `<div class="item"><span class="grow">${esc(r[0])}</span><b style="max-width:60%;word-break:break-word;text-align:right">${esc(r[1])}</b></div>`).join('');
  };
  $('#cp', el).onclick = async () => { toast(await copyToClipboard(shown.map(r => r[0] + ': ' + r[1]).join(String.fromCharCode(10))) ? 'Details copied' : 'Could not copy'); };
  draw();
  if (navigator.getBattery) navigator.getBattery().then(b => draw([['Battery', Math.round(b.level * 100) + '%' + (b.charging ? ' (charging)' : '')]]));
} });
