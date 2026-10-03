import { h, fmt } from "../ui.js";
import { cardHTML, cardBackHTML, feltStyle, turnLine, nameOf } from "./common.js";
import { toAct, value, isBJ, MIN, maxBetOf } from "../games/blackjack.js";

export const scoreOf = (s, id) => fmt(s.chips[id]);
export const scoreLabel = (v) => `${fmt(v)} jetons`;

export function mount(root, ctx0) {
  const el = h("div", { class: "g-bj" });
  root.append(el);
  let bet = 50, lastSeen = "";
  function update(ctx) {
    const s = ctx.state;
    const who = toAct(s);
    const mine = who.includes(ctx.me);
    const seen = `${s.manche}:${s.phase}:${JSON.stringify(s.hands)}`;
    if (seen !== lastSeen) { ctx.sfx.card(); lastSeen = seen; }
    const chipsMe = s.chips[ctx.me] ?? 0;
    const MAX = maxBetOf(s);
    bet = Math.max(MIN, Math.min(bet, Math.min(MAX, Math.floor(chipsMe / 10) * 10)));
    const showLast = s.phase !== "play" && s.last;
    const dealerCards = s.phase === "play" ? [s.dealer[0], null] : showLast ? s.last.dealer : [];
    const dealer = h("div", { class: "bj-dealer" },
      h("div", { class: "small dim" }, "Banque"),
      h("div", { class: "cards-row", html: dealerCards.map((c) => (c ? cardHTML(c) : cardBackHTML(ctx.skin.deck, 64))).join("") }),
      dealerCards.length ? h("div", { class: "bj-total" }, s.phase === "play" ? value([s.dealer[0]]).total : s.last.dealerTotal > 21 ? `${s.last.dealerTotal} sauté` : s.last.dealerTotal) : null);
    const spots = h("div", { class: "bj-spots" }, s.order.map((id) => {
      const handNow = s.phase === "play" ? s.hands[id] : showLast ? s.last.hands[id] : null;
      const b = s.phase === "play" ? s.bets[id] : showLast ? s.last.bets[id] : s.bets[id];
      const res = showLast && s.last.res[id];
      const v = handNow ? value(handNow).total : null;
      return h("div", { class: "bj-spot" + (who.includes(id) ? " turn" : "") + (id === ctx.me ? " me" : "") },
        h("div", { class: "cards-row sm", html: handNow ? handNow.map((c) => cardHTML(c, { small: true })).join("") : "" }),
        handNow ? h("div", { class: "bj-total" + (v > 21 ? " bust" : "") }, isBJ(handNow) ? "Blackjack !" : v > 21 ? `${v} sauté` : v) : null,
        b ? h("div", { class: "chipstack" }, h("i"), fmt(b)) : s.phase === "bet" && s.bets[id] == null && s.chips[id] >= MIN ? h("div", { class: "small dim" }, "mise…") : null,
        res ? h("div", { class: "bj-res " + (res.delta > 0 ? "win" : res.delta < 0 ? "lose" : "push") }, res.delta > 0 ? `+${fmt(res.delta)}` : res.delta < 0 ? fmt(res.delta) : "Égalité") : null,
        h("div", { class: "small nm" }, nameOf(ctx, id), h("span", { class: "dim" }, " · " + fmt(s.chips[id]))));
    }));
    let controls = null;
    if (mine && s.phase === "bet") {
      const amt = h("b", { class: "bet-amt" }, fmt(bet));
      const set = (v) => { bet = Math.max(MIN, Math.min(v, MAX, Math.floor(chipsMe / 10) * 10)); amt.textContent = fmt(bet); ctx.sfx.tap(); };
      controls = h("div", { class: "stack", style: { alignItems: "center" } },
        h("div", { class: "row gap center" }, h("button", { class: "btn ghost small", onclick: () => set(bet - 10) }, "-10"), amt, h("button", { class: "btn ghost small", onclick: () => set(bet + 10) }, "+10")),
        h("div", { class: "row gap center wrap" }, [10, 50, 100, 250].filter((v) => v <= MAX).map((v) => h("button", { class: "chip-btn c" + v, onclick: () => set(v) }, v)),
          h("button", { class: "btn ghost small", onclick: () => set(Infinity) }, "Max")),
        h("button", { class: "btn gold", onclick: () => ctx.act({ type: "bet", amount: bet }) }, `Miser ${fmt(bet)}`));
    } else if (mine && s.phase === "play") {
      const hand = s.hands[ctx.me];
      controls = h("div", { class: "row gap center wrap" },
        h("button", { class: "btn green", onclick: () => ctx.act({ type: "hit" }) }, "Carte"),
        h("button", { class: "btn red", onclick: () => ctx.act({ type: "stand" }) }, "Rester"),
        hand.length === 2 && chipsMe >= s.bets[ctx.me] * 2 ? h("button", { class: "btn purple", onclick: () => ctx.act({ type: "double" }) }, "Doubler") : null);
    }
    el.replaceChildren(
      h("div", { class: "small dim center" }, `Manche ${Math.min(s.manche, s.manches)} / ${s.manches} · sabot de ${s.decks || 6} jeu${(s.decks || 6) > 1 ? "x" : ""} (${s.shoe.length} cartes) · mise max ${MAX === Infinity ? "libre" : fmt(MAX)}`),
      h("div", { class: "felt bj-felt", style: feltStyle(ctx.skin.table) }, dealer, h("div", { class: "bj-arc" }, "LA BANQUE TIRE JUSQU'À 17 · BLACKJACK PAIE 3 POUR 2"), spots),
      turnLine(ctx, who, s.phase === "bet" ? "Place ta mise" : "Carte ou rester ?"),
      controls,
      s.phase === "bet" && !mine && chipsMe < MIN && ctx.me in s.chips ? h("p", { class: "small dim center" }, "Plus assez de jetons : tu regardes la fin.") : null);
  }
  update(ctx0);
  return { update };
}
