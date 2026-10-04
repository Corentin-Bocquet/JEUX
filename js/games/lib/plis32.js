// Mécanique commune des jeux de plis à 32 cartes et 4 joueurs en 2 équipes
// (belote, manille) : paquet, ordre et valeur des cartes, équipes, cartes
// jouables (fournir, couper, surcouper, monter), gagnant d'un pli, robots.
// Aucune dépendance au DOM : testable sous Node.
import { rankOf, suitOf, SUIT_SYM, SUIT_NAME } from "../cards.js";

export { rankOf, suitOf, SUIT_SYM, SUIT_NAME };
export const SUITS32 = ["S", "H", "C", "D"];
export const RANKS32 = ["7", "8", "9", "10", "J", "Q", "K", "A"];
export const deck32 = () => SUITS32.flatMap((s) => RANKS32.map((r) => r + s));
export const RANK_LONG = { 7: "Sept", 8: "Huit", 9: "Neuf", 10: "Dix", J: "Valet", Q: "Dame", K: "Roi", A: "As" };
export const cardName = (c) => `${RANK_LONG[rankOf(c)]} de ${SUIT_NAME[suitOf(c)].toLowerCase()}`;

// ---------------------------------------------------------------- table et équipes
// Les places tournent dans l'ordre 0, 1, 2, 3 ; les partenaires sont face à face.
export const NSEATS = 4;
export const nextSeat = (i, k = 1) => (i + k) % NSEATS;
export const teamOf = (i) => i % 2;
export const partnerOf = (i) => (i + 2) % NSEATS;

// Complète la table avec des robots internes quand il manque des joueurs.
// Ils jouent tout seuls dans reduce : le salon ne les connaît pas.
export function seatPlayers(players, rng) {
  const order = rng.shuffle(players.map((p) => p.id)).slice(0, NSEATS);
  const virt = [];
  for (let k = 1; order.length < NSEATS; k++) {
    const id = "@robot" + k;
    order.push(id);
    virt.push(id);
  }
  return { order, virt };
}

// ---------------------------------------------------------------- règles
// cfg = {
//   plain: ordre croissant hors atout, trumpOrder: ordre croissant à l'atout,
//   plainVal / trumpVal : points des cartes,
//   climb: "trump" (monter seulement à l'atout demandé, belote),
//          "opp" (monter sur un adversaire maître dans la couleur, manille), "none",
//   underTrump: true si l'on doit sous-couper quand on ne peut pas surcouper.
// }
export function makeRules(cfg) {
  const isTrump = (c, trump) => !!trump && suitOf(c) === trump;
  const rankPow = (c, trump) => (isTrump(c, trump) ? cfg.trumpOrder : cfg.plain).indexOf(rankOf(c));
  const value = (c, trump) => ((isTrump(c, trump) ? cfg.trumpVal : cfg.plainVal)[rankOf(c)] || 0);
  // force d'une carte dans un pli dont la couleur demandée est lead
  const power = (c, trump, lead) => (isTrump(c, trump) ? 100 + rankPow(c, trump) : suitOf(c) === lead ? rankPow(c, trump) : -1);
  const beats = (a, b, trump, lead) => power(a, trump, lead) > power(b, trump, lead);

  // pli = [{ p: place, c: carte }] ; renvoie l'entrée gagnante
  function winner(trick, trump) {
    const lead = suitOf(trick[0].c);
    let best = trick[0];
    for (const t of trick) if (beats(t.c, best.c, trump, lead)) best = t;
    return best;
  }
  const points = (cards, trump) => cards.reduce((n, c) => n + value(c, trump), 0);

  // cartes que la place me a le droit de jouer
  function legal(hand, trick, trump, me) {
    if (!trick.length) return hand.slice();
    const lead = suitOf(trick[0].c);
    const best = winner(trick, trump);
    const partnerMaster = best.p === partnerOf(me);
    const follow = hand.filter((c) => suitOf(c) === lead);
    if (follow.length) {
      const climbHere = cfg.climb === "trump" ? lead === trump : cfg.climb === "opp" ? !partnerMaster && suitOf(best.c) === lead : false;
      if (climbHere) {
        const higher = follow.filter((c) => beats(c, best.c, trump, lead));
        if (higher.length) return higher;
      }
      return follow;
    }
    const trumps = trump ? hand.filter((c) => suitOf(c) === trump) : [];
    if (!trumps.length || partnerMaster) return hand.slice();
    if (isTrump(best.c, trump)) {
      const over = trumps.filter((c) => beats(c, best.c, trump, lead));
      if (over.length) return over;
      return cfg.underTrump ? trumps : hand.slice();
    }
    return trumps;
  }

  // tri de la main pour l'affichage : atout à gauche, couleurs alternées, plus forte en premier
  function sortHand(hand, trump) {
    const suits = SUITS32.slice();
    if (trump) { suits.splice(suits.indexOf(trump), 1); suits.unshift(trump); }
    // éviter deux couleurs de même teinte côte à côte quand c'est possible
    const red = (s) => s === "H" || s === "D";
    const present = suits.filter((s) => hand.some((c) => suitOf(c) === s));
    const seq = [present.shift()].filter(Boolean);
    while (present.length) {
      const last = seq[seq.length - 1];
      const i = present.findIndex((s) => red(s) !== red(last));
      seq.push(present.splice(i < 0 ? 0 : i, 1)[0]);
    }
    return hand.slice().sort((a, b) => seq.indexOf(suitOf(a)) - seq.indexOf(suitOf(b)) || rankPow(b, trump) - rankPow(a, trump));
  }

  return { cfg, isTrump, rankPow, value, power, beats, winner, points, legal, sortHand };
}

// ---------------------------------------------------------------- robots
// Une carte est maîtresse si toutes les cartes plus fortes de sa couleur sont
// déjà tombées (ou dans ma main / dans le pli).
export function isMaster(R, c, trump, known) {
  const s = suitOf(c);
  const ord = R.isTrump(c, trump) ? R.cfg.trumpOrder : R.cfg.plain;
  const i = ord.indexOf(rankOf(c));
  for (let k = i + 1; k < ord.length; k++) if (!known.includes(ord[k] + s)) return false;
  return true;
}

// Atouts encore cachés (ni joués, ni dans ma main)
export const trumpsOut = (trump, known) => (trump ? RANKS32.filter((r) => !known.includes(r + trump)).length : 0);

// ctx = { hand, trick, trump, me, seen (cartes jouées dans la donne), level, rng, attack }
export function botCard(R, { hand, trick, trump, me, seen, level = 2, rng, attack = false }) {
  const legal = R.legal(hand, trick, trump, me);
  if (legal.length === 1) return legal[0];
  if (level <= 1 && rng && rng.next() < 0.3) return rng.pick(legal);
  const known = [...seen, ...hand, ...trick.map((t) => t.c)];
  const tr = (c) => (R.isTrump(c, trump) ? 1 : 0);
  // la plus petite : pas d'atout, peu de points, faible
  const cheap = (list) => list.slice().sort((a, b) => tr(a) - tr(b) || R.value(a, trump) - R.value(b, trump) || R.rankPow(a, trump) - R.rankPow(b, trump))[0];
  const master = (c) => level >= 2 && isMaster(R, c, trump, known);

  if (!trick.length) {
    const out = trumpsOut(trump, known);
    const myTrumps = legal.filter((c) => tr(c));
    // l'attaque fait tomber les atouts avec un atout maître
    if (attack && out > 0) {
      const top = myTrumps.filter(master).sort((a, b) => R.rankPow(b, trump) - R.rankPow(a, trump))[0];
      if (top) return top;
      if (level >= 3 && myTrumps.length >= 3) return cheap(myTrumps);
    }
    // une carte maîtresse hors atout qui rapporte
    const ms = legal.filter((c) => !tr(c) && master(c)).sort((a, b) => R.value(b, trump) - R.value(a, trump));
    if (ms.length && (out === 0 || R.value(ms[0], trump) > 0)) return ms[0];
    // sinon une petite carte, en évitant d'ouvrir sous un dix ou un as non maître
    const side = legal.filter((c) => !tr(c));
    const pool = side.length ? side : legal;
    const lows = pool.filter((c) => R.value(c, trump) <= 4);
    return cheap(lows.length ? lows : pool);
  }

  const lead = suitOf(trick[0].c);
  const best = R.winner(trick, trump);
  const last = trick.length === NSEATS - 1;
  const wins = legal.filter((c) => R.beats(c, best.c, trump, lead));
  if (best.p === partnerOf(me)) {
    // partenaire maître : on charge s'il est sûr de gagner, sinon on se défausse petit
    const safe = last || (master(best.c) && (tr(best.c) || !trump || trumpsOut(trump, known) === 0 || trick.length === 2));
    if (safe) {
      const give = legal.filter((c) => !tr(c)).sort((a, b) => R.value(b, trump) - R.value(a, trump) || R.rankPow(a, trump) - R.rankPow(b, trump));
      const notMaster = give.filter((c) => !master(c) || R.value(c, trump) >= 10);
      if (notMaster.length) return notMaster[0];
      if (give.length) return give[0];
    }
    return cheap(legal);
  }
  if (wins.length) {
    const byPow = wins.slice().sort((a, b) => R.power(a, trump, lead) - R.power(b, trump, lead));
    if (last) return byPow[0];
    // couper : le plus petit atout qui passe suffit
    if (tr(byPow[0]) && lead !== trump) return byPow[0];
    const sure = byPow.filter(master);
    if (sure.length) return sure[0];
    const stake = R.points(trick.map((t) => t.c), trump);
    if (stake >= 10) return byPow[byPow.length - 1];
    return cheap(legal);
  }
  return cheap(legal);
}
