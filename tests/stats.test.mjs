import test from "node:test";
import assert from "node:assert/strict";
import { compute, toRow, dur, pct } from "../js/statsCalc.js";
import { restore, modeOf, defaultsOf } from "../js/prefs.js";
import { VISIBLE as GAMES, loadGame } from "../js/games/index.js";

const T = Date.UTC(2026, 9, 3, 10); // un samedi
const row = (game, outcome, at, extra = {}) => toRow([game, outcome, extra.place ?? null, extra.gems ?? 10, extra.xp ?? 50, extra.score ?? null, extra.dur ?? 60, at, extra.humans ?? 1, extra.mode ?? null]);

test("statistiques : totaux, séries, solo et amis, records", () => {
  const rows = [
    row("yams", "win", T, { dur: 300, score: 210 }),
    row("yams", "win", T + 1e6, { dur: 120, score: 250 }),
    row("poker", "lose", T + 2e6, { humans: 3, place: 2, gems: 15 }),
    row("yams", "win", T + 3e6, { dur: 30 }),
    row("poker", "draw", T + 4e6, { humans: 2, place: 1, gems: 15 }),
    row("sudoku", "win", T + 864e5 * 2, { humans: 2, place: 1, gems: 30, dur: 600 }),
  ];
  const S = compute(rows);
  assert.equal(S.n, 6); assert.equal(S.win, 4); assert.equal(S.draw, 1); assert.equal(S.lose, 1);
  assert.equal(S.best, 2, "meilleure série");
  assert.equal(S.cur, 1, "série en cours");
  assert.deepEqual(S.solo, { n: 3, w: 3 });
  assert.deepEqual(S.multi, { n: 3, w: 1 });
  assert.deepEqual(S.podium, [2, 1, 0]);
  assert.equal(S.avgPlace, 4 / 3);
  assert.equal(S.games[0].id, "yams");
  assert.equal(S.games[0].best, 250);
  assert.equal(S.activeDays, 2);
  assert.equal(S.bestDay.n, 5);
  assert.equal(S.longest.dur, 600);
  assert.equal(S.fastestWin.dur, 30);
  assert.equal(S.bigGain.gems, 30);
  assert.equal(S.week.reduce((a, b) => a + b, 0), 6);
  assert.equal(S.slots.reduce((a, b) => a + b, 0), 6);
  assert.equal(S.time, 300 + 120 + 60 + 30 + 60 + 600);
});

test("statistiques : aucune partie", () => {
  const S = compute([]);
  assert.equal(S.n, 0); assert.equal(S.best, 0); assert.equal(S.avgPlace, null); assert.equal(S.longest, null);
});

test("durées et pourcentages lisibles", () => {
  assert.equal(dur(42), "42 s");
  assert.equal(dur(600), "10 min");
  assert.equal(dur(3600), "1 h");
  assert.equal(dur(8100), "2 h 15");
  assert.equal(pct(1, 3), 33);
  assert.equal(pct(0, 0), 0);
});

test("réglages : restauration prudente et mode reconnu", () => {
  const options = [{ key: "a", values: [[1, "1"], [2, "2"]], def: 1 }, { key: "b", values: [[true, "oui"], [false, "non"]], def: true }];
  const modes = [{ id: "classique", set: { a: 1, b: true } }, { id: "dur", set: { a: 2, b: false } }];
  assert.deepEqual(restore(options, { a: 2, b: "n'importe quoi", c: 9 }), { a: 2, b: true });
  assert.equal(modeOf(modes, options, defaultsOf(options)), "classique");
  assert.equal(modeOf(modes, options, { a: 2, b: false }), "dur");
  assert.equal(modeOf(modes, options, { a: 2, b: true }), "perso");
});

test("chaque jeu déclare des options et des modes cohérents", async () => {
  for (const g of GAMES) {
    const m = await loadGame(g.id);
    assert.ok(Array.isArray(m.options) && m.options.length >= 2, `${g.id} : au moins 2 options`);
    assert.ok(Array.isArray(m.modes) && m.modes.length >= 3, `${g.id} : au moins 3 modes`);
    const keys = new Set();
    for (const o of m.options) {
      assert.ok(!keys.has(o.key), `${g.id} : clé ${o.key} en double`); keys.add(o.key);
      assert.ok(!["level", "turnTime", "mode"].includes(o.key), `${g.id} : clé réservée ${o.key}`);
      assert.ok(o.values.some(([v]) => v === o.def), `${g.id} : défaut de ${o.key} absent`);
    }
    assert.equal(modeOf(m.modes, m.options, defaultsOf(m.options)), m.modes[0].id, `${g.id} : le premier mode = défauts`);
    for (const md of m.modes) {
      for (const [k, v] of Object.entries(md.set)) {
        const o = m.options.find((x) => x.key === k);
        assert.ok(o, `${g.id}/${md.id} : option ${k} inconnue`);
        assert.ok(o.values.some(([x]) => x === v), `${g.id}/${md.id} : valeur ${v} invalide pour ${k}`);
      }
      const conf = { ...defaultsOf(m.options), ...md.set };
      assert.notEqual(modeOf(m.modes, m.options, conf), "perso", `${g.id}/${md.id} : mode non reconnu`);
    }
  }
});
