import { h, sheet } from "../ui.js";
import { cardHTML, cardBackHTML, feltStyle, turnLine, nameOf } from "./common.js";
import { toAct, canPlay } from "../games/huit.js";
import { rankOf, SUIT_SYM, SUIT_NAME, label } from "../games/cards.js";

export const scoreOf = (s, id) => s.hands[id].length + " c.";
export const scoreLabel = (v) => `${v} pts restants`;

export function mount(root, ctx0) {
  const el = h("div", { class: "g-cards" });
  root.append(el);
  let lastLog = null;
  function update(ctx) {
    const s = ctx.state;
    const who = toAct(s);
    const mine = who.includes(ctx.me);
    const hand = s.hands[ctx.me] || [];
    const top = s.discard[s.discard.length - 1];
    const logKey = JSON.stringify(s.log);
    if (logKey !== lastLog && s.log) { s.log.t === "play" ? ctx.sfx.card() : null; }
    lastLog = logKey;
    const others = s.order.filter((id) => id !== ctx.me);
    const opp = h("div", { class: "opps" }, others.map((id) => h("div", { class: "opp" + (who.includes(id) ? " turn" : "") },
      h("div", { class: "fan", html: Array.from({ length: Math.min(s.hands[id].length, 8) }, () => cardBackHTML(ctx.skin.deck, 26)).join("") }),
      h("div", { class: "small" }, nameOf(ctx, id), " · ", s.hands[id].length))));
    const pile = h("div", { class: "pile-row" },
      h("button", { class: "deck-btn", disabled: !mine || s.drew, "aria-label": "Piocher", onclick: () => { ctx.sfx.card(); ctx.act({ type: "draw" }); },
        html: cardBackHTML(ctx.skin.deck, 64) + `<span class="cnt">${s.pile.length}</span>` }),
      h("div", { class: "top-card", html: cardHTML(top) }),
      h("div", { class: "suit-now " + (s.suit === "H" || s.suit === "D" ? "red" : "") }, h("span", null, SUIT_SYM[s.suit]), h("small", null, SUIT_NAME[s.suit])));
    const myHand = h("div", { class: "hand" }, hand.map((c) => {
      const ok = mine && canPlay(s, c);
      return h("button", { class: "hcard", disabled: !ok, "aria-label": label(c), html: cardHTML(c, { playable: ok, dim: mine && !ok }),
        onclick: () => play(ctx, c) });
    }));
    const msg = s.log ? logText(ctx, s.log) : "";
    el.replaceChildren(
      opp,
      h("div", { class: "felt", style: feltStyle(ctx.skin.table) }, pile, h("div", { class: "small center felt-msg" }, msg)),
      turnLine(ctx, who, s.drew ? "Pose la carte piochée ou passe" : "À toi : pose une carte ou pioche"),
      myHand,
      mine && s.drew ? h("div", { class: "row center", style: { marginTop: "10px" } }, h("button", { class: "btn ghost small", onclick: () => ctx.act({ type: "pass" }) }, "Passer")) : null);
  }
  function play(ctx, c) {
    if (rankOf(c) === "8") {
      const sh = sheet(h("div", { class: "suits" }, ["S", "H", "D", "C"].map((su) => h("button", { class: "suit-pick " + (su === "H" || su === "D" ? "red" : ""),
        onclick: () => { sh.close(); ctx.act({ type: "play", card: c, suit: su }); } }, h("span", null, SUIT_SYM[su]), SUIT_NAME[su]))), { title: "Quelle couleur ?" });
      return;
    }
    ctx.act({ type: "play", card: c });
  }
  update(ctx0);
  return { update };
}

function logText(ctx, l) {
  const n = nameOf(ctx, l.id);
  if (l.t === "draw") return `${n} pioche`;
  if (l.t === "pass") return `${n} passe`;
  let t = `${n} pose ${label(l.card)}`;
  if (rankOf(l.card) === "8") t += ` et demande ${SUIT_NAME[l.suit]}`;
  if (l.victim && rankOf(l.card) === "2") t += ` : ${nameOf(ctx, l.victim)} pioche ${l.n}`;
  else if (l.victim) t += ` : ${nameOf(ctx, l.victim)} passe son tour`;
  return t;
}
