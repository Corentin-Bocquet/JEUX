// Mécanique commune des quiz « flash » (vraifaux, intrus, geo) :
// une question pour tout le monde en même temps, chacun répond une fois,
// points selon la justesse et la vitesse, puis révélation et question suivante.
// Logique pure : aucun DOM, ni Math.random, ni Date.now.
import { fail } from "../../engine.js";

export const START_MS = 3000;   // compte à rebours avant la première question
export const MAX_SPEED = 50;    // bonus de rapidité maximal
export const BASE = 50;         // points d'une bonne réponse (sans le bonus)

// réglages : valeur choisie, ou le défaut si absente ou invalide
export function optValue(options, settings, key) {
  const o = options.find((x) => x.key === key);
  const v = settings ? settings[key] : undefined;
  const hit = o.values.find((x) => x[0] === v || (v != null && String(x[0]) === String(v)));
  return hit ? hit[0] : o.def;
}

export const levelOf = (settings) => ([1, 2, 3].includes(Number(settings && settings.level)) ? Number(settings.level) : 2);

// état de base ; le jeu remplit ensuite s.qs (une entrée compacte par question)
// cfg : { sudden, speed, reveal (ms d'affichage de la réponse), win (ms pour le bonus de vitesse), level }
export function flashSetup(players, cfg) {
  const s = {
    ids: players.map((p) => p.id), qs: [], qi: 0, qAt: null, ans: {}, last: null, done: false,
    scores: {}, good: {}, alive: {}, out: {},
    sudden: !!cfg.sudden, speed: cfg.speed !== false, reveal: cfg.reveal || 4000, win: cfg.win || 10000, level: cfg.level || 2,
  };
  for (const p of players) { s.scores[p.id] = 0; s.good[p.id] = 0; s.alive[p.id] = true; }
  return s;
}

// instant (ms) où la question en cours s'affiche
export const qStart = (s) => (s.qAt != null ? s.qAt : (s.startedAt || 0) + START_MS);
export const question = (s) => s.qs[s.qi] || null;
export const aliveIds = (s) => s.ids.filter((id) => s.alive[id]);

export function flashToAct(s) {
  if (s.done) return [];
  return s.ids.filter((id) => s.alive[id] && !(id in s.ans));
}

// points d'une bonne réponse donnée après ms millisecondes
export function pointsFor(s, ms) {
  if (!s.speed) return BASE + MAX_SPEED;
  const k = Math.max(0, Math.min(1, 1 - ms / s.win));
  return BASE + Math.round(MAX_SPEED * k);
}

// judge(v, q) -> true / false (ou fail() si la réponse est mal formée)
export function flashReduce(s, pid, a, judge, clean = (v) => v) {
  if (s.done) fail("La partie est terminée");
  if (!s.alive[pid]) fail("Tu es éliminé, regarde la suite !");
  if (pid in s.ans) fail("Tu as déjà répondu, attends les autres");
  if (!s.ids.includes(pid)) fail("Tu ne joues pas dans cette partie");
  if (!a || a.type !== "answer") fail("Action inconnue");
  const q = question(s);
  const none = a.v == null || a.v === "";
  const ok = none ? false : !!judge(a.v, q);
  const ms = Math.max(0, Math.round((a.now || 0) - qStart(s)));
  s.ans[pid] = { v: none ? null : clean(a.v), ok: ok ? 1 : 0, p: ok ? pointsFor(s, ms) : 0, ms };
  if (!flashToAct(s).length) closeQuestion(s, a.now || 0);
  return s;
}

function closeQuestion(s, now) {
  const elim = [];
  for (const id of s.ids) {
    const r = s.ans[id];
    if (!r) continue;
    s.scores[id] += r.p;
    s.good[id] += r.ok;
    if (s.sudden && !r.ok) { s.alive[id] = false; s.out[id] = s.qi; elim.push(id); }
  }
  s.last = { qi: s.qi, q: s.qs[s.qi], ans: s.ans, elim };
  s.ans = {};
  s.qi++;
  s.qAt = now + s.reveal;
  const alive = aliveIds(s).length;
  if (s.qi >= s.qs.length) s.done = true;
  else if (s.sudden && (alive === 0 || (s.ids.length > 1 && alive <= 1))) s.done = true;
}

// classement : en mort subite, survivre plus longtemps passe avant les points
export function flashResult(s) {
  if (!s.done) return null;
  const surv = (id) => (s.alive[id] ? 1e6 : s.out[id] ?? -1);
  const key = (id) => (s.sudden ? [surv(id), s.scores[id]] : [s.scores[id], 0]);
  const sorted = s.ids.slice().sort((a, b) => { const ka = key(a), kb = key(b); return kb[0] - ka[0] || kb[1] - ka[1]; });
  let rank = 0, prev = null;
  return {
    ranking: sorted.map((id, i) => {
      const k = key(id).join("/");
      if (k !== prev) { rank = i + 1; prev = k; }
      return { id, rank, score: s.scores[id] };
    }),
  };
}

// robots : le niveau fixe le taux de réussite, rates = [facile, moyen, fort]
export const botRight = (s, rng, rates) => rng.next() < (rates[(s.level || 2) - 1] ?? rates[1]);

// temps de réflexion plausible : révélation en cours + lecture + réponse
export function flashBotDelay(s, rng, factor = 1) {
  const wait = s.qi === 0 && s.qAt == null ? START_MS : s.reveal;
  const [lo, hi] = { 1: [3500, 8500], 2: [2500, 6500], 3: [1500, 4500] }[s.level] || [2500, 6500];
  return wait + (lo + rng.next() * (hi - lo)) * factor;
}

export const noAnswer = () => ({ type: "answer", v: null });

// espaces insécables du français (avant ? ! : ; », après «, dans 1 000)
export const typo = (t) => String(t).replace(/ ([?!:;»])/g, "\u00a0$1").replace(/« /g, "«\u00a0").replace(/(\d) (?=\d{3}\b)/g, "$1\u00a0");

// ---- comparaison souple des réponses tapées
export function normAnswer(t) {
  let x = String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/œ/g, "oe").replace(/æ/g, "ae").replace(/[^a-z0-9]+/g, " ").trim();
  x = x.replace(/^(le|la|les|l) /, "");
  return x.replace(/ /g, "");
}

export function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      // deux lettres voisines inversées = une seule faute
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

// vrai si typed correspond à une des réponses attendues (une faute tolérée dès 4 lettres),
// sauf si c'est exactement une autre réponse possible (ex. « Niger » pour « Nigeria »)
export function typedMatches(typed, goods, others = []) {
  const t = normAnswer(typed);
  if (!t) return false;
  const g = goods.map(normAnswer);
  if (g.includes(t)) return true;
  if (others.some((o) => normAnswer(o) === t)) return false;
  return g.some((x) => x.length >= 4 && editDistance(t, x) <= 1);
}
