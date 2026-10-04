import { fail } from "../engine.js";
import * as F from "./lib/flash.js";
import { COUNTRIES, CONTINENTS, flagOf } from "../data/geo_pays.js";

export { COUNTRIES, CONTINENTS, flagOf };

export const meta = {
  id: "geo", name: "Capitales et pays", cat: "Quiz", min: 1, max: 8, turnTime: 25, race: true,
  color: "#2563EB", desc: "Capitales, drapeaux et continents : tout le monde répond en même temps.",
  rules: [
    "Une question de géographie s'affiche pour tout le monde en même temps : capitale d'un pays, pays d'une capitale, drapeau ou continent.",
    "Bonne réponse : 50 points, plus jusqu'à 50 points de bonus si tu es rapide. Mauvaise réponse : 0.",
    "En mode « À taper », écris ta réponse : les accents et majuscules ne comptent pas, et une faute de frappe est tolérée.",
    "Tu peux limiter la partie à un continent (les questions « quel continent ? » sont alors retirées du mélange).",
    "La base contient les 193 pays membres de l'ONU et le Vatican. À la fin, le plus gros total gagne.",
  ],
};

export const TYPES = ["cap", "pays", "drap", "cont"];
export const options = [
  { key: "cont", label: "Continent", icon: "🌍", values: [["", "Monde", "Tous les pays"], ...CONTINENTS.map((c) => [c, c])], def: "" },
  { key: "type", label: "Type", icon: "❓", values: [["mix", "Mélange"], ["cap", "Capitales", "Pays → capitale"], ["pays", "Pays", "Capitale → pays"], ["drap", "Drapeaux"], ["cont", "Continents"]], def: "mix" },
  { key: "rep", label: "Réponse", icon: "✍️", values: [["qcm", "QCM", "4 propositions"], ["taper", "À taper", "1 faute tolérée"]], def: "qcm" },
  { key: "count", label: "Questions", icon: "🔢", values: [[10, "10", "Rapide"], [15, "15", "Standard"], [20, "20"], [30, "30", "Marathon"]], def: 15 },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "🌍", desc: "15 questions variées sur le monde entier, en QCM.", set: { cont: "", type: "mix", rep: "qcm", count: 15 } },
  { id: "capitales", name: "Capitales", emoji: "🏛️", desc: "Trouve la capitale et tape-la toi-même.", set: { cont: "", type: "cap", rep: "taper", count: 15 } },
  { id: "drapeaux", name: "Drapeaux", emoji: "🚩", desc: "20 drapeaux à reconnaître.", set: { cont: "", type: "drap", rep: "qcm", count: 20 } },
  { id: "europe", name: "Tour d'Europe", emoji: "🇪🇺", desc: "Capitales, pays et drapeaux d'Europe, réponses à taper.", set: { cont: "Europe", type: "mix", rep: "taper", count: 15 } },
];
const opt = (s, k) => F.optValue(options, s, k);

const sameName = (p) => F.normAnswer(p.c) === F.normAnswer(p.n);
// la question de type t a-t-elle un sens pour ce pays ?
export function fits(p, t) {
  if (t === "cap" || t === "pays") return !p.nc && !sameName(p);
  if (t === "drap") return !p.nf;
  if (t === "cont") return !p.amb;
  return false;
}

function pickChoices(c, t, rng) {
  const p = COUNTRIES[c];
  const ok = (j) => j !== c && fits(COUNTRIES[j], t);
  const all = COUNTRIES.map((_, j) => j).filter(ok);
  const near = all.filter((j) => COUNTRIES[j].k === p.k);
  const src = near.length >= 3 ? near : all;
  return rng.shuffle([c, ...rng.shuffle(src).slice(0, 3)]);
}

export function setup(players, settings, rng) {
  const s = F.flashSetup(players, { speed: true, reveal: 3500, win: 10000, level: F.levelOf(settings) });
  s.cont = opt(settings, "cont");
  s.type = opt(settings, "type");
  s.rep = opt(settings, "rep");
  const n = opt(settings, "count");
  const types = s.type === "mix" ? (s.cont ? ["cap", "pays", "drap"] : TYPES) : [s.type];
  const pairs = [];
  COUNTRIES.forEach((p, c) => {
    for (const t of types) {
      // le filtre de continent n'a pas de sens pour les questions « quel continent ? »
      if (t !== "cont" && s.cont && p.k !== s.cont) continue;
      if (fits(p, t)) pairs.push([c, t]);
    }
  });
  const mixed = rng.shuffle(pairs), used = new Set(), pick = [];
  for (const pr of mixed) if (pick.length < n && !used.has(pr[0])) { pick.push(pr); used.add(pr[0]); }
  // petit continent : on réutilise un pays avec un autre type de question
  for (const pr of mixed) if (pick.length < n && !pick.includes(pr)) pick.push(pr);
  s.qs = rng.shuffle(pick).map(([c, t]) => {
    const q = { t, c };
    if (s.rep === "qcm" && t !== "cont") q.ch = pickChoices(c, t, rng);
    return q;
  });
  return s;
}

export const toAct = F.flashToAct;
export const isQcm = (s, q) => q.t === "cont" || !!q.ch;

// réponses acceptées et réponses « d'un autre pays » (pour refuser Niger à la place de Nigeria)
export function accepted(q) {
  const p = COUNTRIES[q.c];
  if (q.t === "cap") return { goods: [p.c, ...p.calt], others: COUNTRIES.filter((x, j) => j !== q.c).flatMap((x) => [x.c, ...x.calt]) };
  return { goods: [p.n, ...p.alt], others: COUNTRIES.filter((x, j) => j !== q.c).flatMap((x) => [x.n, ...x.alt]) };
}

function judge(v, q) {
  const p = COUNTRIES[q.c];
  if (q.t === "cont") {
    if (!CONTINENTS.includes(v)) fail("Choisis un continent");
    return v === p.k;
  }
  if (q.ch) {
    if (!Number.isInteger(v) || !q.ch.includes(v)) fail("Choisis une des propositions");
    return v === q.c;
  }
  if (typeof v !== "string" || !v.trim()) fail("Écris ta réponse");
  if (v.length > 60) fail("Réponse trop longue");
  const { goods, others } = accepted(q);
  return F.typedMatches(v, goods, others);
}
const clean = (v) => (typeof v === "string" ? v.trim().slice(0, 40) : v);
export function reduce(s, pid, a) { return F.flashReduce(s, pid, a, judge, clean); }
export const result = F.flashResult;

// texte d'une réponse (choix de QCM ou texte tapé)
export function answerText(q, v) {
  if (q.t === "cont" || typeof v === "string") return String(v);
  const p = COUNTRIES[v];
  return p ? (q.t === "cap" ? p.c : p.n) : "?";
}

export function bot(s, pid, rng) {
  const q = F.question(s);
  const p = COUNTRIES[q.c];
  const right = F.botRight(s, rng, [0.45, 0.7, 0.9]);
  if (q.t === "cont") return { type: "answer", v: right ? p.k : rng.pick(CONTINENTS.filter((k) => k !== p.k)) };
  if (q.ch) return { type: "answer", v: right ? q.c : rng.pick(q.ch.filter((j) => j !== q.c)) };
  if (right) return { type: "answer", v: q.t === "cap" ? p.c : p.n };
  const near = COUNTRIES.filter((x, j) => j !== q.c && x.k === p.k && fits(x, q.t === "cap" ? "cap" : "drap"));
  const o = rng.pick(near.length ? near : COUNTRIES.filter((x, j) => j !== q.c));
  return { type: "answer", v: q.t === "cap" ? o.c : o.n };
}
export const auto = F.noAnswer;
export const botDelay = (s, pid, rng) => F.flashBotDelay(s, rng, s.rep === "taper" ? 1.5 : 1);
