import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/blackjack.js";
import { start, apply } from "../js/engine.js";
import { playout, timeoutPlayout } from "./harness.mjs";

test("valeur des mains", () => {
  assert.deepEqual(G.value(["AS", "KD"]), { total: 21, soft: true });
  assert.deepEqual(G.value(["AS", "AD", "9C"]), { total: 21, soft: true });
  assert.deepEqual(G.value(["AS", "5D", "9C"]), { total: 15, soft: false });
  assert.equal(G.value(["KS", "QD", "2C"]).total, 22);
  assert.ok(G.isBJ(["AS", "10H"]));
  assert.ok(!G.isBJ(["AS", "5H", "5C"]));
});

function rigged(s, shoeTop) { s.shoe = shoeTop.slice().reverse(); return s; }

test("mises, gains, blackjack 3 pour 2, banque qui tire jusqu'à 17", () => {
  let s = start(G, [{ id: "a" }, { id: "b" }], { rounds: 2 }, 1, 0);
  // seed 9 : la donne aléatoire ne finit pas la manche d'emblée (vérifié plus bas)
  assert.throws(() => apply(G, s, "a", { type: "bet", amount: 5 }), /invalide/);
  assert.throws(() => apply(G, s, "a", { type: "bet", amount: 15 }), /invalide/);
  s = apply(G, s, "a", { type: "bet", amount: 100 });
  assert.equal(s.phase, "bet");
  s = apply(G, s, "b", { type: "bet", amount: 200, seed: 9 });
  assert.equal(s.phase, "play");
  // on remplace la donne par une donne connue
  s.hands = { a: ["AS", "KD"], b: ["10S", "6D"] }; s.dealer = ["9C", "7H"]; s.done = { a: true }; s.cur = 1;
  s = rigged(s, ["5C", "4H"]);
  s = apply(G, s, "b", { type: "hit" }); // 21 → fini automatiquement
  // banque : 16 → tire 4 → 20
  assert.equal(s.manche, 2);
  assert.equal(s.last.dealerTotal, 20);
  assert.equal(s.chips.a, 1150); // blackjack 3 pour 2
  assert.equal(s.chips.b, 1200);
});

test("doubler, sauter, fin après la dernière manche", () => {
  let s = start(G, [{ id: "a" }], { rounds: 1 }, 2, 0);
  s = apply(G, s, "a", { type: "bet", amount: 100, seed: 3 });
  Object.assign(s, { result: undefined, phase: "play", manche: 1, chips: { a: 1000 }, bets: { a: 100 }, doubled: {} });
  s.hands = { a: ["5S", "6D"] }; s.dealer = ["10C", "8H"]; s.done = {}; s.cur = 0;
  s = rigged(s, ["10H"]);
  s = apply(G, s, "a", { type: "double" });
  assert.equal(s.chips.a, 1200);
  assert.equal(s.phase, "over");
  assert.equal(s.result.ranking[0].rank, 1);
  let t = start(G, [{ id: "a" }], { rounds: 1 }, 2, 0);
  t = apply(G, t, "a", { type: "bet", amount: 100, seed: 3 });
  Object.assign(t, { result: undefined, phase: "play", manche: 1, chips: { a: 1000 }, bets: { a: 100 }, doubled: {} });
  t.hands = { a: ["KS", "6D"] }; t.dealer = ["10C", "8H"]; t.done = {}; t.cur = 0;
  t = rigged(t, ["10H"]);
  t = apply(G, t, "a", { type: "hit" });
  assert.equal(t.chips.a, 900); // sauté
});

test("parties complètes 1 à 5 joueurs", () => {
  for (let seed = 1; seed <= 50; seed++) {
    const { st } = playout(G, 1 + (seed % 5), seed, { settings: { rounds: 6 } });
    for (const id of st.order) assert.ok(st.chips[id] >= 0);
  }
  timeoutPlayout(G, 3, 5, { turnTime: 10, rounds: 3 });
});
