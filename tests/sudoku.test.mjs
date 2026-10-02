import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/sudoku.js";
import { start, apply, rng } from "../js/engine.js";
import { playout } from "./harness.mjs";

test("grilles valides à solution unique", () => {
  for (const level of [1, 2, 3]) for (let seed = 1; seed <= 4; seed++) {
    const t0 = Date.now();
    const { puz, sol } = G.generate(rng(seed * 13 + level), level);
    assert.ok(Date.now() - t0 < 4000, "génération rapide");
    for (const u of G.UNITS) assert.equal(new Set(u.map((i) => sol[i])).size, 9);
    puz.forEach((v, i) => v && assert.equal(v, sol[i]));
    assert.equal(G.countSolutions(puz, 2), 1);
    assert.ok(puz.filter(Boolean).length <= G.CLUES[level] + 6, "assez de cases vides");
  }
});

test("points, erreurs, bonus de ligne et fin", () => {
  let s = start(G, [{ id: "a" }, { id: "b" }], { level: 1 }, 5, 0);
  const empty = s.grid.findIndex((v) => !v);
  const good = s.sol[empty], bad = (good % 9) + 1;
  s = apply(G, s, "a", { type: "place", cell: empty, val: bad });
  assert.equal(s.scores.a, -1); assert.equal(s.grid[empty], 0);
  s = apply(G, s, "b", { type: "place", cell: empty, val: good });
  assert.ok(s.scores.b >= 1);
  assert.throws(() => apply(G, s, "a", { type: "place", cell: empty, val: good }), /déjà/);
  // on remplit tout sauf une case : le dernier coup complète 3 unités
  for (let i = 0; i < 81; i++) if (!s.grid[i] && i !== 80) { s.grid[i] = s.sol[i]; s.owner[i] = "a"; }
  if (!s.grid[80]) {
    const before = s.scores.b;
    s = apply(G, s, "b", { type: "place", cell: 80, val: s.sol[80] });
    assert.equal(s.scores.b - before, 1 + 9);
    assert.ok(s.result);
  }
});

test("parties complètes avec robots", () => {
  for (let seed = 1; seed <= 6; seed++) playout(G, 1 + (seed % 4), seed, { settings: { level: 1 + (seed % 3) } });
});
