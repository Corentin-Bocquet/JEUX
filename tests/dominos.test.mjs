import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/dominos.js";
import { start, apply } from "../js/engine.js";
import { playout, timeoutPlayout } from "./harness.mjs";

const P2 = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
const fixed = { next: () => 0.5, int: () => 0, pick: (l) => l[0], shuffle: (l) => l.slice() };

// état fabriqué à la main : a a la main [[6,6],[1,2]], b a [[0,0]] ; chaîne 6-3
function handmade(extra = {}) {
  const s = start(G, P2, {}, 1, 0);
  s.order = ["a", "b"]; s.turn = 0;
  s.hands = { a: [[6, 6], [1, 2]], b: [[0, 0], [3, 4]] };
  s.chain = [[6, 3]];
  s.stock = [[2, 5], [1, 1]];
  Object.assign(s, extra);
  return s;
}

test("le jeu double-six compte 28 dominos et la donne est correcte", () => {
  assert.equal(G.ALL.length, 28);
  assert.equal(new Set(G.ALL.map((t) => t.join("-"))).size, 28);
  assert.equal(G.ALL.reduce((n, t) => n + G.pips(t), 0), 168);
  for (const [n, per] of [[2, 7], [3, 6], [4, 6]]) {
    const ps = Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "J" + i }));
    const s = start(G, ps, {}, 7, 0);
    for (const id of s.order) assert.equal(s.hands[id].length, per);
    assert.equal(s.stock.length, 28 - n * per);
    const all = [...s.stock, ...s.order.flatMap((id) => s.hands[id])].map((t) => t.join("-"));
    assert.equal(new Set(all).size, 28);
  }
  const s5 = start(G, P2, { hand: 5 }, 7, 0);
  assert.equal(s5.hands.a.length, 5);
  const bad = start(G, P2, { hand: 9, draw: "x", target: 42 }, 7, 0);
  assert.deepEqual([bad.handSize, bad.draw, bad.target], [0, "pioche", 0]);
});

test("le plus gros double commence", () => {
  for (let seed = 1; seed < 30; seed++) {
    const s = start(G, P2, {}, seed, 0);
    const best = (id) => Math.max(-1, ...s.hands[id].filter(G.isDouble).map((t) => t[0]));
    const starter = s.order[s.turn];
    const other = s.order.find((x) => x !== starter);
    if (best(starter) >= 0 || best(other) >= 0) assert.ok(best(starter) > best(other), "graine " + seed);
  }
});

test("poser aux deux bouts, orientation de la chaîne, coups illégaux", () => {
  let s = handmade();
  assert.throws(() => apply(G, s, "b", { type: "play", i: 0, side: "L" }), /tour/);
  assert.throws(() => apply(G, s, "a", { type: "play", i: 1, side: "L" }), /nulle part/);
  assert.throws(() => apply(G, s, "a", { type: "play", i: 0, side: "R" }), /côté/);
  assert.throws(() => apply(G, s, "a", { type: "draw" }), /déjà/);
  assert.throws(() => apply(G, s, "a", { type: "pass" }), /poser/);
  s = apply(G, s, "a", { type: "play", i: 0, side: "L" });
  assert.deepEqual(s.chain, [[6, 6], [6, 3]]);
  assert.deepEqual(G.ends(s), [6, 3]);
  // b pose 3-4 à droite, retourné en 3-4
  s = apply(G, s, "b", { type: "play", i: 1, side: "R" });
  assert.deepEqual(s.chain, [[6, 6], [6, 3], [3, 4]]);
  // a ne peut pas jouer 1-2 : il pioche (le dernier de la pioche est 1-1)
  assert.throws(() => apply(G, s, "a", { type: "pass" }), /Pioche/);
  s = apply(G, s, "a", { type: "draw" });
  assert.deepEqual(s.hands.a, [[1, 2], [1, 1]]);
  assert.equal(s.order[s.turn], "a", "on pioche jusqu'à pouvoir poser");
  s = apply(G, s, "a", { type: "draw" });
  assert.deepEqual(s.hands.a.at(-1), [2, 5]);
  assert.equal(s.stock.length, 0);
  s = apply(G, s, "a", { type: "pass" });
  assert.equal(s.order[s.turn], "b");
});

test("main vide : fin de manche, en une manche le moins de points gagne", () => {
  let s = handmade({ hands: { a: [[3, 5]], b: [[0, 0], [4, 4]] } });
  s = apply(G, s, "a", { type: "play", i: 0, side: "R" });
  assert.deepEqual(s.chain, [[6, 3], [3, 5]]);
  assert.ok(s.result);
  assert.deepEqual(s.result.ranking, [{ id: "a", rank: 1, score: 0 }, { id: "b", rank: 2, score: 8 }]);
});

test("partie bloquée : la main la plus légère gagne", () => {
  let s = handmade({ draw: "bloque", hands: { a: [[1, 2]], b: [[0, 1], [0, 4]] } });
  assert.throws(() => apply(G, s, "a", { type: "draw" }), /pioche/);
  s = apply(G, s, "a", { type: "pass" });
  s = apply(G, s, "b", { type: "pass" });
  assert.ok(s.end.blocked);
  assert.equal(s.end.winner, "a");
  assert.equal(s.result.ranking[0].id, "a");
  // égalité parfaite : personne ne gagne la manche
  let t = handmade({ draw: "bloque", hands: { a: [[1, 2]], b: [[0, 1], [0, 2]] }, target: 100 });
  t.hands.b = [[1, 2]];
  t = apply(G, t, "a", { type: "pass" });
  t = apply(G, t, "b", { type: "pass" });
  assert.equal(t.end.winner, null);
  assert.ok(!t.result);
});

test("partie aux points : le gagnant marque les mains adverses, manche suivante", () => {
  let s = handmade({ target: 100, hands: { a: [[3, 5]], b: [[6, 4], [2, 2]] } });
  s = apply(G, s, "a", { type: "play", i: 0, side: "R" });
  assert.equal(s.score.a, 14);
  assert.equal(s.end.gain, 14);
  assert.ok(!s.result);
  assert.deepEqual(G.toAct(s), ["a"]);
  assert.throws(() => apply(G, s, "a", { type: "play", i: 0, side: "L" }), /suivante/);
  assert.deepEqual(G.bot(s, "a", fixed), { type: "next" });
  s = apply(G, s, "a", { type: "next", seed: 5 });
  assert.equal(s.deal, 2);
  assert.equal(s.chain.length, 0);
  assert.equal(s.order[s.turn], "a", "le gagnant commence la manche suivante");
  assert.equal(s.hands.a.length, 7);
  // atteinte de l'objectif
  s.score.b = 95;
  s.hands.b = [[0, 6]]; s.turn = 1; s.chain = [[6, 6]];
  s = apply(G, s, "b", { type: "play", i: 0, side: "R" });
  assert.ok(s.score.b >= 100);
  assert.equal(s.result.ranking[0].id, "b");
});

test("robot : gros dominos d'abord, pioche ou passe quand il le faut", () => {
  const s = handmade({ level: 2 });
  s.hands.a = [[6, 1], [6, 5], [0, 1]];
  assert.deepEqual(G.bot(s, "a", fixed), { type: "play", i: 1, side: "L" });
  s.level = 3;
  // fort : garde la variété et de quoi rejouer
  s.hands.a = [[6, 5], [6, 1], [1, 2], [1, 4]];
  assert.deepEqual(G.bot(s, "a", fixed), { type: "play", i: 1, side: "L" });
  s.hands.a = [[1, 2]];
  assert.deepEqual(G.bot(s, "a", fixed), { type: "draw" });
  s.stock = [];
  assert.deepEqual(G.bot(s, "a", fixed), { type: "pass" });
});

test("parties complètes pour chaque mode, de 2 à 4 joueurs", () => {
  for (const m of G.modes) for (const n of [2, 3, 4]) for (let seed = 1; seed <= 4; seed++) {
    const { st } = playout(G, n, seed * 13 + n, { settings: { ...m.set, level: 1 + (seed % 3) } });
    if (m.set.target) assert.ok(st.order.some((id) => st.score[id] >= m.set.target) || st.deal >= G.MAX_DEALS);
    assert.ok(JSON.stringify(st).length < 30000);
  }
  timeoutPlayout(G, 2, 9);
  timeoutPlayout(G, 4, 3, { ...G.modes[2].set, turnTime: 10 });
});

const optOf = (k) => G.options.find((o) => o.key === k);
const defaults = () => Object.fromEntries(G.options.map((o) => [o.key, o.def]));
test("options et modes bien formés", () => {
  assert.ok(G.options.length >= 2 && G.options.length <= 5);
  for (const o of G.options) {
    assert.ok(o.values.some((v) => v[0] === o.def), o.key);
    assert.ok(o.label.length <= 12);
    for (const v of o.values) { assert.ok(v[1].length <= 12); if (v[2]) assert.ok(v[2].length <= 18, v[2]); }
    assert.ok(!["level", "turnTime", "mode"].includes(o.key));
  }
  assert.ok(G.modes.length >= 3 && G.modes.length <= 4);
  assert.equal(G.modes[0].name, "Classique");
  assert.deepEqual(G.modes[0].set, defaults());
  assert.equal(new Set(G.modes.map((m) => JSON.stringify(m.set))).size, G.modes.length);
  for (const m of G.modes) for (const [k, v] of Object.entries(m.set)) assert.ok(optOf(k).values.some((x) => x[0] === v), `${m.id}.${k}`);
});
