import { fail, rankByScore, rng as mkRng } from "../engine.js";

export const meta = {
  id: "bowling", name: "Bowling", cat: "Adresse", min: 1, max: 6, turnTime: 40,
  color: "#E5484D", desc: "Vise, donne de l'effet, fais tomber les 10 quilles.",
  rules: ["Fais glisser la boule pour la placer, puis lance-la d'un geste vers le haut.",
    "Plus le geste est rapide, plus la boule va vite. Un geste courbé lui donne de l'effet.",
    "Strike : 10 quilles d'un coup (bonus des 2 lancers suivants). Spare : 10 en deux (bonus du suivant).",
    "10 frames par défaut. Le plus gros score gagne.",
    "Options : nombre de frames, bumpers (pas de rigole, la boule rebondit), vent qui pousse la boule et état de la piste (plus ou moins d'effet)."],
};

// ------------------------------------------------ réglages
export const options = [
  { key: "frames", label: "Frames", icon: "🎳",
    values: [[3, "3", "Éclair"], [5, "5", "Rapide"], [10, "10", "Complète"]], def: 10 },
  { key: "bumpers", label: "Bumpers", icon: "🛡️",
    values: [[false, "Non", "Rigoles ouvertes"], [true, "Oui", "Pas de rigole"]], def: false },
  { key: "wind", label: "Vent", icon: "🌬️",
    values: [[0, "Aucun"], [1, "Brise", "Léger écart"], [2, "Tempête", "Gros écart"]], def: 0 },
  { key: "oil", label: "Piste", icon: "🛢️",
    values: [["normale", "Normale"], ["seche", "Sèche", "Beaucoup d'effet"], ["huilee", "Huilée", "Presque droit"]], def: "normale" },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "🎳", desc: "10 frames, piste normale, sans vent.", set: { frames: 10, bumpers: false, wind: 0, oil: "normale" } },
  { id: "enfants", name: "Bumpers", emoji: "🛡️", desc: "5 frames, la boule rebondit sur les bords.", set: { frames: 5, bumpers: true, wind: 0, oil: "normale" } },
  { id: "tempete", name: "Tempête", emoji: "🌪️", desc: "Vent fort et piste sèche : vise juste !", set: { frames: 10, bumpers: false, wind: 2, oil: "seche" } },
  { id: "eclair", name: "Éclair", emoji: "⚡", desc: "3 frames sur piste huilée, avec une brise.", set: { frames: 3, bumpers: false, wind: 1, oil: "huilee" } },
];
// valeur d'un réglage, ou le défaut si absente ou invalide
export function opt(settings, key) {
  const o = options.find((x) => x.key === key);
  const v = settings ? settings[key] : undefined;
  const hit = o.values.find((x) => x[0] === v || (v != null && String(x[0]) === String(v)));
  return hit ? hit[0] : o.def;
}
export const OIL = { normale: 1, seche: 1.7, huilee: 0.45 };
const WIND = { 1: [0.06, 0.18], 2: [0.16, 0.32] };
// force du vent (signée) pour le prochain lancer
export function drawWind(level, r) {
  const w = WIND[level];
  if (!w) return 0;
  const f = w[0] + r.next() * (w[1] - w[0]);
  return Math.round((r.next() < 0.5 ? -f : f) * 100) / 100;
}

// ------------------------------------------------ physique (déterministe : + - * / et racine seulement)
export const LANE = { L: 16, half: 0.5, rb: 0.105, rp: 0.0575, start: 0.4 };
const S = 0.1446;
export const PINS = [[0, 0], [-S, 0.25], [S, 0.25], [-2 * S, 0.5], [0, 0.5], [2 * S, 0.5], [-3 * S, 0.75], [-S, 0.75], [S, 0.75], [3 * S, 0.75]]
  .map(([x, y]) => [x, LANE.L + y]);

export const LIMITS = { x: 0.4, speed: [5, 12], spin: 1 };

export function clampThrow(t) {
  const x = Math.max(-LIMITS.x, Math.min(LIMITS.x, +t.x || 0));
  let vx = +t.vx || 0, vy = +t.vy || 8;
  if (vy < 3) vy = 3;
  let sp = Math.sqrt(vx * vx + vy * vy);
  const k = sp > LIMITS.speed[1] ? LIMITS.speed[1] / sp : sp < LIMITS.speed[0] ? LIMITS.speed[0] / sp : 1;
  vx *= k; vy *= k;
  if (Math.abs(vx) > vy * 0.08) vx = (vx < 0 ? -1 : 1) * vy * 0.08;
  const spin = Math.max(-1, Math.min(1, +t.spin || 0));
  return { x, vx, vy, spin };
}

// standing : tableau de 10 booléens. Retourne { down: [indices], frames? }
// env : { bump: rebond sur les bords, wind: poussée latérale, oil: multiplicateur d'effet }
export function simulate(thr, standing, record = false, env = {}) {
  const t = clampThrow(thr);
  const bump = !!(env && env.bump), wind = (env && +env.wind) || 0, oil = (env && +env.oil) || 1;
  const dt = 1 / 240;
  const { L, half, rb, rp } = LANE;
  const ball = { x: t.x, y: LANE.start, vx: t.vx, vy: t.vy, gutter: false };
  const pins = PINS.map(([x, y], i) => ({ x, y, vx: 0, vy: 0, up: !!standing[i], down: false, gone: !standing[i], hit: false }));
  const frames = [];
  const Mb = 5, Mp = 1;
  for (let step = 0; step < 240 * 7; step++) {
    // effet : la boule accroche quand elle sort de la zone huilée
    if (!ball.gutter) {
      const ramp = ball.y < L * 0.45 ? 0 : ball.y > L ? 1 : (ball.y - L * 0.45) / (L * 0.55);
      ball.vx += t.spin * 0.9 * oil * ramp * dt;
      if (ball.y < L) ball.vx += wind * dt;
    }
    ball.x += ball.vx * dt; ball.y += ball.vy * dt;
    if (bump && !ball.gutter && ball.y < L - 0.2) {
      // bumpers : la boule rebondit sur le bord au lieu de tomber dans la rigole
      const lim = half - rb;
      if (ball.x < -lim) { ball.x = -lim; ball.vx = Math.abs(ball.vx) * 0.5; }
      else if (ball.x > lim) { ball.x = lim; ball.vx = -Math.abs(ball.vx) * 0.5; }
    }
    if (!ball.gutter && (ball.x < -half || ball.x > half) && ball.y < L - 0.2) {
      ball.gutter = true; ball.x = ball.x < 0 ? -half - rb : half + rb; ball.vx = 0;
    }
    for (const p of pins) {
      if (p.gone) continue;
      if (p.down || p.hit) {
        p.x += p.vx * dt; p.y += p.vy * dt;
        const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (sp > 0) { const nsp = Math.max(0, sp - 2.2 * dt); p.vx *= nsp / sp; p.vy *= nsp / sp; }
        if (p.x < -half - 0.02 || p.x > half + 0.02 || p.y > L + 1.25 || p.y < L - 0.6) { p.gone = true; p.down = true; }
      }
    }
    // boule contre quilles
    if (!ball.gutter) for (const p of pins) {
      if (p.gone) continue;
      const dx = p.x - ball.x, dy = p.y - ball.y, d2 = dx * dx + dy * dy, R = rb + rp;
      if (d2 < R * R && d2 > 0) {
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
        const rel = (ball.vx - p.vx) * nx + (ball.vy - p.vy) * ny;
        if (rel > 0) {
          const j = (1.8 * rel) / (1 / Mb + 1 / Mp);
          ball.vx -= (j / Mb) * nx; ball.vy -= (j / Mb) * ny;
          p.vx += (j / Mp) * nx; p.vy += (j / Mp) * ny;
          p.hit = true;
          if (rel > 0.25) p.down = true;
        }
        const push = R - d;
        p.x += nx * push; p.y += ny * push;
      }
    }
    // quilles entre elles
    for (let a = 0; a < 10; a++) for (let b = a + 1; b < 10; b++) {
      const p = pins[a], q = pins[b];
      if (p.gone || q.gone) continue;
      if (!(p.hit || p.down || q.hit || q.down)) continue;
      const dx = q.x - p.x, dy = q.y - p.y, d2 = dx * dx + dy * dy, R = 2 * rp;
      if (d2 < R * R && d2 > 0) {
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
        const rel = (p.vx - q.vx) * nx + (p.vy - q.vy) * ny;
        if (rel > 0) {
          const j = (1.7 * rel) / 2;
          p.vx -= j * nx; p.vy -= j * ny; q.vx += j * nx; q.vy += j * ny;
          p.hit = q.hit = true;
          if (rel > 0.2) { p.down = true; q.down = true; }
        }
        const push = (R - d) / 2;
        p.x -= nx * push; p.y -= ny * push; q.x += nx * push; q.y += ny * push;
      }
    }
    if (record && step % 4 === 0) frames.push({ b: [ball.x, ball.y, ball.gutter ? 1 : 0], p: pins.map((p) => [p.x, p.y, p.down ? 1 : 0, p.gone ? 1 : 0]) });
    const moving = pins.some((p) => !p.gone && (p.vx * p.vx + p.vy * p.vy) > 1e-4);
    if (ball.y > L + 1.6 && !moving) break;
  }
  // une quille poussée hors de sa place finit par tomber
  pins.forEach((p, i) => {
    if (!p.up || p.down) return;
    const dx = p.x - PINS[i][0], dy = p.y - PINS[i][1];
    if (dx * dx + dy * dy > 0.04 * 0.04) p.down = true;
  });
  const down = [];
  pins.forEach((p, i) => { if (p.up && p.down) down.push(i); });
  return record ? { down, frames, throw: t } : { down };
}

// ------------------------------------------------ score
export function frameScores(rolls, nFrames) {
  // rolls : liste à plat des quilles tombées par lancer. Retourne le cumul par frame (null si incalculable)
  const out = [];
  let i = 0, total = 0;
  for (let f = 0; f < nFrames; f++) {
    if (i >= rolls.length) { out.push(null); continue; }
    if (f === nFrames - 1) {
      const a = rolls[i], b = rolls[i + 1], c = rolls[i + 2];
      if (b === undefined) { out.push(null); i += 3; continue; }
      if (a === 10 || a + b === 10) {
        if (c === undefined) { out.push(null); i += 3; continue; }
        total += a + b + c;
      } else total += a + b;
      out.push(total); i += 3; continue;
    }
    if (rolls[i] === 10) {
      if (rolls[i + 2] === undefined) { out.push(null); i += 1; continue; }
      total += 10 + rolls[i + 1] + rolls[i + 2]; out.push(total); i += 1;
    } else {
      if (rolls[i + 1] === undefined) { out.push(null); i += 2; continue; }
      if (rolls[i] + rolls[i + 1] === 10) {
        if (rolls[i + 2] === undefined) { out.push(null); i += 2; continue; }
        total += 10 + rolls[i + 2];
      } else total += rolls[i] + rolls[i + 1];
      out.push(total); i += 2;
    }
  }
  return out;
}
export function totalScore(rolls, nFrames) {
  // somme provisoire : on compte ce qui est déjà tombé, bonus connus inclus
  const fs = frameScores(rolls, nFrames);
  let last = 0;
  for (const v of fs) if (v != null) last = v;
  return last;
}

// ------------------------------------------------ partie
export function setup(players, settings, rng) {
  const n = opt(settings, "frames");
  const windLvl = opt(settings, "wind");
  const rolls = {};
  players.forEach((p) => (rolls[p.id] = []));
  return { order: players.map((p) => p.id), n, cur: 0, frame: 0, ball: 0, standing: Array(10).fill(true), rolls,
    marks: {}, last: null, done: false, level: settings.level || 2,
    bump: opt(settings, "bumpers"), windLvl, wind: rng ? drawWind(windLvl, rng) : 0, oil: OIL[opt(settings, "oil")] };
}
// conditions du prochain lancer (les anciennes parties n'ont pas ces champs)
export const envOf = (s) => ({ bump: !!s.bump, wind: s.wind || 0, oil: s.oil || 1 });

export function toAct(s) { return s.done ? [] : [s.order[s.cur]]; }

function nextTurn(s) {
  s.ball = 0;
  s.standing = Array(10).fill(true);
  s.cur++;
  if (s.cur >= s.order.length) { s.cur = 0; s.frame++; }
  if (s.frame >= s.n) s.done = true;
}

export function reduce(s, pid, a) {
  if (toAct(s)[0] !== pid) fail("Ce n'est pas ton tour");
  if (a.type !== "throw") fail("Action inconnue");
  const thr = clampThrow(a);
  const before = s.standing.slice();
  const env = envOf(s);
  const { down } = simulate(thr, before, false, env);
  const n = down.length;
  s.rolls[pid].push(n);
  down.forEach((i) => (s.standing[i] = false));
  const last = s.frame === s.n - 1;
  const leftNow = s.standing.filter(Boolean).length;
  let mark = null;
  if (s.ball === 0 && n === 10) mark = "strike";
  else if (s.ball === 1 && !last && leftNow === 0) mark = "spare";
  else if (last && s.ball === 1 && leftNow === 0) mark = before.filter(Boolean).length === 10 ? "strike" : "spare";
  else if (last && s.ball === 2 && n === 10 && before.filter(Boolean).length === 10) mark = "strike";
  else if (n === 0) mark = s.ball === 0 || !last ? "zero" : "zero";
  s.last = { id: pid, thr, before, down, env, frame: s.frame, ball: s.ball, mark, seq: (s.last ? s.last.seq : 0) + 1 };
  if (s.windLvl) s.wind = drawWind(s.windLvl, mkRng(a.seed || s.last.seq * 7919));
  if (!last) {
    if (s.ball === 0 && n === 10) nextTurn(s);
    else if (s.ball === 1) nextTurn(s);
    else s.ball = 1;
  } else {
    const fr = s.rolls[pid].slice(-(s.ball + 1));
    if (s.ball === 0) {
      s.ball = 1;
      if (n === 10) s.standing = Array(10).fill(true);
    } else if (s.ball === 1) {
      const bonus = fr[0] === 10 || fr[0] + fr[1] === 10;
      if (!bonus) nextTurn(s);
      else { s.ball = 2; if (leftNow === 0) s.standing = Array(10).fill(true); }
    } else nextTurn(s);
  }
  return s;
}

export function result(s) {
  if (!s.done) return null;
  return { ranking: rankByScore(s.order.map((id) => ({ id, score: totalScore(s.rolls[id], s.n) }))) };
}

// ------------------------------------------------ robot : essaie plusieurs lancers et garde le meilleur
export function bot(s, pid, rng) {
  const standing = s.standing;
  const env = envOf(s);
  const lvl = s.level || 2;
  const tries = [4, 10, 18][lvl - 1] || 10;
  let best = null, bestN = -1;
  for (let k = 0; k < tries; k++) {
    const x = (rng.next() - 0.5) * 0.6;
    const spin = (rng.next() - 0.5) * 1.6;
    const vy = 7 + rng.next() * 4;
    // vise une zone de quilles encore debout
    const targets = PINS.filter((_, i) => standing[i]);
    const tgt = targets.length ? rng.pick(targets) : PINS[0];
    const tt = (tgt[1] - LANE.start) / vy;
    const curve = spin * 0.9 * env.oil * ((LANE.L * 0.55) / vy) ** 2 * 0.5 + env.wind * tt * tt * 0.5;
    const vx = ((tgt[0] - x - curve) / (tgt[1] - LANE.start)) * vy;
    const thr = { x, vx, vy, spin };
    const n = simulate(thr, standing, false, env).down.length;
    if (n > bestN) { bestN = n; best = thr; }
  }
  const err = [0.05, 0.022, 0.008][lvl - 1] || 0.02;
  return { type: "throw", x: best.x + (rng.next() - 0.5) * err, vx: best.vx + (rng.next() - 0.5) * err * 4, vy: best.vy, spin: best.spin };
}
export function auto() { return { type: "throw", x: 0.08, vx: -0.05, vy: 8, spin: 0 }; }
