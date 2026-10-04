import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/geo.js";
import * as F from "../js/games/lib/flash.js";
import { start, apply } from "../js/engine.js";
import { playout, timeoutPlayout } from "./harness.mjs";

const P2 = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
const byName = (n) => G.COUNTRIES.findIndex((p) => p.n === n);

test("base : tous les pays souverains, données valides", () => {
  const C = G.COUNTRIES;
  assert.equal(C.length, 194); // 193 membres de l'ONU + Vatican
  assert.equal(new Set(C.map((p) => p.iso)).size, 194);
  assert.equal(new Set(C.map((p) => F.normAnswer(p.n))).size, 194);
  for (const p of C) {
    assert.ok(G.CONTINENTS.includes(p.k), p.n);
    assert.match(p.iso, /^[A-Z]{2}$/);
    assert.ok(p.n && p.c, p.n);
    assert.equal([...G.flagOf(p.iso)].length, 2);
  }
  const caps = C.filter((p) => G.fits(p, "cap")).map((p) => F.normAnswer(p.c));
  assert.equal(new Set(caps).size, caps.length, "deux pays ne partagent pas une capitale");
  assert.equal(C.filter((p) => p.k === "Océanie").length, 14);
  assert.equal(C.filter((p) => p.k === "Afrique").length, 54);
  assert.equal(C.filter((p) => p.k === "Amérique").length, 35);
});

test("capitales vérifiées", () => {
  const cap = (n) => G.COUNTRIES[byName(n)].c;
  const want = { Australie: "Canberra", Turquie: "Ankara", "Brésil": "Brasilia", Suisse: "Berne", Canada: "Ottawa", Maroc: "Rabat",
    Nigeria: "Abuja", Kazakhstan: "Astana", Birmanie: "Naypyidaw", Pakistan: "Islamabad", Tanzanie: "Dodoma", "Côte d'Ivoire": "Yamoussoukro",
    "Nouvelle-Zélande": "Wellington", "États-Unis": "Washington", Inde: "New Delhi", Chine: "Pékin", Japon: "Tokyo", France: "Paris",
    Bolivie: "Sucre", "Pays-Bas": "Amsterdam", Burundi: "Gitega", Belize: "Belmopan", "Bénin": "Porto-Novo", Palaos: "Ngerulmud" };
  for (const [n, c] of Object.entries(want)) assert.equal(cap(n), c, n);
  // capitales contestées ou absentes : jamais demandées
  for (const n of ["Israël", "Nauru", "Indonésie"]) assert.equal(G.fits(G.COUNTRIES[byName(n)], "cap"), false, n);
  for (const n of ["Russie", "Turquie", "Chypre", "Kazakhstan"]) assert.equal(G.fits(G.COUNTRIES[byName(n)], "cont"), false, n);
});

test("comparaison des réponses tapées", () => {
  assert.equal(F.normAnswer("  L'Équateur "), "equateur");
  assert.ok(F.typedMatches("bresil", ["Brésil"]));
  assert.ok(F.typedMatches("BRÉSL", ["Brésil"]), "une lettre oubliée");
  assert.ok(F.typedMatches("berne", ["Berne"]));
  assert.ok(F.typedMatches("Canbera", ["Canberra"]));
  assert.ok(F.typedMatches("Ankraa", ["Ankara"]), "deux lettres inversées");
  assert.ok(!F.typedMatches("Sydney", ["Canberra"]));
  assert.ok(!F.typedMatches("Ankarra la", ["Ankara"]));
  assert.ok(!F.typedMatches("", ["Paris"]));
  assert.ok(F.typedMatches("Rme", ["Rome"]));
  assert.ok(!F.typedMatches("Rmo", ["Rome"]), "deux fautes refusées");
  assert.ok(!F.typedMatches("ab", ["abc"]), "pas de tolérance sous 4 lettres");
  const qNg = { t: "pays", c: byName("Nigeria") };
  const { goods, others } = G.accepted(qNg);
  assert.ok(!F.typedMatches("Niger", goods, others), "Niger n'est pas le Nigeria");
  assert.ok(F.typedMatches("Nigéria", goods, others));
  assert.ok(F.typedMatches("nigeri", goods, others));
  const qMl = G.accepted({ t: "pays", c: byName("Mali") });
  assert.ok(!F.typedMatches("Malte", qMl.goods, qMl.others));
  const qBo = G.accepted({ t: "cap", c: byName("Bolivie") });
  assert.ok(F.typedMatches("la paz", qBo.goods, qBo.others));
  const qUs = G.accepted({ t: "pays", c: byName("États-Unis") });
  assert.ok(F.typedMatches("etats unis", qUs.goods, qUs.others));
  assert.ok(F.typedMatches("USA", qUs.goods, qUs.others));
});

test("QCM : 4 propositions dont la bonne, réponses jugées", () => {
  let s = start(G, P2, { type: "cap", count: 30 }, 5, 0);
  for (const q of s.qs) { assert.equal(q.ch.length, 4); assert.ok(q.ch.includes(q.c)); assert.equal(new Set(q.ch).size, 4); assert.equal(q.t, "cap"); }
  const q = s.qs[0];
  assert.throws(() => apply(G, s, "a", { type: "answer", v: (q.c + 1) % 194 === q.ch[0] ? -1 : 999, now: 1 }), /propositions/);
  s = apply(G, s, "a", { type: "answer", v: q.c, now: F.qStart(s) });
  s = apply(G, s, "b", { type: "answer", v: q.ch.find((x) => x !== q.c), now: F.qStart(s) + 500 });
  assert.equal(s.scores.a, 100);
  assert.equal(s.scores.b, 0);
});

test("réponse à taper et continents", () => {
  let s = start(G, P2, { type: "pays", rep: "taper" }, 8, 0);
  const q = s.qs[0];
  assert.equal(q.ch, undefined);
  assert.throws(() => apply(G, s, "a", { type: "answer", v: "   ", now: 1 }), /Écris/);
  const name = G.COUNTRIES[q.c].n;
  s = apply(G, s, "a", { type: "answer", v: name.toUpperCase(), now: 1 });
  s = apply(G, s, "b", { type: "answer", v: "Atlantide", now: 1 });
  assert.equal(s.last.ans.a.ok, 1);
  assert.equal(s.last.ans.b.ok, 0);
  let c = start(G, P2, { type: "cont" }, 3, 0);
  const qc = c.qs[0];
  assert.throws(() => apply(G, c, "a", { type: "answer", v: "Antarctique", now: 1 }), /continent/);
  c = apply(G, c, "a", { type: "answer", v: G.COUNTRIES[qc.c].k, now: 1 });
  assert.equal(c.ans.a.ok, 1);
});

test("filtre de continent et types", () => {
  for (const k of G.CONTINENTS) {
    const s = start(G, P2, { cont: k, count: 30 }, 2, 0);
    assert.equal(s.qs.length, 30);
    for (const q of s.qs) { assert.equal(G.COUNTRIES[q.c].k, k); assert.notEqual(q.t, "cont"); assert.ok(G.fits(G.COUNTRIES[q.c], q.t)); }
  }
  const mix = start(G, P2, { count: 30 }, 4, 0);
  assert.equal(new Set(mix.qs.map((q) => q.c)).size, 30, "pas deux fois le même pays");
  assert.ok(new Set(mix.qs.map((q) => q.t)).size >= 3);
  for (const t of G.TYPES) for (const q of start(G, P2, { type: t, count: 30 }, 6, 0).qs) assert.equal(q.t, t);
  for (const q of start(G, P2, { type: "drap", count: 30 }, 7, 0).qs) for (const j of q.ch) assert.ok(!G.COUNTRIES[j].nf);
});

test("parties complètes avec robots, chaque mode, min et max joueurs", () => {
  for (const m of G.modes) for (const n of [G.meta.min, G.meta.max]) for (const level of [1, 3]) playout(G, n, 11 + n + level, { settings: { ...m.set, level } });
  timeoutPlayout(G, 2, 4, { turnTime: 10, count: 10 });
  timeoutPlayout(G, 3, 9, { turnTime: 10, rep: "taper", count: 10 });
});

test("options et modes bien formés", () => {
  const keys = G.options.map((o) => o.key);
  assert.ok(G.options.length >= 2 && G.options.length <= 5);
  for (const o of G.options) {
    assert.ok(o.values.some((v) => v[0] === o.def), o.key);
    assert.ok(o.label.length <= 12);
    for (const v of o.values) { assert.ok(v[1].length <= 12, v[1]); if (v[2]) assert.ok(v[2].length <= 18, v[2]); }
  }
  assert.ok(!keys.includes("level") && !keys.includes("turnTime") && !keys.includes("mode"));
  assert.ok(G.modes.length >= 3 && G.modes.length <= 4);
  assert.equal(G.modes[0].name, "Classique");
  assert.deepEqual(G.modes[0].set, Object.fromEntries(G.options.map((o) => [o.key, o.def])));
  assert.equal(new Set(G.modes.map((m) => JSON.stringify(m.set))).size, G.modes.length);
  const s = start(G, P2, { cont: "Lune", type: "x", rep: 3, count: 0 }, 1, 0);
  assert.equal(s.cont, ""); assert.equal(s.type, "mix"); assert.equal(s.rep, "qcm"); assert.equal(s.qs.length, 15);
  assert.ok(JSON.stringify(start(G, P2, { count: 30 }, 1, 0)).length < 30000);
});
