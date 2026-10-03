// Inviter des joueurs : cartes d'amis (les plus fréquents en premier), pseudo, robots.
// Et le bandeau qui apparaît en haut de l'app quand on reçoit une invitation.
import { h, icon, tile, toast, sfx, sheet, buzz } from "../ui.js";
import { avatarHTML } from "../avatar.js";
import { gameInfo } from "../games/index.js";

// nombre de parties jouées avec chaque joueur (mis en cache 5 minutes)
let togetherCache = null, togetherAt = 0;
export async function together(A) {
  if (togetherCache && Date.now() - togetherAt < 3e5) return togetherCache;
  try {
    const s = await A.api.myStats();
    togetherCache = Object.fromEntries((s.rivals || []).map((r) => [r.id, r.games]));
    togetherAt = Date.now();
  } catch { togetherCache = togetherCache || {}; }
  return togetherCache;
}
export const resetTogether = () => { togetherCache = null; };

const avatarOf = (p) => avatarHTML({ photo: p.avatar_url, avatar: p.equipped }, 64);

// ouvre le sélecteur ; résout { ids, users, bots } ou null si on ferme
export function pickPlayers(A, { free = 7, allowBots = false, exclude = [], title = "Inviter des joueurs", ok = "Inviter" } = {}) {
  return new Promise(async (done) => {
    let finished = false;
    const finish = (v) => { if (finished) return; finished = true; done(v); };
    const tog = await together(A);
    const sel = new Set(), users = [];
    let bots = 0;
    const left = () => free - sel.size - users.length - bots;
    const friends = A.friends.filter((f) => f.status === "accepted" && !exclude.includes(f.id))
      .sort((a, b) => (tog[b.id] || 0) - (tog[a.id] || 0) || (A.online.has(b.id) ? 1 : 0) - (A.online.has(a.id) ? 1 : 0)
        || a.profile.display_name.localeCompare(b.profile.display_name, "fr"));

    const grid = h("div", { class: "pgrid" });
    const btn = h("button", { class: "btn green block big" });
    const info = h("div", { class: "small dim center" });
    const full = () => { toast(free === 1 ? "Il ne reste qu'une place." : `Il ne reste que ${free} places.`); buzz(30); };

    const draw = () => {
      const cards = [];
      if (allowBots) cards.push(h("div", { class: "fcard bot" + (bots ? " on" : "") },
        h("div", { class: "pav botav" }, "🤖"), h("b", null, "Robot"),
        h("div", { class: "botctl" },
          h("button", { type: "button", "aria-label": "Un robot de moins", disabled: !bots, onclick: () => { bots--; sfx.tap(); draw(); } }, "−"),
          h("span", null, bots),
          h("button", { type: "button", "aria-label": "Un robot de plus", onclick: () => { if (left() <= 0) return full(); bots++; sfx.tap(); draw(); } }, "+"))));
      for (const u of users) cards.push(h("button", { type: "button", class: "fcard on", onclick: () => { users.splice(users.indexOf(u), 1); sfx.tap(); draw(); } },
        h("div", { class: "pav", html: avatarOf(u) }), h("b", null, u.display_name), h("small", null, "@" + u.username)));
      for (const f of friends) {
        const on = sel.has(f.id), n = tog[f.id] || 0, online = A.online.has(f.id);
        cards.push(h("button", { type: "button", class: "fcard" + (on ? " on" : ""), "aria-pressed": on ? "true" : "false", "aria-label": f.profile.display_name,
          onclick: () => { if (on) sel.delete(f.id); else { if (left() <= 0) return full(); sel.add(f.id); } sfx.tap(); buzz(10); draw(); } },
          h("div", { class: "pav", html: avatarOf(f.profile) }, online ? h("i", { class: "online" }) : null),
          h("b", null, f.profile.display_name),
          h("small", null, n ? `🔥 ${n} partie${n > 1 ? "s" : ""}` : online ? "En ligne" : "@" + f.profile.username)));
      }
      grid.replaceChildren(...cards);
      const k = sel.size + users.length;
      btn.disabled = !k && !bots;
      btn.replaceChildren(icon("amis", 22), !k && !bots ? "Choisis des joueurs" : k ? `${ok} ${k} joueur${k > 1 ? "s" : ""}${bots ? ` + ${bots} robot${bots > 1 ? "s" : ""}` : ""}` : `Ajouter ${bots} robot${bots > 1 ? "s" : ""}`);
      info.textContent = left() > 0 ? `${left()} place${left() > 1 ? "s" : ""} libre${left() > 1 ? "s" : ""}` : "C'est complet !";
    };

    const pseudo = h("input", { class: "input", placeholder: "Pseudo d'un joueur", autocomplete: "off", autocapitalize: "none", maxlength: 16, "aria-label": "Pseudo d'un joueur" });
    const addUser = async (e) => {
      e.preventDefault();
      const v = pseudo.value.trim().toLowerCase().replace(/^@/, "");
      if (!v) return;
      if (left() <= 0) return full();
      if (v === A.profile.username) return toast("C'est ton propre pseudo !", "err");
      try {
        const p = await A.api.findUser(v);
        if (!p) return toast("Aucun joueur avec ce pseudo.", "err");
        if (exclude.includes(p.id)) return toast("Ce joueur est déjà dans le salon.");
        const f = friends.find((x) => x.id === p.id);
        if (f) sel.add(f.id); else if (!users.some((u) => u.id === p.id)) users.push(p);
        pseudo.value = ""; sfx.ok(); draw();
      } catch (er) { toast(er.message, "err"); }
    };

    draw();
    const body = h("div", { class: "stack" },
      h("form", { class: "joinbar glass", onsubmit: addUser }, pseudo, h("button", { class: "btn small", type: "submit" }, "Ajouter")),
      friends.length ? h("div", { class: "row between" }, h("div", { class: "h3" }, "Tes amis"), h("span", { class: "small dim" }, "les plus fréquents en premier"))
        : h("p", { class: "lead small" }, "Ajoute des amis depuis l'onglet Amis, ou invite quelqu'un avec son pseudo."),
      grid, info, btn);
    const s = sheet(body, { title, onClose: () => finish(null) });
    btn.onclick = () => { const r = { ids: [...sel], users: users.slice(), bots }; finish(r); s.close(); };
  });
}

// envoie les invitations d'un choix (amis + pseudos) pour un salon
export async function sendInvites(A, roomId, pick) {
  let n = 0;
  if (pick.ids.length) n += await A.api.inviteMany(roomId, pick.ids);
  for (const u of pick.users) { await A.api.inviteUsername(roomId, u.username); n++; }
  return n;
}

// ---------------------------------------------------------------- bandeau d'invitation
let current = null;
export function inviteBanner(A, inv) {
  if (current && current.id === inv.id) return;
  if (current) current.close(true);
  const g = gameInfo(inv.game) || { name: "un jeu", icon: "jouer", color: "#6C5CE7" };
  const from = inv.from || { display_name: "Un ami" };
  const el = h("div", { class: "ibanner glass", role: "alertdialog", "aria-label": "Invitation à jouer" });
  const close = (fast) => {
    if (current && current.el === el) current = null;
    clearTimeout(timer);
    el.classList.remove("in");
    setTimeout(() => el.remove(), fast ? 0 : 300);
  };
  el.append(
    h("div", { class: "row gap" },
      h("div", { class: "ib-av", html: avatarHTML({ photo: from.avatar_url, avatar: from.equipped }, 46) }),
      h("div", { class: "grow" },
        h("div", { class: "ib-t" }, `${from.display_name} t'invite !`),
        h("div", { class: "ib-s" }, tile(g.icon, 20, g.color), g.name)),
      h("button", { class: "iconbtn", "aria-label": "Masquer", onclick: () => close() }, icon("croix", 16))),
    h("div", { class: "row gap", style: { marginTop: "10px" } },
      h("button", { class: "btn ghost small grow", onclick: async () => {
        close();
        try { await A.api.declineInvite(inv.id); } catch {}
        A.invites = A.invites.filter((i) => i.id !== inv.id);
        window.dispatchEvent(new Event("jeux:invites"));
      } }, "Décliner"),
      h("button", { class: "btn green small grow", onclick: () => { close(); sfx.ok(); A.go("/salon/" + inv.code); } }, icon("jouer", 18), "Rejoindre")));
  document.body.append(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("in")));
  sfx.turn(); buzz([30, 60, 30]);
  const timer = setTimeout(() => close(), 60000);
  current = { id: inv.id, el, close };
}
