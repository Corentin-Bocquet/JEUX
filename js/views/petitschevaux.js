import { mountParcours } from "../games/lib/parcours_view.js";
import { COLORS } from "../games/lib/parcours.js";
import { toAct, legalMoves, absOf, FRONT, END, HCOLORS } from "../games/petitschevaux.js";

export const scoreOf = (s, id) => s.h[id].filter((p) => p >= END).length + "/" + s.horses;
export const scoreLabel = (sc) => `${sc} cheva${sc > 1 ? "ux" : "l"} arrivé${sc > 1 ? "s" : ""}`;

// parcours de 52 cases sur une grille 15 x 15 : [rangée, colonne]
const TRACK = (() => {
  const t = [];
  for (let c = 1; c <= 5; c++) t.push([6, c]);
  for (let r = 5; r >= 0; r--) t.push([r, 6]);
  t.push([0, 7]);
  for (let r = 0; r <= 5; r++) t.push([r, 8]);
  for (let c = 9; c <= 14; c++) t.push([6, c]);
  t.push([7, 14]);
  for (let c = 14; c >= 9; c--) t.push([8, c]);
  for (let r = 9; r <= 14; r++) t.push([r, 8]);
  t.push([14, 7]);
  for (let r = 14; r >= 9; r--) t.push([r, 6]);
  for (let c = 5; c >= 0; c--) t.push([8, c]);
  t.push([7, 0], [6, 0]);
  return t;
})();
// escalier de chaque place (marches 1 à 6, la 6 au centre)
const STAIRS = [
  [1, 2, 3, 4, 5, 6].map((k) => [7, k]),
  [1, 2, 3, 4, 5, 6].map((k) => [k, 7]),
  [1, 2, 3, 4, 5, 6].map((k) => [7, 14 - k]),
  [1, 2, 3, 4, 5, 6].map((k) => [14 - k, 7]),
];
const CORNER = [[0, 0], [0, 9], [9, 9], [9, 0]]; // écuries
const SLOTS = [[1.5, 1.5], [1.5, 3.5], [3.5, 1.5], [3.5, 3.5]];
const colSeat = (seat) => COLORS[HCOLORS[seat]];
const pc = ([r, c]) => [((c + 0.5) / 15) * 100, ((r + 0.5) / 15) * 100];

const HORSE = `<span class="g-petitschevaux-k">♞</span>`;

export function mount(root, ctx0) {
  return mountParcours(root, ctx0, {
    id: "petitschevaux",
    boardClass: "g-petitschevaux-board",
    toAct,
    buildBoard(board, s) {
      const grid = document.createElement("div");
      grid.className = "g-petitschevaux-grid";
      const used = Object.values(s.seat);
      let html = "";
      const cell = ([r, c], cls, style = "", inner = "") =>
        `<div class="g-petitschevaux-c ${cls}" style="grid-row:${r + 1};grid-column:${c + 1};${style}">${inner}</div>`;
      // écuries
      CORNER.forEach(([r, c], seat) => {
        const col = colSeat(seat), on = used.includes(seat);
        html += `<div class="g-petitschevaux-stable${on ? "" : " off"}" style="grid-row:${r + 1} / span 6;grid-column:${c + 1} / span 6;--pc:${col.c};--pd:${col.d}"><div class="g-petitschevaux-yard">${SLOTS.map(() => "<i></i>").join("")}</div></div>`;
      });
      // parcours
      TRACK.forEach((rc, i) => {
        const seat = [0, 1, 2, 3].find((k) => k * 13 === i);
        const front = [0, 1, 2, 3].find((k) => (k * 13 + FRONT) % 52 === i);
        const st = seat != null ? `--pc:${colSeat(seat).c}` : front != null ? `--pc:${colSeat(front).c}` : "";
        html += cell(rc, seat != null ? "start" : front != null ? "front" : "", st, seat != null ? "▶" : "");
      });
      // escaliers 1 à 5 (la marche 6 est au centre)
      STAIRS.forEach((list, seat) => list.slice(0, 5).forEach((rc, k) => {
        html += cell(rc, "step", `--pc:${colSeat(seat).c};--pd:${colSeat(seat).d}`, String(k + 1));
      }));
      html += `<div class="g-petitschevaux-center" style="grid-row:7 / span 3;grid-column:7 / span 3;--c0:${colSeat(0).c};--c1:${colSeat(1).c};--c2:${colSeat(2).c};--c3:${colSeat(3).c}"><span>6</span></div>`;
      grid.innerHTML = html;
      board.append(grid);
    },
    pawns: (s) => s.order.flatMap((id) => s.h[id].map((p, k) => ({ key: id + ":" + k, pid: id, pos: p }))),
    xy(s, key, pos) {
      const [pid, k] = key.split(":");
      const seat = s.seat[pid];
      if (pos < 0) { const [r, c] = CORNER[seat], [dr, dc] = SLOTS[+k % 4]; return pc([r + dr, c + dc]); }
      if (pos <= FRONT) return pc(TRACK[absOf(s, pid, pos)]);
      if (pos >= END) {
        // centre : chaque cheval arrivé dans le triangle de sa couleur
        const [x, y] = pc(STAIRS[seat][5]);
        const [cx, cy] = pc([7, 7]);
        return [x + (x - cx) * 0.2 + (+k - 1.5) * 1.6 * (seat % 2 ? 1 : 0), y + (y - cy) * 0.2 + (+k - 1.5) * 1.6 * (seat % 2 ? 0 : 1)];
      }
      return pc(STAIRS[seat][pos - FRONT - 1]);
    },
    spread: 1.4,
    colorOf: (s, id) => colSeat(s.seat[id]),
    pawnInner: () => HORSE,
    status(s, id) {
      const h = s.h[id];
      const home = h.filter((p) => p >= END).length, out = h.filter((p) => p >= 0 && p < END).length;
      return `🏁 ${home}/${s.horses} · 🐴 ${out}`;
    },
    prompt: (s) => (s.phase === "move" ? `Tu as fait ${s.die} : touche le cheval à avancer` : "À toi : lance le dé !"),
    canRoll: (s, id) => !s.winner && s.order[s.cur] === id && s.phase === "roll",
    pickable(s, me) {
      if (s.phase !== "move" || s.order[s.cur] !== me) return [];
      const legal = legalMoves(s, me);
      const keys = [];
      s.h[me].forEach((p, k) => { if (legal.includes(k) || (p < 0 && legal.some((j) => s.h[me][j] < 0))) keys.push(me + ":" + k); });
      return keys;
    },
    onPick(ctx, s, key) { ctx.act({ type: "move", h: +key.split(":")[1] }); },
    diceCount: () => 1,
  });
}
