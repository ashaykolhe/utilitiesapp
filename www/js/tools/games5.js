'use strict';
/* Arcade games 5: Star Defender, Rock Blaster, Road Hopper, Sprint Runner, Sky Jumper, Tower Stack, Bubble Pop, Maze Chase.
   Every game is a pure model G.<id> = { make(seed), step(s, dt) } (the parts between the LOGIC markers, tested in Node by
   tests/games5.test.js) plus a draw function and a few pointer handlers; host() supplies canvas, loop, pause and scores. */
(() => {
  /* LOGIC-START */
  const G = {};
  function mkRng(seed) {
    let a = (seed >>> 0) || 1;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const clampN = (v, a, b) => Math.min(b, Math.max(a, v));
  const rectHit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const circHit = (ax, ay, ar, bx, by, br) => { const dx = ax - bx, dy = ay - by, r = ar + br; return dx * dx + dy * dy < r * r; };
  const modN = (a, n) => ((a % n) + n) % n;
  /* LOGIC-END */

  const CSS = `
.g5{max-width:360px;margin:0 auto}
.g5bar{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;font-size:15px}
.g5bar b{font-size:18px}
.g5bar button{min-height:44px;padding:0 12px}
.g5w{position:relative;touch-action:none;user-select:none;-webkit-user-select:none;border-radius:12px;overflow:hidden;background:var(--surface);border:1px solid var(--line)}
.g5w canvas{display:block;width:100%;height:auto}
.g5ov{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:rgba(0,0,0,.62);color:#fff;text-align:center;padding:16px}
.g5ov h3{margin:0;font-size:22px}
.g5ov p{margin:0;font-size:14px;opacity:.9}
.g5ov button{min-height:48px;min-width:140px;font-size:16px}
.g5ov[hidden]{display:none}
.g5x{margin-top:8px;display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap}
.g5x button{min-height:56px;min-width:96px;touch-action:none}
.g5hint{margin:8px 0 0;font-size:13px;text-align:center;color:var(--muted)}
`;

  function fitCanvas(cv, w, h) {
    const d = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    cv.width = Math.round(w * d); cv.height = Math.round(h * d); cv._lw = w; cv._lh = h;
    const c = cv.getContext('2d'); if (c && c.setTransform) c.setTransform(d, 0, 0, d, 0, 0);
    return c;
  }
  function ptrPos(cv, e) {
    const r = cv.getBoundingClientRect(), lw = cv._lw || cv.width, lh = cv._lh || cv.height;
    const sx = r.width > 1 ? lw / r.width : 1, sy = r.height > 1 ? lh / r.height : 1;
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  }
  function theme(node) {
    const cs = getComputedStyle(node), g = (n, f) => (cs.getPropertyValue(n) || '').trim() || f;
    return { text: g('--text', '#eee'), muted: g('--muted', '#999'), surface: g('--surface', '#222'), surface2: g('--surface2', '#333'), line: g('--line', '#444'), accent: g('--accent', '#4af'), danger: g('--danger', '#e55'), ok: g('--ok', '#4c8') };
  }
  /* Shared game host. def: id, W, H, make(seed), step(s, dt), draw(ctx, s, C), ptr {down, move, up}(s, pt, e), extra (html), setup(root, T, ctl), hint, wake */
  function host(el, def) {
    const offs = [];
    let dead = false, raf = 0, status = 'ready', dirty = true, last = 0, lock = null, s = def.make(Date.now() & 0xffffff);
    let best = Store.get('fun3.' + def.id, 0); if (!(best >= 0)) best = 0;
    const T = {
      on(t, ty, fn, o) { t.addEventListener(ty, fn, o); offs.push(() => t.removeEventListener(ty, fn, o)); },
      undo(fn) { offs.push(fn); },
      dead: () => dead
    };
    el.innerHTML = '<style>' + CSS + '</style><div class="g5"><div class="g5bar"><span>Score <b id="sc">0</b></span><span>Best <b id="bs">' + best + '</b></span>' +
      '<button class="btn alt" id="pz" aria-label="Pause">Pause</button></div>' +
      '<div class="g5w" id="w"><canvas id="cv" aria-label="' + esc(def.id) + ' game area"></canvas><div class="g5ov" id="ov"></div></div>' +
      (def.extra ? '<div class="g5x" id="ex">' + def.extra + '</div>' : '') + '<p class="g5hint">' + esc(def.hint || '') + '</p></div>';
    const root = $('.g5', el), cv = $('#cv', root), wrap = $('#w', root), ov = $('#ov', root), ctx = fitCanvas(cv, def.W, def.H);
    const C = theme(root), scEl = $('#sc', root), bsEl = $('#bs', root), pz = $('#pz', root);
    let shownScore = -1;
    function overlay(title, text, btn) {
      ov.hidden = false; ov.innerHTML = '<h3>' + esc(title) + '</h3><p>' + esc(text) + '</p><button class="btn" id="go">' + esc(btn) + '</button>';
    }
    function getLock() {
      if (!def.wake) return;
      try { if (navigator.wakeLock && navigator.wakeLock.request) navigator.wakeLock.request('screen').then(l => { if (dead) l.release().catch(() => {}); else lock = l; }, () => {}); } catch (e) { /* unsupported */ }
    }
    function dropLock() { try { if (lock) lock.release().catch(() => {}); } catch (e) { /* ignore */ } lock = null; }
    function start() {
      if (status === 'over' || status === 'ready' && s.started) { s = def.make(Date.now() & 0xffffff); }
      s.started = true; ov.hidden = true; status = 'play'; last = 0; pz.textContent = 'Pause'; getLock();
      if (def.onStart) def.onStart(s);
    }
    function pause() {
      if (status !== 'play') return;
      status = 'paused'; dirty = true; dropLock(); pz.textContent = 'Resume';
      overlay('Paused', 'Score ' + Math.floor(s.score), 'Resume');
    }
    function resume() { if (status === 'paused') { ov.hidden = true; status = 'play'; last = 0; pz.textContent = 'Pause'; getLock(); } }
    function finish() {
      status = 'over'; dirty = true; dropLock(); pz.textContent = 'Pause';
      const sc = Math.floor(s.score); let nb = false;
      if (sc > best) { best = sc; nb = true; Store.set('fun3.' + def.id, best); }
      bsEl.textContent = best;
      overlay('Game over', 'Score ' + sc + ' - Best ' + best + (nb && sc > 0 ? ' - New best!' : ''), 'Play again');
    }
    ov.addEventListener('click', (e) => {
      if (!e.target.closest('#go')) return;
      if (status === 'paused') resume(); else start();
    });
    pz.addEventListener('click', () => { if (status === 'play') pause(); else if (status === 'paused') resume(); });
    overlay(def.name, def.hint || 'Tap to play', 'Start');
    function frame(ts) {
      if (dead) return;
      raf = requestAnimationFrame(frame);
      if (status === 'play') {
        const dt = last ? Math.min(0.033, Math.max(0, (ts - last) / 1000)) : 0; last = ts;
        try { def.step(s, dt); } catch (e) { s.over = true; }
        if (s.over) finish();
        draw();
      } else if (dirty) draw();
    }
    function draw() {
      dirty = false;
      ctx.fillStyle = C.surface; ctx.fillRect(0, 0, def.W, def.H);
      def.draw(ctx, s, C);
      const v = Math.floor(s.score || 0);
      if (v !== shownScore) { shownScore = v; scEl.textContent = v; }
    }
    if (def.ptr) {
      const ev = (name) => (e) => {
        if (status !== 'play') return;
        const pt = ptrPos(cv, e);
        if (name === 'down') { try { wrap.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } }
        if (def.ptr[name]) def.ptr[name](s, pt, e);
        if (e.cancelable) e.preventDefault();
      };
      T.on(wrap, 'pointerdown', ev('down')); T.on(wrap, 'pointermove', ev('move'));
      T.on(wrap, 'pointerup', ev('up')); T.on(wrap, 'pointercancel', ev('up'));
    }
    T.on(document, 'visibilitychange', () => { if (document.hidden) pause(); });
    if (def.setup) def.setup(root, T, { get s() { return s; }, get playing() { return status === 'play'; }, pause });
    draw(); raf = requestAnimationFrame(frame);
    return () => {
      dead = true; if (raf) cancelAnimationFrame(raf); offs.forEach(f => f()); offs.length = 0; dropLock();
      if (def.cleanup) def.cleanup();
    };
  }
  function reg(id, name, icon, desc, keys, def) {
    def.id = id; def.name = name;
    Tools.register({ id, name, icon, cat: 'fun', desc, keys, needs: ['storage'], pro: false, render(el) { return host(el, def); } });
  }

  /* ===== 1. Star Defender ===== */
  /* LOGIC-START */
  const INV = { W: 320, H: 440 };
  function invWave(wave) {
    const rows = Math.min(5, 3 + Math.floor(wave / 3)), cols = 7, list = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) list.push({ x: 24 + c * 36, y: 48 + r * 26, w: 22, h: 16, row: r, alive: true });
    return list;
  }
  function invShields() {
    const out = [];
    for (let i = 0; i < 3; i++) out.push({ x: 28 + i * 100, y: INV.H - 90, w: 44, h: 12, hp: 6 });
    return out;
  }
  G.invaders = {
    make(seed) {
      return { rng: mkRng(seed), score: 0, over: false, wave: 1, lives: 3, ship: { x: INV.W / 2 - 13, y: INV.H - 36, w: 26, h: 14 },
        bullets: [], ebul: [], inv: invWave(1), shields: invShields(), dir: 1, fireCd: 0.2, hit: 0, in: { x: INV.W / 2 }, t: 0 };
    },
    wave: invWave,
    speed(s) { return Math.min(130, 22 + s.wave * 9); },
    step(s, dt) {
      if (s.over) return;
      s.t += dt; s.hit = Math.max(0, s.hit - dt);
      const sh = s.ship, tx = clampN(s.in.x, 0, INV.W) - sh.w / 2, mv = 420 * dt;
      sh.x = clampN(Math.abs(tx - sh.x) <= mv ? tx : sh.x + Math.sign(tx - sh.x) * mv, 4, INV.W - sh.w - 4);
      s.fireCd -= dt;
      if (s.fireCd <= 0) { s.fireCd = 0.42; s.bullets.push({ x: sh.x + sh.w / 2 - 1.5, y: sh.y - 8, w: 3, h: 9 }); }
      for (const b of s.bullets) b.y -= 340 * dt;
      s.bullets = s.bullets.filter(b => b.y > -10);
      const alive = s.inv.filter(i => i.alive);
      const frac = alive.length / Math.max(1, s.inv.length);
      const v = G.invaders.speed(s) * (1 + (1 - frac) * 1.6) * s.dir * dt;
      let edge = false;
      for (const i of alive) { i.x += v; if (i.x < 6 || i.x + i.w > INV.W - 6) edge = true; }
      if (edge) {
        s.dir = -s.dir;
        for (const i of alive) { i.x = clampN(i.x, 6, INV.W - 6 - i.w); i.y += 12; }
      }
      /* enemy fire: pick a random column's lowest invader */
      if (alive.length && s.rng() < dt * (0.7 + s.wave * 0.12)) {
        const a = alive[Math.floor(s.rng() * alive.length)];
        const low = alive.filter(i => Math.abs(i.x - a.x) < 4).reduce((m, i) => i.y > m.y ? i : m, a);
        s.ebul.push({ x: low.x + low.w / 2 - 1.5, y: low.y + low.h, w: 3, h: 9 });
      }
      for (const b of s.ebul) b.y += (150 + s.wave * 10) * dt;
      s.ebul = s.ebul.filter(b => b.y < INV.H + 10);
      for (const b of s.bullets) {
        if (b.dead) continue;
        for (const i of alive) if (i.alive && rectHit(b, i)) { i.alive = false; b.dead = true; s.score += 10 + (4 - Math.min(4, i.row)) * 5; break; }
        if (b.dead) continue;
        for (const sd of s.shields) if (sd.hp > 0 && rectHit(b, sd)) { sd.hp--; b.dead = true; break; }
      }
      s.bullets = s.bullets.filter(b => !b.dead);
      for (const b of s.ebul) {
        for (const sd of s.shields) if (sd.hp > 0 && rectHit(b, sd)) { sd.hp--; b.dead = true; break; }
        if (!b.dead && s.hit <= 0 && rectHit(b, sh)) { b.dead = true; s.lives--; s.hit = 1.5; }
      }
      s.ebul = s.ebul.filter(b => !b.dead);
      if (s.lives <= 0) { s.over = true; return; }
      if (alive.some(i => i.alive && i.y + i.h >= sh.y)) { s.over = true; return; }
      if (!s.inv.some(i => i.alive)) {
        s.wave++; s.score += 50; s.inv = invWave(s.wave); s.shields = invShields(); s.ebul = []; s.dir = 1;
      }
    }
  };
  /* LOGIC-END */
  reg('invaders', 'Star Defender', '🛸', 'Space Invaders style: drag to move your ship, it fires by itself. Clear waves of aliens that speed up, hide behind shields and keep your three lives.',
    ['space', 'invaders', 'shooter', 'alien', 'arcade', 'shoot'], {
      W: INV.W, H: INV.H, hint: 'Drag left and right to move. Your ship fires by itself.', make: G.invaders.make, step: G.invaders.step,
      ptr: { down(s, p) { s.in.x = p.x; }, move(s, p) { s.in.x = p.x; } },
      draw(c, s, C) {
        c.fillStyle = C.surface2;
        for (const sd of s.shields) if (sd.hp > 0) { c.globalAlpha = 0.35 + sd.hp / 6 * 0.65; c.fillRect(sd.x, sd.y, sd.w, sd.h); }
        c.globalAlpha = 1;
        for (const i of s.inv) if (i.alive) {
          c.fillStyle = ['#e5484d', '#f5a524', '#46a758', '#3e63dd', '#ab4aba'][i.row % 5];
          c.fillRect(i.x + 3, i.y, i.w - 6, i.h); c.fillRect(i.x, i.y + 4, i.w, 6); c.fillRect(i.x + 2, i.y + 12, 4, 4); c.fillRect(i.x + i.w - 6, i.y + 12, 4, 4);
          c.fillStyle = C.surface; c.fillRect(i.x + 6, i.y + 4, 3, 3); c.fillRect(i.x + i.w - 9, i.y + 4, 3, 3);
        }
        c.fillStyle = C.accent;
        for (const b of s.bullets) c.fillRect(b.x, b.y, b.w, b.h);
        c.fillStyle = C.danger;
        for (const b of s.ebul) c.fillRect(b.x, b.y, b.w, b.h);
        c.globalAlpha = s.hit > 0 ? 0.45 : 1; c.fillStyle = C.ok;
        const sh = s.ship; c.fillRect(sh.x, sh.y + 6, sh.w, 8); c.fillRect(sh.x + sh.w / 2 - 3, sh.y, 6, 8);
        c.globalAlpha = 1; c.fillStyle = C.text; c.font = '13px sans-serif'; c.textAlign = 'left'; c.textBaseline = 'top';
        c.fillText('Wave ' + s.wave + '   Lives ' + s.lives, 8, 6);
      }
    });

  /* ===== 2. Rock Blaster ===== */
  /* LOGIC-START */
  const AST = { W: 320, H: 440, R: [0, 9, 17, 28], PTS: [0, 100, 50, 20] };
  /* Splits a rock of size 3 or 2 into two smaller faster rocks; size 1 (or less) just vanishes. */
  function splitRock(rk, rng) {
    if (rk.size <= 1) return [];
    const out = [];
    for (let k = 0; k < 2; k++) {
      const a = rng() * Math.PI * 2, sp = Math.hypot(rk.vx, rk.vy) * 1.25 + 25 + rng() * 25;
      out.push({ x: rk.x, y: rk.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: rk.size - 1, r: AST.R[rk.size - 1], spin: (rng() - 0.5) * 3, rot: 0, seed: rng() });
    }
    return out;
  }
  function astWave(wave, ship, rng) {
    const n = Math.min(9, 3 + wave), out = [];
    for (let i = 0; i < n; i++) {
      let x, y, tries = 0;
      do { x = rng() * AST.W; y = rng() * AST.H; tries++; } while (Math.hypot(x - ship.x, y - ship.y) < 110 && tries < 50);
      const a = rng() * Math.PI * 2, sp = 25 + rng() * 25 + wave * 5;
      out.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: 3, r: AST.R[3], spin: (rng() - 0.5) * 2, rot: 0, seed: rng() });
    }
    return out;
  }
  function angDiff(a, b) { return Math.atan2(Math.sin(b - a), Math.cos(b - a)); }
  G.asteroids = {
    split: splitRock, wave: astWave,
    make(seed) {
      const rng = mkRng(seed), ship = { x: AST.W / 2, y: AST.H / 2, a: -Math.PI / 2, vx: 0, vy: 0, inv: 2 };
      return { rng, score: 0, over: false, wave: 1, lives: 3, ship, rocks: astWave(1, ship, rng), bullets: [], cd: 0.3, in: { aim: null, thrust: false } };
    },
    step(s, dt) {
      if (s.over) return;
      const sh = s.ship, I = s.in;
      sh.inv = Math.max(0, sh.inv - dt);
      if (I.aim != null && Number.isFinite(I.aim)) { const d = angDiff(sh.a, I.aim), mv = 6.5 * dt; sh.a += Math.abs(d) <= mv ? d : Math.sign(d) * mv; }
      if (I.thrust) { sh.vx += Math.cos(sh.a) * 230 * dt; sh.vy += Math.sin(sh.a) * 230 * dt; }
      const damp = Math.pow(0.55, dt); sh.vx *= damp; sh.vy *= damp;
      const sp = Math.hypot(sh.vx, sh.vy); if (sp > 230) { sh.vx *= 230 / sp; sh.vy *= 230 / sp; }
      sh.x = modN(sh.x + sh.vx * dt, AST.W); sh.y = modN(sh.y + sh.vy * dt, AST.H);
      s.cd -= dt;
      if (s.cd <= 0) { s.cd = 0.34; s.bullets.push({ x: sh.x + Math.cos(sh.a) * 12, y: sh.y + Math.sin(sh.a) * 12, vx: Math.cos(sh.a) * 300 + sh.vx, vy: Math.sin(sh.a) * 300 + sh.vy, life: 0.9 }); }
      for (const b of s.bullets) { b.x = modN(b.x + b.vx * dt, AST.W); b.y = modN(b.y + b.vy * dt, AST.H); b.life -= dt; }
      s.bullets = s.bullets.filter(b => b.life > 0);
      for (const r of s.rocks) { r.x = modN(r.x + r.vx * dt, AST.W); r.y = modN(r.y + r.vy * dt, AST.H); r.rot += r.spin * dt; }
      const born = [];
      for (const b of s.bullets) for (const r of s.rocks) {
        if (!r.dead && !b.dead && circHit(b.x, b.y, 2, r.x, r.y, r.r)) {
          r.dead = true; b.dead = true; s.score += AST.PTS[r.size]; born.push(...splitRock(r, s.rng));
        }
      }
      s.rocks = s.rocks.filter(r => !r.dead).concat(born); s.bullets = s.bullets.filter(b => !b.dead);
      if (sh.inv <= 0) for (const r of s.rocks) if (circHit(sh.x, sh.y, 8, r.x, r.y, r.r)) {
        s.lives--; sh.inv = 2.2; sh.x = AST.W / 2; sh.y = AST.H / 2; sh.vx = sh.vy = 0;
        /* never respawn inside a rock: push nearby rocks away */
        for (const q of s.rocks) if (Math.hypot(q.x - sh.x, q.y - sh.y) < q.r + 40) { q.x = modN(q.x + 120, AST.W); }
        break;
      }
      if (s.lives <= 0) { s.over = true; return; }
      if (!s.rocks.length) { s.wave++; s.score += 100; s.rocks = astWave(s.wave, sh, s.rng); }
    }
  };
  /* LOGIC-END */
  reg('asteroids', 'Rock Blaster', '🪨', 'Asteroids style: drag to aim the ship, hold the thrust button to fly and shoot big rocks that split into smaller ones. Edges wrap around and you have three lives.',
    ['asteroids', 'space', 'rocks', 'shooter', 'arcade', 'spaceship'], {
      W: AST.W, H: AST.H, hint: 'Drag on the screen to point the ship. Hold Thrust to fly. It fires by itself.',
      make: G.asteroids.make, step: G.asteroids.step,
      extra: '<button class="btn" id="th" aria-label="Thrust">Thrust</button>',
      ptr: {
        down(s, p) { s.o = { x: p.x, y: p.y }; },
        move(s, p) { if (!s.o) return; const dx = p.x - s.o.x, dy = p.y - s.o.y; if (Math.hypot(dx, dy) > 10) s.in.aim = Math.atan2(dy, dx); },
        up(s) { s.o = null; }
      },
      setup(root, T, ctl) {
        const b = $('#th', root), on = (v) => (e) => { ctl.s.in.thrust = v; if (e.cancelable) e.preventDefault(); };
        T.on(b, 'pointerdown', on(true)); T.on(b, 'pointerup', on(false)); T.on(b, 'pointercancel', on(false)); T.on(b, 'pointerleave', on(false));
      },
      draw(c, s, C) {
        c.strokeStyle = C.muted; c.lineWidth = 2; c.lineJoin = 'round';
        for (const r of s.rocks) {
          c.beginPath();
          for (let k = 0; k < 10; k++) {
            const a = r.rot + k * Math.PI / 5, rr = r.r * (0.78 + 0.22 * Math.sin(r.seed * 50 + k * 2.3));
            const px = r.x + Math.cos(a) * rr, py = r.y + Math.sin(a) * rr; if (k) c.lineTo(px, py); else c.moveTo(px, py);
          }
          c.closePath(); c.stroke();
        }
        c.fillStyle = C.accent;
        for (const b of s.bullets) c.fillRect(b.x - 1.5, b.y - 1.5, 3, 3);
        const sh = s.ship; c.save(); c.translate(sh.x, sh.y); c.rotate(sh.a);
        c.globalAlpha = sh.inv > 0 ? 0.45 : 1; c.strokeStyle = C.ok; c.beginPath(); c.moveTo(12, 0); c.lineTo(-9, 8); c.lineTo(-5, 0); c.lineTo(-9, -8); c.closePath(); c.stroke();
        if (s.in.thrust) { c.strokeStyle = C.danger; c.beginPath(); c.moveTo(-6, 3); c.lineTo(-14, 0); c.lineTo(-6, -3); c.stroke(); }
        c.restore(); c.globalAlpha = 1;
        c.fillStyle = C.text; c.font = '13px sans-serif'; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText('Wave ' + s.wave + '   Lives ' + s.lives, 8, 6);
      }
    });

  /* ===== 3. Road Hopper ===== */
  /* LOGIC-START */
  const HP = { W: 320, H: 440, CELL: 40, L: 420, M: 100, HOP: 0.11 };
  const hpObjX = (lane, i) => modN(i * lane.sp + lane.off, HP.L) - HP.M;
  /* One lane. st carries the length of the current run of road/river lanes so a run never exceeds 3 lanes. */
  function hopLane(r, st, rng) {
    if (r < 2 || st.haz >= 3 || (st.haz > 0 && rng() < 0.2)) { st.haz = 0; st.last = 'grass'; return { r, type: 'grass', dir: 1, speed: 0, n: 0, sp: 0, w: 0, off: 0 }; }
    const hard = Math.min(1, r / 90), river = st.last === 'river' ? rng() < 0.6 : rng() < 0.3;
    const dir = rng() < 0.5 ? -1 : 1, n = rng() < 0.55 ? 3 : 2, sp = HP.L / n;
    st.haz++; st.last = river ? 'river' : 'road';
    if (river) return { r, type: 'river', dir, speed: 24 + rng() * 34 + hard * 20, n, sp, w: n === 3 ? 80 + Math.floor(rng() * 21) : 100 + Math.floor(rng() * 31), off: rng() * HP.L };
    return { r, type: 'road', dir, speed: 40 + rng() * 60 + hard * 50, n, sp, w: n === 3 ? 38 + Math.floor(rng() * 33) : 38 + Math.floor(rng() * 33), off: rng() * HP.L };
  }
  const hopSnap = (x) => clampN(Math.round((x - 20) / HP.CELL) * HP.CELL + 20, 20, HP.W - 20);
  G.hopper = {
    lane: hopLane, objX: hpObjX,
    make(seed) {
      const s = { rng: mkRng(seed), score: 0, over: false, lanes: {}, gen: -1, st: { haz: 0, last: 'grass' }, cam: 0, top: 0, moved: false,
        frog: { x: 180, row: 0, hop: null }, in: { dx: 0, dy: 0 } };
      G.hopper.fill(s); return s;
    },
    fill(s) { while (s.gen < s.frog.row + 14) { s.gen++; s.lanes[s.gen] = hopLane(s.gen, s.st, s.rng); } },
    /* is the frog (centre x) standing on a log of this river lane? */
    onLog(lane, x) { for (let i = 0; i < lane.n; i++) { const ox = hpObjX(lane, i); if (x > ox + 6 && x < ox + lane.w - 6) return true; } return false; },
    hitCar(lane, x) { for (let i = 0; i < lane.n; i++) { const ox = hpObjX(lane, i); if (x + 10 > ox && x - 10 < ox + lane.w) return true; } return false; },
    land(s) {
      const f = s.frog, lane = s.lanes[f.row];
      if (lane.type !== 'river') f.x = hopSnap(f.x);
      else if (!G.hopper.onLog(lane, f.x)) s.over = true;
      if (f.row > s.top) { s.top = f.row; s.score = s.top; }
    },
    step(s, dt) {
      if (s.over) return;
      const f = s.frog;
      for (const k in s.lanes) { const l = s.lanes[k]; l.off = modN(l.off + l.dir * l.speed * dt, HP.L); }
      if ((s.in.dx || s.in.dy) && !f.hop) {
        const dx = s.in.dx, dy = s.in.dy, r1 = f.row + dy;
        s.in.dx = s.in.dy = 0;
        if (r1 >= Math.floor(s.cam) && r1 >= 0 && s.lanes[r1]) {
          let x1 = clampN(f.x + dx * HP.CELL, 14, HP.W - 14);
          if (s.lanes[r1].type !== 'river') x1 = hopSnap(x1);
          f.hop = { t: 0, x0: f.x, r0: f.row, x1, r1 }; s.moved = true;
        }
      } else if (f.hop) { s.in.dx = s.in.dy = 0; }
      if (f.hop) {
        f.hop.t += dt / HP.HOP;
        if (f.hop.t >= 1) { f.x = f.hop.x1; f.row = f.hop.r1; f.hop = null; G.hopper.land(s); if (s.over) return; }
      } else {
        const lane = s.lanes[f.row];
        if (lane.type === 'road' && G.hopper.hitCar(lane, f.x)) { s.over = true; return; }
        if (lane.type === 'river') {
          if (!G.hopper.onLog(lane, f.x)) { s.over = true; return; }
          f.x += lane.dir * lane.speed * dt;
          if (f.x < 4 || f.x > HP.W - 4) { s.over = true; return; }
        }
      }
      G.hopper.fill(s);
      const target = f.row - 3;
      if (target > s.cam) s.cam += (target - s.cam) * Math.min(1, dt * 6);
      if (s.moved) s.cam += dt * (0.2 + Math.min(0.35, s.top / 250));
      if (f.row < s.cam - 0.6) { s.over = true; return; }
      for (const k in s.lanes) if (+k < s.cam - 3) delete s.lanes[k];
    }
  };
  /* LOGIC-END */
  reg('hopper', 'Road Hopper', '🐸', 'Frogger style: swipe or tap to hop across busy roads and rivers of logs, in endless generated lanes. The further you go the faster the traffic. Score is the distance.',
    ['frog', 'frogger', 'crossy', 'road', 'hop', 'arcade', 'cross'], {
      W: HP.W, H: HP.H, hint: 'Swipe to hop in any direction, tap to hop forward. Ride the logs, dodge the cars.',
      make: G.hopper.make, step: G.hopper.step,
      ptr: {
        down(s, p) { s.o = { x: p.x, y: p.y }; },
        move(s, p) {
          if (!s.o) return; const dx = p.x - s.o.x, dy = p.y - s.o.y;
          if (Math.max(Math.abs(dx), Math.abs(dy)) > 26) { if (Math.abs(dx) > Math.abs(dy)) s.in.dx = Math.sign(dx); else s.in.dy = -Math.sign(dy); s.o = null; }
        },
        up(s, p) { if (s.o) { s.in.dy = 1; s.o = null; } }
      },
      draw(c, s, C) {
        const y0 = (r) => HP.H - (r - s.cam + 1) * HP.CELL;
        for (const k in s.lanes) {
          const l = s.lanes[k], y = y0(l.r); if (y < -HP.CELL || y > HP.H) continue;
          c.fillStyle = l.type === 'river' ? '#2b6cb0' : (l.type === 'road' ? '#3a3a40' : '#2f7d4a'); c.fillRect(0, y, HP.W, HP.CELL);
          if (l.type === 'grass' && l.r % 2) { c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(0, y, HP.W, HP.CELL); }
          for (let i = 0; i < l.n; i++) {
            const x = G.hopper.objX(l, i);
            if (l.type === 'river') { c.fillStyle = '#8a5a2b'; c.fillRect(x, y + 6, l.w, HP.CELL - 12); c.fillStyle = '#a8742f'; c.fillRect(x + 4, y + 10, l.w - 8, 6); }
            else if (l.type === 'road') { c.fillStyle = ['#e5484d', '#f5a524', '#3e63dd', '#ab4aba'][(l.r * 7 + i) % 4]; c.fillRect(x, y + 8, l.w, HP.CELL - 16); c.fillStyle = '#cfe8ff'; const wx = l.dir > 0 ? x + l.w - 12 : x + 4; c.fillRect(wx, y + 12, 8, HP.CELL - 24); }
          }
        }
        const f = s.frog; let fx = f.x, fr = f.row;
        if (f.hop) { const t = Math.min(1, f.hop.t); fx = f.hop.x0 + (f.hop.x1 - f.hop.x0) * t; fr = f.hop.r0 + (f.hop.r1 - f.hop.r0) * t; }
        const fy = y0(fr) + HP.CELL / 2 - (f.hop ? Math.sin(Math.min(1, f.hop.t) * Math.PI) * 6 : 0);
        c.fillStyle = '#7cdc5a'; c.beginPath(); c.arc(fx, fy, 12, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#fff'; c.fillRect(fx - 8, fy - 9, 5, 5); c.fillRect(fx + 3, fy - 9, 5, 5); c.fillStyle = '#111'; c.fillRect(fx - 6, fy - 8, 2, 3); c.fillRect(fx + 5, fy - 8, 2, 3);
      }
    });

  /* ===== 4. Sprint Runner ===== */
  /* LOGIC-START */
  const RN = { W: 320, H: 420, GY: 330, PX: 60, PW: 22, H1: 44, H2: 22, G: 1800, JV: 620, V0: 230, VMAX: 520 };
  const runnerSpeed = (t) => Math.min(RN.VMAX, RN.V0 + t * 7);
  /* Time the shortest tap-jump spends above height h (seconds). */
  function runAbove(h) { const d = RN.JV * RN.JV - 2 * RN.G * h; return d <= 0 ? 0 : 2 * Math.sqrt(d) / RN.G; }
  /* Seconds of horizontal overlap between the runner and an obstacle of width w at this speed. */
  const runWindow = (speed, w) => (RN.PW - 6 + w - 4) / speed;
  /* True when a minimal tap-jump clears a low obstacle (h, w) at this speed with at least 0.12 s of timing slack. */
  const runCanJump = (speed, h, w) => runAbove(h) - runWindow(speed, w) >= 0.12;
  /* Same for sliding under a flyer. */
  const runCanSlide = (speed, w) => 0.55 - runWindow(speed, w) >= 0.12;
  const runMinGap = (speed) => speed * (2 * RN.JV / RN.G + 0.3);
  function runObstacle(speed, rng) {
    const bird = rng() < 0.22 && speed > 250;
    if (bird) return { kind: 'high', w: 30, h: 20, yb: 26 };
    let h = 26 + Math.floor(rng() * 31), w = 18 + Math.floor(rng() * 23);
    while (!runCanJump(speed, h, w)) { h -= 4; w -= 2; if (h < 18) { h = 18; w = 16; break; } }
    return { kind: 'low', w, h, yb: 0 };
  }
  const runNextGap = (speed, w, rng) => w + runMinGap(speed) * (1 + rng() * 0.8);
  function runHit(s) {
    const ph = s.sliding > 0 && s.py === 0 ? RN.H2 : RN.H1;
    const p = { x: RN.PX + 3, y: RN.GY - s.py - (ph - 4), w: RN.PW - 6, h: ph - 4 };
    return s.obs.some(o => rectHit(p, { x: o.x + 2, y: RN.GY - o.yb - o.h, w: o.w - 4, h: o.h }));
  }
  G.runner = {
    minGap: runMinGap, canJump: runCanJump, canSlide: runCanSlide, obstacle: runObstacle, nextGap: runNextGap, speedAt: runnerSpeed, hit: runHit,
    make(seed) {
      return { rng: mkRng(seed), score: 0, over: false, t: 0, dist: 0, py: 0, vy: 0, sliding: 0, speed: RN.V0, obs: [], gapLeft: 250, in: { jump: false, held: false, slide: false }, run: 0 };
    },
    step(s, dt) {
      if (s.over) return;
      s.t += dt; s.speed = runnerSpeed(s.t); s.dist += s.speed * dt; s.score = s.dist / 10; s.run += dt * s.speed / 40;
      const I = s.in, ground = s.py === 0 && s.vy <= 0;
      if (I.jump && ground) { s.vy = RN.JV; s.sliding = 0; }
      if (I.slide) { if (ground) s.sliding = 0.55; else s.vy = Math.min(s.vy, -700); }
      I.jump = false; I.slide = false;
      if (s.py > 0 || s.vy > 0) {
        const g = I.held && s.vy > 0 ? RN.G * 0.5 : RN.G;
        s.vy -= g * dt; s.py += s.vy * dt;
        if (s.py <= 0) { s.py = 0; s.vy = 0; }
      }
      if (s.sliding > 0) s.sliding = Math.max(0, s.sliding - dt);
      for (const o of s.obs) o.x -= s.speed * dt;
      s.obs = s.obs.filter(o => o.x + o.w > -20);
      s.gapLeft -= s.speed * dt;
      if (s.gapLeft <= 0) { const o = runObstacle(s.speed, s.rng); o.x = RN.W + 20; s.obs.push(o); s.gapLeft = runNextGap(s.speed, o.w, s.rng); }
      if (runHit(s)) s.over = true;
    }
  };
  /* LOGIC-END */
  reg('runner', 'Sprint Runner', '🎽', 'Endless runner: tap to jump (hold to jump higher), swipe down to slide under flying obstacles. The track is generated as you go and the speed keeps ramping up. Score is the distance.',
    ['run', 'runner', 'jump', 'endless', 'dino', 'slide', 'sprint'], {
      W: RN.W, H: RN.H, hint: 'Tap to jump, hold for a higher jump, swipe down to slide.',
      make: G.runner.make, step: G.runner.step,
      ptr: {
        down(s, p) { s.in.jump = true; s.in.held = true; s.o = { y: p.y }; },
        move(s, p) { if (s.o && p.y - s.o.y > 24) { s.in.slide = true; s.in.held = false; s.o = null; } },
        up(s) { s.in.held = false; s.o = null; }
      },
      draw(c, s, C) {
        c.strokeStyle = C.line; c.lineWidth = 2; c.beginPath(); c.moveTo(0, RN.GY + 1); c.lineTo(RN.W, RN.GY + 1); c.stroke();
        c.fillStyle = C.surface2; for (let i = 0; i < 6; i++) c.fillRect(modN(i * 70 - s.dist * 0.5, RN.W + 40) - 20, RN.GY + 10 + (i % 3) * 12, 24, 3);
        for (const o of s.obs) {
          const y = RN.GY - o.yb - o.h;
          if (o.kind === 'low') { c.fillStyle = '#3f9b52'; c.fillRect(o.x + o.w / 2 - 4, y, 8, o.h); c.fillRect(o.x, y + o.h * 0.3, o.w, 6); c.fillRect(o.x, y + o.h * 0.3 - 8, 6, 10); }
          else { const fl = Math.floor(s.t * 5) % 2 ? 4 : -2; c.fillStyle = '#c0539b'; c.fillRect(o.x, y + 6, o.w, 10); c.fillRect(o.x + 6, y + fl, 16, 6); c.fillStyle = '#f5a524'; c.fillRect(o.x - 5, y + 8, 6, 4); }
        }
        const sl = s.sliding > 0 && s.py === 0, ph = sl ? RN.H2 : RN.H1, top = RN.GY - s.py - ph;
        c.fillStyle = C.accent; c.fillRect(RN.PX, top, RN.PW, ph);
        c.fillStyle = C.surface; c.fillRect(RN.PX + RN.PW - 8, top + 5, 4, 4);
        if (s.py === 0 && !sl) { const sw = Math.sin(s.run) * 5; c.fillStyle = C.text; c.fillRect(RN.PX + 3 + sw, RN.GY - 5, 5, 5); c.fillRect(RN.PX + 13 - sw, RN.GY - 5, 5, 5); }
        c.fillStyle = C.muted; c.font = '13px sans-serif'; c.textAlign = 'right'; c.textBaseline = 'top'; c.fillText(Math.round(s.speed) + ' px/s', RN.W - 8, 6);
      }
    });

  /* ===== 5. Sky Jumper ===== */
  /* LOGIC-START */
  const JP = { W: 320, H: 440, G: 1100, JV: 560, SV: 900, PW: 56, PH: 10, MAXGAP: 110 };
  const jpApex = JP.JV * JP.JV / (2 * JP.G);
  /* Vertical distance to the next solid platform: always below MAXGAP, and below 0.8 of a normal jump. */
  function jpGap(score, rng) { return Math.min(JP.MAXGAP, 42 + rng() * (30 + Math.min(38, score / 60))); }
  function jpPlat(s, y, type) {
    const p = { x: s.rng() * (JP.W - JP.PW), y, w: JP.PW, type, vx: 0, spring: false, broken: false };
    if (type === 'm') p.vx = (s.rng() < 0.5 ? -1 : 1) * (40 + s.rng() * 50);
    return p;
  }
  function jpFill(s) {
    while (s.topY > s.cam - 220) {
      const y = s.topY - jpGap(s.score, s.rng), r = s.rng();
      const p = jpPlat(s, y, r < Math.min(0.3, s.score / 1500) ? 'm' : 'n');
      if (p.type === 'n' && s.rng() < 0.08) p.spring = true;
      s.plats.push(p); s.topY = y;
      /* decoys are extra, never instead of the solid platform, so a path always exists */
      if (s.rng() < Math.min(0.35, 0.08 + s.score / 1500)) s.plats.push(jpPlat(s, y + (s.rng() - 0.5) * 40, 'b'));
    }
  }
  G.jumper = {
    apex: jpApex, gap: jpGap, fill: jpFill,
    make(seed) {
      const s = { rng: mkRng(seed), score: 0, over: false, cam: 0, plats: [], topY: JP.H - 30, y0: JP.H - 30, in: { tilt: 0, useTilt: false, dragX: null },
        p: { x: JP.W / 2, y: JP.H - 30, vx: 0, vy: -JP.JV }, bounced: 0 };
      s.plats.push({ x: JP.W / 2 - 50, y: JP.H - 28, w: 100, type: 'n', vx: 0, spring: false, broken: false });
      s.cam = 0; jpFill(s); return s;
    },
    step(s, dt) {
      if (s.over) return;
      const p = s.p, I = s.in;
      if (I.dragX != null && Number.isFinite(I.dragX)) p.vx = clampN((I.dragX - p.x) * 7, -280, 280);
      else if (I.useTilt && Number.isFinite(I.tilt)) p.vx = clampN(I.tilt, -1, 1) * 280;
      else p.vx *= Math.pow(0.02, dt);
      const prev = p.y; p.vy += JP.G * dt; p.y += p.vy * dt; p.x = modN(p.x + p.vx * dt, JP.W);
      for (const q of s.plats) if (q.type === 'm') { q.x += q.vx * dt; if (q.x < 0) { q.x = 0; q.vx = Math.abs(q.vx); } if (q.x + q.w > JP.W) { q.x = JP.W - q.w; q.vx = -Math.abs(q.vx); } }
      if (p.vy > 0) {
        for (const q of s.plats) {
          if (q.broken || prev > q.y + 2 || p.y < q.y || p.x < q.x - 8 || p.x > q.x + q.w + 8) continue;
          if (q.type === 'b') { q.broken = true; continue; }
          p.vy = q.spring ? -JP.SV : -JP.JV; p.y = q.y; s.bounced++; break;
        }
      }
      if (p.y < s.cam + JP.H * 0.4) s.cam = p.y - JP.H * 0.4;
      s.score = Math.max(s.score, (s.y0 - p.y) / 10);
      jpFill(s);
      s.plats = s.plats.filter(q => q.y < s.cam + JP.H + 60 && !(q.broken && q.y > s.cam + JP.H));
      if (p.y > s.cam + JP.H + 30) s.over = true;
    }
  };
  /* LOGIC-END */
  const JT = { v: 0, has: false, use: true, flip: false };
  reg('jumper', 'Sky Jumper', '🦘', 'Doodle Jump style: bounce up an endless tower of platforms with springs, moving and crumbling ones. Steer by tilting the phone, or by dragging a finger if there is no tilt sensor. Score is the height.',
    ['doodle', 'jump', 'platform', 'climb', 'bounce', 'tilt', 'endless'], {
      W: JP.W, H: JP.H, wake: true, hint: 'Tilt the phone to steer, or drag a finger left and right.',
      make: G.jumper.make, step: G.jumper.step,
      extra: '<button class="btn alt" id="md">Steering: Tilt</button><button class="btn alt" id="fl">Flip tilt</button>',
      onStart(s) { s.in.useTilt = JT.use && JT.has; s.in.tilt = JT.v; },
      ptr: {
        down(s, p) { s.in.dragX = p.x; }, move(s, p) { if (s.in.dragX != null) s.in.dragX = p.x; }, up(s) { s.in.dragX = null; }
      },
      setup(root, T, ctl) {
        JT.v = 0; JT.has = false; JT.use = true; JT.flip = !!Store.get('fun3.jumper.flip', false);
        const md = $('#md', root), fl = $('#fl', root);
        const label = () => { md.textContent = 'Steering: ' + (JT.use && JT.has ? 'Tilt' : (JT.use ? 'Tilt (waiting)' : 'Drag')); };
        T.on(window, 'devicemotion', (e) => {
          const a = e && e.accelerationIncludingGravity, x = a && a.x;
          if (typeof x !== 'number' || !Number.isFinite(x)) return;
          JT.has = true; JT.v = clampN(x / 5, -1, 1) * (JT.flip ? 1 : -1);
          const s = ctl.s; s.in.tilt = JT.v; s.in.useTilt = JT.use;
        });
        T.on(md, 'click', () => { JT.use = !JT.use; ctl.s.in.useTilt = JT.use && JT.has; label(); });
        T.on(fl, 'click', () => { JT.flip = !JT.flip; Store.set('fun3.jumper.flip', JT.flip); });
        label();
        const iv = setInterval(label, 1000); T.undo(() => clearInterval(iv));
      },
      draw(c, s, C) {
        const sy = (y) => y - s.cam;
        for (const q of s.plats) {
          const y = sy(q.y); if (y < -20 || y > JP.H + 20) continue;
          c.globalAlpha = q.broken ? 0.3 : 1;
          c.fillStyle = q.type === 'm' ? '#3e63dd' : (q.type === 'b' ? '#a8742f' : '#46a758');
          c.fillRect(q.x, y, q.w, JP.PH);
          if (q.type === 'b') { c.fillStyle = C.surface; c.fillRect(q.x + q.w / 2 - 1, y, 2, JP.PH); }
          if (q.spring) { c.fillStyle = C.danger; c.fillRect(q.x + q.w / 2 - 8, y - 8, 16, 8); c.fillStyle = C.text; c.fillRect(q.x + q.w / 2 - 8, y - 3, 16, 2); }
          c.globalAlpha = 1;
        }
        const p = s.p, y = sy(p.y);
        c.fillStyle = C.accent; c.fillRect(p.x - 11, y - 24, 22, 24);
        c.fillStyle = C.surface; c.fillRect(p.x - 6 + Math.sign(p.vx) * 2, y - 18, 4, 5); c.fillRect(p.x + 2 + Math.sign(p.vx) * 2, y - 18, 4, 5);
        c.fillStyle = C.accent; if (p.x < 12) c.fillRect(p.x + JP.W - 11, y - 24, 22, 24); if (p.x > JP.W - 12) c.fillRect(p.x - JP.W - 11, y - 24, 22, 24);
      }
    });

  /* ===== 6. Tower Stack ===== */
  /* LOGIC-START */
  const TS = { W: 320, H: 440, BH: 22, W0: 160, TOL: 4, GROW: 6 };
  /* Result of dropping block cur (x, w) on top block top: overhang cut, perfect drops snap and grow. */
  function towerDrop(top, cur) {
    const lo = Math.max(cur.x, top.x), hi = Math.min(cur.x + cur.w, top.x + top.w), ov = hi - lo;
    if (ov <= 0) return { ok: false, x: cur.x, w: cur.w, perfect: false, cut: { x: cur.x, w: cur.w } };
    if (Math.abs(cur.x - top.x) <= TS.TOL && Math.abs(cur.w - top.w) <= 0.5 + TS.TOL) {
      const w = Math.min(TS.W0, top.w + TS.GROW);
      return { ok: true, x: clampN(top.x - (w - top.w) / 2, 0, TS.W - w), w, perfect: true, cut: null };
    }
    let cut;
    if (cur.x < top.x) cut = { x: cur.x, w: top.x - cur.x };
    else if (cur.x + cur.w > top.x + top.w) cut = { x: top.x + top.w, w: cur.x + cur.w - (top.x + top.w) };
    else cut = null;
    return { ok: true, x: lo, w: ov, perfect: false, cut };
  }
  const towerSpeed = (n) => Math.min(300, 110 + n * 4);
  G.towerstack = {
    drop: towerDrop, speed: towerSpeed,
    make(seed) {
      const rng = mkRng(seed);
      return { rng, score: 0, over: false, stack: [{ x: (TS.W - TS.W0) / 2, w: TS.W0 }], cur: { x: 0, w: TS.W0, dir: 1 }, falls: [], streak: 0, perfect: 0, flash: 0, in: { drop: false }, t: 0 };
    },
    step(s, dt) {
      s.t += dt; s.flash = Math.max(0, s.flash - dt);
      for (const f of s.falls) { f.vy += 900 * dt; f.y += f.vy * dt; }
      s.falls = s.falls.filter(f => f.y < 40);
      if (s.over) return;
      const c = s.cur; c.x += c.dir * towerSpeed(s.stack.length - 1) * dt;
      if (c.x < 0) { c.x = 0; c.dir = 1; } else if (c.x + c.w > TS.W) { c.x = TS.W - c.w; c.dir = -1; }
      if (!s.in.drop) return;
      s.in.drop = false;
      const top = s.stack[s.stack.length - 1], r = towerDrop(top, c);
      if (!r.ok) { s.over = true; s.falls.push({ x: c.x, w: c.w, y: 0, vy: 0 }); return; }
      if (r.cut) s.falls.push({ x: r.cut.x, w: r.cut.w, y: 0, vy: 0 });
      s.stack.push({ x: r.x, w: r.w });
      if (r.perfect) { s.streak++; s.perfect++; s.flash = 0.3; } else s.streak = 0;
      s.score = s.stack.length - 1;
      s.cur = { x: s.rng() < 0.5 ? 0 : TS.W - r.w, w: r.w, dir: 1 };
      s.cur.dir = s.cur.x === 0 ? 1 : -1;
    }
  };
  /* LOGIC-END */
  reg('towerstack', 'Tower Stack', '🏗️', 'Tap to drop the sliding block onto the tower. Any overhang is cut off, so the tower gets narrower; land perfectly and the block grows back. Score is the height you reach.',
    ['stack', 'tower', 'blocks', 'tap', 'build', 'timing', 'one tap'], {
      W: TS.W, H: TS.H, hint: 'Tap anywhere to drop the block. Line it up exactly for a bonus.',
      make: G.towerstack.make, step: G.towerstack.step,
      ptr: { down(s) { s.in.drop = true; } },
      draw(c, s, C) {
        const n = s.stack.length, base = TS.H - 80, shift = Math.max(0, (n - 8) * TS.BH);
        const yOf = (i) => base - i * TS.BH + shift;
        const col = (i) => 'hsl(' + ((i * 14 + 200) % 360) + ',65%,58%)';
        for (let i = 0; i < n; i++) { const b = s.stack[i], y = yOf(i); if (y < -TS.BH) continue; c.fillStyle = col(i); c.fillRect(b.x, y, b.w, TS.BH - 2); }
        if (!s.over) { c.fillStyle = col(n); c.fillRect(s.cur.x, yOf(n), s.cur.w, TS.BH - 2); }
        c.fillStyle = col(n - 1);
        for (const f of s.falls) c.fillRect(f.x, yOf(s.over ? n : n - 1) + f.y, f.w, TS.BH - 2);
        if (s.flash > 0) { c.strokeStyle = C.text; c.lineWidth = 2; const b = s.stack[n - 1]; c.strokeRect(b.x - 2, yOf(n - 1) - 2, b.w + 4, TS.BH + 2); }
        c.fillStyle = C.text; c.font = '13px sans-serif'; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText('Height ' + (n - 1) + (s.streak > 1 ? '   Perfect x' + s.streak : ''), 8, 6);
      }
    });

  /* ===== 7. Bubble Pop ===== */
  /* LOGIC-START */
  const BP = { W: 320, H: 440, R: 16, RH: 16 * Math.sqrt(3), LIM: 11, SX: 160, SY: 404, SPEED: 560 };
  const bpOdd = (par, r) => ((r + par) % 2 + 2) % 2 === 1;
  const bpLen = (par, r) => bpOdd(par, r) ? 9 : 10;
  const bpXY = (par, r, c) => ({ x: BP.R + 2 * BP.R * c + (bpOdd(par, r) ? BP.R : 0), y: BP.R + r * BP.RH });
  function bpNeighbors(par, r, c, nRows) {
    const out = [[r, c - 1], [r, c + 1]], cs = bpOdd(par, r) ? [c, c + 1] : [c - 1, c];
    for (const cc of cs) { out.push([r - 1, cc]); out.push([r + 1, cc]); }
    return out.filter(([rr, cc]) => rr >= 0 && rr < nRows && cc >= 0 && cc < bpLen(par, rr));
  }
  /* Connected bubbles of the same colour as (r,c). */
  function bpMatch(grid, par, r, c) {
    const col = grid[r] && grid[r][c]; if (!col) return [];
    const seen = new Set([r * 100 + c]), q = [[r, c]], out = [];
    while (q.length) {
      const [a, b] = q.pop(); out.push([a, b]);
      for (const [x, y] of bpNeighbors(par, a, b, grid.length)) if (!seen.has(x * 100 + y) && grid[x][y] === col) { seen.add(x * 100 + y); q.push([x, y]); }
    }
    return out;
  }
  /* Bubbles not connected to the ceiling row. */
  function bpFloating(grid, par) {
    const seen = new Set(), q = [];
    if (grid.length) for (let c = 0; c < grid[0].length; c++) if (grid[0][c]) { seen.add(c); q.push([0, c]); }
    while (q.length) {
      const [a, b] = q.pop();
      for (const [x, y] of bpNeighbors(par, a, b, grid.length)) if (grid[x][y] && !seen.has(x * 100 + y)) { seen.add(x * 100 + y); q.push([x, y]); }
    }
    const out = [];
    for (let r = 0; r < grid.length; r++) for (let c = 0; c < grid[r].length; c++) if (grid[r][c] && !seen.has(r * 100 + c)) out.push([r, c]);
    return out;
  }
  /* Nearest empty cell to a point (rows past the end count as empty). */
  function bpSnap(grid, par, x, y) {
    const r0 = Math.round((y - BP.R) / BP.RH); let best = null, bd = 1e18;
    for (let r = Math.max(0, r0 - 1); r <= r0 + 1; r++) for (let c = 0; c < bpLen(par, r); c++) {
      if (grid[r] && grid[r][c]) continue;
      const p = bpXY(par, r, c), d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
      if (d < bd) { bd = d; best = { r, c }; }
    }
    return best;
  }
  const bpRow = (par, r, n, rng) => Array.from({ length: bpLen(par, r) }, () => 1 + Math.floor(rng() * n));
  const bpColors = (level) => Math.min(6, 3 + level);
  function bpLevelGrid(level, par, rng) {
    const rows = Math.min(8, 3 + level), n = bpColors(level), g = [];
    for (let r = 0; r < rows; r++) g.push(bpRow(par, r, n, rng));
    return g;
  }
  function bpPresent(s) {
    const set = new Set(); for (const row of s.grid) for (const v of row) if (v) set.add(v);
    const l = [...set]; return l.length ? l[Math.floor(s.rng() * l.length)] : 1 + Math.floor(s.rng() * bpColors(s.level));
  }
  const bpTrim = (grid) => { while (grid.length && !grid[grid.length - 1].some(v => v)) grid.pop(); };
  const bpLimit = (level) => Math.max(3, 7 - level);
  G.bubblepop = {
    xy: bpXY, len: bpLen, neighbors: bpNeighbors, match: bpMatch, floating: bpFloating, snap: bpSnap, limit: bpLimit, levelGrid: bpLevelGrid,
    make(seed) {
      const rng = mkRng(seed), s = { rng, score: 0, over: false, level: 1, par: 0, grid: [], misses: 0, fly: null, falling: [], in: { aim: -Math.PI / 2, fire: false }, cur: 1, next: 1, t: 0, pops: 0 };
      s.grid = bpLevelGrid(1, 0, rng); s.cur = bpPresent(s); s.next = bpPresent(s); return s;
    },
    addRow(s) {
      s.par ^= 1; s.grid.unshift(bpRow(s.par, 0, bpColors(s.level), s.rng));
    },
    /* Place the flying bubble where it stopped and resolve matches. */
    land(s) {
      const f = s.fly; s.fly = null;
      const cell = bpSnap(s.grid, s.par, f.x, f.y); if (!cell) { s.over = true; return; }
      while (s.grid.length <= cell.r) s.grid.push(new Array(bpLen(s.par, s.grid.length)).fill(0));
      s.grid[cell.r][cell.c] = f.c;
      const m = bpMatch(s.grid, s.par, cell.r, cell.c);
      if (m.length >= 3) {
        for (const [r, c] of m) s.grid[r][c] = 0;
        s.score += m.length * 10; s.pops += m.length;
        const fl = bpFloating(s.grid, s.par);
        for (const [r, c] of fl) { const p = bpXY(s.par, r, c); s.falling.push({ x: p.x, y: p.y, vy: 0, c: s.grid[r][c] }); s.grid[r][c] = 0; }
        s.score += fl.length * 20; s.misses = 0;
      } else {
        s.misses++;
        if (s.misses >= bpLimit(s.level)) { s.misses = 0; G.bubblepop.addRow(s); }
      }
      bpTrim(s.grid);
      if (s.grid.length > BP.LIM) { s.over = true; return; }
      if (!s.grid.length) { s.level++; s.score += 100; s.par = 0; s.grid = bpLevelGrid(s.level, 0, s.rng); }
    },
    step(s, dt) {
      s.t += dt;
      for (const f of s.falling) { f.vy += 900 * dt; f.y += f.vy * dt; }
      s.falling = s.falling.filter(f => f.y < BP.H + 20);
      if (s.over) return;
      const I = s.in;
      if (I.fire && !s.fly) {
        const a = clampN(Number.isFinite(I.aim) ? I.aim : -Math.PI / 2, -Math.PI + 0.2, -0.2);
        s.fly = { x: BP.SX, y: BP.SY, vx: Math.cos(a) * BP.SPEED, vy: Math.sin(a) * BP.SPEED, c: s.cur };
        s.cur = s.next; s.next = bpPresent(s);
      }
      I.fire = false;
      if (s.fly) {
        const f = s.fly; let dist = BP.SPEED * dt;
        while (dist > 0 && s.fly) {
          const st = Math.min(4, dist); dist -= st;
          f.x += f.vx / BP.SPEED * st; f.y += f.vy / BP.SPEED * st;
          if (f.x < BP.R) { f.x = BP.R; f.vx = Math.abs(f.vx); } else if (f.x > BP.W - BP.R) { f.x = BP.W - BP.R; f.vx = -Math.abs(f.vx); }
          let stop = f.y <= BP.R;
          if (!stop) for (let r = 0; r < s.grid.length && !stop; r++) {
            const py = BP.R + r * BP.RH; if (Math.abs(py - f.y) > 2 * BP.R) continue;
            for (let c = 0; c < s.grid[r].length; c++) if (s.grid[r][c]) { const p = bpXY(s.par, r, c); if ((p.x - f.x) ** 2 + (p.y - f.y) ** 2 < (1.8 * BP.R) ** 2) { stop = true; break; } }
          }
          if (stop) { G.bubblepop.land(s); break; }
        }
      }
    }
  };
  /* LOGIC-END */
  const BP_COLS = ['#e5484d', '#f5a524', '#46a758', '#3e63dd', '#ab4aba', '#12a594'];
  reg('bubblepop', 'Bubble Pop', '🫧', 'Bubble shooter: drag to aim, release to fire, and match three or more bubbles of one colour to pop them. Bubbles left hanging fall, the ceiling drops after misses, and each cleared board starts a harder level.',
    ['bubble', 'shooter', 'match', 'puzzle', 'pop', 'bust'], {
      W: BP.W, H: BP.H, hint: 'Drag to aim, let go to fire. Match 3 or more.',
      make: G.bubblepop.make, step: G.bubblepop.step,
      ptr: {
        down(s, p) { s.in.aim = Math.atan2(p.y - BP.SY, p.x - BP.SX); },
        move(s, p) { s.in.aim = Math.atan2(p.y - BP.SY, p.x - BP.SX); },
        up(s) { s.in.fire = true; }
      },
      draw(c, s, C) {
        const dot = (x, y, col, a) => {
          c.globalAlpha = a || 1; c.fillStyle = BP_COLS[(col - 1) % 6]; c.beginPath(); c.arc(x, y, BP.R - 1, 0, Math.PI * 2); c.fill();
          c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(x - 5, y - 5, 4, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
        };
        for (let r = 0; r < s.grid.length; r++) for (let k = 0; k < s.grid[r].length; k++) if (s.grid[r][k]) { const p = bpXY(s.par, r, k); dot(p.x, p.y, s.grid[r][k]); }
        for (const f of s.falling) dot(f.x, f.y, f.c, 0.7);
        c.strokeStyle = C.danger; c.lineWidth = 1; c.setLineDash && c.setLineDash([6, 6]); c.beginPath(); const ly = BP.R + BP.LIM * BP.RH - BP.R; c.moveTo(0, ly); c.lineTo(BP.W, ly); c.stroke(); c.setLineDash && c.setLineDash([]);
        const a = clampN(s.in.aim, -Math.PI + 0.2, -0.2);
        c.strokeStyle = C.muted; c.lineWidth = 2; c.setLineDash && c.setLineDash([4, 6]); c.beginPath(); c.moveTo(BP.SX, BP.SY); c.lineTo(BP.SX + Math.cos(a) * 90, BP.SY + Math.sin(a) * 90); c.stroke(); c.setLineDash && c.setLineDash([]);
        if (s.fly) dot(s.fly.x, s.fly.y, s.fly.c); else dot(BP.SX, BP.SY, s.cur);
        dot(BP.SX - 70, BP.SY + 6, s.next, 0.8);
        c.fillStyle = C.muted; c.font = '12px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'top'; c.fillText('next', BP.SX - 70, BP.SY + 24);
        c.fillStyle = C.text; c.font = '13px sans-serif'; c.textAlign = 'right'; c.fillText('Level ' + s.level + '  Drop in ' + (bpLimit(s.level) - s.misses), BP.W - 8, BP.H - 22);
      }
    });

  /* ===== 8. Maze Chase ===== */
  /* LOGIC-START */
  const MZ = { C: 15, R: 17, T: 21 };
  const MZ_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  /* Random maze (1 = wall): recursive backtracker on odd cells, then extra openings so it has loops. */
  function mzMake(seed) {
    const rng = mkRng(seed), w = Array.from({ length: MZ.R }, () => new Array(MZ.C).fill(1));
    const st = [[1, 1]]; w[1][1] = 0;
    while (st.length) {
      const [x, y] = st[st.length - 1], opts = [];
      for (const [dx, dy] of MZ_DIRS) { const nx = x + dx * 2, ny = y + dy * 2; if (nx > 0 && nx < MZ.C - 1 && ny > 0 && ny < MZ.R - 1 && w[ny][nx]) opts.push([dx, dy]); }
      if (!opts.length) { st.pop(); continue; }
      const [dx, dy] = opts[Math.floor(rng() * opts.length)];
      w[y + dy][x + dx] = 0; w[y + dy * 2][x + dx * 2] = 0; st.push([x + dx * 2, y + dy * 2]);
    }
    for (let k = 0, tries = 0; k < 16 && tries < 400; tries++) {
      const x = 1 + Math.floor(rng() * (MZ.C - 2)), y = 1 + Math.floor(rng() * (MZ.R - 2));
      if (w[y][x] && ((x % 2 === 0) !== (y % 2 === 0))) { w[y][x] = 0; k++; }
    }
    return w;
  }
  const mzOpen = (w, x, y) => y >= 0 && y < MZ.R && x >= 0 && x < MZ.C && !w[y][x];
  /* Walking distance from (tx,ty) to every tile (-1 = unreachable). */
  function mzDist(w, tx, ty) {
    const d = Array.from({ length: MZ.R }, () => new Array(MZ.C).fill(-1)), q = [[tx, ty]]; d[ty][tx] = 0;
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i];
      for (const [dx, dy] of MZ_DIRS) if (mzOpen(w, x + dx, y + dy) && d[y + dy][x + dx] < 0) { d[y + dy][x + dx] = d[y][x] + 1; q.push([x + dx, y + dy]); }
    }
    return d;
  }
  /* First step of a shortest path from (fx,fy) toward (tx,ty), or null. */
  function mzNextStep(w, fx, fy, tx, ty) {
    const d = mzDist(w, tx, ty); if (d[fy][fx] <= 0) return null;
    for (const [dx, dy] of MZ_DIRS) if (mzOpen(w, fx + dx, fy + dy) && d[fy + dy][fx + dx] === d[fy][fx] - 1) return [dx, dy];
    return null;
  }
  const MZ_START = { p: [7, 15], g: [[7, 7], [5, 7], [9, 7]], delay: [0.5, 3, 6] };
  const mzSpeedG = (level) => Math.min(5, 3.8 + level * 0.2);
  const mzFright = (level) => Math.max(3, 8 - level);
  function mzDots(w, level) {
    const d = w.map(row => row.map(v => v ? 0 : 1)); let n = 0;
    d[MZ_START.p[1]][MZ_START.p[0]] = 0;
    for (const [x, y] of [[1, 1], [13, 1], [1, 15], [13, 15]]) d[y][x] = 2;
    for (const [x, y] of MZ_START.g) d[y][x] = 0;
    for (const row of d) for (const v of row) if (v) n++;
    return { d, n };
  }
  function mzReset(s) {
    s.player = { tx: MZ_START.p[0], ty: MZ_START.p[1], dx: 0, dy: 0, p: 0 };
    s.ghosts = MZ_START.g.map((g, i) => ({ tx: g[0], ty: g[1], dx: 0, dy: 0, p: 0, kind: i, wait: MZ_START.delay[i], fright: false }));
    s.in.dx = 0; s.in.dy = 0; s.freeze = 1.2; s.fright = 0; s.combo = 0;
  }
  function mzLoad(s, level) {
    s.maze = mzMake(s.seed + level * 101); const dd = mzDots(s.maze, level); s.dots = dd.d; s.left = dd.n; mzReset(s);
  }
  /* Move an entity along tiles by dist tile-lengths; choose(e) picks a direction at each tile centre. */
  function mzAdvance(s, e, dist, choose) {
    let guard = 0;
    while (dist > 1e-9 && guard++ < 8) {
      if (!e.dx && !e.dy) { choose(e); if (!e.dx && !e.dy) return; }
      const step = Math.min(dist, 1 - e.p); e.p += step; dist -= step;
      if (e.p >= 1 - 1e-9) { e.tx += e.dx; e.ty += e.dy; e.p = 0; choose(e); }
    }
  }
  function mzPlayerChoose(s) {
    return (e) => {
      const wx = s.in.dx, wy = s.in.dy;
      if ((wx || wy) && mzOpen(s.maze, e.tx + wx, e.ty + wy)) { e.dx = wx; e.dy = wy; }
      else if (!(e.dx || e.dy) || !mzOpen(s.maze, e.tx + e.dx, e.ty + e.dy)) { e.dx = 0; e.dy = 0; }
    };
  }
  function mzGhostChoose(s, g) {
    const w = s.maze, pl = s.player;
    let opts = MZ_DIRS.filter(([dx, dy]) => mzOpen(w, g.tx + dx, g.ty + dy));
    const rev = opts.filter(([dx, dy]) => !(dx === -g.dx && dy === -g.dy && (g.dx || g.dy)));
    if (rev.length) opts = rev;
    if (!opts.length) { g.dx = 0; g.dy = 0; return; }
    let tx = pl.tx, ty = pl.ty;
    if (g.kind === 1) { /* ambusher: aim up to 4 tiles ahead of the player */
      for (let k = 0; k < 4 && mzOpen(w, tx + pl.dx, ty + pl.dy) && (pl.dx || pl.dy); k++) { tx += pl.dx; ty += pl.dy; }
    }
    const dm = mzDist(w, tx, ty);
    let chase = !g.fright && (g.kind !== 2 || (mzDist(w, pl.tx, pl.ty)[g.ty][g.tx] <= 6 && s.rng() < 0.7));
    let pick;
    if (chase) {
      let bd = 1e9; const near = [];
      for (const o of opts) { const dd = dm[g.ty + o[1]][g.tx + o[0]]; if (dd >= 0 && dd < bd) { bd = dd; near.length = 0; } if (dd === bd) near.push(o); }
      pick = near.length ? near[Math.floor(s.rng() * near.length)] : opts[0];
    } else pick = opts[Math.floor(s.rng() * opts.length)];
    g.dx = pick[0]; g.dy = pick[1];
  }
  const mzPos = (e) => ({ x: e.tx + e.dx * e.p, y: e.ty + e.dy * e.p });
  G.mazechase = {
    make: null, maze: mzMake, open: mzOpen, dist: mzDist, nextStep: mzNextStep, start: MZ_START, speedG: mzSpeedG, fright: mzFright, pos: mzPos, dots: mzDots,
    step(s, dt) {
      if (s.over) return;
      s.t += dt;
      if (s.freeze > 0) { s.freeze -= dt; return; }
      const pl = s.player, W = s.in;
      /* instant reverse mid-tile */
      if ((W.dx || W.dy) && (pl.dx || pl.dy) && W.dx === -pl.dx && W.dy === -pl.dy && pl.p > 0) { pl.tx += pl.dx; pl.ty += pl.dy; pl.dx = -pl.dx; pl.dy = -pl.dy; pl.p = 1 - pl.p; }
      mzAdvance(s, pl, 5.2 * dt, mzPlayerChoose(s));
      const here = Math.round(pl.p > 0.5 ? (pl.ty + pl.dy) : pl.ty), hx = Math.round(pl.p > 0.5 ? (pl.tx + pl.dx) : pl.tx);
      const v = s.dots[here] && s.dots[here][hx];
      if (v) {
        s.dots[here][hx] = 0; s.left--; s.score += v === 2 ? 50 : 10;
        if (v === 2) { s.fright = mzFright(s.level); s.combo = 0; for (const g of s.ghosts) g.fright = true; }
      }
      if (s.fright > 0) { s.fright -= dt; if (s.fright <= 0) { s.fright = 0; for (const g of s.ghosts) g.fright = false; } }
      for (const g of s.ghosts) {
        if (g.wait > 0) { g.wait -= dt; continue; }
        mzAdvance(s, g, (g.fright ? 2.6 : mzSpeedG(s.level)) * dt, () => mzGhostChoose(s, g));
      }
      const pp = mzPos(pl);
      for (const g of s.ghosts) {
        const gp = mzPos(g);
        if (Math.hypot(gp.x - pp.x, gp.y - pp.y) < 0.6) {
          if (g.fright) { s.combo++; s.score += 100 * Math.pow(2, Math.min(s.combo, 4)); const i = s.ghosts.indexOf(g), h = MZ_START.g[i]; Object.assign(g, { tx: h[0], ty: h[1], dx: 0, dy: 0, p: 0, fright: false, wait: 2 }); }
          else {
            s.lives--; if (s.lives <= 0) { s.over = true; return; }
            const keep = s.dots; mzReset(s); s.dots = keep; return;
          }
        }
      }
      if (s.left <= 0) { s.level++; s.score += 200; mzLoad(s, s.level); }
    }
  };
  G.mazechase.make = function (seed) {
    const s = { rng: mkRng(seed), seed: (seed >>> 0) || 1, score: 0, over: false, level: 1, lives: 3, t: 0, in: { dx: 0, dy: 0 }, player: null, ghosts: [], maze: null, dots: null, left: 0, fright: 0, combo: 0, freeze: 0 };
    mzLoad(s, 1); return s;
  };
  /* LOGIC-END */
  const MZ_GC = ['#e5484d', '#e93d82', '#12a594'];
  reg('mazechase', 'Maze Chase', '👻', 'Maze chase: swipe to steer a little muncher through a fresh random maze, eat every dot, grab a power pellet to turn the three bugs edible, and avoid them otherwise. Levels get faster.',
    ['maze', 'chase', 'ghost', 'dots', 'arcade', 'pellet', 'muncher'], {
      W: MZ.C * MZ.T, H: MZ.R * MZ.T, hint: 'Swipe to steer. Eat all dots. Power pellets let you eat the bugs.',
      make: G.mazechase.make, step: G.mazechase.step,
      ptr: {
        down(s, p) { s.o = { x: p.x, y: p.y }; },
        move(s, p) {
          if (!s.o) return; const dx = p.x - s.o.x, dy = p.y - s.o.y;
          if (Math.max(Math.abs(dx), Math.abs(dy)) > 14) { if (Math.abs(dx) > Math.abs(dy)) { s.in.dx = Math.sign(dx); s.in.dy = 0; } else { s.in.dy = Math.sign(dy); s.in.dx = 0; } s.o = { x: p.x, y: p.y }; }
        },
        up(s) { s.o = null; }
      },
      draw(c, s, C) {
        const T = MZ.T;
        c.fillStyle = C.accent; c.globalAlpha = 0.4;
        for (let y = 0; y < MZ.R; y++) for (let x = 0; x < MZ.C; x++) if (s.maze[y][x]) c.fillRect(x * T + 1, y * T + 1, T - 2, T - 2);
        c.globalAlpha = 1; c.fillStyle = C.text;
        for (let y = 0; y < MZ.R; y++) for (let x = 0; x < MZ.C; x++) {
          const v = s.dots[y][x]; if (!v) continue;
          c.beginPath(); c.arc(x * T + T / 2, y * T + T / 2, v === 2 ? 5.5 : 2, 0, Math.PI * 2); c.fill();
        }
        for (const g of s.ghosts) {
          const p = G.mazechase.pos(g), x = p.x * T + T / 2, y = p.y * T + T / 2, soon = g.fright && s.fright < 2 && Math.floor(s.t * 2) % 2;
          c.fillStyle = g.fright ? (soon ? '#8a8fa8' : '#3e63dd') : MZ_GC[g.kind];
          c.beginPath(); c.arc(x, y - 1, 8, Math.PI, 0); c.lineTo(x + 8, y + 8); c.lineTo(x + 4, y + 5); c.lineTo(x, y + 8); c.lineTo(x - 4, y + 5); c.lineTo(x - 8, y + 8); c.closePath(); c.fill();
          c.fillStyle = '#fff'; c.fillRect(x - 5, y - 4, 4, 4); c.fillRect(x + 1, y - 4, 4, 4);
          c.fillStyle = '#111'; c.fillRect(x - 4 + g.dx, y - 3 + g.dy, 2, 2); c.fillRect(x + 2 + g.dx, y - 3 + g.dy, 2, 2);
        }
        const pp = G.mazechase.pos(s.player), px = pp.x * T + T / 2, py = pp.y * T + T / 2;
        c.fillStyle = '#f5a524'; c.beginPath(); c.arc(px, py, 8.5, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#fff'; c.fillRect(px - 5, py - 5, 4, 4); c.fillRect(px + 1, py - 5, 4, 4);
        c.fillStyle = '#111'; c.fillRect(px - 4 + s.player.dx, py - 4 + s.player.dy, 2, 2); c.fillRect(px + 2 + s.player.dx, py - 4 + s.player.dy, 2, 2);
        c.fillRect(px - 3, py + 3, 6, 1.5);
        c.fillStyle = C.text; c.font = '12px sans-serif'; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText('Lives ' + s.lives + '  Level ' + s.level, 4, MZ.R * T - 14);
      }
    });

  // @@GAMES@@
})();
