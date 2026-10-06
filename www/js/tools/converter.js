'use strict';
const UNITS = {
  Length: { m: 1, km: 1000, cm: .01, mm: .001, mile: 1609.344, yard: .9144, foot: .3048, inch: .0254 },
  Weight: { kg: 1, g: .001, mg: 1e-6, lb: .45359237, oz: .028349523, tonne: 1000 },
  Volume: { L: 1, mL: .001, 'gal (US)': 3.785411784, 'cup (US)': .2365882365, 'fl oz (US)': .0295735296 },
  Area: { 'm²': 1, 'km²': 1e6, 'ft²': .09290304, acre: 4046.8564224, hectare: 1e4 },
  Speed: { 'm/s': 1, 'km/h': 1 / 3.6, mph: .44704, knot: .514444 },
  Data: { B: 1, KB: 1024, MB: 1048576, GB: 1073741824, TB: 1099511627776 },
  Time: { sec: 1, min: 60, hour: 3600, day: 86400, week: 604800 }
};
Tools.register({ id: 'converter', name: 'Unit Converter', icon: '🔁', cat: 'calculate', desc: 'Convert length, weight, volume, area, speed, data, time and temperature.', needs: [], render(el) {
  el.innerHTML = `<label class="f" for="t">Category</label><select id="t">${Object.keys(UNITS).concat('Temperature').map(k => `<option>${k}</option>`).join('')}</select>
    <div class="card list"><label class="f" for="v">Value</label><input id="v" type="number" value="1" min="-1000000000000" max="1000000000000" step="any" inputmode="decimal"><label class="f" for="a">From</label><select id="a"></select>
    <div class="center muted">=</div><div class="mid" id="o" role="status" aria-live="polite"></div><label class="f" for="b">To</label><select id="b"></select></div>`;
  const temp = { C: 1, F: 1, K: 1 };
  let timer = null;
  // the result is kept in the history once the person has stopped typing or choosing for a moment
  const settle = () => {
    const o = $('#o', el).textContent;
    if (!o || o === '—') return;
    try { if (typeof Hist !== 'undefined') Hist.add('converter', $('#t', el).value + ': ' + +parseFloat($('#v', el).value).toPrecision(10) + ' ' + $('#a', el).value, o); } catch (e) { /* history is optional */ }
  };
  const later = () => { clearTimeout(timer); timer = setTimeout(settle, 1500); };
  const fill = () => {
    const names = Object.keys($('#t', el).value === 'Temperature' ? temp : UNITS[$('#t', el).value]);
    $('#a', el).innerHTML = names.map(n => `<option>${esc(n)}</option>`).join('');
    $('#b', el).innerHTML = $('#a', el).innerHTML; $('#b', el).selectedIndex = Math.min(1, names.length - 1); calc();
  };
  const toC = (v, u) => u === 'C' ? v : u === 'F' ? (v - 32) * 5 / 9 : v - 273.15;
  const fromC = (c, u) => u === 'C' ? c : u === 'F' ? c * 9 / 5 + 32 : c + 273.15;
  function calc() {
    const type = $('#t', el).value, v = parseFloat($('#v', el).value), a = $('#a', el).value, b = $('#b', el).value;
    if (!Number.isFinite(v)) { $('#o', el).textContent = '—'; return; }
    const r = type === 'Temperature' ? fromC(toC(v, a), b) : v * UNITS[type][a] / UNITS[type][b];
    $('#o', el).textContent = Number.isFinite(r) ? +r.toPrecision(10) + ' ' + b : '—';
  }
  $('#t', el).onchange = () => { fill(); later(); }; ['v', 'a', 'b'].forEach(i => { $('#' + i, el).oninput = () => { calc(); later(); }; });
  fill();
  return () => clearTimeout(timer);
} });
