import { h } from "../ui.js";
import { nameOf } from "./common.js";
import { MAX_TRIES, check, norm, marks } from "../games/motus.js";

export const scoreOf = (s, id) => s.scores[id];

const ROWS = ["AZERTYUIOP", "QSDFGHJKLM", "WXCVBN"];

export function mount(root, ctx0) {
  const el = h("div", { class: "g-motus" });
  root.append(el);
  let typed = "", round = 0, lastLen = 0, shake = false, phys = null;
  function update(ctx) {
    const s = ctx.state;
    if (s.roundNo !== round) { round = s.roundNo; typed = ""; lastLen = 0; }
    const b = s.boards[ctx.me] || [];
    if (b.length !== lastLen) {
      const last = b[b.length - 1];
      if (last && last.w === s.word) ctx.sfx.win(); else if (last) ctx.sfx.card();
      lastLen = b.length; typed = "";
    }
    draw(ctx);
  }
  function draw(ctx) {
    const s = ctx.state;
    const L = s.len;
    const b = s.boards[ctx.me] || [];
    const status = s.status[ctx.me];
    const playing = status === "playing";
    const hist = s.history[s.history.length - 1];
    const rows = [];
    for (let k = 0; k < MAX_TRIES; k++) {
      const g = b[k];
      const isCur = playing && k === b.length;
      const row = h("div", { class: "mt-row" + (isCur && shake ? " shake" : "") });
      for (let i = 0; i < L; i++) {
        let ch = "", cls = "mt-cell";
        if (g) { ch = g.w[i]; cls += [" no", " mal", " bien"][g.m[i]]; cls += " flip"; }
        else if (isCur) { ch = typed[i] || (i === 0 ? s.word[0] : ""); if (!typed[i] && i === 0) cls += " hint"; if (typed[i]) cls += " typed"; }
        row.append(h("span", { class: cls, style: g ? `animation-delay:${i * 70}ms` : null }, ch));
      }
      rows.push(row);
    }
    // état du clavier
    const keyState = {};
    for (const g of b) g.w.split("").forEach((c, i) => { keyState[c] = Math.max(keyState[c] ?? -1, g.m[i]); });
    const kb = h("div", { class: "mt-kb" }, ROWS.map((r, ri) => h("div", { class: "mt-kr" },
      ri === 2 ? h("button", { class: "mt-k wide", onclick: () => submit(ctx), disabled: !playing }, "Entrée") : null,
      r.split("").map((c) => h("button", { class: "mt-k" + (keyState[c] === 2 ? " bien" : keyState[c] === 1 ? " mal" : keyState[c] === 0 ? " no" : ""), disabled: !playing, onclick: () => key(ctx, c) }, c)),
      ri === 2 ? h("button", { class: "mt-k wide", "aria-label": "Effacer", onclick: () => key(ctx, "⌫"), disabled: !playing }, "⌫") : null)));
    const others = s.ids.filter((id) => id !== ctx.me).map((id) => h("div", { class: "mt-mini" },
      h("div", { class: "small" }, nameOf(ctx, id), s.status[id] === "found" ? " ✓" : s.status[id] === "out" ? " ✗" : ""),
      h("div", { class: "mt-minigrid" }, (s.boards[id] || []).map((g) => h("div", { class: "row" }, g.m.map((m) => h("i", { class: ["no", "mal", "bien"][m] })))))));
    el.replaceChildren(
      h("div", { class: "row between small", style: { margin: "0 2px 8px" } }, h("span", { class: "dim" }, `Manche ${s.roundNo} / ${s.rounds} · ${L} lettres`), h("span", null, "Score ", h("b", null, s.scores[ctx.me] ?? 0))),
      hist && s.roundNo > 1 && b.length === 0 ? h("div", { class: "small dim center" }, `Le mot précédent était ${hist.word}`) : null,
      h("div", { class: "mt-board" }, rows),
      !playing ? h("div", { class: "turnmsg " + (status === "found" ? "me" : "") }, status === "found" ? "Trouvé ! On attend les autres…" : `Raté ! C'était ${s.word}. On attend les autres…`) : null,
      others.length ? h("div", { class: "mt-others" }, others) : null,
      kb);
    if (!phys) {
      phys = (e) => {
        const c = el._ctx;
        if (!c || e.ctrlKey || e.metaKey || e.altKey || document.querySelector(".sheet-wrap")) return;
        if (e.key === "Enter") submit(c);
        else if (e.key === "Backspace") key(c, "⌫");
        else if (/^[a-zA-ZÀ-ÿ]$/.test(e.key)) key(c, norm(e.key));
      };
      window.addEventListener("keydown", phys);
    }
    el._ctx = ctx;
  }
  function key(ctx, c) {
    const s = ctx.state;
    if (s.status[ctx.me] !== "playing") return;
    if (c === "⌫") typed = typed.slice(0, -1);
    else if (typed.length < s.len) { if (!typed && c !== s.word[0]) typed = s.word[0]; typed += c; if (typed.length > s.len) typed = typed.slice(0, s.len); }
    ctx.sfx.tap();
    draw(ctx);
  }
  function submit(ctx) {
    const s = ctx.state;
    const w = typed;
    const err = check(s, w);
    if (err) { shake = true; ctx.toast(err, "err"); draw(ctx); setTimeout(() => { shake = false; }, 400); return; }
    ctx.act({ type: "guess", word: w });
  }
  update(ctx0);
  return { update, destroy() { if (phys) window.removeEventListener("keydown", phys); } };
}
export { marks };
