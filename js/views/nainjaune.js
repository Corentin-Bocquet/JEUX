import { h } from "../ui.js";
import { cardHTML, turnLine, nameOf } from "./common.js";
import { toAct, canPlay, BOXES, RANK_WORD, boxOf } from "../games/nainjaune.js";
import { label } from "../games/cards.js";

const P = "g-nainjaune-";
export const scoreOf = (s, id) => `${s.chips[id]} 🪙`;
export const scoreLabel = (v) => `${v} jetons`;

// position des cases autour du nain jaune (central)
const POS = ["n", "e", "s", "w", "c"];

function chipsHTML(n) {
  const k = Math.min(n, 8);
  return Array.from({ length: k }, (_, i) => `<i style="--i:${i}"></i>`).join("");
}

export function mount(root, ctx0) {
  const el = h("div", { class: "g-nainjaune" });
  root.append(el);
  let lastLog = "", seenRound = ctx0.state.lastRound ? ctx0.state.lastRound.manche : 0, banner = null, bannerT = null, flash = -1, flashT = null;

  function update(ctx) {
    const s = ctx.state;
    const who = toAct(s);
    const mine = who.includes(ctx.me);
    const hand = s.hands[ctx.me] || [];
    const key = JSON.stringify(s.log);
    if (key !== lastLog && s.log && lastLog) {
      if (s.log.t === "play") ctx.sfx.card();
      if (s.log.box != null && s.log.won) {
        ctx.sfx.coin();
        flash = s.log.box; clearTimeout(flashT); flashT = setTimeout(() => { flash = -1; update(ctx); }, 1400);
      }
    }
    lastLog = key;
    if (s.lastRound && s.lastRound.manche !== seenRound) {
      seenRound = s.lastRound.manche;
      const lr = s.lastRound;
      const d = lr.delta[ctx.me];
      banner = `${nameOf(ctx, lr.winner)} vide sa main et gagne la manche ${lr.manche}` + (lr.opera ? ` · GRAND OPÉRA : +${lr.opera} jetons !` : "") +
        (d != null && lr.winner !== ctx.me ? ` · toi : ${d} jetons` : "");
      if (lr.winner === ctx.me) ctx.sfx.win();
      clearTimeout(bannerT);
      bannerT = setTimeout(() => { banner = null; update(ctx); }, 5000);
    }

    // plateau rond doré
    const board = h("div", { class: P + "board", role: "group", "aria-label": "Plateau du nain jaune" },
      h("div", { class: P + "ring", html: `<svg viewBox="0 0 200 200" aria-hidden="true"><defs><radialGradient id="njg" cx="40%" cy="35%"><stop offset="0" stop-color="#FFF3B0"/><stop offset=".55" stop-color="#E7B416"/><stop offset="1" stop-color="#9A6A00"/></radialGradient></defs>
        <circle cx="100" cy="100" r="97" fill="url(#njg)" stroke="#7A5200" stroke-width="3"/><circle cx="100" cy="100" r="88" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="1.5" stroke-dasharray="3 4"/>
        <path d="M100 12 L100 188 M12 100 L188 100" stroke="rgba(122,82,0,.35)" stroke-width="2"/><circle cx="100" cy="100" r="40" fill="#FFD84A" stroke="#7A5200" stroke-width="2.5"/></svg>` }),
      BOXES.map((b, i) => h("div", { class: P + "box " + P + POS[i] + (flash === i ? " " + P + "flash" : "") + (s.board[i] ? "" : " " + P + "empty") },
        h("div", { class: P + "bcard", html: cardHTML(b.card, { small: true }) }),
        h("div", { class: P + "bname" }, ["Dix", "Valet", "Dame", "Roi", "Nain jaune"][i]),
        h("div", { class: P + "stack", html: chipsHTML(s.board[i]) }),
        h("div", { class: P + "bval" }, String(s.board[i])))));

    // suite en cours
    const need = s.need ? `On attend : ${unRank(s.need)}` : "Départ libre : n'importe quelle carte";
    const run = h("div", { class: P + "run" },
      h("div", { class: P + "runcards", html: s.run.slice(-7).map((c, i, a) => `<span class="${P}rc${i === a.length - 1 ? " " + P + "new" : ""}">${cardHTML(c, { small: true })}</span>`).join("") || `<span class="${P}hint">Aucune carte posée</span>` }),
      h("div", { class: P + "need" + (s.need ? "" : " " + P + "free") }, need));

    // adversaires
    const opps = h("div", { class: P + "opps" }, s.order.filter((id) => id !== ctx.me).map((id) => h("div", { class: P + "opp" + (who.includes(id) ? " " + P + "turn" : "") },
      h("b", null, nameOf(ctx, id)), h("span", null, `🂠 ${s.hands[id].length}`), h("span", { class: P + "chips" }, `🪙 ${s.chips[id]}`))));

    const myHand = h("div", { class: "hand " + P + "hand" }, hand.map((c) => {
      const ok = mine && canPlay(s, c);
      return h("button", { class: "hcard" + (boxOf(c) >= 0 ? " " + P + "belle" : ""), disabled: !ok, "aria-label": label(c),
        html: cardHTML(c, { playable: ok, dim: mine && !ok }), onclick: () => { ctx.act({ type: "play", card: c }); } });
    }));

    const msg = banner || (s.log ? logText(ctx, s.log) : "");
    el.replaceChildren(
      h("div", { class: P + "top" }, h("span", null, `Manche ${s.manche} / ${s.manches}`), h("span", null, `Tes jetons : `, h("b", null, String(s.chips[ctx.me] ?? "-")))),
      opps, board, run,
      h("div", { class: P + "msg" + (banner ? " " + P + "banner" : "") }, msg),
      turnLine(ctx, who, s.need ? `À toi : pose ${unRank(s.need)}` : "À toi : pose la carte de ton choix"),
      myHand);
  }
  update(ctx0);
  return { update, destroy() { clearTimeout(bannerT); clearTimeout(flashT); } };
}

const unRank = (r) => (r === 12 ? "une " : "un ") + RANK_WORD[r];

function logText(ctx, l) {
  const n = nameOf(ctx, l.id);
  if (l.t === "opera") return `${n} a les cinq cartes du plateau : grand opéra, +${l.won} jetons !`;
  let t = `${n} pose ${label(l.card)}`;
  if (l.won) t += ` et rafle ${l.won} jetons`;
  if (l.sans) t += ` · ${l.sans} joueur${l.sans > 1 ? "s" : ""} « sans »`;
  if (l.stop) t += ` · personne n'a de ${RANK_WORD[l.stop]}, ${n} repart`;
  return t;
}
