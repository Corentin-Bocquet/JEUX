import { h, sheet } from "../ui.js";
import { turnLine, nameOf } from "./common.js";
import { toAct, canPlay, colorOf, valOf, isWild, label, COLORS, COLOR_NAME, handPts } from "../games/derniere.js";

const P = "g-derniere-";
export const scoreOf = (s, id) => (s.target ? `${s.scores[id]} pts` : (s.hands[id] || []).length + " c.");
export const scoreLabel = (v) => (v < 0 ? `${-v} pts en main` : `${v} pts`);

const SYM = { D: "+2", I: "⇄", P: "⊘", W: "", W4: "+4" };
const symOf = (c) => { const v = valOf(c); return SYM[v] ?? v; };

// carte dessinée en CSS
export function cardHTML(c, { cls = "" } = {}) {
  const col = isWild(c) ? "W" : colorOf(c);
  const sy = symOf(c);
  const corner = c === "W" ? "★" : sy;
  const mid = isWild(c) ? `<span class="${P}quad"><i></i><i></i><i></i><i></i></span>${sy ? `<b class="${P}big">${sy}</b>` : ""}` : `<b class="${P}big">${sy}</b>`;
  return `<div class="${P}card ${P}c${col} ${cls}" aria-label="${label(c)}"><span class="${P}tl">${corner}</span><span class="${P}oval">${mid}</span><span class="${P}br">${corner}</span></div>`;
}
const backHTML = (cls = "") => `<div class="${P}card ${P}back ${cls}"><span class="${P}oval"><b>DC</b></span></div>`;

export function mount(root, ctx0) {
  const el = h("div", { class: "g-derniere" });
  root.append(el);
  let lastLog = "", seenRound = ctx0.state.lastRound ? ctx0.state.lastRound.manche : 0, banner = null, bannerT = null;

  function update(ctx) {
    const s = ctx.state;
    const who = toAct(s);
    const mine = who.includes(ctx.me);
    const hand = s.hands[ctx.me] || [];
    const top = s.discard[s.discard.length - 1];
    const key = JSON.stringify(s.log);
    if (key !== lastLog && s.log) {
      if (s.log.t === "play") ctx.sfx.card();
      if (s.log.penalty && s.log.id === ctx.me) { ctx.sfx.bad(); ctx.buzz(60); ctx.toast("Oubli de l'annonce : 2 cartes de pénalité !", "err"); }
      if (s.log.t === "last" && s.log.id !== ctx.me) ctx.toast(`${nameOf(ctx, s.log.id)} : « Dernière carte ! »`);
    }
    lastLog = key;
    if (s.lastRound && s.lastRound.manche !== seenRound) {
      seenRound = s.lastRound.manche;
      banner = `${nameOf(ctx, s.lastRound.winner)} remporte la manche ${s.lastRound.manche} et marque ${s.lastRound.gain} pts`;
      if (s.lastRound.winner === ctx.me) ctx.sfx.win();
      clearTimeout(bannerT);
      bannerT = setTimeout(() => { banner = null; update(ctx); }, 4500);
    }

    // adversaires
    const others = s.order.filter((id) => id !== ctx.me);
    const opps = h("div", { class: P + "opps" }, others.map((id) => {
      const n = s.hands[id].length;
      return h("div", { class: P + "opp" + (who.includes(id) ? " " + P + "turn" : "") },
        h("div", { class: P + "fan", html: Array.from({ length: Math.min(n, 6) }, () => backHTML(P + "mini")).join("") }),
        h("div", { class: P + "oname" }, nameOf(ctx, id)),
        h("div", { class: P + "ocount" + (n === 1 ? " " + P + "alert" : "") }, n === 1 ? "Dernière carte !" : `${n} cartes`));
    }));

    // table
    const dirTxt = s.dir === 1 ? "↻" : "↺";
    const canDraw = mine && !s.drawn;
    const table = h("div", { class: P + "table " + P + "t" + s.color },
      h("div", { class: P + "dir", "aria-label": s.dir === 1 ? "Sens horaire" : "Sens inverse" }, dirTxt),
      h("div", { class: P + "piles" },
        h("button", { class: P + "draw", disabled: !canDraw, "aria-label": s.pending ? `Encaisser ${s.pending} cartes` : "Piocher",
          onclick: () => { ctx.sfx.card(); ctx.act({ type: "draw" }); }, html: backHTML(canDraw ? P + "glow" : "") + `<span class="${P}cnt">${s.pile.length}</span>` }),
        h("div", { class: P + "top", html: cardHTML(top, { cls: P + "deal" }) }),
        h("div", { class: P + "color" }, h("span", { class: P + "dot " + P + "c" + s.color }), h("small", null, COLOR_NAME[s.color]))),
      s.pending ? h("div", { class: P + "pending" }, `+${s.pending} en attente !`) : null,
      h("div", { class: P + "msg" }, banner || (s.log ? logText(ctx, s.log) : "C'est parti !")));

    // annonce et actions
    const canCall = mine && hand.length === 2 && s.called !== ctx.me;
    const actions = h("div", { class: P + "actions" },
      canCall ? h("button", { class: "btn red " + P + "callbtn", onclick: () => { ctx.sfx.ok(); ctx.act({ type: "last" }); } }, "Dernière carte !") : null,
      mine && s.called === ctx.me ? h("span", { class: P + "called" }, "Annoncé ✓") : null,
      mine && s.drawn ? h("button", { class: "btn ghost small", onclick: () => ctx.act({ type: "pass" }) }, "Garder et passer") : null,
      mine && s.pending ? h("button", { class: "btn gold small", onclick: () => ctx.act({ type: "draw" }) }, `Encaisser +${s.pending}`) : null);

    const myHand = h("div", { class: P + "hand" + (hand.length > 9 ? " " + P + "tight" : "") }, hand.map((c) => {
      const ok = mine && canPlay(s, c);
      return h("button", { class: P + "hc" + (ok ? " " + P + "ok" : mine ? " " + P + "no" : ""), disabled: !ok, "aria-label": label(c),
        html: cardHTML(c), onclick: () => play(ctx, c) });
    }));

    let tip = "À toi : pose une carte ou pioche";
    if (s.pending) tip = `Renvoie un +2/+4 ou encaisse ${s.pending} cartes`;
    else if (s.drawn) tip = "Pose la carte piochée ou garde-la";
    else if (hand.length === 2 && s.called !== ctx.me) tip = "Deux cartes : annonce « Dernière carte ! » avant de jouer";
    const race = s.target ? h("div", { class: P + "race" }, `Manche ${s.manche} · course à ${s.target} pts · toi : ${s.scores[ctx.me] ?? 0} pts`) : null;
    el.replaceChildren(race, opps, table, turnLine(ctx, who, tip), actions, myHand,
      hand.length ? h("div", { class: P + "foot" }, `${hand.length} cartes · ${handPts(hand)} pts en main`) : null);
  }

  function play(ctx, c) {
    if (isWild(c)) {
      const sh = sheet(h("div", { class: P + "picker" }, COLORS.map((col) => h("button", { class: P + "pick " + P + "c" + col,
        onclick: () => { sh.close(); ctx.act({ type: "play", card: c, color: col }); } }, COLOR_NAME[col]))), { title: "Quelle couleur ?" });
      return;
    }
    ctx.act({ type: "play", card: c });
  }
  update(ctx0);
  return { update, destroy() { clearTimeout(bannerT); } };
}

function logText(ctx, l) {
  const n = nameOf(ctx, l.id);
  if (l.t === "last") return `${n} annonce : « Dernière carte ! »`;
  if (l.t === "draw") return l.n ? `${n} pioche ${l.n > 1 ? l.n + " cartes" : "une carte"}` : `${n} ne peut plus piocher`;
  if (l.t === "take") return `${n} encaisse ${l.n} cartes`;
  if (l.t === "pass") return `${n} garde sa carte`;
  let t = `${n} pose ${label(l.card)}`;
  if (isWild(l.card)) t += ` : ${COLOR_NAME[l.color].toLowerCase()}`;
  if (l.pending) t += ` (+${l.pending} en attente)`;
  else if (l.victim && l.n != null) t += ` · ${nameOf(ctx, l.victim)} pioche ${l.n}`;
  else if (l.victim) t += ` · ${nameOf(ctx, l.victim)} passe son tour`;
  if (l.penalty) t += ` · oubli de l'annonce : +${l.penalty} !`;
  return t;
}
