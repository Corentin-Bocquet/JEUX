// Loup-garou : la nuit les loups dévorent un villageois, le jour le village
// débat puis vote pour éliminer un suspect. Logique pure, testable sous Node.
import { fail, rng as mkRng } from "../engine.js";
import * as L from "./lib/roles.js";

export const meta = {
  id: "loupgarou", name: "Loup-garou", cat: "Soirée", min: 5, max: 8, turnTime: 45,
  color: "#1E293B", desc: "Démasque les loups avant qu'ils ne dévorent tout le village.",
  rules: [
    "Chacun reçoit un rôle secret : retourne ta carte, personne d'autre ne la voit.",
    "La nuit, les loups votent pour dévorer un villageois. La voyante découvre un rôle, la sorcière peut sauver la victime ou empoisonner quelqu'un.",
    "Le jour, on découvre les victimes, on discute en messages courts, puis tout le monde vote. Égalité : personne n'est éliminé.",
    "Le chasseur qui meurt tire une dernière fois. Cupidon (en option) lie deux amoureux : si l'un meurt, l'autre aussi.",
    "Le village gagne quand tous les loups sont morts. Les loups gagnent quand ils sont aussi nombreux que les autres.",
    "Moins de 5 joueurs ? Des robots complètent le village.",
  ],
};

export const ROLES = {
  loup: { name: "Loup-garou", emoji: "🐺", camp: "loups", color: "#B91C1C", desc: "La nuit, choisis avec la meute qui dévorer. Le jour, fais-toi passer pour un villageois." },
  villageois: { name: "Villageois", emoji: "🧑‍🌾", camp: "village", color: "#15803D", desc: "Aucun pouvoir, mais ton vote compte : trouve les loups et élimine-les." },
  voyante: { name: "Voyante", emoji: "🔮", camp: "village", color: "#7C3AED", desc: "Chaque nuit, découvre le vrai rôle d'un joueur. Aide le village sans te faire repérer." },
  sorciere: { name: "Sorcière", emoji: "🧪", camp: "village", color: "#0E7490", desc: "Une potion de vie pour sauver la victime des loups, une potion de mort pour éliminer quelqu'un. Une fois chacune." },
  chasseur: { name: "Chasseur", emoji: "🏹", camp: "village", color: "#A16207", desc: "Si tu meurs, tu tires une dernière balle sur le joueur de ton choix." },
  cupidon: { name: "Cupidon", emoji: "💘", camp: "village", color: "#DB2777", desc: "La première nuit, désigne deux amoureux. Si l'un meurt, l'autre meurt de chagrin." },
};

// ------------------------------------------------ réglages
export const options = [
  { key: "wolves", label: "Loups", icon: "🐺", values: [["auto", "Auto", "1, ou 2 dès 7"], [1, "1 loup"], [2, "2 loups"]], def: "auto" },
  { key: "cupidon", label: "Cupidon", icon: "💘", values: [[false, "Sans"], [true, "Avec", "Deux amoureux"]], def: false },
  { key: "chasseur", label: "Chasseur", icon: "🏹", values: [[true, "Avec"], [false, "Sans"]], def: true },
  { key: "reveal", label: "Rôle révélé", icon: "🃏", values: [[true, "À la mort"], [false, "À la fin", "Plus de mystère"]], def: true },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "🐺", desc: "Voyante, sorcière, chasseur, loups selon le nombre.", set: { wolves: "auto", cupidon: false, chasseur: true, reveal: true } },
  { id: "amoureux", name: "Coup de foudre", emoji: "💘", desc: "Cupidon lie deux amoureux dès la première nuit.", set: { wolves: "auto", cupidon: true, chasseur: true, reveal: true } },
  { id: "meute", name: "La meute", emoji: "🌕", desc: "Toujours deux loups, même à petit nombre.", set: { wolves: 2, cupidon: false, chasseur: true, reveal: true } },
  { id: "brouillard", name: "Brouillard", emoji: "🌫️", desc: "Rôles des morts cachés, Cupidon et pas de chasseur.", set: { wolves: "auto", cupidon: true, chasseur: false, reveal: false } },
];
const opt = (settings, key) => L.optVal(options, settings, key);

// ------------------------------------------------ outils
export const isAlive = (s, id) => !s.dead.includes(id);
export const alive = (s) => s.ids.filter((id) => isAlive(s, id));
export const isNpc = (s, id) => s.npc.includes(id);
const roleOf = (s, id) => s.roles[id];
const holder = (s, role) => s.ids.find((id) => s.roles[id] === role) || null;
const aliveWolves = (s) => alive(s).filter((id) => s.roles[id] === "loup");
export const nameIn = (s, id) => s.names[id] || "?";
export const roleLabel = (role) => `${ROLES[role].name} ${ROLES[role].emoji}`;

export function dealRoles(n, settings) {
  const w = opt(settings, "wolves");
  const wolves = w === "auto" ? (n >= 7 ? 2 : 1) : w;
  const specials = ["voyante", "sorciere"];
  if (opt(settings, "cupidon")) specials.push("cupidon");
  if (opt(settings, "chasseur")) specials.push("chasseur");
  const out = Array(wolves).fill("loup");
  for (const r of specials) if (out.length < n) out.push(r);
  while (out.length < n) out.push("villageois");
  return out;
}

// ------------------------------------------------ mise en place
export function setup(players, settings, r) {
  const all = L.fillPlayers(players, meta.min);
  const deal = r.shuffle(dealRoles(all.length, settings));
  const s = {
    ids: all.map((p) => p.id), real: players.map((p) => p.id), npc: all.filter((p) => p.npc).map((p) => p.id),
    names: Object.fromEntries(all.map((p) => [p.id, p.name])),
    roles: Object.fromEntries(all.map((p, i) => [p.id, deal[i]])),
    dead: [], lovers: null, phase: "role", night: 1, ready: {},
    potions: { life: true, death: true }, victim: null, saved: false, poison: null, seerDone: false, witchDone: false, seen: [],
    hunter: null, hunterNext: null, winner: null, news: [], days: [], intent: {},
    chat: [], chatNo: 0, talk: {}, vote: null,
    opts: { cupidon: opt(settings, "cupidon"), chasseur: opt(settings, "chasseur"), reveal: opt(settings, "reveal") },
    level: L.levelOf(settings),
  };
  if (s.npc.length) L.narrate(s, `Des robots complètent le village : ${s.npc.map((id) => s.names[id]).join(", ")}.`);
  L.narrate(s, "La partie commence. Retourne ta carte en secret pour découvrir ton rôle.");
  advance(s, r);
  return s;
}

// ------------------------------------------------ qui doit agir
function need(s) {
  if (s.winner) return [];
  switch (s.phase) {
    case "role": return s.real.filter((id) => !s.ready[id]);
    case "cupid": return s.lovers ? [] : [holder(s, "cupidon")];
    case "night": {
      const out = L.votePending(s);
      const seer = holder(s, "voyante");
      if (seer && isAlive(s, seer) && !s.seerDone) out.push(seer);
      return out;
    }
    case "witch": return s.witchDone ? [] : [holder(s, "sorciere")];
    case "hunter": return s.hunter ? [s.hunter] : [];
    case "day": return alive(s).filter((id) => !s.ready[id]);
    case "vote": return L.votePending(s);
  }
  return [];
}
export function toAct(s) { return need(s).filter((id) => !isNpc(s, id)); }

// les robots ajoutés par le jeu agissent tout de suite, puis on enchaîne les phases sans joueur réel
function advance(s, r) {
  for (let guard = 0; guard < 600 && !s.winner; guard++) {
    for (const id of need(s)) {
      if (!isNpc(s, id)) continue;
      for (let k = 0; k < 4 && need(s).includes(id); k++) handle(s, id, decide(s, id, r), r);
    }
    if (toAct(s).length || s.winner) return;
    next(s, r);
  }
}

function next(s, r) {
  switch (s.phase) {
    case "role": return startNight(s);
    case "cupid": {
      const [a, b] = s.lovers;
      L.narrate(s, "💘 Cupidon a lancé ses flèches : deux joueurs sont désormais amoureux.");
      void a; void b;
      return nightMain(s);
    }
    case "night": {
      const res = L.closeVote(s);
      s.victim = res.winner || (res.top.length ? r.pick(res.top) : null);
      s.wolfVote = res.b;
      const witch = holder(s, "sorciere");
      if (witch && isAlive(s, witch) && (s.potions.life || s.potions.death)) {
        s.phase = "witch"; s.witchDone = false;
        return;
      }
      return dawn(s);
    }
    case "witch": return dawn(s);
    case "hunter": {
      const nx = s.hunterNext;
      s.hunterNext = null;
      if (checkWin(s)) return;
      return nx === "night" ? newNight(s) : startDay(s);
    }
    case "day": {
      s.phase = "vote";
      L.openVote(s, "village", alive(s), alive(s), { skip: true });
      L.narrate(s, "🗳️ Place au vote : qui le village élimine-t-il ?");
      return;
    }
    case "vote": {
      const res = L.closeVote(s);
      s.days.push({ n: s.night, b: res.b, out: res.winner });
      s.news = [];
      if (res.winner) kill(s, res.winner, "vote");
      else note(s, res.top.length > 1 ? "Égalité au vote : personne n'est éliminé aujourd'hui." : "Le village n'a éliminé personne aujourd'hui.");
      if (s.hunter) { s.phase = "hunter"; s.hunterNext = "night"; return; }
      if (checkWin(s)) return;
      return newNight(s);
    }
  }
}

function newNight(s) { s.night++; startNight(s); }
function startNight(s) {
  s.ready = {}; L.resetTalk(s);
  s.victim = null; s.saved = false; s.poison = null; s.witchDone = false; s.wolfVote = null;
  const seer = holder(s, "voyante");
  s.seerDone = !(seer && isAlive(s, seer));
  L.narrate(s, `🌙 Nuit ${s.night} : le village s'endort.`);
  const cup = holder(s, "cupidon");
  if (s.night === 1 && cup && !s.lovers) { s.phase = "cupid"; return; }
  nightMain(s);
}
function nightMain(s) {
  s.phase = "night";
  const wolves = aliveWolves(s);
  L.openVote(s, "loups", wolves, alive(s).filter((id) => s.roles[id] !== "loup"));
  L.narrate(s, "🐺 Les loups se réveillent et choisissent leur victime…");
}
function startDay(s) {
  s.phase = "day"; s.ready = {}; s.intent = {}; L.resetTalk(s);
  L.narrate(s, `☀️ Jour ${s.night} : débattez, puis passez au vote.`);
}

function note(s, text) { s.news.push(text); L.narrate(s, text); }

function dawn(s) {
  s.news = [];
  const deaths = [];
  if (s.victim && !s.saved) deaths.push([s.victim, "loups"]);
  if (s.poison && !deaths.some((d) => d[0] === s.poison)) deaths.push([s.poison, "poison"]);
  if (!deaths.length) note(s, s.saved ? "☀️ Au réveil, personne n'est mort : quelqu'un a été sauvé cette nuit !" : "☀️ Au réveil, personne n'est mort cette nuit.");
  for (const [id, cause] of deaths) kill(s, id, cause);
  if (s.hunter) { s.phase = "hunter"; s.hunterNext = "day"; return; }
  if (checkWin(s)) return;
  startDay(s);
}

const CAUSE = {
  loups: "Au réveil, on découvre que les loups ont dévoré {X}.",
  poison: "La sorcière a empoisonné {X} pendant la nuit.",
  vote: "Le village a éliminé {X}.",
  chagrin: "{X} ne survit pas à la perte de son amour et meurt de chagrin.",
  tir: "Le chasseur tire sa dernière balle et abat {X}.",
};
function kill(s, id, cause) {
  if (!isAlive(s, id)) return;
  s.dead.push(id);
  const role = s.roles[id];
  note(s, L.fillTemplate(CAUSE[cause], { X: nameIn(s, id) }) + (s.opts.reveal ? ` C'était : ${roleLabel(role)}.` : ""));
  if (role === "chasseur" && s.opts.chasseur && cause !== "tir") s.hunter = id;
  if (s.lovers && s.lovers.includes(id)) {
    const other = s.lovers[0] === id ? s.lovers[1] : s.lovers[0];
    if (isAlive(s, other)) kill(s, other, "chagrin");
  }
}

export function campOf(s, id) { return ROLES[s.roles[id]].camp; }
function checkWin(s) {
  const al = alive(s);
  const w = al.filter((id) => s.roles[id] === "loup").length;
  const lov = s.lovers;
  let winner = null;
  if (lov && al.length === 2 && al.includes(lov[0]) && al.includes(lov[1]) && campOf(s, lov[0]) !== campOf(s, lov[1])) winner = "amoureux";
  else if (w === 0) winner = "village";
  else if (w >= al.length - w) winner = "loups";
  if (!winner) return false;
  s.winner = winner; s.phase = "end"; s.vote = null;
  const txt = { village: "🎉 Tous les loups sont morts : le village gagne !", loups: "🐺 Les loups sont assez nombreux : ils dévorent le village et gagnent !", amoureux: "💘 Les deux amoureux sont les derniers survivants : l'amour triomphe !" }[winner];
  s.news.push(txt);
  L.narrate(s, txt);
  return true;
}
export function winners(s) {
  if (!s.winner) return [];
  if (s.winner === "amoureux") return s.lovers.slice();
  return s.ids.filter((id) => campOf(s, id) === (s.winner === "loups" ? "loups" : "village"));
}

// ------------------------------------------------ actions
function handle(s, pid, a, r) {
  const ph = s.phase;
  if (a.type === "ready") {
    if (ph !== "role" && ph !== "day") fail("Pas maintenant");
    s.ready[pid] = 1;
    return;
  }
  if (a.type === "say") return talk(s, pid, a.text);
  if (a.type === "cupid") {
    if (ph !== "cupid" || roleOf(s, pid) !== "cupidon") fail("Seul Cupidon décoche des flèches");
    const x = String(a.a || ""), y = String(a.b || "");
    if (x === y || !s.ids.includes(x) || !s.ids.includes(y)) fail("Choisis deux joueurs différents");
    s.lovers = [x, y];
    return;
  }
  if (a.type === "see") {
    if (ph !== "night" || roleOf(s, pid) !== "voyante" || s.seerDone) fail("Ce n'est pas le moment");
    const t = String(a.target || "");
    if (t === pid || !s.ids.includes(t) || !isAlive(s, t)) fail("Choisis un joueur vivant");
    s.seen.push([t, s.roles[t]]);
    s.seerDone = true;
    return;
  }
  if (a.type === "vote") {
    if (ph === "night" && roleOf(s, pid) !== "loup") fail("Seuls les loups votent la nuit");
    if (ph !== "night" && ph !== "vote") fail("Pas de vote en cours");
    if (ph === "vote" && a.target === pid) fail("Tu ne peux pas voter contre toi");
    L.castVote(s, pid, a.target);
    if (ph === "vote" && a.target) s.intent[pid] = a.target;
    return;
  }
  if (a.type === "witch") {
    if (ph !== "witch" || roleOf(s, pid) !== "sorciere" || s.witchDone) fail("Ce n'est pas le moment");
    const save = !!a.save, k = a.kill ? String(a.kill) : "";
    if (save && (!s.potions.life || !s.victim)) fail("Potion de vie indisponible");
    if (k && (!s.potions.death || k === pid || !isAlive(s, k) || !s.ids.includes(k))) fail("Potion de mort impossible");
    if (k && save && k === s.victim) fail("Tu ne peux pas sauver et empoisonner la même personne");
    if (save) { s.saved = true; s.potions.life = false; }
    if (k) { s.poison = k; s.potions.death = false; }
    s.witchDone = true;
    return;
  }
  if (a.type === "shoot") {
    if (ph !== "hunter" || s.hunter !== pid) fail("Ce n'est pas le moment");
    const t = String(a.target || "");
    if (t === pid || !isAlive(s, t)) fail("Vise un joueur vivant");
    s.hunter = null;
    kill(s, t, "tir");
    return;
  }
  void r;
  fail("Action inconnue");
}

function talk(s, pid, text) {
  if (!isAlive(s, pid)) fail("Les morts ne parlent plus…");
  if (s.phase === "night" && roleOf(s, pid) === "loup") return L.say(s, pid, text, { perPhase: 3, kind: "w" });
  if (s.phase !== "day" && s.phase !== "vote") fail("On ne parle que le jour");
  return L.say(s, pid, text, { perPhase: 4 });
}

export function reduce(s, pid, a) {
  if (s.winner) fail("La partie est terminée");
  if (!s.ids.includes(pid) || isNpc(s, pid)) fail("Tu ne joues pas à cette partie");
  const r = mkRng(a.seed || 1);
  if (a.type === "say") { talk(s, pid, a.text); return s; }
  if (!toAct(s).includes(pid)) fail("Ce n'est pas à toi d'agir");
  handle(s, pid, a, r);
  advance(s, r);
  return s;
}

export function result(s) {
  if (!s.winner) return null;
  return L.teamResult(s.real, winners(s));
}

// ------------------------------------------------ robots
// soupçons : uniquement ce qui est public, plus ce que le robot sait lui-même
export function suspicion(s, pid) {
  const me = s.roles[pid];
  const others = alive(s).filter((id) => id !== pid);
  const w = Object.fromEntries(others.map((id) => [id, 1]));
  const said = s.chat.filter((m) => m.k === "say" && m.f && m.f !== pid);
  const claims = {};
  for (const m of said) {
    const ment = L.mentions(m.t, s.names).filter((id) => id !== m.f);
    const nt = L.norm(m.t);
    if (nt.includes("voyante")) claims[m.f] = (claims[m.f] || 0) + 1;
    for (const id of ment) {
      if (id in w) w[id] += 0.6;
      if (id === pid && m.f in w) w[m.f] += 0.8; // on se méfie de qui nous accuse
      if (nt.includes("loup") && nt.includes("voyante") && id in w) w[id] += me === "loup" ? 0 : 2.2;
    }
  }
  if (me === "loup") {
    for (const id of others) {
      if (s.roles[id] === "loup") { w[id] = 0; continue; }
      if (claims[id]) w[id] += 3; // une voyante qui se dévoile est une cible
    }
    return Object.entries(w);
  }
  // votes passés : voter contre un innocent révélé rend suspect
  if (s.opts.reveal) for (const d of s.days) {
    if (!d.out) continue;
    const wasWolf = s.roles[d.out] === "loup";
    for (const [voter, t] of Object.entries(d.b)) if (t === d.out && voter in w) w[voter] = Math.max(0.2, w[voter] + (wasWolf ? -0.5 : 0.7));
  }
  if (me === "voyante") for (const [t, role] of s.seen) if (t in w) w[t] = role === "loup" ? w[t] + 25 : w[t] * 0.05;
  if (s.lovers && s.lovers.includes(pid)) for (const id of s.lovers) if (id in w) w[id] = 0;
  return Object.entries(w);
}
function suspect(s, pid, r) { return L.weightedPick(r, L.sharpen(suspicion(s, pid), s.level)); }
function topSuspect(s, pid) {
  const e = suspicion(s, pid).sort((a, b) => b[1] - a[1]);
  return e.length ? e[0][0] : null;
}

const ACCUSE = [
  "Je trouve {X} beaucoup trop calme, c'est louche.",
  "{X}, tu étais où cette nuit ?",
  "Mon instinct me dit {X}.",
  "Je vote {X}, désolé.",
  "{X} évite toutes les questions…",
  "Je ne sens pas {X}, pas du tout.",
  "{X} a voté bizarrement, non ?",
  "On devrait regarder du côté de {X}.",
];
const NEUTRAL = ["Je n'ai aucune piste pour l'instant…", "Réfléchissons avant de voter.", "Quelqu'un a remarqué un truc ?", "Je suis un simple villageois, promis !"];

export function decide(s, pid, r) {
  const me = s.roles[pid];
  const others = alive(s).filter((id) => id !== pid);
  switch (s.phase) {
    case "role": return { type: "ready" };
    case "cupid": {
      const pool = s.ids.slice();
      const a = r.next() < 0.4 ? pid : r.pick(pool.filter((id) => id !== pid));
      const b = r.pick(pool.filter((id) => id !== a));
      return { type: "cupid", a, b };
    }
    case "night": {
      if (me === "voyante" && !s.seerDone) {
        const seen = new Set(s.seen.map((x) => x[0]));
        const pool = others.filter((id) => !seen.has(id));
        return { type: "see", target: r.pick(pool.length ? pool : others) };
      }
      const v = s.vote;
      if (me === "loup" && v && !(pid in v.b)) {
        const prev = Object.values(v.b).filter((t) => v.targets.includes(t));
        if (prev.length && r.next() < 0.8) return { type: "vote", target: r.pick(prev) };
        const pick = L.weightedPick(r, L.sharpen(suspicion(s, pid).filter(([id]) => v.targets.includes(id)), s.level));
        return { type: "vote", target: pick || r.pick(v.targets) };
      }
      return null;
    }
    case "witch": {
      const save = s.potions.life && !!s.victim && (s.victim === pid || r.next() < (s.level >= 2 ? 0.75 : 0.5));
      let kill = "";
      if (s.potions.death && s.night >= 2 && r.next() < 0.3) {
        const t = topSuspect(s, pid);
        if (t && t !== s.victim) kill = t;
      }
      return { type: "witch", save, kill };
    }
    case "hunter": {
      const t = suspect(s, pid, r) || r.pick(others);
      return { type: "shoot", target: t };
    }
    case "day": {
      if (!(s.talk && s.talk[pid]) && r.next() < 0.85) return { type: "say", text: chatLine(s, pid, r) };
      return { type: "ready" };
    }
    case "vote": {
      if (r.next() < (s.level === 1 ? 0.1 : 0.04)) return { type: "vote", target: "" };
      const keep = s.intent[pid];
      if (keep && isAlive(s, keep) && keep !== pid && r.next() < 0.8) return { type: "vote", target: keep };
      return { type: "vote", target: suspect(s, pid, r) || r.pick(others) };
    }
  }
  return null;
}

function chatLine(s, pid, r) {
  const me = s.roles[pid];
  if (me === "voyante") {
    const wolf = s.seen.find(([t, role]) => role === "loup" && isAlive(s, t));
    if (wolf && r.next() < [0.2, 0.45, 0.7][s.level - 1]) {
      s.intent[pid] = wolf[0];
      return `Je suis la voyante : ${nameIn(s, wolf[0])} est un loup !`;
    }
  }
  if (s.night === 1 && r.next() < 0.45) return r.pick(NEUTRAL);
  const t = suspect(s, pid, r);
  if (!t) return r.pick(NEUTRAL);
  s.intent[pid] = t;
  return L.fillTemplate(r.pick(ACCUSE), { X: nameIn(s, t) });
}

export function bot(s, pid, r) { return decide(s, pid, r); }
export function auto(s, pid, r) {
  if (s.phase === "role" || s.phase === "day") return { type: "ready" };
  if (s.phase === "vote") return { type: "vote", target: "" };
  if (s.phase === "witch") return { type: "witch", save: false, kill: "" };
  return decide(s, pid, r);
}
export function botDelay(s, pid, r) {
  const base = s.phase === "day" ? 3500 : s.phase === "vote" ? 2200 : s.phase === "role" ? 1500 : 1800;
  return base * (0.6 + r.next() * 0.9);
}
