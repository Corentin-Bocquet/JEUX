import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/emojifilm.js";
import { start, apply } from "../js/engine.js";
import { playout, timeoutPlayout } from "./harness.mjs";

const P = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
const defaults = () => Object.fromEntries(G.options.map((o) => [o.key, o.def]));

test("options et modes bien formés", () => {
  assert.ok(G.options.length >= 2 && G.options.length <= 5);
  for (const o of G.options) {
    assert.ok(o.label.length <= 12 && o.values.some((v) => v[0] === o.def), o.key);
    for (const v of o.values) { assert.ok(v[1].length <= 12, v[1]); if (v[2]) assert.ok(v[2].length <= 18, v[2]); }
    assert.ok(!["level", "turnTime", "mode"].includes(o.key));
  }
  assert.ok(G.modes.length >= 3 && G.modes.length <= 4);
  assert.equal(G.modes[0].name, "Classique");
  assert.deepEqual(G.modes[0].set, defaults());
  assert.equal(new Set(G.modes.map((m) => JSON.stringify(m.set))).size, G.modes.length);
  for (const m of G.modes) for (const [k, v] of Object.entries(m.set)) assert.ok(G.options.find((o) => o.key === k).values.some((x) => x[0] === v), `${m.id}.${k}`);
});

test("données : 300 oeuvres et plus, 3 à 5 émojis, pas de doublon ni de confusion", () => {
  const F = G.FILMS;
  assert.ok(F.length >= 300);
  const seg = new Intl.Segmenter("fr", { granularity: "grapheme" });
  const seen = new Set();
  for (const [t, y, c, g, e, alts] of F) {
    assert.ok(!seen.has(G.norm(t)), "doublon " + t); seen.add(G.norm(t));
    assert.ok(Number.isInteger(y) && y >= 1920 && y <= 2025, t);
    assert.ok(["f", "a", "s"].includes(c) && g, t);
    const n = [...seg.segment(e)].length;
    assert.ok(n >= 3 && n <= 5, `${t} : ${n} émojis`);
    assert.ok(!alts || Array.isArray(alts));
    assert.ok(!/—/.test(t + g + (alts || []).join("")));
  }
  for (const c of ["f", "a", "s"]) assert.ok(F.filter((f) => f[2] === c).length >= 40, c);
  // le titre exact d'une oeuvre n'est jamais accepté pour une autre
  for (let i = 0; i < F.length; i++) for (let j = 0; j < F.length; j++) if (i !== j) assert.ok(!G.matches(j, F[i][0]), `${F[i][0]} -> ${F[j][0]}`);
});

test("comparaison tolérante", () => {
  const i = G.FILMS.findIndex((f) => f[0] === "Le Fabuleux Destin d'Amélie Poulain");
  assert.ok(G.matches(i, "fabuleux destin d amelie poulain"));
  assert.ok(G.matches(i, "Le fabuleu destin d'Amélie Poulain"));
  assert.ok(G.matches(i, "amelie"));
  assert.ok(!G.matches(i, "Amélie Nothomb raconte"));
  const r = G.FILMS.findIndex((f) => f[0] === "Le Roi lion");
  assert.ok(G.matches(r, "roi lion") && G.matches(r, "LE ROI LON") && !G.matches(r, "le roi"));
  const t = G.FILMS.findIndex((f) => f[0] === "Pirates des Caraïbes : La Malédiction du Black Pearl");
  assert.ok(G.matches(t, "pirates des caraibes"));
  const m = G.FILMS.findIndex((f) => f[0] === "La Môme");
  assert.ok(G.matches(m, "la mome") && !G.matches(m, "la momie"));
});

test("règles : essais, indices, bonus du premier, coups refusés", () => {
  let s = start(G, P, { rounds: 5, hints: true }, 3, 0);
  const cur = G.current(s);
  const title = G.FILMS[cur][0];
  assert.throws(() => apply(G, s, "a", { type: "choice", i: cur }), /Tape/);
  assert.throws(() => apply(G, s, "a", { type: "guess", text: "  le " }), /titre/);
  s = apply(G, s, "a", { type: "hint" });
  s = apply(G, s, "a", { type: "guess", text: title });
  assert.equal(s.p.a.pts, 100 - 25 + 20);
  assert.throws(() => apply(G, s, "a", { type: "guess", text: title }), /prochaine/);
  const wrong = G.FILMS.find((f, k) => k !== cur && !G.matches(cur, f[0]))[0];
  for (let k = 0; k < 3; k++) s = apply(G, s, "b", { type: "guess", text: wrong });
  assert.equal(s.p.b.st, "out");
  assert.equal(s.phase, "reveal");
  assert.deepEqual(G.toAct(s).sort(), ["a", "b"]);
  s = apply(G, s, "a", { type: "next" });
  assert.throws(() => apply(G, s, "a", { type: "next" }), /prêt/);
  s = apply(G, s, "b", { type: "next" });
  assert.equal(s.roundNo, 2);
  assert.deepEqual(s.scores, { a: 95, b: 0 });
  // sans indices
  const s2 = start(G, P, { hints: false }, 3, 0);
  assert.throws(() => apply(G, s2, "a", { type: "hint" }), /indice/);
});

test("QCM : 4 choix de la même catégorie, un seul essai", () => {
  for (let seed = 1; seed < 20; seed++) {
    const s = start(G, P, { answer: "qcm", cat: "s" }, seed, 0);
    assert.equal(s.choices.length, 4);
    assert.ok(s.choices.includes(G.current(s)));
    assert.ok(s.choices.every((c) => G.FILMS[c][2] === "s"));
    assert.ok(s.deck.every((c) => G.FILMS[c][2] === "s"));
    const wrong = s.choices.find((c) => c !== G.current(s));
    const s1 = apply(G, s, "a", { type: "choice", i: wrong });
    assert.equal(s1.p.a.st, "out");
  }
});

test("parties complètes pour chaque mode", () => {
  for (const m of G.modes) for (const n of [1, 8]) playout(G, n, n * 7 + m.id.length, { settings: { ...m.set, level: 1 + (n % 3) } });
  for (let seed = 1; seed <= 6; seed++) playout(G, 3, seed, { settings: { level: (seed % 3) + 1 } });
  timeoutPlayout(G, 2, 4);
  timeoutPlayout(G, 3, 5, { ...G.modes[1].set, turnTime: 10 });
  const st = start(G, P, { rounds: 99, answer: "x", cat: "zz" }, 1, 0);
  assert.equal(st.rounds, 10); assert.equal(st.answer, "texte"); assert.equal(st.cat, "tout");
});
