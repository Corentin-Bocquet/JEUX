// Imposteur : les civils ont un mot, l'imposteur un mot voisin (et peut-être un
// Mister blanc sans mot). Indices d'un mot à tour de rôle, puis vote d'élimination.
import { fail, rng as mkRng } from "../engine.js";
import * as L from "./lib/roles.js";
import { PAIRS, ASSOC } from "../data/imposteur_mots.js";

export const meta = {
  id: "imposteur", name: "Imposteur", cat: "Soirée", min: 3, max: 8, turnTime: 40,
  color: "#7E22CE", desc: "Un mot secret, un intrus qui a un mot voisin. Démasque-le !",
  rules: [
    "Chacun reçoit un mot en secret. Les civils ont tous le même, l'imposteur a un mot proche (il ne sait pas qu'il est l'imposteur).",
    "À tour de rôle, chacun tape un indice d'un seul mot sur son mot, sans le dire.",
    "Puis tout le monde vote pour éliminer un suspect. Son rôle est révélé. Égalité : on rejoue un tour d'indices, puis le sort tranche.",
    "Option Mister blanc : un joueur n'a aucun mot et doit bluffer. S'il est éliminé, il peut gagner en devinant le mot des civils.",
    "Les civils gagnent quand tous les intrus sont éliminés. L'imposteur gagne s'il tient jusqu'à ce qu'il ne reste que 2 joueurs.",
  ],
};

export const options = [
  { key: "blanc", label: "Mister blanc", icon: "⬜", values: [[false, "Non"], [true, "Oui", "Dès 4 joueurs"]], def: false },
  { key: "imp", label: "Imposteurs", icon: "🕵️", values: [[1, "1"], [2, "2", "Dès 6 joueurs"]], def: 1 },
  { key: "tours", label: "Indices", icon: "💬", values: [[1, "1 tour", "Avant chaque vote"], [2, "2 tours", "Avant chaque vote"]], def: 1 },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "🕵️", desc: "Un imposteur, un tour d'indices avant chaque vote.", set: { blanc: false, imp: 1, tours: 1 } },
  { id: "blanc", name: "Mister blanc", emoji: "⬜", desc: "Un joueur sans mot bluffe en plus de l'imposteur.", set: { blanc: true, imp: 1, tours: 1 } },
  { id: "bavard", name: "Bavard", emoji: "💬", desc: "Deux tours d'indices avant chaque vote.", set: { blanc: false, imp: 1, tours: 2 } },
  { id: "chaos", name: "Chaos", emoji: "🌀", desc: "Deux imposteurs et un Mister blanc dès 6 joueurs.", set: { blanc: true, imp: 2, tours: 1 } },
];
const opt = (settings, key) => L.optVal(options, settings, key);

export const ROLE_NAME = { civil: "Civil", imposteur: "Imposteur", blanc: "Mister blanc" };
export const isAlive = (s, id) => !s.dead.includes(id);
export const alive = (s) => s.ids.filter((id) => isAlive(s, id));
export const wordOf = (s, id) => (s.roles[id] === "civil" ? s.words[0] : s.roles[id] === "imposteur" ? s.words[1] : "");
const nameIn = (s, id) => s.names[id] || "?";

export function setup(players, settings, r) {
  const n = players.length;
  const nImp = opt(settings, "imp") === 2 && n >= 6 ? 2 : 1;
  const blanc = opt(settings, "blanc") && n >= 4 ? 1 : 0;
  const deal = r.shuffle([...Array(nImp).fill("imposteur"), ...Array(blanc).fill("blanc"), ...Array(n - nImp - blanc).fill("civil")]);
  const pair = r.pick(PAIRS);
  const words = r.next() < 0.5 ? [pair[0], pair[1]] : [pair[1], pair[0]];
  const s = {
    ids: players.map((p) => p.id), names: Object.fromEntries(players.map((p) => [p.id, p.name])),
    roles: Object.fromEntries(players.map((p, i) => [p.id, deal[i]])), words,
    dead: [], phase: "role", ready: {}, order: [], turn: 0, lap: 1, cycle: 1, clues: [], vote: null, ties: 0,
    winner: null, guess: null, news: [], chat: [], chatNo: 0, talk: {},
    tours: opt(settings, "tours"), level: L.levelOf(settings), start: r.int(n),
  };
  L.narrate(s, "Retourne ta carte en secret pour découvrir ton mot.");
  return s;
}

export function toAct(s) {
  if (s.winner) return [];
  if (s.phase === "role") return s.ids.filter((id) => !s.ready[id]);
  if (s.phase === "clue") return [s.order[s.turn]];
  if (s.phase === "vote") return L.votePending(s);
  if (s.phase === "guess") return [s.guess.id];
  return [];
}

function startClues(s) {
  s.phase = "clue"; s.turn = 0; s.lap = 1; L.resetTalk(s);
  const al = alive(s);
  let k = s.start % al.length;
  // Mister blanc ne commence jamais le premier tour
  if (s.cycle === 1) for (let i = 0; i < al.length && s.roles[al[k]] === "blanc"; i++) k = (k + 1) % al.length;
  s.order = [...al.slice(k), ...al.slice(0, k)];
  s.start++;
  L.narrate(s, `💬 Tour d'indices ${s.cycle} : ${nameIn(s, s.order[0])} commence.`);
}
function startVote(s) {
  s.phase = "vote";
  L.openVote(s, "elim", alive(s), alive(s));
  L.narrate(s, "🗳️ Votez pour éliminer le suspect !");
}

export function clueError(s, pid, text) {
  const t = L.clean(text, 24);
  if (!t) return "Tape un indice";
  if (!/^[\p{L}][\p{L}'’-]*$/u.test(t)) return "Un seul mot, sans espace ni chiffre";
  const nt = L.norm(t);
  const w = wordOf(s, pid);
  if (w) for (const part of L.norm(w).split(" ")) if (part.length >= 3 && (nt.includes(part) || part.includes(nt.replace(/ /g, "")))) return "Ton indice ne doit pas contenir ton mot";
  if (s.clues.some((c) => c.w && L.norm(c.w) === nt)) return "Cet indice a déjà été donné";
  return null;
}

function reduceInner(s, pid, a, r) {
  switch (a.type) {
    case "ready":
      if (s.phase !== "role") fail("Pas maintenant");
      s.ready[pid] = 1;
      if (!toAct(s).length) startClues(s);
      return;
    case "clue": {
      if (s.phase !== "clue" || s.order[s.turn] !== pid) fail("Ce n'est pas ton tour");
      const pass = !!a.pass;
      if (!pass) { const e = clueError(s, pid, a.word); if (e) fail(e); }
      const w = pass ? "" : L.clean(a.word, 24);
      s.clues.push({ p: pid, w, c: s.cycle });
      L.post(s, pid, w || "(passe son tour)", "clue");
      s.turn++;
      if (s.turn >= s.order.length) {
        if (s.lap < s.tours) { s.lap++; s.turn = 0; L.narrate(s, "💬 Encore un tour d'indices."); }
        else startVote(s);
      }
      return;
    }
    case "vote": {
      if (s.phase !== "vote") fail("Pas de vote en cours");
      if (a.target === pid) fail("Tu ne peux pas voter contre toi");
      L.castVote(s, pid, a.target);
      if (!L.votePending(s).length) closeVote(s, r);
      return;
    }
    case "guess": {
      if (s.phase !== "guess" || s.guess.id !== pid) fail("Ce n'est pas le moment");
      const g = L.clean(a.word, 30);
      const ok = !!g && L.norm(g) === L.norm(s.words[0]);
      s.guess.w = g || "(rien)"; s.guess.ok = ok;
      if (ok) { note(s, `⬜ ${nameIn(s, pid)} devine le mot des civils : « ${s.words[0]} » ! Mister blanc gagne.`); end(s, "blanc"); return; }
      note(s, `⬜ ${nameIn(s, pid)} propose « ${s.guess.w} »… raté !`);
      afterElim(s);
      return;
    }
  }
  fail("Action inconnue");
}

function note(s, t) { s.news.push(t); L.narrate(s, t); }

function closeVote(s, r) {
  const res = L.closeVote(s);
  s.news = [];
  s.lastVote = res.b;
  let out = res.winner;
  if (!out) {
    s.ties++;
    if (s.ties >= 2) { out = r.pick(res.top); note(s, `Encore une égalité : le sort désigne ${nameIn(s, out)}.`); }
    else { note(s, "Égalité ! Personne n'est éliminé : nouveau tour d'indices."); s.cycle++; startClues(s); return; }
  }
  s.ties = 0;
  s.dead.push(out);
  const role = s.roles[out];
  note(s, `${nameIn(s, out)} est éliminé. C'était ${role === "civil" ? "un civil 😇" : role === "imposteur" ? "l'imposteur 🕵️" : "Mister blanc ⬜"}${role === "imposteur" ? ` (son mot : « ${s.words[1]} »)` : ""}.`);
  if (role === "blanc") { s.phase = "guess"; s.guess = { id: out, w: "", ok: false }; return; }
  afterElim(s);
}

function afterElim(s) {
  const al = alive(s);
  const intrus = al.filter((id) => s.roles[id] !== "civil");
  if (!intrus.length) return end(s, "civils");
  if (al.length <= 2) return end(s, "intrus");
  s.cycle++;
  startClues(s);
}

function end(s, who) {
  s.winner = who; s.phase = "end"; s.vote = null;
  const txt = { civils: "🎉 Tous les intrus sont démasqués : les civils gagnent !", intrus: "🕵️ Il ne reste que deux joueurs : les intrus gagnent !", blanc: "⬜ Mister blanc l'emporte !" }[who];
  note(s, txt + ` Mot des civils : « ${s.words[0]} », mot de l'imposteur : « ${s.words[1]} ».`);
}

export function winners(s) {
  if (s.winner === "civils") return s.ids.filter((id) => s.roles[id] === "civil");
  if (s.winner === "blanc") return [s.guess.id];
  if (s.winner === "intrus") return s.ids.filter((id) => s.roles[id] === "imposteur" || (s.roles[id] === "blanc" && isAlive(s, id)));
  return [];
}

export function reduce(s, pid, a) {
  if (s.winner) fail("La partie est terminée");
  if (!s.ids.includes(pid)) fail("Tu ne joues pas à cette partie");
  if (a.type === "say") {
    if (!isAlive(s, pid)) fail("Les éliminés ne parlent plus");
    L.say(s, pid, a.text, { perPhase: 3 });
    return s;
  }
  if (!toAct(s).includes(pid)) fail("Ce n'est pas à toi d'agir");
  reduceInner(s, pid, a, mkRng(a.seed || 1));
  return s;
}

export function result(s) {
  if (!s.winner) return null;
  return L.teamResult(s.ids, winners(s));
}

// ------------------------------------------------ robots
const VAGUE = ["pratique", "classique", "souvent", "partout", "populaire", "agréable", "connu", "utile", "courant", "normal"];
const has = (list, w) => list.some((x) => L.norm(x) === L.norm(w));
const partnerOf = (w) => { const p = PAIRS.find((x) => x[0] === w || x[1] === w); return p ? (p[0] === w ? p[1] : p[0]) : null; };
// mots du dictionnaire qui collent le mieux aux indices donnés
function bestWords(s, pid) {
  const given = s.clues.filter((c) => c.p !== pid && c.w).map((c) => L.norm(c.w));
  if (!given.length) return [];
  const sc = [];
  for (const w of Object.keys(ASSOC)) {
    const a = ASSOC[w].map(L.norm);
    const n = given.filter((g) => a.includes(g) || g === L.norm(w)).length;
    if (n) sc.push([w, n]);
  }
  return sc.sort((x, y) => y[1] - x[1]);
}
// le robot comprend-il qu'il est l'intrus ? (les indices des autres collent mieux au mot voisin)
function feelsImpostor(s, pid) {
  const mine = wordOf(s, pid), other = partnerOf(mine);
  if (!mine || !other) return false;
  let a = 0, b = 0;
  for (const c of s.clues) if (c.p !== pid && c.w) { if (has(ASSOC[mine], c.w)) a++; if (has(ASSOC[other], c.w)) b++; }
  return b >= a + 2;
}
function clueFor(s, pid, r) {
  let w = wordOf(s, pid);
  if (!w) {
    const best = bestWords(s, pid);
    w = best.length ? best[0][0] : null;
    if (!w) return vague(s, pid, r);
  } else if (s.level >= 2 && feelsImpostor(s, pid) && r.next() < 0.7) {
    // l'intrus qui a compris imite les indices des civils
    const shared = ASSOC[w].filter((x) => has(ASSOC[partnerOf(w)], x));
    const pool = (shared.length ? shared : ASSOC[partnerOf(w)]).filter((x) => !clueError(s, pid, x));
    if (pool.length) return r.pick(pool);
  }
  for (const list of [ASSOC[w], related(w)]) {
    const ok = list.filter((x) => !clueError(s, pid, x));
    const simple = ok.filter((x) => !x.includes("-"));
    const pool = simple.length ? simple : ok;
    if (pool.length) return r.pick(pool);
  }
  return vague(s, pid, r);
}
// indices de second rang : mots dont la liste cite ce mot, et associations des indices qui sont eux-mêmes des mots connus
const relCache = {};
export function related(w) {
  if (relCache[w]) return relCache[w];
  const nw = L.norm(w), out = new Set();
  for (const [k, list] of Object.entries(ASSOC)) if (k !== w && list.some((x) => L.norm(x) === nw)) out.add(k);
  for (const a of ASSOC[w] || []) {
    const key = Object.keys(ASSOC).find((k) => L.norm(k) === L.norm(a));
    if (key) for (const x of ASSOC[key]) out.add(x);
  }
  for (const x of ASSOC[w] || []) out.delete(x);
  return (relCache[w] = [...out].filter((x) => !x.includes(" ")));
}
function vague(s, pid, r) { const v = VAGUE.filter((x) => !clueError(s, pid, x)); return v.length ? r.pick(v) : null; }
export function suspicion(s, pid) {
  const mine = wordOf(s, pid);
  const other = mine ? partnerOf(mine) : null;
  const best = !mine ? bestWords(s, pid) : [];
  const ref = mine || (best.length ? best[0][0] : null);
  const iAmIntrus = mine && feelsImpostor(s, pid) && s.level >= 2;
  return alive(s).filter((id) => id !== pid).map((id) => {
    let w = 1;
    for (const c of s.clues.filter((x) => x.p === id)) {
      if (!c.w) { w += 0.5; continue; }
      const inMine = ref && has(ASSOC[ref], c.w), inOther = other && has(ASSOC[other], c.w);
      if (inMine && !inOther) w -= 0.4;
      else if (inOther && !inMine) w += 1.6;
      else if (!inMine && !inOther) w += 0.4;
    }
    w = Math.max(0.15, w);
    if (iAmIntrus) w = 1 / w; // l'intrus qui a compris vise les civils les plus sûrs d'eux
    return [id, w];
  });
}
export function bot(s, pid, r) {
  switch (s.phase) {
    case "role": return { type: "ready" };
    case "clue": { const w = clueFor(s, pid, r); return w ? { type: "clue", word: w } : { type: "clue", pass: true }; }
    case "vote": return { type: "vote", target: L.weightedPick(r, L.sharpen(suspicion(s, pid), s.level)) };
    case "guess": {
      const best = bestWords(s, pid);
      const pool = best.slice(0, s.level === 3 ? 1 : 3).map((x) => x[0]);
      return { type: "guess", word: pool.length ? r.pick(pool) : r.pick(Object.keys(ASSOC)) };
    }
  }
  return null;
}
export function auto(s, pid, r) {
  if (s.phase === "clue") return { type: "clue", pass: true };
  if (s.phase === "guess") return { type: "guess", word: "" };
  return bot(s, pid, r);
}
export function botDelay(s, pid, r) {
  return (s.phase === "clue" ? 2800 : s.phase === "vote" ? 2200 : 1400) * (0.6 + r.next() * 0.9);
}
