// Belote à 4 joueurs en 2 équipes : belote classique (prise à la retourne)
// ou belote coinchée simple (annonces de 80 à 160). Logique pure, sans DOM.
import { fail, rankByScore, rng as mkRng } from "../engine.js";
import { deck32, makeRules, seatPlayers, nextSeat, teamOf, partnerOf, botCard, rankOf, suitOf, SUITS32, SUIT_NAME } from "./lib/plis32.js";

export const meta = {
  id: "belote", name: "Belote", cat: "Cartes", min: 4, max: 4, turnTime: 30,
  color: "#9F1239", desc: "Le grand classique des cafés : prends, coupe, belote et rebelote !",
  rules: [
    "4 joueurs en 2 équipes : ton partenaire est en face de toi. Il manque du monde ? Des robots complètent la table.",
    "32 cartes. À l'atout : Valet (20), 9 (14), As (11), 10 (10), Roi (4), Dame (3), 8 et 7 (0). Ailleurs : As (11), 10 (10), Roi (4), Dame (3), Valet (2), 9, 8, 7 (0).",
    "Classique : chacun reçoit 5 cartes et une carte est retournée. Au 1er tour, on peut prendre dans la couleur retournée ; au 2e tour, dans une autre couleur. Le preneur ramasse la retourne, puis la donne se complète à 8 cartes.",
    "Coinchée : 8 cartes chacun, puis on annonce un contrat de 80 à 160 points dans une couleur. Un adversaire peut coincher (points doublés), le preneur peut alors surcoincher (quadruplés).",
    "Il faut fournir la couleur demandée. À l'atout, il faut monter si tu peux. Sans la couleur, tu dois couper, et surcouper si un adversaire a coupé, sauf si ton partenaire est maître du pli.",
    "Roi et Dame d'atout dans la même main : belote et rebelote, 20 points pour ton équipe quoi qu'il arrive. Le dernier pli vaut 10 points de plus (dix de der).",
    "Le preneur doit faire plus de points que la défense. Sinon il est dedans : la défense marque 162. À égalité, c'est le litige : ses points vont au gagnant de la donne suivante. Tous les plis : capot, 250 points.",
    "La première équipe à atteindre le score fixé (1000 ou 500) gagne la partie.",
  ],
};

// ------------------------------------------------ réglages
export const options = [
  { key: "target", label: "Partie en", icon: "🏁", values: [[1000, "1000 pts", "Partie classique"], [500, "500 pts", "Partie rapide"]], def: 1000 },
  { key: "variant", label: "Variante", icon: "🃏", values: [["classique", "Classique", "À la retourne"], ["coinche", "Coinchée", "Annonces 80 à 160"]], def: "classique" },
  { key: "under", label: "Sous-couper", icon: "🔻", values: [[true, "Obligé", "Règle officielle"], [false, "Libre", "Défausse permise"]], def: true },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "🃏", desc: "Belote à la retourne, partie en 1000 points.", set: { target: 1000, variant: "classique", under: true } },
  { id: "rapide", name: "Partie rapide", emoji: "⚡", desc: "Belote à la retourne, la première équipe à 500 points gagne.", set: { target: 500, variant: "classique", under: true } },
  { id: "coinche", name: "Coinche", emoji: "📣", desc: "Annonce ton contrat de 80 à 160, coinche et surcoinche.", set: { target: 1000, variant: "coinche", under: true } },
  { id: "amis", name: "Coinche entre amis", emoji: "🍻", desc: "Coinche en 500 points, sans obligation de sous-couper.", set: { target: 500, variant: "coinche", under: false } },
];
export function opt(settings, key) {
  const o = options.find((x) => x.key === key);
  const v = settings ? settings[key] : undefined;
  const hit = o.values.find((x) => String(x[0]) === String(v));
  return hit ? hit[0] : o.def;
}

// ------------------------------------------------ cartes
const CFG = {
  plain: ["7", "8", "9", "J", "Q", "K", "10", "A"],
  trumpOrder: ["7", "8", "Q", "K", "10", "A", "9", "J"],
  plainVal: { A: 11, 10: 10, K: 4, Q: 3, J: 2 },
  trumpVal: { J: 20, 9: 14, A: 11, 10: 10, K: 4, Q: 3 },
  climb: "trump",
};
export const RULES = makeRules({ ...CFG, underTrump: true });
const RULES_FREE = makeRules({ ...CFG, underTrump: false });
export const rulesOf = (s) => (s.under === false ? RULES_FREE : RULES);
export const BIDS = [80, 90, 100, 110, 120, 130, 140, 150, 160];
const MAX_DEALS = 300;

// ------------------------------------------------ donne
export function setup(players, settings, rng) {
  const { order, virt } = seatPlayers(players, rng);
  const lv = Number(settings && settings.level);
  const s = {
    order, virt, variant: opt(settings, "variant"), target: opt(settings, "target"), under: opt(settings, "under"),
    level: [1, 2, 3].includes(lv) ? lv : 2,
    scores: [0, 0], deal: 0, dealer: rng.int(4), litige: 0, winner: null, lastDeal: null, lastTrick: null,
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
  const give = (n) => { for (let k = 0; k < 4; k++) hands[nextSeat(first, k)].push(...d.splice(0, n)); };
  Object.assign(s, {
    hands, first, cur: first, leader: first, trick: [], tricks: [0, 0], pts: [0, 0], seen: [], bids: [],
    trump: null, taker: null, contract: 0, mult: 1, bid: null, passes: 0, beloteBy: null, belote: 0, lastPlay: null,
    turned: null, stock: [],
  });
  if (s.variant === "coinche") {
    give(3); give(2); give(3);
    s.phase = "auction";
  } else {
    give(3); give(2);
    s.turned = d.shift();
    s.stock = d;
    s.phase = "bid1";
  }
}

// le preneur ramasse la retourne, la donne se complète à 8 cartes
function completeDeal(s) {
  s.hands[s.taker].push(s.turned);
  for (let k = 0; k < 4; k++) {
    const p = nextSeat(s.first, k);
    s.hands[p].push(...s.stock.splice(0, p === s.taker ? 2 : 3));
  }
  s.turned = null;
  startPlay(s);
}

function startPlay(s) {
  s.phase = "play";
  s.cur = s.leader = s.first;
  s.trick = [];
  s.lastTrick = null;
  const k = "K" + s.trump, q = "Q" + s.trump;
  const who = s.hands.findIndex((h) => h.includes(k) && h.includes(q));
  s.beloteBy = who >= 0 ? who : null;
}

function redeal(s, seed) {
  s.lastDeal = { n: s.deal, redeal: true };
  s.dealer = nextSeat(s.dealer);
  if (s.deal >= MAX_DEALS) { finish(s); return; }
  newDeal(s, mkRng(seed));
}

// ------------------------------------------------ fin de donne et score
export function scoreDeal(s) {
  const T = teamOf(s.taker), D = 1 - T;
  const bel = [0, 0];
  if (s.beloteBy != null && s.belote >= 2) bel[teamOf(s.beloteBy)] = 20;
  const card = s.pts.slice();
  const capot = s.tricks[T] === 8 ? T : s.tricks[D] === 8 ? D : null;
  if (capot != null) { card[capot] = 250; card[1 - capot] = 0; }
  const got = [0, 0];
  let made;
  if (s.variant === "coinche") {
    const att = card[T] + bel[T], def = card[D] + bel[D];
    made = att >= s.contract && att > def;
    if (made) {
      got[T] = s.contract * s.mult + card[T] + bel[T];
      got[D] = (s.mult > 1 ? 0 : card[D]) + bel[D];
    } else {
      got[D] = 160 + s.contract * s.mult + bel[D];
      got[T] = bel[T];
    }
  } else {
    const att = card[T] + bel[T], def = card[D] + bel[D];
    if (att > def) {
      made = true;
      got[T] = att; got[D] = def;
    } else if (att === def) {
      made = "litige";
      got[D] = def; got[T] = bel[T];
    } else {
      made = false;
      got[D] = (capot === D ? 250 : 162) + bel[D]; got[T] = bel[T];
    }
  }
  return { T, bel, card, capot, got, made };
}

function endDeal(s, seed) {
  const r = scoreDeal(s);
  const pending = s.litige;
  let litigeTo = null;
  if (r.made === "litige") s.litige += r.card[r.T];
  else if (pending) {
    litigeTo = r.made ? r.T : 1 - r.T;
    r.got[litigeTo] += pending;
    s.litige = 0;
  }
  s.scores[0] += r.got[0];
  s.scores[1] += r.got[1];
  s.lastDeal = { n: s.deal, taker: s.taker, trump: s.trump, contract: s.contract, mult: s.mult, made: r.made, capot: r.capot,
    card: r.card, bel: r.bel, got: r.got, litige: r.made === "litige" ? s.litige : 0, litigeTo, litigePts: litigeTo != null ? pending : 0 };
  s.dealer = nextSeat(s.dealer);
  const top = Math.max(...s.scores);
  if ((top >= s.target && s.scores[0] !== s.scores[1]) || s.deal >= MAX_DEALS) { finish(s); return; }
  newDeal(s, mkRng(seed));
}

function finish(s) {
  s.phase = "over";
  s.winner = s.scores[0] >= s.scores[1] ? 0 : 1;
}

// ------------------------------------------------ actions
export function toAct(s) {
  if (s.phase === "over") return [];
  return [s.order[s.cur]];
}

export const legalCards = (s, seat) => rulesOf(s).legal(s.hands[seat], s.trick, s.trump, seat);

function step(s, seat, a, seed) {
  const t = a && a.type;
  if (s.phase === "bid1" || s.phase === "bid2") {
    if (t === "pass") {
      s.bids.push({ p: seat, t: "pass" });
      s.cur = nextSeat(seat);
      if (s.bids.length === 4) { s.phase = "bid2"; s.cur = s.first; }
      else if (s.bids.length === 8) redeal(s, seed);
      return;
    }
    if (t === "take") {
      const ts = suitOf(s.turned);
      const suit = s.phase === "bid1" ? ts : a.suit;
      if (s.phase === "bid1" && a.suit && a.suit !== ts) fail("Au premier tour, tu ne peux prendre qu'à la couleur retournée");
      if (!SUITS32.includes(suit)) fail("Choisis une couleur");
      if (s.phase === "bid2" && suit === ts) fail("Au deuxième tour, choisis une autre couleur que la retourne");
      s.bids.push({ p: seat, t: "take", s: suit });
      s.trump = suit;
      s.taker = seat;
      completeDeal(s);
      return;
    }
    fail("Prends ou passe");
  }
  if (s.phase === "auction") {
    if (t === "pass") {
      s.bids.push({ p: seat, t: "pass" });
      s.passes++;
      s.cur = nextSeat(seat);
      if (!s.bid && s.passes >= 4) redeal(s, seed);
      else if (s.bid && s.passes >= 3) closeAuction(s);
      return;
    }
    if (t === "bid") {
      const v = Number(a.v);
      if (!BIDS.includes(v)) fail("Annonce de 80 à 160, par dizaines");
      if (s.bid && v <= s.bid.v) fail("Annonce plus haut que " + s.bid.v);
      if (!SUITS32.includes(a.suit)) fail("Choisis une couleur");
      s.bid = { v, suit: a.suit, p: seat };
      s.bids.push({ p: seat, t: "bid", v, s: a.suit });
      s.passes = 0;
      s.cur = nextSeat(seat);
      return;
    }
    if (t === "coinche") {
      if (!s.bid) fail("Rien à coincher");
      if (teamOf(s.bid.p) === teamOf(seat)) fail("Tu ne peux pas coincher ton équipe");
      s.bids.push({ p: seat, t: "coinche" });
      s.mult = 2;
      s.phase = "surco";
      s.cur = s.bid.p;
      return;
    }
    fail("Annonce, coinche ou passe");
  }
  if (s.phase === "surco") {
    if (t === "surco") { s.mult = 4; s.bids.push({ p: seat, t: "surco" }); closeAuction(s); return; }
    if (t === "pass") { closeAuction(s); return; }
    fail("Surcoinche ou passe");
  }
  if (s.phase === "play") {
    if (t !== "play") fail("Joue une carte");
    const hand = s.hands[seat];
    const i = hand.indexOf(a.card);
    if (i < 0) fail("Carte absente");
    const R = rulesOf(s);
    if (!R.legal(hand, s.trick, s.trump, seat).includes(a.card)) fail(illegalWhy(s, seat, a.card));
    hand.splice(i, 1);
    s.trick.push({ p: seat, c: a.card });
    let say = null;
    if (seat === s.beloteBy && suitOf(a.card) === s.trump && (rankOf(a.card) === "K" || rankOf(a.card) === "Q")) {
      s.belote++;
      say = s.belote === 1 ? "Belote" : "Rebelote";
    }
    s.lastPlay = { p: seat, c: a.card, say };
    if (s.trick.length < 4) { s.cur = nextSeat(seat); return; }
    const w = R.winner(s.trick, s.trump).p;
    const tm = teamOf(w);
    s.tricks[tm]++;
    s.pts[tm] += R.points(s.trick.map((x) => x.c), s.trump);
    s.seen.push(...s.trick.map((x) => x.c));
    s.lastTrick = { cards: s.trick, w };
    s.trick = [];
    s.cur = s.leader = w;
    if (!s.hands[w].length) {
      s.pts[tm] += 10;
      endDeal(s, seed);
    }
    return;
  }
  fail("La partie est terminée");
}

function closeAuction(s) {
  s.trump = s.bid.suit;
  s.taker = s.bid.p;
  s.contract = s.bid.v;
  startPlay(s);
}

function illegalWhy(s, seat, card) {
  const lead = suitOf(s.trick[0].c);
  const hand = s.hands[seat];
  if (suitOf(card) !== lead && hand.some((c) => suitOf(c) === lead)) return `Tu dois fournir à ${SUIT_NAME[lead].toLowerCase()}`;
  if (suitOf(card) === s.trump || lead === s.trump) return "Tu dois monter à l'atout";
  return "Tu dois couper à l'atout";
}

// les robots internes (places vides) jouent aussitôt
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
  runVirtual(s, mkRng(seed ^ 0x2c1b3c6d));
  return s;
}

export function result(s) {
  if (s.phase !== "over") return null;
  const real = s.order.filter((id) => !s.virt.includes(id));
  const teams = [0, 1].map((t) => real.filter((id) => teamOf(s.order.indexOf(id)) === t)).filter((t) => t.length);
  return { ranking: rankByScore(real.map((id) => ({ id, score: s.scores[teamOf(s.order.indexOf(id))] }))), teams };
}

// ------------------------------------------------ robots
const TV = { J: 28, 9: 20, A: 12, 10: 10, K: 6, Q: 6, 8: 4, 7: 4 };
// force d'une main si l'atout était t (cartes = celles connues au moment d'annoncer)
export function handStrength(cards, t) {
  let e = 0, nt = 0;
  for (const c of cards) {
    const r = rankOf(c);
    if (suitOf(c) === t) { e += TV[r]; nt++; continue; }
    if (r === "A") e += 12;
    else if (r === "10") e += cards.includes("A" + suitOf(c)) ? 8 : 2;
    else if (r === "K") e += 1;
  }
  if (nt >= 3) e += 4 * (nt - 2);
  if (!cards.some((c) => suitOf(c) === t && rankOf(c) === "J") && nt < 4) e -= 8;
  return e;
}

function bidBot(s, seat, rng) {
  const hand = s.hands[seat];
  const lv = s.level;
  const noise = lv === 1 ? rng.int(17) - 8 : lv === 2 ? rng.int(7) - 3 : 0;
  if (s.phase === "bid1") {
    const t = suitOf(s.turned);
    return handStrength([...hand, s.turned], t) + noise >= 50 ? { type: "take" } : { type: "pass" };
  }
  if (s.phase === "bid2") {
    const ts = suitOf(s.turned);
    const best = SUITS32.filter((t) => t !== ts).map((t) => [t, handStrength([...hand, s.turned], t)]).sort((a, b) => b[1] - a[1])[0];
    // le dernier à parler se force un peu pour éviter de redonner sans fin
    const lastWord = s.bids.length === 7 ? 6 : 0;
    return best[1] + noise + lastWord >= 54 ? { type: "take", suit: best[0] } : { type: "pass" };
  }
  if (s.phase === "surco") {
    return handStrength(hand, s.bid.suit) + noise >= s.contract + 10 ? { type: "surco" } : { type: "pass" };
  }
  // enchères coinchées
  const cur = s.bid;
  if (cur && teamOf(cur.p) !== teamOf(seat)) {
    // défense solide contre un gros contrat : on coinche
    const tr = hand.filter((c) => suitOf(c) === cur.suit);
    const def = tr.reduce((n, c) => n + ({ J: 25, 9: 15, A: 8, 10: 6 }[rankOf(c)] || 3), 0) + hand.filter((c) => rankOf(c) === "A" && suitOf(c) !== cur.suit).length * 10;
    if (lv >= 2 && cur.v >= 100 && def + noise >= 24 + (160 - cur.v) / 2) return { type: "coinche" };
  }
  const floor10 = (x) => Math.floor(x / 10) * 10;
  let best = null;
  for (const t of SUITS32) {
    let max = floor10(handStrength(hand, t) + 17 + noise);
    if (cur && cur.p === partnerOf(seat)) {
      if (t !== cur.suit) continue;
      // soutien du partenaire : on monte d'un cran avec de quoi l'aider
      const sup = hand.reduce((n, c) => n + (suitOf(c) === t ? ({ J: 20, 9: 14, A: 6 }[rankOf(c)] || 2) : rankOf(c) === "A" ? 10 : 0), 0);
      max = sup >= 30 ? cur.v + 20 : sup >= 20 ? cur.v + 10 : 0;
    }
    if (!best || max > best[1]) best = [t, max];
  }
  const need = cur ? cur.v + 10 : 80;
  if (best && best[1] >= need && need <= 160) return { type: "bid", v: Math.min(160, need), suit: best[0] };
  return { type: "pass" };
}

export function bot(s, pid, rng) {
  const seat = s.order.indexOf(pid);
  if (seat < 0 || s.phase === "over") return null;
  if (s.phase !== "play") return bidBot(s, seat, rng);
  const card = botCard(rulesOf(s), {
    hand: s.hands[seat], trick: s.trick, trump: s.trump, me: seat, seen: s.seen, level: s.level, rng,
    attack: teamOf(seat) === teamOf(s.taker),
  });
  return { type: "play", card };
}
export const auto = bot;

// temps de réflexion : on laisse voir le pli ramassé et le résumé de la donne
export function botDelay(s, pid, rng) {
  if (s.phase === "play" && !s.trick.length && s.lastTrick) return 1500 + rng.int(300);
  if (s.phase !== "play" && !s.bids.length && s.lastDeal) return 2600;
  return 600 + rng.int(700);
}
