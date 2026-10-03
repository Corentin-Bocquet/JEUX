import { fail, rng as mkRng } from "../engine.js";
import { deck, rankOf, suitOf } from "./cards.js";

export const meta = {
  id: "huit", name: "Huit américain", cat: "Cartes", min: 2, max: 6, turnTime: 35,
  color: "#FF9600", desc: "Débarrasse-toi de tes cartes le premier.",
  rules: ["Pose une carte de la même couleur ou de la même valeur que celle du dessus.",
    "Le 8 se pose sur tout et change la couleur.",
    "Le 2 fait piocher 2 cartes au suivant, le Valet le fait passer son tour, l'As inverse le sens.",
    "Si tu ne peux pas jouer, pioche une carte : tu peux la poser si elle va, sinon tu passes.",
    "Le premier sans carte gagne, les autres sont classés selon les points qui leur restent."],
};

export const points = (c) => {
  const r = rankOf(c);
  if (r === "8") return 50;
  if (["J", "Q", "K"].includes(r)) return 10;
  if (r === "A") return 1;
  return +r;
};

export function setup(players, settings, rng) {
  const order = rng.shuffle(players.map((p) => p.id));
  let pile = rng.shuffle(deck());
  const hands = {};
  const n = order.length === 2 ? 7 : 5;
  for (const id of order) hands[id] = pile.splice(0, n);
  // la première carte retournée n'est pas spéciale
  let i = pile.findIndex((c) => !["8", "2", "J", "A"].includes(rankOf(c)));
  const top = pile.splice(i, 1)[0];
  return { order, hands, pile, discard: [top], suit: suitOf(top), cur: 0, dir: 1, drew: false,
    finished: [], log: null, winner: null };
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
      const pts = (id) => s.hands[id].reduce((t, c) => t + points(c), 0);
      s.winner = s.order.slice().sort((x, y) => pts(x) - pts(y))[0];
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
    if (!hand.length) { s.winner = pid; return s; }
    const n = s.order.length;
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
    if (r === "2" || r === "J") return 5;
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
