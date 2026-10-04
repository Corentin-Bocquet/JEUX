import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/petitbac.js";
import { PB_CATS, PB_SETS } from "../js/data/petitbac_listes.js";
import { start, apply } from "../js/engine.js";
import { playout, timeoutPlayout } from "./harness.mjs";

const two = [{ id: "a" }, { id: "b" }];
const word = (s, k) => G.catData(k).byLetter[s.letter][0];

test("listes riches, sans doublons, toutes les catégories des groupes existent", () => {
  for (const [k, c] of Object.entries(PB_CATS)) {
    const raw = c.list.split(",").map((w) => w.trim());
    const n = raw.map(G.norm);
    assert.equal(new Set(n).size, n.length, k + " a des doublons");
    assert.ok(raw.length >= 150, `${k} : ${raw.length} mots`);
    assert.ok(raw.every((w) => w && !w.includes("—")), k);
  }
  for (const [k, cats] of Object.entries(PB_SETS)) {
    for (const c of cats) assert.ok(PB_CATS[c], c);
    assert.ok(G.playableLetters(cats, "faciles").length >= 5, k);
    assert.ok(G.playableLetters(cats, "toutes").length > G.playableLetters(cats, "faciles").length, k);
  }
});

test("comparaison sans accents, articles et pluriel", () => {
  assert.equal(G.judge("pays", "E", "égypte").code, "v");
  assert.equal(G.judge("pays", "E", "EGYPTE").code, "v");
  assert.equal(G.judge("animal", "C", "les chats").code, "v");
  assert.equal(G.judge("ville", "L", "Le Havre").code, "v");
  assert.equal(G.judge("animal", "C", "l'chat").code, "v");
  assert.equal(G.judge("animal", "C", "").code, "e");
  assert.equal(G.judge("animal", "C", "Zèbre").code, "x");
  assert.equal(G.judge("animal", "C", "Cornofle").code, "d");
});

test("stop, compte à rebours, points uniques et partagés", () => {
  let s = start(G, two, { set: "nature", vote: false, rounds: 3 }, 7, 1000);
  const L = s.letter, n = s.cats.length;
  assert.throws(() => apply(G, s, "a", { type: "fill", cat: 99, word: "x", now: 1100 }), /inconnue/);
  // a remplit tout avec des mots des listes, b met un mot commun et un mot inventé
  const full = s.cats.map((k) => word(s, k));
  for (let i = 0; i < n; i++) s = apply(G, s, "a", { type: "fill", cat: i, word: full[i], now: 2000 });
  s = apply(G, s, "b", { type: "fill", cat: 0, word: full[0].toUpperCase(), now: 2100 });
  s = apply(G, s, "b", { type: "fill", cat: 1, word: L + "zzqq", now: 2100 });
  assert.throws(() => apply(G, s, "a", { type: "close", now: 3000 }), /Pas encore/);
  s = apply(G, s, "a", { type: "done", now: 5000 });
  assert.equal(s.stopBy, "a");
  assert.equal(s.stopAt, 5000 + G.STOP_SECS * 1000);
  assert.throws(() => apply(G, s, "a", { type: "fill", cat: 0, word: "x", now: 5100 }), /rendue/);
  assert.throws(() => apply(G, s, "b", { type: "close", now: 9000 }), /Pas encore/);
  s = apply(G, s, "b", { type: "close", now: 15001 });
  assert.equal(s.phase, "recap");
  assert.equal(s.res.a[0].p, 1); assert.equal(s.res.b[0].p, 1);
  assert.equal(s.res.b[1].c, "r");
  assert.equal(s.scores.a, 1 + 2 * (n - 1));
  assert.equal(s.scores.b, 1);
  s = apply(G, s, "a", { type: "ready", now: 16000 });
  assert.equal(s.roundNo, 1);
  s = apply(G, s, "b", { type: "ready", now: 16000, seed: 3 });
  assert.equal(s.roundNo, 2);
  assert.notEqual(s.letter, L);
  assert.equal(G.roundStart(s), 16000);
});

test("vote sur un mot hors liste", () => {
  const three = [{ id: "a" }, { id: "b" }, { id: "c" }];
  let s = start(G, three, { vote: true }, 11, 0);
  const odd = s.letter + "ublot";
  s = apply(G, s, "a", { type: "done", answers: [odd], now: 100 });
  s = apply(G, s, "b", { type: "done", answers: [odd + "e"], now: 100 });
  s = apply(G, s, "c", { type: "done", now: 100 });
  assert.equal(s.phase, "vote");
  assert.equal(s.doubts.length, 2);
  assert.deepEqual(G.toAct(s).sort(), ["a", "b", "c"]);
  s = apply(G, s, "a", { type: "vote", ok: [1, 0] });
  s = apply(G, s, "b", { type: "vote", ok: [1, 1] });
  assert.throws(() => apply(G, s, "b", { type: "vote", ok: [1, 1] }), /déjà/);
  s = apply(G, s, "c", { type: "vote", ok: [1, 1] });
  assert.equal(s.phase, "recap");
  assert.equal(s.res.a[0].c, "a"); assert.equal(s.res.a[0].p, 2);
  assert.equal(s.res.b[0].c, "r"); // égalité 1 contre 1 : refusé
  // vote figé par le délai
  let t = start(G, two, { vote: true }, 12, 0);
  t = apply(G, t, "a", { type: "done", answers: [t.letter + "ublot"], now: 50 });
  t = apply(G, t, "b", { type: "done", now: 60 });
  assert.equal(t.phase, "vote");
  assert.throws(() => apply(G, t, "a", { type: "close", now: 100 }), /Pas encore/);
  t = apply(G, t, "a", { type: "close", now: 60 + G.VOTE_SECS * 1000 });
  assert.equal(t.res.a[0].c, "r");
});

test("parties complètes avec robots, chaque mode, min et max joueurs", () => {
  for (const m of G.modes) for (const n of [2, 8]) {
    const { st } = playout(G, n, 30 + n, { settings: { ...m.set, rounds: 3, level: 1 + (n % 3) } });
    assert.equal(st.history.length, 3);
    assert.ok(JSON.stringify(st).length < 30000);
  }
  for (let seed = 1; seed <= 4; seed++) playout(G, 3, seed, { settings: { level: seed % 3 + 1, rounds: 3, set: "geant", letters: "toutes" } });
  timeoutPlayout(G, 3, 4, { turnTime: 10, rounds: 3 });
});

test("options et modes bien formés", () => {
  const keys = G.options.map((o) => o.key);
  assert.ok(G.options.length >= 2 && G.options.length <= 5);
  for (const o of G.options) {
    assert.ok(o.label.length <= 12, o.label);
    assert.ok(o.values.some((v) => v[0] === o.def), o.key);
    for (const v of o.values) { assert.ok(v[1].length <= 12, v[1]); if (v[2]) assert.ok(v[2].length <= 18, v[2]); }
  }
  assert.ok(!keys.includes("level") && !keys.includes("turnTime") && !keys.includes("mode"));
  assert.ok(G.modes.length >= 3 && G.modes.length <= 4);
  assert.equal(G.modes[0].name, "Classique");
  assert.deepEqual(G.modes[0].set, Object.fromEntries(G.options.map((o) => [o.key, o.def])));
  assert.equal(new Set(G.modes.map((m) => JSON.stringify(m.set))).size, G.modes.length);
  const s = start(G, two, { rounds: 4, set: "zut", dur: 7, vote: "peut-être", letters: 3 }, 1, 0);
  assert.equal(s.rounds, 5); assert.equal(s.set, "classique"); assert.equal(s.dur, 120); assert.equal(s.vote, true); assert.equal(s.letters, "faciles");
  assert.equal(start(G, two, { set: "geant" }, 1, 0).cats.length, 12);
});
