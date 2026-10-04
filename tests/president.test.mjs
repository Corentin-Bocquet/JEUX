import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/president.js";
import { start, apply } from "../js/engine.js";
import { playout, timeoutPlayout } from "./harness.mjs";

const P = (n) => Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "J" + i }));

// partie figée : mains connues, a commence
function fixed(hands, settings = {}) {
  const s = start(G, P(Object.keys(hands).length).map((p, i) => ({ id: Object.keys(hands)[i] })), settings, 1, 0);
  s.order = Object.keys(hands); s.hands = hands; s.cur = 0; s.plays = []; s.passed = []; s.out = []; s.phase = "play"; s.give = null;
  s.scores = Object.fromEntries(s.order.map((id) => [id, 0]));
  return s;
}

test("distribution : tout le paquet, le 3 de trèfle commence", () => {
  for (const n of [3, 4, 5, 7]) {
    const s = start(G, P(n), {}, n, 0);
    const all = Object.values(s.hands).flat();
    assert.equal(all.length, 52); assert.equal(new Set(all).size, 52);
    assert.ok(s.hands[G.toAct(s)[0]].includes("3C"));
  }
  const s = start(G, P(4), { two: false }, 3, 0);
  assert.ok(s.hands[G.toAct(s)[0]].includes("2C"), "2 faible : le 2 de trèfle commence");
});

test("poses légales, égalité permise, mauvais nombre refusé", () => {
  let s = fixed({ a: ["5H", "5S", "9C", "KD"], b: ["4C", "5D", "7S", "7H", "2D"], c: ["6C", "8D", "AS"] });
  assert.throws(() => apply(G, s, "b", { type: "play", cards: ["4C"] }), /tour/);
  assert.throws(() => apply(G, s, "a", { type: "pass" }), /ouvrir/);
  assert.throws(() => apply(G, s, "a", { type: "play", cards: ["5H", "9C"] }), /même valeur/);
  assert.throws(() => apply(G, s, "a", { type: "play", cards: ["QH"] }), /absente/);
  s = apply(G, s, "a", { type: "play", cards: ["5H", "5S"] });
  assert.throws(() => apply(G, s, "b", { type: "play", cards: ["5D"] }), /2 cartes/);
  assert.throws(() => apply(G, s, "b", { type: "play", cards: ["4C", "4C"] }), /absente/);
  s = apply(G, s, "b", { type: "play", cards: ["7S", "7H"] });
  assert.equal(G.toAct(s)[0], "c");
  s = apply(G, s, "c", { type: "pass" });
  s = apply(G, s, "a", { type: "pass" });
  // tout le monde a passé : b ramasse et rouvre
  assert.equal(G.toAct(s)[0], "b"); assert.equal(s.plays.length, 0);
  assert.equal(s.log.t, "close");
  s = apply(G, s, "b", { type: "play", cards: ["5D"] });
  s = apply(G, s, "c", { type: "play", cards: ["AS"] });
  assert.throws(() => apply(G, s, "a", { type: "play", cards: ["9C"] }), /plus forte/);
  s = apply(G, s, "a", { type: "pass" });
  s = apply(G, s, "b", { type: "play", cards: ["2D"] }); // le 2 bat l'As
  assert.equal(G.toAct(s)[0], "c");
});

test("qui a passé ne rejoue plus dans le pli", () => {
  let s = fixed({ a: ["3H", "9S"], b: ["4C", "KD"], c: ["5C", "QD"] });
  s = apply(G, s, "a", { type: "play", cards: ["3H"] });
  s = apply(G, s, "b", { type: "pass" });
  s = apply(G, s, "c", { type: "play", cards: ["5C"] });
  assert.equal(G.toAct(s)[0], "a", "b est sauté");
  s = apply(G, s, "a", { type: "pass" });
  assert.equal(G.toAct(s)[0], "c"); assert.equal(s.plays.length, 0);
});

test("carré magique : quatre cartes de même valeur ferment le pli", () => {
  let s = fixed({ a: ["7H", "7S", "3C"], b: ["7D", "7C", "4C"], c: ["KS", "KH", "5C"] });
  s = apply(G, s, "a", { type: "play", cards: ["7H", "7S"] });
  s = apply(G, s, "b", { type: "play", cards: ["7D", "7C"] });
  assert.equal(s.log.t, "magic"); assert.equal(G.toAct(s)[0], "b"); assert.equal(s.plays.length, 0);
  // sans l'option, le pli continue
  let u = fixed({ a: ["7H", "7S", "3C"], b: ["7D", "7C", "4C"], c: ["KS", "KH", "5C"] }, { magic: false });
  u = apply(G, u, "a", { type: "play", cards: ["7H", "7S"] });
  u = apply(G, u, "b", { type: "play", cards: ["7D", "7C"] });
  assert.equal(G.toAct(u)[0], "c"); assert.equal(u.plays.length, 2);
});

test("force du 2 selon l'option", () => {
  const s = fixed({ a: ["2H"], b: ["AS"], c: ["3C"] });
  assert.ok(G.power(s, "2H") > G.power(s, "AS"));
  const u = fixed({ a: ["2H"], b: ["AS"], c: ["3C"] }, { two: false });
  assert.ok(G.power(u, "2H") < G.power(u, "3C"));
});

test("fin de manche : rôles, points, échange et le Perdant commence", () => {
  let s = fixed({ a: ["3H"], b: ["4C", "9D"], c: ["5C", "6D"], d: ["8C", "8D"] }, { rounds: 3 });
  s = apply(G, s, "a", { type: "play", cards: ["3H"] }); // a fini 1er
  assert.deepEqual(s.out, ["a"]);
  s = apply(G, s, "b", { type: "play", cards: ["4C"] });
  s = apply(G, s, "c", { type: "play", cards: ["5C"] });
  s = apply(G, s, "d", { type: "pass" });
  s = apply(G, s, "b", { type: "pass" });
  // c ramasse et ouvre
  s = apply(G, s, "c", { type: "play", cards: ["6D"] }); // c fini 2e
  s = apply(G, s, "d", { type: "pass" });
  s = apply(G, s, "b", { type: "play", cards: ["9D"], seed: 5 }); // b fini 3e, d perd
  assert.equal(s.manche, 2);
  assert.deepEqual(s.roles, { a: "pres", c: "vice", b: "vperd", d: "perd" });
  assert.deepEqual(s.scores, { a: 3, c: 2, b: 1, d: 0 });
  assert.equal(s.phase, "give");
  assert.deepEqual(G.toAct(s).sort(), ["a", "c"]);
  assert.deepEqual(s.give.a.got.length, 2); assert.equal(s.give.c.got.length, 1);
  assert.equal(s.hands.a.length, 15); assert.equal(s.hands.d.length, 11);
  // le Perdant a donné ses meilleures cartes
  const dBest = Math.max(...s.hands.d.map((c) => G.power(s, c)));
  assert.ok(s.give.a.got.every((c) => G.power(s, c) >= dBest));
  assert.throws(() => apply(G, s, "d", { type: "play", cards: [s.hands.d[0]] }), /rien à donner/);
  assert.throws(() => apply(G, s, "a", { type: "give", cards: [s.hands.a[0]] }), /2 cartes/);
  s = apply(G, s, "a", { type: "give", cards: s.hands.a.slice(0, 2) });
  s = apply(G, s, "c", { type: "give", cards: s.hands.c.slice(0, 1) });
  assert.equal(s.phase, "play"); assert.equal(s.hands.a.length, 13); assert.equal(s.hands.d.length, 13);
  assert.equal(G.toAct(s)[0], "d", "le Perdant commence");
});

test("sans échange : on rejoue directement", () => {
  let s = fixed({ a: ["3H"], b: ["4C"], c: ["5C"] }, { swap: false, rounds: 3 });
  s = apply(G, s, "a", { type: "play", cards: ["3H"] });
  s = apply(G, s, "b", { type: "play", cards: ["4C"], seed: 2 });
  assert.equal(s.phase, "play"); assert.equal(s.manche, 2);
  assert.deepEqual(s.roles, { a: "pres", b: "neutre", c: "perd" });
});

test("classement final aux points", () => {
  const { st } = playout(G, 4, 99, { settings: { rounds: 3 } });
  const total = Object.values(st.scores).reduce((a, b) => a + b, 0);
  assert.equal(total, 3 * (3 + 2 + 1 + 0));
  const rk = st.result.ranking;
  for (let i = 1; i < rk.length; i++) assert.ok(rk[i - 1].score >= rk[i].score);
});

test("parties complètes 3 à 7 joueurs, tous niveaux", () => {
  for (let seed = 1; seed <= 30; seed++) playout(G, 3 + (seed % 5), seed, { settings: { level: 1 + (seed % 3) } });
  timeoutPlayout(G, 3, 3); timeoutPlayout(G, 7, 4);
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

test("chaque mode se joue jusqu'au bout, 3 et 7 joueurs", () => {
  G.modes.forEach((m, k) => {
    for (const n of [3, 7]) {
      const { st } = playout(G, n, 500 + k * 10 + n, { settings: m.set });
      assert.equal(st.manche, m.set.rounds);
    }
  });
});

test("réglage invalide : retour au défaut", () => {
  const s = start(G, P(3), { rounds: 42, two: "x" }, 1, 0);
  assert.equal(s.rounds, 3); assert.equal(s.two, true);
});
