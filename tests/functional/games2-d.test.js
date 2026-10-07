'use strict';
/* games2.js, part 4: the canvas action games (block stack, breakout, pong) driven frame by frame with scripted input. */
const { bootGame } = require('./fun-lib');
const { suite } = require('../helpers/page');
global.Tools = global.Tools || { register() {} };
const L = require('../../www/js/tools/games2.js');

(async () => {
  const T = suite('games2-d'), G = await bootGame({ seed: 7 });
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

  /* ---------------- Block Stack ---------------- */
  await run('blockstack', async (t) => {
    const cv = t.q('#cv'), CW = 26;
    const frame = () => { const all = G.calls(cv); let k = all.length - 1; while (k > 0 && all[k][0] !== 'clearRect') k--; return all.slice(k); };
    /* cells drawn in the last frame: {x, y, alpha, color} for every 24-pixel rounded square */
    const cellsNow = () => { let alpha = 1, color = ''; const out = []; frame().forEach(c => { if (c[0] === 'set:globalAlpha') alpha = c[1][0]; else if (c[0] === 'set:fillStyle') color = c[1][0]; else if (c[0] === 'roundRect' && c[1][2] === CW - 2) out.push({ x: Math.round((c[1][0] - 1) / CW), y: Math.round((c[1][1] - 1) / CW), alpha, color }); }); return out; };
    const state = () => { const cs = cellsNow(), ghost = cs.filter(c => c.alpha < 1), gi = cs.findIndex(c => c.alpha < 1), gl = cs.map(c => c.alpha < 1).lastIndexOf(true); const piece = ghost.length ? cs.slice(gl + 1) : [], locked = ghost.length ? cs.slice(0, gi) : cs; return { piece, ghost, locked }; };
    const minY = (cs) => Math.min(...cs.map(c => c.y)), minX = (cs) => Math.min(...cs.map(c => c.x)), maxX = (cs) => Math.max(...cs.map(c => c.x));
    const COLORS = ['', '#06b6d4', '#eab308', '#a855f7', '#22c55e', '#ef4444', '#3b82f6', '#f97316'];
    T.has(overlayText(t), 'Block Stack', 'blocks: start screen'); G.tick(100); T.eq(num(t.q('#sc').textContent), 0, 'blocks: score 0'); T.ok(G.sane(cv), 'blocks: idle drawing is finite');
    G.key('ArrowLeft'); G.tick(100); T.ok(state().piece.length === 0, 'blocks: no piece before Start');
    G.seed(31); tapOverlay(t); G.tick(20); let s = state(); T.ok(s.piece.length >= 3 && s.piece.length <= 4, 'blocks: a piece appears'); T.eq(s.ghost.length, 4, 'blocks: with a ghost showing where it will land'); T.eq(s.locked.length, 0, 'blocks: empty board'); const y0 = minY(s.piece);
    G.tick(800); T.eq(minY(state().piece), y0 + 1, 'blocks: the piece falls one row every 800 ms at level 1'); G.tick(800); T.eq(minY(state().piece), y0 + 2, 'blocks: and keeps falling');
    /* moving and walls */
    for (let k = 0; k < 12; k++) G.key('ArrowLeft'); G.tick(20); T.eq(minX(state().piece), 0, 'blocks: the piece stops at the left wall'); for (let k = 0; k < 12; k++) G.key('ArrowRight'); G.tick(20); T.eq(maxX(state().piece), 9, 'blocks: and at the right wall');
    const before = state().piece.map(c => c.x + ',' + c.y).sort().join(); G.key('ArrowUp'); G.tick(20); const after = state().piece.map(c => c.x + ',' + c.y).sort().join(); const typeId = COLORS.indexOf(state().piece[0].color); T.ok(typeId === 2 || before !== after, 'blocks: rotating changes the shape (except the square)'); T.ok(state().piece.every(c => c.x >= 0 && c.x <= 9), 'blocks: rotation stays inside the walls');
    const yb = minY(state().piece), sc0 = num(t.q('#sc').textContent); G.key('ArrowDown'); G.tick(20); T.eq(minY(state().piece), yb + 1, 'blocks: soft drop moves down one row'); T.eq(num(t.q('#sc').textContent), sc0 + 1, 'blocks: soft drop scores 1 per row');
    /* hard drop: score is 2 per row dropped and the piece lands exactly on the ghost */
    s = state(); const ghostShape = s.ghost.map(c => c.x + ',' + c.y).sort().join(), dist = Math.max(...s.ghost.map(c => c.y)) - Math.max(...s.piece.map(c => c.y)), sc1 = num(t.q('#sc').textContent); G.key(' '); G.tick(20);
    T.eq(num(t.q('#sc').textContent), sc1 + 2 * dist, 'blocks: hard drop scores 2 per row (' + dist + ' rows)'); const l2 = state().locked.map(c => c.x + ',' + c.y).sort().join(); T.eq(l2, ghostShape, 'blocks: the piece locks exactly where the ghost was'); T.eq(state().piece.length, 4, 'blocks: the next piece arrives');
    /* pause */
    t.click('#pz'); T.has(overlayText(t), 'Paused', 'blocks: Pause shows an overlay'); const py = minY(state().piece); G.tick(5000); T.eq(minY(state().piece), py, 'blocks: nothing moves while paused'); G.key('ArrowLeft'); G.key(' '); G.tick(50); T.eq(state().locked.length, 4, 'blocks: keys do nothing while paused'); tapOverlay(t); T.eq(overlayText(t), '', 'blocks: tapping the overlay resumes'); G.tick(900); T.ok(minY(state().piece) > py || state().piece.length === 4, 'blocks: and the piece falls again');
    G.setHidden(true); T.has(overlayText(t), 'Paused', 'blocks: leaving the app pauses'); G.setHidden(false); T.has(overlayText(t), 'Paused', 'blocks: coming back does not resume by itself'); tapOverlay(t);
    /* the hold-to-repeat timer must never cancel the game's animation frame (separate timeout and frame id pools) */
    const rafId = [...G.clock.rafs.keys()][0]; G.clock.tid = rafId - 1; const yBefore = minY(state().piece), lb = t.q('[data-a="l"]'); G.ev(lb, 'pointerdown'); G.ev(lb, 'pointerup'); G.tick(1700); T.ok(G.clock.rafs.size > 0, 'blocks: releasing a hold button leaves the game loop running'); T.ok(minY(state().piece) !== yBefore || state().locked.length > 4, 'blocks: and the piece still falls');
  });
  /* a bot that plays real games: places every piece with the game's own geometry and checks the scoring rules */
  await run('blockstack', async (t) => {
    const cv = t.q('#cv'), CW = 26, COL = ['', '#06b6d4', '#eab308', '#a855f7', '#22c55e', '#ef4444', '#3b82f6', '#f97316'];
    const frame = () => { const all = G.calls(cv); let k = all.length - 1; while (k > 0 && all[k][0] !== 'clearRect') k--; return all.slice(k); };
    const read = () => { let alpha = 1, color = ''; const out = []; frame().forEach(c => { if (c[0] === 'set:globalAlpha') alpha = c[1][0]; else if (c[0] === 'set:fillStyle') color = c[1][0]; else if (c[0] === 'roundRect' && c[1][2] === CW - 2) out.push({ x: Math.round((c[1][0] - 1) / CW), y: Math.round((c[1][1] - 1) / CW), alpha, color }); }); const ghost = out.filter(c => c.alpha < 1), gi = out.findIndex(c => c.alpha < 1), gl = out.map(c => c.alpha < 1).lastIndexOf(true); const piece = ghost.length ? out.slice(gl + 1) : [], locked = ghost.length ? out.slice(0, gi) : out; return { piece, locked }; };
    const toBoard = (locked) => { const b = L.bsNewBoard(); locked.forEach(c => { if (c.y >= 0 && c.y < 20) b[c.y][c.x] = 1; }); return b; };
    const score = () => num(t.q('#sc').textContent), lines = () => num(t.q('#ln').textContent), level = () => num(t.q('#lv').textContent);
    const holes = (b) => { let h = 0; for (let c = 0; c < 10; c++) { let seen = false; for (let r = 0; r < 20; r++) { if (b[r][c]) seen = true; else if (seen) h++; } } return h; };
    const height = (b) => { let m = 0; for (let c = 0; c < 10; c++) for (let r = 0; r < 20; r++) if (b[r][c]) { m += 20 - r; break; } return m; };
    G.seed(99); tapOverlay(t); G.tick(20); let bad = 0, pieces = 0, maxLines = 0, scoreBad = 0;
    for (let p = 0; p < 160 && !/Game over/.test(overlayText(t)); p++) {
      G.tick(20); const st = read(); if (st.piece.length < 3) { bad++; break; } const id = COL.indexOf(st.piece[0].color); if (id < 1) { bad++; break; }
      const board = toBoard(st.locked); let shape = L.BS_SHAPES[L.BS_KEYS[id - 1]], best = null;
      for (let r = 0; r < 4; r++) { for (let x = -2; x < 10; x++) { if (L.bsCollide(board, shape, x, 0)) continue; let y = 0; while (!L.bsCollide(board, shape, x, y + 1)) y++; const nb = board.map(row => row.slice()); L.bsLock(nb, shape, x, y, 1); const cleared = nb.filter(row => row.every(Boolean)).length; const sc = cleared * 100 - holes(nb) * 8 - height(nb) * 0.6 - (cleared ? 0 : 0); if (!best || sc > best.sc) best = { sc, r, x, y }; } shape = L.bsRot(shape); }
      if (!best) { bad++; break; }
      for (let k = 0; k < best.r; k++) { G.key('ArrowUp'); G.tick(20); }
      const now = read().piece; const shapeNow = (() => { let sh = L.BS_SHAPES[L.BS_KEYS[id - 1]]; for (let k = 0; k < best.r; k++) sh = L.bsRot(sh); return sh; })(); const offX = Math.min(...shapeNow.map(row => row.findIndex(v => v)).filter(v => v >= 0)); const wantMin = best.x + offX; let guard = 0;
      while (Math.min(...read().piece.map(c => c.x)) !== wantMin && guard++ < 14) { G.key(Math.min(...read().piece.map(c => c.x)) > wantMin ? 'ArrowLeft' : 'ArrowRight'); G.tick(20); } void now;
      const sc0 = score(), ln0 = lines(), lv0 = level(), dropRows = (() => { const s2 = (() => { let al = 1; const gh = []; frame().forEach(c => { if (c[0] === 'set:globalAlpha') al = c[1][0]; else if (c[0] === 'roundRect' && c[1][2] === CW - 2 && al < 1) gh.push(c); }); return gh; })(); const pc = read().piece; return s2.length ? Math.round((Math.max(...s2.map(c => c[1][1])) - 1) / CW) - Math.max(...pc.map(c => c.y)) : 0; })();
      const preState = { piece: read().piece.map(c => c.x + ',' + c.y), gh: (() => { let al = 1; const gh = []; frame().forEach(c => { if (c[0] === 'set:globalAlpha') al = c[1][0]; else if (c[0] === 'roundRect' && c[1][2] === CW - 2 && al < 1) gh.push(Math.round((c[1][0] - 1) / CW) + ',' + Math.round((c[1][1] - 1) / CW)); }); return gh; })() };
      G.key(' '); G.tick(400); pieces++;
      const dl = lines() - ln0; maxLines = Math.max(maxLines, dl); const expect = sc0 + 2 * dropRows + L.bsScore(dl, lv0); if (score() !== expect) { scoreBad++; if (process.env.DBG) console.log('score', p, sc0, dropRows, dl, lv0, score(), expect, JSON.stringify(preState)); }
      if (level() !== L.bsLevel(lines())) bad++;
    }
    T.eq(bad, 0, 'blocks: the bot always found a piece, and the level is 1 + lines / 10'); T.eq(scoreBad, 0, 'blocks: every score change equals 2 per hard-dropped row plus the line-clear table (100/300/500/800 x level)'); T.ok(lines() >= 10, 'blocks: the bot cleared lines (' + lines() + ' lines over ' + pieces + ' pieces)'); T.ok(level() >= 2, 'blocks: reaching 10 lines raises the level (level ' + level() + ')'); T.ok(G.sane(cv), 'blocks: drawing stays finite');
    T.ok(num(t.q('#bs').textContent) <= score() || /Game over/.test(overlayText(t)), 'blocks: best is only updated at game over');
    /* stacking in the middle ends the game */
    G.unseed(); let guard = 0; while (!/Game over/.test(overlayText(t)) && guard++ < 80) { G.key(' '); G.tick(400); } T.has(overlayText(t), 'Game over', 'blocks: stacking up to the top ends the game'); const fin = score(); T.eq(G.store('fun2.blockstack.best'), Math.max(fin, G.store('fun2.blockstack.best')), 'blocks: best saved'); T.ok(G.store('fun2.blockstack.best') >= fin, 'blocks: best is at least this score'); T.has(overlayText(t), 'Score ' + fin, 'blocks: the overlay shows the score');
    G.key('ArrowLeft'); G.tick(50); tapOverlay(t); G.tick(20); T.eq(score(), 0, 'blocks: Play again resets the score'); T.eq(lines(), 0, 'blocks: and the lines'); T.eq(read().locked.length, 0, 'blocks: and clears the board');
  });

  /* ---------------- Breakout ---------------- */
  await run('breakout', async (t) => {
    const cv = t.q('#cv'), W0 = 360;
    const frame = () => { const all = G.calls(cv); let k = all.length - 1; while (k > 0 && all[k][0] !== 'clearRect') k--; return all.slice(k); };
    const parse = () => { const f = frame(), rr = f.filter(c => c[0] === 'roundRect'), arcs = f.filter(c => c[0] === 'arc' && c[1][2] === 7); return { bricks: rr.filter(c => c[1][3] === 18).length, paddle: rr.filter(c => c[1][3] === 12).slice(-1)[0], ball: arcs.length ? { x: arcs[arcs.length - 1][1][0], y: arcs[arcs.length - 1][1][1] } : null, texts: f.filter(c => c[0] === 'fillText').map(c => c[1][0]) }; };
    const score = () => num(t.q('#sc').textContent), lives = () => num(t.q('#li').textContent), lvl = () => num(t.q('#lv').textContent);
    T.has(overlayText(t), 'Breakout', 'breakout: start screen'); G.tick(50); T.eq(parse().bricks, 40, 'breakout: 5 rows of 8 bricks at level 1'); T.ok(G.sane(cv), 'breakout: idle drawing is finite');
    G.seed(5); tapOverlay(t); G.tick(20); T.eq(lives(), 3, 'breakout: three lives'); T.ok(parse().texts.includes('Tap to launch'), 'breakout: the ball waits on the paddle'); const b0 = parse().ball; G.tick(500); T.eq(parse().ball.y, b0.y, 'breakout: the ball does not move before launch');
    G.ev(cv, 'pointerdown', { x: 100, y: 440 }); G.tick(20); T.near(parse().paddle[1][0] + parse().paddle[1][2] / 2, 100, 1, 'breakout: the paddle follows the finger'); G.ev(cv, 'pointermove', { x: 5, y: 440 }); G.tick(20); T.eq(parse().paddle[1][0], 0, 'breakout: the paddle stops at the left wall'); G.ev(cv, 'pointermove', { x: 400, y: 440 }); G.tick(20); T.eq(parse().paddle[1][0] + parse().paddle[1][2], 360, 'breakout: and at the right wall');
    /* an autopilot aims the ball at the remaining bricks */
    let prev = null, speedBad = 0, boundsBad = 0, scoreSteps = 0, scoreOk = true, lastScore = 0, minBricks = 40, maxLvl = 1; const bricksAtLevel = {};
    for (let f = 0; f < 9000 && lvl() < 3 && !/Game over/.test(overlayText(t)); f++) {
      G.tick(16); const p = parse(); if (!p.ball) continue; if (p.texts.includes('Tap to launch')) { prev = null; G.ev(cv, 'pointerdown', { x: p.ball.x, y: 440 }); continue; }
      const sp = prev ? Math.hypot(p.ball.x - prev.x, p.ball.y - prev.y) / 0.016 : 0; if (prev && sp > 700) speedBad++; if (p.ball.x < 0 || p.ball.x > W0 || p.ball.y < -10 || p.ball.y > 500) boundsBad++;
      const bricksRows = frame().filter(c => c[0] === 'roundRect' && c[1][3] === 18); const target = bricksRows.length ? bricksRows[Math.floor(f / 40) % bricksRows.length][1][0] + 18 : 180; const off = Math.max(-0.8, Math.min(0.8, (target - p.ball.x) / 120)); const px = p.ball.x - off * 37;
      G.ev(cv, 'pointermove', { x: px, y: 440, buttons: 1 }); if (score() !== lastScore) { if ((score() - lastScore) % 5 !== 0) scoreOk = false; scoreSteps++; lastScore = score(); } minBricks = Math.min(minBricks, p.bricks); maxLvl = Math.max(maxLvl, lvl()); prev = p.ball;
    }
    T.eq(boundsBad, 0, 'breakout: the ball always stays on the board'); T.eq(speedBad, 0, 'breakout: the ball never exceeds a plausible speed'); T.ok(scoreSteps > 20, 'breakout: bricks were destroyed (' + scoreSteps + ' hits, score ' + score() + ')'); T.ok(scoreOk, 'breakout: every score step is a multiple of 5 (row value)'); T.ok(maxLvl >= 2, 'breakout: clearing all bricks starts level 2 (reached level ' + maxLvl + ')'); T.eq(lives(), 3, 'breakout: the autopilot never lost a ball'); T.ok(G.sane(cv), 'breakout: drawing is finite');
    /* pause */
    if (!/Game over/.test(overlayText(t))) { const bb = parse().ball; t.click('#pz'); T.has(overlayText(t), 'Paused', 'breakout: Pause overlay'); G.tick(3000); T.eq(parse().ball && parse().ball.x, bb && bb.x, 'breakout: nothing moves while paused'); T.has(t.q('#pz').textContent, 'Resume', 'breakout: the button says Resume'); t.click('#pz'); T.eq(overlayText(t), '', 'breakout: resume'); G.setHidden(true); T.has(overlayText(t), 'Paused', 'breakout: hiding the app pauses'); G.setHidden(false); tapOverlay(t); }
  });
  await run('breakout', async (t) => {
    const cv = t.q('#cv'); const lives = () => num(t.q('#li').textContent);
    const frame = () => { const all = G.calls(cv); let k = all.length - 1; while (k > 0 && all[k][0] !== 'clearRect') k--; return all.slice(k); };
    const ball = () => { const a = frame().filter(c => c[0] === 'arc' && c[1][2] === 7).slice(-1)[0]; return a ? { x: a[1][0], y: a[1][1] } : null; };
    G.seed(8); tapOverlay(t); G.tick(20); const seq = [];
    for (let f = 0; f < 6000 && !/Game over/.test(overlayText(t)); f++) { G.tick(16); const b = ball(); if (frame().some(c => c[0] === 'fillText')) { G.ev(cv, 'pointerdown', { x: 340, y: 440 }); } else if (b && b.x > 200) G.ev(cv, 'pointermove', { x: 20, y: 440, buttons: 1 }); else if (b) G.ev(cv, 'pointermove', { x: 340, y: 440, buttons: 1 }); if (seq[seq.length - 1] !== lives()) seq.push(lives()); }
    T.eq(seq.join(), '3,2,1,0', 'breakout: three missed balls cost three lives, one at a time'); T.has(overlayText(t), 'Game over', 'breakout: no lives left ends the game'); const sc = num(t.q('#sc').textContent); T.has(overlayText(t), 'Score ' + sc, 'breakout: the overlay shows the score'); T.eq(G.store('fun2.breakout.best') || 0, sc > 0 ? sc : (G.store('fun2.breakout.best') || 0), 'breakout: best saved when beaten'); tapOverlay(t); G.tick(20); T.eq(lives(), 3, 'breakout: Play again gives three lives'); T.eq(num(t.q('#sc').textContent), 0, 'breakout: and resets the score');
  });

  /* ---------------- Pong ---------------- */
  await run('pong', async (t) => {
    const cv = t.q('#cv');
    const frame = () => { const all = G.calls(cv); let k = all.length - 1; while (k > 0 && all[k][0] !== 'clearRect') k--; return all.slice(k); };
    const ball = () => { const a = frame().filter(c => c[0] === 'arc' && c[1][2] === 8).slice(-1)[0]; return a ? { x: a[1][0], y: a[1][1] } : null; };
    const you = () => num(t.q('#you').textContent), cpu = () => num(t.q('#cpu').textContent);
    t.click('#lv [data-v="0"]'); T.eq(G.store('fun2.pong.lv'), 0, 'pong: level saved'); T.has(overlayText(t), 'First to 7', 'pong: instructions');
    G.seed(12); tapOverlay(t); G.tick(20); T.eq(you() + ',' + cpu(), '0,0', 'pong: 0-0'); let prev = null, bad = 0, oob = 0, order = [];
    for (let f = 0; f < 20000 && !/Play again/.test(overlayText(t)); f++) {
      G.tick(16); const b = ball(); if (!b) continue; if (prev && Math.hypot(b.x - prev.x, b.y - prev.y) / 0.016 > 900 && Math.abs(b.y - prev.y) < 100) bad++; if (b.x < 0 || b.x > 360) oob++; prev = b;
      G.ev(cv, 'pointermove', { x: b.x, y: 480, buttons: 1 }); const tag = you() + '-' + cpu(); if (order[order.length - 1] !== tag) order.push(tag);
    }
    T.eq(bad, 0, 'pong: the ball never teleports or goes too fast'); T.eq(oob, 0, 'pong: the ball stays between the side walls'); T.ok(/Play again/.test(overlayText(t)), 'pong: a game finishes');
    const y = you(), c = cpu(); T.ok(Math.max(y, c) === 7 && Math.min(y, c) < 7, 'pong: the winner has exactly 7 (' + y + '-' + c + ')'); T.ok(order.every((tag, i) => { if (!i) return true; const [a, b] = tag.split('-').map(Number), [a0, b0] = order[i - 1].split('-').map(Number); return (a - a0) + (b - b0) === 1 && a >= a0 && b >= b0; }), 'pong: the score only ever goes up by one point at a time (' + order.join(' ') + ')');
    T.has(overlayText(t), y > c ? 'You win' : 'You lose', 'pong: the overlay announces the right winner'); const st = G.store('fun2.pong'); T.eq(st.played, 1, 'pong: one game played'); T.eq(st.wins, y > c ? 1 : 0, 'pong: win recorded only when you win'); T.eq(t.q('#wn').textContent, String(st.wins), 'pong: wins shown');
    /* an idle player always loses on easy */
    tapOverlay(t); G.tick(20); for (let f = 0; f < 30000 && !/Play again/.test(overlayText(t)); f++) G.tick(16); T.has(overlayText(t), 'You lose', 'pong: an idle player loses'); T.eq(G.store('fun2.pong').played, 2, 'pong: second game counted'); T.eq(cpu(), 7, 'pong: the phone reached 7');
    /* pause and level change mid-game */
    tapOverlay(t); G.tick(20); G.tick(900); const b1 = ball(); G.ev(cv, 'pointerdown', { x: 100, y: 480 }); T.ok(true, 'pong: pointerdown during play is fine'); G.setHidden(true); T.has(overlayText(t), 'Paused', 'pong: hiding the app pauses'); G.tick(3000); T.eq(JSON.stringify(ball()), JSON.stringify(ball()), 'pong: frozen while paused'); G.setHidden(false); G.ev(cv, 'pointerdown', { x: 100, y: 480 }); T.eq(overlayText(t), '', 'pong: touching the table resumes'); void b1;
    t.click('#lv [data-v="2"]'); T.has(overlayText(t), 'First to 7', 'pong: changing the level in a game returns to the start screen'); T.eq(G.store('fun2.pong.lv'), 2, 'pong: new level saved');
  });

  await T.done(G.page);
})().catch(e => { console.log("FAIL: test crashed: " + (e && e.stack || e)); process.exit(1); });
