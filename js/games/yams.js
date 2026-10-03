import { fail, rankByScore, rng as mkRng } from "../engine.js";

export const meta = {
  id: "yams", name: "Yams", cat: "Dés", min: 1, max: 6, turnTime: 45,
  color: "#9B51E0", desc: "Cinq dés, trois lancers, treize cases à remplir.",
  rules: ["À ton tour, lance les dés jusqu'à 3 fois. Touche un dé pour le garder.",
    "Inscris ensuite ton résultat dans une case libre (0 si la combinaison n'y est pas).",
    "Bonus de 35 points si le haut de la feuille atteint 63.",
    "Après 13 tours, le plus gros total gagne.",
    "En partie rapide, seule la partie basse compte (7 cases, pas de bonus).",
    "Options : nombre de lancers par tour, bonus de la partie haute, feuille complète ou rapide."],
};

export const CATS = [
  { id: "c1", name: "As", up: true }, { id: "c2", name: "Deux", up: true }, { id: "c3", name: "Trois", up: true },
  { id: "c4", name: "Quatre", up: true }, { id: "c5", name: "Cinq", up: true }, { id: "c6", name: "Six", up: true },
  { id: "brelan", name: "Brelan" }, { id: "carre", name: "Carré" }, { id: "full", name: "Full" },
  { id: "petite", name: "Petite suite" }, { id: "grande", name: "Grande suite" },
  { id: "yams", name: "Yams" }, { id: "chance", name: "Chance" },
];
export const CAT_HELP = {
  c1: "Somme des 1", c2: "Somme des 2", c3: "Somme des 3", c4: "Somme des 4", c5: "Somme des 5", c6: "Somme des 6",
  brelan: "3 dés identiques : somme des 5 dés", carre: "4 dés identiques : somme des 5 dés",
  full: "3 + 2 identiques : 25 points", petite: "4 dés qui se suivent : 30 points",
  grande: "5 dés qui se suivent : 40 points", yams: "5 dés identiques : 50 points", chance: "Somme des 5 dés",
};

export function scoreFor(cat, dice) {
  const cnt = [0, 0, 0, 0, 0, 0, 0];
  dice.forEach((d) => cnt[d]++);
  const sum = dice.reduce((a, b) => a + b, 0);
  const max = Math.max(...cnt);
  const has = (seq) => seq.every((v) => cnt[v] > 0);
  switch (cat) {
    case "c1": case "c2": case "c3": case "c4": case "c5": case "c6": {
      const v = +cat[1]; return cnt[v] * v;
    }
    case "brelan": return max >= 3 ? sum : 0;
    case "carre": return max >= 4 ? sum : 0;
    case "full": return cnt.includes(3) && cnt.includes(2) ? 25 : 0;
    case "petite": return has([1, 2, 3, 4]) || has([2, 3, 4, 5]) || has([3, 4, 5, 6]) ? 30 : 0;
    case "grande": return has([1, 2, 3, 4, 5]) || has([2, 3, 4, 5, 6]) ? 40 : 0;
    case "yams": return max === 5 ? 50 : 0;
    case "chance": return sum;
  }
  return 0;
}

// ------------------------------------------------ réglages
export const options = [
  { key: "rolls", label: "Lancers par tour", icon: "🎲",
    values: [[2, "2", "Corsé"], [3, "3", "Classique"], [4, "4", "Détente"]], def: 3 },
  { key: "bonus", label: "Bonus partie haute", icon: "⭐",
    values: [[0, "Aucun"], [35, "+35", "Classique"], [50, "+50", "Généreux"]], def: 35 },
  { key: "sheet", label: "Feuille", icon: "📋",
    values: [["full", "Complète", "13 cases"], ["quick", "Rapide", "7 cases"]], def: "full" },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "🎲", desc: "13 cases, 3 lancers, bonus de 35 si le haut atteint 63.",
    set: { rolls: 3, bonus: 35, sheet: "full" } },
  { id: "express", name: "Express", emoji: "⚡", desc: "Partie basse seulement : 7 tours pour briller.",
    set: { rolls: 3, bonus: 35, sheet: "quick" } },
  { id: "detente", name: "Détente", emoji: "🍹", desc: "4 lancers par tour et un bonus de 50 : les gros scores pleuvent.",
    set: { rolls: 4, bonus: 50, sheet: "full" } },
  { id: "hardcore", name: "Sans filet", emoji: "🔥", desc: "2 lancers seulement et aucun bonus : chaque choix compte.",
    set: { rolls: 2, bonus: 0, sheet: "full" } },
];
export function opt(settings, key) {
  const o = options.find((x) => x.key === key);
  const v = settings ? settings[key] : undefined;
  const hit = o.values.find((x) => String(x[0]) === String(v));
  return hit ? hit[0] : o.def;
}
// cases de la feuille choisie, et réglages avec repli pour les anciennes parties
export const catsFor = (sheetType) => (sheetType === "quick" ? CATS.filter((c) => !c.up) : CATS);
export const catsOf = (s) => catsFor(s.sheet);
export const maxRolls = (s) => s.maxRolls || 3;
export const bonusOf = (s) => (s.bonus == null ? 35 : s.bonus);

export function totals(sheet, bonusAmt = 35) {
  let up = 0, down = 0;
  for (const c of CATS) {
    const v = sheet[c.id];
    if (v == null) continue;
    if (c.up) up += v; else down += v;
  }
  const bonus = up >= 63 ? bonusAmt : 0;
  return { up, bonus, down, total: up + bonus + down };
}

export function setup(players, settings, rng) {
  const sheets = {};
  const sheet = opt(settings, "sheet");
  players.forEach((p) => (sheets[p.id] = Object.fromEntries(catsFor(sheet).map((c) => [c.id, null]))));
  return { order: rng.shuffle(players.map((p) => p.id)), cur: 0, dice: [1, 1, 1, 1, 1], held: [false, false, false, false, false],
    rolls: 0, sheets, turnNo: 0, last: null, done: false,
    maxRolls: opt(settings, "rolls"), bonus: opt(settings, "bonus"), sheet };
}

export function toAct(s) { return s.done ? [] : [s.order[s.cur]]; }

export function reduce(s, pid, a) {
  if (toAct(s)[0] !== pid) fail("Ce n'est pas ton tour");
  if (a.type === "roll") {
    if (s.rolls >= maxRolls(s)) fail("Plus de lancer : choisis une case");
    const held = s.rolls === 0 ? [false, false, false, false, false] : (a.held || s.held).map(Boolean).slice(0, 5);
    if (held.length !== 5) fail("Dés invalides");
    const r = mkRng(a.seed || 1);
    s.dice = s.dice.map((d, i) => (held[i] ? d : 1 + r.int(6)));
    s.held = held;
    s.rolls++;
    return s;
  }
  if (a.type === "score") {
    if (s.rolls === 0) fail("Lance d'abord les dés");
    const sheet = s.sheets[pid];
    if (!(a.cat in sheet)) fail("Case inconnue");
    if (sheet[a.cat] != null) fail("Case déjà remplie");
    const pts = scoreFor(a.cat, s.dice);
    sheet[a.cat] = pts;
    s.last = { id: pid, cat: a.cat, pts, dice: s.dice.slice() };
    s.rolls = 0;
    s.held = [false, false, false, false, false];
    s.cur = (s.cur + 1) % s.order.length;
    if (s.cur === 0) s.turnNo++;
    if (s.turnNo >= catsOf(s).length) s.done = true;
    return s;
  }
  fail("Action inconnue");
}

export function result(s) {
  if (!s.done) return null;
  return { ranking: rankByScore(s.order.map((id) => ({ id, score: totals(s.sheets[id], bonusOf(s)).total }))) };
}

// ---------- robot : garde la meilleure piste, puis choisit la case la plus rentable
function bestCat(sheet, dice, bonusAmt = 35) {
  let best = null, bestV = -Infinity;
  const upTotal = totals(sheet).up;
  for (const c of CATS) {
    if (!(c.id in sheet) || sheet[c.id] != null) continue;
    const pts = scoreFor(c.id, dice);
    let v = pts;
    if (c.up) {
      const face = +c.id[1];
      if (bonusAmt > 0) {
        v += (pts - face * 3) * 1.2; // viser 3 exemplaires par face pour le bonus
        if (upTotal < 63 && upTotal + pts >= 63) v += bonusAmt - 5;
      }
    }
    if (c.id === "chance") v -= 14;
    if (c.id === "yams" && pts === 0) v -= 12;
    if (pts === 0) v -= ({ grande: 8, petite: 6, full: 5, carre: 2, brelan: 3 }[c.id] || 0);
    if (v > bestV) { bestV = v; best = c.id; }
  }
  return best;
}

function keepPlan(sheet, dice) {
  const cnt = [0, 0, 0, 0, 0, 0, 0];
  dice.forEach((d) => cnt[d]++);
  const open = (id) => id in sheet && sheet[id] == null;
  // suites
  const runs = [[1, 2, 3, 4, 5], [2, 3, 4, 5, 6], [3, 4, 5, 6], [2, 3, 4, 5], [1, 2, 3, 4]];
  if (open("grande") || open("petite")) {
    for (const run of runs) {
      const have = run.filter((v) => cnt[v] > 0).length;
      if (have >= run.length - 1 && have >= 4) {
        const used = new Set();
        return dice.map((d, i) => (run.includes(d) && !used.has(d) ? (used.add(d), true) : false));
      }
    }
  }
  if (open("full") && cnt.includes(3) && cnt.includes(2)) return dice.map(() => true);
  // garder la face la plus nombreuse (les plus hautes à égalité)
  let face = 6;
  for (let v = 6; v >= 1; v--) if (cnt[v] > cnt[face]) face = v;
  return dice.map((d) => d === face);
}

export function bot(s, pid) {
  const sheet = s.sheets[pid];
  if (s.rolls === 0) return { type: "roll", held: [false, false, false, false, false] };
  const cat = bestCat(sheet, s.dice, bonusOf(s));
  const pts = scoreFor(cat, s.dice);
  const great = ["yams", "grande", "full"].includes(cat) && pts > 0;
  if (s.rolls < maxRolls(s) && !great) return { type: "roll", held: keepPlan(sheet, s.dice) };
  return { type: "score", cat };
}
export function auto(s, pid) {
  if (s.rolls === 0) return { type: "roll", held: [false, false, false, false, false] };
  return { type: "score", cat: bestCat(s.sheets[pid], s.dice, bonusOf(s)) };
}
