// Briques communes aux jeux de rôles cachés (Loup-garou, Imposteur, Espion) :
// réglages, votes simultanés, petit fil de discussion, chronomètre de phase,
// robots qui complètent la table et classement par camp. Aucun DOM ici.
import { fail, rankByScore } from "../../engine.js";

// ------------------------------------------------ réglages
// valeur d'un réglage, ou le défaut si absente ou invalide
export function optVal(options, settings, key) {
  const o = options.find((x) => x.key === key);
  const v = settings ? settings[key] : undefined;
  const hit = o.values.find((x) => x[0] === v || (v != null && String(x[0]) === String(v)));
  return hit ? hit[0] : o.def;
}
export const levelOf = (settings) => ([1, 2, 3].includes(Number(settings && settings.level)) ? Number(settings.level) : 2);

// ------------------------------------------------ textes
export const norm = (w) => String(w || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/œ/g, "oe").replace(/æ/g, "ae").replace(/[^a-z0-9]+/g, " ").trim();
// texte court et propre : pas de caractères de contrôle, espaces resserrés
export function clean(text, max = 80) {
  return String(text == null ? "" : text).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

// ------------------------------------------------ fil de discussion
// s.chat : [{ n, f, t, k }] (n numéro, f auteur ou "" pour le narrateur, t texte, k type)
// types : "say" message, "sys" narrateur, autres valeurs libres pour chaque jeu
export const MAX_MSGS = 30;
export function post(s, from, text, kind = "say", extra) {
  if (!s.chat) s.chat = [];
  s.chatNo = (s.chatNo || 0) + 1;
  const m = { n: s.chatNo, f: from || "", t: clean(text, 140), k: kind };
  if (extra) Object.assign(m, extra);
  s.chat.push(m);
  if (s.chat.length > MAX_MSGS) s.chat.splice(0, s.chat.length - MAX_MSGS);
  return m;
}
export const narrate = (s, text) => post(s, "", text, "sys");
// message d'un joueur, limité en longueur et en nombre par phase (le fil reste lisible)
export function say(s, pid, text, { max = 80, perPhase = 4, kind = "say", extra } = {}) {
  const t = clean(text, max);
  if (!t) fail("Écris un message");
  if (!s.talk) s.talk = {};
  if ((s.talk[pid] || 0) >= perPhase) fail("Tu as assez parlé pour cette phase");
  s.talk[pid] = (s.talk[pid] || 0) + 1;
  return post(s, pid, t, kind, extra);
}
export const talkLeft = (s, pid, perPhase = 4) => Math.max(0, perPhase - ((s.talk && s.talk[pid]) || 0));
export const resetTalk = (s) => { s.talk = {}; };

// ------------------------------------------------ votes simultanés
// s.vote = { k, voters, targets, b: { votant: cible }, skip }
// cible "" = « personne » quand skip est permis
export function openVote(s, kind, voters, targets, { skip = false } = {}) {
  s.vote = { k: kind, voters: voters.slice(), targets: targets.slice(), b: {}, skip };
  return s.vote;
}
export function castVote(s, pid, target) {
  const v = s.vote;
  if (!v) fail("Aucun vote en cours");
  if (!v.voters.includes(pid)) fail("Tu ne votes pas maintenant");
  const t = target == null ? "" : String(target);
  if (t === "" ? !v.skip : !v.targets.includes(t)) fail("Choix impossible");
  v.b[pid] = t;
  return v;
}
export const votePending = (s) => (s.vote ? s.vote.voters.filter((id) => !(id in s.vote.b)) : []);
// décompte : la cible seule en tête gagne, sinon égalité (winner = null)
export function tally(ballots, { skipWins = true } = {}) {
  const counts = {};
  let skip = 0;
  for (const t of Object.values(ballots)) { if (t === "") skip++; else counts[t] = (counts[t] || 0) + 1; }
  const best = Math.max(0, ...Object.values(counts));
  const top = Object.keys(counts).filter((k) => counts[k] === best);
  const winner = best > 0 && top.length === 1 && (!skipWins || best > skip) ? top[0] : null;
  return { counts, top: best > 0 ? top : [], skip, winner };
}
export function closeVote(s) {
  const v = s.vote;
  const t = tally(v.b);
  s.vote = null;
  return { k: v.k, b: v.b, ...t };
}

// ------------------------------------------------ chronomètre de phase
// le moteur pose s._dl (fin du délai) ; total = délai de la partie en secondes
export const phaseTotal = (settings, meta) => (settings && settings.turnTime != null ? Number(settings.turnTime) : meta.turnTime || 0);
export function timeLeft(end, now) { return end ? Math.max(0, end - now) : null; }

// ------------------------------------------------ robots
export function weightedPick(r, entries) {
  const list = entries.filter((e) => e[1] > 0);
  if (!list.length) return entries.length ? entries[r.int(entries.length)][0] : null;
  let tot = 0;
  for (const e of list) tot += e[1];
  let x = r.next() * tot;
  for (const e of list) { x -= e[1]; if (x <= 0) return e[0]; }
  return list[list.length - 1][0];
}
// renforce l'écart des poids selon le niveau (facile : presque au hasard ; fort : va au plus suspect)
export const sharpen = (entries, level) => entries.map(([id, w]) => [id, Math.pow(Math.max(0.01, w), level === 1 ? 0.4 : level === 3 ? 2.2 : 1.2)]);
export const fillTemplate = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : ""));
// ids dont le nom est cité dans un texte
export function mentions(text, names) {
  const t = " " + norm(text) + " ";
  return Object.keys(names).filter((id) => { const n = norm(names[id]); return n.length >= 2 && t.includes(" " + n + " "); });
}

// robots ajoutés par le jeu pour atteindre le minimum (joués directement par la logique)
const NPC_NAMES = ["Gaspard", "Mila", "Hector", "Rose", "Basile", "Anouk", "Léon", "Iris"];
export function fillPlayers(players, min) {
  const out = players.map((p) => ({ id: p.id, name: p.name, bot: !!p.bot }));
  const used = new Set(out.map((p) => p.name));
  let k = 1;
  while (out.length < min) {
    const name = NPC_NAMES.find((n) => !used.has(n)) || "Robot " + k;
    used.add(name);
    out.push({ id: "npc" + k++, name, bot: true, npc: true });
  }
  return out;
}

// résultat par camp : les gagnants classés 1ers ensemble, déclarés en équipe (victoire, pas égalité)
export function teamResult(ids, winners) {
  const win = ids.filter((id) => winners.includes(id)), lose = ids.filter((id) => !winners.includes(id));
  return { ranking: rankByScore(ids.map((id) => ({ id, score: winners.includes(id) ? 1 : 0 }))), teams: [win, lose].filter((t) => t.length) };
}
