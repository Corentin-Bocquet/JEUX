import { fail, rankByScore, rng as mkRng } from "../engine.js";
import { isWord, normWord, wordsFromLetters } from "../data/dico.js";

export const meta = {
  id: "compte", name: "Le compte est bon", cat: "Réflexion", min: 1, max: 8, turnTime: 90, race: true,
  color: "#06B6D4", desc: "Six plaques, un nombre à atteindre : calcule plus vite et plus juste que les autres.",
  rules: ["Six plaques sont tirées (de 1 à 10 en double, 25, 50, 75 et 100) et un nombre entre 101 et 999.",
    "Tout le monde calcule en même temps : choisis deux nombres et une opération, le résultat devient une nouvelle plaque.",
    "Seulement des nombres entiers et positifs : pas de division avec reste. Chaque plaque ne sert qu'une fois.",
    "Le plus proche du nombre gagne la manche, le plus rapide départage. Compte exact : 10 points.",
    "À la fin de chaque manche, une solution est montrée.",
    "Option : des manches de lettres, où il faut trouver le mot le plus long avec 9 lettres."],
};

export const options = [
  { key: "rounds", label: "Manches", icon: "🔁", values: [[3, "3", "Rapide"], [5, "5", "Standard"], [8, "8", "Longue partie"]], def: 5 },
  { key: "dur", label: "Temps", icon: "⏱️", values: [[30, "30 s", "Éclair"], [45, "45 s", "Rythmé"], [60, "60 s", "Normal"], [90, "90 s", "Détente"]], def: 60 },
  { key: "big", label: "Grandes", icon: "💯", values: [[0, "Au hasard"], [1, "1 grande", "Plus de petites"], [2, "2 grandes"], [4, "4 grandes", "Plus corsé"]], def: 0 },
  { key: "letters", label: "Lettres", icon: "🔤", values: [[0, "Non", "Que des chiffres"], [1, "1 sur 2", "Manches de mots"]], def: 0 },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "🔢", desc: "5 manches de chiffres, 60 secondes chacune.", set: { rounds: 5, dur: 60, big: 0, letters: 0 } },
  { id: "eclair", name: "Éclair", emoji: "⚡", desc: "3 manches de 30 secondes.", set: { rounds: 3, dur: 30, big: 0, letters: 0 } },
  { id: "mixte", name: "Chiffres et lettres", emoji: "🔤", desc: "Une manche de chiffres, une manche de mots le plus long.", set: { rounds: 8, dur: 60, big: 0, letters: 1 } },
  { id: "expert", name: "Expert", emoji: "🧠", desc: "4 grandes plaques et 45 secondes.", set: { rounds: 5, dur: 45, big: 4, letters: 0 } },
];

export function opt(settings, key) {
  const o = options.find((x) => x.key === key);
  const v = settings ? settings[key] : undefined;
  const hit = o.values.find((x) => x[0] === v || (v != null && String(x[0]) === String(v)));
  return hit ? hit[0] : o.def;
}

// ------------------------------------------------ chiffres
export const SMALL = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10];
export const BIG = [25, 50, 75, 100];
export const OPS = ["+", "-", "x", "/"];

// résultat d'une opération, ou null si interdite (négatif, nul, division avec reste)
export function calc(a, op, b) {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a <= 0 || b <= 0) return null;
  if (op === "+") return a + b;
  if (op === "-") return a > b ? a - b : null;
  if (op === "x") return a * b;
  if (op === "/") return a % b === 0 ? a / b : null;
  return null;
}
export const opErr = (a, op, b) => op === "-" && a <= b ? "Le résultat doit rester positif" : op === "/" && a % b ? "Division avec reste interdite" : "Opération impossible";

// rejoue des étapes [[a, op, b], ...] à partir des plaques ; renvoie les nombres obtenus ou une erreur
export function play(plates, steps) {
  const pool = plates.slice(), seen = plates.slice(), out = [];
  if (!Array.isArray(steps) || steps.length > 5) return { err: "Calcul invalide" };
  for (const st of steps) {
    if (!Array.isArray(st)) return { err: "Calcul invalide" };
    const [a, op, b] = st;
    const ia = pool.indexOf(a);
    if (ia < 0) return { err: `${a} n'est pas disponible` };
    pool.splice(ia, 1);
    const ib = pool.indexOf(b);
    if (ib < 0) return { err: `${b} n'est pas disponible` };
    pool.splice(ib, 1);
    const r = calc(a, op, b);
    if (r == null) return { err: opErr(a, op, b) };
    pool.push(r); seen.push(r); out.push([a, op, b, r]);
  }
  return { pool, seen, steps: out };
}

// solveur : le plus proche de la cible avec au plus maxOps opérations et un budget de nœuds
export function solve(nums, target, { maxOps = 5, budget = Infinity, r = null } = {}) {
  let best = { v: nums[0], steps: [] };
  for (const n of nums) if (Math.abs(n - target) < Math.abs(best.v - target)) best = { v: n, steps: [] };
  if (best.v === target) return best;
  let nodes = 0;
  const seen = new Set();
  const path = [];
  function rec(arr) {
    if (best.v === target || nodes > budget) return;
    const key = arr.slice().sort((x, y) => x - y).join(",");
    if (seen.has(key)) return;
    seen.add(key);
    const idx = arr.map((_, i) => i);
    const order = r ? r.shuffle(idx) : idx;
    const tried = new Set();
    for (let x = 0; x < order.length; x++) for (let y = x + 1; y < order.length; y++) {
      const i = order[x], j = order[y];
      const a = Math.max(arr[i], arr[j]), b = Math.min(arr[i], arr[j]);
      const pk = a + ":" + b;
      if (tried.has(pk)) continue;
      tried.add(pk);
      const rest = arr.filter((_, k) => k !== i && k !== j);
      for (const op of OPS) {
        if ((op === "x" || op === "/") && b === 1) continue;
        const v = calc(a, op, b);
        if (v == null) continue;
        nodes++;
        path.push([a, op, b, v]);
        if (Math.abs(v - target) < Math.abs(best.v - target)) best = { v, steps: path.slice() };
        if (best.v === target) { path.pop(); return; }
        if (rest.length && path.length < maxOps) rec(rest.concat(v));
        path.pop();
        if (best.v === target || nodes > budget) return;
      }
    }
  }
  rec(nums.slice());
  return best;
}

// ------------------------------------------------ lettres
const VOW = "AAAAAEEEEEEEIIIIOOOUUUY";
const CONS = "BBCCCDDDFFGGHHJLLLLLMMMNNNNNNPPPQRRRRRRSSSSSSSTTTTTTVVXZK";
export const LETTERS = 9;
// mots possibles avec le tirage, du plus long au plus court
export function wordsFor(letters) {
  return wordsFromLetters(letters, { min: 2, max: LETTERS, limit: 50000 }).sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
}
export function fits(word, letters) {
  const pool = {};
  for (const c of letters) pool[c] = (pool[c] || 0) + 1;
  for (const c of word) { if (!pool[c]) return false; pool[c]--; }
  return true;
}
export function checkWord(s, raw) {
  const w = normWord(raw);
  if (w.length < 2) return { err: "Mot trop court" };
  if (!fits(w, s.letters)) return { err: "Ces lettres ne sont pas toutes dans le tirage" };
  if (!isWord(w)) return { err: "Mot inconnu du dictionnaire" };
  return { w };
}

// ------------------------------------------------ manches
export const isLetters = (s) => s.lettersOn === 1 && s.roundNo % 2 === 0;

function drawNumbers(s, r) {
  const nb = s.big || (r.next() < 0.5 ? 1 : 1 + r.int(3));
  const bigs = r.shuffle(BIG).slice(0, nb);
  const smalls = r.shuffle(SMALL).slice(0, 6 - nb);
  s.plates = r.shuffle(bigs.concat(smalls));
  s.target = 101 + r.int(899);
  const sol = solve(s.plates, s.target);
  s.sol = { v: sol.v, steps: sol.steps };
}
function drawLetters(s, r) {
  let best = null;
  for (let k = 0; k < 8; k++) {
    const nv = 3 + r.int(2);
    const ls = [];
    for (let i = 0; i < nv; i++) ls.push(r.pick(VOW.split("")));
    while (ls.length < LETTERS) ls.push(r.pick(CONS.split("")));
    const letters = r.shuffle(ls).join("");
    const ws = wordsFor(letters);
    const cand = { letters, words: ws.slice(0, 4) };
    if (!best || (ws[0] || "").length > (best.words[0] || "").length) best = cand;
    if (ws.length && ws[0].length >= 7) break;
  }
  s.letters = best.letters;
  s.sol = { words: best.words };
}

function newRound(s, r, now) {
  s.phase = "play"; s.t0 = now; s.ready = {}; s.last = null;
  s.kind = isLetters(s) ? "l" : "n";
  s.plates = null; s.target = null; s.letters = null;
  if (s.kind === "l") drawLetters(s, r); else drawNumbers(s, r);
  s.pl = {};
  for (const id of s.ids) s.pl[id] = { v: null, w: "", t: 0, steps: [], n: 0, done: false };
}

export function setup(players, settings, r) {
  const s = { ids: players.map((p) => p.id), rounds: opt(settings, "rounds"), dur: opt(settings, "dur"), big: opt(settings, "big"),
    lettersOn: opt(settings, "letters"), level: [1, 2, 3].includes(settings.level) ? settings.level : 2,
    roundNo: 1, scores: {}, history: [], done: false };
  for (const id of s.ids) s.scores[id] = 0;
  newRound(s, r, null);
  return s;
}

export const roundStart = (s) => (s.t0 != null ? s.t0 : s.startedAt || 0);
export const endAt = (s) => roundStart(s) + s.dur * 1000;
export const dist = (s, v) => (v == null ? Infinity : Math.abs(v - s.target));
const closestPlate = (s) => s.plates.reduce((b, x) => (Math.abs(x - s.target) < Math.abs(b - s.target) ? x : b), s.plates[0]);

export function toAct(s) {
  if (s.done) return [];
  if (s.phase === "play") return s.ids.filter((id) => !s.pl[id].done);
  return s.ids.filter((id) => !s.ready[id]);
}

const BIG_T = 1e9;
function finishRound(s) {
  const pts = {};
  for (const id of s.ids) pts[id] = 0;
  let winner = null;
  if (s.kind === "n") {
    for (const id of s.ids) { const p = s.pl[id]; if (p.v == null) { p.v = closestPlate(s); p.t = BIG_T; } }
    const d = Math.min(...s.ids.map((id) => dist(s, s.pl[id].v)));
    const base = d === 0 ? 10 : d <= 5 ? 7 : d <= 10 ? 5 : 3;
    const top = s.ids.filter((id) => dist(s, s.pl[id].v) === d);
    for (const id of top) pts[id] = base;
    winner = top.slice().sort((a, b) => s.pl[a].t - s.pl[b].t)[0];
  } else {
    const L = Math.max(0, ...s.ids.map((id) => s.pl[id].w.length));
    if (L > 0) {
      const top = s.ids.filter((id) => s.pl[id].w.length === L);
      for (const id of top) pts[id] = L === LETTERS ? 2 * L : L;
      winner = top.slice().sort((a, b) => s.pl[a].t - s.pl[b].t)[0];
    }
  }
  if (winner) pts[winner] += 3;
  for (const id of s.ids) { s.scores[id] += pts[id]; s.pl[id].done = true; }
  s.last = { winner, pts };
  s.history.push({ k: s.kind, w: winner, p: pts });
  s.phase = "recap";
  if (s.roundNo >= s.rounds) s.done = true;
}

export function reduce(s, pid, a) {
  if (!s.ids.includes(pid)) fail("Tu ne joues pas dans cette partie");
  if (s.done) fail("La partie est terminée");
  const now = a.now || 0;
  const t = Math.max(0, now - roundStart(s));
  if (a.type === "close") {
    if (s.phase !== "play") return s;
    if (now < endAt(s)) fail("Pas encore");
    finishRound(s);
    return s;
  }
  if (a.type === "ready") {
    if (s.phase !== "recap") fail("Pas encore");
    s.ready[pid] = true;
    if (s.ids.every((id) => s.ready[id])) { s.roundNo++; newRound(s, mkRng(a.seed || 1), now); }
    return s;
  }
  if (s.phase !== "play") fail("La manche est finie");
  const p = s.pl[pid];
  if (p.done) fail("Tu as déjà fini cette manche");
  if (a.type === "propose") {
    if (s.kind !== "n") fail("C'est une manche de lettres");
    const res = play(s.plates, a.steps || []);
    if (res.err) fail(res.err);
    if (!res.seen.includes(a.value)) fail("Ce nombre n'a pas été obtenu");
    p.n++;
    if (dist(s, a.value) < dist(s, p.v)) { p.v = a.value; p.t = t; p.steps = res.steps; }
    if (p.v === s.target) p.done = true;
  } else if (a.type === "word") {
    if (s.kind !== "l") fail("C'est une manche de chiffres");
    const c = checkWord(s, a.word);
    if (c.err) fail(c.err);
    p.n++;
    if (c.w.length > p.w.length) { p.w = c.w; p.t = t; }
    if (p.w.length === LETTERS) p.done = true;
  } else if (a.type === "done") {
    p.done = true;
  } else fail("Action inconnue");
  if (s.ids.every((id) => s.pl[id].done)) finishRound(s);
  return s;
}

export function result(s) {
  if (!s.done) return null;
  return { ranking: rankByScore(s.ids.map((id) => ({ id, score: s.scores[id] }))) };
}

// ------------------------------------------------ robots : solveur bridé par le niveau et le temps
const CAP = { 1: 3, 2: 4, 3: 5 };
const BUDGET = { 1: 400, 2: 6000, 3: Infinity };
export function bot(s, pid, r) {
  if (s.phase === "recap") return s.ready[pid] ? null : { type: "ready" };
  const p = s.pl[pid];
  if (!p || p.done) return null;
  const lv = s.level || 2, cap = CAP[lv] || 4;
  const depth = Math.min(cap, 2 + p.n);
  if (s.kind === "n") {
    if (p.n > cap) return { type: "done" };
    const res = solve(s.plates, s.target, { maxOps: depth, budget: BUDGET[lv], r });
    if (dist(s, res.v) < dist(s, p.v)) return { type: "propose", steps: res.steps.map((x) => x.slice(0, 3)), value: res.v };
    return depth >= cap ? { type: "done" } : { type: "propose", steps: [], value: s.plates[0] };
  }
  if (p.n > cap) return { type: "done" };
  const best = (s.sol.words[0] || "").length;
  const want = Math.min(best - (3 - lv), 3 + 2 * p.n);
  const ws = wordsFor(s.letters).filter((w) => w.length <= want && w.length > p.w.length);
  if (!ws.length) return depth >= cap || !p.w ? { type: "done" } : { type: "word", word: p.w };
  const L = ws[0].length;
  return { type: "word", word: r.pick(ws.filter((w) => w.length === L)) };
}

export function auto(s) { return s.phase === "recap" ? { type: "ready" } : { type: "done" }; }

export function botDelay(s, pid, r) {
  if (s.phase === "recap") return 2500 + r.next() * 2500;
  const f = { 1: 0.3, 2: 0.2, 3: 0.12 }[s.level] || 0.2;
  return s.dur * 1000 * f * (0.6 + r.next() * 0.8);
}
