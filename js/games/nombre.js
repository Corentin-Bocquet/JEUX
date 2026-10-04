import { fail, rankByScore, rng } from "../engine.js";

export const meta = {
  id: "nombre", name: "Nombre mystère", cat: "Réflexion", min: 1, max: 8, turnTime: 60, race: true,
  color: "#8B5CF6", desc: "Trouve le nombre secret en un minimum d'essais : plus grand ou plus petit ?",
  rules: ["Un nombre secret est tiré entre 1 et 100 (ou 1000). Propose un nombre : on te dit si le secret est plus grand ou plus petit.",
    "En course : tout le monde cherche le même nombre en même temps, chacun de son côté. Tes essais comptent : le moins possible !",
    "Si tu dépasses le nombre d'essais permis, la manche te compte le maximum plus 3 essais de pénalité.",
    "Après toutes les manches, celui qui a le plus petit total d'essais gagne.",
    "Variante chacun son tour : on cherche ensemble le même nombre, à tour de rôle, avec les indices de tout le monde. Celui qui le trouve gagne la manche.",
    "Astuce : vise toujours le milieu de ce qui reste, tu divises les possibilités par deux à chaque essai."],
};

export const options = [
  { key: "max", label: "Nombres", icon: "🔢",
    values: [[100, "1 à 100", "Classique"], [1000, "1 à 1000", "Pour les pros"]], def: 100 },
  { key: "rounds", label: "Manches", icon: "🔁",
    values: [[3, "3", "Rapide"], [5, "5", "Standard"], [8, "8", "Marathon"]], def: 3 },
  { key: "play", label: "Déroulement", icon: "🏁",
    values: [["course", "Course", "Tous en même temps"], ["tour", "Tour à tour", "Nombre commun"]], def: "course" },
  { key: "tries", label: "Essais", icon: "🎯",
    values: [["large", "Larges", "Pas de stress"], ["juste", "Justes", "Zéro erreur"]], def: "large" },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "🔮", desc: "De 1 à 100, 3 manches en course, essais larges.", set: { max: 100, rounds: 3, play: "course", tries: "large" } },
  { id: "expert", name: "Expert", emoji: "🧠", desc: "De 1 à 1000 avec juste assez d'essais pour une recherche parfaite.", set: { max: 1000, rounds: 3, play: "course", tries: "juste" } },
  { id: "tour", name: "Chacun son tour", emoji: "🔄", desc: "Un nombre commun, on propose à tour de rôle, le premier qui trouve gagne.", set: { max: 100, rounds: 5, play: "tour", tries: "large" } },
  { id: "marathon", name: "Marathon", emoji: "🏃", desc: "8 manches de 1 à 1000 en course.", set: { max: 1000, rounds: 8, play: "course", tries: "large" } },
];

export function opt(settings, key) {
  const o = options.find((x) => x.key === key);
  const v = settings ? settings[key] : undefined;
  const hit = o.values.find((x) => x[0] === v || (v != null && String(x[0]) === String(v)));
  return hit ? hit[0] : o.def;
}

// essais permis : juste ce qu'il faut pour une dichotomie parfaite, ou bien plus
export const perfect = (max) => Math.ceil(Math.log2(max + 1));
export const limitOf = (s) => (s.tries === "juste" ? perfect(s.max) : perfect(s.max) * 2 - 2);
export const PENALTY = 3;

// intervalle encore possible d'après une liste de propositions
export function rangeOf(s, guesses) {
  let lo = 1, hi = s.max;
  for (const g of guesses) {
    if (g < s.secret) lo = Math.max(lo, g + 1);
    else if (g > s.secret) hi = Math.min(hi, g - 1);
  }
  return [lo, hi];
}
export const hint = (s, g) => (g < s.secret ? 1 : g > s.secret ? -1 : 0); // 1 : plus grand

function newRound(s, seed) {
  s.secret = 1 + rng(seed).int(s.max);
  if (s.play === "tour") {
    s.shared = [];
    s.turn = (s.roundNo - 1) % s.ids.length; // on alterne qui commence
  } else {
    s.boards = {}; s.status = {};
    for (const id of s.ids) { s.boards[id] = []; s.status[id] = "playing"; }
  }
}

export function setup(players, settings, r) {
  const s = { ids: players.map((p) => p.id), max: opt(settings, "max"), rounds: opt(settings, "rounds"), play: opt(settings, "play"),
    tries: opt(settings, "tries"), level: [1, 2, 3].includes(settings.level) ? settings.level : 2,
    roundNo: 1, scores: {}, history: [], done: false };
  for (const id of s.ids) s.scores[id] = 0;
  newRound(s, r.int(2 ** 32));
  return s;
}

export function toAct(s) {
  if (s.done) return [];
  if (s.play === "tour") return [s.ids[s.turn]];
  return s.ids.filter((id) => s.status[id] === "playing");
}

function endRound(s, seed, info) {
  s.history.push({ n: s.secret, ...info });
  if (s.history.length > 8) s.history.shift();
  if (s.roundNo >= s.rounds) { s.done = true; return; }
  s.roundNo++;
  newRound(s, seed);
}

function raceDone(s, seed) {
  if (toAct(s).length) return;
  const tries = {};
  for (const id of s.ids) tries[id] = s.status[id] === "found" ? s.boards[id].length : limitOf(s) + PENALTY;
  endRound(s, seed, { tries });
}

export function reduce(s, pid, a) {
  if (s.done) fail("La partie est terminée");
  if (!toAct(s).includes(pid)) fail(s.play === "tour" ? "Ce n'est pas ton tour" : "Attends la prochaine manche");
  const seed = a.seed || 1;
  if (a.type === "giveup") {
    if (s.play === "tour") fail("Impossible en chacun son tour");
    s.status[pid] = "out";
    s.scores[pid] += limitOf(s) + PENALTY;
    raceDone(s, seed);
    return s;
  }
  if (a.type !== "guess") fail("Action inconnue");
  const g = Number(a.n);
  if (!Number.isInteger(g) || g < 1 || g > s.max) fail(`Propose un nombre entier entre 1 et ${s.max}`);
  if (s.play === "tour") {
    if (s.shared.some((x) => x.g === g)) fail("Ce nombre a déjà été proposé");
    s.shared.push({ id: pid, g });
    if (g === s.secret) { s.scores[pid]++; endRound(s, seed, { by: pid, k: s.shared.length }); return s; }
    if (s.shared.length >= limitOf(s)) { endRound(s, seed, { by: null, k: s.shared.length }); return s; }
    s.turn = (s.turn + 1) % s.ids.length;
    return s;
  }
  const b = s.boards[pid];
  if (b.includes(g)) fail("Tu as déjà proposé ce nombre");
  b.push(g);
  if (g === s.secret) { s.status[pid] = "found"; s.scores[pid] += b.length; }
  else if (b.length >= limitOf(s)) { s.status[pid] = "out"; s.scores[pid] += limitOf(s) + PENALTY; }
  raceDone(s, seed);
  return s;
}

export function result(s) {
  if (!s.done) return null;
  return { ranking: rankByScore(s.ids.map((id) => ({ id, score: s.scores[id] })), s.play !== "tour") };
}

// ------------------------------------------------ robot : dichotomie plus ou moins parfaite
export function botGuess(s, guesses, level, r) {
  const [lo, hi] = rangeOf(s, guesses);
  if (lo >= hi) return lo;
  const mid = Math.floor((lo + hi) / 2);
  let g;
  if (level >= 3) g = r.next() < 0.5 ? mid : Math.ceil((lo + hi) / 2); // toujours optimal
  else if (level === 2) g = Math.round(mid + (r.next() - 0.5) * 0.4 * (hi - lo));
  else g = r.next() < 0.5 ? lo + Math.floor(r.next() * (hi - lo + 1)) : Math.round(mid + (r.next() - 0.5) * 0.8 * (hi - lo));
  g = Math.min(hi, Math.max(lo, g));
  if (guesses.includes(g)) g = mid;
  return g;
}
export function bot(s, pid, r) {
  if (!toAct(s).includes(pid)) return null;
  const guesses = s.play === "tour" ? s.shared.map((x) => x.g) : s.boards[pid];
  return { type: "guess", n: botGuess(s, guesses, s.level || 2, r) };
}
export function auto(s, pid, r) {
  if (s.play === "tour") return { type: "guess", n: botGuess(s, s.shared.map((x) => x.g), 1, r) };
  return { type: "giveup" };
}
export function botDelay(s, pid, r) {
  const base = s.play === "tour" ? 1400 : ({ 1: 3400, 2: 2600, 3: 1900 }[s.level] || 2600);
  return base * (0.7 + r.next() * 0.7);
}
