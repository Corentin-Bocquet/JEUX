// Dernière carte : jeu de défausse par couleur ou par valeur, avec son propre paquet de 108 cartes.
// Une carte est une chaîne : couleur (R rouge, Y jaune, G vert, B bleu) + valeur
// (0 à 9, D = +2, I = inversion, P = passe ton tour), ou "W" (joker couleur), "W4" (joker +4).
import { fail, rankByScore, rng as mkRng } from "../engine.js";

export const meta = {
  id: "derniere", name: "Dernière carte", cat: "Cartes", min: 2, max: 8, turnTime: 30,
  color: "#EF4444", desc: "Vide ta main le premier, et n'oublie pas d'annoncer ta dernière carte !",
  rules: ["Pose une carte de la même couleur ou de la même valeur que celle du dessus.",
    "Le +2 fait piocher 2 cartes au suivant qui passe son tour, l'inversion change le sens, le passe ton tour saute le suivant.",
    "Le joker couleur se pose sur tout et choisit la couleur. Le joker +4 aussi, et le suivant pioche 4 cartes.",
    "Pas de carte jouable ? Pioche : si la carte piochée va, tu peux la poser, sinon ton tour passe.",
    "Quand tu vas poser ton avant-dernière carte, appuie sur « Dernière carte ! » avant. Oubli : tu pioches 2 cartes de pénalité.",
    "Le premier qui n'a plus de carte gagne la manche et marque les points des mains adverses (chiffres : leur valeur, cartes action : 20, jokers : 50).",
    "Options : cumul des +2 et +4, piocher jusqu'à pouvoir jouer, cartes en main, partie en une manche ou en points."],
};

// ------------------------------------------------ réglages
export const options = [
  { key: "target", label: "Fin de partie", icon: "🏁",
    values: [[0, "1 manche", "Premier vidé"], [200, "200 pts", "Course courte"], [500, "500 pts", "Partie longue"]], def: 0 },
  { key: "stack", label: "Cumul +2/+4", icon: "➕",
    values: [[false, "Non", "Règle de base"], [true, "Oui", "On se renvoie"]], def: false },
  { key: "drawUntil", label: "Pioche", icon: "🂠",
    values: [[false, "1 carte", "Règle de base"], [true, "Illimitée", "Jusqu'à pouvoir"]], def: false },
  { key: "cards", label: "Cartes en main", icon: "🖐️",
    values: [[5, "5", "Rapide"], [7, "7", "Standard"], [10, "10", "Longue"]], def: 7 },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "🎴", desc: "Une manche, 7 cartes chacun, règles de base.",
    set: { target: 0, stack: false, drawUntil: false, cards: 7 } },
  { id: "cumul", name: "Renvoi", emoji: "🔥", desc: "Les +2 et +4 se cumulent : renvoie la patate chaude au suivant !",
    set: { target: 0, stack: true, drawUntil: false, cards: 7 } },
  { id: "points", name: "Course à 500", emoji: "🏆", desc: "Plusieurs manches : le premier à 500 points gagne.",
    set: { target: 500, stack: false, drawUntil: false, cards: 7 } },
  { id: "chaos", name: "Chaos", emoji: "🌪️", desc: "10 cartes, cumul et pioche jusqu'à pouvoir jouer : ça déborde.",
    set: { target: 0, stack: true, drawUntil: true, cards: 10 } },
];
export function opt(settings, key) {
  const o = options.find((x) => x.key === key);
  const v = settings ? settings[key] : undefined;
  const hit = o.values.find((x) => String(x[0]) === String(v));
  return hit ? hit[0] : o.def;
}

// ------------------------------------------------ cartes
export const COLORS = ["R", "Y", "G", "B"];
export const COLOR_NAME = { R: "Rouge", Y: "Jaune", G: "Vert", B: "Bleu" };
export const colorOf = (c) => (c[0] === "W" ? null : c[0]);
export const valOf = (c) => (c[0] === "W" ? c : c.slice(1));
export const isWild = (c) => c[0] === "W";
export const isDraw = (c) => c === "W4" || valOf(c) === "D";
export const drawCount = (c) => (c === "W4" ? 4 : valOf(c) === "D" ? 2 : 0);

export function fullDeck() {
  const d = [];
  for (const col of COLORS) {
    d.push(col + "0");
    for (let k = 0; k < 2; k++) {
      for (let n = 1; n <= 9; n++) d.push(col + n);
      d.push(col + "D", col + "I", col + "P");
    }
  }
  for (let k = 0; k < 4; k++) d.push("W", "W4");
  return d; // 108 cartes
}

export const points = (c) => {
  if (isWild(c)) return 50;
  const v = valOf(c);
  return /^\d$/.test(v) ? +v : 20;
};
export const handPts = (hand) => hand.reduce((t, c) => t + points(c), 0);

export function label(c) {
  if (c === "W") return "Joker couleur";
  if (c === "W4") return "Joker +4";
  const v = valOf(c);
  const n = v === "D" ? "+2" : v === "I" ? "Inversion" : v === "P" ? "Passe ton tour" : v;
  return `${n} ${COLOR_NAME[colorOf(c)].toLowerCase()}`;
}

// ------------------------------------------------ partie
const nextIdx = (s, from, steps = 1) => {
  let i = from;
  for (let k = 0; k < steps; k++) i = (i + s.dir + s.order.length) % s.order.length;
  return i;
};
const top = (s) => s.discard[s.discard.length - 1];

function dealRound(s, rng) {
  const pile = rng.shuffle(fullDeck());
  const n = s.cards;
  const hands = {};
  for (let k = 0; k < s.order.length; k++) hands[s.order[(s.first + k) % s.order.length]] = pile.splice(0, n);
  // la première carte retournée est un chiffre
  const i = pile.findIndex((c) => /^[RYGB]\d$/.test(c));
  const first = pile.splice(i, 1)[0];
  Object.assign(s, { hands, pile, discard: [first], color: colorOf(first), cur: s.first, dir: 1,
    pending: 0, drawn: null, called: null, stuck: 0 });
}

export function setup(players, settings, rng) {
  const order = rng.shuffle(players.map((p) => p.id));
  const lv = +(settings && settings.level);
  const s = { order, hands: {}, pile: [], discard: [], color: "R", cur: 0, dir: 1,
    target: opt(settings, "target"), stack: opt(settings, "stack"), drawUntil: opt(settings, "drawUntil"),
    cards: opt(settings, "cards"), level: [1, 2, 3].includes(lv) ? lv : 2,
    pending: 0, drawn: null, called: null, stuck: 0, log: null, winner: null,
    manche: 1, first: 0, scores: Object.fromEntries(order.map((id) => [id, 0])), lastRound: null };
  dealRound(s, rng);
  return s;
}

export function toAct(s) { return s.winner ? [] : [s.order[s.cur]]; }

// la carte peut-elle être posée maintenant ?
export function canPlay(s, c) {
  if (s.pending > 0) {
    // une pioche est en attente (mode cumul) : seule une carte de pioche la renvoie
    if (c === "W4") return true;
    return valOf(c) === "D" && valOf(top(s)) === "D";
  }
  if (s.drawn && c !== s.drawn) return false;
  if (isWild(c)) return true;
  const t = top(s);
  return colorOf(c) === s.color || (!isWild(t) && valOf(c) === valOf(t));
}

function draw(s, n, seed) {
  const got = [];
  for (let k = 0; k < n; k++) {
    if (!s.pile.length) {
      if (s.discard.length <= 1) break;
      const t = s.discard.pop();
      s.pile = mkRng(seed + k).shuffle(s.discard);
      s.discard = [t];
    }
    got.push(s.pile.shift());
  }
  return got;
}

function endRound(s, winner, seed) {
  const got = {};
  let gain = 0;
  for (const id of s.order) { got[id] = handPts(s.hands[id]); if (id !== winner) gain += got[id]; }
  s.lastRound = { manche: s.manche, winner, gain, got };
  if (!s.target) { s.winner = winner; return; }
  s.scores[winner] += gain;
  if (s.scores[winner] >= s.target) { s.winner = winner; return; }
  s.manche++;
  s.first = (s.first + 1) % s.order.length;
  dealRound(s, mkRng(seed));
}

function passTurn(s, steps = 1) {
  s.drawn = null;
  s.called = null;
  s.cur = nextIdx(s, s.cur, steps);
}

export function reduce(s, pid, a) {
  if (toAct(s)[0] !== pid) fail("Ce n'est pas ton tour");
  const hand = s.hands[pid];
  const seed = a.seed || 1;

  if (a.type === "last") {
    if (hand.length !== 2) fail("Tu n'as pas deux cartes en main");
    s.called = pid;
    s.log = { id: pid, t: "last" };
    return s;
  }

  if (a.type === "draw") {
    if (s.drawn) fail("Tu as déjà pioché");
    if (s.pending > 0) {
      // on encaisse la pioche cumulée et on passe
      const got = draw(s, s.pending, seed);
      hand.push(...got);
      s.log = { id: pid, t: "take", n: got.length };
      s.pending = 0;
      passTurn(s);
      return s;
    }
    let got = [];
    if (s.drawUntil) {
      for (let k = 0; k < 40; k++) {
        const one = draw(s, 1, seed + k * 31);
        if (!one.length) break;
        got.push(one[0]);
        if (canPlayFresh(s, one[0])) break;
      }
    } else got = draw(s, 1, seed);
    hand.push(...got);
    const last = got[got.length - 1];
    s.log = { id: pid, t: "draw", n: got.length };
    if (last && canPlayFresh(s, last)) { s.drawn = last; return s; }
    // rien de jouable : le tour passe ; partie bloquée si plus rien à piocher pendant deux tours de table
    s.stuck = !got.length ? (s.stuck || 0) + 1 : 0;
    passTurn(s);
    if (s.stuck >= s.order.length * 2) {
      const best = s.order.slice().sort((x, y) => handPts(s.hands[x]) - handPts(s.hands[y]))[0];
      endRound(s, best, seed ^ 0x5bd1e995);
    }
    return s;
  }

  if (a.type === "pass") {
    if (!s.drawn) fail("Pioche d'abord une carte");
    s.log = { id: pid, t: "pass" };
    passTurn(s);
    return s;
  }

  if (a.type === "play") {
    const i = hand.indexOf(a.card);
    if (i < 0) fail("Carte absente");
    if (!canPlay(s, a.card)) fail(s.pending > 0 ? "Renvoie un +2 ou un +4, ou encaisse la pioche" : "Cette carte ne va pas");
    if (isWild(a.card) && !COLORS.includes(a.color)) fail("Choisis une couleur");
    hand.splice(i, 1);
    s.discard.push(a.card);
    s.color = isWild(a.card) ? a.color : colorOf(a.card);
    s.stuck = 0;
    s.log = { id: pid, t: "play", card: a.card, color: s.color };
    // annonce oubliée : pénalité automatique de 2 cartes
    if (hand.length === 1 && s.called !== pid) {
      const pen = draw(s, 2, seed + 101);
      hand.push(...pen);
      s.log.penalty = pen.length;
    }
    if (hand.length === 1 && s.called === pid) s.log.announced = true;
    if (!hand.length) { s.drawn = null; endRound(s, pid, seed ^ 0x5bd1e995); return s; }
    const n = s.order.length;
    const v = valOf(a.card);
    const dc = drawCount(a.card);
    if (dc) {
      if (s.stack) {
        s.pending += dc;
        s.log.pending = s.pending;
        passTurn(s);
      } else {
        const victimIdx = nextIdx(s, s.cur);
        const victim = s.order[victimIdx];
        const got = draw(s, dc, seed + 7);
        s.hands[victim].push(...got);
        s.log.victim = victim; s.log.n = got.length;
        passTurn(s, 2);
      }
    } else if (v === "I") {
      if (n === 2) { s.log.victim = s.order[nextIdx(s, s.cur)]; passTurn(s, 2); }
      else { s.dir = -s.dir; passTurn(s); }
    } else if (v === "P") {
      s.log.victim = s.order[nextIdx(s, s.cur)];
      passTurn(s, 2);
    } else passTurn(s);
    return s;
  }
  fail("Action inconnue");
}

// test de pose sans tenir compte de la carte piochée (utilisé pendant la pioche)
function canPlayFresh(s, c) {
  if (isWild(c)) return true;
  const t = top(s);
  return colorOf(c) === s.color || (!isWild(t) && valOf(c) === valOf(t));
}

export function result(s) {
  if (!s.winner) return null;
  // course aux points : le premier au seuil a forcément le plus gros total
  if (s.target) return { ranking: rankByScore(s.order.map((id) => ({ id, score: s.scores[id] }))) };
  // une manche : le gagnant marque les points des autres, les autres sont classés par main restante
  const rest = s.order.filter((id) => id !== s.winner).map((id) => ({ id, pts: handPts(s.hands[id]) })).sort((a, b) => a.pts - b.pts);
  const ranking = [{ id: s.winner, rank: 1, score: s.lastRound ? s.lastRound.gain : 0 }];
  let rank = 1, prev = null;
  rest.forEach((e, i) => {
    if (e.pts !== prev) { rank = i + 2; prev = e.pts; }
    ranking.push({ id: e.id, rank, score: -e.pts });
  });
  return { ranking };
}

// ------------------------------------------------ robots
function bestColor(hand, except) {
  const cnt = { R: 0, Y: 0, G: 0, B: 0 };
  hand.forEach((c) => { if (c !== except && !isWild(c)) cnt[colorOf(c)]++; });
  return COLORS.slice().sort((a, b) => cnt[b] - cnt[a])[0];
}

export function bot(s, pid, rng) {
  const hand = s.hands[pid];
  const lv = s.level || 2;
  const ok = hand.filter((c) => canPlay(s, c));
  // annoncer la dernière carte (les robots faciles oublient parfois)
  if (hand.length === 2 && ok.length && s.called !== pid) {
    const forget = lv === 1 ? 0.35 : lv === 2 ? 0.1 : 0;
    if (rng.next() >= forget) return { type: "last" };
  }
  if (!ok.length) return s.drawn ? { type: "pass" } : { type: "draw" };
  let card;
  if (lv === 1) card = rng.pick(ok);
  else {
    const next = s.order[nextIdx(s, s.cur)];
    const danger = (s.hands[next] || []).length <= 2;
    const score = (c) => {
      let v = 0;
      if (isWild(c)) v = lv === 3 ? -20 : -8; // garder les jokers pour la fin
      else v = points(c) / 5 + hand.filter((x) => colorOf(x) === colorOf(c)).length;
      if (drawCount(c) || valOf(c) === "P") v += danger ? 30 : lv === 3 ? 2 : 5;
      if (c === "W4" && danger) v += 25;
      return v;
    };
    ok.sort((a, b) => score(b) - score(a));
    card = ok[0];
  }
  const a = { type: "play", card };
  if (isWild(card)) a.color = lv === 1 ? rng.pick(COLORS) : bestColor(hand, card);
  return a;
}
export const auto = bot;
