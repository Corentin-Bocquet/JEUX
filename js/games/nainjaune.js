// Nain jaune : plateau à 5 cases garnies de jetons, cartes posées en suites montantes (As au Roi).
// Cartes du paquet de 52 (js/games/cards.js) : "10D", "JC", "QS", "KH", "7D"...
import { fail, rankByScore, rng as mkRng } from "../engine.js";
import { deck, rankOf } from "./cards.js";

export const meta = {
  id: "nainjaune", name: "Nain jaune", cat: "Cartes", min: 3, max: 8, turnTime: 25,
  color: "#CA8A04", desc: "Pose tes suites, rafle les cases du plateau et vide ta main le premier.",
  rules: ["Au début de chaque manche, chacun mise 15 jetons sur le plateau : 1 sur le 10 de carreau, 2 sur le valet de trèfle, 3 sur la dame de pique, 4 sur le roi de cœur et 5 sur le 7 de carreau, le nain jaune.",
    "Le premier joueur pose la carte de son choix, puis continue en suite montante (5, 6, 7...) sans tenir compte de la couleur, tant qu'il a la carte suivante.",
    "Quand il ne l'a pas, c'est le prochain joueur qui possède la carte suivante qui reprend la suite. Si personne ne l'a, celui qui a posé la dernière carte repart avec la carte de son choix.",
    "Après un roi, la suite s'arrête et celui qui l'a posé repart avec la carte de son choix.",
    "Poser une des cinq cartes du plateau rapporte tous les jetons de sa case. Les cases non ramassées restent pour la manche suivante.",
    "Le premier qui n'a plus de cartes gagne la manche : chaque adversaire lui donne un jeton par carte restante en main.",
    "Option belles gardées : celui qui finit avec une carte du plateau en main paie sa valeur (1 à 5) dans la case.",
    "Option grand opéra : vider toute sa main d'une seule traite dès le début de la manche, ou recevoir les cinq cartes du plateau, rafle tout le plateau.",
    "Après le nombre de manches prévu (ou quand quelqu'un ne peut plus miser), le plus riche en jetons gagne."],
};

// ------------------------------------------------ réglages
export const options = [
  { key: "manches", label: "Manches", icon: "🔁", values: [[3, "3", "Rapide"], [5, "5", "Standard"], [8, "8", "Longue soirée"]], def: 5 },
  { key: "chips", label: "Jetons", icon: "🪙", values: [[50, "50", "Mises serrées"], [100, "100", "Standard"], [200, "200", "Grosse cagnotte"]], def: 100 },
  { key: "opera", label: "Grand opéra", icon: "🎭", values: [[true, "Oui", "Rafle tout"], [false, "Non", "Règle simple"]], def: true },
  { key: "penalty", label: "Belles gardées", icon: "💸", values: [[true, "Payantes", "On paie la case"], [false, "Gratuites", "Sans pénalité"]], def: true },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "🟡", desc: "5 manches, 100 jetons, grand opéra et belles gardées payantes.",
    set: { manches: 5, chips: 100, opera: true, penalty: true } },
  { id: "rapide", name: "Rapide", emoji: "⚡", desc: "3 manches avec 50 jetons : chaque case compte.",
    set: { manches: 3, chips: 50, opera: true, penalty: true } },
  { id: "soiree", name: "Longue soirée", emoji: "🌙", desc: "8 manches et 200 jetons pour voir les cases grossir.",
    set: { manches: 8, chips: 200, opera: true, penalty: true } },
  { id: "simple", name: "Découverte", emoji: "🌱", desc: "Ni grand opéra ni pénalité : idéal pour apprendre.",
    set: { manches: 5, chips: 100, opera: false, penalty: false } },
];
export function opt(settings, key) {
  const o = options.find((x) => x.key === key);
  const v = settings ? settings[key] : undefined;
  const hit = o.values.find((x) => String(x[0]) === String(v));
  return hit ? hit[0] : o.def;
}

// ------------------------------------------------ cartes et plateau
// les cinq cases, dans l'ordre des mises (1 à 5 jetons)
export const BOXES = [
  { card: "10D", name: "Dix de carreau", stake: 1 },
  { card: "JC", name: "Valet de trèfle", stake: 2 },
  { card: "QS", name: "Dame de pique", stake: 3 },
  { card: "KH", name: "Roi de cœur", stake: 4 },
  { card: "7D", name: "Nain jaune", stake: 5 },
];
export const STAKE = 15;
const RV = { A: 1, J: 11, Q: 12, K: 13 };
export const rankNum = (c) => RV[rankOf(c)] || +rankOf(c);
export const RANK_WORD = ["", "as", "2", "3", "4", "5", "6", "7", "8", "9", "10", "valet", "dame", "roi"];
export const boxOf = (c) => BOXES.findIndex((b) => b.card === c);
// cartes en main selon le nombre de joueurs (le reste forme le talon, qui ne sert pas)
export const HAND = { 3: 15, 4: 12, 5: 9, 6: 8, 7: 7, 8: 6 };

function stakeAll(s) {
  for (const id of s.order) {
    s.chips[id] -= STAKE;
    BOXES.forEach((b, i) => { s.board[i] += b.stake; });
  }
}

function dealRound(s, rng) {
  const pile = rng.shuffle(deck());
  const n = HAND[s.order.length] || 6;
  const hands = {};
  for (let k = 0; k < s.order.length; k++) hands[s.order[(s.first + k) % s.order.length]] = sortHand(pile.splice(0, n));
  Object.assign(s, { hands, talon: pile.length, need: 0, cur: s.first, run: [], last: null, untouched: s.order[s.first], log: null });
  stakeAll(s);
  // grand opéra à la donne : les cinq cartes du plateau dans une seule main
  if (s.opera) {
    const lucky = s.order.find((id) => BOXES.every((b) => hands[id].includes(b.card)));
    if (lucky) {
      const won = s.board.reduce((a, b) => a + b, 0);
      s.chips[lucky] += won; s.board = [0, 0, 0, 0, 0];
      s.log = { id: lucky, t: "opera", won };
    }
  }
}

export const sortHand = (h) => h.slice().sort((a, b) => rankNum(a) - rankNum(b) || a.localeCompare(b));

export function setup(players, settings, rng) {
  const order = rng.shuffle(players.map((p) => p.id));
  const lv = +(settings && settings.level);
  const chips0 = opt(settings, "chips");
  const s = { order, chips: Object.fromEntries(order.map((id) => [id, chips0])), board: [0, 0, 0, 0, 0],
    manches: opt(settings, "manches"), opera: opt(settings, "opera"), penalty: opt(settings, "penalty"),
    level: [1, 2, 3].includes(lv) ? lv : 2, manche: 1, first: 0, hands: {}, talon: 0, need: 0, cur: 0,
    run: [], last: null, untouched: null, log: null, lastRound: null, over: false };
  dealRound(s, rng);
  return s;
}

export function toAct(s) { return s.over ? [] : [s.order[s.cur]]; }

export function canPlay(s, c) { return !s.need || rankNum(c) === s.need; }
const holds = (s, id, rank) => s.hands[id].some((c) => rankNum(c) === rank);

function endRound(s, w, rng) {
  const delta = Object.fromEntries(s.order.map((id) => [id, 0]));
  const paidBoxes = [0, 0, 0, 0, 0];
  for (const id of s.order) {
    if (id === w) continue;
    // un jeton par carte restante
    const pay = Math.min(s.chips[id], s.hands[id].length);
    s.chips[id] -= pay; s.chips[w] += pay; delta[id] -= pay; delta[w] += pay;
    // belles gardées : on paie la valeur de la case
    if (s.penalty) for (const c of s.hands[id]) {
      const b = boxOf(c);
      if (b < 0) continue;
      const p = Math.min(s.chips[id], BOXES[b].stake);
      s.chips[id] -= p; s.board[b] += p; delta[id] -= p; paidBoxes[b] += p;
    }
  }
  let opera = 0;
  if (s.opera && s.untouched === w) {
    opera = s.board.reduce((a, b) => a + b, 0);
    s.chips[w] += opera; delta[w] += opera; s.board = [0, 0, 0, 0, 0];
  }
  s.lastRound = { manche: s.manche, winner: w, delta, opera, paidBoxes };
  if (s.manche >= s.manches || s.order.some((id) => s.chips[id] < STAKE)) { s.over = true; return; }
  s.manche++;
  s.first = (s.first + 1) % s.order.length;
  dealRound(s, rng);
}

export function reduce(s, pid, a) {
  if (toAct(s)[0] !== pid) fail("Ce n'est pas ton tour");
  if (a.type !== "play") fail("Action inconnue");
  const hand = s.hands[pid];
  const i = hand.indexOf(a.card);
  if (i < 0) fail("Carte absente");
  if (!canPlay(s, a.card)) fail(`Il faut poser un ${RANK_WORD[s.need]}`);
  hand.splice(i, 1);
  const r = rankNum(a.card);
  if (!s.need) s.run = [];
  s.run.push(a.card);
  s.last = pid;
  const log = { id: pid, t: "play", card: a.card };
  const b = boxOf(a.card);
  if (b >= 0) { log.won = s.board[b]; log.box = b; s.chips[pid] += s.board[b]; s.board[b] = 0; }
  s.log = log;
  if (!hand.length) {
    log.out = true;
    // le hasard de la donne suivante vient de la graine de l'action
    endRound(s, pid, mkRng((a.seed || 1) ^ 0x2545f491));
    return s;
  }
  const me = s.cur;
  if (r === 13) { s.need = 0; return s; } // après un roi, on repart
  s.need = r + 1;
  if (holds(s, pid, s.need)) return s;
  const n = s.order.length;
  for (let k = 1; k < n; k++) {
    const j = (me + k) % n;
    if (holds(s, s.order[j], s.need)) {
      s.cur = j; s.untouched = null;
      log.sans = k - 1; // nombre de joueurs qui ont dit « sans »
      return s;
    }
  }
  // personne n'a la suite : le dernier poseur repart
  log.stop = s.need;
  s.need = 0;
  return s;
}

export function result(s) {
  if (!s.over) return null;
  return { ranking: rankByScore(s.order.map((id) => ({ id, score: s.chips[id] }))) };
}

// ------------------------------------------------ robots
// longueur de suite qu'on peut enchaîner à partir d'une carte, et ce qu'elle rapporte
function chain(hand, r0, board, wBelle) {
  let k = 0, gain = 0, r = r0;
  while (r <= 13) {
    const cs = hand.filter((c) => rankNum(c) === r);
    if (!cs.length) break;
    k++;
    for (const c of cs) { const b = boxOf(c); if (b >= 0) gain += board[b] * wBelle; }
    r++;
  }
  return { k, gain, king: r > 13 };
}

export function bot(s, pid, rng) {
  const hand = s.hands[pid];
  const ok = hand.filter((c) => canPlay(s, c));
  if (!ok.length) return null;
  const lv = s.level || 2;
  if (lv === 1) return { type: "play", card: rng.pick(ok) };
  if (s.need) {
    // même rang : poser d'abord la carte du plateau
    const belle = ok.find((c) => boxOf(c) >= 0);
    return { type: "play", card: belle || ok[0] };
  }
  const w = lv === 3 ? 1 : 0.4;
  let best = ok[0], bestV = -1e9;
  for (const c of ok) {
    const ch = chain(hand, rankNum(c), s.board, w);
    let v = ch.k * 3 + ch.gain + (ch.king ? 6 : 0) - rankNum(c) * 0.25;
    if (boxOf(c) >= 0) v += s.board[boxOf(c)] * w + 2;
    if (v > bestV) { bestV = v; best = c; }
  }
  return { type: "play", card: best };
}
export const auto = bot;
