import { h } from "../ui.js";
import { turnLine, nameOf } from "./common.js";
import { N, FLEET, toAct, randomFleet, validFleet, shipCells, sunkShips } from "../games/bataille.js";
import { rng, newSeed } from "../engine.js";

export const scoreOf = (s, id) => {
  const f = s.fleets[s.order.find((x) => x !== id)];
  return f ? sunkShips(s, id).length + "/5" : null;
};

export function mount(root, ctx0) {
  const el = h("div", { class: "g-bn" });
  root.append(el);
  let draft = randomFleet(rng(newSeed())), picked = null, lastShot = "";
  function update(ctx) {
    const s = ctx.state;
    const who = toAct(s);
    const mine = who.includes(ctx.me);
    const foe = s.order.find((x) => x !== ctx.me);
    if (s.last) {
      const k = JSON.stringify(s.last);
      if (k !== lastShot) { s.last.hit ? (s.last.sunk ? ctx.sfx.strike() : ctx.sfx.ok()) : ctx.sfx.tap(); if (s.last.hit && s.last.id !== ctx.me) ctx.buzz(60); }
      lastShot = k;
    }
    if (s.phase === "place") {
      if (s.fleets[ctx.me]) {
        el.replaceChildren(h("div", { class: "turnmsg" }, "Flotte en place. L'adversaire place la sienne…"), grid(s.fleets[ctx.me], {}, { small: false }));
        return;
      }
      const drawPlace = () => {
        const g = grid(validFleet(draft) || [], {}, {
          onCell: (c) => {
            const x = c % N, y = Math.floor(c / N);
            const hitShip = draft.findIndex((sh) => shipCells(sh.x, sh.y, sh.dir, sh.size)?.includes(c));
            if (picked == null) { if (hitShip >= 0) { picked = hitShip; ctx.sfx.tap(); } drawPlace(); return; }
            if (hitShip === picked) { // tourner
              const t = draft.slice(); t[picked] = { ...t[picked], dir: t[picked].dir === "h" ? "v" : "h" };
              if (validFleet(t)) { draft = t; ctx.sfx.tap(); } else ctx.toast("Pas la place pour le tourner ici", "err");
              picked = null; drawPlace(); return;
            }
            const t = draft.slice(); t[picked] = { ...t[picked], x, y };
            if (validFleet(t)) { draft = t; ctx.sfx.tap(); } else ctx.toast("Il ne rentre pas ici", "err");
            picked = null; drawPlace();
          }, picked: picked != null ? shipCells(draft[picked].x, draft[picked].y, draft[picked].dir, draft[picked].size) : null,
        });
        el.replaceChildren(
          h("div", { class: "turnmsg me" }, "Place ta flotte"),
          h("p", { class: "small dim center" }, picked == null ? "Touche un navire pour le choisir." : "Touche une case pour l'y déplacer, ou le navire pour le tourner."),
          g,
          h("div", { class: "row gap center", style: { marginTop: "12px" } },
            h("button", { class: "btn ghost", onclick: () => { draft = randomFleet(rng(newSeed())); picked = null; ctx.sfx.dice(); drawPlace(); } }, "Au hasard"),
            h("button", { class: "btn green", onclick: () => ctx.act({ type: "place", ships: draft }) }, "Prêt !")));
      };
      drawPlace();
      return;
    }
    const myShots = s.shots[ctx.me] || {};
    const theirShots = s.shots[foe] || {};
    const sunkMine = sunkShips(s, ctx.me);
    const target = grid([], myShots, { onCell: mine ? (c) => { if (!myShots[c]) ctx.act({ type: "shoot", cell: c }); } : null, sunk: sunkMine, last: s.last && s.last.id === ctx.me ? s.last.cell : null, enemy: true });
    const own = grid(s.fleets[ctx.me] || [], theirShots, { small: true, last: s.last && s.last.id === foe ? s.last.cell : null });
    const info = s.last ? `${nameOf(ctx, s.last.id)} tire : ${s.last.sunk ? s.last.sunk + " coulé !" : s.last.hit ? "touché !" : "à l'eau."}` : "";
    el.replaceChildren(
      turnLine(ctx, who, "À toi de tirer !"),
      h("div", { class: "small center bn-info" + (s.last && s.last.hit ? " hit" : "") }, info),
      h("div", { class: "bn-label small dim" }, `Flotte de ${nameOf(ctx, foe)} · ${sunkMine.length}/5 coulés`),
      target,
      h("div", { class: "bn-label small dim" }, "Ta flotte"),
      own);
  }
  update(ctx0);
  return { update };
}

function grid(fleet, shots, { onCell, small, sunk, last, picked, enemy } = {}) {
  const shipAt = {};
  fleet.forEach((sh, k) => sh.cells.forEach((c, j) => (shipAt[c] = { k, first: j === 0, last: j === sh.cells.length - 1, dir: sh.dir })));
  const sunkCells = new Set((sunk || []).flatMap((x) => x.cells));
  const g = h("div", { class: "bn-grid" + (small ? " small" : "") + (enemy ? " enemy" : ""), role: "grid" });
  for (let c = 0; c < N * N; c++) {
    const sh = shipAt[c], shot = shots[c];
    const cls = ["bn-cell"];
    if (sh) cls.push("ship", sh.dir, sh.first ? "s0" : "", sh.last ? "s1" : "");
    if (shot) cls.push(shot);
    if (sunkCells.has(c)) cls.push("sunk");
    if (c === last) cls.push("last");
    if (picked && picked.includes(c)) cls.push("picked");
    const label = `${"ABCDEFGHIJ"[c % N]}${Math.floor(c / N) + 1}`;
    g.append(onCell ? h("button", { class: cls.join(" "), "aria-label": label, disabled: enemy && !!shot, onclick: () => onCell(c) }) : h("span", { class: cls.join(" ") }));
  }
  return g;
}
export { FLEET };
