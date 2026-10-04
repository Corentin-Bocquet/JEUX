import { mountParcours } from "../games/lib/parcours_view.js";
import { COLORS } from "../games/lib/parcours.js";
import { BOARDS, GOAL, toAct } from "../games/serpents.js";

export const scoreOf = (s, id) => s.pos[id];
export const scoreLabel = (sc) => `case ${sc}`;

// case n (1..100) -> colonne, rangée depuis le bas (en serpentin)
const cr = (n) => { const r = Math.floor((n - 1) / 10), c = (n - 1) % 10; return [r % 2 ? 9 - c : c, r]; };
// centre en unités du dessin (100 x 110 : 10 rangées + la ligne de départ)
const pt = (n) => { const [c, r] = cr(n); return [c * 10 + 5, (9 - r) * 10 + 5]; };

const TILES = ["#FDE68A", "#BBF7D0", "#BAE6FD", "#FBCFE8", "#DDD6FE", "#FED7AA"];
const SNAKES = [["#16A34A", "#86EFAC"], ["#DC2626", "#FCA5A5"], ["#7C3AED", "#C4B5FD"], ["#EA580C", "#FDBA74"], ["#0891B2", "#67E8F9"], ["#DB2777", "#F9A8D4"]];

function ladderSVG(a, b) {
  const [x1, y1] = pt(a), [x2, y2] = pt(b);
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), nx = -dy / L * 2.2, ny = dx / L * 2.2;
  let rungs = "";
  const n = Math.max(2, Math.floor(L / 4.2));
  for (let i = 1; i < n; i++) {
    const t = i / n, x = x1 + dx * t, y = y1 + dy * t;
    rungs += `<line x1="${x - nx}" y1="${y - ny}" x2="${x + nx}" y2="${y + ny}"/>`;
  }
  return `<g class="g-serpents-ladder"><g stroke="#7C4A1E" stroke-width="2.6" stroke-linecap="round">
    <line x1="${x1 - nx}" y1="${y1 - ny}" x2="${x2 - nx}" y2="${y2 - ny}"/><line x1="${x1 + nx}" y1="${y1 + ny}" x2="${x2 + nx}" y2="${y2 + ny}"/></g>
    <g stroke="#E2A15B" stroke-width="1.5" stroke-linecap="round">${rungs}
    <line x1="${x1 - nx}" y1="${y1 - ny}" x2="${x2 - nx}" y2="${y2 - ny}" stroke-width="1"/><line x1="${x1 + nx}" y1="${y1 + ny}" x2="${x2 + nx}" y2="${y2 + ny}" stroke-width="1"/></g></g>`;
}

function snakeSVG(a, b, k) {
  const [x1, y1] = pt(a), [x2, y2] = pt(b);
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
  const waves = Math.max(2, Math.round(L / 14)), amp = Math.min(5, 2 + L / 14);
  let d = `M${x1} ${y1}`;
  const N = waves * 8;
  for (let i = 1; i <= N; i++) {
    const t = i / N, w = Math.sin(t * Math.PI * waves) * amp * (1 - t * 0.6);
    d += ` L${(x1 + dx * t + nx * w).toFixed(2)} ${(y1 + dy * t + ny * w).toFixed(2)}`;
  }
  const [c1, c2] = SNAKES[k % SNAKES.length];
  const ang = Math.atan2(dy, dx) * 180 / Math.PI + 180;
  return `<g class="g-serpents-snake">
    <path d="${d}" stroke="rgba(0,0,0,.35)" stroke-width="5.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" stroke="${c1}" stroke-width="4.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" stroke="${c2}" stroke-width="1.4" fill="none" stroke-dasharray="1.5 2.5" stroke-linecap="round"/>
    <g transform="translate(${x1} ${y1}) rotate(${ang})">
      <ellipse cx="0" cy="0" rx="4.4" ry="3.4" fill="${c1}" stroke="rgba(0,0,0,.35)" stroke-width=".6"/>
      <circle cx="-1.6" cy="-1.4" r="1.1" fill="#fff"/><circle cx="-1.6" cy="1.4" r="1.1" fill="#fff"/>
      <circle cx="-1.9" cy="-1.4" r=".55" fill="#111"/><circle cx="-1.9" cy="1.4" r=".55" fill="#111"/>
      <path d="M-4.2 0 L-7 0 M-7 0 L-8 -.9 M-7 0 L-8 .9" stroke="#E11D48" stroke-width=".55" fill="none" stroke-linecap="round"/>
    </g></g>`;
}

export function mount(root, ctx0) {
  return mountParcours(root, ctx0, {
    id: "serpents",
    boardClass: "g-serpents-board",
    toAct,
    buildBoard(board, s) {
      const B = BOARDS[s.board] || BOARDS.classique;
      const grid = document.createElement("div");
      grid.className = "g-serpents-grid";
      let html = "";
      for (let n = 1; n <= GOAL; n++) {
        const [c, r] = cr(n);
        const cls = n === GOAL ? " goal" : B.L[n] ? " lad" : B.S[n] ? " sna" : "";
        html += `<div class="g-serpents-cell${cls}" style="grid-column:${c + 1};grid-row:${10 - r};background:${TILES[(c + r) % TILES.length]}"><span>${n === GOAL ? "🏆" : n}</span></div>`;
      }
      html += `<div class="g-serpents-start" style="grid-column:1 / span 10;grid-row:11"><span>Départ</span></div>`;
      grid.innerHTML = html;
      let svg = `<svg class="g-serpents-svg" viewBox="0 0 100 110" preserveAspectRatio="none" aria-hidden="true">`;
      for (const [a, b] of Object.entries(B.L)) svg += ladderSVG(+a, b);
      Object.entries(B.S).forEach(([a, b], k) => { svg += snakeSVG(+a, b, k); });
      svg += "</svg>";
      board.append(grid);
      board.insertAdjacentHTML("beforeend", svg);
    },
    pawns: (s) => s.order.map((id) => ({ key: id, pid: id, pos: s.pos[id] })),
    xy(s, key, pos) {
      if (!pos) { const i = s.order.indexOf(key); return [28 + ((i + 0.5) * 68) / s.order.length, (10.5 / 11) * 100]; }
      const [x, y] = pt(pos);
      return [x, (y / 110) * 100];
    },
    spread: 2.2,
    colorOf: (s, id) => COLORS[s.order.indexOf(id) % COLORS.length],
    status: (s, id) => (s.winner === id ? "Arrivé !" : s.pos[id] ? `Case ${s.pos[id]}` : "Au départ"),
    prompt: () => "À toi : lance le dé !",
    canRoll: (s, id) => !s.winner && s.order[s.cur] === id,
    diceCount: () => 1,
  });
}
