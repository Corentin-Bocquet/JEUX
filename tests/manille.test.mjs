import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/manille.js";
import { RULES, NOTRUMP } from "../js/games/manille.js";
import { makeRules, deck32, teamOf, botCard } from "../js/games/lib/plis32.js";
import { start, apply } from "../js/engine.js";
import { playout, timeoutPlayout } from "./harness.mjs";

const P4 = ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase() }));
const R0 = { next: () => 0.5, int: () => 0, pick: (l) => l[0] };

test("valeurs : 60 points dans le jeu, manille 5, manillon 4", () => {
  assert.equal(RULES.points(deck32(), "H"), 60);
  assert.equal(RULES.points(deck32(), null), 60);
  assert.equal(RULES.value("10S", "H"), 5);
  assert.equal(RULES.value("AS", "H"), 4);
  assert.equal(RULES.value("KS", "H"), 3);
  assert.equal(RULES.value("QS", "H"), 2);
  assert.equal(RULES.value("JS", "H"), 1);
  assert.equal(RULES.value("9S", "H"), 0);
});

test("ordre : 10 > As > Roi > Dame > Valet > 9 > 8 > 7, l'atout bat tout", () => {
  const ord = ["10S", "AS", "KS", "QS", "JS", "9S", "8S", "7S"];
  for (let i = 0; i < ord.length - 1; i++) assert.ok(RULES.beats(ord[i], ord[i + 1], "H", "S"), ord[i]);
  assert.equal(RULES.winner([{ p: 0, c: "AS" }, { p: 1, c: "10S" }, { p: 2, c: "7H" }, { p: 3, c: "10D" }], "H").p, 2);
  assert.equal(RULES.winner([{ p: 0, c: "AS" }, { p: 1, c: "10S" }, { p: 2, c: "7H" }], null).p, 1);
});

test("obligations : fournir, monter sur l'adversaire, couper, surcouper", () => {
  const tr = "H";
  assert.deepEqual(RULES.legal(["7S", "10S", "KD"], [{ p: 0, c: "AS" }], tr, 1), ["10S"]);
  // partenaire maître : fournir suffit
  assert.deepEqual(RULES.legal(["7S", "10S"], [{ p: 3, c: "AS" }], tr, 1).sort(), ["10S", "7S"]);
  // déjà coupé par l'adversaire : n'importe quelle carte de la couleur
  assert.deepEqual(RULES.legal(["7S", "10S"], [{ p: 3, c: "AS" }, { p: 0, c: "7H" }], tr, 1).sort(), ["10S", "7S"]);
  // couper
  assert.deepEqual(RULES.legal(["7H", "KD"], [{ p: 0, c: "AS" }], tr, 1), ["7H"]);
  // surcouper si possible, sinon libre
  assert.deepEqual(RULES.legal(["7H", "AH", "KD"], [{ p: 3, c: "AS" }, { p: 0, c: "KH" }], tr, 1), ["AH"]);
  assert.deepEqual(RULES.legal(["7H", "KD"], [{ p: 3, c: "AS" }, { p: 0, c: "KH" }], tr, 1), ["7H", "KD"]);
  // partenaire maître : libre
  assert.deepEqual(RULES.legal(["7H", "KD"], [{ p: 3, c: "AS" }, { p: 0, c: "7S" }], tr, 1), ["7H", "KD"]);
  // sans obligation de monter
  const free = makeRules({ ...RULES.cfg, climb: "none" });
  assert.deepEqual(free.legal(["7S", "10S"], [{ p: 0, c: "AS" }], tr, 1), ["7S", "10S"]);
  // sans atout : on se défausse librement
  assert.deepEqual(RULES.legal(["7H", "KD"], [{ p: 0, c: "AS" }], null, 1), ["7H", "KD"]);
});

test("donne : 8 cartes chacun, atout tiré chez le donneur", () => {
  const s = start(G, P4, {}, 11, 0);
  for (const h of s.hands) assert.equal(h.length, 8);
  assert.equal(new Set(s.hands.flat()).size, 32);
  assert.ok(s.hands[s.dealer].includes(s.turned));
  assert.equal(s.trump, s.turned.slice(-1));
  assert.equal(s.cur, (s.dealer + 1) % 4);
  assert.equal(s.phase, "play");
});

test("atout au choix : le donneur choisit, sans atout possible", () => {
  let s = start(G, P4, { trump: "choix" }, 11, 0);
  assert.equal(s.phase, "choose");
  assert.equal(s.cur, s.dealer);
  const d = s.order[s.dealer];
  assert.throws(() => apply(G, s, s.order[(s.dealer + 1) % 4], { type: "trump", suit: "H" }), /tour/);
  assert.throws(() => apply(G, s, d, { type: "trump", suit: "Z" }), /inconnue/);
  s = apply(G, s, d, { type: "trump", suit: NOTRUMP });
  assert.equal(s.phase, "play");
  assert.equal(s.cur, (s.dealer + 1) % 4);
  assert.deepEqual(G.scoreDeal({ ...s, pts: [40, 20] }).got, [20, 0]);
});

test("score : ce qui dépasse 30, rien à 30 partout", () => {
  assert.deepEqual(G.scoreDeal({ trump: "H", pts: [42, 18] }).got, [12, 0]);
  assert.deepEqual(G.scoreDeal({ trump: "H", pts: [30, 30] }).got, [0, 0]);
  assert.deepEqual(G.scoreDeal({ trump: "H", pts: [0, 60] }).got, [0, 30]);
});

test("carte illégale refusée", () => {
  let s = start(G, P4, {}, 5, 0);
  s = apply(G, s, s.order[s.cur], { type: "play", card: s.hands[s.cur][0] });
  const seat = s.cur;
  const ok = G.legalCards(s, seat);
  const bad = s.hands[seat].find((c) => !ok.includes(c));
  if (bad) assert.throws(() => apply(G, s, s.order[seat], { type: "play", card: bad }), /fournir|couper|monter|surcouper/);
  assert.throws(() => apply(G, s, s.order[(seat + 1) % 4], { type: "play", card: s.hands[(seat + 1) % 4][0] }), /tour/);
});

test("robots : prennent avec la manille, défaussent petit", () => {
  const a = botCard(RULES, { hand: ["10S", "7S", "8D"], trick: [{ p: 0, c: "AS" }], trump: "H", me: 1, seen: [], level: 2, rng: R0 });
  assert.equal(a, "10S");
  const b = botCard(RULES, { hand: ["KD", "7C"], trick: [{ p: 0, c: "10S" }], trump: null, me: 1, seen: [], level: 2, rng: R0 });
  assert.equal(b, "7C");
  assert.ok(G.trumpStrength(["10H", "AH", "KH", "QH", "10S", "7C", "8D", "9D"], "H") > G.trumpStrength(["10H", "AH", "KH", "QH", "10S", "7C", "8D", "9D"], "C"));
});

test("table complétée par des robots internes", () => {
  for (const n of [1, 2, 3]) {
    const { st } = playout(G, n, 3 + n);
    assert.equal(st.virt.length, 4 - n);
    assert.equal(st.result.ranking.length, n);
  }
});

test("parties complètes pour chaque mode", () => {
  for (const m of G.modes) for (let seed = 1; seed <= 4; seed++) {
    const { st } = playout(G, 4, seed, { settings: { ...m.set, level: 1 + (seed % 3) } });
    assert.ok(Math.max(...st.scores) >= m.set.target);
    const w = st.result.ranking.filter((r) => r.rank === 1).map((r) => teamOf(st.order.indexOf(r.id)));
    assert.deepEqual(w, [st.winner, st.winner]);
    assert.ok(JSON.stringify(st).length < 30000);
  }
  timeoutPlayout(G, 4, 3, { turnTime: 10 });
  timeoutPlayout(G, 4, 4, { ...G.modes[2].set, turnTime: 10 });
});

test("options et modes bien formés", () => {
  const defaults = Object.fromEntries(G.options.map((o) => [o.key, o.def]));
  assert.ok(G.options.length >= 2 && G.options.length <= 5);
  for (const o of G.options) {
    assert.ok(o.label.length <= 12);
    assert.ok(o.values.some((v) => v[0] === o.def), o.key);
    for (const v of o.values) { assert.ok(v[1].length <= 12); if (v[2]) assert.ok(v[2].length <= 18, v[2]); }
    assert.ok(!["level", "turnTime", "mode"].includes(o.key));
  }
  assert.ok(G.modes.length >= 3 && G.modes.length <= 4);
  assert.equal(G.modes[0].name, "Classique");
  assert.deepEqual(G.modes[0].set, defaults);
  assert.equal(new Set(G.modes.map((m) => JSON.stringify(m.set))).size, G.modes.length);
  for (const m of G.modes) for (const [k, v] of Object.entries(m.set)) assert.ok(G.options.find((o) => o.key === k).values.some((x) => x[0] === v));
  const s = start(G, P4, { target: 7, climb: "?", trump: "x" }, 1, 0);
  assert.equal(s.target, 34); assert.equal(s.climb, true); assert.equal(s.trumpMode, "tire");
  assert.ok(!JSON.stringify([G.meta, G.options, G.modes]).includes(String.fromCharCode(0x2014)));
});

test("résultat : équipes sans les robots internes", () => {
  for (const n of [4, 3, 2, 1]) {
    const { st } = playout(G, n, 20 + n);
    const { ranking, teams } = st.result;
    const ids = ranking.map((r) => r.id).sort();
    assert.deepEqual(teams.flat().sort(), ids);
    for (const t of teams) {
      assert.ok(t.length >= 1 && t.length <= 2);
      assert.equal(new Set(t.map((id) => teamOf(st.order.indexOf(id)))).size, 1);
      assert.equal(new Set(t.map((id) => ranking.find((r) => r.id === id).rank)).size, 1);
    }
    if (n === 4) assert.equal(teams.length, 2);
    assert.ok(teams.flat().every((id) => !st.virt.includes(id)));
  }
});
