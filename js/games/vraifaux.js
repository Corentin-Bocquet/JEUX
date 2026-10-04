import { fail } from "../engine.js";
import * as F from "./lib/flash.js";
import { VF_CATS, VF_LIST } from "../data/vraifaux_questions.js";

export const meta = {
  id: "vraifaux", name: "Vrai ou faux", cat: "Quiz", min: 1, max: 8, turnTime: 20, race: true,
  color: "#16A34A", desc: "Une affirmation, tout le monde répond en même temps : vrai ou faux ?",
  rules: [
    "Une affirmation s'affiche pour tout le monde en même temps : réponds Vrai ou Faux.",
    "Bonne réponse : 50 points, plus jusqu'à 50 points de bonus si tu réponds vite. Mauvaise réponse : 0.",
    "Après chaque question, la bonne réponse s'affiche avec une courte explication.",
    "Mort subite : une seule erreur (ou pas de réponse à temps) et tu es éliminé. Le dernier en vie gagne.",
    "À la fin, le plus gros total de points gagne.",
  ],
};

export const options = [
  { key: "theme", label: "Thème", icon: "📚", values: [["", "Tout", "Mélange"], ...VF_CATS.map((c) => [c, c])], def: "" },
  { key: "count", label: "Questions", icon: "🔢", values: [[10, "10", "Rapide"], [15, "15", "Standard"], [20, "20"], [30, "30", "Marathon"]], def: 15 },
  { key: "sudden", label: "Mort subite", icon: "💀", values: [[false, "Non"], [true, "Oui", "Une erreur = out"]], def: false },
  { key: "speed", label: "Rapidité", icon: "⚡", values: [[true, "Bonus", "Vite = + de points"], [false, "Sans", "100 par réponse"]], def: true },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "✅", desc: "15 affirmations de tous les thèmes, bonus de rapidité.", set: { theme: "", count: 15, sudden: false, speed: true } },
  { id: "express", name: "Express", emoji: "⚡", desc: "10 questions pour une partie éclair.", set: { theme: "", count: 10, sudden: false, speed: true } },
  { id: "subite", name: "Mort subite", emoji: "💀", desc: "Une erreur et tu sors. Qui tiendra le plus longtemps ?", set: { theme: "", count: 30, sudden: true, speed: true } },
  { id: "tranquille", name: "Sans chrono", emoji: "🧘", desc: "20 questions, 100 points par bonne réponse, pas de course.", set: { theme: "", count: 20, sudden: false, speed: false } },
];
const opt = (s, k) => F.optValue(options, s, k);

export function setup(players, settings, rng) {
  const s = F.flashSetup(players, { sudden: opt(settings, "sudden"), speed: opt(settings, "speed"), reveal: 4500, win: 8000, level: F.levelOf(settings) });
  s.theme = opt(settings, "theme");
  const pool = [];
  VF_LIST.forEach((q, i) => { if (!s.theme || q.c === s.theme) pool.push(i); });
  s.qs = rng.shuffle(pool).slice(0, opt(settings, "count"));
  return s;
}

export const item = (i) => VF_LIST[i];
export const toAct = F.flashToAct;
const judge = (v, q) => {
  if (v !== true && v !== false) fail("Réponds Vrai ou Faux");
  return v === item(q).t;
};
export function reduce(s, pid, a) { return F.flashReduce(s, pid, a, judge); }
export const result = F.flashResult;
export function bot(s, pid, rng) {
  const q = F.question(s);
  const right = F.botRight(s, rng, [0.62, 0.78, 0.92]);
  return { type: "answer", v: right ? item(q).t : !item(q).t };
}
export const auto = F.noAnswer;
export const botDelay = (s, pid, rng) => F.flashBotDelay(s, rng, 0.8);
