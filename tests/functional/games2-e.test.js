'use strict';
/* games2.js, part 5: dodge, balance ball and typing falls (canvas games driven frame by frame with scripted input and fake sensor events). */
const { bootGame } = require('./fun-lib');
const { suite } = require('../helpers/page');

(async () => {
  const T = suite('games2-e'), G = await bootGame({ seed: 7 });
  const W = G.w;
  const run = async (id, fn, pre) => {
    const before = G.listeners(); G.unseed(); G.clock.reset(); if (pre) pre();
    const t = await G.page.open(id);
    try { await fn(t); } catch (e) { T.ok(false, id + ' threw: ' + String(e.stack || e).split('\n').slice(0, 3).join(' | ')); }
    G.leaves(t, before, T, id);
  };
  const num = (s) => +String(s).replace(/[^\d.-]/g, '');
  const overlayText = (t) => { const o = t.el.querySelector('.ov'); return o ? o.textContent : ''; };
  const tapOverlay = (t) => { const o = t.el.querySelector('.ov'); if (o) o.click(); };
  const lastFrame = (cv) => { const all = G.calls(cv); let k = all.length - 1; while (k > 0 && all[k][0] !== 'clearRect') k--; return all.slice(k); };
  const orient = (o) => { const e = new W.Event('deviceorientation'); Object.assign(e, o); W.dispatchEvent(e); };

  /* ---------------- Dodge ---------------- */
  await run('dodge', async (t) => {
    const cv = t.q('#cv'), PY = 464;
    const ship = () => { const tr = lastFrame(cv).filter(c => c[0] === 'translate'); return tr.length ? tr[tr.length - 1][1][0] : null; };
    const stars = () => lastFrame(cv).filter(c => c[0] === 'fillText' && c[1][0] === '⭐').map(c => ({ x: c[1][1], y: c[1][2] }));
    const rocks = () => lastFrame(cv).filter(c => c[0] === 'translate').slice(0, -1).map(c => ({ x: c[1][0], y: c[1][1] }));
    const score = () => num(t.q('#sc').textContent);
    T.has(overlayText(t), 'Dodge', 'dodge: start screen'); T.has(t.q('#tl').textContent, 'drag', 'dodge: steering is drag by default'); T.has(t.q('#pz').textContent, 'Pause', 'dodge: pause button');
    G.seed(4); tapOverlay(t); G.tick(40); T.near(ship(), 180, 1, 'dodge: the ship starts in the middle');
    G.ev(cv, 'pointerdown', { x: 300, y: 300 }); G.tick(400); T.near(ship(), 300, 4, 'dodge: dragging steers the ship'); G.ev(cv, 'pointermove', { x: 10, y: 300, buttons: 1 }); G.tick(400); T.ok(ship() >= 13 - 0.5 && ship() < 20, 'dodge: the ship cannot leave the left edge (' + ship().toFixed(1) + ')');
    G.ev(cv, 'pointermove', { x: 500, y: 300, buttons: 1 }); G.tick(400); T.ok(ship() <= 347.5 && ship() > 340, 'dodge: or the right edge (' + ship().toFixed(1) + ')');
    /* a bot that moves toward stars and away from rocks */
    G.ev(cv, 'pointermove', { x: 180, y: 300, buttons: 1 }); let starsTaken = 0, lastScore = score(), crashed = false, frames = 0, scoreDown = 0, nanBad = 0;
    for (let f = 0; f < 1500; f++) {
      G.tick(16); frames++; if (/Crash/.test(overlayText(t))) { crashed = true; break; }
      const sx = ship(), rs = rocks(), st = stars(); let best = sx, bestScore = -1e9;
      for (let x = 20; x <= 340; x += 10) { let danger = 0; rs.forEach(r => { const dy = PY - r.y; if (dy > -60 && dy < 170) { const d = Math.abs(r.x - x); if (d < 60) danger += (60 - d) * (1 + (170 - Math.max(0, dy)) / 170); } }); let gain = 0; st.forEach(s => { if (s.y > 250 && s.y < PY + 10) gain += Math.max(0, 70 - Math.abs(s.x - x)); }); const sc = gain * 0.8 - danger * 3 - Math.abs(x - sx) * 0.05; if (sc > bestScore) { bestScore = sc; best = x; } }
      G.ev(cv, 'pointermove', { x: best, y: 300, buttons: 1 }); if (score() < lastScore) scoreDown++; if (score() - lastScore >= 25 && score() - lastScore < 30) starsTaken++; lastScore = score(); if (!Number.isFinite(ship())) nanBad++;
    }
    T.eq(scoreDown, 0, 'dodge: the score never goes down'); T.eq(nanBad, 0, 'dodge: positions stay finite'); T.ok(G.sane(cv), 'dodge: drawing is finite'); T.ok(frames >= 400, 'dodge: the bot survived ' + (frames * 16 / 1000).toFixed(1) + ' s'); T.ok(score() >= 5 * Math.floor(frames * 16 / 1000) * 0.9, 'dodge: surviving scores about 5 points a second (score ' + score() + ' after ' + (frames * 16 / 1000).toFixed(1) + ' s, ' + starsTaken + ' stars)'); T.ok(starsTaken >= 1, 'dodge: a star was collected (+25)');
    /* pause */
    if (!crashed) { const s0 = score(), x0 = ship(); t.click('#pz'); T.has(overlayText(t), 'Paused', 'dodge: Pause overlay'); G.tick(4000); T.eq(score(), s0, 'dodge: score is frozen while paused'); T.eq(ship(), x0, 'dodge: nothing moves while paused'); G.setHidden(true); G.setHidden(false); T.has(overlayText(t), 'Paused', 'dodge: still paused after leaving and returning'); tapOverlay(t); T.eq(overlayText(t), '', 'dodge: resume'); }
    /* a stationary ship is hit sooner or later */
    G.ev(cv, 'pointermove', { x: 180, y: 300, buttons: 1 }); for (let f = 0; f < 6000 && !/Crash/.test(overlayText(t)); f++) { G.tick(16); G.ev(cv, 'pointermove', { x: 180, y: 300, buttons: 1 }); }
    T.has(overlayText(t), 'Crash', 'dodge: hitting a rock ends the run'); const fin = score(); T.has(overlayText(t), 'Score ' + fin, 'dodge: the overlay shows the score'); T.ok(G.store('fun2.dodge.best') >= fin, 'dodge: best saved'); T.eq(t.q('#bs').textContent, String(G.store('fun2.dodge.best')), 'dodge: best shown'); G.tick(2000); T.eq(score(), fin, 'dodge: the score stops when crashed'); tapOverlay(t); G.tick(40); T.eq(score(), 0, 'dodge: Try again resets the score');
  });
  await run('dodge', async (t) => {
    t.click('#tl'); T.has(t.q('#msg').textContent, 'No tilt sensor', 'dodge: with no tilt sensor the button says so'); T.has(t.q('#tl').textContent, 'drag', 'dodge: drag steering stays'); T.ok(G.store('fun2.dodge.tilt') !== true, 'dodge: tilt is not saved when there is no sensor');
  }, () => { delete W.DeviceOrientationEvent; });
  await run('dodge', async (t) => {
    const cv = t.q('#cv'); const ship = () => { const tr = lastFrame(cv).filter(c => c[0] === 'translate'); return tr.length ? tr[tr.length - 1][1][0] : null; };
    t.click('#tl'); T.has(t.q('#tl').textContent, 'tilt', 'dodge: tilt can be switched on when a sensor exists'); T.eq(G.store('fun2.dodge.tilt'), true, 'dodge: tilt choice saved');
    G.seed(6); tapOverlay(t); G.tick(50); const x0 = ship(); orient({ gamma: 30, beta: 0 }); G.tick(600); T.ok(ship() > x0 + 40, 'dodge: tilting right moves the ship right (' + x0.toFixed(0) + ' to ' + ship().toFixed(0) + ')'); orient({ gamma: -60, beta: 0 }); G.tick(1500); T.ok(ship() < 100, 'dodge: tilting left moves it left'); orient({ gamma: 90 }); G.tick(4000); T.ok(ship() <= 347.5, 'dodge: it cannot leave the screen when tilted hard');
    t.click('#tl'); T.has(t.q('#tl').textContent, 'drag', 'dodge: tilt can be switched off'); const x1 = ship(); orient({ gamma: -90 }); G.tick(300); T.near(ship(), x1, 2, 'dodge: tilt events are ignored after switching off');
  }, () => { W.DeviceOrientationEvent = function () {}; G.setStore('fun2.dodge.tilt', false); });
  await run('dodge', async (t) => { await G.page.wait(20); T.has(t.q('#msg').textContent, 'denied', 'dodge: a denied motion permission says so'); T.has(t.q('#tl').textContent, 'drag', 'dodge: and falls back to drag steering'); },
    () => { W.DeviceOrientationEvent = function () {}; W.DeviceOrientationEvent.requestPermission = () => Promise.resolve('denied'); G.setStore('fun2.dodge.tilt', true); });
  await run('dodge', async (t) => { await G.page.wait(20); T.has(t.q('#tl').textContent, 'tilt', 'dodge: granted permission switches tilt on (saved choice restored)'); },
    () => { W.DeviceOrientationEvent = function () {}; W.DeviceOrientationEvent.requestPermission = () => Promise.resolve('granted'); G.setStore('fun2.dodge.tilt', true); });
  delete W.DeviceOrientationEvent;

  /* ---------------- Balance Ball ---------------- */
  await run('balanceball', async (t) => {
    const cv = t.q('#cv'); const ball = () => { const a = lastFrame(cv).filter(c => c[0] === 'arc' && c[1][2] === 14).slice(-1)[0]; return a ? { x: a[1][0], y: a[1][1] } : null; };
    const star = () => { const f = lastFrame(cv).find(c => c[0] === 'fillText' && c[1][0] === '⭐'); return f ? { x: f[1][1], y: f[1][2] - 1 } : null; };
    const stars = () => num(t.q('#sc').textContent), time = () => num(t.q('#tl').textContent);
    T.has(overlayText(t), 'Balance Ball', 'balance: start screen'); G.tick(50); T.eq(time(), 45, 'balance: 45 seconds'); G.seed(2); tapOverlay(t); await G.page.wait(5); G.tick(50);
    T.has(t.q('#msg').textContent, 'No tilt detected', 'balance: without a sensor it explains dragging'); T.near(ball().x, 180, 2, 'balance: the ball starts in the middle'); const b0 = ball(); G.tick(1000); T.near(ball().x, b0.x, 1, 'balance: the ball stays put with no input');
    /* a finger pulls the ball */
    const tgt = { x: 300, y: 100 }; G.ev(cv, 'pointerdown', { x: tgt.x, y: tgt.y }); G.tick(1500); T.ok(Math.hypot(ball().x - tgt.x, ball().y - tgt.y) < 120, 'balance: dragging pulls the ball toward the finger (' + ball().x.toFixed(0) + ',' + ball().y.toFixed(0) + ')'); G.ev(cv, 'pointerup', { x: tgt.x, y: tgt.y }); G.tick(500); T.ok(ball().x >= 14 && ball().x <= 346 && ball().y >= 14 && ball().y <= 466, 'balance: the ball stays in the arena');
    /* chase stars */
    let got = 0, last = stars(), badNum = 0; const t0 = time();
    for (let f = 0; f < 2400 && !/Time/.test(overlayText(t)); f++) { G.tick(16); const s = star(), b = ball(); if (!b || !Number.isFinite(b.x) || !Number.isFinite(b.y)) badNum++; if (s) G.ev(cv, 'pointerdown', { x: s.x, y: s.y }); if (stars() > last) { got += stars() - last; last = stars(); } if (got >= 6) break; }
    T.ok(got >= 4, 'balance: chasing stars collects them (' + got + ' stars)'); T.eq(badNum, 0, 'balance: positions stay finite'); T.ok(G.sane(cv), 'balance: drawing is finite'); T.ok(time() <= 45, 'balance: collecting stars never takes the clock above 45 (' + time() + ')'); void t0;
    /* pause + visibility */
    if (!/Time/.test(overlayText(t))) { const tm = t.q('#tl').textContent; t.click('#pz'); T.has(overlayText(t), 'Paused', 'balance: Pause overlay'); G.tick(5000); T.eq(t.q('#tl').textContent, tm, 'balance: the clock is frozen while paused'); G.setHidden(true); G.setHidden(false); tapOverlay(t); T.eq(overlayText(t), '', 'balance: resume'); }
    /* run out the clock */
    G.ev(cv, 'pointerup', { x: 0, y: 0 }); for (let f = 0; f < 4000 && !/Time/.test(overlayText(t)); f++) G.tick(16); T.has(overlayText(t), 'Time!', 'balance: time runs out'); const sc = stars(); T.has(overlayText(t), sc + ' stars', 'balance: the overlay shows the stars'); T.eq(G.store('fun2.balanceball.best'), sc, 'balance: best saved'); tapOverlay(t); await G.page.wait(5); G.tick(50); T.eq(stars(), 0, 'balance: Play again resets'); T.eq(time(), 45, 'balance: and the clock');
  });
  await run('balanceball', async (t) => {
    const cv = t.q('#cv'); const ball = () => { const a = lastFrame(cv).filter(c => c[0] === 'arc' && c[1][2] === 14).slice(-1)[0]; return a ? { x: a[1][0], y: a[1][1] } : null; };
    tapOverlay(t); await G.page.wait(5); orient({ beta: 10, gamma: 5 }); G.tick(100); const b0 = ball(); G.tick(500); T.near(ball().x, b0.x, 3, 'balance: the first sensor reading is the level position (calibration)'); orient({ beta: 10, gamma: 30 }); G.tick(800); T.ok(ball().x > b0.x + 40, 'balance: tilting right rolls the ball right (' + b0.x.toFixed(0) + ' to ' + ball().x.toFixed(0) + ')'); orient({ beta: 40, gamma: 5 }); G.tick(800); T.ok(ball().y > b0.y + 20, 'balance: tilting the top away rolls it down the screen'); orient({ beta: 10, gamma: 5 }); G.tick(4000); T.ok(Math.hypot(ball().x - b0.x, ball().y - b0.y) < 400, 'balance: levelling the phone calms the ball'); T.ok(ball().x >= 14 && ball().x <= 346, 'balance: the ball is held inside by the walls');
  });

  /* ---------------- Typing Falls ---------------- */
  await run('typingfalls', async (t) => {
    const cv = t.q('#cv'), inp = t.q('#in');
    const wordsOnScreen = () => { const f = lastFrame(cv).filter(c => c[0] === 'fillText'); const out = []; for (let i = 0; i + 1 < f.length; i += 2) out.push({ w: String(f[i][1][0]) + String(f[i + 1][1][0]), done: String(f[i][1][0]), y: f[i][1][2] }); return out; };
    const type = (s) => { inp.value = s; inp.dispatchEvent(new W.Event('input', { bubbles: true })); };
    const score = () => num(t.q('#sc').textContent), lives = () => num(t.q('#li').textContent), level = () => num(t.q('#lv').textContent);
    T.has(overlayText(t), 'Typing Falls', 'typing: start screen'); G.seed(3); tapOverlay(t); G.tick(400); T.ok(wordsOnScreen().length >= 1, 'typing: words appear'); T.eq(lives(), 5, 'typing: five lives');
    const w0 = wordsOnScreen()[0]; T.ok(/^[a-z]{3,}$/.test(w0.w), 'typing: a lowercase word (' + w0.w + ')'); G.tick(1000); T.ok(wordsOnScreen().find(x => x.w === w0.w).y > w0.y, 'typing: words fall');
    /* a wrong letter resets what you typed */
    const wd = wordsOnScreen()[0].w; const bad = wd[0] === 'q' ? 'x' : 'q'; if (!wordsOnScreen().some(x => x.w.startsWith(bad))) { type(bad); T.eq(inp.value, '', 'typing: a letter that starts no word is rejected'); }
    type(wd.slice(0, 2)); G.tick(20); T.eq(wordsOnScreen().find(x => x.w === wd).done, wd.slice(0, 2), 'typing: the typed part of the word is highlighted'); type(wd.slice(0, 2).toUpperCase() + '1'); T.ok(inp.value === wd.slice(0, 2) || inp.value === '', 'typing: capitals fold to lowercase and digits are dropped (' + inp.value + ')');
    /* a bot types the lowest word */
    let expected = 0, cleared = 0, steps = 0; type('');
    for (let f = 0; f < 6000 && level() < 2 && !/Game over/.test(overlayText(t)); f++) { G.tick(16); const ws = wordsOnScreen(); if (!ws.length) continue; const low = ws.slice().sort((a, b) => b.y - a.y)[0]; if (low.y > 120) { const s0 = score(), lv0 = level(); type(low.w); if (score() > s0) { expected += low.w.length * lv0; cleared++; } } steps++; }
    T.ok(cleared >= 10, 'typing: the bot cleared ' + cleared + ' words'); T.eq(level(), 2, 'typing: ten cleared words raise the level to 2'); T.ok(score() >= expected - 1 && score() <= expected + 60, 'typing: each cleared word scores its length x level (' + score() + ' vs ' + expected + ')'); T.eq(lives(), 5, 'typing: no lives lost by a fast typist'); T.eq(inp.value, '', 'typing: the box is cleared after a word');
    /* duplicates are never on screen together */
    const seen = wordsOnScreen().map(x => x.w); T.eq(new Set(seen).size, seen.length, 'typing: no duplicate words are on screen at once');
    /* pause blocks typing */
    t.click('#pz'); T.has(overlayText(t), 'Paused', 'typing: Pause overlay'); const sc0 = score(); const w2 = wordsOnScreen()[0]; type(w2 ? w2.w : 'cat'); T.eq(inp.value, '', 'typing: typing is ignored while paused'); T.eq(score(), sc0, 'typing: and scores nothing'); G.tick(5000); T.eq(lives(), 5, 'typing: words do not fall while paused'); tapOverlay(t); T.eq(overlayText(t), '', 'typing: resume'); G.setHidden(true); T.has(overlayText(t), 'Paused', 'typing: hiding the app pauses'); G.setHidden(false); tapOverlay(t);
    /* an idle typist loses all lives */
    let seq = [lives()]; for (let f = 0; f < 20000 && !/Game over/.test(overlayText(t)); f++) { G.tick(16); if (seq[seq.length - 1] !== lives()) seq.push(lives()); }
    T.has(overlayText(t), 'Game over', 'typing: five missed words end the game'); T.eq(seq.join(), '5,4,3,2,1,0', 'typing: lives drop one at a time'); const fin = score(); T.has(overlayText(t), 'Score ' + fin, 'typing: overlay shows the score'); T.eq(G.store('fun2.typingfalls.best'), fin, 'typing: best saved'); G.tick(1000); T.eq(score(), fin, 'typing: nothing changes after game over'); tapOverlay(t); G.tick(40); T.eq(score(), 0, 'typing: Play again resets the score'); T.eq(lives(), 5, 'typing: and the lives'); T.eq(level(), 1, 'typing: and the level'); T.ok(G.sane(cv), 'typing: drawing is finite');
  });

  await T.done(G.page);
})().catch(e => { console.log("FAIL: test crashed: " + (e && e.stack || e)); process.exit(1); });
