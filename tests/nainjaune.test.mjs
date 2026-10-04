import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/nainjaune.js";
import { start, apply } from "../js/engine.js";
import { playout, timeoutPlayout } from "./harness.mjs";

const P = (n) => Array.from({ length: n }, (_, i) => ({ id: "p" + i }));
const total = (s) => Object.values(s.chips).reduce((a, b) => a + b, 0) + s.board.reduce((a, b) => a + b, 0);

function fixed(s, hands) {
  s.order = Object.keys(hands); s.hands = hands; s.cur = 0; s.need = 0; s.run = []; s.untouched = s.order[0];
  return s;
}

test("mises et donne", () => {
  for (const n of [3, 4, 5, 6, 7, 8]) {
    const s = start(G, P(n), {}, n, 0);
    assert.deepEqual(s.board, [n, 2 * n, 3 * n, 4 * n, 5 * n]);
    assert.ok(Object.values(s.chips).every((c) => c === 100 - 15) || s.log?.t === "opera");
    const sizes = new Set(Object.values(s.hands).map((h) => h.length));
    assert.deepEqual([...sizes], [G.HAND[n]]);
    assert.equal(s.talon + n * G.HAND[n], 52);
    assert.equal(total(s), 100 * n);
  }
  assert.equal(start(G, P(4), { chips: 7 }, 1, 0).chips[start(G, P(4), { chips: 7 }, 1, 0).order[0]], 85, "valeur invalide : défaut");
});

test("suite montante, passage au suivant qui a la carte, roi", () => {
  let s = fixed(start(G, P(3), {}, 1, 0), { a: ["4S", "5H", "9C", "KS"], b: ["6D", "10C", "QH"], c: ["6S", "2C", "3C"] });
  assert.throws(() => apply(G, s, "b", { type: "play", card: "6D" }), /tour/);
  assert.throws(() => apply(G, s, "a", { type: "play", card: "AS" }), /absente/);
  s = apply(G, s, "a", { type: "play", card: "4S" });
  assert.equal(s.need, 5); assert.equal(G.toAct(s)[0], "a", "a continue avec son 5");
  assert.throws(() => apply(G, s, "a", { type: "play", card: "9C" }), /Il faut poser un 5/);
  s = apply(G, s, "a", { type: "play", card: "5H" });
  assert.equal(s.need, 6); assert.equal(G.toAct(s)[0], "b", "b a un 6");
  assert.equal(s.untouched, null);
  s = apply(G, s, "b", { type: "play", card: "6D" });
  // personne n'a de 7 : b repart librement
  assert.equal(s.need, 0); assert.equal(G.toAct(s)[0], "b"); assert.equal(s.log.stop, 7);
  s = apply(G, s, "b", { type: "play", card: "QH" });
  assert.equal(G.toAct(s)[0], "a");
  assert.equal(s.log.sans, 1, "c a dit sans roi");
  s = apply(G, s, "a", { type: "play", card: "KS" });
  assert.equal(s.need, 0); assert.equal(G.toAct(s)[0], "a", "après un roi, on repart");
});

test("les cases sont ramassées quand on pose la carte", () => {
  let s = fixed(start(G, P(3), {}, 2, 0), { a: ["6C", "7D", "9S"], b: ["8H", "2S"], c: ["3S", "4S"] });
  s.board = [3, 6, 9, 12, 15];
  const before = s.chips.a;
  s = apply(G, s, "a", { type: "play", card: "6C" });
  s = apply(G, s, "a", { type: "play", card: "7D" });
  assert.equal(s.chips.a, before + 15); assert.equal(s.board[4], 0); assert.equal(s.log.won, 15);
});

test("fin de manche : jetons par carte, belles gardées, grand opéra", () => {
  let s = fixed(start(G, P(3), { manches: 3 }, 3, 0), { a: ["2C", "4C"], b: ["3D", "KH", "9S"], c: ["5S", "JC", "10D", "AS"] });
  s.chips = { a: 50, b: 50, c: 50 }; s.board = [3, 6, 9, 12, 15];
  s.untouched = null;
  s = apply(G, s, "a", { type: "play", card: "2C" });
  s = apply(G, s, "b", { type: "play", card: "3D" });
  s = apply(G, s, "a", { type: "play", card: "4C", seed: 5 });
  const lr = s.lastRound;
  assert.equal(lr.winner, "a");
  assert.equal(lr.delta.a, 2 + 4);
  assert.equal(lr.delta.b, -(2 + 4), "2 cartes + roi de cœur gardé");
  assert.equal(lr.delta.c, -(4 + 1 + 2), "4 cartes + dix de carreau + valet de trèfle");
  assert.deepEqual(lr.paidBoxes, [1, 2, 0, 4, 0]);
  assert.equal(lr.opera, 0);
  assert.equal(s.manche, 2);
  // grand opéra : toute la main d'une traite dès le début
  let o = fixed(start(G, P(3), {}, 4, 0), { a: ["2C", "3C", "4C"], b: ["9D", "KH"], c: ["5S", "AS"] });
  o.chips = { a: 50, b: 50, c: 50 }; o.board = [3, 6, 9, 12, 15];
  for (const c of ["2C", "3C", "4C"]) o = apply(G, o, "a", { type: "play", card: c, seed: 2 });
  assert.equal(o.lastRound.opera, 45 + 4, "plateau entier + belle gardée payée");
  // sans l'option, pas d'opéra ni de pénalité
  let q = fixed(start(G, P(3), { opera: false, penalty: false }, 4, 0), { a: ["2C", "3C", "4C"], b: ["9D", "KH"], c: ["5S", "AS"] });
  q.chips = { a: 50, b: 50, c: 50 }; q.board = [3, 6, 9, 12, 15];
  for (const c of ["2C", "3C", "4C"]) q = apply(G, q, "a", { type: "play", card: c, seed: 2 });
  assert.equal(q.lastRound.opera, 0); assert.deepEqual(q.lastRound.paidBoxes, [0, 0, 0, 0, 0]);
  assert.equal(q.lastRound.delta.a, 4);
});

test("fin de partie au nombre de manches et classement aux jetons", () => {
  let s = fixed(start(G, P(3), { manches: 3 }, 5, 0), { a: ["2C"], b: ["3D"], c: ["5S"] });
  s.manche = 3; s.chips = { a: 10, b: 80, c: 40 }; s.untouched = null;
  s = apply(G, s, "a", { type: "play", card: "2C", seed: 1 });
  assert.ok(s.result);
  assert.deepEqual(s.result.ranking.map((x) => x.id), ["b", "c", "a"]);
  assert.equal(s.result.ranking[0].score, 79);
});

test("les jetons se conservent", () => {
  playout(G, 5, 77, { onStep: (st) => assert.equal(total(st), 500) });
});

test("parties complètes 3 à 8 joueurs", () => {
  for (let seed = 1; seed <= 36; seed++) playout(G, 3 + (seed % 6), seed, { settings: { level: 1 + (seed % 3) } });
  timeoutPlayout(G, 4, 3);
});

test("options et modes bien formés", () => {
  const keys = G.options.map((o) => o.key);
  assert.ok(keys.length >= 2 && keys.length <= 5);
  assert.ok(!keys.includes("level") && !keys.includes("turnTime") && !keys.includes("mode"));
  for (const o of G.options) {
    assert.ok(o.label.length <= 15 && o.icon);
    assert.ok(o.values.some((v) => v[0] === o.def));
    for (const v of o.values) { assert.ok(v[1].length <= 12, v[1]); assert.ok(v[2] == null || v[2].length <= 18, v[2]); }
  }
  assert.ok(G.modes.length >= 3 && G.modes.length <= 4);
  assert.equal(G.modes[0].name, "Classique");
  assert.deepEqual(G.modes[0].set, Object.fromEntries(G.options.map((o) => [o.key, o.def])));
  assert.equal(new Set(G.modes.map((m) => JSON.stringify(m.set))).size, G.modes.length);
  assert.ok(!JSON.stringify([G.options, G.modes, G.meta]).includes(String.fromCharCode(0x2014)));
});

test("chaque mode se joue jusqu'au bout, 3 et 8 joueurs", () => {
  G.modes.forEach((m, k) => {
    for (const n of [3, 8]) {
      const { st } = playout(G, n, 500 + k * 10 + n, { settings: m.set });
      assert.ok(st.manche <= m.set.manches);
      assert.ok(JSON.stringify(st).length < 30000);
    }
  });
});
