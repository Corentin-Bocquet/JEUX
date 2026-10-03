import { h } from "../ui.js";
import { turnLine, nameOf } from "./common.js";
import { toAct, legalMoves, rulesOf } from "../games/dames.js";

export const scoreOf = (s, id) => {
  const side = s.order.indexOf(id);
  return s.board.filter((p) => (side === 0 ? p === 1 || p === 2 : p === 3 || p === 4)).length;
};

export function mount(root, ctx0) {
  const el = h("div", { class: "g-dames" });
  root.append(el);
  let sel = null, path = [], lastSeq = -1;
  function update(ctx) {
    const s = ctx.state;
    if (s.plies !== lastSeq) { sel = null; path = []; if (lastSeq >= 0) ctx.sfx.card(); lastSeq = s.plies; }
    draw(ctx);
  }
  function draw(ctx) {
    const s = ctx.state;
    const N = Math.round(Math.sqrt(s.board.length));
    const rules = rulesOf(s);
    const who = toAct(s);
    const mine = who.includes(ctx.me);
    const side = s.order.indexOf(ctx.me);
    const flip = side === 1;
    const moves = mine ? legalMoves(s.board, s.side, rules) : [];
    const movable = new Set(moves.map((m) => m.from));
    const cands = sel != null ? moves.filter((m) => m.from === sel && path.every((p, i) => m.path[i] === p)) : [];
    const next = new Set(cands.filter((m) => m.path.length > path.length).map((m) => m.path[path.length]));
    const capturing = new Set(cands.length ? cands[0].caps.slice(0, path.length) : []);
    const board = h("div", { class: "dm-board" + (flip ? " flip" : ""), role: "grid", "aria-label": "Damier", style: { gridTemplateColumns: `repeat(${N}, 1fr)` } });
    for (let k = 0; k < N * N; k++) {
      const i = flip ? N * N - 1 - k : k;
      const r = Math.floor(i / N), c = i % N;
      const dark = (r + c) % 2 === 1;
      const p = s.board[i];
      const atNow = sel != null && (path.length ? path[path.length - 1] : sel) === i;
      const cls = ["dm-sq", dark ? "dk" : "lt"];
      if (s.last && (s.last.from === i || s.last.path.includes(i))) cls.push("last");
      if (next.has(i)) cls.push("target");
      if (atNow) cls.push("sel");
      if (mine && movable.has(i) && sel == null) cls.push("can");
      const piece = p && !(sel === i && path.length) ? h("i", { class: `dm-pc ${p <= 2 ? "w" : "b"}${p === 2 || p === 4 ? " king" : ""}${capturing.has(i) ? " taken" : ""}` }) : null;
      const ghost = atNow && path.length ? h("i", { class: `dm-pc ${s.board[sel] <= 2 ? "w" : "b"}${s.board[sel] === 2 || s.board[sel] === 4 ? " king" : ""} ghost` }) : null;
      board.append(dark ? h("button", { class: cls.join(" "), "aria-label": `case ${r * (N / 2) + Math.floor(c / 2) + 1}`, onclick: () => tap(ctx, i, moves) }, piece, ghost) : h("span", { class: cls.join(" ") }));
    }
    const mustTake = rules.force && moves.length && moves[0].caps.length;
    const canTake = !rules.force && moves.some((m) => m.caps.length);
    el.replaceChildren(
      turnLine(ctx, who, mustTake ? `À toi : prise obligatoire (${moves[0].caps.length} pièce${moves[0].caps.length > 1 ? "s" : ""})` : canTake ? "À toi : une prise est possible, à toi de voir" : "À toi : touche un pion puis sa case d'arrivée"),
      board,
      h("div", { class: "row gap center small", style: { marginTop: "10px" } },
        s.order.map((id, k) => h("span", { class: "row gap" }, h("i", { class: `dm-pc mini ${k === 0 ? "w" : "b"}` }), nameOf(ctx, id)))),
      s.quiet > 30 ? h("p", { class: "small dim center" }, `Partie nulle dans ${50 - s.quiet} coups de dames sans prise`) : null);
  }
  function tap(ctx, i, moves) {
    if (!moves.length) return;
    if (sel == null || (!path.length && moves.some((m) => m.from === i))) {
      if (moves.some((m) => m.from === i)) { sel = i; path = []; ctx.sfx.tap(); }
      draw(ctx); return;
    }
    const cands = moves.filter((m) => m.from === sel && path.every((p, k) => m.path[k] === p));
    if (!cands.some((m) => m.path[path.length] === i)) { sel = null; path = []; draw(ctx); return; }
    path = [...path, i];
    const done = cands.find((m) => m.path.length === path.length && m.path.every((p, k) => p === path[k]));
    const longer = cands.some((m) => m.path.length > path.length && m.path.every((p, k) => k >= path.length || p === path[k]));
    if (done && !longer) { const a = { type: "move", from: sel, path }; sel = null; path = []; ctx.act(a); return; }
    ctx.sfx.tap();
    draw(ctx);
  }
  update(ctx0);
  return { update };
}
