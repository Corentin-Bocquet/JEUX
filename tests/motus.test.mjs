import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/motus.js";
import { start, apply } from "../js/engine.js";
import { playout, timeoutPlayout } from "./harness.mjs";

test("couleurs avec lettres doublées", () => {
  assert.deepEqual(G.marks("ALLER", "ARBRE"), [2, 0, 0, 1, 1]);
  assert.deepEqual(G.marks("SALLE", "LASER"), [1, 2, 1, 0, 1]);
  assert.deepEqual(G.marks("LLLLL", "SALLE"), [0, 0, 2, 2, 0]);
  assert.equal(G.norm("éléphant"), "ELEPHANT");
});

test("assez de mots solutions, tous dans le dictionnaire", () => {
  for (const L of [5, 6, 7]) {
    assert.ok(G.solutions(L).length >= 100, `${L} lettres : ${G.solutions(L).length}`);
    for (const w of G.solutions(L)) assert.ok(G.dico(L).has(w));
  }
});

test("validation des essais, points, manches", () => {
  let s = start(G, [{ id: "a" }, { id: "b" }], { len: 5, rounds: 2 }, 3, 0);
  const word = s.word;
  assert.throws(() => apply(G, s, "a", { type: "guess", word: "AB" }), /5 lettres/);
  const other = [...G.dico(5)].find((w) => w[0] !== word[0]);
  assert.throws(() => apply(G, s, "a", { type: "guess", word: other }), /commence/);
  assert.throws(() => apply(G, s, "a", { type: "guess", word: word[0] + "QZXW" }), /inconnu/);
  s = apply(G, s, "b", { type: "guess", word: word.toLowerCase() });
  assert.equal(s.scores.b, 60 + 20);
  assert.throws(() => apply(G, s, "b", { type: "guess", word }), /prochaine/);
  const wrong = [...G.dico(5)].filter((w) => w[0] === word[0] && w !== word);
  for (let k = 0; k < 6; k++) s = apply(G, s, "a", { type: "guess", word: wrong[k], seed: 9 });
  assert.equal(s.roundNo, 2);
  assert.notEqual(s.word, word);
  assert.equal(s.history[0].word, word);
});

test("parties complètes avec robots", () => {
  for (let seed = 1; seed <= 8; seed++) playout(G, 1 + (seed % 3), seed, { settings: { len: 5 + (seed % 3), rounds: 2, level: 1 + (seed % 3) } });
  timeoutPlayout(G, 2, 4, { turnTime: 10, rounds: 2 });
});
