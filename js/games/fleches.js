import { fail, rankByScore } from "../engine.js";
import { parseDefs } from "./fleches_dico.js";
import { norm } from "./motus.js";

export const meta = {
  id: "fleches", name: "Mots fléchés", cat: "Mots", min: 1, max: 6, turnTime: 0, race: true,
  color: "#D9716B", desc: "Une grille commune : trouve les mots grâce aux définitions.",
  rules: ["Chaque case grise contient une définition. La flèche indique le sens du mot.",
    "Touche une définition, tape ta réponse : si elle est juste, le mot s'affiche pour tout le monde.",
    "Un mot trouvé rapporte autant de points que de lettres. Une erreur coûte 1 point.",
    "Les lettres déjà trouvées t'aident pour les mots qui se croisent.",
    "Options : taille de la grille, nombre de mots, lettres révélées au départ et pénalité par erreur."],
};

// ------------------------------------------------ réglages
// size : largeur de la grille (hauteur = largeur + 2) ; words : nombre de mots visé (une petite grille en prend moins)
export const options = [
  { key: "size", label: "Grille", icon: "📐",
    values: [[7, "7 x 9", "Petite"], [9, "9 x 11", "Normale"], [11, "11 x 13", "Grande"]], def: 9 },
  { key: "words", label: "Nombre de mots", icon: "📝",
    values: [[12, "12", "Aérée"], [18, "18", "Normale"], [24, "24", "Selon la grille"]], def: 18 },
  { key: "reveal", label: "Lettres données", icon: "🔎",
    values: [[0, "Aucune"], [1, "1re lettre", "De chaque mot"], [2, "1re et der.", "De chaque mot"]], def: 0 },
  { key: "penalty", label: "Pénalité", icon: "❌",
    values: [[0, "Aucune", "Erreur gratuite"], [1, "-1", "Par erreur"], [3, "-3", "Par erreur"]], def: 1 },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "✏️", desc: "Grille 9 x 11, 18 mots, -1 par erreur.", set: { size: 9, words: 18, reveal: 0, penalty: 1 } },
  { id: "detente", name: "Détente", emoji: "☕", desc: "Petite grille, 1re lettre donnée, erreurs gratuites.", set: { size: 7, words: 12, reveal: 1, penalty: 0 } },
  { id: "grand", name: "Grand format", emoji: "🗞️", desc: "Grande grille 11 x 13 avec 24 mots.", set: { size: 11, words: 24, reveal: 0, penalty: 1 } },
  { id: "sansfilet", name: "Sans filet", emoji: "🎯", desc: "Grille normale, aucune aide et -3 par erreur.", set: { size: 9, words: 18, reveal: 0, penalty: 3 } },
];
// valeur d'un réglage, ou le défaut si absente ou invalide
export function opt(settings, key) {
  const o = options.find((x) => x.key === key);
  const v = settings ? settings[key] : undefined;
  const hit = o.values.find((x) => x[0] === v || (v != null && String(x[0]) === String(v)));
  return hit ? hit[0] : o.def;
}

const DICT = parseDefs();
export const W = 9, H = 11;

// grille : tableau de cases { t: "L", ch } ou { t: "C", a: wordIndex?, d: wordIndex? } ou null
export function generate(rng, target = 18, W = 9, H = W + 2) {
  let best = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    const g = Array(W * H).fill(null);
    const words = [];
    const used = new Set();
    const at = (r, c) => (r < 0 || c < 0 || r >= H || c >= W ? undefined : g[r * W + c]);
    const isL = (r, c) => { const x = at(r, c); return !!x && x.t === "L"; };
    const canPlace = (w, r, c, dir) => {
      const dr = dir === "d" ? 1 : 0, dc = dir === "a" ? 1 : 0;
      const cr = r - dr, cc = c - dc; // case définition
      if (cr < 0 || cc < 0) return -1;
      const clue = at(cr, cc);
      if (clue && (clue.t === "L" || clue[dir] != null)) return -1;
      const er = r + dr * w.length, ec = c + dc * w.length;
      if (er < H && ec < W && isL(er, ec)) return -1;
      if (er > H || ec > W) return -1;
      let cross = 0;
      for (let k = 0; k < w.length; k++) {
        const rr = r + dr * k, c2 = c + dc * k;
        if (rr >= H || c2 >= W) return -1;
        const x = at(rr, c2);
        if (x && x.t === "C") return -1;
        if (x && x.t === "L") {
          if (x.ch !== w[k] || x[dir] != null) return -1;
          cross++;
        } else {
          // pas de lettre collée sur les côtés
          if (dir === "a" && (isL(rr - 1, c2) || isL(rr + 1, c2))) return -1;
          if (dir === "d" && (isL(rr, c2 - 1) || isL(rr, c2 + 1))) return -1;
        }
      }
      return cross;
    };
    const place = (item, r, c, dir) => {
      const dr = dir === "d" ? 1 : 0, dc = dir === "a" ? 1 : 0;
      const idx = words.length;
      const cr = r - dr, cc = c - dc;
      const clue = g[cr * W + cc] || { t: "C" };
      clue[dir] = idx;
      g[cr * W + cc] = clue;
      const cells = [];
      for (let k = 0; k < item.w.length; k++) {
        const i = (r + dr * k) * W + c + dc * k;
        const x = g[i] || { t: "L", ch: item.w[k] };
        x[dir] = idx;
        g[i] = x;
        cells.push(i);
      }
      words.push({ w: item.w, d: item.d, dir, clue: cr * W + cc, cells, by: null });
      used.add(item.w);
    };
    const pool = rng.shuffle(DICT.filter((x) => x.w.length >= 3));
    const first = pool.find((x) => x.w.length >= 6 && x.w.length <= W - 1);
    place(first, 1 + rng.int(2), 1, "a");
    let fails = 0;
    while (words.length < target && fails < 3) {
      let placed = false;
      const cand = rng.shuffle(DICT.filter((x) => !used.has(x.w)));
      cand.sort((a, b) => b.w.length - a.w.length + (rng.next() - 0.5) * 6);
      outer: for (const item of cand) {
        const spots = [];
        for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
          for (const dir of ["a", "d"]) {
            const sc = canPlace(item.w, r, c, dir);
            if (sc > 0) spots.push({ r, c, dir, sc });
          }
        }
        if (spots.length) {
          spots.sort((a, b) => b.sc - a.sc);
          const top = spots.filter((s) => s.sc === spots[0].sc);
          const s = rng.pick(top);
          place(item, s.r, s.c, s.dir);
          placed = true;
          break outer;
        }
      }
      if (!placed) fails++;
    }
    const letters = g.filter((x) => x && x.t === "L").length;
    if (!best || words.length * 100 + letters > best.score) best = { g, words, score: words.length * 100 + letters };
    if (words.length >= target) break;
  }
  return { grid: best.g, words: best.words };
}

export function setup(players, settings, rng) {
  const w = opt(settings, "size"), h = w + 2;
  const { grid, words } = generate(rng, opt(settings, "words"), w, h);
  const scores = {}, errors = {};
  players.forEach((p) => { scores[p.id] = 0; errors[p.id] = 0; });
  return { ids: players.map((p) => p.id), w, h, grid, words, scores, errors, last: null, level: settings.level || 2,
    reveal: opt(settings, "reveal"), penalty: opt(settings, "penalty") };
}

const allFound = (s) => s.words.every((w) => w.by);
export function toAct(s) { return allFound(s) ? [] : s.ids.slice(); }

export function reduce(s, pid, a) {
  if (!s.ids.includes(pid)) fail("Tu ne joues pas");
  if (a.type !== "answer") fail("Action inconnue");
  const w = s.words[a.word | 0];
  if (!w) fail("Mot inconnu");
  if (w.by) fail("Déjà trouvé");
  const ans = norm(a.text);
  if (ans.length !== w.w.length) fail(`Il faut ${w.w.length} lettres`);
  if (ans !== w.w) {
    s.scores[pid] -= s.penalty ?? 1; s.errors[pid]++;
    s.last = { id: pid, word: a.word | 0, ok: false };
    return s;
  }
  w.by = pid;
  s.scores[pid] += w.w.length;
  s.last = { id: pid, word: a.word | 0, ok: true };
  return s;
}

export function result(s) {
  if (!allFound(s)) return null;
  return { ranking: rankByScore(s.ids.map((id) => ({ id, score: s.scores[id] }))) };
}

// lettres données au départ : 1re (et dernière) lettre de chaque mot selon l'option
export function given(s) {
  const out = {};
  if (!s.reveal) return out;
  for (const w of s.words) {
    out[w.cells[0]] = w.w[0];
    if (s.reveal >= 2) out[w.cells[w.cells.length - 1]] = w.w[w.w.length - 1];
  }
  return out;
}
// lettres visibles : celles des mots trouvés, plus les lettres données
export function revealed(s) {
  const out = given(s);
  for (const w of s.words) if (w.by) w.cells.forEach((c, k) => (out[c] = w.w[k]));
  return out;
}

export function bot(s, pid, rng) {
  const left = s.words.map((w, i) => [w, i]).filter(([w]) => !w.by);
  if (!left.length) return null;
  // préfère les mots qui ont déjà des lettres révélées
  const rev = revealed(s);
  left.sort((x, y) => y[0].cells.filter((c) => rev[c]).length - x[0].cells.filter((c) => rev[c]).length);
  const [w, i] = rng.next() < 0.6 ? left[0] : rng.pick(left);
  const wrong = s.level === 1 && rng.next() < 0.2;
  return { type: "answer", word: i, text: wrong ? w.w.slice(0, -1) + (w.w.endsWith("E") ? "A" : "E") : w.w };
}
export function botDelay(s, pid, rng) {
  return ({ 1: 15000, 2: 10000, 3: 6500 }[s.level] || 10000) * (0.6 + rng.next() * 0.8);
}
