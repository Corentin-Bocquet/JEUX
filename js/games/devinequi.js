import { fail, rankByScore, rng as mkRng } from "../engine.js";
import { PERSOS, QUESTIONS } from "../data/devinequi_persos.js";

export const meta = {
  id: "devinequi", name: "Devine qui", cat: "Quiz", min: 2, max: 2, turnTime: 60,
  color: "#3B82F6", desc: "Trouve le personnage secret de ton adversaire en posant les bonnes questions.",
  rules: ["Chacun reçoit un personnage secret. Le but : deviner celui de l'autre avant lui.",
    "À ton tour, pose UNE question (cheveux, yeux, lunettes, chapeau…) : le jeu répond oui ou non à la place de ton adversaire, sans tricher.",
    "Abats ensuite les personnages qui ne correspondent plus (ou laisse l'aide automatique le faire si l'option est active).",
    "Quand tu penses savoir, tente une réponse à la place d'une question. Bonne réponse : tu gagnes la manche.",
    "Mauvaise réponse : selon l'option, tu perds la manche ou seulement ton tour.",
    "Options : aide automatique, nombre de personnages, manches gagnantes, sanction d'une erreur."],
};

export const options = [
  { key: "help", label: "Aide auto", icon: "🪄", values: [[false, "Non", "Tu abats toi-même"], [true, "Oui", "Abat pour toi"]], def: false },
  { key: "size", label: "Personnages", icon: "🧑", values: [[24, "24", "Classique"], [16, "16", "Partie courte"]], def: 24 },
  { key: "wins", label: "Manches", icon: "🏆", values: [[1, "1", "Partie simple"], [2, "2", "Match en 3"], [3, "3", "Match en 5"]], def: 1 },
  { key: "miss", label: "Erreur", icon: "❌", values: [["perdu", "Défaite", "Manche perdue"], ["tour", "Tour perdu", "On continue"]], def: "perdu" },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "🕵️", desc: "24 personnages, tu abats toi-même, une erreur et c'est perdu.", set: { help: false, size: 24, wins: 1, miss: "perdu" } },
  { id: "aide", name: "Aide auto", emoji: "🪄", desc: "Le jeu abat les personnages pour toi : idéal pour débuter.", set: { help: true, size: 24, wins: 1, miss: "perdu" } },
  { id: "rapide", name: "Rapide", emoji: "⚡", desc: "16 personnages, aide auto, une erreur fait seulement perdre le tour.", set: { help: true, size: 16, wins: 1, miss: "tour" } },
  { id: "match", name: "Match", emoji: "🏆", desc: "Le premier à 2 manches gagnées remporte le match.", set: { help: false, size: 24, wins: 2, miss: "perdu" } },
];

export function opt(settings, key) {
  const o = options.find((x) => x.key === key);
  const v = settings ? settings[key] : undefined;
  const hit = o.values.find((x) => x[0] === v || (v != null && String(x[0]) === String(v)));
  return hit ? hit[0] : o.def;
}

export const qById = (id) => QUESTIONS.find((q) => q[0] === id);
export const answer = (persoIdx, qid) => !!qById(qid)[3](PERSOS[persoIdx]);

export function setup(players, settings, rng) {
  const order = rng.next() < 0.5 ? [players[0].id, players[1].id] : [players[1].id, players[0].id];
  const s = { order, help: opt(settings, "help"), size: opt(settings, "size"), wins: opt(settings, "wins"), miss: opt(settings, "miss"),
    level: settings.level || 2, score: { [order[0]]: 0, [order[1]]: 0 }, game: 0 };
  newRound(s, rng);
  return s;
}

function newRound(s, r) {
  s.game++;
  const all = PERSOS.map((_, i) => i);
  s.board = s.size >= 24 ? all : r.shuffle(all).slice(0, s.size).sort((a, b) => a - b);
  const pick = r.shuffle(s.board.map((_, i) => i));
  s.secret = { [s.order[0]]: s.board[pick[0]], [s.order[1]]: s.board[pick[1]] };
  s.down = { [s.order[0]]: s.board.map(() => 0), [s.order[1]]: s.board.map(() => 0) };
  s.turn = (s.game - 1) % 2;      // on alterne qui commence
  s.phase = "ask";
  s.log = [];
  s.win = null;
  s.turns = 0;
}

const other = (s, pid) => (pid === s.order[0] ? s.order[1] : s.order[0]);
const matchOver = (s) => s.order.some((id) => s.score[id] >= s.wins);

export function toAct(s) {
  if (s.phase === "end") return matchOver(s) ? [] : [s.order[s.game % 2]];
  return [s.order[s.turn]];
}

// personnages encore possibles d'après les questions posées par pid
export function candidates(s, pid) {
  return s.board.map((_, i) => i).filter((i) => s.log.every((e) => e.by !== pid || (e.q ? answer(s.board[i], e.q) === e.a : (e.pos === i ? e.a : true))));
}

function autoDown(s, pid) {
  const keep = new Set(candidates(s, pid));
  s.down[pid] = s.board.map((_, i) => (keep.has(i) ? 0 : 1));
}

function endTurn(s) { s.turn = 1 - s.turn; s.phase = "ask"; s.turns++; }

function winRound(s, pid, how) {
  s.win = { id: pid, how };
  s.score[pid]++;
  s.phase = "end";
}

export function reduce(s, pid, a) {
  if (!toAct(s).includes(pid)) fail("Ce n'est pas ton tour");
  if (s.phase === "end") {
    if (a.type !== "next") fail("Lance la manche suivante");
    newRound(s, mkRng(a.seed || 1));
    return s;
  }
  const opp = other(s, pid);
  if (a.type === "ask") {
    if (s.phase !== "ask") fail("Tu as déjà posé ta question");
    if (!qById(a.q)) fail("Question inconnue");
    const ans = answer(s.secret[opp], a.q);
    s.log.push({ by: pid, q: a.q, a: ans });
    if (s.log.length > 60) s.log.shift();
    if (s.help) { autoDown(s, pid); endTurn(s); } else s.phase = "flip";
    return s;
  }
  if (a.type === "done") {
    if (s.phase !== "flip") fail("Pose d'abord ta question");
    if (Array.isArray(a.down)) {
      if (a.down.length !== s.board.length) fail("Plateau invalide");
      s.down[pid] = a.down.map((x) => (x ? 1 : 0));
    }
    endTurn(s);
    return s;
  }
  if (a.type === "guess") {
    if (s.phase !== "ask") fail("Termine ton tour d'abord");
    const pos = a.pos | 0;
    if (pos < 0 || pos >= s.board.length) fail("Personnage invalide");
    const ok = s.board[pos] === s.secret[opp];
    s.log.push({ by: pid, pos, a: ok });
    if (ok) winRound(s, pid, "trouvé");
    else if (s.miss === "perdu") winRound(s, opp, "erreur");
    else { s.down[pid][pos] = 1; endTurn(s); }
    return s;
  }
  fail("Action inconnue");
}

export function result(s) {
  if (s.phase !== "end" || !matchOver(s)) return null;
  return { ranking: rankByScore(s.order.map((id) => ({ id, score: s.score[id] }))) };
}

// ------------------------------------------------ robot : la question qui coupe le mieux en deux
export function bestQuestions(s, cands) {
  const scored = QUESTIONS.map(([id]) => {
    const yes = cands.filter((i) => answer(s.board[i], id)).length;
    return { id, yes, gap: Math.abs(cands.length - 2 * yes) };
  }).filter((x) => x.yes > 0 && x.yes < cands.length);
  return scored.sort((a, b) => a.gap - b.gap);
}

export function bot(s, pid, rng) {
  if (s.phase === "end") return { type: "next" };
  const lvl = s.level || 2;
  const cands = candidates(s, pid);
  if (s.phase === "flip") {
    const keep = new Set(cands);
    // le robot facile oublie parfois d'abattre (sans effet sur son raisonnement)
    return { type: "done", down: s.board.map((_, i) => (keep.has(i) || (lvl === 1 && rng.next() < 0.2 && s.down[pid][i] === 0) ? 0 : 1)) };
  }
  if (cands.length === 1) return { type: "guess", pos: cands[0] };
  // le robot facile tente sa chance trop tôt
  if (lvl === 1 && cands.length <= 3 && rng.next() < 0.4) return { type: "guess", pos: rng.pick(cands) };
  const qs = bestQuestions(s, cands);
  if (!qs.length) return { type: "guess", pos: rng.pick(cands) };
  let q;
  if (lvl >= 3) q = rng.pick(qs.filter((x) => x.gap === qs[0].gap));
  else if (lvl === 2) q = rng.next() < 0.6 ? qs[0] : rng.pick(qs.slice(0, 3));
  else q = rng.pick(qs);
  return { type: "ask", q: q.id };
}

export function auto(s, pid, rng) {
  if (s.phase === "end") return { type: "next" };
  if (s.phase === "flip") { const keep = new Set(candidates(s, pid)); return { type: "done", down: s.board.map((_, i) => (keep.has(i) ? 0 : 1)) }; }
  const cands = candidates(s, pid);
  if (cands.length === 1) return { type: "guess", pos: cands[0] };
  const qs = bestQuestions(s, cands);
  return qs.length ? { type: "ask", q: qs[0].id } : { type: "guess", pos: cands[0] };
}
export function botDelay(s, pid, rng) { return (s.phase === "flip" ? 900 : 1600) + rng.next() * 1200; }
export { PERSOS, QUESTIONS };
