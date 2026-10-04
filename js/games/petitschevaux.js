import { fail, rng as mkRng } from "../engine.js";
import { opt, rollDie, rankRace, parcoursDelay, nameIn } from "./lib/parcours.js";

export const meta = {
  id: "petitschevaux", name: "Petits chevaux", cat: "Plateau", min: 2, max: 4, turnTime: 25,
  color: "#0EA5E9", desc: "Sors tes chevaux avec un 6, fais le tour du plateau et monte l'escalier jusqu'au centre.",
  rules: ["Il faut un 6 pour sortir un cheval de l'écurie. Un 6 te fait toujours rejouer.",
    "À chaque lancer, choisis le cheval qui avance (touche-le).",
    "Tu tombes pile sur un cheval adverse : il retourne à son écurie. Deux de tes chevaux ne peuvent pas partager une case.",
    "Après un tour complet, ton cheval doit s'arrêter pile devant son escalier.",
    "Escalier : il faut un 1 pour monter sur la marche 1, puis un 2, un 3... et un 6 pour atteindre le centre.",
    "Le premier qui amène tous ses chevaux au centre gagne.",
    "Options : 2 ou 4 chevaux, sortir aussi avec un 1, escalier libre (on monte du nombre de points)."],
};

// plateau 15 x 15 : 52 cases de parcours, chaque couleur part de 13 * c
export const TRACK = 52;
export const FRONT = 50; // case devant l'escalier (en progression relative)
export const END = 56;   // marche 6 = centre
export const HCOLORS = [0, 2, 1, 3]; // couleurs des petits chevaux : rouge, vert, bleu, jaune (voir la vue)

export const options = [
  { key: "horses", label: "Chevaux", icon: "🐴",
    values: [[4, "4", "Classique"], [2, "2", "Partie rapide"]], def: 4 },
  { key: "exit", label: "Pour sortir", icon: "🚪",
    values: [["6", "Un 6", "Classique"], ["16", "Un 1 ou un 6", "Plus facile"]], def: "6" },
  { key: "stairs", label: "Escalier", icon: "🪜",
    values: [["marches", "1 à 6", "Marche par marche"], ["libre", "Libre", "Avance du dé"]], def: "marches" },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "🐴", desc: "4 chevaux, un 6 pour sortir, escalier marche par marche.", set: { horses: 4, exit: "6", stairs: "marches" } },
  { id: "rapide", name: "Rapide", emoji: "⚡", desc: "Seulement 2 chevaux chacun, mêmes règles.", set: { horses: 2, exit: "6", stairs: "marches" } },
  { id: "facile", name: "Facile", emoji: "🌈", desc: "On sort aussi avec un 1 et l'escalier se monte du nombre de points.", set: { horses: 4, exit: "16", stairs: "libre" } },
  { id: "eclair", name: "Éclair", emoji: "🌩️", desc: "2 chevaux, sortie avec 1 ou 6, escalier libre : ça file !", set: { horses: 2, exit: "16", stairs: "libre" } },
];

// couleur (0 rouge, 1 vert, 2 bleu, 3 jaune) selon le nombre de joueurs : face à face à deux
const SEATS = { 2: [0, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3] };

export function setup(players, settings, r) {
  const order = r.shuffle(players.map((p) => p.id));
  const n = opt(options, settings, "horses");
  const seats = SEATS[order.length] || SEATS[4];
  return {
    order, names: Object.fromEntries(players.map((p) => [p.id, p.name])),
    seat: Object.fromEntries(order.map((id, i) => [id, seats[i]])),
    horses: n, exit: opt(options, settings, "exit"), stairs: opt(options, settings, "stairs"),
    // progression de chaque cheval : -1 écurie, 0..51 parcours, 51..56 escalier (56 = centre)
    h: Object.fromEntries(order.map((id) => [id, Array(n).fill(-1)])),
    cur: 0, phase: "roll", die: 0, mv: 0, winner: null, last: null,
    level: [1, 2, 3].includes(settings.level) ? settings.level : 2,
  };
}

export const toAct = (s) => (s.winner ? [] : [s.order[s.cur]]);
export const absOf = (s, pid, rel) => (rel < 0 || rel > FRONT ? -1 : (s.seat[pid] * 13 + rel) % TRACK);
const canExit = (s, d) => d === 6 || (s.exit === "16" && d === 1);

// cible d'un cheval pour un dé, ou null si le coup est interdit
export function target(s, pid, k, d) {
  const p = s.h[pid][k];
  if (p >= END) return null;
  let to;
  if (p < 0) { if (!canExit(s, d)) return null; to = 0; }
  else if (s.stairs === "marches") {
    if (p >= FRONT) { if (d !== p - FRONT + 1) return null; to = p + 1; }
    else { to = p + d; if (to > FRONT) return null; }
  } else { to = p + d; if (to > END) return null; }
  // pas deux chevaux de la même couleur sur une case du parcours ou de l'escalier (sauf le centre)
  if (to < END && s.h[pid].some((q, j) => j !== k && q === to)) return null;
  return to;
}

export function legalMoves(s, pid, d = s.die) {
  const out = [];
  let stableDone = false;
  s.h[pid].forEach((p, k) => {
    if (p < 0) { if (stableDone) return; stableDone = true; }
    const to = target(s, pid, k, d);
    if (to != null) out.push(k);
  });
  return out;
}

// adversaires présents sur une case absolue du parcours
function victimsAt(s, pid, abs) {
  const out = [];
  for (const o of s.order) {
    if (o === pid) continue;
    s.h[o].forEach((q, j) => { if (absOf(s, o, q) === abs) out.push([o, j]); });
  }
  return out;
}

function doMove(s, pid, k, msgs, frames) {
  const d = s.die;
  const from = s.h[pid][k];
  const to = target(s, pid, k, d);
  const key = pid + ":" + k;
  const nm = nameIn(s, pid);
  if (from < 0) { frames.push([key, 0, "j"]); msgs.push(`${nm} sort un cheval.`); }
  else for (let p = from + 1; p <= to; p++) frames.push([key, p, "s"]);
  s.h[pid][k] = to;
  const abs = absOf(s, pid, to);
  if (abs >= 0) for (const [o, j] of victimsAt(s, pid, abs)) {
    s.h[o][j] = -1;
    frames.push([o + ":" + j, -1, "j"]);
    msgs.push(`${nm} renvoie un cheval de ${nameIn(s, o)} à l'écurie !`);
  }
  if (to === END) msgs.push(`Un cheval de ${nm} arrive au centre !`);
  else if (to > FRONT) msgs.push(`${nm} monte sur la marche ${to - FRONT}.`);
  else if (to === FRONT && from >= 0) msgs.push(`${nm} est devant son escalier.`);
}

const done = (s, pid) => s.h[pid].every((p) => p >= END);

function endTurn(s, pid, msgs) {
  if (done(s, pid)) { s.winner = pid; msgs.push(`${nameIn(s, pid)} gagne la partie !`); return; }
  s.phase = "roll";
  if (s.die === 6) msgs.push(`${nameIn(s, pid)} rejoue.`);
  else s.cur = (s.cur + 1) % s.order.length;
}

export function reduce(s, pid, a) {
  if (!toAct(s).includes(pid)) fail("Ce n'est pas ton tour");
  const msgs = [], frames = [];
  s.mv++;
  if (a.type === "roll") {
    if (s.phase !== "roll") fail("Choisis d'abord un cheval");
    s.die = rollDie(mkRng(a.seed));
    const legal = legalMoves(s, pid);
    msgs.push(`${nameIn(s, pid)} fait ${s.die}.`);
    if (!legal.length) { msgs.push("Aucun cheval ne peut bouger."); endTurn(s, pid, msgs); }
    else if (legal.length === 1) { doMove(s, pid, legal[0], msgs, frames); endTurn(s, pid, msgs); }
    else if (a.pick) {
      // robot (ou temps écoulé) : lance et choisit dans la foulée, en une seule action
      s.phase = "move";
      const k = bestMove(s, pid, mkRng((a.seed ^ 0x5bd1e995) >>> 0));
      doMove(s, pid, k, msgs, frames); endTurn(s, pid, msgs);
    } else { s.phase = "move"; msgs.push("Quel cheval avance ?"); }
    s.last = { n: s.mv, pid, dice: [s.die], frames, msg: msgs.join(" ") };
    return s;
  }
  if (a.type === "move") {
    if (s.phase !== "move") fail("Lance d'abord le dé");
    const k = a.h | 0;
    if (!(k >= 0 && k < s.horses)) fail("Cheval inconnu");
    const legal = legalMoves(s, pid);
    // un cheval de l'écurie : n'importe lequel compte comme « sortir »
    const ok = legal.includes(k) || (s.h[pid][k] < 0 && legal.some((j) => s.h[pid][j] < 0));
    if (!ok) fail("Ce cheval ne peut pas avancer de " + s.die);
    doMove(s, pid, k, msgs, frames);
    endTurn(s, pid, msgs);
    s.last = { n: s.mv, pid, dice: null, frames, msg: msgs.join(" ") };
    return s;
  }
  fail("Action inconnue");
}

export function result(s) {
  if (!s.winner) return null;
  const arrived = (id) => s.h[id].filter((p) => p >= END).length;
  const prog = (id) => s.h[id].reduce((t, p) => t + p + 1, 0);
  // score affiché = chevaux arrivés ; à égalité, le plus avancé passe devant
  const rk = rankRace(s.order, (id) => arrived(id) * 1000 + prog(id), [s.winner]);
  return { ranking: rk.map((x) => ({ ...x, score: arrived(x.id) })) };
}

// ---------------- robot : prendre, sortir, se mettre à l'abri, avancer
// menace : un cheval adverse sur le parcours entre 1 et 6 cases derrière la case absolue
function threat(s, pid, abs, ignore) {
  if (abs < 0) return 0;
  let n = 0;
  for (const o of s.order) {
    if (o === pid) continue;
    s.h[o].forEach((q, j) => {
      if (ignore && ignore[0] === o && ignore[1] === j) return;
      const qa = absOf(s, o, q);
      if (qa >= 0) {
        const dist = (abs - qa + TRACK) % TRACK;
        // l'adversaire ne repasse pas devant son propre escalier
        if (dist >= 1 && dist <= 6 && q + dist <= FRONT) n++;
      } else if (q < 0) {
        // cheval en écurie qui peut sortir sur sa case de départ
        if (abs === s.seat[o] * 13) n += 0.3;
      }
    });
  }
  return n;
}

export function scoreMove(s, pid, k) {
  const from = s.h[pid][k];
  const to = target(s, pid, k, s.die);
  const abs = absOf(s, pid, to);
  const vict = abs >= 0 ? victimsAt(s, pid, abs) : [];
  let v = 0;
  if (vict.length) v += 100 + vict.reduce((t, [o, j]) => t + s.h[o][j], 0);
  if (from < 0) v += 60;
  if (to === END) v += 80;
  else if (to > FRONT) v += 55;
  else if (to === FRONT) v += 45;
  const before = threat(s, pid, absOf(s, pid, from));
  const after = threat(s, pid, abs, vict[0]);
  if (from >= 0 && before > 0 && after === 0) v += 35 + from / 4; // mise à l'abri
  v -= after * (20 + Math.max(0, to) / 3);
  v += (to - Math.max(from, 0)) * 0.5 + Math.max(from, 0) / 20;
  return v;
}

function bestMove(s, pid, r) {
  const legal = legalMoves(s, pid);
  if (s.level === 1 && r.next() < 0.5) return r.pick(legal);
  let best = -Infinity, pick = legal[0];
  for (const k of legal) {
    const v = scoreMove(s, pid, k) + (s.level === 2 ? r.next() * 12 : 0);
    if (v > best) { best = v; pick = k; }
  }
  return pick;
}

// le robot lance et choisit son cheval en une seule action (pick) pour garder un bon rythme
export function bot(s, pid, r) {
  if (s.phase === "roll") return { type: "roll", pick: true };
  if (!legalMoves(s, pid).length) return null;
  return { type: "move", h: bestMove(s, pid, r) };
}
export const auto = bot;
export const botDelay = (s) => parcoursDelay(s) - (s.phase === "move" ? 120 : 0);
