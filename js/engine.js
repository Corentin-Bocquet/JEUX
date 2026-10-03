// Moteur commun : hasard reproductible, application d'une action, délais de
// tour et fin de partie. Rien ici ne touche au DOM : testable sous Node.

export function rng(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (n) => Math.floor(next() * n),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    shuffle(arr) {
      const a2 = arr.slice();
      for (let i = a2.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a2[i], a2[j]] = [a2[j], a2[i]];
      }
      return a2;
    },
  };
}

export const newSeed = () => (Math.random() * 4294967296) >>> 0;
export const clone = (o) => (o === undefined ? o : JSON.parse(JSON.stringify(o)));

export class GameError extends Error {}
export const fail = (msg) => { throw new GameError(msg); };

// Démarre une partie. players : [{id, name, bot}]
// Champs réservés au moteur dans l état : round, startedAt, seq, _dl, _who, result.
export function start(game, players, settings, seed, now, round = 0) {
  const st = game.setup(players.map((p) => ({ id: p.id, name: p.name, bot: !!p.bot })), settings || {}, rng(seed));
  st.round = round;
  st.startedAt = now;
  st.seq = 0;
  stamp(game, st, now, settings);
  return st;
}

function stamp(game, st, now, settings) {
  const t = settings && settings.turnTime != null ? settings.turnTime : game.meta.turnTime || 0;
  const who = game.result(st) ? [] : game.toAct(st);
  st._who = who.join(",");
  st._dl = t > 0 && who.length ? now + t * 1000 : 0;
}

// Applique l'action d'un joueur. Retourne un nouvel état (l'ancien est intact).
// action.seed et action.now sont posés par l'appelant pour rester reproductibles.
export function apply(game, state, pid, action, settings) {
  if (!state) fail("Partie absente");
  if (state.result) fail("La partie est terminée");
  const now = action.now || Date.now();
  let st = clone(state);
  if (action.type === "timeout") {
    if (!st._dl || now < st._dl) fail("Pas encore");
    const who = game.toAct(st);
    if (!who.length || who.join(",") !== action.who) fail("Le tour a changé");
    const r = rng(action.seed || 1);
    for (const p of who) {
      if (st.result || game.result(st)) break;
      if (!game.toAct(st).includes(p)) continue;
      const a = game.auto ? game.auto(st, p, r) : game.bot(st, p, r);
      if (a) st = game.reduce(st, p, { ...a, seed: r.int(4294967296), now, auto: true });
    }
  } else {
    st = game.reduce(st, pid, { ...action, now });
  }
  st.seq = (state.seq || 0) + 1;
  const res = game.result(st);
  if (res) {
    st.result = res;
    st._dl = 0;
    st._who = "";
  } else {
    stamp(game, st, now, settings);
  }
  return st;
}

// Classement à partir de scores (plus haut = mieux, sauf lowWins)
export function rankByScore(entries, lowWins = false) {
  const sorted = entries.slice().sort((a, b) => (lowWins ? a.score - b.score : b.score - a.score));
  let rank = 0, prev = null;
  return sorted.map((e, i) => {
    if (prev === null || e.score !== prev) { rank = i + 1; prev = e.score; }
    return { id: e.id, rank, score: e.score };
  });
}
