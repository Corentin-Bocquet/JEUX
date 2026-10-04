// Tarot français à 78 cartes, 3 à 5 joueurs (règles de la Fédération française
// de tarot, sans chelem). Logique pure : aucun DOM.
//
// Cartes : "1S".."14S" (1 à 10, 11 valet, 12 cavalier, 13 dame, 14 roi ; S pique,
// H cœur, D carreau, C trèfle), atouts "T1".."T21", excuse "EX".
// Les points sont comptés en demi-points (total 182, soit 91 points).
import { fail, rng as mkRng } from "../engine.js";
import { optReader, levelOf, nextSeat, trickWinnerIdx, rankPlayers, minBy, maxBy, trickDelay } from "./lib/plis_tb.js";

export const meta = {
  id: "tarot", name: "Tarot", cat: "Cartes", min: 3, max: 5, turnTime: 40,
  color: "#7C3AED", desc: "Le grand classique français : prends, fais ton contrat, mène le petit au bout.",
  rules: [
    "78 cartes : 4 couleurs de 14 cartes (avec le cavalier), 21 atouts et l'excuse. Le 1 (petit), le 21 et l'excuse sont les trois bouts.",
    "À 3 : 24 cartes chacun et 6 au chien. À 4 : 18 cartes et 6 au chien. À 5 : 15 cartes et 3 au chien. Un petit sec (seul atout, sans l'excuse) fait annuler la donne.",
    "Enchères : chacun parle une fois et doit monter : petite (x1), garde (x2), garde sans le chien (x4), garde contre le chien (x6). Si tout le monde passe, on redonne.",
    "À 5 : le preneur appelle un roi (une dame s'il a les quatre rois). Celui qui l'a joue avec lui, en secret jusqu'à ce que la carte tombe. Au premier pli, on ne peut pas entamer la couleur appelée, sauf avec le roi.",
    "Petite et garde : le preneur prend le chien et écarte autant de cartes, sans roi ni bout ; un atout seulement s'il n'a pas le choix (il est alors montré). Garde sans : le chien compte pour le preneur. Garde contre : il va à la défense.",
    "Il faut fournir la couleur demandée. Sinon il faut couper à l'atout, et toujours monter sur le plus gros atout du pli si tu peux. L'excuse se joue quand tu veux : elle ne gagne jamais, tu la gardes et tu donnes une petite carte (un demi-point) en échange, sauf au dernier pli où elle va au gagnant.",
    "Contrat : 56 points sans bout, 51 avec un, 41 avec deux, 36 avec trois. Marque = (25 + écart arrondi au point supérieur + petit au bout 10) x multiplicateur, plus la poignée (20, 30, 40) au camp gagnant.",
    "Petit au bout : le camp qui gagne le dernier pli quand il contient le petit marque 10 x le multiplicateur.",
    "Poignée (en option) : annonce-la en jouant ta première carte. Simple, double, triple : 10, 13, 15 atouts à 4 joueurs ; 13, 15, 18 à 3 ; 8, 10, 13 à 5 (l'excuse compte comme atout).",
    "Le preneur gagne ou perd la marque contre chaque défenseur (à 5, son partenaire en touche une part). Après le nombre de donnes choisi, le plus gros total gagne.",
  ],
};

// ---------------------------------------------------------------- réglages
export const options = [
  { key: "donnes", label: "Donnes", icon: "🔁",
    values: [[0, "Un tour", "1 donne chacun"], [3, "3", "Partie courte"], [8, "8", "Longue soirée"]], def: 0 },
  { key: "poignees", label: "Poignées", icon: "✋",
    values: [[true, "Oui", "Prime 20 à 40"], [false, "Non", "Pas d'annonce"]], def: true },
  { key: "petite", label: "Petite", icon: "🐣",
    values: [[true, "Permise", "4 contrats"], [false, "Interdite", "Garde au minimum"]], def: true },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "🃏", desc: "Un tour de table, poignées annoncées, tous les contrats.",
    set: { donnes: 0, poignees: true, petite: true } },
  { id: "express", name: "Express", emoji: "⚡", desc: "Trois donnes seulement, sans poignées : idéal pour une pause.",
    set: { donnes: 3, poignees: false, petite: true } },
  { id: "costaud", name: "Gardes seulement", emoji: "💪", desc: "La petite est interdite : on prend au moins une garde.",
    set: { donnes: 0, poignees: true, petite: false } },
  { id: "soiree", name: "Grande soirée", emoji: "🌙", desc: "Huit donnes pour un vrai classement de fin de soirée.",
    set: { donnes: 8, poignees: true, petite: true } },
];
const opt = optReader(options);

// ---------------------------------------------------------------- cartes
export const SUITS = ["S", "H", "C", "D"];
export const SUIT_SYM = { S: "♠", H: "♥", D: "♦", C: "♣" };
export const SUIT_NAME = { S: "Pique", H: "Cœur", D: "Carreau", C: "Trèfle" };
export const RANK_LBL = { 11: "V", 12: "C", 13: "D", 14: "R" };
export const RANK_LONG = { 1: "As", 11: "Valet", 12: "Cavalier", 13: "Dame", 14: "Roi" };
export const BIDS = ["Passe", "Petite", "Garde", "Garde sans", "Garde contre"];
export const MULT = [0, 1, 2, 4, 6];
export const NEED = [56, 51, 41, 36];
export const POIGNEE = { 3: [13, 15, 18], 4: [10, 13, 15], 5: [8, 10, 13] };
export const POIGNEE_PTS = [0, 20, 30, 40];
export const POIGNEE_NAME = ["", "simple", "double", "triple"];

export const isExcuse = (c) => c === "EX";
export const isTrump = (c) => c[0] === "T";
export const trumpN = (c) => (isTrump(c) ? +c.slice(1) : 0);
export const suitOf = (c) => (isExcuse(c) ? "X" : isTrump(c) ? "T" : c.slice(-1));
export const rankOf = (c) => (isExcuse(c) ? 0 : isTrump(c) ? trumpN(c) : +c.slice(0, -1));
export const isOudler = (c) => c === "T1" || c === "T21" || c === "EX";
export const isKing = (c) => !isTrump(c) && !isExcuse(c) && rankOf(c) === 14;
export function halfPts(c) {
  if (isOudler(c)) return 9;
  if (isTrump(c)) return 1;
  return { 14: 9, 13: 7, 12: 5, 11: 3 }[rankOf(c)] || 1;
}
export const sumHalf = (cards) => cards.reduce((t, c) => t + halfPts(c), 0);
export function deck78() {
  const d = [];
  for (const s of SUITS) for (let r = 1; r <= 14; r++) d.push(r + s);
  for (let t = 1; t <= 21; t++) d.push("T" + t);
  d.push("EX");
  return d;
}
export function cardName(c) {
  if (isExcuse(c)) return "l'Excuse";
  if (isTrump(c)) return c === "T1" ? "le Petit" : "l'atout " + trumpN(c);
  const r = rankOf(c);
  return `${RANK_LONG[r] || r} de ${SUIT_NAME[suitOf(c)].toLowerCase()}`;
}
export const shortLabel = (c) => (isExcuse(c) ? "Excuse" : isTrump(c) ? "Atout " + trumpN(c) : (RANK_LBL[rankOf(c)] || rankOf(c)) + SUIT_SYM[suitOf(c)]);
// tri d'affichage : couleurs alternées puis atouts puis excuse
export function sortHand(cards) {
  const key = (c) => (isExcuse(c) ? 999 : isTrump(c) ? 500 + trumpN(c) : SUITS.indexOf(suitOf(c)) * 20 + rankOf(c));
  return cards.slice().sort((a, b) => key(a) - key(b));
}

export const handSize = (n) => ({ 3: 24, 4: 18, 5: 15 }[n]);
export const chienSize = (n) => (n === 5 ? 3 : 6);
const hasPetitSec = (hand) => hand.includes("T1") && !hand.includes("EX") && hand.filter(isTrump).length === 1;

// ---------------------------------------------------------------- mise en place
export function setup(players, settings, rng) {
  const order = rng.shuffle(players.map((p) => p.id)).slice(0, 5);
  const n = order.length;
  const s = {
    order, n, level: levelOf(settings),
    poignees: opt(settings, "poignees"), petite: opt(settings, "petite"),
    total: opt(settings, "donnes") || n, donne: 1, dealer: n - 1, redeals: 0,
    scores: Object.fromEntries(order.map((id) => [id, 0])),
    phase: "bid", hands: {}, chien: [], cur: 0, bids: {}, bid: 0, taker: null,
    called: null, partner: null, revealed: false, chienShown: null, ecartAtouts: [],
    chienPile: [], chienSide: "att", trick: [], tricksDone: 0, won: {}, excuse: null,
    pab: null, annonces: [], lastTrick: null, last: null, log: null, over: false,
  };
  deal(s, rng);
  return s;
}

function deal(s, rng) {
  let d;
  for (let k = 0; k < 50; k++) {
    d = rng.shuffle(deck78());
    const hs = handSize(s.n);
    const ok = s.order.every((_, i) => !hasPetitSec(d.slice(i * hs, (i + 1) * hs)));
    if (ok) break;
    s.redeals++;
  }
  const hs = handSize(s.n);
  s.hands = {};
  s.won = {};
  s.order.forEach((id, i) => { s.hands[id] = sortHand(d.slice(i * hs, (i + 1) * hs)); s.won[id] = []; });
  s.chien = d.slice(s.n * hs);
  Object.assign(s, {
    phase: "bid", cur: nextSeat(s.n, s.dealer), bids: {}, bid: 0, taker: null, called: null, partner: null,
    revealed: false, chienShown: null, ecartAtouts: [], chienPile: [], chienSide: "att", trick: [],
    tricksDone: 0, excuse: null, pab: null, annonces: [], lastTrick: null,
  });
}

export function toAct(s) {
  if (s.over) return [];
  if (s.phase === "call" || s.phase === "chien") return [s.taker];
  return [s.order[s.cur]];
}

// ---------------------------------------------------------------- règles du jeu de la carte
export function leadSuit(trick) {
  const t = trick.find((x) => !isExcuse(x.c));
  return t ? suitOf(t.c) : null;
}
const power = (c, lead) => (isExcuse(c) ? -1 : isTrump(c) ? 100 + trumpN(c) : suitOf(c) === lead ? rankOf(c) : -1);
export function trickWinner(trick) {
  return trick[trickWinnerIdx(trick, power, leadSuit(trick))].p;
}

// cartes que le joueur a le droit de jouer
export function legal(s, pid) {
  const hand = s.hands[pid] || [];
  if (!s.trick.length) {
    // à 5, premier pli : pas d'entame dans la couleur appelée, sauf le roi lui-même
    if (s.n === 5 && s.tricksDone === 0 && s.called) {
      const su = suitOf(s.called);
      const f = hand.filter((c) => suitOf(c) !== su || c === s.called);
      if (f.length) return f;
    }
    return hand.slice();
  }
  const lead = leadSuit(s.trick);
  if (!lead) return hand.slice(); // seule l'excuse a été jouée
  const exc = hand.filter(isExcuse);
  if (lead !== "T") {
    const same = hand.filter((c) => suitOf(c) === lead);
    if (same.length) return [...same, ...exc];
  }
  const trumps = hand.filter(isTrump);
  if (trumps.length) {
    const hi = Math.max(0, ...s.trick.map((t) => trumpN(t.c)));
    const higher = trumps.filter((c) => trumpN(c) > hi);
    return [...(higher.length ? higher : trumps), ...exc];
  }
  return hand.slice();
}

// rang appelable à 5 : le roi, ou la dame si le preneur a les quatre rois, etc.
export function callRank(hand) {
  for (const r of [14, 13, 12, 11]) if (SUITS.some((su) => !hand.includes(r + su))) return r;
  return 11;
}
export const callable = (s) => SUITS.map((su) => callRank(s.hands[s.taker]) + su);

// cartes que le preneur peut écarter
export function ecartable(hand, size) {
  const plain = hand.filter((c) => !isTrump(c) && !isExcuse(c) && !isKing(c));
  if (plain.length >= size) return plain;
  return [...plain, ...hand.filter((c) => isTrump(c) && !isOudler(c))];
}

export const trumpCount = (hand) => hand.filter((c) => isTrump(c) || isExcuse(c)).length;
// meilleure poignée possible (0 : aucune)
export function poigneeMax(s, hand) {
  if (!s.poignees) return 0;
  const t = trumpCount(hand), th = POIGNEE[s.n];
  return t >= th[2] ? 3 : t >= th[1] ? 2 : t >= th[0] ? 1 : 0;
}
export const canAnnounce = (s, pid) => s.phase === "play" && s.tricksDone === 0 && s.poignees
  && !s.annonces.some((a) => a.id === pid) && poigneeMax(s, s.hands[pid] || []) > 0;

// ---------------------------------------------------------------- actions
export function reduce(s, pid, a) {
  if (!toAct(s).includes(pid)) fail("Ce n'est pas ton tour");
  if (a.type === "bid") return doBid(s, pid, a);
  if (a.type === "call") return doCall(s, pid, a);
  if (a.type === "discard") return doDiscard(s, pid, a);
  if (a.type === "play") return doPlay(s, pid, a);
  fail("Action inconnue");
}

function doBid(s, pid, a) {
  if (s.phase !== "bid") fail("Les enchères sont finies");
  const b = Number(a.bid);
  if (![0, 1, 2, 3, 4].includes(b)) fail("Enchère inconnue");
  if (b === 1 && !s.petite) fail("La petite est interdite dans cette partie");
  if (b && b <= s.bid) fail("Il faut monter au-dessus de " + BIDS[s.bid]);
  s.bids[pid] = b;
  if (b) { s.bid = b; s.taker = pid; }
  s.log = { t: "bid", id: pid, b };
  // la parole passe au suivant ; une fois la garde contre dite, les autres passent d'office
  for (;;) {
    s.cur = nextSeat(s.n, s.cur);
    const id = s.order[s.cur];
    if (Object.keys(s.bids).length >= s.n) break;
    if (s.bid === 4 && s.bids[id] === undefined) { s.bids[id] = 0; continue; }
    break;
  }
  if (Object.keys(s.bids).length < s.n) return s;
  if (!s.bid) {
    // tout le monde passe : on redonne, le donneur suivant distribue
    s.dealer = nextSeat(s.n, s.dealer);
    s.redeals++;
    deal(s, mkRng(a.seed || s.redeals * 7919 + 1));
    s.log = { t: "allpass" };
    return s;
  }
  if (s.n === 5) { s.phase = "call"; return s; }
  afterContract(s);
  return s;
}

function doCall(s, pid, a) {
  if (s.phase !== "call") fail("Pas d'appel maintenant");
  if (!callable(s).includes(a.card)) fail("Tu dois appeler un roi");
  s.called = a.card;
  const owner = s.order.find((id) => s.hands[id].includes(a.card));
  // dans le chien ou dans sa propre main : le preneur joue seul
  s.partner = owner && owner !== s.taker ? owner : null;
  s.log = { t: "call", id: pid, card: a.card };
  afterContract(s);
  return s;
}

function afterContract(s) {
  if (s.bid <= 2) {
    s.phase = "chien";
    s.chienShown = s.chien.slice();
    s.hands[s.taker] = sortHand([...s.hands[s.taker], ...s.chien]);
    s.chien = [];
    // le roi appelé était au chien : le preneur le récupère et joue seul
    return;
  }
  s.chienPile = s.chien.slice();
  s.chienSide = s.bid === 3 ? "att" : "def";
  s.chien = [];
  startPlay(s);
}

function doDiscard(s, pid, a) {
  if (s.phase !== "chien") fail("Pas d'écart maintenant");
  const size = chienSize(s.n);
  const cards = Array.isArray(a.cards) ? a.cards : [];
  if (cards.length !== size || new Set(cards).size !== size) fail(`Écarte exactement ${size} cartes`);
  const hand = s.hands[pid];
  if (!cards.every((c) => hand.includes(c))) fail("Carte absente de ta main");
  if (cards.some(isKing)) fail("Pas de roi à l'écart");
  if (cards.some(isOudler)) fail("Pas de bout à l'écart");
  const ok = ecartable(hand, size);
  if (cards.some((c) => !ok.includes(c))) fail("Pas d'atout à l'écart tant que tu as d'autres cartes");
  s.hands[pid] = hand.filter((c) => !cards.includes(c));
  s.chienPile = cards.slice();
  s.chienSide = "att";
  s.ecartAtouts = cards.filter(isTrump);
  s.log = { t: "ecart", id: pid };
  startPlay(s);
  return s;
}

function startPlay(s) {
  s.phase = "play";
  s.cur = nextSeat(s.n, s.dealer);
  s.trick = [];
  s.tricksDone = 0;
}

function doPlay(s, pid, a) {
  if (s.phase !== "play") fail("Ce n'est pas le moment de jouer");
  const hand = s.hands[pid];
  if (!hand.includes(a.card)) fail("Carte absente");
  if (!legal(s, pid).includes(a.card)) {
    const lead = leadSuit(s.trick);
    if (!s.trick.length) fail("Pas d'entame dans la couleur appelée au premier tour");
    if (lead && lead !== "T" && hand.some((c) => suitOf(c) === lead)) fail("Tu dois fournir " + SUIT_NAME[lead].toLowerCase());
    if (hand.some(isTrump) && isTrump(a.card)) fail("Tu dois monter à l'atout");
    fail("Tu dois couper à l'atout");
  }
  if (a.poignee) {
    const lvl = Number(a.poignee);
    if (!canAnnounce(s, pid)) fail("Pas de poignée possible");
    if (![1, 2, 3].includes(lvl) || lvl > poigneeMax(s, hand)) fail("Pas assez d'atouts pour cette poignée");
    const need = POIGNEE[s.n][lvl - 1];
    // on montre les atouts, l'excuse seulement s'il en manque
    const tr = hand.filter(isTrump).sort((x, y) => trumpN(x) - trumpN(y));
    const shown = tr.length >= need ? tr.slice(tr.length - need) : [...tr, "EX"];
    s.annonces.push({ id: pid, lvl, cards: shown });
  }
  s.hands[pid] = hand.filter((c) => c !== a.card);
  s.trick.push({ p: pid, c: a.card });
  if (a.card === s.called) s.revealed = true;
  s.log = { t: "play", id: pid, card: a.card };
  if (s.trick.length < s.n) { s.cur = nextSeat(s.n, s.cur); return s; }
  closeTrick(s, a.seed);
  return s;
}

export const campOf = (s, id) => (id === s.taker || (s.partner && id === s.partner) ? "att" : "def");

function closeTrick(s, seed) {
  const win = trickWinner(s.trick);
  const last = s.hands[win].length === 0;
  for (const t of s.trick) {
    if (isExcuse(t.c) && !last) {
      s.won[t.p].push(t.c);
      s.excuse = { owner: t.p, to: win };
    } else s.won[win].push(t.c);
  }
  if (last && s.trick.some((t) => t.c === "T1")) s.pab = campOf(s, win);
  s.lastTrick = { cards: s.trick, win, no: s.tricksDone + 1 };
  s.tricksDone++;
  s.trick = [];
  s.cur = s.order.indexOf(win);
  if (last) scoreDonne(s, seed);
}

// ---------------------------------------------------------------- marque
// Calcul pur d'une donne (exporté pour les tests).
export function computeScore({ n, bid, attHalf, oudlers, pab, poign, partner }) {
  const need = NEED[oudlers];
  const diffHalf = attHalf - need * 2;
  const won = diffHalf >= 0;
  const gain = Math.ceil(Math.abs(diffHalf) / 2);
  const sgn = won ? 1 : -1;
  const pabPts = pab === "att" ? 10 : pab === "def" ? -10 : 0;
  const v = ((25 + gain) * sgn + pabPts) * MULT[bid] + sgn * poign;
  const takerShare = n === 5 ? (partner ? 2 : 4) : n - 1;
  return { need, won, gain, v, takerShare, pabPts };
}

function scoreDonne(s, seed) {
  const att = new Set([s.taker, ...(s.partner ? [s.partner] : [])]);
  let attCards = [], defCards = [];
  for (const id of s.order) (att.has(id) ? attCards : defCards).push(...s.won[id]);
  (s.chienSide === "att" ? attCards : defCards).push(...s.chienPile);
  let attHalf = sumHalf(attCards);
  if (s.excuse) {
    const o = campOf(s, s.excuse.owner), w = campOf(s, s.excuse.to);
    if (o !== w) attHalf += o === "att" ? -1 : 1; // une petite carte en échange de l'excuse
  }
  const oudlers = attCards.filter(isOudler).length;
  const poign = s.annonces.reduce((t, x) => t + POIGNEE_PTS[x.lvl], 0);
  const r = computeScore({ n: s.n, bid: s.bid, attHalf, oudlers, pab: s.pab, poign, partner: s.partner });
  const delta = {};
  for (const id of s.order) {
    let d = -r.v;
    if (id === s.taker) d = r.v * r.takerShare;
    else if (id === s.partner) d = r.v;
    delta[id] = d;
    s.scores[id] += d;
  }
  s.last = {
    donne: s.donne, taker: s.taker, partner: s.partner, called: s.called, bid: s.bid, oudlers,
    att: attHalf / 2, need: r.need, won: r.won, gain: r.gain, pab: s.pab, poign, v: r.v, delta,
    annonces: s.annonces.map((x) => ({ id: x.id, lvl: x.lvl })),
  };
  s.log = { t: "end" };
  if (s.donne >= s.total) { s.over = true; s.phase = "over"; return; }
  s.donne++;
  s.dealer = nextSeat(s.n, s.dealer);
  deal(s, mkRng((seed || 1) ^ 0x5bd1e995));
}

export function result(s) {
  if (!s.over) return null;
  return { ranking: rankPlayers(s.order, (id) => s.scores[id]) };
}

// ---------------------------------------------------------------- robots
// Force d'une main ramenée à une main de 18 cartes.
export function strength(hand, n) {
  const tr = hand.filter(isTrump);
  let p = tr.length * 2 + tr.filter((c) => trumpN(c) >= 16).length * 2;
  if (hand.includes("T21")) p += 10;
  if (hand.includes("EX")) p += 8;
  if (hand.includes("T1")) p += tr.length >= 5 ? 7 : 3;
  for (const su of SUITS) {
    const cs = hand.filter((c) => suitOf(c) === su);
    const has = (r) => cs.includes(r + su);
    if (has(14)) p += 6;
    if (has(13)) p += has(14) ? 3 : 2;
    if (has(12)) p += 1;
    if (cs.length >= 5) p += (cs.length - 4) * 2;
    if (cs.length === 0) p += tr.length >= 5 ? 5 : 2;
    else if (cs.length === 1) p += 2;
  }
  return Math.round((p * 18) / handSize(n));
}
export const BID_STEPS = [36, 44, 54, 62]; // petite, garde, garde sans, garde contre

function botBid(s, pid, r) {
  let st = strength(s.hands[pid], s.n);
  if (s.level === 1) st += r.int(17) - 8;
  if (s.level === 3 && s.n === 5) st += 2; // à 5, on peut compter sur le partenaire
  let want = 0;
  BID_STEPS.forEach((t, i) => { if (st >= t) want = i + 1; });
  if (want === 1 && !s.petite) want = st >= BID_STEPS[0] + 8 ? 2 : 0;
  return { type: "bid", bid: want > s.bid ? want : 0 };
}

function botCall(s) {
  const hand = s.hands[s.taker];
  const opts = callable(s).filter((c) => !hand.includes(c));
  const list = opts.length ? opts : callable(s);
  // appelle dans la couleur où il a le plus de cartes (il y fera des plis avec le roi partenaire)
  return { type: "call", card: maxBy(list, (c) => hand.filter((x) => suitOf(x) === suitOf(c)).length * 10 + SUITS.indexOf(suitOf(c))) };
}

export function botDiscard(s, pid) {
  const hand = s.hands[pid];
  const size = chienSize(s.n);
  const ok = ecartable(hand, size);
  const len = (su) => hand.filter((c) => suitOf(c) === su).length;
  // vide d'abord les couleurs courtes (pour couper ensuite), les grosses cartes non protégées en priorité
  const plain = ok.filter((c) => !isTrump(c)).sort((a, b) => len(suitOf(a)) - len(suitOf(b)) || halfPts(b) - halfPts(a) || rankOf(b) - rankOf(a));
  const picked = plain.slice(0, size);
  const tr = ok.filter(isTrump).sort((a, b) => trumpN(a) - trumpN(b));
  while (picked.length < size) picked.push(tr.shift());
  return { type: "discard", cards: picked };
}

// qui est dans mon camp, du point de vue de ce que je sais
function mateOf(s, me, id) {
  if (id === me) return 1;
  const iAtt = me === s.taker || me === s.partner;
  if (iAtt) {
    if (me === s.partner) return id === s.taker ? 1 : -1;
    return s.revealed && id === s.partner ? 1 : s.n === 5 && !s.revealed ? 0 : -1;
  }
  if (id === s.taker) return -1;
  if (s.n !== 5) return 1;
  if (s.revealed) return id === s.partner ? -1 : 1;
  return 0;
}

export function botPlay(s, pid, r) {
  const hand = s.hands[pid];
  const L = legal(s, pid);
  if (L.length === 1) return L[0];
  // l'excuse ne doit pas rester pour le dernier pli
  if (hand.length === 2 && L.includes("EX")) return "EX";
  if (s.level === 1 && r.next() < 0.45) return L[r.int(L.length)];
  const cands = L.filter((c) => !isExcuse(c));
  const atk = pid === s.taker || pid === s.partner;
  const myTr = hand.filter(isTrump);
  if (!s.trick.length) {
    // entame
    if (atk && myTr.length >= Math.max(4, hand.length / 2)) {
      const t = cands.filter((c) => isTrump(c) && c !== "T1" && c !== "T21");
      if (t.length) return maxBy(t, trumpN);
    }
    const kings = cands.filter(isKing).filter((c) => !(s.n === 5 && !atk && c === s.called));
    if (kings.length) return kings[0];
    const plain = cands.filter((c) => !isTrump(c));
    if (plain.length) {
      const len = (su) => hand.filter((c) => suitOf(c) === su).length;
      // défense : entame une couleur longue, petite carte (pour faire couper le preneur)
      const best = atk ? minBy(plain, (c) => len(suitOf(c)) * 20 + rankOf(c)) : minBy(plain, (c) => -len(suitOf(c)) * 20 + rankOf(c));
      return best;
    }
    const tr = cands.filter((c) => c !== "T1");
    return tr.length ? minBy(tr, trumpN) : cands[0] || L[0];
  }
  const winId = trickWinner(s.trick);
  const winCard = s.trick.find((t) => t.p === winId).c;
  const lead = leadSuit(s.trick);
  const lastToPlay = s.trick.length === s.n - 1;
  const mateWins = mateOf(s, pid, winId) === 1;
  const beats = (c) => power(c, lead) > power(winCard, lead);
  const pts = s.trick.reduce((t, x) => t + halfPts(x.c), 0);
  const cheap = (list) => minBy(list, (c) => halfPts(c) * 30 + (isTrump(c) ? 40 + trumpN(c) : rankOf(c)) + (c === "T1" ? 500 : 0));
  // l'atout de mon partenaire est-il sûr ? (dernier à jouer, ou gros atout)
  const safe = mateWins && (lastToPlay || (isTrump(winCard) && trumpN(winCard) >= 18) || (lead !== "T" && !isTrump(winCard) && rankOf(winCard) === 14 && s.tricksDone < 2));
  if (safe) {
    if (cands.includes("T1")) return "T1";
    // charger : la plus grosse carte qui ne soit ni un roi gaspillé ni un bout
    const load = cands.filter((c) => !isTrump(c));
    if (load.length) return maxBy(load, (c) => halfPts(c) * 10 + rankOf(c) - (isKing(c) && !lastToPlay ? 100 : 0));
    return cheap(cands);
  }
  const winners = cands.filter(beats);
  if (winners.length && !mateWins) {
    const noPetit = winners.filter((c) => c !== "T1");
    if (lastToPlay) return minBy(winners, (c) => power(c, lead)); // le petit passe s'il est maître
    if (noPetit.length) {
      const k = noPetit.filter(isKing);
      if (k.length && s.tricksDone < 3) return k[0];
      if (pts >= 9 || isTrump(noPetit[0]) || r.next() < 0.6) return minBy(noPetit, (c) => power(c, lead));
    }
  }
  // je perds ce pli : excuse si le pli est précieux, sinon la plus petite carte
  if (L.includes("EX") && !mateWins && pts >= 9 && hand.length > 2) return "EX";
  return cheap(cands.length ? cands : L);
}

export function bot(s, pid, r) {
  if (s.phase === "bid") return botBid(s, pid, r);
  if (s.phase === "call") return botCall(s);
  if (s.phase === "chien") return botDiscard(s, pid);
  if (s.phase !== "play") return null;
  const card = botPlay(s, pid, r);
  const a = { type: "play", card };
  if (canAnnounce(s, pid)) a.poignee = poigneeMax(s, s.hands[pid]);
  return a;
}
export const auto = bot;
export function botDelay(s, pid, r) {
  if (s.phase === "chien") return 1600 + r.int(600);
  return trickDelay(s.trick.length, !!s.lastTrick && s.phase === "play", r);
}
