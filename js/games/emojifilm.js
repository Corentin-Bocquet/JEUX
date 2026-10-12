import { fail, rankByScore, rng as mkRng } from "../engine.js";
import { FILMS } from "../data/emojifilm_films.js";

export const meta = {
  id: "emojifilm", name: "Films en émojis", cat: "Quiz", min: 1, max: 8, turnTime: 45, race: true,
  color: "#DC2626", desc: "Devine le film, le dessin animé ou la série caché derrière les émojis.",
  rules: ["Tout le monde voit les mêmes émojis en même temps : trouve le titre !",
    "Tape ta réponse : les accents, les articles et une petite faute sont pardonnés. Tu as 3 essais.",
    "Une bonne réponse rapporte 100 points, +20 pour le premier qui trouve.",
    "Besoin d'aide ? Chaque indice (genre, année, première lettre) coûte 25 points.",
    "Options : nombre de manches, réponse à taper ou QCM, catégorie, indices permis ou non."],
};

export const CATS = { f: "Film", a: "Dessin animé", s: "Série" };
export const HINT_COST = 25, BASE = 100, FIRST_BONUS = 20, MAX_TRIES = 3;

export const options = [
  { key: "rounds", label: "Manches", icon: "🔁", values: [[5, "5", "Rapide"], [10, "10", "Standard"], [15, "15", "Marathon"]], def: 10 },
  { key: "answer", label: "Réponse", icon: "⌨️", values: [["texte", "À taper", "3 essais"], ["qcm", "QCM", "4 choix, 1 essai"]], def: "texte" },
  { key: "cat", label: "Catégorie", icon: "🎬",
    values: [["tout", "Tout", "Mélange"], ["f", "Films"], ["a", "Animés", "Dessins animés"], ["s", "Séries"]], def: "tout" },
  { key: "hints", label: "Indices", icon: "💡", values: [[true, "Permis", "-25 points"], [false, "Aucun", "Sans filet"]], def: true },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "🎬", desc: "10 manches, réponse à taper, tout mélangé, indices permis.", set: { rounds: 10, answer: "texte", cat: "tout", hints: true } },
  { id: "qcm", name: "QCM express", emoji: "⚡", desc: "5 manches, 4 choix, pas d'indice : le plus rapide gagne.", set: { rounds: 5, answer: "qcm", cat: "tout", hints: false } },
  { id: "animes", name: "Dessins animés", emoji: "🧸", desc: "Que des dessins animés, en QCM, idéal en famille.", set: { rounds: 10, answer: "qcm", cat: "a", hints: true } },
  { id: "series", name: "Séries", emoji: "📺", desc: "15 séries à reconnaître, réponse à taper.", set: { rounds: 15, answer: "texte", cat: "s", hints: true } },
];

export function opt(settings, key) {
  const o = options.find((x) => x.key === key);
  const v = settings ? settings[key] : undefined;
  const hit = o.values.find((x) => x[0] === v || (v != null && String(x[0]) === String(v)));
  return hit ? hit[0] : o.def;
}

// ------------------------------------------------ comparaison tolérante
const ARTICLES = new Set(["le", "la", "les", "l", "un", "une", "des", "du", "de", "d", "the", "a", "an", "et", "and"]);
export function norm(s) {
  const words = String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe").replace(/æ/g, "ae").replace(/&/g, " et ").replace(/[^a-z0-9]+/g, " ").trim().split(" ");
  return words.filter((w) => w && !ARTICLES.has(w)).join("");
}
export function lev(a, b) {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
const tol = (n) => (n <= 4 ? 0 : n <= 8 ? 1 : n <= 16 ? 2 : 3);
const TITLES = new Set(FILMS.map((f) => norm(f[0])));
const cache = [];
export function answersOf(i) {
  if (cache[i]) return cache[i];
  const [t, , , , , alts] = FILMS[i];
  const list = [t, ...(alts || [])].map(norm);
  // la partie avant « : » suffit, sauf si c'est le titre d'une autre oeuvre
  if (t.includes(" : ") && !TITLES.has(norm(t.split(" : ")[0]))) list.push(norm(t.split(" : ")[0]));
  return (cache[i] = [...new Set(list.filter(Boolean))]);
}
const dist = (i, g) => Math.min(...answersOf(i).map((a) => (lev(g, a) <= tol(a.length) ? lev(g, a) : 99)));
// bonne réponse : assez proche du titre, et pas plus proche d'une autre oeuvre
export function matches(i, guess) {
  const g = norm(guess);
  if (!g) return false;
  const d = dist(i, g);
  if (d === 99) return false;
  if (d === 0) return true;
  return !FILMS.some((_, j) => j !== i && answersOf(j).some((a) => lev(g, a) < d));
}

// ------------------------------------------------ partie
const poolOf = (cat) => FILMS.map((_, i) => i).filter((i) => cat === "tout" || FILMS[i][2] === cat);

export function setup(players, settings, rng) {
  const cat = opt(settings, "cat"), rounds = opt(settings, "rounds");
  const deck = rng.shuffle(poolOf(cat)).slice(0, rounds);
  const s = { ids: players.map((p) => p.id), rounds: deck.length, answer: opt(settings, "answer"), cat, hints: opt(settings, "hints"),
    deck, roundNo: 1, scores: {}, level: settings.level || 2, done: false };
  players.forEach((p) => (s.scores[p.id] = 0));
  newRound(s, rng.int(2 ** 32));
  return s;
}

function newRound(s, seed) {
  const r = mkRng(seed);
  const cur = s.deck[s.roundNo - 1];
  s.phase = "play";
  s.first = null;
  s.p = {};
  for (const id of s.ids) s.p[id] = { st: "playing", tries: [], hints: 0, pts: 0 };
  s.ready = [];
  if (s.answer === "qcm") {
    const same = FILMS.map((_, i) => i).filter((i) => i !== cur && FILMS[i][2] === FILMS[cur][2]);
    s.choices = r.shuffle([cur, ...r.shuffle(same).slice(0, 3)]);
  } else s.choices = null;
}

export const current = (s) => s.deck[s.roundNo - 1];
export const maxTries = (s) => (s.answer === "qcm" ? 1 : MAX_TRIES);
export const maxHints = (s) => (s.hints ? 3 : 0);

// indices : genre, année, première lettre
export function hintText(i, k) {
  const [t, y, c, g] = FILMS[i];
  if (k === 0) return `${CATS[c]} · ${g}`;
  if (k === 1) return `Sorti en ${y}`;
  const words = t.split(/[\s']+/).filter((w) => /[\p{L}\d]/u.test(w));
  return `${words.length} mot${words.length > 1 ? "s" : ""}, commence par « ${t[0].toUpperCase()} »`;
}

export function toAct(s) {
  if (s.done) return [];
  if (s.phase === "reveal") return s.ids.filter((id) => !s.ready.includes(id));
  return s.ids.filter((id) => s.p[id].st === "playing");
}

function endRoundIfNeeded(s) {
  if (s.phase === "play" && !s.ids.some((id) => s.p[id].st === "playing")) { s.phase = "reveal"; s.ready = []; }
}

export function reduce(s, pid, a) {
  if (!toAct(s).includes(pid)) fail(s.phase === "reveal" ? "Tu es déjà prêt" : "Attends la prochaine manche");
  if (s.phase === "reveal") {
    if (a.type !== "next") fail("Passe à la manche suivante");
    s.ready.push(pid);
    if (s.ready.length >= s.ids.length) {
      if (s.roundNo >= s.rounds) s.done = true;
      else { s.roundNo++; newRound(s, a.seed || 1); }
    }
    return s;
  }
  const me = s.p[pid];
  const cur = current(s);
  if (a.type === "hint") {
    if (me.hints >= maxHints(s)) fail("Plus d'indice disponible");
    me.hints++;
    return s;
  }
  if (a.type === "pass") { me.st = "out"; endRoundIfNeeded(s); return s; }
  let ok;
  if (a.type === "choice") {
    if (s.answer !== "qcm") fail("Tape ta réponse");
    const c = a.i | 0;
    if (!s.choices.includes(c)) fail("Choix invalide");
    me.tries.push(FILMS[c][0]);
    ok = c === cur;
  } else if (a.type === "guess") {
    if (s.answer === "qcm") fail("Choisis une des réponses");
    const g = String(a.text || "").trim().slice(0, 80);
    if (!norm(g)) fail("Écris un titre");
    me.tries.push(g);
    ok = matches(cur, g);
  } else fail("Action inconnue");
  if (ok) {
    me.st = "found";
    me.pts = Math.max(0, BASE - HINT_COST * me.hints);
    if (!s.first) { s.first = pid; me.pts += FIRST_BONUS; }
    s.scores[pid] += me.pts;
  } else if (me.tries.length >= maxTries(s)) me.st = "out";
  endRoundIfNeeded(s);
  return s;
}

export function result(s) {
  if (!s.done) return null;
  return { ranking: rankByScore(s.ids.map((id) => ({ id, score: s.scores[id] }))) };
}

// ------------------------------------------------ robots
const KNOW = { 1: 0.45, 2: 0.65, 3: 0.85 };
export function bot(s, pid, rng) {
  if (s.phase === "reveal") return { type: "next" };
  const me = s.p[pid];
  const cur = current(s);
  const lvl = s.level || 2;
  // parfois un indice d'abord (s'il en reste)
  if (me.hints < maxHints(s) && me.tries.length === 0 && rng.next() < (lvl === 1 ? 0.45 : lvl === 2 ? 0.3 : 0.15)) return { type: "hint" };
  const know = Math.min(0.97, KNOW[lvl] + 0.1 * me.hints + 0.05 * me.tries.length);
  if (s.answer === "qcm") {
    if (rng.next() < know + 0.1) return { type: "choice", i: cur };
    return { type: "choice", i: rng.pick(s.choices.filter((c) => c !== cur)) };
  }
  if (rng.next() < know) {
    return { type: "guess", text: rng.next() < 0.5 ? FILMS[cur][0] : (FILMS[cur][5] || [FILMS[cur][0]])[0] };
  }
  if (me.tries.length >= 1 && rng.next() < 0.25) return { type: "pass" };
  const same = FILMS.map((_, i) => i).filter((i) => i !== cur && FILMS[i][2] === FILMS[cur][2]);
  return { type: "guess", text: FILMS[rng.pick(same)][0] };
}
export function auto(s) { return s.phase === "reveal" ? { type: "next" } : { type: "pass" }; }
export function botDelay(s, pid, rng) {
  if (s.phase === "reveal") return 1200 + rng.next() * 1500;
  return ({ 1: 14000, 2: 10000, 3: 7000 }[s.level] || 10000) * (0.5 + rng.next() * 0.8);
}
export { FILMS };
