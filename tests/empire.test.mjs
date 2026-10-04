import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/empire.js";
import { start, apply } from "../js/engine.js";
import { playout, timeoutPlayout } from "./harness.mjs";
import { BOARD, GROUPS, GROUP_CELLS, SURPRISE, SORT, PAWNS } from "../js/data/empire_plateau.js";

const P2 = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
const P3 = [...P2, { id: "c", name: "C" }];
const fresh = (settings = {}, players = P2) => start(G, players, settings, 7, 0);
// lance des dés précis : on cherche une graine qui donne la somme voulue
import { rng } from "../js/engine.js";
function seedFor(d1, d2) {
  for (let k = 1; k < 200000; k++) { const r = rng(k); if (1 + r.int(6) === d1 && 1 + r.int(6) === d2) return k; }
  throw new Error("pas de graine");
}
const roll = (s, pid, d1, d2) => apply(G, s, pid, { type: "roll", seed: seedFor(d1, d2) });

test("plateau et cartes valides", () => {
  assert.equal(BOARD.length, 40);
  assert.equal(BOARD.filter((c) => c.k === "prop").length, 22);
  assert.equal(BOARD.filter((c) => c.k === "station").length, 4);
  assert.equal(BOARD.filter((c) => c.k === "util").length, 2);
  for (const c of BOARD) if (c.k === "prop") { assert.equal(c.r.length, 6); assert.ok(GROUPS[c.g]); assert.ok(c.r.every((v, i) => !i || v > c.r[i - 1])); }
  const names = BOARD.filter((c) => c.p).map((c) => c.n);
  assert.equal(new Set(names).size, names.length, "noms uniques");
  assert.equal(SURPRISE.length, 16); assert.equal(SORT.length, 16);
  for (const c of [...SURPRISE, ...SORT]) {
    assert.ok(c.t.length > 10 && !c.t.includes("\u2014"));
    if (c.k === "goto" || c.k === "to") assert.ok(c.v >= 0 && c.v < 40);
  }
  assert.equal(PAWNS.length, 6);
  assert.deepEqual(GROUP_CELLS.bleu, [37, 39]);
});

test("achat, loyer simple puis doublé avec le groupe", () => {
  let s = fresh();
  const [x, y] = s.order;
  assert.throws(() => apply(G, s, y, { type: "roll" }), /tour/);
  s = roll(s, x, 1, 2); // case 3 : Rue du Moulin
  assert.equal(s.phase, "buy");
  assert.throws(() => apply(G, s, x, { type: "end" }), /Termine/);
  s = apply(G, s, x, { type: "buy" });
  assert.equal(s.own[3], x); assert.equal(s.P[x].cash, 1440);
  s = apply(G, s, x, { type: "end" });
  s = roll(s, y, 1, 2);
  assert.equal(s.P[y].cash, 1496);
  assert.equal(s.P[x].cash, 1444);
  // le groupe complet double le loyer nu
  s.own[1] = x;
  assert.equal(G.rentOf(s, 3, 7), 8);
  assert.equal(G.rentOf(s, 1, 7), 4);
});

test("gares, compagnies et hypothèque", () => {
  const s = fresh();
  const [x] = s.order;
  s.own[5] = x; s.own[15] = x; s.own[25] = x;
  assert.equal(G.rentOf(s, 5, 7), 100);
  s.own[12] = x;
  assert.equal(G.rentOf(s, 12, 9), 36);
  s.own[28] = x;
  assert.equal(G.rentOf(s, 12, 9), 90);
  s.mg[12] = 1;
  assert.equal(G.rentOf(s, 12, 9), 0);
});

test("construction équilibrée, revente et hypothèques", () => {
  let s = fresh();
  const [x] = s.order;
  s.own[1] = x; s.own[3] = x;
  assert.throws(() => apply(G, s, x, { type: "build", cell: 6 }), /pas à toi/);
  s = apply(G, s, x, { type: "build", cell: 1 });
  assert.equal(s.hs[1], 1); assert.equal(s.P[x].cash, 1450);
  assert.throws(() => apply(G, s, x, { type: "build", cell: 1 }), /impossible/);
  s = apply(G, s, x, { type: "build", cell: 3 });
  assert.equal(G.rentOf(s, 3, 7), 20);
  assert.throws(() => apply(G, s, x, { type: "mortgage", cell: 1 }), /impossible/);
  assert.throws(() => apply(G, s, x, { type: "sell", cell: 1 }).hs && apply(G, apply(G, s, x, { type: "build", cell: 1 }), x, { type: "sell", cell: 3 }), /impossible/);
  s = apply(G, s, x, { type: "sell", cell: 1 });
  assert.equal(s.P[x].cash, 1425);
  s = apply(G, s, x, { type: "sell", cell: 3 });
  s = apply(G, s, x, { type: "mortgage", cell: 3 });
  assert.equal(s.P[x].cash, 1480);
  assert.throws(() => apply(G, s, x, { type: "build", cell: 1 }), /impossible/);
  s = apply(G, s, x, { type: "unmortgage", cell: 3 });
  assert.equal(s.P[x].cash, 1447);
  // hôtel = 5e niveau
  for (let k = 0; k < 5; k++) { s = apply(G, s, x, { type: "build", cell: 1 }); s = apply(G, s, x, { type: "build", cell: 3 }); }
  assert.equal(s.hs[3], 5);
  assert.equal(G.rentOf(s, 3, 7), 450);
  assert.throws(() => apply(G, s, x, { type: "build", cell: 3 }), /impossible/);
});

test("prison : 3 doubles, essais, caution forcée", () => {
  let s = fresh();
  const [x, y] = s.order;
  s = roll(s, x, 1, 1); // case 2, coup du sort : on neutralise la carte
  if (s.phase === "buy") s = apply(G, s, x, { type: "pass" });
  while (s.phase === "auction") s = apply(G, s, G.toAct(s)[0], { type: "bid", amount: 0 });
  if (s.P[x].jail) return; // carte prison tirée : cas déjà couvert
  assert.equal(s.phase, "roll", "un double fait rejouer");
  s.P[x].pos = 0;
  s = roll(s, x, 2, 2);
  if (s.phase === "buy") s = apply(G, s, x, { type: "pass" });
  while (s.phase === "auction") s = apply(G, s, G.toAct(s)[0], { type: "bid", amount: 0 });
  s.P[x].pos = 0;
  s = roll(s, x, 3, 3);
  assert.equal(s.P[x].pos, 10); assert.equal(s.P[x].jail, 1); assert.equal(s.phase, "end");
  s = apply(G, s, x, { type: "end" });
  s = roll(s, y, 1, 2);
  if (s.phase === "buy") s = apply(G, s, y, { type: "pass" });
  while (s.phase === "auction") s = apply(G, s, G.toAct(s)[0], { type: "bid", amount: 0 });
  s = apply(G, s, y, { type: "end" });
  assert.throws(() => apply(G, s, x, { type: "useCard" }), /carte/);
  s = roll(s, x, 1, 2);
  assert.equal(s.P[x].jail, 2); assert.equal(s.P[x].pos, 10);
  s.P[x].jail = 3; s.phase = "roll";
  const cash = s.P[x].cash;
  s = roll(s, x, 1, 3);
  assert.equal(s.P[x].jail, 0); assert.equal(s.P[x].pos, 14);
  assert.ok(s.P[x].cash <= cash - 50);
});

test("enchères à mise cachée et refus sans enchère", () => {
  let s = fresh({}, P3);
  const [x, y, z] = s.order;
  s = roll(s, x, 1, 2);
  s = apply(G, s, x, { type: "pass" });
  assert.equal(s.phase, "auction");
  assert.deepEqual(G.toAct(s).sort(), [x, y, z].sort());
  assert.throws(() => apply(G, s, y, { type: "bid", amount: 99999 }), /assez/);
  s = apply(G, s, y, { type: "bid", amount: 80 });
  s = apply(G, s, z, { type: "bid", amount: 80 });
  assert.throws(() => apply(G, s, y, { type: "bid", amount: 90 }), /tour/);
  s = apply(G, s, x, { type: "bid", amount: 10 });
  // égalité : le plus proche dans l'ordre après le joueur courant
  assert.equal(s.own[3], y); assert.equal(s.P[y].cash, 1420);
  let t = fresh({ auction: 0 });
  t = roll(t, t.order[0], 1, 2);
  t = apply(G, t, t.order[0], { type: "pass" });
  assert.equal(t.phase, "end"); assert.equal(t.own[3], "");
});

test("échange : proposer, accepter, refuser", () => {
  let s = fresh();
  const [x, y] = s.order;
  s.own[1] = x; s.own[3] = y;
  assert.throws(() => apply(G, s, x, { type: "offer", to: y, cell: 6, cash: 10 }), /ni à toi/);
  assert.throws(() => apply(G, s, x, { type: "offer", to: y, cell: 3, cash: 999999 }), /assez/);
  s = apply(G, s, x, { type: "offer", to: y, cell: 3, cash: 150 });
  assert.deepEqual(G.toAct(s), [y]);
  s = apply(G, s, y, { type: "accept" });
  assert.equal(s.own[3], x); assert.equal(s.P[x].cash, 1350); assert.equal(s.P[y].cash, 1650);
  assert.equal(s.phase, "roll");
  s = apply(G, s, x, { type: "offer", to: y, cell: 1, cash: 50 });
  s = apply(G, s, y, { type: "refuse" });
  assert.equal(s.own[1], x);
  s = apply(G, s, x, { type: "build", cell: 1 });
  assert.throws(() => apply(G, s, x, { type: "offer", to: y, cell: 3, cash: 0 }), /bâti|Trois/);
});

test("dette, vente forcée et faillite", () => {
  let s = fresh();
  const [x, y] = s.order;
  // y possède le groupe bleu avec hôtels, x est presque ruiné
  s.own[37] = y; s.own[39] = y; s.hs[37] = 5; s.hs[39] = 5;
  s.own[1] = x; s.P[x].cash = 100; s.P[x].pos = 33;
  s = roll(s, x, 3, 3); // case 39
  assert.equal(s.phase, "debt");
  assert.throws(() => apply(G, s, x, { type: "pay" }), /assez/);
  assert.throws(() => apply(G, s, x, { type: "end" }), /Termine/);
  s = apply(G, s, x, { type: "bankrupt" });
  assert.ok(s.P[x].out);
  assert.equal(s.own[1], y);
  assert.ok(s.result);
  assert.equal(s.result.ranking[0].id, y);
  assert.equal(s.result.ranking[1].score, 0);
  // dette couvrable : faillite refusée, règlement automatique
  let t = fresh();
  const [u, v] = t.order;
  t.own[37] = v; t.P[u].pos = 33; t.P[u].cash = 10; t.own[21] = u; t.own[23] = u;
  t = roll(t, u, 2, 2);
  assert.equal(t.phase, "debt");
  assert.throws(() => apply(G, t, u, { type: "bankrupt" }), /encore payer/);
  t = apply(G, t, u, { type: "settle" });
  assert.notEqual(t.phase, "debt");
  assert.equal(t.mg[21] + t.mg[23] >= 1, true);
});

test("durée maximale : le plus riche gagne", () => {
  let s = fresh({ turns: 15 });
  s.tour = 15;
  const [x, y] = s.order;
  s.phase = "end"; s.cur = 1; s.own[39] = y;
  s = apply(G, s, y, { type: "end" });
  assert.ok(s.result);
  assert.equal(s.result.ranking[0].id, y);
  assert.equal(s.result.ranking[0].score, 1900);
});

test("partie rapide : 2 rues offertes, jamais de groupe complet", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const s = start(G, [...P3, { id: "d" }, { id: "e" }, { id: "f" }], G.modes[1].set, seed, 0);
    for (const id of s.order) {
      const mine = G.propsOf(s, id);
      assert.equal(mine.length, 2);
      assert.ok(mine.every((i) => !G.ownsAll(s, id, BOARD[i].g)));
    }
  }
});

test("robots : achètent et construisent", () => {
  let built = 0, bought = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const { st } = playout(G, 4, seed, { settings: { level: 3 } });
    built += st.hs.reduce((a, b) => a + b, 0) + (st.log.some((l) => /bâtit/.test(l.m)) ? 1 : 0);
    bought += st.own.filter(Boolean).length;
  }
  assert.ok(bought > 20); assert.ok(built > 0);
});

test("parties complètes pour chaque mode, 2 et 6 joueurs", () => {
  for (const m of G.modes) for (const n of [2, 3, 6]) for (let seed = 1; seed <= 3; seed++) {
    const { st } = playout(G, n, seed, { settings: { ...m.set, level: 1 + (seed % 3) } });
    assert.ok(st.tour <= m.set.turns);
    assert.ok(JSON.stringify(st).length < 30000);
  }
  timeoutPlayout(G, 2, 9);
  timeoutPlayout(G, 6, 5, { ...G.modes[1].set, turnTime: 10 });
});

// ---------------------------------------------------------------- options et modes
const optOf = (k) => G.options.find((o) => o.key === k);
const defaults = () => Object.fromEntries(G.options.map((o) => [o.key, o.def]));
test("options et modes bien formés", () => {
  assert.ok(G.options.length >= 2 && G.options.length <= 5);
  for (const o of G.options) {
    assert.ok(o.label.length <= 12, o.key);
    assert.ok(o.values.some((v) => v[0] === o.def), o.key);
    for (const v of o.values) { assert.ok(v[1].length <= 12); if (v[2]) assert.ok(v[2].length <= 18, v[2]); }
    assert.ok(!["level", "turnTime", "mode"].includes(o.key));
  }
  assert.ok(G.modes.length >= 3 && G.modes.length <= 4);
  assert.equal(G.modes[0].name, "Classique");
  assert.deepEqual(G.modes[0].set, defaults());
  const combos = new Set(G.modes.map((m) => JSON.stringify(m.set)));
  assert.equal(combos.size, G.modes.length);
  for (const m of G.modes) for (const [k, v] of Object.entries(m.set)) assert.ok(optOf(k).values.some((x) => x[0] === v), `${m.id}.${k}`);
  const s = fresh({ cash: "x", turns: 7, parc: 5 });
  assert.equal(s.P.a.cash, 1500); assert.equal(s.maxT, 30); assert.equal(s.parc, 0);
  assert.equal(fresh({ cash: 2000 }).P.b.cash, 2000);
});
