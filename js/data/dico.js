// Accès au dictionnaire français complet (311 000 mots, sans accents, majuscules).
// Importé seulement par les jeux qui en ont besoin : le gros fichier n'est chargé qu'avec eux.
import { DICO } from "./dico_fr.js";

// enlève accents et caractères non alphabétiques, met en majuscules
export const normWord = (w) => String(w || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase()
  .replace(/Œ/g, "OE").replace(/Æ/g, "AE").replace(/[^A-Z]/g, "");

export const count = (len) => (DICO[len] ? DICO[len].length / len : 0);
export const wordAt = (len, i) => DICO[len].slice(i * len, i * len + len);

// recherche dichotomique dans la chaîne triée des mots de cette longueur
export function isWord(w) {
  const u = normWord(w);
  const s = DICO[u.length];
  if (!s) return false;
  let lo = 0, hi = s.length / u.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const m = s.slice(mid * u.length, mid * u.length + u.length);
    if (m === u) return true;
    if (m < u) lo = mid + 1; else hi = mid - 1;
  }
  return false;
}

// mot au hasard d'une longueur donnée (rng du moteur)
export const randomWord = (rng, len) => wordAt(len, rng.int(count(len)));

// tous les mots d'une longueur (attention : gros tableau pour 6 à 10 lettres)
export function wordsOf(len) {
  const n = count(len), out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = wordAt(len, i);
  return out;
}

// mots dont les lettres sont toutes disponibles dans le tirage (Scrabble, Le compte est bon des lettres)
export function wordsFromLetters(letters, { min = 2, max = 15, limit = 5000 } = {}) {
  const pool = {};
  for (const c of normWord(letters)) pool[c] = (pool[c] || 0) + 1;
  const out = [];
  for (let len = Math.max(2, min); len <= Math.min(max, letters.length); len++) {
    const n = count(len);
    for (let i = 0; i < n && out.length < limit; i++) {
      const w = wordAt(len, i), need = {};
      let ok = true;
      for (const c of w) { need[c] = (need[c] || 0) + 1; if (need[c] > (pool[c] || 0)) { ok = false; break; } }
      if (ok) out.push(w);
    }
  }
  return out;
}

// mots contenant une suite de lettres (bombe à mots)
export function wordsContaining(sub, { min = 3, max = 12, limit = 200 } = {}) {
  const u = normWord(sub), out = [];
  for (let len = Math.max(min, u.length); len <= max && out.length < limit; len++) {
    const s = DICO[len];
    if (!s) continue;
    let from = 0;
    while (out.length < limit) {
      const k = s.indexOf(u, from);
      if (k < 0) break;
      const start = k - (k % len);
      if (k + u.length <= start + len) { out.push(s.slice(start, start + len)); from = start + len; }
      else from = k + 1;
    }
  }
  return out;
}
