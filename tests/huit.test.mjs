import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/huit.js";
import { start, apply } from "../js/engine.js";
import { playout, timeoutPlayout } from "./harness.mjs";

const P3 = [{ id: "a" }, { id: "b" }, { id: "c" }];

function fixed(s, hands, top, suit) {
  s.hands = hands; s.discard = [top]; s.suit = suit; s.cur = 0; s.order = Object.keys(hands); return s;
}

test("règles de pose et cartes spéciales", () => {
  let s = start(G, P3, {}, 1, 0);
  s = fixed(s, { a: ["5H", "8C", "2H", "JH", "AH", "9S"], b: ["3D", "4D"], c: ["6C", "7C"] }, "5S", "S");
  assert.throws(() => apply(G, s, "a", { type: "play", card: "2H" }), /ne va pas/);
  assert.throws(() => apply(G, s, "b", { type: "play", card: "3D" }), /tour/);
  assert.throws(() => apply(G, s, "a", { type: "play", card: "8C" }), /couleur/);
  let t = apply(G, s, "a", { type: "play", card: "8C", suit: "D" });
  assert.equal(t.suit, "D"); assert.equal(G.toAct(t)[0], "b");
  // le 2 fait piocher 2 et passer le tour
  t = apply(G, s, "a", { type: "play", card: "5H", seed: 1 });
  t.cur = 0; t.hands.a = ["2H", "9S"];
  const before = t.hands.b.length;
  t = apply(G, t, "a", { type: "play", card: "2H", seed: 3 });
  assert.equal(t.hands.b.length, before + 2); assert.equal(G.toAct(t)[0], "c");
  // valet : saute ; as : change de sens
  let u = fixed(start(G, P3, {}, 2, 0), { a: ["JH", "4C"], b: ["3D", "4D"], c: ["6C", "7C"] }, "5H", "H");
  u = apply(G, u, "a", { type: "play", card: "JH" });
  assert.equal(G.toAct(u)[0], "c");
  let v = fixed(start(G, P3, {}, 3, 0), { a: ["AH", "4C"], b: ["3D", "4D"], c: ["6C", "7C"] }, "5H", "H");
  v = apply(G, v, "a", { type: "play", card: "AH" });
  assert.equal(G.toAct(v)[0], "c"); assert.equal(v.dir, -1);
});

test("pioche puis passe, fin de partie et classement aux points", () => {
  let s = fixed(start(G, P3, {}, 4, 0), { a: ["9C"], b: ["8D", "KS"], c: ["2C"] }, "5H", "H");
  assert.throws(() => apply(G, s, "a", { type: "pass" }), /Pioche/);
  s = apply(G, s, "a", { type: "draw", seed: 5 });
  assert.throws(() => apply(G, s, "a", { type: "draw", seed: 5 }), /déjà/);
  s.hands.a = ["9C", "4C"];
  s = apply(G, s, "a", { type: "pass" });
  s = apply(G, s, "b", { type: "play", card: "8D", suit: "C" });
  s.hands.c = ["2C"];
  s = apply(G, s, "c", { type: "play", card: "2C", seed: 1 });
  assert.equal(s.result.ranking[0].id, "c");
  const rb = s.result.ranking.find((r) => r.id === "b"), ra = s.result.ranking.find((r) => r.id === "a");
  assert.equal(rb.score, 10); assert.equal(rb.rank, 2);
  assert.equal(ra.score, 13); assert.equal(ra.rank, 3);
});

test("parties complètes 2 à 6 joueurs", () => {
  for (let seed = 1; seed <= 60; seed++) playout(G, 2 + (seed % 5), seed);
  timeoutPlayout(G, 4, 3);
});
