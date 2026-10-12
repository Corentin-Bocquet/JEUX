import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/tarot.js";
import { start, apply } from "../js/engine.js";
import { playout, timeoutPlayout } from "./harness.mjs";

const P = (n) => Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "J" + i }));

test("paquet de 78 cartes, 91 points, donne et chien selon le nombre", () => {
  const d = G.deck78();
  assert.equal(d.length, 78);
  assert.equal(new Set(d).size, 78);
  assert.equal(G.sumHalf(d), 182);
  assert.equal(d.filter(G.isOudler).length, 3);
  for (const [n, h, c] of [[3, 24, 6], [4, 18, 6], [5, 15, 3]]) {
    const s = start(G, P(n), {}, n, 0);
    assert.ok(Object.values(s.hands).every((x) => x.length === h));
    assert.equal(s.chien.length, c);
    const all = [...Object.values(s.hands).flat(), ...s.chien];
    assert.equal(new Set(all).size, 78);
    assert.ok(Object.values(s.hands).every((x) => !(x.includes("T1") && !x.includes("EX") && x.filter(G.isTrump).length === 1)), "pas de petit sec");
  }
});

// état de jeu fixé à la main
function playState(n, hands, extra = {}) {
  const s = start(G, P(n), {}, 1, 0);
  s.order = Object.keys(hands); s.hands = hands; s.won = Object.fromEntries(s.order.map((id) => [id, []]));
  Object.assign(s, { phase: "play", cur: 0, trick: [], tricksDone: 1, taker: s.order[0], bid: 2 }, extra);
  return s;
}

test("fournir, couper, monter à l'atout, excuse", () => {
  const s = playState(3, { a: ["5H", "T3"], b: ["7H", "T10", "EX"], c: ["T2", "T15", "1S"] });
  let t = apply(G, s, "a", { type: "play", card: "5H" });
  assert.throws(() => apply(G, t, "b", { type: "play", card: "T10" }), /fournir/);
  assert.deepEqual(G.legal(t, "b").sort(), ["7H", "EX"].sort());
  t = apply(G, t, "b", { type: "play", card: "EX" });
  // c n'a pas de cœur : doit couper
  assert.throws(() => apply(G, t, "c", { type: "play", card: "1S" }), /couper/);
  t = apply(G, t, "c", { type: "play", card: "T2" });
  // c gagne, b garde l'excuse dans ses plis
  assert.equal(t.lastTrick.win, "c");
  assert.deepEqual(t.won.b, ["EX"]);
  assert.deepEqual(t.excuse, { owner: "b", to: "c" });
  // monter : atout 10 demandé, il faut jouer plus haut que 10 si possible
  const u = playState(3, { a: ["T10", "2S"], b: ["T5", "T12", "3S"], c: ["T4", "4S"] });
  const v = apply(G, u, "a", { type: "play", card: "T10" });
  assert.deepEqual(G.legal(v, "b"), ["T12"]);
  assert.throws(() => apply(G, v, "b", { type: "play", card: "T5" }), /monter/);
  const w = apply(G, v, "b", { type: "play", card: "T12" });
  assert.deepEqual(G.legal(w, "c"), ["T4"], "pisser quand on ne peut pas monter");
});

test("enchères : il faut monter, chacun parle une fois, petite interdite en option", () => {
  let s = start(G, P(4), {}, 3, 0);
  const [a, b, c, d] = [0, 1, 2, 3].map((k) => s.order[(s.dealer + 1 + k) % 4]);
  s = apply(G, s, a, { type: "bid", bid: 2 });
  assert.throws(() => apply(G, s, b, { type: "bid", bid: 1 }), /monter/);
  s = apply(G, s, b, { type: "bid", bid: 0 });
  s = apply(G, s, c, { type: "bid", bid: 3 });
  s = apply(G, s, d, { type: "bid", bid: 0 });
  assert.equal(s.taker, c);
  assert.equal(s.bid, 3);
  assert.equal(s.phase, "play", "garde sans : pas d'écart");
  assert.equal(s.chienSide, "att");
  const q = start(G, P(3), { petite: false }, 3, 0);
  assert.throws(() => apply(G, q, G.toAct(q)[0], { type: "bid", bid: 1 }), /interdite/);
});

test("tout le monde passe : on redonne", () => {
  let s = start(G, P(3), {}, 4, 0);
  const d0 = s.dealer;
  for (let k = 0; k < 3; k++) s = apply(G, s, G.toAct(s)[0], { type: "bid", bid: 0, seed: 9 });
  assert.equal(s.phase, "bid");
  assert.equal(s.donne, 1);
  assert.equal(s.dealer, (d0 + 1) % 3);
});

test("écart : ni roi ni bout, atout seulement en dernier recours", () => {
  let s = start(G, P(4), {}, 5, 0);
  const first = G.toAct(s)[0];
  s = apply(G, s, first, { type: "bid", bid: 2 });
  for (let k = 0; k < 3; k++) s = apply(G, s, G.toAct(s)[0], { type: "bid", bid: 0 });
  assert.equal(s.phase, "chien");
  assert.equal(s.hands[first].length, 24);
  const hand = s.hands[first];
  const plain = hand.filter((c) => !G.isTrump(c) && !G.isExcuse(c) && !G.isKing(c));
  const king = hand.find(G.isKing);
  if (king) assert.throws(() => apply(G, s, first, { type: "discard", cards: [king, ...plain.slice(0, 5)] }), /roi/);
  const tr = hand.find((c) => G.isTrump(c) && !G.isOudler(c));
  if (tr && plain.length >= 6) assert.throws(() => apply(G, s, first, { type: "discard", cards: [tr, ...plain.slice(0, 5)] }), /atout/);
  assert.throws(() => apply(G, s, first, { type: "discard", cards: plain.slice(0, 5) }), /exactement/);
  const t = apply(G, s, first, { type: "discard", cards: G.botDiscard(s, first).cards });
  assert.equal(t.hands[first].length, 18);
  assert.equal(t.phase, "play");
  assert.equal(t.chienPile.length, 6);
});

test("appel au roi à 5 et entame interdite dans la couleur appelée", () => {
  let s = start(G, P(5), {}, 6, 0);
  const first = G.toAct(s)[0];
  s = apply(G, s, first, { type: "bid", bid: 3 });
  for (let k = 0; k < 4; k++) s = apply(G, s, G.toAct(s)[0], { type: "bid", bid: 0 });
  assert.equal(s.phase, "call");
  assert.throws(() => apply(G, s, first, { type: "call", card: "13H" }), /roi/);
  const king = G.callable(s).find((c) => !s.hands[first].includes(c));
  s = apply(G, s, first, { type: "call", card: king });
  const owner = s.order.find((id) => s.hands[id].includes(king));
  assert.equal(s.partner, owner || null);
  assert.equal(s.phase, "play");
  const leader = G.toAct(s)[0];
  const su = G.suitOf(king);
  const bad = s.hands[leader].find((c) => G.suitOf(c) === su && c !== king);
  const other = s.hands[leader].some((c) => G.suitOf(c) !== su);
  if (bad && other) assert.throws(() => apply(G, s, leader, { type: "play", card: bad }), /appelée/);
  const r = G.result(playout(G, 5, 61).st);
  assert.equal(r.ranking.length, 5);
});

test("calcul de la marque", () => {
  // garde à 4, 2 bouts, 45 points : contrat 41, gagné de 4 → (25 + 4) x 2 = 58, preneur +174
  let r = G.computeScore({ n: 4, bid: 2, attHalf: 90, oudlers: 2, pab: null, poign: 0 });
  assert.equal(r.v, 58); assert.equal(r.takerShare, 3); assert.ok(r.won);
  // petite, 0 bout, 55,5 points : chute de 0,5 arrondie à 1 → -(26) ; petit au bout pour la défense -10
  r = G.computeScore({ n: 3, bid: 1, attHalf: 111, oudlers: 0, pab: "def", poign: 0 });
  assert.equal(r.v, -36); assert.equal(r.takerShare, 2);
  // garde contre, 3 bouts, 36 pile, poignée simple : 25 x 6 + 20 = 170
  r = G.computeScore({ n: 5, bid: 4, attHalf: 72, oudlers: 3, pab: null, poign: 20, partner: "x" });
  assert.equal(r.v, 170); assert.equal(r.takerShare, 2);
  // seul à 5 : 4 parts
  r = G.computeScore({ n: 5, bid: 2, attHalf: 112, oudlers: 1, pab: "att", poign: 0, partner: null });
  assert.equal(r.v, (25 + 5 + 10) * 2); assert.equal(r.takerShare, 4);
});

test("fin de donne : la somme des scores est nulle, le petit au bout est noté", () => {
  for (const n of [3, 4, 5]) {
    const { st } = playout(G, n, 40 + n, {
      onStep: (x) => { if (x.last) assert.equal(Object.values(x.scores).reduce((a, b) => a + b, 0), 0); },
    });
    assert.ok(st.last.need >= 36);
  }
});

test("poignée : annonce vérifiée et prime au camp gagnant", () => {
  const trumps = ["T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11"];
  const s = playState(4, { a: [...trumps, "3S"], b: ["4S", "T12"], c: ["5S"], d: ["6S"] }, { tricksDone: 0 });
  assert.equal(G.poigneeMax(s, s.hands.a), 1);
  assert.throws(() => apply(G, s, "a", { type: "play", card: "3S", poignee: 2 }), /Pas assez/);
  const t = apply(G, s, "a", { type: "play", card: "3S", poignee: 1 });
  assert.equal(t.annonces.length, 1);
  assert.equal(t.annonces[0].cards.length, 10);
  assert.throws(() => apply(G, t, "b", { type: "play", card: "4S", poignee: 1 }), /poignée/);
  const off = playState(4, { a: [...trumps, "3S"], b: ["4S"], c: ["5S"], d: ["6S"] }, { tricksDone: 0, poignees: false });
  assert.equal(G.poigneeMax(off, off.hands.a), 0);
});

test("parties complètes de 3 à 5 joueurs, chaque mode, délais", () => {
  for (let seed = 1; seed <= 12; seed++) playout(G, 3 + (seed % 3), seed, { settings: { level: 1 + (seed % 3) } });
  G.modes.forEach((m, k) => {
    for (const n of [3, 5]) {
      const { st } = playout(G, n, 300 + k * 10 + n, { settings: m.set });
      assert.equal(st.donne, m.set.donnes || n);
    }
  });
  timeoutPlayout(G, 4, 3);
});

test("robots : écart légal, enchère selon la force", () => {
  const strong = ["T21", "T1", "EX", "T20", "T19", "T18", "T17", "T16", "T15", "T14", "14S", "14H", "14C", "14D", "13S", "12S", "11S", "10S"];
  const weak = ["2S", "3S", "4S", "5H", "6H", "7H", "2C", "3C", "4C", "5D", "6D", "7D", "8D", "T2", "T3", "9S", "8H", "8C"];
  assert.ok(G.strength(strong, 4) >= G.BID_STEPS[3]);
  assert.ok(G.strength(weak, 4) < G.BID_STEPS[0]);
  for (let seed = 1; seed <= 20; seed++) {
    let s = start(G, P(4), {}, seed, 0);
    const first = G.toAct(s)[0];
    s = apply(G, s, first, { type: "bid", bid: 1 });
    for (let k = 0; k < 3; k++) s = apply(G, s, G.toAct(s)[0], { type: "bid", bid: 0 });
    const a = G.bot(s, first, { next: () => 0.5, int: () => 0 });
    assert.ok(a.cards.every((c) => !G.isKing(c) && !G.isOudler(c)));
    assert.ok(a.cards.every((c) => !G.isTrump(c)));
  }
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
  const src = JSON.stringify([G.options, G.modes, G.meta]);
  assert.ok(!src.includes(String.fromCharCode(0x2014)));
  // valeur invalide : défaut
  assert.equal(start(G, P(3), { donnes: 99 }, 1, 0).total, 3);
});
