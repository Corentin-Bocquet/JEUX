import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/backgammon.js";
import { start, apply } from "../js/engine.js";
import { playout, timeoutPlayout } from "./harness.mjs";

const P = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
const side = (spec) => { const a = Array(26).fill(0); for (const [k, v] of Object.entries(spec)) a[k] = v; return a; };
const total = (a) => a.reduce((x, y) => x + y, 0);
// partie en cours, au joueur 0, avec les dés donnés et une position choisie
function at(me, op, dice, settings = {}) {
  const s = start(G, P, settings, 1, 0);
  s.side = 0; s.b = [me, op]; s.phase = "move"; s.dice = dice; s.played = []; s.t0 = [me.slice(), op.slice()];
  s.need = G.maxUsable(me, op, dice);
  return s;
}
const has = (list, f, d) => list.some((m) => m.f === f && m.d === d);

test("départ : 15 pions chacun, lancer d'ouverture avec deux dés différents", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const s = start(G, P, {}, seed, 0);
    assert.equal(total(s.b[0]), 15); assert.equal(total(s.b[1]), 15);
    assert.equal(G.pips(s.b[0]), 167);
    assert.notEqual(s.opening[0], s.opening[1]);
    assert.equal(s.phase, "move");
    assert.equal(s.dice.length, 2);
    assert.equal(s.side, s.opening[0] > s.opening[1] ? 0 : 1, "le plus fort commence");
    assert.deepEqual(G.toAct(s), [s.order[s.side]]);
  }
  const n = start(G, P, { start: "nack" }, 1, 0);
  assert.equal(total(n.b[0]), 15);
  assert.equal(n.b[0][23], 2);
});

test("flèche bloquée, touche et barre", () => {
  // leur 17 = ma flèche 8 (tenue par 2 pions) ; leur 15 = ma flèche 10 (un pion seul)
  const me = side({ 13: 2, 6: 13 }), op = side({ 17: 2, 15: 1, 1: 12 });
  let s = at(me, op, [5, 3]);
  const mv = G.movesNow(s);
  assert.ok(!has(mv, 13, 5), "13 -> 8 bloqué");
  assert.ok(has(mv, 13, 3), "13 -> 10 touche");
  s = apply(G, s, s.order[0], { type: "move", f: 13, d: 3 });
  assert.equal(s.b[1][G.BAR], 1, "le pion touché part sur la barre");
  assert.equal(s.b[1][15], 0);
  assert.equal(s.played[0].h, 1);
  assert.throws(() => apply(G, s, s.order[0], { type: "move", f: 13, d: 3 }), /permis/, "dé déjà utilisé");
});

test("pion sur la barre : il rentre d'abord, sinon le tour passe", () => {
  const me = side({ 25: 1, 6: 14 }), op = side({ 1: 15 });
  let s = at(me, op, [6, 2]);
  const mv = G.movesNow(s);
  assert.ok(mv.every((m) => m.f === 25), "seul le pion de la barre peut bouger");
  // jan adverse fermé : aucun coup, le tour passe tout seul après le lancer
  const closed = side({ 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 3 }); // leurs 1 à 6 = mes 19 à 24
  s = at(side({ 25: 1, 6: 14 }), closed, [1, 1]);
  s.phase = "roll"; s.dice = [];
  const after = apply(G, s, s.order[0], { type: "roll", seed: 5 });
  assert.equal(after.phase, "roll");
  assert.equal(after.side, 1, "le tour est passé");
  assert.equal(after.note.txt, "bloque");
});

test("doubles : quatre mouvements", () => {
  let s = at(side({ 24: 2, 13: 5, 8: 3, 6: 5 }), side({ 24: 2, 13: 5, 8: 3, 6: 5 }), [3, 3, 3, 3]);
  assert.equal(s.need, 4);
  const x = s.order[0];
  s = apply(G, s, x, { type: "move", list: [{ f: 8, d: 3 }, { f: 8, d: 3 }, { f: 6, d: 3 }] });
  assert.equal(s.played.length, 3);
  assert.throws(() => apply(G, s, x, { type: "done" }), /reste/);
  s = apply(G, s, x, { type: "move", f: 6, d: 3 });
  assert.ok(G.turnComplete(s));
  assert.throws(() => apply(G, s, x, { type: "move", f: 13, d: 3 }), /tous/);
  s = apply(G, s, x, { type: "done" });
  assert.equal(s.side, 1);
  assert.equal(s.phase, "roll");
});

test("obligation de jouer les deux dés si possible", () => {
  // aucun coup : 24 -> 18 et 24 -> 23 bloqués, et pas de sortie tant qu'un pion est dehors
  let s = at(side({ 24: 1, 1: 14 }), side({ 7: 2, 2: 13 }), [6, 1]);
  assert.equal(s.need, 0);
  // seul l'ordre 2 puis 6 permet de jouer les deux dés : le 6 d'abord est refusé
  s = at(side({ 10: 1, 6: 14 }), side({ 21: 2, 2: 13 }), [6, 2]);
  assert.equal(s.need, 2);
  assert.deepEqual(G.movesNow(s), [{ f: 10, d: 2 }]);
  assert.throws(() => apply(G, s, s.order[0], { type: "move", f: 10, d: 6 }), /permis/);
});

test("un seul dé jouable : le plus fort obligatoire", () => {
  // 20 -> 19 (1) bloqué ; 20 -> 14 (6) passe, mais ensuite 14 -> 13 bloqué : un seul dé, le 6
  let s = at(side({ 20: 1, 1: 14 }), side({ 6: 2, 12: 2, 1: 11 }), [6, 1]);
  assert.equal(s.need, 1);
  assert.deepEqual(G.movesNow(s), [{ f: 20, d: 6 }]);
  // si les deux dés passent séparément mais pas ensemble, le plus fort est imposé
  s = at(side({ 20: 1, 1: 14 }), side({ 12: 2, 18: 2, 1: 11 }), [6, 1]);
  assert.equal(s.need, 1);
  assert.deepEqual(G.movesNow(s), [{ f: 20, d: 6 }]);
});

test("sortie des pions : jan complet, dé plus fort sur le pion le plus éloigné", () => {
  let s = at(side({ 7: 1, 3: 14 }), side({ 1: 15 }), [6, 5]);
  assert.ok(!G.movesNow(s).some((m) => m.f - m.d <= 0), "pas de sortie tant qu'un pion est dehors");
  s = at(side({ 4: 2, 2: 13 }), side({ 1: 15 }), [6, 5]);
  assert.ok(has(G.movesNow(s), 4, 6), "dé plus fort : le pion le plus éloigné sort");
  assert.ok(!has(G.movesNow(s), 2, 6), "mais pas un pion plus proche");
  s = apply(G, s, s.order[0], { type: "move", f: 4, d: 6 });
  assert.equal(s.b[0][0], 1);
});

test("fin de partie : simple, gammon, backgammon", () => {
  const win = (op) => {
    let s = at(side({ 1: 1, 0: 14 }), op, [2, 1]);
    s = apply(G, s, s.order[0], { type: "move", f: 1, d: 2 });
    return s;
  };
  let s = win(side({ 0: 3, 6: 12 }));
  assert.equal(s.end.kind, "simple"); assert.equal(s.end.pts, 1);
  assert.equal(s.result.ranking[0].id, s.order[0]); assert.equal(s.result.ranking[0].score, 1);
  s = win(side({ 6: 15 }));
  assert.equal(s.end.kind, "gammon"); assert.equal(s.score[s.order[0]], 2);
  s = win(side({ 6: 14, 20: 1 }));
  assert.equal(s.end.kind, "backgammon"); assert.equal(s.score[s.order[0]], 3);
  s = win(side({ 6: 14, 25: 1 }));
  assert.equal(s.end.kind, "backgammon");
});

test("annuler mon coup dans le tour", () => {
  let s = at(side({ 24: 2, 13: 5, 8: 3, 6: 5 }), side({ 24: 2, 13: 5, 8: 3, 6: 5 }), [6, 1]);
  const x = s.order[0];
  const before = JSON.stringify(s.b);
  assert.throws(() => apply(G, s, x, { type: "undo" }), /annuler/);
  s = apply(G, s, x, { type: "move", f: 13, d: 6 });
  s = apply(G, s, x, { type: "move", f: 8, d: 1 });
  s = apply(G, s, x, { type: "undo" });
  assert.equal(s.played.length, 1);
  s = apply(G, s, x, { type: "undo" });
  assert.equal(JSON.stringify(s.b), before);
  // annuler une touche rend le pion adverse
  const op = side({ 1: 14 }); op[19] = 1; // leur 19 = ma 6
  s = at(side({ 7: 2, 6: 13 }), op, [1, 2]);
  s = apply(G, s, x, { type: "move", f: 7, d: 1 });
  assert.equal(s.b[1][25], 1);
  s = apply(G, s, x, { type: "undo" });
  assert.equal(s.b[1][25], 0); assert.equal(s.b[1][19], 1);
  // aussi pour le joueur 1
  s = start(G, P, {}, 3, 0);
  const y = s.order[s.side];
  const b0 = JSON.stringify(s.b);
  const m = G.movesNow(s)[0];
  s = apply(G, s, y, { type: "move", f: m.f, d: m.d });
  s = apply(G, s, y, { type: "undo" });
  assert.equal(JSON.stringify(s.b), b0);
});

test("videau : doubler, accepter, abandonner, Crawford", () => {
  let s = start(G, P, { cube: true }, 4, 0);
  s.phase = "roll"; s.played = [];
  const x = s.order[s.side], y = s.order[1 - s.side];
  assert.ok(G.canDouble(s));
  s = apply(G, s, x, { type: "double" });
  assert.deepEqual(G.toAct(s), [y]);
  assert.throws(() => apply(G, s, y, { type: "roll" }), /Accepte/);
  const taken = apply(G, s, y, { type: "take" });
  assert.equal(taken.cubeVal, 2);
  assert.equal(taken.owner, 1 - s.side);
  assert.deepEqual(G.toAct(taken), [x], "le doubleur lance ensuite");
  assert.ok(!G.canDouble(taken), "le cube appartient à l'autre");
  const dropped = apply(G, s, y, { type: "drop" });
  assert.equal(dropped.end.kind, "abandon");
  assert.equal(dropped.result.ranking.find((r) => r.id === x).score, 1);
  // sans l'option, pas de doublement
  let t = start(G, P, {}, 4, 0); t.phase = "roll";
  assert.throws(() => apply(G, t, t.order[t.side], { type: "double" }), /doubler/);
  // Crawford : la partie qui suit l'arrivée à 1 point du but
  let m = start(G, P, { cube: true, match: 3 }, 5, 0);
  const w = m.order[0];
  m.b = [side({ 1: 1, 0: 14 }), side({ 0: 2, 6: 13 })]; m.side = 0; m.phase = "move"; m.dice = [2, 1]; m.played = [];
  m.t0 = [m.b[0].slice(), m.b[1].slice()]; m.need = 1; m.cubeVal = 2;
  m = apply(G, m, w, { type: "move", f: 1, d: 2 });
  assert.equal(m.score[w], 2); assert.equal(m.phase, "end");
  assert.deepEqual(G.toAct(m), [m.order[1]], "le perdant lance la suivante");
  m = apply(G, m, m.order[1], { type: "next", seed: 9 });
  assert.ok(m.crawford);
  m.phase = "roll";
  assert.ok(!G.canDouble(m));
});

test("le robot fort touche un pion isolé quand c'est rentable et évite les pions découverts", () => {
  const me = side({ 24: 2, 13: 5, 8: 3, 6: 5 });
  const op = side({ 24: 2, 13: 5, 8: 3, 6: 4 }); op[15] = 1; // leur 15 = ma 10
  let s = at(me, op, [3, 1], { level: 3 });
  const a = G.bot(s, s.order[0], { next: () => 0.5, int: () => 0, pick: (l) => l[0] });
  const after = apply(G, s, s.order[0], a);
  // 3-1 : faire la flèche 5 (8/5 6/5) est le meilleur coup classique
  assert.equal(after.b[0][5], 2, JSON.stringify(a));
});

test("parties complètes robot contre robot", () => {
  for (let seed = 1; seed <= 12; seed++) playout(G, 2, seed, { settings: { level: (seed % 3) + 1 } });
  timeoutPlayout(G, 2, 9);
});

test("parties complètes pour chaque mode", () => {
  for (const m of G.modes) for (let seed = 1; seed <= 3; seed++) {
    const { st } = playout(G, 2, seed, { settings: { ...m.set, level: 1 + (seed % 3) }, onStep: (x) => assert.ok(JSON.stringify(x).length < 30000) });
    assert.ok(Object.values(st.score).some((v) => v >= m.set.match));
  }
  timeoutPlayout(G, 2, 5, { ...G.modes[2].set, turnTime: 10 });
  timeoutPlayout(G, 2, 6, { ...G.modes[1].set, turnTime: 10 });
});

test("délai écoulé pendant le tour : le coup est terminé à la place du joueur", () => {
  let s = start(G, P, {}, 8, 0);
  const x = s.order[s.side];
  const m = G.movesNow(s)[0];
  s = apply(G, s, x, { type: "move", f: m.f, d: m.d }, { turnTime: 10 });
  s = apply(G, s, "zz", { type: "timeout", who: s._who, seed: 3, now: s._dl + 1 }, { turnTime: 10 });
  assert.notEqual(G.toAct(s)[0], x);
  assert.equal(s.last.length, 2);
});

const optOf = (k) => G.options.find((o) => o.key === k);
const defaults = () => Object.fromEntries(G.options.map((o) => [o.key, o.def]));

test("options et modes bien formés, valeurs invalides", () => {
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
  const s = start(G, P, { cube: "x", match: 4, start: "zz" }, 1, 0);
  assert.deepEqual([s.cube, s.match, s.start], [false, 1, "classique"]);
  assert.ok(!JSON.stringify([G.meta, G.options, G.modes]).includes("\u2014"));
});

test("joueur en trop : il regarde et finit classé", () => {
  const { st } = playout(G, 3, 4);
  assert.equal(st.order.length, 2);
  assert.equal(st.result.ranking.find((r) => r.id === "p2").rank, 3);
});
