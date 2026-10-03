import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/puissance4.js";
import { start, apply } from "../js/engine.js";
import { playout, timeoutPlayout } from "./harness.mjs";

const P = [{ id: "a", name: "A" }, { id: "b", name: "B" }];

test("victoire verticale et refus des coups illégaux", () => {
  let s = start(G, P, {}, 1, 0);
  const [x, y] = s.order;
  assert.throws(() => apply(G, s, y, { type: "drop", col: 0 }), /tour/);
  for (let i = 0; i < 3; i++) {
    s = apply(G, s, x, { type: "drop", col: 0 });
    s = apply(G, s, y, { type: "drop", col: 1 });
  }
  s = apply(G, s, x, { type: "drop", col: 0 });
  assert.equal(s.result.ranking.find((r) => r.id === x).rank, 1);
  assert.equal(s.result.ranking.find((r) => r.id === y).rank, 2);
  assert.throws(() => apply(G, s, y, { type: "drop", col: 3 }), /terminée/);
});

test("colonne pleine refusée, diagonale détectée", () => {
  let s = start(G, P, {}, 2, 0);
  const [x, y] = s.order;
  for (let i = 0; i < 6; i++) s = apply(G, s, i % 2 ? y : x, { type: "drop", col: 6 });
  assert.throws(() => apply(G, s, x, { type: "drop", col: 6 }), /pleine/);
  const b = Array(42).fill(0);
  [[0, 5], [1, 4], [2, 3], [3, 2]].forEach(([c, r]) => (b[r * 7 + c] = 1));
  assert.equal(G.findWin(b).cells.length, 4);
});

test("le robot difficile bloque une victoire immédiate", () => {
  let s = start(G, P, { level: 3 }, 3, 0);
  const [x, y] = s.order;
  s = apply(G, s, x, { type: "drop", col: 0 });
  s = apply(G, s, y, { type: "drop", col: 6 });
  s = apply(G, s, x, { type: "drop", col: 1 });
  s = apply(G, s, y, { type: "drop", col: 6 });
  s = apply(G, s, x, { type: "drop", col: 2 });
  const a = G.bot(s, y, { next: () => 0.9, int: () => 0, pick: (l) => l[0] });
  assert.equal(a.col, 3);
});

test("parties complètes robot contre robot", () => {
  for (let seed = 1; seed <= 24; seed++) playout(G, 2, seed, { settings: { level: (seed % 2) + 1 } });
  for (let seed = 1; seed <= 3; seed++) playout(G, 2, seed, { settings: { level: 3 } });
  timeoutPlayout(G, 2, 9);
});

// ---------------------------------------------------------------- options et modes
const optOf = (k) => G.options.find((o) => o.key === k);
const defaults = () => Object.fromEntries(G.options.map((o) => [o.key, o.def]));

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

test("tailles de grille et valeurs invalides", () => {
  const n = (settings) => { const s = start(G, P, settings, 1, 0); return [s.w, s.h, s.board.length, s.k, s.wins]; };
  assert.deepEqual(n({}), [7, 6, 42, 4, 1]);
  assert.deepEqual(n({ grid: "8x7" }), [8, 7, 56, 4, 1]);
  assert.deepEqual(n({ grid: "9x7", connect: 5, wins: 3 }), [9, 7, 63, 5, 3]);
  assert.deepEqual(n({ grid: "12x2", connect: 9, wins: "x" }), [7, 6, 42, 4, 1]);
  // colonne 8 jouable seulement sur grande grille
  let s = start(G, P, { grid: "9x7" }, 1, 0);
  s = apply(G, s, s.order[0], { type: "drop", col: 8 });
  assert.equal(s.board[6 * 9 + 8], 1);
  assert.throws(() => apply(G, start(G, P, {}, 1, 0), "a", { type: "drop", col: 8 }), /invalide|tour/);
});

test("puissance 5 : 4 alignés ne suffisent plus", () => {
  let s = start(G, P, { connect: 5 }, 1, 0);
  const [x, y] = s.order;
  for (let i = 0; i < 4; i++) {
    s = apply(G, s, x, { type: "drop", col: i });
    s = apply(G, s, y, { type: "drop", col: i });
  }
  assert.equal(s.result, undefined);
  assert.ok(!s.win);
  s = apply(G, s, x, { type: "drop", col: 4 });
  assert.equal(s.win.cells.length, 5);
  assert.equal(s.result.ranking.find((r) => r.id === x).rank, 1);
});

test("match en plusieurs manches : score, alternance, manche suivante", () => {
  let s = start(G, P, { wins: 2 }, 1, 0);
  const [x, y] = s.order;
  const winRound = (st, a, b) => {
    for (let i = 0; i < 3; i++) { st = apply(G, st, a, { type: "drop", col: 0 }); st = apply(G, st, b, { type: "drop", col: 1 }); }
    return apply(G, st, a, { type: "drop", col: 0 });
  };
  s = winRound(s, x, y);
  assert.equal(s.score[x], 1);
  assert.ok(!s.result, "le match continue");
  assert.deepEqual(G.toAct(s), [y], "l'autre lance et commence la manche 2");
  assert.throws(() => apply(G, s, y, { type: "drop", col: 2 }), /suivante/);
  assert.deepEqual(G.bot(s, y, { next: () => 0, pick: (l) => l[0] }), { type: "next" });
  s = apply(G, s, y, { type: "next" });
  assert.equal(s.game, 2);
  assert.ok(s.board.every((v) => !v));
  assert.deepEqual(G.toAct(s), [y]);
  s = winRound(s, y, x);
  assert.equal(s.score[y], 1);
  s = apply(G, s, x, { type: "next" });
  s = winRound(s, x, y);
  assert.equal(s.score[x], 2);
  assert.equal(s.result.ranking.find((r) => r.id === x).rank, 1);
  assert.equal(s.result.ranking.find((r) => r.id === y).rank, 2);
});

test("le robot fort bloque aussi en puissance 5 sur grille géante", () => {
  let s = start(G, P, { grid: "9x7", connect: 5, level: 3 }, 3, 0);
  const [x, y] = s.order;
  for (const [a, c] of [[x, 1], [y, 0], [x, 2], [y, 8], [x, 3], [y, 8], [x, 4]]) s = apply(G, s, a, { type: "drop", col: c });
  const a = G.bot(s, y, { next: () => 0.9, int: () => 0, pick: (l) => l[0] });
  assert.equal(a.col, 5);
});

test("parties complètes pour chaque mode", () => {
  for (const m of G.modes) for (let seed = 1; seed <= 3; seed++) {
    const { st } = playout(G, 2, seed, { settings: { ...m.set, level: 1 + (seed % 3) } });
    if (m.set.wins > 1) assert.ok(st.game >= m.set.wins);
  }
  timeoutPlayout(G, 2, 5, { ...G.modes[1].set, turnTime: 10 });
});
