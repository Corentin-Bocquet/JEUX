import { h } from "../ui.js";
import { turnLine, nameOf } from "./common.js";
import { toAct, heads, rowHeads, HAND } from "../games/taureaux.js";

const P = "g-taureaux-";
export const scoreOf = (s, id) => `${s.score[id]} 🐂`;
export const scoreLabel = (v) => `${v} têtes`;

export function cardHTML(n, cls = "") {
  const k = heads(n);
  return `<div class="${P}card ${P}h${k} ${cls}" aria-label="Carte ${n}, ${k} tête${k > 1 ? "s" : ""}"><span class="${P}hd">${"<i></i>".repeat(k)}</span><span class="${P}num">${n}</span><span class="${P}k">${k}</span></div>`;
}

export function mount(root, ctx0) {
  const el = h("div", { class: "g-taureaux" });
  root.append(el);
  let sel = null, lastReveal = "", lastRound = ctx0.state.lastRound ? ctx0.state.lastRound.manche : 0, banner = null, bannerT = null;

  function update(ctx) {
    const s = ctx.state;
    const who = toAct(s);
    const mine = who.includes(ctx.me);
    const hand = s.hands[ctx.me] || [];
    if (sel != null && !hand.includes(sel)) sel = null;
    const rk = s.reveal ? JSON.stringify([s.reveal.manche, s.reveal.turn, s.reveal.log.length]) : "";
    if (rk !== lastReveal && s.reveal && lastReveal) {
      const mineTook = s.reveal.log.find((x) => x.id === ctx.me && x.took);
      if (mineTook) { ctx.sfx.bad(); ctx.buzz(50); } else ctx.sfx.card();
    }
    lastReveal = rk;
    if (s.lastRound && s.lastRound.manche !== lastRound) {
      lastRound = s.lastRound.manche;
      banner = `Fin de la manche ${s.lastRound.manche} : tu as pris ${s.lastRound.taken[ctx.me] ?? 0} têtes`;
      clearTimeout(bannerT);
      bannerT = setTimeout(() => { banner = null; update(ctx); }, 4500);
    }
    const picking = s.picker === ctx.me;
    const pending = s.picker && s.queue.length ? s.queue[0].card : null;

    // joueurs : qui a choisi
    const players = h("div", { class: P + "players" }, s.order.map((id) => {
      const done = s.chosen[id] != null;
      const st = s.picker ? (s.picker === id ? "choisit une rangée" : "") : done ? "a choisi ✓" : "réfléchit…";
      return h("div", { class: P + "pl" + (id === ctx.me ? " " + P + "me" : "") + (who.includes(id) ? " " + P + "wait" : "") + (done ? " " + P + "done" : "") },
        h("b", null, id === ctx.me ? "Toi" : nameOf(ctx, id)), h("span", { class: P + "sc" }, `${s.score[id]} 🐂`), h("small", null, st));
    }));

    // rangées
    const rows = h("div", { class: P + "rows" }, s.rows.map((row, i) => {
      const slots = [];
      for (let k = 0; k <= s.rowMax; k++) {
        if (k < row.length) slots.push(`<span class="${P}slot">${cardHTML(row[k], k === row.length - 1 ? P + "end" : "")}</span>`);
        else slots.push(`<span class="${P}slot ${P}empty${k === s.rowMax ? " " + P + "danger" : ""}">${k === s.rowMax ? "☠" : ""}</span>`);
      }
      const full = row.length >= s.rowMax;
      return h(picking ? "button" : "div", { class: P + "row" + (full ? " " + P + "full" : "") + (picking ? " " + P + "pickable" : ""),
        onclick: picking ? () => { ctx.sfx.tap(); ctx.act({ type: "pick", row: i }); } : null, "aria-label": `Rangée ${i + 1}, ${rowHeads(row)} têtes` },
        h("div", { class: P + "slots", html: slots.join("") }),
        h("div", { class: P + "rh" }, h("b", null, String(rowHeads(row))), h("small", null, "🐂")));
    }));

    // révélation du dernier tour
    let reveal = null;
    if (s.reveal) {
      const took = s.reveal.log.filter((x) => x.took);
      reveal = h("div", { class: P + "reveal" },
        h("div", { class: P + "rcards", html: s.reveal.cards.map(([id, c]) => `<span class="${P}rv${id === ctx.me ? " " + P + "mine" : ""}">${cardHTML(c, P + "sm")}<small>${id === ctx.me ? "Toi" : esc(nameOf(ctx, id))}</small></span>`).join("") }),
        h("div", { class: P + "rlog" }, took.length ? took.map((x) => `${x.id === ctx.me ? "Tu ramasses" : nameOf(ctx, x.id) + " ramasse"} ${x.took} têtes`).join(" · ") : "Personne ne ramasse !"));
    }

    // ma main
    const chosen = s.chosen[ctx.me];
    const myHand = h("div", { class: P + "hand" }, hand.map((c) => h("button", {
      class: P + "hc" + (sel === c ? " " + P + "sel" : ""), disabled: !mine || picking || !!s.picker, "aria-label": `Carte ${c}`,
      html: cardHTML(c), onclick: () => { sel = sel === c ? null : c; ctx.sfx.tap(); update(ctx); } })));
    const confirm = mine && !s.picker && sel != null
      ? h("button", { class: "btn green " + P + "go", onclick: () => { ctx.sfx.card(); ctx.act({ type: "choose", card: sel }); sel = null; } }, `Poser le ${sel}`) : null;
    const waiting = chosen != null ? h("div", { class: P + "chosen", html: `${cardHTML(chosen)}<span>Ta carte est posée face cachée. On attend les autres…</span>` }) : null;

    let tip = sel != null ? "Valide ta carte" : "Choisis ta carte en secret";
    if (picking) tip = `Ton ${pending} est trop petit : touche la rangée à ramasser`;
    const msg = banner || (s.picker && !picking ? `${nameOf(ctx, s.picker)} doit ramasser une rangée (carte ${pending})` : "");
    el.replaceChildren(
      h("div", { class: P + "top" }, h("span", null, `Manche ${s.manche} · tour ${Math.min(s.turn, HAND)}/${HAND}`), h("span", null, s.target ? `Limite : ${s.target} têtes` : "Une manche")),
      players, rows,
      msg ? h("div", { class: P + "msg" }, msg) : reveal,
      turnLine(ctx, picking ? [ctx.me] : who, tip),
      waiting, confirm ? h("div", { class: P + "act" }, confirm) : null, myHand);
  }
  update(ctx0);
  return { update, destroy() { clearTimeout(bannerT); } };
}

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
