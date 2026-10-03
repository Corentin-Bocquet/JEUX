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
  const s = start(G, [{ id: "a" }], { size: 8, words: 3, reveal: 5, penalty: -1 }, 1, 0);
  assert.equal(s.w, 9); assert.equal(s.h, 11); assert.equal(s.reveal, 0); assert.equal(s.penalty, 1);
});

test("chaque mode se joue jusqu'au bout", () => {
  for (const m of G.modes) for (const n of [1, 6]) {
    const { st } = playout(G, n, 30 + n, { settings: { ...m.set, level: 1 + (n % 3) } });
    assert.equal(st.w, m.set.size);
  }
});

test("effet concret des options", () => {
  // taille : la grille fait bien w x (w + 2) cases et les mots tiennent dedans
  for (const size of [7, 9, 11]) {
    const s = start(G, [{ id: "a" }], { size, words: 24 }, 4, 0);
    assert.equal(s.w, size); assert.equal(s.h, size + 2); assert.equal(s.grid.length, size * (size + 2));
    for (const w of s.words) {
      w.cells.forEach((c, k) => { assert.ok(c < s.grid.length); assert.equal(s.grid[c].ch, w.w[k]); });
      if (w.dir === "a") assert.equal(Math.floor(w.cells[0] / size), Math.floor(w.cells[w.cells.length - 1] / size), "mot horizontal sur une seule ligne");
    }
    assert.ok(s.words.length >= (size === 7 ? 10 : 16), size + " : " + s.words.length);
  }
  assert.ok(start(G, [{ id: "a" }], { size: 11, words: 24 }, 4, 0).words.length > start(G, [{ id: "a" }], { size: 11, words: 12 }, 4, 0).words.length);
  // lettres données
  const s0 = start(G, [{ id: "a" }], { reveal: 0 }, 6, 0);
  assert.equal(Object.keys(G.revealed(s0)).length, 0);
  const s1 = start(G, [{ id: "a" }], { reveal: 1 }, 6, 0);
  for (const w of s1.words) assert.equal(G.revealed(s1)[w.cells[0]], w.w[0]);
  const s2 = start(G, [{ id: "a" }], { reveal: 2 }, 6, 0);
  for (const w of s2.words) assert.equal(G.revealed(s2)[w.cells.at(-1)], w.w.at(-1));
  assert.ok(Object.keys(G.revealed(s2)).length > Object.keys(G.revealed(s1)).length);
  // pénalité par erreur
  for (const penalty of [0, 1, 3]) {
    let s = start(G, [{ id: "a" }], { penalty }, 2, 0);
    const w = s.words[0];
    s = apply(G, s, "a", { type: "answer", word: 0, text: w.w.slice(0, -1) + (w.w.endsWith("Z") ? "Y" : "Z") });
    assert.equal(s.scores.a, 0 - penalty || 0); assert.equal(s.errors.a, 1);
  }
});

test("petites et grandes grilles : aucun mot parasite", () => {
  for (const W of [7, 11]) for (let seed = 1; seed <= 8; seed++) {
    const H = W + 2;
    const { grid, words } = G.generate(rng(seed), 24, W, H);
    const isL = (r, c) => r >= 0 && c >= 0 && r < H && c < W && grid[r * W + c] && grid[r * W + c].t === "L";
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      if (!isL(r, c)) continue;
      if (!isL(r, c - 1) && isL(r, c + 1)) assert.ok(words.some((w) => w.dir === "a" && w.cells[0] === r * W + c), `${W} : suite horizontale libre en ${r},${c}`);
      if (!isL(r - 1, c) && isL(r + 1, c)) assert.ok(words.some((w) => w.dir === "d" && w.cells[0] === r * W + c), `${W} : suite verticale libre en ${r},${c}`);
    }
    for (const w of words) assert.equal(grid[w.clue][w.dir], words.indexOf(w));
  }
});
