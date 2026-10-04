import { fail } from "../engine.js";
import * as F from "./lib/flash.js";
import { IN_CATS, IN } from "../data/intrus_series.js";

export const meta = {
  id: "intrus", name: "Cherche l'intrus", cat: "Quiz", min: 1, max: 8, turnTime: 20, race: true,
  color: "#0EA5E9", desc: "Une série, un seul élément ne va pas avec les autres : trouve-le avant tout le monde !",
  rules: [
    "Une série de 4 ou 5 éléments s'affiche pour tout le monde en même temps. Un seul n'a pas sa place : touche-le.",
    "Bonne réponse : 50 points, plus jusqu'à 50 points de bonus si tu es rapide. Mauvaise réponse : 0.",
    "Après chaque série, l'explication s'affiche (par exemple : « Seul le dauphin est un mammifère »).",
    "Mort subite : une erreur et tu es éliminé, le dernier en vie gagne.",
    "À la fin, le plus gros total de points gagne.",
  ],
};

// liste à plat : { c, x: [intrus, m1..m4], e }
export const SERIES = IN_CATS.flatMap((c) => IN[c].map((r) => ({ c, x: r.slice(0, 5).map(F.typo), e: F.typo(r[5]) })));

export const options = [
  { key: "theme", label: "Thème", icon: "📚", values: [["", "Tout", "Mélange"], ...IN_CATS.map((c) => [c, c])], def: "" },
  { key: "count", label: "Séries", icon: "🔢", values: [[10, "10", "Rapide"], [15, "15", "Standard"], [20, "20"], [30, "30", "Marathon"]], def: 15 },
  { key: "size", label: "Éléments", icon: "🧩", values: [[4, "4", "Plus simple"], [5, "5", "Plus de pièges"]], def: 4 },
  { key: "sudden", label: "Mort subite", icon: "💀", values: [[false, "Non"], [true, "Oui", "Une erreur = out"]], def: false },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "🔍", desc: "15 séries de 4 éléments, tous les thèmes.", set: { theme: "", count: 15, size: 4, sudden: false } },
  { id: "express", name: "Express", emoji: "⚡", desc: "10 séries pour une partie éclair.", set: { theme: "", count: 10, size: 4, sudden: false } },
  { id: "expert", name: "Expert", emoji: "🧠", desc: "20 séries de 5 éléments : plus de pièges.", set: { theme: "", count: 20, size: 5, sudden: false } },
  { id: "subite", name: "Mort subite", emoji: "💀", desc: "5 éléments, une erreur et tu sors.", set: { theme: "", count: 30, size: 5, sudden: true } },
];
const opt = (s, k) => F.optValue(options, s, k);

export function setup(players, settings, rng) {
  const s = F.flashSetup(players, { sudden: opt(settings, "sudden"), speed: true, reveal: 4500, win: 10000, level: F.levelOf(settings) });
  s.theme = opt(settings, "theme");
  s.size = opt(settings, "size");
  const pool = [];
  SERIES.forEach((q, i) => { if (!s.theme || q.c === s.theme) pool.push(i); });
  // chaque question : i = série, o = ordre d'affichage (0 = l'intrus, 1 à 4 = membres)
  s.qs = rng.shuffle(pool).slice(0, opt(settings, "count")).map((i) => {
    const members = rng.shuffle([1, 2, 3, 4]).slice(0, s.size - 1);
    return { i, o: rng.shuffle([0, ...members]) };
  });
  return s;
}

export const serie = (q) => SERIES[q.i];
export const labelOf = (q, k) => serie(q).x[k];
export const toAct = F.flashToAct;
const judge = (v, q) => {
  if (!Number.isInteger(v) || !q.o.includes(v)) fail("Choisis un des éléments affichés");
  return v === 0;
};
export function reduce(s, pid, a) { return F.flashReduce(s, pid, a, judge); }
export const result = F.flashResult;
export function bot(s, pid, rng) {
  const q = F.question(s);
  if (F.botRight(s, rng, [0.45, 0.68, 0.88])) return { type: "answer", v: 0 };
  return { type: "answer", v: rng.pick(q.o.filter((k) => k !== 0)) };
}
export const auto = F.noAnswer;
export const botDelay = (s, pid, rng) => F.flashBotDelay(s, rng, 1.1);
