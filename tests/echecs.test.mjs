import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/echecs.js";
import { start, apply, rng } from "../js/engine.js";
import { playout, timeoutPlayout } from "./harness.mjs";

const P = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
const sq = G.sqIndex;
// joue une suite de coups en notation « e2e4 » (promotion : « e7e8n »)
function play(s, ...moves) {
  for (const mv of moves) {
    const pid = G.toAct(s)[0];
    const a = { type: "move", from: sq(mv.slice(0, 2)), to: sq(mv.slice(2, 4)) };
    if (mv[4]) a.promo = { d: 5, t: 4, f: 3, c: 2 }[mv[4]];
    s = apply(G, s, pid, a);
  }
  return s;
}
// état de partie à partir d'une FEN
function fromFen(fen, settings = {}) {
  const s = start(G, P, settings, 1, 0);
  const pos = G.fromFEN(fen, s.v);
  s.b = G.boardToStr(pos.b); s.side = pos.side; s.cr = pos.cr; s.ep = pos.ep; s.half = pos.half;
  s.start = { b: s.b, cr: pos.cr.slice() };
  s.reps = [];
  return s;
}

test("options et modes bien formés", () => {
  assert.ok(G.options.length >= 2 && G.options.length <= 5);
  for (const o of G.options) {
    assert.ok(o.label.length <= 12, o.label);
    assert.ok(!["level", "turnTime", "mode"].includes(o.key));
    assert.ok(o.values.some((v) => v[0] === o.def));
    for (const v of o.values) assert.ok(!v[2] || v[2].length <= 18, v[2]);
  }
  assert.ok(G.modes.length >= 3 && G.modes.length <= 4);
  assert.equal(G.modes[0].name, "Classique");
  for (const o of G.options) assert.equal(G.modes[0].set[o.key], o.def);
  const combos = new Set(G.modes.map((m) => JSON.stringify(G.options.map((o) => m.set[o.key]))));
  assert.equal(combos.size, G.modes.length);
  for (const m of G.modes) for (const [k, v] of Object.entries(m.set)) assert.ok(G.options.find((o) => o.key === k).values.some((x) => x[0] === v));
  // valeurs invalides : retour aux défauts
  const s = start(G, P, { variant: "xx", hints: 3, undo: 7, level: 9 }, 1, 0);
  assert.equal(s.v, "classique"); assert.equal(s.hints, true); assert.equal(s.undo, 0); assert.equal(s.level, 2);
  assert.ok(G.meta.rules.every((r) => !r.includes("\u2014")));
});

test("perft : génération de coups exacte (positions de référence)", () => {
  assert.equal(G.perft(G.fromFEN("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"), 4), 197281);
  assert.equal(G.perft(G.fromFEN("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1"), 3), 97862);
  assert.equal(G.perft(G.fromFEN("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1"), 4), 43238);
  assert.equal(G.perft(G.fromFEN("r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1"), 3), 9467);
  assert.equal(G.perft(G.fromFEN("rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8"), 3), 62379);
});

test("départ : les Blancs commencent, coups illégaux refusés", () => {
  let s = start(G, P, {}, 3, 0);
  const [w, bl] = s.order;
  assert.deepEqual(G.toAct(s), [w]);
  assert.throws(() => apply(G, s, bl, { type: "move", from: sq("e7"), to: sq("e5") }), /tour/);
  assert.throws(() => apply(G, s, w, { type: "move", from: sq("e2"), to: sq("e5") }), /illégal/);
  assert.throws(() => apply(G, s, w, { type: "move", from: sq("g1"), to: sq("g3") }), /illégal/);
  assert.throws(() => apply(G, s, w, { type: "move", from: 99, to: 3 }), /invalide/);
  assert.throws(() => apply(G, s, w, { type: "danse" }), /inconnue/);
  s = play(s, "e2e4");
  assert.equal(s.san[0], "e4");
  assert.deepEqual(G.toAct(s), [bl]);
});

test("mat du berger et notation", () => {
  let s = start(G, P, {}, 3, 0);
  s = play(s, "e2e4", "e7e5", "f1c4", "b8c6", "d1h5", "g8f6", "h5f7");
  assert.deepEqual(s.san, ["e4", "e5", "Fc4", "Cc6", "Dh5", "Cf6", "Dxf7#"]);
  assert.deepEqual(s.end, { winner: s.order[0], why: "mat" });
  assert.equal(s.result.ranking[0].id, s.order[0]);
  assert.equal(s.result.ranking[0].score, 1);
  assert.equal(s.lost[1], "P");
  assert.throws(() => apply(G, s, s.order[1], { type: "move", from: sq("a7"), to: sq("a6") }), /terminée/);
});

test("roque : permis, interdit à travers une case attaquée ou après avoir bougé le roi", () => {
  let s = fromFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
  let t = play(s, "e1g1");
  assert.equal(t.b[sq("g1")], "K"); assert.equal(t.b[sq("f1")], "R"); assert.equal(t.san[0], "O-O");
  t = play(s, "e1a1"); // aussi en touchant la tour
  assert.equal(t.b[sq("c1")], "K"); assert.equal(t.b[sq("d1")], "R"); assert.equal(t.san[0], "O-O-O");
  // f1 attaqué par une tour noire : petit roque impossible
  s = fromFen("r3k3/8/8/8/8/8/5r2/R3K2R w KQq - 0 1");
  assert.throws(() => play(s, "e1g1"), /illégal/);
  // en échec : pas de roque
  s = fromFen("r3k3/8/8/8/8/8/4r3/R3K2R w KQq - 0 1");
  assert.throws(() => play(s, "e1c1"), /illégal/);
  // le roi a bougé puis est revenu : plus de roque
  s = fromFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
  s = play(s, "e1e2", "a8a7", "e2e1", "a7a8");
  assert.throws(() => play(s, "e1g1"), /illégal/);
  // tour prise : le roque de ce côté disparaît
  s = fromFen("r3k2r/8/8/8/8/8/6b1/R3K2R b KQkq - 0 1");
  s = play(s, "g2h1");
  assert.deepEqual(s.cr.slice(0, 2), [-1, 56]);
});

test("prise en passant, seulement juste après la double avance", () => {
  let s = fromFen("4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1");
  s = play(s, "d7d5");
  assert.equal(s.ep, sq("d6"));
  const t = play(s, "e5d6");
  assert.equal(t.b[sq("d5")], "."); assert.equal(t.b[sq("d6")], "P"); assert.equal(t.san[1], "exd6");
  s = play(s, "e1e2", "e8e7");
  assert.throws(() => play(s, "e5d6"), /illégal/);
});

test("promotion au choix (dame par défaut)", () => {
  const s = fromFen("8/4P2k/8/8/8/8/8/4K3 w - - 0 1");
  assert.equal(play(s, "e7e8c").b[sq("e8")], "N");
  assert.equal(play(s, "e7e8t").b[sq("e8")], "R");
  const d = apply(G, s, G.toAct(s)[0], { type: "move", from: sq("e7"), to: sq("e8") });
  assert.equal(d.b[sq("e8")], "Q");
  assert.equal(d.san[0], "e8=D");
});

test("pat, matériel insuffisant, 50 coups, répétition", () => {
  // pat
  let s = fromFen("7k/8/6Q1/8/8/8/8/K7 w - - 0 1");
  s = play(s, "g6f7");
  assert.deepEqual(s.end, { winner: null, why: "pat" });
  assert.ok(s.result.ranking.every((r) => r.rank === 1 && r.score === 0.5));
  // roi + fou contre roi
  s = fromFen("4k3/8/8/8/8/8/3r4/4KB2 w - - 0 1");
  s = play(s, "e1d2");
  assert.equal(s.end.why, "materiel");
  assert.ok(G.insufficient(G.strToBoard(G.boardToStr(G.fromFEN("4k3/8/8/8/8/8/8/2B1KB2 w - - 0 1").b))) === false);
  assert.ok(G.insufficient(G.fromFEN("4kb2/8/8/8/8/8/8/2B1K3 w - - 0 1").b));
  // 50 coups
  s = fromFen("4k3/8/8/8/8/8/8/R3K3 w - - 98 80");
  s = play(s, "a1a2");
  assert.equal(s.end, null);
  s = play(s, "e8d8");
  assert.equal(s.end.why, "cinquante");
  // répétition triple
  s = start(G, P, {}, 2, 0);
  s = play(s, "g1f3", "g8f6", "f3g1", "f6g8", "g1f3", "g8f6", "f3g1");
  assert.equal(s.end, null);
  s = play(s, "f6g8");
  assert.equal(s.end.why, "repetition");
});

test("variantes : 960, roi de la colline, trois échecs", () => {
  for (let seed = 1; seed < 40; seed++) {
    const s = start(G, P, { variant: "960" }, seed, 0);
    const row = s.b.slice(56);
    const bs = [...row].map((c, i) => (c === "B" ? i % 2 : -1)).filter((x) => x >= 0);
    assert.deepEqual(bs.sort(), [0, 1], "fous de couleurs opposées");
    const k = row.indexOf("K"), r1 = row.indexOf("R"), r2 = row.lastIndexOf("R");
    assert.ok(r1 < k && k < r2, "roi entre les tours");
    assert.equal(s.b.slice(0, 8), row.toLowerCase());
  }
  // roque 960 : roi en b1, tour en a1 (grand roque) et tour en h1
  let s = fromFen("r3k2r/8/8/8/8/8/8/RK5R w - - 0 1", { variant: "960" });
  s.cr = [63, 56, 7, 0]; s.start.cr = s.cr.slice();
  const t = play(s, "b1h1");
  assert.equal(t.b.slice(56), "R....RK.");
  const u = play(s, "b1a1");
  assert.equal(u.b.slice(56), "..KR...R");
  // colline
  s = fromFen("4k3/8/8/8/8/3K4/8/8 w - - 0 1", { variant: "colline" });
  s = play(s, "d3e4");
  assert.deepEqual(s.end, { winner: s.order[0], why: "colline" });
  // trois échecs
  s = fromFen("4k3/8/8/8/8/8/8/R3K3 w - - 0 1", { variant: "3echecs" });
  s.chk = [2, 0];
  s = play(s, "a1a8");
  assert.deepEqual(s.end, { winner: s.order[0], why: "troisechecs" });
});

test("jokers retour et abandon", () => {
  let s = start(G, P, { undo: 1 }, 4, 0);
  const [w, bl] = s.order;
  assert.throws(() => apply(G, s, w, { type: "undo" }), /Rien/);
  s = play(s, "e2e4", "e7e5", "d1h5", "b8c6");
  s = apply(G, s, w, { type: "undo" });
  assert.equal(s.mv.length, 2);
  assert.deepEqual(s.san, ["e4", "e5"]);
  assert.equal(s.jok[w], 0);
  assert.equal(s.b[sq("d1")], "Q");
  assert.deepEqual(G.toAct(s), [w]);
  s = play(s, "g1f3");
  s = apply(G, s, bl, { type: "undo" }); // noir a encore son joker
  assert.equal(s.mv.length, 1);
  assert.throws(() => apply(G, start(G, P, {}, 4, 0), w, { type: "undo" }), /retour/);
  // abandon (même hors de son tour)
  s = apply(G, s, w, { type: "resign" });
  assert.deepEqual(s.end, { winner: bl, why: "abandon" });
  assert.equal(s.result.ranking[0].id, bl);
});

test("robot : trouve le mat en un, ne donne pas sa dame, reste rapide", () => {
  const s = fromFen("6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1", { level: 2 });
  const a = G.bot(s, G.toAct(s)[0], rng(1));
  assert.deepEqual([a.from, a.to], [sq("a1"), sq("a8")]);
  for (const lvl of [1, 2, 3]) {
    const r = rng(lvl);
    let st = start(G, P, { level: lvl }, lvl, 0), worst = 0;
    for (let i = 0; i < 30 && !st.end; i++) {
      const pid = G.toAct(st)[0];
      // durée minimale sur 3 calculs identiques (écarte la charge des autres tests)
      const seed = r.int(1e9);
      let act, best = Infinity;
      for (let k = 0; k < 3; k++) { const t0 = performance.now(); act = G.bot(st, pid, rng(seed)); best = Math.min(best, performance.now() - t0); }
      worst = Math.max(worst, best);
      st = apply(G, st, pid, act);
    }
    assert.ok(worst < 400, `niveau ${lvl} : ${worst.toFixed(0)} ms`);
  }
  // niveau 3 : prend la dame offerte gratuitement
  const q = fromFen("4k3/8/8/3q4/8/8/8/3QK3 w - - 0 1", { level: 3 });
  const b = G.bot(q, G.toAct(q)[0], rng(2));
  assert.equal(b.to, sq("d5"));
});

test("parties complètes pour chaque mode", () => {
  for (const m of G.modes) for (let seed = 1; seed <= 2; seed++) {
    const { st } = playout(G, 2, seed, { settings: { ...m.set, level: seed === 1 ? 1 : 2 } });
    assert.ok(st.end && G.endText(st.end.why));
    assert.ok(JSON.stringify(st).length < 30000);
  }
  playout(G, 2, 9, { settings: { variant: "3echecs", level: 3 } });
  timeoutPlayout(G, 2, 5, { turnTime: 10 });
});
