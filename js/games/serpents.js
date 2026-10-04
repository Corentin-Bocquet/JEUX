import { fail, rng as mkRng } from "../engine.js";
import { opt, rollDie, walk, rankRace, parcoursDelay, nameIn } from "./lib/parcours.js";

export const meta = {
  id: "serpents", name: "Serpents et échelles", cat: "Plateau", min: 2, max: 6, turnTime: 20,
  color: "#65A30D", desc: "Lance le dé, grimpe aux échelles et évite les serpents jusqu'à la case 100.",
  rules: ["Chacun son tour, lance le dé et avance ton pion d'autant de cases.",
    "Tu tombes au pied d'une échelle : tu grimpes tout en haut. Sur la tête d'un serpent : tu glisses jusqu'à sa queue.",
    "Le premier qui atteint la case 100 gagne. Les autres sont classés selon leur case.",
    "Arrivée exacte (par défaut) : si tu dépasses 100, tu recules de l'excédent.",
    "Un 6 te fait rejouer (trois 6 de suite au maximum).",
    "Options : plateau (classique, jungle pleine de serpents, ou plein d'échelles), arrivée exacte ou non, rejouer sur un 6."],
};

// plateaux : échelles (L) et serpents (S), de -> vers
export const BOARDS = {
  classique: {
    L: { 1: 38, 4: 14, 9: 31, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 80: 100 },
    S: { 16: 6, 47: 26, 49: 11, 56: 53, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 98: 78 },
  },
  jungle: {
    L: { 3: 22, 8: 30, 28: 55, 58: 77, 75: 86 },
    S: { 17: 4, 25: 5, 34: 12, 39: 20, 46: 15, 52: 29, 63: 41, 69: 33, 74: 53, 89: 68, 94: 51, 97: 79, 99: 80 },
  },
  echelles: {
    L: { 2: 23, 7: 29, 15: 44, 27: 56, 33: 52, 40: 61, 54: 73, 63: 81, 70: 89, 78: 97 },
    S: { 19: 5, 47: 35, 66: 48, 85: 64, 93: 72, 98: 83 },
  },
};
export const GOAL = 100;

export const options = [
  { key: "board", label: "Plateau", icon: "🐍",
    values: [["classique", "Classique", "Équilibré"], ["jungle", "Jungle", "Plein de serpents"], ["echelles", "Échelles", "Ça grimpe vite"]], def: "classique" },
  { key: "exact", label: "Arrivée", icon: "🎯",
    values: [["rebond", "Rebond", "Recule l'excédent"], ["bloque", "Exacte", "Sinon tu restes"], ["libre", "Libre", "Dépasser suffit"]], def: "rebond" },
  { key: "six", label: "Rejouer sur 6", icon: "🎲",
    values: [[1, "Oui", "Encore un lancer"], [0, "Non", "Un lancer par tour"]], def: 1 },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "🪜", desc: "Plateau classique, arrivée exacte avec rebond, un 6 fait rejouer.", set: { board: "classique", exact: "rebond", six: 1 } },
  { id: "jungle", name: "Jungle", emoji: "🐍", desc: "Treize serpents t'attendent : gare à la case 99 !", set: { board: "jungle", exact: "rebond", six: 1 } },
  { id: "detente", name: "Détente", emoji: "🎈", desc: "Plein d'échelles et pas besoin d'arriver pile sur 100.", set: { board: "echelles", exact: "libre", six: 1 } },
  { id: "strict", name: "Pile poil", emoji: "📏", desc: "Il faut tomber pile sur 100, et un seul lancer par tour.", set: { board: "classique", exact: "bloque", six: 0 } },
];

export function setup(players, settings, r) {
  const order = r.shuffle(players.map((p) => p.id));
  return {
    order, names: Object.fromEntries(players.map((p) => [p.id, p.name])),
    board: opt(options, settings, "board"), exact: opt(options, settings, "exact"), six: opt(options, settings, "six"),
    pos: Object.fromEntries(order.map((id) => [id, 0])), cur: 0, sixes: 0, mv: 0, winner: null, last: null,
  };
}

export const toAct = (s) => (s.winner ? [] : [s.order[s.cur]]);

// calcule le déplacement d'un pion (frames d'animation comprises)
export function moveOf(s, pid, d) {
  const B = BOARDS[s.board] || BOARDS.classique;
  const from = s.pos[pid];
  let to = from + d, frames = [], txt = "";
  if (to > GOAL) {
    if (s.exact === "libre") { to = GOAL; frames = walk(pid, from, GOAL); }
    else if (s.exact === "bloque") { to = from; txt = ` : il faut tomber pile sur ${GOAL}, tu restes sur ${from}`; }
    else { to = 2 * GOAL - to; frames = [...walk(pid, from, GOAL), ...walk(pid, GOAL, to)]; txt = ` : rebond jusqu'à ${to}`; }
  } else frames = walk(pid, from, to);
  if (!txt) txt = ` : case ${to}`;
  let jump = null;
  if (B.L[to]) { jump = "L"; txt += `, une échelle jusqu'à ${B.L[to]} !`; to = B.L[to]; frames.push([pid, to, "j"]); }
  else if (B.S[to]) { jump = "S"; txt += `, un serpent ! Retour en ${B.S[to]}`; to = B.S[to]; frames.push([pid, to, "j"]); }
  return { to, frames, txt, jump };
}

export function reduce(s, pid, a) {
  if (!toAct(s).includes(pid)) fail("Ce n'est pas ton tour");
  if (a.type !== "roll") fail("Action inconnue");
  const d = rollDie(mkRng(a.seed));
  const m = moveOf(s, pid, d);
  s.pos[pid] = m.to;
  s.mv++;
  let msg = `${nameIn(s, pid)} fait ${d}${m.txt}`;
  let again = false;
  if (m.to === GOAL) { s.winner = pid; msg += " Victoire !"; }
  else if (d === 6 && s.six && s.sixes < 2) { again = true; s.sixes++; msg += " Il rejoue."; }
  else { s.sixes = 0; s.cur = (s.cur + 1) % s.order.length; }
  s.last = { n: s.mv, pid, dice: [d], frames: m.frames, msg, jump: m.jump, again };
  return s;
}

export function result(s) {
  if (!s.winner) return null;
  return { ranking: rankRace(s.order, (id) => s.pos[id], [s.winner]) };
}

export const bot = () => ({ type: "roll" });
export const auto = bot;
export const botDelay = (s) => parcoursDelay(s);
