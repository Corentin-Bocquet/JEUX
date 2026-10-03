import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/poker.js";
import { start, apply } from "../js/engine.js";
import { playout, timeoutPlayout } from "./harness.mjs";

const E = (cs) => G.evaluate(cs.split(" "));
const name = (cs) => G.handName(E(cs));

test("évaluation des mains", () => {
  assert.equal(name("AS KS QS JS 10S 2D 3C"), "Quinte flush");
  assert.equal(name("AS 2S 3S 4S 5S 9D 9C"), "Quinte flush");
  assert.equal(name("9S 9H 9D 9C 2S 3D 4C"), "Carré");
  assert.equal(name("9S 9H 9D 2C 2S 3D 4C"), "Full");
  assert.equal(name("9S 9H 9D 2C 2S 2D 4C"), "Full");
  assert.equal(name("AS 9S 3S 4S 7S 9D 9C"), "Couleur");
  assert.equal(name("AD 2S 3C 4S 5H 9D KC"), "Quinte");
  assert.equal(name("10D JS QC KS AH 2D 2C"), "Quinte");
  assert.equal(name("9S 9H 9D 2C 5S KD 4C"), "Brelan");
  assert.equal(name("9S 9H 2D 2C 5S KD 4C"), "Double paire");
  assert.equal(name("9S 9H 3D 2C 5S KD 4C"), "Paire");
  assert.equal(name("9S 6H 3D 2C 5S KD 4C"), "Quinte");
  assert.equal(name("9S 9H 3D 2C 7S KD JC"), "Paire");
  assert.equal(name("AS 9H 3D 2C 7S KD JC"), "Carte haute");
  // départages
  assert.ok(E("AS AH KD 7C 5S 3D 2C") > E("AS AH QD JC 5S 3D 2C"));
  assert.ok(E("KS KH QD QC 2S 3D 4C") > E("KS KH JD JC AS 3D 4C"));
  assert.equal(E("AS AH KD QC JS 3D 2C"), E("AD AC KH QS JD 4D 2H"));
  assert.ok(E("6S 2H 3D 4C 5S KD KC") > E("AS 2H 3D 4C 5S KD KC"));
  assert.ok(E("AS 9S 3S 4S 7S") > E("KS QS JS 9S 7S"));
  assert.ok(E("9S 9H 9D 8C 8S AD AC") > E("8S 8H 8D AC AS KD KC"));
});

test("pots annexes", () => {
  const h = { inHand: ["a", "b", "c"], folded: { c: false }, contrib: { a: 100, b: 300, c: 300 } };
  assert.deepEqual(G.buildPots(h), [{ amount: 300, elig: ["a", "b", "c"] }, { amount: 400, elig: ["b", "c"] }]);
  const h2 = { inHand: ["a", "b", "c"], folded: { c: true }, contrib: { a: 100, b: 300, c: 200 } };
  assert.deepEqual(G.buildPots(h2), [{ amount: 300, elig: ["a", "b"] }, { amount: 300, elig: ["b"] }]);
});

function fresh(n, chips) {
  const P = Array.from({ length: n }, (_, i) => ({ id: "p" + i }));
  return start(G, P, { chips: chips || 1000, hands: 50 }, 7, 0);
}
const cur = (s) => G.toAct(s)[0];

test("ordre des paroles en tête à tête et option du gros blind", () => {
  let s = fresh(2);
  const h = s.hand;
  const dealer = s.order[s.dealer];
  assert.equal(h.sbId, dealer, "en tête à tête le donneur paie la petite blind");
  assert.equal(cur(s), dealer, "et parle en premier avant le flop");
  s = apply(G, s, dealer, { type: "call" });
  assert.equal(cur(s), h.bbId, "le gros blind a l'option");
  assert.ok(G.legal(s, h.bbId).check);
  s = apply(G, s, h.bbId, { type: "check" });
  assert.equal(s.hand.board.length, 3);
  assert.equal(cur(s), h.bbId, "après le flop, le non donneur parle en premier");
});

test("relance minimale, relance incomplète qui ne rouvre pas", () => {
  let s = fresh(3);
  const first = cur(s);
  assert.throws(() => apply(G, s, first, { type: "raise", to: 30 }), /minimale/);
  s = apply(G, s, first, { type: "raise", to: 60 }); // relance de 40
  const second = cur(s);
  assert.throws(() => apply(G, s, second, { type: "raise", to: 90 }), /minimale : 100/);
  // on met le 3e joueur court en jetons pour une relance incomplète
  let t = fresh(3);
  const A = cur(t);
  t = apply(G, t, A, { type: "raise", to: 100 }); // relance de 80
  const B = cur(t);
  t = apply(G, t, B, { type: "call" });
  const C = cur(t);
  t.chips[C] = 140 - t.hand.bet[C]; // C peut monter à 140 au total : relance incomplète (40 < 80)
  t = apply(G, t, C, { type: "raise", to: 140 });
  assert.ok(t.hand.allin[C]);
  assert.equal(cur(t), A);
  const L = G.legal(t, A);
  assert.equal(L.canRaise, false, "A a déjà parlé : la relance incomplète ne lui rouvre pas les enchères");
  assert.throws(() => apply(G, t, A, { type: "raise", to: 400 }), /plus relancer/);
});

test("tapis et partage : les jetons sont conservés", () => {
  for (let seed = 1; seed <= 25; seed++) {
    const n = 2 + (seed % 7);
    const { st } = playout(G, n, seed, {
      settings: { hands: 12 },
      onStep(s) {
        const inPots = s.hand ? Object.values(s.hand.contrib).reduce((a, b) => a + b, 0) : 0;
        const total = Object.values(s.chips).reduce((a, b) => a + b, 0) + inPots;
        assert.equal(total, n * 1000, "aucun jeton ne doit apparaître ou disparaître");
      },
    });
    const ranks = st.result.ranking.map((r) => r.rank);
    assert.equal(ranks[0], 1);
  }
});

test("jusqu'au dernier survivant et délais", () => {
  const { st } = playout(G, 3, 99, { settings: { hands: 400, chips: 300 } });
  assert.ok(st.result.ranking.length === 3);
  timeoutPlayout(G, 4, 4, { turnTime: 10, hands: 5 });
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

test("options et modes bien formés", () => checkShape(G, ["hands", "chips"]));

test("chaque mode se joue jusqu'au bout, 2 et 8 joueurs", () => {
  G.modes.forEach((m, k) => {
    for (const n of [2, 8]) {
      const { st } = playout(G, n, 300 + k * 10 + n, { settings: m.set });
      assert.ok(st.handNo <= m.set.hands);
    }
  });
});

test("blinds de départ, montée et blinds fixes", () => {
  const P = Array.from({ length: 4 }, (_, i) => ({ id: "p" + i }));
  assert.deepEqual([start(G, P, { blind: 50 }, 1, 0).sb, start(G, P, { blind: 50 }, 1, 0).bb], [25, 50]);
  assert.deepEqual([start(G, P, { blind: 10 }, 1, 0).sb, start(G, P, { blind: 10 }, 1, 0).bb], [5, 10]);
  // valeurs invalides : retour aux défauts
  const bad = start(G, P, { blind: 37, blindUp: "vite", chips: "beaucoup" }, 1, 0);
  assert.equal(bad.bb, 20); assert.equal(bad.blindUp, 6);
  assert.equal(Object.values(bad.chips).reduce((a, b) => a + b, 0) + G.potTotal(bad), 4000);
  const blindsAt = (blindUp) => {
    const seen = {};
    playout(G, 4, 77, { settings: { hands: 10, chips: 2000, blindUp }, onStep(s) { if (!s.over) seen[s.handNo] = s.bb; } });
    return seen;
  };
  const fixed = blindsAt(0);
  assert.ok(Object.keys(fixed).length >= 7);
  assert.ok(Object.values(fixed).every((bb) => bb === 20), "blinds fixes");
  const turbo = blindsAt(3);
  assert.equal(turbo[3], 20); assert.equal(turbo[4], 40); assert.equal(turbo[7], 60);
  const std = blindsAt(6);
  assert.equal(std[6], 20); assert.equal(std[7], 40);
});
