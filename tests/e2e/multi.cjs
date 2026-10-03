const { chromium } = require("playwright");
const OUT = process.argv[2] || "test-results";
require("fs").mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark" });
  const errs = [];
  const okRules = async (P) => { await P.waitForSelector("text=J'ai compris, on joue !"); await P.click("text=J'ai compris, on joue !"); await P.waitForSelector(".sheet-wrap", { state: "detached" }).catch(() => {}); };
  const mk = async (name) => {
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errs.push(name + " PAGEERR " + e.message));
    p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errs.push(name + " CONSOLE " + m.text()); });
    await p.goto((process.env.BASE || "http://localhost:8765") + "/?mock=1");
    await p.waitForSelector("#a-pseudo");
    await p.fill("#a-pseudo", name); await p.fill("#a-email", name + "@t.fr"); await p.fill("#a-pass", "secret1");
    await p.click("button[type=submit]");
    await p.waitForSelector(".gcard");
    return p;
  };
  await ctx.addInitScript(() => localStorage.removeItem("x"));
  const A = await mk("alice"), B = await mk("bob");
  // amis
  await A.evaluate(() => (location.hash = "/amis"));
  await A.fill(".joinbar input", "bob"); await A.click(".joinbar button");
  await B.evaluate(() => (location.hash = "/amis"));
  await B.waitForSelector("text=Demandes reçues");
  await B.screenshot({ path: OUT + "/m-friend-request.png" });
  await B.click("text=Accepter");
  await A.waitForSelector("text=Mes amis (1)");
  console.log("amis : ok");
  // salon
  await B.evaluate(() => (location.hash = "/"));
  await A.evaluate(() => (location.hash = "/"));
  await A.click('.gcard[aria-label="Puissance 4"]');
  await A.click("text=Entre amis");
  await A.click('.modecard:has-text("Match en 3")');
  await A.click('.modecard:has-text("Classique")');
  await A.click("text=Créer un salon");
  await A.waitForSelector(".code-big");
  await okRules(A);
  await A.waitForSelector(".lobby-set");
  if (!(await A.textContent(".lobby .card h3, .lobby .card .h3")).includes("Classique")) errs.push("mode non affiché dans le salon");
  const code = await A.textContent(".code-big");
  await A.click(".lobby button:has-text('Inviter'):not(:has-text('Inviter un'))".replace(":not(:has-text('Inviter un'))", "") ).catch(() => {});
  // bouton Inviter de la ligne d'ami (pas le bouton de partage)
  const btns = await A.$$(".lobby .item button");
  await btns[0].click();
  await B.waitForSelector("text=Invitations", { timeout: 8000 });
  await B.screenshot({ path: OUT + "/m-invite.png" });
  await B.click(".item button:has-text('Jouer')");
  await B.waitForSelector(".code-big");
  await okRules(B);
  await A.waitForFunction(() => document.querySelectorAll(".seat:not(.emptyseat)").length === 2);
  await A.screenshot({ path: OUT + "/m-lobby.png" });
  console.log("salon", code, ": 2 joueurs");
  await A.click("text=Lancer la partie");
  await Promise.all([A.waitForSelector(".p4-board"), B.waitForSelector(".p4-board")]);
  // on joue en cliquant les colonnes
  const play = async (P) => P.evaluate(async () => {
    const { ctl, game, me } = window.__room;
    const { rng, newSeed } = await import("/js/engine.js");
    const st = ctl.room.state;
    if (ctl.room.status !== "playing" || !game.toAct(st).includes(me)) return false;
    const a = game.bot(st, me, rng(newSeed()));
    document.querySelectorAll(".p4-col")[a.col].click();
    return true;
  });
  for (let k = 0; k < 80; k++) {
    const done = await A.evaluate(() => window.__room.ctl.room.status === "done");
    if (done) break;
    await play(A); await A.waitForTimeout(120); await play(B); await B.waitForTimeout(120);
  }
  await A.waitForSelector(".result .place", { timeout: 10000 });
  await B.waitForSelector(".result .place", { timeout: 10000 });
  await A.waitForTimeout(1500);
  await A.screenshot({ path: OUT + "/m-result-a.png" });
  await B.screenshot({ path: OUT + "/m-result-b.png" });
  console.log("résultat A :", await A.textContent(".result .place"), await A.textContent(".result .gains"));
  console.log("résultat B :", await B.textContent(".result .place"), await B.textContent(".result .gains"));
  // revanche
  await A.click(".result button:has-text('Revanche')");
  await B.waitForFunction(() => window.__room.ctl.room.status === "playing" && window.__room.ctl.room.state.round === 1);
  console.log("revanche : ok");
  // course simultanée : sudoku à deux humains
  await A.evaluate(() => { document.querySelectorAll(".sheet-wrap").forEach((x) => x.remove()); location.hash = "/"; });
  await B.evaluate(() => { document.querySelectorAll(".sheet-wrap").forEach((x) => x.remove()); location.hash = "/"; });
  await A.waitForSelector(".gcard");
  const room = await A.evaluate(async () => {
    const { A: app } = await import("/js/app.js");
    const r = await app.api.rooms.create("sudoku", 4, { level: 1 }, app.me());
    location.hash = "/salon/" + r.code; return r.code;
  });
  await A.waitForSelector(".code-big");
  await B.evaluate((c) => (location.hash = "/salon/" + c), room);
  await A.waitForFunction(() => document.querySelectorAll(".seat:not(.emptyseat)").length === 2);
  for (const P of [A, B]) await okRules(P);
  await A.click("text=Lancer la partie");
  await Promise.all([A.waitForSelector(".sd-grid"), B.waitForSelector(".sd-grid")]);
  const racer = (P) => P.evaluate(async () => {
    const { ctl, game, me } = window.__room;
    const { rng, newSeed } = await import("/js/engine.js");
    let n = 0;
    while (ctl.room.status === "playing" && n < 200) {
      const a = game.bot(JSON.parse(JSON.stringify(ctl.room.state)), me, rng(newSeed()));
      if (a) await ctl.act(a);
      n++;
      await new Promise((ok) => setTimeout(ok, 5 + Math.random() * 20));
    }
    return n;
  });
  const [na, nb] = await Promise.all([racer(A), racer(B)]);
  await A.waitForSelector(".result .place", { timeout: 10000 });
  const scores = await A.evaluate(() => window.__room.ctl.room.state.scores);
  console.log("sudoku en course :", na, nb, "actions, scores", JSON.stringify(scores));
  const filled = await A.evaluate(() => window.__room.ctl.room.state.grid.every((x) => x));
  console.log("grille complète :", filled);
  if (!filled) errs.push("grille sudoku incomplète");
  await A.screenshot({ path: OUT + "/m-sudoku-end.png" });
  // statistiques : bilan et rival
  await A.evaluate(() => { document.querySelectorAll(".sheet-wrap").forEach((x) => x.remove()); location.hash = "/stats"; });
  await A.waitForSelector(".kpis");
  await A.waitForSelector("text=Face à tes adversaires");
  if (!/parties? jouées?/.test(await A.textContent(".kpis"))) errs.push("stats : total absent");
  await A.screenshot({ path: OUT + "/m-stats.png", fullPage: true });
  console.log("stats : ok");
  // classement
  await A.evaluate(() => { location.hash = "/classement"; });
  await A.waitForSelector(".podium");
  await A.screenshot({ path: OUT + "/m-rank.png" });
  console.log(errs.join("\n") || "aucune erreur");
  if (errs.length) process.exitCode = 1;
  await b.close();
})();
