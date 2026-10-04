import { fail, rankByScore, rng as mkRng } from "../engine.js";
import { isWord, count, wordAt } from "../data/dico.js";

export const meta = {
  id: "motsor", name: "Mots en or", cat: "Mots", min: 2, max: 4, turnTime: 0,
  color: "#B45309", desc: "Pose tes lettres sur la grille, croise les mots et vise les cases en or.",
  rules: ["Chacun a 7 lettres sur son chevalet. À ton tour, pose des lettres sur une seule ligne ou une seule colonne pour former un mot.",
    "Le premier mot passe par l'étoile du centre. Ensuite, chaque mot doit toucher les lettres déjà posées.",
    "Tous les mots formés (y compris ceux qui se croisent) doivent exister dans le dictionnaire.",
    "Cases bonus : LD lettre compte double, LT lettre compte triple, MD mot compte double, MT mot compte triple. Elles ne comptent que le tour où tu les recouvres.",
    "Le joker (lettre blanche) remplace n'importe quelle lettre mais vaut 0 point.",
    "Tu poses tes 7 lettres d'un coup : prime de 50 points.",
    "Tu peux aussi échanger des lettres (s'il en reste au moins 7 dans le sac) ou passer.",
    "Fin : sac vide et un chevalet vide (le joueur récupère les points des lettres des autres), ou tout le monde passe deux fois de suite. Les lettres restantes sont déduites.",
    "Options : pendule (10 points de pénalité par minute de dépassement), dictionnaire tolérant ou strict, prime des 7 lettres."],
};

// ------------------------------------------------ réglages
export const options = [
  { key: "clock", label: "Pendule", icon: "⏱️",
    values: [[0, "Aucune", "Temps libre"], [10, "10 min", "Par joueur"], [25, "25 min", "Par joueur"]], def: 0 },
  { key: "dico", label: "Dictionnaire", icon: "📖",
    values: [["tolerant", "Tolérant", "Tu peux réessayer"], ["strict", "Strict", "Faux : tour perdu"]], def: "tolerant" },
  { key: "bingo", label: "Prime 7/7", icon: "🌟",
    values: [[50, "+50", "Officiel"], [30, "+30", "Plus modeste"], [100, "+100", "Généreux"]], def: 50 },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "🟨", desc: "Temps libre, mot refusé : tu réessaies, prime de 50 pour 7 lettres posées.",
    set: { clock: 0, dico: "tolerant", bingo: 50 } },
  { id: "tournoi", name: "Tournoi", emoji: "🏆", desc: "Pendule de 25 minutes chacun, et un mot faux te coûte ton tour.",
    set: { clock: 25, dico: "strict", bingo: 50 } },
  { id: "blitz", name: "Blitz", emoji: "⚡", desc: "10 minutes par joueur, pénalité au moindre dépassement.",
    set: { clock: 10, dico: "tolerant", bingo: 50 } },
  { id: "jackpot", name: "Jackpot", emoji: "💰", desc: "Poser ses 7 lettres rapporte 100 points de prime.",
    set: { clock: 0, dico: "tolerant", bingo: 100 } },
];
export function opt(settings, key) {
  const o = options.find((x) => x.key === key);
  const v = settings ? settings[key] : undefined;
  const hit = o.values.find((x) => x[0] === v || (v != null && String(x[0]) === String(v)));
  return hit ? hit[0] : o.def;
}

// ------------------------------------------------ lettres, sac et plateau
export const N = 15, CENTER = 112, RACK = 7;
export const VALUES = { A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 10, L: 1, M: 2, N: 1, O: 1, P: 3,
  Q: 8, R: 1, S: 1, T: 1, U: 1, V: 4, W: 10, X: 10, Y: 10, Z: 10, "?": 0 };
export const DIST = { A: 9, B: 2, C: 2, D: 3, E: 15, F: 2, G: 2, H: 2, I: 8, J: 1, K: 1, L: 5, M: 3, N: 6, O: 6, P: 2,
  Q: 1, R: 6, S: 6, T: 6, U: 6, V: 2, W: 1, X: 1, Y: 1, Z: 1, "?": 2 };
export const fullBag = () => Object.entries(DIST).map(([l, n]) => l.repeat(n)).join("");

// cases bonus : T mot triple, D mot double, t lettre triple, d lettre double (un quart, puis symétries)
export const PREMIUM = (() => {
  const b = Array(N * N).fill(".");
  const put = (ch, list) => list.forEach(([r, c]) => [[r, c], [r, 14 - c], [14 - r, c], [14 - r, 14 - c]].forEach(([y, x]) => (b[y * N + x] = ch)));
  put("T", [[0, 0], [0, 7], [7, 0]]);
  put("D", [[1, 1], [2, 2], [3, 3], [4, 4], [7, 7]]);
  put("t", [[1, 5], [5, 1], [5, 5]]);
  put("d", [[0, 3], [3, 0], [2, 6], [6, 2], [6, 6], [3, 7], [7, 3]]);
  return b.join("");
})();
const LM = { d: 2, t: 3 }, WM = { D: 2, T: 3 };

const EMPTY = ".";
const isEmpty = (ch) => ch === EMPTY;
const up = (ch) => ch.toUpperCase();
// valeur d'une lettre posée : les jokers sont en minuscules et valent 0
export const tileValue = (ch) => (ch >= "a" && ch <= "z" ? 0 : VALUES[ch] || 0);
export const rackValue = (rack) => [...rack].reduce((t, c) => t + VALUES[c], 0);
// un mot valide existe dans le dictionnaire et contient au moins une voyelle (écarte les sigles KG, CM...)
export const validWord = (w) => w.length >= 2 && /[AEIOUY]/.test(w) && isWord(w);

// ------------------------------------------------ partie
export function setup(players, settings, rng) {
  const order = rng.shuffle(players.map((p) => p.id));
  let bag = rng.shuffle([...fullBag()]).join("");
  const racks = {};
  for (const id of order) { racks[id] = bag.slice(0, RACK); bag = bag.slice(RACK); }
  return {
    order, cur: 0, board: EMPTY.repeat(N * N), bag, racks,
    score: Object.fromEntries(order.map((id) => [id, 0])),
    clock: opt(settings, "clock"), strict: opt(settings, "dico") === "strict", bingo: opt(settings, "bingo"),
    used: Object.fromEntries(order.map((id) => [id, 0])), turnAt: 0,
    scoreless: 0, moves: 0, log: null, hist: [], over: false, final: null,
    level: [1, 2, 3].includes(settings.level) ? settings.level : 2,
  };
}

export const toAct = (s) => (s.over ? [] : [s.order[s.cur]]);

// analyse d'un placement : tiles = [[case, lettre]] (minuscule = joker)
export function analyze(board, tiles, bingo = 50) {
  if (!Array.isArray(tiles) || !tiles.length) return { err: "Pose au moins une lettre" };
  if (tiles.length > RACK) return { err: "Trop de lettres" };
  const B = board.split("");
  const seen = new Set();
  for (const t of tiles) {
    if (!Array.isArray(t) || t.length !== 2) return { err: "Placement invalide" };
    const [i, ch] = t;
    if (!Number.isInteger(i) || i < 0 || i >= N * N) return { err: "Case hors de la grille" };
    if (typeof ch !== "string" || !/^[A-Za-z]$/.test(ch)) return { err: "Lettre invalide" };
    if (seen.has(i)) return { err: "Deux lettres sur la même case" };
    if (!isEmpty(board[i])) return { err: "Cette case est déjà prise" };
    seen.add(i); B[i] = ch;
  }
  const first = !/[A-Za-z]/.test(board);
  const rows = new Set(tiles.map((t) => Math.floor(t[0] / N))), cols = new Set(tiles.map((t) => t[0] % N));
  let dir; // 1 = horizontal, N = vertical
  if (tiles.length > 1) {
    if (rows.size === 1) dir = 1; else if (cols.size === 1) dir = N; else return { err: "Les lettres doivent être sur une seule ligne ou colonne" };
  } else {
    const i = tiles[0][0], c = i % N;
    dir = (c > 0 && !isEmpty(B[i - 1])) || (c < N - 1 && !isEmpty(B[i + 1])) ? 1 : N;
  }
  const word = (start, d) => {
    // remonte au début du mot puis lit jusqu'au bout
    let i = start;
    const prev = (k) => (d === 1 ? (k % N > 0 ? k - 1 : -1) : k - N);
    const next = (k) => (d === 1 ? (k % N < N - 1 ? k + 1 : -1) : (k + N < N * N ? k + N : -1));
    while (prev(i) >= 0 && !isEmpty(B[prev(i)])) i = prev(i);
    const cells = [];
    for (let k = i; k >= 0 && !isEmpty(B[k]); k = next(k)) cells.push(k);
    return cells;
  };
  const idx = tiles.map((t) => t[0]).sort((a, b) => a - b);
  const main = word(idx[0], dir);
  if (!idx.every((i) => main.includes(i))) return { err: "Les lettres doivent se suivre, sans trou" };
  const placed = new Set(idx);
  const lists = [];
  if (main.length >= 2) lists.push(main);
  for (const i of idx) { const c = word(i, dir === 1 ? N : 1); if (c.length >= 2) lists.push(c); }
  if (first) {
    if (!placed.has(CENTER)) return { err: "Le premier mot doit passer par l'étoile du centre" };
    if (main.length < 2) return { err: "Le premier mot doit avoir au moins 2 lettres" };
  } else {
    const linked = lists.some((cells) => cells.some((k) => !placed.has(k)));
    if (!linked) return { err: "Ton mot doit toucher les lettres déjà posées" };
  }
  if (!lists.length) return { err: "Forme un mot d'au moins 2 lettres" };
  const words = lists.map((cells) => {
    let sum = 0, mult = 1;
    for (const k of cells) {
      let v = tileValue(B[k]);
      if (placed.has(k)) { v *= LM[PREMIUM[k]] || 1; mult *= WM[PREMIUM[k]] || 1; }
      sum += v;
    }
    return { w: cells.map((k) => up(B[k])).join(""), score: sum * mult, cells };
  });
  const bonus = tiles.length === RACK ? bingo : 0;
  return { words, bonus, total: words.reduce((t, w) => t + w.score, 0) + bonus };
}

// lettres du chevalet utilisées par un placement (joker = "?")
function takeFromRack(rack, tiles) {
  const r = [...rack];
  for (const [, ch] of tiles) {
    const need = ch >= "a" ? "?" : ch;
    const k = r.indexOf(need);
    if (k < 0) return null;
    r.splice(k, 1);
  }
  return r.join("");
}

function draw(s, pid) {
  const n = Math.min(RACK - s.racks[pid].length, s.bag.length);
  s.racks[pid] += s.bag.slice(0, n);
  s.bag = s.bag.slice(n);
}

function finish(s, outId) {
  const final = {};
  let bonus = 0;
  for (const id of s.order) {
    const rem = rackValue(s.racks[id]);
    final[id] = { rem, pen: 0, got: 0 };
    if (id !== outId) { s.score[id] -= rem; bonus += rem; }
  }
  if (outId) { s.score[outId] += bonus; final[outId].got = bonus; final[outId].rem = 0; }
  if (s.clock) for (const id of s.order) {
    const over = s.used[id] - s.clock * 60000;
    if (over > 0) { final[id].pen = 10 * Math.ceil(over / 60000); s.score[id] -= final[id].pen; }
  }
  s.final = final;
  s.over = true;
}

function endTurn(s, pid, scored) {
  s.moves++;
  if (scored) s.scoreless = 0; else s.scoreless++;
  if (!scored && s.scoreless >= 2 * s.order.length) return finish(s, null);
  if (!s.bag.length && !s.racks[pid].length) return finish(s, pid);
  s.cur = (s.cur + 1) % s.order.length;
}

const pushHist = (s, e) => { s.hist.push(e); if (s.hist.length > 8) s.hist.shift(); };

export function reduce(s, pid, a) {
  if (toAct(s)[0] !== pid) fail("Ce n'est pas ton tour");
  const now = a.now || 0;
  const spent = () => { if (s.clock) { const from = s.turnAt || s.startedAt || now; s.used[pid] += Math.max(0, now - from); } s.turnAt = now; };
  if (a.type === "play") {
    const tiles = (a.tiles || []).map((t) => (Array.isArray(t) ? [t[0] | 0, String(t[1] || "")] : t));
    const rest = Array.isArray(a.tiles) ? takeFromRack(s.racks[pid], tiles.filter((t) => Array.isArray(t))) : null;
    if (rest === null) fail("Ces lettres ne sont pas sur ton chevalet");
    const r = analyze(s.board, tiles, s.bingo);
    if (r.err) fail(r.err);
    const bad = r.words.filter((w) => !validWord(w.w)).map((w) => w.w);
    if (bad.length) {
      if (!s.strict) fail(`Mot inconnu : ${bad.join(", ")}`);
      spent();
      s.log = { id: pid, t: "bad", words: bad };
      pushHist(s, { id: pid, t: "bad", w: bad[0], pts: 0 });
      return endTurn(s, pid, false), s;
    }
    spent();
    const B = s.board.split("");
    for (const [i, ch] of tiles) B[i] = ch;
    s.board = B.join("");
    s.racks[pid] = rest;
    s.score[pid] += r.total;
    draw(s, pid);
    s.log = { id: pid, t: "play", words: r.words.map((w) => [w.w, w.score]), pts: r.total, bonus: r.bonus, cells: tiles.map((t) => t[0]) };
    pushHist(s, { id: pid, t: "play", w: r.words[0].w, pts: r.total });
    endTurn(s, pid, true);
    return s;
  }
  if (a.type === "swap") {
    const letters = String(a.letters || "").toUpperCase().replace(/[^A-Z?]/g, "");
    if (!letters.length) fail("Choisis les lettres à échanger");
    if (s.bag.length < RACK) fail("Il faut au moins 7 lettres dans le sac pour échanger");
    let rack = [...s.racks[pid]];
    for (const c of letters) { const k = rack.indexOf(c); if (k < 0) fail("Ces lettres ne sont pas sur ton chevalet"); rack.splice(k, 1); }
    spent();
    s.racks[pid] = rack.join("");
    draw(s, pid);
    s.bag = mkRng(a.seed || 1).shuffle([...(s.bag + letters)]).join("");
    s.log = { id: pid, t: "swap", n: letters.length };
    pushHist(s, { id: pid, t: "swap", n: letters.length, pts: 0 });
    endTurn(s, pid, false);
    return s;
  }
  if (a.type === "pass") {
    spent();
    s.log = { id: pid, t: "pass", auto: !!a.auto };
    pushHist(s, { id: pid, t: "pass", pts: 0 });
    endTurn(s, pid, false);
    return s;
  }
  fail("Action inconnue");
}

export function result(s) {
  if (!s.over) return null;
  return { ranking: rankByScore(s.order.map((id) => ({ id, score: s.score[id] }))) };
}

// ------------------------------------------------ robot : ancrages + filtre du dictionnaire par lettres
const A = 65;
const bit = (ch) => 1 << (ch.charCodeAt(0) - A);
const VOWELS = "AEIOUY".split("").reduce((m, c) => m | bit(c), 0);
const popcount = (x) => { let n = 0; while (x) { x &= x - 1; n++; } return n; };
let MASKS = null;
// masque des lettres de chaque mot du dictionnaire (calculé une seule fois)
function masks() {
  if (MASKS) return MASKS;
  MASKS = [];
  for (let len = 2; len <= N; len++) {
    const n = count(len), arr = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      const w = wordAt(len, i);
      let m = 0;
      for (let k = 0; k < len; k++) m |= 1 << (w.charCodeAt(k) - A);
      arr[i] = m;
    }
    MASKS[len] = arr;
  }
  return MASKS;
}

// lettres autorisées sur une case vide pour ne pas casser le mot perpendiculaire
function crossInfo(board, i, d) {
  // d = sens du coup (1 horizontal) : on regarde le sens perpendiculaire
  const p = d === 1 ? N : 1;
  const prev = (k) => (p === 1 ? (k % N > 0 ? k - 1 : -1) : k - N);
  const next = (k) => (p === 1 ? (k % N < N - 1 ? k + 1 : -1) : (k + N < N * N ? k + N : -1));
  let pre = "", suf = "", sum = 0;
  for (let k = prev(i); k >= 0 && !isEmpty(board[k]); k = prev(k)) { pre = up(board[k]) + pre; sum += tileValue(board[k]); }
  for (let k = next(i); k >= 0 && !isEmpty(board[k]); k = next(k)) { suf += up(board[k]); sum += tileValue(board[k]); }
  if (!pre && !suf) return { mask: (1 << 26) - 1, sum: -1 };
  let mask = 0;
  for (let c = 0; c < 26; c++) if (validWord(pre + String.fromCharCode(A + c) + suf)) mask |= 1 << c;
  return { mask, sum };
}

// tous les coups possibles : [{tiles, score, n}]
export function genMoves(board, rack, bingo = 50, { maxLen = N, maxTiles = RACK, cap = 3000000 } = {}) {
  const M = masks();
  const first = !/[A-Za-z]/.test(board);
  const rackCnt = new Int8Array(27);
  let jokers = 0, rackMask = 0;
  for (const c of rack) { if (c === "?") jokers++; else { rackCnt[c.charCodeAt(0) - A]++; rackMask |= bit(c); } }
  const filled = (i) => !isEmpty(board[i]);
  const anchor = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) {
    if (filled(i)) continue;
    const r = Math.floor(i / N), c = i % N;
    if (first ? i === CENTER : (c > 0 && filled(i - 1)) || (c < N - 1 && filled(i + 1)) || (r > 0 && filled(i - N)) || (r < N - 1 && filled(i + N))) anchor[i] = 1;
  }
  const cross = [{}, {}];
  const getCross = (i, d) => { const t = cross[d === 1 ? 0 : 1]; return t[i] || (t[i] = crossInfo(board, i, d)); };
  const moves = [];
  let work = 0;
  const cnt = new Int8Array(27);
  const dirs = first ? [1] : [1, N];
  for (const d of dirs) for (let line = 0; line < N; line++) {
    if (first && line !== 7) continue;
    const cells = Array.from({ length: N }, (_, k) => (d === 1 ? line * N + k : k * N + line));
    if (!cells.some((i) => anchor[i])) continue;
    let lineMask = 0, lineN = 0;
    const lineCnt = new Int8Array(27);
    for (const i of cells) if (filled(i)) { const u = up(board[i]); lineMask |= bit(u); lineCnt[u.charCodeAt(0) - A]++; lineN++; }
    const avail = rackMask | lineMask;
    const top = Math.min(maxLen, rack.length + lineN);
    for (let len = 2; len <= top; len++) {
      const arr = M[len];
      for (let wi = 0; wi < arr.length; wi++) {
        const m = arr[wi];
        if (!(m & VOWELS)) continue;
        if (popcount(m & ~avail) > jokers) continue;
        if (++work > cap) return moves;
        const w = wordAt(len, wi);
        // assez de lettres en tout (chevalet + ligne + jokers) ?
        let miss = 0;
        cnt.fill(0);
        for (let k = 0; k < len; k++) { const c = w.charCodeAt(k) - A; cnt[c]++; if (cnt[c] > rackCnt[c] + lineCnt[c]) miss++; }
        if (miss > jokers) continue;
        for (let st = 0; st + len <= N; st++) {
          if (st > 0 && filled(cells[st - 1])) continue;
          if (st + len < N && filled(cells[st + len])) continue;
          // essai
          let ok = true, nNew = 0, hasAnchor = false, jk = jokers;
          cnt.fill(0);
          const tiles = [];
          let sum = 0, mult = 1, extra = 0;
          for (let k = 0; k < len; k++) {
            const i = cells[st + k], ch = w[k];
            if (filled(i)) {
              if (up(board[i]) !== ch) { ok = false; break; }
              sum += tileValue(board[i]);
              continue;
            }
            const c = ch.charCodeAt(0) - A;
            const ci = getCross(i, d);
            if (!(ci.mask & (1 << c))) { ok = false; break; }
            let letter = ch;
            if (cnt[c] < rackCnt[c]) cnt[c]++;
            else if (jk > 0) { jk--; letter = ch.toLowerCase(); }
            else { ok = false; break; }
            nNew++;
            if (nNew > maxTiles) { ok = false; break; }
            if (anchor[i]) hasAnchor = true;
            const v = tileValue(letter) * (LM[PREMIUM[i]] || 1), wm = WM[PREMIUM[i]] || 1;
            sum += v; mult *= wm;
            if (ci.sum >= 0) extra += (ci.sum + v) * wm;
            tiles.push([i, letter]);
          }
          if (!ok || !nNew || !hasAnchor) continue;
          if (first && !tiles.some((t) => t[0] === CENTER)) continue;
          const score = sum * mult + extra + (nNew === RACK ? bingo : 0);
          moves.push({ tiles, score, n: nNew, w });
        }
      }
    }
  }
  return moves;
}

// petite évaluation des lettres gardées (robot fort)
function leaveValue(rack, tiles) {
  const left = takeFromRack(rack, tiles) || "";
  let v = 0;
  const vow = [...left].filter((c) => "AEIOUY".includes(c)).length, cons = left.length - vow;
  v -= Math.abs(vow - cons) * 1.5;
  for (const c of left) { if (c === "?") v += 10; else if (c === "S") v += 3; else if ("JKQWXYZ".includes(c)) v -= 3; }
  if (left.includes("Q") && !left.includes("U")) v -= 5;
  const dup = {}; for (const c of left) dup[c] = (dup[c] || 0) + 1;
  for (const c in dup) if (dup[c] > 1) v -= (dup[c] - 1) * 2;
  return v;
}

export function bot(s, pid, r) {
  if (toAct(s)[0] !== pid) return null;
  const rack = s.racks[pid];
  const lvl = s.level || 2;
  const opts = lvl === 1 ? { maxLen: 6, maxTiles: 4, cap: 600000 } : lvl === 2 ? { maxLen: 10, cap: 1500000 } : { cap: 3000000 };
  const moves = genMoves(s.board, rack, s.bingo, opts);
  if (moves.length) {
    let m;
    if (lvl >= 3) {
      let best = -Infinity;
      for (const x of moves) { const v = x.score + (s.bag.length ? leaveValue(rack, x.tiles) : 0); if (v > best) { best = v; m = x; } }
    } else {
      moves.sort((a, b) => b.score - a.score);
      if (lvl === 2) m = moves[Math.floor(r.next() * r.next() * Math.min(10, moves.length))];
      else m = moves[Math.floor((0.3 + r.next() * 0.5) * moves.length)];
    }
    return { type: "play", tiles: m.tiles };
  }
  if (s.bag.length >= RACK) {
    // garde le joker et un S, renvoie le reste
    let keep = "";
    if (rack.includes("?")) keep += "?";
    if (rack.includes("S")) keep += "S";
    let out = rack;
    for (const c of keep) out = out.replace(c, "");
    return { type: "swap", letters: out || rack };
  }
  return { type: "pass" };
}

// temps écoulé : le joueur passe son tour
export function auto(s, pid) { return toAct(s)[0] === pid ? { type: "pass" } : null; }
export function botDelay(s, pid, r) { return 900 + r.int(1200); }
