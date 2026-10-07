'use strict';
/* PocketKit "Fun" category: party games and trivia (Charades & Draw, Heads Up, Who Am I?, Mafia Moderator,
   Trivia Packs, Spelling Bee, Anagram Race). One IIFE so no globals leak. Pure logic and data are on the object P,
   exported for tests/party.test.js at the very bottom (Node only). All content is family friendly. */
(function () {

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
const pick = (arr) => arr[rnd(arr.length)];
function shuffle(a, rf) {
  a = a.slice(); rf = rf || rnd;
  for (let i = a.length - 1; i > 0; i--) { const j = rf(i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
/* seeded random so "daily" content is the same all day */
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function seeded(seed) {
  let a = (typeof seed === 'string' ? hashStr(seed) : seed) >>> 0;
  return function (n) {
    a = (a + 0x6D2B79F5) >>> 0; let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return n === undefined ? r : Math.floor(r * n);
  };
}
function todayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
const split = (s) => s.split('|').map(x => x.trim()).filter(Boolean);
const clampInt = (v, lo, hi, fb) => { const n = Math.round(+v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fb; };
const reg = (t) => { if (typeof Tools !== 'undefined') Tools.register(t); };
const sget = (k, d) => (typeof Store !== 'undefined' ? Store.get('fun3.' + k, d) : d);
const sset = (k, v) => { if (typeof Store !== 'undefined') Store.set('fun3.' + k, v); };
const P = { rnd, shuffle, seeded, hashStr, todayKey, clampInt };

/* a tool-scoped bag for timers and listeners, cleaned up when the user leaves */
function bag() {
  const ints = [], tos = [], offs = [];
  return {
    every(fn, ms) { const i = setInterval(fn, ms); ints.push(i); return i; },
    after(fn, ms) { const i = setTimeout(fn, ms); tos.push(i); return i; },
    on(target, ev, fn, opt) { target.addEventListener(ev, fn, opt); offs.push(() => target.removeEventListener(ev, fn, opt)); },
    stop(i) { clearInterval(i); clearTimeout(i); },
    clear() { ints.forEach(clearInterval); tos.forEach(clearTimeout); offs.forEach(f => f()); ints.length = tos.length = offs.length = 0; }
  };
}

/* =====================================================================
   1. CHARADES & DRAW
   ===================================================================== */
/* ---- DATA: charades words. Each category has easy / medium / hard lists separated by | ---- */
const CH = {
  movies: { label: 'Movie types', icon: '🎬',
    e: 'a cartoon|a superhero movie|a pirate adventure|a cowboy movie|a robot movie|a dinosaur movie|a space adventure|a princess story|a talking animal film|a magic school story|a sports movie|a detective mystery|a ghost story|a monster movie|a music video|a dance film|a toy story|a fairy tale|a jungle adventure|a treasure hunt|a car race movie|a circus film|a spy movie|a zombie comedy|an underwater adventure|a holiday movie|a school musical|a Christmas film|a farm animal film|a hero rescue movie',
    m: 'a time travel story|a heist film|a disaster movie|a talent show|a western showdown|a mermaid tale|a haunted house film|a prison escape|a mountain rescue|a cooking competition|a teddy bear adventure|a fantasy quest|a wizard battle|a knight and dragon tale|a lost island survival|a talking car film|a shrinking people story|an alien invasion|a caveman comedy|a quiz show|a nature documentary|a puppet show|a silent film|a road trip comedy|a Viking saga|a robot uprising|a snowy mountain adventure|a surfing film|a school sports day|a wedding comedy',
    h: 'a courtroom drama|a stage musical|a ghost ship mystery|a lost city expedition|a heartwarming reunion|a space station thriller|a mad scientist tale|a medieval feast|an Arctic expedition|a haunted carnival|a cooking show disaster|a tale of two brothers|an undercover detective|a never-ending maze|a silent comedy|a magician\'s secret|a clockwork city|a shipwreck survival|a journey to the centre of the earth|a talking mirror story' },
  animals: { label: 'Animals', icon: '🐘',
    e: 'dog|cat|cow|pig|horse|sheep|duck|chicken|frog|fish|bird|rabbit|mouse|lion|tiger|elephant|monkey|bear|snake|giraffe|penguin|owl|bee|butterfly|spider|turtle|dolphin|shark|whale|zebra|kangaroo|crocodile|parrot|hippo|camel',
    m: 'gorilla|flamingo|octopus|seahorse|squirrel|hedgehog|crab|snail|bat|peacock|panda|koala|cheetah|wolf|fox|deer|goat|donkey|rooster|swan|eagle|jellyfish|lobster|rhinoceros|sloth|otter|seal|walrus|toad|caterpillar',
    h: 'armadillo|chameleon|platypus|anteater|praying mantis|porcupine|meerkat|lemur|pelican|woodpecker|tortoise|scorpion|starfish|orca|llama|mole|narwhal|iguana' },
  actions: { label: 'Actions', icon: '🏃',
    e: 'swimming|sleeping|eating|jumping|running|dancing|singing|laughing|crying|reading|writing|drawing|brushing teeth|washing hands|waving|clapping|kicking a ball|throwing a ball|climbing|driving|riding a bike|walking the dog|knocking on a door|yawning|sneezing|hiding|cooking|painting|sweeping|combing hair',
    m: 'skipping rope|playing guitar|blowing bubbles|taking a selfie|flying a kite|making a bed|paddling a canoe|sending a text|juggling|digging a hole|planting a tree|eating spaghetti|ice skating|milking a cow|pushing a shopping cart|carrying heavy boxes|tying shoelaces|pulling a rope|catching a fish|sewing a button|hammering a nail|blowing out candles|walking in the snow|putting on a coat|taking a photo|opening a present|hanging a picture|pulling a wagon|pumping a bike tyre|folding laundry',
    h: 'walking on a tightrope|threading a needle|parallel parking|pitching a tent|untangling headphones|balancing a spoon on your nose|sneaking past a sleeping dragon|chasing a runaway hat|carrying a tray of drinks|searching for lost keys|wrapping an awkward present|building a sandcastle|herding cats|landing a plane|crossing a wobbly bridge|stirring a giant pot|rowing against the wind|catching falling leaves|surfing a big wave' },
  jobs: { label: 'Jobs', icon: '👩‍🚒',
    e: 'doctor|nurse|teacher|farmer|chef|police officer|firefighter|pilot|bus driver|singer|dancer|artist|builder|baker|dentist|vet|postal worker|sailor|astronaut|clown|magician|gardener|house painter|cleaner|waiter|barber|mechanic|librarian|shopkeeper|lifeguard',
    m: 'plumber|electrician|carpenter|photographer|journalist|scientist|detective|judge|architect|tailor|fisherman|zookeeper|coach|referee|musician|juggler|window cleaner|bus conductor|hairdresser|pharmacist|lumberjack|mountain guide|train driver|flight attendant|tour guide|beekeeper|butcher|florist|fashion designer|movie director',
    h: 'a lighthouse keeper|an air traffic controller|a translator|a chimney sweep|a puppeteer|a sculptor|a pastry chef|a mime|an auctioneer|a tightrope walker|a weather forecaster|a ship captain|a stunt performer|a ballet teacher|an inventor|an archaeologist|a sound engineer|a bridge painter' },
  objects: { label: 'Objects', icon: '🪑',
    e: 'ball|chair|table|door|cup|spoon|phone|clock|book|pencil|hat|shoe|bed|umbrella|glasses|bag|key|lamp|television|computer|toothbrush|bicycle|car|boat|plane|balloon|camera|guitar|drum|scissors',
    m: 'telescope|ladder|wheelbarrow|hairdryer|vacuum cleaner|microwave|toaster|hammer|saw|paintbrush|kettle|remote control|suitcase|backpack|wallet|mirror|tent|swing|slide|rocking chair|flashlight|magnifying glass|compass|hourglass|trampoline|skateboard|piano|trumpet|sleeping bag|wind chime',
    h: 'a sundial|a periscope|a lighthouse|a typewriter|a grandfather clock|a kaleidoscope|a spinning wheel|a snow globe|a metronome|a hot air balloon|a drawbridge|a windmill|a washing machine|a barometer|a gramophone|a pogo stick|a unicycle|a puzzle cube' },
  food: { label: 'Food', icon: '🍕',
    e: 'pizza|apple|banana|cake|ice cream|cheese|bread|egg|cookie|popcorn|sandwich|burger|hot dog|carrot|orange|grapes|watermelon|strawberry|pancakes|soup|spaghetti|chocolate|lemon|corn|potato|tomato|cereal|milk|pie|lollipop',
    m: 'sushi|tacos|pretzel|doughnut|cupcake|waffle|pineapple|coconut|mushroom|broccoli|pumpkin|peanut butter|toast|fries|sausage|noodles|rice|jam sandwich|popsicle|cotton candy|candy cane|fruit salad|milkshake|omelette|garlic bread|cheesecake|cinnamon roll|hot chocolate|burrito|avocado',
    h: 'a baked potato|a fondue|a gingerbread house|a sundae with sprinkles|a lasagna|a bowl of porridge|a bunch of bananas|a roasted turkey|dumplings|popping corn|a caramel apple|a bagel with cream cheese|a kebab|a smoothie bowl|a trifle|a stack of crepes|meatballs|a pomegranate' },
  sports: { label: 'Sports', icon: '⚽',
    e: 'football|basketball|tennis|swimming|running|cycling|boxing|golf|skiing|skating|bowling|baseball|cricket|volleyball|gymnastics|archery|fishing|horse riding|surfing|karate|diving|rowing|hockey|badminton|table tennis|rugby|climbing|skateboarding|yoga|sailing',
    m: 'javelin throw|high jump|pole vault|discus|weightlifting|wrestling|fencing|snowboarding|water polo|curling|long jump|hurdles|sprint relay|rock climbing|bungee jumping|trampolining|sumo|kayaking|tug of war|sack race|egg and spoon race|dodgeball|handball|darts|snooker|paragliding|windsurfing|cross-country skiing|ice hockey|beach volleyball',
    h: 'synchronized swimming|ski jumping|the triathlon|speed skating|rhythmic gymnastics|skeleton sledding|canoe slalom|pentathlon|a marathon|a sled dog race|figure skating|kite surfing|lacrosse|squash|polo|the hammer throw|a sailing regatta|shot put' },
  emotions: { label: 'Emotions', icon: '😮',
    e: 'happy|sad|angry|scared|surprised|sleepy|excited|tired|hungry|shy|proud|silly|bored|worried|loved|cold|hot|sick|grumpy|cheerful|brave|lonely|nervous|curious|confused|jealous|relaxed|embarrassed|joyful|calm',
    m: 'disappointed|hopeful|grateful|amazed|annoyed|determined|suspicious|delighted|frustrated|overjoyed|cranky|mischievous|stubborn|thrilled|homesick|terrified|heartbroken|relieved|impatient|playful|awkward|shocked|dizzy|cozy|sneaky|sulking|giggly|startled|lazy|jittery',
    h: 'bittersweet|smug|sheepish|anxious|nostalgic|flustered|skeptical|wistful|triumphant|melancholy|apprehensive|bewildered|indignant|serene|gloomy|overwhelmed|fed up|pleasantly surprised' }
};
/* ---- END DATA ---- */

const CH_LEVELS = { e: 'easy', m: 'medium', h: 'hard' };
const chLevelOf = { easy: 'e', medium: 'm', hard: 'h' };
/* All words for the chosen categories and level ('mixed' = every level). */
P.chItems = function (cats, level) {
  const out = [], lv = chLevelOf[level];
  for (const c of cats) {
    const d = CH[c]; if (!d) continue;
    for (const k of ['e', 'm', 'h']) {
      if (lv && lv !== k) continue;
      for (const w of split(d[k])) out.push({ w, cat: c, lvl: CH_LEVELS[k] });
    }
  }
  return out;
};
P.CH = CH;
P.chCount = () => Object.keys(CH).reduce((n, c) => n + ['e', 'm', 'h'].reduce((m, k) => m + split(CH[c][k]).length, 0), 0);
/* Seconds left for a turn; never negative, tolerant of bad input. */
P.chRemaining = function (startMs, durSec, nowMs) {
  const d = clampInt(durSec, 5, 600, 60), left = Math.ceil((startMs + d * 1000 - nowMs) / 1000);
  return Math.max(0, Math.min(d, left));
};
/* Turn order: turn counter 0.. over teams; returns the team index and the round number (1-based). */
P.chTurn = function (turn, teams) { teams = Math.max(1, teams | 0); return { team: turn % teams, round: Math.floor(turn / teams) + 1 }; };
P.chWinners = function (scores) { const m = Math.max.apply(null, scores); return scores.map((s, i) => s === m ? i : -1).filter(i => i >= 0); };
/* A deck that never repeats until every word was used, then reshuffles (never repeating the last word first). */
P.chDeck = function (items, rf) {
  let order = [], last = null;
  return { next() {
    if (!items.length) return null;
    if (!order.length) { order = shuffle(items, rf); if (order.length > 1 && order[order.length - 1] === last) { const t = order[0]; order[0] = order[order.length - 1]; order[order.length - 1] = t; } }
    last = order.pop(); return last;
  } };
};

reg({
  id: 'charades', name: 'Charades & Draw', icon: '🕺', cat: 'fun',
  desc: 'Word generator for charades and Pictionary with 600+ words, a turn timer, team scoring and pass-and-play.',
  keys: ['pictionary', 'party', 'act', 'draw', 'guess', 'team'], needs: [], pro: false,
  render(el) {
    const B = bag();
    const cfg = Object.assign({ teams: 2, secs: 60, rounds: 3, level: 'mixed', mode: 'act', cats: Object.keys(CH) }, sget('charades.cfg', {}));
    cfg.teams = clampInt(cfg.teams, 1, 4, 2); cfg.secs = [30, 60, 90].includes(+cfg.secs) ? +cfg.secs : 60; cfg.rounds = clampInt(cfg.rounds, 1, 10, 3);
    if (!Array.isArray(cfg.cats)) cfg.cats = Object.keys(CH);
    cfg.cats = cfg.cats.filter(c => CH[c]);
    let names = ['Team 1', 'Team 2', 'Team 3', 'Team 4'];
    let G = null, timerId = null;

    function setup(msg) {
      B.stop(timerId);
      const nameFields = [0, 1, 2, 3].slice(0, cfg.teams).map(i => `<label class="f">Team ${i + 1} name<input type="text" maxlength="14" data-n="${i}" value="${esc(names[i])}"></label>`).join('');
      el.innerHTML = `<div class="card"><div class="mid">Charades &amp; Draw</div><p class="muted center" style="margin:4px 0 10px">${P.chCount()} words. Pass the phone, act it or draw it.</p>
        <div class="row"><label class="f">Teams<select id="cTeams">${[1, 2, 3, 4].map(n => `<option value="${n}"${n === cfg.teams ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="f">Seconds<select id="cSecs">${[30, 60, 90].map(n => `<option value="${n}"${n === cfg.secs ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="f">Rounds<select id="cRounds">${[1, 2, 3, 5, 10].map(n => `<option value="${n}"${n === cfg.rounds ? ' selected' : ''}>${n}</option>`).join('')}</select></label></div>
        <div class="row" style="margin-top:8px"><label class="f">Difficulty<select id="cLevel">${['mixed', 'easy', 'medium', 'hard'].map(n => `<option value="${n}"${n === cfg.level ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="f">Style<select id="cMode"><option value="act"${cfg.mode === 'act' ? ' selected' : ''}>Act it out</option><option value="draw"${cfg.mode === 'draw' ? ' selected' : ''}>Draw it</option></select></label></div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin:10px 0">${Object.keys(CH).map(c => `<button class="chip${cfg.cats.includes(c) ? ' on' : ''}" data-a="cat" data-c="${c}" aria-pressed="${cfg.cats.includes(c)}">${CH[c].icon} ${esc(CH[c].label)}</button>`).join('')}</div>
        <div class="list">${nameFields}</div>
        <div class="muted center" id="cMsg" style="min-height:20px;margin:6px 0">${esc(msg || '')}</div>
        <button class="btn" style="width:100%" data-a="start">Start game</button></div>`;
    }
    function remember() { sset('charades.cfg', { teams: cfg.teams, secs: cfg.secs, rounds: cfg.rounds, level: cfg.level, mode: cfg.mode, cats: cfg.cats }); }
    function scoreboard() {
      return `<div class="list" style="margin-top:10px">${G.teams.map((t, i) => `<div class="item"><span class="grow">${esc(t.name)}</span><b>${t.score}</b></div>`).join('')}</div>`;
    }
    function start() {
      const items = P.chItems(cfg.cats, cfg.level);
      if (!cfg.cats.length || !items.length) return setup('Pick at least one category.');
      remember();
      G = { teams: [], turn: 0, total: cfg.teams * cfg.rounds, deck: P.chDeck(items), word: null, got: 0, startAt: 0, passed: 0 };
      for (let i = 0; i < cfg.teams; i++) G.teams.push({ name: (names[i] || '').trim() || 'Team ' + (i + 1), score: 0 });
      ready();
    }
    function ready() {
      B.stop(timerId);
      const t = P.chTurn(G.turn, cfg.teams);
      el.innerHTML = `<div class="card center"><div class="muted">Round ${t.round} of ${cfg.rounds}</div><div class="mid" style="margin:8px 0">${esc(G.teams[t.team].name)}</div>
        <p class="muted">${cfg.mode === 'draw' ? 'One player draws, the team guesses.' : 'One player acts, the team guesses. No talking!'}</p>
        <p class="muted">Only the ${cfg.mode === 'draw' ? 'artist' : 'actor'} looks at the screen.</p>
        <button class="btn" style="width:100%;margin-top:6px" data-a="go">Start turn (${cfg.secs} s)</button>${scoreboard()}
        <button class="btn alt" style="width:100%;margin-top:10px" data-a="quit">Quit game</button></div>`;
    }
    function nextWord() {
      const it = G.deck.next(); G.word = it;
      const w = $('#cWord', el), m = $('#cMeta', el);
      if (w) { w.textContent = it.w; m.textContent = CH[it.cat].icon + ' ' + CH[it.cat].label + ' · ' + it.lvl; }
    }
    function turn() {
      G.got = 0; G.passed = 0; G.startAt = Date.now();
      el.innerHTML = `<div class="card center"><div class="big" id="cTime">${cfg.secs}</div><div class="progress"><i id="cBar" style="width:100%"></i></div>
        <div class="muted" id="cMeta" style="margin-top:14px"></div>
        <div class="mid" id="cWord" style="min-height:96px;display:flex;align-items:center;justify-content:center;word-break:break-word"></div>
        <div class="muted">Correct this turn: <b id="cGot">0</b></div>
        <div class="row" style="margin-top:12px"><button class="btn" data-a="ok" style="background:var(--ok)">Correct</button><button class="btn alt" data-a="skip">Skip</button></div></div>`;
      nextWord();
      B.stop(timerId);
      timerId = B.every(tick, 200);
    }
    function tick() {
      if (!G) return;
      const left = P.chRemaining(G.startAt, cfg.secs, Date.now()), t = $('#cTime', el);
      if (!t) return;
      t.textContent = left; $('#cBar', el).style.width = (left / cfg.secs * 100) + '%';
      if (left <= 0) endTurn();
    }
    function endTurn() {
      B.stop(timerId); timerId = null;
      try { if (typeof beep === 'function') beep(); } catch (e) { /* no audio */ }
      const t = P.chTurn(G.turn, cfg.teams); G.turn++;
      const last = G.turn >= G.total;
      el.innerHTML = `<div class="card center"><div class="muted">Time is up!</div><div class="mid" style="margin:8px 0">${esc(G.teams[t.team].name)} got ${G.got}</div>${scoreboard()}
        <button class="btn" style="width:100%;margin-top:12px" data-a="${last ? 'final' : 'next'}">${last ? 'See the winner' : 'Next team'}</button></div>`;
    }
    function final() {
      const w = P.chWinners(G.teams.map(t => t.score));
      const msg = w.length === G.teams.length && G.teams.length > 1 ? 'It is a draw!' : w.length > 1 ? 'Joint winners: ' + w.map(i => esc(G.teams[i].name)).join(', ') : (G.teams.length === 1 ? 'You scored ' + G.teams[0].score + '!' : esc(G.teams[w[0]].name) + ' wins!');
      el.innerHTML = `<div class="card center"><div style="font-size:44px">🏆</div><div class="mid">${msg}</div>${scoreboard()}
        <button class="btn" style="width:100%;margin-top:12px" data-a="again">Play again</button><button class="btn alt" style="width:100%;margin-top:8px" data-a="quit">Setup</button></div>`;
    }
    const act = {
      start, go: turn, next() { ready(); }, final, quit() { G = null; setup(); },
      again() { start(); },
      ok() { G.got++; G.teams[P.chTurn(G.turn, cfg.teams).team].score++; $('#cGot', el).textContent = G.got; nextWord(); },
      skip() { G.passed++; nextWord(); },
      cat(b) { const c = b.dataset.c, i = cfg.cats.indexOf(c); if (i >= 0) cfg.cats.splice(i, 1); else cfg.cats.push(c); b.classList.toggle('on', i < 0); b.setAttribute('aria-pressed', String(i < 0)); }
    };
    B.on(el, 'click', e => { const b = e.target.closest('[data-a]'); if (b && act[b.dataset.a]) { if (!G && !['start', 'cat'].includes(b.dataset.a)) return; act[b.dataset.a](b); } });
    B.on(el, 'change', e => {
      const t = e.target;
      if (t.id === 'cTeams') { cfg.teams = clampInt(t.value, 1, 4, 2); setup(); }
      else if (t.id === 'cSecs') cfg.secs = [30, 60, 90].includes(+t.value) ? +t.value : 60;
      else if (t.id === 'cRounds') cfg.rounds = clampInt(t.value, 1, 10, 3);
      else if (t.id === 'cLevel') cfg.level = ['mixed', 'easy', 'medium', 'hard'].includes(t.value) ? t.value : 'mixed';
      else if (t.id === 'cMode') cfg.mode = t.value === 'draw' ? 'draw' : 'act';
    });
    B.on(el, 'input', e => { const t = e.target; if (t.dataset && t.dataset.n !== undefined) names[clampInt(t.dataset.n, 0, 3, 0)] = t.value.slice(0, 14); });
    setup();
    return () => { B.clear(); G = null; };
  }
});

/* =====================================================================
   2. HEADS UP
   ===================================================================== */
/* ---- DATA: Heads Up decks (words separated by |) ---- */
const HU = {
  animals: { label: 'Animals', icon: '🦁', w: 'lion|tiger|bear|wolf|fox|rabbit|squirrel|deer|moose|bison|horse|zebra|giraffe|elephant|hippo|rhino|camel|llama|kangaroo|koala|panda|monkey|gorilla|chimpanzee|sloth|dolphin|whale|shark|octopus|crab|lobster|jellyfish|seahorse|turtle|frog|snake|lizard|crocodile|penguin|owl|eagle|parrot|flamingo|peacock|duck|goose|swan|chicken|rooster|pig|cow|sheep|goat|donkey|dog|cat|hamster|mouse|bat|bee|butterfly|ant|spider|ladybug' },
  food: { label: 'Food & Drink', icon: '🍕', w: 'pizza|burger|sandwich|pasta|noodles|rice|soup|salad|bread|toast|cheese|butter|egg|bacon|pancake|waffle|cereal|yogurt|apple|banana|orange|grapes|strawberry|blueberry|peach|pear|cherry|lemon|mango|pineapple|watermelon|coconut|tomato|potato|carrot|corn|broccoli|onion|garlic|mushroom|cucumber|lettuce|pumpkin|cookie|cake|pie|cupcake|doughnut|chocolate|candy|popcorn|pretzel|ice cream|pudding|honey|jam|sushi|taco|burrito|sausage|milk|juice|lemonade' },
  house: { label: 'Around the House', icon: '🏠', w: 'sofa|chair|table|bed|pillow|blanket|lamp|mirror|clock|door|window|curtain|carpet|fridge|oven|microwave|toaster|kettle|sink|bathtub|shower|towel|soap|toothbrush|shampoo|broom|mop|bucket|ladder|hammer|screwdriver|drill|shelf|bookcase|wardrobe|drawer|desk|television|remote control|radio|computer|telephone|key|lock|doorbell|staircase|chimney|fireplace|garage|garden|fence|mailbox|vase|candle|picture frame|sponge|dishwasher|washing machine|iron|coat hanger' },
  sports: { label: 'Sports & Games', icon: '⚽', w: 'football|basketball|baseball|tennis|golf|cricket|rugby|hockey|volleyball|badminton|swimming|diving|surfing|skiing|snowboarding|skating|cycling|marathon|boxing|karate|judo|wrestling|fencing|archery|gymnastics|yoga|bowling|darts|chess|checkers|playing cards|dominoes|jigsaw puzzle|hide and seek|tag|hopscotch|skipping rope|marbles|kite|frisbee|trampoline|skateboard|scooter|rollerblades|sailing|rowing|kayaking|fishing|rock climbing|hiking|camping|weightlifting|high jump|relay race|tug of war|bingo|table tennis|ice hockey|netball|water skiing|horse riding' },
  places: { label: 'Places', icon: '🗺️', w: 'beach|desert|jungle|forest|mountain|volcano|island|waterfall|river|lake|ocean|cave|farm|village|city|castle|palace|pyramid|lighthouse|bridge|tower|library|museum|zoo|aquarium|circus|theatre|cinema|school|hospital|airport|train station|harbour|market|bakery|supermarket|playground|park|stadium|campsite|igloo|treehouse|windmill|barn|rainforest|canyon|glacier|meadow|swamp|moon|Antarctica|Africa|Australia|Japan|Brazil|Canada|Mexico|Italy|Egypt|Iceland' },
  actions: { label: 'Action Words', icon: '🤸', w: 'jump|run|walk|swim|fly|climb|crawl|hop|skip|dance|sing|whistle|shout|whisper|laugh|cry|yawn|sneeze|cough|snore|sleep|dream|eat|drink|cook|bake|chew|cut|slice|peel|stir|pour|throw|catch|kick|push|pull|lift|carry|drop|dig|paint|draw|write|read|type|knock|wave|clap|point|hug|shake|bow|wink|blink|stare|hide|sneak|tiptoe|stomp|spin|roll|slide|bounce' },
  nature: { label: 'Nature & Weather', icon: '🌦️', w: 'rain|snow|sunshine|thunder|lightning|rainbow|wind|storm|tornado|hurricane|fog|cloud|frost|ice|hail|drizzle|breeze|puddle|flood|drought|sunrise|sunset|moonlight|star|comet|tree|flower|rose|tulip|daisy|sunflower|grass|leaf|branch|root|seed|acorn|mushroom|moss|fern|cactus|bamboo|palm tree|pine cone|earthquake|avalanche|stream|pond|wave|tide|coral reef|cliff|valley|hill|pebble|sand dune|meadow|iceberg|cave|geyser' },
  fantasy: { label: 'Fantasy & Fairy Tales', icon: '🐉', w: 'dragon|unicorn|fairy|wizard|witch|giant|elf|dwarf|mermaid|troll|goblin|ghost|knight|princess|prince|king|queen|castle|crown|sword|shield|magic wand|spell|potion|cauldron|broomstick|crystal ball|treasure map|pirate ship|genie|magic carpet|beanstalk|glass slipper|gingerbread man|talking mirror|enchanted forest|phoenix|griffin|centaur|flying horse|ogre|scarecrow|sorcerer|hero|quest|kingdom|drawbridge|moat|jester|wishing well|magic beans|frog prince|sleeping beauty|three wishes|fairy godmother|treasure chest|secret door|giant spider|talking cat|invisible cloak|magic mirror|hidden island' },
  transport: { label: 'Vehicles', icon: '🚗', w: 'car|bus|truck|van|taxi|motorcycle|bicycle|scooter|tractor|bulldozer|crane|excavator|fire engine|ambulance|police car|school bus|train|tram|subway|monorail|airplane|helicopter|jet|glider|hot air balloon|rocket|spaceship|submarine|ferry|canoe|kayak|yacht|sailboat|speedboat|cruise ship|tugboat|lifeboat|raft|sled|snowmobile|skateboard|roller skates|unicycle|tricycle|wheelbarrow|cart|carriage|limousine|convertible|jeep|caravan|forklift|garbage truck|cement mixer|dump truck|steamroller|ice cream van|parachute|jet ski|rickshaw|bobsled' },
  school: { label: 'School Days', icon: '🏫', w: 'teacher|student|classroom|desk|blackboard|whiteboard|chalk|marker|pencil|pen|eraser|ruler|sharpener|notebook|textbook|backpack|lunchbox|homework|test|exam|quiz|report card|library|playground|recess|school bell|uniform|globe|map|calculator|scissors|glue|crayon|paintbrush|easel|paper|stapler|tape|folder|binder|locker|cafeteria|gym|assembly|principal|librarian|science lab|microscope|experiment|history|geography|maths|spelling|reading|writing|art class|music class|drama class|field trip|sports day|spelling bee|graduation' }
};
/* ---- END DATA ---- */
P.HU = HU;
P.huWords = (id) => (HU[id] ? split(HU[id].w) : []);
/* Tilt detection from the z axis of gravity (m/s2): z < 0 = screen faces the floor (correct), z > 0 = faces the ceiling (pass).
   st = { armed }. The phone must return to roughly upright before another tilt counts. */
P.huTilt = function (z, st) {
  if (!Number.isFinite(z)) return null;
  if (!st.armed) { if (Math.abs(z) < 3) st.armed = true; return null; }
  if (z <= -6.5) { st.armed = false; return 'ok'; }
  if (z >= 6.5) { st.armed = false; return 'pass'; }
  return null;
};

reg({
  id: 'headsup', name: 'Heads Up', icon: '🤳', cat: 'fun',
  desc: 'Hold the phone on your forehead: friends give clues, tilt down for correct and up to pass. 60 second rounds, 10 decks.',
  keys: ['forehead', 'charades', 'party', 'guess', 'tilt', 'word'], needs: ['motion'], pro: false,
  render(el) {
    const B = bag();
    const ROUND = 60;
    let deckId = HU[sget('headsup.deck', 'animals')] ? sget('headsup.deck', 'animals') : 'animals';
    const scores = [];
    let R = null, tid = null, tilt = { armed: false }, motionOn = false;
    const best = () => sget('headsup.best', {});

    function menu() {
      B.stop(tid); detach(); R = null;
      const b = best();
      el.innerHTML = `<div class="card"><div class="mid">Heads Up</div><p class="muted center" style="margin:4px 0 10px">Pick a deck, put the phone on your forehead (screen facing your friends). Tilt down = correct, tilt up = pass.</p>
        <div class="list">${Object.keys(HU).map(k => `<button class="item" data-a="deck" data-d="${k}" style="text-align:left;${k === deckId ? 'outline:2px solid var(--accent)' : ''}" aria-pressed="${k === deckId}"><span style="font-size:24px">${HU[k].icon}</span><span class="grow">${esc(HU[k].label)}</span><span class="muted">${b[k] ? 'best ' + (b[k] | 0) : ''}</span></button>`).join('')}</div>
        <button class="btn" style="width:100%;margin-top:12px" data-a="start">Start with ${esc(HU[deckId].label)}</button>
        ${scores.length ? `<h3 style="margin:14px 0 6px">Score list</h3><div class="list">${scores.map((s, i) => `<div class="item"><span class="grow">Round ${i + 1}: ${esc(HU[s.deck].label)}</span><b>${s.score}</b></div>`).join('')}</div><button class="btn alt" style="width:100%;margin-top:8px" data-a="clear">Clear scores</button>` : ''}</div>`;
    }
    function onMotion(ev) {
      const g = ev && ev.accelerationIncludingGravity; if (!g || !R || R.phase !== 'play') return;
      const r = P.huTilt(+g.z, tilt);
      if (r === 'ok') mark(true); else if (r === 'pass') mark(false);
    }
    function attach() {
      if (motionOn || typeof window === 'undefined') return;
      B.on(window, 'devicemotion', onMotion); motionOn = true;
    }
    function detach() { motionOn = false; }
    async function start() {
      try {
        if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') await DeviceMotionEvent.requestPermission();
      } catch (e) { /* tap buttons still work */ }
      const words = shuffle(P.huWords(deckId));
      R = { phase: 'count', words, i: 0, ok: [], pass: [], t0: 0, c: 3 };
      tilt = { armed: false };
      sset('headsup.deck', deckId);
      attach();
      el.innerHTML = `<div class="card center"><p class="muted">Put the phone on your forehead!</p><div class="big" id="huC" style="font-size:96px">3</div><button class="btn alt" data-a="menu">Cancel</button></div>`;
      B.stop(tid);
      tid = B.every(() => {
        if (!R || R.phase !== 'count') return;
        R.c--; const c = $('#huC', el);
        if (R.c <= 0) { B.stop(tid); play(); } else if (c) c.textContent = R.c;
      }, 1000);
    }
    function play() {
      R.phase = 'play'; R.t0 = Date.now(); tilt = { armed: false };
      el.innerHTML = `<div class="card center" id="huCard"><div class="row"><span class="muted">Score <b id="huS">0</b></span><span class="muted">Time <b id="huT">${ROUND}</b></span></div><div class="progress"><i id="huB" style="width:100%"></i></div>
        <div class="mid" id="huW" style="min-height:150px;display:flex;align-items:center;justify-content:center;font-size:40px;word-break:break-word;border-radius:16px;margin:12px 0"></div>
        <div class="row"><button class="btn alt" data-a="pass">Pass ↑</button><button class="btn" data-a="ok" style="background:var(--ok)">Correct ↓</button></div>
        <button class="btn alt" style="width:100%;margin-top:10px" data-a="menu">Stop</button></div>`;
      show();
      B.stop(tid);
      tid = B.every(() => {
        if (!R || R.phase !== 'play') return;
        const left = P.chRemaining(R.t0, ROUND, Date.now()), t = $('#huT', el);
        if (t) { t.textContent = left; $('#huB', el).style.width = (left / ROUND * 100) + '%'; }
        if (left <= 0) finish();
      }, 200);
    }
    function show() { const w = $('#huW', el); if (w && R) w.textContent = R.words[R.i % R.words.length]; }
    function mark(good) {
      if (!R || R.phase !== 'play') return;
      (good ? R.ok : R.pass).push(R.words[R.i % R.words.length]); R.i++;
      const s = $('#huS', el), w = $('#huW', el);
      if (s) s.textContent = R.ok.length;
      if (w) { w.style.background = good ? 'var(--ok)' : 'var(--surface2)'; B.after(() => { if (w) w.style.background = ''; }, 350); }
      try { if (navigator.vibrate) navigator.vibrate(good ? 60 : 25); } catch (e) { /* ignore */ }
      show();
    }
    function finish() {
      B.stop(tid); const r = R; r.phase = 'done';
      try { if (typeof beep === 'function') beep(); } catch (e) { /* ignore */ }
      scores.push({ deck: deckId, score: r.ok.length });
      const b = best(); if (!(b[deckId] >= r.ok.length)) { b[deckId] = r.ok.length; sset('headsup.best', b); }
      const li = (a) => a.length ? a.map(w => `<span class="chip" style="min-height:30px;display:inline-flex;align-items:center;margin:2px">${esc(w)}</span>`).join('') : '<span class="muted">none</span>';
      el.innerHTML = `<div class="card center"><div class="muted">Time is up!</div><div class="big">${r.ok.length}</div><div class="muted">correct</div>
        <h3 style="margin:12px 0 4px">Got it</h3><div>${li(r.ok)}</div><h3 style="margin:12px 0 4px">Passed</h3><div>${li(r.pass)}</div>
        <button class="btn" style="width:100%;margin-top:14px" data-a="start">Play again</button><button class="btn alt" style="width:100%;margin-top:8px" data-a="menu">Decks and scores</button></div>`;
    }
    const act = {
      deck(b) { if (HU[b.dataset.d]) { deckId = b.dataset.d; menu(); } },
      start, menu, clear() { scores.length = 0; menu(); },
      ok() { mark(true); }, pass() { mark(false); }
    };
    B.on(el, 'click', e => { const b = e.target.closest('[data-a]'); if (b && act[b.dataset.a]) act[b.dataset.a](b); });
    menu();
    return () => { B.clear(); R = null; };
  }
});

/* =====================================================================
   3. WHO AM I?
   ===================================================================== */
/* Press-and-hold helper used by Who Am I? and Mafia Moderator: any element with data-hold shows while held. */
function bindHold(B, el, show, hide) {
  let held = false;
  const on = (e) => { const b = e.target.closest && e.target.closest('[data-hold]'); if (!b || held) return; held = true; show(b); };
  const off = () => { if (!held) return; held = false; hide(); };
  B.on(el, 'pointerdown', on); B.on(el, 'pointerup', off); B.on(el, 'pointercancel', off); B.on(el, 'pointerleave', off, true);
  B.on(el, 'contextmenu', e => { if (e.target.closest && e.target.closest('[data-hold]')) e.preventDefault(); });
  B.on(el, 'keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && e.target.closest && e.target.closest('[data-hold]')) { e.preventDefault(); if (!e.repeat) on(e); } });
  B.on(el, 'keyup', e => { if (e.key === ' ' || e.key === 'Enter') off(); });
  B.on(typeof window !== 'undefined' ? window : el, 'blur', off);
}

/* ---- DATA: generic identities (never real people), grouped by category, separated by | ---- */
const WA = {
  heroes: { label: 'Heroes & Villains', w: 'a superhero with a cape|a caped crime fighter|a masked vigilante|a hero who can fly|a hero who can turn invisible|a hero with super strength|a hero who climbs walls|a super fast runner|a hero with a shield|a teenage sidekick|a hero who controls ice|a hero who controls fire|a hero who talks to animals|a mad scientist villain|an evil genius|a villain with a secret lair|a cackling supervillain|a robot sidekick|a hero in a mask and tights|a villain with an army of robots|a shrinking hero|a hero who can read minds|a time-travelling hero|a hero from the future|a villain who steals the moon|a friendly alien hero' },
  fantasy: { label: 'Fantasy', w: 'a friendly dragon|a fairy godmother|a wise old wizard|a wicked witch|a mischievous elf|a brave knight|a sleepy giant|a mermaid princess|a goblin king|a talking unicorn|a forest troll|a ghost in a castle|a sorcerer\'s apprentice|a cheerful dwarf|a dragon tamer|a centaur archer|a phoenix|a tiny pixie|a genie in a lamp|a gingerbread man|a wandering minstrel|a court jester|a royal queen|a young prince|a fire-breathing dragon|a talking scarecrow|a fairy-tale giant|a magic carpet pilot|a swamp ogre' },
  adventure: { label: 'Explorers & Adventurers', w: 'a pirate captain|a famous astronaut|a deep-sea diver|a jungle explorer|a mountain climber|a polar explorer|a treasure hunter|a cowboy sheriff|a desert nomad|a space pilot|an Arctic researcher|a ship\'s navigator|a lost-world archaeologist|a famous aviator|a Viking warrior|a samurai warrior|a medieval knight|an ancient Egyptian pharaoh|a Roman gladiator|a Wild West outlaw|a gold prospector|a round-the-world sailor|a moon-landing crew member|a volcano scientist|a cave explorer|a safari guide|a Mars rover engineer|a space tourist|a castaway on an island|a shipwrecked sailor' },
  stage: { label: 'Stage & Screen', w: 'a rock star|a famous magician|a circus ringmaster|a trapeze artist|a stand-up comedian|a ballet dancer|an opera singer|a street musician|a puppet master|a movie director|a famous chef|a talk-show host|a mime artist|a clown|a pop singer|a drummer in a band|a DJ|a stunt double|a news reporter|a fashion model|a juggler|a ventriloquist|a quiz show host|a cartoon voice actor|a famous painter|a sculptor|a fairground showman|a school-play star|a street dancer|a sports commentator' },
  sports: { label: 'Sports Stars', w: 'an Olympic gold medallist|a world champion sprinter|a famous goalkeeper|a tennis champion|a famous racing driver|a basketball legend|a gymnast on the beam|a marathon runner|a champion swimmer|a golf champion|a boxing champion|a ski jump champion|a famous referee|a baseball pitcher|a cricket captain|a figure skater|a mountain biker|a surfing champion|a football manager|a weightlifter|a world chess champion|an archery champion|a rugby captain|a skateboarding star|a rowing team captain|a legendary coach|a hockey goalie|a pole vaulter|a long jumper|a table tennis champion' },
  jobs: { label: 'Everyday Heroes', w: 'a firefighter rescuing a cat|a brave lifeguard|a kind nurse|a village doctor|a friendly postman|a lighthouse keeper|a school headteacher|a farmer at harvest|a train conductor|a bus driver|a police detective|a chef in a busy kitchen|a baker at dawn|an air traffic controller|a space mission controller|a beekeeper|a toy maker|a clockmaker|a librarian|a zookeeper|a vet|a wildlife ranger|a mountain rescue worker|a coastguard|a snow plough driver|a gardener|an inventor in a workshop|a famous scientist|a weather forecaster|a famous author' },
  creatures: { label: 'Creatures & Characters', w: 'a talking parrot|a clever fox|a wise old owl|a grumpy bear|a sneaky cat|a loyal sheepdog|a cheeky monkey|a lazy sloth|a proud peacock|a hungry caterpillar|a busy bee|a sleepy koala|a brave little mouse|a friendly robot|a lost puppy|a wise tortoise|a singing frog|a dancing penguin|a talking teddy bear|a toy soldier|a rag doll|a living snowman|a friendly ghost|a space alien|a rubber duck|a runaway pancake|a pet dragon|a talking tree|a clumsy giraffe|a swimming whale' }
};
/* ---- END DATA ---- */
P.WA = WA;
P.waAll = (cats) => { const out = []; for (const c of (cats || Object.keys(WA))) if (WA[c]) for (const w of split(WA[c].w)) out.push({ w, cat: c }); return out; };
/* Deal n distinct identities from the chosen categories (n capped to the pool size). */
P.waDeal = function (n, cats, rf) {
  const pool = shuffle(P.waAll(cats), rf);
  n = clampInt(n, 2, 12, 4);
  return pool.slice(0, n);
};

reg({
  id: 'whoami', name: 'Who Am I?', icon: '🥸', cat: 'fun',
  desc: 'Secret identity cards to reveal privately, pass-around style: 150+ famous types for a guess-who party game.',
  keys: ['guess who', 'identity', 'party', 'card', 'secret', 'sticker'], needs: [], pro: false,
  render(el) {
    const B = bag();
    const cfg = Object.assign({ n: 4, cats: Object.keys(WA) }, sget('whoami.cfg', {}));
    cfg.n = clampInt(cfg.n, 2, 12, 4);
    if (!Array.isArray(cfg.cats)) cfg.cats = Object.keys(WA);
    cfg.cats = cfg.cats.filter(c => WA[c]);
    let D = null, idx = 0, shown = false;

    function setup(msg) {
      D = null;
      el.innerHTML = `<div class="card"><div class="mid">Who Am I?</div><p class="muted center" style="margin:4px 0 10px">${P.waAll().length} identities. Everyone looks at their own card in secret, then asks yes or no questions to guess it.</p>
        <label class="f">Players (2 to 12)<input type="number" id="waN" min="2" max="12" step="1" inputmode="numeric" value="${cfg.n}"></label>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin:12px 0">${Object.keys(WA).map(c => `<button class="chip${cfg.cats.includes(c) ? ' on' : ''}" data-a="cat" data-c="${c}" aria-pressed="${cfg.cats.includes(c)}">${esc(WA[c].label)}</button>`).join('')}</div>
        <div class="muted center" style="min-height:20px;margin-bottom:6px">${esc(msg || '')}</div>
        <button class="btn" style="width:100%" data-a="deal">Deal cards</button></div>`;
    }
    function deal() {
      const nEl = $('#waN', el); if (nEl) cfg.n = clampInt(Valid.num(nEl.value), 2, 12, cfg.n);
      const pool = P.waAll(cfg.cats).length;
      if (!pool) return setup('Pick at least one category.');
      if (pool < cfg.n) return setup('Not enough identities for that many players: pick more categories.');
      sset('whoami.cfg', cfg);
      D = P.waDeal(cfg.n, cfg.cats); idx = 0; pass();
    }
    function pass() {
      shown = false;
      el.innerHTML = `<div class="card center"><div class="muted">Player ${idx + 1} of ${D.length}</div><div class="mid" style="margin:10px 0">Pass the phone to player ${idx + 1}</div>
        <p class="muted">Make sure nobody else is looking, then press and hold the button.</p>
        <div id="waCard" style="min-height:120px;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;margin:10px 0;border:2px dashed var(--line);border-radius:16px;padding:10px;word-break:break-word">?</div>
        <button class="btn" data-hold="1" style="width:100%;min-height:56px;touch-action:none;user-select:none">Hold to reveal</button>
        <button class="btn alt" style="width:100%;margin-top:10px" data-a="next">${idx + 1 >= D.length ? 'Done' : 'Next player'}</button></div>`;
    }
    function done() {
      el.innerHTML = `<div class="card center"><div style="font-size:44px">🎉</div><div class="mid">Everyone has seen their card</div>
        <p class="muted">Now ask yes or no questions in turn. First to guess wins!</p>
        <button class="btn" style="width:100%;margin-top:8px" data-a="all">Show all cards (host)</button><button class="btn alt" style="width:100%;margin-top:8px" data-a="setup">New deal</button></div>`;
    }
    function all() {
      el.innerHTML = `<div class="card"><div class="mid">All cards</div><div class="list" style="margin-top:10px">${D.map((d, i) => `<div class="item"><b>Player ${i + 1}</b><span class="grow">${esc(d.w)}</span></div>`).join('')}</div>
        <button class="btn" style="width:100%;margin-top:12px" data-a="setup">New deal</button></div>`;
    }
    bindHold(B, el, () => { const c = $('#waCard', el); if (c && D) { c.textContent = D[idx].w; shown = true; } }, () => { const c = $('#waCard', el); if (c) c.textContent = '?'; shown = false; });
    const act = {
      deal, setup() { setup(); }, all,
      next() { if (idx + 1 >= D.length) done(); else { idx++; pass(); } },
      cat(b) { const c = b.dataset.c, i = cfg.cats.indexOf(c); if (i >= 0) cfg.cats.splice(i, 1); else cfg.cats.push(c); b.classList.toggle('on', i < 0); b.setAttribute('aria-pressed', String(i < 0)); }
    };
    B.on(el, 'click', e => { const b = e.target.closest('[data-a]'); if (b && act[b.dataset.a]) { if (!D && !['deal', 'cat', 'setup'].includes(b.dataset.a)) return; act[b.dataset.a](b); } });
    setup();
    return () => { B.clear(); D = null; };
  }
});

/* =====================================================================
   4. MAFIA MODERATOR
   ===================================================================== */
const MF_ROLES = {
  villager: { label: 'Villager', icon: '🧑‍🌾', text: 'You have no special power. Find the mafia in the day vote.' },
  mafia: { label: 'Mafia', icon: '🔪', text: 'Each night the mafia silently choose one person to eliminate. Stay hidden by day.' },
  doctor: { label: 'Doctor', icon: '🩺', text: 'Each night you may save one person (yourself too) from the mafia.' },
  detective: { label: 'Detective', icon: '🕵️', text: 'Each night you may investigate one person: the narrator tells you if they are mafia.' },
  vigilante: { label: 'Vigilante', icon: '🎯', text: 'Once in the whole game you may shoot one person at night. Choose wisely.' }
};
/* Suggested role counts for n players. */
P.mfSuggest = function (n) {
  n = clampInt(n, 4, 20, 8);
  return { mafia: Math.max(1, Math.round(n / 4)), doctor: n >= 5 ? 1 : 0, detective: n >= 6 ? 1 : 0, vigilante: 0 };
};
/* Make any requested counts playable: at least 1 mafia, mafia always fewer than the town, specials fit in the group. */
P.mfCounts = function (n, want) {
  n = clampInt(n, 4, 20, 8); want = want || {};
  const c = { mafia: clampInt(want.mafia, 1, 20, 1), doctor: clampInt(want.doctor, 0, 1, 0), detective: clampInt(want.detective, 0, 1, 0), vigilante: clampInt(want.vigilante, 0, 1, 0) };
  let note = '';
  const maxMafia = Math.max(1, Math.floor((n - 1) / 2));
  if (c.mafia > maxMafia) { c.mafia = maxMafia; note = 'Mafia limited to ' + maxMafia + ' so the town can still win.'; }
  for (const k of ['vigilante', 'detective', 'doctor']) {
    if (c.mafia + c.doctor + c.detective + c.vigilante > n) { if (c[k]) { c[k] = 0; note = 'Some special roles were removed: not enough players.'; } }
  }
  c.villager = n - c.mafia - c.doctor - c.detective - c.vigilante;
  return Object.assign(c, { note });
};
/* Shuffled role list. */
P.mfAssign = function (n, counts, rf) {
  const roles = [];
  for (const k of ['mafia', 'doctor', 'detective', 'vigilante', 'villager']) for (let i = 0; i < (counts[k] || 0); i++) roles.push(k);
  while (roles.length < n) roles.push('villager');
  return shuffle(roles.slice(0, n), rf);
};
/* players: [{ role, alive }] -> 'town' | 'mafia' | null */
P.mfWin = function (players) {
  let m = 0, o = 0;
  for (const p of players) if (p.alive) { if (p.role === 'mafia') m++; else o++; }
  if (m === 0) return 'town';
  if (m >= o) return 'mafia';
  return null;
};
/* Resolve one night. a = { kill, save, check, shoot } (player indexes or null). Returns who dies, who was saved and the detective's answer. */
P.mfNight = function (players, a) {
  const ok = (i) => Number.isInteger(i) && i >= 0 && i < players.length && players[i].alive;
  const died = [], saved = [];
  for (const t of [a.kill, a.shoot]) {
    if (!ok(t)) continue;
    if (a.save === t && ok(a.save)) { if (!saved.includes(t)) saved.push(t); continue; }
    if (!died.includes(t)) died.push(t);
  }
  const check = ok(a.check) ? (players[a.check].role === 'mafia' ? 'mafia' : 'town') : null;
  return { died, saved, check };
};
/* The narrator's night script: one step per role in the game, flagged active when that role is alive (and the vigilante still has a shot). */
P.mfSteps = function (players, vigUsed) {
  const has = (r) => players.some(p => p.role === r);
  const live = (r) => players.some(p => p.role === r && p.alive);
  const steps = [{ key: 'mafia', role: 'mafia', active: live('mafia'), wake: 'Mafia, wake up. Silently agree on one person to eliminate, then point to them.', sleep: 'Mafia, go back to sleep.' }];
  if (has('doctor')) steps.push({ key: 'save', role: 'doctor', active: live('doctor'), wake: 'Doctor, wake up. Point to the person you want to save tonight.', sleep: 'Doctor, go back to sleep.' });
  if (has('detective')) steps.push({ key: 'check', role: 'detective', active: live('detective'), wake: 'Detective, wake up. Point to the person you want to investigate.', sleep: 'Detective, go back to sleep.' });
  if (has('vigilante')) steps.push({ key: 'shoot', role: 'vigilante', active: live('vigilante') && !vigUsed, wake: 'Vigilante, wake up. If you want to use your one shot, point to a person. Otherwise shake your head.', sleep: 'Vigilante, go back to sleep.' });
  return steps;
};
/* Optional player names (one per line or comma separated), padded with "Player k" and made unique. */
P.mfNames = function (text, n) {
  n = clampInt(n, 4, 20, 8);
  const raw = String(text || '').split(/[\n,;]+/).map(s => s.replace(/[<>]/g, '').trim().slice(0, 16)).filter(Boolean);
  const out = [], seen = {};
  for (let i = 0; i < n; i++) {
    let nm = raw[i] || 'Player ' + (i + 1);
    const key = nm.toLowerCase(); seen[key] = (seen[key] || 0) + 1;
    if (seen[key] > 1) nm += ' (' + seen[key] + ')';
    out.push(nm);
  }
  return out;
};
P.MF_ROLES = MF_ROLES;

reg({
  id: 'mafiamod', name: 'Mafia Moderator', icon: '🐺', cat: 'fun',
  desc: 'Narrator helper for the Werewolf / Mafia party game: roles, private reveal, night and day script, kill/save/investigate tracking, win check.',
  keys: ['werewolf', 'mafia', 'party', 'narrator', 'moderator', 'town', 'detective', 'doctor'], needs: [], pro: false,
  render(el) {
    const B = bag();
    const cfg = Object.assign({ n: 8, mafia: 2, doctor: 1, detective: 1, vigilante: 0, revealDead: true }, sget('mafiamod.cfg', {}));
    cfg.n = clampInt(cfg.n, 4, 20, 8);
    let namesText = '', G = null, showRoles = false;

    function setup(msg) {
      G = null;
      const c = P.mfCounts(cfg.n, cfg);
      const numF = (id, label, val, max) => `<label class="f">${label}<input type="number" id="${id}" min="0" max="${max}" step="1" inputmode="numeric" value="${val}"></label>`;
      el.innerHTML = `<div class="card"><div class="mid">Mafia Moderator</div><p class="muted center" style="margin:4px 0 10px">You are the narrator. Set the players and roles, then deal.</p>
        <div class="row">${numF('mfN', 'Players (4-20)', cfg.n, 20).replace('min="0"', 'min="4"')}${numF('mfM', 'Mafia', c.mafia, 10).replace('min="0"', 'min="1"')}</div>
        <div class="row" style="margin-top:8px">${numF('mfD', 'Doctor (0-1)', c.doctor, 1)}${numF('mfT', 'Detective (0-1)', c.detective, 1)}${numF('mfV', 'Vigilante (0-1)', c.vigilante, 1)}</div>
        <div class="muted center" id="mfSum" style="margin:8px 0">${summary(c)}</div>
        <label class="f">Player names (optional, one per line)<textarea id="mfNames" rows="3" maxlength="400">${esc(namesText)}</textarea></label>
        <label class="item" style="margin-top:8px;min-height:48px"><input type="checkbox" id="mfRD"${cfg.revealDead ? ' checked' : ''}><span class="grow">Reveal a player's role when they die</span></label>
        <div class="muted center" style="min-height:20px;margin:6px 0">${esc(msg || '')}</div>
        <button class="btn" style="width:100%" data-a="deal">Deal roles</button></div>`;
    }
    const summary = (c) => `${c.mafia} mafia, ${c.doctor} doctor, ${c.detective} detective, ${c.vigilante} vigilante, ${c.villager} villagers${c.note ? '. ' + c.note : ''}`;
    function readCfg() {
      const g = (id) => { const e = $('#' + id, el); return e ? Valid.num(e.value) : null; };
      cfg.n = clampInt(g('mfN'), 4, 20, cfg.n);
      cfg.mafia = clampInt(g('mfM'), 1, 20, cfg.mafia); cfg.doctor = clampInt(g('mfD'), 0, 1, 0);
      cfg.detective = clampInt(g('mfT'), 0, 1, 0); cfg.vigilante = clampInt(g('mfV'), 0, 1, 0);
      const ta = $('#mfNames', el); if (ta) namesText = ta.value.slice(0, 400);
      const rd = $('#mfRD', el); if (rd) cfg.revealDead = rd.checked;
    }
    function deal() {
      readCfg();
      const c = P.mfCounts(cfg.n, cfg); sset('mafiamod.cfg', cfg);
      const names = P.mfNames(namesText, cfg.n), roles = P.mfAssign(cfg.n, c, undefined);
      G = { players: roles.map((r, i) => ({ name: names[i], role: r, alive: true })), phase: 'reveal', idx: 0, night: 0, step: 0, picks: {}, vigUsed: false, log: [], note: c.note };
      reveal();
    }
    function reveal() {
      const p = G.players[G.idx];
      el.innerHTML = `<div class="card center"><div class="muted">Player ${G.idx + 1} of ${G.players.length}</div><div class="mid" style="margin:10px 0">${esc(p.name)}</div>
        <p class="muted">Pass the phone to ${esc(p.name)}. Press and hold to see your role; let go to hide it.</p>
        <div id="mfCard" style="min-height:140px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:2px dashed var(--line);border-radius:16px;padding:10px;margin:10px 0"><div style="font-size:40px">?</div></div>
        <button class="btn" data-hold="1" style="width:100%;min-height:56px;touch-action:none;user-select:none">Hold to reveal</button>
        <button class="btn alt" style="width:100%;margin-top:10px" data-a="rnext">${G.idx + 1 >= G.players.length ? 'Everyone has seen their role' : 'Next player'}</button></div>`;
    }
    function showCard() {
      const c = $('#mfCard', el); if (!c || !G || G.phase !== 'reveal') return;
      const r = MF_ROLES[G.players[G.idx].role];
      c.innerHTML = `<div style="font-size:44px">${r.icon}</div><div class="mid">${r.label}</div><div class="muted" style="margin-top:4px">${esc(r.text)}</div>`;
    }
    function hideCard() { const c = $('#mfCard', el); if (c) c.innerHTML = '<div style="font-size:40px">?</div>'; }
    bindHold(B, el, showCard, hideCard);

    function playersPanel() {
      return `<div class="row" style="margin:10px 0 6px"><b>Players</b><button class="btn alt" data-a="toggleroles" style="flex:none">${showRoles ? 'Hide roles' : 'Show roles'}</button></div>
        <div class="list">${G.players.map((p, i) => `<div class="item" style="${p.alive ? '' : 'opacity:.55'}"><span class="grow">${p.alive ? '' : '💀 '}${esc(p.name)}</span><span class="muted">${showRoles || (!p.alive && cfg.revealDead) ? MF_ROLES[p.role].icon + ' ' + MF_ROLES[p.role].label : (p.alive ? 'alive' : 'out')}</span></div>`).join('')}</div>`;
    }
    function logPanel() { return G.log.length ? `<h3 style="margin:14px 0 6px">Game log</h3><div class="list">${G.log.slice().reverse().map(l => `<div class="item muted">${esc(l)}</div>`).join('')}</div>` : ''; }
    function aliveCount() { return G.players.filter(p => p.alive).length; }

    function startNight() {
      G.phase = 'night'; G.night++; G.step = -1; G.picks = {}; G.steps = P.mfSteps(G.players, G.vigUsed);
      nightStep();
    }
    function nightStep() { G.step++; renderStep(); }
    function renderStep() {
      if (G.step >= G.steps.length) return dawnPrompt();
      const s = G.steps[G.step];
      if (!s.active) {
        el.innerHTML = `<div class="card center"><div class="muted">Night ${G.night}</div><div class="mid" style="margin:8px 0">${MF_ROLES[s.role].icon} ${MF_ROLES[s.role].label}</div>
          <p><i>${esc(s.wake)}</i></p><p class="muted">That role is out of the game. Wait a few seconds anyway so nobody can tell.</p>
          <p><i>${esc(s.sleep)}</i></p><button class="btn" style="width:100%" data-a="nstep">Continue</button></div>`;
        return;
      }
      const sel = G.picks[s.key];
      const opts = G.players.map((p, i) => p.alive ? `<button class="item" data-a="pick" data-i="${i}" style="text-align:left;${sel === i ? 'outline:2px solid var(--accent);background:var(--surface2)' : ''}" aria-pressed="${sel === i}"><span class="grow">${esc(p.name)}</span>${sel === i ? '<b>✓</b>' : ''}</button>` : '').join('');
      el.innerHTML = `<div class="card"><div class="center muted">Night ${G.night}</div><div class="mid center" style="margin:8px 0">${MF_ROLES[s.role].icon} ${MF_ROLES[s.role].label}</div>
        <p class="center"><i>Everyone, close your eyes.</i></p><p class="center"><i>${esc(s.wake)}</i></p>
        <div class="list">${opts}</div>
        <button class="btn alt" style="width:100%;margin-top:8px" data-a="pick" data-i="-1">${s.key === 'mafia' ? 'No kill tonight' : s.key === 'shoot' ? 'Do not shoot' : 'Nobody'}</button>
        <p class="center" style="margin-top:10px"><i>${esc(s.sleep)}</i></p>
        <button class="btn" style="width:100%" data-a="confirm">Confirm</button></div>`;
    }
    function confirmStep() {
      const s = G.steps[G.step];
      if (s.key === 'check') {
        const i = G.picks.check;
        if (Number.isInteger(i) && i >= 0) {
          const r = P.mfNight(G.players, { check: i }).check;
          el.innerHTML = `<div class="card center"><div class="muted">Tell the detective (silently, with a thumbs up or down)</div><div class="mid" style="margin:10px 0">${esc(G.players[i].name)} is ${r === 'mafia' ? 'MAFIA 👍' : 'NOT mafia 👎'}</div>
            <button class="btn" style="width:100%" data-a="nstep">Continue</button></div>`;
          G.log.push('Night ' + G.night + ': detective checked ' + G.players[i].name + ' (' + (r === 'mafia' ? 'mafia' : 'not mafia') + ')');
          return;
        }
      }
      nightStep();
    }
    function dawnPrompt() {
      el.innerHTML = `<div class="card center"><div class="mid">🌅 Dawn</div><p><i>Everyone, wake up!</i></p><button class="btn" style="width:100%" data-a="dawn">Announce what happened</button></div>`;
    }
    function dawn() {
      const pk = G.picks;
      const r = P.mfNight(G.players, { kill: pk.mafia, save: pk.save, shoot: pk.shoot });
      if (Number.isInteger(pk.shoot) && pk.shoot >= 0) G.vigUsed = true;
      for (const i of r.died) G.players[i].alive = false;
      const names = r.died.map(i => G.players[i].name);
      const text = r.died.length ? 'During the night: ' + names.join(' and ') + (r.died.length > 1 ? ' were' : ' was') + ' eliminated.' : 'Nobody was eliminated during the night.';
      if (Number.isInteger(pk.mafia) && pk.mafia >= 0 && r.saved.includes(pk.mafia)) G.log.push('Night ' + G.night + ': the doctor saved ' + G.players[pk.mafia].name);
      G.log.push('Night ' + G.night + ': ' + (names.length ? names.join(', ') + ' eliminated' : 'no one eliminated'));
      const w = P.mfWin(G.players);
      const rolesNote = cfg.revealDead ? r.died.map(i => `${G.players[i].name} was a ${MF_ROLES[G.players[i].role].label}.`).join(' ') : '';
      el.innerHTML = `<div class="card center"><div class="muted">Day ${G.night}</div><div class="mid" style="margin:8px 0">${esc(text)}</div>${rolesNote ? `<p class="muted">${esc(rolesNote)}</p>` : ''}
        <button class="btn" style="width:100%" data-a="${w ? 'over' : 'day'}">${w ? 'See the result' : 'Start the discussion and vote'}</button></div>`;
      G.phase = 'day';
    }
    function day() {
      const opts = G.players.map((p, i) => p.alive ? `<button class="item" data-a="vote" data-i="${i}" style="text-align:left"><span class="grow">${esc(p.name)}</span><span class="muted">vote out</span></button>` : '').join('');
      el.innerHTML = `<div class="card"><div class="center muted">Day ${G.night}</div><div class="mid center" style="margin:8px 0">☀️ Discussion and vote</div>
        <p class="center muted">${aliveCount()} players are alive. Discuss, then tap the player who got the most votes.</p><div class="list">${opts}</div>
        <button class="btn alt" style="width:100%;margin-top:8px" data-a="vote" data-i="-1">No one is voted out</button>${playersPanel()}${logPanel()}</div>`;
    }
    function vote(i) {
      let text = 'Nobody was voted out.';
      if (Number.isInteger(i) && i >= 0 && G.players[i] && G.players[i].alive) {
        G.players[i].alive = false;
        text = G.players[i].name + ' was voted out' + (cfg.revealDead ? ' and was a ' + MF_ROLES[G.players[i].role].label : '') + '.';
      }
      G.log.push('Day ' + G.night + ': ' + text);
      const w = P.mfWin(G.players);
      el.innerHTML = `<div class="card center"><div class="mid" style="margin:8px 0">${esc(text)}</div><button class="btn" style="width:100%" data-a="${w ? 'over' : 'night'}">${w ? 'See the result' : 'Next night'}</button></div>`;
    }
    function over() {
      const w = P.mfWin(G.players);
      el.innerHTML = `<div class="card center"><div style="font-size:48px">${w === 'town' ? '🏘️' : '🔪'}</div><div class="mid">${w === 'town' ? 'The town wins!' : 'The mafia wins!'}</div>
        <div class="list" style="text-align:left;margin-top:12px">${G.players.map(p => `<div class="item" style="${p.alive ? '' : 'opacity:.6'}"><span class="grow">${p.alive ? '' : '💀 '}${esc(p.name)}</span><span>${MF_ROLES[p.role].icon} ${MF_ROLES[p.role].label}</span></div>`).join('')}</div>${logPanel()}
        <button class="btn" style="width:100%;margin-top:12px" data-a="setup">New game</button></div>`;
    }
    const act = {
      deal, setup() { setup(); },
      rnext() { if (G.idx + 1 >= G.players.length) { G.phase = 'ready'; el.innerHTML = `<div class="card center"><div style="font-size:44px">🌙</div><div class="mid">All roles are dealt</div><p class="muted">Put the phone down in front of the narrator. Everyone close your eyes.</p><button class="btn" style="width:100%" data-a="night">Start night 1</button></div>`; } else { G.idx++; reveal(); } },
      night: startNight, nstep: nightStep, confirm: confirmStep, dawn, day, over,
      pick(b) { const i = +b.dataset.i, s = G.steps[G.step]; G.picks[s.key] = i < 0 ? null : i; if (i < 0) confirmStep(); else renderStep(); },
      vote(b) { vote(+b.dataset.i); },
      toggleroles() { showRoles = !showRoles; if (G.phase === 'day') day(); }
    };
    B.on(el, 'click', e => { const b = e.target.closest('[data-a]'); if (b && act[b.dataset.a]) { if (!G && !['deal', 'setup'].includes(b.dataset.a)) return; act[b.dataset.a](b); } });
    B.on(el, 'input', e => {
      const id = e.target.id;
      if (id === 'mfN' || id === 'mfM' || id === 'mfD' || id === 'mfT' || id === 'mfV') {
        readCfg();
        if (id === 'mfN') { const s = P.mfSuggest(cfg.n); Object.assign(cfg, s); for (const [k, v] of [['mfM', s.mafia], ['mfD', s.doctor], ['mfT', s.detective], ['mfV', s.vigilante]]) { const f = $('#' + k, el); if (f) f.value = v; } }
        const c = P.mfCounts(cfg.n, cfg), sm = $('#mfSum', el); if (sm) sm.textContent = summary(c);
      }
    });
    setup();
    return () => { B.clear(); G = null; };
  }
});

/* =====================================================================
   5. TRIVIA PACKS
   ===================================================================== */
/* ---- DATA: countries (UN members). Entries ISO2|Name|Capital separated by ;  An empty capital means the country is left out of the
   Capitals pack because its capital is disputed, shared, divided between cities or has the same name as the country. ---- */
const COUNTRIES = {
  E: 'AL|Albania|Tirana;AD|Andorra|Andorra la Vella;AT|Austria|Vienna;BY|Belarus|Minsk;BE|Belgium|Brussels;BA|Bosnia and Herzegovina|Sarajevo;BG|Bulgaria|Sofia;HR|Croatia|Zagreb;CY|Cyprus|Nicosia;CZ|Czechia|Prague;DK|Denmark|Copenhagen;EE|Estonia|Tallinn;FI|Finland|Helsinki;FR|France|Paris;DE|Germany|Berlin;GR|Greece|Athens;HU|Hungary|Budapest;IS|Iceland|Reykjavik;IE|Ireland|Dublin;IT|Italy|Rome;LV|Latvia|Riga;LI|Liechtenstein|Vaduz;LT|Lithuania|Vilnius;LU|Luxembourg|Luxembourg City;MT|Malta|Valletta;MD|Moldova|Chisinau;MC|Monaco|;ME|Montenegro|Podgorica;NL|Netherlands|Amsterdam;MK|North Macedonia|Skopje;NO|Norway|Oslo;PL|Poland|Warsaw;PT|Portugal|Lisbon;RO|Romania|Bucharest;RU|Russia|Moscow;SM|San Marino|;RS|Serbia|Belgrade;SK|Slovakia|Bratislava;SI|Slovenia|Ljubljana;ES|Spain|Madrid;SE|Sweden|Stockholm;CH|Switzerland|Bern;UA|Ukraine|Kyiv;GB|United Kingdom|London',
  A: 'AF|Afghanistan|Kabul;AM|Armenia|Yerevan;AZ|Azerbaijan|Baku;BH|Bahrain|Manama;BD|Bangladesh|Dhaka;BT|Bhutan|Thimphu;BN|Brunei|Bandar Seri Begawan;KH|Cambodia|Phnom Penh;CN|China|Beijing;GE|Georgia|Tbilisi;IN|India|New Delhi;ID|Indonesia|Jakarta;IR|Iran|Tehran;IQ|Iraq|Baghdad;IL|Israel|;JP|Japan|Tokyo;JO|Jordan|Amman;KZ|Kazakhstan|Astana;KW|Kuwait|Kuwait City;KG|Kyrgyzstan|Bishkek;LA|Laos|Vientiane;LB|Lebanon|Beirut;MY|Malaysia|Kuala Lumpur;MV|Maldives|Male;MN|Mongolia|Ulaanbaatar;MM|Myanmar|Naypyidaw;NP|Nepal|Kathmandu;KP|North Korea|Pyongyang;OM|Oman|Muscat;PK|Pakistan|Islamabad;PH|Philippines|Manila;QA|Qatar|Doha;SA|Saudi Arabia|Riyadh;SG|Singapore|;KR|South Korea|Seoul;LK|Sri Lanka|;SY|Syria|Damascus;TJ|Tajikistan|Dushanbe;TH|Thailand|Bangkok;TL|East Timor|Dili;TR|Turkey|Ankara;TM|Turkmenistan|Ashgabat;AE|United Arab Emirates|Abu Dhabi;UZ|Uzbekistan|Tashkent;VN|Vietnam|Hanoi;YE|Yemen|',
  F: 'DZ|Algeria|Algiers;AO|Angola|Luanda;BJ|Benin|;BW|Botswana|Gaborone;BF|Burkina Faso|Ouagadougou;BI|Burundi|;CV|Cape Verde|Praia;CM|Cameroon|Yaounde;CF|Central African Republic|Bangui;TD|Chad|N\'Djamena;KM|Comoros|Moroni;CD|DR Congo|Kinshasa;CG|Republic of the Congo|Brazzaville;CI|Ivory Coast|;DJ|Djibouti|Djibouti City;EG|Egypt|Cairo;GQ|Equatorial Guinea|;ER|Eritrea|Asmara;SZ|Eswatini|;ET|Ethiopia|Addis Ababa;GA|Gabon|Libreville;GM|Gambia|Banjul;GH|Ghana|Accra;GN|Guinea|Conakry;GW|Guinea-Bissau|Bissau;KE|Kenya|Nairobi;LS|Lesotho|Maseru;LR|Liberia|Monrovia;LY|Libya|Tripoli;MG|Madagascar|Antananarivo;MW|Malawi|Lilongwe;ML|Mali|Bamako;MR|Mauritania|Nouakchott;MU|Mauritius|Port Louis;MA|Morocco|Rabat;MZ|Mozambique|Maputo;NA|Namibia|Windhoek;NE|Niger|Niamey;NG|Nigeria|Abuja;RW|Rwanda|Kigali;ST|Sao Tome and Principe|Sao Tome;SN|Senegal|Dakar;SC|Seychelles|Victoria;SL|Sierra Leone|Freetown;SO|Somalia|Mogadishu;ZA|South Africa|;SS|South Sudan|Juba;SD|Sudan|Khartoum;TZ|Tanzania|Dodoma;TG|Togo|Lome;TN|Tunisia|Tunis;UG|Uganda|Kampala;ZM|Zambia|Lusaka;ZW|Zimbabwe|Harare',
  N: 'AG|Antigua and Barbuda|Saint John\'s;BS|Bahamas|Nassau;BB|Barbados|Bridgetown;BZ|Belize|Belmopan;CA|Canada|Ottawa;CR|Costa Rica|San Jose;CU|Cuba|Havana;DM|Dominica|Roseau;DO|Dominican Republic|Santo Domingo;SV|El Salvador|San Salvador;GD|Grenada|Saint George\'s;GT|Guatemala|Guatemala City;HT|Haiti|Port-au-Prince;HN|Honduras|Tegucigalpa;JM|Jamaica|Kingston;MX|Mexico|Mexico City;NI|Nicaragua|Managua;PA|Panama|Panama City;KN|Saint Kitts and Nevis|Basseterre;LC|Saint Lucia|Castries;VC|Saint Vincent and the Grenadines|Kingstown;TT|Trinidad and Tobago|Port of Spain;US|United States|Washington D.C.',
  S: 'AR|Argentina|Buenos Aires;BO|Bolivia|;BR|Brazil|Brasilia;CL|Chile|Santiago;CO|Colombia|Bogota;EC|Ecuador|Quito;GY|Guyana|Georgetown;PY|Paraguay|Asuncion;PE|Peru|Lima;SR|Suriname|Paramaribo;UY|Uruguay|Montevideo;VE|Venezuela|Caracas',
  O: 'AU|Australia|Canberra;FJ|Fiji|Suva;KI|Kiribati|;MH|Marshall Islands|Majuro;FM|Micronesia|Palikir;NR|Nauru|;NZ|New Zealand|Wellington;PW|Palau|;PG|Papua New Guinea|Port Moresby;WS|Samoa|Apia;SB|Solomon Islands|Honiara;TO|Tonga|Nukualofa;TV|Tuvalu|Funafuti;VU|Vanuatu|Port Vila'
};
/* ---- END DATA ---- */
const CTRY = [];
for (const reg1 of Object.keys(COUNTRIES)) for (const e of COUNTRIES[reg1].split(';')) { const p = e.split('|'); CTRY.push({ iso: p[0], name: p[1], cap: p[2] || '', r: reg1 }); }
P.COUNTRIES = CTRY;
/* Flag emoji from a two letter code (regional indicator symbols). */
P.flag = (iso) => String.fromCodePoint(0x1F1E6 + iso.charCodeAt(0) - 65, 0x1F1E6 + iso.charCodeAt(1) - 65);

/* Static question packs: lines of  question | answer | wrong1 | wrong2 | wrong3 | explanation (optional) */
const TQ = {};
function parseQ(text) {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const p = l.split('|').map(x => x.trim());
    return { q: p[0], a: p[1], d: [p[2], p[3], p[4]], ex: p[5] || '' };
  });
}
P.TQ = TQ;
const TQ_META = {
  flags: { label: 'Flags', icon: '🏁', desc: 'Name the country from its flag' },
  capitals: { label: 'Capitals', icon: '🏛️', desc: 'Name the capital city' },
  science: { label: 'Science', icon: '🔬', desc: 'Physics, chemistry and nature' },
  geography: { label: 'World Geography', icon: '🌍', desc: 'Oceans, rivers, mountains, landmarks' },
  general: { label: 'General Knowledge', icon: '💡', desc: 'A bit of everything' },
  body: { label: 'Human Body', icon: '🫀', desc: 'Bones, organs and senses' },
  space: { label: 'Space', icon: '🚀', desc: 'Planets, stars and missions' }
};
P.TQ_META = TQ_META;
P.tqPackIds = () => Object.keys(TQ_META);
/* The question specs of a pack: static questions, or one spec per country for flags / capitals. */
P.tqSpecs = function (pack) {
  if (pack === 'flags') return CTRY.map(c => ({ k: 'f', c, id: 'f:' + c.iso }));
  if (pack === 'capitals') return CTRY.filter(c => c.cap).map(c => ({ k: 'c', c, id: 'c:' + c.iso }));
  return (TQ[pack] || []).map((x, i) => ({ k: 'q', x, id: pack + ':' + i }));
};
/* Build the playable question: 4 distinct options in shuffled order, ans = index of the right one. */
P.tqBuild = function (spec, rf) {
  rf = rf || rnd; let q, a, d, ex = '', big = '';
  if (spec.k === 'f' || spec.k === 'c') {
    const c = spec.c, key = spec.k === 'f' ? 'name' : 'cap';
    const pool = CTRY.filter(o => o !== c && o[key] && o[key] !== c[key]);
    const same = shuffle(pool.filter(o => o.r === c.r), rf), other = shuffle(pool.filter(o => o.r !== c.r), rf);
    d = [];
    for (const o of same.concat(other)) { if (!d.includes(o[key])) d.push(o[key]); if (d.length === 3) break; }
    a = c[key];
    if (spec.k === 'f') { q = 'Which country does this flag belong to?'; big = P.flag(c.iso); } else q = 'What is the capital of ' + c.name + '?';
  } else { q = spec.x.q; a = spec.x.a; d = spec.x.d.slice(); ex = spec.x.ex; }
  const opts = shuffle([a].concat(d), rf);
  return { q, big, opts, ans: opts.indexOf(a), ex, id: spec.id };
};
/* Ten questions for a round (random, no repeats). */
P.tqRound = function (pack, n, rf) {
  rf = rf || rnd;
  return shuffle(P.tqSpecs(pack), rf).slice(0, n || 10).map(s => P.tqBuild(s, rf));
};
/* Daily five: the same five questions all day, drawn from every pack. */
P.tqDaily = function (dateKey) {
  const rf = seeded('daily5:' + dateKey);
  const packs = shuffle(P.tqPackIds(), rf).slice(0, 5);
  return packs.map(p => { const sp = P.tqSpecs(p); return P.tqBuild(sp[rf(sp.length)], rf); });
};

/* ---- DATA: Science (question | answer | wrong x3 | explanation) ---- */
TQ.science = parseQ(`
What gas do plants take in from the air to make food? | Carbon dioxide | Oxygen | Nitrogen | Hydrogen | Plants use carbon dioxide, water and light to make sugar.
What is the chemical formula for water? | H2O | CO2 | O2 | NaCl | Two hydrogen atoms and one oxygen atom.
What is the centre of an atom called? | Nucleus | Electron | Orbit | Shell | The nucleus holds the protons and neutrons.
What is the hardest natural substance? | Diamond | Gold | Iron | Quartz
What is the chemical symbol for gold? | Au | Ag | Go | Gd | Au comes from the Latin word aurum.
What is the chemical symbol for sodium? | Na | So | Sd | N | Na comes from the Latin word natrium.
What is the chemical symbol for silver? | Ag | Si | Sv | Au | Ag comes from the Latin word argentum.
What is the chemical symbol for iron? | Fe | Ir | In | I | Fe comes from the Latin word ferrum.
What is the chemical symbol for potassium? | K | P | Po | Pt | K comes from the Latin word kalium.
What is the chemical symbol for oxygen? | O | Ox | Og | On
What is the chemical symbol for carbon? | C | Ca | Co | Cr
What is the chemical symbol for helium? | He | H | Hl | Hm
Which gas do humans need to breathe in to live? | Oxygen | Helium | Argon | Neon
At what temperature in Celsius does water boil at sea level? | 100 | 90 | 80 | 120
At what temperature in Celsius does water freeze? | 0 | 10 | -10 | 32 | 32 is the freezing point in Fahrenheit.
Which force pulls objects towards the Earth? | Gravity | Magnetism | Friction | Inertia
What kind of animal is a frog? | Amphibian | Reptile | Mammal | Fish | Amphibians live part of their life in water and part on land.
What is the largest mammal? | Blue whale | Elephant | Giraffe | Hippo | The blue whale is the largest animal that has ever lived.
How many legs does an insect have? | 6 | 8 | 4 | 10 | Spiders have eight legs, so they are not insects.
How many legs does a spider have? | 8 | 6 | 10 | 12
Which part of a plant takes in water from the soil? | Roots | Leaves | Petals | Flowers
What do bees collect from flowers to make honey? | Nectar | Sap | Dew | Seeds
What is the change from caterpillar to butterfly called? | Metamorphosis | Migration | Hibernation | Evaporation
What is the lightest element? | Hydrogen | Helium | Oxygen | Lithium
What is the most common gas in the Earth's air? | Nitrogen | Oxygen | Carbon dioxide | Argon | About 78 percent of the air is nitrogen.
What is the unit of electric current? | Ampere | Volt | Watt | Ohm
What is the unit of force? | Newton | Joule | Pascal | Watt
Which instrument measures temperature? | Thermometer | Barometer | Compass | Speedometer
Which instrument measures air pressure? | Barometer | Thermometer | Anemometer | Hygrometer
What is the study of living things called? | Biology | Geology | Chemistry | Physics
What is the study of rocks and the Earth called? | Geology | Biology | Astronomy | Zoology
What is the study of weather called? | Meteorology | Geology | Zoology | Ecology
Which of these is a mammal that can fly? | Bat | Eagle | Butterfly | Flying fish
What do we call animals that eat only plants? | Herbivores | Carnivores | Omnivores | Insectivores
What do we call animals that eat both plants and meat? | Omnivores | Herbivores | Carnivores | Decomposers
What is a baby frog called? | Tadpole | Cub | Calf | Pup
Which type of rock forms from cooled lava or magma? | Igneous | Sedimentary | Metamorphic | Fossil
What is it called when a liquid turns into a gas? | Evaporation | Condensation | Freezing | Melting
What is it called when water vapour turns into liquid water? | Condensation | Evaporation | Erosion | Melting
Which colour of visible light has the longest wavelength? | Red | Blue | Green | Violet
About how fast does light travel? | 300,000 kilometres per second | 300 kilometres per second | 3,000 kilometres per second | 3 million kilometres per second
Which metal is attracted to magnets? | Iron | Aluminium | Copper | Gold
In which of these does sound travel fastest? | Steel | Air | Water | A vacuum | Sound cannot travel through a vacuum at all.
What mainly causes the tides in the oceans? | The Moon's gravity | Wind | Fish | Ocean currents
What is the pH of pure water? | 7 | 1 | 10 | 14 | Below 7 is acidic and above 7 is alkaline.
What is the chemical name of table salt? | Sodium chloride | Potassium chloride | Sodium hydroxide | Calcium carbonate
What is the process plants use to make food from sunlight called? | Photosynthesis | Respiration | Digestion | Pollination
What is the green pigment in plants called? | Chlorophyll | Keratin | Melanin | Haemoglobin
What is a baby kangaroo called? | Joey | Cub | Kit | Pup
What is a baby sheep called? | Lamb | Calf | Kid | Foal
Which is the fastest land animal? | Cheetah | Lion | Horse | Greyhound
Which is the largest living bird? | Ostrich | Eagle | Albatross | Emu
Which force slows things down when surfaces rub together? | Friction | Gravity | Magnetism | Buoyancy
What do we call a material that does not let electricity pass through easily? | Insulator | Conductor | Magnet | Battery
Which of these is a good conductor of electricity? | Copper | Rubber | Wood | Plastic
What is the layer of gases around the Earth called? | Atmosphere | Lithosphere | Hydrosphere | Biosphere
Which layer of the Earth is the hottest? | Inner core | Crust | Mantle | Ocean floor
What are the three common states of matter? | Solid, liquid and gas | Hot, cold and warm | Heavy, light and soft | Rock, water and air
What makes a rainbow when sunlight shines through rain? | Water droplets bend and split the light | Clouds glow | The wind bends the Sun | Dust reflects colours
Which vitamin can our skin make from sunlight? | Vitamin D | Vitamin C | Vitamin A | Vitamin K
What do we call animals without a backbone? | Invertebrates | Vertebrates | Mammals | Reptiles
What are the three main body parts of an insect? | Head, thorax and abdomen | Head, arms and legs | Shell, body and tail | Front, middle and back
Which gas fills balloons to make them float? | Helium | Oxygen | Carbon dioxide | Nitrogen | Helium is lighter than air.
What is the basic building block of all living things? | Cell | Atom | Organ | Bone
What is hot liquid rock under the ground called? | Magma | Granite | Coal | Sand | Once it erupts onto the surface it is called lava.
Which scientist studies fossils? | Palaeontologist | Archaeologist | Meteorologist | Botanist
Which tool lets you see very tiny things? | Microscope | Telescope | Periscope | Binoculars
Which metal is liquid at normal room temperature? | Mercury | Lead | Tin | Iron
What are the three primary colours of light? | Red, green and blue | Red, yellow and blue | Orange, green and purple | Black, white and grey | Mixing all three lights makes white.
What do we call a group of fish swimming together? | School | Herd | Pack | Flock
What type of energy is stored in a stretched rubber band? | Elastic potential energy | Sound energy | Light energy | Nuclear energy
What happens to most things when they are heated? | They expand | They shrink | They turn blue | They become magnetic
What is the name of the process where animals sleep through winter? | Hibernation | Migration | Metamorphosis | Camouflage
What is the name of a scientist's educated guess that can be tested? | Hypothesis | Conclusion | Fossil | Habitat
Which is a renewable energy source? | Wind | Coal | Oil | Natural gas
What do we call the home of a plant or animal in nature? | Habitat | Organ | Fossil | Orbit
`);
/* ---- END science ---- */

/* ---- DATA: World Geography ---- */
TQ.geography = parseQ(`
Which is the largest ocean? | Pacific Ocean | Atlantic Ocean | Indian Ocean | Arctic Ocean
Which is the smallest ocean? | Arctic Ocean | Indian Ocean | Atlantic Ocean | Pacific Ocean
Which is the largest continent by area? | Asia | Africa | North America | Europe
Which is the smallest continent by land area? | Australia (Oceania) | Europe | Antarctica | South America
Which is the highest mountain above sea level? | Mount Everest | K2 | Kilimanjaro | Mont Blanc
Which is the largest hot desert in the world? | Sahara | Gobi | Kalahari | Arabian Desert
Which continent is the Sahara Desert in? | Africa | Asia | Australia | South America
Which country is the largest by area? | Russia | Canada | China | United States
Which is the smallest country in the world by area? | Vatican City | Monaco | San Marino | Liechtenstein
Which ocean lies between Africa and Australia? | Indian Ocean | Atlantic Ocean | Pacific Ocean | Arctic Ocean
Which is the largest island in the world that is not a continent? | Greenland | Madagascar | Borneo | Iceland
Which imaginary line divides the Earth into northern and southern halves? | Equator | Prime Meridian | Tropic of Cancer | Arctic Circle
Which continent is the coldest? | Antarctica | Asia | Europe | North America
Which country is shaped like a boot? | Italy | Spain | Greece | Portugal
Which river flows through London? | Thames | Seine | Rhine | Danube
Which river flows through Paris? | Seine | Thames | Rhine | Tiber
Which river flows through Rome? | Tiber | Danube | Seine | Po
Which river flows through Cairo? | Nile | Congo | Niger | Zambezi
Which river flows through Baghdad? | Tigris | Nile | Jordan | Indus
Which river flows through Budapest? | Danube | Rhine | Elbe | Vistula
Which mountain range is the longest on land? | Andes | Rockies | Himalayas | Alps
Which mountains lie between France and Spain? | Pyrenees | Alps | Carpathians | Apennines
Which desert covers part of Mongolia and northern China? | Gobi | Sahara | Namib | Atacama
Which is the largest lake in Africa by area? | Lake Victoria | Lake Chad | Lake Tanganyika | Lake Malawi
Which Great Lake lies entirely inside the United States? | Lake Michigan | Lake Superior | Lake Erie | Lake Ontario
In which country is Mount Kilimanjaro? | Tanzania | Kenya | Uganda | Ethiopia
Off the coast of which country is the Great Barrier Reef? | Australia | Fiji | Indonesia | Philippines
Which narrow sea passage separates Spain from Morocco? | Strait of Gibraltar | Bosphorus | Bering Strait | Strait of Hormuz
Which canal joins the Mediterranean Sea and the Red Sea? | Suez Canal | Panama Canal | Kiel Canal | Erie Canal
Which canal joins the Atlantic and Pacific Oceans? | Panama Canal | Suez Canal | Kiel Canal | Corinth Canal
At what longitude does the Prime Meridian lie? | 0 degrees | 90 degrees | 180 degrees | 45 degrees
Which is the largest country in South America by area? | Brazil | Argentina | Peru | Colombia
In which country is most of the Amazon rainforest? | Brazil | Peru | Colombia | Venezuela
Which Italian city is famous for its canals? | Venice | Rome | Milan | Naples
Which country is nicknamed the Land of the Rising Sun? | Japan | China | Thailand | Korea
Which continent has the least rainfall? | Antarctica | Africa | Australia | Asia | Antarctica is a cold desert.
Which is the largest country in Africa by area? | Algeria | Sudan | Libya | DR Congo
Which is the largest coral reef system in the world? | Great Barrier Reef | Red Sea Reef | Belize Barrier Reef | Maldives Reef
Which volcano buried the Roman town of Pompeii? | Mount Vesuvius | Mount Etna | Stromboli | Mount Fuji
Which is the highest uninterrupted waterfall in the world? | Angel Falls | Niagara Falls | Victoria Falls | Iguazu Falls | Angel Falls is in Venezuela.
Which famous waterfall lies on the border of Zambia and Zimbabwe? | Victoria Falls | Niagara Falls | Angel Falls | Iguazu Falls
Which sea is so salty that people float easily? | Dead Sea | Black Sea | Red Sea | Baltic Sea
Which is the deepest known ocean trench? | Mariana Trench | Puerto Rico Trench | Java Trench | Tonga Trench
In which country is Mount Fuji? | Japan | China | South Korea | Philippines
In which country is the ancient city of Petra? | Jordan | Egypt | Turkey | Syria
In which country is Machu Picchu? | Peru | Chile | Bolivia | Mexico
In which country is the Taj Mahal? | India | Pakistan | Bangladesh | Nepal
In which country is the Great Wall? | China | Japan | Mongolia | India
In which country is Stonehenge? | United Kingdom | Ireland | France | Germany
In which country is the Colosseum? | Italy | Greece | Spain | France
In which country are the Pyramids of Giza? | Egypt | Sudan | Libya | Jordan
In which country is Angkor Wat? | Cambodia | Thailand | Vietnam | Laos
In which country is the Eiffel Tower? | France | Belgium | Italy | Switzerland
In which country is Chichen Itza? | Mexico | Peru | Guatemala | Honduras
In which country is the statue of Christ the Redeemer? | Brazil | Argentina | Portugal | Chile
In which country is the Sydney Opera House? | Australia | New Zealand | South Africa | Canada
How many continents are usually counted? | 7 | 5 | 6 | 8
In which direction does the Sun rise? | East | West | North | South
Which two countries share the longest international border? | Canada and the United States | Russia and China | Argentina and Chile | India and Bangladesh
Which lake does Peru share with Bolivia? | Lake Titicaca | Lake Victoria | Lake Superior | Lake Baikal
Which European country is famous for its fjords? | Norway | Spain | Hungary | Poland
Which sea lies between southern Europe and northern Africa? | Mediterranean Sea | Baltic Sea | Black Sea | North Sea
Which is the largest desert in the world when cold deserts are counted? | Antarctica | Sahara | Arabian Desert | Gobi | Deserts are defined by low rainfall, not by heat.
Which is the largest US state by area? | Alaska | Texas | California | Montana
Which US state is made up entirely of islands? | Hawaii | Alaska | Florida | Maine
Which is the longest river in Europe? | Volga | Danube | Rhine | Elbe
Which island country lies just off the south-east coast of India? | Sri Lanka | Madagascar | Maldives | Mauritius
Which ocean is the Bermuda Triangle in? | Atlantic Ocean | Pacific Ocean | Indian Ocean | Arctic Ocean
Which mountains are home to Mount Everest? | Himalayas | Andes | Alps | Rockies
Which desert is found along the coast of Chile? | Atacama | Sahara | Gobi | Kalahari
Which country is both an island and a continent? | Australia | Greenland | Iceland | Madagascar
What do we call a very large mass of ice that moves slowly down a valley? | Glacier | Delta | Canyon | Plateau
What is a piece of land completely surrounded by water called? | Island | Peninsula | Plateau | Valley
What do we call the point where a river meets the sea? | Mouth | Source | Tributary | Spring
What is land almost surrounded by water but joined to the mainland called? | Peninsula | Island | Delta | Plain
Which continent is Brazil in? | South America | North America | Africa | Europe
`);
/* ---- END geography ---- */

/* ---- DATA: General Knowledge ---- */
TQ.general = parseQ(`
How many days are there in a leap year? | 366 | 365 | 364 | 367
How many sides does a hexagon have? | 6 | 5 | 7 | 8
How many sides does an octagon have? | 8 | 6 | 7 | 10
How many colours are there in a rainbow? | 7 | 6 | 8 | 5
How many strings does a standard guitar have? | 6 | 4 | 5 | 8
How many keys does a standard piano have? | 88 | 76 | 92 | 64
How many players from one team are on the field in a football (soccer) match? | 11 | 9 | 10 | 12
How many players from one team are on court in basketball? | 5 | 6 | 7 | 4
How many rings are on the Olympic flag? | 5 | 4 | 6 | 7
What is the main language spoken in Brazil? | Portuguese | Spanish | English | French
What is the main language spoken in Egypt? | Arabic | Turkish | Persian | French
How many letters are in the English alphabet? | 26 | 24 | 28 | 25
What colour do you get by mixing blue and yellow? | Green | Orange | Purple | Brown
What colour do you get by mixing red and white? | Pink | Orange | Purple | Grey
What colour do you get by mixing red and blue? | Purple | Green | Orange | Brown
Which animal is often called the king of the jungle? | Lion | Tiger | Elephant | Gorilla
Which instrument has black and white keys? | Piano | Guitar | Violin | Flute
How many hours are there in a day? | 24 | 12 | 48 | 60
Which fruit is traditionally used to make wine? | Grapes | Apples | Bananas | Lemons
Which is the tallest animal? | Giraffe | Elephant | Camel | Ostrich
Which sport is played at Wimbledon? | Tennis | Golf | Cricket | Badminton
Which sport uses a shuttlecock? | Badminton | Tennis | Squash | Table tennis
In which sport do players score a try? | Rugby | Tennis | Golf | Cricket
Which sport uses a puck? | Ice hockey | Football | Baseball | Golf
What is the currency of Japan? | Yen | Won | Yuan | Ringgit
What is the currency of the United Kingdom? | Pound sterling | Euro | Dollar | Franc
What is the currency of India? | Rupee | Rial | Taka | Dinar
What is the currency of Switzerland? | Swiss franc | Euro | Krona | Pound
Which festival is known as the festival of lights in India? | Diwali | Holi | Eid | Navratri
Which country gave the Statue of Liberty to the United States? | France | Britain | Spain | Italy
In which Italian city is the Leaning Tower? | Pisa | Rome | Florence | Venice
Who painted the Mona Lisa? | Leonardo da Vinci | Michelangelo | Raphael | Vincent van Gogh
Who wrote the play Romeo and Juliet? | William Shakespeare | Charles Dickens | Mark Twain | Jane Austen
Who was the first person to walk on the Moon? | Neil Armstrong | Buzz Aldrin | Yuri Gagarin | Alan Shepard
In which year did humans first land on the Moon? | 1969 | 1959 | 1972 | 1965
Which of the Seven Wonders of the Ancient World still stands today? | Great Pyramid of Giza | Colossus of Rhodes | Hanging Gardens of Babylon | Lighthouse of Alexandria
What is a young goat called? | Kid | Calf | Lamb | Foal
What is a group of lions called? | Pride | Pack | Herd | Flock
What is a group of wolves called? | Pack | Pride | Herd | School
What is a baby swan called? | Cygnet | Cub | Chick | Pup
Which bird is a well-known symbol of peace? | Dove | Eagle | Owl | Crow
Which bird cannot fly? | Penguin | Eagle | Sparrow | Owl
What shape is a stop sign? | Octagon | Hexagon | Circle | Square
How many degrees are there in a right angle? | 90 | 45 | 180 | 60
How many degrees are there in a full circle? | 360 | 180 | 90 | 270
What is 12 times 12? | 144 | 124 | 122 | 154
What is the square root of 81? | 9 | 8 | 7 | 11
What is 7 times 8? | 56 | 54 | 48 | 64
What number does the Roman numeral X stand for? | 10 | 5 | 50 | 100
What number does the Roman numeral C stand for? | 100 | 50 | 500 | 1000
How many zeros are there in one million? | 6 | 5 | 7 | 9
What comes next: 2, 4, 8, 16, ...? | 32 | 24 | 30 | 20
How many months of the year have 31 days? | 7 | 6 | 5 | 8
What do bees live in? | Hive | Nest | Den | Burrow
What do rabbits dig to live in? | Burrow | Hive | Nest | Web
Which instrument is played with a slide? | Trombone | Trumpet | Flute | Clarinet
Which is the largest instrument of the string family? | Double bass | Violin | Viola | Cello
Which language has the most native speakers? | Mandarin Chinese | English | Spanish | Hindi
In which ocean did the Titanic sink? | Atlantic Ocean | Pacific Ocean | Indian Ocean | Arctic Ocean
In which year did the Titanic sink? | 1912 | 1905 | 1920 | 1898
In which year did World War II end? | 1945 | 1939 | 1950 | 1918
Which ancient people built Machu Picchu? | Inca | Aztec | Maya | Romans
What do we call a word with the opposite meaning? | Antonym | Synonym | Acronym | Prefix
What do we call a word with the same meaning as another? | Synonym | Antonym | Acronym | Suffix
What is the plural of mouse? | Mice | Mouses | Mices | Meese
What is the past tense of run? | Ran | Runned | Runs | Running
How many vowels are there in the English alphabet? | 5 | 6 | 4 | 7
What do we call a person who flies an aeroplane? | Pilot | Sailor | Navigator | Conductor
Which month comes right after June? | July | August | May | September
What colour is a ripe banana? | Yellow | Green | Blue | Red
How many days are there in a week? | 7 | 5 | 6 | 8
How many minutes are there in an hour? | 60 | 100 | 30 | 90
How many seconds are there in a minute? | 60 | 100 | 30 | 90
What is the name of the toy that spins on a string and goes up and down? | Yo-yo | Kite | Top | Marble
Which animal is known for its black and white stripes? | Zebra | Tiger | Panda | Skunk
Which musical instrument has a bow? | Violin | Piano | Drum | Trumpet
How many wheels does a bicycle have? | 2 | 3 | 4 | 1
What is frozen water called? | Ice | Steam | Fog | Dew
Which meal is traditionally eaten in the morning? | Breakfast | Lunch | Dinner | Supper
What is the chess piece that can only move diagonally? | Bishop | Rook | Knight | Pawn
How many squares are there on a chessboard? | 64 | 32 | 100 | 81
What is the largest planet in our solar system? | Jupiter | Saturn | Earth | Neptune
What is the opposite of north on a compass? | South | East | West | Up
`);
/* ---- END general ---- */

/* ---- DATA: Human Body ---- */
TQ.body = parseQ(`
How many bones does an adult human body have? | 206 | 106 | 306 | 150 | Babies are born with around 300 bones that join together as they grow.
What is the largest organ of the human body? | Skin | Liver | Heart | Brain
Which organ pumps blood around the body? | Heart | Lungs | Liver | Stomach
How many chambers does the human heart have? | 4 | 2 | 3 | 5
Which blood cells carry oxygen around the body? | Red blood cells | White blood cells | Platelets | Plasma
Which organs do we use to breathe? | Lungs | Kidneys | Liver | Stomach
Which blood cells help fight infections? | White blood cells | Red blood cells | Platelets | Plasma
Which organ is protected by the skull? | Brain | Heart | Lungs | Stomach
What is the longest bone in the human body? | Femur (thigh bone) | Tibia (shin bone) | Humerus | Spine
How many teeth does a full set of adult teeth usually have? | 32 | 28 | 30 | 36
How many baby teeth do children usually have? | 20 | 12 | 28 | 32
What protects the heart and lungs? | Rib cage | Skull | Pelvis | Spine
Which organ is mainly responsible for smell? | Nose | Ear | Tongue | Eye
Which part of the eye gives it its colour? | Iris | Pupil | Cornea | Retina
Which part of the eye lets light in? | Pupil | Iris | Eyelid | Eyelash
Where are the smallest bones in the body found? | In the ear | In the fingers | In the toes | In the wrist | The three tiny ear bones help us hear.
Which organs filter waste from the blood to make urine? | Kidneys | Lungs | Liver | Stomach
Which organ makes bile to help digest fat? | Liver | Stomach | Pancreas | Kidney
Which organ mixes food with strong acid to digest it? | Stomach | Heart | Liver | Brain
Where does most of the nutrient absorption from food happen? | Small intestine | Stomach | Large intestine | Oesophagus
Which tube carries food from the throat to the stomach? | Oesophagus | Trachea | Windpipe | Larynx
What is another name for the windpipe? | Trachea | Oesophagus | Larynx | Bronchus
What is the voice box called? | Larynx | Trachea | Pharynx | Tonsil
Which blood vessels carry blood away from the heart? | Arteries | Veins | Capillaries | Nerves
Which blood vessels carry blood back to the heart? | Veins | Arteries | Capillaries | Tendons
What are the tiniest blood vessels called? | Capillaries | Arteries | Veins | Nerves
About what is normal human body temperature in Celsius? | 37 degrees | 35 degrees | 39 degrees | 41 degrees
What is the hardest substance in the human body? | Tooth enamel | Bone | Fingernail | Cartilage
Which vitamin is found in oranges and lemons? | Vitamin C | Vitamin D | Vitamin K | Vitamin B12
Which mineral helps build strong bones and teeth? | Calcium | Iron | Sodium | Potassium
Which part of the brain helps with balance and coordination? | Cerebellum | Cerebrum | Brain stem | Skull
What type of cells carry messages around the body? | Nerve cells | Skin cells | Fat cells | Blood cells
What is another name for the backbone? | Spine | Skull | Pelvis | Rib
Which of these is a hinge joint? | Knee | Shoulder | Hip | Neck
Which of these is a ball-and-socket joint? | Shoulder | Knee | Elbow | Finger
What joins muscle to bone? | Tendons | Ligaments | Nerves | Veins
What joins bone to bone? | Ligaments | Tendons | Muscles | Arteries
Which is the largest muscle in the human body? | Gluteus maximus | Biceps | Heart | Quadriceps
How many lungs do humans have? | 2 | 1 | 3 | 4
What does the pancreas make that helps control blood sugar? | Insulin | Bile | Saliva | Blood
How many pairs of ribs do humans usually have? | 12 | 10 | 14 | 8
What is the kneecap called? | Patella | Femur | Tibia | Scapula
What is the collarbone called? | Clavicle | Scapula | Sternum | Humerus
What is the shoulder blade called? | Scapula | Clavicle | Patella | Pelvis
What is the shin bone called? | Tibia | Femur | Fibula | Humerus
What is the thigh bone called? | Femur | Tibia | Humerus | Radius
What is the lower jaw bone called? | Mandible | Maxilla | Cranium | Sternum
Which part of the ear vibrates when sound reaches it? | Eardrum | Pupil | Tongue | Retina
Which organ has taste buds? | Tongue | Nose | Ear | Throat
How many main tastes are usually named (sweet, sour, salty, bitter and one more)? | 5 | 4 | 6 | 8 | The fifth taste is umami, a savoury taste.
Which pigment gives skin and hair its colour? | Melanin | Keratin | Chlorophyll | Insulin
What is hair mainly made of? | Keratin | Calcium | Collagen | Melanin
Where is the skin thinnest on the human body? | Eyelids | Palms | Heels | Back
What is the main job of platelets in the blood? | Help blood clot | Carry oxygen | Fight germs | Digest food
What is the liquid part of blood called? | Plasma | Platelets | Marrow | Cartilage
What do the letters DNA stand for? | Deoxyribonucleic acid | Dioxide nitrogen acid | Dense nuclear acid | Digital nerve array
How many chromosomes does a typical human cell have? | 46 | 23 | 48 | 44 | They come in 23 pairs.
About how many times does a resting adult heart beat each minute? | 60 to 100 | 10 to 20 | 120 to 160 | 200 to 250
What are the bones of the fingers called? | Phalanges | Vertebrae | Carpals | Ribs
What do sweat glands in the skin help to do? | Cool the body | Digest food | Make bones | Pump blood
Which organ is the control centre of the body? | Brain | Heart | Lungs | Liver
Which sense do the eyes give us? | Sight | Hearing | Smell | Balance
What do we call the bones that make up the spine? | Vertebrae | Phalanges | Carpals | Ribs
Which organ stores urine until you go to the toilet? | Bladder | Kidney | Liver | Stomach
Which part of the body contains the cochlea? | The ear | The eye | The nose | The heart | The cochlea turns sound vibrations into nerve signals.
What do we call the muscles at the front of the upper arm? | Biceps | Triceps | Deltoids | Abs
What do we call the muscles at the back of the upper arm? | Triceps | Biceps | Calves | Glutes
Which blood type is called the universal red cell donor? | O negative | A positive | B positive | AB positive
Which organ do we use for hearing? | Ear | Nose | Eye | Tongue
Which gas do our cells need that the blood carries from the lungs? | Oxygen | Helium | Nitrogen | Hydrogen
How many senses are traditionally listed for humans? | 5 | 3 | 7 | 9
What is the soft tissue inside many bones where blood cells are made? | Bone marrow | Cartilage | Tendon | Plasma
What is the flexible material that makes up the tip of your nose and ears? | Cartilage | Enamel | Keratin | Marrow
`);
/* ---- END body ---- */

/* ---- DATA: Space ---- */
TQ.space = parseQ(`
What is the closest star to the Earth? | The Sun | Polaris | Sirius | Alpha Centauri
How many planets are in our solar system? | 8 | 9 | 7 | 10
Which is the largest planet in our solar system? | Jupiter | Saturn | Neptune | Earth
Which is the smallest planet in our solar system? | Mercury | Mars | Venus | Earth
Which planet is closest to the Sun? | Mercury | Venus | Earth | Mars
Which is the hottest planet in our solar system? | Venus | Mercury | Mars | Jupiter | Venus is hotter than Mercury because its thick atmosphere traps heat.
Which planet is known as the Red Planet? | Mars | Venus | Jupiter | Mercury
Which planet is famous for its bright rings? | Saturn | Mars | Mercury | Earth
Which planet is farthest from the Sun? | Neptune | Uranus | Saturn | Jupiter
Which planet spins tipped over on its side? | Uranus | Mars | Venus | Mercury
What is the name of the Earth's only natural satellite? | The Moon | Phobos | Titan | Europa
What is the Milky Way? | A galaxy | A planet | A comet | A star
What is a shooting star really? | A meteor | A comet | A planet | A satellite | It is a small piece of space rock burning up in the air.
What do we call a rock from space that lands on the Earth? | Meteorite | Comet | Asteroid | Satellite
What do we call a ball of ice and dust that grows a tail near the Sun? | Comet | Meteor | Planet | Moon
Who was the first human in space? | Yuri Gagarin | Neil Armstrong | Alan Shepard | Buzz Aldrin
Who was the first woman in space? | Valentina Tereshkova | Sally Ride | Mae Jemison | Peggy Whitson
What was the name of the first artificial satellite? | Sputnik 1 | Explorer 1 | Apollo 11 | Vostok 1
Which space telescope was launched in 1990? | Hubble Space Telescope | James Webb Space Telescope | Kepler | Spitzer
Which space mission first landed humans on the Moon? | Apollo 11 | Apollo 13 | Gemini 4 | Mercury 7
About how long does the Earth take to orbit the Sun? | One year | One month | One day | Ten years
About how long does the Moon take to orbit the Earth? | About a month | One day | One week | One year
About how long does the Earth take to spin once on its axis? | 24 hours | 12 hours | 7 days | 365 days
What causes day and night on Earth? | The Earth spinning | The Sun moving round us | The Moon blocking the Sun | Clouds
What causes the seasons on Earth? | The tilt of the Earth's axis | The Earth's distance from the Sun | The Moon's phases | Solar flares
What is the name of our galaxy? | Milky Way | Andromeda | Whirlpool | Pinwheel
Which is the largest moon in the solar system? | Ganymede | Titan | Our Moon | Europa
Which planet has a giant storm called the Great Red Spot? | Jupiter | Mars | Saturn | Neptune
Olympus Mons, the biggest volcano known in the solar system, is on which planet? | Mars | Venus | Earth | Jupiter
On which planet is a day longer than its year? | Venus | Mars | Earth | Jupiter
What is at the centre of our solar system? | The Sun | The Earth | The Moon | Jupiter
What is a light year a measure of? | Distance | Time | Speed | Brightness | A light year is how far light travels in one year.
Which object is the largest in the asteroid belt? | Ceres | Vesta | Pluto | Eris
How many moons does Mars have? | 2 | 0 | 1 | 4
How many natural moons does the Earth have? | 1 | 2 | 0 | 3
What do we call a group of stars that forms a pattern in the sky? | Constellation | Galaxy | Nebula | Planet
Which star is also called the North Star? | Polaris | Sirius | Betelgeuse | Vega
What is the shape of the Milky Way? | Spiral | Square | Ring | Cube
What is a black hole? | A place where gravity is so strong that light cannot escape | A very dark planet | A hole in the Moon | A cloud of cold gas
Who was the first American in space? | Alan Shepard | Neil Armstrong | John Glenn | Buzz Aldrin
About how long does the International Space Station take to orbit the Earth? | 90 minutes | 24 hours | One week | One hour
What was the name of the Apollo 11 lunar landing craft? | Eagle | Columbia | Falcon | Odyssey
Which planet was explored by the Curiosity rover? | Mars | Venus | Jupiter | Mercury
What is the Sun mostly made of? | Hydrogen | Oxygen | Iron | Water
What is a Russian space traveller called? | Cosmonaut | Astronaut | Taikonaut | Pilot
Which planet has the shortest year? | Mercury | Venus | Earth | Mars | Mercury circles the Sun in about 88 days.
Which of these is a dwarf planet? | Pluto | Mars | Neptune | Venus
In which layer of the atmosphere do we live? | Troposphere | Stratosphere | Mesosphere | Thermosphere
What are the dark, flat plains on the Moon called? | Maria | Craters | Mountains | Valleys
What kind of eclipse happens when the Moon passes between the Earth and the Sun? | Solar eclipse | Lunar eclipse | Total eclipse of Mars | Planet eclipse
What kind of eclipse happens when the Earth's shadow falls on the Moon? | Lunar eclipse | Solar eclipse | Star eclipse | Comet eclipse
What do we call the Moon when its whole face is lit? | Full Moon | New Moon | Crescent Moon | Half Moon
Which animal was the first to orbit the Earth, in 1957? | Laika the dog | A monkey | A cat | A mouse
What were NASA's reusable spacecraft, retired in 2011, called? | Space Shuttles | Apollo capsules | Soyuz | Mercury capsules
What feeling do astronauts have in orbit because they are falling around the Earth? | Weightlessness | Extra weight | Dizziness only | Heat
Which planet appears brightest in our night sky? | Venus | Mars | Jupiter | Mercury
What is the outer layer of the Sun's atmosphere called? | Corona | Crust | Core | Shell
What are dark patches on the surface of the Sun called? | Sunspots | Craters | Seas | Valleys
Which planet does the moon Titan orbit? | Saturn | Jupiter | Mars | Neptune
Which planet does the moon Europa orbit? | Jupiter | Saturn | Uranus | Mars
Which planet do the moons Phobos and Deimos orbit? | Mars | Venus | Earth | Jupiter
Which planet does the moon Triton orbit? | Neptune | Saturn | Mars | Venus
Which country launched Sputnik? | Soviet Union | United States | China | Japan
How many astronauts have walked on the Moon in total? | 12 | 6 | 24 | 3
What is the name of the large space telescope launched in December 2021? | James Webb Space Telescope | Hubble Space Telescope | Kepler Telescope | Gaia Telescope
What is the shape of the Earth most like? | A slightly squashed ball | A flat disc | A cube | A cone
What do we call the path of a planet around the Sun? | Orbit | Axis | Crater | Tide
Which is the third planet from the Sun? | Earth | Venus | Mars | Mercury
What are Saturn's rings mostly made of? | Ice and rock | Gas | Liquid water | Dust from the Moon
What does an astronomer study? | Stars, planets and space | Rocks | Plants | The weather
What gas makes up most of Jupiter? | Hydrogen | Oxygen | Carbon dioxide | Methane
What is the name of the NASA programme that landed people on the Moon? | Apollo | Gemini | Voyager | Pioneer
Which planet is known for having the tallest volcano? | Mars | Mercury | Venus | Neptune
What do we call the force that keeps the planets in orbit around the Sun? | Gravity | Friction | Magnetism | Wind
Which of these is a gas giant? | Saturn | Mars | Mercury | Earth
Which of these is a rocky planet? | Earth | Jupiter | Saturn | Neptune
`);
/* ---- END space ---- */

reg({
  id: 'triviapacks', name: 'Trivia Packs', icon: '🥇', cat: 'fun',
  desc: 'Seven trivia packs (flags, capitals, science, geography, general, body, space) with a daily five, streaks and best scores.',
  keys: ['quiz', 'flags', 'capitals', 'science', 'space', 'geography', 'questions', 'daily'], needs: ['storage'], pro: false,
  render(el) {
    const B = bag();
    let S = null;
    const bests = () => sget('triviapacks.best', {});

    function menu() {
      S = null;
      const b = bests(), d = sget('triviapacks.daily', {}), today = todayKey();
      const doneToday = d && d.date === today;
      el.innerHTML = `<div class="card"><div class="mid">Trivia Packs</div><p class="muted center" style="margin:4px 0 10px">Pick a pack for a 10 question round.</p>
        <button class="item" data-a="daily" style="text-align:left;width:100%;outline:2px solid var(--accent)"><span style="font-size:26px">📅</span><span class="grow"><b>Daily five</b><br><span class="muted">Same five questions all day${doneToday ? ' (today: ' + (d.score | 0) + '/5)' : ''}</span></span></button>
        <div class="list" style="margin-top:8px">${P.tqPackIds().map(k => `<button class="item" data-a="pack" data-p="${k}" style="text-align:left"><span style="font-size:26px">${TQ_META[k].icon}</span><span class="grow"><b>${esc(TQ_META[k].label)}</b><br><span class="muted">${esc(TQ_META[k].desc)}</span></span><span class="muted">${b[k] !== undefined ? 'best ' + (b[k] | 0) + '/10' : ''}</span></button>`).join('')}</div>
        <p class="muted center" style="margin-top:10px">Longest streak: <b>${(sget('triviapacks.streak', 0) | 0)}</b></p></div>`;
    }
    function begin(pack, daily) {
      const qs = daily ? P.tqDaily(todayKey()) : P.tqRound(pack, 10);
      S = { pack, daily, qs, i: 0, score: 0, streak: 0, best: 0, answered: false, wrong: [] };
      ask();
    }
    function ask() {
      const q = S.qs[S.i], total = S.qs.length;
      const label = S.daily ? 'Daily five' : TQ_META[S.pack].label;
      el.innerHTML = `<div class="card"><div class="row muted" style="font-size:13px"><span>${esc(label)}: ${S.i + 1}/${total}</span><span style="text-align:center">Score ${S.score}</span><span style="text-align:right">🔥 ${S.streak}</span></div>
        <div class="progress" style="margin:6px 0 12px"><i style="width:${(S.i / total) * 100}%"></i></div>
        ${q.big ? `<div class="center" style="font-size:84px;line-height:1.1;margin:6px 0">${q.big}</div>` : ''}
        <div class="mid" style="font-size:20px;margin:6px 0 14px">${esc(q.q)}</div>
        <div class="list" id="tqOpts">${q.opts.map((o, i) => `<button class="item" data-a="ans" data-i="${i}" style="text-align:left;min-height:48px"><span class="grow">${esc(o)}</span></button>`).join('')}</div>
        <div id="tqFb"></div>
        <button class="btn alt" style="width:100%;margin-top:12px" data-a="menu">Quit</button></div>`;
      S.answered = false;
    }
    function answer(i) {
      if (!S || S.answered) return;
      S.answered = true;
      const q = S.qs[S.i], right = i === q.ans;
      if (right) { S.score++; S.streak++; if (S.streak > S.best) S.best = S.streak; } else { S.streak = 0; S.wrong.push({ q, picked: q.opts[i] }); }
      $$('#tqOpts button', el).forEach((b, k) => {
        b.disabled = true;
        if (k === q.ans) { b.style.background = 'var(--ok)'; b.style.color = '#fff'; } else if (k === i) { b.style.background = 'var(--danger)'; b.style.color = '#fff'; }
      });
      const last = S.i + 1 >= S.qs.length;
      $('#tqFb', el).innerHTML = `<div class="center" style="margin-top:12px"><b>${right ? 'Correct!' : 'Not quite. The answer is ' + esc(q.opts[q.ans]) + '.'}</b>${q.ex ? `<div class="muted" style="margin-top:4px">${esc(q.ex)}</div>` : ''}</div>
        <button class="btn" style="width:100%;margin-top:10px" data-a="next">${last ? 'See results' : 'Next question'}</button>`;
      try { if (navigator.vibrate) navigator.vibrate(right ? 30 : [20, 40, 20]); } catch (e) { /* ignore */ }
    }
    function finish() {
      const total = S.qs.length;
      let prev = null;
      if (S.daily) sset('triviapacks.daily', { date: todayKey(), score: S.score });
      else { const b = bests(); prev = b[S.pack]; if (!(prev >= S.score)) { b[S.pack] = S.score; sset('triviapacks.best', b); } }
      if (S.best > (sget('triviapacks.streak', 0) | 0)) sset('triviapacks.streak', S.best);
      const newBest = !S.daily && !(prev >= S.score) && S.score > 0;
      const msg = S.score === total ? 'Perfect!' : S.score >= total * 0.7 ? 'Great job!' : S.score >= total * 0.4 ? 'Good effort!' : 'Keep practising!';
      el.innerHTML = `<div class="card center"><div class="muted">${S.daily ? 'Daily five' : esc(TQ_META[S.pack].label)}</div><div class="big">${S.score}/${total}</div><div class="mid" style="font-size:22px">${msg}</div>
        <p class="muted">Longest streak this round: <b>${S.best}</b>${newBest ? '<br>🎉 New best score!' : (!S.daily ? '<br>Best: ' + ((bests()[S.pack] | 0)) + '/10' : '')}</p>
        ${S.wrong.length ? '<button class="btn alt" style="width:100%;margin-top:6px" data-a="review">Review mistakes (' + S.wrong.length + ')</button>' : ''}
        <button class="btn" style="width:100%;margin-top:8px" data-a="again">${S.daily ? 'Replay daily five' : 'Play again'}</button><button class="btn alt" style="width:100%;margin-top:8px" data-a="menu">All packs</button></div>`;
    }
    function review() {
      el.innerHTML = `<div class="card"><div class="mid">Review</div><div class="list" style="margin-top:10px">${S.wrong.map(w => `<div class="item" style="display:block"><div>${w.q.big ? '<span style="font-size:36px">' + w.q.big + '</span> ' : ''}<b>${esc(w.q.q)}</b></div>
          <div style="color:var(--danger)">You said: ${esc(w.picked)}</div><div style="color:var(--ok)">Answer: ${esc(w.q.opts[w.q.ans])}</div>${w.q.ex ? `<div class="muted">${esc(w.q.ex)}</div>` : ''}</div>`).join('')}</div>
        <button class="btn" style="width:100%;margin-top:12px" data-a="again">Play again</button><button class="btn alt" style="width:100%;margin-top:8px" data-a="menu">All packs</button></div>`;
    }
    const act = {
      menu, daily() { begin('daily', true); },
      pack(b) { if (TQ_META[b.dataset.p]) begin(b.dataset.p, false); },
      ans(b) { answer(+b.dataset.i); },
      next() { if (S.i + 1 >= S.qs.length) finish(); else { S.i++; ask(); } },
      review, again() { begin(S.pack, S.daily); }
    };
    B.on(el, 'click', e => { const b = e.target.closest('[data-a]'); if (b && act[b.dataset.a]) { if (!S && !['pack', 'daily', 'menu'].includes(b.dataset.a)) return; act[b.dataset.a](b); } });
    menu();
    return () => { B.clear(); S = null; };
  }
});

/* =====================================================================
   6. SPELLING BEE
   ===================================================================== */
/* ---- DATA: dictionary of common English words, 4 to 15 letters, lowercase, no proper nouns, family friendly.
   Prefix compressed to save space: every token is one digit (how many letters it shares with the previous word, 0-9)
   followed by the rest of the word. Derived from the SCOWL word lists (frequency levels 10 and 20), with offensive and
   unpleasant words removed. ---- */
const SB_PACKED = '0aardvark1bandon7ed7ing7s2breviate9ed9es9ing9ion9ions2ide3lities6y2le2normal8ly2olish7ed8s7ing5tion3ut3ve2road2sence5t3olute8ly4rb6ed6ing6s3tract8ion3urd2using5ve2ysmal1cademic8s2celerate4nt6s4pt6able7nce6ed6ing6s4ss6ed7s6ible7ng3ident8al9lly8s3ommodate9tion5panied9es8y9ing6lish9hed9hes9hing4rd6ance6ed6ing9ly6s4unt7ant9ts7ed7ing7s3umulate9ed9es9ing4racy6te8ly4sation9ns5e6d6s5ing5tom8ed8ing8s2hieve7d7ment9nts7s6ing2id2knowledge9ged9ges9ging2orn3ustic2quaintance4ire7d7s6ing5sition2ronym7s4ss2ted3ing4on6s4vate8d8s7ing5e6ly5ities7y3or5s3s3ual6ly2ute1dapt5ation5ed6r5ing5or5s2ded3ict6ed6ing7ve6s4ng4tion8al9lly8s3ress7ed8s7ing3s2equate8ly2here6d6s5ing2jacent3ective3ust6ed6ing6ment9ts6s2minister9red9ring9rs8ration9ative4rable6tion5e4ssion4t5s5ted8ly6ing2opt5ed5ing6on5s2ult5s2vance7d7s6ing5tage9ous9s3ent6ure9s8ous4rse7ly5t6ise9d9ment9ments9s8ing6s3ice4sable5e6d6r7s6s5ing5ory3ocate8d8s7ing1erial2sthetic9ally1ffairs3ect6ed6ing7on6s3ord2orementioned2raid2ter5noon9s5ward9s1gain5st2ed3ing3ncy4da4t5s3s2gressive2ing2ony2ree5d5ing5ment9s5s3icultural1head1ided3ing3s2med3ing3s2rcraft3port1kin1larm5ed5ing5s3s2beit3um5s2ert2gebra7ic3orithm9s2ias5es3en5s3gn5ed5ing5ment5s3ke3ve2legation9ns5e6d7ly6s5ing4rgic4viate3iance4es3ocate8d8s7ing8on9ns4w5able6nce9s5ed5ing5s3y2most2one4g5side3ud2pha5bet8ic9cal2ready2so2ter5ation9ns5ed5ing5nate8ive9vely9ves5s3hough3ogether2ways1mateur3ze5d5s4ing7ly2bassador3er3ient4guities8y6ous4tious2end5ed5ing5ment5s2ong5st3unt6s2ple4ifier2use5d5ment5s4ing1nagram3log6ous6ue6y4yse7d7s6ing7s6t5ze7d7s6ing3rchy3tomy2cestor8s3ient2ecdote8s2gel5s4r3le5s3ry3uish2imal6s2niversary3ounce8d8ment9ents8s7ing4y5ance5ed5ing5s3ual6ly2omalies6y3nymous3rak6s3ther2swer6ed6ing6s2thology3icipate9ed9es9ing9ion4dote4que4social2xious2ybody3how3one3place3thing3way4here1part3thetic5y2ologies7se9d9s8ing7ze9d9s8ing6y3strophe2pal5l6ed6ing9ly6s5s4ratus9es5ent8ly3eal6ed6ing6s5r6ance9es6ed6ing6s4nd6ed6ing7x6s3lause4e4icable7nt9s7tion9ons5ed6s4y5ing3oint7ed7ing7ment9nts7s3raisal4eciate9ed9es9ing9ion4oach8ed9s8ing5priate9tely5val6e7d7s6ing5ximate9tely9tion1rbitrarily8y2cade4ne3h4aic4itecture5ve7d7s6ing2ea4s3na2guable7y4e5d5s4ing4ment8s2ise5n5s4ing3thmetic2med3ing3s3y2ose3und2range7d7ment9nts7s6ing4y5s3est6ed6ing6s3ival5e6d6s5ing3ogance7t4w5s2ticle7s4ficial9lly4st6ic6s3s1scend6ed6ing6s2hamed3can3es2ide2ked3ing3s2leep2pect6s2semble8d8r8s7ing7y4rt6ed6ing7on6s4ss6ed7s6ing6ment4t5s3ign6ed6ing6ment9ts6s4st6ance8t6ed6ing6s3ociate9d9s8ing9on9ons4rt6ed6ing6s3ume6d6s5ing5ption9ns4re6d6s5ing2terisk8s3ronomer9rs8y2ynchronous1theism6t7s2las2mosphere9ic2om4ic4s2rocities7y2tach6ed6ing6ment5k6ed6ing6s4in3empt7ed7ing7s4nd6ance8t6ed6ing6s5tion9s3itude8s3orney8s3ract7ed7ing8on8ve7s4ibute9d9s8ing1udible4ence8s4o2nt2thentic4or6isation8e9d9s8ing7ties8y7zation8e9d9s8ing6s3obiography4mate8d8s7ic9ally8ng5obile9es3umn1vailability7le2erage2oid5ed5ing5s1wait5ed5ing5s3ke3rd5ed5ing5s4e5ness3y2ful5ly2kward1xes2iom5s3s0babies3y2ck4bone4ed4ground9ds4ing4log4s5pace4ward8s3teria7um2dge3ly2ffle6d6s5ing2ggage3s2ke4d4s3ing2lance7d7s6ing3l4et4ot4s2nal4na6s3d4s4wagon5idth3g3k4rupt4s3ned5r4ing3s2re4ly3gain3k4ed4ing4s3oque3red5l4ier7s5ng5ster9s3s2se4d4ment4s3h4ed5s4ing3ic5ally5s4ng4s3ket3s4es2tch3h4room4s3teries6y4le2ud1each3m3n4s3r4d5ed5ing5s4ing4s3st5s3t4en4ing4s3utiful9ly5y2came4use3ome6s5ing2droom3s2ef3n2fore6hand2gan3in5ner8s6ing5s3un2half4ve6d6s5ing6or7ur3ind2ing5s2lief6s5vable6e7d7r8s7s6ing3l4s3ong6ed6ing6s4ved4w3t2nch3d4ing4s3eath4ficial6t7s3t2side6s3t2ta3s3ter4ing3ween2ware2yond1ias4ed5s4ing2ble4ical2cycle7s2dding3s2gger5st3ot5ed5ry2ll4fold4ion7s4s2nary3d4ing4s2ochemistry3graphy3logical7st9s6y2rd4s3th5day2scuit7s3hop2te4s3ing3map3s3ten5r2zarre1lack5board5mail5s3de5s3me5d5s4ing3nk5et5s3st5ed5ing5s3tant7ly2ess5ed6s5ing3w2ind5ly4k3ss2ob3ck5ed5ing5s3od3w4ing4n4s2ue4s3rb1oard5s3t4s2bs2dies3y2gged4ing4le6s3s3us2il4ed4ing4s2ld3t2nd3e4s3us2ok4ed4ing4let4s5hop8s5tore3m3st3t4s2rder6line3e4d5om4s3ing3n4e3row6ed6ing6s2ss2th4er6ed6ing6s3tle6s4om2ught3nce4d5aries7y5s3t2wl2xes2ys1racket7ed7ing7s3in5s3ke5s3nch6es4d5ed5ing5s3ss3ve2each4d4k5down5fast5ing5s4th6e7d7s6ing3d3ed5ing5s4ze3thren2ick5s3dge6s3ef5ly3gade4ht6er7st6ly6ness3lliant9ly3ng5ing5s2oad5cast9ing9s5ly3ke5n3ther7s3ught3wn4se6d6s5ing2ush3tal1ubble2ck4et4s2dget2ffer6ed6ing6s2gs2ild5ing8s5s4t2lb4s3k3l4et6in6s2mp2nch3dle2rden3eaucracy3ied5s3n4ed4ing4s4t3st5ing5s3y4ing2ses3h3iness8es3s4es3t3y2tter4on6s2yer5s3ing3s1ypass2te4s0cabbage3inet3le5d5s4ing2ffeine2ge2ke4s2lculate9d9s8ing9on9ons8or6us3endar3l4ed5r4ing4s3m2me4ra6s3p4aign8ed8ing8s4s4us2ncel6ed6ing6led7ing6s5r3didate9s3not3onical3s3t2pabilities9y5le4city3ital7ism9t7s3s3tain4ure7d7s6ing2rbon3d4board4s3e4d4er6s4ful7ly4less4s3ing3pet3riage5ed6r6s4ot6s4y5ing3s3toon7s4ridge9s2se4d4s3h3ing3sette8s3t4ing4le4s3ual2talog7s7ue9s4strophic3ch5es5ing3egorically8es7y4r5ed5ing5s3hedral4olic3s3tle2ught3sal6ity4e5d5s4ing3tion2ve4at1ease5d5s4ing2iling2lebrate9d9s8ing9on3l4s4ular2nsor6ed6ing6s7hip3t4er6ed6ing6s4ral7ly5e6d6s5ing4uries6y2remony3tain7ly7ty4ificate1hain5s4r5man5s3lk4lenge9d9s8ing3mber4pagne5ion3nce6llor6s4ge6d6over6s5ing4nel7s3os4tic3p4el4s4ter7s3r4acter9istic9istics9s4ge6d6s5ing4itable6ies6y4m5ed5ing5s4s4t5er5s3se5d5s4ing3t4s4ted5ing2eap5er6st5ly4t5ed5ing5s3ck5ed6r5ing5s3ek4r5ful5s4se3mical8s5st7ry7s3que6d6r6s5ing3ss4t5nut3w4ed4ing4s2icken7s3ef3ld5hood5ish5ren3p4s2ocolate3ice6s4r3ose6s5ing3p4ped5ing4s3ral4d4us3se5n2uck5ed5ing5s3nk5s3rch6es1ider2nema2rca4le6s4uit7ry7s5lar7te9d9s8ing9on5mstance9nces2te4d4s3ies4ng4zen7s3y2vil5ian6sation7e8d8s7ing6zation7e8d8s7ing1laim5ed5ing5s3rification7ed8s6y7ing5ty3sh5es4s5ed6s5ic7al7s6fication8ed9s7y8ing6ng3use6s2ean5ed6r7s6st5ing5ly5s4r5ance5ed6r6st5ing5ly5s3ver6er7st2ick3ent6s3ff3mate4b5ed5ing5s3nic6al3p4ped5ing4s3que2ock5s3g3ne5s3se5d5ly5r5s6t5t4ing4ure3th5e6d6s5ing3ud5s2ub4s3e4s3msy3ster7s1oach3l3rse3st3t4s2bbler7s2de4d4s3ing2ffee2herent2in4cide8nce4ed4ing4s2ke2ld3laboration5pse8d8s7ing5r5te7d7s6ing4eague9s5ct7ed7ing8on9ns8ve7s5ge7s3on5y4r5ed5ing5s4ur6ed6ing6s3umn6s2mbat4ination9ons6e7d7s6ing3e4dy4s3fort7able9ly3ic5s4ng3ma5nd7ment9nts7s5s4ence6t7ary8tor9ors7ed7ing7s5rcial9lly4ission9ned9ning9ns5t6ment9ts6s6ted8e9s7ing4odity5n6ly6s4unal6icate9ted9tes9ting9tion9tions7sm8t9s7ties8y3pact5nies7on6y5rable7tive9vely6e7d7s6ing7son9ns5ssion5tibility8le4el6led7ing6s5nsate9ion5te7d7nce8t7s6ing7tion9ve8or9rs4ilation6e7d7r8s7s6ing4lacent6in8ed8ing8s8t9s5ement9tary6te8d8ly8ness8s7ing8on6x7ity5icate9ed9es9ing9ion9ions6ment5y4onent9s5se7d7r8s7s6ing7te8ion5und4rehend9sible9sion9sive6ss8ed9s8ing9on5ise8d8s7ing5omise4ulsion7ory5tation9onal6e7d7r8ise9sed9ses9sing9ze9zed9zes9zing8s7s6ing2ncatenate9ted9tes9ting4eal7ed7ing7s5de5ivable9ly7e8d8s7ing5ntrate9ted9tes9ting9tion5pt7ion7s7ual5rn7ed7ing7s6t7o7s4ise4lude8d8s7ing6sion9ns4rete4ur6rently3demn7ation7ed7ing7s5nse8d8s7ing4ition9al9ed9ing9s4one4uct7ed7ing7or7s3ference9es5ss4idence8t9ial9iality5guration9tions8e9d9s8ing5ne7d7s6ing5rm7ation7ed7ing7s4lict8ed8ing8s4orm4ront8ed8ing8s4use7d7s6ing7on3gest7ed7ing8on7s4ratulate9ations3jecture4unction3nect7ed7ing8on9ns7or7s4otation9ons3science6ous9ly9ness4ecutive5nsus6t7ed7ing7s5quence9ces9t9tly5rvation9ive9ives4ider8able9bly9te9tion9tions8ed8ing8s5st7ed8ncy9t9tly7ing7s4olation6e4picuous6racy4tant8ly8s5ituency9nt9nts8te9es9ion9ional5rain9ed9ing9s9t9ts6uct9ed9ing9ion9ions9ive9s4ult7ancy9t9ts8tion7ed7ing7s5me7d7r7s6ing6ption3tact7ed7ing7s5in7ed8r7ing7s4emplate9ted9tes9ting7orary7t5nd6t7ion9us7s5st5xt7s4inent9al6ual9ly8tion9ions7e8d8s7ing8ty7ous9sly7um4our4raception7t8ed8ing8s6dict9ted9ting9tion9tory9ts6ry6st6vention5ibute9ed9es9ing9ion9ions9or9ors6ve8d8s7ing5ol7led9r9rs8ing7s6versial9sy3venience9t9tly6tion9nal9ns5rsation9ions7e8ly7ion9ns6t7ed8r7ing7s5y4ict7ed7ing8on9ns7s5nce8d8s7ing9gly2ok4ed4ie6s5ng4s3l4ed4ing4s3perate8ion3rdinate9es9ion2pe4d4s3ied5s4ng3per3y4ing4right2re3n4er6s3porate8ion4ses3rect7ed7ing8on9ns7ly7s5late8ion5spond9ded9dence9dent9ding9ds4idor4upt7ed7ing8on7s2smic4ology3t4ed4ing4ly4s3y2tton2ugh3ld3ncil7s4sel7ed7ing7led8ing7s4t5ed6r7example7part9rts5ing5less5ries6y7side5s5y3ple6d6s5ing3rage4ier4se6s4t5esy5s3sin2ver5age5ed5ing5s2ws2zy1rack5ed5ing5s3ft3mp5ed5ing5s3sh5ed6s5ing4s3wl5ed5ing5s2eam4te6d6s5ing6on6ve5or5ure8s3dibility6le5t6s3ed4p3w2icket3ed4s3me5s4inal8s3sis4p5s3teria7on4ic6al6ise9d9s8ing8m9s7ze9d9s8ing6s2op4s3ss5ed6s5ing5road9s5word3wd5ed5ing5s4n2ucial3de3el5ty3ise6d6s5ing3nch6ed7s6ing3sh5ed6s5ing2ying3ptic3stal7s1ube3ic2ckoo2ddly2lprit3t4ural6e7s2mbersome3ming3s3ulative2nning2pboard3s2re4d4s3ing4osity5us7ly3ly3rency6t7ly4iculum4y3se4or3tain7s3ve5s2stard4om6ary6er8s6s2te3s3ting1ycle5d5s4ing5st7s2linder2nic5al0daft2ily2mage6d6s5ing3p2nce5d5s4ing3ger6ous9ly6s2re4d4s3ing3k4ness3ling2sh4ed5s4ing2ta4base8s3e4d4s3ing3um2ughter2wn2ylight3s3time1eadline3f3l4er6s4ing4s4t3r2batable5e6d6s5ing3t3ug5ged7r6ing5s2cade6s4y3ent3ide6d6s5ing4mal4sion8s3k3laration9ons6e7d7s6ing4ine7d7s6ing3ode6d6s5ing3rease8d8s7ing2dicate8d8s7ing3uce6d6s5ing5tion9s2ed4s3m4ed4ing4s3p4er5st4ly2fault7s3eat6ed6ing6s4ct6ive6s4nce5d6ed6ing6s5se6ive3iciencies9y4ne6d6s5ing6te8ly7ion9ns8ve3y2generate3radation6e7d7s6ing4ee6s2ity2lay5ed5ing5s3ete6d6s5ing6on3iberate9ely4cate5ious4ght7ed7ful7ing7s4miters4ver7ed7ing7s7y3ta3usion2mand6ed6ing6s3ented3ise3ocracy7tic9cally4lish8ed9s8ing4nstrate9ted9tes9ting9tion9tions2nied5s3ominator4te6s3se4ity3tist3y4ing2partment9tal9ts6ure3end6ant6ed7nce8t6ing6s3osit3ress7ed8s7ing8on4ive7d7s6ing3th5s3uty2range7d7s6ing3ivative5e6d6s5ing3ogatory2scend7ed7ing7s4ribe8d8s7ing6ption9ons9ve3ert6ed6ing6s5ve7d7s6ing3ign6ate9d9s8ing6ed7r8s6ing6s4rable5e6d6s5ing3k4top3pair4erate9ly4ise5te3tination6e7d7s6ing4roy7ed7ing7s5uction9ve2tach6ed7s6ing4il6ed6ing6s3ect6able6ed6ing7on7ve6or6s4r5mination8e9d9s8ing5rent3ract2vastate9d9s8ing3elop7ed8r9s7ing7ment9nts7s3iation4ce6s4ous4se6d6s5ing3oid4te6d6s5ing1iagnosis7tic9cs4onal4ram7s3l4ect7s5d4ing7s4led5ing8s4og6ue4s3meter3ry2ce3tate6or8ship4ionaries9y2esel3t2ffer6ed7nce9es8t9ial9iate9ly6ing6s4icult9ies9y2gest3ging3it5al5s3nity3s2lemma2mension9al9s2ne4d4r4s3ing3ner2plomatic2re4ct6ed6ing7on9s7ve9s6ly6or8ies8s8y6s3t4y2sable7d7s6ing4dvantage9ages4gree8d8ing8ment8s4ppear9ed9ing9s6oint9ted9ting9tment9ts4ster8s6rous3c4ard7ed7ing7s4harge4iplinary9e4laimer4o5nnect9ted9ting9ts6tinue9ued9ues9uing5unt8s6rage9ed9es9ing5ver8ed8ies9ng8s8y4repancy6te7ion5iminate9ated9ates9ating9ation4s4uss7ed8s7ing8on9ns3ease7s3guise8d8s7ing5st7ed7ing7s3h4es4onest3k3like7d7s6ing3mal4iss7ed8s7ing3order3play7ed7ing7s4osable7l6e7d7s6ing7tion4ute3regard4upt7ion3sertation4imilar3tance8s6t5steful4inct8ion9ons9ve8ly6guish9shed9shes9shing4ort7ed7ing8on7s4ract8ed8ing8s5ess8ed9s8ing5ibute9ed9es9ing9ion6ct4urb7ance7ed7ing7s2tch3to2ve4d4rse6ity5t6ed6ing6s4s3ide6d6s5ing4ne5g4sion8s3orce1octor6s4rine3ument8ary9tion8ed8ing8s2dge2es2gma3s2ing2le3lar6s2main3estic3inant6te8d8s7ing2nate6d6s5ing6on8s3e3s2om4ed4ing4s3r4s2se4s2ts3ted4ing2uble6d6s5ing4t5ful5less5s2wn4hill4right4stairs4wards2zen5s1raft5ed5ing5s3g4ged5ing4on4s3in5ed5ing5s3ma5tic8ally3nk3stic7ally3ught7s3w4back8s4ing7s4n4s2ead5ed5ful5ing5s4m5ed5ing5s5t4ry3ss5ed6s5ing3w2ied4s3ft3ll3nk5ing5s3p4ped5ing4s3ve5l5n5r6s5s4ing2op4ped5ing4s3ve3wn5ed5ing5s2um4s2ying1ual2bious2ck4s2ff2ll3y2mmy3p4ed4ing4s5ter2plicate9d9s8ing9on2ration3ing2st4bin4y2ties3y1ying2namic7ally7s0each2ger5ly3le2rlier6st4y3n4ed4ing4s3s3th2se3ier5st4ly3t4ern3y2ten4r3ing3s1ccentric2ho4ed5s4ing2ological6y3nomic8al9lly8s7es6y1dge4s2it4ed4ing5on7s4or6ial6s4s2ucate7d7s6ing7on9al1ffect6ive9ly9ness6s3iciency8t9ly3ort6s1ggs2os1ight5een5h2ther1laborate2derly2ect5ed5ing6on8s5oral8te5ric8al8ity6on8ic9cally9cs5s3gant3ment7ary7s3phant8s3vator8s4en2igible3minate9d9s8ing3te4ist2se4where1mbarrass9ed9es9ing9ment3ed5ded6ing5s2erge6d6ncy6s5ing2inent7ly3t2otion7al9ly7s2phasis8e9d9s8ing7ze9d9s8ing3ire5ical3loy6ed7e8s7r8s6ing6ment6s3tied6s4y5ing2ulate6ion6or8s1nable6d6s5ing2close7d7s6ing3ode6d6s5ing4unter9ed9ing9s5rage9d9ment9s8ing2deavor7ur4d3ing6s3less7ly3s2emies4y3rgy2force7d7s6ing2gage6d6s5ing3ine6er8ed8ing8s6s2hance7d7ment7s6ing2joy5able5ed5ing5ment5s2large7d7s6ing3ighten9ed9ing9ment9s2ormous8ly3ugh2quire7d7s6ies7ng6y2sure6d6s5ing2tail6s3er5ed5ing5prise5s5tain9ed9ing9ment9s3husiasm9tic3ire6ly6ty4ties5le7d7s6ing5y3rance4ies4y2velope8s3ironment9ntal9nts4sage8d8s7ing3y1pic3sode7s1qual5ity5ly5s4te5ion8s3ilibrium4p5ment5ped6ing5s4valent9ts1rase5d5r5s4ing2go2roneous4r5s1scape6d6s5ing2oteric2pecially2say5s3ence5tial9ly2tablish9ed9es9ing9ment9ments4te3imate8d8s7ing8on1ternal5ity2hic5al5s3nic2ymology1valuate8d8s7ing8on2en4ed4ing7s4ly4s4t5s5ual8ly3r4y5body5day5one5thing5where2idence6t7ly3l4s2olution9ary4ve6d6s5ing1xact5ly3ggerate9ed9es9ing3m4ination6e7d7r7s6ing4ple7s4s2ceed6ed6ing9ly6s4llent4pt6ed6ing7on9al9ally9s6s4ss6ive9ly3hange8d8s7ing3ite6d6ment6s5ing3lamation4ude7d7s6ing5sion7ve9ly3use6s2ecutable6es6ing7ve3mpt3rcise8d8s7ing2haust7ed7ing8ve7s3ibit7ion2ist5ed6nce5ing5s3t4ed4ing4s2otic2pand6ed6ing6s5sion3ect6ation9ons6ed6ing6s4dition4nditure5se7s6ive4rience9ed9es9ing6ment9tal9tally9tation9ted9ting9ts5t6ise6s3ire6d6s5ing5y3lain7ed7ing7s5nation9ons8ory4icit8ly4ode7d7s6ing5it7ation7ed7ing7s5ration6e7d7s6ing5sion9s7ve3onential4rt4se6d6s5ing5ure3ress7ed8s7ing8on9ns7way9ys2tant3end6ed6ing6s5sion9s7ve9ly5t6s4rnal8ly3inction3ra5ct7ed7ing8on7s5neous5ordinarily9nary5s4eme7ly7s6ist1yes4ight0fabric2ce4d4s3ilitate7ies7y4ng3t4or6ies6s6y4s4ual7ly3ulties6y2il4ed4ing4s4ure7s3nt5er6st3r4er5st4ly4ness4y3th5ful2ke2ll4acious6y4en4ing4s3se2me3iliar8ity6es5y4ne3ous2ncy3s3tasies6tic6y2rce3e4well3m4er6s3ther6st2scinate9d9s8ing5st3hion7able7ed7ing7s3t4er5st2te3her6s3uous2ucet3lt5s5y2vor5able5ed5ing6te8s5s4ur6able6ed6ing7te9s6s1ear4ed4ing4s3sibility6le3t4ure7d7s6ing2deral2eble3d4back4ing4s3l4ing7s4s3s3t2ll4ow6s3t2male6s3inist8s2nce3der6s2stival2tch2ver2wer4st1iber5s3re5s2ction7al2ddle6d6s5ing2eld5s3rce2fteen4h4y2ght5er5ing5s3ure6d6s5ing2le4d4s3ing3l4ed4ing4s3m4ed4ing4s3ter6ed6ing6s2nal5ise8d8s7ing6ze8d8s7ing5ly5s4nce7s6ial9ly3d4ing7s4s3e4d4r4s5t3ger6s3ing4sh6ed7s6ing4te2re4d4s4work8s3ing3m4ly4s3st5ly2scal3h4ed5s4ing2ts3ted4ing2ve4r2xed4s3ing2zzy1lag4ged5ing4s3me5s3sh5ed6s5ing3t3vor5ur3w4ed4ing4s2eet3sh3w3xibility6le2ied4s3ght3p4ped5ing4s2oat5ed5ing5s3od5ed5ing5s4r5s3ppy3ur3w4ed5r6s4ing4n4s2uctuation9ons3ent3ffy3id3sh5ed6s5ing3te2ying1oam2cus2ld4ed5r6s4ing4s3k4s3low6ed7r8s6ing6s2nd3t4s2od4s3t4ball4note8s2rbade4id6den7ing6s3ce5d5s4ibly5ng3ecast8ing8s4ign7er9s4seeable5t6s4ver3gave4et6s6ting4ive7n7s6ing4ot6ten3k3m4al6ly5t6ion6s6ted7ing4ed5r6ly4ing4s4ula7e7tion3th5coming4night4unate9ly6e4y3um3ward7ed7ing7s2ssil2ught3l3nd5ation9ns5ed5ing5s4tain3r4teen5h1raction8s3gile4ment8s3me5s5work3nk5ly4tic3ud2eaks3e4d5om4ing4ly4s4way7s4ze6s5ing3nch3quencies8y7t8ly3sh2iction3ed4nd6ly6s7hip4s3ghten8ed8ing8s3nge3volous2og4s3m3nt3wn5ed5ing5s3ze5n2uit5s3strate9d9s8ing9on2ying1udge2el2lfil6l7ed7ing7s6s3l4er5st4y2me4s2nction8al9lity8ed8ing8s3d4amental9alist9ally4ed4ing4s3eral3nier6st4y2rniture3ry3ther7more6st2se3ion3s4y2tile3ure2zzy0gain4ed4ing4s2lactic4xy2me4s2ng2ps2rage3bage4le6d6s5ing3den6s2soline3p2te4s4way3her6ed6ing6s2ve1ear4ed4ing4s2nder3e4ral7isation9ations9e9ed9es9ing8zation9ations9e9ed9es9ing7ly6te8d8s7ing8on9ns7or9s5ic5ous4s4tic7ally7s3ius3ocide3re3tle6man7en5y3uine7ly2ographical8y3logy3metry2sture2ts3ting1hastly2ost1iant2bberish2ft4s2rl4friend4s2ve4n4s3ing1lad4ly3nce3ss5es2ean5ed5ing5s2obal6ly3rious4y3ssy3ve5s3w4ed4ing4s2ue1nome1oal4s3t2ds2es2ing2ld4en4fish8es3f2ne2od4bye4ies4ness4s4y2rgeous2spel3sip2tten2vern6ed6ing6ment9ts6or6s2wn1rab4bed5ing4s3ce3de5s4ual7ly6te8d8s7ing8on3ffiti7o3in3mmar6tical3nd5father5mother5s4t5ed5ing5s3ph5ic7al7s5s3sp4s3teful8ly4uitous9sly3ve4itational6y3y2easy4t5er6st5ly3ed5y4n3w3y2id3ef3m3nd5ing5s3p4s2oan3ss5es5ly3und6s4p5ed5ing5s3w4ing4n4s4th1uarantee9d9ing9s4d5ed5ing5s2ess5ed6s5ing4t5s2idance4e5d5line9s5s4ing3lt5y3nea3tar2lf3lible2ts3ter2ys0habit5s2ck4ed5r6s4ing4s2il3r4cut4s4y2lf3l4s3t4ed4ing4s3ve5s2mmer2nd4book4ed4ful4icap5ng4le6d6r6s5ing4s4y3g4ed4ing4over4s2ppen6ed6ing6s4ier6st5ly5ness4y2rd4back4en6ed6ing6s5r5st4ly4ship4ware4y3m4ful4less4ony3sh2sh3sle3ten4y2ting3red3s2ve3ing3oc2zard6s3y1ead4ache4ed5r6s4ing4line8s4s3lth6y3p3r4d4ing4s4t5ily5s3t4ed4ing4s3ven6s4ier6st5ly4y2el4s2ight6s2ld3icopter3lo3met3p4ed4ful4ing4less4s2nce5forth2rd3e4by4sy3itage3o4es4ic3ring7s3self2sitate2xadecimal1idden3e4d4ous7ly4s3ing2erarchical8y2gh4er5st4light9ed9ing9s5y4way7s2larious3l4s2mself2ndsight3t4ed4ing4s2re4d4s3ing2storian9s7c8al9lly6y2therto3s3ting1obby2ld4er6s4ing4s3e4s3iday7s3low3y2me4s2nest6ly6y4y3or5ary5ed5ing5s4ur6ed6ing6s2ok4ed4ing4s2pe4d4ful7ly4less8ly4s3ing2rde5s3izon7tal9lly3n3rendous9sly4ible7y5d5fic7ed8s6y7ing4or3se5s2spital8s3t4ile4s2tel2ur4s3se5d5hold5s4ing2wever1uge4ly2man5e5ity5s3ble5y3or5ous4ur2ndred7s3g4ry3t4ed4ing4s2rry3t4ing4s2sband1ydrogen2phen3ocrisy7te8ical4thesis7tical2sterical0icon4s1dea4l5istic5ly5s4s3ntical9ly6fication8ed9r9rs9s7y8ing6ty3ological7y2iom4syncratic2le1gnorance7t5e6d6s5ing1llegal7ly3iterate3ness3ogical3usion5trate9ed9es9ing9ion9ions1mage5s4inary7tion9ve6e7d7s6ing2balance2mature3ediate9ly4nse7ly3inent3oral5tal3une2pact4ir6ed6ing6s3end6ed6ing6s4rative5fect5ial5sonal3lausible4ement9ation9ations9ed9ing9s4ication9ons6it8ly5ed6s4y5ing3ort6ance8t9ly6ed6ing6s4se6d6s5ing5sible3ractical4ess7ed8s7ing8on9ns8ve4ison8ed8ing8s4obable5ve7d7ment9nts7s6ing3ulse1nability3ccessible5uracies9y8te3dequate4vertently3ne3ppropriate2capable4rnation3entive3h4es3idence7t8al9lly8s3lination6e7d7s6ing4ude7d7s6ing5sion7ve3oherent4me5ing5patible6etence9nt6lete4nsistencies9ency9ent5venience9enced9ences9encing9ent4rporate9ted9tes9ting5rect9ly3rease8d8s7ing9gly5dible9y5ment3ur5red6ing5s2deed4fensible5inite9ely4nt4pendence9nt9ntly4terminate4x5ed6s5ing3icate8d8s7ing8on9ns8ve7or9s5tment4rect8ion8ly4vidual9lly9ls3uce6d6s5ing5tion4lge7d7s6ing4strial8es7y2effective5iciency9nt3quality3rtia3vitable9y3xperienced2fallible4mous4nt6ile3ect6ed6ing7on6s4licity4r5ence5ior8ity3inite8ly7y3lation4exible4ict4uence9d9s8ing7tial3o4rm6al8ly7tion9ve6ed6ing6s3rastructure4equent4ingement2genious3redient9ts2habit7ant9ts7ed7ing7s3erent8ly5it7ance7ed7ing7s3ibit7ed7ing8on7s2itial7isation9e9ed9es9ing8zation9e9ed9es9ing7ly7s6te8d8s7ing8ve2ject3ure6d6s5ies6ng5y4stice2ner3ocence7t4vation8ve2put5s5ted6ing2quire7d7s6ies7ng6y2sect6s5ure4nsitive4rt6ed6ing7on6s3ide5ious4ght5nificant4st6ed7nce6ing6s3ofar3pect7ed7ing8on7s4iration6e7d7s6ing3tall7ation9ions7ed7ing7s5nce8s6t7ly4ead4inct5tute8ion9ons4ruct8ed8ing9on9ons8s6ment9tal9ts3ufficient4lt6ed6ing6s4rance2tact4ke3eger7s5ral7te9d9s8ing9on6ity4llect9ual6igence9nt4nd6ed6ing6s5se7ly6ity7ve5t6ion9al9ally9s4r5act8ed8ing9on9ons9ve9vely8s5course5est8ed8ing9ngly8s5face9d9s8ing6ere9d9nce9s8ing5im6or5mediate6ittent5nal8ly8s7tional5pret9ation9ations9ed9er9ing9s5rogate6upt9ed9ing9ion9ions9s5section9ions5val8s6ene9d9s8ing8tion6iew9ed9ing9s3imate3o4lerance3rinsic9ally4oduce9d9s8ing8tion9ory3uitive2vade6d6s5ing4lid7ate5uable4riably4sion3ent6ed6ing7on9s6or6s4rse5t6ed6ing6s4st6igate9ted9tes9ting9tion9tions6ment3isible4tation5e6d6s5ing3oke6d6s5ing4lve7d7ment7s6ing1rate2on4ic4y2rational3elevant4spective6onsible3itate8d8s7ing8on1sland6s2olate7d7s6ing7on2sue5d5s4ing1tem4s2self0jack4et6s2il2mmed4ing3s2rgon2zz1ealous3ns2llies4y2st1obs2in4ed4ing4s4t5ly5s2ke4d4s3ing2lly2urnal7ist9ts7s5ey1udge5d5ment9s5s4ing4ment8s2ice2mp4ed4ing4s2nction3gle3ior3k2ry2st4ice5fiable9ly7cation7ed8s6y7ing2venile0keen3p4er4ing4s2pt2rnel2ttle2yboard8s3ed3ing3s4troke9s3word7s1ick4ed4ing4s2dded4ing3napped7ing6s4ey3s2nd4ly4ness4s3g4dom4s2ss2tchen3s1nee4s3w2ife3ght2ock5ed5ing5s3w4ing4ledge4n4s0label5ed5ing5led6ing5s3or5atory4ur3s2ck4ed4ing4s2dder3ies3y2ger2id3n2ke2mp2nd4ed4ing4lord4s5cape3e3guage8s2rge5ly5r5st3k2ser5s3t4ed4ing4s2te4ly4r4st3ter2ugh5ed5ing5s5ter3nch6ed7s6ing2vatory2wn3s3yer6s2yer5s3ing3out3s2ziness3y1each3d4ed5r6s7hip4ing4s3f4let7s3gue3k3n4ed4ing4s3p3rn5ed5ing5s5t3st3ther3ve5d5s4ing2cture7d7r8s7s6ing2ft2gal5ly3end6ary3ible4slation4timate9ely3s2isure2mon2nd4ing4s3gth6s6y3ient3s4es3t2ss4er4on6s3t2thal3s3ter6s4ing2vel5s1iability4le3ison2bel4ral5ties6y3rarian7es6y2cence7s5se7d7s6ing2ed3s2fe4style4time3t4ed4ing4s2ght5ed6r6st5ing5ly5ning9ed9s5s2ke4d4lihood5y4s4wise3ing2mb4s3it5ation9ns5ed5ing5s2ne4ar4d4s3guistic3ing3k4age4ed4ing4s2on2ps2quid4or2sp3t4ed5n6ed7r6ing6s4ing7s4s2ter5al7ly6ry6te7ure3re3ter4le2ve4d4ly4r4s5t3ing1oad4ed5r4ing4s3n4s2bby2cal5ly5s4te6d6s5ing6on8s3k4ed4ing4s2dge2gged4ing3ic5al7ly3o3s2nely3g4er5st2ok4ed4ing4s3p4hole4s3se5ly2rd4s3ries4y2se4s3ing3s4es3t2ts2ud4er5st4ly3sy2ve4d4ly4r5s4s3ing2wer5ed5ing5s4st2yal1uck4ily4y2dicrous9ly2ggage2mp4s2natic3ch5time3g4s2rk4ed4ing4s2xury1ying2ric5s0machine7ry7s2de3ness2gazine8s3ic5al3netic4ificent5tude2il4box4ed4ing4s3n4frame9s4ly4s5tream4tain8ed8ing8s5enance3ze2jor5ity2ke4r5s4s3ing2le4s3function3icious2nage6d6ment6r7s6s5ing3date6ory3gle6d6s5ing3ia4festation8ly8o4pulate9ed9es9ing9ion3kind3ned5r4ing3power3s3ual6ly6s4facture9red9rer9rers9res9ring3y2pped4ing3s2rch3gin6al8ly6s3ital3k4ed5r6s5t6ed6ing6s4ing4s3riage5ed6s4y5ing3vellous6ous2sk3s4es4ive7ly3ter6s2tch5ed6s5ing3e4rial8s3hematical9cally9cian9cians9cs3rices5x3ter6s3ure2ximise6ze5um2ybe3or2ze1eal4s3n4ing7ful7less7s4s4t5ime4while3sure7d7ment9nts7s6ing3t2chanic8al8s7sm9s2dia4cal5ine4eval4um6s2et4ing7s4s2gabyte8s2lody3t2mber6s7hip3orable5ies5y2nd4ed4ing4s3tal6ity6ly4ion7ed7ing7s3u4s2rcury4y3e4ly3ge5d5s4ing3it5s3ry2ss4age7s4ed5s4ing4y2tal4phor3er5s3hod6s3re5s4ic4o5s1ice3rocomputer9uters5processor5wave2dday4le3night2ght5y3rate7d7s6ing7on2ld4ly3e4age4s3itary3k3l4ion7s2mic2nd4ed4ing4less4s3e4d4s3imal7ist5ise6ze5um4ng4ster8s3or5ities7y3t3us4te6s2racle7s5ulous3ror6s2scellaneous3direct9ed9ing9s3erable8y5y3fortune3guide8d8s7ing3interpret9reted9reting9rets3lead7ing7s5d3place8d8s7ing4rint3read7ing7s5present9ented9enting9ents3s4ed5s4ile7s5ng5on3t4ake7n8ly7s6ing4ook4s3understand9tands9tood4se2xed4s3ing3ture1nemonic1oan4ed4ing4s2bile2ck2de4l5ed5ing8s5led6ing9s5s4rate8ly7ion5n4s5t3ification9ions6ed7s5y6ing3ule6s2ld3e4cular7e8s2ment6arily6s6um2narch3ey3itor7ed7ing7s3key6s3ochrome4poly3ster7s3th5ly5s2od3n4s2ral5ity5ly5s3e4over3ning7s3tal6ity6s2st4ly2ther6s3ion6s4vate8d8s7ing8on5e6s3or5s5way8s3to2uld3nt5ain8s5ed5ing5s3se3th2ve4d4ment8s4s3ie5s4ng1uch3k4ed4ing4s2ddle6d6s5ing2gs2ltiple8s7ication8ed9s7y8ing2mble3my2ndane2scle6s3eum6s3ic5al5ian8s3t2tter6ed6ing6s3ual6ly1yself3teries7ous9sly6y4ic2th4ical4ology4s0nail4ed4ing4s3ve2me4d4less5y4s3ing2rrative4ow6er7st2stier6st4y2tion6al8ly6s4ve6s3ural7ly5e2ughty1ear4by4er5st4ly3t4ly2cessarily8y6ity3k2ed4ed4ing4le6s7s8ly4s2gate5ive3lect7ed7ing7s4igible3otiable7te9d9s8ing9on9ons2ighbor8hood8s7ur9hood9s3ther2rve5s4ous2st4ed4ing4s2ts3work7ed7ing7s2ural3tral2ver5theless2wcomer8s3er4st3ly3s4letter9rs4paper9s2xt1ice4ly4r4st3k4ed4ing4name8s4s2ght5mare5s2ne1oble3ody2de4s2ise5s4y2minal7ly6te8d8s7ing2ne4theless3sense2on2rm4al6ity6ly3th5ern2se4s3talgia2table6y4tion3e4d4s3hing3ice6able9y6d6s5ing4fication6ed7s5y6ing4ng4on6s3orious3withstanding2un4s2vel5s5ty3ice6s2wadays3here1uclear2isance2ll2mb4er6ed6ing6s5st3eral7s5ic7al5ous2ns2rse5s0obey4ed4ing4s2ject6ed6ing7on9able9s7ve6s2ligation7ory5e6d6s5ing2noxious2scure7d7s6ing7ty3ervation9ons6e7d7r8s7s6ing4ss6ed7s6ing7on3olete3truct8ed8ing8s2tain6able6ed6ing6s2vious7ly1ccasion8al9lly8s3upation5ied7s5y6ing4r5red7nce9es6ing5s2ean1ddly3s1ffence7s5d6ed7r8s6ing6s5se7s6ive4r5ed5ing8s5s3hand3ice6r7s6s5ial8ly8s3set6s6ting4pring2ten1lder4st1mission8s3t4s4ted5ing1nce2es4elf2going2ion2ly2to2us1pen4ed4ing4ly4s3ra5s5te7d7s6ing7on9al9s6or8s2inion7s2ponent8s4rtunities9ty4se6d6s5ing6te7ion3ress7ed8s7ing8on2ted3ic5al4mal5isation7e8d8s7ing7tic6zation7e8d8s7ing5um4ng4on6al8ly6s3s2us4es1ral3nge2bit5al2chestra9l2der5ed5ing5s3inary2gan5ic6sation9ions7e8d8r9s8s7ing6zation9ions7e8d8r9s8s7ing5s2ient6al7te9d9s8ing9on6ed6ing6s3gin6al8ly8s7te9d9s8ing8or6s2thodox1ther5s5wise1ught2rs4elves2tcome7s4ry3dated3er3going3line7d7s6ing4ook3put6s3rage7d7ous7s6ing4ight3set4ide4tanding3weigh8s1ver4all4came5ome8s7ing4draft5ue4flow4head8s4lap5oad8ed8ing8s6ng6ok8ed8ing8s5y4night4price9d9s8ing4ridden7e8s7ing5ode4seas4time5one8s4view4whelm9ed9ing9s5riting8ten1wed3s2ing2ned4r5s6hip3ing3s1xygen1zone0pace3ifier3k4age7d7s6ing4ed5t6s4ing4s2dded4ing3s2ge4d4s3ing2id3n4ful7ly4less4s4t5ed5ing8s5s3r4s2lace3e2nel5s3ic3t4s2per5back5s2rade5ise5ox4graph9s4llel8s4meter9s4noia7d4phrase3don3ent6heses9is6s3ity3k4ed4ing4s3liament3ochial4dy3rot3se5d5s4ing3t4ial7ly5cipant9nts9te9ted9tes9ting6le8s6ular9rly5es5tion9ed9ing9s4ly4ner7s4s4y2ss4age7s4ed5nger9s5s4ing5on7ate5ve4port4word8s3t4e2tch5ed6s5ing3ent3h4etic4s3ience6t7s3ronise9d9s8ing7ze9d9s8ing3tern7s2use5d5s4ing2vement2yed3ing3ment7s3s1eace5ful3k4s3nut6s3sant7s2culiar2dal4nt6ic6ry6s3estrian9ns2er4s2nalties6y3ce4il3ded4ing4s3guin3nies4y3s2ople6s2rceive8d8s7ing5nt7age7s5ption3fect7ion7ly4orm7ance9ces7ed7ing7s3haps3iod6ic8ally6s4pheral9ls3manent9ly4issible8on5t6s6ted7ing3petual3secute9d9s8ing4ist7ent4on6al8ities9ty8ly6nel6s4pective4uade8d8s7ing6sion3verse2trol3ty1harmacies7y3se5d5s4ing2enomena8on9ns2ilosopher9ers9ical9ies9y2oenix3ne5d5s4ing3to5copy5graph9hic9hs5s2rase6d6s5ing2ysic6al8ly6ist9s6s5ology1iano2ck4ed4ing4s3ture7s2ece5s2geon3s2le4s3l4s3ot2nch5ed6s5ing3k3s3t4s2pe4line4s2tch3fall7s3y2zza5s1lace5d5s4ing3gue6d6s5ing3in5ly3n4e5s5t6ary6s4ned5ing4s4t5ed5ing5s3ster7ed7ing7s5ic3te5s4form3usible3y4ed5r6s4ground4ing4s2ea4sant8ly5e6d6s5ing5ure3nty2ot4s4ted6r5ing3y2ug4ged5ing4s3ral3s1ocket6s2em4s3t4ic4ry4s2int5ed6r7s5ing5less5s3son6ed6ing6s2ke2lar3e3ice6man5ies5y4sh6ed7s6ing4te6ness5ical9ly7ian9ns7s3l4s4ution3ynomial2mpous2ol3r4er5st4ly2pe3ped4ing3s3ulace6r7ity6te8d8s7ing8on9ns2rk3t4ability6le4ed5r6s4ing5on7s4ray7ed7ing7s4s2se4d4s3ing4tion8ed8ing8s6ve8ly3sess7ed8s7ing8on4ibilities9ty6le7y3t4age5l4card4ed5r6s4ing4master4pone8d8s7ing4s5cript4ulate2tato6es3ential9ly2und5s3r4ed4ing4s2verty2wder3er5ed5ful5ing5s1racticable8l9ly9s7e8d8s7ing6se8d8s7ing3gmatic3ise3y4ed5r6s4ing4s2each6ed7s6ing3caution9ns4ede7d7nce8t7s6ing4ious5se7ly6ion3decessor9ors4ict7able7ed7ing8on9ns7s4ominantly3face4er6able9y6ence9es6red7ing6s4ix6ed7s6ing3gnancy7t3judice9d9s8ing3liminary3mature9ly4ise7s5um3paration6e7d7s6ing3requisite3scribe9d9s8ing7ption4ence6t7ation7ed7ing7ly7s5rve8d8s7ing4ident4s5ed6s5ing5ure8s4umably6e7d7s6ing3tend7ed7ing7s6tious4ty3vail5lent4ent7ed7ing8on7s4iew7er5ous8ly2ice5d5s4ing3de3est6s3marily6y4e5s4itive9s3nce5ipal9ly7le9s4t5ed6r7s5ing5out8s5s3or5ities7y3se5s4on6er8s3vacy5te7ly6isation7zation4ilege9d9s8ing3ze5s2obabilities9ty6le7y4lem7s3cedure9s5ed7ed7ing9gs7s5ss7ed8s7ing7or9s4laim3duce7d7r8s7s6ing6t7ion8ve9ity7s3fession9nal9nals7or4ile7s5t6able6s4ound3gram7mable8e9d9r9rs9s8ing7s5ess8ed9s8ing3hibit8ed8ing8s3ject7ed7ing8on7s3liferation4ong7ed7ing7s3minent5se7d7s6ing4ote7d7s6ing7on4pt6ed6ing6ly6s3ne4oun7ce9d9s8ing4unciation3of5s3paganda4er6ly6ties7y4het4ortion9nal9ns5sal8s6e7d7s6ing7tion4rietary3se5cute9d9s8ing9on4pect8ive8s3tect7ed7ing8on7s5in5st4ocol8s5type3ud3ve5d5n5s4ide7d7s6ing5ng5sion9al9s4ocative5ke7d7s6ing3ximity1seudo2ychological9ist9ists9y1ublic6ation9ons6ise9d9s8ing7ty7ze9d9s8ing6ly5sh7ed8r9s8s7ing2dding2ll4ed4ing4s3p3se5s2mp4ed4ing4s2nch5ed6s5ing4tuation6re3ish6ed7s6ing6ment3s3t4s2pil5s2rchase8d8s7ing3e4ly3ge3ity3ple4ose7s3sue6d6s5ing6t2sh4ed5s4ing2ts3t4ed4ing4s2zzle6d6s5ing1ython0qualification9tions7ed8r9s8s6y7ing5ties6y3ntities7y5um3rter7s2een5s3ries4y3st5ion8able8ed8ing8naire8s3ue5d5s4ing2ibble3ck5er6st5ly3et5er6st5ly3t4e4s4ting3z2ota5s5tion9s4e5d5s4ing0rabbit6s3id2ce4d4s3ial4ng3k4et4s2dar3iation4cal7ly4o5s4us2ge2id4s3l4road4s4way3n4bow4ed4ing4s3se5d5s4ing2mpant2ndom6ly3g4e5d5s4ing3k4s3t4ed4ing4s2pid5ly2re4ly4r4st2sh2te4d4s3her3ing4o5nal8e8ly5s3s3tle6d6s5ing2ve4d4s3ing2zor1each5ed6s5ing4t5ed5ing6on8ary8s5or5s3d4able4er6s7hip4ily5ng7s4s4y3l4isation6e7d7s6ing6tic5ty5zation6e7d7s6ing4ly4m5s3r4range9d9s8ing3son6able9y6ed6ing6s4sure8d8s7ing2build7ing7s6t2call6ed6ing6s3eipt5ve7d7r7s6ing4nt6ly4ption3ipe6s5ient9s3kless4on6ed6ing6s3laim3ognisable8e9d9s8ing7tion7zable8e9d9s8ing4llection4mmend9ation9ations9ed9ing9s4ncile5sider4rd6ed7r6ing9s6s4ver7ed7ing7s7y3reational4uit7ed7ing7ment7s3tangle7ular4ified8s6y7ing3ursion7ve3ycle7d7s6ing2define8d8s7ing3irect3uce6d6s5ing5tion9s4ndancy8t2fer5ence9d9s8ing7dum5red6ing5s3ine6d6s5ing3lect7ed7ing8on7s5x3orm6at6ed6ing6s3rain4esh7ed8s7ing3und4sal5e6d6s5ing4te2gain4rd6ed6ing6less6s3ime4on6al6s4ster8ed8ing8s6ration3ret6s6tably7ed7ing3ular7ly6tion9ns2ign3nstate9d9s8ing3terate2ject6ed6ing7on6s2late6d6s5ing6on8s9hip9hips6ve8ly8s7ity4x5ed6s5ing4y3ease7d7s6ing4vance7t3iability6le7y4ed5f5s5ve7d7s6ing4gion8s7us3ocation3uctance8t9ly3y4ing2main6der6ed6ing6s4rk6able9y6ed6ing6s3edy4mber8ed8ing8s3ind6ed7r6ing6s5iscent3ote6ly4val5e6d6s5ing2name6d6s5ing3d4er6ed6ing6s4ing5tion4s3ew5ed5ing5s3t2pair6ed6ing6s3eat6able6ed8ly6ing6s4nt4rtoire4tition8ve3hrase3lace7d7ment9nts7s6ing4ied6s4y5ing3ort6ed7r6ing6s3resent9ation9ations9ative9atives9ed9ing9s4oduce9d9s8ing8tion3ulsive4tation2quest7ed7ing7s4ire7d7ment9nts7s6ing5site2read6ing6s2scue3earch8er9rs4mblance7e8d8s7ing4nt4rvation9ons6e7d7s6ing4t5s5ting3ide6nce7t8s6s4gn6ation6ed6ing6s4st6ance3olution5ve7d7s6ing4rt6ed6ing6s4urce8s3pect7able7ed7ing8ve9ely7s4ond7ed7ing7s6se8s7ibility9le3t4art7ed7ing7s5urant9ts4ed4ing4ore7d7s6ing4rain8ed8ing8s5ict8ed8ing9on9ons9ve8s4s3ult6ed6ing6s4me6d6s5ing4rrection2tail5n6ed6ing6s3ire6d6ment6s5ing3ract4ieval7e8d8s7ing3urn6ed6ing6s2use2veal6ed6ing6s4lation4nge5ue4rse7d7s6ing5t3iew6ed6ing6s4se6d6s5ing6on3olt6ed6ing6s5ution9nary2ward6s3rite7s6ing6ten4ote1hetorical2yme3thm1ibbon2ce3h4er5st2dden4ing3e4s3iculous9sly4ng3s2ght5ly5s3id3orous2ng4ed4ing4s2ot2pped4ing3s2se4n4s3ing3k4ed4ing4s4y2tual6s2val5s3er5s1oad4s2bot5s3ust2ck4et4s2de2le4s3l4ed4ing4s2man5ce5tic2of3m4s3t4s2pe2se2tate6d6s5ing6on3ten2ugh5ly3nd5about5ed5ing5s3t4e5d5s4ine7ly7s6g4s2ws2yal5ties1ubber4ish2de2in4ed4ing4s2le4d4r5s4s3ing2mor5ed5ing5s4ur6ed6ing6s2ng3ning3s2ral2sh4ed5s4ing3ty0sabotage2ck4ed4ing4s3red4ifice9d9s8ing2dden6ed6ing6s3ly2fe4guard9s4ly4r4st4ty2ga2id3l4ed4ing4s3nt2ke3i2laries5y3e4s5man3t3vation2me3ple6d6s5ing2nd4wich8es3e3g3ity3k2rcasm6tic2tellite9s3ire4sfaction9orily9ory6ied8s6y7ing2uce2ve4d4s3ing6s2ying3s1cale5d5s4ing3n4dal4ned6r5ing4s3rce6ly4e5d5s4f4ing4let3tter7ed7ing7s2enario8s4e5ry5s3ptical2hedule8d8r8s7ing4me6s3olar7s4ol6s2ience7s5tific9cally7st9s2ope3re5d5s4ing3tch2rap5ped6ing5s4tch7ed8s7ing3eam6ed6ing6s4en6s3ipt6s3oll6ed6ing6s2um1eal4ed4ing4s3rch6ed7s6ing3son3t4s2cond6ary6ed6ing6ly6s3ret6aries8y6ly6s3t4ion7s4or4s3ular4re5ity2ed3ing3k4ing4s3m4ed4ing7ly4s3n3s2gment7s2ldom3ect6ed6ing7on7ve9ly6s3f4ish3l4ing4s2mantic8s3inar7s2nd4er4ing4s3ior3sation4e5s4ible7y5tive8ity3t4ence8d8s7ing4ient5ment9al9s2parate8d8ly8s7ing8on7or9s2quel5nce8s6tial2rial4es4ous7ly7ness3mon3vant7s4e5d5r6s5s4ice7s5ng2ssion7s2ts3ting7s4le6d6s5ing2ven5th4ral5e6ly5ity1hade5s4ow3ke5n5s4ing4y3ll5ow3me3pe5d5s4ing3re5d5holder9ers5s4ing4p5ly2ed4ding4s3ep4r4t5s3lf4l5s4ter4ve6s2ift5ed5ing5s3ne5d5s4ing4y3p4ped5ing4s3rt2ock5ed5ing5s3e4s3ne3ok4t5ing5s3p4ped5ing4s3rt5age5en7ed7ing7s6r6st5hand5ly5s3t4s3uld6er8s4t5ed5ing5s3ve3w4ed5r6s4ing4n4s2ut4down4s4ting1ick4en6ed6ing6s2de4d4s4ways3ing2gh4t5ed5ing5s3ma3n4al6ed6ing6led7ing6s5ture9s4ed4ificance9nt9ntly5ng4s2lence5t3icon3lier6st4y3ver2milar7ities9y7ly3ple6r6st5icity6fied9s7y8ing6stic5y3ulate8d8s7ing8on5taneous9ously2nce5re7ly3e3ful3g4er6s4ing4le6s4s4ular8ly3ister3k4ing4s3s2ster2te4s3s3ting3uate7d7s6ing7on9s2xteen4h4ies4y2ze4d4s3ing1keleton3ptical3tch6es2ill5ed5s3n3p4ped5ing4s3rt2ull1lag3ng3sh2eep5ing5s3pt2ice5d5s4ing3d4e5s4ing3ght6er7st6ly3m3p4ped6ry5ing4s2ogan3pe4py3t4s3w4ed5r5st4ing4ly4s1mall5er6st5ish3rt3sh5ed6s5ing2ell5s5y2ile5d5s4ing3th2ooth6ly2ug1nack3g3il2eak5ed5ing5s5y2iff2obbery3w1oap2ber2cial6ism8t6ly4eties6y3k4et6s4s2ft4ware2il2lar3d4ier7s3e4ly4s3icitor9s4d3o3ution8s3ve5d5s4ing2me4body4how4one4place4thing5ime8s4what6ere2ng4s3s2on4er5st2phisticate9ated9ates9ating2rdid3e3ry3t4ed4ing4s2ught3l4s3nd5ed5ing5s5track3p3rce6s3th5ern1pace5d5s4ing3n3re5s3tial2eak5er7s5ing5s3cial7ise9ed9es9ing9t8ty8ze9ed9es9ing7ly7ty5es5fic8ally9tion9tions7ed8s6y7ing5men4tacular5rum4ulate8ion3d3ech6es4d5ing5s3ll5ed5ing8s5s4t3nd5ing5s4t2here2ies3got3ke3ll3n3ral4it6s6ual3t4e4s4ted5ing2lendid3it5s5ting2oil5ed5ing5s5t3ke5n5sman3nsor7ed7ing7s4taneous9usly3of4l3rt5s3t4s4ted5ing3ut2rang4y3ead6ing6s3ing6ing6s3ung2ur4ious1quad4re6d6s5ing4sh6ed7s6ing3eeze7d7s6ing1tability4le3ck5s3ff3ge5s4ger7ed7ing7s3ir5case5s3ke3le4l3mp5ed5ing5s3nce4d5ard8ise9sed9ses9sing9ze9zed9zes9zing8s5ing5point5s3r4e5d5s4ing4k4red5ing4s4t5ed6r7s5ing5le7d7s6ing5s4ve6d6s5ing3te5d5ment9s5s4ic5ng5on7ary7s5stic9al9s4us3y4ed4ing4s2eadily5y4l5ing5s4m3el4p4r5ed5ing5s3m4s3p4ped5ing4s3reo6type9es4ile4ling2ick5ing5s5y3ff3ll3mulate9d9s8ing9on3r4red5ing4s2ock5s3le5n3mach3ne5s3od3p4ped5ing4s3rage4e5d5s5y6s4ies5ng4m5s4y2raight8forward5n6s4nge7ly7r7st4tegic8es7y4w4y3eam6s4et6s4ngth8en4ss6ed7s6ing4tch7ed8s7ing3ict6ly4ke6s5ing4ng6ent6s4p5ped6ing5s4ve3oke4ng6er7st6ly3uck5tural8e9d9s8ing4ggle8d8s7ing2uck3dent7s4ied6s5o4y5ing3ff5ed5ing5s3mble7d7s6ing3n4ned5ing4s4t2yle5s1ubject7ed7ing8ve7s3mission5t6s6ted7ing3routine9es3scribe7ption4equent9tly5t4idiary7se9d9s8ing7ze9d9s8ing4tance9s7tial9ally5itute9ed9es9ing9ion3tle6ties7y5y3way6s2cceed7ed7ing7s5ss7ful9lly7ion8ve7or3h2dden6ly2ed3s2ffer6ed7r8s6ing6s4ice6ient9tly5x2gar3gest7ed7ing8on9ns7s2ing3t4ability6le7y4e5d4ing4s2mmaries7se9d9s8ing7ze9d9s8ing6y4ed5r4ing3s2ndry3g3k3light3ny3rise3shine2per5b5ficial9ally6luous5ior8ity5market5natural5vise9d9s8ing9on9ons8or9rs3plement9tary5ied7r8s7s5y6ing4ort7ed8r9s7ing7s5se7d8ly7s6ing4ress8ed9s8ing9on3reme2re4ly3face7s3gery3name3plus4rise8d8s7ing9gly3round8ed8ing9ngs8s3vey6s4ival6e7d7s6ing2sceptible3pect7ed7ing7s5nd7ed7ing7s6sion4icion8us9sly3tain7ed7ing7s1wallow7ed7ing7s3m4p5ed5ing5s3p4ped5ing4s2ear5ing5s4t5ing5s3ep5ing5s4t3pt2im4ming4s3ng3tch6ed7s6ing2ord4e4n2um1ymbol6ic6s3metric7y3pathetic7ies8se8ze7y4honies7y4tom7s2ndicate4rome3onym7ous7s3tactic9ally5x4hesis8zer2stem6atic6s0table5s3s2ck4ed4ing4le6d6s5ing4s3tic6al6s4less2il4or6ed6ing6s4s2ke4n4r5s4s3ing2le4nt6ed6s4s3k4ed4ing4s3l2me2ngent3k4s2pe4s2rget6s2sk4s3te5d5less5s4ing2ught2xation3es3i3payer8s1each5er7s6s5ing3m4s3pot3r4ed4ing4s2chnical9ly6que9s5ological9y2dious2enage7r8s3th2lephone9s4scope4vision3l4ing4s2mper6ature9res4le4orarily8y4t5ation5ed5ing5s2nd4ed5ncies7y5r4ing4s3nis3s4e4ion3tative9ly4h2rm4ed4inal8ly8s7te9d9s8ing9on8or6g6ology4s3rible7y5fied8s6y7ing5tory3se2st4ed4ing4s2xt4book8s4s4ual1han4k5ed5ful8ly5ing5s3t2eater5re3e3ft3ir5s3m4e5s4selves3n3ological7y4rem7s6tical9ally5ies5y3rapy4e5abouts6fter5by5fore5in5of3se5s4is3y2ick5ness3ef4ve6s3n4g5s4k5ing5s3rd4st4ty3s2orough8fare9ares8ly3se3u4gh6t7s4s5and8s2read5t6en8ed8ing8s6s4e4shold4w3oat6s4ugh7out7put4w5ing5n5s3ust6ing6s2umb3s1ick4et6s2died5s3y4ing2ed3s2ger3ht5ly2le4s3l2me4d4r4s5cale4table3ing2ns3y2ps2re4d4s5ome3ing2tle5s1oad3st2day2es2gether3gle2ken5s2ld3erance7t6te8d8s7ing3l2mato6es3e3orrow2ne4s3gue3ight3s2ok3l4s3th2pic5al5s3s2re3n2ss2tal5ly2uch5ed6s5ing3gh3r4ist7s2ward6s3er5s3n4s2ys1race5d5s4ing4k5ed5ing5s3de5d5s4ing5tion9al9ally9s3ffic3gedy4ic3il5ed5ing5s4n5ed5ing5s3nsaction9ons5cript5fer8red9ing8s6orm9ation9ed9ing9s5ient6t7ion5late9d9s8ing9on9ons8or5mission9ions7t8s8ted9er9ers9ing5parent6ort9ed9ing9s3p4ped5ing4s3sh5can3vel6ed6ing9s6led7ing9gs6s3y2ead4sure4t5ed5ing5ment5s5y3e4s3k3mendous9sly3nd5s5y2ial5s4ngle8s3be5s3ck5s5y3ed4s3fle3gger7ed7ing7s3logy3nity3p4le4os4s3umph3via6l7ly2olley3op5s3uble7s4ser7s2uck5s3e3ly3mpet3ncate8d8s7ing4k5s3st5ed5ing5s5y3th5s2ying1ube4s2ne4d4s3ing3nel6s2rn4ed4ing4s4table2tor5ial1welve3ntieth5y2ice3n4s3st5ed5ing5s1ying2pe4d4s5et7s7ting4writer3ical7ly4ng2re4s0ultimate8ly1mbrella1nable3cceptable3ffected3mbiguous3ttended3uthorised9zed3vailable4oidable3ware2balanced3earable4lievable9bly3iased2certain9ty3hanged3le5ar3omfortable5mon4nnected5scious5vincing2defined4r5estimate5go7es7ing7ne6raduate9uates7ound9nds5lain7y6ie8s7ne9d9s8ing6ying5neath5stand9dable9ding9ds7ood5take9n9s8ing6ook5went4sirable3id3o4cumented4es4ing4ne4ubtedly3uly2easy3mployed8ment3xpected9dly5lained2fair4miliar3inished3ortunate9tely4unded3riendly2happy3ealthy4lpful2ified6s4orm7ly4y5ing3mportant3nteresting3on5s3que6ly3t4e5d5s4ing4s4y3versal9ly7e7ities9y2justified2known2less3ike6ly4mited3oad4ck6ed6ing6s3ucky2natural3ecessarily9ry2obtainable3fficial2pleasant3opular3redictable2read6able5listic5sonable4lated5iable2safe4tisfactory3een4t3olicited4und3pecified3table3uccessful4itable4pported4re4specting2tidy4l3o3rue2usable4ed4ual7ly2wanted3elcome3illing4se3orkable1pbringing2date6d6s5ing2grade7d7s6ing2on2per2right2set5s5ting3ide3tairs2ward6s1rban2ge4d4ncy5t6ly4s3ing1sable3ge2ed3ful6ly6ness3less3r4s3s2ing2ual5ly1tilities6y2ter5ly0vacancies6y4tion8s3uum2gue5ly2in2lid5ity3ley3uable4e5d5s4ing3ve5s2ndalism3ish6ed7s6ing3s2riable8s5nce6t7s5tion9s4ed5s5ties6y4ous3y4ing2st4ly1ector6s2getable9s6rian2hicle7s2in2locity2nd4ed4ing4or4s3ture3ue5s2rb4al6ly5tim4ose4s3dict3ification6ed7s5y6ing3satile4e5s4ion7s4us3tical8ly3y2ssel1iable2car3e3inity4ous3tim6s4ory2deo2ew4ed5r4ing4point9s4s2gorously2le3lage7s2ntage3yl2olate6ion4ence6t7ly4in2rtual7ly5e6s3us5es2sible4on4t5ed5ing5or7s5s3ual6ly2tal1ocabulary4l2ice5s3d2ltage3ume6s4ntarily8y6eer9ed9ing9s2te4d4r5s4s3ing2uch2wel1ulnerable0wade4d4s3ing2ffle2ge4s2it4ed4ing4s2ke4d4s3ing2lk4ed4ing4s3l4et4s2nder6ed6ing6s3t4ed4ing4s2rd3ehouse3m4ed4ing4s3n4ed4ing7s4s3p4ed4ing4s3rant7y3s3time3y2sh4ed5s4ing3te5d5ful5s4ing2tch5ed6s5ing3er5s2ve4d4s3ing2ys1eak4ness8es3lth6y3r4ing4s4y3sel6s3ther2dded4ing3s2ek4day4end7s4ly4s2igh5t3rd2lcome7d7s6ing3fare3l2nt2re2st4ern2ts3ting1hale5s3t4ever4soever2eel5s3n4ce4ever3re5as5by5upon5ver3ther2ich5ever3le4st3m3stle7s3te5s2oever3le5heartedly4ly3m3op5s3se1icked2de4ly4r4spread5t3th2fe2ld4ly3l4ed4ing7ly4s2nd4ed4ing4ow6ing6s4s3e4s3g4s3ner6s4ing3s3ter2pe4d4s3ing2re4d4s3ing2sdom3e4r4st3h4ed5s4ing2tch3h4draw8al8ing8n8s6ew4in4out3ness7ed8s7ing3ty2ve4s2zard1oke4n2lf2man3bat3en2nder6ed6ful9ly6ing6s4rous3t2od4en4s2rd4ed4ing4s3e3k4able4ed5r6s4ing7s4load4s5hop5tation9ons3ld5s5wide3m4s3n3ried6s4y5ing3se4hip4t3th5while5y2uld3nd1rap4ped6r7s5ing4s3th2eck5ed6r5ing5s3n3tched2ist3te5r6s5s4ing7s4ten2ong5ly5s3te0yard4s2wn1ear4ly4s2llow2sterday2ti1ield5s1oung5er6st3r4s5elf7ves3th0zero4s1one4s2om';
/* Words that must never be offered (also removed from the dictionary above). */
const SB_BAN = 'abort aborted aborting abortion aborts abuse abused abuses alcohol alcoholic arse bastard bastards beer beers bloody bomb bombed bombing bombs bugger buggers condom crap damn damnation damned damning damns dead deadly death deaths died dies drug drugs drunk drunken fatal fool fooled fooling foolish fools guns hate hated hates heroin hell heterosexual homosexual homosexuality idiot idiotic idiots insane jerk kill killed killer killing kills lesbian lust moron morons murder murdered murderer murdering murders naked nuts pornography prostitute prostitutes racism racist rape screw screwed screwing screws sexes sexist sexual sexuality sexually sexy slave slaves smoke smoked smoker smokers smokes smoking stupid stupidity suicidal suicide terror terrorism terrorist terrorists tobacco toilet toilets torture virgin weapon weapons whiskey whisky assault crazy ugly devil cigarette butt butts boob boobs fart farts poop pimp slut whore bitch dick cock cocks twit wimp turd vomit puke snot sleaze stoned loser dumb nude nudes breast breasts penis vagina urine sperm bust busted busts gamble gambling casino dyke queer coon spic chink kike gook wank twat cunt shit fuck piss tart bugger anal rectum genital genitals nipple nipples poo pooh porn erotic strip stripper bleed bleeding gore gory slay slain stab stabbed gun shoot shot shooting shoots shots war wars warfare fight fights fighting hit hits hitting punch punched beat beating beaten rotten stink stinks stinky smell sweat sweaty greed greedy lazy liar liars lie lies lied cheat cheated cheating steal stole stolen thief thieves rob robber robbers robbed crime crimes criminal criminals prison jail jailed enemy enemies victim victims poison poisoned poisonous hang hanged hung obscene worthless kidnap corpse execute executed execution freak filthy affair'.split(' ');
/* ---- END DATA ---- */
let SB_WORDS = null, SB_MASKS = null, SB_SET = null, SB_PANG = null;
const sbBit = (ch) => 1 << (ch.charCodeAt(0) - 97);
function sbMask(w) { let m = 0; for (let i = 0; i < w.length; i++) m |= sbBit(w[i]); return m; }
function popcount(m) { let n = 0; while (m) { n += m & 1; m >>>= 1; } return n; }
function sbLoad() {
  if (SB_WORDS) return;
  const banned = new Set(SB_BAN), out = [], re = /(\d)([a-z]+)/g;
  let prev = '', m;
  while ((m = re.exec(SB_PACKED))) { const w = prev.slice(0, +m[1]) + m[2]; prev = w; if (!banned.has(w)) out.push(w); }
  SB_WORDS = out; SB_SET = new Set(out); SB_MASKS = out.map(sbMask);
  /* every set of 7 different letters (without s, so plurals do not flood the puzzle) that spells at least one word */
  const seen = new Map();
  for (let i = 0; i < out.length; i++) { const mk = SB_MASKS[i]; if (popcount(mk) === 7 && !(mk & sbBit('s')) && !seen.has(mk)) seen.set(mk, out[i]); }
  SB_PANG = [...seen.keys()].sort((a, b) => a - b);
}
P.sbWords = () => { sbLoad(); return SB_WORDS; };
P.SB_BAN = SB_BAN;
P.sbMask = sbMask;
/* Words of 4+ letters made only from the puzzle letters and containing the centre letter. */
P.sbSolve = function (mask, center) {
  sbLoad(); const cb = sbBit(center), words = [], pangrams = [];
  for (let i = 0; i < SB_WORDS.length; i++) {
    const mk = SB_MASKS[i];
    if ((mk & ~mask) === 0 && (mk & cb)) { words.push(SB_WORDS[i]); if (mk === mask) pangrams.push(SB_WORDS[i]); }
  }
  return { words, pangrams };
};
/* Points: 4 letters = 1, longer words = their length, plus 7 for a pangram. */
P.sbPoints = function (word, mask) { const base = word.length === 4 ? 1 : word.length; return base + (sbMask(word) === mask ? 7 : 0); };
P.sbMax = (words, mask) => words.reduce((s, w) => s + P.sbPoints(w, mask), 0);
/* Make a puzzle: 7 letters (one centre) with 15+ words and at least one pangram. rf is a random function (seeded for the daily one). */
P.sbPuzzle = function (rf) {
  sbLoad(); rf = rf || rnd;
  for (let pass = 0; pass < 2; pass++) {
    for (let tries = 0; tries < 400; tries++) {
      const mask = SB_PANG[rf(SB_PANG.length)];
      const letters = []; for (let c = 0; c < 26; c++) if (mask & (1 << c)) letters.push(String.fromCharCode(97 + c));
      for (const center of shuffle(letters, rf)) {
        const s = P.sbSolve(mask, center);
        if (s.words.length >= 15 && s.pangrams.length >= 1 && (pass === 1 || s.words.length <= 90)) {
          return { mask, letters, center, outer: letters.filter(l => l !== center), words: s.words, pangrams: s.pangrams, max: P.sbMax(s.words, mask) };
        }
      }
    }
  }
  return null; // cannot happen with the built-in dictionary
};
P.sbDaily = (dateKey) => P.sbPuzzle(seeded('bee:' + dateKey));
P.SB_RANKS = [['Beginner', 0], ['Good Start', 0.02], ['Moving Up', 0.05], ['Good', 0.08], ['Solid', 0.15], ['Nice', 0.25], ['Great', 0.4], ['Amazing', 0.5], ['Genius', 0.7]];
/* Rank for a score out of a maximum: { name, idx, nextName, nextAt }. */
P.sbRank = function (score, max) {
  let idx = 0;
  for (let i = 0; i < P.SB_RANKS.length; i++) if (score >= Math.ceil(P.SB_RANKS[i][1] * max - 1e-9)) idx = i;
  const nx = P.SB_RANKS[idx + 1];
  return { name: P.SB_RANKS[idx][0], idx, nextName: nx ? nx[0] : '', nextAt: nx ? Math.ceil(nx[1] * max - 1e-9) : 0 };
};
/* Check a typed word: { ok, msg, pts, pangram, word }. found = Set of lowercase words already found. */
P.sbCheck = function (puz, input, found) {
  sbLoad();
  const word = String(input == null ? '' : input).toLowerCase().replace(/[^a-z]/g, '');
  if (word.length < 4) return { ok: false, msg: word.length ? 'Too short: use 4 or more letters' : 'Type or tap some letters first', word };
  if ((sbMask(word) & ~puz.mask) !== 0) return { ok: false, msg: 'Bad letters: use only the seven letters', word };
  if (!(sbMask(word) & sbBit(puz.center))) return { ok: false, msg: 'Missing the centre letter', word };
  if (found.has(word)) return { ok: false, msg: 'Already found', word };
  if (!SB_SET.has(word)) return { ok: false, msg: 'Not in the word list', word };
  const pangram = sbMask(word) === puz.mask;
  return { ok: true, pts: P.sbPoints(word, puz.mask), pangram, word, msg: pangram ? 'Pangram! +' + P.sbPoints(word, puz.mask) : 'Nice! +' + P.sbPoints(word, puz.mask) };
};

reg({
  id: 'spellingbee', name: 'Spelling Bee', icon: '🍯', cat: 'fun',
  desc: 'Make words of 4+ letters from seven letters including the centre one. Pangram bonus, ranks to Genius, daily puzzle.',
  keys: ['words', 'letters', 'puzzle', 'daily', 'pangram', 'vocabulary', 'anagram'], needs: ['storage'], pro: false,
  render(el) {
    const B = bag();
    let puz = null, mode = 'daily', found = [], outer = [], msg = '', info = '', showAll = false;
    const today = todayKey();

    function saveDaily() { if (mode === 'daily') sset('spellingbee.daily', { date: today, found }); }
    function score() { return found.reduce((s, w) => s + P.sbPoints(w, puz.mask), 0); }
    function load(m) {
      mode = m; showAll = false; msg = ''; info = '';
      puz = m === 'daily' ? P.sbDaily(today) : P.sbPuzzle();
      outer = shuffle(puz.outer);
      found = [];
      if (m === 'daily') { const d = sget('spellingbee.daily', null); if (d && d.date === today && Array.isArray(d.found)) found = d.found.filter(w => puz.words.includes(w)); }
      paint();
    }
    function paint() {
      const sc = score(), rk = P.sbRank(sc, puz.max), pct = puz.max ? Math.min(100, sc / puz.max * 100) : 0;
      const tile = (l, c) => `<button class="btn${c ? '' : ' alt'}" data-a="tile" data-l="${l}" aria-label="Letter ${l.toUpperCase()}${c ? ', centre letter' : ''}" style="width:66px;height:66px;font-size:26px;font-weight:700;text-transform:uppercase;border-radius:18px;${c ? '' : 'background:var(--surface2)'}">${l}</button>`;
      el.innerHTML = `<div class="card"><div class="row muted" style="font-size:13px"><span>${mode === 'daily' ? "Today's puzzle" : 'Random puzzle'}</span><span style="text-align:right">${found.length} of ${puz.words.length} words</span></div>
        <div class="row" style="margin:6px 0"><b>${esc(rk.name)}</b><span class="muted" style="text-align:right">${sc} points${rk.nextName ? ' · ' + (rk.nextAt - sc) + ' to ' + esc(rk.nextName) : ''}</span></div>
        <div class="progress"><i style="width:${pct}%"></i></div>
        <div class="center" id="sbMsg" role="status" style="min-height:24px;margin:10px 0 4px;font-weight:600">${esc(msg)}</div>
        <label class="f">Your word<input type="text" id="sbIn" maxlength="15" autocomplete="off" autocapitalize="none" spellcheck="false" style="text-transform:uppercase;text-align:center;font-size:20px;letter-spacing:2px"></label>
        <div style="display:flex;flex-direction:column;align-items:center;gap:8px;margin:12px 0">
          <div style="display:flex;gap:8px">${tile(outer[0])}${tile(outer[1])}</div>
          <div style="display:flex;gap:8px">${tile(outer[2])}${tile(puz.center, true)}${tile(outer[3])}</div>
          <div style="display:flex;gap:8px">${tile(outer[4])}${tile(outer[5])}</div></div>
        <div class="row"><button class="btn alt" data-a="del">Delete</button><button class="btn alt" data-a="shuffle">Shuffle</button><button class="btn" data-a="enter">Enter</button></div>
        <div class="row" style="margin-top:8px"><button class="btn alt" data-a="hint">Hint</button><button class="btn alt" data-a="mode">${mode === 'daily' ? 'New random' : "Today's puzzle"}</button>${mode === 'daily' ? '' : '<button class="btn alt" data-a="random">Another</button>'}</div>
        ${info ? `<div class="item" style="display:block;margin-top:10px">${info}</div>` : ''}
        <h3 style="margin:14px 0 6px">Found words</h3>
        <div id="sbFound">${found.length ? found.slice().sort().map(w => `<span class="chip" style="min-height:32px;display:inline-flex;align-items:center;margin:2px;${sbMask(w) === puz.mask ? 'background:var(--accent);color:var(--accent-t)' : ''}">${esc(w)}</span>`).join('') : '<span class="muted">None yet. Words need 4+ letters and the centre letter.</span>'}</div>
        <button class="btn alt" style="width:100%;margin-top:12px" data-a="giveup">${showAll ? 'Hide answers' : 'Show all answers'}</button>
        ${showAll ? `<div style="margin-top:8px">${puz.words.map(w => `<span class="chip" style="min-height:30px;display:inline-flex;align-items:center;margin:2px;${found.includes(w) ? '' : 'opacity:.6'}">${esc(w)}</span>`).join('')}</div>` : ''}</div>`;
    }
    const inp = () => $('#sbIn', el);
    function submit() {
      const i = inp(); const r = P.sbCheck(puz, i ? i.value : '', new Set(found));
      msg = r.msg; info = '';
      if (r.ok) { found.push(r.word); saveDaily(); if (r.pangram) { try { if (typeof beep === 'function') beep(); } catch (e) { /* ignore */ } } }
      paint();
      const m = $('#sbMsg', el); if (m && !r.ok) m.style.color = 'var(--danger)'; else if (m) m.style.color = 'var(--ok)';
      const n = inp(); if (n && !r.ok) n.value = ''; if (n) n.focus();
    }
    function hint() {
      const left = puz.words.filter(w => !found.includes(w));
      if (!left.length) { info = 'You found every word. Amazing!'; return paint(); }
      const by = {}; left.forEach(w => { by[w[0]] = (by[w[0]] || 0) + 1; });
      const pg = puz.pangrams.filter(w => !found.includes(w)).length, pick1 = left[rnd(left.length)];
      info = `<b>${left.length}</b> words left, <b>${pg}</b> pangram${pg === 1 ? '' : 's'} left (${puz.pangrams.length} in total).<br>Words by first letter: ${Object.keys(by).sort().map(k => k.toUpperCase() + ' ' + by[k]).join(', ')}.<br>A word starts with <b>${esc(pick1.slice(0, 2).toUpperCase())}</b> and has ${pick1.length} letters.`;
      paint();
    }
    const act = {
      tile(b) { const i = inp(); if (i && i.value.length < 15) { i.value += b.dataset.l; i.focus(); } },
      del() { const i = inp(); if (i) { i.value = i.value.slice(0, -1); i.focus(); } },
      shuffle() { const i = inp(), v = i ? i.value : ''; outer = shuffle(outer); paint(); if (inp()) inp().value = v; },
      enter: submit, hint,
      mode() { load(mode === 'daily' ? 'random' : 'daily'); },
      random() { load('random'); },
      giveup() { showAll = !showAll; const i = inp(), v = i ? i.value : ''; paint(); if (inp()) inp().value = v; }
    };
    B.on(el, 'click', e => { const b = e.target.closest('[data-a]'); if (b && act[b.dataset.a] && puz) act[b.dataset.a](b); });
    B.on(el, 'keydown', e => { if (e.key === 'Enter' && e.target && e.target.id === 'sbIn') { e.preventDefault(); submit(); } });
    B.on(el, 'input', e => { const t = e.target; if (t && t.id === 'sbIn') t.value = t.value.replace(/[^a-zA-Z]/g, '').slice(0, 15); });
    load('daily');
    return () => { B.clear(); puz = null; };
  }
});

/* =====================================================================
   7. ANAGRAM RACE
   ===================================================================== */
/* ---- DATA: words by difficulty level (separated by spaces) ---- */
const AR = [
  { name: 'Warm-up', w: 'apple bread chair table house water river cloud green happy light night plant stone sleep smile train horse tiger zebra lemon mouse music paper pizza queen robot sheep shirt shoes snake spoon sugar sweet tooth watch whale wheel world young beach black brave bring candy clock dance dream drink earth fruit ghost grass heart juice knife laugh lunch money ocean party piano pilot plane radio salad score shell skate smoke storm sunny teach tower toast truck uncle voice wagon wings write frog bird fish lake moon star tree wind rain snow cake milk book door farm gold hand jump kite lamp road ship sing song tent wolf bear duck goat lion nest park sand seed sock swim tail town walk wall wave beans bench brush cabin camel carry chalk chest claim cream crown daisy diary drive eagle fairy field flame float honey hotel igloo jelly lucky magic maple march noise paint peach pearl phone plate plum quiet quilt ranch roast scarf shape sheet shine skirt slide snack space speed spice sport stamp steam stick swing thumb track trick trunk vines'.replace(/\s+/g, ' ') },
  { name: 'Easy', w: 'garden window orange purple yellow silver forest monkey turtle dragon castle pirate rocket button basket bridge candle circle flower guitar hammer jacket kitten ladder magnet market mirror napkin pencil pillow pocket school simple spider summer sunset sweater ticket travel valley winter wonder animal banana butter cheese cookie dinner doctor family friend finger flavor gentle island jungle lesson letter listen method nature number office people puppet reader rubber second secret shadow signal singer spring stream street camera carpet cattle choose cotton danger dozens eleven engine escape farmer fiddle gather glitter ground harbor insect jigsaw kettle lizard marble minute muffin nephew orchard parent pickle planet pretty puzzle reason ribbon saddle salmon season shovel sister smooth soccer spirit sponge square statue stripe temple tender thirty throne tunnel turkey unique velvet violin voyage wallet walnut weekend wooden zipper' },
  { name: 'Medium', w: 'balloon blanket bicycle chicken cabinet dolphin diamond elephant fireman giraffe holiday hospital kitchen lantern monster mystery octopus penguin pumpkin rainbow sandwich shoulder teacher thunder tornado treasure umbrella village volcano weather whistle airplane backpack birthday campfire computer dinosaur festival football goldfish hamster keyboard library mountain notebook painting pancakes popcorn princess reindeer scooter seagull sunshine snowman squirrel stadium surprise swimming tomorrow vacation waterfall wardrobe blossom caravan chimney cushion dessert freedom grocery harvest journey kingdom lullaby machine monitor musical nursery outside pattern picnic pioneer planter pottery railway scholar sailing shelter sparrow station stomach teacup thimble tractor trumpet vehicle wedding whisper workshop' },
  { name: 'Hard', w: 'adventure butterfly chocolate crocodile fireworks fountain gingerbread grandmother hamburger hurricane invention kangaroo lighthouse microscope orchestra parachute pineapple playground porcupine rectangle sandcastle spaceship strawberry telescope underwater wonderful yesterday blackboard classroom afternoon important beautiful celebrate champion chimpanzee dictionary electricity enormous expedition favourite friendship generous imagination marshmallow motorcycle neighbour paintbrush photograph rollercoaster skateboard snowflake spectacular supermarket thunderstorm trampoline vegetable volleyball watermelon wheelbarrow alphabet apartment astronaut basketball bookshelf breakfast calendar carnival cauliflower celebration comfortable creature daydream elevator evergreen excellent explorer fantastic gymnastics headphones helicopter horizon kindness lemonade moonlight mysterious nightingale peppermint pyramid sunflower tangerine treehouse universe vocabulary whirlpool' }
];
/* ---- END DATA ---- */
const arList = (lv) => split(AR[lv].w.replace(/ /g, '|'));
P.AR = AR;
/* All words of a level (unique within the level and across levels: first occurrence wins). */
P.arWords = function (lv) {
  const seen = new Set(); const out = [];
  for (let i = 0; i < AR.length; i++) for (const w of arList(i)) { if (!seen.has(w)) { seen.add(w); if (i === lv) out.push(w); } }
  return out;
};
P.arAll = () => AR.reduce((a, _, i) => a.concat(P.arWords(i)), []);
P.arLevel = (solved) => Math.min(AR.length - 1, Math.floor(Math.max(0, solved) / 4));
/* A shuffle of the word that is never the word itself (and, when possible, not another dictionary word). */
P.arScramble = function (word, rf, isWord) {
  rf = rf || rnd;
  const letters = word.split(''); let best = null;
  for (let t = 0; t < 40; t++) {
    const s = shuffle(letters, rf).join('');
    if (s === word) continue;
    best = s; if (!isWord || !isWord(s)) return s;
  }
  if (best) return best;
  // every arrangement equals the word (all letters the same): swap is impossible, return reversed marker-free fallback
  return word.length > 1 && new Set(letters).size > 1 ? letters.reverse().join('') : word;
};
/* Is the guess right? The word itself, or any other arrangement that is a real word (e.g. listen / silent). */
P.arCheck = function (word, guess, isWord) {
  const g = String(guess == null ? '' : guess).toLowerCase().replace(/[^a-z]/g, '');
  if (g.length !== word.length) return false;
  if (g === word) return true;
  const sort = (x) => x.split('').sort().join('');
  return sort(g) === sort(word) && !!isWord && isWord(g);
};
P.arPoints = (len, streak) => len + Math.min(5, Math.max(0, streak));

reg({
  id: 'anagramrace', name: 'Anagram Race', icon: '🏇', cat: 'fun',
  desc: '60-second race to unscramble words, easy to hard, with a streak bonus and best score.',
  keys: ['unscramble', 'word', 'scramble', 'jumble', 'letters', 'timer', 'race'], needs: ['storage'], pro: false,
  render(el) {
    const B = bag();
    const ROUND = 60;
    let G = null, tid = null;
    const best = () => sget('anagramrace.best', 0) | 0;
        let dictSet = null;
    const inDict = (w) => { if (!dictSet) dictSet = new Set(P.sbWords()); return dictSet.has(w); };

    function menu() {
      B.stop(tid); G = null;
      el.innerHTML = `<div class="card center"><div class="mid">Anagram Race</div><p class="muted">Unscramble as many words as you can in ${ROUND} seconds. Words get harder as you go. Skipping resets your streak; a streak gives bonus points.</p>
        <p class="muted">Best score: <b>${best()}</b></p><button class="btn" style="width:100%" data-a="start">Start</button></div>`;
    }
    function next() {
      const lv = P.arLevel(G.solved), list = P.arWords(lv);
      let w, tries = 0;
      do { w = list[rnd(list.length)]; tries++; } while (G.used.has(w) && tries < 30);
      G.used.add(w); G.word = w; G.lv = lv; G.scr = P.arScramble(w, undefined, inDict);
      paintWord();
    }
    function paintWord() {
      const h = $('#arLetters', el); if (!h) return;
      h.innerHTML = G.scr.split('').map((c, i) => `<button class="btn alt" data-a="tile" data-l="${c}" aria-label="Letter ${c.toUpperCase()}" style="width:44px;height:52px;padding:0;font-size:22px;font-weight:700;text-transform:uppercase">${c}</button>`).join('');
      $('#arLevel', el).textContent = AR[G.lv].name;
      const i = $('#arIn', el); i.value = ''; i.maxLength = G.word.length; i.focus();
    }
    function start() {
      G = { t0: Date.now(), solved: 0, streak: 0, bestStreak: 0, score: 0, used: new Set(), missed: [], over: false };
      el.innerHTML = `<div class="card center"><div class="row muted" style="font-size:14px"><span>Score <b id="arScore">0</b></span><span>🔥 <b id="arStreak">0</b></span><span>Time <b id="arTime">${ROUND}</b></span></div>
        <div class="progress" style="margin:6px 0"><i id="arBar" style="width:100%"></i></div><div class="muted" id="arLevel" style="margin:8px 0 4px"></div>
        <div id="arLetters" style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:6px 0"></div>
        <label class="f" style="text-align:left">Your answer<input type="text" id="arIn" maxlength="15" autocomplete="off" autocapitalize="none" spellcheck="false" style="text-transform:uppercase;text-align:center;font-size:22px;letter-spacing:2px"></label>
        <div class="muted center" id="arMsg" role="status" style="min-height:22px;margin:6px 0"></div>
        <div class="row"><button class="btn alt" data-a="clear">Clear</button><button class="btn alt" data-a="reshuffle">Shuffle</button><button class="btn alt" data-a="skip">Skip</button></div>
        <button class="btn" style="width:100%;margin-top:8px" data-a="enter">Enter</button></div>`;
      next();
      B.stop(tid);
      tid = B.every(tick, 200);
    }
    function tick() {
      if (!G || G.over) return;
      const left = P.chRemaining(G.t0, ROUND, Date.now()), t = $('#arTime', el);
      if (t) { t.textContent = left; $('#arBar', el).style.width = (left / ROUND * 100) + '%'; }
      if (left <= 0) over();
    }
    function say(m, ok) { const e = $('#arMsg', el); if (e) { e.textContent = m; e.style.color = ok ? 'var(--ok)' : 'var(--danger)'; } }
    function submit() {
      if (!G || G.over) return;
      const i = $('#arIn', el), v = i ? i.value : '';
      if (P.arCheck(G.word, v, inDict)) {
        G.solved++; G.streak++; G.bestStreak = Math.max(G.bestStreak, G.streak); G.score += P.arPoints(G.word.length, G.streak - 1);
        $('#arScore', el).textContent = G.score; $('#arStreak', el).textContent = G.streak;
        say('Correct!', true); next();
      } else if (v) { say('Not it, try again', false); if (i) i.value = ''; }
    }
    function over() {
      B.stop(tid); G.over = true;
      try { if (typeof beep === 'function') beep(); } catch (e) { /* ignore */ }
      const prev = best(), isBest = G.score > prev; if (isBest) sset('anagramrace.best', G.score);
      const g = G;
      el.innerHTML = `<div class="card center"><div class="muted">Time is up!</div><div class="big">${g.score}</div><div class="muted">points · ${g.solved} word${g.solved === 1 ? '' : 's'} · best streak ${g.bestStreak}</div>
        <p>${isBest && g.score > 0 ? '🎉 New best score!' : 'Best score: <b>' + best() + '</b>'}</p>
        ${g.missed.length ? `<h3 style="margin:10px 0 4px">Skipped words</h3><div>${g.missed.map(w => `<span class="chip" style="min-height:30px;display:inline-flex;align-items:center;margin:2px">${esc(w)}</span>`).join('')}</div>` : ''}
        <button class="btn" style="width:100%;margin-top:12px" data-a="start">Race again</button></div>`;
    }
    const act = {
      start,
      tile(b) { if (!G || G.over) return; const i = $('#arIn', el); if (i && i.value.length < G.word.length) { i.value += b.dataset.l; if (i.value.length === G.word.length) submit(); } },
      clear() { const i = $('#arIn', el); if (i) { i.value = ''; i.focus(); } },
      reshuffle() { if (G && !G.over) { G.scr = P.arScramble(G.word, undefined, inDict); paintWord(); } },
      skip() { if (!G || G.over) return; G.missed.push(G.word); G.streak = 0; $('#arStreak', el).textContent = 0; say('Skipped: it was ' + G.word, false); next(); },
      enter: submit
    };
    B.on(el, 'click', e => { const b = e.target.closest('[data-a]'); if (b && act[b.dataset.a]) act[b.dataset.a](b); });
    B.on(el, 'keydown', e => { if (e.key === 'Enter' && e.target && e.target.id === 'arIn') { e.preventDefault(); submit(); } });
    B.on(el, 'input', e => { const t = e.target; if (t && t.id === 'arIn') { t.value = t.value.replace(/[^a-zA-Z]/g, ''); if (G && !G.over && t.value.length === G.word.length) submit(); } });
    menu();
    return () => { B.clear(); G = null; };
  }
});

/*@@END@@*/

if (typeof module !== 'undefined' && module.exports) module.exports = P;
})();
