'use strict';
/* PocketKit "Games 2": more offline games (category 'fun'). Pure logic lives in the object L (exported for the Node tests at the bottom).
   High scores are saved under Store keys 'fun2.<id>'. */
(() => {

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
function shuffle(a, rf) {
  a = a.slice(); rf = rf || rnd;
  for (let i = a.length - 1; i > 0; i--) { const j = rf(i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const p2 = (n) => String(n).padStart(2, '0');

/* ---------- five-letter word list (600+) ---------- */
const WORDS = (`about above abuse actor acute admit adopt adult after again agent agree ahead alarm album alert alike alive allow alone along alter among angel anger angle angry ankle apart apple apply arena argue arise armor array arrow aside asset atlas audio avoid awake award aware badly baker basic basin basis beach beard beast begin being below bench berry birth black blade blame blank blast blaze bleed blend bless blind block blood bloom board boast boost booth bound brain brand brave bread break breed brick bride brief bring broad broke brown brush build bunch burst buyer cabin cable candy carry carve catch cause chain chair chalk charm chart chase cheap check cheek cheer chess chest chief child chill china choir chose chunk civil claim class clean clear clerk click cliff climb clock close cloth cloud clown coach coast color comic coral couch could count court cover crack craft crane crash crawl crazy cream creek crest crime crisp cross crowd crown crush curve cycle daily dairy dance dealt death debut decay delay delta dense depth diary dirty doubt dozen draft drama drank drawn dream dress dried drift drill drink drive drown dying eager early earth eaten edge1 eight elbow elder elect elite empty enemy enjoy enter entry equal error essay event every exact exist extra fable faint fairy faith false fancy fatal fault feast fence ferry fever fewer fiber field fifth fifty fight final first flame flash fleet flesh float flock flood floor flour fluid flush focus force forge forth forty forum found frame frank fraud fresh front frost fruit fully funny ghost giant given glass globe glory glove going grace grade grain grand grant grape graph grass grave great green greet grief grill grind groan gross group grove grown guard guess guest guide habit happy harsh haste hatch heart heavy hedge hello hence honey honor horse hotel house human humor hurry ideal image imply index inner input irony issue ivory jelly jewel joint judge juice juicy knife knock known label labor large laser later laugh layer learn lease least leave legal lemon level lever light limit linen liver lobby local logic loose lover lower loyal lucky lunch lying magic major maker maple march match maybe mayor meant medal media melon mercy merge merit merry metal meter might minor minus mixed model money month moral motor mount mouse mouth movie music naive naked nasty naval nerve never newly night noble noise north novel nurse occur ocean offer often olive onion opera orbit order organ other ought outer owner paint panel panic paper party pasta patch pause peace peach pearl pedal phase phone photo piano piece pilot pitch pizza place plain plane plant plate plaza point polar pound power press price pride prime print prior prize proof proud prove pulse punch pupil queen query quest queue quick quiet quite quote radar radio raise rally ranch range rapid ratio reach react ready realm rebel refer relax reply rider ridge rifle right rigid rival river roast robot rocky roman rough round route royal rugby ruler rural sadly safer saint salad sauce scale scare scene scent scope score scout screw sense serve seven shade shake shall shame shape share shark sharp sheep sheer sheet shelf shell shift shine shirt shock shoot shore short shout shown shrug sight silly since sixth sixty skill skirt skull sleep slice slide slope small smart smell smile smoke snake solar solid solve sorry sound south space spare spark speak speed spell spend spice spike spine split spoke spoon sport spray squad stack staff stage stain stair stake stamp stand stare start state steak steal steam steel steep steer stick stiff still stock stone stood store storm story stove strap straw strip stuck study stuff style sugar suite sunny super sweet swept swift swing sword table taken taste teach tempo tenth thank theme there thick thing think third those three threw throw thumb tiger tight timer tired title toast today token tooth topic total touch tough towel tower trace track trade trail train trait trash treat trend trial tribe trick tried troop truck truly trunk trust truth twice twist ultra uncle under union unity until upper upset urban usage usual valid value valve vapor vault verse video vigor vinyl viral virus visit vital vivid vocal voice voter wagon waist waste watch water weary weave wedge weigh weird whale wheat wheel where which while white whole whose widow width witch woman world worry worse worst worth would wound wrist write wrong yacht yield young youth zebra
abbey abide acorn adapt adept admin agile aisle alley amber ample angst anvil aroma arrow attic aunty bacon badge bagel baton beech beret berth bible bingo birch bison blimp bonus brace brake brave brisk broom brook buddy buggy bugle bulky bully cabal cacao camel cameo canal canoe cargo cedar chaos cheat chime cider cigar clamp clasp cling cloak clump cobra cocoa comet comma condo cough crepe crumb cubic curry dandy decoy dodge donor donut dowry dryer dwarf eagle ember envoy epoch equip ethic exile fairy feral fetch fiery finch flair flask fleck flint flora flute foggy folly forte fudge fungi gamma gauge gecko genre glare gleam glide gloom gnome goose gouda gourd grape gravy grill guava gummy hairy halve haven hazel heron hiker hippo hobby holly hoist hound hover hyena icing igloo inbox inlet irate jaunt jazzy jewel jolly joker kayak kebab khaki kiosk koala lance lapse larva latch lathe lemur llama lodge loser lotus lucid lunar lyric macro madam mango manor maple marsh mason mocha moist molar moose motel mummy mural nacho nanny niche ninja noisy nomad novel nutty oasis ocean octet onset otter ounce oxide ozone paddy pagan pants parka patio pearl pecan penny perch petal piano picky piggy pixel plank plumb plume plump polka poppy porch poser pouch prawn prune pulpy puppy purse quail quake quirk quota rabbi radii rainy raven razor rebus recap relic remix rhyme rinse risky roomy rowdy rumba runny sassy satin savvy scalp scarf scoop scrub seize shawl shrub siren skate sleek slime sloth smash snack snore soapy sonic spade spicy spoil spore squid stale stern stink stomp stoop stray stump suave sulky surge swamp swarm swish syrup tabby taffy talon tango tapir tasty taunt tepid thorn thump tidal toady tonic topaz torch totem tulip tumor tuxedo twang tweed umbra uncut unfit untie usher utter vague vegan venom verge vicar villa vista vodka vowel wafer waltz wharf whisk wield witty woody yeast yodel zesty`)
  .split(/\s+/).filter((w, i, a) => /^[a-z]{5}$/.test(w) && a.indexOf(w) === i);

/* ---------- pure game logic ---------- */
const L = {};
L.WORDS = WORDS;

L.mulberry = function (a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
};

/* ---- Daily Challenge ---- */
L.dayKey = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
L.dayNum = (key) => { const [y, m, d] = key.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };
/* st = {streak, best, last}. Returns the new state after solving on day `key`. */
L.streakSolve = function (st, key) {
  st = Object.assign({ streak: 0, best: 0, last: '' }, st);
  if (st.last === key) return st;
  const gap = st.last ? L.dayNum(key) - L.dayNum(st.last) : 99;
  st.streak = gap === 1 ? st.streak + 1 : 1; st.last = key;
  st.best = Math.max(st.best, st.streak);
  return st;
};
/* Streak to show today: still alive if last solve was today or yesterday. */
L.streakShown = function (st, key) {
  if (!st || !st.last) return 0;
  const gap = L.dayNum(key) - L.dayNum(st.last);
  return gap <= 1 && gap >= 0 ? st.streak : 0;
};
function sortLetters(w) { return w.split('').sort().join(''); }
L.dailyPuzzle = function (key) {
  const n = L.dayNum(key), r = L.mulberry(n * 7919 + 13), ri = (a, b) => a + Math.floor(r() * (b - a + 1));
  const type = n % 3;
  if (type === 0) {
    const word = WORDS[Math.floor(r() * WORDS.length)];
    let s = word;
    for (let t = 0; t < 20 && s === word; t++) s = shuffle(word.split(''), (m) => Math.floor(r() * m)).join('');
    const sig = sortLetters(word), ok = WORDS.filter(w => sortLetters(w) === sig);
    return { type: 'scramble', title: 'Word scramble', prompt: 'Unscramble these letters to make a 5-letter word.', shown: s.toUpperCase().split('').join(' '), answers: ok, count: 1 };
  }
  if (type === 1) {
    const k = Math.floor(r() * 5); let t = [];
    if (k === 0) { const a = ri(2, 20), d = ri(2, 9); for (let i = 0; i < 6; i++) t.push(a + d * i); }
    else if (k === 1) { const a = ri(1, 4), q = ri(2, 3); for (let i = 0; i < 6; i++) t.push(a * Math.pow(q, i)); }
    else if (k === 2) { const a = ri(1, 7); for (let i = 0; i < 6; i++) t.push((a + i) * (a + i)); }
    else if (k === 3) { t = [ri(1, 5), ri(1, 5)]; for (let i = 2; i < 6; i++) t.push(t[i - 1] + t[i - 2]); }
    else { const a = ri(1, 10), d = ri(1, 3); t = [a]; for (let i = 0; i < 5; i++) t.push(t[i] + 2 + i * d); }
    return { type: 'sequence', title: 'Number sequence', prompt: 'What number comes next?', shown: t.slice(0, 5).join(',  ') + ',  ?', answers: [String(t[5])], count: 1 };
  }
  const qs = [], ans = [];
  const a1 = ri(3, 12), b1 = ri(3, 12), c1 = ri(1, 30);
  qs.push(a1 + ' x ' + b1 + ' + ' + c1); ans.push(String(a1 * b1 + c1));
  const x = ri(4, 12), y = ri(3, 9), z = ri(2, 6);
  qs.push((x * y) + ' / ' + y + ' + ' + z); ans.push(String(x + z));
  const b3 = ri(5, 19), c3 = ri(2, 9), a3 = b3 * c3 + ri(0, 40); /* never negative: a numeric keypad may have no minus key */
  qs.push(a3 + ' - ' + b3 + ' x ' + c3 + ' + 100'); ans.push(String(a3 - b3 * c3 + 100));
  return { type: 'math', title: 'Quick sums', prompt: 'Work out all three answers.', shown: qs, answers: ans, count: 3 };
};
L.dailyCheck = function (p, input) {
  if (p.type === 'math') return input.length === 3 && input.every((v, i) => String(v).trim() === p.answers[i]);
  return p.answers.indexOf(String(input[0] || '').trim().toLowerCase()) >= 0;
};

/* ---- Word Guess ---- */
/* Returns 5 marks: 'g' right place, 'y' wrong place, 'x' not in the word (duplicates handled). */
L.evalGuess = function (guess, answer) {
  const res = new Array(5).fill('x'), left = {};
  for (let i = 0; i < 5; i++) { if (guess[i] === answer[i]) res[i] = 'g'; else left[answer[i]] = (left[answer[i]] || 0) + 1; }
  for (let i = 0; i < 5; i++) if (res[i] === 'x' && left[guess[i]] > 0) { res[i] = 'y'; left[guess[i]]--; }
  return res;
};
L.shareGrid = function (rows, cb) {
  const G = cb ? '🟦' : '🟩', Y = cb ? '🟧' : '🟨';
  return rows.map(r => r.map(m => m === 'g' ? G : m === 'y' ? Y : '⬛').join('')).join('\n');
};

/* ---- Mastermind ---- */
L.mmFeedback = function (code, guess) {
  let b = 0; const cc = {}, gc = {};
  for (let i = 0; i < code.length; i++) {
    if (code[i] === guess[i]) b++; else { cc[code[i]] = (cc[code[i]] || 0) + 1; gc[guess[i]] = (gc[guess[i]] || 0) + 1; }
  }
  let w = 0; for (const k in gc) if (cc[k]) w += Math.min(cc[k], gc[k]);
  return { b, w };
};
L.mmCode = function (len, colors, repeats) {
  const out = [];
  while (out.length < len) { const c = rnd(colors); if (repeats || out.indexOf(c) < 0) out.push(c); }
  return out;
};

/* ---- Peg Solitaire (English board, 7x7 with corners cut) ---- */
const PEG_OK = (r, c) => r >= 0 && r < 7 && c >= 0 && c < 7 && (r >= 2 && r <= 4 || c >= 2 && c <= 4);
L.pegOk = PEG_OK;
L.pegStart = function () {
  const b = new Array(49).fill(-1);
  for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) if (PEG_OK(r, c)) b[r * 7 + c] = 1;
  b[24] = 0; return b;
};
L.pegMoves = function (b) {
  const out = [];
  for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
    if (b[r * 7 + c] !== 1) continue;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const r2 = r + dr * 2, c2 = c + dc * 2;
      if (PEG_OK(r2, c2) && b[(r + dr) * 7 + c + dc] === 1 && b[r2 * 7 + c2] === 0) out.push({ f: r * 7 + c, o: (r + dr) * 7 + c + dc, t: r2 * 7 + c2 });
    }
  }
  return out;
};
L.pegApply = function (b, m) { const n = b.slice(); n[m.f] = 0; n[m.o] = 0; n[m.t] = 1; return n; };
L.pegCount = (b) => b.filter(v => v === 1).length;

/* ---- Nonogram ---- */
L.ngRunClue = function (line) {
  const c = []; let n = 0;
  for (const v of line) { if (v) n++; else if (n) { c.push(n); n = 0; } }
  if (n) c.push(n); return c;
};
L.ngClues = function (g) {
  const n = g.length, cols = [];
  for (let c = 0; c < n; c++) cols.push(L.ngRunClue(g.map(r => r[c])));
  return { rows: g.map(L.ngRunClue), cols };
};
/* line = array of 0 (unknown) / 1 (filled) / 2 (empty). Returns the refined line, or null if contradictory. */
function lineSolve(clue, line) {
  const n = line.length, canF = new Array(n).fill(false), canE = new Array(n).fill(false), cur = new Array(n).fill(2);
  let any = false;
  (function rec(bi, pos) {
    if (bi === clue.length) {
      for (let i = pos; i < n; i++) if (line[i] === 1) return;
      for (let i = pos; i < n; i++) cur[i] = 2;
      any = true; for (let i = 0; i < n; i++) { if (cur[i] === 1) canF[i] = true; else canE[i] = true; }
      return;
    }
    const len = clue[bi], last = bi === clue.length - 1;
    const rem = clue.slice(bi + 1).reduce((a, b) => a + b + 1, 0);
    for (let s = pos; s + len + rem <= n; s++) {
      if (s > pos && line[s - 1] === 1) break;
      for (let i = pos; i < s; i++) cur[i] = 2;
      let ok = true;
      for (let i = s; i < s + len; i++) { if (line[i] === 2) { ok = false; break; } cur[i] = 1; }
      if (!ok) continue;
      if (!last) { if (line[s + len] === 1) continue; cur[s + len] = 2; rec(bi + 1, s + len + 1); } else rec(bi + 1, s + len);
    }
  })(0, 0);
  if (!any) return null;
  return line.map((v, i) => v ? v : canF[i] && !canE[i] ? 1 : canE[i] && !canF[i] ? 2 : 0);
}
/* Solves by line logic only. Returns {solved, grid(0/1/2)}. */
L.ngSolve = function (rows, cols) {
  const n = rows.length, g = []; for (let i = 0; i < n; i++) g.push(new Array(n).fill(0));
  let changed = true;
  while (changed) {
    changed = false;
    for (let r = 0; r < n; r++) {
      const nl = lineSolve(rows[r], g[r]); if (!nl) return { solved: false, grid: g };
      for (let c = 0; c < n; c++) if (nl[c] !== g[r][c]) { g[r][c] = nl[c]; changed = true; }
    }
    for (let c = 0; c < n; c++) {
      const nl = lineSolve(cols[c], g.map(r => r[c])); if (!nl) return { solved: false, grid: g };
      for (let r = 0; r < n; r++) if (nl[r] !== g[r][c]) { g[r][c] = nl[r]; changed = true; }
    }
  }
  return { solved: g.every(r => r.every(v => v)), grid: g };
};
L.ngGen = function (n, rf) {
  rf = rf || Math.random;
  for (let t = 0; t < 400; t++) {
    const g = [];
    for (let r = 0; r < n; r++) { const row = new Array(n).fill(0); for (let c = 0; c < Math.ceil(n / 2); c++) row[c] = row[n - 1 - c] = rf() < 0.58 ? 1 : 0; g.push(row); }
    const cl = L.ngClues(g);
    if (g.every(r => r.some(Boolean)) && g[0].some((_, c) => g.some(r => r[c])) && L.ngSolve(cl.rows, cl.cols).solved) return g;
  }
  return null;
};
L.ngMatches = function (user, rows, cols) {
  const cl = L.ngClues(user.map(r => r.map(v => v === 1 ? 1 : 0)));
  return JSON.stringify(cl.rows) === JSON.stringify(rows) && JSON.stringify(cl.cols) === JSON.stringify(cols);
};
L.NG5 = [
  ['..#..','.###.','#####','.###.','..#..'],
  ['.#.#.','#####','#####','.###.','..#..'],
  ['##.##','#####','.###.','..#..','.###.'],
  ['#...#','##.##','#####','.###.','#...#'],
  ['.###.','#####','##.##','#####','.#.#.'],
  ['#####','.###.','..#..','.###.','#####'],
  ['#.#.#','.###.','#####','.###.','#.#.#'],
  ['#####','#...#','#.#.#','#...#','#####']
];
/* 10x10 patterns made by the generator and verified solvable by line logic (see the Node tests) */
L.NG10 = [
  ['....##....','.###..###.','..######..','#.##..##.#','..#.##.#..','####..####','#...##...#','###.##.###','#.######.#','.##.##.##.'],
  ['.###..###.','..#.##.#..','##########','.#.#..#.#.','.##.##.##.','.#.####.#.','.#.#..#.#.','.##.##.##.','.########.','#.##..##.#'],
  ['....##....','.##.##.##.','.#.#..#.#.','.##.##.##.','...####...','##########','##########','..##..##..','##.####.##','#.######.#'],
  ['#.######.#','##.####.##','..#....#..','.###..###.','.##.##.##.','#..#..#..#','####..####','...####...','...####...','..#....#..'],
  ['.#..##..#.','####..####','#........#','##.####.##','#.######.#','##########','##.#..#.##','..#....#..','##########','.#.#..#.#.'],
  ['##..##..##','.#.####.#.','.########.','#..#..#..#','..##..##..','##......##','#..####..#','##.#..#.##','..#....#..','##.####.##']
];

/* ---- Block Stack ---- */
L.BS_W = 10; L.BS_H = 20;
L.BS_SHAPES = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]]
};
L.BS_KEYS = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
L.bsRot = (m) => m[0].map((_, c) => m.map(row => row[c]).reverse());
L.bsNewBoard = () => { const b = []; for (let r = 0; r < L.BS_H; r++) b.push(new Array(L.BS_W).fill(0)); return b; };
L.bsCollide = function (b, m, x, y) {
  for (let r = 0; r < m.length; r++) for (let c = 0; c < m[r].length; c++) {
    if (!m[r][c]) continue;
    const bx = x + c, by = y + r;
    if (bx < 0 || bx >= L.BS_W || by >= L.BS_H) return true;
    if (by >= 0 && b[by][bx]) return true;
  }
  return false;
};
L.bsLock = function (b, m, x, y, id) {
  let over = false;
  for (let r = 0; r < m.length; r++) for (let c = 0; c < m[r].length; c++) if (m[r][c]) { if (y + r < 0) over = true; else b[y + r][x + c] = id; }
  return over;
};
L.bsClear = function (b) {
  let n = 0;
  for (let r = L.BS_H - 1; r >= 0; r--) if (b[r].every(Boolean)) { b.splice(r, 1); b.unshift(new Array(L.BS_W).fill(0)); n++; r++; }
  return n;
};
/* Rotates clockwise with small wall kicks. Returns {m,x,y} or null. */
L.bsTryRotate = function (b, p) {
  const m = L.bsRot(p.m);
  for (const dx of [0, -1, 1, -2, 2]) for (const dy of [0, -1]) if (!L.bsCollide(b, m, p.x + dx, p.y + dy)) return { m, x: p.x + dx, y: p.y + dy };
  return null;
};
L.bsScore = (lines, level) => [0, 100, 300, 500, 800][lines] * level;
L.bsLevel = (lines) => Math.floor(lines / 10) + 1;
L.bsDelay = (level) => Math.max(90, Math.round(800 * Math.pow(0.82, level - 1)));
L.bsBag = (rf) => shuffle(L.BS_KEYS, rf);

/* ---- Breakout / Pong / Dodge: circle against rectangle ---- */
/* Returns {nx,ny,depth} (unit normal pointing from the rectangle toward the circle) or null. */
L.circleRect = function (cx, cy, r, rx, ry, rw, rh) {
  const px = clamp(cx, rx, rx + rw), py = clamp(cy, ry, ry + rh);
  let dx = cx - px, dy = cy - py;
  const d2 = dx * dx + dy * dy;
  if (d2 > r * r) return null;
  if (d2 === 0) { /* centre inside the rectangle: push out through the nearest side */
    const l = cx - rx, rr = rx + rw - cx, t = cy - ry, bt = ry + rh - cy, m = Math.min(l, rr, t, bt);
    if (m === l) return { nx: -1, ny: 0, depth: r + l }; if (m === rr) return { nx: 1, ny: 0, depth: r + rr };
    if (m === t) return { nx: 0, ny: -1, depth: r + t }; return { nx: 0, ny: 1, depth: r + bt };
  }
  const d = Math.sqrt(d2); return { nx: dx / d, ny: dy / d, depth: r - d };
};
L.pongAi = function (padY, targetY, speed, dt) {
  const d = targetY - padY, step = speed * dt;
  return Math.abs(d) <= step ? targetY : padY + Math.sign(d) * step;
};

/* ---- Gem Match (match-3) ---- */
/* b = flat array n*n of gem types (-1 = empty). Returns sorted indexes that are part of a run of 3+. */
L.gmMatches = function (b, n) {
  const s = new Set();
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const t = b[r * n + c]; if (t < 0) continue;
    let k = c; while (k < n && b[r * n + k] === t) k++;
    if (k - c >= 3) for (let i = c; i < k; i++) s.add(r * n + i);
    k = r; while (k < n && b[k * n + c] === t) k++;
    if (k - r >= 3) for (let i = r; i < k; i++) s.add(i * n + c);
  }
  return Array.from(s).sort((a, c) => a - c);
};
/* Removes `rem` (indexes), lets gems fall, fills the top with new gems from gen(). */
L.gmCollapse = function (b, n, rem, gen) {
  const nb = b.slice(), gone = new Set(rem), falls = [], fresh = [];
  for (let c = 0; c < n; c++) {
    let w = n - 1;
    for (let r = n - 1; r >= 0; r--) {
      const i = r * n + c; if (gone.has(i)) continue;
      if (w !== r) falls.push({ from: i, to: w * n + c });
      nb[w * n + c] = b[i]; w--;
    }
    for (let r = w; r >= 0; r--) { const t = gen(); nb[r * n + c] = t; fresh.push({ to: r * n + c, type: t, row: r - (w + 1) }); }
  }
  return { board: nb, falls, fresh };
};
L.gmSwapOk = function (b, n, i, j) {
  const r1 = (i / n) | 0, c1 = i % n, r2 = (j / n) | 0, c2 = j % n;
  if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return false;
  const t = b.slice(); t[i] = b[j]; t[j] = b[i];
  return L.gmMatches(t, n).length > 0;
};
L.gmFindMove = function (b, n) {
  for (let i = 0; i < n * n; i++) {
    const c = i % n;
    if (c < n - 1 && L.gmSwapOk(b, n, i, i + 1)) return [i, i + 1];
    if (i + n < n * n && L.gmSwapOk(b, n, i, i + n)) return [i, i + n];
  }
  return null;
};
L.gmNewBoard = function (n, kinds) {
  for (;;) {
    const b = [];
    for (let i = 0; i < n * n; i++) {
      let t, tries = 0;
      do { t = rnd(kinds); tries++; b[i] = t; } while (tries < 30 && L.gmMatches(b.slice(0, i + 1).concat(new Array(n * n - i - 1).fill(-1)), n).length);
    }
    if (!L.gmMatches(b, n).length && L.gmFindMove(b, n)) return b;
  }
};

/* ---- Dots and Boxes ---- */
L.dbNew = (R, C) => ({ R, C, e: new Array((R + 1) * C + R * (C + 1)).fill(0), box: new Array(R * C).fill(0) });
L.dbBoxEdges = (s, r, c) => [r * s.C + c, (r + 1) * s.C + c, (s.R + 1) * s.C + r * (s.C + 1) + c, (s.R + 1) * s.C + r * (s.C + 1) + c + 1];
L.dbEdgeBoxes = function (s, e) {
  const hN = (s.R + 1) * s.C, out = [];
  if (e < hN) { const r = (e / s.C) | 0, c = e % s.C; if (r > 0) out.push((r - 1) * s.C + c); if (r < s.R) out.push(r * s.C + c); }
  else { const k = e - hN, r = (k / (s.C + 1)) | 0, c = k % (s.C + 1); if (c > 0) out.push(r * s.C + c - 1); if (c < s.C) out.push(r * s.C + c); }
  return out;
};
L.dbSides = (s, bi) => L.dbBoxEdges(s, (bi / s.C) | 0, bi % s.C).filter(e => s.e[e]).length;
L.dbMoves = (s) => { const o = []; s.e.forEach((v, i) => { if (!v) o.push(i); }); return o; };
/* Draws edge e for `player`. Returns how many boxes it completed (the player moves again if > 0). */
L.dbPlay = function (s, e, player) {
  if (s.e[e]) return -1;
  s.e[e] = player; let n = 0;
  for (const bi of L.dbEdgeBoxes(s, e)) if (!s.box[bi] && L.dbSides(s, bi) === 4) { s.box[bi] = player; n++; }
  return n;
};
L.dbClone = (s) => ({ R: s.R, C: s.C, e: s.e.slice(), box: s.box.slice() });
function dbGreedy(s) { /* count boxes a greedy player would grab from here */
  let n = 0;
  for (;;) {
    const m = L.dbMoves(s).find(e => L.dbEdgeBoxes(s, e).some(bi => !s.box[bi] && L.dbSides(s, bi) === 3));
    if (m == null) return n;
    n += L.dbPlay(s, m, 9);
  }
}
L.dbAi = function (s, level) {
  const mv = L.dbMoves(s); if (!mv.length) return -1;
  const takes = mv.filter(e => L.dbEdgeBoxes(s, e).some(bi => !s.box[bi] && L.dbSides(s, bi) === 3));
  if (takes.length) return pick(takes);
  if (level === 0) return pick(mv);
  const safe = mv.filter(e => L.dbEdgeBoxes(s, e).every(bi => s.box[bi] || L.dbSides(s, bi) < 2));
  if (safe.length) return pick(safe);
  let best = 1e9, cand = [];
  for (const e of mv) {
    const t = L.dbClone(s); L.dbPlay(t, e, 1); const g = dbGreedy(t);
    if (g < best) { best = g; cand = [e]; } else if (g === best) cand.push(e);
  }
  return pick(cand);
};

/* ---- Reversi ---- */
const RV_DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
L.rvStart = () => { const b = new Array(64).fill(0); b[27] = 2; b[28] = 1; b[35] = 1; b[36] = 2; return b; };
L.rvFlips = function (b, i, p) {
  if (b[i]) return [];
  const r0 = (i / 8) | 0, c0 = i % 8, out = [], q = 3 - p;
  for (const [dr, dc] of RV_DIRS) {
    const run = []; let r = r0 + dr, c = c0 + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8 && b[r * 8 + c] === q) { run.push(r * 8 + c); r += dr; c += dc; }
    if (run.length && r >= 0 && r < 8 && c >= 0 && c < 8 && b[r * 8 + c] === p) out.push(...run);
  }
  return out;
};
L.rvMoves = function (b, p) { const o = []; for (let i = 0; i < 64; i++) if (!b[i] && L.rvFlips(b, i, p).length) o.push(i); return o; };
L.rvApply = function (b, i, p) { const f = L.rvFlips(b, i, p), n = b.slice(); n[i] = p; f.forEach(k => { n[k] = p; }); return { board: n, flips: f }; };
L.rvCount = (b) => ({ b: b.filter(v => v === 1).length, w: b.filter(v => v === 2).length });
L.rvOver = (b) => !L.rvMoves(b, 1).length && !L.rvMoves(b, 2).length;
const RV_W = [100, -20, 10, 5, 5, 10, -20, 100, -20, -50, -2, -2, -2, -2, -50, -20, 10, -2, -1, -1, -1, -1, -2, 10, 5, -2, -1, -1, -1, -1, -2, 5,
  5, -2, -1, -1, -1, -1, -2, 5, 10, -2, -1, -1, -1, -1, -2, 10, -20, -50, -2, -2, -2, -2, -50, -20, 100, -20, 10, 5, 5, 10, -20, 100];
function rvEval(b, me) {
  let s = 0; const q = 3 - me;
  for (let i = 0; i < 64; i++) { if (b[i] === me) s += RV_W[i]; else if (b[i] === q) s -= RV_W[i]; }
  s += (L.rvMoves(b, me).length - L.rvMoves(b, q).length) * 6;
  return s;
}
function rvSearch(b, p, me, depth, alpha, beta) {
  const q = 3 - p;
  if (depth === 0) return rvEval(b, me);
  const mv = L.rvMoves(b, p);
  if (!mv.length) {
    if (!L.rvMoves(b, q).length) { const c = L.rvCount(b), d = (me === 1 ? c.b - c.w : c.w - c.b); return d * 1000; }
    return rvSearch(b, q, me, depth - 1, alpha, beta);
  }
  let best = p === me ? -1e9 : 1e9;
  for (const m of mv) {
    const v = rvSearch(L.rvApply(b, m, p).board, q, me, depth - 1, alpha, beta);
    if (p === me) { if (v > best) best = v; if (best > alpha) alpha = best; } else { if (v < best) best = v; if (best < beta) beta = best; }
    if (alpha >= beta) break;
  }
  return best;
}
L.rvAi = function (b, p, depth) {
  const mv = L.rvMoves(b, p); if (!mv.length) return -1;
  if (depth <= 0) return pick(mv);
  let best = -1e9, cand = [];
  for (const m of mv) {
    const v = rvSearch(L.rvApply(b, m, p).board, 3 - p, p, depth - 1, -1e9, 1e9);
    if (v > best) { best = v; cand = [m]; } else if (v === best) cand.push(m);
  }
  return pick(cand);
};

/* ---- Maze ---- */
const MZ = { N: 1, E: 2, S: 4, W: 8 }, MZ_DIRS = [[0, -1, 1, 4], [1, 0, 2, 8], [0, 1, 4, 1], [-1, 0, 8, 2]];
L.MZ = MZ;
L.mazeGen = function (w, h, rf) {
  rf = rf || rnd;
  const m = new Array(w * h).fill(0), seen = new Array(w * h).fill(false), st = [0]; seen[0] = true;
  while (st.length) {
    const i = st[st.length - 1], x = i % w, y = (i / w) | 0, opts = [];
    for (const d of MZ_DIRS) { const nx = x + d[0], ny = y + d[1]; if (nx >= 0 && ny >= 0 && nx < w && ny < h && !seen[ny * w + nx]) opts.push(d); }
    if (!opts.length) { st.pop(); continue; }
    const d = opts[rf(opts.length)], j = (y + d[1]) * w + x + d[0];
    m[i] |= d[2]; m[j] |= d[3]; seen[j] = true; st.push(j);
  }
  return m;
};
/* Shortest path length (steps) between two cells, or -1. */
L.mazeDist = function (m, w, h, from, to) {
  const dist = new Array(w * h).fill(-1); dist[from] = 0; const q = [from];
  for (let k = 0; k < q.length; k++) {
    const i = q[k], x = i % w, y = (i / w) | 0;
    for (const d of MZ_DIRS) if (m[i] & d[2]) { const j = (y + d[1]) * w + x + d[0]; if (dist[j] < 0) { dist[j] = dist[i] + 1; q.push(j); } }
  }
  return dist[to];
};
/* Walks in direction di (0 N, 1 E, 2 S, 3 W) until a junction, dead end, the goal or a wall. Returns the cells visited. */
L.mazeSlide = function (m, w, h, pos, di, goal) {
  const path = []; let cur = pos, dir = di;
  for (let guard = 0; guard < w * h; guard++) {
    const d = MZ_DIRS[dir];
    if (!(m[cur] & d[2])) break;
    cur = ((((cur / w) | 0) + d[1]) * w) + (cur % w) + d[0]; path.push(cur);
    if (cur === goal) break;
    const open = MZ_DIRS.map((e, k) => k).filter(k => (m[cur] & MZ_DIRS[k][2]) && k !== (dir + 2) % 4);
    if (open.length !== 1) break;
    dir = open[0];
  }
  return path;
};

/* ---- 24 Game (exact fractions) ---- */
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a || 1; };
const fr = (n, d) => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); return [n / g, d / g]; };
L.frOp = function (a, op, b) {
  if (op === '+') return fr(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
  if (op === '-') return fr(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
  if (op === '*') return fr(a[0] * b[0], a[1] * b[1]);
  if (op === '/') return b[0] === 0 ? null : fr(a[0] * b[1], a[1] * b[0]);
  return null;
};
L.frStr = (f) => f[1] === 1 ? String(f[0]) : f[0] + '/' + f[1];
L.solve24 = function (nums, target) {
  target = target || 24;
  function rec(items) {
    if (items.length === 1) return items[0].v[0] === target && items[0].v[1] === 1 ? items[0].s : null;
    for (let i = 0; i < items.length; i++) for (let j = 0; j < items.length; j++) {
      if (i === j) continue;
      const rest = items.filter((_, k) => k !== i && k !== j);
      for (const op of ['+', '-', '*', '/']) {
        if ((op === '+' || op === '*') && j < i) continue;
        const v = L.frOp(items[i].v, op, items[j].v); if (!v) continue;
        const s = '(' + items[i].s + ({ '+': ' + ', '-': ' - ', '*': ' x ', '/': ' / ' }[op]) + items[j].s + ')';
        const r = rec(rest.concat([{ v, s }])); if (r) return r;
      }
    }
    return null;
  }
  const r = rec(nums.map(n => ({ v: [n, 1], s: String(n) })));
  return r ? r.replace(/^\((.*)\)$/, '$1') : null;
};
L.gen24 = function (rf) {
  rf = rf || rnd;
  for (;;) { const n = [0, 0, 0, 0].map(() => 1 + rf(9)); if (L.solve24(n)) return n; }
};

/* ---- Blackjack ---- */
/* Cards are ranks 1..13 (1 = ace, 11 to 13 are court cards). */
L.bjVal = (r) => r === 1 ? 11 : Math.min(r, 10);
L.bjHand = function (cards) {
  let t = 0, aces = 0;
  for (const r of cards) { t += L.bjVal(r); if (r === 1) aces++; }
  while (t > 21 && aces) { t -= 10; aces--; }
  return { total: t, soft: aces > 0, bust: t > 21, bj: cards.length === 2 && t === 21 };
};
L.bjShoe = (decks) => { const s = []; for (let d = 0; d < decks; d++) for (let r = 1; r <= 13; r++) for (let k = 0; k < 4; k++) s.push(r); return shuffle(s); };
/* Dealer draws to 17 and stands on all 17s. */
L.bjDealer = function (hand, draw) { while (L.bjHand(hand).total < 17) hand.push(draw()); return hand; };
/* Net chips won (negative = lost) for a bet. */
L.bjSettle = function (player, dealer, bet) {
  const p = L.bjHand(player), d = L.bjHand(dealer);
  if (p.bust) return -bet;
  if (p.bj && !d.bj) return Math.floor(bet * 1.5);
  if (d.bj && !p.bj) return -bet;
  if (d.bust) return bet;
  if (p.total > d.total) return bet;
  if (p.total < d.total) return -bet;
  return 0;
};

/* ---- Higher or Lower ---- */
L.hiloRank = (r) => r === 1 ? 14 : r;
L.hiloCmp = (a, b) => Math.sign(L.hiloRank(b) - L.hiloRank(a)); /* 1 higher, -1 lower, 0 tie */

/* ---- Digit span ---- */
L.dsSeq = function (len, rf) {
  rf = rf || rnd; const s = [];
  while (s.length < len) { const d = rf(10); if (d !== s[s.length - 1]) s.push(d); }
  return s;
};
L.dsCheck = (seq, ans, reverse) => { const t = reverse ? seq.slice().reverse() : seq; return t.length === ans.length && t.every((v, i) => v === ans[i]); };

/* ---- Typing Falls ---- */
L.TF_WORDS = ('cat dog sun map pen cup hat bus key box fan jam leg zip owl gem ice jet kit mud net oak pie rug sky toy van web yak zoo ant bed cow day egg fig gum hen ink jar kid lip man nut oil pan rat sea tea urn vet wax yam ' +
  'apple bread chair dance eagle flame grape house ivory juice koala lemon mango night ocean piano queen river snake tiger uncle video water zebra cloud brave smile storm light happy ' +
  'garden window pocket rocket jungle bridge planet orange silver butter castle dragon forest island pirate rabbit spider travel wizard yellow monkey guitar coffee bottle candle button').split(' ');
L.tfMatch = function (words, typed) {
  /* words = [{w, y}] with y = vertical position (larger = closer to the bottom) */
  if (!typed) return { exact: -1, prefix: -1 };
  let exact = -1, prefix = -1;
  words.forEach((o, i) => {
    if (o.w === typed && (exact < 0 || o.y > words[exact].y)) exact = i;
    if (o.w.indexOf(typed) === 0 && (prefix < 0 || o.y > words[prefix].y)) prefix = i;
  });
  return { exact, prefix };
};

/* ---- Stroop ---- */
L.STROOP = [['RED', '#e5484d'], ['BLUE', '#3b82f6'], ['GREEN', '#16a34a'], ['YELLOW', '#eab308']];
L.stroopTrial = function (rf) {
  rf = rf || rnd; const w = rf(4);
  const ink = rf(4) === 0 ? w : (w + 1 + rf(3)) % 4;
  return { word: w, ink };
};

/* ---------- shared UI helpers ---------- */
const hsGet = (id, d) => Store.get('fun2.' + id, d);
const hsSet = (id, v) => Store.set('fun2.' + id, v);
const buzz = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms || 15); } catch (e) { /* ignore */ } };
const cssv = (root, name) => getComputedStyle(root).getPropertyValue(name).trim() || '#888';
const fmtT = (s) => Math.floor(s / 60) + ':' + pad(Math.floor(s % 60));

/* Tracks every timer / frame / listener a tool starts so one stop() cleans up.
   Timeouts, intervals and animation frames have separate id pools in a browser (the same number can mean a timeout and a frame), so every
   call returns its own handle and this map remembers which kind, and which real id, a handle stands for. clear(handle) can then never
   cancel something else. */
function tracker() {
  const live = new Map(), ls = [], stops = []; let dead = false, seq = 0;
  const kill = (kind, id) => { if (kind === 'raf') cancelAnimationFrame(id); else if (kind === 'iv') clearInterval(id); else clearTimeout(id); };
  return {
    to(fn, ms) { if (dead) return 0; const h = ++seq, id = setTimeout(() => { live.delete(h); fn(); }, ms); live.set(h, ['to', id]); return h; },
    iv(fn, ms) { if (dead) return 0; const h = ++seq; live.set(h, ['iv', setInterval(fn, ms)]); return h; },
    raf(fn) { if (dead) return 0; const h = ++seq, id = requestAnimationFrame((ts) => { live.delete(h); fn(ts); }); live.set(h, ['raf', id]); return h; },
    dead() { return dead; },
    onStop(fn) { stops.push(fn); },
    clear(h) { const e = live.get(h); if (e) { kill(e[0], e[1]); live.delete(h); } },
    on(target, ev, fn, opt) { if (dead) return; target.addEventListener(ev, fn, opt); ls.push([target, ev, fn, opt]); },
    stop() {
      dead = true;
      live.forEach(([kind, id]) => kill(kind, id)); live.clear();
      ls.forEach(([t, e, f, o]) => t.removeEventListener(e, f, o)); ls.length = 0; stops.forEach(f => f()); stops.length = 0;
    }
  };
}

const CSS = `
.g2{user-select:none;-webkit-user-select:none;padding-bottom:8px}
.g2 *{-webkit-tap-highlight-color:transparent}
.g2 button{touch-action:manipulation;font-family:inherit}
.g2 .seg{display:flex;gap:6px;background:var(--surface2);padding:4px;border-radius:14px;margin:8px 0}
.g2 .seg button{flex:1;min-height:44px;border:0;border-radius:11px;background:transparent;color:var(--muted);font-weight:600;font-size:14px;transition:background .2s,color .2s,transform .2s}
.g2 .seg button.on{background:var(--accent);color:var(--accent-t);box-shadow:var(--shadow)}
.g2 .stats{display:flex;justify-content:space-around;text-align:center;margin:8px 0;gap:6px}
.g2 .stats b{display:block;font-size:22px;font-variant-numeric:tabular-nums}
.g2 .stats span{font-size:12px;color:var(--muted)}
.g2 .msg{min-height:30px;text-align:center;font-weight:700;font-size:17px;margin:6px 0}
.g2 .cv{display:block;margin:8px auto;border-radius:18px;background:var(--surface2);border:1px solid var(--line);touch-action:none;width:100%}
.g2 .pop{animation:g2pop .4s cubic-bezier(.2,1.7,.4,1) both}
.g2{position:relative}
.g2 .cf{position:absolute;left:0;right:0;top:0;height:0;overflow:visible;pointer-events:none;z-index:5}
.g2 .cf i{position:absolute;top:-10px;font-style:normal;animation:g2cf 1.8s ease-in both}
@keyframes g2cf{from{transform:translateY(0) rotate(0);opacity:1}to{transform:translateY(420px) rotate(260deg);opacity:0}}
@media (prefers-reduced-motion:reduce){.g2 *{animation-duration:.01s!important;transition-duration:.01s!important}}
.g2 .shake{animation:g2shake .45s}
.g2 .rowb{display:flex;gap:8px;margin:8px 0}
.g2 .rowb .btn{flex:1;min-height:46px}
.g2 .chip{display:inline-block;padding:6px 12px;border-radius:99px;background:var(--surface2);font-weight:600;font-size:14px}
.g2 .ov{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:rgba(10,12,30,.55);border-radius:18px;color:#fff;text-align:center;padding:12px}
.g2 .ov b{font-size:22px}
.g2 .cvw{position:relative;max-width:420px;margin:8px auto}
.g2 .cvw .cv{margin:0}
@keyframes g2pop{from{transform:scale(.2);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes g2shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}
@keyframes g2flip{0%{transform:rotateX(0);background:var(--surface)}49%{transform:rotateX(90deg);background:var(--surface)}51%{background:var(--bgc)}100%{transform:rotateX(0);background:var(--bgc)}}
@keyframes g2fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
`;
function mount(el, html) {
  el.innerHTML = '<style>' + CSS + '</style><div class="g2">' + html + '</div>';
  const root = $('.g2', el);
  /* result lines are announced by screen readers when they change */
  $$('.msg', root).forEach(m => { m.setAttribute('role', 'status'); m.setAttribute('aria-live', 'polite'); });
  return root;
}
/* ctx.roundRect needs WebView 99+; older ones get a plain rectangle. */
function rrect(c, x, y, w, h, r) { if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
/* Asks before throwing away a game that is in progress (only when `inProgress` is true). */
function sure(inProgress, what) { return !inProgress || confirm(what || 'Start over? Your current game will be lost.'); }
/* Timers count from Date.now(); while the app is in the background the clock must not keep running against the player. */
function keepTime(T, shift) {
  let at = 0;
  T.on(document, 'visibilitychange', () => { if (document.hidden) at = Date.now(); else if (at) { shift(Date.now() - at); at = 0; } });
}
/* A short burst of confetti over a finished game (CSS only, removed by itself, skipped for people who asked for less motion). */
function celebrate(root, T) {
  try { if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (e) { /* ignore */ }
  const old = $('.cf', root); if (old) old.remove();
  const box = document.createElement('div'); box.className = 'cf'; box.setAttribute('aria-hidden', 'true');
  const em = ['\u{1F389}', '\u2728', '\u2B50', '\u{1F38A}', '\u{1F4AB}'];
  box.innerHTML = Array.from({ length: 16 }, (_, i) => '<i style="left:' + ((i * 37 + 5) % 96) + '%;animation-delay:' + ((i * 53) % 400) + 'ms;font-size:' + (18 + (i * 7) % 14) + 'px">' + em[i % em.length] + '</i>').join('');
  root.appendChild(box); T.to(() => box.remove(), 2200);
}
const seg = (id, items, cur) => '<div class="seg" id="' + id + '">' + items.map(([v, l]) =>
  '<button data-v="' + v + '" class="' + (String(v) === String(cur) ? 'on' : '') + '">' + l + '</button>').join('') + '</div>';
function onSeg(root, id, cb, ask) {
  const s = $('#' + id, root);
  s.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.classList.contains('on')) return;
    if (ask && !ask()) return;                 // the player chose to keep the game in progress
    $$('button', s).forEach(x => x.classList.toggle('on', x === b));
    cb(b.dataset.v);
  });
}
const stat = (id, label, v) => '<div><b id="' + id + '">' + v + '</b><span>' + label + '</span></div>';
function reg(id, name, icon, desc, keys, render, needs) {
  Tools.register({ id, name, icon, cat: 'fun', desc, keys, needs: needs || ['storage'], pro: false, render });
}
function bump(node) { node.classList.remove('pop'); void node.offsetWidth; node.classList.add('pop'); }
function restart(node, cls) { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); }
function shareText(text) {
  try {
    const P = window.Capacitor && Capacitor.Plugins;
    if (P && P.Share && P.Share.share) { P.Share.share({ text }).catch(() => {}); return; }
    if (navigator.share) { navigator.share({ text }).catch(() => {}); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(() => toast('Copied to clipboard'), () => toast('Could not copy')); return; }
  } catch (e) { /* fall through */ }
  toast('Sharing is not available here');
}
/* Pointer position in canvas pixels. */
function ptr(cv, e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (cv._lw || cv.width) / r.width, y: (e.clientY - r.top) * (cv._lh || cv.height) / r.height };
}
/* Sizes a canvas for the screen's pixel density while all drawing code keeps using logical w x h units. Returns the 2D context. */
function fitCanvas(cv, w, h) {
  const d = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
  cv.width = Math.round(w * d); cv.height = Math.round(h * d); cv._lw = w; cv._lh = h;
  const c = cv.getContext('2d'); if (c && c.setTransform) c.setTransform(d, 0, 0, d, 0, 0);
  return c;
}
/* Keeps the screen awake while a game is played with no touches (tilt). Released by T.stop(). */
function keepAwake(T) {
  let lock = null;
  const get = () => {
    try {
      if (navigator.wakeLock && navigator.wakeLock.request) navigator.wakeLock.request('screen').then(l => { if (T.dead()) l.release().catch(() => {}); else lock = l; }, () => {});
    } catch (e) { /* not supported */ }
  };
  get();
  T.on(document, 'visibilitychange', () => { if (!document.hidden) get(); });
  T.onStop(() => { try { if (lock) lock.release().catch(() => {}); } catch (e) { /* ignore */ } lock = null; });
}
/* requestAnimationFrame loop with pause/resume. Auto-pauses when the page is hidden. step(dt seconds), draw(). */
function gameLoop(T, step, draw, onPause) {
  let last = 0, paused = false, on = true;
  const api = {
    get paused() { return paused; },
    pause() { if (!paused) { paused = true; if (onPause) onPause(true); } },
    resume() { if (paused) { paused = false; last = 0; if (onPause) onPause(false); } },
    toggle() { if (paused) api.resume(); else api.pause(); }
  };
  function frame(ts) {
    if (!on) return;
    const dt = last ? Math.min(0.04, (ts - last) / 1000) : 0; last = ts;
    if (!paused) step(dt);
    draw();
    T.raf(frame);
  }
  T.raf(frame);
  T.on(document, 'visibilitychange', () => { if (document.hidden) api.pause(); });
  api.stop = () => { on = false; };
  return api;
}
/* Overlay text on top of a canvas wrapper (used for start / pause / game over). */
function overlay(wrap, html, onTap) {
  let o = $('.ov', wrap);
  if (!html) { if (o) o.remove(); return; }
  if (!o) { o = document.createElement('div'); o.className = 'ov'; wrap.appendChild(o); }
  o.innerHTML = html; o.onclick = onTap || null;
}

/* =====================================================================
   1. Daily Challenge
   ===================================================================== */
reg('dailychal', 'Daily Challenge', '\u{1F4C5}', 'A new small puzzle every day (word scramble, number sequence or quick sums) from the local date, with a streak counter for solving it on consecutive days.',
  ['daily', 'puzzle', 'streak', 'scramble', 'sequence', 'brain', 'wordle'], function (el) {
    const T = tracker(), key = L.dayKey(new Date()), pz = L.dailyPuzzle(key);
    let st = hsGet('dailychal', { streak: 0, best: 0, last: '', day: '', tries: 0, solved: false });
    if (st.day !== key) { st.day = key; st.tries = 0; st.solved = false; }
    const MAX = 3;
    const shown = pz.type === 'math' ? pz.shown.map(q => '<div style="font-size:22px;font-weight:700;margin:6px 0">' + esc(q) + ' = ?</div>').join('')
      : '<div style="font-size:' + (pz.type === 'scramble' ? 34 : 26) + 'px;font-weight:800;letter-spacing:3px;margin:10px 0;word-break:break-word">' + esc(pz.shown) + '</div>';
    const inputs = pz.type === 'math'
      ? [0, 1, 2].map(i => '<input id="in' + i + '" inputmode="numeric" maxlength="8" aria-label="Answer ' + (i + 1) + '" placeholder="Answer ' + (i + 1) + '" style="flex:1;min-width:0;height:48px;border:1px solid var(--line);border-radius:12px;background:var(--surface);color:var(--text);font:inherit;font-size:18px;text-align:center">').join('')
      : '<input id="in0" ' + (pz.type === 'sequence' ? 'inputmode="numeric" maxlength="8"' : 'maxlength="5" autocapitalize="none" autocomplete="off"') + ' aria-label="Your answer" placeholder="Your answer" style="flex:1;min-width:0;height:48px;border:1px solid var(--line);border-radius:12px;background:var(--surface);color:var(--text);font:inherit;font-size:20px;text-align:center">';
    const root = mount(el, `
      <div class="card" style="text-align:center">
        <div class="muted" style="font-size:13px" id="dt"></div>
        <div style="font-size:15px;font-weight:700;margin-top:4px">${pz.title}</div>
        <div class="muted" style="font-size:14px">${pz.prompt}</div>
        <div id="pz">${shown}</div>
        <div class="rowb" id="inp" style="gap:6px">${inputs}</div>
        <button class="btn big-btn" id="go" style="width:100%;min-height:50px">Check answer</button>
        <div class="msg" id="msg"></div>
      </div>
      <div class="stats card" style="margin-top:10px">${stat('stk', '\u{1F525} Streak', 0)}${stat('bst', 'Best streak', st.best)}${stat('tr', 'Tries left', MAX)}</div>`);
    const dt = new Date(); $('#dt', root).textContent = dt.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    const msg = $('#msg', root);
    function paint() {
      $('#stk', root).textContent = L.streakShown(st, key); $('#bst', root).textContent = st.best;
      $('#tr', root).textContent = Math.max(0, MAX - st.tries);
      const done = st.solved || st.tries >= MAX;
      $$('input', root).forEach(i => { i.disabled = done; }); $('#go', root).disabled = done;
      if (st.solved) msg.innerHTML = '✅ Solved! Come back tomorrow to keep your streak.';
      else if (st.tries >= MAX) msg.innerHTML = 'Out of tries. Answer: <b>' + esc(pz.type === 'math' ? pz.answers.join(', ') : pz.answers[0].toUpperCase()) + '</b>. A new puzzle tomorrow!';
    }
    function check() {
      if (st.solved || st.tries >= MAX) return;
      const vals = $$('input', root).map(i => i.value.trim());
      if (vals.some(v => !v)) { msg.textContent = 'Fill in your answer first'; return; }
      if (L.dailyCheck(pz, vals)) {
        st = Object.assign(st, L.streakSolve(st, key)); st.solved = true; buzz(60);
        restart($('#pz', root), 'pop'); celebrate(root, T);
      } else { st.tries++; msg.textContent = 'Not quite, try again'; restart($('#inp', root), 'shake'); buzz(40); }
      hsSet('dailychal', st); paint();
    }
    $('#go', root).onclick = check;
    $$('input', root).forEach(i => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') check(); }));
    paint();
    return () => T.stop();
  });

/* =====================================================================
   2. Word Guess
   ===================================================================== */
reg('wordguess', 'Word Guess', '\u{1F520}', 'Guess the hidden five-letter word in six tries. Tiles show colour and a pattern mark so it works for colour-blind players, and you can share your result as an emoji grid.',
  ['wordle', 'word', 'guess', 'letters', 'puzzle', 'five letter'], function (el) {
    const T = tracker(), KB = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
    let answer, rows, cur, over, gen = 0, cb = hsGet('wordguess.cb', true);
    let ws = hsGet('wordguess', { played: 0, won: 0, streak: 0, best: 0, dist: [0, 0, 0, 0, 0, 0] });
    const root = mount(el, `
      <style>
        .wg-t{width:100%;aspect-ratio:1;border:2px solid var(--line);border-radius:8px;display:grid;place-items:center;font-size:26px;font-weight:800;text-transform:uppercase;background:var(--surface);position:relative;color:var(--text)}
        .wg-t.fill{border-color:var(--muted);animation:g2pop .15s}
        .wg-t.mg,.wg-t.my,.wg-t.mx{background:var(--bgc);border-color:transparent;color:#fff}
        .wg-t.rev{animation:g2flip .55s both}
        .wg-t.mg::after,.wg-t.my::after{position:absolute;top:2px;right:5px;font-size:11px;font-weight:800}
        .wg-t.mg::after{content:"\\2713"}.wg-t.my::after{content:"\\2022"}
        .wg-t.my::before{content:"";position:absolute;inset:0;border-radius:6px;background:repeating-linear-gradient(135deg,rgba(255,255,255,.22) 0 5px,transparent 5px 10px)}
        .wg-t span{position:relative;z-index:1}
        .wg-t.mg{--bgc:var(--wg-g)}.wg-t.my{--bgc:var(--wg-y)}.wg-t.mx{--bgc:var(--wg-x);color:var(--muted)}
        .wg-k{flex:1;min-width:0;height:50px;border:0;border-radius:8px;background:var(--surface2);color:var(--text);font-weight:700;font-size:15px;text-transform:uppercase;padding:0}
        .wg-k.mg{background:var(--wg-g);color:#fff}.wg-k.my{background:var(--wg-y);color:#fff;background-image:repeating-linear-gradient(135deg,rgba(255,255,255,.28) 0 5px,transparent 5px 10px)}.wg-k.mx{background:var(--wg-x);color:var(--muted);opacity:.7}
        .wg-k:active{filter:brightness(.9)}
      </style>
      <div id="grid" style="display:grid;grid-template-rows:repeat(6,1fr);gap:6px;max-width:300px;margin:6px auto"></div>
      <div class="msg" id="msg"></div>
      <div id="kb" style="max-width:420px;margin:0 auto"></div>
      <div class="rowb"><button class="btn alt" id="pal"></button><button class="btn alt" id="new">New word</button><button class="btn alt" id="shr" hidden>Share</button></div>
      <div id="sts" class="card" style="margin-top:8px"></div>`);
    function palette() {
      root.style.setProperty('--wg-g', cb ? '#2f6fe0' : '#2e9d4e'); root.style.setProperty('--wg-y', cb ? '#d97706' : '#b99a1a');
      root.style.setProperty('--wg-x', cssv(root, '--surface2')); $('#pal', root).textContent = cb ? 'Colours: blue / orange' : 'Colours: green / yellow';
    }
    function marksOf(i) { return rows[i].marks; }
    function keyState() {
      const k = {};
      rows.forEach(r => r.marks.forEach((m, i) => { const l = r.w[i], pr = k[l]; if (m === 'g' || (m === 'y' && pr !== 'g') || (m === 'x' && !pr)) k[l] = m; }));
      return k;
    }
    function draw() {
      const g = $('#grid', root); g.innerHTML = '';
      for (let r = 0; r < 6; r++) {
        const rw = document.createElement('div'); rw.style.cssText = 'display:grid;grid-template-columns:repeat(5,1fr);gap:6px'; rw.dataset.r = r;
        for (let c = 0; c < 5; c++) {
          const t = document.createElement('div'); t.className = 'wg-t';
          if (r < rows.length) { t.innerHTML = '<span>' + rows[r].w[c] + '</span>'; t.className = 'wg-t m' + rows[r].marks[c] + ' ' + (rows[r].anim ? 'rev' : 'done'); t.style.animationDelay = (c * 0.22) + 's'; }
          else if (r === rows.length && cur[c]) { t.innerHTML = '<span>' + cur[c] + '</span>'; t.className = 'wg-t fill'; }
          rw.appendChild(t);
        }
        g.appendChild(rw);
      }
      rows.forEach(r => { r.anim = false; });
      const ks = keyState(), kb = $('#kb', root); kb.innerHTML = '';
      KB.forEach((line, li) => {
        const d = document.createElement('div'); d.style.cssText = 'display:flex;gap:5px;margin:5px 0;justify-content:center';
        if (li === 2) d.insertAdjacentHTML('beforeend', '<button class="wg-k" data-k="Enter" style="flex:1.6;font-size:12px" aria-label="Enter">Enter</button>');
        line.split('').forEach(ch => d.insertAdjacentHTML('beforeend', '<button class="wg-k ' + (ks[ch] ? 'm' + ks[ch] : '') + '" data-k="' + ch + '" aria-label="' + ch + '">' + ch + '</button>'));
        if (li === 2) d.insertAdjacentHTML('beforeend', '<button class="wg-k" data-k="Back" style="flex:1.6" aria-label="Backspace">⌫</button>');
        kb.appendChild(d);
      });
    }
    function showStats() {
      const mx = Math.max(1, ...ws.dist);
      $('#sts', root).innerHTML = '<div class="stats" style="margin-top:0">' + stat('a', 'Played', ws.played) + stat('b', 'Win %', ws.played ? Math.round(ws.won * 100 / ws.played) : 0) + stat('c', 'Streak', ws.streak) + stat('d', 'Best', ws.best) + '</div>' +
        ws.dist.map((n, i) => '<div style="display:flex;align-items:center;gap:6px;font-size:12px;margin:2px 0"><span style="width:10px">' + (i + 1) + '</span><div style="height:14px;border-radius:4px;background:var(--accent);min-width:14px;width:' + Math.round(n * 100 / mx * 0.85 + 5) + '%;color:var(--accent-t);padding:0 5px;font-weight:700">' + n + '</div></div>').join('');
    }
    function newGame() {
      gen++; answer = WORDS[rnd(WORDS.length)]; rows = []; cur = ''; over = false;
      $('#msg', root).textContent = 'Type or tap a five-letter word'; $('#shr', root).hidden = true; draw();
    }
    function submit() {
      if (over) return;
      if (cur.length < 5) { $('#msg', root).textContent = 'Not enough letters'; restart($('#grid', root).children[rows.length], 'shake'); return; }
      const marks = L.evalGuess(cur, answer); rows.push({ w: cur, marks, anim: true }); cur = '';
      const won = marks.every(m => m === 'g'), lost = !won && rows.length === 6;
      draw(); buzz(20);
      if (won || lost) {
        over = true; ws.played++;
        if (won) { ws.won++; ws.streak++; ws.best = Math.max(ws.best, ws.streak); ws.dist[rows.length - 1]++; } else ws.streak = 0;
        hsSet('wordguess', ws);
        const g = gen;
        T.to(() => {
          if (g !== gen) return;   // a new word was started meanwhile
          $('#msg', root).innerHTML = won ? '\u{1F389} ' + ['Genius!', 'Magnificent!', 'Impressive!', 'Splendid!', 'Great!', 'Phew!'][rows.length - 1] : 'The word was <b>' + answer.toUpperCase() + '</b>';
          $('#shr', root).hidden = false; showStats(); if (won) celebrate(root, T);
        }, 1400);
      } else $('#msg', root).textContent = '';
    }
    function key(k) {
      if (over) return;
      if (k === 'Enter') return submit();
      if (k === 'Back') { cur = cur.slice(0, -1); } else if (/^[a-z]$/.test(k) && cur.length < 5) cur += k;
      draw();
    }
    $('#kb', root).addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) key(b.dataset.k); });
    T.on(window, 'keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') key('Enter'); else if (e.key === 'Backspace') key('Back'); else if (/^[a-zA-Z]$/.test(e.key)) key(e.key.toLowerCase());
    });
    $('#new', root).onclick = () => { if (sure(!over && rows.length > 0, 'Start a new word? Your guesses so far will be lost.')) newGame(); };
    $('#pal', root).onclick = () => { cb = !cb; hsSet('wordguess.cb', cb); palette(); };
    $('#shr', root).onclick = () => {
      const won = rows.length && rows[rows.length - 1].marks.every(m => m === 'g');
      shareText('Word Guess ' + (won ? rows.length : 'X') + '/6\n' + L.shareGrid(rows.map(r => r.marks), cb));
    };
    palette(); newGame(); showStats();
    return () => T.stop();
  });

/* =====================================================================
   3. Mastermind
   ===================================================================== */
const MM_COL = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#14b8a6', '#ec4899'];
const MM_SYM = ['●', '▲', '■', '◆', '★', '✚', '⬢', '♥'];
const MM_LV = { 0: { len: 4, col: 6, rep: false, tries: 10 }, 1: { len: 4, col: 6, rep: true, tries: 10 }, 2: { len: 5, col: 8, rep: true, tries: 12 } };
reg('mastermind', 'Mastermind', '\u{1F9D0}', 'Crack the secret colour code. After each guess you get black pegs for the right colour in the right place and white pegs for the right colour in the wrong place. Three difficulty levels.',
  ['code', 'breaker', 'colour', 'color', 'logic', 'pegs'], function (el) {
    const T = tracker();
    let lv = hsGet('mastermind.lv', 1), P, code, rows, cur, over, best = hsGet('mastermind.best', {});
    const root = mount(el, `
      <style>.mm-p{width:38px;height:38px;border-radius:50%;border:2px solid var(--line);background:var(--surface2);color:#fff;font-size:17px;font-weight:800;display:grid;place-items:center;padding:0;text-shadow:0 1px 2px rgba(0,0,0,.5);transition:transform .15s}
        .mm-p.f{border-color:rgba(0,0,0,.2);box-shadow:inset 0 -4px 6px rgba(0,0,0,.2),inset 0 3px 5px rgba(255,255,255,.35)}
        .mm-p:active{transform:scale(.9)}
        .mm-r{display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:14px}
        .mm-r.now{background:var(--surface2)}.mm-fb{display:grid;grid-template-columns:repeat(3,11px);gap:3px;margin-left:auto;min-width:42px}
        .mm-fb i{width:11px;height:11px;border-radius:50%;border:2px solid var(--muted);box-sizing:border-box}.mm-fb i.b{background:var(--text);border-color:var(--text)}.mm-fb i.w{background:transparent;border-color:var(--text)}.mm-fb i.n{border-color:var(--line)}</style>
      ${seg('lv', [[0, 'Easy'], [1, 'Normal'], [2, 'Hard']], lv)}
      <div class="stats">${stat('tl', 'Guesses left', 0)}${stat('bs', 'Best', '-')}</div>
      <div id="board"></div>
      <div class="msg" id="msg"></div>
      <div id="pal" style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap"></div>
      <div class="rowb"><button class="btn" id="ok">Guess</button><button class="btn alt" id="clr">Clear</button><button class="btn alt" id="new">New game</button></div>
      <div class="muted center" style="font-size:12px">Black = right colour and place. Ring = right colour, wrong place. Each colour has its own symbol.</div>`);
    function peg(c, cls, extra) { return '<button class="mm-p ' + cls + '" ' + (c != null ? 'style="background:' + MM_COL[c] + '"' : '') + ' ' + (extra || '') + '>' + (c != null ? MM_SYM[c] : '') + '</button>'; }
    function paint() {
      const b = $('#board', root); let h = '';
      for (let r = 0; r < P.tries; r++) {
        const g = rows[r], now = r === rows.length && !over;
        h += '<div class="mm-r ' + (now ? 'now' : '') + '">';
        for (let i = 0; i < P.len; i++) {
          if (g) h += peg(g.g[i], 'f', 'disabled aria-label="peg"');
          else if (now) h += peg(cur[i], cur[i] != null ? 'f' : '', 'data-s="' + i + '" aria-label="slot ' + (i + 1) + '"');
          else h += '<button class="mm-p" disabled aria-label="empty"></button>';
        }
        h += '<div class="mm-fb">';
        const cnt = P.len; for (let k = 0; k < cnt; k++) h += '<i class="' + (g ? (k < g.f.b ? 'b' : k < g.f.b + g.f.w ? 'w' : 'n') : 'n') + '"></i>';
        h += '</div></div>';
      }
      b.innerHTML = h; $('#tl', root).textContent = P.tries - rows.length;
      $('#bs', root).textContent = best[lv] || '-';
    }
    function newGame() {
      P = MM_LV[lv]; code = L.mmCode(P.len, P.col, P.rep); rows = []; cur = new Array(P.len).fill(null); over = false;
      $('#pal', root).innerHTML = MM_COL.slice(0, P.col).map((c, i) => '<button class="mm-p f" data-c="' + i + '" style="background:' + c + ';width:44px;height:44px" aria-label="colour ' + MM_SYM[i] + '">' + MM_SYM[i] + '</button>').join('');
      $('#msg', root).textContent = P.rep ? 'Colours can repeat' : 'No repeated colours in the code'; paint();
    }
    function addColor(c) {
      if (over) return; const i = cur.indexOf(null); if (i < 0) return; cur[i] = c; paint();
    }
    $('#pal', root).addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) addColor(+b.dataset.c); });
    $('#board', root).addEventListener('click', (e) => { const b = e.target.closest('button[data-s]'); if (b && !over) { cur[+b.dataset.s] = null; paint(); } });
    $('#clr', root).onclick = () => { if (!over) { cur = new Array(P.len).fill(null); paint(); } };
    $('#ok', root).onclick = () => {
      if (over) return;
      if (cur.indexOf(null) >= 0) { $('#msg', root).textContent = 'Fill every slot first'; restart($('#board', root), 'shake'); return; }
      if (!P.rep && new Set(cur).size < P.len) { $('#msg', root).textContent = 'This level has no repeated colours'; restart($('#board', root), 'shake'); return; }
      const f = L.mmFeedback(code, cur); rows.push({ g: cur.slice(), f }); cur = new Array(P.len).fill(null); buzz(15);
      if (f.b === P.len) {
        over = true; const n = rows.length;
        if (!best[lv] || n < best[lv]) { best[lv] = n; hsSet('mastermind.best', best); }
        $('#msg', root).textContent = '\u{1F389} Cracked it in ' + n + (n === 1 ? ' guess!' : ' guesses!'); celebrate(root, T);
      } else if (rows.length >= P.tries) {
        over = true; $('#msg', root).innerHTML = 'Out of guesses. The code was ' + code.map(c => '<span style="color:' + MM_COL[c] + ';font-weight:800">' + MM_SYM[c] + '</span>').join(' ');
      } else $('#msg', root).textContent = f.b + ' black, ' + f.w + ' white';
      paint();
    };
    const askMm = () => sure(!over && rows.length > 0, 'Start a new code? Your guesses so far will be lost.');
    $('#new', root).onclick = () => { if (askMm()) newGame(); };
    onSeg(root, 'lv', (v) => { lv = +v; hsSet('mastermind.lv', lv); newGame(); }, askMm);
    newGame();
    return () => T.stop();
  });

/* =====================================================================
   4. Peg Solitaire
   ===================================================================== */
reg('pegsol', 'Peg Solitaire', '♟️', 'The classic English board: jump pegs over their neighbours to remove them and finish with a single peg, ideally in the centre. Undo, stuck detection and a saved best.',
  ['solitaire', 'peg', 'marbles', 'board', 'brain teaser', 'jump'], function (el) {
    const T = tracker();
    let b, hist, sel = -1, best = hsGet('pegsol.best', 99), moves = 0;
    const root = mount(el, `
      <style>.ps-c{aspect-ratio:1;border-radius:50%;display:grid;place-items:center;position:relative;padding:0;border:0;background:var(--surface2);box-shadow:inset 0 2px 5px rgba(0,0,0,.25)}
        .ps-c.v{background:transparent;box-shadow:none;pointer-events:none}
        .ps-p{width:84%;height:84%;border-radius:50%;background:radial-gradient(circle at 32% 28%,#fff8 0 12%,transparent 13%),var(--accent);box-shadow:0 3px 6px rgba(0,0,0,.35);transition:transform .15s}
        .ps-c.sel .ps-p{transform:scale(1.12);background:radial-gradient(circle at 32% 28%,#fff9 0 12%,transparent 13%),#f59e0b}
        .ps-c.tg{box-shadow:0 0 0 3px var(--ok),0 0 14px var(--ok)}
        .ps-c.tg::after{content:"";width:34%;height:34%;border-radius:50%;background:var(--ok);opacity:.7}</style>
      <div class="stats">${stat('pg', 'Pegs left', 32)}${stat('mv', 'Moves', 0)}${stat('bs', 'Best left', best === 99 ? '-' : best)}</div>
      <div id="bd" style="display:grid;grid-template-columns:repeat(7,1fr);gap:5px;max-width:360px;margin:6px auto;padding:10px;border-radius:22px;background:var(--surface);border:1px solid var(--line);box-shadow:var(--shadow)"></div>
      <div class="msg" id="msg"></div>
      <div class="rowb"><button class="btn alt" id="undo">↩ Undo</button><button class="btn alt" id="new">Restart</button></div>`);
    function targets() { return sel < 0 ? [] : L.pegMoves(b).filter(m => m.f === sel); }
    function paint(land) {
      const tg = targets().map(m => m.t); let h = '';
      for (let i = 0; i < 49; i++) {
        if (b[i] < 0) { h += '<div class="ps-c v"></div>'; continue; }
        h += '<button class="ps-c ' + (i === sel ? 'sel ' : '') + (tg.indexOf(i) >= 0 ? 'tg' : '') + '" data-i="' + i + '" aria-label="' + (b[i] ? 'peg' : 'hole') + ' ' + (((i / 7) | 0) + 1) + ',' + (i % 7 + 1) + '">' + (b[i] ? '<span class="ps-p ' + (i === land ? 'pop' : '') + '"></span>' : '') + '</button>';
      }
      $('#bd', root).innerHTML = h; $('#pg', root).textContent = L.pegCount(b); $('#mv', root).textContent = moves;
      $('#undo', root).disabled = !hist.length;
    }
    function status() {
      const left = L.pegCount(b), m = $('#msg', root);
      if (!L.pegMoves(b).length) {
        if (left < best) { best = left; hsSet('pegsol.best', best); $('#bs', root).textContent = best; }
        m.textContent = left === 1 ? (b[24] === 1 ? '\u{1F3C6} Perfect! One peg in the centre!' : '\u{1F389} One peg left, well done!') : 'No moves left, ' + left + ' pegs remain. Undo or restart.';
        if (left === 1) { buzz(80); celebrate(root, T); }
      } else m.textContent = sel < 0 ? 'Tap a peg, then a glowing hole' : '';
    }
    function newGame() { b = L.pegStart(); hist = []; sel = -1; moves = 0; paint(); status(); }
    $('#bd', root).addEventListener('click', (e) => {
      const c = e.target.closest('button'); if (!c) return; const i = +c.dataset.i;
      const mv = targets().find(m => m.t === i);
      if (mv) { hist.push(b); b = L.pegApply(b, mv); moves++; sel = -1; buzz(15); paint(i); status(); return; }
      if (b[i] === 1 && L.pegMoves(b).some(m => m.f === i)) { sel = sel === i ? -1 : i; paint(); status(); } else if (b[i] === 1) { sel = -1; paint(); $('#msg', root).textContent = 'That peg cannot jump'; } else { sel = -1; paint(); status(); }
    });
    $('#undo', root).onclick = () => { if (hist.length) { b = hist.pop(); moves = Math.max(0, moves - 1); sel = -1; paint(); status(); } };
    $('#new', root).onclick = () => { if (sure(moves > 0 && L.pegMoves(b).length > 0, 'Restart? The pegs you have jumped will be put back.')) newGame(); };
    newGame();
    return () => T.stop();
  });

/* =====================================================================
   5. Nonogram
   ===================================================================== */
reg('nonogram', 'Nonogram', '\u{1F530}', 'Picross puzzles: use the number clues to colour in a hidden picture. Built-in 5x5 and 10x10 puzzles plus random ones, every one checked to be solvable by logic alone.',
  ['picross', 'griddler', 'logic', 'picture', 'puzzle', 'paint by numbers'], function (el) {
    const T = tracker();
    let n = hsGet('nonogram.n', 5), source = hsGet('nonogram.src', 'pic'), idx = hsGet('nonogram.idx', { 5: 0, 10: 0 });
    let sol, clues, g, mode = 'fill', t0 = 0, done = false, timer = 0, best = hsGet('nonogram.best', {});
    const root = mount(el, `
      <style>.ng{border-collapse:separate;border-spacing:0;margin:8px auto}.ng td{padding:0;text-align:center}
        .ng .cl{font-size:11px;color:var(--muted);font-weight:700;line-height:1.15;vertical-align:bottom}
        .ng .rc{text-align:right !important;padding-right:6px !important;white-space:nowrap;vertical-align:middle !important;font-size:12px}
        .ng .c{border:1px solid var(--line);background:var(--surface);touch-action:none}
        .ng .c.f{background:var(--accent);border-color:var(--accent)}.ng .c.x{color:var(--muted);font-size:14px}
        .ng .c.sr{border-right:2px solid var(--muted)}.ng .c.sb{border-bottom:2px solid var(--muted)}
        .ng .c.ok{animation:g2pop .5s both}.ng .ok-row .c{border-radius:6px}</style>
      ${seg('sz', [[5, '5 x 5'], [10, '10 x 10']], n)}
      ${seg('sr', [['pic', 'Pictures'], ['rnd', 'Random']], source)}
      <div class="stats">${stat('tm', 'Time', '0:00')}${stat('bs', 'Best', '-')}</div>
      <div id="wrap" style="overflow:auto;touch-action:none"></div>
      <div class="msg" id="msg"></div>
      ${seg('md', [['fill', '■ Fill'], ['mark', '✕ Mark empty']], 'fill')}
      <div class="rowb"><button class="btn alt" id="clr">Clear</button><button class="btn" id="new">Next puzzle</button></div>`);
    const toGrid = (p) => p.map(r => [...r].map(c => c === '#' ? 1 : 0));
    function load(advance) {
      if (source === 'pic') {
        const set = n === 5 ? L.NG5 : L.NG10;
        if (advance) idx[n] = (idx[n] + 1) % set.length; hsSet('nonogram.idx', idx); sol = toGrid(set[idx[n] % set.length]);
      } else sol = L.ngGen(n, Math.random) || toGrid((n === 5 ? L.NG5 : L.NG10)[0]);
      clues = L.ngClues(sol); g = sol.map(r => r.map(() => 0)); done = false; t0 = 0;
      T.clear(timer); $('#tm', root).textContent = '0:00'; $('#msg', root).textContent = 'Tap or drag across cells'; build();
      $('#bs', root).textContent = best[n] ? fmtT(best[n]) : '-';
    }
    function build() {
      const cs = n === 5 ? 44 : 26, maxc = Math.max(...clues.cols.map(c => c.length)); let h = '<table class="ng"><tr><td></td>';
      clues.cols.forEach(c => { h += '<td class="cl" style="width:' + cs + 'px;padding-bottom:3px">' + (c.length ? c.join('<br>') : '0') + '</td>'; });
      h += '</tr>';
      for (let r = 0; r < n; r++) {
        h += '<tr><td class="cl rc">' + (clues.rows[r].length ? clues.rows[r].join(' ') : '0') + '</td>';
        for (let c = 0; c < n; c++) h += '<td class="c ' + (n === 10 && c === 4 ? 'sr ' : '') + (n === 10 && r === 4 ? 'sb' : '') + '" data-r="' + r + '" data-c="' + c + '" style="width:' + cs + 'px;height:' + cs + 'px"></td>';
        h += '</tr>';
      }
      $('#wrap', root).innerHTML = h + '</table>'; void maxc;
    }
    function paintCell(r, c) {
      const td = $('td.c[data-r="' + r + '"][data-c="' + c + '"]', root); if (!td) return;
      td.className = td.className.replace(/ ?\b(f|x)\b/g, '') + (g[r][c] === 1 ? ' f' : g[r][c] === 2 ? ' x' : ''); td.textContent = g[r][c] === 2 ? '✕' : '';
    }
    let paintVal = null, down = false;
    function apply(td) {
      if (!td || !td.dataset || td.dataset.r == null || done) return;
      const r = +td.dataset.r, c = +td.dataset.c;
      if (paintVal === null) { const want = mode === 'fill' ? 1 : 2; paintVal = g[r][c] === want ? 0 : want; }
      if (g[r][c] !== paintVal) { g[r][c] = paintVal; paintCell(r, c); }
      if (!t0) { t0 = Date.now(); timer = T.iv(() => { $('#tm', root).textContent = fmtT((Date.now() - t0) / 1000); }, 500); }
      check();
    }
    function check() {
      if (L.ngMatches(g, clues.rows, clues.cols)) {
        done = true; T.clear(timer); const s = Math.round((Date.now() - t0) / 1000); buzz(80);
        if (!best[n] || s < best[n]) { best[n] = s; hsSet('nonogram.best', best); }
        $('#bs', root).textContent = fmtT(best[n]); $('#tm', root).textContent = fmtT(s);
        $('#msg', root).textContent = '\u{1F389} Solved in ' + fmtT(s) + '!'; celebrate(root, T);
        $$('td.c', root).forEach((td, i) => { td.style.animation = 'g2pop .5s ' + (i % n * 0.04 + ((i / n) | 0) * 0.03) + 's both'; });
      }
    }
    const wrap = $('#wrap', root);
    wrap.addEventListener('pointerdown', (e) => { const td = e.target.closest('td.c'); if (!td) return; down = true; paintVal = null; apply(td); });
    wrap.addEventListener('pointermove', (e) => { if (!down) return; const t = document.elementFromPoint(e.clientX, e.clientY); if (t && t.closest) apply(t.closest('td.c')); });
    T.on(window, 'pointerup', () => { down = false; paintVal = null; });
    T.on(window, 'pointercancel', () => { down = false; paintVal = null; });
    const askNg = () => sure(!done && g.some(r => r.some(v => v === 1)), 'Leave this puzzle? The cells you filled will be lost.');
    onSeg(root, 'sz', (v) => { n = +v; hsSet('nonogram.n', n); load(false); }, askNg);
    onSeg(root, 'sr', (v) => { source = v; hsSet('nonogram.src', v); load(false); }, askNg);
    onSeg(root, 'md', (v) => { mode = v; });
    $('#new', root).onclick = () => { if (askNg()) load(true); };
    keepTime(T, d => { if (t0) t0 += d; });
    $('#clr', root).onclick = () => { if (!sure(!done && g.some(r => r.some(v => v)), 'Clear the grid?')) return; g = sol.map(r => r.map(() => 0)); done = false; t0 = 0; T.clear(timer); $('#tm', root).textContent = '0:00'; build(); $('#msg', root).textContent = 'Cleared'; };
    load(false);
    return () => T.stop();
  });

/* =====================================================================
   6. Block Stack
   ===================================================================== */
const BS_COL = ['', '#06b6d4', '#eab308', '#a855f7', '#22c55e', '#ef4444', '#3b82f6', '#f97316'];
reg('blockstack', 'Block Stack', '\u{1F9CA}', 'A falling-blocks game: move and rotate the pieces, complete rows to clear them and survive as the levels speed up. Drag, tap and swipe on the board or use the buttons.',
  ['tetris', 'blocks', 'falling', 'arcade', 'tetromino', 'puzzle'], function (el) {
    const T = tracker(), CW = 26, W = L.BS_W, H = L.BS_H, SB = 4.2 * CW;
    let board, piece, next, bag, score, lines, level, state = 'idle', acc = 0, best = hsGet('blockstack.best', 0), flash = null;
    const root = mount(el, `
      <div class="stats">${stat('sc', 'Score', 0)}${stat('lv', 'Level', 1)}${stat('ln', 'Lines', 0)}${stat('bs', 'Best', best)}</div>
      <div class="cvw" id="w" style="max-width:360px"><canvas id="cv" class="cv" width="${W * CW + SB}" height="${H * CW}" aria-label="Block Stack board"></canvas></div>
      <div class="rowb" style="max-width:420px;margin-left:auto;margin-right:auto">
        <button class="btn alt" data-a="l" aria-label="Move left">◀</button><button class="btn alt" data-a="r" aria-label="Move right">▶</button>
        <button class="btn alt" data-a="rot" aria-label="Rotate">⟳</button><button class="btn alt" data-a="d" aria-label="Soft drop">▼</button>
        <button class="btn" data-a="hd" aria-label="Hard drop">⤓</button><button class="btn alt" id="pz" aria-label="Pause">⏸</button>
      </div>`);
    const cv = $('#cv', root), ctx = fitCanvas(cv, W * CW + SB, H * CW), wrap = $('#w', root);
    function spawn() {
      if (!bag || !bag.length) bag = L.bsBag();
      const t = next || bag.shift(); if (!bag.length) bag = L.bsBag(); next = bag.shift();
      const m = L.BS_SHAPES[t].map(r => r.slice());
      piece = { t, id: L.BS_KEYS.indexOf(t) + 1, m, x: Math.floor((W - m[0].length) / 2), y: t === 'I' ? -1 : 0 };
      if (L.bsCollide(board, piece.m, piece.x, piece.y)) end();
    }
    function reset() {
      board = L.bsNewBoard(); bag = L.bsBag(); next = null; score = 0; lines = 0; level = 1; acc = 0; flash = null; spawn(); hud();
    }
    function hud() {
      $('#sc', root).textContent = score; $('#lv', root).textContent = level; $('#ln', root).textContent = lines; $('#bs', root).textContent = best;
    }
    function start() { reset(); state = 'run'; overlay(wrap, ''); loop.resume(); }
    function end() {
      state = 'over'; buzz(150);
      if (score > best) { best = score; hsSet('blockstack.best', best); }
      hud(); overlay(wrap, '<b>Game over</b><div>Score ' + score + ' · ' + lines + ' lines</div><button class="btn">Play again</button>', start);
    }
    function lock() {
      L.bsLock(board, piece.m, piece.x, piece.y, piece.id);
      const full = []; board.forEach((r, i) => { if (r.every(Boolean)) full.push(i); });
      if (full.length) { flash = { rows: full, t: 0.18 }; buzz(30); } else spawn();
      if (!full.length) acc = 0;
    }
    function finishClear() {
      const n = L.bsClear(board); score += L.bsScore(n, level); lines += n; level = L.bsLevel(lines); flash = null; hud(); spawn(); acc = 0;
    }
    function tryMove(dx, dy) {
      if (state !== 'run' || loop.paused || flash) return false;
      if (L.bsCollide(board, piece.m, piece.x + dx, piece.y + dy)) return false;
      piece.x += dx; piece.y += dy; return true;
    }
    function rotate() {
      if (state !== 'run' || loop.paused || flash) return;
      const r = L.bsTryRotate(board, piece); if (r) { piece.m = r.m; piece.x = r.x; piece.y = r.y; }
    }
    function hardDrop() {
      if (state !== 'run' || loop.paused || flash) return;
      let n = 0; while (!L.bsCollide(board, piece.m, piece.x, piece.y + 1)) { piece.y++; n++; }
      score += n * 2; hud(); lock();
    }
    function softDrop() { if (tryMove(0, 1)) { score += 1; hud(); acc = 0; } }
    function step(dt) {
      if (state !== 'run') return;
      if (flash) { flash.t -= dt; if (flash.t <= 0) finishClear(); return; }
      acc += dt * 1000;
      const d = L.bsDelay(level);
      while (acc >= d && !flash && state === 'run') {
        acc -= d;
        if (!L.bsCollide(board, piece.m, piece.x, piece.y + 1)) piece.y++; else { lock(); break; }
      }
    }
    function cell(x, y, col, a) {
      ctx.globalAlpha = a == null ? 1 : a; ctx.fillStyle = col; ctx.beginPath(); rrect(ctx, x * CW + 1, y * CW + 1, CW - 2, CW - 2, 5); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(x * CW + 4, y * CW + 3, CW - 8, 4); ctx.globalAlpha = 1;
    }
    function draw() {
      const bg = cssv(root, '--surface2'), ln = cssv(root, '--line');
      ctx.clearRect(0, 0, W * CW + SB, H * CW); ctx.fillStyle = bg; ctx.fillRect(0, 0, W * CW, H * CW);
      ctx.strokeStyle = ln; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = 1; x < W; x++) { ctx.moveTo(x * CW + .5, 0); ctx.lineTo(x * CW + .5, H * CW); }
      for (let y = 1; y < H; y++) { ctx.moveTo(0, y * CW + .5); ctx.lineTo(W * CW, y * CW + .5); }
      ctx.stroke();
      if (!board) return;
      board.forEach((r, y) => r.forEach((v, x) => { if (v) cell(x, y, BS_COL[v]); }));
      if (flash) { ctx.fillStyle = 'rgba(255,255,255,.8)'; flash.rows.forEach(y => ctx.fillRect(0, y * CW, W * CW, CW)); }
      if (piece && state === 'run' && !flash) {
        let gy = piece.y; while (!L.bsCollide(board, piece.m, piece.x, gy + 1)) gy++;
        piece.m.forEach((r, ry) => r.forEach((v, rx) => { if (v && gy + ry >= 0) cell(piece.x + rx, gy + ry, BS_COL[piece.id], .22); }));
        piece.m.forEach((r, ry) => r.forEach((v, rx) => { if (v && piece.y + ry >= 0) cell(piece.x + rx, piece.y + ry, BS_COL[piece.id]); }));
      }
      ctx.fillStyle = cssv(root, '--muted'); ctx.font = '600 13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('NEXT', W * CW + SB / 2, 22);
      if (next) {
        const m = L.BS_SHAPES[next], id = L.BS_KEYS.indexOf(next) + 1, ox = W * CW + (SB - m[0].length * 20) / 2, oy = 40;
        m.forEach((r, ry) => r.forEach((v, rx) => { if (v) { ctx.fillStyle = BS_COL[id]; ctx.beginPath(); rrect(ctx, ox + rx * 20, oy + ry * 20, 18, 18, 4); ctx.fill(); } }));
      }
    }
    const loop = gameLoop(T, step, draw, (p) => {
      if (state === 'run') overlay(wrap, p ? '<b>Paused</b><button class="btn">Resume</button>' : '', p ? () => loop.resume() : null);
      $('#pz', root).textContent = p ? '▶' : '⏸';
    });
    overlay(wrap, '<b>Block Stack</b><div>Tap the board to rotate, drag to move, swipe down to drop</div><button class="btn">Start</button>', start);
    // buttons (auto-repeat on hold for moves)
    function act(a) { if (a === 'l') tryMove(-1, 0); else if (a === 'r') tryMove(1, 0); else if (a === 'rot') rotate(); else if (a === 'd') softDrop(); else if (a === 'hd') hardDrop(); }
    let rep = 0;
    $$('button[data-a]', root).forEach(b => {
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault(); act(b.dataset.a);
        if (/^[lrd]$/.test(b.dataset.a)) { T.clear(rep); rep = T.to(function again() { act(b.dataset.a); rep = T.to(again, 70); }, 260); }
      });
      const stop = () => T.clear(rep); b.addEventListener('pointerup', stop); b.addEventListener('pointerleave', stop); b.addEventListener('pointercancel', stop);
    });
    $('#pz', root).onclick = () => { if (state === 'run') loop.toggle(); };
    // gestures
    let gx = 0, gy = 0, gt = 0, moved = false, accx = 0, lastx = 0, drop = false;
    cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); gx = lastx = e.clientX; gy = e.clientY; gt = Date.now(); moved = false; accx = 0; drop = false; });
    cv.addEventListener('pointermove', (e) => {
      if (!gt) return; const r = cv.getBoundingClientRect(), cell = CW * r.width / cv._lw;
      accx += e.clientX - lastx; lastx = e.clientX;
      while (accx > cell * 0.9) { tryMove(1, 0); accx -= cell; moved = true; }
      while (accx < -cell * 0.9) { tryMove(-1, 0); accx += cell; moved = true; }
      const dy = e.clientY - gy;
      if (!drop && dy > cell * 4 && Date.now() - gt < 450 && Math.abs(e.clientX - gx) < cell * 2) { drop = true; hardDrop(); }
      else if (!drop && dy > cell * 1.2 && Math.abs(e.clientX - gx) < cell) { softDrop(); gy = e.clientY - cell * 0.2; moved = true; }
    });
    const up = () => { if (gt && !moved && !drop && Date.now() - gt < 300) rotate(); gt = 0; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', () => { gt = 0; });
    T.on(window, 'keydown', (e) => {
      const k = { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'rot', ArrowDown: 'd', ' ': 'hd' }[e.key];
      if (k) { e.preventDefault(); act(k); }
    });
    reset(); piece = null; draw();
    return () => T.stop();
  });

/* =====================================================================
   7. Breakout
   ===================================================================== */
reg('breakout', 'Breakout', '\u{1F3B3}', 'Bounce the ball off your paddle to smash every brick. Drag your finger to steer, three lives, faster balls and more rows each level.',
  ['brick', 'paddle', 'arkanoid', 'ball', 'arcade'], function (el) {
    const T = tracker(), W = 360, H = 480, PW0 = 74, PH = 12, PY = H - 42, R = 7;
    let bricks, ball, pad_ = { x: W / 2, w: PW0 }, lives, score, level, state = 'idle', best = hsGet('breakout.best', 0), parts = [];
    const root = mount(el, `
      <div class="stats">${stat('sc', 'Score', 0)}${stat('lv', 'Level', 1)}${stat('li', 'Lives', 3)}${stat('bs', 'Best', best)}</div>
      <div class="cvw" id="w"><canvas id="cv" class="cv" width="${W}" height="${H}" aria-label="Breakout board"></canvas></div>
      <div class="rowb" style="max-width:420px;margin:0 auto"><button class="btn alt" id="pz">⏸ Pause</button></div>`);
    const cv = $('#cv', root), ctx = fitCanvas(cv, W, H), wrap = $('#w', root);
    const COLS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7'];
    function buildBricks() {
      bricks = []; const rows = Math.min(8, 4 + level), bw = 40, bh = 18, cols = 8, ox = (W - cols * bw) / 2;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) bricks.push({ x: ox + c * bw + 1, y: 50 + r * (bh + 2), w: bw - 2, h: bh, col: COLS[r % COLS.length], pts: (rows - r) * 5 });
    }
    function serve() { ball = { x: pad_.x, y: PY - R - 1, vx: 0, vy: 0, stuck: true, sp: 270 + level * 25 }; }
    function hud() { $('#sc', root).textContent = score; $('#lv', root).textContent = level; $('#li', root).textContent = lives; $('#bs', root).textContent = best; }
    function start() { score = 0; level = 1; lives = 3; pad_.w = PW0; buildBricks(); serve(); parts = []; state = 'run'; overlay(wrap, ''); hud(); loop.resume(); }
    function over(win) {
      state = 'over'; buzz(120); if (score > best) { best = score; hsSet('breakout.best', best); } hud();
      overlay(wrap, '<b>' + (win ? 'You win!' : 'Game over') + '</b><div>Score ' + score + '</div><button class="btn">Play again</button>', start);
    }
    function launch() { if (ball && ball.stuck && state === 'run' && !loop.paused) { ball.stuck = false; const a = (Math.random() * 0.8 - 0.4); ball.vx = Math.sin(a) * ball.sp; ball.vy = -Math.cos(a) * ball.sp; } }
    function burst(x, y, col) { for (let i = 0; i < 8; i++) parts.push({ x, y, vx: (Math.random() - .5) * 160, vy: (Math.random() - .5) * 160, t: .5, col }); }
    function step(dt) {
      if (state !== 'run') return;
      parts.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.t -= dt; }); parts = parts.filter(p => p.t > 0);
      if (ball.stuck) { ball.x = pad_.x; return; }
      const subs = 3;
      for (let s = 0; s < subs; s++) {
        ball.x += ball.vx * dt / subs; ball.y += ball.vy * dt / subs;
        if (ball.x < R) { ball.x = R; ball.vx = Math.abs(ball.vx); } else if (ball.x > W - R) { ball.x = W - R; ball.vx = -Math.abs(ball.vx); }
        if (ball.y < R) { ball.y = R; ball.vy = Math.abs(ball.vy); }
        const hp = L.circleRect(ball.x, ball.y, R, pad_.x - pad_.w / 2, PY, pad_.w, PH);
        if (hp && ball.vy > 0) {
          const off = clamp((ball.x - pad_.x) / (pad_.w / 2), -1, 1), a = off * 1.05;
          ball.vx = Math.sin(a) * ball.sp; ball.vy = -Math.cos(a) * ball.sp; ball.y = PY - R; buzz(8);
        }
        for (let i = 0; i < bricks.length; i++) {
          const b = bricks[i], h = L.circleRect(ball.x, ball.y, R, b.x, b.y, b.w, b.h);
          if (!h) continue;
          const dot = ball.vx * h.nx + ball.vy * h.ny;
          if (dot < 0) { ball.vx -= 2 * dot * h.nx; ball.vy -= 2 * dot * h.ny; }
          ball.x += h.nx * h.depth; ball.y += h.ny * h.depth;
          score += b.pts; burst(b.x + b.w / 2, b.y + b.h / 2, b.col); bricks.splice(i, 1); ball.sp = Math.min(520, ball.sp + 4); buzz(10);
          const k = ball.sp / Math.hypot(ball.vx, ball.vy); ball.vx *= k; ball.vy *= k; hud(); break;
        }
      }
      if (!bricks.length) { level++; buildBricks(); serve(); hud(); buzz(60); return; }
      if (ball.y > H + R) { lives--; hud(); if (lives <= 0) over(false); else serve(); }
    }
    function draw() {
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = cssv(root, '--surface2'); ctx.fillRect(0, 0, W, H);
      if (!bricks) return;
      bricks.forEach(b => { ctx.fillStyle = b.col; ctx.beginPath(); rrect(ctx, b.x, b.y, b.w, b.h, 4); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(b.x + 3, b.y + 2, b.w - 6, 4); });
      parts.forEach(p => { ctx.globalAlpha = Math.max(0, p.t * 2); ctx.fillStyle = p.col; ctx.fillRect(p.x, p.y, 4, 4); }); ctx.globalAlpha = 1;
      ctx.fillStyle = cssv(root, '--accent'); ctx.beginPath(); rrect(ctx, pad_.x - pad_.w / 2, PY, pad_.w, PH, 6); ctx.fill();
      if (ball) { ctx.fillStyle = cssv(root, '--text'); ctx.beginPath(); ctx.arc(ball.x, ball.y, R, 0, 7); ctx.fill(); }
      if (ball && ball.stuck && state === 'run') { ctx.fillStyle = cssv(root, '--muted'); ctx.font = '600 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Tap to launch', W / 2, H / 2 + 60); }
    }
    const loop = gameLoop(T, step, draw, (p) => {
      if (state === 'run') overlay(wrap, p ? '<b>Paused</b><button class="btn">Resume</button>' : '', p ? () => loop.resume() : null);
      $('#pz', root).textContent = p ? '▶ Resume' : '⏸ Pause';
    });
    function move(e) { pad_.x = clamp(ptr(cv, e).x, pad_.w / 2, W - pad_.w / 2); }
    cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); move(e); launch(); });
    cv.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') move(e); });
    T.on(window, 'keydown', (e) => {
      if (e.key === 'ArrowLeft') pad_.x = clamp(pad_.x - 24, pad_.w / 2, W - pad_.w / 2);
      else if (e.key === 'ArrowRight') pad_.x = clamp(pad_.x + 24, pad_.w / 2, W - pad_.w / 2);
      else if (e.key === ' ') launch();
    });
    $('#pz', root).onclick = () => { if (state === 'run') loop.toggle(); };
    overlay(wrap, '<b>Breakout</b><div>Drag to move the paddle, tap to launch</div><button class="btn">Start</button>', start);
    level = 1; buildBricks(); serve(); lives = 3; score = 0;
    return () => T.stop();
  });

/* =====================================================================
   8. Pong vs AI
   ===================================================================== */
reg('pong', 'Pong', '\u{1F3D3}', 'Table tennis against the phone: drag your paddle at the bottom, beat the AI to seven points. Three AI levels and a saved win count.',
  ['ping pong', 'table tennis', 'paddle', 'ai', 'arcade', 'classic'], function (el) {
    const T = tracker(), W = 360, H = 520, PW = 70, PH = 12, R = 8, WIN = 7;
    const LV = { 0: { sp: 150, err: 55 }, 1: { sp: 230, err: 28 }, 2: { sp: 320, err: 10 } };
    let lv = hsGet('pong.lv', 1), st = hsGet('pong', { wins: 0, played: 0 });
    let me, ai, ball, sc, state = 'idle', wait = 0, aimErr = 0;
    const root = mount(el, `
      ${seg('lv', [[0, 'Easy'], [1, 'Normal'], [2, 'Hard']], lv)}
      <div class="stats">${stat('you', 'You', 0)}${stat('cpu', 'Phone', 0)}${stat('wn', 'Games won', st.wins)}</div>
      <div class="cvw" id="w" style="max-width:380px"><canvas id="cv" class="cv" width="${W}" height="${H}" aria-label="Pong table"></canvas></div>`);
    const cv = $('#cv', root), ctx = fitCanvas(cv, W, H), wrap = $('#w', root);
    function serve(dir) { ball = { x: W / 2, y: H / 2, vx: (Math.random() - .5) * 160, vy: dir * 230, sp: 250 }; wait = 0.8; aimErr = (Math.random() * 2 - 1) * LV[lv].err; }
    function start() { me = W / 2; ai = W / 2; sc = [0, 0]; state = 'run'; serve(Math.random() < .5 ? 1 : -1); overlay(wrap, ''); hud(); loop.resume(); }
    function hud() { $('#you', root).textContent = sc[0]; $('#cpu', root).textContent = sc[1]; }
    function finish() {
      state = 'over'; st.played++; const win = sc[0] > sc[1]; if (win) st.wins++; hsSet('pong', st); $('#wn', root).textContent = st.wins; buzz(win ? 90 : 150);
      overlay(wrap, '<b>' + (win ? '\u{1F389} You win ' : 'You lose ') + sc[0] + ' - ' + sc[1] + '</b><button class="btn">Play again</button>', start);
    }
    function point(who) { sc[who]++; hud(); buzz(40); if (sc[who] >= WIN) finish(); else serve(who === 0 ? 1 : -1); }
    function step(dt) {
      if (state !== 'run') return;
      if (wait > 0) { wait -= dt; return; }
      for (let s = 0; s < 3; s++) {
        ball.x += ball.vx * dt / 3; ball.y += ball.vy * dt / 3;
        if (ball.x < R) { ball.x = R; ball.vx = Math.abs(ball.vx); } else if (ball.x > W - R) { ball.x = W - R; ball.vx = -Math.abs(ball.vx); }
        // my paddle at bottom (y = H-30), AI paddle at top (y = 18)
        const mh = L.circleRect(ball.x, ball.y, R, me - PW / 2, H - 30, PW, PH), ah = L.circleRect(ball.x, ball.y, R, ai - PW / 2, 18, PW, PH);
        if (mh && ball.vy > 0) { const o = clamp((ball.x - me) / (PW / 2), -1, 1); ball.sp = Math.min(560, ball.sp + 14); ball.vx = o * ball.sp * .8; ball.vy = -Math.sqrt(Math.max(1, ball.sp * ball.sp - ball.vx * ball.vx)); ball.y = H - 30 - R; buzz(8); aimErr = (Math.random() * 2 - 1) * LV[lv].err; }
        if (ah && ball.vy < 0) { const o = clamp((ball.x - ai) / (PW / 2), -1, 1); ball.sp = Math.min(560, ball.sp + 14); ball.vx = o * ball.sp * .8; ball.vy = Math.sqrt(Math.max(1, ball.sp * ball.sp - ball.vx * ball.vx)); ball.y = 18 + PH + R; }
      }
      const target = ball.vy < 0 ? ball.x + aimErr : W / 2;
      ai = clamp(L.pongAi(ai, target, LV[lv].sp, dt), PW / 2, W - PW / 2);
      if (ball.y < -R) point(0); else if (ball.y > H + R) point(1);
    }
    function draw() {
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = cssv(root, '--surface2'); ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = cssv(root, '--line'); ctx.setLineDash([10, 10]); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke(); ctx.setLineDash([]);
      if (!sc) return;
      ctx.fillStyle = cssv(root, '--muted'); ctx.font = '800 54px sans-serif'; ctx.textAlign = 'center'; ctx.globalAlpha = .35; ctx.fillText(sc[1], W / 2, H / 2 - 40); ctx.fillText(sc[0], W / 2, H / 2 + 80); ctx.globalAlpha = 1;
      ctx.fillStyle = cssv(root, '--danger'); ctx.beginPath(); rrect(ctx, ai - PW / 2, 18, PW, PH, 6); ctx.fill();
      ctx.fillStyle = cssv(root, '--accent'); ctx.beginPath(); rrect(ctx, me - PW / 2, H - 30, PW, PH, 6); ctx.fill();
      if (ball) { ctx.fillStyle = cssv(root, '--text'); ctx.globalAlpha = wait > 0 ? .5 + Math.sin(wait * 20) * .3 : 1; ctx.beginPath(); ctx.arc(ball.x, ball.y, R, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    }
    const loop = gameLoop(T, step, draw, (p) => { if (state === 'run') overlay(wrap, p ? '<b>Paused</b><button class="btn">Resume</button>' : '', p ? () => loop.resume() : null); });
    function move(e) { me = clamp(ptr(cv, e).x, PW / 2, W - PW / 2); }
    cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); move(e); if (state === 'run' && loop.paused) loop.resume(); });
    cv.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') move(e); });
    T.on(window, 'keydown', (e) => { if (e.key === 'ArrowLeft') me = clamp(me - 26, PW / 2, W - PW / 2); else if (e.key === 'ArrowRight') me = clamp(me + 26, PW / 2, W - PW / 2); });
    onSeg(root, 'lv', (v) => { lv = +v; hsSet('pong.lv', lv); if (state === 'run') { state = 'idle'; overlay(wrap, '<b>Pong</b><div>First to ' + WIN + ' wins. Drag to move.</div><button class="btn">Start</button>', start); } });
    overlay(wrap, '<b>Pong</b><div>First to ' + WIN + ' wins. Drag to move your paddle.</div><button class="btn">Start</button>', start);
    sc = [0, 0]; me = W / 2; ai = W / 2; ball = null;
    return () => T.stop();
  });

/* =====================================================================
   9. Dodge
   ===================================================================== */
reg('dodge', 'Dodge', '☄️', 'Steer your ship left and right to dodge falling rocks and grab stars. Drag to move, or switch on tilt steering. It gets faster the longer you last.',
  ['avoid', 'asteroid', 'rocks', 'tilt', 'survive', 'arcade'], function (el) {
    const T = tracker(), W = 360, H = 520, PR = 13, PY = H - 56;
    let awake = false, px, objs, t, spawnT, score, state = 'idle', best = hsGet('dodge.best', 0), tilt = hsGet('dodge.tilt', false), gamma = 0, tx = null;
    const root = mount(el, `
      <div class="stats">${stat('sc', 'Score', 0)}${stat('bs', 'Best', best)}</div>
      <div class="cvw" id="w" style="max-width:380px"><canvas id="cv" class="cv" width="${W}" height="${H}" aria-label="Dodge arena"></canvas></div>
      <div class="rowb" style="max-width:420px;margin:0 auto"><button class="btn alt" id="tl"></button><button class="btn alt" id="pz">⏸ Pause</button></div>
      <div class="msg muted" id="msg" style="font-size:13px;font-weight:500"></div>`);
    const cv = $('#cv', root), ctx = fitCanvas(cv, W, H), wrap = $('#w', root);
    function hud() { $('#sc', root).textContent = score; $('#bs', root).textContent = best; }
    function tiltBtn() { $('#tl', root).textContent = tilt ? 'Steering: tilt' : 'Steering: drag'; }
    function onOrient(e) { if (e.gamma != null) gamma = e.gamma; }
    function setTilt(on) {
      if (!on) { tilt = false; window.removeEventListener('deviceorientation', onOrient); hsSet('dodge.tilt', false); tiltBtn(); $('#msg', root).textContent = ''; return; }
      const go = () => { tilt = true; if (!awake) { awake = true; keepAwake(T); } window.addEventListener('deviceorientation', onOrient); hsSet('dodge.tilt', true); tiltBtn(); };
      try {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
          DeviceOrientationEvent.requestPermission().then(r => { if (r === 'granted') go(); else $('#msg', root).textContent = 'Motion permission denied, using drag.'; }).catch(() => { $('#msg', root).textContent = 'Tilt is not available, using drag.'; });
        } else if ('DeviceOrientationEvent' in window) { go(); $('#msg', root).textContent = 'If the ship does not respond, switch back to drag.'; } else $('#msg', root).textContent = 'No tilt sensor found, using drag.';
      } catch (e) { $('#msg', root).textContent = 'Tilt is not available, using drag.'; }
    }
    function start() { px = W / 2; objs = []; t = 0; spawnT = 0.4; score = 0; state = 'run'; overlay(wrap, ''); hud(); loop.resume(); }
    function over() {
      state = 'over'; buzz(150); if (score > best) { best = score; hsSet('dodge.best', best); } hud();
      overlay(wrap, '<b>Crash!</b><div>Score ' + score + '</div><button class="btn">Try again</button>', start);
    }
    function step(dt) {
      if (state !== 'run') return;
      t += dt; const diff = 1 + t / 25;
      if (tilt) px = clamp(px + gamma * 14 * dt, PR, W - PR); else if (tx != null) px += (clamp(tx, PR, W - PR) - px) * Math.min(1, dt * 18);
      spawnT -= dt;
      if (spawnT <= 0) {
        spawnT = Math.max(0.16, 0.55 / diff) * (0.7 + Math.random() * 0.6);
        if (Math.random() < 0.14) objs.push({ star: true, x: 20 + Math.random() * (W - 40), y: -20, r: 11, vy: 150 * diff, rot: 0 });
        else { const r = 10 + Math.random() * 16; objs.push({ x: r + Math.random() * (W - 2 * r), y: -r, r, vy: (130 + Math.random() * 90) * diff, vx: (Math.random() - .5) * 60, rot: Math.random() * 6, spin: (Math.random() - .5) * 3 }); }
      }
      for (const o of objs) { o.y += o.vy * dt; if (o.vx) { o.x += o.vx * dt; if (o.x < o.r || o.x > W - o.r) o.vx = -o.vx; } if (o.spin) o.rot += o.spin * dt; }
      for (let i = objs.length - 1; i >= 0; i--) {
        const o = objs[i], d = Math.hypot(o.x - px, o.y - PY);
        if (d < o.r + PR - (o.star ? -4 : 4)) { if (o.star) { score += 25; objs.splice(i, 1); buzz(12); hud(); continue; } return over(); }
        if (o.y > H + 40) objs.splice(i, 1);
      }
      if (Math.floor(t) !== Math.floor(t - dt)) { score += 5; hud(); }
    }
    function draw() {
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = cssv(root, '--surface2'); ctx.fillRect(0, 0, W, H);
      if (!objs) { return; }
      objs.forEach(o => {
        if (o.star) { ctx.font = '26px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('⭐', o.x, o.y); return; }
        ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.rot); ctx.fillStyle = '#8b7d6b'; ctx.beginPath();
        for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, rr = o.r * (0.82 + ((i * 37) % 5) * 0.06); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.arc(o.r * .25, o.r * .1, o.r * .25, 0, 7); ctx.fill(); ctx.restore();
      });
      ctx.save(); ctx.translate(px, PY); ctx.fillStyle = cssv(root, '--accent'); ctx.beginPath(); ctx.moveTo(0, -PR - 4); ctx.lineTo(PR, PR); ctx.lineTo(0, PR - 5); ctx.lineTo(-PR, PR); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.moveTo(-5, PR - 3); ctx.lineTo(0, PR + 6 + Math.random() * 6); ctx.lineTo(5, PR - 3); ctx.fill(); ctx.restore();
    }
    const loop = gameLoop(T, step, draw, (p) => {
      if (state === 'run') overlay(wrap, p ? '<b>Paused</b><button class="btn">Resume</button>' : '', p ? () => loop.resume() : null);
      $('#pz', root).textContent = p ? '▶ Resume' : '⏸ Pause';
    });
    cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); tx = ptr(cv, e).x; });
    cv.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') tx = ptr(cv, e).x; });
    T.on(window, 'keydown', (e) => { if (e.key === 'ArrowLeft') tx = (tx == null ? px : tx) - 30; else if (e.key === 'ArrowRight') tx = (tx == null ? px : tx) + 30; });
    $('#pz', root).onclick = () => { if (state === 'run') loop.toggle(); };
    $('#tl', root).onclick = () => setTilt(!tilt);
    { const wantTilt = tilt; tilt = false; tiltBtn(); if (wantTilt) setTilt(true); }   // the button always has a label, even while a permission request is pending or refused
    px = W / 2; objs = []; score = 0; t = 0;
    overlay(wrap, '<b>Dodge</b><div>Drag to steer. Collect stars, avoid rocks.</div><button class="btn">Start</button>', start);
    return () => { T.stop(); window.removeEventListener('deviceorientation', onOrient); };
  }, ['motion', 'storage']);

/* =====================================================================
   10. Gem Match
   ===================================================================== */
const GEMS = ['\u{1F34E}', '\u{1F34B}', '\u{1F347}', '\u{1FAD0}', '\u{1F34A}', '\u{1F353}'];
reg('gemmatch', 'Gem Match', '\u{1F4A0}', 'A match-3 puzzle: swap neighbouring fruit gems to line up three or more. Gems fall, new ones drop in and cascades score combo bonuses. 30 moves per game.',
  ['match 3', 'match-3', 'candy', 'swap', 'gems', 'cascade', 'puzzle'], function (el) {
    const T = tracker(), N = 8, KINDS = 6, MOVES = 30;
    let gen = 0, b, els, sel = -1, busy = false, score, moves, over = false, best = hsGet('gemmatch.best', 0), started = false;
    const root = mount(el, `
      <style>.gm-b{position:relative;width:100%;max-width:380px;aspect-ratio:1;margin:8px auto;border-radius:18px;background:var(--surface2);border:1px solid var(--line);touch-action:none;overflow:hidden}
        .gm-g{position:absolute;width:12.5%;height:12.5%;display:grid;place-items:center;transition:left .25s ease,top .25s ease,transform .2s,opacity .2s;cursor:pointer}
        .gm-g span{display:grid;place-items:center;width:88%;height:88%;border-radius:30%;transition:background .15s,transform .15s}
        .gm-g.sel span{background:var(--accent);transform:scale(1.1)}
        .gm-g.gone{transform:scale(0);opacity:0}.gm-g.hint span{animation:g2pulse .6s ease-in-out 3}
        @keyframes g2pulse{50%{transform:scale(1.25)}}</style>
      <div class="stats">${stat('sc', 'Score', 0)}${stat('mv', 'Moves left', MOVES)}${stat('bs', 'Best', best)}</div>
      <div class="gm-b" id="bd"></div>
      <div class="msg" id="msg">Swap two neighbouring gems</div>
      <div class="rowb"><button class="btn alt" id="hint">\u{1F4A1} Hint</button><button class="btn alt" id="new">New game</button></div>`);
    const bd = $('#bd', root);
    const wait = (ms) => new Promise(r => T.to(r, ms));
    const pos = (e, i) => { e.style.left = (i % N) * 12.5 + '%'; e.style.top = ((i / N) | 0) * 12.5 + '%'; };
    function sizeFont() { bd.style.fontSize = (bd.clientWidth / N * 0.62) + 'px'; }
    function mk(i, type, row) {
      const e = document.createElement('div'); e.className = 'gm-g'; e.innerHTML = '<span>' + GEMS[type] + '</span>'; e.dataset.t = type;
      e.style.left = (i % N) * 12.5 + '%'; e.style.top = (row != null ? row : ((i / N) | 0)) * 12.5 + '%'; bd.appendChild(e); return e;
    }
    function hud() { $('#sc', root).textContent = score; $('#mv', root).textContent = moves; $('#bs', root).textContent = best; }
    function newGame() {
      gen++; b = L.gmNewBoard(N, KINDS); bd.innerHTML = ''; els = b.map((t, i) => mk(i, t)); score = 0; moves = MOVES; sel = -1; busy = false; over = false;
      sizeFont(); hud(); $('#msg', root).textContent = 'Swap two neighbouring gems';
    }
    function swapVisual(i, j) {
      const t = b[i]; b[i] = b[j]; b[j] = t; const e = els[i]; els[i] = els[j]; els[j] = e; pos(els[i], i); pos(els[j], j);
    }
    function mark(i, on) { if (els[i]) els[i].classList.toggle('sel', on); }
    async function cascade(g) {
      let combo = 1;
      for (;;) {
        const m = L.gmMatches(b, N); if (!m.length) break;
        score += m.length * 10 * combo + (m.length > 3 ? (m.length - 3) * 20 : 0); hud(); buzz(15);
        if (combo > 1) $('#msg', root).textContent = 'Combo x' + combo + '!';
        m.forEach(i => els[i].classList.add('gone')); await wait(230); if (g !== gen) return;
        const gone = m.map(i => els[i]), res = L.gmCollapse(b, N, m, () => rnd(KINDS)), ne = new Array(N * N).fill(null);
        const gs = new Set(m), mv = new Set(res.falls.map(f => f.from));
        els.forEach((e, i) => { if (!gs.has(i) && !mv.has(i)) ne[i] = e; });
        res.falls.forEach(f => { ne[f.to] = els[f.from]; });
        res.fresh.forEach(f => { ne[f.to] = mk(f.to, f.type, f.row); });
        gone.forEach(g => g.remove()); void bd.offsetWidth;
        b = res.board; els = ne; els.forEach((e, i) => pos(e, i)); await wait(320); if (g !== gen) return; combo++;
      }
      if (!L.gmFindMove(b, N)) {
        $('#msg', root).textContent = 'No moves left, reshuffling...'; await wait(500); if (g !== gen) return;
        b = L.gmNewBoard(N, KINDS); bd.innerHTML = ''; els = b.map((t, i) => mk(i, t));
      }
    }
    async function attempt(i, j) {
      if (busy || over) return; busy = true; sel = -1; const g = gen; els.forEach((e, k) => mark(k, false));
      swapVisual(i, j); await wait(230); if (g !== gen) return;
      if (!L.gmMatches(b, N).length) { swapVisual(i, j); restart(els[i], 'shake'); await wait(230); if (g === gen) busy = false; return; }
      moves--; hud(); $('#msg', root).textContent = '';
      await cascade(g); if (g !== gen) return;
      if (moves <= 0) {
        over = true; if (score > best) { best = score; hsSet('gemmatch.best', best); } hud(); buzz(100);
        $('#msg', root).innerHTML = '\u{1F3C1} Out of moves! Final score <b>' + score + '</b>' + (score >= best && score > 0 ? ' (best!)' : '');
      }
      busy = false;
    }
    function tap(i) {
      if (busy || over) return;
      if (sel < 0) { sel = i; mark(i, true); return; }
      if (sel === i) { mark(i, false); sel = -1; return; }
      const d = Math.abs((sel / N | 0) - (i / N | 0)) + Math.abs(sel % N - i % N);
      if (d === 1) { const s = sel; attempt(s, i); } else { mark(sel, false); sel = i; mark(i, true); }
    }
    let ps = null;
    bd.addEventListener('pointerdown', (e) => {
      const g = e.target.closest('.gm-g'); if (!g) return;
      ps = { i: els.indexOf(g), x: e.clientX, y: e.clientY, done: false };
    });
    bd.addEventListener('pointermove', (e) => {
      if (!ps || ps.done || ps.i < 0) return;
      const dx = e.clientX - ps.x, dy = e.clientY - ps.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 14) return;
      ps.done = true; const i = ps.i, c = i % N, r = (i / N) | 0;
      const j = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? (c < N - 1 ? i + 1 : -1) : (c > 0 ? i - 1 : -1)) : (dy > 0 ? (r < N - 1 ? i + N : -1) : (r > 0 ? i - N : -1));
      if (j >= 0 && !busy && !over) { if (sel >= 0) { mark(sel, false); sel = -1; } attempt(i, j); }
    });
    bd.addEventListener('pointerup', () => { if (ps && !ps.done && ps.i >= 0) tap(ps.i); ps = null; });
    bd.addEventListener('pointercancel', () => { ps = null; });
    $('#hint', root).onclick = () => {
      if (busy || over) return; const m = L.gmFindMove(b, N); if (!m) return;
      m.forEach(i => { els[i].classList.remove('hint'); void els[i].offsetWidth; els[i].classList.add('hint'); });
    };
    $('#new', root).onclick = () => { if (sure(!over && moves < MOVES, 'Start a new game? Your score so far will be lost.')) newGame(); };
    T.on(window, 'resize', sizeFont);
    newGame(); T.to(sizeFont, 60);
    return () => T.stop();
  });

/* =====================================================================
   11. Dots and Boxes
   ===================================================================== */
reg('dotsboxes', 'Dots and Boxes', '\u{1F4E6}', 'Take turns drawing lines between dots. Close the fourth side of a box to claim it and go again. Play the phone at two levels on a 3x3, 4x4 or 5x5 grid.',
  ['dots', 'boxes', 'pencil', 'paper', 'squares', 'strategy'], function (el) {
    const T = tracker();
    let gen = 0, size = hsGet('dotsboxes.n', 4), lv = hsGet('dotsboxes.lv', 1), s, turn, over, last = -1, wins = hsGet('dotsboxes.w', 0);
    const root = mount(el, `
      ${seg('sz', [[3, '3 x 3'], [4, '4 x 4'], [5, '5 x 5']], size)}
      ${seg('lv', [[0, 'Easy phone'], [1, 'Smart phone']], lv)}
      <div class="stats">${stat('you', 'You', 0)}${stat('cpu', 'Phone', 0)}${stat('wn', 'Games won', wins)}</div>
      <svg id="svg" viewBox="0 0 100 100" style="display:block;width:100%;max-width:380px;margin:6px auto;touch-action:manipulation" role="img" aria-label="Dots and boxes board"></svg>
      <div class="msg" id="msg"></div>
      <div class="rowb"><button class="btn alt" id="new">New game</button></div>`);
    const GAP = 60, M = 24;
    function paint() {
      const R = s.R, C = s.C, w = M * 2 + C * GAP, h = M * 2 + R * GAP, svg = $('#svg', root);
      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h); let o = '';
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        const ow = s.box[r * C + c];
        if (ow) o += '<rect x="' + (M + c * GAP + 4) + '" y="' + (M + r * GAP + 4) + '" width="' + (GAP - 8) + '" height="' + (GAP - 8) + '" rx="8" fill="var(' + (ow === 1 ? '--accent' : '--danger') + ')" opacity=".35" class="pop"/><text x="' + (M + c * GAP + GAP / 2) + '" y="' + (M + r * GAP + GAP / 2 + 8) + '" text-anchor="middle" font-size="22" font-weight="800" fill="var(--text)">' + (ow === 1 ? 'You' : 'Me').slice(0, 1) + '</text>';
      }
      const hN = (R + 1) * C;
      s.e.forEach((v, e) => {
        let x1, y1, x2, y2;
        if (e < hN) { const r = (e / C) | 0, c = e % C; x1 = M + c * GAP; y1 = M + r * GAP; x2 = x1 + GAP; y2 = y1; } else { const k = e - hN, r = (k / (C + 1)) | 0, c = k % (C + 1); x1 = M + c * GAP; y1 = M + r * GAP; x2 = x1; y2 = y1 + GAP; }
        if (v) o += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="var(' + (v === 1 ? '--accent' : '--danger') + ')" stroke-width="' + (e === last ? 8 : 6) + '" stroke-linecap="round"/>';
        else o += '<line data-e="' + e + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="var(--line)" stroke-width="3" stroke-dasharray="2 6" stroke-linecap="round"/><line data-e="' + e + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="transparent" stroke-width="34" stroke-linecap="butt" style="cursor:pointer"/>';
      });
      for (let r = 0; r <= R; r++) for (let c = 0; c <= C; c++) o += '<circle cx="' + (M + c * GAP) + '" cy="' + (M + r * GAP) + '" r="6" fill="var(--text)"/>';
      svg.innerHTML = o;
      const a = s.box.filter(v => v === 1).length, b = s.box.filter(v => v === 2).length;
      $('#you', root).textContent = a; $('#cpu', root).textContent = b;
    }
    function finish() {
      over = true; const a = s.box.filter(v => v === 1).length, b = s.box.filter(v => v === 2).length;
      if (a > b) { wins++; hsSet('dotsboxes.w', wins); $('#wn', root).textContent = wins; }
      if (a > b) celebrate(root, T);
      $('#msg', root).textContent = a > b ? '\u{1F389} You win ' + a + ' to ' + b : a < b ? 'The phone wins ' + b + ' to ' + a : 'A draw, ' + a + ' each'; buzz(80);
    }
    function aiTurn() {
      if (over) return;
      const g = gen;
      T.to(() => {
        if (g !== gen) return;
        const e = L.dbAi(s, lv); if (e < 0) return; const n = L.dbPlay(s, e, 2); last = e; paint();
        if (!L.dbMoves(s).length) return finish();
        if (n > 0) { $('#msg', root).textContent = 'Phone goes again...'; aiTurn(); } else { turn = 1; $('#msg', root).textContent = 'Your turn'; }
      }, 520);
    }
    $('#svg', root).addEventListener('click', (ev) => {
      const t = ev.target.closest('[data-e]'); if (!t || over || turn !== 1) return;
      const n = L.dbPlay(s, +t.dataset.e, 1); if (n < 0) return; last = +t.dataset.e; buzz(n ? 40 : 10); paint();
      if (!L.dbMoves(s).length) return finish();
      if (n > 0) { $('#msg', root).textContent = 'Box! Go again'; } else { turn = 2; $('#msg', root).textContent = 'Phone is thinking...'; aiTurn(); }
    });
    function newGame() { gen++; s = L.dbNew(size, size); turn = 1; over = false; last = -1; paint(); $('#msg', root).textContent = 'Tap between two dots to draw a line'; }
    const askDb = () => sure(!over && s.e.some(Boolean), 'Start a new game? The lines you have drawn will be lost.');
    onSeg(root, 'sz', (v) => { size = +v; hsSet('dotsboxes.n', size); newGame(); }, askDb);
    onSeg(root, 'lv', (v) => { lv = +v; hsSet('dotsboxes.lv', lv); });
    $('#new', root).onclick = () => { if (askDb()) newGame(); };
    newGame();
    return () => T.stop();
  });

/* =====================================================================
   12. Reversi
   ===================================================================== */
reg('reversi', 'Reversi', '\u{1F317}', 'Outflank the phone\'s discs to flip them to your colour. A look-ahead AI at three levels, legal-move hints, pass handling and a saved win record.',
  ['othello', 'discs', 'flip', 'strategy', 'board', 'ai'], function (el) {
    const T = tracker();
    let gen = 0, lv = hsGet('reversi.lv', 2), b, turn, over, last = -1, flips = [], st = hsGet('reversi', { wins: 0, played: 0, bestDiff: 0 }), thinking = false;
    const root = mount(el, `
      <style>.rv-c{aspect-ratio:1;border:0;border-radius:6px;background:#1f7a4d;display:grid;place-items:center;padding:0;position:relative}
        .rv-d{width:82%;height:82%;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,.4);border:2px solid rgba(0,0,0,.35)}
        .rv-d.b{background:radial-gradient(circle at 35% 30%,#555,#111)}.rv-d.w{background:radial-gradient(circle at 35% 30%,#fff,#d7d7d7)}
        .rv-d.fl{animation:rvflip .45s both}.rv-h{width:22%;height:22%;border-radius:50%;background:rgba(255,255,255,.55)}
        .rv-c.last{box-shadow:inset 0 0 0 3px #f59e0b}
        @keyframes rvflip{0%{transform:rotateY(180deg) scale(.7)}60%{transform:rotateY(90deg) scale(1.1)}100%{transform:rotateY(0) scale(1)}}</style>
      ${seg('lv', [[1, 'Easy'], [2, 'Normal'], [3, 'Hard']], lv)}
      <div class="stats">${stat('bk', '⚫ You', 2)}${stat('wh', '⚪ Phone', 2)}${stat('wn', 'Games won', st.wins)}</div>
      <div id="bd" style="display:grid;grid-template-columns:repeat(8,1fr);gap:2px;max-width:380px;margin:6px auto;padding:4px;border-radius:12px;background:#0f4d30"></div>
      <div class="msg" id="msg"></div>
      <div class="rowb"><button class="btn alt" id="new">New game</button></div>`);
    function paint() {
      const mv = !over && turn === 1 ? L.rvMoves(b, 1) : []; let h = '';
      for (let i = 0; i < 64; i++) {
        h += '<button class="rv-c ' + (i === last ? 'last' : '') + '" data-i="' + i + '" aria-label="' + (b[i] === 1 ? 'black disc' : b[i] === 2 ? 'white disc' : mv.indexOf(i) >= 0 ? 'legal move' : 'empty') + ' ' + (((i / 8) | 0) + 1) + ',' + (i % 8 + 1) + '">' +
          (b[i] ? '<span class="rv-d ' + (b[i] === 1 ? 'b' : 'w') + (flips.indexOf(i) >= 0 ? ' fl' : '') + '"></span>' : mv.indexOf(i) >= 0 ? '<span class="rv-h"></span>' : '') + '</button>';
      }
      $('#bd', root).innerHTML = h; flips = [];
      const c = L.rvCount(b); $('#bk', root).textContent = c.b; $('#wh', root).textContent = c.w;
    }
    function endGame() {
      over = true; const c = L.rvCount(b); st.played++;
      if (c.b > c.w) { st.wins++; st.bestDiff = Math.max(st.bestDiff, c.b - c.w); }
      hsSet('reversi', st); $('#wn', root).textContent = st.wins; paint(); buzz(80);
      if (c.b > c.w) celebrate(root, T);
      $('#msg', root).textContent = c.b > c.w ? '\u{1F389} You win ' + c.b + ' to ' + c.w : c.b < c.w ? 'The phone wins ' + c.w + ' to ' + c.b : 'A draw, ' + c.b + ' each';
    }
    function afterMove(next) {
      if (L.rvOver(b)) return endGame();
      if (!L.rvMoves(b, next).length) {
        $('#msg', root).textContent = next === 1 ? 'You have no move, the phone plays again' : 'The phone has no move, your turn'; turn = 3 - next; paint();
        if (turn === 2) aiMove(); return;
      }
      turn = next; paint();
      if (turn === 2) aiMove(); else $('#msg', root).textContent = 'Your move (black)';
    }
    function aiMove() {
      thinking = true; $('#msg', root).textContent = 'Phone is thinking...';
      const g = gen;
      T.to(() => {
        if (g !== gen) return;
        const m = L.rvAi(b, 2, lv); thinking = false; if (m < 0) return afterMove(1);
        const r = L.rvApply(b, m, 2); b = r.board; flips = r.flips; last = m; afterMove(1);
      }, 450);
    }
    $('#bd', root).addEventListener('click', (e) => {
      const c = e.target.closest('button'); if (!c || over || turn !== 1 || thinking) return; const i = +c.dataset.i;
      if (!L.rvFlips(b, i, 1).length) { restart($('#bd', root), 'shake'); $('#msg', root).textContent = 'Not a legal move: pick a dot'; return; }
      const r = L.rvApply(b, i, 1); b = r.board; flips = r.flips.concat([i]); last = i; buzz(12); afterMove(2);
    });
    function newGame() { gen++; b = L.rvStart(); turn = 1; over = false; last = -1; flips = []; thinking = false; paint(); $('#msg', root).textContent = 'You are black. Tap a dot to play.'; }
    onSeg(root, 'lv', (v) => { lv = +v; hsSet('reversi.lv', lv); });
    $('#new', root).onclick = () => { if (sure(!over && L.rvCount(b).b + L.rvCount(b).w > 5, 'Start a new game? The current one will be lost.')) newGame(); };
    newGame();
    return () => T.stop();
  });

/* =====================================================================
   13. Stroop Test
   ===================================================================== */
reg('stroop', 'Stroop Test', '\u{1F58A}\uFE0F', 'A colour-word brain test: tap the colour the word is printed in, not the word it spells. 30 seconds, with accuracy and average reaction time saved as your best.',
  ['colour', 'color', 'reaction', 'focus', 'brain', 'interference', 'words'], function (el) {
    const T = tracker(), DUR = 30;
    let trial, t0 = 0, t1 = 0, left, correct, wrong, rts, run = false, iv = 0, best = hsGet('stroop.best', { c: 0, rt: 0 });
    const root = mount(el, `
      <div class="stats">${stat('tl', 'Seconds', DUR)}${stat('ok', 'Correct', 0)}${stat('bs', 'Best', best.c)}</div>
      <div class="progress" style="height:8px;border-radius:99px;background:var(--surface2);overflow:hidden"><div id="pb" style="height:100%;width:100%;background:var(--accent);transition:width .25s linear"></div></div>
      <div class="card center" style="margin:10px 0;min-height:130px;display:grid;place-items:center"><div id="word" style="font-size:54px;font-weight:900;letter-spacing:2px">READY?</div></div>
      <div id="btns" style="display:grid;grid-template-columns:1fr 1fr;gap:10px"></div>
      <div class="msg" id="msg">Tap the INK colour. Press Start.</div>
      <div class="rowb"><button class="btn" id="go">Start</button></div>`);
    const btns = $('#btns', root);
    btns.innerHTML = L.STROOP.map((c, i) => '<button class="btn alt" data-i="' + i + '" style="min-height:64px;font-size:20px;font-weight:800">' + c[0] + '</button>').join('');
    function nextTrial() {
      trial = L.stroopTrial(); const w = $('#word', root); w.textContent = L.STROOP[trial.word][0]; w.style.color = L.STROOP[trial.ink][1]; w.style.animation = 'none'; void w.offsetWidth; w.style.animation = 'g2pop .2s both'; t0 = performance.now();
    }
    function start() {
      left = DUR; correct = 0; wrong = 0; rts = []; run = true; $('#ok', root).textContent = 0; $('#tl', root).textContent = DUR; $('#go', root).disabled = true; $('#msg', root).textContent = 'Go!';
      nextTrial(); t1 = Date.now();
      iv = T.iv(() => {
        left = Math.max(0, DUR - (Date.now() - t1) / 1000); $('#tl', root).textContent = Math.ceil(left); $('#pb', root).style.width = left / DUR * 100 + '%';
        if (left <= 0) finish();
      }, 200);
    }
    function finish() {
      run = false; T.clear(iv); $('#go', root).disabled = false; $('#go', root).textContent = 'Play again';
      const n = correct + wrong, acc = n ? Math.round(correct * 100 / n) : 0, avg = rts.length ? Math.round(rts.reduce((a, b) => a + b, 0) / rts.length) : 0;
      const nb = correct > best.c || (correct === best.c && avg && avg < best.rt);
      if (nb) { best = { c: correct, rt: avg }; hsSet('stroop.best', best); $('#bs', root).textContent = best.c; }
      $('#word', root).style.color = 'var(--text)'; $('#word', root).textContent = correct + ' / ' + n;
      $('#msg', root).innerHTML = acc + '% accurate, ' + avg + ' ms average' + (nb ? ' \u{1F3C6} new best!' : '') + '<br><span class="muted" style="font-size:13px;font-weight:500">Best: ' + best.c + ' correct at ' + best.rt + ' ms</span>'; buzz(60);
    }
    btns.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || !run) return; const i = +b.dataset.i;
      if (i === trial.ink) { correct++; rts.push(performance.now() - t0); $('#ok', root).textContent = correct; buzz(8); } else { wrong++; restart($('#word', root), 'shake'); buzz(40); }
      nextTrial();
    });
    keepTime(T, d => { if (run) { t1 += d; t0 += d; } });
    $('#go', root).onclick = start;
    return () => T.stop();
  });

/* =====================================================================
   14. Maze Runner
   ===================================================================== */
reg('mazerun', 'Maze Runner', '\u{1F6A7}', 'A new random maze every level, always solvable and getting bigger. Swipe to run along the corridors to the flag, racing the clock.',
  ['maze', 'labyrinth', 'swipe', 'path', 'levels', 'timer'], function (el) {
    const T = tracker(), CW = 360;
    let level = 1, w, h, m, pos, goal, cs, steps, t0 = 0, trail, solved = false, best = hsGet('mazerun.best', { lv: 0 }), timer = 0, shortest = 0;
    const root = mount(el, `
      <div class="stats">${stat('lv', 'Level', 1)}${stat('tm', 'Time', '0:00')}${stat('bs', 'Best level', best.lv)}</div>
      <div class="cvw" id="w" style="max-width:380px"><canvas id="cv" class="cv" width="${CW}" height="${CW}" aria-label="Maze"></canvas></div>
      <div class="msg" id="msg">Swipe to run, or use the arrows</div>
      <div style="display:grid;grid-template-columns:repeat(3,64px);grid-template-rows:repeat(2,52px);gap:8px;justify-content:center">
        <span></span><button class="btn alt" data-d="0" aria-label="Up">▲</button><span></span>
        <button class="btn alt" data-d="3" aria-label="Left">◀</button><button class="btn alt" data-d="2" aria-label="Down">▼</button><button class="btn alt" data-d="1" aria-label="Right">▶</button>
      </div>
      <div class="rowb" style="margin-top:12px"><button class="btn alt" id="rs">Restart level</button><button class="btn alt" id="nw">New maze</button></div>`);
    const cv = $('#cv', root); let ctx = fitCanvas(cv, CW, CW);
    function build() {
      w = Math.min(7 + level, 15); h = Math.min(7 + level, 15); cs = Math.floor(CW / Math.max(w, h)); ctx = fitCanvas(cv, cs * w, cs * h);
      m = L.mazeGen(w, h); pos = 0; goal = w * h - 1; steps = 0; trail = [0]; solved = false; t0 = 0; T.clear(timer); shortest = L.mazeDist(m, w, h, 0, goal);
      $('#lv', root).textContent = level; $('#tm', root).textContent = '0:00'; $('#msg', root).textContent = 'Swipe to run, or use the arrows'; draw();
    }
    function draw() {
      const ln = cssv(root, '--text'), W = cs * w, H = cs * h;
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = cssv(root, '--surface2'); ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = cssv(root, '--accent'); ctx.globalAlpha = .22; trail.forEach(i => ctx.fillRect((i % w) * cs + 2, ((i / w) | 0) * cs + 2, cs - 4, cs - 4)); ctx.globalAlpha = 1;
      ctx.strokeStyle = ln; ctx.lineWidth = Math.max(2, cs / 9); ctx.lineCap = 'round'; ctx.beginPath();
      for (let i = 0; i < w * h; i++) {
        const x = (i % w) * cs, y = ((i / w) | 0) * cs;
        if (!(m[i] & L.MZ.N)) { ctx.moveTo(x, y); ctx.lineTo(x + cs, y); }
        if (!(m[i] & L.MZ.W)) { ctx.moveTo(x, y); ctx.lineTo(x, y + cs); }
        if (i % w === w - 1) { ctx.moveTo(x + cs, y); ctx.lineTo(x + cs, y + cs); }
        if (((i / w) | 0) === h - 1) { ctx.moveTo(x, y + cs); ctx.lineTo(x + cs, y + cs); }
      }
      ctx.stroke();
      ctx.font = Math.floor(cs * 0.7) + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('\u{1F3C1}', (goal % w) * cs + cs / 2, ((goal / w) | 0) * cs + cs / 2 + 1);
      ctx.fillStyle = cssv(root, '--accent'); ctx.beginPath(); ctx.arc((pos % w) * cs + cs / 2, ((pos / w) | 0) * cs + cs / 2, cs * 0.3, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc((pos % w) * cs + cs / 2 - cs * .08, ((pos / w) | 0) * cs + cs / 2 - cs * .08, cs * 0.08, 0, 7); ctx.fill();
    }
    function go(d) {
      if (solved) return;
      const path = L.mazeSlide(m, w, h, pos, d, goal); if (!path.length) { buzz(10); return; }
      if (!t0) { t0 = Date.now(); timer = T.iv(() => { $('#tm', root).textContent = fmtT((Date.now() - t0) / 1000); }, 250); }
      pos = path[path.length - 1]; steps += path.length; trail.push(...path); buzz(6); draw();
      if (pos === goal) {
        solved = true; T.clear(timer); const sec = Math.round((Date.now() - t0) / 1000);
        if (level > best.lv) { best.lv = level; hsSet('mazerun.best', best); $('#bs', root).textContent = level; }
        $('#tm', root).textContent = fmtT(sec); $('#msg', root).innerHTML = '\u{1F389} Level ' + level + ' done in ' + fmtT(sec) + ' (' + steps + ' steps, shortest ' + shortest + ')';
        buzz(80); celebrate(root, T); const lvAt = level; T.to(() => { if (level === lvAt) { level++; build(); } }, 1600);
      }
    }
    let sx = 0, sy = 0, down = false;
    cv.addEventListener('pointerdown', (e) => { down = true; sx = e.clientX; sy = e.clientY; });
    cv.addEventListener('pointerup', (e) => {
      if (!down) return; down = false; const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return; go(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
    });
    $$('button[data-d]', root).forEach(b => { b.onpointerdown = (e) => { e.preventDefault(); go(+b.dataset.d); }; });
    T.on(window, 'keydown', (e) => { const d = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 }[e.key]; if (d != null) { e.preventDefault(); go(d); } });
    $('#rs', root).onclick = () => { pos = 0; steps = 0; trail = [0]; solved = false; t0 = 0; T.clear(timer); $('#tm', root).textContent = '0:00'; draw(); };
    $('#nw', root).onclick = () => { if (sure(!solved && steps > 0, 'Make a new maze? Your run so far will be lost.')) build(); };
    keepTime(T, d => { if (t0) t0 += d; });
    build();
    return () => T.stop();
  });

/* =====================================================================
   15. Balance Ball
   ===================================================================== */
reg('balanceball', 'Balance Ball', '\u{1F535}', 'Tilt your phone to roll the ball around an open arena, collect the stars and dodge the red mines before time runs out. No sensor? Drag your finger to pull the ball instead.',
  ['tilt', 'ball', 'roll', 'accelerometer', 'gyro', 'stars', 'arena'], function (el) {
    const T = tracker(), W = 360, H = 480, BR = 14, DUR = 45;
    let ball, star, mines, left, score, state = 'idle', best = hsGet('balanceball.best', 0), tilt = { x: 0, y: 0 }, tiltSeen = false, base = null, fing = null, flash = 0, sparks = [];
    const root = mount(el, `
      <div class="stats">${stat('sc', 'Stars', 0)}${stat('tl', 'Time', DUR)}${stat('bs', 'Best', best)}</div>
      <div class="cvw" id="w" style="max-width:380px"><canvas id="cv" class="cv" width="${W}" height="${H}" aria-label="Balance arena"></canvas></div>
      <div class="rowb" style="max-width:420px;margin:0 auto"><button class="btn alt" id="pz">⏸ Pause</button></div>
      <div class="msg muted" id="msg" style="font-size:13px;font-weight:500">Hold the phone flat and tilt, or drag on the arena.</div>`);
    const cv = $('#cv', root), ctx = fitCanvas(cv, W, H), wrap = $('#w', root);
    keepAwake(T);
    function onOrient(e) {
      if (e.gamma == null || e.beta == null) return; tiltSeen = true;
      if (!base) base = { b: e.beta, g: e.gamma };
      tilt.x = clamp((e.gamma - base.g) / 25, -1.4, 1.4); tilt.y = clamp((e.beta - base.b) / 25, -1.4, 1.4);
    }
    T.on(window, 'deviceorientation', onOrient);
    function newStar() { let x, y; do { x = 30 + Math.random() * (W - 60); y = 30 + Math.random() * (H - 60); } while (Math.hypot(x - ball.x, y - ball.y) < 90); star = { x, y }; }
    function start() {
      const go = () => {
        ball = { x: W / 2, y: H / 2, vx: 0, vy: 0 }; base = null; left = DUR; score = 0; flash = 0; sparks = [];
        mines = [0, 1, 2].map(i => ({ x: 60 + i * 120, y: 70 + (i % 2) * 300, vx: (Math.random() < .5 ? -1 : 1) * (50 + Math.random() * 40), vy: (Math.random() < .5 ? -1 : 1) * (50 + Math.random() * 40), r: 15 }));
        newStar(); state = 'run'; overlay(wrap, ''); hud(); loop.resume();
        $('#msg', root).textContent = tiltSeen ? 'Tilt steering active (dragging also works).' : 'No tilt detected: drag on the arena to pull the ball.';
      };
      try {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') DeviceOrientationEvent.requestPermission().then(go, go);
        else go();
      } catch (e) { go(); }
    }
    function hud() { $('#sc', root).textContent = score; $('#tl', root).textContent = Math.ceil(left); $('#bs', root).textContent = best; }
    function over() {
      state = 'over'; buzz(120); if (score > best) { best = score; hsSet('balanceball.best', best); } hud();
      overlay(wrap, '<b>Time!</b><div>' + score + ' stars</div><button class="btn">Play again</button>', start);
    }
    function step(dt) {
      if (state !== 'run') return;
      left -= dt; flash = Math.max(0, flash - dt);
      if (Math.ceil(left) !== +$('#tl', root).textContent) hud();
      if (left <= 0) { left = 0; return over(); }
      let ax = 0, ay = 0;
      if (fing) { ax = (fing.x - ball.x) * 5; ay = (fing.y - ball.y) * 5; } else if (tiltSeen) { ax = tilt.x * 900; ay = tilt.y * 900; }
      ball.vx += ax * dt; ball.vy += ay * dt; const fr = Math.max(0, 1 - 1.4 * dt); ball.vx *= fr; ball.vy *= fr;
      const sp = Math.hypot(ball.vx, ball.vy); if (sp > 520) { ball.vx *= 520 / sp; ball.vy *= 520 / sp; }
      ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      if (ball.x < BR) { ball.x = BR; ball.vx = Math.abs(ball.vx) * .6; } else if (ball.x > W - BR) { ball.x = W - BR; ball.vx = -Math.abs(ball.vx) * .6; }
      if (ball.y < BR) { ball.y = BR; ball.vy = Math.abs(ball.vy) * .6; } else if (ball.y > H - BR) { ball.y = H - BR; ball.vy = -Math.abs(ball.vy) * .6; }
      for (const m of mines) {
        m.x += m.vx * dt; m.y += m.vy * dt;
        if (m.x < m.r || m.x > W - m.r) m.vx = -m.vx; if (m.y < m.r || m.y > H - m.r) m.vy = -m.vy;
        const d = Math.hypot(ball.x - m.x, ball.y - m.y);
        if (d < BR + m.r - 2 && flash <= 0) { left = Math.max(0, left - 3); flash = 0.6; buzz(60); const nx = (ball.x - m.x) / (d || 1), ny = (ball.y - m.y) / (d || 1); ball.vx = nx * 380; ball.vy = ny * 380; }
      }
      if (Math.hypot(ball.x - star.x, ball.y - star.y) < BR + 14) {
        score++; left = Math.min(DUR, left + 1.5); buzz(15); for (let i = 0; i < 10; i++) sparks.push({ x: star.x, y: star.y, vx: (Math.random() - .5) * 240, vy: (Math.random() - .5) * 240, t: .5 });
        newStar(); hud();
      }
      sparks.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.t -= dt; }); sparks = sparks.filter(p => p.t > 0);
    }
    function draw() {
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = cssv(root, '--surface2'); ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = cssv(root, '--line'); ctx.lineWidth = 1; ctx.beginPath(); for (let x = 40; x < W; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, H); } for (let y = 40; y < H; y += 40) { ctx.moveTo(0, y); ctx.lineTo(W, y); } ctx.stroke();
      if (!ball) return;
      ctx.font = '28px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('⭐', star.x, star.y + 1);
      mines.forEach(m => {
        ctx.fillStyle = '#dc2626'; ctx.beginPath(); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, r = i % 2 ? m.r * .7 : m.r * 1.1; ctx.lineTo(m.x + Math.cos(a) * r, m.y + Math.sin(a) * r); } ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '700 14px sans-serif'; ctx.fillText('!', m.x, m.y + 1);
      });
      sparks.forEach(p => { ctx.globalAlpha = p.t * 2; ctx.fillStyle = '#fbbf24'; ctx.fillRect(p.x, p.y, 4, 4); }); ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(ball.x + 3, ball.y + 5, BR, BR * .8, 0, 0, 7); ctx.fill();
      const g = ctx.createRadialGradient(ball.x - 4, ball.y - 5, 2, ball.x, ball.y, BR); g.addColorStop(0, flash > 0 ? '#fecaca' : '#fff'); g.addColorStop(1, flash > 0 ? '#ef4444' : cssv(root, '--accent'));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ball.x, ball.y, BR, 0, 7); ctx.fill();
    }
    const loop = gameLoop(T, step, draw, (p) => {
      if (state === 'run') overlay(wrap, p ? '<b>Paused</b><button class="btn">Resume</button>' : '', p ? () => loop.resume() : null);
      $('#pz', root).textContent = p ? '▶ Resume' : '⏸ Pause';
    });
    cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); fing = ptr(cv, e); });
    cv.addEventListener('pointermove', (e) => { if (fing) fing = ptr(cv, e); });
    const rel = () => { fing = null; }; cv.addEventListener('pointerup', rel); cv.addEventListener('pointercancel', rel);
    $('#pz', root).onclick = () => { if (state === 'run') loop.toggle(); };
    overlay(wrap, '<b>Balance Ball</b><div>Tilt to roll. Collect stars, avoid the red mines. Stars add time.</div><button class="btn">Start</button>', start);
    ball = { x: W / 2, y: H / 2, vx: 0, vy: 0 }; mines = []; star = { x: 260, y: 140 }; left = DUR; score = 0;
    return () => T.stop();
  }, ['motion', 'storage']);

/* =====================================================================
   16. 24 Game
   ===================================================================== */
reg('game24', '24 Game', '\u{1F55B}', 'Make exactly 24 from four numbers using + - x and /, using each number once. Every deal is guaranteed solvable, with undo, hints and a saved solve count and best time.',
  ['twenty four', 'math', 'numbers', 'arithmetic', 'cards', 'puzzle'], function (el) {
    const T = tracker();
    let nums, items, hist, selA = -1, op = '', t0 = 0, solved = false, st = hsGet('game24', { solved: 0, best: 0, streak: 0 }), timer = 0;
    const root = mount(el, `
      <style>.g24-c{min-height:76px;border-radius:16px;border:2px solid var(--line);background:var(--surface);color:var(--text);font-size:30px;font-weight:800;box-shadow:var(--shadow);transition:transform .15s,background .15s}
        .g24-c.sel{background:var(--accent);color:var(--accent-t);transform:scale(1.06)}.g24-c small{font-size:14px;display:block;opacity:.7}
        .g24-o{min-height:56px;border-radius:14px;border:2px solid var(--line);background:var(--surface2);color:var(--text);font-size:26px;font-weight:800}
        .g24-o.sel{background:var(--accent);color:var(--accent-t)}</style>
      <div class="stats">${stat('tm', 'Time', '0:00')}${stat('sv', 'Solved', st.solved)}${stat('bs', 'Best', st.best ? fmtT(st.best) : '-')}</div>
      <div id="cards" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:8px 0"></div>
      <div id="ops" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px"></div>
      <div class="msg" id="msg"></div>
      <div class="rowb"><button class="btn alt" id="undo">↩ Undo</button><button class="btn alt" id="rst">Reset</button><button class="btn alt" id="hint">\u{1F4A1} Hint</button><button class="btn" id="nw">New</button></div>`);
    $('#ops', root).innerHTML = ['+', '-', '*', '/'].map(o => '<button class="g24-o" data-o="' + o + '" aria-label="' + ({ '+': 'plus', '-': 'minus', '*': 'times', '/': 'divide' })[o] + '">' + ({ '+': '+', '-': '−', '*': '×', '/': '÷' })[o] + '</button>').join('');
    function paint() {
      $('#cards', root).innerHTML = items.map((it, i) => '<button class="g24-c ' + (i === selA ? 'sel' : '') + '" data-i="' + i + '" aria-label="' + L.frStr(it) + '">' + (it[1] === 1 ? it[0] : '<span>' + it[0] + '</span><small>/ ' + it[1] + '</small>') + '</button>').join('');
      $$('.g24-o', root).forEach(b => b.classList.toggle('sel', b.dataset.o === op)); $('#undo', root).disabled = !hist.length;
    }
    function deal() {
      nums = L.gen24(); items = nums.map(n => [n, 1]); hist = []; selA = -1; op = ''; solved = false; t0 = 0; T.clear(timer); $('#tm', root).textContent = '0:00';
      $('#msg', root).textContent = 'Tap a number, an operator, then another number'; paint();
    }
    function startTimer() { if (!t0) { t0 = Date.now(); timer = T.iv(() => { $('#tm', root).textContent = fmtT((Date.now() - t0) / 1000); }, 500); } }
    function combine(a, b) {
      const r = L.frOp(items[a], op, items[b]);
      if (!r) { $('#msg', root).textContent = 'Cannot divide by zero'; restart($('#cards', root), 'shake'); selA = -1; op = ''; paint(); return; }
      startTimer(); hist.push(items.slice());
      const rest = items.filter((_, k) => k !== a && k !== b); items = rest.concat([r]); selA = -1; op = ''; $('#msg', root).textContent = ''; paint();
      if (items.length === 1) {
        if (items[0][0] === 24 && items[0][1] === 1) {
          solved = true; T.clear(timer); const sec = Math.round((Date.now() - t0) / 1000); st.solved++; st.streak++; if (!st.best || sec < st.best) st.best = sec; hsSet('game24', st);
          $('#sv', root).textContent = st.solved; $('#bs', root).textContent = fmtT(st.best); $('#msg', root).textContent = '\u{1F389} 24! Solved in ' + fmtT(sec); buzz(80); restart($('#cards', root), 'pop'); celebrate(root, T);
        } else { $('#msg', root).textContent = 'That makes ' + L.frStr(items[0]) + ', not 24. Undo and try again.'; restart($('#cards', root), 'shake'); buzz(40); }
      }
    }
    $('#cards', root).addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || solved) return; const i = +b.dataset.i;
      if (selA < 0) { selA = i; } else if (selA === i) { selA = -1; op = ''; } else if (op) { combine(selA, i); return; } else { selA = i; }
      paint();
    });
    $('#ops', root).addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b || solved || selA < 0) { if (b && selA < 0) $('#msg', root).textContent = 'Pick a number first'; return; } op = op === b.dataset.o ? '' : b.dataset.o; paint(); });
    $('#undo', root).onclick = () => { if (hist.length && !solved) { items = hist.pop(); selA = -1; op = ''; $('#msg', root).textContent = ''; paint(); } };
    $('#rst', root).onclick = () => { if (!solved) { items = nums.map(n => [n, 1]); hist = []; selA = -1; op = ''; $('#msg', root).textContent = ''; paint(); } };
    $('#hint', root).onclick = () => { $('#msg', root).textContent = 'One way: ' + L.solve24(nums) + ' = 24'; st.streak = 0; };
    $('#nw', root).onclick = deal;
    keepTime(T, d => { if (t0) t0 += d; });
    deal();
    return () => T.stop();
  });

/* =====================================================================
   17. Blackjack
   ===================================================================== */
const SUITS = ['♠', '♥', '♦', '♣'], RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
reg('blackjack', 'Blackjack', '♠️', 'Single-player blackjack against the dealer with chips that are saved: hit, stand or double down. Blackjack pays 3 to 2 and the dealer stands on all 17s.',
  ['21', 'cards', 'casino', 'chips', 'twenty one', 'dealer'], function (el) {
    const T = tracker();
    let sv = hsGet('blackjack', { chips: 1000, best: 1000 }), chips = sv.chips, bestC = sv.best, shoe = L.bjShoe(6), bet = 0, player, dealer, phase = 'bet', hidden = true, dbl = false;
    const root = mount(el, `
      <style>.bj-card{display:inline-grid;place-items:center;width:52px;height:74px;border-radius:9px;background:#fff;color:#111;font-weight:800;font-size:20px;margin:0 -8px 0 0;border:1px solid #bbb;box-shadow:0 2px 6px rgba(0,0,0,.3);animation:g2pop .3s both;position:relative}
        .bj-card.r{color:#d11}.bj-card small{position:absolute;bottom:3px;right:5px;font-size:15px}
        .bj-card.back{background:repeating-linear-gradient(45deg,#4338ca 0 6px,#6366f1 6px 12px);color:transparent}
        .bj-t{background:#136b3f;border-radius:20px;padding:12px;color:#fff;min-height:96px}.bj-t b{font-size:13px;opacity:.85;display:block;margin-bottom:6px}
        .bj-ch{width:58px;height:58px;border-radius:50%;border:4px dashed rgba(255,255,255,.7);color:#fff;font-weight:800;font-size:15px;padding:0}</style>
      <div class="stats">${stat('ch', '\u{1FA99} Chips', chips)}${stat('bt', 'Bet', 0)}${stat('bs', 'Best chips', bestC)}</div>
      <div class="bj-t"><b>Dealer <span id="dv"></span></b><div id="dh" style="min-height:76px"></div></div>
      <div class="gap" style="height:8px"></div>
      <div class="bj-t"><b>You <span id="pv"></span></b><div id="ph" style="min-height:76px"></div></div>
      <div class="msg" id="msg"></div>
      <div id="bets" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"></div>
      <div id="acts" class="rowb"></div>`);
    function save() { bestC = Math.max(bestC, chips); hsSet('blackjack', { chips, best: bestC }); $('#ch', root).textContent = chips; $('#bs', root).textContent = bestC; $('#bt', root).textContent = bet; }
    const cardHtml = (c, back) => back ? '<span class="bj-card back">?</span>' : '<span class="bj-card ' + ((c.s === 1 || c.s === 2) ? 'r' : '') + '">' + RANKS[c.r] + '<small>' + SUITS[c.s] + '</small></span>';
    function draw1() { if (shoe.length < 60) shoe = L.bjShoe(6); return { r: shoe.pop(), s: rnd(4) }; }
    function paintHands() {
      $('#dh', root).innerHTML = dealer.map((c, i) => cardHtml(c, hidden && i === 1)).join(''); $('#ph', root).innerHTML = player.map(c => cardHtml(c)).join('');
      const pv = L.bjHand(player.map(c => c.r)), dvv = L.bjHand((hidden ? dealer.slice(0, 1) : dealer).map(c => c.r));
      $('#pv', root).textContent = player.length ? '(' + (pv.soft && pv.total <= 21 ? 'soft ' : '') + pv.total + ')' : ''; $('#dv', root).textContent = dealer.length ? '(' + (hidden ? dvv.total + ' + ?' : dvv.total) + ')' : '';
    }
    function betUi() {
      phase = 'bet'; hidden = true; $('#acts', root).innerHTML = '<button class="btn" id="deal">Deal</button><button class="btn alt" id="clr">Clear bet</button>';
      const opts = [10, 25, 100, 500].filter(v => v <= chips);
      $('#bets', root).innerHTML = opts.map(v => '<button class="bj-ch" style="background:' + ({ 10: '#2563eb', 25: '#16a34a', 100: '#111827', 500: '#9333ea' })[v] + '" data-v="' + v + '" aria-label="Add ' + v + ' chips">' + v + '</button>').join('') + (chips > 0 ? '<button class="bj-ch" style="background:#dc2626;font-size:12px" data-v="all" aria-label="All in">ALL</button>' : '');
      if (chips <= 0) { $('#acts', root).innerHTML = '<button class="btn" id="rebuy">Out of chips: start again with 1000</button>'; $('#msg', root).textContent = 'You are out of chips'; } else $('#msg', root).textContent = bet ? 'Bet ' + bet + '. Deal when ready' : 'Place your bet';
      save();
    }
    function actUi() {
      $('#bets', root).innerHTML = '';
      $('#acts', root).innerHTML = '<button class="btn" id="hit">Hit</button><button class="btn alt" id="stand">Stand</button><button class="btn alt" id="dbl" ' + (player.length === 2 && chips >= bet * 2 ? '' : 'disabled') + '>Double</button>';
    }
    function dealRound() {
      if (bet <= 0 || bet > chips) { $('#msg', root).textContent = 'Place a bet first'; return; }
      player = [draw1(), draw1()]; dealer = [draw1(), draw1()]; hidden = true; dbl = false; paintHands(); phase = 'play'; buzz(10);
      const pb = L.bjHand(player.map(c => c.r)).bj, db = L.bjHand(dealer.map(c => c.r)).bj;
      if (pb || db) { finish(); return; }
      $('#msg', root).textContent = 'Hit, stand or double?'; actUi();
    }
    function finish() {
      hidden = false; phase = 'done';
      const pr = player.map(c => c.r), p = L.bjHand(pr);
      if (!p.bust && !p.bj && !L.bjHand(dealer.map(c => c.r)).bj) { const dr = dealer.map(c => c.r); L.bjDealer(dr, () => { const c = draw1(); dealer.push(c); return c.r; }); }
      paintHands();
      const net = L.bjSettle(pr, dealer.map(c => c.r), bet); chips += net; if (chips < 0) chips = 0;
      const msg = p.bj && net > 0 ? '\u{1F0CF} Blackjack! +' + net : net > 0 ? '\u{1F389} You win +' + net : net < 0 ? (p.bust ? 'Bust! ' : '') + 'You lose ' + net : 'Push: bet returned';
      $('#msg', root).textContent = msg; if (net > 0) buzz(60);
      bet = Math.min(bet / (dbl ? 2 : 1), chips); save();
      $('#acts', root).innerHTML = '<button class="btn" id="again">Next hand</button>';
    }
    root.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.v) { if (phase !== 'bet') return; bet = b.dataset.v === 'all' ? chips : Math.min(chips, bet + (+b.dataset.v)); $('#bt', root).textContent = bet; $('#msg', root).textContent = 'Bet ' + bet + '. Deal when ready'; return; }
      const id = b.id;
      if (id === 'clr') { bet = 0; betUi(); } else if (id === 'deal') dealRound();
      else if (id === 'hit') { player.push(draw1()); paintHands(); buzz(8); const h = L.bjHand(player.map(c => c.r)); if (h.bust || h.total === 21) finish(); else actUi(); }
      else if (id === 'stand') finish();
      else if (id === 'dbl') { if (player.length === 2 && chips >= bet * 2) { bet *= 2; dbl = true; player.push(draw1()); paintHands(); finish(); } }
      else if (id === 'again') { player = []; dealer = []; paintHands(); if (bet > chips) bet = chips; betUi(); }
      else if (id === 'rebuy') { chips = 1000; bet = 0; player = []; dealer = []; paintHands(); betUi(); }
    });
    player = []; dealer = []; betUi();
    return () => T.stop();
  });

/* =====================================================================
   18. Higher or Lower
   ===================================================================== */
reg('hilo', 'Higher or Lower', '↕️', 'Will the next card be higher or lower? Build the longest streak you can through a shuffled deck. Aces are high and equal cards are a push.',
  ['cards', 'streak', 'guess', 'higher', 'lower', 'deck'], function (el) {
    const T = tracker();
    let deck, cur, streak, over, best = hsGet('hilo.best', 0), busy = false;
    const root = mount(el, `
      <style>.hl-c{display:inline-grid;place-items:center;width:110px;height:154px;border-radius:14px;background:#fff;color:#111;font-weight:900;font-size:44px;border:1px solid #bbb;box-shadow:0 6px 16px rgba(0,0,0,.3);position:relative}
        .hl-c.r{color:#d11}.hl-c small{position:absolute;bottom:8px;right:12px;font-size:28px}.hl-c.back{background:repeating-linear-gradient(45deg,#4338ca 0 8px,#6366f1 8px 16px);color:transparent}
        .hl-c.fl{animation:g2flip2 .45s both}@keyframes g2flip2{from{transform:rotateY(90deg)}to{transform:rotateY(0)}}</style>
      <div class="stats">${stat('st', 'Streak', 0)}${stat('bs', 'Best', best)}${stat('lf', 'Cards left', 51)}</div>
      <div style="text-align:center;margin:12px 0;display:flex;gap:14px;justify-content:center;align-items:center"><span id="cc"></span><span id="nc"></span></div>
      <div class="msg" id="msg"></div>
      <div class="rowb"><button class="btn" id="hi" style="min-height:58px;font-size:18px">▲ Higher</button><button class="btn alt" id="lo" style="min-height:58px;font-size:18px">▼ Lower</button></div>
      <div class="rowb"><button class="btn alt" id="new">New game</button></div>`);
    const mkDeck = () => shuffle([].concat(...[0, 1, 2, 3].map(s => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(r => ({ r, s })))));
    const card = (c, cls) => c ? '<span class="hl-c ' + ((c.s === 1 || c.s === 2) ? 'r ' : '') + (cls || '') + '">' + RANKS[c.r] + '<small>' + SUITS[c.s] + '</small></span>' : '<span class="hl-c back ' + (cls || '') + '">?</span>';
    function paint(nx) {
      $('#cc', root).innerHTML = card(cur, 'fl'); $('#nc', root).innerHTML = nx ? card(nx, 'fl') : card(null);
      $('#st', root).textContent = streak; $('#bs', root).textContent = best; $('#lf', root).textContent = deck.length;
    }
    function newGame() { deck = mkDeck(); cur = deck.pop(); streak = 0; over = false; busy = false; $('#msg', root).textContent = 'Higher or lower than this card?'; paint(null); $('#hi', root).disabled = $('#lo', root).disabled = false; }
    function guess(dir) {
      if (over || busy) return; busy = true;
      if (!deck.length) deck = mkDeck();
      const nx = deck.pop(), c = L.hiloCmp(cur.r, nx.r); paint(nx);
      const old = cur;
      T.to(() => {
        if (c === 0) { $('#msg', root).textContent = 'Same value: a push, no change'; }
        else if (c === dir) { streak++; buzz(15); $('#msg', root).textContent = '✅ Correct!'; if (streak > best) { best = streak; hsSet('hilo.best', best); } }
        else { over = true; buzz(100); $('#msg', root).innerHTML = '❌ Wrong. ' + RANKS[old.r] + ' then ' + RANKS[nx.r] + '. Final streak <b>' + streak + '</b>'; $('#hi', root).disabled = $('#lo', root).disabled = true; }
        cur = nx; busy = false; $('#cc', root).innerHTML = card(cur); $('#nc', root).innerHTML = over ? card(null) : card(null); $('#st', root).textContent = streak; $('#bs', root).textContent = best; $('#lf', root).textContent = deck.length;
      }, 900);
    }
    $('#hi', root).onclick = () => guess(1); $('#lo', root).onclick = () => guess(-1); $('#new', root).onclick = newGame;
    newGame();
    return () => T.stop();
  });

/* =====================================================================
   19. Digit Span
   ===================================================================== */
reg('digitspan', 'Digit Span', '\u{1F9F6}', 'A memory span test: watch a sequence of digits flash one at a time, then type them back, forwards or backwards. The sequence grows by one each round. Two strikes and it ends.',
  ['memory', 'numbers', 'digits', 'remember', 'brain', 'sequence'], function (el) {
    const T = tracker();
    let gen = 0;
    const later = (fn, ms) => { const g = gen; T.to(() => { if (g === gen) fn(); }, ms); };
    let mode = hsGet('digitspan.mode', 'f'), len, seq, ans, phase = 'idle', strikes, passed = 0, best = hsGet('digitspan.best', { f: 0, b: 0 });
    const root = mount(el, `
      ${seg('md', [['f', 'Forwards'], ['b', 'Backwards']], mode)}
      <div class="stats">${stat('ln', 'Length', 3)}${stat('sk', 'Strikes', '0 / 2')}${stat('bs', 'Best', best[mode])}</div>
      <div class="card center" style="min-height:130px;display:grid;place-items:center"><div id="dg" style="font-size:64px;font-weight:900;letter-spacing:6px;font-variant-numeric:tabular-nums">?</div></div>
      <div class="msg" id="msg">Press Start, watch the digits, then type them back</div>
      <div class="keys" id="pad" style="max-width:320px;margin:0 auto"></div>
      <div class="rowb"><button class="btn" id="go">Start</button></div>`);
    const pd = $('#pad', root);
    pd.innerHTML = '123456789'.split('').map(k => '<button data-k="' + k + '" style="grid-column:span 1;min-height:54px">' + k + '</button>').join('') + '<button data-k="back" aria-label="Backspace" style="min-height:54px">⌫</button><button data-k="0" style="min-height:54px">0</button><button data-k="ok" class="op" style="min-height:54px">OK</button>';
    pd.style.gridTemplateColumns = 'repeat(3,1fr)';
    function hud() { $('#ln', root).textContent = len; $('#sk', root).textContent = strikes + ' / 2'; $('#bs', root).textContent = best[mode]; }
    function show() {
      phase = 'show'; seq = L.dsSeq(len); ans = []; $('#msg', root).textContent = 'Watch...'; $('#go', root).disabled = true; let i = 0;
      const next = () => {
        const d = $('#dg', root);
        if (i >= seq.length) { d.textContent = ''; phase = 'input'; $('#msg', root).textContent = (mode === 'b' ? 'Type them BACKWARDS' : 'Type them in order') + ' (' + len + ' digits)'; paintAns(); return; }
        d.textContent = seq[i]; bump(d); later(() => { d.textContent = ''; later(next, 220); }, 700); i++;
      };
      later(next, 500);
    }
    function paintAns() { $('#dg', root).textContent = ans.join(' ') || '_'; $('#dg', root).style.fontSize = ans.length > 8 ? '36px' : '64px'; }
    function submit() {
      if (phase !== 'input') return;
      if (ans.length < len) { $('#msg', root).textContent = 'Need ' + len + ' digits'; return; }
      phase = 'check';
      if (L.dsCheck(seq, ans, mode === 'b')) {
        if (len > best[mode]) { best[mode] = len; hsSet('digitspan.best', best); } $('#msg', root).textContent = '✅ Correct! Next: ' + (len + 1) + ' digits'; buzz(30); passed = len; len++; hud(); later(show, 1100);
      } else {
        strikes++; buzz(80); restart($('#dg', root), 'shake'); hud();
        const right = (mode === 'b' ? seq.slice().reverse() : seq).join(' ');
        if (strikes >= 2) { phase = 'idle'; $('#msg', root).innerHTML = 'Game over. It was <b>' + right + '</b>. You remembered ' + passed + (passed === 1 ? ' digit' : ' digits') + ' in a row'; $('#go', root).disabled = false; $('#go', root).textContent = 'Play again'; }
        else { $('#msg', root).innerHTML = 'Not quite: it was <b>' + right + '</b>. One more try at ' + len; later(show, 1800); }
      }
    }
    pd.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || phase !== 'input') return; const k = b.dataset.k;
      if (k === 'back') ans.pop(); else if (k === 'ok') return submit(); else if (ans.length < len) ans.push(+k);
      paintAns(); if (ans.length === len && k !== 'back') later(submit, 250);
    });
    T.on(window, 'keydown', (e) => { if (phase !== 'input') return; if (/^[0-9]$/.test(e.key) && ans.length < len) { ans.push(+e.key); paintAns(); if (ans.length === len) later(submit, 250); } else if (e.key === 'Backspace') { ans.pop(); paintAns(); } else if (e.key === 'Enter') submit(); });
    $('#go', root).onclick = () => { if (phase === 'idle') { len = 3; strikes = 0; passed = 0; hud(); show(); } };
    onSeg(root, 'md', (v) => { mode = v; hsSet('digitspan.mode', v); gen++; phase = 'idle'; len = 3; strikes = 0; passed = 0; $('#go', root).disabled = false; $('#dg', root).textContent = '?'; hud(); });
    len = 3; strikes = 0; hud();
    return () => T.stop();
  });

/* =====================================================================
   20. Typing Falls
   ===================================================================== */
reg('typingfalls', 'Typing Falls', '\u{1F327}️', 'Words rain down: type each one before it hits the ground to clear it. Faster and longer words as you level up, with five lives and a saved best score.',
  ['typing', 'words', 'keyboard', 'falling', 'speed', 'type'], function (el) {
    const T = tracker(), W = 360, H = 400;
    let words, typed = '', score, lives, level, cleared, state = 'idle', spawnT, best = hsGet('typingfalls.best', 0), last = 0;
    const root = mount(el, `
      <div class="stats">${stat('sc', 'Score', 0)}${stat('li', 'Lives', 5)}${stat('lv', 'Level', 1)}${stat('bs', 'Best', best)}</div>
      <div class="cvw" id="w" style="max-width:420px"><canvas id="cv" class="cv" width="${W}" height="${H}" aria-label="Falling words"></canvas></div>
      <label class="f" style="display:block;margin:8px 0 0"><span class="muted" style="font-size:13px">Type here</span>
        <input id="in" type="text" autocapitalize="none" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="14" aria-label="Type the falling words" style="width:100%;height:52px;border:2px solid var(--line);border-radius:14px;background:var(--surface);color:var(--text);font:inherit;font-size:22px;text-align:center;box-sizing:border-box"></label>
      <div class="rowb"><button class="btn alt" id="pz">⏸ Pause</button></div>`);
    const cv = $('#cv', root), ctx = fitCanvas(cv, W, H), wrap = $('#w', root), inp = $('#in', root);
    function hud() { $('#sc', root).textContent = score; $('#li', root).textContent = lives; $('#lv', root).textContent = level; $('#bs', root).textContent = best; }
    function spawn() {
      const maxLen = 3 + level + (level > 3 ? 2 : 0), pool = L.TF_WORDS.filter(w => w.length <= maxLen && w.length >= Math.min(3, maxLen) && !words.some(o => o.w === w));
      const w = pool[rnd(pool.length)] || 'cat'; ctx.font = '700 18px sans-serif';
      const tw = ctx.measureText(w).width + 20; words.push({ w, x: 6 + Math.random() * Math.max(1, W - tw - 12), y: -10, tw, vy: 24 + level * 7 + Math.random() * 10 });
    }
    function start() {
      words = []; typed = ''; inp.value = ''; score = 0; lives = 5; level = 1; cleared = 0; spawnT = 0.3; state = 'run'; overlay(wrap, ''); hud(); loop.resume(); inp.focus();
    }
    function over() {
      state = 'over'; buzz(150); if (score > best) { best = score; hsSet('typingfalls.best', best); } hud(); inp.blur();
      overlay(wrap, '<b>Game over</b><div>Score ' + score + ' · ' + cleared + ' words</div><button class="btn">Play again</button>', start);
    }
    function step(dt) {
      if (state !== 'run') return;
      spawnT -= dt; if (spawnT <= 0 && words.length < 3 + level) { spawn(); spawnT = Math.max(0.9, 2.6 - level * 0.18) + Math.random() * 0.8; }
      for (let i = words.length - 1; i >= 0; i--) {
        words[i].y += words[i].vy * dt;
        if (words[i].y > H - 8) { words.splice(i, 1); lives--; buzz(60); restart(cv, 'shake'); hud(); if (lives <= 0) return over(); }
      }
    }
    function draw() {
      ctx.clearRect(0, 0, W, H); const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, cssv(root, '--surface2')); g.addColorStop(1, cssv(root, '--surface')); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(220,38,38,.25)'; ctx.fillRect(0, H - 6, W, 6);
      if (!words) return;
      const m = L.tfMatch(words, typed); ctx.font = '700 18px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      words.forEach((o, i) => {
        const act = i === m.prefix;
        ctx.fillStyle = act ? cssv(root, '--accent') : cssv(root, '--surface'); ctx.strokeStyle = act ? cssv(root, '--accent') : cssv(root, '--line'); ctx.lineWidth = 2;
        ctx.beginPath(); rrect(ctx, o.x, o.y - 14, o.tw, 28, 14); ctx.fill(); ctx.stroke();
        const done = act ? typed : ''; const rest = o.w.slice(done.length);
        ctx.fillStyle = act ? '#fde68a' : cssv(root, '--text'); ctx.fillText(done, o.x + 10, o.y + 1);
        ctx.fillStyle = act ? cssv(root, '--accent-t') : cssv(root, '--text'); ctx.fillText(rest, o.x + 10 + ctx.measureText(done).width, o.y + 1);
      });
    }
    const loop = gameLoop(T, step, draw, (p) => {
      if (state === 'run') overlay(wrap, p ? '<b>Paused</b><button class="btn">Resume</button>' : '', p ? () => { loop.resume(); inp.focus(); } : null);
      $('#pz', root).textContent = p ? '▶ Resume' : '⏸ Pause';
    });
    inp.addEventListener('input', () => {
      if (state !== 'run' || loop.paused) { inp.value = ''; return; }
      typed = inp.value.toLowerCase().replace(/[^a-z]/g, ''); if (typed !== inp.value) inp.value = typed;
      const m = L.tfMatch(words, typed);
      if (m.exact >= 0) {
        const o = words.splice(m.exact, 1)[0]; score += o.w.length * level; cleared++; typed = ''; inp.value = ''; buzz(10);
        if (cleared % 10 === 0) { level++; }
        hud();
      } else if (typed && m.prefix < 0) { typed = ''; inp.value = ''; restart(inp, 'shake'); buzz(25); }
    });
    $('#pz', root).onclick = () => { if (state === 'run') loop.toggle(); };
    words = []; score = 0; lives = 5; level = 1; cleared = 0;
    overlay(wrap, '<b>Typing Falls</b><div>Type the falling words to clear them</div><button class="btn">Start</button>', start);
    return () => T.stop();
  });

if (typeof module !== 'undefined' && module.exports) module.exports = L;
})();
