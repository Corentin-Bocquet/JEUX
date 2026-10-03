-- Test des fonctions serveur. Tout se passe dans un bloc qui finit par
-- l'exception TESTS_OK : la transaction est annulée, rien ne reste en base.
do $$
declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); r jsonb; p public.jeux_profiles;
  room public.jeux_rooms; v int; n int;
begin
  insert into auth.users (id, email, aud, role) values (a, 'testa_' || a || '@jeux.test', 'authenticated', 'authenticated');
  insert into auth.users (id, email, aud, role) values (b, 'testb_' || b || '@jeux.test', 'authenticated', 'authenticated');

  -- joueur A
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  p := jeux_ensure_profile('Alice!', 'Alice');
  assert p.username = 'alice' or p.username like 'alice%', 'pseudo nettoye ' || p.username;
  assert p.gems = 200, 'gemmes de depart';
  p := jeux_ensure_profile('autre', 'Autre');
  assert p.display_name = 'Alice', 'profil non recree';
  -- boutique
  p := jeux_buy('hat_casquette');
  assert p.gems = 80 and 'hat_casquette' = any(p.owned), 'achat casquette';
  p := jeux_buy('hat_casquette');
  assert p.gems = 80, 'pas de double achat';
  begin perform jeux_buy('hat_couronne'); assert false, 'achat trop cher accepte';
  exception when others then assert sqlerrm like '%gemmes%', sqlerrm; end;
  p := jeux_equip('hat', 'hat_casquette');
  assert p.equipped->>'hat' = 'hat_casquette', 'equipement';
  begin perform jeux_equip('hat', 'hat_couronne'); assert false, 'equipe non possede';
  exception when others then assert sqlerrm like '%possede%', sqlerrm; end;
  -- coffre du jour
  r := jeux_daily(); assert (r->>'ok')::boolean and (r->>'gems')::int = 40, 'coffre jour 1';
  r := jeux_daily(); assert not (r->>'ok')::boolean, 'coffre deja pris';
  -- solo
  r := jeux_solo_reward('puissance4', 'win'); assert (r->>'gems')::int = 12, 'solo win';
  r := jeux_solo_reward('puissance4', 'win'); assert not (r->>'ok')::boolean, 'cooldown solo';

  -- joueur B
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  p := jeux_ensure_profile('alice', 'Bob');
  assert p.username <> (select username from jeux_profiles where id = a), 'pseudo unique';
  p := jeux_set_username('bobby_42'); assert p.username = 'bobby_42', 'renommer';
  -- amis
  r := jeux_friend_request((select username from jeux_profiles where id = a));
  assert r->>'status' = 'pending', 'demande ami';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  r := jeux_friend_request('bobby_42'); assert r->>'status' = 'accepted', 'demande croisee acceptee';

  -- salon : A cree, B rejoint, partie, gains
  room := jeux_room_create('yams', 4, '{}'::jsonb, '{"name":"Alice"}'::jsonb);
  assert length(room.code) = 5, 'code salon';
  perform jeux_invite(room.id, b);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from jeux_invites where to_user = b; assert n = 1, 'invitation recue';
  room := jeux_room_join(lower(room.code), '{"name":"Bob"}'::jsonb);
  assert jsonb_array_length(room.players) = 2, 'deux joueurs';
  select count(*) into n from jeux_invites where to_user = b; assert n = 0, 'invitation consommee';
  r := jeux_room_update(room.id, room.version, '{"status":"playing","state":{"t":1}}'::jsonb);
  assert (r->>'ok')::boolean, 'maj ok';
  r := jeux_room_update(room.id, room.version, '{"state":{"t":2}}'::jsonb);
  assert not (r->>'ok')::boolean, 'conflit de version detecte';
  v := (r->'room'->>'version')::int;
  r := jeux_room_update(room.id, v, jsonb_build_object('status','done','state',
        jsonb_build_object('result', jsonb_build_object('ranking', jsonb_build_array(
          jsonb_build_object('id', b::text, 'rank', 1), jsonb_build_object('id', a::text, 'rank', 2))))));
  assert (r->>'ok')::boolean, 'fin de partie';
  r := jeux_room_claim(room.id);
  assert (r->>'gems')::int = 30 and r->>'outcome' = 'win', 'gain vainqueur ' || r::text;
  r := jeux_room_claim(room.id); assert not (r->>'ok')::boolean, 'pas de double gain';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  update jeux_profiles set last_reward = null where id = a;
  r := jeux_room_claim(room.id);
  assert (r->>'gems')::int = 15 and r->>'outcome' = 'lose', 'gain second ' || r::text;
  -- classement amis
  select count(*) into n from jeux_leaderboard('friends', 'week', null) l where l.id in (a, b);
  assert n = 2, 'classement amis';
  -- quitter
  perform jeux_room_leave(room.id);
  select players into r from jeux_rooms where id = room.id;
  assert r @> '[{"left":true}]'::jsonb, 'depart marque';

  raise exception 'TESTS_OK';
end $$;
