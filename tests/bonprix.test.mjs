import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/bonprix.js";
import { start, apply } from "../js/engine.js";
import { playout, timeoutPlayout } from "./harness.mjs";

const P = [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }];
const defaults = () => Object.fromEntries(G.options.map((o) => [o.key, o.def]));

test("options et modes bien formés", () => {
  assert.ok(G.options.length >= 2 && G.options.length <= 5);
  for (const o of G.options) {
    assert.ok(o.label.length <= 12 && o.values.some((v) => v[0] === o.def), o.key);
    for (const v of o.values) { assert.ok(v[1].length <= 12, v[1]); if (v[2]) assert.ok(v[2].length <= 18, v[2]); }
    assert.ok(!["level", "turnTime", "mode"].includes(o.key));
  }
  assert.ok(G.modes.length >= 3 && G.modes.length <= 4);
  assert.equal(G.modes[0].name, "Classique");
  assert.deepEqual(G.modes[0].set, defaults());
  assert.equal(new Set(G.modes.map((m) => JSON.stringify(m.set))).size, G.modes.length);
  for (const m of G.modes) for (const [k, v] of Object.entries(m.set)) assert.ok(G.options.find((o) => o.key === k).values.some((x) => x[0] === v), `${m.id}.${k}`);
});

test("données : 250 produits et plus, prix crédibles, sans doublon", () => {
  assert.ok(G.PRODUITS.length >= 250);
  const names = new Set();
  for (const [n, e, d, c, r] of G.PRODUITS) {
    assert.ok(!names.has(n), "doublon " + n); names.add(n);
    assert.ok(e && d && d.length < 90, n);
    assert.ok(Number.isInteger(c) && c >= 10 && c <= 300000, n);
    assert.ok(["c", "m", "s"].includes(r), n);
    assert.ok(!/—|juste prix/i.test(n + d));
  }
  for (const r of ["c", "m", "s"]) assert.ok(G.PRODUITS.filter((p) => p[4] === r).length >= 12, r);
  const price = (n) => G.PRODUITS.find((p) => p[0] === n)[3];
  assert.ok(price("Baguette de pain") < price("Croissant au beurre") * 2);
  assert.ok(price("iPhone 16") > price("Smartphone d'entrée de gamme"));
});

function forcePrice(s, cents) {
  // place en tête de partie un produit au prix voulu
  const i = G.PRODUITS.findIndex((p) => p[3] === cents);
  s.deck[s.roundNo - 1] = i;
  return s;
}

test("une offre, sans dépasser : le plus proche en dessous gagne, pile = bonus", () => {
  let s = forcePrice(start(G, P, {}, 1, 0), 105); // baguette 1,05 €
  assert.throws(() => apply(G, s, "a", { type: "bid", cents: 0 }), /invalide/);
  assert.throws(() => apply(G, s, "a", { type: "bid", cents: 1.5 }), /invalide/);
  s = apply(G, s, "a", { type: "bid", cents: 104 });
  assert.throws(() => apply(G, s, "a", { type: "bid", cents: 100 }), /Attends/);
  s = apply(G, s, "b", { type: "bid", cents: 106 });
  s = apply(G, s, "c", { type: "bid", cents: 90 });
  assert.equal(s.phase, "reveal");
  assert.deepEqual(s.win, ["a"]);
  assert.equal(s.scores.a, 150);
  assert.equal(s.scores.b, 0);
});

test("tout le monde dépasse : personne ; au plus près : le dépassement compte", () => {
  let s = forcePrice(start(G, P, {}, 1, 0), 105);
  for (const id of ["a", "b", "c"]) s = apply(G, s, id, { type: "bid", cents: 200 });
  assert.deepEqual(s.win, []);
  let t = forcePrice(start(G, P, { regle: "proche" }, 1, 0), 105);
  t = apply(G, t, "a", { type: "bid", cents: 100 });
  t = apply(G, t, "b", { type: "bid", cents: 107 });
  t = apply(G, t, "c", { type: "pass" });
  assert.deepEqual(t.win, ["b"]);
  assert.equal(t.scores.b, 150);
});

test("plus ou moins : indices, trouvé à 5 %, essais limités", () => {
  let s = forcePrice(start(G, P, { jeu: "plusmoins" }, 1, 0), 105);
  s = apply(G, s, "a", { type: "bid", cents: 50 });
  assert.equal(s.g.a[0][1], 1);
  s = apply(G, s, "a", { type: "bid", cents: 200 });
  assert.equal(s.g.a[1][1], -1);
  s = apply(G, s, "a", { type: "bid", cents: 101 });
  assert.equal(s.st.a, "found");
  assert.equal(s.scores.a, 70 + 20);
  for (let k = 0; k < G.PM_TRIES; k++) s = apply(G, s, "b", { type: "bid", cents: 5000 });
  assert.equal(s.st.b, "out");
  s = apply(G, s, "c", { type: "pass" });
  assert.equal(s.phase, "reveal");
});

test("parties complètes pour chaque mode", () => {
  for (const m of G.modes) for (const n of [1, 8]) playout(G, n, n + m.id.length, { settings: { ...m.set, level: 1 + (n % 3) } });
  for (let seed = 1; seed <= 6; seed++) playout(G, 4, seed, { settings: { jeu: "plusmoins", level: (seed % 3) + 1 } });
  timeoutPlayout(G, 2, 4);
  timeoutPlayout(G, 3, 5, { ...G.modes[2].set, turnTime: 10 });
  const st = start(G, P, { rounds: 3, jeu: "?", rayon: 9 }, 1, 0);
  assert.equal(st.rounds, 8); assert.equal(st.jeu, "offre"); assert.equal(st.rayon, "tout");
});

test("le robot fort trouve en plus ou moins", () => {
  let found = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const { st } = playout(G, 1, seed, { settings: { jeu: "plusmoins", rounds: 5, level: 3 } });
    found += st.scores.p0 > 0 ? 1 : 0;
  }
  assert.ok(found >= 18, found);
});
