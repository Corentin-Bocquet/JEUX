import { h } from "../ui.js";
import { cardHTML, cardBackHTML, feltStyle, turnLine, nameOf } from "./common.js";
import { toAct, analyze, extend, swapIndex, meldPoints, isJ, rankN, suitOf, SUITS, handPts } from "../games/rami.js";
import { label } from "../games/cards.js";

export const scoreOf = (s, id) => (s.target ? `${s.scores[id]} pts` : s.hands[id].length + " c.");
export const scoreLabel = (v) => `${v} pts`;

const jokerHTML = (extra = "") => `<div class="pcard g-rami-jk ${extra}" data-c="JK" aria-label="Joker"><span class="tl">J<i>★</i></span><span class="mid">★</span></div>`;
const cHTML = (c, o = {}) => (isJ(c) ? jokerHTML(o.sel ? "sel" : "") : cardHTML(c, o));
const lab = (c) => (isJ(c) ? "Joker" : label(c));

function sortHand(hand, mode) {
  const key = (c) => {
    if (isJ(c)) return 1e6;
    const r = rankN(c) === 1 ? 14 : rankN(c), s = SUITS.indexOf(suitOf(c));
    return mode === "suit" ? s * 100 + r : r * 10 + s;
  };
  return hand.map((c, i) => ({ c, i })).sort((a, b) => key(a.c) - key(b.c) || a.i - b.i);
}

export function mount(root, ctx0) {
  const el = h("div", { class: "g-rami" });
  root.append(el);
  let ctx = ctx0, mode = "suit", sel = new Set(), pending = [], handKey = "", lastLog = "";
  let seenRound = ctx0.state.lastRound ? ctx0.state.lastRound.manche : 0, roundMsg = null, roundT = null;

  function update(c) {
    ctx = c;
    const s = ctx.state;
    const hand = s.hands[ctx.me] || [];
    const k = hand.join(",");
    if (k !== handKey) {
      handKey = k; sel.clear();
      // les combinaisons en attente doivent toujours être dans la main
      const left = hand.slice();
      pending = pending.filter((g) => g.every((x) => { const i = left.indexOf(x); if (i < 0) return false; left.splice(i, 1); return true; }));
    }
    const lk = JSON.stringify(s.log);
    if (lk !== lastLog && s.log && lastLog) {
      if (s.log.t === "meld" || s.log.t === "add") ctx.sfx.ok(); else if (s.log.t === "swap") ctx.sfx.coin(); else ctx.sfx.card();
    }
    lastLog = lk;
    if (s.lastRound && s.lastRound.manche !== seenRound) {
      seenRound = s.lastRound.manche;
      const my = s.lastRound.got[ctx.me];
      roundMsg = `${nameOf(ctx, s.lastRound.winner)} remporte la manche ${s.lastRound.manche}` + (my != null ? ` · tu prends ${my} pts` : "");
      clearTimeout(roundT);
      roundT = setTimeout(() => { roundMsg = null; draw(); }, 4500);
    }
    draw();
  }

  function myCards() {
    const s = ctx.state;
    const hand = (s.hands[ctx.me] || []).slice();
    for (const g of pending) for (const x of g) hand.splice(hand.indexOf(x), 1);
    return hand;
  }

  function draw() {
    const s = ctx.state;
    const who = toAct(s);
    const mine = who.includes(ctx.me) && !!s.hands[ctx.me];
    const playing = mine && s.phase === "play";
    const opened = s.opened[ctx.me];
    const view = sortHand(myCards(), mode);
    const selCards = [...sel].map((i) => view[i] && view[i].c).filter(Boolean);

    const opps = h("div", { class: "g-rami-opps" }, s.order.filter((id) => id !== ctx.me).map((id) => h("div", { class: "g-rami-opp" + (who.includes(id) ? " turn" : "") },
      h("div", { class: "fan", html: Array.from({ length: Math.min(s.hands[id].length, 7) }, () => cardBackHTML(ctx.skin.deck, 22)).join("") }),
      h("div", { class: "small" }, h("b", null, nameOf(ctx, id)), ` · ${s.hands[id].length}`),
      h("div", { class: "tiny" }, s.opened[id] ? h("span", { class: "g-rami-tag" }, "Ouvert") : h("span", { class: "dim" }, "Pas ouvert"),
        s.target ? h("span", { class: "dim" }, ` · ${s.scores[id]} pts`) : null))));

    const melds = h("div", { class: "g-rami-melds" }, s.melds.length ? s.melds.map((m, i) => {
      const can = playing && opened && selCards.length && (
        (selCards.length === 1 && swapIndex(m, selCards[0]) >= 0) || extend(m, selCards));
      return h("button", { class: "g-rami-meld" + (can ? " ok" : "") + (m.o === ctx.me ? " mine" : ""), "aria-label": "Combinaison " + (i + 1),
        onclick: () => onMeld(i) },
        h("div", { class: "g-rami-mcards", html: m.c.map((c) => cHTML(c, { small: true })).join("") }),
        h("span", { class: "g-rami-mpts" }, meldPoints(m)));
    }) : h("div", { class: "dim small center g-rami-empty" }, s.open ? `Première pose : au moins ${s.open} points` : "Aucune combinaison posée"));

    const top = s.discard[s.discard.length - 1];
    const canDraw = mine && s.phase === "draw";
    const piles = h("div", { class: "pile-row g-rami-piles" },
      h("button", { class: "deck-btn", disabled: !canDraw, "aria-label": "Piocher dans la pioche", onclick: () => act({ type: "draw", from: "stock" }),
        html: cardBackHTML(ctx.skin.deck, 54) + `<span class="cnt">${s.stock.length}</span>` }),
      h("button", { class: "g-rami-disc" + (canDraw && top ? " ok" : ""), disabled: !canDraw || !top, "aria-label": "Prendre la défausse",
        onclick: () => act({ type: "draw", from: "discard" }), html: top ? cHTML(top) : `<div class="pcard slot"></div>` }),
      h("div", { class: "g-rami-info small" }, h("div", null, "Ta main"), h("b", null, `${handPts(s, ctx.me) || 0} pts`)));

    const msg = roundMsg || (s.log ? logText(s.log) : "");
    const pendPts = pending.reduce((t, g) => t + meldPoints(analyze(g)), 0);
    const pend = pending.length ? h("div", { class: "g-rami-pending" },
      h("div", { class: "small" }, `Prêt à poser : ${pendPts} pts`, s.open && !opened ? h("span", { class: "dim" }, ` / ${s.open}`) : null),
      h("div", { class: "g-rami-pgroups" }, pending.map((g) => h("div", { class: "g-rami-mcards", html: g.map((c) => cHTML(c, { small: true })).join("") }))),
      h("button", { class: "btn ghost small", onclick: () => { pending = []; ctx.sfx.tap(); draw(); } }, "Annuler")) : null;

    const selPts = selCards.length >= 3 && analyze(selCards) ? meldPoints(analyze(selCards)) : null;
    const bar = h("div", { class: "g-rami-bar" },
      h("button", { class: "btn small ghost", onclick: () => { mode = mode === "suit" ? "rank" : "suit"; sel.clear(); ctx.sfx.tap(); draw(); } },
        mode === "suit" ? "Tri : couleur" : "Tri : valeur"),
      h("button", { class: "btn small green", disabled: !playing || (!selCards.length && !pending.length), onclick: onPose },
        selPts != null ? `Poser (${selPts})` : "Poser"),
      h("button", { class: "btn small gold", disabled: !playing || selCards.length !== 1, onclick: () => act({ type: "discard", card: selCards[0] }) }, "Défausser"));

    const handEl = h("div", { class: "g-rami-hand" }, view.map((v, i) => h("button", {
      class: "g-rami-hc" + (sel.has(i) ? " sel" : ""), "aria-label": lab(v.c) + (sel.has(i) ? " (choisie)" : ""), "aria-pressed": sel.has(i) ? "true" : "false",
      onclick: () => { sel.has(i) ? sel.delete(i) : sel.add(i); ctx.sfx.tap(); draw(); }, html: cHTML(v.c) })));

    const tip = mine ? (s.phase === "draw" ? "À toi : pioche une carte (pioche ou défausse)"
      : !opened && s.open ? `Choisis tes cartes puis Poser (${s.open} pts pour ouvrir), ou défausse une carte`
        : "Pose, complète une combinaison ou défausse une carte") : null;
    el.replaceChildren(
      s.target ? h("div", { class: "small dim center" }, `Manche ${s.manche} · course à ${s.target} pts · toi : ${s.scores[ctx.me] ?? 0} pts`) : null,
      opps,
      h("div", { class: "felt g-rami-felt", style: feltStyle(ctx.skin.table) }, melds, piles, h("div", { class: "small center felt-msg" }, msg)),
      turnLine(ctx, who, tip),
      pend, bar, handEl,
      playing && opened && selCards.length ? h("p", { class: "tiny dim center" }, "Touche une combinaison pour y ajouter ta sélection ou récupérer son joker.") : null);
  }

  function act(a) { ctx.sfx.card(); ctx.act(a); }

  function onPose() {
    const s = ctx.state;
    const view = sortHand(myCards(), mode);
    const selCards = [...sel].map((i) => view[i].c);
    const groups = pending.slice();
    if (selCards.length) {
      if (!analyze(selCards)) { ctx.sfx.bad(); ctx.toast("Ce n'est pas une combinaison : 3 cartes au moins, une suite de même couleur ou des cartes de même valeur"); return; }
      groups.push(selCards);
    }
    const pts = groups.reduce((t, g) => t + meldPoints(analyze(g)), 0);
    if (!s.opened[ctx.me] && pts < s.open) {
      pending = groups; sel.clear(); ctx.sfx.tap();
      ctx.toast(`Encore ${s.open - pts} points pour ouvrir : ajoute une autre combinaison`);
      draw();
      return;
    }
    pending = []; sel.clear();
    ctx.act({ type: "meld", groups });
  }

  function onMeld(i) {
    const s = ctx.state;
    if (!toAct(s).includes(ctx.me) || s.phase !== "play") return;
    const view = sortHand(myCards(), mode);
    const selCards = [...sel].map((k) => view[k].c);
    if (!selCards.length) { ctx.toast("Choisis d'abord des cartes de ta main"); return; }
    if (!s.opened[ctx.me]) { ctx.toast("Fais d'abord ta première pose"); return; }
    const m = s.melds[i];
    if (selCards.length === 1 && swapIndex(m, selCards[0]) >= 0) { ctx.act({ type: "swap", meld: i, card: selCards[0] }); return; }
    if (!extend(m, selCards)) { ctx.sfx.bad(); ctx.toast("Ces cartes ne vont pas sur cette combinaison"); return; }
    ctx.act({ type: "add", meld: i, cards: selCards });
  }

  function logText(l) {
    const n = nameOf(ctx, l.id);
    if (l.t === "draw") return `${n} pioche`;
    if (l.t === "take") return `${n} prend ${lab(l.card)} sur la défausse`;
    if (l.t === "discard") return `${n} défausse ${lab(l.card)}`;
    if (l.t === "meld") return `${n} pose ${l.n > 1 ? l.n + " combinaisons" : "une combinaison"} (${l.pts} pts)`;
    if (l.t === "add") return `${n} complète une combinaison`;
    if (l.t === "swap") return `${n} récupère un joker avec ${lab(l.card)}`;
    return "";
  }

  update(ctx0);
  return { update, destroy() { clearTimeout(roundT); } };
}
