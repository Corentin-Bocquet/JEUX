// Salon : attente des joueurs, partie, résultats. Sert aussi aux parties solo (magasin local).
import { h, icon, tile, gem, toast, sfx, buzz, sheet, confirmBox, confetti, copy, fmt, countUp } from "../ui.js";
import { avatarHTML } from "../avatar.js";
import { gameInfo, loadGame, loadView } from "../games/index.js";
import { RoomCtl, localStore, makeBot } from "../rooms.js";
import { equipOf } from "../catalog.js";

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
  function drawLobby(r) {
    timer.style.visibility = "hidden";
    strip.replaceChildren();
    const host = r.host === me;
    const link = `${location.origin}${location.pathname}?code=${r.code}`;
    const seats = h("div", { class: "seats" });
    for (const p of r.players) {
      seats.append(h("div", { class: "seat glass" },
        r.host === p.id ? h("span", { class: "host badge" }, "Hôte") : null,
        host && p.id !== me ? h("button", { class: "iconbtn kick", "aria-label": "Retirer", onclick: () => kick(p.id) }, icon("croix", 16)) : null,
        h("div", { html: avatarHTML(p, 58), style: { borderRadius: "50%", overflow: "hidden", width: "58px", height: "58px" } }),
        h("div", { class: "nm" }, p.name), p.bot ? h("span", { class: "badge" }, "Robot") : null));
    }
    for (let i = r.players.length; i < r.max_players; i++) {
      seats.append(h("button", { class: "seat emptyseat", disabled: !host, onclick: () => host && addBot() }, icon("plus", 26), h("span", { class: "small" }, host ? "Ajouter un robot" : "Place libre")));
    }
    const friends = A.friends.filter((f) => f.status === "accepted" && !r.players.some((p) => p.id === f.id))
      .sort((a, b) => (A.online.has(b.id) ? 1 : 0) - (A.online.has(a.id) ? 1 : 0));
    const canStart = r.players.length >= info.min;
    stage.replaceChildren(h("div", { class: "lobby wrap-w" },
      h("div", { class: "code-card glass" },
        h("div", { class: "small dim" }, "Code du salon"),
        h("div", { class: "code-big" }, r.code),
        h("div", { class: "row gap center", style: { marginTop: "10px" } },
          h("button", { class: "btn ghost small", onclick: () => copy(r.code) }, "Copier le code"),
          h("button", { class: "btn small", onclick: () => share(link) }, icon("partager", 18), "Inviter"))),
      h("div", { class: "section" }, h("div", { class: "h3" }, `Joueurs ${r.players.length}/${r.max_players}`), h("span", { class: "small dim" }, info.min > 1 ? `${info.min} minimum` : "")),
      seats,
      friends.length ? h("div", { class: "section" }, h("div", { class: "h3" }, "Inviter un ami")) : null,
      friends.length ? h("div", { class: "list" }, friends.map((f) => h("div", { class: "item glass" },
        h("div", { class: "av", html: avatarHTML({ photo: f.profile.avatar_url, avatar: f.profile.equipped }, 46) }, A.online.has(f.id) ? h("i", { class: "online" }) : null),
        h("div", { class: "grow" }, h("div", null, f.profile.display_name), h("div", { class: "small dim" }, A.online.has(f.id) ? "En ligne" : "@" + f.profile.username)),
        h("button", { class: "btn small", onclick: async (e) => { e.target.disabled = true; try { await A.api.invite(r.id, f.id); toast("Invitation envoyée !", "ok"); } catch (err) { toast(err.message, "err"); e.target.disabled = false; } } }, "Inviter")))) : null,
      host ? h("button", { class: "btn green block", disabled: !canStart, onclick: () => { sfx.ok(); ctl.begin(); } }, canStart ? "Lancer la partie" : `Il faut ${info.min} joueurs`)
        : h("div", { class: "card glass center" }, h("div", { class: "h3" }, "En attente de l'hôte…"), h("p", { class: "lead small" }, "La partie démarre dès qu'il lance.")),
      h("div", { style: { height: "20px" } })));
  }
  async function share(link) {
    const text = `Viens jouer à ${info.name} avec moi sur JEUX ! Code : ${ctl.room.code}`;
    try { if (navigator.share) { await navigator.share({ title: "JEUX", text, url: link }); return; } } catch { return; }
    copy(link);
  }
  async function addBot() {
    sfx.tap();
    await ctl.patch((r) => r.players.length >= r.max_players ? null : { players: [...r.players, makeBot(r.players.map((p) => p.name))] }).catch((e) => toast(e.message, "err"));
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
      if (solo) res = await A.api.soloReward(r.game, win ? "win" : draw ? "draw" : "lose");
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
    if (ph === "lobby") { if (mounted) { mounted.destroy && mounted.destroy(); mounted = null; } drawLobby(r); }
    else if (ph === "playing") drawGame(r);
    else if (ph === "done") drawResult(r);
    phase = ph;
  }

  // accès pour les tests automatiques (serveur simulé uniquement)
  if (A.api.kind === "mock") window.__room = { ctl, game, me };
  draw(room);
  if (solo) ctl.begin();
  return () => {
    gone = true;
    clearInterval(tt);
    if (resultSheet) resultSheet.s.close();
    if (mounted && mounted.destroy) mounted.destroy();
    ctl.destroy();
  };
}
