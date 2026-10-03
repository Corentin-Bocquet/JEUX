import { fail, rankByScore } from "../engine.js";

export const meta = {
  id: "sudoku", name: "Sudoku", cat: "Réflexion", min: 1, max: 4, turnTime: 0, race: true,
  color: "#3F6FD8", desc: "Une seule grille pour tous : le plus rapide marque.",
  rules: ["Tout le monde remplit la même grille en même temps.",
    "Chaque chiffre de 1 à 9 apparaît une fois par ligne, par colonne et par carré.",
    "Bon chiffre : +1 point, et +3 si tu complètes une ligne, une colonne ou un carré.",
    "Mauvais chiffre : -1 point. Le meilleur score à la fin de la grille gagne.",
    "Options : difficulté (cases déjà remplies), pénalité par erreur et coups de pouce qui révèlent une case (sans points)."],
};

// ------------------------------------------------ réglages
export const options = [
  { key: "diff", label: "Difficulté", icon: "🧩",
    values: [[1, "Facile", "40 chiffres donnés"], [2, "Moyen", "32 chiffres donnés"], [3, "Difficile", "26 chiffres donnés"]], def: 2 },
  { key: "penalty", label: "Pénalité", icon: "❌",
    values: [[0, "Aucune", "Erreur gratuite"], [1, "-1", "Par erreur"], [3, "-3", "Par erreur"]], def: 1 },
  { key: "hints", label: "Coups de pouce", icon: "💡",
    values: [[0, "Aucun"], [3, "3", "Par joueur"], [6, "6", "Par joueur"]], def: 0 },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "🧩", desc: "Grille moyenne, -1 par erreur, sans aide.", set: { diff: 2, penalty: 1, hints: 0 } },
  { id: "decouverte", name: "Découverte", emoji: "🌱", desc: "Grille facile, erreurs gratuites, 3 coups de pouce.", set: { diff: 1, penalty: 0, hints: 3 } },
  { id: "expert", name: "Expert", emoji: "🧠", desc: "Grille difficile, -3 par erreur, aucune aide.", set: { diff: 3, penalty: 3, hints: 0 } },
  { id: "entraide", name: "Défi aidé", emoji: "💡", desc: "Grille difficile avec 6 coups de pouce.", set: { diff: 3, penalty: 1, hints: 6 } },
];
// valeur d'un réglage, ou le défaut si absente ou invalide
export function opt(settings, key) {
  const o = options.find((x) => x.key === key);
  const v = settings ? settings[key] : undefined;
  const hit = o.values.find((x) => x[0] === v || (v != null && String(x[0]) === String(v)));
  return hit ? hit[0] : o.def;
}

const ROW = (i) => Math.floor(i / 9), COL = (i) => i % 9, BOX = (i) => Math.floor(ROW(i) / 3) * 3 + Math.floor(COL(i) / 3);
export const PEERS = Array.from({ length: 81 }, (_, i) => {
  const p = new Set();
  for (let j = 0; j < 81; j++) if (j !== i && (ROW(j) === ROW(i) || COL(j) === COL(i) || BOX(j) === BOX(i))) p.add(j);
  return [...p];
});
export const UNITS = [
  ...Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => r * 9 + c)),
  ...Array.from({ length: 9 }, (_, c) => Array.from({ length: 9 }, (_, r) => r * 9 + c)),
  ...Array.from({ length: 9 }, (_, b) => Array.from({ length: 9 }, (_, k) => (Math.floor(b / 3) * 3 + Math.floor(k / 3)) * 9 + (b % 3) * 3 + (k % 3))),
];

export function candidates(g, i) {
  if (g[i]) return [];
  const used = new Set(PEERS[i].map((j) => g[j]));
  const out = [];
  for (let v = 1; v <= 9; v++) if (!used.has(v)) out.push(v);
  return out;
}

export function countSolutions(g0, limit = 2) {
  const g = g0.slice();
  let count = 0;
  const solve = () => {
    let best = -1, bestC = null;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const c = candidates(g, i);
      if (!c.length) return;
      if (!bestC || c.length < bestC.length) { best = i; bestC = c; if (c.length === 1) break; }
    }
    if (best < 0) { count++; return; }
    for (const v of bestC) { g[best] = v; solve(); if (count >= limit) return; }
    g[best] = 0;
  };
  solve();
  return count;
}

function fill(rng) {
  const g = Array(81).fill(0);
  const go = (i) => {
    if (i === 81) return true;
    for (const v of rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      if (PEERS[i].some((j) => g[j] === v)) continue;
      g[i] = v;
      if (go(i + 1)) return true;
    }
    g[i] = 0;
    return false;
  };
  go(0);
  return g;
}

export const CLUES = { 1: 40, 2: 32, 3: 26 };

export function generate(rng, level = 2) {
  const sol = fill(rng);
  const puz = sol.slice();
  const target = CLUES[level] || 32;
  let clues = 81;
  for (const i of rng.shuffle([...Array(81).keys()])) {
    if (clues <= target) break;
    const keep = puz[i];
    puz[i] = 0;
    if (countSolutions(puz, 2) !== 1) puz[i] = keep; else clues--;
  }
  return { puz, sol };
}

// level : niveau des robots (réglage global) ; diff : difficulté de la grille
export function setup(players, settings, rng) {
  const diff = opt(settings, "diff"), nh = opt(settings, "hints");
  const { puz, sol } = generate(rng, diff);
  const scores = {}, errors = {}, hints = {};
  players.forEach((p) => { scores[p.id] = 0; errors[p.id] = 0; hints[p.id] = nh; });
  return { ids: players.map((p) => p.id), puz, sol, grid: puz.slice(), owner: puz.map((v) => (v ? "" : null)),
    scores, errors, hints, hintsMax: nh, level: settings.level || 2, diff, penalty: opt(settings, "penalty"), last: null, done: false };
}
// case révélée par un coup de pouce : owner "?" (personne ne marque)
export const HINT = "?";

export function toAct(s) { return s.done ? [] : s.ids.slice(); }

export function reduce(s, pid, a) {
  if (!s.ids.includes(pid)) fail("Tu ne joues pas");
  if (a.type === "hint") {
    const i = a.cell | 0;
    if (i < 0 || i > 80) fail("Case invalide");
    if (s.grid[i]) fail("Case déjà remplie");
    if (!s.hints || !(s.hints[pid] > 0)) fail("Plus de coup de pouce");
    s.hints[pid]--;
    s.grid[i] = s.sol[i]; s.owner[i] = HINT;
    s.last = { id: pid, cell: i, val: s.sol[i], ok: true, bonus: 0, hint: true };
    if (s.grid.every((x) => x)) s.done = true;
    return s;
  }
  if (a.type !== "place") fail("Action inconnue");
  const i = a.cell | 0, v = a.val | 0;
  if (i < 0 || i > 80 || v < 1 || v > 9) fail("Coup invalide");
  if (s.grid[i]) fail("Case déjà remplie");
  if (s.sol[i] !== v) {
    s.scores[pid] -= s.penalty ?? 1; s.errors[pid]++;
    s.last = { id: pid, cell: i, val: v, ok: false };
    return s;
  }
  s.grid[i] = v; s.owner[i] = pid;
  let bonus = 0;
  for (const u of UNITS) if (u.includes(i) && u.every((j) => s.grid[j])) bonus += 3;
  s.scores[pid] += 1 + bonus;
  s.last = { id: pid, cell: i, val: v, ok: true, bonus };
  if (s.grid.every((x) => x)) s.done = true;
  return s;
}

export function result(s) {
  if (!s.done) return null;
  return { ranking: rankByScore(s.ids.map((id) => ({ id, score: s.scores[id] }))) };
}

// robot : cherche une case évidente ; au niveau facile il lui arrive de se tromper
export function bot(s, pid, rng) {
  const empties = [];
  for (let i = 0; i < 81; i++) if (!s.grid[i]) empties.push(i);
  if (!empties.length) return null;
  let best = empties[0], n = 10;
  for (const i of rng.shuffle(empties)) {
    const c = candidates(s.grid, i).length;
    if (c < n) { n = c; best = i; if (c === 1) break; }
  }
  // coup de pouce disponible : le robot s'en sert parfois, surtout sur une case difficile
  if (s.hints && s.hints[pid] > 0 && rng.next() < (n >= 2 ? 0.5 : 0.08)) return { type: "hint", cell: best };
  let val = s.sol[best];
  if (s.level === 1 && rng.next() < 0.15) val = (val % 9) + 1;
  return { type: "place", cell: best, val };
}
export function botDelay(s, pid, rng) {
  return ({ 1: 9000, 2: 6000, 3: 4000 }[s.level] || 6000) * (0.6 + rng.next() * 0.8);
}
