-- Test RLS Fase 1 su Postgres locale (stub di auth/storage in 00_local_stub.sql).
-- Uso: supabase/tests/run_local.sh  — ogni riga 'ERRORE:' stampata è un fallimento.
\set ON_ERROR_STOP 0
\pset tuples_only on
insert into auth.users (id,email,raw_user_meta_data) values
 ('a0000000-0000-0000-0000-00000000000a','a@x.it','{"full_name":"Anna Owner"}'),
 ('b0000000-0000-0000-0000-00000000000b','b@x.it','{"name":"Bruno Member"}'),
 ('c0000000-0000-0000-0000-00000000000c','c@y.it','{}'),
 ('d0000000-0000-0000-0000-00000000000d','admin@nexora.it','{}');
update public.profiles set is_admin = true where user_id='d0000000-0000-0000-0000-00000000000d';
select 'profili creati dal trigger: ' || count(*) from profiles;

create or replace function pg_temp.as_user(u text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', u, false); end $$;

-- A crea ws1, C crea ws2
set role authenticated;
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
select 'ws1 slug: ' || slug from create_workspace('Pizzeria Dà Mario!', 'ristorazione', 'Bari', null, '@damario');
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
select 'ws2 slug: ' || slug from create_workspace('Pizzeria Da Mario', 'ristorazione', 'Lecce');
-- A invita B
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
insert into workspace_invitations (workspace_id, email, invited_by)
  select id, 'B@X.IT', 'a0000000-0000-0000-0000-00000000000a' from workspaces;
-- C prova a invitarsi in ws1 (deve fallire: non vede ws1)
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
insert into workspace_invitations (workspace_id, email, invited_by)
  select id, 'c@y.it', 'c0000000-0000-0000-0000-00000000000c' from workspaces where slug='pizzeria-da-mario';
select 'C vede inviti: ' || count(*) from workspace_invitations;
-- C prova ad accettare l'invito di B (token rubato) → errore email
reset role;
select set_config('t.tok', (select token::text from workspace_invitations limit 1), false);
set role authenticated;
select accept_invitation(current_setting('t.tok')::uuid);
-- B accetta
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select 'B entra nel workspace: ' || accept_invitation(current_setting('t.tok')::uuid);
select 'B riaccetta (deve fallire):';
select accept_invitation(current_setting('t.tok')::uuid);

-- Visibilità
select 'B vede workspace: ' || string_agg(slug, ',') from workspaces;
select 'B vede profili: ' || string_agg(coalesce(full_name,'-'), ',' order by full_name) from profiles;
select 'B vede inviti (member, atteso 0): ' || count(*) from workspace_invitations;
select 'B vede audit (member, atteso 0): ' || count(*) from audit_log;
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
select 'C vede workspace: ' || string_agg(slug, ',') from workspaces;
select 'C vede membri: ' || count(*) from workspace_members;
select 'C vede profili (atteso 1): ' || count(*) from profiles;
select 'C vede brand (atteso 1): ' || count(*) from brand_profiles;
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d');
select 'Admin vede workspace: ' || count(*) from workspaces;
select pg_temp.as_user('');
select 'Anonimo (authenticated senza uid) vede workspace: ' || count(*) from workspaces;
reset role; set role anon;
select 'anon vede piani: ' || count(*) from plans;
select 'anon vede workspace:'; select count(*) from workspaces;
reset role; set role authenticated;

-- Scritture vietate
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
update workspaces set name='Hack' returning 'ERRORE: member ha modificato il workspace';
update brand_profiles set tone_of_voice='simpatico' returning 'member aggiorna brand: ok';
update profiles set is_admin=true where user_id='b0000000-0000-0000-0000-00000000000b';
update workspace_members set role='owner' returning 'ERRORE: member si è promosso';
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
update workspaces set plan_id='business';
update workspaces set trial_videos_left=99;
update workspaces set name='Da Mario Bari', posting_days='{2,4}' returning 'owner aggiorna dati azienda: ok';
update workspaces set posting_days='{8}';
update plans set price_monthly_cents=1 returning 'ERRORE: owner modifica piani';
insert into workspace_members (workspace_id,user_id,role) select id,'c0000000-0000-0000-0000-00000000000c','owner' from workspaces;
delete from workspace_members where user_id='a0000000-0000-0000-0000-00000000000a';
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
update workspaces set name='Hack' where slug='pizzeria-da-mario' returning 'ERRORE: C modifica ws altrui';
delete from workspace_members where user_id='b0000000-0000-0000-0000-00000000000b' returning 'ERRORE: C rimuove B';

-- Storage
reset role;
select set_config('t.ws1', (select id::text from workspaces where slug='pizzeria-da-mario'), false);
select set_config('t.ws2', (select id::text from workspaces where slug='pizzeria-da-mario-2'), false);
set role authenticated;
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
insert into storage.objects (bucket_id,name) values ('raw', current_setting('t.ws1')||'/girato.mp4') returning 'B carica in raw ws1: ok';
insert into storage.objects (bucket_id,name) values ('raw', current_setting('t.ws2')||'/x.mp4');
insert into storage.objects (bucket_id,name) values ('output', current_setting('t.ws1')||'/x.mp4');
insert into storage.objects (bucket_id,name) values ('raw', 'girato-senza-cartella.mp4');
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
select 'C vede file (atteso 0): ' || count(*) from storage.objects;
