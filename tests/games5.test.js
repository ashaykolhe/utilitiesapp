'use strict';
/* Pure-logic tests for www/js/tools/games5.js (eight arcade games). Run: node tests/games5.test.js */
const fs = require('fs'), path = require('path'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'www', 'js', 'tools', 'games5.js'), 'utf8');
const blocks = [...src.matchAll(/\/\* LOGIC-START \*\/([\s\S]*?)\/\* LOGIC-END \*\//g)].map(m => m[1]);
assert(blocks.length >= 9, 'expected a logic block per game');
const G = new Function(blocks.join(String.fromCharCode(10)) + ";return { G, mkRng, rectHit, circHit, clampN, modN };")();
const { mkRng, rectHit, circHit } = G;
const GG = G.G;

let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; } catch (e) { fail++; console.log('FAIL ' + name + ': ' + (e && e.stack || e)); } }

/* Scans a state tree for non-finite numbers. Returns the path or null. */
function badNum(o, p, depth) {
  if (typeof o === 'number') return Number.isFinite(o) ? null : p;
  if (!o || typeof o !== 'object' || depth > 6 || typeof o === 'function') return null;
  for (const k of Object.keys(o)) { if (k === 'rng') continue; const r = badNum(o[k], p + '.' + k, depth + 1); if (r) return r; }
  return null;
}
/* Headless run: random input every few frames, restarting when the game ends. */
function simulate(id, rinput, frames) {
  const g = GG[id], rng = mkRng(77); let s = g.make(5), restarts = 0;
  for (let f = 0; f < (frames || 5000); f++) {
    if (f % 7 === 0) rinput(s, rng, f);
    g.step(s, 1 / 60 + (rng() < 0.05 ? 0.02 : 0));
    const b = badNum(s, id, 0); if (b) throw new Error('non-finite at ' + b + ' frame ' + f);
    if (s.over) { restarts++; s = g.make(f); }
  }
  return restarts;
}

/* ---- Star Defender ---- */
t('invaders: rectHit and circHit', () => {
  assert(rectHit({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 9, w: 5, h: 5 }));
  assert(!rectHit({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 5, h: 5 }));
  assert(circHit(0, 0, 5, 6, 0, 2) && !circHit(0, 0, 5, 8, 0, 2));
});
t('invaders: waves grow, fit the screen and speed rises', () => {
  const s = GG.invaders.make(1); let prev = 0;
  for (let w = 1; w <= 30; w++) {
    s.wave = w; const sp = GG.invaders.speed(s); assert(sp >= prev && sp <= 130); prev = sp;
    const list = GG.invaders.wave(w); assert(list.length >= 21 && list.length <= 35);
    for (const i of list) assert(i.x >= 6 && i.x + i.w <= 314 && i.y + i.h < 300);
  }
});
t('invaders: bullet kills invader and scores', () => {
  const s = GG.invaders.make(2); const i = s.inv[0];
  s.bullets.push({ x: i.x + 5, y: i.y + 4, w: 3, h: 9 }); s.fireCd = 5;
  GG.invaders.step(s, 0.001);
  assert(!i.alive && s.score >= 10);
});
t('invaders: enemy bullet costs a life, then invulnerable', () => {
  const s = GG.invaders.make(3); s.fireCd = 5;
  s.ebul.push({ x: s.ship.x + 5, y: s.ship.y, w: 3, h: 9 }); GG.invaders.step(s, 0.001);
  assert.strictEqual(s.lives, 2); assert(s.hit > 1);
  s.ebul.push({ x: s.ship.x + 5, y: s.ship.y, w: 3, h: 9 }); GG.invaders.step(s, 0.001);
  assert.strictEqual(s.lives, 2);
});
t('invaders: clearing a wave advances and bonus scores', () => {
  const s = GG.invaders.make(4); s.inv.forEach(i => { i.alive = false; }); GG.invaders.step(s, 0.01);
  assert.strictEqual(s.wave, 2); assert(s.score >= 50); assert(s.inv.every(i => i.alive));
});
t('invaders: headless 5000 frames', () => {
  simulate('invaders', (s, r) => { s.in.x = r() * 400 - 40; });
});
/* ---- Rock Blaster ---- */
t('asteroids: splitting 3 -> two 2s -> two 1s -> nothing, faster each time', () => {
  const rng = mkRng(9), big = { x: 5, y: 6, vx: 30, vy: 0, size: 3, r: 28 };
  const m = GG.asteroids.split(big, rng); assert.strictEqual(m.length, 2);
  for (const r of m) { assert.strictEqual(r.size, 2); assert.strictEqual(r.r, 17); assert(Math.hypot(r.vx, r.vy) > 30); assert(r.x === 5 && r.y === 6); }
  const sm = GG.asteroids.split(m[0], rng); assert(sm.length === 2 && sm.every(r => r.size === 1 && r.r === 9));
  assert.strictEqual(GG.asteroids.split(sm[0], rng).length, 0);
});
t('asteroids: wave never spawns on the ship', () => {
  for (let w = 1; w < 20; w++) {
    const ship = { x: 160, y: 220 }, rocks = GG.asteroids.wave(w, ship, mkRng(w));
    assert(rocks.length >= 4 && rocks.length <= 9);
    for (const r of rocks) assert(Math.hypot(r.x - 160, r.y - 220) >= 110 && r.size === 3);
  }
});
t('asteroids: bullet hit splits a rock and scores', () => {
  const s = GG.asteroids.make(1); s.rocks = [{ x: 50, y: 50, vx: 0, vy: 0, size: 3, r: 28, spin: 0, rot: 0, seed: 0.1 }];
  s.cd = 9; s.ship.inv = 5; s.bullets.push({ x: 50, y: 50, vx: 0, vy: 0, life: 1 });
  GG.asteroids.step(s, 0.001);
  assert.strictEqual(s.score, 20); assert.strictEqual(s.rocks.length, 2); assert(s.rocks.every(r => r.size === 2));
});
t('asteroids: wrap-around keeps everything inside the field', () => {
  const s = GG.asteroids.make(2); s.ship.vx = 230; s.ship.x = 319; s.in.thrust = true; GG.asteroids.step(s, 0.1);
  assert(s.ship.x >= 0 && s.ship.x < 320);
});
t('asteroids: collision costs a life and respawns invulnerable', () => {
  const s = GG.asteroids.make(3); s.ship.inv = 0; const sh = s.ship;
  s.rocks = [{ x: sh.x, y: sh.y, vx: 0, vy: 0, size: 3, r: 28, spin: 0, rot: 0, seed: 0 }]; s.cd = 9;
  GG.asteroids.step(s, 0.001); assert.strictEqual(s.lives, 2); assert(s.ship.inv > 2);
});
t('asteroids: headless 5000 frames', () => {
  simulate('asteroids', (s, r) => { s.in.aim = r() < 0.2 ? null : r() * 7 - 3.5; s.in.thrust = r() < 0.5; });
});
/* ---- Road Hopper ---- */
t('hopper: lane generation always leaves a safe path', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const rng = mkRng(seed), st = { haz: 0, last: 'grass' }; let run = 0, maxRun = 0;
    for (let r = 0; r < 600; r++) {
      const l = GG.hopper.lane(r, st, rng);
      if (l.type === 'grass') { run = 0; continue; }
      run++; maxRun = Math.max(maxRun, run);
      assert(run <= 3, 'hazard run too long');
      const gap = l.sp - l.w;
      assert(l.speed <= 150 && l.speed > 0 && l.n * l.sp === 420);
      if (l.type === 'road') assert(gap >= 70 - 1e-9, 'road gap too small ' + gap);
      else assert(l.n >= 2 && gap <= 110 && gap >= 40 - 1e-9 && l.w * l.n / 420 >= 0.45, 'river needs logs with short gaps');
    }
    assert(maxRun >= 1);
  }
  const st = { haz: 0, last: 'grass' }, rng = mkRng(3);
  assert.strictEqual(GG.hopper.lane(0, st, rng).type, 'grass'); assert.strictEqual(GG.hopper.lane(1, st, rng).type, 'grass');
});
t('hopper: a log is always eventually under any river start cell', () => {
  const rng = mkRng(8), st = { haz: 0, last: 'grass' };
  for (let r = 2; r < 300; r++) {
    const l = GG.hopper.lane(r, st, rng); if (l.type !== 'river') continue;
    for (const x of [20, 100, 180, 300]) { let ok = false; for (let k = 0; k < 420; k++) { l.off = k; if (GG.hopper.onLog(l, x)) { ok = true; break; } } assert(ok); }
  }
});
t('hopper: collisions, landing and score', () => {
  const s = GG.hopper.make(11); s.in.dy = 1; GG.hopper.step(s, 0.2);
  assert.strictEqual(s.frog.row, 1); assert.strictEqual(s.score, 1);
  const lane = { type: 'river', n: 1, sp: 420, w: 100, off: 100 }; /* log spans x 0..100 */
  assert(GG.hopper.onLog(lane, 50) && !GG.hopper.onLog(lane, 150));
  const car = { type: 'road', n: 1, sp: 420, w: 60, off: 100 }; /* car spans 0..60 */
  assert(GG.hopper.hitCar(car, 65) && !GG.hopper.hitCar(car, 90));
});
t('hopper: drowning and being carried off the screen end the game', () => {
  const s = GG.hopper.make(2); s.lanes[1] = { r: 1, type: 'river', dir: 1, speed: 0, n: 1, sp: 420, w: 100, off: 100 + 300 };
  s.frog.row = 1; s.frog.x = 200; GG.hopper.step(s, 0.01); assert(s.over);
  const s2 = GG.hopper.make(2); s2.lanes[1] = { r: 1, type: 'river', dir: 1, speed: 50, n: 1, sp: 420, w: 100, off: 100 + 218 };
  s2.frog.row = 1; s2.frog.x = 310; for (let i = 0; i < 60 && !s2.over; i++) GG.hopper.step(s2, 0.05); assert(s2.over);
});
t('hopper: headless 5000 frames', () => {
  simulate('hopper', (s, r) => { const k = Math.floor(r() * 5); s.in.dx = k === 0 ? -1 : k === 1 ? 1 : 0; s.in.dy = k >= 2 ? (k === 4 ? -1 : 1) : 0; });
});
/* ---- Sprint Runner ---- */
t('runner: every generated obstacle is jumpable (or slidable) at every speed level', () => {
  const rng = mkRng(21);
  for (let v = 230; v <= 520; v += 5) for (let k = 0; k < 150; k++) {
    const o = GG.runner.obstacle(v, rng);
    assert(o.h <= 60 && o.w <= 40 && o.w >= 14);
    if (o.kind === 'low') assert(GG.runner.canJump(v, o.h, o.w), 'not jumpable ' + JSON.stringify(o) + ' at ' + v);
    else assert(GG.runner.canSlide(v, o.w) && o.yb > 22 && o.yb < 40);
  }
});
t('runner: gaps leave landing and reaction time at every speed', () => {
  const rng = mkRng(4);
  for (let v = 230; v <= 520; v += 10) for (let k = 0; k < 100; k++) {
    const w = 20 + Math.floor(rng() * 20), g = GG.runner.nextGap(v, w, rng);
    assert(g - w >= GG.runner.minGap(v) - 1e-9);
    assert((g - w) / v >= 0.689 + 0.3 - 1e-9);
  }
  for (let t0 = 0; t0 < 100; t0 += 5) assert(GG.runner.speedAt(t0) <= 520 && GG.runner.speedAt(t0 + 5) >= GG.runner.speedAt(t0));
});
t('runner: a simple tap-only bot survives at slow, medium and top speed', () => {
  for (const t0 of [0, 20, 41, 80]) {
    const g = GG.runner, s = g.make(100 + t0); s.t = t0; let ground = 0;
    for (let f = 0; f < 3600; f++) {
      const sp = s.speed, o = s.obs.find(q => q.x + q.w > 60 + 11 - 2);
      if (o) {
        const d = o.x + o.w / 2 - 71;
        if (o.kind === 'low' && d <= 0.344 * sp && d > 0) s.in.jump = true;
        if (o.kind === 'high' && d <= 0.2 * sp && d > 0) s.in.slide = true;
      }
      g.step(s, 1 / 60); if (s.over) throw new Error('bot died at t0=' + t0 + ' frame ' + f);
    }
  }
});
t('runner: jump physics, hold gives more height, slide shrinks the hitbox', () => {
  const peak = (held) => { const s = GG.runner.make(1); s.gapLeft = 1e9; s.in.jump = true; s.in.held = held; let m = 0; for (let i = 0; i < 90; i++) { GG.runner.step(s, 1 / 60); s.in.held = held; m = Math.max(m, s.py); } return m; };
  const lo = peak(false), hi = peak(true); assert(lo > 90 && lo < 125 && hi > lo + 50 && hi < 240);
  const s = GG.runner.make(1); s.gapLeft = 1e9; s.in.slide = true; GG.runner.step(s, 0.01); assert(s.sliding > 0.5);
  s.obs.push({ kind: 'high', x: 62, w: 30, h: 20, yb: 26 }); assert(!GG.runner.hit(s));
  s.sliding = 0; assert(GG.runner.hit(s));
});
t('runner: score is distance and collision ends the game', () => {
  const s = GG.runner.make(3); s.gapLeft = 1e9; for (let i = 0; i < 60; i++) GG.runner.step(s, 1 / 60); assert(s.score > 20);
  s.obs.push({ kind: 'low', x: 62, w: 30, h: 40, yb: 0 }); GG.runner.step(s, 0.01); assert(s.over);
});
t('runner: headless 5000 frames', () => {
  simulate('runner', (s, r) => { s.in.jump = r() < 0.3; s.in.held = r() < 0.5; s.in.slide = r() < 0.15; });
});
/* ---- Sky Jumper ---- */
t('jumper: platform generation is always reachable with the jump height', () => {
  assert(GG.jumper.apex > 140);
  for (const score of [0, 100, 500, 1000, 3000, 10000, 100000]) {
    const rng = mkRng(score + 1);
    for (let i = 0; i < 2000; i++) { const g = GG.jumper.gap(score, rng); assert(g >= 42 && g <= 110 && g <= 0.8 * GG.jumper.apex, 'gap ' + g); }
  }
  const s = GG.jumper.make(5); s.score = 4000; s.cam = -50000; s.topY = 0; GG.jumper.fill(s);
  const solid = s.plats.filter(p => p.type !== 'b').map(p => p.y).sort((a, b) => b - a);
  for (let i = 1; i < solid.length; i++) assert(solid[i - 1] - solid[i] <= 110.0001 && solid[i - 1] - solid[i] > 0);
});
t('jumper: platforms stay inside the screen width and breakable ones are extras', () => {
  const s = GG.jumper.make(6); s.score = 3000; s.cam = -20000; s.topY = 0; GG.jumper.fill(s);
  for (const p of s.plats) assert(p.x >= 0 && p.x + p.w <= 320.0001);
  assert(s.plats.some(p => p.type === 'b') && s.plats.some(p => p.spring));
});
t('jumper: landing bounces, springs bounce higher, breakable platform breaks', () => {
  const s = GG.jumper.make(7); s.plats = [{ x: 100, y: 300, w: 56, type: 'n', vx: 0, spring: false, broken: false }]; s.topY = 300;
  Object.assign(s.p, { x: 120, y: 296, vy: 300 }); GG.jumper.step(s, 0.02); assert.strictEqual(s.p.vy, -560);
  s.plats[0].spring = true; Object.assign(s.p, { x: 120, y: 296, vy: 300 }); GG.jumper.step(s, 0.02); assert.strictEqual(s.p.vy, -900);
  s.plats[0].spring = false; s.plats[0].type = 'b'; Object.assign(s.p, { x: 120, y: 296, vy: 300 }); GG.jumper.step(s, 0.02); assert(s.plats[0].broken && s.p.vy > 0);
});
t('jumper: falling below the screen ends the game, wrapping at the edges', () => {
  const s = GG.jumper.make(8); s.plats = []; s.topY = -1e9; s.p.y = 1000; GG.jumper.step(s, 0.01); assert(s.over);
  const w = GG.jumper.make(8); w.p.x = 319; w.in.useTilt = true; w.in.tilt = 1; GG.jumper.step(w, 0.1); assert(w.p.x >= 0 && w.p.x < 320);
});
t('jumper: a steering bot climbs without falling', () => {
  const g = GG.jumper, s = g.make(31);
  for (let f = 0; f < 6000; f++) {
    const p = s.p, wrapDx = (q) => { let d = q.x + q.w / 2 - p.x; if (d > 160) d -= 320; if (d < -160) d += 320; return d; };
    const solid = s.plats.filter(q => q.type !== 'b' && !q.broken); let best = null;
    if (p.vy < 0) { for (const q of solid) if (q.y < p.y - 20 && q.y > p.y - p.vy * p.vy / 2200 + 10 && (!best || Math.abs(wrapDx(q)) < Math.abs(wrapDx(best)))) best = q; }
    else {
      for (const q of solid) { const dy = q.y - p.y; if (dy < -2 || dy > 250) continue; const t = Math.sqrt(2 * Math.max(dy, 1) / 1100) + 0.05; if (Math.abs(wrapDx(q)) <= 240 * t && (!best || dy < best.y - p.y)) best = q; }
    }
    if (best) s.in.dragX = p.x + wrapDx(best); else s.in.dragX = null;
    g.step(s, 1 / 60); if (s.over) throw new Error('bot fell at frame ' + f + ' score ' + s.score);
  }
  assert(s.score > 150, "score " + s.score);
});
t('jumper: headless 5000 frames', () => {
  simulate('jumper', (s, r) => { s.in.useTilt = r() < 0.5; s.in.tilt = r() * 2 - 1; s.in.dragX = r() < 0.4 ? r() * 320 : null; });
});
/* ---- Tower Stack ---- */
t('towerstack: overhang cut maths (left, right, inside, miss)', () => {
  const top = { x: 100, w: 100 };
  let r = GG.towerstack.drop(top, { x: 130, w: 100 }); assert(r.ok && r.x === 130 && r.w === 70 && !r.perfect && r.cut.x === 200 && r.cut.w === 30);
  r = GG.towerstack.drop(top, { x: 70, w: 100 }); assert(r.ok && r.x === 100 && r.w === 70 && r.cut.x === 70 && r.cut.w === 30);
  r = GG.towerstack.drop(top, { x: 120, w: 50 }); assert(r.ok && r.x === 120 && r.w === 50 && r.cut === null);
  r = GG.towerstack.drop(top, { x: 200, w: 60 }); assert(!r.ok);
  r = GG.towerstack.drop(top, { x: 40, w: 60 }); assert(!r.ok);
});
t('towerstack: kept width plus cut width equals the dropped width (conservation)', () => {
  const rng = mkRng(2);
  for (let i = 0; i < 2000; i++) {
    const top = { x: rng() * 160, w: 20 + rng() * 140 }, cur = { x: rng() * 200, w: top.w };
    const r = GG.towerstack.drop(top, cur); if (!r.ok || r.perfect) continue;
    assert(Math.abs(r.w + (r.cut ? r.cut.w : 0) - cur.w) < 1e-9 || r.cut === null);
    assert(r.w <= top.w + 1e-9 && r.x >= top.x - 1e-9 && r.x + r.w <= top.x + top.w + 1e-9);
  }
});
t('towerstack: perfect drop grows the block (up to the start width) and stays on screen', () => {
  let r = GG.towerstack.drop({ x: 100, w: 100 }, { x: 102, w: 100 }); assert(r.perfect && r.w === 106 && r.x === 97);
  r = GG.towerstack.drop({ x: 0, w: 158 }, { x: 0, w: 158 }); assert(r.perfect && r.w === 160 && r.x >= 0);
  r = GG.towerstack.drop({ x: 80, w: 160 }, { x: 80, w: 160 }); assert(r.perfect && r.w === 160);
});
t('towerstack: gameplay drops add height, a miss ends the game', () => {
  const s = GG.towerstack.make(4); s.cur.x = 80; s.cur.dir = 0; s.in.drop = true; GG.towerstack.step(s, 0);
  assert.strictEqual(s.stack.length, 2); assert.strictEqual(s.score, 1); assert(s.perfect === 1 && s.stack[1].w > 160 - 1 && s.stack[1].w <= 160);
  s.cur.x = 0; s.cur.w = 10; s.cur.dir = 0; s.stack[1].x = 200; s.stack[1].w = 100; s.in.drop = true; GG.towerstack.step(s, 0); assert(s.over);
  assert(GG.towerstack.speed(0) < GG.towerstack.speed(30) && GG.towerstack.speed(1000) <= 300);
});
t('towerstack: block always bounces inside the screen', () => {
  const s = GG.towerstack.make(5); for (let i = 0; i < 3000; i++) { GG.towerstack.step(s, 1 / 60); assert(s.cur.x >= -1e-9 && s.cur.x + s.cur.w <= 320 + 1e-9); }
});
t('towerstack: headless 5000 frames', () => {
  simulate('towerstack', (s, r) => { s.in.drop = r() < 0.6; });
});
/* ---- Bubble Pop ---- */
t('bubblepop: neighbour geometry matches the hex layout for both parities', () => {
  const B = GG.bubblepop;
  for (const par of [0, 1]) for (let r = 0; r < 12; r++) for (let c = 0; c < B.len(par, r); c++) {
    const a = B.xy(par, r, c), ns = B.neighbors(par, r, c, 12);
    assert(a.x >= 16 - 1e-9 && a.x <= 304 + 1e-9);
    for (const [rr, cc] of ns) { const b = B.xy(par, rr, cc); assert(Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - 32) < 1e-6, 'bad neighbour'); }
    /* symmetric, and every cell at distance 32 is a neighbour */
    for (let rr = 0; rr < 12; rr++) for (let cc = 0; cc < B.len(par, rr); cc++) {
      const b = B.xy(par, rr, cc), near = Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - 32) < 1e-6;
      assert.strictEqual(near, ns.some(n => n[0] === rr && n[1] === cc));
    }
  }
});
t('bubblepop: matching finds the connected same-colour cluster only', () => {
  const B = GG.bubblepop, g = [[1, 1, 2, 0, 0, 0, 0, 0, 0, 0], [0, 1, 0, 0, 0, 0, 0, 0, 0], [2, 0, 0, 1, 0, 0, 0, 0, 0, 0]];
  const m = B.match(g, 0, 0, 0).map(x => x.join(',')).sort();
  assert.deepStrictEqual(m, ['0,0', '0,1', '1,1']);
  assert.strictEqual(B.match(g, 0, 2, 3).length, 1); assert.strictEqual(B.match(g, 0, 0, 3).length, 0);
});
t('bubblepop: floating cluster detection', () => {
  const B = GG.bubblepop, e = (n) => new Array(n).fill(0);
  const g = [e(10), e(9), e(10), e(9)];
  g[0][4] = 1; g[1][3] = 2; g[1][4] = 2; /* attached chain */
  g[3][0] = 3; g[3][1] = 3; /* island */
  const f = B.floating(g, 0).map(x => x.join(',')).sort();
  assert.deepStrictEqual(f, ['3,0', '3,1']);
  assert.strictEqual(B.floating([e(10)], 0).length, 0);
});
t('bubblepop: snapping picks the nearest empty cell', () => {
  const B = GG.bubblepop, g = [new Array(10).fill(1)];
  const a = B.snap(g, 0, 160, 30); assert.strictEqual(a.r, 1); assert(a.c === 4 || a.c === 5);
  const p = B.xy(0, 1, a.c); assert(Math.hypot(p.x - 160, p.y - 30) < 20);
  assert.strictEqual(B.snap([], 0, 100, 5).r, 0);
});
t('bubblepop: landing pops 3+, drops floating bubbles, scores; a miss counts toward the ceiling drop', () => {
  const B = GG.bubblepop, s = B.make(1), e = (n) => new Array(n).fill(0);
  s.grid = [e(10), e(9), e(10)]; s.grid[0][0] = 5; s.grid[0][1] = 1; s.grid[1][0] = 1; s.grid[1][5] = 2; /* 2@(1,5) is floating */
  const q = B.xy(0, 0, 2); s.fly = { x: q.x, y: q.y, vx: 0, vy: 0, c: 1 }; B.land(s);
  assert.strictEqual(s.grid[0][1], 0); assert.strictEqual(s.grid.length, 1); assert.strictEqual(s.grid[0][2], 0); assert.strictEqual(s.grid[0][0], 5);
  assert.strictEqual(s.score, 30 + 20); /* 1@(0,1), 1@(1,0), new 1 */ assert.strictEqual(s.falling.length, 1);
  const s2 = B.make(2); const before = s2.grid.length, par = s2.par;
  for (let i = 0; i < B.limit(1); i++) { s2.fly = { x: 160, y: 5, vx: 0, vy: 0, c: 99 }; B.land(s2); }
  assert(s2.par !== par || s2.over); assert(s2.over || s2.grid.length >= before);
});
t('bubblepop: row insertion keeps every existing bubble in place', () => {
  const B = GG.bubblepop, s = B.make(3), before = s.grid.map((row, r) => row.map((v, c) => [v, B.xy(s.par, r, c)]));
  B.addRow(s);
  for (let r = 0; r < before.length; r++) for (let c = 0; c < before[r].length; c++) {
    const [v, a] = before[r][c], b = B.xy(s.par, r + 1, c); assert.strictEqual(s.grid[r + 1][c], v); assert(Math.abs(a.x - b.x) < 1e-9);
  }
  assert.strictEqual(s.grid[0].length, B.len(s.par, 0));
});
t('bubblepop: a shot flies, bounces off walls and lands; clearing the board levels up; overflow ends the game', () => {
  const B = GG.bubblepop, s = B.make(4); s.in.aim = -0.5; s.in.fire = true; let guard = 0;
  while (guard++ < 600) { B.step(s, 1 / 60); if (!s.fly && guard > 2) break; }
  assert(!s.fly && s.grid.length >= 1);
  const l = B.make(5); l.grid = [[1, 1].concat(new Array(8).fill(0))]; l.fly = { x: 16, y: 16 + 32, vx: 0, vy: 0, c: 1 }; B.land(l);
  assert.strictEqual(l.level, 2); assert(l.score >= 100);
  const o = B.make(6); o.fly = { x: 160, y: 16 + 12 * 27.7, vx: 0, vy: 0, c: 3 }; o.grid = Array.from({ length: 11 }, (_, r) => new Array(B.len(0, r)).fill(1 + (r % 3))); B.land(o); assert(o.over);
});
t('bubblepop: headless 5000 frames', () => {
  simulate('bubblepop', (s, r) => { s.in.aim = r() * 8 - 4; s.in.fire = r() < 0.7; });
});
/* ---- Maze Chase ---- */
t('mazechase: every generated maze is fully connected and has open start tiles', () => {
  const M = GG.mazechase;
  for (let seed = 1; seed <= 60; seed++) {
    const w = M.maze(seed), d = M.dist(w, 7, 15);
    for (let y = 0; y < 17; y++) for (let x = 0; x < 15; x++) {
      if (x === 0 || y === 0 || x === 14 || y === 16) assert(w[y][x] === 1, 'border must be wall');
      if (!w[y][x]) assert(d[y][x] >= 0, 'unreachable tile ' + x + ',' + y);
    }
    for (const [x, y] of [[7, 15], ...M.start.g, [1, 1], [13, 1], [1, 15], [13, 15]]) assert(M.open(w, x, y));
  }
});
t('mazechase: shortest-path step moves along open tiles and reaches the target', () => {
  const M = GG.mazechase, w = M.maze(9), rng = mkRng(5), open = [];
  for (let y = 0; y < 17; y++) for (let x = 0; x < 15; x++) if (!w[y][x]) open.push([x, y]);
  for (let k = 0; k < 200; k++) {
    let [x, y] = open[Math.floor(rng() * open.length)]; const [tx, ty] = open[Math.floor(rng() * open.length)];
    let n = 0; const d0 = M.dist(w, tx, ty)[y][x];
    while ((x !== tx || y !== ty) && n++ < 400) { const st = M.nextStep(w, x, y, tx, ty); assert(st); x += st[0]; y += st[1]; assert(M.open(w, x, y)); }
    assert(x === tx && y === ty && n === d0);
  }
  assert.strictEqual(M.nextStep(w, 7, 15, 7, 15), null);
});
t('mazechase: ghosts and player never leave open tiles (3000 frames, several levels)', () => {
  const M = GG.mazechase, rng = mkRng(12);
  for (const seed of [3, 17, 99]) {
    const s = M.make(seed); s.lives = 99;
    for (let f = 0; f < 3000; f++) {
      if (f % 20 === 0) { const k = Math.floor(rng() * 4); s.in.dx = [1, -1, 0, 0][k]; s.in.dy = [0, 0, 1, -1][k]; }
      if (f === 1500) s.fright = 0;
      M.step(s, 1 / 60);
      for (const e of [s.player, ...s.ghosts]) {
        assert(M.open(s.maze, e.tx, e.ty), 'in a wall');
        if (e.dx || e.dy) assert(M.open(s.maze, e.tx + e.dx, e.ty + e.dy), 'heading into a wall');
        assert(e.p >= 0 && e.p <= 1);
      }
      if (s.over) break;
    }
  }
});
t('mazechase: scoring (dot 10, pellet 50 starts fright, eating a bug scores combos, level clear bonus)', () => {
  const M = GG.mazechase, s = M.make(4); s.freeze = 0;
  const pl = s.player; s.dots[pl.ty][pl.tx] = 1; s.left = 5; M.step(s, 0.001); assert.strictEqual(s.score, 10);
  s.dots[pl.ty][pl.tx] = 2; M.step(s, 0.001); assert.strictEqual(s.score, 60); assert(s.fright > 0 && s.ghosts.every(g => g.fright));
  const g = s.ghosts[0]; Object.assign(g, { tx: pl.tx, ty: pl.ty, dx: 0, dy: 0, p: 0, wait: 0 }); M.step(s, 0.001);
  assert(s.score >= 60 + 200 && g.wait > 0 && !g.fright);
  const t = M.make(5); t.freeze = 0; t.left = 1; const q = t.player; t.dots[q.ty][q.tx] = 1; M.step(t, 0.001); assert.strictEqual(t.level, 2); assert(t.score >= 210);
  assert(M.speedG(1) < M.speedG(10) && M.speedG(100) <= 5 && M.fright(1) > M.fright(20) && M.fright(20) >= 3);
});
t('mazechase: touching a bug costs a life and ends the game at zero', () => {
  const M = GG.mazechase, s = M.make(6); s.freeze = 0; const g = s.ghosts[0]; Object.assign(g, { tx: s.player.tx, ty: s.player.ty, dx: 0, dy: 0, p: 0, wait: 0, fright: false });
  M.step(s, 0.001); assert.strictEqual(s.lives, 2); assert(s.freeze > 0);
  s.lives = 1; s.freeze = 0; Object.assign(s.ghosts[0], { tx: s.player.tx, ty: s.player.ty, wait: 0 }); M.step(s, 0.001); assert(s.over);
});
t('mazechase: headless 5000 frames', () => {
  simulate('mazechase', (s, r) => { const k = Math.floor(r() * 5); s.in.dx = [1, -1, 0, 0, 0][k]; s.in.dy = [0, 0, 1, -1, 0][k]; });
});
t('games5: every game has a logic block', () => { assert(blocks.length >= 9); });
/*__TESTS__*/

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
