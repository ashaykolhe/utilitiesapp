'use strict';
/* PocketKit "Fun" category: games and party tools. Everything lives inside one IIFE so no globals leak.
   The pure game logic is the object L (exported for the Node tests at the very bottom). */
(function () {

/* ---------- random helpers ---------- */
function rnd(n) {
  if (n <= 1) return 0;
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
  if (!c || !c.getRandomValues) return Math.floor(Math.random() * n);
  const a = new Uint32Array(1), lim = Math.floor(4294967296 / n) * n;
  let x;
  do { c.getRandomValues(a); x = a[0]; } while (x >= lim);
  return x % n;
}
const pick = (arr) => arr[rnd(arr.length)];
function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}

/* ---------- pure game logic ---------- */
const L = {};

/* Tic-tac-toe: perfect minimax with alpha-beta. board = array of 9 (null | 'X' | 'O'). */
const TTT_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
L.tttWin = function (b) {
  for (const l of TTT_LINES) if (b[l[0]] && b[l[0]] === b[l[1]] && b[l[0]] === b[l[2]]) return { w: b[l[0]], line: l };
  return b.every(Boolean) ? { w: 'draw', line: null } : null;
};
function tttScore(b, turn, me, depth, alpha, beta) {
  const r = L.tttWin(b);
  if (r) return r.w === me ? 10 - depth : r.w === 'draw' ? 0 : depth - 10;
  const other = me === 'X' ? 'O' : 'X', max = turn === me;
  let best = max ? -99 : 99;
  for (let i = 0; i < 9; i++) {
    if (b[i]) continue;
    b[i] = turn;
    const s = tttScore(b, turn === me ? other : me, me, depth + 1, alpha, beta);
    b[i] = null;
    if (max) { if (s > best) best = s; if (best > alpha) alpha = best; } else { if (s < best) best = s; if (best < beta) beta = best; }
    if (beta <= alpha) break;
  }
  return best;
}
L.tttBestAll = function (b, me) {
  const other = me === 'X' ? 'O' : 'X';
  let bestS = -99, moves = [];
  for (let i = 0; i < 9; i++) {
    if (b[i]) continue;
    b[i] = me;
    const s = tttScore(b, other, me, 1, -99, 99);
    b[i] = null;
    if (s > bestS) { bestS = s; moves = [i]; } else if (s === bestS) moves.push(i);
  }
  return moves;
};
L.tttBest = (b, me) => pick(L.tttBestAll(b, me));

/* 2048. Board is a flat array of 16. dir: 0 up, 1 right, 2 down, 3 left. */
L.slideLine = function (vals) {
  const out = [0, 0, 0, 0], merged = [false, false, false, false], moves = [];
  let w = 0, score = 0;
  for (let i = 0; i < 4; i++) {
    const v = vals[i];
    if (!v) continue;
    if (w > 0 && out[w - 1] === v && !merged[w - 1]) {
      out[w - 1] = v * 2; merged[w - 1] = true; score += v * 2; moves.push({ from: i, to: w - 1 });
    } else { out[w] = v; moves.push({ from: i, to: w }); w++; }
  }
  return { out, score, moves };
};
L.g2048Lines = function (dir) {
  const lines = [];
  for (let k = 0; k < 4; k++) {
    const l = [];
    for (let j = 0; j < 4; j++) {
      const a = dir === 3 ? j : dir === 1 ? 3 - j : null;
      if (dir === 3 || dir === 1) l.push(k * 4 + a); else l.push((dir === 0 ? j : 3 - j) * 4 + k);
    }
    lines.push(l);
  }
  return lines;
};
L.move2048 = function (board, dir) {
  const nb = new Array(16).fill(0), moves = [];
  let score = 0, moved = false;
  for (const idx of L.g2048Lines(dir)) {
    const r = L.slideLine(idx.map(i => board[i]));
    r.out.forEach((v, j) => { nb[idx[j]] = v; });
    score += r.score;
    r.moves.forEach(m => { moves.push({ from: idx[m.from], to: idx[m.to] }); if (m.from !== m.to) moved = true; });
  }
  if (!moved) { for (let i = 0; i < 16; i++) if (nb[i] !== board[i]) moved = true; }
  return { board: nb, score, moved, moves };
};
L.add2048 = function (board) {
  const e = []; board.forEach((v, i) => { if (!v) e.push(i); });
  if (!e.length) return -1;
  const i = pick(e); board[i] = rnd(10) === 0 ? 4 : 2; return i;
};
L.canMove2048 = function (b) {
  if (b.some(v => !v)) return true;
  for (let d = 0; d < 4; d++) if (L.move2048(b, d).moved) return true;
  return false;
};

/* Sudoku: bitmask backtracking solver with the fewest-candidates heuristic. */
function sdkCands(g, i) {
  const r = (i / 9) | 0, c = i % 9, br = r - r % 3, bc = c - c % 3;
  let used = 0;
  for (let k = 0; k < 9; k++) { used |= 1 << g[r * 9 + k]; used |= 1 << g[k * 9 + c]; used |= 1 << g[(br + ((k / 3) | 0)) * 9 + bc + k % 3]; }
  return ~used & 0x3FE;
}
const pop = (m) => { let n = 0; while (m) { m &= m - 1; n++; } return n; };
L.sdkCount = function (g, limit) {
  g = g.slice(); let count = 0;
  (function rec() {
    let bi = -1, bm = 0, bc = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const m = sdkCands(g, i), n = pop(m);
      if (n < bc) { bc = n; bi = i; bm = m; if (n <= 1) break; }
    }
    if (bi < 0) { count++; return; }
    if (bc === 0) return;
    for (let d = 1; d <= 9 && count < limit; d++) if (bm & (1 << d)) { g[bi] = d; rec(); g[bi] = 0; }
  })();
  return count;
};
L.sdkFull = function () {
  const g = new Array(81).fill(0);
  (function rec() {
    let bi = -1, bm = 0, bc = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const m = sdkCands(g, i), n = pop(m);
      if (n < bc) { bc = n; bi = i; bm = m; if (n <= 1) break; }
    }
    if (bi < 0) return true;
    if (bc === 0) return false;
    for (const d of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) if (bm & (1 << d)) { g[bi] = d; if (rec()) return true; g[bi] = 0; }
    return false;
  })();
  return g;
};
/* Returns { puzzle, solution } with a unique solution and 81 - clues blanks (clues is a target; never fewer). */
L.sdkGen = function (clues) {
  const solution = L.sdkFull(), puzzle = solution.slice();
  let givens = 81;
  for (const i of shuffle([...Array(81).keys()])) {
    if (givens <= clues) break;
    const keep = puzzle[i]; puzzle[i] = 0;
    if (L.sdkCount(puzzle, 2) !== 1) puzzle[i] = keep; else givens--;
  }
  return { puzzle, solution };
};
L.sdkValid = function (g) {
  for (let u = 0; u < 9; u++) {
    let r = 0, c = 0, b = 0;
    for (let k = 0; k < 9; k++) {
      r |= 1 << g[u * 9 + k]; c |= 1 << g[k * 9 + u];
      b |= 1 << g[((((u / 3) | 0) * 3) + ((k / 3) | 0)) * 9 + (u % 3) * 3 + k % 3];
    }
    if (r !== 0x3FE || c !== 0x3FE || b !== 0x3FE) return false;
  }
  return true;
};
/* Indices of filled cells that clash with another filled cell in the same row, column or box. */
L.sdkConflicts = function (g) {
  const bad = new Set();
  for (let i = 0; i < 81; i++) {
    if (!g[i]) continue;
    const r = (i / 9) | 0, c = i % 9;
    for (let j = 0; j < 81; j++) {
      if (j === i || g[j] !== g[i]) continue;
      const r2 = (j / 9) | 0, c2 = j % 9;
      if (r === r2 || c === c2 || ((r / 3) | 0) === ((r2 / 3) | 0) && ((c / 3) | 0) === ((c2 / 3) | 0)) { bad.add(i); break; }
    }
  }
  return bad;
};

/* 15-puzzle / 8-puzzle. Tiles 1..n*n-1, 0 is the blank. */
L.slSolvable = function (t, n) {
  const a = t.filter(Boolean);
  let inv = 0;
  for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (a[i] > a[j]) inv++;
  if (n % 2 === 1) return inv % 2 === 0;
  const fromBottom = n - Math.floor(t.indexOf(0) / n);
  return (inv + fromBottom) % 2 === 1;
};
L.slMove = function (t, n, i) {
  const z = t.indexOf(0), r = (i / n) | 0, c = i % n, zr = (z / n) | 0, zc = z % n;
  if (Math.abs(r - zr) + Math.abs(c - zc) !== 1) return false;
  t[z] = t[i]; t[i] = 0; return true;
};
L.slSolved = (t) => t.every((v, i) => v === (i === t.length - 1 ? 0 : i + 1));
L.slShuffle = function (n) {
  const t = [...Array(n * n).keys()].slice(1).concat(0);
  let prev = -1;
  for (let k = 0; k < 80 * n || L.slSolved(t); k++) {
    const z = t.indexOf(0), r = (z / n) | 0, c = z % n, opts = [];
    if (r > 0) opts.push(z - n); if (r < n - 1) opts.push(z + n);
    if (c > 0) opts.push(z - 1); if (c < n - 1) opts.push(z + 1);
    const o = opts.filter(x => x !== prev), m = pick(o.length ? o : opts);
    prev = z; L.slMove(t, n, m);
  }
  return t;
};

/* Lights Out on an n x n board. */
L.loPress = function (g, n, i) {
  const r = (i / n) | 0, c = i % n;
  g[i] ^= 1;
  if (r > 0) g[i - n] ^= 1; if (r < n - 1) g[i + n] ^= 1;
  if (c > 0) g[i - 1] ^= 1; if (c < n - 1) g[i + 1] ^= 1;
};
L.loGen = function (n, presses) {
  for (;;) {
    const g = new Array(n * n).fill(0), cells = shuffle([...Array(n * n).keys()]).slice(0, presses);
    cells.forEach(i => L.loPress(g, n, i));
    if (g.some(Boolean)) return { grid: g, presses: cells };
  }
};

/* Minesweeper. */
L.msGen = function (w, h, mines, safe) {
  const forbid = new Set(), sr = (safe / w) | 0, sc = safe % w;
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const r = sr + dr, c = sc + dc;
    if (r >= 0 && r < h && c >= 0 && c < w) forbid.add(r * w + c);
  }
  const cand = [...Array(w * h).keys()].filter(i => !forbid.has(i));
  const mine = new Array(w * h).fill(0);
  shuffle(cand).slice(0, Math.min(mines, cand.length)).forEach(i => { mine[i] = 1; });
  const adj = mine.map((_, i) => {
    const r = (i / w) | 0, c = i % w; let n = 0;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc;
      if ((dr || dc) && rr >= 0 && rr < h && cc >= 0 && cc < w && mine[rr * w + cc]) n++;
    }
    return n;
  });
  return { mine, adj };
};
/* Reveals i (flood fill through zeros). `state` is an array: 0 hidden, 1 revealed, 2 flagged. Returns indices opened. */
L.msFlood = function (g, w, h, i, state) {
  const opened = [], stack = [i];
  while (stack.length) {
    const k = stack.pop();
    if (state[k] !== 0) continue;
    state[k] = 1; opened.push(k);
    if (g.adj[k] === 0 && !g.mine[k]) {
      const r = (k / w) | 0, c = k % w;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr, cc = c + dc;
        if ((dr || dc) && rr >= 0 && rr < h && cc >= 0 && cc < w) stack.push(rr * w + cc);
      }
    }
  }
  return opened;
};

/* Connect Four: 7 columns x 6 rows, index = row * 7 + col, row 0 is the top. */
const C4_WIN = [];
(function () {
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) {
    [[0, 1], [1, 0], [1, 1], [1, -1]].forEach(([dr, dc]) => {
      const er = r + 3 * dr, ec = c + 3 * dc;
      if (er < 6 && ec >= 0 && ec < 7) C4_WIN.push([0, 1, 2, 3].map(k => (r + k * dr) * 7 + c + k * dc));
    });
  }
})();
L.c4Drop = function (b, c, p) {
  for (let r = 5; r >= 0; r--) if (!b[r * 7 + c]) { b[r * 7 + c] = p; return r; }
  return -1;
};
L.c4Undo = function (b, c) {
  for (let r = 0; r < 6; r++) if (b[r * 7 + c]) { b[r * 7 + c] = 0; return; }
};
L.c4Win = function (b, p) {
  for (const w of C4_WIN) if (b[w[0]] === p && b[w[1]] === p && b[w[2]] === p && b[w[3]] === p) return w;
  return null;
};
function c4Eval(b, p) {
  const o = 3 - p; let s = 0;
  for (let r = 0; r < 6; r++) if (b[r * 7 + 3] === p) s += 3; else if (b[r * 7 + 3] === o) s -= 3;
  for (const w of C4_WIN) {
    let a = 0, e = 0, d = 0;
    for (const i of w) { if (b[i] === p) a++; else if (b[i] === o) d++; else e++; }
    if (a && d) continue;
    if (a === 3) s += 5; else if (a === 2 && e === 2) s += 2;
    if (d === 3) s -= 6; else if (d === 2 && e === 2) s -= 2;
  }
  return s;
}
const C4_ORDER = [3, 2, 4, 1, 5, 0, 6];
function c4Nega(b, depth, alpha, beta, p) {
  const o = 3 - p;
  if (L.c4Win(b, o)) return -(1000 + depth);
  if (depth === 0) return c4Eval(b, p);
  let best = -99999, any = false;
  for (const c of C4_ORDER) {
    if (L.c4Drop(b, c, p) < 0) continue;
    any = true;
    const s = -c4Nega(b, depth - 1, -beta, -alpha, o);
    L.c4Undo(b, c);
    if (s > best) best = s;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return any ? best : 0;
}
L.c4Best = function (b, p, depth) {
  let bestS = -999999, moves = [];
  for (const c of C4_ORDER) {
    if (L.c4Drop(b, c, p) < 0) continue;
    const s = L.c4Win(b, p) ? 5000 : -c4Nega(b, depth - 1, -999999, 999999, 3 - p);
    L.c4Undo(b, c);
    if (s > bestS) { bestS = s; moves = [c]; } else if (s === bestS) moves.push(c);
  }
  return pick(moves);
};

/* Misc */
L.makeTeams = function (names, k) {
  const teams = Array.from({ length: k }, () => []);
  shuffle(names).forEach((n, i) => teams[i % k].push(n));
  return teams;
};
L.pickUnique = (n, k) => shuffle([...Array(n).keys()].map(x => x + 1)).slice(0, k);
L.mathQ = function (lvl) {
  const op = pick(lvl === 1 ? ['+', '-'] : ['+', '-', '×']);
  let a, b;
  if (op === '×') { a = 2 + rnd(lvl === 2 ? 9 : 11); b = 2 + rnd(lvl === 2 ? 9 : 11); return { text: a + ' × ' + b, ans: a * b }; }
  const m = lvl === 1 ? 20 : lvl === 2 ? 99 : 499;
  a = 1 + rnd(m); b = 1 + rnd(m);
  if (op === '-') { if (b > a) { const t = a; a = b; b = t; } return { text: a + ' − ' + b, ans: a - b }; }
  return { text: a + ' + ' + b, ans: a + b };
};
L.hanoiMin = (n) => Math.pow(2, n) - 1;
L.hanoiMove = function (pegs, from, to) {
  const f = pegs[from], t = pegs[to];
  if (!f.length || from === to) return false;
  const d = f[f.length - 1];
  if (t.length && t[t.length - 1] < d) return false;
  t.push(f.pop()); return true;
};
L.scrambleWord = function (w) {
  if (new Set(w).size < 2) return w;
  let s;
  do { s = shuffle(w.split('')).join(''); } while (s === w);
  return s;
};

/* ---------- shared UI helpers ---------- */
const hsGet = (id, d) => Store.get('fun.' + id, d);
const hsSet = (id, v) => Store.set('fun.' + id, v);
const buzz = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms || 15); } catch (e) { /* ignore */ } };
const cssv = (root, name) => getComputedStyle(root).getPropertyValue(name).trim() || '#888';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmtT = (s) => Math.floor(s / 60) + ':' + pad(Math.floor(s % 60));

/* Tracks every timer / frame / listener a tool starts so one stop() cleans up. */
function tracker() {
  /* Timeouts, intervals and animation frames have separate id pools, so the same number can mean two different things.
     Every call therefore returns its own handle, and this map remembers which kind (and real id) a handle stands for. */
  const live = new Map(), ls = [];
  let seq = 0;
  const kill = (kind, id) => { if (kind === 'raf') cancelAnimationFrame(id); else if (kind === 'iv') clearInterval(id); else clearTimeout(id); };
  return {
    to(fn, ms) { const h = ++seq, id = setTimeout(() => { live.delete(h); fn(); }, ms); live.set(h, ['to', id]); return h; },
    iv(fn, ms) { const h = ++seq; live.set(h, ['iv', setInterval(fn, ms)]); return h; },
    raf(fn) { const h = ++seq, id = requestAnimationFrame((ts) => { live.delete(h); fn(ts); }); live.set(h, ['raf', id]); return h; },
    clear(h) { const e = live.get(h); if (e) { kill(e[0], e[1]); live.delete(h); } },
    on(target, ev, fn, opt) { target.addEventListener(ev, fn, opt); ls.push([target, ev, fn, opt]); },
    stop() {
      live.forEach(([kind, id]) => kill(kind, id)); live.clear();
      ls.forEach(([t, e, f, o]) => t.removeEventListener(e, f, o)); ls.length = 0;
    }
  };
}
/* ctx.roundRect needs WebView 99+; older ones get a plain rectangle. */
function rrect(c, x, y, w, h, r) { if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }

const CSS = `
.fn{user-select:none;-webkit-user-select:none;padding-bottom:8px}
.fn *{-webkit-tap-highlight-color:transparent}
.fn button{touch-action:manipulation}
.fn .seg{display:flex;flex-wrap:wrap;gap:6px;background:var(--surface2);padding:4px;border-radius:14px;margin:8px 0}
.fn .seg button{flex:1;min-height:44px;min-width:44px;border:0;border-radius:11px;background:transparent;color:var(--muted);font-weight:600;font-size:14px;transition:background .2s,color .2s,transform .2s}
.fn .seg button.on{background:var(--accent);color:var(--accent-t);transform:scale(1.04);box-shadow:var(--shadow)}
.fn .stats{display:flex;justify-content:space-around;text-align:center;margin:8px 0;gap:6px}
.fn .stats b{display:block;font-size:22px;font-variant-numeric:tabular-nums;transition:transform .2s}
.fn .stats span{font-size:12px;color:var(--muted)}
.fn .chip{display:inline-block;padding:6px 12px;border-radius:99px;background:var(--surface2);font-weight:600;font-size:14px}
.fn .pop{animation:fnpop .4s cubic-bezier(.2,1.7,.4,1) both}
.fn .shake{animation:fnshake .45s}
.fn .pulse{animation:fnpulse 1s ease-in-out infinite}
.fn .cv{display:block;margin:8px auto;border-radius:18px;background:var(--surface2);border:1px solid var(--line);touch-action:none;width:100%}
.fn .msg{min-height:30px;text-align:center;font-weight:700;font-size:18px;margin:6px 0}
.fn .gap{height:10px}
.fn .big-btn{width:100%;min-height:56px;font-size:18px;border-radius:16px}
.fn .wob{animation:fnwob .6s ease-in-out}
.fn .glow{box-shadow:0 0 0 3px var(--accent),0 0 22px var(--accent)}
.fn .tile3{background:var(--surface);border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow)}
@keyframes fnpop{from{transform:scale(.2);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes fnshake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}
@keyframes fnpulse{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
@keyframes fnwob{0%,100%{transform:rotate(0)}20%{transform:rotate(-14deg) translateY(-6px)}50%{transform:rotate(12deg) translateY(-10px)}80%{transform:rotate(-6deg)}}
@keyframes fnfall{from{transform:translateY(-420%)}to{transform:translateY(0)}}
@keyframes fnfade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
`;
function mount(el, html) {
  el.innerHTML = '<style>' + CSS + '</style><div class="fn">' + html + '</div>';
  return $('.fn', el);
}
const seg = (id, items, cur) => '<div class="seg" id="' + id + '">' + items.map(([v, l]) =>
  '<button data-v="' + v + '" aria-pressed="' + (String(v) === String(cur)) + '" class="' + (String(v) === String(cur) ? 'on' : '') + '">' + l + '</button>').join('') + '</div>';
function onSeg(root, id, cb) {
  const s = $('#' + id, root);
  s.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    $$('button', s).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
    cb(b.dataset.v);
  });
}
const stat = (id, label, v) => '<div><b id="' + id + '">' + v + '</b><span>' + label + '</span></div>';
function reg(id, name, icon, desc, keys, render, needs) {
  Tools.register({ id, name, icon, cat: 'fun', desc, keys, needs: needs || ['storage'], pro: false, render });
}
function bump(node) { node.classList.remove('pop'); void node.offsetWidth; node.classList.add('pop'); }
function restart(node, cls) { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); }

/* =====================================================================
   1. Dice Roller
   ===================================================================== */
reg('dice', 'Dice Roller', '🎲', 'Roll one to six dice (d4 to d20) with a tumbling animation, the total and a history.',
  ['dice', 'roll', 'd20', 'random', 'rpg'], function (el) {
    const T = tracker();
    const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
    const SHAPE = { 4: 'polygon(50% 4%,96% 92%,4% 92%)', 8: 'polygon(50% 0,100% 50%,50% 100%,0 50%)', 10: 'polygon(50% 0,96% 38%,80% 100%,20% 100%,4% 38%)', 12: 'polygon(50% 0,100% 38%,82% 100%,18% 100%,0 38%)', 20: 'polygon(25% 3%,75% 3%,100% 50%,75% 97%,25% 97%,0 50%)' };
    let n = Store.get('fun.dice.n', 2), sides = Store.get('fun.dice.s', 6), busy = false;
    let hist = Store.get('fun.dice.hist', []);
    const root = mount(el, `
      <div class="card">
        <label class="f muted">Dice</label>${seg('dn', [1, 2, 3, 4, 5, 6].map(x => [x, x]), n)}
        <label class="f muted">Sides</label>${seg('ds', [4, 6, 8, 10, 12, 20].map(x => ['' + x, 'd' + x]), sides)}
      </div>
      <div id="tray" style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;padding:18px 0;min-height:120px"></div>
      <div class="mid" id="total" style="min-height:44px"></div>
      <div class="gap"></div>
      <button class="btn big-btn" id="roll">Roll</button>
      <div class="gap"></div>
      <div class="row"><b>History</b><button class="linkbtn" id="clr" style="text-align:right">Clear</button></div>
      <div class="list" id="hist"></div>`);
    const tray = $('#tray', root);
    function dieHTML(v) {
      const shaped = sides !== 6;
      const face = sides === 6
        ? '<div style="display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);width:100%;height:100%;padding:11px">' +
          [...Array(9).keys()].map(i => '<i style="margin:auto;width:11px;height:11px;border-radius:50%;background:' + (PIPS[v].includes(i) ? 'var(--accent-t)' : 'transparent') + '"></i>').join('') + '</div>'
        : '<span style="font-weight:800;font-size:' + (v > 9 ? 22 : 26) + 'px;color:var(--accent-t)">' + v + '</span>';
      return '<div class="die" style="width:68px;height:68px;display:grid;place-items:center;position:relative;transition:transform .2s">' +
        '<div style="position:absolute;inset:0;background:linear-gradient(145deg,var(--accent),#ff6bd6);border-radius:' + (shaped ? '10px' : '18px') + ';' + (shaped ? 'clip-path:' + SHAPE[sides] + ';' : 'box-shadow:0 6px 14px rgba(0,0,0,.25);') + '"></div>' +
        '<div style="position:relative;width:100%;height:100%;display:grid;place-items:center">' + face + '</div></div>';
    }
    function show(vals, rolling) {
      tray.innerHTML = vals.map(dieHTML).join('');
      if (rolling) $$('.die', tray).forEach((d, i) => { d.style.transform = 'rotate(' + (rnd(60) - 30) + 'deg) translateY(' + (-rnd(12)) + 'px)'; });
    }
    function drawHist() {
      $('#hist', root).innerHTML = hist.length ? hist.map(x => '<div class="item"><span class="grow">' + esc(x.l) + '</span><b>' + x.t + '</b></div>').join('') : '<div class="muted center" style="padding:8px">No rolls yet</div>';
    }
    function roll() {
      if (busy) return; busy = true;
      $('#total', root).textContent = '';
      let k = 0;
      const tick = () => {
        if (k < 11) { show(Array.from({ length: n }, () => 1 + rnd(sides)), true); k++; buzz(5); T.to(tick, 55 + k * 6); return; }
        const vals = Array.from({ length: n }, () => 1 + rnd(sides));
        show(vals, false);
        $$('.die', tray).forEach((d, i) => { d.classList.add('pop'); d.style.animationDelay = i * 40 + 'ms'; });
        const t = vals.reduce((a, b) => a + b, 0);
        const tt = $('#total', root); tt.textContent = n > 1 ? 'Total ' + t : '' + t; bump(tt);
        hist.unshift({ l: n + 'd' + sides + ': ' + vals.join(' + '), t }); hist = hist.slice(0, 12);
        Store.set('fun.dice.hist', hist); drawHist(); busy = false;
      };
      tick();
    }
    onSeg(root, 'dn', v => { n = +v; Store.set('fun.dice.n', n); show(Array.from({ length: n }, () => sides === 6 ? 6 : sides)); });
    onSeg(root, 'ds', v => { sides = +v; Store.set('fun.dice.s', sides); show(Array.from({ length: n }, () => sides)); });
    $('#roll', root).onclick = roll;
    $('#clr', root).onclick = () => { hist = []; Store.set('fun.dice.hist', hist); drawHist(); };
    show(Array.from({ length: n }, () => sides));
    drawHist();
    return () => T.stop();
  });

/* =====================================================================
   2. Coin Flip
   ===================================================================== */
reg('coin', 'Coin Flip', '🪙', 'Flip a shiny coin with a 3D spin and keep a heads and tails tally.',
  ['coin', 'flip', 'heads', 'tails', 'toss'], function (el) {
    const T = tracker();
    let tally = Store.get('fun.coin.tally', { h: 0, t: 0 }), rot = 0, busy = false;
    const face = (bg, sym, txt, flip) => '<div style="position:absolute;inset:0;border-radius:50%;display:grid;place-items:center;align-content:center;backface-visibility:hidden;-webkit-backface-visibility:hidden;' + (flip ? 'transform:rotateY(180deg);' : '') +
      'background:radial-gradient(circle at 30% 28%,#fff6c4,' + bg + ' 60%,#b8860b);border:6px solid #e0a915;box-shadow:inset 0 0 18px rgba(120,80,0,.45);color:#7a5200;font-weight:800"><span style="font-size:58px;line-height:1">' + sym + '</span><span style="font-size:15px;letter-spacing:2px">' + txt + '</span></div>';
    const root = mount(el, `
      <div style="perspective:900px;height:210px;display:grid;place-items:center">
        <div id="hop" style="width:150px;height:150px">
          <div id="coin" style="position:relative;width:150px;height:150px;transform-style:preserve-3d;transition:transform 1.4s cubic-bezier(.2,.7,.2,1)">
            ${face('#ffd54a', '👑', 'HEADS', false)}${face('#ffcf33', '🦅', 'TAILS', true)}
          </div>
        </div>
      </div>
      <div class="mid msg" id="res" style="font-size:26px">Tap to flip</div>
      <button class="btn big-btn" id="flip">Flip the coin</button>
      <div class="gap"></div>
      <div class="card"><div class="stats">${stat('th', 'Heads', tally.h)}${stat('tt', 'Tails', tally.t)}${stat('tn', 'Flips', tally.h + tally.t)}</div>
      <div class="progress" style="height:10px"><i id="bar" style="display:block;height:100%;width:50%;background:var(--accent);border-radius:9px;transition:width .5s"></i></div></div>
      <div class="gap"></div><button class="btn alt" id="rst" style="width:100%">Reset tally</button>`);
    const coin = $('#coin', root);
    function upd() {
      $('#th', root).textContent = tally.h; $('#tt', root).textContent = tally.t; $('#tn', root).textContent = tally.h + tally.t;
      $('#bar', root).style.width = (tally.h + tally.t ? tally.h / (tally.h + tally.t) * 100 : 50) + '%';
    }
    function flip() {
      if (busy) return; busy = true;
      const heads = rnd(2) === 0;
      const base = Math.ceil(rot / 360) * 360;
      rot = base + 360 * (5 + rnd(3)) + (heads ? 0 : 180);
      $('#res', root).textContent = '…';
      coin.style.transform = 'rotateY(' + rot + 'deg)';
      const hop = $('#hop', root);
      hop.animate([{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(-70px) scale(1.25)', offset: .45 }, { transform: 'translateY(0) scale(1)' }], { duration: 1400, easing: 'ease-in-out' });
      T.to(() => {
        heads ? tally.h++ : tally.t++; Store.set('fun.coin.tally', tally); upd();
        const r = $('#res', root); r.textContent = heads ? 'Heads!' : 'Tails!'; bump(r); buzz(30); busy = false;
      }, 1420);
    }
    $('#flip', root).onclick = flip;
    coin.parentNode.onclick = flip;
    $('#rst', root).onclick = () => { tally = { h: 0, t: 0 }; Store.set('fun.coin.tally', tally); upd(); };
    upd();
    return () => T.stop();
  });

/* =====================================================================
   3. Spin Wheel
   ===================================================================== */
reg('wheel', 'Spin Wheel', '🎡', 'A colourful wheel of your own options: add or edit entries, spin and let fate choose.',
  ['wheel', 'spin', 'decide', 'random', 'choose', 'raffle'], function (el) {
    const T = tracker();
    let opts = Store.get('fun.wheel.opts', ['Pizza', 'Burgers', 'Sushi', 'Tacos', 'Pasta']);
    let removeAfter = Store.get('fun.wheel.rm', false), rot = 0, busy = false, win = -1;
    const root = mount(el, `
      <canvas id="cv" class="cv" width="640" height="640" role="button" tabindex="0" aria-label="Spin the wheel" style="max-width:360px;background:transparent;border:0"></canvas>
      <div class="msg" id="res" style="font-size:22px">Add some options and spin</div>
      <button class="btn big-btn" id="spin">Spin</button>
      <div class="gap"></div>
      <label class="row" style="gap:10px"><input type="checkbox" id="rm" ${removeAfter ? 'checked' : ''} style="flex:0 0 22px;width:22px;height:22px"><span>Remove the winner after each spin</span></label>
      <div class="gap"></div>
      <div class="row"><input type="text" id="new" maxlength="24" placeholder="New option" aria-label="New option"><button class="btn" id="add" style="flex:0 0 80px">Add</button></div>
      <div class="gap"></div>
      <div id="chips" style="display:flex;flex-wrap:wrap;gap:8px"></div>
      <div class="gap"></div>
      <button class="linkbtn" id="rs">Restore example list</button>`);
    const cv = $('#cv', root), ctx = cv.getContext('2d');
    const col = (i) => 'hsl(' + ((i * 137.5) % 360) + ',78%,' + (i % 2 ? '58%' : '52%') + ')';
    function draw() {
      const W = cv.width, c = W / 2, r = c - 26;
      ctx.clearRect(0, 0, W, W);
      const text = cssv(root, '--text'), surface = cssv(root, '--surface');
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
      ctx.beginPath(); ctx.arc(c, c, r + 8, 0, 7); ctx.fillStyle = surface; ctx.fill(); ctx.restore();
      const n = opts.length;
      if (!n) { ctx.fillStyle = text; ctx.font = '600 30px system-ui'; ctx.textAlign = 'center'; ctx.fillText('Add options', c, c); return; }
      const a = Math.PI * 2 / n;
      for (let i = 0; i < n; i++) {
        const a0 = rot + i * a, a1 = a0 + a, dim = win >= 0 && win !== i;
        ctx.beginPath(); ctx.moveTo(c, c); ctx.arc(c, c, win === i ? r + 4 : r, a0, a1); ctx.closePath();
        ctx.globalAlpha = dim ? .35 : 1; ctx.fillStyle = col(i); ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = surface; ctx.stroke();
        ctx.save(); ctx.translate(c, c); ctx.rotate(a0 + a / 2); ctx.textAlign = 'right'; ctx.fillStyle = '#fff';
        ctx.font = '700 ' + (n > 12 ? 24 : 32) + 'px system-ui'; ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 4;
        let s = opts[i]; if (s.length > 12) s = s.slice(0, 11) + '…';
        ctx.fillText(s, r - 22, 11); ctx.restore(); ctx.globalAlpha = 1;
      }
      ctx.beginPath(); ctx.arc(c, c, 34, 0, 7); ctx.fillStyle = surface; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = cssv(root, '--accent'); ctx.stroke();
      // pointer at the top
      ctx.beginPath(); ctx.moveTo(c - 22, 4); ctx.lineTo(c + 22, 4); ctx.lineTo(c, 56); ctx.closePath();
      ctx.fillStyle = cssv(root, '--danger'); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.stroke();
    }
    function chips() {
      $('#chips', root).innerHTML = opts.map((o, i) => '<span class="chip pop" style="display:inline-flex;align-items:center;padding:0 0 0 12px;background:' + col(i) + ';color:#fff">' + esc(o) +
        '<button data-i="' + i + '" aria-label="Remove ' + esc(o) + '" style="border:0;background:transparent;color:#fff;font-size:16px;padding:0;min-width:44px;min-height:44px">✕</button></span>').join('');
      cv.setAttribute('aria-label', opts.length ? 'Spin the wheel. Options: ' + opts.join(', ') : 'Spin the wheel. Add some options first');
    }
    function save() { Store.set('fun.wheel.opts', opts); }
    function add() {
      const inp = $('#new', root), v = inp.value.trim().slice(0, 24);
      if (!v) return;
      if (opts.length >= 30) { toast('Up to 30 options'); return; }
      if (busy) { toast('Wait for the spin to finish'); return; }
      opts.push(v); inp.value = ''; win = -1; save(); chips(); draw();
    }
    function spin() {
      if (busy) return;
      if (opts.length < 2) { toast('Add at least two options'); return; }
      busy = true; win = -1;
      const n = opts.length, a = Math.PI * 2 / n, pick_ = rnd(n);
      const jit = (rnd(80) + 10) / 100;
      // pointer sits at -90deg; segment i spans [rot+i*a, rot+(i+1)*a)
      let target = -Math.PI / 2 - (pick_ + jit) * a;
      const start = rot, cur = ((start % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      let delta = ((target - cur) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      delta += Math.PI * 2 * (5 + rnd(3));
      const dur = 4200, t0 = performance.now();
      $('#res', root).textContent = 'Spinning…';
      const step = (now) => {
        const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 4);
        rot = start + delta * e; draw();
        if (p < 1) T.raf(step); else finish(pick_);
      };
      T.raf(step);
    }
    function finish(i) {
      win = i; draw(); buzz(60);
      const val = opts[i], r = $('#res', root); r.textContent = '🎉 ' + val; bump(r);
      if (removeAfter) {
        /* Stay busy until the winner is gone, and remove it by value: spinning or deleting in this window used to remove the wrong option. */
        T.to(() => { const k = opts.indexOf(val); if (k >= 0) opts.splice(k, 1); win = -1; save(); chips(); draw(); busy = false; }, 1600);
      } else busy = false;
    }
    $('#spin', root).onclick = spin;
    $('#add', root).onclick = add;
    $('#new', root).onkeydown = (e) => { if (e.key === 'Enter') add(); };
    $('#rm', root).onchange = (e) => { removeAfter = e.target.checked; Store.set('fun.wheel.rm', removeAfter); };
    $('#chips', root).onclick = (e) => {
      const b = e.target.closest('button'); if (!b || busy) return;
      opts.splice(+b.dataset.i, 1); win = -1; save(); chips(); draw();
    };
    $('#rs', root).onclick = () => { if (busy) return; opts = ['Pizza', 'Burgers', 'Sushi', 'Tacos', 'Pasta']; win = -1; save(); chips(); draw(); };
    cv.onclick = spin;
    cv.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); spin(); } };
    chips(); draw();
    return () => T.stop();
  });

/* =====================================================================
   4. Reaction Timer
   ===================================================================== */
reg('reactiontimer', 'Reaction Timer', '🚦', 'Wait for the screen to turn green, then tap as fast as you can. Tracks best and average times.',
  ['reaction', 'reflex', 'speed', 'test', 'ms'], function (el) {
    const T = tracker();
    let state = 'idle', t0 = 0, timer = 0, results = Store.get('fun.reaction.recent', []), best = Store.get('fun.reaction.best', 0);
    const root = mount(el, `
      <div id="pad" role="button" tabindex="0" aria-label="Reaction pad" style="height:300px;border-radius:26px;display:grid;place-items:center;text-align:center;color:#fff;cursor:pointer;transition:background .15s,transform .15s;touch-action:manipulation">
        <div><div id="big" style="font-size:54px;font-weight:800"></div><div id="sub" style="font-size:17px;opacity:.95;padding:0 16px"></div></div>
      </div>
      <div class="gap"></div>
      <div class="card"><div class="stats">${stat('last', 'Last', '–')}${stat('best', 'Best', '–')}${stat('avg', 'Average (last 5)', '–')}</div></div>
      <div class="gap"></div><button class="btn alt" id="rst" style="width:100%">Reset records</button>`);
    const pad_ = $('#pad', root);
    const skin = { idle: ['var(--accent)', '⚡', 'Tap to start'], wait: ['#e5484d', 'Wait…', 'Tap when it turns green'], go: ['#16a34a', 'TAP!', ''], early: ['#f59e0b', 'Too soon!', 'Tap to try again'] };
    function set(s, big, sub) {
      state = s; const k = skin[s] || skin.idle;
      pad_.style.background = s === 'result' ? 'var(--accent)' : k[0];
      $('#big', root).textContent = big != null ? big : k[1]; $('#sub', root).textContent = sub != null ? sub : k[2];
      if (s === 'go') pad_.style.transform = 'scale(1.02)'; else pad_.style.transform = '';
    }
    function stats() {
      const last = results.length ? results[results.length - 1] : null, r5 = results.slice(-5);
      $('#last', root).textContent = last ? last + ' ms' : '–';
      $('#best', root).textContent = best ? best + ' ms' : '–';
      $('#avg', root).textContent = r5.length ? Math.round(r5.reduce((a, b) => a + b, 0) / r5.length) + ' ms' : '–';
    }
    function start() {
      set('wait');
      timer = T.to(() => { t0 = performance.now(); set('go'); }, 1500 + rnd(3200));
    }
    function tap(e) {
      if (e) e.preventDefault();
      if (state === 'idle' || state === 'early' || state === 'result') return start();
      if (state === 'wait') { T.clear(timer); set('early'); restart(pad_, 'shake'); buzz(80); return; }
      if (state === 'go') {
        const ms = Math.round(performance.now() - t0);
        results.push(ms); results = results.slice(-20); Store.set('fun.reaction.recent', results);
        const isBest = !best || ms < best;
        if (isBest) { best = ms; Store.set('fun.reaction.best', best); }
        set('result', ms + ' ms', (isBest ? '🏆 New best! ' : '') + 'Tap to go again'); bump($('#big', root)); stats();
      }
    }
    pad_.addEventListener('pointerdown', tap);
    pad_.onkeydown = (e) => { if (e.key === ' ' || e.key === 'Enter') tap(e); };
    $('#rst', root).onclick = () => { results = []; best = 0; Store.set('fun.reaction.recent', []); Store.set('fun.reaction.best', 0); stats(); };
    set('idle'); stats();
    return () => T.stop();
  });

/* =====================================================================
   5. Tic-Tac-Toe
   ===================================================================== */
reg('tictactoe', 'Tic-Tac-Toe', '⭕', 'Play against an unbeatable phone or a friend, with a running scoreboard.',
  ['noughts', 'crosses', 'xo', 'tictactoe', 'minimax'], function (el) {
    const T = tracker();
    let mode = Store.get('fun.ttt.mode', 'ai'), me = 'X', b, turn, over, score = Store.get('fun.ttt.score', { w: 0, l: 0, d: 0, x: 0, o: 0, dd: 0 });
    const X = '<svg viewBox="0 0 40 40" width="70%" height="70%"><path d="M8 8L32 32M32 8L8 32" stroke="var(--accent)" stroke-width="6" stroke-linecap="round" fill="none" style="stroke-dasharray:40;animation:fnxo .35s ease-out both"/></svg>';
    const O = '<svg viewBox="0 0 40 40" width="70%" height="70%"><circle cx="20" cy="20" r="12" stroke="#ff6b9d" stroke-width="6" fill="none" stroke-linecap="round" style="stroke-dasharray:76;animation:fnxo .4s ease-out both"/></svg>';
    const root = mount(el, `
      <style>@keyframes fnxo{from{stroke-dashoffset:80}to{stroke-dashoffset:0}}</style>
      ${seg('mode', [['ai', '🤖 vs Phone'], ['two', '👥 2 Players']], mode)}
      <div id="side">${seg('side', [['X', 'I play X (first)'], ['O', 'I play O (second)']], me)}</div>
      <div class="msg" id="msg"></div>
      <div id="grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-width:330px;margin:0 auto"></div>
      <div class="gap"></div>
      <div class="card"><div class="stats" id="sc"></div></div>
      <div class="gap"></div>
      <div class="row"><button class="btn" id="again">New game</button><button class="btn alt" id="rst">Reset score</button></div>`);
    function scoreHTML() {
      const s = score;
      $('#sc', root).innerHTML = mode === 'ai' ? stat('', 'You', s.w) + stat('', 'Draws', s.d) + stat('', 'Phone', s.l) : stat('', 'X', s.x) + stat('', 'Draws', s.dd) + stat('', 'O', s.o);
    }
    function msg(t) { const m = $('#msg', root); m.textContent = t; bump(m); }
    function draw(line) {
      $('#grid', root).innerHTML = b.map((v, i) => '<button data-i="' + i + '" aria-label="Cell ' + (i + 1) + '" class="tile3" style="aspect-ratio:1;display:grid;place-items:center;border-radius:20px;padding:0;' +
        (line && line.includes(i) ? 'background:var(--surface2);box-shadow:0 0 0 3px var(--ok);' : '') + '">' + (v === 'X' ? X : v === 'O' ? O : '') + '</button>').join('');
    }
    function newGame() {
      b = Array(9).fill(null); turn = 'X'; over = false; draw();
      $('#side', root).style.display = mode === 'ai' ? '' : 'none';
      scoreHTML();
      if (mode === 'ai') { msg(me === 'X' ? 'Your move' : 'Phone is thinking…'); if (me === 'O') aiMove(); } else msg('X to move');
    }
    function aiMove() {
      T.to(() => { if (over) return; place(L.tttBest(b, turn)); }, 450);
    }
    function place(i) {
      b[i] = turn;
      const r = L.tttWin(b);
      draw(r && r.line);
      if (r) { over = true; buzz(r.w === 'draw' ? 20 : 60); finish(r); return; }
      turn = turn === 'X' ? 'O' : 'X';
      if (mode === 'ai') { if (turn === me) msg('Your move'); else { msg('Phone is thinking…'); aiMove(); } } else msg(turn + ' to move');
    }
    function finish(r) {
      const s = score;
      if (mode === 'ai') {
        if (r.w === 'draw') { s.d++; msg('🤝 A draw'); } else if (r.w === me) { s.w++; msg('🎉 You win!'); } else { s.l++; msg('🤖 The phone wins'); }
      } else if (r.w === 'draw') { s.dd++; msg('🤝 A draw'); } else { s[r.w === 'X' ? 'x' : 'o']++; msg('🎉 ' + r.w + ' wins!'); }
      Store.set('fun.ttt.score', s); scoreHTML();
    }
    $('#grid', root).onclick = (e) => {
      const bt = e.target.closest('button'); if (!bt || over) return;
      const i = +bt.dataset.i;
      if (b[i] || (mode === 'ai' && turn !== me)) return;
      place(i);
    };
    onSeg(root, 'mode', v => { mode = v; Store.set('fun.ttt.mode', mode); T.stop(); newGame(); });
    onSeg(root, 'side', v => { me = v; T.stop(); newGame(); });
    $('#again', root).onclick = () => { T.stop(); newGame(); };
    $('#rst', root).onclick = () => { score = { w: 0, l: 0, d: 0, x: 0, o: 0, dd: 0 }; Store.set('fun.ttt.score', score); scoreHTML(); };
    newGame();
    return () => T.stop();
  });

/* =====================================================================
   6. Memory Match
   ===================================================================== */
reg('memory', 'Memory Match', '🃏', 'Flip cards to find all the matching pairs in three grid sizes. Counts moves and time and saves your best.',
  ['memory', 'cards', 'pairs', 'match', 'concentration'], function (el) {
    const T = tracker();
    const EMO = ['🐶', '🐱', '🦊', '🐼', '🐸', '🦄', '🐙', '🦋', '🍕', '🍩', '🚀', '⚽', '🌈', '🎸', '🍉'];
    const SIZES = { '3x4': [3, 4], '4x4': [4, 4], '4x5': [4, 5] };
    let size = Store.get('fun.memory.size', '4x4'), cards, open, locked, matched, moves, t0, tick = 0, secs;
    const root = mount(el, `
      <style>
        .fn .mc{padding:0;border:0;background:transparent;perspective:600px;aspect-ratio:1}
        .fn .mc .in{position:relative;width:100%;height:100%;transform-style:preserve-3d;transition:transform .45s cubic-bezier(.3,1.3,.5,1)}
        .fn .mc.up .in{transform:rotateY(180deg)}
        .fn .mc .f{position:absolute;inset:0;display:grid;place-items:center;border-radius:14px;backface-visibility:hidden;-webkit-backface-visibility:hidden;font-size:32px}
        .fn .mc .back{background:linear-gradient(145deg,var(--accent),#ff6bd6);color:var(--accent-t);font-weight:800;box-shadow:var(--shadow)}
        .fn .mc .front{background:var(--surface);border:2px solid var(--line);transform:rotateY(180deg)}
        .fn .mc.ok .front{border-color:var(--ok);background:var(--surface2);animation:fnpulse .5s}
      </style>
      ${seg('sz', [['3x4', '3 × 4'], ['4x4', '4 × 4'], ['4x5', '4 × 5']], size)}
      <div class="card"><div class="stats">${stat('mv', 'Moves', 0)}${stat('tm', 'Time', '0:00')}${stat('bs', 'Best', '–')}</div></div>
      <div class="gap"></div>
      <div id="grid" style="display:grid;gap:8px"></div>
      <div class="msg" id="msg"></div>
      <button class="btn big-btn" id="new">New game</button>`);
    function best() { const b = hsGet('memory.best', {})[size]; return b ? b.moves + ' / ' + fmtT(b.secs) : '–'; }
    function setup() {
      T.stop(); const [c, r] = SIZES[size], n = c * r / 2;
      cards = shuffle(EMO.slice(0, n).concat(EMO.slice(0, n))); open = []; locked = false; matched = 0; moves = 0; t0 = 0; secs = 0;
      const g = $('#grid', root); g.style.gridTemplateColumns = 'repeat(' + c + ',1fr)';
      g.innerHTML = cards.map((e, i) => '<button class="mc" data-i="' + i + '" aria-label="Card ' + (i + 1) + ', face down"><div class="in"><div class="f back">?</div><div class="f front">' + e + '</div></div></button>').join('');
      $('#mv', root).textContent = 0; $('#tm', root).textContent = '0:00'; $('#bs', root).textContent = best(); $('#msg', root).textContent = '';
    }
    const cardLab = (btn, i, state) => btn.setAttribute('aria-label', 'Card ' + (i + 1) + ', ' + (state === 'down' ? 'face down' : cards[i] + (state === 'ok' ? ', matched' : '')));
    function flipDone() {
      const [a, b] = open, A = $('.mc[data-i="' + a + '"]', root), B = $('.mc[data-i="' + b + '"]', root);
      if (cards[a] === cards[b]) {
        A.classList.add('ok'); B.classList.add('ok'); cardLab(A, a, 'ok'); cardLab(B, b, 'ok'); matched++; open = []; locked = false; buzz(25);
        if (matched === cards.length / 2) win();
      } else {
        T.to(() => { A.classList.remove('up'); B.classList.remove('up'); cardLab(A, a, 'down'); cardLab(B, b, 'down'); open = []; locked = false; }, 700);
      }
    }
    function win() {
      T.stop();
      const all = hsGet('memory.best', {}), old = all[size];
      const isBest = !old || moves < old.moves || (moves === old.moves && secs < old.secs);
      if (isBest) { all[size] = { moves, secs }; hsSet('memory.best', all); }
      $('#bs', root).textContent = best();
      const m = $('#msg', root); m.textContent = '🎉 Done in ' + moves + ' moves, ' + fmtT(secs) + (isBest ? ' (new best!)' : ''); bump(m); buzz(80);
    }
    $('#grid', root).onclick = (e) => {
      const bt = e.target.closest('.mc'); if (!bt || locked) return;
      const i = +bt.dataset.i;
      if (bt.classList.contains('up')) return;
      if (!t0) { t0 = Date.now(); tick = T.iv(() => { secs = Math.floor((Date.now() - t0) / 1000); $('#tm', root).textContent = fmtT(secs); }, 250); }
      bt.classList.add('up'); cardLab(bt, i, 'up'); open.push(i);
      if (open.length === 2) { moves++; $('#mv', root).textContent = moves; locked = true; T.to(flipDone, 450); }
    };
    onSeg(root, 'sz', v => { size = v; Store.set('fun.memory.size', size); setup(); });
    $('#new', root).onclick = setup;
    setup();
    return () => T.stop();
  });

/* =====================================================================
   7. Scoreboard
   ===================================================================== */
reg('scoreboard', 'Scoreboard', '🏆', 'Keep score for any game: add players, rename them and tap +1, -1 or a custom amount. Saved automatically.',
  ['score', 'points', 'players', 'tally', 'keeper'], function (el) {
    let players = Store.get('fun.scoreboard.players', null);
    /* Stored data is checked: an unreadable list falls back to the default, scores stay finite and inside +-999999999. */
    players = Array.isArray(players) ? players.slice(0, 12).filter(p => p && typeof p === 'object').map(p => ({ n: String(p.n == null ? '' : p.n).slice(0, 20), s: clamp(Math.round(+p.s) || 0, -999999999, 999999999) })) : null;
    if (!players || !players.length) players = [{ n: 'Player 1', s: 0 }, { n: 'Player 2', s: 0 }];
    let step = Store.get('fun.scoreboard.step', 5);
    const root = mount(el, `
      <div class="row" style="margin-bottom:8px"><label class="f muted" style="flex:1">Custom amount<input type="number" id="step" value="${step}" inputmode="numeric" min="1" max="9999" step="1"></label></div>
      <div id="list" style="display:grid;gap:10px"></div>
      <div class="gap"></div>
      <div class="row"><button class="btn" id="add">+ Add player</button><button class="btn alt" id="rst">Reset scores</button></div>
      <div class="gap"></div><button class="linkbtn" id="clr">Remove everyone</button>`);
    const save = () => Store.set('fun.scoreboard.players', players);
    const amount = () => clamp(parseInt($('#step', root).value, 10) || 1, 1, 9999);
    function leaders() {
      const mx = Math.max.apply(null, players.map(p => p.s));
      return players.map(p => mx > 0 && p.s === mx);
    }
    function upd() {
      const ld = leaders();
      players.forEach((p, i) => {
        const s = $('#s' + i, root); if (!s) return;
        if (s.textContent !== '' + p.s) { s.textContent = p.s; bump(s); }
        $('#c' + i, root).textContent = ld[i] ? '👑' : '';
      });
    }
    function build() {
      $('#list', root).innerHTML = players.map((p, i) => `
        <div class="card pop" style="display:grid;gap:8px;animation-delay:${i * 30}ms">
          <div class="row"><span id="c${i}" style="flex:0 0 28px;font-size:22px"></span>
            <input type="text" data-n="${i}" value="${esc(p.n)}" maxlength="20" aria-label="Player ${i + 1} name" style="font-weight:700">
            <button class="btn alt" data-x="${i}" aria-label="Remove ${esc(p.n)}" style="flex:0 0 44px;padding:12px 0">✕</button></div>
          <div class="big" id="s${i}" style="font-size:56px;margin:0">${p.s}</div>
          <div class="row"><button class="btn alt" data-d="${i}:-1" style="min-height:48px;font-size:20px">−1</button>
            <button class="btn" data-d="${i}:1" style="min-height:48px;font-size:20px">+1</button>
            <button class="btn alt" data-d="${i}:-c" style="min-height:48px">− custom</button>
            <button class="btn alt" data-d="${i}:c" style="min-height:48px">+ custom</button></div>
        </div>`).join('') || '<div class="muted center">Add a player to start</div>';
      upd();
    }
    $('#list', root).addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.x != null) { players.splice(+b.dataset.x, 1); save(); build(); return; }
      if (b.dataset.d) {
        const [i, d] = b.dataset.d.split(':'), v = d === 'c' ? amount() : d === '-c' ? -amount() : +d;
        if (!players[+i]) return;
        players[+i].s = clamp(players[+i].s + v, -999999999, 999999999); save(); upd(); buzz(8);
      }
    });
    $('#list', root).addEventListener('input', (e) => {
      const i = e.target.dataset.n; if (i == null || !players[+i]) return;
      players[+i].n = e.target.value.slice(0, 20); save();
    });
    $('#step', root).onchange = () => { step = amount(); $('#step', root).value = step; Store.set('fun.scoreboard.step', step); };
    $('#add', root).onclick = () => {
      if (players.length >= 12) { toast('Up to 12 players'); return; }
      players.push({ n: 'Player ' + (players.length + 1), s: 0 }); save(); build();
    };
    $('#rst', root).onclick = () => { players.forEach(p => { p.s = 0; }); save(); upd(); };
    $('#clr', root).onclick = () => { players = []; save(); build(); };
    build();
  });

/* =====================================================================
   8. Magic 8-Ball
   ===================================================================== */
reg('eightball', 'Magic 8-Ball', '🎱', 'Ask a yes or no question, then shake the phone or tap the ball for a mystical answer.',
  ['8 ball', 'eight', 'magic', 'fortune', 'shake', 'oracle'], function (el) {
    const T = tracker();
    const ANS = ['It is certain', 'Without a doubt', 'Yes, definitely', 'You may rely on it', 'As I see it, yes', 'Most likely', 'Outlook good', 'Yes', 'Signs point to yes',
      'Reply hazy, try again', 'Ask again later', 'Better not tell you now', 'Cannot predict now', 'Concentrate and ask again',
      "Don't count on it", 'My reply is no', 'My sources say no', 'Outlook not so good', 'Very doubtful', 'Absolutely not'];
    let busy = false, last = 0, lastAns = -1;
    const root = mount(el, `
      <input type="text" id="q" maxlength="80" placeholder="Think of a question…" aria-label="Your question" style="text-align:center">
      <div style="display:grid;place-items:center;padding:22px 0">
        <button id="ball" aria-label="Magic 8-ball, tap to shake" style="width:250px;height:250px;border-radius:50%;border:0;padding:0;position:relative;background:radial-gradient(circle at 32% 26%,#5b5f75 0,#1b1d2b 38%,#05060c 100%);box-shadow:0 18px 34px rgba(0,0,0,.35),inset 0 -12px 24px rgba(0,0,0,.6)">
          <span style="position:absolute;left:18%;top:10%;width:28%;height:16%;border-radius:50%;background:rgba(255,255,255,.28);filter:blur(5px);transform:rotate(-30deg)"></span>
          <span id="win" style="position:absolute;left:50%;top:50%;width:122px;height:122px;margin:-61px 0 0 -61px;border-radius:50%;background:radial-gradient(circle,#2a47ff,#10157a);display:grid;place-items:center;box-shadow:inset 0 0 18px #000;overflow:hidden">
            <span id="ans" style="color:#dfe6ff;font-weight:800;text-align:center;font-size:15px;line-height:1.15;padding:10px;transition:opacity .5s,transform .5s"><b style="font-size:54px;color:#fff">8</b></span>
          </span>
        </button>
      </div>
      <div class="msg muted" id="hint">Shake your phone or tap the ball</div>
      <div id="perm"></div>`);
    const ball = $('#ball', root), ans = $('#ans', root);
    function ask() {
      if (busy) return; busy = true; buzz(40);
      ans.style.opacity = 0; ans.style.transform = 'scale(.4)';
      restart(ball, 'wob');
      T.to(() => {
        let i; do { i = rnd(ANS.length); } while (i === lastAns); lastAns = i;
        ans.innerHTML = esc(ANS[i]); ans.style.opacity = 1; ans.style.transform = 'scale(1)';
        $('#hint', root).textContent = i < 10 ? '✨ A good sign' : i < 15 ? '🌫️ The mist is unclear' : '🌑 Not looking good';
        busy = false;
      }, 900);
    }
    ball.onclick = ask;
    function onMotion(e) {
      const a = e.accelerationIncludingGravity; if (!a) return;
      const m = Math.abs(a.x || 0) + Math.abs(a.y || 0) + Math.abs(a.z || 0), now = Date.now();
      if (last && Math.abs(m - last) > 22 && now - (onMotion.t || 0) > 1500) { onMotion.t = now; ask(); }
      last = m;
    }
    onMotion.t = 0;
    if (typeof DeviceMotionEvent === 'undefined') {
      $('#perm', root).innerHTML = '<div class="muted center">Shake is not available on this device. Tap the ball instead.</div>';
    } else if (typeof DeviceMotionEvent.requestPermission === 'function') {
      $('#perm', root).innerHTML = '<button class="btn alt big-btn" id="en">Enable shake</button>';
      $('#en', root).onclick = () => DeviceMotionEvent.requestPermission().then(r => {
        if (r === 'granted') { T.on(window, 'devicemotion', onMotion); $('#perm', root).innerHTML = ''; } else toast('Motion access denied, tap the ball instead');
      }).catch(() => toast('Motion access unavailable'));
    } else T.on(window, 'devicemotion', onMotion);
    return () => T.stop();
  }, ['motion']);

/* =====================================================================
   9. Rock Paper Scissors
   ===================================================================== */
reg('rps', 'RPS Showdown', '✂️', 'Beat the phone at rock, paper, scissors and build a winning streak.',
  ['rock', 'paper', 'scissors', 'rps', 'hands'], function (el) {
    const T = tracker();
    const H = ['✊', '✋', '✌️'], NAME = ['Rock', 'Paper', 'Scissors'];
    let st = Store.get('fun.rps.stats', { w: 0, l: 0, d: 0, streak: 0, best: 0 }), busy = false;
    const root = mount(el, `
      <div style="display:flex;justify-content:space-around;align-items:center;padding:20px 0 8px">
        <div class="center"><div id="you" style="font-size:84px;line-height:1.1">✊</div><div class="muted">You</div></div>
        <div style="font-weight:800;color:var(--muted)">VS</div>
        <div class="center"><div id="cpu" style="font-size:84px;line-height:1.1;transform:scaleX(-1)">✊</div><div class="muted">Phone</div></div>
      </div>
      <div class="msg" id="msg" style="font-size:22px">Choose your move</div>
      <div class="row" id="pick" style="gap:10px">${H.map((h_, i) => '<button class="btn alt" data-i="' + i + '" aria-label="' + NAME[i] + '" style="font-size:44px;padding:12px 0;border-radius:20px">' + h_ + '</button>').join('')}</div>
      <div class="gap"></div>
      <div class="card"><div class="stats">${stat('w', 'Wins', st.w)}${stat('d', 'Draws', st.d)}${stat('l', 'Losses', st.l)}</div>
      <div class="stats">${stat('sk', 'Streak 🔥', st.streak)}${stat('bs', 'Best streak', st.best)}</div></div>
      <div class="gap"></div><button class="linkbtn" id="rst">Reset stats</button>`);
    function upd() { ['w', 'd', 'l'].forEach(k => { $('#' + k, root).textContent = st[k]; }); $('#sk', root).textContent = st.streak; $('#bs', root).textContent = st.best; }
    $('#pick', root).onclick = (e) => {
      const bt = e.target.closest('button'); if (!bt || busy) return;
      busy = true; const me = +bt.dataset.i, cpu = rnd(3);
      const y = $('#you', root), c = $('#cpu', root), m = $('#msg', root);
      y.textContent = c.textContent = '✊'; m.textContent = '…';
      y.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-24px)' }, { transform: 'translateY(0)' }], { duration: 230, iterations: 3 });
      c.animate([{ transform: 'scaleX(-1) translateY(0)' }, { transform: 'scaleX(-1) translateY(-24px)' }, { transform: 'scaleX(-1) translateY(0)' }], { duration: 230, iterations: 3 });
      T.to(() => {
        y.textContent = H[me]; c.textContent = H[cpu]; bump(y); bump(c);
        const r = (me - cpu + 3) % 3;   // 0 draw, 1 win (paper beats rock...), 2 loss
        if (r === 0) { st.d++; m.textContent = '🤝 Draw'; }
        else if (r === 1) { st.w++; st.streak++; st.best = Math.max(st.best, st.streak); m.textContent = '🎉 ' + NAME[me] + ' beats ' + NAME[cpu]; buzz(40); }
        else { st.l++; st.streak = 0; m.textContent = '😅 ' + NAME[cpu] + ' beats ' + NAME[me]; }
        bump(m); Store.set('fun.rps.stats', st); upd(); busy = false;
      }, 720);
    };
    $('#rst', root).onclick = () => { st = { w: 0, l: 0, d: 0, streak: 0, best: 0 }; Store.set('fun.rps.stats', st); upd(); };
    return () => T.stop();
  });

/* =====================================================================
   10. 2048
   ===================================================================== */
reg('g2048', '2048', '🟧', 'Swipe to slide and merge tiles up to 2048. Smooth animations and a saved best score.',
  ['2048', 'puzzle', 'tiles', 'swipe', 'merge'], function (el) {
    const T = tracker();
    let board, tiles, score, best = hsGet('2048.best', 0), over, busy, won;
    const root = mount(el, `
      <style>
        .fn .t48{position:absolute;width:22%;height:22%;display:grid;place-items:center;border-radius:12px;font-weight:800;transition:left .12s ease-out,top .12s ease-out;color:#fff}
        .fn .t48.bump{animation:fnbump .22s}
        @keyframes fnbump{0%{transform:scale(.7)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
      </style>
      <div class="row" style="margin-bottom:8px"><div class="card center"><div class="muted" style="font-size:12px">SCORE</div><b class="mid" id="sc">0</b></div><div class="card center"><div class="muted" style="font-size:12px">BEST</div><b class="mid" id="bs">${best}</b></div></div>
      <div id="board" style="position:relative;aspect-ratio:1;background:var(--surface2);border-radius:18px;touch-action:none;overflow:hidden"></div>
      <div class="msg muted" id="msg">Swipe to move the tiles</div>
      <button class="btn big-btn" id="new">New game</button>`);
    const bd = $('#board', root);
    const pos = (i) => ({ l: (i % 4) * 25 + 1.5, t: ((i / 4) | 0) * 25 + 1.5 });
    function colour(v) {
      const k = Math.log2(v);
      return { bg: 'hsl(' + ((250 - k * 24 + 360) % 360) + ',' + (v < 8 ? 68 : 78) + '%,' + (v === 2 ? 70 : v === 4 ? 64 : 56) + '%)', fs: v > 999 ? 22 : v > 99 ? 28 : 34 };
    }
    function mk(v, i, cls) {
      const e = document.createElement('div'), p = pos(i), c = colour(v);
      e.className = 't48 ' + (cls || ''); e.textContent = v;
      e.style.cssText = 'left:' + p.l + '%;top:' + p.t + '%;background:' + c.bg + ';font-size:' + c.fs + 'px;' + (v <= 4 ? 'color:#2b2f55' : '');
      bd.appendChild(e); return { v, el: e };
    }
    function bgCells() {
      let s = '';
      for (let i = 0; i < 16; i++) { const p = pos(i); s += '<div style="position:absolute;width:22%;height:22%;left:' + p.l + '%;top:' + p.t + '%;border-radius:12px;background:var(--surface);opacity:.6"></div>'; }
      bd.innerHTML = s;
    }
    function upd() {
      $('#sc', root).textContent = score;
      if (score > best) { best = score; hsSet('2048.best', best); $('#bs', root).textContent = best; }
    }
    function newGame() {
      board = new Array(16).fill(0); tiles = new Array(16).fill(null); score = 0; over = false; busy = false; won = false;
      bgCells();
      for (let k = 0; k < 2; k++) { const i = L.add2048(board); tiles[i] = mk(board[i], i, 'pop'); }
      $('#msg', root).textContent = 'Swipe to move the tiles'; upd();
    }
    function go(dir) {
      if (busy || over) return;
      const r = L.move2048(board, dir);
      if (!r.moved) { restart(bd, 'shake'); return; }
      busy = true;
      const nt = new Array(16).fill(null), merges = [];
      r.moves.forEach(m => {
        const t = tiles[m.from], p = pos(m.to);
        t.el.style.left = p.l + '%'; t.el.style.top = p.t + '%';
        if (nt[m.to]) merges.push([nt[m.to], t, m.to]); else nt[m.to] = t;
      });
      board = r.board; tiles = nt; score += r.score; upd();
      T.to(() => {
        merges.forEach(([a, b, to]) => { a.el.remove(); b.el.remove(); tiles[to] = mk(board[to], to, 'bump'); });
        const i = L.add2048(board); if (i >= 0) tiles[i] = mk(board[i], i, 'pop');
        if (!won && board.some(v => v >= 2048)) { won = true; $('#msg', root).textContent = '🎉 You made 2048! Keep going'; buzz(80); }
        if (!L.canMove2048(board)) { over = true; $('#msg', root).textContent = '💥 Game over. Score ' + score; buzz(100); }
        busy = false;
      }, 130);
    }
    let sx = 0, sy = 0, down = false;
    bd.addEventListener('pointerdown', (e) => { down = true; sx = e.clientX; sy = e.clientY; });
    T.on(window, 'pointerup', (e) => {
      if (!down) return; down = false;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      go(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
    });
    T.on(window, 'keydown', (e) => {
      const d = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 }[e.key];
      if (d != null) { e.preventDefault(); go(d); }
    });
    $('#new', root).onclick = newGame;
    newGame();
    return () => T.stop();
  });

/* =====================================================================
   11. Minesweeper
   ===================================================================== */
reg('minesweeper', 'Minesweeper', '💣', 'Classic mine hunting with three sizes. Tap to dig, long-press or use flag mode to mark mines.',
  ['mines', 'sweeper', 'bomb', 'flag', 'puzzle'], function (el) {
    const T = tracker();
    const LV = { easy: [8, 8, 10, 'Easy'], med: [9, 12, 22, 'Medium'], hard: [9, 14, 36, 'Hard'] };
    const COL = ['', '#3b82f6', '#16a34a', '#e5484d', '#7c3aed', '#b45309', '#0891b2', '#111827', '#6b7280'];
    let lv = Store.get('fun.mines.lv', 'easy'), w, h, m, g, st, over, t0, secs, flagMode = false, left, opened, tick = 0;
    const root = mount(el, `
      ${seg('lv', Object.keys(LV).map(k => [k, LV[k][3]]), lv)}
      <div class="card"><div class="stats">${stat('ml', '💣 Left', 0)}${stat('tm', '⏱ Time', '0:00')}${stat('bs', '🏆 Best', '–')}</div></div>
      <div class="gap"></div>
      <div id="grid" style="display:grid;gap:3px;touch-action:manipulation"></div>
      <div class="msg" id="msg"></div>
      <div class="row"><button class="btn alt" id="mode">⛏️ Dig mode</button><button class="btn" id="new">New game</button></div>`);
    const gridEl = $('#grid', root);
    function bestStr() { const b = hsGet('mines.best', {})[lv]; return b ? fmtT(b) : '–'; }
    const cellLabel = (i) => {
      const s = st[i], base = 'Row ' + (((i / w) | 0) + 1) + ', column ' + (i % w + 1) + ', ';
      return base + (s === 2 ? 'flag' : s === 1 ? (g && g.mine[i] ? 'mine' : (g && g.adj[i]) || 'empty') : 'hidden');
    };
    function setup() {
      T.stop(); [w, h, m] = LV[lv]; g = null; st = new Array(w * h).fill(0); over = false; t0 = 0; secs = 0; left = m; opened = 0;
      gridEl.style.gridTemplateColumns = 'repeat(' + w + ',1fr)';
      gridEl.innerHTML = st.map((_, i) => '<button data-i="' + i + '" aria-label="' + cellLabel(i) + '" style="aspect-ratio:1;padding:0;border:0;border-radius:8px;font-weight:800;font-size:17px;background:linear-gradient(145deg,var(--accent),#a78bfa);color:#fff;box-shadow:var(--shadow);transition:background .2s,transform .15s"></button>').join('');
      $('#ml', root).textContent = left; $('#tm', root).textContent = '0:00'; $('#bs', root).textContent = bestStr(); $('#msg', root).textContent = 'Tap a cell to start';
    }
    function paint(i) {
      const b = gridEl.children[i], s = st[i];
      b.setAttribute('aria-label', cellLabel(i));
      if (s === 1) {
        b.style.background = g.mine[i] ? 'var(--danger)' : 'var(--surface2)'; b.style.boxShadow = 'none'; b.style.color = COL[g.adj[i]] || '#888';
        b.textContent = g.mine[i] ? '💣' : (g.adj[i] || ''); b.style.transform = 'scale(1)';
      } else if (s === 2) { b.textContent = '🚩'; } else b.textContent = '';
    }
    function end(winGame) {
      over = true; T.stop();
      st.forEach((s, i) => { if (g.mine[i] && s !== 2 && !winGame) { st[i] = 1; paint(i); } });
      const msg = $('#msg', root);
      if (winGame) {
        const all = hsGet('mines.best', {}); const isB = !all[lv] || secs < all[lv];
        if (isB) { all[lv] = secs; hsSet('mines.best', all); $('#bs', root).textContent = bestStr(); }
        msg.textContent = '🎉 Cleared in ' + fmtT(secs) + (isB ? ' (new best!)' : ''); buzz(80);
      } else { msg.textContent = '💥 Boom! Try again'; buzz(150); restart(gridEl, 'shake'); }
      bump(msg);
    }
    function dig(i) {
      if (over || st[i] === 2) return;
      if (!g) {
        g = L.msGen(w, h, m, i); t0 = Date.now();
        tick = T.iv(() => { secs = Math.floor((Date.now() - t0) / 1000); $('#tm', root).textContent = fmtT(secs); }, 500);
        $('#msg', root).textContent = '';
      }
      if (st[i] === 1) return;
      if (g.mine[i]) { st[i] = 1; paint(i); return end(false); }
      L.msFlood(g, w, h, i, st).forEach(k => { opened++; paint(k); });
      if (opened === w * h - m) end(true);
    }
    function flag(i) {
      if (over || st[i] === 1) return;
      st[i] = st[i] === 2 ? 0 : 2; left += st[i] === 2 ? -1 : 1; $('#ml', root).textContent = left; paint(i); buzz(20);
    }
    let lp = 0, fired = false;
    gridEl.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      fired = false; const i = +b.dataset.i;
      lp = T.to(() => { fired = true; flag(i); }, 420);
    });
    const cancel = () => T.clear(lp);
    gridEl.addEventListener('pointerup', cancel); gridEl.addEventListener('pointerleave', cancel); gridEl.addEventListener('pointercancel', cancel);
    gridEl.addEventListener('contextmenu', (e) => e.preventDefault());
    gridEl.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || fired) { fired = false; return; }
      const i = +b.dataset.i;
      if (flagMode) flag(i); else dig(i);
    });
    onSeg(root, 'lv', v => { lv = v; Store.set('fun.mines.lv', lv); setup(); });
    $('#mode', root).onclick = (e) => { flagMode = !flagMode; e.target.textContent = flagMode ? '🚩 Flag mode' : '⛏️ Dig mode'; };
    $('#new', root).onclick = setup;
    setup();
    return () => T.stop();
  });

/* =====================================================================
   12. Snake
   ===================================================================== */
reg('snake', 'Snake', '🐲', 'Guide a growing snake to the apples with swipes or the arrow pad. Do not hit the walls or yourself.',
  ['snake', 'arcade', 'retro', 'apple'], function (el) {
    const T = tracker();
    const N = 15, S = 40;
    let snake, dir, queue, apple, score, best = hsGet('snake.best', 0), state = 'idle', loop = 0;
    const root = mount(el, `
      <div class="card"><div class="stats">${stat('sc', 'Score', 0)}${stat('bs', 'Best', best)}</div></div>
      <canvas id="cv" class="cv" width="${N * S}" height="${N * S}" style="max-width:380px"></canvas>
      <div class="msg" id="msg">Tap the board to start</div>
      <div style="display:grid;grid-template-columns:repeat(3,64px);grid-template-rows:repeat(2,52px);gap:8px;justify-content:center">
        <span></span><button class="btn alt" data-d="0" aria-label="Up">▲</button><span></span>
        <button class="btn alt" data-d="3" aria-label="Left">◀</button><button class="btn alt" data-d="2" aria-label="Down">▼</button><button class="btn alt" data-d="1" aria-label="Right">▶</button>
      </div>`);
    const cv = $('#cv', root), ctx = cv.getContext('2d'), V = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    function reset() {
      snake = [{ x: 7, y: 7 }, { x: 6, y: 7 }, { x: 5, y: 7 }]; dir = 1; queue = []; score = 0; placeApple();
      $('#sc', root).textContent = 0; draw();
    }
    function placeApple() {
      const free = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!snake.some(s => s.x === x && s.y === y)) free.push({ x, y });
      apple = free.length ? pick(free) : null;
    }
    function draw() {
      const bg = cssv(root, '--surface2'), alt = cssv(root, '--surface');
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { ctx.fillStyle = (x + y) % 2 ? bg : alt; ctx.fillRect(x * S, y * S, S, S); }
      if (apple) { ctx.font = (S - 6) + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🍎', apple.x * S + S / 2, apple.y * S + S / 2 + 2); }
      snake.forEach((s, i) => {
        ctx.fillStyle = 'hsl(' + (150 - i * 3) + ',70%,' + (i ? 45 : 40) + '%)';
        const p = i ? 3 : 1; ctx.beginPath(); rrect(ctx, s.x * S + p, s.y * S + p, S - 2 * p, S - 2 * p, 12); ctx.fill();
      });
      const hd = snake[0], d = V[dir], ex = d[1] ? 9 : 0, ey = d[0] ? 9 : 0;
      ctx.fillStyle = '#fff';
      [[-1], [1]].forEach(([k]) => { ctx.beginPath(); ctx.arc(hd.x * S + S / 2 + d[0] * 8 + ex * k, hd.y * S + S / 2 + d[1] * 8 + ey * k, 5, 0, 7); ctx.fill(); });
      ctx.fillStyle = '#111';
      [[-1], [1]].forEach(([k]) => { ctx.beginPath(); ctx.arc(hd.x * S + S / 2 + d[0] * 10 + ex * k, hd.y * S + S / 2 + d[1] * 10 + ey * k, 2.5, 0, 7); ctx.fill(); });
    }
    function step() {
      if (queue.length) { const d = queue.shift(); if ((d + 2) % 4 !== dir) dir = d; }
      const hd = snake[0], nx = hd.x + V[dir][0], ny = hd.y + V[dir][1];
      const eat = apple && nx === apple.x && ny === apple.y;
      const body = eat ? snake : snake.slice(0, -1);
      if (nx < 0 || ny < 0 || nx >= N || ny >= N || body.some(s => s.x === nx && s.y === ny)) return die();
      snake.unshift({ x: nx, y: ny });
      if (eat) { score++; $('#sc', root).textContent = score; bump($('#sc', root)); buzz(15); placeApple(); } else snake.pop();
      draw();
      if (!apple) return die(true);
      loop = T.to(step, Math.max(70, 150 - score * 3));
    }
    function die(win) {
      state = 'dead'; buzz(120);
      if (score > best) { best = score; hsSet('snake.best', best); $('#bs', root).textContent = best; }
      $('#msg', root).textContent = (win ? '🏆 You filled the board! ' : '💥 Game over. ') + 'Score ' + score + '. Tap to play again'; restart(cv, 'shake');
    }
    function turn(d) {
      if (state === 'idle' || state === 'dead') { start(); }
      if (queue.length < 3) queue.push(d);
    }
    function start() {
      if (state === 'run') return;
      reset(); state = 'run'; $('#msg', root).textContent = 'Go!'; loop = T.to(step, 150);
    }
    $$('button[data-d]', root).forEach(b => { b.onpointerdown = (e) => { e.preventDefault(); turn(+b.dataset.d); }; });
    let sx = 0, sy = 0;
    cv.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
    cv.addEventListener('pointerup', (e) => {
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) { if (state !== 'run') start(); return; }
      turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
    });
    T.on(window, 'keydown', (e) => {
      const d = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 }[e.key];
      if (d != null) { e.preventDefault(); turn(d); }
    });
    reset();
    return () => T.stop();
  });

/* =====================================================================
   13. Sudoku
   ===================================================================== */
reg('sudoku', 'Sudoku', '9️⃣', 'Fresh Sudoku puzzles with a single solution at three difficulties. Conflicts are highlighted, hints available.',
  ['sudoku', 'number', 'puzzle', 'logic', 'grid'], function (el) {
    const T = tracker();
    const CLUES = { easy: 40, med: 32, hard: 27 }, NAMES = { easy: 'Easy', med: 'Medium', hard: 'Hard' };
    let lvl = Store.get('fun.sudoku.lvl', 'easy'), puz, sol, g, sel = -1, t0 = 0, secs = 0, done = false, tick = 0, busy = false, wrong = new Set();
    const root = mount(el, `
      ${seg('lv', Object.keys(NAMES).map(k => [k, NAMES[k]]), lvl)}
      <div class="card"><div class="stats">${stat('tm', 'Time', '0:00')}${stat('bs', 'Best', '–')}</div></div>
      <div class="gap"></div>
      <div id="grid" style="display:grid;grid-template-columns:repeat(9,1fr);border:3px solid var(--text);border-radius:10px;overflow:hidden;background:var(--surface);position:relative"></div>
      <div class="msg" id="msg"></div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px" id="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => '<button class="btn alt" data-n="' + n + '" style="padding:12px 0;font-size:20px">' + n + '</button>').join('')}<button class="btn alt" data-n="0" aria-label="Erase" style="padding:12px 0;font-size:20px">⌫</button></div>
      <div class="gap"></div>
      <div class="row"><button class="btn alt" id="hint">💡 Hint</button><button class="btn alt" id="chk">✔ Check</button><button class="btn" id="new">New</button></div>`);
    const grid = $('#grid', root);
    function bestStr() { const b = hsGet('sudoku.best', {})[lvl]; return b ? fmtT(b) : '–'; }
    function paint() {
      const bad = L.sdkConflicts(g), sv = sel >= 0 ? g[sel] : 0;
      grid.innerHTML = g.map((v, i) => {
        const r = (i / 9) | 0, c = i % 9, given = puz[i] !== 0, isSel = i === sel;
        const peer = sel >= 0 && !isSel && (((sel / 9) | 0) === r || sel % 9 === c || (((sel / 9 / 3) | 0) === ((r / 3) | 0) && ((sel % 9 / 3) | 0) === ((c / 3) | 0)));
        const bg = isSel ? 'var(--accent)' : bad.has(i) || wrong.has(i) ? 'color-mix(in srgb,var(--danger) 30%,var(--surface))' : sv && v === sv ? 'color-mix(in srgb,var(--accent) 30%,var(--surface))' : peer ? 'var(--surface2)' : 'var(--surface)';
        const colr = isSel ? 'var(--accent-t)' : bad.has(i) || wrong.has(i) ? 'var(--danger)' : given ? 'var(--text)' : 'var(--accent)';
        return '<button data-i="' + i + '" aria-label="Row ' + (r + 1) + ' column ' + (c + 1) + '" style="aspect-ratio:1;padding:0;border:0;border-right:' + (c === 8 ? 0 : c % 3 === 2 ? '3px solid var(--text)' : '1px solid var(--line)') + ';border-bottom:' + (r === 8 ? 0 : r % 3 === 2 ? '3px solid var(--text)' : '1px solid var(--line)') +
          ';border-radius:0;background:' + bg + ';color:' + colr + ';font-size:21px;font-weight:' + (given ? 800 : 600) + ';transition:background .15s">' + (v || '') + '</button>';
      }).join('');
    }
    function newGame() {
      if (busy) return; busy = true; T.stop(); done = false; sel = -1; wrong = new Set();
      $('#msg', root).textContent = 'Making a puzzle…'; $('#tm', root).textContent = '0:00'; $('#bs', root).textContent = bestStr();
      grid.style.opacity = .3;
      T.to(() => {
        const r = L.sdkGen(CLUES[lvl]); puz = r.puzzle; sol = r.solution; g = puz.slice();
        grid.style.opacity = 1; $('#msg', root).textContent = ''; busy = false; paint();
        t0 = Date.now(); tick = T.iv(() => { secs = Math.floor((Date.now() - t0) / 1000); $('#tm', root).textContent = fmtT(secs); }, 500);
      }, 40);
    }
    function setCell(v) {
      if (busy || done || sel < 0 || puz[sel]) return;
      g[sel] = v; wrong = new Set(); paint(); checkWin();
    }
    function checkWin() {
      if (g.every(Boolean) && L.sdkValid(g)) {
        done = true; T.stop();
        const all = hsGet('sudoku.best', {}), isB = !all[lvl] || secs < all[lvl];
        if (isB) { all[lvl] = secs; hsSet('sudoku.best', all); }
        $('#bs', root).textContent = bestStr(); $('#msg', root).textContent = '🎉 Solved in ' + fmtT(secs) + (isB ? ' (new best!)' : ''); bump($('#msg', root)); buzz(100);
      }
    }
    grid.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; sel = +b.dataset.i; paint(); };
    $('#pad', root).onclick = (e) => { const b = e.target.closest('button'); if (b) setCell(+b.dataset.n); };
    $('#hint', root).onclick = () => {
      if (busy || done) return;
      if (sel < 0 || puz[sel]) { const e = g.map((v, i) => v ? -1 : i).filter(i => i >= 0); if (!e.length) return; sel = pick(e); }
      g[sel] = sol[sel]; puz = puz.slice(); puz[sel] = sol[sel]; paint(); checkWin();
    };
    $('#chk', root).onclick = () => {
      if (busy || done) return;
      wrong = new Set(); g.forEach((v, i) => { if (v && v !== sol[i]) wrong.add(i); });
      $('#msg', root).textContent = wrong.size ? wrong.size + ' wrong cell' + (wrong.size > 1 ? 's' : '') + ' marked red' : '👍 All filled cells are correct';
      paint(); T.to(() => { wrong = new Set(); if (g) paint(); }, 2500);
    };
    onSeg(root, 'lv', v => { lvl = v; Store.set('fun.sudoku.lvl', lvl); busy = false; newGame(); });
    T.on(window, 'keydown', (e) => { if (/^[0-9]$/.test(e.key)) setCell(+e.key); else if (e.key === 'Backspace' || e.key === 'Delete') setCell(0); });
    $('#new', root).onclick = newGame;
    newGame();
    return () => T.stop();
  });

/* =====================================================================
   14. Simon Says
   ===================================================================== */
reg('simon', 'Simon Says', '🔴', 'Watch the colour pattern and repeat it from memory. It grows by one step every round.',
  ['simon', 'memory', 'pattern', 'colors', 'sequence'], function (el) {
    const T = tracker();
    const COLS = [['#22c55e', 330], ['#ef4444', 262], ['#facc15', 392], ['#3b82f6', 196]];
    let seq = [], idx = 0, mode = 'idle', best = hsGet('simon.best', 0), ac = null;
    const root = mount(el, `
      <div class="card"><div class="stats">${stat('rd', 'Round', 0)}${stat('bs', 'Best', best)}</div></div>
      <div id="pads" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;max-width:340px;margin:14px auto">
        ${COLS.map((c, i) => '<button data-i="' + i + '" aria-label="Pad ' + (i + 1) + '" style="aspect-ratio:1;border:0;border-radius:' + ['100% 14px 14px 14px', '14px 100% 14px 14px', '14px 14px 14px 100%', '14px 14px 100% 14px'][i] + ';background:' + c[0] + ';opacity:.55;transition:opacity .12s,transform .12s,box-shadow .12s"></button>').join('')}
      </div>
      <div class="msg" id="msg">Press Start</div>
      <button class="btn big-btn" id="go">Start</button>`);
    const pads = $$('#pads button', root);
    function tone(i) {
      try {
        ac = ac || new (window.AudioContext || window.webkitAudioContext)();
        const o = ac.createOscillator(), gn = ac.createGain();
        o.type = 'sine'; o.frequency.value = i < 0 ? 110 : COLS[i][1]; o.connect(gn); gn.connect(ac.destination);
        gn.gain.setValueAtTime(.0001, ac.currentTime); gn.gain.exponentialRampToValueAtTime(.25, ac.currentTime + .02);
        gn.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + (i < 0 ? .5 : .32)); o.start(); o.stop(ac.currentTime + .55);
      } catch (e) { /* no audio */ }
    }
    function light(i, ms) {
      const p = pads[i]; p.style.opacity = 1; p.style.transform = 'scale(1.05)'; p.style.boxShadow = '0 0 28px ' + COLS[i][0]; tone(i);
      T.to(() => { p.style.opacity = .55; p.style.transform = ''; p.style.boxShadow = ''; }, ms || 320);
    }
    function play() {
      mode = 'show'; idx = 0; $('#msg', root).textContent = 'Watch…';
      const gap = Math.max(260, 600 - seq.length * 25);
      seq.forEach((c, k) => T.to(() => light(c, gap * .6), 600 + k * gap));
      T.to(() => { mode = 'input'; $('#msg', root).textContent = 'Your turn'; }, 600 + seq.length * gap);
    }
    function next() { seq.push(rnd(4)); $('#rd', root).textContent = seq.length; play(); }
    function fail() {
      mode = 'idle'; tone(-1); buzz(150); const score = seq.length - 1;
      if (score > best) { best = score; hsSet('simon.best', best); $('#bs', root).textContent = best; }
      $('#msg', root).textContent = '❌ Oops! You reached round ' + seq.length; restart($('#pads', root), 'shake'); $('#go', root).textContent = 'Play again';
    }
    $('#pads', root).onpointerdown = (e) => {
      const b = e.target.closest('button'); if (!b || mode !== 'input') return;
      const i = +b.dataset.i; light(i, 200);
      if (i !== seq[idx]) return fail();
      idx++;
      if (idx === seq.length) { mode = 'wait'; $('#msg', root).textContent = '✅ Nice!'; T.to(next, 900); }
    };
    $('#go', root).onclick = () => { T.stop(); seq = []; mode = 'wait'; next(); };
    return () => { T.stop(); try { if (ac) ac.close(); } catch (e) { /* ignore */ } };
  });

/* =====================================================================
   15. Hangman
   ===================================================================== */
const WORDS = {
  Animals: ['ELEPHANT', 'GIRAFFE', 'PENGUIN', 'DOLPHIN', 'KANGAROO', 'BUTTERFLY', 'CROCODILE', 'HEDGEHOG', 'OCTOPUS', 'SQUIRREL', 'CHEETAH', 'FLAMINGO', 'GORILLA', 'LOBSTER', 'PEACOCK', 'RABBIT', 'TORTOISE', 'WALRUS', 'ZEBRA', 'PANTHER'],
  Food: ['SPAGHETTI', 'PANCAKE', 'CHOCOLATE', 'STRAWBERRY', 'SANDWICH', 'BROCCOLI', 'PINEAPPLE', 'POPCORN', 'MUSHROOM', 'AVOCADO', 'CUCUMBER', 'DOUGHNUT', 'LASAGNA', 'PRETZEL', 'WATERMELON', 'BURRITO', 'CUPCAKE', 'NOODLES', 'PEPPERONI', 'MARSHMALLOW'],
  Places: ['AUSTRALIA', 'MOUNTAIN', 'LIBRARY', 'AIRPORT', 'VOLCANO', 'DESERT', 'LIGHTHOUSE', 'PYRAMID', 'RAINFOREST', 'HOSPITAL', 'STADIUM', 'WATERFALL', 'CASTLE', 'ISLAND', 'MUSEUM', 'BRIDGE', 'FOREST', 'HARBOUR', 'CANYON', 'GLACIER'],
  Things: ['UMBRELLA', 'TELESCOPE', 'BACKPACK', 'GUITAR', 'COMPUTER', 'BICYCLE', 'LANTERN', 'TREASURE', 'SKATEBOARD', 'CALENDAR', 'MICROPHONE', 'HAMMOCK', 'PARACHUTE', 'SUNGLASSES', 'KEYBOARD', 'ROCKET', 'COMPASS', 'BALLOON', 'MAGNET', 'CAMERA']
};
const ALLWORDS = Object.keys(WORDS).reduce((a, k) => a.concat(WORDS[k]), []);

reg('hangman', 'Hangman', '🪢', 'Guess the hidden word letter by letter before the drawing is complete. Built-in word list with hints.',
  ['hangman', 'word', 'letters', 'guess', 'spelling'], function (el) {
    const T = tracker();
    const PARTS = ['<circle cx="150" cy="62" r="16"/>', '<path d="M150 78V125"/>', '<path d="M150 90L130 112"/>', '<path d="M150 90L170 112"/>', '<path d="M150 125L132 158"/>', '<path d="M150 125L168 158"/>'];
    let word, cat, used, wrongN, over, st = Store.get('fun.hangman.st', { w: 0, l: 0, streak: 0, best: 0 });
    const root = mount(el, `
      <svg viewBox="0 0 220 180" style="width:100%;max-width:300px;display:block;margin:0 auto" fill="none" stroke="var(--text)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M30 168H120M60 168V16H150V46" stroke="var(--muted)"/>
        <g id="parts" stroke="var(--accent)">${PARTS.map((p, i) => '<g class="hp" style="opacity:0;transition:opacity .35s">' + p + '</g>').join('')}</g>
      </svg>
      <div class="center"><span class="chip" id="cat"></span> <span class="chip" id="lives"></span></div>
      <div id="word" class="mid" style="letter-spacing:6px;margin:14px 0;min-height:44px;word-break:break-all"></div>
      <div class="msg" id="msg"></div>
      <div id="kb" style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px">${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(c => '<button class="btn alt" data-k="' + c + '" style="padding:10px 0;font-size:17px;min-width:0">' + c + '</button>').join('')}</div>
      <div class="gap"></div>
      <div class="card"><div class="stats">${stat('w', 'Won', st.w)}${stat('l', 'Lost', st.l)}${stat('sk', 'Streak', st.streak)}${stat('bs', 'Best streak', st.best)}</div></div>
      <div class="gap"></div><button class="btn big-btn" id="new">New word</button>`);
    function upd() { $('#w', root).textContent = st.w; $('#l', root).textContent = st.l; $('#sk', root).textContent = st.streak; $('#bs', root).textContent = st.best; Store.set('fun.hangman.st', st); }
    function paint() {
      $('#word', root).innerHTML = word.split('').map(c => used.has(c) || over ? '<span style="color:' + (used.has(c) ? 'var(--text)' : 'var(--danger)') + '">' + c + '</span>' : '_').join(' ');
      $$('.hp', root).forEach((p, i) => { p.style.opacity = i < wrongN ? 1 : 0; });
      $('#lives', root).textContent = '❤️ ' + (6 - wrongN);
    }
    function newWord() {
      cat = pick(Object.keys(WORDS)); word = pick(WORDS[cat]); used = new Set(); wrongN = 0; over = false;
      $('#cat', root).textContent = 'Hint: ' + cat; $('#msg', root).textContent = '';
      $$('#kb button', root).forEach(b => { b.disabled = false; b.style.background = ''; b.style.color = ''; }); paint();
    }
    function guess(c) {
      if (over || used.has(c)) return; used.add(c);
      const b = $('#kb button[data-k="' + c + '"]', root), hit = word.includes(c);
      b.disabled = true; b.style.background = hit ? 'var(--ok)' : 'var(--danger)'; b.style.color = '#fff';
      if (!hit) { wrongN++; buzz(25); }
      const m = $('#msg', root);
      if (word.split('').every(x => used.has(x))) { over = true; st.w++; st.streak++; st.best = Math.max(st.best, st.streak); m.textContent = '🎉 You got it!'; bump(m); upd(); buzz(60); }
      else if (wrongN >= 6) { over = true; st.l++; st.streak = 0; m.textContent = '💀 It was ' + word; bump(m); upd(); restart($('svg', root), 'shake'); }
      paint();
    }
    $('#kb', root).onclick = (e) => { const b = e.target.closest('button'); if (b) guess(b.dataset.k); };
    T.on(window, 'keydown', (e) => { if (/^[a-zA-Z]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !(e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) guess(e.key.toUpperCase()); });
    $('#new', root).onclick = newWord;
    newWord(); upd();
    return () => T.stop();
  });

/* =====================================================================
   16. Connect Four
   ===================================================================== */
reg('connect4', 'Connect Four', '🟡', 'Drop discs and line up four in a row. Play a minimax phone opponent at three levels, or a friend.',
  ['connect', 'four', 'discs', 'drop', 'c4'], function (el) {
    const T = tracker();
    const DEPTH = { 1: 2, 2: 4, 3: 6 };
    let mode = Store.get('fun.c4.mode', 'ai'), lvl = Store.get('fun.c4.lvl', '2'), b, turn, over, busy, sc = Store.get('fun.c4.score', { a: 0, b: 0, d: 0 });
    const COL = { 1: '#ef4444', 2: '#facc15' };
    const root = mount(el, `
      ${seg('mode', [['ai', '🤖 vs Phone'], ['two', '👥 2 Players']], mode)}
      <div id="lvw">${seg('lvl', [['1', 'Easy'], ['2', 'Normal'], ['3', 'Hard']], lvl)}</div>
      <div class="msg" id="msg"></div>
      <div id="board" style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;padding:8px;background:linear-gradient(145deg,#2f56e8,#1e3aa8);border-radius:18px;box-shadow:var(--shadow);max-width:400px;margin:0 auto"></div>
      <div class="gap"></div>
      <div class="card"><div class="stats" id="sc"></div></div>
      <div class="gap"></div>
      <div class="row"><button class="btn" id="new">New game</button><button class="btn alt" id="rst">Reset score</button></div>`);
    const bd = $('#board', root);
    function scoreHTML() { $('#sc', root).innerHTML = stat('', mode === 'ai' ? 'You 🔴' : 'Red', sc.a) + stat('', 'Draws', sc.d) + stat('', mode === 'ai' ? 'Phone 🟡' : 'Yellow', sc.b); }
    function msg(t) { const m = $('#msg', root); m.textContent = t; bump(m); }
    function paint(last, win) {
      bd.innerHTML = b.map((v, i) => '<button data-c="' + (i % 7) + '" aria-label="Column ' + (i % 7 + 1) + '" style="aspect-ratio:1;border:0;padding:0;border-radius:50%;background:' + (v ? '' : 'rgba(0,0,0,.35)') + ';box-shadow:inset 0 3px 6px rgba(0,0,0,.4);position:relative;overflow:hidden">' +
        (v ? '<span style="position:absolute;inset:3px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff8,' + COL[v] + ' 55%);' + (win && win.includes(i) ? 'box-shadow:0 0 0 4px #fff,0 0 18px #fff;' : '') + (i === last ? 'animation:fnfall .4s cubic-bezier(.5,0,.8,.6)' : '') + '"></span>' : '') + '</button>').join('');
    }
    function newGame() {
      T.stop(); b = Array(42).fill(0); turn = 1; over = false; busy = false; paint(); scoreHTML();
      $('#lvw', root).style.display = mode === 'ai' ? '' : 'none';
      msg(mode === 'ai' ? 'Your move (red)' : 'Red to move');
    }
    function drop(c) {
      const r = L.c4Drop(b, c, turn); if (r < 0) { restart(bd, 'shake'); return; }
      const last = r * 7 + c, w = L.c4Win(b, turn);
      paint(last, w); buzz(15);
      if (w) { over = true; if (turn === 1) sc.a++; else sc.b++; Store.set('fun.c4.score', sc); scoreHTML(); msg(mode === 'ai' ? (turn === 1 ? '🎉 You win!' : '🤖 The phone wins') : (turn === 1 ? '🔴 Red wins!' : '🟡 Yellow wins!')); return; }
      if (b.every(Boolean)) { over = true; sc.d++; Store.set('fun.c4.score', sc); scoreHTML(); msg('🤝 Draw'); return; }
      turn = 3 - turn;
      if (mode === 'ai' && turn === 2) { busy = true; msg('Phone is thinking…'); T.to(() => { const mv = L.c4Best(b, 2, DEPTH[lvl]); busy = false; drop(mv); }, 450); }
      else msg(mode === 'ai' ? 'Your move (red)' : (turn === 1 ? 'Red to move' : 'Yellow to move'));
    }
    bd.onclick = (e) => { const t = e.target.closest('button'); if (!t || over || busy) return; drop(+t.dataset.c); };
    onSeg(root, 'mode', v => { mode = v; Store.set('fun.c4.mode', mode); newGame(); });
    onSeg(root, 'lvl', v => { lvl = v; Store.set('fun.c4.lvl', lvl); newGame(); });
    $('#new', root).onclick = newGame;
    $('#rst', root).onclick = () => { sc = { a: 0, b: 0, d: 0 }; Store.set('fun.c4.score', sc); scoreHTML(); };
    newGame();
    return () => T.stop();
  });

/* =====================================================================
   17. Tower of Hanoi
   ===================================================================== */
reg('hanoi', 'Tower of Hanoi', '🗼', 'Move the whole stack of discs to the last peg, one at a time, never a big disc on a small one.',
  ['hanoi', 'tower', 'discs', 'puzzle', 'pegs'], function (el) {
    let n = Store.get('fun.hanoi.n', 4), pegs, sel = -1, moves = 0, done = false;
    const root = mount(el, `
      ${seg('n', [3, 4, 5, 6, 7].map(x => ['' + x, x + ' discs']), '' + n)}
      <div class="card"><div class="stats">${stat('mv', 'Moves', 0)}${stat('mn', 'Minimum', 0)}${stat('bs', 'Best', '–')}</div></div>
      <div class="gap"></div>
      <div id="pegs" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px"></div>
      <div class="msg" id="msg">Tap a peg to pick up its top disc</div>
      <button class="btn big-btn" id="new">Restart</button>`);
    const best = () => { const v = hsGet('hanoi.best', {})[n]; return v || '–'; };
    function paint() {
      $('#pegs', root).innerHTML = pegs.map((p, i) => {
        const discs = p.map((d, k) => {
          const top = k === p.length - 1 && sel === i;
          return '<div style="position:relative;z-index:1;height:' + Math.min(26, 190 / n) + 'px;width:' + (28 + d * 66 / n) + '%;border-radius:10px;background:hsl(' + (d * 47 + 200) % 360 + ',75%,58%);box-shadow:var(--shadow);transition:transform .2s;transform:translateY(' + (top ? -16 : 0) + 'px)"></div>';
        }).join('');
        return '<button data-p="' + i + '" aria-label="Peg ' + (i + 1) + '" style="height:260px;border:2px solid ' + (sel === i ? 'var(--accent)' : 'var(--line)') + ';border-radius:16px;background:var(--surface);position:relative;display:flex;flex-direction:column-reverse;align-items:center;gap:3px;padding:0 4px 8px;transition:border-color .2s">' +
          '<span style="position:absolute;bottom:0;top:18px;left:calc(50% - 4px);width:8px;background:var(--surface2);border-radius:6px"></span>' + discs + '</button>';
      }).join('');
      $('#mv', root).textContent = moves;
    }
    function setup() {
      pegs = [[...Array(n).keys()].map(x => n - x), [], []]; sel = -1; moves = 0; done = false;
      $('#mn', root).textContent = L.hanoiMin(n); $('#bs', root).textContent = best(); $('#msg', root).textContent = 'Tap a peg to pick up its top disc'; paint();
    }
    $('#pegs', root).onclick = (e) => {
      const bt = e.target.closest('button'); if (!bt || done) return;
      const p = +bt.dataset.p;
      if (sel < 0) { if (pegs[p].length) { sel = p; paint(); } return; }
      if (sel === p) { sel = -1; paint(); return; }
      if (L.hanoiMove(pegs, sel, p)) {
        moves++; sel = -1; buzz(10);
        if (pegs[2].length === n) {
          done = true; const all = hsGet('hanoi.best', {}), isB = !all[n] || moves < all[n];
          if (isB) { all[n] = moves; hsSet('hanoi.best', all); }
          $('#bs', root).textContent = best();
          const m = $('#msg', root); m.textContent = '🎉 Solved in ' + moves + ' moves' + (moves === L.hanoiMin(n) ? ' (perfect!)' : ''); bump(m);
        } else $('#msg', root).textContent = '';
      } else { $('#msg', root).textContent = '🚫 A big disc cannot go on a smaller one'; sel = -1; restart(bt, 'shake'); }
      paint();
    };
    onSeg(root, 'n', v => { n = +v; Store.set('fun.hanoi.n', n); setup(); });
    $('#new', root).onclick = setup;
    setup();
  });

/* =====================================================================
   18. Number Guess
   ===================================================================== */
reg('numguess', 'Number Guess', '🔮', 'The phone picks a secret number. Guess it using higher and lower hints in as few tries as you can.',
  ['guess', 'number', 'higher', 'lower', 'secret'], function (el) {
    let max = Store.get('fun.guess.max', 100), secret, lo, hi, tries, done, hist;
    const root = mount(el, `
      ${seg('mx', [50, 100, 1000].map(x => ['' + x, '1 to ' + x]), '' + max)}
      <div class="card"><div class="stats">${stat('tr', 'Guesses', 0)}${stat('bs', 'Best', '–')}</div>
        <div style="position:relative;height:16px;border-radius:9px;background:var(--surface2);overflow:hidden;margin-top:6px"><i id="rng" style="position:absolute;top:0;bottom:0;background:linear-gradient(90deg,var(--accent),#ff6bd6);border-radius:9px;transition:left .4s,right .4s"></i></div>
        <div class="row muted" style="font-size:13px;margin-top:4px"><span id="lo"></span><span style="text-align:right" id="hi"></span></div></div>
      <div class="msg" id="msg" style="font-size:22px;min-height:40px"></div>
      <div class="row"><input type="number" id="in" inputmode="numeric" min="1" max="${max}" step="1" placeholder="Your guess" aria-label="Your guess"><button class="btn" id="go" style="flex:0 0 110px">Guess</button></div>
      <div class="gap"></div>
      <div id="hist" style="display:flex;flex-wrap:wrap;gap:6px"></div>
      <div class="gap"></div><button class="btn alt big-btn" id="new">New number</button>`);
    const best = () => { const v = hsGet('guess.best', {})[max]; return v || '–'; };
    function view() {
      $('#lo', root).textContent = lo; $('#hi', root).textContent = hi;
      $('#rng', root).style.left = ((lo - 1) / max * 100) + '%'; $('#rng', root).style.right = ((max - hi) / max * 100) + '%';
      $('#tr', root).textContent = tries;
      $('#hist', root).innerHTML = hist.map(x => '<span class="chip">' + x.v + ' ' + (x.d > 0 ? '⬇️' : x.d < 0 ? '⬆️' : '✅') + '</span>').join('');
    }
    function setup() {
      secret = 1 + rnd(max); lo = 1; hi = max; tries = 0; $('#in', root).max = max; done = false; hist = [];
      $('#in', root).value = ''; $('#msg', root).textContent = 'I am thinking of a number from 1 to ' + max; $('#bs', root).textContent = best(); view();
    }
    function guess() {
      if (done) return;
      const inp = $('#in', root), v = parseInt(inp.value, 10), m = $('#msg', root);
      if (!v || v < 1 || v > max) { m.textContent = 'Enter a number from 1 to ' + max; restart(inp, 'shake'); return; }
      tries++; inp.value = '';
      const d = v - secret; hist.unshift({ v, d });
      if (d === 0) {
        done = true; m.textContent = '🎉 Yes! ' + secret + ' in ' + tries + (tries === 1 ? ' try' : ' tries'); buzz(80);
        const all = hsGet('guess.best', {}); if (!all[max] || tries < all[max]) { all[max] = tries; hsSet('guess.best', all); }
        $('#bs', root).textContent = best();
      } else if (d > 0) { hi = Math.min(hi, v - 1); m.textContent = v + ' is too high ⬇️'; }
      else { lo = Math.max(lo, v + 1); m.textContent = v + ' is too low ⬆️'; }
      bump(m); view();
    }
    $('#go', root).onclick = guess;
    $('#in', root).onkeydown = (e) => { if (e.key === 'Enter') guess(); };
    onSeg(root, 'mx', v => { max = +v; Store.set('fun.guess.max', max); setup(); });
    $('#new', root).onclick = setup;
    setup();
  });

/* =====================================================================
   19. Math Sprint
   ===================================================================== */
reg('mathsprint', 'Math Sprint', '➕', 'Answer as many arithmetic questions as you can in 30 seconds. Three difficulty levels and saved best scores.',
  ['math', 'sprint', 'arithmetic', 'quick', 'brain', 'timed'], function (el) {
    const T = tracker(), DUR = 30000;
    let lvl = Store.get('fun.math.lvl', '1'), q, typed = '', run = false, score = 0, wrongN = 0, t0 = 0, loop = 0;
    const root = mount(el, `
      ${seg('lv', [['1', 'Easy'], ['2', 'Medium'], ['3', 'Hard']], lvl)}
      <div class="card"><div class="stats">${stat('sc', 'Score', 0)}${stat('wr', 'Misses', 0)}${stat('bs', 'Best', '–')}</div>
        <div class="progress" style="height:10px;margin-top:6px"><i id="bar" style="display:block;height:100%;width:100%;background:linear-gradient(90deg,var(--accent),#ff6bd6);border-radius:9px"></i></div></div>
      <div class="gap"></div>
      <div class="big" id="q" style="font-size:46px;min-height:70px">Ready?</div>
      <div class="mid" id="ans" style="min-height:44px;color:var(--accent);letter-spacing:3px"></div>
      <div class="msg" id="msg"></div>
      <div class="keys" id="keys">${['1', '2', '3', '⌫', '4', '5', '6', 'C', '7', '8', '9', '0'].map(k => '<button data-k="' + k + '" class="' + (k === '⌫' || k === 'C' ? 'op' : '') + '">' + k + '</button>').join('')}</div>
      <div class="gap"></div><button class="btn big-btn" id="go">Start (30 s)</button>`);
    const best = () => hsGet('math.best', {})[lvl] || '–';
    function next() { q = L.mathQ(+lvl); typed = ''; $('#q', root).textContent = q.text + ' = ?'; $('#ans', root).textContent = ''; }
    function end() {
      run = false; T.stop(); $('#bar', root).style.width = '0%';
      const all = hsGet('math.best', {}), isB = score > (all[lvl] || 0);
      if (isB) { all[lvl] = score; hsSet('math.best', all); }
      $('#bs', root).textContent = best(); $('#q', root).textContent = 'Time!';
      const m = $('#msg', root); m.textContent = '🎉 ' + score + ' correct' + (isB && score ? ' (new best!)' : ''); bump(m); $('#go', root).textContent = 'Play again'; buzz(100);
    }
    /* Throws the running round away without saving anything (used when the level is switched mid-round). */
    function abort() {
      run = false; T.stop(); score = 0; wrongN = 0;
      $('#bar', root).style.width = '100%'; $('#q', root).textContent = 'Ready?'; $('#ans', root).textContent = ''; $('#msg', root).textContent = '';
      $('#sc', root).textContent = 0; $('#wr', root).textContent = 0; $('#go', root).textContent = 'Start (30 s)';
    }
    function key(k) {
      if (!run) return;
      if (k === '⌫') typed = typed.slice(0, -1); else if (k === 'C') typed = ''; else if (typed.length < 4) typed += k;
      $('#ans', root).textContent = typed;
      if (typed.length === String(q.ans).length) {
        if (+typed === q.ans) { score++; $('#sc', root).textContent = score; bump($('#sc', root)); buzz(8); next(); }
        else { wrongN++; $('#wr', root).textContent = wrongN; restart($('#ans', root), 'shake'); buzz(40); typed = ''; T.to(() => { $('#ans', root).textContent = ''; }, 200); }
      }
    }
    function start() {
      T.stop(); score = 0; wrongN = 0; run = true; t0 = Date.now(); $('#sc', root).textContent = 0; $('#wr', root).textContent = 0; $('#msg', root).textContent = ''; next();
      loop = T.iv(() => {
        const left = DUR - (Date.now() - t0); $('#bar', root).style.width = Math.max(0, left / DUR * 100) + '%';
        if (left <= 0) end();
      }, 100);
    }
    $('#keys', root).onpointerdown = (e) => { const b = e.target.closest('button'); if (b) { e.preventDefault(); key(b.dataset.k); } };
    T.on(window, 'keydown', (e) => { if (/^[0-9]$/.test(e.key)) key(e.key); else if (e.key === 'Backspace') key('⌫'); });
    onSeg(root, 'lv', v => { if (run) abort(); lvl = v; Store.set('fun.math.lvl', lvl); $('#bs', root).textContent = best(); });
    $('#go', root).onclick = start;
    $('#bs', root).textContent = best();
    return () => T.stop();
  });

/* =====================================================================
   20. Truth or Dare
   ===================================================================== */
const TRUTHS = ['What is the most embarrassing thing you have done in public?', 'What is your biggest fear?', 'Who was your first crush?', 'What is the weirdest dream you remember?', 'What is a secret talent you have?',
  'What is the silliest thing you are afraid of?', 'Which song do you secretly love but never admit to?', 'What is the worst gift you ever received?', 'What was your most awkward moment at school?', 'If you could swap lives with someone here for a day, who and why?',
  'What is the longest you have gone without a shower?', 'What is a lie you told that you still remember?', 'What app do you spend too much time on?', 'What is your most unusual habit?', 'What is the strangest food you have eaten?',
  'Who here would you want as a roommate and why?', 'What is something you pretended to like but actually hated?', 'What is your guilty pleasure TV show?', 'What is the most trouble you ever got into?', 'What is one thing you would change about yourself?',
  'What is the worst haircut you have had?', 'Have you ever laughed at the wrong moment? What happened?', 'What would you do with a million dollars in a day?', 'What is your most-used emoji and what does it say about you?', 'What is the nicest thing someone has done for you?',
  'What is the dumbest thing you have ever searched for online?', 'If you had to eat one food forever, what would it be?', 'What superpower would you pick and how would you misuse it?', 'What is the last thing you cried about?', 'What is a rule you break all the time?'];
const DARES = ['Do your best impression of a celebrity until someone guesses who.', 'Speak in an accent for the next three rounds.', 'Do 10 jumping jacks right now.', 'Sing the chorus of your favourite song out loud.', 'Walk like a penguin to the other side of the room.',
  'Let the group pick a funny nickname for you and use it for the day.', 'Balance a spoon on your nose for 10 seconds.', 'Dance with no music for 30 seconds.', 'Talk without closing your mouth for one minute.', 'Make up a rap about the person on your left.',
  'Do your best animal impression, the group guesses it.', 'Hold a plank for 30 seconds.', 'Say the alphabet backwards as fast as you can.', 'Tell a joke and keep a straight face while everyone laughs.', 'Act out a movie scene without speaking.',
  'Hop on one foot for 20 seconds.', 'Try to lick your elbow.', 'Pretend to be a robot until your next turn.', 'Draw a portrait of someone with your eyes closed.', 'Give a dramatic one-minute speech about a spoon.',
  'Let someone style your hair however they like.', 'Spin around 10 times, then try to walk in a straight line.', 'Make a funny face and hold it until your next turn.', 'Say something nice about every person here.', 'Do a catwalk across the room.',
  'Talk like a pirate for the next two rounds.', 'Try to touch your toes with your eyes closed for 15 seconds.', 'Invent a handshake with the person on your right.', 'Do 5 push-ups (or 5 wall push-ups).', 'Narrate your next 30 seconds like a nature documentary.'];

reg('truthdare', 'Truth or Dare', '🎭', 'Party time: draw a family-friendly truth question or a silly dare, or let the phone choose.',
  ['truth', 'dare', 'party', 'question', 'challenge'], function (el) {
    const T = tracker();
    let lastT = -1, lastD = -1;
    const root = mount(el, `
      <div id="card" class="card" style="min-height:230px;display:grid;place-items:center;text-align:center;padding:22px;transition:background .3s">
        <div><div id="tag" style="font-size:54px">🎭</div><div id="txt" style="font-size:20px;font-weight:700;margin-top:8px">Pick Truth or Dare to begin</div></div>
      </div>
      <div class="gap"></div>
      <div class="row"><button class="btn big-btn" id="t" style="background:#3b82f6">💬 Truth</button><button class="btn big-btn" id="d" style="background:#ef4444">🔥 Dare</button></div>
      <div class="gap"></div><button class="btn alt big-btn" id="r">🎲 Surprise me</button>`);
    function draw(kind) {
      const list = kind === 'T' ? TRUTHS : DARES; let i;
      do { i = rnd(list.length); } while (i === (kind === 'T' ? lastT : lastD));
      if (kind === 'T') lastT = i; else lastD = i;
      const c = $('#card', root); c.style.background = 'color-mix(in srgb,' + (kind === 'T' ? '#3b82f6' : '#ef4444') + ' 16%,var(--surface))';
      $('#tag', root).textContent = kind === 'T' ? '💬 Truth' : '🔥 Dare'; $('#txt', root).textContent = list[i];
      c.animate([{ transform: 'rotateY(90deg)', opacity: 0 }, { transform: 'rotateY(0)', opacity: 1 }], { duration: 380, easing: 'ease-out' }); buzz(15);
    }
    $('#t', root).onclick = () => draw('T'); $('#d', root).onclick = () => draw('D'); $('#r', root).onclick = () => draw(rnd(2) ? 'T' : 'D');
    return () => T.stop();
  });

/* =====================================================================
   21. Would You Rather
   ===================================================================== */
const WYR = [['Be able to fly', 'Be able to turn invisible'], ['Always be 10 minutes late', 'Always be 20 minutes early'], ['Live without music', 'Live without movies'], ['Have unlimited pizza', 'Have unlimited ice cream'],
  ['Be a famous actor', 'Be a famous scientist'], ['Have a pet dragon', 'Have a pet unicorn'], ['Never use social media again', 'Never watch TV again'], ['Live on a beach', 'Live in a treehouse'],
  ['Speak every language', 'Talk to animals'], ['Have super strength', 'Have super speed'], ['Explore space', 'Explore the deep ocean'], ['Always have to sing instead of talk', 'Always have to dance when you walk'],
  ['Be the funniest person in the room', 'Be the smartest person in the room'], ['Eat only sweet food forever', 'Eat only salty food forever'], ['Travel back in time', 'Travel to the future'], ['Have a rewind button for your life', 'Have a pause button for your life'],
  ['Never feel cold', 'Never feel hot'], ['Have a personal chef', 'Have a personal driver'], ['Live in a city', 'Live in the countryside'], ['Be able to read minds', 'Be able to see the future'],
  ['Have no homework or chores ever', 'Get paid double for them'], ['Be tiny for a day', 'Be giant for a day'], ['Always win at board games', 'Always win at video games'], ['Have hands for feet', 'Have feet for hands'],
  ['Live a year in the snow', 'Live a year in the desert'], ['Never need to sleep', 'Never need to eat'], ['Go to a magical school', 'Go on a pirate adventure'], ['Be a master chef', 'Be a master musician'],
  ['Have a robot best friend', 'Have an alien best friend'], ['Only whisper', 'Only shout']];
reg('wyr', 'Would You Rather', '🤔', 'Two tough but silly choices at a time. Perfect for car rides and parties.',
  ['would you rather', 'choice', 'party', 'dilemma', 'wyr'], function (el) {
    let order = shuffle([...Array(WYR.length).keys()]), k = 0, n = 0;
    const root = mount(el, `
      <div class="muted center" id="cnt" style="margin:6px 0">Question 1</div>
      <div id="a" role="button" tabindex="0" class="pop" style="min-height:150px;border-radius:22px;display:grid;place-items:center;text-align:center;padding:18px;font-size:21px;font-weight:800;color:#fff;background:linear-gradient(145deg,#7c5cff,#4f46e5);transition:transform .25s,opacity .25s"></div>
      <div class="center" style="font-weight:800;margin:10px 0;color:var(--muted)">OR</div>
      <div id="b" role="button" tabindex="0" class="pop" style="min-height:150px;border-radius:22px;display:grid;place-items:center;text-align:center;padding:18px;font-size:21px;font-weight:800;color:#fff;background:linear-gradient(145deg,#ff6b9d,#f43f5e);transition:transform .25s,opacity .25s"></div>
      <div class="gap"></div><button class="btn big-btn" id="next">Next question ➜</button>`);
    function show() {
      const q = WYR[order[k % order.length]]; n++;
      [['a', q[0]], ['b', q[1]]].forEach(([id, t]) => { const e = $('#' + id, root); e.textContent = t; e.style.opacity = 1; e.style.transform = ''; bump(e); });
      $('#cnt', root).textContent = 'Question ' + n;
    }
    function choose(win, lose) {
      $('#' + win, root).style.transform = 'scale(1.04)'; $('#' + lose, root).style.opacity = .35; $('#' + lose, root).style.transform = 'scale(.96)'; buzz(15);
    }
    $('#a', root).onclick = () => choose('a', 'b'); $('#b', root).onclick = () => choose('b', 'a');
    ['a', 'b'].forEach(id => { $('#' + id, root).onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }; });
    $('#next', root).onclick = () => { k++; show(); };
    show();
  });

/* =====================================================================
   22. Lucky Numbers
   ===================================================================== */
reg('lucky', 'Lucky Numbers', '🍀', 'Pick random lottery-style numbers: 6 of 49, 5 of 50 plus stars, or any amount from any range.',
  ['lottery', 'lucky', 'random', 'numbers', 'pick', 'draw'], function (el) {
    const T = tracker();
    let mode = Store.get('fun.lucky.mode', 'l649'), kk = Store.get('fun.lucky.k', 3), nn = Store.get('fun.lucky.n', 10);
    const root = mount(el, `
      ${seg('md', [['l649', '6 of 49'], ['euro', '5/50 + 2'], ['cust', 'Custom']], mode)}
      <div id="cu" class="row" style="margin:8px 0"><label class="f muted">Pick<input type="number" id="k" value="${kk}" min="1" max="20" step="1" inputmode="numeric"></label><label class="f muted">From 1 to<input type="number" id="n" value="${nn}" min="2" max="1000" step="1" inputmode="numeric"></label></div>
      <div id="balls" style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;padding:22px 0;min-height:130px;align-content:center"></div>
      <div id="stars" style="display:flex;gap:12px;justify-content:center;min-height:56px"></div>
      <div class="gap"></div><button class="btn big-btn" id="go">🍀 Draw</button>
      <div class="muted center" style="margin-top:10px;font-size:13px">For fun only. Numbers are random and sorted.</div>`);
    function ball(v, i, star) {
      const hue = (v * 37) % 360;
      return '<span class="pop" style="animation-delay:' + i * 140 + 'ms;display:grid;place-items:center;width:' + (star ? 50 : 58) + 'px;height:' + (star ? 50 : 58) + 'px;border-radius:50%;font-weight:800;font-size:20px;color:#fff;background:radial-gradient(circle at 32% 28%,#fff9,hsl(' + hue + ',75%,52%) 55%,hsl(' + hue + ',75%,38%));box-shadow:0 6px 12px rgba(0,0,0,.25)">' + (star ? '⭐' : v) + '</span>';
    }
    function draw() {
      let main, stars = [], total = 0;
      if (mode === 'l649') main = L.pickUnique(49, 6);
      else if (mode === 'euro') { main = L.pickUnique(50, 5); stars = L.pickUnique(12, 2); }
      else {
        kk = clamp(parseInt($('#k', root).value, 10) || 1, 1, 20); nn = clamp(parseInt($('#n', root).value, 10) || 2, 2, 1000);
        if (kk > nn) kk = nn;
        $('#k', root).value = kk; $('#n', root).value = nn; Store.set('fun.lucky.k', kk); Store.set('fun.lucky.n', nn);
        main = L.pickUnique(nn, kk);
      }
      main.sort((a, b) => a - b); stars.sort((a, b) => a - b); buzz(30);
      $('#balls', root).innerHTML = main.map((v, i) => ball(v, i)).join('');
      $('#stars', root).innerHTML = stars.map((v, i) => '<span class="pop" style="animation-delay:' + (main.length + i) * 140 + 'ms;display:grid;place-items:center;position:relative;width:50px;height:50px;font-size:46px;line-height:1">⭐<b style="position:absolute;font-size:16px;color:#7a5200">' + v + '</b></span>').join('');
    }
    onSeg(root, 'md', v => { mode = v; Store.set('fun.lucky.mode', mode); $('#cu', root).style.display = mode === 'cust' ? '' : 'none'; $('#balls', root).innerHTML = ''; $('#stars', root).innerHTML = ''; });
    $('#cu', root).style.display = mode === 'cust' ? '' : 'none';
    $('#go', root).onclick = draw;
    return () => T.stop();
  });

/* =====================================================================
   23. Bingo Caller
   ===================================================================== */
reg('bingo', 'Bingo Caller', '🎟️', 'Call bingo numbers 1 to 75 at random with the letter, a board of everything called and optional voice.',
  ['bingo', 'caller', 'numbers', 'game night', 'draw'], function (el) {
    const T = tracker(), LET = 'BINGO';
    let called = Store.get('fun.bingo.called', []), speak = Store.get('fun.bingo.speak', false);
    const letter = (n) => LET[Math.floor((n - 1) / 15)];
    const root = mount(el, `
      <div class="center" style="padding:10px 0"><div id="ball" style="display:inline-grid;place-items:center;width:150px;height:150px;border-radius:50%;background:radial-gradient(circle at 32% 28%,#fff,#fde68a 40%,#f59e0b);box-shadow:0 12px 24px rgba(0,0,0,.25);color:#7a3a00;font-weight:900">
        <div><div id="bl" style="font-size:30px;line-height:1">B</div><div id="bn" style="font-size:58px;line-height:1">?</div></div></div></div>
      <div class="msg" id="msg"></div>
      <div class="row"><button class="btn big-btn" id="call">📣 Call next</button></div>
      <div class="gap"></div>
      <label class="row" style="gap:10px"><input type="checkbox" id="sp" ${speak ? 'checked' : ''} style="flex:0 0 22px;width:22px;height:22px"><span>Read numbers aloud</span></label>
      <div class="gap"></div>
      <div id="recent" style="display:flex;gap:6px;flex-wrap:wrap;min-height:34px"></div>
      <div class="gap"></div>
      <div id="board" style="display:grid;gap:3px"></div>
      <div class="gap"></div><button class="btn danger" id="rst" style="width:100%">New game (clear all)</button>`);
    function show(n, anim) {
      $('#bl', root).textContent = n ? letter(n) : 'B'; $('#bn', root).textContent = n || '?';
      if (anim) $('#ball', root).animate([{ transform: 'translateY(-60px) scale(.3) rotate(-200deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 480, easing: 'cubic-bezier(.2,1.4,.4,1)' });
    }
    function board() {
      let s = '';
      for (let r = 0; r < 5; r++) {
        s += '<div style="display:grid;grid-template-columns:20px repeat(15,1fr);gap:2px;align-items:center"><b style="color:var(--accent);font-size:14px">' + LET[r] + '</b>';
        for (let c = 1; c <= 15; c++) { const n = r * 15 + c, on = called.includes(n); s += '<span style="text-align:center;font-size:10px;padding:5px 0;border-radius:6px;font-weight:' + (on ? 800 : 500) + ';background:' + (on ? 'var(--accent)' : 'var(--surface2)') + ';color:' + (on ? 'var(--accent-t)' : 'var(--muted)') + ';transition:background .3s">' + n + '</span>'; }
        s += '</div>';
      }
      $('#board', root).innerHTML = s;
      $('#recent', root).innerHTML = called.slice(-6).reverse().slice(1).map(n => '<span class="chip">' + letter(n) + n + '</span>').join('');
      $('#msg', root).textContent = called.length + ' of 75 called';
    }
    function say(t) { try { if (speak && window.speechSynthesis) { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(t)); } } catch (e) { /* ignore */ } }
    function call() {
      if (called.length >= 75) { toast('All 75 numbers called'); return; }
      let n; do { n = 1 + rnd(75); } while (called.includes(n));
      called.push(n); Store.set('fun.bingo.called', called); show(n, true); board(); buzz(20);
      say(letter(n) + ' ' + String(n).split('').join(' ') + ', ' + n);
    }
    $('#call', root).onclick = call;
    $('#sp', root).onchange = (e) => { speak = e.target.checked; Store.set('fun.bingo.speak', speak); };
    $('#rst', root).onclick = () => { called = []; Store.set('fun.bingo.called', called); show(0); board(); };
    show(called.length ? called[called.length - 1] : 0); board();
    return () => { T.stop(); try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) { /* ignore */ } };
  });

/* =====================================================================
   24. Whack-a-Mole
   ===================================================================== */
reg('whackamole', 'Whack-a-Mole', '🔨', 'Tap the moles as they pop up before they hide. 30 seconds, and it speeds up as you score.',
  ['whack', 'mole', 'tap', 'arcade', 'reflex'], function (el) {
    const T = tracker(), DUR = 30000;
    let run = false, score = 0, t0 = 0, active = new Set(), best = hsGet('whack.best', 0), sp = 0;
    const tok = new Array(9).fill(0); // one token per hole: a timer from an earlier mole must not touch a newer one
    const root = mount(el, `
      <div class="card"><div class="stats">${stat('sc', 'Score', 0)}${stat('tm', 'Time', 30)}${stat('bs', 'Best', best)}</div></div>
      <div class="gap"></div>
      <div id="grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-width:360px;margin:0 auto">
        ${[...Array(9).keys()].map(i => '<button data-i="' + i + '" aria-label="Hole ' + (i + 1) + '" style="aspect-ratio:1;border:0;padding:0;position:relative;overflow:hidden;border-radius:50% 50% 22px 22px;background:linear-gradient(#8b5a2b,#5a3a1a);box-shadow:inset 0 -14px 0 #2b1a0b,var(--shadow)"><span class="mole" style="position:absolute;left:0;right:0;bottom:12px;font-size:56px;line-height:1;transform:translateY(110%);transition:transform .16s ease-out">🐹</span></button>').join('')}
      </div>
      <div class="msg" id="msg">Tap Start, then whack the moles</div>
      <button class="btn big-btn" id="go">Start</button>`);
    const holes = $$('#grid button', root);
    function hide(i) {
      active.delete(i); const m = $('.mole', holes[i]);
      m.style.transform = 'translateY(110%)'; m.textContent = '🐹';
    }
    function spawn() {
      if (!run) return;
      const free = [...Array(9).keys()].filter(i => !active.has(i));
      if (free.length) {
        const i = pick(free), my = ++tok[i]; active.add(i); const m = $('.mole', holes[i]); m.textContent = '🐹'; m.style.transform = 'translateY(0)';
        const life = Math.max(550, 1100 - score * 12);
        T.to(() => { if (tok[i] === my && active.has(i)) hide(i); }, life);
      }
      T.to(spawn, Math.max(380, 850 - score * 10) * (0.7 + Math.random() * 0.6));
    }
    function end() {
      run = false; T.stop(); holes.forEach((_, i) => hide(i)); active.clear();
      if (score > best) { best = score; hsSet('whack.best', best); $('#bs', root).textContent = best; }
      $('#tm', root).textContent = 0; const m = $('#msg', root); m.textContent = '🎉 Time! You whacked ' + score; bump(m); $('#go', root).textContent = 'Play again'; buzz(100);
    }
    $('#grid', root).onpointerdown = (e) => {
      const b = e.target.closest('button'); if (!b || !run) return;
      const i = +b.dataset.i; if (!active.has(i)) return;
      active.delete(i); // gone at once, so a second tap on the same mole cannot score again
      const my = tok[i];
      score++; $('#sc', root).textContent = score; bump($('#sc', root)); buzz(20);
      const m = $('.mole', b); m.textContent = '💥'; T.to(() => { if (tok[i] === my) hide(i); }, 120);
    };
    $('#go', root).onclick = () => {
      T.stop(); active.clear(); holes.forEach((_, i) => { tok[i]++; hide(i); }); score = 0; run = true; t0 = Date.now();
      $('#sc', root).textContent = 0; $('#msg', root).textContent = 'Go go go!';
      T.iv(() => { const left = DUR - (Date.now() - t0); $('#tm', root).textContent = Math.max(0, Math.ceil(left / 1000)); if (left <= 0) end(); }, 100);
      T.to(spawn, 400);
    };
    return () => T.stop();
  });

/* =====================================================================
   25. Flappy Tap
   ===================================================================== */
reg('flappy', 'Flappy Tap', '🐦', 'Tap to flap through the gaps between the pipes. How far can you get?',
  ['flappy', 'bird', 'tap', 'arcade', 'fly'], function (el) {
    const T = tracker(), W = 360, H = 520, G = 150, PW = 60, BX = 100, R = 15;
    let state = 'idle', y, vy, pipes, score, best = hsGet('flappy.best', 0), last = 0, dist, t = 0, deadAt = 0, raf = 0;
    const root = mount(el, `
      <div class="card"><div class="stats">${stat('sc', 'Score', 0)}${stat('bs', 'Best', best)}</div></div>
      <canvas id="cv" class="cv" width="${W}" height="${H}" style="max-width:360px;touch-action:none" aria-label="Flappy Tap game, tap to flap"></canvas>
      <div class="msg muted">Tap the game to flap</div>`);
    const cv = $('#cv', root), ctx = cv.getContext('2d');
    /* Size from the room that is really there (min of 520px and the viewport minus the header), then give the backing store one pixel per device pixel. */
    function fit() {
      const cw = root.clientWidth || W, ah = Math.max(220, Math.min(H, (window.innerHeight || H) - 220));
      let w = ah * W / H, hh = ah;
      if (w > cw) { w = cw; hh = w * H / W; }
      w = Math.min(w, W);
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      cv.style.width = Math.round(w) + 'px'; cv.style.height = Math.round(hh) + 'px';
      cv.width = Math.round(w * dpr); cv.height = Math.round(hh * dpr);
    }
    function reset() { y = H / 2 - 20; vy = 0; pipes = []; score = 0; dist = 0; $('#sc', root).textContent = 0; for (let i = 0; i < 3; i++) addPipe(W + 100 + i * 210); }
    function addPipe(x) { pipes.push({ x, gy: 90 + Math.random() * (H - 180 - G - 60), passed: false }); }
    function flap() {
      if (state === 'idle') { state = 'run'; }
      if (state === 'dead') { if (performance.now() - deadAt > 500) { reset(); state = 'idle'; } return; }
      vy = -400; buzz(5);
    }
    function die() {
      state = 'dead'; deadAt = performance.now(); buzz(120);
      if (score > best) { best = score; hsSet('flappy.best', best); $('#bs', root).textContent = best; }
    }
    function update(dt) {
      t += dt;
      if (state === 'idle') { y = H / 2 - 20 + Math.sin(t * 5) * 8; return; }
      if (state !== 'run') return;
      vy += 1250 * dt; y += vy * dt; dist += 150 * dt;
      pipes.forEach(p => { p.x -= 150 * dt; });
      if (pipes[0].x + PW < -4) { pipes.shift(); addPipe(pipes[pipes.length - 1].x + 210); }
      pipes.forEach(p => {
        if (!p.passed && p.x + PW < BX - R) { p.passed = true; score++; $('#sc', root).textContent = score; bump($('#sc', root)); }
        if (BX + R > p.x && BX - R < p.x + PW && (y - R < p.gy || y + R > p.gy + G)) die();
      });
      if (y + R > H - 40 || y - R < -30) die();
    }
    function draw() {
      ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
      const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#5fb7ff'); sky.addColorStop(1, '#c9ecff');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,.8)';
      [[(60 - dist * .2) % 420, 90], [(230 - dist * .2) % 420, 150], [(380 - dist * .2) % 420, 60]].forEach(([x, cy]) => { const cx = x < -60 ? x + 420 : x; ctx.beginPath(); ctx.arc(cx, cy, 22, 0, 7); ctx.arc(cx + 24, cy + 6, 18, 0, 7); ctx.arc(cx - 22, cy + 8, 16, 0, 7); ctx.fill(); });
      pipes.forEach(p => {
        ctx.fillStyle = '#22c55e'; ctx.strokeStyle = '#14803c'; ctx.lineWidth = 3;
        ctx.beginPath(); rrect(ctx, p.x, -10, PW, p.gy + 10, [0, 0, 10, 10]); ctx.fill(); ctx.stroke();
        ctx.beginPath(); rrect(ctx, p.x, p.gy + G, PW, H, [10, 10, 0, 0]); ctx.fill(); ctx.stroke();
      });
      ctx.fillStyle = '#d9b36b'; ctx.fillRect(0, H - 40, W, 40); ctx.fillStyle = '#7cc04b'; ctx.fillRect(0, H - 40, W, 10);
      ctx.save(); ctx.translate(BX, y); ctx.rotate(clamp(vy / 900, -.5, 1.1)); ctx.font = '34px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.scale(-1, 1); ctx.fillText('🐦', 0, 2); ctx.restore();
      ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 5; ctx.font = '800 44px system-ui'; ctx.textAlign = 'center'; ctx.strokeText(score, W / 2, 70); ctx.fillText(score, W / 2, 70);
      if (state === 'idle') { ctx.font = '700 20px system-ui'; ctx.strokeText('Tap to start', W / 2, H / 2 + 60); ctx.fillText('Tap to start', W / 2, H / 2 + 60); }
      if (state === 'dead') { ctx.font = '800 30px system-ui'; ctx.strokeText('Game over', W / 2, H / 2); ctx.fillText('Game over', W / 2, H / 2); ctx.font = '700 18px system-ui'; ctx.strokeText('Tap to retry', W / 2, H / 2 + 36); ctx.fillText('Tap to retry', W / 2, H / 2 + 36); }
    }
    function frame(ts) {
      const dt = Math.min(.033, (ts - last) / 1000 || .016); last = ts;
      update(dt); draw(); raf = T.raf(frame);
    }
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); flap(); });
    T.on(window, 'keydown', (e) => { if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); flap(); } });
    T.on(window, 'resize', fit);
    fit(); reset(); raf = T.raf(frame);
    return () => T.stop();
  });

/* =====================================================================
   26. Slide Puzzle
   ===================================================================== */
reg('slide15', 'Slide Puzzle', '🧱', 'The classic sliding tile puzzle in 3x3 and 4x4. Every shuffle is guaranteed solvable.',
  ['15 puzzle', 'slide', 'tiles', 'sliding', 'number puzzle'], function (el) {
    const T = tracker();
    let n = Store.get('fun.slide.n', 4), t, els = {}, moves, t0, secs, done, tick = 0;
    const root = mount(el, `
      ${seg('n', [['3', '3 × 3'], ['4', '4 × 4']], '' + n)}
      <div class="card"><div class="stats">${stat('mv', 'Moves', 0)}${stat('tm', 'Time', '0:00')}${stat('bs', 'Best', '–')}</div></div>
      <div class="gap"></div>
      <div id="board" style="position:relative;aspect-ratio:1;background:var(--surface2);border-radius:18px;padding:0"></div>
      <div class="msg" id="msg"></div>
      <button class="btn big-btn" id="new">Shuffle</button>`);
    const bd = $('#board', root);
    const best = () => { const v = hsGet('slide.best', {})[n]; return v || '–'; };
    function place() {
      t.forEach((v, i) => {
        if (!v) return;
        const e = els[v]; e.style.left = (i % n) * 100 / n + '%'; e.style.top = ((i / n) | 0) * 100 / n + '%';
      });
    }
    function setup() {
      T.stop(); t = L.slShuffle(n); moves = 0; secs = 0; t0 = 0; done = false; els = {};
      bd.innerHTML = '';
      t.forEach((v) => {
        if (!v) return;
        const b = document.createElement('button'), s = 100 / n;
        b.textContent = v; b.dataset.v = v; b.setAttribute('aria-label', 'Tile ' + v);
        b.style.cssText = 'position:absolute;width:' + s + '%;height:' + s + '%;padding:3px;border:0;background:transparent;transition:left .16s ease-out,top .16s ease-out';
        b.innerHTML = '<span style="display:grid;place-items:center;width:100%;height:100%;border-radius:14px;color:#fff;font-weight:800;font-size:' + (n === 3 ? 38 : 30) + 'px;background:linear-gradient(145deg,hsl(' + (v * 360 / (n * n)) + ',75%,58%),hsl(' + (v * 360 / (n * n) + 30) + ',75%,46%));box-shadow:var(--shadow)">' + v + '</span>';
        bd.appendChild(b); els[v] = b;
      });
      place(); $('#mv', root).textContent = 0; $('#tm', root).textContent = '0:00'; $('#bs', root).textContent = best(); $('#msg', root).textContent = 'Slide tiles into the empty space';
    }
    bd.onclick = (e) => {
      const b = e.target.closest('button'); if (!b || done) return;
      const v = +b.dataset.v, i = t.indexOf(v);
      if (!L.slMove(t, n, i)) { restart(b, 'shake'); return; }
      if (!t0) { t0 = Date.now(); tick = T.iv(() => { secs = Math.floor((Date.now() - t0) / 1000); $('#tm', root).textContent = fmtT(secs); }, 500); }
      moves++; $('#mv', root).textContent = moves; place(); buzz(8);
      if (L.slSolved(t)) {
        done = true; T.stop(); const all = hsGet('slide.best', {}), isB = !all[n] || moves < all[n];
        if (isB) { all[n] = moves; hsSet('slide.best', all); }
        $('#bs', root).textContent = best(); const m = $('#msg', root); m.textContent = '🎉 Solved in ' + moves + ' moves, ' + fmtT(secs) + (isB ? ' (new best!)' : ''); bump(m); buzz(80);
      }
    };
    onSeg(root, 'n', v => { n = +v; Store.set('fun.slide.n', n); setup(); });
    $('#new', root).onclick = setup;
    setup();
    return () => T.stop();
  });

/* =====================================================================
   27. Lights Out
   ===================================================================== */
reg('lightsout', 'Lights Out', '🕹️', 'Tap a light to toggle it and its neighbours. Switch every light off to win.',
  ['lights', 'out', 'puzzle', 'toggle', 'grid'], function (el) {
    const N = 5, PRESS = { easy: 3, med: 6, hard: 10 };
    let lv = Store.get('fun.lights.lv', 'easy'), g, start, moves, done, par;
    const root = mount(el, `
      ${seg('lv', [['easy', 'Easy'], ['med', 'Medium'], ['hard', 'Hard']], lv)}
      <div class="card"><div class="stats">${stat('mv', 'Moves', 0)}${stat('pr', 'Par', 0)}${stat('bs', 'Best', '–')}</div></div>
      <div class="gap"></div>
      <div id="grid" style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;max-width:360px;margin:0 auto;padding:10px;border-radius:20px;background:var(--surface2)"></div>
      <div class="msg" id="msg">Turn all the lights off</div>
      <div class="row"><button class="btn alt" id="redo">Restart level</button><button class="btn" id="new">New level</button></div>`);
    const best = () => { const v = hsGet('lights.best', {})[lv]; return v || '–'; };
    function paint() {
      $('#grid', root).innerHTML = g.map((v, i) => '<button data-i="' + i + '" aria-label="Light ' + (i + 1) + (v ? ' on' : ' off') + '" style="aspect-ratio:1;border:0;border-radius:16px;transition:background .25s,box-shadow .25s,transform .15s;' +
        (v ? 'background:radial-gradient(circle at 35% 30%,#fff7c2,#ffd23f);box-shadow:0 0 18px #ffd23f,0 0 4px #fff inset;' : 'background:var(--surface);box-shadow:inset 0 2px 6px rgba(0,0,0,.25);') + '"></button>').join('');
      $('#mv', root).textContent = moves;
    }
    function load(arr) { g = arr.slice(); moves = 0; done = false; $('#msg', root).textContent = 'Turn all the lights off'; paint(); }
    function newLevel() { par = PRESS[lv]; const r = L.loGen(N, par); start = r.grid; $('#pr', root).textContent = par; $('#bs', root).textContent = best(); load(start); }
    $('#grid', root).onclick = (e) => {
      const b = e.target.closest('button'); if (!b || done) return;
      L.loPress(g, N, +b.dataset.i); moves++; paint(); buzz(8);
      if (!g.some(Boolean)) {
        done = true; const all = hsGet('lights.best', {}); if (!all[lv] || moves < all[lv]) { all[lv] = moves; hsSet('lights.best', all); }
        $('#bs', root).textContent = best(); const m = $('#msg', root); m.textContent = '🎉 Lights out in ' + moves + ' moves!'; bump(m); buzz(80);
      }
    };
    onSeg(root, 'lv', v => { lv = v; Store.set('fun.lights.lv', lv); newLevel(); });
    $('#redo', root).onclick = () => load(start);
    $('#new', root).onclick = newLevel;
    newLevel();
  });

/* =====================================================================
   28. General Knowledge Quiz
   ===================================================================== */
const QUIZ = [
  ['What is the capital of Australia?', 'Canberra', 'Sydney', 'Melbourne', 'Perth'], ['Which planet is known as the Red Planet?', 'Mars', 'Venus', 'Jupiter', 'Mercury'],
  ['How many continents are there?', '7', '5', '6', '8'], ['Which is the largest ocean?', 'Pacific', 'Atlantic', 'Indian', 'Arctic'],
  ['What is the chemical symbol for gold?', 'Au', 'Ag', 'Gd', 'Go'], ['Who painted the Mona Lisa?', 'Leonardo da Vinci', 'Michelangelo', 'Raphael', 'Van Gogh'],
  ['What is the hardest natural substance?', 'Diamond', 'Quartz', 'Granite', 'Iron'], ['How many bones does an adult human have?', '206', '186', '226', '256'],
  ['Which is the largest hot desert?', 'Sahara', 'Gobi', 'Kalahari', 'Arabian'], ['Who wrote Romeo and Juliet?', 'William Shakespeare', 'Charles Dickens', 'Jane Austen', 'Mark Twain'],
  ['What is the fastest land animal?', 'Cheetah', 'Lion', 'Horse', 'Leopard'], ['Which gas do plants absorb from the air?', 'Carbon dioxide', 'Oxygen', 'Nitrogen', 'Helium'],
  ['Which is the largest planet in our solar system?', 'Jupiter', 'Saturn', 'Neptune', 'Earth'], ['In which year did World War II end?', '1945', '1939', '1950', '1918'],
  ['What is the smallest prime number?', '2', '1', '3', '0'], ['What is the currency of Japan?', 'Yen', 'Won', 'Yuan', 'Dollar'],
  ['At sea level, water boils at how many degrees Celsius?', '100', '90', '110', '212'], ['Which country is shaped like a boot?', 'Italy', 'Spain', 'Greece', 'Portugal'],
  ['What is the square root of 144?', '12', '14', '11', '13'], ['Who wrote the Harry Potter books?', 'J. K. Rowling', 'Roald Dahl', 'C. S. Lewis', 'Enid Blyton'],
  ['What is the highest mountain above sea level?', 'Mount Everest', 'K2', 'Kilimanjaro', 'Mont Blanc'], ['Which instrument has 88 keys?', 'Piano', 'Organ', 'Accordion', 'Harp'],
  ['What is the capital of Canada?', 'Ottawa', 'Toronto', 'Vancouver', 'Montreal'], ['Which is the largest mammal?', 'Blue whale', 'Elephant', 'Giraffe', 'Hippopotamus'],
  ['How many sides does a hexagon have?', '6', '5', '7', '8'], ['Which planet is famous for its rings?', 'Saturn', 'Mars', 'Mercury', 'Venus'],
  ['Who was the first person to walk on the Moon?', 'Neil Armstrong', 'Buzz Aldrin', 'Yuri Gagarin', 'John Glenn'], ['What are the primary colours of light?', 'Red, green, blue', 'Red, yellow, blue', 'Cyan, magenta, yellow', 'Red, green, yellow'],
  ['What is H2O more commonly known as?', 'Water', 'Salt', 'Hydrogen', 'Peroxide'], ['Which organ pumps blood around the body?', 'Heart', 'Lungs', 'Liver', 'Kidney'],
  ['What is the capital of Egypt?', 'Cairo', 'Alexandria', 'Giza', 'Luxor'], ['Which is the largest country by area?', 'Russia', 'Canada', 'China', 'USA'],
  ['How many strings does a standard guitar have?', '6', '4', '5', '8'], ['What do bees make?', 'Honey', 'Silk', 'Wax only', 'Nectar'],
  ['Which country gave the Statue of Liberty to the USA?', 'France', 'England', 'Spain', 'Italy'], ['Water freezes at what temperature in Fahrenheit?', '32', '0', '12', '100'],
  ['Which vitamin do we get from sunlight?', 'Vitamin D', 'Vitamin C', 'Vitamin A', 'Vitamin B12'], ['Which language has the most native speakers?', 'Mandarin Chinese', 'English', 'Spanish', 'Hindi'],
  ['What is 50 in Roman numerals?', 'L', 'X', 'C', 'D'], ['Which star is closest to Earth?', 'The Sun', 'Proxima Centauri', 'Sirius', 'Polaris']
];
reg('quiz', 'Trivia Quiz', '❓', 'Ten random general-knowledge questions per round from 40 built-in questions, with a saved best score.',
  ['quiz', 'trivia', 'questions', 'knowledge', 'test'], function (el) {
    const T = tracker(), ROUND = 10;
    let order, qi, score, locked, best = hsGet('quiz.best', 0), cur;
    const root = mount(el, `
      <div class="card"><div class="stats">${stat('qn', 'Question', '1/10')}${stat('sc', 'Score', 0)}${stat('bs', 'Best', best)}</div>
        <div class="progress" style="height:8px"><i id="bar" style="display:block;height:100%;width:0;background:var(--accent);border-radius:9px;transition:width .4s"></i></div></div>
      <div class="gap"></div>
      <div id="q" class="card" style="min-height:96px;display:grid;place-items:center;text-align:center;font-size:20px;font-weight:700"></div>
      <div class="gap"></div>
      <div id="opts" style="display:grid;gap:8px"></div>
      <div class="msg" id="msg"></div>
      <button class="btn big-btn" id="next" hidden>Next ➜</button>`);
    function start() { order = shuffle([...Array(QUIZ.length).keys()]).slice(0, ROUND); qi = 0; score = 0; $('#sc', root).textContent = 0; show(); }
    function show() {
      locked = false; const q = QUIZ[order[qi]];
      cur = shuffle(q.slice(1)); $('#q', root).textContent = q[0]; bump($('#q', root));
      $('#opts', root).innerHTML = cur.map((o, i) => '<button class="btn alt" data-i="' + i + '" style="text-align:left;min-height:50px;font-size:17px;animation:fnfade .3s ' + i * 60 + 'ms both">' + esc(o) + '</button>').join('');
      $('#qn', root).textContent = (qi + 1) + '/' + ROUND; $('#bar', root).style.width = qi / ROUND * 100 + '%'; $('#msg', root).textContent = ''; $('#next', root).hidden = true;
    }
    $('#opts', root).onclick = (e) => {
      const b = e.target.closest('button'); if (!b || locked) return; locked = true;
      const q = QUIZ[order[qi]], ok = cur[+b.dataset.i] === q[1];
      $$('#opts button', root).forEach((x, i) => { if (cur[i] === q[1]) { x.style.background = 'var(--ok)'; x.style.color = '#fff'; } });
      if (ok) { score++; $('#sc', root).textContent = score; $('#msg', root).textContent = '✅ Correct!'; buzz(20); }
      else { b.style.background = 'var(--danger)'; b.style.color = '#fff'; restart(b, 'shake'); $('#msg', root).textContent = '❌ It was ' + q[1]; buzz(60); }
      bump($('#msg', root));
      const nx = $('#next', root); nx.hidden = false; nx.textContent = qi === ROUND - 1 ? 'See result' : 'Next ➜';
    };
    let finished = false;
    function finish() {
      finished = true;
      if (score > best) { best = score; hsSet('quiz.best', best); $('#bs', root).textContent = best; }
      $('#bar', root).style.width = '100%'; $('#opts', root).innerHTML = '';
      $('#q', root).textContent = '🏁 You scored ' + score + ' / ' + ROUND + (score === ROUND ? ' - perfect!' : score >= 7 ? ' - great job!' : ' - keep going!');
      $('#next', root).hidden = false; $('#next', root).textContent = 'Play again';
    }
    $('#next', root).onclick = () => {
      if (finished) { finished = false; start(); return; }
      if (qi < ROUND - 1) { qi++; show(); return; }
      finish();
    };
    start();
    return () => T.stop();
  });

/* =====================================================================
   29. Finger Chooser
   ===================================================================== */
reg('fingers', 'Finger Chooser', '☝️', 'Everyone puts a finger on the screen and the phone picks a winner. Great for "who goes first?"',
  ['finger', 'chooser', 'who goes first', 'random', 'touch', 'picker'], function (el) {
    const T = tracker();
    let want = Store.get('fun.fingers.n', 1), ptr = new Map(), locked = false, cd = 0, tmr = 0, hue = 0;
    const root = mount(el, `
      ${seg('w', [['1', '1 winner'], ['2', '2 winners'], ['3', '3 winners']], '' + want)}
      <div id="area" style="position:relative;height:430px;border-radius:24px;background:var(--surface2);overflow:hidden;touch-action:none;display:grid;place-items:center;text-align:center">
        <div id="hint" style="font-weight:700;font-size:19px;color:var(--muted);padding:20px;pointer-events:none">Everyone touch and hold a finger here (2 or more)</div>
      </div>`);
    const area = $('#area', root), hint = $('#hint', root);
    const colour = () => 'hsl(' + (hue++ * 67 % 360) + ',80%,58%)';
    function say(t) { hint.textContent = t; }
    function resetTimer() {
      T.clear(tmr); cd = 0;
      if (locked) return;
      if (ptr.size < 2 || ptr.size <= want) { say(ptr.size ? (ptr.size < 2 ? 'Add more fingers…' : 'Need more fingers than winners') : 'Everyone touch and hold a finger here (2 or more)'); return; }
      cd = 3; say('Hold still… ' + cd);
      tmr = T.iv(() => {
        cd--; if (cd > 0) { say('Hold still… ' + cd); buzz(10); return; }
        T.clear(tmr); choose();
      }, 1000);
    }
    function choose() {
      locked = true; const ids = shuffle([...ptr.keys()]), win = new Set(ids.slice(0, want));
      ptr.forEach((p, id) => {
        if (win.has(id)) { p.el.style.transform = 'translate(-50%,-50%) scale(2.6)'; p.el.style.boxShadow = '0 0 0 8px #fff,0 0 40px currentColor'; p.el.textContent = '🏆'; }
        else { p.el.style.opacity = 0; p.el.style.transform = 'translate(-50%,-50%) scale(.2)'; }
      });
      say('🎉 Chosen! Lift your fingers to play again'); buzz([80, 40, 120]);
    }
    function add(e) {
      if (locked) return;
      const d = document.createElement('div'), r = area.getBoundingClientRect(), c = colour();
      d.style.cssText = 'position:absolute;width:84px;height:84px;border-radius:50%;pointer-events:none;display:grid;place-items:center;font-size:34px;color:' + c + ';background:' + c + ';transform:translate(-50%,-50%) scale(1);transition:transform .35s cubic-bezier(.2,1.6,.4,1),opacity .35s,box-shadow .35s;left:' + (e.clientX - r.left) + 'px;top:' + (e.clientY - r.top) + 'px;animation:fnpop .3s both';
      area.appendChild(d); ptr.set(e.pointerId, { el: d }); resetTimer();
    }
    function remove(e) {
      const p = ptr.get(e.pointerId); if (!p) return;
      p.el.remove(); ptr.delete(e.pointerId);
      if (locked) { if (!ptr.size) { locked = false; resetTimer(); } return; }
      resetTimer();
    }
    area.addEventListener('pointerdown', (e) => { e.preventDefault(); add(e); });
    area.addEventListener('pointermove', (e) => {
      const p = ptr.get(e.pointerId); if (!p) return; const r = area.getBoundingClientRect();
      p.el.style.left = (e.clientX - r.left) + 'px'; p.el.style.top = (e.clientY - r.top) + 'px';
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => area.addEventListener(ev, remove));
    area.addEventListener('contextmenu', (e) => e.preventDefault());
    onSeg(root, 'w', v => { want = +v; Store.set('fun.fingers.n', want); resetTimer(); });
    return () => T.stop();
  });

/* =====================================================================
   30. Team Maker
   ===================================================================== */
reg('teams', 'Team Maker', '👥', 'Paste a list of names and split them into fair random teams.',
  ['teams', 'groups', 'split', 'random', 'shuffle', 'players'], function (el) {
    const T = tracker(), COLS = ['#7c5cff', '#f43f5e', '#16a34a', '#f59e0b', '#06b6d4', '#ec4899'];
    let k = Store.get('fun.teams.k', 2);
    const root = mount(el, `
      <label class="f muted">Names (one per line or separated by commas)<textarea id="names" rows="6" maxlength="3000" placeholder="Ava, Ben, Chloe, Dev…">${esc(Store.get('fun.teams.names', ''))}</textarea></label>
      <label class="f muted">Number of teams</label>${seg('k', [2, 3, 4, 5, 6].map(x => ['' + x, x]), '' + k)}
      <button class="btn big-btn" id="go">🔀 Make teams</button>
      <div class="gap"></div><div id="out" style="display:grid;gap:10px"></div>`);
    const parse = () => { const seen = new Set(); return $('#names', root).value.split(/[\n,]+/).map(s => s.trim().slice(0, 30)).filter(s => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase())).slice(0, 60); };
    function make() {
      const names = parse(); Store.set('fun.teams.names', $('#names', root).value);
      if (names.length < k) { toast('Add at least ' + k + ' names'); return; }
      const teams = L.makeTeams(names, k);
      $('#out', root).innerHTML = teams.map((tm, i) => '<div class="card pop" style="border-top:6px solid ' + COLS[i] + ';animation-delay:' + i * 90 + 'ms"><b style="color:' + COLS[i] + '">Team ' + (i + 1) + '</b> <span class="muted">(' + tm.length + ')</span><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">' + tm.map(n => '<span class="chip">' + esc(n) + '</span>').join('') + '</div></div>').join('');
      buzz(30);
    }
    onSeg(root, 'k', v => { k = +v; Store.set('fun.teams.k', k); });
    $('#go', root).onclick = make;
  });

/* =====================================================================
   31. Bottle Spinner
   ===================================================================== */
reg('bottle', 'Bottle Spinner', '🍾', 'Sit in a circle and spin the bottle. It slows to a stop and points at a seat.',
  ['spin the bottle', 'bottle', 'circle', 'party', 'truth or dare'], function (el) {
    const T = tracker();
    let n = Store.get('fun.bottle.n', 6), rot = 0, busy = false;
    const root = mount(el, `
      ${seg('n', [2, 3, 4, 5, 6, 8, 10, 12].map(x => ['' + x, x]), '' + n)}
      <div class="muted center" style="font-size:13px">Seats around the circle</div>
      <div id="ring" style="position:relative;width:min(100%,340px);aspect-ratio:1;margin:8px auto;border-radius:50%;background:radial-gradient(circle,var(--surface) 0 55%,var(--surface2) 56%);border:1px solid var(--line)">
        <div id="bt" style="position:absolute;left:50%;top:50%;width:60px;height:190px;margin:-95px 0 0 -30px;transform:rotate(0deg);transition:transform 4.2s cubic-bezier(.1,.7,.12,1)">
          <svg viewBox="0 0 60 190" width="60" height="190"><path d="M24 4h12v40c0 12 14 18 14 40v92c0 4-4 8-8 8H18c-4 0-8-4-8-8V84c0-22 14-28 14-40z" fill="#16a34a" stroke="#0b5d2a" stroke-width="3"/><rect x="12" y="104" width="36" height="50" rx="5" fill="#fef3c7"/><rect x="24" y="0" width="12" height="9" rx="3" fill="#e5484d"/></svg>
        </div>
      </div>
      <div class="msg" id="msg" style="font-size:22px">Tap the bottle to spin</div>
      <button class="btn big-btn" id="go">Spin</button>`);
    const ring = $('#ring', root), bt = $('#bt', root);
    function seats(hl) {
      $$('.seat', ring).forEach(e => e.remove());
      for (let i = 0; i < n; i++) {
        const a = i * 360 / n, s = document.createElement('div');
        s.className = 'seat';
        s.style.cssText = 'position:absolute;left:50%;top:50%;width:44px;height:44px;margin:-22px;border-radius:50%;display:grid;place-items:center;font-weight:800;color:#fff;transition:transform .4s,box-shadow .4s;background:hsl(' + (i * 360 / n) + ',75%,55%);transform:rotate(' + a + 'deg) translateY(-' + (ring.clientWidth / 2 - 30) + 'px) rotate(-' + a + 'deg)' + (i === hl ? ' scale(1.4)' : '') + ';' + (i === hl ? 'box-shadow:0 0 0 4px #fff,0 0 24px hsl(' + (i * 360 / n) + ',80%,55%);z-index:2' : '');
        s.textContent = i + 1; ring.appendChild(s);
      }
    }
    function spin() {
      if (busy) return; busy = true; seats(-1);
      rot += 1440 + rnd(720) + rnd(360);
      bt.style.transform = 'rotate(' + rot + 'deg)'; $('#msg', root).textContent = 'Spinning…';
      T.to(() => {
        const a = ((rot % 360) + 360) % 360, i = Math.round(a / (360 / n)) % n;
        seats(i); const m = $('#msg', root); m.textContent = '👉 Seat ' + (i + 1); bump(m); buzz(60); busy = false;
      }, 4300);
    }
    onSeg(root, 'n', v => { n = +v; Store.set('fun.bottle.n', n); seats(-1); $('#msg', root).textContent = 'Tap the bottle to spin'; });
    bt.onclick = spin; $('#go', root).onclick = spin;
    T.to(() => seats(-1), 0);
    return () => T.stop();
  });

/* =====================================================================
   32. Word Scramble
   ===================================================================== */
reg('scramble', 'Word Scramble', '🔡', 'Unscramble the jumbled letters by tapping them in the right order. Streaks and hints included.',
  ['scramble', 'anagram', 'word', 'unscramble', 'letters'], function (el) {
    const T = tracker();
    let word, cat, letters, ans, st = Store.get('fun.scramble.st', { score: 0, streak: 0, best: 0 }), locked;
    const root = mount(el, `
      <div class="card"><div class="stats">${stat('sc', 'Solved', st.score)}${stat('sk', 'Streak', st.streak)}${stat('bs', 'Best streak', st.best)}</div></div>
      <div class="center" style="margin-top:10px"><span class="chip" id="cat"></span></div>
      <div id="slots" style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;min-height:56px;margin:16px 0"></div>
      <div id="tiles" style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;min-height:56px"></div>
      <div class="msg" id="msg"></div>
      <div class="row"><button class="btn alt" id="hint">💡 Show category</button><button class="btn alt" id="clr">Clear</button><button class="btn" id="skip">Skip ➜</button></div>`);
    function paint() {
      $('#slots', root).innerHTML = word.split('').map((_, i) => {
        const id = ans[i], on = id != null;
        return '<button data-s="' + i + '" aria-label="Slot ' + (i + 1) + '" style="width:40px;height:50px;border-radius:12px;border:2px ' + (on ? 'solid var(--accent)' : 'dashed var(--line)') + ';background:' + (on ? 'var(--surface)' : 'transparent') + ';font-size:22px;font-weight:800;padding:0;color:var(--text)">' + (on ? letters[id] : '') + '</button>';
      }).join('');
      $('#tiles', root).innerHTML = letters.map((c, i) => '<button data-t="' + i + '" class="btn" style="width:44px;height:52px;padding:0;font-size:22px;' + (ans.includes(i) ? 'opacity:.2;pointer-events:none;' : '') + '">' + c + '</button>').join('');
    }
    function next() {
      cat = pick(Object.keys(WORDS)); word = pick(WORDS[cat]); letters = L.scrambleWord(word).split(''); ans = []; locked = false;
      $('#cat', root).textContent = '?'; $('#msg', root).textContent = ''; paint();
    }
    function stats() { $('#sc', root).textContent = st.score; $('#sk', root).textContent = st.streak; $('#bs', root).textContent = st.best; Store.set('fun.scramble.st', st); }
    function check() {
      if (ans.length !== word.length) return;
      const guess = ans.map(i => letters[i]).join(''), m = $('#msg', root);
      if (guess === word) {
        locked = true; st.score++; st.streak++; st.best = Math.max(st.best, st.streak); stats(); m.textContent = '🎉 ' + word + '!'; bump(m); buzz(50);
        $$('#slots button', root).forEach((b, i) => { b.style.borderColor = 'var(--ok)'; b.classList.add('pop'); b.style.animationDelay = i * 40 + 'ms'; });
        T.to(next, 1100);
      } else { restart($('#slots', root), 'shake'); m.textContent = 'Not quite, try again'; buzz(40); T.to(() => { ans = []; paint(); }, 450); }
    }
    $('#tiles', root).onclick = (e) => {
      const b = e.target.closest('button'); if (!b || locked) return;
      if (ans.length < word.length) { ans.push(+b.dataset.t); paint(); check(); }
    };
    $('#slots', root).onclick = (e) => {
      const b = e.target.closest('button'); if (!b || locked) return;
      const i = +b.dataset.s; if (ans[i] != null) { ans.splice(i, 1); paint(); }
    };
    $('#hint', root).onclick = () => { $('#cat', root).textContent = cat; };
    $('#clr', root).onclick = () => { if (!locked) { ans = []; paint(); } };
    $('#skip', root).onclick = () => { if (locked) return; st.streak = 0; stats(); $('#msg', root).textContent = 'It was ' + word; locked = true; T.to(next, 1000); };
    next();
    return () => T.stop();
  });

if (typeof module !== 'undefined' && module.exports) module.exports = L;
})();
