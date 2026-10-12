import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/bombe.js";
import { start, apply } from "../js/engine.js";
import { wordsContaining } from "../js/data/dico.js";
import { playout, timeoutPlayout } from "./harness.mjs";

const P = [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }];
const defaults = () => Object.fromEntries(G.options.map((o) => [o.key, o.def]));

test("syllabes : sans doublon, beaucoup de mots chacune", () => {
  const all = [...G.POOLS.facile, ...G.POOLS.moyen, ...G.POOLS.dur];
  assert.equal(new Set(all).size, all.length);
  for (const k of Object.keys(G.POOLS)) assert.ok(G.POOLS[k].length >= 50, k);
  for (const x of all.filter((_, i) => i % 7 === 0)) assert.ok(wordsContaining(x, { limit: 300 }).length >= 300, x);
});

test("mot valide, refus, passage de la bombe", () => {
  let s = start(G, P, {}, 1, 1000);
  s.syllable = "TRA";
  const h = G.holder(s);
  assert.throws(() => apply(G, s, h, { type: "word", word: "maison", now: 2000 }), /contenir TRA/);
  assert.throws(() => apply(G, s, h, { type: "word", word: "traxq", now: 2000 }), /inconnu/);
  const other = P.find((p) => p.id !== h).id;
  assert.throws(() => apply(G, s, other, { type: "word", word: "train", now: 2000 }), /tour/);
  s = apply(G, s, h, { type: "word", word: "Train", now: 2000 });
  assert.equal(s.words[h], 1);
  assert.notEqual(G.holder(s), h);
  assert.ok(s.used.includes("TRAIN"));
  s.syllable = "TRA";
  assert.throws(() => apply(G, s, G.holder(s), { type: "word", word: "train", now: 2500 }), /servi/);
  assert.ok(G.deadline(s) >= 2000 + G.MIN_TURN);
});

test("la mèche : mot trop tard = explosion, boom constaté une seule fois", () => {
  let s = start(G, P, { lives: 2 }, 2, 1000);
  const h = G.holder(s);
  const dl = G.deadline(s);
  assert.throws(() => apply(G, s, "c", { type: "boom", tick: s.tick, now: dl - 10 }), /Pas encore/);
  const late = apply(G, s, h, { type: "word", word: "x", now: dl + 5 });
  assert.equal(late.lives[h], 1);
  assert.equal(late.last.k, "boom");
  s = apply(G, s, "c", { type: "boom", tick: s.tick, now: dl + 1 });
  assert.equal(s.lives[h], 1);
  assert.notEqual(G.holder(s), h);
  assert.ok(G.deadline(s) > dl);
  assert.throws(() => apply(G, s, "c", { type: "boom", tick: s.tick - 1, now: dl + 2 }), /changé/);
});

test("élimination et classement", () => {
  let s = start(G, P, { lives: 1 }, 3, 1000);
  const first = G.holder(s);
  s = apply(G, s, first, { type: "pass", now: 2000 });
  assert.equal(s.lives[first], 0);
  const second = G.holder(s);
  s = apply(G, s, second, { type: "pass", now: 3000 });
  assert.ok(s.result);
  assert.equal(s.result.ranking[0].rank, 1);
  assert.equal(s.result.ranking[2].id, first);
});

test("bonus alphabet : une vie de plus", () => {
  let s = start(G, P, { alpha: true }, 4, 1000);
  const h = G.holder(s);
  s.letters[h] = G.ALPHA.replace("T", "");
  s.syllable = "TRA";
  s = apply(G, s, h, { type: "word", word: "train", now: 1500 });
  assert.equal(s.lives[h], 3);
  assert.equal(s.letters[h], "");
});

test("parties complètes pour chaque mode, 2 et 8 joueurs", () => {
  for (const m of G.modes) for (const n of [2, 8]) for (let seed = 1; seed <= 2; seed++)
    playout(G, n, seed, { settings: { ...m.set, level: 1 + (seed % 3) } });
  timeoutPlayout(G, 3, 7);
  timeoutPlayout(G, 8, 9, { ...G.modes[2].set, turnTime: 10 });
});

test("options et modes bien formés", () => {
  for (const o of G.options) {
    assert.ok(o.values.some((v) => v[0] === o.def));
    for (const v of o.values) { assert.ok(v[1].length <= 12); if (v[2]) assert.ok(v[2].length <= 18); }
  }
  assert.ok(G.modes.length >= 3 && G.modes.length <= 4);
  assert.deepEqual(G.modes[0].set, defaults());
  assert.equal(new Set(G.modes.map((m) => JSON.stringify(m.set))).size, G.modes.length);
  const s = start(G, P, { lives: 9, fuse: "?" }, 1, 0);
  assert.equal(s.maxLives, 2); assert.equal(s.fuse, "normal");
});
