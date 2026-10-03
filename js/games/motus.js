import { fail, rankByScore, rng as mkRng } from "../engine.js";
import { DICO } from "./motus_dico.js";
import { SOLUTIONS } from "./motus_mots.js";

export const meta = {
  id: "motus", name: "Motus", cat: "Mots", min: 1, max: 6, turnTime: 120, race: true,
  color: "#E8A21A", desc: "Trouve le mot mystère en 6 essais, avant les autres.",
  rules: ["Tout le monde cherche le même mot en même temps. La première lettre est donnée.",
    "Rouge : bonne lettre bien placée. Jaune : lettre présente ailleurs. Bleu : absente.",
    "Plus tu trouves vite, plus tu marques. +20 pour le premier qui trouve.",
    "Après toutes les manches, le meilleur total gagne."],
};

const sets = {};
export function dico(len) {
  if (!sets[len]) {
    const s = DICO[len], out = new Set();
    for (let i = 0; i < s.length; i += len) out.add(s.slice(i, i + len));
    sets[len] = out;
  }
  return sets[len];
}
const sols = {};
export function solutions(len) {
  if (!sols[len]) sols[len] = SOLUTIONS.split(/\s+/).filter((w) => w.length === len && dico(len).has(w));
  return sols[len];
}
export const norm = (w) => String(w || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/Œ/g, "OE").replace(/[^A-Z]/g, "");

// 2 bien placée, 1 mal placée, 0 absente
export function marks(guess, word) {
  const m = Array(word.length).fill(0), left = {};
  for (let i = 0; i < word.length; i++) {
    if (guess[i] === word[i]) m[i] = 2; else left[word[i]] = (left[word[i]] || 0) + 1;
  }
  for (let i = 0; i < word.length; i++) {
    if (m[i]) continue;
    if (left[guess[i]]) { m[i] = 1; left[guess[i]]--; }
  }
  return m;
}

function pickWord(s, seed) {
  const list = solutions(s.len).filter((w) => !s.used.includes(w));
  return mkRng(seed).pick(list.length ? list : solutions(s.len));
}

function newRound(s, seed) {
  s.word = pickWord(s, seed);
  s.used.push(s.word);
  s.boards = {}; s.status = {};
  for (const id of s.ids) { s.boards[id] = []; s.status[id] = "playing"; }
  s.firstFinder = null;
}

export function setup(players, settings, rng) {
  const len = [5, 6, 7].includes(settings.len) ? settings.len : 6;
  const s = { ids: players.map((p) => p.id), len, rounds: settings.rounds || 5, roundNo: 1, scores: {}, used: [],
    history: [], done: false, level: settings.level || 2 };
  players.forEach((p) => (s.scores[p.id] = 0));
  newRound(s, rng.int(2 ** 32));
  return s;
}

export const MAX_TRIES = 6;
export function toAct(s) { return s.done ? [] : s.ids.filter((id) => s.status[id] === "playing"); }

function endRoundIfNeeded(s, seed) {
  if (toAct(s).length) return;
  s.history.push({ word: s.word, found: s.ids.filter((id) => s.status[id] === "found"), tries: Object.fromEntries(s.ids.map((id) => [id, s.boards[id].length])) });
  if (s.roundNo >= s.rounds) { s.done = true; return; }
  s.roundNo++;
  newRound(s, seed);
}

export function check(s, word) {
  const w = norm(word);
  if (w.length !== s.len) return `Le mot fait ${s.len} lettres`;
  if (w[0] !== s.word[0]) return `Le mot commence par ${s.word[0]}`;
  if (!dico(s.len).has(w)) return "Mot inconnu du dictionnaire";
  return null;
}

export function reduce(s, pid, a) {
  if (!toAct(s).includes(pid)) fail("Attends la prochaine manche");
  if (a.type === "giveup") {
    s.status[pid] = "out";
    endRoundIfNeeded(s, a.seed || 1);
    return s;
  }
  if (a.type !== "guess") fail("Action inconnue");
  const err = check(s, a.word);
  if (err) fail(err);
  const w = norm(a.word);
  const m = marks(w, s.word);
  const board = s.boards[pid];
  board.push({ w, m });
  if (w === s.word) {
    s.status[pid] = "found";
    let pts = (MAX_TRIES + 1 - board.length) * 10;
    if (!s.firstFinder) { s.firstFinder = pid; pts += 20; }
    s.scores[pid] += pts;
  } else if (board.length >= MAX_TRIES) s.status[pid] = "out";
  endRoundIfNeeded(s, a.seed || 1);
  return s;
}

export function result(s) {
  if (!s.done) return null;
  return { ranking: rankByScore(s.ids.map((id) => ({ id, score: s.scores[id] }))) };
}

// robot : propose un mot compatible avec ses indices
export function consistent(w, board) {
  return board.every(({ w: g, m }) => marks(g, w).join() === m.join());
}
export function bot(s, pid, rng) {
  const board = s.boards[pid];
  const pool = s.level >= 3 ? solutions(s.len) : [...dico(s.len)];
  let cands = pool.filter((w) => w[0] === s.word[0] && consistent(w, board));
  if (!cands.length) cands = solutions(s.len).filter((w) => w[0] === s.word[0] && consistent(w, board));
  if (s.level === 1 && rng.next() < 0.35) {
    const loose = [...dico(s.len)].filter((w) => w[0] === s.word[0]);
    return { type: "guess", word: rng.pick(loose) };
  }
  if (!cands.length) return { type: "guess", word: s.word };
  // préfère les mots courants quand il y en a
  const common = cands.filter((w) => solutions(s.len).includes(w));
  return { type: "guess", word: rng.pick(common.length && rng.next() < 0.7 ? common : cands) };
}
export function auto() { return { type: "giveup" }; }
export function botDelay(s, pid, rng) {
  return ({ 1: 16000, 2: 11000, 3: 7000 }[s.level] || 11000) * (0.6 + rng.next() * 0.8);
}
