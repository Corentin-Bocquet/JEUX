import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/reversi.js";
import { start, apply } from "../js/engine.js";
import { playout, timeoutPlayout } from "./harness.mjs";

const P = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
const fakeRng = { next: () => 0.9, int: () => 0, pick: (l) => l[0], shuffle: (l) => l.slice() };

test("position de départ, premiers coups et coups interdits", () => {
  let s = start(G, P, {}, 1, 0);
  const [x, y] = s.order;
  assert.equal(s.n, 8);
  assert.equal(G.countOf(s.board, 1), 2);
  assert.equal(G.countOf(s.board, 2), 2);
  assert.deepEqual(G.toAct(s), [x], "les noirs commencent");
  assert.deepEqual(G.legalMoves(s.board, 8, 1).sort((p, q) => p - q), [19, 26, 37, 44]);
  assert.throws(() => apply(G, s, y, { type: "play", i: 19 }), /tour/);
  assert.throws(() => apply(G, s, x, { type: "play", i: 0 }), /retourne/);
  assert.throws(() => apply(G, s, x, { type: "play", i: 27 }), /prise/);
  assert.throws(() => apply(G, s, x, { type: "play", i: 99 }), /invalide/);
  assert.throws(() => apply(G, s, x, { type: "play", i: 1.5 }), /invalide/);
  s = apply(G, s, x, { type: "play", i: 19 });
  assert.equal(s.board[19], 1);
  assert.equal(s.board[27], 1, "le pion encadré est retourné");
  assert.deepEqual(s.flips, [27]);
  assert.equal(G.countOf(s.board, 1), 4);
  assert.deepEqual(G.toAct(s), [y]);
});

test("retournement dans plusieurs directions à la fois", () => {
  const n = 8, b = Array(64).fill(0);
  const at = (r, c) => r * n + c;
  b[at(3, 3)] = 1;
  b[at(3, 4)] = 2; b[at(3, 5)] = 2; b[at(3, 6)] = 1;  // à droite
  b[at(4, 3)] = 2; b[at(5, 3)] = 1;                  // en bas
  b[at(4, 4)] = 2; b[at(5, 5)] = 1;                  // diagonale
  b[at(2, 3)] = 2;                                   // rien derrière : pas retourné
  const fl = G.flipsFor(b, n, at(3, 3) - 0 + 0, 1);
  assert.deepEqual(fl, [], "case occupée");
  b[at(3, 3)] = 0;
  const f2 = G.flipsFor(b, n, at(3, 3), 1).sort((p, q) => p - q);
  assert.deepEqual(f2, [at(3, 4), at(3, 5), at(4, 3), at(4, 4)].sort((p, q) => p - q));
});

test("passe automatique et fin quand plus personne ne peut jouer", () => {
  let s = start(G, P, { size: 6 }, 3, 0);
  const [x, y] = s.order;
  // noirs : tout le plateau sauf deux cases ; un blanc isolé
  s.board = Array(36).fill(1);
  s.board[0] = 0; s.board[1] = 2; s.board[35] = 0;
  s.side = 1; // aux blancs
  // les blancs n'ont aucun coup en 35 ; en 0 non plus (rien à encadrer) : on vérifie la règle via les noirs
  s.side = 0;
  s = apply(G, s, x, { type: "play", i: 0 }); // encadre le blanc en 1 ? non : 1 est entre 0 et 2 (noir)
  assert.equal(s.board[1], 1);
  // plus aucun blanc : les blancs passent, les noirs n'ont plus de coup non plus -> fin
  assert.ok(s.done);
  assert.ok(s.result);
  assert.equal(s.result.ranking.find((r) => r.id === x).rank, 1);
  assert.equal(s.result.ranking.find((r) => r.id === x).score, 35);
  assert.equal(s.result.ranking.find((r) => r.id === y).score, 0);
});

test("un joueur sans coup passe et l'autre rejoue", () => {
  let passes = 0;
  for (let seed = 1; seed <= 30 && passes < 3; seed++) {
    playout(G, 2, seed, { settings: { size: 6, level: 1 }, onStep: (st) => {
      if (!st.pass || st.done) return;
      passes++;
      assert.deepEqual(G.legalMoves(st.board, st.n, G.colorOf(st, st.pass)), [], "celui qui passe n'a vraiment aucun coup");
      assert.ok(!G.toAct(st).includes(st.pass), "il ne joue pas");
      assert.ok(G.legalMoves(st.board, st.n, st.side + 1).length > 0, "l'autre rejoue");
    } });
  }
  assert.ok(passes > 0, "au moins une passe observée");
});

test("le robot fort prend un coin disponible", () => {
  let s = start(G, P, { level: 3 }, 2, 0);
  const at = (r, c) => r * 8 + c;
  s.board = Array(64).fill(0);
  s.board[at(1, 1)] = 2; s.board[at(2, 2)] = 1; s.board[at(3, 3)] = 1; s.board[at(3, 4)] = 2; s.board[at(4, 4)] = 1; s.board[at(4, 3)] = 2;
  s.side = 0;
  assert.ok(G.legalMoves(s.board, 8, 1).includes(0));
  const a = G.bot(s, G.toAct(s)[0], fakeRng);
  assert.equal(a.i, 0);
});

test("table de poids : coins forts, cases X dangereuses", () => {
  for (const n of [6, 8, 10]) {
    const w = G.weights(n);
    assert.ok(w[0] > 50 && w[n - 1] > 50 && w[n * n - 1] > 50);
    assert.ok(w[n + 1] < 0 && w[(n - 2) * n + (n - 2)] < 0);
    assert.ok(w[1] < 0, "case C");
  }
});

test("parties complètes robot contre robot (tous niveaux)", () => {
  for (let seed = 1; seed <= 10; seed++) playout(G, 2, seed, { settings: { level: (seed % 3) + 1 } });
  timeoutPlayout(G, 2, 9);
});

test("parties complètes pour chaque mode", () => {
  for (const m of G.modes) for (let seed = 1; seed <= 2; seed++) {
    const { st } = playout(G, 2, seed, { settings: { ...m.set, level: 1 + (seed % 3) } });
    assert.equal(st.n, m.set.size);
    if (m.set.wins > 1) assert.ok(st.game >= m.set.wins);
  }
  timeoutPlayout(G, 2, 5, { ...G.modes[1].set, turnTime: 10 });
  timeoutPlayout(G, 2, 6, { ...G.modes[3].set, turnTime: 10 });
});

test("match : manches, alternance des couleurs, manche suivante", () => {
  let s = start(G, P, { size: 6, wins: 2 }, 7, 0);
  const [x, y] = s.order;
  assert.equal(G.colorOf(s, x), 1);
  // fin de manche forcée : x gagne
  s.board = Array(36).fill(1); s.board[0] = 0; s.board[1] = 2;
  s.side = 0;
  s = apply(G, s, x, { type: "play", i: 0 });
  assert.ok(s.done && !s.result);
  assert.equal(s.score[x], 1);
  assert.deepEqual(G.toAct(s), [y], "l'autre lance la manche suivante");
  assert.throws(() => apply(G, s, y, { type: "play", i: 3 }), /suivante/);
  s = apply(G, s, y, { type: "next" });
  assert.equal(s.game, 2);
  assert.equal(G.colorOf(s, y), 1, "les couleurs s'inversent");
  assert.deepEqual(G.toAct(s), [y]);
  assert.equal(G.countOf(s.board, 0), 32);
});

test("options : tailles, départ en ligne, valeurs invalides", () => {
  const n = (settings) => { const s = start(G, P, settings, 1, 0); return [s.n, s.board.length, s.hints, s.start, s.wins]; };
  assert.deepEqual(n({}), [8, 64, true, "croix", 1]);
  assert.deepEqual(n({ size: 6, hints: false }), [6, 36, false, "croix", 1]);
  assert.deepEqual(n({ size: 10, start: "ligne", wins: 3 }), [10, 100, true, "ligne", 3]);
  assert.deepEqual(n({ size: 7, hints: "x", start: "zz", wins: 9 }), [8, 64, true, "croix", 1]);
  const s = start(G, P, { start: "ligne" }, 1, 0);
  assert.equal(s.board[27], 1); assert.equal(s.board[28], 1);
  assert.equal(s.board[35], 2); assert.equal(s.board[36], 2);
  assert.ok(G.legalMoves(s.board, 8, 1).length > 0);
});

const optOf = (k) => G.options.find((o) => o.key === k);
const defaults = () => Object.fromEntries(G.options.map((o) => [o.key, o.def]));

test("options et modes bien formés", () => {
  assert.ok(G.options.length >= 2 && G.options.length <= 5);
  for (const o of G.options) {
    assert.ok(o.values.some((v) => v[0] === o.def), o.key);
    assert.ok(o.label.length <= 12, o.label);
    for (const v of o.values) { assert.ok(v[1].length <= 12, v[1]); if (v[2]) assert.ok(v[2].length <= 18, v[2]); }
    assert.ok(!["level", "turnTime", "mode"].includes(o.key));
  }
  assert.ok(G.modes.length >= 3 && G.modes.length <= 4);
  assert.equal(G.modes[0].name, "Classique");
  assert.deepEqual(G.modes[0].set, defaults());
  const combos = new Set(G.modes.map((m) => JSON.stringify(m.set)));
  assert.equal(combos.size, G.modes.length, "modes distincts");
  for (const m of G.modes) for (const [k, v] of Object.entries(m.set)) assert.ok(optOf(k).values.some((x) => x[0] === v), `${m.id}.${k}`);
  const txt = JSON.stringify([G.meta, G.options, G.modes]);
  assert.ok(!txt.includes("\u2014"), "pas de tiret cadratin");
  assert.ok(!/othello/i.test(txt));
});

test("joueur en trop : il regarde et finit classé", () => {
  const { st } = playout(G, 3, 4, { settings: { size: 6 } });
  assert.equal(st.order.length, 2);
  assert.equal(st.result.ranking.find((r) => r.id === "p2").rank, 3);
});
