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

// ------------------------------------------------ options et modes
function checkShape(G, legacy) {
  const keys = G.options.map((o) => o.key);
  assert.ok(keys.length >= 2 && keys.length <= 5);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(!keys.includes("level") && !keys.includes("turnTime"));
  for (const k of legacy) assert.ok(keys.includes(k), "réglage existant conservé : " + k);
  for (const o of G.options) {
    assert.ok(o.label && o.icon);
    assert.ok(o.values.some((v) => v[0] === o.def), o.key + " : def dans values");
    for (const v of o.values) {
      assert.ok(["number", "string", "boolean"].includes(typeof v[0]));
      assert.ok(v[1].length <= 12, "libellé trop long : " + v[1]);
      assert.ok(v[2] == null || v[2].length <= 18, "indication trop longue : " + v[2]);
    }
  }
  assert.ok(G.modes.length >= 3 && G.modes.length <= 4);
  assert.equal(G.modes[0].name, "Classique");
  const defs = Object.fromEntries(G.options.map((o) => [o.key, o.def]));
  assert.deepEqual(G.modes[0].set, defs, "le mode classique = défauts");
  for (const m of G.modes) {
    assert.ok(m.id && m.name && m.emoji && m.desc);
    for (const [k, v] of Object.entries(m.set)) {
      const o = G.options.find((x) => x.key === k);
      assert.ok(o, m.id + " : clé inconnue " + k);
      assert.ok(o.values.some((x) => x[0] === v), m.id + " : valeur hors liste pour " + k);
    }
  }
  const src = JSON.stringify([G.options, G.modes, G.meta]);
  assert.ok(!src.includes(String.fromCharCode(0x2014)), "pas de tiret cadratin");
}

test("options et modes bien formés", () => checkShape(G, []));

test("chaque mode se joue jusqu'au bout, 1 et 6 joueurs", () => {
  G.modes.forEach((m, k) => {
    for (const n of [1, 6]) {
      const { st } = playout(G, n, 900 + k * 10 + n, { settings: m.set,
        onStep(s) { assert.ok(s.rolls <= m.set.rolls, "le robot respecte le nombre de lancers"); } });
      const nCats = m.set.sheet === "quick" ? 7 : 13;
      assert.equal(st.turnNo, nCats);
      for (const id of st.order) {
        assert.equal(Object.keys(st.sheets[id]).length, nCats);
        assert.ok(Object.values(st.sheets[id]).every((v) => v != null));
      }
    }
  });
});

test("nombre de lancers par tour", () => {
  for (const rolls of [2, 3, 4]) {
    let s = start(G, [{ id: "a" }], { rolls }, 1, 0);
    for (let k = 0; k < rolls; k++) s = apply(G, s, "a", { type: "roll", seed: k + 1 });
    assert.throws(() => apply(G, s, "a", { type: "roll", seed: 9 }), /Plus de lancer/);
  }
  assert.equal(start(G, [{ id: "a" }], { rolls: 7 }, 1, 0).maxRolls, 3, "valeur invalide : défaut");
});

test("bonus de la partie haute", () => {
  const sheet = { c1: 3, c2: 6, c3: 9, c4: 12, c5: 15, c6: 18 };
  assert.equal(G.totals(sheet, 50).total, 113);
  assert.equal(G.totals(sheet, 0).total, 63);
  const s = start(G, [{ id: "a" }], { bonus: 50 }, 1, 0);
  Object.assign(s.sheets.a, sheet);
  s.done = true;
  assert.equal(G.result(s).ranking[0].score, 113);
  s.bonus = 0;
  assert.equal(G.result(s).ranking[0].score, 63);
});

test("feuille rapide : partie basse seulement", () => {
  let s = start(G, [{ id: "a" }], { sheet: "quick" }, 1, 0);
  assert.deepEqual(Object.keys(s.sheets.a), ["brelan", "carre", "full", "petite", "grande", "yams", "chance"]);
  s = apply(G, s, "a", { type: "roll", seed: 3 });
  assert.throws(() => apply(G, s, "a", { type: "score", cat: "c1" }), /inconnue/);
  for (const cat of Object.keys(s.sheets.a)) {
    if (s.rolls === 0) s = apply(G, s, "a", { type: "roll", seed: 5 });
    s = apply(G, s, "a", { type: "score", cat });
  }
  assert.ok(s.result, "fini en 7 tours");
});
