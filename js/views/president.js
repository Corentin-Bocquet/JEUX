import { h } from "../ui.js";
import { cardHTML, cardBackHTML, feltStyle, nameOf } from "./common.js";
import { toAct, canPlay, top, ROLE_NAME, roleAt } from "../games/president.js";
import { rankOf, label } from "../games/cards.js";
import { fanStyle, flyFrom } from "../games/lib/president_fx.js";

const ROLE_EMO = { pres: "👑", vice: "🎩", neutre: "🙂", vperd: "😬", perd: "🧹" };
const COMBO = ["", "Simple", "Paire", "Brelan", "Carré"];
const RNAME = { J: "Valet", Q: "Dame", K: "Roi", A: "As" };
const rname = (c) => RNAME[rankOf(c)] || rankOf(c);
const comboText = (cards) => cards.length === 1 ? `${rname(cards[0])}` : `${COMBO[cards.length]} de ${rname(cards[0])}`;

export const scoreOf = (s, id) => `${s.scores[id]} pts`;
export const scoreLabel = (v) => `${v} pts`;

const ROLE_SHORT = { pres: "Président", vice: "Vice-prés.", neutre: "Neutre", vperd: "Vice-perd.", perd: "Perdant" };
function roleBadge(role, big) {
  if (!role) return null;
  return h("span", { class: `g-president-role g-president-r-${role}${big ? " big" : ""}`, title: ROLE_NAME[role] }, ROLE_EMO[role], " ", big ? ROLE_NAME[role] : ROLE_SHORT[role]);
}

export function mount(root, ctx0) {
  const el = h("div", { class: "g-president" });
  root.append(el);
  let sel = [], selKey = "", lastSeq = -1, banner = null, bannerT = null, seenManche = ctx0.state.lastManche ? ctx0.state.lastManche.manche : 0;
  let ctxNow = ctx0;

  function toggle(ctx, c) {
    const s = ctx.state;
    ctx.sfx.tap();
    if (s.phase === "give") {
      const g = s.give[ctx.me];
      if (sel.includes(c)) sel = sel.filter((x) => x !== c);
      else if (sel.length < g.n) sel = [...sel, c];
      else sel = [...sel.slice(1), c];
      return update(ctx);
    }
    const hand = s.hands[ctx.me];
    const t = top(s);
    if (sel.includes(c)) { sel = sel.filter((x) => x !== c); return update(ctx); }
    const same = hand.filter((x) => rankOf(x) === rankOf(c));
    if (t) {
      // on complète d'office le nombre de cartes demandé
      const need = t.cards.length;
      sel = [c, ...same.filter((x) => x !== c)].slice(0, need);
    } else if (sel.length && rankOf(sel[0]) === rankOf(c)) sel = [...sel, c];
    else sel = same.length > 1 && !sel.length ? same.slice() : [c];
    update(ctx);
  }

  function update(ctx) {
    ctxNow = ctx;
    const s = ctx.state;
    const who = toAct(s);
    const mine = who.includes(ctx.me);
    const hand = s.hands[ctx.me] || [];
    const key = (s.manche || 0) + ":" + s.phase + ":" + hand.join(",");
    if (key !== selKey) { sel = sel.filter((c) => hand.includes(c)); selKey = key; }
    const fresh = s.seq !== lastSeq;
    const prevSeq = lastSeq;
    lastSeq = s.seq;

    // fin de manche : bandeau des nouveaux rôles
    if (s.lastManche && s.lastManche.manche !== seenManche) {
      seenManche = s.lastManche.manche;
      const n = s.order.length;
      banner = { title: `Fin de la manche ${s.lastManche.manche}`, rows: s.lastManche.out.map((id, pos) => ({ id, role: roleAt(pos, n), pts: n - 1 - pos })) };
      clearTimeout(bannerT);
      bannerT = setTimeout(() => { banner = null; update(ctxNow); }, 5200);
      if (s.lastManche.out[0] === ctx.me) ctx.sfx.win(); else ctx.sfx.coin();
    }

    const t = top(s);
    // ---- adversaires
    const others = s.order.filter((id) => id !== ctx.me);
    const seats = h("div", { class: "g-president-seats" + (others.length > 4 ? " many" : "") }, others.map((id) => {
      const n = s.hands[id].length;
      const pos = s.out.indexOf(id);
      const passed = s.phase === "play" && s.passed.includes(id) && n > 0;
      return h("div", { class: "g-president-seat" + (who.includes(id) ? " turn" : "") + (pos >= 0 ? " done" : ""), "data-id": id },
        h("div", { class: "g-president-backs", html: n ? Array.from({ length: Math.min(n, 4) }, () => cardBackHTML(ctx.skin.deck, 22)).join("") : "" },
          n ? h("b", { class: "g-president-count" }, n) : h("span", { class: "g-president-rank" }, pos + 1, pos === 0 ? "er" : "e")),
        h("div", { class: "g-president-name" }, nameOf(ctx, id)),
        roleBadge(s.roles[id]),
        passed ? h("span", { class: "g-president-bubble" }, "Passe") : null);
    }));

    // ---- centre : le pli
    let center;
    if (s.phase === "give") {
      center = h("div", { class: "g-president-swap" }, h("div", { class: "g-president-swapicon" }, "🔄"), h("div", { class: "g-president-big" }, "Échange de cartes"),
        h("div", { class: "small" }, Object.entries(s.give).map(([id, g]) =>
          h("div", null, `${nameOf(ctx, g.to)} ➜ ${nameOf(ctx, id)} : ${g.n} carte${g.n > 1 ? "s" : ""}`, g.done ? " ✔️" : " …"))));
    } else {
      const plays = s.plays.slice(-4);
      const stack = h("div", { class: "g-president-stack" }, plays.map((p, k) => {
        const lastOne = k === plays.length - 1;
        return h("div", { class: "g-president-play" + (lastOne ? " last" : ""), "data-by": p.id, style: { "--k": plays.length - 1 - k },
          html: p.cards.map((c) => cardHTML(c)).join("") });
      }));
      let caption;
      if (t) caption = h("div", { class: "g-president-cap" }, h("b", null, t.id === ctx.me ? "Toi" : nameOf(ctx, t.id)), " : ", comboText(t.cards),
        h("div", { class: "small g-president-dim" }, `À battre : ${COMBO[t.cards.length].toLowerCase()} de ${rname(t.cards[0])} ou plus fort`));
      else if (s.last && s.log && (s.log.t === "close" || s.log.t === "magic")) {
        caption = h("div", { class: "g-president-cap" }, s.log.t === "magic" ? h("div", { class: "g-president-magic" }, "✨ Carré magique ! ✨") : null,
          `${nameOf(ctx, s.log.id)} remporte le pli`, h("div", { class: "small g-president-dim" }, `${s.log.lead === ctx.me ? "Tu ouvres" : nameOf(ctx, s.log.lead) + " ouvre"} le pli suivant`));
      } else caption = h("div", { class: "g-president-cap" }, s.log && s.log.t === "deal" && s.log.card ? `${nameOf(ctx, s.log.id)} a le ${label(s.log.card)} et ouvre` : `${nameOf(ctx, s.order[s.cur])} ouvre le pli`);
      const ghost = !t && s.last ? h("div", { class: "g-president-stack ghost", html: `<div class="g-president-play last">${s.last.cards.map((c) => cardHTML(c)).join("")}</div>` }) : null;
      center = h("div", { class: "g-president-center" }, t ? stack : ghost || h("div", { class: "g-president-empty" }, "Pli vide"), caption);
    }
    const info = h("div", { class: "g-president-info" }, h("span", null, `Manche ${Math.min(s.manche, s.rounds)} / ${s.rounds}`),
      h("span", null, s.two ? "2 = plus fort" : "As = plus fort"), s.magic ? h("span", null, "✨ Carré magique") : null);
    const felt = h("div", { class: "felt g-president-felt", style: feltStyle(ctx.skin.table) }, info, center,
      banner ? h("div", { class: "g-president-banner" }, h("div", { class: "g-president-big" }, banner.title),
        banner.rows.map((r) => h("div", { class: "g-president-brow" + (r.id === ctx.me ? " me" : "") }, h("span", null, ROLE_EMO[r.role], " ", r.id === ctx.me ? "Toi" : nameOf(ctx, r.id)),
          h("span", { class: "g-president-dim" }, ROLE_NAME[r.role]), h("b", null, `+${r.pts}`)))) : null);

    // ---- consigne
    let msg, cls = "turnmsg";
    const g = s.phase === "give" ? s.give[ctx.me] : null;
    if (s.over) msg = "Partie terminée";
    else if (g && !g.done) { msg = `Choisis ${g.n} carte${g.n > 1 ? "s" : ""} à donner à ${nameOf(ctx, g.to)}`; cls += " me"; }
    else if (s.phase === "give") msg = "Les autres choisissent leurs cartes à rendre…";
    else if (mine) { msg = t ? `À toi : ${COMBO[t.cards.length].toLowerCase()} de ${rname(t.cards[0])} ou plus, sinon passe` : "À toi d'ouvrir : pose ce que tu veux"; cls += " me"; }
    else if (!hand.length) msg = `Tu as fini ${s.out.indexOf(ctx.me) + 1}${s.out.indexOf(ctx.me) === 0 ? "er" : "e"} : regarde les autres batailler`;
    else msg = `${nameOf(ctx, who[0])} réfléchit…`;

    // ---- ma main
    const playable = (c) => {
      if (!mine || s.phase !== "play") return mine && s.phase === "give";
      const same = hand.filter((x) => rankOf(x) === rankOf(c));
      return t ? same.length >= t.cards.length && canPlay(s, same.slice(0, t.cards.length)) : true;
    };
    const fan = h("div", { class: "g-president-hand", style: { "--n": hand.length } }, hand.map((c, i) => {
      const ok = playable(c);
      return h("button", { class: "g-president-hc" + (sel.includes(c) ? " sel" : ""), style: fanStyle(i, hand.length, { lift: sel.includes(c) ? 22 : 0 }),
        disabled: !ok, "aria-label": label(c), html: cardHTML(c, { dim: mine && !ok }), onclick: () => toggle(ctx, c) });
    }));
    const myRole = s.roles[ctx.me];
    const gotLine = g && g.got ? h("div", { class: "g-president-got" }, "Reçu de ", nameOf(ctx, g.to), " : ", h("span", { html: g.got.map((c) => cardHTML(c, { small: true })).join("") })) : null;
    const perdGave = s.phase === "give" && Object.values(s.give).find((x) => x.to === ctx.me);
    let actions = null;
    if (g && !g.done) {
      actions = h("div", { class: "g-president-actions" }, h("button", { class: "btn gold", disabled: sel.length !== g.n,
        onclick: () => { ctx.sfx.card(); const c = sel; sel = []; ctx.act({ type: "give", cards: c }); } }, `Donner ${sel.length}/${g.n}`));
    } else if (mine && s.phase === "play") {
      const ok = sel.length && canPlay(s, sel);
      actions = h("div", { class: "g-president-actions" },
        t ? h("button", { class: "btn ghost", onclick: () => { sel = []; ctx.sfx.tap(); ctx.act({ type: "pass" }); } }, "Passer") : null,
        h("button", { class: "btn green", disabled: !ok, onclick: () => { ctx.sfx.card(); const c = sel; sel = []; ctx.act({ type: "play", cards: c }); } },
          ok ? `Jouer : ${comboText(sel)}` : sel.length ? "Combinaison impossible" : "Choisis tes cartes"));
    }
    el.replaceChildren(seats, felt, h("div", { class: cls }, msg),
      perdGave ? h("div", { class: "g-president-got" }, `Tu as donné tes ${perdGave.n} meilleure${perdGave.n > 1 ? "s" : ""} carte${perdGave.n > 1 ? "s" : ""} à ${nameOf(ctx, Object.keys(s.give).find((k) => s.give[k] === perdGave))}`) : null,
      gotLine,
      h("div", { class: "g-president-me" }, roleBadge(myRole, true), h("span", { class: "small dim" }, `${hand.length} carte${hand.length > 1 ? "s" : ""}`)),
      fan, actions);

    // ---- animations : les cartes posées arrivent depuis le joueur
    if (fresh && prevSeq >= 0 && s.log && (s.log.t === "play" || s.log.t === "magic")) {
      ctx.sfx.card();
      const last = el.querySelector(".g-president-play.last");
      const from = s.log.id === ctx.me ? fan : el.querySelector(`.g-president-seat[data-id="${s.log.id}"]`);
      if (last) last.querySelectorAll(".pcard").forEach((c, k) => flyFrom(c, from, { delay: k * 50 }));
    }
    if (fresh && prevSeq >= 0 && s.log && s.log.t === "magic") { ctx.sfx.coin(); ctx.buzz(30); }
  }
  update(ctx0);
  return { update, destroy() { clearTimeout(bannerT); } };
}
