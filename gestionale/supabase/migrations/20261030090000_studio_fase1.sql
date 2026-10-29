-- =====================================================================
-- STUDIO – Fase 1
-- Video social degli immobili con l'avatar AI del titolare.
-- Regola: il video usa SOLO le foto reali dell'immobile (movimenti di camera);
-- l'unico elemento generato è l'avatar.
-- In questa fase la generazione è simulata (job "mock"); la Fase 2 la sostituisce
-- con HeyGen + servizio di rendering, la Fase 3 aggiunge la pubblicazione sui social.
-- =====================================================================

-- ---------- Tipi ----------
create type public.stato_avatar as enum ('in_attesa_consenso', 'in_addestramento', 'pronto', 'revocato');
create type public.tono_brand as enum ('professionale', 'amichevole', 'ironico');
create type public.piattaforma_social as enum ('instagram', 'facebook', 'tiktok');
create type public.stato_social as enum ('collegato', 'scaduto', 'errore');
create type public.stato_video as enum (
  'bozza', 'script_pronto', 'in_generazione', 'da_approvare', 'modifiche_richieste',
  'approvato', 'programmato', 'pubblicato', 'errore', 'scartato'
);
create type public.esito_approvazione as enum ('approvato', 'modifiche', 'scartato');
create type public.stato_post as enum ('in_coda', 'pubblicato', 'fallito');

-- ---------- Limiti per piano (modificabili senza toccare il codice) ----------
create table public.plan_limits (
  piano public.piano_agenzia primary key,
  video_mese_inclusi integer not null check (video_mese_inclusi >= 0),
  generazioni_giorno integer not null check (generazioni_giorno >= 0)
);
insert into public.plan_limits (piano, video_mese_inclusi, generazioni_giorno) values
  ('start', 2, 3), ('pro', 8, 10), ('elite', 20, 25);

-- ---------- Testi del consenso (il testo lo inserisce Nexora dopo la revisione legale) ----------
create table public.consent_templates (
  id uuid primary key default gen_random_uuid(),
  versione text not null unique,
  testo text not null,
  attivo boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index consent_templates_un_attivo on public.consent_templates (attivo) where attivo;

-- ---------- Avatar ----------
create table public.avatar_profiles (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.get_my_agency_id() references public.agencies (id) on delete cascade,
  profile_id uuid not null unique,
  provider text not null default 'heygen' check (provider in ('heygen')),
  provider_avatar_id text,
  provider_voice_id text,
  stato public.stato_avatar not null default 'in_attesa_consenso',
  consenso_firmato boolean not null default false,
  consenso_firmato_at timestamptz,
  consenso_pdf_url text,
  consenso_versione text,
  consenso_firmatario text,
  training_video_url text,
  addestramento_pronto_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, agency_id),
  foreign key (profile_id, agency_id) references public.profiles (id, agency_id) on delete cascade
);

-- ---------- Brand (una riga per agenzia) ----------
create table public.brand_settings (
  agency_id uuid primary key references public.agencies (id) on delete cascade,
  tono public.tono_brand not null default 'professionale',
  frase_chiusura text,
  colore_accento text not null default '#C4532F' check (colore_accento ~ '^#[0-9A-Fa-f]{6}$'),
  logo_url text,
  hashtag_fissi text[] not null default '{}',
  dicitura_ai text not null default 'Video realizzato con l''AI. Immobile mostrato con foto reali.',
  orari_preferiti jsonb not null default
    '{"lun":["12:30","19:00"],"mar":["12:30","19:00"],"mer":["12:30","19:00"],"gio":["12:30","19:00"],"ven":["12:30","19:00"],"sab":["10:30"],"dom":[]}',
  approvatore_id uuid,
  piattaforme_predefinite public.piattaforma_social[] not null default '{instagram,facebook}',
  updated_at timestamptz not null default now(),
  foreign key (approvatore_id, agency_id) references public.profiles (id, agency_id) on delete set null (approvatore_id)
);
insert into public.brand_settings (agency_id) select id from public.agencies on conflict do nothing;

create or replace function public.studio_brand_for_new_agency()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.brand_settings (agency_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger agencies_brand after insert on public.agencies
  for each row execute function public.studio_brand_for_new_agency();

-- ---------- Account social (i token stanno in Supabase Vault, mai qui: Fase 3) ----------
create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  piattaforma public.piattaforma_social not null,
  nome_account text not null,
  stato public.stato_social not null default 'collegato',
  provider_account_id text,
  connected_at timestamptz not null default now(),
  scade_at timestamptz,
  unique (id, agency_id),
  unique (agency_id, piattaforma, provider_account_id)
);

-- ---------- Progetti video ----------
create table public.video_projects (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.get_my_agency_id() references public.agencies (id) on delete cascade,
  property_id uuid not null,
  creato_da uuid default auth.uid(),
  avatar_profile_id uuid,
  formato text not null default 'reel_9_16' check (formato = 'reel_9_16'),
  durata_target integer not null default 45 check (durata_target in (30, 45, 60)),
  foto_selezionate uuid[] not null default '{}',
  script_intro text,
  script_chiusura text,
  caption text,
  hashtag text[] not null default '{}',
  stato public.stato_video not null default 'bozza',
  video_url text,
  thumbnail_url text,
  costo_stimato numeric(10, 2),
  errore_messaggio text,
  generazione_avviata_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, agency_id),
  foreign key (property_id, agency_id) references public.properties (id, agency_id) on delete cascade,
  foreign key (creato_da, agency_id) references public.profiles (id, agency_id) on delete set null (creato_da),
  foreign key (avatar_profile_id, agency_id) references public.avatar_profiles (id, agency_id) on delete set null (avatar_profile_id)
);

-- ---------- Approvazioni (una riga per decisione; le righe con esito nullo sono link in attesa) ----------
create table public.video_approvals (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  video_project_id uuid not null,
  approvatore_id uuid,
  esito public.esito_approvazione,
  nota text,
  -- Impronta SHA-256 del token: il token in chiaro esiste solo nel link inviato
  token_link text unique,
  token_scade_at timestamptz,
  token_usato_at timestamptz,
  via text not null default 'app' check (via in ('app', 'whatsapp')),
  created_at timestamptz not null default now(),
  foreign key (video_project_id, agency_id) references public.video_projects (id, agency_id) on delete cascade,
  foreign key (approvatore_id, agency_id) references public.profiles (id, agency_id) on delete set null (approvatore_id)
);

-- ---------- Post programmati ----------
create table public.scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  video_project_id uuid not null,
  social_account_id uuid,
  piattaforma public.piattaforma_social not null,
  caption text not null,
  pubblica_alle timestamptz not null,
  stato public.stato_post not null default 'in_coda',
  provider_post_id text,
  url_post text,
  tentativi integer not null default 0,
  errore text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (video_project_id, agency_id) references public.video_projects (id, agency_id) on delete cascade,
  foreign key (social_account_id, agency_id) references public.social_accounts (id, agency_id) on delete set null (social_account_id)
);

-- ---------- Utilizzo mensile ----------
create table public.studio_usage (
  agency_id uuid not null references public.agencies (id) on delete cascade,
  mese text not null check (mese ~ '^\d{4}-\d{2}$'),
  video_generati integer not null default 0,
  video_inclusi integer not null default 0,
  video_extra integer not null default 0,
  primary key (agency_id, mese)
);

-- ---------- Lavori di generazione (coda; usata anche per il limite giornaliero) ----------
create table public.studio_jobs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  video_project_id uuid,
  avatar_profile_id uuid,
  tipo text not null check (tipo in ('mock_video', 'mock_avatar', 'video', 'avatar_training', 'avatar_delete')),
  stato text not null default 'in_coda' check (stato in ('in_coda', 'in_corso', 'completato', 'errore')),
  pronto_at timestamptz,
  provider_job_id text,
  payload jsonb not null default '{}',
  tentativi integer not null default 0,
  errore text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Indici ----------
create index on public.avatar_profiles (agency_id);
create index on public.social_accounts (agency_id, piattaforma);
create index on public.video_projects (agency_id, stato);
create index on public.video_projects (property_id, agency_id);
create index on public.video_projects (creato_da, agency_id);
create index on public.video_projects (avatar_profile_id, agency_id);
create index on public.video_approvals (video_project_id, agency_id);
create index on public.video_approvals (approvatore_id, agency_id);
create index on public.scheduled_posts (agency_id, pubblica_alle);
create index on public.scheduled_posts (stato, pubblica_alle);
create index on public.scheduled_posts (video_project_id, agency_id);
create index on public.scheduled_posts (social_account_id, agency_id);
create index on public.studio_jobs (agency_id, created_at desc);
create index on public.studio_jobs (stato, pronto_at);
create index on public.brand_settings (approvatore_id, agency_id);

create trigger avatar_profiles_updated_at before update on public.avatar_profiles for each row execute function public.set_updated_at();
create trigger video_projects_updated_at before update on public.video_projects for each row execute function public.set_updated_at();
create trigger scheduled_posts_updated_at before update on public.scheduled_posts for each row execute function public.set_updated_at();
create trigger brand_settings_updated_at before update on public.brand_settings for each row execute function public.set_updated_at();
create trigger studio_jobs_updated_at before update on public.studio_jobs for each row execute function public.set_updated_at();

-- ---------- Chi approva: il titolare o l'approvatore scelto nel brand ----------
create or replace function public.studio_is_approver()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_titolare() or exists (
    select 1 from public.brand_settings b
    where b.agency_id = public.get_my_agency_id() and b.approvatore_id = (select auth.uid())
  )
$$;

-- ---------- Row Level Security ----------
alter table public.plan_limits enable row level security;
alter table public.consent_templates enable row level security;
alter table public.avatar_profiles enable row level security;
alter table public.brand_settings enable row level security;
alter table public.social_accounts enable row level security;
alter table public.video_projects enable row level security;
alter table public.video_approvals enable row level security;
alter table public.scheduled_posts enable row level security;
alter table public.studio_usage enable row level security;
alter table public.studio_jobs enable row level security;

create policy "limiti: lettura" on public.plan_limits for select to authenticated using (true);
create policy "consenso: lettura testo attivo" on public.consent_templates for select to authenticated using (attivo);

create policy "avatar: lettura agenzia" on public.avatar_profiles
  for select to authenticated using (agency_id = (select public.get_my_agency_id()));

create policy "brand: lettura agenzia" on public.brand_settings
  for select to authenticated using (agency_id = (select public.get_my_agency_id()));
create policy "brand: modifica titolare" on public.brand_settings
  for update to authenticated
  using (agency_id = (select public.get_my_agency_id()) and (select public.is_titolare()))
  with check (agency_id = (select public.get_my_agency_id()));

create policy "social: lettura agenzia" on public.social_accounts
  for select to authenticated using (agency_id = (select public.get_my_agency_id()));

create policy "video: lettura agenzia" on public.video_projects
  for select to authenticated using (agency_id = (select public.get_my_agency_id()));
create policy "video: creazione" on public.video_projects
  for insert to authenticated
  with check (agency_id = (select public.get_my_agency_id()) and creato_da = (select auth.uid()) and stato in ('bozza', 'script_pronto'));
-- Testi e foto si modificano solo finché il video non è in lavorazione o approvato
create policy "video: modifica bozza" on public.video_projects
  for update to authenticated
  using (agency_id = (select public.get_my_agency_id())
    and ((select public.is_titolare()) or creato_da = (select auth.uid()))
    and stato in ('bozza', 'script_pronto', 'modifiche_richieste', 'errore'))
  with check (agency_id = (select public.get_my_agency_id()));
create policy "video: eliminazione bozza" on public.video_projects
  for delete to authenticated
  using (agency_id = (select public.get_my_agency_id())
    and ((select public.is_titolare()) or creato_da = (select auth.uid()))
    and stato in ('bozza', 'script_pronto'));

create policy "approvazioni: lettura agenzia" on public.video_approvals
  for select to authenticated using (agency_id = (select public.get_my_agency_id()));
create policy "post: lettura agenzia" on public.scheduled_posts
  for select to authenticated using (agency_id = (select public.get_my_agency_id()));
create policy "utilizzo: lettura agenzia" on public.studio_usage
  for select to authenticated using (agency_id = (select public.get_my_agency_id()));
create policy "lavori: lettura agenzia" on public.studio_jobs
  for select to authenticated using (agency_id = (select public.get_my_agency_id()));

-- Permessi sulle colonne: stati, token, approvazioni e post si cambiano solo con le funzioni qui sotto
revoke all on public.plan_limits, public.consent_templates, public.avatar_profiles, public.brand_settings,
  public.social_accounts, public.video_projects, public.video_approvals, public.scheduled_posts,
  public.studio_usage, public.studio_jobs from anon;
revoke insert, update, delete on public.plan_limits, public.consent_templates, public.avatar_profiles,
  public.social_accounts, public.video_approvals, public.scheduled_posts, public.studio_usage, public.studio_jobs from authenticated;
revoke insert, delete, update on public.brand_settings from authenticated;
grant update (tono, frase_chiusura, colore_accento, logo_url, hashtag_fissi, dicitura_ai, orari_preferiti, approvatore_id, piattaforme_predefinite)
  on public.brand_settings to authenticated;
revoke update on public.video_projects from authenticated;
grant update (durata_target, foto_selezionate, script_intro, script_chiusura, caption, hashtag, avatar_profile_id)
  on public.video_projects to authenticated;

-- Quando ci sono intro e chiusura, la bozza diventa "script pronto"
create or replace function public.studio_script_state()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.stato = 'bozza'
     and length(trim(coalesce(new.script_intro, ''))) > 0
     and length(trim(coalesce(new.script_chiusura, ''))) > 0 then
    new.stato := 'script_pronto';
  end if;
  return new;
end $$;
create trigger video_projects_script_state before insert or update on public.video_projects
  for each row execute function public.studio_script_state();

-- ---------- Storage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('studio-videos', 'studio-videos', false, 524288000, array['video/mp4', 'image/jpeg', 'image/png', 'image/webp']),
  ('studio-training', 'studio-training', false, 52428800, array['video/mp4', 'video/quicktime', 'video/webm']),
  ('studio-consensi', 'studio-consensi', false, 5242880, array['application/pdf']);

-- studio-videos/{agency_id}/…: video e anteprime, scritti solo dalle edge functions
create policy "studio video: lettura agenzia" on storage.objects
  for select to authenticated
  using (bucket_id = 'studio-videos' and (storage.foldername(name))[1] = (select public.get_my_agency_id())::text);
-- studio-training/{agency_id}/{profile_id}/…: il video di training lo carica la persona stessa
create policy "studio training: caricamento personale" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'studio-training'
    and (storage.foldername(name))[1] = (select public.get_my_agency_id())::text
    and (storage.foldername(name))[2] = (select auth.uid())::text);
create policy "studio training: lettura personale o titolare" on storage.objects
  for select to authenticated
  using (bucket_id = 'studio-training'
    and (storage.foldername(name))[1] = (select public.get_my_agency_id())::text
    and ((storage.foldername(name))[2] = (select auth.uid())::text or (select public.is_titolare())));
create policy "studio training: sostituzione personale" on storage.objects
  for update to authenticated
  using (bucket_id = 'studio-training'
    and (storage.foldername(name))[1] = (select public.get_my_agency_id())::text
    and (storage.foldername(name))[2] = (select auth.uid())::text);
-- studio-consensi/{agency_id}/{profile_id}/…: il PDF firmato
create policy "studio consensi: caricamento personale" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'studio-consensi'
    and (storage.foldername(name))[1] = (select public.get_my_agency_id())::text
    and (storage.foldername(name))[2] = (select auth.uid())::text);
create policy "studio consensi: lettura personale o titolare" on storage.objects
  for select to authenticated
  using (bucket_id = 'studio-consensi'
    and (storage.foldername(name))[1] = (select public.get_my_agency_id())::text
    and ((storage.foldername(name))[2] = (select auth.uid())::text or (select public.is_titolare())));

-- =====================================================================
-- Funzioni
-- =====================================================================

-- Avatar utilizzabile: consenso firmato, addestramento completato, non revocato
create or replace function public.studio_avatar_ok(aid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.avatar_profiles a
    where a.id = aid and a.stato = 'pronto' and a.consenso_firmato and a.consenso_firmato_at is not null
  )
$$;

-- Primo orario libero tra gli orari preferiti dell'agenzia (prossimi 14 giorni, ora italiana)
create or replace function public.studio_next_slot(p_agency uuid)
returns timestamptz language plpgsql stable security definer set search_path = '' as $$
declare
  orari jsonb;
  giorni text[] := array['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
  oggi date := (now() at time zone 'Europe/Rome')::date;
  d date;
  t text;
  candidato timestamptz;
begin
  select orari_preferiti into orari from public.brand_settings where agency_id = p_agency;
  for i in 0..13 loop
    d := oggi + i;
    for t in select jsonb_array_elements_text(coalesce(orari -> giorni[extract(dow from d)::int + 1], '[]'::jsonb)) order by 1 loop
      candidato := (d + t::time) at time zone 'Europe/Rome';
      if candidato > now() + interval '15 minutes' and not exists (
        select 1 from public.scheduled_posts sp
        where sp.agency_id = p_agency and sp.pubblica_alle = candidato and sp.stato <> 'fallito'
      ) then
        return candidato;
      end if;
    end loop;
  end loop;
  return ((oggi + 1) + time '12:30') at time zone 'Europe/Rome';
end $$;

create or replace function public.studio_proposed_slot()
returns timestamptz language sql stable security definer set search_path = '' as $$
  select public.studio_next_slot(public.get_my_agency_id())
$$;

-- Avvio della generazione: controlli lato server su permessi, consenso, testi e limite giornaliero
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
  -- Le foto devono essere davvero di questo immobile
  if exists (
    select 1 from unnest(v.foto_selezionate) f
    where not exists (select 1 from public.property_photos pp where pp.id = f and pp.property_id = v.property_id)
  ) then
    raise exception 'Alcune foto scelte non appartengono a questo immobile' using errcode = '23514';
  end if;

  -- Avatar con consenso valido (blocco lato server, non solo nell'interfaccia)
  avatar := v.avatar_profile_id;
  if avatar is null then
    select a.id into avatar from public.avatar_profiles a
    join public.profiles p on p.id = a.profile_id
    where a.agency_id = v.agency_id and a.stato = 'pronto' and a.consenso_firmato
    order by (p.ruolo = 'titolare') desc, a.created_at limit 1;
  end if;
  if avatar is null or not public.studio_avatar_ok(avatar) then
    raise exception 'Serve un avatar pronto con il consenso firmato: completalo in Studio → Impostazioni → Avatar' using errcode = '42501';
  end if;

  -- Limite di generazioni nelle ultime 24 ore, in base al piano
  select a.piano into v_piano from public.agencies a where a.id = v.agency_id;
  select pl.generazioni_giorno into limite from public.plan_limits pl where pl.piano = v_piano;
  select count(*) into oggi from public.studio_jobs j
  where j.agency_id = v.agency_id and j.tipo in ('mock_video', 'video') and j.created_at > now() - interval '24 hours';
  if oggi >= coalesce(limite, 0) then
    raise exception 'Hai raggiunto il limite di % generazioni nelle ultime 24 ore. Riprova più tardi.', coalesce(limite, 0) using errcode = '23514';
  end if;

  update public.video_projects
  set stato = 'in_generazione', avatar_profile_id = avatar, errore_messaggio = null, video_url = null,
      thumbnail_url = null, generazione_avviata_at = now()
  where id = pid;

  -- Fase 1: lavoro simulato che si completa da solo dopo qualche secondo
  insert into public.studio_jobs (agency_id, video_project_id, avatar_profile_id, tipo, stato, pronto_at)
  values (v.agency_id, pid, avatar, 'mock_video', 'in_corso', now() + interval '12 seconds');
end $$;

-- Fase 1: completa i lavori simulati scaduti (la Fase 2 lo sostituisce con i webhook)
create or replace function public.studio_tick()
returns void language plpgsql security definer set search_path = '' as $$
declare
  ag uuid := public.get_my_agency_id();
  j record;
  v public.video_projects;
  p public.properties;
  v_mese text := to_char(now() at time zone 'Europe/Rome', 'YYYY-MM');
  v_inclusi integer;
  v_approvatore uuid;
begin
  if ag is null then return; end if;

  update public.avatar_profiles
  set stato = 'pronto'
  where agency_id = ag and stato = 'in_addestramento' and consenso_firmato and addestramento_pronto_at <= now();
  update public.studio_jobs set stato = 'completato'
  where agency_id = ag and tipo = 'mock_avatar' and stato = 'in_corso' and pronto_at <= now();

  for j in
    select * from public.studio_jobs
    where agency_id = ag and tipo = 'mock_video' and stato = 'in_corso' and pronto_at <= now()
    for update skip locked
  loop
    update public.studio_jobs set stato = 'completato' where id = j.id;
    select * into v from public.video_projects where id = j.video_project_id;
    if v.id is null or v.stato <> 'in_generazione' then continue; end if;

    update public.video_projects
    set stato = 'da_approvare', video_url = 'mock:reel', thumbnail_url = null
    where id = v.id;

    select coalesce(pl.video_mese_inclusi, 0) into v_inclusi
    from public.agencies a left join public.plan_limits pl on pl.piano = a.piano where a.id = ag;
    insert into public.studio_usage as u (agency_id, mese, video_generati, video_inclusi, video_extra)
    values (ag, v_mese, 1, v_inclusi, greatest(0, 1 - v_inclusi))
    on conflict (agency_id, mese) do update
      set video_generati = u.video_generati + 1,
          video_inclusi = excluded.video_inclusi,
          video_extra = greatest(0, u.video_generati + 1 - excluded.video_inclusi);

    -- Promemoria a chi approva (in app; il messaggio WhatsApp con il link parte dalla pagina del video)
    select * into p from public.properties where id = v.property_id;
    select b.approvatore_id into v_approvatore from public.brand_settings b where b.agency_id = ag;
    insert into public.tasks (agency_id, assegnato_a, property_id, titolo, scadenza, origine)
    select ag, pr.id, v.property_id, format('Approva il video di %s', p.indirizzo),
           (now() at time zone 'Europe/Rome')::date, 'automatica'
    from public.profiles pr
    where pr.agency_id = ag and pr.attivo
      and (pr.id = v_approvatore or (v_approvatore is null and pr.ruolo = 'titolare'));
  end loop;
end $$;

-- Link di approvazione monouso (7 giorni). Restituisce il token in chiaro una sola volta;
-- nel database resta solo la sua impronta SHA-256.
create or replace function public.studio_approval_link(pid uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v public.video_projects;
  raw text := encode(extensions.gen_random_bytes(24), 'hex');
  approvatore uuid;
begin
  select * into v from public.video_projects where id = pid and agency_id = public.get_my_agency_id();
  if not found then raise exception 'Video non trovato' using errcode = 'P0002'; end if;
  if v.stato <> 'da_approvare' then raise exception 'Il video non è in attesa di approvazione' using errcode = '23514'; end if;
  if not (public.studio_is_approver() or v.creato_da = (select auth.uid())) then
    raise exception 'Non puoi inviare questo video in approvazione' using errcode = '42501';
  end if;
  select b.approvatore_id into approvatore from public.brand_settings b where b.agency_id = v.agency_id;
  if approvatore is null then
    select p.id into approvatore from public.profiles p
    where p.agency_id = v.agency_id and p.ruolo = 'titolare' and p.attivo order by p.created_at limit 1;
  end if;
  -- Un solo link valido per volta: i precedenti non usati scadono
  update public.video_approvals set token_scade_at = now()
  where video_project_id = pid and esito is null and token_usato_at is null and token_scade_at > now();
  insert into public.video_approvals (agency_id, video_project_id, approvatore_id, token_link, token_scade_at, via)
  values (v.agency_id, pid, approvatore, encode(extensions.digest(raw, 'sha256'), 'hex'), now() + interval '7 days', 'whatsapp');
  return raw;
end $$;

-- Applica una decisione (interna: la chiamano studio_decide e studio_decide_by_token)
create or replace function public.studio_apply_decision(
  pid uuid, p_approvatore uuid, p_esito public.esito_approvazione, p_nota text,
  p_pubblica_alle timestamptz, p_piattaforme public.piattaforma_social[], p_via text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.video_projects;
  p public.properties;
  b public.brand_settings;
  testo text;
  pl public.piattaforma_social;
begin
  select * into v from public.video_projects where id = pid for update;
  if v.id is null or v.stato <> 'da_approvare' then
    raise exception 'Il video non è più in attesa di approvazione' using errcode = '23514';
  end if;
  select * into p from public.properties where id = v.property_id;
  select * into b from public.brand_settings where agency_id = v.agency_id;

  insert into public.video_approvals (agency_id, video_project_id, approvatore_id, esito, nota, via)
  values (v.agency_id, pid, p_approvatore, p_esito, nullif(trim(coalesce(p_nota, '')), ''), p_via);

  insert into public.activities (agency_id, utente_id, property_id, tipo, descrizione)
  values (v.agency_id, p_approvatore, v.property_id, 'nota',
          case p_esito
            when 'approvato' then format('Video social approvato: %s', p.indirizzo)
            when 'modifiche' then format('Chieste modifiche al video di %s%s', p.indirizzo, coalesce(': ' || nullif(trim(p_nota), ''), ''))
            else format('Video social scartato: %s', p.indirizzo)
          end);

  -- Le "cose da fare" di approvazione di questo immobile sono chiuse
  update public.tasks set completato = true
  where agency_id = v.agency_id and property_id = v.property_id and titolo like 'Approva il video di%' and not completato;

  if p_esito = 'approvato' then
    if p_pubblica_alle is not null and cardinality(coalesce(p_piattaforme, '{}')) > 0 then
      if p_pubblica_alle < now() then
        raise exception 'Scegli una data di pubblicazione futura' using errcode = '23514';
      end if;
      -- La caption finisce sempre con la dicitura sull'AI
      testo := trim(both e'\n' from concat_ws(e'\n\n',
        nullif(trim(coalesce(v.caption, '')), ''),
        nullif(array_to_string(array(select distinct h from unnest(v.hashtag || b.hashtag_fissi) h where h <> ''), ' '), ''),
        b.dicitura_ai));
      foreach pl in array p_piattaforme loop
        insert into public.scheduled_posts (agency_id, video_project_id, social_account_id, piattaforma, caption, pubblica_alle)
        values (v.agency_id, pid,
                (select s.id from public.social_accounts s where s.agency_id = v.agency_id and s.piattaforma = pl and s.stato = 'collegato' order by s.connected_at desc limit 1),
                pl, testo, p_pubblica_alle);
      end loop;
      update public.video_projects set stato = 'programmato' where id = pid;
    else
      update public.video_projects set stato = 'approvato' where id = pid;
    end if;
  elsif p_esito = 'modifiche' then
    update public.video_projects set stato = 'modifiche_richieste' where id = pid;
    if v.creato_da is not null then
      insert into public.tasks (agency_id, assegnato_a, property_id, titolo, scadenza, origine)
      values (v.agency_id, v.creato_da, v.property_id,
              left(format('Modifica il video di %s%s', p.indirizzo, coalesce(': ' || nullif(trim(p_nota), ''), '')), 300),
              (now() at time zone 'Europe/Rome')::date, 'automatica');
    end if;
  else
    update public.video_projects set stato = 'scartato' where id = pid;
  end if;
end $$;

-- Decisione dall'app: solo il titolare o l'approvatore scelto
create or replace function public.studio_decide(
  pid uuid, p_esito public.esito_approvazione, p_nota text,
  p_pubblica_alle timestamptz, p_piattaforme public.piattaforma_social[]
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.video_projects where id = pid and agency_id = public.get_my_agency_id()) then
    raise exception 'Video non trovato' using errcode = 'P0002';
  end if;
  if not public.studio_is_approver() then
    raise exception 'Solo il titolare o l''approvatore scelto può decidere sui video' using errcode = '42501';
  end if;
  if p_esito = 'modifiche' and length(trim(coalesce(p_nota, ''))) = 0 then
    raise exception 'Scrivi cosa cambiare' using errcode = '23514';
  end if;
  perform public.studio_apply_decision(pid, (select auth.uid()), p_esito, p_nota, p_pubblica_alle, p_piattaforme, 'app');
end $$;

-- Programmazione di un video già approvato (o nuova data dal calendario per i post in coda)
create or replace function public.studio_schedule(pid uuid, p_pubblica_alle timestamptz, p_piattaforme public.piattaforma_social[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.video_projects;
  b public.brand_settings;
  testo text;
  pl public.piattaforma_social;
begin
  select * into v from public.video_projects where id = pid and agency_id = public.get_my_agency_id() for update;
  if not found then raise exception 'Video non trovato' using errcode = 'P0002'; end if;
  if not public.studio_is_approver() then
    raise exception 'Solo il titolare o l''approvatore scelto può programmare i video' using errcode = '42501';
  end if;
  -- Nessuna programmazione senza un'approvazione registrata
  if not exists (select 1 from public.video_approvals a where a.video_project_id = pid and a.esito = 'approvato') then
    raise exception 'Il video deve essere approvato prima di essere programmato' using errcode = '42501';
  end if;
  if p_pubblica_alle is null or p_pubblica_alle < now() then
    raise exception 'Scegli una data di pubblicazione futura' using errcode = '23514';
  end if;
  if v.stato = 'approvato' then
    if cardinality(coalesce(p_piattaforme, '{}')) = 0 then
      raise exception 'Scegli almeno un social' using errcode = '23514';
    end if;
    select * into b from public.brand_settings where agency_id = v.agency_id;
    testo := trim(both e'\n' from concat_ws(e'\n\n',
      nullif(trim(coalesce(v.caption, '')), ''),
      nullif(array_to_string(array(select distinct h from unnest(v.hashtag || b.hashtag_fissi) h where h <> ''), ' '), ''),
      b.dicitura_ai));
    foreach pl in array p_piattaforme loop
      insert into public.scheduled_posts (agency_id, video_project_id, social_account_id, piattaforma, caption, pubblica_alle)
      values (v.agency_id, pid,
              (select s.id from public.social_accounts s where s.agency_id = v.agency_id and s.piattaforma = pl and s.stato = 'collegato' order by s.connected_at desc limit 1),
              pl, testo, p_pubblica_alle);
    end loop;
    update public.video_projects set stato = 'programmato' where id = pid;
  elsif v.stato = 'programmato' then
    -- Cambio data: solo i post non ancora pubblicati
    update public.scheduled_posts set pubblica_alle = p_pubblica_alle, tentativi = 0, errore = null
    where video_project_id = pid and stato = 'in_coda';
  else
    raise exception 'Questo video non si può programmare' using errcode = '23514';
  end if;
end $$;

-- ---------- Avatar e consenso ----------
-- Il titolare abilita una persona dell'agenzia come avatar
create or replace function public.studio_avatar_setup(p_profile uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  ag uuid := public.get_my_agency_id();
  aid uuid;
begin
  if not public.is_titolare() then raise exception 'Solo il titolare gestisce gli avatar' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = p_profile and agency_id = ag and attivo) then
    raise exception 'Persona non trovata' using errcode = 'P0002';
  end if;
  select id into aid from public.avatar_profiles where profile_id = p_profile;
  if aid is null then
    insert into public.avatar_profiles (agency_id, profile_id) values (ag, p_profile) returning id into aid;
  elsif exists (select 1 from public.avatar_profiles where id = aid and stato = 'revocato') then
    -- Dopo una revoca si ricomincia da capo
    update public.avatar_profiles
    set stato = 'in_attesa_consenso', consenso_firmato = false, consenso_firmato_at = null, consenso_pdf_url = null,
        consenso_versione = null, consenso_firmatario = null, training_video_url = null,
        provider_avatar_id = null, provider_voice_id = null, addestramento_pronto_at = null
    where id = aid;
  end if;
  return aid;
end $$;

-- La persona carica il suo video di training
create or replace function public.studio_avatar_training(p_path text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if split_part(p_path, '/', 1) <> public.get_my_agency_id()::text or split_part(p_path, '/', 2) <> (select auth.uid())::text then
    raise exception 'Percorso del video non valido' using errcode = '42501';
  end if;
  update public.avatar_profiles set training_video_url = p_path
  where profile_id = (select auth.uid()) and stato in ('in_attesa_consenso', 'in_addestramento');
  if not found then raise exception 'Avatar non trovato: chiedi al titolare di abilitarti' using errcode = 'P0002'; end if;
end $$;

-- Firma del consenso: solo la persona stessa, sul testo attivo
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
      stato = 'in_addestramento', addestramento_pronto_at = now() + interval '20 seconds'
  where id = a.id;
  -- Fase 1: addestramento simulato. La Fase 2 manda il video a HeyGen.
  insert into public.studio_jobs (agency_id, avatar_profile_id, tipo, stato, pronto_at)
  values (a.agency_id, a.id, 'mock_avatar', 'in_corso', now() + interval '20 seconds');
end $$;

-- Revoca: blocca subito l'avatar e i video in lavorazione; la cancellazione presso il provider va in coda
create or replace function public.studio_revoke_consent(p_avatar uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  a public.avatar_profiles;
begin
  select * into a from public.avatar_profiles where id = p_avatar and agency_id = public.get_my_agency_id();
  if a.id is null then raise exception 'Avatar non trovato' using errcode = 'P0002'; end if;
  if not (a.profile_id = (select auth.uid()) or public.is_titolare()) then
    raise exception 'Può revocare il consenso solo la persona interessata o il titolare' using errcode = '42501';
  end if;
  update public.avatar_profiles set stato = 'revocato', consenso_firmato = false, addestramento_pronto_at = null where id = a.id;
  update public.video_projects
  set stato = 'errore', errore_messaggio = 'Il consenso dell''avatar è stato revocato: il video non può essere generato.'
  where avatar_profile_id = a.id and stato = 'in_generazione';
  update public.studio_jobs set stato = 'errore', errore = 'Consenso revocato'
  where avatar_profile_id = a.id and stato in ('in_coda', 'in_corso');
  insert into public.studio_jobs (agency_id, avatar_profile_id, tipo, stato, payload)
  values (a.agency_id, a.id, 'avatar_delete', 'in_coda',
          jsonb_build_object('provider', a.provider, 'provider_avatar_id', a.provider_avatar_id, 'provider_voice_id', a.provider_voice_id));
end $$;

-- ---------- Approvazione dal link WhatsApp (senza login) ----------
-- Usate solo dalla Edge Function "studio-approvazione" con la chiave di servizio.
create or replace function public.studio_token_lookup(p_token text)
returns table (approval_id uuid, video_project_id uuid, agency_id uuid, approvatore_id uuid)
language sql stable security definer set search_path = '' as $$
  select a.id, a.video_project_id, a.agency_id, a.approvatore_id
  from public.video_approvals a
  join public.video_projects v on v.id = a.video_project_id
  where a.token_link = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and a.esito is null and a.token_usato_at is null and a.token_scade_at > now()
    and v.stato = 'da_approvare'
$$;

create or replace function public.studio_decide_by_token(p_token text, p_esito public.esito_approvazione, p_nota text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  t record;
  b public.brand_settings;
begin
  select * into t from public.studio_token_lookup(p_token);
  if t.approval_id is null then
    raise exception 'Il link non è più valido: è scaduto, è già stato usato o il video è cambiato' using errcode = '42501';
  end if;
  if p_esito = 'modifiche' and length(trim(coalesce(p_nota, ''))) = 0 then
    raise exception 'Scrivi cosa cambiare' using errcode = '23514';
  end if;
  update public.video_approvals set token_usato_at = now() where id = t.approval_id;
  select * into b from public.brand_settings where agency_id = t.agency_id;
  perform public.studio_apply_decision(
    t.video_project_id, t.approvatore_id, p_esito, p_nota,
    case when p_esito = 'approvato' then public.studio_next_slot(t.agency_id) end,
    case when p_esito = 'approvato' then b.piattaforme_predefinite end,
    'whatsapp');
end $$;

revoke execute on function public.studio_token_lookup(text) from public, anon, authenticated;
revoke execute on function public.studio_decide_by_token(text, public.esito_approvazione, text) from public, anon, authenticated;
grant execute on function public.studio_token_lookup(text), public.studio_decide_by_token(text, public.esito_approvazione, text),
  public.studio_next_slot(uuid) to service_role;

-- ---------- Permessi sulle funzioni ----------
revoke execute on function public.studio_brand_for_new_agency() from public, anon, authenticated;
revoke execute on function public.studio_script_state() from public, anon, authenticated;
revoke execute on function public.studio_apply_decision(uuid, uuid, public.esito_approvazione, text, timestamptz, public.piattaforma_social[], text) from public, anon, authenticated;
revoke execute on function public.studio_next_slot(uuid) from public, anon, authenticated;
revoke execute on function public.studio_avatar_ok(uuid) from public, anon, authenticated;
revoke execute on function public.studio_is_approver() from public, anon;
revoke execute on function public.studio_proposed_slot() from public, anon;
revoke execute on function public.studio_start_generation(uuid) from public, anon;
revoke execute on function public.studio_tick() from public, anon;
revoke execute on function public.studio_approval_link(uuid) from public, anon;
revoke execute on function public.studio_decide(uuid, public.esito_approvazione, text, timestamptz, public.piattaforma_social[]) from public, anon;
revoke execute on function public.studio_schedule(uuid, timestamptz, public.piattaforma_social[]) from public, anon;
revoke execute on function public.studio_avatar_setup(uuid) from public, anon;
revoke execute on function public.studio_avatar_training(text) from public, anon;
revoke execute on function public.studio_sign_consent(text, text, text) from public, anon;
revoke execute on function public.studio_revoke_consent(uuid) from public, anon;
grant execute on function public.studio_is_approver(), public.studio_proposed_slot(), public.studio_start_generation(uuid),
  public.studio_tick(), public.studio_approval_link(uuid),
  public.studio_decide(uuid, public.esito_approvazione, text, timestamptz, public.piattaforma_social[]),
  public.studio_schedule(uuid, timestamptz, public.piattaforma_social[]),
  public.studio_avatar_setup(uuid), public.studio_avatar_training(text),
  public.studio_sign_consent(text, text, text), public.studio_revoke_consent(uuid)
  to authenticated;
