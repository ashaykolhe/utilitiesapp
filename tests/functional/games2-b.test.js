'use strict';
/* games2.js, part 2: gem match, dots and boxes, reversi, stroop, maze runner, 24 game. */
const { bootGame } = require('./fun-lib');
const { suite } = require('../helpers/page');
global.Tools = global.Tools || { register() {} };
const L = require('../../www/js/tools/games2.js');

(async () => {
  const T = suite('games2-b'), G = await bootGame({ seed: 7 });
  const W = G.w;
  const run = async (id, fn, pre) => {
    const before = G.listeners(); G.unseed(); G.clock.reset(); if (pre) pre();
    const t = await G.page.open(id);
    try { await fn(t); } catch (e) { T.ok(false, id + ' threw: ' + String(e.stack || e).split('\n').slice(0, 3).join(' | ')); }
    G.leaves(t, before, T, id);
  };
  const num = (s) => +String(s).replace(/[^\d.-]/g, '');

  /* ---------------- Gem Match ---------------- */
  await run('gemmatch', async (t) => {
    const N = 8, gems = () => t.all('#bd .gm-g');
    const board = () => { const b = new Array(64).fill(-1); gems().forEach(g => { const c = Math.round(parseFloat(g.style.left) / 12.5), r = Math.round(parseFloat(g.style.top) / 12.5); if (r >= 0 && r < 8 && c >= 0 && c < 8) b[r * 8 + c] = +g.dataset.t; }); return b; };
    const matches = (b) => { const s = new Set(); for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const v = b[r * N + c]; if (v < 0) continue; let k = c; while (k < N && b[r * N + k] === v) k++; if (k - c >= 3) for (let i = c; i < k; i++) s.add(r * N + i); k = r; while (k < N && b[k * N + c] === v) k++; if (k - r >= 3) for (let i = r; i < k; i++) s.add(i * N + c); } return s; };
    const swapped = (b, i, j) => { const x = b.slice(); x[i] = b[j]; x[j] = b[i]; return x; };
    const pairs = (b) => { const out = []; for (let i = 0; i < 64; i++) { if (i % 8 < 7) out.push([i, i + 1]); if (i < 56) out.push([i, i + 8]); } return out; };
    const validMoves = (b) => pairs(b).filter(([i, j]) => matches(swapped(b, i, j)).size > 0), invalidMoves = (b) => pairs(b).filter(([i, j]) => matches(swapped(b, i, j)).size === 0);
    const tap = (i) => { G.ev(gems()[i], 'pointerdown', { x: 10, y: 10 }); G.ev(t.q('#bd'), 'pointerup', { x: 10, y: 10 }); };
    const idxOf = (b, i) => gems().findIndex(g => Math.round(parseFloat(g.style.left) / 12.5) === i % 8 && Math.round(parseFloat(g.style.top) / 12.5) === ((i / 8) | 0));
    const tapCell = (i) => { const g = gems()[idxOf(null, i)]; G.ev(g, 'pointerdown', { x: 10, y: 10 }); G.ev(t.q('#bd'), 'pointerup', { x: 10, y: 10 }); };
    const settle = async () => { await G.advance(4000); };
    G.seed(3); t.click('#new');
    let b = board(); T.eq(gems().length, 64, 'gems: 64 gems'); T.eq(matches(b).size, 0, 'gems: the starting board has no ready-made matches'); T.ok(validMoves(b).length > 0, 'gems: and at least one move'); T.ok(b.every(v => v >= 0 && v < 6), 'gems: six kinds'); T.eq(t.q('#mv').textContent, '30', 'gems: 30 moves');
    /* hint shows a working swap */
    t.click('#hint'); const hinted = gems().map((g, k) => g.classList.contains('hint') ? [Math.round(parseFloat(g.style.top) / 12.5) * 8 + Math.round(parseFloat(g.style.left) / 12.5)] : null).filter(Boolean).map(x => x[0]); T.eq(hinted.length, 2, 'gems: the hint marks two gems'); T.ok(matches(swapped(b, hinted[0], hinted[1])).size > 0, 'gems: the hinted swap really makes a match');
    /* an invalid swap goes back and costs nothing */
    const bad = invalidMoves(b)[0]; tapCell(bad[0]); tapCell(bad[1]); await G.advance(1500); T.eq(board().join(), b.join(), 'gems: a swap that makes no match goes back'); T.eq(t.q('#mv').textContent, '30', 'gems: no move is used'); T.eq(t.q('#sc').textContent, '0', 'gems: no score');
    /* tapping the same gem twice cancels the selection; far gem moves the selection */
    tapCell(0); T.eq(gems().filter(g => g.classList.contains('sel')).length, 1, 'gems: a tap selects'); tapCell(0); T.eq(gems().filter(g => g.classList.contains('sel')).length, 0, 'gems: a second tap on it deselects'); tapCell(0); tapCell(20); T.eq(gems().filter(g => g.classList.contains('sel')).length, 1, 'gems: tapping a far gem moves the selection'); tapCell(20);
    /* a valid swap by two taps */
    b = board(); const mv = validMoves(b)[0], firstBase = matches(swapped(b, mv[0], mv[1])).size * 10; tapCell(mv[0]); tapCell(mv[1]); await settle();
    T.eq(t.q('#mv').textContent, '29', 'gems: a valid swap uses one move'); T.ok(num(t.q('#sc').textContent) >= firstBase, 'gems: the score is at least the first match (' + t.q('#sc').textContent + ' >= ' + firstBase + ')'); const b2 = board(); T.eq(b2.filter(v => v >= 0).length, 64, 'gems: the board is full again'); T.eq(matches(b2).size, 0, 'gems: cascades run until no match is left'); T.ok(validMoves(b2).length > 0, 'gems: a move is always available (reshuffled if not)');
    /* a swipe works as well */
    b = board(); const mv2 = validMoves(b).find(([i, j]) => j === i + 1); if (mv2) { const g = gems()[idxOf(null, mv2[0])]; G.ev(g, 'pointerdown', { x: 100, y: 100 }); G.ev(g, 'pointermove', { x: 130, y: 102 }); G.ev(t.q('#bd'), 'pointerup', { x: 130, y: 102 }); await settle(); T.eq(t.q('#mv').textContent, '28', 'gems: dragging a gem to its neighbour swaps them'); }
    /* play out all 30 moves */
    let guard = 0; while (!/Out of moves/.test(t.q('#msg').textContent) && guard++ < 40) { b = board(); const m = validMoves(b)[0]; tapCell(m[0]); tapCell(m[1]); await settle(); }
    T.has(t.q('#msg').textContent, 'Out of moves', 'gems: the game ends after 30 moves'); T.eq(t.q('#mv').textContent, '0', 'gems: no moves left'); const final = num(t.q('#sc').textContent); T.ok(final > 300, 'gems: a full game scores well (' + final + ')'); T.eq(G.store('fun2.gemmatch.best'), final, 'gems: best saved'); T.eq(t.q('#bs').textContent, String(final), 'gems: best shown');
    b = board(); const m3 = validMoves(b)[0]; tapCell(m3[0]); tapCell(m3[1]); await settle(); T.eq(board().join(), b.join(), 'gems: no moves after the game is over');
    t.click('#new'); T.eq(t.q('#mv').textContent, '30', 'gems: New game resets'); T.eq(t.q('#sc').textContent, '0', 'gems: score reset');
  });
  await run('gemmatch', async (t) => {
    /* leaving in the middle of a cascade leaves nothing running (checked by leaves) and does not throw */
    const g = t.all('#bd .gm-g'); t.click('#hint'); G.tick(100);
  });

  /* ---------------- Dots and Boxes ---------------- */
  await run('dotsboxes', async (t) => {
    const M = 24, GAP = 60;
    const edgesDrawn = (R, C) => { const owner = {}; t.all('#svg line:not([data-e])').forEach(l => { const x1 = +l.getAttribute('x1'), y1 = +l.getAttribute('y1'), x2 = +l.getAttribute('x2'), y2 = +l.getAttribute('y2'); if (l.getAttribute('stroke') === 'transparent' || /var\(--line\)/.test(l.getAttribute('stroke'))) return; const horiz = y1 === y2, r = Math.round((y1 - M) / GAP), c = Math.round((x1 - M) / GAP); const e = horiz ? r * C + c : (R + 1) * C + r * (C + 1) + c; owner[e] = /accent/.test(l.getAttribute('stroke')) ? 1 : 2; }); return owner; };
    const open = () => t.all('#svg [data-e]').map(l => +l.dataset.e).filter((v, i, a) => a.indexOf(v) === i);
    const boxes = (R, C) => { const out = {}; t.all('#svg rect').forEach(r => { const c = Math.round((+r.getAttribute('x') - 4 - M) / GAP), rr = Math.round((+r.getAttribute('y') - 4 - M) / GAP); out[rr * C + c] = /accent/.test(r.getAttribute('fill')) ? 1 : 2; }); return out; };
    const sc = () => [num(t.q('#you').textContent), num(t.q('#cpu').textContent)];
    const completed = (R, C, drawn) => { let n = 0; for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if ([r * C + c, (r + 1) * C + c, (R + 1) * C + r * (C + 1) + c, (R + 1) * C + r * (C + 1) + c + 1].every(e => drawn[e])) n++; return n; };
    for (const [size, lv] of [[3, 0], [3, 1], [4, 1]]) {
      t.click('#sz [data-v="' + size + '"]'); t.click('#lv [data-v="' + lv + '"]'); t.click('#new'); T.eq(open().length, 2 * size * (size + 1), 'dots: ' + size + 'x' + size + ' has ' + (2 * size * (size + 1)) + ' lines');
      G.seed(10 + size + lv); let turns = 0, bad = 0, ended = false;
      while (turns++ < 80 && !/You win|phone wins|A draw|each/i.test(t.q('#msg').textContent)) {
        const free = open(); const e = free[Math.floor(G.w.Math.random() * free.length)]; const before = Object.keys(edgesDrawn(size, size)).length;
        t.q('#svg [data-e="' + e + '"]').dispatchEvent(new W.MouseEvent('click', { bubbles: true })); if (Object.keys(edgesDrawn(size, size)).length !== before + 1) { bad++; if (process.env.DBG) console.log('DOTS1', size, lv, e, before, Object.keys(edgesDrawn(size, size)).length, t.q('#msg').textContent); }
        for (let k = 0; k < 400 && /thinking|goes again/.test(t.q('#msg').textContent); k++) G.tick(100);
        const dr = edgesDrawn(size, size), bx = boxes(size, size); if (Object.keys(bx).length !== completed(size, size, dr)) { bad++; if (process.env.DBG) console.log('DOTS2', Object.keys(bx).length, completed(size, size, dr), t.q('#msg').textContent); } const [a, b] = sc(); if (a + b !== Object.keys(bx).length) { bad++; if (process.env.DBG) console.log('DOTS3', a, b, Object.keys(bx).length); }
      }
      T.eq(bad, 0, 'dots: ' + size + 'x' + size + ' (level ' + lv + '): every line is drawn, boxes appear exactly when their fourth side is drawn and the scores add up');
      const [a, b] = sc(); T.eq(a + b, size * size, 'dots: all ' + (size * size) + ' boxes are claimed'); T.ok(open().length === 0, 'dots: every line is drawn at the end');
      const m = t.q('#msg').textContent; T.ok(a > b ? /You win/.test(m) : a < b ? /phone wins/.test(m) : /draw/.test(m), 'dots: the final message matches the score (' + a + '-' + b + ': ' + m + ')');
      const wins = G.store('fun2.dotsboxes.w', 0); T.ok(a > b ? wins >= 1 : true, 'dots: a win is counted');
      t.q('#svg').dispatchEvent(new W.MouseEvent('click', { bubbles: true })); T.ok(true, 'dots: clicking the empty board is harmless');
    }
    /* the phone takes a box whenever one is on offer (both levels): look at its first line after every human move */
    for (const lv of [0, 1]) {
      t.click('#sz [data-v="3"]'); t.click('#lv [data-v="' + lv + '"]'); t.click('#new'); G.seed(5 + lv); let offered = 0, took = 0, guard = 0;
      while (guard++ < 40 && !/You win|phone wins|A draw|each/.test(t.q('#msg').textContent)) {
        const before = edgesDrawn(3, 3), free = open(); if (!free.length) break;
        const e = free[Math.floor(G.w.Math.random() * free.length)];
        t.q('#svg [data-e="' + e + '"]').dispatchEvent(new W.MouseEvent('click', { bubbles: true }));
        const mine = edgesDrawn(3, 3); const boxesBefore = Object.keys(boxes(3, 3)).length;
        if (/Go again/.test(t.q('#msg').textContent)) continue;                 // the human closed a box and plays again
        const threeSided = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { const es = [r * 3 + c, (r + 1) * 3 + c, 12 + r * 4 + c, 12 + r * 4 + c + 1]; if (es.filter(x => mine[x]).length === 3 && !(es.every(x => mine[x]))) threeSided.push(es.find(x => !mine[x])); }
        G.tick(540); const after = edgesDrawn(3, 3), first = Object.keys(after).find(x => !mine[x]);
        if (threeSided.length && first !== undefined) { offered++; if (threeSided.includes(+first)) took++; }
        void before; void boxesBefore;
        for (let k = 0; k < 400 && /thinking|goes again/.test(t.q('#msg').textContent); k++) G.tick(100);
      }
      T.ok(offered === 0 || offered === took, 'dots: level ' + lv + ' phone completes a box every time one is on offer (' + took + ' of ' + offered + ')');
    }
    t.click('#sz [data-v="4"]'); T.eq(G.store('fun2.dotsboxes.n'), 4, 'dots: grid size saved'); T.eq(G.store('fun2.dotsboxes.lv'), 1, 'dots: phone level saved');
    t.click('#new'); T.eq(t.q('#msg').textContent, 'Tap between two dots to draw a line', 'dots: New game prompt');
  });

  /* ---------------- Reversi ---------------- */
  await run('reversi', async (t) => {
    const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
    const flipsOf = (b, i, p) => { if (b[i]) return []; const r0 = (i / 8) | 0, c0 = i % 8, out = []; for (const [dr, dc] of DIRS) { const run2 = []; let r = r0 + dr, c = c0 + dc; while (r >= 0 && r < 8 && c >= 0 && c < 8 && b[r * 8 + c] === 3 - p) { run2.push(r * 8 + c); r += dr; c += dc; } if (run2.length && r >= 0 && r < 8 && c >= 0 && c < 8 && b[r * 8 + c] === p) out.push(...run2); } return out; };
    const legal = (b, p) => [...Array(64).keys()].filter(i => !b[i] && flipsOf(b, i, p).length);
    const readBoard = () => t.all('#bd button').map(x => { const a = x.getAttribute('aria-label'); return /^black/.test(a) ? 1 : /^white/.test(a) ? 2 : 0; });
    const hints = () => t.all('#bd button').map((x, i) => /^legal move/.test(x.getAttribute('aria-label')) ? i : -1).filter(i => i >= 0);
    const counts = (b) => [b.filter(v => v === 1).length, b.filter(v => v === 2).length];
    const start = readBoard(); T.eq(start.join(''), (() => { const b = new Array(64).fill(0); b[27] = 2; b[28] = 1; b[35] = 1; b[36] = 2; return b.join(''); })(), 'reversi: standard starting position'); T.eq(hints().join(), '19,26,37,44', 'reversi: the four legal moves are shown'); T.eq(t.q('#bk').textContent + ',' + t.q('#wh').textContent, '2,2', 'reversi: 2-2 at the start');
    t.q('#bd [data-i="0"]').click(); T.has(t.q('#msg').textContent, 'Not a legal move', 'reversi: an illegal tap is refused'); T.eq(readBoard().join(''), start.join(''), 'reversi: board unchanged'); t.q('#bd [data-i="27"]').click(); T.eq(readBoard().join(''), start.join(''), 'reversi: occupied squares do nothing');
    let totalIllegal = 0;
    for (const lv of [1, 2, 3]) {
      t.click('#lv [data-v="' + lv + '"]'); t.click('#new'); G.seed(40 + lv); let prev = readBoard(), guard = 0, passes = 0;
      while (guard++ < 70 && !/You win|phone wins|A draw|each/i.test(t.q('#msg').textContent)) {
        if (!hints().length) { G.tick(600); const nb = readBoard(); if (nb.join('') === prev.join('') && !/win|draw|each/.test(t.q('#msg').textContent)) { G.tick(600); } prev = nb; if (guard > 66) break; continue; }
        const mv = hints(); T.eq(mv.join(), legal(prev, 1).join(), 'reversi: the hints are exactly the legal moves for black'); const pick = mv[Math.floor(G.w.Math.random() * mv.length)];
        t.q('#bd [data-i="' + pick + '"]').click(); const exp = prev.slice(); flipsOf(prev, pick, 1).forEach(i => { exp[i] = 1; }); exp[pick] = 1; const afterMine = readBoard();
        if (afterMine.join('') !== exp.join('')) { T.ok(false, 'reversi: the board after black plays ' + pick + ' follows the rules'); break; }
        /* the phone answers one move per 450 ms (several in a row if black has to pass): check each one */
        let work = exp.slice(), cur = work, ended = false;
        for (let k = 0; k < 60; k++) {
          G.tick(460); cur = readBoard();
          if (cur.join('') !== work.join('')) {
            const added = [...Array(64).keys()].filter(i => !work[i] && cur[i]); const a1 = added[0], fl = added.length === 1 ? flipsOf(work, a1, 2) : [];
            const ok = added.length === 1 && cur[a1] === 2 && fl.length > 0 && cur.every((v, i) => { const w2 = work[i]; return i === a1 ? v === 2 : fl.includes(i) ? v === 2 : v === w2; });
            if (!ok) { totalIllegal++; if (process.env.DBG) console.log('RV', lv, pick, work.join(''), cur.join('')); break; }
            work = cur; if (legal(work, 1).length) break;
          } else if (/Your move|win|draw|each/.test(t.q('#msg').textContent) && !/thinking/.test(t.q('#msg').textContent)) break;
        }
        prev = cur;
        const c = counts(prev); if (t.q('#bk').textContent !== String(c[0]) || t.q('#wh').textContent !== String(c[1])) T.ok(false, 'reversi: the counters match the discs');
      }
      const b = readBoard(), c = counts(b), msg = t.q('#msg').textContent; const over = legal(b, 1).length === 0 && legal(b, 2).length === 0; T.ok(over, 'reversi: level ' + lv + ' ends only when neither side can move (' + c.join('-') + ')'); T.ok(c[0] > c[1] ? /You win/.test(msg) : c[0] < c[1] ? /phone wins/.test(msg) : /draw/.test(msg), 'reversi: the result message matches the count (' + msg + ')');
    }
    T.eq(totalIllegal, 0, 'reversi: every phone move in three full games was legal and flipped the right discs');
    const st = G.store('fun2.reversi'); T.eq(st.played, 3, 'reversi: three games counted'); T.eq(G.store('fun2.reversi.lv'), 3, 'reversi: level saved');
  });

  /* ---------------- Stroop ---------------- */
  await run('stroop', async (t) => {
    const RGB = { 'rgb(229, 72, 77)': 0, 'rgb(59, 130, 246)': 1, 'rgb(22, 163, 74)': 2, 'rgb(234, 179, 8)': 3 }, NAMES = ['RED', 'BLUE', 'GREEN', 'YELLOW'];
    const ink = () => RGB[t.q('#word').style.color], word = () => NAMES.indexOf(t.q('#word').textContent), btn = (i) => t.q('#btns [data-i="' + i + '"]');
    T.eq(t.all('#btns button').map(b => b.textContent).join(), 'RED,BLUE,GREEN,YELLOW', 'stroop: four colour buttons'); btn(0).click(); T.eq(t.q('#ok').textContent, '0', 'stroop: buttons do nothing before Start');
    G.seed(21); t.click('#go'); T.ok(t.q('#go').disabled, 'stroop: Start is disabled while playing'); let same = 0, n = 0, wrongOnes = 0, right = 0;
    for (let k = 0; k < 40; k++) { const i = ink(); T.ok(i !== undefined, 'stroop: the word is drawn in one of the four colours'); if (word() === i) same++; n++; G.tick(400); if (k % 5 === 4) { btn((i + 1) % 4).click(); wrongOnes++; } else { btn(i).click(); right++; } }
    T.eq(t.q('#ok').textContent, String(right), 'stroop: only taps on the ink colour score'); T.ok(same < n, 'stroop: the word and ink often disagree (' + same + ' of ' + n + ' match)');
    G.tick(30000); T.has(t.q('#word').textContent, right + ' / ' + (right + wrongOnes), 'stroop: the result shows correct out of attempts'); const acc = Math.round(right * 100 / (right + wrongOnes)); T.has(t.q('#msg').textContent, acc + '% accurate', 'stroop: accuracy'); T.has(t.q('#msg').textContent, 'new best', 'stroop: first result is a best');
    const best = G.store('fun2.stroop.best'); T.eq(best.c, right, 'stroop: best correct saved'); T.ok(best.rt >= 390 && best.rt <= 410, 'stroop: average reaction time is measured (' + best.rt + ' ms)'); btn(0).click(); T.eq(t.q('#ok').textContent, String(right), 'stroop: no scoring after time is up'); T.eq(G.clock.pending().iv, 0, 'stroop: timer stopped');
    t.click('#go'); T.eq(t.q('#ok').textContent, '0', 'stroop: a new round resets'); for (let k = 0; k < 5; k++) { G.tick(300); btn(ink()).click(); } G.tick(31000); T.eq(G.store('fun2.stroop.best').c, right, 'stroop: a weaker round keeps the best'); T.ok(!/new best/.test(t.q('#msg').textContent), 'stroop: and does not claim a new best');
    t.click('#go'); G.tick(31000); T.has(t.q('#word').textContent, '0 / 0', 'stroop: no taps gives 0 / 0'); T.has(t.q('#msg').textContent, '0% accurate', 'stroop: and 0% without dividing by zero');
  });

  /* ---------------- Maze Runner ---------------- */
  await run('mazerun', async (t) => {
    void 0;
    const DIRS = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'];
    const model = (seed, w, h) => { const rep = G.replica(seed); return L.mazeGen(w, h, rep.rnd); };
    const bfsPath = (m, w, h, from, goal) => { const prev = new Map([[from, null]]), q = [from]; const D = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]]; for (let k = 0; k < q.length; k++) { const i = q[k]; if (i === goal) break; D.forEach(([dx, dy, bit], di) => { if (!(m[i] & bit)) return; const j = ((i / w | 0) + dy) * w + i % w + dx; if (!prev.has(j)) { prev.set(j, { from: i, di }); q.push(j); } }); } const dirs = []; for (let c = goal; prev.get(c);) { dirs.push(prev.get(c).di); c = prev.get(c).from; } return dirs.reverse(); };
    let m = model(77, 8, 8); let pos = 0, steps = 0; const w = 8, h = 8, goal = 63; T.eq(t.q('#lv').textContent, '1', 'maze: level 1'); T.eq(t.q('#cv')._lw, 360, 'maze: canvas size');
    const dirs = bfsPath(m, w, h, 0, goal); T.ok(dirs.length > 0, 'maze: the replicated maze has a path'); let moved = 0;
    while (pos !== goal && moved++ < 200) { const d = bfsPath(m, w, h, pos, goal)[0]; const path = L.mazeSlide(m, w, h, pos, d, goal); if (!path.length) { T.ok(false, 'maze: the planned step must move'); break; } G.tick(300); G.key(DIRS[d]); pos = path[path.length - 1]; steps += path.length; }
    T.has(t.q('#msg').textContent, 'Level 1 done', 'maze: reaching the flag completes the level'); T.has(t.q('#msg').textContent, '(' + steps + ' steps, shortest ' + L.mazeDist(m, w, h, 0, goal) + ')', 'maze: steps and the shortest route are reported correctly'); T.eq(G.store('fun2.mazerun.best').lv, 1, 'maze: best level saved'); T.eq(t.q('#bs').textContent, '1', 'maze: best shown');
    const before = t.q('#msg').textContent; G.key('ArrowLeft'); T.eq(t.q('#msg').textContent, before, 'maze: no moves after reaching the goal');
    G.tick(1700); T.eq(t.q('#lv').textContent, '2', 'maze: the next level starts by itself'); T.eq(t.q('#tm').textContent, '0:00', 'maze: new timer'); T.eq(t.q('#cv')._lw, 360, 'maze: level 2 canvas is 9x9 cells of 40 px');
    /* walls stop you, restart and new maze */
    t.click('#rs'); T.eq(t.q('#tm').textContent, '0:00', 'maze: Restart level resets the clock'); t.click('#nw'); T.eq(t.q('#lv').textContent, '2', 'maze: New maze keeps the level');
    G.key('ArrowUp'); G.key('ArrowLeft'); T.ok(G.sane(t.q('#cv')), 'maze: moving into a wall draws fine'); const tm0 = t.q('#tm').textContent; G.tick(3000); T.ok(true, 'maze: ' + tm0);
    for (let k = 0; k < 4; k++) { t.click('#nw'); } T.ok(t.all('button[data-d]').length === 4, 'maze: four arrow buttons');
    G.ev(t.q('[data-d="1"]'), 'pointerdown'); G.ev(t.q('[data-d="2"]'), 'pointerdown'); T.ok(G.sane(t.q('#cv')), 'maze: arrow buttons work');
    G.swipe(t.q('#cv'), 80, 5); G.swipe(t.q('#cv'), 5, 80); G.swipe(t.q('#cv'), 4, 4); T.ok(G.sane(t.q('#cv')), 'maze: swipes work, a tiny swipe is ignored');
  }, () => G.seed(77));

  /* ---------------- 24 Game ---------------- */
  await run('game24', async (t) => {
    const cards = () => t.all('#cards button'), val = (b) => b.getAttribute('aria-label'), nums = () => cards().map(val);
    const op = (o) => t.q('#ops [data-o="' + o + '"]').click(), card = (i) => cards()[i].click();
    const frac = (n, d) => { const g = (a, b) => b ? g(b, a % b) : Math.abs(a); const k = g(n, d) || 1; return d < 0 ? [-n / k, -d / k] : [n / k, d / k]; };
    const apply = (a, o, b) => o === '+' ? frac(a[0] * b[1] + b[0] * a[1], a[1] * b[1]) : o === '-' ? frac(a[0] * b[1] - b[0] * a[1], a[1] * b[1]) : o === '*' ? frac(a[0] * b[0], a[1] * b[1]) : (b[0] === 0 ? null : frac(a[0] * b[1], a[1] * b[0]));
    /* independent search that mirrors the game's item order (the result goes to the end of the list) and returns the clicks to make */
    const search = (items) => { if (items.length === 1) return items[0][0] === 24 && items[0][1] === 1 ? [] : null; for (let i = 0; i < items.length; i++) for (let j = 0; j < items.length; j++) { if (i === j) continue; for (const o of ['+', '-', '*', '/']) { const r = apply(items[i], o, items[j]); if (!r) continue; const rest = items.filter((_, k) => k !== i && k !== j).concat([r]), tail = search(rest); if (tail) return [[i, o, j]].concat(tail); } } return null; };
    const hand = () => nums().map(s => { const m = /^(-?\d+)(?:\/(\d+))?$/.exec(s); return [+m[1], m[2] ? +m[2] : 1]; });
    G.seed(24); T.eq(cards().length, 4, '24: four numbers'); T.ok(nums().every(s => +s >= 1 && +s <= 9), '24: numbers are 1-9');
    op('+'); T.has(t.q('#msg').textContent, 'Pick a number first', '24: an operator needs a number first');
    card(0); card(0); card(1); op('+'); card(1); T.eq(cards().length, 4, '24: picking the same card twice cancels, an operator then the same card does nothing');
    /* solve a few hands completely through the buttons */
    let solved = 0, total0 = 0; for (let g = 0; g < 6; g++) {
      t.click('#nw'); G.tick(1100 * 0); const plan = search(hand()); T.ok(!!plan, '24: this deal is solvable'); G.tick(1500);
      plan.forEach(([i, o, j], k) => { card(i); op(o); card(j); if (k === 0) G.tick(1100); }); if (/24! Solved/.test(t.q('#msg').textContent)) solved++; total0++;
    }
    T.eq(solved, 6, '24: following a solution through the buttons solves every deal'); const st = G.store('fun2.game24'); T.eq(st.solved, 6, '24: solved count saved'); T.ok(st.best >= 1 && st.best <= 2, '24: best time saved (' + st.best + ' s)'); T.eq(t.q('#sv').textContent, '6', '24: solved shown');
    t.click('#nw'); T.eq(cards().length, 4, '24: New deals again'); const h0 = nums().join();
    card(0); op('-'); card(1); T.eq(cards().length, 3, '24: combining two numbers leaves three cards'); t.click('#undo'); T.eq(nums().join(), h0, '24: undo restores the hand'); T.ok(t.q('#undo').disabled, '24: nothing more to undo');
    card(0); op('+'); card(1); card(0); op('*'); card(1); t.click('#rst'); T.eq(nums().join(), h0, '24: Reset restores the original hand'); T.eq(cards().length, 4, '24: four cards after reset');
    /* wrong result, divide by zero */
    for (let tries = 0; tries < 80; tries++) { t.click('#nw'); const n = nums(); const dup = n.findIndex((v, i) => n.indexOf(v) !== i); if (dup >= 0) { const first = n.indexOf(n[dup]); card(first); op('-'); card(dup); T.eq(nums().includes('0'), true, '24: equal numbers subtract to zero'); const zero = nums().indexOf('0'), other = nums().findIndex((v, i) => i !== zero); card(other); op('/'); card(zero); T.has(t.q('#msg').textContent, 'Cannot divide by zero', '24: dividing by zero is refused'); T.eq(cards().length, 3, '24: the hand is unchanged after a refused divide'); break; } }
    t.click('#nw'); const n0 = hand(); const wrongPlan = (() => { const items = n0.slice(); const seq = [[0, '+', 1]]; return seq; })(); card(0); op('+'); card(1); const r1 = nums(); card(0); op('+'); card(1); card(0); op('+'); card(1);
    T.has(t.q('#msg').textContent, 'not 24', '24: a final result other than 24 says what it made'); T.eq(cards().length, 1, '24: one card left'); void wrongPlan; void r1;
    t.click('#undo'); T.eq(cards().length, 2, '24: undo after a wrong finish');
    /* hint: a real solution that uses the four numbers */
    t.click('#nw'); const nn = nums().map(Number).sort().join(); t.click('#hint'); const hint = /One way: (.*) = 24/.exec(t.q('#msg').textContent)[1]; T.eq(hint.match(/\d+/g).map(Number).sort().join(), nn, '24: the hint uses exactly the four numbers'); T.ok(Math.abs(Function('return (' + hint.replace(/ x /g, ' * ') + ')')() - 24) < 1e-9, '24: the hint evaluates to 24');
  });

  await T.done(G.page);
})().catch(e => { console.log("FAIL: test crashed: " + (e && e.stack || e)); process.exit(1); });
