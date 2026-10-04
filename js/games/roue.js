import { fail, rankByScore, rng as mkRng } from "../engine.js";
import { PHRASES } from "../data/roue_phrases.js";

export const meta = {
  id: "roue", name: "La roue des mots", cat: "Mots", min: 2, max: 4, turnTime: 30,
  color: "#F59E0B", desc: "Fais tourner la roue, propose des lettres et devine l'expression cachée.",
  rules: ["Une expression, un proverbe ou un titre est caché. Sa catégorie est affichée.",
    "À ton tour : fais tourner la roue puis propose une consonne. Tu gagnes le montant multiplié par le nombre de fois où elle apparaît, et tu rejoues.",
    "Consonne absente ou déjà proposée : la main passe au joueur suivant.",
    "Banqueroute : ta cagnotte de la manche tombe à 0 et tu passes la main. Passe : tu passes juste la main.",
    "Tu peux acheter une voyelle avec ta cagnotte de manche. Si elle n'y est pas, tu passes la main.",
    "Quand tu penses savoir, résous ! Bonne réponse : ta cagnotte de manche (au moins 300) rejoint ton total. Les autres perdent la leur.",
    "Les accents ne comptent pas : E dévoile aussi É, È, Ê.",
    "Après toutes les manches, le plus gros total gagne.",
    "Options : nombre de manches, prix des voyelles, roue plus ou moins risquée, thème des énigmes."],
};

export const options = [
  { key: "rounds", label: "Manches", icon: "🔁", values: [[3, "3", "Rapide"], [4, "4", "Standard"], [6, "6", "Longue"]], def: 4 },
  { key: "vowel", label: "Prix voyelle", icon: "🅰️", values: [[250, "250", "Officiel"], [100, "100", "Pas chère"], [500, "500", "Chère"]], def: 250 },
  { key: "wheel", label: "Roue", icon: "🎡",
    values: [["classique", "Classique", "2 banqueroutes"], ["risque", "Risquée", "4 banqueroutes"], ["douce", "Douce", "Sans banqueroute"]], def: "classique" },
  { key: "theme", label: "Thème", icon: "📚",
    values: [["tout", "Tout", "Toutes catégories"], ["dictons", "Dictons", "Expressions"], ["culture", "Culture", "Titres et héros"]], def: "tout" },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "🎡", desc: "4 manches, voyelle à 250, toutes les catégories.", set: { rounds: 4, vowel: 250, wheel: "classique", theme: "tout" } },
  { id: "express", name: "Express", emoji: "⚡", desc: "3 manches, roue sans banqueroute, voyelles pas chères.", set: { rounds: 3, vowel: 100, wheel: "douce", theme: "tout" } },
  { id: "risque", name: "Quitte ou double", emoji: "💣", desc: "Gros lots et 4 banqueroutes : ça passe ou ça casse.", set: { rounds: 4, vowel: 250, wheel: "risque", theme: "tout" } },
  { id: "dictons", name: "Dictons", emoji: "🗣️", desc: "Uniquement des expressions et des proverbes.", set: { rounds: 4, vowel: 250, wheel: "classique", theme: "dictons" } },
];
export function opt(settings, key) {
  const o = options.find((x) => x.key === key);
  const v = settings ? settings[key] : undefined;
  const hit = o.values.find((x) => x[0] === v || (v != null && String(x[0]) === String(v)));
  return hit ? hit[0] : o.def;
}

// B = banqueroute, P = passe
export const WHEELS = {
  classique: [500, 200, 300, "B", 400, 150, 600, 250, "P", 800, 200, 350, 1000, 150, 300, "B", 450, 250, 700, 200, 500, 300, 400, 900],
  risque: [500, 1500, 300, "B", 400, "B", 600, 250, "P", 2000, 200, "B", 1000, 150, 300, "B", 450, 250, 700, "P", 500, 300, 1200, 900],
  douce: [500, 200, 300, 600, 400, 150, 600, 250, "P", 800, 200, 350, 1000, 150, 300, 300, 450, 250, 700, 200, 500, 300, 400, 900],
};
export const VOWELS = "AEIOU";
export const CONSONANTS = "BCDFGHJKLMNPQRSTVWXYZ";
export const MIN_WIN = 300;
const THEMES = { dictons: ["Expression", "Proverbe"], culture: ["Film", "Livre", "Personnage", "Lieu célèbre"] };

// lettre sans accent (ou "" si ce n'est pas une lettre)
export const base = (ch) => { const u = ch.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase(); return /^[A-Z]$/.test(u) ? u : ""; };
export const normText = (t) => [...String(t || "")].map(base).join("");
export const lettersOf = (text) => normText(text);
export const countOf = (text, l) => [...lettersOf(text)].filter((c) => c === l).length;
export const hiddenLeft = (s, set) => [...new Set(lettersOf(s.text))].filter((c) => !s.called.includes(c) && (!set || set.includes(c)));
export const shownRatio = (s) => { const L = lettersOf(s.text); return [...L].filter((c) => s.called.includes(c)).length / L.length; };
export const wheelOf = (s) => WHEELS[s.wheel] || WHEELS.classique;

export function pool(theme) {
  const cats = THEMES[theme];
  return PHRASES.map((p, i) => i).filter((i) => !cats || cats.includes(PHRASES[i][0]));
}

function newPuzzle(s, r) {
  const all = pool(s.theme);
  const free = all.filter((i) => !s.usedP.includes(i));
  const i = r.pick(free.length ? free : all);
  s.usedP.push(i);
  s.cat = PHRASES[i][0]; s.text = PHRASES[i][1];
  s.called = ""; s.phase = "spin"; s.seg = -1;
  for (const id of s.order) s.bank[id] = 0;
  s.cur = (s.manche - 1) % s.order.length;
}

export function setup(players, settings, rng) {
  const order = rng.shuffle(players.map((p) => p.id));
  const s = {
    order, cur: 0, manche: 1, rounds: opt(settings, "rounds"), vowel: opt(settings, "vowel"),
    wheel: opt(settings, "wheel"), theme: opt(settings, "theme"),
    bank: {}, total: Object.fromEntries(order.map((id) => [id, 0])), usedP: [],
    cat: "", text: "", called: "", phase: "spin", seg: -1, spinNo: 0, log: null, last: null, over: false,
    level: [1, 2, 3].includes(settings.level) ? settings.level : 2,
  };
  newPuzzle(s, rng);
  return s;
}

export const toAct = (s) => (s.over ? [] : [s.order[s.cur]]);
const nextPlayer = (s) => { s.cur = (s.cur + 1) % s.order.length; s.phase = "spin"; s.seg = -1; };

function winRound(s, pid, seed, how) {
  const gain = Math.max(s.bank[pid], MIN_WIN);
  s.total[pid] += gain;
  s.last = { manche: s.manche, id: pid, text: s.text, cat: s.cat, gain, how };
  s.log = { id: pid, t: "win", gain };
  if (s.manche >= s.rounds) { s.over = true; s.called = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"; return; }
  s.manche++;
  newPuzzle(s, mkRng(seed || 1));
}
const complete = (s) => hiddenLeft(s).length === 0;

export function reduce(s, pid, a) {
  if (toAct(s)[0] !== pid) fail("Ce n'est pas ton tour");
  const t = a.type;
  if (t === "spin") {
    if (s.phase !== "spin") fail("Choisis d'abord une consonne");
    if (!hiddenLeft(s, CONSONANTS).length) fail("Plus de consonnes cachées : achète une voyelle ou résous");
    const W = wheelOf(s);
    const seg = mkRng(a.seed || 1).int(W.length), v = W[seg];
    s.seg = seg; s.spinNo++;
    if (v === "B") { s.log = { id: pid, t: "bank", lost: s.bank[pid] }; s.bank[pid] = 0; nextPlayer(s); s.seg = seg; }
    else if (v === "P") { s.log = { id: pid, t: "passe" }; nextPlayer(s); s.seg = seg; }
    else { s.phase = "letter"; s.log = { id: pid, t: "spin", v }; }
    return s;
  }
  if (t === "letter") {
    if (s.phase !== "letter") fail("Fais d'abord tourner la roue");
    const l = String(a.l || "").toUpperCase();
    if (!CONSONANTS.includes(l) || l.length !== 1) fail("Choisis une consonne");
    const v = wheelOf(s)[s.seg];
    if (s.called.includes(l)) { s.log = { id: pid, t: "dup", l }; nextPlayer(s); return s; }
    s.called += l;
    const n = countOf(s.text, l);
    s.log = { id: pid, t: "letter", l, n, gain: n * v };
    if (!n) { nextPlayer(s); return s; }
    s.bank[pid] += n * v;
    s.phase = "spin"; s.seg = -1;
    if (complete(s)) winRound(s, pid, a.seed, "lettres");
    return s;
  }
  if (t === "vowel") {
    if (s.phase !== "spin") fail("Choisis d'abord une consonne");
    const l = String(a.l || "").toUpperCase();
    if (!VOWELS.includes(l) || l.length !== 1) fail("Choisis une voyelle");
    if (s.called.includes(l)) fail("Voyelle déjà proposée");
    if (s.bank[pid] < s.vowel) fail(`Il te faut ${s.vowel} dans ta cagnotte pour une voyelle`);
    s.bank[pid] -= s.vowel;
    s.called += l;
    const n = countOf(s.text, l);
    s.log = { id: pid, t: "vowel", l, n };
    if (!n) { nextPlayer(s); return s; }
    if (complete(s)) winRound(s, pid, a.seed, "lettres");
    return s;
  }
  if (t === "solve") {
    if (s.phase !== "spin") fail("Choisis d'abord une consonne");
    const guess = normText(a.text);
    if (!guess) fail("Écris ta réponse");
    if (guess === normText(s.text)) { winRound(s, pid, a.seed, "résolu"); return s; }
    s.log = { id: pid, t: "wrong", text: String(a.text).slice(0, 60) };
    nextPlayer(s);
    return s;
  }
  fail("Action inconnue");
}

export function result(s) {
  if (!s.over) return null;
  return { ranking: rankByScore(s.order.map((id) => ({ id, score: s.total[id] }))) };
}

// ------------------------------------------------ robots
const FREQ_C = "SRTNLCDPMVGBFQHJXYZKW".split("");
const FREQ_V = "EAIUO".split("");
function pickLetter(order, called, lvl, r) {
  const free = order.filter((c) => !called.includes(c));
  if (!free.length) return null;
  if (lvl >= 3) return free[0];
  if (lvl === 2) return free[Math.min(free.length - 1, Math.floor(r.next() * r.next() * 4))];
  return free[Math.floor(r.next() * Math.min(free.length, 10))];
}

export function bot(s, pid, r) {
  if (toAct(s)[0] !== pid) return null;
  const lvl = s.level || 2;
  if (s.phase === "letter") return { type: "letter", l: pickLetter(FREQ_C, s.called, lvl, r) || FREQ_C[0] };
  const ratio = shownRatio(s);
  const thr = [0, 0.8, 0.68, 0.55][lvl];
  const canVowel = s.bank[pid] >= s.vowel && FREQ_V.some((c) => !s.called.includes(c));
  const consLeft = hiddenLeft(s, CONSONANTS).length > 0;
  if (ratio >= thr) return { type: "solve", text: s.text };
  if (!consLeft) return canVowel ? { type: "vowel", l: pickLetter(FREQ_V, s.called, 3, r) } : { type: "solve", text: s.text };
  if (canVowel && s.called.length >= 2 && r.next() < (lvl >= 3 ? 0.45 : 0.25)) return { type: "vowel", l: pickLetter(FREQ_V, s.called, lvl, r) };
  return { type: "spin" };
}
// temps écoulé : on tourne la roue (ou on choisit la consonne la plus courante)
export function auto(s, pid, r) {
  if (toAct(s)[0] !== pid) return null;
  if (s.phase === "letter") return { type: "letter", l: pickLetter(FREQ_C, s.called, 3, r) || FREQ_C[0] };
  if (hiddenLeft(s, CONSONANTS).length) return { type: "spin" };
  return bot({ ...s, level: 1 }, pid, r);
}
export function botDelay(s, pid, r) {
  const anim = s.phase === "letter" || (s.log && ["bank", "passe"].includes(s.log.t));
  return (anim ? 3300 : 1100) + r.int(900);
}
