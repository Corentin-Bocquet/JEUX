import { fail, rankByScore, rng } from "../engine.js";

export const meta = {
  id: "pfc", name: "Pierre feuille ciseaux", cat: "Casino", min: 2, max: 8, turnTime: 20, race: true,
  color: "#2563EB", desc: "Tout le monde choisit en secret, puis 3, 2, 1… on révèle !",
  rules: ["Chacun choisit en secret pierre, feuille ou ciseaux. Rien n'est montré tant que tout le monde n'a pas choisi.",
    "La pierre casse les ciseaux, les ciseaux coupent la feuille, la feuille enveloppe la pierre. Même signe : on rejoue.",
    "Duel : le premier à gagner le nombre de manches prévu remporte le duel.",
    "Tournoi (3 joueurs ou plus) : des duels à élimination directe, le gagnant passe au tour suivant jusqu'à la finale.",
    "Aux points : tout le monde joue ensemble, chaque adversaire battu rapporte 1 point et le meilleur de la manche la gagne.",
    "Variante lézard Spock : le lézard empoisonne Spock et mange la feuille, Spock casse les ciseaux et vaporise la pierre, la pierre écrase le lézard, les ciseaux décapitent le lézard, la feuille discrédite Spock."],
};

export const options = [
  { key: "variant", label: "Variante", icon: "✊",
    values: [["classique", "Classique", "3 signes"], ["spock", "Lézard Spock", "5 signes"]], def: "classique" },
  { key: "format", label: "À plusieurs", icon: "🏟️",
    values: [["tournoi", "Tournoi", "Élimination"], ["points", "Aux points", "Tous ensemble"]], def: "tournoi" },
  { key: "wins", label: "Manches", icon: "🏆",
    values: [[1, "1", "Mort subite"], [2, "2", "En 3 manches"], [3, "3", "En 5 manches"]], def: 2 },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "✂️", desc: "Pierre, feuille, ciseaux en 2 manches gagnantes, tournoi à plusieurs.", set: { variant: "classique", format: "tournoi", wins: 2 } },
  { id: "eclair", name: "Éclair", emoji: "⚡", desc: "Mort subite : une seule manche gagnante par duel.", set: { variant: "classique", format: "tournoi", wins: 1 } },
  { id: "spock", name: "Lézard Spock", emoji: "🖖", desc: "5 signes au lieu de 3, duels en 3 manches gagnantes.", set: { variant: "spock", format: "tournoi", wins: 3 } },
  { id: "melee", name: "Mêlée", emoji: "🎉", desc: "Tout le monde joue en même temps et marque des points.", set: { variant: "classique", format: "points", wins: 3 } },
];

export function opt(settings, key) {
  const o = options.find((x) => x.key === key);
  const v = settings ? settings[key] : undefined;
  const hit = o.values.find((x) => x[0] === v || (v != null && String(x[0]) === String(v)));
  return hit ? hit[0] : o.def;
}

// R pierre, P feuille, S ciseaux, L lézard, K Spock
export const SIGNS = {
  R: { name: "Pierre", emoji: "✊" }, P: { name: "Feuille", emoji: "✋" }, S: { name: "Ciseaux", emoji: "✌️" },
  L: { name: "Lézard", emoji: "🦎" }, K: { name: "Spock", emoji: "🖖" },
};
const BEATS = { R: ["S", "L"], P: ["R", "K"], S: ["P", "L"], L: ["K", "P"], K: ["S", "R"] };
export const VERBS = { RS: "casse", RL: "écrase", PR: "enveloppe", PK: "discrédite", SP: "coupent", SL: "décapitent", LK: "empoisonne", LP: "mange", KS: "casse", KR: "vaporise" };
export const signsOf = (s) => (s.variant === "spock" ? ["R", "P", "S", "L", "K"] : ["R", "P", "S"]);
export const beats = (a, b) => BEATS[a].includes(b);
const MAX_THROWS = 60;

// tournoi : premier tour réduit à une puissance de 2, les autres sont qualifiés d'office
export function pairUp(alive) {
  const n = alive.length;
  let p = 1;
  while (p * 2 <= n) p *= 2;
  const nb = n === p ? 0 : 2 * p - n;
  const byes = alive.slice(0, nb), rest = alive.slice(nb), matches = [];
  for (let i = 0; i + 1 < rest.length; i += 2) matches.push({ a: rest[i], b: rest[i + 1], sa: 0, sb: 0, w: null, n: 0 });
  return { byes, matches };
}

export function setup(players, settings, r) {
  const ids = r.shuffle(players.map((p) => p.id));
  const s = { ids, variant: opt(settings, "variant"), format: opt(settings, "format"), wins: opt(settings, "wins"),
    level: [1, 2, 3].includes(settings.level) ? settings.level : 2,
    picks: {}, hist: {}, rev: 0, reveals: [], over: false };
  if (ids.length <= 2) s.format = "tournoi";
  for (const id of ids) { s.picks[id] = ""; s.hist[id] = ""; }
  if (s.format === "tournoi") {
    s.stage = 1; s.passed = {}; s.alive = ids.slice();
    for (const id of ids) s.passed[id] = 0;
    Object.assign(s, pairUp(s.alive));
  } else {
    s.manche = 1; s.won = {}; s.pts = {};
    for (const id of ids) { s.won[id] = 0; s.pts[id] = 0; }
  }
  return s;
}

export const matchOf = (s, id) => (s.matches || []).findIndex((m) => !m.w && (m.a === id || m.b === id));
export function toAct(s) {
  if (s.over) return [];
  if (s.format === "points") return s.ids.filter((id) => !s.picks[id]);
  const out = [];
  for (const m of s.matches) if (!m.w) for (const id of [m.a, m.b]) if (!s.picks[id]) out.push(id);
  return out;
}

function pushHist(s, id, k) { s.hist[id] = (s.hist[id] + k).slice(-12); }
function pushReveal(s, rv) {
  s.rev++;
  s.reveals.push({ r: s.rev, ...rv });
  if (s.reveals.length > 8) s.reveals.shift();
}

function resolveMatch(s, m, k, seed) {
  const ka = s.picks[m.a], kb = s.picks[m.b];
  s.picks[m.a] = ""; s.picks[m.b] = "";
  pushHist(s, m.a, ka); pushHist(s, m.b, kb);
  m.n++;
  let w = beats(ka, kb) ? m.a : beats(kb, ka) ? m.b : null;
  if (!w && m.n >= MAX_THROWS) w = rng(seed).next() < 0.5 ? m.a : m.b; // garde-fou contre les égalités sans fin
  if (w === m.a) m.sa++; else if (w === m.b) m.sb++;
  if (m.sa >= s.wins) m.w = m.a; else if (m.sb >= s.wins) m.w = m.b;
  pushReveal(s, { m: k, p: { [m.a]: ka, [m.b]: kb }, w: w ? [w] : [], sc: { [m.a]: m.sa, [m.b]: m.sb }, end: m.w || null });
  if (s.matches.every((x) => x.w)) {
    const alive = s.alive.filter((id) => s.byes.includes(id) || s.matches.some((x) => x.w === id));
    for (const id of alive) s.passed[id]++;
    s.alive = alive;
    if (alive.length <= 1) { s.over = true; return; }
    s.stage++;
    Object.assign(s, pairUp(alive));
  }
}

function resolveAll(s, seed) {
  const p = {}, pts = {};
  for (const id of s.ids) { p[id] = s.picks[id]; s.picks[id] = ""; pushHist(s, id, p[id]); }
  for (const id of s.ids) pts[id] = s.ids.filter((o) => o !== id && beats(p[id], p[o])).length;
  const top = Math.max(...s.ids.map((id) => pts[id]));
  const winners = top > 0 ? s.ids.filter((id) => pts[id] === top) : [];
  for (const id of s.ids) s.pts[id] += pts[id];
  for (const id of winners) s.won[id]++;
  pushReveal(s, { m: -1, p, w: winners, pts, n: s.manche });
  const best = Math.max(...s.ids.map((id) => s.won[id]));
  const leaders = s.ids.filter((id) => s.won[id] === best);
  // il faut un seul meneur pour finir ; garde-fou sur le nombre de manches
  if ((best >= s.wins && leaders.length === 1) || s.manche >= s.wins * 12) s.over = true;
  else s.manche++;
}

export function reduce(s, pid, a) {
  if (s.over) fail("La partie est terminée");
  if (!toAct(s).includes(pid)) fail(s.picks[pid] ? "Tu as déjà choisi" : "Ce n'est pas à toi de jouer");
  if (a.type !== "pick") fail("Action inconnue");
  if (!signsOf(s).includes(a.sign)) fail("Signe inconnu");
  s.picks[pid] = a.sign;
  if (s.format === "points") {
    if (s.ids.every((id) => s.picks[id])) resolveAll(s, a.seed || 1);
  } else {
    const k = matchOf(s, pid);
    const m = s.matches[k];
    if (s.picks[m.a] && s.picks[m.b]) resolveMatch(s, m, k, a.seed || 1);
  }
  return s;
}

export function result(s) {
  if (!s.over) return null;
  if (s.format === "points") return { ranking: rankByScore(s.ids.map((id) => ({ id, score: s.won[id] }))) };
  return { ranking: rankByScore(s.ids.map((id) => ({ id, score: s.passed[id] }))) };
}

// ------------------------------------------------ robot
// prédiction du prochain signe d'un adversaire d'après son historique
export function predict(s, hist) {
  const signs = signsOf(s);
  const w = Object.fromEntries(signs.map((k) => [k, 1]));
  const h = hist.slice(-8);
  for (let i = 0; i < h.length; i++) if (w[h[i]] != null) w[h[i]] += 0.5 + i * 0.15; // fréquence, le récent compte plus
  const last = h[h.length - 1];
  if (last) {
    // anti-répétition : on rejoue rarement 3 fois le même signe, et on change souvent après 1 fois
    const rep = h.length >= 2 && h[h.length - 2] === last;
    w[last] *= rep ? 0.25 : 0.6;
    // après avoir joué X, on passe souvent au signe qui bat X
    for (const k of signs) if (beats(k, last)) w[k] *= 1.35;
  }
  const tot = signs.reduce((n, k) => n + w[k], 0);
  return Object.fromEntries(signs.map((k) => [k, w[k] / tot]));
}

export function bot(s, pid, r) {
  if (s.over || !toAct(s).includes(pid)) return null;
  const signs = signsOf(s);
  const level = s.level || 2;
  const smart = level === 1 ? 0 : level === 2 ? 0.55 : 0.85;
  const mine = s.hist[pid] || "";
  // évite de jouer trois fois de suite le même signe
  const avoid = mine.length >= 2 && mine.slice(-1) === mine.slice(-2, -1) ? mine.slice(-1) : "";
  const pool = signs.filter((k) => k !== avoid);
  if (r.next() >= smart) return { type: "pick", sign: r.pick(level === 1 ? signs : pool) };
  let opps;
  if (s.format === "points") opps = s.ids.filter((id) => id !== pid);
  else { const m = s.matches[matchOf(s, pid)]; opps = [m.a === pid ? m.b : m.a]; }
  const preds = opps.map((id) => predict(s, s.hist[id] || ""));
  let best = -Infinity, cands = [];
  for (const k of pool) {
    let v = 0;
    for (const p of preds) for (const x of signs) v += p[x] * ((beats(k, x) ? 1 : 0) - (beats(x, k) ? 1 : 0));
    if (v > best + 1e-9) { best = v; cands = [k]; } else if (Math.abs(v - best) <= 1e-9) cands.push(k);
  }
  return { type: "pick", sign: r.pick(cands) };
}
export function auto(s, pid, r) { return { type: "pick", sign: r.pick(signsOf(s)) }; }
// le temps de laisser passer l'animation de révélation
export function botDelay(s, pid, r) { return 2600 + r.next() * 2200; }
