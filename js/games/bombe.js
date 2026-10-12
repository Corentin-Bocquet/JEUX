import { fail, rng as mkRng } from "../engine.js";
import { isWord, normWord, wordsContaining } from "../data/dico.js";
import { SYLLABES, COURANTS } from "../data/bombe_syllabes.js";

export const meta = {
  id: "bombe", name: "Bombe à mots", cat: "Mots", min: 2, max: 8, turnTime: 30,
  color: "#1F2937", desc: "Trouve vite un mot avec la syllabe avant que la bombe explose !",
  rules: ["Quand la bombe est chez toi, une syllabe s'affiche (par exemple TRA).",
    "Tape un mot qui la contient (TRAIN, ATTRAPER...) : il doit exister et ne pas avoir déjà servi. La bombe passe alors au suivant.",
    "La mèche a une durée secrète et aléatoire : celui qui tient la bombe quand elle explose perd une vie.",
    "Un mot refusé ne coûte rien, mais le temps tourne !",
    "Option alphabet : utilise toutes les lettres de A à V (sauf K et Q) dans tes mots pour gagner une vie.",
    "Le dernier joueur en vie gagne."],
};

export const options = [
  { key: "lives", label: "Vies", icon: "❤️", values: [[1, "1", "Mort subite"], [2, "2", "Standard"], [3, "3", "Endurance"]], def: 2 },
  { key: "fuse", label: "Mèche", icon: "🧨", values: [["court", "Courte", "5 à 12 s"], ["normal", "Normale", "8 à 20 s"], ["long", "Longue", "12 à 30 s"]], def: "normal" },
  { key: "syl", label: "Syllabes", icon: "🔤", values: [["facile", "Faciles"], ["moyen", "Moyennes"], ["dur", "Difficiles"]], def: "moyen" },
  { key: "alpha", label: "Alphabet", icon: "🔠", values: [[true, "Oui", "+1 vie"], [false, "Non"]], def: true },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "💣", desc: "2 vies, mèche normale, syllabes moyennes, bonus alphabet.", set: { lives: 2, fuse: "normal", syl: "moyen", alpha: true } },
  { id: "eclair", name: "Éclair", emoji: "⚡", desc: "Une seule vie, mèche courte, syllabes faciles.", set: { lives: 1, fuse: "court", syl: "facile", alpha: false } },
  { id: "survie", name: "Survie", emoji: "🛡️", desc: "3 vies et une longue mèche pour souffler.", set: { lives: 3, fuse: "long", syl: "moyen", alpha: true } },
  { id: "expert", name: "Expert", emoji: "🧠", desc: "Syllabes difficiles et mèche courte.", set: { lives: 2, fuse: "court", syl: "dur", alpha: true } },
];
export function opt(settings, key) {
  const o = options.find((x) => x.key === key);
  const v = settings ? settings[key] : undefined;
  const hit = o.values.find((x) => x[0] === v || (v != null && String(x[0]) === String(v)));
  return hit ? hit[0] : o.def;
}

export const FUSES = { court: [5000, 12000], normal: [8000, 20000], long: [12000, 30000] };
export const MIN_TURN = 3000; // le nouveau porteur a toujours au moins 3 s
export const ALPHA = "ABCDEFGHIJLMNOPRSTUV";
export const POOLS = { facile: SYLLABES.facile.split(" "), moyen: SYLLABES.moyen.split(" "), dur: SYLLABES.dur.split(" ") };
const COMMON = COURANTS.split(/\s+/).filter((w) => w && isWord(w));

const fuseLen = (s, r) => { const [a, b] = FUSES[s.fuse]; return a + r.int(b - a + 1); };
function newSyl(s, r) {
  const pool = POOLS[s.syl];
  let x = r.pick(pool);
  if (x === s.syllable) x = r.pick(pool);
  s.syllable = x;
}

export function setup(players, settings, rng) {
  const s = { ids: players.map((p) => p.id), maxLives: opt(settings, "lives"), fuse: opt(settings, "fuse"), syl: opt(settings, "syl"), alpha: opt(settings, "alpha"),
    level: [1, 2, 3].includes(settings.level) ? settings.level : 2, lives: {}, words: {}, letters: {}, out: [], used: [], turn: rng.int(players.length),
    syllable: "", fuseMs: 0, boomAt: 0, roundAt: 0, tick: 0, last: null, done: false };
  for (const p of players) { s.lives[p.id] = s.maxLives; s.words[p.id] = 0; s.letters[p.id] = ""; }
  newSyl(s, rng);
  s.fuseMs = fuseLen(s, rng);
  return s;
}

// heure de l'explosion (la première mèche part au début de la partie)
export const deadline = (s) => s.boomAt || (s.startedAt || 0) + s.fuseMs;
export const roundStart = (s) => s.roundAt || s.startedAt || 0;
export const holder = (s) => s.ids[s.turn];
export const alive = (s) => s.ids.filter((id) => s.lives[id] > 0);

export function toAct(s) { return s.done ? [] : [holder(s)]; }

function passOn(s) {
  const n = s.ids.length;
  for (let k = 1; k <= n; k++) { const i = (s.turn + k) % n; if (s.lives[s.ids[i]] > 0) { s.turn = i; return; } }
}

function explode(s, now, r, how) {
  const id = holder(s);
  s.lives[id]--;
  s.last = { id, k: how, syl: s.syllable };
  if (s.lives[id] <= 0) s.out.push(id);
  if (alive(s).length <= 1) { s.done = true; return; }
  passOn(s);
  newSyl(s, r);
  s.fuseMs = fuseLen(s, r);
  s.roundAt = now;
  s.boomAt = now + s.fuseMs;
}

export function check(s, word) {
  const w = normWord(word);
  if (w.length < 2) return "Tape un mot";
  if (!w.includes(s.syllable)) return `Le mot doit contenir ${s.syllable}`;
  if (s.used.includes(w)) return "Ce mot a déjà servi";
  if (!isWord(w)) return "Mot inconnu du dictionnaire";
  return null;
}

export function reduce(s, pid, a) {
  if (!s.ids.includes(pid)) fail("Tu ne joues pas");
  const now = a.now || 0, r = mkRng(a.seed || 1);
  if (!s.boomAt) { s.boomAt = deadline(s); s.roundAt = roundStart(s); }
  if (a.type === "boom") {
    // n'importe quel appareil peut constater l'explosion, une seule fois par tour
    if (a.tick !== s.tick) fail("Le tour a changé");
    if (now < s.boomAt) fail("Pas encore");
    explode(s, now, r, "boom");
    s.tick++;
    return s;
  }
  if (pid !== holder(s)) fail("Ce n'est pas ton tour");
  if (a.type === "pass") { explode(s, now, r, "pass"); s.tick++; return s; }
  if (a.type !== "word") fail("Action inconnue");
  if (now >= s.boomAt) { explode(s, now, r, "boom"); s.tick++; return s; }
  const err = check(s, a.word);
  if (err) fail(err);
  const w = normWord(a.word);
  s.used.push(w);
  s.words[pid]++;
  s.last = { id: pid, k: "ok", w, syl: s.syllable };
  if (s.alpha) {
    let L = s.letters[pid];
    for (const c of w) if (ALPHA.includes(c) && !L.includes(c)) L += c;
    if (L.length >= ALPHA.length) { L = ""; s.lives[pid]++; s.last.bonus = true; }
    s.letters[pid] = L;
  }
  passOn(s);
  newSyl(s, r);
  s.boomAt = Math.max(s.boomAt, now + MIN_TURN);
  s.tick++;
  return s;
}

export function result(s) {
  if (!s.done) return null;
  const order = [...alive(s), ...s.out.slice().reverse()];
  return { ranking: order.map((id, i) => ({ id, rank: i + 1, score: s.words[id] })) };
}

// ------------------------------------------------ robots
const SUCCESS = { 1: 0.72, 2: 0.86, 3: 0.95 };
const DIFF = { facile: 1, moyen: 0.97, dur: 0.9 };
export function botWord(s, rng) {
  const syl = s.syllable;
  let list = COMMON.filter((w) => w.includes(syl) && !s.used.includes(w));
  if (!list.length || (s.level === 3 && rng.next() < 0.3)) list = list.concat(wordsContaining(syl, { min: 3, max: 10, limit: 300 }).filter((w) => !s.used.includes(w)));
  return list.length ? rng.pick(list) : null;
}
export function bot(s, pid, rng) {
  if (s.done || pid !== holder(s)) return null;
  const p = (SUCCESS[s.level] || 0.86) * DIFF[s.syl];
  const w = rng.next() < p ? botWord(s, rng) : null;
  return w ? { type: "word", word: w } : { type: "pass" };
}
export function auto() { return { type: "pass" }; }
export function botDelay(s, pid, rng) {
  const base = { 1: 2600, 2: 1900, 3: 1200 }[s.level] || 1900;
  return base + rng.next() * 3200;
}
