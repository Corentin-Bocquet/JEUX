import { fail, rankByScore, rng as mkRng } from "../engine.js";

export const meta = {
  id: "backgammon", name: "Backgammon", cat: "Plateau", min: 2, max: 2, turnTime: 60,
  color: "#A16207", desc: "Fais le tour du plateau et sors tes 15 pions avant l'autre.",
  rules: ["Chacun a 15 pions qui tournent en sens inverse. Lance les deux dés et avance d'autant de flèches que chaque dé.",
    "Un double se joue quatre fois. Tu dois jouer le plus de dés possible ; si un seul passe, prends le plus fort.",
    "Tu ne peux pas te poser sur une flèche tenue par 2 pions adverses. Un pion seul (une « dame découverte ») touché part sur la barre.",
    "Un pion sur la barre doit rentrer dans le jan adverse avant tout autre mouvement.",
    "Quand tes 15 pions sont dans ton jan (les 6 dernières flèches), tu peux les sortir. Le premier qui a tout sorti gagne.",
    "Gammon : l'adversaire n'a sorti aucun pion, 2 points. Backgammon : il lui reste en plus un pion sur la barre ou dans ton jan, 3 points.",
    "Options : videau (cube de doublement, l'autre accepte ou abandonne), match en 3, 5 ou 7 points, départ Nackgammon."],
};

export const options = [
  { key: "cube", label: "Videau", icon: "🎲",
    values: [[false, "Non", "Points simples"], [true, "Oui", "Cube de doublement"]], def: false },
  { key: "match", label: "Match", icon: "🏆",
    values: [[1, "1 partie", "Partie simple"], [3, "3 points", "Match court"], [5, "5 points", "Match moyen"], [7, "7 points", "Match long"]], def: 1 },
  { key: "start", label: "Départ", icon: "🧭",
    values: [["classique", "Classique", "Position standard"], ["nack", "Nackgammon", "Plus de combat"]], def: "classique" },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "🎯", desc: "Une partie, gammon et backgammon comptent double ou triple.", set: { cube: false, match: 1, start: "classique" } },
  { id: "videau", name: "Avec videau", emoji: "🎲", desc: "Une partie avec le cube : double la mise quand tu mènes.", set: { cube: true, match: 1, start: "classique" } },
  { id: "match", name: "Match en 5", emoji: "🏆", desc: "Le premier à 5 points gagne, videau et règle Crawford.", set: { cube: true, match: 5, start: "classique" } },
  { id: "nack", name: "Nackgammon", emoji: "⚔️", desc: "Départ avec 4 pions au fond : parties plus disputées.", set: { cube: false, match: 3, start: "nack" } },
];

const pick = (key, v) => {
  const o = options.find((x) => x.key === key);
  return o.values.some((x) => x[0] === v) ? v : o.def;
};

// ---------------------------------------------------------------- position
// b[p][k] : pions du joueur p (0 = order[0], blancs ; 1 = noirs) sur SA flèche k,
// numérotée dans son sens de marche : 24 = départ, 1 = dernière flèche, 25 = barre, 0 = sortis.
// La flèche k de p est la flèche 25 - k de l'adversaire.
export const BAR = 25, OFF = 0;
const START = {
  classique: { 24: 2, 13: 5, 8: 3, 6: 5 },
  nack: { 24: 2, 23: 2, 13: 4, 8: 3, 6: 4 },
};
export function initialSide(start = "classique") {
  const a = Array(26).fill(0);
  for (const [k, v] of Object.entries(START[start] || START.classique)) a[k] = v;
  return a;
}

const allHome = (me) => { for (let k = 7; k <= 25; k++) if (me[k]) return false; return true; };

// mouvement simple : pion du joueur depuis f avec le dé d (sans vérifier l'ordre des dés)
export function canMove(me, op, f, d) {
  if (f < 1 || f > 25 || !me[f]) return false;
  if (me[BAR] && f !== BAR) return false;
  const t = f - d;
  if (t >= 1) return op[25 - t] < 2;
  if (!allHome(me)) return false;
  if (t === 0) return true;
  for (let k = f + 1; k <= 6; k++) if (me[k]) return false; // dé plus fort : seulement le pion le plus éloigné
  return true;
}
// joue le mouvement (sur place) ; renvoie true si un pion adverse est touché
export function doMove(me, op, f, d) {
  const t = Math.max(0, f - d);
  me[f]--; me[t]++;
  if (t >= 1 && op[25 - t] === 1) { op[25 - t] = 0; op[BAR]++; return true; }
  return false;
}

const uniqDice = (dice) => [...new Set(dice)];
function without(dice, d) { const i = dice.indexOf(d); return dice.slice(0, i).concat(dice.slice(i + 1)); }

// nombre maximal de dés jouables depuis une position (mémoïsé)
function maxDepth(me, op, rest, memo) {
  if (!rest.length) return 0;
  const key = me.join(",") + "|" + op.join(",") + "|" + rest.join("");
  if (memo.has(key)) return memo.get(key);
  let best = 0;
  for (const d of uniqDice(rest)) {
    for (let f = 25; f >= 1 && best < rest.length; f--) {
      if (!canMove(me, op, f, d)) continue;
      const m2 = me.slice(), o2 = op.slice();
      doMove(m2, o2, f, d);
      best = Math.max(best, 1 + maxDepth(m2, o2, without(rest, d), memo));
    }
  }
  memo.set(key, best);
  return best;
}

// toutes les positions finales atteignables en jouant le maximum de dés
// renvoie { max, turns: [{ moves: [{f, d}], me, op }] }
export function allTurns(me, op, dice) {
  const seen = new Map(), visited = new Set();
  let max = 0;
  const rec = (m, o, rest, moves) => {
    const vk = m.join(",") + "|" + o.join(",") + "|" + rest.join("");
    if (visited.has(vk)) return;
    visited.add(vk);
    let any = false;
    for (const d of uniqDice(rest)) {
      for (let f = 25; f >= 1; f--) {
        if (!canMove(m, o, f, d)) continue;
        any = true;
        const m2 = m.slice(), o2 = o.slice();
        doMove(m2, o2, f, d);
        rec(m2, o2, without(rest, d), moves.concat([{ f, d }]));
      }
    }
    if (!any) {
      if (moves.length < max) return;
      if (moves.length > max) { max = moves.length; seen.clear(); }
      const key = m.join(",") + "|" + o.join(",");
      if (!seen.has(key)) seen.set(key, { moves, me: m, op: o });
    }
  };
  rec(me, op, dice, []);
  let turns = [...seen.values()];
  // un seul dé jouable sur deux différents : le plus fort s'il passe
  if (max === 1 && dice.length === 2 && dice[0] !== dice[1]) {
    const hi = Math.max(...dice);
    const hiTurns = [];
    for (let f = 25; f >= 1; f--) {
      if (!canMove(me, op, f, hi)) continue;
      const m2 = me.slice(), o2 = op.slice();
      doMove(m2, o2, f, hi);
      hiTurns.push({ moves: [{ f, d: hi }], me: m2, op: o2 });
    }
    if (hiTurns.length) turns = hiTurns;
  }
  return { max, turns };
}

// premiers mouvements autorisés depuis la position en cours
export function legalFirst(me, op, dice) {
  const memo = new Map();
  const max = maxDepth(me, op, dice, memo);
  if (!max) return [];
  let out = [];
  for (const d of uniqDice(dice)) {
    for (let f = 25; f >= 1; f--) {
      if (!canMove(me, op, f, d)) continue;
      const m2 = me.slice(), o2 = op.slice();
      doMove(m2, o2, f, d);
      if (1 + maxDepth(m2, o2, without(dice, d), memo) === max) out.push({ f, d });
    }
  }
  if (max === 1 && dice.length === 2 && dice[0] !== dice[1]) {
    const hi = Math.max(...dice);
    if (out.some((m) => m.d === hi)) out = out.filter((m) => m.d === hi);
  }
  return out;
}
export const maxUsable = (me, op, dice) => maxDepth(me, op, dice, new Map());

export const pips = (me) => { let n = 0; for (let k = 1; k <= 25; k++) n += me[k] * k; return n; };
export const remainingDice = (s) => {
  let rest = s.dice.slice();
  for (const m of s.played) rest = without(rest, m.d);
  return rest;
};
// coups possibles maintenant pour le joueur au trait
export function movesNow(s) {
  if (s.phase !== "move") return [];
  return legalFirst(s.b[s.side], s.b[1 - s.side], remainingDice(s));
}
export const turnComplete = (s) => s.phase === "move" && s.played.length >= s.need;

// ---------------------------------------------------------------- partie
export function setup(players, settings, rng) {
  const order = rng.shuffle(players.slice(0, 2).map((p) => p.id));
  // jeu à deux : d'éventuels joueurs en trop regardent la partie (classés derniers)
  const extra = players.slice(2).map((p) => p.id);
  const s = { order, extra, cube: pick("cube", settings.cube), match: pick("match", settings.match), start: pick("start", settings.start),
    score: { [order[0]]: 0, [order[1]]: 0 }, game: 0, crawford: false, crawUsed: false, level: settings.level || 2,
    b: null, side: 0, phase: "roll", dice: [], played: [], need: 0, t0: null, cubeVal: 1, owner: -1,
    rollN: 0, opening: null, note: null, last: [], lastSide: -1, end: null };
  newGame(s, rng);
  return s;
}

// nouvelle partie : lancer d'ouverture, le plus fort commence avec ces deux dés
function newGame(s, r) {
  s.game++;
  s.b = [initialSide(s.start), initialSide(s.start)];
  s.cubeVal = 1; s.owner = -1; s.end = null; s.note = null; s.last = []; s.lastSide = -1;
  const m = s.match;
  // règle Crawford : la partie qui suit l'arrivée d'un joueur à 1 point du but se joue sans videau
  s.crawford = false;
  if (m > 1 && !s.crawUsed && s.order.some((id) => s.score[id] === m - 1)) { s.crawford = true; s.crawUsed = true; }
  let a, c;
  do { a = 1 + r.int(6); c = 1 + r.int(6); } while (a === c);
  s.opening = [a, c];
  s.side = a > c ? 0 : 1;
  startMoves(s, [Math.max(a, c), Math.min(a, c)]);
}

function startMoves(s, dice) {
  s.dice = dice;
  s.played = [];
  s.rollN++;
  const me = s.b[s.side], op = s.b[1 - s.side];
  s.need = maxUsable(me, op, dice);
  s.t0 = [me.slice(), op.slice()];
  if (s.need === 0) {
    // aucun coup possible : le tour passe tout seul
    s.note = { who: s.order[s.side], txt: "bloque" };
    s.last = []; s.lastSide = s.side;
    s.side = 1 - s.side;
    s.phase = "roll";
    s.dice = dice; // on garde les dés visibles pour comprendre
    s.played = [];
    s.need = 0;
  } else s.phase = "move";
}

export const canDouble = (s) => s.cube && !s.crawford && s.phase === "roll" && (s.owner === -1 || s.owner === s.side) && s.cubeVal < 64;
const matchOver = (s) => s.phase === "over";

export function toAct(s) {
  if (s.phase === "over") return [];
  if (s.phase === "end") return [s.order[1 - s.end.side]]; // le perdant lance la suivante
  if (s.phase === "cube") return [s.order[1 - s.side]];
  return [s.order[s.side]];
}

// fin d'une partie gagnée par `side`
function finishGame(s, side, kind) {
  const op = s.b[1 - side];
  let mult = 1;
  if (kind !== "abandon" && op[OFF] === 0) {
    mult = 2;
    let back = op[BAR] > 0;
    for (let k = 19; k <= 24; k++) if (op[k]) back = true; // dans le jan du gagnant
    if (back) mult = 3;
  }
  const pts = s.cubeVal * mult;
  const id = s.order[side];
  s.score[id] += pts;
  s.end = { side, pts, kind: kind === "abandon" ? "abandon" : ["", "simple", "gammon", "backgammon"][mult] };
  s.phase = s.match <= 1 || s.score[id] >= s.match ? "over" : "end";
}

function commit(s) {
  s.last = s.played.slice(); s.lastSide = s.side;
  s.note = null;
  s.side = 1 - s.side;
  s.phase = "roll";
  s.played = [];
  s.need = 0;
  s.t0 = null;
}

function playOne(s, f, d) {
  const me = s.b[s.side], op = s.b[1 - s.side];
  const ok = movesNow(s).some((m) => m.f === f && m.d === d);
  if (!ok) fail("Ce mouvement n'est pas permis");
  const hit = doMove(me, op, f, d);
  s.played.push({ f, d, t: Math.max(0, f - d), h: hit ? 1 : 0 });
  if (me[OFF] === 15) { s.last = s.played.slice(); s.lastSide = s.side; finishGame(s, s.side, "normal"); return true; }
  return false;
}

export function reduce(s, pid, a) {
  if (!toAct(s).includes(pid)) fail("Ce n'est pas ton tour");
  const r = () => mkRng(a.seed || 1);
  if (a.type === "auto") return autoTurn(s, pid, r());
  if (s.phase === "end") {
    if (a.type !== "next") fail("Lance la partie suivante");
    newGame(s, r());
    return s;
  }
  if (s.phase === "cube") {
    if (a.type === "take") { s.cubeVal *= 2; s.owner = 1 - s.side; s.phase = "roll"; s.note = { who: pid, txt: "accepte" }; return s; }
    if (a.type === "drop") { finishGame(s, s.side, "abandon"); return s; }
    fail("Accepte ou abandonne");
  }
  if (s.phase === "roll") {
    if (a.type === "double") {
      if (!canDouble(s)) fail("Tu ne peux pas doubler maintenant");
      s.phase = "cube"; s.note = null;
      return s;
    }
    if (a.type !== "roll") fail("Lance les dés");
    const g = r();
    const d1 = 1 + g.int(6), d2 = 1 + g.int(6);
    s.note = null; s.opening = null;
    startMoves(s, d1 === d2 ? [d1, d1, d1, d1] : [d1, d2]);
    return s;
  }
  // phase "move"
  if (a.type === "move") {
    const list = Array.isArray(a.list) ? a.list : [{ f: a.f, d: a.d }];
    if (!list.length) fail("Aucun mouvement");
    for (const m of list) {
      if (turnComplete(s)) fail("Tu as joué tous tes dés");
      if (playOne(s, m.f | 0, m.d | 0)) return s;
    }
    if (a.end) {
      if (!turnComplete(s)) fail("Il reste des dés à jouer");
      commit(s);
    }
    return s;
  }
  if (a.type === "undo") {
    if (!s.played.length) fail("Rien à annuler");
    const keep = s.played.slice(0, -1);
    s.b = [s.t0[0].slice(), s.t0[1].slice()];
    if (s.side === 1) s.b = [s.t0[1].slice(), s.t0[0].slice()];
    s.played = [];
    for (const m of keep) playOne(s, m.f, m.d);
    return s;
  }
  if (a.type === "done") {
    if (!turnComplete(s)) fail("Il reste des dés à jouer");
    commit(s);
    return s;
  }
  fail("Action inconnue");
}

export function result(s) {
  if (!matchOver(s)) return null;
  const rk = rankByScore(s.order.map((id) => ({ id, score: s.score[id] })));
  return { ranking: rk.concat((s.extra || []).map((id) => ({ id, rank: 3, score: 0 }))) };
}

// ---------------------------------------------------------------- robot
// probabilité (sur 36) qu'au moins un des pions isolés de `me` soit touché par `op`
const ROLLS = [];
for (let x = 1; x <= 6; x++) for (let y = x; y <= 6; y++) ROLLS.push([x, y, x === y ? 1 : 2]);

function shotRolls(me, op) {
  // dans le repère de me : l'adversaire sur ma flèche x (0 = sa barre) avance vers les nombres croissants
  const blots = [];
  for (let k = 1; k <= 24; k++) if (me[k] === 1) blots.push(k);
  if (!blots.length) return { n: 0, worst: 0 };
  const src = [];
  if (op[BAR]) src.push(0);
  for (let x = 1; x <= 24; x++) if (op[25 - x]) src.push(x);
  const blocked = (y) => y >= 1 && y <= 24 && me[y] >= 2;
  let n = 0, worst = 0;
  const hitBy = new Array(25).fill(0);
  for (const [x, y, w] of ROLLS) {
    const steps = x === y ? [x, 2 * x, 3 * x, 4 * x] : null;
    let any = false;
    for (const k of blots) {
      let hit = false;
      for (const sx of src) {
        if (op[BAR] && sx !== 0 && (op[BAR] > 1 || false)) continue; // bloqué sur la barre
        const dist = k - sx;
        if (dist <= 0) continue;
        if (steps) {
          for (let i = 0; i < 4 && !hit; i++) {
            if (steps[i] !== dist) continue;
            let ok = true;
            for (let j = 0; j < i; j++) if (blocked(sx + steps[j])) ok = false;
            if (ok) hit = true;
          }
        } else if (dist === x || dist === y) hit = true;
        else if (dist === x + y && (!blocked(sx + x) || !blocked(sx + y))) hit = true;
        if (hit) break;
      }
      if (hit) { any = true; hitBy[k] += w; }
    }
    if (any) n += w;
  }
  for (const k of blots) worst = Math.max(worst, hitBy[k] * (25 - k));
  return { n, worst, hitBy };
}

const contact = (me, op) => {
  let a = 0, c = 0;
  for (let k = 25; k >= 1; k--) if (me[k]) { a = k; break; }
  for (let k = 25; k >= 1; k--) if (op[k]) { c = k; break; }
  return a + c > 25;
};

// évaluation après mon coup, l'adversaire va jouer ; plus haut = mieux
export function evaluate(me, op, full = true) {
  const pm = pips(me), po = pips(op);
  let v = (po - pm) * 1.0 + me[OFF] * 1.5;
  if (!contact(me, op)) {
    // course : on avance, on sort, on évite les trous et les tas
    v += me[OFF] * 4;
    for (let k = 1; k <= 6; k++) if (me[k] > 3) v -= (me[k] - 3) * 0.6;
    return v;
  }
  // flèches tenues
  let run = 0, bestRun = 0, home = 0;
  for (let k = 1; k <= 24; k++) {
    if (me[k] >= 2) {
      run++; bestRun = Math.max(bestRun, run);
      if (k <= 6) { home++; v += k === 5 || k === 4 ? 9 : k === 6 ? 7 : 4; }
      else if (k === 7) v += 7;
      else if (k <= 11) v += 3;
      else if (k >= 18 && k <= 21) v += 5; // ancre chez l'adversaire
      else if (k >= 22) v += 3;
      if (me[k] > 4) v -= (me[k] - 4) * 1.2;
    } else run = 0;
  }
  if (bestRun >= 3) v += bestRun * bestRun * 1.6;
  // adversaire sur la barre : d'autant mieux que mon jan est fermé
  v += op[BAR] * (6 + home * 2.5);
  v -= me[BAR] * 6;
  // pions isolés exposés
  if (full) {
    const sh = shotRolls(me, op);
    v -= (sh.n / 36) * 16 + sh.worst / 36 * 1.2;
    // pions isolés dans mon jan face à un adversaire sur la barre
  } else {
    for (let k = 1; k <= 24; k++) if (me[k] === 1) v -= k < 19 ? 3 : 1;
  }
  return v;
}

function bestTurn(s, side, rng, level) {
  const me = s.b[side], op = s.b[1 - side];
  const { turns } = allTurns(me, op, remainingDice(s));
  if (!turns.length) return [];
  if (level <= 1 && rng.next() < 0.55) return rng.pick(turns).moves;
  let best = -Infinity, cands = [];
  const noise = level <= 1 ? 14 : level === 2 ? 3 : 0;
  for (const t of turns) {
    let v = evaluate(t.me, t.op, level >= 3);
    if (noise) v += (rng.next() - 0.5) * noise;
    if (v > best + 1e-9) { best = v; cands = [t]; } else if (Math.abs(v - best) <= 1e-9) cands.push(t);
  }
  return rng.pick(cands).moves;
}

// estimation grossière de l'avance du joueur side (en proportion de sa course)
function lead(s, side) {
  const me = s.b[side], op = s.b[1 - side];
  const pm = pips(me) + 4, po = pips(op) + 4;
  let adv = (po - pm) / pm;
  if (contact(me, op)) {
    adv += (op[BAR] - me[BAR]) * 0.06;
    let hm = 0, ho = 0;
    for (let k = 1; k <= 6; k++) { if (me[k] >= 2) hm++; if (op[k] >= 2) ho++; }
    adv += (hm - ho) * 0.015;
  }
  return adv;
}

export function bot(s, pid, rng) {
  const side = s.order.indexOf(pid), level = s.level || 2;
  if (s.phase === "end") return { type: "next" };
  if (s.phase === "cube") {
    // j'accepte si mon retard reste raisonnable
    if (level <= 1) return { type: "take" };
    return lead(s, side) > -(level >= 3 ? 0.17 : 0.2) ? { type: "take" } : { type: "drop" };
  }
  if (s.phase === "roll") {
    if (level >= 2 && canDouble(s)) {
      const l = lead(s, side);
      if (l >= (level >= 3 ? 0.09 : 0.13) && l < 0.35) return { type: "double" };
    }
    return { type: "roll" };
  }
  const moves = bestTurn(s, side, rng, level);
  return { type: "move", list: moves.map((m) => ({ f: m.f, d: m.d })), end: true };
}

// délai écoulé : on finit le tour à la place du joueur
export function auto() { return { type: "auto" }; }
function autoTurn(s, pid, g) {
  if (s.phase === "end") { newGame(s, g); return s; }
  if (s.phase === "cube") { finishGame(s, s.side, "abandon"); return s; }
  if (s.phase === "roll") {
    const d1 = 1 + g.int(6), d2 = 1 + g.int(6);
    s.note = null; s.opening = null;
    startMoves(s, d1 === d2 ? [d1, d1, d1, d1] : [d1, d2]);
    if (s.phase !== "move") return s;
  }
  const moves = bestTurn(s, s.side, g, 2);
  for (const m of moves) if (playOne(s, m.f, m.d)) return s;
  if (turnComplete(s)) commit(s);
  return s;
}

export function botDelay(s, pid, rng) {
  if (s.phase === "roll") return 550 + rng.int(400);
  if (s.phase === "move") return 900 + rng.int(600);
  return 1300;
}
