import { fail, rankByScore, rng as mkRng } from "../engine.js";
import { deck, rankOf } from "./cards.js";

export const meta = {
  id: "blackjack", name: "Blackjack", cat: "Cartes", min: 1, max: 5, turnTime: 30,
  color: "#1F8F55", desc: "Approche 21 sans le dépasser et bats la banque.",
  rules: ["Chaque manche, mise des jetons puis reçois 2 cartes.",
    "Tire une carte, reste, ou double ta mise contre une seule carte.",
    "Les figures valent 10, l'As 1 ou 11. Au-delà de 21, tu perds.",
    "La banque tire jusqu'à 17. Un blackjack (As + 10) paie 3 pour 2.",
    "Après la dernière manche, le plus gros tas de jetons gagne."],
};

export const MIN = 10, MAX = 500;

export function value(cards) {
  let t = 0, aces = 0;
  for (const c of cards) {
    const r = rankOf(c);
    if (r === "A") { aces++; t += 11; } else if (["K", "Q", "J", "10"].includes(r)) t += 10; else t += +r;
  }
  while (t > 21 && aces) { t -= 10; aces--; }
  return { total: t, soft: aces > 0 };
}
export const isBJ = (cards) => cards.length === 2 && value(cards).total === 21;

export function setup(players, settings) {
  const chips = {};
  players.forEach((p) => (chips[p.id] = 1000));
  return { order: players.map((p) => p.id), chips, manche: 1, manches: settings.rounds || 8, phase: "bet",
    bets: {}, hands: {}, done: {}, dealer: [], cur: -1, shoe: [], last: null };
}

const inRound = (s) => s.order.filter((id) => s.bets[id] > 0);
const canBet = (s, id) => s.chips[id] >= MIN;

export function toAct(s) {
  if (s.phase === "bet") return s.order.filter((id) => canBet(s, id) && s.bets[id] == null);
  if (s.phase === "play") return s.cur >= 0 ? [s.order[s.cur]] : [];
  return [];
}

function nextPlayer(s) {
  for (let i = s.cur + 1; i < s.order.length; i++) {
    const id = s.order[i];
    if (s.bets[id] > 0 && !s.done[id]) { s.cur = i; return; }
  }
  s.cur = -1;
  finishRound(s);
}

function deal(s, seed) {
  s.shoe = mkRng(seed).shuffle(deck(6));
  s.hands = {}; s.done = {}; s.dealer = [];
  const ids = inRound(s);
  for (const id of ids) s.hands[id] = [s.shoe.pop()];
  s.dealer.push(s.shoe.pop());
  for (const id of ids) s.hands[id].push(s.shoe.pop());
  s.dealer.push(s.shoe.pop());
  for (const id of ids) if (isBJ(s.hands[id])) s.done[id] = true;
  s.phase = "play";
  if (isBJ(s.dealer)) { s.cur = -1; finishRound(s); return; }
  s.cur = -1;
  nextPlayer(s);
}

function finishRound(s) {
  const ids = inRound(s);
  const anyAlive = ids.some((id) => value(s.hands[id]).total <= 21 && !isBJ(s.hands[id]));
  if (anyAlive && !isBJ(s.dealer)) {
    while (value(s.dealer).total < 17) s.dealer.push(s.shoe.pop());
  }
  const d = value(s.dealer).total, dBJ = isBJ(s.dealer);
  const res = {};
  for (const id of ids) {
    const bet = s.bets[id], h = s.hands[id], v = value(h).total, bj = isBJ(h) && !s.doubled?.[id];
    let delta;
    if (v > 21) delta = -bet;
    else if (dBJ) delta = bj ? 0 : -bet;
    else if (bj) delta = Math.floor(bet * 1.5);
    else if (d > 21 || v > d) delta = bet;
    else if (v === d) delta = 0;
    else delta = -bet;
    s.chips[id] += delta;
    res[id] = { delta, total: v, bj };
  }
  s.last = { dealer: s.dealer.slice(), dealerTotal: d, res, hands: JSON.parse(JSON.stringify(s.hands)), bets: { ...s.bets } };
  s.manche++;
  s.bets = {}; s.doubled = {};
  s.phase = s.manche > s.manches || !s.order.some((id) => canBet(s, id)) ? "over" : "bet";
}

export function reduce(s, pid, a) {
  if (!toAct(s).includes(pid)) fail("Ce n'est pas à toi de jouer");
  if (s.phase === "bet") {
    if (a.type !== "bet") fail("Place ta mise");
    const amt = a.amount | 0;
    if (amt < MIN || amt > Math.min(MAX, s.chips[pid]) || amt % 10) fail("Mise invalide");
    s.bets[pid] = amt;
    // les joueurs sans jetons ne misent plus
    for (const id of s.order) if (!canBet(s, id)) s.bets[id] = 0;
    if (toAct(s).length === 0) deal(s, a.seed || 1);
    return s;
  }
  const h = s.hands[pid];
  if (a.type === "hit") {
    h.push(s.shoe.pop());
    if (value(h).total >= 21) { s.done[pid] = true; nextPlayer(s); }
    return s;
  }
  if (a.type === "stand") { s.done[pid] = true; nextPlayer(s); return s; }
  if (a.type === "double") {
    if (h.length !== 2) fail("On double seulement sur 2 cartes");
    if (s.chips[pid] < s.bets[pid] * 2) fail("Pas assez de jetons pour doubler");
    s.bets[pid] *= 2;
    s.doubled = s.doubled || {};
    s.doubled[pid] = true;
    h.push(s.shoe.pop());
    s.done[pid] = true;
    nextPlayer(s);
    return s;
  }
  fail("Action inconnue");
}

export function result(s) {
  if (s.phase !== "over") return null;
  return { ranking: rankByScore(s.order.map((id) => ({ id, score: s.chips[id] }))) };
}

export function bot(s, pid) {
  if (s.phase === "bet") {
    const amt = Math.max(MIN, Math.min(MAX, Math.floor(s.chips[pid] / 100) * 10));
    return { type: "bet", amount: Math.min(amt, Math.floor(s.chips[pid] / 10) * 10) };
  }
  const h = s.hands[pid], { total, soft } = value(h);
  const up = value([s.dealer[0]]).total;
  if (h.length === 2 && (total === 11 || (total === 10 && up < 10)) && !soft && s.chips[pid] >= s.bets[pid] * 2) return { type: "double" };
  if (soft) return { type: total <= 17 ? "hit" : "stand" };
  if (total <= 11) return { type: "hit" };
  if (total <= 16) return { type: up >= 7 ? "hit" : "stand" };
  return { type: "stand" };
}
export function auto(s, pid) {
  if (s.phase === "bet") return { type: "bet", amount: MIN };
  return { type: "stand" };
}
