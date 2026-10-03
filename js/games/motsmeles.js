import { fail, rankByScore } from "../engine.js";

export const meta = {
  id: "motsmeles", name: "Mots mêlés", cat: "Mots", min: 1, max: 6, turnTime: 0, race: true,
  color: "#18A57A", desc: "Débusque les mots cachés dans la grille avant les autres.",
  rules: ["Les mots de la liste sont cachés dans la grille, dans tous les sens.",
    "Fais glisser ton doigt de la première à la dernière lettre d'un mot.",
    "Chaque mot trouvé rapporte autant de points que de lettres.",
    "Quand tous les mots sont trouvés, le meilleur score gagne.",
    "Options : sans diagonales, sans mots à l'envers, ou liste réduite aux initiales pour corser la chasse."],
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
// directions permises : [dr, dc]. À l'endroit = de gauche à droite, ou de haut en bas si vertical
export function dirsFor(diag = true, back = true) {
  return DIRS.filter(([dr, dc]) => (diag || !dr || !dc) && (back || dc > 0 || (dc === 0 && dr > 0)));
}

export const options = [
  { key: "size", label: "Grille", icon: "🔠",
    values: [[10, "10 x 10", "9 mots"], [12, "12 x 12", "13 mots"], [14, "14 x 14", "16 mots"]], def: 12 },
  { key: "theme", label: "Thème", icon: "🎨",
    values: [["", "Au hasard"], ["Animaux", "Animaux"], ["Sports", "Sports"], ["Pays", "Pays"], ["Espace", "Espace"], ["Cuisine", "Cuisine"],
      ["Musique", "Musique"], ["Métiers", "Métiers"], ["Fruits et légumes", "Fruits"]], def: "" },
  { key: "diag", label: "Diagonales", icon: "↗️",
    values: [[true, "Oui", "8 directions"], [false, "Non", "Lignes droites"]], def: true },
  { key: "back", label: "Mots à l'envers", icon: "🔄",
    values: [[true, "Oui", "Dans tous les sens"], [false, "Non", "Sens de lecture"]], def: true },
  { key: "list", label: "Liste des mots", icon: "📝",
    values: [["full", "Complète", "Mots en entier"], ["hint", "Initiales", "Première lettre"]], def: "full" },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "🔍", desc: "Grille 12 x 12, mots cachés dans tous les sens.", set: { size: 12, theme: "", diag: true, back: true, list: "full" } },
  { id: "debutant", name: "Débutant", emoji: "🌱", desc: "Petite grille, mots à l'endroit, sans diagonales.", set: { size: 10, theme: "", diag: false, back: false, list: "full" } },
  { id: "detective", name: "Détective", emoji: "🕵️", desc: "Tu ne vois que l'initiale et la longueur des mots.", set: { size: 12, theme: "", diag: true, back: true, list: "hint" } },
  { id: "geant", name: "Géant", emoji: "🧩", desc: "Grille 14 x 14 et 16 mots à débusquer.", set: { size: 14, theme: "", diag: true, back: true, list: "full" } },
];
const optVal = (key, v) => {
  const o = options.find((x) => x.key === key);
  return o.values.some((x) => x[0] === v) ? v : o.def;
};
const FREQ = "EEEEEEAAAAASSSSIIIIITTTTNNNNRRRRUUUULLLOOOODDDCCCPPMMMVQFBGHJXYZ";

export function generate(rng, size, theme, count, dirs = DIRS) {
  const pool = rng.shuffle(THEMES[theme].split(" ").filter((w) => w.length <= size));
  // après plusieurs échecs, on se limite aux sens de lecture (plus facile à caser)
  const fwd = dirsFor(true, false);
  const easy = dirs.filter((d) => fwd.includes(d)).length ? dirs.filter((d) => fwd.includes(d)) : dirs;
  for (let attempt = 0; attempt < 30; attempt++) {
    const g = Array(size * size).fill("");
    const words = [];
    for (const w of pool) {
      if (words.length >= count) break;
      let placed = false;
      for (let t = 0; t < 120 && !placed; t++) {
        const [dr, dc] = rng.pick(attempt < 20 ? dirs : easy);
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
  const size = optVal("size", settings.size);
  const themes = Object.keys(THEMES);
  const theme = themes.includes(settings.theme) ? settings.theme : rng.pick(themes);
  const diag = optVal("diag", settings.diag), back = optVal("back", settings.back), list = optVal("list", settings.list);
  const { grid, words } = generate(rng, size, theme, size >= 14 ? 16 : size >= 12 ? 13 : 9, dirsFor(diag, back));
  const scores = {};
  players.forEach((p) => (scores[p.id] = 0));
  return { ids: players.map((p) => p.id), size, theme, diag, back, list, grid, words, scores, last: null, level: settings.level || 2 };
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
