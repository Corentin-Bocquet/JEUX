import { h } from "../ui.js";
import { turnLine, nameOf } from "./common.js";
import { dims, toAct, landing } from "../games/puissance4.js";

export const scoreOf = (s, id) => ((s.wins || 1) > 1 && s.score ? s.score[id] : null);

export function mount(root, ctx0) {
  const el = h("div", { class: "g-p4" });
  root.append(el);
  let prevLast = null;
  function update(ctx) {
    const s = ctx.state;
    const { w: W, h: H, k: K } = dims(s);
    const who = toAct(s);
    const mine = who.includes(ctx.me);
    const myColor = s.order.indexOf(ctx.me);
    const between = !!(s.win || s.full);
    const board = h("div", { class: "p4-board", role: "grid", "aria-label": "Grille de Puissance 4", style: { gridTemplateColumns: `repeat(${W}, 1fr)` } });
    for (let c = 0; c < W; c++) {
      const col = h("button", { class: "p4-col", style: { gridTemplateRows: `repeat(${H}, 1fr)` }, "aria-label": `Colonne ${c + 1}`, disabled: between || !mine || landing(s.board, c, W, H) < 0,
        onclick: () => { ctx.sfx.tap(); ctx.act({ type: "drop", col: c }); } });
      for (let r = 0; r < H; r++) {
        const i = r * W + c, v = s.board[i];
        const isNew = i === s.last && s.last !== prevLast;
        const win = s.win && s.win.cells.includes(i);
        col.append(h("span", { class: "p4-cell" }, v ? h("i", { class: `disc c${v}${isNew ? " drop" : ""}${win ? " win" : ""}`, style: isNew ? `--rows:${r + 1}` : null }) : null));
      }
      board.append(col);
    }
    if (s.last !== prevLast && s.last != null) ctx.sfx.card();
    prevLast = s.last;
    const match = (s.wins || 1) > 1 && s.score;
    const legend = h("div", { class: "row gap center small", style: { marginTop: "10px" } },
      s.order.map((id, k) => h("span", { class: "row gap" }, h("i", { class: `disc mini c${k + 1}` }), nameOf(ctx, id), match ? h("b", null, String(s.score[id])) : null)));
    let head;
    if (between) {
      const msg = s.win ? `${nameOf(ctx, s.win.id)} aligne ${K} !` : "Grille pleine : égalité";
      if (!who.length) head = h("div", { class: s.win ? "turnmsg me" : "turnmsg" }, msg);
      else head = h("div", { class: "turnmsg" + (s.win ? " me" : "") }, `${msg} Manche ${s.game} terminée.`);
    } else head = turnLine(ctx, who, myColor >= 0 ? "À toi : touche une colonne" : undefined);
    const info = match ? h("p", { class: "small dim center", style: { margin: "0 0 8px" } }, `Manche ${s.game} · ${s.wins} manches gagnantes pour remporter le match`) : null;
    const next = between && who.length
      ? (mine
        ? h("div", { class: "row center", style: { marginTop: "12px" } }, h("button", { class: "btn green", onclick: () => { ctx.sfx.tap(); ctx.act({ type: "next" }); } }, "Manche suivante"))
        : h("p", { class: "small dim center", style: { marginTop: "10px" } }, `${nameOf(ctx, who[0])} lance la manche suivante…`))
      : null;
    el.replaceChildren(head, info, board, legend, next);
  }
  update(ctx0);
  return { update };
}
