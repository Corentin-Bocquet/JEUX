// Espion : tout le monde connaît le lieu sauf l'espion. Questions et réponses
// courtes à tour de rôle, accusation à tout moment, vote final à la fin du temps.
import { fail, rng as mkRng } from "../engine.js";
import * as L from "./lib/roles.js";
import { PLACES, QUESTIONS, VAGUE } from "../data/espion_lieux.js";

export const meta = {
  id: "espion", name: "Espion", cat: "Soirée", min: 3, max: 8, turnTime: 45,
  color: "#0F766E", desc: "Tous connaissent le lieu, sauf l'espion. Démasque-le avant qu'il ne devine !",
  rules: [
    "Chacun reçoit en secret le lieu et un rôle. L'espion, lui, ne connaît pas le lieu.",
    "À ton tour, choisis un joueur et pose-lui une question courte. Il répond, puis c'est à lui d'interroger.",
    "À tout moment, tu peux accuser quelqu'un (une fois par partie) : si tous les autres votent oui, son rôle est révélé.",
    "L'espion peut à tout moment révéler qui il est et deviner le lieu dans la liste : juste, il gagne ; faux, il perd.",
    "À la fin du temps, tout le monde vote. Si l'espion est désigné, les agents gagnent (option : il a une dernière chance de deviner le lieu).",
  ],
};

export const options = [
  { key: "duree", label: "Durée", icon: "⏱", values: [[4, "4 min", "Express"], [6, "6 min", "Standard"], [8, "8 min", "Long"]], def: 6 },
  { key: "espions", label: "Espions", icon: "🕶️", values: [[1, "1"], [2, "2", "Dès 6 joueurs"]], def: 1 },
  { key: "chance", label: "Dernier mot", icon: "🎯", values: [[true, "Oui", "L'espion devine"], [false, "Non", "Démasqué = perdu"]], def: true },
  { key: "lieux", label: "Liste", icon: "🗺️", values: [[40, "40 lieux"], [20, "20 lieux", "Espion avantagé"]], def: 40 },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "🕶️", desc: "6 minutes, un espion, 40 lieux possibles.", set: { duree: 6, espions: 1, chance: true, lieux: 40 } },
  { id: "express", name: "Express", emoji: "⚡", desc: "4 minutes et une liste réduite à 20 lieux.", set: { duree: 4, espions: 1, chance: true, lieux: 20 } },
  { id: "duo", name: "Deux espions", emoji: "👥", desc: "Deux espions qui ne se connaissent pas (dès 6 joueurs).", set: { duree: 8, espions: 2, chance: true, lieux: 40 } },
  { id: "sansfilet", name: "Sans filet", emoji: "🎯", desc: "Espion démasqué = espion perdu, 8 minutes.", set: { duree: 8, espions: 1, chance: false, lieux: 40 } },
];
const opt = (settings, key) => L.optVal(options, settings, key);

export const isSpy = (s, id) => s.spies.includes(id);
export const placeOf = (s) => PLACES[s.place];
export const active = (s) => s.ids.filter((id) => !s.out.includes(id));
const nameIn = (s, id) => s.names[id] || "?";

export function setup(players, settings, r) {
  const n = players.length;
  const ids = players.map((p) => p.id);
  const nSpy = opt(settings, "espions") === 2 && n >= 6 ? 2 : 1;
  const spies = r.shuffle(ids).slice(0, nSpy);
  const place = r.int(PLACES.length);
  const size = opt(settings, "lieux");
  const others = r.shuffle(PLACES.map((_, i) => i).filter((i) => i !== place)).slice(0, size - 1);
  const list = [...others, place].sort((a, b) => PLACES[a].name.localeCompare(PLACES[b].name, "fr"));
  const roles = {};
  const pool = r.shuffle(PLACES[place].roles);
  ids.filter((id) => !spies.includes(id)).forEach((id, i) => (roles[id] = pool[i % pool.length]));
  const s = {
    ids, names: Object.fromEntries(players.map((p) => [p.id, p.name])), spies, place, list, roles,
    phase: "role", ready: {}, asker: r.pick(ids), target: null, prev: null, qn: 0, endsAt: 0,
    duree: opt(settings, "duree"), chance: opt(settings, "chance"), level: L.levelOf(settings),
    accUsed: {}, accused: null, resume: null, out: [], vote: null, guesser: null,
    winner: null, news: [], ans: [], chat: [], chatNo: 0, talk: {},
  };
  L.narrate(s, "Retourne ta carte en secret : lieu et rôle… ou espion !");
  return s;
}

export function toAct(s) {
  if (s.winner) return [];
  switch (s.phase) {
    case "role": return s.ids.filter((id) => !s.ready[id]);
    case "ask": return [s.asker];
    case "answer": return [s.target];
    case "accuse": case "final": return L.votePending(s);
    case "last": return [s.guesser];
  }
  return [];
}

function note(s, t) { s.news.push(t); L.narrate(s, t); }
function end(s, winner, why) {
  s.winner = winner; s.phase = "end"; s.vote = null;
  note(s, why + ` Le lieu était : ${placeOf(s).name} ${placeOf(s).emoji}.`);
}
export function winners(s) { return s.winner ? s.ids.filter((id) => (s.winner === "espion") === isSpy(s, id)) : []; }

function toFinal(s) {
  s.phase = "final"; s.news = [];
  const act = active(s);
  L.openVote(s, "final", act, act);
  note(s, "⏰ Temps écoulé ! Votez tous pour désigner l'espion.");
}
const timeUp = (s, now) => s.endsAt && now >= s.endsAt;

function reveal(s, id) {
  // un joueur démasqué par le groupe
  if (!isSpy(s, id)) return end(s, "espion", `😱 ${nameIn(s, id)} n'était pas l'espion (${s.roles[id]}) : l'espion gagne !`);
  s.out.push(id);
  note(s, `🕶️ Bien vu : ${nameIn(s, id)} était un espion !`);
  if (s.chance) { s.phase = "last"; s.guesser = id; return; }
  afterCatch(s);
}
function afterCatch(s) {
  if (s.spies.every((id) => s.out.includes(id))) return end(s, "agents", "🎉 Tous les espions sont démasqués : les agents gagnent !");
  resume(s);
}
function resume(s) {
  const r = s.resume || { phase: "ask", asker: active(s)[0] };
  s.resume = null;
  s.phase = r.phase; s.asker = r.asker; s.target = r.target || null;
  if (s.out.includes(s.asker) || (s.target && s.out.includes(s.target))) { s.phase = "ask"; s.asker = active(s).find((id) => !s.out.includes(id)); s.target = null; }
}

function act(s, pid, a, r) {
  const now = a.now || 0;
  switch (a.type) {
    case "ready":
      if (s.phase !== "role") fail("Pas maintenant");
      s.ready[pid] = 1;
      if (!toAct(s).length) {
        s.phase = "ask"; s.endsAt = now + s.duree * 60000;
        note(s, `🔎 L'enquête commence : ${nameIn(s, s.asker)} pose la première question.`);
      }
      return;
    case "ask": {
      if (s.phase !== "ask" || s.asker !== pid) fail("Ce n'est pas ton tour");
      const t = String(a.target || "");
      if (t === pid || !active(s).includes(t)) fail("Choisis un autre joueur");
      if (t === s.prev && active(s).length > 2) fail("Tu ne peux pas interroger celui qui vient de te questionner");
      const q = L.clean(a.text, 90);
      if (!q) fail("Écris ta question");
      s.target = t; s.phase = "answer"; s.qn++; L.resetTalk(s);
      L.post(s, pid, q, "q", { to: t });
      return;
    }
    case "answer": {
      if (s.phase !== "answer" || s.target !== pid) fail("Ce n'est pas à toi de répondre");
      const t = L.clean(a.text, 90);
      if (!t) fail("Écris ta réponse");
      L.post(s, pid, t, "a");
      s.ans.push([pid, t]);
      if (s.ans.length > 30) s.ans.splice(0, s.ans.length - 30);
      s.prev = s.asker; s.asker = pid; s.target = null; s.phase = "ask";
      if (timeUp(s, now)) toFinal(s);
      return;
    }
    case "timeup":
      if (!["ask", "answer"].includes(s.phase) || !timeUp(s, now)) fail("Pas encore");
      return toFinal(s);
    case "accuse": {
      if (!["ask", "answer"].includes(s.phase)) fail("Pas maintenant");
      if (s.out.includes(pid)) fail("Tu as été démasqué");
      if (s.accUsed[pid]) fail("Tu as déjà accusé quelqu'un");
      const t = String(a.target || "");
      if (t === pid || !active(s).includes(t)) fail("Accuse un autre joueur");
      s.accUsed[pid] = 1;
      s.resume = { phase: s.phase, asker: s.asker, target: s.target };
      s.accused = { by: pid, id: t };
      s.phase = "accuse"; s.news = [];
      L.openVote(s, "acc", active(s).filter((id) => id !== t), ["oui", "non"]);
      L.castVote(s, pid, "oui");
      note(s, `☝️ ${nameIn(s, pid)} accuse ${nameIn(s, t)} d'être l'espion ! Tout le monde doit voter oui pour le démasquer.`);
      return closeIfDone(s, r);
    }
    case "vote": {
      if (s.phase !== "accuse" && s.phase !== "final") fail("Pas de vote en cours");
      if (s.phase === "final" && a.target === pid) fail("Tu ne peux pas voter contre toi");
      L.castVote(s, pid, a.target);
      return closeIfDone(s, r);
    }
    case "guess": {
      const idx = Number(a.place);
      if (!s.list.includes(idx)) fail("Choisis un lieu de la liste");
      if (s.phase === "last") {
        if (s.guesser !== pid) fail("Ce n'est pas à toi");
      } else {
        if (!["ask", "answer"].includes(s.phase)) fail("Pas maintenant");
        if (!isSpy(s, pid) || s.out.includes(pid)) fail("Seul l'espion peut deviner le lieu");
      }
      s.guess = { id: pid, place: idx };
      if (idx === s.place) return end(s, "espion", `🕶️ ${nameIn(s, pid)} était l'espion et devine le lieu : ${PLACES[idx].name} ! L'espion gagne.`);
      if (s.phase === "last") { note(s, `${nameIn(s, pid)} propose ${PLACES[idx].name}… raté !`); s.guesser = null; return s.final ? end(s, "agents", "🎉 L'espion est démasqué : les agents gagnent !") : afterCatch(s); }
      return end(s, "agents", `🕶️ ${nameIn(s, pid)} était l'espion mais se trompe de lieu (${PLACES[idx].name}) : les agents gagnent !`);
    }
  }
  fail("Action inconnue");
}

function closeIfDone(s, r) {
  if (L.votePending(s).length) return;
  if (s.phase === "accuse") {
    const v = s.vote, id = s.accused.id;
    const yes = Object.values(v.b).filter((x) => x === "oui").length;
    L.closeVote(s);
    s.accused = null;
    if (yes === v.voters.length) return reveal(s, id);
    note(s, `Pas d'unanimité (${yes} oui sur ${v.voters.length}) : ${nameIn(s, id)} reste dans la partie.`);
    return resume(s);
  }
  // vote final
  const res = L.closeVote(s);
  s.lastVote = res.b;
  void r;
  if (!res.winner) return end(s, "espion", "🤷 Pas de majorité au vote final : l'espion s'en sort !");
  if (!isSpy(s, res.winner)) return end(s, "espion", `😱 Le groupe désigne ${nameIn(s, res.winner)}, qui n'était pas l'espion !`);
  s.final = true;
  s.out.push(res.winner);
  note(s, `🕶️ Le groupe désigne ${nameIn(s, res.winner)} : c'est bien un espion !`);
  if (s.chance) { s.phase = "last"; s.guesser = res.winner; return; }
  return end(s, "agents", "🎉 L'espion est démasqué : les agents gagnent !");
}

export function reduce(s, pid, a) {
  if (s.winner) fail("La partie est terminée");
  if (!s.ids.includes(pid)) fail("Tu ne joues pas à cette partie");
  const r = mkRng(a.seed || 1);
  if (a.type === "say") {
    if (!["ask", "answer", "accuse", "final"].includes(s.phase)) fail("Pas maintenant");
    L.say(s, pid, a.text, { perPhase: 2 });
    return s;
  }
  // accusation, révélation de l'espion et fin du temps : à tout moment, pas seulement à son tour
  if (["accuse", "guess", "timeup"].includes(a.type) && s.phase !== "last") { act(s, pid, a, r); return s; }
  if (!toAct(s).includes(pid)) fail("Ce n'est pas à toi d'agir");
  act(s, pid, a, r);
  return s;
}

export function result(s) {
  if (!s.winner) return null;
  return L.teamResult(s.ids, winners(s));
}

// ------------------------------------------------ robots
const words = (t) => L.norm(t).split(" ").filter((w) => w.length >= 5);
const vagueSet = new Set(VAGUE.map(L.norm));
// à quel point une réponse colle à un lieu
function fit(text, place) {
  const nt = L.norm(text);
  if (place.answers.some((x) => L.norm(x) === nt)) return 2;
  const tw = new Set(words(text));
  let n = 0;
  for (const a of place.answers) for (const w of words(a)) if (tw.has(w)) n++;
  return Math.min(1, n * 0.5);
}
// l'espion robot ne retient qu'une partie des réponses (r fourni) : il peut se tromper
export function placeScores(s, pid, r) {
  const keep = [0.3, 0.45, 0.6][s.level - 1];
  const own = s.ans.filter(([p]) => p !== pid && (!r || r.next() < keep));
  return s.list.map((i) => [i, own.reduce((t, [, txt]) => t + fit(txt, PLACES[i]), 0)]).sort((a, b) => b[1] - a[1]);
}
export function suspicion(s, pid) {
  const place = placeOf(s);
  return active(s).filter((id) => id !== pid).map((id) => {
    let w = 1;
    for (const [p, txt] of s.ans) if (p === id) {
      if (isSpy(s, pid)) continue;
      const f = fit(txt, place);
      w += vagueSet.has(L.norm(txt)) ? 0.9 : f >= 1 ? -0.4 * f : 0.4;
    }
    return [id, Math.max(0.15, w)];
  });
}
function spyConfident(s, pid, r) {
  if (s.ans.length < Math.ceil(active(s).length * 1.5)) return null;
  const sc = placeScores(s, pid, r);
  if (!sc.length || sc[0][1] <= 0) return null;
  const gap = sc[0][1] - (sc[1] ? sc[1][1] : 0);
  return gap >= [7, 5.5, 4.5][s.level - 1] ? sc : null;
}
function answerFor(s, pid, r) {
  if (isSpy(s, pid)) {
    if (s.level === 3) { const sc = placeScores(s, pid); if (sc.length && sc[0][1] >= 3 && r.next() < 0.6) return r.pick(PLACES[sc[0][0]].answers); }
    return r.pick(VAGUE);
  }
  const used = new Set(s.ans.map((x) => L.norm(x[1])));
  const fresh = placeOf(s).answers.filter((x) => !used.has(L.norm(x)));
  if (fresh.length && r.next() < [0.65, 0.85, 0.92][s.level - 1]) return r.pick(fresh);
  return r.pick(VAGUE);
}
export function bot(s, pid, r) {
  switch (s.phase) {
    case "role": return { type: "ready" };
    case "ask": {
      if (isSpy(s, pid)) {
        const sc = spyConfident(s, pid, r);
        // même sûr de lui, l'espion hésite entre les lieux en tête
        if (sc && r.next() < [0.35, 0.5, 0.7][s.level - 1]) return { type: "guess", place: L.weightedPick(r, sc.slice(0, 3).map(([i, v]) => [i, v * v])) };
      }
      else if (!s.accUsed[pid] && s.ans.length >= Math.ceil(active(s).length / 2)) {
        const sus = suspicion(s, pid).sort((a, b) => b[1] - a[1]);
        if (sus.length && sus[0][1] >= [2.2, 1.8, 1.6][s.level - 1] && (!sus[1] || sus[0][1] > sus[1][1])) return { type: "accuse", target: sus[0][0] };
      }
      const pool = suspicion(s, pid).filter(([id]) => id !== s.prev || active(s).length <= 2);
      return { type: "ask", target: L.weightedPick(r, pool), text: r.pick(QUESTIONS) };
    }
    case "answer": return { type: "answer", text: answerFor(s, pid, r) };
    case "accuse": {
      const id = s.accused.id;
      if (isSpy(s, pid)) return { type: "vote", target: "oui" };
      const sus = suspicion(s, pid);
      const mine = (sus.find((x) => x[0] === id) || [id, 1])[1];
      const avg = sus.reduce((t, x) => t + x[1], 0) / Math.max(1, sus.length);
      return { type: "vote", target: mine >= avg || r.next() < 0.3 ? "oui" : "non" };
    }
    case "final": {
      const sus = suspicion(s, pid).filter(([id]) => id !== pid);
      return { type: "vote", target: L.weightedPick(r, L.sharpen(sus, s.level)) };
    }
    case "last": {
      const sc = placeScores(s, pid, r);
      // pris de court, il hésite entre les lieux en tête (plus il est fort, plus il vise juste)
      const pick = L.weightedPick(r, sc.slice(0, 4).map(([i, v]) => [i, Math.pow(v + 0.5, s.level)]));
      return { type: "guess", place: pick != null ? pick : r.pick(s.list) };
    }
  }
  return null;
}
export function auto(s, pid, r) {
  if (s.phase === "ask") { const pool = active(s).filter((id) => id !== pid && (id !== s.prev || active(s).length <= 2)); return { type: "ask", target: r.pick(pool), text: r.pick(QUESTIONS) }; }
  if (s.phase === "answer") return { type: "answer", text: "Euh… je passe mon tour." };
  if (s.phase === "accuse") return { type: "vote", target: "non" };
  return bot(s, pid, r);
}
export function botDelay(s, pid, r) {
  return (s.phase === "ask" || s.phase === "answer" ? 3000 : 1800) * (0.6 + r.next() * 0.9);
}
