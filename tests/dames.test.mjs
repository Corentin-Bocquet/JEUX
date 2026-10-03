import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/dames.js";
import { start, apply } from "../js/engine.js";
import { playout } from "./harness.mjs";

const sq = (r, c) => r * 10 + c;
const empty = () => Array(100).fill(0);

test("position de départ : 20 pions chacun, 9 coups pour les blancs", () => {
  const b = G.initialBoard();
  assert.equal(b.filter((x) => x === 1).length, 20);
  assert.equal(b.filter((x) => x === 3).length, 20);
  assert.equal(G.legalMoves(b, 0).length, 9);
});

test("prise obligatoire, en arrière pour un pion, rafle maximale", () => {
  const b = empty();
  b[sq(5, 4)] = 1; b[sq(4, 5)] = 3; // prise vers l'avant possible
  b[sq(7, 2)] = 1;
  let ms = G.legalMoves(b, 0);
  assert.equal(ms.length, 1); assert.deepEqual(ms[0].caps, [sq(4, 5)]);
  const c = empty();
  c[sq(5, 4)] = 1; c[sq(6, 5)] = 3; // prise en arrière
  ms = G.legalMoves(c, 0);
  assert.equal(ms.length, 1); assert.equal(ms[0].path[0], sq(7, 6));
  // rafle : deux prises valent mieux qu'une
  const d = empty();
  d[sq(9, 0)] = 1; d[sq(8, 1)] = 3; d[sq(6, 3)] = 3;
  d[sq(9, 8)] = 1; d[sq(8, 7)] = 3;
  ms = G.legalMoves(d, 0);
  assert.equal(ms.length, 1); assert.equal(ms[0].caps.length, 2); assert.deepEqual(ms[0].path, [sq(7, 2), sq(5, 4)]);
});

test("dame volante : prise à distance, plusieurs cases d'arrivée", () => {
  const b = empty();
  b[sq(9, 0)] = 2; b[sq(5, 4)] = 3;
  const ms = G.legalMoves(b, 0);
  assert.equal(ms.length, 5); // atterrit en (4,5), (3,6), (2,7), (1,8), (0,9)
  assert.ok(ms.every((m) => m.caps[0] === sq(5, 4)));
  // une pièce prise ne se saute pas deux fois et bloque
  const c = empty();
  c[sq(4, 4)] = 2; c[sq(5, 5)] = 3; c[sq(3, 5)] = 3; c[sq(5, 3)] = 3; c[sq(3, 3)] = 3;
  const mc = G.legalMoves(c, 0);
  assert.ok(mc.length > 0);
  for (const m of mc) assert.equal(new Set(m.caps).size, m.caps.length);
});

test("promotion seulement en fin de coup", () => {
  const b = empty();
  b[sq(1, 2)] = 1;
  let nb = G.play(b, { from: sq(1, 2), path: [sq(0, 1)], caps: [] });
  assert.equal(nb[sq(0, 1)], 2);
  // passe par la dernière rangée en prenant puis repart : reste pion
  const c = empty();
  c[sq(2, 1)] = 1; c[sq(1, 2)] = 3; c[sq(1, 4)] = 3;
  const ms = G.legalMoves(c, 0);
  assert.equal(ms[0].caps.length, 2);
  nb = G.play(c, ms[0]);
  assert.equal(nb[ms[0].path[1]], 1);
});

test("coup illégal refusé, victoire quand l'autre ne peut plus jouer", () => {
  let s = start(G, [{ id: "a" }, { id: "b" }], {}, 3, 0);
  const w = s.order[0];
  assert.throws(() => apply(G, s, w, { type: "move", from: sq(6, 1), path: [sq(4, 3)] }), /impossible/);
  s.board = empty(); s.board[sq(5, 4)] = 1; s.board[sq(4, 5)] = 3;
  s = apply(G, s, w, { type: "move", from: sq(5, 4), path: [sq(3, 6)] });
  assert.equal(s.result.ranking.find((r) => r.id === w).rank, 1);
});

test("parties complètes robot contre robot", () => {
  for (let seed = 1; seed <= 12; seed++) playout(G, 2, seed, { settings: { level: 1 + (seed % 2) } });
});
