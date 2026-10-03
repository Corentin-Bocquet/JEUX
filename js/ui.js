// Briques d'interface : création d'éléments, icônes verre liquide, toasts,
// fenêtres, sons et confettis. Aucune dépendance.

// replaceChildren et append ignorent les valeurs vides (sinon le navigateur écrit « null »)
for (const m of ["replaceChildren", "append"]) {
  const orig = Element.prototype[m];
  Element.prototype[m] = function (...kids) { return orig.apply(this, kids.flat(Infinity).filter((k) => k != null && k !== false && k !== "")); };
}

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k === "html") el.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, v);
  }
  add(el, kids);
  return el;
}
function add(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const svgEl = (markup) => { const t = document.createElement("template"); t.innerHTML = markup.trim(); return t.content.firstChild; };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const fmt = (n) => Number(n || 0).toLocaleString("fr-FR");

// ------------------------------------------------ icônes verre liquide
// glyphe clair (dégradé blanc vers lavande), détails sombres, posé sur une tuile de verre colorée
const W = 'fill="url(#jgw)"', D = 'fill="#1C1C48" fill-opacity=".72"';
const WS = 'stroke="url(#jgw)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"';
const DS = 'stroke="#1C1C48" stroke-opacity=".72" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"';
export const GL = {
  jouer: `<path d="M7.5 7.2h9a5.3 5.3 0 0 1 5.2 6.3l-.9 4.6a2.7 2.7 0 0 1-4.6 1.3l-2-2.1h-4.4l-2 2.1a2.7 2.7 0 0 1-4.6-1.3l-.9-4.6a5.3 5.3 0 0 1 5.2-6.3z" ${W}/><path d="M7.6 10.5v3.4M5.9 12.2h3.4" ${DS}/><circle cx="16.2" cy="11" r="1.1" ${D}/><circle cx="18" cy="13.3" r="1.1" ${D}/>`,
  amis: `<circle cx="9" cy="8" r="3.6" ${W}/><path d="M2.4 19.8a6.6 6.6 0 0 1 13.2 0z" ${W}/><circle cx="16.6" cy="9" r="2.9" ${W} opacity=".6"/><path d="M15.4 13.3a5.4 5.4 0 0 1 6.4 5.3v1.2h-4.6" ${W} opacity=".6"/>`,
  classement: `<path d="M7.3 5.4H4.6a2.6 2.6 0 0 0 3 3.9M16.7 5.4h2.7a2.6 2.6 0 0 1-3 3.9" ${WS}/><path d="M7 3h10v5.6a5 5 0 0 1-10 0z" ${W}/><path d="M10.9 13.4h2.2v3.4h-2.2z" ${W}/><path d="M7.6 20.8a2.3 2.3 0 0 1 2.3-2.3h4.2a2.3 2.3 0 0 1 2.3 2.3v.7H7.6z" ${W}/><path d="m12 5.3.8 1.6 1.8.3-1.3 1.2.3 1.8-1.6-.9-1.6.9.3-1.8-1.3-1.2 1.8-.3z" ${D}/>`,
  boutique: `<path d="M6.6 3.5h10.8L21.5 9 12 21 2.5 9z" ${W}/><path d="M2.8 9h18.4M8.4 9 12 20.4 15.6 9M6.6 3.5 8.4 9 12 3.5 15.6 9l1.8-5.5" ${DS} stroke-width="1.2"/>`,
  profil: `<circle cx="12" cy="7.8" r="4.4" ${W}/><path d="M3.6 21a8.4 8.4 0 0 1 16.8 0z" ${W}/>`,
  robot: `<rect x="4" y="7" width="16" height="12" rx="4" ${W}/><path d="M12 3v4" ${WS}/><circle cx="12" cy="2.8" r="1.6" ${W}/><circle cx="9" cy="12.6" r="1.6" ${D}/><circle cx="15" cy="12.6" r="1.6" ${D}/><path d="M9.5 16.2h5" ${DS}/>`,
  salon: `<path d="M3 10.5 12 4l9 6.5" ${WS}/><path d="M5 10v9.5h14V10" ${W}/><circle cx="9.5" cy="14.2" r="1.7" ${D}/><circle cx="14.5" cy="14.2" r="1.7" ${D}/>`,
  code: `<rect x="2.5" y="6" width="19" height="12" rx="3" ${W}/><path d="M6.5 12h0M10 12h0M13.5 12h0M17 12h0" ${DS} stroke-width="2.6"/>`,
  coffre: `<path d="M3 10a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v1H3z" ${W} opacity=".75"/><rect x="3" y="11" width="18" height="9" rx="2" ${W}/><rect x="10" y="9" width="4" height="5" rx="1.2" ${D}/>`,
  gemme: `<path d="M6.6 3.5h10.8L21.5 9 12 21 2.5 9z" ${W}/><path d="M2.8 9h18.4M8.4 9 12 20.4 15.6 9" ${DS} stroke-width="1.2"/>`,
  envoyer: `<path d="M3 11.5 20.5 4 14 21l-3-7z" ${W}/><path d="m11 14 9.5-10" ${DS} stroke-width="1.4"/>`,
  partager: `<circle cx="18" cy="5.5" r="3" ${W}/><circle cx="6" cy="12" r="3" ${W}/><circle cx="18" cy="18.5" r="3" ${W}/><path d="m8.6 10.6 6.8-3.7M8.6 13.4l6.8 3.7" ${WS} stroke-width="1.8"/>`,
  reglages: `<circle cx="12" cy="12" r="8.5" ${W}/><circle cx="12" cy="12" r="3" ${D}/>`,
  quitter: `<path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14" ${WS}/><path d="M4 12h10M8.5 7.5 4 12l4.5 4.5" ${WS}/>`,
  retour: `<path d="M15 4.5 7.5 12l7.5 7.5" ${WS} stroke-width="2.8"/>`,
  plus: `<path d="M12 5v14M5 12h14" ${WS} stroke-width="2.8"/>`,
  ok: `<path d="m5 12.5 4.6 4.6L19.5 7" ${WS} stroke-width="2.8"/>`,
  croix: `<path d="M6 6l12 12M18 6 6 18" ${WS} stroke-width="2.8"/>`,
  photo: `<path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h2l1.6-2h5.8l1.6 2h2A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z" ${W}/><circle cx="12" cy="13" r="3.6" ${D}/>`,
  crayon: `<path d="M4 20l1-4.4L15.6 5a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.4 19z" ${W}/><path d="m13.8 6.8 3.4 3.4" ${DS}/>`,
  son: `<path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z" ${W}/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" ${WS} stroke-width="1.8"/>`,
  lune: `<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z" ${W}/>`,
  soleil: `<circle cx="12" cy="12" r="4.6" ${W}/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M5.3 18.7 7 17M17 7l1.7-1.7" ${WS} stroke-width="1.9"/>`,
  systeme: `<rect x="3" y="4" width="18" height="12.5" rx="2.4" ${W}/><path d="M9 20.5h6M12 16.5v4" ${WS}/>`,
  feu: `<path d="M12 2.5c1.2 3.4 5.6 5.4 5.6 10.6A5.6 5.6 0 0 1 12 21a5.6 5.6 0 0 1-5.6-5.6c0-3 1.6-4.6 2.6-6.2.4 1.6 1.4 2.4 2.2 2.6-.4-3.2.2-6.6.8-9.3z" ${W}/>`,
  chrono: `<circle cx="12" cy="13.5" r="7.8" ${W}/><path d="M12 13.5V9.4M12 13.5l2.6 1.6" ${DS} stroke-width="2"/><path d="M9.6 2.6h4.8" ${WS}/>`,
  info: `<circle cx="12" cy="12" r="9.2" ${W}/><path d="M12 11v5.5" ${DS} stroke-width="2.4"/><circle cx="12" cy="7.6" r="1.4" ${D}/>`,
  // jeux
  poker: `<path d="M12 3.2c3.4 3.6 7.6 6 7.6 9.4a3.8 3.8 0 0 1-6.3 2.9l1 3.7H9.7l1-3.7a3.8 3.8 0 0 1-6.3-2.9C4.4 9.2 8.6 6.8 12 3.2z" ${W}/>`,
  blackjack: `<rect x="3" y="5" width="11" height="15" rx="2.2" ${W} opacity=".6" transform="rotate(-10 8 12)"/><rect x="9" y="4" width="11" height="15.5" rx="2.2" ${W}/><path d="M12.4 9.2h1.8l-1.8 2.7h1.9M15.6 9.2v2.7" ${DS} stroke-width="1.5"/><path d="M14.5 14.8c.9-1 2.3-1 2.3.3 0 1-1.2 1.5-2.3 2.4-1.1-.9-2.3-1.4-2.3-2.4 0-1.3 1.4-1.3 2.3-.3z" ${D}/>`,
  bowling: `<path d="M8 2.6c1.6 0 2.4 1.2 2.4 2.6 0 1.2-.6 2-.9 3 1.4 1.8 2.3 4.2 2.3 6.8 0 3-1 5.4-1.6 6.4H6c-.6-1-1.6-3.4-1.6-6.4 0-2.6.9-5 2.3-6.8-.3-1-.9-1.8-.9-3C5.8 3.8 6.4 2.6 8 2.6z" ${W} opacity=".7"/><circle cx="15.6" cy="15.4" r="5.8" ${W}/><circle cx="14.2" cy="13.4" r=".95" ${D}/><circle cx="16.6" cy="12.8" r=".95" ${D}/><circle cx="16.4" cy="15.2" r=".95" ${D}/>`,
  sudoku: `<rect x="3" y="3" width="18" height="18" rx="3.5" ${W}/><path d="M9 3.6v16.8M15 3.6v16.8M3.6 9h16.8M3.6 15h16.8" ${DS} stroke-width="1.2"/><path d="M5.4 5.6h1.4v2.2M17 10.6h1.4l-1.4 2.6h1.6" ${DS} stroke-width="1.2"/>`,
  fleches: `<rect x="3" y="3" width="18" height="18" rx="3.5" ${W}/><rect x="3.8" y="3.8" width="7.6" height="7.6" rx="1.6" ${D} opacity=".55"/><path d="M13.5 7.6h5.3M16.6 5.4l2.2 2.2-2.2 2.2M7.6 13.5v5.3M5.4 16.6l2.2 2.2 2.2-2.2" ${DS} stroke-width="1.6"/>`,
  motus: `<rect x="2.5" y="7" width="5.6" height="10" rx="1.6" ${W}/><rect x="9.2" y="7" width="5.6" height="10" rx="1.6" ${W} opacity=".75"/><rect x="15.9" y="7" width="5.6" height="10" rx="1.6" ${W} opacity=".5"/><path d="M4 9.6l1.3 4.8 1.3-4.8M10.6 14.4V9.6h1.4c1.2 0 1.2 2.4 0 2.4h-1.4" ${DS} stroke-width="1.2"/>`,
  motsmeles: `<rect x="3" y="3" width="13.5" height="13.5" rx="3" ${W}/><path d="M6.2 6.4l7 7" stroke="#1C1C48" stroke-opacity=".5" stroke-width="2.8" stroke-linecap="round"/><circle cx="16" cy="16" r="4.4" fill="none" stroke="url(#jgw)" stroke-width="2.4"/><path d="m19.2 19.2 2.4 2.4" ${WS} stroke-width="2.6"/>`,
  yams: `<rect x="2.5" y="8" width="11" height="11" rx="2.6" ${W} opacity=".7" transform="rotate(-12 8 13.5)"/><rect x="10" y="4" width="11.5" height="11.5" rx="2.6" ${W}/><circle cx="13" cy="7" r="1" ${D}/><circle cx="15.75" cy="9.75" r="1" ${D}/><circle cx="18.5" cy="12.5" r="1" ${D}/><circle cx="6.2" cy="12.5" r=".9" ${D}/><circle cx="9.6" cy="15.2" r=".9" ${D}/>`,
  puissance4: `<rect x="2.5" y="5" width="19" height="15" rx="3" ${W}/><circle cx="7.3" cy="9.8" r="1.8" ${D}/><circle cx="12" cy="9.8" r="1.8" ${D} opacity=".35"/><circle cx="16.7" cy="9.8" r="1.8" ${D} opacity=".35"/><circle cx="7.3" cy="15.2" r="1.8" ${D}/><circle cx="12" cy="15.2" r="1.8" ${D}/><circle cx="16.7" cy="15.2" r="1.8" ${D} opacity=".35"/>`,
  dames: `<ellipse cx="12" cy="15.6" rx="8.6" ry="4.2" ${W} opacity=".6"/><ellipse cx="12" cy="11.6" rx="8.6" ry="4.2" ${W}/><ellipse cx="12" cy="11.6" rx="5" ry="2.3" fill="none" ${DS} stroke-width="1.3"/>`,
  bataille: `<path d="M2.5 14.5h19l-2.6 4.6H5.4z" ${W}/><path d="M7 14.5V10h7.5v4.5M10.6 10V6.5h2.2V10" ${W} opacity=".8"/><path d="M17 4.5v10" ${WS} stroke-width="1.6"/><path d="M17 5.2l3.4 1.6-3.4 1.6" ${W}/>`,
  huit: `<rect x="5" y="3" width="14" height="18" rx="2.6" ${W}/><circle cx="12" cy="9.2" r="2.4" fill="none" ${DS} stroke-width="1.8"/><circle cx="12" cy="14.6" r="2.9" fill="none" ${DS} stroke-width="1.8"/>`,
};

export function glyph(name, size = 24) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${GL[name] || GL.plus}</svg>`;
}
export function tile(name, size = 44, color = "#6C5CE7") {
  const span = h("span", { class: "gtile", style: `--gc:${color};width:${size}px;height:${size}px` });
  span.innerHTML = glyph(name, Math.round(size * 0.6));
  return span;
}
export const icon = (name, size = 22) => { const s = h("span", { class: "gico" }); s.innerHTML = glyph(name, size); return s; };

// pierre précieuse colorée (compteur de gemmes)
export const GEM = (s = 20) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><path d="M6.6 3.5h10.8L21.5 9 12 21 2.5 9z" fill="url(#jgem)"/><path d="M2.8 9h18.4M8.4 9 12 20.4 15.6 9M6.6 3.5 8.4 9 12 3.5 15.6 9l1.8-5.5" stroke="#fff" stroke-opacity=".55" stroke-width="1" fill="none" stroke-linejoin="round"/></svg>`;
export const gem = (s) => { const e = h("span", { class: "gem" }); e.innerHTML = GEM(s); return e; };

export function installDefs() {
  if (document.getElementById("jdefs")) return;
  document.body.insertAdjacentHTML("afterbegin", `<svg id="jdefs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <linearGradient id="jgw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#D9D4FF"/></linearGradient>
    <linearGradient id="jgem" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9BE7FF"/><stop offset=".5" stop-color="#1CB0F6"/><stop offset="1" stop-color="#1158C9"/></linearGradient>
  </defs></svg>`);
}

// ------------------------------------------------ toasts et fenêtres
let toastBox;
export function toast(msg, kind = "") {
  if (!toastBox) { toastBox = h("div", { class: "toasts", role: "status", "aria-live": "polite" }); document.body.append(toastBox); }
  const t = h("div", { class: "toast glass " + kind }, msg);
  toastBox.append(t);
  setTimeout(() => t.classList.add("out"), 2600);
  setTimeout(() => t.remove(), 3000);
  if (kind === "err") buzz(30);
}

export function sheet(content, { title, onClose, wide } = {}) {
  const close = () => { wrap.classList.add("out"); setTimeout(() => wrap.remove(), 220); onClose && onClose(); document.removeEventListener("keydown", key); };
  const key = (e) => { if (e.key === "Escape") close(); };
  const panel = h("div", { class: "sheet glass" + (wide ? " wide" : ""), role: "dialog", "aria-modal": "true", "aria-label": title || "Fenêtre" },
    h("div", { class: "sheet-grip" }),
    title ? h("div", { class: "sheet-head" }, h("h2", { class: "h2" }, title), h("button", { class: "iconbtn", "aria-label": "Fermer", onclick: () => close() }, icon("croix", 20))) : null,
    h("div", { class: "sheet-body" }, content));
  const wrap = h("div", { class: "sheet-wrap", onclick: (e) => { if (e.target === wrap) close(); } }, panel);
  document.body.append(wrap);
  document.addEventListener("keydown", key);
  return { close, el: panel };
}

export function confirmBox(text, { ok = "Oui", cancel = "Annuler", danger } = {}) {
  return new Promise((res) => {
    let done = false;
    const s = sheet(h("div", { class: "stack" },
      h("p", { class: "lead" }, text),
      h("div", { class: "row gap" },
        h("button", { class: "btn ghost grow", onclick: () => { done = true; s.close(); res(false); } }, cancel),
        h("button", { class: "btn grow " + (danger ? "red" : "green"), onclick: () => { done = true; s.close(); res(true); } }, ok))),
    { onClose: () => !done && res(false) });
  });
}

// ------------------------------------------------ sons (synthèse WebAudio) et vibrations
let ac = null;
export const prefs = {
  get sound() { try { return localStorage.getItem("jeux.sound") !== "0"; } catch { return true; } },
  set sound(v) { try { localStorage.setItem("jeux.sound", v ? "1" : "0"); } catch {} },
};
function tone(freq, dur, type = "sine", vol = 0.08, delay = 0, slide = 0) {
  if (!prefs.sound) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const t = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ac.destination);
    o.start(t); o.stop(t + dur + 0.02);
  } catch {}
}
export const sfx = {
  tap: () => tone(660, 0.06, "triangle", 0.05),
  ok: () => { tone(660, 0.09, "triangle"); tone(990, 0.14, "triangle", 0.08, 0.08); },
  bad: () => { tone(220, 0.16, "sawtooth", 0.05); tone(160, 0.2, "sawtooth", 0.04, 0.1); },
  card: () => tone(1400, 0.04, "square", 0.025, 0, -900),
  dice: () => { for (let i = 0; i < 5; i++) tone(300 + Math.random() * 500, 0.03, "square", 0.03, i * 0.04); },
  coin: () => { tone(988, 0.08, "square", 0.04); tone(1319, 0.2, "square", 0.04, 0.07); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, "triangle", 0.08, i * 0.11)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.25, "triangle", 0.06, i * 0.15)),
  turn: () => { tone(880, 0.08, "sine", 0.06); tone(1175, 0.12, "sine", 0.06, 0.09); },
  roll: () => tone(90, 0.9, "sawtooth", 0.03, 0, 60),
  strike: () => { for (let i = 0; i < 8; i++) tone(200 + Math.random() * 300, 0.08, "square", 0.04, i * 0.03); },
};
export function buzz(ms = 15) { try { navigator.vibrate && navigator.vibrate(ms); } catch {} }

// ------------------------------------------------ confettis
export function confetti(n = 120) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = h("canvas", { class: "confetti" });
  document.body.append(c);
  const dpr = Math.min(2, devicePixelRatio || 1);
  c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  const x = c.getContext("2d");
  x.scale(dpr, dpr);
  const cols = ["#58CC02", "#1CB0F6", "#FFC800", "#FF4B4B", "#CE82FF", "#FF9600", "#FF86D0"];
  const ps = Array.from({ length: n }, () => ({ x: innerWidth / 2 + (Math.random() - 0.5) * 80, y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 13, vy: -Math.random() * 14 - 4, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4,
    w: 6 + Math.random() * 6, h: 8 + Math.random() * 8, c: cols[(Math.random() * cols.length) | 0] }));
  const t0 = performance.now();
  const step = (t) => {
    x.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of ps) {
      p.vy += 0.38; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2))); x.restore();
    }
    if (t - t0 < 3200) requestAnimationFrame(step); else c.remove();
  };
  requestAnimationFrame(step);
}

// nombre qui défile (gains)
export function countUp(el, from, to, ms = 900) {
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / ms);
    el.textContent = fmt(Math.round(from + (to - from) * (1 - (1 - k) ** 3)));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function copy(text) {
  const fallback = () => {
    const t = document.createElement("textarea");
    t.value = text; t.style.position = "fixed"; t.style.opacity = "0";
    document.body.append(t); t.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch {}
    t.remove();
    toast(ok ? "Copié !" : text, ok ? "ok" : "");
  };
  try { navigator.clipboard.writeText(text).then(() => toast("Copié !", "ok"), fallback); }
  catch { fallback(); }
}
