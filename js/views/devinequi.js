import { h } from "../ui.js";
import { nameOf } from "./common.js";
import { PERSOS, QUESTIONS, qById, toAct } from "../games/devinequi.js";

export const scoreOf = (s, id) => s.score[id];
export const scoreLabel = (sc) => `${sc} manche${sc > 1 ? "s" : ""}`;

const SKIN = ["#F8D5B8", "#E8B48F", "#C68A5E", "#8D5A3B"];
const HAIR = { noir: "#2B2B33", brun: "#6B4226", blond: "#E8C15A", roux: "#D2642A", blanc: "#E4E4EA", chauve: "#8A7A6A" };
const EYES = { marron: "#6B3E1E", bleus: "#2F80ED", verts: "#2FA557" };
const BG = ["#DBEAFE", "#FCE7F3", "#DCFCE7", "#FEF3C7", "#EDE9FE", "#FFE4E6", "#CFFAFE", "#FEF9C3"];

// avatar SVG dessiné à partir des attributs du personnage
export function faceSVG(i) {
  const p = PERSOS[i];
  const sk = SKIN[p.peau], hc = HAIR[p.h], ec = EYES[p.y];
  const bald = p.h === "chauve";
  const dark = "#2A2238";
  const parts = [];
  parts.push(`<rect width="100" height="100" fill="${BG[i % BG.length]}"/>`);
  if (p.l && !bald) parts.push(`<path d="M24 42 Q20 84 30 92 L70 92 Q80 84 76 42 Z" fill="${hc}"/>`);
  parts.push(`<path d="M14 100 Q14 79 50 77 Q86 79 86 100 Z" fill="${p.t}"/>`);
  parts.push(`<rect x="43" y="62" width="14" height="17" rx="5" fill="${sk}"/>`);
  parts.push(`<circle cx="28" cy="49" r="5.5" fill="${sk}"/><circle cx="72" cy="49" r="5.5" fill="${sk}"/>`);
  if (p.o) parts.push(`<circle cx="27.5" cy="57" r="2.8" fill="#F5B301" stroke="#B7791F" stroke-width=".8"/><circle cx="72.5" cy="57" r="2.8" fill="#F5B301" stroke="#B7791F" stroke-width=".8"/>`);
  parts.push(`<ellipse cx="50" cy="47" rx="22" ry="25" fill="${sk}"/>`);
  if (!bald) {
    parts.push(p.l
      ? `<path d="M27 50 Q24 18 50 18 Q76 18 73 50 Q70 32 56 28 Q50 34 38 31 Q30 36 27 50 Z" fill="${hc}"/>`
      : `<path d="M28 44 Q26 19 50 19 Q74 19 72 44 Q68 31 50 30 Q32 31 28 44 Z" fill="${hc}"/>`);
  } else parts.push(`<ellipse cx="42" cy="28" rx="7" ry="3" fill="#fff" opacity=".35"/>`);
  const brow = bald ? "#7A6A5A" : hc === HAIR.blanc ? "#B9B9C4" : hc;
  parts.push(`<path d="M36 39 Q41 36 46 39 M54 39 Q59 36 64 39" stroke="${brow}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`);
  parts.push(`<ellipse cx="41" cy="46" rx="4.6" ry="3.8" fill="#fff"/><ellipse cx="59" cy="46" rx="4.6" ry="3.8" fill="#fff"/>`);
  parts.push(`<circle cx="41" cy="46" r="2.6" fill="${ec}"/><circle cx="59" cy="46" r="2.6" fill="${ec}"/><circle cx="41" cy="46" r="1.1" fill="#111"/><circle cx="59" cy="46" r="1.1" fill="#111"/>`);
  parts.push(`<path d="M50 49 Q47 56 50 57" stroke="${dark}" stroke-opacity=".45" stroke-width="1.6" fill="none" stroke-linecap="round"/>`);
  const facial = bald ? "#5A4A3A" : hc === HAIR.blanc ? "#D2D2DA" : hc;
  if (p.b) parts.push(`<path d="M29 50 Q30 74 50 76 Q70 74 71 50 Q68 64 58 65 Q50 61 42 65 Q32 64 29 50 Z" fill="${facial}"/>`);
  parts.push(`<path d="M43 63 Q50 68 57 63" stroke="#9B2C2C" stroke-width="2" fill="none" stroke-linecap="round"/>`);
  if (p.m) parts.push(`<path d="M40 61 Q45 57 50 59.5 Q55 57 60 61 Q55 60.5 50 61.5 Q45 60.5 40 61 Z" fill="${facial}" stroke="${facial}" stroke-width="1.6" stroke-linejoin="round"/>`);
  if (p.g) parts.push(`<g fill="rgba(255,255,255,.18)" stroke="${dark}" stroke-width="2"><circle cx="41" cy="46" r="7"/><circle cx="59" cy="46" r="7"/></g><path d="M48 46 L52 46 M34 45 L29 43 M66 45 L71 43" stroke="${dark}" stroke-width="2"/>`);
  if (p.c) {
    const hat = ["#1F2937", "#7C2D12", "#1E3A8A", "#065F46"][i % 4];
    parts.push(`<ellipse cx="50" cy="25" rx="31" ry="6" fill="${hat}"/><path d="M33 25 Q33 6 50 6 Q67 6 67 25 Z" fill="${hat}"/><rect x="33" y="19" width="34" height="4.5" fill="#F43F5E"/>`);
  }
  return `<svg viewBox="0 0 100 100" aria-hidden="true">${parts.join("")}</svg>`;
}

const fmtQ = (e, pid, ctx) => {
  const who = e.by === ctx.me ? "Toi" : nameOf(ctx, e.by);
  if (e.q) return `${who} : ${qById(e.q)[1]} ${e.a ? "Oui" : "Non"}`;
  return `${who} : « C'est ${PERSOS[ctx.state.board[e.pos]].n} ? » ${e.a ? "Oui !" : "Non"}`;
};

export function mount(root, ctx0) {
  const el = h("div", { class: "g-devinequi" });
  root.append(el);
  let local = null, localKey = "", guessMode = false, lastLog = 0, game = 0;

  function update(ctx) {
    const s = ctx.state;
    if (s.game !== game) { game = s.game; lastLog = 0; guessMode = false; }
    if (s.log.length > lastLog) {
      const e = s.log[s.log.length - 1];
      if (s.phase === "end") (s.win && s.win.id === ctx.me ? ctx.sfx.win() : ctx.sfx.bad());
      else if (e.by === ctx.me) (e.a ? ctx.sfx.ok() : ctx.sfx.tap());
      else ctx.sfx.card();
      lastLog = s.log.length;
    }
    // planche locale pendant la phase « abats tes personnages »
    const key = s.game + "|" + s.log.length + "|" + s.phase;
    if (key !== localKey) { localKey = key; local = s.down[ctx.me] ? s.down[ctx.me].slice() : null; }
    draw(ctx);
  }

  function draw(ctx) {
    const s = ctx.state;
    const me = ctx.me;
    const spectator = !s.order.includes(me);
    const opp = s.order.find((id) => id !== me) || s.order[1];
    const myTurn = toAct(s).includes(me);
    const flipping = myTurn && s.phase === "flip";
    const asking = myTurn && s.phase === "ask";
    const down = local || s.down[me] || s.board.map(() => 0);
    const up = (id) => s.down[id].filter((x) => !x).length;

    const top = h("div", { class: "g-devinequi-top" },
      spectator ? null : h("div", { class: "g-devinequi-secret" },
        h("div", { class: "g-devinequi-mini", html: faceSVG(s.secret[me]) }),
        h("div", null, h("small", null, "Ton personnage"), h("b", null, PERSOS[s.secret[me]].n))),
      h("div", { class: "g-devinequi-vs" },
        h("small", null, s.wins > 1 ? `Manche ${s.game} · ${s.score[me] ?? 0} - ${s.score[opp]}` : `Manche ${s.game}`),
        h("span", null, `${nameOf(ctx, opp)} : `, h("b", null, up(opp)), " debout"),
        spectator ? null : h("span", null, "Toi : ", h("b", null, down.filter((x) => !x).length), " debout")));

    let msg;
    if (s.phase === "end") {
      const w = s.win.id === me;
      msg = h("div", { class: "turnmsg " + (w ? "me" : "") }, w ? (s.win.how === "trouvé" ? "Bien joué, tu as trouvé !" : "L'autre s'est trompé : manche pour toi !")
        : `${nameOf(ctx, s.win.id)} gagne la manche. C'était ${PERSOS[s.secret[s.win.id === s.order[0] ? s.order[1] : s.order[0]]].n}.`);
    } else if (flipping) {
      const last = s.log[s.log.length - 1];
      msg = h("div", { class: "turnmsg me" }, `Réponse : ${last.a ? "OUI" : "NON"}. Abats ceux qui ne collent pas, puis valide.`);
    } else if (asking) msg = h("div", { class: "turnmsg me" }, guessMode ? "Touche le personnage que tu veux proposer." : "À toi : pose une question ou tente ta chance !");
    else msg = h("div", { class: "turnmsg" }, `${nameOf(ctx, s.order[s.turn])} réfléchit…`);

    const cols = s.board.length <= 16 ? 4 : 6;
    const grid = h("div", { class: "g-devinequi-grid" + (guessMode && asking ? " guessing" : ""), style: `--cols:${cols}` },
      s.board.map((pi, pos) => {
        const isDown = !!down[pos];
        const isWin = s.phase === "end" && s.secret[opp] === pi;
        return h("button", { class: "g-devinequi-tile" + (isDown ? " down" : "") + (isWin ? " win" : ""), "aria-label": PERSOS[pi].n + (isDown ? " (abattu)" : ""),
          disabled: !(flipping || (asking && guessMode && !isDown)),
          onclick: () => {
            if (flipping) { local[pos] = local[pos] ? 0 : 1; ctx.sfx.card(); draw(ctx); }
            else if (asking && guessMode) { guessMode = false; ctx.sfx.tap(); ctx.act({ type: "guess", pos }); }
          } },
          h("span", { class: "g-devinequi-face", html: faceSVG(pi) }),
          h("span", { class: "g-devinequi-name" }, PERSOS[pi].n));
      }));

    let actions = null;
    if (s.phase === "end" && myTurn) actions = h("button", { class: "btn green block", onclick: () => ctx.act({ type: "next" }) }, "Manche suivante");
    else if (flipping) actions = h("button", { class: "btn green block", onclick: () => { ctx.sfx.ok(); ctx.act({ type: "done", down: local }); } }, "J'ai fini mon tour");
    else if (asking) {
      actions = h("div", { class: "g-devinequi-actions" },
        guessMode ? null : h("div", { class: "g-devinequi-qs" }, QUESTIONS.map(([id, label, emo]) =>
          h("button", { class: "g-devinequi-q", onclick: () => { ctx.sfx.tap(); ctx.act({ type: "ask", q: id }); } }, h("span", null, emo), label))),
        h("button", { class: "btn " + (guessMode ? "ghost" : "purple") + " block", onclick: () => { guessMode = !guessMode; ctx.sfx.tap(); draw(ctx); } },
          guessMode ? "Annuler" : "🎯 Je sais qui c'est !"));
    }
    const log = s.log.length ? h("div", { class: "g-devinequi-log" }, s.log.slice(-4).reverse().map((e) => h("div", { class: e.by === me ? "mine" : "" }, fmtQ(e, me, ctx)))) : null;
    el.replaceChildren(top, msg, flipping || s.phase === "end" ? actions : null, grid, flipping || s.phase === "end" ? null : actions, log);
  }

  update(ctx0);
  return { update, destroy() {} };
}
