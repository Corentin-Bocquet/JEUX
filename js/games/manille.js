// Manille à 4 joueurs en 2 équipes : le 10 (manille) est la plus forte carte,
// puis l'As (manillon), Roi, Dame, Valet, 9, 8, 7. Logique pure, sans DOM.
import { fail, rankByScore, rng as mkRng } from "../engine.js";
import { deck32, makeRules, seatPlayers, nextSeat, teamOf, botCard, rankOf, suitOf, SUITS32, SUIT_NAME } from "./lib/plis32.js";

export const meta = {
  id: "manille", name: "Manille", cat: "Cartes", min: 4, max: 4, turnTime: 30,
  color: "#4D7C0F", desc: "Le 10 est roi : fais tomber les manilles avec ton partenaire.",
  rules: [
    "4 joueurs en 2 équipes : ton partenaire est en face de toi. Il manque du monde ? Des robots complètent la table.",
    "32 cartes, 8 chacun. Dans chaque couleur : 10 (manille), As (manillon), Roi, Dame, Valet, 9, 8, 7.",
    "Points : manille 5, manillon 4, Roi 3, Dame 2, Valet 1. Il y a 60 points dans le jeu.",
    "L'atout est tiré : la dernière carte du donneur est retournée et donne la couleur d'atout (variante : le donneur choisit l'atout ou joue sans atout, points doublés).",
    "Il faut fournir la couleur demandée et monter sur un adversaire maître si tu peux (règle réglable). Sans la couleur, tu dois couper, et surcouper si un adversaire a coupé, sauf si ton partenaire est maître du pli.",
    "En fin de donne, l'équipe qui a plus de 30 points marque ce qu'elle a au-dessus de 30. À 30 partout, personne ne marque.",
    "La première équipe à atteindre le score fixé gagne la partie.",
  ],
};

// ------------------------------------------------ réglages
export const options = [
  { key: "target", label: "Partie en", icon: "🏁", values: [[34, "34 pts", "Partie classique"], [64, "64 pts", "Partie moyenne"], [101, "101 pts", "Partie longue"]], def: 34 },
  { key: "climb", label: "Monter", icon: "⬆️", values: [[true, "Obligé", "Sur l'adversaire"], [false, "Libre", "Fournir suffit"]], def: true },
  { key: "trump", label: "Atout", icon: "🎴", values: [["tire", "Retourné", "Dernière carte"], ["choix", "Au choix", "Le donneur choisit"]], def: "tire" },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "🎴", desc: "Atout retourné, on monte sur l'adversaire, partie en 34 points.", set: { target: 34, climb: true, trump: "tire" } },
  { id: "longue", name: "Partie longue", emoji: "⏳", desc: "Les mêmes règles, la première équipe à 101 points gagne.", set: { target: 101, climb: true, trump: "tire" } },
  { id: "choix", name: "Atout choisi", emoji: "👑", desc: "Le donneur regarde sa main et choisit l'atout, ou le sans atout aux points doublés.", set: { target: 34, climb: true, trump: "choix" } },
  { id: "libre", name: "Manille libre", emoji: "🕊️", desc: "Pas d'obligation de monter, partie en 64 points.", set: { target: 64, climb: false, trump: "tire" } },
];
export function opt(settings, key) {
  const o = options.find((x) => x.key === key);
  const v = settings ? settings[key] : undefined;
  const hit = o.values.find((x) => String(x[0]) === String(v));
  return hit ? hit[0] : o.def;
}

// ------------------------------------------------ cartes
const ORDER = ["7", "8", "9", "J", "Q", "K", "A", "10"];
const VAL = { 10: 5, A: 4, K: 3, Q: 2, J: 1 };
const CFG = { plain: ORDER, trumpOrder: ORDER, plainVal: VAL, trumpVal: VAL, underTrump: false };
export const RULES = makeRules({ ...CFG, climb: "opp" });
const RULES_FREE = makeRules({ ...CFG, climb: "none" });
export const rulesOf = (s) => (s.climb === false ? RULES_FREE : RULES);
export const NOTRUMP = "SA";
const MAX_DEALS = 200;

// ------------------------------------------------ donne
export function setup(players, settings, rng) {
  const { order, virt } = seatPlayers(players, rng);
  const lv = Number(settings && settings.level);
  const s = {
    order, virt, target: opt(settings, "target"), climb: opt(settings, "climb"), trumpMode: opt(settings, "trump"),
    level: [1, 2, 3].includes(lv) ? lv : 2,
    scores: [0, 0], deal: 0, dealer: rng.int(4), winner: null, lastDeal: null, lastTrick: null,
  };
  newDeal(s, rng);
  runVirtual(s, rng);
  return s;
}

function newDeal(s, rng) {
  s.deal++;
  const d = rng.shuffle(deck32());
  const first = nextSeat(s.dealer);
  const hands = [[], [], [], []];
  // distribution 4 par 4 : la dernière carte est celle du donneur
  for (let round = 0; round < 2; round++) for (let k = 0; k < 4; k++) hands[nextSeat(first, k)].push(...d.splice(0, 4));
  const last = hands[s.dealer][7];
  Object.assign(s, { hands, first, leader: first, trick: [], tricks: [0, 0], pts: [0, 0], seen: [], lastPlay: null, lastTrick: null, turned: null, trump: null });
  if (s.trumpMode === "choix") {
    s.phase = "choose";
    s.cur = s.dealer;
  } else {
    s.turned = last;
    s.trump = suitOf(last);
    s.phase = "play";
    s.cur = first;
  }
}

export function scoreDeal(s) {
  const mult = s.trump === NOTRUMP ? 2 : 1;
  const got = [0, 0];
  for (const t of [0, 1]) if (s.pts[t] > 30) got[t] = (s.pts[t] - 30) * mult;
  return { got, mult };
}

function endDeal(s, seed) {
  const { got, mult } = scoreDeal(s);
  s.scores[0] += got[0];
  s.scores[1] += got[1];
  s.lastDeal = { n: s.deal, trump: s.trump, card: s.pts.slice(), tricks: s.tricks.slice(), got, mult };
  s.dealer = nextSeat(s.dealer);
  if ((Math.max(...s.scores) >= s.target && s.scores[0] !== s.scores[1]) || s.deal >= MAX_DEALS) {
    s.phase = "over";
    s.winner = s.scores[0] >= s.scores[1] ? 0 : 1;
    return;
  }
  newDeal(s, mkRng(seed));
}

// ------------------------------------------------ actions
export function toAct(s) {
  if (s.phase === "over") return [];
  return [s.order[s.cur]];
}
const trumpOf = (s) => (s.trump === NOTRUMP ? null : s.trump);
export const legalCards = (s, seat) => rulesOf(s).legal(s.hands[seat], s.trick, trumpOf(s), seat);

function step(s, seat, a, seed) {
  const t = a && a.type;
  if (s.phase === "choose") {
    if (t !== "trump") fail("Choisis l'atout");
    if (![...SUITS32, NOTRUMP].includes(a.suit)) fail("Couleur inconnue");
    s.trump = a.suit;
    s.phase = "play";
    s.cur = s.first;
    return;
  }
  if (s.phase !== "play") fail("La partie est terminée");
  if (t !== "play") fail("Joue une carte");
  const hand = s.hands[seat];
  const i = hand.indexOf(a.card);
  if (i < 0) fail("Carte absente");
  const R = rulesOf(s);
  const tr = trumpOf(s);
  if (!R.legal(hand, s.trick, tr, seat).includes(a.card)) fail(illegalWhy(s, seat, a.card));
  hand.splice(i, 1);
  s.trick.push({ p: seat, c: a.card });
  s.lastPlay = { p: seat, c: a.card };
  if (s.trick.length < 4) { s.cur = nextSeat(seat); return; }
  const w = R.winner(s.trick, tr).p;
  const tm = teamOf(w);
  s.tricks[tm]++;
  s.pts[tm] += R.points(s.trick.map((x) => x.c), tr);
  s.seen.push(...s.trick.map((x) => x.c));
  s.lastTrick = { cards: s.trick, w };
  s.trick = [];
  s.cur = s.leader = w;
  if (!s.hands[w].length) endDeal(s, seed);
}

function illegalWhy(s, seat, card) {
  const lead = suitOf(s.trick[0].c);
  if (suitOf(card) === lead) return "Tu dois monter plus haut que l'adversaire";
  if (s.hands[seat].some((c) => suitOf(c) === lead)) return `Tu dois fournir à ${SUIT_NAME[lead].toLowerCase()}`;
  if (suitOf(card) === s.trump) return "Tu dois surcouper";
  return "Tu dois couper à l'atout";
}

function runVirtual(s, r) {
  let guard = 0;
  while (s.phase !== "over" && s.virt.includes(s.order[s.cur]) && guard++ < 2000) {
    const seat = s.cur;
    step(s, seat, bot(s, s.order[seat], r), r.int(4294967296));
  }
}

export function reduce(s, pid, a) {
  if (s.phase === "over") fail("La partie est terminée");
  if (!toAct(s).includes(pid)) fail("Ce n'est pas ton tour");
  const seed = a.seed || 1;
  step(s, s.order.indexOf(pid), a, seed);
  runVirtual(s, mkRng(seed ^ 0x4f1bbcdc));
  return s;
}

export function result(s) {
  if (s.phase !== "over") return null;
  const real = s.order.filter((id) => !s.virt.includes(id));
  const teams = [0, 1].map((t) => real.filter((id) => teamOf(s.order.indexOf(id)) === t)).filter((t) => t.length);
  return { ranking: rankByScore(real.map((id) => ({ id, score: s.scores[teamOf(s.order.indexOf(id))] }))), teams };
}

// ------------------------------------------------ robots
// force de la main pour l'atout t (ou sans atout)
export function trumpStrength(hand, t) {
  let e = 0;
  for (const c of hand) {
    const r = rankOf(c), su = suitOf(c);
    const top = { 10: 6, A: 4, K: 2, Q: 1 }[r] || 0;
    if (t === NOTRUMP) {
      // sans atout : il faut des manilles bien accompagnées
      e += r === "10" ? 7 : r === "A" && hand.includes("10" + su) ? 5 : top / 2;
    } else if (su === t) e += 4 + top;
    else e += r === "10" ? 3 : r === "A" && hand.includes("10" + su) ? 2 : 0;
  }
  return e;
}

export function bot(s, pid, rng) {
  const seat = s.order.indexOf(pid);
  if (seat < 0 || s.phase === "over") return null;
  const hand = s.hands[seat];
  if (s.phase === "choose") {
    const all = [...SUITS32, NOTRUMP].map((t) => [t, trumpStrength(hand, t) - (t === NOTRUMP ? 6 : 0)]);
    if (s.level <= 1) return { type: "trump", suit: rng.pick(all.slice(0, 4))[0] };
    all.sort((a, b) => b[1] - a[1]);
    return { type: "trump", suit: all[0][0] };
  }
  const tr = trumpOf(s);
  const card = botCard(rulesOf(s), {
    hand, trick: s.trick, trump: tr, me: seat, seen: s.seen, level: s.level, rng,
    attack: !!tr && hand.filter((c) => suitOf(c) === tr).length >= 3,
  });
  return { type: "play", card };
}
export const auto = bot;

export function botDelay(s, pid, rng) {
  if (s.phase === "play" && !s.trick.length && s.lastTrick) return 1500 + rng.int(300);
  if (s.lastDeal && !s.seen.length && !s.trick.length) return 2600;
  return 600 + rng.int(700);
}
