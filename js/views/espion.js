import { h } from "../ui.js";
import { toAct, active, isSpy, placeOf, winners } from "../games/espion.js";
import { PLACES, QUESTIONS } from "../data/espion_lieux.js";
import { roleCard, chrono, chatPanel, pickGrid, banner, who } from "../games/lib/roles_view.js";

export const scoreOf = (s, id) => (s.winner && isSpy(s, id) ? "🕶️" : s.out && s.out.includes(id) ? "🕶️" : null);
export const scoreLabel = (sc, st, id) => `${sc ? "Gagné" : "Perdu"}${st && st.spies ? (st.spies.includes(id) ? " · Espion" : " · " + st.roles[id]) : ""}`;

export function mount(root, ctx0) {
  const P = "g-espion";
  const el = h("div", { class: P });
  root.append(el);
  const card = roleCard();
  const clock = chrono();
  let ctx = ctx0, mode = "", sel = null, panel = "", timeupSent = -1;
  const chat = chatPanel({ max: 80, placeholder: "Un commentaire ?", onSend: (t) => ctx.act({ type: "say", text: t }) });
  const top = h("div", { class: `${P}-top` });
  const main = h("div", { class: `${P}-main` });
  const input = h("input", { class: "input", maxlength: 90, autocomplete: "off", enterkeyhint: "send" });
  const send = h("button", { class: "btn green", type: "submit" }, "Envoyer");
  const idea = h("button", { class: "btn ghost small", type: "button", onclick: () => { input.value = ctx.state && mode === "ask" ? QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)] : ""; input.focus(); } }, "💡 Une idée de question");
  const etitle = h("div", { class: `${P}-etitle` });
  const entry = h("form", { class: `${P}-entry` }, etitle, h("div", { class: `${P}-erow` }, input, send), idea);
  entry.addEventListener("submit", (e) => {
    e.preventDefault();
    const t = input.value.trim();
    if (!t) return;
    if (mode === "ask") { if (!sel) { ctx.toast("Choisis d'abord qui interroger", "err"); return; } ctx.act({ type: "ask", target: sel, text: t }); }
    else if (mode === "answer") ctx.act({ type: "answer", text: t });
    ctx.sfx.ok();
    input.value = "";
  });
  el.append(top, main, entry, chat.el);
  // l'hôte signale la fin du temps si personne ne joue
  const tick = setInterval(() => {
    const s = ctx.state;
    if (!s || s.winner || !s.endsAt || !["ask", "answer"].includes(s.phase) || !ctx.isHost) return;
    if (Date.now() > s.endsAt + 800 && timeupSent !== s.seq) { timeupSent = s.seq; ctx.act({ type: "timeup" }); }
  }, 1000);

  function update(c) {
    ctx = c;
    const s = c.state, me = c.me;
    const mine = toAct(s).includes(me);
    const spy = isSpy(s, me);
    const pl = placeOf(s);
    card.set({ id: me + ":" + (s.round || 0), emoji: spy ? "🕶️" : pl.emoji, title: spy ? "Tu es l'espion" : pl.name, color: spy ? "#111827" : "#0F766E",
      sub: spy ? "Tu ne connais pas le lieu" : "Ton rôle : " + s.roles[me],
      text: spy ? "Écoute les réponses, fonds-toi dans le groupe et devine le lieu avant d'être démasqué." : "Réponds de façon à prouver que tu connais le lieu, sans le dévoiler à l'espion." });
    card.el.classList.toggle("mini", s.phase !== "role");
    clock.set(s.endsAt && !s.winner && s.phase !== "role" ? s.endsAt : 0, "");
    const PH = { role: "Découvre ta carte", ask: "Interrogatoire", answer: "Interrogatoire", accuse: "Accusation !", final: "Vote final", last: "Dernière chance", end: "Fin de partie" };
    top.replaceChildren(h("div", { class: `${P}-ph` }, PH[s.phase] || "", s.qn ? h("span", { class: "dim small" }, ` · ${s.qn} question${s.qn > 1 ? "s" : ""}`) : null), clock.el);
    if (!["ask", "answer"].includes(s.phase)) panel = "";

    const body = [];
    const news = s.news.length ? h("div", { class: `${P}-news` }, s.news.map((t) => h("div", null, t))) : null;
    const waitTxt = () => { const l = toAct(s).filter((id) => id !== me); return h("div", { class: "turnmsg" }, l.length ? `On attend ${l.map((id) => who(c, id)).join(", ")}…` : ""); };
    const act = (a) => { c.sfx.tap(); c.act(a); };
    mode = "";
    const placeGrid = (onPick) => h("div", { class: `${P}-places` }, s.list.map((i) => h("button", { class: `${P}-place` + (!spy && i === s.place && s.phase !== "end" ? " here" : "") + (s.phase === "end" && i === s.place ? " here" : ""), disabled: !onPick, onclick: onPick ? () => onPick(i) : null }, h("span", null, PLACES[i].emoji), PLACES[i].name)));

    if (s.phase === "role") {
      body.push(banner("🃏", "Ta carte secrète", "Retourne-la sans la montrer : lieu et rôle, ou espion !"), card.el,
        mine ? h("button", { class: "btn green block big", onclick: () => act({ type: "ready" }) }, "J'ai vu, on commence") : waitTxt());
    } else if (s.phase === "ask" || s.phase === "answer") {
      if (s.phase === "ask") {
        body.push(banner("❓", mine ? "À toi d'interroger !" : `${who(c, s.asker)} prépare une question…`, mine ? "Choisis un joueur, puis pose une question courte." : "Écoute bien les réponses."));
        if (mine && !panel) {
          if (sel && (sel === me || !active(s).includes(sel))) sel = null;
          body.push(pickGrid(c, active(s).filter((id) => id !== me).map((id) => ({ id, off: id === s.prev && active(s).length > 2, sub: id === s.prev && active(s).length > 2 ? "vient de t'interroger" : "" })), { selected: sel, onPick: (id) => { sel = id; c.sfx.tap(); update(ctx); } }));
          mode = "ask";
        }
      } else {
        const q = [...s.chat].reverse().find((m) => m.k === "q");
        body.push(h("div", { class: `${P}-q` }, h("div", { class: "small dim" }, `${who(c, s.asker)} demande à ${s.target === me ? "toi" : who(c, s.target)} :`), h("div", { class: `${P}-qt` }, "« " + (q ? q.t : "…") + " »")));
        if (mine && !panel) mode = "answer";
        else if (!mine) body.push(waitTxt());
      }
      // actions possibles à tout moment
      const can = [];
      if (!s.out.includes(me) && !s.accUsed[me]) can.push(h("button", { class: "btn red small grow", onclick: () => { panel = panel === "acc" ? "" : "acc"; update(ctx); } }, panel === "acc" ? "Annuler" : "☝️ Accuser"));
      if (spy && !s.out.includes(me)) can.push(h("button", { class: "btn gold small grow", onclick: () => { panel = panel === "guess" ? "" : "guess"; update(ctx); } }, panel === "guess" ? "Annuler" : "🕶️ Deviner le lieu"));
      if (can.length) body.push(h("div", { class: `row gap ${P}-acts` }, can));
      if (panel === "acc") body.push(banner("☝️", "Qui accuses-tu ?", "Une seule accusation par partie. Il faut l'unanimité.", "bad"), pickGrid(c, active(s).filter((id) => id !== me).map((id) => ({ id })), { onPick: (id) => { panel = ""; act({ type: "accuse", target: id }); } }));
      if (panel === "guess") body.push(banner("🕶️", "Tu te dévoiles !", "Choisis le lieu. Juste : tu gagnes. Faux : tu perds.", "wolf"), placeGrid((i) => { panel = ""; act({ type: "guess", place: i }); }));
    } else if (s.phase === "accuse") {
      const v = s.vote;
      body.push(news);
      if (mine) body.push(h("div", { class: `row gap ${P}-acts` }, h("button", { class: "btn green grow big", onclick: () => act({ type: "vote", target: "oui" }) }, "Oui, c'est l'espion"), h("button", { class: "btn ghost grow big", onclick: () => act({ type: "vote", target: "non" }) }, "Non")));
      else body.push(waitTxt(v && !v.voters.includes(me) ? "" : null));
    } else if (s.phase === "final") {
      const b = s.vote ? s.vote.b : {};
      body.push(news, banner("🗳️", "Qui est l'espion ?", mine ? "Vote pour le joueur le plus suspect." : "Vote enregistré."));
      if (s.vote && s.vote.voters.includes(me)) body.push(pickGrid(c, active(s).filter((id) => id !== me).map((id) => ({ id, tag: id in b ? "✓ a voté" : "" })), { selected: b[me], onPick: mine ? (id) => act({ type: "vote", target: id }) : null }));
      body.push(waitTxt());
    } else if (s.phase === "last") {
      body.push(news, banner("🎯", mine ? "Démasqué ! Dernière chance" : `${who(c, s.guesser)} tente de deviner le lieu…`, mine ? "Trouve le lieu pour gagner quand même." : "S'il trouve, l'espion gagne."));
      if (mine) body.push(placeGrid((i) => act({ type: "guess", place: i })));
    } else if (s.phase === "end") {
      const iWin = winners(s).includes(me);
      body.push(banner(iWin ? "🏆" : "😶", iWin ? "Victoire !" : "Défaite…", `Lieu : ${pl.name} ${pl.emoji} · Espion : ${s.spies.map((id) => who(c, id)).join(", ")}`, iWin ? "win" : "bad"), news);
    }
    if (s.phase !== "role") body.push(card.el);
    if (s.phase !== "role" && panel !== "guess" && s.phase !== "last") body.push(h("details", { class: `${P}-list`, open: spy && s.phase !== "end" ? true : null }, h("summary", null, `🗺️ Les ${s.list.length} lieux possibles`), placeGrid(null)));
    main.replaceChildren(...body);

    entry.style.display = mode ? "" : "none";
    idea.style.display = mode === "ask" ? "" : "none";
    etitle.textContent = mode === "ask" ? (sel ? `Ta question pour ${who(c, sel)}` : "Choisis un joueur ci-dessus") : "Ta réponse (courte)";
    input.placeholder = mode === "ask" ? "Ex. : Tu viens souvent ici ?" : "Réponds sans trop en dire…";
    const canSay = !["role", "end", "last"].includes(s.phase);
    chat.set(c, s.chat, { canSay, help: canSay ? "2 commentaires par question." : "",
      render: (m) => ({ cls: m.k, from: m.f ? who(c, m.f) + (m.k === "q" && m.to ? " → " + who(c, m.to) : "") : "", text: m.t }) });
  }

  update(ctx0);
  return { update, destroy() { clock.destroy(); clearInterval(tick); } };
}
