// Réglages d'une partie : grandes cartes de modes + carrousels de mini cartes par option.
import { h, sfx } from "../ui.js";
import { SETTINGS } from "../games/index.js";
import { defaultsOf, restore, modeOf } from "../prefs.js";
export { defaultsOf, restore, modeOf };

// options et modes déclarés par le jeu (export options / modes), sinon repli sur l'ancien format
export function gameOptions(mod, id) {
  const options = Array.isArray(mod.options) && mod.options.length ? mod.options
    : (SETTINGS[id] || []).map(([key, label, values, def]) => ({ key, label, values, def }));
  const modes = Array.isArray(mod.modes) ? mod.modes : [];
  return { options, modes };
}

// carrousel générique de mini cartes : items = [{ v, t, sub?, em? }]
export function carousel(items, get, set, { label, icon, wide } = {}) {
  const row = h("div", { class: "carousel", role: "radiogroup", "aria-label": label || "" });
  const draw = () => row.replaceChildren(...items.map((it) => h("button", {
    type: "button", role: "radio", "aria-checked": get() === it.v ? "true" : "false",
    class: "mcard" + (get() === it.v ? " on" : "") + (wide ? " wide" : ""),
    onclick: () => { if (get() === it.v) return; set(it.v); sfx.tap(); draw(); },
  }, it.em ? h("span", { class: "em" }, it.em) : null, h("b", null, it.t), it.sub ? h("small", null, it.sub) : null)));
  draw();
  const box = h("div", { class: "optc" }, label ? h("div", { class: "optl" }, icon ? h("span", null, icon) : null, label) : null, row);
  box.redraw = draw;
  // fait défiler jusqu'à la carte choisie
  requestAnimationFrame(() => { const on = row.querySelector(".on"); if (on) row.scrollLeft = Math.max(0, on.offsetLeft - 16); });
  return box;
}

// sélecteur complet : modes + options ; conf est modifié en place
export function picker({ options, modes, conf, color, onChange }) {
  const wrap = h("div", { class: "picker", style: `--gc:${color || "var(--blue)"}` });
  const optBoxes = [];
  const modeRow = h("div", { class: "carousel modes" });
  const changed = () => { drawModes(); onChange && onChange(conf); };
  const drawModes = () => {
    if (!modes.length) return;
    const cur = modeOf(modes, options, conf);
    const cards = modes.map((m) => h("button", {
      type: "button", class: "modecard" + (cur === m.id ? " on" : ""), "aria-pressed": cur === m.id ? "true" : "false",
      onclick: () => { Object.assign(conf, { ...defaultsOf(options), ...m.set }); sfx.tap(); optBoxes.forEach((b) => b.redraw()); changed(); },
    }, h("span", { class: "em" }, m.emoji || "🎮"), h("b", null, m.name), h("small", null, m.desc || "")));
    if (cur === "perso") cards.push(h("div", { class: "modecard on perso" }, h("span", { class: "em" }, "🛠️"), h("b", null, "Personnalisé"), h("small", null, "Tes propres réglages")));
    modeRow.replaceChildren(...cards);
  };
  if (modes.length) wrap.append(h("div", { class: "optl" }, h("span", null, "✨"), "Mode de jeu"), modeRow);
  for (const o of options) {
    const items = o.values.map(([v, t, sub]) => ({ v, t, sub }));
    const b = carousel(items, () => conf[o.key], (v) => { conf[o.key] = v; changed(); }, { label: o.label, icon: o.icon });
    optBoxes.push(b);
    wrap.append(b);
  }
  drawModes();
  return wrap;
}

// résumé lisible des réglages (salle d'attente)
export function summary(options, modes, settings) {
  const conf = restore(options, settings);
  const m = modes.find((x) => x.id === modeOf(modes, options, conf));
  const chips = options.map((o) => {
    const val = o.values.find(([v]) => v === conf[o.key]);
    return h("span", { class: "chip" }, o.icon ? o.icon + " " : "", o.label, " : ", h("b", null, val ? val[1] : String(conf[o.key])));
  });
  return { mode: m || null, chips };
}
