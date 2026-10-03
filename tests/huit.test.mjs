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

test("chaque mode se joue jusqu'au bout, 2 et 6 joueurs", () => {
  G.modes.forEach((m, k) => {
    for (const n of [2, 6]) {
      const { st } = playout(G, n, 700 + k * 10 + n, { settings: m.set });
      if (m.set.target) assert.ok(st.order.some((id) => st.scores[id] >= m.set.target));
    }
  });
});

test("cartes en main au départ", () => {
  const P = (n) => Array.from({ length: n }, (_, i) => ({ id: "p" + i }));
  const sizes = (s) => [...new Set(Object.values(s.hands).map((h) => h.length))];
  assert.deepEqual(sizes(start(G, P(2), {}, 1, 0)), [7]);
  assert.deepEqual(sizes(start(G, P(4), {}, 1, 0)), [5]);
  assert.deepEqual(sizes(start(G, P(4), { cards: 10 }, 1, 0)), [10]);
  assert.deepEqual(sizes(start(G, P(3), { cards: 7 }, 1, 0)), [7]);
  assert.deepEqual(sizes(start(G, P(6), { cards: 10 }, 1, 0)), [6], "plafonné pour garder une pioche");
  assert.deepEqual(sizes(start(G, P(4), { cards: 99 }, 1, 0)), [5], "valeur invalide : défaut");
  const s = start(G, P(4), { cards: 10 }, 1, 0);
  assert.equal(s.pile.length + s.discard.length + 40, 52);
});

test("cartes spéciales désactivées", () => {
  let s = fixed(start(G, P3, { specials: false }, 1, 0), { a: ["2H", "JH", "AH", "4C"], b: ["3D", "4D"], c: ["6C", "7C"] }, "5H", "H");
  s = apply(G, s, "a", { type: "play", card: "2H", seed: 1 });
  assert.equal(s.hands.b.length, 2, "le 2 ne fait plus piocher");
  assert.equal(G.toAct(s)[0], "b");
  s.cur = 0;
  s = apply(G, s, "a", { type: "play", card: "JH" });
  assert.equal(G.toAct(s)[0], "b", "le valet ne saute plus");
  s.cur = 0;
  s = apply(G, s, "a", { type: "play", card: "AH" });
  assert.equal(s.dir, 1); assert.equal(G.toAct(s)[0], "b", "l'As ne change plus le sens");
});

test("course aux points sur plusieurs manches", () => {
  let s = start(G, P3, { target: 100 }, 1, 0);
  assert.equal(s.manche, 1);
  s = fixed(s, { a: ["5H"], b: ["8D", "KS"], c: ["2C", "3C"] }, "5S", "S");
  s = apply(G, s, "a", { type: "play", card: "5H", seed: 4 });
  assert.equal(s.result, undefined, "la partie continue");
  assert.deepEqual(s.scores, { a: 0, b: 60, c: 5 });
  assert.equal(s.manche, 2);
  assert.equal(s.lastRound.winner, "a");
  assert.equal(s.discard.length, 1);
  assert.ok(Object.values(s.hands).every((h) => h.length === 5), "nouvelle donne");
  // b dépasse 100 : fin, le moins chargé gagne
  const firstId = G.toAct(s)[0];
  const others = s.order.filter((id) => id !== firstId);
  const hands = { [firstId]: ["9S"], [others[0]]: ["8C", "8H"], [others[1]]: ["4C"] };
  s.hands = hands; s.discard = ["5S"]; s.suit = "S";
  s = apply(G, s, firstId, { type: "play", card: "9S", seed: 2 });
  assert.ok(s.result);
  const rk = s.result.ranking;
  assert.ok(rk[0].score <= rk[1].score && rk[1].score <= rk[2].score);
  assert.ok(rk[2].score >= 100);
});
