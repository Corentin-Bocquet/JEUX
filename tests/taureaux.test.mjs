import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/taureaux.js";
import { start, apply } from "../js/engine.js";
import { playout, timeoutPlayout } from "./harness.mjs";

const P = (n) => Array.from({ length: n }, (_, i) => ({ id: "p" + i }));

test("têtes de taureau", () => {
  assert.equal(G.heads(55), 7);
  assert.equal(G.heads(11), 5); assert.equal(G.heads(88), 5);
  assert.equal(G.heads(10), 3); assert.equal(G.heads(100), 3);
  assert.equal(G.heads(5), 2); assert.equal(G.heads(85), 2);
  assert.equal(G.heads(1), 1); assert.equal(G.heads(104), 1);
  let t = 0; for (let n = 1; n <= 104; n++) t += G.heads(n);
  assert.equal(t, 171, "total du paquet");
});

test("donne : 10 cartes chacun, 4 rangées, variante tactique", () => {
  const s = start(G, P(8), {}, 1, 0);
  assert.ok(Object.values(s.hands).every((h) => h.length === 10));
  assert.equal(s.rows.length, 4);
  const all = [...Object.values(s.hands).flat(), ...s.rows.flat()];
  assert.equal(new Set(all).size, 84);
  const t = start(G, P(3), { tactic: true }, 2, 0);
  const allT = [...Object.values(t.hands).flat(), ...t.rows.flat()].sort((a, b) => a - b);
  assert.deepEqual(allT, Array.from({ length: 34 }, (_, i) => i + 1));
});

function fixed(s, hands, rows) { s.hands = hands; s.rows = rows; s.chosen = {}; s.queue = []; s.picker = null; return s; }

test("choix simultané, révélation et placement croissant", () => {
  let s = fixed(start(G, P(3), {}, 3, 0), { p0: [24, 50], p1: [23, 60], p2: [12, 70] }, [[10], [20], [30, 31, 32, 33, 34], [40]]);
  assert.deepEqual(G.toAct(s), ["p0", "p1", "p2"]);
  s = apply(G, s, "p1", { type: "choose", card: 23 });
  assert.deepEqual(G.toAct(s), ["p0", "p2"]);
  assert.throws(() => apply(G, s, "p1", { type: "choose", card: 60 }), /déjà/);
  assert.throws(() => apply(G, s, "p0", { type: "choose", card: 99 }), /absente/);
  s = apply(G, s, "p0", { type: "choose", card: 24 });
  assert.deepEqual(s.rows[1], [20], "rien n'est placé avant la révélation");
  s = apply(G, s, "p2", { type: "choose", card: 12 });
  assert.deepEqual(s.rows, [[10, 12], [20, 23, 24], [30, 31, 32, 33, 34], [40]]);
  assert.deepEqual(s.reveal.cards.map((x) => x[1]), [12, 23, 24]);
  assert.equal(s.turn, 2); assert.deepEqual(G.toAct(s), ["p0", "p1", "p2"]);
});

test("la 6e carte ramasse la rangée", () => {
  let s = fixed(start(G, P(2), {}, 4, 0), { p0: [35, 2], p1: [36, 3] }, [[10], [20], [30, 31, 32, 33, 34], [40]]);
  s = apply(G, s, "p0", { type: "choose", card: 35 });
  s = apply(G, s, "p1", { type: "choose", card: 36 });
  assert.equal(s.score.p0, 3 + 1 + 1 + 5 + 1);
  assert.deepEqual(s.rows[2], [35, 36]);
  assert.equal(s.score.p1, 0);
  // rangées de 4 : la 5e ramasse
  let t = fixed(start(G, P(2), { rowMax: 4 }, 4, 0), { p0: [34, 2], p1: [80, 3] }, [[10], [20], [30, 31, 32, 33], [40]]);
  t = apply(G, t, "p0", { type: "choose", card: 34 });
  t = apply(G, t, "p1", { type: "choose", card: 80 });
  assert.equal(t.score.p0, 3 + 1 + 1 + 5); assert.deepEqual(t.rows[2], [34]);
});

test("carte trop faible : on choisit la rangée à ramasser", () => {
  let s = fixed(start(G, P(3), {}, 5, 0), { p0: [5, 50], p1: [3, 60], p2: [41, 70] }, [[10, 11], [20], [30, 55], [40]]);
  s = apply(G, s, "p0", { type: "choose", card: 5 });
  s = apply(G, s, "p1", { type: "choose", card: 3 });
  s = apply(G, s, "p2", { type: "choose", card: 41 });
  assert.deepEqual(G.toAct(s), ["p1"], "le 3 passe en premier");
  assert.throws(() => apply(G, s, "p0", { type: "pick", row: 1 }), /rangée/);
  assert.throws(() => apply(G, s, "p1", { type: "pick", row: 7 }), /inconnue/);
  s = apply(G, s, "p1", { type: "pick", row: 0 });
  assert.equal(s.score.p1, 3 + 5);
  // le 5 va maintenant derrière le 3
  assert.deepEqual(s.rows[0], [3, 5]);
  assert.deepEqual(s.rows[3], [40, 41]);
  assert.deepEqual(G.toAct(s), ["p0", "p1", "p2"]);
});

test("fin de manche, nouvelle donne, fin de partie et classement", () => {
  let s = fixed(start(G, P(2), { target: 0 }, 6, 0), { p0: [45], p1: [3] }, [[10], [20], [30], [40, 41, 42, 43, 44]]);
  s = apply(G, s, "p0", { type: "choose", card: 45 });
  s = apply(G, s, "p1", { type: "choose", card: 3 });
  s = apply(G, s, "p1", { type: "pick", row: 0 });
  assert.ok(s.result);
  assert.deepEqual(s.result.ranking.map((x) => [x.id, x.score]), [["p1", 3], ["p0", 11]]);
  let t = fixed(start(G, P(2), {}, 7, 0), { p0: [45], p1: [3] }, [[10], [20], [30], [40, 41, 42, 43, 44]]);
  t = apply(G, t, "p0", { type: "choose", card: 45 });
  t = apply(G, t, "p1", { type: "choose", card: 3, seed: 3 });
  t = apply(G, t, "p1", { type: "pick", row: 0, seed: 3 });
  assert.equal(t.result, undefined); assert.equal(t.manche, 2);
  assert.ok(Object.values(t.hands).every((h) => h.length === 10));
  assert.deepEqual(t.lastRound.taken, { p0: 11, p1: 3 });
});

test("le robot évite les rangées pleines et ramasse la moins chère", () => {
  const s = fixed(start(G, P(4), { level: 3 }, 8, 0), { p0: [35, 22, 60], p1: [1], p2: [2], p3: [4] }, [[10], [20], [30, 31, 32, 33, 34], [40, 41]]);
  const a = G.bot(s, "p0", { next: () => 0.5, int: () => 0, pick: (x) => x[0] });
  assert.notEqual(a.card, 35);
  const t = fixed(start(G, P(2), {}, 9, 0), { p0: [5], p1: [3] }, [[10, 55], [20, 21], [30], [40, 11]]);
  t.picker = "p0"; t.queue = [{ id: "p0", card: 5 }];
  assert.deepEqual(G.bot(t, "p0", { next: () => 0.9, int: () => 0 }), { type: "pick", row: 2 });
});

test("parties complètes 2 à 8 joueurs", () => {
  for (let seed = 1; seed <= 35; seed++) playout(G, 2 + (seed % 7), seed, { settings: { level: 1 + (seed % 3) } });
  timeoutPlayout(G, 5, 3);
  timeoutPlayout(G, 8, 4, { turnTime: 10, target: 0 });
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
  const src = JSON.stringify([G.options, G.modes, G.meta]);
  assert.ok(!src.includes(String.fromCharCode(0x2014)));
  assert.ok(!src.toLowerCase().includes(["qui", "prend"].join(" ")), "nom de marque interdit");
});

test("chaque mode se joue jusqu'au bout, 2 et 8 joueurs", () => {
  G.modes.forEach((m, k) => {
    for (const n of [2, 8]) {
      const { st } = playout(G, n, 300 + k * 10 + n, { settings: m.set });
      if (m.set.target) assert.ok(st.order.some((id) => st.score[id] >= m.set.target));
      else assert.equal(st.manche, 1);
      assert.ok(JSON.stringify(st).length < 30000);
    }
  });
});
