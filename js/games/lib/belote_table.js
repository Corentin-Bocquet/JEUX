// Table de jeu de plis à 4 (belote, manille) : tapis vert, partenaire en face,
// pli au centre, main en éventail, scores d'équipe, atout bien visible.
// Code d'affichage (DOM) partagé par js/views/belote.js et js/views/manille.js.
// Les classes sont préfixées g-belote (css/g/belote.css, importé par manille.css).
import { h } from "../../ui.js";
import { cardHTML, cardBackHTML, feltStyle } from "../../views/common.js";
import { SUIT_SYM, SUIT_NAME, cardName, teamOf, partnerOf } from "./plis32.js";

export const isRedSuit = (s) => s === "H" || s === "D";
export const suitSpan = (s, cls = "") => h("span", { class: `g-belote-suit ${isRedSuit(s) ? "red" : ""} ${cls}` }, SUIT_SYM[s]);
export const suitWord = (s) => SUIT_NAME[s].toLowerCase();

export function seatName(ctx, s, seat) {
  const id = s.order[seat];
  if (ctx.players[id]) return ctx.players[id].name;
  return "Robot " + (s.virt.indexOf(id) + 1);
}
export const mySeat = (ctx, s) => s.order.indexOf(ctx.me);
// position à l'écran : moi en bas, puis à droite, en face (partenaire), à gauche
const POS = ["bottom", "right", "top", "left"];
export const posOf = (s, me, seat) => POS[(seat - Math.max(0, me) + 4) % 4];

// cfg : { cls, legal(s, seat), trumpOf(s), sortHand(hand, s), top(ctx, s), center(ctx, s), controls(ctx, s, seat),
//         bubble(ctx, s, seat), summary(ctx, s, d), myTurnText(ctx, s), trumpLabel(s) }
export function mountTable(root, ctx0, cfg) {
  const el = h("div", { class: "g-belote " + (cfg.cls || "") });
  root.append(el);
  let lastTrickKey = null, showLast = false, lastT = null;
  let dealSeen = ctx0.state.lastDeal ? ctx0.state.lastDeal.n : 0, banner = null, bannerT = null, lastPlayKey = null, ctxNow = ctx0;

  function update(ctx) {
    ctxNow = ctx;
    const s = ctx.state;
    const me = mySeat(ctx, s);
    const seatMe = me < 0 ? 0 : me;
    const cur = s.phase === "over" ? -1 : s.cur;
    const myTurn = me >= 0 && cur === me;
    // sons et affichage temporaire du dernier pli
    const lp = s.lastPlay ? JSON.stringify(s.lastPlay) + s.deal : null;
    if (lp && lp !== lastPlayKey && lastPlayKey !== null) ctx.sfx.card();
    lastPlayKey = lp || "";
    const lk = s.lastTrick ? JSON.stringify(s.lastTrick) + s.deal : null;
    if (lk !== lastTrickKey) {
      if (lk && lastTrickKey !== null) {
        showLast = true;
        clearTimeout(lastT);
        lastT = setTimeout(() => { showLast = false; update(ctxNow); }, 1400);
        if (me >= 0 && teamOf(s.lastTrick.w) === teamOf(me)) ctx.sfx.coin();
      }
      lastTrickKey = lk;
    }
    if (s.lastDeal && s.lastDeal.n !== dealSeen) {
      dealSeen = s.lastDeal.n;
      banner = s.lastDeal;
      clearTimeout(bannerT);
      bannerT = setTimeout(() => { banner = null; update(ctxNow); }, banner.redeal ? 2200 : 3800);
      if (!banner.redeal && me >= 0 && banner.got[teamOf(me)] > banner.got[1 - teamOf(me)]) ctx.sfx.ok();
    }

    // scores d'équipe
    const myTeam = teamOf(seatMe);
    const scoreBox = (t, lab) => h("div", { class: "g-belote-team " + (t === myTeam ? "us" : "them") },
      h("span", { class: "lab" }, lab), h("b", null, s.scores[t]));
    const tr = cfg.trumpOf(s);
    const trumpBadge = h("div", { class: "g-belote-trump" + (tr ? "" : " none") },
      h("small", null, "Atout"),
      tr ? suitSpan(tr, "big") : h("span", { class: "g-belote-suit big" }, cfg.trumpLabel ? cfg.trumpLabel(s) : "?"));
    const head = h("div", { class: "g-belote-head" },
      scoreBox(myTeam, me >= 0 ? "Nous" : "Équipe 1"),
      h("div", { class: "g-belote-mid" }, trumpBadge, h("div", { class: "g-belote-goal small" }, `Partie en ${s.target}`, h("br"), `Donne ${s.deal}`)),
      scoreBox(1 - myTeam, me >= 0 ? "Eux" : "Équipe 2"));

    // tapis
    const felt = h("div", { class: "felt g-belote-felt", style: feltStyle(ctx.skin.table) });
    for (let seat = 0; seat < 4; seat++) {
      const pos = posOf(s, me, seat);
      const n = s.hands[seat].length;
      const isDealer = seat === s.dealer;
      const bubble = cfg.bubble(ctx, s, seat);
      felt.append(h("div", { class: `g-belote-seat ${pos}` + (seat === cur ? " turn" : "") + (teamOf(seat) === myTeam ? " us" : " them") },
        pos !== "bottom" ? h("div", { class: "g-belote-backs", html: Array.from({ length: Math.min(n, 8) }, () => cardBackHTML(ctx.skin.deck, 18)).join("") }) : null,
        h("div", { class: "g-belote-name" },
          isDealer ? h("i", { class: "g-belote-dealer", title: "Donneur" }, "D") : null,
          seat === me ? "Toi" : seatName(ctx, s, seat)),
        seat === partnerOf(seatMe) && me >= 0 ? h("div", { class: "g-belote-tag" }, "Partenaire") : null,
        bubble ? h("div", { class: "g-belote-bubble" }, bubble) : null));
    }
    // centre : pli en cours, dernier pli ramassé, ou infos d'enchères
    const center = h("div", { class: "g-belote-center" });
    const showing = showLast && !s.trick.length && s.lastTrick && s.phase !== "over";
    const cards = showing ? s.lastTrick.cards : s.trick;
    for (const t of cards) {
      const win = showing && t.p === s.lastTrick.w;
      center.append(h("div", { class: `g-belote-played ${posOf(s, me, t.p)}` + (win ? " win" : "") + (showing ? " gone" : ""), html: cardHTML(t.c) }));
    }
    if (!cards.length) {
      const c = cfg.center(ctx, s);
      if (c) center.append(c);
    }
    felt.append(center);
    if (banner) felt.append(h("div", { class: "g-belote-banner", onclick: () => { banner = null; update(ctxNow); } }, cfg.summary(ctx, s, banner)));
    else if (showing) felt.append(h("div", { class: "g-belote-pli" }, `Pli pour ${s.lastTrick.w === me ? "toi" : seatName(ctx, s, s.lastTrick.w)}`));

    // bandeau de tour
    let turn;
    if (s.phase === "over") turn = h("div", { class: "turnmsg" }, "Partie terminée");
    else if (myTurn) turn = h("div", { class: "turnmsg me" }, cfg.myTurnText(ctx, s));
    else turn = h("div", { class: "turnmsg" }, `${seatName(ctx, s, cur)} réfléchit…`);

    // main en éventail
    let hand = null;
    if (me >= 0) {
      const mine = cfg.sortHand(s.hands[me], s);
      const playing = myTurn && s.phase === "play";
      const ok = playing ? cfg.legal(s, me) : [];
      const n = mine.length;
      hand = h("div", { class: "g-belote-hand", style: `--n:${n}` }, mine.map((c, i) => {
        const can = ok.includes(c);
        return h("button", {
          class: "g-belote-hc" + (can ? " ok" : ""), disabled: !can, "aria-label": cardName(c),
          style: `--i:${i - (n - 1) / 2}`,
          html: cardHTML(c, { playable: can, dim: playing && !can }),
          onclick: () => { ctx.sfx.card(); ctx.act({ type: "play", card: c }); },
        });
      }));
    }
    const controls = myTurn ? cfg.controls(ctx, s, me) : null;
    el.replaceChildren(head, cfg.top ? cfg.top(ctx, s) : null, felt, turn, controls, hand);
  }
  update(ctx0);
  return { update, destroy() { clearTimeout(lastT); clearTimeout(bannerT); } };
}
