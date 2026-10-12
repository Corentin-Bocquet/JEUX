// Vérifications communes des réglages (jeux de rôles cachés)
import assert from "node:assert/strict";
export function checkOptions(G) {
  const defaults = Object.fromEntries(G.options.map((o) => [o.key, o.def]));
  assert.ok(G.options.length >= 2 && G.options.length <= 5);
  for (const o of G.options) {
    assert.ok(o.label.length <= 12, o.label);
    assert.ok(o.values.some((v) => v[0] === o.def), o.key);
    for (const v of o.values) { assert.ok(v[1].length <= 12, v[1]); if (v[2]) assert.ok(v[2].length <= 18, v[2]); }
    assert.ok(!["level", "turnTime", "mode"].includes(o.key));
  }
  assert.ok(G.modes.length >= 3 && G.modes.length <= 4);
  assert.equal(G.modes[0].name, "Classique");
  assert.deepEqual(G.modes[0].set, defaults);
  const seen = new Set();
  for (const m of G.modes) {
    for (const [k, v] of Object.entries(m.set)) assert.ok(G.options.find((o) => o.key === k).values.some((x) => x[0] === v), `${m.id}.${k}`);
    const key = JSON.stringify(G.options.map((o) => (o.key in m.set ? m.set[o.key] : o.def)));
    assert.ok(!seen.has(key), "modes distincts"); seen.add(key);
  }
}
