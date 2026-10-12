import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/bridge.js";
import { start, apply } from "../js/engine.js";
import { playout, timeoutPlayout } from "./harness.mjs";

const P4 = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
const who = (s) => G.toAct(s)[0];
const call = (s, c) => apply(G, s, who(s), { type: "call", call: c, seed: 3 });

test("marque duplicate", () => {
  const sc = (level, strain, tricks, vul = false, dbl = 0) => G.scoreContract({ level, strain, dbl, vul, tricks });
  assert.equal(sc(4, "S", 10), 420);
  assert.equal(sc(4, "S", 10, true), 620);
  assert.equal(sc(3, "N", 9), 400);
  assert.equal(sc(3, "N", 9, true), 600);
  assert.equal(sc(1, "N", 8), 120);
  assert.equal(sc(2, "H", 8, false, 1), 470);
  assert.equal(sc(3, "N", 9, false, 2), 800);
  assert.equal(sc(7, "N", 13, true), 2220);
  assert.equal(sc(6, "S", 12), 980);
  assert.equal(sc(2, "C", 9), 110);
  assert.equal(sc(1, "C", 6), -50);
  assert.equal(sc(1, "C", 6, true), -100);
  assert.equal(sc(4, "S", 7, true, 1), -800);
  assert.equal(sc(4, "S", 6, false, 1), -800);
  assert.equal(sc(3, "N", 8, false, 2), -200);
  assert.equal(sc(1, "S", 9, false, 1), 60 + 50 + 50 + 200);
});

test("enchères : paliers, contre, surcontre, fin sur trois passes", () => {
  let s = start(G, P4, {}, 1, 0);
  assert.equal(s.cur, 0, "Nord donne la première donne");
  s = call(s, "1H");
  assert.throws(() => call(s, "1D"), /faible/);
  assert.throws(() => call(s, "XX"), /Contre/);
  s = call(s, "1S");
  assert.ok(G.legalCalls(s).includes("X"), "Sud peut contrer Est");
  assert.ok(!G.legalCalls(call(s, "P")).includes("X"), "Ouest ne contre pas son partenaire");
});

test("contre et surcontre", () => {
  let s = start(G, P4, {}, 1, 0);
  s = call(s, "1H"); // N
  assert.ok(G.legalCalls(s).includes("X"), "Est peut contrer Nord");
  s = call(s, "X"); // E
  assert.ok(G.legalCalls(s).includes("XX"), "Sud peut surcontrer");
  s = call(s, "XX"); // S
  s = call(s, "P"); s = call(s, "P"); s = call(s, "P");
  assert.equal(s.phase, "play");
  assert.deepEqual(s.contract, { level: 1, strain: "H", dbl: 2, decl: 0 });
  assert.equal(s.cur, 1, "entame à gauche du déclarant");
  const off = start(G, P4, { contre: false }, 1, 0);
  assert.ok(!G.legalCalls(call(off, "1H")).includes("X"));
});

test("déclarant : premier de l'équipe à nommer la couleur, le déclarant joue pour le mort", () => {
  let s = start(G, P4, {}, 2, 0);
  s = call(s, "1S"); // N
  s = call(s, "P"); // E
  s = call(s, "3S"); // S
  s = call(s, "P"); s = call(s, "P"); s = call(s, "P");
  assert.equal(s.contract.decl, 0, "Nord a nommé les piques en premier");
  assert.equal(s.cur, 1);
  assert.equal(s.dummyShown, false);
  s = apply(G, s, s.seats[1], { type: "play", card: s.hands[1][0] });
  assert.equal(s.dummyShown, true, "le mort est montré après l'entame");
  assert.equal(s.cur, 2);
  assert.deepEqual(G.toAct(s), [s.seats[0]], "Nord joue la carte de Sud (le mort)");
  assert.throws(() => apply(G, s, s.seats[2], { type: "play", card: s.hands[2][0] }), /tour/);
  // fournir
  const lead = s.trick[0].c.slice(-1);
  const off = s.hands[2].find((c) => c.slice(-1) !== lead);
  if (off && s.hands[2].some((c) => c.slice(-1) === lead)) assert.throws(() => apply(G, s, s.seats[0], { type: "play", card: off }), /fournir/);
});

test("quatre passes : donne passée, 0 point", () => {
  let s = start(G, P4, {}, 3, 0);
  for (let k = 0; k < 4; k++) s = call(s, "P");
  assert.equal(s.board, 2);
  assert.deepEqual(s.team, [0, 0]);
  assert.equal(s.history[0].contract, null);
  assert.equal(s.cur, 1, "Est donne la deuxième");
});

test("levée : atout, couleur demandée", () => {
  assert.equal(G.trickWinner([{ p: 0, c: "KH" }, { p: 1, c: "AH" }, { p: 2, c: "2S" }, { p: 3, c: "AD" }], "S"), 2);
  assert.equal(G.trickWinner([{ p: 0, c: "KH" }, { p: 1, c: "AH" }, { p: 2, c: "2S" }, { p: 3, c: "AD" }], null), 1);
});

test("vulnérabilité officielle et options", () => {
  const s = start(G, P4, {}, 1, 0);
  assert.deepEqual([1, 2, 3, 4].map((b) => G.vulOf(s, b)), [[false, false], [true, false], [false, true], [true, true]]);
  assert.deepEqual(G.vulOf({ vuln: "all" }, 1), [true, true]);
});

test("parties complètes, chaque mode, places vides tenues par des robots internes, délais", () => {
  for (let seed = 1; seed <= 10; seed++) {
    const { st } = playout(G, 4, seed, { settings: { level: 1 + (seed % 3) } });
    const r = G.result(st);
    assert.equal(r.teams.length, 2);
    const [ns, eo] = st.team;
    const rk = (id) => r.ranking.find((x) => x.id === id).rank;
    assert.equal(rk(st.seats[0]), rk(st.seats[2]), "les partenaires ont le même rang");
    if (ns !== eo) assert.notEqual(rk(st.seats[0]), rk(st.seats[1]));
  }
  G.modes.forEach((m, k) => {
    const { st } = playout(G, 4, 500 + k, { settings: m.set });
    assert.equal(st.history.length, m.set.donnes);
  });
  for (const n of [1, 2, 3]) playout(G, n, 70 + n);
  timeoutPlayout(G, 4, 5);
});

test("robots : ouverture par points d'honneur", () => {
  const s = start(G, P4, {}, 1, 0);
  const r = { next: () => 0.5, int: () => 0 };
  s.hands[0] = ["AS", "KS", "QS", "JS", "2S", "AH", "3H", "4H", "5D", "6D", "7C", "8C", "9C"];
  assert.equal(G.hcp(s.hands[0]), 14);
  assert.equal(G.botCall(s, 0, r), "1S");
  s.hands[0] = ["AS", "KS", "3S", "AH", "QH", "3H", "KD", "4D", "5D", "6C", "7C", "8C", "9C"];
  assert.equal(G.botCall(s, 0, r), "1N");
  s.hands[0] = ["2S", "3S", "4S", "5H", "6H", "7H", "8D", "9D", "10D", "JC", "QC", "2C", "3C"];
  assert.equal(G.botCall(s, 0, r), "P");
});

test("options et modes bien formés", () => {
  const keys = G.options.map((o) => o.key);
  assert.ok(keys.length >= 2 && keys.length <= 5);
  for (const o of G.options) {
    assert.ok(o.values.some((v) => v[0] === o.def));
    for (const v of o.values) { assert.ok(v[1].length <= 12, v[1]); if (v[2]) assert.ok(v[2].length <= 18, v[2]); }
    assert.ok(!["level", "turnTime", "mode"].includes(o.key));
  }
  assert.ok(G.modes.length >= 3 && G.modes.length <= 4);
  assert.equal(G.modes[0].name, "Classique");
  assert.deepEqual(G.modes[0].set, Object.fromEntries(G.options.map((o) => [o.key, o.def])));
  assert.equal(new Set(G.modes.map((m) => JSON.stringify(m.set))).size, G.modes.length);
  assert.ok(!JSON.stringify([G.options, G.modes, G.meta]).includes(String.fromCharCode(0x2014)));
  assert.equal(start(G, P4, { donnes: 3 }, 1, 0).total, 4);
});
