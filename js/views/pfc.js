import { h } from "../ui.js";
import { nameOf } from "./common.js";
import { toAct, SIGNS, VERBS, signsOf, matchOf, beats } from "../games/pfc.js";

export const scoreOf = (s, id) => (s.format === "points" ? s.won[id] : s.passed ? s.passed[id] : null);
export const scoreLabel = (sc) => `${sc} ${sc > 1 ? "victoires" : "victoire"}`;

const stageName = (n) => (n <= 2 ? "Finale" : n <= 4 ? "Demi-finales" : "Quarts de finale");
const em = (k) => (SIGNS[k] ? SIGNS[k].emoji : "❔");
const nm = (k) => (SIGNS[k] ? SIGNS[k].name : "?");
// phrase d'explication : « La pierre casse les ciseaux »
function phrase(w, l) {
  const v = VERBS[w + l];
  if (!v) return "";
  const art = { R: "La pierre", P: "La feuille", S: "Les ciseaux", L: "Le lézard", K: "Spock" }[w];
  const obj = { R: "la pierre", P: "la feuille", S: "les ciseaux", L: "le lézard", K: "Spock" }[l];
  return `${art} ${v} ${obj}`;
}

export function mount(root, ctx0) {
  const el = h("div", { class: "g-pfc" });
  const main = h("div");
  const ov = h("div", { class: "g-pfc-ov", hidden: true });
  el.append(main, ov);
  root.append(el);
  let seen = ctx0.state.rev || 0, anim = null, timers = [], cur = ctx0;

  function relevant(s, rv, me) {
    if (rv.p[me]) return true;
    // spectateur (éliminé ou qualifié d'office) : il regarde les autres duels
    return s.format !== "points" && matchOf(s, me) < 0;
  }

  function update(ctx) {
    cur = ctx;
    const s = ctx.state;
    if ((s.rev || 0) > seen) {
      const news = s.reveals.filter((rv) => rv.r > seen && relevant(s, rv, ctx.me));
      seen = s.rev;
      if (news.length) startAnim(ctx, news[news.length - 1]);
    }
    draw(ctx);
  }

  function startAnim(ctx, rv) {
    timers.forEach(clearTimeout); timers = [];
    anim = { rv, phase: 3 };
    ctx.sfx.tap();
    const step = (ph, ms) => timers.push(setTimeout(() => {
      anim.phase = ph;
      if (ph > 0) cur.sfx.tap();
      else {
        const me = cur.me;
        if (rv.p[me]) { if (rv.w.includes(me)) cur.sfx.ok(); else if (rv.w.length) cur.sfx.bad(); else cur.sfx.card(); }
        else cur.sfx.card();
      }
      drawOv(cur);
    }, ms));
    step(2, 520); step(1, 1040); step(0, 1560);
    timers.push(setTimeout(() => { anim = null; drawOv(cur); draw(cur); }, 3600));
    drawOv(ctx);
  }

  function drawOv(ctx) {
    if (!anim) { ov.hidden = true; ov.replaceChildren(); return; }
    const s = ctx.state, rv = anim.rv, me = ctx.me;
    ov.hidden = false;
    const ids = Object.keys(rv.p);
    const reveal = anim.phase === 0;
    if (rv.m >= 0 || ids.length === 2) {
      // duel : moi à gauche si je joue
      const [a, b] = ids.includes(me) ? [me, ids.find((x) => x !== me)] : ids;
      const side = (id, right) => h("div", { class: "g-pfc-side" + (reveal && rv.w.includes(id) ? " win" : reveal && rv.w.length ? " lose" : "") },
        h("div", { class: "g-pfc-big" + (reveal ? " shown" : " shake") + (right ? " flip" : "") }, reveal ? em(rv.p[id]) : "✊"),
        h("div", { class: "g-pfc-who" }, id === me ? "Toi" : nameOf(ctx, id)),
        reveal ? h("div", { class: "small dim" }, nm(rv.p[id])) : null);
      let cap = null;
      if (reveal) {
        const w = rv.w[0];
        const l = w && ids.find((x) => x !== w);
        let res;
        if (!w) res = "Égalité, on rejoue !";
        else if (rv.p[me]) res = w === me ? "Manche gagnée !" : "Manche perdue…";
        else res = `${nameOf(ctx, w)} gagne la manche`;
        if (rv.end && rv.p[me]) res = rv.end === me ? "Duel gagné !" : "Duel perdu, tu es éliminé";
        else if (rv.end) res = `${nameOf(ctx, rv.end)} remporte le duel`;
        cap = h("div", { class: "g-pfc-cap" },
          w ? h("div", { class: "small" }, phrase(rv.p[w], rv.p[l])) : null,
          h("div", { class: "g-pfc-res " + (!w ? "tie" : rv.p[me] ? (w === me ? "good" : "bad") : "") }, res),
          rv.sc ? h("div", { class: "small dim" }, `${rv.sc[a]} - ${rv.sc[b]}`) : null);
      }
      ov.replaceChildren(h("div", { class: "g-pfc-duel" },
        side(a, false),
        h("div", { class: "g-pfc-count" + (reveal ? " vs" : "") }, reveal ? "VS" : String(anim.phase)),
        side(b, true)), cap);
    } else {
      // mêlée : tout le monde révèle
      const grid = h("div", { class: "g-pfc-grid" }, s.ids.filter((id) => rv.p[id]).map((id) => h("div", { class: "g-pfc-cell" + (reveal && rv.w.includes(id) ? " win" : "") + (id === me ? " me" : "") },
        h("div", { class: "g-pfc-mid" + (reveal ? " shown" : " shake") }, reveal ? em(rv.p[id]) : "✊"),
        h("div", { class: "g-pfc-who small" }, id === me ? "Toi" : nameOf(ctx, id)),
        reveal ? h("div", { class: "small" }, `+${rv.pts[id]}`) : null)));
      let res = null;
      if (reveal) {
        const txt = !rv.w.length ? "Personne ne gagne la manche" : rv.w.includes(me) ? (rv.w.length > 1 ? "Tu gagnes la manche (ex æquo) !" : "Tu gagnes la manche !") : rv.w.length === 1 ? `${nameOf(ctx, rv.w[0])} gagne la manche` : `${rv.w.map((id) => nameOf(ctx, id)).join(", ")} gagnent la manche`;
        res = h("div", { class: "g-pfc-res " + (rv.w.includes(me) ? "good" : rv.w.length ? "bad" : "tie") }, txt);
      }
      ov.replaceChildren(reveal ? null : h("div", { class: "g-pfc-count solo" }, String(anim.phase)), grid, res);
    }
  }

  function draw(ctx) {
    const s = ctx.state, me = ctx.me;
    const who = toAct(s);
    const myTurn = who.includes(me);
    const signs = signsOf(s);
    const locked = !!anim;
    const myPick = s.picks[me];
    let head, arena, status;

    if (s.format === "points") {
      head = h("div", { class: "g-pfc-head small" }, h("span", { class: "chip small" }, `Mêlée · manche ${s.manche}`), h("span", { class: "chip small" }, `${s.wins} manche${s.wins > 1 ? "s" : ""} pour gagner`));
      arena = h("div", { class: "g-pfc-table" }, s.ids.map((id) => h("div", { class: "g-pfc-seat" + (id === me ? " me" : "") + (s.picks[id] ? " done" : "") },
        h("div", { class: "g-pfc-hand" }, s.picks[id] ? (id === me ? em(s.picks[id]) : "✔️") : "🤔"),
        h("div", { class: "g-pfc-who small" }, id === me ? "Toi" : nameOf(ctx, id)),
        h("div", { class: "g-pfc-stars" }, Array.from({ length: Math.max(s.wins, s.won[id]) }, (_, i) => h("i", { class: i < s.won[id] ? "on" : null }))))));
    } else {
      const n = s.alive.length;
      const multi = s.ids.length > 2;
      head = h("div", { class: "g-pfc-head small" },
        multi ? h("span", { class: "chip small" }, `Tournoi · ${s.over ? "terminé" : stageName(n)}`) : h("span", { class: "chip small" }, "Duel"),
        h("span", { class: "chip small" }, s.wins === 1 ? "Mort subite" : `${s.wins} manches gagnantes`));
      const k = matchOf(s, me);
      if (k >= 0) {
        const m = s.matches[k];
        const op = m.a === me ? m.b : m.a;
        const myS = m.a === me ? m.sa : m.sb, opS = m.a === me ? m.sb : m.sa;
        const dots = (v) => h("div", { class: "g-pfc-stars" }, Array.from({ length: s.wins }, (_, i) => h("i", { class: i < v ? "on" : null })));
        arena = h("div", { class: "g-pfc-vs" },
          h("div", { class: "g-pfc-seat me" + (myPick ? " done" : "") }, h("div", { class: "g-pfc-hand" }, myPick ? em(myPick) : "🤔"), h("div", { class: "g-pfc-who" }, "Toi"), dots(myS)),
          h("div", { class: "g-pfc-vsx" }, "VS"),
          h("div", { class: "g-pfc-seat" + (s.picks[op] ? " done" : "") }, h("div", { class: "g-pfc-hand" }, s.picks[op] ? "✔️" : "🤔"), h("div", { class: "g-pfc-who" }, nameOf(ctx, op)), dots(opS)));
      } else {
        let txt;
        if (s.over) txt = s.alive[0] === me ? "🏆 Tu remportes le tournoi !" : `🏆 ${nameOf(ctx, s.alive[0])} remporte le tournoi`;
        else if (s.byes.includes(me)) txt = "Tu es qualifié d'office pour le tour suivant. Regarde les duels !";
        else if (s.alive.includes(me)) txt = "Duel gagné ! Attends la fin des autres duels.";
        else txt = "Tu es éliminé. Regarde la suite du tournoi !";
        arena = h("div", { class: "g-pfc-wait card" }, txt);
      }
      if (multi && !s.over) {
        status = h("div", { class: "g-pfc-bracket" }, s.matches.map((m) => h("div", { class: "g-pfc-match" + (m.a === me || m.b === me ? " me" : "") },
          h("span", { class: m.w === m.a ? "w" : m.w ? "l" : null }, nameOf(ctx, m.a)),
          h("b", null, `${m.sa} - ${m.sb}`),
          h("span", { class: m.w === m.b ? "w" : m.w ? "l" : null }, nameOf(ctx, m.b)))),
        s.byes.length ? h("div", { class: "small dim center" }, "Qualifiés d'office : ", s.byes.map((id) => nameOf(ctx, id)).join(", ")) : null);
      }
    }

    // message de tour
    let msg, isMe = false;
    if (s.over) msg = "Partie terminée";
    else if (locked) msg = "3, 2, 1… on révèle !";
    else if (myTurn) { msg = "Choisis ton signe en secret"; isMe = true; }
    else if (myPick) { const waiting = who.filter((id) => id !== me); msg = waiting.length ? `Choix gardé secret. On attend ${waiting.length === 1 ? nameOf(ctx, waiting[0]) : waiting.length + " joueurs"}…` : "Choix gardé secret…"; }
    else msg = "Les autres choisissent…";
    const turn = h("div", { class: "turnmsg" + (isMe ? " me" : "") }, msg);

    const spectator = s.format !== "points" && matchOf(s, me) < 0;
    const pad = s.over || spectator ? null : h("div", { class: "g-pfc-pad n" + signs.length }, signs.map((k) => h("button", {
      class: "g-pfc-btn" + (myPick === k ? " sel" : ""), disabled: !myTurn || locked, "aria-label": nm(k),
      onclick: () => { ctx.sfx.tap(); ctx.buzz && ctx.buzz(15); ctx.act({ type: "pick", sign: k }); } },
    h("span", { class: "g-pfc-emo" }, em(k)), h("span", { class: "g-pfc-lbl" }, nm(k)))));

    const legend = h("div", { class: "g-pfc-legend small dim" }, signs.map((k) => h("span", null, em(k), " bat ", signs.filter((x) => beats(k, x)).map(em).join(" "))));
    main.replaceChildren(head, turn, arena, status, pad, legend);
  }

  update(ctx0);
  return { update, destroy() { timers.forEach(clearTimeout); } };
}
