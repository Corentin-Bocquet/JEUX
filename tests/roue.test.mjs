import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/roue.js";
import { PHRASES } from "../js/data/roue_phrases.js";
import { start, apply } from "../js/engine.js";
import { playout, timeoutPlayout } from "./harness.mjs";

const P = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
// partie sur une énigme choisie, roue forcée par la graine
function fixed(text, settings = {}) {
  const s = start(G, P, settings, 1, 0);
  s.order = ["a", "b"]; s.cur = 0; s.text = text; s.cat = "Proverbe"; s.called = "";
  return s;
}
// graine qui fait tomber la roue sur une valeur donnée
function seedFor(s, want) {
  const W = G.wheelOf(s);
  for (let seed = 1; seed < 100000; seed++) {
    const t = apply(G, s, s.order[s.cur], { type: "spin", seed });
    if (W[t.seg] === want) return seed;
  }
  throw new Error("pas de graine");
}

test("banque : au moins 300 énigmes, sans doublon ni caractère interdit", () => {
  assert.ok(PHRASES.length >= 300);
  const seen = new Set();
  for (const [cat, t] of PHRASES) {
    assert.ok(cat && t, t);
    const k = G.normText(t);
    assert.ok(!seen.has(k), "doublon " + t); seen.add(k);
    assert.ok(!/[œŒæÆ—]/.test(t), t);
    assert.ok(t.length <= 60, t);
    assert.ok(k.length >= 5, t);
  }
  for (const th of ["tout", "dictons", "culture"]) assert.ok(G.pool(th).length >= 100, th);
});

test("consonne : montant x occurrences, on rejoue ; absente : main suivante", () => {
  let s = fixed("Qui dort dîne");
  s = apply(G, s, "a", { type: "spin", seed: seedFor(s, 500) });
  assert.equal(s.phase, "letter");
  assert.throws(() => apply(G, s, "a", { type: "letter", l: "A" }), /consonne/);
  assert.throws(() => apply(G, s, "a", { type: "spin", seed: 3 }), /consonne/);
  s = apply(G, s, "a", { type: "letter", l: "D" });
  assert.equal(s.bank.a, 1000);
  assert.equal(s.cur, 0);
  s = apply(G, s, "a", { type: "spin", seed: seedFor(s, 200) });
  s = apply(G, s, "a", { type: "letter", l: "Z" });
  assert.equal(s.bank.a, 1000);
  assert.deepEqual(G.toAct(s), ["b"]);
  assert.throws(() => apply(G, s, "a", { type: "spin", seed: 1 }), /tour/);
});

test("banqueroute, passe et consonne déjà proposée", () => {
  let s = fixed("Qui dort dîne");
  s.bank.a = 700;
  s = apply(G, s, "a", { type: "spin", seed: seedFor(s, "B") });
  assert.equal(s.bank.a, 0);
  assert.equal(s.cur, 1);
  s = apply(G, s, "b", { type: "spin", seed: seedFor(s, "P") });
  assert.equal(s.cur, 0);
  s.called = "D";
  s = apply(G, s, "a", { type: "spin", seed: seedFor(s, 300) });
  s = apply(G, s, "a", { type: "letter", l: "D" });
  assert.equal(s.bank.a, 0);
  assert.equal(s.cur, 1);
});

test("voyelles : payées, accents ignorés, absente = main suivante", () => {
  let s = fixed("Qui dort dîne");
  assert.throws(() => apply(G, s, "a", { type: "vowel", l: "I" }), /cagnotte/);
  s.bank.a = 600;
  assert.throws(() => apply(G, s, "a", { type: "vowel", l: "T" }), /voyelle/);
  s = apply(G, s, "a", { type: "vowel", l: "I" });
  assert.equal(s.bank.a, 350);
  assert.equal(s.log.n, 2); // QUI et DÎNE
  assert.equal(s.cur, 0);
  assert.throws(() => apply(G, s, "a", { type: "vowel", l: "I" }), /déjà/);
  s = apply(G, s, "a", { type: "vowel", l: "A" });
  assert.equal(s.cur, 1);
  assert.equal(G.countOf("Été à l'école", "E"), 4);
});

test("résoudre : bonne réponse encaissée, mauvaise passe la main, manches et fin", () => {
  let s = fixed("Qui dort dîne", { rounds: 3 });
  s = apply(G, s, "a", { type: "solve", text: "qui dort dort" });
  assert.equal(s.cur, 1);
  s.bank.b = 1200; s.bank.a = 400;
  s = apply(G, s, "b", { type: "solve", text: "QUI DORT, DINE !" });
  assert.equal(s.total.b, 1200);
  assert.equal(s.manche, 2);
  assert.equal(s.bank.a, 0);
  assert.equal(s.last.text, "Qui dort dîne");
  assert.notEqual(s.text, "Qui dort dîne");
  // gain minimum
  s = apply(G, s, G.toAct(s)[0], { type: "solve", text: s.text });
  assert.equal(s.total[s.last.id] >= 300, true);
  s = apply(G, s, G.toAct(s)[0], { type: "solve", text: s.text });
  assert.ok(s.result);
});

test("plus de consonnes cachées : on ne tourne plus ; dernière lettre = manche gagnée", () => {
  let s = fixed("Qui dort dîne");
  s.called = "QDRTN";
  assert.throws(() => apply(G, s, "a", { type: "spin", seed: 1 }), /consonnes/);
  s.bank.a = 1000;
  s = apply(G, s, "a", { type: "vowel", l: "U" });
  s = apply(G, s, "a", { type: "vowel", l: "I" });
  s = apply(G, s, "a", { type: "vowel", l: "O" });
  s = apply(G, s, "a", { type: "vowel", l: "E" });
  assert.equal(s.manche, 2);
  assert.equal(s.total.a, 1000 - 4 * 250 > 300 ? 0 : 300);
});

test("robots : lettres fréquentes et résolution quand assez de lettres", () => {
  const s = fixed("Qui dort dîne", { level: 3 });
  s.phase = "letter"; s.seg = 0;
  assert.equal(G.bot(s, "a", { next: () => 0, int: () => 0 }).l, "S");
  s.phase = "spin"; s.called = "QDRTNUI";
  assert.deepEqual(G.bot(s, "a", { next: () => 0.9, int: () => 0 }), { type: "solve", text: "Qui dort dîne" });
});

test("parties complètes pour chaque mode, 2 et 4 joueurs, et délais", () => {
  G.modes.forEach((m, k) => {
    for (let seed = 1; seed <= 3; seed++) {
      playout(G, 2, seed + k * 10, { settings: { ...m.set, level: 1 + (seed % 3) } });
      playout(G, 4, seed + k * 20, { settings: { ...m.set, level: 1 + ((seed + 1) % 3) } });
    }
  });
  timeoutPlayout(G, 2, 9);
  timeoutPlayout(G, 4, 5, { ...G.modes[2].set, turnTime: 10 });
});

const optOf = (k) => G.options.find((o) => o.key === k);
test("options et modes bien formés", () => {
  assert.ok(G.options.length >= 2 && G.options.length <= 5);
  for (const o of G.options) {
    assert.ok(o.values.some((v) => v[0] === o.def), o.key);
    assert.ok(o.label.length <= 12);
    for (const v of o.values) { assert.ok(v[1].length <= 12); if (v[2]) assert.ok(v[2].length <= 18, v[2]); }
    assert.ok(!["level", "turnTime", "mode"].includes(o.key));
  }
  assert.ok(G.modes.length >= 3 && G.modes.length <= 4);
  assert.equal(G.modes[0].name, "Classique");
  assert.deepEqual(G.modes[0].set, Object.fromEntries(G.options.map((o) => [o.key, o.def])));
  assert.equal(new Set(G.modes.map((m) => JSON.stringify(m.set))).size, G.modes.length);
  for (const m of G.modes) for (const [k, v] of Object.entries(m.set)) assert.ok(optOf(k).values.some((x) => x[0] === v), `${m.id}.${k}`);
  for (const w of Object.values(G.WHEELS)) assert.equal(w.length, 24);
  const s = start(G, P, { rounds: 99, vowel: "x", wheel: "?", theme: 3 }, 1, 0);
  assert.deepEqual([s.rounds, s.vowel, s.wheel, s.theme], [4, 250, "classique", "tout"]);
});
