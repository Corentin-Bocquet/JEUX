import { h, fmt } from "../ui.js";
import { cardHTML, cardBackHTML, feltStyle, turnLine, nameOf } from "./common.js";
import { avatarHTML } from "../avatar.js";
import { toAct, legal, potTotal, evaluate, handName } from "../games/poker.js";

export const scoreOf = (s, id) => (s.chips[id] > 0 || (s.hand && s.hand.inHand.includes(id)) ? fmt(s.chips[id]) : "out");
export const scoreLabel = (v) => `${fmt(v)} jetons`;
const ACT = { fold: "se couche", check: "parole", call: "suit", raise: "relance" };

export function mount(root, ctx0) {
  const el = h("div", { class: "g-poker" });
  root.append(el);
  let shownHand = 0, banner = null, bannerT = null, raiseTo = null, lastAct = "";
  function update(ctx) {
    const s = ctx.state;
    const H = s.hand;
    const who = toAct(s);
    const mine = who.includes(ctx.me);
    const n = s.order.length;
    const meIdx = Math.max(0, s.order.indexOf(ctx.me));
    const la = H && H.lastAct ? JSON.stringify(H.lastAct) : "";
    if (la && la !== lastAct) { H.lastAct.t === "fold" ? ctx.sfx.tap() : ctx.sfx.card(); }
    lastAct = la;
    if (s.last && s.last.handNo !== shownHand) {
      shownHand = s.last.handNo;
      banner = s.last;
      clearTimeout(bannerT);
      bannerT = setTimeout(() => { banner = null; update(ctx); }, 4200);
      const won = s.last.won[ctx.me];
      if (won) ctx.sfx.coin();
    }
    const table = h("div", { class: "pk-table", style: feltStyle(ctx.skin.table) });
    const board = (banner ? banner.board : H ? H.board : []);
    table.append(h("div", { class: "pk-center" },
      h("div", { class: "cards-row", html: [0, 1, 2, 3, 4].map((i) => (board[i] ? cardHTML(board[i]) : `<div class="pcard slot"></div>`)).join("") }),
      h("div", { class: "pk-pot" }, h("i", { class: "chipdot" }), banner ? `Pot gagné` : `Pot ${fmt(potTotal(s))}`),
      h("div", { class: "small pk-blinds" }, `Blinds ${s.sb}/${s.bb}${s.blindUp === 0 ? " fixes" : ""} · main ${s.handNo}/${s.maxHands}`)));
    s.order.forEach((id, k) => {
      const rel = (k - meIdx + n) % n;
      const th = (rel / n) * Math.PI * 2;
      const x = 50 - 43 * Math.sin(th), y = 50 + 41 * Math.cos(th);
      const p = ctx.players[id] || { name: "?" };
      const inHand = H && H.inHand.includes(id);
      const folded = inHand && H.folded[id];
      const shown = banner && banner.shown[id];
      let cards = "";
      if (shown) cards = shown.cards.map((c) => cardHTML(c, { small: true })).join("");
      else if (inHand && !folded) cards = id === ctx.me ? H.holes[id].map((c) => cardHTML(c, { small: true })).join("") : cardBackHTML(ctx.skin.deck, 30) + cardBackHTML(ctx.skin.deck, 30);
      const isDealer = s.order[s.dealer] === id;
      const bet = H && H.bet[id] ? H.bet[id] : 0;
      const won = banner && banner.won[id];
      table.append(h("div", { class: "pk-seat" + (who.includes(id) ? " turn" : "") + (folded ? " folded" : "") + (s.chips[id] === 0 && !inHand ? " out" : "") + (id === ctx.me ? " me" : ""),
        style: `left:${x}%;top:${y}%` },
        h("div", { class: "pk-cards", html: cards }),
        h("div", { class: "pk-av", html: avatarHTML(p, 40) }, isDealer ? h("span", { class: "dealer" }, "D") : null),
        h("div", { class: "pk-nm" }, p.name),
        h("div", { class: "pk-chips" }, H && H.allin[id] ? "Tapis" : fmt(s.chips[id])),
        shown ? h("div", { class: "pk-hand" }, shown.name) : null,
        won ? h("div", { class: "pk-won" }, "+" + fmt(won)) : null,
        bet && !banner ? h("div", { class: "pk-bet" }, h("i", { class: "chipdot" }), fmt(bet)) : null,
        H && H.lastAct && H.lastAct.id === id && !banner ? h("div", { class: "pk-act" }, ACT[H.lastAct.t]) : null));
    });
    let controls = null;
    if (mine && H) {
      const L = legal(s, ctx.me);
      if (raiseTo == null || raiseTo < L.minTo || raiseTo > L.maxTo) raiseTo = L.minTo;
      const val = h("b", null, fmt(raiseTo));
      const slider = h("input", { type: "range", class: "range", min: L.minTo, max: L.maxTo, step: Math.max(1, s.bb / 2), value: raiseTo, "aria-label": "Montant de la relance",
        oninput: (e) => { raiseTo = +e.target.value; val.textContent = fmt(raiseTo); } });
      const quick = (lab, v) => h("button", { class: "chip", onclick: () => { raiseTo = Math.max(L.minTo, Math.min(L.maxTo, Math.round(v))); slider.value = raiseTo; val.textContent = fmt(raiseTo); } }, lab);
      const myBest = H.board.length ? handName(evaluate([...H.holes[ctx.me], ...H.board])) : null;
      controls = h("div", { class: "pk-ctrl glass" },
        myBest ? h("div", { class: "small dim center" }, "Ta main : ", h("b", null, myBest)) : null,
        L.canRaise ? h("div", { class: "stack", style: { gap: "8px" } },
          h("div", { class: "row gap" }, h("span", { class: "small dim" }, H.toCall ? "Relancer à" : "Miser"), val, h("div", { class: "grow" }), quick("½ pot", H.toCall + L.pot / 2), quick("Pot", H.toCall + L.pot), quick("Tapis", L.maxTo)),
          slider) : null,
        h("div", { class: "row gap" },
          h("button", { class: "btn red grow", onclick: () => ctx.act({ type: "fold" }) }, "Coucher"),
          L.check ? h("button", { class: "btn grow", onclick: () => ctx.act({ type: "check" }) }, "Parole")
            : h("button", { class: "btn grow", onclick: () => ctx.act({ type: "call" }) }, `Suivre ${fmt(L.owe)}`),
          L.canRaise ? h("button", { class: "btn gold grow", onclick: () => ctx.act({ type: "raise", to: raiseTo }) }, raiseTo === L.maxTo ? "Tapis !" : H.toCall ? "Relancer" : "Miser") : null));
    } else raiseTo = null;
    const bannerTxt = banner ? Object.entries(banner.won).map(([id, v]) => `${nameOf(ctx, id)} gagne ${fmt(v)}${banner.shown[id] ? " avec " + banner.shown[id].name.toLowerCase() : ""}`).join(" · ") : null;
    el.replaceChildren(
      table,
      bannerTxt ? h("div", { class: "pk-banner glass" }, bannerTxt) : turnLine(ctx, who, "À toi de parler"),
      controls);
  }
  update(ctx0);
  return { update, destroy() { clearTimeout(bannerT); } };
}
