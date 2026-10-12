// Quiz culture générale : tout le monde répond en même temps à la même question.
import { fail, rankByScore } from "../engine.js";
import { CATS, QUESTIONS, makeQ, botPick, thinkMs, optOf, levelOf } from "./lib/quiz_q.js";

export const meta = {
  id: "quiz", name: "Quiz culture générale", cat: "Quiz", min: 1, max: 8, turnTime: 20, race: true,
  color: "#7C3AED", desc: "Même question pour tous : réponds juste et vite.",
  rules: [
    "Tout le monde reçoit la même question en même temps, avec 4 réponses possibles.",
    "Bonne réponse : 100 points, plus jusqu'à 100 points de bonus si tu réponds vite.",
    "Enchaîne les bonnes réponses : chaque bonne réponse d'affilée rapporte 20 points de plus (jusqu'à +100).",
    "Après chaque question, on dévoile la bonne réponse et ce que chacun a choisi.",
    "Options : nombre de questions, catégorie, difficulté et bonus de rapidité. Le meilleur total gagne.",
  ],
};

export const options = [
  { key: "count", label: "Questions", icon: "❓", values: [[10, "10", "Standard"], [15, "15"], [20, "20", "Marathon"]], def: 10 },
  { key: "cat", label: "Catégorie", icon: "🗂️", values: [["all", "Tout", "Les 6 thèmes"], ...CATS.map((c) => [c.id, c.short === "Divertissement" ? "Ciné-musique" : c.short, c.name.length <= 18 ? c.name : "Arts, littérature"])], def: "all" },
  { key: "diff", label: "Difficulté", icon: "📈", values: [["mix", "Mélange", "Du facile au dur"], ["facile", "Facile", "Pour tous"], ["expert", "Expert", "Questions dures"]], def: "mix" },
  { key: "speed", label: "Rapidité", icon: "⚡", values: [[true, "Bonus", "Vite = plus"], [false, "Aucun", "Seul le juste"]], def: true },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "🧠", desc: "10 questions de tous les thèmes, bonus de rapidité.", set: { count: 10, cat: "all", diff: "mix", speed: true } },
  { id: "marathon", name: "Marathon", emoji: "🏃", desc: "20 questions pour départager les vrais cracks.", set: { count: 20, cat: "all", diff: "mix", speed: true } },
  { id: "tranquille", name: "Tranquille", emoji: "🍵", desc: "Questions faciles, pas de course contre la montre.", set: { count: 10, cat: "all", diff: "facile", speed: false } },
  { id: "expert", name: "Expert", emoji: "🎓", desc: "15 questions difficiles, rapidité récompensée.", set: { count: 15, cat: "all", diff: "expert", speed: true } },
];
export const opt = (settings, key) => optOf(options, settings, key);

export const SPEED_MS = 15000; // au-delà, plus de bonus de rapidité
export const STREAK_STEP = 20, STREAK_MAX = 100;

// difficultés visées pour chaque question
export function diffPlan(n, diff) {
  return Array.from({ length: n }, (_, i) => {
    const f = i / n;
    if (diff === "facile") return f < 0.6 ? [1] : [1, 2];
    if (diff === "expert") return f < 0.4 ? [2] : [3];
    return f < 0.35 ? [1] : f < 0.75 ? [2] : [3];
  });
}

export function setup(players, settings, r) {
  const n = opt(settings, "count"), cat = opt(settings, "cat"), diff = opt(settings, "diff");
  const used = new Set(), qs = [];
  for (const ds of diffPlan(n, diff)) {
    const ok = (q) => (cat === "all" || q.cat === cat) && !used.has(q.id);
    let pool = QUESTIONS.filter((q) => ok(q) && ds.includes(q.d));
    if (!pool.length) pool = QUESTIONS.filter(ok);
    const src = r.pick(pool);
    used.add(src.id);
    qs.push(makeQ(src, r));
  }
  const s = { ids: players.map((p) => p.id), n, cat, diff, speed: opt(settings, "speed"), level: levelOf(settings),
    qs, i: 0, phase: "q", qAt: null, ans: {}, ready: [], scores: {}, streak: {}, best: {}, good: {}, done: false };
  for (const id of s.ids) { s.scores[id] = 0; s.streak[id] = 0; s.best[id] = 0; s.good[id] = 0; }
  return s;
}

export const curQ = (s) => s.qs[s.i];
export function toAct(s) {
  if (s.done) return [];
  if (s.phase === "q") return s.ids.filter((id) => !s.ans[id]);
  return s.ids.filter((id) => !s.ready.includes(id));
}

// points d'une bonne réponse
export function points(s, ms, streakBefore) {
  const speed = s.speed ? Math.round(100 * Math.max(0, 1 - ms / SPEED_MS)) : 0;
  const bonus = Math.min(STREAK_MAX, STREAK_STEP * streakBefore);
  return 100 + speed + bonus;
}

export function reduce(s, pid, a) {
  if (!s.ids.includes(pid)) fail("Tu ne joues pas cette partie");
  if (!toAct(s).includes(pid)) fail(s.phase === "q" ? "Tu as déjà répondu" : "On attend les autres");
  const now = a.now || 0;
  if (s.qAt == null) s.qAt = s.startedAt || now;
  if (s.phase === "q") {
    if (a.type !== "answer") fail("Réponds à la question");
    const c = Number(a.c);
    if (![-1, 0, 1, 2, 3].includes(c)) fail("Réponse inconnue");
    const q = curQ(s);
    const ms = Math.max(0, now - s.qAt);
    const ok = c === q.k;
    let pts = 0;
    if (ok) {
      pts = points(s, ms, s.streak[pid]);
      s.streak[pid]++;
      s.best[pid] = Math.max(s.best[pid], s.streak[pid]);
      s.good[pid]++;
    } else s.streak[pid] = 0;
    s.scores[pid] += pts;
    s.ans[pid] = { c, ok, pts, ms };
    if (!toAct(s).length) { s.phase = "rev"; s.ready = []; }
    return s;
  }
  if (a.type !== "next") fail("Action inconnue");
  s.ready.push(pid);
  if (!toAct(s).length) {
    if (s.i + 1 >= s.n) { s.done = true; return s; }
    s.i++; s.phase = "q"; s.ans = {}; s.ready = []; s.qAt = now;
  }
  return s;
}

export function result(s) {
  if (!s.done) return null;
  return { ranking: rankByScore(s.ids.map((id) => ({ id, score: s.scores[id] }))) };
}

export function bot(s, pid, r) {
  if (!toAct(s).includes(pid)) return null;
  if (s.phase === "rev") return { type: "next" };
  return { type: "answer", c: botPick(curQ(s), s.level, r) };
}
export function auto(s, pid) { return s.phase === "q" ? { type: "answer", c: -1 } : { type: "next" }; }
export function botDelay(s, pid, r) {
  if (s.phase === "rev") return 2600 + r.int(1600);
  return thinkMs(s.level, curQ(s).d, r);
}
