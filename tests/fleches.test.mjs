import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/fleches.js";
import { parseDefs } from "../js/games/fleches_dico.js";
import { start, apply, rng } from "../js/engine.js";
import { playout } from "./harness.mjs";

test("dictionnaire propre", () => {
  const d = parseDefs();
  assert.ok(d.length >= 230, "mots : " + d.length);
  for (const { w, d: def } of d) { assert.ok(/^[A-Z]+$/.test(w)); assert.ok(def.length > 1 && def.length <= 40, def); }
});

test("grilles cohérentes : flèches, croisements, aucun mot parasite", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const { grid, words } = G.generate(rng(seed), 18);
    assert.ok(words.length >= 12, `graine ${seed} : ${words.length} mots`);
    const W = G.W, H = G.H;
    for (const [i, w] of words.entries()) {
      const clue = grid[w.clue];
      assert.equal(clue.t, "C"); assert.equal(clue[w.dir], i);
      const step = w.dir === "a" ? 1 : W;
      assert.equal(w.cells[0] - step, w.clue, "la définition précède le mot");
      w.cells.forEach((c, k) => { assert.equal(grid[c].t, "L"); assert.equal(grid[c].ch, w.w[k]); });
      const after = w.cells[w.cells.length - 1] + step;
      const sameLine = w.dir === "a" ? Math.floor(after / W) === Math.floor(w.cells[0] / W) : after < W * H;
      if (sameLine) assert.ok(!grid[after] || grid[after].t !== "L", "le mot ne se prolonge pas");
    }
    // toute suite de 2 lettres ou plus dans la grille est un mot de la liste
    const isL = (r, c) => r >= 0 && c >= 0 && r < H && c < W && grid[r * W + c] && grid[r * W + c].t === "L";
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      if (!isL(r, c)) continue;
      if (!isL(r, c - 1) && isL(r, c + 1)) assert.ok(words.some((w) => w.dir === "a" && w.cells[0] === r * W + c), `suite horizontale libre en ${r},${c} (graine ${seed})`);
      if (!isL(r - 1, c) && isL(r + 1, c)) assert.ok(words.some((w) => w.dir === "d" && w.cells[0] === r * W + c), `suite verticale libre en ${r},${c} (graine ${seed})`);
    }
  }
});

test("réponses justes et fausses", () => {
  let s = start(G, [{ id: "a" }, { id: "b" }], {}, 2, 0);
  const w = s.words[0];
  assert.throws(() => apply(G, s, "a", { type: "answer", word: 0, text: "X" }), /lettres/);
  const wrong = w.w.slice(0, -1) + (w.w.endsWith("Z") ? "Y" : "Z");
  s = apply(G, s, "a", { type: "answer", word: 0, text: wrong });
  assert.equal(s.scores.a, -1);
  s = apply(G, s, "b", { type: "answer", word: 0, text: w.w.toLowerCase() });
  assert.equal(s.scores.b, w.w.length);
  assert.throws(() => apply(G, s, "a", { type: "answer", word: 0, text: w.w }), /Déjà/);
  assert.equal(Object.keys(G.revealed(s)).length, w.w.length);
});

test("parties complètes avec robots", () => {
  for (let seed = 1; seed <= 8; seed++) playout(G, 1 + (seed % 4), seed, { settings: { level: 1 + (seed % 3) } });
});
