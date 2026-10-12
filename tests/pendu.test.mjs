import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/pendu.js";
import { start, apply } from "../js/engine.js";
import { isWord } from "../js/data/dico.js";
import { playout, timeoutPlayout } from "./harness.mjs";

const P = [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }];
const defaults = () => Object.fromEntries(G.options.map((o) => [o.key, o.def]));

test("liste de mots : 1500 mots courants, sans doublon, tous au dictionnaire", () => {
  assert.ok(G.WORDS.length >= 1500, "au moins 1500 mots");
  assert.equal(new Set(G.WORDS.map((x) => x.w)).size, G.WORDS.length);
  for (const x of G.WORDS) { assert.match(x.w, /^[A-Z]{4,13}$/); assert.ok(isWord(x.w), x.w); }
  assert.ok(G.CATS.length >= 15);
});

test("lettres, points, rejouer, erreurs et mot entier", () => {
  let s = start(G, P, {}, 1, 0);
  s.word = "BALLON"; s.cat = "Sports et jeux";
  const [x, y] = [G.toAct(s)[0], null];
  s = apply(G, s, x, { type: "letter", letter: "l" });
  assert.equal(s.scores[x], 20, "2 L = 20 points");
  assert.deepEqual(G.toAct(s), [x], "bonne lettre : on rejoue");
  assert.throws(() => apply(G, s, x, { type: "letter", letter: "L" }), /déjà/);
  s = apply(G, s, x, { type: "letter", letter: "Z" });
  assert.equal(s.errors, 1);
  const nx = G.toAct(s)[0];
  assert.notEqual(nx, x);
  assert.throws(() => apply(G, s, x, { type: "letter", letter: "A" }), /tour/);
  assert.throws(() => apply(G, s, nx, { type: "word", word: "BAL" }), /6 lettres/);
  s = apply(G, s, nx, { type: "word", word: "ballon" });
  assert.equal(s.scores[nx], 4 * 10 + 20);
  assert.equal(s.phase, "end");
  assert.equal(s.win, nx);
});

test("ballon à plat : manche perdue, puis manche suivante", () => {
  let s = start(G, P, { lives: 6, rounds: 3 }, 2, 0);
  s.word = "CHAT";
  for (const L of "BDEFGJ") s = apply(G, s, G.toAct(s)[0], { type: "letter", letter: L });
  assert.equal(s.phase, "end");
  assert.equal(s.win, null);
  const w = G.toAct(s)[0];
  s = apply(G, s, w, { type: "next", seed: 5 });
  assert.equal(s.roundNo, 2);
  assert.equal(s.phase, "guess");
  assert.equal(s.errors, 0);
  assert.notEqual(s.word, "CHAT");
});

test("maître du mot : choix, mot libre validé, points du maître", () => {
  let s = start(G, P, { master: true }, 3, 0);
  assert.equal(s.phase, "choose");
  assert.equal(s.sugg.length, 3);
  const m = s.masterId;
  assert.deepEqual(G.toAct(s), [m]);
  assert.throws(() => apply(G, s, m, { type: "choose", word: "XQZW" }), /dictionnaire/);
  assert.throws(() => apply(G, s, m, { type: "choose", word: "ZOO" }), /4 à 12/);
  s = apply(G, s, m, { type: "choose", word: "girafe" });
  assert.equal(s.word, "GIRAFE"); assert.equal(s.cat, "Mot libre");
  assert.ok(!G.toAct(s).includes(m), "le maître ne devine pas");
  s = apply(G, s, G.toAct(s)[0], { type: "letter", letter: "Z" });
  assert.equal(s.scores[m], 5);
});

test("robot fort : devine avec la liste", () => {
  let s = start(G, P, { level: 3 }, 4, 0);
  const a = G.bot(s, G.toAct(s)[0], { next: () => 0.5, int: () => 0, pick: (l) => l[0] });
  assert.equal(a.type, "letter");
  s.found = s.word.split("").slice(1);
  const c = G.candidates(s);
  assert.ok(c.includes(s.word));
});

test("parties complètes pour chaque mode, 2 et 6 joueurs", () => {
  for (const m of G.modes) for (const n of [2, 6]) for (let seed = 1; seed <= 2; seed++)
    playout(G, n, seed, { settings: { ...m.set, level: 1 + (seed % 3) } });
  timeoutPlayout(G, 3, 7);
  timeoutPlayout(G, 2, 8, { ...G.modes[1].set, turnTime: 10 });
});

test("options et modes bien formés", () => {
  assert.ok(G.options.length >= 2 && G.options.length <= 5);
  for (const o of G.options) {
    assert.ok(o.values.some((v) => v[0] === o.def));
    for (const v of o.values) { assert.ok(v[1].length <= 12, v[1]); if (v[2]) assert.ok(v[2].length <= 18, v[2]); }
  }
  assert.equal(G.modes[0].name, "Classique");
  assert.deepEqual(G.modes[0].set, defaults());
  assert.equal(new Set(G.modes.map((m) => JSON.stringify(m.set))).size, G.modes.length);
  const s = start(G, P, { rounds: 99, lives: "x" }, 1, 0);
  assert.equal(s.rounds, 5); assert.equal(s.lives, 8);
});
