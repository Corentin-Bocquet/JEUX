import { fail, rankByScore, rng as mkRng } from "../engine.js";
import { deck, rankOf, suitOf, rv, label } from "./cards.js";

export const meta = {
  id: "president", name: "Président", cat: "Cartes", min: 3, max: 7, turnTime: 30,
  color: "#2563EB", desc: "Vide ta main le premier pour devenir Président.",
  rules: ["Toutes les cartes sont distribuées. Le 3 est la plus faible, puis 4, 5... Roi, As, et le 2 est la plus forte.",
    "Celui qui ouvre le pli pose une carte seule, une paire, un brelan ou un carré.",
    "Les suivants posent le même nombre de cartes, d'une valeur égale ou supérieure, ou passent. Qui passe ne rejoue plus dans ce pli.",
    "Quand tout le monde a passé, le dernier à avoir posé ramasse le pli et rouvre.",
    "Carré magique : dès que quatre cartes de même valeur s'enchaînent sur le pli (ou un carré d'un coup), le pli est fermé et le poseur rouvre.",
    "Le premier qui vide sa main devient Président, puis Vice-président, Neutres, Vice-perdant et Perdant.",
    "Manche suivante : le Perdant donne ses 2 meilleures cartes au Président qui lui rend 2 cartes de son choix ; le Vice-perdant et le Vice-président échangent 1 carte. Le Perdant commence.",
    "Points à chaque manche : 1 point par joueur fini après toi. Le plus de points à la fin gagne.",
    "Options : nombre de manches, force du 2, carré magique, échange de cartes."],
};

export const options = [
  { key: "rounds", label: "Manches", icon: "🔁", values: [[3, "3", "Rapide"], [5, "5", "Standard"], [7, "7", "Longue soirée"]], def: 3 },
  { key: "two", label: "Le 2", icon: "👑", values: [[true, "Plus fort", "Au-dessus de l'As"], [false, "Plus faible", "L'As domine"]], def: true },
  { key: "magic", label: "Le carré", icon: "✨", values: [[true, "Magique", "Ferme le pli"], [false, "Normal", "Pli normal"]], def: true },
  { key: "swap", label: "Échange", icon: "🔄", values: [[true, "Activé", "2 cartes et 1"], [false, "Sans", "Mains brutes"]], def: true },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "🎩", desc: "3 manches, le 2 au sommet, carré magique et échange de cartes.",
    set: { rounds: 3, two: true, magic: true, swap: true } },
  { id: "marathon", name: "Mandat long", emoji: "🏛️", desc: "7 manches pour garder ton fauteuil de Président.",
    set: { rounds: 7, two: true, magic: true, swap: true } },
  { id: "revolution", name: "Sans échange", emoji: "🗳️", desc: "Pas d'échange de cartes : chaque manche repart à égalité.",
    set: { rounds: 5, two: true, magic: true, swap: false } },
  { id: "asroi", name: "L'As est roi", emoji: "🅰️", desc: "Le 2 devient la plus faible carte et le carré magique disparaît.",
    set: { rounds: 3, two: false, magic: false, swap: true } },
];

export function opt(settings, key) {
  const o = options.find((x) => x.key === key);
  const v = settings ? settings[key] : undefined;
  const hit = o.values.find((x) => String(x[0]) === String(v));
  return hit ? hit[0] : o.def;
}

// force d'une carte (2 tout en haut si l'option est active)
export const power = (s, c) => (rankOf(c) === "2" ? (s.two ? 15 : 2) : rv(c));
export const sortHand = (s, hand) => hand.slice().sort((a, b) => power(s, a) - power(s, b) || "SHDC".indexOf(suitOf(a)) - "SHDC".indexOf(suitOf(b)));

export const ROLE_NAME = { pres: "Président", vice: "Vice-président", neutre: "Neutre", vperd: "Vice-perdant", perd: "Perdant" };
export function roleAt(pos, n) {
  if (pos === 0) return "pres";
  if (pos === n - 1) return "perd";
  if (n >= 4 && pos === 1) return "vice";
  if (n >= 4 && pos === n - 2) return "vperd";
  return "neutre";
}
const holder = (s, role) => s.order.find((id) => s.roles[id] === role);

export function setup(players, settings, rng) {
  const order = rng.shuffle(players.map((p) => p.id));
  const s = {
    order, rounds: opt(settings, "rounds"), two: opt(settings, "two"), magic: opt(settings, "magic"), swap: opt(settings, "swap"),
    level: [1, 2, 3].includes(settings.level) ? settings.level : 2,
    manche: 1, scores: Object.fromEntries(order.map((id) => [id, 0])), roles: {}, hands: {},
    phase: "play", cur: 0, plays: [], passed: [], out: [], give: null, log: null, last: null, over: false,
  };
  deal(s, rng);
  return s;
}

function deal(s, rng) {
  const cards = rng.shuffle(deck());
  const n = s.order.length;
  s.hands = Object.fromEntries(s.order.map((id) => [id, []]));
  cards.forEach((c, i) => s.hands[s.order[i % n]].push(c));
  for (const id of s.order) s.hands[id] = sortHand(s, s.hands[id]);
  s.plays = []; s.passed = []; s.out = []; s.give = null;
  const perd = holder(s, "perd");
  if (s.manche > 1 && s.swap && perd) {
    // le Perdant donne ses meilleures cartes, le Président choisira quoi rendre
    s.give = {};
    const pairs = [["perd", "pres", 2]];
    if (n >= 4) pairs.push(["vperd", "vice", 1]);
    for (const [from, to, k] of pairs) {
      const a = holder(s, from), b = holder(s, to);
      if (!a || !b) continue;
      const best = s.hands[a].slice(-k);
      s.hands[a] = s.hands[a].slice(0, -k);
      s.hands[b] = sortHand(s, [...s.hands[b], ...best]);
      s.give[b] = { to: a, n: k, got: best, done: false };
    }
    s.phase = "give";
  } else {
    s.phase = "play";
  }
  // première manche : celui qui a le plus petit trèfle commence ; ensuite le Perdant
  const low = s.two ? "3C" : "2C";
  const first = s.manche > 1 && perd ? perd : s.order.find((id) => s.hands[id].includes(low));
  s.cur = s.order.indexOf(first);
  s.log = { t: "deal", id: first, card: s.manche > 1 && perd ? null : low };
}

const active = (s) => s.order.filter((id) => s.hands[id].length > 0);
export const top = (s) => (s.plays.length ? s.plays[s.plays.length - 1] : null);

export function toAct(s) {
  if (s.over) return [];
  if (s.phase === "give") return s.order.filter((id) => s.give[id] && !s.give[id].done);
  return [s.order[s.cur]];
}

// combinaison jouable maintenant ?
export function canPlay(s, cards) {
  if (!cards.length || cards.length > 4) return false;
  const r = rankOf(cards[0]);
  if (!cards.every((c) => rankOf(c) === r)) return false;
  const t = top(s);
  if (!t) return true;
  return cards.length === t.cards.length && power(s, cards[0]) >= power(s, t.cards[0]);
}

function nextIdx(s, from) { return (from + 1) % s.order.length; }

function closeTrick(s, by, magic) {
  const last = top(s);
  s.last = last ? { id: last.id, cards: last.cards, magic: !!magic } : null;
  s.plays = []; s.passed = [];
  let i = s.order.indexOf(by);
  for (let k = 0; k < s.order.length && !s.hands[s.order[i]].length; k++) i = nextIdx(s, i);
  s.cur = i;
  s.log = { t: magic ? "magic" : "close", id: by, lead: s.order[i] };
}

function advance(s) {
  const by = top(s).id;
  let i = s.cur;
  for (let k = 0; k < s.order.length; k++) {
    i = nextIdx(s, i);
    const id = s.order[i];
    if (id === by) { closeTrick(s, by, false); return; }
    if (!s.hands[id].length || s.passed.includes(id)) continue;
    s.cur = i;
    return;
  }
  closeTrick(s, by, false);
}

function endManche(s, seed) {
  for (const id of s.order) if (!s.out.includes(id)) s.out.push(id);
  const n = s.order.length;
  s.out.forEach((id, pos) => { s.roles[id] = roleAt(pos, n); s.scores[id] += n - 1 - pos; });
  s.lastManche = { manche: s.manche, out: s.out.slice() };
  if (s.manche >= s.rounds) { s.over = true; s.phase = "over"; s.log = { t: "end" }; return; }
  s.manche++;
  deal(s, mkRng(seed));
}

export function reduce(s, pid, a) {
  if (s.over) fail("La partie est terminée");
  if (s.phase === "give") {
    const g = s.give[pid];
    if (!g || g.done) fail("Tu n'as rien à donner");
    if (a.type !== "give") fail("Choisis les cartes à donner");
    const cards = a.cards || [];
    if (cards.length !== g.n || new Set(cards).size !== g.n) fail(g.n > 1 ? `Choisis ${g.n} cartes` : "Choisis 1 carte");
    if (!cards.every((c) => s.hands[pid].includes(c))) fail("Carte absente");
    s.hands[pid] = s.hands[pid].filter((c) => !cards.includes(c));
    s.hands[g.to] = sortHand(s, [...s.hands[g.to], ...cards]);
    g.done = true; g.back = cards;
    if (Object.values(s.give).every((x) => x.done)) { s.phase = "play"; s.log = { t: "swapped", id: s.order[s.cur] }; }
    return s;
  }
  if (toAct(s)[0] !== pid) fail("Ce n'est pas ton tour");
  if (a.type === "pass") {
    if (!s.plays.length) fail("C'est à toi d'ouvrir le pli : pose des cartes");
    s.passed.push(pid);
    s.log = { t: "pass", id: pid };
    advance(s);
    return s;
  }
  if (a.type !== "play") fail("Action inconnue");
  const cards = a.cards || [];
  if (new Set(cards).size !== cards.length || !cards.every((c) => s.hands[pid].includes(c))) fail("Carte absente");
  if (!cards.length || cards.length > 4 || !cards.every((c) => rankOf(c) === rankOf(cards[0]))) fail("Pose des cartes de même valeur");
  const t = top(s);
  if (t && cards.length !== t.cards.length) fail(`Il faut poser ${t.cards.length} carte${t.cards.length > 1 ? "s" : ""}`);
  if (t && power(s, cards[0]) < power(s, t.cards[0])) fail("Il faut une valeur égale ou plus forte");
  // suite de cartes de même valeur sur le pli (pour le carré magique)
  const run = t && rankOf(t.cards[0]) === rankOf(cards[0]) ? t.run + cards.length : cards.length;
  s.hands[pid] = s.hands[pid].filter((c) => !cards.includes(c));
  s.plays.push({ id: pid, cards: sortHand(s, cards), run });
  if (s.plays.length > 6) s.plays.shift();
  s.log = { t: "play", id: pid, cards };
  if (!s.hands[pid].length) { s.out.push(pid); s.log.out = s.out.length; }
  if (active(s).length <= 1) { endManche(s, (a.seed || 1) ^ 0x2c1b3c6d); return s; }
  if (s.magic && run >= 4) { closeTrick(s, pid, true); return s; }
  advance(s);
  return s;
}

export function result(s) {
  if (!s.over) return null;
  return { ranking: rankByScore(s.order.map((id) => ({ id, score: s.scores[id] }))) };
}

// ------------------------------------------------ robots
function groups(s, hand) {
  const g = {};
  for (const c of hand) (g[rankOf(c)] = g[rankOf(c)] || []).push(c);
  return Object.values(g).sort((a, b) => power(s, a[0]) - power(s, b[0]));
}

export function bot(s, pid, r) {
  const lvl = s.level || 2;
  const hand = s.hands[pid];
  if (s.phase === "give") {
    const g = s.give[pid];
    if (!g || g.done) return null;
    // rendre les cartes les plus faibles, en évitant de casser une paire si possible
    const gs = groups(s, hand);
    const singles = gs.filter((x) => x.length === 1).map((x) => x[0]);
    const pool = [...singles, ...sortHand(s, hand).filter((c) => !singles.includes(c))];
    const sorted = lvl >= 2 ? pool.slice(0, g.n) : sortHand(s, hand).slice(0, g.n);
    return { type: "give", cards: sorted };
  }
  const gs = groups(s, hand);
  const t = top(s);
  const maxP = s.two ? 15 : 14;
  if (!t) {
    if (gs.length === 1) return { type: "play", cards: gs[0] };
    if (lvl === 1) return { type: "play", cards: r.pick(gs) };
    // fin de main : jouer d'abord ce qui est imbattable pour reprendre la main
    if (lvl === 3 && gs.length === 2 && power(s, gs[1][0]) === maxP) return { type: "play", cards: gs[1] };
    // sinon on se débarrasse du plus petit groupe ; les très grosses cartes attendent
    const low = gs.filter((x) => power(s, x[0]) < maxP - 1);
    return { type: "play", cards: (low.length ? low : gs)[0] };
  }
  const need = t.cards.length;
  const tp = power(s, t.cards[0]);
  const cands = gs.filter((x) => x.length >= need && power(s, x[0]) >= tp);
  if (!cands.length) return { type: "pass" };
  if (lvl === 1) {
    if (r.next() < 0.15) return { type: "pass" };
    return { type: "play", cards: cands[0].slice(0, need) };
  }
  // d'abord sans casser de groupe
  const exact = cands.filter((x) => x.length === need);
  let pick = exact[0] || cands[0];
  const pp = power(s, pick[0]);
  const broke = pick.length > need;
  const many = hand.length > 6;
  // garder ses atouts tant que la main est grosse
  if (many && pp >= maxP - 1 && r.next() < (lvl === 3 ? 0.75 : 0.5)) return { type: "pass" };
  if (broke && pick.length === 4 && s.magic && many) return { type: "pass" };
  if (broke && many && pp >= 11 && r.next() < 0.6) return { type: "pass" };
  // au fort niveau : égaliser plutôt que surenchérir inutilement
  if (lvl === 3) {
    const eq = cands.find((x) => power(s, x[0]) === tp && x.length === need);
    if (eq) pick = eq;
  }
  return { type: "play", cards: pick.slice(0, need) };
}
export const auto = bot;
export function botDelay(s, pid, r) { return s.phase === "give" ? 900 + r.int(700) : 700 + r.int(900); }
export { label };
