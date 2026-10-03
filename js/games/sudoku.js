import { fail, rankByScore } from "../engine.js";

export const meta = {
  id: "sudoku", name: "Sudoku", cat: "Réflexion", min: 1, max: 4, turnTime: 0, race: true,
  color: "#3F6FD8", desc: "Une seule grille pour tous : le plus rapide marque.",
  rules: ["Tout le monde remplit la même grille en même temps.",
    "Chaque chiffre de 1 à 9 apparaît une fois par ligne, par colonne et par carré.",
    "Bon chiffre : +1 point, et +3 si tu complètes une ligne, une colonne ou un carré.",
    "Mauvais chiffre : -1 point. Le meilleur score à la fin de la grille gagne."],
};

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

export function setup(players, settings, rng) {
  const level = settings.level || 2;
  const { puz, sol } = generate(rng, level);
  const scores = {}, errors = {};
  players.forEach((p) => { scores[p.id] = 0; errors[p.id] = 0; });
  return { ids: players.map((p) => p.id), puz, sol, grid: puz.slice(), owner: puz.map((v) => (v ? "" : null)),
    scores, errors, level, last: null, done: false };
}

export function toAct(s) { return s.done ? [] : s.ids.slice(); }

export function reduce(s, pid, a) {
  if (!s.ids.includes(pid)) fail("Tu ne joues pas");
  if (a.type !== "place") fail("Action inconnue");
  const i = a.cell | 0, v = a.val | 0;
  if (i < 0 || i > 80 || v < 1 || v > 9) fail("Coup invalide");
  if (s.grid[i]) fail("Case déjà remplie");
  if (s.sol[i] !== v) {
    s.scores[pid] -= 1; s.errors[pid]++;
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
  let val = s.sol[best];
  if (s.level === 1 && rng.next() < 0.15) val = (val % 9) + 1;
  return { type: "place", cell: best, val };
}
export function botDelay(s, pid, rng) {
  return ({ 1: 9000, 2: 6000, 3: 4000 }[s.level] || 6000) * (0.6 + rng.next() * 0.8);
}
