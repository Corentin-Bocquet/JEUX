import { fail } from "../engine.js";

export const meta = {
  id: "dames", name: "Jeu de dames", cat: "Plateau", min: 2, max: 2, turnTime: 60,
  color: "#B97A45", desc: "Dames internationales 10 x 10, prise obligatoire.",
  rules: ["Les pions avancent en diagonale d'une case et prennent en sautant, en avant comme en arrière.",
    "La prise est obligatoire, et il faut prendre le plus de pièces possible.",
    "Un pion qui finit son coup sur la dernière rangée devient une dame : elle se déplace et prend à distance.",
    "Tu gagnes si l'adversaire n'a plus de pièce ou plus de coup possible."],
};

export const N = 10;
// 0 vide, 1 pion blanc, 2 dame blanche, 3 pion noir, 4 dame noire
const color = (p) => (p === 1 || p === 2 ? 0 : p === 3 || p === 4 ? 1 : -1);
const isKing = (p) => p === 2 || p === 4;
const DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const inside = (r, c) => r >= 0 && r < N && c >= 0 && c < N;

export function initialBoard() {
  const b = Array(N * N).fill(0);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if ((r + c) % 2 !== 1) continue;
    if (r <= 3) b[r * N + c] = 3;
    else if (r >= 6) b[r * N + c] = 1;
  }
  return b;
}

function captures(b, from) {
  const piece = b[from], me = color(piece), king = isKing(piece);
  const out = [];
  const work = b.slice();
  work[from] = 0;
  const dfs = (sq, path, caps) => {
    const r = Math.floor(sq / N), c = sq % N;
    let found = false;
    for (const [dr, dc] of DIRS) {
      if (king) {
        let rr = r + dr, cc = c + dc;
        while (inside(rr, cc) && work[rr * N + cc] === 0) { rr += dr; cc += dc; }
        if (!inside(rr, cc)) continue;
        const over = rr * N + cc;
        if (color(work[over]) !== 1 - me || caps.includes(over)) continue;
        let lr = rr + dr, lc = cc + dc;
        while (inside(lr, lc) && work[lr * N + lc] === 0) {
          const land = lr * N + lc;
          found = true;
          dfs(land, [...path, land], [...caps, over]);
          lr += dr; lc += dc;
        }
      } else {
        const rr = r + dr, cc = c + dc, lr = r + 2 * dr, lc = c + 2 * dc;
        if (!inside(lr, lc)) continue;
        const over = rr * N + cc, land = lr * N + lc;
        if (color(work[over]) !== 1 - me || caps.includes(over) || work[land] !== 0) continue;
        found = true;
        dfs(land, [...path, land], [...caps, over]);
      }
    }
    if (!found && caps.length) out.push({ from, path, caps });
  };
  dfs(from, [], []);
  return out;
}

export function legalMoves(b, side) {
  let caps = [];
  for (let i = 0; i < N * N; i++) if (color(b[i]) === side) caps.push(...captures(b, i));
  if (caps.length) {
    const max = Math.max(...caps.map((m) => m.caps.length));
    caps = caps.filter((m) => m.caps.length === max);
    // dédoublonne (même trajet, mêmes prises)
    const seen = new Set();
    return caps.filter((m) => { const k = m.from + ":" + m.path.join(",") + ":" + m.caps.slice().sort().join(","); if (seen.has(k)) return false; seen.add(k); return true; });
  }
  const out = [];
  for (let i = 0; i < N * N; i++) {
    const p = b[i];
    if (color(p) !== side) continue;
    const r = Math.floor(i / N), c = i % N;
    for (const [dr, dc] of DIRS) {
      if (isKing(p)) {
        let rr = r + dr, cc = c + dc;
        while (inside(rr, cc) && b[rr * N + cc] === 0) { out.push({ from: i, path: [rr * N + cc], caps: [] }); rr += dr; cc += dc; }
      } else {
        const fwd = side === 0 ? -1 : 1;
        if (dr !== fwd) continue;
        const rr = r + dr, cc = c + dc;
        if (inside(rr, cc) && b[rr * N + cc] === 0) out.push({ from: i, path: [rr * N + cc], caps: [] });
      }
    }
  }
  return out;
}

export function play(b, m) {
  const nb = b.slice();
  const piece = nb[m.from];
  nb[m.from] = 0;
  for (const c of m.caps) nb[c] = 0;
  const to = m.path[m.path.length - 1];
  let p = piece;
  const row = Math.floor(to / N);
  if (p === 1 && row === 0) p = 2;
  if (p === 3 && row === N - 1) p = 4;
  nb[to] = p;
  return nb;
}

export function setup(players, settings, rng) {
  const order = rng.shuffle(players.map((p) => p.id)); // order[0] a les blancs et commence
  return { order, board: initialBoard(), side: 0, quiet: 0, plies: 0, last: null, winner: null, draw: false, level: settings.level || 2 };
}

export function toAct(s) { return s.winner || s.draw ? [] : [s.order[s.side]]; }

export function reduce(s, pid, a) {
  if (toAct(s)[0] !== pid) fail("Ce n'est pas ton tour");
  if (a.type !== "move") fail("Action inconnue");
  const moves = legalMoves(s.board, s.side);
  const path = (a.path || []).map(Number);
  const m = moves.find((x) => x.from === a.from && x.path.join() === path.join());
  if (!m) {
    if (moves.some((x) => x.caps.length)) fail("La prise est obligatoire (et maximale)");
    fail("Coup impossible");
  }
  const wasKing = isKing(s.board[m.from]);
  s.board = play(s.board, m);
  s.last = { from: m.from, path: m.path, caps: m.caps, side: s.side };
  s.quiet = m.caps.length || !wasKing ? 0 : s.quiet + 1;
  s.plies++;
  s.side = 1 - s.side;
  if (!legalMoves(s.board, s.side).length) s.winner = s.order[1 - s.side];
  else if (s.quiet >= 50 || s.plies >= 400) s.draw = true;
  return s;
}

export function result(s) {
  if (s.winner) return { ranking: s.order.map((id) => ({ id, rank: id === s.winner ? 1 : 2 })) };
  if (s.draw) return { ranking: s.order.map((id) => ({ id, rank: 1 })) };
  return null;
}

// ------------------------------------------------ robot
function evaluate(b, side) {
  let sc = 0;
  for (let i = 0; i < N * N; i++) {
    const p = b[i]; if (!p) continue;
    const r = Math.floor(i / N), c = i % N;
    const own = color(p) === side ? 1 : -1;
    let v = isKing(p) ? 32 : 10;
    if (!isKing(p)) v += (color(p) === 0 ? (N - 1 - r) : r) * 0.35;
    if (c >= 3 && c <= 6) v += 0.4;
    sc += own * v;
  }
  return sc;
}
function search(b, side, me, depth, alpha, beta) {
  const moves = legalMoves(b, side);
  if (!moves.length) return side === me ? -10000 - depth : 10000 + depth;
  if (depth === 0) return evaluate(b, me);
  if (side === me) {
    let best = -Infinity;
    for (const m of moves) {
      best = Math.max(best, search(play(b, m), 1 - side, me, depth - 1, alpha, beta));
      alpha = Math.max(alpha, best); if (alpha >= beta) break;
    }
    return best;
  }
  let best = Infinity;
  for (const m of moves) {
    best = Math.min(best, search(play(b, m), 1 - side, me, depth - 1, alpha, beta));
    beta = Math.min(beta, best); if (alpha >= beta) break;
  }
  return best;
}

export function bot(s, pid, rng) {
  const moves = legalMoves(s.board, s.side);
  const pick = (m) => ({ type: "move", from: m.from, path: m.path });
  if (s.level <= 1) return pick(rng.pick(moves));
  const depth = s.level >= 3 ? 4 : 2;
  let best = -Infinity, cands = [];
  for (const m of moves) {
    const v = search(play(s.board, m), 1 - s.side, s.side, depth - 1, -Infinity, Infinity);
    if (v > best) { best = v; cands = [m]; } else if (v === best) cands.push(m);
  }
  return pick(rng.pick(cands));
}
export const auto = bot;
