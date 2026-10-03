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

test("options et modes bien formés", () => {
  const keys = G.options.map((o) => o.key);
  assert.ok(G.options.length >= 2 && G.options.length <= 5);
  for (const o of G.options) {
    assert.ok(o.values.some((v) => v[0] === o.def), o.key);
    for (const v of o.values) { assert.ok(v[1].length <= 12, v[1]); if (v[2]) assert.ok(v[2].length <= 18, v[2]); }
  }
  assert.ok(!keys.includes("level") && !keys.includes("turnTime"));
  assert.ok(G.modes.length >= 3 && G.modes.length <= 4);
  for (const m of G.modes) for (const k of Object.keys(m.set)) assert.ok(keys.includes(k), m.id + " : " + k);
  assert.equal(G.modes[0].name, "Classique");
  assert.deepEqual(G.modes[0].set, Object.fromEntries(G.options.map((o) => [o.key, o.def])));
  const s = start(G, [{ id: "a" }], { diff: 8, penalty: "x", hints: -2 }, 1, 0);
  assert.equal(s.diff, 2); assert.equal(s.penalty, 1); assert.equal(s.hints.a, 0);
});

test("chaque mode se joue jusqu'au bout", () => {
  for (const m of G.modes) for (const n of [1, 4]) playout(G, n, 3 + n, { settings: { ...m.set, level: 1 + (n % 3) } });
});

test("effet concret des options", () => {
  // difficulté : nombre de chiffres donnés, indépendant du niveau des robots
  const given = (diff, level) => start(G, [{ id: "a" }], { diff, level }, 9, 0).puz.filter(Boolean).length;
  assert.ok(given(1, 3) > given(2, 3) && given(2, 1) > given(3, 1));
  assert.ok(given(3, 1) <= G.CLUES[3] + 6);
  // pénalité par erreur
  for (const penalty of [0, 1, 3]) {
    let s = start(G, [{ id: "a" }], { penalty }, 2, 0);
    const i = s.grid.findIndex((v) => !v);
    s = apply(G, s, "a", { type: "place", cell: i, val: (s.sol[i] % 9) + 1 });
    assert.equal(s.scores.a, 0 - penalty || 0); assert.equal(s.errors.a, 1);
  }
  // coups de pouce : révèlent une case, sans points, en nombre limité
  let s = start(G, [{ id: "a" }, { id: "b" }], { hints: 3 }, 2, 0);
  assert.equal(s.hints.a, 3);
  for (let k = 0; k < 3; k++) {
    const i = s.grid.findIndex((v) => !v);
    s = apply(G, s, "a", { type: "hint", cell: i });
    assert.equal(s.grid[i], s.sol[i]); assert.equal(s.owner[i], G.HINT);
  }
  assert.equal(s.scores.a, 0); assert.equal(s.hints.a, 0); assert.equal(s.hints.b, 3);
  assert.throws(() => apply(G, s, "a", { type: "hint", cell: s.grid.findIndex((v) => !v) }), /coup de pouce/);
  const c0 = start(G, [{ id: "a" }], {}, 2, 0);
  assert.throws(() => apply(G, c0, "a", { type: "hint", cell: c0.grid.findIndex((v) => !v) }), /coup de pouce/);
  // les robots se servent de leurs coups de pouce
  const { st } = playout(G, 2, 7, { settings: { diff: 3, hints: 6 } });
  assert.ok(st.owner.includes(G.HINT));
});
