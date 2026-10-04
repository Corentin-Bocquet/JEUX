// Affichage commun des quiz « flash » (vraifaux, intrus, geo).
// Chaque jeu fournit la question, les boutons de réponse et la révélation ;
// ce module gère les phases (compte à rebours, question, attente, révélation).
import { h } from "../../ui.js";
import { nameOf } from "../../views/common.js";
import { qStart, question, aliveIds, START_MS } from "./flash.js";

export const scoreOf = (s, id) => s.scores[id];
export const scoreLabel = (sc) => `${sc} pts`;
const sec = (ms) => (ms / 1000).toFixed(1).replace(".", ",") + " s";

// spec : { id, tag(q) -> texte court (catégorie), prompt(ctx, q), answers(ctx, q, send, mine),
//          reveal(ctx, last), label(s, q, v) -> texte d'une réponse donnée }
export function mountFlash(root, ctx0, spec) {
  const P = "g-" + spec.id;
  const el = h("div", { class: P });
  root.append(el);
  let key = "", timer = null, lastSeen = null, ctxNow = ctx0, dead = false;
  const main = h("div", { class: `${P}-main` });
  const status = h("div", { class: `${P}-status` });
  const top = h("div", { class: `${P}-top` });
  el.append(top, main, status);

  function phaseOf(s) {
    const now = Date.now();
    if (s.done) return "end";
    if (now < qStart(s)) return s.last ? "reveal" : "intro";
    return "question";
  }
  function schedule(s) {
    clearTimeout(timer);
    if (s.done) return;
    const wait = qStart(s) - Date.now();
    if (wait > 0) timer = setTimeout(() => { if (!dead) draw(ctxNow); }, wait + 30);
  }

  function update(ctx) {
    ctxNow = ctx;
    const s = ctx.state;
    // son à chaque révélation
    const lq = s.last ? s.last.qi : null;
    if (lastSeen !== null && lq !== lastSeen && s.last) {
      const r = s.last.ans[ctx.me];
      if (r && r.ok) ctx.sfx.ok(); else if (r) { ctx.sfx.bad(); ctx.buzz(40); }
      if (s.done) setTimeout(() => !dead && ctx.sfx.win(), 500);
    }
    lastSeen = lq ?? -1;
    draw(ctx);
  }

  function draw(ctx) {
    const s = ctx.state;
    const ph = phaseOf(s);
    const mine = s.ans[ctx.me] || null;
    const k = [ph, s.qi, mine ? 1 : 0, s.alive[ctx.me] ? 1 : 0].join(":");
    drawTop(ctx, ph);
    if (k !== key) {
      key = k;
      if (ph === "intro") main.replaceChildren(intro(s));
      else if (ph === "reveal" || ph === "end") main.replaceChildren(reveal(ctx, ph));
      else main.replaceChildren(ask(ctx, mine));
    }
    drawStatus(ctx, ph, mine);
    schedule(s);
  }

  function drawTop(ctx, ph) {
    const s = ctx.state;
    const total = s.qs.length;
    const shown = (ph === "reveal" || ph === "end") && s.last;
    const num = shown ? s.last.qi + 1 : Math.min(s.qi + 1, total);
    const q = shown ? s.last.q : question(s);
    const tag = q && spec.tag ? spec.tag(q) : null;
    top.replaceChildren(
      h("div", { class: `${P}-bar` },
        h("span", { class: `${P}-num` }, ph === "end" ? "Terminé" : `Question ${num} / ${total}`),
        tag ? h("span", { class: `${P}-tag` }, tag) : null,
        s.sudden ? h("span", { class: `${P}-skull` }, `💀 ${aliveIds(s).length} en vie`) : null,
        h("span", { class: `${P}-me` }, h("b", null, s.scores[ctx.me] ?? 0), " pts")),
      h("div", { class: `${P}-prog` }, h("i", { style: { width: `${(Math.min(s.qi, total) / total) * 100}%` } })));
  }

  function intro(s) {
    const left = Math.max(0, qStart(s) - Date.now());
    const box = h("div", { class: `${P}-intro` },
      h("div", { class: `${P}-ready` }, "Prêt ?"),
      h("div", { class: "dim" }, `${s.qs.length} questions, tout le monde répond en même temps.`),
      h("div", { class: `${P}-countdown` }, h("i", { style: { animationDuration: `${left || START_MS}ms` } })));
    return box;
  }

  function ask(ctx, mine) {
    const s = ctx.state;
    const q = question(s);
    const out = !s.alive[ctx.me];
    const send = (v) => {
      if (s.ans[ctx.me] || out) return;
      ctx.sfx.tap();
      ctx.act({ type: "answer", v });
    };
    const elapsed = Math.max(0, Date.now() - qStart(s));
    const speed = s.speed ? h("div", { class: `${P}-speed` }, h("i", { style: { animationDuration: `${s.win}ms`, animationDelay: `-${Math.min(elapsed, s.win)}ms` } })) : null;
    return h("div", { class: `${P}-ask` },
      speed,
      h("div", { class: `${P}-card` }, spec.prompt(ctx, q)),
      out ? h("div", { class: "turnmsg" }, "Tu es éliminé : regarde la suite !") : spec.answers(ctx, q, send, mine));
  }

  function reveal(ctx, ph) {
    const s = ctx.state;
    const last = s.last;
    if (!last) return h("div", { class: `${P}-intro` }, h("div", { class: `${P}-ready` }, "Partie terminée !"));
    const r = last.ans[ctx.me];
    let banner;
    if (!r) banner = h("div", { class: `${P}-banner watch` }, "👀 Tu regardes");
    else if (r.ok) banner = h("div", { class: `${P}-banner ok` }, "✓ Bonne réponse ! ", h("b", null, `+${r.p}`));
    else if (r.v == null) banner = h("div", { class: `${P}-banner bad` }, "⏱ Pas de réponse");
    else banner = h("div", { class: `${P}-banner bad` }, "✗ Raté !");
    const rows = s.ids.filter((id) => last.ans[id]).map((id) => {
      const a = last.ans[id];
      return h("div", { class: `${P}-res ${a.ok ? "ok" : "bad"}${id === ctx.me ? " me" : ""}` },
        h("span", { class: `${P}-res-n` }, nameOf(ctx, id)),
        h("span", { class: `${P}-res-a` }, a.v == null ? "pas de réponse" : spec.label(s, last.q, a.v)),
        h("span", { class: `${P}-res-t` }, a.v == null ? "" : sec(a.ms)),
        h("b", { class: `${P}-res-p` }, a.ok ? `+${a.p}` : last.elim.includes(id) ? "💀" : "0"));
    });
    const left = Math.max(0, qStart(s) - Date.now());
    return h("div", { class: `${P}-reveal` },
      banner,
      h("div", { class: `${P}-card` }, spec.reveal(ctx, last)),
      rows.length > 1 || (rows.length && ctx.state.ids.length > 1) ? h("div", { class: `${P}-results` }, rows) : null,
      ph === "end"
        ? h("div", { class: `${P}-next end` }, "Partie terminée !")
        : h("div", { class: `${P}-next` }, h("span", null, "Question suivante…"), h("div", { class: `${P}-countdown` }, h("i", { style: { animationDuration: `${left}ms` } }))));
  }

  function drawStatus(ctx, ph, mine) {
    const s = ctx.state;
    if (ph !== "question") { status.replaceChildren(); return; }
    const alive = aliveIds(s);
    const waiting = alive.filter((id) => !(id in s.ans));
    const chips = alive.map((id) => h("span", { class: `${P}-who${id in s.ans ? " done" : ""}` }, id in s.ans ? "✓ " : "… ", id === ctx.me ? "Toi" : nameOf(ctx, id)));
    let msg = null;
    if (mine && waiting.length) msg = h("div", { class: "turnmsg" }, `Réponse envoyée ! On attend ${waiting.map((id) => nameOf(ctx, id)).join(", ")}…`);
    else if (!mine && s.alive[ctx.me]) msg = h("div", { class: "turnmsg me" }, "À toi : réponds vite !");
    status.replaceChildren(msg, alive.length > 1 ? h("div", { class: `${P}-whos` }, chips) : null);
  }

  update(ctx0);
  return { update, destroy() { dead = true; clearTimeout(timer); } };
}
