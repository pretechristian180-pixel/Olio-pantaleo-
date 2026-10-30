-- =====================================================================
-- Studio — Fase 2: generazione reale (HeyGen per l'avatar + servizio di montaggio)
-- Coda di lavori su studio_jobs, elaborata dalla Edge Function "studio-lavori":
--  - ogni minuto da pg_cron (con un segreto conservato in Supabase Vault);
--  - subito, quando l'app la "sveglia" o arriva un webhook di un fornitore.
-- Le chiavi dei fornitori sono solo secrets delle Edge Functions, mai nel database o nel frontend.
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Un lavoro preso in carico non viene ripreso da un'altra esecuzione finché il "blocco" non scade
alter table public.studio_jobs add column if not exists bloccato_fino timestamptz;
-- Dettaglio tecnico dell'ultimo errore (per l'assistenza); all'utente va solo il messaggio in italiano
alter table public.studio_jobs add column if not exists errore_tecnico text;
create index if not exists studio_jobs_coda on public.studio_jobs (stato, pronto_at) where stato in ('in_coda', 'in_corso');

-- ---------- Avvio generazione: ora mette in coda un lavoro "video" ----------
create or replace function public.studio_start_generation(pid uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.video_projects;
  v_piano public.piano_agenzia;
  limite integer;
  oggi integer;
  avatar uuid;
begin
  select * into v from public.video_projects where id = pid and agency_id = public.get_my_agency_id();
  if not found then raise exception 'Video non trovato' using errcode = 'P0002'; end if;
  if not (public.is_titolare() or v.creato_da = (select auth.uid())) then
    raise exception 'Puoi generare solo i video che hai creato tu' using errcode = '42501';
  end if;
  if v.stato not in ('bozza', 'script_pronto', 'modifiche_richieste', 'errore') then
    raise exception 'Questo video è già in lavorazione o approvato' using errcode = '23514';
  end if;
  if length(trim(coalesce(v.script_intro, ''))) = 0 or length(trim(coalesce(v.script_chiusura, ''))) = 0 then
    raise exception 'Scrivi l''introduzione e la chiusura prima di generare il video' using errcode = '23514';
  end if;
  if cardinality(v.foto_selezionate) = 0 then
    raise exception 'Scegli almeno una foto dell''immobile' using errcode = '23514';
  end if;
  if exists (
    select 1 from unnest(v.foto_selezionate) f
    where not exists (select 1 from public.property_photos pp where pp.id = f and pp.property_id = v.property_id)
  ) then
    raise exception 'Alcune foto scelte non appartengono a questo immobile' using errcode = '23514';
  end if;

  avatar := v.avatar_profile_id;
  if avatar is null or not public.studio_avatar_ok(avatar) then
    select a.id into avatar from public.avatar_profiles a
    join public.profiles p on p.id = a.profile_id
    where a.agency_id = v.agency_id and a.stato = 'pronto' and a.consenso_firmato
    order by (p.ruolo = 'titolare') desc, a.created_at limit 1;
  end if;
  if avatar is null or not public.studio_avatar_ok(avatar) then
    raise exception 'Serve un avatar pronto con il consenso firmato: completalo in Studio → Impostazioni → Avatar' using errcode = '42501';
  end if;

  select a.piano into v_piano from public.agencies a where a.id = v.agency_id;
  select pl.generazioni_giorno into limite from public.plan_limits pl where pl.piano = v_piano;
  select count(*) into oggi from public.studio_jobs j
  where j.agency_id = v.agency_id and j.tipo in ('mock_video', 'video') and j.created_at > now() - interval '24 hours';
  if oggi >= coalesce(limite, 0) then
    raise exception 'Hai raggiunto il limite di % generazioni nelle ultime 24 ore. Riprova più tardi.', coalesce(limite, 0) using errcode = '23514';
  end if;
  -- Al massimo 3 video in preparazione per agenzia nello stesso momento
  if (select count(*) from public.video_projects where agency_id = v.agency_id and stato = 'in_generazione') >= 3 then
    raise exception 'Ci sono già 3 video in preparazione: aspetta che uno sia pronto.' using errcode = '23514';
  end if;

  update public.video_projects
  set stato = 'in_generazione', avatar_profile_id = avatar, errore_messaggio = null, video_url = null,
      thumbnail_url = null, generazione_avviata_at = now()
  where id = pid;

  insert into public.studio_jobs (agency_id, video_project_id, avatar_profile_id, tipo, stato, pronto_at)
  values (v.agency_id, pid, avatar, 'video', 'in_coda', now());
end $$;

-- ---------- Consenso: l'avatar va preparato dalla coda (non più a tempo) ----------
create or replace function public.studio_sign_consent(p_versione text, p_nome text, p_pdf_path text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  a public.avatar_profiles;
begin
  select * into a from public.avatar_profiles where profile_id = (select auth.uid());
  if a.id is null then raise exception 'Avatar non trovato: chiedi al titolare di abilitarti' using errcode = 'P0002'; end if;
  if a.stato not in ('in_attesa_consenso') then raise exception 'Il consenso è già stato firmato' using errcode = '23514'; end if;
  if not exists (select 1 from public.consent_templates where versione = p_versione and attivo) then
    raise exception 'Il testo del consenso è cambiato: ricarica la pagina e rileggilo' using errcode = '23514';
  end if;
  if length(trim(coalesce(p_nome, ''))) < 3 then raise exception 'Scrivi nome e cognome per firmare' using errcode = '23514'; end if;
  if a.training_video_url is null then raise exception 'Carica prima il video di training' using errcode = '23514'; end if;
  if split_part(p_pdf_path, '/', 1) <> a.agency_id::text or split_part(p_pdf_path, '/', 2) <> (select auth.uid())::text then
    raise exception 'Percorso del PDF non valido' using errcode = '42501';
  end if;
  update public.avatar_profiles
  set consenso_firmato = true, consenso_firmato_at = now(), consenso_versione = p_versione,
      consenso_firmatario = trim(p_nome), consenso_pdf_url = p_pdf_path,
      stato = 'in_addestramento', addestramento_pronto_at = null
  where id = a.id;
  -- Simulato: pronto dopo 20 secondi. Reale: resta in attesa finché l'avatar non è attivato su HeyGen.
  insert into public.studio_jobs (agency_id, avatar_profile_id, tipo, stato, pronto_at)
  values (a.agency_id, a.id, 'avatar_training', 'in_coda', now() + interval '20 seconds');
end $$;

-- ---------- Funzioni per la Edge Function (solo chiave di servizio) ----------

-- Prende in carico fino a p_limite lavori pronti (eventualmente di una sola agenzia)
create or replace function public.studio_claim_jobs(p_agency uuid, p_limite integer)
returns setof public.studio_jobs language plpgsql security definer set search_path = '' as $$
begin
  return query
  update public.studio_jobs j set bloccato_fino = now() + interval '3 minutes'
  where j.id in (
    select x.id from public.studio_jobs x
    where x.stato in ('in_coda', 'in_corso')
      and x.tipo in ('video', 'avatar_training', 'avatar_delete')
      and (x.pronto_at is null or x.pronto_at <= now())
      and (x.bloccato_fino is null or x.bloccato_fino < now())
      and (p_agency is null or x.agency_id = p_agency)
    order by x.pronto_at nulls first, x.created_at
    limit greatest(1, least(p_limite, 20))
    for update skip locked
  )
  returning j.*;
end $$;

-- Video pronto: salva il file, passa a "da approvare", conta l'utilizzo e avvisa chi approva
create or replace function public.studio_complete_video(p_job uuid, p_video_path text, p_thumbnail text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  j public.studio_jobs;
  v public.video_projects;
  p public.properties;
  v_mese text := to_char(now() at time zone 'Europe/Rome', 'YYYY-MM');
  v_inclusi integer;
  v_approvatore uuid;
begin
  select * into j from public.studio_jobs where id = p_job for update;
  if j.id is null or j.stato in ('completato', 'errore') then return; end if;
  update public.studio_jobs set stato = 'completato', bloccato_fino = null, errore = null where id = j.id;

  select * into v from public.video_projects where id = j.video_project_id for update;
  if v.id is null or v.stato <> 'in_generazione' then return; end if;
  -- Ultimo controllo: il consenso dell'avatar deve essere ancora valido
  if not public.studio_avatar_ok(v.avatar_profile_id) then
    update public.video_projects
    set stato = 'errore', errore_messaggio = 'Il consenso dell''avatar non è più valido: il video non può essere usato.'
    where id = v.id;
    return;
  end if;

  update public.video_projects set stato = 'da_approvare', video_url = p_video_path, thumbnail_url = p_thumbnail where id = v.id;

  select coalesce(pl.video_mese_inclusi, 0) into v_inclusi
  from public.agencies a left join public.plan_limits pl on pl.piano = a.piano where a.id = v.agency_id;
  insert into public.studio_usage as u (agency_id, mese, video_generati, video_inclusi, video_extra)
  values (v.agency_id, v_mese, 1, v_inclusi, greatest(0, 1 - v_inclusi))
  on conflict (agency_id, mese) do update
    set video_generati = u.video_generati + 1,
        video_inclusi = excluded.video_inclusi,
        video_extra = greatest(0, u.video_generati + 1 - excluded.video_inclusi);

  select * into p from public.properties where id = v.property_id;
  select b.approvatore_id into v_approvatore from public.brand_settings b where b.agency_id = v.agency_id;
  insert into public.tasks (agency_id, assegnato_a, property_id, titolo, scadenza, origine)
  select v.agency_id, pr.id, v.property_id, format('Approva il video di %s', p.indirizzo),
         (now() at time zone 'Europe/Rome')::date, 'automatica'
  from public.profiles pr
  where pr.agency_id = v.agency_id and pr.attivo
    and (pr.id = v_approvatore or (v_approvatore is null and pr.ruolo = 'titolare'));
end $$;

-- Errore di un lavoro: riprova (al massimo 3 tentativi, con attesa crescente) oppure chiude con un messaggio chiaro
create or replace function public.studio_job_fail(
  p_job uuid, p_messaggio text, p_tecnico text, p_riprova boolean, p_payload jsonb
) returns void language plpgsql security definer set search_path = '' as $$
declare
  j public.studio_jobs;
begin
  select * into j from public.studio_jobs where id = p_job for update;
  if j.id is null or j.stato in ('completato', 'errore') then return; end if;
  if p_riprova and j.tentativi + 1 < 3 then
    update public.studio_jobs
    set stato = 'in_coda', tentativi = j.tentativi + 1, errore = p_messaggio, errore_tecnico = left(p_tecnico, 2000),
        payload = coalesce(p_payload, j.payload), bloccato_fino = null,
        pronto_at = now() + make_interval(mins => 2 * (j.tentativi + 1))
    where id = j.id;
  else
    update public.studio_jobs
    set stato = 'errore', tentativi = j.tentativi + 1, errore = p_messaggio, errore_tecnico = left(p_tecnico, 2000),
        payload = coalesce(p_payload, j.payload), bloccato_fino = null
    where id = j.id;
    if j.tipo = 'video' then
      update public.video_projects set stato = 'errore', errore_messaggio = p_messaggio
      where id = j.video_project_id and stato = 'in_generazione';
    end if;
  end if;
end $$;

-- Avatar pronto (in modalità simulata lo chiama la coda, in modalità reale l'attivazione dall'admin)
create or replace function public.studio_avatar_ready(p_avatar uuid, p_provider_avatar text, p_provider_voice text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.avatar_profiles
  set stato = 'pronto',
      provider_avatar_id = coalesce(nullif(trim(p_provider_avatar), ''), provider_avatar_id),
      provider_voice_id = coalesce(nullif(trim(p_provider_voice), ''), provider_voice_id),
      addestramento_pronto_at = now()
  where id = p_avatar and stato = 'in_addestramento' and consenso_firmato;
  if not found then raise exception 'Avatar non in preparazione o consenso non valido' using errcode = '23514'; end if;
  update public.studio_jobs set stato = 'completato', bloccato_fino = null
  where avatar_profile_id = p_avatar and tipo = 'avatar_training' and stato in ('in_coda', 'in_corso');
end $$;

-- Segreti interni (cron e webhook) letti dal Vault
create or replace function public.studio_secret(p_name text)
returns text language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_name and p_name in ('studio_cron_secret', 'studio_webhook_secret')
$$;

revoke execute on function public.studio_claim_jobs(uuid, integer) from public, anon, authenticated;
revoke execute on function public.studio_complete_video(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.studio_job_fail(uuid, text, text, boolean, jsonb) from public, anon, authenticated;
revoke execute on function public.studio_avatar_ready(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.studio_secret(text) from public, anon, authenticated;
grant execute on function public.studio_claim_jobs(uuid, integer), public.studio_complete_video(uuid, text, text),
  public.studio_job_fail(uuid, text, text, boolean, jsonb), public.studio_avatar_ready(uuid, text, text),
  public.studio_secret(text), public.studio_avatar_ok(uuid) to service_role;

-- ---------- Pannello admin: attivazione avatar, cancellazioni e lavori in errore ----------
create or replace function public.admin_studio_overview()
returns table (
  tipo text, job_id uuid, avatar_id uuid, agenzia text, persona text, stato text,
  errore text, errore_tecnico text, training_video_url text, provider_avatar_id text, created_at timestamptz
) language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'Riservato agli amministratori' using errcode = '42501'; end if;
  return query
  -- Avatar da attivare su HeyGen
  select 'attivazione'::text, null::uuid, a.id, ag.nome, trim(p.nome || ' ' || p.cognome), a.stato::text,
         null::text, null::text, a.training_video_url, a.provider_avatar_id, a.consenso_firmato_at
  from public.avatar_profiles a
  join public.agencies ag on ag.id = a.agency_id
  join public.profiles p on p.id = a.profile_id
  where a.stato = 'in_addestramento'
  union all
  -- Avatar revocati da cancellare presso il fornitore
  select 'cancellazione', j.id, j.avatar_profile_id, ag.nome, trim(coalesce(p.nome, '') || ' ' || coalesce(p.cognome, '')), j.stato,
         j.errore, j.errore_tecnico, null, j.payload ->> 'provider_avatar_id', j.created_at
  from public.studio_jobs j
  join public.agencies ag on ag.id = j.agency_id
  left join public.avatar_profiles a on a.id = j.avatar_profile_id
  left join public.profiles p on p.id = a.profile_id
  where j.tipo = 'avatar_delete' and j.stato in ('in_coda', 'in_corso', 'errore')
  union all
  -- Video non riusciti negli ultimi 14 giorni
  select 'errore_video', j.id, j.avatar_profile_id, ag.nome, pr.indirizzo, j.stato,
         j.errore, j.errore_tecnico, null, null, j.updated_at
  from public.studio_jobs j
  join public.agencies ag on ag.id = j.agency_id
  left join public.video_projects v on v.id = j.video_project_id
  left join public.properties pr on pr.id = v.property_id
  where j.tipo = 'video' and j.stato = 'errore' and j.updated_at > now() - interval '14 days'
  order by 11 desc;
end $$;

create or replace function public.admin_studio_activate_avatar(p_avatar uuid, p_provider_avatar text, p_provider_voice text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'Riservato agli amministratori' using errcode = '42501'; end if;
  if length(trim(coalesce(p_provider_avatar, ''))) = 0 or length(trim(coalesce(p_provider_voice, ''))) = 0 then
    raise exception 'Inserisci sia l''ID avatar sia l''ID voce di HeyGen' using errcode = '23514';
  end if;
  perform public.studio_avatar_ready(p_avatar, p_provider_avatar, p_provider_voice);
end $$;

create or replace function public.admin_studio_avatar_deleted(p_job uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'Riservato agli amministratori' using errcode = '42501'; end if;
  update public.studio_jobs set stato = 'completato', errore = null, bloccato_fino = null
  where id = p_job and tipo = 'avatar_delete';
  update public.avatar_profiles a set provider_avatar_id = null, provider_voice_id = null
  from public.studio_jobs j where j.id = p_job and a.id = j.avatar_profile_id and a.stato = 'revocato';
end $$;

revoke execute on function public.admin_studio_overview() from public, anon;
revoke execute on function public.admin_studio_activate_avatar(uuid, text, text) from public, anon;
revoke execute on function public.admin_studio_avatar_deleted(uuid) from public, anon;
grant execute on function public.admin_studio_overview(), public.admin_studio_activate_avatar(uuid, text, text),
  public.admin_studio_avatar_deleted(uuid) to authenticated;

-- ---------- Segreti nel Vault e lavoro pianificato ogni minuto ----------
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'studio_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'studio_cron_secret', 'Studio: chiamate di pg_cron a studio-lavori');
  end if;
  if not exists (select 1 from vault.secrets where name = 'studio_webhook_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'studio_webhook_secret', 'Studio: firma degli URL dei webhook');
  end if;
end $$;

select cron.schedule(
  'studio-lavori',
  '* * * * *',
  $cron$
  select net.http_post(
    url := 'https://bwpgpsrcddlngpskyajr.supabase.co/functions/v1/studio-lavori',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-studio-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'studio_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  ) where exists (
    select 1 from public.studio_jobs
    where stato in ('in_coda', 'in_corso') and tipo in ('video', 'avatar_training', 'avatar_delete')
      and (pronto_at is null or pronto_at <= now())
  );
  $cron$
);
