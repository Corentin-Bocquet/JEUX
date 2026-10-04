// Affichage commun des jeux de parcours (serpents, oie, petits chevaux) :
// plateau + calque de pions animés case par case, dés animés, bouton « Lancer le dé »,
// légende des joueurs (couleur + avatar). Chaque jeu fournit son plateau et ses coordonnées.
import { h } from "../../ui.js";
import { avatarHTML } from "../../avatar.js";
import { dieHTML, nameOf } from "../../views/common.js";
import { T } from "./parcours.js";

// spec : {
//   id, boardClass, buildBoard(boardEl, s),
//   pawns(s) -> [{ key, pid, pos }]       positions actuelles
//   xy(s, key, pos) -> [x%, y%]            centre d'une position sur le plateau
//   colorOf(s, pid) -> { c, d }
//   status(s, pid) -> texte court (légende)
//   pawnInner(ctx, s, pawn) -> chaîne HTML (avatar par défaut)
//   pickable(s, me) -> [clés de pions qu'on peut toucher] ; onPick(ctx, s, key)
//   prompt(s, me) -> texte quand c'est à moi
//   canRoll(s, me) -> bool ; diceCount(s)
// }
export function mountParcours(root, ctx0, spec) {
  injectCss();
  const P = "g-" + spec.id;
  const el = h("div", { class: `${P} g-pc` });
  root.append(el);
  const head = h("div", { class: "turnmsg" });
  const board = h("div", { class: `g-pc-board ${spec.boardClass || ""}` });
  const layer = h("div", { class: "g-pc-layer" });
  const diceRow = h("div", { class: "g-pc-dice" });
  const rollBtn = h("button", { class: "btn green g-pc-roll", onclick: onRoll }, "🎲 Lancer le dé");
  const wait = h("div", { class: "g-pc-wait small dim" });
  const msg = h("div", { class: "g-pc-msg small" });
  const legend = h("div", { class: "g-pc-legend" });
  const tray = h("div", { class: "g-pc-tray" }, diceRow, h("div", { class: "g-pc-act" }, rollBtn, wait));
  el.append(head, board, tray, msg, legend);
  spec.buildBoard(board, ctx0.state);
  board.append(layer);

  let ctx = ctx0, seen = null, shown = {}, disp = {}, busy = false, spinT = null;
  let dead = false, fast = false;
  let timers = [], queue = [], dice = [1, 1];
  const pawnEls = {};

  // ---------------- dés
  function drawDice(rolling) {
    const n = spec.diceCount(ctx.state);
    diceRow.innerHTML = Array.from({ length: n }, (_, i) => dieHTML(dice[i] || 1, { rolling })).join("");
  }
  function spin() {
    stopSpin();
    const n = spec.diceCount(ctx.state);
    diceRow.classList.add("spin");
    spinT = setInterval(() => { dice = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 6)); drawDice(false); }, 80);
  }
  function stopSpin() { if (spinT) clearInterval(spinT); spinT = null; diceRow.classList.remove("spin"); }

  function onRoll() {
    if (busy || !spec.canRoll(ctx.state, ctx.me)) return;
    ctx.sfx.tap();
    busy = true; spin(); ctx.sfx.dice(); render();
    Promise.resolve(ctx.act({ type: "roll" })).catch(() => {}).finally(() => { if (!queue.length && !timers.length) { stopSpin(); busy = false; render(); } });
  }

  // ---------------- pions
  function pawnEl(p) {
    let e = pawnEls[p.key];
    if (!e) {
      const col = spec.colorOf(ctx.state, p.pid);
      e = h("button", { class: "g-pc-pawn", style: `--pc:${col.c};--pd:${col.d}`, "aria-label": "Pion de " + nameOf(ctx, p.pid),
        html: spec.pawnInner ? spec.pawnInner(ctx, ctx.state, p) : `<span class="g-pc-av">${avatarHTML(ctx.players[p.pid] || {}, 30)}</span>`,
        onclick: () => { if (e.classList.contains("pick") && spec.onPick) { ctx.sfx.tap(); clearPick(); spec.onPick(ctx, ctx.state, p.key); } } });
      layer.append(e);
      pawnEls[p.key] = e;
    }
    return e;
  }
  function clearPick() { for (const e of Object.values(pawnEls)) e.classList.remove("pick"); }
  function layout(dur) {
    const s = ctx.state;
    const groups = {};
    const list = spec.pawns(s);
    for (const p of list) {
      const pos = p.key in shown ? shown[p.key] : p.pos;
      const [x, y] = spec.xy(s, p.key, pos);
      const g = x.toFixed(1) + "," + y.toFixed(1);
      (groups[g] = groups[g] || []).push({ p, x, y });
    }
    const off = spec.spread || 1.6;
    for (const g of Object.values(groups)) {
      g.forEach(({ p, x, y }, i) => {
        const e = pawnEl(p);
        let dx = 0, dy = 0;
        if (g.length > 1) { const a = (i / g.length) * Math.PI * 2 - Math.PI / 2; dx = Math.cos(a) * off; dy = Math.sin(a) * off; }
        disp[p.key] = p.key in shown ? shown[p.key] : p.pos;
        e.style.transitionDuration = dur + "ms";
        e.style.left = x + dx + "%";
        e.style.top = y + dy + "%";
        e.style.zIndex = String(Math.round(y * 10) + (p.pid === s.last?.pid ? 2000 : 0));
        e.classList.toggle("small", g.length > 2);
      });
    }
  }

  // ---------------- animation d'un coup
  function finish() {
    for (const t of timers) clearTimeout(t);
    timers = [];
    fast = true;
    const q = queue; queue = [];
    for (const f of q) f();
    fast = false;
  }
  function after(ms, fn) {
    queue.push(fn);
    timers.push(setTimeout(() => { if (dead) return; const i = queue.indexOf(fn); if (i >= 0) { queue.splice(i, 1); fn(); } }, ms));
  }
  function animate(last) {
    busy = true;
    let t = 0;
    if (last.dice && last.dice.length) {
      if (!spinT) { spin(); ctx.sfx.dice(); }
      t += T.die;
      after(t, () => { stopSpin(); dice = last.dice.slice(); drawDice(true); });
    } else stopSpin();
    for (const [key, pos, kind] of last.frames || []) {
      const d = kind === "s" ? T.step : T.jump;
      after(t, () => {
        shown[key] = pos; layout(d - 20);
        const e = pawnEls[key];
        if (e) { e.classList.remove("hop", "fly"); void e.offsetWidth; e.classList.add(kind === "s" ? "hop" : "fly"); }
        if (!fast) { if (kind === "s") ctx.sfx.tap(); else ctx.sfx.card(); }
      });
      t += d;
    }
    after(t, () => { shown = {}; busy = false; layout(150); render(); });
    render();
  }

  // ---------------- rendu
  function render() {
    const s = ctx.state;
    const who = s.winner ? [] : spec.toAct(s);
    const mine = who.includes(ctx.me);
    const cur = who[0];
    if (s.winner) { head.className = "turnmsg" + (s.winner === ctx.me ? " me" : ""); head.textContent = `${nameOf(ctx, s.winner)} a gagné !`; }
    else if (busy && s.last) { head.className = "turnmsg"; head.textContent = `${nameOf(ctx, s.last.pid)} joue…`; }
    else if (mine) { head.className = "turnmsg me"; head.textContent = spec.prompt(s, ctx.me); }
    else { head.className = "turnmsg"; head.textContent = `Au tour de ${nameOf(ctx, cur)}`; }
    const canRoll = !busy && mine && spec.canRoll(s, ctx.me);
    const showRoll = mine && spec.canRoll(s, ctx.me);
    rollBtn.style.display = showRoll ? "" : "none";
    rollBtn.disabled = !canRoll;
    wait.style.display = showRoll ? "none" : "";
    wait.textContent = busy ? "" : s.winner ? "Partie terminée" : mine ? "Touche un pion qui brille" : `${nameOf(ctx, cur)} ${spec.canRoll(s, cur) ? "va lancer le dé" : "choisit un pion"}…`;
    if (cur) { const c = spec.colorOf(s, cur); tray.style.setProperty("--pc", c.c); }
    msg.textContent = !busy && s.last ? s.last.msg : " ";
    // pions jouables
    clearPick();
    if (!busy && mine && spec.pickable) for (const k of spec.pickable(s, ctx.me)) pawnEls[k] && pawnEls[k].classList.add("pick");
    // légende
    legend.replaceChildren(...s.order.map((id) => {
      const c = spec.colorOf(s, id);
      return h("div", { class: "g-pc-chip" + (id === cur ? " on" : "") + (id === ctx.me ? " me" : ""), style: `--pc:${c.c};--pd:${c.d}` },
        h("span", { class: "g-pc-cav", html: avatarHTML(ctx.players[id] || {}, 30) }),
        h("span", { class: "g-pc-nm" }, h("b", null, nameOf(ctx, id)), h("small", null, spec.status(s, id))));
    }));
  }

  function update(c) {
    const s = c.state;
    if (seen === null) { ctx = c; seen = s.last ? s.last.n : 0; for (const p of spec.pawns(s)) pawnEl(p); drawDice(false); layout(0); render(); return; }
    if (s.last && s.last.n !== seen) {
      seen = s.last.n;
      finish();            // termine le coup précédent sur l'ancien état
      ctx = c;
      for (const p of spec.pawns(s)) pawnEl(p);
      shown = {};
      for (const p of spec.pawns(s)) shown[p.key] = p.key in disp ? disp[p.key] : p.pos;
      animate(s.last);
      return;
    }
    ctx = c;
    if (!busy) layout(150);
    render();
  }
  update(ctx0);
  return { update, destroy() { dead = true; for (const t of timers) clearTimeout(t); timers = []; queue = []; stopSpin(); } };
}

const CSS = `
.g-pc { max-width: 520px; margin: 0 auto; display: flex; flex-direction: column; gap: 10px; }
.g-pc-board { position: relative; width: 100%; border-radius: 22px; overflow: hidden; box-shadow: 0 6px 0 rgba(0,0,0,.25), 0 14px 28px rgba(0,0,0,.3); }
.g-pc-layer { position: absolute; inset: 0; pointer-events: none; }
.g-pc-pawn { position: absolute; width: var(--pw, 9%); aspect-ratio: 1; transform: translate(-50%, -62%); border-radius: 50%; padding: 0;
  background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--pc) 55%, #fff), var(--pc) 60%, var(--pd));
  border: 2.5px solid #fff; box-shadow: 0 3px 0 var(--pd), 0 6px 10px rgba(0,0,0,.45); transition-property: left, top; transition-timing-function: ease-in-out;
  display: grid; place-items: center; pointer-events: none; }
.g-pc-pawn.small { width: calc(var(--pw, 9%) * .78); }
.g-pc-pawn .g-pc-av { width: 82%; height: 82%; border-radius: 50%; overflow: hidden; display: grid; place-items: center; }
.g-pc-pawn .g-pc-av svg, .g-pc-pawn .g-pc-av img { width: 100%; height: 100%; display: block; }
.g-pc-pawn.hop { animation: gpcHop ${T.step}ms ease-out; }
.g-pc-pawn.fly { animation: gpcFly ${T.jump}ms ease-in-out; }
@keyframes gpcHop { 50% { transform: translate(-50%, -95%); } }
@keyframes gpcFly { 50% { transform: translate(-50%, -80%) scale(1.35); } }
.g-pc-pawn.pick { pointer-events: auto; cursor: pointer; animation: gpcPick 0.9s ease-in-out infinite; box-shadow: 0 0 0 4px #FFE066, 0 0 18px #FFE066, 0 6px 10px rgba(0,0,0,.45); z-index: 5000 !important; }
.g-pc-pawn.pick::after { content: ""; position: absolute; inset: -40%; }
@keyframes gpcPick { 50% { transform: translate(-50%, -78%) scale(1.15); } }
.g-pc-tray { display: flex; align-items: center; justify-content: center; gap: 16px; padding: 12px; border-radius: 22px; min-height: 92px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--pc, var(--green)) 26%, var(--card)), var(--card)); border: 2px solid color-mix(in srgb, var(--pc, var(--line)) 60%, var(--line)); transition: background .3s; }
.g-pc-dice { display: flex; gap: 10px; }
.g-pc-dice .die { width: 60px; height: 60px; }
.g-pc-dice.spin .die { animation: gpcShake .16s linear infinite; }
@keyframes gpcShake { 25% { transform: rotate(-14deg) translateY(-4px); } 75% { transform: rotate(12deg) translateY(2px); } }
.g-pc-act { display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 150px; }
.g-pc-roll { min-height: 54px; font-size: 18px; padding: 0 20px; }
.g-pc-roll:not(:disabled) { animation: gpcGlow 1.4s ease-in-out infinite; }
@keyframes gpcGlow { 50% { transform: scale(1.05); } }
.g-pc-wait { text-align: center; max-width: 170px; }
.g-pc-msg { text-align: center; min-height: 36px; color: var(--txt); line-height: 1.35; padding: 0 6px; }
.g-pc-legend { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
.g-pc-chip { display: flex; align-items: center; gap: 8px; padding: 6px 10px 6px 6px; border-radius: 18px; background: var(--card); border: 2px solid var(--line); min-width: 0; transition: transform .2s, border-color .2s; }
.g-pc-chip.on { border-color: var(--pc); box-shadow: 0 0 0 2px var(--pc); transform: translateY(-2px); }
.g-pc-cav { width: 36px; height: 36px; flex: 0 0 36px; border-radius: 50%; overflow: hidden; border: 3px solid var(--pc); display: grid; place-items: center; background: var(--card2); }
.g-pc-cav svg, .g-pc-cav img { width: 100%; height: 100%; display: block; }
.g-pc-nm { display: flex; flex-direction: column; min-width: 0; line-height: 1.15; }
.g-pc-nm b { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.g-pc-nm small { font-size: 12px; color: var(--dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@media (prefers-reduced-motion: reduce) { .g-pc-pawn, .g-pc-pawn.hop, .g-pc-pawn.fly, .g-pc-roll { animation: none !important; } }
`;
function injectCss() {
  if (typeof document === "undefined" || document.querySelector("style[data-g=parcours]")) return;
  const st = document.createElement("style");
  st.dataset.g = "parcours";
  st.textContent = CSS;
  document.head.append(st);
}
