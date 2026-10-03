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
