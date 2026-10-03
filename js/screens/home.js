// Accueil : salut, coffre du jour, code de salon, invitations, parties en cours, jeux.
import { h, tile, icon, gem, toast, sfx, sheet, confetti, fmt, buzz } from "../ui.js";
import { mascotSVG } from "../avatar.js";
import { GAMES, CATS, gameInfo, SETTINGS, BOT_LEVEL, TURN_TIME } from "../games/index.js";
import { REWARDS } from "../catalog.js";

let cat = "Tous";
// illustrations facultatives : ajouter l'identifiant du jeu ici après avoir déposé assets/covers/<id>.webp
const COVERS = ["poker", "blackjack", "huit", "bowling", "sudoku", "fleches", "motus", "motsmeles", "yams", "puissance4", "dames", "bataille"];
const coverUrl = (id) => (COVERS.includes(id) ? `assets/covers/${id}.webp` : "");

export function render(A, main) {
  const p = A.profile;
  const hour = new Date().getHours();
  const hello = hour < 6 ? "Encore debout" : hour < 12 ? "Bonjour" : hour < 18 ? "Salut" : "Bonsoir";
  const wrap = h("div", { class: "wrap-w" });

  const hero = h("div", { class: "hero glass" },
    h("div", { html: mascotSVG(p.equipped, 78, { bg: false }) }),
    h("div", { class: "grow" },
      h("div", { class: "h2" }, `${hello} ${p.display_name} !`),
      h("p", { class: "lead small" }, p.games ? `${fmt(p.games)} parties jouées, ${fmt(p.wins)} victoires. On remet ça ?` : "Choisis un jeu, invite tes amis ou affronte les robots.")));

  const daily = dailyCard(A);

  const code = h("input", { class: "input code grow", maxlength: 5, placeholder: "CODE", "aria-label": "Code du salon", autocapitalize: "characters", autocomplete: "off",
    oninput: (e) => (e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")) });
  const join = h("form", { class: "joinbar glass", onsubmit: (e) => { e.preventDefault(); const c = code.value.trim(); if (c.length !== 5) { toast("Le code fait 5 caractères.", "err"); return; } A.go("/salon/" + c); } },
    code, h("button", { class: "btn green", type: "submit" }, "Rejoindre"));

  const invBox = h("div");
  const roomsBox = h("div");
  const drawInv = () => {
    invBox.replaceChildren();
    if (!A.invites.length) return;
    invBox.append(h("div", { class: "section" }, h("div", { class: "h3" }, "Invitations")),
      h("div", { class: "list" }, A.invites.map((inv) => {
        const g = gameInfo(inv.game) || { name: "Jeu", icon: "jouer", color: "#6C5CE7" };
        return h("div", { class: "item glass" }, tile(g.icon, 46, g.color),
          h("div", { class: "grow" }, h("div", null, g.name), h("div", { class: "small dim" }, `${inv.from ? inv.from.display_name : "Un ami"} t'invite`)),
          h("button", { class: "iconbtn", "aria-label": "Refuser", onclick: async () => { await A.api.deleteInvite(inv.id); A.invites = A.invites.filter((i) => i.id !== inv.id); drawInv(); } }, icon("croix", 18)),
          h("button", { class: "btn green small", onclick: () => A.go("/salon/" + inv.code) }, "Jouer"));
      })));
  };
  const drawRooms = async () => {
    try {
      const rooms = await A.api.rooms.mine();
      roomsBox.replaceChildren();
      if (!rooms.length) return;
      roomsBox.append(h("div", { class: "section" }, h("div", { class: "h3" }, "Parties en cours")),
        h("div", { class: "list" }, rooms.map((r) => {
          const g = gameInfo(r.game) || { name: r.game, icon: "jouer", color: "#6C5CE7" };
          return h("button", { class: "item glass", onclick: () => A.go("/salon/" + r.code) }, tile(g.icon, 46, g.color),
            h("div", { class: "grow", style: { textAlign: "left" } }, h("div", null, g.name),
              h("div", { class: "small dim" }, `${r.status === "lobby" ? "Salon" : "En jeu"} · ${r.players.filter((x) => !x.left).length} joueurs · code ${r.code}`)),
            icon("jouer", 24));
        })));
    } catch {}
  };
  drawInv(); drawRooms();

  const chips = h("div", { class: "cats", role: "tablist" });
  const grid = h("div", { class: "games" });
  const drawGames = () => {
    chips.replaceChildren(...CATS.map((c) => h("button", { class: "chip" + (c === cat ? " on" : ""), role: "tab", "aria-selected": c === cat ? "true" : "false", onclick: () => { cat = c; sfx.tap(); drawGames(); } }, c)));
    grid.replaceChildren(...GAMES.filter((g) => cat === "Tous" || g.cat === cat).map((g) => gameCard(A, g)));
  };
  drawGames();

  wrap.append(hero, daily, h("div", { style: { height: "12px" } }), join, invBox, roomsBox,
    h("div", { class: "section" }, h("div", { class: "h3" }, "Les jeux"), h("span", { class: "small dim" }, `${GAMES.length} jeux`)), chips, grid);
  main.append(wrap);
  const onInv = () => drawInv();
  window.addEventListener("jeux:invites", onInv);
  return () => window.removeEventListener("jeux:invites", onInv);
}

function gameCard(A, g) {
  const st = (A.profile.stats || {})[g.id];
  return h("button", { class: "gcard", style: `--gc:${g.color}`, "aria-label": g.name, onclick: () => { sfx.tap(); openGame(A, g.id); } },
    coverUrl(g.id) ? h("div", { class: "cover", style: { backgroundImage: `url(${coverUrl(g.id)})` } }) : null,
    h("div", { class: "shine" }),
    coverUrl(g.id) ? null : h("div", { class: "art" }, tile(g.icon, 54, g.color)),
    h("div", { class: "nm" }, g.name),
    h("div", { class: "meta" },
      h("span", { class: "badge" }, g.min === g.max ? `${g.min} joueurs` : `${g.min}-${g.max} joueurs`),
      st && st.w ? h("span", { class: "badge" }, `${st.w} victoire${st.w > 1 ? "s" : ""}`) : null));
}

// ------------------------------------------------ coffre du jour
function dailyCard(A) {
  const p = A.profile;
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  const ready = p.daily_last !== today;
  const streak = ready ? (p.daily_streak || 0) : p.daily_streak || 1;
  const next = REWARDS.daily[Math.min((ready ? streak + 1 : streak + 1), 7) - 1];
  const card = h("button", { class: "daily" + (ready ? "" : " taken"), style: { width: "100%", marginTop: "12px", textAlign: "left" }, onclick: () => ready && openDaily(A) },
    h("img", { class: "chest", src: "assets/img/coffre.webp", width: 72, height: 72, alt: "" }),
    h("div", { class: "grow" },
      h("div", { class: "h3" }, ready ? "Ton coffre du jour est prêt !" : "Coffre ouvert, reviens demain"),
      h("div", { class: "small", style: { opacity: ".9" } }, ready ? "Touche pour l'ouvrir" : `Demain : ${next} gemmes`),
      h("div", { class: "streak" }, Array.from({ length: 7 }, (_, i) => h("i", { class: i < Math.min(streak, 7) ? "on" : "" })))));
  return card;
}

export async function openDaily(A) {
  const p = A.profile;
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  if (p.daily_last === today) { toast("Déjà ouvert aujourd'hui. Reviens demain !"); return; }
  const box = h("div", { class: "stack center", style: { alignItems: "center", padding: "10px 0 6px" } });
  const chest = h("img", { class: "chest-anim", src: "assets/img/coffre.webp", width: 190, height: 190, alt: "Coffre du jour" });
  const txt = h("div", { class: "h2" }, "Touche le coffre !");
  box.append(chest, txt);
  const s = sheet(box, { title: "Coffre du jour" });
  let opened = false;
  chest.addEventListener("click", async () => {
    if (opened) return; opened = true;
    chest.classList.add("shake"); buzz(40);
    try {
      const r = await A.api.daily();
      await new Promise((ok) => setTimeout(ok, 900));
      chest.classList.remove("shake"); chest.classList.add("open");
      chest.src = "assets/img/coffre-ouvert.webp";
      if (r.ok) {
        confetti(90); sfx.win();
        txt.replaceChildren(h("span", { class: "row gap center" }, "+", fmt(r.gems), " ", gem(30)));
        box.append(h("p", { class: "lead" }, `Série de ${r.streak} jour${r.streak > 1 ? "s" : ""}. Plus tu reviens, plus le coffre grossit.`),
          h("button", { class: "btn gold block", onclick: () => s.close() }, "Super !"));
        A.setProfile(r.profile);
        if (A.route === "") A.go("/");
      } else { txt.textContent = "Déjà ouvert aujourd'hui."; }
    } catch (e) { toast(e.message, "err"); s.close(); }
  });
}


// ------------------------------------------------ fiche d'un jeu
export async function openGame(A, id) {
  const g = gameInfo(id);
  const mod = await import(`../games/${id}.js`);
  const meta = mod.meta;
  const conf = {};
  const optsBox = h("div", { class: "opts" });
  const opt = ([key, label, values, def]) => {
    conf[key] = def;
    const row = h("div", { class: "stepper" });
    const draw = () => row.replaceChildren(...values.map(([v, t]) => h("button", { type: "button", class: conf[key] === v ? "on" : "", onclick: () => { conf[key] = v; sfx.tap(); draw(); } }, t)));
    draw();
    return h("div", { class: "opt" }, h("span", { class: "lab" }, label), row);
  };
  for (const s of SETTINGS[id] || []) optsBox.append(opt(s));
  conf.bots = g.min >= 2 ? Math.min(g.max - 1, Math.max(1, g.def - 1)) : 0;
  const botsRow = h("div", { class: "stepper" });
  const drawBots = () => botsRow.replaceChildren(...Array.from({ length: g.max - (g.min >= 2 ? 1 : 0) }, (_, i) => i + (g.min >= 2 ? 1 : 0))
    .filter((n) => n <= g.max - 1).map((n) => h("button", { type: "button", class: conf.bots === n ? "on" : "", onclick: () => { conf.bots = n; sfx.tap(); drawBots(); } }, n === 0 ? "Seul" : n)));
  drawBots();
  const levelOpt = opt(BOT_LEVEL);
  const turnOpt = opt([TURN_TIME[0], TURN_TIME[1], TURN_TIME[2], meta.turnTime ? Math.min(60, meta.turnTime <= 30 ? 20 : meta.turnTime <= 45 ? 40 : 60) : 0]);

  const body = h("div", { class: "stack" },
    h("div", { class: "gsheet-cover", style: `--gc:${g.color}` + (coverUrl(id) ? `;background-image:linear-gradient(180deg,transparent 30%,rgba(0,0,0,.45)),url(${coverUrl(id)})` : "") },
      h("div", { class: "row gap" }, tile(g.icon, 56, g.color), h("div", null, h("div", { class: "h1" }, meta.name), h("div", { class: "small" }, meta.desc)))),
    h("ol", { class: "rules" }, meta.rules.map((r) => h("li", null, r))),
    optsBox.childNodes.length ? h("div", { class: "card glass" }, h("div", { class: "h3", style: { marginBottom: "10px" } }, "Réglages"), optsBox) : null,
    h("div", { class: "card glass stack" },
      h("div", { class: "row between" }, h("div", { class: "h3" }, "Solo"), h("span", { class: "small dim" }, "contre les robots")),
      h("div", { class: "opt" }, h("span", { class: "lab" }, g.min >= 2 ? "Robots" : "Robots (facultatif)"), botsRow),
      levelOpt,
      h("button", { class: "btn green block", onclick: () => { s.close(); startSolo(A, id, conf); } }, icon("robot", 22), "Jouer en solo")),
    h("div", { class: "card glass stack" },
      h("div", { class: "row between" }, h("div", { class: "h3" }, "Entre amis"), h("span", { class: "small dim" }, `jusqu'à ${g.max} joueurs`)),
      g.max > 1 ? turnOpt : null,
      g.max > 1 ? h("button", { class: "btn block", onclick: () => { s.close(); createRoom(A, id, conf); } }, icon("salon", 22), "Créer un salon")
        : h("p", { class: "lead small" }, "Ce jeu se joue seul.")));
  const s = sheet(body, { title: g.name });
}

function pickSettings(id, conf) {
  const out = {};
  for (const [k] of SETTINGS[id] || []) if (conf[k] !== "" && conf[k] != null) out[k] = conf[k];
  return out;
}

export function startSolo(A, id, conf) {
  const settings = { ...pickSettings(id, conf), level: conf.level, turnTime: 0 };
  sessionStorage.setItem("jeux.solo", JSON.stringify({ id, settings, bots: conf.bots }));
  A.go("/solo/" + id);
}

export async function createRoom(A, id, conf) {
  const g = gameInfo(id);
  const settings = { ...pickSettings(id, conf), level: conf.level || 2 };
  if (conf.turnTime != null) settings.turnTime = conf.turnTime;
  try {
    const room = await A.api.rooms.create(id, g.max, settings, A.me());
    A.go("/salon/" + room.code);
  } catch (e) { toast(e.message, "err"); }
}
