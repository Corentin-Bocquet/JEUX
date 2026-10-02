// Fait jouer des robots entre eux jusqu'au bout, en vérifiant à chaque coup
// que l'état reste sérialisable et que la partie se termine avec un classement valide.
import assert from "node:assert/strict";
import { start, apply, rng as mkRng } from "../js/engine.js";

export function playout(game, nPlayers, seed, { settings = {}, maxSteps = 20000, onStep } = {}) {
  const players = Array.from({ length: nPlayers }, (_, i) => ({ id: "p" + i, name: "J" + i, bot: true }));
  const r = mkRng(seed);
  let now = 1_000_000;
  let st = start(game, players, settings, r.int(2 ** 32), now);
  let steps = 0;
  while (!st.result) {
    assert.ok(++steps < maxSteps, `${game.meta.id} : partie sans fin (graine ${seed})`);
    const who = game.toAct(st);
    assert.ok(who.length > 0, `${game.meta.id} : personne ne doit jouer (graine ${seed})`);
    const pid = who[r.int(who.length)];
    const a = game.bot(st, pid, r);
    now += 1000;
    if (!a) continue; // robot qui attend (jeux de course)
    const prev = JSON.stringify(st);
    st = apply(game, st, pid, { ...a, seed: r.int(2 ** 32), now }, settings);
    assert.equal(JSON.stringify(JSON.parse(prev)), prev, "l'ancien état ne doit pas changer");
    JSON.parse(JSON.stringify(st));
    if (onStep) onStep(st, pid, a);
  }
  const rk = st.result.ranking;
  assert.equal(rk.length, nPlayers, "tout le monde est classé");
  assert.deepEqual(new Set(rk.map((x) => x.id)).size, nPlayers);
  assert.ok(rk.some((x) => x.rank === 1), "au moins un premier");
  return { st, steps };
}

// Vérifie que les délais dépassés font avancer la partie
export function timeoutPlayout(game, nPlayers, seed, settings = { turnTime: 10 }) {
  const players = Array.from({ length: nPlayers }, (_, i) => ({ id: "p" + i, name: "J" + i }));
  let now = 5_000_000;
  let st = start(game, players, settings, seed, now);
  let n = 0;
  while (!st.result && n++ < 5000) {
    assert.ok(st._dl > 0, "un délai doit être posé");
    now = st._dl + 1;
    st = apply(game, st, "p0", { type: "timeout", who: st._who, seed: n * 7919, now }, settings);
  }
  assert.ok(st.result, `${game.meta.id} : les délais seuls doivent finir la partie`);
  return st;
}
