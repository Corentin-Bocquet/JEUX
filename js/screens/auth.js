// Connexion et inscription.
import { h, toast, sfx, sheet } from "../ui.js";

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
  function reset() {
    const mail = h("input", { class: "input", type: "email", autocomplete: "email", placeholder: "toi@exemple.fr", value: email.value.trim(), required: true });
    const send = h("button", { class: "btn green block", type: "submit" }, "Recevoir le lien");
    const box = h("form", { class: "stack", onsubmit: async (e) => {
      e.preventDefault();
      send.disabled = true;
      try {
        await A.api.resetPassword(mail.value.trim());
        box.replaceChildren(h("p", { class: "lead" }, `C'est envoyé à ${mail.value.trim()}. Ouvre le mail et touche le lien : tu pourras choisir un nouveau mot de passe, depuis n'importe quel navigateur.`),
          h("p", { class: "small dim" }, "Pas de mail ? Regarde dans les spams, le lien arrive en moins d'une minute."),
          h("button", { class: "btn block", type: "button", onclick: () => s.close() }, "Compris"));
      } catch (err) { toast(err.message, "err"); send.disabled = false; }
    } }, h("p", { class: "lead small" }, "Écris l'email de ton compte, on t'envoie un lien pour changer ton mot de passe."), mail, send);
    const s = sheet(box, { title: "Mot de passe oublié" });
  }
  root.replaceChildren(h("div", { class: "auth" },
    h("img", { class: "welcome-img", src: "assets/img/bienvenue.webp", width: 220, height: 220, alt: "" }),
    h("div", { class: "logo" }, "JEUX"),
    h("p", { class: "lead center" }, "12 jeux à plusieurs, des défis entre amis, des gemmes à gagner."),
    h("div", { class: "panel glass stack" }, h("div", { class: "seg" }, segS, segL), form)));
  setMode("signup");
}

export function newPassword(A, root) {
  const pw = h("input", { class: "input", type: "password", placeholder: "6 caractères minimum", minlength: 6, autocomplete: "new-password", id: "np-1", required: true });
  const pw2 = h("input", { class: "input", type: "password", placeholder: "Le même, pour vérifier", minlength: 6, autocomplete: "new-password", id: "np-2", required: true });
  const btn = h("button", { class: "btn green block", type: "submit" }, "Enregistrer et jouer");
  const form = h("form", { class: "stack", onsubmit: async (e) => {
    e.preventDefault();
    if (pw.value.length < 6) { toast("6 caractères minimum.", "err"); return; }
    if (pw.value !== pw2.value) { toast("Les deux mots de passe sont différents.", "err"); return; }
    btn.disabled = true;
    try {
      await A.api.updatePassword(pw.value);
      sfx.ok(); toast("Mot de passe changé !", "ok");
      const app = await import("../app.js");
      await app.enter();
    } catch (err) { sfx.bad(); toast(err.message, "err"); btn.disabled = false; }
  } },
    h("div", { class: "field" }, h("label", { for: "np-1" }, "Nouveau mot de passe"), pw),
    h("div", { class: "field" }, h("label", { for: "np-2" }, "Confirme-le"), pw2),
    btn);
  root.replaceChildren(h("div", { class: "auth" },
    h("img", { class: "welcome-img", src: "assets/img/bienvenue.webp", width: 220, height: 220, alt: "" }),
    h("div", { class: "logo" }, "JEUX"),
    h("p", { class: "lead center" }, "Choisis ton nouveau mot de passe."),
    h("div", { class: "panel glass stack" }, form)));
  setTimeout(() => pw.focus(), 100);
}
