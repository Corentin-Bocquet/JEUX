import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/vraifaux.js";
import * as F from "../js/games/lib/flash.js";
import { start, apply } from "../js/engine.js";
import { VF, VF_CATS, VF_LIST } from "../js/data/vraifaux_questions.js";
import { playout, timeoutPlayout } from "./harness.mjs";

const P2 = [{ id: "a", name: "A" }, { id: "b", name: "B" }];

test("banque : 500 affirmations valides, sans doublon, équilibrées", () => {
  assert.ok(VF_LIST.length >= 500, "taille " + VF_LIST.length);
  const seen = new Set();
  for (const q of VF_LIST) {
    assert.ok(VF_CATS.includes(q.c));
    assert.equal(typeof q.t, "boolean");
    assert.ok(q.s.length > 10 && q.e.length > 3, q.s);
    assert.ok(!seen.has(q.s), "doublon : " + q.s);
    seen.add(q.s);
    assert.ok(!/\u2014/.test(q.s + q.e));
  }
  for (const c of VF_CATS) {
    const l = VF[c];
    assert.ok(l.length >= 30, c);
    const vrais = l.filter((x) => x[0]).length;
    assert.ok(vrais > l.length * 0.35 && vrais < l.length * 0.65, c + " déséquilibré");
  }
});

test("réponses, points de vitesse, révélation", () => {
  let s = start(G, P2, { count: 10 }, 7, 1000);
  assert.equal(s.qs.length, 10);
  const t0 = F.qStart(s);
  const truth = G.item(s.qs[0]).t;
  assert.throws(() => apply(G, s, "a", { type: "answer", v: "peut-être", now: t0 }), /Vrai ou Faux/);
  s = apply(G, s, "a", { type: "answer", v: truth, now: t0 + 0 });
  assert.equal(s.ans.a.p, 100);
  assert.throws(() => apply(G, s, "a", { type: "answer", v: truth, now: t0 + 10 }), /déjà/);
  assert.deepEqual(G.toAct(s), ["b"]);
  s = apply(G, s, "b", { type: "answer", v: !truth, now: t0 + 4000 });
  assert.equal(s.qi, 1);
  assert.equal(s.scores.a, 100);
  assert.equal(s.scores.b, 0);
  assert.equal(s.last.ans.b.ok, 0);
  assert.equal(s.qAt, t0 + 4000 + s.reveal);
  // bonus de vitesse : la moitié du délai donne la moitié du bonus
  const truth2 = G.item(s.qs[1]).t;
  s = apply(G, s, "a", { type: "answer", v: truth2, now: s.qAt + s.win / 2 });
  assert.equal(s.ans.a.p, 75);
  s = apply(G, s, "b", { type: "answer", v: truth2, now: s.qAt + s.win * 3 });
  assert.equal(s.last.ans.b.p, 50);
});

test("sans bonus de rapidité : 100 points fixes", () => {
  let s = start(G, P2, { speed: false }, 3, 0);
  const t = G.item(s.qs[0]).t;
  s = apply(G, s, "a", { type: "answer", v: t, now: F.qStart(s) + 7000 });
  assert.equal(s.ans.a.p, 100);
});

test("mort subite : une erreur élimine, le dernier en vie gagne", () => {
  let s = start(G, [...P2, { id: "c" }], { sudden: true, count: 30 }, 5, 0);
  const t = G.item(s.qs[0]).t;
  s = apply(G, s, "a", { type: "answer", v: t, now: 1 });
  s = apply(G, s, "b", { type: "answer", v: !t, now: 2 });
  s = apply(G, s, "c", { type: "answer", v: t, now: 3 });
  assert.equal(s.alive.b, false);
  assert.deepEqual(G.toAct(s), ["a", "c"]);
  assert.throws(() => apply(G, s, "b", { type: "answer", v: true }), /éliminé/);
  const t2 = G.item(s.qs[1]).t;
  s = apply(G, s, "a", { type: "answer", v: !t2, now: 9 });
  s = apply(G, s, "c", { type: "answer", v: t2, now: 9 });
  assert.ok(s.result);
  const rk = s.result.ranking;
  assert.equal(rk[0].id, "c");
  assert.equal(rk.find((x) => x.id === "a").rank, 2);
  assert.equal(rk.find((x) => x.id === "b").rank, 3);
});

test("thème : seules les questions du thème", () => {
  const s = start(G, P2, { theme: "Sport", count: 30 }, 11, 0);
  assert.equal(s.qs.length, 30);
  for (const i of s.qs) assert.equal(G.item(i).c, "Sport");
  assert.equal(new Set(s.qs).size, 30);
});

test("parties complètes avec robots, chaque mode, min et max joueurs", () => {
  for (const m of G.modes) for (const n of [G.meta.min, G.meta.max]) {
    for (const level of [1, 3]) playout(G, n, 3 + n + level, { settings: { ...m.set, level } });
  }
  timeoutPlayout(G, 2, 4, { turnTime: 10, count: 10 });
  timeoutPlayout(G, 3, 5, { turnTime: 10, sudden: true });
});

test("robots : réussite selon le niveau", () => {
  const rate = (level) => {
    let s = start(G, P2, { level, count: 30 }, 1, 0), ok = 0, n = 0;
    const r = (k) => ({ next: () => ((k * 0.6180339) % 1) });
    for (let k = 1; k <= 400; k++) { const a = G.bot(s, "a", r(k)); ok += a.v === G.item(s.qs[0]).t; n++; }
    return ok / n;
  };
  assert.ok(rate(1) < rate(3));
  assert.ok(rate(3) > 0.85);
});

test("options et modes bien formés", () => {
  const keys = G.options.map((o) => o.key);
  assert.ok(G.options.length >= 2 && G.options.length <= 5);
  for (const o of G.options) {
    assert.ok(o.values.some((v) => v[0] === o.def), o.key);
    assert.ok(o.label.length <= 12);
    for (const v of o.values) { assert.ok(v[1].length <= 12, v[1]); if (v[2]) assert.ok(v[2].length <= 18, v[2]); }
  }
  assert.ok(!keys.includes("level") && !keys.includes("turnTime") && !keys.includes("mode"));
  assert.ok(G.modes.length >= 3 && G.modes.length <= 4);
  assert.equal(G.modes[0].name, "Classique");
  assert.deepEqual(G.modes[0].set, Object.fromEntries(G.options.map((o) => [o.key, o.def])));
  assert.equal(new Set(G.modes.map((m) => JSON.stringify(m.set))).size, G.modes.length);
  const s = start(G, P2, { theme: "Cuisine", count: 7, sudden: "x", speed: 3 }, 1, 0);
  assert.equal(s.theme, ""); assert.equal(s.qs.length, 15); assert.equal(s.sudden, false); assert.equal(s.speed, true);
  assert.ok(JSON.stringify(s).length < 30000);
});
