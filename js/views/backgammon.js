import { h } from "../ui.js";
import { turnLine, nameOf, dieHTML } from "./common.js";
import { toAct, movesNow, remainingDice, turnComplete, canDouble, pips, reduce, BAR, OFF } from "../games/backgammon.js";

// score de la bande des joueurs : points gagnés (match) ou pions sortis
export const scoreOf = (s, id) => (s.order.includes(id) ? (s.match > 1 ? s.score[id] : s.b[s.order.indexOf(id)][OFF]) : null);
export const scoreLabel = (v) => `${v} point${v > 1 ? "s" : ""}`;

const KIND = { simple: "simple", gammon: "gammon", backgammon: "backgammon", abandon: "abandon" };
const MAXSTACK = 5;
const clone = (o) => JSON.parse(JSON.stringify(o));

export function mount(root, ctx0) {
  const el = h("div", { class: "g-backgammon" });
  root.append(el);
  let ctx = ctx0;
  let sel = null;               // flèche de départ choisie (dans le repère du joueur)
  let drag = null;              // glisser en cours
  let seenRoll = -1, animated = new Set(), skipAnim = new Set();
  let lastKey = "";
  let flying = [];

  function viewSide(s) { const k = s.order.indexOf(ctx.me); return k < 0 ? 0 : k; }
  // nombre de pions de chaque camp sur la flèche k du spectateur
  const countsAt = (s, v, k) => ({ mine: s.b[v][k], theirs: s.b[1 - v][25 - k] });

  // destinations possibles depuis `from` : t -> suite de mouvements (un ou plusieurs dés)
  function targetsFrom(s, from) {
    const out = new Map();
    const pid = s.order[s.side];
    const walk = (st, f, list, depth) => {
      if (depth > 4) return;
      for (const m of movesNow(st)) {
        if (m.f !== f) continue;
        const t = Math.max(0, f - m.d);
        const l2 = list.concat([{ f: m.f, d: m.d }]);
        if (!out.has(t) || out.get(t).length > l2.length) out.set(t, l2);
        if (t > 0 && !turnComplete(st)) {
          let st2;
          try { st2 = reduce(clone(st), pid, { type: "move", f: m.f, d: m.d }); } catch { continue; }
          if (st2.phase === "move" && !turnComplete(st2)) walk(st2, t, l2, depth + 1);
        }
      }
    };
    walk(s, from, [], 1);
    return out;
  }

  function play(list, viaDrag) {
    const s = ctx.state;
    if (viaDrag) list.forEach((_, j) => skipAnim.add(`${s.rollN}:${s.played.length + j}`));
    sel = null;
    ctx.sfx.card();
    ctx.act(list.length === 1 ? { type: "move", f: list[0].f, d: list[0].d } : { type: "move", list });
  }

  function update(c) {
    ctx = c;
    const s = ctx.state;
    if (s.rollN !== seenRoll) { animated = new Set(); skipAnim = new Set(); }
    const key = `${s.game}:${s.rollN}:${s.phase}:${s.played.length}`;
    if (key !== lastKey) { sel = null; }
    draw();
    // sons et animations des nouveaux mouvements
    const moves = s.phase === "move" && s.played.length ? s.played : s.lastSide >= 0 && s.last.length ? s.last : [];
    const mside = s.phase === "move" && s.played.length ? s.side : s.lastSide;
    const fresh = [];
    moves.forEach((m, i) => {
      const k = `${s.rollN}:${i}`;
      if (animated.has(k)) return;
      animated.add(k);
      if (!skipAnim.has(k) && lastKey) fresh.push(m);
    });
    if (lastKey && s.rollN !== seenRoll && s.dice.length) ctx.sfx.tap();
    if (fresh.length) animate(fresh, mside);
    if (lastKey && fresh.some((m) => m.h)) (mside === viewSide(s) ? ctx.sfx.ok : ctx.sfx.bad)();
    if (lastKey && s.end && key !== lastKey) (s.order[s.end.side] === ctx.me ? ctx.sfx.win : ctx.sfx.tap)();
    seenRoll = s.rollN;
    lastKey = key;
  }

  function draw() {
    const s = ctx.state;
    const v = viewSide(s);
    const who = toAct(s);
    const myTurn = who.includes(ctx.me);
    const moving = myTurn && s.phase === "move";
    const legal = moving ? movesNow(s) : [];
    const sources = new Set(legal.map((m) => m.f));
    const targets = moving && sel != null ? targetsFrom(s, sel) : new Map();
    const lastSet = new Set();
    if (s.lastSide >= 0 && s.phase !== "move") for (const m of s.last) {
      const conv = (k) => (s.lastSide === v ? k : 25 - k);
      if (m.f !== BAR) lastSet.add(conv(m.f));
      if (m.t > 0) lastSet.add(conv(m.t));
    }

    const board = h("div", { class: "g-backgammon-board" + (moving ? " live" : "") });
    const pointEl = (k, top) => {
      const { mine, theirs } = countsAt(s, v, k);
      const n = mine || theirs;
      const col = mine ? v : 1 - v;
      const cls = ["g-backgammon-pt", top ? "top" : "bot", k % 2 ? "odd" : "even"];
      if (sources.has(k)) cls.push("src");
      if (sel === k) cls.push("sel");
      if (targets.has(k)) cls.push("dst");
      if (lastSet.has(k)) cls.push("last");
      const stack = h("div", { class: "g-backgammon-stack" });
      for (let i = 0; i < Math.min(n, MAXSTACK); i++) {
        stack.append(h("i", { class: `g-backgammon-ck c${col}` }, i === MAXSTACK - 1 && n > MAXSTACK ? h("b", null, String(n)) : null));
      }
      const col0 = top ? (k <= 18 ? k - 12 : k - 11) : (k >= 7 ? 13 - k : 14 - k);
      return h("button", { class: cls.join(" "), "data-pt": k, style: { gridColumn: String(col0), gridRow: top ? "1" : "3" },
        "aria-label": `Flèche ${k}${n ? ` : ${n} pion${n > 1 ? "s" : ""} ${mine ? "à toi" : "adverses"}` : ""}${targets.has(k) ? ", destination possible" : ""}`,
        onclick: () => tap(k) }, h("span", { class: "g-backgammon-tri" }), stack);
    };
    for (let k = 13; k <= 24; k++) board.append(pointEl(k, true));
    for (let k = 12; k >= 1; k--) board.append(pointEl(k, false));
    // barre : en haut les pions adverses, en bas les miens
    const barStack = (side, mineSide) => {
      const n = s.b[side][BAR];
      const st = h("div", { class: "g-backgammon-stack" });
      for (let i = 0; i < Math.min(n, 4); i++) st.append(h("i", { class: `g-backgammon-ck c${side}` }, i === 3 && n > 4 ? h("b", null, String(n)) : null));
      const cls = ["g-backgammon-bar", mineSide ? "bot" : "top"];
      if (mineSide && sources.has(BAR)) cls.push("src");
      if (mineSide && sel === BAR) cls.push("sel");
      return h("button", { class: cls.join(" "), "data-pt": mineSide ? BAR : "obar", style: { gridColumn: "7", gridRow: mineSide ? "3" : "1" },
        "aria-label": `Barre : ${n} pion${n > 1 ? "s" : ""}`, onclick: () => mineSide && tap(BAR) }, st);
    };
    board.append(barStack(1 - v, false), barStack(v, true));
    board.append(h("div", { class: "g-backgammon-barmid", style: { gridColumn: "7", gridRow: "2" } },
      s.cube ? h("span", { class: "g-backgammon-cube" + (s.crawford ? " off" : ""), title: "Videau" }, s.crawford ? "C" : String(s.cubeVal === 1 ? 64 : s.cubeVal)) : null));
    // plateaux de sortie
    const tray = (side, mineSide) => {
      const n = s.b[side][OFF];
      const st = h("div", { class: "g-backgammon-offstack" });
      for (let i = 0; i < n; i++) st.append(h("i", { class: `g-backgammon-slab c${side}` }));
      const cls = ["g-backgammon-tray", mineSide ? "bot" : "top"];
      if (mineSide && targets.has(OFF)) cls.push("dst");
      return h("button", { class: cls.join(" "), "data-pt": mineSide ? OFF : "ooff", style: { gridColumn: "14", gridRow: mineSide ? "3" : "1" },
        "aria-label": `Sortis : ${n}`, onclick: () => mineSide && tap(OFF) }, st, n ? h("small", null, String(n)) : null);
    };
    board.append(tray(1 - v, false), tray(v, true));
    board.append(h("div", { class: "g-backgammon-traymid", style: { gridColumn: "14", gridRow: "2" } }));
    // dés : côté droit pour le joueur au trait vu d'en bas, à gauche pour l'autre
    const diceSide = s.side === v ? "r" : "l";
    const dice = h("div", { class: `g-backgammon-dice ${diceSide}`, style: { gridColumn: diceSide === "r" ? "8 / 14" : "1 / 7", gridRow: "2" } });
    if (s.dice.length && (s.phase === "move" || (s.note && s.note.txt === "bloque"))) {
      const rest = s.phase === "move" ? remainingDice(s) : [];
      const left = rest.slice();
      s.dice.forEach((d) => {
        const i = left.indexOf(d);
        const used = s.phase !== "move" || i < 0;
        if (!used) left.splice(i, 1);
        const wrap = h("span", { class: "g-backgammon-die" + (used ? " used" : "") + (s.rollN !== seenRoll ? " roll" : "") });
        wrap.innerHTML = dieHTML(d);
        dice.append(wrap);
      });
    } else if (s.phase === "roll" && s.order[s.side] === ctx.me) {
      dice.append(h("button", { class: "g-backgammon-rollbtn", onclick: () => { ctx.sfx.tap(); ctx.act({ type: "roll" }); } }, "🎲 Lancer"));
    }
    board.append(dice);

    // ---- bandeau des joueurs
    const chip = (side) => {
      const id = s.order[side];
      const turn = who.includes(id);
      return h("div", { class: `g-backgammon-chip${turn ? " turn" : ""}` },
        h("i", { class: `g-backgammon-ck mini c${side}` }),
        h("span", { class: "g-backgammon-name" }, nameOf(ctx, id), h("small", null, `${pips(s.b[side])} pips${s.b[side][OFF] ? ` · ${s.b[side][OFF]} sorti${s.b[side][OFF] > 1 ? "s" : ""}` : ""}`)),
        s.match > 1 ? h("b", { class: "g-backgammon-pts" }, `${s.score[id]}`) : null);
    };
    const head = headLine(s, who, myTurn, legal);
    const info = [];
    if (s.match > 1) info.push(`Match en ${s.match} points · partie ${s.game}${s.crawford ? " · Crawford : pas de videau" : ""}`);
    if (s.opening && s.phase === "move" && s.played.length === 0 && !s.last.length) info.push(`Ouverture : ${nameOf(ctx, s.order[0])} ${s.opening[0]}, ${nameOf(ctx, s.order[1])} ${s.opening[1]}`);
    if (s.note && s.note.txt === "bloque") info.push(`${nameOf(ctx, s.note.who)} ne peut pas jouer ${s.dice.slice(0, 2).join("-")} : son tour passe.`);
    if (s.note && s.note.txt === "accepte") info.push(`${nameOf(ctx, s.note.who)} accepte : la mise passe à ${s.cubeVal}.`);

    // ---- boutons
    const btns = [];
    if (myTurn && s.phase === "roll") {
      if (canDouble(s)) btns.push(h("button", { class: "btn gold", onclick: () => { ctx.sfx.coin(); ctx.act({ type: "double" }); } }, `Doubler (x${s.cubeVal * 2})`));
    }
    if (moving) {
      if (s.played.length) btns.push(h("button", { class: "btn ghost", onclick: () => { ctx.sfx.tap(); sel = null; ctx.act({ type: "undo" }); } }, "↩ Annuler mon coup"));
      if (turnComplete(s)) btns.push(h("button", { class: "btn green", onclick: () => { ctx.sfx.ok(); ctx.act({ type: "done" }); } }, "Valider"));
    }
    if (myTurn && s.phase === "cube") {
      btns.push(h("button", { class: "btn green", onclick: () => { ctx.sfx.ok(); ctx.act({ type: "take" }); } }, `Accepter (x${s.cubeVal * 2})`));
      btns.push(h("button", { class: "btn red", onclick: () => { ctx.sfx.bad(); ctx.act({ type: "drop" }); } }, `Abandonner (-${s.cubeVal})`));
    }
    if (s.phase === "end") {
      if (myTurn) btns.push(h("button", { class: "btn green", onclick: () => { ctx.sfx.tap(); ctx.act({ type: "next" }); } }, "Partie suivante"));
      else btns.push(h("p", { class: "small dim center" }, `${nameOf(ctx, who[0])} lance la partie suivante…`));
    }
    el.replaceChildren(head,
      h("div", { class: "g-backgammon-chips" }, chip(1 - v), chip(v)),
      info.length ? h("div", { class: "g-backgammon-info" }, info.map((t) => h("div", null, t))) : null,
      h("div", { class: "g-backgammon-wrap" }, board),
      h("div", { class: "g-backgammon-btns" }, btns));
  }

  function headLine(s, who, myTurn, legal) {
    if (s.end) {
      const w = s.order[s.end.side];
      const kind = s.end.kind === "abandon" ? "abandon" : KIND[s.end.kind];
      const txt = `${nameOf(ctx, w)} gagne la partie (${kind}) : ${s.end.pts} point${s.end.pts > 1 ? "s" : ""}`;
      return h("div", { class: "turnmsg" + (w === ctx.me ? " me" : "") }, txt);
    }
    if (!myTurn) {
      if (s.phase === "cube") return h("div", { class: "turnmsg" }, `Tu doubles la mise : ${nameOf(ctx, who[0])} réfléchit…`);
      return turnLine(ctx, who);
    }
    if (s.phase === "roll") return h("div", { class: "turnmsg me" }, canDouble(s) ? "À toi : lance les dés ou double la mise" : "À toi : lance les dés");
    if (s.phase === "cube") return h("div", { class: "turnmsg me" }, `${nameOf(ctx, s.order[s.side])} double la mise : à toi de choisir`);
    if (turnComplete(s)) return h("div", { class: "turnmsg me" }, "Coup terminé : valide ou annule");
    const rest = remainingDice(s);
    const mustBar = s.b[s.side][BAR] > 0;
    return h("div", { class: "turnmsg me" }, mustBar ? "À toi : fais rentrer ton pion de la barre" :
      sel == null ? `À toi : joue ${rest.length > 2 ? `${rest.length} fois le ${rest[0]}` : rest.length === 2 ? `ton ${rest[0]} et ton ${rest[1]}` : `ton ${rest[0]}`} (touche ou glisse un pion)` : "Choisis une flèche en surbrillance");
  }

  function tap(k) {
    const s = ctx.state;
    if (!toAct(s).includes(ctx.me) || s.phase !== "move") return;
    if (sel != null) {
      const t = targetsFrom(s, sel);
      if (t.has(k)) { play(t.get(k), false); return; }
    }
    const legal = movesNow(s);
    if (sel === k) sel = null;
    else if (legal.some((m) => m.f === k)) { sel = k; ctx.sfx.tap(); }
    else sel = null;
    draw();
  }

  // ---- glisser un pion
  function onDown(e) {
    const s = ctx.state;
    if (!toAct(s).includes(ctx.me) || s.phase !== "move") return;
    const btn = e.target.closest("[data-pt]");
    if (!btn) return;
    const k = +btn.dataset.pt;
    if (!Number.isFinite(k) || !movesNow(s).some((m) => m.f === k)) return;
    drag = { k, x: e.clientX, y: e.clientY, on: false, ghost: null, side: s.side };
  }
  function onMove(e) {
    if (!drag) return;
    if (!drag.on) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return;
      drag.on = true;
      sel = drag.k; draw();
      const size = (el.querySelector(".g-backgammon-pt")?.getBoundingClientRect().width || 28);
      drag.ghost = h("i", { class: `g-backgammon-ck c${drag.side} g-backgammon-ghost`, style: { width: size + "px", height: size + "px" } });
      document.body.append(drag.ghost);
      drag.size = size;
    }
    e.preventDefault();
    drag.ghost.style.transform = `translate(${e.clientX - drag.size / 2}px, ${e.clientY - drag.size / 2}px) scale(1.15)`;
    el.querySelectorAll(".g-backgammon-board .hover").forEach((x) => x.classList.remove("hover"));
    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-pt]");
    if (over) over.classList.add("hover");
  }
  function onUp(e) {
    if (!drag) return;
    const d = drag; drag = null;
    if (!d.on) return; // simple toucher : géré par le clic
    d.ghost.remove();
    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-pt]");
    const k = over ? +over.dataset.pt : NaN;
    const t = targetsFrom(ctx.state, d.k);
    suppressClick = true; setTimeout(() => (suppressClick = false), 50);
    if (Number.isFinite(k) && t.has(k)) play(t.get(k), true);
    else { sel = d.k; draw(); }
  }
  let suppressClick = false;
  const onClickCapture = (e) => { if (suppressClick) { e.stopPropagation(); e.preventDefault(); suppressClick = false; } };
  el.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove, { passive: false });
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  el.addEventListener("click", onClickCapture, true);

  // ---- animation des pions qui avancent (coups de l'adversaire, du robot, ou au toucher)
  function locate(side, k) {
    const s = ctx.state, v = viewSide(s);
    const mine = side === v;
    let sel2;
    if (k === BAR) sel2 = mine ? `[data-pt="${BAR}"]` : `[data-pt="obar"]`;
    else if (k === OFF) sel2 = mine ? `[data-pt="${OFF}"]` : `[data-pt="ooff"]`;
    else sel2 = `.g-backgammon-pt[data-pt="${mine ? k : 25 - k}"]`;
    return el.querySelector(sel2);
  }
  function animate(moves, side) {
    flying.forEach((f) => f.remove());
    flying = [];
    const hidden = [];
    // on cache les pions d'arrivée le temps du vol
    const arrivals = new Map();
    for (const m of moves) {
      const k = m.t;
      arrivals.set(k, (arrivals.get(k) || 0) + 1);
      arrivals.set(m.f, (arrivals.get(m.f) || 0) - 1);
    }
    for (const [k, n] of arrivals) {
      if (n <= 0 || k === OFF) continue;
      const p = locate(side, k);
      if (!p) continue;
      const cks = [...p.querySelectorAll(".g-backgammon-ck")].slice(-n);
      cks.forEach((c) => { c.style.visibility = "hidden"; hidden.push(c); });
    }
    const step = 300;
    moves.forEach((m, i) => {
      const a = locate(side, m.f), b = locate(side, m.t);
      if (!a || !b) return;
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      const size = Math.min(ra.width, 40);
      const top = (r, isTop) => (isTop ? r.top + size * 0.6 : r.bottom - size * 1.6);
      const x0 = ra.left + ra.width / 2 - size / 2, y0 = top(ra, a.classList.contains("top"));
      const x1 = rb.left + rb.width / 2 - size / 2, y1 = top(rb, b.classList.contains("top"));
      const g = h("i", { class: `g-backgammon-ck c${side} g-backgammon-fly`, style: { width: size + "px", height: size + "px", transform: `translate(${x0}px, ${y0}px)`, opacity: "0" } });
      document.body.append(g);
      flying.push(g);
      setTimeout(() => {
        g.style.opacity = "1";
        g.style.transition = "transform .28s cubic-bezier(.3,.7,.4,1)";
        requestAnimationFrame(() => { g.style.transform = `translate(${x1}px, ${y1}px)`; });
      }, i * step);
      setTimeout(() => { g.remove(); }, i * step + 320);
    });
    setTimeout(() => hidden.forEach((c) => (c.style.visibility = "")), moves.length * step + 40);
  }

  update(ctx0);
  return {
    update,
    destroy() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      flying.forEach((f) => f.remove());
      if (drag && drag.ghost) drag.ghost.remove();
    },
  };
}
