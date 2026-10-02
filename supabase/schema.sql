-- JEUX : schéma Supabase (tables préfixées jeux_, rien n'est modifié ailleurs).
-- Idempotent : on peut le rejouer. Les prix de la boutique sont dans items.sql
-- (généré par node tools/gen-items-sql.mjs).

create extension if not exists pgcrypto;

-- ============================================================ PROFILS
create table if not exists public.jeux_profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text not null unique check (username ~ '^[a-z0-9_]{3,16}$'),
  display_name  text not null check (char_length(display_name) between 1 and 20),
  avatar_url    text check (avatar_url is null or char_length(avatar_url) < 400),
  equipped      jsonb not null default '{}'::jsonb,
  owned         text[] not null default '{}',
  gems          integer not null default 200 check (gems >= 0),
  xp            integer not null default 0 check (xp >= 0),
  wins          integer not null default 0,
  games         integer not null default 0,
  stats         jsonb not null default '{}'::jsonb,
  daily_last    date,
  daily_streak  integer not null default 0,
  solo_day      date,
  solo_gems     integer not null default 0,
  last_reward   timestamptz,
  last_seen     timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create index if not exists jeux_profiles_xp on public.jeux_profiles (xp desc);

alter table public.jeux_profiles enable row level security;
revoke all on public.jeux_profiles from anon, authenticated;
grant select on public.jeux_profiles to authenticated;
grant update (display_name, avatar_url, last_seen) on public.jeux_profiles to authenticated;

drop policy if exists "jeux profils lisibles" on public.jeux_profiles;
create policy "jeux profils lisibles" on public.jeux_profiles for select to authenticated using (true);
drop policy if exists "jeux profil modifiable par soi" on public.jeux_profiles;
create policy "jeux profil modifiable par soi" on public.jeux_profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- ============================================================ BOUTIQUE
create table if not exists public.jeux_items (
  id    text primary key,
  slot  text not null,
  price integer not null check (price >= 0)
);
alter table public.jeux_items enable row level security;
revoke all on public.jeux_items from anon, authenticated;
grant select on public.jeux_items to authenticated;
drop policy if exists "jeux items lisibles" on public.jeux_items;
create policy "jeux items lisibles" on public.jeux_items for select to authenticated using (true);

-- ============================================================ AMIS
create table if not exists public.jeux_friends (
  user_a     uuid not null references public.jeux_profiles(id) on delete cascade,
  user_b     uuid not null references public.jeux_profiles(id) on delete cascade,
  requester  uuid not null,
  status     text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
create index if not exists jeux_friends_b on public.jeux_friends (user_b);
alter table public.jeux_friends enable row level security;
alter table public.jeux_friends replica identity full;
revoke all on public.jeux_friends from anon, authenticated;
grant select on public.jeux_friends to authenticated;
drop policy if exists "jeux amis lisibles par les concernes" on public.jeux_friends;
create policy "jeux amis lisibles par les concernes" on public.jeux_friends for select to authenticated
  using (auth.uid() = user_a or auth.uid() = user_b);

-- ============================================================ SALONS
create table if not exists public.jeux_rooms (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  game        text not null check (game ~ '^[a-z0-9_]{2,20}$'),
  host        uuid not null,
  status      text not null default 'lobby' check (status in ('lobby','playing','done')),
  players     jsonb not null default '[]'::jsonb,
  max_players integer not null default 4 check (max_players between 1 and 8),
  settings    jsonb not null default '{}'::jsonb,
  state       jsonb,
  version     integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists jeux_rooms_upd on public.jeux_rooms (updated_at);
alter table public.jeux_rooms enable row level security;
alter table public.jeux_rooms replica identity full;
revoke all on public.jeux_rooms from anon, authenticated;
grant select on public.jeux_rooms to authenticated;
drop policy if exists "jeux salon lisible par ses joueurs" on public.jeux_rooms;
create policy "jeux salon lisible par ses joueurs" on public.jeux_rooms for select to authenticated
  using (players @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text)));

-- ============================================================ INVITATIONS
create table if not exists public.jeux_invites (
  id         bigint generated always as identity primary key,
  room_id    uuid not null references public.jeux_rooms(id) on delete cascade,
  from_user  uuid not null references public.jeux_profiles(id) on delete cascade,
  to_user    uuid not null references public.jeux_profiles(id) on delete cascade,
  code       text,
  game       text,
  created_at timestamptz not null default now(),
  unique (room_id, to_user)
);
alter table public.jeux_invites add column if not exists code text;
alter table public.jeux_invites add column if not exists game text;
alter table public.jeux_invites enable row level security;
alter table public.jeux_invites replica identity full;
revoke all on public.jeux_invites from anon, authenticated;
grant select, delete on public.jeux_invites to authenticated;
drop policy if exists "jeux invitations lisibles" on public.jeux_invites;
create policy "jeux invitations lisibles" on public.jeux_invites for select to authenticated
  using (auth.uid() = to_user or auth.uid() = from_user);
drop policy if exists "jeux invitation effacable" on public.jeux_invites;
create policy "jeux invitation effacable" on public.jeux_invites for delete to authenticated
  using (auth.uid() = to_user or auth.uid() = from_user);

-- ============================================================ RESULTATS
create table if not exists public.jeux_results (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.jeux_profiles(id) on delete cascade,
  room_id    uuid,
  game       text not null,
  outcome    text not null check (outcome in ('win','draw','lose')),
  place      integer,
  gems       integer not null default 0,
  xp         integer not null default 0,
  round      integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.jeux_results add column if not exists round integer not null default 0;
alter table public.jeux_results drop constraint if exists jeux_results_user_id_room_id_key;
create unique index if not exists jeux_results_unique_round on public.jeux_results (user_id, room_id, round);
create index if not exists jeux_results_week on public.jeux_results (created_at, user_id);
alter table public.jeux_results enable row level security;
revoke all on public.jeux_results from anon, authenticated;
grant select on public.jeux_results to authenticated;
drop policy if exists "jeux resultats perso" on public.jeux_results;
create policy "jeux resultats perso" on public.jeux_results for select to authenticated using (auth.uid() = user_id);

-- ============================================================ FONCTIONS
-- profil : cree a la premiere connexion, avec un pseudo unique
create or replace function public.jeux_ensure_profile(p_username text, p_display text)
returns public.jeux_profiles language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r public.jeux_profiles; base text; cand text; n int := 0;
begin
  if me is null then raise exception 'non connecte'; end if;
  select * into r from jeux_profiles where id = me;
  if found then
    update jeux_profiles set last_seen = now() where id = me returning * into r;
    return r;
  end if;
  base := lower(regexp_replace(coalesce(p_username,''), '[^a-zA-Z0-9_]', '', 'g'));
  if char_length(base) < 3 then base := 'joueur'; end if;
  base := left(base, 12);
  cand := base;
  while exists (select 1 from jeux_profiles where username = cand) loop
    n := n + 1; cand := base || (floor(random()*9000)+1000)::int::text;
    if n > 20 then cand := 'j' || substr(replace(gen_random_uuid()::text,'-',''),1,12); end if;
  end loop;
  insert into jeux_profiles (id, username, display_name)
  values (me, cand, left(coalesce(nullif(trim(p_display),''), cand), 20))
  returning * into r;
  return r;
end $$;

create or replace function public.jeux_set_username(p_username text)
returns public.jeux_profiles language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r public.jeux_profiles; u text := lower(trim(p_username));
begin
  if me is null then raise exception 'non connecte'; end if;
  if u !~ '^[a-z0-9_]{3,16}$' then raise exception 'pseudo invalide'; end if;
  if exists (select 1 from jeux_profiles where username = u and id <> me) then raise exception 'pseudo pris'; end if;
  update jeux_profiles set username = u where id = me returning * into r;
  return r;
end $$;

-- boutique
create or replace function public.jeux_buy(p_item text)
returns public.jeux_profiles language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); it public.jeux_items; r public.jeux_profiles;
begin
  select * into it from jeux_items where id = p_item;
  if not found then raise exception 'objet inconnu'; end if;
  select * into r from jeux_profiles where id = me for update;
  if not found then raise exception 'profil absent'; end if;
  if it.price = 0 or p_item = any(r.owned) then return r; end if;
  if r.gems < it.price then raise exception 'pas assez de gemmes'; end if;
  update jeux_profiles set gems = gems - it.price, owned = array_append(owned, p_item)
  where id = me returning * into r;
  return r;
end $$;

create or replace function public.jeux_equip(p_slot text, p_item text)
returns public.jeux_profiles language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); it public.jeux_items; r public.jeux_profiles;
begin
  select * into it from jeux_items where id = p_item and slot = p_slot;
  if not found then raise exception 'objet inconnu'; end if;
  select * into r from jeux_profiles where id = me for update;
  if it.price > 0 and not (p_item = any(r.owned)) then raise exception 'objet non possede'; end if;
  update jeux_profiles set equipped = equipped || jsonb_build_object(p_slot, p_item)
  where id = me returning * into r;
  return r;
end $$;

-- coffre du jour : serie de jours consecutifs, 7 paliers
create or replace function public.jeux_daily()
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r public.jeux_profiles; today date := (now() at time zone 'Europe/Paris')::date;
  streak int; gain int; tbl int[] := array[40,50,60,70,80,100,150];
begin
  select * into r from jeux_profiles where id = me for update;
  if not found then raise exception 'profil absent'; end if;
  if r.daily_last = today then return jsonb_build_object('ok', false, 'profile', to_jsonb(r)); end if;
  streak := case when r.daily_last = today - 1 then r.daily_streak + 1 else 1 end;
  gain := tbl[least(streak, 7)];
  update jeux_profiles set gems = gems + gain, daily_last = today, daily_streak = streak
  where id = me returning * into r;
  return jsonb_build_object('ok', true, 'gems', gain, 'streak', streak, 'profile', to_jsonb(r));
end $$;

-- recompense commune : met a jour profil + statistiques par jeu
create or replace function public.jeux__credit(me uuid, p_game text, p_outcome text, p_gems int, p_xp int)
returns public.jeux_profiles language plpgsql security definer set search_path = public as $$
declare r public.jeux_profiles; st jsonb; g jsonb;
begin
  select stats into st from jeux_profiles where id = me for update;
  g := coalesce(st -> p_game, '{"p":0,"w":0}'::jsonb);
  g := jsonb_build_object('p', coalesce((g->>'p')::int,0) + 1,
                          'w', coalesce((g->>'w')::int,0) + case when p_outcome = 'win' then 1 else 0 end);
  update jeux_profiles set gems = gems + p_gems, xp = xp + p_xp, games = games + 1,
    wins = wins + case when p_outcome = 'win' then 1 else 0 end,
    stats = coalesce(stats,'{}'::jsonb) || jsonb_build_object(p_game, g), last_reward = now()
  where id = me returning * into r;
  return r;
end $$;
revoke all on function public.jeux__credit(uuid, text, text, int, int) from public, anon, authenticated;

-- partie solo (contre des robots) : 25 s minimum entre deux gains, 250 gemmes par jour au plus
create or replace function public.jeux_solo_reward(p_game text, p_outcome text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r public.jeux_profiles; today date := (now() at time zone 'Europe/Paris')::date;
  v_gems int; v_xp int; already int;
begin
  if p_outcome not in ('win','draw','lose') or p_game !~ '^[a-z0-9_]{2,20}$' then raise exception 'resultat invalide'; end if;
  select * into r from jeux_profiles where id = me for update;
  if not found then raise exception 'profil absent'; end if;
  if r.last_reward is not null and r.last_reward > now() - interval '25 seconds' then
    return jsonb_build_object('ok', false, 'reason', 'trop_vite', 'profile', to_jsonb(r));
  end if;
  v_gems := case p_outcome when 'win' then 12 when 'draw' then 6 else 3 end;
  v_xp   := case p_outcome when 'win' then 60 when 'draw' then 35 else 20 end;
  already := case when r.solo_day = today then r.solo_gems else 0 end;
  v_gems := greatest(0, least(v_gems, 250 - already));
  update jeux_profiles set solo_day = today, solo_gems = already + v_gems where id = me;
  insert into jeux_results (user_id, room_id, game, outcome, gems, xp) values (me, null, p_game, p_outcome, v_gems, v_xp);
  r := jeux__credit(me, p_game, p_outcome, v_gems, v_xp);
  return jsonb_build_object('ok', true, 'gems', v_gems, 'xp', v_xp, 'profile', to_jsonb(r));
end $$;

-- ---------------- salons
create or replace function public.jeux__is_member(p_players jsonb, me uuid)
returns boolean language sql immutable as $$
  select p_players @> jsonb_build_array(jsonb_build_object('id', me::text));
$$;

create or replace function public.jeux__code()
returns text language plpgsql as $$
declare alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text; i int;
begin
  loop
    c := '';
    for i in 1..5 loop c := c || substr(alphabet, 1 + floor(random()*length(alphabet))::int, 1); end loop;
    exit when not exists (select 1 from jeux_rooms where code = c);
  end loop;
  return c;
end $$;

create or replace function public.jeux_room_create(p_game text, p_max int, p_settings jsonb, p_me jsonb)
returns public.jeux_rooms language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r public.jeux_rooms; pl jsonb;
begin
  if me is null then raise exception 'non connecte'; end if;
  delete from jeux_rooms where updated_at < now() - interval '2 days';
  pl := jsonb_build_object('id', me::text,
          'name', left(coalesce(p_me->>'name','Joueur'), 20),
          'avatar', coalesce(p_me->'avatar', '{}'::jsonb),
          'photo', p_me->'photo');
  insert into jeux_rooms (code, game, host, max_players, settings, players)
  values (jeux__code(), p_game, me, greatest(1, least(coalesce(p_max,4), 8)), coalesce(p_settings,'{}'::jsonb), jsonb_build_array(pl))
  returning * into r;
  return r;
end $$;

create or replace function public.jeux_room_join(p_code text, p_me jsonb)
returns public.jeux_rooms language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r public.jeux_rooms; pl jsonb;
begin
  if me is null then raise exception 'non connecte'; end if;
  select * into r from jeux_rooms where code = upper(trim(p_code)) for update;
  if not found then raise exception 'salon introuvable'; end if;
  if jeux__is_member(r.players, me) then return r; end if;
  if r.status <> 'lobby' then raise exception 'partie deja commencee'; end if;
  if jsonb_array_length(r.players) >= r.max_players then raise exception 'salon complet'; end if;
  pl := jsonb_build_object('id', me::text,
          'name', left(coalesce(p_me->>'name','Joueur'), 20),
          'avatar', coalesce(p_me->'avatar', '{}'::jsonb),
          'photo', p_me->'photo');
  update jeux_rooms set players = players || jsonb_build_array(pl), version = version + 1, updated_at = now()
  where id = r.id returning * into r;
  delete from jeux_invites where room_id = r.id and to_user = me;
  return r;
end $$;

-- mise a jour optimiste : refusee si quelqu un a joue entre temps (version)
create or replace function public.jeux_room_update(p_room uuid, p_version int, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r public.jeux_rooms;
begin
  select * into r from jeux_rooms where id = p_room for update;
  if not found then raise exception 'salon introuvable'; end if;
  if not jeux__is_member(r.players, me) then raise exception 'pas dans ce salon'; end if;
  if r.version <> p_version then
    return jsonb_build_object('ok', false, 'room', to_jsonb(r));
  end if;
  update jeux_rooms set
    state       = case when p_patch ? 'state' then p_patch->'state' else state end,
    status      = coalesce(p_patch->>'status', status),
    players     = case when p_patch ? 'players' and jsonb_typeof(p_patch->'players') = 'array'
                       and jeux__is_member(p_patch->'players', me) then p_patch->'players' else players end,
    settings    = case when p_patch ? 'settings' then p_patch->'settings' else settings end,
    max_players = case when p_patch ? 'max_players' then greatest(1, least((p_patch->>'max_players')::int, 8)) else max_players end,
    version     = version + 1,
    updated_at  = now()
  where id = p_room returning * into r;
  return jsonb_build_object('ok', true, 'room', to_jsonb(r));
end $$;

create or replace function public.jeux_room_leave(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r public.jeux_rooms; rest jsonb; humans int;
begin
  select * into r from jeux_rooms where id = p_room for update;
  if not found or not jeux__is_member(r.players, me) then return; end if;
  if r.status = 'lobby' then
    select coalesce(jsonb_agg(p), '[]'::jsonb) into rest from jsonb_array_elements(r.players) p where p->>'id' <> me::text;
  else
    select coalesce(jsonb_agg(case when p->>'id' = me::text then p || '{"left":true}'::jsonb else p end), '[]'::jsonb)
      into rest from jsonb_array_elements(r.players) p;
  end if;
  select count(*) into humans from jsonb_array_elements(rest) p
    where coalesce((p->>'bot')::boolean,false) = false and coalesce((p->>'left')::boolean,false) = false;
  if humans = 0 and r.status <> 'done' then
    delete from jeux_rooms where id = p_room; return;
  end if;
  update jeux_rooms set players = rest, version = version + 1, updated_at = now(),
    host = case when host = me then coalesce((select (p->>'id')::uuid from jsonb_array_elements(rest) p
             where coalesce((p->>'bot')::boolean,false) = false and coalesce((p->>'left')::boolean,false) = false limit 1), host) else host end
  where id = p_room;
end $$;

-- gains de fin de partie : lus dans state.result.ranking, une seule fois par joueur et par salon
create or replace function public.jeux_room_claim(p_room uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r public.jeux_rooms; rk jsonb; place int; humans int; outcome text; v_round int;
  v_gems int; v_xp int; best int; nb_best int; prof public.jeux_profiles;
  tg int[] := array[30,15,8,5]; tx int[] := array[120,70,45,30];
begin
  select * into r from jeux_rooms where id = p_room;
  if not found then raise exception 'salon introuvable'; end if;
  if not jeux__is_member(r.players, me) then raise exception 'pas dans ce salon'; end if;
  if r.status <> 'done' then raise exception 'partie pas finie'; end if;
  v_round := coalesce((r.state->>'round')::int, 0);
  if exists (select 1 from jeux_results where user_id = me and room_id = p_room and round = v_round) then
    return jsonb_build_object('ok', false, 'reason', 'deja');
  end if;
  select e into rk from jsonb_array_elements(r.state->'result'->'ranking') e where e->>'id' = me::text;
  if rk is null then raise exception 'classement absent'; end if;
  place := greatest(1, coalesce((rk->>'rank')::int, 99));
  select count(*) into humans from jsonb_array_elements(r.players) p where coalesce((p->>'bot')::boolean,false) = false;
  select count(*) into nb_best from jsonb_array_elements(r.state->'result'->'ranking') e where (e->>'rank')::int = 1;
  outcome := case when place = 1 and nb_best = 1 then 'win' when place = 1 then 'draw' else 'lose' end;
  if humans >= 2 then
    v_gems := tg[least(place, 4)]; v_xp := tx[least(place, 4)];
    if outcome = 'draw' then v_gems := 15; v_xp := 70; end if;
  else
    -- un seul humain : tarif solo, avec les memes garde-fous que jeux_solo_reward
    v_gems := case outcome when 'win' then 12 when 'draw' then 6 else 3 end;
    v_xp   := case outcome when 'win' then 60 when 'draw' then 35 else 20 end;
    select * into prof from jeux_profiles where id = me for update;
    if prof.last_reward is not null and prof.last_reward > now() - interval '25 seconds' then v_gems := 0; end if;
    best := case when prof.solo_day = (now() at time zone 'Europe/Paris')::date then prof.solo_gems else 0 end;
    v_gems := greatest(0, least(v_gems, 250 - best));
    update jeux_profiles set solo_day = (now() at time zone 'Europe/Paris')::date, solo_gems = best + v_gems where id = me;
  end if;
  -- deux gains a moins de 10 s d intervalle : pas de gemmes (anti-triche)
  select * into prof from jeux_profiles where id = me;
  if prof.last_reward is not null and prof.last_reward > now() - interval '10 seconds' then v_gems := 0; end if;
  insert into jeux_results (user_id, room_id, game, outcome, place, gems, xp, round) values (me, p_room, r.game, outcome, place, v_gems, v_xp, v_round);
  prof := jeux__credit(me, r.game, outcome, v_gems, v_xp);
  return jsonb_build_object('ok', true, 'gems', v_gems, 'xp', v_xp, 'outcome', outcome, 'place', place, 'profile', to_jsonb(prof));
end $$;

-- ---------------- amis
create or replace function public.jeux_friend_request(p_username text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); other uuid; a uuid; b uuid; f public.jeux_friends;
begin
  select id into other from jeux_profiles where username = lower(trim(p_username));
  if other is null then raise exception 'joueur introuvable'; end if;
  if other = me then raise exception 'c est toi'; end if;
  a := least(me, other); b := greatest(me, other);
  select * into f from jeux_friends where user_a = a and user_b = b for update;
  if found then
    if f.status = 'pending' and f.requester <> me then
      update jeux_friends set status = 'accepted' where user_a = a and user_b = b;
      return jsonb_build_object('status', 'accepted');
    end if;
    return jsonb_build_object('status', f.status);
  end if;
  insert into jeux_friends (user_a, user_b, requester) values (a, b, me);
  return jsonb_build_object('status', 'pending');
end $$;

create or replace function public.jeux_friend_respond(p_other uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); a uuid := least(me, p_other); b uuid := greatest(me, p_other);
begin
  if p_accept then
    update jeux_friends set status = 'accepted' where user_a = a and user_b = b and requester <> me;
  else
    delete from jeux_friends where user_a = a and user_b = b;
  end if;
end $$;

create or replace function public.jeux_friend_remove(p_other uuid)
returns void language sql security definer set search_path = public as $$
  delete from jeux_friends where user_a = least(auth.uid(), p_other) and user_b = greatest(auth.uid(), p_other);
$$;

create or replace function public.jeux_invite(p_room uuid, p_to uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r public.jeux_rooms;
begin
  select * into r from jeux_rooms where id = p_room;
  if not found or not jeux__is_member(r.players, me) then raise exception 'pas dans ce salon'; end if;
  if not exists (select 1 from jeux_friends where user_a = least(me,p_to) and user_b = greatest(me,p_to) and status = 'accepted') then
    raise exception 'pas amis';
  end if;
  insert into jeux_invites (room_id, from_user, to_user, code, game) values (p_room, me, p_to, r.code, r.game)
  on conflict (room_id, to_user) do update set created_at = now(), code = excluded.code, game = excluded.game;
end $$;

-- ---------------- classement
create or replace function public.jeux_leaderboard(p_scope text, p_period text, p_game text default null)
returns table (id uuid, username text, display_name text, avatar_url text, equipped jsonb, value bigint, wins bigint)
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); since timestamptz := date_trunc('week', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris';
begin
  return query
  with pool as (
    select p.* from jeux_profiles p
    where p_scope <> 'friends' or p.id = me or exists (
      select 1 from jeux_friends f where f.status = 'accepted'
        and ((f.user_a = me and f.user_b = p.id) or (f.user_b = me and f.user_a = p.id)))
  ), agg as (
    select r.user_id, sum(r.xp)::bigint as xp, count(*) filter (where r.outcome = 'win')::bigint as w
    from jeux_results r
    where (p_period <> 'week' or r.created_at >= since) and (p_game is null or r.game = p_game)
    group by r.user_id
  )
  select pool.id, pool.username, pool.display_name, pool.avatar_url, pool.equipped,
    case when p_period = 'week' or p_game is not null then coalesce(agg.xp, 0) else pool.xp::bigint end as value,
    case when p_period = 'week' or p_game is not null then coalesce(agg.w, 0) else pool.wins::bigint end as wins
  from pool left join agg on agg.user_id = pool.id
  order by value desc, wins desc, pool.username
  limit 100;
end $$;

-- droits d execution
revoke all on function public.jeux_ensure_profile(text,text), public.jeux_set_username(text), public.jeux_buy(text),
  public.jeux_equip(text,text), public.jeux_daily(), public.jeux_solo_reward(text,text),
  public.jeux_room_create(text,int,jsonb,jsonb), public.jeux_room_join(text,jsonb), public.jeux_room_update(uuid,int,jsonb),
  public.jeux_room_leave(uuid), public.jeux_room_claim(uuid), public.jeux_friend_request(text),
  public.jeux_friend_respond(uuid,boolean), public.jeux_friend_remove(uuid), public.jeux_invite(uuid,uuid),
  public.jeux_leaderboard(text,text,text) from public, anon;
grant execute on function public.jeux_ensure_profile(text,text), public.jeux_set_username(text), public.jeux_buy(text),
  public.jeux_equip(text,text), public.jeux_daily(), public.jeux_solo_reward(text,text),
  public.jeux_room_create(text,int,jsonb,jsonb), public.jeux_room_join(text,jsonb), public.jeux_room_update(uuid,int,jsonb),
  public.jeux_room_leave(uuid), public.jeux_room_claim(uuid), public.jeux_friend_request(text),
  public.jeux_friend_respond(uuid,boolean), public.jeux_friend_remove(uuid), public.jeux_invite(uuid,uuid),
  public.jeux_leaderboard(text,text,text) to authenticated;
revoke all on function public.jeux__code() from public, anon, authenticated;

-- ============================================================ TEMPS REEL
do $$ begin
  begin alter publication supabase_realtime add table public.jeux_rooms; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.jeux_friends; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.jeux_invites; exception when duplicate_object then null; end;
end $$;

-- ============================================================ PHOTOS DE PROFIL
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('jeux-avatars', 'jeux-avatars', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "jeux avatars lecture" on storage.objects;
create policy "jeux avatars lecture" on storage.objects for select to public using (bucket_id = 'jeux-avatars');
drop policy if exists "jeux avatars ajout" on storage.objects;
create policy "jeux avatars ajout" on storage.objects for insert to authenticated
  with check (bucket_id = 'jeux-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "jeux avatars maj" on storage.objects;
create policy "jeux avatars maj" on storage.objects for update to authenticated
  using (bucket_id = 'jeux-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "jeux avatars suppression" on storage.objects;
create policy "jeux avatars suppression" on storage.objects for delete to authenticated
  using (bucket_id = 'jeux-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
