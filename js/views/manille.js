import { h } from "../ui.js";
import { cardHTML } from "./common.js";
import { mountTable, seatName, suitSpan, suitWord, mySeat } from "../games/lib/belote_table.js";
import { teamOf, SUITS32 } from "../games/lib/plis32.js";
import { rulesOf, legalCards, NOTRUMP } from "../games/manille.js";

export const scoreOf = (s, id) => {
  const seat = s.order.indexOf(id);
  return seat < 0 ? "" : `${s.scores[teamOf(seat)]} pts`;
};
export const scoreLabel = (v) => `${v} pts`;

const nm = (ctx, s, seat) => (seat === mySeat(ctx, s) ? "Toi" : seatName(ctx, s, seat));
const realTrump = (s) => (s.trump && s.trump !== NOTRUMP ? s.trump : null);

export function mount(root, ctx0) {
  return mountTable(root, ctx0, {
    cls: "g-manille",
    trumpOf: realTrump,
    trumpLabel: (s) => (s.trump === NOTRUMP ? "SA" : "?"),
    legal: (s, seat) => legalCards(s, seat),
    sortHand: (hand, s) => rulesOf(s).sortHand(hand, realTrump(s)),
    top(ctx, s) {
      if (s.phase === "choose") return h("div", { class: "g-belote-info" }, h("b", null, nm(ctx, s, s.dealer)), " choisit l'atout");
      if (s.phase !== "play") return null;
      const pts = (t) => s.pts[t];
      const us = teamOf(Math.max(0, mySeat(ctx, s)));
      return h("div", { class: "g-belote-info" },
        s.trump === NOTRUMP ? h("b", null, "Sans atout, points doublés") : ["Atout ", suitSpan(s.trump), ` ${suitWord(s.trump)}`],
        h("span", { class: "dim" }, ` · plis : nous ${pts(us)} pts, eux ${pts(1 - us)} pts`));
    },
    center(ctx, s) {
      if (s.phase === "play" && s.turned && !s.seen.length) {
        return h("div", { class: "g-belote-turned" }, h("div", { html: cardHTML(s.turned) }), h("small", null, `Retournée chez ${nm(ctx, s, s.dealer)}`));
      }
      return null;
    },
    bubble(ctx, s, seat) {
      if (s.phase === "play" && !s.seen.length && !s.trick.length && seat === s.dealer) return s.turned ? "Retourne" : "Atout choisi";
      return null;
    },
    myTurnText(ctx, s) {
      if (s.phase === "choose") return "Regarde ta main et choisis l'atout";
      return s.trick.length ? "À toi : joue une carte en surbrillance" : "À toi d'entamer";
    },
    controls(ctx, s) {
      if (s.phase !== "choose") return null;
      const go = (suit) => { ctx.sfx.tap(); ctx.act({ type: "trump", suit }); };
      return h("div", { class: "g-belote-ctrl" },
        h("div", { class: "g-belote-suits four" }, SUITS32.map((x) =>
          h("button", { class: "g-belote-suitbtn", "aria-label": "Atout " + suitWord(x), onclick: () => go(x) }, suitSpan(x, "big"), h("small", null, suitWord(x))))),
        h("button", { class: "btn purple block", onclick: () => go(NOTRUMP) }, "Sans atout (points x2)"));
    },
    summary(ctx, s, d) {
      const us = teamOf(Math.max(0, mySeat(ctx, s)));
      const title = d.got[us] > d.got[1 - us] ? "Donne gagnée !" : d.got[us] < d.got[1 - us] ? "Donne perdue" : "30 partout";
      const line = (t, lab) => h("div", { class: "g-belote-sumrow" + (t === us ? " us" : "") },
        h("span", null, lab), h("span", { class: "dim" }, `${d.card[t]} pts · ${d.tricks[t]} plis`), h("b", null, `+${d.got[t]}`));
      return h("div", null,
        h("div", { class: "h3" }, title),
        h("div", { class: "small" }, d.trump === NOTRUMP ? "Sans atout, points doublés" : ["Atout ", suitSpan(d.trump)], " · au-dessus de 30 points"),
        line(us, "Nous"), line(1 - us, "Eux"),
        h("div", { class: "small dim" }, "Touche pour fermer"));
    },
  });
}
