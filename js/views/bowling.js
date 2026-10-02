import { h } from "../ui.js";
import { nameOf } from "./common.js";
import { simulate, PINS, LANE, frameScores, totalScore, toAct, LIMITS } from "../games/bowling.js";
import { itemById, equipOf } from "../catalog.js";

export const scoreOf = (s, id) => totalScore(s.rolls[id], s.n);

export function mount(root, ctx0) {
  let ctx = ctx0;
  const el = h("div", { class: "g-bw" });
  const canvas = h("canvas", { class: "bw-canvas", "aria-label": "Piste de bowling" });
  const hint = h("div", { class: "bw-hint" });
  const big = h("div", { class: "bw-big" });
  const stage = h("div", { class: "bw-stage" }, canvas, hint, big);
  const info = h("div", { class: "turnmsg" });
  const btns = h("div", { class: "row gap center", style: { margin: "8px 0" } });
  const board = h("div", { class: "bw-score" });
  el.append(info, stage, btns, board);
  root.append(el);
  const g = canvas.getContext("2d");
  let W = 360, Hh = 450, dpr = 1;
  const resize = () => {
    W = Math.min(root.clientWidth - 4, 520); Hh = Math.round(W * 1.22);
    dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = Hh * dpr; canvas.style.width = W + "px"; canvas.style.height = Hh + "px";
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  const ro = new ResizeObserver(() => { resize(); paint(); });
  ro.observe(root);

  // ---------------- état d'affichage
  let aimX = 0.12, spinPrev = 0, swipe = null, anim = null, queue = [], seenSeq = 0, pinsView = null, ballView = null, camY = 0, raf = 0, idleStanding = null;
  const ballColor = () => {
    const pid = ctx.state.order[ctx.state.cur];
    const p = ctx.players[pid];
    const it = itemById(equipOf(p && p.avatar).color);
    return it.v;
  };

  // ---------------- projection
  const proj = (x, y) => {
    const d = y - camY + 3.2;
    const k = 3.2 / Math.max(0.6, d);
    const hy = Hh * 0.2;
    return { X: W / 2 + x * k * W * 0.86, Y: hy + k * (Hh - hy) * 0.93, k };
  };

  function drawLane() {
    const hy = Hh * 0.2;
    // fond : fosse et mur
    const sky = g.createLinearGradient(0, 0, 0, hy + 30);
    sky.addColorStop(0, "#0B0B20"); sky.addColorStop(1, "#24244E");
    g.fillStyle = sky; g.fillRect(0, 0, W, Hh);
    const far = LANE.L + 1.35;
    const quad = (x0, x1, y0, y1, fill) => {
      const a = proj(x0, y0), b = proj(x1, y0), c = proj(x1, y1), d = proj(x0, y1);
      g.beginPath(); g.moveTo(a.X, a.Y); g.lineTo(b.X, b.Y); g.lineTo(c.X, c.Y); g.lineTo(d.X, d.Y); g.closePath();
      g.fillStyle = fill; g.fill();
    };
    const y0 = Math.max(0, camY - 2.6);
    quad(-0.75, 0.75, y0, far, "#16162E");
    quad(-0.64, -0.5, y0, far, "#3A3A55"); quad(0.5, 0.64, y0, far, "#3A3A55");
    const a = proj(-0.5, y0), b = proj(0.5, far);
    const wood = g.createLinearGradient(0, a.Y, 0, b.Y);
    wood.addColorStop(0, "#E9B979"); wood.addColorStop(0.5, "#D9A462"); wood.addColorStop(1, "#C98F4E");
    quad(-0.5, 0.5, y0, LANE.L - 0.45, wood);
    quad(-0.5, 0.5, LANE.L - 0.45, far, "#E8C392");
    // lattes
    g.strokeStyle = "rgba(120,70,20,.18)"; g.lineWidth = 1;
    for (let i = -19; i <= 19; i++) {
      const x = i / 39;
      const p0 = proj(x, y0), p1 = proj(x, far);
      g.beginPath(); g.moveTo(p0.X, p0.Y); g.lineTo(p1.X, p1.Y); g.stroke();
    }
    // reflet (huile)
    const sh = g.createLinearGradient(0, proj(0, y0).Y, 0, proj(0, 9).Y);
    sh.addColorStop(0, "rgba(255,255,255,.18)"); sh.addColorStop(1, "rgba(255,255,255,0)");
    quad(-0.5, 0.5, y0, 9, sh);
    // ligne de faute, mouches et flèches
    if (y0 < 0.1) { const f0 = proj(-0.5, 0.02), f1 = proj(0.5, 0.02); g.strokeStyle = "#B3263A"; g.lineWidth = 3; g.beginPath(); g.moveTo(f0.X, f0.Y); g.lineTo(f1.X, f1.Y); g.stroke(); }
    g.fillStyle = "#6B3E1C";
    for (let i = -3; i <= 3; i++) {
      const x = i * 0.13, yy = 4.6 + Math.abs(i) * 0.35;
      if (yy < y0) continue;
      const t = proj(x, yy), l = proj(x - 0.03, yy - 0.5), r = proj(x + 0.03, yy - 0.5);
      g.beginPath(); g.moveTo(t.X, t.Y); g.lineTo(l.X, l.Y); g.lineTo(r.X, r.Y); g.closePath(); g.fill();
    }
  }

  function drawPin(x, y, down, gone, i) {
    if (gone) return;
    const p = proj(x, y);
    const s = p.k * W * 0.86 * 0.058;
    g.save(); g.translate(p.X, p.Y);
    if (down) {
      g.rotate(((i * 37) % 7 - 3) * 0.4 + 1.2);
      g.globalAlpha = 0.9;
      g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(0, s * 0.3, s * 2.6, s * 0.8, 0, 0, 7); g.fill();
      g.fillStyle = "#F4F4F8"; g.beginPath(); g.ellipse(0, 0, s * 2.6, s * 0.9, 0, 0, 7); g.fill();
      g.fillStyle = "#E5484D"; g.fillRect(-s * 1.3, -s * 0.85, s * 0.35, s * 1.7);
    } else {
      const hgt = s * 5.2;
      g.fillStyle = "rgba(0,0,0,.28)"; g.beginPath(); g.ellipse(0, 0, s * 1.2, s * 0.4, 0, 0, 7); g.fill();
      const gr = g.createLinearGradient(-s, 0, s, 0);
      gr.addColorStop(0, "#C9CBD8"); gr.addColorStop(0.4, "#FFFFFF"); gr.addColorStop(1, "#B5B8C8");
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(-s * 0.55, 0);
      g.bezierCurveTo(-s * 1.25, -hgt * 0.25, -s * 1.15, -hgt * 0.5, -s * 0.38, -hgt * 0.66);
      g.bezierCurveTo(-s * 0.3, -hgt * 0.78, -s * 0.75, -hgt * 0.9, -s * 0.45, -hgt);
      g.bezierCurveTo(-s * 0.2, -hgt * 1.07, s * 0.2, -hgt * 1.07, s * 0.45, -hgt);
      g.bezierCurveTo(s * 0.75, -hgt * 0.9, s * 0.3, -hgt * 0.78, s * 0.38, -hgt * 0.66);
      g.bezierCurveTo(s * 1.15, -hgt * 0.5, s * 1.25, -hgt * 0.25, s * 0.55, 0);
      g.closePath(); g.fill();
      g.fillStyle = "#E5484D";
      g.fillRect(-s * 0.36, -hgt * 0.76, s * 0.72, hgt * 0.035); g.fillRect(-s * 0.4, -hgt * 0.69, s * 0.8, hgt * 0.035);
    }
    g.restore();
  }

  function drawBall(x, y, gutter, roll) {
    const p = proj(x, y);
    const r = Math.max(3, p.k * W * 0.86 * LANE.rb);
    const [c1, c2] = ballColor();
    g.fillStyle = "rgba(0,0,0,.3)"; g.beginPath(); g.ellipse(p.X, p.Y, r * 1.05, r * 0.35, 0, 0, 7); g.fill();
    const gr = g.createRadialGradient(p.X - r * 0.35, p.Y - r * 1.35, r * 0.1, p.X, p.Y - r, r * 1.1);
    gr.addColorStop(0, "#fff"); gr.addColorStop(0.18, c1); gr.addColorStop(1, c2);
    g.fillStyle = gr; g.beginPath(); g.arc(p.X, p.Y - r, r, 0, 7); g.fill();
    const a = roll || 0;
    g.fillStyle = "rgba(0,0,0,.55)";
    [[-0.28, -0.25], [0.22, -0.32], [0, 0.18]].forEach(([dx, dy]) => {
      const yy = dy * Math.cos(a) - 0.2 * Math.sin(a);
      if (Math.cos(a) < -0.2) return;
      g.beginPath(); g.arc(p.X + dx * r, p.Y - r + yy * r, r * 0.11, 0, 7); g.fill();
    });
    if (gutter) { g.globalAlpha = 1; }
  }

  function drawRack(standing) {
    // petit schéma des quilles debout
    const bx = W - 64, by = 12, sc = 13;
    g.fillStyle = "rgba(10,10,30,.55)"; g.beginPath(); g.roundRect ? g.roundRect(bx - 10, by - 6, 66, 56, 10) : g.rect(bx - 10, by - 6, 66, 56); g.fill();
    PINS.forEach(([x, y], i) => {
      const px = bx + 23 + (x / 0.1446) * sc * 0.55, py = by + 40 - (y - LANE.L) * sc * 4.2;
      g.fillStyle = standing[i] ? "#fff" : "rgba(255,255,255,.18)";
      g.beginPath(); g.arc(px, py, 4.6, 0, 7); g.fill();
    });
  }

  function paint() {
    const s = ctx.state;
    g.clearRect(0, 0, W, Hh);
    drawLane();
    const items = [];
    if (pinsView) pinsView.forEach((p, i) => items.push({ y: p[1], d: () => drawPin(p[0], p[1], p[2], p[3], i) }));
    else PINS.forEach(([x, y], i) => { if ((idleStanding || s.standing)[i]) items.push({ y, d: () => drawPin(x, y, false, false, i) }); });
    if (ballView) items.push({ y: ballView[1], d: () => drawBall(ballView[0], ballView[1], ballView[2], ballView[3]) });
    else if (!anim) items.push({ y: LANE.start, d: () => drawBall(aimX, LANE.start, 0, 0) });
    items.sort((a, b) => b.y - a.y).forEach((it) => it.d());
    if (!anim && swipe && swipe.pts.length > 1) {
      g.strokeStyle = "rgba(255,200,0,.85)"; g.lineWidth = 5; g.lineCap = "round"; g.beginPath();
      swipe.pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke();
    } else if (!anim && toAct(s).includes(ctx.me)) {
      // flèche de visée
      const a = proj(aimX, LANE.start + 0.6), b = proj(aimX, LANE.start + 3.2);
      g.strokeStyle = "rgba(255,255,255,.55)"; g.setLineDash([6, 8]); g.lineWidth = 3; g.beginPath(); g.moveTo(a.X, a.Y); g.lineTo(b.X, b.Y); g.stroke(); g.setLineDash([]);
    }
    drawRack(pinsView ? pinsView.map((p, i) => s.last && s.last.before[i] && !p[2]) : (idleStanding || s.standing));
  }

  // ---------------- animation d'un lancer
  function play(last) {
    const sim = simulate(last.thr, last.before, true);
    let i = 0;
    anim = { last, sim };
    ctx.sfx.roll();
    let hitPlayed = false;
    const step = () => {
      const f = sim.frames[Math.min(i, sim.frames.length - 1)];
      ballView = [f.b[0], f.b[1], f.b[2], i * 0.35];
      pinsView = f.p.map((p, k) => [p[0], p[1], p[2] && last.before[k], p[3] || !last.before[k]]);
      camY = Math.max(0, Math.min(LANE.L - 4.2, f.b[1] - 2.2));
      if (!hitPlayed && f.p.some((p, k) => last.before[k] && (Math.abs(p[0] - PINS[k][0]) > 0.01))) { hitPlayed = true; last.down.length >= 7 ? ctx.sfx.strike() : ctx.sfx.card(); }
      paint();
      i += 1;
      if (i < sim.frames.length + 30) raf = requestAnimationFrame(step);
      else finish();
    };
    raf = requestAnimationFrame(step);
    function finish() {
      const m = last.mark;
      big.textContent = m === "strike" ? "STRIKE !" : m === "spare" ? "SPARE !" : last.down.length === 0 ? "Raté…" : `${last.down.length} quille${last.down.length > 1 ? "s" : ""}`;
      big.className = "bw-big show" + (m === "strike" || m === "spare" ? " gold" : "");
      if (m === "strike") ctx.buzz([30, 40, 30]);
      setTimeout(() => {
        big.className = "bw-big";
        anim = null; ballView = null; pinsView = null; camY = 0; idleStanding = null;
        if (queue.length) play(queue.shift()); else { ui(); paint(); }
      }, 1100);
    }
  }

  // ---------------- lancer au doigt
  const rel = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() }; };
  canvas.addEventListener("pointerdown", (e) => {
    if (anim || !toAct(ctx.state).includes(ctx.me)) return;
    const p = rel(e);
    swipe = { pts: [p], dragBall: p.y > Hh * 0.72 };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!swipe) return;
    const p = rel(e);
    swipe.pts.push(p);
    if (swipe.pts.length > 40) swipe.pts.splice(1, 1);
    // tant que le doigt reste en bas, on déplace la boule
    if (swipe.dragBall && p.y > Hh * 0.7) {
      const k = proj(0, LANE.start).k;
      aimX = Math.max(-LIMITS.x, Math.min(LIMITS.x, (p.x - W / 2) / (k * W * 0.86)));
      swipe.pts = [p];
    } else swipe.dragBall = false;
    paint();
  });
  canvas.addEventListener("pointerup", () => {
    const sw = swipe; swipe = null;
    if (!sw || sw.pts.length < 3) { paint(); return; }
    const a = sw.pts[0], b = sw.pts[sw.pts.length - 1];
    const dy = a.y - b.y, dx = b.x - a.x, dt = Math.max(30, b.t - a.t);
    if (dy < 40) { paint(); return; }
    const speed = dy / dt; // pixels par ms
    const vy = Math.max(LIMITS.speed[0], Math.min(LIMITS.speed[1], 4 + speed * 5.5));
    const vx = (dx / dy) * vy * 0.06;
    // courbure : écart du milieu du geste par rapport à la ligne droite
    const mid = sw.pts[Math.floor(sw.pts.length / 2)];
    const lx = a.x + (b.x - a.x) * ((a.y - mid.y) / dy);
    const spin = Math.max(-1, Math.min(1, -(mid.x - lx) / 40));
    spinPrev = spin;
    ctx.act({ type: "throw", x: aimX, vx, vy, spin });
  });
  canvas.addEventListener("pointercancel", () => { swipe = null; paint(); });

  function ui() {
    const s = ctx.state;
    const mine = toAct(s).includes(ctx.me);
    const cur = s.order[s.cur];
    info.className = "turnmsg" + (mine ? " me" : "");
    info.textContent = s.done ? "Partie terminée" : mine ? `À toi ! Frame ${s.frame + 1}, boule ${s.ball + 1}` : `${nameOf(ctx, cur)} lance… (frame ${s.frame + 1})`;
    hint.textContent = mine && !anim ? "Glisse la boule en bas pour te placer, puis lance-la d'un geste vers le haut. Courbe ton geste pour donner de l'effet." : "";
    btns.replaceChildren(mine && !anim ? h("button", { class: "btn small ghost", onclick: () => ctx.act({ type: "throw", x: aimX, vx: (0.06 - aimX) / LANE.L * 9, vy: 9, spin: 0 }) }, "Lancer droit vers les quilles") : "");
    drawBoard();
  }
  function drawBoard() {
    const s = ctx.state;
    const marks = (rolls) => {
      // transforme les lancers en cases
      const out = []; let i = 0;
      for (let f = 0; f < s.n; f++) {
        const last = f === s.n - 1;
        const a = rolls[i], b = rolls[i + 1], c = rolls[i + 2];
        if (a === undefined) { out.push([]); continue; }
        if (!last) {
          if (a === 10) { out.push(["", "X"]); i += 1; continue; }
          out.push([a === 0 ? "-" : a, b === undefined ? "" : a + b === 10 ? "/" : b === 0 ? "-" : b]); i += 2; continue;
        }
        const m = [];
        m.push(a === 10 ? "X" : a === 0 ? "-" : a);
        if (b !== undefined) m.push(a === 10 ? (b === 10 ? "X" : b === 0 ? "-" : b) : a + b === 10 ? "/" : b === 0 ? "-" : b);
        if (c !== undefined) m.push(c === 10 ? "X" : (a === 10 && b !== 10 && b + c === 10) ? "/" : c === 0 ? "-" : c);
        out.push(m); i += 3;
      }
      return out;
    };
    board.replaceChildren(h("div", { class: "bw-table" },
      h("div", { class: "bw-row head" }, h("span", { class: "bw-nm" }, ""), Array.from({ length: s.n }, (_, f) => h("span", { class: "bw-f" + (f === s.frame ? " cur" : "") }, f + 1)), h("span", { class: "bw-tot" }, "Total")),
      s.order.map((id) => {
        const fs = frameScores(s.rolls[id], s.n), mk = marks(s.rolls[id]);
        return h("div", { class: "bw-row" + (id === s.order[s.cur] && !s.done ? " cur" : "") },
          h("span", { class: "bw-nm" }, nameOf(ctx, id)),
          Array.from({ length: s.n }, (_, f) => h("span", { class: "bw-f" }, h("span", { class: "bw-m" }, (mk[f] || []).map((x) => h("i", null, x))), h("b", null, fs[f] ?? ""))),
          h("span", { class: "bw-tot" }, totalScore(s.rolls[id], s.n)));
      })));
  }

  function update(c) {
    const prev = ctx.state;
    ctx = c;
    const s = c.state;
    if (s.last && s.last.seq !== seenSeq) {
      seenSeq = s.last.seq;
      if (prev && prev.last && prev.last.seq === s.last.seq) { /* rien */ }
      else if (seenSeq && (anim || queue.length)) queue.push(s.last);
      else {
        idleStanding = s.last.before;
        play(s.last);
      }
    }
    if (!anim) { ui(); paint(); } else drawBoard();
  }
  // première image : on ne rejoue pas l'ancien lancer
  seenSeq = ctx0.state.last ? ctx0.state.last.seq : 0;
  ui(); paint();
  return { update, destroy() { cancelAnimationFrame(raf); ro.disconnect(); } };
}
