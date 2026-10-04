import { fail, rankByScore } from "../engine.js";

export const meta = {
  id: "morpion", name: "Morpion", cat: "Plateau", min: 2, max: 2, turnTime: 20,
  color: "#14B8A6", desc: "Aligne tes symboles avant ton adversaire.",
  rules: ["Chacun son tour, pose ton symbole (✕ ou ◯) dans une case vide.",
    "Le premier qui aligne ses symboles (ligne, colonne ou diagonale) gagne la manche.",
    "Grille pleine sans alignement : manche nulle.",
    "En match, on alterne qui commence et le premier au nombre de manches gagnantes remporte le match.",
    "Option « Pions qui s'effacent » : tu n'as jamais plus de pions que la longueur à aligner, ton plus ancien disparaît quand tu en poses un nouveau (le pion pâle est le prochain à partir).",
    "Options : grille 4 x 4 ou 5 x 5, aligner 4, match en plusieurs manches."],
};

export const options = [
  { key: "size", label: "Grille", icon: "#️⃣", values: [[3, "3 x 3", "Classique"], [4, "4 x 4", "Plus d'espace"], [5, "5 x 5", "Stratégique"]], def: 3 },
  { key: "align", label: "À aligner", icon: "🎯", values: [[3, "3", "Classique"], [4, "4", "Plus dur"]], def: 3 },
  { key: "wins", label: "Manches", icon: "🏆", values: [[1, "1", "Partie simple"], [2, "2", "Match court"], [3, "3", "Match long"]], def: 1 },
  { key: "fade", label: "Effacement", icon: "💨", values: [[false, "Non", "Pions fixes"], [true, "Oui", "L'ancien s'efface"]], def: false },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "❌", desc: "Grille 3 x 3, aligne 3 symboles, une seule partie.", set: { size: 3, align: 3, wins: 1, fade: false } },
  { id: "match", name: "Match en 3", emoji: "🏆", desc: "3 x 3, le premier à 3 manches gagnées remporte le match.", set: { size: 3, align: 3, wins: 3, fade: false } },
  { id: "grand", name: "Grande grille", emoji: "🧩", desc: "5 x 5 et il faut aligner 4 symboles, en 2 manches gagnantes.", set: { size: 5, align: 4, wins: 2, fade: false } },
  { id: "infini", name: "Sans fin", emoji: "💨", desc: "3 pions chacun : ton plus ancien s'efface quand tu en poses un 4e.", set: { size: 3, align: 3, wins: 2, fade: true } },
];

const optVal = (key, v) => {
  const o = options.find((x) => x.key === key);
  return o.values.some((x) => x[0] === v) ? v : o.def;
};
// au-delà de ce nombre de coups dans une manche « sans fin », la manche est nulle
export const FADE_CAP = 40;

export function setup(players, settings, rng) {
  const order = rng.next() < 0.5 ? [players[0].id, players[1].id] : [players[1].id, players[0].id];
  const n = optVal("size", settings.size);
  const k = Math.min(optVal("align", settings.align), n);
  const lvl = [1, 2, 3].includes(settings.level) ? settings.level : 2;
  return { order, n, k, wins: optVal("wins", settings.wins), fade: optVal("fade", settings.fade),
    board: Array(n * n).fill(0), hist: [[], []], turn: 0, plies: 0, win: null, full: false, last: null, gone: null,
    game: 1, score: { [order[0]]: 0, [order[1]]: 0 }, level: lvl };
}

export const roundOver = (s) => !!(s.win || s.full);
export function matchOver(s) {
  if (!roundOver(s)) return false;
  if (s.wins <= 1) return true;
  return s.order.some((id) => s.score[id] >= s.wins) || s.game >= s.wins * 3;
}
const nextStarter = (s) => s.order[s.game % 2];

export function toAct(s) {
  if (roundOver(s)) return matchOver(s) ? [] : [nextStarter(s)];
  return [s.order[s.turn]];
}

// toutes les lignes de longueur k (mises en cache par taille)
const LINES = {};
export function linesOf(n, k) {
  const key = n + ":" + k;
  if (LINES[key]) return LINES[key];
  const out = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const er = r + dr * (k - 1), ec = c + dc * (k - 1);
      if (er < 0 || er >= n || ec < 0 || ec >= n) continue;
      out.push(Array.from({ length: k }, (_, i) => (r + dr * i) * n + c + dc * i));
    }
  }
  return (LINES[key] = out);
}
export function findWin(b, n, k) {
  for (const L of linesOf(n, k)) {
    const v = b[L[0]];
    if (v && L.every((i) => b[i] === v)) return { v, cells: L };
  }
  return null;
}

// pose un pion (avec effacement éventuel) sur une copie : renvoie { b, hist, gone }
function place(b, hist, i, who, k, fade) {
  const nb = b.slice(), nh = [hist[0].slice(), hist[1].slice()];
  let gone = null;
  nb[i] = who;
  nh[who - 1].push(i);
  if (fade && nh[who - 1].length > k) { gone = nh[who - 1].shift(); nb[gone] = 0; }
  return { b: nb, hist: nh, gone };
}

export function reduce(s, pid, a) {
  if (!toAct(s).includes(pid)) fail("Ce n'est pas ton tour");
  if (roundOver(s)) {
    if (a.type !== "next") fail("Lance la manche suivante");
    s.turn = s.game % 2;
    s.game++;
    s.board = Array(s.n * s.n).fill(0);
    s.hist = [[], []];
    s.win = null; s.full = false; s.last = null; s.gone = null; s.plies = 0;
    return s;
  }
  if (a.type !== "play") fail("Action inconnue");
  const i = Number(a.cell);
  if (!Number.isInteger(i) || i < 0 || i >= s.n * s.n) fail("Case invalide");
  if (s.board[i]) fail("Case déjà prise");
  const who = s.turn + 1;
  const p = place(s.board, s.hist, i, who, s.k, s.fade);
  s.board = p.b; s.hist = p.hist; s.gone = p.gone; s.last = i; s.plies++;
  const win = findWin(s.board, s.n, s.k);
  if (win) {
    s.win = { id: s.order[win.v - 1], cells: win.cells };
    s.score[s.win.id]++;
  } else if (s.board.every((x) => x) || (s.fade && s.plies >= FADE_CAP)) s.full = true;
  else s.turn = 1 - s.turn;
  return s;
}

export function result(s) {
  if (!matchOver(s)) return null;
  return { ranking: rankByScore(s.order.map((id) => ({ id, score: s.score[id] }))) };
}

// ---------------- robots
const WIN = 1e6;
// 3 x 3 classique : minimax exact avec mémoire (imbattable)
const MEMO = new Map();
function perfect(b, who) {
  const key = b.join("") + who;
  if (MEMO.has(key)) return MEMO.get(key);
  let best = -Infinity;
  let any = false;
  for (let i = 0; i < 9; i++) {
    if (b[i]) continue;
    any = true;
    b[i] = who;
    const v = findWin(b, 3, 3) ? 10 : -perfect(b, 3 - who);
    b[i] = 0;
    if (v > best) best = v;
  }
  const r = any ? (best > 0 ? best - 1 : best < 0 ? best + 1 : 0) : 0;
  MEMO.set(key, r);
  return r;
}
// valeur exacte de chaque coup possible (pour le joueur who)
export function perfectScores(b, who) {
  const out = [];
  const w = b.slice();
  for (let i = 0; i < 9; i++) {
    if (w[i]) continue;
    w[i] = who;
    out.push([i, findWin(w, 3, 3) ? 10 : -perfect(w, 3 - who)]);
    w[i] = 0;
  }
  return out;
}

// évaluation heuristique pour les grandes grilles : lignes encore ouvertes
function evaluate(b, n, k, me) {
  let sc = 0;
  for (const L of linesOf(n, k)) {
    let m = 0, o = 0;
    for (const i of L) { const v = b[i]; if (v === me) m++; else if (v) o++; }
    if (m && !o) sc += m === k - 1 ? 60 : Math.pow(4, m);
    else if (o && !m) sc -= o === k - 1 ? 80 : Math.pow(4, o);
  }
  return sc;
}
// cases candidates : voisines des pions déjà posés (ou le centre)
function candidates(b, n) {
  const out = [];
  let any = false;
  for (let i = 0; i < b.length; i++) {
    if (b[i]) { any = true; continue; }
    const r = Math.floor(i / n), c = i % n;
    let near = false;
    for (let dr = -1; dr <= 1 && !near; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < n && cc >= 0 && cc < n && b[rr * n + cc]) { near = true; break; }
    }
    if (near) out.push(i);
  }
  if (!any) return [Math.floor(n / 2) * n + Math.floor(n / 2)];
  return out.length ? out : b.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
}

function search(g, b, hist, who, depth, alpha, beta, ply) {
  g.nodes++;
  if (depth === 0 || g.nodes > g.budget) return evaluate(b, g.n, g.k, who);
  const moves = candidates(b, g.n);
  if (!moves.length) return 0;
  let best = -Infinity;
  for (const i of moves) {
    const p = place(b, hist, i, who, g.k, g.fade);
    const v = findWin(p.b, g.n, g.k) ? WIN - ply : -search(g, p.b, p.hist, 3 - who, depth - 1, -beta, -alpha, ply + 1);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

// coup gagnant immédiat pour who, sinon -1
function winningCell(s, who) {
  for (let i = 0; i < s.board.length; i++) {
    if (s.board[i]) continue;
    const p = place(s.board, s.hist, i, who, s.k, s.fade);
    if (findWin(p.b, s.n, s.k)) return i;
  }
  return -1;
}

export function bot(s, pid, rng) {
  if (roundOver(s)) return { type: "next" };
  const me = s.order.indexOf(pid) + 1, op = 3 - me;
  const free = s.board.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  const play = (cell) => ({ type: "play", cell });
  const lvl = s.level || 2;
  const win = winningCell(s, me);
  // niveau 1 : gagne souvent quand il peut, bloque une fois sur deux, sinon au hasard
  if (lvl <= 1) {
    if (win >= 0 && rng.next() < 0.8) return play(win);
    const block = winningCell(s, op);
    if (block >= 0 && rng.next() < 0.5) return play(block);
    return play(rng.pick(free));
  }
  if (win >= 0) return play(win);
  const block = winningCell(s, op);
  // niveau 3 en 3 x 3 classique : minimax exact
  if (lvl >= 3 && s.n === 3 && s.k === 3 && !s.fade) {
    const sc = perfectScores(s.board, me);
    const top = Math.max(...sc.map((x) => x[1]));
    return play(rng.pick(sc.filter((x) => x[1] === top).map((x) => x[0])));
  }
  if (lvl === 2) {
    if (block >= 0) return play(block);
    // centre, puis un coup raisonnable (recherche courte) avec un peu de hasard
    const mid = Math.floor(s.n / 2) * s.n + Math.floor(s.n / 2);
    if (!s.board[mid] && rng.next() < 0.7) return play(mid);
    if (rng.next() < 0.3) return play(rng.pick(free));
  }
  const g = { n: s.n, k: s.k, fade: s.fade, nodes: 0, budget: 40000 };
  const depth = lvl >= 3 ? (s.n === 3 ? 7 : 4) : 2;
  let best = -Infinity, cands = [];
  const moves = candidates(s.board, s.n);
  for (const i of moves) {
    const p = place(s.board, s.hist, i, me, s.k, s.fade);
    const v = -search(g, p.b, p.hist, op, depth - 1, -Infinity, Infinity, 1);
    if (v > best) { best = v; cands = [i]; } else if (v === best) cands.push(i);
  }
  if (block >= 0 && best < WIN / 2 && !cands.includes(block)) return play(block);
  return play(rng.pick(cands.length ? cands : free));
}
export const auto = bot;
export const botDelay = (s, pid, rng) => (roundOver(s) ? 1200 : 450 + Math.floor((rng ? rng.next() : 0.5) * 600));
