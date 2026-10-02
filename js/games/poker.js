import { fail, rng as mkRng } from "../engine.js";
import { deck, rv, suitOf } from "./cards.js";

export const meta = {
  id: "poker", name: "Poker Texas Hold'em", short: "Poker", cat: "Cartes", min: 2, max: 8, turnTime: 40,
  color: "#0E7C4A", desc: "No Limit Hold'em : bluffe, relance, rafle tout.",
  rules: ["Chacun reçoit 2 cartes cachées, puis 5 cartes communes arrivent en 3 temps.",
    "À chaque tour d'enchères : passe, suis, relance ou couche-toi.",
    "La meilleure main de 5 cartes gagne le pot.",
    "Les blinds montent toutes les 6 mains. Le dernier avec des jetons gagne,",
    "ou le plus riche quand le nombre de mains prévu est atteint."],
};

// ------------------------------------------------ évaluation des mains
export const HAND_NAMES = ["Carte haute", "Paire", "Double paire", "Brelan", "Quinte", "Couleur", "Full", "Carré", "Quinte flush"];
const enc = (cat, ks) => ks.reduce((a, k, i) => a + k * 15 ** (4 - i), cat * 15 ** 5);

function straightHigh(vals) { // vals : valeurs distinctes triées décroissantes
  const v = vals.includes(14) ? [...vals, 1] : vals;
  for (let i = 0; i + 4 < v.length; i++) if (v[i] - v[i + 4] === 4) return v[i];
  return 0;
}

export function evaluate(cards) {
  const vals = cards.map(rv);
  const bySuit = {};
  cards.forEach((c, i) => (bySuit[suitOf(c)] = bySuit[suitOf(c)] || []).push(vals[i]));
  let flush = null;
  for (const s in bySuit) if (bySuit[s].length >= 5) flush = bySuit[s].sort((a, b) => b - a);
  if (flush) {
    const sf = straightHigh([...new Set(flush)]);
    if (sf) return enc(8, [sf, 0, 0, 0, 0]);
  }
  const cnt = {};
  vals.forEach((v) => (cnt[v] = (cnt[v] || 0) + 1));
  const groups = Object.entries(cnt).map(([v, n]) => [+v, n]).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const distinct = [...new Set(vals)].sort((a, b) => b - a);
  const kick = (excl, n) => distinct.filter((v) => !excl.includes(v)).slice(0, n);
  if (groups[0][1] === 4) return enc(7, [groups[0][0], ...kick([groups[0][0]], 1), 0, 0, 0]);
  if (groups[0][1] === 3 && groups[1] && groups[1][1] >= 2) return enc(6, [groups[0][0], groups[1][0], 0, 0, 0]);
  if (flush) return enc(5, flush.slice(0, 5));
  const st = straightHigh(distinct);
  if (st) return enc(4, [st, 0, 0, 0, 0]);
  if (groups[0][1] === 3) return enc(3, [groups[0][0], ...kick([groups[0][0]], 2), 0, 0]);
  if (groups[0][1] === 2 && groups[1] && groups[1][1] === 2) {
    const hi = groups[0][0], lo = groups[1][0];
    return enc(2, [hi, lo, ...kick([hi, lo], 1), 0, 0]);
  }
  if (groups[0][1] === 2) return enc(1, [groups[0][0], ...kick([groups[0][0]], 3), 0]);
  return enc(0, distinct.slice(0, 5));
}
export const handName = (score) => HAND_NAMES[Math.floor(score / 15 ** 5)];

// ------------------------------------------------ partie
export function setup(players, settings, rng) {
  const chips = {};
  const start = settings.chips || 1000;
  players.forEach((p) => (chips[p.id] = start));
  const s = { order: players.map((p) => p.id), chips, dealer: rng.int(players.length) - 1, sb: 10, bb: 20,
    handNo: 0, maxHands: settings.hands || 20, out: [], hand: null, last: null, over: false };
  if (s.dealer < 0) s.dealer = players.length - 1;
  startHand(s, rng.int(2 ** 32));
  return s;
}

const alive = (s) => s.order.filter((id) => s.chips[id] > 0);
const seatOf = (s, id) => s.order.indexOf(id);
function nextSeat(s, from, ok) {
  const n = s.order.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    if (ok(s.order[i])) return i;
  }
  return -1;
}

function startHand(s, seed) {
  const live = alive(s);
  if (live.length <= 1 || s.handNo >= s.maxHands) { s.over = true; s.hand = null; return; }
  s.handNo++;
  if (s.handNo > 1 && (s.handNo - 1) % 6 === 0) {
    s.sb = Math.round((s.sb * 1.5) / 10) * 10; s.bb = s.sb * 2;
  }
  const has = (id) => s.chips[id] > 0;
  s.dealer = nextSeat(s, s.dealer, has);
  const r = mkRng(seed);
  const dk = r.shuffle(deck());
  const h = { deck: dk, board: [], holes: {}, street: 0, folded: {}, allin: {}, bet: {}, contrib: {}, acted: {},
    toCall: 0, minRaise: s.bb, cur: -1, inHand: live.slice(), lastAct: null };
  s.hand = h;
  for (const id of live) { h.holes[id] = [dk.pop(), dk.pop()]; h.bet[id] = 0; h.contrib[id] = 0; }
  let sbSeat, bbSeat;
  if (live.length === 2) { sbSeat = s.dealer; bbSeat = nextSeat(s, s.dealer, has); }
  else { sbSeat = nextSeat(s, s.dealer, has); bbSeat = nextSeat(s, sbSeat, has); }
  h.sbId = s.order[sbSeat]; h.bbId = s.order[bbSeat];
  post(s, h.sbId, s.sb); post(s, h.bbId, s.bb);
  h.toCall = s.bb;
  h.cur = bbSeat;
  advance(s, seed);
}

function post(s, id, amt) {
  const h = s.hand, a = Math.min(amt, s.chips[id]);
  s.chips[id] -= a; h.bet[id] += a; h.contrib[id] += a;
  if (s.chips[id] === 0) h.allin[id] = true;
}

const inPlay = (h, id) => h.inHand.includes(id) && !h.folded[id];
const canAct = (s, id) => inPlay(s.hand, id) && !s.hand.allin[id];
const needs = (s, id) => canAct(s, id) && (!s.hand.acted[id] || s.hand.bet[id] < s.hand.toCall);

// passe au prochain joueur ou à la rue suivante
function advance(s, seed) {
  const h = s.hand;
  const still = h.inHand.filter((id) => !h.folded[id]);
  if (still.length === 1) return endHand(s, seed, still);
  const nxt = nextSeat(s, h.cur, (id) => needs(s, id));
  const actors = still.filter((id) => !h.allin[id]);
  if (nxt >= 0 && !(actors.length === 1 && h.bet[actors[0]] >= h.toCall)) { h.cur = nxt; return; }
  // rue terminée
  for (const id of h.inHand) h.bet[id] = 0;
  h.toCall = 0; h.minRaise = s.bb; h.acted = {};
  if (h.street === 3) return endHand(s, seed, still);
  h.street++;
  const n = h.street === 1 ? 3 : 1;
  for (let k = 0; k < n; k++) h.board.push(h.deck.pop());
  if (actors.length <= 1) { h.cur = -1; return advance2(s, seed); }
  h.cur = nextSeat(s, s.dealer, (id) => canAct(s, id));
}
// plus personne ne peut miser : on déroule le tableau jusqu'à la river
function advance2(s, seed) {
  const h = s.hand;
  while (h.board.length < 5) h.board.push(h.deck.pop());
  h.street = 3;
  endHand(s, seed, h.inHand.filter((id) => !h.folded[id]));
}

export function buildPots(h) {
  const contributors = h.inHand.filter((id) => h.contrib[id] > 0);
  const levels = [...new Set(contributors.map((id) => h.contrib[id]))].sort((a, b) => a - b);
  const pots = [];
  let prev = 0;
  for (const L of levels) {
    let amount = 0;
    for (const id of contributors) amount += Math.min(h.contrib[id], L) - Math.min(h.contrib[id], prev);
    const elig = h.inHand.filter((id) => !h.folded[id] && h.contrib[id] >= L);
    if (amount > 0) {
      if (elig.length) pots.push({ amount, elig });
      else if (pots.length) pots[pots.length - 1].amount += amount;
    }
    prev = L;
  }
  // fusionne les pots qui ont les mêmes ayants droit
  const merged = [];
  for (const p of pots) {
    const last = merged[merged.length - 1];
    if (last && last.elig.join() === p.elig.join()) last.amount += p.amount; else merged.push({ ...p });
  }
  return merged;
}

function endHand(s, seed, still) {
  const h = s.hand;
  const won = {};
  const shown = {};
  const pots = buildPots(h);
  const startChips = {};
  for (const id of h.inHand) startChips[id] = s.chips[id] + h.contrib[id];
  if (still.length === 1) {
    const total = pots.reduce((t, p) => t + p.amount, 0);
    won[still[0]] = total;
    s.chips[still[0]] += total;
  } else {
    const score = {};
    for (const id of still) {
      score[id] = evaluate([...h.holes[id], ...h.board]);
      shown[id] = { cards: h.holes[id], name: handName(score[id]) };
    }
    for (const p of pots) {
      const best = Math.max(...p.elig.map((id) => score[id]));
      // ordre de distribution des jetons restants : à partir de la gauche du donneur
      const winners = [];
      for (let k = 1; k <= s.order.length; k++) {
        const id = s.order[(s.dealer + k) % s.order.length];
        if (p.elig.includes(id) && score[id] === best) winners.push(id);
      }
      const share = Math.floor(p.amount / winners.length);
      let rest = p.amount - share * winners.length;
      for (const id of winners) {
        const g = share + (rest-- > 0 ? 1 : 0);
        s.chips[id] += g; won[id] = (won[id] || 0) + g;
      }
      p.winners = winners;
    }
  }
  s.last = { handNo: s.handNo, board: h.board.slice(), won, shown, pots: pots.map((p) => ({ amount: p.amount, winners: p.winners || still })),
    folded: still.length === 1 };
  // éliminés : le plus gros tapis de départ est mieux classé
  const busted = h.inHand.filter((id) => s.chips[id] === 0).sort((a, b) => startChips[a] - startChips[b]);
  for (const id of busted) s.out.push(id);
  startHand(s, (seed * 31 + 7) >>> 0);
}

export function toAct(s) {
  if (s.over || !s.hand || s.hand.cur < 0) return [];
  return [s.order[s.hand.cur]];
}

export function legal(s, id) {
  const h = s.hand;
  const owe = h.toCall - h.bet[id];
  const stack = s.chips[id];
  const maxTo = h.bet[id] + stack;
  const canRaise = !h.acted[id] && maxTo > h.toCall;
  const minTo = Math.min(maxTo, h.toCall + h.minRaise);
  return { owe: Math.min(owe, stack), check: owe <= 0, canRaise, minTo, maxTo, pot: potTotal(s) };
}
export const potTotal = (s) => (s.hand ? Object.values(s.hand.contrib).reduce((a, b) => a + b, 0) : 0);

export function reduce(s, pid, a) {
  if (toAct(s)[0] !== pid) fail("Ce n'est pas ton tour");
  const h = s.hand;
  const L = legal(s, pid);
  const seed = a.seed || 1;
  if (a.type === "fold") {
    h.folded[pid] = true;
  } else if (a.type === "check") {
    if (!L.check) fail("Tu dois suivre ou te coucher");
    h.acted[pid] = true;
  } else if (a.type === "call") {
    if (L.check) fail("Rien à suivre : passe");
    const amt = L.owe;
    s.chips[pid] -= amt; h.bet[pid] += amt; h.contrib[pid] += amt;
    if (s.chips[pid] === 0) h.allin[pid] = true;
    h.acted[pid] = true;
  } else if (a.type === "raise") {
    if (!L.canRaise) fail("Tu ne peux plus relancer");
    const to = Math.floor(a.to);
    if (!(to <= L.maxTo)) fail("Pas assez de jetons");
    if (to < L.minTo) fail(`Relance minimale : ${L.minTo}`);
    const add = to - h.bet[pid];
    s.chips[pid] -= add; h.bet[pid] = to; h.contrib[pid] += add;
    if (s.chips[pid] === 0) h.allin[pid] = true;
    const size = to - h.toCall;
    if (size >= h.minRaise) { h.minRaise = size; h.acted = {}; }
    h.toCall = Math.max(h.toCall, to);
    h.acted[pid] = true;
  } else fail("Action inconnue");
  h.lastAct = { id: pid, t: a.type, to: h.bet[pid] };
  advance(s, seed);
  return s;
}

export function result(s) {
  if (!s.over) return null;
  const live = alive(s).sort((a, b) => s.chips[b] - s.chips[a]);
  const ranking = [];
  let rank = 0, prev = null;
  live.forEach((id, i) => {
    if (s.chips[id] !== prev) { rank = i + 1; prev = s.chips[id]; }
    ranking.push({ id, rank, score: s.chips[id] });
  });
  const outRev = s.out.slice().reverse();
  outRev.forEach((id, i) => ranking.push({ id, rank: live.length + i + 1, score: 0 }));
  return { ranking };
}

// ------------------------------------------------ robot
export function equity(hole, board, nOpp, rng, sims = 150) {
  const known = new Set([...hole, ...board]);
  const rest = deck().filter((c) => !known.has(c));
  let win = 0;
  for (let k = 0; k < sims; k++) {
    const d = rng.shuffle(rest);
    let p = 0;
    const b = board.concat(d.slice(0, 5 - board.length));
    p = 5 - board.length;
    const mine = evaluate([...hole, ...b]);
    let best = true, tie = 0;
    for (let o = 0; o < nOpp; o++) {
      const sc = evaluate([d[p++], d[p++], ...b]);
      if (sc > mine) { best = false; break; }
      if (sc === mine) tie++;
    }
    if (best) win += tie ? 1 / (tie + 1) : 1;
  }
  return win / sims;
}

function preflopStrength(hole) {
  const [a, b] = hole.map(rv).sort((x, y) => y - x);
  const suited = suitOf(hole[0]) === suitOf(hole[1]);
  let sc = a * 1.6 + b;
  if (a === b) sc += 18 + a;
  if (suited) sc += 4;
  if (a - b === 1) sc += 3;
  return Math.min(1, sc / 58);
}

export function bot(s, pid, rng) {
  const h = s.hand, L = legal(s, pid);
  const opp = h.inHand.filter((id) => id !== pid && !h.folded[id]).length;
  const eq = h.board.length ? equity(h.holes[pid], h.board, Math.min(opp, 3), rng, 120) : preflopStrength(h.holes[pid]) * (opp > 2 ? 0.8 : 1);
  const pot = L.pot;
  const odds = L.owe > 0 ? L.owe / (pot + L.owe) : 0;
  const bluff = rng.next() < 0.07;
  const strong = eq > 0.72 || (h.board.length && eq > 0.6 && opp <= 1);
  if ((strong || bluff) && L.canRaise) {
    const target = h.toCall + Math.max(L.minTo - h.toCall, Math.round((pot * (0.5 + rng.next() * 0.5)) / 10) * 10);
    return { type: "raise", to: Math.max(L.minTo, Math.min(L.maxTo, target)) };
  }
  if (L.check) return { type: "check" };
  if (eq >= odds * 1.1 || (L.owe <= s.bb && eq > 0.3)) return { type: "call" };
  return { type: "fold" };
}
export function auto(s, pid) {
  return legal(s, pid).check ? { type: "check" } : { type: "fold" };
}
export { seatOf };
