// Accès au serveur Supabase. Même interface que js/mock.js (utilisé par les tests).
import { createClient } from "./vendor/supabase.js";
import { SUPABASE_URL, SUPABASE_ANON } from "./config.js";

const FR = [
  [/Invalid login credentials/i, "Email ou mot de passe incorrect."],
  [/already registered|already exists/i, "Un compte existe déjà avec cet email."],
  [/Password should be at least (\d+)/i, (m) => `Le mot de passe doit faire au moins ${m[1]} caractères.`],
  [/valid email|invalid format|Unable to validate email/i, "Adresse email invalide."],
  [/rate limit|too many/i, "Trop d'essais, réessaie dans une minute."],
  [/Failed to fetch|NetworkError|network/i, "Pas de connexion internet."],
  [/Email not confirmed/i, "Confirme d'abord ton email (regarde ta boîte de réception)."],
  [/pseudo pris/, "Ce pseudo est déjà pris."], [/pseudo invalide/, "Pseudo : 3 à 16 lettres, chiffres ou _."],
  [/pas assez de gemmes/, "Pas assez de gemmes."], [/objet non possede/, "Achète d'abord cet objet."],
  [/salon introuvable/, "Salon introuvable. Vérifie le code."], [/partie deja commencee/, "La partie a déjà commencé."],
  [/salon complet/, "Ce salon est complet."], [/joueur introuvable/, "Aucun joueur avec ce pseudo."],
  [/c est toi/, "C'est ton propre pseudo !"], [/pas amis/, "Vous n'êtes pas encore amis."],
];
export function frError(e) {
  const msg = (e && (e.message || e.error_description || e.msg)) || String(e || "Erreur");
  for (const [re, fr] of FR) { const m = msg.match(re); if (m) return typeof fr === "function" ? fr(m) : fr; }
  return msg;
}
const must = ({ data, error }) => { if (error) throw new Error(frError(error)); return data; };

export function createApi() {
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" } });
  let user = null;
  let onlineCh = null;

  const api = {
    kind: "supabase",
    get uid() { return user && user.id; },

    async init() {
      const { data } = await sb.auth.getSession();
      user = data.session ? data.session.user : null;
      return user;
    },
    onAuth(cb) {
      sb.auth.onAuthStateChange((ev, session) => { user = session ? session.user : null; cb(ev, user); });
    },
    async signUp(email, password, username) {
      const data = must(await sb.auth.signUp({ email, password, options: { data: { username }, emailRedirectTo: location.origin + location.pathname } }));
      user = data.user;
      if (!data.session) return { needConfirm: true };
      return { user };
    },
    async signIn(email, password) {
      const data = must(await sb.auth.signInWithPassword({ email, password }));
      user = data.user;
      return user;
    },
    async signOut() { if (onlineCh) { sb.removeChannel(onlineCh); onlineCh = null; } await sb.auth.signOut(); user = null; },
    async resetPassword(email) { must(await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname })); },
    async updatePassword(pw) { must(await sb.auth.updateUser({ password: pw })); },

    // ---------- profil
    async profile() {
      const meta = (user && user.user_metadata) || {};
      const base = meta.username || (user && user.email ? user.email.split("@")[0] : "joueur");
      return must(await sb.rpc("jeux_ensure_profile", { p_username: base, p_display: meta.username || base }));
    },
    async setDisplayName(name) {
      return must(await sb.from("jeux_profiles").update({ display_name: name }).eq("id", user.id).select().single());
    },
    async setUsername(u) { return must(await sb.rpc("jeux_set_username", { p_username: u })); },
    async uploadPhoto(blob) {
      const path = `${user.id}/avatar-${Date.now()}.jpg`;
      must(await sb.storage.from("jeux-avatars").upload(path, blob, { contentType: "image/jpeg", upsert: true }));
      const url = sb.storage.from("jeux-avatars").getPublicUrl(path).data.publicUrl;
      return must(await sb.from("jeux_profiles").update({ avatar_url: url }).eq("id", user.id).select().single());
    },
    async removePhoto() {
      return must(await sb.from("jeux_profiles").update({ avatar_url: null }).eq("id", user.id).select().single());
    },
    async buy(item) { return must(await sb.rpc("jeux_buy", { p_item: item })); },
    async equip(slot, item) { return must(await sb.rpc("jeux_equip", { p_slot: slot, p_item: item })); },
    async daily() { return must(await sb.rpc("jeux_daily")); },
    async soloReward(game, outcome, x = {}) {
      return must(await sb.rpc("jeux_solo_reward", { p_game: game, p_outcome: outcome, p_score: x.score ?? null, p_duration: x.duration ?? null, p_mode: x.mode ?? null }));
    },
    async myStats() { return must(await sb.rpc("jeux_my_stats")); },
    async setFavorites(list) {
      return must(await sb.from("jeux_profiles").update({ favorites: list.slice(0, 120) }).eq("id", user.id).select().single());
    },
    async setGamePrefs(prefs) {
      return must(await sb.from("jeux_profiles").update({ game_prefs: prefs }).eq("id", user.id).select().single());
    },
    async leaderboard(scope, period, game = null) {
      return must(await sb.rpc("jeux_leaderboard", { p_scope: scope, p_period: period, p_game: game })) || [];
    },
    async profilesByIds(ids) {
      if (!ids.length) return [];
      return must(await sb.from("jeux_profiles").select("id,username,display_name,avatar_url,equipped,xp,wins,games").in("id", ids));
    },

    // ---------- amis
    async friends() {
      const rows = must(await sb.from("jeux_friends").select("*"));
      const others = rows.map((r) => (r.user_a === user.id ? r.user_b : r.user_a));
      const profs = await api.profilesByIds(others);
      return rows.map((r) => {
        const oid = r.user_a === user.id ? r.user_b : r.user_a;
        return { id: oid, status: r.status, incoming: r.status === "pending" && r.requester !== user.id, profile: profs.find((p) => p.id === oid) };
      }).filter((f) => f.profile);
    },
    async friendRequest(username) { return must(await sb.rpc("jeux_friend_request", { p_username: username })); },
    async friendRespond(id, accept) { must(await sb.rpc("jeux_friend_respond", { p_other: id, p_accept: accept })); },
    async friendRemove(id) { must(await sb.rpc("jeux_friend_remove", { p_other: id })); },
    onFriends(cb) {
      const ch = sb.channel("friends-" + user.id)
        .on("postgres_changes", { event: "*", schema: "public", table: "jeux_friends", filter: `user_a=eq.${user.id}` }, () => cb())
        .on("postgres_changes", { event: "*", schema: "public", table: "jeux_friends", filter: `user_b=eq.${user.id}` }, () => cb())
        .subscribe();
      return () => sb.removeChannel(ch);
    },

    // ---------- invitations
    async invites() {
      const rows = must(await sb.from("jeux_invites").select("id,room_id,from_user,code,game,created_at").eq("to_user", user.id).order("created_at", { ascending: false }));
      if (!rows.length) return [];
      const profs = await api.profilesByIds([...new Set(rows.map((r) => r.from_user))]);
      return rows.map((r) => ({ id: r.id, room_id: r.room_id, code: r.code, game: r.game, from: profs.find((p) => p.id === r.from_user) }));
    },
    async invite(roomId, to) { must(await sb.rpc("jeux_invite", { p_room: roomId, p_to: to })); },
    async deleteInvite(id) { must(await sb.from("jeux_invites").delete().eq("id", id)); },
    onInvites(cb) {
      const ch = sb.channel("inv-" + user.id)
        .on("postgres_changes", { event: "*", schema: "public", table: "jeux_invites", filter: `to_user=eq.${user.id}` }, (p) => cb(p))
        .subscribe();
      return () => sb.removeChannel(ch);
    },

    // ---------- présence en ligne
    onOnline(cb) {
      if (onlineCh) sb.removeChannel(onlineCh);
      onlineCh = sb.channel("jeux-online", { config: { presence: { key: user.id } } });
      onlineCh.on("presence", { event: "sync" }, () => cb(new Set(Object.keys(onlineCh.presenceState()))))
        .subscribe((st) => { if (st === "SUBSCRIBED") onlineCh.track({ at: Date.now() }); });
      return () => { if (onlineCh) { sb.removeChannel(onlineCh); onlineCh = null; } };
    },

    // ---------- salons
    rooms: {
      async create(game, max, settings, me) { return must(await sb.rpc("jeux_room_create", { p_game: game, p_max: max, p_settings: settings, p_me: me })); },
      async join(code, me) { return must(await sb.rpc("jeux_room_join", { p_code: code, p_me: me })); },
      async update(id, version, patch) { return must(await sb.rpc("jeux_room_update", { p_room: id, p_version: version, p_patch: patch })); },
      async leave(id) { must(await sb.rpc("jeux_room_leave", { p_room: id })); },
      async claim(id) { return must(await sb.rpc("jeux_room_claim", { p_room: id })); },
      async get(id) { const { data } = await sb.from("jeux_rooms").select("*").eq("id", id).maybeSingle(); return data; },
      async byCode(code) { const { data } = await sb.from("jeux_rooms").select("*").eq("code", code.toUpperCase()).maybeSingle(); return data; },
      async mine() {
        const { data } = await sb.from("jeux_rooms").select("id,code,game,status,players,updated_at").neq("status", "done").order("updated_at", { ascending: false }).limit(10);
        return data || [];
      },
      subscribe(id, cb) {
        let alive = true;
        const ch = sb.channel("room-" + id)
          .on("postgres_changes", { event: "*", schema: "public", table: "jeux_rooms", filter: `id=eq.${id}` }, (p) => {
            if (p.eventType === "DELETE") cb(null); else cb(p.new);
          })
          .subscribe();
        // filet de sécurité si le temps réel décroche
        const poll = setInterval(async () => { if (!alive) return; const r = await api.rooms.get(id); cb(r, true); }, 6000);
        return () => { alive = false; clearInterval(poll); sb.removeChannel(ch); };
      },
    },
  };
  return api;
}
