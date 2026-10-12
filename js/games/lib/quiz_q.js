// Aides partagées par les jeux quiz, camembert et million : tirage des questions,
// mélange des réponses, force des robots. Aucun DOM.
import { QUESTIONS, CATS } from "../../data/questions.js";

export { QUESTIONS, CATS };
export const LETTERS = ["A", "B", "C", "D"];

// question prête à jouer : réponses mélangées, k = indice de la bonne
export function makeQ(src, r) {
  const order = r.shuffle([0, 1, 2, 3]);
  return { id: src.id, cat: src.cat, d: src.d, q: src.q, c: order.map((i) => src.a[i]), k: order.indexOf(0) };
}

// tire une question au hasard parmi celles qui conviennent et ne sont pas déjà sorties
export function drawQ(r, { cat = null, ds = [1, 2, 3], used = [] } = {}) {
  const usedSet = new Set(used);
  const ok = (q) => (!cat || q.cat === cat) && ds.includes(q.d);
  let pool = QUESTIONS.filter((q) => ok(q) && !usedSet.has(q.id));
  if (!pool.length) pool = QUESTIONS.filter(ok);
  if (!pool.length) pool = QUESTIONS;
  return makeQ(r.pick(pool), r);
}

// chance qu'un robot trouve la bonne réponse, selon son niveau et la difficulté
const P = { 1: [0.62, 0.42, 0.25], 2: [0.82, 0.62, 0.42], 3: [0.95, 0.84, 0.66] };
export function pRight(level, d) {
  const row = P[level] || P[2];
  return row[Math.min(3, Math.max(1, d || 2)) - 1];
}

// réponse d'un robot parmi les choix encore possibles
export function botPick(q, level, r, allowed = [0, 1, 2, 3]) {
  if (r.next() < pRight(level, q.d) && allowed.includes(q.k)) return q.k;
  const wrong = allowed.filter((i) => i !== q.k);
  return wrong.length ? r.pick(wrong) : q.k;
}

// temps de réflexion plausible d'un robot (ms)
export function thinkMs(level, d, r) {
  const base = { 1: 7000, 2: 5200, 3: 3800 }[level] || 5200;
  return Math.round(base * (0.55 + 0.25 * (d || 2)) * (0.6 + r.next() * 0.8));
}

// lecture d'un réglage : valeur connue ou défaut
export function optOf(options, settings, key) {
  const o = options.find((x) => x.key === key);
  const v = settings ? settings[key] : undefined;
  const hit = o.values.find((x) => x[0] === v || (v != null && String(x[0]) === String(v)));
  return hit ? hit[0] : o.def;
}
export const levelOf = (settings) => ([1, 2, 3].includes(Number(settings && settings.level)) ? Number(settings.level) : 2);
