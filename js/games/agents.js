import { fail, rankByScore, rng as mkRng } from "../engine.js";
import { WORDS, THEME, GROUPS, ASSOC } from "../data/agents_mots.js";
import { optOf, levelOf, makeTeams, teamOf, teamResult, tokens, bannedHit, same, related, pushLog } from "./lib/devinette.js";

export const meta = {
  id: "agents", name: "Agents secrets", cat: "Soirée", min: 4, max: 8, turnTime: 90,
  color: "#475569", desc: "Deux équipes d'espions, une grille de 25 mots, un indice à la fois.",
  rules: ["Deux équipes, Rouges et Bleus. Dans chaque équipe, un chef espion voit la carte secrète : quels mots sont à son équipe, à l'autre, neutres, et l'assassin.",
    "À son tour, le chef tape un indice : un seul mot (absent de la grille) et un nombre, le nombre de mots de son équipe liés à cet indice.",
    "Ses coéquipiers touchent les mots un par un. Bon mot : on continue (jusqu'au nombre, plus un essai bonus). Mot neutre ou adverse : le tour passe.",
    "L'équipe qui découvre tous ses mots gagne la manche. Toucher l'assassin fait perdre la manche aussitôt.",
    "L'équipe qui commence a 9 mots, l'autre 8. Les chefs changent à chaque manche.",
    "Options : nombre de manches, d'assassins, essai bonus, mots groupés par thèmes ou mélangés."],
};

export const options = [
  { key: "rounds", label: "Manches", icon: "🔁", values: [[1, "1", "Partie simple"], [3, "3", "Au meilleur de 3"]], def: 1 },
  { key: "assassin", label: "Assassins", icon: "💀", values: [[0, "Aucun", "Sans risque"], [1, "1", "Classique"], [3, "3", "Très risqué"]], def: 1 },
  { key: "bonus", label: "Essai bonus", icon: "➕", values: [[true, "+1", "Nombre + 1"], [false, "Non", "Juste le nombre"]], def: true },
  { key: "themes", label: "Grille", icon: "🧩", values: [[true, "Thèmes", "Mots qui se lient"], [false, "Mélangée", "Plus dur"]], def: true },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "🕵️", desc: "Une manche, un assassin, mots groupés par thèmes.", set: { rounds: 1, assassin: 1, bonus: true, themes: true } },
  { id: "tranquille", name: "Sans assassin", emoji: "🕊️", desc: "Aucun piège mortel : idéal pour découvrir le jeu.", set: { rounds: 1, assassin: 0, bonus: true, themes: true } },
  { id: "tournoi", name: "Tournoi", emoji: "🏆", desc: "Au meilleur des 3 manches, les chefs tournent.", set: { rounds: 3, assassin: 1, bonus: true, themes: true } },
  { id: "expert", name: "Expert", emoji: "💀", desc: "3 assassins, grille mélangée, pas d'essai bonus.", set: { rounds: 1, assassin: 3, bonus: false, themes: false } },
];
const opt = (settings, key) => optOf(options, settings, key);

export const RED = 0, BLUE = 1, NEUTRAL = 2, KILLER = 3;

// ------------------------------------------------ grille
export function makeGrid(r, themed, starter, assassins) {
  let words;
  if (themed) {
    const groups = r.shuffle(GROUPS.map((_, i) => i)).slice(0, 7);
    const pools = groups.map((g) => r.shuffle(WORDS.filter((w) => THEME[w] === g)));
    words = [];
    for (let k = 0; words.length < 25; k++) words.push(pools[k % 7].pop());
    words = r.shuffle(words);
  } else words = r.shuffle(WORDS).slice(0, 25);
  const key = [];
  for (let i = 0; i < 9; i++) key.push(starter);
  for (let i = 0; i < 8; i++) key.push(1 - starter);
  for (let i = 0; i < assassins; i++) key.push(KILLER);
  while (key.length < 25) key.push(NEUTRAL);
  return { words, key: r.shuffle(key), open: Array(25).fill(0) };
}

function newManche(s, r) {
  const g = makeGrid(r, s.themes, s.starter, s.assassins);
  s.words = g.words; s.key = g.key; s.open = g.open;
  s.team = s.starter; s.phase = "clue"; s.clue = null; s.left = 0; s.touched = 0;
}

export function setup(players, settings, r) {
  const ids = players.map((p) => p.id);
  const s = { ids, teams: makeTeams(ids), chiefIdx: [0, 0], manches: opt(settings, "rounds"), manche: 1, wins: [0, 0],
    assassins: opt(settings, "assassin"), bonus: opt(settings, "bonus"), themes: opt(settings, "themes"), level: levelOf(settings),
    starter: r.int(2), log: [], last: null, done: false };
  newManche(s, r);
  return s;
}

export const chiefOf = (s, t) => s.teams[t][s.chiefIdx[t] % s.teams[t].length];
export const isChief = (s, id) => chiefOf(s, 0) === id || chiefOf(s, 1) === id;
export const agentsOf = (s, t) => s.teams[t].filter((id) => id !== chiefOf(s, t));
export const remaining = (s, t) => s.key.filter((c, i) => c === t && !s.open[i]).length;

export function toAct(s) {
  if (s.done) return [];
  return s.phase === "clue" ? [chiefOf(s, s.team)] : agentsOf(s, s.team);
}

// l'indice est-il valable ? (null si oui, sinon le message d'erreur)
export function checkClue(s, word, n) {
  const t = tokens(word);
  if (!t.length) return "Tape un mot";
  if (t.length > 1) return "Un seul mot, sans espace ni tiret";
  if (t[0].length < 2) return "Mot trop court";
  const hit = bannedHit(word, s.words);
  if (hit) return `« ${hit} » est dans la grille : interdit`;
  if (!Number.isInteger(n) || n < 1 || n > 9) return "Choisis un nombre entre 1 et 9";
  return null;
}

function switchTurn(s) { s.team = 1 - s.team; s.phase = "clue"; s.clue = null; s.left = 0; s.touched = 0; }

function endManche(s, w, why, seed) {
  s.wins[w]++;
  s.last = { manche: s.manche, winner: w, why, words: s.words, key: s.key, open: s.open };
  const need = Math.floor(s.manches / 2) + 1;
  if (s.manche >= s.manches || s.wins[w] >= need) { s.done = true; return; }
  s.manche++;
  s.starter = 1 - s.starter;
  s.chiefIdx = [s.chiefIdx[0] + 1, s.chiefIdx[1] + 1];
  s.log = [];
  newManche(s, mkRng(seed || 1));
}

export function reduce(s, pid, a) {
  if (s.done) fail("La partie est terminée");
  if (!toAct(s).includes(pid)) fail(s.phase === "clue" ? "C'est au chef espion de donner un indice" : "Ce n'est pas à ton équipe de jouer");
  if (a.type === "clue") {
    if (s.phase !== "clue") fail("L'indice est déjà donné");
    const n = +a.n;
    const err = checkClue(s, a.word, n);
    if (err) fail(err);
    const w = String(a.word).trim().slice(0, 24);
    s.clue = { w, n, by: pid };
    s.left = n + (s.bonus ? 1 : 0);
    s.touched = 0;
    s.phase = "guess";
    pushLog(s, { k: "clue", t: s.team, w, n, by: pid });
    return s;
  }
  if (a.type === "touch") {
    if (s.phase !== "guess") fail("Attends l'indice");
    const i = +a.i;
    if (!(i >= 0 && i < 25) || s.open[i]) fail("Ce mot est déjà découvert");
    s.open[i] = 1;
    const c = s.key[i], t = s.team;
    pushLog(s, { k: "touch", t, i, c, by: pid });
    if (c === KILLER) { endManche(s, 1 - t, "assassin", a.seed); return s; }
    if (remaining(s, RED) === 0) { endManche(s, RED, "tout", a.seed); return s; }
    if (remaining(s, BLUE) === 0) { endManche(s, BLUE, "tout", a.seed); return s; }
    if (c === t) { s.left--; s.touched++; if (s.left <= 0) switchTurn(s); }
    else switchTurn(s);
    return s;
  }
  if (a.type === "pass") {
    if (s.phase !== "guess") fail("Attends l'indice");
    if (!s.touched && !a.auto) fail("Touche au moins un mot avant de passer");
    pushLog(s, { k: "pass", t: s.team, by: pid });
    switchTurn(s);
    return s;
  }
  fail("Action inconnue");
}

export function result(s) {
  if (!s.done) return null;
  return teamResult(s.teams, s.wins, rankByScore);
}

// ------------------------------------------------ robots
// mots de la grille (non découverts) qu'un indice évoque, d'après la table d'associations
export function targetsOf(s, clue) {
  let words = null;
  const hit = ASSOC.filter((x) => same(clue, x.clue));
  if (hit.length) words = hit.flatMap((x) => x.words);
  else {
    const bank = WORDS.filter((w) => related(clue, w));
    if (bank.length) words = WORDS.filter((w) => bank.some((b) => THEME[b] === THEME[w]));
  }
  if (!words) return [];
  return s.words.map((w, i) => (words.includes(w) && !s.open[i] ? i : -1)).filter((i) => i >= 0);
}

export function chiefClue(s, t, r, level = s.level) {
  let best = null;
  for (const x of ASSOC) {
    if (bannedHit(x.clue, s.words)) continue;
    const cov = s.words.map((w, i) => (x.words.includes(w) && !s.open[i] ? s.key[i] : -1)).filter((c) => c >= 0);
    const own = cov.filter((c) => c === t).length;
    if (!own) continue;
    const opp = cov.filter((c) => c === 1 - t).length, neu = cov.filter((c) => c === NEUTRAL).length, kill = cov.filter((c) => c === KILLER).length;
    let v;
    if (level >= 3) { if (kill || opp) continue; v = own - neu * 0.4; }
    else if (level === 2) { if (kill) continue; v = own - opp * 0.9 - neu * 0.4; }
    else v = Math.min(own, 2) - opp * 0.4 - kill * 0.6 - neu * 0.2;
    v += r.next() * 0.3;
    if (!best || v > best.v) best = { v, w: x.clue, n: own };
  }
  if (!best) { // tout est risqué : on vise un seul mot
    const mine = s.words.findIndex((w, i) => s.key[i] === t && !s.open[i]);
    const x = ASSOC.find((y) => !y.theme && y.words.includes(s.words[mine]) && !bannedHit(y.clue, s.words)) || ASSOC.find((y) => y.words.includes(s.words[mine]));
    best = { w: x.clue, n: 1 };
  }
  return { type: "clue", word: best.w, n: Math.max(1, Math.min(9, level === 1 ? Math.min(best.n, 2) : best.n)) };
}

export function bot(s, pid, r) {
  if (s.done || !toAct(s).includes(pid)) return null;
  if (s.phase === "clue") return chiefClue(s, s.team, r);
  const hidden = s.words.map((_, i) => i).filter((i) => !s.open[i]);
  if (s.touched >= s.clue.n) return { type: "pass" };
  const tg = targetsOf(s, s.clue.w);
  const acc = { 1: 0.6, 2: 0.8, 3: 0.93 }[s.level] || 0.8;
  if (!tg.length) {
    if (s.touched) return { type: "pass" };
    return { type: "touch", i: r.pick(hidden) };
  }
  if (r.next() < acc) return { type: "touch", i: r.pick(tg) };
  const others = hidden.filter((i) => !tg.includes(i));
  return { type: "touch", i: r.pick(others.length ? others : tg) };
}
export function auto(s, pid, r) {
  if (s.phase === "guess" && s.touched) return { type: "pass" };
  return bot(s, pid, r);
}
export function botDelay(s, pid, r) {
  return (s.phase === "clue" ? 3500 : 2000) * (0.7 + r.next() * 0.8);
}
export { teamOf };
