-- Test delle regole di abbonamento (Fase 5). Gira in una transazione annullata alla fine:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/billing_phase5.sql
begin;

create temp table results (name text, ok boolean) on commit drop;
grant all on results to authenticated;

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values ('00000000-0000-0000-0000-00000000b001', 'billing.owner@test.it', '{"full_name":"Titolare"}', 'authenticated', 'authenticated'),
       ('00000000-0000-0000-0000-00000000b002', 'billing.other@test.it', '{"full_name":"Altro"}', 'authenticated', 'authenticated');

-- Il titolare crea la sua azienda (prova gratuita)
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000b001","role":"authenticated"}';
select set_config('test.ws', (public.create_workspace('Azienda Paga', 'retail', 'Bari')).id::text, true);

-- Una seconda azienda da solo: rifiutata
do $$ begin
  perform public.create_workspace('Seconda', 'retail', 'Bari');
  insert into results values ('seconda azienda rifiutata', false);
exception when others then insert into results values ('seconda azienda rifiutata', sqlerrm like 'Hai già un''azienda%'); end $$;

-- Un brand senza abbonamento: rifiutato
do $$ begin
  perform public.create_brand(current_setting('test.ws')::uuid, 'Brand 2');
  insert into results values ('brand senza abbonamento rifiutato', false);
exception when others then insert into results values ('brand senza abbonamento rifiutato', sqlerrm like '%abbonamento attivo%'); end $$;

-- Il cliente non può scriversi il piano né i contatori
do $$ begin
  update public.workspaces set plan_id = 'business' where id = current_setting('test.ws')::uuid;
  insert into results values ('cliente non cambia il piano', false);
exception when insufficient_privilege then insert into results values ('cliente non cambia il piano', true); end $$;
do $$ begin
  insert into public.usage_counters (workspace_id, period_start, period_end)
  values (current_setting('test.ws')::uuid, now(), now());
  insert into results values ('cliente non scrive i contatori', false);
exception when insufficient_privilege then insert into results values ('cliente non scrive i contatori', true); end $$;
do $$ begin
  perform public.reserve_video(current_setting('test.ws')::uuid);
  insert into results values ('cliente non chiama reserve_video', false);
exception when insufficient_privilege then insert into results values ('cliente non chiama reserve_video', true); end $$;

reset role;

-- Prova gratuita: 3 video, poi blocco; restituzione
insert into results select 'prova: 1° video', (public.reserve_video(current_setting('test.ws')::uuid)->>'ok')::boolean;
insert into results select 'prova: 2° video', (public.reserve_video(current_setting('test.ws')::uuid)->>'ok')::boolean;
insert into results select 'prova: 3° video', (public.reserve_video(current_setting('test.ws')::uuid)->>'ok')::boolean;
insert into results select 'prova: 4° video bloccato', public.reserve_video(current_setting('test.ws')::uuid)->>'reason' = 'trial_over';
select public.release_reservation(current_setting('test.ws')::uuid, null);
insert into results select 'prova: restituzione', (select trial_videos_left = 1 from public.workspaces where id = current_setting('test.ws')::uuid);

-- Abbonamento Business attivo (come dal webhook)
update public.workspaces
set plan_id = 'business', subscription_status = 'active', billing_interval = 'month',
    period_start = '2026-11-01', period_end = '2026-12-01'
where id = current_setting('test.ws')::uuid;

-- Brand aggiuntivi: 3 in tutto con Business
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000b001","role":"authenticated"}';
select set_config('test.b2', (public.create_brand(current_setting('test.ws')::uuid, 'Brand Due')).id::text, true);
select set_config('test.b3', (public.create_brand(current_setting('test.ws')::uuid, 'Brand Tre')).id::text, true);
do $$ begin
  perform public.create_brand(current_setting('test.ws')::uuid, 'Brand Quattro');
  insert into results values ('quarto brand rifiutato', false);
exception when others then insert into results values ('quarto brand rifiutato', sqlerrm like 'Il piano Business include 3 brand%'); end $$;
insert into results select 'il titolare vede i 3 brand', (select count(*) = 3 from public.workspaces where name in ('Azienda Paga', 'Brand Due', 'Brand Tre'));

-- Un altro utente non aggiunge brand all'azienda
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000b002","role":"authenticated"}';
do $$ begin
  perform public.create_brand(current_setting('test.ws')::uuid, 'Intruso');
  insert into results values ('estraneo non aggiunge brand', false);
exception when others then insert into results values ('estraneo non aggiunge brand', sqlerrm like 'Solo il titolare%'); end $$;
insert into results select 'estraneo non vede i contatori', (select count(*) = 0 from public.usage_counters);
reset role;

insert into results select 'brand nuovo con piano dell''azienda',
  (select plan_id = 'business' and subscription_status = 'active' and trial_videos_left = 0
   from public.workspaces where id = current_setting('test.b2')::uuid);

-- 25 video per ciascun brand
do $$ declare i int; r jsonb; begin
  for i in 1..25 loop
    r := public.reserve_video(current_setting('test.b2')::uuid);
    if not (r->>'ok')::boolean then raise exception 'riserva % fallita', i; end if;
  end loop;
end $$;
insert into results select 'brand 2: 26° video bloccato', public.reserve_video(current_setting('test.b2')::uuid)->>'reason' = 'limit_reached';
insert into results select 'brand 3: contatore separato', (public.reserve_video(current_setting('test.b3')::uuid)->>'ok')::boolean;

-- Restituzione idempotente da un video
insert into public.raw_uploads (id, workspace_id, storage_path, file_name, size_bytes, mime_type, source)
values ('00000000-0000-0000-0000-00000000c001', current_setting('test.b2')::uuid, 'x/y.mov', 'y.mov', 1, 'video/quicktime', 'upload');
insert into public.videos (id, workspace_id, raw_upload_id, status, quota_kind, billed_period_start)
values ('00000000-0000-0000-0000-00000000d001', current_setting('test.b2')::uuid, '00000000-0000-0000-0000-00000000c001', 'error', 'plan', '2026-11-01');
select public.release_video('00000000-0000-0000-0000-00000000d001');
select public.release_video('00000000-0000-0000-0000-00000000d001');
insert into results select 'restituzione una volta sola', (select videos_used = 24 from public.usage_counters where workspace_id = current_setting('test.b2')::uuid);

-- Crediti b-roll: 100 al mese per brand
insert into results select 'b-roll: 98 concessi', public.use_broll_credits(current_setting('test.b3')::uuid, 98) = 98;
insert into results select 'b-roll: ne restano 2', public.use_broll_credits(current_setting('test.b3')::uuid, 5) = 2;
insert into results select 'b-roll: finiti', public.use_broll_credits(current_setting('test.b3')::uuid, 1) = 0;

-- Pagamento fallito da 1 giorno: tolleranza di 2 giorni, si lavora ancora
update public.workspaces set subscription_status = 'past_due', payment_failed_at = now() - interval '1 day'
where id = current_setting('test.ws')::uuid;
insert into results select 'tolleranza: montaggio ancora possibile il 1° giorno', (public.reserve_video(current_setting('test.b3')::uuid)->>'ok')::boolean;
insert into results select 'tolleranza: b-roll ancora disponibile', public.use_broll_credits(current_setting('test.b2')::uuid, 1) = 1;

-- Pagamento fallito da 3 giorni: propagato ai brand, nuovi montaggi bloccati, nulla cancellato
update public.workspaces set subscription_status = 'past_due', payment_failed_at = now() - interval '3 days'
where id = current_setting('test.ws')::uuid;
insert into results select 'pagamento fallito propagato', (select bool_and(subscription_status = 'past_due') from public.workspaces where billing_workspace_id = current_setting('test.ws')::uuid);
insert into results select 'pagamento fallito: montaggio bloccato', public.reserve_video(current_setting('test.b3')::uuid)->>'reason' = 'payment_failed';
insert into results select 'pagamento fallito: video conservati', (select count(*) = 1 from public.videos where workspace_id = current_setting('test.b2')::uuid);
insert into results select 'pagamento fallito: niente b-roll', public.use_broll_credits(current_setting('test.ws')::uuid, 1) = 0;

-- Rinnovo: nuovo periodo, contatori da zero
update public.workspaces
set subscription_status = 'active', payment_failed_at = null, period_start = '2026-12-01', period_end = '2027-01-01'
where id = current_setting('test.ws')::uuid;
insert into results select 'rinnovo: contatori azzerati', (public.reserve_video(current_setting('test.b2')::uuid)->>'period_start')::timestamptz = '2026-12-01';
insert into results select 'rinnovo: storico conservato', (select count(*) = 2 from public.usage_counters where workspace_id = current_setting('test.b2')::uuid);

-- Disdetta: bloccato
update public.workspaces set subscription_status = 'canceled' where id = current_setting('test.ws')::uuid;
insert into results select 'disdetta: montaggio bloccato', public.reserve_video(current_setting('test.b3')::uuid)->>'reason' = 'inactive';

select case when ok then '✓' else '✗' end || ' ' || name as esito from results;
select count(*) filter (where ok) || '/' || count(*) || ' controlli superati' as totale from results;
rollback;
