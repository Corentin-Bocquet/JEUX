import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/derniere.js";
import { start, apply } from "../js/engine.js";
import { playout, timeoutPlayout } from "./harness.mjs";

const P3 = [{ id: "a" }, { id: "b" }, { id: "c" }];
const P = (n) => Array.from({ length: n }, (_, i) => ({ id: "p" + i }));

function fixed(s, hands, top, color) {
  s.order = Object.keys(hands); s.hands = hands; s.discard = [top]; s.color = color || G.colorOf(top);
  s.cur = 0; s.dir = 1; s.pending = 0; s.drawn = null; s.called = null;
  return s;
}

test("le paquet : 108 cartes, 25 par couleur, 8 jokers", () => {
  const d = G.fullDeck();
  assert.equal(d.length, 108);
  for (const c of G.COLORS) assert.equal(d.filter((x) => G.colorOf(x) === c).length, 25);
  assert.equal(d.filter((x) => x === "W").length, 4);
  assert.equal(d.filter((x) => x === "W4").length, 4);
  assert.equal(d.filter((x) => x === "R0").length, 1);
  assert.equal(d.filter((x) => x === "B7").length, 2);
  assert.equal(G.points("G7"), 7); assert.equal(G.points("RD"), 20); assert.equal(G.points("W4"), 50);
});

test("pose par couleur ou par valeur, jokers", () => {
  let s = fixed(start(G, P3, {}, 1, 0), { a: ["R5", "G7", "B5", "W", "Y2", "Y3"], b: ["Y1", "Y4", "Y6"], c: ["G1", "G2", "G3"] }, "R7");
  assert.throws(() => apply(G, s, "a", { type: "play", card: "Y2" }), /ne va pas/);
  assert.throws(() => apply(G, s, "b", { type: "play", card: "Y1" }), /tour/);
  assert.throws(() => apply(G, s, "a", { type: "play", card: "W" }), /couleur/);
  let t = apply(G, s, "a", { type: "play", card: "G7" });
  assert.equal(t.color, "G"); assert.equal(G.toAct(t)[0], "b");
  t = apply(G, s, "a", { type: "play", card: "W", color: "Y" });
  assert.equal(t.color, "Y");
  t = apply(G, t, "b", { type: "play", card: "Y1" });
  assert.equal(G.toAct(t)[0], "c");
});

test("+2, inversion, passe ton tour, joker +4", () => {
  let s = fixed(start(G, P3, {}, 2, 0), { a: ["RD", "R1", "R2"], b: ["Y1", "Y4"], c: ["G1", "G2"] }, "R7");
  s = apply(G, s, "a", { type: "play", card: "RD", seed: 3 });
  assert.equal(s.hands.b.length, 4, "b pioche 2"); assert.equal(G.toAct(s)[0], "c", "b passe son tour");
  let u = fixed(start(G, P3, {}, 3, 0), { a: ["RI", "R1", "R2"], b: ["Y1", "Y4"], c: ["G1", "G2"] }, "R7");
  u = apply(G, u, "a", { type: "play", card: "RI" });
  assert.equal(u.dir, -1); assert.equal(G.toAct(u)[0], "c");
  let v = fixed(start(G, P3, {}, 4, 0), { a: ["RP", "R1", "R2"], b: ["Y1", "Y4"], c: ["G1", "G2"] }, "R7");
  v = apply(G, v, "a", { type: "play", card: "RP" });
  assert.equal(G.toAct(v)[0], "c");
  let w = fixed(start(G, P3, {}, 5, 0), { a: ["W4", "R1", "R2"], b: ["Y1", "Y4"], c: ["G1", "G2"] }, "R7");
  w = apply(G, w, "a", { type: "play", card: "W4", color: "B", seed: 9 });
  assert.equal(w.hands.b.length, 6); assert.equal(w.color, "B"); assert.equal(G.toAct(w)[0], "c");
  // à deux, l'inversion fait rejouer
  let x = fixed(start(G, P(2), {}, 6, 0), { p0: ["RI", "R1", "R2"], p1: ["Y1", "Y4"] }, "R7");
  x = apply(G, x, "p0", { type: "play", card: "RI" });
  assert.equal(G.toAct(x)[0], "p0");
});

test("cumul des +2 et +4", () => {
  let s = fixed(start(G, P3, { stack: true }, 1, 0), { a: ["RD", "R1", "R2"], b: ["YD", "Y4", "Y5"], c: ["G1", "G2", "W4"] }, "R7");
  s = apply(G, s, "a", { type: "play", card: "RD" });
  assert.equal(s.pending, 2); assert.equal(s.hands.b.length, 3);
  assert.throws(() => apply(G, s, "b", { type: "play", card: "Y4" }), /Renvoie/);
  s = apply(G, s, "b", { type: "play", card: "YD" });
  assert.equal(s.pending, 4);
  assert.throws(() => apply(G, s, "c", { type: "play", card: "G1" }), /Renvoie/);
  s = apply(G, s, "c", { type: "play", card: "W4", color: "G" });
  assert.equal(s.pending, 8);
  s = apply(G, s, "a", { type: "draw", seed: 5 });
  assert.equal(s.hands.a.length, 10); assert.equal(s.pending, 0); assert.equal(G.toAct(s)[0], "b");
});

test("pioche : une carte, puis la poser ou passer ; ou jusqu'à pouvoir jouer", () => {
  let s = fixed(start(G, P3, {}, 7, 0), { a: ["Y1", "Y2"], b: ["Y3"], c: ["Y4"] }, "R7");
  assert.throws(() => apply(G, s, "a", { type: "pass" }), /Pioche/);
  s.pile = ["R3", "B1", "B2"];
  s = apply(G, s, "a", { type: "draw" });
  assert.equal(s.drawn, "R3"); assert.equal(G.toAct(s)[0], "a");
  assert.throws(() => apply(G, s, "a", { type: "draw" }), /déjà/);
  assert.throws(() => apply(G, s, "a", { type: "play", card: "Y1" }), /ne va pas/);
  const t = apply(G, s, "a", { type: "pass" });
  assert.equal(G.toAct(t)[0], "b");
  s = apply(G, s, "a", { type: "play", card: "R3" });
  assert.equal(s.color, "R");
  // carte piochée injouable : le tour passe tout seul
  let u = fixed(start(G, P3, {}, 8, 0), { a: ["Y1", "Y2"], b: ["Y3"], c: ["Y4"] }, "R7");
  u.pile = ["B1", "B2", "R4"];
  u = apply(G, u, "a", { type: "draw" });
  assert.equal(u.hands.a.length, 3); assert.equal(G.toAct(u)[0], "b");
  // jusqu'à pouvoir jouer
  let v = fixed(start(G, P3, { drawUntil: true }, 9, 0), { a: ["Y1", "Y2"], b: ["Y3"], c: ["Y4"] }, "R7");
  v.pile = ["B1", "B2", "G7", "Y9"];
  v = apply(G, v, "a", { type: "draw" });
  assert.equal(v.hands.a.length, 5); assert.equal(v.drawn, "G7");
});

test("annonce de la dernière carte et pénalité", () => {
  let s = fixed(start(G, P3, {}, 10, 0), { a: ["R1", "R2"], b: ["Y3", "Y5"], c: ["Y4", "Y6"] }, "R7");
  const forgot = apply(G, s, "a", { type: "play", card: "R1", seed: 2 });
  assert.equal(forgot.hands.a.length, 3, "oubli : 1 + 2 cartes de pénalité");
  assert.equal(forgot.log.penalty, 2);
  assert.throws(() => apply(G, fixed(start(G, P3, {}, 10, 0), { a: ["R1", "R2", "R3"], b: ["Y3"], c: ["Y4"] }, "R7"), "a", { type: "last" }), /deux cartes/);
  s = apply(G, s, "a", { type: "last" });
  assert.equal(G.toAct(s)[0], "a");
  s = apply(G, s, "a", { type: "play", card: "R1" });
  assert.equal(s.hands.a.length, 1); assert.ok(s.log.announced);
  assert.equal(s.called, null, "l'annonce ne sert qu'une fois");
});

test("fin de manche et points", () => {
  let s = fixed(start(G, P3, {}, 11, 0), { a: ["R1"], b: ["Y3", "W"], c: ["GD", "G9"] }, "R7");
  s = apply(G, s, "a", { type: "play", card: "R1" });
  const rk = s.result.ranking;
  assert.equal(rk[0].id, "a"); assert.equal(rk[0].score, 53 + 29);
  assert.deepEqual(rk.slice(1).map((x) => x.id), ["c", "b"]);
  // course aux points : nouvelle manche tant que personne n'atteint le seuil
  let t = fixed(start(G, P3, { target: 200 }, 12, 0), { a: ["R1"], b: ["Y3", "W"], c: ["GD", "G9"] }, "R7");
  t = apply(G, t, "a", { type: "play", card: "R1", seed: 4 });
  assert.equal(t.result, undefined);
  assert.equal(t.scores.a, 82); assert.equal(t.manche, 2);
  assert.ok(Object.values(t.hands).every((h) => h.length === 7));
  t.scores.a = 190;
  t = fixed(t, { a: ["R1"], b: ["Y3"], c: ["G9"] }, "R7");
  t = apply(G, t, "a", { type: "play", card: "R1", seed: 4 });
  assert.equal(t.result.ranking[0].id, "a"); assert.equal(t.result.ranking[0].score, 202);
});

test("cartes en main et valeurs invalides", () => {
  const sizes = (s) => [...new Set(Object.values(s.hands).map((h) => h.length))];
  assert.deepEqual(sizes(start(G, P(4), {}, 1, 0)), [7]);
  assert.deepEqual(sizes(start(G, P(8), { cards: 10 }, 1, 0)), [10]);
  assert.deepEqual(sizes(start(G, P(4), { cards: 99, stack: "x" }, 1, 0)), [7]);
  const s = start(G, P(8), { cards: 10 }, 3, 0);
  assert.equal(s.pile.length + s.discard.length + 80, 108);
  assert.ok(/^[RYGB]\d$/.test(s.discard[0]), "la première carte est un chiffre");
});

test("parties complètes 2 à 8 joueurs", () => {
  for (let seed = 1; seed <= 50; seed++) playout(G, 2 + (seed % 7), seed);
  timeoutPlayout(G, 4, 3);
  timeoutPlayout(G, 2, 5, { turnTime: 10, stack: true });
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
  assert.ok(!new RegExp("\\b" + ["u", "n", "o"].join("") + "\\b", "i").test(src), "nom de marque interdit");
});

test("chaque mode se joue jusqu'au bout, 2 et 8 joueurs", () => {
  G.modes.forEach((m, k) => {
    for (const n of [2, 8]) {
      for (const level of [1, 3]) {
        const { st } = playout(G, n, 900 + k * 10 + n + level, { settings: { ...m.set, level } });
        if (m.set.target) assert.ok(st.order.some((id) => st.scores[id] >= m.set.target));
        assert.ok(JSON.stringify(st).length < 30000);
      }
    }
  });
});
