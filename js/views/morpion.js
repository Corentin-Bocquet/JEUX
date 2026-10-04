import { h } from "../ui.js";
import { turnLine, nameOf } from "./common.js";
import { toAct, roundOver } from "../games/morpion.js";

export const scoreOf = (s, id) => (s.wins > 1 ? s.score[id] : null);
export const scoreLabel = (v) => `${v} manche${v > 1 ? "s" : ""}`;

const MARK = [
  null,
  '<svg viewBox="0 0 100 100" aria-hidden="true"><path class="g-morpion-stroke" d="M24 24L76 76M76 24L24 76"/></svg>',
  '<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="g-morpion-stroke" cx="50" cy="50" r="27"/></svg>',
];
const markEl = (v, cls = "") => h("span", { class: `g-morpion-mark m${v} ${cls}`, html: MARK[v] });

export function mount(root, ctx0) {
  const el = h("div", { class: "g-morpion" });
  root.append(el);
  let prevKey = "";
  function update(ctx) {
    const s = ctx.state;
    const who = toAct(s);
    const mine = who.includes(ctx.me);
    const over = roundOver(s);
    const key = s.game + ":" + s.plies;
    const fresh = key !== prevKey;
    if (fresh && prevKey && s.last != null) ctx.sfx.card();
    if (fresh && over && s.win) (s.win.id === ctx.me ? ctx.sfx.win : ctx.sfx.ok)();
    prevKey = key;
    // pions qui vont s'effacer au prochain coup de leur propriétaire
    const leaving = new Set();
    if (s.fade) s.hist.forEach((hh, k) => { if (hh.length >= s.k) leaving.add(hh[0]); });
    const winCells = new Set(s.win ? s.win.cells : []);
    const board = h("div", { class: `g-morpion-board n${s.n}`, role: "grid", "aria-label": "Grille de morpion", style: { gridTemplateColumns: `repeat(${s.n}, 1fr)` } });
    for (let i = 0; i < s.n * s.n; i++) {
      const v = s.board[i];
      const cls = ["g-morpion-cell"];
      if (winCells.has(i)) cls.push("win");
      if (!v && mine && !over) cls.push("free");
      const lbl = `Case ${Math.floor(i / s.n) + 1}-${(i % s.n) + 1}${v ? (v === 1 ? " : croix" : " : rond") : ""}`;
      board.append(h("button", { class: cls.join(" "), "aria-label": lbl, disabled: !!v || !mine || over,
        onclick: () => { ctx.sfx.tap(); ctx.act({ type: "play", cell: i }); } },
        v ? markEl(v, (i === s.last && fresh ? "pop" : "") + (leaving.has(i) && !over ? " leaving" : "")) : null,
        !v && s.gone === i && fresh ? h("span", { class: "g-morpion-ghost" }) : null));
    }
    const myV = s.order.indexOf(ctx.me) + 1;
    let head;
    if (over) {
      const msg = s.win ? (s.win.id === ctx.me ? "Bravo, tu as aligné !" : `${nameOf(ctx, s.win.id)} aligne ${s.k} !`) : "Égalité !";
      head = h("div", { class: "turnmsg" + (s.win && s.win.id === ctx.me ? " me" : "") }, who.length ? `${msg} Manche ${s.game} terminée.` : msg);
    } else head = turnLine(ctx, who, myV ? `À toi : pose ton ${myV === 1 ? "✕" : "◯"}` : undefined);
    const players = h("div", { class: "g-morpion-players" }, s.order.map((id, k) =>
      h("div", { class: "g-morpion-pl" + (!over && who[0] === id ? " on" : "") + (id === ctx.me ? " me" : "") },
        markEl(k + 1, "mini"), h("span", { class: "grow g-morpion-name" }, id === ctx.me ? "Toi" : nameOf(ctx, id)),
        s.wins > 1 ? h("b", { class: "g-morpion-sc" }, String(s.score[id])) : null)));
    const info = h("p", { class: "small dim center g-morpion-info" },
      [`Aligne ${s.k}`, s.wins > 1 ? `Manche ${s.game}, ${s.wins} gagnées pour le match` : null,
        s.fade ? `${s.k} pions max, le pâle s'efface` : null].filter(Boolean).join(" · "));
    const next = over && who.length
      ? (mine
        ? h("div", { class: "row center", style: { marginTop: "14px" } }, h("button", { class: "btn green", onclick: () => { ctx.sfx.tap(); ctx.act({ type: "next" }); } }, "Manche suivante"))
        : h("p", { class: "small dim center", style: { marginTop: "12px" } }, `${nameOf(ctx, who[0])} lance la manche suivante…`))
      : null;
    el.replaceChildren(head, players, board, info, next);
  }
  update(ctx0);
  return { update, destroy() { el.remove(); } };
}
