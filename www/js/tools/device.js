'use strict';
Tools.register({ id: 'deviceinfo', name: 'Device Info', icon: '📱', cat: 'daily', desc: 'Screen, memory, processor, language, battery and browser details of this phone.', needs: [], render(el) {
  const rows = [
    ['Screen', `${screen.width} × ${screen.height}`], ['Pixel ratio', devicePixelRatio], ['Language', navigator.language],
    ['CPU cores', navigator.hardwareConcurrency || 'n/a'], ['Memory (approx.)', navigator.deviceMemory ? navigator.deviceMemory + ' GB' : 'n/a'],
    ['Online', navigator.onLine ? 'Yes' : 'No'], ['Touch points', navigator.maxTouchPoints], ['User agent', navigator.userAgent]
  ];
  el.innerHTML = '<div class="list" id="l"></div>';
  const draw = (extra) => {
    $('#l', el).innerHTML = rows.concat(extra || []).map(r => `<div class="item"><span class="grow">${esc(r[0])}</span><b style="max-width:60%;word-break:break-word;text-align:right">${esc(r[1])}</b></div>`).join('');
  };
  draw();
  if (navigator.getBattery) navigator.getBattery().then(b => draw([['Battery', Math.round(b.level * 100) + '%' + (b.charging ? ' (charging)' : '')]]));
} });
