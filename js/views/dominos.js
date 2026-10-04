import { h } from "../ui.js";
import { nameOf } from "./common.js";
import { toAct, movesFor, ends, canDraw, handPips, isDouble } from "../games/dominos.js";

export const scoreOf = (s, id) => (s.target > 0 ? s.score[id] : s.hands[id] ? s.hands[id].length : null);
export const scoreLabel = (sc) => `${sc} pts`;

// positions des points sur une grille 3 x 3 (comme un dé), 0 = vide
const PIPS = { 0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const half = (v) => h("span", { class: `g-dominos-half v${v}` }, Array.from({ length: 9 }, (_, i) => h("i", { class: PIPS[v].includes(i) ? "on" : null })));

// domino : vertical = la première valeur en haut
function tileEl(a, b, { vertical, cls = "", onclick, label } = {}) {
  return h(onclick ? "button" : "span", { class: `g-dominos-tile ${vertical ? "ver" : "hor"} ${cls}`, onclick, "aria-label": label || `Domino ${a}-${b}` },
    half(a), h("b", { class: "g-dominos-bar" }), half(b));
}

// découpe la chaîne en rangées en serpentin qui tiennent dans la largeur
function snake(chain, cap) {
  const rows = [];
  let row = [], used = 0;
  chain.forEach((t, i) => {
    const w = isDouble(t) ? 1 : 2;
    if (used + w > cap && row.length) { rows.push(row); row = []; used = 0; }
    row.push(i); used += w;
  });
  if (row.length) rows.push(row);
  return rows;
}

export function mount(root, ctx0) {
  const el = h("div", { class: "g-dominos" });
  root.append(el);
  let sel = -1, lastKey = "", dealSeen = 0, cur = ctx0;
  const onResize = () => draw(cur);
  window.addEventListener("resize", onResize);

  function update(ctx) {
    cur = ctx;
    const s = ctx.state;
    const k = JSON.stringify(s.last) + s.deal;
    if (k !== lastKey) {
      if (s.last && s.last.t) ctx.sfx.card();
      else if (s.last && s.last.draw && s.last.id === ctx.me) ctx.sfx.tap();
      lastKey = k; sel = -1;
    }
    if (s.deal !== dealSeen) { dealSeen = s.deal; sel = -1; }
    draw(ctx);
  }

  function play(ctx, i, side) {
    ctx.sfx.tap();
    sel = -1;
    ctx.act({ type: "play", i, side });
  }

  function draw(ctx) {
    const s = ctx.state;
    const who = toAct(s);
    const mine = who.includes(ctx.me) && !s.end;
    const hand = s.hands[ctx.me] || [];
    const moves = mine ? movesFor(s, hand) : [];
    const e = ends(s);
    const playable = new Set(moves.map((m) => m.i));
    if (sel >= 0 && !playable.has(sel)) sel = -1;
    const selSides = sel >= 0 ? (e ? ["L", "R"].filter((side) => hand[sel].includes(side === "L" ? e[0] : e[1])) : ["L"]) : [];

    // ---------- en-tête : adversaires
    const others = s.order.filter((id) => id !== ctx.me);
    const opp = h("div", { class: "g-dominos-opps" }, others.map((id) => {
      const n = (s.hands[id] || []).length;
      const turn = who.includes(id) && !s.end;
      return h("div", { class: "g-dominos-opp" + (turn ? " turn" : "") },
        h("div", { class: "g-dominos-oname" }, nameOf(ctx, id)),
        s.end || s.over
          ? h("div", { class: "g-dominos-reveal" }, s.hands[id].map((t) => tileEl(t[0], t[1], { vertical: true, cls: "mini" })))
          : h("div", { class: "g-dominos-backs" }, Array.from({ length: Math.min(n, 9) }, () => h("i")), n > 9 ? h("small", null, "+" + (n - 9)) : null),
        h("div", { class: "g-dominos-ocount small" }, `${n} domino${n > 1 ? "s" : ""}`, s.target > 0 ? h("b", null, ` · ${s.score[id]} pts`) : null));
    }));

    // ---------- message de tour
    let msg, msgMe = false;
    if (s.end) {
      const w = s.end.winner;
      const txt = w ? (w === ctx.me ? "Tu gagnes la manche !" : `${nameOf(ctx, w)} gagne la manche !`) : "Manche bloquée : égalité";
      msg = s.end.blocked && w ? `Plus personne ne peut jouer. ${txt}` : txt;
      msgMe = w === ctx.me;
    } else if (mine) {
      msgMe = true;
      if (moves.length) msg = sel >= 0 && selSides.length > 1 ? "Choisis le bout où le poser" : !s.chain.length ? "À toi de commencer : pose un domino" : "À toi : touche un domino qui brille";
      else msg = canDraw(s) ? "Aucun domino ne va : pioche" : "Aucun domino ne va : passe ton tour";
    } else {
      const last = s.last && s.last.id !== ctx.me && s.last.pass ? `${nameOf(ctx, s.last.id)} passe. ` : "";
      msg = `${last}${nameOf(ctx, who[0])} réfléchit…`;
    }
    const head = h("div", { class: "turnmsg" + (msgMe ? " me" : "") }, msg);
    const info = h("div", { class: "g-dominos-info small" },
      s.draw === "pioche" ? h("span", { class: "chip small" }, `🁢 Pioche : ${s.stock.length}`) : h("span", { class: "chip small" }, "🚧 Sans pioche"),
      s.target > 0 ? h("span", { class: "chip small" }, `Manche ${s.deal} · objectif ${s.target}`) : null,
      e ? h("span", { class: "chip small" }, `Bouts : ${e[0]} et ${e[1]}`) : null);

    // ---------- chaîne en serpentin
    const width = Math.max(260, Math.min(el.clientWidth || 360, 760) - 20);
    const maxH = Math.max(200, Math.min(380, (window.innerHeight || 800) * 0.4));
    let u = 13, rows = [];
    for (const cand of [30, 26, 23, 20, 17, 15, 13, 11]) {
      const cap = Math.floor((width + 2) / (cand + 2));
      rows = snake(s.chain, cap);
      if (rows.length * (2 * cand + 8) <= maxH || cand === 11) { u = cand; break; }
    }
    const lastIdx = s.last && s.last.t ? (s.last.side === "L" ? 0 : s.chain.length - 1) : -1;
    const endTarget = (side) => selSides.includes(side) ? () => play(ctx, sel, side) : null;
    const chainBox = h("div", { class: "g-dominos-chain", style: `--u:${u}px;min-height:${Math.max(2 * u + 12, 90)}px` },
      !s.chain.length
        ? (sel >= 0 && mine
          ? h("button", { class: "g-dominos-start", onclick: () => play(ctx, sel, "L") }, "Poser ici")
          : h("div", { class: "g-dominos-empty dim" }, "La table est vide"))
        : rows.map((r, ri) => h("div", { class: "g-dominos-row" + (ri % 2 ? " rev" : "") }, r.map((i) => {
          const [a, b] = s.chain[i];
          const dbl = a === b;
          const isL = i === 0, isR = i === s.chain.length - 1;
          const tgt = (isL && endTarget("L")) || (isR && endTarget("R"));
          const flip = ri % 2 === 1 && !dbl;
          return tileEl(flip ? b : a, flip ? a : b, { vertical: dbl,
            cls: (i === lastIdx ? "pop" : "") + (tgt ? " target" : ""),
            onclick: tgt || undefined, label: tgt ? `Poser au bout ${isL ? "gauche" : "droit"}` : undefined });
        }))));

    // ---------- choix du bout
    const sideBtns = mine && sel >= 0 && selSides.length > 1 && e
      ? h("div", { class: "row gap g-dominos-sides" },
        h("button", { class: "btn small grow", onclick: () => play(ctx, sel, "L") }, `◀ Bout ${e[0]}`),
        h("button", { class: "btn small grow", onclick: () => play(ctx, sel, "R") }, `Bout ${e[1]} ▶`))
      : null;

    // ---------- ma main
    const myHand = h("div", { class: "g-dominos-hand" + (mine ? " mine" : "") }, hand.map((t, i) => {
      const ok = playable.has(i);
      return tileEl(t[0], t[1], { vertical: true, cls: (ok ? "ok" : mine ? "no" : "") + (i === sel ? " sel" : ""),
        label: `Domino ${t[0]}-${t[1]}${ok ? ", jouable" : ""}`,
        onclick: () => {
          if (!mine) { ctx.toast("Attends ton tour", "err"); return; }
          if (!ok) { ctx.sfx.bad(); ctx.toast("Ce domino ne va sur aucun bout", "err"); return; }
          const sides = e ? ["L", "R"].filter((side) => t.includes(side === "L" ? e[0] : e[1])) : ["L"];
          if (sides.length === 1 || (e && e[0] === e[1])) { play(ctx, i, sides[0]); return; }
          ctx.sfx.tap();
          sel = sel === i ? -1 : i;
          draw(ctx);
        } });
    }));
    const handHead = h("div", { class: "row between small g-dominos-hhead" },
      h("span", null, h("b", null, "Ta main"), ` · ${hand.length} domino${hand.length > 1 ? "s" : ""} · ${handPips(hand)} points`),
      s.target > 0 ? h("span", null, "Score ", h("b", null, s.score[ctx.me] ?? 0)) : null);

    let actions = null;
    if (mine && !moves.length) {
      actions = canDraw(s)
        ? h("button", { class: "btn gold block", onclick: () => { ctx.sfx.tap(); ctx.act({ type: "draw" }); } }, "Piocher un domino")
        : h("button", { class: "btn purple block", onclick: () => { ctx.sfx.tap(); ctx.act({ type: "pass" }); } }, "Passer mon tour");
    }

    // ---------- fin de manche
    let endBox = null;
    if (s.end) {
      const rows2 = s.order.map((id) => h("div", { class: "row between g-dominos-endrow" + (id === s.end.winner ? " win" : "") },
        h("span", null, id === s.end.winner ? "🏆 " : "", nameOf(ctx, id)),
        h("span", { class: "dim" }, `${s.end.rest[id]} en main`),
        s.target > 0 ? h("b", null, `${s.score[id]} pts`) : null));
      const nxt = !s.over && who.length
        ? (who[0] === ctx.me
          ? h("button", { class: "btn green block", onclick: () => { ctx.sfx.tap(); ctx.act({ type: "next" }); } }, "Manche suivante")
          : h("p", { class: "small dim center" }, `${nameOf(ctx, who[0])} lance la manche suivante…`))
        : null;
      endBox = h("div", { class: "card g-dominos-end" },
        s.target > 0 && s.end.winner ? h("div", { class: "center lead" }, `+${s.end.gain} points pour ${s.end.winner === ctx.me ? "toi" : nameOf(ctx, s.end.winner)}`) : null,
        rows2, nxt);
    }

    el.replaceChildren(opp, head, info, chainBox, sideBtns, endBox, handHead, myHand, actions);
  }

  update(ctx0);
  return { update, destroy() { window.removeEventListener("resize", onResize); } };
}
