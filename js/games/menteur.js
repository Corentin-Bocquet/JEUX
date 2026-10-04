import { fail, rankByScore } from "../engine.js";
import { deck, rankOf, rv, RANK_FR } from "./cards.js";

export const meta = {
  id: "menteur", name: "Menteur", cat: "Cartes", min: 2, max: 6, turnTime: 30,
  color: "#EA580C", desc: "Pose tes cartes face cachée, bluffe et démasque les menteurs.",
  rules: ["Toutes les cartes sont distribuées. Le premier joueur doit annoncer des As, le suivant des 2, puis des 3... jusqu'au Roi, et on recommence.",
    "À ton tour, pose de 1 à 4 cartes face cachée sur le tas en annonçant la valeur attendue. Tu peux mentir !",
    "Après chaque pose, tout le monde a quelques secondes pour crier « Menteur ! ».",
    "Si au moins une des cartes posées n'est pas de la valeur annoncée, le menteur ramasse tout le tas. Sinon, c'est celui qui a accusé à tort qui le ramasse.",
    "Le jeu reprend avec le joueur suivant le poseur.",
    "Qui réunit les quatre cartes d'une même valeur les défausse aussitôt, face visible : plus personne ne peut en avoir.",
    "À deux joueurs, un tiers du paquet est écarté face cachée au début : impossible de tout savoir.",
    "Le premier qui n'a plus de carte (sans être démasqué sur sa dernière pose) gagne. Les autres sont classés selon les cartes qui leur restent.",
    "Options : paquet de 52 ou 32 cartes (du 7 à l'As), durée de la fenêtre pour accuser, annonce imposée ou au choix (même valeur, juste au-dessus ou juste en dessous)."],
};

export const options = [
  { key: "deck", label: "Paquet", icon: "🂠", values: [[52, "52 cartes", "As au Roi"], [32, "32 cartes", "Du 7 à l'As"]], def: 52 },
  { key: "window", label: "Pour accuser", icon: "⏳", values: [[5, "5 s", "Réflexes"], [8, "8 s", "Standard"], [12, "12 s", "Tranquille"]], def: 8 },
  { key: "claim", label: "Annonce", icon: "📣", values: [["up", "Imposée", "Valeur suivante"], ["near", "Au choix", "Même, +1 ou -1"]], def: "up" },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "🤥", desc: "52 cartes, de l'As au Roi dans l'ordre, 8 secondes pour accuser.", set: { deck: 52, window: 8, claim: "up" } },
  { id: "rapide", name: "Express", emoji: "⚡", desc: "32 cartes et 5 secondes pour réagir : ça va vite.", set: { deck: 32, window: 5, claim: "up" } },
  { id: "libre", name: "Annonce libre", emoji: "🎭", desc: "Tu annonces la même valeur, celle du dessus ou celle du dessous.", set: { deck: 52, window: 8, claim: "near" } },
  { id: "salon", name: "Salon", emoji: "🛋️", desc: "32 cartes, annonce au choix et 12 secondes pour réfléchir.", set: { deck: 32, window: 12, claim: "near" } },
];

export function opt(settings, key) {
  const o = options.find((x) => x.key === key);
  const v = settings ? settings[key] : undefined;
  const hit = o.values.find((x) => String(x[0]) === String(v));
  return hit ? hit[0] : o.def;
}

const V52 = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const V32 = ["7", "8", "9", "10", "J", "Q", "K", "A"];
export const values = (s) => (s.deck === 32 ? V32 : V52);
const NAMES = { A: "As", J: "Valet", Q: "Dame", K: "Roi" };
export const valName = (v, n = 1) => (NAMES[v] ? NAMES[v] + (n > 1 ? "s" : "") : v);
export const short = (v) => RANK_FR[v] || v;
export const sortHand = (hand) => hand.slice().sort((a, b) => rv(a) - rv(b) || "SHDC".indexOf(a.slice(-1)) - "SHDC".indexOf(b.slice(-1)));

export function setup(players, settings, rng) {
  const order = rng.shuffle(players.map((p) => p.id));
  const s = {
    order, deck: opt(settings, "deck"), window: opt(settings, "window"), claim: opt(settings, "claim"),
    level: [1, 2, 3].includes(settings.level) ? settings.level : 2,
    hands: {}, cur: 0, last: -1, phase: "play", pile: [], call: null, reveal: null, known: {}, winner: null, log: null,
  };
  const vals = values(s);
  const cards = rng.shuffle(deck().filter((c) => vals.includes(rankOf(c))));
  order.forEach((id) => { s.hands[id] = []; s.known[id] = []; });
  // à deux, un tiers du paquet est écarté face cachée : sinon chacun saurait tout
  const aside = order.length === 2 ? Math.floor(cards.length / 3) : 0;
  s.aside = aside;
  cards.slice(aside).forEach((c, i) => s.hands[order[i % order.length]].push(c));
  s.gone = [];
  for (const id of order) { s.hands[id] = sortHand(s.hands[id]); quads(s, id); }
  // cas rarissime : une main vidée par ses carrés dès la donne
  const empty = order.find((id) => !s.hands[id].length);
  if (empty) { s.winner = empty; s.phase = "over"; }
  return s;
}

// quatre cartes de même valeur en main : elles sont défaussées, face visible
function quads(s, id) {
  const by = {};
  for (const c of s.hands[id]) by[rankOf(c)] = (by[rankOf(c)] || 0) + 1;
  const full = Object.keys(by).filter((v) => by[v] === 4);
  if (!full.length) return [];
  s.hands[id] = s.hands[id].filter((c) => !full.includes(rankOf(c)));
  s.gone.push(...full);
  for (const k of s.order) s.known[k] = s.known[k].filter((c) => !full.includes(rankOf(c)));
  return full;
}

// valeurs qu'on a le droit d'annoncer maintenant
export function allowed(s) {
  const vals = values(s), L = vals.length;
  if (s.claim === "near") {
    if (s.last < 0) return vals.slice();
    return [...new Set([s.last - 1, s.last, s.last + 1].map((i) => vals[(i + L) % L]))];
  }
  return [vals[(s.last + 1) % L]];
}

export function toAct(s) {
  if (s.winner) return [];
  if (s.phase === "doubt") return s.call.pending.slice();
  return [s.order[s.cur]];
}

const idxAfter = (s, id) => (s.order.indexOf(id) + 1) % s.order.length;

export function reduce(s, pid, a) {
  if (s.winner) fail("La partie est terminée");
  if (s.phase === "play") {
    if (s.order[s.cur] !== pid) fail("Ce n'est pas ton tour");
    if (a.type !== "play") fail("Pose des cartes");
    const cards = a.cards || [];
    if (!cards.length || cards.length > 4) fail("Pose de 1 à 4 cartes");
    if (new Set(cards).size !== cards.length || !cards.every((c) => s.hands[pid].includes(c))) fail("Carte absente");
    const ok = allowed(s);
    const v = a.val == null ? ok[0] : a.val;
    if (!ok.includes(v)) fail("Tu ne peux pas annoncer cette valeur");
    s.hands[pid] = s.hands[pid].filter((c) => !cards.includes(c));
    s.pile.push({ id: pid, cards, v });
    s.last = values(s).indexOf(v);
    s.phase = "doubt";
    s.call = { id: pid, n: cards.length, v, until: (a.now || 0) + s.window * 1000, pending: s.order.filter((x) => x !== pid), passed: [] };
    s.reveal = null;
    s.log = { t: "play", id: pid, n: cards.length, v };
    return s;
  }
  // fenêtre « Menteur ! »
  const c = s.call;
  if (!c.pending.includes(pid)) fail("Tu as déjà répondu");
  if (a.type === "pass") {
    c.pending = c.pending.filter((x) => x !== pid);
    c.passed.push(pid);
    if (!c.pending.length) {
      if (!s.hands[c.id].length) { s.winner = c.id; s.phase = "over"; s.log = { t: "win", id: c.id }; return s; }
      s.phase = "play"; s.cur = idxAfter(s, c.id); s.call = null;
      s.log = { t: "trust", id: c.id, n: c.n, v: c.v };
    }
    return s;
  }
  if (a.type !== "call") fail("Action inconnue");
  const lastPlay = s.pile[s.pile.length - 1];
  const lied = lastPlay.cards.some((x) => rankOf(x) !== c.v);
  const taker = lied ? c.id : pid;
  const all = s.pile.flatMap((p) => p.cards);
  s.hands[taker] = sortHand([...s.hands[taker], ...all]);
  // les cartes retournées sont vues de tous : on sait qu'elles sont chez le ramasseur
  for (const id of s.order) s.known[id] = s.known[id].filter((x) => !lastPlay.cards.includes(x));
  s.known[taker] = [...s.known[taker], ...lastPlay.cards].slice(-16);
  s.reveal = { id: c.id, caller: pid, cards: lastPlay.cards, v: c.v, lied, taker, n: all.length, quads: quads(s, taker) };
  s.pile = [];
  s.call = null;
  s.log = { t: "call", id: pid };
  if (!lied && !s.hands[c.id].length) { s.winner = c.id; s.phase = "over"; return s; }
  if (!s.hands[taker].length) { s.winner = taker; s.phase = "over"; return s; }
  s.phase = "play";
  s.cur = idxAfter(s, c.id);
  if (s.claim === "near") s.last = -1;
  return s;
}

export function result(s) {
  if (!s.winner) return null;
  const rest = rankByScore(s.order.filter((id) => id !== s.winner).map((id) => ({ id, score: s.hands[id].length })), true);
  return { ranking: [{ id: s.winner, rank: 1, score: 0 }, ...rest.map((e) => ({ ...e, rank: e.rank + 1 }))] };
}

// ------------------------------------------------ robots
// probabilité qu'un robot crie « Menteur ! » sur la dernière pose
export function suspicion(s, pid) {
  const c = s.call;
  const lvl = s.level || 2;
  const v = c.v;
  const mine = s.hands[pid].filter((x) => rankOf(x) === v).length;
  // ce que j'ai moi-même posé dans le tas, je le sais
  const mineInPile = s.pile.slice(0, -1).filter((p) => p.id === pid).flatMap((p) => p.cards).filter((x) => rankOf(x) === v).length;
  // cartes retournées en public chez d'autres joueurs que le poseur
  const seen = s.order.filter((id) => id !== pid && id !== c.id).flatMap((id) => s.known[id]).filter((x) => rankOf(x) === v).length;
  const free = s.gone.includes(v) ? 0 : 4 - mine - mineInPile;
  if (c.n > free) return lvl === 1 ? 0.7 : 1; // impossible : mensonge certain
  const free2 = free - seen;
  let p;
  if (c.n > free2) p = lvl === 3 ? 0.85 : 0.6;
  else {
    const ratio = c.n / Math.max(1, free2);
    p = 0.05 + 0.2 * ratio * ratio;
    if (c.n >= 3) p += 0.06;
  }
  const left = s.hands[c.id].length;
  if (left === 0) p = Math.max(p, lvl === 1 ? 0.4 : 0.7);
  else if (left <= 2) p += 0.1;
  // un gros tas fait réfléchir avant d'accuser
  p -= Math.min(0.2, s.pile.length * 0.015);
  // plus il y a de monde, moins chacun a besoin d'accuser
  p /= Math.sqrt(Math.max(1, c.pending.length));
  if (lvl === 1) p = p * 0.7 + 0.05;
  return Math.max(0.02, Math.min(0.95, p));
}

export function bot(s, pid, r) {
  if (s.winner) return null;
  if (s.phase === "doubt") {
    if (!s.call.pending.includes(pid)) return null;
    return r.next() < suspicion(s, pid) ? { type: "call" } : { type: "pass" };
  }
  if (s.order[s.cur] !== pid) return null;
  const lvl = s.level || 2;
  const hand = s.hands[pid];
  const vals = values(s);
  const ok = allowed(s);
  const count = (v) => hand.filter((c) => rankOf(c) === v).length;
  // valeur annoncée : celle dont on a le plus (annonce au choix)
  let v = ok[0];
  if (ok.length > 1) {
    const best = ok.slice().sort((a, b) => count(b) - count(a));
    v = count(best[0]) > 0 ? best[0] : r.pick(ok);
  }
  const truth = hand.filter((c) => rankOf(c) === v);
  // valeur qui reviendra le plus tard : la carte qu'on peut sacrifier pour bluffer
  const L = vals.length, at = vals.indexOf(v);
  const dist = (c) => (vals.indexOf(rankOf(c)) - at + L) % L;
  const junk = hand.filter((c) => rankOf(c) !== v).sort((a, b) => dist(b) - dist(a) || count(rankOf(a)) - count(rankOf(b)));
  if (truth.length) {
    const cards = truth.slice(0, 4);
    // de temps en temps, glisser une carte de trop
    if (lvl >= 2 && cards.length < 3 && junk.length > 2 && hand.length > 5 && r.next() < (lvl === 3 ? 0.22 : 0.12)) cards.push(junk[0]);
    return { type: "play", cards, val: v };
  }
  // aucune carte de la bonne valeur : bluff
  let k = 1;
  if (lvl >= 2 && junk.length >= 6 && r.next() < 0.3) k = 2;
  if (lvl === 1 && r.next() < 0.3) k = Math.min(junk.length, 1 + r.int(3));
  return { type: "play", cards: junk.slice(0, Math.max(1, k)), val: v };
}
// temps écoulé : ne rien dire vaut « je laisse passer »
export function auto(s, pid, r) { return s.phase === "doubt" ? { type: "pass" } : bot(s, pid, r); }
export function botDelay(s, pid, r) {
  if (s.phase === "doubt") return 1000 + r.int(Math.max(500, s.window * 1000 - 3000));
  return 900 + r.int(1100);
}
