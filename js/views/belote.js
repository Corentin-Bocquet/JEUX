import { h } from "../ui.js";
import { cardHTML } from "./common.js";
import { mountTable, seatName, suitSpan, suitWord, mySeat } from "../games/lib/belote_table.js";
import { teamOf, SUITS32, suitOf } from "../games/lib/plis32.js";
import { rulesOf, legalCards, BIDS } from "../games/belote.js";

export const scoreOf = (s, id) => {
  const seat = s.order.indexOf(id);
  return seat < 0 ? "" : `${s.scores[teamOf(seat)]} pts`;
};
export const scoreLabel = (v) => `${v} pts`;

const nm = (ctx, s, seat) => (seat === mySeat(ctx, s) ? "Toi" : seatName(ctx, s, seat));
const multTxt = (m) => (m === 4 ? " surcoinché" : m === 2 ? " coinché" : "");

export function mount(root, ctx0) {
  let pick = null; // valeur choisie pour l'annonce coinchée
  return mountTable(root, ctx0, {
    cls: "g-belote-game",
    trumpOf: (s) => s.trump,
    trumpLabel: () => "?",
    legal: (s, seat) => legalCards(s, seat),
    sortHand: (hand, s) => rulesOf(s).sortHand(hand, s.trump),
    top(ctx, s) {
      let txt = null;
      if (s.taker != null && s.phase === "play") {
        txt = s.variant === "coinche"
          ? [h("b", null, nm(ctx, s, s.taker)), ` joue ${s.contract} à `, suitSpan(s.trump), multTxt(s.mult)]
          : [h("b", null, nm(ctx, s, s.taker)), " a pris à ", suitSpan(s.trump)];
      } else if (s.phase === "auction" || s.phase === "surco") {
        txt = s.bid ? ["Meilleure annonce : ", h("b", null, `${s.bid.v} `), suitSpan(s.bid.suit), ` (${nm(ctx, s, s.bid.p)})`, multTxt(s.mult)] : ["Annonces de 80 à 160"];
      } else if (s.phase === "bid1") txt = ["1er tour : prendre à la couleur retournée ?"];
      else if (s.phase === "bid2") txt = ["2e tour : choisir une autre couleur"];
      if (s.litige && s.phase !== "over") txt = [...(txt || []), h("span", { class: "g-belote-lit" }, ` · litige ${s.litige} pts en jeu`)];
      return txt ? h("div", { class: "g-belote-info" }, txt) : null;
    },
    center(ctx, s) {
      if (s.phase === "bid1" || s.phase === "bid2") {
        return h("div", { class: "g-belote-turned" }, h("div", { html: cardHTML(s.turned) }), h("small", null, "Retourne"));
      }
      if (s.phase === "auction" || s.phase === "surco") {
        return h("div", { class: "g-belote-auction" }, s.bid ? [h("b", null, s.bid.v), suitSpan(s.bid.suit, "big")] : h("small", null, "Aucune annonce"));
      }
      return null;
    },
    bubble(ctx, s, seat) {
      if (s.phase === "play") {
        if (s.lastPlay && s.lastPlay.p === seat && s.lastPlay.say) return s.lastPlay.say + " !";
        return seat === s.taker ? "Preneur" : null;
      }
      if (s.phase === "over") return null;
      const mine = s.bids.filter((b) => b.p === seat);
      const b = mine[mine.length - 1];
      if (!b) return null;
      if (b.t === "pass") return "Passe";
      if (b.t === "take") return h("span", null, "Prend ", suitSpan(b.s));
      if (b.t === "bid") return h("span", null, `${b.v} `, suitSpan(b.s));
      if (b.t === "coinche") return "Coinche !";
      if (b.t === "surco") return "Surcoinche !";
      return null;
    },
    myTurnText(ctx, s) {
      if (s.phase === "bid1") return h("span", null, "Tu prends à ", suitSpan(suitOf(s.turned)), " ?");
      if (s.phase === "bid2") return "Choisis un atout ou passe";
      if (s.phase === "auction") return "À toi d'annoncer";
      if (s.phase === "surco") return "On te coinche ! Tu surcoinches ?";
      return s.trick.length ? "À toi : joue une carte en surbrillance" : "À toi d'entamer";
    },
    controls(ctx, s, me) {
      const go = (a) => { ctx.sfx.tap(); ctx.act(a); };
      const passBtn = h("button", { class: "btn ghost", onclick: () => go({ type: "pass" }) }, "Je passe");
      if (s.phase === "bid1") {
        const t = suitOf(s.turned);
        return h("div", { class: "g-belote-ctrl" }, h("div", { class: "row gap" },
          h("button", { class: "btn green grow", onclick: () => go({ type: "take" }) }, "Je prends ", suitSpan(t)), passBtn));
      }
      if (s.phase === "bid2") {
        const ts = suitOf(s.turned);
        return h("div", { class: "g-belote-ctrl" },
          h("div", { class: "g-belote-suits" }, SUITS32.filter((x) => x !== ts).map((x) =>
            h("button", { class: "g-belote-suitbtn", "aria-label": "Prendre à " + suitWord(x), onclick: () => go({ type: "take", suit: x }) }, suitSpan(x, "big"), h("small", null, "Prendre")))),
          h("div", { class: "row center" }, passBtn));
      }
      if (s.phase === "surco") {
        return h("div", { class: "g-belote-ctrl" }, h("div", { class: "row gap" },
          h("button", { class: "btn red grow", onclick: () => go({ type: "surco" }) }, "Surcoincher (x4)"),
          h("button", { class: "btn ghost", onclick: () => go({ type: "pass" }) }, "Non merci")));
      }
      if (s.phase === "auction") {
        const vals = BIDS.filter((v) => !s.bid || v > s.bid.v);
        if (!vals.includes(pick)) pick = vals[0];
        const chips = h("div", { class: "g-belote-vals" }, vals.map((v) => h("button", {
          class: "chip g-belote-val" + (v === pick ? " on" : ""),
          onclick: (e) => { pick = v; chips.querySelectorAll(".g-belote-val").forEach((b) => b.classList.toggle("on", b === e.currentTarget)); suits.querySelectorAll("small").forEach((x) => (x.textContent = String(pick))); },
        }, v)));
        const suits = h("div", { class: "g-belote-suits four" }, SUITS32.map((x) =>
          h("button", { class: "g-belote-suitbtn", disabled: !vals.length, "aria-label": "Annoncer à " + suitWord(x), onclick: () => go({ type: "bid", v: pick, suit: x }) }, suitSpan(x, "big"), h("small", null, String(pick)))));
        const canCoinche = s.bid && teamOf(s.bid.p) !== teamOf(me);
        return h("div", { class: "g-belote-ctrl" },
          vals.length ? [h("div", { class: "small dim center" }, "Choisis ta valeur puis ta couleur"), chips, suits] : null,
          h("div", { class: "row gap center" }, passBtn, canCoinche ? h("button", { class: "btn red", onclick: () => go({ type: "coinche" }) }, "Coincher !") : null));
      }
      return null;
    },
    summary(ctx, s, d) {
      if (d.redeal) return h("div", null, h("div", { class: "h3" }, "Personne ne prend"), h("div", { class: "small" }, "On redistribue les cartes."));
      const me = Math.max(0, mySeat(ctx, s));
      const us = teamOf(me), T = teamOf(d.taker);
      let title = d.made === true ? (T === us ? "Contrat réussi !" : "Ils ont réussi") : d.made === false ? (T === us ? "Dedans !" : "Ils sont dedans !") : "Litige";
      if (d.capot != null) title = "Capot !";
      const line = (t, lab) => h("div", { class: "g-belote-sumrow" + (t === us ? " us" : "") },
        h("span", null, lab), h("span", { class: "dim" }, `${d.card[t]} pts` + (d.bel[t] ? " + belote" : "")), h("b", null, `+${d.got[t]}`));
      return h("div", null,
        h("div", { class: "h3" }, title),
        h("div", { class: "small" }, nm(ctx, s, d.taker), s.variant === "coinche" ? ` · contrat ${d.contract}${multTxt(d.mult)} à ` : " · atout ", suitSpan(d.trump)),
        line(us, "Nous"), line(1 - us, "Eux"),
        d.litige ? h("div", { class: "small" }, `${d.litige} pts en litige pour la donne suivante`) : null,
        d.litigeTo != null ? h("div", { class: "small" }, `Litige de ${d.litigePts} pts gagné par ${d.litigeTo === us ? "nous" : "eux"}`) : null,
        h("div", { class: "small dim" }, "Touche pour fermer"));
    },
  });
}
