import { h } from "../ui.js";
import { nameOf } from "./common.js";
import { calc, opErr, dist, endAt, fits, LETTERS } from "../games/compte.js";

export const scoreOf = (s, id) => s.scores[id];
export const scoreLabel = (n) => `${n} pt${n > 1 ? "s" : ""}`;

const SYM = { "+": "+", "-": "−", x: "×", "/": "÷" };
const stepTxt = (st) => `${st[0]} ${SYM[st[1]]} ${st[2]} = ${st[3]}`;

export function mount(root, ctx0) {
  const el = h("div", { class: "g-compte" });
  root.append(el);
  let ctx = ctx0, key = "", tiles = [], hist = [], sel = null, op = null, word = [], closing = "", fresh = -1, lastPhase = "";

  function reset() {
    const s = ctx.state;
    tiles = (s.plates || []).map((v, i) => ({ id: i, v, used: false, plate: true }));
    hist = []; sel = null; op = null; word = []; fresh = -1;
  }
  const me = () => ctx.state.pl[ctx.me] || {};
  const playing = () => ctx.state.phase === "play" && !me().done;

  // ------------------------------------------------ chiffres
  function tapTile(t) {
    if (!playing() || t.used) return;
    ctx.sfx.tap();
    if (sel == null || op == null || sel === t.id) { sel = sel === t.id ? null : t.id; op = null; draw(); return; }
    const A = tiles.find((x) => x.id === sel);
    const a = Math.max(A.v, t.v), b = Math.min(A.v, t.v);
    const r = calc(a, op, b);
    if (r == null) { ctx.toast(opErr(a, op, b), "err"); ctx.sfx.bad(); sel = null; op = null; draw(); return; }
    A.used = true; t.used = true;
    const nt = { id: tiles.length ? Math.max(...tiles.map((x) => x.id)) + 1 : 0, v: r, used: false };
    tiles.push(nt);
    hist.push({ a: A.id, b: t.id, r: nt.id, st: [a, op, b, r] });
    sel = null; op = null; fresh = nt.id;
    const s = ctx.state;
    if (dist(s, r) < dist(s, me().v)) {
      ctx.act({ type: "propose", steps: hist.map((x) => x.st.slice(0, 3)), value: r });
      if (r === s.target) { ctx.sfx.win(); ctx.buzz(40); } else ctx.sfx.ok();
    }
    draw();
  }
  function undo() {
    const last = hist.pop();
    if (!last) return;
    tiles = tiles.filter((x) => x.id !== last.r);
    for (const t of tiles) if (t.id === last.a || t.id === last.b) t.used = false;
    sel = null; op = null; ctx.sfx.tap(); draw();
  }
  function finish() {
    const s = ctx.state;
    if (s.kind === "n") {
      const free = tiles.filter((t) => !t.used);
      const best = free.reduce((b, t) => (dist(s, t.v) < dist(s, b.v) ? t : b), free[0]);
      if (best && dist(s, best.v) < dist(s, me().v)) ctx.act({ type: "propose", steps: hist.map((x) => x.st.slice(0, 3)), value: best.v });
    }
    ctx.sfx.ok();
    ctx.act({ type: "done" });
  }

  // ------------------------------------------------ lettres
  function sendWord() {
    const s = ctx.state;
    const w = word.map((i) => s.letters[i]).join("");
    if (w.length < 2) { ctx.toast("Mot trop court", "err"); return; }
    if (w.length <= (me().w || "").length) { ctx.toast("Tu as déjà un mot plus long", "err"); return; }
    ctx.act({ type: "word", word: w });
    ctx.sfx.ok();
    word = []; draw();
  }

  // ------------------------------------------------ affichage
  function header() {
    const s = ctx.state;
    const left = Math.max(0, Math.ceil((endAt(s) - Date.now()) / 1000));
    const big = s.kind === "n"
      ? h("div", { class: "g-compte-target" }, h("small", null, "Nombre à trouver"), h("b", null, String(s.target)))
      : h("div", { class: "g-compte-target letters" }, h("small", null, "Le mot le plus long"), h("b", null, `${LETTERS} lettres`));
    return h("div", { class: "g-compte-head" },
      big,
      h("div", { class: "g-compte-side" },
        h("div", { class: "small dim" }, `Manche ${s.roundNo} / ${s.rounds}`),
        s.phase === "play" ? h("div", { class: "g-compte-clock" + (left <= 10 ? " hurry" : "") }, `${left} s`) : h("div", { class: "g-compte-clock" }, "Fin"),
        h("div", { class: "small" }, "Score ", h("b", null, s.scores[ctx.me] ?? 0))));
  }
  function others() {
    const s = ctx.state;
    const ids = s.ids.filter((id) => id !== ctx.me);
    if (!ids.length || s.phase !== "play") return null;
    return h("div", { class: "g-compte-others" }, ids.map((id) => {
      const p = s.pl[id];
      const info = s.kind === "n" ? (p.v == null ? "…" : p.v === s.target ? "pile !" : `à ${dist(s, p.v)}`) : (p.w ? `${p.w.length} lettres` : "…");
      return h("span", { class: "chip g-compte-chip" + (p.done ? " done" : "") }, nameOf(ctx, id), " ", h("b", null, info));
    }));
  }
  function numbers() {
    const s = ctx.state, p = me();
    const can = playing();
    const grid = h("div", { class: "g-compte-tiles" }, tiles.map((t) => h("button", {
      class: "g-compte-tile" + (t.plate ? "" : " res") + (t.used ? " used" : "") + (sel === t.id ? " sel" : "") + (fresh === t.id ? " fresh" : "") + (t.v === s.target ? " hit" : ""),
      disabled: !can || t.used, onclick: () => tapTile(t), "aria-label": `Nombre ${t.v}` }, String(t.v))));
    const ops = h("div", { class: "g-compte-ops" }, ["+", "-", "x", "/"].map((o) => h("button", {
      class: "g-compte-op" + (op === o ? " on" : ""), disabled: !can || sel == null, onclick: () => { op = o; ctx.sfx.tap(); draw(); }, "aria-label": { "+": "plus", "-": "moins", x: "fois", "/": "divisé par" }[o] }, SYM[o])));
    const best = p.v == null ? "Pas encore de résultat" : p.v === s.target ? `Le compte est bon : ${p.v} !` : `Ton meilleur : ${p.v} (à ${dist(s, p.v)})`;
    const hint = !can ? "" : sel == null ? "Choisis un premier nombre" : op == null ? "Choisis une opération" : "Choisis le deuxième nombre";
    return [
      h("div", { class: "turnmsg" + (can ? " me" : "") }, can ? hint : p.v === s.target ? "Bravo, le compte est bon ! On attend les autres…" : "Tu as fini, on attend les autres…"),
      grid, ops,
      h("div", { class: "g-compte-steps" }, hist.length ? hist.map((x) => h("span", { class: "chip" }, stepTxt(x.st))) : h("span", { class: "small dim" }, "Tes calculs s'affichent ici")),
      h("div", { class: "g-compte-best" + (p.v === s.target ? " hit" : "") }, best),
      can ? h("div", { class: "row gap g-compte-actions" },
        h("button", { class: "btn ghost grow", disabled: !hist.length, onclick: undo }, "↩ Annuler"),
        h("button", { class: "btn gold grow", onclick: finish }, "J'ai fini")) : null,
    ];
  }
  function letters() {
    const s = ctx.state, p = me();
    const can = playing();
    const w = word.map((i) => s.letters[i]).join("");
    return [
      h("div", { class: "turnmsg" + (can ? " me" : "") }, can ? "Touche les lettres pour former le mot le plus long" : "Tu as fini, on attend les autres…"),
      h("div", { class: "g-compte-word" }, w ? w.split("").map((c) => h("span", null, c)) : h("span", { class: "ph" }, "?")),
      h("div", { class: "g-compte-letters" }, s.letters.split("").map((c, i) => h("button", {
        class: "g-compte-tile let" + (word.includes(i) ? " used" : ""), disabled: !can || word.includes(i),
        onclick: () => { word.push(i); ctx.sfx.tap(); draw(); } }, c))),
      h("div", { class: "g-compte-best" + (p.w && p.w.length === LETTERS ? " hit" : "") }, p.w ? `Ton meilleur mot : ${p.w} (${p.w.length} lettres)` : "Pas encore de mot"),
      can ? h("div", { class: "row gap g-compte-actions" },
        h("button", { class: "btn ghost", disabled: !word.length, onclick: () => { word.pop(); ctx.sfx.tap(); draw(); }, "aria-label": "Effacer" }, "⌫"),
        h("button", { class: "btn green grow", disabled: w.length < 2 || !fits(w, s.letters), onclick: sendWord }, "Valider le mot"),
        h("button", { class: "btn gold", onclick: finish }, "Fini")) : null,
    ];
  }
  function recap() {
    const s = ctx.state;
    const L = s.last || { pts: {} };
    const order = s.ids.slice().sort((a, b) => (L.pts[b] || 0) - (L.pts[a] || 0) || (s.kind === "n" ? s.pl[a].t - s.pl[b].t : 0));
    const sol = s.kind === "n"
      ? h("div", { class: "card g-compte-sol" }, h("div", { class: "small dim" }, s.sol.v === s.target ? "Une solution" : `Impossible pile : au plus près, ${s.sol.v}`),
        h("div", { class: "g-compte-steps" }, s.sol.steps.length ? s.sol.steps.map((x) => h("span", { class: "chip" }, stepTxt(x))) : h("span", { class: "chip" }, `${s.sol.v}`)))
      : h("div", { class: "card g-compte-sol" }, h("div", { class: "small dim" }, `Lettres ${s.letters} : les plus longs mots possibles`),
        h("div", { class: "g-compte-steps" }, s.sol.words.map((x) => h("span", { class: "chip" }, `${x} (${x.length})`))));
    return [
      h("div", { class: "h3 center" }, L.winner ? `${L.winner === ctx.me ? "Tu gagnes" : nameOf(ctx, L.winner) + " gagne"} la manche !` : "Personne n'a marqué"),
      h("div", { class: "g-compte-res" }, order.map((id) => {
        const p = s.pl[id];
        const what = s.kind === "n" ? `${p.v}${p.v === s.target ? " ✓" : ` (à ${dist(s, p.v)})`}` : p.w || "aucun mot";
        return h("div", { class: "g-compte-rrow" + (id === ctx.me ? " me" : "") + (id === L.winner ? " win" : "") },
          h("span", { class: "grow" }, id === L.winner ? "🏆 " : "", nameOf(ctx, id)), h("span", { class: "g-compte-what" }, what), h("b", null, `+${L.pts[id] || 0}`));
      })),
      sol,
      s.done ? h("div", { class: "turnmsg" }, "Partie terminée !") : s.ready[ctx.me] ? h("div", { class: "turnmsg" }, "On attend les autres…")
        : h("button", { class: "btn block green", onclick: () => { ctx.sfx.tap(); ctx.act({ type: "ready" }); } }, s.roundNo >= s.rounds ? "Voir le classement" : "Manche suivante ▶"),
    ];
  }

  function draw() {
    const s = ctx.state;
    el.replaceChildren(header(), others(), ...(s.phase === "recap" ? recap() : s.kind === "n" ? numbers() : letters()));
  }

  function update(c) {
    ctx = c;
    const s = ctx.state;
    const k = s.roundNo + ":" + s.kind;
    if (k !== key) { key = k; reset(); ctx.sfx.card(); }
    if (s.phase === "recap" && lastPhase === "play") (s.last && s.last.winner === ctx.me ? ctx.sfx.win : ctx.sfx.coin)();
    lastPhase = s.phase;
    draw();
  }

  const tick = setInterval(() => {
    const s = ctx.state;
    if (!s || s.done || s.phase !== "play") return;
    const clock = el.querySelector(".g-compte-clock");
    const left = Math.max(0, Math.ceil((endAt(s) - Date.now()) / 1000));
    if (clock) { clock.textContent = `${left} s`; clock.classList.toggle("hurry", left <= 10); }
    const k = String(s.roundNo);
    if (Date.now() > endAt(s) + (ctx.isHost ? 1200 : 6000) && closing !== k) { closing = k; ctx.act({ type: "close" }); }
  }, 250);

  update(ctx0);
  return { update, destroy() { clearInterval(tick); } };
}
