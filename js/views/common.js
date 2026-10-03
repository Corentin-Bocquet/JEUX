// Pièces communes aux affichages des jeux : cartes, tapis, dés, bandeau de tour.
import { h } from "../ui.js";
import { itemById } from "../catalog.js";
import { rankOf, suitOf, SUIT_SYM, RANK_FR } from "../games/cards.js";

export function cardHTML(c, { small, dim, sel, playable } = {}) {
  const r = rankOf(c), s = suitOf(c);
  const red = s === "H" || s === "D";
  const R = RANK_FR[r] || r;
  return `<div class="pcard${small ? " sm" : ""}${red ? " red" : ""}${dim ? " dim" : ""}${sel ? " sel" : ""}${playable ? " ok" : ""}" data-c="${c}" aria-label="${R} ${SUIT_SYM[s]}">
    <span class="tl">${R}<i>${SUIT_SYM[s]}</i></span><span class="mid">${SUIT_SYM[s]}</span><span class="br">${R}<i>${SUIT_SYM[s]}</i></span></div>`;
}

export function cardBackHTML(deckId, w = 56, extra = "") {
  const it = itemById(deckId) || itemById("deck_classique");
  const [a, b] = it.v;
  const motif = it.fx === "dragon"
    ? `<svg viewBox="0 0 40 56" width="100%" height="100%" preserveAspectRatio="none"><path d="M8 44c4-10 18-6 20-16S16 14 22 8" stroke="rgba(255,255,255,.55)" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="22" cy="8" r="2.4" fill="#FFE680"/><path d="M10 46l-3 4M12 45l-1 5" stroke="rgba(255,255,255,.5)" stroke-width="1.6"/></svg>`
    : `<svg viewBox="0 0 40 56" width="100%" height="100%" preserveAspectRatio="none"><path d="M0 0L40 56M40 0L0 56M20 0v56M0 28h40" stroke="rgba(255,255,255,.18)" stroke-width="1"/><rect x="12" y="20" width="16" height="16" rx="4" transform="rotate(45 20 28)" fill="rgba(255,255,255,.35)"/></svg>`;
  return `<div class="pcard back ${extra}" style="--cw:${w}px;background:linear-gradient(150deg,${a},${b})">${motif}</div>`;
}

export function feltStyle(tableId) {
  const it = itemById(tableId) || itemById("table_vert");
  const [a, b] = it.v;
  if (tableId === "table_bois") return `background:repeating-linear-gradient(92deg,rgba(0,0,0,.06) 0 3px,transparent 3px 11px),radial-gradient(ellipse at 50% 30%,${a},${b})`;
  if (tableId === "table_marbre") return `background:linear-gradient(125deg,transparent 40%,rgba(255,255,255,.08) 42%,transparent 46%),linear-gradient(35deg,transparent 60%,rgba(255,255,255,.06) 62%,transparent 65%),radial-gradient(ellipse at 50% 30%,${a},${b})`;
  return `background:radial-gradient(ellipse at 50% 30%,${a},${b})`;
}

const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
export function dieHTML(v, { held, rolling } = {}) {
  const dots = Array.from({ length: 9 }, (_, i) => `<i${PIPS[v].includes(i) ? ' class="on"' : ""}></i>`).join("");
  return `<div class="die${held ? " held" : ""}${rolling ? " rolling" : ""}" aria-label="Dé ${v}">${dots}</div>`;
}

export function turnLine(ctx, who, mineText = "À toi de jouer !") {
  const ids = who || [];
  if (!ids.length) return h("div", { class: "turnmsg" }, "");
  if (ids.includes(ctx.me)) return h("div", { class: "turnmsg me" }, mineText);
  const p = ctx.players[ids[0]];
  return h("div", { class: "turnmsg" }, `${p ? p.name : "Quelqu'un"} réfléchit…`);
}

export const nameOf = (ctx, id) => (ctx.players[id] ? ctx.players[id].name : "?");
