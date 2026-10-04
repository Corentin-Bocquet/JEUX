// Taureaux 104 : 104 cartes numérotées, chacune porte de 1 à 7 têtes de taureau.
// Tout le monde choisit une carte en secret, puis on les place dans l'ordre croissant sur 4 rangées.
import { fail, rankByScore, rng as mkRng } from "../engine.js";

export const meta = {
  id: "taureaux", name: "Taureaux 104", cat: "Cartes", min: 2, max: 8, turnTime: 30,
  color: "#DC2626", desc: "Choisis ta carte en secret et évite de ramasser les taureaux.",
  rules: ["Chaque carte porte des têtes de taureau : 1 en général, 2 pour les multiples de 5, 3 pour les multiples de 10, 5 pour les doubles (11, 22...) et 7 pour le 55.",
    "Quatre rangées démarrent avec une carte chacune. Tu reçois 10 cartes.",
    "À chaque tour, tout le monde choisit une carte en même temps et en secret, puis on les révèle.",
    "Les cartes sont placées de la plus petite à la plus grande : chacune va au bout de la rangée qui finit par le nombre le plus proche en dessous.",
    "La 6e carte d'une rangée ramasse les 5 premières : tu prends leurs têtes, ta carte démarre la rangée.",
    "Si ta carte est plus petite que tous les bouts de rangée, tu choisis une rangée à ramasser et ta carte la remplace.",
    "Quand les mains sont vides, on redistribue jusqu'à ce que quelqu'un atteigne la limite de têtes. Le moins de têtes gagne.",
    "Options : limite de têtes (ou une seule manche), longueur des rangées, variante tactique avec seulement les cartes utiles."],
};

// ------------------------------------------------ réglages
export const options = [
  { key: "target", label: "Fin de partie", icon: "🐂",
    values: [[66, "66 têtes", "Règle classique"], [33, "33 têtes", "Partie courte"], [0, "1 manche", "10 tours"]], def: 66 },
  { key: "rowMax", label: "Rangée pleine", icon: "📏",
    values: [[5, "5 cartes", "La 6e ramasse"], [4, "4 cartes", "La 5e ramasse"]], def: 5 },
  { key: "tactic", label: "Paquet", icon: "🧠",
    values: [[false, "104 cartes", "Paquet entier"], [true, "Tactique", "Cartes comptées"]], def: false },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "🐂", desc: "Plusieurs manches jusqu'à 66 têtes : le moins chargé gagne.",
    set: { target: 66, rowMax: 5, tactic: false } },
  { id: "express", name: "Express", emoji: "⚡", desc: "Une seule manche de 10 tours.",
    set: { target: 0, rowMax: 5, tactic: false } },
  { id: "tactique", name: "Tactique", emoji: "🧠", desc: "Seulement 10 cartes par joueur plus 4 : toutes les cartes sont en jeu, à toi de compter.",
    set: { target: 66, rowMax: 5, tactic: true } },
  { id: "arene", name: "Arène", emoji: "🔥", desc: "Rangées de 4 et limite à 33 têtes : ça charge vite.",
    set: { target: 33, rowMax: 4, tactic: false } },
];
export function opt(settings, key) {
  const o = options.find((x) => x.key === key);
  const v = settings ? settings[key] : undefined;
  const hit = o.values.find((x) => String(x[0]) === String(v));
  return hit ? hit[0] : o.def;
}

// ------------------------------------------------ cartes
export function heads(n) {
  if (n === 55) return 7;
  if (n % 11 === 0) return 5;
  if (n % 10 === 0) return 3;
  if (n % 5 === 0) return 2;
  return 1;
}
export const rowHeads = (row) => row.reduce((t, c) => t + heads(c), 0);
export const HAND = 10;

function dealRound(s, rng) {
  const max = s.tactic ? s.order.length * HAND + 4 : 104;
  const pile = rng.shuffle(Array.from({ length: max }, (_, i) => i + 1));
  const hands = {};
  for (const id of s.order) hands[id] = pile.splice(0, HAND).sort((a, b) => a - b);
  const rows = pile.splice(0, 4).sort((a, b) => a - b).map((c) => [c]);
  Object.assign(s, { hands, rows, chosen: {}, queue: [], picker: null, turn: 1, reveal: null, taken: Object.fromEntries(s.order.map((id) => [id, 0])) });
}

export function setup(players, settings, rng) {
  const order = players.map((p) => p.id);
  const lv = +(settings && settings.level);
  const s = { order, target: opt(settings, "target"), rowMax: opt(settings, "rowMax"), tactic: opt(settings, "tactic"),
    level: [1, 2, 3].includes(lv) ? lv : 2, manche: 1, score: Object.fromEntries(order.map((id) => [id, 0])),
    hands: {}, rows: [], chosen: {}, queue: [], picker: null, turn: 1, reveal: null, taken: {}, lastRound: null, over: false };
  dealRound(s, rng);
  return s;
}

export function toAct(s) {
  if (s.over) return [];
  if (s.picker) return [s.picker];
  return s.order.filter((id) => s.chosen[id] == null);
}

// rangée où va une carte (-1 : trop faible)
export function rowFor(rows, c) {
  let best = -1;
  rows.forEach((r, i) => { const end = r[r.length - 1]; if (end < c && (best < 0 || end > rows[best][rows[best].length - 1])) best = i; });
  return best;
}

function take(s, id, i, c, log) {
  const got = rowHeads(s.rows[i]);
  s.score[id] += got; s.taken[id] += got;
  log.push({ id, card: c, row: i, took: got, cards: s.rows[i].slice() });
  s.rows[i] = [c];
}

// place les cartes révélées dans l'ordre ; s'arrête si quelqu'un doit choisir une rangée
function resolve(s, seed) {
  while (s.queue.length) {
    const { id, card } = s.queue[0];
    const i = rowFor(s.rows, card);
    if (i < 0) { s.picker = id; return; }
    s.queue.shift();
    if (s.rows[i].length >= s.rowMax) take(s, id, i, card, s.reveal.log);
    else { s.rows[i].push(card); s.reveal.log.push({ id, card, row: i, took: 0 }); }
  }
  s.picker = null;
  s.chosen = {};
  if (s.hands[s.order[0]].length) { s.turn++; return; }
  // fin de manche
  s.lastRound = { manche: s.manche, taken: { ...s.taken } };
  if (!s.target || s.order.some((id) => s.score[id] >= s.target)) { s.over = true; return; }
  s.manche++;
  dealRound(s, mkRng(seed ^ 0x51ed270b));
}

export function reduce(s, pid, a) {
  if (!toAct(s).includes(pid)) fail(s.picker ? "Attends que la rangée soit choisie" : "Tu as déjà choisi ta carte");
  if (a.type === "choose") {
    if (s.picker) fail("Choisis d'abord une rangée");
    const hand = s.hands[pid];
    const i = hand.indexOf(a.card);
    if (i < 0) fail("Carte absente");
    hand.splice(i, 1);
    s.chosen[pid] = a.card;
    if (toAct(s).length) return s;
    // tout le monde a choisi : révélation
    s.queue = s.order.map((id) => ({ id, card: s.chosen[id] })).sort((x, y) => x.card - y.card);
    s.reveal = { turn: s.turn, manche: s.manche, cards: s.queue.map((q) => [q.id, q.card]), log: [] };
    resolve(s, a.seed || 1);
    return s;
  }
  if (a.type === "pick") {
    if (s.picker !== pid) fail("Ce n'est pas à toi de choisir une rangée");
    const i = a.row;
    if (!Number.isInteger(i) || i < 0 || i >= s.rows.length) fail("Rangée inconnue");
    const q = s.queue.shift();
    take(s, pid, i, q.card, s.reveal.log);
    s.reveal.log[s.reveal.log.length - 1].pick = true;
    s.picker = null;
    resolve(s, a.seed || 1);
    return s;
  }
  fail("Action inconnue");
}

export function result(s) {
  if (!s.over) return null;
  return { ranking: rankByScore(s.order.map((id) => ({ id, score: s.score[id] })), true) };
}

// ------------------------------------------------ robots
export const cheapestRow = (rows) => rows.reduce((b, r, i) => (rowHeads(r) < rowHeads(rows[b]) || (rowHeads(r) === rowHeads(rows[b]) && r.length < rows[b].length) ? i : b), 0);

// coût estimé d'une carte : têtes prises si elle tombe sur une rangée pleine,
// plus un risque d'être poussée en 6e place par les cartes des autres
export function riskOf(s, pid, c, lv) {
  const rows = s.rows;
  const i = rowFor(rows, c);
  const others = s.order.length - 1;
  if (i < 0) {
    const cost = rowHeads(rows[cheapestRow(rows)]);
    // une petite carte qui ramasse une rangée légère peut être un bon coup
    return cost + (lv === 3 ? 0.5 : 0);
  }
  const row = rows[i];
  const room = s.rowMax - row.length; // cartes qu'on peut encore poser sans ramasser
  if (room <= 0) return rowHeads(row);
  const gap = c - row[row.length - 1] - 1; // nombres entre le bout et ma carte
  const unseen = 104 - s.rows.flat().length - s.hands[pid].length;
  // chaque autre joueur pose une carte dans l'intervalle avec une probabilité ~ gap / cartes inconnues
  const p = Math.min(0.95, gap / Math.max(1, unseen) * (lv === 3 ? 1.15 : 1));
  let pFill = 0;
  // probabilité qu'au moins « room » autres cartes tombent dans l'intervalle (binomiale)
  const comb = (n, k) => { let r = 1; for (let j = 1; j <= k; j++) r = (r * (n - k + j)) / j; return r; };
  for (let k = room; k <= others; k++) pFill += comb(others, k) * p ** k * (1 - p) ** (others - k);
  return pFill * (rowHeads(row) + 1) + (lv === 3 ? gap * 0.01 : 0);
}

export function bot(s, pid, rng) {
  if (s.picker === pid) {
    return { type: "pick", row: s.level === 1 && rng.next() < 0.4 ? rng.int(s.rows.length) : cheapestRow(s.rows) };
  }
  if (s.picker || s.chosen[pid] != null) return null;
  const hand = s.hands[pid];
  if (!hand.length) return null;
  const lv = s.level || 2;
  if (lv === 1 && rng.next() < 0.6) return { type: "choose", card: rng.pick(hand) };
  let best = hand[0], bestV = Infinity;
  for (const c of hand) {
    const v = riskOf(s, pid, c, lv) + rng.next() * (lv === 3 ? 0.05 : 0.4);
    if (v < bestV) { bestV = v; best = c; }
  }
  return { type: "choose", card: best };
}
export const auto = bot;
export function botDelay(s, pid, rng) { return s.picker ? 900 + rng.int(700) : 700 + rng.int(1600); }
