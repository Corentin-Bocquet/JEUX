// Salon : attente des joueurs, partie, résultats. Sert aussi aux parties solo (magasin local).
import { h, icon, tile, gem, toast, sfx, buzz, sheet, confirmBox, confetti, copy, fmt, countUp } from "../ui.js";
import { avatarHTML } from "../avatar.js";
import { gameInfo, loadGame, loadView } from "../games/index.js";
import { RoomCtl, localStore, makeBot } from "../rooms.js";
import { equipOf } from "../catalog.js";
import { gameOptions, picker, carousel, summary, restore, modeOf } from "./settings.js";
import { pickPlayers, sendInvites, resetTogether } from "./invite.js";

export async function render(A, main, { route, args }) {
  const solo = route === "solo";
  let store, room;
  main.append(h("div", { class: "empty", style: { paddingTop: "30vh" } }, "Chargement…"));
  try {
    if (solo) {
      const cfg = JSON.parse(sessionStorage.getItem("jeux.solo") || "null");
      if (!cfg || cfg.id !== args[0]) { A.go("/"); return; }
      store = localStore(A.api.uid);
      const g = gameInfo(cfg.id);
      room = await store.create(cfg.id, g.max, cfg.settings, A.me());
      const players = [room.players[0]];
      for (let i = 0; i < cfg.bots; i++) players.push(makeBot(players.map((p) => p.name)));
      room = (await store.update(room.id, room.version, { players })).room;
    } else {
      store = A.api.rooms;
      room = await store.join(args[0], A.me());
    }
  } catch (e) {
    toast(e.message, "err");
    A.go("/");
    return;
  }
  const [game, view] = await Promise.all([loadGame(room.game), loadView(room.game)]);
  const info = gameInfo(room.game);
  const me = A.api.uid;
  let mounted = null, resultSheet = null, claimedRound = null, lastToAct = false, phase = null, gone = false;

  const ctl = new RoomCtl({
    store, room, me, game,
    onChange: (r) => draw(r),
    onError: (e) => { sfx.bad(); toast(e.message, "err"); },
  });

  const bar = h("div", { class: "gbar" });
  const strip = h("div", { class: "players" });
  const timer = h("div", { class: "timer", style: { visibility: "hidden" } }, h("i"));
  const stage = h("div", { class: "stage" });
  main.replaceChildren(bar, strip, timer, stage);

  const leave = async () => {
    const r = ctl.room;
    if (r && r.status === "playing" && !solo) {
      if (!(await confirmBox("Quitter la partie ? Un robot jouera à ta place.", { ok: "Quitter", danger: true }))) return;
    }
    gone = true;
    try { if (!solo && r) await store.leave(r.id); } catch {}
    A.go("/");
  };
  const help = () => sheet(h("ol", { class: "rules" }, game.meta.rules.map((x) => h("li", null, x))), { title: game.meta.name });
  // règles obligatoires la toute première fois qu'on joue à ce jeu
  const seenKey = "jeux.regles." + me;
  const seen = () => { try { return JSON.parse(localStorage.getItem(seenKey) || "[]"); } catch { return []; } };
  const firstTime = () => !((A.profile.stats || {})[room.game] || {}).p && !seen().includes(room.game);
  const showRules = () => new Promise((done) => {
    const ok = h("button", { class: "btn green block" }, "J'ai compris, on joue !");
    const s = sheet(h("div", { class: "stack" },
      h("p", { class: "lead small" }, "Première partie : voici les règles. Tu pourras les revoir à tout moment avec le bouton i."),
      h("ol", { class: "rules" }, game.meta.rules.map((x) => h("li", null, x))), ok), { title: "Règles : " + game.meta.name, onClose: () => done() });
    ok.onclick = () => {
      try { localStorage.setItem(seenKey, JSON.stringify([...seen(), room.game])); } catch {}
      s.close();
    };
  });

  function drawBar(r) {
    const done = r.status === "done" && r.state && r.state.result;
    bar.replaceChildren(
      h("button", { class: "iconbtn glass", "aria-label": "Quitter", onclick: leave }, icon("retour", 22)),
      h("div", { class: "ttl" }, game.meta.short || game.meta.name),
      done ? h("button", { class: "btn small gold", onclick: () => { resultSheet = null; drawResult(ctl.room); } }, "Résultats") : null,
      h("button", { class: "iconbtn glass", "aria-label": "Règles", onclick: help }, icon("info", 22)));
  }

  function playerMap(r) { return Object.fromEntries(r.players.map((p) => [p.id, p])); }

  function drawStrip(r) {
    const st = r.state;
    const who = st && !st.result ? game.toAct(st) : [];
    const ids = r.players.map((p) => p.id);
    strip.replaceChildren(...ids.map((id) => {
      const p = r.players.find((x) => x.id === id);
      const sc = st && view.scoreOf ? view.scoreOf(st, id) : null;
      return h("div", { class: "pchip glass" + (who.includes(id) && who.length < ids.length ? " turn" : "") + (id === me ? " me" : "") + (p.left ? " left" : "") },
        h("div", { class: "av", html: avatarHTML(p, 34) }),
        h("span", { class: "nm" }, p.name),
        sc != null ? h("span", { class: "sc" }, sc) : null);
    }));
  }

  // ---------------- salle d'attente
  // invitations que j'ai envoyées pour ce salon (en attente / refusées), relues régulièrement
  let sent = [], sentKey = "", sentTimer = null, autoTimer = null, autoAt = 0;
  const pollSent = async () => {
    const r = ctl.room;
    if (!r || r.status !== "lobby" || gone) return;
    try {
      const list = (await A.api.sentInvites(r.id)).filter((i) => !r.players.some((p) => p.id === i.to));
      const key = JSON.stringify(list.map((i) => [i.to, i.status]));
      if (key !== sentKey) { sent = list; sentKey = key; if (ctl.room && ctl.room.status === "lobby") drawLobby(ctl.room); }
    } catch {}
  };
  const startPoll = () => { if (!sentTimer) { pollSent(); sentTimer = setInterval(pollSent, 2500); } };
  const stopPoll = () => { clearInterval(sentTimer); sentTimer = null; clearTimeout(autoTimer); autoTimer = null; autoAt = 0; };

  async function invitePlayers() {
    const r = ctl.room;
    const host = r.host === me;
    const pending = sent.filter((i) => i.status === "pending").length;
    const pick = await pickPlayers(A, { free: r.max_players - r.players.length - pending, allowBots: host, exclude: [...r.players.map((p) => p.id), ...sent.filter((i) => i.status === "pending").map((i) => i.to)] });
    if (!pick) return;
    try {
      if (pick.bots) await ctl.patch((x) => {
        const add = [];
        for (let i = 0; i < pick.bots && x.players.length + add.length < x.max_players; i++) add.push(makeBot([...x.players, ...add].map((p) => p.name)));
        return add.length ? { players: [...x.players, ...add] } : null;
      });
      const n = await sendInvites(A, r.id, pick);
      if (n) { toast(n > 1 ? `${n} invitations envoyées !` : "Invitation envoyée !", "ok"); sfx.ok(); }
      // l'hôte qui invite depuis le salon active le lancement automatique
      if (n && host && !(ctl.room.settings || {}).auto) await ctl.patch((x) => ({ settings: { ...(x.settings || {}), auto: true } })).catch(() => {});
      resetTogether();
      sentKey = ""; pollSent();
    } catch (e) { toast(e.message, "err"); }
  }

  // lancement automatique : tous les invités ont répondu et au moins un ami est là
  function autoStart(r) {
    const host = r.host === me;
    sent = sent.filter((i) => !r.players.some((p) => p.id === i.to));
    const pending = sent.filter((i) => i.status === "pending").length;
    const humans = r.players.filter((p) => !p.bot && !p.left).length;
    const ready = host && (r.settings || {}).auto && !pending && humans >= 2 && r.players.length >= info.min;
    if (!ready) { clearTimeout(autoTimer); autoTimer = null; autoAt = 0; return null; }
    if (!autoTimer) {
      autoAt = Date.now() + 3000;
      autoTimer = setTimeout(() => { autoTimer = null; if (!gone && ctl.room && ctl.room.status === "lobby") { sfx.ok(); ctl.begin(); } }, 3000);
    }
    return h("div", { class: "autostart" }, "🚀 Tout le monde est là ! La partie démarre…");
  }

  function drawLobby(r) {
    timer.style.visibility = "hidden";
    strip.replaceChildren();
    startPoll();
    sent = sent.filter((i) => !r.players.some((p) => p.id === i.to));
    const host = r.host === me;
    const link = `${location.origin}${location.pathname}?salon=${r.code}`;
    const seats = h("div", { class: "seats" });
    for (const p of r.players) {
      seats.append(h("div", { class: "seat glass" },
        r.host === p.id ? h("span", { class: "host badge" }, "Hôte") : null,
        host && p.id !== me ? h("button", { class: "iconbtn kick", "aria-label": "Retirer", onclick: () => kick(p.id) }, icon("croix", 16)) : null,
        h("div", { html: avatarHTML(p, 58), style: { borderRadius: "50%", overflow: "hidden", width: "58px", height: "58px" } }),
        h("div", { class: "nm" }, p.name), p.bot ? h("span", { class: "badge" }, "Robot") : null));
    }
    const pending = sent.filter((i) => i.status === "pending");
    const declined = sent.filter((i) => i.status === "declined");
    for (const i of [...pending, ...declined]) {
      seats.append(h("div", { class: "seat glass " + (i.status === "pending" ? "waiting" : "declined") },
        h("div", { html: avatarHTML({ photo: i.profile.avatar_url, avatar: i.profile.equipped }, 58), style: { borderRadius: "50%", overflow: "hidden", width: "58px", height: "58px" } }),
        h("div", { class: "nm" }, i.profile.display_name),
        h("span", { class: "state" }, i.status === "pending" ? "Invité, en attente" : "A décliné")));
    }
    for (let i = r.players.length + pending.length; i < r.max_players; i++) {
      seats.append(h("button", { class: "seat emptyseat", onclick: () => { sfx.tap(); invitePlayers(); } }, icon("plus", 26), h("span", { class: "small" }, host ? "Ajouter un joueur" : "Inviter un ami")));
    }
    const canStart = r.players.length >= info.min;
    const auto = autoStart(r);
    const allDeclined = host && sent.length && !pending.length && r.players.filter((p) => !p.bot).length < 2;
    stage.replaceChildren(h("div", { class: "lobby wrap-w" },
      h("div", { class: "code-card glass" },
        h("div", { class: "small dim" }, "Code du salon"),
        h("div", { class: "code-big" }, r.code),
        h("div", { class: "row gap center", style: { marginTop: "10px" } },
          h("button", { class: "btn ghost small", onclick: () => copy(r.code) }, "Copier le code"),
          h("button", { class: "btn small", onclick: () => share(link) }, icon("partager", 18), "Partager le lien"))),
      setCard(r, host),
      h("div", { class: "section" }, h("div", { class: "h3" }, `Joueurs ${r.players.length}/${r.max_players}`), h("span", { class: "small dim" }, pending.length ? `${pending.length} invitation${pending.length > 1 ? "s" : ""} en attente` : info.min > 1 ? `${info.min} minimum` : "")),
      seats,
      r.players.length + pending.length < r.max_players ? h("button", { class: "btn purple block", onclick: () => { sfx.tap(); invitePlayers(); } }, icon("amis", 20), "Inviter des amis") : null,
      allDeclined ? h("div", { class: "card glass center" }, h("div", { class: "h3" }, "Personne n'a pu venir 😢"), h("p", { class: "lead small" }, "Invite d'autres amis, ou joue avec des robots.")) : null,
      auto,
      host ? h("button", { class: "btn green block", disabled: !canStart, onclick: () => { sfx.ok(); ctl.begin(); } }, canStart ? (pending.length ? "Lancer sans attendre" : "Lancer la partie") : `Il faut ${info.min} joueurs`)
        : h("div", { class: "card glass center" }, h("div", { class: "h3" }, "En attente de l'hôte…"), h("p", { class: "lead small" }, "La partie démarre dès qu'il lance.")),
      h("div", { style: { height: "20px" } })));
  }
  // réglages de la partie : visibles par tous, modifiables par l'hôte avant le lancement
  const OPT = gameOptions(game, room.game);
  function setCard(r, host) {
    const set = r.settings || {};
    const { mode, chips } = summary(OPT.options, OPT.modes, set);
    const t = set.turnTime ? `${set.turnTime} s` : "Libre";
    return h("div", { class: "card glass stack", style: { marginTop: "12px" } },
      h("div", { class: "row between" }, h("div", { class: "h3" }, mode ? `${mode.emoji || "🎮"} ${mode.name}` : OPT.options.length ? "🛠️ Personnalisé" : "Réglages"),
        host ? h("button", { class: "btn small ghost", onclick: () => editSettings() }, icon("crayon", 16), "Modifier") : null),
      h("div", { class: "lobby-set" }, ...chips, h("span", { class: "chip" }, "⏱️ Temps par tour : ", h("b", null, t))));
  }
  function editSettings() {
    const cur = ctl.room.settings || {};
    const conf = restore(OPT.options, cur);
    conf.turnTime = [0, 20, 40, 60].includes(cur.turnTime) ? cur.turnTime : 0;
    const turn = carousel([{ v: 0, t: "Libre", em: "♾️" }, { v: 20, t: "20 s", em: "⚡" }, { v: 40, t: "40 s", em: "⏱️" }, { v: 60, t: "60 s", em: "🐢" }],
      () => conf.turnTime, (v) => (conf.turnTime = v), { label: "Temps par tour", icon: "⏱️" });
    const ok = h("button", { class: "btn green block big" }, "Valider");
    const sh = sheet(h("div", { class: "stack" }, OPT.options.length ? picker({ ...OPT, conf, color: info.color }) : null, turn, ok), { title: "Réglages de la partie" });
    ok.onclick = async () => {
      const next = { ...cur, turnTime: conf.turnTime, mode: modeOf(OPT.modes, OPT.options, conf) };
      for (const o of OPT.options) next[o.key] = conf[o.key];
      sh.close();
      await ctl.patch((r) => (r.status !== "lobby" ? null : { settings: next })).then(() => toast("Réglages mis à jour", "ok")).catch((e) => toast(e.message, "err"));
    };
  }
  async function share(link) {
    const text = `Viens jouer à ${info.name} avec moi sur JEUX ! Code : ${ctl.room.code}`;
    try { if (navigator.share) { await navigator.share({ title: "JEUX", text, url: link }); return; } } catch { return; }
    copy(link);
  }
  async function kick(id) {
    await ctl.patch((r) => ({ players: r.players.filter((p) => p.id !== id) })).catch((e) => toast(e.message, "err"));
  }

  // ---------------- partie
  function ctxOf(r) {
    const p = A.profile;
    return { state: r.state, me, players: playerMap(r), order: r.players.map((x) => x.id), room: r, settings: r.settings || {},
      act: (a) => ctl.act(a), skin: equipOf(p.equipped), sfx, toast, buzz, isHost: r.host === me };
  }

  function drawGame(r) {
    drawStrip(r);
    const ctx = ctxOf(r);
    if (!mounted) { stage.replaceChildren(); mounted = view.mount(stage, ctx); }
    else mounted.update(ctx);
    const who = game.toAct(r.state);
    const mine = who.includes(me);
    if (mine && !lastToAct && !game.meta.race) { sfx.turn(); buzz(20); }
    lastToAct = mine;
  }

  function tickTimer() {
    const r = ctl.room;
    const st = r && r.state;
    if (!st || r.status !== "playing" || !st._dl) { timer.style.visibility = "hidden"; return; }
    const total = ((r.settings && r.settings.turnTime) || game.meta.turnTime || 30) * 1000;
    const left = Math.max(0, st._dl - Date.now());
    timer.style.visibility = "visible";
    const i = timer.firstChild;
    i.style.width = Math.round((100 * left) / total) + "%";
    i.style.backgroundPosition = `${Math.round(100 - (100 * left) / total)}% 0`;
  }
  const tt = setInterval(tickTimer, 250);

  // ---------------- résultats
  async function drawResult(r) {
    drawGame(r);
    const st = r.state;
    if (!st || !st.result) return;
    const round = st.round || 0;
    if (resultSheet && resultSheet.round === round) return;
    const ranking = st.result.ranking;
    const mine = ranking.find((x) => x.id === me);
    const nbFirst = ranking.filter((x) => x.rank === 1).length;
    const win = mine && mine.rank === 1 && nbFirst === 1;
    const draw = mine && mine.rank === 1 && nbFirst > 1;
    const players = playerMap(r);
    const gains = h("div", { class: "gains" });
    const box = h("div", { class: "result" },
      h("img", { class: "result-img", src: win || draw ? "assets/img/victoire.webp" : "assets/img/defaite.webp", width: 150, height: 150, alt: "" }),
      h("div", { class: "place" }, win ? "Victoire !" : draw ? "Égalité !" : mine ? `${mine.rank}e place` : "Partie finie"),
      gains,
      h("div", { class: "rk list" }, ranking.map((x) => {
        const p = players[x.id] || { name: "?" };
        return h("div", { class: "item glass" + (x.id === me ? " me" : "") }, h("span", { class: "rank-n" }, x.rank),
          h("div", { class: "av", html: avatarHTML(p, 40), style: { width: "40px", height: "40px" } }),
          h("div", { class: "grow", style: { textAlign: "left" } }, p.name),
          x.score != null && view.scoreLabel ? h("span", { class: "dim small" }, view.scoreLabel(x.score)) : x.score != null ? h("b", null, fmt(x.score)) : null);
      })),
      h("div", { class: "row gap", style: { width: "100%" } },
        h("button", { class: "btn ghost grow", onclick: () => { gone = true; if (!solo) store.leave(r.id).catch(() => {}); A.go("/"); } }, "Quitter"),
        r.host === me || solo ? h("button", { class: "btn green grow", onclick: () => { resultSheet && resultSheet.s.close(); ctl.begin(); } }, "Revanche")
          : h("button", { class: "btn grow", disabled: true }, "Revanche : attends l'hôte")));
    if (win) { confetti(); sfx.win(); } else if (draw) sfx.ok(); else sfx.lose();
    resultSheet = { round, s: sheet(box, { title: info.name, onClose: () => {} }) };
    // gains
    if (claimedRound === round || !mine) return;
    claimedRound = round;
    try {
      let res;
      if (solo) res = await A.api.soloReward(r.game, win ? "win" : draw ? "draw" : "lose", {
        score: typeof mine.score === "number" && isFinite(mine.score) ? mine.score : null,
        duration: r.state.startedAt ? Math.max(0, Math.round((Date.now() - r.state.startedAt) / 1000)) : null,
        mode: (r.settings && r.settings.mode) || null });
      else res = await A.api.rooms.claim(r.id);
      if (res && res.ok) {
        const ge = h("span", null, "0"), xe = h("span", null, "0");
        gains.replaceChildren(h("div", { class: "g glass" }, "+", ge, gem(24)), h("div", { class: "g glass" }, "+", xe, " XP"));
        countUp(ge, 0, res.gems); countUp(xe, 0, res.xp);
        A.setProfile(res.profile);
      } else if (res && res.reason === "trop_vite") {
        gains.replaceChildren(h("p", { class: "small dim" }, "Partie trop rapide : pas de gemmes cette fois."));
      }
    } catch (e) { gains.replaceChildren(h("p", { class: "small dim" }, e.message)); }
  }

  function draw(r) {
    if (gone) return;
    if (!r) { toast("Le salon a été fermé."); A.go("/"); return; }
    drawBar(r);
    const ph = r.status;
    if (ph !== phase && ph === "playing" && resultSheet) { resultSheet.s.close(); }
    if (ph !== "lobby") stopPoll();
    if (ph === "lobby") { if (mounted) { mounted.destroy && mounted.destroy(); mounted = null; } drawLobby(r); }
    else if (ph === "playing") drawGame(r);
    else if (ph === "done") drawResult(r);
    phase = ph;
  }

  // accès pour les tests automatiques (serveur simulé uniquement)
  if (A.api.kind === "mock") window.__room = { ctl, game, me };
  draw(room);
  (firstTime() ? showRules() : Promise.resolve()).then(() => { if (solo && !gone) ctl.begin(); });
  return () => {
    gone = true;
    stopPoll();
    clearInterval(tt);
    if (resultSheet) resultSheet.s.close();
    if (mounted && mounted.destroy) mounted.destroy();
    ctl.destroy();
  };
}
