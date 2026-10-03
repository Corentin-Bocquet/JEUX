// Réglages des jeux : valeurs par défaut, restauration, mode correspondant (sans DOM, testable).
export const defaultsOf = (options) => Object.fromEntries(options.map((o) => [o.key, o.def]));

// valeurs mémorisées valides uniquement (une option peut avoir changé depuis)
export function restore(options, saved) {
  const out = defaultsOf(options);
  for (const o of options) if (saved && o.values.some(([v]) => v === saved[o.key])) out[o.key] = saved[o.key];
  return out;
}

export function modeOf(modes, options, conf) {
  const m = modes.find((md) => options.every((o) => (o.key in md.set ? md.set[o.key] : o.def) === conf[o.key]));
  return m ? m.id : "perso";
}
