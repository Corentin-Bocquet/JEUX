// Point d'entrée : session, thème, barre du haut, barre d'onglets et routes.
import { h, $, installDefs, icon, gem, toast, fmt, sfx, countUp } from "./ui.js";
import { mascotSVG, avatarHTML } from "./avatar.js";
import { levelOf, equipOf } from "./catalog.js";

const params = new URLSearchParams(location.search);
const MOCK = params.has("mock");

// ------------------------------------------------ thème
export const theme = {
  get pref() { try { return localStorage.getItem("jeux.theme") || "system"; } catch { return "system"; } },
  set(v) { try { localStorage.setItem("jeux.theme", v); } catch {} this.apply(); },
  apply() {
    const p = this.pref;
    const dark = p === "dark" || (p === "system" && !matchMedia("(prefers-color-scheme: light)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.content = dark ? "#141432" : "#EEF0FF";
  },
};
theme.apply();
matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => theme.apply());

// ------------------------------------------------ contexte partagé
export const A = {
  api: null, profile: null, online: new Set(), invites: [], friends: [], route: null, cleanup: null,
  me() { const p = A.profile; return { name: p.display_name, avatar: equipOf(p.equipped), photo: p.avatar_url || null }; },
  setProfile(p, { gained } = {}) {
    if (!p) return;
    const before = A.profile;
    A.profile = p;
    renderTop(before, gained);
  },
  go(route) { if (location.hash === "#" + route) navigate(); else location.hash = route; },
};

const ROUTES = {
  "": () => import("./screens/home.js"),
  amis: () => import("./screens/friends.js"),
  classement: () => import("./screens/rank.js"),
  boutique: () => import("./screens/shop.js"),
  profil: () => import("./screens/profile.js"),
  salon: () => import("./screens/room.js"),
  solo: () => import("./screens/room.js"),
};
const TABS = [["", "jouer", "Jouer"], ["amis", "amis", "Amis"], ["classement", "classement", "Classement"], ["boutique", "boutique", "Boutique"], ["profil", "profil", "Profil"]];

let shell, main, top, tabs;

function buildShell() {
  if (!document.querySelector(".aurora")) document.body.append(h("div", { class: "aurora", "aria-hidden": "true" }, h("i"), h("i"), h("i")));
  top = h("header", { class: "topbar" });
  main = h("main", { class: "view", id: "view" });
  tabs = h("nav", { class: "tabbar glass", "aria-label": "Navigation" },
    TABS.map(([r, ic, lab]) => h("button", { type: "button", "data-r": r, "aria-label": lab, title: lab, onclick: () => { sfx.tap(); A.go("/" + r); } }, icon(ic, 28))));
  shell = h("div", { id: "app" }, top, main);
  document.getElementById("root").replaceWith(shell);
  document.body.append(tabs);
}

function renderTop(before, gained) {
  const p = A.profile;
  if (!p || !top) return;
  const L = levelOf(p.xp);
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  const dailyReady = p.daily_last !== today;
  top.replaceChildren(
    h("button", { class: "top-av", "aria-label": "Mon profil", onclick: () => A.go("/profil") },
      h("div", { class: "avwrap", html: p.avatar_url ? avatarHTML({ photo: p.avatar_url }, 48) : mascotSVG(p.equipped, 48) }),
      h("span", { class: "lvl" }, L.lvl)),
    h("div", { class: "top-xp" },
      h("div", { class: "nm" }, p.display_name),
      h("div", { class: "bar", title: `${L.cur} / ${L.need} XP` }, h("i", { style: { width: Math.round((100 * L.cur) / L.need) + "%" } }))),
    h("button", { class: "iconbtn glass chest-btn" + (dailyReady ? " ready" : ""), "aria-label": "Coffre du jour", onclick: () => import("./screens/home.js").then((m) => m.openDaily(A)) }, icon("coffre", 24)),
    h("button", { class: "pill gems glass", "aria-label": "Gemmes, ouvrir la boutique", onclick: () => A.go("/boutique") }, gem(22), h("span", { id: "gemcount" }, fmt(p.gems))),
  );
  if (before && gained !== false && p.gems > before.gems) {
    const el = $("#gemcount"); countUp(el, before.gems, p.gems); sfx.coin();
  }
  if (before && levelOf(before.xp).lvl < L.lvl) { toast(`Niveau ${L.lvl} atteint !`, "ok"); sfx.win(); }
}

function setTabs(r) {
  for (const b of tabs.querySelectorAll("button")) b.classList.toggle("on", b.dataset.r === r);
  const inGame = r === "salon" || r === "solo";
  tabs.classList.toggle("hide", inGame);
  top.style.display = inGame ? "none" : "";
  const badge = tabs.querySelector('[data-r="amis"]');
  const pend = A.friends.filter((f) => f.incoming).length;
  badge.querySelector(".dot")?.remove();
  if (pend) badge.append(h("span", { class: "dot" }));
}

async function navigate() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [r, ...rest] = raw.split("/");
  const key = ROUTES[r] ? r : "";
  if (A.cleanup) { try { A.cleanup(); } catch {} A.cleanup = null; }
  A.route = key;
  setTabs(key);
  main.className = "view" + (key === "salon" || key === "solo" ? " full" : "");
  main.replaceChildren();
  main.scrollTop = 0;
  try {
    const mod = await ROUTES[key]();
    if (A.route !== key) return;
    A.cleanup = (await mod.render(A, main, { route: key, args: rest })) || null;
  } catch (e) {
    console.error(e);
    main.replaceChildren(h("div", { class: "empty" }, "Oups, ce n'est pas passé : ", e.message || String(e)));
  }
}
A.refreshTabs = () => setTabs(A.route);

// ------------------------------------------------ démarrage
async function boot() {
  installDefs();
  const mod = MOCK ? await import("./mock.js") : await import("./api.js");
  A.api = mod.createApi();
  let user = null;
  try { user = await A.api.init(); } catch (e) { console.error(e); }
  A.api.onAuth((ev, u) => {
    if (ev === "SIGNED_OUT") location.reload();
    if (ev === "PASSWORD_RECOVERY") import("./screens/auth.js").then((m) => m.newPassword(A));
  });
  if (!user) return showAuth();
  await enter();
}

export async function enter() {
  try { A.profile = await A.api.profile(); }
  catch (e) { toast(e.message, "err"); return showAuth(); }
  if (!shell) buildShell();
  renderTop();
  window.addEventListener("hashchange", navigate);
  // code de salon passé dans le lien d'invitation
  const code = params.get("code");
  if (code) { history.replaceState(null, "", location.pathname + (MOCK ? "?mock=1" : "") + "#/salon/" + code.toUpperCase()); }
  navigate();
  live();
}

function live() {
  const api = A.api;
  const loadFriends = async () => { try { A.friends = await api.friends(); A.refreshTabs(); window.dispatchEvent(new Event("jeux:friends")); } catch {} };
  const loadInv = async (p) => {
    try {
      const before = new Set(A.invites.map((i) => i.id));
      A.invites = await api.invites();
      const nw = A.invites.find((i) => !before.has(i.id));
      if (nw && p) { sfx.turn(); toast(`${nw.from ? nw.from.display_name : "Un ami"} t'invite à jouer !`, "ok"); }
      window.dispatchEvent(new Event("jeux:invites"));
    } catch {}
  };
  loadFriends(); loadInv();
  api.onFriends(loadFriends);
  api.onInvites((p) => loadInv(p || true));
  api.onOnline((set) => { A.online = set; window.dispatchEvent(new Event("jeux:online")); });
  setInterval(loadInv, 30000);
}

async function showAuth() {
  installDefs();
  if (!document.querySelector(".aurora")) document.body.append(h("div", { class: "aurora", "aria-hidden": "true" }, h("i"), h("i"), h("i")));
  const m = await import("./screens/auth.js");
  m.render(A, document.getElementById("root"));
}

boot();
