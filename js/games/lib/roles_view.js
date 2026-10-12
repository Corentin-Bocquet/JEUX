// Affichage commun des jeux de rôles cachés (Loup-garou, Imposteur, Espion) :
// carte de rôle qui se retourne, chronomètre de phase, fil de discussion,
// grille de choix de joueurs. Styles : css/g/roles.css (importé par chaque jeu).
import { h } from "../../ui.js";
import { avatarHTML } from "../../avatar.js";

// nom d'un joueur : salon d'abord, sinon nom gardé dans l'état (robots ajoutés par le jeu)
export const who = (ctx, id) => (ctx.players[id] ? ctx.players[id].name : (ctx.state.names && ctx.state.names[id]) || "?");
export function avatar(ctx, id, size = 40) {
  const p = ctx.players[id];
  if (p) return h("span", { class: "g-rl-av", style: { width: size + "px", height: size + "px" }, html: avatarHTML(p, size) });
  return h("span", { class: "g-rl-av npc", style: { width: size + "px", height: size + "px", fontSize: Math.round(size * 0.55) + "px" } }, "🤖");
}

// ------------------------------------------------ carte de rôle (seul le joueur la voit)
export function roleCard() {
  let key = null, open = false;
  const front = h("div", { class: "g-rl-face g-rl-front" });
  const back = h("div", { class: "g-rl-face g-rl-back" }, h("div", { class: "g-rl-q" }, "?"), h("div", { class: "g-rl-tap" }, "Touche pour voir ta carte en secret"));
  const el = h("button", { class: "g-rl-card", "aria-label": "Retourner ma carte" }, h("div", { class: "g-rl-inner" }, back, front));
  el.addEventListener("click", () => { open = !open; el.classList.toggle("open", open); if (el._onflip) el._onflip(open); });
  return {
    el,
    set({ id, emoji, title, text, color, sub }) {
      if (id !== key) { key = id; open = false; el.classList.remove("open"); }
      el.style.setProperty("--rc", color || "#7C3AED");
      front.replaceChildren(h("div", { class: "g-rl-emo" }, emoji || "🃏"), h("div", { class: "g-rl-title" }, title), sub ? h("div", { class: "g-rl-sub" }, sub) : null, h("div", { class: "g-rl-text" }, text || ""), h("div", { class: "g-rl-tap" }, "Touche pour cacher"));
    },
    isOpen: () => open,
    onFlip(fn) { el._onflip = fn; },
  };
}

// ------------------------------------------------ chronomètre (fin de délai du moteur ou fin de manche)
export function chrono() {
  const el = h("span", { class: "g-rl-chrono" });
  let end = 0, label = "";
  const tick = () => {
    if (!end) { el.style.display = "none"; return; }
    const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    el.style.display = "";
    el.textContent = `⏱ ${label}${left >= 60 ? Math.floor(left / 60) + " min " + String(left % 60).padStart(2, "0") : left + " s"}`;
    el.classList.toggle("warn", left <= 10);
  };
  const t = setInterval(tick, 500);
  return { el, set(e, lbl = "") { end = e || 0; label = lbl; tick(); }, destroy() { clearInterval(t); } };
}

// ------------------------------------------------ fil de discussion
export function chatPanel({ max = 80, placeholder = "Ton message…", onSend }) {
  const log = h("div", { class: "g-rl-log" });
  const input = h("input", { class: "input g-rl-in", maxlength: max, placeholder, enterkeyhint: "send", autocomplete: "off" });
  const btn = h("button", { class: "btn green small g-rl-send", type: "submit" }, "Envoyer");
  const hint = h("div", { class: "g-rl-hint small dim" });
  const form = h("form", { class: "g-rl-form" }, input, btn);
  form.addEventListener("submit", (e) => { e.preventDefault(); const t = input.value.trim(); if (!t) return; onSend(t); input.value = ""; });
  const el = h("div", { class: "g-rl-chat" }, log, form, hint);
  let lastN = -1;
  return {
    el, input,
    // msgs : [{n, f, t, k}] ; render(m) -> {cls, from, text} ou null pour cacher
    set(ctx, msgs, { canSay = false, help = "", render } = {}) {
      const shown = msgs.map((m) => [m, render ? render(m) : { cls: m.k, from: m.f ? who(ctx, m.f) : "", text: m.t }]).filter((x) => x[1]);
      const n = shown.length ? shown[shown.length - 1][0].n : 0;
      if (n !== lastN) {
        log.replaceChildren(...(shown.length ? shown.map(([m, v]) => h("div", { class: "g-rl-msg " + (v.cls || "") + (m.f && m.f === ctx.me ? " mine" : "") },
          v.from ? h("b", null, v.from) : null, h("span", null, v.text))) : [h("div", { class: "g-rl-msg sys" }, h("span", null, "Le fil est vide pour l'instant."))]));
        log.scrollTop = log.scrollHeight;
        lastN = n;
      }
      form.style.display = canSay ? "" : "none";
      input.disabled = !canSay; btn.disabled = !canSay;
      hint.textContent = help;
    },
  };
}

// ------------------------------------------------ grille de choix de joueurs
// items : [{ id, sub, tag, off, mark }]
export function pickGrid(ctx, items, { selected, onPick, cls = "" } = {}) {
  return h("div", { class: "g-rl-grid " + cls }, items.map((it) => h("button", {
    class: "g-rl-pick" + (it.id === selected ? " sel" : "") + (it.dead ? " dead" : "") + (it.mark ? " " + it.mark : ""),
    disabled: it.off || !onPick, onclick: onPick ? () => onPick(it.id) : null,
  }, avatar(ctx, it.id, 38), h("span", { class: "g-rl-nm" }, who(ctx, it.id) + (it.id === ctx.me ? " (toi)" : "")),
  it.sub ? h("span", { class: "g-rl-sb" }, it.sub) : null, it.tag ? h("span", { class: "g-rl-tag" }, it.tag) : null)));
}

// bandeau de narration
export const banner = (emoji, title, text, tone = "") => h("div", { class: "g-rl-banner " + tone }, h("div", { class: "g-rl-bemo" }, emoji), h("div", null, h("div", { class: "g-rl-btitle" }, title), text ? h("div", { class: "g-rl-btext" }, text) : null));
