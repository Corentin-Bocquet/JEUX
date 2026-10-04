// Bridge à 4 joueurs, Nord-Sud contre Est-Ouest, marque duplicate simplifiée :
// chaque donne est marquée seule (pas de manches à reporter), avec la
// vulnérabilité officielle des étuis. Logique pure : aucun DOM.
// Cartes au format de cards.js : "10H", "QS"... Places 0 Nord, 1 Est, 2 Sud, 3 Ouest.
import { fail, rng as mkRng } from "../engine.js";
import { deck, rankOf, suitOf, rv } from "./cards.js";
import { optReader, levelOf, nextSeat, trickWinnerIdx, fillSeats, isVirtual, rankPlayers, minBy, maxBy, trickDelay } from "./lib/plis_tb.js";

export const meta = {
  id: "bridge", name: "Bridge", cat: "Cartes", min: 4, max: 4, turnTime: 45,
  color: "#1E3A8A", desc: "Annonce ton contrat avec ton partenaire, puis fais tes levées en jouant aussi pour le mort.",
  rules: [
    "Deux équipes face à face : Nord-Sud contre Est-Ouest. 13 cartes chacun, l'As est la plus forte.",
    "Enchères : à tour de rôle, passe ou annonce un palier (1 à 7) et une couleur ou sans-atout (SA). Chaque enchère doit être plus forte : à palier égal, ♣ < ♦ < ♥ < ♠ < SA. Le palier promet 6 + palier levées.",
    "Contre et surcontre (en option) : tu peux contrer l'enchère adverse, l'équipe contrée peut surcontrer. Les points de la donne sont multipliés.",
    "Trois passes après une enchère finissent les enchères. Quatre passes d'entrée : la donne est passée (0 point).",
    "Le déclarant est le premier de l'équipe à avoir nommé la couleur du contrat. Son voisin de gauche entame, puis le partenaire du déclarant (le mort) étale ses cartes : le déclarant joue pour lui.",
    "Il faut fournir la couleur demandée. Sinon tu peux couper à l'atout ou te défausser. Le plus gros atout gagne la levée, sinon la plus grosse carte de la couleur demandée.",
    "Marque duplicate simplifiée : levées ♣♦ 20, ♥♠ 30, SA 40 puis 30. Manche (100 points de levées) : prime 300, ou 500 vulnérable ; partielle : 50. Petit chelem 500/750, grand chelem 1000/1500.",
    "Chute : 50 par levée (100 vulnérable) ; contré : 100, 300, 500 puis 300 de plus par levée (200, 500, 800... vulnérable) ; surcontré : le double.",
    "À la fin des donnes, l'équipe qui a le plus de points gagne.",
  ],
};

// ---------------------------------------------------------------- réglages
export const options = [
  { key: "donnes", label: "Donnes", icon: "🔁", values: [[2, "2", "Partie express"], [4, "4", "Un tour de table"], [8, "8", "Deux tours"]], def: 4 },
  { key: "contre", label: "Contre", icon: "⚔️", values: [[true, "Oui", "Contre, surcontre"], [false, "Non", "Enchères simples"]], def: true },
  { key: "vuln", label: "Vulnérable", icon: "🎯",
    values: [["cycle", "Officielle", "Change par donne"], ["none", "Personne", "Moins de risque"], ["all", "Tous", "Gros enjeux"]], def: "cycle" },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "♠️", desc: "Quatre donnes, contre permis, vulnérabilité officielle.",
    set: { donnes: 4, contre: true, vuln: "cycle" } },
  { id: "debutant", name: "Découverte", emoji: "🌱", desc: "Deux donnes, sans contre ni vulnérabilité : pour apprendre.",
    set: { donnes: 2, contre: false, vuln: "none" } },
  { id: "tension", name: "Tout vulnérable", emoji: "🔥", desc: "Primes et chutes au maximum : chaque contrat compte.",
    set: { donnes: 4, contre: true, vuln: "all" } },
  { id: "longue", name: "Longue partie", emoji: "🌙", desc: "Huit donnes pour un vrai match.",
    set: { donnes: 8, contre: true, vuln: "cycle" } },
];
const opt = optReader(options);

// ---------------------------------------------------------------- bases
export const SEAT_NAME = ["Nord", "Est", "Sud", "Ouest"];
export const SEAT_SHORT = ["N", "E", "S", "O"];
export const STRAINS = ["C", "D", "H", "S", "N"];
export const STRAIN_SYM = { C: "♣", D: "♦", H: "♥", S: "♠", N: "SA" };
export const TEAM_NAME = ["Nord-Sud", "Est-Ouest"];
export const teamOf = (seat) => seat % 2;
export const partnerOf = (seat) => (seat + 2) % 4;
// vulnérabilité officielle des 16 étuis : 0 personne, 1 NS, 2 EO, 3 tous
const VUL_CYCLE = [0, 1, 2, 3, 1, 2, 3, 0, 2, 3, 0, 1, 3, 0, 1, 2];
export function vulOf(s, board) {
  if (s.vuln === "none") return [false, false];
  if (s.vuln === "all") return [true, true];
  const v = VUL_CYCLE[(board - 1) % 16];
  return [v === 1 || v === 3, v === 2 || v === 3];
}
export const bidRank = (b) => (+b[0] - 1) * 5 + STRAINS.indexOf(b.slice(1));
export const isBid = (c) => /^[1-7][CDHSN]$/.test(c);
export const callLabel = (c) => (c === "P" ? "Passe" : c === "X" ? "Contre" : c === "XX" ? "Surcontre" : c[0] + " " + STRAIN_SYM[c[1]]);
export const contractLabel = (k) => (k ? `${k.level} ${STRAIN_SYM[k.strain]}${k.dbl === 2 ? " XX" : k.dbl === 1 ? " X" : ""}` : "");
const SORT_SUITS = ["S", "H", "C", "D"];
export const sortHand = (h) => h.slice().sort((a, b) => SORT_SUITS.indexOf(suitOf(a)) - SORT_SUITS.indexOf(suitOf(b)) || rv(b) - rv(a));

// ---------------------------------------------------------------- mise en place
export function setup(players, settings, rng) {
  const seats = fillSeats(rng.shuffle(players.map((p) => p.id)), 4);
  const s = {
    seats, level: levelOf(settings), contre: opt(settings, "contre"), vuln: opt(settings, "vuln"),
    total: opt(settings, "donnes"), board: 1, team: [0, 0], phase: "bid", hands: {}, dealer: 0, cur: 0,
    auction: [], contract: null, trick: [], leader: 0, tricks: [0, 0], played: 0, dummyShown: false,
    lastTrick: null, last: null, history: [], over: false, gseed: rng.int(1 << 30),
  };
  deal(s, rng);
  runVirtual(s);
  return s;
}

function deal(s, rng) {
  const d = rng.shuffle(deck());
  s.hands = {};
  for (let i = 0; i < 4; i++) s.hands[i] = sortHand(d.slice(i * 13, i * 13 + 13));
  s.dealer = (s.board - 1) % 4;
  Object.assign(s, { phase: "bid", cur: s.dealer, auction: [], contract: null, trick: [], tricks: [0, 0], played: 0, dummyShown: false, lastTrick: null });
}

// place qui décide du coup courant : le déclarant joue pour le mort
export function controller(s, seat = s.cur) {
  if (s.phase === "play" && s.contract && seat === partnerOf(s.contract.decl)) return s.contract.decl;
  return seat;
}
export function toAct(s) {
  if (s.over) return [];
  return [s.seats[controller(s)]];
}
export const seatOf = (s, id) => s.seats.indexOf(id);

// ---------------------------------------------------------------- enchères
export function lastBid(s) {
  for (let i = s.auction.length - 1; i >= 0; i--) if (isBid(s.auction[i])) return { bid: s.auction[i], seat: (s.dealer + i) % 4, i };
  return null;
}
// contre en cours sur la dernière enchère : 0, 1 (contré), 2 (surcontré)
function dblState(s) {
  const lb = lastBid(s);
  if (!lb) return 0;
  let d = 0;
  for (let i = lb.i + 1; i < s.auction.length; i++) if (s.auction[i] === "X") d = 1; else if (s.auction[i] === "XX") d = 2;
  return d;
}
export function legalCalls(s, seat = s.cur) {
  const out = ["P"];
  const lb = lastBid(s);
  const from = lb ? bidRank(lb.bid) + 1 : 0;
  for (let r = from; r < 35; r++) out.push(Math.floor(r / 5) + 1 + STRAINS[r % 5]);
  if (s.contre && lb) {
    const d = dblState(s);
    if (d === 0 && teamOf(lb.seat) !== teamOf(seat)) out.push("X");
    if (d === 1 && teamOf(lb.seat) === teamOf(seat)) out.push("XX");
  }
  return out;
}

function doCall(s, seat, call, seed) {
  if (!legalCalls(s, seat).includes(call)) fail(call === "X" || call === "XX" ? "Contre impossible ici" : "Enchère trop faible");
  s.auction.push(call);
  const A = s.auction;
  const passes3 = A.length >= 4 && A.slice(-3).every((c) => c === "P");
  if (A.length === 4 && A.every((c) => c === "P")) { endBoard(s, null, seed); return; }
  if (passes3 && lastBid(s)) {
    const lb = lastBid(s);
    const strain = lb.bid[1];
    const team = teamOf(lb.seat);
    // déclarant : premier de l'équipe à avoir nommé cette couleur
    let decl = lb.seat;
    for (let i = 0; i < A.length; i++) {
      const p = (s.dealer + i) % 4;
      if (teamOf(p) === team && isBid(A[i]) && A[i][1] === strain) { decl = p; break; }
    }
    s.contract = { level: +lb.bid[0], strain, dbl: dblState(s), decl };
    s.phase = "play";
    s.cur = nextSeat(4, decl);
    s.leader = s.cur;
    return;
  }
  s.cur = nextSeat(4, seat);
}

// ---------------------------------------------------------------- jeu de la carte
const trumpOf = (s) => (s.contract && s.contract.strain !== "N" ? s.contract.strain : null);
export function legal(s, seat = s.cur) {
  const hand = s.hands[seat];
  if (!s.trick.length) return hand.slice();
  const lead = suitOf(s.trick[0].c);
  const same = hand.filter((c) => suitOf(c) === lead);
  return same.length ? same : hand.slice();
}
export function trickWinner(trick, trump) {
  const lead = suitOf(trick[0].c);
  const power = (c) => (suitOf(c) === trump ? 100 + rv(c) : suitOf(c) === lead ? rv(c) : -1);
  return trick[trickWinnerIdx(trick, power, lead)].p;
}

function doPlay(s, seat, card, seed) {
  if (!s.hands[seat].includes(card)) fail("Carte absente");
  if (!legal(s, seat).includes(card)) fail("Tu dois fournir la couleur demandée");
  s.hands[seat] = s.hands[seat].filter((c) => c !== card);
  s.trick.push({ p: seat, c: card });
  s.dummyShown = true;
  if (s.trick.length < 4) { s.cur = nextSeat(4, seat); return; }
  const w = trickWinner(s.trick, trumpOf(s));
  s.tricks[teamOf(w)]++;
  s.played++;
  s.lastTrick = { cards: s.trick, win: w };
  s.trick = [];
  s.cur = w;
  if (s.played === 13) endBoard(s, s.contract, seed);
}

// ---------------------------------------------------------------- marque
// Points de la donne pour l'équipe du déclarant (négatif : chute, points pour la défense).
export function scoreContract({ level, strain, dbl, vul, tricks }) {
  const need = level + 6;
  const mult = dbl === 2 ? 4 : dbl === 1 ? 2 : 1;
  if (tricks >= need) {
    const per = strain === "C" || strain === "D" ? 20 : 30;
    const base = (strain === "N" ? 40 + 30 * (level - 1) : per * level) * mult;
    let sc = base;
    sc += base >= 100 ? (vul ? 500 : 300) : 50;
    if (level === 6) sc += vul ? 750 : 500;
    if (level === 7) sc += vul ? 1500 : 1000;
    if (dbl === 1) sc += 50;
    if (dbl === 2) sc += 100;
    const over = tricks - need;
    if (dbl === 0) sc += over * per;
    else sc += over * (vul ? 200 : 100) * (dbl === 2 ? 2 : 1);
    return sc;
  }
  const down = need - tricks;
  if (dbl === 0) return -down * (vul ? 100 : 50);
  let p = 0;
  for (let k = 1; k <= down; k++) {
    if (vul) p += k === 1 ? 200 : 300;
    else p += k === 1 ? 100 : k <= 3 ? 200 : 300;
  }
  return -p * (dbl === 2 ? 2 : 1);
}

function endBoard(s, k, seed) {
  const vul = vulOf(s, s.board);
  let rec = { board: s.board, contract: null, pts: [0, 0] };
  if (k) {
    const team = teamOf(k.decl);
    const tricks = s.tricks[team];
    const sc = scoreContract({ ...k, vul: vul[team], tricks });
    const pts = [0, 0];
    if (sc > 0) pts[team] = sc; else pts[1 - team] = -sc;
    rec = { board: s.board, contract: { ...k }, tricks, made: tricks - (k.level + 6), pts };
  }
  s.team[0] += rec.pts[0];
  s.team[1] += rec.pts[1];
  s.last = rec;
  s.history.push(rec);
  if (s.board >= s.total) { s.over = true; s.phase = "over"; return; }
  s.board++;
  deal(s, mkRng((seed || 1) ^ 0x2545f491));
}

export function result(s) {
  if (!s.over) return null;
  const real = s.seats.filter((id) => !isVirtual(id));
  const teams = [[s.seats[0], s.seats[2]], [s.seats[1], s.seats[3]]].map((t) => t.filter((id) => !isVirtual(id))).filter((t) => t.length);
  return { ranking: rankPlayers(real, (id) => s.team[teamOf(seatOf(s, id))]), teams };
}

// ---------------------------------------------------------------- actions
function step(s, seat, a) {
  if (a.type === "call") {
    if (s.phase !== "bid") fail("Les enchères sont finies");
    doCall(s, seat, a.call, a.seed);
  } else if (a.type === "play") {
    if (s.phase !== "play") fail("Ce n'est pas le moment de jouer");
    doPlay(s, seat, a.card, a.seed);
  } else fail("Action inconnue");
}

export function reduce(s, pid, a) {
  if (!toAct(s).includes(pid)) fail("Ce n'est pas ton tour");
  step(s, s.cur, a);
  runVirtual(s);
  return s;
}

// les robots internes (places vides) jouent tout de suite
function runVirtual(s) {
  for (let k = 0; k < 400 && !s.over && isVirtual(s.seats[controller(s)]); k++) {
    s.gseed = (s.gseed * 1103515245 + 12345) & 0x3fffffff;
    const r = mkRng(s.gseed);
    step(s, s.cur, { ...botAction(s, s.cur, r), seed: r.int(1 << 30) });
  }
}

// ---------------------------------------------------------------- robots : enchères
const HCP = { A: 4, K: 3, Q: 2, J: 1 };
export const hcp = (hand) => hand.reduce((t, c) => t + (HCP[rankOf(c)] || 0), 0);
const lens = (hand) => Object.fromEntries(["S", "H", "D", "C"].map((su) => [su, hand.filter((c) => suitOf(c) === su).length]));
export function balanced(hand) {
  const l = Object.values(lens(hand)).sort((a, b) => a - b);
  return l[0] >= 2 && l[1] >= 3 || (l[0] === 2 && l[1] === 3);
}
const LEVELS = {
  N: [[37, 7], [33, 6], [26, 3], [23, 2], [20, 1]],
  M: [[37, 7], [33, 6], [26, 4], [23, 3], [0, 2]],
  m: [[37, 7], [33, 6], [29, 5], [26, 4], [23, 3], [0, 2]],
};
const targetLevel = (strain, pts) => {
  const t = LEVELS[strain === "N" ? "N" : strain === "H" || strain === "S" ? "M" : "m"].find(([p]) => pts >= p);
  return t ? t[1] : 0;
};

// ce que le partenaire a montré : points minimum et couleurs
function partnerInfo(s, seat) {
  const p = partnerOf(seat);
  let min = 0;
  const suits = {};
  s.auction.forEach((c, i) => {
    if (!isBid(c) || (s.dealer + i) % 4 !== p) return;
    const before = s.auction.slice(0, i).map((x, j) => (isBid(x) ? (s.dealer + j) % 4 : -1)).filter((x) => x >= 0);
    const lvl = +c[0], nt = c[1] === "N";
    let est;
    if (!before.length) est = c === "1N" ? 15 : c === "2N" ? 20 : 12; // ouverture
    else if (!before.some((x) => teamOf(x) === teamOf(p))) est = c === "1N" ? 15 : 8; // intervention
    else if (nt) est = lvl === 1 ? 6 : lvl === 2 ? 11 : 13; // réponse ou redemande
    else est = lvl <= 2 ? 6 : lvl === 3 ? 10 : 13;
    min = Math.max(min, est);
    if (!nt) suits[c[1]] = Math.max(suits[c[1]] || 0, !before.length && (c[1] === "H" || c[1] === "S") ? 5 : 4);
  });
  return { min, suits, ntOnly: Object.keys(suits).length === 0 && min > 0 };
}

export function botCall(s, seat, r) {
  const hand = s.hands[seat];
  const L = legalCalls(s, seat);
  const ok = (c) => L.includes(c);
  const H = hcp(hand), len = lens(hand);
  const lenPts = Object.values(len).reduce((t, n) => t + Math.max(0, n - 4), 0);
  const pts = H + lenPts + (s.level === 1 ? r.int(5) - 2 : 0);
  const bal = balanced(hand);
  const lb = lastBid(s);
  const ourBids = s.auction.some((c, i) => isBid(c) && teamOf((s.dealer + i) % 4) === teamOf(seat));
  const theirBid = lb && teamOf(lb.seat) !== teamOf(seat);
  const P = partnerInfo(s, seat);
  const cheapest = (strain) => { for (let l = 1; l <= 7; l++) if (ok(l + strain)) return l; return 8; };
  const bidAt = (lvl, strain) => (lvl <= 7 && ok(lvl + strain) ? lvl + strain : null);

  // ouverture
  if (!lb) {
    if (pts < 12) return "P";
    if (bal && H >= 15 && H <= 17) return "1N";
    if (bal && H >= 20 && H <= 21) return "2N";
    const major = ["S", "H"].find((su) => len[su] >= 5);
    if (major) return "1" + major;
    return "1" + (len.D > len.C ? "D" : len.C > len.D ? "C" : len.D >= 4 ? "D" : "C");
  }
  // le partenaire a parlé : on construit
  if (P.min > 0) {
    const myBefore = s.auction.some((c, i) => isBid(c) && (s.dealer + i) % 4 === seat);
    if (!myBefore && pts < 6) return "P";
    let strain = null, total = 0;
    const fit = ["S", "H", "D", "C"].filter((su) => P.suits[su] && P.suits[su] + len[su] >= 8);
    if (fit.length) {
      strain = fit.find((su) => su === "S" || su === "H") || fit[0];
      const short = Object.values(len).reduce((t, n) => t + (n === 0 ? 3 : n === 1 ? 2 : n === 2 ? 1 : 0), 0);
      total = H + short + P.min;
    } else if (P.ntOnly && ["S", "H"].some((su) => len[su] >= 6)) {
      strain = ["S", "H"].find((su) => len[su] >= 6);
      total = pts + P.min;
    } else {
      total = pts + P.min;
      const own = ["S", "H", "D", "C"].filter((su) => len[su] >= (myBefore ? 6 : 4) && !P.suits[su]);
      const newSuit = minBy(own, (su) => cheapest(su) * 10 - len[su]);
      if (newSuit && !myBefore && (cheapest(newSuit) === 1 || (cheapest(newSuit) === 2 && pts >= 10))) return newSuit && bidAt(cheapest(newSuit), newSuit) || "P";
      if (newSuit && myBefore && total < 26 && cheapest(newSuit) <= 2) return bidAt(cheapest(newSuit), newSuit) || "P";
      strain = "N";
    }
    let lvl = targetLevel(strain, total);
    if (strain !== "N" && (strain === "C" || strain === "D") && total >= 26 && total < 29 && bal && ok("3N")) return "3N";
    if (lvl >= cheapest(strain)) {
      // on avance doucement à palier faible, on saute à la manche quand elle est sûre
      const lv = lvl >= 3 ? lvl : cheapest(strain);
      const b = bidAt(lv, strain);
      if (b) return b;
    }
    if (s.contre && theirBid && ok("X") && +lb.bid[0] >= 3 && total >= 23 && H >= 10) return "X";
    return "P";
  }
  // l'adversaire a ouvert : intervention
  if (theirBid && !ourBids) {
    const five = ["S", "H", "D", "C"].filter((su) => len[su] >= 5);
    const su = maxBy(five, (x) => len[x] * 10 + (x === "S" || x === "H" ? 1 : 0));
    if (bal && H >= 15 && H <= 18 && +lb.bid[0] === 1 && ok("1N")) return "1N";
    if (su && H >= 8 && cheapest(su) <= 2 && (cheapest(su) === 1 || H >= 11)) return bidAt(cheapest(su), su) || "P";
    if (s.contre && ok("X") && +lb.bid[0] >= 2 && H >= 15) return "X";
  }
  return "P";
}

// ---------------------------------------------------------------- robots : jeu de la carte
export function botCard(s, seat, r) {
  const hand = s.hands[seat];
  const L = legal(s, seat);
  if (L.length === 1) return L[0];
  if (s.level === 1 && r.next() < 0.4) return L[r.int(L.length)];
  const trump = trumpOf(s);
  const k = s.contract;
  const declSide = teamOf(seat) === teamOf(k.decl);
  // cartes qu'on voit : sa main, le mort (après l'entame), et les cartes jouées
  const dummy = partnerOf(k.decl);
  const visible = new Set([...hand, ...(s.dummyShown || seat === dummy ? s.hands[dummy] : []), ...(seat === dummy ? s.hands[k.decl] : [])]);
  const inHands = new Set([0, 1, 2, 3].flatMap((p) => s.hands[p]));
  const outstanding = (c) => inHands.has(c) && !visible.has(c);
  const master = (c) => !deck().some((x) => suitOf(x) === suitOf(c) && rv(x) > rv(c) && outstanding(x));
  const low = (list) => minBy(list, (c) => (suitOf(c) === trump ? 100 : 0) + rv(c));
  const len = (su) => hand.filter((c) => suitOf(c) === su).length;
  if (!s.trick.length) {
    // déclarant : purge les atouts adverses
    if (declSide && trump) {
      const oppTrumps = deck().some((x) => suitOf(x) === trump && outstanding(x));
      const myT = hand.filter((c) => suitOf(c) === trump);
      if (oppTrumps && myT.length) return maxBy(myT, rv);
    }
    const masters = L.filter((c) => suitOf(c) !== trump && master(c));
    if (masters.length && (declSide || s.played > 0)) return maxBy(masters, rv);
    const plain = L.filter((c) => suitOf(c) !== trump);
    const pool = plain.length ? plain : L;
    const su = suitOf(maxBy(pool, (c) => len(suitOf(c)) * 20 + rv(c)));
    const cs = pool.filter((c) => suitOf(c) === su).sort((a, b) => rv(b) - rv(a));
    // tête de séquence (AK, KQ, QJ), sinon petite carte
    if (cs.length >= 2 && rv(cs[0]) >= 12 && rv(cs[0]) - rv(cs[1]) === 1) return cs[0];
    return cs[cs.length - 1];
  }
  const lead = suitOf(s.trick[0].c);
  const w = trickWinner(s.trick, trump);
  const wc = s.trick.find((t) => t.p === w).c;
  const pow = (c) => (suitOf(c) === trump ? 100 + rv(c) : suitOf(c) === lead ? rv(c) : -1);
  const mateWins = teamOf(w) === teamOf(seat);
  const last = s.trick.length === 3;
  const winners = L.filter((c) => pow(c) > pow(wc));
  const following = suitOf(L[0]) === lead && L.every((c) => suitOf(c) === lead);
  if (mateWins && (last || master(wc) || s.trick.length === 2)) return following ? low(L) : low(L.filter((c) => suitOf(c) !== trump).length ? L.filter((c) => suitOf(c) !== trump) : L);
  if (winners.length) {
    if (last || s.trick.length === 2) return minBy(winners, pow);
    // deuxième main : petite, sauf carte maîtresse
    const m = winners.filter(master);
    if (m.length && following) return minBy(m, pow);
    if (!following) return minBy(winners, pow); // coupe
    return low(L);
  }
  // défausse : petite carte de la couleur la plus courte (hors atout)
  if (!following) {
    const plain = L.filter((c) => suitOf(c) !== trump);
    const pool = plain.length ? plain : L;
    return minBy(pool, (c) => len(suitOf(c)) * 20 + rv(c));
  }
  return low(L);
}

function botAction(s, seat, r) {
  return s.phase === "bid" ? { type: "call", call: botCall(s, seat, r) } : { type: "play", card: botCard(s, seat, r) };
}
export function bot(s, pid, r) {
  if (s.over || s.seats[controller(s)] !== pid) return null;
  return botAction(s, s.cur, r);
}
export const auto = bot;
export function botDelay(s, pid, r) {
  return trickDelay(s.trick.length, s.phase === "play" && !!s.lastTrick, r);
}
