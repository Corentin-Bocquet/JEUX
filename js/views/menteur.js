import { h } from "../ui.js";
import { cardHTML, cardBackHTML, feltStyle, nameOf } from "./common.js";
import { toAct, allowed, valName } from "../games/menteur.js";
import { label, rankOf } from "../games/cards.js";
import { fanStyle, flyFrom, flyCard } from "../games/lib/president_fx.js";

export const scoreOf = (s, id) => `${s.hands[id].length} c.`;
export const scoreLabel = (v) => (v ? `${v} carte${v > 1 ? "s" : ""}` : "Main vide");

const ROT = [-8, 5, -3, 9, -6, 2, 7, -10];

export function mount(root, ctx0) {
  const el = h("div", { class: "g-menteur" });
  root.append(el);
  let sel = [], val = null, lastSeq = ctx0.state.seq, passT = null, passKey = "", ctxNow = ctx0;

  function update(ctx) {
    ctxNow = ctx;
    const s = ctx.state;
    const who = toAct(s);
    const fresh = s.seq !== lastSeq;
    lastSeq = s.seq;
    const hand = s.hands[ctx.me] || [];
    sel = sel.filter((c) => hand.includes(c));
    const myTurn = s.phase === "play" && who.includes(ctx.me);
    const doubtMe = s.phase === "doubt" && s.call.pending.includes(ctx.me);
    const ok = s.phase === "play" ? allowed(s) : [];
    if (!ok.includes(val)) val = ok.length === 1 ? ok[0] : null;
    if (myTurn && ok.length > 1 && !val) {
      // proposition : la valeur dont j'ai le plus
      val = ok.slice().sort((a, b) => hand.filter((c) => rankOf(c) === b).length - hand.filter((c) => rankOf(c) === a).length)[0];
    }
    const pileN = s.pile.reduce((t, p) => t + p.cards.length, 0);

    // ---- adversaires
    const others = s.order.filter((id) => id !== ctx.me);
    const seats = h("div", { class: "g-menteur-seats" }, others.map((id) => {
      const n = s.hands[id].length;
      let tag = null;
      if (s.phase === "doubt") {
        if (s.call.id === id) tag = h("span", { class: "g-menteur-tag pose" }, "a posé");
        else if (s.call.passed.includes(id)) tag = h("span", { class: "g-menteur-tag ok" }, "✓ le croit");
        else tag = h("span", { class: "g-menteur-tag wait" }, "hésite…");
      } else if (s.reveal && s.reveal.caller === id && s.log && s.log.t === "call") tag = h("span", { class: "g-menteur-tag call" }, "Menteur !");
      return h("div", { class: "g-menteur-seat" + (s.phase === "play" && who.includes(id) ? " turn" : "") + (s.phase === "doubt" && s.call.id === id ? " poser" : ""), "data-id": id },
        h("div", { class: "g-menteur-backs", html: Array.from({ length: Math.min(n, 4) }, () => cardBackHTML(ctx.skin.deck, 22)).join("") },
          h("b", { class: "g-menteur-count" }, n)),
        h("div", { class: "g-menteur-name" }, nameOf(ctx, id)), tag);
    }));

    // ---- centre : tas, annonce, verdict
    const pile = h("div", { class: "g-menteur-pile" + (fresh && s.log && s.log.t === "call" ? " shake" : ""),
      html: (pileN ? Array.from({ length: Math.min(pileN, 8) }, (_, i) => `<div class="g-menteur-pc" style="--r:${ROT[i]}deg;--i:${i}">${cardBackHTML(ctx.skin.deck, 54)}</div>`).join("")
        : `<div class="g-menteur-pempty">Tas vide</div>`) },
      pileN ? h("b", { class: "g-menteur-pilen" }, pileN) : null);
    let announce = null;
    if (s.phase === "doubt") {
      const c = s.call;
      const total = s.window * 1000;
      const left = Math.max(0, c.until - Date.now());
      announce = h("div", { class: "g-menteur-ann" },
        h("div", { class: "g-menteur-annbig" }, h("span", { class: "g-menteur-who" }, c.id === ctx.me ? "Toi" : nameOf(ctx, c.id)), " : ",
          h("b", null, `${c.n} × ${valName(c.v, c.n)}`)),
        s.hands[c.id].length === 0 ? h("div", { class: "g-menteur-alert" }, "Sa dernière pose ! Si personne n'accuse, il gagne") : null,
        h("div", { class: "g-menteur-bar" }, h("i", { style: { animationDuration: total + "ms", animationDelay: -(total - left) + "ms" } })));
    } else if (s.reveal && s.log && s.log.t === "call") {
      const r = s.reveal;
      announce = h("div", { class: "g-menteur-ann" },
        h("div", { class: "g-menteur-reveal", html: r.cards.map((c, i) => `<div class="g-menteur-flip" style="--i:${i}">${cardHTML(c)}</div>`).join("") }),
        h("div", { class: "g-menteur-verdict " + (r.lied ? "lie" : "true") }, r.lied ? "🤥 Mensonge !" : "😇 C'était vrai !"),
        h("div", { class: "small" }, `${r.taker === ctx.me ? "Tu ramasses" : nameOf(ctx, r.taker) + " ramasse"} ${r.n} carte${r.n > 1 ? "s" : ""}`),
        r.quads && r.quads.length ? h("div", { class: "small" }, `Carré défaussé : ${r.quads.map((v) => valName(v, 2)).join(", ")}`) : null);
    } else if (s.log && s.log.t === "trust") {
      announce = h("div", { class: "g-menteur-ann" }, h("div", { class: "small g-menteur-soft" }, `Personne n'a accusé ${nameOf(ctx, s.log.id)} (${s.log.n} × ${valName(s.log.v, s.log.n)})`));
    }
    const nextTxt = s.phase === "play" ? (ok.length > 1 ? (s.last < 0 ? "Annonce libre" : `Au choix : ${ok.map((v) => valName(v)).join(", ")}`) : `Annonce attendue : ${valName(ok[0], 2)}`) : null;
    const info = h("div", { class: "g-menteur-info" }, h("span", null, `${s.deck} cartes`), h("span", null, `⏳ ${s.window} s pour accuser`),
      s.gone && s.gone.length ? h("span", null, `Carrés sortis : ${s.gone.map((v) => valName(v)).join(", ")}`) : null);
    const felt = h("div", { class: "felt g-menteur-felt", style: feltStyle(ctx.skin.table) }, info, pile, announce,
      nextTxt ? h("div", { class: "g-menteur-next" }, nextTxt) : null);

    // ---- consigne et actions
    let msg, cls = "turnmsg";
    if (s.winner) msg = s.winner === ctx.me ? "Tu as tout posé !" : `${nameOf(ctx, s.winner)} a tout posé !`;
    else if (doubtMe) { msg = "Tu le crois ? Accuse vite ou laisse passer"; cls += " me"; }
    else if (s.phase === "doubt") msg = s.call.id === ctx.me ? "Les autres réfléchissent… croisons les doigts" : "Attente des autres joueurs…";
    else if (myTurn) { msg = sel.length ? "Annonce et pose tes cartes" : "À toi : choisis 1 à 4 cartes"; cls += " me"; }
    else msg = `${nameOf(ctx, who[0])} choisit ses cartes…`;

    let actions = null;
    if (doubtMe) {
      actions = h("div", { class: "g-menteur-actions" },
        h("button", { class: "btn ghost", onclick: () => { ctx.sfx.tap(); ctx.act({ type: "pass" }); } }, "Je te crois"),
        h("button", { class: "btn red g-menteur-liar", onclick: () => { ctx.sfx.bad(); ctx.buzz(40); ctx.act({ type: "call" }); } }, "🤥 Menteur !"));
    } else if (myTurn) {
      actions = h("div", { class: "g-menteur-actions col" },
        ok.length > 1 ? h("div", { class: "g-menteur-vals" }, ok.map((v) => h("button", { class: "chip g-menteur-val" + (v === val ? " on" : ""),
          onclick: () => { val = v; ctx.sfx.tap(); update(ctxNow); } }, valName(v)))) : null,
        h("button", { class: "btn green", disabled: !sel.length || !val, onclick: () => {
          ctx.sfx.card(); const cards = sel; sel = []; ctx.act({ type: "play", cards, val });
        } }, sel.length ? `Poser ${sel.length} × ${valName(val, sel.length)}` : "Choisis tes cartes"));
    }

    const truthy = val && myTurn;
    const fan = h("div", { class: "g-menteur-hand" }, hand.map((c, i) => h("button", {
      class: "g-menteur-hc" + (sel.includes(c) ? " sel" : "") + (truthy && rankOf(c) === val ? " match" : ""),
      style: fanStyle(i, hand.length, { lift: sel.includes(c) ? 22 : 0, max: 34 }), disabled: !myTurn, "aria-label": label(c), html: cardHTML(c),
      onclick: () => {
        ctx.sfx.tap();
        if (sel.includes(c)) sel = sel.filter((x) => x !== c);
        else if (sel.length < 4) sel = [...sel, c];
        update(ctxNow);
      } })));
    el.replaceChildren(seats, felt, h("div", { class: cls }, msg), actions,
      h("div", { class: "g-menteur-mine small dim" }, `Ta main : ${hand.length} carte${hand.length > 1 ? "s" : ""}`), fan);

    // ---- animations
    if (fresh && s.log && s.log.t === "play") {
      ctx.sfx.card();
      const from = s.log.id === ctx.me ? fan : el.querySelector(`.g-menteur-seat[data-id="${s.log.id}"]`);
      const cards = [...el.querySelectorAll(".g-menteur-pc")].slice(-s.log.n);
      cards.forEach((c, k) => flyFrom(c, from, { delay: k * 70 }));
    }
    if (fresh && s.log && s.log.t === "call" && s.reveal) {
      const r = s.reveal;
      if (r.lied) ctx.sfx.ok(); else ctx.sfx.bad();
      const to = r.taker === ctx.me ? fan : el.querySelector(`.g-menteur-seat[data-id="${r.taker}"]`);
      const k = Math.min(r.n, 4);
      for (let i = 0; i < k; i++) setTimeout(() => flyCard(cardBackHTML(ctx.skin.deck, 48), pile, to, { cls: "g-menteur-fly", dur: 650 }), 900 + i * 90);
    }
    // fenêtre écoulée : on laisse passer automatiquement
    const key = doubtMe ? `${s.seq}:${s.call.id}:${s.call.until}` : "";
    if (key !== passKey) {
      clearTimeout(passT);
      passKey = key;
      if (doubtMe) {
        const until = s.call.until;
        passT = setTimeout(() => {
          const st = ctxNow.state;
          if (st.phase === "doubt" && st.call.until === until && st.call.pending.includes(ctxNow.me)) ctxNow.act({ type: "pass" });
        }, Math.max(300, until - Date.now()));
      }
    }
  }
  update(ctx0);
  return { update, destroy() { clearTimeout(passT); } };
}
