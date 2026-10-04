import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/oie.js";
import { start, apply, rng } from "../js/engine.js";
import { playout, timeoutPlayout } from "./harness.mjs";

const P = [{ id: "a", name: "Alice" }, { id: "b", name: "Bob" }, { id: "c", name: "Cléo" }];
// graine qui donne les dés voulus
const seedFor = (...want) => {
  for (let s = 1; ; s++) {
    const r = rng(s);
    const d = want.map(() => 1 + r.int(6));
    if (d.every((v, i) => v === want[i])) return s;
  }
};
const at = (s, pid, pos) => { s.pos[pid] = pos; return s; };

test("déplacements purs : oies, pont, labyrinthe, mort, recul", () => {
  assert.equal(G.moveOf(1, [2, 2]).to, 13, "oie en 5 puis en 9 : 13");
  assert.equal(G.moveOf(2, [2, 2]).to, 12, "pont en 6 -> 12");
  assert.equal(G.moveOf(40, [1, 1]).to, 30, "labyrinthe 42 -> 30");
  assert.equal(G.moveOf(55, [1, 2]).to, 0, "tête de mort -> départ");
  assert.equal(G.moveOf(60, [3, 2]).to, 61, "60 + 5 = 65 : recule en 61");
});

test("recul exact depuis 60", () => {
  const m = G.moveOf(60, [4, 1]);
  assert.equal(m.to, 61);
  assert.ok(m.frames.some((f) => f[1] === 63));
  assert.equal(G.moveOf(57, [3, 3]).to, 63);
});

test("premier lancer 6 + 3 -> 26, 5 + 4 -> 53", () => {
  assert.equal(G.moveOf(0, [6, 3]).to, 26);
  assert.equal(G.moveOf(0, [3, 6]).to, 26);
  assert.equal(G.moveOf(0, [4, 5]).to, 53);
  assert.equal(G.moveOf(0, [5, 4]).to, 53);
});

test("oies avec un seul dé et en reculant", () => {
  // depuis 0 avec 1 dé : 5 -> oie -> 10
  assert.equal(G.moveOf(0, [5]).to, 10);
  assert.equal(G.moveOf(57, [6, 4]).to, 49, "57 + 10 = 67 : recul en 59 (oie) puis encore 10 en arrière : 49");
});

test("hôtellerie : deux tours sans jouer", () => {
  let s = start(G, P.slice(0, 2), {}, 1, 0);
  const [x, y] = s.order;
  at(s, x, 16);
  s = apply(G, s, x, { type: "roll", seed: seedFor(1, 2) });
  assert.equal(s.pos[x], 19);
  assert.equal(s.wait[x], 2);
  assert.deepEqual(G.toAct(s), [y]);
  s = apply(G, s, y, { type: "roll", seed: seedFor(1, 1) });
  assert.deepEqual(G.toAct(s), [y], "x passe son tour");
  s = apply(G, s, y, { type: "roll", seed: seedFor(1, 1) });
  assert.deepEqual(G.toAct(s), [y], "x passe encore son tour");
  s = apply(G, s, y, { type: "roll", seed: seedFor(1, 1) });
  assert.deepEqual(G.toAct(s), [x], "x rejoue");
});

test("puits : bloqué jusqu'à la délivrance, échange de place", () => {
  let s = start(G, P, {}, 1, 0);
  const [x, y, z] = s.order;
  at(s, x, 29); at(s, y, 20); at(s, z, 26);
  s = apply(G, s, x, { type: "roll", seed: seedFor(1, 1) });
  assert.equal(s.pos[x], 31);
  assert.equal(s.stuck[x], 31);
  s = apply(G, s, y, { type: "roll", seed: seedFor(1, 1) });
  s = apply(G, s, z, { type: "roll", seed: seedFor(1, 1) });
  assert.deepEqual(G.toAct(s), [y], "x est sauté");
  at(s, y, 29);
  s = apply(G, s, y, { type: "roll", seed: seedFor(1, 1) });
  assert.equal(s.pos[y], 31);
  assert.equal(s.stuck[y], 31);
  assert.equal(s.stuck[x], 0, "x est délivré");
  assert.equal(s.pos[x], 29, "et prend la place de départ de y");
});

test("tout le monde coincé : quelqu'un est libéré", () => {
  let s = start(G, P.slice(0, 2), {}, 1, 0);
  const [x, y] = s.order;
  at(s, x, 29); at(s, y, 50);
  s = apply(G, s, x, { type: "roll", seed: seedFor(1, 1) });
  s = apply(G, s, y, { type: "roll", seed: seedFor(1, 1) });
  assert.equal(s.pos[y], 52);
  assert.equal(G.toAct(s).length, 1, "la partie continue");
  assert.ok(/coincé/.test(s.last.msg));
});

test("mode tours : puits 2 tours, prison 3, sans échange", () => {
  let s = start(G, P.slice(0, 2), { trap: "tours", swap: 0 }, 1, 0);
  const [x, y] = s.order;
  at(s, x, 29); at(s, y, 31 - 2);
  s = apply(G, s, x, { type: "roll", seed: seedFor(1, 1) });
  assert.equal(s.wait[x], 2);
  assert.equal(s.stuck[x], 0);
  s = apply(G, s, y, { type: "roll", seed: seedFor(1, 1) });
  assert.equal(s.pos[x], 31, "pas d'échange");
  assert.equal(s.pos[y], 31);
});

test("un dé : un seul dé lancé", () => {
  let s = start(G, P.slice(0, 2), { dice: 1 }, 1, 0);
  s = apply(G, s, s.order[0], { type: "roll", seed: 77 });
  assert.equal(s.last.dice.length, 1);
});

test("victoire et classement", () => {
  let s = start(G, P, {}, 2, 0);
  const [x, y, z] = s.order;
  at(s, x, 60); at(s, y, 10); at(s, z, 40);
  s = apply(G, s, x, { type: "roll", seed: seedFor(1, 2) });
  assert.equal(s.winner, x);
  assert.deepEqual(s.result.ranking.map((e) => e.id), [x, z, y]);
});

test("options et modes bien formés", () => {
  assert.ok(G.options.length >= 2 && G.options.length <= 5);
  for (const o of G.options) {
    assert.ok(o.values.some((v) => v[0] === o.def), o.key);
    for (const v of o.values) { assert.ok(v[1].length <= 12, v[1]); if (v[2]) assert.ok(v[2].length <= 18, v[2]); }
  }
  assert.ok(G.modes.length >= 3 && G.modes.length <= 4);
  assert.equal(G.modes[0].name, "Classique");
  assert.deepEqual(G.modes[0].set, Object.fromEntries(G.options.map((o) => [o.key, o.def])));
  assert.equal(new Set(G.modes.map((m) => JSON.stringify(m.set))).size, G.modes.length);
  const s = start(G, P, { dice: 7, swap: "z", trap: 1 }, 1, 0);
  assert.deepEqual([s.dice, s.swap, s.trap], [2, 1, "secours"]);
  assert.equal(G.OIES.length, 13);
});

test("parties complètes pour chaque mode, de 2 à 6 joueurs", () => {
  for (const m of G.modes) for (const n of [2, 6]) for (let seed = 1; seed <= 4; seed++) {
    const { st } = playout(G, n, seed * 31 + n, { settings: { ...m.set } });
    assert.equal(st.pos[st.winner], 63);
    assert.ok(JSON.stringify(st).length < 30000);
  }
  timeoutPlayout(G, 4, 3);
});
