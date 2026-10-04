import { h } from "../ui.js";
import { cardHTML, cardBackHTML, feltStyle, nameOf } from "./common.js";
import { toAct, target, sortHand } from "../games/pouilleux.js";
import { label } from "../games/cards.js";
import { fanStyle, flyCard } from "../games/lib/president_fx.js";

export const scoreOf = (s, id) => `${s.poux[id]} 🐛`;
export const scoreLabel = (v) => `${v} pou${v > 1 ? "x" : ""}`;

export function mount(root, ctx0) {
  const el = h("div", { class: "g-pouilleux" });
  root.append(el);
  let lastSeq = ctx0.state.seq, banner = null, bannerT = null, busy = false, ctxNow = ctx0;
  let seenManche = ctx0.state.lastManche ? ctx0.state.lastManche.manche : 0;

  function draw(ctx, idx, btn) {
    if (busy) return;
    busy = true;
    ctx.sfx.card();
    btn.classList.add("pulled");
    setTimeout(() => { busy = false; ctx.act({ type: "draw", idx }); }, 160);
  }

  function update(ctx) {
    ctxNow = ctx;
    const s = ctx.state;
    const who = toAct(s);
    const mine = who.includes(ctx.me);
    const fresh = s.seq !== lastSeq;
    lastSeq = s.seq;
    const hand = sortHand(s.hands[ctx.me] || []);
    const drawer = who[0];
    const victim = s.over ? null : target(s);

    if (s.lastManche && s.lastManche.manche !== seenManche) {
      seenManche = s.lastManche.manche;
      banner = s.lastManche;
      clearTimeout(bannerT);
      bannerT = setTimeout(() => { banner = null; update(ctxNow); }, 4800);
      if (s.lastManche.loser === ctx.me) ctx.sfx.bad(); else ctx.sfx.win();
    }

    const others = s.order.filter((id) => id !== ctx.me);
    const seats = h("div", { class: "g-pouilleux-seats" }, others.map((id) => {
      const n = s.hands[id].length;
      return h("div", { class: "g-pouilleux-seat" + (id === drawer ? " turn" : "") + (id === victim ? " victim" : "") + (!n ? " safe" : ""), "data-id": id },
        h("div", { class: "g-pouilleux-backs", html: n ? Array.from({ length: Math.min(n, 4) }, () => cardBackHTML(ctx.skin.deck, 22)).join("") : "😌" },
          n ? h("b", { class: "g-pouilleux-count" }, n) : null),
        h("div", { class: "g-pouilleux-name" }, nameOf(ctx, id)),
        h("div", { class: "g-pouilleux-meta" }, `${s.found[id]} paire${s.found[id] > 1 ? "s" : ""}`, s.poux[id] ? ` · ${s.poux[id]} 🐛` : ""),
        id === victim && drawer !== ctx.me ? h("span", { class: "g-pouilleux-tag" }, "se fait piocher") : null);
    }));

    // ---- centre
    let center;
    if (s.over) center = h("div", { class: "g-pouilleux-big" }, "Partie terminée");
    else {
      const vn = s.hands[victim].length;
      const cards = Array.from({ length: vn }, (_, i) => {
        const st = fanStyle(i, vn, { max: 40, spread: 4 });
        if (mine) return h("button", { class: "g-pouilleux-pick", style: st + `;--i:${i}`, "aria-label": `Carte ${i + 1}`, html: cardBackHTML(ctx.skin.deck, 58),
          onclick: (e) => draw(ctx, i, e.currentTarget) });
        return h("div", { class: "g-pouilleux-pick idle", style: st, html: cardBackHTML(ctx.skin.deck, 46) });
      });
      center = h("div", { class: "g-pouilleux-center" },
        h("div", { class: "g-pouilleux-who" }, mine ? h("span", null, "Tire une carte chez ", h("b", null, nameOf(ctx, victim))) :
          h("span", null, h("b", null, nameOf(ctx, drawer)), " tire chez ", h("b", null, victim === ctx.me ? "toi" : nameOf(ctx, victim)))),
        h("div", { class: "g-pouilleux-victim" + (mine ? " mine" : "") }, cards));
    }
    // dernière action
    const l = s.log;
    let last = null;
    if (l && l.t === "draw") {
      const seeIt = l.id === ctx.me || l.from === ctx.me;
      const who2 = l.id === ctx.me ? "Tu" : nameOf(ctx, l.id);
      let txt;
      if (l.id === ctx.me) txt = l.pair ? `Tu tires ${label(l.card)} : paire !` : `Tu tires ${label(l.card)}, pas de paire`;
      else if (l.from === ctx.me) txt = `${who2} te prend ${label(l.card)}` + (l.pair ? " et fait une paire" : "");
      else txt = l.pair ? `${who2} fait une paire !` : `${who2} garde sa carte`;
      last = h("div", { class: "g-pouilleux-last" },
        l.pair ? h("div", { class: "g-pouilleux-pair", html: cardHTML(l.card, { small: true }) + cardHTML(l.pair, { small: true }) }) :
          seeIt ? h("div", { class: "g-pouilleux-pair", html: cardHTML(l.card, { small: true }) }) : null,
        h("span", null, txt));
    } else if (l && l.t === "deal") last = h("div", { class: "g-pouilleux-last" }, h("span", null, `Manche ${l.manche} : les paires sont défaussées, c'est parti !`));
    const info = h("div", { class: "g-pouilleux-info" }, h("span", null, `Manche ${s.manche} / ${s.rounds}`),
      h("span", null, s.card === "Q" ? "Sans la Dame ♣" : "Sans le Valet ♣"), h("span", null, s.pairs === "color" ? "Paires de même teinte" : "Paires de même valeur"));
    const felt = h("div", { class: "felt g-pouilleux-felt", style: feltStyle(ctx.skin.table) }, info, center, last,
      banner ? h("div", { class: "g-pouilleux-banner" }, h("div", { class: "g-pouilleux-bug" }, "🐛"),
        h("div", { class: "g-pouilleux-big" }, banner.loser === ctx.me ? "Tu gardes le Pouilleux !" : `${nameOf(ctx, banner.loser)} garde le Pouilleux !`),
        h("div", { html: cardHTML(banner.card) }), h("div", { class: "small" }, `Fin de la manche ${banner.manche} : un pou de plus pour ${banner.loser === ctx.me ? "toi" : nameOf(ctx, banner.loser)}`)) : null);

    let msg, cls = "turnmsg";
    if (s.over) msg = "Partie terminée";
    else if (mine) { msg = "À toi : touche une carte de ton voisin"; cls += " me"; }
    else if (!hand.length) msg = "Tu es tiré d'affaire pour cette manche 😌";
    else msg = `${nameOf(ctx, drawer)} choisit une carte…`;

    const myFan = h("div", { class: "g-pouilleux-hand" + (victim === ctx.me && !mine ? " watched" : "") }, hand.map((c, i) =>
      h("div", { class: "g-pouilleux-hc", style: fanStyle(i, hand.length, { max: 36 }), html: cardHTML(c) })));
    el.replaceChildren(seats, felt, h("div", { class: cls }, msg),
      h("div", { class: "g-pouilleux-mine small dim" }, hand.length ? `Ta main : ${hand.length} carte${hand.length > 1 ? "s" : ""} · ${s.found[ctx.me] || 0} paire${(s.found[ctx.me] || 0) > 1 ? "s" : ""} posée${(s.found[ctx.me] || 0) > 1 ? "s" : ""}` : "Plus de carte en main"),
      myFan);

    // ---- animation du tirage
    if (fresh && l && l.t === "draw") {
      const seat = (id) => (id === ctx.me ? myFan : el.querySelector(`.g-pouilleux-seat[data-id="${id}"]`));
      const from = l.id === ctx.me ? el.querySelector(".g-pouilleux-victim") || seat(l.from) : seat(l.from);
      const to = l.pair ? el.querySelector(".g-pouilleux-pair") || seat(l.id) : seat(l.id);
      const seeIt = l.id === ctx.me || l.from === ctx.me;
      flyCard(cardBackHTML(ctx.skin.deck, 56), from, to, { cls: "g-pouilleux-fly", dur: 700, flipAt: seeIt ? 0.45 : null, faceHtml: seeIt ? cardHTML(l.card) : null });
      if (l.pair) setTimeout(() => ctx.sfx.ok(), 500); else ctx.sfx.card();
    }
  }
  update(ctx0);
  return { update, destroy() { clearTimeout(bannerT); } };
}
