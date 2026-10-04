import { h, confirmBox } from "../ui.js";
import { nameOf } from "./common.js";
import { toAct, posOf, legalMoves, inCheck, mFrom, mTo, mFlag, mPromo, kingDest, endText, HILL, sqName, VAL } from "../games/echecs.js";

// ------------------------------------------------ pièces en SVG (lisibles sur toutes les cases, thème clair ou sombre)
const BASE = '<path d="M10.5 40.5h24v-3.6h-24z"/>';
const SHAPES = {
  P: '<circle cx="22.5" cy="13" r="5.6"/><path d="M14.5 36.9c0-6.2 3.2-10.4 5.3-12.6-2-1-3.1-2.4-3.1-4.1h11.6c0 1.7-1.1 3.1-3.1 4.1 2.1 2.2 5.3 6.4 5.3 12.6z"/>' + BASE,
  R: '<path d="M12 11h4.2v3.2h3.9V11h4.8v3.2h3.9V11H33l-1.2 7.2H13.2z"/><path d="M15 18.2h15v13.2H15z"/><path d="M12.6 36.9l1.8-5.5h16.2l1.8 5.5z"/>' + BASE + '<path class="d" d="M15 18.2h15M15 31.4h15" fill="none"/>',
  N: '<path d="M14.2 36.9c-.2-6.6 2.3-10.3 7-13.6-2.8-.2-5.3.8-7.4 2.6-1.6-.6-3.1-2.1-2.8-4.6 1.4-4.2 5.4-7.7 7.8-10.6l-.8-4.4 3.6 2.8 3.2-3 .6 3.8c6.5 2.1 10.4 8.6 9.6 17.4l-.6 9.6z"/>' + BASE + '<circle class="e" cx="19.6" cy="15.2" r="1.5"/><path class="d" d="M24.6 9.7c3.6 2.2 5.6 6.2 5.4 11.6" fill="none"/>',
  B: '<circle cx="22.5" cy="8.6" r="2.6"/><path d="M15.2 33.6c-.8-8.2 2.6-14.4 7.3-21.4 4.7 7 8.1 13.2 7.3 21.4z"/><path d="M13.6 36.9l1.6-3.3h14.6l1.6 3.3z"/>' + BASE + '<path class="d" d="M20 20.4l5 5" fill="none"/>',
  Q: '<path d="M12.6 36.9L9.6 15.6l6.6 9.4.2-12.6 4.4 11.6 1.7-13.4 1.7 13.4 4.4-11.6.2 12.6 6.6-9.4-3 21.3z"/><circle cx="9.6" cy="13.8" r="2.3"/><circle cx="16.4" cy="11" r="2.3"/><circle cx="22.5" cy="9" r="2.3"/><circle cx="28.6" cy="11" r="2.3"/><circle cx="35.4" cy="13.8" r="2.3"/>' + BASE + '<path class="d" d="M13.4 31.6h18.2" fill="none"/>',
  K: '<path d="M22.5 6v8M18.8 9.6h7.4" class="c" fill="none"/><path d="M13.2 36.9c-3.6-6.4-4.4-11.6-.6-15 3.4-3 7.6-1.2 9.9 2.8 2.3-4 6.5-5.8 9.9-2.8 3.8 3.4 3 8.6-.6 15z"/><path d="M22.5 15.4c1.6 2.4 1.6 5.6 0 9.4-1.6-3.8-1.6-7 0-9.4z"/>' + BASE + '<path class="d" d="M13.6 31.6h17.8" fill="none"/>',
};
export function pieceSVG(ch) {
  const white = ch === ch.toUpperCase();
  const t = ch.toUpperCase();
  return `<svg viewBox="0 0 45 45" class="g-echecs-svg ${white ? "w" : "b"}" aria-hidden="true">${SHAPES[t]}</svg>`;
}
const NAMES = { P: "pion", N: "cavalier", B: "fou", R: "tour", Q: "dame", K: "roi" };
const TYPE = { 1: "P", 2: "N", 3: "B", 4: "R", 5: "Q", 6: "K" };
const VALUE = { P: VAL[1], N: VAL[2], B: VAL[3], R: VAL[4], Q: VAL[5] };

export const scoreOf = (s, id) => {
  const side = s.order.indexOf(id);
  if (side < 0 || !s.lost) return null;
  if (s.v === "3echecs") return `${s.chk[side]}/3 échecs`;
  const pts = (str) => [...str].reduce((a, c) => a + Math.round(VALUE[c] / 100), 0);
  const d = pts(s.lost[1 - side]) - pts(s.lost[side]);
  return d > 0 ? `+${d}` : null;
};
export const scoreLabel = (v) => (v === 1 ? "1 point" : v === 0.5 ? "½ point" : "0 point");

export function mount(root, ctx0) {
  const el = h("div", { class: "g-echecs" });
  root.append(el);
  let ctx = ctx0, sel = null, promo = null, seen = -1, anim = false, lastUndo = 0;
  let movesEl = null;

  function update(c) {
    ctx = c;
    const s = ctx.state;
    const n = s.mv.length;
    if (n !== seen || (s.undone || 0) !== lastUndo) {
      anim = seen >= 0 && n === seen + 1;
      if (seen >= 0 && n !== seen) {
        const lastSan = s.san[n - 1] || "";
        if (lastSan.includes("x")) ctx.sfx.coin(); else ctx.sfx.card();
        if (lastSan.endsWith("+") && s.order[s.side] === ctx.me) ctx.buzz && ctx.buzz(40);
      }
      seen = n; lastUndo = s.undone || 0; sel = null; promo = null;
    } else anim = false;
    draw();
  }

  function myMoves(s) {
    if (!toAct(s).includes(ctx.me)) return [];
    return legalMoves(posOf(s));
  }
  // cases d'arrivée possibles depuis sel : case -> coup(s)
  function targets(s, moves) {
    const map = new Map();
    if (sel == null) return map;
    const add = (sq, m) => { if (!map.has(sq)) map.set(sq, []); map.get(sq).push(m); };
    for (const m of moves) {
      if (mFrom(m) !== sel) continue;
      if (mFlag(m) !== 3) add(mTo(m), m);
    }
    for (const m of moves) {
      if (mFrom(m) !== sel || mFlag(m) !== 3) continue;
      add(mTo(m), m); // la tour
      const kd = kingDest(m);
      if (s.v !== "960" && kd !== sel && !map.has(kd)) add(kd, m);
    }
    return map;
  }

  function tap(i, moves, tmap) {
    const s = ctx.state;
    if (promo) { promo = null; draw(); return; }
    const p = s.b[i];
    const own = p !== "." && ((p === p.toUpperCase()) === (s.side === 0));
    if (sel != null && tmap.has(i)) {
      const ms = tmap.get(i);
      if (ms.length > 1 && ms.every((m) => mPromo(m))) { promo = { from: sel, to: i }; ctx.sfx.tap(); draw(); return; }
      const m = ms[0];
      sel = null;
      ctx.act({ type: "move", from: mFrom(m), to: mTo(m) });
      return;
    }
    if (own && moves.some((m) => mFrom(m) === i)) { sel = sel === i ? null : i; ctx.sfx.tap(); draw(); return; }
    if (sel != null && !own) { ctx.sfx.bad(); ctx.toast && ctx.toast("Coup impossible"); }
    else if (own) ctx.toast && ctx.toast("Cette pièce ne peut pas bouger");
    sel = null; draw();
  }

  function playerRow(s, id, side, top) {
    const who = toAct(s);
    const captured = [...s.lost[1 - side]].sort((a, b) => VALUE[b] - VALUE[a]);
    const pts = (str) => [...str].reduce((a, c) => a + Math.round(VALUE[c] / 100), 0);
    const diff = pts(s.lost[1 - side]) - pts(s.lost[side]);
    const extra = [];
    if (s.v === "3echecs") extra.push(h("span", { class: "g-echecs-chk", title: "Échecs donnés" }, [0, 1, 2].map((k) => h("i", { class: k < s.chk[side] ? "on" : "" }))));
    if (s.undo > 0) extra.push(h("span", { class: "g-echecs-jok", title: "Retours restants" }, `↩ ${s.jok[id]}`));
    return h("div", { class: "g-echecs-pl" + (who[0] === id ? " on" : "") + (top ? " top" : "") },
      h("span", { class: "g-echecs-avatar", html: pieceSVG(side ? "k" : "K") }),
      h("div", { class: "grow g-echecs-plinfo" },
        h("div", { class: "g-echecs-name" }, id === ctx.me ? "Toi" : nameOf(ctx, id), h("span", { class: "dim" }, side ? " · Noirs" : " · Blancs")),
        h("div", { class: "g-echecs-caps" }, captured.map((c) => h("span", { class: "g-echecs-cap", html: pieceSVG(side ? c : c.toLowerCase()) })),
          diff > 0 ? h("b", { class: "g-echecs-diff" }, `+${diff}`) : null)),
      extra);
  }

  function draw() {
    const s = ctx.state;
    const who = toAct(s);
    const mine = who.includes(ctx.me);
    const meSide = s.order.indexOf(ctx.me);
    const flip = meSide === 1;
    const moves = mine ? myMoves(s) : [];
    const tmap = targets(s, moves);
    const showHints = s.hints !== false;
    const pos = posOf(s);
    const check = !s.end || s.end.why === "mat" ? inCheck(pos) : false;
    const kingSq = pos.kp[pos.side];
    const last = s.last || [];

    const board = h("div", { class: "g-echecs-board" + (s.v === "colline" ? " hill" : ""), role: "grid", "aria-label": "Échiquier" });
    for (let k = 0; k < 64; k++) {
      const i = flip ? 63 - k : k;
      const r = i >> 3, c = i & 7;
      const p = s.b[i];
      const cls = ["g-echecs-sq", (r + c) % 2 ? "dk" : "lt"];
      if (last[0] === i || last[1] === i) cls.push("last");
      if (sel === i) cls.push("sel");
      if (check && i === kingSq) cls.push("check");
      if (s.v === "colline" && HILL.includes(i)) cls.push("hillsq");
      if (showHints && tmap.has(i)) cls.push(p !== "." && !(mFlag(tmap.get(i)[0]) === 3) ? "cap" : "dot");
      if (mine && showHints && sel == null && p !== "." && moves.some((m) => mFrom(m) === i)) cls.push("can");
      let piece = null;
      if (p !== ".") {
        let style = null, pc = "g-echecs-pc";
        if (anim && i === last[1] && last[0] !== i) {
          const dr = (last[0] >> 3) - r, dc = (last[0] & 7) - c;
          style = `--dx:${flip ? -dc : dc};--dy:${flip ? -dr : dr}`;
          pc += " slide";
        }
        piece = h("span", { class: pc, style, html: pieceSVG(p) });
      }
      const coords = [];
      if (k % 8 === 0) coords.push(h("span", { class: "g-echecs-rk" }, String(8 - r)));
      if (k >= 56) coords.push(h("span", { class: "g-echecs-fl" }, "abcdefgh"[c]));
      const label = sqName(i) + (p !== "." ? ` : ${NAMES[p.toUpperCase()]} ${p === p.toUpperCase() ? "blanc" : "noir"}` : "");
      board.append(h("button", { class: cls.join(" "), "aria-label": label, onclick: () => tap(i, moves, tmap) }, coords, piece));
    }

    // fenêtre de promotion
    let promoEl = null;
    if (promo) {
      const white = s.side === 0;
      promoEl = h("div", { class: "g-echecs-promo", onclick: (e) => { if (e.target === promoEl) { promo = null; draw(); } } },
        h("div", { class: "g-echecs-promobox card glass" },
          h("div", { class: "h3 center" }, "Promotion : choisis ta pièce"),
          h("div", { class: "g-echecs-promorow" }, [5, 4, 3, 2].map((t) => {
            const ch = white ? TYPE[t] : TYPE[t].toLowerCase();
            return h("button", { class: "g-echecs-promobtn", "aria-label": NAMES[TYPE[t]],
              onclick: () => { const a = { type: "move", from: promo.from, to: promo.to, promo: t }; promo = null; sel = null; ctx.sfx.ok(); ctx.act(a); } },
              h("span", { html: pieceSVG(ch) }), h("small", null, NAMES[TYPE[t]]));
          }))));
    }

    // bandeau
    let head;
    if (s.end) {
      const w = s.end.winner;
      const txt = endText(s.end.why);
      head = h("div", { class: "turnmsg" + (w === ctx.me ? " me" : "") }, w ? `${txt} : ${w === ctx.me ? "tu gagnes !" : nameOf(ctx, w) + " gagne"}` : `${txt} : partie nulle`);
    } else if (mine) {
      head = h("div", { class: "turnmsg me" + (check ? " g-echecs-alert" : "") },
        check ? "Échec ! Protège ton roi" : sel != null ? "Touche la case d'arrivée" : `À toi, tu as les ${meSide ? "Noirs" : "Blancs"}`);
    } else {
      head = h("div", { class: "turnmsg" }, `${nameOf(ctx, who[0])} réfléchit…${check ? " (en échec)" : ""}`);
    }
    const goal = { colline: "Mat, ou ton roi sur une case dorée du centre : victoire.", "3echecs": "Le premier à donner 3 échecs gagne (le mat aussi).", "960": "Fischer 960 : pour roquer, touche ton roi puis ta tour." }[s.v];

    // coups joués
    const list = h("div", { class: "g-echecs-moves", "aria-label": "Coups joués" });
    if (!s.san.length) list.append(h("span", { class: "dim small" }, "Aucun coup pour l'instant"));
    for (let k = 0; k < s.san.length; k += 2) {
      list.append(h("span", { class: "g-echecs-mvn" }, `${k / 2 + 1}.`), h("span", { class: "g-echecs-mv" + (k === s.san.length - 1 ? " now" : "") }, s.san[k]),
        s.san[k + 1] ? h("span", { class: "g-echecs-mv" + (k + 1 === s.san.length - 1 ? " now" : "") }, s.san[k + 1]) : null);
    }
    movesEl = list;

    // actions
    const acts = [];
    if (!s.end && meSide >= 0) {
      if (s.undo > 0) acts.push(h("button", { class: "btn small ghost", disabled: !mine || !(s.jok[ctx.me] > 0) || s.mv.length < 2,
        onclick: () => { ctx.sfx.tap(); ctx.act({ type: "undo" }); } }, `↩ Retour (${s.jok[ctx.me]})`));
      acts.push(h("button", { class: "btn small ghost", onclick: async () => {
        if (await confirmBox("Abandonner la partie ? Ton adversaire gagnera.", { ok: "Abandonner", danger: true })) ctx.act({ type: "resign" });
      } }, "🏳 Abandonner"));
    }

    const topId = flip ? s.order[0] : s.order[1], botId = flip ? s.order[1] : s.order[0];
    el.replaceChildren(head,
      goal ? h("p", { class: "small dim center g-echecs-goal" }, goal) : null,
      playerRow(s, topId, s.order.indexOf(topId), true),
      h("div", { class: "g-echecs-wrap" }, board, promoEl),
      playerRow(s, botId, s.order.indexOf(botId), false),
      list,
      acts.length ? h("div", { class: "row gap center g-echecs-acts" }, acts) : null);
    requestAnimationFrame(() => { if (movesEl) movesEl.scrollLeft = movesEl.scrollWidth; });
  }

  update(ctx0);
  return { update, destroy() { el.remove(); } };
}
