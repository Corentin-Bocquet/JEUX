import { fail, rankByScore } from "../engine.js";

export const meta = {
  id: "motsmeles", name: "Mots mêlés", cat: "Mots", min: 1, max: 6, turnTime: 0, race: true,
  color: "#18A57A", desc: "Débusque les mots cachés dans la grille avant les autres.",
  rules: ["Les mots de la liste sont cachés dans la grille, dans tous les sens.",
    "Fais glisser ton doigt de la première à la dernière lettre d'un mot.",
    "Chaque mot trouvé rapporte autant de points que de lettres.",
    "Quand tous les mots sont trouvés, le meilleur score gagne."],
};

export const THEMES = {
  "Animaux": "GIRAFE ELEPHANT DAUPHIN PANTHERE KOALA PINGOUIN HIBOU RENARD LOUTRE CASTOR ZEBRE GORILLE TORTUE REQUIN ECUREUIL FLAMANT HERISSON CHAMEAU",
  "Fruits et légumes": "BANANE CERISE ANANAS MANGUE FRAISE CAROTTE POIREAU TOMATE CITRON POMME PECHE RADIS NAVET COURGETTE ABRICOT MYRTILLE PASTEQUE OLIVE",
  "Sports": "TENNIS RUGBY FOOTBALL HANDBALL BOXE JUDO ESCRIME NATATION CYCLISME GOLF SURF VOILE KARATE BOWLING SKI AVIRON BASKET PLONGEON",
  "Pays": "FRANCE ESPAGNE ITALIE BRESIL CANADA JAPON MAROC INDE CHINE PEROU NORVEGE GRECE EGYPTE MEXIQUE SUEDE CHILI KENYA TURQUIE",
  "Métiers": "PILOTE MEDECIN BOULANGER POMPIER AVOCAT PLOMBIER FACTEUR JARDINIER CUISINIER DENTISTE NOTAIRE PEINTRE CHIMISTE ARCHITECTE VENDEUR ACTEUR BERGER MARIN",
  "Cuisine": "FOUET CASSEROLE POELE SPATULE LOUCHE PASSOIRE FOUR TAMIS RAPE COUTEAU MIXEUR BALANCE SALADIER ROULEAU THERMOS TASSE BOL ASSIETTE",
  "Espace": "PLANETE ETOILE COMETE GALAXIE FUSEE ORBITE LUNE SOLEIL MARS VENUS SATURNE JUPITER NEBULEUSE ASTRONAUTE METEORE ECLIPSE COSMOS SATELLITE",
  "Musique": "PIANO GUITARE VIOLON TROMPETTE BATTERIE FLUTE HARPE ACCORDEON SAXOPHONE TAMBOUR CHORALE CONCERT MELODIE RYTHME OPERA REFRAIN CLARINETTE TUBA",
};
const DIRS = [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]];
const FREQ = "EEEEEEAAAAASSSSIIIIITTTTNNNNRRRRUUUULLLOOOODDDCCCPPMMMVQFBGHJXYZ";

export function generate(rng, size, theme, count) {
  const pool = rng.shuffle(THEMES[theme].split(" ").filter((w) => w.length <= size));
  for (let attempt = 0; attempt < 30; attempt++) {
    const g = Array(size * size).fill("");
    const words = [];
    for (const w of pool) {
      if (words.length >= count) break;
      let placed = false;
      for (let t = 0; t < 120 && !placed; t++) {
        const [dr, dc] = attempt < 20 ? rng.pick(DIRS) : rng.pick(DIRS.slice(0, 4));
        const r0 = rng.int(size), c0 = rng.int(size);
        const r1 = r0 + dr * (w.length - 1), c1 = c0 + dc * (w.length - 1);
        if (r1 < 0 || r1 >= size || c1 < 0 || c1 >= size) continue;
        let ok = true;
        for (let k = 0; k < w.length; k++) {
          const ch = g[(r0 + dr * k) * size + c0 + dc * k];
          if (ch && ch !== w[k]) { ok = false; break; }
        }
        if (!ok) continue;
        for (let k = 0; k < w.length; k++) g[(r0 + dr * k) * size + c0 + dc * k] = w[k];
        words.push({ w, a: r0 * size + c0, b: r1 * size + c1, by: null });
        placed = true;
      }
    }
    if (words.length >= Math.min(count, pool.length) - 2) {
      for (let i = 0; i < g.length; i++) if (!g[i]) g[i] = FREQ[rng.int(FREQ.length)];
      return { grid: g.join(""), words };
    }
  }
  throw new Error("grille impossible");
}

export function lineCells(size, a, b) {
  const r0 = Math.floor(a / size), c0 = a % size, r1 = Math.floor(b / size), c1 = b % size;
  const dr = Math.sign(r1 - r0), dc = Math.sign(c1 - c0);
  const n = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0));
  if (!(r0 === r1 || c0 === c1 || Math.abs(r1 - r0) === Math.abs(c1 - c0))) return null;
  return Array.from({ length: n + 1 }, (_, k) => (r0 + dr * k) * size + c0 + dc * k);
}

export function setup(players, settings, rng) {
  const size = settings.size || 12;
  const themes = Object.keys(THEMES);
  const theme = themes.includes(settings.theme) ? settings.theme : rng.pick(themes);
  const { grid, words } = generate(rng, size, theme, size >= 14 ? 16 : size >= 12 ? 13 : 9);
  const scores = {};
  players.forEach((p) => (scores[p.id] = 0));
  return { ids: players.map((p) => p.id), size, theme, grid, words, scores, last: null, level: settings.level || 2 };
}

const allFound = (s) => s.words.every((w) => w.by);
export function toAct(s) { return allFound(s) ? [] : s.ids.slice(); }

export function reduce(s, pid, a) {
  if (!s.ids.includes(pid)) fail("Tu ne joues pas");
  if (a.type !== "find") fail("Action inconnue");
  const cells = lineCells(s.size, a.a | 0, a.b | 0);
  if (!cells || cells.length < 2 || cells.some((c) => c < 0 || c >= s.size * s.size)) fail("Trace une ligne droite");
  const str = cells.map((c) => s.grid[c]).join("");
  const rev = str.split("").reverse().join("");
  const w = s.words.find((x) => !x.by && (x.w === str || x.w === rev));
  if (!w) {
    const taken = s.words.find((x) => x.by && (x.w === str || x.w === rev));
    fail(taken ? "Déjà trouvé" : "Pas un mot de la liste");
  }
  w.by = pid; w.a = cells[0]; w.b = cells[cells.length - 1];
  if (w.w === rev) { w.a = cells[cells.length - 1]; w.b = cells[0]; }
  s.scores[pid] += w.w.length;
  s.last = { id: pid, w: w.w };
  return s;
}

export function result(s) {
  if (!allFound(s)) return null;
  return { ranking: rankByScore(s.ids.map((id) => ({ id, score: s.scores[id] }))) };
}

export function bot(s, pid, rng) {
  const left = s.words.filter((w) => !w.by);
  if (!left.length) return null;
  const w = rng.pick(left);
  return { type: "find", a: w.a, b: w.b };
}
export function botDelay(s, pid, rng) {
  return ({ 1: 14000, 2: 9000, 3: 5500 }[s.level] || 9000) * (0.6 + rng.next() * 0.8);
}
