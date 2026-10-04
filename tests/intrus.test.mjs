import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/intrus.js";
import * as F from "../js/games/lib/flash.js";
import { start, apply } from "../js/engine.js";
import { IN_CATS } from "../js/data/intrus_series.js";
import { playout, timeoutPlayout } from "./harness.mjs";

const P2 = [{ id: "a", name: "A" }, { id: "b", name: "B" }];

test("banque : 400 séries valides et sans doublon", () => {
  assert.ok(G.SERIES.length >= 400, "taille " + G.SERIES.length);
  const seen = new Set();
  for (const q of G.SERIES) {
    assert.ok(IN_CATS.includes(q.c));
    assert.equal(q.x.length, 5);
    assert.ok(q.x.every((w) => typeof w === "string" && w.trim().length > 0));
    assert.equal(new Set(q.x.map((w) => w.toLowerCase())).size, 5, "élément répété : " + q.x);
    assert.ok(q.e.startsWith("Seul"), q.e);
    assert.ok(!/\u2014|\.\.\.|\?/.test(q.e), "explication douteuse : " + q.e);
    const k = q.x.join("|");
    assert.ok(!seen.has(k), "doublon : " + k);
    seen.add(k);
  }
  for (const c of IN_CATS) assert.ok(G.SERIES.filter((q) => q.c === c).length >= 30, c);
});

test("calculs des séries de maths exacts", () => {
  const ev = (t) => { const x = t.replace(/×/g, "*").replace(/−/g, "-").replace(/÷/g, "/").replace(/ /g, ""); return /^[0-9+*/-]+$/.test(x) && /[+*/]|\d-\d/.test(x) ? Function("return " + x)() : null; };
  let n = 0;
  for (const q of G.SERIES.filter((s) => s.c === "Maths")) {
    const v = q.x.map(ev);
    if (v.some((y) => y === null)) continue;
    n++;
    assert.ok(v.slice(1).every((y) => y === v[1]), q.x.join(", "));
    assert.notEqual(v[0], v[1], q.x.join(", "));
  }
  assert.ok(n >= 10);
});

test("4 ou 5 éléments, intrus toujours présent, réponses jugées", () => {
  for (const size of [4, 5]) {
    const s = start(G, P2, { size, count: 20 }, 9, 0);
    for (const q of s.qs) { assert.equal(q.o.length, size); assert.ok(q.o.includes(0)); assert.equal(new Set(q.o).size, size); }
  }
  let s = start(G, P2, { count: 10 }, 4, 0);
  const q = s.qs[0];
  const wrong = q.o.find((k) => k !== 0);
  const absent = [1, 2, 3, 4].find((k) => !q.o.includes(k));
  assert.throws(() => apply(G, s, "a", { type: "answer", v: absent, now: 1 }), /affichés/);
  assert.throws(() => apply(G, s, "a", { type: "answer", v: "x", now: 1 }), /affichés/);
  s = apply(G, s, "a", { type: "answer", v: 0, now: F.qStart(s) + 1000 });
  s = apply(G, s, "b", { type: "answer", v: wrong, now: F.qStart(s) + 2000 });
  assert.equal(s.scores.a, 95);
  assert.equal(s.scores.b, 0);
  assert.equal(s.last.ans.a.ok, 1);
});

test("mort subite et temps écoulé", () => {
  let s = start(G, P2, { sudden: true }, 2, 0);
  s = apply(G, s, "a", { type: "answer", v: 0, now: 5 });
  // b ne répond pas : le délai joue « pas de réponse », donc élimination
  s = apply(G, s, "b", { ...G.auto(s, "b"), now: 6 });
  assert.equal(s.alive.b, false);
  assert.ok(s.result);
  assert.equal(s.result.ranking[0].id, "a");
});

test("parties complètes avec robots, chaque mode, min et max joueurs", () => {
  for (const m of G.modes) for (const n of [G.meta.min, G.meta.max]) for (const level of [1, 3]) playout(G, n, 7 + n + level, { settings: { ...m.set, level } });
  timeoutPlayout(G, 2, 4, { turnTime: 10, count: 10 });
  timeoutPlayout(G, 4, 8, { turnTime: 10, sudden: true });
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
  const s = start(G, P2, { size: 9, count: "abc", theme: "Rien" }, 1, 0);
  assert.equal(s.size, 4); assert.equal(s.qs.length, 15); assert.equal(s.theme, "");
  for (const c of IN_CATS) assert.equal(start(G, P2, { theme: c, count: 30 }, 3, 0).qs.length, 30);
  assert.ok(JSON.stringify(start(G, P2, { count: 30, size: 5 }, 1, 0)).length < 30000);
});
