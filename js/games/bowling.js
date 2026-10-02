import { fail, rankByScore } from "../engine.js";

export const meta = {
  id: "bowling", name: "Bowling", cat: "Adresse", min: 1, max: 6, turnTime: 40,
  color: "#E5484D", desc: "Vise, donne de l'effet, fais tomber les 10 quilles.",
  rules: ["Fais glisser la boule pour la placer, puis lance-la d'un geste vers le haut.",
    "Plus le geste est rapide, plus la boule va vite. Un geste courbé lui donne de l'effet.",
    "Strike : 10 quilles d'un coup (bonus des 2 lancers suivants). Spare : 10 en deux (bonus du suivant).",
    "10 frames (ou 5 en partie rapide). Le plus gros score gagne."],
};

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
export function simulate(thr, standing, record = false) {
  const t = clampThrow(thr);
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
      ball.vx += t.spin * 0.9 * ramp * dt;
    }
    ball.x += ball.vx * dt; ball.y += ball.vy * dt;
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
export function setup(players, settings) {
  const n = settings.frames === 5 ? 5 : 10;
  const rolls = {};
  players.forEach((p) => (rolls[p.id] = []));
  return { order: players.map((p) => p.id), n, cur: 0, frame: 0, ball: 0, standing: Array(10).fill(true), rolls,
    marks: {}, last: null, done: false, level: settings.level || 2 };
}

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
  const { down } = simulate(thr, before);
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
  s.last = { id: pid, thr, before, down, frame: s.frame, ball: s.ball, mark, seq: (s.last ? s.last.seq : 0) + 1 };
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
    const curve = spin * 0.9 * ((LANE.L * 0.55) / vy) ** 2 * 0.5;
    const vx = ((tgt[0] - x - curve) / (tgt[1] - LANE.start)) * vy;
    const thr = { x, vx, vy, spin };
    const n = simulate(thr, standing).down.length;
    if (n > bestN) { bestN = n; best = thr; }
  }
  const err = [0.05, 0.022, 0.008][lvl - 1] || 0.02;
  return { type: "throw", x: best.x + (rng.next() - 0.5) * err, vx: best.vx + (rng.next() - 0.5) * err * 4, vy: best.vy, spin: best.spin };
}
export function auto() { return { type: "throw", x: 0.08, vx: -0.05, vy: 8, spin: 0 }; }
