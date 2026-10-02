// Amis : ajouter par pseudo, demandes reçues, liste avec présence en ligne.
import { h, icon, toast, sfx, copy, confirmBox } from "../ui.js";
import { avatarHTML } from "../avatar.js";
import { levelOf } from "../catalog.js";

export function render(A, main) {
  const wrap = h("div", { class: "wrap-w" });
  const input = h("input", { class: "input grow", placeholder: "Pseudo de ton ami", autocapitalize: "none", autocomplete: "off", "aria-label": "Pseudo" });
  const form = h("form", { class: "joinbar glass", onsubmit: async (e) => {
    e.preventDefault();
    const u = input.value.trim().replace(/^@/, "");
    if (!u) return;
    try {
      const r = await A.api.friendRequest(u);
      sfx.ok();
      toast(r.status === "accepted" ? "Vous êtes maintenant amis !" : "Demande envoyée !", "ok");
      input.value = "";
      A.friends = await A.api.friends(); draw();
    } catch (err) { sfx.bad(); toast(err.message, "err"); }
  } }, input, h("button", { class: "btn green", type: "submit" }, "Ajouter"));
  const mine = h("div", { class: "card glass row gap" },
    icon("amis", 26),
    h("div", { class: "grow" }, h("div", { class: "small dim" }, "Ton pseudo"), h("div", { class: "h3" }, "@" + A.profile.username)),
    h("button", { class: "btn small ghost", onclick: () => copy(A.profile.username) }, "Copier"));
  const box = h("div");
  wrap.append(h("div", { class: "section" }, h("div", { class: "h1" }, "Amis")), mine, h("div", { style: { height: "12px" } }), form, box);
  main.append(wrap);

  function person(f, ...actions) {
    const p = f.profile;
    return h("div", { class: "item glass" },
      h("div", { class: "av", html: avatarHTML({ photo: p.avatar_url, avatar: p.equipped }, 46) }, A.online.has(f.id) ? h("i", { class: "online" }) : null),
      h("div", { class: "grow" }, h("div", null, p.display_name),
        h("div", { class: "small dim" }, `@${p.username} · niveau ${levelOf(p.xp).lvl}${A.online.has(f.id) ? " · en ligne" : ""}`)),
      ...actions);
  }
  function draw() {
    const inc = A.friends.filter((f) => f.incoming);
    const out = A.friends.filter((f) => f.status === "pending" && !f.incoming);
    const ok = A.friends.filter((f) => f.status === "accepted").sort((a, b) => (A.online.has(b.id) ? 1 : 0) - (A.online.has(a.id) ? 1 : 0));
    box.replaceChildren(
      inc.length ? h("div", { class: "section" }, h("div", { class: "h3" }, "Demandes reçues")) : null,
      inc.length ? h("div", { class: "list" }, inc.map((f) => person(f,
        h("button", { class: "iconbtn", "aria-label": "Refuser", onclick: () => respond(f, false) }, icon("croix", 18)),
        h("button", { class: "btn green small", onclick: () => respond(f, true) }, "Accepter")))) : null,
      h("div", { class: "section" }, h("div", { class: "h3" }, `Mes amis (${ok.length})`)),
      ok.length ? h("div", { class: "list" }, ok.map((f) => person(f,
        h("button", { class: "iconbtn", "aria-label": "Retirer", onclick: async () => {
          if (!(await confirmBox(`Retirer ${f.profile.display_name} de tes amis ?`, { ok: "Retirer", danger: true }))) return;
          await A.api.friendRemove(f.id); A.friends = await A.api.friends(); draw();
        } }, icon("croix", 18)))))
        : h("div", { class: "empty card glass" }, h("div", { class: "h3" }, "Pas encore d'amis"), h("p", { class: "lead small" }, "Ajoute-les avec leur pseudo, puis invite-les depuis un salon.")),
      out.length ? h("div", { class: "section" }, h("div", { class: "h3" }, "Demandes envoyées")) : null,
      out.length ? h("div", { class: "list" }, out.map((f) => person(f, h("span", { class: "small dim" }, "En attente"),
        h("button", { class: "iconbtn", "aria-label": "Annuler", onclick: async () => { await A.api.friendRemove(f.id); A.friends = await A.api.friends(); draw(); } }, icon("croix", 18))))) : null);
    A.refreshTabs();
  }
  async function respond(f, yes) {
    try { await A.api.friendRespond(f.id, yes); sfx.ok(); A.friends = await A.api.friends(); draw(); } catch (e) { toast(e.message, "err"); }
  }
  draw();
  const re = () => draw();
  window.addEventListener("jeux:friends", re);
  window.addEventListener("jeux:online", re);
  return () => { window.removeEventListener("jeux:friends", re); window.removeEventListener("jeux:online", re); };
}
