import { fail, rankByScore } from "../engine.js";

export const meta = {
  id: "puissance4", name: "Puissance 4", cat: "Plateau", min: 2, max: 2, turnTime: 40,
  color: "#E5484D", desc: "Aligne 4 jetons avant ton adversaire.",
  rules: ["Chacun son tour, fais tomber un jeton dans une colonne.",
    "Le premier qui aligne 4 jetons (ligne, colonne ou diagonale) gagne.",
    "Grille pleine sans alignement : match nul."],
};

const W = 7, H = 6;
const at = (b, c, r) => b[r * W + c];

export function setup(players, settings, rng) {
  // le premier joueur est tiré au sort
  const order = rng.next() < 0.5 ? [players[0].id, players[1].id] : [players[1].id, players[0].id];
  return { order, board: Array(W * H).fill(0), turn: 0, win: null, last: null, full: false,
    level: settings.level || 2 };
}

export function toAct(s) { return s.win || s.full ? [] : [s.order[s.turn]]; }

export function landing(board, col) {
  for (let r = H - 1; r >= 0; r--) if (!board[r * W + col]) return r;
  return -1;
}

export function findWin(b) {
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const v = at(b, c, r); if (!v) continue;
    for (const [dc, dr] of dirs) {
      const cells = [];
      for (let k = 0; k < 4; k++) {
        const cc = c + dc * k, rr = r + dr * k;
        if (cc < 0 || cc >= W || rr < 0 || rr >= H || at(b, cc, rr) !== v) break;
        cells.push(rr * W + cc);
      }
      if (cells.length === 4) return { v, cells };
    }
  }
  return null;
}

export function reduce(s, pid, a) {
  if (a.type !== "drop") fail("Action inconnue");
  if (toAct(s)[0] !== pid) fail("Ce n'est pas ton tour");
  const col = a.col | 0;
  if (col < 0 || col >= W) fail("Colonne invalide");
  const r = landing(s.board, col);
  if (r < 0) fail("Colonne pleine");
  s.board[r * W + col] = s.turn + 1;
  s.last = r * W + col;
  const w = findWin(s.board);
  if (w) s.win = { id: s.order[w.v - 1], cells: w.cells };
  else if (s.board.every((x) => x)) s.full = true;
  else s.turn = 1 - s.turn;
  return s;
}

export function result(s) {
  if (s.win) return { ranking: s.order.map((id) => ({ id, rank: id === s.win.id ? 1 : 2 })) };
  if (s.full) return { ranking: rankByScore(s.order.map((id) => ({ id, score: 0 }))) };
  return null;
}

// --------- robot : minimax alpha-beta
function scoreWindow(w, me) {
  const op = 3 - me;
  const m = w.filter((x) => x === me).length, o = w.filter((x) => x === op).length, e = 4 - m - o;
  if (m === 4) return 1000;
  if (m === 3 && e === 1) return 6;
  if (m === 2 && e === 2) return 2;
  if (o === 3 && e === 1) return -5;
  return 0;
}
function evaluate(b, me) {
  let sc = 0;
  for (let r = 0; r < H; r++) if (at(b, 3, r) === me) sc += 3;
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      const ec = c + dc * 3, er = r + dr * 3;
      if (ec < 0 || ec >= W || er < 0 || er >= H) continue;
      const w = [0, 1, 2, 3].map((k) => at(b, c + dc * k, r + dr * k));
      sc += scoreWindow(w, me);
    }
  }
  return sc;
}
const ORDER = [3, 2, 4, 1, 5, 0, 6];
function minimax(b, depth, alpha, beta, maxing, me) {
  const w = findWin(b);
  if (w) return w.v === me ? 100000 + depth : -100000 - depth;
  if (b.every((x) => x)) return 0;
  if (depth === 0) return evaluate(b, me);
  const who = maxing ? me : 3 - me;
  let best = maxing ? -Infinity : Infinity;
  for (const c of ORDER) {
    const r = landing(b, c); if (r < 0) continue;
    b[r * W + c] = who;
    const v = minimax(b, depth - 1, alpha, beta, !maxing, me);
    b[r * W + c] = 0;
    if (maxing) { best = Math.max(best, v); alpha = Math.max(alpha, v); }
    else { best = Math.min(best, v); beta = Math.min(beta, v); }
    if (alpha >= beta) break;
  }
  return best;
}

export function bot(s, pid, rng) {
  const me = s.order.indexOf(pid) + 1;
  const legal = ORDER.filter((c) => landing(s.board, c) >= 0);
  const depth = [0, 1, 3, 5][s.level] ?? 3;
  if (s.level === 1 && rng.next() < 0.5) return { type: "drop", col: rng.pick(legal) };
  let best = -Infinity, cands = [];
  for (const c of legal) {
    const b = s.board.slice();
    const r = landing(b, c); b[r * W + c] = me;
    const v = minimax(b, depth, -Infinity, Infinity, false, me);
    if (v > best) { best = v; cands = [c]; } else if (v === best) cands.push(c);
  }
  return { type: "drop", col: rng.pick(cands) };
}
export const auto = bot;
export { W, H };
