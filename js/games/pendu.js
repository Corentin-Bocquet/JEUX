import { fail, rankByScore, rng as mkRng } from "../engine.js";
import { PENDU_MOTS } from "../data/pendu_mots.js";
import { isWord, normWord } from "../data/dico.js";

export const meta = {
  id: "pendu", name: "Pendu", cat: "Mots", min: 2, max: 6, turnTime: 30,
  color: "#F97316", desc: "Devine le mot lettre par lettre avant que le ballon se dégonfle.",
  rules: ["Un mot secret est caché. Chacun son tour, propose une lettre.",
    "Bonne lettre : 10 points par case révélée, et tu rejoues.",
    "Mauvaise lettre : le ballon perd un morceau et la main passe. Ballon à plat : personne ne gagne la manche.",
    "Tu peux tenter le mot entier : juste, tu gagnes 10 points par lettre encore cachée + 20. Faux, le ballon se dégonfle.",
    "Celui qui complète le mot gagne 20 points de bonus. Le meilleur total après toutes les manches gagne.",
    "Mode Maître du mot : à chaque manche, un joueur choisit le mot des autres. Il gagne 5 points par erreur et 20 si le ballon éclate."],
};

export const options = [
  { key: "rounds", label: "Manches", icon: "🔁", values: [[3, "3", "Express"], [5, "5", "Standard"], [8, "8", "Marathon"]], def: 5 },
  { key: "lives", label: "Ballon", icon: "🎈", values: [[6, "6 erreurs", "Fragile"], [8, "8 erreurs", "Normal"], [10, "10 erreurs", "Costaud"]], def: 8 },
  { key: "master", label: "Le mot", icon: "🎩", values: [[false, "Au hasard", "Tiré dans la liste"], [true, "Maître", "Un joueur choisit"]], def: false },
  { key: "cat", label: "Catégorie", icon: "🏷️", values: [[true, "Affichée"], [false, "Cachée", "Sans indice"]], def: true },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "🎈", desc: "5 manches, mots tirés au sort, catégorie affichée.", set: { rounds: 5, lives: 8, master: false, cat: true } },
  { id: "maitre", name: "Maître du mot", emoji: "🎩", desc: "À tour de rôle, un joueur choisit le mot des autres.", set: { rounds: 5, lives: 8, master: true, cat: true } },
  { id: "express", name: "Express", emoji: "⚡", desc: "3 manches et un ballon fragile : 6 erreurs.", set: { rounds: 3, lives: 6, master: false, cat: true } },
  { id: "sansindice", name: "Sans indice", emoji: "🙈", desc: "Catégorie cachée, mais 10 erreurs permises.", set: { rounds: 5, lives: 10, master: false, cat: false } },
];
export function opt(settings, key) {
  const o = options.find((x) => x.key === key);
  const v = settings ? settings[key] : undefined;
  const hit = o.values.find((x) => x[0] === v || (v != null && String(x[0]) === String(v)));
  return hit ? hit[0] : o.def;
}

// ------------------------------------------------ mots
export const CATS = Object.keys(PENDU_MOTS);
export const WORDS = [];
for (const c of CATS) for (const w of PENDU_MOTS[c].split(/\s+/)) if (w) WORDS.push({ w, c });
const byLen = {};
for (const x of WORDS) (byLen[x.w.length] ||= []).push(x.w);

export const FREQ = "EASINTRLUODCPMVGFBQHXJYZKW";
export const PTS_LETTER = 10, BONUS = 20, MASTER_ERR = 5;

function drawWords(s, rng, n) {
  const out = [];
  for (let k = 0; k < 200 && out.length < n; k++) {
    const x = rng.pick(WORDS);
    if (!s.used.includes(x.w) && !out.some((o) => o.w === x.w)) out.push({ w: x.w, c: x.c });
  }
  return out;
}

function newRound(s, rng) {
  s.found = []; s.wrong = []; s.badWords = []; s.errors = 0; s.last = null; s.win = null;
  const n = s.ids.length;
  if (s.master) {
    s.masterId = s.ids[(s.roundNo - 1) % n];
    s.guessers = s.ids.filter((id) => id !== s.masterId);
    s.sugg = drawWords(s, rng, 3);
    s.word = ""; s.cat = "";
    s.phase = "choose";
  } else {
    s.masterId = null;
    s.guessers = s.ids.slice();
    const [x] = drawWords(s, rng, 1);
    s.word = x.w; s.cat = x.c; s.sugg = [];
    s.used.push(x.w);
    s.phase = "guess";
  }
  s.turn = (s.roundNo - 1) % s.guessers.length;
}

export function setup(players, settings, rng) {
  const s = { ids: players.map((p) => p.id), rounds: opt(settings, "rounds"), lives: opt(settings, "lives"), master: opt(settings, "master"),
    showCat: opt(settings, "cat"), level: [1, 2, 3].includes(settings.level) ? settings.level : 2, roundNo: 1, scores: {}, used: [], history: [], done: false };
  players.forEach((p) => (s.scores[p.id] = 0));
  newRound(s, rng);
  return s;
}

export const hidden = (s) => [...new Set(s.word.split(""))].filter((c) => !s.found.includes(c));
export const mask = (s) => s.word.split("").map((c) => (s.found.includes(c) ? c : "_")).join("");
const nextStarter = (s) => s.ids[s.roundNo % s.ids.length];

export function toAct(s) {
  if (s.done) return [];
  if (s.phase === "choose") return [s.masterId];
  if (s.phase === "end") return [nextStarter(s)];
  return [s.guessers[s.turn]];
}

function endRound(s, winner) {
  s.phase = "end";
  s.win = winner;
  if (!winner && s.masterId) s.scores[s.masterId] += BONUS;
  s.history.push({ word: s.word, win: winner });
  s.found = [...new Set(s.word.split(""))];
}
function miss(s) {
  s.errors++;
  if (s.masterId) s.scores[s.masterId] += MASTER_ERR;
  if (s.errors >= s.lives) endRound(s, null);
  else s.turn = (s.turn + 1) % s.guessers.length;
}

export function checkFree(w) {
  const u = normWord(w);
  if (u.length < 4 || u.length > 12) return "Choisis un mot de 4 à 12 lettres";
  if (!isWord(u)) return "Mot inconnu du dictionnaire";
  return null;
}

export function reduce(s, pid, a) {
  if (!toAct(s).includes(pid)) fail("Ce n'est pas ton tour");
  if (s.phase === "choose") {
    if (a.type !== "choose") fail("Choisis d'abord le mot");
    const u = normWord(a.word);
    const sug = s.sugg.find((x) => x.w === u);
    if (!sug) { const e = checkFree(u); if (e) fail(e); }
    s.word = u; s.cat = sug ? sug.c : "Mot libre"; s.used.push(u); s.sugg = [];
    s.phase = "guess";
    return s;
  }
  if (s.phase === "end") {
    if (a.type !== "next") fail("Lance la manche suivante");
    if (s.roundNo >= s.rounds) { s.done = true; return s; }
    s.roundNo++;
    newRound(s, mkRng(a.seed || s.roundNo));
    return s;
  }
  if (a.type === "letter") {
    const L = normWord(a.letter);
    if (L.length !== 1) fail("Une seule lettre");
    if (s.found.includes(L) || s.wrong.includes(L)) fail("Lettre déjà proposée");
    const n = s.word.split("").filter((c) => c === L).length;
    s.last = { id: pid, k: "l", v: L, n };
    if (n) {
      s.found.push(L);
      s.scores[pid] += PTS_LETTER * n;
      if (!hidden(s).length) { s.scores[pid] += BONUS; endRound(s, pid); }
    } else { s.wrong.push(L); miss(s); }
    return s;
  }
  if (a.type === "word") {
    const u = normWord(a.word);
    if (u.length !== s.word.length) fail(`Le mot fait ${s.word.length} lettres`);
    if (s.badWords.includes(u)) fail("Ce mot a déjà été tenté");
    if (u === s.word) {
      const left = s.word.split("").filter((c) => !s.found.includes(c)).length;
      s.scores[pid] += PTS_LETTER * left + BONUS;
      s.last = { id: pid, k: "w", v: u, n: left };
      endRound(s, pid);
    } else {
      s.badWords.push(u);
      s.last = { id: pid, k: "w", v: u, n: 0 };
      miss(s);
    }
    return s;
  }
  fail("Action inconnue");
}

export function result(s) {
  if (!s.done) return null;
  return { ranking: rankByScore(s.ids.map((id) => ({ id, score: s.scores[id] }))) };
}

// ------------------------------------------------ robots
export function candidates(s) {
  const m = mask(s), tried = new Set([...s.found, ...s.wrong]);
  return (byLen[s.word.length] || []).filter((w) => {
    if (s.badWords.includes(w)) return false;
    for (let i = 0; i < w.length; i++) {
      if (m[i] !== "_") { if (w[i] !== m[i]) return false; } else if (tried.has(w[i])) return false;
    }
    return true;
  });
}
export function bot(s, pid, rng) {
  if (s.phase === "choose") return { type: "choose", word: rng.pick(s.sugg).w };
  if (s.phase === "end") return { type: "next" };
  const tried = new Set([...s.found, ...s.wrong]);
  const free = FREQ.split("").filter((c) => !tried.has(c));
  const smart = s.level === 3 || (s.level === 2 && rng.next() < 0.6);
  if (smart) {
    const c = candidates(s);
    if (c.length === 1 || (c.length && c.length <= 2 && s.level === 3)) return { type: "word", word: rng.pick(c) };
    if (c.length) {
      let best = free[0], bn = -1;
      for (const L of free) { const n = c.filter((w) => w.includes(L)).length; if (n > bn) { bn = n; best = L; } }
      return { type: "letter", letter: best };
    }
  }
  const hid = s.word.split("").filter((ch) => !s.found.includes(ch)).length;
  if (s.level >= 2 && hid <= 1 && rng.next() < 0.5) {
    const c = candidates(s);
    if (c.length) return { type: "word", word: rng.pick(c) };
  }
  // fréquence du français, avec une part de hasard
  const k = s.level === 1 ? Math.min(free.length - 1, rng.int(8)) : Math.min(free.length - 1, rng.int(3));
  return { type: "letter", letter: free[k] };
}
export function auto(s, pid, rng) {
  if (s.phase !== "guess") return bot(s, pid, rng);
  const tried = new Set([...s.found, ...s.wrong]);
  return { type: "letter", letter: rng.pick(FREQ.split("").filter((c) => !tried.has(c))) };
}
export function botDelay(s, pid, rng) {
  if (s.phase === "end") return 2600 + rng.next() * 1200;
  if (s.phase === "choose") return 2500 + rng.next() * 2000;
  return 1100 + rng.next() * 1400;
}
