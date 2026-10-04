import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/motsor.js";
import { start, apply } from "../js/engine.js";
import { playout, timeoutPlayout } from "./harness.mjs";

const P = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
// partie avec chevalets choisis
function fixed(racks, settings = {}) {
  const s = start(G, P, settings, 1, 0);
  s.order = ["a", "b"]; s.cur = 0;
  s.racks = { a: racks[0], b: racks[1] };
  return s;
}
const at = (r, c) => r * 15 + c;

test("sac officiel : 102 jetons, valeurs françaises", () => {
  const bag = G.fullBag();
  assert.equal(bag.length, 102);
  assert.equal([...bag].filter((c) => c === "?").length, 2);
  assert.equal([...bag].filter((c) => c === "E").length, 15);
  assert.equal(G.VALUES.K + G.VALUES.W + G.VALUES.X + G.VALUES.Y + G.VALUES.Z, 50);
  assert.equal(G.VALUES.J, 8); assert.equal(G.VALUES.Q, 8);
  const s = start(G, [...P, { id: "c", name: "C" }], {}, 3, 0);
  assert.equal(s.bag.length + Object.values(s.racks).join("").length, 102);
  for (const id of s.order) assert.equal(s.racks[id].length, 7);
});

test("cases bonus : disposition standard", () => {
  const cnt = (ch) => [...G.PREMIUM].filter((x) => x === ch).length;
  assert.equal(cnt("T"), 8); assert.equal(cnt("D"), 17); assert.equal(cnt("t"), 12); assert.equal(cnt("d"), 24);
  assert.equal(G.PREMIUM[0], "T"); assert.equal(G.PREMIUM[G.CENTER], "D"); assert.equal(G.PREMIUM[at(1, 5)], "t"); assert.equal(G.PREMIUM[at(0, 3)], "d");
});

test("premier coup : centre obligatoire, score et mot double", () => {
  let s = fixed(["MAISONS", "TRUCAGE"]);
  assert.throws(() => apply(G, s, "a", { type: "play", tiles: [[at(0, 0), "M"], [at(0, 1), "A"]] }), /centre/);
  assert.throws(() => apply(G, s, "b", { type: "play", tiles: [[at(7, 7), "T"]] }), /tour/);
  assert.throws(() => apply(G, s, "a", { type: "play", tiles: [[at(7, 7), "Z"], [at(7, 8), "A"]] }), /chevalet/);
  assert.throws(() => apply(G, s, "a", { type: "play", tiles: [[at(7, 7), "M"], [at(8, 8), "A"]] }), /ligne/);
  assert.throws(() => apply(G, s, "a", { type: "play", tiles: [[at(7, 7), "M"], [at(7, 9), "A"]] }), /suivre/);
  assert.throws(() => apply(G, s, "a", { type: "play", tiles: [[at(7, 7), "M"], [at(7, 8), "S"]] }), /inconnu/);
  // MAIS en 7,6..7,9 : M3? non : M=2 A=1 I=1 S=1 = 5, centre mot double = 10
  s = apply(G, s, "a", { type: "play", tiles: [[at(7, 6), "M"], [at(7, 7), "A"], [at(7, 8), "I"], [at(7, 9), "S"]] });
  assert.equal(s.score.a, 10);
  assert.equal(s.racks.a.length, 7);
  assert.equal(s.cur, 1);
  // mot non relié refusé
  assert.throws(() => apply(G, s, "b", { type: "play", tiles: [[at(0, 0), "T"], [at(0, 1), "U"]] }), /toucher/);
});

test("mots croisés, lettre compte triple et joker à 0", () => {
  let s = fixed(["MAISONS", "TRUC?GE"]);
  s = apply(G, s, "a", { type: "play", tiles: [[at(7, 6), "M"], [at(7, 7), "A"], [at(7, 8), "I"], [at(7, 9), "S"]] });
  // B joue "TA" vertical au-dessus du A : T en 6,7 => TA (T1 + A1) = 2
  const r = G.analyze(s.board, [[at(6, 7), "T"]]);
  assert.deepEqual(r.words.map((w) => w.w), ["TA"]);
  assert.equal(r.total, 2);
  // joker en minuscule : vaut 0
  const r2 = G.analyze(s.board, [[at(6, 7), "t"]]);
  assert.equal(r2.total, 1);
  s = apply(G, s, "b", { type: "play", tiles: [[at(6, 7), "t"]] });
  assert.equal(s.score.b, 1);
  assert.ok(!s.racks.b.includes("?"));
});

test("prime pour 7 lettres et valeur réglable", () => {
  const tiles = [..."MAISONS"].map((c, k) => [at(7, 4 + k), c]);
  const s1 = apply(G, fixed(["MAISONS", "TRUCAGE"]), "a", { type: "play", tiles });
  const s2 = apply(G, fixed(["MAISONS", "TRUCAGE"], { bingo: 100 }), "a", { type: "play", tiles });
  assert.equal(s2.score.a - s1.score.a, 50);
  assert.ok(s1.score.a > 50);
});

test("dictionnaire strict : mot faux = tour perdu", () => {
  let s = fixed(["MAISONS", "TRUCAGE"], { dico: "strict" });
  s = apply(G, s, "a", { type: "play", tiles: [[at(7, 7), "M"], [at(7, 8), "S"]] });
  assert.equal(s.cur, 1);
  assert.equal(s.score.a, 0);
  assert.equal(s.board, ".".repeat(225));
  assert.equal(s.log.t, "bad");
});

test("échange, passe et fin par passes avec déduction", () => {
  let s = fixed(["MAISONS", "TRUCAGE"]);
  const bag = s.bag.length;
  assert.throws(() => apply(G, s, "a", { type: "swap", letters: "ZZ" }), /chevalet/);
  s = apply(G, s, "a", { type: "swap", letters: "MA" });
  assert.equal(s.bag.length, bag);
  assert.equal(s.racks.a.length, 7);
  s.bag = "ABC";
  assert.throws(() => apply(G, s, "b", { type: "swap", letters: "T" }), /sac/);
  s = apply(G, s, "b", { type: "pass" });
  s = apply(G, s, "a", { type: "pass" });
  s = apply(G, s, "b", { type: "pass" });
  assert.ok(s.result);
  assert.equal(s.score.b, -G.rackValue("TRUCAGE"));
});

test("fin : sac vide et chevalet vide, on récupère les lettres des autres", () => {
  let s = fixed(["MAIS", "ZUT"]);
  s.bag = "";
  s = apply(G, s, "a", { type: "play", tiles: [[at(7, 6), "M"], [at(7, 7), "A"], [at(7, 8), "I"], [at(7, 9), "S"]] });
  assert.ok(s.result);
  assert.equal(s.score.a, 10 + 12);
  assert.equal(s.score.b, -12);
  assert.equal(s.result.ranking[0].id, "a");
});

test("pendule : 10 points par minute entamée de dépassement", () => {
  let s = fixed(["MAIS", "ZUT"], { clock: 10 });
  s.turnAt = 1;
  s.bag = "";
  s = apply(G, s, "a", { type: "play", tiles: [[at(7, 6), "M"], [at(7, 7), "A"], [at(7, 8), "I"], [at(7, 9), "S"]], now: 11.5 * 60000 });
  assert.equal(s.final.a.pen, 20);
  assert.equal(s.score.a, 22 - 20);
});

test("le robot ne joue que des coups valides, plateau toujours cohérent", () => {
  const { st } = playout(G, 2, 4, { settings: { level: 3 }, onStep: (s) => {
    for (const d of [1, 15]) for (let line = 0; line < 15; line++) {
      let w = "";
      for (let k = 0; k <= 15; k++) {
        const i = d === 1 ? line * 15 + k : k * 15 + line;
        const ch = k < 15 ? s.board[i] : ".";
        if (ch !== ".") w += ch.toUpperCase();
        else { if (w.length >= 2) assert.ok(G.validWord(w), w); w = ""; }
      }
    }
  } });
  assert.ok(st.board.replace(/\./g, "").length > 20);
});

test("robot rapide (< 1 s) même avec des jokers", () => {
  let s = start(G, P, { level: 3 }, 5, 0);
  for (let k = 0; k < 6; k++) { const p = G.toAct(s)[0]; s = apply(G, s, p, { ...G.bot(s, p, { next: () => 0.5, int: () => 0 }), seed: k, now: k }); }
  const p = G.toAct(s)[0];
  s.racks[p] = "??EASRT";
  const t0 = performance.now();
  const a = G.bot(s, p, { next: () => 0.5, int: () => 0 });
  assert.ok(performance.now() - t0 < 1000);
  assert.equal(a.type, "play");
});

test("parties complètes pour chaque mode, 2 et 4 joueurs", () => {
  G.modes.forEach((m, k) => {
    playout(G, 2, 10 + k, { settings: { ...m.set, level: 1 + (k % 3) } });
    playout(G, 4, 20 + k, { settings: { ...m.set, level: 1 } });
  });
  timeoutPlayout(G, 2, 9);
  timeoutPlayout(G, 4, 3, { ...G.modes[1].set, turnTime: 10 });
});

const optOf = (k) => G.options.find((o) => o.key === k);
test("options et modes bien formés", () => {
  assert.ok(G.options.length >= 2 && G.options.length <= 5);
  for (const o of G.options) {
    assert.ok(o.values.some((v) => v[0] === o.def), o.key);
    for (const v of o.values) { assert.ok(v[1].length <= 12); if (v[2]) assert.ok(v[2].length <= 18, v[2]); }
    assert.ok(o.label.length <= 12);
    assert.ok(!["level", "turnTime", "mode"].includes(o.key));
  }
  assert.ok(G.modes.length >= 3 && G.modes.length <= 4);
  assert.equal(G.modes[0].name, "Classique");
  assert.deepEqual(G.modes[0].set, Object.fromEntries(G.options.map((o) => [o.key, o.def])));
  assert.equal(new Set(G.modes.map((m) => JSON.stringify(m.set))).size, G.modes.length);
  for (const m of G.modes) for (const [k, v] of Object.entries(m.set)) assert.ok(optOf(k).values.some((x) => x[0] === v), `${m.id}.${k}`);
  const s = start(G, P, { clock: 7, dico: "x", bingo: "abc" }, 1, 0);
  assert.deepEqual([s.clock, s.strict, s.bingo], [0, false, 50]);
});
