import { fail, rankByScore, rng as mkRng } from "../engine.js";
import { PB_CATS, PB_SETS } from "../data/petitbac_listes.js";

export const meta = {
  id: "petitbac", name: "Petit bac", cat: "Mots", min: 2, max: 8, turnTime: 90, race: true,
  color: "#F59E0B", desc: "Une lettre, des catégories : remplis tout avant les autres et crie Stop !",
  rules: ["Une lettre est tirée au sort. Tout le monde remplit les catégories en même temps avec des mots qui commencent par cette lettre.",
    "Le premier qui a tout rempli appuie sur Stop : les autres ont alors 10 secondes pour finir.",
    "Un mot présent dans nos listes est accepté d'office. Un mot inconnu passe au vote des autres joueurs (ou est refusé selon l'option).",
    "2 points pour un mot que personne d'autre n'a trouvé, 1 point s'il est partagé, 0 si la case est vide ou refusée.",
    "Les accents, majuscules et tirets ne comptent pas. Les marques sont interdites.",
    "Après toutes les manches, le meilleur total gagne."],
};

export const STOP_SECS = 10;
export const VOTE_SECS = 40;

export const options = [
  { key: "rounds", label: "Manches", icon: "🔁", values: [[3, "3", "Rapide"], [5, "5", "Standard"], [8, "8", "Longue partie"]], def: 5 },
  { key: "set", label: "Catégories", icon: "🗂️", values: [["classique", "Classiques", "8 catégories"], ["nature", "Nature", "6 catégories"], ["loisirs", "Loisirs", "6 catégories"], ["geant", "Géant", "12 catégories"]], def: "classique" },
  { key: "dur", label: "Durée", icon: "⏱️", values: [[60, "1 min"], [90, "1 min 30"], [120, "2 min"], [180, "3 min"]], def: 120 },
  { key: "vote", label: "Hors liste", icon: "🗳️", values: [[true, "Vote", "Les joueurs votent"], [false, "Refusés", "Listes seulement"]], def: true },
  { key: "letters", label: "Lettres", icon: "🔤", values: [["faciles", "Faciles", "Sans les pièges"], ["toutes", "Toutes", "Même K, Q, W..."]], def: "faciles" },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "📝", desc: "8 catégories classiques, 5 manches de 2 minutes, vote sur les mots inconnus.", set: { rounds: 5, set: "classique", dur: 120, vote: true, letters: "faciles" } },
  { id: "express", name: "Express", emoji: "⚡", desc: "3 manches d'une minute, il faut aller vite.", set: { rounds: 3, set: "classique", dur: 60, vote: true, letters: "faciles" } },
  { id: "nature", name: "Nature", emoji: "🌿", desc: "Animaux, plantes, fruits, couleurs et voyages.", set: { rounds: 5, set: "nature", dur: 90, vote: true, letters: "faciles" } },
  { id: "expert", name: "Expert", emoji: "🧠", desc: "12 catégories, toutes les lettres, seules nos listes font foi.", set: { rounds: 5, set: "geant", dur: 180, vote: false, letters: "toutes" } },
];

export function opt(settings, key) {
  const o = options.find((x) => x.key === key);
  const v = settings ? settings[key] : undefined;
  const hit = o.values.find((x) => x[0] === v || (v != null && String(x[0]) === String(v)));
  return hit ? hit[0] : o.def;
}

// ------------------------------------------------ listes
export const norm = (w) => String(w || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase()
  .replace(/Œ/g, "OE").replace(/Æ/g, "AE").replace(/[^A-Z]/g, "");
const cache = {};
// catégorie -> { map: mot normalisé -> forme affichée, byLetter: { A: [formes] } }
export function catData(key) {
  if (cache[key]) return cache[key];
  const map = {}, byLetter = {};
  for (const raw of PB_CATS[key].list.split(",")) {
    const w = raw.trim(), n = norm(w);
    if (!n || map[n]) continue;
    map[n] = w;
    (byLetter[n[0]] = byLetter[n[0]] || []).push(w);
  }
  return (cache[key] = { map, byLetter });
}
export const catLabel = (key) => PB_CATS[key].label;
export const catIcon = (key) => PB_CATS[key].icon;

// formes à essayer : mot entier, sans article, sans marque du pluriel
function forms(raw) {
  const t = String(raw || "").trim().toLowerCase();
  const out = [norm(t)];
  const m = t.match(/^(le|la|les|un|une|des|du)\s+(.+)$/) || t.match(/^(l|d)['’]\s*(.+)$/);
  if (m) out.push(norm(m[2]));
  for (const n of out.slice()) if (n.length > 3 && /[SX]$/.test(n)) out.push(n.slice(0, -1));
  return out.filter(Boolean);
}

// code d'une réponse : e vide, x mauvaise lettre, v dans la liste, d douteux (vote)
export function judge(key, letter, raw) {
  const all = forms(raw);
  if (!all.length) return { code: "e", n: "" };
  const { map } = catData(key);
  for (const n of all) if (n[0] === letter && map[n]) return { code: "v", n };
  const good = all.filter((n) => n[0] === letter);
  if (!good.length) return { code: "x", n: all[0] };
  return { code: "d", n: good[0] };
}

// lettres jouables : chaque catégorie du groupe a assez de mots
export function playableLetters(cats, mode) {
  const need = mode === "toutes" ? 1 : 4;
  const out = [];
  for (const c of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    if (mode !== "toutes" && "KQWXYZ".includes(c)) continue;
    if (cats.every((k) => (catData(k).byLetter[c] || []).length >= need)) out.push(c);
  }
  return out;
}

// ------------------------------------------------ partie
function newRound(s, r, now) {
  let pool = playableLetters(s.cats, s.letters).filter((c) => !s.used.includes(c));
  if (!pool.length) pool = playableLetters(s.cats, s.letters);
  s.letter = r.pick(pool);
  s.used.push(s.letter);
  s.phase = "play"; s.t0 = now; s.stopBy = null; s.stopAt = 0;
  s.ans = {}; s.sub = {}; s.res = {}; s.pts = {}; s.doubts = []; s.votes = {}; s.ready = {}; s.voteAt = 0;
  for (const id of s.ids) { s.ans[id] = s.cats.map(() => null); s.sub[id] = false; }
}

export function setup(players, settings, r) {
  const set = opt(settings, "set");
  const s = { ids: players.map((p) => p.id), cats: PB_SETS[set].slice(), set, rounds: opt(settings, "rounds"), dur: opt(settings, "dur"),
    vote: opt(settings, "vote"), letters: opt(settings, "letters"), level: [1, 2, 3].includes(settings.level) ? settings.level : 2,
    roundNo: 1, used: [], scores: {}, history: [], done: false };
  for (const id of s.ids) s.scores[id] = 0;
  newRound(s, r, null);
  return s;
}

export const roundStart = (s) => (s.t0 != null ? s.t0 : s.startedAt || 0);
export const endAt = (s) => roundStart(s) + s.dur * 1000;
export const deadline = (s) => (s.stopAt ? Math.min(s.stopAt, endAt(s)) : endAt(s));
export const filled = (s, id) => (s.ans[id] || []).filter((w) => w && w.trim()).length;

// joueurs qui doivent voter sur au moins un mot
const voters = (s) => s.ids.filter((id) => s.doubts.some((d) => !d.by.includes(id)));

export function toAct(s) {
  if (s.done) return [];
  if (s.phase === "play") return s.ids.filter((id) => !s.sub[id]);
  if (s.phase === "vote") return voters(s).filter((id) => !s.votes[id]);
  if (s.phase === "recap") return s.ids.filter((id) => !s.ready[id]);
  return [];
}

const clean = (w) => String(w == null ? "" : w).replace(/\s+/g, " ").trim().slice(0, 40);

function finishPlay(s, now) {
  for (const id of s.ids) s.sub[id] = true;
  const doubts = [];
  for (const id of s.ids) {
    s.res[id] = s.cats.map((k, i) => {
      const j = judge(k, s.letter, s.ans[id][i]);
      if (j.code === "d") {
        if (!s.vote) return { c: "r", n: j.n };
        let d = doubts.find((x) => x.c === i && x.n === j.n);
        if (!d) doubts.push(d = { c: i, n: j.n, w: clean(s.ans[id][i]), by: [] });
        d.by.push(id);
      }
      return { c: j.code, n: j.n };
    });
  }
  s.doubts = doubts;
  if (doubts.length && voters(s).length) { s.phase = "vote"; s.voteAt = now || 0; }
  else resolve(s);
}

function resolve(s) {
  // décisions des votes : plus de oui que de non
  s.doubts.forEach((d, i) => {
    let yes = 0, no = 0;
    for (const id of s.ids) {
      if (d.by.includes(id)) continue;
      const v = s.votes[id] ? s.votes[id][i] : null;
      if (v === 1) yes++; else if (v === 0) no++;
    }
    d.ok = yes > no;
    d.yes = yes; d.no = no;
    for (const id of d.by) s.res[id][d.c].c = d.ok ? "a" : "r";
  });
  for (const id of s.ids) s.pts[id] = 0;
  s.cats.forEach((k, i) => {
    const good = s.ids.filter((id) => ["v", "a"].includes(s.res[id][i].c));
    for (const id of good) {
      const same = good.filter((o) => s.res[o][i].n === s.res[id][i].n).length;
      const p = same === 1 ? 2 : 1;
      s.res[id][i].p = p;
      s.pts[id] += p;
    }
  });
  for (const id of s.ids) s.scores[id] += s.pts[id];
  s.history.push({ l: s.letter, p: { ...s.pts } });
  s.phase = "recap"; s.ready = {};
  if (s.roundNo >= s.rounds) s.done = true;
}

export function reduce(s, pid, a) {
  if (!s.ids.includes(pid)) fail("Tu ne joues pas dans cette partie");
  if (s.done) fail("La partie est terminée");
  const now = a.now || 0;
  if (a.type === "close") {
    if (s.phase === "play") {
      if (now < deadline(s)) fail("Pas encore");
      finishPlay(s, now);
    } else if (s.phase === "vote") {
      if (now < s.voteAt + VOTE_SECS * 1000) fail("Pas encore");
      resolve(s);
    }
    return s;
  }
  if (a.type === "fill" || a.type === "done") {
    if (s.phase !== "play") fail("Ce n'est plus le moment d'écrire");
    if (s.sub[pid]) fail("Ta grille est déjà rendue");
    if (a.type === "fill") {
      const i = a.cat;
      if (!Number.isInteger(i) || i < 0 || i >= s.cats.length) fail("Catégorie inconnue");
      s.ans[pid][i] = clean(a.word);
      return s;
    }
    if (Array.isArray(a.answers)) s.cats.forEach((_, i) => { if (a.answers[i] != null) s.ans[pid][i] = clean(a.answers[i]); });
    s.sub[pid] = true;
    if (!s.stopAt && filled(s, pid) === s.cats.length) { s.stopBy = pid; s.stopAt = now + STOP_SECS * 1000; }
    if (s.ids.every((id) => s.sub[id])) finishPlay(s, now);
    return s;
  }
  if (a.type === "vote") {
    if (s.phase !== "vote") fail("Pas de vote en cours");
    if (!toAct(s).includes(pid)) fail("Tu as déjà voté");
    const ok = Array.isArray(a.ok) ? a.ok : [];
    s.votes[pid] = s.doubts.map((d, i) => (d.by.includes(pid) ? null : ok[i] === 1 || ok[i] === true ? 1 : ok[i] === 0 || ok[i] === false ? 0 : null));
    if (!toAct(s).length) resolve(s);
    return s;
  }
  if (a.type === "ready") {
    if (s.phase !== "recap") fail("Pas encore");
    s.ready[pid] = true;
    if (s.ids.every((id) => s.ready[id])) {
      s.roundNo++;
      newRound(s, rngOf(a), now);
    }
    return s;
  }
  fail("Action inconnue");
}

const rngOf = (a) => mkRng(a.seed || 1);

export function result(s) {
  if (!s.done) return null;
  return { ranking: rankByScore(s.ids.map((id) => ({ id, score: s.scores[id] }))) };
}

// ------------------------------------------------ robots
const SUCCESS = { 1: 0.55, 2: 0.75, 3: 0.9 };
export function bot(s, pid, r) {
  if (s.phase === "play") {
    if (s.sub[pid]) return null;
    if (s.stopAt) return { type: "done" };
    const i = s.ans[pid].indexOf(null);
    if (i < 0) return { type: "done" };
    const k = s.cats[i];
    const words = catData(k).byLetter[s.letter] || [];
    if (words.length && r.next() < (SUCCESS[s.level] || 0.75)) return { type: "fill", cat: i, word: r.pick(words) };
    // erreur de débutant : un mot d'une autre catégorie
    if (s.level === 1 && r.next() < 0.4) {
      const other = s.cats.filter((c) => c !== k).map((c) => catData(c).byLetter[s.letter] || []).flat();
      const w = other.find((x) => !catData(k).map[norm(x)] && r.next() < 0.3);
      if (w) return { type: "fill", cat: i, word: w };
    }
    return { type: "fill", cat: i, word: "" };
  }
  if (s.phase === "vote") {
    if (!toAct(s).includes(pid)) return null;
    return { type: "vote", ok: s.doubts.map((d) => {
      if (d.by.includes(pid)) return null;
      const elsewhere = s.cats.some((c, j) => j !== d.c && catData(c).map[d.n]);
      if (elsewhere) return 0;
      return d.n.length >= 3 && /[AEIOUY]/.test(d.n) && r.next() < 0.6 ? 1 : 0;
    }) };
  }
  if (s.phase === "recap") return s.ready[pid] ? null : { type: "ready" };
  return null;
}

export function auto(s, pid) {
  if (s.phase === "play") return { type: "done" };
  if (s.phase === "vote") return { type: "vote", ok: [] };
  if (s.phase === "recap") return { type: "ready" };
  return null;
}

export function botDelay(s, pid, r) {
  const jit = 0.6 + r.next() * 0.8;
  if (s.phase === "play") {
    if (s.stopAt) return 1500 + r.next() * 2500;
    const per = (s.dur * 1000) / (s.cats.length + 1);
    return per * ({ 1: 1.05, 2: 0.8, 3: 0.55 }[s.level] || 0.8) * jit;
  }
  if (s.phase === "vote") return 2500 + r.next() * 3000;
  return 3000 + r.next() * 3000;
}
