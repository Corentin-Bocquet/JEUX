import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/motscroises.js";
import { start, apply, rng } from "../js/engine.js";
import { isWord } from "../js/data/dico.js";
import { playout, timeoutPlayout } from "./harness.mjs";

const P = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
const defaults = () => Object.fromEntries(G.options.map((o) => [o.key, o.def]));

test("banque : 600+ mots, sans doublon, au dictionnaire, définitions courtes", () => {
  assert.ok(G.DICT.length >= 600, String(G.DICT.length));
  assert.equal(new Set(G.DICT.map((x) => x.w)).size, G.DICT.length);
  for (const x of G.DICT) {
    assert.ok(isWord(x.w), x.w);
    assert.ok(x.d.length >= 3 && x.d.length <= 45, x.d);
    assert.ok(!x.d.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().includes(x.w), "la définition ne contient pas le mot : " + x.w);
    assert.ok(!x.d.includes("—"));
  }
});

test("grilles valides : chaque suite de lettres est un mot de la liste", () => {
  for (const N of [9, 11, 13]) for (let seed = 1; seed <= 6; seed++) {
    const g = G.generate(rng(seed * 31 + N), N);
    assert.ok(g.w <= N && g.h <= N);
    assert.ok(g.words.length >= 6);
    const runs = [];
    for (let r = 0; r < g.h; r++) for (const m of g.cells.slice(r * g.w, (r + 1) * g.w).matchAll(/[A-Z]{2,}/g)) runs.push("a" + (r * g.w + m.index) + m[0]);
    for (let c = 0; c < g.w; c++) {
      let col = ""; for (let r = 0; r < g.h; r++) col += g.cells[r * g.w + c];
      for (const m of col.matchAll(/[A-Z]{2,}/g)) runs.push("d" + (m.index * g.w + c) + m[0]);
    }
    assert.deepEqual(runs.sort(), g.words.map((x) => x.dir + x.at + x.w).sort());
  }
});

test("réponses : points, bonus du premier, pénalité, fin", () => {
  let s = start(G, P, { penalty: 3, bonus: 5 }, 1, 0);
  const x = s.words[0];
  assert.throws(() => apply(G, s, "a", { type: "answer", word: 0, text: "A" }), /lettres/);
  s = apply(G, s, "a", { type: "answer", word: 0, text: x.w.slice(0, -1) + (x.w.endsWith("Z") ? "Y" : "Z") });
  assert.equal(s.scores.a, -3);
  s = apply(G, s, "a", { type: "answer", word: 0, text: x.w.toLowerCase() });
  assert.equal(s.scores.a, -3 + x.w.length + 5);
  assert.throws(() => apply(G, s, "a", { type: "answer", word: 0, text: x.w }), /Déjà/);
  s = apply(G, s, "b", { type: "answer", word: 0, text: x.w });
  assert.equal(s.scores.b, x.w.length, "pas de bonus pour le second");
  assert.ok(!G.letters(s, "a")[x.at + 99999]);
  assert.equal(G.letters(s, "b")[x.at], x.w[0]);
  s = apply(G, s, "b", { type: "giveup" });
  assert.deepEqual(G.toAct(s), ["a"]);
  for (let i = 1; i < s.words.length; i++) s = apply(G, s, "a", { type: "answer", word: i, text: s.words[i].w });
  assert.ok(s.result);
  assert.equal(s.result.ranking[0].id, "a");
});

test("aide : 1re lettre visible, révélation sans points", () => {
  let s = start(G, P, { reveal: true }, 2, 0);
  const L = G.letters(s, "a");
  for (const x of s.words) assert.equal(L[x.at], x.w[0]);
  s = apply(G, s, "a", { type: "reveal" });
  assert.equal(s.shown.a.length, 1);
  assert.equal(s.scores.a, 0);
});

test("parties complètes pour chaque mode, 1 et 6 joueurs", () => {
  for (const m of G.modes) for (const n of [1, 6]) playout(G, n, n + 3, { settings: { ...m.set, level: 1 + (n % 3) } });
  timeoutPlayout(G, 2, 7);
});

test("options et modes bien formés", () => {
  for (const o of G.options) {
    assert.ok(o.values.some((v) => v[0] === o.def));
    for (const v of o.values) { assert.ok(v[1].length <= 12); if (v[2]) assert.ok(v[2].length <= 18); }
  }
  assert.deepEqual(G.modes[0].set, defaults());
  assert.equal(new Set(G.modes.map((m) => JSON.stringify(m.set))).size, G.modes.length);
  const s = start(G, P, { size: 4, penalty: "z" }, 1, 0);
  assert.ok(s.w <= 11); assert.equal(s.penalty, 1);
  assert.ok(JSON.stringify(start(G, [...P, ...P.map((p) => ({ id: p.id + "2" }))], { size: 13 }, 5, 0)).length < 30000);
});
