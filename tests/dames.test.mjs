import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/dames.js";
import { start, apply } from "../js/engine.js";
import { playout } from "./harness.mjs";

const sq = (r, c) => r * 10 + c;
const empty = () => Array(100).fill(0);

test("position de départ : 20 pions chacun, 9 coups pour les blancs", () => {
  const b = G.initialBoard();
  assert.equal(b.filter((x) => x === 1).length, 20);
  assert.equal(b.filter((x) => x === 3).length, 20);
  assert.equal(G.legalMoves(b, 0).length, 9);
});

test("prise obligatoire, en arrière pour un pion, rafle maximale", () => {
  const b = empty();
  b[sq(5, 4)] = 1; b[sq(4, 5)] = 3; // prise vers l'avant possible
  b[sq(7, 2)] = 1;
  let ms = G.legalMoves(b, 0);
  assert.equal(ms.length, 1); assert.deepEqual(ms[0].caps, [sq(4, 5)]);
  const c = empty();
  c[sq(5, 4)] = 1; c[sq(6, 5)] = 3; // prise en arrière
  ms = G.legalMoves(c, 0);
  assert.equal(ms.length, 1); assert.equal(ms[0].path[0], sq(7, 6));
  // rafle : deux prises valent mieux qu'une
  const d = empty();
  d[sq(9, 0)] = 1; d[sq(8, 1)] = 3; d[sq(6, 3)] = 3;
  d[sq(9, 8)] = 1; d[sq(8, 7)] = 3;
  ms = G.legalMoves(d, 0);
  assert.equal(ms.length, 1); assert.equal(ms[0].caps.length, 2); assert.deepEqual(ms[0].path, [sq(7, 2), sq(5, 4)]);
});

test("dame volante : prise à distance, plusieurs cases d'arrivée", () => {
  const b = empty();
  b[sq(9, 0)] = 2; b[sq(5, 4)] = 3;
  const ms = G.legalMoves(b, 0);
  assert.equal(ms.length, 5); // atterrit en (4,5), (3,6), (2,7), (1,8), (0,9)
  assert.ok(ms.every((m) => m.caps[0] === sq(5, 4)));
  // une pièce prise ne se saute pas deux fois et bloque
  const c = empty();
  c[sq(4, 4)] = 2; c[sq(5, 5)] = 3; c[sq(3, 5)] = 3; c[sq(5, 3)] = 3; c[sq(3, 3)] = 3;
  const mc = G.legalMoves(c, 0);
  assert.ok(mc.length > 0);
  for (const m of mc) assert.equal(new Set(m.caps).size, m.caps.length);
});

test("promotion seulement en fin de coup", () => {
  const b = empty();
  b[sq(1, 2)] = 1;
  let nb = G.play(b, { from: sq(1, 2), path: [sq(0, 1)], caps: [] });
  assert.equal(nb[sq(0, 1)], 2);
  // passe par la dernière rangée en prenant puis repart : reste pion
  const c = empty();
  c[sq(2, 1)] = 1; c[sq(1, 2)] = 3; c[sq(1, 4)] = 3;
  const ms = G.legalMoves(c, 0);
  assert.equal(ms[0].caps.length, 2);
  nb = G.play(c, ms[0]);
  assert.equal(nb[ms[0].path[1]], 1);
});

test("coup illégal refusé, victoire quand l'autre ne peut plus jouer", () => {
  let s = start(G, [{ id: "a" }, { id: "b" }], {}, 3, 0);
  const w = s.order[0];
  assert.throws(() => apply(G, s, w, { type: "move", from: sq(6, 1), path: [sq(4, 3)] }), /impossible/);
  s.board = empty(); s.board[sq(5, 4)] = 1; s.board[sq(4, 5)] = 3;
  s = apply(G, s, w, { type: "move", from: sq(5, 4), path: [sq(3, 6)] });
  assert.equal(s.result.ranking.find((r) => r.id === w).rank, 1);
});

test("parties complètes robot contre robot", () => {
  for (let seed = 1; seed <= 12; seed++) playout(G, 2, seed, { settings: { level: 1 + (seed % 2) } });
});

// ---------------------------------------------------------------- options et modes
const optOf = (k) => G.options.find((o) => o.key === k);
const defaults = () => Object.fromEntries(G.options.map((o) => [o.key, o.def]));
const s8 = (r, c) => r * 8 + c;

test("options et modes bien formés", () => {
  assert.ok(G.options.length >= 2 && G.options.length <= 5);
  for (const o of G.options) {
    assert.ok(o.values.some((v) => v[0] === o.def), o.key);
    for (const v of o.values) { assert.ok(v[1].length <= 12); if (v[2]) assert.ok(v[2].length <= 18); }
    assert.ok(!["level", "turnTime"].includes(o.key));
  }
  assert.ok(G.modes.length >= 3 && G.modes.length <= 4);
  assert.equal(G.modes[0].name, "Classique");
  assert.deepEqual(G.modes[0].set, defaults());
  for (const m of G.modes) for (const [k, v] of Object.entries(m.set)) assert.ok(optOf(k).values.some((x) => x[0] === v), `${m.id}.${k}`);
});

test("damier 8 x 8 : 12 pions chacun, 7 coups au départ, valeurs invalides ignorées", () => {
  const s = start(G, [{ id: "a" }, { id: "b" }], { size: 8 }, 1, 0);
  assert.equal(s.board.length, 64);
  assert.equal(s.board.filter((x) => x === 1).length, 12);
  assert.equal(s.board.filter((x) => x === 3).length, 12);
  assert.equal(G.legalMoves(s.board, 0, G.rulesOf(s)).length, 7);
  const d = start(G, [{ id: "a" }, { id: "b" }], { size: 12, force: "peut-être", fly: 3 }, 1, 0);
  assert.equal(d.board.length, 100);
  assert.deepEqual([d.force, d.fly, d.back], [true, true, true]);
  // promotion sur la dernière rangée du petit damier
  const b = Array(64).fill(0); b[s8(6, 1)] = 3;
  assert.equal(G.play(b, { from: s8(6, 1), path: [s8(7, 0)], caps: [] })[s8(7, 0)], 4);
});

test("prise facultative : on peut jouer un autre coup, et prendre moins", () => {
  const rules = { force: false, fly: true, back: true };
  const b = empty();
  b[sq(5, 4)] = 1; b[sq(4, 5)] = 3; b[sq(7, 2)] = 1;
  const ms = G.legalMoves(b, 0, rules);
  assert.ok(ms.some((m) => m.caps.length === 1));
  assert.ok(ms.some((m) => m.from === sq(7, 2) && !m.caps.length));
  const d = empty();
  d[sq(9, 0)] = 1; d[sq(8, 1)] = 3; d[sq(6, 3)] = 3;
  d[sq(9, 8)] = 1; d[sq(8, 7)] = 3;
  const md = G.legalMoves(d, 0, rules);
  assert.ok(md.some((m) => m.caps.length === 1) && md.some((m) => m.caps.length === 2));
  // en partie : le coup sans prise est accepté
  let s = start(G, [{ id: "a" }, { id: "b" }], { force: false }, 3, 0);
  const w = s.order[0];
  s.board = b.slice();
  s = apply(G, s, w, { type: "move", from: sq(7, 2), path: [sq(6, 1)] });
  assert.equal(s.board[sq(6, 1)], 1);
  let t = start(G, [{ id: "a" }, { id: "b" }], {}, 3, 0);
  t.board = b.slice();
  assert.throws(() => apply(G, t, t.order[0], { type: "move", from: sq(7, 2), path: [sq(6, 1)] }), /obligatoire/);
});

test("dames non volantes : une case, prise au contact", () => {
  const rules = { force: true, fly: false, back: true };
  const b = empty();
  b[sq(9, 0)] = 2;
  assert.equal(G.legalMoves(b, 0, rules).length, 1);
  assert.equal(G.legalMoves(b, 0).length, 9);
  const c = empty();
  c[sq(9, 0)] = 2; c[sq(5, 4)] = 3;
  assert.equal(G.legalMoves(c, 0, rules).filter((m) => m.caps.length).length, 0, "pas de prise à distance");
  c[sq(9, 0)] = 0; c[sq(6, 3)] = 2;
  const mc = G.legalMoves(c, 0, rules);
  assert.equal(mc.length, 1); assert.deepEqual(mc[0].path, [sq(4, 5)]);
});

test("pions sans prise en arrière", () => {
  const c = empty();
  c[sq(5, 4)] = 1; c[sq(6, 5)] = 3;
  assert.equal(G.legalMoves(c, 0).filter((m) => m.caps.length).length, 1);
  const ms = G.legalMoves(c, 0, { force: true, fly: true, back: false });
  assert.ok(ms.every((m) => !m.caps.length));
});

test("le robot prend la pièce offerte avec toutes les règles", () => {
  for (const m of G.modes) {
    const n = m.set.size, at = (r, c) => r * n + c;
    let s = start(G, [{ id: "a" }, { id: "b" }], { ...m.set, level: 2 }, 1, 0);
    s.board = Array(n * n).fill(0);
    s.board[at(n - 1, 0)] = 1; s.board[at(n - 2, 1)] = 1; s.board[at(n - 3, 2)] = 3; s.board[at(0, 1)] = 3; s.board[at(0, 3)] = 3;
    const a = G.bot(s, s.order[0], { next: () => 0.5, int: () => 0, pick: (l) => l[0] });
    assert.deepEqual(a.path, [at(n - 4, 3)], m.id);
  }
});

test("parties complètes pour chaque mode", () => {
  for (const m of G.modes) for (let seed = 1; seed <= 3; seed++) playout(G, 2, seed, { settings: { ...m.set, level: 1 + (seed % 2) } });
  for (const m of G.modes) playout(G, 2, 7, { settings: { ...m.set, level: 3 } });
});
