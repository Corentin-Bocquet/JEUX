import { fail, rankByScore } from "../engine.js";

export const meta = {
  id: "solitaire", name: "Solitaire", cat: "Cartes", min: 1, max: 8, turnTime: 0, race: true,
  color: "#15803D", desc: "La même donne pour tous : le premier qui range tout gagne.",
  rules: ["Tout le monde reçoit exactement la même donne de Klondike et joue sur son propre tapis.",
    "Range les 52 cartes sur les 4 fondations, de l'As au Roi, couleur par couleur.",
    "Sur le tapis, descends en alternant rouge et noir (un 6 rouge sur un 7 noir). Seul un Roi va sur une colonne vide.",
    "Touche la pioche pour retourner 1 carte (ou 3). Touche une carte : elle part toute seule au meilleur endroit. Tu peux aussi la glisser.",
    "Points (comme sous Windows) : +10 par carte en fondation, +5 par carte retournée ou jouée depuis la pioche, -15 si tu reprends une carte de fondation, -20 chaque fois que tu remets la pioche en place, gros bonus de rapidité si tu finis.",
    "La partie s'arrête dès que quelqu'un a tout rangé, quand tout le monde est bloqué ou a abandonné, ou à la fin du temps limite.",
    "Options : 1 ou 3 cartes, nombre de passages dans la pioche, temps limite, classement aux points ou aux cartes rangées."],
};

// ------------------------------------------------ réglages
export const options = [
  { key: "draw", label: "Pioche", icon: "🂠", values: [[1, "1 carte", "Plus facile"], [3, "3 cartes", "Plus corsé"]], def: 1 },
  { key: "passes", label: "Passages", icon: "🔁", values: [[0, "Illimités"], [3, "3", "Tours de pioche"], [1, "1", "Une seule fois"]], def: 0 },
  { key: "limit", label: "Temps limite", icon: "⏱️", values: [[5, "5 min", "Éclair"], [10, "10 min", "Standard"], [15, "15 min", "Tranquille"]], def: 10 },
  { key: "scoring", label: "Classement", icon: "🏆", values: [["pts", "Points", "Façon Windows"], ["cards", "Cartes", "Cartes rangées"]], def: "pts" },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "🂡", desc: "1 carte à la fois, pioche illimitée, 10 minutes, points Windows.",
    set: { draw: 1, passes: 0, limit: 10, scoring: "pts" } },
  { id: "eclair", name: "Éclair", emoji: "⚡", desc: "5 minutes chrono : celui qui range le plus de cartes gagne.",
    set: { draw: 1, passes: 0, limit: 5, scoring: "cards" } },
  { id: "expert", name: "Expert", emoji: "🧠", desc: "3 cartes à la fois et seulement 3 passages dans la pioche.",
    set: { draw: 3, passes: 3, limit: 10, scoring: "pts" } },
  { id: "vegas", name: "Las Vegas", emoji: "🎰", desc: "1 carte, un seul passage dans la pioche, 15 minutes.",
    set: { draw: 1, passes: 1, limit: 15, scoring: "cards" } },
];
export function opt(settings, key) {
  const o = options.find((x) => x.key === key);
  const v = settings ? settings[key] : undefined;
  const hit = o.values.find((x) => x[0] === v || (v != null && String(x[0]) === String(v)));
  return hit ? hit[0] : o.def;
}

// ------------------------------------------------ cartes
export const FS = ["S", "H", "D", "C"]; // ordre des fondations
const RN = { A: 1, J: 11, Q: 12, K: 13 };
export const rankN = (c) => { const r = c.slice(0, -1); return RN[r] || +r; };
export const suitOf = (c) => c.slice(-1);
export const red = (c) => suitOf(c) === "H" || suitOf(c) === "D";
const RS = { 1: "A", 11: "J", 12: "Q", 13: "K" };
export const deck52 = () => { const d = []; for (const s of FS) for (let r = 1; r <= 13; r++) d.push((RS[r] || r) + s); return d; };

export function setup(players, settings, rng) {
  const cards = rng.shuffle(deck52());
  const t = [], d = [];
  for (let i = 0; i < 7; i++) { t.push(cards.splice(0, i + 1)); d.push(i); }
  const p = {};
  for (const pl of players) {
    p[pl.id] = { t: t.map((c) => c.slice()), d: d.slice(), st: cards.slice(), w: [], f: [0, 0, 0, 0],
      score: 0, moves: 0, rec: 0, status: "play", time: 0, idle: 0 };
  }
  return { ids: players.map((x) => x.id), p, draw: opt(settings, "draw"), passes: opt(settings, "passes"), limit: opt(settings, "limit"),
    scoring: opt(settings, "scoring"), level: [1, 2, 3].includes(settings.level) ? settings.level : 2, done: false, endBy: null, last: null };
}

export const fCount = (P) => P.f.reduce((a, b) => a + b, 0);
export const deadline = (s) => (s.startedAt || 0) + s.limit * 60000;
export function toAct(s) { return s.done ? [] : s.ids.filter((id) => s.p[id].status === "play"); }

// recycler la pioche est-il encore permis ?
export const canRecycle = (s, P) => P.w.length > 0 && (!s.passes || P.rec < s.passes - 1);

// carte (et paquet) prise à une origine : "w", "f0".."f3", "t0".."t6"
function takeFrom(s, P, from, n) {
  if (from === "w") { if (!P.w.length || n !== 1) return null; return [P.w[P.w.length - 1]]; }
  if (/^f[0-3]$/.test(from)) { const k = +from[1]; if (!P.f[k] || n !== 1) return null; return [(RS[P.f[k]] || P.f[k]) + FS[k]]; }
  if (/^t[0-6]$/.test(from)) {
    const i = +from[1], col = P.t[i];
    if (!(n >= 1) || n > col.length - P.d[i]) return null;
    return col.slice(col.length - n);
  }
  return null;
}

export function fits(P, cards, to) {
  const c = cards[0];
  if (to === "f" || /^f[0-3]$/.test(to)) {
    if (cards.length !== 1) return false;
    const k = FS.indexOf(suitOf(c));
    if (to !== "f" && +to[1] !== k) return false;
    return P.f[k] === rankN(c) - 1;
  }
  if (/^t[0-6]$/.test(to)) {
    const col = P.t[+to[1]];
    if (!col.length) return rankN(c) === 13;
    const top = col[col.length - 1];
    return red(top) !== red(c) && rankN(top) === rankN(c) + 1;
  }
  return false;
}

// tous les coups utiles d'un joueur (sans les retours de fondation ni les Rois qui changent de colonne vide pour rien)
export function movesOf(P) {
  const out = [];
  const srcs = [];
  if (P.w.length) srcs.push({ from: "w", n: 1 });
  for (let i = 0; i < 7; i++) {
    const col = P.t[i];
    for (let n = 1; n <= col.length - P.d[i]; n++) srcs.push({ from: "t" + i, n });
  }
  for (const sr of srcs) {
    const cards = takeFrom(null, P, sr.from, sr.n);
    if (sr.n === 1 && fits(P, cards, "f")) out.push({ ...sr, to: "f" });
    for (let j = 0; j < 7; j++) {
      if (sr.from === "t" + j) continue;
      if (!fits(P, cards, "t" + j)) continue;
      // Roi déjà en tête de colonne vers une colonne vide : inutile
      if (!P.t[j].length && sr.from[0] === "t" && sr.n === P.t[+sr.from[1]].length) continue;
      out.push({ ...sr, to: "t" + j });
    }
  }
  return out;
}
export const blocked = (s, P) => !P.st.length && !canRecycle(s, P) && !movesOf(P).length;

const addPts = (P, n) => { P.score = Math.max(0, P.score + n); };

function doMove(s, P, from, n, to) {
  const cards = takeFrom(s, P, from, n);
  if (!cards) fail("Rien à déplacer ici");
  if (!fits(P, cards, to)) fail(to[0] === "f" ? "Cette carte ne monte pas en fondation" : "Cette carte ne va pas ici");
  // retirer
  if (from === "w") P.w.pop();
  else if (from[0] === "f") P.f[+from[1]]--;
  else P.t[+from[1]].splice(P.t[+from[1]].length - n, n);
  // poser
  if (to[0] === "f") P.f[FS.indexOf(suitOf(cards[0]))]++;
  else P.t[+to[1]].push(...cards);
  // points façon Windows
  if (to[0] === "f" && from[0] !== "f") addPts(P, 10);
  if (from === "w" && to[0] === "t") addPts(P, 5);
  if (from[0] === "f" && to[0] === "t") addPts(P, -15);
  // retourner la carte découverte
  if (from[0] === "t") {
    const i = +from[1];
    if (P.t[i].length && P.d[i] >= P.t[i].length) { P.d[i] = P.t[i].length - 1; addPts(P, 5); }
  }
  P.moves++; P.idle = 0;
  return cards;
}

function finish(s, now, by) {
  s.done = true; s.endBy = by;
  for (const id of s.ids) if (s.p[id].status === "play") s.p[id].status = by === "time" ? "time" : "play";
}

export function reduce(s, pid, a) {
  if (!s.ids.includes(pid)) fail("Tu ne joues pas");
  if (s.done) fail("La partie est terminée");
  const now = a.now || 0;
  if (now >= deadline(s) && s.startedAt) { finish(s, now, "time"); return s; }
  if (a.type === "tick") return s;
  const P = s.p[pid];
  if (P.status !== "play") fail("Tu as fini ta partie");
  if (a.type === "giveup") {
    P.status = a.stuck ? "stuck" : "out";
    s.last = { id: pid, t: P.status };
  } else if (a.type === "draw") {
    if (P.st.length) {
      for (let k = 0; k < s.draw && P.st.length; k++) P.w.push(P.st.pop());
      s.last = { id: pid, t: "draw" };
    } else if (canRecycle(s, P)) {
      P.st = P.w.reverse(); P.w = []; P.rec++;
      addPts(P, -20);
      s.last = { id: pid, t: "recycle" };
    } else fail(P.w.length ? "Plus de passage autorisé dans la pioche" : "La pioche est vide");
    P.moves++; P.idle++;
  } else if (a.type === "move") {
    const from = String(a.from || ""), to = String(a.to || "");
    const cards = doMove(s, P, from, a.n == null ? 1 : a.n | 0, to);
    s.last = { id: pid, t: "move", card: cards[0], to };
  } else if (a.type === "auto") {
    let n = 0, go = true;
    while (go) {
      go = false;
      const srcs = ["w", "t0", "t1", "t2", "t3", "t4", "t5", "t6"];
      for (const fr of srcs) {
        const c = takeFrom(s, P, fr, 1);
        if (c && fits(P, c, "f")) { doMove(s, P, fr, 1, "f"); n++; go = true; }
      }
    }
    if (!n) fail("Aucune carte ne peut monter en fondation");
    s.last = { id: pid, t: "auto", n };
  } else fail("Action inconnue");
  if (fCount(P) === 52) {
    P.status = "won";
    P.time = Math.max(1, now - (s.startedAt || now));
    const secs = Math.round(P.time / 1000);
    P.bonus = secs >= 30 ? Math.round(700000 / secs) : 0;
    P.score += P.bonus;
    finish(s, now, "won");
    return s;
  }
  if (P.status === "play" && blocked(s, P)) { P.status = "stuck"; s.last = { id: pid, t: "stuck" }; }
  if (!toAct(s).length) finish(s, now, "all");
  return s;
}

export const scoreOfP = (s, id) => (s.scoring === "cards" ? fCount(s.p[id]) : s.p[id].score);

export function result(s) {
  if (!s.done) return null;
  return { ranking: rankByScore(s.ids.map((id) => ({ id, score: scoreOfP(s, id) }))) };
}

// ------------------------------------------------ robot
// stratégie simple : fondation, découvrir les cartes cachées, jouer la pioche, sinon retourner la pioche
export function bot(s, pid, rng) {
  if (s.done) return null;
  const P = s.p[pid];
  if (!P || P.status !== "play") return null;
  const lvl = s.level || 2;
  const ms = movesOf(P);
  const lazy = lvl === 1 && rng.next() < 0.25; // le robot facile rate parfois un coup
  // 1. fondation (le robot fort garde les cartes basses utiles au tapis)
  const toF = ms.filter((m) => m.to === "f");
  for (const m of toF) {
    const c = takeFrom(s, P, m.from, 1)[0];
    if (lvl < 3 || safeUp(P, c)) return { type: "move", ...m };
  }
  // 2. déplacer toute la partie visible d'une colonne pour retourner une carte cachée
  let best = null;
  for (const m of ms) {
    if (m.from[0] !== "t" || m.to === "f") continue;
    const i = +m.from[1];
    if (m.n !== P.t[i].length - P.d[i]) continue;
    if (P.d[i] === 0) continue;
    const score = P.d[i] * 10 + (P.t[+m.to[1]].length ? 5 : 0);
    if (!best || score > best.score) best = { m, score };
  }
  if (best && !lazy) return { type: "move", ...best.m };
  // 3. carte de la pioche vers le tapis
  const fromW = ms.find((m) => m.from === "w" && m.to[0] === "t");
  if (fromW && !lazy) return { type: "move", ...fromW };
  // 4. le robot fort finit par envoyer les cartes restantes en fondation
  if (toF.length) return { type: "move", ...toF[0] };
  if (lvl >= 2) {
    for (const m of ms) {
      if (m.from[0] !== "t" || m.to === "f") continue;
      const i = +m.from[1], col = P.t[i], k = col.length - m.n;
      // 4b. libérer une carte visible qui peut monter en fondation
      if (k > P.d[i] && fits(P, [col[k - 1]], "f")) return { type: "move", ...m };
      // 4c. vider une colonne quand un Roi attend une place
      if (k === 0 && P.t[+m.to[1]].length && kingWaiting(P)) return { type: "move", ...m };
    }
  }
  // 5. pioche, tant qu'un tour complet n'a pas été fait sans rien jouer
  const total = P.st.length + P.w.length;
  const cycle = Math.ceil(total / s.draw) + 2;
  if ((P.st.length || canRecycle(s, P)) && P.idle <= cycle) return { type: "draw" };
  return { type: "giveup", stuck: true };
}
function kingWaiting(P) {
  if (P.w.length && rankN(P.w[P.w.length - 1]) === 13) return true;
  return P.t.some((col, i) => P.d[i] > 0 && col.length > P.d[i] && rankN(col[P.d[i]]) === 13);
}
// une carte peut monter sans risque si les cartes de couleur opposée de rang inférieur sont déjà rangées
function safeUp(P, c) {
  const r = rankN(c);
  if (r <= 2) return true;
  const opp = red(c) ? [0, 3] : [1, 2];
  return opp.every((k) => P.f[k] >= r - 1);
}
export function auto() { return { type: "tick" }; }
export function botDelay(s, pid, rng) {
  return ({ 1: 2600, 2: 1800, 3: 1200 }[s.level] || 1800) * (0.7 + rng.next() * 0.6);
}
