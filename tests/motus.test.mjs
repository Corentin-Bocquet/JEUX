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
  const s = start(G, [{ id: "a" }], { len: 9, rounds: 0, tries: 2, first: "non", bonus: 7 }, 1, 0);
  assert.equal(s.len, 6); assert.equal(s.rounds, 5); assert.equal(s.tries, 6); assert.equal(s.first, true); assert.equal(s.bonus, 20);
  // ancienne partie sans ces champs
  const old = { ...s }; delete old.tries; delete old.first;
  assert.equal(G.triesOf(old), 6); assert.equal(G.firstGiven(old), true);
});

test("chaque mode se joue jusqu'au bout", () => {
  for (const m of G.modes) for (const n of [1, 6]) {
    const { st } = playout(G, n, 20 + n, { settings: { ...m.set, rounds: 2, level: 1 + (n % 3) } });
    for (const h of st.history) for (const id of st.ids) assert.ok(h.tries[id] <= m.set.tries);
  }
});

test("effet concret des options", () => {
  // nombre d'essais : on est éliminé après 5 ou 7 erreurs
  for (const tries of [5, 7]) {
    let s = start(G, [{ id: "a" }, { id: "b" }], { len: 5, tries }, 3, 0);
    const wrong = [...G.dico(5)].filter((w) => w[0] === s.word[0] && w !== s.word);
    for (let k = 0; k < tries - 1; k++) s = apply(G, s, "a", { type: "guess", word: wrong[k] });
    assert.equal(s.status.a, "playing");
    s = apply(G, s, "a", { type: "guess", word: wrong[tries - 1] });
    assert.equal(s.status.a, "out");
  }
  // points : (essais + 1 - coups) x 10, plus le bonus du premier
  for (const [tries, bonus] of [[7, 0], [5, 50]]) {
    let s = start(G, [{ id: "a" }, { id: "b" }], { len: 5, tries, bonus }, 3, 0);
    s = apply(G, s, "a", { type: "guess", word: s.word });
    assert.equal(s.scores.a, tries * 10 + bonus);
  }
  // première lettre cachée : un mot qui commence autrement est accepté
  let s = start(G, [{ id: "a" }], { len: 5, first: false }, 3, 0);
  const other = [...G.dico(5)].find((w) => w[0] !== s.word[0]);
  assert.equal(G.check(s, other), null);
  s = apply(G, s, "a", { type: "guess", word: other });
  assert.equal(s.boards.a.length, 1);
  const s2 = start(G, [{ id: "a" }], { len: 5, first: true }, 3, 0);
  assert.match(G.check(s2, other), /commence/);
});
