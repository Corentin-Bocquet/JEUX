import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/solitaire.js";
import { start, apply } from "../js/engine.js";
import { playout, timeoutPlayout } from "./harness.mjs";

const P2 = [{ id: "a" }, { id: "b" }];
const T0 = 1_000_000;
const act = (s, pid, a, dt = 1000) => apply(G, s, pid, { seed: 1, now: T0 + dt, ...a });

test("même donne pour tous, état compact", () => {
  const s = start(G, Array.from({ length: 8 }, (_, i) => ({ id: "p" + i })), {}, 42, T0);
  const ref = JSON.stringify(s.p.p0.t);
  for (const id of s.ids) assert.equal(JSON.stringify(s.p[id].t), ref);
  assert.deepEqual(s.p.p0.t.map((c) => c.length), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(s.p.p0.d, [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(s.p.p0.st.length, 24);
  assert.equal(new Set([...s.p.p0.t.flat(), ...s.p.p0.st]).size, 52);
  assert.ok(JSON.stringify(s).length < 30000);
});

// tapis fabriqué à la main
function board(settings = {}) {
  const s = start(G, P2, settings, 1, T0);
  const P = s.p.a;
  P.t = [["KS"], ["5D", "8C"], ["7H"], [], ["AH"], ["2C", "QD"], ["9S"]];
  P.d = [0, 1, 0, 0, 0, 1, 0];
  P.st = ["3S", "4S", "5S", "6S"]; P.w = []; P.f = [0, 0, 0, 1];
  return s;
}

test("coups légaux, illégaux et points", () => {
  let s = board();
  assert.throws(() => act(s, "a", { type: "move", from: "t2", n: 1, to: "t6" }), /ne va pas/, "même couleur interdite");
  assert.throws(() => act(s, "a", { type: "move", from: "t1", n: 2, to: "t2" }), /Rien/, "carte cachée");
  assert.throws(() => act(s, "a", { type: "move", from: "t2", n: 1, to: "t3" }), /ne va pas/, "seul un Roi sur une colonne vide");
  assert.throws(() => act(s, "a", { type: "move", from: "t6", n: 1, to: "f" }), /fondation/);
  s = act(s, "a", { type: "move", from: "t2", n: 1, to: "t1" });
  assert.deepEqual(s.p.a.t[1], ["5D", "8C", "7H"]);
  assert.equal(s.p.a.score, 0);
  s = act(s, "a", { type: "move", from: "t4", n: 1, to: "f" });
  assert.equal(s.p.a.f[1], 1); assert.equal(s.p.a.score, 10);
  // déplacer 8C+7H découvre 5D : +5
  s.p.a.t[6] = ["9H"];
  s = act(s, "a", { type: "move", from: "t1", n: 2, to: "t6" });
  assert.equal(s.p.a.d[1], 0); assert.equal(s.p.a.score, 15);
  s = act(s, "a", { type: "move", from: "t0", n: 1, to: "t3" }, 2000);
  assert.equal(s.p.a.t[3][0], "KS");
  // la pioche : une carte à la fois, puis on la remet (-20)
  s = act(s, "a", { type: "draw" });
  assert.deepEqual(s.p.a.w, ["6S"]);
  for (let k = 0; k < 3; k++) s = act(s, "a", { type: "draw" });
  assert.equal(s.p.a.st.length, 0);
  s = act(s, "a", { type: "draw" });
  assert.equal(s.p.a.rec, 1); assert.equal(s.p.a.score, 0);
  assert.equal(s.p.a.st.at(-1), "6S", "même ordre après remise");
  // reprendre une carte de fondation coûte 15
  s.p.a.score = 50; s.p.a.t[2] = ["3S"]; s.p.a.f[1] = 2;
  s = act(s, "a", { type: "move", from: "f1", n: 1, to: "t2" });
  assert.equal(s.p.a.score, 35); assert.equal(s.p.a.f[1], 1);
  assert.equal(s.p.b.score, 0, "le tapis de b n'a pas bougé");
});

test("3 cartes et passages limités", () => {
  let s = board({ draw: 3, passes: 1 });
  s = act(s, "a", { type: "draw" });
  assert.deepEqual(s.p.a.w, ["6S", "5S", "4S"]);
  s = act(s, "a", { type: "draw" });
  assert.equal(s.p.a.st.length, 0);
  assert.throws(() => act(s, "a", { type: "draw" }), /passage/);
  let t = board({ passes: 3 });
  for (let r = 0; r < 2; r++) { for (let k = 0; k < 4; k++) t = act(t, "a", { type: "draw" }); t = act(t, "a", { type: "draw" }); }
  assert.equal(t.p.a.rec, 2);
  for (let k = 0; k < 4; k++) t = act(t, "a", { type: "draw" });
  assert.ok(!G.canRecycle(t, t.p.a));
});

test("coup auto, victoire et bonus de temps", () => {
  let s = board();
  const P = s.p.a;
  P.f = [13, 13, 13, 11]; P.t = [["QC"], [], [], [], [], [], []]; P.d = [0, 0, 0, 0, 0, 0, 0]; P.st = []; P.w = ["KC"];
  P.score = 500;
  const nb = board(); nb.p.a.t[4] = ["4H"];
  assert.throws(() => act(nb, "a", { type: "auto" }), /Aucune/);
  s = act(s, "a", { type: "auto" }, 100000);
  assert.ok(s.result);
  assert.equal(s.p.a.status, "won");
  assert.equal(s.p.a.time, 100000);
  assert.equal(s.p.a.bonus, 7000);
  assert.equal(s.result.ranking[0].id, "a");
  assert.equal(s.result.ranking[0].score, 520 + 7000);
});

test("bloqué, abandon et temps limite", () => {
  let s = board({ passes: 1 });
  s = act(s, "a", { type: "giveup" });
  assert.equal(s.p.a.status, "out");
  assert.deepEqual(G.toAct(s), ["b"]);
  assert.throws(() => act(s, "a", { type: "draw" }), /fini/);
  s = act(s, "b", { type: "giveup", stuck: true });
  assert.ok(s.result, "plus personne en jeu");
  // temps limite : n'importe quelle action après l'échéance termine la partie
  let t = start(G, P2, { limit: 5 }, 3, T0);
  t = act(t, "a", { type: "tick" }, 60000);
  assert.ok(!t.result);
  t = act(t, "b", { type: "tick" }, 5 * 60000);
  assert.ok(t.result); assert.equal(t.endBy, "time");
  // aucun coup possible : bloqué automatiquement
  let u = board({ passes: 1 });
  const Q = u.p.a;
  Q.t = [["2H"], ["2D"], [], [], [], [], []]; Q.d = [0, 0, 0, 0, 0, 0, 0]; Q.st = ["9C"]; Q.w = []; Q.f = [0, 0, 0, 0];
  u = act(u, "a", { type: "draw" });
  assert.equal(u.p.a.status, "stuck");
});

test("classement aux cartes rangées", () => {
  let s = board({ scoring: "cards" });
  s.p.b.f = [3, 0, 0, 0];
  s = act(s, "a", { type: "giveup" });
  s = act(s, "b", { type: "giveup" });
  assert.deepEqual(s.result.ranking.map((r) => [r.id, r.score]), [["b", 3], ["a", 1]]);
});

test("le robot joue proprement", () => {
  const s = board();
  const a = G.bot(s, "a", { next: () => 0.5 });
  assert.deepEqual(a, { type: "move", from: "t4", n: 1, to: "f" });
  assert.equal(G.bot(s, "zz", { next: () => 0.5 }), null);
  const d = G.botDelay(s, "a", { next: () => 0.5 });
  assert.ok(d >= 800 && d <= 4000, "vitesse humaine");
});

test("parties complètes avec robots et délais", () => {
  let won = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const { st } = playout(G, 1 + (seed % 8), seed, { settings: { level: 1 + (seed % 3) }, onStep(x) {
      for (const id of x.ids) { const P = x.p[id]; assert.equal(P.t.flat().length + P.st.length + P.w.length + G.fCount(P), 52); }
    } });
    if (st.endBy === "won") won++;
  }
  assert.ok(won >= 1, "les robots gagnent parfois");
  timeoutPlayout(G, 3, 5, { turnTime: 20 });
});

function checkShape(G) {
  const keys = G.options.map((o) => o.key);
  assert.ok(keys.length >= 2 && keys.length <= 5);
  assert.ok(!keys.includes("level") && !keys.includes("turnTime") && !keys.includes("mode"));
  for (const o of G.options) {
    assert.ok(o.values.some((v) => v[0] === o.def));
    for (const v of o.values) { assert.ok(v[1].length <= 12, v[1]); assert.ok(v[2] == null || v[2].length <= 18, v[2]); }
  }
  assert.ok(G.modes.length >= 3 && G.modes.length <= 4);
  assert.equal(G.modes[0].name, "Classique");
  assert.deepEqual(G.modes[0].set, Object.fromEntries(G.options.map((o) => [o.key, o.def])));
  assert.equal(new Set(G.modes.map((m) => JSON.stringify(m.set))).size, G.modes.length);
  for (const m of G.modes) for (const [k, v] of Object.entries(m.set)) assert.ok(G.options.find((o) => o.key === k).values.some((x) => x[0] === v));
  assert.ok(!JSON.stringify([G.options, G.modes, G.meta]).includes(String.fromCharCode(0x2014)));
}
test("options et modes bien formés", () => {
  checkShape(G);
  const s = start(G, P2, { draw: 2, passes: "z", limit: 99, scoring: 1 }, 1, T0);
  assert.deepEqual([s.draw, s.passes, s.limit, s.scoring], [1, 0, 10, "pts"]);
});

test("chaque mode se joue jusqu'au bout, 1 et 8 joueurs", () => {
  G.modes.forEach((m, k) => { for (const n of [1, 8]) playout(G, n, 50 + k * 7 + n, { settings: m.set }); });
});
