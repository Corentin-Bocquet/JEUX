import { fail, rankByScore } from "../engine.js";

export const meta = {
  id: "reversi", name: "Reversi", cat: "Plateau", min: 2, max: 2, turnTime: 40,
  color: "#16A34A", desc: "Encadre les pions adverses pour les retourner à ta couleur.",
  rules: ["Les noirs commencent. Pose un pion de façon à encadrer une ou plusieurs lignes de pions adverses (ligne, colonne ou diagonale).",
    "Tous les pions encadrés se retournent et prennent ta couleur.",
    "Un coup qui ne retourne rien est interdit. Si tu n'as aucun coup possible, ton tour passe tout seul.",
    "La partie s'arrête quand plus personne ne peut jouer : celui qui a le plus de pions gagne.",
    "Astuce : les coins ne peuvent plus jamais être retournés, ils valent de l'or.",
    "Options : plateau 6 x 6 ou 10 x 10, aide qui montre les coups possibles, départ en ligne, match en plusieurs manches."],
};

export const options = [
  { key: "size", label: "Plateau", icon: "⬛",
    values: [[8, "8 x 8", "Classique"], [6, "6 x 6", "Partie éclair"], [10, "10 x 10", "Grand plateau"]], def: 8 },
  { key: "hints", label: "Aide", icon: "💡",
    values: [[true, "Oui", "Coups montrés"], [false, "Non", "À toi de voir"]], def: true },
  { key: "start", label: "Départ", icon: "✳️",
    values: [["croix", "Croisé", "Position standard"], ["ligne", "En ligne", "Pions côte à côte"]], def: "croix" },
  { key: "wins", label: "Manches", icon: "🏆",
    values: [[1, "1", "Partie simple"], [2, "2 gagnantes", "Match court"], [3, "3 gagnantes", "Match long"]], def: 1 },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "⚫", desc: "Plateau 8 x 8, coups possibles affichés, une partie.", set: { size: 8, hints: true, start: "croix", wins: 1 } },
  { id: "eclair", name: "Éclair 6 x 6", emoji: "⚡", desc: "Petit plateau, partie de quelques minutes en 2 manches.", set: { size: 6, hints: true, start: "croix", wins: 2 } },
  { id: "grand", name: "Grand 10 x 10", emoji: "🌍", desc: "Un plateau géant pour des parties plus stratégiques.", set: { size: 10, hints: true, start: "croix", wins: 1 } },
  { id: "expert", name: "Expert", emoji: "🧠", desc: "Sans aide, départ en ligne, match en 2 manches gagnantes.", set: { size: 8, hints: false, start: "ligne", wins: 2 } },
];

const pick = (key, v) => {
  const o = options.find((x) => x.key === key);
  return o.values.some((x) => x[0] === v) ? v : o.def;
};

const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

// plateau : 0 vide, 1 noir (order[0]), 2 blanc (order[1])
export function initialBoard(n, start = "croix") {
  const b = Array(n * n).fill(0);
  const m = n / 2;
  const at = (r, c) => r * n + c;
  if (start === "ligne") {
    b[at(m - 1, m - 1)] = 1; b[at(m - 1, m)] = 1;
    b[at(m, m - 1)] = 2; b[at(m, m)] = 2;
  } else {
    b[at(m - 1, m - 1)] = 2; b[at(m, m)] = 2;
    b[at(m - 1, m)] = 1; b[at(m, m - 1)] = 1;
  }
  return b;
}

// pions retournés si `who` joue en i (liste vide = coup interdit)
export function flipsFor(b, n, i, who) {
  if (b[i]) return [];
  const op = 3 - who, r0 = Math.floor(i / n), c0 = i % n;
  const out = [];
  for (const [dr, dc] of DIRS) {
    let r = r0 + dr, c = c0 + dc;
    const line = [];
    while (r >= 0 && r < n && c >= 0 && c < n && b[r * n + c] === op) { line.push(r * n + c); r += dr; c += dc; }
    if (line.length && r >= 0 && r < n && c >= 0 && c < n && b[r * n + c] === who) out.push(...line);
  }
  return out;
}

export function legalMoves(b, n, who) {
  const out = [];
  for (let i = 0; i < b.length; i++) if (!b[i] && hasFlip(b, n, i, who)) out.push(i);
  return out;
}

function hasFlip(b, n, i, who) {
  const op = 3 - who, r0 = Math.floor(i / n), c0 = i % n;
  for (const [dr, dc] of DIRS) {
    let r = r0 + dr, c = c0 + dc, k = 0;
    while (r >= 0 && r < n && c >= 0 && c < n && b[r * n + c] === op) { r += dr; c += dc; k++; }
    if (k && r >= 0 && r < n && c >= 0 && c < n && b[r * n + c] === who) return true;
  }
  return false;
}

export const countOf = (b, v) => b.reduce((a, x) => a + (x === v ? 1 : 0), 0);

export function setup(players, settings, rng) {
  // order[0] a les noirs et commence la première manche
  const order = rng.shuffle(players.slice(0, 2).map((p) => p.id));
  // jeu à deux : d'éventuels joueurs en trop regardent la partie (classés derniers)
  const extra = players.slice(2).map((p) => p.id);
  const n = pick("size", settings.size), start = pick("start", settings.start);
  return { order, extra, n, start, hints: pick("hints", settings.hints), wins: pick("wins", settings.wins),
    board: initialBoard(n, start), side: 0, first: 0, plies: 0, last: -1, flips: [], pass: null,
    done: false, game: 1, score: { [order[0]]: 0, [order[1]]: 0 }, roundWin: null, level: settings.level || 2 };
}

// fin du match : manches gagnantes atteintes, ou trop de manches jouées
function matchOver(s) {
  if (!s.done) return false;
  if (s.wins <= 1) return true;
  return s.order.some((id) => s.score[id] >= s.wins) || s.game >= s.wins * 3;
}
// celui qui lance la manche suivante (il la commence, avec les noirs)
const nextStarter = (s) => s.order[(s.first + 1) % 2];

// couleur jouée par un joueur dans la manche en cours (1 noir, 2 blanc)
export const colorOf = (s, id) => {
  const k = s.order.indexOf(id);
  if (k < 0) return 0;
  return ((k - s.first + 2) % 2) + 1;
};
// joueur qui a la couleur v
export const idOfColor = (s, v) => s.order[(s.first + v - 1) % 2];

export function toAct(s) {
  if (s.done) return matchOver(s) ? [] : [nextStarter(s)];
  return [idOfColor(s, s.side + 1)];
}

function endRound(s) {
  s.done = true;
  const nb = countOf(s.board, 1), nw = countOf(s.board, 2);
  s.roundWin = nb === nw ? null : idOfColor(s, nb > nw ? 1 : 2);
  if (s.roundWin) s.score[s.roundWin]++;
}

export function reduce(s, pid, a) {
  if (!toAct(s).includes(pid)) fail("Ce n'est pas ton tour");
  const n = s.n;
  if (s.done) {
    if (a.type !== "next") fail("Lance la manche suivante");
    s.first = (s.first + 1) % 2;
    s.game++;
    s.board = initialBoard(n, s.start);
    s.side = 0; s.last = -1; s.flips = []; s.pass = null; s.done = false; s.roundWin = null; s.plies = 0;
    return s;
  }
  if (a.type !== "play") fail("Action inconnue");
  const i = a.i | 0;
  if (i < 0 || i >= n * n || a.i !== i) fail("Case invalide");
  if (s.board[i]) fail("Case déjà prise");
  const who = s.side + 1;
  const fl = flipsFor(s.board, n, i, who);
  if (!fl.length) fail("Ce coup ne retourne aucun pion");
  s.board[i] = who;
  for (const j of fl) s.board[j] = who;
  s.last = i; s.flips = fl; s.plies++; s.pass = null;
  const op = 3 - who;
  if (legalMoves(s.board, n, op).length) s.side = op - 1;
  else if (legalMoves(s.board, n, who).length) s.pass = idOfColor(s, op); // l'adversaire passe, on rejoue
  else endRound(s);
  return s;
}

export function result(s) {
  if (!matchOver(s)) return null;
  const rk = s.wins <= 1
    ? rankByScore(s.order.map((id) => ({ id, score: countOf(s.board, colorOf(s, id)) })))
    : rankByScore(s.order.map((id) => ({ id, score: s.score[id] })));
  return { ranking: rk.concat((s.extra || []).map((id) => ({ id, rank: 3, score: 0 }))) };
}

// --------- robot : minimax alpha-beta avec table de poids des cases et mobilité
const WCACHE = {};
export function weights(n) {
  if (WCACHE[n]) return WCACHE[n];
  const w = Array(n * n).fill(1);
  const L = n - 1;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const er = r === 0 || r === L, ec = c === 0 || c === L;
    const nr = r === 1 || r === L - 1, nc = c === 1 || c === L - 1;
    let v = 1;
    if (er && ec) v = 120;                       // coin
    else if (nr && nc) v = -45;                  // case X (diagonale du coin)
    else if ((er && (c === 1 || c === L - 1)) || (ec && (r === 1 || r === L - 1))) v = -20; // case C
    else if (er || ec) v = 10;                   // bord
    else if (nr || nc) v = -4;                   // juste derrière le bord
    w[r * n + c] = v;
  }
  WCACHE[n] = w;
  return w;
}

function cornerFix(b, n, w, who) {
  // une case X ou C n'est plus dangereuse si le coin voisin est déjà pris
  let adj = 0;
  const L = n - 1;
  const corners = [[0, 0, 1, 1], [0, L, 1, -1], [L, 0, -1, 1], [L, L, -1, -1]];
  for (const [r, c, dr, dc] of corners) {
    if (!b[r * n + c]) continue;
    for (const [rr, cc] of [[r + dr, c + dc], [r, c + dc], [r + dr, c]]) {
      const i = rr * n + cc;
      if (b[i] === who) adj -= w[i];
      else if (b[i] === 3 - who) adj += w[i];
    }
  }
  return adj;
}

function evaluate(b, n, who) {
  const w = weights(n), op = 3 - who;
  let pos = 0, mine = 0, theirs = 0;
  for (let i = 0; i < b.length; i++) {
    if (b[i] === who) { pos += w[i]; mine++; } else if (b[i] === op) { pos -= w[i]; theirs++; }
  }
  pos += cornerFix(b, n, w, who);
  const empty = b.length - mine - theirs;
  const mm = legalMoves(b, n, who).length, mo = legalMoves(b, n, op).length;
  const mob = mm + mo ? (100 * (mm - mo)) / (mm + mo + 2) : 0;
  // en fin de partie, le nombre de pions compte de plus en plus
  const disc = empty < b.length / 4 ? (mine - theirs) * 3 : 0;
  return pos + mob * 0.8 + disc;
}

function search(b, n, who, me, depth, alpha, beta, passed) {
  const moves = legalMoves(b, n, who);
  if (!moves.length) {
    if (passed) { // plus personne ne joue : score final
      const d = countOf(b, me) - countOf(b, 3 - me);
      return d > 0 ? 100000 + d : d < 0 ? -100000 + d : 0;
    }
    return search(b, n, 3 - who, me, depth, alpha, beta, true);
  }
  if (depth <= 0) return evaluate(b, n, me);
  const w = weights(n);
  moves.sort((x, y) => w[y] - w[x]);
  const maxing = who === me;
  let best = maxing ? -Infinity : Infinity;
  for (const i of moves) {
    const fl = flipsFor(b, n, i, who);
    b[i] = who; for (const j of fl) b[j] = who;
    const v = search(b, n, 3 - who, me, depth - 1, alpha, beta, false);
    b[i] = 0; for (const j of fl) b[j] = 3 - who;
    if (maxing) { if (v > best) best = v; if (v > alpha) alpha = v; }
    else { if (v < best) best = v; if (v < beta) beta = v; }
    if (alpha >= beta) break;
  }
  return best;
}

export function bot(s, pid, rng) {
  if (s.done) return { type: "next" };
  const n = s.n, who = s.side + 1;
  const moves = legalMoves(s.board, n, who);
  if (!moves.length) return null;
  const level = s.level || 2;
  const w = weights(n);
  if (level <= 1) {
    if (rng.next() < 0.45) return { type: "play", i: rng.pick(moves) };
    // le plus de pions retournés, un peu attiré par les coins
    let best = -Infinity, cands = [];
    for (const i of moves) {
      const v = flipsFor(s.board, n, i, who).length + (w[i] > 50 ? 4 : 0);
      if (v > best) { best = v; cands = [i]; } else if (v === best) cands.push(i);
    }
    return { type: "play", i: rng.pick(cands) };
  }
  const empty = s.board.filter((x) => !x).length;
  let depth;
  if (level === 2) depth = 2;
  else depth = n <= 6 ? 7 : n <= 8 ? 5 : 4;
  if (level >= 3 && empty <= (n <= 8 ? 11 : 8)) depth = empty; // finale calculée jusqu'au bout
  let best = -Infinity, cands = [];
  const b = s.board.slice();
  for (const i of moves) {
    const fl = flipsFor(b, n, i, who);
    b[i] = who; for (const j of fl) b[j] = who;
    let v = search(b, n, 3 - who, who, depth - 1, -Infinity, Infinity, false);
    b[i] = 0; for (const j of fl) b[j] = 3 - who;
    if (level === 2) v += (rng.next() - 0.5) * 12;
    if (v > best) { best = v; cands = [i]; } else if (v === best) cands.push(i);
  }
  return { type: "play", i: rng.pick(cands) };
}

// délai écoulé : un coup correct mais rapide
export function auto(s, pid, rng) {
  if (s.done) return { type: "next" };
  const who = s.side + 1, n = s.n;
  const moves = legalMoves(s.board, n, who);
  const w = weights(n);
  let best = -Infinity, cands = [];
  for (const i of moves) {
    const v = w[i] * 2 + flipsFor(s.board, n, i, who).length;
    if (v > best) { best = v; cands = [i]; } else if (v === best) cands.push(i);
  }
  return { type: "play", i: rng.pick(cands) };
}

export function botDelay(s, pid, rng) {
  if (s.done) return 1400;
  return 500 + rng.int(700);
}
