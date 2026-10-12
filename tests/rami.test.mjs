import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/rami.js";
import { start, apply } from "../js/engine.js";
import { playout, timeoutPlayout } from "./harness.mjs";

const P2 = [{ id: "a" }, { id: "b" }];
const P3 = [{ id: "a" }, { id: "b" }, { id: "c" }];

// état fixé : a joue, phase de pose
function fixed(settings, hands, extra = {}) {
  const s = start(G, Object.keys(hands).map((id) => ({ id })), settings, 1, 0);
  s.order = Object.keys(hands); s.hands = hands; s.cur = 0; s.phase = "play"; s.took = null;
  s.melds = []; s.opened = Object.fromEntries(s.order.map((id) => [id, false]));
  s.scores = Object.fromEntries(s.order.map((id) => [id, 0]));
  return Object.assign(s, extra);
}

test("analyse des combinaisons", () => {
  assert.equal(G.analyze(["7H", "7S", "7D"]).t, "set");
  assert.equal(G.analyze(["7H", "7S", "7D", "7C"]).c.length, 4);
  assert.equal(G.analyze(["7H", "7H", "7D"]), null, "deux fois la même couleur");
  assert.equal(G.analyze(["7H", "7S"]), null, "trop court");
  assert.equal(G.analyze(["5H", "6H", "7H"]).lo, 5);
  assert.equal(G.analyze(["5H", "6H", "7S"]), null, "couleurs mélangées");
  assert.equal(G.analyze(["5H", "7H", "8H"]), null, "trou sans joker");
  const j = G.analyze(["5H", "JK", "7H"]);
  assert.deepEqual(j.c, ["5H", "JK", "7H"]);
  assert.equal(G.analyze(["JK", "JK", "7H"]), null, "au moins 2 vraies cartes");
  // As bas ou haut, jamais entre les deux
  assert.equal(G.meldPoints(G.analyze(["AS", "2S", "3S"])), 6);
  assert.equal(G.meldPoints(G.analyze(["QS", "KS", "AS"])), 31);
  assert.equal(G.analyze(["KS", "AS", "2S"]), null);
  assert.equal(G.meldPoints(G.analyze(["AS", "AH", "AD"])), 33);
  // joker en bout : vaut la carte qu'il prolonge
  assert.equal(G.meldPoints(G.analyze(["QH", "KH", "JK"])), 31);
});

test("ouverture à 51 points, pose et défausse", () => {
  let s = fixed({}, { a: ["10H", "JH", "QH", "KH", "5S", "5D", "5C", "2C", "9D"], b: ["3S", "4S", "8C"] });
  assert.throws(() => apply(G, s, "a", { type: "meld", groups: [["5S", "5D", "5C"]] }), /51 points/);
  assert.throws(() => apply(G, s, "a", { type: "meld", groups: [["5S", "5D", "9D"]] }), /combinaison/);
  assert.throws(() => apply(G, s, "a", { type: "meld", groups: [["5S", "5D", "5H"]] }), /main/);
  assert.throws(() => apply(G, s, "b", { type: "discard", card: "3S" }), /tour/);
  s = apply(G, s, "a", { type: "meld", groups: [["10H", "JH", "QH", "KH"], ["5S", "5D", "5C"]] });
  assert.ok(s.opened.a);
  assert.equal(s.melds.length, 2);
  assert.deepEqual(s.hands.a, ["2C", "9D"]);
  s = apply(G, s, "a", { type: "discard", card: "9D" });
  assert.equal(G.toAct(s)[0], "b");
  assert.equal(s.phase, "draw");
  assert.throws(() => apply(G, s, "b", { type: "discard", card: "3S" }), /Pioche/);
  // b n'a pas ouvert : pas d'ajout
  s = apply(G, s, "b", { type: "draw", from: "discard" });
  assert.deepEqual(s.hands.b, ["3S", "4S", "8C", "9D"]);
  assert.throws(() => apply(G, s, "b", { type: "discard", card: "9D" }), /viens de prendre/);
  assert.throws(() => apply(G, s, "b", { type: "add", meld: 0, cards: ["9D"] }), /première pose/);
});

test("ajouter, remplacer un joker, finir et compter les points", () => {
  let s = fixed({}, { a: ["AH", "9H", "JK", "4H", "6S", "6C"], b: ["KS", "JK", "3D"] }, { opened: { a: true, b: false } });
  s.melds = [G.analyze(["5H", "JK", "7H"]), G.analyze(["6H", "6D", "JK"])];
  s.melds.forEach((m) => (m.o = "b"));
  // ajouts aux deux bouts
  s = apply(G, s, "a", { type: "add", meld: 0, cards: ["4H"] });
  assert.equal(s.melds[0].lo, 4);
  assert.throws(() => apply(G, s, "a", { type: "add", meld: 0, cards: ["9H"] }), /ne vont pas/);
  assert.throws(() => apply(G, s, "a", { type: "add", meld: 1, cards: ["6D"] }), /main/);
  // remplacer le joker du brelan par un 6 d'une couleur absente
  assert.throws(() => apply(G, s, "a", { type: "swap", meld: 0, card: "9H" }), /joker/);
  s = apply(G, s, "a", { type: "swap", meld: 1, card: "6S" });
  assert.deepEqual(s.melds[1].c, ["6H", "6D", "6S"]);
  assert.equal(s.hands.a.filter((c) => c === "JK").length, 2);
  // le carré se complète
  s = apply(G, s, "a", { type: "add", meld: 1, cards: ["6C"] });
  assert.throws(() => apply(G, s, "a", { type: "add", meld: 1, cards: ["JK"] }), /ne vont pas/);
  // deux jokers et 9H : la suite 4..7 devient 4..10 (joker au 8 et au 10)
  s = apply(G, s, "a", { type: "add", meld: 0, cards: ["JK", "JK", "9H"] });
  assert.equal(s.melds[0].c.length, 7);
  assert.deepEqual(s.hands.a, ["AH"]);
  s = apply(G, s, "a", { type: "discard", card: "AH" });
  assert.ok(s.result, "main vide : fin");
  assert.equal(s.result.ranking[0].id, "a");
  assert.deepEqual(s.result.ranking[1], { id: "b", rank: 2, score: 10 + 20 + 3 });
});

test("pioche épuisée : on remélange puis la manche s'arrête", () => {
  let s = fixed({}, { a: ["2C", "9D"], b: ["KS", "8C"] });
  s.stock = []; s.discard = ["3H", "4H", "5S"];
  s = apply(G, s, "a", { type: "discard", card: "9D", seed: 3 });
  assert.equal(s.reshuf, 1); assert.equal(s.discard.length, 1); assert.equal(s.stock.length, 3);
  s.reshuf = 3; s.stock = []; s.phase = "play";
  s = apply(G, s, "b", { type: "discard", card: "KS", seed: 4 });
  assert.ok(s.result);
});

test("délai dépassé : le joueur pioche et défausse", () => {
  const s = start(G, P3, {}, 5, 0);
  const id = G.toAct(s)[0];
  const t = apply(G, s, id, { type: "autoturn", seed: 1 });
  assert.equal(t.hands[id].length, s.hands[id].length);
  assert.notEqual(G.toAct(t)[0], id);
  timeoutPlayout(G, 2, 3, { turnTime: 20 });
  timeoutPlayout(G, 4, 9, { turnTime: 20, target: 100 });
});

test("donne : cartes, jokers et paquet", () => {
  for (const [cards, jokers, n] of [[13, 4, 4], [14, 2, 3], [13, 0, 2]]) {
    const s = start(G, Array.from({ length: n }, (_, i) => ({ id: "p" + i })), { cards, jokers }, 7, 0);
    for (const id of s.order) assert.equal(s.hands[id].length, cards);
    const all = [...Object.values(s.hands).flat(), ...s.stock, ...s.discard];
    assert.equal(all.length, 104 + jokers);
    assert.equal(all.filter(G.isJ).length, jokers);
    assert.ok(!G.isJ(s.discard[0]));
  }
  const s = start(G, P2, { cards: 99, open: "x", jokers: 7, target: -1 }, 1, 0);
  assert.equal(s.cards, 13); assert.equal(s.open, 51); assert.equal(s.jokers, 4); assert.equal(s.target, 0);
  assert.ok(JSON.stringify(s).length < 30000);
});

test("le robot trouve ses combinaisons", () => {
  const b = G.bestMelds(["5H", "6H", "7H", "8H", "KS", "KD", "KC", "2D", "JK", "9C"]);
  assert.equal(b.cards, 8);
  let s = fixed({}, { a: ["10H", "JH", "QH", "KH", "5S", "5D", "5C", "2C"], b: ["3S"] });
  const a = G.bot(s, "a", { next: () => 0.5, pick: (x) => x[0] });
  assert.equal(a.type, "meld");
  s = apply(G, s, "a", a);
  assert.ok(s.opened.a);
  // pas assez de points : il défausse
  const s2 = fixed({}, { a: ["2H", "3H", "4H", "9S", "KD"], b: ["3S"] });
  assert.equal(G.bot(s2, "a", { next: () => 0.5, pick: (x) => x[0] }).type, "discard");
});

test("parties complètes avec robots, 2 à 4 joueurs", () => {
  for (let seed = 1; seed <= 20; seed++) {
    playout(G, 2 + (seed % 3), seed, { settings: { level: 1 + (seed % 3) }, onStep(st) {
      for (const m of st.melds) assert.ok(m.c.length >= 3 && m.c.filter((c) => !G.isJ(c)).length >= 2, "combinaison valide");
      const n = Object.values(st.hands).flat().length + st.stock.length + st.discard.length + st.melds.reduce((t, m) => t + m.c.length, 0);
      assert.equal(n, 104 + st.jokers, "aucune carte perdue");
    } });
  }
});

function checkShape(G) {
  const keys = G.options.map((o) => o.key);
  assert.ok(keys.length >= 2 && keys.length <= 5);
  assert.ok(!keys.includes("level") && !keys.includes("turnTime") && !keys.includes("mode"));
  for (const o of G.options) {
    assert.ok(o.values.some((v) => v[0] === o.def));
    for (const v of o.values) { assert.ok(v[1].length <= 12, v[1]); assert.ok(v[2] == null || v[2].length <= 18, v[2]); }
  }
  assert.ok(G.modes.length >= 3 && G.modes.length <= 4);
  assert.equal(G.modes[0].name, "Classique");
  assert.deepEqual(G.modes[0].set, Object.fromEntries(G.options.map((o) => [o.key, o.def])));
  const combos = new Set(G.modes.map((m) => JSON.stringify(Object.fromEntries(keys.map((k) => [k, m.set[k]])))));
  assert.equal(combos.size, G.modes.length, "modes distincts");
  for (const m of G.modes) for (const [k, v] of Object.entries(m.set)) assert.ok(G.options.find((o) => o.key === k).values.some((x) => x[0] === v));
  assert.ok(!JSON.stringify([G.options, G.modes, G.meta]).includes(String.fromCharCode(0x2014)));
}
test("options et modes bien formés", () => checkShape(G));

test("chaque mode se joue jusqu'au bout, 2 et 4 joueurs", () => {
  G.modes.forEach((m, k) => {
    for (const n of [2, 4]) {
      const { st } = playout(G, n, 300 + k * 10 + n, { settings: m.set });
      if (m.set.target) assert.ok(st.order.some((id) => st.scores[id] >= m.set.target));
    }
  });
});
