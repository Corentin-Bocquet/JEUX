import { fail, rng as mkRng } from "../engine.js";

export const meta = {
  id: "bataille", name: "Bataille navale", cat: "Plateau", min: 2, max: 2, turnTime: 40,
  color: "#1C8FE0", desc: "Place ta flotte et coule celle de l'adversaire.",
  rules: ["Place tes 5 navires sur ta grille (ou laisse le hasard le faire).",
    "Chacun son tour, tire sur une case de la grille adverse.",
    "Touché, coulé ou à l'eau : le premier qui coule toute la flotte gagne."],
};

export const N = 10;
export const FLEET = [
  { size: 5, name: "Porte-avions" }, { size: 4, name: "Croiseur" }, { size: 3, name: "Contre-torpilleur" },
  { size: 3, name: "Sous-marin" }, { size: 2, name: "Torpilleur" },
];

export function shipCells(x, y, dir, size) {
  const out = [];
  for (let k = 0; k < size; k++) {
    const cx = dir === "h" ? x + k : x, cy = dir === "v" ? y + k : y;
    if (cx < 0 || cy < 0 || cx >= N || cy >= N) return null;
    out.push(cy * N + cx);
  }
  return out;
}

export function validFleet(ships) {
  if (!Array.isArray(ships) || ships.length !== FLEET.length) return null;
  const sizes = ships.map((s) => s.size).sort();
  if (sizes.join() !== FLEET.map((f) => f.size).sort().join()) return null;
  const used = new Set();
  const out = [];
  for (const sh of ships) {
    const cells = shipCells(sh.x | 0, sh.y | 0, sh.dir === "v" ? "v" : "h", sh.size);
    if (!cells) return null;
    for (const c of cells) { if (used.has(c)) return null; used.add(c); }
    out.push({ x: sh.x | 0, y: sh.y | 0, dir: sh.dir === "v" ? "v" : "h", size: sh.size, cells });
  }
  return out;
}

export function randomFleet(rng) {
  for (;;) {
    const ships = [];
    const used = new Set();
    let ok = true;
    for (const f of FLEET) {
      let placed = false;
      for (let t = 0; t < 200 && !placed; t++) {
        const dir = rng.next() < 0.5 ? "h" : "v";
        const x = rng.int(N), y = rng.int(N);
        const cells = shipCells(x, y, dir, f.size);
        if (!cells || cells.some((c) => used.has(c))) continue;
        cells.forEach((c) => used.add(c));
        ships.push({ x, y, dir, size: f.size });
        placed = true;
      }
      if (!placed) { ok = false; break; }
    }
    if (ok) return ships;
  }
}

export function setup(players, settings, rng) {
  const order = rng.shuffle(players.map((p) => p.id));
  return { order, phase: "place", fleets: {}, shots: { [order[0]]: {}, [order[1]]: {} }, cur: 0, winner: null, last: null, level: settings.level || 2 };
}

export function toAct(s) {
  if (s.winner) return [];
  if (s.phase === "place") return s.order.filter((id) => !s.fleets[id]);
  return [s.order[s.cur]];
}

const foe = (s, id) => s.order.find((x) => x !== id);
export const sunkShips = (s, shooter) => {
  const fleet = s.fleets[foe(s, shooter)] || [];
  const sh = s.shots[shooter];
  return fleet.filter((ship) => ship.cells.every((c) => sh[c] === "hit"));
};

export function reduce(s, pid, a) {
  if (!toAct(s).includes(pid)) fail("Ce n'est pas ton tour");
  if (s.phase === "place") {
    if (a.type !== "place") fail("Place ta flotte");
    const ships = a.random ? randomFleet(mkRng(a.seed || 1)) : a.ships;
    const fleet = validFleet(ships);
    if (!fleet) fail("Flotte invalide");
    s.fleets[pid] = fleet;
    if (s.order.every((id) => s.fleets[id])) s.phase = "play";
    return s;
  }
  if (a.type !== "shoot") fail("Action inconnue");
  const c = a.cell | 0;
  if (c < 0 || c >= N * N) fail("Case invalide");
  const sh = s.shots[pid];
  if (sh[c]) fail("Déjà tiré ici");
  const fleet = s.fleets[foe(s, pid)];
  const ship = fleet.find((x) => x.cells.includes(c));
  sh[c] = ship ? "hit" : "miss";
  let sunk = null;
  if (ship && ship.cells.every((x) => sh[x] === "hit")) sunk = FLEET.find((f) => f.size === ship.size).name;
  s.last = { id: pid, cell: c, hit: !!ship, sunk };
  if (fleet.every((x) => x.cells.every((y) => sh[y] === "hit"))) s.winner = pid;
  else s.cur = 1 - s.cur;
  return s;
}

export function result(s) {
  if (!s.winner) return null;
  return { ranking: s.order.map((id) => ({ id, rank: id === s.winner ? 1 : 2 })) };
}

// robot : chasse en damier, puis vise autour des touches non coulées
export function bot(s, pid, rng) {
  if (s.phase === "place") return { type: "place", random: true };
  const sh = s.shots[pid];
  const sunkCells = new Set(sunkShips(s, pid).flatMap((x) => x.cells));
  const open = Object.keys(sh).map(Number).filter((c) => sh[c] === "hit" && !sunkCells.has(c));
  const free = (c) => c >= 0 && c < N * N && !sh[c];
  const nb = (c) => [c % N > 0 ? c - 1 : -1, c % N < N - 1 ? c + 1 : -1, c - N, c + N].filter(free);
  if (open.length && s.level >= 2) {
    // deux touches alignées : on prolonge la ligne
    for (const a of open) for (const b of open) {
      if (a >= b) continue;
      const sameRow = Math.floor(a / N) === Math.floor(b / N), sameCol = a % N === b % N;
      if (!sameRow && !sameCol) continue;
      const step = sameRow ? 1 : N;
      const line = open.filter((c) => (sameRow ? Math.floor(c / N) === Math.floor(a / N) : c % N === a % N)).sort((x, y) => x - y);
      const lo = line[0] - step, hi = line[line.length - 1] + step;
      const cand = [lo, hi].filter((c) => free(c) && (sameRow ? Math.floor(c / N) === Math.floor(a / N) : true));
      if (cand.length) return { type: "shoot", cell: rng.pick(cand) };
    }
    const cand = open.flatMap(nb);
    if (cand.length) return { type: "shoot", cell: rng.pick(cand) };
  }
  let cells = [];
  for (let c = 0; c < N * N; c++) if (!sh[c] && (s.level < 2 || (Math.floor(c / N) + (c % N)) % 2 === 0)) cells.push(c);
  if (!cells.length) for (let c = 0; c < N * N; c++) if (!sh[c]) cells.push(c);
  return { type: "shoot", cell: rng.pick(cells) };
}
export const auto = bot;
