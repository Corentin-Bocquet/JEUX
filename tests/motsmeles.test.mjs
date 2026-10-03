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

// ---------------------------------------------------------------- options et modes
const optOf = (k) => G.options.find((o) => o.key === k);
const defaults = () => Object.fromEntries(G.options.map((o) => [o.key, o.def]));
const dirOf = (size, w) => {
  const r0 = Math.floor(w.a / size), c0 = w.a % size, r1 = Math.floor(w.b / size), c1 = w.b % size;
  return [Math.sign(r1 - r0), Math.sign(c1 - c0)];
};

test("options et modes bien formés", () => {
  assert.ok(G.options.length >= 2 && G.options.length <= 5);
  for (const o of G.options) {
    assert.ok(o.values.some((v) => v[0] === o.def), o.key);
    for (const v of o.values) { assert.ok(v[1].length <= 12, v[1]); if (v[2]) assert.ok(v[2].length <= 18, v[2]); }
    assert.ok(!["level", "turnTime"].includes(o.key));
  }
  assert.ok(G.modes.length >= 3 && G.modes.length <= 4);
  assert.equal(G.modes[0].name, "Classique");
  assert.deepEqual(G.modes[0].set, defaults());
  for (const m of G.modes) for (const [k, v] of Object.entries(m.set)) assert.ok(optOf(k).values.some((x) => x[0] === v), `${m.id}.${k}`);
  for (const t of optOf("theme").values.slice(1)) assert.ok(G.THEMES[t[0]], t[0]);
});

test("sans diagonales ni mots à l'envers : seulement à droite et vers le bas", () => {
  assert.equal(G.dirsFor().length, 8);
  assert.deepEqual(G.dirsFor(false, false), [[0, 1], [1, 0]]);
  assert.equal(G.dirsFor(true, false).length, 4);
  assert.equal(G.dirsFor(false, true).length, 4);
  for (let seed = 1; seed <= 15; seed++) for (const size of [10, 12, 14]) {
    const s = start(G, [{ id: "a" }], { size, diag: false, back: false }, seed, 0);
    assert.ok(s.words.length >= 7);
    for (const w of s.words) {
      const [dr, dc] = dirOf(size, w);
      assert.ok((dr === 0 && dc === 1) || (dr === 1 && dc === 0), `${w.w} : ${dr},${dc}`);
      assert.equal(G.lineCells(size, w.a, w.b).map((c) => s.grid[c]).join(""), w.w);
    }
    const d = start(G, [{ id: "a" }], { size, diag: true, back: false }, seed, 0);
    for (const w of d.words) { const [dr, dc] = dirOf(size, w); assert.ok(dc > 0 || (dc === 0 && dr > 0)); }
    const e = start(G, [{ id: "a" }], { size, diag: false, back: true }, seed, 0);
    for (const w of e.words) { const [dr, dc] = dirOf(size, w); assert.ok(dr === 0 || dc === 0); }
  }
});

test("réglages mémorisés, valeurs invalides ramenées aux défauts", () => {
  const s = start(G, [{ id: "a" }], { size: 10, theme: "Pays", diag: false, back: true, list: "hint" }, 1, 0);
  assert.deepEqual([s.size, s.theme, s.diag, s.back, s.list], [10, "Pays", false, true, "hint"]);
  const d = start(G, [{ id: "a" }], { size: 99, diag: "x", back: 0, list: "rien" }, 1, 0);
  assert.deepEqual([d.size, d.diag, d.back, d.list], [12, true, true, "full"]);
  assert.equal(d.grid.length, 144);
});

test("parties complètes pour chaque mode", () => {
  for (const m of G.modes) for (const n of [1, 6]) for (let seed = 1; seed <= 2; seed++) playout(G, n, seed, { settings: m.set });
});
