import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/serpents.js";
import { start, apply } from "../js/engine.js";
import { playout, timeoutPlayout } from "./harness.mjs";
import { animMs, T } from "../js/games/lib/parcours.js";

const P = [{ id: "a", name: "Alice" }, { id: "b", name: "Bob" }];
// graine qui donne la valeur de dé voulue (le dé est tiré par rng(seed))
import { rng } from "../js/engine.js";
const seedFor = (v) => { for (let s = 1; ; s++) if (1 + rng(s).int(6) === v) return s; };

test("plateaux valides : pas de case en double, échelles montent, serpents descendent", () => {
  for (const [id, B] of Object.entries(G.BOARDS)) {
    const from = [...Object.keys(B.L), ...Object.keys(B.S)].map(Number);
    const to = [...Object.values(B.L), ...Object.values(B.S)];
    assert.equal(new Set(from).size, from.length, id + " départs uniques");
    for (const t of to) assert.ok(!from.includes(t), `${id} : ${t} n'enchaîne pas`);
    for (const [a, b] of Object.entries(B.L)) assert.ok(b > +a && b <= 100, `${id} échelle ${a}`);
    for (const [a, b] of Object.entries(B.S)) assert.ok(b < +a && +a < 100 && b >= 1, `${id} serpent ${a}`);
  }
});

test("déplacement, échelle, serpent et tour suivant", () => {
  let s = start(G, P, {}, 1, 0);
  const [x, y] = s.order;
  assert.throws(() => apply(G, s, y, { type: "roll", seed: 1 }), /tour/);
  assert.throws(() => apply(G, s, x, { type: "move" }), /inconnue/);
  s = apply(G, s, x, { type: "roll", seed: seedFor(1) });
  assert.equal(s.pos[x], 38, "case 1 = échelle vers 38");
  assert.equal(s.last.frames.at(-1)[2], "j");
  assert.deepEqual(G.toAct(s), [y]);
  s = { ...s, pos: { ...s.pos, [y]: 10 } };
  s = apply(G, s, y, { type: "roll", seed: seedFor(6) });
  assert.equal(s.pos[y], 6, "16 = serpent vers 6");
  assert.deepEqual(G.toAct(s), [y], "un 6 fait rejouer");
});

test("trois 6 de suite au maximum, et pas de rejeu sans l'option", () => {
  let s = start(G, P, {}, 3, 0);
  const x = s.order[0];
  const six = seedFor(6);
  s.pos[x] = 30; s = apply(G, s, x, { type: "roll", seed: six });
  s = apply(G, s, x, { type: "roll", seed: six });
  assert.deepEqual(G.toAct(s), [x]);
  s = apply(G, s, x, { type: "roll", seed: six });
  assert.notDeepEqual(G.toAct(s), [x], "le troisième 6 passe la main");
  let t = start(G, P, { six: 0 }, 3, 0);
  t = apply(G, t, t.order[0], { type: "roll", seed: six });
  assert.deepEqual(G.toAct(t), [t.order[1]]);
});

test("arrivée : rebond, exacte, libre", () => {
  const five = seedFor(5);
  const go = (exact) => { const s = start(G, P, { exact }, 1, 0); s.pos[s.order[0]] = 97; return apply(G, s, s.order[0], { type: "roll", seed: five }); };
  const r = go("rebond");
  assert.equal(r.pos[r.order[0]], 78, "97 + 5 = 102, rebond sur 98 = serpent vers 78");
  const b = go("bloque");
  assert.equal(b.pos[b.order[0]], 97);
  assert.ok(!b.result);
  const l = go("libre");
  assert.equal(l.pos[l.order[0]], 100);
  assert.equal(l.result.ranking[0].id, l.order[0]);
  assert.equal(l.result.ranking[0].rank, 1);
});

test("victoire pile sur 100 et classement par case", () => {
  let s = start(G, [...P, { id: "c", name: "C" }], {}, 5, 0);
  const [x, y, z] = s.order;
  s.pos[x] = 96; s.pos[y] = 50; s.pos[z] = 70;
  s = apply(G, s, x, { type: "roll", seed: seedFor(4) });
  assert.equal(s.winner, x);
  assert.deepEqual(s.result.ranking.map((e) => e.id), [x, z, y]);
  assert.deepEqual(s.result.ranking.map((e) => e.rank), [1, 2, 3]);
  assert.throws(() => apply(G, s, y, { type: "roll", seed: 1 }), /terminée/);
});

test("durée d'animation et délai des robots", () => {
  let s = start(G, P, {}, 1, 0);
  s = apply(G, s, s.order[0], { type: "roll", seed: seedFor(1) });
  assert.equal(animMs(s.last), T.die + T.step + T.jump);
  assert.ok(G.botDelay(s) < 3000);
});

test("options et modes bien formés", () => {
  assert.ok(G.options.length >= 2 && G.options.length <= 5);
  for (const o of G.options) {
    assert.ok(o.values.some((v) => v[0] === o.def), o.key);
    for (const v of o.values) { assert.ok(v[1].length <= 12, v[1]); if (v[2]) assert.ok(v[2].length <= 18, v[2]); }
    assert.ok(!["level", "turnTime", "mode"].includes(o.key));
  }
  assert.ok(G.modes.length >= 3 && G.modes.length <= 4);
  assert.equal(G.modes[0].name, "Classique");
  assert.deepEqual(G.modes[0].set, Object.fromEntries(G.options.map((o) => [o.key, o.def])));
  const combos = new Set(G.modes.map((m) => JSON.stringify(m.set)));
  assert.equal(combos.size, G.modes.length);
  const s = start(G, P, { board: "nope", exact: 4, six: "x" }, 1, 0);
  assert.deepEqual([s.board, s.exact, s.six], ["classique", "rebond", 1]);
});

test("parties complètes pour chaque mode, de 2 à 6 joueurs", () => {
  for (const m of G.modes) for (const n of [2, 6]) for (let seed = 1; seed <= 3; seed++) {
    const { st } = playout(G, n, seed * 13 + n, { settings: { ...m.set } });
    assert.equal(st.pos[st.winner], 100);
    assert.ok(JSON.stringify(st).length < 30000);
  }
  timeoutPlayout(G, 3, 7);
});
