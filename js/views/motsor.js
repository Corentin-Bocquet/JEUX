import { h, sheet } from "../ui.js";
import { turnLine, nameOf } from "./common.js";
import { toAct, analyze, validWord, VALUES, PREMIUM, CENTER, N, RACK, tileValue } from "../games/motsor.js";

export const scoreOf = (s, id) => s.score[id];
export const scoreLabel = (v) => `${v} pts`;

const PLABEL = { T: "MT", D: "MD", t: "LT", d: "LD" };
const PCLASS = { T: "tw", D: "dw", t: "tl", d: "dl" };

function fmtClock(ms) {
  const neg = ms < 0, t = Math.ceil(Math.abs(ms) / 1000);
  return `${neg ? "-" : ""}${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

export function mount(root, ctx0) {
  const el = h("div", { class: "g-motsor" });
  root.append(el);
  let ctx = ctx0, rackKey = null, slots = [], pending = [], sel = null, zoom = false, lastSeq = -1, timer = null;
  let drag = null;

  function syncRack(rack) {
    if (rack === rackKey) return;
    const pool = [...rack], next = [];
    for (const sl of slots) { const k = pool.indexOf(sl.ch); if (k >= 0) { next.push(sl.ch); pool.splice(k, 1); } }
    slots = [...next, ...pool].map((ch, id) => ({ id, ch }));
    rackKey = rack; pending = []; sel = null;
  }
  const myTurn = () => toAct(ctx.state).includes(ctx.me);
  const usedSlot = (id) => pending.some((p) => p.slot === id);

  function place(slotId, i) {
    const s = ctx.state;
    if (s.board[i] !== "." || pending.some((p) => p.i === i && p.slot !== slotId)) return;
    const sl = slots.find((x) => x.id === slotId);
    if (!sl) return;
    const old = pending.find((p) => p.slot === slotId);
    const put = (ch) => {
      pending = pending.filter((p) => p.slot !== slotId);
      pending.push({ slot: slotId, i, ch });
      sel = null; ctx.sfx.tap(); draw();
    };
    if (sl.ch === "?") {
      if (old) return put(old.ch);
      const sh = sheet(h("div", { class: "g-motsor-jk" }, "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((c) =>
        h("button", { class: "g-motsor-jkb", onclick: () => { sh.close(); put(c.toLowerCase()); } }, c))), { title: "Ton joker devient…" });
      return;
    }
    put(sl.ch);
  }
  function unplace(slotId) { pending = pending.filter((p) => p.slot !== slotId); ctx.sfx.tap(); draw(); }

  // ---- glisser (chevalet vers grille, ou lettre posée vers une autre case)
  function startDrag(e, slotId) {
    if (e.button > 0) return;
    drag = { slotId, x: e.clientX, y: e.clientY, moved: false, ghost: null };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp, { once: true });
  }
  function onMove(e) {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return;
    if (!drag.moved) {
      drag.moved = true;
      const sl = slots.find((x) => x.id === drag.slotId);
      drag.ghost = h("div", { class: "g-motsor-ghost" }, sl.ch === "?" ? "" : sl.ch);
      document.body.append(drag.ghost);
    }
    drag.ghost.style.left = e.clientX + "px"; drag.ghost.style.top = e.clientY + "px";
  }
  function onUp(e) {
    document.removeEventListener("pointermove", onMove);
    const d = drag; drag = null;
    if (!d) return;
    if (!d.moved) { // simple toucher
      if (usedSlot(d.slotId)) return unplace(d.slotId);
      sel = sel === d.slotId ? null : d.slotId; ctx.sfx.tap(); return draw();
    }
    d.ghost.remove();
    const t = document.elementFromPoint(e.clientX, e.clientY);
    const cell = t && t.closest && t.closest("[data-i]");
    if (cell) place(d.slotId, +cell.dataset.i);
    else if (t && t.closest && t.closest(".g-motsor-rack")) unplace(d.slotId);
  }

  function tapCell(i) {
    if (sel == null) return;
    place(sel, i);
  }

  function draw() {
    const s = ctx.state;
    const mine = myTurn();
    const lastCells = s.log && s.log.cells ? s.log.cells : [];
    // grille
    const board = h("div", { class: "g-motsor-board" });
    for (let i = 0; i < N * N; i++) {
      const ch = s.board[i], p = pending.find((x) => x.i === i);
      const prem = PREMIUM[i];
      let cls = "g-motsor-cell" + (prem !== "." ? " " + PCLASS[prem] : "") + (i === CENTER ? " star" : "");
      let kid = null;
      if (ch !== ".") {
        cls += " full" + (lastCells.includes(i) ? " last" : "");
        kid = h("span", { class: "g-motsor-tile" + (ch >= "a" ? " jk" : "") }, ch.toUpperCase(), h("sub", null, tileValue(ch) || ""));
      } else if (p) {
        cls += " full";
        kid = h("span", { class: "g-motsor-tile pend" + (p.ch >= "a" ? " jk" : ""), style: { touchAction: "none" },
          onpointerdown: (e) => startDrag(e, p.slot) }, p.ch.toUpperCase(), h("sub", null, tileValue(p.ch) || ""));
      } else kid = h("i", null, i === CENTER ? "★" : PLABEL[prem] || "");
      board.append(h("div", { class: cls, "data-i": i, onclick: ch === "." && !p ? () => tapCell(i) : null }, kid));
    }
    // aperçu
    let preview = null, canPlay = false;
    if (pending.length) {
      const r = analyze(s.board, pending.map((p) => [p.i, p.ch]), s.bingo);
      if (r.err) preview = h("div", { class: "g-motsor-prev err" }, r.err);
      else {
        canPlay = true;
        preview = h("div", { class: "g-motsor-prev" },
          r.words.map((w) => {
            const ok = s.strict ? null : validWord(w.w);
            return h("span", { class: "g-motsor-w" + (ok === false ? " bad" : ok ? " ok" : "") }, w.w, h("b", null, ` ${w.score}`));
          }),
          r.bonus ? h("span", { class: "g-motsor-w ok" }, "7 lettres", h("b", null, ` +${r.bonus}`)) : null,
          h("span", { class: "g-motsor-total" }, `= ${r.total} pts`));
      }
    }
    // chevalet
    const rack = s.racks[ctx.me];
    const rackEl = rack != null ? h("div", { class: "g-motsor-rack" }, slots.map((sl) =>
      usedSlot(sl.id) ? h("span", { class: "g-motsor-slot" })
        : h("button", { class: "g-motsor-rt" + (sel === sl.id ? " sel" : "") + (sl.ch === "?" ? " jk" : ""), "aria-label": sl.ch === "?" ? "Joker" : sl.ch,
          style: { touchAction: "none" }, onpointerdown: (e) => startDrag(e, sl.id) },
        sl.ch === "?" ? "" : sl.ch, h("sub", null, VALUES[sl.ch] || "")))) : null;
    const btns = rack != null && !s.over ? h("div", { class: "g-motsor-btns" },
      pending.length
        ? h("button", { class: "btn ghost small", onclick: () => { pending = []; sel = null; draw(); } }, "Rappeler")
        : h("button", { class: "btn ghost small", onclick: () => { slots = slots.map((x) => ({ x, k: Math.random() })).sort((a, b) => a.k - b.k).map((o) => o.x); ctx.sfx.tap(); draw(); } }, "Mélanger"),
      h("button", { class: "btn green grow", disabled: !mine || !canPlay, onclick: () => { ctx.act({ type: "play", tiles: pending.map((p) => [p.i, p.ch]) }); } },
        canPlay ? `Valider · ${analyze(s.board, pending.map((p) => [p.i, p.ch]), s.bingo).total} pts` : "Valider"),
      h("button", { class: "btn ghost small", disabled: !mine || s.bag.length < RACK, onclick: swapSheet }, "Échanger"),
      h("button", { class: "btn ghost small", disabled: !mine, onclick: () => { ctx.act({ type: "pass" }); } }, "Passer")) : null;
    // infos
    const clocks = s.clock ? h("div", { class: "g-motsor-clocks" }, s.order.map((id) => {
      let used = s.used[id];
      if (!s.over && toAct(s)[0] === id) used += Date.now() - (s.turnAt || s.startedAt || Date.now());
      const left = s.clock * 60000 - used;
      return h("span", { class: "chip" + (left < 0 ? " g-motsor-late" : "") }, `${nameOf(ctx, id)} ${fmtClock(left)}`);
    })) : null;
    const info = h("div", { class: "g-motsor-info small" },
      h("span", { class: "chip" }, `🎒 ${s.bag.length} lettre${s.bag.length > 1 ? "s" : ""}`),
      s.strict ? h("span", { class: "chip" }, "Dico strict") : null,
      h("span", { class: "dim grow g-motsor-log" }, logText(s)),
      h("button", { class: "btn ghost small", "aria-label": "Zoom", onclick: () => { zoom = !zoom; draw(); } }, zoom ? "🔎 −" : "🔎 +"));
    let head;
    if (s.over) head = h("div", { class: "turnmsg me" }, "Partie terminée");
    else head = turnLine(ctx, toAct(s), pending.length ? "Vérifie l'aperçu puis valide" : sel != null ? "Touche une case de la grille" : "À toi : touche une lettre puis une case (ou glisse-la)");
    el.replaceChildren(head, info, clocks,
      h("div", { class: "g-motsor-wrap" + (zoom ? " zoom" : "") }, board),
      preview, rackEl, btns, s.over ? finalBox(s) : null);
  }

  function logText(s) {
    const l = s.log;
    if (!l) return "Le premier mot passe par l'étoile.";
    const n = nameOf(ctx, l.id);
    if (l.t === "play") return `${n} : ${l.words.map((w) => w[0]).join(", ")} (+${l.pts})`;
    if (l.t === "bad") return `${n} : ${l.words.join(", ")} refusé, tour perdu`;
    if (l.t === "swap") return `${n} échange ${l.n} lettre${l.n > 1 ? "s" : ""}`;
    return `${n} passe`;
  }

  function finalBox(s) {
    if (!s.final) return null;
    return h("div", { class: "card g-motsor-final" }, h("div", { class: "h3" }, "Décompte final"),
      s.order.map((id) => {
        const f = s.final[id];
        const bits = [];
        if (f.got) bits.push(`+${f.got} (lettres des autres)`);
        if (f.rem) bits.push(`−${f.rem} (lettres restantes)`);
        if (f.pen) bits.push(`−${f.pen} (pendule)`);
        return h("div", { class: "row between small" }, h("span", null, nameOf(ctx, id)), h("span", { class: "dim" }, bits.join(" · ") || "rien"), h("b", null, `${s.score[id]} pts`));
      }));
  }

  function swapSheet() {
    const pick = new Set();
    const list = h("div", { class: "g-motsor-rack" });
    const fill = () => list.replaceChildren(slots.map((sl) => h("button", { class: "g-motsor-rt" + (pick.has(sl.id) ? " sel" : "") + (sl.ch === "?" ? " jk" : ""),
      onclick: () => { pick.has(sl.id) ? pick.delete(sl.id) : pick.add(sl.id); fill(); } }, sl.ch === "?" ? "" : sl.ch, h("sub", null, VALUES[sl.ch] || ""))));
    fill();
    const sh = sheet(h("div", { class: "stack" }, h("p", { class: "small dim" }, "Touche les lettres à remettre dans le sac. Tu en pioches autant, et ton tour est fini."), list,
      h("button", { class: "btn gold block", onclick: () => {
        if (!pick.size) return;
        sh.close(); pending = [];
        ctx.act({ type: "swap", letters: slots.filter((x) => pick.has(x.id)).map((x) => x.ch).join("") });
      } }, "Échanger")), { title: "Échanger des lettres" });
  }

  function update(c) {
    ctx = c;
    const s = c.state;
    if (s.racks[c.me] != null) syncRack(s.racks[c.me]);
    pending = pending.filter((p) => s.board[p.i] === ".");
    if (s.seq !== lastSeq) {
      if (lastSeq >= 0 && s.log) (s.log.t === "play" ? (s.log.id === c.me ? c.sfx.ok() : c.sfx.card()) : s.log.t === "bad" ? c.sfx.bad() : null);
      if (lastSeq >= 0 && toAct(s).includes(c.me) && s.log && s.log.id !== c.me) c.sfx.turn && c.sfx.turn();
      lastSeq = s.seq;
    }
    if (drag) return;
    draw();
  }
  update(ctx0);
  if (ctx0.state.clock) timer = setInterval(() => { if (!drag && !ctx.state.over) draw(); }, 1000);
  return { update, destroy() { clearInterval(timer); document.removeEventListener("pointermove", onMove); if (drag && drag.ghost) drag.ghost.remove(); } };
}
