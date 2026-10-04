import { h } from "../ui.js";
import { turnLine, nameOf } from "./common.js";
import { toAct, legalMoves, countOf, colorOf, idOfColor } from "../games/reversi.js";

// score affiché dans la bande des joueurs : pions (ou manches gagnées en match)
export const scoreOf = (s, id) => (!s.order.includes(id) ? null : s.wins > 1 ? s.score[id] : countOf(s.board, colorOf(s, id)));
export const scoreLabel = (v) => `${v} pion${v > 1 ? "s" : ""}`;

export function mount(root, ctx0) {
  const el = h("div", { class: "g-reversi" });
  root.append(el);
  let lastKey = null;
  function update(ctx) {
    const s = ctx.state;
    const n = s.n;
    const who = toAct(s);
    const mine = !s.done && who.includes(ctx.me);
    const myColor = colorOf(s, ctx.me);
    const key = s.game + ":" + s.plies;
    const fresh = lastKey !== null && key !== lastKey && s.last >= 0;
    if (fresh) ctx.sfx.card();
    if (fresh && s.done) (s.roundWin === ctx.me ? ctx.sfx.win : ctx.sfx.tap)();
    lastKey = key;
    const legal = mine ? new Set(legalMoves(s.board, n, s.side + 1)) : new Set();
    const showHints = s.hints !== false;
    const flips = fresh ? new Set(s.flips) : new Set();
    const board = h("div", { class: `g-reversi-board n${n}`, role: "grid", "aria-label": "Plateau de Reversi", style: { gridTemplateColumns: `repeat(${n}, 1fr)` } });
    for (let i = 0; i < n * n; i++) {
      const v = s.board[i];
      const r = Math.floor(i / n), c = i % n;
      const can = legal.has(i);
      const cls = ["g-reversi-sq"];
      if (can && showHints) cls.push("hint");
      if (can) cls.push("can");
      if (i === s.last) cls.push("last");
      let disc = null;
      if (v) {
        const dcls = ["g-reversi-disc", v === 1 ? "b" : "w"];
        if (fresh && flips.has(i)) {
          dcls.push(v === 1 ? "flip-to-b" : "flip-to-w");
        } else if (fresh && i === s.last) dcls.push("drop");
        disc = h("i", { class: dcls.join(" "), style: fresh && flips.has(i) ? { animationDelay: `${Math.min(400, flipDelay(s.last, i, n))}ms` } : null },
          h("b", { class: "fb" }), h("b", { class: "fw" }));
      }
      const label = `${String.fromCharCode(65 + c)}${r + 1}`;
      board.append(h("button", { class: cls.join(" "), "aria-label": label + (v ? (v === 1 ? " noir" : " blanc") : can ? " jouable" : ""),
        disabled: !mine || !can,
        onclick: () => { ctx.sfx.tap(); ctx.act({ type: "play", i }); } }, disc));
    }
    // compteurs de pions
    const nb = countOf(s.board, 1), nw = countOf(s.board, 2);
    const total = nb + nw || 1;
    const sideChip = (v) => {
      const id = idOfColor(s, v);
      const turn = !s.done && s.side + 1 === v;
      return h("div", { class: `g-reversi-chip${turn ? " turn" : ""}${id === ctx.me ? " me" : ""}` },
        h("i", { class: `g-reversi-dot ${v === 1 ? "b" : "w"}` }),
        h("span", { class: "g-reversi-name" }, nameOf(ctx, id), s.wins > 1 ? h("small", null, `${s.score[id]} manche${s.score[id] > 1 ? "s" : ""}`) : null),
        h("b", { class: "g-reversi-count" }, String(v === 1 ? nb : nw)));
    };
    const bar = h("div", { class: "g-reversi-bar", "aria-hidden": "true" }, h("i", { class: "b", style: { width: `${(nb / total) * 100}%` } }), h("i", { class: "w" }));
    let head;
    if (s.done) {
      const msg = s.roundWin ? `${nameOf(ctx, s.roundWin)} gagne ${Math.max(nb, nw)} à ${Math.min(nb, nw)} !` : `Égalité ${nb} partout`;
      head = h("div", { class: "turnmsg" + (s.roundWin === ctx.me ? " me" : "") }, who.length ? `${msg} Manche ${s.game} terminée.` : msg);
    } else {
      const myTxt = legal.size ? (showHints ? "À toi : pose un pion sur un point vert" : "À toi : pose un pion qui encadre") : "À toi";
      head = turnLine(ctx, who, myColor ? myTxt : undefined);
    }
    const passMsg = s.pass && !s.done ? h("div", { class: "g-reversi-pass" }, `${nameOf(ctx, s.pass)} n'a aucun coup possible : son tour passe.`) : null;
    const info = s.wins > 1 ? h("p", { class: "small dim center", style: { margin: "0 0 6px" } }, `Manche ${s.game} · ${s.wins} manches gagnantes pour le match`) : null;
    const next = s.done && who.length
      ? (who.includes(ctx.me)
        ? h("div", { class: "row center", style: { marginTop: "12px" } }, h("button", { class: "btn green", onclick: () => { ctx.sfx.tap(); ctx.act({ type: "next" }); } }, "Manche suivante"))
        : h("p", { class: "small dim center", style: { marginTop: "10px" } }, `${nameOf(ctx, who[0])} lance la manche suivante…`))
      : null;
    el.replaceChildren(head, info, h("div", { class: "g-reversi-chips" }, sideChip(1), sideChip(2)), bar, passMsg,
      h("div", { class: "g-reversi-frame" }, board), next);
  }
  update(ctx0);
  return { update };
}

// les pions se retournent en vague à partir du pion posé
function flipDelay(from, i, n) {
  const d = Math.max(Math.abs(Math.floor(from / n) - Math.floor(i / n)), Math.abs((from % n) - (i % n)));
  return 60 + d * 70;
}
