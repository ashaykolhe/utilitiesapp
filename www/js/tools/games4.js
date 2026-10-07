'use strict';
/* PocketKit "Games 4": Klondike Solitaire, Backgammon, Ludo, Snakes & Ladders (category 'fun').
   Pure logic lives in the objects S / B / D / N (exported for tests/games4.test.js at the bottom).
   Progress is saved under Store keys 'fun3.<id>' (stats) and '<id>.game' (game in progress). */
(() => {

/* ---------- shared helpers ---------- */
function rnd(n) {
  if (n <= 1) return 0;
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
  if (!c || !c.getRandomValues) return Math.floor(Math.random() * n);
  const a = new Uint32Array(1), lim = Math.floor(4294967296 / n) * n;
  let x;
  do { c.getRandomValues(a); x = a[0]; } while (x >= lim);
  return x % n;
}
function shuffle(a, rf) {
  a = a.slice(); rf = rf || rnd;
  for (let i = a.length - 1; i > 0; i--) { const j = rf(i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
const clone = (o) => JSON.parse(JSON.stringify(o));
const sget = (k, d) => { try { return typeof Store !== 'undefined' ? Store.get(k, d) : d; } catch (e) { return d; } };
const sset = (k, v) => { try { if (typeof Store !== 'undefined') Store.set(k, v); } catch (e) { /* ignore */ } };
const DIE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
/* Small confetti burst on an element, using the Web Animations API when available. */
function confetti(host) {
  if (!host || !host.animate) return;
  const em = ['🎉', '✨', '⭐', '🎊'];
  for (let i = 0; i < 18; i++) {
    const s = document.createElement('span');
    s.textContent = em[i % em.length];
    s.style.cssText = 'position:absolute;left:' + (5 + rnd(90)) + '%;top:-10px;font-size:22px;pointer-events:none';
    host.appendChild(s);
    const an = s.animate([{ transform: 'translateY(0) rotate(0deg)', opacity: 1 }, { transform: 'translateY(' + (200 + rnd(160)) + 'px) rotate(' + (rnd(720) - 360) + 'deg)', opacity: 0 }], { duration: 1400 + rnd(900), easing: 'ease-in' });
    if (an && an.addEventListener) an.addEventListener('finish', () => s.remove());
    setTimeout(() => s.remove(), 2600);
  }
}
const L = {};

/* =====================================================================
   1. KLONDIKE SOLITAIRE
   Card id 0..51: suit = id / 13 (0 spades, 1 hearts, 2 diamonds, 3 clubs), rank = id % 13 + 1 (1 = ace, 13 = king).
   State: tab = 7 columns of {c, u (face up)}, found[suit] = highest rank on that foundation, stock (top = last), waste (top = last).
   ===================================================================== */
const S = {};
L.S = S;
S.suit = (c) => (c / 13) | 0;
S.rank = (c) => c % 13 + 1;
S.red = (c) => { const s = S.suit(c); return s === 1 || s === 2; };
S.deal = function (draw, rf) {
  const deck = shuffle(Array.from({ length: 52 }, (_, i) => i), rf);
  const tab = []; let k = 0;
  for (let i = 0; i < 7; i++) { const col = []; for (let j = 0; j <= i; j++) col.push({ c: deck[k++], u: j === i }); tab.push(col); }
  return { tab, found: [0, 0, 0, 0], stock: deck.slice(k), waste: [], draw: draw === 3 ? 3 : 1, moves: 0, t: 0, done: false };
};
S.clone = clone;
/* A saved game is only used if it is a complete, consistent deal. */
S.valid = function (st) {
  try {
    if (!st || !Array.isArray(st.tab) || st.tab.length !== 7 || !Array.isArray(st.found) || st.found.length !== 4) return false;
    const seen = new Set();
    const add = (c) => { if (!Number.isInteger(c) || c < 0 || c > 51 || seen.has(c)) return false; seen.add(c); return true; };
    for (const col of st.tab) { if (!Array.isArray(col)) return false; for (const x of col) if (!x || !add(x.c)) return false; }
    for (let s = 0; s < 4; s++) { const n = st.found[s]; if (!Number.isInteger(n) || n < 0 || n > 13) return false; for (let r = 1; r <= n; r++) if (!add(s * 13 + r - 1)) return false; }
    for (const c of st.stock) if (!add(c)) return false;
    for (const c of st.waste) if (!add(c)) return false;
    return seen.size === 52 && (st.draw === 1 || st.draw === 3);
  } catch (e) { return false; }
};
S.canTab = function (st, col, c) {
  const t = st.tab[col];
  if (!t.length) return S.rank(c) === 13;
  const top = t[t.length - 1];
  return top.u && S.red(top.c) !== S.red(c) && S.rank(top.c) === S.rank(c) + 1;
};
S.canFound = (st, c) => st.found[S.suit(c)] === S.rank(c) - 1;
/* The cards that would move with this source: {t:'w'} waste top, {t:'f', s} foundation top, {t:'t', col, idx} a face-up run. */
S.cardsAt = function (st, src) {
  if (src.t === 'w') return st.waste.length ? [st.waste[st.waste.length - 1]] : [];
  if (src.t === 'f') return st.found[src.s] > 0 ? [src.s * 13 + st.found[src.s] - 1] : [];
  const col = st.tab[src.col];
  if (!col || src.idx < 0 || src.idx >= col.length || !col[src.idx].u) return [];
  return col.slice(src.idx).map((x) => x.c);
};
S.targets = function (st, src) {
  const cs = S.cardsAt(st, src); if (!cs.length) return [];
  const out = [], c = cs[0];
  if (cs.length === 1 && src.t !== 'f' && S.canFound(st, c)) out.push({ t: 'f', s: S.suit(c) });
  for (let col = 0; col < 7; col++) if (!(src.t === 't' && src.col === col) && S.canTab(st, col, c)) out.push({ t: 't', col });
  return out;
};
/* Best place: a foundation first, then a column with cards, then an empty column (but never moving a king that already sits at the bottom). */
S.best = function (st, src) {
  const tg = S.targets(st, src); if (!tg.length) return null;
  const f = tg.find((d) => d.t === 'f'); if (f) return f;
  const full = tg.find((d) => st.tab[d.col].length > 0); if (full) return full;
  if (src.t === 't' && src.idx === 0) return null;
  return tg[0];
};
S.apply = function (st, src, dst) {
  if (!S.targets(st, src).some((d) => d.t === dst.t && d.col === dst.col && d.s === dst.s)) return false;
  const cs = S.cardsAt(st, src);
  if (src.t === 'w') st.waste.pop();
  else if (src.t === 'f') st.found[src.s]--;
  else { const col = st.tab[src.col]; col.splice(src.idx); if (col.length && !col[col.length - 1].u) col[col.length - 1].u = true; }
  if (dst.t === 'f') st.found[dst.s]++;
  else for (const c of cs) st.tab[dst.col].push({ c, u: true });
  st.moves++;
  return true;
};
/* Tap on the stock: deal 1 or 3 to the waste, or turn the waste over when the stock is empty. */
S.stockTap = function (st) {
  if (!st.stock.length && !st.waste.length) return false;
  if (!st.stock.length) { while (st.waste.length) st.stock.push(st.waste.pop()); }
  else for (let i = 0; i < st.draw && st.stock.length; i++) st.waste.push(st.stock.pop());
  st.moves++;
  return true;
};
S.won = (st) => st.found.every((n) => n === 13);
S.canAuto = (st) => !S.won(st) && st.tab.every((col) => col.every((x) => x.u));
/* One auto-complete step: a card to a foundation ('move'), else turn the stock ('cycle'), else null. */
S.autoStep = function (st) {
  const srcs = [{ t: 'w' }];
  for (let col = 0; col < 7; col++) if (st.tab[col].length) srcs.push({ t: 't', col, idx: st.tab[col].length - 1 });
  for (const s of srcs) {
    const cs = S.cardsAt(st, s);
    if (cs.length === 1 && S.canFound(st, cs[0])) { S.apply(st, s, { t: 'f', s: S.suit(cs[0]) }); return 'move'; }
  }
  if (st.stock.length || st.waste.length) { S.stockTap(st); return 'cycle'; }
  return null;
};
/* Runs auto-complete to the end; returns true when the game is won (false when stuck). */
S.autoComplete = function (st) {
  let idle = 0;
  for (let n = 0; n < 2000 && !S.won(st); n++) {
    const r = S.autoStep(st);
    if (!r) return false;
    idle = r === 'move' ? 0 : idle + 1;
    if (idle > st.stock.length + st.waste.length + 2) return false;
  }
  return S.won(st);
};

function solitaire(el) {
  const SY = ['♠', '♥', '♦', '♣'], RK = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  let st = sget('solitaire.game', null);
  if (!S.valid(st)) st = S.deal(sget('fun3.solitaire', {}).draw === 3 ? 3 : 1);
  let undo = [];
  let timer = null, autoT = null, shakeCol = null, busy = false;
  el.innerHTML = `<style>
    .sol-b{position:relative;width:100%;user-select:none;-webkit-user-select:none;touch-action:manipulation}
    .sol-c{position:absolute;box-sizing:border-box;border-radius:5px;background:#fff;color:#1a1a1a;border:1px solid #888;font-weight:700;overflow:hidden;line-height:1;cursor:pointer}
    .sol-c.r{color:#c0392b}
    .sol-c b{position:absolute;left:3px;top:2px;font-size:.78em}
    .sol-c i{position:absolute;right:3px;top:2px;font-style:normal;font-size:.78em}
    .sol-c u{position:absolute;left:0;right:0;bottom:2px;text-align:center;text-decoration:none;font-size:1.5em}
    .sol-c.d{background:repeating-linear-gradient(45deg,var(--accent) 0 4px,var(--surface2) 4px 8px);color:transparent;border-color:var(--line)}
    .sol-e{position:absolute;box-sizing:border-box;border-radius:5px;border:2px dashed var(--line);color:var(--muted);text-align:center;opacity:.8}
    .sol-s{animation:solshake .3s}
    @keyframes solshake{25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
  </style>
  <div class="row" style="margin-bottom:6px;align-items:center">
    <div class="mid" id="info" role="status" style="flex:2"></div>
    <button class="btn alt" id="mode" style="min-height:44px">Draw 1</button>
  </div>
  <div class="sol-b" id="board" style="position:relative"></div>
  <div class="row" style="margin-top:10px">
    <button class="btn alt" id="undo" style="min-height:44px">Undo</button>
    <button class="btn alt" id="auto" style="min-height:44px">Auto-complete</button>
    <button class="btn" id="new" style="min-height:44px">New deal</button>
  </div>
  <div class="muted center" id="msg" style="margin-top:8px;min-height:20px"></div>
  <div class="muted center" id="stats" style="margin-top:4px"></div>`;
  const board = $('#board', el), info = $('#info', el), msg = $('#msg', el);

  const fmtT = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  const stats = () => Object.assign({ played: 0, wins: 0, best1: 0, best3: 0, draw: 1 }, sget('fun3.solitaire', {}));
  function save() { sset('solitaire.game', st); }
  function drawInfo() {
    info.textContent = 'Moves ' + st.moves + '   Time ' + fmtT(st.t);
    const s = stats();
    $('#stats', el).textContent = 'Won ' + s.wins + ' of ' + s.played + (s['best' + st.draw] ? '   Best (draw ' + st.draw + ') ' + fmtT(s['best' + st.draw]) : '');
  }
  function startTimer() {
    if (timer || st.done) return;
    timer = setInterval(() => { st.t++; drawInfo(); }, 1000);
  }
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
  function cardHTML(c, x, y, W, H, attrs, extra) {
    const r = SY[S.suit(c)], rk = RK[S.rank(c) - 1], red = S.red(c) ? ' r' : '';
    return '<div class="sol-c' + red + (extra || '') + '" ' + attrs + ' style="left:' + x + 'px;top:' + y + 'px;width:' + W + 'px;height:' + H + 'px;font-size:' + Math.round(W * 0.36) + 'px" aria-label="' + rk + ' of ' + ['spades', 'hearts', 'diamonds', 'clubs'][S.suit(c)] + '"><b>' + rk + '</b><i>' + r + '</i><u>' + r + '</u></div>';
  }
  function draw() {
    const gap = 4, bw = board.clientWidth || 340, W = Math.max(30, Math.floor((bw - gap * 6) / 7)), H = Math.round(W * 1.4);
    const X = (i) => i * (W + gap);
    let out = '';
    // stock
    if (st.stock.length) out += '<div class="sol-c d" data-a="stock" role="button" aria-label="Stock, ' + st.stock.length + ' cards" style="left:0;top:0;width:' + W + 'px;height:' + H + 'px"></div>';
    else out += '<div class="sol-e" data-a="stock" role="button" aria-label="Turn the waste over" style="left:0;top:0;width:' + W + 'px;height:' + H + 'px;line-height:' + H + 'px;font-size:' + Math.round(W * 0.5) + 'px">' + (st.waste.length ? '↻' : '') + '</div>';
    // waste: show up to 3 fanned when drawing 3
    const show = st.waste.slice(-(st.draw === 3 ? 3 : 1));
    show.forEach((c, i) => { out += cardHTML(c, X(1) + i * Math.round(W * 0.3), 0, W, H, i === show.length - 1 ? 'data-a="w" role="button"' : ''); });
    // foundations
    for (let s = 0; s < 4; s++) {
      const n = st.found[s];
      if (n) out += cardHTML(s * 13 + n - 1, X(3 + s), 0, W, H, 'data-a="f' + s + '" role="button"');
      else out += '<div class="sol-e" style="left:' + X(3 + s) + 'px;top:0;width:' + W + 'px;height:' + H + 'px;line-height:' + H + 'px;font-size:' + Math.round(W * 0.5) + 'px">' + SY[s] + '</div>';
    }
    // tableau
    const top0 = H + 10, dd = Math.round(H * 0.16), du = Math.round(H * 0.3);
    let maxY = top0 + H;
    for (let col = 0; col < 7; col++) {
      const cards = st.tab[col];
      if (!cards.length) { out += '<div class="sol-e" data-a="col' + col + '" style="left:' + X(col) + 'px;top:' + top0 + 'px;width:' + W + 'px;height:' + H + 'px"></div>'; continue; }
      let y = top0;
      cards.forEach((x, idx) => {
        if (x.u) out += cardHTML(x.c, X(col), y, W, H, 'data-a="t' + col + ',' + idx + '" role="button"', shakeCol === col ? ' sol-s' : '');
        else out += '<div class="sol-c d" style="left:' + X(col) + 'px;top:' + y + 'px;width:' + W + 'px;height:' + H + 'px"></div>';
        y += x.u ? du : dd;
      });
      maxY = Math.max(maxY, y - (cards[cards.length - 1].u ? du : dd) + H);
    }
    board.style.height = Math.max(maxY, top0 + H * 2.6) + 'px';
    board.innerHTML = out;
    $('#mode', el).textContent = 'Draw ' + st.draw;
    $('#undo', el).disabled = !undo.length || busy;
    $('#auto', el).style.display = S.canAuto(st) ? '' : 'none';
    drawInfo();
  }
  function say(t) { msg.textContent = t; }
  function push() { undo.push(JSON.stringify(st)); if (undo.length > 3000) undo.shift(); }
  function afterMove() {
    startTimer(); save();
    if (S.won(st)) win(); else draw();
  }
  function win() {
    stopTimer(); busy = false;
    if (!st.done) {
      st.done = true;
      const s = stats(); s.played++; s.wins++;
      const k = 'best' + st.draw; if (!s[k] || st.t < s[k]) s[k] = st.t;
      sset('fun3.solitaire', s);
    }
    save(); draw();
    say('🎉 You won in ' + st.moves + ' moves and ' + fmtT(st.t) + '!');
    board.style.position = 'relative'; confetti(board);
  }
  function tapSource(src) {
    if (busy || st.done) return;
    const dst = S.best(st, src);
    if (!dst) { if (src.t === 't') { shakeCol = src.col; draw(); shakeCol = null; } say('No legal move for that card.'); return; }
    push(); S.apply(st, src, dst); say(''); afterMove();
  }
  function onTap(e) {
    const n = e.target.closest ? e.target.closest('[data-a]') : null; if (!n) return;
    const a = n.getAttribute('data-a');
    if (a === 'stock') { if (busy || st.done) return; if (!st.stock.length && !st.waste.length) return; push(); S.stockTap(st); say(''); afterMove(); }
    else if (a === 'w') tapSource({ t: 'w' });
    else if (a[0] === 'f') tapSource({ t: 'f', s: +a.slice(1) });
    else if (a[0] === 't') { const p = a.slice(1).split(','); tapSource({ t: 't', col: +p[0], idx: +p[1] }); }
  }
  board.addEventListener('click', onTap);
  function newDeal(draw) {
    stopTimer(); clearTimeout(autoT); busy = false;
    if (!st.done && st.moves > 0) { const s = stats(); s.played++; sset('fun3.solitaire', s); }
    const s = stats(); s.draw = draw; sset('fun3.solitaire', s);
    st = S.deal(draw); undo = []; say(''); save(); drawNow();
  }
  function drawNow() { draw(); }
  $('#new', el).onclick = () => newDeal(st.draw);
  $('#mode', el).onclick = () => newDeal(st.draw === 1 ? 3 : 1);
  $('#undo', el).onclick = () => {
    if (!undo.length || busy) return;
    const t = st.t, prev = JSON.parse(undo.pop()); prev.t = t; prev.done = false; st = prev; say(''); save(); draw();
  };
  $('#auto', el).onclick = () => {
    if (busy || st.done || !S.canAuto(st)) return;
    busy = true; push(); let idle = 0;
    const step = () => {
      const r = S.autoStep(st);
      if (S.won(st)) { win(); return; }
      idle = r === 'move' ? 0 : idle + 1;
      if (!r || idle > st.stock.length + st.waste.length + 2) { busy = false; save(); draw(); say('Auto-complete got stuck. Keep playing, or tap Undo.'); return; }
      draw(); startTimer(); autoT = setTimeout(step, r === 'move' ? 70 : 20);
    };
    step();
  };
  draw();
  if (st.moves > 0 && !st.done) startTimer();
  const onResize = () => draw();
  window.addEventListener('resize', onResize);
  if (S.won(st)) say('You already won this deal. Tap New deal.');
  return () => { stopTimer(); clearTimeout(autoT); window.removeEventListener('resize', onResize); board.removeEventListener('click', onTap); save(); };
}

if (typeof Tools !== 'undefined') Tools.register({
  id: 'solitaire', name: 'Solitaire', icon: '🂡', cat: 'fun',
  desc: 'Klondike Solitaire with draw 1 or draw 3, tap-to-move, unlimited undo, auto-complete, move counter and timer.',
  keys: ['klondike', 'cards', 'patience', 'card game'], needs: ['storage'], pro: false, render: solitaire
});
/* =====================================================================
   2. BACKGAMMON (no doubling cube)
   Absolute points 1..24. pts[p] > 0 = White (player 0) checkers, < 0 = Black (player 1). White moves 24 -> 1 and bears off from 1..6,
   Black moves 1 -> 24 and bears off from 19..24. Each player's own "distance" q is 1..24 (25 = the bar, 0 = off):
   White q = point, Black q = 25 - point. A move is {from: q, to: q, die}.
   ===================================================================== */
const B = {};
L.B = B;
B.start = function () {
  const pts = new Array(25).fill(0);
  const put = (q, n) => { pts[q] += n; pts[25 - q] -= n; };
  put(24, 2); put(13, 5); put(8, 3); put(6, 5);
  return { pts, bar: [0, 0], off: [0, 0], turn: 0, dice: [], rolled: false, winner: -1 };
};
B.cl = (st) => ({ pts: st.pts.slice(), bar: st.bar.slice(), off: st.off.slice(), turn: st.turn, dice: st.dice.slice(), rolled: st.rolled, winner: st.winner });
B.pt = (pl, q) => pl === 0 ? q : 25 - q;
B.cnt = (st, pl, pt) => pl === 0 ? Math.max(st.pts[pt], 0) : Math.max(-st.pts[pt], 0);
B.own = (st, pl, q) => B.cnt(st, pl, B.pt(pl, q));
B.key = (st) => st.pts.join(',') + '|' + st.bar + '|' + st.off + '|' + st.turn;
B.pips = function (st, pl) { let s = st.bar[pl] * 25; for (let q = 1; q <= 24; q++) s += B.own(st, pl, q) * q; return s; };
B.allHome = function (st, pl) { if (st.bar[pl]) return false; for (let q = 7; q <= 24; q++) if (B.own(st, pl, q)) return false; return true; };
/* Every single checker move that is legal with this one die (not yet looking at the use-both-dice rule). */
B.steps = function (st, die) {
  const pl = st.turn, op = 1 - pl, out = [];
  if (st.bar[pl] > 0) {
    const t = 25 - die;
    if (B.cnt(st, op, B.pt(pl, t)) <= 1) out.push({ from: 25, to: t, die });
    return out;
  }
  const home = B.allHome(st, pl);
  let hi = 0; for (let q = 24; q >= 1; q--) if (B.own(st, pl, q)) { hi = q; break; }
  for (let q = 24; q >= 1; q--) {
    if (!B.own(st, pl, q)) continue;
    const t = q - die;
    if (t >= 1) { if (B.cnt(st, op, B.pt(pl, t)) <= 1) out.push({ from: q, to: t, die }); }
    else if (home && (t === 0 || q === hi)) out.push({ from: q, to: 0, die });
  }
  return out;
};
/* Plays one move on st (mutates). Returns true when it hit a blot. */
B.apply = function (st, mv) {
  const pl = st.turn, sg = pl === 0 ? 1 : -1, i = st.dice.indexOf(mv.die);
  if (i >= 0) st.dice.splice(i, 1);
  if (mv.from === 25) st.bar[pl]--; else st.pts[B.pt(pl, mv.from)] -= sg;
  let hit = false;
  if (mv.to === 0) { st.off[pl]++; if (st.off[pl] === 15) st.winner = pl; }
  else {
    const tp = B.pt(pl, mv.to);
    if (B.cnt(st, 1 - pl, tp) === 1) { st.pts[tp] = 0; st.bar[1 - pl]++; hit = true; }
    st.pts[tp] += sg;
  }
  return hit;
};
/* The most dice that can still be played in a row (stops counting once all remaining dice are used). */
B.depth = function (st) {
  if (!st.dice.length || st.winner >= 0) return 0;
  const need = st.dice.length; let best = 0;
  for (const d of new Set(st.dice)) {
    for (const mv of B.steps(st, d)) {
      const c = B.cl(st); B.apply(c, mv);
      const r = 1 + B.depth(c);
      if (r > best) { best = r; if (best === need) return best; }
    }
  }
  return best;
};
/* The legal next moves: only those that keep the most dice playable, and with one playable die the larger one. */
B.moves = function (st) {
  if (st.winner >= 0 || !st.dice.length) return [];
  const all = [];
  for (const d of new Set(st.dice)) for (const mv of B.steps(st, d)) {
    const c = B.cl(st); B.apply(c, mv);
    all.push({ mv, depth: 1 + B.depth(c) });
  }
  if (!all.length) return [];
  const M = Math.max(...all.map((x) => x.depth));
  let ok = all.filter((x) => x.depth === M).map((x) => x.mv);
  if (M === 1 && st.dice.length >= 2 && new Set(st.dice).size === 2) {
    const big = Math.max(...st.dice);
    if (ok.some((m) => m.die === big)) ok = ok.filter((m) => m.die === big);
  }
  return ok;
};
B.roll = function (st, rf) {
  rf = rf || rnd;
  const a = rf(6) + 1, b = rf(6) + 1;
  st.dice = a === b ? [a, a, a, a] : [a, b]; st.rolled = true;
  return [a, b];
};
B.endTurn = function (st) { st.turn = 1 - st.turn; st.dice = []; st.rolled = false; };
/* All distinct complete turns from this position: [{moves, state}]. */
B.turns = function (st0) {
  const res = new Map(), seen = new Set(); let nodes = 0;
  (function go(st, path) {
    const key = B.key(st) + '|' + st.dice.slice().sort().join('');
    if (seen.has(key) || nodes++ > 6000) return; seen.add(key);
    const mv = B.moves(st);
    if (!mv.length) { res.set(B.key(st), { moves: path, state: st }); return; }
    for (const m of mv) { const c = B.cl(st); B.apply(c, m); go(c, path.concat([m])); }
  })(st0, []);
  return [...res.values()];
};
/* How good a position is for player pl (higher is better); used by the Normal level. */
B.eval = function (st, pl) {
  const op = 1 - pl;
  if (st.winner === pl) return 1e6;
  if (st.winner === op) return -1e6;
  let sc = B.pips(st, op) - B.pips(st, pl) + st.off[pl] * 2;
  sc += st.bar[op] * 6 - st.bar[pl] * 8;
  for (let q = 1; q <= 24; q++) {
    const n = B.own(st, pl, q);
    if (n >= 2) sc += q <= 6 ? 4 : q <= 12 ? 3 : 1.5;
    else if (n === 1) {
      let p = 0;
      if (st.bar[op]) p += q <= 6 ? 0.35 : q <= 12 ? 0.12 : 0;
      for (let r = 1; r < q; r++) {
        if (!B.own(st, op, 25 - r)) continue; // opponent checkers in its own distance coords: point of op at my q=r is its q = 25 - r
        const d = q - r; p += d <= 6 ? 0.35 : d <= 12 ? 0.12 : 0;
      }
      sc -= Math.min(p, 0.75) * (25 - q) * 0.9;
    }
  }
  return sc;
};
/* The AI's whole turn (state already rolled): returns the list of moves to play. level 'easy' or 'normal'. */
B.aiTurn = function (st, level) {
  const ts = B.turns(st); if (!ts.length) return [];
  if (level === 'easy') return ts[rnd(ts.length)].moves;
  let best = null, bs = -Infinity;
  for (const t of ts) { const s = B.eval(t.state, st.turn) + Math.random() * 0.5; if (s > bs) { bs = s; best = t; } }
  return best.moves;
};

B.valid = function (st) {
  try {
    if (!st || !Array.isArray(st.pts) || st.pts.length !== 25 || !st.pts.every(Number.isInteger)) return false;
    if (!Array.isArray(st.bar) || !Array.isArray(st.off) || !Array.isArray(st.dice) || !st.dice.every((d) => d >= 1 && d <= 6)) return false;
    if (st.turn !== 0 && st.turn !== 1) return false;
    for (const pl of [0, 1]) { let n = st.bar[pl] + st.off[pl]; for (let p = 1; p <= 24; p++) n += B.cnt(st, pl, p); if (n !== 15) return false; }
    return true;
  } catch (e) { return false; }
};

function backgammon(el) {
  const saved = sget('backgammon.game', null);
  const stats = () => Object.assign({ wins: 0, losses: 0, mode: 'normal' }, sget('fun3.backgammon', {}));
  let mode = saved && ['easy', 'normal', 'pvp'].includes(saved.mode) ? saved.mode : stats().mode;
  if (!['easy', 'normal', 'pvp'].includes(mode)) mode = 'normal';
  let st = saved && B.valid(saved.st) ? saved.st : B.start();
  let sel = null, snaps = [], timers = [], message = '', recorded = st.winner >= 0;
  const NAME = ['White', 'Black'];
  const human = (pl) => mode === 'pvp' || pl === 0;
  const later = (fn, ms) => { const t = setTimeout(() => { timers = timers.filter((x) => x !== t); fn(); }, ms); timers.push(t); };
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  el.innerHTML = `<div class="row" style="align-items:flex-end;margin-bottom:6px">
    <label class="f" style="flex:2">Opponent
      <select id="mode" aria-label="Opponent"><option value="easy">Phone: Easy</option><option value="normal">Phone: Normal</option><option value="pvp">Pass and play</option></select></label>
    <button class="btn alt" id="new" style="min-height:44px">New game</button>
  </div>
  <div class="mid center" id="msg" role="status" style="min-height:26px"></div>
  <svg id="bd" viewBox="0 0 380 466" style="width:100%;height:auto;display:block;touch-action:manipulation" role="img" aria-label="Backgammon board"></svg>
  <div class="row" style="margin-top:8px">
    <button class="btn" id="roll" style="min-height:48px">🎲 Roll dice</button>
    <button class="btn alt" id="off" style="min-height:48px">Bear off</button>
    <button class="btn alt" id="undo" style="min-height:48px">Undo</button>
  </div>
  <div class="muted center" id="info" style="margin-top:8px"></div>`;
  $('#mode', el).value = mode;
  const svg = $('#bd', el), msgEl = $('#msg', el);

  const colOf = (p) => p <= 12 ? 12 - p : p - 13;
  const px = (p) => 8 + colOf(p) * 28 + (colOf(p) >= 6 ? 28 : 0);
  const legalNow = () => (st.rolled && st.winner < 0 && human(st.turn)) ? B.moves(st) : [];
  const srcPt = (q) => q === 25 ? 'bar' : B.pt(st.turn, q);
  function save() { sset('backgammon.game', { mode, st }); }
  function say(t) { message = t; msgEl.textContent = t; }

  function draw() {
    const legal = legalNow();
    const srcs = new Set(legal.map((m) => srcPt(m.from)));
    const dests = new Set(sel === null ? [] : legal.filter((m) => srcPt(m.from) === sel && m.to > 0).map((m) => B.pt(st.turn, m.to)));
    const canOff = sel !== null && legal.some((m) => srcPt(m.from) === sel && m.to === 0);
    let o = '<rect x="0" y="0" width="380" height="466" rx="8" fill="var(--surface)" stroke="var(--line)"/>';
    o += '<rect x="176" y="0" width="28" height="466" fill="var(--surface2)"/>';
    for (let p = 1; p <= 24; p++) {
      const x = px(p), top = p >= 13, col = colOf(p), fill = col % 2 ? 'var(--accent)' : 'var(--surface2)';
      const pts = top ? x + ',8 ' + (x + 28) + ',8 ' + (x + 14) + ',198' : x + ',458 ' + (x + 28) + ',458 ' + (x + 14) + ',268';
      o += '<polygon points="' + pts + '" fill="' + fill + '" opacity="' + (col % 2 ? 0.55 : 1) + '" stroke="var(--line)" stroke-width="0.5"/>';
      if (dests.has(p)) o += '<circle cx="' + (x + 14) + '" cy="' + (top ? 40 : 426) + '" r="11" fill="var(--ok)" opacity="0.85"/>';
      const v = st.pts[p], n = Math.abs(v);
      if (n) {
        const step = n <= 5 ? 26 : 104 / (n - 1);
        for (let i = 0; i < n; i++) {
          const cy = top ? 22 + i * step : 444 - i * step;
          o += chk(x + 14, cy, v > 0 ? 0 : 1, srcs.has(p) && i === n - 1 ? (sel === p ? 2 : 1) : 0);
        }
        if (n > 5) o += '<text x="' + (x + 14) + '" y="' + ((top ? 22 + 104 : 444 - 104) + 4) + '" text-anchor="middle" font-size="12" font-weight="700" fill="' + (v > 0 ? '#111' : '#fff') + '">' + n + '</text>';
      }
      o += '<rect data-p="' + p + '" x="' + x + '" y="' + (top ? 8 : 268) + '" width="28" height="190" fill="transparent" ' + (srcs.has(p) || dests.has(p) ? 'style="cursor:pointer"' : '') + '/>';
    }
    for (let i = 0; i < st.bar[1]; i++) o += chk(190, 40 + i * 26, 1, 0);
    for (let i = 0; i < st.bar[0]; i++) o += chk(190, 426 - i * 26, 0, 0);
    if (srcs.has('bar')) o += '<circle cx="190" cy="' + (st.turn === 0 ? 426 - (st.bar[0] - 1) * 26 : 40 + (st.bar[1] - 1) * 26) + '" r="16" fill="none" stroke="var(--ok)" stroke-width="3"/>';
    o += '<rect data-p="bar" x="176" y="8" width="28" height="450" fill="transparent"/>';
    // dice
    const n = st.dice.length;
    st.dice.forEach((d, i) => { o += '<text x="' + (190 - n * 22 + i * 44 + 22) + '" y="250" text-anchor="middle" font-size="44" fill="var(--text)">' + DIE[d] + '</text>'; });
    svg.innerHTML = o;
    const turnTxt = st.winner >= 0 ? '' : NAME[st.turn] + (mode !== 'pvp' ? (st.turn === 0 ? ' (you)' : ' (phone)') : '') + ' to ' + (st.rolled ? 'move' : 'roll');
    msgEl.textContent = message || turnTxt;
    $('#roll', el).style.display = st.winner < 0 && !st.rolled && human(st.turn) ? '' : 'none';
    $('#off', el).style.display = canOff ? '' : 'none';
    $('#undo', el).disabled = !snaps.length || !human(st.turn) || st.winner >= 0;
    const s = stats();
    $('#info', el).textContent = 'Off: White ' + st.off[0] + '  Black ' + st.off[1] + '   Pips: White ' + B.pips(st, 0) + '  Black ' + B.pips(st, 1) + (mode !== 'pvp' ? '   You ' + s.wins + ' - ' + s.losses + ' Phone' : '');
  }
  function chk(cx, cy, pl, ring) {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="12.5" fill="' + (pl ? '#2a2a2e' : '#f5f5f0') + '" stroke="' + (ring === 2 ? 'var(--ok)' : ring === 1 ? 'var(--accent)' : (pl ? '#999' : '#555')) + '" stroke-width="' + (ring ? 3 : 1.2) + '"/>';
  }

  function finish() {
    clearTimers(); save();
    if (!recorded) {
      recorded = true;
      if (mode !== 'pvp') { const s = stats(); if (st.winner === 0) s.wins++; else s.losses++; sset('fun3.backgammon', s); }
    }
    say('🎉 ' + NAME[st.winner] + (mode !== 'pvp' ? (st.winner === 0 ? ' (you) wins!' : ' (phone) wins.') : ' wins!'));
    draw(); if (st.winner === 0 || mode === 'pvp') confetti(svg.parentNode);
  }
  function endTurn() {
    B.endTurn(st); snaps = []; sel = null; message = ''; save(); draw(); next();
  }
  function afterMove() {
    save();
    if (st.winner >= 0) { finish(); return; }
    if (!B.moves(st).length) { draw(); later(endTurn, 600); return; }
    draw();
  }
  function doRoll() {
    if (st.rolled || st.winner >= 0) return;
    const r = B.roll(st); sel = null; snaps = []; message = '';
    save();
    if (!B.moves(st).length) { say(NAME[st.turn] + ' rolled ' + r[0] + ' and ' + r[1] + ': no legal move.'); draw(); later(endTurn, 1500); return; }
    draw();
    if (!human(st.turn)) aiPlay();
  }
  function aiPlay() {
    const list = B.aiTurn(st, mode);
    const stepIt = (i) => {
      if (i >= list.length || st.winner >= 0) { if (st.winner >= 0) finish(); else later(endTurn, 500); return; }
      const m = list[i]; B.apply(st, m);
      say('Phone: ' + (m.from === 25 ? 'bar' : B.pt(1, m.from)) + ' to ' + (m.to === 0 ? 'off' : B.pt(1, m.to)));
      save(); draw();
      later(() => stepIt(i + 1), 600);
    };
    later(() => stepIt(0), 600);
  }
  function next() {
    clearTimers();
    if (st.winner >= 0) { finish(); return; }
    if (!st.rolled) { if (!human(st.turn)) later(doRoll, 700); return; }
    if (!B.moves(st).length) { later(endTurn, 800); return; }
    if (!human(st.turn)) aiPlay();
  }
  function tapPoint(p) {
    const legal = legalNow(); if (!legal.length) return;
    const q = p === 'bar' ? 25 : B.pt(st.turn, p);
    if (sel !== null && p !== 'bar') {
      const ms = legal.filter((m) => srcPt(m.from) === sel && m.to === q && m.to > 0);
      if (ms.length) { snaps.push(B.cl(st)); B.apply(st, ms[0]); sel = null; message = ''; afterMove(); return; }
    }
    if (legal.some((m) => srcPt(m.from) === p)) sel = sel === p ? null : p; else sel = null;
    draw();
  }
  svg.addEventListener('click', (e) => {
    const r = e.target.closest ? e.target.closest('[data-p]') : null; if (!r) return;
    const v = r.getAttribute('data-p'); tapPoint(v === 'bar' ? 'bar' : +v);
  });
  $('#roll', el).onclick = () => { if (human(st.turn)) doRoll(); };
  $('#off', el).onclick = () => {
    const legal = legalNow();
    const ms = legal.filter((m) => sel !== null && srcPt(m.from) === sel && m.to === 0).sort((a, b) => a.die - b.die);
    if (!ms.length) return;
    snaps.push(B.cl(st)); B.apply(st, ms[0]); sel = null; message = ''; afterMove();
  };
  $('#undo', el).onclick = () => {
    if (!snaps.length || !human(st.turn) || st.winner >= 0) return;
    clearTimers(); st = snaps.pop(); sel = null; message = ''; save(); draw();
  };
  function newGame() {
    clearTimers(); st = B.start(); sel = null; snaps = []; message = ''; recorded = false;
    st.turn = rnd(2); // the opening roll decides who starts
    save(); draw(); next();
  }
  $('#new', el).onclick = newGame;
  $('#mode', el).onchange = (e) => {
    mode = e.target.value; const s = stats(); s.mode = mode; sset('fun3.backgammon', s); newGame();
  };
  draw(); next();
  return () => { clearTimers(); save(); };
}

if (typeof Tools !== 'undefined') Tools.register({
  id: 'backgammon', name: 'Backgammon', icon: '🟤', cat: 'fun',
  desc: 'Backgammon against the phone (Easy or Normal) or pass-and-play, with legal-move highlighting and all the standard rules.',
  keys: ['board game', 'dice', 'checkers', 'tavla'], needs: ['storage'], pro: false, render: backgammon
});
/* =====================================================================
   3. LUDO
   A token's progress rel: -1 in the yard, 0..50 on the 52-square loop (0 = its own start square), 51..55 in its home lane, 56 = home.
   Loop square (absolute) = (START[colour] + rel) % 52. Safe squares: the four start squares and the four star squares (8 after each start).
   Rules: a six leaves the yard, a six gives another roll (a third six in a row loses the turn), landing on an opponent on a non-safe
   square sends it home, an exact roll is needed to reach home (56). No blockades.
   ===================================================================== */
const D = {};
L.D = D;
D.COLORS = ['Red', 'Green', 'Yellow', 'Blue'];
D.START = [0, 13, 26, 39];
D.seats = (n) => n === 2 ? [0, 2] : n === 3 ? [0, 1, 2] : [0, 1, 2, 3];
D.abs = (c, rel) => rel >= 0 && rel <= 50 ? (D.START[c] + rel) % 52 : -1;
D.safe = (a) => a % 13 === 0 || a % 13 === 8;
/* ais: array of booleans (true = phone), 2 to 4 entries. */
D.newGame = function (ais) {
  const seats = D.seats(ais.length);
  return { pl: ais.map((ai, i) => ({ c: seats[i], ai: !!ai })), tok: ais.map(() => [-1, -1, -1, -1]), turn: 0, die: 0, rolled: false, sixes: 0, order: [], over: false };
};
D.valid = function (st) {
  try {
    if (!st || !Array.isArray(st.pl) || st.pl.length < 2 || st.pl.length > 4 || st.tok.length !== st.pl.length) return false;
    if (!st.pl.every((p) => p && p.c >= 0 && p.c <= 3) || !st.tok.every((t) => t.length === 4 && t.every((r) => Number.isInteger(r) && r >= -1 && r <= 56))) return false;
    return st.turn >= 0 && st.turn < st.pl.length && Array.isArray(st.order);
  } catch (e) { return false; }
};
D.legal = function (st, die) {
  const out = [];
  st.tok[st.turn].forEach((r, t) => {
    if (r === -1) { if (die === 6) out.push(t); }
    else if (r < 56 && r + die <= 56) out.push(t);
  });
  return out;
};
D.advance = function (st) {
  const n = st.pl.length;
  for (let i = 1; i <= n; i++) { const q = (st.turn + i) % n; if (!st.order.includes(q)) { st.turn = q; break; } }
  st.rolled = false; st.die = 0; st.sixes = 0;
};
/* Roll the die for the current player. Returns {v, forfeit}; a third six in a row forfeits the turn (the turn passes). */
D.roll = function (st, rf) {
  rf = rf || rnd;
  const v = rf(6) + 1;
  st.die = v; st.rolled = true;
  if (v === 6) st.sixes++;
  if (st.sixes >= 3) { D.advance(st); return { v, forfeit: true }; }
  return { v, forfeit: false };
};
/* Move token t of the current player by die. Returns {captured: [[player, token]], finished, to}. Does not pass the turn. */
D.move = function (st, t, die) {
  const p = st.turn, c = st.pl[p].c, r = st.tok[p][t], nr = r === -1 ? 0 : r + die;
  st.tok[p][t] = nr;
  const captured = [];
  if (nr <= 50) {
    const a = D.abs(c, nr);
    if (!D.safe(a)) st.pl.forEach((q, qi) => {
      if (qi === p) return;
      st.tok[qi].forEach((rr, u) => { if (rr >= 0 && rr <= 50 && D.abs(q.c, rr) === a) { st.tok[qi][u] = -1; captured.push([qi, u]); } });
    });
  }
  const finished = nr === 56;
  if (finished && st.tok[p].every((x) => x === 56)) {
    st.order.push(p);
    if (st.order.length >= st.pl.length - 1) {
      for (let i = 0; i < st.pl.length; i++) if (!st.order.includes(i)) st.order.push(i);
      st.over = true;
    }
  }
  return { captured, finished, to: nr };
};
/* After a move: a six gives the same player another roll, otherwise the next player. */
D.afterMove = function (st, die) {
  if (st.over) return;
  if (die === 6 && !st.order.includes(st.turn)) { st.rolled = false; st.die = 0; } else D.advance(st);
};
/* Is a loop square threatened by an opponent token 1..6 squares behind it? */
D.threat = function (st, p, a) {
  if (a < 0 || D.safe(a)) return false;
  for (let q = 0; q < st.pl.length; q++) {
    if (q === p) continue;
    for (const r of st.tok[q]) {
      if (r < 0 || r > 50) continue;
      const d = (a - D.abs(st.pl[q].c, r) + 52) % 52;
      if (d >= 1 && d <= 6 && r + d <= 50) return true;
    }
  }
  return false;
};
/* The phone's choice among the legal tokens. */
D.aiPick = function (st, die, legal) {
  const p = st.turn, c = st.pl[p].c;
  let best = legal[0], bs = -Infinity;
  for (const t of legal) {
    const r = st.tok[p][t], nr = r === -1 ? 0 : r + die, a = D.abs(c, nr), cur = D.abs(c, r);
    let s = nr * 0.15 + Math.random() * 2;
    if (nr === 56) s += 100;
    else if (nr > 50) s += 12;
    if (r === -1) s += 30;
    if (a >= 0) {
      if (D.safe(a)) s += 14;
      else {
        if (D.threat(st, p, a)) s -= 18;
        for (let q = 0; q < st.pl.length; q++) if (q !== p) st.tok[q].forEach((rr) => { if (rr >= 0 && rr <= 50 && D.abs(st.pl[q].c, rr) === a) s += 55; });
      }
    }
    if (cur >= 0 && D.threat(st, p, cur)) s += 16;
    if (s > bs) { bs = s; best = t; }
  }
  return best;
};

D.PATH = [[1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0], [7, 0], [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
  [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6], [14, 7], [14, 8], [13, 8], [12, 8], [11, 8], [10, 8], [9, 8], [8, 9], [8, 10], [8, 11], [8, 12], [8, 13],
  [8, 14], [7, 14], [6, 14], [6, 13], [6, 12], [6, 11], [6, 10], [6, 9], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8], [0, 7], [0, 6]];
D.YARD = [[0, 0], [9, 0], [9, 9], [0, 9]];
D.LANE = [(k) => [k, 7], (k) => [7, k], (k) => [14 - k, 7], (k) => [7, 14 - k]];
/* Centre of the cell (in board units, 15 x 15) where token t of colour c with progress rel sits. */
D.xy = function (c, rel, t) {
  if (rel === -1) return [D.YARD[c][0] + (t % 2 ? 4.2 : 1.8), D.YARD[c][1] + (t > 1 ? 4.2 : 1.8)];
  if (rel <= 50) { const q = D.PATH[D.abs(c, rel)]; return [q[0] + 0.5, q[1] + 0.5]; }
  if (rel <= 55) { const q = D.LANE[c](rel - 50); return [q[0] + 0.5, q[1] + 0.5]; }
  const o = [[-0.7, 0], [0, -0.7], [0.7, 0], [0, 0.7]][c];
  return [7.5 + o[0], 7.5 + o[1]];
};

function ludo(el) {
  const COL = ['#e53935', '#43a047', '#f9a825', '#1e88e5'], LET = ['R', 'G', 'Y', 'B'];
  const cfg = Object.assign({ n: 4, ai: [false, true, true, true], played: 0, wins: 0 }, sget('fun3.ludo', {}));
  let st = sget('ludo.game', null);
  if (!D.valid(st)) st = null;
  let timers = [], busy = false, anim = null, message = '', legal = [], rollTimer = null, recorded = !!(st && st.over);
  const later = (fn, ms) => { const t = setTimeout(() => { timers = timers.filter((x) => x !== t); fn(); }, ms); timers.push(t); };
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; if (rollTimer) { clearInterval(rollTimer); rollTimer = null; } };
  const nm = (p) => D.COLORS[st.pl[p].c] + (st.pl[p].ai ? ' (phone)' : '');
  const seatOpts = (v) => '<option value="0"' + (v ? '' : ' selected') + '>Human</option><option value="1"' + (v ? ' selected' : '') + '>Phone</option>';
  el.innerHTML = `<div id="setup">
    <div class="card"><label class="f">Players
      <select id="n" aria-label="Number of players"><option value="2">2 players</option><option value="3">3 players</option><option value="4">4 players</option></select></label>
      ${[0, 1, 2, 3].map((i) => `<label class="f" id="sl${i}">Player ${i + 1}<select id="s${i}" aria-label="Player ${i + 1} type">${seatOpts(cfg.ai[i])}</select></label>`).join('')}
      <button class="btn" id="start" style="margin-top:10px;min-height:48px">Start game</button>
    </div>
    <div class="muted center" id="lstats"></div>
  </div>
  <div id="game" style="display:none">
    <div class="row" style="align-items:center;margin-bottom:6px">
      <div class="mid" id="msg" role="status" style="flex:3;min-height:44px"></div>
      <button class="btn alt" id="menu" style="min-height:44px">New game</button>
    </div>
    <div style="position:relative"><svg id="bd" viewBox="0 0 15 15" style="width:100%;height:auto;display:block;touch-action:manipulation" role="img" aria-label="Ludo board"></svg></div>
    <div class="row" style="margin-top:8px;align-items:center">
      <div id="die" class="center" style="font-size:54px;line-height:1;flex:1" aria-live="polite"></div>
      <button class="btn" id="roll" style="min-height:52px;flex:2">🎲 Roll dice</button>
    </div>
    <div class="muted center" id="rank" style="margin-top:8px"></div>
  </div>`;
  const svg = $('#bd', el), msgEl = $('#msg', el);
  $('#n', el).value = String(cfg.n);
  function seatLabels() {
    const n = +$('#n', el).value, seats = D.seats(n);
    for (let i = 0; i < 4; i++) {
      const lab = $('#sl' + i, el); lab.style.display = i < n ? '' : 'none';
      if (i < n) lab.firstChild.textContent = 'Player ' + (i + 1) + ' (' + D.COLORS[seats[i]] + ')';
    }
  }
  $('#n', el).onchange = seatLabels; seatLabels();
  $('#lstats', el).textContent = cfg.played ? 'Games finished ' + cfg.played + '   Won by a human player ' + cfg.wins : '';

  function save() { sset('ludo.game', st); }
  function say(t) { message = t; msgEl.textContent = t; }
  function board() {
    let o = '<rect width="15" height="15" fill="var(--surface)"/>';
    for (let c = 0; c < 4; c++) {
      const y = D.YARD[c];
      o += '<rect x="' + y[0] + '" y="' + y[1] + '" width="6" height="6" fill="' + COL[c] + '" opacity="0.4" stroke="var(--line)" stroke-width="0.05"/>';
      o += '<rect x="' + (y[0] + 0.9) + '" y="' + (y[1] + 0.9) + '" width="4.2" height="4.2" rx="0.5" fill="var(--surface)" opacity="0.9"/>';
      for (let t = 0; t < 4; t++) { const p = D.xy(c, -1, t); o += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="0.42" fill="none" stroke="' + COL[c] + '" stroke-width="0.08" opacity="0.7"/>'; }
    }
    for (let a = 0; a < 52; a++) {
      const q = D.PATH[a], sc = D.START.indexOf(a);
      o += '<rect x="' + q[0] + '" y="' + q[1] + '" width="1" height="1" fill="' + (sc >= 0 ? COL[sc] : 'var(--surface)') + '"' + (sc >= 0 ? ' opacity="0.85"' : '') + ' stroke="var(--line)" stroke-width="0.05"/>';
      if (a % 13 === 8) o += '<text x="' + (q[0] + 0.5) + '" y="' + (q[1] + 0.75) + '" text-anchor="middle" font-size="0.8" fill="var(--muted)">★</text>';
      if (sc >= 0) o += '<text x="' + (q[0] + 0.5) + '" y="' + (q[1] + 0.72) + '" text-anchor="middle" font-size="0.6" fill="#fff">▶</text>';
    }
    for (let c = 0; c < 4; c++) for (let k = 1; k <= 5; k++) { const q = D.LANE[c](k); o += '<rect x="' + q[0] + '" y="' + q[1] + '" width="1" height="1" fill="' + COL[c] + '" opacity="0.6" stroke="var(--line)" stroke-width="0.05"/>'; }
    o += '<polygon points="6,6 7.5,7.5 6,9" fill="' + COL[0] + '"/><polygon points="6,6 9,6 7.5,7.5" fill="' + COL[1] + '"/><polygon points="9,6 9,9 7.5,7.5" fill="' + COL[2] + '"/><polygon points="6,9 9,9 7.5,7.5" fill="' + COL[3] + '"/>';
    return o;
  }
  const BOARD = board();
  function draw() {
    let o = BOARD;
    if (st) {
      const groups = {};
      st.tok.forEach((tk, p) => tk.forEach((r, t) => {
        const rr = anim && anim.p === p && anim.t === t ? anim.rel : r, pos = D.xy(st.pl[p].c, rr, t);
        (groups[pos[0] + ',' + pos[1]] = groups[pos[0] + ',' + pos[1]] || []).push({ p, t, pos, r: rr });
      }));
      Object.keys(groups).forEach((k) => {
        const g = groups[k], n = g.length;
        g.forEach((it, i) => {
          const off = n === 1 ? [0, 0] : [Math.cos(i * 6.28 / n) * 0.22, Math.sin(i * 6.28 / n) * 0.22], rad = n === 1 ? 0.36 : 0.28;
          const c = st.pl[it.p].c, can = !busy && st.rolled && it.p === st.turn && !st.pl[st.turn].ai && legal.includes(it.t);
          o += '<g data-t="' + it.p + ',' + it.t + '"' + (can ? ' style="cursor:pointer"' : '') + '><circle cx="' + (it.pos[0] + off[0]) + '" cy="' + (it.pos[1] + off[1]) + '" r="' + rad + '" fill="' + COL[c] + '" stroke="#111" stroke-width="0.07"/>' +
            '<text x="' + (it.pos[0] + off[0]) + '" y="' + (it.pos[1] + off[1] + rad * 0.36) + '" text-anchor="middle" font-size="' + rad * 0.95 + '" font-weight="700" fill="#111" pointer-events="none">' + LET[c] + '</text>' +
            (can ? '<circle cx="' + (it.pos[0] + off[0]) + '" cy="' + (it.pos[1] + off[1]) + '" r="' + (rad + 0.12) + '" fill="none" stroke="var(--text)" stroke-width="0.1" stroke-dasharray="0.25 0.15"><animate attributeName="r" values="' + (rad + 0.08) + ';' + (rad + 0.2) + ';' + (rad + 0.08) + '" dur="0.9s" repeatCount="indefinite"/></circle>' : '') + '</g>';
        });
      });
    }
    svg.innerHTML = o;
    if (!st) return;
    const human = !st.pl[st.turn].ai;
    $('#roll', el).style.display = !st.over && !st.rolled && human && !busy ? '' : 'none';
    $('#die', el).textContent = st.die ? DIE[st.die] : '';
    msgEl.textContent = message || (st.over ? 'Game over' : nm(st.turn) + (st.rolled ? ': move a token' : ': roll the dice'));
    $('#rank', el).textContent = st.order.length ? 'Places: ' + st.order.map((p, i) => (i + 1) + '. ' + D.COLORS[st.pl[p].c]).join('   ') : '';
  }
  function showGame() { $('#setup', el).style.display = 'none'; $('#game', el).style.display = ''; draw(); next(); }
  function finish() {
    clearTimers(); save();
    if (!recorded) {
      recorded = true; cfg.played++;
      if (!st.pl[st.order[0]].ai) cfg.wins++;
      sset('fun3.ludo', cfg);
    }
    say('🏆 ' + D.COLORS[st.pl[st.order[0]].c] + ' wins!');
    draw();
    confetti(svg.parentNode);
  }
  function endOfAction() {
    save(); legal = []; message = '';
    if (st.over) { finish(); return; }
    draw(); next();
  }
  function next() {
    clearTimers();
    if (!st || st.over) { if (st && st.over) finish(); return; }
    const p = st.turn;
    if (!st.rolled) { legal = []; draw(); if (st.pl[p].ai) later(roll, 800); return; }
    legal = D.legal(st, st.die);
    if (!legal.length) { later(() => { D.advance(st); endOfAction(); }, 700); return; }
    afterRoll();
  }
  function afterRoll() {
    const p = st.turn;
    draw();
    if (st.pl[p].ai) { later(() => doMove(D.aiPick(st, st.die, legal)), 800); return; }
    const rels = new Set(legal.map((t) => st.tok[p][t]));
    if (rels.size === 1) later(() => doMove(legal[0]), 450); // all choices are identical: move automatically
  }
  function roll() {
    if (!st || st.over || st.rolled || busy) return;
    busy = true; const dieEl = $('#die', el); let n = 0;
    $('#roll', el).style.display = 'none';
    rollTimer = setInterval(() => {
      dieEl.textContent = DIE[1 + rnd(6)];
      if (++n < 8) return;
      clearInterval(rollTimer); rollTimer = null; busy = false;
      const who = st.turn, r = D.roll(st);
      save();
      if (r.forfeit) { say(D.COLORS[st.pl[who].c] + ' rolled three sixes: turn lost.'); dieEl.textContent = DIE[r.v]; later(() => { message = ''; draw(); next(); }, 1400); return; }
      legal = D.legal(st, r.v);
      if (!legal.length) { say(D.COLORS[st.pl[who].c] + ' rolled ' + r.v + ': no move.'); draw(); later(() => { D.advance(st); endOfAction(); }, 1100); return; }
      message = ''; afterRoll();
    }, 70);
    timers.push(rollTimer);
  }
  function doMove(t) {
    if (busy || !st || st.over || !st.rolled || !legal.includes(t)) return;
    busy = true;
    const p = st.turn, die = st.die, from = st.tok[p][t];
    const res = D.move(st, t, die);
    const steps = []; for (let r = from === -1 ? 0 : from + 1; r <= res.to; r++) steps.push(r);
    const nameP = D.COLORS[st.pl[p].c];
    const hop = (i) => {
      if (i >= steps.length) {
        anim = null; busy = false;
        D.afterMove(st, die);
        if (res.captured.length) say(nameP + ' sent ' + res.captured.length + ' token' + (res.captured.length > 1 ? 's' : '') + ' home!');
        else if (res.finished) say(nameP + ' got a token home!');
        save(); legal = [];
        if (st.over) { finish(); return; }
        draw(); const keep = message; later(() => { if (message === keep) message = ''; draw(); }, 1500);
        next(); return;
      }
      anim = { p, t, rel: steps[i] }; draw(); later(() => hop(i + 1), 130);
    };
    hop(0);
  }
  svg.addEventListener('click', (e) => {
    const g = e.target.closest ? e.target.closest('[data-t]') : null; if (!g || !st || busy) return;
    const [p, t] = g.getAttribute('data-t').split(',').map(Number);
    if (p === st.turn && !st.pl[p].ai) doMove(t);
  });
  $('#roll', el).onclick = () => { if (st && !st.pl[st.turn].ai) roll(); };
  $('#start', el).onclick = () => {
    const n = Math.min(4, Math.max(2, +$('#n', el).value || 4));
    cfg.n = n; cfg.ai = [0, 1, 2, 3].map((i) => $('#s' + i, el).value === '1');
    const ais = cfg.ai.slice(0, n);
    sset('fun3.ludo', cfg);
    clearTimers(); busy = false; anim = null; message = ''; legal = [];
    st = D.newGame(ais); recorded = false; save(); showGame();
  };
  $('#menu', el).onclick = () => {
    clearTimers(); busy = false; anim = null; st = null; sset('ludo.game', null);
    $('#game', el).style.display = 'none'; $('#setup', el).style.display = '';
    $('#lstats', el).textContent = cfg.played ? 'Games finished ' + cfg.played + '   Won by a human player ' + cfg.wins : '';
  };
  if (st) showGame();
  return () => { clearTimers(); if (st) save(); };
}

if (typeof Tools !== 'undefined') Tools.register({
  id: 'ludo', name: 'Ludo', icon: '🏠', cat: 'fun',
  desc: 'Ludo for 2 to 4 players, any mix of people and phone players: six to leave home, captures, safe squares and an exact roll to finish.',
  keys: ['board game', 'dice', 'parcheesi', 'pachisi', 'family'], needs: ['storage'], pro: false, render: ludo
});
/* =====================================================================
   4. SNAKES AND LADDERS
   10 x 10 board, squares 1..100 in the usual zigzag. 8 ladders and 8 snakes (fixed). Rules: one die, no extra turn on a six,
   and you must finish on exactly 100: a roll that goes past 100 bounces you back by the surplus (then a snake or ladder there still applies).
   ===================================================================== */
const N = {};
L.N = N;
N.LADDERS = { 4: 14, 9: 31, 20: 38, 28: 84, 40: 59, 51: 67, 63: 81, 71: 91 };
N.SNAKES = { 17: 7, 54: 34, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 99: 78 };
N.jump = (n) => N.LADDERS[n] || N.SNAKES[n] || n;
/* Where a roll takes a token: {land: square after moving/bouncing, to: after any snake or ladder, kind} */
N.step = function (pos, d) {
  let land = pos + d;
  if (land > 100) land = 200 - land;
  const to = N.jump(land);
  return { land, to, kind: to > land ? 'ladder' : to < land ? 'snake' : null };
};
N.rc = function (n) { const row = Math.floor((n - 1) / 10), k = (n - 1) % 10; return { row, col: row % 2 === 0 ? k : 9 - k }; };
N.newGame = (ais) => ({ pos: ais.map(() => 0), ai: ais.map((a) => !!a), turn: 0, die: 0, winner: -1, rolls: 0 });
N.valid = (st) => !!st && Array.isArray(st.pos) && st.pos.length >= 2 && st.pos.length <= 4 && st.pos.every((p) => Number.isInteger(p) && p >= 0 && p <= 100) &&
  Array.isArray(st.ai) && st.ai.length === st.pos.length && st.turn >= 0 && st.turn < st.pos.length;
/* Plays a roll for the current player and passes the turn. Returns the step info plus the path of squares the token hops through. */
N.play = function (st, d) {
  const p = st.turn, from = st.pos[p], r = N.step(from, d), path = [];
  for (let i = 1; i <= d; i++) { let s = from + i; if (s > 100) s = 200 - s; path.push(s); }
  st.pos[p] = r.to; st.die = d; st.rolls++;
  if (r.to === 100) st.winner = p; else st.turn = (p + 1) % st.pos.length;
  return { from, land: r.land, to: r.to, kind: r.kind, path };
};

function snakes(el) {
  const COL = ['#e53935', '#1e88e5', '#43a047', '#f9a825'], NAMES = ['Red', 'Blue', 'Green', 'Yellow'];
  const cfg = Object.assign({ n: 2, ai: [false, true, true, true], played: 0, wins: 0 }, sget('fun3.snakesladders', {}));
  let st = sget('snakesladders.game', null);
  if (!N.valid(st)) st = null;
  let timers = [], busy = false, anim = null, message = '', rollTimer = null, recorded = !!(st && st.winner >= 0);
  const later = (fn, ms) => { const t = setTimeout(() => { timers = timers.filter((x) => x !== t); fn(); }, ms); timers.push(t); };
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; if (rollTimer) { clearInterval(rollTimer); rollTimer = null; } };
  const nm = (p) => NAMES[p] + (st.ai[p] ? ' (phone)' : '');
  const seatOpts = (v) => '<option value="0"' + (v ? '' : ' selected') + '>Human</option><option value="1"' + (v ? ' selected' : '') + '>Phone</option>';
  el.innerHTML = `<div id="setup">
    <div class="card"><label class="f">Players
      <select id="n" aria-label="Number of players"><option value="2">2 players</option><option value="3">3 players</option><option value="4">4 players</option></select></label>
      ${[0, 1, 2, 3].map((i) => `<label class="f" id="sl${i}">${NAMES[i]}<select id="s${i}" aria-label="${NAMES[i]} player type">${seatOpts(cfg.ai[i])}</select></label>`).join('')}
      <button class="btn" id="start" style="margin-top:10px;min-height:48px">Start game</button>
      <div class="muted" style="margin-top:8px">Ladders climb, snakes slide you down. Finish on exactly 100: a roll that goes past bounces you back.</div>
    </div>
    <div class="muted center" id="lstats"></div>
  </div>
  <div id="game" style="display:none">
    <div class="row" style="align-items:center;margin-bottom:6px">
      <div class="mid" id="msg" role="status" style="flex:3;min-height:44px"></div>
      <button class="btn alt" id="menu" style="min-height:44px">New game</button>
    </div>
    <div style="position:relative"><svg id="bd" viewBox="0 0 100 108" style="width:100%;height:auto;display:block" role="img" aria-label="Snakes and ladders board"></svg></div>
    <div class="row" style="margin-top:8px;align-items:center">
      <div id="die" class="center" style="font-size:54px;line-height:1;flex:1" aria-live="polite"></div>
      <button class="btn" id="roll" style="min-height:52px;flex:2">🎲 Roll dice</button>
    </div>
    <div class="muted center" id="where" style="margin-top:8px"></div>
  </div>`;
  const svg = $('#bd', el), msgEl = $('#msg', el);
  $('#n', el).value = String(cfg.n);
  function seatLabels() { const n = +$('#n', el).value; for (let i = 0; i < 4; i++) $('#sl' + i, el).style.display = i < n ? '' : 'none'; }
  $('#n', el).onchange = seatLabels; seatLabels();
  const lstats = () => { $('#lstats', el).textContent = cfg.played ? 'Games finished ' + cfg.played + '   Won by a human player ' + cfg.wins : ''; };
  lstats();
  const cx = (n) => N.rc(n).col * 10 + 5, cy = (n) => (9 - N.rc(n).row) * 10 + 5;

  function boardSvg() {
    let o = '';
    for (let n = 1; n <= 100; n++) {
      const q = N.rc(n), x = q.col * 10, y = (9 - q.row) * 10;
      o += '<rect x="' + x + '" y="' + y + '" width="10" height="10" fill="' + ((q.row + q.col) % 2 ? 'var(--surface2)' : 'var(--surface)') + '" stroke="var(--line)" stroke-width="0.15"/>' +
        '<text x="' + (x + 1) + '" y="' + (y + 3.2) + '" font-size="2.6" fill="var(--muted)">' + n + '</text>';
    }
    Object.keys(N.LADDERS).forEach((a) => {
      const x1 = cx(+a), y1 = cy(+a), x2 = cx(N.LADDERS[a]), y2 = cy(N.LADDERS[a]), dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, px = -dy / len * 1.5, py = dx / len * 1.5;
      o += '<g stroke="#8d6e63" stroke-width="0.8" stroke-linecap="round" opacity="0.95"><line x1="' + (x1 + px) + '" y1="' + (y1 + py) + '" x2="' + (x2 + px) + '" y2="' + (y2 + py) + '"/><line x1="' + (x1 - px) + '" y1="' + (y1 - py) + '" x2="' + (x2 - px) + '" y2="' + (y2 - py) + '"/>';
      for (let k = 1; k * 6 < len; k++) { const f = k * 6 / len; o += '<line x1="' + (x1 + dx * f + px) + '" y1="' + (y1 + dy * f + py) + '" x2="' + (x1 + dx * f - px) + '" y2="' + (y1 + dy * f - py) + '"/>'; }
      o += '</g>';
    });
    const SC = ['#d81b60', '#8e24aa', '#ef6c00', '#00897b'];
    Object.keys(N.SNAKES).forEach((a, i) => {
      const h = +a, t = N.SNAKES[a], x1 = cx(h), y1 = cy(h), x2 = cx(t), y2 = cy(t), dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, px = -dy / len * 6, py = dx / len * 6;
      const col = SC[i % 4];
      o += '<path d="M' + x1 + ' ' + y1 + ' Q' + (x1 + dx * 0.25 + px) + ' ' + (y1 + dy * 0.25 + py) + ' ' + (x1 + dx * 0.5) + ' ' + (y1 + dy * 0.5) + ' T' + x2 + ' ' + y2 + '" fill="none" stroke="' + col + '" stroke-width="2.2" stroke-linecap="round" opacity="0.8"/>' +
        '<circle cx="' + x1 + '" cy="' + y1 + '" r="2.3" fill="' + col + '"/><circle cx="' + (x1 - 0.8) + '" cy="' + (y1 - 0.6) + '" r="0.5" fill="#fff"/><circle cx="' + (x1 + 0.8) + '" cy="' + (y1 - 0.6) + '" r="0.5" fill="#fff"/>';
    });
    return o;
  }
  const BOARD = boardSvg();
  function draw() {
    let o = BOARD;
    if (st) {
      const groups = {};
      st.pos.forEach((p, i) => { const sq = anim && anim.p === i ? anim.sq : p; (groups[sq] = groups[sq] || []).push(i); });
      Object.keys(groups).forEach((k) => {
        const g = groups[k], sq = +k;
        g.forEach((p, i) => {
          let x, y;
          if (sq === 0) { x = 5 + p * 8; y = 104; }
          else { const n = g.length, off = n === 1 ? [0, 0] : [(i % 2) * 5 - 2.5, Math.floor(i / 2) * 5 - 1.8]; x = cx(sq) + off[0]; y = cy(sq) + off[1] + 1; }
          o += '<circle cx="' + x + '" cy="' + y + '" r="2.6" fill="' + COL[p] + '" stroke="' + (p === st.turn && st.winner < 0 ? 'var(--text)' : '#111') + '" stroke-width="' + (p === st.turn && st.winner < 0 ? 0.9 : 0.4) + '"/>' +
            '<text x="' + x + '" y="' + (y + 1.1) + '" text-anchor="middle" font-size="3" font-weight="700" fill="#111">' + (p + 1) + '</text>';
        });
      });
      o += '<text x="50" y="104.5" text-anchor="middle" font-size="3" fill="var(--muted)">Start area</text>';
    }
    svg.innerHTML = o;
    if (!st) return;
    $('#roll', el).style.display = st.winner < 0 && !st.ai[st.turn] && !busy ? '' : 'none';
    $('#die', el).textContent = st.die ? DIE[st.die] : '';
    msgEl.textContent = message || (st.winner >= 0 ? NAMES[st.winner] + ' wins!' : nm(st.turn) + ': roll the dice');
    $('#where', el).textContent = st.pos.map((p, i) => NAMES[i] + ' ' + (p || 'start')).join('   ');
  }
  function save() { sset('snakesladders.game', st); }
  function say(t) { message = t; msgEl.textContent = t; }
  function showGame() { $('#setup', el).style.display = 'none'; $('#game', el).style.display = ''; draw(); next(); }
  function finish() {
    clearTimers(); save();
    if (!recorded) { recorded = true; cfg.played++; if (!st.ai[st.winner]) cfg.wins++; sset('fun3.snakesladders', cfg); }
    say('🏆 ' + nm(st.winner) + ' wins!'); draw(); confetti(svg.parentNode);
  }
  function next() {
    clearTimers();
    if (!st) return;
    if (st.winner >= 0) { finish(); return; }
    draw();
    if (st.ai[st.turn]) later(roll, 900);
  }
  function roll() {
    if (!st || st.winner >= 0 || busy) return;
    busy = true; const dieEl = $('#die', el); let n = 0;
    $('#roll', el).style.display = 'none';
    rollTimer = setInterval(() => {
      dieEl.textContent = DIE[1 + rnd(6)];
      if (++n < 8) return;
      clearInterval(rollTimer); rollTimer = null;
      move(1 + rnd(6));
    }, 70);
    timers.push(rollTimer);
  }
  function move(d) {
    const p = st.turn, r = N.play(st, d);
    message = ''; $('#die', el).textContent = DIE[d];
    const seq = r.path.map((s) => [s, 160]);
    if (r.to !== r.land) seq.push([r.to, 650]);
    const hop = (i) => {
      if (i >= seq.length) {
        anim = null; busy = false; save();
        const info = r.kind === 'ladder' ? NAMES[p] + ' climbs a ladder to ' + r.to + '!' : r.kind === 'snake' ? NAMES[p] + ' slides down a snake to ' + r.to + '.' : '';
        const bounced = d > 0 && r.from + d > 100;
        if (st.winner >= 0) { finish(); return; }
        message = info || (bounced ? NAMES[p] + ' bounced back from 100.' : '');
        next();
        if (message) { const keep = message; later(() => { if (message === keep) { message = ''; draw(); } }, 1600); }
        return;
      }
      anim = { p, sq: seq[i][0] }; draw();
      later(() => hop(i + 1), seq[i][1]);
    };
    hop(0);
  }
  $('#roll', el).onclick = () => { if (st && !st.ai[st.turn]) roll(); };
  $('#start', el).onclick = () => {
    const n = Math.min(4, Math.max(2, +$('#n', el).value || 2));
    cfg.n = n; cfg.ai = [0, 1, 2, 3].map((i) => $('#s' + i, el).value === '1');
    sset('fun3.snakesladders', cfg);
    clearTimers(); busy = false; anim = null; message = '';
    st = N.newGame(cfg.ai.slice(0, n)); recorded = false; save(); showGame();
  };
  $('#menu', el).onclick = () => {
    clearTimers(); busy = false; anim = null; st = null; sset('snakesladders.game', null);
    $('#game', el).style.display = 'none'; $('#setup', el).style.display = ''; lstats();
  };
  if (st) showGame();
  return () => { clearTimers(); if (st) save(); };
}

if (typeof Tools !== 'undefined') Tools.register({
  id: 'snakesladders', name: 'Snakes & Ladders', icon: '🪜', cat: 'fun',
  desc: 'Snakes and Ladders for 2 to 4 players, people or phone, with an animated die and hopping tokens. Finish on exactly 100.',
  keys: ['board game', 'dice', 'ladders', 'snakes', 'family'], needs: ['storage'], pro: false, render: snakes
});

if (typeof module !== 'undefined' && module.exports) module.exports = L;
})();
