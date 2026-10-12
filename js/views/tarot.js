import { h } from "../ui.js";
import { feltStyle, turnLine, nameOf } from "./common.js";
import {
  toAct, legal, isTrump, isExcuse, isOudler, trumpN, suitOf, rankOf, SUIT_SYM, SUIT_NAME, RANK_LBL, BIDS,
  callable, chienSize, ecartable, canAnnounce, poigneeMax, POIGNEE, POIGNEE_NAME, cardName, trickWinner, sortHand,
} from "../games/tarot.js";

export const scoreOf = (s, id) => `${s.scores[id] > 0 ? "+" : ""}${s.scores[id]}`;
export const scoreLabel = (v) => `${v > 0 ? "+" : ""}${v} pts`;

// carte de tarot : couleurs, atouts numérotés, excuse étoilée
export function tcard(c, { sm, ok, dim, sel } = {}) {
  const cls = "g-tarot-c" + (sm ? " sm" : "") + (ok ? " ok" : "") + (dim ? " dim" : "") + (sel ? " sel" : "");
  if (isExcuse(c)) return `<div class="${cls} exc" aria-label="Excuse"><span class="star">★</span><span class="lab">Excuse</span></div>`;
  if (isTrump(c)) {
    const n = trumpN(c);
    return `<div class="${cls} atout${isOudler(c) ? " bout" : ""}" aria-label="Atout ${n}"><span class="tl">${n}</span><span class="big">${n}</span><span class="lab">${n === 1 ? "Petit" : "atout"}</span></div>`;
  }
  const su = suitOf(c), r = rankOf(c), R = RANK_LBL[r] || r;
  const red = su === "H" || su === "D";
  return `<div class="${cls}${red ? " red" : ""}${r > 10 ? " fig" : ""}" aria-label="${cardName(c)}"><span class="tl">${R}<i>${SUIT_SYM[su]}</i></span><span class="mid">${r > 10 ? `<b>${R}</b>` : ""}${SUIT_SYM[su]}</span></div>`;
}

export function mount(root, ctx0) {
  const el = h("div", { class: "g-tarot" });
  root.append(el);
  let sel = [], poignee = 0, seenDonne = ctx0.state.last ? ctx0.state.last.donne : 0, banner = null, bannerT = null, lastLog = "";
  function update(ctx) {
    const s = ctx.state;
    const who = toAct(s);
    const mine = who.includes(ctx.me);
    const hand = s.hands[ctx.me] || [];
    const logKey = JSON.stringify(s.log);
    if (logKey !== lastLog && s.log && s.log.t === "play") ctx.sfx.card();
    lastLog = logKey;
    if (s.last && s.last.donne !== seenDonne) {
      seenDonne = s.last.donne;
      banner = s.last;
      sel = []; poignee = 0;
      (s.last.delta[ctx.me] || 0) > 0 ? ctx.sfx.coin() : ctx.sfx.tap();
      clearTimeout(bannerT);
      if (!s.over) bannerT = setTimeout(() => { banner = null; update(ctx); }, 5500);
    }
    if (s.phase !== "chien") sel = [];

    // ---- bandeau du contrat
    const info = h("div", { class: "g-tarot-info" },
      h("span", { class: "chip" }, `Donne ${s.donne}/${s.total}`),
      s.taker ? h("span", { class: "chip g-tarot-contract" }, `${BIDS[s.bid]} · ${nameOf(ctx, s.taker)}`) : h("span", { class: "chip" }, "Enchères"),
      s.called ? h("span", { class: "chip" + (suitOf(s.called) === "H" || suitOf(s.called) === "D" ? " g-tarot-red" : "") },
        `Appel : ${RANK_LBL[rankOf(s.called)]}${SUIT_SYM[suitOf(s.called)]}`, s.revealed && s.partner ? ` (${nameOf(ctx, s.partner)})` : "") : null);

    // ---- adversaires
    const me = Math.max(0, s.order.indexOf(ctx.me));
    const others = s.order.map((_, k) => s.order[(me + 1 + k) % s.n]).filter((id) => id !== ctx.me);
    const tag = (id) => {
      if (s.phase === "bid") return s.bids[id] === undefined ? "" : BIDS[s.bids[id]];
      if (id === s.taker) return "Preneur";
      if (s.revealed && id === s.partner) return "Appelé";
      return "";
    };
    const seats = h("div", { class: "g-tarot-seats" }, others.map((id) => h("div", { class: "g-tarot-seat" + (who.includes(id) ? " turn" : "") + (id === s.taker ? " taker" : "") },
      h("b", null, nameOf(ctx, id)),
      h("span", { class: "small" }, `${(s.hands[id] || []).length} cartes`, s.order[s.dealer] === id ? " · donne" : ""),
      tag(id) ? h("span", { class: "g-tarot-tag" }, tag(id)) : null)));

    // ---- centre du tapis
    let center, msg = "";
    if (banner) center = bannerView(ctx, banner, s);
    else if (s.phase === "chien" && s.chienShown) {
      center = h("div", { class: "g-tarot-mid" }, h("div", { class: "small" }, "Le chien"), h("div", { class: "g-tarot-row", html: s.chienShown.map((c) => tcard(c, { sm: true })).join("") }));
      msg = `${nameOf(ctx, s.taker)} prend le chien et fait son écart`;
    } else if (s.phase === "bid" || s.phase === "call") {
      center = h("div", { class: "g-tarot-mid" }, h("div", { class: "g-tarot-bids" }, s.order.map((id) => h("div", { class: "g-tarot-bid" + (s.bids[id] ? " up" : "") },
        h("span", null, nameOf(ctx, id)), h("b", null, s.bids[id] === undefined ? "…" : BIDS[s.bids[id]])))));
      msg = s.phase === "call" ? `${nameOf(ctx, s.taker)} appelle un roi` : s.log && s.log.t === "allpass" ? "Tout le monde a passé : nouvelle donne" : "Enchères";
    } else {
      const tr = s.trick.length ? s.trick : s.lastTrick ? s.lastTrick.cards : [];
      const win = s.trick.length ? trickWinner(s.trick) : s.lastTrick ? s.lastTrick.win : null;
      center = h("div", { class: "g-tarot-trick" + (s.trick.length ? "" : " done") }, tr.map((t) => h("div", { class: "g-tarot-played" + (t.p === win ? " win" : "") },
        h("div", { html: tcard(t.c) }), h("span", null, t.p === ctx.me ? "Toi" : nameOf(ctx, t.p)))));
      if (!s.trick.length && s.lastTrick) msg = `Pli ${s.lastTrick.no} pour ${nameOf(ctx, s.lastTrick.win)}`;
      const ann = s.annonces[s.annonces.length - 1];
      if (ann && s.tricksDone === 0) msg = `${nameOf(ctx, ann.id)} annonce une poignée ${POIGNEE_NAME[ann.lvl]} : ${ann.cards.map((c) => (c === "EX" ? "Excuse" : trumpN(c))).join(", ")}`;
      else if (s.ecartAtouts.length && s.tricksDone === 0) msg = `Atouts à l'écart : ${s.ecartAtouts.map(trumpN).join(", ")}`;
    }
    const felt = h("div", { class: "felt g-tarot-felt", style: feltStyle(ctx.skin.table) }, center, h("div", { class: "small center felt-msg" }, msg));

    // ---- actions
    let actions = null, hint = "À toi de jouer : choisis une carte";
    if (mine && s.phase === "bid") {
      hint = "À toi de parler";
      actions = h("div", { class: "g-tarot-actions" }, BIDS.map((b, i) => h("button", {
        class: "btn " + (i === 0 ? "ghost" : i >= 3 ? "purple" : "green"), disabled: (i > 0 && i <= s.bid) || (i === 1 && !s.petite),
        onclick: () => { ctx.sfx.tap(); ctx.act({ type: "bid", bid: i }); } }, b)));
    } else if (mine && s.phase === "call") {
      hint = "Appelle un roi : son propriétaire jouera avec toi";
      actions = h("div", { class: "g-tarot-actions four" }, callable(s).map((c) => h("button", { class: "g-tarot-pick", "aria-label": cardName(c), html: tcard(c),
        onclick: () => { ctx.sfx.tap(); ctx.act({ type: "call", card: c }); } })));
    } else if (mine && s.phase === "chien") {
      const n = chienSize(s.n);
      hint = `Écarte ${n} cartes (ni roi ni bout) : ${sel.length}/${n}`;
      actions = h("div", { class: "g-tarot-actions one" }, h("button", { class: "btn gold block", disabled: sel.length !== n,
        onclick: () => { ctx.sfx.ok(); ctx.act({ type: "discard", cards: sel }); sel = []; } }, "Valider l'écart"));
    } else if (mine && s.phase === "play" && canAnnounce(s, ctx.me)) {
      const max = poigneeMax(s, hand);
      actions = h("div", { class: "g-tarot-actions poign" }, h("span", { class: "small" }, "Poignée ?"),
        [0, 1, 2, 3].filter((l) => l <= max).map((l) => h("button", { class: "chip" + (poignee === l ? " on" : ""),
          onclick: () => { poignee = l; update(ctx); } }, l ? `${POIGNEE_NAME[l]} (${POIGNEE[s.n][l - 1]})` : "Non")));
    }

    // ---- ma main
    const ok = mine && s.phase === "play" ? legal(s, ctx.me) : [];
    const canEcart = mine && s.phase === "chien" ? ecartable(hand, chienSize(s.n)) : [];
    const myHand = h("div", { class: "g-tarot-hand" + (hand.length > 18 ? " big" : "") }, sortHand(hand).map((c) => {
      const playable = ok.includes(c) || canEcart.includes(c);
      const picked = sel.includes(c);
      return h("button", { class: "g-tarot-h", disabled: !playable, "aria-label": cardName(c), html: tcard(c, { ok: playable && !picked && s.phase === "play", dim: mine && !playable, sel: picked }),
        onclick: () => {
          if (s.phase === "chien") {
            sel = picked ? sel.filter((x) => x !== c) : sel.length < chienSize(s.n) ? [...sel, c] : sel;
            ctx.sfx.tap(); update(ctx); return;
          }
          const a = { type: "play", card: c };
          if (poignee) a.poignee = poignee;
          poignee = 0;
          ctx.act(a);
        } });
    }));
    el.replaceChildren(info, seats, felt, turnLine(ctx, who, hint), actions, myHand);
  }
  update(ctx0);
  return { update, destroy() { clearTimeout(bannerT); } };
}

function bannerView(ctx, b, s) {
  const lines = [
    h("div", { class: "g-tarot-res " + (b.won ? "ok" : "ko") }, `${BIDS[b.bid]} de ${nameOf(ctx, b.taker)} ${b.won ? "réussie" : "chutée"}`),
    h("div", { class: "small" }, `${b.att} points pour ${b.need} demandés (${b.oudlers} bout${b.oudlers > 1 ? "s" : ""})`, b.gain ? ` · écart ${b.gain}` : ""),
    b.partner ? h("div", { class: "small" }, `Partenaire : ${nameOf(ctx, b.partner)}`) : null,
    b.pab ? h("div", { class: "small" }, `Petit au bout pour ${b.pab === "att" ? "l'attaque" : "la défense"}`) : null,
    b.poign ? h("div", { class: "small" }, `Poignée : ${b.poign} points`) : null,
    h("div", { class: "g-tarot-deltas" }, s.order.map((id) => h("span", { class: b.delta[id] > 0 ? "up" : b.delta[id] < 0 ? "down" : "" },
      `${id === ctx.me ? "Toi" : nameOf(ctx, id)} ${b.delta[id] > 0 ? "+" : ""}${b.delta[id]}`))),
  ];
  return h("div", { class: "g-tarot-banner" }, lines);
}
