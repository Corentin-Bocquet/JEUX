import { fail, rankByScore, rng as mkRng } from "../engine.js";
import { deck, rankOf, suitOf, rv } from "./cards.js";

export const meta = {
  id: "pouilleux", name: "Pouilleux", cat: "Cartes", min: 2, max: 6, turnTime: 25,
  color: "#D97706", desc: "Débarrasse-toi de tes paires et refile le Pouilleux.",
  rules: ["On retire la Dame de trèfle du paquet (ou le Valet de trèfle selon la variante) : une carte reste sans partenaire, c'est le Pouilleux.",
    "Toutes les cartes sont distribuées et chacun défausse aussitôt ses paires.",
    "À ton tour, tire une carte face cachée dans la main de ton voisin. Si elle forme une paire avec une de tes cartes, la paire part à la défausse.",
    "Qui n'a plus de carte est tiré d'affaire.",
    "Le dernier à garder une carte en main garde le Pouilleux : il prend un pou et commence la manche suivante.",
    "Après toutes les manches, celui qui a le moins de poux gagne.",
    "Options : Dame ou Valet, paires de même valeur ou de même valeur et même couleur (rouge ou noire), nombre de manches."],
};

export const options = [
  { key: "card", label: "Pouilleux", icon: "🃏", values: [["Q", "Dame", "Une Dame en moins"], ["J", "Valet", "Un Valet en moins"]], def: "Q" },
  { key: "pairs", label: "Paires", icon: "👯", values: [["rank", "Même valeur", "Couleur libre"], ["color", "Même teinte", "Rouge avec rouge"]], def: "rank" },
  { key: "rounds", label: "Manches", icon: "🔁", values: [[1, "1", "Partie éclair"], [3, "3", "Standard"], [5, "5", "Longue"]], def: 3 },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "🃏", desc: "La Dame en moins, paires de même valeur, 3 manches.", set: { card: "Q", pairs: "rank", rounds: 3 } },
  { id: "valet", name: "Valet de pique", emoji: "🤡", desc: "Version à l'ancienne : le Valet de pique est le Pouilleux, paires de même teinte.", set: { card: "J", pairs: "color", rounds: 3 } },
  { id: "eclair", name: "Éclair", emoji: "⚡", desc: "Une seule manche : un seul perdant.", set: { card: "Q", pairs: "rank", rounds: 1 } },
  { id: "marathon", name: "Marathon", emoji: "🏃", desc: "5 manches, paires de même teinte : plus de cartes en main.", set: { card: "Q", pairs: "color", rounds: 5 } },
];

export function opt(settings, key) {
  const o = options.find((x) => x.key === key);
  const v = settings ? settings[key] : undefined;
  const hit = o.values.find((x) => String(x[0]) === String(v));
  return hit ? hit[0] : o.def;
}

const black = (c) => suitOf(c) === "S" || suitOf(c) === "C";
// clé d'appariement : valeur, et teinte (rouge ou noire) si l'option le demande
export const pairKey = (s, c) => rankOf(c) + (s.pairs === "color" ? (black(c) ? "n" : "r") : "");
export const sortHand = (hand) => hand.slice().sort((a, b) => rv(a) - rv(b) || "SCHD".indexOf(suitOf(a)) - "SCHD".indexOf(suitOf(b)));

function stripPairs(s, hand) {
  const by = {};
  for (const c of hand) (by[pairKey(s, c)] = by[pairKey(s, c)] || []).push(c);
  const keep = [], pairs = [];
  for (const list of Object.values(by)) {
    for (let i = 0; i + 1 < list.length; i += 2) pairs.push([list[i], list[i + 1]]);
    if (list.length % 2) keep.push(list[list.length - 1]);
  }
  return { keep, pairs };
}

export function setup(players, settings, rng) {
  const order = rng.shuffle(players.map((p) => p.id));
  const s = {
    order, card: opt(settings, "card"), pairs: opt(settings, "pairs"), rounds: opt(settings, "rounds"),
    manche: 1, poux: Object.fromEntries(order.map((id) => [id, 0])), first: 0,
    hands: {}, found: {}, out: [], cur: 0, log: null, lastManche: null, over: false,
  };
  deal(s, rng);
  return s;
}

function deal(s, rng) {
  const removed = s.card + "C";
  const cards = rng.shuffle(deck().filter((c) => c !== removed));
  const n = s.order.length;
  s.hands = {}; s.found = {}; s.out = [];
  let dealt = 0;
  s.order.forEach((id) => (s.hands[id] = []));
  for (const c of cards) s.hands[s.order[(s.first + dealt++) % n]].push(c);
  for (const id of s.order) {
    const { keep, pairs } = stripPairs(s, s.hands[id]);
    s.hands[id] = rng.shuffle(keep);
    s.found[id] = pairs.length;
  }
  s.cur = s.first;
  s.removed = removed;
  s.log = { t: "deal", manche: s.manche };
  // cas rare : quelqu'un n'a déjà plus de carte
  for (const id of s.order) if (!s.hands[id].length) s.out.push(id);
  if (!s.hands[s.order[s.cur]].length) s.cur = nextWith(s, s.cur);
}

const withCards = (s) => s.order.filter((id) => s.hands[id].length > 0);
function nextWith(s, from) {
  let i = from;
  for (let k = 0; k < s.order.length; k++) { i = (i + 1) % s.order.length; if (s.hands[s.order[i]].length) return i; }
  return from;
}
// la personne chez qui le joueur courant tire
export const target = (s, idx = s.cur) => s.order[nextWith(s, idx)];

export function toAct(s) { return s.over ? [] : [s.order[s.cur]]; }

export function reduce(s, pid, a) {
  if (s.over) fail("La partie est terminée");
  if (toAct(s)[0] !== pid) fail("Ce n'est pas ton tour");
  if (a.type !== "draw") fail("Action inconnue");
  const from = target(s);
  const vh = s.hands[from];
  const idx = a.idx;
  if (!Number.isInteger(idx) || idx < 0 || idx >= vh.length) fail("Choisis une carte chez ton voisin");
  const card = vh.splice(idx, 1)[0];
  const hand = s.hands[pid];
  const k = hand.findIndex((c) => pairKey(s, c) === pairKey(s, card));
  const r = mkRng(a.seed || 1);
  s.log = { t: "draw", id: pid, from, idx, card, pair: k >= 0 ? hand[k] : null, n: vh.length + 1 };
  if (k >= 0) { hand.splice(k, 1); s.found[pid]++; }
  else hand.push(card);
  // on mélange les deux mains : personne ne peut suivre une carte à la trace
  s.hands[pid] = r.shuffle(hand);
  s.hands[from] = r.shuffle(vh);
  for (const id of [from, pid]) if (!s.hands[id].length && !s.out.includes(id)) { s.out.push(id); }
  if (withCards(s).length <= 1) { endManche(s, r.int(2 ** 31)); return s; }
  s.cur = nextWith(s, s.order.indexOf(pid));
  return s;
}

function endManche(s, seed) {
  const loser = withCards(s)[0];
  s.poux[loser]++;
  s.lastManche = { manche: s.manche, loser, card: s.hands[loser][0] };
  if (s.manche >= s.rounds) { s.over = true; return; }
  s.manche++;
  s.first = s.order.indexOf(loser);
  deal(s, mkRng(seed));
}

export function result(s) {
  if (!s.over) return null;
  return { ranking: rankByScore(s.order.map((id) => ({ id, score: s.poux[id] })), true) };
}

export function bot(s, pid, r) {
  if (s.over || toAct(s)[0] !== pid) return null;
  const n = s.hands[target(s)].length;
  return { type: "draw", idx: r.int(n) };
}
export const auto = bot;
export function botDelay(s, pid, r) { return 800 + r.int(900); }
