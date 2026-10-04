import { h } from "../ui.js";
import { nameOf } from "./common.js";
import { toAct, rangeOf, hint, limitOf } from "../games/nombre.js";

export const scoreOf = (s, id) => s.scores[id];

export function mount(root, ctx0) {
  const el = h("div", { class: "g-nombre" });
  root.append(el);
  let typed = "", round = 0, lastN = -1, flash = null, cur = ctx0, shake = false;

  const myGuesses = (s, me) => (s.play === "tour" ? s.shared.map((x) => x.g) : (s.boards[me] || []));

  function update(ctx) {
    cur = ctx;
    const s = ctx.state;
    if (s.roundNo !== round) { round = s.roundNo; typed = ""; lastN = -1; flash = null; }
    const gs = myGuesses(s, ctx.me);
    if (gs.length !== lastN) {
      if (lastN >= 0 && gs.length > lastN) {
        const g = gs[gs.length - 1];
        const hv = hint(s, g);
        flash = { g, hv, fresh: true };
        if (hv === 0) ctx.sfx.win(); else ctx.sfx.card();
      }
      lastN = gs.length;
    }
    draw(ctx);
  }

  function key(ctx, c) {
    const s = ctx.state;
    if (!toAct(s).includes(ctx.me)) return;
    if (c === "⌫") typed = typed.slice(0, -1);
    else if (typed.length < String(s.max).length && !(typed === "" && c === "0")) typed += c;
    ctx.sfx.tap();
    draw(ctx);
  }
  function submit(ctx) {
    const s = ctx.state;
    if (!toAct(s).includes(ctx.me)) return;
    const n = Number(typed);
    const gs = myGuesses(s, ctx.me);
    const [lo, hi] = rangeOf(s, gs);
    let err = null;
    if (!typed) err = "Tape un nombre";
    else if (n < 1 || n > s.max) err = `Entre 1 et ${s.max} !`;
    else if (gs.includes(n)) err = "Déjà proposé";
    else if (n < lo) err = `Tu sais déjà que c'est au moins ${lo}`;
    else if (n > hi) err = `Tu sais déjà que c'est au plus ${hi}`;
    if (err) { ctx.toast(err, "err"); ctx.sfx.bad(); shake = true; draw(ctx); setTimeout(() => { shake = false; }, 400); return; }
    typed = "";
    ctx.act({ type: "guess", n });
  }

  const phys = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || document.querySelector(".sheet-wrap")) return;
    if (e.key === "Enter") submit(cur);
    else if (e.key === "Backspace") key(cur, "⌫");
    else if (/^[0-9]$/.test(e.key)) key(cur, e.key);
  };
  window.addEventListener("keydown", phys);

  function draw(ctx) {
    const s = ctx.state, me = ctx.me;
    const who = toAct(s);
    const mine = who.includes(me);
    const tour = s.play === "tour";
    const gs = myGuesses(s, me);
    const [lo, hi] = rangeOf(s, gs);
    const lim = limitOf(s);
    const status = tour ? null : s.status[me];

    // ---------- en-tête
    const head = h("div", { class: "g-nombre-head small" },
      h("span", { class: "chip small" }, `Manche ${s.roundNo} / ${s.rounds}`),
      h("span", { class: "chip small" }, `1 à ${s.max}`),
      h("span", { class: "chip small" }, tour ? `${gs.length} / ${lim} essais communs` : `Essais ${gs.length} / ${lim}`),
      h("span", { class: "chip small" }, tour ? "Manches gagnées " : "Total ", h("b", null, s.scores[me] ?? 0)));

    // ---------- message
    let msg, isMe = false;
    if (s.done) msg = "Partie terminée";
    else if (tour) {
      if (mine) { msg = "À toi : propose un nombre"; isMe = true; }
      else msg = `${nameOf(ctx, who[0])} réfléchit…`;
    } else if (status === "playing") { msg = gs.length ? "Continue, resserre l'écart !" : "Trouve le nombre mystère !"; isMe = true; }
    else if (status === "found") msg = `Trouvé en ${gs.length} essai${gs.length > 1 ? "s" : ""} ! On attend les autres…`;
    else msg = `Raté ! C'était ${s.secret}. On attend les autres…`;
    const turn = h("div", { class: "turnmsg" + (isMe ? " me" : "") }, msg);

    // ---------- résultat de la manche précédente
    const prev = s.history[s.history.length - 1];
    const prevBox = prev && s.roundNo > 1 && !gs.length
      ? h("div", { class: "g-nombre-prev small" }, `Manche précédente : le nombre était `, h("b", null, prev.n),
        tour ? (prev.by ? ` · trouvé par ${prev.by === me ? "toi" : nameOf(ctx, prev.by)}` : " · personne ne l'a trouvé") : null)
      : null;

    // ---------- jauge de l'intervalle
    const pct = (v) => ((v - 1) / Math.max(1, s.max - 1)) * 100;
    const gauge = h("div", { class: "g-nombre-gauge" },
      h("div", { class: "g-nombre-zone", style: { left: pct(lo) + "%", width: Math.max(1.2, pct(hi) - pct(lo)) + "%" } }),
      gs.map((g) => { const hv = hint(s, g); return h("i", { class: "g-nombre-mark " + (hv > 0 ? "lo" : hv < 0 ? "hi" : "ok"), style: { left: pct(g) + "%" }, title: String(g) }); }));
    const found = tour ? false : status === "found";
    const rangeTxt = found ? h("div", { class: "g-nombre-range ok" }, `C'était bien ${s.secret} !`)
      : status === "out" ? h("div", { class: "g-nombre-range" }, `Le nombre était ${s.secret}`)
        : h("div", { class: "g-nombre-range" }, lo === hi ? `C'est forcément ${lo} !` : h("span", null, "Entre ", h("b", null, lo), " et ", h("b", null, hi)));

    // ---------- dernier indice
    let fb = null;
    if (flash) {
      const who2 = tour && s.shared.length ? s.shared[s.shared.length - 1].id : me;
      const by = tour ? (who2 === me ? "Toi" : nameOf(ctx, who2)) + " : " : "";
      fb = h("div", { class: "g-nombre-fb " + (flash.hv > 0 ? "lo" : flash.hv < 0 ? "hi" : "ok") + (flash.fresh ? " anim" : "") },
        h("span", { class: "g-nombre-fbn" }, by, flash.g),
        h("span", null, flash.hv > 0 ? "C'est plus grand ⬆" : flash.hv < 0 ? "C'est plus petit ⬇" : "Bravo, trouvé ! 🎉"));
      flash.fresh = false;
    }

    // ---------- saisie
    const canType = mine && !s.done;
    const display = h("div", { class: "g-nombre-display" + (shake ? " shake" : "") + (canType ? "" : " off") }, typed || h("span", { class: "dim" }, canType ? "?" : "…"));
    const pad = h("div", { class: "g-nombre-pad" },
      ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "OK"].map((c) => h("button", {
        class: "g-nombre-k" + (c === "OK" ? " go" : c === "⌫" ? " del" : ""), disabled: !canType, "aria-label": c === "⌫" ? "Effacer" : c === "OK" ? "Valider" : c,
        onclick: () => (c === "OK" ? submit(ctx) : key(ctx, c)) }, c)));

    // ---------- historique
    const histList = tour ? s.shared.slice().reverse() : gs.slice().reverse().map((g) => ({ id: me, g }));
    const hist = histList.length ? h("div", { class: "g-nombre-hist" }, histList.map((x) => {
      const hv = hint(s, x.g);
      return h("span", { class: "g-nombre-chip " + (hv > 0 ? "lo" : hv < 0 ? "hi" : "ok") }, tour ? h("small", null, x.id === me ? "toi" : nameOf(ctx, x.id)) : null, h("b", null, x.g), hv > 0 ? " ⬆" : hv < 0 ? " ⬇" : " ✓");
    })) : null;

    // ---------- les autres (course) : seulement leur avancée, jamais leurs nombres
    const others = !tour && s.ids.length > 1 ? h("div", { class: "g-nombre-others" }, s.ids.filter((id) => id !== me).map((id) => {
      const st = s.status[id], n = s.boards[id].length;
      return h("div", { class: "g-nombre-op " + st },
        h("div", { class: "g-nombre-opn" }, nameOf(ctx, id)),
        h("div", { class: "small" }, st === "found" ? `✓ en ${n}` : st === "out" ? "✗ raté" : `${n} essai${n > 1 ? "s" : ""}…`),
        h("div", { class: "g-nombre-dots" }, Array.from({ length: Math.min(n, lim) }, () => h("i"))));
    })) : null;

    el.replaceChildren(head, turn, prevBox, h("div", { class: "g-nombre-board" }, rangeTxt, gauge,
      h("div", { class: "g-nombre-scale small dim" }, h("span", null, "1"), h("span", null, String(s.max)))), fb, display, pad, hist, others);
  }

  update(ctx0);
  return { update, destroy() { window.removeEventListener("keydown", phys); } };
}
