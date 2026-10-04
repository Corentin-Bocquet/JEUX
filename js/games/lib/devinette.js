// Aides communes aux jeux de mots à deviner (Agents secrets, Célébrités, Mots interdits, Mimes) :
// normalisation, comparaison tolérante (accents, petite faute), mots interdits et dérivés,
// équipes, chrono de tour stocké dans l'état, fil des messages. Aucun DOM.

// ------------------------------------------------ texte
export const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/œ/g, "oe").replace(/æ/g, "ae").replace(/[^a-z0-9]+/g, " ").trim();
export const squash = (s) => norm(s).replace(/ /g, "");
export const tokens = (s) => norm(s).split(" ").filter(Boolean);
const ARTICLES = new Set(["le", "la", "les", "l", "un", "une", "des", "du", "de", "d", "au", "aux"]);
export const STOP = new Set([...ARTICLES, "et", "ou", "a", "en", "sur", "sous", "dans", "par", "pour", "avec", "sans", "il", "elle", "on", "se", "sa", "son", "ses", "ce", "qui", "que", "est", "the", "of"]);
// enlève les articles de tête : « la tour Eiffel » = « tour Eiffel »
export function core(s) {
  const t = tokens(s);
  while (t.length > 1 && ARTICLES.has(t[0])) t.shift();
  return t.join("");
}

// distance d'édition (arrêt dès que max est dépassé)
export function lev(a, b, max = 9) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
// fautes tolérées selon la longueur de la réponse
export const tolerance = (n) => (n >= 9 ? 2 : n >= 4 ? 1 : 0);
// la proposition correspond-elle à la réponse ? (sans accents, sans articles, une petite faute permise)
export function same(guess, answer) {
  const g = core(guess), a = core(answer);
  if (!g || !a) return false;
  if (g === a) return true;
  return lev(g, a, 2) <= tolerance(a.length);
}
export const matchAny = (guess, answers) => answers.some((a) => same(guess, a));

// ------------------------------------------------ mots interdits et dérivés simples
const SUFFIXES = ["issements", "issement", "ations", "ation", "ements", "ement", "ments", "ment", "euses", "euse", "eurs", "eur",
  "rices", "rice", "ettes", "ette", "ages", "age", "ieres", "iere", "iers", "ier", "elles", "elle", "ees", "ee", "es", "er", "ez", "s", "x", "e"];
export function stem(w) {
  let s = squash(w);
  for (const suf of SUFFIXES) if (s.endsWith(suf) && s.length - suf.length >= 4) { s = s.slice(0, -suf.length); break; }
  return s;
}
// deux mots de même famille ? (pluriel, féminin, verbe, nom en -eur, -ette, -age...)
export function related(a, b) {
  const x = squash(a), y = squash(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const sx = stem(x), sy = stem(y);
  if (sx === sy) return true;
  if (sy.length >= 5 && x.startsWith(sy)) return true;
  if (sx.length >= 5 && y.startsWith(sx)) return true;
  return false;
}
const sig = (s) => tokens(s).filter((t) => t.length >= 3 && !STOP.has(t));
// renvoie le mot interdit touché par le texte, ou null
export function bannedHit(text, banned) {
  const ts = tokens(text);
  const whole = squash(text);
  for (const b of banned) {
    const bt = sig(b);
    if (!bt.length) continue;
    if (bt.length > 1 && squash(b).length >= 5 && whole.includes(squash(b))) return b;
    for (const t of ts) if (t.length >= 2 && bt.some((x) => related(t, x))) return b;
  }
  return null;
}

// ------------------------------------------------ réglages
export function optOf(options, settings, key) {
  const o = options.find((x) => x.key === key);
  const v = settings ? settings[key] : undefined;
  const hit = o.values.find((x) => x[0] === v || (v != null && String(x[0]) === String(v)));
  return hit ? hit[0] : o.def;
}
export const levelOf = (settings) => ([1, 2, 3].includes(settings && settings.level) ? settings.level : 2);

// ------------------------------------------------ équipes (alternées dans l'ordre du salon)
export function makeTeams(ids) {
  const t = [[], []];
  ids.forEach((id, i) => t[i % 2].push(id));
  return t;
}
export const teamOf = (teams, id) => (teams[0].includes(id) ? 0 : teams[1].includes(id) ? 1 : -1);
export const TEAM_NAMES = ["Rouges", "Bleus"];
// classement d'équipe : les partenaires vainqueurs sont 1ers ensemble
export function teamResult(teams, teamScores, rankByScore) {
  const ranking = rankByScore(teams.flatMap((t, k) => t.map((id) => ({ id, score: teamScores[k] }))));
  return { ranking, teams: teams.map((t) => t.slice()) };
}

// ------------------------------------------------ chrono de tour (dans l'état, en ms)
export const startClock = (s, now, secs) => { s.endsAt = (now || 0) + secs * 1000; };
export const isOver = (s, now) => s.phase === "play" && s.endsAt > 0 && (now || 0) >= s.endsAt;
export const timeLeft = (s, now) => Math.max(0, (s.endsAt || 0) - now);

// ------------------------------------------------ fil des messages (borné pour garder l'état compact)
export function pushLog(s, e, max = 14) {
  s.log.push(e);
  if (s.log.length > max) s.log.splice(0, s.log.length - max);
}

// ------------------------------------------------ indices de lettres pour les robots
export function mask(word, show) {
  const letters = [...String(word)];
  let k = 0;
  return letters.map((c) => {
    if (!/[a-zA-Zà-ÿÀ-ÿœŒ]/.test(c)) return c === " " ? " / " : c;
    const out = k < show || k === 0 ? c.toUpperCase() : "_";
    k++;
    return out;
  }).join(" ").replace(/\s+\/\s+/g, "  /  ");
}
export const letterCount = (word) => [...squash(word)].length;

// probabilité qu'un robot trouve, selon son niveau et le nombre d'indices déjà donnés
export function findChance(level, clues, tries = 0) {
  const base = { 1: 0.12, 2: 0.22, 3: 0.34 }[level] || 0.22;
  return Math.min(0.97, base + clues * 0.16 + tries * 0.06);
}
