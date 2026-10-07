'use strict';
/* PocketKit "Games 3": Chess and Checkers (category 'fun'). Each game has a pure engine between marker comments
   (ENGINE-START/END, CHECKERS-START/END) that tests/games3.test.js extracts and runs in Node. */
(() => {

/* ENGINE-START */
function chessEngine() {
  const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
  const KN = [33, 31, 18, 14, -33, -31, -18, -14], BI = [17, 15, -17, -15], RO = [16, -16, 1, -1], KI = [17, 15, -17, -15, 16, -16, 1, -1];
  const MASK = new Int8Array(128).fill(15);
  MASK[0] = 13; MASK[4] = 12; MASK[7] = 14; MASK[112] = 7; MASK[116] = 3; MASK[119] = 11;
  const INF = 32000, MATE = 30000;
  const VAL = [0, 100, 320, 330, 500, 900, 0];
  const PST = [null,
    [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
    [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
    [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
    [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
    [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
    [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20]
  ];
  const KEND = [-50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30, -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50];
  const FILES = 'abcdefgh';
  const sqName = (s) => FILES[s & 7] + ((s >> 4) + 1);
  const sqFrom = (n) => (n.charCodeAt(1) - 49) * 16 + (n.charCodeAt(0) - 97);

  function newPos() { return { b: new Int8Array(128), turn: 0, castle: 0, ep: -1, half: 0, full: 1, k: [4, 116], st: [] }; }
  function fromFEN(fen) {
    const p = newPos(), f = String(fen).trim().split(/\s+/);
    let r = 7, c = 0;
    for (const ch of f[0]) {
      if (ch === '/') { r--; c = 0; continue; }
      if (ch >= '1' && ch <= '8') { c += +ch; continue; }
      const t = 'pnbrqk'.indexOf(ch.toLowerCase()) + 1;
      if (t < 1 || r < 0 || c > 7) continue;
      const col = ch === ch.toLowerCase() ? 8 : 0, sq = r * 16 + c;
      p.b[sq] = t | col; if (t === K) p.k[col ? 1 : 0] = sq;
      c++;
    }
    p.turn = f[1] === 'b' ? 1 : 0;
    const cs = f[2] || '-';
    p.castle = (cs.includes('K') ? 1 : 0) | (cs.includes('Q') ? 2 : 0) | (cs.includes('k') ? 4 : 0) | (cs.includes('q') ? 8 : 0);
    p.ep = f[3] && f[3] !== '-' ? sqFrom(f[3]) : -1;
    p.half = +f[4] || 0; p.full = +f[5] || 1;
    return p;
  }
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  function toFEN(p) {
    let s = '';
    for (let r = 7; r >= 0; r--) {
      let e = 0;
      for (let c = 0; c < 8; c++) {
        const v = p.b[r * 16 + c];
        if (!v) { e++; continue; }
        if (e) { s += e; e = 0; }
        const ch = 'pnbrqk'[(v & 7) - 1]; s += v & 8 ? ch : ch.toUpperCase();
      }
      if (e) s += e;
      if (r) s += '/';
    }
    const cs = (p.castle & 1 ? 'K' : '') + (p.castle & 2 ? 'Q' : '') + (p.castle & 4 ? 'k' : '') + (p.castle & 8 ? 'q' : '');
    return s + ' ' + (p.turn ? 'b' : 'w') + ' ' + (cs || '-') + ' ' + (p.ep >= 0 ? sqName(p.ep) : '-') + ' ' + p.half + ' ' + p.full;
  }
  function clone(p) { return { b: p.b.slice(), turn: p.turn, castle: p.castle, ep: p.ep, half: p.half, full: p.full, k: p.k.slice(), st: [] }; }

  function attacked(p, sq, by) {
    const b = p.b, c = by << 3;
    let s;
    if (by === 0) {
      s = sq - 15; if (!(s & 0x88) && b[s] === P) return true;
      s = sq - 17; if (!(s & 0x88) && b[s] === P) return true;
    } else {
      s = sq + 15; if (!(s & 0x88) && b[s] === (P | 8)) return true;
      s = sq + 17; if (!(s & 0x88) && b[s] === (P | 8)) return true;
    }
    for (let i = 0; i < 8; i++) {
      s = sq + KN[i]; if (!(s & 0x88) && b[s] === (N | c)) return true;
      s = sq + KI[i]; if (!(s & 0x88) && b[s] === (K | c)) return true;
    }
    for (let i = 0; i < 4; i++) {
      let d = BI[i]; s = sq + d;
      while (!(s & 0x88)) { const v = b[s]; if (v) { if (v === (B | c) || v === (Q | c)) return true; break; } s += d; }
      d = RO[i]; s = sq + d;
      while (!(s & 0x88)) { const v = b[s]; if (v) { if (v === (R | c) || v === (Q | c)) return true; break; } s += d; }
    }
    return false;
  }
  const inCheck = (p) => attacked(p, p.k[p.turn], p.turn ^ 1);

  /* move = from | to << 7 | promo << 14 | flag << 17 (flag 1 en passant, 2 castle, 4 double push) */
  function gen(p, caps) {
    const b = p.b, us = p.turn, c = us << 3, out = [];
    for (let sq = 0; sq < 120; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const pc = b[sq];
      if (!pc || (pc & 8) !== c) continue;
      const t = pc & 7;
      if (t === P) {
        const dir = us ? -16 : 16, last = us ? 0 : 7, start = us ? 6 : 1;
        let to = sq + dir;
        if (!(to & 0x88) && !b[to]) {
          if ((to >> 4) === last) { for (let pr = Q; pr >= N; pr--) { if (!caps || pr === Q) out.push(sq | to << 7 | pr << 14); } }
          else if (!caps) {
            out.push(sq | to << 7);
            const to2 = to + dir;
            if ((sq >> 4) === start && !b[to2]) out.push(sq | to2 << 7 | 4 << 17);
          }
        }
        for (let k = -1; k <= 1; k += 2) {
          to = sq + dir + k;
          if (to & 0x88) continue;
          const v = b[to];
          if (v && (v & 8) !== c) {
            if ((to >> 4) === last) { for (let pr = Q; pr >= N; pr--) out.push(sq | to << 7 | pr << 14); }
            else out.push(sq | to << 7);
          } else if (!v && to === p.ep) out.push(sq | to << 7 | 1 << 17);
        }
        continue;
      }
      if (t === N || t === K) {
        const offs = t === N ? KN : KI;
        for (let i = 0; i < 8; i++) {
          const to = sq + offs[i];
          if (to & 0x88) continue;
          const v = b[to];
          if (!v) { if (!caps) out.push(sq | to << 7); }
          else if ((v & 8) !== c) out.push(sq | to << 7);
        }
        if (t === K && !caps) {
          const them = us ^ 1;
          if (us === 0 && sq === 4) {
            if ((p.castle & 1) && !b[5] && !b[6] && b[7] === R && !attacked(p, 4, them) && !attacked(p, 5, them) && !attacked(p, 6, them)) out.push(4 | 6 << 7 | 2 << 17);
            if ((p.castle & 2) && !b[3] && !b[2] && !b[1] && b[0] === R && !attacked(p, 4, them) && !attacked(p, 3, them) && !attacked(p, 2, them)) out.push(4 | 2 << 7 | 2 << 17);
          } else if (us === 1 && sq === 116) {
            if ((p.castle & 4) && !b[117] && !b[118] && b[119] === (R | 8) && !attacked(p, 116, them) && !attacked(p, 117, them) && !attacked(p, 118, them)) out.push(116 | 118 << 7 | 2 << 17);
            if ((p.castle & 8) && !b[115] && !b[114] && !b[113] && b[112] === (R | 8) && !attacked(p, 116, them) && !attacked(p, 115, them) && !attacked(p, 114, them)) out.push(116 | 114 << 7 | 2 << 17);
          }
        }
        continue;
      }
      const dirs = t === B ? BI : (t === R ? RO : KI);
      const n = t === Q ? 8 : 4;
      for (let i = 0; i < n; i++) {
        const d = dirs[i];
        let to = sq + d;
        while (!(to & 0x88)) {
          const v = b[to];
          if (!v) { if (!caps) out.push(sq | to << 7); }
          else { if ((v & 8) !== c) out.push(sq | to << 7); break; }
          to += d;
        }
      }
    }
    return out;
  }

  function make(p, m) {
    const b = p.b, from = m & 127, to = (m >> 7) & 127, promo = (m >> 14) & 7, fl = m >> 17, pc = b[from], us = p.turn;
    let cap = b[to];
    if (fl & 1) { const cs = us ? to + 16 : to - 16; cap = b[cs]; b[cs] = 0; }
    p.st.push(cap, p.castle, p.ep, p.half, pc);
    p.ep = -1;
    b[to] = pc; b[from] = 0;
    if (fl & 2) {
      if (to > from) { b[to - 1] = b[to + 1]; b[to + 1] = 0; } else { b[to + 1] = b[to - 2]; b[to - 2] = 0; }
    }
    if (promo) b[to] = promo | (us << 3);
    if (fl & 4) p.ep = (from + to) >> 1;
    if ((pc & 7) === K) p.k[us] = to;
    p.castle &= MASK[from] & MASK[to];
    p.half = ((pc & 7) === P || cap) ? 0 : p.half + 1;
    if (us) p.full++;
    p.turn = us ^ 1;
  }
  function unmake(p, m) {
    const b = p.b, from = m & 127, to = (m >> 7) & 127, fl = m >> 17, st = p.st;
    const pc = st.pop(); p.half = st.pop(); p.ep = st.pop(); p.castle = st.pop(); const cap = st.pop();
    p.turn ^= 1;
    const us = p.turn;
    if (us) p.full--;
    b[from] = pc;
    if (fl & 1) { b[to] = 0; b[us ? to + 16 : to - 16] = cap; } else b[to] = cap;
    if (fl & 2) {
      if (to > from) { b[to + 1] = b[to - 1]; b[to - 1] = 0; } else { b[to - 2] = b[to + 1]; b[to + 1] = 0; }
    }
    if ((pc & 7) === K) p.k[us] = from;
  }
  function legalMoves(p) {
    const ms = gen(p, false), out = [], us = p.turn;
    for (let i = 0; i < ms.length; i++) {
      make(p, ms[i]);
      if (!attacked(p, p.k[us], us ^ 1)) out.push(ms[i]);
      unmake(p, ms[i]);
    }
    return out;
  }
  function perft(p, d) {
    if (d === 0) return 1;
    const ms = gen(p, false), us = p.turn;
    let n = 0;
    for (let i = 0; i < ms.length; i++) {
      make(p, ms[i]);
      if (!attacked(p, p.k[us], us ^ 1)) n += d === 1 ? 1 : perft(p, d - 1);
      unmake(p, ms[i]);
    }
    return n;
  }

  /* ----- draws and status ----- */
  function insufficient(p) {
    let minors = 0, bishopsSq = [], knights = 0;
    for (let sq = 0; sq < 120; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const t = p.b[sq] & 7;
      if (!t || t === K) continue;
      if (t === P || t === R || t === Q) return false;
      minors++;
      if (t === N) knights++; else bishopsSq.push(((sq >> 4) + (sq & 7)) & 1);
    }
    if (minors <= 1) return true;
    if (knights === 0 && bishopsSq.every((x) => x === bishopsSq[0])) return true;
    return false;
  }
  /* A position key for repetition (the en passant square only counts when a capture is possible). */
  function posKey(p) {
    let s = '';
    for (let sq = 0; sq < 120; sq++) { if (sq & 0x88) { sq += 7; continue; } s += String.fromCharCode(48 + p.b[sq]); }
    let ep = '-';
    if (p.ep >= 0) {
      const dir = p.turn ? -16 : 16;
      for (let k = -1; k <= 1; k += 2) {
        const f = p.ep - dir + k;
        if (!(f & 0x88) && p.b[f] === (P | (p.turn << 3))) ep = sqName(p.ep);
      }
    }
    return s + p.turn + p.castle + ep;
  }
  /* keys: posKey of every position since the start, including the current one. */
  function status(p, keys) {
    if (!legalMoves(p).length) return inCheck(p) ? 'checkmate' : 'stalemate';
    if (insufficient(p)) return 'insufficient';
    if (p.half >= 100) return 'fifty';
    if (keys) {
      const k = posKey(p); let n = 0;
      for (let i = 0; i < keys.length; i++) if (keys[i] === k) n++;
      if (n >= 3) return 'threefold';
    }
    return 'playing';
  }

  function san(p, m) {
    const from = m & 127, to = (m >> 7) & 127, promo = (m >> 14) & 7, fl = m >> 17, pc = p.b[from], t = pc & 7;
    let s;
    if (fl & 2) s = to > from ? 'O-O' : 'O-O-O';
    else {
      const cap = p.b[to] || (fl & 1);
      if (t === P) {
        s = (cap ? FILES[from & 7] + 'x' : '') + sqName(to);
        if (promo) s += '=' + 'PNBRQK'[promo - 1];
      } else {
        s = 'PNBRQK'[t - 1];
        const others = legalMoves(p).filter((x) => (x & 127) !== from && ((x >> 7) & 127) === to && (p.b[x & 127] & 7) === t);
        if (others.length) {
          const sameFile = others.some((x) => (x & 7) === (from & 7)), sameRank = others.some((x) => ((x & 127) >> 4) === (from >> 4));
          if (!sameFile) s += FILES[from & 7]; else if (!sameRank) s += (from >> 4) + 1; else s += sqName(from);
        }
        s += (cap ? 'x' : '') + sqName(to);
      }
    }
    make(p, m);
    if (inCheck(p)) s += legalMoves(p).length ? '+' : '#';
    unmake(p, m);
    return s;
  }
  const moveStr = (m) => sqName(m & 127) + sqName((m >> 7) & 127) + (((m >> 14) & 7) ? 'nbrq'[((m >> 14) & 7) - 2] : '');

  /* ----- evaluation and search ----- */
  function evaluate(p) {
    const b = p.b;
    let score = 0, mat = 0, wk = 0, bk = 0;
    for (let sq = 0; sq < 120; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const v = b[sq];
      if (!v) continue;
      const t = v & 7, r = sq >> 4, f = sq & 7;
      if (t === K) { if (v & 8) bk = sq; else wk = sq; continue; }
      if (t > P) mat += VAL[t];
      if (v & 8) score -= VAL[t] + PST[t][r * 8 + f]; else score += VAL[t] + PST[t][(7 - r) * 8 + f];
    }
    const end = mat <= 2600;
    const kt = end ? KEND : PST[6];
    score += kt[(7 - (wk >> 4)) * 8 + (wk & 7)] - kt[(bk >> 4) * 8 + (bk & 7)];
    return (p.turn ? -score : score) + 8;
  }
  function orderScore(p, m, S, ply) {
    const to = (m >> 7) & 127, promo = (m >> 14) & 7, v = p.b[to];
    let s = 0;
    if (v) s = 10000 + VAL[v & 7] * 10 - (p.b[m & 127] & 7);
    else if ((m >> 17) & 1) s = 10100;
    if (promo) s += 9000 + promo;
    if (!s && S.killers[ply]) { if (S.killers[ply][0] === m) s = 8000; else if (S.killers[ply][1] === m) s = 7000; }
    return s;
  }
  function sortMoves(p, ms, S, ply) {
    const sc = ms.map((m) => orderScore(p, m, S, ply)), idx = ms.map((_, i) => i);
    idx.sort((a, b) => sc[b] - sc[a]);
    return idx.map((i) => ms[i]);
  }
  function qs(p, alpha, beta, S, q) {
    S.nodes++;
    const stand = evaluate(p);
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (q >= 6) return alpha;
    const us = p.turn, ms = sortMoves(p, gen(p, true), S, 99);
    for (let i = 0; i < ms.length; i++) {
      make(p, ms[i]);
      if (attacked(p, p.k[us], us ^ 1)) { unmake(p, ms[i]); continue; }
      const sc = -qs(p, -beta, -alpha, S, q + 1);
      unmake(p, ms[i]);
      if (sc >= beta) return sc;
      if (sc > alpha) alpha = sc;
    }
    return alpha;
  }
  function negamax(p, depth, alpha, beta, ply, S) {
    S.nodes++;
    const us = p.turn, chk = attacked(p, p.k[us], us ^ 1);
    if (chk && ply < 8) depth++;
    if (depth <= 0) return qs(p, alpha, beta, S, 0);
    if (p.half >= 100) return 0;
    const ms = sortMoves(p, gen(p, false), S, ply);
    let legal = 0, best = -INF;
    for (let i = 0; i < ms.length; i++) {
      const m = ms[i];
      make(p, m);
      if (attacked(p, p.k[us], us ^ 1)) { unmake(p, m); continue; }
      legal++;
      const sc = -negamax(p, depth - 1, -beta, -alpha, ply + 1, S);
      unmake(p, m);
      if (sc > best) best = sc;
      if (sc > alpha) alpha = sc;
      if (alpha >= beta) {
        if (!p.b[(m >> 7) & 127] && !((m >> 14) & 7)) {
          const k = S.killers[ply] || (S.killers[ply] = [0, 0]);
          if (k[0] !== m) { k[1] = k[0]; k[0] = m; }
        }
        break;
      }
    }
    if (!legal) return chk ? -MATE + ply : 0;
    return best;
  }
  /* A resumable root search: each step() searches one root move, so a caller can yield to the UI between steps.
     opts: noise (centipawns; picks randomly among moves within that of the best), avoid (Set of posKeys to discourage). */
  function searcher(p0, depth, opts) {
    opts = opts || {};
    const p = clone(p0), S = { nodes: 0, killers: [] }, noise = opts.noise || 0, avoid = opts.avoid;
    const roots = sortMoves(p, legalMoves(p), S, 0), scores = [];
    let i = 0, best = -INF;
    return {
      total: roots.length, nodes: () => S.nodes,
      step() {
        if (i >= roots.length) return true;
        const m = roots[i++];
        make(p, m);
        let sc = -negamax(p, depth - 1, -INF, best === -INF ? INF : -(best - noise - 1), 1, S);
        if (avoid && avoid.has(posKey(p))) sc -= 60;
        unmake(p, m);
        scores.push(sc);
        if (sc > best) best = sc;
        return i >= roots.length;
      },
      result() {
        if (!roots.length) return 0;
        const ok = [];
        for (let j = 0; j < scores.length; j++) if (scores[j] >= best - noise) ok.push(roots[j]);
        return ok[Math.floor(Math.random() * ok.length)];
      }
    };
  }
  function search(p, depth, opts) { const s = searcher(p, depth, opts); while (!s.step()); return s.result(); }

  return { P, N, B, R, Q, K, START, fromFEN, toFEN, clone, legalMoves, make, unmake, perft, inCheck, status, posKey, san, moveStr, sqName, sqFrom, searcher, search, insufficient, evaluate, attacked, gen };
}
/* ENGINE-END */

const CE = chessEngine();
const PIECE_VAL = [0, 1, 3, 3, 5, 9, 0];
const store = {
  get(k, d) { try { return Store.get('fun3.' + k, d); } catch (e) { return d; } },
  set(k, v) { try { Store.set('fun3.' + k, v); } catch (e) { /* storage unavailable */ } }
};

/* shared board styling for both games (colours of the board itself are fixed, like a real board) */
const BOARD_CSS = `<style>
.g3b{display:grid;grid-template-columns:repeat(8,1fr);width:100%;max-width:440px;margin:8px auto;aspect-ratio:1;border:2px solid var(--line);border-radius:6px;overflow:hidden;user-select:none;-webkit-user-select:none}
.g3c{position:relative;display:flex;align-items:center;justify-content:center;font-size:clamp(26px,9vw,44px);line-height:1;padding:0;margin:0;border:0;border-radius:0;min-width:0;min-height:0;cursor:pointer;color:#111;overflow:hidden}
.g3c.l{background:#f0d9b5}.g3c.d{background:#b58863}
.g3c.last{box-shadow:inset 0 0 0 100px rgba(255,230,60,.45)}
.g3c.sel{box-shadow:inset 0 0 0 3px #1f8f46,inset 0 0 0 100px rgba(60,200,100,.35)}
.g3c.chk{box-shadow:inset 0 0 14px 7px rgba(230,30,30,.95)}
.g3c.must{box-shadow:inset 0 0 0 3px #e08a00}
.g3c.mv::after{content:'';position:absolute;width:30%;height:30%;border-radius:50%;background:rgba(20,110,50,.6)}
.g3c.cp::after{content:'';position:absolute;inset:6%;border-radius:50%;border:4px solid rgba(20,110,50,.6)}
.g3c[data-r]::before{content:attr(data-r);position:absolute;top:1px;left:2px;font-size:9px;font-weight:700;color:rgba(0,0,0,.55)}
.g3c[data-f]:not(.mv):not(.cp)::after{content:attr(data-f);position:absolute;bottom:0;right:2px;font-size:9px;font-weight:700;color:rgba(0,0,0,.55)}
.g3p.w{color:#fff;text-shadow:0 0 2px #000,0 0 2px #000,0 1px 2px #000}
.g3p.b{color:#151515;text-shadow:0 0 2px rgba(255,255,255,.55)}
.g3k{display:flex;align-items:center;gap:6px;min-height:30px;font-size:22px;line-height:1.1;flex-wrap:wrap}
.g3k .g3p.w{text-shadow:0 0 2px #000,0 0 2px #000}.g3k small{font-size:13px;color:var(--muted)}
.g3pr{display:flex;gap:8px;justify-content:center;margin:6px 0}.g3pr button{font-size:34px;min-width:60px;min-height:56px;background:#f0d9b5;border:2px solid var(--line);border-radius:10px;color:#111}
.g3ml{max-height:110px;overflow:auto;font-size:14px;line-height:1.7}
.g3st{font-weight:700;text-align:center;min-height:24px}
</style>`;
const sel3 = (id, label, opts, val) => `<label class="f">${label}<select id="${id}" aria-label="${label}">${opts.map((o) => `<option value="${o[0]}"${String(o[0]) === String(val) ? ' selected' : ''}>${o[1]}</option>`).join('')}</select></label>`;

/* ---------- CHESS UI ---------- */
const CGLYPH = ['', '♟', '♞', '♝', '♜', '♛', '♚'];
const CNAME = ['', 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];
const pieceHtml = (v) => `<span class="g3p ${v & 8 ? 'b' : 'w'}">${CGLYPH[v & 7]}&#xFE0E;</span>`;
const CLEVEL = [[1, 'Easy'], [2, 'Medium'], [3, 'Hard']];
const CDEPTH = { 1: [2, 90], 2: [3, 12], 3: [4, 0] };
const CMSG = { stalemate: 'Stalemate, draw', insufficient: 'Draw, not enough pieces to mate', fifty: 'Draw, fifty-move rule', threefold: 'Draw, same position three times' };

/* Runs a search without blocking the page: in a Worker built from a Blob, or (no Worker) in short slices on the main thread. */
function makeRunner() {
  let worker = null, workerBad = typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL;
  let url = null, reqId = 0, pending = null, timers = [];
  function ensure() {
    if (worker || workerBad) return;
    try {
      const code = '(' + chessEngine.toString() + ')();';
      const full = 'const E = ' + code + 'onmessage = (e) => { const d = e.data; try { const p = E.fromFEN(d.fen); const s = E.searcher(p, d.depth, { noise: d.noise, avoid: new Set(d.avoid) }); while (!s.step()); postMessage({ id: d.id, move: s.result() }); } catch (err) { postMessage({ id: d.id, error: String(err) }); } };';
      url = URL.createObjectURL(new Blob([full], { type: 'text/javascript' }));
      worker = new Worker(url);
      worker.onmessage = (e) => { const d = e.data || {}; if (pending && d.id === pending.id) { const p = pending; pending = null; if (d.error) fallback(p); else p.cb(d.move); } };
      worker.onerror = () => { workerBad = true; kill(); if (pending) { const p = pending; pending = null; fallback(p); } };
    } catch (e) { workerBad = true; kill(); }
  }
  function kill() { if (worker) { try { worker.terminate(); } catch (e) { /* ignore */ } worker = null; } if (url) { try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ } url = null; } }
  function fallback(req) {
    const s = CE.searcher(CE.fromFEN(req.fen), req.depth, { noise: req.noise, avoid: new Set(req.avoid) });
    const tick = () => {
      if (req.dead) return;
      const t0 = Date.now();
      for (;;) { if (s.step()) { req.dead = true; req.cb(s.result()); return; } if (Date.now() - t0 > 40) break; }
      timers.push(setTimeout(tick, 0));
    };
    tick();
  }
  return {
    ask(fen, depth, noise, avoid, cb) {
      this.cancel();
      const req = { id: ++reqId, fen, depth, noise, avoid, cb, dead: false };
      ensure();
      if (worker && !workerBad) {
        pending = req;
        worker.postMessage({ id: req.id, fen, depth, noise, avoid });
        /* a worker that never answers (blocked by the environment) falls back to the main thread */
        timers.push(setTimeout(() => { if (pending === req) { pending = null; workerBad = true; kill(); fallback(req); } }, 12000));
      } else fallback(req);
      this.cur = req;
    },
    cancel() { if (pending) pending.dead = true; pending = null; if (this.cur) this.cur.dead = true; this.cur = null; timers.forEach(clearTimeout); timers = []; },
    dispose() { this.cancel(); kill(); }
  };
}

function renderChess(el) {
  let alive = true, runner = null, thinkTimer = null;
  const set = Object.assign({ mode: 'cpu', side: 'w', level: 2 }, store.get('chess.set', {}));
  let G = null, V = null;     /* G = saved game record, V = derived view state */

  function replay() {
    const p = CE.fromFEN(CE.START), keys = [CE.posKey(p)], sans = [], caps = [[], []];
    for (const m of G.moves) {
      const to = (m >> 7) & 127, victim = (m >> 17) & 1 ? (p.turn ? 1 : 9) : p.b[to];
      sans.push(CE.san(p, m));
      if (victim) caps[p.turn].push(victim);
      CE.make(p, m); keys.push(CE.posKey(p));
    }
    V = { pos: p, keys, sans, caps, sel: -1, targets: [], promo: null, status: CE.status(p, keys), thinking: false };
  }
  function loadGame() {
    const g = store.get('chess.game', null);
    if (!g || !Array.isArray(g.moves) || (g.mode !== 'cpu' && g.mode !== 'two')) return null;
    const p = CE.fromFEN(CE.START);
    for (const m of g.moves) {
      if (!Number.isInteger(m) || !CE.legalMoves(p).includes(m)) return null;
      CE.make(p, m);
    }
    return { moves: g.moves.slice(), mode: g.mode, human: g.human === 1 ? 1 : 0, level: [1, 2, 3].includes(g.level) ? g.level : 2, flip: !!g.flip };
  }
  const save = () => store.set('chess.game', { moves: G.moves, mode: G.mode, human: G.human, level: G.level, flip: G.flip });
  const cpuTurn = () => G.mode === 'cpu' && V.pos.turn !== G.human;

  function setup() {
    stopThinking();
    el.innerHTML = BOARD_CSS + `<div class="card">
      ${sel3('c-mode', 'Mode', [['cpu', 'Play the phone'], ['two', '2 players, one phone']], set.mode)}
      <div id="c-opts">
      ${sel3('c-side', 'You play', [['w', 'White (move first)'], ['b', 'Black'], ['r', 'Random']], set.side)}
      ${sel3('c-level', 'Phone level', CLEVEL, set.level)}
      </div>
      <button class="btn" id="c-start" style="margin-top:12px">Start game</button></div>
      <p class="muted center" style="font-size:13px">Full rules: castling, en passant, promotion, check, checkmate, stalemate, repetition and the fifty-move rule.</p>`;
    const sync = () => { $('#c-opts', el).style.display = $('#c-mode', el).value === 'cpu' ? '' : 'none'; };
    $('#c-mode', el).onchange = sync; sync();
    $('#c-start', el).onclick = () => {
      set.mode = $('#c-mode', el).value === 'two' ? 'two' : 'cpu';
      set.side = ['w', 'b', 'r'].includes($('#c-side', el).value) ? $('#c-side', el).value : 'w';
      set.level = Valid.clamp($('#c-level', el).value, 1, 3, 2);
      store.set('chess.set', set);
      const human = set.side === 'r' ? (Math.random() < 0.5 ? 0 : 1) : (set.side === 'b' ? 1 : 0);
      G = { moves: [], mode: set.mode, human, level: set.level, flip: set.mode === 'cpu' && human === 1 };
      save(); replay(); draw(); think();
    };
  }

  function statusText() {
    const s = V.status, p = V.pos;
    if (s === 'checkmate') return 'Checkmate, ' + (p.turn ? 'White' : 'Black') + ' wins';
    if (CMSG[s]) return CMSG[s];
    if (V.thinking) return 'Phone is thinking…';
    const chk = CE.inCheck(p) ? ' (check)' : '';
    if (G.mode === 'cpu') return (p.turn === G.human ? 'Your move' : 'Phone to move') + chk;
    return (p.turn ? 'Black' : 'White') + ' to move' + chk;
  }
  function capturedHtml(color) {   /* pieces the given colour has captured (shown as the opposite colour's pieces) */
    const list = V.caps[color].slice().sort((a, b) => (b & 7) - (a & 7));
    const mine = V.caps[color].reduce((s, v) => s + PIECE_VAL[v & 7], 0), theirs = V.caps[color ^ 1].reduce((s, v) => s + PIECE_VAL[v & 7], 0);
    const diff = mine - theirs;
    return `<div class="g3k" aria-label="${color ? 'Black' : 'White'} captured">${list.map(pieceHtml).join('')}${diff > 0 ? `<small>+${diff}</small>` : ''}</div>`;
  }
  function boardHtml() {
    const p = V.pos, last = G.moves.length ? G.moves[G.moves.length - 1] : -1;
    const lf = last >= 0 ? last & 127 : -1, lt = last >= 0 ? (last >> 7) & 127 : -1;
    const kingSq = V.status !== 'playing' && V.status !== 'checkmate' ? -1 : (CE.inCheck(p) ? p.k[p.turn] : -1);
    let h = '';
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      const rank = G.flip ? i : 7 - i, file = G.flip ? 7 - j : j, sq = rank * 16 + file, v = p.b[sq];
      const cls = ['g3c', (rank + file) & 1 ? 'l' : 'd'];
      if (sq === lf || sq === lt) cls.push('last');
      if (sq === kingSq) cls.push('chk');
      if (sq === V.sel) cls.push('sel');
      const tg = V.targets.includes(sq);
      if (tg) cls.push(v ? 'cp' : 'mv');
      const name = CE.sqName(sq), label = (v ? ((v & 8) ? 'black ' : 'white ') + CNAME[v & 7] + ' ' : 'empty ') + name;
      h += `<button class="${cls.join(' ')}" data-sq="${sq}" aria-label="${label}"${j === 0 ? ` data-r="${rank + 1}"` : ''}${i === 7 ? ` data-f="${'abcdefgh'[file]}"` : ''}>${v ? pieceHtml(v) : ''}</button>`;
    }
    return h;
  }
  function movesText() {
    let t = '';
    V.sans.forEach((s, i) => { t += (i % 2 === 0 ? (i / 2 + 1) + '. ' : '') + esc(s) + ' '; });
    return t || '<span class="muted">No moves yet</span>';
  }
  function draw() {
    if (!alive) return;
    const topColor = G.flip ? 0 : 1;
    el.innerHTML = BOARD_CSS + `<div class="g3st" id="c-st" role="status" aria-live="polite">${esc(statusText())}</div>
      ${capturedHtml(topColor ^ 1)}<div class="g3b" id="c-board">${boardHtml()}</div>${capturedHtml(topColor)}
      <div class="g3pr" id="c-promo" style="display:${V.promo ? 'flex' : 'none'}">${[5, 4, 3, 2].map((t) => `<button data-pr="${t}" aria-label="Promote to ${CNAME[t]}">${CGLYPH[t]}&#xFE0E;</button>`).join('')}</div>
      <div class="row"><button class="btn alt" id="c-undo">Undo</button><button class="btn alt" id="c-flip">Flip board</button><button class="btn alt" id="c-new">New game</button></div>
      <div class="card g3ml" id="c-list" style="margin-top:10px">${movesText()}</div>`;
    const list = $('#c-list', el); if (list) list.scrollTop = list.scrollHeight;
    $('#c-board', el).onclick = (e) => { const b = e.target.closest('.g3c'); if (b) tap(+b.dataset.sq); };
    $('#c-promo', el).onclick = (e) => { const b = e.target.closest('button[data-pr]'); if (b && V.promo) choosePromo(+b.dataset.pr); };
    $('#c-undo', el).onclick = undo;
    $('#c-flip', el).onclick = () => { G.flip = !G.flip; save(); draw(); };
    $('#c-new', el).onclick = () => { stopThinking(); G = null; store.set('chess.game', null); setup(); };
  }

  function tap(sq) {
    if (V.status !== 'playing' || V.thinking || V.promo || cpuTurn()) return;
    const p = V.pos, v = p.b[sq];
    if (V.sel >= 0) {
      const ms = CE.legalMoves(p).filter((m) => (m & 127) === V.sel && ((m >> 7) & 127) === sq);
      if (ms.length === 1) return play(ms[0]);
      if (ms.length > 1) { V.promo = { from: V.sel, to: sq }; return draw(); }
    }
    if (v && ((v & 8) >> 3) === p.turn && sq !== V.sel) {
      V.sel = sq; V.targets = CE.legalMoves(p).filter((m) => (m & 127) === sq).map((m) => (m >> 7) & 127);
    } else { V.sel = -1; V.targets = []; }
    draw();
  }
  function choosePromo(t) {
    const pr = V.promo; V.promo = null;
    const m = CE.legalMoves(V.pos).find((x) => (x & 127) === pr.from && ((x >> 7) & 127) === pr.to && ((x >> 14) & 7) === t);
    if (m) play(m); else draw();
  }
  function play(m) {
    G.moves.push(m);
    const p = V.pos, to = (m >> 7) & 127, victim = (m >> 17) & 1 ? (p.turn ? 1 : 9) : p.b[to];
    V.sans.push(CE.san(p, m));
    if (victim) V.caps[p.turn].push(victim);
    CE.make(p, m); V.keys.push(CE.posKey(p));
    V.sel = -1; V.targets = []; V.promo = null;
    V.status = CE.status(p, V.keys);
    save(); draw(); think();
  }
  function stopThinking() { if (thinkTimer) clearTimeout(thinkTimer); thinkTimer = null; if (runner) runner.cancel(); if (V) V.thinking = false; }
  function undo() {
    if (!G.moves.length) return;
    stopThinking();
    do { G.moves.pop(); replay(); } while (G.moves.length && G.mode === 'cpu' && V.pos.turn !== G.human);
    save(); draw(); think();
  }
  function think() {
    if (!alive || V.status !== 'playing' || !cpuTurn()) return;
    V.thinking = true;
    const st = $('#c-st', el); if (st) st.textContent = statusText();
    const [depth, noise] = CDEPTH[G.level] || CDEPTH[2], n0 = G.moves.length;
    thinkTimer = setTimeout(() => {
      thinkTimer = null;
      if (!alive) return;
      if (!runner) runner = makeRunner();
      const avoid = V.keys.slice(0, -1);
      runner.ask(CE.toFEN(V.pos), depth, noise, avoid, (m) => {
        if (!alive || G.moves.length !== n0 || !V.thinking) return;
        V.thinking = false;
        const legal = CE.legalMoves(V.pos);
        play(legal.includes(m) ? m : legal[Math.floor(Math.random() * legal.length)]);
      });
    }, 250);
  }

  G = loadGame();
  if (G) { replay(); if (V.status === 'playing' || G.moves.length) { draw(); think(); } else { G = null; setup(); } } else setup();
  return () => { alive = false; if (thinkTimer) clearTimeout(thinkTimer); if (runner) runner.dispose(); };
}

Tools.register({
  id: 'chess', name: 'Chess', icon: '♞', cat: 'fun',
  desc: 'Full-rules chess against the phone at three levels or with two players on one phone, with legal-move hints, undo, flip board and a saved game.',
  keys: ['board', 'game', 'checkmate', 'castling', 'knight', 'queen', 'strategy', 'puzzle'],
  needs: ['storage'], pro: false, render: renderChess
});

/* CHECKERS-START */
function checkersEngine() {
  /* squares are r * 8 + c, r = 0 is Red's home row. Dark squares have (r + c) even. Pieces: 1 red man, 2 red king, 3 black man, 4 black king. */
  const INF = 30000, MATE = 20000;
  const owner = (v) => (v > 2 ? 1 : 0), isKing = (v) => v === 2 || v === 4;
  const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  function dirsOf(v) { return isKing(v) ? DIAG : (owner(v) === 0 ? [[1, 1], [1, -1]] : [[-1, 1], [-1, -1]]); }
  const kingRow = (side) => (side === 0 ? 7 : 0);
  function start() {
    const b = new Array(64).fill(0);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { if ((r + c) % 2) continue; if (r < 3) b[r * 8 + c] = 1; else if (r > 4) b[r * 8 + c] = 3; }
    return { b, turn: 0, quiet: 0 };
  }
  function fromRows(rows, turn) {   /* test helper: 8 strings, top row first: . empty, r R red man/king, b B black man/king */
    const b = new Array(64).fill(0);
    rows.forEach((s, i) => { for (let c = 0; c < 8; c++) b[(7 - i) * 8 + c] = { r: 1, R: 2, b: 3, B: 4 }[s[c]] || 0; });
    return { b, turn: turn || 0, quiet: 0 };
  }
  function chain(b, sq, v, path, caps, out) {
    let found = false;
    const r = sq >> 3, c = sq & 7, side = owner(v), ds = dirsOf(v);
    for (let i = 0; i < ds.length; i++) {
      const mr = r + ds[i][0], mc = c + ds[i][1], lr = r + 2 * ds[i][0], lc = c + 2 * ds[i][1];
      if (lr < 0 || lr > 7 || lc < 0 || lc > 7) continue;
      const ms = mr * 8 + mc, mid = b[ms];
      if (!mid || owner(mid) === side || caps.indexOf(ms) >= 0 || b[lr * 8 + lc]) continue;
      found = true;
      const land = lr * 8 + lc, np = path.concat(land), nc = caps.concat(ms);
      if (!isKing(v) && lr === kingRow(side)) out.push({ path: np, caps: nc });   /* a man that reaches the far row ends its turn */
      else chain(b, land, v, np, nc, out);
    }
    if (!found && path.length > 1) out.push({ path, caps });
  }
  function moves(p) {
    const b = p.b, side = p.turn, jumps = [], simple = [];
    for (let sq = 0; sq < 64; sq++) {
      const v = b[sq];
      if (!v || owner(v) !== side) continue;
      b[sq] = 0; chain(b, sq, v, [sq], [], jumps); b[sq] = v;
      if (jumps.length) continue;
      const r = sq >> 3, c = sq & 7, ds = dirsOf(v);
      for (let i = 0; i < ds.length; i++) {
        const nr = r + ds[i][0], nc = c + ds[i][1];
        if (nr < 0 || nr > 7 || nc < 0 || nc > 7 || b[nr * 8 + nc]) continue;
        simple.push({ path: [sq, nr * 8 + nc], caps: [] });
      }
    }
    return jumps.length ? jumps : simple;
  }
  function apply(p, m) {
    const b = p.b.slice(), from = m.path[0], to = m.path[m.path.length - 1];
    let v = b[from];
    b[from] = 0;
    for (const s of m.caps) b[s] = 0;
    const man = !isKing(v);
    if (man && (to >> 3) === kingRow(owner(v))) v += 1;
    b[to] = v;
    return { b, turn: p.turn ^ 1, quiet: (m.caps.length || man) ? 0 : p.quiet + 1 };
  }
  /* 'playing', 'red' (Red wins), 'black' or 'draw' (80 half-moves without a capture or man move) */
  function status(p) {
    if (!moves(p).length) return p.turn === 0 ? 'black' : 'red';
    if (p.quiet >= 80) return 'draw';
    return 'playing';
  }
  function evaluate(p) {
    let s = 0;
    for (let sq = 0; sq < 64; sq++) {
      const v = p.b[sq];
      if (!v) continue;
      const side = owner(v), r = sq >> 3, c = sq & 7, adv = side === 0 ? r : 7 - r;
      let x = isKing(v) ? 170 : 100 + adv * 4;
      if (!isKing(v) && adv === 0) x += 8;                       /* back row guard */
      if (c > 1 && c < 6 && r > 1 && r < 6) x += 3;              /* centre */
      if (isKing(v) && (c === 0 || c === 7 || r === 0 || r === 7)) x -= 8;
      s += side === 0 ? x : -x;
    }
    return p.turn === 0 ? s : -s;
  }
  function negamax(p, depth, alpha, beta, ply) {
    const ms = moves(p);
    if (!ms.length) return -MATE + ply;
    if (p.quiet >= 80) return 0;
    if (depth <= 0 && (!ms[0].caps.length || ply > 16)) return evaluate(p);
    let best = -INF;
    for (let i = 0; i < ms.length; i++) {
      const sc = -negamax(apply(p, ms[i]), depth - 1, -beta, -alpha, ply + 1);
      if (sc > best) best = sc;
      if (sc > alpha) alpha = sc;
      if (alpha >= beta) break;
    }
    return best;
  }
  /* Resumable root search, one root move per step() (same idea as the chess engine). noise: random pick within that many points of the best. */
  function searcher(p, depth, opts) {
    opts = opts || {};
    const noise = opts.noise || 0, roots = moves(p), scores = [];
    let i = 0, best = -INF;
    return {
      total: roots.length,
      step() {
        if (i >= roots.length) return true;
        const m = roots[i++];
        const sc = -negamax(apply(p, m), depth - 1, -INF, best === -INF ? INF : -(best - noise - 1), 1);
        scores.push(sc);
        if (sc > best) best = sc;
        return i >= roots.length;
      },
      result() {
        const ok = [];
        for (let j = 0; j < scores.length; j++) if (scores[j] >= best - noise) ok.push(roots[j]);
        return ok.length ? ok[Math.floor(Math.random() * ok.length)] : null;
      }
    };
  }
  function search(p, depth, opts) { const s = searcher(p, depth, opts); while (!s.step()); return s.result(); }
  const sqName = (s) => 'abcdefgh'[s & 7] + ((s >> 3) + 1);
  const moveStr = (m) => m.path.map(sqName).join(m.caps.length ? 'x' : '-');
  return { start, fromRows, moves, apply, status, evaluate, searcher, search, moveStr, sqName, owner, isKing };
}
/* CHECKERS-END */

/* ---------- CHECKERS UI ---------- */
const CKE = checkersEngine();
const CK_CSS = `<style>
.g3d{width:78%;height:78%;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:62%;font-weight:700;box-shadow:0 2px 3px rgba(0,0,0,.5),inset 0 0 0 3px rgba(255,255,255,.28)}
.g3d.r{background:radial-gradient(circle at 35% 30%,#ff6b5e,#c62828 70%);color:#ffe9a8}
.g3d.b{background:radial-gradient(circle at 35% 30%,#555,#111 70%);color:#ffe9a8}
</style>`;
const CKLEVEL = { 1: [2, 40], 2: [4, 6], 3: [6, 0] };
const CKMSG = { red: 'Red wins', black: 'Black wins', draw: 'Draw, 40 moves each with no capture' };

function renderCheckers(el) {
  let alive = true, timer = null, job = 0;
  const set = Object.assign({ mode: 'cpu', side: 'r', level: 2 }, store.get('checkers.set', {}));
  let G = null, V = null;

  function replay() {
    let p = CKE.start();
    const sans = [];
    for (const path of G.moves) {
      const m = CKE.moves(p).find((x) => x.path.join() === path.join());
      sans.push(CKE.moveStr(m)); p = CKE.apply(p, m);
    }
    V = { pos: p, sans, sel: -1, chain: null, targets: [], status: CKE.status(p), thinking: false, ms: CKE.moves(p) };
  }
  function loadGame() {
    const g = store.get('checkers.game', null);
    if (!g || !Array.isArray(g.moves) || (g.mode !== 'cpu' && g.mode !== 'two')) return null;
    let p = CKE.start();
    for (const path of g.moves) {
      if (!Array.isArray(path)) return null;
      const m = CKE.moves(p).find((x) => x.path.join() === path.join());
      if (!m) return null;
      p = CKE.apply(p, m);
    }
    return { moves: g.moves.map((x) => x.slice()), mode: g.mode, human: g.human === 1 ? 1 : 0, level: [1, 2, 3].includes(g.level) ? g.level : 2, flip: !!g.flip };
  }
  const save = () => store.set('checkers.game', { moves: G.moves, mode: G.mode, human: G.human, level: G.level, flip: G.flip });
  const cpuTurn = () => G.mode === 'cpu' && V.pos.turn !== G.human;
  function stopThinking() { job++; if (timer) clearTimeout(timer); timer = null; if (V) V.thinking = false; }

  function setup() {
    stopThinking();
    el.innerHTML = BOARD_CSS + CK_CSS + `<div class="card">
      ${sel3('k-mode', 'Mode', [['cpu', 'Play the phone'], ['two', '2 players, one phone']], set.mode)}
      <div id="k-opts">
      ${sel3('k-side', 'You play', [['r', 'Red (move first)'], ['b', 'Black'], ['x', 'Random']], set.side)}
      ${sel3('k-level', 'Phone level', CLEVEL, set.level)}
      </div>
      <button class="btn" id="k-start" style="margin-top:12px">Start game</button></div>
      <p class="muted center" style="font-size:13px">English draughts: you must capture when you can, jumps can chain, a man that reaches the far row becomes a king.</p>`;
    const sync = () => { $('#k-opts', el).style.display = $('#k-mode', el).value === 'cpu' ? '' : 'none'; };
    $('#k-mode', el).onchange = sync; sync();
    $('#k-start', el).onclick = () => {
      set.mode = $('#k-mode', el).value === 'two' ? 'two' : 'cpu';
      set.side = ['r', 'b', 'x'].includes($('#k-side', el).value) ? $('#k-side', el).value : 'r';
      set.level = Valid.clamp($('#k-level', el).value, 1, 3, 2);
      store.set('checkers.set', set);
      const human = set.side === 'x' ? (Math.random() < 0.5 ? 0 : 1) : (set.side === 'b' ? 1 : 0);
      G = { moves: [], mode: set.mode, human, level: set.level, flip: set.mode === 'cpu' && human === 1 };
      save(); replay(); draw(); think();
    };
  }

  function statusText() {
    const s = V.status, p = V.pos;
    if (CKMSG[s]) return CKMSG[s];
    if (V.thinking) return 'Phone is thinking…';
    const must = V.ms.length && V.ms[0].caps.length ? ' (you must capture)' : '';
    const who = p.turn ? 'Black' : 'Red';
    if (G.mode === 'cpu') return (p.turn === G.human ? 'Your move, ' + who : 'Phone to move, ' + who) + (p.turn === G.human ? must : '');
    return who + ' to move' + must;
  }
  function boardHtml() {
    const p = V.pos, last = G.moves.length ? G.moves[G.moves.length - 1] : null;
    const lf = last ? last[0] : -1, lt = last ? last[last.length - 1] : -1;
    const must = new Set();
    if (V.status === 'playing' && V.ms.length && V.ms[0].caps.length && !V.chain && !cpuTurn()) V.ms.forEach((m) => must.add(m.path[0]));
    let h = '';
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      const r = G.flip ? i : 7 - i, c = G.flip ? 7 - j : j, sq = r * 8 + c, v = p.b[sq];
      const dark = (r + c) % 2 === 0, cls = ['g3c', dark ? 'd' : 'l'];
      if (sq === lf || sq === lt) cls.push('last');
      if (sq === V.sel || (V.chain && V.chain.includes(sq))) cls.push('sel');
      else if (must.has(sq)) cls.push('must');
      if (V.targets.includes(sq)) cls.push('mv');
      const name = CKE.sqName(sq), label = (v ? (CKE.owner(v) ? 'black ' : 'red ') + (CKE.isKing(v) ? 'king ' : 'man ') : 'empty ') + name;
      h += `<button class="${cls.join(' ')}" data-sq="${sq}" aria-label="${label}">${v ? `<span class="g3d ${CKE.owner(v) ? 'b' : 'r'}">${CKE.isKing(v) ? '♛&#xFE0E;' : ''}</span>` : ''}</button>`;
    }
    return h;
  }
  function movesText() {
    let t = '';
    V.sans.forEach((s, i) => { t += (i % 2 === 0 ? (i / 2 + 1) + '. ' : '') + esc(s) + ' '; });
    return t || '<span class="muted">No moves yet</span>';
  }
  function draw() {
    if (!alive) return;
    const red = V.pos.b.filter((v) => v === 1 || v === 2).length, blk = V.pos.b.filter((v) => v === 3 || v === 4).length;
    el.innerHTML = BOARD_CSS + CK_CSS + `<div class="g3st" id="k-st" role="status" aria-live="polite">${esc(statusText())}</div>
      <div class="muted center" style="font-size:13px">Red ${red} · Black ${blk}</div>
      <div class="g3b" id="k-board">${boardHtml()}</div>
      <div class="row"><button class="btn alt" id="k-undo">Undo</button><button class="btn alt" id="k-flip">Flip board</button><button class="btn alt" id="k-new">New game</button></div>
      <div class="card g3ml" id="k-list" style="margin-top:10px">${movesText()}</div>`;
    const list = $('#k-list', el); if (list) list.scrollTop = list.scrollHeight;
    $('#k-board', el).onclick = (e) => { const b = e.target.closest('.g3c'); if (b) tap(+b.dataset.sq); };
    $('#k-undo', el).onclick = undo;
    $('#k-flip', el).onclick = () => { G.flip = !G.flip; save(); draw(); };
    $('#k-new', el).onclick = () => { stopThinking(); G = null; store.set('checkers.game', null); setup(); };
  }

  /* continue a multi-jump: prefix is the squares chosen so far */
  function follow(prefix) {
    const n = prefix.length;
    const cands = V.ms.filter((m) => m.path.length >= n && prefix.every((s, i) => m.path[i] === s));
    const done = cands.find((m) => m.path.length === n);
    if (done) return play(done);
    V.chain = prefix; V.sel = -1;
    V.targets = [...new Set(cands.map((m) => m.path[n]))];
    draw();
  }
  function tap(sq) {
    if (V.status !== 'playing' || V.thinking || cpuTurn()) return;
    const p = V.pos, v = p.b[sq];
    if (V.chain) {
      if (V.targets.includes(sq)) return follow(V.chain.concat(sq));
      toast('Keep jumping with the same piece');
      return;
    }
    if (V.sel >= 0 && V.targets.includes(sq)) return follow([V.sel, sq]);
    if (v && CKE.owner(v) === p.turn) {
      const cands = V.ms.filter((m) => m.path[0] === sq);
      if (!cands.length) {
        V.sel = -1; V.targets = [];
        if (V.ms.length && V.ms[0].caps.length) toast('You must capture');
        return draw();
      }
      V.sel = sq; V.targets = [...new Set(cands.map((m) => m.path[1]))];
    } else { V.sel = -1; V.targets = []; }
    draw();
  }
  function play(m) {
    G.moves.push(m.path.slice());
    V.sans.push(CKE.moveStr(m));
    V.pos = CKE.apply(V.pos, m);
    V.sel = -1; V.chain = null; V.targets = []; V.ms = CKE.moves(V.pos); V.status = CKE.status(V.pos);
    save(); draw(); think();
  }
  function undo() {
    if (!G.moves.length) return;
    stopThinking();
    do { G.moves.pop(); replay(); } while (G.moves.length && G.mode === 'cpu' && V.pos.turn !== G.human);
    save(); draw(); think();
  }
  function think() {
    if (!alive || V.status !== 'playing' || !cpuTurn()) return;
    V.thinking = true;
    const st = $('#k-st', el); if (st) st.textContent = statusText();
    const [depth, noise] = CKLEVEL[G.level] || CKLEVEL[2], my = ++job, n0 = G.moves.length;
    timer = setTimeout(() => {
      timer = null;
      if (!alive || my !== job) return;
      const s = CKE.searcher(V.pos, depth, { noise });
      const tick = () => {
        if (!alive || my !== job) return;
        const t0 = Date.now();
        for (;;) {
          if (s.step()) {
            if (G.moves.length !== n0) return;
            V.thinking = false;
            const m = s.result() || V.ms[0];
            return play(m);
          }
          if (Date.now() - t0 > 40) break;
        }
        timer = setTimeout(tick, 0);
      };
      tick();
    }, 350);
  }

  G = loadGame();
  if (G) { replay(); draw(); think(); } else setup();
  return () => { alive = false; job++; if (timer) clearTimeout(timer); };
}

Tools.register({
  id: 'checkers', name: 'Checkers', icon: '🟥', cat: 'fun',
  desc: 'English draughts with forced captures, multi-jumps and kings, against the phone at three levels or two players on one phone, with undo and a saved game.',
  keys: ['draughts', 'board', 'game', 'jump', 'king', 'strategy'],
  needs: ['storage'], pro: false, render: renderCheckers
});

/* @@NEXT@@ */
})();
