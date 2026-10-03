import { h } from "../ui.js";
import { nameOf } from "./common.js";
import { lineCells } from "../games/motsmeles.js";

export const scoreOf = (s, id) => s.scores[id];
const COLORS = ["#1CB0F6", "#FF9600", "#CE82FF", "#58CC02", "#FF4B4B", "#FF86D0"];

export function mount(root, ctx0) {
  const el = h("div", { class: "g-mm" });
  root.append(el);
  let ctx = ctx0, drag = null, lastFound = 0;
  const wrapGrid = h("div", { class: "mm-wrap" });
  const gridEl = h("div", { class: "mm-grid" });
  const svgNS = "http://www.w3.org/2000/svg";
  const overlay = document.createElementNS(svgNS, "svg");
  overlay.setAttribute("class", "mm-svg");
  wrapGrid.append(gridEl, overlay);
  const list = h("div", { class: "mm-list" });
  const head = h("div", { class: "row between small", style: { margin: "0 2px 8px" } });
  el.append(head, wrapGrid, list);

  const cellAt = (e) => {
    const s = ctx.state, r = gridEl.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * s.size), y = Math.floor(((e.clientY - r.top) / r.height) * s.size);
    if (x < 0 || y < 0 || x >= s.size || y >= s.size) return null;
    return y * s.size + x;
  };
  // aligne la fin sur une des 8 directions
  const snap = (a, b) => {
    const s = ctx.state.size;
    const r0 = Math.floor(a / s), c0 = a % s, r1 = Math.floor(b / s), c1 = b % s;
    let dr = r1 - r0, dc = c1 - c0;
    const n = Math.max(Math.abs(dr), Math.abs(dc));
    if (!n) return a;
    const ang = Math.atan2(dr, dc), step = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
    dr = Math.round(Math.sin(step)); dc = Math.round(Math.cos(step));
    let k = n;
    while (k > 0 && (r0 + dr * k < 0 || r0 + dr * k >= s || c0 + dc * k < 0 || c0 + dc * k >= s)) k--;
    return (r0 + dr * k) * s + c0 + dc * k;
  };
  gridEl.addEventListener("pointerdown", (e) => {
    const c = cellAt(e); if (c == null) return;
    drag = { a: c, b: c }; gridEl.setPointerCapture(e.pointerId); drawOverlay();
  });
  gridEl.addEventListener("pointermove", (e) => {
    if (!drag) return; const c = cellAt(e); if (c == null) return;
    const b = snap(drag.a, c); if (b !== drag.b) { drag.b = b; ctx.sfx.tap(); drawOverlay(); }
  });
  const end = () => {
    if (!drag) return;
    const { a, b } = drag; drag = null; drawOverlay();
    if (a === b) return;
    const s = ctx.state;
    const cells = lineCells(s.size, a, b);
    const str = cells.map((c) => s.grid[c]).join("");
    const rev = str.split("").reverse().join("");
    if (!s.words.some((w) => !w.by && (w.w === str || w.w === rev))) { ctx.sfx.bad(); return; }
    ctx.act({ type: "find", a, b });
  };
  gridEl.addEventListener("pointerup", end);
  gridEl.addEventListener("pointercancel", () => { drag = null; drawOverlay(); });

  function line(a, b, color, w = 0.74, op = 0.42) {
    const s = ctx.state.size;
    const l = document.createElementNS(svgNS, "line");
    l.setAttribute("x1", (a % s) + 0.5); l.setAttribute("y1", Math.floor(a / s) + 0.5);
    l.setAttribute("x2", (b % s) + 0.5); l.setAttribute("y2", Math.floor(b / s) + 0.5);
    l.setAttribute("stroke", color); l.setAttribute("stroke-width", w); l.setAttribute("stroke-linecap", "round"); l.setAttribute("opacity", op);
    return l;
  }
  function drawOverlay() {
    const s = ctx.state;
    overlay.setAttribute("viewBox", `0 0 ${s.size} ${s.size}`);
    overlay.replaceChildren();
    for (const w of s.words) if (w.by) overlay.append(line(w.a, w.b, COLORS[s.ids.indexOf(w.by) % COLORS.length]));
    if (drag) overlay.append(line(drag.a, drag.b, "#FFC800", 0.8, 0.55));
  }
  function update(c) {
    ctx = c;
    const s = c.state;
    const found = s.words.filter((w) => w.by).length;
    if (found !== lastFound) { if (lastFound || found) (s.last && s.last.id === c.me ? c.sfx.ok() : c.sfx.card()); lastFound = found; }
    gridEl.style.gridTemplateColumns = `repeat(${s.size}, 1fr)`;
    if (gridEl.childElementCount !== s.size * s.size) gridEl.replaceChildren(...s.grid.split("").map((ch) => h("span", { class: "mm-cell" }, ch)));
    const sens = s.diag === false ? (s.back === false ? " · à l'endroit, sans diagonales" : " · sans diagonales") : s.back === false ? " · à l'endroit" : "";
    head.replaceChildren(h("span", { class: "dim" }, `Thème : ${s.theme}${sens}`), h("span", null, `${found} / ${s.words.length} mots`));
    // mode initiales : seuls la première lettre et le nombre de lettres sont visibles
    const label = (w) => (w.by || s.list !== "hint" ? w.w : w.w[0] + " " + "_ ".repeat(w.w.length - 1).trim());
    list.replaceChildren(...s.words.map((w) => h("span", { class: "mm-word" + (w.by ? " done" : ""), style: w.by ? `--wc:${COLORS[s.ids.indexOf(w.by) % COLORS.length]}` : null, title: w.by ? nameOf(c, w.by) : `${w.w.length} lettres`, "aria-label": w.by ? w.w : `Mot de ${w.w.length} lettres en ${w.w[0]}` }, label(w))));
    drawOverlay();
  }
  update(ctx0);
  return { update };
}
