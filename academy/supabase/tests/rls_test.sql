-- Test delle policy RLS. Si eseguono con: npm run db:test  (supabase test db)
-- Tutto avviene in una transazione annullata alla fine: il database resta pulito.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(59);

-- ---------------------------------------------------------------------------
-- Utilità: impersonare un utente come fa PostgREST
-- ---------------------------------------------------------------------------
create schema tests;
grant usage on schema tests to anon, authenticated;

create function tests.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create function tests.anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('role', 'anon', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Dati di prova
--   tenant A: admin A, studenti S1 (iscritto a C1) e S2 (non iscritto)
--   tenant B: admin B
--   C1 = A pubblicato (L1 gratis, L2 a pagamento) · C2 = A bozza (L4 gratis)
--   C3 = B pubblicato (L3 a pagamento)
-- ---------------------------------------------------------------------------
insert into public.tenants (id, nome, slug) values
  ('a0000000-0000-4000-8000-000000000000', 'Tenant A', 'test-a'),
  ('b0000000-0000-4000-8000-000000000000', 'Tenant B', 'test-b');

insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-4000-8000-0000000000a1', 'admin-a@test.local', '{"tenant":"test-a","nome":"Ada"}'),
  ('a0000000-0000-4000-8000-0000000000b1', 's1@test.local', '{"tenant":"test-a","nome":"Sara"}'),
  ('a0000000-0000-4000-8000-0000000000b2', 's2@test.local', '{"tenant":"test-a","nome":"Luca"}'),
  ('b0000000-0000-4000-8000-0000000000a1', 'admin-b@test.local', '{"tenant":"test-b","nome":"Bea"}');

update public.memberships set ruolo = 'admin'
where user_id in ('a0000000-0000-4000-8000-0000000000a1', 'b0000000-0000-4000-8000-0000000000a1');

insert into public.courses (id, tenant_id, slug, titolo, stato) values
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000000', 'c1', 'Corso 1', 'published'),
  ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000000', 'c2', 'Corso 2', 'draft'),
  ('c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000000', 'c3', 'Corso 3', 'published');

insert into public.modules (id, course_id, titolo, ordine) values
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'M1', 1),
  ('d0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'M2', 1),
  ('d0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000003', 'M3', 1);

-- course_id viene ricavato dal modulo dal trigger.
insert into public.lessons (id, module_id, course_id, slug, titolo, is_free_preview, bunny_video_id) values
  ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', 'l1', 'L1', true, 'vid-1'),
  ('e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', null, 'l2', 'L2', false, 'vid-2'),
  ('e0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000002', null, 'l4', 'L4', true, 'vid-4'),
  ('e0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000003', null, 'l3', 'L3', false, 'vid-3');

insert into public.enrollments (user_id, course_id, fonte) values
  ('a0000000-0000-4000-8000-0000000000b1', 'c0000000-0000-4000-8000-000000000001', 'manuale');

insert into public.orders (user_id, course_id, importo_cents, stato) values
  ('a0000000-0000-4000-8000-0000000000b1', 'c0000000-0000-4000-8000-000000000001', 19700, 'pagato');

insert into public.lesson_progress (user_id, lesson_id, ultimo_secondo) values
  ('a0000000-0000-4000-8000-0000000000b1', 'e0000000-0000-4000-8000-000000000002', 120);

insert into public.certificates (user_id, course_id, codice, nome_intestatario) values
  ('a0000000-0000-4000-8000-0000000000b1', 'c0000000-0000-4000-8000-000000000001', 'NX-TEST-0000-0001', 'Sara Rossi');

select is(
  (select course_id from public.lessons where id = 'e0000000-0000-4000-8000-000000000001'),
  'c0000000-0000-4000-8000-000000000001'::uuid,
  'trigger: la lezione prende il corso dal modulo, non dal client'
);
select is(
  (select tenant_id from public.enrollments limit 1),
  'a0000000-0000-4000-8000-000000000000'::uuid,
  'trigger: l''iscrizione prende il tenant dal corso'
);

-- ---------------------------------------------------------------------------
-- Visitatore anonimo
-- ---------------------------------------------------------------------------
select tests.anon();

select is(
  (select count(*)::int from public.courses where tenant_id = 'a0000000-0000-4000-8000-000000000000'),
  1, 'anon: vede solo i corsi pubblicati');
select is(
  (select count(*)::int from public.lessons where course_id = 'c0000000-0000-4000-8000-000000000001'),
  1, 'anon: vede solo la lezione in anteprima gratuita');
select is(
  (select count(*)::int from public.lessons where id = 'e0000000-0000-4000-8000-000000000004'),
  0, 'anon: non vede le anteprime dei corsi in bozza');
select is(
  (select count(*)::int from public.course_outline('c0000000-0000-4000-8000-000000000001')),
  2, 'anon: il programma pubblico elenca tutte le lezioni');
select is(
  (select count(*)::int from public.course_outline('c0000000-0000-4000-8000-000000000002')),
  0, 'anon: nessun programma per i corsi in bozza');
select throws_ok(
  $$insert into public.courses (tenant_id, slug, titolo) values ('a0000000-0000-4000-8000-000000000000', 'x', 'X')$$,
  '42501', null, 'anon: non può creare corsi');
select throws_ok($$select * from public.profiles$$, '42501', null, 'anon: non legge i profili');
select is(
  (select nome_intestatario from public.verify_certificate(' nx-test-0000-0001 ')),
  'Sara Rossi', 'anon: verifica pubblica dell''attestato');

-- ---------------------------------------------------------------------------
-- Studente S2, non iscritto
-- ---------------------------------------------------------------------------
reset role;
select tests.login('a0000000-0000-4000-8000-0000000000b2');

select is(
  (select count(*)::int from public.lessons where course_id = 'c0000000-0000-4000-8000-000000000001'),
  1, 'S2: senza iscrizione vede solo l''anteprima');
select throws_ok(
  $$insert into public.lesson_progress (user_id, lesson_id) values ('a0000000-0000-4000-8000-0000000000b2', 'e0000000-0000-4000-8000-000000000002')$$,
  '42501', null, 'S2: non registra avanzamento su lezioni a pagamento');
select lives_ok(
  $$insert into public.lesson_progress (user_id, lesson_id) values ('a0000000-0000-4000-8000-0000000000b2', 'e0000000-0000-4000-8000-000000000001')$$,
  'S2: registra avanzamento sull''anteprima gratuita');
select throws_ok(
  $$insert into public.lesson_progress (user_id, lesson_id) values ('a0000000-0000-4000-8000-0000000000b1', 'e0000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'S2: non scrive l''avanzamento di un altro');
select is((select count(*)::int from public.lesson_progress), 1, 'S2: legge solo il proprio avanzamento');
select throws_ok(
  $$insert into public.enrollments (user_id, course_id, fonte) values ('a0000000-0000-4000-8000-0000000000b2', 'c0000000-0000-4000-8000-000000000001', 'manuale')$$,
  '42501', null, 'S2: non può iscriversi da solo');
select throws_ok(
  $$update public.memberships set ruolo = 'admin' where user_id = 'a0000000-0000-4000-8000-0000000000b2'$$,
  '42501', null, 'S2: non può cambiarsi il ruolo');
select lives_ok(
  $$update public.profiles set nome = 'Luca B.' where id = 'a0000000-0000-4000-8000-0000000000b2'$$,
  'S2: modifica il proprio nome');
select is((select count(*)::int from public.profiles), 1, 'S2: vede solo il proprio profilo');
select is(
  (select count(*)::int from public.courses where id = 'c0000000-0000-4000-8000-000000000002'),
  0, 'S2: non vede i corsi in bozza');
select throws_ok(
  $$insert into public.questions (lesson_id, testo) values ('e0000000-0000-4000-8000-000000000001', 'Domanda?')$$,
  '42501', null, 'S2: senza iscrizione non fa domande');
select is((select count(*)::int from public.orders), 0, 'S2: non vede ordini altrui');
select is((select count(*)::int from public.certificates), 0, 'S2: non vede attestati altrui');

-- ---------------------------------------------------------------------------
-- Studente S1, iscritto a C1
-- ---------------------------------------------------------------------------
reset role;
select tests.login('a0000000-0000-4000-8000-0000000000b1');

select is(
  (select count(*)::int from public.lessons where course_id = 'c0000000-0000-4000-8000-000000000001'),
  2, 'S1: iscritto, vede tutte le lezioni del corso');
select is(
  (select count(*)::int from public.lessons where course_id = 'c0000000-0000-4000-8000-000000000003'),
  0, 'S1: non vede le lezioni di altri corsi');
select lives_ok(
  $$insert into public.notes (lesson_id, secondo, testo) values ('e0000000-0000-4000-8000-000000000002', 95, 'Nota')$$,
  'S1: scrive una nota sulla lezione');
select throws_ok(
  $$insert into public.notes (lesson_id, testo) values ('e0000000-0000-4000-8000-000000000003', 'Nota')$$,
  '42501', null, 'S1: niente note su corsi a cui non è iscritto');
select lives_ok(
  $$insert into public.questions (id, lesson_id, testo) values ('f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002', 'Come importo i contatti?')$$,
  'S1: fa una domanda');
select lives_ok(
  $$insert into public.answers (question_id, testo, is_docente) values ('f0000000-0000-4000-8000-000000000001', 'Aggiungo un dettaglio', true)$$,
  'S1: aggiunge un messaggio al thread');
select is(
  (select is_docente from public.answers where user_id = 'a0000000-0000-4000-8000-0000000000b1'),
  false, 'S1: non può marcarsi come docente');
select is((select count(*)::int from public.certificates), 1, 'S1: vede il proprio attestato');

-- ---------------------------------------------------------------------------
-- S2 di nuovo: le note sono private
-- ---------------------------------------------------------------------------
reset role;
select tests.login('a0000000-0000-4000-8000-0000000000b2');
select is((select count(*)::int from public.notes), 0, 'S2: non vede le note di S1');

-- ---------------------------------------------------------------------------
-- Admin del tenant A
-- ---------------------------------------------------------------------------
reset role;
select tests.login('a0000000-0000-4000-8000-0000000000a1');

select is(
  (select count(*)::int from public.courses where id = 'c0000000-0000-4000-8000-000000000002'),
  1, 'admin A: vede le bozze del proprio tenant');
select is((select count(*)::int from public.profiles), 3, 'admin A: vede i profili del proprio tenant');
select is((select count(*)::int from public.lesson_progress), 2, 'admin A: vede l''avanzamento degli studenti');
select is(
  (select count(*)::int from public.lessons where course_id = 'c0000000-0000-4000-8000-000000000003'),
  0, 'admin A: non vede i contenuti del tenant B');
select lives_ok(
  $$insert into public.modules (course_id, titolo, ordine) values ('c0000000-0000-4000-8000-000000000001', 'M nuovo', 2)$$,
  'admin A: crea un modulo');
select throws_ok(
  $$insert into public.enrollments (user_id, course_id, fonte) values ('a0000000-0000-4000-8000-0000000000b2', 'c0000000-0000-4000-8000-000000000003', 'manuale')$$,
  '42501', null, 'admin A: non iscrive a corsi del tenant B');
select lives_ok(
  $$insert into public.enrollments (user_id, course_id, fonte) values ('a0000000-0000-4000-8000-0000000000b2', 'c0000000-0000-4000-8000-000000000001', 'manuale')$$,
  'admin A: dà accesso manuale a S2');
select lives_ok(
  $$insert into public.answers (question_id, testo) values ('f0000000-0000-4000-8000-000000000001', 'Usa l''importazione guidata.')$$,
  'admin A: risponde alla domanda');

reset role;
select is(
  (select stato::text from public.questions where id = 'f0000000-0000-4000-8000-000000000001'),
  'risposta', 'la risposta del docente segna la domanda come risolta');

-- ---------------------------------------------------------------------------
-- Admin del tenant B: non tocca i corsi del tenant A
-- ---------------------------------------------------------------------------
select tests.login('b0000000-0000-4000-8000-0000000000a1');
update public.courses set titolo = 'Manomesso' where id = 'c0000000-0000-4000-8000-000000000001';
reset role;
select is(
  (select titolo from public.courses where id = 'c0000000-0000-4000-8000-000000000001'),
  'Corso 1', 'admin B: non modifica corsi del tenant A');

-- ---------------------------------------------------------------------------
-- Thread delle domande con nomi brevi
-- ---------------------------------------------------------------------------
select tests.login('a0000000-0000-4000-8000-0000000000b1');
select is(
  (select count(*)::int from public.lesson_thread('e0000000-0000-4000-8000-000000000002')),
  3, 'S1: vede domanda e risposte del thread');
select is(
  (select autore from public.lesson_thread('e0000000-0000-4000-8000-000000000002') where tipo = 'domanda'),
  'Sara', 'thread: mostra solo il nome breve dell''autore');
reset role;
select tests.login('a0000000-0000-4000-8000-0000000000b2');
select is(
  (select count(*)::int from public.lesson_thread('e0000000-0000-4000-8000-000000000003')),
  0, 'S2: nessun thread su corsi senza accesso');
reset role;
select tests.anon();
select throws_ok(
  $$select * from public.lesson_thread('e0000000-0000-4000-8000-000000000002')$$,
  '42501', null, 'anon: non legge i thread');
reset role;

-- ---------------------------------------------------------------------------
-- Multi-azienda: appartenenze, creazione self-service, dati riservati del tenant
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from public.memberships where tenant_id = 'a0000000-0000-4000-8000-000000000000'),
  3, 'registrazione: ogni utente entra come studente nell''azienda da cui si iscrive');

select tests.anon();
select throws_ok($$select stripe_customer_id from public.tenants$$, '42501', null,
  'anon: non legge i dati di fatturazione del tenant');
select is((select count(*)::int from public.tenants where slug = 'test-a'), 1, 'anon: legge nome e marchio del tenant');
select throws_ok($$select public.create_tenant('X', 'nuova-x')$$, '42501', null, 'anon: non crea academy');
reset role;

select tests.login('a0000000-0000-4000-8000-0000000000b2');
select throws_ok(
  $$insert into public.memberships (user_id, tenant_id, ruolo) values ('a0000000-0000-4000-8000-0000000000b2', 'b0000000-0000-4000-8000-000000000000', 'admin')$$,
  '42501', null, 'S2: non si aggiunge da solo come admin di un''azienda');
update public.tenants set nome = 'Manomesso' where id = 'a0000000-0000-4000-8000-000000000000';
select throws_ok($$select public.create_tenant('Admin', 'admin')$$, '23505', null,
  'create_tenant: i sottodomini riservati non si possono prendere');
select lives_ok($$select public.create_tenant('Academy di Luca', 'academy-luca')$$,
  'S2: crea la sua academy self-service');
select is(
  (select m.ruolo::text from public.memberships m join public.tenants t on t.id = m.tenant_id
   where t.slug = 'academy-luca' and m.user_id = 'a0000000-0000-4000-8000-0000000000b2'),
  'admin', 'S2: diventa admin della nuova academy');
select is((select stato::text from public.tenants where slug = 'academy-luca'), 'prova', 'la nuova academy parte in prova');
reset role;
select is((select nome from public.tenants where id = 'a0000000-0000-4000-8000-000000000000'), 'Tenant A',
  'S2: non modifica il nome di un''azienda dove è solo studente');

-- S1 entra anche nel tenant B con lo stesso account.
select tests.login('a0000000-0000-4000-8000-0000000000b1');
select lives_ok($$select public.join_tenant('b0000000-0000-4000-8000-000000000000')$$,
  'S1: entra come studente in una seconda academy');
reset role;
select tests.login('b0000000-0000-4000-8000-0000000000a1');
select is(
  (select count(*)::int from public.profiles where id = 'a0000000-0000-4000-8000-0000000000b1'),
  1, 'admin B: vede il profilo di S1, ora suo studente');
select is(
  (select count(*)::int from public.profiles where id = 'a0000000-0000-4000-8000-0000000000b2'),
  0, 'admin B: non vede studenti che non sono suoi');
reset role;

select * from finish();
rollback;
