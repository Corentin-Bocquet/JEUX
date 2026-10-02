import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/motsmeles.js";
import { start, apply, rng } from "../js/engine.js";
import { playout } from "./harness.mjs";

test("chaque mot est bien lisible dans la grille", () => {
  for (const theme of Object.keys(G.THEMES)) for (const size of [10, 12, 14]) {
    for (let seed = 1; seed <= 3; seed++) {
      const { grid, words } = G.generate(rng(seed), size, theme, size >= 14 ? 16 : size >= 12 ? 13 : 9);
      assert.equal(grid.length, size * size);
      assert.ok(/^[A-Z]+$/.test(grid));
      assert.ok(words.length >= 7, `${theme} ${size} : ${words.length} mots`);
      for (const w of words) {
        const cells = G.lineCells(size, w.a, w.b);
        assert.equal(cells.map((c) => grid[c]).join(""), w.w);
      }
    }
  }
});

test("trouver dans les deux sens, refus des mauvaises lignes", () => {
  let s = start(G, [{ id: "a" }, { id: "b" }], { size: 12 }, 4, 0);
  const w = s.words[0];
  assert.throws(() => apply(G, s, "a", { type: "find", a: 0, b: 13 * 1 + 1 + 12 }), /droite|liste/);
  s = apply(G, s, "a", { type: "find", a: w.b, b: w.a }); // à l'envers
  assert.equal(s.scores.a, w.w.length);
  assert.throws(() => apply(G, s, "b", { type: "find", a: w.a, b: w.b }), /Déjà/);
});

test("parties complètes avec robots", () => {
  for (let seed = 1; seed <= 10; seed++) playout(G, 1 + (seed % 4), seed, { settings: { size: [10, 12, 14][seed % 3] } });
});
