import { h } from "../ui.js";
import { nameOf } from "./common.js";
import { revealed, given } from "../games/fleches.js";
import { norm } from "../games/motus.js";

export const scoreOf = (s, id) => s.scores[id];
const COLORS = ["#1CB0F6", "#FF9600", "#CE82FF", "#58CC02", "#FF4B4B", "#FF86D0"];

export function mount(root, ctx0) {
  const el = h("div", { class: "g-fl" });
  root.append(el);
  let sel = -1, typed = "", lastKey = "";
  function update(ctx) {
    const s = ctx.state;
    if (s.last) {
      const k = JSON.stringify(s.last);
      if (k !== lastKey && lastKey) {
        if (s.last.id === ctx.me) { s.last.ok ? ctx.sfx.ok() : (ctx.sfx.bad(), ctx.buzz(40)); if (s.last.ok) { sel = -1; typed = ""; } }
        else if (s.last.ok) ctx.sfx.card();
      }
      lastKey = k;
    }
    if (sel >= 0 && s.words[sel].by) { sel = -1; typed = ""; }
    if (sel < 0) { const first = s.words.findIndex((w) => !w.by); sel = first; typed = ""; }
    draw(ctx);
  }
  function draw(ctx) {
    const s = ctx.state;
    const rev = revealed(s), giv = given(s);
    const W = s.w, H = s.h;
    const active = sel >= 0 ? s.words[sel] : null;
    const activeCells = new Set(active ? active.cells : []);
    const grid = h("div", { class: "fl-grid", style: { gridTemplateColumns: `repeat(${W}, 1fr)` } });
    for (let i = 0; i < W * H; i++) {
      const c = s.grid[i];
      if (!c) { grid.append(h("span", { class: "fl-cell void" })); continue; }
      if (c.t === "C") {
        const parts = ["a", "d"].filter((d) => c[d] != null).map((d) => {
          const wi = c[d], w = s.words[wi];
          return h("button", { class: "fl-clue" + (wi === sel ? " on" : "") + (w.by ? " done" : ""), onclick: () => pick(ctx, wi), "aria-label": w.d },
            h("span", { class: "fl-def" }, w.d), h("b", { class: "fl-arrow" }, d === "a" ? "▸" : "▾"));
        });
        grid.append(h("div", { class: "fl-cell clue" + (parts.length > 1 ? " two" : "") }, parts));
        continue;
      }
      let ch = rev[i] || "";
      if (!ch && activeCells.has(i)) ch = typed[active.cells.indexOf(i)] || "";
      const by = [c.a, c.d].filter((x) => x != null).map((x) => s.words[x]).find((w) => w.by);
      // lettre donnée au départ (option) : affichée en gris tant que le mot n'est pas trouvé
      const style = by ? `--fc:${COLORS[s.ids.indexOf(by.by) % COLORS.length]}` : giv[i] ? "color:#8A8DA8" : null;
      grid.append(h("button", { class: "fl-cell letter" + (activeCells.has(i) ? " act" : "") + (by ? " rev" : ""), style,
        onclick: () => { const wi = c.a != null && !s.words[c.a].by ? c.a : c.d != null && !s.words[c.d].by ? c.d : null; if (wi != null) pick(ctx, wi); } }, ch));
    }
    const input = active && !active.by ? h("form", { class: "fl-input glass", onsubmit: (e) => { e.preventDefault(); send(ctx); } },
      h("div", { class: "small dim" }, active.dir === "a" ? "Horizontal" : "Vertical", ` · ${active.w.length} lettres`),
      h("div", { class: "h3" }, active.d),
      h("div", { class: "row gap" },
        h("input", { class: "input grow", id: "fl-ans", value: typed, maxlength: active.w.length, autocomplete: "off", autocapitalize: "characters", spellcheck: "false",
          placeholder: active.cells.map((c) => rev[c] || "_").join(" "), oninput: (e) => { typed = norm(e.target.value).slice(0, active.w.length); e.target.value = typed; drawGridOnly(); } }),
        h("button", { class: "btn green", type: "submit" }, "OK"))) : null;
    const done = s.words.filter((w) => w.by).length;
    const hadFocus = document.activeElement && document.activeElement.id === "fl-ans";
    el.replaceChildren(
      h("div", { class: "row between small", style: { margin: "0 2px 8px" } }, h("span", { class: "dim" }, `${done} / ${s.words.length} mots`),
        h("span", { class: "row gap" }, s.ids.map((id) => h("span", { style: { color: COLORS[s.ids.indexOf(id) % COLORS.length] } }, nameOf(ctx, id), " ", h("b", null, s.scores[id]))))),
      grid, input,
      h("p", { class: "tiny dim center" }, `Mot juste : autant de points que de lettres. Erreur : ${(s.penalty ?? 1) ? "-" + (s.penalty ?? 1) : "sans pénalité"}.`));
    if (hadFocus) { const i = document.getElementById("fl-ans"); if (i) { i.focus({ preventScroll: true }); i.setSelectionRange(typed.length, typed.length); } }
    function drawGridOnly() {
      const cells = grid.querySelectorAll(".fl-cell");
      if (!active) return;
      active.cells.forEach((ci, k) => { if (!rev[ci]) cells[ci].textContent = typed[k] || ""; });
    }
  }
  function pick(ctx, wi) {
    if (ctx.state.words[wi].by) return;
    sel = wi; typed = ""; ctx.sfx.tap(); draw(ctx);
    setTimeout(() => { const i = document.getElementById("fl-ans"); i && i.focus({ preventScroll: true }); }, 30);
  }
  function send(ctx) {
    const w = ctx.state.words[sel];
    if (!w) return;
    const rev = revealed(ctx.state);
    // complète avec les lettres déjà connues si besoin
    let t = typed.split("");
    if (t.length < w.w.length) t = w.cells.map((c, k) => typed[k] || rev[c] || "");
    const ans = t.join("");
    if (ans.length !== w.w.length) { ctx.toast(`Il faut ${w.w.length} lettres`, "err"); return; }
    ctx.act({ type: "answer", word: sel, text: ans });
  }
  update(ctx0);
  return { update };
}
