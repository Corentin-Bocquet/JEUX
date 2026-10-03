import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/blackjack.js";
import { start, apply } from "../js/engine.js";
import { playout, timeoutPlayout } from "./harness.mjs";

test("valeur des mains", () => {
  assert.deepEqual(G.value(["AS", "KD"]), { total: 21, soft: true });
  assert.deepEqual(G.value(["AS", "AD", "9C"]), { total: 21, soft: true });
  assert.deepEqual(G.value(["AS", "5D", "9C"]), { total: 15, soft: false });
  assert.equal(G.value(["KS", "QD", "2C"]).total, 22);
  assert.ok(G.isBJ(["AS", "10H"]));
  assert.ok(!G.isBJ(["AS", "5H", "5C"]));
});

function rigged(s, shoeTop) { s.shoe = shoeTop.slice().reverse(); return s; }

test("mises, gains, blackjack 3 pour 2, banque qui tire jusqu'à 17", () => {
  let s = start(G, [{ id: "a" }, { id: "b" }], { rounds: 2 }, 1, 0);
  // seed 9 : la donne aléatoire ne finit pas la manche d'emblée (vérifié plus bas)
  assert.throws(() => apply(G, s, "a", { type: "bet", amount: 5 }), /invalide/);
  assert.throws(() => apply(G, s, "a", { type: "bet", amount: 15 }), /invalide/);
  s = apply(G, s, "a", { type: "bet", amount: 100 });
  assert.equal(s.phase, "bet");
  s = apply(G, s, "b", { type: "bet", amount: 200, seed: 9 });
  assert.equal(s.phase, "play");
  // on remplace la donne par une donne connue
  s.hands = { a: ["AS", "KD"], b: ["10S", "6D"] }; s.dealer = ["9C", "7H"]; s.done = { a: true }; s.cur = 1;
  s = rigged(s, ["5C", "4H"]);
  s = apply(G, s, "b", { type: "hit" }); // 21 → fini automatiquement
  // banque : 16 → tire 4 → 20
  assert.equal(s.manche, 2);
  assert.equal(s.last.dealerTotal, 20);
  assert.equal(s.chips.a, 1150); // blackjack 3 pour 2
  assert.equal(s.chips.b, 1200);
});

test("doubler, sauter, fin après la dernière manche", () => {
  let s = start(G, [{ id: "a" }], { rounds: 1 }, 2, 0);
  s = apply(G, s, "a", { type: "bet", amount: 100, seed: 3 });
  Object.assign(s, { result: undefined, phase: "play", manche: 1, chips: { a: 1000 }, bets: { a: 100 }, doubled: {} });
  s.hands = { a: ["5S", "6D"] }; s.dealer = ["10C", "8H"]; s.done = {}; s.cur = 0;
  s = rigged(s, ["10H"]);
  s = apply(G, s, "a", { type: "double" });
  assert.equal(s.chips.a, 1200);
  assert.equal(s.phase, "over");
  assert.equal(s.result.ranking[0].rank, 1);
  let t = start(G, [{ id: "a" }], { rounds: 1 }, 2, 0);
  t = apply(G, t, "a", { type: "bet", amount: 100, seed: 3 });
  Object.assign(t, { result: undefined, phase: "play", manche: 1, chips: { a: 1000 }, bets: { a: 100 }, doubled: {} });
  t.hands = { a: ["KS", "6D"] }; t.dealer = ["10C", "8H"]; t.done = {}; t.cur = 0;
  t = rigged(t, ["10H"]);
  t = apply(G, t, "a", { type: "hit" });
  assert.equal(t.chips.a, 900); // sauté
});

test("parties complètes 1 à 5 joueurs", () => {
  for (let seed = 1; seed <= 50; seed++) {
    const { st } = playout(G, 1 + (seed % 5), seed, { settings: { rounds: 6 } });
    for (const id of st.order) assert.ok(st.chips[id] >= 0);
  }
  timeoutPlayout(G, 3, 5, { turnTime: 10, rounds: 3 });
});

// ------------------------------------------------ options et modes
function checkShape(G, legacy) {
  const keys = G.options.map((o) => o.key);
  assert.ok(keys.length >= 2 && keys.length <= 5);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(!keys.includes("level") && !keys.includes("turnTime"));
  for (const k of legacy) assert.ok(keys.includes(k), "réglage existant conservé : " + k);
  for (const o of G.options) {
    assert.ok(o.label && o.icon);
    assert.ok(o.values.some((v) => v[0] === o.def), o.key + " : def dans values");
    for (const v of o.values) {
      assert.ok(["number", "string", "boolean"].includes(typeof v[0]));
      assert.ok(v[1].length <= 12, "libellé trop long : " + v[1]);
      assert.ok(v[2] == null || v[2].length <= 18, "indication trop longue : " + v[2]);
    }
  }
  assert.ok(G.modes.length >= 3 && G.modes.length <= 4);
  assert.equal(G.modes[0].name, "Classique");
  const defs = Object.fromEntries(G.options.map((o) => [o.key, o.def]));
  assert.deepEqual(G.modes[0].set, defs, "le mode classique = défauts");
  for (const m of G.modes) {
    assert.ok(m.id && m.name && m.emoji && m.desc);
    for (const [k, v] of Object.entries(m.set)) {
      const o = G.options.find((x) => x.key === k);
      assert.ok(o, m.id + " : clé inconnue " + k);
      assert.ok(o.values.some((x) => x[0] === v), m.id + " : valeur hors liste pour " + k);
    }
  }
  const src = JSON.stringify([G.options, G.modes, G.meta]);
  assert.ok(!src.includes(String.fromCharCode(0x2014)), "pas de tiret cadratin");
}

test("options et modes bien formés", () => checkShape(G, ["rounds"]));

test("chaque mode se joue jusqu'au bout, 1 et 5 joueurs", () => {
  G.modes.forEach((m, k) => {
    for (const n of [1, 5]) {
      const cap = m.set.maxBet || Infinity;
      const { st } = playout(G, n, 500 + k * 10 + n, { settings: m.set,
        onStep(s) { for (const id of s.order) if (s.phase === "bet" && s.bets[id] > 0) assert.ok(s.bets[id] <= cap, "mise max respectée"); } });
      assert.ok(st.manche - 1 <= m.set.rounds);
    }
  });
});

test("taille du sabot, sabot conservé entre les manches", () => {
  for (const decks of [1, 2, 6, 8]) {
    let s = start(G, [{ id: "a" }], { decks }, 1, 0);
    s = apply(G, s, "a", { type: "bet", amount: 50, seed: 4 });
    const out = s.phase === "play" ? s.hands.a.length + s.dealer.length : s.last.hands.a.length + s.last.dealer.length;
    assert.equal(s.shoe.length + out, 52 * decks);
  }
  let s = start(G, [{ id: "a" }], { decks: 8, rounds: 5 }, 1, 0);
  let guard = 0;
  while (s.manche < 3 && guard++ < 50) s = apply(G, s, "a", { ...G.bot(s, "a"), seed: 9 + guard });
  assert.equal(s.shuffles, 1, "un sabot de 8 jeux n'est pas remélangé dès la 2e manche");
  assert.ok(s.shoe.length < 52 * 8 - 4);
  // avec un seul jeu, le sabot finit par être remélangé
  const { st } = playout(G, 5, 3, { settings: { decks: 1, rounds: 12 } });
  assert.ok(st.shuffles > 1);
});

test("jetons de départ et mise maximale", () => {
  const s = start(G, [{ id: "a" }, { id: "b" }], { chips: 500, maxBet: 100 }, 1, 0);
  assert.equal(s.chips.a, 500);
  assert.throws(() => apply(G, s, "a", { type: "bet", amount: 150 }), /invalide/);
  apply(G, s, "a", { type: "bet", amount: 100 });
  const t = start(G, [{ id: "a" }, { id: "b" }], { chips: 2000, maxBet: 0 }, 1, 0);
  const t2 = apply(G, t, "a", { type: "bet", amount: 1500 });
  assert.equal(t2.bets.a, 1500);
  assert.throws(() => apply(G, t, "a", { type: "bet", amount: 2010 }), /invalide/);
  // anciennes parties : sans champ, mise max 500 et 6 jeux
  const old = start(G, [{ id: "a" }], { maxBet: "n'importe" }, 1, 0);
  assert.equal(G.maxBetOf(old), 500);
  delete old.maxBet; delete old.decks;
  assert.equal(G.maxBetOf(old), 500);
  const dealt = apply(G, old, "a", { type: "bet", amount: 50, seed: 2 });
  assert.ok(dealt.shoe.length > 52 * 5);
});
