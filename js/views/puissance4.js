import { h } from "../ui.js";
import { turnLine, nameOf } from "./common.js";
import { W, H, toAct, landing } from "../games/puissance4.js";

export function mount(root, ctx0) {
  const el = h("div", { class: "g-p4" });
  root.append(el);
  let prevLast = null;
  function update(ctx) {
    const s = ctx.state;
    const who = toAct(s);
    const mine = who.includes(ctx.me);
    const myColor = s.order.indexOf(ctx.me);
    const board = h("div", { class: "p4-board", role: "grid", "aria-label": "Grille de Puissance 4" });
    for (let c = 0; c < W; c++) {
      const col = h("button", { class: "p4-col", "aria-label": `Colonne ${c + 1}`, disabled: !mine || landing(s.board, c) < 0,
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
    const legend = h("div", { class: "row gap center small", style: { marginTop: "10px" } },
      s.order.map((id, k) => h("span", { class: "row gap" }, h("i", { class: `disc mini c${k + 1}` }), nameOf(ctx, id))));
    el.replaceChildren(
      s.win ? h("div", { class: "turnmsg me" }, `${nameOf(ctx, s.win.id)} aligne 4 !`) : s.full ? h("div", { class: "turnmsg" }, "Grille pleine : égalité") : turnLine(ctx, who, myColor >= 0 ? "À toi : touche une colonne" : undefined),
      board, legend);
  }
  update(ctx0);
  return { update };
}
