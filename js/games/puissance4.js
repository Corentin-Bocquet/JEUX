import { fail, rankByScore } from "../engine.js";

export const meta = {
  id: "puissance4", name: "Puissance 4", cat: "Plateau", min: 2, max: 2, turnTime: 40,
  color: "#E5484D", desc: "Aligne 4 jetons avant ton adversaire.",
  rules: ["Chacun son tour, fais tomber un jeton dans une colonne.",
    "Le premier qui aligne 4 jetons (ligne, colonne ou diagonale) gagne.",
    "Grille pleine sans alignement : match nul.",
    "Options : grille plus grande, 5 jetons à aligner, ou match en plusieurs manches (on alterne qui commence)."],
};

// grille par défaut (les anciennes parties n'ont pas w/h/k dans l'état)
const W = 7, H = 6, K = 4;
const SIZES = { "7x6": [7, 6], "8x7": [8, 7], "9x7": [9, 7] };

export const options = [
  { key: "grid", label: "Grille", icon: "🔵",
    values: [["7x6", "7 x 6", "Classique"], ["8x7", "8 x 7", "Plus d'espace"], ["9x7", "9 x 7", "Géante"]], def: "7x6" },
  { key: "connect", label: "Jetons à aligner", icon: "🎯",
    values: [[4, "4", "Puissance 4"], [5, "5", "Puissance 5"]], def: 4 },
  { key: "wins", label: "Manches gagnantes", icon: "🏆",
    values: [[1, "1", "Partie simple"], [2, "2", "Match court"], [3, "3", "Match long"]], def: 1 },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "🔴", desc: "Grille 7 x 6, aligne 4 jetons, une seule partie.", set: { grid: "7x6", connect: 4, wins: 1 } },
  { id: "match", name: "Match en 3", emoji: "🏆", desc: "Le premier à 3 manches gagnées remporte le match.", set: { grid: "7x6", connect: 4, wins: 3 } },
  { id: "geant", name: "Grille géante", emoji: "🧩", desc: "9 x 7 colonnes, toujours 4 à aligner, en 2 manches.", set: { grid: "9x7", connect: 4, wins: 2 } },
  { id: "puissance5", name: "Puissance 5", emoji: "🖐️", desc: "Grille 9 x 7 et il faut aligner 5 jetons.", set: { grid: "9x7", connect: 5, wins: 1 } },
];

const pick = (key, v) => {
  const o = options.find((x) => x.key === key);
  return o.values.some((x) => x[0] === v) ? v : o.def;
};
export const dims = (s) => ({ w: s.w || W, h: s.h || H, k: s.k || K });

export function setup(players, settings, rng) {
  // le premier joueur est tiré au sort ; order[0] a toujours les jetons rouges
  const order = rng.next() < 0.5 ? [players[0].id, players[1].id] : [players[1].id, players[0].id];
  const [w, h] = SIZES[pick("grid", settings.grid)];
  const k = pick("connect", settings.connect), wins = pick("wins", settings.wins);
  return { order, w, h, k, wins, board: Array(w * h).fill(0), turn: 0, win: null, last: null, full: false,
    game: 1, score: { [order[0]]: 0, [order[1]]: 0 }, over: false, level: settings.level || 2 };
}

const roundOver = (s) => !!(s.win || s.full);
// fin du match : manches gagnantes atteintes, ou trop de manches nulles
function matchOver(s) {
  if (!roundOver(s)) return false;
  const wins = s.wins || 1;
  if (wins <= 1) return true;
  return s.order.some((id) => s.score[id] >= wins) || s.game >= wins * 3;
}
// joueur qui commence la manche suivante (on alterne)
const nextStarter = (s) => s.order[s.game % 2];

export function toAct(s) {
  if (roundOver(s)) return matchOver(s) ? [] : [nextStarter(s)];
  return [s.order[s.turn]];
}

export function landing(board, col, w = W, h = H) {
  for (let r = h - 1; r >= 0; r--) if (!board[r * w + col]) return r;
  return -1;
}

const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
export function findWin(b, w = W, h = H, k = K) {
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const v = b[r * w + c]; if (!v) continue;
    for (const [dc, dr] of DIRS) {
      const cells = [];
      for (let i = 0; i < k; i++) {
        const cc = c + dc * i, rr = r + dr * i;
        if (cc < 0 || cc >= w || rr < 0 || rr >= h || b[rr * w + cc] !== v) break;
        cells.push(rr * w + cc);
      }
      if (cells.length === k) return { v, cells };
    }
  }
  return null;
}

// alignement passant par la case i (plus rapide pour le robot)
function winsAt(b, i, w, h, k) {
  const v = b[i], r = Math.floor(i / w), c = i % w;
  for (const [dc, dr] of DIRS) {
    let n = 1;
    for (let s = 1; s < k; s++) { const cc = c + dc * s, rr = r + dr * s; if (cc < 0 || cc >= w || rr < 0 || rr >= h || b[rr * w + cc] !== v) break; n++; }
    for (let s = 1; s < k; s++) { const cc = c - dc * s, rr = r - dr * s; if (cc < 0 || cc >= w || rr < 0 || rr >= h || b[rr * w + cc] !== v) break; n++; }
    if (n >= k) return true;
  }
  return false;
}

export function reduce(s, pid, a) {
  if (!toAct(s).includes(pid)) fail("Ce n'est pas ton tour");
  const { w, h, k } = dims(s);
  if (roundOver(s)) {
    if (a.type !== "next") fail("Lance la manche suivante");
    s.turn = s.game % 2;
    s.game++;
    s.board = Array(w * h).fill(0);
    s.win = null; s.full = false; s.last = null;
    return s;
  }
  if (a.type !== "drop") fail("Action inconnue");
  const col = a.col | 0;
  if (col < 0 || col >= w) fail("Colonne invalide");
  const r = landing(s.board, col, w, h);
  if (r < 0) fail("Colonne pleine");
  s.board[r * w + col] = s.turn + 1;
  s.last = r * w + col;
  const win = findWin(s.board, w, h, k);
  if (win) {
    s.win = { id: s.order[win.v - 1], cells: win.cells };
    if (s.score) s.score[s.win.id]++;
  } else if (s.board.every((x) => x)) s.full = true;
  else s.turn = 1 - s.turn;
  if (matchOver(s)) s.over = true;
  return s;
}

export function result(s) {
  if (!matchOver(s)) return null;
  if ((s.wins || 1) <= 1) {
    if (s.win) return { ranking: s.order.map((id) => ({ id, rank: id === s.win.id ? 1 : 2 })) };
    return { ranking: rankByScore(s.order.map((id) => ({ id, score: 0 }))) };
  }
  return { ranking: rankByScore(s.order.map((id) => ({ id, score: s.score[id] }))) };
}

// --------- robot : minimax alpha-beta, adapté à la taille de la grille
function scoreWindow(win, me, k) {
  const op = 3 - me;
  let m = 0, o = 0;
  for (const x of win) { if (x === me) m++; else if (x === op) o++; }
  const e = k - m - o;
  if (m === k) return 1000;
  if (m === k - 1 && e === 1) return 6;
  if (m === k - 2 && e === 2) return 2;
  if (o === k - 1 && e === 1) return -5;
  return 0;
}
function evaluate(b, me, w, h, k) {
  let sc = 0;
  const mid = (w - 1) / 2;
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    if (Math.abs(c - mid) < 1 && b[r * w + c] === me) sc += 3;
  }
  const win = new Array(k);
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    for (const [dc, dr] of DIRS) {
      const ec = c + dc * (k - 1), er = r + dr * (k - 1);
      if (ec < 0 || ec >= w || er < 0 || er >= h) continue;
      for (let i = 0; i < k; i++) win[i] = b[(r + dr * i) * w + c + dc * i];
      sc += scoreWindow(win, me, k);
    }
  }
  return sc;
}
// colonnes du centre vers les bords
const colOrder = (w) => Array.from({ length: w }, (_, i) => i).sort((a, b) => Math.abs(a - (w - 1) / 2) - Math.abs(b - (w - 1) / 2) || a - b);

function minimax(b, depth, alpha, beta, maxing, me, g) {
  if (depth === 0) return evaluate(b, me, g.w, g.h, g.k);
  const who = maxing ? me : 3 - me;
  let best = maxing ? -Infinity : Infinity, any = false;
  for (const c of g.order) {
    const r = landing(b, c, g.w, g.h); if (r < 0) continue;
    any = true;
    const i = r * g.w + c;
    b[i] = who;
    const v = winsAt(b, i, g.w, g.h, g.k)
      ? (who === me ? 100000 + depth : -100000 - depth)
      : minimax(b, depth - 1, alpha, beta, !maxing, me, g);
    b[i] = 0;
    if (maxing) { best = Math.max(best, v); alpha = Math.max(alpha, v); }
    else { best = Math.min(best, v); beta = Math.min(beta, v); }
    if (alpha >= beta) break;
  }
  return any ? best : 0;
}

export function bot(s, pid, rng) {
  if (roundOver(s)) return { type: "next" };
  const { w, h, k } = dims(s);
  const me = s.order.indexOf(pid) + 1;
  const g = { w, h, k, order: colOrder(w) };
  const legal = g.order.filter((c) => landing(s.board, c, w, h) >= 0);
  const depth = [0, 1, 3, 5][s.level] ?? 3;
  if (s.level === 1 && rng.next() < 0.5) return { type: "drop", col: rng.pick(legal) };
  let best = -Infinity, cands = [];
  for (const c of legal) {
    const b = s.board.slice();
    const r = landing(b, c, w, h); b[r * w + c] = me;
    const v = winsAt(b, r * w + c, w, h, k) ? 100000 + depth + 1 : minimax(b, depth, -Infinity, Infinity, false, me, g);
    if (v > best) { best = v; cands = [c]; } else if (v === best) cands.push(c);
  }
  return { type: "drop", col: rng.pick(cands) };
}
export const auto = bot;
export { W, H, K };
