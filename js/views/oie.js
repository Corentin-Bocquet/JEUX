import { mountParcours } from "../games/lib/parcours_view.js";
import { COLORS } from "../games/lib/parcours.js";
import { OIES, SPECIAL, GOAL, toAct } from "../games/oie.js";

export const scoreOf = (s, id) => s.pos[id];
export const scoreLabel = (sc) => `case ${sc}`;

// spirale 8 x 8 : case 0 (départ) en bas à gauche, 63 au centre
const N = 8;
const SPIRAL = (() => {
  const out = [];
  let top = 0, bottom = N - 1, left = 0, right = N - 1;
  while (out.length < N * N) {
    for (let c = left; c <= right; c++) out.push([bottom, c]);
    bottom--;
    for (let r = bottom; r >= top; r--) out.push([r, right]);
    right--;
    for (let c = right; c >= left; c--) out.push([top, c]);
    top++;
    for (let r = top; r <= bottom; r++) out.push([r, left]);
    left++;
  }
  return out.slice(0, N * N);
})();
const HINT = { 6: "→ 12", 19: "2 tours", 31: "Bloqué", 42: "→ 30", 52: "Bloqué", 58: "→ départ" };
const TONES = ["#FEF3C7", "#DCFCE7", "#E0F2FE", "#FCE7F3", "#EDE9FE"];

export function mount(root, ctx0) {
  return mountParcours(root, ctx0, {
    id: "oie",
    boardClass: "g-oie-board",
    toAct,
    buildBoard(board, s) {
      const hint = s.trap === "tours" ? { ...HINT, 31: "2 tours", 52: "3 tours" } : HINT;
      const grid = document.createElement("div");
      grid.className = "g-oie-grid";
      let html = "";
      for (let i = 0; i <= GOAL; i++) {
        const [r, c] = SPIRAL[i];
        const sp = SPECIAL[i], oie = OIES.includes(i);
        const cls = i === 0 ? " start" : i === GOAL ? " goal" : oie ? " goose" : sp ? " trap" : "";
        const ico = i === 0 ? "🚩" : oie ? "🪿" : sp ? sp[1] : "";
        const title = i === 0 ? "Départ" : oie ? "Oie" : sp ? sp[0] : "";
        html += `<div class="g-oie-cell${cls}" style="grid-row:${r + 1};grid-column:${c + 1};${cls ? "" : `background:${TONES[i % TONES.length]}`}" title="${title}">
          <b>${i === 0 ? "" : i}</b>${ico ? `<i>${ico}</i>` : ""}${hint[i] ? `<small>${hint[i]}</small>` : i === 0 ? "<small>Départ</small>" : ""}</div>`;
      }
      grid.innerHTML = html;
      board.append(grid);
    },
    pawns: (s) => s.order.map((id) => ({ key: id, pid: id, pos: s.pos[id] })),
    xy(s, key, pos) {
      const [r, c] = SPIRAL[Math.max(0, Math.min(GOAL, pos))];
      return [((c + 0.5) / N) * 100, ((r + 0.58) / N) * 100];
    },
    spread: 2.6,
    colorOf: (s, id) => COLORS[s.order.indexOf(id) % COLORS.length],
    status(s, id) {
      if (s.winner === id) return "Arrivé !";
      const p = s.pos[id];
      if (s.stuck[id]) return `${SPECIAL[p] ? SPECIAL[p][0] : "Bloqué"} : à délivrer`;
      if (s.wait[id]) return `Case ${p} · passe ${s.wait[id]} tour${s.wait[id] > 1 ? "s" : ""}`;
      return p ? `Case ${p}` : "Au départ";
    },
    prompt: (s) => (s.dice === 1 ? "À toi : lance le dé !" : "À toi : lance les dés !"),
    canRoll: (s, id) => !s.winner && s.order[s.cur] === id,
    diceCount: (s) => (s.dice === 1 ? 1 : 2),
  });
}
