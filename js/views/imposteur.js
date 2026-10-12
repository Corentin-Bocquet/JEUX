import { h } from "../ui.js";
import { toAct, alive, isAlive, wordOf, winners, clueError, ROLE_NAME } from "../games/imposteur.js";
import { roleCard, chrono, chatPanel, pickGrid, banner, who } from "../games/lib/roles_view.js";

export const scoreOf = (s, id) => (s.dead && s.dead.includes(id) ? "❌" : null);
export const scoreLabel = (sc, st, id) => `${sc ? "Gagné" : "Perdu"}${st && st.roles ? " · " + ROLE_NAME[st.roles[id]] : ""}`;

export function mount(root, ctx0) {
  const P = "g-imposteur";
  const el = h("div", { class: P });
  root.append(el);
  const card = roleCard();
  const clock = chrono();
  let ctx = ctx0, mode = "";
  const chat = chatPanel({ max: 80, placeholder: "Discute, accuse, défends-toi…", onSend: (t) => ctx.act({ type: "say", text: t }) });
  const top = h("div", { class: `${P}-top` });
  const main = h("div", { class: `${P}-main` });
  // saisie persistante (indice ou mot deviné) : elle n'est jamais reconstruite pour garder le focus
  const input = h("input", { class: "input", maxlength: 24, autocomplete: "off", autocapitalize: "off", enterkeyhint: "send" });
  const send = h("button", { class: "btn green", type: "submit" }, "Valider");
  const pass = h("button", { class: "btn ghost small", type: "button", onclick: () => { ctx.sfx.tap(); ctx.act({ type: "clue", pass: true }); } }, "Passer");
  const entryTitle = h("div", { class: `${P}-etitle` });
  const entry = h("form", { class: `${P}-entry` }, entryTitle, h("div", { class: `${P}-erow` }, input, send), pass);
  entry.addEventListener("submit", (e) => {
    e.preventDefault();
    const s = ctx.state, t = input.value.trim();
    if (mode === "clue") {
      const err = clueError(s, ctx.me, t);
      if (err) { ctx.toast(err, "err"); ctx.sfx.bad(); return; }
      ctx.act({ type: "clue", word: t });
    } else if (mode === "guess") { if (!t) return; ctx.act({ type: "guess", word: t }); }
    ctx.sfx.ok();
    input.value = "";
  });
  el.append(top, main, entry, chat.el);

  function update(c) {
    ctx = c;
    const s = c.state, me = c.me;
    const mine = toAct(s).includes(me);
    const myWord = wordOf(s, me), role = s.roles[me];
    const isBlanc = role === "blanc";
    card.set({ id: me + ":" + (s.round || 0), emoji: isBlanc ? "⬜" : "🔤", title: isBlanc ? "Mister blanc" : myWord, color: isBlanc ? "#475569" : "#7E22CE",
      sub: isBlanc ? "Tu n'as pas de mot" : "Ton mot secret",
      text: isBlanc ? "Écoute les indices, bluffe, et si tu es éliminé, devine le mot des civils." : "Donne des indices sans le dire. Attention : quelqu'un a un mot différent… peut-être toi !" });
    card.el.classList.toggle("mini", s.phase !== "role");
    clock.set(s._dl || 0);
    const PH = { role: "Découvre ton mot", clue: `Indices · tour ${s.cycle}`, vote: "Vote", guess: "Mister blanc devine", end: "Fin de partie" };
    top.replaceChildren(h("div", { class: `${P}-ph` }, PH[s.phase] || ""), clock.el);

    const body = [];
    const news = s.news.length ? h("div", { class: `${P}-news` }, s.news.map((t) => h("div", null, t))) : null;
    const waitTxt = () => { const l = toAct(s).filter((id) => id !== me); return h("div", { class: "turnmsg" }, l.length ? `On attend ${l.map((id) => who(c, id)).join(", ")}…` : ""); };
    if (!isAlive(s, me) && s.phase !== "end") body.push(h("div", { class: `${P}-ghost` }, "❌ Tu es éliminé : regarde la suite."));
    mode = "";
    if (s.phase === "role") {
      body.push(banner("🃏", "Ton mot secret", "Retourne ta carte sans la montrer à personne."), card.el,
        mine ? h("button", { class: "btn green block big", onclick: () => { c.sfx.tap(); c.act({ type: "ready" }); } }, "J'ai vu, je suis prêt") : waitTxt());
    } else if (s.phase === "clue") {
      const cur = s.order[s.turn];
      body.push(news, banner("💬", mine ? "À toi de donner un indice !" : `${who(c, cur)} cherche un indice…`, mine ? "Un seul mot, sans dire ton mot." : `Tour ${s.lap} sur ${s.tours} avant le vote.`, mine ? "me" : ""));
      if (mine) mode = "clue";
    } else if (s.phase === "vote") {
      const b = s.vote ? s.vote.b : {};
      body.push(news, banner("🗳️", "Qui est l'intrus ?", mine ? "Vote pour éliminer le joueur le plus suspect." : "Vote enregistré, on attend les autres."));
      if (isAlive(s, me)) body.push(pickGrid(c, alive(s).filter((id) => id !== me).map((id) => ({ id, sub: cluesOf(s, id), tag: id in b ? "✓ a voté" : "" })), { selected: b[me], onPick: mine ? (id) => { c.sfx.tap(); c.act({ type: "vote", target: id }); } : null }));
      body.push(waitTxt());
    } else if (s.phase === "guess") {
      body.push(news, banner("⬜", mine ? "Dernière chance !" : `${who(c, s.guess.id)} tente de deviner…`, mine ? "Devine le mot des civils pour gagner seul." : "S'il trouve le mot des civils, il gagne."));
      if (mine) mode = "guess";
    } else if (s.phase === "end") {
      const iWin = winners(s).includes(me);
      body.push(banner(iWin ? "🏆" : "😶", iWin ? "Victoire !" : "Défaite…", `Civils : « ${s.words[0]} » · Imposteur : « ${s.words[1]} »`, iWin ? "win" : "bad"));
    }
    if (s.phase !== "role") body.push(card.el);
    body.push(h("div", { class: "g-rl-sect" }, "Les indices"));
    body.push(h("div", { class: `${P}-board` }, s.ids.map((id) => h("div", { class: `${P}-line` + (s.phase === "clue" && s.order[s.turn] === id ? " cur" : "") + (isAlive(s, id) ? "" : " out") },
      h("b", null, who(c, id) + (id === me ? " (toi)" : "")),
      s.phase === "end" || !isAlive(s, id) ? h("span", { class: `${P}-role ${s.roles[id]}` }, ROLE_NAME[s.roles[id]]) : null,
      h("span", { class: `${P}-clues` }, s.clues.filter((x) => x.p === id).map((x) => h("i", { class: x.w ? "" : "pass" }, x.w || "…")))))));
    main.replaceChildren(...body);

    entry.style.display = mode ? "" : "none";
    pass.style.display = mode === "clue" ? "" : "none";
    entryTitle.textContent = mode === "clue" ? "Ton indice (un mot)" : "Le mot des civils ?";
    input.placeholder = mode === "clue" ? "Ex. : soleil" : "Ton idée…";
    const canSay = isAlive(s, me) && s.phase !== "end" && s.phase !== "role";
    chat.set(c, s.chat, { canSay, help: canSay ? "3 messages par tour, sois bref." : "",
      render: (m) => ({ cls: m.k, from: m.f ? who(c, m.f) + (m.k === "clue" ? " 💡" : "") : "", text: m.t }) });
  }
  const cluesOf = (s, id) => s.clues.filter((x) => x.p === id).map((x) => x.w || "…").join(", ");

  update(ctx0);
  return { update, destroy() { clock.destroy(); } };
}
