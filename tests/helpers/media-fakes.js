'use strict';
/* Stand-ins for the camera, microphone, Web Audio, MediaRecorder and IndexedDB, so the audio and camera tools can be driven in jsdom.
   Usage:
     const { bootMedia } = require('../helpers/media-fakes');
     const { page, M } = await bootMedia();      // M controls the fakes and records what the tools did
     M.mode = 'denied';                          // getUserMedia rejects with NotAllowedError ('notfound', 'busy', 'ok')
     M.liveTracks()                              // tracks handed out and not yet stopped
     M.ctxs / M.openCtxs()                       // AudioContexts created / not yet closed
     M.live()                                    // { intervals, frames } still scheduled (by the tools: compare with a baseline) */
const { boot } = require('./page');

function bootMedia(extra) {
  const M = {
    mode: 'ok', delay: 0, calls: [], streams: [], applied: [], ctxs: [], now: 0, vw: 0, vh: 0,
    torch: false, zoom: null, failAudio: false, torchFail: false,
    sig: null,            // function (Float32Array buf, sampleRate) filling analyser time-domain data
    bytes: null,          // function (Uint8Array) filling analyser frequency data
    confirms: [], recorders: [], opened: [], clipboard: [], downloads: [],
    liveTracks() { const out = []; M.streams.forEach(s => s.getTracks().forEach(t => { if (!t.stopped) out.push(t); })); return out; },
    stoppedCount() { let n = 0; M.streams.forEach(s => s.getTracks().forEach(t => { n += t.stopped; })); return n; },
    openCtxs() { return M.ctxs.filter(c => c.state !== 'closed'); },
    live() { return { intervals: M._iv.size, frames: M._raf.size }; },
    _iv: new Set(), _raf: new Set()
  };
  const beforeParse = (w) => {
    class Param { constructor(v) { this.value = v || 0; this.log = []; } setValueAtTime(v, t) { this.value = v; this.log.push(['set', v, t]); return this; } linearRampToValueAtTime(v, t) { this.log.push(['lin', v, t]); return this; } exponentialRampToValueAtTime(v, t) { this.log.push(['exp', v, t]); return this; } setTargetAtTime(v, t, c) { this.target = v; this.log.push(['target', v, t, c]); return this; } cancelScheduledValues() { return this; } }
    class FNode {
      constructor(ctx, kind) { this.ctx = ctx; this.kind = kind; ['gain', 'frequency', 'detune', 'Q', 'pan', 'threshold', 'knee', 'ratio', 'attack', 'release', 'playbackRate'].forEach(p => { this[p] = new Param(); }); }
      connect(x) { return x; } disconnect() {} start(t) { this.started = true; this.startAt = t; } stop(t) { this.stopped = true; this.stopAt = t; }
    }
    class Analyser extends FNode {
      constructor(ctx) { super(ctx, 'analyser'); this.fftSize = 2048; this.smoothingTimeConstant = 0; }
      get frequencyBinCount() { return this.fftSize / 2; }
      getFloatTimeDomainData(b) { if (M.sig) M.sig(b, this.ctx.sampleRate); else b.fill(0); }
      getByteTimeDomainData(b) { b.fill(128); }
      getByteFrequencyData(b) { if (M.bytes) M.bytes(b); else b.fill(0); }
    }
    class Ctx {
      constructor() { this.state = 'suspended'; this.sampleRate = 48000; this.destination = new FNode(this, 'destination'); this.nodes = []; this.sources = []; M.ctxs.push(this); }
      get currentTime() { return M.now; }
      resume() { if (this.state !== 'closed') this.state = 'running'; return Promise.resolve(); }
      close() { if (this.state === 'closed') return Promise.reject(new Error('InvalidStateError')); this.state = 'closed'; return Promise.resolve(); }
      _n(k) { const n = new FNode(this, k); this.nodes.push(n); return n; }
      createOscillator() { return this._n('osc'); } createGain() { return this._n('gain'); } createBiquadFilter() { return this._n('biquad'); }
      createDynamicsCompressor() { return this._n('comp'); } createStereoPanner() { return this._n('pan'); } createBufferSource() { return this._n('bufsrc'); }
      createAnalyser() { const a = new Analyser(this); this.nodes.push(a); return a; }
      createMediaStreamSource(s) { this.sources.push(s); return this._n('mss'); } createMediaElementSource() { return this._n('mes'); }
      createBuffer(ch, len, sr) { const d = new Float32Array(len); return { length: len, sampleRate: sr, numberOfChannels: ch, getChannelData() { return d; } }; }
      oscs() { return this.nodes.filter(n => n.kind === 'osc'); }
    }
    w.AudioContext = w.webkitAudioContext = Ctx;

    class Track {
      constructor(kind) { this.kind = kind; this.stopped = 0; this.readyState = 'live'; this.l = {}; }
      stop() { this.stopped++; this.readyState = 'ended'; }
      getCapabilities() { if (this.kind !== 'video') return {}; const c = {}; if (M.torch) c.torch = true; if (M.zoom) c.zoom = M.zoom; return c; }
      applyConstraints(c) { M.applied.push(c); if (M.torchFail && c.advanced && c.advanced[0] && 'torch' in c.advanced[0]) return Promise.reject(new Error('torch')); return Promise.resolve(); }
      getSettings() { return {}; }
      addEventListener(t, f) { (this.l[t] = this.l[t] || []).push(f); } removeEventListener() {}
      fire(t) { (this.l[t] || []).forEach(f => f()); }
    }
    class Stream { constructor(tracks) { this.tracks = tracks; } getTracks() { return this.tracks; } getVideoTracks() { return this.tracks.filter(t => t.kind === 'video'); } getAudioTracks() { return this.tracks.filter(t => t.kind === 'audio'); } }
    const err = (name) => { const e = new Error(name); e.name = name; return e; };
    const gum = (c) => {
      M.calls.push(c);
      const go = () => {
        const wantsAudio = c && c.audio, wantsVideo = c && c.video;
        if (M.mode === 'denied') throw err('NotAllowedError');
        if (M.mode === 'notfound') throw err('NotFoundError');
        if (M.mode === 'busy') throw err('NotReadableError');
        if (M.mode === 'overconstrained' && wantsVideo && typeof wantsVideo === 'object') throw err('OverconstrainedError');
        if (M.failAudio && wantsAudio && wantsVideo) throw err('NotAllowedError');
        const t = []; if (wantsVideo) t.push(new Track('video')); if (wantsAudio) t.push(new Track('audio'));
        const s = new Stream(t); M.streams.push(s); return s;
      };
      return new Promise((res, rej) => setTimeout(() => { try { res(go()); } catch (e) { rej(e); } }, M.delay));
    };
    const md = { getUserMedia: gum };
    Object.defineProperty(w.navigator, 'mediaDevices', { value: md, configurable: true });
    M.setNoMediaDevices = () => Object.defineProperty(w.navigator, 'mediaDevices', { value: undefined, configurable: true });
    M.restoreMedia = () => Object.defineProperty(w.navigator, 'mediaDevices', { value: md, configurable: true });
    Object.defineProperty(w.HTMLVideoElement.prototype, 'videoWidth', { get() { return M.vw; }, configurable: true });
    Object.defineProperty(w.HTMLVideoElement.prototype, 'videoHeight', { get() { return M.vh; }, configurable: true });

    class Rec {
      constructor(stream, o) { this.stream = stream; this.mimeType = (o && o.mimeType) || ''; this.state = 'inactive'; this.starts = 0; M.recorders.push(this); }
      start() { this.state = 'recording'; this.starts++; }
      pause() { this.state = 'paused'; } resume() { this.state = 'recording'; }
      stop() { this.state = 'inactive'; if (this.data !== null) { this.ondataavailable && this.ondataavailable({ data: new w.Blob([this.data || 'abcdefgh'], { type: this.mimeType || 'audio/webm' }) }); } setTimeout(() => this.onstop && this.onstop(), 0); }
      static isTypeSupported(t) { return /webm/.test(t); }
    }
    w.MediaRecorder = Rec;

    /* Timers and frames the tools leave running */
    const siv = w.setInterval.bind(w), civ = w.clearInterval.bind(w);
    w.setInterval = (f, ms, ...a) => { const id = siv(f, ms, ...a); M._iv.add(id); return id; };
    w.clearInterval = (id) => { M._iv.delete(id); civ(id); };
    const raf = w.requestAnimationFrame.bind(w), caf = w.cancelAnimationFrame.bind(w);
    w.requestAnimationFrame = (f) => { let id; id = raf((t) => { M._raf.delete(id); f(t); }); M._raf.add(id); return id; };
    w.cancelAnimationFrame = (id) => { M._raf.delete(id); caf(id); };

    /* IndexedDB that keeps object references (blobs) */
    const dbs = {};
    w.indexedDB = {
      open(name) {
        const req = {};
        setTimeout(() => {
          let d = dbs[name]; const fresh = !d; if (fresh) d = dbs[name] = { stores: {} };
          const db = {
            createObjectStore(n, o) { d.stores[n] = { rows: new Map(), seq: 0, key: o.keyPath }; return {}; },
            transaction(n) {
              const st = d.stores[n], t = {};
              const mk = (fn) => { const rq = {}; try { rq.result = fn(); } catch (e) { setTimeout(() => { t.error = e; t.onerror && t.onerror(); }, 0); return rq; } setTimeout(() => t.oncomplete && t.oncomplete(), 0); return rq; };
              t.objectStore = () => ({
                getAll: () => mk(() => [...st.rows.values()]),
                add: (v) => mk(() => { const k = ++st.seq; v[st.key] = k; st.rows.set(k, v); return k; }),
                put: (v) => mk(() => { st.rows.set(v[st.key], v); return v[st.key]; }),
                delete: (k) => mk(() => { st.rows.delete(k); })
              });
              return t;
            },
            close() { db.closed = true; }
          };
          req.result = db; M.db = db;
          if (fresh && req.onupgradeneeded) req.onupgradeneeded();
          req.onsuccess && req.onsuccess();
        }, 0);
        return req;
      }
    };

    const aclick = w.HTMLElement.prototype.click;
    w.HTMLAnchorElement.prototype.click = function () { if (this.hasAttribute('download')) { M.downloads.push({ name: this.getAttribute('download'), href: this.getAttribute('href') }); return; } return aclick.call(this); };

    /* Canvas that records its calls and returns the pixels the test provides (M.pixels(w, h, x, y)), pictures and bitmaps of the size M.imgW x M.imgH */
    M.canvasCalls = []; M.canvases = []; M.inputs = []; M.bitmaps = []; M.imgW = 640; M.imgH = 480; M.noFilter = false; M.noWebp = false; M.pixels = null; M.imgFail = false; M.bitmapFail = null; M.blobSize = 3; M.wake = { requests: 0, released: 0 };
    const spyCtx = (cv) => {
      if (cv.__ctx) return cv.__ctx;
      const store = { canvas: cv };
      const gradient = { addColorStop() {} };
      const p = new Proxy(store, {
        get(t, k) {
          if (k in t) return t[k];
          if (typeof k === 'symbol') return undefined;
          if (k === 'getImageData') return (x, y, w, h) => { M.canvasCalls.push(['getImageData', x, y, w, h]); return { data: M.pixels ? M.pixels(w, h, x, y, cv) : new Uint8ClampedArray(w * h * 4), width: w, height: h }; };
          if (k === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
          if (k === 'putImageData') return (img, x, y) => { M.canvasCalls.push(['putImageData', img.width, img.height]); cv.__put = img; };
          if (k === 'measureText') return () => ({ width: 10 });
          if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => gradient;
          return (...a) => { M.canvasCalls.push([k, ...a]); };
        },
        set(t, k, v) { t[k] = v; return true; },
        has(t, k) { return k === 'filter' ? !M.noFilter : k in t; }
      });
      cv.__ctx = p; return p;
    };
    w.HTMLCanvasElement.prototype.getContext = function () { return spyCtx(this); };
    w.HTMLCanvasElement.prototype.toBlob = function (cb, type, q) { const t = (M.noWebp && type === 'image/webp') ? 'image/png' : (type || 'image/png'); M.canvasCalls.push(['toBlob', type, q, this.width, this.height]); cb(new w.Blob(['x'.repeat(M.blobSize)], { type: t })); };
    w.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/jpeg;base64,AAAA'; };
    if (!w.ImageData) w.ImageData = class { constructor(a, b, c) { if (typeof a === 'number') { this.width = a; this.height = b; this.data = new Uint8ClampedArray(a * b * 4); } else { this.data = a; this.width = b; this.height = c; } } };
    w.Image = class { constructor() { this.naturalWidth = 0; this.naturalHeight = 0; } set src(v) { this._s = v; setTimeout(() => { if (M.imgFail) { this.onerror && this.onerror(new Error('bad image')); } else { this.naturalWidth = this.width = M.imgW; this.naturalHeight = this.height = M.imgH; this.onload && this.onload(); } }, 0); } get src() { return this._s; } };
    w.createImageBitmap = async (src, o) => {
      if (M.bitmapFail && M.bitmapFail(src)) throw new Error('decode failed');
      const b = { width: (o && o.resizeWidth) || M.imgW, height: (o && o.resizeHeight) || M.imgH, closed: 0, close() { this.closed++; } }; M.bitmaps.push(b); return b;
    };
    w.HTMLCanvasElement.prototype.captureStream = function () { const tr = new Track('video'); return { getTracks: () => [tr] }; };
    const ce = w.document.createElement.bind(w.document);
    w.document.createElement = (tag, o) => { const e = ce(tag, o), n = String(tag).toLowerCase(); if (n === 'canvas') M.canvases.push(e); if (n === 'input') M.inputs.push(e); return e; };
    /* choose files in the last file input a tool created (pickFiles makes a detached one) */
    M.pick = (files, input) => { const i = input || M.inputs[M.inputs.length - 1]; Object.defineProperty(i, 'files', { value: files, configurable: true }); i.onchange && i.onchange(); return i; };
    M.file = (name, type, size, bytes) => new w.File([bytes || 'x'.repeat(size === undefined ? 10 : size)], name, { type });
    w.Element.prototype.setPointerCapture = function (id) { this.__cap = id; }; w.Element.prototype.releasePointerCapture = function () { this.__cap = null; }; w.Element.prototype.hasPointerCapture = function (id) { return this.__cap === id; };
    Object.defineProperty(w.navigator, 'wakeLock', { value: { request: async () => { M.wake.requests++; return { release: async () => { M.wake.released++; }, addEventListener() {} }; } }, configurable: true });
    w.confirm = (m) => { M.confirms.push(m); return M.confirmAnswer !== false; };
    w.open = (u) => { M.opened.push(u); return null; };
    let n = 0; w.URL.createObjectURL = () => 'blob:fake/' + (++n); w.URL.revokeObjectURL = () => {};
    if (!w.navigator.clipboard) Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: (t) => { M.clipboard.push(t); return Promise.resolve(); } }, configurable: true });
    if (extra) extra(w, M);
  };
  return boot({ beforeParse }).then(page => ({ page, M }));
}

/* A sine of f Hz with the given amplitude for M.sig */
const sine = (f, amp) => (buf, sr) => { for (let i = 0; i < buf.length; i++) buf[i] = (amp || 0.5) * Math.sin(2 * Math.PI * f * i / sr); };
module.exports = { bootMedia, sine };
