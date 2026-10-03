import { fail, rng as mkRng } from "../engine.js";

export const meta = {
  id: "bataille", name: "Bataille navale", cat: "Plateau", min: 2, max: 2, turnTime: 40,
  color: "#1C8FE0", desc: "Place ta flotte et coule celle de l'adversaire.",
  rules: ["Place tes 5 navires sur ta grille (ou laisse le hasard le faire).",
    "Chacun son tour, tire sur une case de la grille adverse.",
    "Touché, coulé ou à l'eau : le premier qui coule toute la flotte gagne.",
    "Options : grille 8 x 8, flotte réduite (3 navires) ou grande (7 navires), et rejouer quand tu touches."],
};

export const N = 10; // taille par défaut (les anciennes parties n'ont pas n dans l'état)
export const FLEETS = {
  classique: [
    { size: 5, name: "Porte-avions" }, { size: 4, name: "Croiseur" }, { size: 3, name: "Contre-torpilleur" },
    { size: 3, name: "Sous-marin" }, { size: 2, name: "Torpilleur" },
  ],
  reduite: [{ size: 4, name: "Croiseur" }, { size: 3, name: "Sous-marin" }, { size: 2, name: "Torpilleur" }],
  grande: [
    { size: 5, name: "Porte-avions" }, { size: 4, name: "Croiseur" }, { size: 4, name: "Croiseur" },
    { size: 3, name: "Contre-torpilleur" }, { size: 3, name: "Sous-marin" }, { size: 2, name: "Torpilleur" }, { size: 2, name: "Torpilleur" },
  ],
};
export const FLEET = FLEETS.classique;

export const options = [
  { key: "size", label: "Grille", icon: "🌊",
    values: [[10, "10 x 10", "Classique"], [8, "8 x 8", "Plus serrée"]], def: 10 },
  { key: "fleet", label: "Flotte", icon: "🚢",
    values: [["classique", "Classique", "5 navires"], ["reduite", "Réduite", "3 navires"], ["grande", "Grande", "7 navires"]], def: "classique" },
  { key: "again", label: "Touché, rejoue", icon: "🎯",
    values: [[false, "Non", "Chacun son tour"], [true, "Oui", "Rejoue si touché"]], def: false },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "⚓", desc: "Grille 10 x 10, 5 navires, chacun son tour.", set: { size: 10, fleet: "classique", again: false } },
  { id: "eclair", name: "Éclair", emoji: "⚡", desc: "Grille 8 x 8 et 3 navires : une partie vite pliée.", set: { size: 8, fleet: "reduite", again: false } },
  { id: "salve", name: "Salve", emoji: "💥", desc: "Tant que tu touches, tu rejoues. Ça peut basculer vite !", set: { size: 10, fleet: "classique", again: true } },
  { id: "armada", name: "Armada", emoji: "🛳️", desc: "7 navires sur une grille 8 x 8, ça va tanguer.", set: { size: 8, fleet: "grande", again: false } },
];
const optVal = (key, v) => {
  const o = options.find((x) => x.key === key);
  return o.values.some((x) => x[0] === v) ? v : o.def;
};
// taille et flotte d'une partie (valeurs par défaut pour les anciennes parties)
export const gridOf = (s) => (s && s.n) || N;
export const fleetOf = (s) => FLEETS[s && s.fleet] || FLEET;

export function shipCells(x, y, dir, size, N = 10) {
  const out = [];
  for (let k = 0; k < size; k++) {
    const cx = dir === "h" ? x + k : x, cy = dir === "v" ? y + k : y;
    if (cx < 0 || cy < 0 || cx >= N || cy >= N) return null;
    out.push(cy * N + cx);
  }
  return out;
}

export function validFleet(ships, fleet = FLEET, n = N) {
  if (!Array.isArray(ships) || ships.length !== fleet.length) return null;
  const sizes = ships.map((s) => s.size).sort();
  if (sizes.join() !== fleet.map((f) => f.size).sort().join()) return null;
  const used = new Set();
  const out = [];
  for (const sh of ships) {
    const cells = shipCells(sh.x | 0, sh.y | 0, sh.dir === "v" ? "v" : "h", sh.size, n);
    if (!cells) return null;
    for (const c of cells) { if (used.has(c)) return null; used.add(c); }
    out.push({ x: sh.x | 0, y: sh.y | 0, dir: sh.dir === "v" ? "v" : "h", size: sh.size, cells });
  }
  return out;
}

export function randomFleet(rng, fleet = FLEET, N = 10) {
  for (;;) {
    const ships = [];
    const used = new Set();
    let ok = true;
    for (const f of fleet) {
      let placed = false;
      for (let t = 0; t < 200 && !placed; t++) {
        const dir = rng.next() < 0.5 ? "h" : "v";
        const x = rng.int(N), y = rng.int(N);
        const cells = shipCells(x, y, dir, f.size, N);
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
  return { order, n: optVal("size", settings.size), fleet: optVal("fleet", settings.fleet), again: optVal("again", settings.again), phase: "place", fleets: {}, shots: { [order[0]]: {}, [order[1]]: {} }, cur: 0, winner: null, last: null, level: settings.level || 2 };
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
    const ships = a.random ? randomFleet(mkRng(a.seed || 1), fleetOf(s), gridOf(s)) : a.ships;
    const fleet = validFleet(ships, fleetOf(s), gridOf(s));
    if (!fleet) fail("Flotte invalide");
    s.fleets[pid] = fleet;
    if (s.order.every((id) => s.fleets[id])) s.phase = "play";
    return s;
  }
  if (a.type !== "shoot") fail("Action inconnue");
  const N = gridOf(s);
  const c = a.cell | 0;
  if (c < 0 || c >= N * N) fail("Case invalide");
  const sh = s.shots[pid];
  if (sh[c]) fail("Déjà tiré ici");
  const fleet = s.fleets[foe(s, pid)];
  const ship = fleet.find((x) => x.cells.includes(c));
  sh[c] = ship ? "hit" : "miss";
  let sunk = null;
  if (ship && ship.cells.every((x) => sh[x] === "hit")) sunk = fleetOf(s).find((f) => f.size === ship.size).name;
  s.last = { id: pid, cell: c, hit: !!ship, sunk };
  if (fleet.every((x) => x.cells.every((y) => sh[y] === "hit"))) s.winner = pid;
  else if (!(ship && s.again)) s.cur = 1 - s.cur;
  return s;
}

export function result(s) {
  if (!s.winner) return null;
  return { ranking: s.order.map((id) => ({ id, rank: id === s.winner ? 1 : 2 })) };
}

// robot fort : carte de probabilité selon les navires encore à flot
function density(s, pid, sh, sunk, open, rng) {
  const N = gridOf(s);
  const left = fleetOf(s).map((f) => f.size);
  for (const x of sunk) { const i = left.indexOf(x.size); if (i >= 0) left.splice(i, 1); }
  const sunkCells = new Set(sunk.flatMap((x) => x.cells));
  const openSet = new Set(open);
  const heat = Array(N * N).fill(0);
  for (const size of left) for (const dir of ["h", "v"]) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const cells = shipCells(x, y, dir, size, N);
    if (!cells || cells.some((c) => sh[c] === "miss" || sunkCells.has(c))) continue;
    const covered = cells.filter((c) => openSet.has(c)).length;
    if (open.length && !covered) continue;
    const w = open.length ? Math.pow(20, covered) : 1;
    for (const c of cells) if (!sh[c]) heat[c] += w;
  }
  let best = 0, cands = [];
  for (let c = 0; c < N * N; c++) {
    if (sh[c]) continue;
    if (heat[c] > best) { best = heat[c]; cands = [c]; } else if (heat[c] === best && best > 0) cands.push(c);
  }
  return cands.length ? rng.pick(cands) : null;
}

// robot : chasse en damier, puis vise autour des touches non coulées
export function bot(s, pid, rng) {
  if (s.phase === "place") return { type: "place", random: true };
  const N = gridOf(s);
  const sh = s.shots[pid];
  const sunk = sunkShips(s, pid);
  const sunkCells = new Set(sunk.flatMap((x) => x.cells));
  const open = Object.keys(sh).map(Number).filter((c) => sh[c] === "hit" && !sunkCells.has(c));
  if (s.level >= 3) {
    const c = density(s, pid, sh, sunk, open, rng);
    if (c != null) return { type: "shoot", cell: c };
  }
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
