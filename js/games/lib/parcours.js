// Outils communs aux jeux de parcours avec dé (serpents, oie, petits chevaux).
// Logique pure : aucun DOM, testable sous Node.

// couleurs des joueurs (c = couleur vive, d = foncée pour les contours)
export const COLORS = [
  { id: "rouge", name: "Rouge", c: "#EF4444", d: "#B91C1C" },
  { id: "bleu", name: "Bleu", c: "#3B82F6", d: "#1D4ED8" },
  { id: "vert", name: "Vert", c: "#22C55E", d: "#15803D" },
  { id: "jaune", name: "Jaune", c: "#FACC15", d: "#B88A04" },
  { id: "violet", name: "Violet", c: "#A855F7", d: "#7E22CE" },
  { id: "orange", name: "Orange", c: "#F97316", d: "#C2410C" },
];

// durées des animations (ms), partagées par les vues et les délais des robots
export const T = { die: 650, step: 150, jump: 520 };

// valeur d'un réglage, avec repli sur le défaut si absente ou invalide
export function opt(options, settings, key) {
  const o = options.find((x) => x.key === key);
  const v = settings ? settings[key] : undefined;
  const hit = o.values.find((x) => String(x[0]) === String(v));
  return hit ? hit[0] : o.def;
}

export const rollDie = (r) => 1 + r.int(6);

// Un coup animé est décrit par s.last = { n, pid, dice: [..] | null, frames: [[clé, position, "s"|"j"]...], msg }
// "s" = un pas, "j" = un saut (échelle, serpent, retour à l'écurie...).
export function animMs(last) {
  if (!last) return 0;
  let t = last.dice && last.dice.length ? T.die : 0;
  for (const f of last.frames || []) t += f[2] === "s" ? T.step : T.jump;
  return t;
}

// délai du robot : le temps de voir l'animation du coup précédent, puis un court instant
export const parcoursDelay = (s) => 280 + animMs(s.last);

// frames d'un déplacement case par case de a vers b (b exclu de rien, a exclu)
export function walk(key, a, b) {
  const out = [];
  const d = b > a ? 1 : -1;
  for (let p = a + d; d > 0 ? p <= b : p >= b; p += d) out.push([key, p, "s"]);
  return out;
}

// classement : vainqueur(s) d'abord, puis par score décroissant
export function rankRace(order, scoreOf, firstIds = []) {
  const e = order.map((id) => ({ id, w: firstIds.includes(id) ? 1 : 0, score: scoreOf(id) }));
  e.sort((a, b) => b.w - a.w || b.score - a.score);
  let rank = 0, prev = null;
  return e.map((x, i) => {
    const key = x.w + ":" + x.score;
    if (key !== prev) { rank = i + 1; prev = key; }
    return { id: x.id, rank, score: x.score };
  });
}

export const nameIn = (s, id) => (s.names && s.names[id]) || "?";
