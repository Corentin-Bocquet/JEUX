// Salons : un magasin local (parties solo contre robots) et le contrôleur de
// partie commun aux salons en ligne et locaux (robots, délais, conflits).
import { start, apply, rng, newSeed, GameError, clone } from "./engine.js";
import { BOT_NAMES } from "./games/index.js";
import { ITEMS, SLOTS } from "./catalog.js";

// ------------------------------------------------ magasin local
export function localStore(meId) {
  const rooms = {};
  const subs = {};
  const notify = (id) => (subs[id] || []).forEach((f) => f(clone(rooms[id])));
  return {
    local: true,
    async create(game, max, settings, me) {
      const id = "local-" + Math.random().toString(36).slice(2, 9);
      rooms[id] = { id, code: "SOLO", game, host: meId, status: "lobby", players: [{ id: meId, ...me }], max_players: max, settings, state: null, version: 0 };
      return clone(rooms[id]);
    },
    async update(id, version, patch) {
      const r = rooms[id];
      if (!r) throw new Error("Partie terminée");
      if (r.version !== version) return { ok: false, room: clone(r) };
      Object.assign(r, patch.state !== undefined ? { state: patch.state } : {});
      if (patch.status) r.status = patch.status;
      if (patch.players) r.players = patch.players;
      if (patch.settings) r.settings = patch.settings;
      r.version++;
      setTimeout(() => notify(id), 0);
      return { ok: true, room: clone(r) };
    },
    async leave(id) { delete rooms[id]; },
    async get(id) { return rooms[id] ? clone(rooms[id]) : null; },
    subscribe(id, cb) { (subs[id] = subs[id] || []).push(cb); return () => (subs[id] = (subs[id] || []).filter((f) => f !== cb)); },
  };
}

export function makeBot(taken = []) {
  const used = new Set(taken);
  const name = BOT_NAMES.find((n) => !used.has(n)) || "Robot " + (taken.length + 1);
  const pick = (slot) => { const l = ITEMS.filter((i) => i.slot === slot); return l[Math.floor(Math.random() * l.length)].id; };
  const avatar = Object.fromEntries(SLOTS.map((s) => [s.id, pick(s.id)]));
  return { id: "bot-" + Math.random().toString(36).slice(2, 8), name, bot: true, avatar };
}

// ------------------------------------------------ contrôleur de partie
export class RoomCtl {
  constructor({ store, room, me, game, onChange, onError }) {
    this.store = store; this.room = room; this.me = me; this.game = game;
    this.onChange = onChange; this.onError = onError || (() => {});
    this.busy = false; this.queue = Promise.resolve();
    this.botAt = {}; this.dead = false;
    this.unsub = store.subscribe(room.id, (r, poll) => this.receive(r, poll));
    this.timer = setInterval(() => this.tick(), 350);
  }
  get state() { return this.room && this.room.state; }
  get isHost() { return this.room && this.room.host === this.me; }
  get settings() { return this.room.settings || {}; }

  receive(r) {
    if (this.dead) return;
    if (!r) { this.room = null; this.onChange(null); return; }
    if (this.room && r.version < this.room.version) return; // vieille copie
    if (this.room && r.version === this.room.version) return;
    this.room = r;
    this.onChange(r);
  }
  set(r) { if (r && (!this.room || r.version >= this.room.version)) { this.room = r; this.onChange(r); } }

  // mise à jour optimiste, rejouée si quelqu'un a joué entre temps
  async patch(fn, tries = 6) {
    for (let k = 0; k < tries; k++) {
      const r = this.room;
      if (!r) throw new Error("Salon fermé");
      const p = fn(r);
      if (!p) return false;
      const res = await this.store.update(r.id, r.version, p);
      if (res.ok) { this.set(res.room); return true; }
      this.set(res.room);
      await new Promise((ok) => setTimeout(ok, 40 + Math.random() * 120));
    }
    throw new Error("Le salon est très agité, réessaie.");
  }

  // action d'un joueur (moi par défaut, ou un robot piloté par l'hôte)
  act(action, as = this.me) {
    const run = async () => {
      const seed = newSeed();
      try {
        await this.patch((r) => {
          if (!r.state || r.status !== "playing") throw new GameError("La partie n'est pas en cours");
          const ns = apply(this.game, r.state, as, { ...action, seed, now: Date.now() }, r.settings);
          return ns.result ? { state: ns, status: "done" } : { state: ns };
        });
        return true;
      } catch (e) {
        if (as === this.me && action.type !== "timeout") this.onError(e);
        return false;
      }
    };
    this.queue = this.queue.then(run, run);
    return this.queue;
  }

  // lance (ou relance pour une revanche) la partie avec les joueurs présents
  async begin() {
    this.botAt = {};
    return this.patch((room) => {
      if (room.status === "playing") return null;
      const players = room.players.filter((p) => !p.left);
      const round = room.state ? (room.state.round || 0) + 1 : 0;
      const state = start(this.game, players, room.settings, newSeed(), Date.now(), round);
      return { state, status: "playing", players };
    }).catch((e) => { this.onError(e); return false; });
  }

  // l'hôte fait jouer les robots et les joueurs partis ; tout le monde fait respecter les délais
  tick() {
    const r = this.room;
    if (!r || r.status !== "playing" || !r.state || r.state.result || this.busy) return;
    const now = Date.now();
    const st = r.state;
    const who = this.game.toAct(st);
    if (st._dl && now > st._dl + 1500 && who.length) {
      this.busy = true;
      this.act({ type: "timeout", who: st._who }).finally(() => (this.busy = false));
      return;
    }
    if (!this.isHost) return;
    const auto = new Set(r.players.filter((p) => p.bot || p.left).map((p) => p.id));
    const race = !!this.game.meta.race;
    for (const pid of who) {
      if (!auto.has(pid)) continue;
      const key = pid + ":" + (race ? "" : st.seq);
      if (!this.botAt[key]) {
        const g = rng(newSeed());
        const wait = this.game.botDelay ? this.game.botDelay(st, pid, g) : 650 + Math.random() * 900 + (this.game.meta.id === "poker" ? 600 : 0);
        this.botAt[key] = now + (r.players.find((p) => p.id === pid)?.left ? 500 : wait);
        continue;
      }
      if (now < this.botAt[key]) continue;
      delete this.botAt[key];
      const action = this.game.bot(clone(st), pid, rng(newSeed()));
      if (!action) continue;
      this.busy = true;
      this.act(action, pid).finally(() => (this.busy = false));
      return;
    }
  }

  destroy() { this.dead = true; clearInterval(this.timer); this.unsub && this.unsub(); }
}
