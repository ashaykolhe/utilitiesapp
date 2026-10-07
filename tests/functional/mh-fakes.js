'use strict';
/* Shared stand-ins for the measure / health / sensor functional tests (not a test itself: the runner only runs *.test.js).
   boot() = the normal page harness plus:
     fake.*       a fake native "PocketSensors" plugin (Capacitor.Plugins.PocketSensors) with emit(type, values), started/stopped logs
     geo.*        a scripted navigator.geolocation (watchPosition / clearWatch)
     motion(...)  dispatches 'devicemotion' like the phone does (and orient(...) for device orientation)
     live(type)   how many listeners are still attached to window for that event type */
const { boot: baseBoot } = require('../helpers/page');

async function boot(opts) {
  opts = opts || {};
  const fake = {
    native: opts.native !== false, avail: opts.avail || {}, started: {}, startLog: [], stopLog: [], listeners: [],
    battery: opts.battery === undefined ? { temperatureC: 31.5, level: 80 } : opts.battery,
    network: opts.network === undefined ? { type: 'wifi', dbm: -55, validated: true, linkMbps: 433, freqMhz: 5180, metered: false } : opts.network,
    sensors: opts.sensors || [], hasMap: opts.has || {}, calls: { network: 0, battery: 0 },
    emit(type, values, accuracy) { this.listeners.forEach(cb => cb({ type, values, accuracy: accuracy == null ? 3 : accuracy, t: Date.now() })); }
  };
  const geo = {
    watchers: new Map(), cleared: [], n: 0,
    emit(coords, ts) { const p = { coords: Object.assign({ accuracy: 5, altitude: null, altitudeAccuracy: null, speed: null }, coords), timestamp: ts == null ? Date.now() : ts }; [...this.watchers.values()].forEach(w => w.ok(p)); },
    fail(code) { [...this.watchers.values()].forEach(w => w.err && w.err({ code })); }
  };
  const active = new Map(); // event type -> Set of listeners on window
  const page = await baseBoot({
    beforeParse(w) {
      w.Capacitor = {
        isNativePlatform: () => fake.native,
        Plugins: {
          PocketSensors: {
            addListener(name, cb) { if (name === 'sensor') fake.listeners.push(cb); return Promise.resolve({ remove() {} }); },
            async hasSensor(o) { return { available: !!fake.hasMap[o.type] }; },
            async startSensor(o) { fake.startLog.push(o.type); if (fake.avail[o.type]) { fake.started[o.type] = (fake.started[o.type] || 0) + 1; return { available: true, maxRange: (fake.maxRange || {})[o.type] }; } return { available: false }; },
            async stopSensor(o) { fake.stopLog.push(o.type); delete fake.started[o.type]; return {}; },
            async listSensors() { return { sensors: fake.sensors }; },
            async networkSignal() { fake.calls.network++; return fake.network; },
            async batteryInfo() { fake.calls.battery++; return fake.battery; }
          }
        }
      };
      Object.defineProperty(w.navigator, 'geolocation', { configurable: true, value: {
        watchPosition(ok, err) { const id = ++geo.n; geo.watchers.set(id, { ok, err }); return id; },
        clearWatch(id) { geo.watchers.delete(id); geo.cleared.push(id); }
      } });
      const add = w.addEventListener.bind(w), rem = w.removeEventListener.bind(w);
      w.addEventListener = (t, f, o) => { if (!active.has(t)) active.set(t, new Set()); active.get(t).add(f); return add(t, f, o); };
      w.removeEventListener = (t, f, o) => { if (active.has(t)) active.get(t).delete(f); return rem(t, f, o); };
      w.DeviceMotionEvent = function DeviceMotionEvent() {};
      w.DeviceOrientationEvent = function DeviceOrientationEvent() {};
    }
  });
  const w = page.w;
  const G = 9.80665;
  const ev = (type, props) => { const e = new w.Event(type); const ts = props && props.timeStamp; if (props) { props = Object.assign({}, props); delete props.timeStamp; } Object.assign(e, props); if (ts != null) Object.defineProperty(e, 'timeStamp', { value: ts }); w.dispatchEvent(e); };
  /* skip(ms): jumps the page's Date forward (setInterval stays real, so wait ~150 ms afterwards for the tool to tick) */
  w.eval('(function(){var R=Date,off=0;window.__skip=function(ms){off+=ms;};window.Date=class extends R{constructor(...a){if(a.length)super(...a);else super(R.now()+off);}static now(){return R.now()+off;}};})()');
  const clock = { t: 100000 }; try { w.performance.now = () => clock.t; } catch (e) { /* keep real clock */ }
  const out = Object.assign(page, {
    clock, tick(ms) { clock.t += ms; }, skip(ms) { w.__skip(ms); },
    fake, geo, G,
    live: (t) => (active.get(t) ? active.get(t).size : 0),
    /* accelerometer sample: g = accelerationIncludingGravity {x,y,z} (m/s2), a = optional gravity-free acceleration */
    motion(g, a, n, ts) { for (let i = 0; i < (n || 1); i++) ev('devicemotion', { accelerationIncludingGravity: g, acceleration: a || null, interval: 16, timeStamp: ts }); },
    orient(o, type) { ev(type || 'deviceorientation', o); },
    noMotionApi() { w.DeviceMotionEvent = undefined; },
    motionApi(permission) { w.DeviceMotionEvent = function () {}; if (permission) w.DeviceMotionEvent.requestPermission = permission; },
    orientApi(permission) { w.DeviceOrientationEvent = function () {}; if (permission) w.DeviceOrientationEvent.requestPermission = permission; },
    store: (k, d) => w.eval('Store.get(' + JSON.stringify(k) + ',' + JSON.stringify(d === undefined ? null : d) + ')')
  });
  return out;
}
module.exports = { boot };
