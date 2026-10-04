import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/pouilleux.js";
import { start, apply } from "../js/engine.js";
import { rankOf } from "../js/games/cards.js";
import { playout, timeoutPlayout } from "./harness.mjs";

const P = (n) => Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "J" + i }));

function fixed(hands, settings = {}) {
  const ids = Object.keys(hands);
  const s = start(G, ids.map((id) => ({ id })), settings, 1, 0);
  s.order = ids; s.hands = hands; s.cur = 0; s.out = [];
  s.found = Object.fromEntries(ids.map((id) => [id, 0])); s.poux = Object.fromEntries(ids.map((id) => [id, 0]));
  return s;
}

test("donne : une carte retirée, plus aucune paire en main", () => {
  for (const n of [2, 3, 6]) {
    const s = start(G, P(n), {}, n, 0);
    const held = Object.values(s.hands).flat();
    assert.equal(held.length + 2 * Object.values(s.found).reduce((a, b) => a + b, 0), 51);
    assert.ok(!held.includes("QC"));
    for (const h of Object.values(s.hands)) assert.equal(new Set(h.map(rankOf)).size, h.length, "pas de paire restante");
  }
  const v = start(G, P(3), { card: "J", pairs: "color" }, 4, 0);
  const all = Object.values(v.hands).flat();
  assert.ok(!all.includes("JC")); assert.ok(all.includes("JS"), "le Valet de pique reste seul");
  assert.ok(all.filter((c) => rankOf(c) === "J").length === 1 || all.includes("JS"));
});

test("tirer chez le voisin, paire défaussée, tour suivant", () => {
  let s = fixed({ a: ["5H", "9C"], b: ["5S", "KD"], c: ["9D", "QS"] });
  assert.equal(G.target(s), "b");
  assert.throws(() => apply(G, s, "b", { type: "draw", idx: 0 }), /tour/);
  assert.throws(() => apply(G, s, "a", { type: "draw", idx: 5 }), /voisin/);
  assert.throws(() => apply(G, s, "a", { type: "draw" }), /voisin/);
  const i = s.hands.b.indexOf("5S");
  s = apply(G, s, "a", { type: "draw", idx: i, seed: 3 });
  assert.deepEqual(s.hands.a, ["9C"]); assert.equal(s.found.a, 1);
  assert.equal(s.log.pair, "5H");
  assert.equal(G.toAct(s)[0], "b"); assert.equal(G.target(s), "c");
});

test("paires de même teinte : 5 rouge et 5 noir ne vont pas ensemble", () => {
  let s = fixed({ a: ["5H", "9C"], b: ["5S", "KD"], c: ["9D", "QS"] }, { pairs: "color" });
  s = apply(G, s, "a", { type: "draw", idx: s.hands.b.indexOf("5S"), seed: 3 });
  assert.equal(s.hands.a.length, 3); assert.equal(s.found.a, 0);
});

test("les joueurs sans carte sont sautés, le dernier prend un pou", () => {
  let s = fixed({ a: ["5H"], b: ["5S", "QS"], c: ["9D"], d: ["9S"] }, { rounds: 1 });
  s = apply(G, s, "a", { type: "draw", idx: s.hands.b.indexOf("5S"), seed: 1 });
  assert.ok(s.out.includes("a"));
  // b tire chez c
  assert.equal(G.toAct(s)[0], "b"); assert.equal(G.target(s), "c");
  s = apply(G, s, "b", { type: "draw", idx: 0, seed: 2 }); // b prend 9D : pas de paire
  assert.ok(s.out.includes("c"));
  assert.equal(G.toAct(s)[0], "d"); assert.equal(G.target(s), "b", "d tire chez b (a et c sont sortis)");
  s = apply(G, s, "d", { type: "draw", idx: s.hands.b.indexOf("9D"), seed: 4 });
  assert.ok(s.result);
  assert.equal(s.poux.b, 1);
  const rk = s.result.ranking;
  assert.equal(rk.find((r) => r.id === "b").rank, 4);
  assert.ok(rk.filter((r) => r.rank === 1).length === 3);
});

test("plusieurs manches : le perdant commence la suivante", () => {
  let s = fixed({ a: ["5H"], b: ["5S", "QS"] }, { rounds: 3 });
  s = apply(G, s, "a", { type: "draw", idx: s.hands.b.indexOf("5S"), seed: 1 });
  assert.equal(s.manche, 2); assert.equal(s.poux.b, 1);
  assert.equal(s.lastManche.loser, "b"); assert.equal(s.lastManche.card, "QS");
  assert.equal(G.toAct(s)[0], "b");
});

test("parties complètes 2 à 6 joueurs", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const { st } = playout(G, 2 + (seed % 5), seed);
    assert.equal(Object.values(st.poux).reduce((a, b) => a + b, 0), 3);
  }
  timeoutPlayout(G, 2, 3); timeoutPlayout(G, 6, 4);
});

function checkShape(G) {
  const keys = G.options.map((o) => o.key);
  assert.ok(keys.length >= 2 && keys.length <= 5);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(!keys.includes("level") && !keys.includes("turnTime") && !keys.includes("mode"));
  for (const o of G.options) {
    assert.ok(o.label && o.icon && o.label.length <= 12);
    assert.ok(o.values.some((v) => v[0] === o.def), o.key + " : def dans values");
    for (const v of o.values) {
      assert.ok(v[1].length <= 12, "libellé trop long : " + v[1]);
      assert.ok(v[2] == null || v[2].length <= 18, "indication trop longue : " + v[2]);
    }
  }
  assert.ok(G.modes.length >= 3 && G.modes.length <= 4);
  assert.equal(G.modes[0].name, "Classique");
  assert.deepEqual(G.modes[0].set, Object.fromEntries(G.options.map((o) => [o.key, o.def])));
  const combos = G.modes.map((m) => JSON.stringify(G.options.map((o) => m.set[o.key])));
  assert.equal(new Set(combos).size, combos.length, "modes distincts");
  for (const m of G.modes) for (const [k, v] of Object.entries(m.set)) assert.ok(G.options.find((x) => x.key === k).values.some((x) => x[0] === v));
  const src = JSON.stringify([G.options, G.modes, G.meta]);
  assert.ok(!src.includes(String.fromCharCode(0x2014)), "pas de tiret cadratin");
}

test("options et modes bien formés", () => checkShape(G));

test("chaque mode se joue jusqu'au bout, 2 et 6 joueurs", () => {
  G.modes.forEach((m, k) => {
    for (const n of [2, 6]) {
      const { st } = playout(G, n, 300 + k * 10 + n, { settings: m.set });
      assert.equal(st.manche, m.set.rounds);
      // la carte perdante est toujours celle de la valeur retirée
      assert.equal(rankOf(st.lastManche.card), m.set.card);
    }
  });
});
