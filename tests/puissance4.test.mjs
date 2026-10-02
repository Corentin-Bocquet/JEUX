import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/puissance4.js";
import { start, apply } from "../js/engine.js";
import { playout, timeoutPlayout } from "./harness.mjs";

const P = [{ id: "a", name: "A" }, { id: "b", name: "B" }];

test("victoire verticale et refus des coups illégaux", () => {
  let s = start(G, P, {}, 1, 0);
  const [x, y] = s.order;
  assert.throws(() => apply(G, s, y, { type: "drop", col: 0 }), /tour/);
  for (let i = 0; i < 3; i++) {
    s = apply(G, s, x, { type: "drop", col: 0 });
    s = apply(G, s, y, { type: "drop", col: 1 });
  }
  s = apply(G, s, x, { type: "drop", col: 0 });
  assert.equal(s.result.ranking.find((r) => r.id === x).rank, 1);
  assert.equal(s.result.ranking.find((r) => r.id === y).rank, 2);
  assert.throws(() => apply(G, s, y, { type: "drop", col: 3 }), /terminée/);
});

test("colonne pleine refusée, diagonale détectée", () => {
  let s = start(G, P, {}, 2, 0);
  const [x, y] = s.order;
  for (let i = 0; i < 6; i++) s = apply(G, s, i % 2 ? y : x, { type: "drop", col: 6 });
  assert.throws(() => apply(G, s, x, { type: "drop", col: 6 }), /pleine/);
  const b = Array(42).fill(0);
  [[0, 5], [1, 4], [2, 3], [3, 2]].forEach(([c, r]) => (b[r * 7 + c] = 1));
  assert.equal(G.findWin(b).cells.length, 4);
});

test("le robot difficile bloque une victoire immédiate", () => {
  let s = start(G, P, { level: 3 }, 3, 0);
  const [x, y] = s.order;
  s = apply(G, s, x, { type: "drop", col: 0 });
  s = apply(G, s, y, { type: "drop", col: 6 });
  s = apply(G, s, x, { type: "drop", col: 1 });
  s = apply(G, s, y, { type: "drop", col: 6 });
  s = apply(G, s, x, { type: "drop", col: 2 });
  const a = G.bot(s, y, { next: () => 0.9, int: () => 0, pick: (l) => l[0] });
  assert.equal(a.col, 3);
});

test("parties complètes robot contre robot", () => {
  for (let seed = 1; seed <= 40; seed++) playout(G, 2, seed, { settings: { level: (seed % 3) + 1 } });
  timeoutPlayout(G, 2, 9);
});
