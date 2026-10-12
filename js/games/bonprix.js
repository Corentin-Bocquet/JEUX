import { fail, rankByScore } from "../engine.js";
import { PRODUITS } from "../data/bonprix_produits.js";

export const meta = {
  id: "bonprix", name: "Le bon prix", cat: "Quiz", min: 1, max: 8, turnTime: 40, race: true,
  color: "#EA580C", desc: "Estime le prix d'objets du quotidien, au plus juste.",
  rules: ["Un produit apparaît : tout le monde propose un prix en même temps, sans voir les offres des autres.",
    "Règle « sans dépasser » : le plus proche du vrai prix SANS le dépasser gagne la manche (100 points). Si tout le monde dépasse, personne ne gagne.",
    "Règle « au plus proche » : le plus proche gagne, au-dessus ou en dessous.",
    "À moins de 2 % du vrai prix, c'est « pile » : +50 points de bonus.",
    "Mode « plus ou moins » : tu as 8 essais, on te dit si c'est plus ou moins. Trouvé à 5 % près, et moins tu utilises d'essais, plus tu marques.",
    "Prix courants en France en 2024-2025 : un ordre de grandeur, pas une étiquette de magasin."],
};

export const RAYONS = { c: "Courses", m: "Maison et loisirs", s: "Sorties et services" };
export const WIN = 100, PILE = 50, PILE_PCT = 0.02, FOUND_PCT = 0.05, PM_TRIES = 8, MAX_CENTS = 10_000_000;

export const options = [
  { key: "rounds", label: "Manches", icon: "🔁", values: [[5, "5", "Rapide"], [8, "8", "Standard"], [12, "12", "Long"]], def: 8 },
  { key: "jeu", label: "Façon", icon: "🎯", values: [["offre", "Une offre", "Tous en même temps"], ["plusmoins", "Plus/moins", "8 essais"]], def: "offre" },
  { key: "regle", label: "Gagnant", icon: "🏆", values: [["dessous", "En dessous", "Sans dépasser"], ["proche", "Au plus près", "L'écart seul"]], def: "dessous" },
  { key: "rayon", label: "Rayon", icon: "🛒",
    values: [["tout", "Tout", "Mélange"], ["c", "Courses", "Supermarché"], ["m", "Maison", "Objets, high-tech"], ["s", "Sorties", "Services"]], def: "tout" },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "💶", desc: "8 produits, une offre chacun, le plus proche sans dépasser.", set: { rounds: 8, jeu: "offre", regle: "dessous", rayon: "tout" } },
  { id: "proche", name: "Au plus proche", emoji: "🎯", desc: "Dépasser n'est plus éliminatoire : seul l'écart compte.", set: { rounds: 8, jeu: "offre", regle: "proche", rayon: "tout" } },
  { id: "plusmoins", name: "Plus ou moins", emoji: "↕️", desc: "5 produits, devine en plusieurs essais grâce aux indices.", set: { rounds: 5, jeu: "plusmoins", regle: "dessous", rayon: "tout" } },
  { id: "caddie", name: "Le caddie", emoji: "🛒", desc: "12 articles du supermarché, au plus proche.", set: { rounds: 12, jeu: "offre", regle: "proche", rayon: "c" } },
];

export function opt(settings, key) {
  const o = options.find((x) => x.key === key);
  const v = settings ? settings[key] : undefined;
  const hit = o.values.find((x) => x[0] === v || (v != null && String(x[0]) === String(v)));
  return hit ? hit[0] : o.def;
}

export const euros = (c) => (c / 100).toLocaleString("fr-FR", { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 }) + " €";

export function setup(players, settings, rng) {
  const rayon = opt(settings, "rayon");
  const pool = PRODUITS.map((_, i) => i).filter((i) => rayon === "tout" || PRODUITS[i][4] === rayon);
  const deck = rng.shuffle(pool).slice(0, opt(settings, "rounds"));
  const s = { ids: players.map((p) => p.id), deck, rounds: deck.length, jeu: opt(settings, "jeu"), regle: opt(settings, "regle"), rayon,
    roundNo: 1, scores: {}, level: settings.level || 2, done: false };
  players.forEach((p) => (s.scores[p.id] = 0));
  newRound(s);
  return s;
}

function newRound(s) {
  s.phase = "play";
  s.bids = {};                 // offre unique (mode offre)
  s.g = {};                    // essais (mode plus ou moins)
  s.st = {};
  s.pts = {};
  s.first = null;
  s.win = [];
  s.ready = [];
  for (const id of s.ids) { s.g[id] = []; s.st[id] = "playing"; s.pts[id] = 0; }
}

export const current = (s) => s.deck[s.roundNo - 1];
export const priceOf = (s) => PRODUITS[current(s)][3];

export function toAct(s) {
  if (s.done) return [];
  if (s.phase === "reveal") return s.ids.filter((id) => !s.ready.includes(id));
  return s.ids.filter((id) => s.st[id] === "playing");
}

// manche « une offre » : on désigne les gagnants quand tout le monde a proposé
export function winners(s) {
  const price = priceOf(s);
  let cands = s.ids.filter((id) => s.bids[id] != null);
  if (s.regle === "dessous") cands = cands.filter((id) => s.bids[id] <= price);
  if (!cands.length) return [];
  const best = Math.min(...cands.map((id) => Math.abs(price - s.bids[id])));
  return cands.filter((id) => Math.abs(price - s.bids[id]) === best);
}

function closeRound(s) {
  const price = priceOf(s);
  if (s.jeu === "offre") {
    s.win = winners(s);
    for (const id of s.ids) {
      let p = s.win.includes(id) ? WIN : 0;
      const b = s.bids[id];
      if (b != null && Math.abs(b - price) <= price * PILE_PCT && (s.regle === "proche" || b <= price)) p += PILE;
      s.pts[id] = p;
      s.scores[id] += p;
    }
  } else {
    s.win = s.ids.filter((id) => s.st[id] === "found");
  }
  s.phase = "reveal";
  s.ready = [];
}

export function reduce(s, pid, a) {
  if (!toAct(s).includes(pid)) fail(s.phase === "reveal" ? "Tu es déjà prêt" : "Attends la manche suivante");
  if (s.phase === "reveal") {
    if (a.type !== "next") fail("Passe à la manche suivante");
    s.ready.push(pid);
    if (s.ready.length >= s.ids.length) {
      if (s.roundNo >= s.rounds) s.done = true;
      else { s.roundNo++; newRound(s); }
    }
    return s;
  }
  if (a.type === "pass") {
    s.st[pid] = "out";
  } else if (a.type === "bid") {
    const c = Number(a.cents);
    if (!Number.isInteger(c) || c < 1 || c > MAX_CENTS) fail("Prix invalide");
    const price = priceOf(s);
    if (s.jeu === "offre") {
      s.bids[pid] = c;
      s.st[pid] = "done";
    } else {
      const g = s.g[pid];
      const ok = Math.abs(c - price) <= price * FOUND_PCT;
      g.push([c, ok ? 0 : c < price ? 1 : -1]);   // 1 = c'est plus, -1 = c'est moins
      if (ok) {
        s.st[pid] = "found";
        let p = 10 * (PM_TRIES + 2 - g.length);       // 90 au premier essai, 20 au huitième
        if (!s.first) { s.first = pid; p += 20; }
        if (Math.abs(c - price) <= price * PILE_PCT) p += PILE;
        s.pts[pid] = p;
        s.scores[pid] += p;
      } else if (g.length >= PM_TRIES) s.st[pid] = "out";
    }
  } else fail("Action inconnue");
  if (!s.ids.some((id) => s.st[id] === "playing")) closeRound(s);
  return s;
}

export function result(s) {
  if (!s.done) return null;
  return { ranking: rankByScore(s.ids.map((id) => ({ id, score: s.scores[id] }))) };
}

// ------------------------------------------------ robots : estimation bruitée (log-normale)
const SIGMA = { 1: 0.5, 2: 0.3, 3: 0.16 };
function gauss(r) { return Math.sqrt(-2 * Math.log(1 - r.next())) * Math.cos(2 * Math.PI * r.next()); }
const round2 = (c) => (c >= 10000 ? Math.round(c / 100) * 100 : c >= 1000 ? Math.round(c / 10) * 10 : Math.max(1, Math.round(c)));

export function bot(s, pid, rng) {
  if (s.phase === "reveal") return { type: "next" };
  const price = priceOf(s);
  const lvl = s.level || 2;
  const sig = SIGMA[lvl] || 0.3;
  if (s.jeu === "offre") {
    // sans dépasser : on vise un peu en dessous de son estimation
    const shade = s.regle === "dessous" ? Math.exp(-sig * 0.6) : 1;
    return { type: "bid", cents: Math.min(MAX_CENTS, round2(price * Math.exp(sig * gauss(rng)) * shade)) };
  }
  // plus ou moins : recherche dichotomique (géométrique) entre les bornes connues
  let lo = 0, hi = Infinity;
  for (const [c, d] of s.g[pid]) { if (d === 1) lo = Math.max(lo, c); else if (d === -1) hi = Math.min(hi, c); }
  let guess;
  if (!s.g[pid].length) guess = price * Math.exp(sig * gauss(rng));
  else if (hi === Infinity) guess = lo * (lvl === 1 ? 1.6 : 2.2);
  else if (lo === 0) guess = hi / (lvl === 1 ? 1.6 : 2.2);
  else guess = Math.sqrt(lo * hi) * Math.exp((lvl === 1 ? 0.25 : 0.05) * gauss(rng));
  return { type: "bid", cents: Math.min(MAX_CENTS, Math.max(1, Math.round(guess))) };
}
export function auto(s, pid, rng) { return s.phase === "reveal" ? { type: "next" } : { type: "pass" }; }
export function botDelay(s, pid, rng) {
  if (s.phase === "reveal") return 1500 + rng.next() * 1500;
  return ({ 1: 9000, 2: 7000, 3: 5000 }[s.level] || 7000) * (0.5 + rng.next() * 0.8);
}
export { PRODUITS };
