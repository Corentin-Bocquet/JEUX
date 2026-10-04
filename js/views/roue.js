import { h, sheet } from "../ui.js";
import { turnLine, nameOf } from "./common.js";
import { toAct, wheelOf, base, hiddenLeft, CONSONANTS, VOWELS } from "../games/roue.js";

export const scoreOf = (s, id) => s.total[id];
export const scoreLabel = (v) => `${v} pts`;

const COLORS = ["#F59E0B", "#3B82F6", "#EF4444", "#10B981", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316"];
const W = 15;
const SVGNS = "http://www.w3.org/2000/svg";

// découpe l'énigme en lignes de 15 cases au plus (coupure aux espaces, puis aux traits d'union)
export function layout(text) {
  const words = [];
  for (const w of text.split(" ")) {
    if (w.length <= W) { words.push(w); continue; }
    const parts = w.split("-");
    parts.forEach((p, i) => words.push(i < parts.length - 1 ? p + "-" : p));
  }
  const lines = [];
  let cur = "";
  for (const w of words) {
    const glue = cur && !cur.endsWith("-") ? " " : "";
    if (cur && (cur + glue + w).length > W) { lines.push(cur); cur = w; } else cur += glue + w;
  }
  if (cur) lines.push(cur);
  return lines;
}

function wheelSVG(seg) {
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("viewBox", "-160 -160 320 320");
  svg.setAttribute("class", "g-roue-svg");
  const R = 150, n = seg.length, step = 360 / n;
  let html = `<circle r="156" fill="#3B2A0A"/>`;
  seg.forEach((v, k) => {
    const a0 = (k * step - 90) * Math.PI / 180, a1 = ((k + 1) * step - 90) * Math.PI / 180;
    const x0 = R * Math.cos(a0), y0 = R * Math.sin(a0), x1 = R * Math.cos(a1), y1 = R * Math.sin(a1);
    const fill = v === "B" ? "#111827" : v === "P" ? "#F8FAFC" : COLORS[k % COLORS.length];
    const txt = v === "B" ? "BANQUEROUTE" : v === "P" ? "PASSE" : String(v);
    const col = v === "P" ? "#111827" : "#fff";
    const fs = v === "B" ? 10 : v === "P" ? 13 : 17;
    html += `<path d="M0 0L${x0.toFixed(2)} ${y0.toFixed(2)}A${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}Z" fill="${fill}" stroke="#FDE68A" stroke-width="1.5"/>`;
    html += `<text transform="rotate(${k * step + step / 2}) translate(0 -${R - 10}) rotate(90)" fill="${col}" font-size="${fs}" font-weight="800" text-anchor="start" dominant-baseline="central" font-family="system-ui,sans-serif">${txt}</text>`;
  });
  for (let k = 0; k < n; k++) { const a = (k * step - 90) * Math.PI / 180; html += `<circle cx="${(153 * Math.cos(a)).toFixed(1)}" cy="${(153 * Math.sin(a)).toFixed(1)}" r="2.6" fill="#FDE68A"/>`; }
  html += `<circle r="26" fill="#FDE68A" stroke="#B45309" stroke-width="4"/><text y="1" font-size="20" text-anchor="middle" dominant-baseline="central">🎡</text>`;
  svg.innerHTML = html;
  return svg;
}

export function mount(root, ctx0) {
  const el = h("div", { class: "g-roue" });
  root.append(el);
  let ctx = ctx0, rot = 0, spinNo = ctx0.state.spinNo, spinning = false, spinT = null, banner = null, bannerT = null;
  let lastManche = ctx0.state.manche, lastLog = null, vowelOpen = false;
  const wheelBox = h("div", { class: "g-roue-wheel" });
  let svg = null, wheelKey = null;
  const pointer = h("div", { class: "g-roue-ptr" });
  wheelBox.append(pointer);

  function ensureWheel(s) {
    const key = s.wheel;
    if (key === wheelKey) return;
    if (svg) svg.remove();
    svg = wheelSVG(wheelOf(s)); wheelKey = key;
    wheelBox.prepend(svg);
    if (s.seg >= 0) { rot = -(s.seg * 15 + 7.5); svg.style.transform = `rotate(${rot}deg)`; }
  }
  function animate(s) {
    const target = -(s.seg * 15 + 7.5) + (Math.random() * 8 - 4);
    let d = (target - rot) % 360; if (d < 0) d += 360;
    rot += 360 * 4 + d;
    spinning = true;
    svg.classList.add("spin");
    requestAnimationFrame(() => { svg.style.transform = `rotate(${rot}deg)`; });
    ctx.sfx.roll && ctx.sfx.roll();
    clearTimeout(spinT);
    spinT = setTimeout(() => {
      spinning = false; svg.classList.remove("spin");
      const v = wheelOf(ctx.state)[s.seg];
      if (v === "B") ctx.sfx.bad(); else if (v === "P") ctx.sfx.tap(); else ctx.sfx.coin();
      draw();
    }, 2900);
  }

  function board(s) {
    const lines = layout(s.text);
    const isNew = s.log && (s.log.t === "letter" || s.log.t === "vowel") ? s.log.l : null;
    return h("div", { class: "g-roue-board" }, lines.map((ln) => h("div", { class: "g-roue-line" }, [...ln].map((ch) => {
      const b = base(ch);
      if (ch === " ") return h("span", { class: "g-roue-c sp" });
      if (!b) return h("span", { class: "g-roue-c pun" }, ch);
      const shown = s.called.includes(b) && !(spinning && b === isNew);
      return h("span", { class: "g-roue-c" + (shown ? " on" : "") + (shown && b === isNew ? " new" : "") }, shown ? ch.toUpperCase() : "");
    }))));
  }

  function logText(s) {
    const l = s.log;
    if (!l) return `${nameOf(ctx, s.order[s.cur])} commence la manche.`;
    const n = nameOf(ctx, l.id);
    switch (l.t) {
      case "spin": return `${n} tombe sur ${l.v} : une consonne ?`;
      case "bank": return `Banqueroute pour ${n}${l.lost ? ` (−${l.lost})` : ""} !`;
      case "passe": return `${n} tombe sur Passe.`;
      case "letter": return l.n ? `${l.n} ${l.l} ! +${l.gain} pour ${n}` : `Pas de ${l.l}. Au suivant !`;
      case "dup": return `${l.l} était déjà proposée. Au suivant !`;
      case "vowel": return l.n ? `${n} achète un ${l.l} : ${l.n} trouvé${l.n > 1 ? "s" : ""}` : `Pas de ${l.l}. Au suivant !`;
      case "wrong": return `${n} propose « ${l.text} » : raté !`;
      case "win": return `${n} gagne la manche (+${l.gain})`;
    }
    return "";
  }

  function solveSheet() {
    const s = ctx.state;
    const inp = h("input", { class: "input", placeholder: "Ta réponse", autocomplete: "off", autocapitalize: "off", spellcheck: "false" });
    const go = () => { const t = inp.value.trim(); if (!t) return; sh.close(); ctx.act({ type: "solve", text: t }); };
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    const sh = sheet(h("div", { class: "stack" }, h("p", { class: "small dim" }, `Catégorie : ${s.cat}. Les accents et la ponctuation ne comptent pas.`), inp,
      h("button", { class: "btn green block", onclick: go }, "Valider ma réponse")), { title: "Résoudre l'énigme" });
    setTimeout(() => inp.focus(), 50);
  }

  function controls(s, mine) {
    if (!mine || s.over) return null;
    if (spinning) return h("div", { class: "g-roue-ctl" }, h("div", { class: "small dim center" }, "La roue tourne…"));
    if (s.phase === "letter") {
      const v = wheelOf(s)[s.seg];
      return h("div", { class: "g-roue-ctl" }, h("div", { class: "small center" }, `Une consonne pour `, h("b", null, `${v}`), ` par lettre`),
        h("div", { class: "g-roue-keys" }, [...CONSONANTS].map((c) => h("button", { class: "g-roue-k", disabled: s.called.includes(c), onclick: () => { ctx.sfx.tap(); ctx.act({ type: "letter", l: c }); } }, c))));
    }
    const consLeft = hiddenLeft(s, CONSONANTS).length > 0;
    const canV = s.bank[ctx.me] >= s.vowel;
    return h("div", { class: "g-roue-ctl" },
      !consLeft ? h("div", { class: "small center g-roue-warn" }, "Plus de consonnes cachées : voyelle ou réponse !") : null,
      h("div", { class: "g-roue-btns" },
        h("button", { class: "btn gold grow", disabled: !consLeft, onclick: () => { ctx.sfx.tap(); ctx.act({ type: "spin" }); } }, "🎡 Tourner"),
        h("button", { class: "btn purple", disabled: !canV, onclick: () => { vowelOpen = !vowelOpen; draw(); } }, `Voyelle ${s.vowel}`),
        h("button", { class: "btn green", onclick: solveSheet }, "Résoudre")),
      vowelOpen && canV ? h("div", { class: "g-roue-keys v" }, [...VOWELS].map((c) => h("button", { class: "g-roue-k", disabled: s.called.includes(c),
        onclick: () => { vowelOpen = false; ctx.sfx.tap(); ctx.act({ type: "vowel", l: c }); } }, c))) : null);
  }

  function draw() {
    const s = ctx.state;
    ensureWheel(s);
    const who = toAct(s), mine = who.includes(ctx.me) && !spinning;
    const banks = h("div", { class: "g-roue-banks" }, s.order.map((id) => h("div", { class: "g-roue-bank" + (who.includes(id) ? " turn" : "") + (id === ctx.me ? " me" : "") },
      h("span", { class: "small" }, nameOf(ctx, id)), h("b", null, s.bank[id]), h("span", { class: "dim small" }, `total ${s.total[id]}`))));
    let head;
    if (s.over) head = h("div", { class: "turnmsg me" }, "Partie terminée !");
    else if (spinning) head = h("div", { class: "turnmsg" }, "La roue tourne…");
    else head = turnLine(ctx, who, s.phase === "letter" ? "À toi : choisis une consonne" : "À toi : tourne, achète une voyelle ou résous");
    const called = h("div", { class: "g-roue-called" }, [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map((c) => h("span", { class: s.called.includes(c) ? "on" : "" }, c)));
    el.replaceChildren(
      h("div", { class: "row between small g-roue-top" }, h("span", { class: "chip" }, `Manche ${s.manche} / ${s.rounds}`), h("span", { class: "g-roue-cat" }, s.cat)),
      banner ? h("div", { class: "g-roue-banner" }, banner) : null,
      board(s),
      h("div", { class: "small center g-roue-log" }, spinning ? "…" : logText(s)),
      head,
      h("div", { class: "g-roue-mid" }, wheelBox),
      controls(s, mine),
      banks,
      s.over ? null : called);
  }

  function update(c) {
    ctx = c;
    const s = c.state;
    ensureWheel(s);
    if (s.manche !== lastManche || (s.over && s.last && !banner)) {
      lastManche = s.manche;
      if (s.last) {
        banner = `${nameOf(ctx, s.last.id)} a trouvé : « ${s.last.text} » (+${s.last.gain})`;
        ctx.sfx.win(); clearTimeout(bannerT);
        if (!s.over) bannerT = setTimeout(() => { banner = null; draw(); }, 6000);
      }
    }
    const lk = JSON.stringify(s.log);
    if (lk !== lastLog) {
      lastLog = lk;
      if (s.log && s.log.t === "letter") (s.log.n ? ctx.sfx.ok() : ctx.sfx.bad());
      if (s.log && (s.log.t === "wrong" || (s.log.t === "vowel" && !s.log.n))) ctx.sfx.bad();
    }
    if (s.spinNo !== spinNo) { spinNo = s.spinNo; if (s.seg >= 0) animate(s); }
    draw();
  }
  update(ctx0);
  return { update, destroy() { clearTimeout(spinT); clearTimeout(bannerT); } };
}
