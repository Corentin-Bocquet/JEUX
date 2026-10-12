import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/devinequi.js";
import { start, apply } from "../js/engine.js";
import { playout, timeoutPlayout } from "./harness.mjs";

const P = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
const defaults = () => Object.fromEntries(G.options.map((o) => [o.key, o.def]));
const R = { next: () => 0.5, int: () => 0, pick: (l) => l[0] };

test("options et modes bien formés", () => {
  assert.ok(G.options.length >= 2 && G.options.length <= 5);
  for (const o of G.options) {
    assert.ok(o.label.length <= 12 && o.values.some((v) => v[0] === o.def), o.key);
    for (const v of o.values) { assert.ok(v[1].length <= 12, v[1]); if (v[2]) assert.ok(v[2].length <= 18, v[2]); }
  }
  assert.ok(G.modes.length >= 3 && G.modes.length <= 4);
  assert.equal(G.modes[0].name, "Classique");
  assert.deepEqual(G.modes[0].set, defaults());
  assert.equal(new Set(G.modes.map((m) => JSON.stringify(m.set))).size, G.modes.length);
});

test("24 personnages tous différents par les questions", () => {
  assert.equal(G.PERSOS.length, 24);
  const sig = G.PERSOS.map((_, i) => G.QUESTIONS.map((q) => (q[3](G.PERSOS[i]) ? 1 : 0)).join(""));
  assert.equal(new Set(sig).size, 24);
  assert.equal(new Set(G.PERSOS.map((p) => p.n)).size, 24);
  for (const q of G.QUESTIONS) {
    const yes = G.PERSOS.filter(q[3]).length;
    assert.ok(yes >= 3 && yes <= 12, q[0] + " " + yes);
  }
  for (const p of G.PERSOS) assert.ok(p.h === "chauve" ? !p.l : true);
});

test("question, réponse honnête, abattage manuel puis tour suivant", () => {
  let s = start(G, P, {}, 2, 0);
  const [x, y] = s.order;
  assert.throws(() => apply(G, s, y, { type: "ask", q: "barbe" }), /tour/);
  assert.throws(() => apply(G, s, x, { type: "done" }), /question/);
  assert.throws(() => apply(G, s, x, { type: "ask", q: "zzz" }), /inconnue/);
  s = apply(G, s, x, { type: "ask", q: "lunettes" });
  assert.equal(s.log[0].a, !!G.PERSOS[s.secret[y]].g);
  assert.equal(s.phase, "flip");
  assert.throws(() => apply(G, s, x, { type: "ask", q: "barbe" }), /déjà/);
  assert.throws(() => apply(G, s, x, { type: "guess", pos: 0 }), /Termine/);
  const down = s.board.map((pi) => (!!G.PERSOS[pi].g !== s.log[0].a ? 1 : 0));
  s = apply(G, s, x, { type: "done", down });
  assert.deepEqual(s.down[x], down);
  assert.deepEqual(G.toAct(s), [y]);
});

test("aide auto, bonne et mauvaise réponse", () => {
  let s = start(G, P, { help: true }, 5, 0);
  const [x, y] = s.order;
  s = apply(G, s, x, { type: "ask", q: "chapeau" });
  assert.deepEqual(G.toAct(s), [y]);
  assert.ok(s.down[x].every((d, i) => d === (!!G.PERSOS[s.board[i]].c !== s.log[0].a ? 1 : 0)));
  // mauvaise réponse = manche perdue
  const wrong = s.board.findIndex((pi) => pi !== s.secret[x]);
  const t = apply(G, s, y, { type: "guess", pos: wrong });
  assert.equal(t.result.ranking.find((r) => r.id === x).rank, 1);
  // bonne réponse
  const good = s.board.indexOf(s.secret[x]);
  const u = apply(G, s, y, { type: "guess", pos: good });
  assert.equal(u.result.ranking.find((r) => r.id === y).rank, 1);
  // option « tour perdu »
  let v = start(G, P, { miss: "tour", size: 16 }, 5, 0);
  assert.equal(v.board.length, 16);
  assert.ok(v.board.includes(v.secret[x]) && v.board.includes(v.secret[y]));
  const w = v.board.findIndex((pi) => pi !== v.secret[y]);
  v = apply(G, v, v.order[0], { type: "guess", pos: w });
  assert.ok(!v.result);
  assert.equal(v.down[v.order[0]][w], 1);
});

test("le robot fort pose la question qui coupe le mieux en deux", () => {
  const s = start(G, P, { level: 3 }, 1, 0);
  const a = G.bot(s, s.order[0], R);
  assert.equal(a.type, "ask");
  const yes = G.PERSOS.filter(G.qById(a.q)[3]).length;
  const best = Math.min(...G.QUESTIONS.map((q) => Math.abs(24 - 2 * G.PERSOS.filter(q[3]).length)));
  assert.equal(Math.abs(24 - 2 * yes), best);
});

test("match en plusieurs manches et parties complètes", () => {
  for (const m of G.modes) for (let seed = 1; seed <= 4; seed++) {
    const { st } = playout(G, 2, seed, { settings: { ...m.set, level: 1 + (seed % 3) } });
    assert.ok(Math.max(...Object.values(st.score)) === m.set.wins);
  }
  for (let seed = 1; seed <= 20; seed++) playout(G, 2, seed, { settings: { level: (seed % 3) + 1 } });
  timeoutPlayout(G, 2, 4);
  timeoutPlayout(G, 2, 6, { ...G.modes[3].set, turnTime: 10 });
});

