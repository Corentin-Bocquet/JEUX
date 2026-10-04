// Mécanique commune aux jeux de plis Tarot et Bridge : lecture des réglages,
// tour de table, gagnant d'un pli selon une « force » de carte, places
// complétées par des robots internes, aides de choix pour les robots.
// Aucune dépendance au DOM : testable sous Node.
import { rankByScore } from "../../engine.js";

// ---------------------------------------------------------------- réglages
// Une valeur absente ou hors liste retombe sur le défaut.
export function optReader(options) {
  return (settings, key) => {
    const o = options.find((x) => x.key === key);
    const v = settings ? settings[key] : undefined;
    const hit = o.values.find((x) => String(x[0]) === String(v));
    return hit ? hit[0] : o.def;
  };
}
export const levelOf = (settings) => ([1, 2, 3].includes(Number(settings && settings.level)) ? Number(settings.level) : 2);

// ---------------------------------------------------------------- tour de table
export const nextSeat = (n, i, k = 1) => (((i + k) % n) + n) % n;

// pli = [{ p: place, c: carte }] ; power(c, lead) donne la force d'une carte
// (négative si elle ne peut pas gagner). Renvoie l'index gagnant dans le pli.
export function trickWinnerIdx(trick, power, lead) {
  let best = 0, bp = -Infinity;
  trick.forEach((t, i) => {
    const p = power(t.c, lead);
    if (p > bp) { bp = p; best = i; }
  });
  return best;
}

// ---------------------------------------------------------------- robots internes
// Quand il manque des joueurs (jeu à places fixes), on complète avec des
// robots que le salon ne connaît pas : ils jouent tout seuls dans reduce.
export const VIRT = "@robot";
export const isVirtual = (id) => typeof id === "string" && id.startsWith(VIRT);
export function fillSeats(ids, n) {
  const seats = ids.slice(0, n);
  for (let k = 1; seats.length < n; k++) seats.push(VIRT + k);
  return seats;
}

// Classement des vrais joueurs à partir d'un score par joueur.
export function rankPlayers(ids, scoreOf) {
  return rankByScore(ids.filter((id) => !isVirtual(id)).map((id) => ({ id, score: scoreOf(id) })));
}

// ---------------------------------------------------------------- aides robots
export const minBy = (arr, f) => arr.reduce((b, x) => (b === undefined || f(x) < f(b) ? x : b), undefined);
export const maxBy = (arr, f) => arr.reduce((b, x) => (b === undefined || f(x) > f(b) ? x : b), undefined);

// Délai de réflexion : un peu plus long juste après un pli, pour qu'on le voie.
export function trickDelay(trickLen, justClosed, r) {
  const j = r ? r.int(600) : 300;
  if (trickLen === 0 && justClosed) return 1500 + j;
  return 650 + j;
}
