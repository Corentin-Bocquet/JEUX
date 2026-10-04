import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/pfc.js";
import { start, apply } from "../js/engine.js";
import { playout, timeoutPlayout } from "./harness.mjs";

const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "J" + i }));
const fixed = (x = 0) => ({ next: () => x, int: () => 0, pick: (l) => l[0], shuffle: (l) => l.slice() });

test("qui bat qui, en classique et en lézard Spock", () => {
  const pairs = [["R", "S"], ["S", "P"], ["P", "R"], ["R", "L"], ["L", "K"], ["K", "S"], ["S", "L"], ["L", "P"], ["P", "K"], ["K", "R"]];
  for (const [a, b] of pairs) { assert.ok(G.beats(a, b), a + b); assert.ok(!G.beats(b, a), b + a); }
  for (const k of "RPSLK") {
    assert.ok(!G.beats(k, k));
    assert.equal("RPSLK".split("").filter((x) => G.beats(k, x)).length, 2, "chaque signe en bat exactement 2");
  }
  for (const k of Object.keys(G.VERBS)) assert.ok(G.beats(k[0], k[1]), k);
  assert.equal(Object.keys(G.VERBS).length, 10);
});

test("duel : choix secrets, refus des doublons et des signes inconnus, manches gagnantes", () => {
  let s = start(G, mk(2), { wins: 2 }, 1, 0);
  const [a, b] = s.ids;
  assert.deepEqual(G.toAct(s).sort(), [a, b].sort());
  assert.throws(() => apply(G, s, a, { type: "pick", sign: "L" }), /inconnu/);
  s = apply(G, s, a, { type: "pick", sign: "R" });
  assert.equal(s.rev, 0, "rien n'est révélé tant que l'autre n'a pas choisi");
  assert.deepEqual(G.toAct(s), [b]);
  assert.throws(() => apply(G, s, a, { type: "pick", sign: "P" }), /déjà/);
  s = apply(G, s, b, { type: "pick", sign: "R" });
  assert.equal(s.matches[0].sa + s.matches[0].sb, 0, "égalité : on rejoue");
  assert.equal(s.reveals.at(-1).w.length, 0);
  assert.equal(s.picks[a], "", "les choix sont effacés après la révélation");
  s = apply(G, s, a, { type: "pick", sign: "P" });
  s = apply(G, s, b, { type: "pick", sign: "R" });
  assert.equal(s.matches[0].sa, 1);
  assert.ok(!s.result);
  s = apply(G, s, a, { type: "pick", sign: "S" });
  s = apply(G, s, b, { type: "pick", sign: "P" });
  assert.equal(s.reveals.at(-1).end, a);
  assert.deepEqual(s.result.ranking.map((x) => [x.id, x.rank]), [[a, 1], [b, 2]]);
});

test("lézard Spock accepté seulement dans la variante", () => {
  let s = start(G, mk(2), { variant: "spock", wins: 1 }, 1, 0);
  const [a, b] = s.ids;
  s = apply(G, s, a, { type: "pick", sign: "K" });
  s = apply(G, s, b, { type: "pick", sign: "S" });
  assert.equal(s.result.ranking[0].id, a);
});

test("tournoi : tableau, qualifiés d'office et classement", () => {
  assert.deepEqual(G.pairUp(["a", "b", "c"]).byes, ["a"]);
  assert.equal(G.pairUp(["a", "b", "c", "d", "e"]).matches.length, 1);
  assert.equal(G.pairUp(["a", "b", "c", "d", "e", "f", "g", "h"]).matches.length, 4);
  assert.equal(G.pairUp(["a", "b", "c", "d", "e", "f"]).byes.length, 2);
  let s = start(G, mk(4), { wins: 1 }, 3, 0);
  assert.equal(s.matches.length, 2);
  const [m1, m2] = s.matches;
  s = apply(G, s, m1.a, { type: "pick", sign: "R" });
  s = apply(G, s, m1.b, { type: "pick", sign: "S" });
  assert.equal(s.stage, 1, "on attend l'autre duel");
  assert.deepEqual(G.toAct(s).sort(), [m2.a, m2.b].sort());
  s = apply(G, s, m2.a, { type: "pick", sign: "P" });
  s = apply(G, s, m2.b, { type: "pick", sign: "S" });
  assert.equal(s.stage, 2);
  assert.deepEqual([s.matches[0].a, s.matches[0].b], [m1.a, m2.b]);
  s = apply(G, s, m1.a, { type: "pick", sign: "R" });
  assert.throws(() => apply(G, s, m1.b, { type: "pick", sign: "R" }), /pas à toi/);
  s = apply(G, s, m2.b, { type: "pick", sign: "P" });
  const rk = Object.fromEntries(s.result.ranking.map((x) => [x.id, x.rank]));
  assert.deepEqual([rk[m2.b], rk[m1.a], rk[m1.b], rk[m2.a]], [1, 2, 3, 3]);
});

test("mêlée aux points : 1 point par adversaire battu, le meilleur gagne la manche", () => {
  let s = start(G, mk(3), { format: "points", wins: 1 }, 1, 0);
  const [a, b, c] = s.ids;
  s = apply(G, s, a, { type: "pick", sign: "R" });
  s = apply(G, s, b, { type: "pick", sign: "R" });
  s = apply(G, s, c, { type: "pick", sign: "R" });
  assert.equal(s.manche, 2, "tous pareils : personne ne gagne");
  s = apply(G, s, a, { type: "pick", sign: "R" });
  s = apply(G, s, b, { type: "pick", sign: "S" });
  s = apply(G, s, c, { type: "pick", sign: "P" });
  assert.equal(s.manche, 3, "un point chacun : ex æquo, la partie continue");
  assert.deepEqual([s.won[a], s.won[b], s.won[c]], [1, 1, 1]);
  s = apply(G, s, a, { type: "pick", sign: "P" });
  s = apply(G, s, b, { type: "pick", sign: "R" });
  s = apply(G, s, c, { type: "pick", sign: "R" });
  assert.deepEqual(s.reveals.at(-1).pts, { [a]: 2, [b]: 0, [c]: 0 });
  assert.equal(s.result.ranking[0].id, a);
  // à 2 joueurs, la mêlée devient un duel
  assert.equal(start(G, mk(2), { format: "points" }, 1, 0).format, "tournoi");
});

test("robot : anti-répétition et contre du signe attendu", () => {
  let s = start(G, mk(2), { level: 3 }, 1, 0);
  const [a, b] = s.ids;
  // l'adversaire a joué 2 fois pierre : il évitera la pierre et passera plutôt à feuille, le robot joue ciseaux
  s.hist[b] = "RR";
  const p = G.predict(s, "RR");
  assert.ok(p.R < p.P && p.R < p.S);
  assert.deepEqual(G.bot(s, a, fixed(0)), { type: "pick", sign: "S" });
  // le robot ne joue pas 3 fois de suite le même signe
  s.hist[a] = "SS";
  for (let i = 0; i < 20; i++) assert.notEqual(G.bot(s, a, { next: () => i / 20, int: () => 0, pick: (l) => l[i % l.length] }).sign, "S");
  // il ne joue plus une fois son choix fait
  s = apply(G, s, a, { type: "pick", sign: "R" });
  assert.equal(G.bot(s, a, fixed()), null);
});

test("parties complètes pour chaque mode, de 2 à 8 joueurs", () => {
  for (const m of G.modes) for (const n of [2, 3, 5, 8]) for (let seed = 1; seed <= 4; seed++) {
    const { st } = playout(G, n, seed * 31 + n, { settings: { ...m.set, level: 1 + (seed % 3) } });
    assert.ok(JSON.stringify(st).length < 30000);
  }
  timeoutPlayout(G, 2, 9);
  timeoutPlayout(G, 8, 4, { ...G.modes[3].set, turnTime: 10 });
  timeoutPlayout(G, 7, 5, { ...G.modes[2].set, turnTime: 10 });
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
  const bad = start(G, mk(3), { variant: "x", format: 3, wins: 9 }, 1, 0);
  assert.deepEqual([bad.variant, bad.format, bad.wins], ["classique", "tournoi", 2]);
});
