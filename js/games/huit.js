import { fail, rng as mkRng } from "../engine.js";
import { deck, rankOf, suitOf } from "./cards.js";

export const meta = {
  id: "huit", name: "Huit américain", cat: "Cartes", min: 2, max: 6, turnTime: 35,
  color: "#FF9600", desc: "Débarrasse-toi de tes cartes le premier.",
  rules: ["Pose une carte de la même couleur ou de la même valeur que celle du dessus.",
    "Le 8 se pose sur tout et change la couleur.",
    "Le 2 fait piocher 2 cartes au suivant, le Valet le fait passer son tour, l'As inverse le sens.",
    "Si tu ne peux pas jouer, pioche une carte : tu peux la poser si elle va, sinon tu passes.",
    "Le premier sans carte gagne, les autres sont classés selon les points qui leur restent.",
    "En course aux points, chacun encaisse les points de sa main à chaque manche (8 : 50, figures : 10, As : 1) : dès qu'un joueur atteint le seuil, le moins chargé gagne.",
    "Options : cartes en main au départ, une manche ou course aux points, effets des cartes spéciales."],
};

// ------------------------------------------------ réglages
export const options = [
  { key: "cards", label: "Cartes en main", icon: "🖐️",
    values: [[0, "Auto", "7 à deux, sinon 5"], [5, "5"], [7, "7"], [10, "10", "Longue partie"]], def: 0 },
  { key: "target", label: "Fin de partie", icon: "🏁",
    values: [[0, "1 manche", "Premier vidé"], [100, "100 pts", "Course courte"], [200, "200 pts", "Course longue"]], def: 0 },
  { key: "specials", label: "Cartes spéciales", icon: "✨",
    values: [[true, "Activées", "2, Valet, As"], [false, "Désactivées", "Seul le 8 compte"]], def: true },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "🎴", desc: "Une manche, cartes spéciales actives : le premier vidé gagne.",
    set: { cards: 0, target: 0, specials: true } },
  { id: "course", name: "Course à 100", emoji: "🏁", desc: "Plusieurs manches : tes cartes restantes comptent contre toi. Le moins chargé gagne.",
    set: { cards: 0, target: 100, specials: true } },
  { id: "grossemain", name: "Grosse main", emoji: "🗂️", desc: "10 cartes chacun au départ : il va falloir s'accrocher.",
    set: { cards: 10, target: 0, specials: true } },
  { id: "zen", name: "Tranquille", emoji: "🍃", desc: "Pas de pioche forcée ni de tour sauté : seul le 8 change la couleur.",
    set: { cards: 5, target: 0, specials: false } },
];
export function opt(settings, key) {
  const o = options.find((x) => x.key === key);
  const v = settings ? settings[key] : undefined;
  const hit = o.values.find((x) => String(x[0]) === String(v));
  return hit ? hit[0] : o.def;
}
const SPECIAL = ["2", "J", "A"];
// les anciennes parties n'ont pas le champ : effets activés
const specialsOn = (s) => s.specials !== false;

export const points = (c) => {
  const r = rankOf(c);
  if (r === "8") return 50;
  if (["J", "Q", "K"].includes(r)) return 10;
  if (r === "A") return 1;
  return +r;
};

// cartes distribuées : jamais plus que ce que le paquet permet (il reste au moins 12 cartes)
export function handSize(nPlayers, cards) {
  const want = cards > 0 ? cards : nPlayers === 2 ? 7 : 5;
  return Math.max(1, Math.min(want, Math.floor((52 - 12) / nPlayers)));
}

function dealRound(s, rng) {
  let pile = rng.shuffle(deck());
  const hands = {};
  const n = handSize(s.order.length, s.cards || 0);
  // le joueur qui commence tourne à chaque manche
  for (let k = 0; k < s.order.length; k++) { const id = s.order[(s.first + k) % s.order.length]; hands[id] = pile.splice(0, n); }
  // la première carte retournée n'est pas spéciale
  const i = pile.findIndex((c) => !["8", ...SPECIAL].includes(rankOf(c)));
  const top = pile.splice(i, 1)[0];
  Object.assign(s, { hands, pile, discard: [top], suit: suitOf(top), cur: s.first, dir: 1, drew: false, stuck: 0 });
}

export function setup(players, settings, rng) {
  const order = rng.shuffle(players.map((p) => p.id));
  const s = { order, hands: {}, pile: [], discard: [], suit: "S", cur: 0, dir: 1, drew: false,
    finished: [], log: null, winner: null,
    cards: opt(settings, "cards"), target: opt(settings, "target"), specials: opt(settings, "specials"),
    manche: 1, first: 0, scores: Object.fromEntries(order.map((id) => [id, 0])), lastRound: null };
  dealRound(s, rng);
  return s;
}

const handPts = (s, id) => s.hands[id].reduce((t, c) => t + points(c), 0);

// fin de manche : partie unique, ou course aux points sur plusieurs manches
function endRound(s, winner, seed) {
  if (!s.target) { s.winner = winner; return; }
  const got = {};
  for (const id of s.order) { got[id] = handPts(s, id); s.scores[id] += got[id]; }
  s.lastRound = { manche: s.manche, winner, got };
  if (s.order.some((id) => s.scores[id] >= s.target)) {
    // le moins chargé gagne ; à égalité, celui qui a remporté la dernière manche
    s.winner = s.order.slice().sort((x, y) => s.scores[x] - s.scores[y] || (x === winner ? -1 : y === winner ? 1 : 0))[0];
    return;
  }
  s.manche++;
  s.first = (s.first + 1) % s.order.length;
  dealRound(s, mkRng(seed));
}

const active = (s) => s.order.filter((id) => !s.finished.includes(id));
export function toAct(s) { return s.winner ? [] : [s.order[s.cur]]; }

export function canPlay(s, c) {
  const top = s.discard[s.discard.length - 1];
  return rankOf(c) === "8" || suitOf(c) === s.suit || rankOf(c) === rankOf(top);
}

function nextIdx(s, from, steps = 1) {
  let i = from;
  for (let k = 0; k < steps; k++) i = (i + s.dir + s.order.length) % s.order.length;
  return i;
}

function draw(s, n, seed) {
  const got = [];
  for (let k = 0; k < n; k++) {
    if (!s.pile.length) {
      if (s.discard.length <= 1) break;
      const top = s.discard.pop();
      s.pile = mkRng(seed + k).shuffle(s.discard);
      s.discard = [top];
    }
    got.push(s.pile.shift());
  }
  return got;
}

export function reduce(s, pid, a) {
  if (toAct(s)[0] !== pid) fail("Ce n'est pas ton tour");
  const hand = s.hands[pid];
  if (a.type === "draw") {
    if (s.drew) fail("Tu as déjà pioché");
    const got = draw(s, 1, a.seed || 1);
    hand.push(...got);
    s.drew = true;
    s.log = { id: pid, t: "draw", n: got.length };
    return s;
  }
  if (a.type === "pass") {
    if (!s.drew) fail("Pioche d'abord une carte");
    s.drew = false;
    s.cur = nextIdx(s, s.cur);
    s.log = { id: pid, t: "pass" };
    // plus aucune carte à piocher et tout le monde passe : on compte les points
    s.stuck = !s.pile.length && s.discard.length <= 1 ? (s.stuck || 0) + 1 : 0;
    if (s.stuck >= s.order.length * 2) {
      endRound(s, s.order.slice().sort((x, y) => handPts(s, x) - handPts(s, y))[0], (a.seed || 1) ^ 0x5bd1e995);
    }
    return s;
  }
  if (a.type === "play") {
    const i = hand.indexOf(a.card);
    if (i < 0) fail("Carte absente");
    if (!canPlay(s, a.card)) fail("Cette carte ne va pas");
    const r = rankOf(a.card);
    if (r === "8" && !["S", "H", "D", "C"].includes(a.suit)) fail("Choisis une couleur");
    hand.splice(i, 1);
    s.discard.push(a.card);
    s.suit = r === "8" ? a.suit : suitOf(a.card);
    s.drew = false;
    s.stuck = 0;
    s.log = { id: pid, t: "play", card: a.card, suit: s.suit };
    if (!hand.length) { endRound(s, pid, (a.seed || 1) ^ 0x5bd1e995); return s; }
    const n = s.order.length;
    if (!specialsOn(s)) { s.cur = nextIdx(s, s.cur); return s; }
    if (r === "A" && n > 2) s.dir = -s.dir;
    if (r === "2") {
      const victim = s.order[nextIdx(s, s.cur)];
      const got = draw(s, 2, a.seed || 7);
      s.hands[victim].push(...got);
      s.log.victim = victim; s.log.n = got.length;
      s.cur = nextIdx(s, s.cur, 2);
    } else if (r === "J" || (r === "A" && n === 2)) {
      s.log.victim = s.order[nextIdx(s, s.cur)];
      s.cur = nextIdx(s, s.cur, 2);
    } else {
      s.cur = nextIdx(s, s.cur);
    }
    return s;
  }
  fail("Action inconnue");
}

export function result(s) {
  if (!s.winner) return null;
  if (s.target) {
    // course aux points : le total le plus bas gagne
    const rest = s.order.filter((id) => id !== s.winner).map((id) => ({ id, score: s.scores[id] })).sort((a, b) => a.score - b.score);
    const ranking = [{ id: s.winner, rank: 1, score: s.scores[s.winner] }];
    let rank = 1, prev = s.scores[s.winner];
    rest.forEach((e, i) => {
      if (e.score !== prev) { rank = i + 2; prev = e.score; }
      ranking.push({ id: e.id, rank, score: e.score });
    });
    return { ranking };
  }
  const pts0 = s.hands[s.winner].reduce((t, c) => t + points(c), 0);
  const rest = s.order.filter((id) => id !== s.winner)
    .map((id) => ({ id, score: s.hands[id].reduce((t, c) => t + points(c), 0) }))
    .sort((a, b) => a.score - b.score);
  const ranking = [{ id: s.winner, rank: 1, score: pts0 }];
  let rank = 1, prev = null;
  rest.forEach((e, i) => {
    if (e.score !== prev) { rank = i + 2; prev = e.score; }
    ranking.push({ id: e.id, rank, score: e.score });
  });
  return { ranking };
}

export function bot(s, pid, rng) {
  const hand = s.hands[pid];
  const ok = hand.filter((c) => canPlay(s, c));
  if (!ok.length) return s.drew ? { type: "pass" } : { type: "draw" };
  // garder les 8 pour la fin, jouer d'abord les cartes qui gênent les autres
  const score = (c) => {
    const r = rankOf(c);
    if (r === "8") return -10;
    if ((r === "2" || r === "J") && specialsOn(s)) return 5;
    return points(c) / 10 + hand.filter((x) => suitOf(x) === suitOf(c)).length;
  };
  ok.sort((a, b) => score(b) - score(a));
  const card = ok[0];
  if (rankOf(card) === "8") {
    const counts = { S: 0, H: 0, D: 0, C: 0 };
    hand.forEach((c) => { if (c !== card) counts[suitOf(c)]++; });
    const suit = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    return { type: "play", card, suit };
  }
  return { type: "play", card };
}
export const auto = bot;
export { active };
