'use strict';
/* PocketKit games, part 6: puzzles (Word Search, Mini Crossword, KenKen, Kakuro, Futoshiki, Killer Sudoku, Tangram) and dice games
   (Dice Five, Farkle, Liar's Dice). Everything lives inside one IIFE. The pure logic sits between LOGIC-START / LOGIC-END markers so
   tests/games6.test.js can load it in plain Node (those blocks only use the object L and the random helpers from the first block). */
(() => {

/* LOGIC-START */
const L = {};
function rnd(n) { return n <= 1 ? 0 : Math.floor(Math.random() * n); }
const pick = (a) => a[rnd(a.length)];
function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
/* LOGIC-END */

/* ---------- shared UI helpers ---------- */
const CSS = `
.g6 .seg{display:flex;flex-wrap:wrap;gap:6px;background:var(--surface2);padding:4px;border-radius:14px;margin:8px 0}
.g6 .seg button{flex:1;min-height:44px;min-width:44px;border:0;border-radius:11px;background:transparent;color:var(--muted);font-weight:600;font-size:14px}
.g6 .seg button.on{background:var(--accent);color:var(--accent-t);box-shadow:var(--shadow)}
.g6 .stats{display:flex;justify-content:space-around;text-align:center;margin:8px 0;gap:6px}
.g6 .stats b{display:block;font-size:20px;font-variant-numeric:tabular-nums}
.g6 .stats span{font-size:12px;color:var(--muted)}
.g6 .msg{min-height:28px;text-align:center;font-weight:700;font-size:16px;margin:6px 0}
.g6 .gap{height:10px}
.g6 .pad{display:grid;gap:6px;margin:8px 0}
.g6 .pad button{min-height:44px;padding:0;border:1px solid var(--line);border-radius:10px;background:var(--surface2);color:var(--text);font-size:19px;font-weight:700}
.g6 .pad button.on{background:var(--accent);color:var(--accent-t)}
.g6 .pad button:disabled{opacity:.35}
.g6 .acts{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
.g6 .acts .btn{flex:1;min-width:84px;min-height:44px;padding:8px 6px;font-size:14px}
.g6 .bd{display:grid;margin:0 auto;user-select:none;-webkit-user-select:none}
.g6 .bd button,.g6 .bd div{box-sizing:border-box}
.g6 .bd button{padding:0;margin:0;border:0;border-radius:0;font-family:inherit;color:var(--text)}
.g6 .tbl{width:100%;border-collapse:collapse;font-size:14px}
.g6 .tbl td,.g6 .tbl th{padding:6px 4px;text-align:center;border-bottom:1px solid var(--line)}
.g6 button.die{width:48px;height:48px;min-width:48px;min-height:48px;border-radius:10px;border:2px solid var(--line);background:var(--surface);display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);padding:6px;gap:1px;flex:none}
.g6 .die i{margin:auto;width:8px;height:8px;border-radius:50%;background:var(--text)}
.g6 button.die.hold{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 22%,var(--surface))}
.g6 .dice{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin:8px 0}
`;
function mount(el, html) {
  el.innerHTML = '<style>' + CSS + '</style><div class="g6">' + html + '</div>';
  return $('.g6', el);
}
function tracker() {
  const ls = [], ts = [];
  return {
    to(fn, ms) { const id = setTimeout(fn, ms); ts.push(['t', id]); return id; },
    iv(fn, ms) { const id = setInterval(fn, ms); ts.push(['i', id]); return id; },
    on(target, ev, fn, opt) { target.addEventListener(ev, fn, opt); ls.push([target, ev, fn, opt]); },
    stop() {
      ts.forEach(([k, id]) => (k === 't' ? clearTimeout(id) : clearInterval(id))); ts.length = 0;
      ls.forEach(([t, ev, fn, opt]) => t.removeEventListener(ev, fn, opt)); ls.length = 0;
    }
  };
}
const seg = (id, items, cur) => '<div class="seg" id="' + id + '">' + items.map(([v, l]) =>
  '<button data-v="' + v + '" aria-pressed="' + (String(v) === String(cur)) + '" class="' + (String(v) === String(cur) ? 'on' : '') + '">' + l + '</button>').join('') + '</div>';
function onSeg(root, id, cb) {
  const s = $('#' + id, root);
  s.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    $$('button', s).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
    cb(b.dataset.v);
  });
}
const stat = (id, label, v) => '<div><b id="' + id + '">' + v + '</b><span>' + label + '</span></div>';
const fmtT = (s) => Math.floor(s / 60) + ':' + pad(Math.floor(s % 60), 2);
function reg(id, name, icon, desc, keys, render) {
  Tools.register({ id, name, icon, cat: 'fun', desc, keys, needs: ['storage'], pro: false, render });
}
/* One Store object per game: fun3.<id> */
const gget = (id) => { const v = Store.get('fun3.' + id, null); return v && typeof v === 'object' ? v : {}; };
const gput = (id, patch) => { try { Store.set('fun3.' + id, Object.assign(gget(id), patch)); } catch (e) { /* storage full or blocked */ } };
const getBest = (id, key) => { const b = gget(id).best; return b && typeof b[key] === 'number' ? b[key] : 0; };
function recBest(id, key, v, lowerIsBetter) {
  const b = Object.assign({}, gget(id).best), old = b[key];
  const better = typeof old !== 'number' || (lowerIsBetter ? v < old : v > old);
  if (better) { b[key] = v; gput(id, { best: b }); }
  return better;
}
/* Elapsed-time clock that can resume from saved seconds. */
function makeClock(T, node) {
  let t0 = 0, base = 0, run = false;
  const secs = () => base + (run ? Math.floor((Date.now() - t0) / 1000) : 0);
  T.iv(() => { if (run && node) node.textContent = fmtT(secs()); }, 500);
  return {
    secs,
    start(b) { base = b || 0; t0 = Date.now(); run = true; if (node) node.textContent = fmtT(base); },
    stop() { if (run) { base = secs(); run = false; } if (node) node.textContent = fmtT(base); return base; },
    running: () => run
  };
}
const buzz = (n) => { try { navigator.vibrate && navigator.vibrate(n); } catch (e) { /* no vibration */ } };
const bgOK = 'color-mix(in srgb,var(--ok) 28%,var(--surface))';
const bgBad = 'color-mix(in srgb,var(--danger) 30%,var(--surface))';
const bgSel = 'color-mix(in srgb,var(--accent) 35%,var(--surface))';
const bgPeer = 'var(--surface2)';

/* =====================================================================
   1. Word Search
   ===================================================================== */
/* LOGIC-START */
L.WS_THEMES = {
  Animals: 'TIGER LION ZEBRA HORSE SHEEP GOAT RABBIT MONKEY ELEPHANT GIRAFFE DOLPHIN WHALE SHARK TURTLE FROG SNAKE EAGLE PARROT DUCK GOOSE CHICKEN OTTER BEAVER BADGER FOX WOLF BEAR PANDA KOALA CAMEL DONKEY MOUSE SQUIRREL HAMSTER LIZARD SPIDER BEETLE BEE ANT BUTTERFLY SALMON TROUT CRAB LOBSTER OCTOPUS SEAL OWL SWAN HERON FALCON',
  Food: 'APPLE BANANA ORANGE GRAPE LEMON MANGO PEACH PEAR PLUM CHERRY MELON BERRY BREAD BUTTER CHEESE EGG RICE PASTA PIZZA SALAD SOUP SANDWICH BURGER NOODLE CARROT POTATO ONION GARLIC TOMATO PEPPER CORN BEAN PEA SPINACH CABBAGE MUSHROOM HONEY SUGAR SALT FLOUR COOKIE CAKE PIE CANDY CHOCOLATE YOGURT CEREAL SYRUP',
  Nature: 'RIVER LAKE OCEAN BEACH FOREST MOUNTAIN VALLEY DESERT ISLAND CLOUD RAIN SNOW STORM WIND THUNDER RAINBOW SUNSET SUNRISE MOON STAR PLANET COMET FLOWER TREE LEAF GRASS ROSE TULIP DAISY CACTUS MOSS FERN ROCK STONE SAND SOIL WATERFALL VOLCANO CANYON CAVE GLACIER MEADOW SWAMP BREEZE FROST FOG DEW POND STREAM HILL',
  Home: 'KITCHEN BEDROOM GARDEN GARAGE WINDOW DOOR ROOF FLOOR WALL STAIRS TABLE CHAIR SOFA BED LAMP CLOCK MIRROR CARPET CURTAIN PILLOW BLANKET TOWEL SPOON FORK KNIFE PLATE BOWL CUP MUG KETTLE OVEN FRIDGE SINK SHOWER BATH SHELF DRAWER CLOSET BROOM BUCKET FENCE PORCH BALCONY ATTIC BASEMENT CHIMNEY HALLWAY LAUNDRY',
  Sports: 'SOCCER TENNIS HOCKEY CRICKET GOLF RUGBY BOXING SWIMMING RUNNING CYCLING ROWING SAILING SKIING SKATING SURFING DIVING ARCHERY FENCING JUDO KARATE YOGA BOWLING BASEBALL BASKETBALL VOLLEYBALL BADMINTON SQUASH CLIMBING HIKING JOGGING SPRINT MARATHON RELAY HURDLE JAVELIN DISCUS TROPHY MEDAL TEAM COACH REFEREE STADIUM GOAL SCORE PLAYER WINNER',
  Body: 'HEAD FACE EYE EAR NOSE MOUTH TEETH TONGUE NECK SHOULDER ELBOW WRIST HAND FINGER THUMB CHEST BACK STOMACH HIP KNEE ANKLE FOOT TOE SKIN HAIR BRAIN HEART LUNG LIVER KIDNEY MUSCLE BONE SKULL SPINE RIB JAW CHIN CHEEK EYEBROW EYELASH FOREHEAD NAIL PALM HEEL THROAT BLOOD VEIN NERVE',
  Travel: 'AIRPORT TICKET PASSPORT LUGGAGE SUITCASE HOTEL TOURIST JOURNEY VOYAGE TRAIN STATION PLATFORM BUS TAXI SUBWAY FERRY CRUISE FLIGHT PILOT RUNWAY MAP COMPASS TRAVEL ADVENTURE CAMPING TENT BACKPACK HOSTEL RESORT SOUVENIR CAMERA HIGHWAY BRIDGE TUNNEL ROAD TRAFFIC PETROL ENGINE WHEEL DRIVER PASSENGER CAPTAIN HARBOR CABIN ARRIVAL',
  School: 'TEACHER STUDENT CLASS LESSON HOMEWORK PENCIL ERASER RULER NOTEBOOK SATCHEL LIBRARY BOOK PAPER SCIENCE MATHS HISTORY ENGLISH ART MUSIC GYM LUNCH RECESS EXAM TEST QUIZ GRADE DIPLOMA DEGREE DESK BOARD CHALK MARKER SCHOOL COLLEGE CAMPUS PRINCIPAL ESSAY READING WRITING SPELLING LEARN STUDY LOCKER CLASSMATE PROJECT UNIFORM',
  Everyday: 'FAMILY MOTHER FATHER SISTER BROTHER COUSIN UNCLE AUNT FRIEND NEIGHBOR DOCTOR NURSE FARMER BAKER TAILOR ARTIST SINGER DANCER WRITER POLICE FIREMAN PHONE COMPUTER SCREEN KEYBOARD MOUSEPAD LADDER RADIO TELEVISION SHOP MARKET BANK OFFICE CINEMA THEATER MUSEUM PARK PLAYGROUND HAPPY SMILE LAUGH DREAM WISH PEACE KINDNESS COURAGE'
};
L.wsAllWords = () => { const s = new Set(); Object.values(L.WS_THEMES).forEach((t) => t.split(' ').forEach((w) => s.add(w))); return [...s]; };
L.WS_DIRS = [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]];
L.wsCfg = { 8: { n: 6, max: 8 }, 10: { n: 9, max: 10 }, 12: { n: 13, max: 10 } };
/* Make a puzzle: { size, grid: [rowString...], words: [{ w, r, c, dr, dc }] }. theme '' = mixed. */
L.wsGen = function (size, theme) {
  const cfg = L.wsCfg[size] || L.wsCfg[10];
  const pool = (theme && L.WS_THEMES[theme] ? L.WS_THEMES[theme].split(' ') : L.wsAllWords()).filter((w) => w.length <= Math.min(cfg.max, size) && w.length >= 3);
  for (let attempt = 0; attempt < 30; attempt++) {
    const g = Array.from({ length: size }, () => Array(size).fill(''));
    const placed = [];
    for (const w of shuffle(pool)) {
      if (placed.length >= cfg.n) break;
      if (placed.some((p) => p.w.includes(w) || w.includes(p.w))) continue;
      for (let t = 0; t < 60; t++) {
        const [dr, dc] = pick(L.WS_DIRS), r = rnd(size), c = rnd(size);
        const er = r + dr * (w.length - 1), ec = c + dc * (w.length - 1);
        if (er < 0 || er >= size || ec < 0 || ec >= size) continue;
        let ok = true;
        for (let i = 0; i < w.length; i++) { const x = g[r + dr * i][c + dc * i]; if (x && x !== w[i]) { ok = false; break; } }
        if (!ok) continue;
        for (let i = 0; i < w.length; i++) g[r + dr * i][c + dc * i] = w[i];
        placed.push({ w, r, c, dr, dc });
        break;
      }
    }
    if (placed.length < cfg.n && attempt < 29) continue;
    const A = 'ABCDEFGHIJKLMNOPRSTUVWY';
    const grid = g.map((row) => row.map((x) => x || A[rnd(A.length)]).join(''));
    return { size, grid, words: placed };
  }
  return null;
};
/* All cells of the straight line from (r0,c0) to (r1,c1), snapped to the nearest of the 8 directions. null if out of the grid. */
L.wsLine = function (size, r0, c0, r1, c1) {
  const dr = r1 - r0, dc = c1 - c0;
  if (!dr && !dc) return [[r0, c0]];
  const step = Math.round(Math.atan2(dr, dc) / (Math.PI / 4));
  const D = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]][((step % 8) + 8) % 8];
  const len = D[0] && D[1] ? Math.round((Math.abs(dr) + Math.abs(dc)) / 2) : Math.max(Math.abs(dr), Math.abs(dc));
  const cells = [];
  for (let i = 0; i <= len; i++) {
    const r = r0 + D[0] * i, c = c0 + D[1] * i;
    if (r < 0 || r >= size || c < 0 || c >= size) break;
    cells.push([r, c]);
  }
  return cells;
};
/* Find a word anywhere in the grid in the 8 directions: returns { r, c, dr, dc } or null. */
L.wsFind = function (grid, w) {
  const n = grid.length;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) for (const [dr, dc] of L.WS_DIRS) {
    let i = 0;
    for (; i < w.length; i++) { const rr = r + dr * i, cc = c + dc * i; if (rr < 0 || rr >= n || cc < 0 || cc >= n || grid[rr][cc] !== w[i]) break; }
    if (i === w.length) return { r, c, dr, dc };
  }
  return null;
};
/* LOGIC-END */

reg('wordsearch', 'Word Search', '🪬', 'Find the hidden words in a fresh letter grid (8x8, 10x10 or 12x12). Drag across letters in any of 8 directions; found words are struck off.',
  ['word', 'search', 'puzzle', 'letters', 'find'], function (el) {
    const T = tracker(), ID = 'wordsearch';
    const sv = gget(ID);
    let size = [8, 10, 12].includes(sv.size) ? sv.size : 10, theme = typeof sv.theme === 'string' && (sv.theme === '' || L.WS_THEMES[sv.theme]) ? sv.theme : '';
    let pz = null, found = new Set(), done = false, gave = false, hints = 0, start = null, cur = null, hintCell = null, flash = null;
    const root = mount(el, `
      ${seg('sz', [[8, '8×8'], [10, '10×10'], [12, '12×12']], size)}
      <label class="f" style="display:block;font-size:13px;color:var(--muted)">Theme
        <select id="th" style="width:100%;min-height:44px;margin-top:4px">${'<option value="">Mixed</option>' + Object.keys(L.WS_THEMES).map((k) => '<option' + (k === theme ? ' selected' : '') + '>' + k + '</option>').join('')}</select></label>
      <div class="stats">${stat('tm', 'Time', '0:00')}${stat('fd', 'Found', '0/0')}${stat('bs', 'Best', '–')}</div>
      <div id="bd" class="bd" style="touch-action:none;border:2px solid var(--line);border-radius:10px;overflow:hidden;background:var(--surface)" role="grid" aria-label="Letter grid"></div>
      <div class="msg" id="msg"></div>
      <div id="wl" style="display:flex;flex-wrap:wrap;gap:4px 12px;justify-content:center;font-weight:600;font-size:14px"></div>
      <div class="acts"><button class="btn alt" id="hint">💡 Hint</button><button class="btn alt" id="giveup">🏳 Show solution</button><button class="btn" id="new">New puzzle</button></div>`);
    const clock = makeClock(T, $('#tm', root)), bd = $('#bd', root);
    const colors = (i) => 'hsl(' + ((i * 47) % 360) + ',65%,62%)';
    const bestStr = () => { const b = getBest(ID, 's' + size); return b ? fmtT(b) : '–'; };
    function cellPx() { return Math.min(32, Math.floor(330 / size)); }
    function save() { gput(ID, { size, theme, cur: pz ? { pz, found: [...found], secs: clock.secs(), done, gave, hints } : null }); }
    function paint() {
      const px = cellPx(), n = pz.size;
      bd.style.gridTemplateColumns = 'repeat(' + n + ',' + px + 'px)'; bd.style.width = px * n + 'px';
      const owner = {};
      pz.words.forEach((p, i) => {
        if (!found.has(p.w)) return;
        for (let k = 0; k < p.w.length; k++) owner[(p.r + p.dr * k) + ',' + (p.c + p.dc * k)] = i;
      });
      const sel = new Set((cur || []).map((x) => x[0] + ',' + x[1]));
      let h = '';
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        const k = r + ',' + c, o = owner[k], isSel = sel.has(k), isHint = hintCell === k, isFlash = flash && flash.has(k);
        const bg = isSel ? 'var(--accent)' : isFlash ? bgBad : isHint ? 'var(--ok)' : o !== undefined ? colors(o) : 'transparent';
        const col = isSel ? 'var(--accent-t)' : o !== undefined ? '#111' : 'var(--text)';
        h += '<div data-r="' + r + '" data-c="' + c + '" role="gridcell" style="width:' + px + 'px;height:' + px + 'px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:' + Math.round(px * 0.55) + 'px;background:' + bg + ';color:' + col + ';border-radius:' + (o !== undefined ? '30%' : '0') + '">' + pz.grid[r][c] + '</div>';
      }
      bd.innerHTML = h;
      $('#wl', root).innerHTML = pz.words.map((p, i) => '<span style="' + (found.has(p.w) ? 'text-decoration:line-through;opacity:.55;' : '') + 'border-bottom:3px solid ' + colors(i) + '">' + p.w + '</span>').join('');
      $('#fd', root).textContent = found.size + '/' + pz.words.length;
    }
    function finish(win) {
      done = true; const s = clock.stop();
      if (win && !gave) {
        const nb = recBest(ID, 's' + size, s, true);
        $('#msg', root).textContent = '🎉 All found in ' + fmtT(s) + (nb ? ' (new best!)' : ''); buzz(80);
      }
      $('#bs', root).textContent = bestStr(); save();
    }
    function load(p, f, secs, wasDone, wasGave, hn) {
      pz = p; size = p.size; found = new Set(f); done = !!wasDone; gave = !!wasGave; hints = hn || 0; cur = null; hintCell = null;
      $('#msg', root).textContent = done ? (gave ? 'Solution shown' : '🎉 Solved') : 'Drag across letters to select a word';
      $$('#sz button', root).forEach((b) => { const on = +b.dataset.v === size; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
      $('#bs', root).textContent = bestStr(); paint();
      if (done) clock.stop(); else clock.start(secs);
      if (!done) save();
    }
    function fresh() {
      const p = L.wsGen(size, theme); if (!p) return;
      load(p, [], 0, false, false, 0);
    }
    function cellAt(e) {
      const rect = bd.getBoundingClientRect(), px = cellPx();
      const c = Math.floor((e.clientX - rect.left) / px), r = Math.floor((e.clientY - rect.top) / px);
      return r >= 0 && c >= 0 && r < pz.size && c < pz.size ? [r, c] : null;
    }
    function judge(cells) {
      const s = cells.map(([r, c]) => pz.grid[r][c]).join(''), rv = s.split('').reverse().join('');
      const hit = pz.words.find((p) => !found.has(p.w) && (p.w === s || p.w === rv));
      cur = null;
      if (hit && cells.length > 1) {
        found.add(hit.w); hintCell = null; paint(); buzz(25);
        $('#msg', root).textContent = hit.w + ' found';
        if (found.size === pz.words.length) finish(true); else save();
      } else {
        flash = new Set(cells.map((x) => x[0] + ',' + x[1])); paint();
        T.to(() => { flash = null; if (pz) paint(); }, 220);
      }
    }
    bd.addEventListener('pointerdown', (e) => {
      if (!pz || done) return;
      const c0 = cellAt(e); if (!c0) return;
      e.preventDefault();
      const pending = start && cur && cur.length === 1 ? start : null;
      let moved = false;
      const move = (ev) => {
        const d = cellAt(ev); if (!d) return;
        if (d[0] !== c0[0] || d[1] !== c0[1]) moved = true;
        if (moved) { start = c0; cur = L.wsLine(pz.size, c0[0], c0[1], d[0], d[1]); paint(); }
      };
      const off = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
      const up = () => {
        off();
        if (moved && cur && cur.length > 1) { const cells = cur; start = null; judge(cells); }
        else if (pending) { start = null; judge(L.wsLine(pz.size, pending[0], pending[1], c0[0], c0[1])); }
        else { start = c0; cur = [c0]; paint(); }
      };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
      T.on(window, 'blur', off);
    });
    onSeg(root, 'sz', (v) => { size = +v; gput(ID, { size }); fresh(); });
    $('#th', root).addEventListener('change', (e) => { const v = e.target.value; theme = v === '' || L.WS_THEMES[v] ? v : ''; gput(ID, { theme }); fresh(); });
    $('#new', root).onclick = fresh;
    $('#hint', root).onclick = () => {
      if (!pz || done) return;
      const left = pz.words.filter((p) => !found.has(p.w)); if (!left.length) return;
      const p = pick(left); hintCell = p.r + ',' + p.c; hints++; paint();
      $('#msg', root).textContent = 'Hint: ' + p.w + ' starts at the green square';
    };
    $('#giveup', root).onclick = () => {
      if (!pz || done) return;
      pz.words.forEach((p) => found.add(p.w)); gave = true; hintCell = null; cur = null; paint();
      $('#msg', root).textContent = 'Solution shown'; finish(false);
    };
    const s0 = sv.cur;
    if (s0 && s0.pz && s0.pz.size === size && Array.isArray(s0.pz.grid) && Array.isArray(s0.pz.words) && s0.pz.words.length) load(s0.pz, s0.found || [], s0.secs || 0, s0.done, s0.gave, s0.hints);
    else fresh();
    return () => { if (pz && !done) save(); T.stop(); };
  });

/* =====================================================================
   2. Mini Crossword
   ===================================================================== */
/* LOGIC-START */
L.MW_RAW = `CAT:Pet that purrs;DOG:Pet that barks;SUN:Star our planet orbits;HAT:Worn on the head;BED:Where you sleep;PEN:Writes with ink;CUP:Holds tea or coffee;BUS:Large road vehicle for many passengers;CAR:Four-wheeled road vehicle;EGG:Laid by a hen;ICE:Frozen water;KEY:Opens a lock;MAP:Shows where places are;NET:Used to catch fish or divide a tennis court;OWL:Night bird that hoots;PIG:Farm animal that oinks;RED:Colour of a ripe tomato;SKY:Blue above us on a clear day;TEN:One more than nine;TOY:Plaything for a child;ZOO:Place to see animals in cages;ANT:Tiny insect that lives in colonies;BEE:Insect that makes honey;COW:Farm animal that gives milk;FOX:Wild animal with a bushy tail;HEN:Female chicken;JAM:Fruit spread for toast;LEG:Limb you walk on;MUD:Wet soft earth;NUT:Hard-shelled seed;OAK:Tree that grows acorns;PEA:Small green vegetable in a pod;RUG:Small floor covering;SEA:Large body of salt water;TEA:Hot drink made from leaves;VAN:Vehicle for carrying goods;WAX:Material that candles are made from;YES:Opposite of no;ARM:Limb with an elbow;EAR:You hear with it;EYE:You see with it;LIP:Edge of the mouth;TOE:Part of the foot;BAT:Flying mammal;FAN:Spins to cool a room;GUM:Chewy sweet;INK:Pens are filled with it;LID:Cover for a pot;OIL:Slippery liquid used for cooking;PIE:Baked dish with a pastry crust;SAW:Tool for cutting wood;TAP:Faucet;WEB:Spider's trap;BOX:Container with a lid;BAG:Used to carry shopping;BUG:Small insect;FLY:Insect with wings, or to travel by plane;SIX:Half of twelve;TWO:Number after one;ONE:Number before two;DAY:Time between sunrise and sunset;ART:Painting or sculpture;AIR:What we breathe;BAY:Curved part of a coastline;CAP:Soft hat with a peak;COT:Baby's small bed;DAD:Informal word for father;MOM:Informal word for mother;SON:Male child;LOG:Piece of a felled tree;PAN:Used for frying;POT:Used for boiling;RAT:Rodent with a long tail;SUM:Result of adding;TIN:Metal used to coat cans;TUB:Large container for bathing;WIG:Artificial hair;
BOOK:Pages bound together to read;TREE:Tall plant with a trunk;FISH:Swimming animal with gills;BIRD:Animal with feathers and wings;MILK:White drink from cows;CAKE:Sweet baked treat for birthdays;DOOR:You open it to enter a room;FIRE:Burns and gives off heat;GOLD:Yellow precious metal;HAND:Has five fingers;LAMP:Gives light in a room;MOON:Earth's natural satellite;NOSE:You smell with it;RAIN:Water falling from clouds;SNOW:Frozen white flakes that fall in winter;STAR:Twinkling point of light at night;WIND:Moving air;SHIP:Large vessel that sails the sea;SOAP:Used with water to wash;SALT:Seasoning in a shaker;ROSE:Flower with thorns;RING:Jewellery worn on a finger;ROAD:Cars drive along it;PARK:Public green space;NAIL:Hit with a hammer;MASK:Covers the face;LION:Big cat with a mane;LEAF:Green part of a tree branch;KING:Male ruler of a kingdom;JUMP:Spring off the ground;HILL:Small mountain;GAME:Something played for fun;FARM:Land where crops and animals are raised;DUCK:Quacking water bird;DESK:Table for writing or working;CORN:Yellow cereal grain on a cob;BELL:Rings with a clang;BEAR:Large furry animal that hibernates;BALL:Round toy for kicking or throwing;ARMY:Large organised group of soldiers;AREA:Amount of space a surface covers;BOAT:Small vessel on water;CLAY:Moulded to make pots;COAT:Warm outer garment;COIN:Small round piece of metal money;DAWN:Time when the sun rises;DICE:Cubes rolled in board games;DISH:Plate or bowl for food;DRUM:Percussion instrument you beat;DUST:Fine dry powder on furniture;EAST:Direction of the sunrise;FROG:Green amphibian that croaks;FORK:Eating utensil with prongs;GIFT:Present;GOAT:Horned farm animal;GRASS:Green lawn plant;HAIR:Grows on the head;HOME:Place where you live;HONEY:Sweet food made by bees;IRON:Metal used to make steel;KITE:Flies on a string in the wind;KNEE:Joint in the middle of the leg;LAKE:Large inland body of water;LAMB:Young sheep;MEAT:Flesh of animals eaten as food;MINT:Herb that freshens the breath;NEST:Where a bird lays eggs;NOON:Twelve o'clock in the day;PEAR:Fruit shaped like a bulb;PINK:Pale red;PLUM:Purple stone fruit;POND:Small pool of water;POOL:Place to swim;RICE:Grain grown in paddies;ROCK:Hard natural stone;ROOF:Top covering of a house;ROOT:Underground part of a plant;SAND:Found on a beach;SEED:Planted to grow a new plant;SHOE:Footwear;SILK:Fabric made by silkworms;SING:Make music with your voice;SOCK:Worn on the foot inside a shoe;SOUP:Liquid food eaten with a spoon;SWAN:Large white water bird with a long neck;TAIL:Rear part of an animal;TEAM:Group playing on the same side;TOWN:Smaller than a city;WALL:Side of a room;WAVE:Moving ridge on the sea;WOOL:Fleece of a sheep;YARD:Three feet;ZERO:Number meaning nothing;
APPLE:Fruit that keeps the doctor away;BREAD:Baked loaf for sandwiches;CHAIR:Seat with a back;CLOCK:Tells the time;CLOUD:White or grey shape in the sky;DANCE:Move to music;EARTH:The planet we live on;FLOOR:What you walk on indoors;HORSE:Animal you can ride;HOUSE:Building where people live;LEMON:Sour yellow fruit;LIGHT:Opposite of dark;MOUSE:Small rodent with whiskers;OCEAN:Vast body of salt water;PIANO:Keyboard instrument with black and white keys;PLANT:Living thing that grows in soil;RIVER:Flowing stream that runs to the sea;SHEEP:Woolly farm animal;SMILE:Happy expression on the face;SNAKE:Long legless reptile;SPOON:Used to eat soup;TABLE:Furniture with a flat top and legs;TIGER:Big striped cat;TOAST:Browned bread;WATER:Clear liquid that we drink;WHALE:Largest sea mammal;ZEBRA:Striped African animal;BEACH:Sandy shore;BRUSH:Used to tidy the hair or paint a wall;CANDY:Sugary sweet;DRESS:Garment worn by a girl or woman;FRUIT:Apples and oranges are examples;GLASS:Transparent material of windows;HEART:Organ that pumps blood;MONEY:Coins and notes;NIGHT:Dark part of the day;PAPER:Thin sheet you write on;QUEEN:Female ruler of a kingdom;ROBOT:Machine that can do tasks automatically;STONE:Small piece of rock;TRAIN:Runs on rails;WATCH:Timepiece worn on the wrist;WORLD:The Earth and all its people;BRAIN:Organ used for thinking;CLOWN:Circus performer with a red nose;EAGLE:Large bird of prey;FLAME:Hot glowing part of a fire;GRAPE:Fruit that grows in bunches and makes wine;BLOOM:Flower opening;BLUE:Colour of a clear sky;BRICK:Block used to build walls;BROOM:Used to sweep the floor;CAMEL:Desert animal with humps;CHEESE:Dairy food made from milk;COAST:Land beside the sea;CROWN:Worn on a king's head;DAISY:White flower with a yellow centre;DRAIN:Pipe that carries away waste water;FENCE:Barrier around a garden;FIELD:Open area of grass or crops;FLOUR:Ground wheat used for baking;FROST:Ice crystals on a cold morning;GHOST:Spooky spirit;GIANT:Very large;GLOBE:Round model of the Earth;HAPPY:Feeling joy;JELLY:Wobbly dessert;KNIFE:Used to cut food;LADDER:Climbed to reach high places;LEARN:Gain knowledge;LUNCH:Midday meal;MANGO:Sweet tropical fruit;MARCH:Walk in step like soldiers;NURSE:Cares for patients in a hospital;OLIVE:Small green fruit used for oil;PEACH:Fuzzy orange-pink fruit;PILOT:Flies an aeroplane;PIZZA:Italian dish with cheese and tomato;PLATE:Dish for serving food;RADIO:Device for listening to broadcasts;SALAD:Cold dish of raw vegetables;SCARF:Worn around the neck in winter;SHARK:Large predatory fish;SKIRT:Garment that hangs from the waist;SLEEP:What you do in bed at night;SNAIL:Slow creature with a shell;SPIDER:Eight-legged web spinner;STORM:Violent weather with thunder;SUGAR:Sweet white crystals;TEETH:You chew with them;TOWER:Tall narrow building;TRUCK:Large vehicle for carrying loads;UMBRELLA:Keeps you dry in the rain;VOICE:Sound made when you speak;WHEEL:Round part that turns on a car;WOMAN:Adult female;YOUNG:Not old`;
L.MW_PAIRS = L.MW_RAW.replace(/\n/g, '').split(';').map((s) => { const i = s.indexOf(':'); return [s.slice(0, i).toUpperCase(), s.slice(i + 1)]; })
  .filter((p, i, a) => /^[A-Z]{3,5}$/.test(p[0]) && a.findIndex((q) => q[0] === p[0]) === i);
L.mwByLen = (() => { const m = { 3: [], 4: [], 5: [] }; L.MW_PAIRS.forEach((p) => m[p[0].length].push(p)); return m; })();
/* A random block pattern: string of 25 chars, '#' black and '.' white; null when it breaks the rules. */
L.mwPattern = function () {
  const n = 5, mask = Array(25).fill(0), blocks = 2 + rnd(5), sym = Math.random() < 0.6;
  for (let k = 0; k < blocks; k++) { const i = rnd(25); mask[i] = 1; if (sym) mask[24 - i] = 1; }
  const runs = [];
  for (let d = 0; d < 2; d++) for (let a = 0; a < n; a++) {
    let b = 0;
    while (b < n) {
      const idx = (x) => (d ? x * n + a : a * n + x);
      if (mask[idx(b)]) { b++; continue; }
      let e = b; while (e < n && !mask[idx(e)]) e++;
      const len = e - b; if (len === 2) return null;
      runs.push({ d, a, b, len, cells: Array.from({ length: len }, (_, i) => idx(b + i)) });
      b = e;
    }
  }
  const covered = new Set(); runs.forEach((r) => { if (r.len >= 3) r.cells.forEach((c) => covered.add(c)); });
  for (let i = 0; i < 25; i++) if (!mask[i] && !covered.has(i)) return null;
  const ents = runs.filter((r) => r.len >= 3);
  if (ents.length < 5 || ents.filter((r) => !r.d).length < 2 || ents.filter((r) => r.d).length < 2) return null;
  /* connected */
  const first = mask.indexOf(0), seen = new Set([first]), st = [first];
  while (st.length) { const c = st.pop(), r = (c / 5) | 0, q = c % 5; [[r - 1, q], [r + 1, q], [r, q - 1], [r, q + 1]].forEach(([rr, qq]) => { if (rr >= 0 && rr < 5 && qq >= 0 && qq < 5) { const j = rr * 5 + qq; if (!mask[j] && !seen.has(j)) { seen.add(j); st.push(j); } } }); }
  if (seen.size !== 25 - mask.reduce((a, b) => a + b, 0)) return null;
  return mask.map((m) => (m ? '#' : '.')).join('');
};
/* Entries of a pattern, numbered like a newspaper crossword. */
L.mwEntries = function (pat) {
  const n = 5, out = [];
  const startsA = (r, c) => pat[r * n + c] !== '#' && (c === 0 || pat[r * n + c - 1] === '#') && c + 2 < n && pat[r * n + c + 1] !== '#' && pat[r * n + c + 2] !== '#';
  const startsD = (r, c) => pat[r * n + c] !== '#' && (r === 0 || pat[(r - 1) * n + c] === '#') && r + 2 < n && pat[(r + 1) * n + c] !== '#' && pat[(r + 2) * n + c] !== '#';
  let num = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const a = startsA(r, c), d = startsD(r, c);
    if (!a && !d) continue;
    num++;
    if (a) { let e = c; while (e < n && pat[r * n + e] !== '#') e++; out.push({ n: num, dir: 'A', r, c, len: e - c, cells: Array.from({ length: e - c }, (_, i) => r * n + c + i) }); }
    if (d) { let e = r; while (e < n && pat[e * n + c] !== '#') e++; out.push({ n: num, dir: 'D', r, c, len: e - r, cells: Array.from({ length: e - r }, (_, i) => (r + i) * n + c) }); }
  }
  return out;
};
/* Fill the entries with dictionary words. Returns the entries with word and clue, or null. */
L.mwFill = function (pat, nodeLimit) {
  const ents = L.mwEntries(pat), grid = Array(25).fill(''), used = new Set(); let nodes = 0;
  const cand = (e) => {
    const out = [];
    for (const p of L.mwByLen[e.len]) { if (used.has(p[0])) continue; let ok = true; for (let i = 0; i < e.len; i++) { const g = grid[e.cells[i]]; if (g && g !== p[0][i]) { ok = false; break; } } if (ok) out.push(p); }
    return out;
  };
  function go(left) {
    if (!left.length) return true;
    if (++nodes > nodeLimit) return false;
    let best = -1, bc = null;
    for (let i = 0; i < left.length; i++) { const c = cand(left[i]); if (best < 0 || c.length < bc.length) { best = i; bc = c; if (!c.length) return false; } }
    const e = left[best], rest = left.filter((_, i) => i !== best);
    for (const p of shuffle(bc)) {
      const saved = e.cells.map((c) => grid[c]);
      e.cells.forEach((c, i) => { grid[c] = p[0][i]; }); used.add(p[0]); e.word = p[0]; e.clue = p[1];
      if (go(rest)) return true;
      e.cells.forEach((c, i) => { grid[c] = saved[i]; }); used.delete(p[0]);
      if (nodes > nodeLimit) return false;
    }
    return false;
  }
  return go(ents.slice()) ? { pat, grid, entries: ents } : null;
};
/* A finished mini crossword: { cells: [25 letters or '#'], entries: [{n, dir, r, c, len, word, clue, cells}] } */
L.mwGen = function () {
  for (let t = 0; t < 4000; t++) {
    const pat = L.mwPattern(); if (!pat) continue;
    const r = L.mwFill(pat, 700);
    if (r) return { cells: pat.split('').map((ch, i) => (ch === '#' ? '#' : r.grid[i])), entries: r.entries.map((e) => ({ n: e.n, dir: e.dir, r: e.r, c: e.c, len: e.len, word: e.word, clue: e.clue, cells: e.cells })) };
  }
  return null;
};
/* Check a finished crossword: every entry reads the stored word, no run of 2, every white cell is in an entry, words are unique and clued. */
L.mwValid = function (pz) {
  const g = pz.cells;
  if (g.length !== 25) return false;
  const words = new Set();
  for (const e of pz.entries) {
    if (e.cells.map((c) => g[c]).join('') !== e.word || !e.clue || words.has(e.word)) return false;
    words.add(e.word);
  }
  const covered = new Set(); pz.entries.forEach((e) => e.cells.forEach((c) => covered.add(c)));
  for (let i = 0; i < 25; i++) if (g[i] !== '#' && !covered.has(i)) return false;
  /* runs of 2 are not allowed and every run of 3+ must be an entry */
  const pat = g.map((x) => (x === '#' ? '#' : '.')).join('');
  const ents = L.mwEntries(pat);
  if (ents.length !== pz.entries.length) return false;
  for (let d = 0; d < 2; d++) for (let a = 0; a < 5; a++) {
    let run = 0;
    for (let b = 0; b <= 5; b++) {
      const ch = b < 5 ? (d ? g[b * 5 + a] : g[a * 5 + b]) : '#';
      if (ch === '#') { if (run === 2) return false; run = 0; } else run++;
    }
  }
  return true;
};
/* LOGIC-END */

reg('miniwords', 'Mini Crossword', '🗞️', 'A small 5x5-style crossword made fresh each time, with an on-screen keyboard, check and reveal.',
  ['crossword', 'mini', 'clues', 'words', 'puzzle'], function (el) {
    const T = tracker(), ID = 'miniwords';
    const sv = gget(ID);
    let pz = null, ent = [], sel = -1, dir = 'A', done = false, gave = false, bad = new Set(), revealed = new Set();
    const root = mount(el, `
      <div class="stats">${stat('tm', 'Time', '0:00')}${stat('bs', 'Best', '–')}</div>
      <div class="msg" id="clue" style="font-size:15px;min-height:44px"></div>
      <div id="bd" class="bd" style="grid-template-columns:repeat(5,56px);gap:2px;background:var(--text);padding:2px;border-radius:8px;width:296px" role="grid" aria-label="Crossword grid"></div>
      <div class="msg" id="msg" style="font-size:14px"></div>
      <div id="kb"></div>
      <div class="acts"><button class="btn alt" id="chk">✔ Check</button><button class="btn alt" id="rl">💡 Reveal letter</button><button class="btn alt" id="rw">Reveal word</button></div>
      <div class="acts"><button class="btn alt" id="giveup">🏳 Show solution</button><button class="btn" id="new">New crossword</button></div>
      <div id="cl" style="font-size:14px"></div>`);
    const clock = makeClock(T, $('#tm', root)), bd = $('#bd', root);
    const bestStr = () => { const b = getBest(ID, 'time'); return b ? fmtT(b) : '–'; };
    const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM⌫'];
    $('#kb', root).innerHTML = ROWS.map((r) => '<div style="display:flex;gap:4px;justify-content:center;margin-bottom:4px">' + r.split('').map((k) =>
      '<button class="kk" data-k="' + k + '" aria-label="' + (k === '⌫' ? 'Backspace' : k) + '" style="flex:1;max-width:34px;min-height:44px;padding:0;border:1px solid var(--line);border-radius:8px;background:var(--surface2);color:var(--text);font-weight:700;font-size:16px">' + k + '</button>').join('') + '</div>').join('');
    const entAt = (i, d) => ent.find((e) => e.dir === d && e.cells.includes(i));
    function curEnt() { return sel >= 0 ? (entAt(sel, dir) || entAt(sel, dir === 'A' ? 'D' : 'A')) : null; }
    function save() { gput(ID, { cur: pz ? { pz, ent: userG, secs: clock.secs(), done, gave } : null }); }
    let userG = [];
    function paint() {
      const ce = curEnt(), inE = new Set(ce ? ce.cells : []);
      const nums = {}; ent.forEach((e) => { nums[e.cells[0]] = e.n; });
      bd.innerHTML = pz.cells.map((ch, i) => {
        if (ch === '#') return '<div style="background:var(--text);width:56px;height:56px"></div>';
        const bg = i === sel ? 'var(--accent)' : bad.has(i) ? bgBad : revealed.has(i) ? bgOK : inE.has(i) ? bgSel : 'var(--surface)';
        const col = i === sel ? 'var(--accent-t)' : 'var(--text)';
        return '<button data-i="' + i + '" role="gridcell" aria-label="Row ' + (((i / 5) | 0) + 1) + ' column ' + ((i % 5) + 1) + '" style="position:relative;width:56px;height:56px;background:' + bg + ';color:' + col + ';font-size:26px;font-weight:700">' +
          (nums[i] ? '<span style="position:absolute;left:3px;top:1px;font-size:11px;font-weight:600">' + nums[i] + '</span>' : '') + (userG[i] || '') + '</button>';
      }).join('');
      $('#clue', root).textContent = ce ? ce.n + ' ' + (ce.dir === 'A' ? 'Across' : 'Down') + ': ' + ce.clue + ' (' + ce.len + ')' : 'Tap a square to start';
      const list = (d) => '<b>' + (d === 'A' ? 'Across' : 'Down') + '</b><div>' + ent.filter((e) => e.dir === d).map((e) => '<button data-e="' + ent.indexOf(e) + '" style="display:block;width:100%;text-align:left;border:0;background:' + (e === ce ? bgSel : 'transparent') + ';color:var(--text);padding:8px 4px;min-height:44px;border-radius:6px">' + e.n + '. ' + esc(e.clue) + ' (' + e.len + ')</button>').join('') + '</div>';
      $('#cl', root).innerHTML = '<div class="card">' + list('A') + '</div><div class="card">' + list('D') + '</div>';
    }
    function load(p, u, secs, wasDone, wasGave) {
      pz = p; ent = p.entries; userG = u && u.length === 25 ? u.slice() : Array(25).fill('');
      sel = p.cells.findIndex((c) => c !== '#'); dir = 'A'; done = !!wasDone; gave = !!wasGave; bad = new Set(); revealed = new Set();
      $('#msg', root).textContent = done ? (gave ? 'Solution shown' : '🎉 Solved') : ''; $('#bs', root).textContent = bestStr();
      paint(); if (done) clock.stop(); else clock.start(secs);
      if (!done) save();
    }
    function fresh() { const p = L.mwGen(); if (p) load(p, null, 0, false, false); }
    function allRight() { return pz.cells.every((c, i) => c === '#' || userG[i] === c); }
    function checkWin() {
      if (done || !pz.cells.every((c, i) => c === '#' || userG[i])) return;
      if (allRight()) {
        done = true; const s = clock.stop(), nb = !gave && recBest(ID, 'time', s, true); $('#bs', root).textContent = bestStr();
        $('#msg', root).textContent = '🎉 Solved in ' + fmtT(s) + (nb ? ' (new best!)' : ''); buzz(80);
      } else $('#msg', root).textContent = 'Some letters are wrong. Tap Check.';
    }
    function typeKey(k) {
      if (!pz || done || sel < 0) return;
      bad = new Set();
      if (k === '⌫') {
        if (userG[sel]) userG[sel] = ''; else { const e = curEnt(); const j = e ? e.cells.indexOf(sel) : -1; if (j > 0) { sel = e.cells[j - 1]; userG[sel] = ''; } }
      } else if (/^[A-Z]$/.test(k)) {
        userG[sel] = k; revealed.delete(sel);
        const e = curEnt(); if (e) { const j = e.cells.indexOf(sel); if (j >= 0 && j < e.cells.length - 1) sel = e.cells[j + 1]; }
      }
      paint(); save(); checkWin();
    }
    bd.onclick = (e) => {
      const b = e.target.closest('button'); if (!b || done) return;
      const i = +b.dataset.i;
      if (i === sel) dir = dir === 'A' ? 'D' : 'A'; else { sel = i; if (!entAt(i, dir)) dir = dir === 'A' ? 'D' : 'A'; }
      paint();
    };
    $('#cl', root).onclick = (e) => { const b = e.target.closest('button'); if (!b) return; const en = ent[+b.dataset.e]; if (!en) return; dir = en.dir; sel = en.cells.find((c) => !userG[c]); if (sel === undefined) sel = en.cells[0]; paint(); };
    $('#kb', root).onclick = (e) => { const b = e.target.closest('button'); if (b) typeKey(b.dataset.k); };
    T.on(window, 'keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName || ''))) return;
      if (/^[a-zA-Z]$/.test(e.key)) typeKey(e.key.toUpperCase()); else if (e.key === 'Backspace') typeKey('⌫');
    });
    $('#chk', root).onclick = () => {
      if (!pz || done) return;
      bad = new Set(); pz.cells.forEach((c, i) => { if (c !== '#' && userG[i] && userG[i] !== c) bad.add(i); });
      $('#msg', root).textContent = bad.size ? bad.size + ' wrong letter' + (bad.size > 1 ? 's' : '') + ' in red' : (allRight() ? 'All correct' : 'So far so good');
      paint(); T.to(() => { bad = new Set(); if (pz) paint(); }, 3000);
    };
    $('#rl', root).onclick = () => {
      if (!pz || done || sel < 0) return;
      userG[sel] = pz.cells[sel]; revealed.add(sel); gave = true; paint(); save(); checkWin();
    };
    $('#rw', root).onclick = () => {
      const ce = curEnt(); if (!pz || done || !ce) return;
      ce.cells.forEach((c) => { userG[c] = pz.cells[c]; revealed.add(c); }); gave = true; paint(); save(); checkWin();
    };
    $('#giveup', root).onclick = () => {
      if (!pz || done) return;
      pz.cells.forEach((c, i) => { if (c !== '#') userG[i] = c; }); gave = true; done = true; clock.stop(); bad = new Set(); paint();
      $('#msg', root).textContent = 'Solution shown'; save();
    };
    $('#new', root).onclick = fresh;
    const s0 = sv.cur;
    if (s0 && s0.pz && Array.isArray(s0.pz.cells) && s0.pz.cells.length === 25 && Array.isArray(s0.pz.entries) && L.mwValid(s0.pz)) load(s0.pz, s0.ent, s0.secs || 0, s0.done, s0.gave);
    else fresh();
    return () => { if (pz && !done) save(); T.stop(); };
  });

/* =====================================================================
   3. KenKen
   ===================================================================== */
/* LOGIC-START */
/* Random n x n Latin square (array of n*n numbers 1..n). */
L.latin = function (n) {
  const g = Array(n * n).fill(0);
  function go(i) {
    if (i === n * n) return true;
    const r = (i / n) | 0, c = i % n, used = new Set();
    for (let k = 0; k < c; k++) used.add(g[r * n + k]);
    for (let k = 0; k < r; k++) used.add(g[k * n + c]);
    for (const v of shuffle([...Array(n).keys()].map((x) => x + 1))) { if (used.has(v)) continue; g[i] = v; if (go(i + 1)) return true; }
    g[i] = 0; return false;
  }
  go(0);
  return g;
};
L.nbrs = function (n, i) {
  const r = (i / n) | 0, c = i % n, o = [];
  if (r > 0) o.push(i - n); if (r < n - 1) o.push(i + n); if (c > 0) o.push(i - 1); if (c < n - 1) o.push(i + 1);
  return o;
};
/* Split the cell set into connected components (each an array of cells). */
L.components = function (n, cells) {
  const left = new Set(cells), out = [];
  while (left.size) {
    const s = left.values().next().value, comp = [s], st = [s]; left.delete(s);
    while (st.length) { const c = st.pop(); for (const x of L.nbrs(n, c)) if (left.has(x)) { left.delete(x); comp.push(x); st.push(x); } }
    out.push(comp.sort((a, b) => a - b));
  }
  return out;
};
/* Operation and target of a cage from the solution. */
L.kkCage = function (cells, sol) {
  const v = cells.map((c) => sol[c]);
  if (v.length === 1) return { cells, op: '', t: v[0] };
  if (v.length === 2) {
    const hi = Math.max(v[0], v[1]), lo = Math.min(v[0], v[1]), ops = ['+', '×', '-'];
    if (hi % lo === 0) ops.push('÷', '÷');
    const op = pick(ops);
    return { cells, op, t: op === '+' ? hi + lo : op === '×' ? hi * lo : op === '-' ? hi - lo : hi / lo };
  }
  const op = Math.random() < 0.7 ? '+' : '×';
  return { cells, op, t: op === '+' ? v.reduce((a, b) => a + b, 0) : v.reduce((a, b) => a * b, 1) };
};
/* Random connected cages of size 1..4 covering the board (arrays of cell lists). */
L.kkPartition = function (n) {
  const owner = Array(n * n).fill(-1), cages = [];
  for (const s of shuffle([...Array(n * n).keys()])) {
    if (owner[s] >= 0) continue;
    const x = Math.random(), want = x < 0.04 ? 1 : x < 0.5 ? 2 : x < 0.85 ? 3 : 4, cells = [s];
    owner[s] = cages.length;
    while (cells.length < want) {
      const opts = []; cells.forEach((c) => L.nbrs(n, c).forEach((d) => { if (owner[d] < 0) opts.push(d); }));
      if (!opts.length) break;
      const d = pick(opts); owner[d] = cages.length; cells.push(d);
    }
    cages.push(cells.sort((a, b) => a - b));
  }
  return cages;
};
/* Does a complete or partial cage assignment satisfy the cage? vals = values of the cage cells (0 = empty). */
L.kkCageOk = function (cg, vals, n) {
  const filled = vals.filter(Boolean), full = filled.length === vals.length;
  if (cg.op === '') return !filled.length || filled[0] === cg.t;
  if (cg.op === '+') { const s = filled.reduce((a, b) => a + b, 0), rem = vals.length - filled.length; return full ? s === cg.t : s + rem <= cg.t && s + rem * n >= cg.t; }
  if (cg.op === '×') { const p = filled.reduce((a, b) => a * b, 1); return full ? p === cg.t : cg.t % p === 0; }
  if (!full) return true;
  const hi = Math.max(vals[0], vals[1]), lo = Math.min(vals[0], vals[1]);
  return cg.op === '-' ? hi - lo === cg.t : hi === lo * cg.t;
};
/* Count solutions (stops at limit). Returns { count, sols }. */
L.kkSolve = function (n, cages, limit) {
  const N = n * n, cageOf = Array(N), g = Array(N).fill(0), sols = [];
  cages.forEach((cg, k) => cg.cells.forEach((c) => { cageOf[c] = k; }));
  let count = 0;
  function go(i) {
    if (count >= limit) return;
    if (i === N) { count++; sols.push(g.slice()); return; }
    const r = (i / n) | 0, c = i % n, cg = cages[cageOf[i]];
    for (let v = 1; v <= n; v++) {
      let ok = true;
      for (let k = 0; k < c && ok; k++) if (g[r * n + k] === v) ok = false;
      for (let k = 0; k < r && ok; k++) if (g[k * n + c] === v) ok = false;
      if (!ok) continue;
      g[i] = v;
      if (L.kkCageOk(cg, cg.cells.map((x) => g[x]), n)) go(i + 1);
      g[i] = 0;
      if (count >= limit) return;
    }
  }
  go(0);
  return { count, sols };
};
/* Generate a puzzle with exactly one solution: { n, sol, cages: [{cells, op, t}] }. */
L.kkGen = function (n) {
  const sol = L.latin(n);
  /* first choice: a random partition that is already unique with at most a couple of single-cell cages */
  for (let t = 0; t < 400; t++) {
    const cages = L.kkPartition(n).map((c) => L.kkCage(c, sol));
    if (cages.filter((c) => c.cells.length === 1).length > (n > 4 ? 2 : 1)) continue;
    if (L.kkSolve(n, cages, 2).count === 1) return { n, sol, cages };
  }
  let parts = L.kkPartition(n);
  for (let guard = 0; guard < 200; guard++) {
    const cages = parts.map((c) => L.kkCage(c, sol));
    const r = L.kkSolve(n, cages, 2);
    if (r.count === 1) return { n, sol, cages };
    const alt = r.sols.find((s) => s.some((v, i) => v !== sol[i])) || r.sols[0];
    const diff = []; alt.forEach((v, i) => { if (v !== sol[i]) diff.push(i); });
    const cell = pick(diff), host = parts.findIndex((p) => p.includes(cell));
    const rest = parts[host].filter((c) => c !== cell);
    parts = parts.filter((_, i) => i !== host).concat([[cell]], rest.length ? L.components(n, rest) : []);
  }
  return null;
};
/* Cells of a row or column holding a repeated value (Set of cell indexes). */
L.latinConflicts = function (n, g) {
  const bad = new Set();
  for (let a = 0; a < n; a++) for (const line of [0, 1]) {
    const seen = {};
    for (let b = 0; b < n; b++) { const i = line ? b * n + a : a * n + b, v = g[i]; if (!v) continue; (seen[v] = seen[v] || []).push(i); }
    Object.values(seen).forEach((l) => { if (l.length > 1) l.forEach((i) => bad.add(i)); });
  }
  return bad;
};
/* LOGIC-END */

reg('kenken', 'KenKen', '🥌', 'Fill the grid so no number repeats in a row or column and every cage hits its target with + - × ÷. Unique solution guaranteed, pencil notes included.',
  ['kenken', 'calcudoku', 'math', 'puzzle', 'cages'], function (el) {
    const T = tracker(), ID = 'kenken';
    const sv = gget(ID);
    let n = [4, 5, 6].includes(sv.n) ? sv.n : 4, pz = null, g = [], notes = [], sel = -1, pencil = false, done = false, gave = false, wrong = new Set(), busy = false;
    const root = mount(el, `
      ${seg('sz', [[4, '4×4'], [5, '5×5'], [6, '6×6']], n)}
      <div class="stats">${stat('tm', 'Time', '0:00')}${stat('bs', 'Best', '–')}</div>
      <div id="bd" class="bd" style="border:3px solid var(--text);border-radius:6px;background:var(--surface)" role="grid" aria-label="KenKen grid"></div>
      <div class="msg" id="msg"></div>
      <div id="pad" class="pad"></div>
      <div class="acts"><button class="btn alt" id="pen" aria-pressed="false">✏️ Notes off</button><button class="btn alt" id="hint">💡 Hint</button><button class="btn alt" id="chk">✔ Check</button></div>
      <div class="acts"><button class="btn alt" id="giveup">🏳 Show solution</button><button class="btn" id="new">New puzzle</button></div>`);
    const clock = makeClock(T, $('#tm', root)), bd = $('#bd', root);
    const bestStr = () => { const b = getBest(ID, 'n' + n); return b ? fmtT(b) : '–'; };
    const px = () => Math.min(54, Math.floor(318 / n));
    function save() { gput(ID, { n, cur: pz ? { pz, g, notes, secs: clock.secs(), done, gave } : null }); }
    function cageOf(i) { return pz.cages.findIndex((c) => c.cells.includes(i)); }
    function paint() {
      const s = px(), bad = L.latinConflicts(n, g);
      const own = Array(n * n); pz.cages.forEach((c, k) => c.cells.forEach((x) => { own[x] = k; }));
      const badCage = new Set(); pz.cages.forEach((c, k) => { const vals = c.cells.map((x) => g[x]); if (vals.every(Boolean) && !L.kkCageOk(c, vals, n)) badCage.add(k); });
      bd.style.gridTemplateColumns = 'repeat(' + n + ',' + s + 'px)';
      const sv0 = sel >= 0 ? g[sel] : 0;
      let h = '';
      for (let i = 0; i < n * n; i++) {
        const r = (i / n) | 0, c = i % n, k = own[i], cg = pz.cages[k];
        const side = (rr, cc) => (rr < 0 || cc < 0 || rr >= n || cc >= n || own[rr * n + cc] !== k ? '2px solid var(--text)' : '1px solid var(--line)');
        const isBad = bad.has(i) || wrong.has(i);
        const bg = i === sel ? bgSel : isBad ? bgBad : sv0 && g[i] === sv0 ? 'color-mix(in srgb,var(--accent) 14%,var(--surface))' : 'var(--surface)';
        const label = cg.cells[0] === i ? '<span style="position:absolute;left:2px;top:0;font-size:' + (n > 5 ? 10 : 11) + 'px;font-weight:700;color:' + (badCage.has(k) ? 'var(--danger)' : 'var(--muted)') + ';line-height:1.1">' + cg.t + cg.op + '</span>' : '';
        let body = '';
        if (g[i]) body = '<span style="font-size:' + Math.round(s * 0.5) + 'px;font-weight:700;color:' + (isBad ? 'var(--danger)' : 'var(--accent)') + '">' + g[i] + '</span>';
        else if (notes[i]) { let t = ''; for (let v = 1; v <= n; v++) t += (notes[i] >> v & 1) ? v : ' '; body = '<span style="font-size:9px;letter-spacing:1px;color:var(--muted);white-space:pre-wrap;word-break:break-all;line-height:1;padding:0 2px;text-align:center;width:100%;margin-top:10px">' + t + '</span>'; }
        h += '<button data-i="' + i + '" role="gridcell" aria-label="Row ' + (r + 1) + ' column ' + (c + 1) + (g[i] ? ' value ' + g[i] : '') + ', cage ' + cg.t + cg.op + '" style="position:relative;display:flex;align-items:center;justify-content:center;width:' + s + 'px;height:' + s + 'px;background:' + bg + ';border-top:' + side(r - 1, c) + ';border-left:' + side(r, c - 1) + ';border-bottom:' + side(r + 1, c) + ';border-right:' + side(r, c + 1) + '">' + label + body + '</button>';
      }
      bd.innerHTML = h;
    }
    function buildPad() {
      let h = ''; for (let v = 1; v <= n; v++) h += '<button data-v="' + v + '">' + v + '</button>';
      h += '<button data-v="0" aria-label="Erase">⌫</button>';
      const p = $('#pad', root); p.style.gridTemplateColumns = 'repeat(' + (n + 1) + ',1fr)'; p.innerHTML = h;
    }
    function load(p, gg, nn, secs, d, gv) {
      pz = p; n = p.n; g = gg && gg.length === n * n ? gg.slice() : Array(n * n).fill(0); notes = nn && nn.length === n * n ? nn.slice() : Array(n * n).fill(0);
      sel = -1; done = !!d; gave = !!gv; wrong = new Set(); busy = false;
      $$('#sz button', root).forEach((b) => { const on = +b.dataset.v === n; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
      $('#msg', root).textContent = done ? (gave ? 'Solution shown' : '🎉 Solved') : ''; $('#bs', root).textContent = bestStr();
      buildPad(); paint(); if (done) clock.stop(); else clock.start(secs);
      if (!done) save();
    }
    function fresh() {
      if (busy) return; busy = true; $('#msg', root).textContent = 'Making a puzzle…'; clock.stop();
      T.to(() => { const p = L.kkGen(n); busy = false; if (p) load(p, null, null, 0, false, false); }, 30);
    }
    function checkWin() {
      if (done || !g.every(Boolean)) return;
      if (g.every((v, i) => v === pz.sol[i])) {
        done = true; const s = clock.stop(), nb = !gave && recBest(ID, 'n' + n, s, true); $('#bs', root).textContent = bestStr();
        $('#msg', root).textContent = '🎉 Solved in ' + fmtT(s) + (nb ? ' (new best!)' : ''); buzz(80); save();
      } else $('#msg', root).textContent = 'Not quite: look for red cells and cages';
    }
    function setVal(v) {
      if (busy || done || sel < 0) return;
      wrong = new Set();
      if (v === 0) { g[sel] = 0; notes[sel] = 0; }
      else if (pencil) { if (!g[sel]) notes[sel] ^= 1 << v; }
      else { g[sel] = v; notes[sel] = 0; }
      paint(); save(); checkWin();
    }
    bd.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; sel = +b.dataset.i; paint(); };
    $('#pad', root).onclick = (e) => { const b = e.target.closest('button'); if (b) setVal(+b.dataset.v); };
    T.on(window, 'keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName || ''))) return;
      if (/^[0-9]$/.test(e.key) && +e.key <= n) setVal(+e.key); else if (e.key === 'Backspace' || e.key === 'Delete') setVal(0);
    });
    $('#pen', root).onclick = (e) => { pencil = !pencil; e.currentTarget.textContent = pencil ? '✏️ Notes on' : '✏️ Notes off'; e.currentTarget.setAttribute('aria-pressed', String(pencil)); };
    $('#hint', root).onclick = () => {
      if (busy || done || !pz) return;
      let i = sel >= 0 && g[sel] !== pz.sol[sel] ? sel : -1;
      if (i < 0) { const c = g.map((v, k) => (v !== pz.sol[k] ? k : -1)).filter((k) => k >= 0); if (!c.length) return; i = pick(c); }
      sel = i; g[i] = pz.sol[i]; notes[i] = 0; gave = true; paint(); save(); checkWin();
    };
    $('#chk', root).onclick = () => {
      if (busy || done || !pz) return;
      wrong = new Set(); g.forEach((v, i) => { if (v && v !== pz.sol[i]) wrong.add(i); });
      $('#msg', root).textContent = wrong.size ? wrong.size + ' wrong number' + (wrong.size > 1 ? 's' : '') + ' in red' : 'All entries so far are correct';
      paint(); T.to(() => { wrong = new Set(); if (pz) paint(); }, 2500);
    };
    $('#giveup', root).onclick = () => {
      if (busy || done || !pz) return;
      g = pz.sol.slice(); notes = Array(n * n).fill(0); gave = true; done = true; clock.stop(); wrong = new Set(); paint(); $('#msg', root).textContent = 'Solution shown'; save();
    };
    onSeg(root, 'sz', (v) => { n = +v; gput(ID, { n }); fresh(); });
    $('#new', root).onclick = fresh;
    const s0 = sv.cur;
    if (s0 && s0.pz && s0.pz.n === n && Array.isArray(s0.pz.cages) && Array.isArray(s0.pz.sol) && s0.pz.sol.length === n * n) load(s0.pz, s0.g, s0.notes, s0.secs || 0, s0.done, s0.gave);
    else fresh();
    return () => { if (pz && !done) save(); T.stop(); };
  });

/* =====================================================================
   4. Kakuro
   ===================================================================== */
/* LOGIC-START */
/* Runs (maximal white stretches of length 2+) of an N x N board; white[i] truthy = white cell. clue = the black cell before the run. */
L.kkrRuns = function (N, white) {
  const runs = [];
  for (let d = 0; d < 2; d++) for (let a = 0; a < N; a++) {
    let b = 0;
    const idx = (x) => (d ? x * N + a : a * N + x);
    while (b < N) {
      if (!white[idx(b)]) { b++; continue; }
      let e = b; while (e < N && white[idx(e)]) e++;
      if (e - b >= 2 && b > 0) runs.push({ dir: d ? 'd' : 'a', clue: idx(b - 1), cells: Array.from({ length: e - b }, (_, i) => idx(b + i)) });
      b = e;
    }
  }
  return runs;
};
/* Random board layout: array of 0/1 (1 = white). The first row and column are black. null if unlucky. */
L.kkrLayout = function (N) {
  const w = Array(N * N).fill(1);
  for (let i = 0; i < N; i++) { w[i] = 0; w[i * N] = 0; }
  const dens = 0.12 + Math.random() * 0.14;
  for (let i = 0; i < N * N; i++) if (w[i] && Math.random() < dens) w[i] = 0;
  for (let guard = 0; guard < 60; guard++) {
    let changed = false;
    for (let d = 0; d < 2; d++) for (let a = 1; a < N; a++) {
      const idx = (x) => (d ? x * N + a : a * N + x);
      let b = 1;
      while (b < N) {
        if (!w[idx(b)]) { b++; continue; }
        let e = b; while (e < N && w[idx(e)]) e++;
        const len = e - b;
        if (len === 1) { w[idx(b)] = 0; changed = true; }
        else if (len > 5) { w[idx(b + 1 + rnd(len - 2))] = 0; changed = true; }
        b = e;
      }
    }
    if (!changed) break;
  }
  const cells = []; w.forEach((v, i) => { if (v) cells.push(i); });
  if (cells.length < Math.floor((N - 1) * (N - 1) * 0.5)) return null;
  const runs = L.kkrRuns(N, w), inRun = new Set(); runs.forEach((r) => r.cells.forEach((c) => inRun.add(c)));
  if (cells.some((c) => !inRun.has(c))) return null;
  const seen = new Set([cells[0]]), st = [cells[0]];
  while (st.length) { const c = st.pop(); for (const x of L.nbrs(N, c)) if (w[x] && !seen.has(x)) { seen.add(x); st.push(x); } }
  return seen.size === cells.length ? w : null;
};
/* Random complete fill with distinct digits per run. Returns array of N*N (0 for black) or null. */
L.kkrFill = function (N, w, runs) {
  const g = Array(N * N).fill(0), cells = []; w.forEach((v, i) => { if (v) cells.push(i); });
  const runOf = Array(N * N).fill(null).map(() => []); runs.forEach((r) => r.cells.forEach((c) => runOf[c].push(r)));
  let nodes = 0;
  function go(k) {
    if (k === cells.length) return true;
    if (++nodes > 4000) return false;
    const i = cells[k];
    for (const v of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      if (runOf[i].some((r) => r.cells.some((c) => g[c] === v))) continue;
      g[i] = v; if (go(k + 1)) return true;
    }
    g[i] = 0; return false;
  }
  return go(0) ? g : null;
};
/* Build the clue sums from a fill. Returns { a: [...], d: [...] } indexed by the clue (black) cell. */
L.kkrSums = function (N, runs, g) {
  const a = Array(N * N).fill(0), d = Array(N * N).fill(0);
  runs.forEach((r) => { const s = r.cells.reduce((x, c) => x + g[c], 0); if (r.dir === 'a') a[r.clue] = s; else d[r.clue] = s; });
  return { a, d };
};
/* Count solutions (stops at limit) of a board: p = { N, w, runs, a, d, given (N*N, 0 = free, else fixed digit) }.
   Returns { count, sols, aborted }; aborted = true when the search was cut off after maxNodes (the count is then unreliable). */
L.kkrSolve = function (p, limit, maxNodes) {
  const N = p.N, cells = []; p.w.forEach((v, i) => { if (v) cells.push(i); });
  const runs = p.runs.map((r) => ({ cells: r.cells, target: r.dir === 'a' ? p.a[r.clue] : p.d[r.clue], used: 0, sum: 0, left: r.cells.length }));
  const runOf = Array(N * N).fill(null).map(() => []); runs.forEach((r) => r.cells.forEach((c) => runOf[c].push(r)));
  const g = Array(N * N).fill(0), sols = []; let count = 0, nodes = 0, aborted = false;
  /* can digit v go into a run that still has r.left empty cells? */
  const fits = (r, v) => {
    if (r.used >> v & 1) return false;
    const rem = r.target - r.sum - v, k = r.left - 1, used = r.used | (1 << v);
    if (k === 0) return rem === 0;
    let lo = 0, hi = 0, c = 0;
    for (let d = 1; d <= 9 && c < k; d++) if (!(used >> d & 1)) { lo += d; c++; }
    if (c < k || rem < lo) return false;
    c = 0; for (let d = 9; d >= 1 && c < k; d--) if (!(used >> d & 1)) { hi += d; c++; }
    return rem <= hi;
  };
  const cands = (i) => {
    const fixed = p.given ? p.given[i] : 0, out = [];
    for (let v = fixed || 1; v <= (fixed || 9); v++) if (runOf[i].every((r) => fits(r, v))) out.push(v);
    return out;
  };
  const open = new Set(cells);
  function go() {
    if (aborted || count >= limit) return;
    if (!open.size) { count++; sols.push(g.slice()); return; }
    if (++nodes > (maxNodes || 1e9)) { aborted = true; return; }
    let bi = -1, bc = null;
    for (const i of open) { const c = cands(i); if (bi < 0 || c.length < bc.length) { bi = i; bc = c; if (c.length <= 1) break; } }
    if (!bc.length) return;
    open.delete(bi);
    for (const v of bc) {
      const rs = runOf[bi];
      rs.forEach((r) => { r.used |= 1 << v; r.sum += v; r.left--; }); g[bi] = v;
      go();
      rs.forEach((r) => { r.used &= ~(1 << v); r.sum -= v; r.left++; }); g[bi] = 0;
      if (aborted || count >= limit) break;
    }
    open.add(bi);
  }
  go();
  return { count, sols, aborted };
};
/* Generate a board with one solution: { N, w, a, d, sol, given: [N*N of 0 or digit], nGiven }. */
L.kkrGen = function (N) {
  let best = null;
  for (let t = 0; t < 400; t++) {
    const w = L.kkrLayout(N); if (!w) continue;
    const runs = L.kkrRuns(N, w), sol = L.kkrFill(N, w, runs); if (!sol) continue;
    const { a, d } = L.kkrSums(N, runs, sol), given = Array(N * N).fill(0), p = { N, w, runs, a, d, given };
    let nGiven = 0, ok = false;
    for (let guard = 0; guard < 12; guard++) {
      const r = L.kkrSolve(p, 2, 20000);
      if (r.aborted) break;
      if (r.count === 1) { ok = true; break; }
      const alt = r.sols.find((s) => s.some((v, i) => v !== sol[i])) || r.sols[0];
      const diff = []; alt.forEach((v, i) => { if (v !== sol[i]) diff.push(i); });
      if (!diff.length) break;
      const c = pick(diff); given[c] = sol[c]; nGiven++;
    }
    if (!ok) continue;
    const cand = { N, w, a, d, sol, given, nGiven };
    if (!best || nGiven < best.nGiven) best = cand;
    if (nGiven <= (N > 6 ? 2 : 1) && t >= 4) break;
    if (t >= 40 && best) break;
  }
  return best;
};
/* Cells with a repeated digit in a run, or in a completely filled run whose sum is wrong. */
L.kkrConflicts = function (p, g) {
  const bad = new Set(), runs = L.kkrRuns(p.N, p.w);
  runs.forEach((r) => {
    const vals = r.cells.map((c) => g[c]), target = r.dir === 'a' ? p.a[r.clue] : p.d[r.clue];
    const seen = {}; r.cells.forEach((c) => { if (g[c]) (seen[g[c]] = seen[g[c]] || []).push(c); });
    Object.values(seen).forEach((l) => { if (l.length > 1) l.forEach((c) => bad.add(c)); });
    if (vals.every(Boolean) && vals.reduce((x, y) => x + y, 0) !== target) r.cells.forEach((c) => bad.add(c));
  });
  return bad;
};
/* LOGIC-END */

reg('kakuro', 'Kakuro', '🧫', 'Cross-sums: fill the white cells with 1 to 9 so every run adds up to its clue and no digit repeats in a run. Unique solutions guaranteed.',
  ['kakuro', 'cross', 'sums', 'number', 'puzzle'], function (el) {
    const T = tracker(), ID = 'kakuro';
    const sv = gget(ID);
    const SIZES = { 6: 'Small', 7: 'Medium', 8: 'Large' };
    let N = SIZES[sv.N] ? sv.N : 6, pz = null, g = [], sel = -1, done = false, gave = false, wrong = new Set(), busy = false;
    const root = mount(el, `
      ${seg('sz', Object.keys(SIZES).map((k) => [k, SIZES[k]]), N)}
      <div class="stats">${stat('tm', 'Time', '0:00')}${stat('bs', 'Best', '–')}</div>
      <div id="bd" class="bd" style="border:2px solid var(--text);background:var(--text);gap:1px" role="grid" aria-label="Kakuro board"></div>
      <div class="msg" id="msg"></div>
      <div id="pad" class="pad" style="grid-template-columns:repeat(5,1fr)">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((v) => '<button data-v="' + v + '">' + v + '</button>').join('')}<button data-v="0" aria-label="Erase">⌫</button></div>
      <div class="acts"><button class="btn alt" id="hint">💡 Hint</button><button class="btn alt" id="chk">✔ Check</button><button class="btn alt" id="giveup">🏳 Show solution</button><button class="btn" id="new">New</button></div>`);
    const clock = makeClock(T, $('#tm', root)), bd = $('#bd', root);
    const bestStr = () => { const b = getBest(ID, 'n' + N); return b ? fmtT(b) : '–'; };
    function save() { gput(ID, { N, cur: pz ? { pz, g, secs: clock.secs(), done, gave } : null }); }
    function paint() {
      const s = Math.min(46, Math.floor(318 / N)), bad = L.kkrConflicts(pz, g);
      bd.style.gridTemplateColumns = 'repeat(' + N + ',' + s + 'px)';
      const sv0 = sel >= 0 ? g[sel] : 0;
      let h = '';
      for (let i = 0; i < N * N; i++) {
        if (!pz.w[i]) {
          const a = pz.a[i], d = pz.d[i], fs = Math.max(9, Math.round(s * 0.28));
          const live = a || d;
          h += '<div style="width:' + s + 'px;height:' + s + 'px;position:relative;background:' + (live ? 'linear-gradient(to top right,transparent calc(50% - 1px),var(--muted) 50%,transparent calc(50% + 1px)),var(--surface2)' : 'var(--surface2)') + '">' +
            (a ? '<span aria-label="Across ' + a + '" style="position:absolute;right:2px;top:1px;font-size:' + fs + 'px;font-weight:700;color:var(--text)">' + a + '</span>' : '') +
            (d ? '<span aria-label="Down ' + d + '" style="position:absolute;left:2px;bottom:1px;font-size:' + fs + 'px;font-weight:700;color:var(--text)">' + d + '</span>' : '') + '</div>';
          continue;
        }
        const given = pz.given[i], isBad = bad.has(i) || wrong.has(i);
        const bg = i === sel ? bgSel : isBad ? bgBad : sv0 && g[i] === sv0 ? 'color-mix(in srgb,var(--accent) 14%,var(--surface))' : 'var(--surface)';
        h += '<button data-i="' + i + '" role="gridcell" aria-label="Row ' + (((i / N) | 0) + 1) + ' column ' + ((i % N) + 1) + (g[i] ? ' value ' + g[i] : '') + (given ? ' given' : '') + '" style="width:' + s + 'px;height:' + s + 'px;background:' + bg + ';font-size:' + Math.round(s * 0.52) + 'px;font-weight:' + (given ? 800 : 600) + ';color:' + (isBad ? 'var(--danger)' : given ? 'var(--text)' : 'var(--accent)') + '">' + (g[i] || '') + '</button>';
      }
      bd.innerHTML = h;
    }
    function load(p, gg, secs, d, gv) {
      pz = p; N = p.N; g = gg && gg.length === N * N ? gg.slice() : p.given.slice(); sel = -1; done = !!d; gave = !!gv; wrong = new Set(); busy = false;
      $$('#sz button', root).forEach((b) => { const on = +b.dataset.v === N; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
      $('#msg', root).textContent = done ? (gave ? 'Solution shown' : '🎉 Solved') : ''; $('#bs', root).textContent = bestStr();
      paint(); if (done) clock.stop(); else clock.start(secs);
      if (!done) save();
    }
    function fresh() {
      if (busy) return; busy = true; $('#msg', root).textContent = 'Making a board…'; clock.stop();
      T.to(() => { const p = L.kkrGen(N); busy = false; if (p) load(p, null, 0, false, false); else $('#msg', root).textContent = 'Could not make a board, tap New'; }, 30);
    }
    function checkWin() {
      if (done || !g.every((v, i) => !pz.w[i] || v)) return;
      if (g.every((v, i) => !pz.w[i] || v === pz.sol[i])) {
        done = true; const s = clock.stop(), nb = !gave && recBest(ID, 'n' + N, s, true); $('#bs', root).textContent = bestStr();
        $('#msg', root).textContent = '🎉 Solved in ' + fmtT(s) + (nb ? ' (new best!)' : ''); buzz(80); save();
      } else $('#msg', root).textContent = 'Not quite: look for red cells';
    }
    function setVal(v) {
      if (busy || done || sel < 0 || pz.given[sel]) return;
      wrong = new Set(); g[sel] = v; paint(); save(); checkWin();
    }
    bd.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; sel = +b.dataset.i; paint(); };
    $('#pad', root).onclick = (e) => { const b = e.target.closest('button'); if (b) setVal(+b.dataset.v); };
    T.on(window, 'keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName || ''))) return;
      if (/^[0-9]$/.test(e.key)) setVal(+e.key); else if (e.key === 'Backspace' || e.key === 'Delete') setVal(0);
    });
    $('#hint', root).onclick = () => {
      if (busy || done || !pz) return;
      let i = sel >= 0 && pz.w[sel] && g[sel] !== pz.sol[sel] ? sel : -1;
      if (i < 0) { const c = []; g.forEach((v, k) => { if (pz.w[k] && v !== pz.sol[k]) c.push(k); }); if (!c.length) return; i = pick(c); }
      sel = i; g[i] = pz.sol[i]; gave = true; paint(); save(); checkWin();
    };
    $('#chk', root).onclick = () => {
      if (busy || done || !pz) return;
      wrong = new Set(); g.forEach((v, i) => { if (pz.w[i] && v && v !== pz.sol[i]) wrong.add(i); });
      $('#msg', root).textContent = wrong.size ? wrong.size + ' wrong number' + (wrong.size > 1 ? 's' : '') + ' in red' : 'All entries so far are correct';
      paint(); T.to(() => { wrong = new Set(); if (pz) paint(); }, 2500);
    };
    $('#giveup', root).onclick = () => {
      if (busy || done || !pz) return;
      g = pz.sol.slice(); gave = true; done = true; clock.stop(); wrong = new Set(); paint(); $('#msg', root).textContent = 'Solution shown'; save();
    };
    onSeg(root, 'sz', (v) => { N = +v; gput(ID, { N }); fresh(); });
    $('#new', root).onclick = fresh;
    const s0 = sv.cur;
    if (s0 && s0.pz && s0.pz.N === N && Array.isArray(s0.pz.w) && Array.isArray(s0.pz.sol) && s0.pz.sol.length === N * N && Array.isArray(s0.pz.a) && Array.isArray(s0.pz.given)) load(s0.pz, s0.g, s0.secs || 0, s0.done, s0.gave);
    else fresh();
    return () => { if (pz && !done) save(); T.stop(); };
  });

/* =====================================================================
   5. Futoshiki
   ===================================================================== */
/* LOGIC-START */
/* Count solutions (limit). p = { n, given: [n*n of 0 or digit], ineq: [[a, b], ...] meaning cell a < cell b }. */
L.futSolve = function (p, limit, maxNodes) {
  const n = p.n, N = n * n, g = Array(N).fill(0), sols = [], rowU = Array(n).fill(0), colU = Array(n).fill(0);
  const cons = Array.from({ length: N }, () => []);
  p.ineq.forEach(([a, b]) => { cons[a].push([b, 1]); cons[b].push([a, -1]); }); /* [other, +1: this < other, -1: this > other] */
  let count = 0, nodes = 0;
  function go(i) {
    if (count >= limit || nodes > (maxNodes || 1e12)) return;
    nodes++;
    if (i === N) { count++; sols.push(g.slice()); return; }
    const r = (i / n) | 0, c = i % n, fixed = p.given[i];
    for (let v = fixed || 1; v <= (fixed || n); v++) {
      if ((rowU[r] | colU[c]) >> v & 1) continue;
      let ok = true;
      for (const [o, s] of cons[i]) { const w = g[o]; if (w && (s > 0 ? !(v < w) : !(v > w))) { ok = false; break; } }
      if (!ok) continue;
      g[i] = v; rowU[r] |= 1 << v; colU[c] |= 1 << v;
      go(i + 1);
      g[i] = 0; rowU[r] &= ~(1 << v); colU[c] &= ~(1 << v);
      if (count >= limit) return;
    }
  }
  go(0);
  return { count, sols, aborted: nodes > (maxNodes || 1e12) };
};
/* Generate: { n, sol, given, ineq } with exactly one solution. */
L.futGen = function (n) {
  const sol = L.latin(n), N = n * n, all = [];
  for (let i = 0; i < N; i++) {
    if (i % n < n - 1) all.push(sol[i] < sol[i + 1] ? [i, i + 1] : [i + 1, i]);
    if (i + n < N) all.push(sol[i] < sol[i + n] ? [i, i + n] : [i + n, i]);
  }
  const given = Array(N).fill(0);
  let ineq = all.slice();
  /* make it unique by adding givens where several solutions remain */
  for (let guard = 0; guard < N; guard++) {
    const r = L.futSolve({ n, given, ineq }, 2);
    if (r.count === 1) break;
    const alt = r.sols.find((s) => s.some((v, i) => v !== sol[i])) || r.sols[0], diff = [];
    alt.forEach((v, i) => { if (v !== sol[i]) diff.push(i); });
    if (!diff.length) break;
    const c = pick(diff); given[c] = sol[c];
  }
  const keep = Math.round(N * 0.85);
  /* thin out: first drop givens, then inequality signs while the solution stays unique */
  for (const i of shuffle([...Array(N).keys()])) {
    if (!given[i]) continue;
    const v = given[i]; given[i] = 0;
    const rr = L.futSolve({ n, given, ineq }, 2, 20000);
    if (rr.aborted || rr.count !== 1) given[i] = v;
  }
  for (const k of shuffle(ineq.map((_, i) => i))) {
    if (ineq.length <= keep) break;
    const next = ineq.filter((_, i) => i !== k);
    const rr = L.futSolve({ n, given, ineq: next }, 2, 20000);
    if (!rr.aborted && rr.count === 1) ineq = next;
  }
  return L.futSolve({ n, given, ineq }, 2).count === 1 ? { n, sol, given, ineq } : null;
};
/* Cells with repeats plus the indexes of violated inequalities. */
L.futConflicts = function (p, g) {
  const cells = L.latinConflicts(p.n, g), ineqs = new Set();
  p.ineq.forEach(([a, b], k) => { if (g[a] && g[b] && !(g[a] < g[b])) { ineqs.add(k); cells.add(a); cells.add(b); } });
  return { cells, ineqs };
};
/* LOGIC-END */

reg('futoshiki', 'Futoshiki', '🔻', 'Latin-square puzzle with greater-than and less-than signs between cells: fill 1 to N with no repeats in a row or column. 4x4 to 6x6, unique solutions.',
  ['futoshiki', 'inequality', 'greater', 'less', 'puzzle'], function (el) {
    const T = tracker(), ID = 'futoshiki';
    const sv = gget(ID);
    let n = [4, 5, 6].includes(sv.n) ? sv.n : 4, pz = null, g = [], notes = [], sel = -1, pencil = false, done = false, gave = false, wrong = new Set(), busy = false;
    const root = mount(el, `
      ${seg('sz', [[4, '4×4'], [5, '5×5'], [6, '6×6']], n)}
      <div class="stats">${stat('tm', 'Time', '0:00')}${stat('bs', 'Best', '–')}</div>
      <div id="bd" class="bd" role="grid" aria-label="Futoshiki grid"></div>
      <div class="msg" id="msg"></div>
      <div id="pad" class="pad"></div>
      <div class="acts"><button class="btn alt" id="pen" aria-pressed="false">✏️ Notes off</button><button class="btn alt" id="hint">💡 Hint</button><button class="btn alt" id="chk">✔ Check</button></div>
      <div class="acts"><button class="btn alt" id="giveup">🏳 Show solution</button><button class="btn" id="new">New puzzle</button></div>`);
    const clock = makeClock(T, $('#tm', root)), bd = $('#bd', root);
    const bestStr = () => { const b = getBest(ID, 'n' + n); return b ? fmtT(b) : '–'; };
    const GAP = 16, cs = () => Math.min(48, Math.floor((326 - (n - 1) * GAP) / n));
    function save() { gput(ID, { n, cur: pz ? { pz, g, notes, secs: clock.secs(), done, gave } : null }); }
    function paint() {
      const s = cs(), cf = L.futConflicts(pz, g), sv0 = sel >= 0 ? g[sel] : 0;
      bd.style.gridTemplateColumns = Array.from({ length: 2 * n - 1 }, (_, i) => (i % 2 ? GAP + 'px' : s + 'px')).join(' ');
      const link = {}; pz.ineq.forEach(([a, b], k) => { link[a + ',' + b] = [k, 1]; link[b + ',' + a] = [k, -1]; });
      let h = '';
      for (let R = 0; R < 2 * n - 1; R++) for (let C = 0; C < 2 * n - 1; C++) {
        const r = R >> 1, c = C >> 1;
        if (R % 2 === 0 && C % 2 === 0) {
          const i = r * n + c, given = pz.given[i], isBad = cf.cells.has(i) || wrong.has(i);
          const bg = i === sel ? bgSel : isBad ? bgBad : sv0 && g[i] === sv0 ? 'color-mix(in srgb,var(--accent) 14%,var(--surface))' : 'var(--surface)';
          let body = '';
          if (g[i]) body = '<span style="font-size:' + Math.round(s * 0.5) + 'px;font-weight:' + (given ? 800 : 700) + ';color:' + (isBad ? 'var(--danger)' : given ? 'var(--text)' : 'var(--accent)') + '">' + g[i] + '</span>';
          else if (notes[i]) { let t = ''; for (let v = 1; v <= n; v++) t += (notes[i] >> v & 1) ? v : ' '; body = '<span style="font-size:10px;letter-spacing:1px;color:var(--muted);white-space:pre-wrap;line-height:1.1;text-align:center">' + t + '</span>'; }
          h += '<button data-i="' + i + '" role="gridcell" aria-label="Row ' + (r + 1) + ' column ' + (c + 1) + (g[i] ? ' value ' + g[i] : '') + (given ? ' given' : '') + '" style="display:flex;align-items:center;justify-content:center;width:' + s + 'px;height:' + s + 'px;background:' + bg + ';border:2px solid ' + (given ? 'var(--text)' : 'var(--line)') + ';border-radius:8px">' + body + '</button>';
        } else if (R % 2 === 0) { /* between two cells in a row */
          const a = r * n + c, b = a + 1, l = link[a + ',' + b];
          h += '<div style="display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:' + (l && cf.ineqs.has(l[0]) ? 'var(--danger)' : 'var(--text)') + '">' + (l ? (l[1] > 0 ? '&lt;' : '&gt;') : '') + '</div>';
        } else if (C % 2 === 0) { /* between two cells in a column */
          const a = r * n + c, b = a + n, l = link[a + ',' + b];
          h += '<div style="display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;line-height:1;color:' + (l && cf.ineqs.has(l[0]) ? 'var(--danger)' : 'var(--text)') + '">' + (l ? (l[1] > 0 ? '∧' : '∨') : '') + '</div>';
        } else h += '<div></div>';
      }
      bd.innerHTML = h;
    }
    function buildPad() {
      let h = ''; for (let v = 1; v <= n; v++) h += '<button data-v="' + v + '">' + v + '</button>';
      h += '<button data-v="0" aria-label="Erase">⌫</button>';
      const p = $('#pad', root); p.style.gridTemplateColumns = 'repeat(' + (n + 1) + ',1fr)'; p.innerHTML = h;
    }
    function load(p, gg, nn, secs, d, gv) {
      pz = p; n = p.n; g = gg && gg.length === n * n ? gg.slice() : p.given.slice(); notes = nn && nn.length === n * n ? nn.slice() : Array(n * n).fill(0);
      sel = -1; done = !!d; gave = !!gv; wrong = new Set(); busy = false;
      $$('#sz button', root).forEach((b) => { const on = +b.dataset.v === n; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
      $('#msg', root).textContent = done ? (gave ? 'Solution shown' : '🎉 Solved') : ''; $('#bs', root).textContent = bestStr();
      buildPad(); paint(); if (done) clock.stop(); else clock.start(secs);
      if (!done) save();
    }
    function fresh() {
      if (busy) return; busy = true; $('#msg', root).textContent = 'Making a puzzle…'; clock.stop();
      T.to(() => { const p = L.futGen(n); busy = false; if (p) load(p, null, null, 0, false, false); else $('#msg', root).textContent = 'Could not make a puzzle, tap New'; }, 30);
    }
    function checkWin() {
      if (done || !g.every(Boolean)) return;
      if (g.every((v, i) => v === pz.sol[i])) {
        done = true; const s = clock.stop(), nb = !gave && recBest(ID, 'n' + n, s, true); $('#bs', root).textContent = bestStr();
        $('#msg', root).textContent = '🎉 Solved in ' + fmtT(s) + (nb ? ' (new best!)' : ''); buzz(80); save();
      } else $('#msg', root).textContent = 'Not quite: look for red cells and signs';
    }
    function setVal(v) {
      if (busy || done || sel < 0 || pz.given[sel]) return;
      wrong = new Set();
      if (v === 0) { g[sel] = 0; notes[sel] = 0; }
      else if (pencil) { if (!g[sel]) notes[sel] ^= 1 << v; }
      else { g[sel] = v; notes[sel] = 0; }
      paint(); save(); checkWin();
    }
    bd.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; sel = +b.dataset.i; paint(); };
    $('#pad', root).onclick = (e) => { const b = e.target.closest('button'); if (b) setVal(+b.dataset.v); };
    T.on(window, 'keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName || ''))) return;
      if (/^[0-9]$/.test(e.key) && +e.key <= n) setVal(+e.key); else if (e.key === 'Backspace' || e.key === 'Delete') setVal(0);
    });
    $('#pen', root).onclick = (e) => { pencil = !pencil; e.currentTarget.textContent = pencil ? '✏️ Notes on' : '✏️ Notes off'; e.currentTarget.setAttribute('aria-pressed', String(pencil)); };
    $('#hint', root).onclick = () => {
      if (busy || done || !pz) return;
      let i = sel >= 0 && g[sel] !== pz.sol[sel] ? sel : -1;
      if (i < 0) { const c = g.map((v, k) => (v !== pz.sol[k] ? k : -1)).filter((k) => k >= 0); if (!c.length) return; i = pick(c); }
      sel = i; g[i] = pz.sol[i]; notes[i] = 0; gave = true; paint(); save(); checkWin();
    };
    $('#chk', root).onclick = () => {
      if (busy || done || !pz) return;
      wrong = new Set(); g.forEach((v, i) => { if (v && v !== pz.sol[i]) wrong.add(i); });
      $('#msg', root).textContent = wrong.size ? wrong.size + ' wrong number' + (wrong.size > 1 ? 's' : '') + ' in red' : 'All entries so far are correct';
      paint(); T.to(() => { wrong = new Set(); if (pz) paint(); }, 2500);
    };
    $('#giveup', root).onclick = () => {
      if (busy || done || !pz) return;
      g = pz.sol.slice(); notes = Array(n * n).fill(0); gave = true; done = true; clock.stop(); wrong = new Set(); paint(); $('#msg', root).textContent = 'Solution shown'; save();
    };
    onSeg(root, 'sz', (v) => { n = +v; gput(ID, { n }); fresh(); });
    $('#new', root).onclick = fresh;
    const s0 = sv.cur;
    if (s0 && s0.pz && s0.pz.n === n && Array.isArray(s0.pz.ineq) && Array.isArray(s0.pz.sol) && s0.pz.sol.length === n * n && Array.isArray(s0.pz.given)) load(s0.pz, s0.g, s0.notes, s0.secs || 0, s0.done, s0.gave);
    else fresh();
    return () => { if (pz && !done) save(); T.stop(); };
  });

/* =====================================================================
   6. Killer Sudoku
   ===================================================================== */
/* LOGIC-START */
/* A Killer Sudoku puzzle p = { sol: [81 digits], cageOf: [81 cage numbers], cages: [{ cells, sum }] }. Only the cages are shown to the player. */
L.ksFromMap = function (sol, cageOf) {
  const cages = [];
  cageOf.forEach((k, i) => { (cages[k] = cages[k] || { cells: [], sum: 0 }).cells.push(i); });
  cages.forEach((c) => { c.sum = c.cells.reduce((a, i) => a + sol[i], 0); });
  return { sol: sol.slice(), cageOf: cageOf.slice(), cages };
};
const KS_CH = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
/* Compact text form: 81 solution digits followed by 81 cage characters. */
L.ksEncode = (p) => p.sol.join('') + p.cageOf.map((k) => KS_CH[k]).join('');
L.ksDecode = (s) => L.ksFromMap(s.slice(0, 81).split('').map(Number), s.slice(81, 162).split('').map((ch) => KS_CH.indexOf(ch)));
/* Rotate / reflect the whole board: k = 0..7. The rules (and the cage sums) are unchanged by these moves. */
L.ksTransform = function (p, k) {
  const sol = Array(81), cageOf = Array(81);
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    let rr = r, cc = c;
    if (k & 1) { const t = rr; rr = cc; cc = t; }
    if (k & 2) rr = 8 - rr;
    if (k & 4) cc = 8 - cc;
    sol[rr * 9 + cc] = p.sol[r * 9 + c]; cageOf[rr * 9 + cc] = p.cageOf[r * 9 + c];
  }
  /* renumber cages by first cell so the label cell stays top-left */
  const map = {}; let next = 0; cageOf.forEach((x, i) => { if (!(x in map)) map[x] = next++; cageOf[i] = map[x]; });
  return L.ksFromMap(sol, cageOf);
};
const ksBox = (i) => ((((i / 9) | 0) / 3) | 0) * 3 + (((i % 9) / 3) | 0);
/* Count solutions of a killer puzzle (cages with sums, no givens). Returns { count, sols, aborted }. */
L.ksSolve = function (cages, limit, maxNodes) {
  const cageOf = Array(81); cages.forEach((c, k) => c.cells.forEach((i) => { cageOf[i] = k; }));
  const rows = Array(9).fill(0), cols = Array(9).fill(0), boxes = Array(9).fill(0);
  const cu = cages.map(() => 0), crem = cages.map((c) => c.sum), cleft = cages.map((c) => c.cells.length);
  const g = Array(81).fill(0), sols = []; let count = 0, nodes = 0, aborted = false;
  const fits = (k, v) => {
    const rem = crem[k] - v, left = cleft[k] - 1, used = cu[k] | (1 << v);
    if (left === 0) return rem === 0;
    let lo = 0, hi = 0, c = 0;
    for (let d = 1; d <= 9 && c < left; d++) if (!(used >> d & 1)) { lo += d; c++; }
    if (c < left || rem < lo) return false;
    c = 0; for (let d = 9; d >= 1 && c < left; d--) if (!(used >> d & 1)) { hi += d; c++; }
    return rem <= hi;
  };
  const cand = (i) => {
    const m = ~(rows[(i / 9) | 0] | cols[i % 9] | boxes[ksBox(i)] | cu[cageOf[i]]) & 0x3FE; let out = 0;
    for (let v = 1; v <= 9; v++) if ((m >> v & 1) && fits(cageOf[i], v)) out |= 1 << v;
    return out;
  };
  const pc = (m) => { let n = 0; while (m) { m &= m - 1; n++; } return n; };
  let open = 81;
  function go() {
    if (aborted || count >= limit) return;
    if (!open) { count++; sols.push(g.slice()); return; }
    if (++nodes > (maxNodes || 1e12)) { aborted = true; return; }
    let bi = -1, bm = 0, bn = 99;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const m = cand(i), n = pc(m);
      if (n < bn) { bn = n; bi = i; bm = m; if (n <= 1) break; }
    }
    if (bn === 0) return;
    const r = (bi / 9) | 0, c = bi % 9, b = ksBox(bi), k = cageOf[bi];
    open--;
    for (let v = 1; v <= 9; v++) {
      if (!(bm >> v & 1)) continue;
      g[bi] = v; rows[r] |= 1 << v; cols[c] |= 1 << v; boxes[b] |= 1 << v; cu[k] |= 1 << v; crem[k] -= v; cleft[k]--;
      go();
      g[bi] = 0; rows[r] &= ~(1 << v); cols[c] &= ~(1 << v); boxes[b] &= ~(1 << v); cu[k] &= ~(1 << v); crem[k] += v; cleft[k]++;
      if (aborted || count >= limit) break;
    }
    open++;
  }
  go();
  return { count, sols, aborted };
};
/* Random complete Sudoku grid. */
L.ksGrid = function () {
  const g = Array(81).fill(0), rows = Array(9).fill(0), cols = Array(9).fill(0), boxes = Array(9).fill(0);
  function go(i) {
    if (i === 81) return true;
    const r = (i / 9) | 0, c = i % 9, b = ksBox(i);
    for (const v of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      if ((rows[r] | cols[c] | boxes[b]) >> v & 1) continue;
      g[i] = v; rows[r] |= 1 << v; cols[c] |= 1 << v; boxes[b] |= 1 << v;
      if (go(i + 1)) return true;
      rows[r] &= ~(1 << v); cols[c] &= ~(1 << v); boxes[b] &= ~(1 << v);
    }
    g[i] = 0; return false;
  }
  go(0);
  return g;
};
/* Random cages (connected, no repeated digit inside a cage, size 1..4 or so) as a cageOf array. */
L.ksPartition = function (sol, maxSize) {
  const cageOf = Array(81).fill(-1); let k = 0;
  for (const s of shuffle([...Array(81).keys()])) {
    if (cageOf[s] >= 0) continue;
    const x = Math.random(), want = x < 0.1 ? 2 : x < 0.55 ? 3 : maxSize, cells = [s], digits = new Set([sol[s]]);
    cageOf[s] = k;
    while (cells.length < want) {
      const opts = []; cells.forEach((c) => L.nbrs(9, c).forEach((d) => { if (cageOf[d] < 0 && !digits.has(sol[d])) opts.push(d); }));
      if (!opts.length) break;
      const d = pick(opts); cageOf[d] = k; cells.push(d); digits.add(sol[d]);
    }
    k++;
  }
  return cageOf;
};
/* Make one puzzle with a unique solution (maybe a few single-cell cages). Returns p or null if it takes too long. */
L.ksGen = function (maxSize, maxNodes) {
  const sol = L.ksGrid();
  let cageOf = L.ksPartition(sol, maxSize || 4);
  for (let guard = 0; guard < 120; guard++) {
    const p = L.ksFromMap(sol, cageOf), r = L.ksSolve(p.cages, 2, maxNodes || 200000);
    if (r.aborted) return null;
    if (r.count === 1) return p;
    const alt = r.sols.find((s) => s.some((v, i) => v !== sol[i])) || r.sols[0], diff = [];
    alt.forEach((v, i) => { if (v !== sol[i]) diff.push(i); });
    /* split the cage holding one of the differing cells into smaller connected cages */
    const cell = pick(diff), host = cageOf[cell], cells = p.cages[host].cells;
    let top = Math.max(...cageOf) + 1;
    if (cells.length === 1) continue;
    const rest = cells.filter((c) => c !== cell);
    cageOf[cell] = top++;
    const comps = L.components(9, rest);
    comps.forEach((comp, j) => { if (j > 0) { const id = top++; comp.forEach((c) => { cageOf[c] = id; }); } });
    const map = {}; let next = 0; cageOf = cageOf.map((x) => { if (!(x in map)) map[x] = next++; return map[x]; });
  }
  return null;
};
/* Rule check of a puzzle: valid grid, connected cages with no repeated digit, sums right. */
L.ksValid = function (p) {
  if (!p || p.sol.length !== 81 || p.cageOf.length !== 81) return false;
  for (let a = 0; a < 9; a++) {
    const r = new Set(), c = new Set(), b = new Set();
    for (let k = 0; k < 9; k++) { r.add(p.sol[a * 9 + k]); c.add(p.sol[k * 9 + a]); b.add(p.sol[(((a / 3) | 0) * 3 + ((k / 3) | 0)) * 9 + (a % 3) * 3 + (k % 3)]); }
    if (r.size !== 9 || c.size !== 9 || b.size !== 9 || p.sol.some((v) => v < 1 || v > 9)) return false;
  }
  const total = p.cages.reduce((a, c) => a + c.cells.length, 0);
  if (total !== 81) return false;
  return p.cages.every((c) => c && c.cells.length > 0 && L.components(9, c.cells).length === 1 && new Set(c.cells.map((i) => p.sol[i])).size === c.cells.length && c.cells.reduce((a, i) => a + p.sol[i], 0) === c.sum);
};
/* Cells to mark red: repeats in a row, column, box or cage, and finished cages with the wrong sum. */
L.ksConflicts = function (p, g) {
  const bad = new Set(), groups = [];
  for (let a = 0; a < 9; a++) {
    const row = [], col = [], box = [];
    for (let k = 0; k < 9; k++) { row.push(a * 9 + k); col.push(k * 9 + a); box.push((((a / 3) | 0) * 3 + ((k / 3) | 0)) * 9 + (a % 3) * 3 + (k % 3)); }
    groups.push(row, col, box);
  }
  p.cages.forEach((c) => groups.push(c.cells));
  groups.forEach((cells) => {
    const seen = {}; cells.forEach((i) => { if (g[i]) (seen[g[i]] = seen[g[i]] || []).push(i); });
    Object.values(seen).forEach((l) => { if (l.length > 1) l.forEach((i) => bad.add(i)); });
  });
  p.cages.forEach((c) => { if (c.cells.every((i) => g[i]) && c.cells.reduce((a, i) => a + g[i], 0) !== c.sum) c.cells.forEach((i) => bad.add(i)); });
  return bad;
};
/* LOGIC-END */

/* Pre-verified puzzles (81 solution digits + 81 cage ids each). Generated offline with L.ksGen; tests/games6.test.js re-checks that every one has exactly one solution. */
/* LOGIC-START */
L.KS_BANK = {
  easy: [
    '4871256395319687249267431582934518671486723957658394123742965816125849738593172460011112234556672289556AAAB89CCDDDABB9CEFFFGBHIIJKFLMMMNJJOOPPQQNRRSOPPTQNURSOVVVW',
    '93548126764175289327836915451364792878259364149612873512497538636981457285723641901122344451627789A666B7CDDAEFFGGDDHIJKFGLLMIIJJJGNLMIOPPPNNQROOSSPNTTRUOSVVVWWRUU',
    '3582497617621835949146752388213974565934168274768529132397681451859346726475213890123345671122344678829AAAAB8CD9EFGHBICC9JGGHBIKJJJLMMNIOPPLLQMNRSTUUUQVNRWWWUXQVV',
    '419725863783619542526348197392164785864537921175892634257983416931456278648271359001112223445552333677859ABC66D8EAABBFGG8HHABIFGGJHHKKIFLMJNOKKPFQRRSOOTPQQUUVWTTP',
    '417295638283647195965831274176324859592178346834569721649712583328456917751983462001223456011227866991ABCCC6D9EAACFGHDEEIAJFFHDDKILJJMNOPPIQQJMNPPRRSQTMNUUURSQVWW',
    '821765394563489271947231865194358726258176943376924158782543619615897432439612587011233455002223657089ABC66788AADDDEF8GHIJDFFFGGGIKLLMNOPPKKKLMMOPPQQRRMSOTTTTRUUV',
    '829536174563174289741829536397451862654982317218367495176243958435798621982615743011223344051666377859AAB3CC899AABDDE88FGHIJDEKKKLMMNDEOPQRSMNNNOOTUUUVWWXYYYYVVWW',
    '9642315877239854168157463924968721355721938641385647292416589736573192483894276510011222234511678334449AB8CCDDEAAF8GCDDHAIFJGKLMHHIIJGNLLOPQQRSNTLOPUQSSNTTOOUUSVV',
    '736894251528761394194235687472153869653489712819627435281946573347518926965372148001122344506177899AA66BBCCCDEFFFGGHIDJKKKLGIIDJMNNLOOPQJMNNROOSQQMTURRSSQVVWWWWXS',
    '4679813253826751945914327688162935472457189367395642819731468521548296736283574190001223445611783445619A833B5999ACDDEFGGHADDEEIIIJJKLMMNNOPJLLQMRRSPPPTUUVVVWWWXXX',
    '48936512772149856335617248921358697469524783184791365217265439853482971696873124501233456678893456A78BCC45DD77BCCEEEDFFGGGHHIJKKLGMMHJJKNOPPMHQJRROOSSTQQRUVVVSTTT',
    '176543892398261745254987316829435671541876923763129458617354289932718564485692137012234455012667895A126BB895ACDDBEE9FACDDGHIIFJCCKGLLIFJJMNOOLIPQJNNORLSPQQTUVRRRP',
    '798364215531278496624195837169837542382546179457921683846759321275413968913682754001234455067889A5BCDDE99FFBCGEEEFFBBGGHHIIIJKLGMMMMJJNOOOOPQRJNSSTPPQUUNSTTTPQQVV',
    '5279613488397546121648237594925168737582391643164789252413975869756824316831452970112334550116734859AA6B388C9AA6BD8EE99FFBGHHEIIJFGGHKELIMNOOHKKLMMNPOQRSTTPPPUUUV',
    '42697853179143526858361294797256318463819472514582769331978645225734981686425137900112334506622234577889944577889ABBCDEEFAAAGHDEEFFIJJKLMNOPPJQQRRRSTPUQQVVRWWUUUX',
    '68354219791538762424719685349283571657642138913876924572165493836491857285927346101233456607884459600A8B9996CCCCDEEFGHHIDDEJFGHHKKDJJLGMMKKNOOPGQRSSNTTUVWRRSSTXXV',
    '6825173495378492614913627857192845363461958728256731949734516282589364171647289530011233440551234467899A3BB67C9DDEBB67C9DFFFGH7CIIJKGGLMMINNKOPQMRINNKSPPTRRUUUSSP',
    '3874165295143296786927581431396742852685317947459823618562439174231978569718654320011122234555677334889AA7B348C9DAEBF48G9HHBBFIIGJHHKKFLIMJJNKOPQRMSSSTPPQQMSUUUVP',
    '16478392557291468338965241745327189672659834191834657264582713929143576883716925401223456671133859977AA8859BCCADD85EEFFFDGHEEIJJJKGLLLIMMKKGNNLOMMPQQRRROSTUQVWWXX',
    '319426857524387196876951432961538724452769318783214965198642573237895641645173289011122344015666334078899AAB0778CAADDEF7GCCHHDIJKLMMMMDINNLOPQQQRSNLOPPTTRRULOOVTT',
    '2897153463649827151756432987418965325361249879285374616534781298123596744972618530111223445678923A45577BBCA4DDDEBFAAGDHIJJKKLGHHIJKKMNNOPIIMMMNQRPPSTUVVQRRWTTTVXQ',
    '2584137966495273811376985247912864355827346193649518724168792539753621488231459670123444550633789AA0BCC779AADBCCE79FFDGGGGHHFFIJJKKKHLMNNOPPQRSMNNOOTQSSMUUVOWXXSM',
    '14392568786743125925968713463489271578156349259271436897634852141825697332517984600011233345116273849AA677BB49CA6DEEB99CCFFGHIJKLLFFMNOJKLLPPQQRJSTUVPPWRXXXUUYWWW',
    '213975468985264371647813952738129645461758239592436187874691523329547816156382794EEE166FFGPE1116UFFIIJLLLLS4IIJHHHH443T7OBBB453377NBM55CKK0999D5CQ0028888CQ222RAAA',
    '931456827258739614764281395379825146842617539516943278687392451425178963193564782000012233445552666445788899AB77CDEEFAGG7HIEJFAGKLMINOPQQKMMRNPPQQKMSSTUUVVWSSTTUU',
    '1874639256429758135392816473251467988715294364968372512637145899146583727583921640122234440156738880559A3BCDEEFAAGHCCIEEJJKHHLIMJJKKNOLIMPQQNNRSITPUVVWWXTTTUYYWXX',
    '428963751691572438537841296146759823752138964983426175374215689815697342269384517001123456077183559AB7883C99AB7D8ECF9ABGGGEHHIABJJKKHIILLLMNNOOPLQRMNSOTURRRMVSSUU',
    '579682431421359768638417259957241386362895147814736925746128593193564872285973614001123334506667888509677AA8BBBCCCADEBFFGGGHHIJJJGKKLLMJNNOPPLQQRSNOOPTUQRRNVVWUUQ'
  ],
  med: [
    '1926537847581249633468971259312468576245783195879312464753126982697854318134695720011223330014445667889A55BB78C9AA5DB7EEEFAGDB7HEFFGGDIJHKLMNGOIJPPLNNQRIJSSSTTRRU',
    '94167582335698217482743169549285736118526394767314925823459871651872643976931458200112234405555264407889A666B7899CDEEF7GGHCCIEFFGGHJJKKLLLLMNNNKOOPPPQNRSOTTPUUUSS',
    '16372984578964523152418396767291435884153769293526817425739148649685271331847652901223445506223377706883997ABBB8CDDEAFFGGCCHEAFFIIJHHEEKKIILMMNNKKOOPPQRNSTTTUUQQV',
    '52196834779321486584635712991574268323819675446758329138967541217482953665243197888FFFLLLL88FIDDD11SMCIIQQQ1MMCCK00BBNNCOKK055H6P944E5AH69944222H697777RGH6333JJGG',
    '157462893836951742249837156978625314415783269623149578794318625581296437362574981000122345607112855977AA2B5C997DEEBFCGHIDEJJFCGIIKLLLFMGIKKLNNFOPQRRRSTTOQQUUUSTTV',
    '14273956865324871978956143223581469796437218581795632437862594159148327642619785301112345500067344899A6733B8C9D6EEEFFGHDIIEFFJGKLLIMMMJGNLLOOPQQRNNSSOPTTUUUSSOPTT',
    '824615937537928146916734852682573491341869275795241368468352719159487623273196584001223334511263774888666977AAAABCCDEFGGHHCCDIFFJKHHLDIMMNKOOLLIPPNKQRSSTUPNVQQSST',
    '56938714231842975624761583947195628395283167483627459169574231812359846778416392500112223340156278349AA6B883499A668CDEEEFFFCCDGGGHIJJJDKLMMIIINOPQMRRSSOOPQMRTSSUU',
    '754216389936485721812379654583167492249853167167942835425738916678591243391624578001112233456677288449677AAA4B96CDEEABBFCCDGGHIBFJKKGHHIFFJLKMNHOOPQRSSNTOOQQRUVVW',
    '79642518345398172618236754936529841781967423527451396894713685253874269162185937400111223304415523366475589A6BCCDD89AEFCCGH88AEFFIIIIJKELMMNNOPKQQMRNOOPKSSRRRTOPK',
    '762945318538621947914873562856439271123587496497216853381754629249168735675392184012234444055236678095ABC77DE9FABBGGDEHIJBKGDDELJJMMNOOPLJQMNNROPPSQTTNUVWWSQTXXUV',
    '36498571295247138671836245968359724124561893719723486557684912342175369883912657400111222345566788399AB67C8399AACCCD3EFFAGHDDIJKKLGHMMIJJKLGHHMINOPLQRSTTUVVVRRSST',
    '61379482582415637979528314618296745356934128743782596125163879497641253834857961200122345678112344978812AABB7CDDDDEEBFFFGGHHEBIFJKGLHHMNNJJJLLOONPPQQQQROSSSTTRRRU',
    '9576132843489521676217849538791654321643287955324978167835416294162395782958763410112334567188395567AA8BCDE67AFGGCDEEHHFGIIDEJHHKLLLLJJMMKNOOPQQMNNNORSSQMTTTOSSUU',
    '68731254914265983735974861247658129351829347692347618586513792479482536123196475800011222345067899345ABC89334AABB8DDDEEAFGHHIDEJKFGLHIMEJKFGLNIOPJKKGLQROPJSSSSRRT',
    '4516978232398145676875234199124653787439816525683729413257481968761592341942367850112333440155637740885699940AABBBB9CAADEFGGCCHDDIFFGJJKDLIIIMNNKOPQQMMRSTTPQQURRS',
    '597264381126983754843517296235691478789342615614875923472138569958426137361759842Q86666DDR88II2VJJRM8LL22JS5CC1111N45CAAAT0044KHP33UU47EHPP3BB77EHFF39BG7EHFF99OGG',
    '593178462681294537247365189935417628824639751716852394172586943368941275459723816011223444015673389A5567B999AAC67DEFFGGCHHDEEIGJCKHDIIILMMMMNNOOPPQRRNNOSTTQRRUVWS',
    '643798152592164837718253694456871329829536471371429586965347218284915763137682945011223345116223445788893ABB778C99DEF7GGG9HHHFIIJJKKKLMIINOOLLLMPPNNOOQQRPPSNTQQRR',
    '869217435572483961314659782295831647143576298786924153638192574951748326427365819012334456007338455099AA88BC99DDAAEECFGHIIJEECFGHKKKKLMGGHHNOOMMPPNNNQRRSPTUUQQRRS',
    '67154982349278315635862174973941628584593267121687539498315746252736491816429853777II200MM77I220SMMEJINN1113EAAAADD13EEFFFHL3399998HHOORCCC84QOB5556644BBK5PP66GGG',
    '1983524762639741854756819235324978617412683599865132478197265343578496126241357980012223330411255678491AA667BBBCDDEE7FBGGHHIEJFKKLLHHMNOOOOLPQMRSTUPPPVMRSUUUVVVRR',
    '5128376948641927357934568213896215474573891626215743892387459169762134581459682730001234456071834456991A3BB569CDAAEBFGHDDEEEFFIJKLLMMNFIIKOLMMNNPPQOORRRSPPQQOTTTS',
    '389671245752834961146592738264358179517269384893417652931745826625183497478926513001123445667133455689AABCCD6E9AFFCGDHH99FIJJDKLLLIIMJDNOOOIMMPQNRRRSTTPQNNRSSSTQQ',
    '3762851942493617588159476237841569326534298719218735464985123671376942855627384190122345550026445778996AAAA7B996CDDEEBFFGGHDDEBFIGGJKKKLLLJJJKMMNNNNOOPMQRSSSOOPQQ',
    '413962785259817634678345219527481396391576842864239571986123457132754968745698123PPHHHB33FIIIBBBC3F000Q77CSF2OOA77C112OAATNNN1299DDDDG12M8888LGJ445E6RLGJK455666GJ',
    '137298654958346172246571893794165328325489761861732549489617235612953487573824916001111223445666233745899AA3BC88DDDAEFFGGHDIIEFJJGKLIMENJJGKOOMMNPPPKQORRNNPSTTTRR',
    '156782934983461725724539186275893641348615297619247853462378519597124368831956472011222344015563377888569ABCDEEFG9AAHDIJKG9ALLIIJKM9NOOPPJJQQROOPSSSQRRTUVVVVQWTTU'
  ],
  hard: [
    '2798165344167358928359427617914236585846913276235781493621849759483572161572694830012234556112337859AAAA77759BBCCDDDE9BBCFFFDGHIIIJKGGGHLMIJKKNOPLMQQQNNOPLMRRRSST',
    '6832475197946518322159836744681792533594621871725384968473259615217963489368147259J3EE4MBB953EE4KKBQ53I64K0OQ5LD6660OC5LDHPNNNCCCDHHFFF77TTHRR1F77222G118AAAASGG18',
    '98175642323614978554782316969528437181453729672369185415836294736947851247291563800111223344441225678888995677ABCDD567AABBEFGHIAJJKKFLHMMJNNKFLHOMPPQKRLLOOPQQQRRR',
    '149836527528147396637529814814372965376915482295468173452791638963284751781653249DDDAALLLLDPFAQJJKEM7FFQQJKEM77666BKSIIC226BHHNIC211B3H8OC21133R8555000998GG444099',
    '8724356915691874234316297852573918461947683523862549179135462787289135646458721390001112223344556667784559AA7788BC9DAEFGBBCCDHIFGJJKDDHLLGGMKNNNLOPMMKQQNOOORMSSQQ',
    '72963845164895132731527486945312978618256793496748321527481659359634217883179564201222333300455678894455677A9BBB667AA99CCDEEAFGGHHDDIIFGGJKKLIIMNNJJOLLMMNPQOOORMS',
    '9726543186137284954581937621395862475674321898249715362458196733912678547863459210111222340556777348596AAA34BB96CDEEEFFFFCDDDGHHIICCGGGJJIKKLMNNOPQQKLRRNOOOSSTTRU',
    '618574293249813657537692184194385726385726419726149835852967341961438572473251968S5OOGGGCN55IHHHJCCM5II22JCEMM882119E333881L9E3RBFDDD9P0BB66669P00QQ7AAAPKKK777444',
    '269485731418763952753192468176349285824516397395827146532674819687931524941258673NNC5556P9NNCC06699GGG40069BGLL4KHHHBAL14KHFFBA11IK7QQQAO1I2777D88JI2M3DD8JJJ233EE',
    '48317569219586273467293451886735924131924687525478196392841735653169842774652318901223455500623475809633A7BBCDEEAAFBGCDEHHHFGGCDDIIIFJJCKLLMMMJNOOLPPQRJNOOSSSRRNN',
    '42179368539618527485762491357836142961495273823947815696581734274253689118324956700112233340155666740859AB774C8899BB74CCCDDEFFGGHIIDEEJGHHHKKLLMNNOPKQRLMSOOQQQRRM',
    '6295437814182679537539812649751246383618594722847361958964153271326785495473928160011112334055562234758869AA4BCC669DAEBBCFFGDDEBHHHGGIIEEJKKLIIMNNOPQQQRMSSOPPPRRM',
    '358627914712498635694315782931286457547139826826754193263941578175863249489572361000012233455516673448511973AA8BCCCDEFA8BGGGDEHHIBJKLLEMHIIJKNLLMMMJJKNOOPQQQRRNOO',
    '2975186343467291588513469721259348679736825416841753294682517937194632855328974160011122330456622734455667789AABCC7DD99BBEEDDFGHIIEJKKFLLIMNJKOFLPQMNJRRSLQQMNJRRS',
    '162438795573619482498752361649381257257946138831275946326897514714563829985124673012233445016738495AABCD899EBBBCDFFFEGGHCDIIJEGHHKKJJJELMHNOOOPPLQQNRRSTTLUQNRSSTT',
    '613298754275134689849576123392457816186329475457861932928745361561983247734612598LAN333I58AA7773I58EQ667FH58EE66RFH58DOOMMFF11DBBPMGG40DBBPKKG40D2229KK4CJJJJ9994C',
    '765412839423869175819735624932671458687524913154983267541396782376248591298157346001123344501677348509667AB85C99D7BB8ECCDDFGHHEIIJFFKKKLLIIFMNNOPLQRRMNNOPSSRTTTUU',
    '135798426894362157627154938476239815219685743358417269761923584983541672542876391O6H7777FFO6HH1122266AGG3N2K99A333NKK9AASJJN884445MMM884CQ5RMDDDICCPLLDEEII0000BBE',
    '8215437963751694284698273511524968736843759129372186457136542892489315675967821340001223440551126647851926ABC8DD99EBBCFFGGHEEBCFIJGHKLLCFJJJHKKMNNOOOPQRRSSSSPPQRR',
    '536721489491863275728549316965172834143958627287634591854217963612395748379486152CC455NNBBCC455SKKB0P4499KRD00II79EEDAAAA77EMD2QFFGG8MM211FGG88J261LHHO8J661LHH333',
    '628794351359281647471536298946827135835149726712653984193478562287965413564312879S22253E11SHH45331M99H44IFF69JH4II766JJBLC77TT8BBLCCOGG8RBLPPAAG8RKQ00DAGKKKQ0DDDN',
    '3158672949682451374723916855274389161945263788361794526519847232497538617836125497VVBBQQQT77CCCADDD7P339AAMMROOE9AGHHIIOEEEGGNI5S11F4NN55022F488K0026668JKKUU6LL8J',
    '984675321372981465615243879751394682493862517826517934249138756568729143137456298IIGGAJ00PLLGGAA0SPML355Q4DPMM35544DPHM33F4OOEHH2BFFOEEKK2BRF118K9CB77N6899CCC6668',
    '624715983378962145951843726796481352285639417143257698432178569867594231519326874R333222HHRCCCC9SIHDDFFJ99IKDBF5597IKQBB56677ELBPA667EELL8AAA444MG811140OMGGG1N00O',
    '938752614746198253125463987293645871581327496674981532352816749819274365467539128IIHHHPGGGIRR22P7JJ9CCM277JJ99TMAFFF8L1OOA6668L11OABSK8EN55QBBKKE433QD0KUE433DD000',
    '579483126386521947214976583965138472841752639732694815653847291128369754497215368001234556011734456887739ABC8DD799EECFFGHHIJJKFGGHIILJKMNNOOOLLKMPNQRSSTTPPNRRSUVV',
    '3542678912694813757815392645328746194189567236973124588467951321256439879731285460123444561123774551893A7BCCD88EF7BBGHIIEFJJGGHKKEELLMMHKKNOOLMPQQQNORSSPQTTNNRRSP',
    '932756841471382965586491327794518632315264789268973514653147298129835476847629153001222334511126633578996ABB55899AABCDE8FFGAHCDEIFJJJKKDEILMMNKKDOLLLMNPPQORRSSNPP'
  ]
};
/* LOGIC-END */

reg('killersudoku', 'Killer Sudoku', '🗡️', 'Sudoku with cages: digits inside a dashed cage must be different and add up to the small number in its corner. Unique solutions, three levels.',
  ['killer', 'sudoku', 'cages', 'sum', 'puzzle'], function (el) {
    const T = tracker(), ID = 'killersudoku';
    const sv = gget(ID), LV = { easy: 'Easy', med: 'Medium', hard: 'Hard' };
    let lvl = LV[sv.lvl] ? sv.lvl : 'easy', pz = null, g = [], notes = [], sel = -1, pencil = false, done = false, gave = false, wrong = new Set();
    const root = mount(el, `
      ${seg('lv', Object.keys(LV).map((k) => [k, LV[k]]), lvl)}
      <div class="stats">${stat('tm', 'Time', '0:00')}${stat('bs', 'Best', '–')}</div>
      <div id="bd" class="bd" style="grid-template-columns:repeat(9,36px);background:var(--surface)" role="grid" aria-label="Killer Sudoku grid"></div>
      <div class="msg" id="msg"></div>
      <div id="pad" class="pad" style="grid-template-columns:repeat(5,1fr)">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((v) => '<button data-v="' + v + '">' + v + '</button>').join('')}<button data-v="0" aria-label="Erase">⌫</button></div>
      <div class="acts"><button class="btn alt" id="pen" aria-pressed="false">✏️ Notes off</button><button class="btn alt" id="hint">💡 Hint</button><button class="btn alt" id="chk">✔ Check</button></div>
      <div class="acts"><button class="btn alt" id="giveup">🏳 Show solution</button><button class="btn" id="new">New puzzle</button></div>`);
    const clock = makeClock(T, $('#tm', root)), bd = $('#bd', root);
    const bestStr = () => { const b = getBest(ID, lvl); return b ? fmtT(b) : '–'; };
    function save() { gput(ID, { lvl, cur: pz ? { enc: L.ksEncode(pz), g, notes, secs: clock.secs(), done, gave } : null }); }
    function paint() {
      const bad = L.ksConflicts(pz, g), sv0 = sel >= 0 ? g[sel] : 0, own = pz.cageOf;
      const line = (a, b, thickBox) => (thickBox ? '2px solid var(--text)' : own[a] !== own[b] ? '1px dashed var(--accent)' : '1px solid transparent');
      let h = '';
      for (let i = 0; i < 81; i++) {
        const r = (i / 9) | 0, c = i % 9, cg = pz.cages[own[i]], isBad = bad.has(i) || wrong.has(i);
        const bg = i === sel ? bgSel : isBad ? bgBad : sv0 && g[i] === sv0 ? 'color-mix(in srgb,var(--accent) 14%,var(--surface))' : 'var(--surface)';
        const top = r === 0 ? '2px solid var(--text)' : line(i - 9, i, r % 3 === 0), left = c === 0 ? '2px solid var(--text)' : line(i - 1, i, c % 3 === 0);
        const bottom = r === 8 ? '2px solid var(--text)' : '0', right = c === 8 ? '2px solid var(--text)' : '0';
        let body = '';
        if (g[i]) body = '<span style="font-size:20px;font-weight:700;color:' + (isBad ? 'var(--danger)' : 'var(--accent)') + '">' + g[i] + '</span>';
        else if (notes[i]) { let t = ''; for (let v = 1; v <= 9; v++) t += '<i style="font-style:normal">' + ((notes[i] >> v & 1) ? v : '') + '</i>'; body = '<span style="display:grid;grid-template-columns:repeat(3,1fr);font-size:8px;line-height:1;color:var(--muted);width:24px;height:24px;margin-top:6px">' + t + '</span>'; }
        const label = cg.cells[0] === i ? '<span style="position:absolute;left:2px;top:0;font-size:9px;font-weight:700;line-height:1.1;color:var(--muted)">' + cg.sum + '</span>' : '';
        h += '<button data-i="' + i + '" role="gridcell" aria-label="Row ' + (r + 1) + ' column ' + (c + 1) + (g[i] ? ' value ' + g[i] : '') + ', cage sum ' + cg.sum + '" style="position:relative;display:flex;align-items:center;justify-content:center;width:36px;height:36px;background:' + bg + ';border-top:' + top + ';border-left:' + left + ';border-bottom:' + bottom + ';border-right:' + right + '">' + label + body + '</button>';
      }
      bd.innerHTML = h;
    }
    function load(p, gg, nn, secs, d, gv) {
      pz = p; g = gg && gg.length === 81 ? gg.slice() : Array(81).fill(0); notes = nn && nn.length === 81 ? nn.slice() : Array(81).fill(0);
      sel = -1; done = !!d; gave = !!gv; wrong = new Set();
      $$('#lv button', root).forEach((b) => { const on = b.dataset.v === lvl; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
      $('#msg', root).textContent = done ? (gave ? 'Solution shown' : '🎉 Solved') : ''; $('#bs', root).textContent = bestStr();
      paint(); if (done) clock.stop(); else clock.start(secs);
      if (!done) save();
    }
    function fresh() {
      const bank = L.KS_BANK[lvl], st = gget(ID);
      const seen = Array.isArray(st.seen) ? st.seen.filter((x) => typeof x === 'string') : [];
      let keep = seen, free = bank.map((_, i) => i).filter((i) => !seen.includes(lvl + ':' + i));
      if (!free.length) { keep = seen.filter((x) => x.indexOf(lvl + ':') !== 0); free = bank.map((_, i) => i); }
      const idx = pick(free);
      gput(ID, { seen: keep.concat(lvl + ':' + idx) });
      load(L.ksTransform(L.ksDecode(bank[idx]), rnd(8)), null, null, 0, false, false);
    }
    function checkWin() {
      if (done || !g.every(Boolean)) return;
      if (g.every((v, i) => v === pz.sol[i])) {
        done = true; const s = clock.stop(), nb = !gave && recBest(ID, lvl, s, true); $('#bs', root).textContent = bestStr();
        $('#msg', root).textContent = '🎉 Solved in ' + fmtT(s) + (nb ? ' (new best!)' : ''); buzz(80); save();
      } else $('#msg', root).textContent = 'Not quite: look for red cells';
    }
    function setVal(v) {
      if (done || sel < 0) return;
      wrong = new Set();
      if (v === 0) { g[sel] = 0; notes[sel] = 0; }
      else if (pencil) { if (!g[sel]) notes[sel] ^= 1 << v; }
      else { g[sel] = v; notes[sel] = 0; }
      paint(); save(); checkWin();
    }
    bd.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; sel = +b.dataset.i; paint(); };
    $('#pad', root).onclick = (e) => { const b = e.target.closest('button'); if (b) setVal(+b.dataset.v); };
    T.on(window, 'keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName || ''))) return;
      if (/^[0-9]$/.test(e.key)) setVal(+e.key); else if (e.key === 'Backspace' || e.key === 'Delete') setVal(0);
    });
    $('#pen', root).onclick = (e) => { pencil = !pencil; e.currentTarget.textContent = pencil ? '✏️ Notes on' : '✏️ Notes off'; e.currentTarget.setAttribute('aria-pressed', String(pencil)); };
    $('#hint', root).onclick = () => {
      if (done || !pz) return;
      let i = sel >= 0 && g[sel] !== pz.sol[sel] ? sel : -1;
      if (i < 0) { const c = g.map((v, k) => (v !== pz.sol[k] ? k : -1)).filter((k) => k >= 0); if (!c.length) return; i = pick(c); }
      sel = i; g[i] = pz.sol[i]; notes[i] = 0; gave = true; paint(); save(); checkWin();
    };
    $('#chk', root).onclick = () => {
      if (done || !pz) return;
      wrong = new Set(); g.forEach((v, i) => { if (v && v !== pz.sol[i]) wrong.add(i); });
      $('#msg', root).textContent = wrong.size ? wrong.size + ' wrong number' + (wrong.size > 1 ? 's' : '') + ' in red' : 'All entries so far are correct';
      paint(); T.to(() => { wrong = new Set(); if (pz) paint(); }, 2500);
    };
    $('#giveup', root).onclick = () => {
      if (done || !pz) return;
      g = pz.sol.slice(); notes = Array(81).fill(0); gave = true; done = true; clock.stop(); wrong = new Set(); paint(); $('#msg', root).textContent = 'Solution shown'; save();
    };
    onSeg(root, 'lv', (v) => { lvl = LV[v] ? v : 'easy'; gput(ID, { lvl }); fresh(); });
    $('#new', root).onclick = fresh;
    const s0 = sv.cur;
    let restored = null;
    if (s0 && typeof s0.enc === 'string' && s0.enc.length === 162) { try { const p = L.ksDecode(s0.enc); if (L.ksValid(p)) restored = p; } catch (e) { restored = null; } }
    if (restored) load(restored, s0.g, s0.notes, s0.secs || 0, s0.done, s0.gave); else fresh();
    return () => { if (pz && !done) save(); T.stop(); };
  });

/* =====================================================================
   7. Tangram
   ===================================================================== */
/* LOGIC-START */
/* Units: the small triangles have legs of 2, so the seven pieces together cover 32 square units.
   Piece indexes: 0 and 1 large triangles, 2 medium triangle, 3 and 4 small triangles, 5 square, 6 parallelogram. */
const R2 = Math.SQRT2;
L.TG_BASE = [
  [[0, 0], [4, 0], [0, 4]], [[0, 0], [4, 0], [0, 4]], [[0, 0], [2 * R2, 0], [0, 2 * R2]],
  [[0, 0], [2, 0], [0, 2]], [[0, 0], [2, 0], [0, 2]], [[0, 0], [2, 0], [2, 2], [0, 2]], [[0, 0], [2, 0], [4, 2], [2, 2]]
];
L.TG_NAMES = ['Large triangle', 'Large triangle', 'Medium triangle', 'Small triangle', 'Small triangle', 'Square', 'Parallelogram'];
L.TG_AREA = 32;
L.polyArea = (p) => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a / 2; };
L.polyCentroid = (p) => { let x = 0, y = 0, a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length], c = p[i][0] * q[1] - q[0] * p[i][1]; a += c; x += (p[i][0] + q[0]) * c; y += (p[i][1] + q[1]) * c; } return [x / (3 * a), y / (3 * a)]; };
/* Piece shape turned by k * 45 degrees after an optional mirror, counter-clockwise, no translation. */
L.tgShape = function (idx, k, flip) {
  let pts = L.TG_BASE[idx].map(([x, y]) => (flip ? [-x, y] : [x, y]));
  const a = k * Math.PI / 4, c = Math.cos(a), s = Math.sin(a);
  pts = pts.map(([x, y]) => [x * c - y * s, x * s + y * c]);
  return L.polyArea(pts) < 0 ? pts.reverse() : pts;
};
/* Placed piece [idx, k, flip, tx, ty] -> polygon. */
L.tgPoly = (pl) => L.tgShape(pl[0], pl[1], pl[2]).map(([x, y]) => [x + pl[3], y + pl[4]]);
/* Area of the overlap of two convex polygons (counter-clockwise), Sutherland-Hodgman. */
L.polyOverlap = function (subj, clip) {
  let out = subj;
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length], inp = out; out = [];
    const side = (p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    for (let j = 0; j < inp.length; j++) {
      const p = inp[j], q = inp[(j + 1) % inp.length], sp = side(p), sq = side(q);
      if (sp >= 0) out.push(p);
      if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
    }
  }
  return out.length < 3 ? 0 : Math.abs(L.polyArea(out));
};
/* Build a random silhouette by gluing the seven pieces edge to edge. Returns an array of 7 placements, or null. */
L.tgGen = function () {
  const order = shuffle([0, 1, 2, 3, 4, 5, 6]), placed = [], polys = [];
  const first = [order[0], rnd(8), rnd(2), 0, 0]; placed.push(first); polys.push(L.tgPoly(first));
  const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  for (let n = 1; n < 7; n++) {
    const idx = order[n]; let ok = false;
    for (let t = 0; t < 400 && !ok; t++) {
      const flip = rnd(2), base = L.tgShape(idx, 0, flip), pi = rnd(polys.length), poly = polys[pi];
      const ei = rnd(poly.length), A = poly[ei], B = poly[(ei + 1) % poly.length], l = len(A, B);
      const ci = rnd(base.length), C = base[ci], D = base[(ci + 1) % base.length];
      if (Math.abs(len(C, D) - l) > 1e-6) continue;
      const th = Math.atan2(A[1] - B[1], A[0] - B[0]) - Math.atan2(D[1] - C[1], D[0] - C[0]);
      const k = (((Math.round(th / (Math.PI / 4)) % 8) + 8) % 8);
      /* where does C go after turning by k? (computed directly because tgShape may reverse the vertex order) */
      const a = k * Math.PI / 4, cs = Math.cos(a), sn = Math.sin(a);
      const C2 = [C[0] * cs - C[1] * sn, C[0] * sn + C[1] * cs];
      const pl = [idx, k, flip, B[0] - C2[0], B[1] - C2[1]], np = L.tgPoly(pl);
      if (polys.some((q) => L.polyOverlap(np, q) > 1e-6)) continue;
      placed.push(pl); polys.push(np); ok = true;
    }
    if (!ok) return null;
  }
  /* move to the top-left corner and round */
  let mx = Infinity, my = Infinity; polys.forEach((p) => p.forEach(([x, y]) => { mx = Math.min(mx, x); my = Math.min(my, y); }));
  return placed.map((p) => [p[0], p[1], p[2], Math.round((p[3] - mx) * 1000) / 1000, Math.round((p[4] - my) * 1000) / 1000]);
};
/* Size and compactness of a layout. */
L.tgMetrics = function (layout) {
  const polys = layout.map(L.tgPoly); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; const pts = [];
  polys.forEach((p) => p.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); pts.push([Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6]); }));
  /* convex hull (monotone chain) */
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), hull = [];
  for (const p of pts) { while (hull.length >= 2 && cr(hull[hull.length - 2], hull[hull.length - 1], p) <= 1e-9) hull.pop(); hull.push(p); }
  const lo = hull.length + 1;
  for (let i = pts.length - 2; i >= 0; i--) { const p = pts[i]; while (hull.length >= lo && cr(hull[hull.length - 2], hull[hull.length - 1], p) <= 1e-9) hull.pop(); hull.push(p); }
  hull.pop();
  const cen = polys.map(L.polyCentroid), d = [];
  for (let i = 0; i < 7; i++) for (let j = i + 1; j < 7; j++) d.push(Math.round(Math.hypot(cen[i][0] - cen[j][0], cen[i][1] - cen[j][1]) * 100));
  return { w: x1 - x0, h: y1 - y0, hull: Math.abs(L.polyArea(hull)), compact: L.TG_AREA / Math.abs(L.polyArea(hull)), sig: d.sort((a, b) => a - b).join(',') };
};
/* How well do the player's pieces cover the target? polys are arrays of vertex lists. */
L.tgCoverage = function (target, user) {
  let covered = 0, overlap = 0;
  user.forEach((u) => target.forEach((t) => { covered += L.polyOverlap(u, t); }));
  for (let i = 0; i < user.length; i++) for (let j = i + 1; j < user.length; j++) overlap += L.polyOverlap(user[i], user[j]);
  return { covered: covered / L.TG_AREA, overlap: overlap / L.TG_AREA };
};
L.tgSolved = (target, user) => { const c = L.tgCoverage(target, user); return c.covered - c.overlap >= 0.95 && c.overlap <= 0.04; };
/* LOGIC-END */

/* Target silhouettes: each is the seven pieces placed as [piece, turns of 45 degrees, mirrored, x, y]. Built by gluing the pieces edge to edge (L.tgGen) and verified in tests/games6.test.js. */
/* LOGIC-START */
L.TG_BANK = [
  [[2,3,0,6,4],[6,2,1,6,4],[3,6,0,6,4],[0,2,1,4,6],[5,2,1,8,6],[4,4,0,6,6],[1,0,0,0,2]],
  [[0,4,0,4,4],[2,3,1,2,6],[3,4,0,4,6],[6,4,0,6,8],[5,0,1,6,4],[1,4,1,4,4],[4,6,1,6,4]],
  [[2,7,0,2,2],[3,4,1,2,4],[6,2,0,2,2],[1,4,1,4,4],[0,0,1,8,0],[5,0,1,4,4],[4,0,0,4,4]],
  [[2,7,1,2,2],[0,2,0,4,4],[3,2,0,4,2],[5,6,0,4,4],[4,4,1,2,2],[6,4,0,6,2],[1,6,1,4,4]],
  [[2,1,0,6,2],[0,6,1,4,4],[1,2,0,4,4],[4,6,1,4,2],[6,6,1,6,0],[5,6,0,4,2],[3,4,0,4,2]],
  [[0,2,1,4,4],[2,3,1,2,6],[6,4,1,2,6],[5,0,1,6,2],[3,6,0,6,4],[1,6,1,0,0],[4,2,1,6,2]],
  [[2,1,0,6,0],[3,0,0,4,0],[0,6,1,4,2],[6,2,0,4,0],[4,2,0,8,0],[5,4,1,8,2],[1,2,1,4,6]],
  [[1,6,0,4,6],[2,7,0,2,4],[3,6,1,2,2],[0,0,0,4,6],[6,2,1,4,8],[4,0,1,2,2],[5,0,0,0,0]],
  [[2,7,0,2,2],[3,4,1,2,4],[0,6,1,4,0],[6,4,1,0,2],[4,0,1,2,2],[5,0,0,2,4],[1,2,1,8,4]],
  [[6,5,0,2.828,5.657],[2,4,1,2.828,5.657],[1,7,0,2.828,2.828],[5,5,0,1.414,7.071],[0,3,1,2.828,2.828],[4,1,0,2.828,5.657],[3,5,0,4.243,7.071]],
  [[4,4,1,2,2],[5,4,0,2,2],[3,0,1,4,2],[2,1,0,2,2],[6,4,0,6,2],[1,6,1,0,4],[0,4,0,4,8]],
  [[3,2,1,4,6],[2,3,1,2,6],[5,4,0,6,6],[4,0,0,2,6],[1,4,0,4,4],[6,6,0,2,10],[0,6,0,4,4]],
  [[5,2,1,10,6],[4,2,1,8,6],[2,5,0,6,6],[1,6,0,4,4],[3,6,0,8,4],[6,2,1,10,4],[0,2,0,4,0]],
  [[2,0,1,5.657,2.828],[6,7,1,7.071,1.414],[5,1,0,7.071,4.243],[1,1,1,5.657,5.657],[3,3,0,7.071,1.414],[0,7,0,0,5.657],[4,7,1,4.243,1.414]],
  [[3,7,0,4.243,7.071],[5,1,1,5.657,8.485],[6,3,0,5.657,5.657],[2,4,0,5.657,5.657],[4,3,0,7.071,4.243],[0,3,0,5.657,2.828],[1,5,1,0,2.828]],
  [[0,3,0,2.828,4.243],[2,0,1,2.828,1.414],[6,3,1,2.828,4.243],[3,1,0,1.414,0],[5,5,0,4.243,5.657],[4,1,1,4.243,5.657],[1,5,1,0,7.071]],
  [[0,2,1,8,4],[2,3,1,6,6],[4,6,0,4,6],[5,0,0,2,4],[3,0,0,2,6],[6,2,0,2,6],[1,6,1,4,0]],
  [[5,4,0,2,6],[3,6,0,2,6],[2,3,1,4,6],[6,0,0,2,6],[4,4,1,0,4],[0,4,1,2,4],[1,2,0,6,0]],
  [[4,6,0,2,6],[2,3,1,4,6],[3,0,1,4,6],[0,4,0,6,4],[6,2,0,2,4],[5,0,0,4,6],[1,6,1,2,0]],
  [[2,4,0,5.657,5.657],[0,1,1,5.657,2.828],[6,5,0,7.071,7.071],[1,5,1,0,2.828],[5,7,1,7.071,1.414],[3,3,1,5.657,2.828],[4,7,0,7.071,1.414]],
  [[5,7,0,5.657,5.657],[3,3,0,7.071,4.243],[2,2,1,5.657,5.657],[4,3,0,7.071,7.071],[1,1,1,5.657,2.828],[6,1,0,5.657,0],[0,7,0,0,2.828]],
  [[4,7,1,4.243,5.657],[2,2,0,5.657,7.071],[5,1,0,2.828,4.243],[3,5,1,2.828,4.243],[1,7,1,2.828,7.071],[6,3,1,2.828,4.243],[0,3,0,2.828,7.071]],
  [[5,2,0,8,4],[3,0,0,8,4],[4,0,1,6,4],[2,3,0,6,6],[6,4,0,8,4],[0,0,1,4,4],[1,6,0,0,4]],
  [[2,7,1,6,2],[3,0,1,8,2],[4,6,0,6,2],[5,2,0,10,2],[0,0,0,4,4],[1,2,0,4,4],[6,4,1,2,4]],
  [[6,2,0,4,4],[4,2,1,4,8],[2,5,0,2,6],[3,6,1,4,6],[0,4,0,4,4],[1,6,1,4,0],[5,0,0,0,6]],
  [[2,5,1,2,4],[0,6,0,4,6],[1,0,1,8,6],[6,0,1,4,2],[4,2,0,2,4],[5,4,1,2,2],[3,6,0,4,2]],
  [[6,3,0,4.243,8.485],[2,4,0,4.243,8.485],[3,1,0,4.243,8.485],[1,3,0,4.243,5.657],[5,3,1,5.657,9.899],[0,7,0,1.414,2.828],[4,3,0,5.657,7.071]],
  [[3,5,0,7.071,1.414],[5,5,1,4.243,1.414],[6,7,1,7.071,1.414],[2,2,0,5.657,2.828],[4,1,0,7.071,4.243],[1,1,1,5.657,5.657],[0,5,1,0,5.657]],
  [[4,6,1,2,2],[5,2,0,2,2],[2,1,0,4,2],[0,0,0,2,4],[3,2,0,6,2],[1,2,1,6,8],[6,0,1,8,0]],
  [[6,0,0,6,2],[2,1,0,6,2],[5,6,0,8,6],[3,2,1,8,2],[4,0,0,6,0],[1,6,1,4,4],[0,2,1,4,8]],
  [[4,5,1,1.414,7.071],[2,6,0,2.828,8.485],[3,5,0,1.414,7.071],[6,5,1,2.828,8.485],[5,5,1,5.657,8.485],[0,5,1,2.828,5.657],[1,1,1,5.657,2.828]],
  [[4,1,0,5.657,2.828],[3,5,0,4.243,4.243],[2,2,1,5.657,2.828],[6,7,0,2.828,5.657],[0,3,1,2.828,2.828],[5,7,1,7.071,4.243],[1,1,1,2.828,2.828]],
  [[2,3,1,2,6],[3,4,0,4,6],[4,0,1,4,6],[0,2,1,4,4],[6,4,0,4,8],[1,0,0,4,0],[5,6,0,2,10]],
  [[3,1,1,4.243,4.243],[2,2,0,2.828,2.828],[0,3,0,2.828,5.657],[4,1,0,1.414,1.414],[1,7,1,2.828,5.657],[5,5,1,1.414,1.414],[6,7,0,2.828,2.828]],
  [[2,4,0,2.828,5.657],[4,3,0,4.243,4.243],[0,3,0,2.828,2.828],[3,1,0,4.243,4.243],[6,1,1,7.071,7.071],[1,3,1,2.828,2.828],[5,7,1,2.828,5.657]],
  [[2,2,0,2.828,1.414],[0,1,1,2.828,4.243],[3,3,0,4.243,2.828],[5,3,1,4.243,2.828],[4,7,0,2.828,4.243],[1,1,0,2.828,4.243],[6,1,1,8.485,1.414]]
];
/* LOGIC-END */

reg('tangram', 'Tangram', '🔸', 'Rebuild the silhouette with the seven tangram pieces. Drag to move, tap a piece to turn it, flip the parallelogram, pieces snap to corners. 36 shapes.',
  ['tangram', 'shapes', 'pieces', 'silhouette', 'puzzle'], function (el) {
    const T = tracker(), ID = 'tangram', S = 22, VW = 360, VH = 480, TOPH = 245;
    const sv = gget(ID), NB = L.TG_BANK.length, COLS = ['#ef476f', '#f78c3b', '#ffd166', '#06b6a4', '#118ab2', '#8b5cf6', '#ec4899'];
    let idx = Number.isInteger(sv.idx) && sv.idx >= 0 && sv.idx < NB ? sv.idx : 0;
    let lay = null, tpolys = [], tpx = [], ox = 0, oy = 0, pcs = [], sel = -1, done = false, gave = false;
    const root = mount(el, `
      <div style="display:flex;gap:6px;align-items:center;margin:6px 0">
        <button class="btn alt" id="prev" aria-label="Previous shape" style="min-width:48px;min-height:44px">◀</button>
        <div class="stats" style="flex:1;margin:0">${stat('no', 'Shape', '1/' + NB)}${stat('tm', 'Time', '0:00')}${stat('bs', 'Best', '–')}</div>
        <button class="btn alt" id="next" aria-label="Next shape" style="min-width:48px;min-height:44px">▶</button>
      </div>
      <svg id="svg" viewBox="0 0 ${VW} ${VH}" style="width:100%;max-width:420px;display:block;margin:0 auto;touch-action:none;background:var(--surface);border:1px solid var(--line);border-radius:12px" role="img" aria-label="Tangram board. Grey is the shape to fill, coloured pieces can be dragged."></svg>
      <div class="msg" id="msg" style="font-size:14px"></div>
      <div class="acts"><button class="btn alt" id="rot">⟳ Turn piece</button><button class="btn alt" id="flip">⇋ Flip piece</button><button class="btn alt" id="nx">Next piece</button></div>
      <div class="acts"><button class="btn alt" id="hint">💡 Hint</button><button class="btn alt" id="giveup">🏳 Show solution</button><button class="btn" id="rand">🎲 Random shape</button></div>`);
    const clock = makeClock(T, $('#tm', root)), svg = $('#svg', root);
    const bestStr = () => { const b = (gget(ID).best || {})[idx]; return typeof b === 'number' ? fmtT(b) : '–'; };
    const polyPx = (p) => { const sh = L.tgShape(p.i, p.k, p.f), c = L.polyCentroid(sh); return sh.map(([x, y]) => [(x - c[0]) * S + p.cx, (y - c[1]) * S + p.cy]); };
    const ptsAttr = (poly) => poly.map(([x, y]) => x.toFixed(2) + ',' + y.toFixed(2)).join(' ');
    const toUnits = (poly) => poly.map(([x, y]) => [(x - ox) / S, (y - oy) / S]);
    function save() { gput(ID, { idx, cur: lay ? { idx, pcs, secs: clock.secs(), done, gave } : null }); }
    function build() {
      let h = '<g id="tg">';
      tpx.forEach((p) => { h += '<polygon points="' + ptsAttr(p) + '" fill="var(--muted)" fill-opacity=".38" stroke="var(--muted)" stroke-opacity=".38" stroke-width="1.5" stroke-linejoin="round"/>'; });
      h += '</g><g id="hl"></g><line x1="10" x2="350" y1="' + (TOPH + 2) + '" y2="' + (TOPH + 2) + '" stroke="var(--line)" stroke-dasharray="4 4"/><g id="pg">';
      pcs.forEach((p, i) => { h += '<polygon data-i="' + i + '" points="' + ptsAttr(polyPx(p)) + '" fill="' + COLS[p.i] + '" stroke="var(--text)" stroke-width="1.5" stroke-linejoin="round" style="cursor:grab"><title>' + L.TG_NAMES[p.i] + '</title></polygon>'; });
      svg.innerHTML = h + '</g>';
      refreshSel();
    }
    const el_ = (i) => svg.querySelector('#pg polygon[data-i="' + i + '"]');
    function refreshSel() { pcs.forEach((_, i) => { const e = el_(i); if (e) { e.setAttribute('stroke-width', i === sel ? '3.5' : '1.5'); e.setAttribute('stroke', i === sel ? 'var(--accent)' : 'var(--text)'); } }); }
    function upd(i) { const e = el_(i); if (e) e.setAttribute('points', ptsAttr(polyPx(pcs[i]))); }
    function front(i) { const e = el_(i); if (e && e.parentNode) e.parentNode.appendChild(e); }
    function check() {
      if (done || !lay) return;
      if (L.tgSolved(tpolys, pcs.map((p) => toUnits(polyPx(p))))) {
        done = true; const s = clock.stop(), best = Object.assign({}, gget(ID).best), solved = (gget(ID).solved || []).slice();
        const nb = typeof best[idx] !== 'number' || s < best[idx]; if (nb) best[idx] = s; if (!solved.includes(idx)) solved.push(idx);
        gput(ID, { best, solved }); $('#bs', root).textContent = bestStr();
        $('#msg', root).textContent = '🎉 Shape solved in ' + fmtT(s) + (nb ? ' (new best!)' : '') + ' · ' + solved.length + '/' + NB + ' shapes solved'; buzz(80); sel = -1; refreshSel(); save();
      }
    }
    function load(n, state) {
      idx = n; lay = L.TG_BANK[idx]; tpolys = lay.map(L.tgPoly);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; tpolys.forEach((p) => p.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }));
      ox = (VW - (x1 - x0) * S) / 2 - x0 * S; oy = (TOPH - (y1 - y0) * S) / 2 - y0 * S + 2;
      tpx = tpolys.map((p) => p.map(([x, y]) => [x * S + ox, y * S + oy]));
      const slots = [[62, 322], [165, 322], [270, 322], [40, 420], [100, 420], [170, 420], [280, 420]];
      pcs = state && Array.isArray(state.pcs) && state.pcs.length === 7 ? state.pcs.map((p) => ({ i: p.i, k: ((p.k % 8) + 8) % 8, f: p.f ? 1 : 0, cx: Math.min(VW - 5, Math.max(5, +p.cx || 0)), cy: Math.min(VH - 5, Math.max(5, +p.cy || 0)) }))
        : lay.map((pl, j) => ({ i: pl[0], k: rnd(8), f: pl[0] === 6 ? rnd(2) : 0, cx: slots[pl[0]][0], cy: slots[pl[0]][1] }));
      sel = -1; done = !!(state && state.done); gave = !!(state && state.gave);
      $('#no', root).textContent = (idx + 1) + '/' + NB; $('#bs', root).textContent = bestStr();
      build();
      $('#msg', root).textContent = done ? (gave ? 'Solution shown' : '🎉 Solved') : 'Drag pieces onto the grey shape. Tap a piece to turn it.';
      if (done) clock.stop(); else clock.start(state && state.secs ? state.secs : 0);
      save();
    }
    function svgPt(e) { const r = svg.getBoundingClientRect(); return r.width ? [(e.clientX - r.left) * VW / r.width, (e.clientY - r.top) * VH / r.height] : [0, 0]; }
    function snap(i) {
      const mine = polyPx(pcs[i]), cand = [];
      tpx.forEach((p) => p.forEach((v) => cand.push(v)));
      pcs.forEach((p, j) => { if (j !== i) polyPx(p).forEach((v) => cand.push(v)); });
      let best = null;
      mine.forEach((v) => cand.forEach((c) => { const d = Math.hypot(c[0] - v[0], c[1] - v[1]); if (d <= 14 && (!best || d < best.d)) best = { d, dx: c[0] - v[0], dy: c[1] - v[1] }; }));
      if (best) { pcs[i].cx += best.dx; pcs[i].cy += best.dy; }
    }
    svg.addEventListener('pointerdown', (e) => {
      const t = e.target.closest ? e.target.closest('polygon[data-i]') : null; if (!t || done) return;
      e.preventDefault();
      const i = +t.dataset.i, p0 = svgPt(e), c0 = [pcs[i].cx, pcs[i].cy]; let moved = false;
      sel = i; front(i); refreshSel();
      const move = (ev) => {
        const q = svgPt(ev), dx = q[0] - p0[0], dy = q[1] - p0[1];
        if (!moved && Math.hypot(dx, dy) < 5) return;
        moved = true; pcs[i].cx = Math.min(VW - 5, Math.max(5, c0[0] + dx)); pcs[i].cy = Math.min(VH - 5, Math.max(5, c0[1] + dy)); upd(i);
      };
      const off = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
      const up = () => {
        off();
        if (moved) snap(i); else pcs[i].k = (pcs[i].k + 1) % 8;
        upd(i); save(); check();
      };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
      T.on(window, 'blur', off);
    });
    const act = (fn) => () => { if (!lay || done || sel < 0) { if (!done) $('#msg', root).textContent = 'Tap a piece first'; return; } fn(pcs[sel]); upd(sel); save(); check(); };
    $('#rot', root).onclick = act((p) => { p.k = (p.k + 1) % 8; });
    $('#flip', root).onclick = act((p) => { p.f ^= 1; $('#msg', root).textContent = p.i === 6 ? 'Parallelogram flipped' : 'Flipping only changes the parallelogram'; });
    $('#nx', root).onclick = () => { if (done || !pcs.length) return; sel = (sel + 1) % pcs.length; front(sel); refreshSel(); $('#msg', root).textContent = L.TG_NAMES[pcs[sel].i] + ' selected'; };
    T.on(window, 'keydown', (e) => {
      if (done || sel < 0 || e.ctrlKey || e.metaKey || e.altKey || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName || ''))) return;
      const p = pcs[sel], d = { ArrowLeft: [-4, 0], ArrowRight: [4, 0], ArrowUp: [0, -4], ArrowDown: [0, 4] }[e.key];
      if (d) { e.preventDefault(); p.cx = Math.min(VW - 5, Math.max(5, p.cx + d[0])); p.cy = Math.min(VH - 5, Math.max(5, p.cy + d[1])); } else if (e.key === 'r' || e.key === 'R') p.k = (p.k + 1) % 8; else if (e.key === 'f' || e.key === 'F') p.f ^= 1; else return;
      if (d) snap(sel); upd(sel); save(); check();
    });
    $('#hint', root).onclick = () => {
      if (!lay || done) return;
      const user = pcs.map((p) => toUnits(polyPx(p))), weak = [];
      tpolys.forEach((t, j) => { const cov = user.reduce((a, u) => a + L.polyOverlap(u, t), 0); if (cov < 0.6 * Math.abs(L.polyArea(t))) weak.push(j); });
      if (!weak.length) { $('#msg', root).textContent = 'Every part is covered: nudge the pieces to fit exactly'; return; }
      const j = pick(weak), g = $('#hl', root);
      g.innerHTML = '<polygon points="' + ptsAttr(tpx[j]) + '" fill="none" stroke="var(--accent)" stroke-width="3" stroke-dasharray="6 4"/>';
      $('#msg', root).textContent = 'Hint: a ' + L.TG_NAMES[lay[j][0]].toLowerCase() + ' goes in the dashed outline';
      T.to(() => { if (g) g.innerHTML = ''; }, 3500);
    };
    $('#giveup', root).onclick = () => {
      if (!lay || done) return;
      pcs.forEach((p, j) => { const c = L.polyCentroid(tpolys[j]); p.k = lay[j][1]; p.f = lay[j][2]; p.cx = c[0] * S + ox; p.cy = c[1] * S + oy; upd(j); });
      gave = true; done = true; clock.stop(); sel = -1; refreshSel(); $('#msg', root).textContent = 'Solution shown'; save();
    };
    $('#prev', root).onclick = () => load((idx + NB - 1) % NB, null);
    $('#next', root).onclick = () => load((idx + 1) % NB, null);
    $('#rand', root).onclick = () => { let n = rnd(NB); if (n === idx) n = (n + 1) % NB; load(n, null); };
    const s0 = sv.cur;
    if (s0 && s0.idx === idx && Array.isArray(s0.pcs) && s0.pcs.length === 7 && s0.pcs.every((p) => p && Number.isInteger(p.i) && p.i >= 0 && p.i < 7)) load(idx, s0); else load(idx, null);
    return () => { if (lay && !done) save(); T.stop(); };
  });

/* =====================================================================
   8. Dice Five (Yahtzee-style)
   ===================================================================== */
/* LOGIC-START */
L.DF_CATS = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes', 'three', 'four', 'full', 'small', 'large', 'five', 'chance'];
L.DF_LABEL = { ones: 'Ones', twos: 'Twos', threes: 'Threes', fours: 'Fours', fives: 'Fives', sixes: 'Sixes', three: 'Three of a kind', four: 'Four of a kind', full: 'Full house (25)', small: 'Small straight (30)', large: 'Large straight (40)', five: 'Dice Five (50)', chance: 'Chance' };
/* Average score of each box under good play: the AI aims for these when it compares options. */
L.DF_PAR = { ones: 2.1, twos: 5.3, threes: 8.6, fours: 12.2, fives: 15.7, sixes: 19.2, three: 21.7, four: 13.1, full: 22.6, small: 29.5, large: 32.7, five: 16.9, chance: 22 };
L.dfNewSheet = () => { const s = { yb: 0 }; L.DF_CATS.forEach((c) => { s[c] = null; }); return s; };
L.dfCounts = (dice) => { const c = [0, 0, 0, 0, 0, 0, 0]; dice.forEach((v) => { c[v]++; }); return c; };
/* Score for a box. joker = a second Dice Five when the Dice Five box is already used: full house and straights then score in full. */
L.dfScore = function (cat, dice, joker) {
  const c = L.dfCounts(dice), sum = dice.reduce((a, b) => a + b, 0), mx = Math.max(c[1], c[2], c[3], c[4], c[5], c[6]);
  const face = L.DF_CATS.indexOf(cat);
  if (face >= 0 && face < 6) return (face + 1) * c[face + 1];
  switch (cat) {
    case 'three': return mx >= 3 ? sum : 0;
    case 'four': return mx >= 4 ? sum : 0;
    case 'full': return joker || (mx === 3 && c.slice(1).includes(2)) ? 25 : 0;
    case 'small': return joker || (c[3] && c[4] && ((c[1] && c[2]) || (c[2] && c[5]) || (c[5] && c[6]))) ? 30 : 0;
    case 'large': return joker || (c[2] && c[3] && c[4] && c[5] && (c[1] || c[6])) ? 40 : 0;
    case 'five': return mx === 5 ? 50 : 0;
    case 'chance': return sum;
    default: return 0;
  }
};
/* Boxes the player may pick for these dice, with their scores, under the usual joker rules for extra Dice Fives. */
L.dfLegal = function (sheet, dice) {
  const c = L.dfCounts(dice), isY = Math.max(c[1], c[2], c[3], c[4], c[5], c[6]) === 5;
  const open = L.DF_CATS.filter((k) => sheet[k] === null);
  const joker = isY && sheet.five !== null;
  const out = (list) => list.map((k) => ({ cat: k, score: L.dfScore(k, dice, joker) }));
  if (!joker) return out(open);
  const up = L.DF_CATS[dice[0] - 1];
  if (sheet[up] === null) return out([up]);
  const lower = open.filter((k) => L.DF_CATS.indexOf(k) >= 6);
  if (lower.length) return out(lower);
  return out(open); /* only upper boxes left: they score 0 (or their face total) */
};
/* Fill a box. Returns { sheet, score, bonus } (bonus = 100 points for an extra Dice Five when that box holds 50). Throws on an illegal pick. */
L.dfApply = function (sheet, cat, dice) {
  const opt = L.dfLegal(sheet, dice).find((o) => o.cat === cat);
  if (!opt) throw new Error('illegal box ' + cat);
  const c = L.dfCounts(dice), isY = Math.max(c[1], c[2], c[3], c[4], c[5], c[6]) === 5;
  const next = Object.assign({}, sheet); next[cat] = opt.score;
  const bonus = isY && sheet.five === 50;
  if (bonus) next.yb = sheet.yb + 1;
  return { sheet: next, score: opt.score, bonus };
};
L.dfUpper = (s) => L.DF_CATS.slice(0, 6).reduce((a, k) => a + (s[k] || 0), 0);
L.dfBonus = (s) => (L.dfUpper(s) >= 63 ? 35 : 0);
L.dfTotal = (s) => L.dfUpper(s) + L.dfBonus(s) + L.DF_CATS.slice(6).reduce((a, k) => a + (s[k] || 0), 0) + 100 * s.yb;
L.dfDone = (s) => L.DF_CATS.every((k) => s[k] !== null);
/* All ways to roll k dice as count vectors with probabilities. */
L.dfOutcomes = (() => {
  const memo = [];
  return (k) => {
    if (memo[k]) return memo[k];
    const fact = [1, 1, 2, 6, 24, 120], res = [];
    (function rec(face, left, cnt) {
      if (face === 6) { cnt[6] = left; const c = cnt.slice(); let p = fact[k]; for (let v = 1; v <= 6; v++) p /= fact[c[v]]; res.push({ c, p: p / Math.pow(6, k) }); return; }
      for (let n = 0; n <= left; n++) { cnt[face] = n; rec(face + 1, left - n, cnt); }
    })(1, k, [0, 0, 0, 0, 0, 0, 0]);
    memo[k] = res; return res;
  };
})();
const dfDice = (c) => { const d = []; for (let v = 1; v <= 6; v++) for (let i = 0; i < c[v]; i++) d.push(v); return d; };
const dfKey = (c) => c.reduce((a, n, v) => a + n * Math.pow(6, v), 0);
/* Value of finished dice for the AI: best box by (score - typical score of that box), plus the 100 bonus. */
function dfEvalDice(ctx, c) {
  const k = dfKey(c); let v = ctx.ev.get(k);
  if (v !== undefined) return v;
  const dice = dfDice(c); v = -1e9;
  L.dfLegal(ctx.sheet, dice).forEach((o) => { v = Math.max(v, o.score - L.DF_PAR[o.cat]); });
  if (Math.max(c[1], c[2], c[3], c[4], c[5], c[6]) === 5 && ctx.sheet.five === 50) v += 100;
  ctx.ev.set(k, v); return v;
}
function dfHolds(c, fn) {
  const h = [0, 0, 0, 0, 0, 0, 0];
  (function rec(v) {
    if (v === 7) { fn(h); return; }
    for (let n = 0; n <= c[v]; n++) { h[v] = n; rec(v + 1); }
    h[v] = 0;
  })(1);
}
function dfEV(ctx, c, r) {
  if (r === 0) return dfEvalDice(ctx, c);
  const key = dfKey(c) * 4 + r; let best = ctx.memo.get(key);
  if (best !== undefined) return best;
  best = -1e9;
  dfHolds(c, (h) => { const e = dfHoldValue(ctx, h, r - 1); if (e > best) best = e; });
  ctx.memo.set(key, best); return best;
}
function dfHoldValue(ctx, h, r) {
  const kept = h.reduce((a, b) => a + b, 0), outs = L.dfOutcomes(5 - kept); let e = 0;
  for (const o of outs) { const c = h.slice(); for (let v = 1; v <= 6; v++) c[v] += o.c[v]; e += o.p * dfEV(ctx, c, r); }
  return e;
}
/* Which dice to keep: returns 5 booleans. rollsLeft = rolls still to come (1 or 2). depth 1 = look one roll ahead, 2 = two. */
L.dfAIHold = function (sheet, dice, rollsLeft, depth) {
  const ctx = { sheet, ev: new Map(), memo: new Map() }, c = L.dfCounts(dice), r = Math.min(rollsLeft, depth || 2) - 1;
  let best = null;
  dfHolds(c, (h) => { const e = dfHoldValue(ctx, h, r); if (!best || e > best.e + 1e-9) best = { e, h: h.slice() }; });
  const left = best.h.slice();
  return dice.map((v) => { if (left[v] > 0) { left[v]--; return true; } return false; });
};
/* Which box to fill: best legal option by score minus typical score. */
L.dfAIPick = function (sheet, dice) {
  let best = null;
  L.dfLegal(sheet, dice).forEach((o) => { const v = o.score - L.DF_PAR[o.cat]; if (!best || v > best.v) best = { v, cat: o.cat }; });
  return best.cat;
};
/* LOGIC-END */

/* Dice drawing shared by the three dice games. */
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
function dieHTML(v, opts) {
  opts = opts || {};
  const cells = []; for (let i = 0; i < 9; i++) cells.push(v && PIPS[v].includes(i) ? '<i></i>' : '<span></span>');
  return '<button class="die' + (opts.hold ? ' hold' : '') + '" data-d="' + (opts.i === undefined ? '' : opts.i) + '"' + (opts.dis ? ' disabled' : '') + ' aria-label="' + (v ? 'Die ' + v : 'Die not rolled') + (opts.hold ? ', held' : '') + '" aria-pressed="' + (!!opts.hold) + '"' +
    (opts.style ? ' style="' + opts.style + '"' : '') + '>' + cells.join('') + '</button>';
}

reg('dicefive', 'Dice Five', '🪘', 'A five-dice scorecard game: roll up to three times, hold the dice you like and fill 13 boxes. Play solo for a high score or against the phone.',
  ['dice', 'yahtzee', 'five', 'scorecard', 'roll'], function (el) {
    const T = tracker(), ID = 'dicefive';
    const sv = gget(ID);
    let mode = sv.mode === 'phone' ? 'phone' : 'solo', pl = [], turn = 0, dice = [0, 0, 0, 0, 0], held = [false, false, false, false, false], rolls = 3, over = false, busy = false, msg = '', token = 0, lastPick = null;
    const root = mount(el, `
      ${seg('md', [['solo', 'Solo'], ['phone', 'vs Phone']], mode)}
      <div class="stats">${stat('bs', 'Best solo', '–')}${stat('wl', 'Wins vs phone', '0–0')}</div>
      <div class="msg" id="msg"></div>
      <div id="dc" class="dice"></div>
      <div class="acts"><button class="btn" id="roll">Roll dice</button><button class="btn alt" id="hint">💡 Hint</button><button class="btn alt" id="new">New game</button></div>
      <div class="card" style="padding:6px"><table class="tbl" id="sc"></table></div>
      <div class="muted" style="font-size:12px;text-align:center">Upper boxes: 35 bonus for 63 or more. A second Dice Five scores 100 when the Dice Five box holds 50 and follows the joker rules.</div>`);
    const stats = () => { const s = gget(ID); return { w: s.w || 0, l: s.l || 0, t: s.t || 0 }; };
    function showStats() {
      const b = getBest(ID, 'solo'), s = stats();
      $('#bs', root).textContent = b || '–'; $('#wl', root).textContent = s.w + '–' + s.l + (s.t ? '–' + s.t : '');
    }
    function paintDice() {
      const mine = !over && !busy && pl[turn] && !pl[turn].ai;
      $('#dc', root).innerHTML = dice.map((v, i) => dieHTML(v, { i, hold: held[i], dis: !mine || rolls === 3 || rolls === 0 })).join('');
      const b = $('#roll', root);
      b.disabled = !mine || rolls === 0; b.textContent = rolls === 3 ? 'Roll dice' : rolls > 0 ? 'Roll again (' + rolls + ' left)' : 'Pick a box';
    }
    function paintCard() {
      const legal = !over && !busy && pl[turn] && !pl[turn].ai && rolls < 3 ? L.dfLegal(pl[turn].sheet, dice) : [];
      let h = '<tr><th></th>' + pl.map((p, i) => '<th' + (i === turn && !over ? ' style="color:var(--accent)"' : '') + '>' + p.name + '</th>').join('') + '</tr>';
      const row = (label, cell) => '<tr><td style="text-align:left">' + label + '</td>' + pl.map((p, i) => cell(p, i)).join('') + '</tr>';
      L.DF_CATS.forEach((cat, ci) => {
        if (ci === 6) h += row('<b>Upper</b> <span class="muted">(' + 63 + ' needed)</span>', (p) => '<td><b>' + L.dfUpper(p.sheet) + '</b></td>') + row('Upper bonus', (p) => '<td>' + (L.dfUpper(p.sheet) >= 63 ? '35' : '0') + '</td>');
        h += row(L.DF_LABEL[cat], (p, i) => {
          const v = p.sheet[cat];
          if (v !== null) return '<td' + (lastPick && lastPick.p === i && lastPick.cat === cat ? ' style="background:' + bgOK + '"' : '') + '>' + v + '</td>';
          const o = i === turn ? legal.find((x) => x.cat === cat) : null;
          return '<td>' + (o ? '<button data-c="' + cat + '" style="min-width:44px;min-height:40px;border:2px solid var(--accent);border-radius:8px;background:var(--surface);color:var(--accent);font-weight:700">' + o.score + '</button>' : '') + '</td>';
        });
      });
      h += row('Dice Five bonus', (p) => '<td>' + (p.sheet.yb ? '+' + 100 * p.sheet.yb : '–') + '</td>');
      h += row('<b>Total</b>', (p) => '<td><b>' + L.dfTotal(p.sheet) + '</b></td>');
      $('#sc', root).innerHTML = h;
    }
    function paint() { $('#msg', root).textContent = msg; paintDice(); paintCard(); showStats(); }
    function newGame() {
      token++; busy = false; over = false; turn = 0; rolls = 3; dice = [0, 0, 0, 0, 0]; held = held.map(() => false); lastPick = null;
      pl = mode === 'phone' ? [{ name: 'You', sheet: L.dfNewSheet() }, { name: 'Phone', sheet: L.dfNewSheet(), ai: true }] : [{ name: 'You', sheet: L.dfNewSheet() }];
      msg = 'Roll the dice to start'; paint();
    }
    function rollDice() {
      for (let i = 0; i < 5; i++) if (!held[i]) dice[i] = 1 + rnd(6);
      rolls--;
    }
    function endGame() {
      over = true; busy = false;
      const mine = L.dfTotal(pl[0].sheet);
      if (mode === 'solo') {
        const nb = recBest(ID, 'solo', mine, false);
        msg = 'Game over: ' + mine + ' points' + (nb ? ' (new best!)' : '');
      } else {
        const theirs = L.dfTotal(pl[1].sheet), s = stats();
        if (mine > theirs) { s.w++; msg = '🎉 You win ' + mine + ' to ' + theirs; } else if (mine < theirs) { s.l++; msg = 'Phone wins ' + theirs + ' to ' + mine; } else { s.t++; msg = 'A tie at ' + mine; }
        gput(ID, s);
      }
      paint();
    }
    function fill(cat) {
      const r = L.dfApply(pl[turn].sheet, cat, dice);
      pl[turn].sheet = r.sheet; lastPick = { p: turn, cat };
      msg = (turn === 0 ? 'You' : pl[turn].name) + ' scored ' + r.score + ' in ' + L.DF_LABEL[cat].replace(/ \(\d+\)/, '') + (r.bonus ? ' and a 100 bonus' : '');
      held = held.map(() => false); rolls = 3;
      if (pl.every((p) => L.dfDone(p.sheet))) { paint(); endGame(); return; }
      turn = (turn + 1) % pl.length; dice = [0, 0, 0, 0, 0];
      if (pl[turn].ai) { paint(); phoneTurn(); } else { msg += '. Your turn: roll!'; paint(); }
    }
    function phoneTurn() {
      const my = ++token; busy = true; const me = pl[turn];
      const step = () => {
        if (my !== token) return;
        rollDice(); paint();
        T.to(() => {
          if (my !== token) return;
          if (rolls > 0) {
            const hold = L.dfAIHold(me.sheet, dice, rolls, 2);
            if (hold.every(Boolean)) { held = hold; paint(); T.to(finish, 700); return; }
            held = hold; msg = 'Phone keeps ' + (hold.filter(Boolean).length || 'no') + ' dice'; paint();
            T.to(() => { held = held.map(() => false).map((_, i) => hold[i]); step(); }, 800);
          } else finish();
        }, 700);
      };
      const finish = () => { if (my !== token) return; busy = false; held = held.map(() => false); fill(L.dfAIPick(me.sheet, dice)); };
      held = held.map(() => false); rolls = 3; msg = 'Phone is rolling…'; paint(); T.to(step, 500);
    }
    $('#dc', root).onclick = (e) => {
      const b = e.target.closest('button'); if (!b || over || busy || rolls === 3 || rolls === 0 || b.disabled) return;
      const i = +b.dataset.d; held[i] = !held[i]; paintDice();
    };
    $('#roll', root).onclick = () => {
      if (over || busy || rolls === 0 || !pl[turn] || pl[turn].ai) return;
      rollDice(); msg = rolls > 0 ? 'Tap dice to hold them, then roll again or pick a box' : 'No rolls left: pick a box'; paint();
    };
    $('#sc', root).onclick = (e) => {
      const b = e.target.closest('button'); if (!b || !b.dataset.c || over || busy || rolls === 3) return;
      try { fill(b.dataset.c); } catch (err) { msg = 'That box is not allowed now'; paint(); }
    };
    $('#hint', root).onclick = () => {
      if (over || busy || rolls === 3 || !pl[turn] || pl[turn].ai) { msg = 'Roll the dice first'; paint(); return; }
      if (rolls > 0) { held = L.dfAIHold(pl[turn].sheet, dice, rolls, 2); msg = 'Hint: the highlighted dice are worth keeping'; } else msg = 'Hint: try ' + L.DF_LABEL[L.dfAIPick(pl[turn].sheet, dice)].replace(/ \(\d+\)/, '');
      paint();
    };
    onSeg(root, 'md', (v) => { mode = v === 'phone' ? 'phone' : 'solo'; gput(ID, { mode }); newGame(); });
    $('#new', root).onclick = newGame;
    newGame();
    return () => { token++; T.stop(); };
  });

/* =====================================================================
   9. Farkle
   ===================================================================== */
/* LOGIC-START */
/* Scoring: single 1 = 100, single 5 = 50; three of a kind = 100 x face (ones 1000); four of a kind 1000, five 2000, six 3000;
   straight 1-6 = 1500; three pairs = 1500; two triplets = 2500. A selection only counts when every selected die scores. */
L.FK_TRIPLE = [0, 1000, 200, 300, 400, 500, 600];
L.FK_TARGET = 10000;
L.FK_OPEN = 500;
L.fkScoreSel = function (dice) {
  const n = dice.length; if (!n || n > 6) return 0;
  const c = L.dfCounts(dice); let total = 0, ok = true;
  for (let f = 1; f <= 6; f++) {
    const k = c[f]; if (!k) continue;
    if (k >= 3) total += k === 3 ? L.FK_TRIPLE[f] : k === 4 ? 1000 : k === 5 ? 2000 : 3000;
    else if (f === 1) total += 100 * k;
    else if (f === 5) total += 50 * k;
    else ok = false;
  }
  let best = ok ? total : 0;
  if (n === 6) {
    const vals = c.slice(1);
    if (vals.every((k) => k === 1)) best = Math.max(best, 1500);
    if (vals.filter((k) => k === 2).length === 3) best = Math.max(best, 1500);
    if (vals.filter((k) => k === 3).length === 2) best = Math.max(best, 2500);
  }
  return best;
};
/* Every different non-empty selection that scores, as { sel: [values], score }. */
L.fkOptions = function (dice) {
  const c = L.dfCounts(dice), out = [], h = [0, 0, 0, 0, 0, 0, 0];
  (function rec(f) {
    if (f === 7) { const sel = []; for (let v = 1; v <= 6; v++) for (let i = 0; i < h[v]; i++) sel.push(v); if (sel.length) { const s = L.fkScoreSel(sel); if (s > 0) out.push({ sel, score: s }); } return; }
    for (let n = 0; n <= c[f]; n++) { h[f] = n; rec(f + 1); }
    h[f] = 0;
  })(1);
  return out;
};
L.fkFarkle = (dice) => L.fkOptions(dice).length === 0;
/* Is `sel` (values) a sub-multiset of `dice`? */
L.fkWithin = (sel, dice) => { const c = L.dfCounts(dice); return sel.every((v) => c[v]-- > 0); };
/* Phone: which scoring dice to set aside. ctx not needed: it weighs points against the dice it keeps for the next roll. */
L.fkAIPick = function (dice) {
  const POT = [450, 0, 20, 60, 120, 180, 250]; /* worth of having n dice left to roll (0 left = hot dice) */
  let best = null;
  L.fkOptions(dice).forEach((o) => { const v = o.score + POT[dice.length - o.sel.length]; if (!best || v > best.v) best = { v, o }; });
  return best ? best.o : null;
};
/* Phone: bank (true) or roll again (false)? ctx = { score, topOther, finalRound, open (still needs the opening score) }. */
L.fkAIBank = function (turnTotal, diceLeft, ctx) {
  if (ctx.open && turnTotal < L.FK_OPEN) return false;
  if (ctx.score + turnTotal >= L.FK_TARGET && !ctx.finalRound) return true;
  if (ctx.finalRound) return ctx.score + turnTotal > ctx.topOther;
  const THR = [0, 300, 350, 400, 1000, 2000, 1e9];
  let thr = THR[diceLeft];
  if (ctx.topOther - ctx.score > 3000) thr *= 1.5; else if (ctx.score - ctx.topOther > 3000) thr *= 0.8;
  return turnTotal >= thr;
};
/* LOGIC-END */

reg('farkle', 'Farkle', '🥏', 'Push-your-luck dice: roll six dice, set aside scoring dice and decide to roll again or bank. Farkle and you lose the turn. 2 to 4 players, friends or phone, first past 10,000.',
  ['farkle', 'dice', 'zilch', 'push', 'luck'], function (el) {
    const T = tracker(), ID = 'farkle';
    const sv = gget(ID);
    let np = [2, 3, 4].includes(sv.np) ? sv.np : 2, seats = Array.isArray(sv.seats) && sv.seats.length === 3 ? sv.seats.map((x) => (x === 'f' ? 'f' : 'p')) : ['p', 'p', 'p'], needOpen = sv.open !== false;
    let pl = [], turn = 0, tt = 0, left = 6, dice = [], sel = [], kept = [], phase = 'setup', msg = '', token = 0, finalBy = -1, over = false;
    const root = mount(el, `
      <div id="setup"></div>
      <div id="play" hidden>
        <div id="sb" style="display:flex;flex-wrap:wrap;gap:6px;margin:6px 0"></div>
        <div class="stats">${stat('tt', 'Turn total', 0)}${stat('sc', 'Selected', 0)}</div>
        <div class="msg" id="msg"></div>
        <div class="muted" style="font-size:12px;text-align:center">Set aside</div>
        <div id="kp" class="dice" style="min-height:30px"></div>
        <div id="dc" class="dice" style="min-height:52px"></div>
        <div class="acts"><button class="btn alt" id="aside">Set aside</button><button class="btn" id="roll">Roll</button><button class="btn alt" id="bank">Bank</button></div>
        <div class="acts"><button class="btn alt" id="menu">New game</button></div>
      </div>
      <div class="muted" style="font-size:12px;text-align:center;margin-top:6px">Singles: 1 = 100, 5 = 50. Three of a kind: 1s 1000, others 100 x number. Four 1000, five 2000, six 3000. Straight 1500, three pairs 1500, two triplets 2500. Use all six dice for hot dice and roll them all again.</div>`);
    const names = () => {
      const nF = seats.slice(0, np - 1).filter((x) => x === 'f').length, nP = np - 1 - nF; let f = 0, p = 0;
      return Array.from({ length: np }, (_, i) => (i === 0 ? 'You' : seats[i - 1] === 'f' ? 'Friend' + (nF > 1 ? ' ' + (++f) : '') : 'Phone' + (nP > 1 ? ' ' + (++p) : '')));
    };
    function paintSetup() {
      phase = 'setup';
      $('#play', root).hidden = true;
      $('#setup', root).innerHTML = `
        <div class="card"><b>Players</b>${seg('np', [[2, '2'], [3, '3'], [4, '4']], np)}
        <div class="muted" style="font-size:13px">Player 1 is you. Tap a seat to switch it between a friend sharing this phone and the phone.</div>
        <div class="acts">${Array.from({ length: np - 1 }, (_, i) => '<button class="btn alt seat" data-s="' + i + '">Seat ' + (i + 2) + ': ' + (seats[i] === 'f' ? '👤 Friend' : '🤖 Phone') + '</button>').join('')}</div>
        <label style="display:flex;align-items:center;gap:10px;min-height:44px;padding:4px 0"><input type="checkbox" id="open" ${needOpen ? 'checked' : ''} style="width:24px;height:24px"> Need ${L.FK_OPEN} in one turn to get on the board</label>
        <div class="stats">${stat('w', 'Wins vs phone', (gget(ID).w || 0) + '–' + (gget(ID).l || 0))}${stat('hs', 'Best score', getBest(ID, 'best') || '–')}</div>
        <button class="btn" id="start" style="width:100%">Start game</button></div>`;
    }
    function startGame() {
      token++; const nm = names();
      pl = nm.map((n, i) => ({ name: n, ai: i > 0 && seats[i - 1] === 'p', score: 0 }));
      turn = 0; over = false; finalBy = -1; $('#setup', root).innerHTML = ''; $('#play', root).hidden = false;
      beginTurn();
    }
    function paintBoard() {
      $('#sb', root).innerHTML = pl.map((p, i) => '<div style="flex:1;min-width:70px;padding:6px;border-radius:10px;text-align:center;border:2px solid ' + (i === turn && !over ? 'var(--accent)' : 'var(--line)') + ';background:var(--surface)"><div style="font-size:12px;color:var(--muted)">' + esc(p.name) + '</div><b style="font-size:18px">' + p.score + '</b></div>').join('');
      $('#tt', root).textContent = tt;
      const selVals = dice.filter((_, i) => sel[i]), ss = selVals.length ? L.fkScoreSel(selVals) : 0;
      $('#sc', root).textContent = ss;
      $('#msg', root).textContent = msg;
      const mine = !over && pl[turn] && !pl[turn].ai && phase !== 'busy';
      $('#kp', root).innerHTML = kept.map((v) => dieHTML(v, { dis: true, style: 'width:30px;height:30px;min-width:30px;min-height:30px;padding:3px;border-radius:7px' })).join('');
      $('#dc', root).innerHTML = dice.map((v, i) => dieHTML(v, { i, hold: sel[i], dis: !(mine && phase === 'pick') })).join('');
      const canOpen = !needOpen || pl[turn].score > 0 || tt >= L.FK_OPEN;
      $('#aside', root).disabled = !(mine && phase === 'pick' && ss > 0);
      $('#roll', root).disabled = !(mine && (phase === 'ready' || phase === 'decide'));
      $('#roll', root).textContent = 'Roll ' + left + (left === 1 ? ' die' : ' dice');
      $('#bank', root).disabled = !(mine && phase === 'decide' && canOpen && tt > 0);
      $('#bank', root).textContent = 'Bank ' + tt;
    }
    function beginTurn() {
      tt = 0; left = 6; dice = []; sel = []; kept = []; phase = 'ready';
      msg = pl[turn].ai ? pl[turn].name + ' is playing…' : (pl.length > 1 && pl.some((p) => !p.ai && p !== pl[turn]) ? pl[turn].name + ': your turn' : 'Your turn: roll!');
      paintBoard();
      if (pl[turn].ai) { phase = 'busy'; const my = token; T.to(() => { if (my === token) aiRoll(); }, 700); }
    }
    function doRoll() {
      dice = Array.from({ length: left }, () => 1 + rnd(6)); sel = dice.map(() => false);
      if (L.fkFarkle(dice)) { phase = 'busy'; msg = '💥 Farkle! ' + pl[turn].name + ' loses ' + tt; tt = 0; paintBoard(); const my = token; T.to(() => { if (my === token) endTurn(true); }, 1400); return false; }
      phase = 'pick'; msg = pl[turn].ai ? '' : 'Tap the scoring dice to set aside'; paintBoard(); return true;
    }
    function setAside(selVals) {
      const s = L.fkScoreSel(selVals); tt += s; kept = kept.concat(selVals);
      const rest = []; const c = L.dfCounts(selVals); dice.forEach((v) => { if (c[v] > 0) c[v]--; else rest.push(v); });
      dice = rest; sel = rest.map(() => false); left = rest.length;
      if (left === 0) { left = 6; kept = []; msg = '🔥 Hot dice! Roll all six again'; } else msg = '';
      phase = 'decide'; paintBoard();
    }
    function bank() {
      const p = pl[turn]; p.score += tt; msg = p.name + ' banks ' + tt;
      if (p.score >= L.FK_TARGET && finalBy < 0) { finalBy = turn; msg += ' and passes ' + L.FK_TARGET + '! Everyone else gets one last turn'; }
      tt = 0; endTurn(true);
    }
    function endTurn(keepMsg) {
      const next = (turn + 1) % pl.length;
      if (finalBy >= 0 && next === finalBy) { finish(); return; }
      const m = keepMsg ? msg : '';
      turn = next; beginTurn();
      if (m) { msg = m + (pl[turn].ai ? '' : '. ' + pl[turn].name + ': roll!'); paintBoard(); }
    }
    function finish() {
      over = true; phase = 'over'; let top = 0; pl.forEach((p) => { top = Math.max(top, p.score); });
      const winners = pl.filter((p) => p.score === top).map((p) => p.name);
      msg = '🏁 ' + (winners.length > 1 ? 'Tie: ' + winners.join(' and ') : winners[0] + ' wins') + ' with ' + top;
      const s = gget(ID), vsPhone = pl.some((p) => p.ai);
      if (vsPhone) { if (winners.includes('You')) s.w = (s.w || 0) + 1; else s.l = (s.l || 0) + 1; gput(ID, { w: s.w || 0, l: s.l || 0 }); }
      recBest(ID, 'best', pl[0].score, false);
      paintBoard();
    }
    function aiRoll() {
      const me = pl[turn], my = token;
      if (!doRoll()) return;
      T.to(() => {
        if (my !== token) return;
        const o = L.fkAIPick(dice); sel = dice.map(() => false); const c = L.dfCounts(o.sel); dice.forEach((v, i) => { if (c[v] > 0) { c[v]--; sel[i] = true; } });
        msg = me.name + ' sets aside ' + o.score; paintBoard();
        T.to(() => {
          if (my !== token) return;
          setAside(o.sel); phase = 'busy'; paintBoard();
          const top = Math.max(...pl.filter((p) => p !== me).map((p) => p.score)), ctx = { score: me.score, topOther: top, finalRound: finalBy >= 0, open: needOpen && me.score === 0 };
          T.to(() => {
            if (my !== token) return;
            if (L.fkAIBank(tt, left, ctx)) bank(); else aiRoll();
          }, 800);
        }, 800);
      }, 700);
    }
    $('#dc', root).onclick = (e) => {
      const b = e.target.closest('button'); if (!b || phase !== 'pick' || pl[turn].ai || b.disabled) return;
      const i = +b.dataset.d; sel[i] = !sel[i]; paintBoard();
    };
    $('#aside', root).onclick = () => {
      if (phase !== 'pick' || pl[turn].ai) return;
      const v = dice.filter((_, i) => sel[i]); if (!v.length || L.fkScoreSel(v) <= 0) { msg = 'Only scoring dice can be set aside'; paintBoard(); return; }
      setAside(v);
    };
    $('#roll', root).onclick = () => { if ((phase === 'ready' || phase === 'decide') && !pl[turn].ai) doRoll(); };
    $('#bank', root).onclick = () => { if (phase === 'decide' && !pl[turn].ai) { if (needOpen && pl[turn].score === 0 && tt < L.FK_OPEN) { msg = 'You need ' + L.FK_OPEN + ' to get on the board'; paintBoard(); return; } bank(); } };
    $('#menu', root).onclick = () => { token++; paintSetup(); };
    $('#setup', root).addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'start') { needOpen = $('#open', root).checked; gput(ID, { np, seats, open: needOpen }); startGame(); }
      else if (b.classList.contains('seat')) { const i = +b.dataset.s; seats[i] = seats[i] === 'f' ? 'p' : 'f'; paintSetup(); }
      else if (b.parentNode && b.parentNode.id === 'np') { np = +b.dataset.v; paintSetup(); }
    });
    paintSetup();
    return () => { token++; T.stop(); };
  });

/* =====================================================================
   10. Liar's Dice
   ===================================================================== */
/* LOGIC-START */
/* A bid is { q, f }: "at least q dice show f". Higher means more dice, or the same number of a higher face. */
L.ldHigher = (b, prev) => !prev || b.q > prev.q || (b.q === prev.q && b.f > prev.f);
L.ldValid = (b, prev, total) => !!b && Number.isInteger(b.q) && Number.isInteger(b.f) && b.q >= 1 && b.q <= total && b.f >= 1 && b.f <= 6 && L.ldHigher(b, prev);
/* Dice showing the face over all hands; with wild, ones also count for every other face. */
L.ldCount = (hands, f, wild) => hands.reduce((a, h) => a + h.filter((v) => v === f || (wild && f !== 1 && v === 1)).length, 0);
/* Challenge: the bid stands when there are at least q such dice. Returns { actual, bidderRight }. */
L.ldResolve = (bid, hands, wild) => { const actual = L.ldCount(hands, bid.f, wild); return { actual, bidderRight: actual >= bid.q }; };
/* P(at least k successes in n tries with chance p). */
L.ldTail = function (n, k, p) {
  if (k <= 0) return 1; if (k > n) return 0;
  let sum = 0, c = 1; /* c = C(n, i) */
  for (let i = 0; i <= n; i++) { if (i >= k) sum += c * Math.pow(p, i) * Math.pow(1 - p, n - i); c = c * (n - i) / (i + 1); }
  return Math.min(1, Math.max(0, sum));
};
/* Chance that bid b is true, from the player's own hand and the number of hidden dice. */
L.ldChance = function (b, hand, total, wild) {
  const mine = hand.filter((v) => v === b.f || (wild && b.f !== 1 && v === 1)).length, hidden = total - hand.length;
  return L.ldTail(hidden, b.q - mine, wild && b.f !== 1 ? 1 / 3 : 1 / 6);
};
/* All legal bids above prev. */
L.ldRaises = function (prev, total) {
  const out = [];
  for (let q = 1; q <= total; q++) for (let f = 1; f <= 6; f++) { const b = { q, f }; if (L.ldHigher(b, prev)) out.push(b); }
  return out;
};
/* Phone move: { action: 'bid', q, f } or { action: 'challenge' }. risk in -1..1 (bold is positive). */
L.ldAI = function (hand, total, prev, wild, risk) {
  risk = risk || 0;
  const raises = L.ldRaises(prev, total).map((b) => ({ b, p: L.ldChance(b, hand, total, wild) }));
  if (prev) {
    const pPrev = L.ldChance(prev, hand, total, wild), thr = 0.34 - 0.1 * risk + (Math.random() - 0.5) * 0.08;
    if (pPrev < thr || !raises.length) return { action: 'challenge' };
  }
  if (!raises.length) return { action: 'challenge' };
  let pool;
  if (Math.random() < 0.08 + 0.07 * Math.max(0, risk)) pool = raises.filter((r) => r.p >= 0.2);
  else if (prev) pool = raises.filter((r) => r.p >= 0.5).slice(0, 3);
  else pool = raises.filter((r) => r.p >= 0.5).slice(-4);
  if (!pool.length) { let best = raises[0]; raises.forEach((r) => { if (r.p > best.p) best = r; }); pool = [best]; }
  const c = pick(pool);
  return { action: 'bid', q: c.b.q, f: c.b.f };
};
/* LOGIC-END */

reg('liarsdice', "Liar's Dice", '🥃', 'Bluff against 1 to 3 phone players: bid how many dice of a face are under all the cups, or call the last bid a lie. Lose a die when you are wrong; last player with dice wins.',
  ['liar', 'dice', 'bluff', 'perudo', 'cup'], function (el) {
    const T = tracker(), ID = 'liarsdice';
    const sv = gget(ID);
    let opp = [1, 2, 3].includes(sv.opp) ? sv.opp : 1, wild = sv.wild !== false, dpp = [3, 4, 5].includes(sv.dpp) ? sv.dpp : 5;
    let pl = [], cur = 0, prev = null, phase = 'setup', msg = '', token = 0, qty = 1, face = 2, loser = -1, resolved = null, over = false;
    const root = mount(el, `
      <div id="setup"></div>
      <div id="play" hidden>
        <div id="tb"></div>
        <div class="msg" id="msg" style="min-height:44px"></div>
        <div id="bid" style="text-align:center;font-size:18px;font-weight:700;margin:4px 0"></div>
        <div class="muted" style="font-size:12px;text-align:center">Your dice (under your cup)</div>
        <div id="me" class="dice"></div>
        <div id="ctl"></div>
        <div class="acts"><button class="btn alt" id="menu">New game</button></div>
      </div>
      <div class="muted" style="font-size:12px;text-align:center;margin-top:6px">A bid says "at least this many dice show this face" among everyone's dice. Raise by bidding more dice, or the same number of a higher face. If you think the last bid is too high, call Liar. Ones count as every face when "Ones are wild" is on.</div>`);
    const alive = () => pl.filter((p) => p.n > 0);
    const total = () => pl.reduce((a, p) => a + p.n, 0);
    const nextAlive = (i) => { for (let k = 1; k <= pl.length; k++) { const j = (i + k) % pl.length; if (pl[j].n > 0) return j; } return i; };
    const faceTxt = (f) => '⚀⚁⚂⚃⚄⚅'[f - 1];
    function paintSetup() {
      phase = 'setup'; $('#play', root).hidden = true;
      $('#setup', root).innerHTML = `<div class="card"><b>Phone opponents</b>${seg('op', [[1, '1'], [2, '2'], [3, '3']], opp)}
        <b>Dice each</b>${seg('dp', [[3, '3'], [4, '4'], [5, '5']], dpp)}
        <label style="display:flex;align-items:center;gap:10px;min-height:44px;padding:4px 0"><input type="checkbox" id="wild" ${wild ? 'checked' : ''} style="width:24px;height:24px"> Ones are wild</label>
        <div class="stats">${stat('w', 'Games won', (gget(ID).w || 0) + '–' + (gget(ID).l || 0))}</div>
        <button class="btn" id="start" style="width:100%">Start game</button></div>`;
    }
    function startGame() {
      token++; const AI = ['Rosa', 'Max', 'Kit'];
      pl = [{ name: 'You', ai: false, n: dpp, hand: [], risk: 0 }].concat(Array.from({ length: opp }, (_, i) => ({ name: AI[i], ai: true, n: dpp, hand: [], risk: [0, 0.6, -0.5][i] })));
      over = false; $('#setup', root).innerHTML = ''; $('#play', root).hidden = false; newRound(0);
    }
    function newRound(starter) {
      pl.forEach((p) => { p.hand = Array.from({ length: p.n }, () => 1 + rnd(6)); });
      prev = null; cur = starter; resolved = null; loser = -1; qty = 1; face = 2;
      phase = pl[cur].ai ? 'ai' : 'bid'; msg = pl[cur].ai ? pl[cur].name + ' opens the bidding…' : 'You open: choose a bid';
      paint(); if (pl[cur].ai) aiMove();
    }
    function paint() {
      const reveal = phase === 'reveal' || over;
      $('#tb', root).innerHTML = '<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center">' + pl.slice(1).map((p, k) => {
        const i = k + 1, hidden = p.hand.map((v) => (reveal && p.n > 0 ? dieHTML(v, { dis: true, hold: resolved && (v === prev.f || (wild && prev.f !== 1 && v === 1)), style: 'width:30px;height:30px;min-width:30px;min-height:30px;padding:3px;border-radius:7px' }) : '<span style="display:inline-block;width:30px;height:30px;border-radius:7px;background:var(--surface2);border:2px solid var(--line);text-align:center;line-height:26px;font-weight:700;color:var(--muted)">?</span>')).join('');
        return '<div style="flex:1;min-width:100px;padding:8px;border-radius:12px;border:2px solid ' + (i === cur && !reveal ? 'var(--accent)' : 'var(--line)') + ';background:var(--surface);opacity:' + (p.n ? 1 : 0.45) + '"><div style="font-weight:700">' + p.name + ' <span class="muted" style="font-weight:400">· ' + p.n + ' dice</span></div><div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:4px;min-height:30px">' + (p.n ? hidden : 'out') + '</div></div>';
      }).join('') + '</div>';
      $('#msg', root).textContent = msg;
      $('#bid', root).innerHTML = prev ? 'Current bid: <span style="font-size:22px">' + prev.q + ' × ' + faceTxt(prev.f) + '</span> <span class="muted" style="font-size:13px;font-weight:400">by ' + pl[prev.by].name + '</span>' : (phase === 'over' ? '' : 'No bid yet');
      $('#me', root).innerHTML = pl[0].n ? pl[0].hand.map((v) => dieHTML(v, { dis: true, hold: reveal && resolved && (v === prev.f || (wild && prev.f !== 1 && v === 1)) })).join('') : '<span class="muted">You are out of dice</span>';
      const c = $('#ctl', root);
      if (phase === 'bid' && !over) {
        const b = { q: qty, f: face }, ok = L.ldValid(b, prev, total());
        c.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;gap:10px;margin:6px 0"><button class="btn alt" data-a="qm" aria-label="Fewer dice" style="min-width:48px;min-height:48px;font-size:22px">−</button><b style="font-size:26px;min-width:40px;text-align:center">' + qty + '</b><button class="btn alt" data-a="qp" aria-label="More dice" style="min-width:48px;min-height:48px;font-size:22px">+</button><span class="muted">dice showing</span></div>' +
          '<div class="dice" id="fc">' + [1, 2, 3, 4, 5, 6].map((f) => dieHTML(f, { i: f, hold: f === face })).join('') + '</div>' +
          '<div class="acts"><button class="btn" data-a="bid"' + (ok ? '' : ' disabled') + '>' + (ok ? 'Bid ' + qty + ' × ' + faceTxt(face) : 'Bid must be higher') + '</button>' + (prev ? '<button class="btn danger" data-a="liar">Liar!</button>' : '') + '<button class="btn alt" data-a="hint">💡 Hint</button></div>';
      } else if (phase === 'reveal') c.innerHTML = '<div class="acts"><button class="btn" data-a="next">' + (alive().length > 1 && pl[0].n > 0 ? 'Next round' : 'See result') + '</button></div>';
      else if (phase === 'over') c.innerHTML = '<div class="acts"><button class="btn" data-a="again">Play again</button></div>';
      else c.innerHTML = '';
    }
    function place(q, f) {
      prev = { q, f, by: cur }; msg = pl[cur].name + (pl[cur].ai ? ' bids ' : ' bid ') + q + ' × ' + faceTxt(f);
      cur = nextAlive(cur);
      if (pl[cur].ai) { phase = 'ai'; msg += '. ' + pl[cur].name + ' is thinking…'; paint(); aiMove(); } else { phase = 'bid'; qty = Math.min(total(), f === 6 ? q + 1 : q); face = f === 6 ? 1 : f + 1; msg += '. Raise or call Liar'; paint(); }
    }
    function challenge() {
      const by = prev.by, hands = pl.map((p) => p.hand), r = L.ldResolve(prev, hands, wild);
      resolved = r; loser = r.bidderRight ? cur : by;
      msg = pl[cur].name + (pl[cur].ai ? ' calls' : ' call') + ' Liar! There ' + (r.actual === 1 ? 'is 1 die' : 'are ' + r.actual + ' dice') + ' showing ' + faceTxt(prev.f) + (wild && prev.f !== 1 ? ' (with wild ones)' : '') + '. ' + (r.bidderRight ? pl[by].name + (by === 0 ? ' were' : ' was') + ' right: ' : 'The bid was too high: ') + (pl[loser].name === 'You' ? 'you lose' : pl[loser].name + ' loses') + ' a die.';
      phase = 'reveal'; paint();
    }
    function aiMove() {
      const my = token, me = pl[cur];
      T.to(() => {
        if (my !== token || phase !== 'ai') return;
        const m = L.ldAI(me.hand, total(), prev, wild, me.risk);
        if (m.action === 'challenge' && prev) challenge(); else if (m.action === 'bid' && L.ldValid(m, prev, total())) place(m.q, m.f);
        else if (prev) challenge(); else place(1, 2);
      }, 1100);
    }
    function afterReveal() {
      pl[loser].n--;
      if (pl[0].n === 0 || alive().length === 1) { endGame(); return; }
      const starter = pl[loser].n > 0 ? loser : nextAlive(loser);
      newRound(starter);
    }
    function endGame() {
      over = true; phase = 'over'; const w = alive()[0], s = gget(ID);
      if (w === pl[0]) { s.w = (s.w || 0) + 1; msg = '🎉 You win the game!'; } else { s.l = (s.l || 0) + 1; msg = pl[0].n === 0 ? 'You are out of dice. ' + w.name + ' wins.' : w.name + ' wins.'; }
      gput(ID, { w: s.w || 0, l: s.l || 0 }); paint();
    }
    $('#ctl', root).onclick = (e) => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      if (b.dataset.d) { face = +b.dataset.d; paint(); return; }
      const a = b.dataset.a; if (!a) return;
      if (phase === 'bid') {
        if (a === 'qm') { qty = Math.max(1, qty - 1); paint(); } else if (a === 'qp') { qty = Math.min(total(), qty + 1); paint(); }
        else if (a === 'bid') { if (L.ldValid({ q: qty, f: face }, prev, total())) place(qty, face); }
        else if (a === 'liar' && prev) challenge();
        else if (a === 'hint') {
          if (prev) { const p = L.ldChance(prev, pl[0].hand, total(), wild); msg = 'Hint: the last bid is true about ' + Math.round(p * 100) + '% of the time' + (p < 0.35 ? '. Calling Liar looks good.' : p > 0.6 ? '. It is likely true: raise.' : '. It is close: your call.'); }
          else { const c = L.ldAI(pl[0].hand, total(), null, wild, 0); msg = 'Hint: try bidding ' + c.q + ' × ' + faceTxt(c.f); qty = c.q; face = c.f; }
          paint();
        }
      } else if (phase === 'reveal' && a === 'next') afterReveal();
      else if (phase === 'over' && a === 'again') startGame();
    };
    $('#menu', root).onclick = () => { token++; paintSetup(); };
    $('#setup', root).addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'start') { wild = $('#wild', root).checked; gput(ID, { opp, wild, dpp }); startGame(); }
      else if (b.parentNode && b.parentNode.id === 'op') { opp = +b.dataset.v; paintSetup(); }
      else if (b.parentNode && b.parentNode.id === 'dp') { dpp = +b.dataset.v; paintSetup(); }
    });
    paintSetup();
    return () => { token++; T.stop(); };
  });

// @@NEXT@@

})();
