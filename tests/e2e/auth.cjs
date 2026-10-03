// Mot de passe oublié, lien de récupération, lien d'invitation ?salon=
const { chromium } = require("playwright");
const BASE = (process.env.BASE || "http://localhost:8765") + "/";
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("PAGEERR " + e.message));
  await p.goto(BASE + "?mock=1");
  await p.waitForSelector("#a-pseudo");
  await p.click("text=Connexion");
  await p.click("text=Mot de passe oublié ?");
  await p.waitForSelector("text=Recevoir le lien");
  await p.fill(".sheet input[type=email]", "x@t.fr");
  await p.click("text=Recevoir le lien");
  await p.waitForSelector("text=C'est envoyé");
  console.log("mot de passe oublié : fenêtre ok");
  await p.click("text=Compris");
  // inscription puis arrivée par un lien de récupération
  await p.click("text=Inscription");
  await p.fill("#a-pseudo", "rec"); await p.fill("#a-email", "r@t.fr"); await p.fill("#a-pass", "secret1");
  await p.click("button[type=submit]");
  await p.waitForSelector(".gcard");
  await p.goto("about:blank");
  await p.goto(BASE + "?mock=1#access_token=abc&type=recovery");
  await p.waitForSelector("#np-1");
  if (!/^#\/?$/.test(await p.evaluate(() => location.hash))) errs.push("le jeton reste dans l'adresse");
  await p.fill("#np-1", "nouveau1"); await p.fill("#np-2", "nouveau2");
  await p.click("text=Enregistrer et jouer");
  await p.waitForSelector("text=différents");
  await p.fill("#np-2", "nouveau1");
  await p.click("text=Enregistrer et jouer");
  await p.waitForSelector(".gcard");
  console.log("lien de récupération : ok");
  // lien expiré sans session
  const p2 = await (await b.newContext()).newPage();
  await p2.goto(BASE + "?mock=1#error=access_denied&error_code=otp_expired");
  await p2.waitForSelector("text=Ce lien a expiré");
  console.log("lien expiré : ok");
  // lien d'invitation ?salon=
  const code = await p.evaluate(async () => { const { A } = await import("/js/app.js"); const r = await A.api.rooms.create("morpion" in {} ? "x" : "puissance4", 2, {}, A.me()); return r.code; });
  await p.goto("about:blank");
  await p.goto(BASE + "?mock=1&salon=" + code);
  await p.waitForSelector(".code-big");
  if ((await p.textContent(".code-big")) !== code) errs.push("mauvais salon");
  console.log("lien ?salon= : ok");
  console.log(errs.join("\n") || "aucune erreur");
  if (errs.length) process.exitCode = 1;
  await b.close();
})();
