const { chromium } = require("playwright");
const OUTDIR = process.argv[2] || "test-results"; require("fs").mkdirSync(OUTDIR, { recursive: true });
const GAMES = (process.argv[3] || "puissance4,yams,huit,blackjack,poker,bataille,dames,sudoku,motus,motsmeles,fleches,bowling").split(",");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, colorScheme: "dark" });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("PAGEERR " + e.message + " " + (e.stack || "").split("\n").slice(0, 3).join(" | ")));
  p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errs.push("CONSOLE " + m.text()); });
  await p.goto((process.env.BASE || "http://localhost:8765") + "/?mock=1");
  await p.waitForSelector("#a-pseudo");
  // le formulaire doit être réellement visible (rien ne doit le recouvrir)
  const onTop = await p.evaluate(() => { const r = document.querySelector("#a-pseudo").getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.id; });
  if (onTop !== "a-pseudo") errs.push("écran de connexion recouvert par : " + onTop);
  await p.fill("#a-pseudo", "testeur"); await p.fill("#a-email", "t@t.fr"); await p.fill("#a-pass", "secret1");
  await p.click("button[type=submit]");
  await p.waitForSelector(".gcard");
  for (const g of GAMES) {
    const t0 = Date.now();
    await p.evaluate((g) => { sessionStorage.setItem("jeux.solo", JSON.stringify({ id: g, settings: { level: 2, turnTime: 0, rounds: 2, hands: 6, frames: 5, len: 5, words: 12, size: 10 }, bots: ["puissance4","dames","bataille"].includes(g) ? 1 : 2 })); location.hash = "/solo/" + g; }, g);
    // première partie : la fenêtre des règles doit apparaître et lancer la partie une fois fermée
    await p.waitForSelector("text=J'ai compris, on joue !", { timeout: 8000 });
    await p.click("text=J'ai compris, on joue !");
    await p.waitForFunction(() => window.__room && window.__room.ctl.room && window.__room.ctl.room.status === "playing", null, { timeout: 15000 });
    await p.waitForTimeout(600);
    await p.screenshot({ path: `${OUTDIR}/g-${g}-1.png` });
    // l'humain joue comme un robot, les vrais robots jouent seuls
    let shots = 0;
    const res = await p.evaluate(async (g) => {
      const { ctl, game, me } = window.__room;
      const { rng, newSeed } = await import("/js/engine.js");
      const t0 = Date.now();
      let n = 0;
      while (Date.now() - t0 < 240000) {
        const r = ctl.room;
        if (!r) return "salon perdu";
        if (r.status === "done") return "fini en " + n + " coups";
        const st = r.state;
        if (st && game.toAct(st).includes(me)) {
          const a = game.bot(JSON.parse(JSON.stringify(st)), me, rng(newSeed()));
          if (a) { await ctl.act(a); n++; }
        }
        await new Promise((ok) => setTimeout(ok, game.meta.race ? 150 : 60));
        for (const k of Object.keys(ctl.botAt)) ctl.botAt[k] = Math.min(ctl.botAt[k], Date.now() + 150);
        if (n === 6 && !window.__shot) { window.__shot = 1; }
      }
      return "TROP LONG";
    }, g);
    await p.waitForTimeout(900);
    await p.screenshot({ path: `${OUTDIR}/g-${g}-2.png` });
    const sheetTxt = await p.evaluate(() => (document.querySelector(".sheet .place") || {}).textContent || "pas de résultat");
    if (!/^fini/.test(res) || !/Victoire|place|Égalité/.test(sheetTxt)) { errs.push(g + " : " + res + " / " + sheetTxt); }
    console.log(g, "->", res, "|", sheetTxt, "|", ((Date.now() - t0) / 1000).toFixed(1) + "s");
    await p.evaluate(() => { document.querySelectorAll(".sheet-wrap").forEach((x) => x.remove()); location.hash = "/"; window.__room = null; window.__shot = 0; });
    await p.waitForTimeout(400);
  }
  console.log(errs.join("\n") || "aucune erreur");
  if (errs.length) process.exitCode = 1;
  await b.close();
})();
