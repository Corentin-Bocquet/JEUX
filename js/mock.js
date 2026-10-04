// Serveur simulé, même interface que js/api.js. Il sert aux tests automatiques
// (?mock=1) : les données vivent dans le localStorage, les onglets se parlent
// par BroadcastChannel, et chaque onglet a sa propre session.
import { ITEMS, REWARDS, DEFAULT_EQUIP } from "./catalog.js";

const KEY = "jeuxmock.db";
const bc = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("jeux-mock") : null;
const subs = new Set();
if (bc) bc.onmessage = (e) => subs.forEach((f) => f(e.data));
const emit = (msg) => { subs.forEach((f) => f(msg)); bc && bc.postMessage(msg); };
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } };
const fresh = () => ({ users: {}, profiles: {}, friends: [], invites: [], rooms: {}, results: [], seq: 1 });
// lecture-modification-écriture atomique entre onglets (sinon deux onglets s'écrasent)
function txSync(fn) { const db = load() || fresh(); const out = fn(db); localStorage.setItem(KEY, JSON.stringify(db)); return out; }
const tx = (fn) => (typeof navigator !== "undefined" && navigator.locks ? navigator.locks.request("jeuxmock-db", () => txSync(fn)) : Promise.resolve().then(() => txSync(fn)));
const read = () => load() || fresh();
const uuid = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 3) | 8).toString(16); });
const err = (m) => { throw new Error(m); };
const today = () => new Date().toISOString().slice(0, 10);
const delay = (v) => new Promise((r) => setTimeout(() => r(v), 15));
const isMember = (room, id) => room.players.some((p) => p.id === id);

export function createApi() {
  let uid = sessionStorage.getItem("mock.uid");
  const authCbs = [];
  const me = () => { if (!uid) err("non connecte"); return uid; };
  const credit = (db, id, game, outcome, gems, xp) => {
    const p = db.profiles[id];
    p.gems += gems; p.xp += xp; p.games++; if (outcome === "win") p.wins++;
    const g = p.stats[game] || { p: 0, w: 0 }; g.p++; if (outcome === "win") g.w++; p.stats[game] = g;
    p.last_reward = Date.now();
    return p;
  };

  const api = {
    kind: "mock",
    get uid() { return uid; },
    async init() { return uid ? { id: uid } : null; },
    onAuth(cb) { authCbs.push(cb); },
    async signUp(email, password, username) {
      if (!/^\S+@\S+\.\S+$/.test(email)) err("Adresse email invalide.");
      if ((password || "").length < 6) err("Le mot de passe doit faire au moins 6 caractères.");
      const id = await tx((db) => {
        if (db.users[email]) err("Un compte existe déjà avec cet email.");
        const nid = uuid();
        db.users[email] = { id: nid, password, username };
        return nid;
      });
      uid = id; sessionStorage.setItem("mock.uid", uid);
      authCbs.forEach((f) => f("SIGNED_IN", { id }));
      return delay({ user: { id } });
    },
    async signIn(email, password) {
      const u = read().users[email];
      if (!u || u.password !== password) err("Email ou mot de passe incorrect.");
      uid = u.id; sessionStorage.setItem("mock.uid", uid);
      authCbs.forEach((f) => f("SIGNED_IN", { id: uid }));
      return delay({ id: uid });
    },
    async signOut() { uid = null; sessionStorage.removeItem("mock.uid"); authCbs.forEach((f) => f("SIGNED_OUT", null)); },
    async resetPassword() { return delay(); },
    async updatePassword() { return delay(); },

    async profile() {
      const id = me();
      return delay(await tx((db) => {
        if (db.profiles[id]) return db.profiles[id];
        const u = Object.values(db.users).find((x) => x.id === id) || {};
        let base = String(u.username || "joueur").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 12);
        if (base.length < 3) base = "joueur";
        let cand = base;
        while (Object.values(db.profiles).some((p) => p.username === cand)) cand = base + Math.floor(1000 + Math.random() * 9000);
        db.profiles[id] = { id, username: cand, display_name: (u.username || cand).slice(0, 20), avatar_url: null, equipped: {}, owned: [],
          gems: REWARDS.start, xp: 0, wins: 0, games: 0, stats: {}, favorites: [], game_prefs: {}, daily_last: null, daily_streak: 0, solo_day: null, solo_gems: 0, last_reward: 0 };
        return db.profiles[id];
      }));
    },
    async setDisplayName(name) { const id = me(); return delay(await tx((db) => { db.profiles[id].display_name = String(name).slice(0, 20); return db.profiles[id]; })); },
    async setUsername(u) {
      const id = me(); u = String(u).toLowerCase().trim();
      if (!/^[a-z0-9_]{3,16}$/.test(u)) err("Pseudo : 3 à 16 lettres, chiffres ou _.");
      return delay(await tx((db) => {
        if (Object.values(db.profiles).some((p) => p.username === u && p.id !== id)) err("Ce pseudo est déjà pris.");
        db.profiles[id].username = u; return db.profiles[id];
      }));
    },
    async uploadPhoto(blob) {
      const url = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
      const id = me(); return await tx((db) => { db.profiles[id].avatar_url = url; return db.profiles[id]; });
    },
    async removePhoto() { const id = me(); return await tx((db) => { db.profiles[id].avatar_url = null; return db.profiles[id]; }); },
    async buy(item) {
      const id = me(); const it = ITEMS.find((i) => i.id === item) || err("objet inconnu");
      return delay(await tx((db) => {
        const p = db.profiles[id];
        if (it.price === 0 || p.owned.includes(item)) return p;
        if (p.gems < it.price) err("Pas assez de gemmes.");
        p.gems -= it.price; p.owned.push(item); return p;
      }));
    },
    async equip(slot, item) {
      const id = me(); const it = ITEMS.find((i) => i.id === item && i.slot === slot) || err("objet inconnu");
      return delay(await tx((db) => {
        const p = db.profiles[id];
        if (it.price > 0 && !p.owned.includes(item)) err("Achète d'abord cet objet.");
        p.equipped = { ...DEFAULT_EQUIP, ...p.equipped, [slot]: item }; return p;
      }));
    },
    async daily() {
      const id = me();
      return delay(await tx((db) => {
        const p = db.profiles[id], t = today();
        if (p.daily_last === t) return { ok: false, profile: p };
        const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
        const streak = p.daily_last === y ? p.daily_streak + 1 : 1;
        const gems = REWARDS.daily[Math.min(streak, 7) - 1];
        p.gems += gems; p.daily_last = t; p.daily_streak = streak;
        return { ok: true, gems, streak, profile: p };
      }));
    },
    async setFavorites(list) { const id = me(); return delay(await tx((db) => { db.profiles[id].favorites = list.slice(0, 120); return db.profiles[id]; })); },
    async setGamePrefs(prefs) { const id = me(); return delay(await tx((db) => { db.profiles[id].game_prefs = prefs; return db.profiles[id]; })); },
    async myStats() {
      const id = me(); const db = read();
      const mine = db.results.filter((r) => r.user_id === id);
      const rows = mine.map((r) => [r.game, r.outcome, r.place ?? null, r.gems, r.xp, r.score ?? null, r.duration ?? null, r.at, r.humans || 1, r.mode || null]);
      const riv = {};
      for (const m of mine.filter((r) => r.room_id)) for (const o of db.results.filter((x) => x.room_id === m.room_id && x.round === m.round && x.user_id !== id)) {
        const p = db.profiles[o.user_id]; if (!p) continue;
        const v = riv[o.user_id] || (riv[o.user_id] = { id: o.user_id, display_name: p.display_name, username: p.username, avatar_url: p.avatar_url, equipped: p.equipped, games: 0, ahead: 0, behind: 0 });
        v.games++; if (m.place < o.place) v.ahead++; if (m.place > o.place) v.behind++;
      }
      return delay({ rows, rivals: Object.values(riv).sort((a, b) => b.games - a.games) });
    },
    async soloReward(game, outcome, x = {}) {
      const id = me();
      return delay(await tx((db) => {
        const p = db.profiles[id];
        if (p.last_reward && Date.now() - p.last_reward < 25000) return { ok: false, reason: "trop_vite", profile: p };
        const r = REWARDS.solo[outcome];
        const already = p.solo_day === today() ? p.solo_gems : 0;
        const gems = Math.max(0, Math.min(r.gems, 250 - already));
        p.solo_day = today(); p.solo_gems = already + gems;
        db.results.push({ user_id: id, game, outcome, gems, xp: r.xp, at: Date.now(), score: x.score ?? null, duration: x.duration ?? null, humans: 1, mode: x.mode || null });
        return { ok: true, gems, xp: r.xp, profile: credit(db, id, game, outcome, gems, r.xp) };
      }));
    },
    async leaderboard(scope, period) {
      const id = me(); const db = read();
      const friends = new Set([id, ...db.friends.filter((f) => f.status === "accepted" && (f.a === id || f.b === id)).map((f) => (f.a === id ? f.b : f.a))]);
      const since = Date.now() - 7 * 864e5;
      return Object.values(db.profiles).filter((p) => scope !== "friends" || friends.has(p.id)).map((p) => {
        const rs = db.results.filter((r) => r.user_id === p.id && r.at >= since);
        return { ...p, value: period === "week" ? rs.reduce((t, r) => t + r.xp, 0) : p.xp, wins: period === "week" ? rs.filter((r) => r.outcome === "win").length : p.wins };
      }).sort((a, b) => b.value - a.value || b.wins - a.wins);
    },
    async findUser(username) { const db = read(); return Object.values(db.profiles).find((p) => p.username === String(username).toLowerCase().trim()) || null; },
    async profilesByIds(ids) { const db = read(); return ids.map((i) => db.profiles[i]).filter(Boolean); },

    async friends() {
      const id = me(); const db = read();
      return db.friends.filter((f) => f.a === id || f.b === id).map((f) => {
        const o = f.a === id ? f.b : f.a;
        return { id: o, status: f.status, incoming: f.status === "pending" && f.requester !== id, profile: db.profiles[o] };
      }).filter((f) => f.profile);
    },
    async friendRequest(username) {
      const id = me();
      const out = await tx((db) => {
        const o = Object.values(db.profiles).find((p) => p.username === String(username).toLowerCase().trim());
        if (!o) err("Aucun joueur avec ce pseudo.");
        if (o.id === id) err("C'est ton propre pseudo !");
        const f = db.friends.find((x) => (x.a === id && x.b === o.id) || (x.b === id && x.a === o.id));
        if (f) { if (f.status === "pending" && f.requester !== id) f.status = "accepted"; return { status: f.status }; }
        db.friends.push({ a: id, b: o.id, requester: id, status: "pending" });
        return { status: "pending" };
      });
      emit({ t: "friends" }); return out;
    },
    async friendRespond(other, accept) {
      const id = me();
      await tx((db) => {
        const i = db.friends.findIndex((x) => (x.a === id && x.b === other) || (x.b === id && x.a === other));
        if (i < 0) return;
        if (accept) { if (db.friends[i].requester !== id) db.friends[i].status = "accepted"; } else db.friends.splice(i, 1);
      });
      emit({ t: "friends" });
    },
    async friendRemove(other) {
      const id = me();
      await tx((db) => { db.friends = db.friends.filter((x) => !((x.a === id && x.b === other) || (x.b === id && x.a === other))); });
      emit({ t: "friends" });
    },
    onFriends(cb) { const f = (m) => m.t === "friends" && cb(); subs.add(f); return () => subs.delete(f); },

    async invites() {
      const id = me(); const db = read();
      return db.invites.filter((i) => i.to === id && (i.status || "pending") === "pending" && (!i.at || Date.now() - i.at < 30 * 6e4))
        .map((i) => ({ id: i.id, room_id: i.room_id, code: i.code, game: i.game, at: i.at, from: db.profiles[i.from] }));
    },
    async inviteMany(roomId, ids) {
      const id = me();
      const n = await tx((db) => {
        const r = db.rooms[roomId];
        if (!r || !isMember(r, id)) err("pas dans ce salon");
        if (r.status !== "lobby") err("La partie a déjà commencé.");
        let k = 0;
        for (const to of ids) {
          if (!db.friends.some((f) => f.status === "accepted" && ((f.a === id && f.b === to) || (f.b === id && f.a === to)))) err("Vous n'êtes pas encore amis.");
          if (to === id || isMember(r, to)) continue;
          db.invites = db.invites.filter((i) => !(i.room_id === roomId && i.to === to));
          db.invites.push({ id: db.seq++, room_id: roomId, from: id, to, code: r.code, game: r.game, status: "pending", at: Date.now() });
          k++;
        }
        return k;
      });
      emit({ t: "invites" });
      return delay(n);
    },
    async inviteUsername(roomId, username) {
      const id = me();
      const o = await tx((db) => {
        const r = db.rooms[roomId];
        if (!r || !isMember(r, id)) err("pas dans ce salon");
        if (r.status !== "lobby") err("La partie a déjà commencé.");
        const p = Object.values(db.profiles).find((x) => x.username === String(username).toLowerCase().trim());
        if (!p) err("Aucun joueur avec ce pseudo.");
        if (p.id === id) err("C'est ton propre pseudo !");
        if (isMember(r, p.id)) err("Ce joueur est déjà dans le salon.");
        db.invites = db.invites.filter((i) => !(i.room_id === roomId && i.to === p.id));
        db.invites.push({ id: db.seq++, room_id: roomId, from: id, to: p.id, code: r.code, game: r.game, status: "pending", at: Date.now() });
        return p;
      });
      emit({ t: "invites" });
      return delay(o);
    },
    async declineInvite(iid) {
      const id = me();
      await tx((db) => { const i = db.invites.find((x) => x.id === iid && x.to === id); if (i) i.status = "declined"; });
      emit({ t: "invites" });
    },
    async sentInvites(roomId) {
      const id = me(); const db = read();
      return db.invites.filter((i) => i.room_id === roomId && i.from === id && db.profiles[i.to])
        .map((i) => ({ id: i.id, to: i.to, status: i.status || "pending", profile: db.profiles[i.to] }));
    },
    async invite(roomId, to) {
      const id = me();
      await tx((db) => {
        const r = db.rooms[roomId];
        if (!r || !isMember(r, id)) err("pas dans ce salon");
        if (!db.friends.some((f) => f.status === "accepted" && ((f.a === id && f.b === to) || (f.b === id && f.a === to)))) err("Vous n'êtes pas encore amis.");
        db.invites = db.invites.filter((i) => !(i.room_id === roomId && i.to === to));
        db.invites.push({ id: db.seq++, room_id: roomId, from: id, to, code: r.code, game: r.game, status: "pending", at: Date.now() });
      });
      emit({ t: "invites" });
    },
    async deleteInvite(iid) { await tx((db) => { db.invites = db.invites.filter((i) => i.id !== iid); }); emit({ t: "invites" }); },
    onInvites(cb) { const f = (m) => m.t === "invites" && cb(m); subs.add(f); return () => subs.delete(f); },

    onOnline(cb) {
      const beat = () => { try { localStorage.setItem("jeuxmock.on." + uid, String(Date.now())); } catch {} };
      const scan = () => {
        const s = new Set();
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith("jeuxmock.on.") && Date.now() - +localStorage.getItem(k) < 9000) s.add(k.slice(12));
        }
        cb(s);
      };
      beat(); scan();
      const t = setInterval(() => { beat(); scan(); }, 3000);
      return () => clearInterval(t);
    },

    rooms: {
      async create(game, max, settings, meP) {
        const id = me();
        const room = await tx((db) => {
          const rid = uuid();
          const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
          let code;
          do { code = Array.from({ length: 5 }, () => A[(Math.random() * A.length) | 0]).join(""); } while (Object.values(db.rooms).some((r) => r.code === code));
          db.rooms[rid] = { id: rid, code, game, host: id, status: "lobby", players: [{ id, name: meP.name, avatar: meP.avatar || {}, photo: meP.photo || null }],
            max_players: max, settings: settings || {}, state: null, version: 0, created_at: Date.now(), updated_at: Date.now() };
          return db.rooms[rid];
        });
        emit({ t: "room", id: room.id });
        return delay(room);
      },
      async join(code, meP) {
        const id = me();
        const room = await tx((db) => {
          const r = Object.values(db.rooms).find((x) => x.code === String(code).toUpperCase().trim());
          if (!r) err("Salon introuvable. Vérifie le code.");
          if (isMember(r, id)) return r;
          if (r.status !== "lobby") err("La partie a déjà commencé.");
          if (r.players.length >= r.max_players) err("Ce salon est complet.");
          r.players.push({ id, name: meP.name, avatar: meP.avatar || {}, photo: meP.photo || null });
          r.version++; r.updated_at = Date.now();
          db.invites = db.invites.filter((i) => !(i.room_id === r.id && i.to === id));
          return r;
        });
        emit({ t: "room", id: room.id }); emit({ t: "invites" });
        return delay(room);
      },
      async update(rid, version, patch) {
        const id = me();
        const out = await tx((db) => {
          const r = db.rooms[rid];
          if (!r) err("Salon introuvable. Vérifie le code.");
          if (!isMember(r, id)) err("pas dans ce salon");
          if (r.version !== version) return { ok: false, room: r };
          if ("state" in patch) r.state = patch.state;
          if (patch.status) r.status = patch.status;
          if (Array.isArray(patch.players) && patch.players.some((p) => p.id === id)) r.players = patch.players;
          if (patch.settings) r.settings = patch.settings;
          if (patch.max_players) r.max_players = Math.max(1, Math.min(8, patch.max_players));
          r.version++; r.updated_at = Date.now();
          return { ok: true, room: r };
        });
        if (out.ok) emit({ t: "room", id: rid });
        return delay(JSON.parse(JSON.stringify(out)));
      },
      async leave(rid) {
        const id = me();
        await tx((db) => {
          const r = db.rooms[rid];
          if (!r || !isMember(r, id)) return;
          r.players = r.status === "lobby" ? r.players.filter((p) => p.id !== id) : r.players.map((p) => (p.id === id ? { ...p, left: true } : p));
          const humans = r.players.filter((p) => !p.bot && !p.left);
          if (!humans.length && r.status !== "done") { delete db.rooms[rid]; return; }
          if (r.host === id && humans.length) r.host = humans[0].id;
          r.version++; r.updated_at = Date.now();
        });
        emit({ t: "room", id: rid });
      },
      async claim(rid) {
        const id = me();
        return delay(await tx((db) => {
          const r = db.rooms[rid];
          if (!r || r.status !== "done") err("partie pas finie");
          const round = (r.state && r.state.round) || 0;
          if (db.results.some((x) => x.user_id === id && x.room_id === rid && x.round === round)) return { ok: false, reason: "deja" };
          const rk = r.state.result.ranking.find((x) => x.id === id);
          const place = rk.rank;
          const nbBest = r.state.result.ranking.filter((x) => x.rank === 1).length;
          const firsts = r.state.result.ranking.filter((x) => x.rank === 1).map((x) => x.id);
          const team = (r.state.result.teams || []).find((t) => t.includes(id));
          const teamWin = !!team && firsts.every((f) => team.includes(f));
          const outcome = place === 1 && (nbBest === 1 || teamWin) ? "win" : place === 1 ? "draw" : "lose";
          const humans = r.players.filter((p) => !p.bot).length;
          let gems, xp;
          if (humans >= 2) { ({ gems, xp } = REWARDS.multi[Math.min(place, 4) - 1]); if (outcome === "draw") { gems = 15; xp = 70; } }
          else ({ gems, xp } = REWARDS.solo[outcome]);
          db.results.push({ user_id: id, room_id: rid, round, game: r.game, outcome, place, gems, xp, at: Date.now(), score: rk.score ?? null,
            duration: r.state.startedAt ? Math.round((Date.now() - r.state.startedAt) / 1000) : null, humans, mode: (r.settings && r.settings.mode) || null });
          return { ok: true, gems, xp, outcome, place, profile: credit(db, id, r.game, outcome, gems, xp) };
        }));
      },
      async get(rid) { const r = read().rooms[rid]; return r && isMember(r, uid) ? JSON.parse(JSON.stringify(r)) : null; },
      async mine() { return Object.values(read().rooms).filter((r) => isMember(r, uid) && r.status !== "done"); },
      subscribe(rid, cb) {
        const f = async (m) => { if (m.t === "room" && m.id === rid) cb(await api.rooms.get(rid)); };
        subs.add(f);
        return () => subs.delete(f);
      },
    },
  };
  return api;
}
