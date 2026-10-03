// Accueil : salut, coffre du jour, code de salon, invitations, parties en cours, jeux.
import { h, tile, icon, gem, toast, sfx, sheet, confetti, fmt, buzz } from "../ui.js";
import { mascotSVG } from "../avatar.js";
import { GAMES, CATS, gameInfo } from "../games/index.js";
import { gameOptions, restore, picker, carousel, modeOf } from "./settings.js";
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
      h("p", { class: "lead small" }, p.games ? `${fmt(p.games)} parties jouées, ${fmt(p.wins)} victoires. On remet ça ?` : "Choisis un jeu, invite tes amis ou affronte les robots."),
      p.games ? h("a", { class: "small link", href: "#/stats" }, "📊 Mes statistiques") : null));

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

  // ---------------- jeux : favoris, plus joués, catalogue trié
  const favBox = h("div"), topBox = h("div");
  const search = h("input", { class: "input search", type: "search", placeholder: "Chercher un jeu…", "aria-label": "Chercher un jeu", autocomplete: "off",
    value: query, oninput: (e) => { query = e.target.value; drawGrid(); } });
  const sortSel = h("div", { class: "sortbar" });
  const chips = h("div", { class: "cats", role: "tablist" });
  const grid = h("div", { class: "games" });
  const count = h("span", { class: "small dim" });
  const drawShelves = () => {
    const favs = favorites(A).map(gameInfo).filter(Boolean);
    favBox.replaceChildren(...(favs.length ? [h("div", { class: "section" }, h("div", { class: "h3" }, "❤️ Tes favoris"), h("span", { class: "small dim" }, favs.length)),
      h("div", { class: "shelf" }, favs.map((g) => miniCard(A, g)))] : []));
    const top = played(A).slice(0, 8);
    topBox.replaceChildren(...(top.length ? [h("div", { class: "section" }, h("div", { class: "h3" }, "🔥 Tes plus joués"), h("a", { class: "small link", href: "#/stats" }, "Mes stats")),
      h("div", { class: "shelf" }, top.map((g) => miniCard(A, g)))] : []));
  };
  const drawGrid = () => {
    chips.replaceChildren(...CATS.map((c) => h("button", { class: "chip" + (c === cat ? " on" : ""), role: "tab", "aria-selected": c === cat ? "true" : "false", onclick: () => { cat = c; sfx.tap(); drawGrid(); } }, c)));
    sortSel.replaceChildren(...SORTS.map(([k, t]) => h("button", { class: "chip small" + (k === sort ? " on" : ""), onclick: () => { sort = k; sfx.tap(); drawGrid(); } }, t)));
    const q = norm(query.trim());
    const list = sorted(A, GAMES.filter((g) => (cat === "Tous" || g.cat === cat) && (!q || norm(g.name + " " + (g.full || "") + " " + g.cat).includes(q))));
    grid.replaceChildren(...list.map((g) => gameCard(A, g, refresh)));
    if (!list.length) grid.replaceChildren(h("p", { class: "lead small dim", style: { gridColumn: "1/-1" } }, "Aucun jeu ne correspond."));
    count.textContent = `${list.length} jeu${list.length > 1 ? "x" : ""}`;
  };
  const refresh = () => { drawShelves(); drawGrid(); };
  refresh();

  wrap.append(hero, daily, h("div", { style: { height: "12px" } }), join, invBox, roomsBox, favBox, topBox,
    h("div", { class: "section" }, h("div", { class: "h3" }, "Tous les jeux"), count), search, chips, sortSel, grid);
  main.append(wrap);
  const onInv = () => drawInv();
  const onFav = () => refresh();
  window.addEventListener("jeux:invites", onInv);
  window.addEventListener("jeux:favoris", onFav);
  return () => { window.removeEventListener("jeux:invites", onInv); window.removeEventListener("jeux:favoris", onFav); };
}

const SORTS = [["top", "Plus joués"], ["fav", "Favoris d'abord"], ["az", "A à Z"], ["win", "Mes meilleurs"]];
let sort = "top", query = "";
const norm = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const statOf = (A, id) => ((A.profile.stats || {})[id]) || { p: 0, w: 0 };
export const favorites = (A) => (A.profile.favorites || []).filter((id) => gameInfo(id));
export const isFav = (A, id) => favorites(A).includes(id);
// jeux joués, du plus joué au moins joué
export const played = (A) => GAMES.filter((g) => statOf(A, g.id).p > 0).sort((a, b) => statOf(A, b.id).p - statOf(A, a.id).p);
function sorted(A, list) {
  const idx = (g) => GAMES.indexOf(g), fav = (g) => (isFav(A, g.id) ? 1 : 0), p = (g) => statOf(A, g.id).p;
  const rate = (g) => { const s = statOf(A, g.id); return s.p ? (s.w + 1) / (s.p + 2) : -1; };
  const by = {
    top: (a, b) => p(b) - p(a) || fav(b) - fav(a) || idx(a) - idx(b),
    fav: (a, b) => fav(b) - fav(a) || p(b) - p(a) || idx(a) - idx(b),
    az: (a, b) => a.name.localeCompare(b.name, "fr"),
    win: (a, b) => rate(b) - rate(a) || p(b) - p(a) || idx(a) - idx(b),
  }[sort];
  return list.slice().sort(by);
}

export async function toggleFav(A, id) {
  const cur = favorites(A);
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur];
  const before = A.profile;
  A.profile = { ...A.profile, favorites: next };
  buzz(15); sfx.tap();
  window.dispatchEvent(new Event("jeux:favoris"));
  try { A.setProfile(await A.api.setFavorites(next)); }
  catch (e) { A.profile = before; window.dispatchEvent(new Event("jeux:favoris")); toast(e.message, "err"); }
  return next.includes(id);
}

const heart = (A, g) => h("button", { class: "fav" + (isFav(A, g.id) ? " on" : ""), type: "button", "aria-label": isFav(A, g.id) ? `Retirer ${g.name} des favoris` : `Ajouter ${g.name} aux favoris`,
  onclick: (e) => { e.stopPropagation(); toggleFav(A, g.id); } }, isFav(A, g.id) ? "♥" : "♡");

function gameCard(A, g) {
  const st = statOf(A, g.id);
  const open = () => { sfx.tap(); openGame(A, g.id); };
  return h("div", { class: "gcard", role: "button", tabindex: "0", style: `--gc:${g.color}`, "aria-label": g.name, onclick: open,
    onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } } },
    coverUrl(g.id) ? h("div", { class: "cover", style: { backgroundImage: `url(${coverUrl(g.id)})` } }) : null,
    h("div", { class: "shine" }),
    coverUrl(g.id) ? null : h("div", { class: "art" }, tile(g.icon, 54, g.color)),
    heart(A, g),
    h("div", { class: "nm" }, g.name),
    h("div", { class: "meta" },
      h("span", { class: "badge" }, g.min === g.max ? `${g.min} joueurs` : `${g.min}-${g.max} joueurs`),
      st.p ? h("span", { class: "badge" }, `${st.p} partie${st.p > 1 ? "s" : ""}`) : null));
}

function miniCard(A, g) {
  const st = statOf(A, g.id);
  return h("button", { class: "minicard", style: `--gc:${g.color}`, "aria-label": g.name, onclick: () => { sfx.tap(); openGame(A, g.id); } },
    h("div", { class: "mc-art", style: coverUrl(g.id) ? { backgroundImage: `url(${coverUrl(g.id)})` } : {} }, coverUrl(g.id) ? null : tile(g.icon, 44, g.color)),
    h("div", { class: "mc-nm" }, g.name),
    h("div", { class: "mc-st" }, st.p ? `${st.p} parties · ${st.w} V` : "Jamais joué"));
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
  const { options, modes } = gameOptions(mod, id);
  const saved = (A.profile.game_prefs || {})[id] || {};
  const conf = restore(options, saved);
  conf.level = [1, 2, 3].includes(saved.level) ? saved.level : 2;
  const minBots = g.min >= 2 ? 1 : 0;
  conf.bots = Number.isInteger(saved.bots) && saved.bots >= minBots && saved.bots <= g.max - 1 ? saved.bots : (g.min >= 2 ? Math.min(g.max - 1, Math.max(1, g.def - 1)) : 0);
  const defTurn = meta.turnTime ? (meta.turnTime <= 30 ? 20 : meta.turnTime <= 45 ? 40 : 60) : 0;
  conf.turnTime = [0, 20, 40, 60].includes(saved.turnTime) ? saved.turnTime : defTurn;
  let tab = g.max > 1 && saved.tab === "amis" ? "amis" : "solo";
  const st = statOf(A, id);

  const favBtn = h("button", { class: "fav big" + (isFav(A, id) ? " on" : ""), type: "button", "aria-label": "Favori",
    onclick: async () => { const on = await toggleFav(A, id); favBtn.classList.toggle("on", on); favBtn.textContent = on ? "♥" : "♡"; if (on) toast("Ajouté à tes favoris", "ok"); } }, isFav(A, id) ? "♥" : "♡");

  const rules = h("details", { class: "rules-box glass" }, h("summary", null, "📜 Règles du jeu"), h("ol", { class: "rules" }, meta.rules.map((r) => h("li", null, r))));
  const pick = options.length ? picker({ options, modes, conf, color: g.color }) : null;

  const botItems = Array.from({ length: g.max - minBots }, (_, i) => i + minBots).filter((n) => n <= g.max - 1)
    .map((n) => ({ v: n, t: n === 0 ? "Seul" : String(n), em: n === 0 ? "🧘" : "🤖".repeat(Math.min(n, 3)), sub: n === 0 ? "Juste toi" : n === 1 ? "1 robot" : `${n} robots` }));
  const levelItems = [{ v: 1, t: "Facile", em: "🙂", sub: "Pour découvrir" }, { v: 2, t: "Moyen", em: "😎", sub: "Équilibré" }, { v: 3, t: "Fort", em: "🔥", sub: "Sans pitié" }];
  const turnItems = [{ v: 0, t: "Libre", em: "♾️", sub: "Sans chrono" }, { v: 20, t: "20 s", em: "⚡", sub: "Rapide" }, { v: 40, t: "40 s", em: "⏱️", sub: "Normal" }, { v: 60, t: "60 s", em: "🐢", sub: "Tranquille" }];

  const tabBox = h("div", { class: "stack" });
  const seg = h("div", { class: "seg" });
  const drawTab = () => {
    seg.replaceChildren(
      h("button", { class: tab === "solo" ? "on" : "", onclick: () => { tab = "solo"; sfx.tap(); drawTab(); } }, "🤖 Solo"),
      h("button", { class: tab === "amis" ? "on" : "", disabled: g.max < 2, onclick: () => { tab = "amis"; sfx.tap(); drawTab(); } }, "👥 Entre amis"));
    if (tab === "solo") tabBox.replaceChildren(
      carousel(botItems, () => conf.bots, (v) => (conf.bots = v), { label: g.min >= 2 ? "Robots adverses" : "Robots (facultatif)", icon: "🤖" }),
      carousel(levelItems, () => conf.level, (v) => (conf.level = v), { label: "Niveau des robots", icon: "🧠" }),
      h("button", { class: "btn green block big", onclick: () => { save("solo"); s.close(); startSolo(A, id, conf, modes, options); } }, icon("robot", 22), "Jouer en solo"));
    else tabBox.replaceChildren(
      carousel(turnItems, () => conf.turnTime, (v) => (conf.turnTime = v), { label: "Temps par tour", icon: "⏱️" }),
      h("p", { class: "small dim" }, `Jusqu'à ${g.max} joueurs. Tu pourras ajouter des robots dans le salon.`),
      h("button", { class: "btn block big", onclick: () => { save("amis"); s.close(); createRoom(A, id, conf, modes, options); } }, icon("salon", 22), "Créer un salon"));
  };
  drawTab();
  // mémorise les derniers réglages de ce jeu (synchronisés sur le compte)
  const save = (t) => {
    const prefs = { ...(A.profile.game_prefs || {}), [id]: { ...pickSettings(options, conf), level: conf.level, bots: conf.bots, turnTime: conf.turnTime, tab: t } };
    A.profile = { ...A.profile, game_prefs: prefs };
    A.api.setGamePrefs(prefs).then((p) => A.setProfile(p)).catch(() => {});
  };

  const body = h("div", { class: "stack gsheet" },
    h("div", { class: "gsheet-cover", style: `--gc:${g.color}` + (coverUrl(id) ? `;background-image:linear-gradient(180deg,transparent 30%,rgba(0,0,0,.45)),url(${coverUrl(id)})` : "") },
      favBtn,
      h("div", { class: "row gap" }, coverUrl(id) ? null : tile(g.icon, 56, g.color), h("div", null, h("div", { class: "h1" }, meta.name), h("div", { class: "small" }, meta.desc)))),
    h("div", { class: "gstats" },
      h("div", null, h("b", null, fmt(st.p)), h("span", null, "parties")),
      h("div", null, h("b", null, fmt(st.w)), h("span", null, "victoires")),
      h("div", null, h("b", null, st.p ? Math.round((100 * st.w) / st.p) + "%" : "-"), h("span", null, "réussite")),
      h("div", null, h("b", null, g.min === g.max ? g.min : `${g.min}-${g.max}`), h("span", null, "joueurs"))),
    rules,
    pick ? h("div", { class: "card glass" }, pick) : null,
    h("div", { class: "card glass stack" }, seg, tabBox));
  const s = sheet(body, { title: g.name });
}

function pickSettings(options, conf) {
  const out = {};
  for (const o of options) if (conf[o.key] !== "" && conf[o.key] != null) out[o.key] = conf[o.key];
  return out;
}

export function startSolo(A, id, conf, modes = [], options = []) {
  const settings = { ...pickSettings(options, conf), mode: modeOf(modes, options, conf), level: conf.level, turnTime: 0 };
  sessionStorage.setItem("jeux.solo", JSON.stringify({ id, settings, bots: conf.bots }));
  A.go("/solo/" + id);
}

export async function createRoom(A, id, conf, modes = [], options = []) {
  const g = gameInfo(id);
  const settings = { ...pickSettings(options, conf), mode: modeOf(modes, options, conf), level: conf.level || 2 };
  if (conf.turnTime != null) settings.turnTime = conf.turnTime;
  try {
    const room = await A.api.rooms.create(id, g.max, settings, A.me());
    A.go("/salon/" + room.code);
  } catch (e) { toast(e.message, "err"); }
}
