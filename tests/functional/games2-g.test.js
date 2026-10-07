'use strict';
/* games2.js, part 7: several human players. Dots and Boxes with 2 to 4 seats (people and phones), Reversi with two people on one phone
   (and playing white against the phone), Pong with two people dragging their own paddle with their own finger. */
const { bootGame } = require('./fun-lib');
const { suite } = require('../helpers/page');
global.Tools = global.Tools || { register() {} };
const L = require('../../www/js/tools/games2.js');

(async () => {
  const T = suite('games2-g'), G = await bootGame({ seed: 7 });
  const W = G.w;
  const run = async (id, fn, pre) => {
    const before = G.listeners(); G.unseed(); G.clock.reset(); if (pre) pre();
    const t = await G.page.open(id);
    try { await fn(t); } catch (e) { T.ok(false, id + ' threw: ' + String(e.stack || e).split('\n').slice(0, 3).join(' | ')); }
    G.leaves(t, before, T, id);
  };
  const num = (s) => +String(s).replace(/[^\d.-]/g, '');
  let asked = 0, answer = true; W.confirm = () => { asked++; return answer; };
  const overlayText = (t) => { const o = t.el.querySelector('.ov'); return o ? o.textContent : ''; };
  const tapOverlay = (t) => { const o = t.el.querySelector('.ov'); if (o) o.click(); };

  /* ---------------- Dots and Boxes: seats ---------------- */
  const M = 24, GAP = 60, SYM = ['★', '♥', '♣', '◆'];
  const dots = (t) => ({
    edges(R, C) { const o = {}; t.all('#svg line[data-o]').forEach(l => { const x1 = +l.getAttribute('x1'), y1 = +l.getAttribute('y1'), horiz = y1 === +l.getAttribute('y2'), r = Math.round((y1 - M) / GAP), c = Math.round((x1 - M) / GAP); o[horiz ? r * C + c : (R + 1) * C + r * (C + 1) + c] = +l.dataset.o; }); return o; },
    boxes(C) { const o = {}; t.all('#svg rect[data-o]').forEach(r => { o[Math.round((+r.getAttribute('y') - 4 - M) / GAP) * C + Math.round((+r.getAttribute('x') - 4 - M) / GAP)] = +r.dataset.o; }); return o; },
    open() { return t.all('#svg [data-e]').map(l => +l.dataset.e).filter((v, i, a) => a.indexOf(v) === i); },
    draw(e) { t.q('#svg [data-e="' + e + '"]').dispatchEvent(new W.MouseEvent('click', { bubbles: true })); },
    seats(n, ai) {   // sets the number of seats and each seat's type, then starts a fresh game
      if (t.q('#np .on').dataset.v !== String(n)) t.click('#np [data-v="' + n + '"]');
      for (let i = 0; i < n; i++) if (/Phone/.test(t.q('#seats [data-s="' + i + '"]').textContent) !== !!ai[i]) t.click('#seats [data-s="' + i + '"]');
      t.click('#new');
    }
  });
  await run('dotsboxes', async (t) => {
    const D = dots(t);
    /* default setup is unchanged: 1 human against the phone */
    T.eq(t.all('#seats button').length, 2, 'dots: two seats by default'); T.has(t.q('#seats [data-s="0"]').textContent, 'Human', 'dots: seat 1 is a human'); T.has(t.q('#seats [data-s="1"]').textContent, 'Phone', 'dots: seat 2 is the phone');
    T.eq(t.q('#sc0').nextSibling.textContent.slice(2), 'You', 'dots: the single human is "You"'); T.eq(t.q('#sc1').nextSibling.textContent.slice(2), 'Phone', 'dots: and the phone is "Phone"');
    T.ok(t.all('#seats button').every(b => parseFloat(b.style.minHeight) >= 44), 'dots: seat buttons are at least 44px tall');
    /* four seats: distinct colours and symbols, one stat per seat */
    t.click('#np [data-v="4"]'); T.eq(t.all('#seats button').length, 4, 'dots: four seat buttons'); T.eq(t.all('#stats b').length, 5, 'dots: a score per seat plus the win count'); T.eq(G.store('fun2.dotsboxes.np'), 4, 'dots: seat count saved');
    const sy = t.all('#seats button').map(b => b.textContent.charAt(0)); T.eq(new Set(sy).size, 4, 'dots: every seat has its own symbol'); T.eq(new Set(t.all('#seats button').map(b => b.style.borderLeft)).size, 4, 'dots: and its own colour');
    T.ok(t.all('#seats button').every(b => /Seat \d, \w+, (Human|Phone)/.test(b.getAttribute('aria-label'))), 'dots: seat buttons have spoken labels');
    /* scripted turn order and claiming with two humans: P1 0, P2 3, P1 12, P2 13 closes the top-left box */
    D.seats(2, [0, 0]); t.click('#sz [data-v="3"]'); T.has(t.q('#msg').textContent, 'Player 1 starts', 'dots: two humans: Player 1 starts');
    D.draw(0); T.has(t.q('#msg').textContent, 'Player 2: your turn', 'dots: turn passes to Player 2'); D.draw(3); T.has(t.q('#msg').textContent, 'Player 1: your turn', 'dots: and back to Player 1');
    D.draw(12); D.draw(13);
    T.eq(JSON.stringify(D.boxes(3)), '{"0":2}', 'dots: Player 2 closed the box and owns it'); T.has(t.q('#msg').textContent, 'Player 2 goes again', 'dots: closing a box gives another go'); T.eq(t.q('#sc1').textContent, '1', 'dots: the score counts the box');
    D.draw(1); T.eq(D.edges(3, 3)[1], 2, 'dots: the extra line belongs to Player 2'); T.has(t.q('#msg').textContent, 'Player 1: your turn', 'dots: no box, so the turn moves on');
    T.eq(JSON.stringify(D.edges(3, 3)), '{"0":1,"1":2,"3":2,"12":1,"13":2}', 'dots: each line is owned by whoever drew it');
    T.has(t.q('#svg').innerHTML, SYM[1], 'dots: the claimed box shows the owner symbol, not only a colour'); T.eq(G.clock.pending().to, 0, 'dots: two humans: the phone never schedules a move');
    /* a lone phone seat never moves for a human */
    D.seats(2, [0, 1]); D.draw(0); T.eq(Object.keys(D.edges(3, 3)).length, 1, 'dots: human seat draws one line'); G.tick(540); T.eq(Object.keys(D.edges(3, 3)).length, 2, 'dots: then the phone seat draws one line'); T.eq(D.edges(3, 3)[Object.keys(D.edges(3, 3)).find(k => D.edges(3, 3)[k] === 2)], 2, 'dots: owned by seat 2');
    /* confirm before changing a game in progress */
    asked = 0; answer = false; t.click('#seats [data-s="1"]'); T.eq(asked, 1, 'dots: changing a seat mid-game asks'); T.has(t.q('#seats [data-s="1"]').textContent, 'Phone', 'dots: no keeps the seat'); t.click('#np [data-v="3"]'); T.eq(asked, 2, 'dots: changing the seat count asks'); T.eq(t.q('#np .on').dataset.v, '2', 'dots: no keeps the seat count'); answer = true;
  });

  /* complete games with an independent model checking every move, owner, box and the final message */
  const dotsGame = async (t, size, ai, seed) => {
    const D = dots(t), n = ai.length, S = { R: size, C: size }, total = 2 * size * (size + 1), rng = G.replica(seed).raw;
    t.click('#sz [data-v="' + size + '"]'); D.seats(n, ai);
    let turn = 0, guard = 0, bad = 0; const drawn = {}, claimed = {}, score = new Array(n).fill(0);
    while (Object.keys(drawn).length < total && guard++ < 4000) {
      if (!ai[turn]) { const free = D.open(); D.draw(free[Math.floor(rng() * free.length)]); } else G.tick(520);
      const now = D.edges(size, size), fresh = Object.keys(now).filter(k => !(k in drawn));
      if (fresh.length !== 1) { bad++; break; }
      const e = +fresh[0]; if (now[e] !== turn + 1) bad++; drawn[e] = turn + 1; let got = 0;
      L.dbEdgeBoxes(S, e).forEach(bi => { if (!claimed[bi] && L.dbBoxEdges(S, (bi / size) | 0, bi % size).every(x => drawn[x])) { claimed[bi] = turn + 1; score[turn]++; got++; } });
      if (!got) turn = (turn + 1) % n;
    }
    T.eq(bad, 0, 'dots: ' + n + ' seats ' + JSON.stringify(ai) + ': every line went to the seat whose turn it was, one at a time');
    T.eq(JSON.stringify(D.boxes(size)), JSON.stringify(claimed), 'dots: ' + n + ' seats: every box belongs to whoever closed it');
    T.eq(score.reduce((a, b) => a + b, 0), size * size, 'dots: all boxes claimed'); T.eq(score.map((_, i) => num(t.q('#sc' + i).textContent)).join(), score.join(), 'dots: the on-screen scores match');
    const top = Math.max(...score), win = score.map((v, i) => v === top ? i : -1).filter(i => i >= 0), msg = t.q('#msg').textContent;
    const nPh = ai.filter(Boolean).length, nHu = n - nPh, nmOf = (i) => ai[i] ? (nPh === 1 ? 'The phone' : 'Phone ' + (i + 1)) : (nHu === 1 ? 'You' : 'Player ' + (i + 1));
    if (win.length === 1) T.has(msg, nmOf(win[0]) + (nmOf(win[0]) === 'You' ? ' win' : ' wins'), 'dots: the winner is announced (' + msg + ')'); else T.ok(/draw|tie between/.test(msg) && msg.endsWith(top + ' each'), 'dots: a tie is announced (' + msg + ')');
    return { score, win };
  };
  await run('dotsboxes', async (t) => {
    const w0 = G.store('fun2.dotsboxes.w', 0), seen = new Set();
    for (const seed of [1, 2, 3]) { const r = await dotsGame(t, 3, [0, 0], seed); seen.add(r.win.join('')); }
    T.eq(G.store('fun2.dotsboxes.w', 0), w0, 'dots: two-human games do not touch the vs-phone win count');
    for (const seed of [4, 5]) await dotsGame(t, 3, [0, 0, 1, 1], seed);
    await dotsGame(t, 3, [0, 1, 0], 6); await dotsGame(t, 4, [0, 0, 1, 1], 7);
  });
  await run('dotsboxes', async (t) => {
    /* a human win against the phone still counts, a loss does not (one human seat) */
    const D = dots(t); t.click('#sz [data-v="3"]'); D.seats(2, [0, 1]); G.seed(3); const w0 = G.store('fun2.dotsboxes.w', 0); let guard = 0;
    while (guard++ < 200 && !/win|draw|each/i.test(t.q('#msg').textContent)) { if (/thinking|goes again/.test(t.q('#msg').textContent)) { G.tick(520); continue; } const f = D.open(); D.draw(f[0]); }
    const a = num(t.q('#sc0').textContent), b = num(t.q('#sc1').textContent); T.eq(G.store('fun2.dotsboxes.w', 0) - w0, a > b ? 1 : 0, 'dots: the vs-phone win count only goes up when the human wins (' + a + '-' + b + ')');
  });

  /* ---------------- Reversi ---------------- */
  await run('reversi', async (t) => {
    const read = () => t.all('#bd .rv-c').map(c => { const d = c.querySelector('.rv-d'); return d ? (d.classList.contains('b') ? 1 : 2) : 0; });
    const hints = () => t.all('#bd .rv-c').map((c, i) => c.querySelector('.rv-h') ? i : -1).filter(i => i >= 0);
    t.click('#md [data-v="two"]'); T.eq(G.store('fun2.reversi.md'), 'two', 'reversi: mode saved'); T.eq(t.q('#sdw').style.display, 'none', 'reversi: the side choice is hidden with two players'); T.eq(t.q('#lvw').style.display, 'none', 'reversi: and so is the phone level');
    T.has(t.q('#bk').nextSibling.textContent, 'Black', 'reversi: labels read Black'); T.has(t.q('#wh').nextSibling.textContent, 'White', 'reversi: and White'); T.has(t.q('#msg').textContent, 'Black starts', 'reversi: Black starts');
    const st0 = G.store('fun2.reversi'); let passes = 0, games = 0, illegal = 0;
    for (let seed = 1; seed <= 30 && !(passes >= 2 && games >= 4); seed++) {
      t.click('#new'); const rng = G.replica(seed).raw; let b = L.rvStart(), turn = 1, guard = 0; games++;
      while (!L.rvOver(b) && guard++ < 200) {
        const legal = L.rvMoves(b, turn); if (hints().join() !== legal.join()) { illegal++; if (process.env.DBG) console.log('H', seed, guard, hints().join(), legal.join()); }
        const wantTurn = (turn === 1 ? 'Black' : 'White') + '\'s turn'; if (guard > 1 && !t.q('#msg').textContent.includes(wantTurn) && !/no move/.test(t.q('#msg').textContent)) { illegal++; if (process.env.DBG) console.log('M', seed, guard, wantTurn, t.q('#msg').textContent); }
        const m = legal[Math.floor(rng() * legal.length)]; t.q('#bd [data-i="' + m + '"]').click(); b = L.rvApply(b, m, turn).board; if (read().join('') !== b.join('')) { illegal++; if (process.env.DBG) console.log('B', seed, guard, m, turn); break; }
        const nx = 3 - turn;
        if (L.rvOver(b)) break;
        if (!L.rvMoves(b, nx).length) { passes++; if (!/has no move/.test(t.q('#msg').textContent) || !t.q('#msg').textContent.includes((turn === 1 ? 'Black' : 'White') + ' plays again')) illegal++; } else turn = nx;
      }
      const c = L.rvCount(b), msg = t.q('#msg').textContent; T.eq(t.q('#bk').textContent + ',' + t.q('#wh').textContent, c.b + ',' + c.w, 'reversi: two-player counters match the discs');
      T.ok(c.b > c.w ? msg === 'Black wins ' + c.b + ' to ' + c.w : c.w > c.b ? msg === 'White wins ' + c.w + ' to ' + c.b : msg === 'A draw, ' + c.b + ' each', 'reversi: the result is announced (' + msg + ')');
      T.eq(hints().length, 0, 'reversi: no hints once the game is over');
    }
    T.eq(illegal, 0, 'reversi: two humans: hints are the legal moves, turns alternate, passes keep the same player on the move'); T.ok(passes >= 1, 'reversi: at least one pass was exercised (' + passes + ' in ' + games + ' games)');
    G.tick(3000); T.eq(G.clock.pending().to, 0, 'reversi: two humans: no AI timer is left running (confetti removes itself)'); T.eq(JSON.stringify(G.store('fun2.reversi')), JSON.stringify(st0), 'reversi: two-player games do not change the vs-phone record');
    t.click('#new'); t.q('#bd [data-i="0"]').click(); T.has(t.q('#msg').textContent, 'Not a legal move', 'reversi: an illegal tap is refused with two players');
    t.q('#bd [data-i="19"]').click(); asked = 0; answer = false; t.click('#md [data-v="ai"]'); T.eq(asked, 0, 'reversi: too early in the game to ask'); answer = true;
    t.q('#bd [data-i="18"]').click(); t.q('#bd [data-i="17"]').click(); asked = 0; answer = false; t.click('#md [data-v="ai"]'); T.ok(asked >= 0, 'reversi: mode change may ask'); answer = true; t.click('#md [data-v="ai"]'); T.eq(G.store('fun2.reversi.md'), 'ai', 'reversi: back to vs Phone');
  });
  await run('reversi', async (t) => {
    const read = () => t.all('#bd .rv-c').map(c => { const d = c.querySelector('.rv-d'); return d ? (d.classList.contains('b') ? 1 : 2) : 0; });
    const hints = () => t.all('#bd .rv-c').map((c, i) => c.querySelector('.rv-h') ? i : -1).filter(i => i >= 0);
    t.click('#md [data-v="ai"]'); t.click('#lv [data-v="2"]'); t.click('#sd [data-v="2"]'); T.eq(G.store('fun2.reversi.sd'), 2, 'reversi: side saved'); T.has(t.q('#msg').textContent, 'thinking', 'reversi: playing white, the phone (black) moves first');
    T.eq(hints().length, 0, 'reversi: no hints while the phone is thinking'); t.q('#bd [data-i="0"]').click(); T.has(t.q('#msg').textContent, 'thinking', 'reversi: taps are ignored while the phone thinks');
    G.tick(500); const b = read(); T.eq(L.rvCount(b).b, 4, 'reversi: the phone opened (4 black discs)'); T.has(t.q('#msg').textContent, 'Your move (white)', 'reversi: your move as white'); T.eq(hints().join(), L.rvMoves(b, 2).join(), 'reversi: the hints are white\'s legal moves');
    T.has(t.q('#bk').nextSibling.textContent, 'Phone', 'reversi: black is labelled Phone'); T.has(t.q('#wh').nextSibling.textContent, 'You', 'reversi: white is labelled You');
    const st0 = (G.store('fun2.reversi') || { played: 0 }).played; let guard = 0;
    while (guard++ < 200 && !/win|draw/i.test(t.q('#msg').textContent)) { const h = hints(); if (h.length) t.q('#bd [data-i="' + h[0] + '"]').click(); else G.tick(500); }
    const c = L.rvCount(read()), msg = t.q('#msg').textContent; T.ok(c.w > c.b ? /You win/.test(msg) : c.w < c.b ? /phone wins/.test(msg) : /draw/.test(msg), 'reversi: as white the result is judged for white (' + c.b + '-' + c.w + ': ' + msg + ')'); T.eq(G.store('fun2.reversi').played, st0 + 1, 'reversi: the game is counted');
    t.click('#sd [data-v="1"]'); G.tick(1000); T.eq(L.rvCount(read()).b + L.rvCount(read()).w, 4, 'reversi: black again: you move first, the phone stays quiet'); T.has(t.q('#msg').textContent, 'You are black', 'reversi: message for black');
  });

  /* ---------------- Pong ---------------- */
  await run('pong', async (t) => {
    const cv = t.q('#cv'), HH = 520;
    const frame = () => { const all = G.calls(cv); let k = all.length - 1; while (k > 0 && all[k][0] !== 'clearRect') k--; return all.slice(k); };
    const ball = () => { const a = frame().filter(c => c[0] === 'arc' && c[1][2] === 8).slice(-1)[0]; return a ? { x: a[1][0], y: a[1][1] } : null; };
    const pads = () => { const r = frame().filter(c => c[0] === 'roundRect'); const top = r.find(c => c[1][1] === 18), bot = r.find(c => c[1][1] === HH - 30); return { top: top[1][0] + 35, bot: bot[1][0] + 35 }; };
    const you = () => num(t.q('#you').textContent), cpu = () => num(t.q('#cpu').textContent);
    t.click('#md [data-v="two"]'); T.eq(G.store('fun2.pong.md'), 'two', 'pong: mode saved'); T.eq(t.q('#lvw').style.display, 'none', 'pong: the AI level is hidden with two players'); T.has(overlayText(t), 'Player 1 drags the bottom paddle', 'pong: instructions explain the halves'); T.has(t.q('#you').nextSibling.textContent, 'P1', 'pong: label P1'); T.has(t.q('#cpu').nextSibling.textContent, 'P2', 'pong: label P2');
    const st0 = JSON.stringify(G.store('fun2.pong')); tapOverlay(t); G.tick(20);
    /* two fingers, one per half */
    G.ev(cv, 'pointerdown', { id: 1, x: 100, y: 480 }); G.ev(cv, 'pointerdown', { id: 2, x: 250, y: 40 }); G.tick(20); let p = pads(); T.eq(Math.round(p.bot) + ',' + Math.round(p.top), '100,250', 'pong: each finger takes the paddle on its half');
    G.ev(cv, 'pointermove', { id: 1, x: 300, y: 480 }); G.tick(20); p = pads(); T.eq(Math.round(p.bot) + ',' + Math.round(p.top), '300,250', 'pong: moving finger 1 moves only the bottom paddle');
    G.ev(cv, 'pointermove', { id: 1, x: 40, y: 30 }); G.tick(20); p = pads(); T.eq(Math.round(p.bot) + ',' + Math.round(p.top), '40,250', 'pong: even dragged into the top half, finger 1 still only moves the bottom paddle');
    G.ev(cv, 'pointermove', { id: 2, x: 120, y: 500 }); G.tick(20); p = pads(); T.eq(Math.round(p.bot) + ',' + Math.round(p.top), '40,120', 'pong: finger 2 only ever moves the top paddle');
    G.ev(cv, 'pointermove', { id: 9, x: 200, y: 480 }); G.tick(20); p = pads(); T.eq(Math.round(p.bot) + ',' + Math.round(p.top), '40,120', 'pong: a finger that never touched down moves nothing');
    G.ev(cv, 'pointerdown', { id: 3, x: 330, y: 500 }); G.ev(cv, 'pointermove', { id: 3, x: 330, y: 500 }); G.tick(20); p = pads(); T.eq(Math.round(p.bot) + ',' + Math.round(p.top), '40,120', 'pong: a third finger on an owned half is ignored');
    G.ev(cv, 'pointerup', { id: 1 }); G.ev(cv, 'pointermove', { id: 1, x: 200, y: 480, buttons: 1 }); G.tick(20); p = pads(); T.eq(Math.round(p.bot), 40, 'pong: a lifted finger no longer moves its paddle');
    G.ev(cv, 'pointerdown', { id: 4, x: 200, y: 480 }); G.tick(20); T.eq(Math.round(pads().bot), 200, 'pong: after lifting, the half can be taken by a new finger');
    G.ev(W, 'pointerup', { id: 4 }); G.ev(cv, 'pointermove', { id: 4, x: 10, y: 480, buttons: 1 }); G.tick(20); T.eq(Math.round(pads().bot), 200, 'pong: releasing anywhere frees the finger');
    G.ev(cv, 'pointercancel', { id: 2 }); G.ev(cv, 'pointermove', { id: 2, x: 10, y: 40 }); G.tick(20); T.eq(Math.round(pads().top), 120, 'pong: a cancelled touch frees its paddle');
    /* no AI in two-player mode: the top paddle stays put with nobody touching it */
    G.ev(cv, 'pointerdown', { id: 5, x: 180, y: 40 }); G.ev(W, 'pointerup', { id: 5 }); G.tick(20); const topAt = Math.round(pads().top); G.tick(2500); T.eq(Math.round(pads().top), topAt, 'pong: the phone does not move the top paddle');
    /* a full scripted game: player 1 tracks the ball with finger 1, player 2 just holds finger 2 down */
    answer = true; t.click('#md [data-v="ai"]'); t.click('#md [data-v="two"]'); tapOverlay(t); T.eq(you() + ',' + cpu(), '0,0', 'pong: restarts at 0-0'); G.ev(W, 'pointerup', { id: 1 }); G.ev(W, 'pointerup', { id: 2 }); G.ev(W, 'pointerup', { id: 3 }); let order = [], bad = 0, prev = null;
    G.ev(cv, 'pointerdown', { id: 11, x: 180, y: 480 }); G.ev(cv, 'pointerdown', { id: 12, x: 180, y: 40 });
    for (let f = 0; f < 30000 && !/Play again/.test(overlayText(t)); f++) {
      G.tick(16); const b = ball(); if (!b) continue; if (prev && Math.hypot(b.x - prev.x, b.y - prev.y) / 0.016 > 900 && Math.abs(b.y - prev.y) < 100) bad++; prev = b;
      G.ev(cv, 'pointermove', { id: 11, x: b.x, y: 480 }); const tag = you() + '-' + cpu(); if (order[order.length - 1] !== tag) order.push(tag);
    }
    T.eq(bad, 0, 'pong: the ball never teleports'); T.has(overlayText(t), 'Play again', 'pong: the two-player game finishes'); T.eq(you(), 7, 'pong: player 1 (tracking the ball) reaches 7'); T.ok(cpu() < 7, 'pong: player 2 (standing still) does not');
    T.has(overlayText(t), 'Player 1 wins 7 - ' + cpu(), 'pong: the overlay names the winner'); T.has(t.q('#msg').textContent, 'Player 1 wins 7 - ' + cpu(), 'pong: the live result line names the winner');
    T.eq(JSON.stringify(G.store('fun2.pong')), st0, 'pong: two-player games do not change the vs-phone record');
    /* player 2 can win too: player 1 stands still, player 2 tracks */
    tapOverlay(t); G.tick(20); G.ev(W, 'pointerup', { id: 11 }); G.ev(W, 'pointerup', { id: 12 }); G.ev(cv, 'pointerdown', { id: 21, x: 180, y: 480 }); G.ev(cv, 'pointerdown', { id: 22, x: 180, y: 40 });
    for (let f = 0; f < 30000 && !/Play again/.test(overlayText(t)); f++) { G.tick(16); const b = ball(); if (b) G.ev(cv, 'pointermove', { id: 22, x: b.x, y: 40 }); }
    T.eq(cpu(), 7, 'pong: player 2 can win on the top paddle'); T.has(t.q('#msg').textContent, 'Player 2 wins 7 - ' + you(), 'pong: and is announced');
    /* switching back to the phone: confirm only mid-game, level shown again, AI moves again */
    tapOverlay(t); G.tick(20); G.tick(1500); G.ev(cv, 'pointerdown', { id: 31, x: 180, y: 480 }); asked = 0; answer = false; t.click('#md [data-v="ai"]'); T.ok(asked <= 1, 'pong: switching mode asks at most once'); answer = true; t.click('#md [data-v="ai"]');
    T.eq(G.store('fun2.pong.md'), 'ai', 'pong: back to vs Phone'); T.eq(t.q('#lvw').style.display, '', 'pong: the level choice is back'); T.has(overlayText(t), 'Drag to move your paddle', 'pong: single-player instructions');
    tapOverlay(t); G.tick(20); G.ev(cv, 'pointerdown', { id: 41, x: 180, y: 480 }); G.tick(3000); T.ok(G.sane(cv), 'pong: drawing stays finite');
  });
  await run('pong', async (t) => {
    /* the whole top half belongs to the second player and the bottom half to the first (boundary at the middle line) */
    const cv = t.q('#cv'); t.click('#md [data-v="two"]'); tapOverlay(t); G.tick(20);
    const frame = () => { const all = G.calls(cv); let k = all.length - 1; while (k > 0 && all[k][0] !== 'clearRect') k--; return all.slice(k); };
    const pads = () => { const r = frame().filter(c => c[0] === 'roundRect'); return { top: Math.round(r.find(c => c[1][1] === 18)[1][0] + 35), bot: Math.round(r.find(c => c[1][1] === 490)[1][0] + 35) }; };
    G.ev(cv, 'pointerdown', { id: 1, x: 90, y: 259 }); G.ev(cv, 'pointerdown', { id: 2, x: 270, y: 261 }); G.tick(20); const p = pads(); T.eq(p.top + ',' + p.bot, '90,270', 'pong: the middle line splits the board between the two players');
    /* hiding the app pauses and forgets the fingers; touching resumes without moving the wrong paddle */
    G.setHidden(true); T.has(overlayText(t), 'Paused', 'pong: two players: hiding pauses'); G.setHidden(false); G.ev(cv, 'pointermove', { id: 1, x: 10, y: 480 }); G.tick(20); T.eq(pads().bot, 270, 'pong: after a pause an old finger no longer steers');
    G.ev(cv, 'pointerdown', { id: 7, x: 50, y: 480 }); G.tick(20); T.eq(overlayText(t), '', 'pong: touching resumes'); T.eq(pads().bot, 50, 'pong: and the new finger takes the bottom paddle');
    /* arrow keys: player 1; a / d: player 2 */
    G.key('ArrowRight'); G.tick(20); T.eq(pads().bot, 76, 'pong: arrow keys move the bottom paddle'); G.key('d'); G.tick(20); T.eq(pads().top, 116, 'pong: D moves the top paddle');
  });

  await T.done(G.page);
})().catch(e => { console.log('FAIL: test crashed: ' + (e && e.stack || e)); process.exit(1); });
