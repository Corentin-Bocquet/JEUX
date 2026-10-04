import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/morpion.js";
import { start, apply, rng } from "../js/engine.js";
import { playout, timeoutPlayout } from "./harness.mjs";

const P = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
const put = (s, ...cells) => { for (const c of cells) s = apply(G, s, G.toAct(s)[0], { type: "play", cell: c }); return s; };

test("options et modes bien formés", () => {
  assert.ok(G.options.length >= 2 && G.options.length <= 5);
  for (const o of G.options) {
    assert.ok(o.label.length <= 12, o.label);
    assert.ok(!["level", "turnTime", "mode"].includes(o.key));
    assert.ok(o.values.some((v) => v[0] === o.def));
    for (const v of o.values) assert.ok(!v[2] || v[2].length <= 18, v[2]);
  }
  assert.ok(G.modes.length >= 3 && G.modes.length <= 4);
  assert.equal(G.modes[0].name, "Classique");
  for (const o of G.options) assert.equal(G.modes[0].set[o.key], o.def);
  assert.equal(new Set(G.modes.map((m) => JSON.stringify(G.options.map((o) => m.set[o.key])))).size, G.modes.length);
  const s = start(G, P, { size: 9, align: "x", wins: 0, fade: 1, level: 7 }, 1, 0);
  assert.deepEqual([s.n, s.k, s.wins, s.fade, s.level], [3, 3, 1, false, 2]);
  // aligner 4 sur 3 x 3 : ramené à 3
  assert.equal(start(G, P, { size: 3, align: 4 }, 1, 0).k, 3);
  assert.ok(G.meta.rules.every((r) => !r.includes("\u2014")));
});

test("règles : tour, case prise, victoire, nulle", () => {
  let s = start(G, P, {}, 1, 0);
  const [x, o] = s.order;
  assert.throws(() => apply(G, s, o, { type: "play", cell: 0 }), /tour/);
  assert.throws(() => apply(G, s, x, { type: "play", cell: 9 }), /invalide/);
  s = put(s, 4);
  assert.throws(() => apply(G, s, o, { type: "play", cell: 4 }), /prise/);
  s = put(s, 0, 3, 1, 5);
  assert.deepEqual(s.win, { id: x, cells: [3, 4, 5] });
  assert.equal(s.result.ranking[0].id, x);
  assert.equal(s.result.ranking[1].rank, 2);
  // nulle
  s = put(start(G, P, {}, 1, 0), 0, 1, 2, 4, 3, 5, 7, 6, 8);
  assert.ok(s.full && !s.win);
  assert.ok(s.result.ranking.every((r) => r.rank === 1));
});

test("grande grille : 4 à aligner sur 5 x 5", () => {
  let s = start(G, P, { size: 5, align: 4 }, 1, 0);
  s = put(s, 0, 5, 1, 6, 2, 7);
  assert.ok(!s.win, "3 alignés ne suffisent pas");
  s = put(s, 3);
  assert.deepEqual(s.win.cells, [0, 1, 2, 3]);
});

test("effacement : le plus ancien pion disparaît", () => {
  let s = start(G, P, { fade: true }, 1, 0);
  s = put(s, 0, 4, 1, 5, 8, 6); // x : 0 1 8, o : 4 5 6
  s = put(s, 3); // x pose un 4e pion : 0 disparaît
  assert.equal(s.board[0], 0);
  assert.equal(s.gone, 0);
  assert.equal(s.board.filter((v) => v === 1).length, 3);
  assert.ok(!s.win);
  // une manche sans fin est bornée
  s = start(G, P, { fade: true }, 1, 0);
  for (let i = 0; i < G.FADE_CAP && !s.full && !s.win; i++) s = apply(G, s, G.toAct(s)[0], G.bot(s, G.toAct(s)[0], rng(i)));
  assert.ok(s.full || s.win);
});

test("match : score, alternance, manche suivante", () => {
  let s = start(G, P, { wins: 2 }, 1, 0);
  const [x, o] = s.order;
  s = put(s, 0, 3, 1, 4, 2);
  assert.equal(s.score[x], 1);
  assert.ok(!s.result);
  assert.deepEqual(G.toAct(s), [o]);
  assert.throws(() => apply(G, s, o, { type: "play", cell: 5 }), /suivante/);
  assert.deepEqual(G.bot(s, o, rng(1)), { type: "next" });
  s = apply(G, s, o, { type: "next" });
  assert.equal(s.game, 2);
  assert.ok(s.board.every((v) => !v));
  assert.deepEqual(G.toAct(s), [o]);
  s = put(s, 0, 3, 1, 4, 2); // o gagne
  assert.equal(s.score[o], 1);
  s = apply(G, s, x, { type: "next" });
  s = put(s, 0, 3, 1, 4, 2);
  assert.equal(s.score[x], 2);
  assert.equal(s.result.ranking[0].id, x);
  assert.equal(s.result.ranking[0].score, 2);
});

test("robot niveau 3 imbattable en 3 x 3 (toutes les parties possibles)", () => {
  let games = 0;
  // explore tous les coups de l'adversaire et plusieurs choix du robot
  function explore(s, botId, depth) {
    if (G.roundOver(s)) {
      games++;
      assert.ok(!s.win || s.win.id === botId, "le robot ne doit jamais perdre");
      return;
    }
    const pid = G.toAct(s)[0];
    if (pid === botId) {
      const seen = new Set();
      for (let k = 0; k < 3; k++) {
        const a = G.bot(s, pid, rng(depth * 31 + k + 1));
        if (seen.has(a.cell)) continue;
        seen.add(a.cell);
        explore(apply(G, s, pid, a), botId, depth + 1);
      }
    } else {
      for (let i = 0; i < 9; i++) if (!s.board[i]) explore(apply(G, s, pid, { type: "play", cell: i }), botId, depth + 1);
    }
  }
  for (const seed of [1, 2]) {
    const s = start(G, P, { level: 3 }, seed, 0);
    explore(s, s.order[0], 0);
    explore(s, s.order[1], 0);
  }
  assert.ok(games > 1000);
});

test("robots : gagnent et bloquent, rapides sur 5 x 5", () => {
  let s = start(G, P, { level: 2 }, 1, 0);
  s = put(s, 0, 4, 1); // x menace 2
  assert.equal(G.bot(s, G.toAct(s)[0], rng(3)).cell, 2, "bloque");
  let t = put(start(G, P, { level: 2 }, 1, 0), 0, 3, 1, 4);
  assert.equal(G.bot(t, G.toAct(t)[0], rng(1)).cell, 2, "gagne");
  t = start(G, P, { size: 5, align: 4, level: 3 }, 1, 0);
  const r = rng(5);
  while (!G.roundOver(t)) {
    const pid = G.toAct(t)[0];
    const seed = r.int(1e9);
    let a, best = Infinity;
    for (let k = 0; k < 3; k++) { const t0 = performance.now(); a = G.bot(t, pid, rng(seed)); best = Math.min(best, performance.now() - t0); }
    assert.ok(best < 400, `${best.toFixed(0)} ms`);
    t = apply(G, t, pid, a);
  }
});

test("parties complètes pour chaque mode", () => {
  for (const m of G.modes) for (let seed = 1; seed <= 3; seed++) {
    const { st } = playout(G, 2, seed, { settings: { ...m.set, level: 1 + (seed % 3) } });
    if (m.set.wins > 1) assert.ok(st.game >= m.set.wins);
  }
  playout(G, 2, 4, { settings: { size: 4, align: 3, level: 3 } });
  playout(G, 2, 4, { settings: { size: 4, align: 4, fade: true, level: 2 } });
  timeoutPlayout(G, 2, 5, { ...G.modes[1].set, turnTime: 10 });
});
