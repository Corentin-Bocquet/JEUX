import { fail, rankByScore, rng } from "../engine.js";

export const meta = {
  id: "dominos", name: "Dominos", cat: "Plateau", min: 2, max: 4, turnTime: 40,
  color: "#92400E", desc: "Pose tes dominos aux deux bouts de la chaîne et vide ta main le premier.",
  rules: ["Jeu double-six : 28 dominos. Chacun reçoit 7 dominos à 2 joueurs, 6 à 3 ou 4 joueurs.",
    "Celui qui a le plus gros double commence. Ensuite, à ton tour, pose un domino dont une moitié touche un des deux bouts de la chaîne.",
    "Tu ne peux pas jouer ? Avec la pioche, tu tires un domino jusqu'à pouvoir poser. Sans pioche (ou pioche vide), tu passes.",
    "Le premier qui vide sa main gagne la manche. Si plus personne ne peut jouer, la main la plus légère gagne.",
    "En une manche : on classe selon les points restant en main (le moins gagne).",
    "En partie aux points : le gagnant de la manche marque les points des mains adverses. Le premier à 100 (ou 150) gagne."],
};

export const options = [
  { key: "draw", label: "Pioche", icon: "🁢",
    values: [["pioche", "Pioche", "On tire si bloqué"], ["bloque", "Bloqué", "On passe son tour"]], def: "pioche" },
  { key: "target", label: "Partie", icon: "🏁",
    values: [[0, "1 manche", "Une seule manche"], [100, "100 pts", "Plusieurs manches"], [150, "150 pts", "Partie longue"]], def: 0 },
  { key: "hand", label: "Main", icon: "✋",
    values: [[0, "Auto", "7 ou 6 dominos"], [5, "5", "Main courte"], [7, "7", "Main pleine"]], def: 0 },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "🁫", desc: "Avec pioche, une manche, la main la plus légère gagne.", set: { draw: "pioche", target: 0, hand: 0 } },
  { id: "bloque", name: "Bloqué", emoji: "🚧", desc: "Pas de pioche : si tu ne peux pas poser, tu passes.", set: { draw: "bloque", target: 0, hand: 0 } },
  { id: "cent", name: "En 100 points", emoji: "💯", desc: "Plusieurs manches avec pioche, le premier à 100 points gagne.", set: { draw: "pioche", target: 100, hand: 0 } },
  { id: "marathon", name: "Marathon", emoji: "🏆", desc: "Sans pioche, 7 dominos chacun, en 150 points.", set: { draw: "bloque", target: 150, hand: 7 } },
];

export function opt(settings, key) {
  const o = options.find((x) => x.key === key);
  const v = settings ? settings[key] : undefined;
  const hit = o.values.find((x) => x[0] === v || (v != null && String(x[0]) === String(v)));
  return hit ? hit[0] : o.def;
}

// un domino est un tableau [a, b] avec a <= b dans les mains et la pioche
export const ALL = (() => { const t = []; for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) t.push([a, b]); return t; })();
export const pips = (t) => t[0] + t[1];
export const handPips = (hand) => hand.reduce((n, t) => n + pips(t), 0);
export const isDouble = (t) => t[0] === t[1];
export const ends = (s) => (s.chain.length ? [s.chain[0][0], s.chain[s.chain.length - 1][1]] : null);
export const MAX_DEALS = 40;

// coups possibles pour une main : [{ i, side }] (side "L", "R", ou "L" seul si la chaîne est vide)
export function movesFor(s, hand) {
  const e = ends(s), out = [];
  hand.forEach((t, i) => {
    if (!e) { out.push({ i, side: "L" }); return; }
    if (t[0] === e[0] || t[1] === e[0]) out.push({ i, side: "L" });
    if ((t[0] === e[1] || t[1] === e[1]) && !(e[0] === e[1] && out.some((m) => m.i === i))) out.push({ i, side: "R" });
  });
  return out;
}

function deal(s, r) {
  const tiles = r.shuffle(ALL.map((t) => t.slice()));
  const n = s.order.length;
  const per = s.handSize || (n === 2 ? 7 : 6);
  s.hands = {};
  s.order.forEach((id, k) => { s.hands[id] = tiles.slice(k * per, (k + 1) * per); });
  s.stock = tiles.slice(n * per);
  s.chain = [];
  s.passes = 0;
  s.end = null;
  s.last = null;
  s.deal = (s.deal || 0) + 1;
  // premier joueur : le plus gros double, sinon le domino le plus lourd ; ensuite le gagnant précédent
  if (s.starter != null && s.order.includes(s.starter)) { s.turn = s.order.indexOf(s.starter); return; }
  let best = -1, who = 0;
  s.order.forEach((id, k) => {
    for (const t of s.hands[id]) {
      const v = isDouble(t) ? 100 + t[0] : pips(t) * 2 + (t[1] / 10);
      if (v > best) { best = v; who = k; }
    }
  });
  s.turn = who;
}

export function setup(players, settings, r) {
  const order = r.shuffle(players.map((p) => p.id));
  const s = { order, draw: opt(settings, "draw"), target: opt(settings, "target"), handSize: opt(settings, "hand"),
    level: [1, 2, 3].includes(settings.level) ? settings.level : 2,
    score: Object.fromEntries(order.map((id) => [id, 0])), deal: 0, starter: null, over: false, log: [] };
  deal(s, r);
  return s;
}

const curId = (s) => s.order[s.turn];
export function toAct(s) {
  if (s.over) return [];
  if (s.end) return [s.end.winner || curId(s)]; // quelqu'un lance la manche suivante
  return [curId(s)];
}
export const canDraw = (s) => s.draw === "pioche" && s.stock.length > 0;

function nextTurn(s) { s.turn = (s.turn + 1) % s.order.length; }

function finishDeal(s, winner, blocked) {
  const rest = Object.fromEntries(s.order.map((id) => [id, handPips(s.hands[id])]));
  let gain = 0;
  if (winner) for (const id of s.order) if (id !== winner) gain += rest[id];
  s.end = { winner, blocked, rest, gain };
  if (s.target > 0) {
    if (winner) s.score[winner] += gain;
    s.starter = winner || null;
    if (s.order.some((id) => s.score[id] >= s.target) || s.deal >= MAX_DEALS) s.over = true;
  } else s.over = true;
  s.log.push({ w: winner, g: gain, b: blocked ? 1 : 0 });
  if (s.log.length > 12) s.log.shift();
}

function blockedEnd(s) {
  const rest = s.order.map((id) => [id, handPips(s.hands[id])]);
  const min = Math.min(...rest.map((x) => x[1]));
  const low = rest.filter((x) => x[1] === min);
  finishDeal(s, low.length === 1 ? low[0][0] : null, true);
}

export function reduce(s, pid, a) {
  if (s.over) fail("La partie est terminée");
  if (!toAct(s).includes(pid)) fail("Ce n'est pas ton tour");
  if (s.end) {
    if (a.type !== "next") fail("Lance la manche suivante");
    deal(s, rng(a.seed || 1));
    return s;
  }
  const hand = s.hands[pid];
  const moves = movesFor(s, hand);
  if (a.type === "play") {
    const i = a.i | 0;
    if (i < 0 || i >= hand.length) fail("Domino introuvable");
    const t = hand[i];
    const e = ends(s);
    const side = a.side === "R" ? "R" : "L";
    if (!e) s.chain.push([t[0], t[1]]);
    else {
      if (!t.includes(e[0]) && !t.includes(e[1])) fail("Ce domino ne se pose nulle part");
      if (!t.includes(side === "L" ? e[0] : e[1])) fail("Ce domino ne se pose pas de ce côté");
      if (side === "L") s.chain.unshift(t[1] === e[0] ? [t[0], t[1]] : [t[1], t[0]]);
      else s.chain.push(t[0] === e[1] ? [t[0], t[1]] : [t[1], t[0]]);
    }
    hand.splice(i, 1);
    s.passes = 0;
    s.last = { id: pid, side: s.chain.length === 1 ? "L" : side, t: [t[0], t[1]], n: s.chain.length };
    if (!hand.length) { finishDeal(s, pid, false); return s; }
    nextTurn(s);
    return s;
  }
  if (a.type === "draw") {
    if (moves.length) fail("Tu peux déjà poser un domino");
    if (!canDraw(s)) fail("Pas de pioche possible");
    hand.push(s.stock.pop());
    s.last = { id: pid, draw: 1 };
    return s;
  }
  if (a.type === "pass") {
    if (moves.length) fail("Tu peux poser un domino");
    if (canDraw(s)) fail("Pioche d'abord");
    s.passes++;
    s.last = { id: pid, pass: 1 };
    if (s.passes >= s.order.length) { blockedEnd(s); return s; }
    nextTurn(s);
    return s;
  }
  fail("Action inconnue");
}

export function result(s) {
  if (!s.over) return null;
  if (s.target > 0) return { ranking: rankByScore(s.order.map((id) => ({ id, score: s.score[id] }))) };
  // une seule manche : le moins de points en main gagne (le gagnant de la manche passe toujours devant)
  const rk = rankByScore(s.order.map((id) => ({ id, score: s.end.rest[id] })), true);
  return { ranking: rk };
}

// ------------------------------------------------ robot
// valeur d'un coup : gros dominos d'abord, doubles tôt, garder des valeurs variées
function moveValue(s, hand, m, level) {
  const t = hand[m.i];
  let v = pips(t);
  if (level >= 2 && isDouble(t)) v += 4;
  if (level >= 3) {
    const rest = hand.filter((_, k) => k !== m.i);
    const kinds = new Set();
    rest.forEach((x) => { kinds.add(x[0]); kinds.add(x[1]); });
    v += kinds.size * 1.5;
    // bouts après le coup : combien de mes dominos pourront encore se poser
    const e = ends(s);
    let ne;
    if (!e) ne = [t[0], t[1]];
    else if (m.side === "L") ne = [t[0] === e[0] ? t[1] : t[0], e[1]];
    else ne = [e[0], t[0] === e[1] ? t[1] : t[0]];
    const follow = rest.filter((x) => ne.includes(x[0]) || ne.includes(x[1])).length;
    v += follow * 2;
    if (!follow) v -= 4;
  }
  return v;
}

export function bot(s, pid, r) {
  if (s.over) return null;
  if (s.end) return { type: "next" };
  const hand = s.hands[pid];
  const moves = movesFor(s, hand);
  if (!moves.length) return canDraw(s) ? { type: "draw" } : { type: "pass" };
  const level = s.level || 2;
  if (level === 1 && r.next() < 0.6) { const m = r.pick(moves); return { type: "play", i: m.i, side: m.side }; }
  let best = -Infinity, cands = [];
  for (const m of moves) {
    const v = moveValue(s, hand, m, level);
    if (v > best) { best = v; cands = [m]; } else if (v === best) cands.push(m);
  }
  const m = r.pick(cands);
  return { type: "play", i: m.i, side: m.side };
}
export const auto = bot;
export function botDelay(s, pid, r) {
  if (s.end) return 2600 + r.next() * 800;
  return 900 + r.next() * 900;
}
