import { h } from "../ui.js";
import { nameOf } from "./common.js";
import { candidates, HINT } from "../games/sudoku.js";

export const scoreOf = (s, id) => s.scores[id];
const COLORS = ["#1CB0F6", "#FF9600", "#CE82FF", "#58CC02"];

export function mount(root, ctx0) {
  const el = h("div", { class: "g-sudoku" });
  root.append(el);
  let sel = -1, notesMode = false;
  const notes = {}; // notes au crayon, locales à ce joueur
  let lastKey = "";
  function update(ctx) {
    const s = ctx.state;
    if (s.last) {
      const k = JSON.stringify(s.last);
      if (k !== lastKey && lastKey) {
        if (s.last.id === ctx.me) s.last.ok ? (s.last.bonus ? ctx.sfx.win() : ctx.sfx.ok()) : (ctx.sfx.bad(), ctx.buzz(40));
        else if (s.last.ok) ctx.sfx.tap();
      }
      lastKey = k;
    }
    if (sel >= 0 && s.grid[sel]) sel = -1;
    draw(ctx);
  }
  function draw(ctx) {
    const s = ctx.state;
    const colorOf = (id) => COLORS[s.ids.indexOf(id) % COLORS.length];
    const selVal = sel >= 0 ? s.grid[sel] : 0;
    const grid = h("div", { class: "sd-grid", role: "grid", "aria-label": "Grille de sudoku" });
    for (let i = 0; i < 81; i++) {
      const r = Math.floor(i / 9), c = i % 9;
      const v = s.grid[i];
      const peer = sel >= 0 && (Math.floor(sel / 9) === r || sel % 9 === c || (Math.floor(r / 3) === Math.floor(Math.floor(sel / 9) / 3) && Math.floor(c / 3) === Math.floor((sel % 9) / 3)));
      const cls = ["sd-cell"];
      if (c % 3 === 2 && c < 8) cls.push("br"); if (r % 3 === 2 && r < 8) cls.push("bb");
      if (peer) cls.push("peer"); if (i === sel) cls.push("sel");
      if (v && selVal && v === selVal) cls.push("same");
      if (s.last && s.last.cell === i && !s.last.ok && s.last.id === ctx.me) cls.push("wrong");
      if (s.last && s.last.cell === i && s.last.ok) cls.push("pop");
      const owner = s.owner[i];
      const style = owner === HINT ? "color:var(--txt);opacity:.6;font-style:italic" : owner && owner !== "" ? `color:${colorOf(owner)}` : null;
      const n = notes[i];
      grid.append(h("button", { class: cls.join(" ") + (owner === "" ? " given" : ""), style, "aria-label": `Ligne ${r + 1} colonne ${c + 1}${v ? " : " + v : ""}`,
        onclick: () => { sel = v ? -1 : i; ctx.sfx.tap(); draw(ctx); } },
        v ? String(v) : n && n.size ? h("span", { class: "notes" }, [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => h("i", null, n.has(d) ? d : ""))) : ""));
    }
    const pen = s.penalty ?? 1;
    // bouton coup de pouce seulement si l'option est active et que je joue
    const myHints = s.hintsMax > 0 && s.hints && s.hints[ctx.me] != null ? s.hints[ctx.me] : null;
    const remaining = (d) => 9 - s.grid.filter((x) => x === d).length;
    const pad = h("div", { class: "sd-pad" }, [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => h("button", { class: "sd-key", disabled: !remaining(d),
      onclick: () => press(ctx, d) }, String(d), h("small", null, remaining(d) || ""))));
    el.replaceChildren(
      h("div", { class: "row between small", style: { margin: "2px 2px 8px" } },
        h("span", { class: "dim" }, `${s.grid.filter((x) => !x).length} cases vides`),
        h("span", { class: "row gap" }, s.ids.map((id) => h("span", { class: "row gap", style: { color: colorOf(id) } }, "●", nameOf(ctx, id), " ", h("b", null, s.scores[id]))))),
      grid,
      h("div", { class: "row gap center", style: { margin: "10px 0", flexWrap: "wrap" } },
        h("button", { class: "chip" + (notesMode ? " on" : ""), onclick: () => { notesMode = !notesMode; draw(ctx); } }, notesMode ? "Notes : oui" : "Notes : non"),
        h("button", { class: "chip", onclick: () => { if (sel >= 0) { delete notes[sel]; draw(ctx); } } }, "Effacer"),
        h("button", { class: "chip", onclick: () => { if (sel >= 0) { notes[sel] = new Set(candidates(s.grid, sel)); draw(ctx); } } }, "Candidats"),
        myHints != null ? h("button", { class: "chip", disabled: !myHints,
          onclick: () => { if (sel < 0) { ctx.toast("Choisis d'abord une case"); return; } ctx.act({ type: "hint", cell: sel }); } }, `Coup de pouce (${myHints})`) : null),
      pad,
      h("p", { class: "tiny dim center" }, `Bon chiffre +1, ligne/colonne/carré complété +3, erreur ${pen ? "-" + pen : "sans pénalité"}.`));
  }
  function press(ctx, d) {
    if (sel < 0) { ctx.toast("Choisis d'abord une case"); return; }
    if (notesMode) { const n = (notes[sel] = notes[sel] || new Set()); n.has(d) ? n.delete(d) : n.add(d); ctx.sfx.tap(); draw(ctx); return; }
    ctx.act({ type: "place", cell: sel, val: d });
  }
  update(ctx0);
  return { update };
}
