import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/yams.js";
import { start, apply } from "../js/engine.js";
import { playout, timeoutPlayout } from "./harness.mjs";

test("barème des combinaisons", () => {
  const s = G.scoreFor;
  assert.equal(s("c3", [3, 3, 1, 3, 6]), 9);
  assert.equal(s("brelan", [3, 3, 1, 3, 6]), 16);
  assert.equal(s("brelan", [3, 3, 1, 2, 6]), 0);
  assert.equal(s("carre", [5, 5, 5, 5, 2]), 22);
  assert.equal(s("full", [2, 2, 5, 5, 5]), 25);
  assert.equal(s("full", [5, 5, 5, 5, 5]), 0);
  assert.equal(s("petite", [1, 3, 2, 4, 4]), 30);
  assert.equal(s("petite", [6, 3, 5, 4, 1]), 30);
  assert.equal(s("petite", [1, 2, 3, 5, 6]), 0);
  assert.equal(s("grande", [2, 3, 4, 5, 6]), 40);
  assert.equal(s("grande", [1, 2, 3, 4, 6]), 0);
  assert.equal(s("yams", [4, 4, 4, 4, 4]), 50);
  assert.equal(s("chance", [1, 2, 3, 4, 6]), 16);
  const sheet = { c1: 3, c2: 6, c3: 9, c4: 12, c5: 15, c6: 18 };
  assert.deepEqual(G.totals(sheet), { up: 63, bonus: 35, down: 0, total: 98 });
});

test("lancers limités, dés gardés, case unique", () => {
  let s = start(G, [{ id: "a" }, { id: "b" }], {}, 4, 0);
  const p = s.order[0], q = s.order[1];
  assert.throws(() => apply(G, s, p, { type: "score", cat: "chance" }), /Lance/);
  s = apply(G, s, p, { type: "roll", seed: 11 });
  const keep = s.dice.slice();
  s = apply(G, s, p, { type: "roll", held: [true, true, false, false, false], seed: 12 });
  assert.equal(s.dice[0], keep[0]); assert.equal(s.dice[1], keep[1]);
  s = apply(G, s, p, { type: "roll", held: [true, true, true, true, true], seed: 13 });
  assert.throws(() => apply(G, s, p, { type: "roll", seed: 14 }), /Plus de lancer/);
  s = apply(G, s, p, { type: "score", cat: "chance" });
  assert.equal(G.toAct(s)[0], q);
  s = apply(G, s, q, { type: "roll", seed: 3 });
  s = apply(G, s, q, { type: "score", cat: "chance" });
  s = apply(G, s, p, { type: "roll", seed: 5 });
  assert.throws(() => apply(G, s, p, { type: "score", cat: "chance" }), /déjà/);
});

test("parties complètes de 1 à 6 joueurs", () => {
  let best = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const { st } = playout(G, 1 + (seed % 6), seed);
    for (const id of st.order) {
      assert.ok(Object.values(st.sheets[id]).every((v) => v != null));
      best = Math.max(best, G.totals(st.sheets[id]).total);
    }
  }
  assert.ok(best > 180, "le robot doit savoir marquer : " + best);
  timeoutPlayout(G, 3, 2);
});
