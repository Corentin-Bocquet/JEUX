import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/compte.js";
import { start, apply, rng } from "../js/engine.js";
import { playout, timeoutPlayout } from "./harness.mjs";

const fix = (s, plates, target) => { s.plates = plates; s.target = target; const r = G.solve(plates, target); s.sol = { v: r.v, steps: r.steps }; return s; };

test("opérations entières et positives seulement", () => {
  assert.equal(G.calc(7, "-", 7), null);
  assert.equal(G.calc(3, "-", 7), null);
  assert.equal(G.calc(7, "/", 2), null);
  assert.equal(G.calc(8, "/", 2), 4);
  assert.equal(G.calc(25, "x", 4), 100);
  const ok = G.play([1, 2, 3, 4, 25, 100], [[100, "+", 25], [125, "x", 4]]);
  assert.deepEqual(ok.seen.slice(-2), [125, 500]);
  assert.match(G.play([1, 2, 3, 4, 25, 100], [[100, "+", 100]]).err, /disponible/);
  assert.match(G.play([1, 2, 3, 4, 25, 100], [[3, "-", 4]]).err, /positif/);
  assert.match(G.play([1, 2, 3, 4, 25, 100], [[25, "/", 4]]).err, /reste/);
});

test("le solveur trouve le compte exact et donne des étapes valides", () => {
  const r = G.solve([1, 3, 7, 10, 25, 50], 765);
  assert.equal(r.v, 765);
  const p = G.play([1, 3, 7, 10, 25, 50], r.steps.map((x) => x.slice(0, 3)));
  assert.ok(!p.err); assert.ok(p.seen.includes(765));
  // cible impossible : le plus proche
  const far = G.solve([1, 1, 2, 2, 3, 3], 999);
  assert.ok(far.v < 999 && far.v > 0);
  for (let i = 0; i < 40; i++) {
    const s = G.setup([{ id: "a" }], {}, rng(i));
    assert.equal(s.plates.length, 6);
    assert.ok(s.target >= 101 && s.target <= 999);
    const pool = G.SMALL.concat(G.BIG);
    for (const x of s.plates) { const k = pool.indexOf(x); assert.ok(k >= 0); pool.splice(k, 1); }
    const q = G.play(s.plates, s.sol.steps.map((x) => x.slice(0, 3)));
    assert.ok(q.seen.includes(s.sol.v));
  }
  for (const big of [1, 2, 4]) assert.equal(G.setup([{ id: "a" }], { big }, rng(3)).plates.filter((x) => x > 10).length, big);
});

test("manche de chiffres : le plus proche gagne, le plus rapide départage", () => {
  let s = fix(start(G, [{ id: "a" }, { id: "b" }, { id: "c" }], { rounds: 3 }, 5, 0), [1, 3, 7, 10, 25, 50], 765);
  assert.throws(() => apply(G, s, "a", { type: "propose", steps: [[50, "x", 10]], value: 501, now: 10 }), /obtenu/);
  s = apply(G, s, "a", { type: "propose", steps: [[50, "x", 10], [500, "+", 25]], value: 525, now: 1000 });
  s = apply(G, s, "b", { type: "propose", steps: [[50, "+", 25], [75, "x", 10]], value: 750, now: 2000 });
  s = apply(G, s, "c", { type: "propose", steps: [[50, "+", 25], [75, "x", 10]], value: 750, now: 3000 });
  assert.equal(s.pl.b.v, 750);
  s = apply(G, s, "c", { type: "propose", steps: [[50, "+", 25], [75, "x", 10]], value: 525 > 0 ? 75 : 0, now: 3500 });
  assert.equal(s.pl.c.v, 750, "on garde le meilleur");
  assert.throws(() => apply(G, s, "a", { type: "close", now: 30000 }), /Pas encore/);
  s = apply(G, s, "a", { type: "close", now: 60001 });
  assert.equal(s.phase, "recap");
  assert.equal(s.last.winner, "b");
  assert.equal(s.scores.b, 3 + 3); assert.equal(s.scores.c, 3); assert.equal(s.scores.a, 0);
  s = apply(G, s, "a", { type: "ready", now: 61000 });
  s = apply(G, s, "b", { type: "ready", now: 61000 });
  s = apply(G, s, "c", { type: "ready", now: 61000, seed: 4 });
  assert.equal(s.roundNo, 2); assert.equal(s.phase, "play"); assert.equal(G.roundStart(s), 61000);
});

test("compte exact : fin immédiate et 10 points", () => {
  let s = fix(start(G, [{ id: "a" }, { id: "b" }], {}, 5, 0), [1, 3, 7, 10, 25, 50], 765);
  const st = s.sol.steps.map((x) => x.slice(0, 3));
  s = apply(G, s, "a", { type: "propose", steps: st, value: 765, now: 500 });
  assert.equal(s.pl.a.done, true);
  assert.throws(() => apply(G, s, "a", { type: "done", now: 600 }), /déjà/);
  s = apply(G, s, "b", { type: "done", now: 700 });
  assert.equal(s.scores.a, 13);
});

test("manche de lettres", () => {
  let s = start(G, [{ id: "a" }, { id: "b" }], { letters: 1, rounds: 3 }, 2, 0);
  assert.equal(s.kind, "n");
  s = apply(G, s, "a", { type: "done", now: 1 }); s = apply(G, s, "b", { type: "done", now: 1 });
  s = apply(G, s, "a", { type: "ready", now: 2 }); s = apply(G, s, "b", { type: "ready", now: 2, seed: 9 });
  assert.equal(s.kind, "l"); assert.equal(s.letters.length, 9);
  assert.ok(s.sol.words[0].length >= 5);
  s.letters = "ARTISENOB"; s.sol = { words: G.wordsFor(s.letters).slice(0, 4) };
  assert.throws(() => apply(G, s, "a", { type: "propose", steps: [], value: 1, now: 3 }), /lettres/);
  assert.throws(() => apply(G, s, "a", { type: "word", word: "ZEBRE", now: 3 }), /tirage/);
  assert.throws(() => apply(G, s, "a", { type: "word", word: "TRBS", now: 3 }), /inconnu/);
  const before = s.scores.a;
  s = apply(G, s, "a", { type: "word", word: "bâtir", now: 1000 });
  s = apply(G, s, "b", { type: "word", word: "BATIR", now: 2000 });
  s = apply(G, s, "a", { type: "word", word: "ABETIRONS", now: 3000 });
  assert.equal(s.pl.a.done, true);
  s = apply(G, s, "b", { type: "done", now: 4000 });
  assert.equal(s.scores.a - before, 18 + 3);
});

test("parties complètes avec robots, chaque mode, min et max joueurs", () => {
  for (const m of G.modes) for (const n of [1, 8]) {
    const { st } = playout(G, n, 40 + n, { settings: { ...m.set, rounds: 3, level: 1 + (n % 3) } });
    assert.equal(st.history.length, 3);
    if (m.set.letters) assert.equal(st.history[1].k, "l");
    assert.ok(JSON.stringify(st).length < 30000);
  }
  for (let lv = 1; lv <= 3; lv++) playout(G, 3, lv, { settings: { level: lv, rounds: 3, letters: 1 } });
  timeoutPlayout(G, 2, 4, { turnTime: 10, rounds: 3, letters: 1 });
});

test("options et modes bien formés", () => {
  const keys = G.options.map((o) => o.key);
  assert.ok(G.options.length >= 2 && G.options.length <= 5);
  for (const o of G.options) {
    assert.ok(o.label.length <= 12, o.label);
    assert.ok(o.values.some((v) => v[0] === o.def), o.key);
    for (const v of o.values) { assert.ok(v[1].length <= 12, v[1]); if (v[2]) assert.ok(v[2].length <= 18, v[2]); }
  }
  assert.ok(!keys.includes("level") && !keys.includes("turnTime") && !keys.includes("mode"));
  assert.ok(G.modes.length >= 3 && G.modes.length <= 4);
  assert.equal(G.modes[0].name, "Classique");
  assert.deepEqual(G.modes[0].set, Object.fromEntries(G.options.map((o) => [o.key, o.def])));
  assert.equal(new Set(G.modes.map((m) => JSON.stringify(m.set))).size, G.modes.length);
  const s = start(G, [{ id: "a" }], { rounds: 2, dur: 5, big: 3, letters: "oui" }, 1, 0);
  assert.equal(s.rounds, 5); assert.equal(s.dur, 60); assert.equal(s.big, 0); assert.equal(s.lettersOn, 0);
});
