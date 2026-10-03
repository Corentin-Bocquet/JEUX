import { h } from "../ui.js";
import { dieHTML, turnLine, nameOf } from "./common.js";
import { CAT_HELP, scoreFor, totals, toAct, catsOf, maxRolls, bonusOf } from "../games/yams.js";

export const scoreOf = (s, id) => totals(s.sheets[id], bonusOf(s)).total;

export function mount(root, ctx0) {
  const el = h("div", { class: "g-yams" });
  root.append(el);
  let held = [false, false, false, false, false], lastKey = "", rolling = false, viewId = null;
  function update(ctx) {
    const s = ctx.state;
    const who = toAct(s);
    const cur = s.order[s.cur];
    const mine = who.includes(ctx.me);
    const key = `${s.cur}:${s.rolls}:${s.dice.join("")}:${s.turnNo}`;
    if (key !== lastKey) {
      if (s.rolls > 0 && lastKey) { rolling = true; ctx.sfx.dice(); setTimeout(() => { rolling = false; draw(); }, 450); }
      held = s.rolls === 0 ? [false, false, false, false, false] : s.held.slice();
      lastKey = key;
    }
    if (!viewId || !s.sheets[viewId]) viewId = ctx.me in s.sheets ? ctx.me : s.order[0];
    const MR = maxRolls(s), BONUS = bonusOf(s), CATS = catsOf(s);
    function draw() {
      const dice = h("div", { class: "dice-row" }, s.dice.map((d, i) => {
        const b = h("button", { class: "die-btn", disabled: !mine || s.rolls === 0 || s.rolls >= MR, "aria-pressed": held[i] ? "true" : "false",
          onclick: () => { held[i] = !held[i]; ctx.sfx.tap(); draw(); }, html: s.rolls ? dieHTML(d, { held: held[i], rolling }) : dieHTML(d, { rolling }) });
        if (!s.rolls) b.classList.add("ghost");
        return b;
      }));
      const rollBtn = h("button", { class: "btn green", disabled: !mine || s.rolls >= MR, onclick: () => ctx.act({ type: "roll", held }) },
        s.rolls === 0 ? "Lancer les dés" : `Relancer (${MR - s.rolls})`);
      const sheetOf = s.sheets[viewId];
      const canPick = mine && s.rolls > 0 && viewId === ctx.me;
      const T = totals(sheetOf, BONUS);
      const rows = [];
      CATS.forEach((c, k) => {
        if (k === 6 && CATS[0].up && BONUS > 0) rows.push(h("div", { class: "yrow sub" }, h("span", null, `Bonus (63+ : +${BONUS})`), h("b", null, T.up >= 63 ? "+" + BONUS : `${T.up}/63`)));
        const v = sheetOf[c.id];
        const preview = canPick && v == null ? scoreFor(c.id, s.dice) : null;
        rows.push(h("button", { class: "yrow" + (v != null ? " done" : "") + (preview != null ? " pick" : "") + (preview === 0 ? " zero" : ""), disabled: preview == null,
          onclick: () => { ctx.sfx.ok(); ctx.act({ type: "score", cat: c.id }); }, title: CAT_HELP[c.id] },
          h("span", null, c.name, h("small", null, CAT_HELP[c.id])), h("b", null, v != null ? v : preview != null ? preview : "")));
      });
      rows.push(h("div", { class: "yrow total" }, h("span", null, "Total"), h("b", null, T.total)));
      el.replaceChildren(
        turnLine(ctx, who, s.rolls === 0 ? "À toi : lance les dés" : s.rolls < MR ? "Garde des dés et relance, ou choisis une case" : "Choisis une case"),
        h("div", { class: "felt-mini" }, dice, h("div", { class: "row center gap", style: { marginTop: "10px" } }, mine ? rollBtn : h("span", { class: "dim small" }, `Tour de ${nameOf(ctx, cur)} · lancer ${s.rolls}/${MR}`))),
        s.last ? h("div", { class: "small dim center", style: { margin: "6px 0" } }, `${nameOf(ctx, s.last.id)} marque ${s.last.pts} en ${CATS.find((c) => c.id === s.last.cat).name}`) : null,
        s.order.length > 1 ? h("div", { class: "cats" }, s.order.map((id) => h("button", { class: "chip" + (id === viewId ? " on" : ""), onclick: () => { viewId = id; draw(); } }, nameOf(ctx, id), " ", h("b", null, totals(s.sheets[id], BONUS).total)))) : null,
        h("div", { class: "ysheet glass" }, rows),
        h("div", { class: "small dim center", style: { marginTop: "6px" } }, `Tour ${Math.min(s.turnNo + 1, CATS.length)} / ${CATS.length}`));
    }
    draw();
  }
  update(ctx0);
  return { update };
}
