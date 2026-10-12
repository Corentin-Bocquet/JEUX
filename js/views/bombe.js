import { h } from "../ui.js";
import { nameOf } from "./common.js";
import { toAct, holder, deadline, roundStart, check, ALPHA } from "../games/bombe.js";
import { normWord } from "../data/dico.js";

export const scoreOf = (s, id) => "❤".repeat(Math.max(0, s.lives[id])) || "💀";
export const scoreLabel = (n) => `${n} mot${n > 1 ? "s" : ""}`;

const ROWS = ["AZERTYUIOP", "QSDFGHJKLM", "WXCVBN"];

const BOMB = `<svg viewBox="0 0 200 200" class="g-bombe-svg" aria-hidden="true">
  <path d="M128 52 C 140 30, 160 26, 172 18" stroke="#A16207" stroke-width="7" fill="none" stroke-linecap="round" class="g-bombe-fuse"/>
  <g class="g-bombe-spark"><circle cx="172" cy="18" r="9" fill="#FDE047"/><circle cx="172" cy="18" r="5" fill="#F97316"/></g>
  <rect x="104" y="44" width="34" height="22" rx="5" transform="rotate(35 121 55)" fill="#475569"/>
  <circle cx="96" cy="112" r="70" fill="url(#gbombeg)"/>
  <ellipse cx="70" cy="80" rx="18" ry="11" fill="#fff" opacity=".18" transform="rotate(-30 70 80)"/>
  <defs><radialGradient id="gbombeg" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#4B5563"/><stop offset="1" stop-color="#0B0F19"/></radialGradient></defs>
</svg>`;

export function mount(root, ctx0) {
  const el = h("div", { class: "g-bombe" });
  root.append(el);
  let ctx = ctx0, typed = "", lastTick = -1, sentBoom = -1, shake = false;
  const bombWrap = h("div", { class: "g-bombe-bomb", html: BOMB });
  const sylEl = h("div", { class: "g-bombe-syl" });
  bombWrap.append(sylEl);
  function update(c) {
    ctx = c;
    const s = c.state;
    if (s.tick !== lastTick) {
      if (lastTick >= 0 && s.last) {
        if (s.last.k === "ok") s.last.id === c.me ? c.sfx.ok() : c.sfx.card();
        else { c.sfx.bad(); c.buzz(80); bombWrap.classList.remove("boom"); void bombWrap.offsetWidth; bombWrap.classList.add("boom"); }
      }
      lastTick = s.tick; typed = "";
    }
    draw();
  }
  function draw() {
    const s = ctx.state, me = ctx.me;
    const hid = holder(s), mine = !s.done && hid === me;
    sylEl.textContent = s.syllable;
    const ring = h("div", { class: "g-bombe-ring" }, s.ids.map((id) => h("div", { class: "g-bombe-p" + (id === hid && !s.done ? " on" : "") + (s.lives[id] <= 0 ? " dead" : "") + (id === me ? " me" : "") },
      h("div", { class: "g-bombe-pn" }, id === hid && !s.done ? "💣 " : "", nameOf(ctx, id)),
      h("div", { class: "g-bombe-hearts" }, s.lives[id] > 0 ? "❤️".repeat(s.lives[id]) : "💀", h("span", { class: "dim" }, ` ${s.words[id]}`)))));
    let msg;
    if (s.done) msg = h("div", { class: "turnmsg me" }, "Partie terminée !");
    else if (mine) msg = h("div", { class: "turnmsg me" }, "À toi ! Un mot avec ", h("b", null, s.syllable));
    else msg = h("div", { class: "turnmsg" }, `${nameOf(ctx, hid)} cherche un mot avec ${s.syllable}…`);
    const L = s.last;
    const last = L ? h("div", { class: "g-bombe-last" + (L.k === "ok" ? "" : " bad") },
      L.k === "ok" ? [nameOf(ctx, L.id), " : ", hl(L.w, L.syl), L.bonus ? " · alphabet complet, +1 vie !" : ""]
        : [`💥 ${nameOf(ctx, L.id)} ${L.k === "pass" ? "sèche" : "n'a pas été assez rapide"} et perd une vie`]) : h("div", { class: "g-bombe-last dim" }, "La mèche est allumée…");
    const field = h("div", { class: "g-bombe-typed" + (mine ? " on" : "") + (shake ? " shake" : "") }, mine ? (typed ? hl(typed, s.syllable) : h("span", { class: "dim" }, "Tape ton mot")) : "");
    const kb = mine ? h("div", { class: "g-bombe-kb" }, ROWS.map((r, ri) => h("div", { class: "g-bombe-kr" },
      ri === 2 ? h("button", { class: "g-bombe-k wide", "aria-label": "Effacer", onclick: () => key("⌫") }, "⌫") : null,
      r.split("").map((c) => h("button", { class: "g-bombe-k", onclick: () => key(c) }, c)),
      ri === 2 ? h("button", { class: "g-bombe-k wide go", onclick: send }, "OK") : null))) : null;
    const alpha = s.alpha && s.lives[me] > 0 ? h("div", { class: "g-bombe-alpha", title: "Bonus alphabet" }, ALPHA.split("").map((c) => h("i", { class: (s.letters[me] || "").includes(c) ? "on" : "" }, c))) : null;
    el.replaceChildren(ring, msg, bombWrap, last, field, kb, alpha);
    tickAnim();
  }
  function hl(w, syl) {
    const i = w.indexOf(syl);
    if (i < 0) return w;
    return h("span", null, w.slice(0, i), h("b", { class: "g-bombe-hl" }, syl), w.slice(i + syl.length));
  }
  function key(c) {
    const s = ctx.state;
    if (s.done || holder(s) !== ctx.me) return;
    if (c === "⌫") typed = typed.slice(0, -1); else if (typed.length < 20) typed += c;
    ctx.sfx.tap();
    draw();
  }
  function send() {
    const s = ctx.state;
    const err = check(s, typed);
    if (err) { ctx.toast(err, "err"); ctx.sfx.bad(); shake = true; draw(); shake = false; return; }
    ctx.act({ type: "word", word: typed });
  }
  function tickAnim() {
    const s = ctx.state;
    if (s.done) { bombWrap.style.setProperty("--k", 1); return; }
    const now = Date.now();
    const el2 = Math.max(0, now - roundStart(s));
    const k = 1 + Math.min(1, el2 / 30000) * 0.35;
    bombWrap.style.setProperty("--k", k.toFixed(3));
    bombWrap.style.setProperty("--pulse", `${Math.max(0.25, 1.1 - el2 / 30000)}s`);
    // explosion constatée par le porteur (ou par l'hôte pour un robot)
    const hid = holder(s), p = ctx.players[hid];
    if (now > deadline(s) + 250 && sentBoom !== s.tick && (hid === ctx.me || (ctx.isHost && p && p.bot))) {
      sentBoom = s.tick;
      ctx.act({ type: "boom", tick: s.tick });
    }
  }
  const timer = setInterval(() => ctx && tickAnim(), 200);
  const phys = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || document.querySelector(".sheet-wrap") || e.target.tagName === "INPUT") return;
    if (e.key === "Enter") send();
    else if (e.key === "Backspace") key("⌫");
    else if (/^[a-zA-ZÀ-ÿ]$/.test(e.key)) key(normWord(e.key));
  };
  window.addEventListener("keydown", phys);
  update(ctx0);
  return { update, destroy() { clearInterval(timer); window.removeEventListener("keydown", phys); } };
}
