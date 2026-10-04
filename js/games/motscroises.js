import { fail, rankByScore } from "../engine.js";
import { parseDefs } from "../data/motscroises_defs.js";
import { normWord } from "../data/dico.js";

export const meta = {
  id: "motscroises", name: "Mots croisés", cat: "Mots", min: 1, max: 6, turnTime: 90, race: true,
  color: "#64748B", desc: "La même grille pour tous : remplis-la plus vite et mieux que les autres.",
  rules: ["Tout le monde a la même grille, chacun la remplit de son côté.",
    "Les définitions sont numérotées sous la grille : horizontalement et verticalement.",
    "Touche une case ou une définition, tape ta réponse. Mot juste : 1 point par lettre, plus un bonus si tu es le premier à le trouver.",
    "Une mauvaise réponse coûte des points (selon l'option).",
    "Tu vois la progression des autres en direct. Quand tout le monde a fini, le meilleur score gagne.",
    "Si tu restes trop longtemps sans jouer, un mot se révèle tout seul, sans points."],
};

export const options = [
  { key: "size", label: "Grille", icon: "📐", values: [[9, "9 x 9", "Petite"], [11, "11 x 11", "Normale"], [13, "13 x 13", "Grande"]], def: 11 },
  { key: "penalty", label: "Pénalité", icon: "❌", values: [[0, "Aucune", "Erreur gratuite"], [1, "-1", "Par erreur"], [3, "-3", "Par erreur"]], def: 1 },
  { key: "bonus", label: "Bonus 1er", icon: "⚡", values: [[0, "Aucun"], [2, "+2", "Premier à trouver"], [5, "+5", "Premier à trouver"]], def: 2 },
  { key: "reveal", label: "Aide", icon: "🔎", values: [[false, "Aucune"], [true, "1re lettre", "De chaque mot"]], def: false },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "✏️", desc: "Grille 11 x 11, -1 par erreur, +2 au premier.", set: { size: 11, penalty: 1, bonus: 2, reveal: false } },
  { id: "detente", name: "Détente", emoji: "☕", desc: "Petite grille, 1re lettre donnée, erreurs gratuites.", set: { size: 9, penalty: 0, bonus: 2, reveal: true } },
  { id: "grand", name: "Grand format", emoji: "🗞️", desc: "Grande grille 13 x 13 pour les mordus.", set: { size: 13, penalty: 1, bonus: 2, reveal: false } },
  { id: "sprint", name: "Sprint", emoji: "🏁", desc: "Gros bonus au plus rapide, -3 par erreur.", set: { size: 11, penalty: 3, bonus: 5, reveal: false } },
];
export function opt(settings, key) {
  const o = options.find((x) => x.key === key);
  const v = settings ? settings[key] : undefined;
  const hit = o.values.find((x) => x[0] === v || (v != null && String(x[0]) === String(v)));
  return hit ? hit[0] : o.def;
}

export const DICT = parseDefs();
const TARGET = { 9: 12, 11: 18, 13: 24 };

// génère une grille de mots croisés (cases noires = "#") à partir de la banque de définitions
export function generate(rng, N = 11, target = TARGET[N] || 18) {
  let best = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const g = Array(N * N).fill("");
    const words = [];
    const used = new Set();
    const dirAt = {}; // "i:a" ou "i:d" -> déjà dans un mot de ce sens
    const L = (r, c) => r >= 0 && c >= 0 && r < N && c < N && g[r * N + c] !== "";
    const can = (w, r, c, dir) => {
      const dr = dir === "d" ? 1 : 0, dc = dir === "a" ? 1 : 0;
      if (L(r - dr, c - dc)) return -1;
      const er = r + dr * w.length, ec = c + dc * w.length;
      if (er > N || ec > N) return -1;
      if (L(er, ec)) return -1;
      let cross = 0;
      for (let k = 0; k < w.length; k++) {
        const rr = r + dr * k, cc = c + dc * k, i = rr * N + cc;
        if (g[i]) {
          if (g[i] !== w[k] || dirAt[i + ":" + dir]) return -1;
          cross++;
        } else if (dir === "a" ? (L(rr - 1, cc) || L(rr + 1, cc)) : (L(rr, cc - 1) || L(rr, cc + 1))) return -1;
      }
      return cross;
    };
    const place = (it, r, c, dir) => {
      const dr = dir === "d" ? 1 : 0, dc = dir === "a" ? 1 : 0;
      for (let k = 0; k < it.w.length; k++) { const i = (r + dr * k) * N + c + dc * k; g[i] = it.w[k]; dirAt[i + ":" + dir] = 1; }
      words.push({ w: it.w, d: it.d, dir, r, c });
      used.add(it.w);
    };
    const pool = rng.shuffle(DICT.filter((x) => x.w.length <= N));
    const first = pool.find((x) => x.w.length >= Math.min(7, N - 2));
    place(first, Math.floor(N / 2) - 1 + rng.int(3), rng.int(N - first.w.length + 1), "a");
    let fails = 0;
    while (words.length < target && fails < 4) {
      let placed = false;
      const cand = rng.shuffle(pool.filter((x) => !used.has(x.w)));
      cand.sort((a, b) => b.w.length - a.w.length + (rng.next() - 0.5) * 7);
      for (const it of cand.slice(0, 260)) {
        let bestSc = 0, spots = [];
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const dir of ["a", "d"]) {
          const sc = can(it.w, r, c, dir);
          if (sc > bestSc) { bestSc = sc; spots = [{ r, c, dir }]; } else if (sc > 0 && sc === bestSc) spots.push({ r, c, dir });
        }
        if (spots.length) { const s = rng.pick(spots); place(it, s.r, s.c, s.dir); placed = true; break; }
      }
      if (!placed) fails++;
    }
    const filled = g.filter(Boolean).length;
    const score = words.length * 100 + filled;
    if (!best || score > best.score) best = { g, words, score };
    if (words.length >= target) break;
  }
  return finish(best.g, best.words, N);
}

// recadre la grille et numérote les mots dans l'ordre de lecture
function finish(g, words, N) {
  let r0 = N, r1 = 0, c0 = N, c1 = 0;
  for (let i = 0; i < N * N; i++) if (g[i]) { const r = Math.floor(i / N), c = i % N; r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c); }
  const w = c1 - c0 + 1, h = r1 - r0 + 1;
  let cells = "";
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) cells += g[r * N + c] || "#";
  const ws = words.map((x) => ({ w: x.w, d: x.d, dir: x.dir, at: (x.r - r0) * w + (x.c - c0) }));
  const starts = [...new Set(ws.map((x) => x.at))].sort((a, b) => a - b);
  for (const x of ws) x.n = starts.indexOf(x.at) + 1;
  ws.sort((a, b) => (a.dir === b.dir ? a.n - b.n : a.dir === "a" ? -1 : 1));
  return { w, h, cells, words: ws };
}

export const wordCells = (s, x) => Array.from({ length: x.w.length }, (_, k) => x.at + (x.dir === "a" ? k : k * s.w));

export function setup(players, settings, rng) {
  const N = opt(settings, "size");
  const { w, h, cells, words } = generate(rng, N);
  const s = { ids: players.map((p) => p.id), w, h, cells, words, penalty: opt(settings, "penalty"), bonus: opt(settings, "bonus"), reveal: opt(settings, "reveal"),
    level: [1, 2, 3].includes(settings.level) ? settings.level : 2, found: {}, shown: {}, scores: {}, errors: {}, status: {}, first: {}, finish: [], last: null };
  for (const p of players) { s.found[p.id] = []; s.shown[p.id] = []; s.scores[p.id] = 0; s.errors[p.id] = 0; s.status[p.id] = "playing"; }
  return s;
}

export const doneWords = (s, id) => s.found[id].concat(s.shown[id]);
export function toAct(s) { return s.ids.filter((id) => s.status[id] === "playing"); }

function checkEnd(s, pid) {
  if (doneWords(s, pid).length >= s.words.length) { s.status[pid] = "done"; s.finish.push(pid); }
}

export function reduce(s, pid, a) {
  if (!s.ids.includes(pid)) fail("Tu ne joues pas");
  if (s.status[pid] !== "playing") fail("Tu as fini ta grille");
  if (a.type === "giveup") { s.status[pid] = "done"; s.finish.push(pid); return s; }
  if (a.type === "reveal") {
    const i = s.words.findIndex((_, k) => !doneWords(s, pid).includes(k));
    if (i >= 0) s.shown[pid].push(i);
    s.last = { id: pid, word: i, ok: null };
    checkEnd(s, pid);
    return s;
  }
  if (a.type !== "answer") fail("Action inconnue");
  const i = a.word | 0, x = s.words[i];
  if (!x) fail("Mot inconnu");
  if (doneWords(s, pid).includes(i)) fail("Déjà trouvé");
  const t = normWord(a.text);
  if (t.length !== x.w.length) fail(`Il faut ${x.w.length} lettres`);
  if (t !== x.w) {
    s.scores[pid] -= s.penalty; s.errors[pid]++;
    s.last = { id: pid, word: i, ok: false };
    return s;
  }
  s.found[pid].push(i);
  let pts = x.w.length;
  if (s.first[i] == null) { s.first[i] = pid; pts += s.bonus; }
  s.scores[pid] += pts;
  s.last = { id: pid, word: i, ok: true };
  checkEnd(s, pid);
  return s;
}

export function result(s) {
  if (toAct(s).length) return null;
  return { ranking: rankByScore(s.ids.map((id) => ({ id, score: s.scores[id] }))) };
}

// lettres visibles pour un joueur : ses mots trouvés ou révélés, plus l'aide éventuelle
export function letters(s, id) {
  const out = {};
  if (s.reveal) for (const x of s.words) out[x.at] = x.w[0];
  for (const i of doneWords(s, id)) { const x = s.words[i]; wordCells(s, x).forEach((c, k) => (out[c] = x.w[k])); }
  return out;
}

export function bot(s, pid, rng) {
  if (s.status[pid] !== "playing") return null;
  const done = doneWords(s, pid);
  const left = s.words.map((x, i) => i).filter((i) => !done.includes(i));
  if (!left.length) return null;
  const vis = letters(s, pid);
  const known = (i) => wordCells(s, s.words[i]).filter((c) => vis[c]).length / s.words[i].w.length;
  left.sort((x, y) => known(y) - known(x));
  const i = rng.next() < 0.6 ? left[0] : rng.pick(left);
  const w = s.words[i].w;
  const pErr = { 1: 0.2, 2: 0.08, 3: 0.02 }[s.level] || 0.08;
  if (rng.next() < pErr) return { type: "answer", word: i, text: w.slice(0, -1) + (w.endsWith("E") ? "A" : "E") };
  return { type: "answer", word: i, text: w };
}
export function auto() { return { type: "reveal" }; }
export function botDelay(s, pid, rng) {
  return ({ 1: 14000, 2: 9500, 3: 6000 }[s.level] || 9500) * (0.6 + rng.next() * 0.8);
}
