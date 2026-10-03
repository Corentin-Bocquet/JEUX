import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/bowling.js";
import { start, apply } from "../js/engine.js";
import { playout, timeoutPlayout } from "./harness.mjs";

test("calcul des scores", () => {
  const f = (r) => G.frameScores(r, 10);
  assert.equal(f(Array(12).fill(10))[9], 300);
  assert.equal(f(Array(21).fill(5))[9], 150);
  assert.equal(f(Array(20).fill(0))[9], 0);
  assert.deepEqual(f([10, 3, 4]).slice(0, 2), [17, 24]);
  assert.deepEqual(f([7, 3, 4, 2]).slice(0, 2), [14, 20]);
  assert.equal(f([10, 3])[0], null);
  // 10e frame : spare puis bonus
  assert.equal(f([...Array(18).fill(0), 7, 3, 5])[9], 15);
  assert.equal(f([...Array(18).fill(0), 3, 4])[9], 7);
  assert.equal(G.frameScores([10, 10, 10, 10, 10, 10, 10], 5)[4], 150);
});

test("simulation déterministe et cohérente", () => {
  const all = Array(10).fill(true);
  const a = G.simulate({ x: 0.1, vx: -0.05, vy: 9, spin: -0.3 }, all, true);
  const b = G.simulate({ x: 0.1, vx: -0.05, vy: 9, spin: -0.3 }, all, true);
  assert.deepEqual(a.down, b.down);
  assert.deepEqual(a.frames, b.frames);
  // boule dans la rigole : rien ne tombe
  assert.equal(G.simulate({ x: 0.4, vx: 0.6, vy: 8, spin: 1 }, all).down.length, 0);
  // une quille déjà tombée ne compte pas
  const some = all.map((v, i) => i !== 0);
  assert.ok(!G.simulate({ x: 0, vx: 0, vy: 9, spin: 0 }, some).down.includes(0));
  // un bon lancer dans l'axe fait tomber des quilles
  assert.ok(G.simulate({ x: 0.0, vx: 0, vy: 9, spin: 0 }, all).down.length >= 5);
  // il existe des strikes
  let strikes = 0;
  for (let k = 0; k < 60; k++) {
    const x = -0.3 + k * 0.01;
    if (G.simulate({ x, vx: (0.06 - x) / 16 * 9, vy: 9, spin: 0 }, all).down.length === 10) strikes++;
  }
  assert.ok(strikes > 0, "aucun strike possible");
});

test("enchaînement des lancers et 10e frame", () => {
  let s = start(G, [{ id: "a" }, { id: "b" }], { frames: 5 }, 1, 0);
  const gutter = { type: "throw", x: 0.4, vx: 0.6, vy: 8, spin: 1 };
  s = apply(G, s, "a", gutter);
  assert.equal(G.toAct(s)[0], "a"); assert.equal(s.ball, 1);
  s = apply(G, s, "a", gutter);
  assert.equal(G.toAct(s)[0], "b");
  assert.throws(() => apply(G, s, "a", gutter), /tour/);
  // dernière frame avec 3 lancers si strike
  s.frame = 4; s.cur = 0; s.ball = 0;
  s.rolls.a = [0, 0, 0, 0, 0, 0, 0, 0];
  s.standing = Array(10).fill(true);
  s.standing = s.standing.map(() => true);
  // on force un strike en vidant les quilles sauf une puis en la touchant : on simule simplement les règles
  s = apply(G, s, "a", { type: "throw", x: 0, vx: 0, vy: 9, spin: 0 });
  assert.equal(s.ball, 1);
});

test("parties complètes avec robots", () => {
  let best = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const { st } = playout(G, 1 + (seed % 4), seed, { settings: { frames: seed % 2 ? 5 : 10, level: 1 + (seed % 3) } });
    for (const id of st.order) {
      const nb = st.rolls[id].length;
      assert.ok(nb >= (st.n === 5 ? 5 : 10) + 1 && nb <= (st.n === 5 ? 11 : 21), "nombre de lancers " + nb);
      best = Math.max(best, G.totalScore(st.rolls[id], st.n));
    }
  }
  assert.ok(best > 40, "les robots savent jouer : " + best);
  timeoutPlayout(G, 2, 3, { turnTime: 10, frames: 5 });
});

test("options et modes bien formés", () => {
  const keys = G.options.map((o) => o.key);
  assert.ok(G.options.length >= 2 && G.options.length <= 5);
  for (const o of G.options) {
    assert.ok(o.values.some((v) => v[0] === o.def), o.key + " : défaut dans les valeurs");
    for (const v of o.values) { assert.ok(v[1].length <= 12, v[1]); if (v[2]) assert.ok(v[2].length <= 18, v[2]); }
  }
  assert.ok(!keys.includes("level") && !keys.includes("turnTime"));
  assert.ok(G.modes.length >= 3 && G.modes.length <= 4);
  for (const m of G.modes) for (const k of Object.keys(m.set)) assert.ok(keys.includes(k), m.id + " : " + k);
  assert.equal(G.modes[0].name, "Classique");
  assert.deepEqual(G.modes[0].set, Object.fromEntries(G.options.map((o) => [o.key, o.def])));
  // valeurs absentes ou invalides : défaut
  const s = start(G, [{ id: "a" }], { frames: 7, bumpers: "peut-être", wind: 9, oil: "glace" }, 1, 0);
  assert.equal(s.n, 10); assert.equal(s.bump, false); assert.equal(s.wind, 0); assert.equal(s.oil, 1);
});

test("chaque mode se joue jusqu'au bout", () => {
  for (const m of G.modes) for (const n of [1, 6]) {
    const { st } = playout(G, n, 11 + n, { settings: m.set });
    assert.equal(st.n, m.set.frames);
  }
});

test("effet concret des options", () => {
  const all = Array(10).fill(true);
  const gutter = { x: 0.4, vx: 0.6, vy: 8, spin: 1 };
  // bumpers : plus de rigole, la boule revient sur la piste
  assert.equal(G.simulate(gutter, all).down.length, 0);
  const rec = G.simulate(gutter, all, true, { bump: true });
  assert.ok(rec.frames.every((f) => !f.b[2]), "jamais dans la rigole avec les bumpers");
  // vent : la boule dévie dans le sens du vent
  const straight = { x: 0, vx: 0, vy: 8, spin: 0 };
  const endX = (env) => { const f = G.simulate(straight, all, true, env).frames; return f.find((q) => q.b[1] > 10).b[0]; };
  assert.ok(endX({ wind: 0.25 }) > endX({}) + 0.05);
  assert.ok(endX({ wind: -0.25 }) < endX({}) - 0.05);
  // piste sèche : plus d'effet, piste huilée : moins
  const hook = { x: 0, vx: 0, vy: 8, spin: 0.8 };
  const hx = (oil) => G.simulate(hook, all, true, { oil }).frames.find((q) => q.b[1] > 15).b[0];
  assert.ok(hx(G.OIL.seche) > hx(1) && hx(1) > hx(G.OIL.huilee));
  // le vent change à chaque lancer et reste dans les bornes
  let s = start(G, [{ id: "a" }], { wind: 2, frames: 3 }, 4, 0);
  const seen = new Set();
  while (!s.result) {
    assert.ok(Math.abs(s.wind) >= 0.16 && Math.abs(s.wind) <= 0.32, "vent " + s.wind);
    seen.add(s.wind);
    s = apply(G, s, "a", { type: "throw", x: 0, vx: 0, vy: 9, spin: 0, seed: seen.size * 31 + 7 });
    assert.equal(typeof s.last.env.wind, "number");
  }
  assert.ok(seen.size > 1);
  // 3 frames : partie courte
  const { st } = playout(G, 2, 5, { settings: { frames: 3 } });
  for (const id of st.order) assert.ok(st.rolls[id].length >= 3 + 1 && st.rolls[id].length <= 7);
});
