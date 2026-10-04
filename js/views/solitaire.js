import { h } from "../ui.js";
import { cardHTML, cardBackHTML, feltStyle, nameOf } from "./common.js";
import { toAct, fits, fCount, deadline, canRecycle, FS, rankN } from "../games/solitaire.js";
import { SUIT_SYM } from "../games/cards.js";

export const scoreOf = (s, id) => (s.scoring === "cards" ? `${fCount(s.p[id])}/52` : s.p[id].score);
export const scoreLabel = (v, s) => (s && s.scoring === "cards" ? `${v} cartes` : `${v} pts`);

const STATUS = { play: "En jeu", won: "A tout rangé !", stuck: "Bloqué", out: "Abandon", time: "Temps écoulé" };
const RS = { 1: "A", 11: "J", 12: "Q", 13: "K" };
const fmtT = (ms) => { const t = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };

export function mount(root, ctx0) {
  const el = h("div", { class: "g-solitaire" });
  root.append(el);
  const strip = h("div", { class: "g-solitaire-strip" });
  const head = h("div", { class: "g-solitaire-head" });
  const board = h("div", { class: "felt g-solitaire-felt" });
  const bar = h("div", { class: "g-solitaire-bar" });
  el.append(strip, head, board, bar);
  let ctx = ctx0, myKey = "", drag = null, dirty = false, ticked = false, sure = false, lastLast = "";

  const timer = setInterval(() => drawHead(), 1000);

  function update(c) {
    ctx = c;
    const s = ctx.state;
    if (s.last && JSON.stringify(s.last) !== lastLast) {
      if (lastLast && s.last.id === ctx.me) {
        if (s.last.t === "move" && s.last.to[0] === "f") ctx.sfx.coin();
        else if (s.last.t === "auto") ctx.sfx.ok();
        else ctx.sfx.card();
      }
      lastLast = JSON.stringify(s.last);
    }
    drawStrip(); drawHead();
    const P = s.p[ctx.me];
    const k = JSON.stringify(P) + s.done;
    if (k !== myKey) { myKey = k; if (drag) dirty = true; else drawBoard(); }
  }

  function drawStrip() {
    const s = ctx.state;
    const ids = s.ids.slice().sort((a, b) => (a === ctx.me ? -1 : b === ctx.me ? 1 : 0));
    strip.replaceChildren(...ids.map((id) => {
      const P = s.p[id], n = fCount(P);
      return h("div", { class: "g-solitaire-pl" + (id === ctx.me ? " me" : "") + " st-" + P.status },
        h("div", { class: "g-solitaire-plname" }, id === ctx.me ? "Toi" : nameOf(ctx, id)),
        h("div", { class: "g-solitaire-prog" }, h("i", { style: { width: Math.round((100 * n) / 52) + "%" } })),
        h("div", { class: "tiny" }, `${n}/52`, s.scoring === "cards" ? "" : ` · ${P.score} pts`, P.status !== "play" ? h("span", { class: "dim" }, " · " + STATUS[P.status]) : null));
    }));
  }

  function drawHead() {
    const s = ctx.state;
    const left = deadline(s) - Date.now();
    const P = s.p[ctx.me];
    if (!s.done && left <= 0 && !ticked && s.startedAt) { ticked = true; ctx.act({ type: "tick" }); }
    let txt;
    if (s.done) {
      const w = s.ids.find((id) => s.p[id].status === "won");
      txt = w ? (w === ctx.me ? "Bravo, tu as tout rangé en premier !" : `${nameOf(ctx, w)} a tout rangé !`)
        : s.endBy === "time" ? "Temps écoulé !" : "Tout le monde est bloqué.";
    } else if (!P) txt = "Tu regardes la partie";
    else if (P.status !== "play") txt = `${STATUS[P.status]} : les autres continuent…`;
    else txt = "Range tout sur les fondations, plus vite que les autres !";
    head.replaceChildren(
      h("div", { class: "turnmsg" + (P && P.status === "play" && !s.done ? " me" : "") }, txt),
      h("div", { class: "g-solitaire-clock" + (left < 60000 && !s.done ? " hurry" : "") }, "⏱️ ", s.done ? "0:00" : fmtT(left)));
  }

  // ---------------- tapis
  function cardW() {
    const w = board.clientWidth || el.clientWidth || 340;
    return Math.max(34, Math.min(76, Math.floor((w - 20 - 6 * 5) / 7)));
  }

  function drawBoard() {
    const s = ctx.state;
    const P = s.p[ctx.me];
    board.setAttribute("style", feltStyle(ctx.skin.table));
    if (!P) { board.replaceChildren(h("div", { class: "center small" }, "Tu n'es pas dans cette partie.")); bar.replaceChildren(); return; }
    const cw = cardW();
    board.style.setProperty("--cw", cw + "px");
    const live = !s.done && P.status === "play";
    // pioche, défausse et fondations
    const stockBtn = h("button", { class: "g-solitaire-slot g-solitaire-stock", disabled: !live, "aria-label": P.st.length ? "Retourner des cartes" : "Remettre la pioche",
      onclick: () => { if (!P.st.length && !canRecycle(s, P)) { ctx.sfx.bad(); ctx.toast(P.w.length ? "Plus de passage autorisé" : "Pioche vide"); return; } ctx.sfx.card(); ctx.act({ type: "draw" }); },
      html: P.st.length ? cardBackHTML(ctx.skin.deck, cw) + `<span class="g-solitaire-cnt">${P.st.length}</span>`
        : `<div class="pcard slot g-solitaire-re">${canRecycle(s, P) ? "↻" : "✕"}</div>` });
    const wshow = P.w.slice(-(s.draw === 3 ? 3 : 1));
    const waste = h("div", { class: "g-solitaire-waste", "data-drop": "" }, wshow.map((c, i) => {
      const isTop = i === wshow.length - 1;
      const e = h("div", { class: "g-solitaire-wc", style: { left: i * Math.round(cw * 0.32) + "px" }, html: cardHTML(c) });
      if (isTop && live) grab(e, "w", 1);
      return e;
    }));
    const founds = FS.map((su, k) => {
      const n = P.f[k];
      const e = h("div", { class: "g-solitaire-slot g-solitaire-f", "data-drop": "f" + k, "aria-label": "Fondation " + su,
        html: n ? cardHTML((RS[n] || n) + su) : `<div class="pcard slot g-solitaire-fs${su === "H" || su === "D" ? " red" : ""}">${SUIT_SYM[su]}</div>` });
      if (n && live) grab(e, "f" + k, 1);
      return e;
    });
    const top = h("div", { class: "g-solitaire-top" }, stockBtn, waste, h("div", { class: "grow" }), ...founds);
    const fd = Math.round(cw * 0.2), fu = Math.round(cw * 0.4);
    const cols = h("div", { class: "g-solitaire-cols" }, P.t.map((col, i) => {
      const c = h("div", { class: "g-solitaire-col", "data-drop": "t" + i });
      let y = 0, lastY = 0;
      if (!col.length) c.append(h("div", { class: "pcard slot g-solitaire-kslot", html: "R" }));
      col.forEach((card, j) => {
        const down = j < P.d[i];
        const e = h("div", { class: "g-solitaire-cc" + (down ? "" : " up"), style: { top: y + "px" }, html: down ? cardBackHTML(ctx.skin.deck, cw) : cardHTML(card) });
        if (!down && live) grab(e, "t" + i, col.length - j);
        c.append(e);
        lastY = y;
        y += down ? fd : fu;
      });
      c.style.height = Math.round(lastY + cw * 1.42) + "px";
      return c;
    }));
    board.replaceChildren(top, cols);
    sure = false;
    bar.replaceChildren(
      h("button", { class: "btn small green", disabled: !live, onclick: () => ctx.act({ type: "auto" }) }, "⚡ Coup auto"),
      h("button", { class: "btn small ghost", disabled: !live, onclick: (ev) => {
        if (!sure) { sure = true; ev.currentTarget.textContent = "Sûr ? Touche encore"; return; }
        ctx.act({ type: "giveup" });
      } }, "Abandonner"),
      h("div", { class: "tiny dim g-solitaire-help" }, `Pioche ${s.draw} carte${s.draw > 1 ? "s" : ""} · passages : ${s.passes ? s.passes : "illimités"} · touche une carte pour la jouer, ou glisse-la`));
  }

  // ---------------- toucher et glisser
  function grab(e, from, n) {
    e.classList.add("g-solitaire-grab");
    e.addEventListener("pointerdown", (ev) => {
      if (ev.button > 0) return;
      ev.preventDefault();
      drag = { from, n, x: ev.clientX, y: ev.clientY, moving: false, ghost: null, src: e, id: ev.pointerId };
      try { e.setPointerCapture(ev.pointerId); } catch (_) { /* rien */ }
    });
    e.addEventListener("pointermove", (ev) => {
      if (!drag || drag.src !== e) return;
      const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
      if (!drag.moving && Math.hypot(dx, dy) > 8) {
        drag.moving = true;
        const r = e.getBoundingClientRect();
        const g = h("div", { class: "g-solitaire-ghost", style: { left: r.left + "px", top: r.top + "px", "--cw": cardW() + "px" } });
        // la carte et celles posées dessus
        let sib = e;
        const parts = [];
        while (sib) { parts.push(sib); sib = drag.n > 1 ? sib.nextElementSibling : null; }
        parts.forEach((p, k) => { const cl = h("div", { class: "g-solitaire-gc", style: { top: k * Math.round(cardW() * 0.4) + "px" }, html: p.innerHTML }); g.append(cl); p.style.visibility = "hidden"; });
        drag.parts = parts; drag.ghost = g; drag.ox = r.left; drag.oy = r.top;
        document.body.append(g);
      }
      if (drag.moving) drag.ghost.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    const end = (ev, cancel) => {
      if (!drag || drag.src !== e) return;
      const d = drag;
      drag = null;
      if (d.moving) {
        d.ghost.remove();
        d.parts.forEach((p) => (p.style.visibility = ""));
        const t = cancel ? null : document.elementFromPoint(ev.clientX, ev.clientY);
        const zone = t && t.closest("[data-drop]");
        const to = zone && zone.dataset.drop;
        if (to) tryMove(d.from, d.n, to);
      } else if (!cancel) tapPlay(d.from, d.n);
      if (dirty) { dirty = false; drawBoard(); }
    };
    e.addEventListener("pointerup", (ev) => end(ev, false));
    e.addEventListener("pointercancel", (ev) => end(ev, true));
  }

  function cardsAt(P, from, n) {
    if (from === "w") return [P.w[P.w.length - 1]];
    if (from[0] === "f") { const k = +from[1]; return [(RS[P.f[k]] || P.f[k]) + FS[k]]; }
    const col = P.t[+from[1]];
    return col.slice(col.length - n);
  }
  function tryMove(from, n, to) {
    const P = ctx.state.p[ctx.me];
    if (to === from) return;
    const cards = cardsAt(P, from, n);
    if (to[0] === "f") to = "f";
    if (!fits(P, cards, to)) { ctx.sfx.bad(); ctx.buzz(30); return; }
    ctx.act({ type: "move", from, n, to });
  }
  // touche : la carte part au meilleur endroit
  function tapPlay(from, n) {
    const P = ctx.state.p[ctx.me];
    const cards = cardsAt(P, from, n);
    if (n === 1 && from[0] !== "f" && fits(P, cards, "f")) { ctx.act({ type: "move", from, n, to: "f" }); return; }
    const king = rankN(cards[0]) === 13;
    const cands = [];
    for (let j = 0; j < 7; j++) {
      if ("t" + j === from || !fits(P, cards, "t" + j)) continue;
      const empty = !P.t[j].length;
      if (empty && from[0] === "t" && P.t[+from[1]].length === n) continue; // Roi déjà en tête
      cands.push({ j, w: empty ? (king ? 1 : 0) : 2 });
    }
    if (!cands.length) { ctx.sfx.bad(); ctx.buzz(20); return; }
    cands.sort((a, b) => b.w - a.w);
    ctx.act({ type: "move", from, n, to: "t" + cands[0].j });
  }

  update(ctx0);
  return { update, destroy() { clearInterval(timer); if (drag && drag.ghost) drag.ghost.remove(); } };
}
