import { h } from "../ui.js";
import { ROLES, toAct, alive, isAlive, roleLabel, winners } from "../games/loupgarou.js";
import { roleCard, chrono, chatPanel, pickGrid, banner, who } from "../games/lib/roles_view.js";

export const scoreOf = (s, id) => (s.dead && s.dead.includes(id) ? "💀" : null);
export const scoreLabel = (sc, st, id) => (st && st.roles && st.roles[id] ? `${sc ? "Gagné" : "Perdu"} · ${ROLES[st.roles[id]].name}` : sc ? "Gagné" : "Perdu");

const PHASE = { role: "Distribution des rôles", cupid: "Nuit 1 · Cupidon", night: "Nuit", witch: "Nuit · la sorcière", hunter: "Le chasseur", day: "Jour · débat", vote: "Jour · vote", end: "Fin de partie" };

export function mount(root, ctx0) {
  const P = "g-loupgarou";
  const el = h("div", { class: P });
  root.append(el);
  const card = roleCard();
  const clock = chrono();
  let ctx = ctx0, picks = [], poison = "", save = false, lastPhase = "", lastNews = "";
  const chat = chatPanel({ max: 80, placeholder: "Message court au village…", onSend: (t) => ctx.act({ type: "say", text: t }) });
  const top = h("div", { class: `${P}-top` });
  const main = h("div", { class: `${P}-main` });
  el.append(top, main, chat.el);

  function update(c) {
    ctx = c;
    const s = c.state, me = c.me;
    const phaseKey = s.phase + s.night;
    if (phaseKey !== lastPhase) { picks = []; poison = ""; save = false; lastPhase = phaseKey; if (s.phase === "night") c.sfx.card(); }
    const nk = s.news.join("|");
    if (nk !== lastNews) { if (lastNews && s.news.length) c.sfx.bad(); lastNews = nk; }
    const myRole = s.roles[me];
    const R = ROLES[myRole] || ROLES.villageois;
    const mine = toAct(s).includes(me);
    const amAlive = isAlive(s, me);
    const night = ["cupid", "night", "witch"].includes(s.phase);
    el.classList.toggle("night", night);

    // ----- carte : rôle, coéquipiers, découvertes
    const extra = [];
    if (myRole === "loup") { const m = s.ids.filter((id) => id !== me && s.roles[id] === "loup"); if (m.length) extra.push("Ta meute : " + m.map((id) => who(c, id)).join(", ")); }
    if (s.lovers && s.lovers.includes(me)) { const o = s.lovers[0] === me ? s.lovers[1] : s.lovers[0]; extra.push(`💘 Tu es amoureux de ${who(c, o)}`); }
    if (myRole === "voyante" && s.seen.length) extra.push("Vu : " + s.seen.map(([t, r]) => `${who(c, t)} = ${ROLES[r].name}`).join(", "));
    if (myRole === "sorciere") extra.push(`Potions : ${s.potions.life ? "vie ✓" : "vie ✗"} · ${s.potions.death ? "mort ✓" : "mort ✗"}`);
    card.set({ id: me + ":" + (s.round || 0), emoji: R.emoji, title: R.name, color: R.color, sub: R.camp === "loups" ? "Camp des loups" : "Camp du village", text: [R.desc, ...extra].join(" · ") });
    card.el.classList.toggle("mini", s.phase !== "role");

    clock.set(s._dl || 0);
    top.replaceChildren(h("div", { class: `${P}-ph` }, h("span", null, night ? "🌙 " : s.phase === "end" ? "🏁 " : "☀️ "), (PHASE[s.phase] || "") + (["night", "day", "vote"].includes(s.phase) ? " " + s.night : "")), clock.el);

    const body = [];
    if (!amAlive && s.phase !== "end") body.push(h("div", { class: `${P}-ghost` }, "💀 Tu es mort : tu observes la partie en silence."));
    body.push(...phaseView(c, s, me, myRole, mine));
    body.push(card.el);
    body.push(h("div", { class: "g-rl-sect" }, "Le village"));
    body.push(pickGrid(c, s.ids.map((id) => ({ id, dead: !isAlive(s, id), sub: roleShown(s, me, id), off: true }))));
    main.replaceChildren(...body);

    const wolfView = myRole === "loup" || s.phase === "end";
    const canSay = amAlive && (s.phase === "day" || s.phase === "vote" || (s.phase === "night" && myRole === "loup"));
    chat.set(c, s.chat, {
      canSay, help: canSay ? (s.phase === "night" ? "Discussion secrète de la meute." : "Messages courts, 4 par phase.") : "",
      render: (m) => (m.k === "w" && !wolfView ? null : { cls: m.k, from: m.f ? (m.k === "w" ? "🐺 " : "") + who(c, m.f) : "", text: m.t }),
    });
    chat.input.placeholder = s.phase === "night" ? "Message à la meute…" : "Message court au village…";
  }

  function roleShown(s, me, id) {
    if (id === me) return ROLES[s.roles[id]].name;
    if (s.phase === "end" || (s.opts.reveal && !isAlive(s, id))) return ROLES[s.roles[id]].name;
    if (s.roles[me] === "loup" && s.roles[id] === "loup") return "Loup-garou";
    const seen = s.roles[me] === "voyante" && s.seen.find((x) => x[0] === id);
    if (seen) return ROLES[seen[1]].name + " 🔮";
    return isAlive(s, id) ? "" : "Mort";
  }

  function wait(c, s, txt) {
    const left = toAct(s).filter((id) => id !== c.me);
    return h("div", { class: "turnmsg" }, txt || (left.length ? `On attend ${left.map((id) => who(c, id)).join(", ")}…` : "…"));
  }

  function phaseView(c, s, me, myRole, mine) {
    const act = (a) => { c.sfx.tap(); c.act(a); };
    const others = alive(s).filter((id) => id !== me);
    const news = s.news.length ? h("div", { class: `${P}-news` }, s.news.map((t) => h("div", null, t))) : null;
    switch (s.phase) {
      case "role": return [banner("🃏", "Découvre ton rôle", "Retourne ta carte sans la montrer, puis dis que tu es prêt."),
        mine ? h("button", { class: "btn green block big", onclick: () => act({ type: "ready" }) }, "J'ai vu mon rôle, je suis prêt") : wait(c, s)];
      case "cupid": {
        if (!mine) return [banner("💘", "Cupidon se réveille", "Il choisit deux amoureux. Le village dort."), wait(c, s, "Le village dort… 💤")];
        return [banner("💘", "À toi, Cupidon !", "Choisis deux joueurs (toi compris) qui tomberont amoureux."),
          pickGrid(c, s.ids.map((id) => ({ id })), { selected: null, onPick: (id) => { picks = picks.includes(id) ? picks.filter((x) => x !== id) : [...picks, id].slice(-2); update(ctx); } }),
          h("div", { class: "small dim center" }, picks.length ? "Choisis : " + picks.map((id) => who(c, id)).join(" + ") : "Touche deux joueurs"),
          h("button", { class: "btn purple block", disabled: picks.length !== 2, onclick: () => act({ type: "cupid", a: picks[0], b: picks[1] }) }, "Lancer les flèches 💘")].map(markPicks);
      }
      case "night": {
        const out = [];
        if (myRole === "loup" && isAlive(s, me) && s.vote) {
          const b = s.vote.b, counts = {};
          for (const t of Object.values(b)) counts[t] = (counts[t] || 0) + 1;
          out.push(banner("🐺", "La meute chasse", mine ? "Vote avec les autres loups pour choisir la victime." : "Ton vote est fait, la meute décide.", "wolf"));
          out.push(pickGrid(c, s.vote.targets.map((id) => ({ id, tag: counts[id] ? "🐺".repeat(counts[id]) : "" })), { selected: b[me], onPick: mine ? (id) => act({ type: "vote", target: id }) : null }));
        } else if (myRole === "voyante" && isAlive(s, me) && mine) {
          out.push(banner("🔮", "Voyante, à toi", "Choisis un joueur : tu découvriras son vrai rôle."));
          out.push(pickGrid(c, others.map((id) => ({ id })), { onPick: (id) => act({ type: "see", target: id }) }));
        } else {
          const last = myRole === "voyante" && s.seen.length ? s.seen[s.seen.length - 1] : null;
          out.push(banner("🌙", `Nuit ${s.night}`, last && s.seerDone ? `Ta vision : ${who(c, last[0])} est ${roleLabel(last[1])}.` : "Le village dort. Les loups rôdent…"));
          out.push(wait(c, s, "Chut… la nuit est en cours 💤"));
        }
        return out;
      }
      case "witch": {
        if (!mine) return [banner("🧪", "La sorcière se réveille", "Elle prépare ses potions…"), wait(c, s, "Le village dort… 💤")];
        const out = [banner("🧪", "Sorcière, à toi", s.victim ? `Les loups ont attaqué ${who(c, s.victim)}.` : "Les loups n'ont attaqué personne.")];
        if (s.potions.life && s.victim) out.push(h("button", { class: "btn block " + (save ? "green" : "ghost"), onclick: () => { save = !save; if (save && poison === s.victim) poison = ""; update(ctx); } }, save ? `✓ Je sauve ${who(c, s.victim)}` : `Potion de vie : sauver ${who(c, s.victim)}`));
        if (s.potions.death) {
          out.push(h("div", { class: "g-rl-sect" }, "Potion de mort (facultatif)"));
          out.push(pickGrid(c, others.filter((id) => !(save && id === s.victim)).map((id) => ({ id })), { selected: poison, onPick: (id) => { poison = poison === id ? "" : id; update(ctx); } }));
        }
        out.push(h("button", { class: "btn purple block", onclick: () => act({ type: "witch", save, kill: poison }) }, save || poison ? "Valider mes potions" : "Ne rien faire cette nuit"));
        return out;
      }
      case "hunter": {
        if (!mine) return [news, banner("🏹", "Le chasseur est tombé", `${who(c, s.hunter)} tire sa dernière balle…`), wait(c, s)];
        return [news, banner("🏹", "Dernière balle !", "Tu es mort, mais tu emportes quelqu'un avec toi. Choisis bien."),
          pickGrid(c, others.map((id) => ({ id })), { onPick: (id) => act({ type: "shoot", target: id }) })];
      }
      case "day": return [news, banner("☀️", `Jour ${s.night} : le débat`, "Accuse, défends-toi, puis passe au vote."),
        mine ? h("button", { class: "btn gold block", onclick: () => act({ type: "ready" }) }, "Passer au vote 🗳️") : wait(c, s)];
      case "vote": {
        const b = s.vote ? s.vote.b : {};
        const voted = s.vote ? s.vote.voters.filter((id) => id in b) : [];
        const out = [news, banner("🗳️", "Vote du village", mine ? "Qui élimines-tu ? Égalité : personne ne sort." : "Ton vote est enregistré.")];
        if (isAlive(s, me) && s.vote) {
          out.push(pickGrid(c, others.map((id) => ({ id, tag: voted.includes(id) ? "✓ a voté" : "" })), { selected: b[me], onPick: mine ? (id) => act({ type: "vote", target: id }) : null }));
          if (mine) out.push(h("button", { class: "btn ghost block", onclick: () => act({ type: "vote", target: "" }) }, "Je ne vote contre personne"));
        }
        out.push(wait(c, s, mine ? " " : null));
        return out;
      }
      case "end": {
        const win = winners(s);
        const iWin = win.includes(me);
        return [banner(iWin ? "🏆" : "💀", iWin ? "Victoire !" : "Défaite…", s.news[s.news.length - 1] || "", iWin ? "win" : ""), news];
      }
    }
    return [];
  }
  function markPicks(x) {
    if (x && x.classList && x.classList.contains("g-rl-grid")) for (const b of x.children) { const i = [...x.children].indexOf(b); b.classList.toggle("sel", picks.includes(ctx.state.ids[i])); }
    return x;
  }

  update(ctx0);
  return { update, destroy() { clock.destroy(); } };
}
