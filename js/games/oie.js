import { fail, rng as mkRng } from "../engine.js";
import { opt, rollDie, walk, rankRace, parcoursDelay, nameIn } from "./lib/parcours.js";

export const meta = {
  id: "oie", name: "Jeu de l'oie", cat: "Plateau", min: 2, max: 6, turnTime: 20,
  color: "#EAB308", desc: "Le grand classique : 63 cases, des oies qui doublent ton lancer et des pièges partout.",
  rules: ["Lance les deux dés et avance du total. Le premier qui arrive pile sur la case 63 gagne.",
    "Si tu dépasses 63, tu recules de l'excédent.",
    "Oie (5, 9, 14, 18...) : tu avances encore du même nombre.",
    "Pont (6) : file en 12. Hôtellerie (19) : passe deux tours. Labyrinthe (42) : retourne en 30. Tête de mort (58) : retour au départ.",
    "Puits (31) et prison (52) : tu restes bloqué jusqu'à ce qu'un autre joueur tombe sur ta case et te délivre.",
    "Depuis le départ, 6 et 3 t'envoient en 26, 5 et 4 en 53.",
    "Case occupée : le joueur qui y était prend ta place de départ.",
    "Options : un seul dé, partage des cases, puits et prison limités à quelques tours."],
};

export const GOAL = 63;
export const OIES = [5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54, 59];
// cases spéciales : [nom, emoji]
export const SPECIAL = {
  6: ["Pont", "🌉"], 19: ["Hôtellerie", "🏨"], 31: ["Puits", "🕳️"], 42: ["Labyrinthe", "🌀"],
  52: ["Prison", "🔒"], 58: ["Tête de mort", "💀"], 63: ["Arrivée", "🏁"],
};
const JUMPS = { 6: 12, 42: 30, 58: 0 };

export const options = [
  { key: "dice", label: "Dés", icon: "🎲",
    values: [[2, "2 dés", "Classique"], [1, "1 dé", "Partie longue"]], def: 2 },
  { key: "swap", label: "Case occupée", icon: "🔄",
    values: [[1, "Échange", "Il prend ta place"], [0, "Partage", "Chacun reste"]], def: 1 },
  { key: "trap", label: "Puits, prison", icon: "🔒",
    values: [["secours", "Secours", "Attends un sauveur"], ["tours", "Tours", "2 ou 3 tours"]], def: "secours" },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "🪿", desc: "Deux dés, échange de place, puits et prison jusqu'à ce qu'on te délivre.", set: { dice: 2, swap: 1, trap: "secours" } },
  { id: "petitspas", name: "Petits pas", emoji: "🐾", desc: "Un seul dé : la partie dure plus longtemps.", set: { dice: 1, swap: 1, trap: "secours" } },
  { id: "tranquille", name: "Tranquille", emoji: "🌼", desc: "On partage les cases et les pièges ne durent que quelques tours.", set: { dice: 2, swap: 0, trap: "tours" } },
  { id: "famille", name: "En famille", emoji: "🏡", desc: "Un dé, cases partagées, pièges courts : idéal avec les petits.", set: { dice: 1, swap: 0, trap: "tours" } },
];

export function setup(players, settings, r) {
  const order = r.shuffle(players.map((p) => p.id));
  return {
    order, names: Object.fromEntries(players.map((p) => [p.id, p.name])),
    dice: opt(options, settings, "dice"), swap: opt(options, settings, "swap"), trap: opt(options, settings, "trap"),
    pos: Object.fromEntries(order.map((id) => [id, 0])),
    wait: Object.fromEntries(order.map((id) => [id, 0])), // tours à passer
    stuck: Object.fromEntries(order.map((id) => [id, 0])), // case du puits ou de la prison (0 = libre)
    cur: 0, mv: 0, winner: null, last: null,
  };
}

export const toAct = (s) => (s.winner ? [] : [s.order[s.cur]]);

// déplacement complet d'un pion (oies, pont, labyrinthe...), sans les effets sur les autres joueurs
export function moveOf(from, dice) {
  const tot = dice.reduce((a, b) => a + b, 0);
  const frames = [], txt = [];
  let pos = from, dir = 1;
  const go = (n) => {
    let to = pos + dir * n;
    if (to > GOAL) {
      frames.push(...walk("*", pos, GOAL));
      pos = GOAL; to = 2 * GOAL - to; dir = -1;
      txt.push(`recule jusqu'en ${to}`);
    }
    if (to < 0) to = 0;
    frames.push(...walk("*", pos, to));
    pos = to;
  };
  // départ : 6 + 3 -> 26, 5 + 4 -> 53
  if (from === 0 && dice.length === 2 && tot === 9) {
    pos = dice.includes(3) ? 26 : 53;
    frames.push(["*", pos, "j"]);
    txt.push(`un ${dice[0]} et un ${dice[1]} au départ : direct en ${pos} !`);
    return { to: pos, frames, txt };
  }
  go(tot);
  for (let guard = 0; guard < 20; guard++) {
    if (pos !== GOAL && OIES.includes(pos)) { txt.push(`une oie en ${pos}, encore ${tot}`); go(tot); continue; }
    if (JUMPS[pos] != null) {
      const [nm] = SPECIAL[pos];
      const to = JUMPS[pos];
      txt.push(pos === 58 ? "la tête de mort : retour au départ" : `${nm} : direction ${to}`);
      pos = to; frames.push(["*", pos, "j"]);
    }
    break;
  }
  return { to: pos, frames, txt };
}

// passe au joueur suivant en appliquant hôtellerie, puits et prison
function nextTurn(s, msgs) {
  const n = s.order.length;
  let i = s.cur;
  for (let k = 0; k < n * 6; k++) {
    i = (i + 1) % n;
    const q = s.order[i];
    if (s.wait[q] > 0) {
      s.wait[q]--;
      msgs.push(`${nameIn(s, q)} passe son tour (${s.wait[q] ? "encore 1" : "dernier"}).`);
      continue;
    }
    if (s.stuck[q]) {
      if (s.order.every((x) => s.stuck[x])) {
        s.stuck[q] = 0;
        msgs.push(`Tout le monde est coincé : ${nameIn(s, q)} est libéré.`);
      } else {
        msgs.push(`${nameIn(s, q)} attend qu'on le délivre (${SPECIAL[s.pos[q]][0].toLowerCase()}).`);
        continue;
      }
    }
    s.cur = i;
    return;
  }
  s.cur = i;
}

export function reduce(s, pid, a) {
  if (!toAct(s).includes(pid)) fail("Ce n'est pas ton tour");
  if (a.type !== "roll") fail("Action inconnue");
  const r = mkRng(a.seed);
  const dice = Array.from({ length: s.dice === 1 ? 1 : 2 }, () => rollDie(r));
  const from = s.pos[pid];
  const m = moveOf(from, dice);
  const frames = m.frames.map((f) => [pid, f[1], f[2]]);
  const to = m.to;
  const nm = nameIn(s, pid);
  const tot = dice.reduce((x, y) => x + y, 0);
  const msgs = [`${nm} fait ${tot}${m.txt.length ? ", " + m.txt.join(", ") : ""} : case ${to}.`];
  s.pos[pid] = to;
  // case occupée : délivrance du puits ou de la prison, échange de place
  const others = s.order.filter((x) => x !== pid && s.pos[x] === to && to !== 0);
  for (const o of others) {
    if (s.stuck[o]) { s.stuck[o] = 0; msgs.push(`${nameIn(s, o)} est délivré !`); }
  }
  if (s.swap && others.length && to !== GOAL) {
    const o = others[0];
    s.pos[o] = from; s.wait[o] = 0; s.stuck[o] = 0;
    frames.push([o, from, "j"]);
    msgs.push(`${nameIn(s, o)} prend sa place en ${from}.`);
  }
  // effets de la case d'arrivée
  if (to === 19) { s.wait[pid] = 2; msgs.push(`${nm} se repose à l'hôtellerie : deux tours sans jouer.`); }
  if (to === 31 || to === 52) {
    if (s.trap === "tours") { s.wait[pid] = to === 31 ? 2 : 3; msgs.push(`${nm} est ${to === 31 ? "au fond du puits" : "en prison"} pour ${s.wait[pid]} tours.`); }
    else { s.stuck[pid] = to; msgs.push(`${nm} est ${to === 31 ? "au fond du puits" : "en prison"} : il faut qu'on vienne le délivrer.`); }
  }
  s.mv++;
  if (to === GOAL) { s.winner = pid; msgs.push(`${nm} gagne la partie !`); }
  else nextTurn(s, msgs);
  s.last = { n: s.mv, pid, dice, frames, msg: msgs.join(" ") };
  return s;
}

export function result(s) {
  if (!s.winner) return null;
  return { ranking: rankRace(s.order, (id) => s.pos[id], [s.winner]) };
}

export const bot = () => ({ type: "roll" });
export const auto = bot;
export const botDelay = (s) => parcoursDelay(s);
