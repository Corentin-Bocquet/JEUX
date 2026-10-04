import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/menteur.js";
import { start, apply, rng } from "../js/engine.js";
import { rankOf } from "../js/games/cards.js";
import { playout, timeoutPlayout } from "./harness.mjs";

const P = (n) => Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "J" + i }));

function fixed(hands, settings = {}) {
  const ids = Object.keys(hands);
  const s = start(G, ids.map((id) => ({ id })), settings, 1, 0);
  s.order = ids; s.hands = hands; s.cur = 0; s.last = -1; s.pile = []; s.gone = []; s.phase = "play"; s.call = null; s.winner = null;
  s.known = Object.fromEntries(ids.map((id) => [id, []]));
  return s;
}

test("donne : tout le paquet (un tiers écarté à deux), carrés défaussés", () => {
  for (const n of [3, 4, 6]) {
    const s = start(G, P(n), {}, n, 0);
    assert.equal(Object.values(s.hands).flat().length + 4 * s.gone.length, 52);
  }
  const d = start(G, P(2), {}, 2, 0);
  assert.equal(Object.values(d.hands).flat().length + 4 * d.gone.length, 52 - 17);
  const t = start(G, P(4), { deck: 32 }, 2, 0);
  const all = Object.values(t.hands).flat();
  assert.ok(all.every((c) => ["7", "8", "9", "10", "J", "Q", "K", "A"].includes(rankOf(c))));
  assert.equal(all.length + 4 * t.gone.length, 32);
});

test("pose, fenêtre d'accusation pour tous, annonce qui avance", () => {
  let s = fixed({ a: ["AH", "AS", "5C"], b: ["2H", "9S"], c: ["3D", "KC"] });
  assert.deepEqual(G.allowed(s), ["A"]);
  assert.throws(() => apply(G, s, "b", { type: "play", cards: ["2H"] }), /tour/);
  assert.throws(() => apply(G, s, "a", { type: "play", cards: [] }), /1 à 4/);
  assert.throws(() => apply(G, s, "a", { type: "play", cards: ["AH", "AH"] }), /absente/);
  assert.throws(() => apply(G, s, "a", { type: "play", cards: ["AH"], val: "K" }), /annoncer/);
  s = apply(G, s, "a", { type: "play", cards: ["AH", "AS"], now: 1000 });
  assert.equal(s.phase, "doubt");
  assert.deepEqual(G.toAct(s), ["b", "c"], "tout le monde peut accuser en même temps");
  assert.equal(s.call.until, 1000 + 8000);
  s = apply(G, s, "b", { type: "pass" });
  assert.throws(() => apply(G, s, "b", { type: "pass" }), /déjà/);
  s = apply(G, s, "c", { type: "pass" });
  assert.equal(s.phase, "play"); assert.equal(G.toAct(s)[0], "b");
  assert.deepEqual(G.allowed(s), ["2"]);
});

test("accusation juste : le menteur ramasse le tas", () => {
  let s = fixed({ a: ["AH", "5C", "6C"], b: ["2H", "9S"], c: ["3D", "KC"] });
  s = apply(G, s, "a", { type: "play", cards: ["AH"] });
  s = apply(G, s, "b", { type: "pass" }); s = apply(G, s, "c", { type: "pass" });
  s = apply(G, s, "b", { type: "play", cards: ["9S"] }); // annonce un 2 : mensonge
  s = apply(G, s, "c", { type: "call" });
  assert.equal(s.reveal.lied, true); assert.equal(s.reveal.taker, "b");
  assert.deepEqual(s.hands.b.slice().sort(), ["2H", "9S", "AH"].sort());
  assert.equal(s.pile.length, 0); assert.equal(s.phase, "play");
  assert.equal(G.toAct(s)[0], "c", "on reprend après le poseur");
  assert.ok(s.known.b.includes("9S"), "la carte retournée est connue de tous");
});

test("accusation fausse : l'accusateur ramasse ; dernière carte vraie : victoire", () => {
  let s = fixed({ a: ["AH", "5C"], b: ["2H", "9S"], c: ["3D", "KC"] });
  s = apply(G, s, "a", { type: "play", cards: ["AH"] });
  s = apply(G, s, "c", { type: "call" });
  assert.equal(s.reveal.lied, false); assert.equal(s.reveal.taker, "c");
  assert.ok(s.hands.c.includes("AH"));
  let w = fixed({ a: ["AH"], b: ["2H"], c: ["3D"] });
  w = apply(G, w, "a", { type: "play", cards: ["AH"] });
  w = apply(G, w, "b", { type: "call" });
  assert.equal(w.winner, "a");
  assert.equal(w.result.ranking[0].id, "a");
  // dernière carte, personne n'accuse : gagné aussi
  let x = fixed({ a: ["5H"], b: ["2H", "4C"], c: ["3D"] });
  x = apply(G, x, "a", { type: "play", cards: ["5H"] });
  x = apply(G, x, "b", { type: "pass" }); x = apply(G, x, "c", { type: "pass" });
  assert.equal(x.result.ranking[0].id, "a");
  assert.equal(x.result.ranking.find((r) => r.id === "b").rank, 3);
  // dernière carte mensongère démasquée : on continue
  let y = fixed({ a: ["5H"], b: ["2H", "4C"], c: ["3D"] });
  y = apply(G, y, "a", { type: "play", cards: ["5H"] });
  y = apply(G, y, "c", { type: "call" });
  assert.equal(y.winner, null); assert.equal(y.hands.a.length, 1);
});

test("carré reconstitué en ramassant : défaussé", () => {
  let s = fixed({ a: ["AH", "AS", "4C"], b: ["AD", "AC", "9S"], c: ["3D", "KC"] });
  s = apply(G, s, "a", { type: "play", cards: ["AH", "AS"] });
  s = apply(G, s, "b", { type: "call" });
  assert.deepEqual(s.reveal.quads, ["A"]); assert.deepEqual(s.gone, ["A"]);
  assert.ok(!s.hands.b.some((c) => rankOf(c) === "A"));
});

test("annonce au choix : même valeur, au-dessus ou en dessous", () => {
  let s = fixed({ a: ["5H", "6S", "7C"], b: ["2H", "9S"] }, { claim: "near" });
  assert.equal(G.allowed(s).length, 13, "première annonce libre");
  s = apply(G, s, "a", { type: "play", cards: ["5H"], val: "5" });
  s = apply(G, s, "b", { type: "pass" });
  assert.deepEqual(G.allowed(s).sort(), ["4", "5", "6"].sort());
  assert.throws(() => apply(G, s, "b", { type: "play", cards: ["2H"], val: "9" }), /annoncer/);
  let t = fixed({ a: ["KH"], b: ["2H", "9S"] }, { claim: "near" });
  t.last = 12;
  assert.deepEqual(G.allowed(t).sort(), ["A", "K", "Q"].sort(), "le cycle boucle");
});

test("robots : accusent un mensonge certain, se fient à une pose plausible", () => {
  const s = fixed({ a: ["5H", "6S", "7C"], b: ["AH", "AS", "AD", "9S", "4C"], c: ["3D"] });
  const t = apply(G, s, "a", { type: "play", cards: ["5H", "6S"] }); // 2 As alors que b en a 3
  assert.equal(G.suspicion(t, "b"), 1);
  assert.deepEqual(G.bot(t, "b", rng(1)), { type: "call" });
  const u = apply(G, fixed({ a: ["AH", "6S", "7C", "8C", "9C"], b: ["3D", "4C", "5C", "6C", "7D"], c: ["8D"] }), "a", { type: "play", cards: ["AH"] });
  assert.ok(G.suspicion(u, "b") < 0.2);
  // robot joueur : dit la vérité s'il peut, sinon bluffe avec une seule carte
  const v = fixed({ a: ["AH", "AS", "7C", "8C", "9C"], b: ["3D"] }, { level: 2 });
  const a1 = G.bot(v, "a", { next: () => 0.99, int: () => 0, pick: (l) => l[0] });
  assert.deepEqual(a1.cards.sort(), ["AH", "AS"].sort());
  const w = fixed({ a: ["7C", "8C", "9C", "KD"], b: ["3D"] }, { level: 2 });
  const a2 = G.bot(w, "a", { next: () => 0.99, int: () => 0, pick: (l) => l[0] });
  assert.equal(a2.cards.length, 1); assert.equal(a2.val, "A");
});

test("temps écoulé dans la fenêtre : on laisse passer", () => {
  const s = apply(G, fixed({ a: ["5H", "6S"], b: ["2H"], c: ["3D"] }), "a", { type: "play", cards: ["5H"] });
  assert.deepEqual(G.auto(s, "b", rng(1)), { type: "pass" });
});

test("parties complètes 2 à 6 joueurs, tous niveaux", () => {
  for (let seed = 1; seed <= 30; seed++) playout(G, 2 + (seed % 5), seed, { settings: { level: 1 + (seed % 3) } });
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
    for (const n of [2, 6]) playout(G, n, 900 + k * 10 + n, { settings: m.set, maxSteps: 60000 });
  });
});
