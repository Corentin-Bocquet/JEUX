// Profil : photo, nom, pseudo, niveau, statistiques, thème, son, déconnexion.
import { h, icon, toast, sfx, sheet, prefs, fmt, confirmBox, tile } from "../ui.js";
import { mascotSVG, avatarHTML } from "../avatar.js";
import { levelOf } from "../catalog.js";
import { VISIBLE as GAMES } from "../games/index.js";
import { theme } from "../app.js";

export function render(A, main) {
  const wrap = h("div", { class: "wrap-w stack" });
  main.append(wrap);
  const file = h("input", { type: "file", accept: "image/*", style: { display: "none" }, onchange: (e) => upload(e.target.files[0]) });

  function draw() {
    const p = A.profile;
    const L = levelOf(p.xp);
    const stats = p.stats || {};
    wrap.replaceChildren(
      h("div", { class: "prof-head glass" },
        h("div", { class: "prof-av" },
          h("div", { class: "avwrap", html: p.avatar_url ? avatarHTML({ photo: p.avatar_url }, 112) : mascotSVG(p.equipped, 112) }),
          h("button", { class: "edit", "aria-label": "Changer la photo", onclick: photoMenu }, tile("photo", 40, "#1CB0F6"))),
        h("div", { class: "h1" }, p.display_name),
        h("div", { class: "dim" }, "@" + p.username),
        h("div", { style: { width: "min(280px,100%)" } },
          h("div", { class: "row between small", style: { marginBottom: "4px" } }, h("span", null, "Niveau " + L.lvl), h("span", { class: "dim" }, `${L.cur} / ${L.need} XP`)),
          h("div", { class: "bar" }, h("i", { style: { width: Math.round((100 * L.cur) / L.need) + "%" } })))),
      h("div", { class: "stats" },
        h("div", { class: "stat glass" }, h("b", null, fmt(p.games)), h("span", null, "parties")),
        h("div", { class: "stat glass" }, h("b", null, fmt(p.wins)), h("span", null, "victoires")),
        h("div", { class: "stat glass" }, h("b", null, p.games ? Math.round((100 * p.wins) / p.games) + "%" : "-"), h("span", null, "de réussite"))),
      h("button", { class: "btn purple block big", onclick: () => A.go("/stats") }, "📊 Voir toutes mes statistiques"),
      h("div", { class: "card glass stack" },
        h("div", { class: "h3" }, "Mon compte"),
        row("crayon", "Nom affiché", p.display_name, editName),
        row("amis", "Pseudo", "@" + p.username, editPseudo)),
      h("div", { class: "card glass stack" },
        h("div", { class: "h3" }, "Apparence"),
        h("div", { class: "themes" }, [["system", "systeme", "Système"], ["dark", "lune", "Sombre"], ["light", "soleil", "Clair"]].map(([v, ic, t]) =>
          h("button", { class: theme.pref === v ? "on" : "", onclick: () => { theme.set(v); sfx.tap(); draw(); } }, icon(ic, 26), t))),
        h("div", { class: "row between" }, h("div", { class: "row gap" }, icon("son", 24), "Sons"),
          h("button", { class: "switch" + (prefs.sound ? " on" : ""), role: "switch", "aria-checked": prefs.sound ? "true" : "false", "aria-label": "Sons", onclick: () => { prefs.sound = !prefs.sound; sfx.tap(); draw(); } }))),
      h("div", { class: "card glass stack" },
        h("div", { class: "h3" }, "Mes jeux"),
        h("div", { class: "list" }, GAMES.slice().sort((a, b) => ((stats[b.id] || {}).p || 0) - ((stats[a.id] || {}).p || 0)).map((g) => {
          const s = stats[g.id] || { p: 0, w: 0 };
          return h("div", { class: "row gap" }, tile(g.icon, 36, g.color), h("div", { class: "grow" }, g.name, (p.favorites || []).includes(g.id) ? " ❤️" : ""),
            h("span", { class: "small dim" }, s.p ? `${s.w} / ${s.p} gagnées` : "pas encore joué"));
        }))),
      h("button", { class: "btn ghost block", onclick: async () => { if (await confirmBox("Te déconnecter ?", { ok: "Déconnexion", danger: true })) A.api.signOut(); } }, icon("quitter", 20), "Déconnexion"),
      h("div", { style: { height: "10px" } }), file);
  }
  const row = (ic, label, value, fn) => h("button", { class: "row gap", style: { width: "100%", textAlign: "left" }, onclick: fn },
    icon(ic, 22), h("div", { class: "grow" }, h("div", { class: "small dim" }, label), h("div", null, value)), icon("crayon", 18));

  function prompt(title, value, check, save) {
    const inp = h("input", { class: "input", value, maxlength: 20, autocomplete: "off" });
    const s = sheet(h("form", { class: "stack", onsubmit: async (e) => {
      e.preventDefault();
      const v = inp.value.trim();
      const err = check(v);
      if (err) { toast(err, "err"); return; }
      try { A.setProfile(await save(v)); toast("Enregistré !", "ok"); s.close(); draw(); } catch (er) { toast(er.message, "err"); }
    } }, inp, h("button", { class: "btn green block" }, "Enregistrer")), { title });
    setTimeout(() => inp.focus(), 200);
  }
  const editName = () => prompt("Nom affiché", A.profile.display_name, (v) => (v.length < 1 || v.length > 20 ? "1 à 20 caractères." : null), (v) => A.api.setDisplayName(v));
  const editPseudo = () => prompt("Pseudo", A.profile.username, (v) => (/^[a-zA-Z0-9_]{3,16}$/.test(v) ? null : "3 à 16 lettres, chiffres ou _."), (v) => A.api.setUsername(v.toLowerCase()));

  function photoMenu() {
    const s = sheet(h("div", { class: "stack" },
      h("button", { class: "btn block", onclick: () => { s.close(); file.click(); } }, icon("photo", 20), "Choisir une photo"),
      A.profile.avatar_url ? h("button", { class: "btn ghost block", onclick: async () => { s.close(); A.setProfile(await A.api.removePhoto()); draw(); } }, "Revenir à ma mascotte") : null,
      h("p", { class: "small dim center" }, "Ta mascotte se personnalise dans la boutique.")), { title: "Photo de profil" });
  }
  async function upload(f) {
    if (!f) return;
    try {
      const blob = await squash(f, 320);
      toast("Envoi de la photo…");
      A.setProfile(await A.api.uploadPhoto(blob));
      sfx.ok(); draw();
    } catch (e) { toast(e.message || "Photo illisible", "err"); }
    file.value = "";
  }
  draw();
}

// recadre au carré et compresse en JPEG
function squash(file, size) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const s = Math.min(img.width, img.height);
      c.getContext("2d").drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      c.toBlob((b) => (b ? res(b) : rej(new Error("Photo illisible"))), "image/jpeg", 0.85);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => rej(new Error("Photo illisible"));
    img.src = URL.createObjectURL(file);
  });
}
