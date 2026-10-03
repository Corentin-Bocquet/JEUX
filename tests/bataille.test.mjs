import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/bataille.js";
import { start, apply, rng } from "../js/engine.js";
import { playout, timeoutPlayout } from "./harness.mjs";

const FL = [
  { x: 0, y: 0, dir: "h", size: 5 }, { x: 0, y: 1, dir: "h", size: 4 }, { x: 0, y: 2, dir: "h", size: 3 },
  { x: 0, y: 3, dir: "h", size: 3 }, { x: 0, y: 4, dir: "h", size: 2 },
];

test("validation de la flotte", () => {
  assert.ok(G.validFleet(FL));
  assert.equal(G.validFleet([...FL.slice(0, 4), { x: 9, y: 4, dir: "h", size: 2 }]), null, "hors grille");
  assert.equal(G.validFleet([...FL.slice(0, 4), { x: 1, y: 0, dir: "v", size: 2 }]), null, "chevauchement");
  assert.equal(G.validFleet(FL.slice(0, 4)), null, "navire manquant");
  for (let i = 0; i < 50; i++) assert.ok(G.validFleet(G.randomFleet(rng(i))));
});

test("tirs, coulé, victoire", () => {
  let s = start(G, [{ id: "a" }, { id: "b" }], {}, 1, 0);
  assert.throws(() => apply(G, s, "a", { type: "shoot", cell: 0 }), /Place|tour/);
  s = apply(G, s, "a", { type: "place", ships: FL });
  s = apply(G, s, "b", { type: "place", ships: FL });
  assert.equal(s.phase, "play");
  let [p, q] = s.order;
  s = apply(G, s, p, { type: "shoot", cell: 40 });
  assert.equal(s.last.hit, true);
  assert.throws(() => apply(G, s, p, { type: "shoot", cell: 41 }), /tour/);
  s = apply(G, s, q, { type: "shoot", cell: 99 });
  assert.equal(s.last.hit, false);
  assert.throws(() => apply(G, s, p, { type: "shoot", cell: 40 }), /Déjà/);
  s = apply(G, s, p, { type: "shoot", cell: 41 });
  assert.equal(s.last.sunk, "Torpilleur");
  // p coule tout, q tire dans l'eau
  const targets = [0, 1, 2, 3, 4, 10, 11, 12, 13, 20, 21, 22, 30, 31, 32];
  let miss = 98;
  for (const c of targets) {
    s = apply(G, s, q, { type: "shoot", cell: miss-- });
    s = apply(G, s, p, { type: "shoot", cell: c });
  }
  assert.equal(s.result.ranking.find((r) => r.id === p).rank, 1);
});

test("parties complètes robot contre robot", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const { st } = playout(G, 2, seed, { settings: { level: 1 + (seed % 3) } });
    assert.ok(Object.keys(st.shots[st.result.ranking.find((r) => r.rank === 1).id]).length >= 17);
  }
  timeoutPlayout(G, 2, 3);
});

// ---------------------------------------------------------------- options et modes
const optOf = (k) => G.options.find((o) => o.key === k);
const defaults = () => Object.fromEntries(G.options.map((o) => [o.key, o.def]));

test("options et modes bien formés", () => {
  assert.ok(G.options.length >= 2 && G.options.length <= 5);
  for (const o of G.options) {
    assert.ok(o.values.some((v) => v[0] === o.def), o.key);
    for (const v of o.values) { assert.ok(v[1].length <= 12); if (v[2]) assert.ok(v[2].length <= 18); }
    assert.ok(!["level", "turnTime"].includes(o.key));
  }
  assert.ok(G.modes.length >= 3 && G.modes.length <= 4);
  assert.equal(G.modes[0].name, "Classique");
  assert.deepEqual(G.modes[0].set, defaults());
  for (const m of G.modes) for (const [k, v] of Object.entries(m.set)) assert.ok(optOf(k).values.some((x) => x[0] === v), `${m.id}.${k}`);
});

test("grille 8 x 8 et flottes", () => {
  let s = start(G, [{ id: "a" }, { id: "b" }], { size: 8, fleet: "reduite" }, 1, 0);
  assert.equal(G.gridOf(s), 8);
  assert.equal(G.fleetOf(s).length, 3);
  assert.equal(G.validFleet(FL, G.fleetOf(s), 8), null, "flotte classique refusée");
  const small = [{ x: 0, y: 0, dir: "h", size: 4 }, { x: 0, y: 1, dir: "h", size: 3 }, { x: 6, y: 7, dir: "h", size: 2 }];
  assert.ok(G.validFleet(small, G.fleetOf(s), 8));
  assert.equal(G.validFleet([...small.slice(0, 2), { x: 7, y: 7, dir: "h", size: 2 }], G.fleetOf(s), 8), null, "déborde du 8 x 8");
  for (const fleet of Object.keys(G.FLEETS)) for (const n of [8, 10]) for (let i = 0; i < 20; i++) {
    assert.ok(G.validFleet(G.randomFleet(rng(i), G.FLEETS[fleet], n), G.FLEETS[fleet], n), `${fleet} ${n}`);
  }
  assert.equal(G.FLEETS.grande.reduce((t, f) => t + f.size, 0), 23);
  s = apply(G, s, "a", { type: "place", ships: small });
  s = apply(G, s, "b", { type: "place", random: true, seed: 5 });
  assert.equal(s.fleets.b.length, 3);
  assert.ok(s.fleets.b.every((x) => x.cells.every((c) => c < 64)));
  const p = s.order[0];
  assert.throws(() => apply(G, s, p, { type: "shoot", cell: 64 }), /invalide/);
  // valeurs inconnues : retour aux défauts
  const d = start(G, [{ id: "a" }, { id: "b" }], { size: 9, fleet: "geante", again: "oui" }, 1, 0);
  assert.deepEqual([G.gridOf(d), G.fleetOf(d).length, d.again], [10, 5, false]);
});

test("touché, tu rejoues", () => {
  let s = start(G, [{ id: "a" }, { id: "b" }], { again: true }, 1, 0);
  s = apply(G, s, "a", { type: "place", ships: FL });
  s = apply(G, s, "b", { type: "place", ships: FL });
  const [p, q] = s.order;
  s = apply(G, s, p, { type: "shoot", cell: 0 });
  assert.deepEqual(G.toAct(s), [p], "touché : encore à toi");
  s = apply(G, s, p, { type: "shoot", cell: 99 });
  assert.deepEqual(G.toAct(s), [q], "à l'eau : la main passe");
  // sans l'option, la main passe même en touchant
  let t = start(G, [{ id: "a" }, { id: "b" }], {}, 1, 0);
  t = apply(G, t, "a", { type: "place", ships: FL });
  t = apply(G, t, "b", { type: "place", ships: FL });
  t = apply(G, t, t.order[0], { type: "shoot", cell: 0 });
  assert.deepEqual(G.toAct(t), [t.order[1]]);
});

test("le robot fort finit le navire touché et gagne contre le moyen", () => {
  let s = start(G, [{ id: "a" }, { id: "b" }], { level: 3, size: 8, fleet: "reduite" }, 1, 0);
  const ships = [{ x: 0, y: 0, dir: "h", size: 4 }, { x: 0, y: 2, dir: "v", size: 3 }, { x: 5, y: 5, dir: "v", size: 2 }];
  s = apply(G, s, "a", { type: "place", ships });
  s = apply(G, s, "b", { type: "place", ships });
  const p = s.order[0], q = s.order[1];
  s = apply(G, s, p, { type: "shoot", cell: 1 });
  s = apply(G, s, q, { type: "shoot", cell: 63 });
  const a = G.bot(s, p, rng(1));
  assert.ok([0, 2, 9].includes(a.cell), `tir autour de la touche, pas ${a.cell}`);
  // sur 30 parties, le fort bat le moyen plus souvent
  let strong = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const r = rng(seed);
    let st = start(G, [{ id: "a" }, { id: "b" }], {}, seed, 0);
    while (!st.result) {
      const pid = G.toAct(st)[0];
      st.level = pid === "a" ? 3 : 2;
      st = apply(G, st, pid, { ...G.bot(st, pid, r), seed: r.int(1e9) });
    }
    if (st.result.ranking.find((x) => x.id === "a").rank === 1) strong++;
  }
  assert.ok(strong >= 17, `le fort gagne ${strong}/30`);
});

test("parties complètes pour chaque mode", () => {
  for (const m of G.modes) for (let seed = 1; seed <= 6; seed++) {
    const { st } = playout(G, 2, seed, { settings: { ...m.set, level: 1 + (seed % 3) } });
    const total = G.fleetOf(st).reduce((t, f) => t + f.size, 0);
    const w = st.result.ranking.find((r) => r.rank === 1).id;
    assert.equal(Object.values(st.shots[w]).filter((x) => x === "hit").length, total);
    assert.ok(Object.keys(st.shots[w]).every((c) => +c < m.set.size ** 2));
  }
  timeoutPlayout(G, 2, 4, { ...G.modes[2].set, turnTime: 10 });
});
