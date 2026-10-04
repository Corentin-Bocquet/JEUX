import { fail, rankByScore, rng as mkRng } from "../engine.js";

export const meta = {
  id: "rami", name: "Rami", cat: "Cartes", min: 2, max: 4, turnTime: 60,
  color: "#0F766E", desc: "Pose tes suites et tes brelans, vide ta main le premier.",
  rules: ["On joue avec deux jeux de 52 cartes et des jokers. Chacun reçoit 13 cartes (ou 14).",
    "À ton tour : pioche une carte (dans la pioche ou sur la défausse), pose ce que tu peux, puis défausse une carte.",
    "Combinaisons : suite d'au moins 3 cartes qui se suivent dans la même couleur (l'As se place avant le 2 ou après le Roi), ou brelan/carré de même valeur dans des couleurs différentes.",
    "Le joker remplace n'importe quelle carte. Une combinaison garde au moins 2 vraies cartes.",
    "Ta première pose doit valoir au moins 51 points (figures 10, As 11 ou 1 au début d'une suite, joker = la carte qu'il remplace).",
    "Une fois ouvert, tu peux compléter n'importe quelle combinaison posée et récupérer un joker en posant à sa place la carte qu'il remplace.",
    "Tu ne peux pas rejeter tout de suite la carte prise sur la défausse.",
    "Le premier qui n'a plus de cartes gagne. Les autres comptent leur main : figures 10, As 11, joker 20.",
    "Options : cartes distribuées, minimum d'ouverture, nombre de jokers, une manche ou course aux points (le moins chargé gagne quand quelqu'un dépasse le seuil)."],
};

// ------------------------------------------------ réglages
export const options = [
  { key: "cards", label: "Cartes", icon: "🖐️", values: [[13, "13", "Classique"], [14, "14", "Main plus large"]], def: 13 },
  { key: "open", label: "Ouverture", icon: "🚪",
    values: [[51, "51 pts", "Règle classique"], [30, "30 pts", "Plus facile"], [0, "Libre", "Pose dès le début"]], def: 51 },
  { key: "jokers", label: "Jokers", icon: "🃏", values: [[4, "4", "Deux par jeu"], [2, "2", "Un par jeu"], [0, "Aucun", "Cartes franches"]], def: 4 },
  { key: "target", label: "Fin de partie", icon: "🏁",
    values: [[0, "1 manche", "Premier vidé"], [100, "100 pts", "Course aux points"], [200, "200 pts", "Partie longue"]], def: 0 },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "🃏", desc: "13 cartes, ouverture à 51 points, 4 jokers, une manche.",
    set: { cards: 13, open: 51, jokers: 4, target: 0 } },
  { id: "course", name: "Course à 100", emoji: "🏁", desc: "Plusieurs manches : tes cartes restantes comptent contre toi.",
    set: { cards: 13, open: 51, jokers: 4, target: 100 } },
  { id: "decouverte", name: "Découverte", emoji: "🌱", desc: "14 cartes et pose libre dès le premier tour.",
    set: { cards: 14, open: 0, jokers: 4, target: 0 } },
  { id: "puriste", name: "Puriste", emoji: "🎩", desc: "Sans joker : uniquement des combinaisons franches.",
    set: { cards: 13, open: 51, jokers: 0, target: 0 } },
];
export function opt(settings, key) {
  const o = options.find((x) => x.key === key);
  const v = settings ? settings[key] : undefined;
  const hit = o.values.find((x) => x[0] === v || (v != null && String(x[0]) === String(v)));
  return hit ? hit[0] : o.def;
}

// ------------------------------------------------ cartes
export const JOKER = "JK";
export const SUITS = ["S", "H", "D", "C"];
const RANK_N = { A: 1, J: 11, Q: 12, K: 13 };
export const isJ = (c) => c === JOKER;
export const suitOf = (c) => c.slice(-1);
export const rankN = (c) => { const r = c.slice(0, -1); return RANK_N[r] || +r; };
const RANK_S = { 1: "A", 11: "J", 12: "Q", 13: "K", 14: "A" };
export const cardOf = (r, s) => (RANK_S[r] || String(r)) + s;

// points d'une carte restée en main
export function penalty(c) {
  if (isJ(c)) return 20;
  const r = rankN(c);
  if (r === 1) return 11;
  return r >= 11 ? 10 : r;
}
// valeur d'une position dans une combinaison (1 = As bas, 14 = As haut)
const posVal = (r) => (r === 1 ? 1 : r === 14 ? 11 : r >= 11 ? 10 : r);
const setVal = (r) => (r === 1 ? 11 : r >= 11 ? 10 : r);

export function meldPoints(m) {
  if (m.t === "set") return m.c.length * setVal(m.r);
  return m.c.reduce((t, _, i) => t + posVal(m.lo + i), 0);
}

// suite : fixed = [[rang, carte]] déjà placées (jokers compris), puis nouvelles cartes
function makeRun(fixed, cards) {
  const nat = cards.filter((c) => !isJ(c));
  let jok = cards.length - nat.length;
  const suits = new Set([...fixed.filter(([, c]) => !isJ(c)).map(([, c]) => suitOf(c)), ...nat.map(suitOf)]);
  if (suits.size !== 1) return null;
  const s = [...suits][0];
  const aces = nat.filter((c) => rankN(c) === 1).length;
  let best = null;
  for (let mask = 0; mask < 1 << aces; mask++) {
    const occ = {};
    let ok = true;
    for (const [r, c] of fixed) { if (occ[r]) ok = false; occ[r] = c; }
    let k = 0;
    for (const c of nat) {
      let r = rankN(c);
      if (r === 1) { if (mask & (1 << k)) r = 14; k++; }
      if (occ[r]) ok = false;
      occ[r] = c;
    }
    if (!ok) continue;
    const rs = Object.keys(occ).map(Number);
    let lo = Math.min(...rs), hi = Math.max(...rs);
    let j = jok;
    for (let r = lo; r <= hi; r++) if (!occ[r]) { if (!j) { ok = false; break; } occ[r] = JOKER; j--; }
    if (!ok) continue;
    while (j > 0 && hi < 14) { occ[++hi] = JOKER; j--; }
    while (j > 0 && lo > 1) { occ[--lo] = JOKER; j--; }
    if (j > 0 || hi - lo + 1 > 13) continue;
    const m = { t: "run", s, lo, c: [] };
    for (let r = lo; r <= hi; r++) m.c.push(occ[r]);
    if (!best || meldPoints(m) > meldPoints(best)) best = m;
  }
  return best;
}

function makeSet(existing, cards) {
  const all = existing.concat(cards);
  const nat = all.filter((c) => !isJ(c));
  if (!nat.length || all.length > 4) return null;
  const r = rankN(nat[0]);
  if (nat.some((c) => rankN(c) !== r)) return null;
  if (new Set(nat.map(suitOf)).size !== nat.length) return null;
  return { t: "set", r, c: all };
}

// combinaison posée à partir de cartes de la main (null si invalide)
export function analyze(cards) {
  if (!Array.isArray(cards) || cards.length < 3) return null;
  if (cards.filter((c) => !isJ(c)).length < 2) return null;
  return makeSet([], cards) || makeRun([], cards);
}

// ajoute des cartes à une combinaison posée (null si impossible)
export function extend(m, cards) {
  if (!cards.length) return null;
  if (m.t === "set") return makeSet(m.c, cards);
  return makeRun(m.c.map((c, i) => [m.lo + i, c]), cards);
}

// index du joker que la carte peut remplacer (-1 sinon)
export function swapIndex(m, card) {
  if (isJ(card)) return -1;
  if (m.t === "set") {
    if (rankN(card) !== m.r) return -1;
    if (m.c.some((c) => !isJ(c) && suitOf(c) === suitOf(card))) return -1;
    return m.c.indexOf(JOKER);
  }
  if (suitOf(card) !== m.s) return -1;
  const r = rankN(card);
  return m.c.findIndex((c, i) => isJ(c) && (m.lo + i === r || (r === 1 && m.lo + i === 14)));
}

// ------------------------------------------------ partie
function removeCards(hand, cards) {
  const h = hand.slice();
  for (const c of cards) {
    const i = h.indexOf(c);
    if (i < 0) return null;
    h.splice(i, 1);
  }
  return h;
}

export function fullDeck(jokers) {
  const d = [];
  for (let k = 0; k < 2; k++) for (const s of SUITS) for (let r = 1; r <= 13; r++) d.push(cardOf(r, s));
  for (let k = 0; k < jokers; k++) d.push(JOKER);
  return d;
}

function deal(s, rng) {
  const stock = rng.shuffle(fullDeck(s.jokers));
  s.hands = {};
  for (let k = 0; k < s.order.length; k++) s.hands[s.order[(s.first + k) % s.order.length]] = stock.splice(0, s.cards);
  // la première carte retournée n'est pas un joker
  const i = stock.findIndex((c) => !isJ(c));
  s.discard = [stock.splice(i, 1)[0]];
  s.stock = stock;
  s.melds = [];
  s.opened = Object.fromEntries(s.order.map((id) => [id, false]));
  s.cur = s.first; s.phase = "draw"; s.took = null; s.reshuf = 0; s.log = null;
}

export function setup(players, settings, rng) {
  const order = rng.shuffle(players.map((p) => p.id));
  const s = { order, cards: opt(settings, "cards"), open: opt(settings, "open"), jokers: opt(settings, "jokers"), target: opt(settings, "target"),
    level: [1, 2, 3].includes(settings.level) ? settings.level : 2,
    manche: 1, first: 0, scores: Object.fromEntries(order.map((id) => [id, 0])), lastRound: null, winner: null, endBy: null };
  deal(s, rng);
  return s;
}

export const handPts = (s, id) => s.hands[id].reduce((t, c) => t + penalty(c), 0);
export function toAct(s) { return s.winner ? [] : [s.order[s.cur]]; }

function endRound(s, winner, seed, by) {
  const got = {};
  for (const id of s.order) got[id] = handPts(s, id);
  s.lastRound = { manche: s.manche, winner, got, by };
  if (!s.target) { s.winner = winner; s.endBy = by; return; }
  for (const id of s.order) s.scores[id] += got[id];
  if (s.order.some((id) => s.scores[id] >= s.target)) {
    s.winner = s.order.slice().sort((x, y) => s.scores[x] - s.scores[y] || (x === winner ? -1 : y === winner ? 1 : 0))[0];
    s.endBy = "target";
    return;
  }
  s.manche++;
  s.first = (s.first + 1) % s.order.length;
  deal(s, mkRng(seed));
}

// fin du tour : pioche vide, on remélange la défausse (3 fois au plus, ensuite la manche s'arrête)
function nextTurn(s, seed) {
  s.cur = (s.cur + 1) % s.order.length;
  s.phase = "draw"; s.took = null;
  if (!s.stock.length) {
    if (s.reshuf < 3 && s.discard.length > 1) {
      const top = s.discard.pop();
      s.stock = mkRng(seed).shuffle(s.discard);
      s.discard = [top];
      s.reshuf++;
    } else {
      const low = s.order.slice().sort((x, y) => handPts(s, x) - handPts(s, y))[0];
      endRound(s, low, seed ^ 0x2545f491, "stock");
    }
  }
}

function checkOut(s, pid, seed) {
  if (!s.hands[pid].length) { endRound(s, pid, seed ^ 0x5bd1e995, "out"); return true; }
  return false;
}

function doDiscard(s, pid, card, seed) {
  const hand = s.hands[pid];
  const i = hand.indexOf(card);
  if (i < 0) fail("Carte absente de ta main");
  if (s.took && card === s.took && hand.filter((c) => c === card).length === 1 && hand.length > 1) fail("Tu ne peux pas rejeter la carte que tu viens de prendre");
  hand.splice(i, 1);
  s.discard.push(card);
  s.log = { id: pid, t: "discard", card };
  if (checkOut(s, pid, seed)) return;
  nextTurn(s, seed);
}

function doDraw(s, pid, from) {
  if (from === "discard") {
    if (!s.discard.length) fail("La défausse est vide");
    const c = s.discard.pop();
    s.hands[pid].push(c);
    s.took = c;
    s.log = { id: pid, t: "take", card: c };
  } else {
    if (!s.stock.length) fail("La pioche est vide");
    s.hands[pid].push(s.stock.shift());
    s.took = null;
    s.log = { id: pid, t: "draw" };
  }
  s.phase = "play";
}

// carte la moins utile à jeter (jamais un joker si possible)
export function worstCard(s, pid, rng, level = 3) {
  const hand = s.hands[pid];
  let pool = hand.filter((c) => !isJ(c) && (c !== s.took || hand.filter((x) => x === c).length > 1));
  if (!pool.length) pool = hand.filter((c) => c !== s.took || hand.length === 1);
  if (!pool.length) pool = hand.slice();
  if (level === 1 && rng && rng.next() < 0.5) return rng.pick(pool);
  const use = (c) => {
    let u = 0;
    for (const x of hand) {
      if (x === c || isJ(x)) continue;
      if (rankN(x) === rankN(c) && suitOf(x) !== suitOf(c)) u += 2;
      if (suitOf(x) === suitOf(c)) {
        const d = Math.abs(rankN(x) - rankN(c));
        if (d === 1 || d === 12) u += 2; else if (d === 2 || d === 11) u += 1;
      }
    }
    return u * 10 - penalty(c);
  };
  return pool.slice().sort((a, b) => use(a) - use(b))[0];
}

export function reduce(s, pid, a) {
  if (toAct(s)[0] !== pid) fail("Ce n'est pas ton tour");
  const hand = s.hands[pid];
  const seed = a.seed || 1;
  if (a.type === "autoturn") {
    if (s.phase === "draw") doDraw(s, pid, "stock");
    doDiscard(s, pid, worstCard(s, pid, null, 3), seed);
    return s;
  }
  if (a.type === "draw") {
    if (s.phase !== "draw") fail("Tu as déjà pioché");
    doDraw(s, pid, a.from === "discard" ? "discard" : "stock");
    return s;
  }
  if (s.phase !== "play") fail("Pioche d'abord une carte");
  if (a.type === "discard") { doDiscard(s, pid, a.card, seed); return s; }
  if (a.type === "meld") {
    const groups = a.groups;
    if (!Array.isArray(groups) || !groups.length || groups.some((g) => !Array.isArray(g))) fail("Choisis des cartes à poser");
    const rest = removeCards(hand, groups.flat());
    if (!rest) fail("Ces cartes ne sont pas dans ta main");
    const ms = groups.map(analyze);
    if (ms.some((m) => !m)) fail("Ce n'est pas une combinaison valable");
    const pts = ms.reduce((t, m) => t + meldPoints(m), 0);
    if (!s.opened[pid] && pts < s.open) fail(`Il faut au moins ${s.open} points pour ta première pose (tu as ${pts})`);
    s.opened[pid] = true;
    s.hands[pid] = rest;
    for (const m of ms) { m.o = pid; s.melds.push(m); }
    s.log = { id: pid, t: "meld", n: ms.length, pts };
    checkOut(s, pid, seed);
    return s;
  }
  if (a.type === "add") {
    if (!s.opened[pid]) fail("Fais d'abord ta première pose");
    const m = s.melds[a.meld | 0];
    if (!m) fail("Combinaison inconnue");
    const cards = Array.isArray(a.cards) ? a.cards : [];
    const rest = removeCards(hand, cards);
    if (!rest || !cards.length) fail("Ces cartes ne sont pas dans ta main");
    const nm = extend(m, cards);
    if (!nm) fail("Ces cartes ne vont pas sur cette combinaison");
    nm.o = m.o;
    s.melds[a.meld | 0] = nm;
    s.hands[pid] = rest;
    s.log = { id: pid, t: "add", n: cards.length };
    checkOut(s, pid, seed);
    return s;
  }
  if (a.type === "swap") {
    if (!s.opened[pid]) fail("Fais d'abord ta première pose");
    const m = s.melds[a.meld | 0];
    if (!m) fail("Combinaison inconnue");
    if (!hand.includes(a.card)) fail("Carte absente de ta main");
    const i = swapIndex(m, a.card);
    if (i < 0) fail("Cette carte ne remplace pas le joker");
    m.c[i] = a.card;
    hand.splice(hand.indexOf(a.card), 1);
    hand.push(JOKER);
    s.log = { id: pid, t: "swap", card: a.card };
    return s;
  }
  fail("Action inconnue");
}

export function result(s) {
  if (!s.winner) return null;
  if (s.target) {
    const ranking = rankByScore(s.order.map((id) => ({ id, score: s.scores[id] })), true);
    // à égalité de total, le gagnant désigné passe devant
    return { ranking: fixFirst(ranking, s.winner) };
  }
  const ranking = rankByScore(s.order.map((id) => ({ id, score: handPts(s, id) })), true);
  return { ranking: fixFirst(ranking, s.winner) };
}
function fixFirst(rk, winner) {
  const w = rk.find((e) => e.id === winner);
  const tied = rk.filter((e) => e.rank === 1);
  if (tied.length > 1 && w && w.rank === 1) {
    return [w, ...rk.filter((e) => e !== w).map((e) => ({ ...e, rank: e.rank === 1 ? 2 : e.rank }))];
  }
  return rk;
}

// ------------------------------------------------ robot
// toutes les combinaisons possibles d'une main
export function candidates(hand) {
  const nat = hand.filter((c) => !isJ(c));
  const J = hand.length - nat.length;
  const out = [];
  const byRank = {};
  for (const c of nat) (byRank[rankN(c)] = byRank[rankN(c)] || {})[suitOf(c)] = c;
  for (const r in byRank) {
    const cs = Object.values(byRank[r]);
    const n = cs.length;
    for (let mask = 1; mask < 1 << n; mask++) {
      const pick = cs.filter((_, i) => mask & (1 << i));
      if (pick.length >= 3) out.push(pick);
      else if (pick.length === 2 && J) out.push([...pick, JOKER]);
      if (pick.length === 3 && J) out.push([...pick, JOKER]);
    }
  }
  for (const su of SUITS) {
    const has = {};
    for (const c of nat) if (suitOf(c) === su) { const r = rankN(c); has[r] = c; if (r === 1) has[14] = c; }
    for (let lo = 1; lo <= 12; lo++) {
      let miss = 0, nn = 0;
      const cards = [];
      for (let hi = lo; hi <= 14 && hi - lo < 13; hi++) {
        if (has[hi] && !(hi === 14 && lo === 1)) { cards.push(has[hi]); nn++; }
        else { miss++; cards.push(JOKER); }
        if (miss > Math.min(J, 1)) break;
        if (cards.length >= 3 && nn >= 2) out.push(cards.slice());
      }
    }
  }
  return out.filter((g) => analyze(g));
}

// meilleure façon de poser des combinaisons disjointes (le plus de cartes, puis le plus de points)
export function bestMelds(hand, budget = 3000) {
  const cands = candidates(hand).map((g) => ({ g, pts: meldPoints(analyze(g)) }))
    .sort((a, b) => b.g.length - a.g.length || b.pts - a.pts);
  const count = {};
  for (const c of hand) count[c] = (count[c] || 0) + 1;
  let best = { groups: [], cards: 0, pts: 0 };
  let steps = 0;
  const cur = [];
  const go = (start, cards, pts) => {
    if (cards > best.cards || (cards === best.cards && pts > best.pts)) best = { groups: cur.map((x) => x.g), cards, pts };
    for (let i = start; i < cands.length; i++) {
      if (++steps > budget) return;
      const { g } = cands[i];
      const need = {};
      let ok = true;
      for (const c of g) { need[c] = (need[c] || 0) + 1; if (need[c] > (count[c] || 0)) { ok = false; break; } }
      if (!ok) continue;
      for (const c of g) count[c]--;
      cur.push(cands[i]);
      go(i + 1, cards + g.length, pts + cands[i].pts);
      cur.pop();
      for (const c of g) count[c]++;
    }
  };
  go(0, 0, 0);
  return best;
}

export function bot(s, pid, rng) {
  if (toAct(s)[0] !== pid) return null;
  const hand = s.hands[pid];
  const lvl = s.level || 2;
  if (s.phase === "draw") {
    const top = s.discard[s.discard.length - 1];
    if (top) {
      if (isJ(top)) return { type: "draw", from: "discard" };
      if (lvl > 1 || rng.next() < 0.5) {
        const before = bestMelds(hand, 1500).cards;
        const after = bestMelds([...hand, top], 1500).cards;
        if (after > before + 1 || (s.opened[pid] && after > before)) return { type: "draw", from: "discard" };
        if (s.opened[pid] && s.melds.some((m) => extend(m, [top]))) return { type: "draw", from: "discard" };
      }
    }
    return { type: "draw", from: "stock" };
  }
  if (s.opened[pid]) {
    for (let i = 0; i < s.melds.length; i++) {
      if (!s.melds[i].c.includes(JOKER)) continue;
      for (const c of hand) if (swapIndex(s.melds[i], c) >= 0) return { type: "swap", meld: i, card: c };
    }
  }
  const best = bestMelds(hand);
  if (best.groups.length) {
    if (s.opened[pid]) return { type: "meld", groups: best.groups };
    if (best.pts >= s.open) return { type: "meld", groups: best.groups };
  }
  if (s.opened[pid]) {
    for (const c of hand) {
      if (isJ(c) && hand.length > 2) continue;
      for (let i = 0; i < s.melds.length; i++) if (extend(s.melds[i], [c])) return { type: "add", meld: i, cards: [c] };
    }
  }
  return { type: "discard", card: worstCard(s, pid, rng, lvl) };
}

export function auto() { return { type: "autoturn" }; }
export function botDelay(s, pid, rng) { return 900 + rng.next() * 900; }
