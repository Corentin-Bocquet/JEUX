import { h } from "../ui.js";
import { nameOf } from "./common.js";
import { FILMS, CATS, current, maxTries, maxHints, hintText, HINT_COST, BASE } from "../games/emojifilm.js";

export const scoreOf = (s, id) => s.scores[id];
export const scoreLabel = (sc) => `${sc} pts`;

export function mount(root, ctx0) {
  const el = h("div", { class: "g-emojifilm" });
  root.append(el);
  let zoneKey = "", cardKey = "", cardEl = null, input = null, lastSt = "", lastRound = 0;

  function update(ctx) {
    const s = ctx.state;
    const me = s.p && s.p[ctx.me];
    const st = me ? me.st + ":" + me.tries.length : "";
    if (s.roundNo === lastRound && st !== lastSt && me) {
      if (me.st === "found") ctx.sfx.win();
      else if (me.tries.length) ctx.sfx.bad();
    }
    if (s.roundNo !== lastRound) ctx.sfx.card();
    lastSt = st; lastRound = s.roundNo;
    draw(ctx);
  }

  function draw(ctx) {
    const s = ctx.state;
    const cur = current(s);
    const f = FILMS[cur];
    const me = s.p[ctx.me];
    const reveal = s.phase === "reveal";
    const head = h("div", { class: "g-emojifilm-head" },
      h("span", { class: "chip" }, `Manche ${s.roundNo} / ${s.rounds}`),
      h("span", { class: "chip" }, s.cat === "tout" ? "🎬 Tout" : CATS[s.cat] + "s"),
      h("span", { class: "chip" }, "⭐ ", h("b", null, s.scores[ctx.me] ?? 0)));
    const ck = s.roundNo + "|" + s.phase;
    const card = ck === cardKey && cardEl ? cardEl : h("div", { class: "g-emojifilm-card" + (reveal ? " reveal" : "") },
      h("div", { class: "g-emojifilm-emo", "aria-label": "Émojis à deviner" }, f[4]),
      reveal ? h("div", { class: "g-emojifilm-title" }, f[0], h("small", null, `${CATS[f[2]]} · ${f[3]} · ${f[1]}`)) : null);
    cardKey = ck; cardEl = card;

    // indices révélés (chacun voit les siens)
    const hints = me && me.hints && !reveal ? h("div", { class: "g-emojifilm-hints" },
      Array.from({ length: me.hints }, (_, k) => h("div", { class: "g-emojifilm-hint" }, "💡 ", hintText(cur, k)))) : null;

    const others = h("div", { class: "g-emojifilm-others" }, s.ids.map((id) => {
      const p = s.p[id];
      const ico = p.st === "found" ? "✅" : p.st === "out" ? "❌" : reveal ? "" : "💭";
      return h("div", { class: "g-emojifilm-pl " + p.st + (id === ctx.me ? " me" : "") },
        h("span", null, nameOf(ctx, id)), h("b", null, reveal ? (p.pts ? `+${p.pts}` : "0") : ico),
        reveal && s.ready.includes(id) ? h("i", null, "prêt") : null);
    }));

    const key = [s.roundNo, s.phase, me && me.st, me && me.tries.length, me && me.hints, s.answer].join("|");
    let zone = el.querySelector(".g-emojifilm-zone");
    if (key !== zoneKey || !zone) {
      const hadFocus = input && document.activeElement === input;
      zone = buildZone(ctx);
      zoneKey = key;
      if (hadFocus && input) setTimeout(() => input && input.focus(), 0);
    } else zone.remove();
    el.replaceChildren(head, card, hints, zone, others);
  }

  function buildZone(ctx) {
    const s = ctx.state;
    const cur = current(s);
    const me = s.p[ctx.me];
    input = null;
    const z = h("div", { class: "g-emojifilm-zone" });
    if (s.phase === "reveal") {
      const ready = s.ready.includes(ctx.me);
      const msg = me.st === "found" ? `Bravo, +${me.pts} points !` : `C'était « ${FILMS[cur][0]} ».`;
      z.append(h("div", { class: "turnmsg " + (me.st === "found" ? "me" : "") }, msg),
        ready ? h("div", { class: "small dim center" }, "On attend les autres…")
          : h("button", { class: "btn green block", onclick: () => { ctx.sfx.tap(); ctx.act({ type: "next" }); } }, s.roundNo >= s.rounds ? "Voir le classement" : "Manche suivante"));
      return z;
    }
    if (me.st !== "playing") {
      z.append(h("div", { class: "turnmsg " + (me.st === "found" ? "me" : "") },
        me.st === "found" ? `Trouvé ! +${me.pts} points. On attend les autres…` : "Raté pour cette fois. On attend les autres…"));
      return z;
    }
    const left = maxTries(s) - me.tries.length;
    const pts = Math.max(0, BASE - HINT_COST * me.hints);
    z.append(h("div", { class: "turnmsg me" }, s.answer === "qcm" ? "Quel est ce titre ?" : "Tape le titre !"),
      h("div", { class: "small dim center" }, `Vaut ${pts} points · ${left} essai${left > 1 ? "s" : ""}`));
    if (s.answer === "qcm") {
      z.append(h("div", { class: "g-emojifilm-qcm" }, s.choices.map((c) =>
        h("button", { class: "g-emojifilm-choice", onclick: () => { ctx.sfx.tap(); ctx.act({ type: "choice", i: c }); } }, FILMS[c][0]))));
    } else {
      input = h("input", { class: "input", placeholder: "Titre du film, de la série…", autocomplete: "off", autocapitalize: "sentences",
        enterkeyhint: "send", maxlength: "80", "aria-label": "Ta réponse",
        onkeydown: (e) => { if (e.key === "Enter") send(ctx); } });
      z.append(h("div", { class: "g-emojifilm-form" }, input, h("button", { class: "btn green", onclick: () => send(ctx) }, "Valider")));
      if (me.tries.length) z.append(h("div", { class: "g-emojifilm-tries" }, me.tries.map((t) => h("s", null, t))));
    }
    const tools = h("div", { class: "row gap center g-emojifilm-tools" },
      me.hints < maxHints(s) ? h("button", { class: "btn gold small", onclick: () => { ctx.sfx.coin(); ctx.act({ type: "hint" }); } }, `💡 Indice (-${HINT_COST})`) : null,
      h("button", { class: "btn ghost small", onclick: () => { ctx.sfx.tap(); ctx.act({ type: "pass" }); } }, "Je passe"));
    z.append(tools);
    return z;
  }

  function send(ctx) {
    if (!input) return;
    const v = input.value.trim();
    if (!v) { ctx.toast("Écris un titre", "err"); return; }
    input.value = "";
    ctx.act({ type: "guess", text: v });
  }

  update(ctx0);
  return { update, destroy() {} };
}
