// Connexion et inscription.
import { h, toast, sfx, sheet } from "../ui.js";
import { mascotSVG } from "../avatar.js";

export function render(A, root) {
  let mode = "signup";
  const email = h("input", { class: "input", type: "email", autocomplete: "email", placeholder: "toi@exemple.fr", id: "a-email", required: true });
  const pass = h("input", { class: "input", type: "password", autocomplete: "current-password", placeholder: "6 caractères minimum", id: "a-pass", required: true, minlength: 6 });
  const pseudo = h("input", { class: "input", type: "text", autocomplete: "nickname", placeholder: "ex. corentin_42", id: "a-pseudo", maxlength: 16 });
  const pseudoF = h("div", { class: "field" }, h("label", { for: "a-pseudo" }, "Ton pseudo"), pseudo);
  const btn = h("button", { class: "btn green block", type: "submit" }, "Créer mon compte");
  const forgot = h("button", { class: "small dim", type: "button", onclick: () => reset() }, "Mot de passe oublié ?");
  const segS = h("button", { type: "button", class: "on", onclick: () => setMode("signup") }, "Inscription");
  const segL = h("button", { type: "button", onclick: () => setMode("login") }, "Connexion");
  function setMode(m) {
    mode = m;
    segS.classList.toggle("on", m === "signup"); segL.classList.toggle("on", m === "login");
    pseudoF.style.display = m === "signup" ? "" : "none";
    forgot.style.display = m === "login" ? "" : "none";
    btn.textContent = m === "signup" ? "Créer mon compte" : "Me connecter";
    pass.autocomplete = m === "signup" ? "new-password" : "current-password";
  }
  const form = h("form", { class: "stack", onsubmit: async (e) => {
    e.preventDefault();
    btn.disabled = true;
    try {
      if (mode === "signup") {
        const u = pseudo.value.trim();
        if (!/^[A-Za-z0-9_]{3,16}$/.test(u)) throw new Error("Pseudo : 3 à 16 lettres, chiffres ou _.");
        const r = await A.api.signUp(email.value.trim(), pass.value, u);
        if (r.needConfirm) { toast("Compte créé ! Confirme ton email puis connecte-toi.", "ok"); setMode("login"); btn.disabled = false; return; }
      } else {
        await A.api.signIn(email.value.trim(), pass.value);
      }
      sfx.ok();
      const app = await import("../app.js");
      await app.enter();
    } catch (err) {
      sfx.bad();
      toast(err.message, "err");
      btn.disabled = false;
    }
  } }, pseudoF,
    h("div", { class: "field" }, h("label", { for: "a-email" }, "Email"), email),
    h("div", { class: "field" }, h("label", { for: "a-pass" }, "Mot de passe"), pass),
    btn, forgot);
  async function reset() {
    const mail = email.value.trim();
    if (!mail) { toast("Écris d'abord ton email.", "err"); email.focus(); return; }
    try { await A.api.resetPassword(mail); toast("Email envoyé : suis le lien pour changer ton mot de passe.", "ok"); }
    catch (e) { toast(e.message, "err"); }
  }
  root.replaceChildren(h("div", { class: "auth" },
    h("div", { class: "mascots-row", html: mascotSVG({ color: "color_rose", hat: "hat_couronne" }, 74) + mascotSVG({ color: "color_bleu", glasses: "glasses_soleil", outfit: "outfit_hero" }, 92) + mascotSVG({ color: "color_vert", hat: "hat_casquette" }, 74) }),
    h("div", { class: "logo" }, "JEUX"),
    h("p", { class: "lead center" }, "12 jeux à plusieurs, des défis entre amis, des gemmes à gagner."),
    h("div", { class: "panel glass stack" }, h("div", { class: "seg" }, segS, segL), form)));
  setMode("signup");
}

export function newPassword(A) {
  const pw = h("input", { class: "input", type: "password", placeholder: "Nouveau mot de passe", minlength: 6, autocomplete: "new-password" });
  const s = sheet(h("form", { class: "stack", onsubmit: async (e) => {
    e.preventDefault();
    try { await A.api.updatePassword(pw.value); toast("Mot de passe changé.", "ok"); s.close(); }
    catch (err) { toast(err.message, "err"); }
  } }, pw, h("button", { class: "btn green block" }, "Enregistrer")), { title: "Nouveau mot de passe" });
}
