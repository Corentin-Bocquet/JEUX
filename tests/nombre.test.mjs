import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/nombre.js";
import { start, apply, rng } from "../js/engine.js";
import { playout, timeoutPlayout } from "./harness.mjs";

const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "J" + i }));

test("essais permis et intervalle déduit", () => {
  assert.equal(G.perfect(100), 7);
  assert.equal(G.perfect(1000), 10);
  const s = start(G, mk(1), {}, 1, 0);
  assert.equal(G.limitOf(s), 12);
  assert.equal(G.limitOf({ ...s, tries: "juste" }), 7);
  s.secret = 42;
  assert.deepEqual(G.rangeOf(s, []), [1, 100]);
  assert.deepEqual(G.rangeOf(s, [50, 20, 45, 41]), [42, 44]);
  assert.equal(G.hint(s, 10), 1);
  assert.equal(G.hint(s, 90), -1);
  assert.equal(G.hint(s, 42), 0);
});

test("course : coups illégaux, trouvé, score en essais, manche suivante", () => {
  let s = start(G, mk(2), { rounds: 3 }, 5, 0);
  s.secret = 30;
  assert.throws(() => apply(G, s, "p0", { type: "guess", n: 0 }), /entre 1 et 100/);
  assert.throws(() => apply(G, s, "p0", { type: "guess", n: 101 }), /entre 1 et 100/);
  assert.throws(() => apply(G, s, "p0", { type: "guess", n: 2.5 }), /entier/);
  s = apply(G, s, "p0", { type: "guess", n: 50 });
  assert.throws(() => apply(G, s, "p0", { type: "guess", n: 50 }), /déjà/);
  s = apply(G, s, "p0", { type: "guess", n: 30 });
  assert.equal(s.status.p0, "found");
  assert.equal(s.scores.p0, 2);
  assert.deepEqual(G.toAct(s), ["p1"]);
  assert.throws(() => apply(G, s, "p0", { type: "guess", n: 31 }), /prochaine manche/);
  s = apply(G, s, "p1", { type: "giveup" });
  assert.equal(s.scores.p1, 12 + G.PENALTY);
  assert.equal(s.roundNo, 2);
  assert.equal(s.history[0].n, 30);
  assert.deepEqual(G.toAct(s).sort(), ["p0", "p1"]);
  assert.ok(s.secret >= 1 && s.secret <= 100);
});

test("course : trop d'essais = pénalité", () => {
  let s = start(G, mk(1), { tries: "juste", rounds: 3 }, 2, 0);
  s.secret = 100;
  for (let i = 1; i <= 7; i++) s = apply(G, s, "p0", { type: "guess", n: i });
  assert.equal(s.scores.p0, 7 + G.PENALTY);
  assert.equal(s.roundNo, 2);
});

test("le moins d'essais gagne au classement final", () => {
  let s = start(G, mk(2), { rounds: 3 }, 9, 0);
  for (let r = 0; r < 3; r++) {
    const x = s.secret;
    s = apply(G, s, "p0", { type: "guess", n: x });
    s = apply(G, s, "p1", { type: "guess", n: x === 1 ? 2 : 1 });
    s = apply(G, s, "p1", { type: "guess", n: x });
  }
  assert.deepEqual(s.result.ranking, [{ id: "p0", rank: 1, score: 3 }, { id: "p1", rank: 2, score: 6 }]);
});

test("chacun son tour : nombre commun, alternance, le trouveur gagne la manche", () => {
  let s = start(G, mk(3), { play: "tour", rounds: 3 }, 4, 0);
  assert.deepEqual(G.toAct(s), ["p0"]);
  s.secret = 77;
  assert.throws(() => apply(G, s, "p1", { type: "guess", n: 50 }), /tour/);
  assert.throws(() => apply(G, s, "p0", { type: "giveup" }), /Impossible/);
  s = apply(G, s, "p0", { type: "guess", n: 50 });
  assert.deepEqual(G.toAct(s), ["p1"]);
  assert.throws(() => apply(G, s, "p1", { type: "guess", n: 50 }), /déjà/);
  s = apply(G, s, "p1", { type: "guess", n: 80 });
  assert.deepEqual(G.rangeOf(s, s.shared.map((x) => x.g)), [51, 79]);
  s = apply(G, s, "p2", { type: "guess", n: 77 });
  assert.equal(s.scores.p2, 1);
  assert.equal(s.roundNo, 2);
  assert.deepEqual(G.toAct(s), ["p1"], "le joueur suivant commence la manche 2");
  assert.equal(s.history[0].by, "p2");
});

test("robot : dichotomie parfaite au niveau fort", () => {
  for (const max of [100, 1000]) for (let secret = 1; secret <= max; secret += max === 100 ? 1 : 7) {
    const s = { max, secret };
    const gs = [];
    const r = rng(secret);
    while (!gs.includes(secret)) gs.push(G.botGuess(s, gs, 3, r));
    assert.ok(gs.length <= G.perfect(max), `${max}/${secret} : ${gs.length}`);
  }
  // les niveaux faibles restent dans l'intervalle connu et ne répètent pas
  for (const lvl of [1, 2]) {
    const s = { max: 100, secret: 63 };
    const gs = [], r = rng(lvl);
    while (!gs.includes(63)) {
      const g = G.botGuess(s, gs, lvl, r);
      const [lo, hi] = G.rangeOf(s, gs);
      assert.ok(g >= lo && g <= hi && !gs.includes(g));
      gs.push(g);
    }
  }
});

test("parties complètes pour chaque mode, de 1 à 8 joueurs", () => {
  for (const m of G.modes) for (const n of [1, 2, 8]) for (let seed = 1; seed <= 3; seed++) {
    const { st } = playout(G, n, seed * 17 + n, { settings: { ...m.set, level: 1 + (seed % 3) } });
    assert.equal(st.history.length, Math.min(8, m.set.rounds));
    assert.ok(JSON.stringify(st).length < 30000);
  }
  timeoutPlayout(G, 3, 9);
  timeoutPlayout(G, 4, 3, { ...G.modes[2].set, turnTime: 10 });
});

const optOf = (k) => G.options.find((o) => o.key === k);
const defaults = () => Object.fromEntries(G.options.map((o) => [o.key, o.def]));
test("options et modes bien formés", () => {
  assert.ok(G.options.length >= 2 && G.options.length <= 5);
  for (const o of G.options) {
    assert.ok(o.values.some((v) => v[0] === o.def), o.key);
    assert.ok(o.label.length <= 12);
    for (const v of o.values) { assert.ok(v[1].length <= 12, v[1]); if (v[2]) assert.ok(v[2].length <= 18, v[2]); }
    assert.ok(!["level", "turnTime", "mode"].includes(o.key));
  }
  assert.ok(G.modes.length >= 3 && G.modes.length <= 4);
  assert.equal(G.modes[0].name, "Classique");
  assert.deepEqual(G.modes[0].set, defaults());
  assert.equal(new Set(G.modes.map((m) => JSON.stringify(m.set))).size, G.modes.length);
  for (const m of G.modes) for (const [k, v] of Object.entries(m.set)) assert.ok(optOf(k).values.some((x) => x[0] === v), `${m.id}.${k}`);
  const bad = start(G, mk(2), { max: 7, rounds: "x", play: 1, tries: null }, 1, 0);
  assert.deepEqual([bad.max, bad.rounds, bad.play, bad.tries], [100, 3, "course", "large"]);
  assert.equal(start(G, mk(1), { max: "1000" }, 1, 0).max, 1000);
});
