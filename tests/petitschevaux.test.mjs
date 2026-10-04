import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/petitschevaux.js";
import { start, apply, rng } from "../js/engine.js";
import { playout, timeoutPlayout } from "./harness.mjs";

const P = [{ id: "a", name: "Alice" }, { id: "b", name: "Bob" }];
const seedFor = (v) => { for (let s = 1; ; s++) if (1 + rng(s).int(6) === v) return s; };
const roll = (s, pid, v) => apply(G, s, pid, { type: "roll", seed: seedFor(v) });

test("il faut un 6 pour sortir, et le 6 fait rejouer", () => {
  let s = start(G, P, {}, 1, 0);
  const [x, y] = s.order;
  assert.throws(() => apply(G, s, x, { type: "move", h: 0 }), /Lance/);
  s = roll(s, x, 3);
  assert.deepEqual(s.h[x], [-1, -1, -1, -1]);
  assert.deepEqual(G.toAct(s), [y], "aucun coup : la main passe");
  s = roll(s, y, 6);
  assert.equal(s.h[y].filter((p) => p === 0).length, 1, "un seul coup possible : joué tout seul");
  assert.deepEqual(G.toAct(s), [y], "un 6 fait rejouer");
  assert.equal(s.phase, "roll");
});

test("choix du cheval, coups illégaux refusés", () => {
  let s = start(G, P, {}, 1, 0);
  const [x] = s.order;
  s.h[x] = [0, 10, -1, -1];
  s = roll(s, x, 3);
  assert.equal(s.phase, "move");
  assert.deepEqual(G.legalMoves(s, x), [0, 1]);
  assert.throws(() => apply(G, s, x, { type: "move", h: 2 }), /ne peut pas/);
  assert.throws(() => apply(G, s, x, { type: "move", h: 9 }), /inconnu/);
  assert.throws(() => roll(s, x, 3), /cheval/);
  s = apply(G, s, x, { type: "move", h: 1 });
  assert.equal(s.h[x][1], 13);
  assert.equal(s.last.frames.length, 3, "trois pas animés");
});

test("pas deux chevaux de la même couleur sur une case", () => {
  let s = start(G, P, {}, 1, 0);
  const [x] = s.order;
  s.h[x] = [0, 4, -1, -1];
  s = roll(s, x, 4);
  assert.deepEqual(s.h[x], [0, 8, -1, -1], "seul le cheval 1 pouvait bouger");
});

test("prise : le cheval adverse retourne à l'écurie", () => {
  let s = start(G, P, {}, 1, 0);
  const [x, y] = s.order;
  // y est assis à l'opposé : son départ est la case absolue 26
  s.h[x] = [20, -1, -1, -1];
  s.h[y] = [0, -1, -1, -1];
  assert.equal(G.absOf(s, y, 0), 26);
  s = roll(s, x, 6);
  assert.equal(s.phase, "move", "prendre ou sortir : au joueur de choisir");
  s = apply(G, s, x, { type: "move", h: 0 });
  assert.equal(s.h[x][0], 26);
  assert.equal(s.h[y][0], -1);
  assert.ok(s.last.frames.some((f) => f[0] === y + ":0" && f[1] === -1));
  assert.ok(/écurie/.test(s.last.msg));
});

test("sortie sur la case de départ occupée par un adversaire : prise", () => {
  let s = start(G, P, {}, 1, 0);
  const [x, y] = s.order;
  s.h[y] = [26, -1, -1, -1]; // absolu 26 + 26 = 52 -> 0 = départ de x
  assert.equal(G.absOf(s, y, 26), 0);
  s = roll(s, x, 6);
  assert.equal(s.h[x][0], 0);
  assert.equal(s.h[y][0], -1);
});

test("arrivée pile devant l'escalier puis marches 1 à 6", () => {
  let s = start(G, P, { horses: 2 }, 1, 0);
  const [x] = s.order;
  s.h[x] = [47, 56];
  assert.equal(G.target(s, x, 0, 4), null, "on ne dépasse pas la case devant l'escalier");
  assert.equal(G.target(s, x, 0, 3), 50);
  s.h[x] = [50, 56];
  for (let d = 1; d <= 6; d++) if (d !== 1) assert.equal(G.target(s, x, 0, d), null);
  assert.equal(G.target(s, x, 0, 1), 51);
  s.h[x] = [55, 56];
  assert.equal(G.target(s, x, 0, 6), 56);
  s = roll(s, x, 6);
  assert.equal(s.winner, x, "tous les chevaux au centre : victoire");
  assert.equal(s.result.ranking[0].id, x);
  assert.equal(s.result.ranking[0].score, 2);
});

test("escalier libre et sortie avec un 1", () => {
  let s = start(G, P, { stairs: "libre", exit: "16" }, 1, 0);
  const [x] = s.order;
  s.h[x] = [48, -1, -1, -1];
  assert.equal(G.target(s, x, 0, 5), 53);
  assert.equal(G.target(s, x, 0, 6), 54);
  s.h[x] = [53, -1, -1, -1];
  assert.equal(G.target(s, x, 0, 4), null);
  assert.equal(G.target(s, x, 0, 3), 56);
  assert.equal(G.target(s, x, 1, 1), 0, "un 1 suffit pour sortir");
  const c = start(G, P, {}, 1, 0);
  assert.equal(G.target(c, c.order[0], 0, 1), null);
});

test("robot : préfère prendre, sinon sortir, et se met à l'abri", () => {
  const r = rng(1);
  let s = start(G, P, { level: 3 }, 1, 0);
  const [x, y] = s.order;
  s.h[x] = [20, 5, -1, -1]; s.h[y] = [0, -1, -1, -1];
  s.die = 6; s.phase = "move";
  assert.deepEqual(G.bot(s, x, r), { type: "move", h: 0 }, "prise en 26");
  s.h[y] = [-1, -1, -1, -1];
  s.h[x] = [20, 5, -1, -1];
  assert.deepEqual(G.bot(s, x, r), { type: "move", h: 2 }, "sortie");
  // cheval menacé par un adversaire 2 cases derrière : il fuit
  s.die = 5;
  s.h[x] = [30, 10, -1, -1]; s.h[y] = [2, -1, -1, -1]; // y absolu 28, x absolu 30
  assert.deepEqual(G.bot(s, x, r), { type: "move", h: 0 });
  s.phase = "roll";
  assert.deepEqual(G.bot(s, x, r), { type: "roll", pick: true });
});

test("lancer du robot : choisit son cheval dans la même action", () => {
  let s = start(G, P, { level: 3 }, 1, 0);
  const [x, y] = s.order;
  s.h[x] = [20, 5, -1, -1]; s.h[y] = [0, -1, -1, -1];
  s = apply(G, s, x, { type: "roll", pick: true, seed: seedFor(6) });
  assert.equal(s.phase, "roll");
  assert.equal(s.h[x][0], 26, "il prend");
  assert.equal(s.h[y][0], -1);
  assert.deepEqual(G.toAct(s), [x], "et rejoue après le 6");
});

test("options et modes bien formés", () => {
  assert.ok(G.options.length >= 2 && G.options.length <= 5);
  for (const o of G.options) {
    assert.ok(o.values.some((v) => v[0] === o.def), o.key);
    for (const v of o.values) { assert.ok(v[1].length <= 12, v[1]); if (v[2]) assert.ok(v[2].length <= 18, v[2]); }
  }
  assert.ok(G.modes.length >= 3 && G.modes.length <= 4);
  assert.equal(G.modes[0].name, "Classique");
  assert.deepEqual(G.modes[0].set, Object.fromEntries(G.options.map((o) => [o.key, o.def])));
  assert.equal(new Set(G.modes.map((m) => JSON.stringify(m.set))).size, G.modes.length);
  const s = start(G, P, { horses: 3, exit: 6, stairs: "x" }, 1, 0);
  assert.deepEqual([s.horses, s.exit, s.stairs], [4, "6", "marches"]);
  assert.deepEqual(Object.values(start(G, P, {}, 1, 0).seat).sort(), [0, 2]);
});

test("parties complètes pour chaque mode, de 2 à 4 joueurs", () => {
  for (const m of G.modes) for (const n of [2, 3, 4]) for (let seed = 1; seed <= 2; seed++) {
    const { st } = playout(G, n, seed * 17 + n, { settings: { ...m.set, level: 1 + (seed % 3) } });
    assert.ok(st.h[st.winner].every((p) => p === G.END));
    assert.ok(JSON.stringify(st).length < 30000);
  }
  timeoutPlayout(G, 4, 3);
});
