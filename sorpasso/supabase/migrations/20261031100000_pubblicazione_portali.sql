-- =====================================================================
-- Sorpasso AI – Pubblicazione multi-portale
--
-- Carico l'auto una volta, la pubblico ovunque, prezzo/foto/stato restano allineati.
--
--   portals               catalogo globale dei portali e dei loro requisiti
--   organization_portals  per concessionaria: attivo, modalità (api/feed/manuale), credenziali in Vault
--   vehicle_listings      un annuncio per auto e portale, con stato e statistiche
--   sync_jobs             coda delle operazioni verso i portali (retry con backoff)
--
-- Le operazioni le esegue la Edge Function sync-portali, che chiama il connettore del portale
-- (una Edge Function per connettore). Un portale lento o in errore non blocca gli altri.
-- =====================================================================

create type public.modalita_portale as enum ('api', 'feed', 'manuale');
create type public.stato_connessione_portale as enum ('non_configurato', 'attivo', 'errore', 'disattivato');
create type public.stato_annuncio as enum ('bozza', 'in_pubblicazione', 'pubblicato', 'errore', 'sospeso', 'rimosso');
create type public.operazione_sync as enum ('publish', 'update', 'suspend', 'remove', 'stats');
create type public.stato_job as enum ('in_coda', 'in_corso', 'completato', 'errore', 'annullato');

-- ---------- Catalogo portali (uguale per tutti) ----------
create table public.portals (
  id text primary key,
  nome text not null,
  sito text,
  modalita_supportate public.modalita_portale[] not null,
  modalita_predefinita public.modalita_portale not null,
  -- Fonte con cui registrare i lead che arrivano da questo portale
  fonte_lead public.fonte_lead not null default 'altro',
  -- Requisiti per il controllo qualità (nomi delle colonne di vehicles)
  campi_obbligatori text[] not null default '{}',
  foto_min integer not null default 1,
  foto_max integer not null default 50,
  descrizione_min integer not null default 0,
  supporta_sospensione boolean not null default false,
  supporta_badge_prenotata boolean not null default false,
  ordine integer not null default 0
);

insert into public.portals
  (id, nome, sito, modalita_supportate, modalita_predefinita, fonte_lead, campi_obbligatori, foto_min, foto_max, descrizione_min, supporta_sospensione, supporta_badge_prenotata, ordine)
values
  ('autoscout24', 'AutoScout24', 'https://www.autoscout24.it', '{api,feed,manuale}', 'manuale', 'autoscout24',
   '{marca,modello,anno,mese_immatricolazione,km,alimentazione,cambio,potenza_kw,carrozzeria,prezzo_vendita}', 4, 50, 100, true, false, 1),
  ('subito', 'Subito', 'https://www.subito.it', '{api,feed,manuale}', 'manuale', 'subito',
   '{marca,modello,anno,km,alimentazione,cambio,prezzo_vendita}', 3, 20, 50, false, false, 2),
  ('automobile_it', 'Automobile.it', 'https://www.automobile.it', '{feed,manuale}', 'manuale', 'automobile_it',
   '{marca,modello,anno,km,alimentazione,cambio,prezzo_vendita}', 3, 30, 50, false, false, 3),
  ('meta', 'Facebook e Instagram (catalogo veicoli Meta)', 'https://business.facebook.com', '{feed,manuale}', 'feed', 'facebook',
   '{marca,modello,anno,km,alimentazione,cambio,carrozzeria,colore,prezzo_vendita}', 1, 20, 50, false, false, 4),
  ('sito', 'Sito della concessionaria', null, '{feed}', 'feed', 'sito',
   '{marca,modello,prezzo_vendita}', 1, 50, 0, true, true, 5),
  ('altro', 'Altro portale', null, '{manuale}', 'manuale', 'altro',
   '{marca,modello,prezzo_vendita}', 1, 50, 0, false, false, 6);

-- Etichette italiane dei campi controllati (per i messaggi del controllo qualità)
create or replace function public.etichetta_campo(p_campo text)
returns text language sql immutable set search_path = ''
as $$
  select coalesce(('{
    "marca": "Marca", "modello": "Modello", "versione": "Versione", "anno": "Anno",
    "mese_immatricolazione": "Mese di immatricolazione", "km": "Chilometri", "alimentazione": "Alimentazione",
    "cambio": "Cambio", "potenza_kw": "Potenza", "carrozzeria": "Carrozzeria", "colore": "Colore esterno",
    "prezzo_vendita": "Prezzo", "porte": "Porte", "posti": "Posti", "cilindrata": "Cilindrata",
    "classe_euro": "Classe Euro", "emissioni_co2": "Emissioni CO2", "consumo_misto": "Consumo"
  }'::jsonb ->> p_campo), p_campo)
$$;

-- ---------- Portali della concessionaria ----------
create table public.organization_portals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.mia_org() references public.organizations (id) on delete cascade,
  portal_id text not null references public.portals (id),
  attivo boolean not null default false,
  modalita public.modalita_portale not null,
  stato_connessione public.stato_connessione_portale not null default 'non_configurato',
  -- Credenziali/token cifrati in Supabase Vault: qui solo l'id del segreto
  credenziali_secret_id uuid,
  -- Opzioni non segrete (es. codice cliente, id catalogo Meta)
  config jsonb not null default '{}',
  -- URL privato del feed: /functions/v1/portale-feed?t=<feed_token>
  feed_token uuid not null default gen_random_uuid() unique,
  -- Token del webhook per ricevere i lead dal portale: /functions/v1/lead-da-portale?t=<webhook_token>
  webhook_token uuid not null default gen_random_uuid() unique,
  -- Costo mensile dell'abbonamento al portale (per costo per lead e per vendita)
  costo_mensile numeric(10, 2) not null default 0 check (costo_mensile >= 0),
  ultimo_controllo_at timestamptz,
  ultimo_errore text,
  created_at timestamptz not null default now(),
  unique (organization_id, portal_id)
);

-- ---------- Annunci ----------
alter table public.vehicles
  -- Codice da riportare negli annunci ("Rif. SA-1A2B3C"): collega i lead all'auto
  add column riferimento text generated always as ('SA-' || upper(substr(replace(id::text, '-', ''), 1, 6))) stored;
create index vehicles_riferimento_idx on public.vehicles (organization_id, riferimento);

create table public.vehicle_listings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.mia_org() references public.organizations (id) on delete cascade,
  vehicle_id uuid not null,
  portal_id text not null references public.portals (id),
  -- Interruttore on/off voluto dall'utente; lo stato reale è in `stato`
  attivo boolean not null default true,
  stato public.stato_annuncio not null default 'bozza',
  -- Prezzo specifico per questo portale (null = prezzo di listino)
  prezzo_portale numeric(12, 2) check (prezzo_portale >= 0),
  id_esterno text,
  url text check (url is null or url ~* '^https?://'),
  -- Modalità manuale: cosa deve fare a mano l'utente ('pubblica' | 'aggiorna' | 'sospendi' | 'rimuovi')
  azione_manuale text check (azione_manuale in ('pubblica', 'aggiorna', 'sospendi', 'rimuovi')),
  ultimo_sync_at timestamptz,
  errore_messaggio text,
  visualizzazioni integer,
  contatti integer,
  statistiche_at timestamptz,
  pubblicato_at timestamptz,
  rimosso_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vehicle_id, portal_id),
  unique (id, organization_id),
  foreign key (vehicle_id, organization_id) references public.vehicles (id, organization_id) on delete cascade
);
create index vehicle_listings_org_stato_idx on public.vehicle_listings (organization_id, stato);
create index vehicle_listings_esterno_idx on public.vehicle_listings (portal_id, id_esterno);

create trigger vehicle_listings_updated before update on public.vehicle_listings
for each row execute function public.tocca_updated_at();

-- I lead possono arrivare da un annuncio
alter table public.leads add column listing_id uuid;
alter table public.leads add constraint leads_listing_fk foreign key (listing_id, organization_id)
  references public.vehicle_listings (id, organization_id) on delete set null (listing_id);
create index leads_listing_idx on public.leads (listing_id);

-- ---------- Coda delle operazioni ----------
create table public.sync_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  listing_id uuid not null references public.vehicle_listings (id) on delete cascade,
  operazione public.operazione_sync not null,
  stato public.stato_job not null default 'in_coda',
  tentativi integer not null default 0,
  max_tentativi integer not null default 6,
  prossimo_tentativo_at timestamptz not null default now(),
  errore text,
  motivo text,
  created_at timestamptz not null default now(),
  iniziato_at timestamptz,
  finito_at timestamptz
);
create index sync_jobs_coda_idx on public.sync_jobs (stato, prossimo_tentativo_at);
create index sync_jobs_listing_idx on public.sync_jobs (listing_id, created_at desc);
-- Al massimo un job in coda per annuncio e operazione: dieci modifiche di fila = un solo aggiornamento
create unique index sync_jobs_unico_in_coda on public.sync_jobs (listing_id, operazione) where stato = 'in_coda';

-- Mette in coda un'operazione. Le operazioni "forti" annullano quelle superate:
-- remove annulla publish/update/suspend in coda; publish annulla remove.
create or replace function public.accoda_sync(p_listing uuid, p_operazione public.operazione_sync, p_motivo text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  org uuid;
begin
  select organization_id into org from public.vehicle_listings where id = p_listing;
  if org is null then return; end if;

  if p_operazione = 'remove' then
    update public.sync_jobs set stato = 'annullato', finito_at = now()
    where listing_id = p_listing and stato = 'in_coda' and operazione in ('publish', 'update', 'suspend', 'stats');
  elsif p_operazione in ('publish', 'update') then
    update public.sync_jobs set stato = 'annullato', finito_at = now()
    where listing_id = p_listing and stato = 'in_coda' and operazione in ('remove', 'suspend');
  end if;
  -- Se è già in coda una publish, un update è superfluo
  if p_operazione = 'update' and exists (
    select 1 from public.sync_jobs where listing_id = p_listing and stato = 'in_coda' and operazione = 'publish'
  ) then
    return;
  end if;

  insert into public.sync_jobs (organization_id, listing_id, operazione, motivo)
  values (org, p_listing, p_operazione, p_motivo)
  on conflict (listing_id, operazione) where stato = 'in_coda'
  do update set prossimo_tentativo_at = least(public.sync_jobs.prossimo_tentativo_at, now()),
                motivo = coalesce(excluded.motivo, public.sync_jobs.motivo);
end $$;
revoke execute on function public.accoda_sync(uuid, public.operazione_sync, text) from public, anon, authenticated;

-- ---------- Automatismi ----------

-- Interruttore dell'annuncio: on → pubblica, off → rimuovi. Nuovo annuncio attivo → pubblica.
create or replace function public.vehicle_listings_interruttore()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.attivo then perform public.accoda_sync(new.id, 'publish', 'nuovo annuncio'); end if;
  elsif new.attivo is distinct from old.attivo then
    if new.attivo then
      perform public.accoda_sync(new.id, 'publish', 'annuncio riattivato');
    elsif old.stato not in ('rimosso', 'bozza') or old.azione_manuale is not null then
      perform public.accoda_sync(new.id, 'remove', 'annuncio disattivato');
    end if;
  elsif new.prezzo_portale is distinct from old.prezzo_portale and new.attivo then
    perform public.accoda_sync(new.id, 'update', 'prezzo del portale');
  end if;
  return null;
end $$;

create trigger vehicle_listings_interruttore after insert or update of attivo, prezzo_portale on public.vehicle_listings
for each row execute function public.vehicle_listings_interruttore();

-- Modifiche all'auto: venduta → rimuovi ovunque; prenotata → sospendi/badge; altro → aggiorna.
create or replace function public.vehicles_sync_portali()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  l record;
  op public.operazione_sync;
  motivo text;
begin
  if new.stato is distinct from old.stato and new.stato = 'venduto' then
    op := 'remove'; motivo := 'auto venduta';
  elsif new.stato is distinct from old.stato and new.stato = 'prenotato' then
    op := 'suspend'; motivo := 'auto prenotata';
  elsif new.stato is distinct from old.stato and old.stato in ('prenotato', 'venduto') then
    op := 'publish'; motivo := 'auto di nuovo disponibile';
  elsif (new.prezzo_vendita, new.km, new.descrizione, new.descrizione_breve, new.optional, new.optional_extra,
         new.versione, new.allestimento, new.colore, new.garanzia_mesi, new.potenza_kw, new.anno, new.mese_immatricolazione,
         new.alimentazione, new.cambio, new.carrozzeria, new.marca, new.modello)
        is distinct from
        (old.prezzo_vendita, old.km, old.descrizione, old.descrizione_breve, old.optional, old.optional_extra,
         old.versione, old.allestimento, old.colore, old.garanzia_mesi, old.potenza_kw, old.anno, old.mese_immatricolazione,
         old.alimentazione, old.cambio, old.carrozzeria, old.marca, old.modello) then
    op := 'update'; motivo := case when new.prezzo_vendita is distinct from old.prezzo_vendita then 'prezzo cambiato' else 'dati cambiati' end;
  else
    return null;
  end if;

  for l in
    select id, stato from public.vehicle_listings
    where vehicle_id = new.id and attivo and (stato <> 'rimosso' or op = 'publish')
  loop
    if op = 'publish' and l.stato in ('pubblicato', 'in_pubblicazione') then
      perform public.accoda_sync(l.id, 'update', motivo);
    elsif op <> 'publish' or l.stato in ('sospeso', 'rimosso', 'errore', 'bozza') then
      perform public.accoda_sync(l.id, op, motivo);
    end if;
  end loop;
  return null;
end $$;

create trigger vehicles_sync_portali after update on public.vehicles
for each row execute function public.vehicles_sync_portali();

-- Foto aggiunte, eliminate o riordinate → aggiorna gli annunci
create or replace function public.vehicle_photos_sync_portali()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  vid uuid := coalesce(new.vehicle_id, old.vehicle_id);
  l record;
begin
  for l in
    select id from public.vehicle_listings where vehicle_id = vid and attivo and stato in ('pubblicato', 'in_pubblicazione', 'errore')
  loop
    perform public.accoda_sync(l.id, 'update', 'foto cambiate');
  end loop;
  return null;
end $$;

create trigger vehicle_photos_sync_portali after insert or delete or update of ordine on public.vehicle_photos
for each row execute function public.vehicle_photos_sync_portali();

-- Lead da un portale: collegamento automatico ad auto e annuncio.
--   * listing_id indicato (webhook del portale) → auto e fonte dall'annuncio
--   * richiesta con "SA-XXXXXX" (riferimento negli annunci) → auto e, se la fonte è un portale, annuncio
--   * auto indicata e fonte di un portale → annuncio di quel portale
create or replace function public.leads_collega_annuncio()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  rif text;
begin
  if new.listing_id is not null then
    select vl.vehicle_id, p.fonte_lead into new.vehicle_id, new.fonte
    from public.vehicle_listings vl join public.portals p on p.id = vl.portal_id
    where vl.id = new.listing_id and vl.organization_id = new.organization_id;
    return new;
  end if;

  if new.vehicle_id is null and new.richiesta is not null then
    rif := upper(substring(new.richiesta from '(?i)SA-[0-9A-F]{6}'));
    if rif is not null then
      select id into new.vehicle_id from public.vehicles
      where organization_id = new.organization_id and riferimento = rif;
    end if;
  end if;

  if new.vehicle_id is not null then
    select vl.id into new.listing_id
    from public.vehicle_listings vl join public.portals p on p.id = vl.portal_id
    where vl.vehicle_id = new.vehicle_id and p.fonte_lead = new.fonte and p.id <> 'altro'
    limit 1;
  end if;
  return new;
end $$;

-- Prima dell'assegnazione round robin (i trigger BEFORE scattano in ordine alfabetico)
create trigger leads_a_collega_annuncio before insert on public.leads
for each row execute function public.leads_collega_annuncio();

-- ---------- Controllo qualità ----------
-- Per ogni portale attivo della concessionaria: cosa manca all'auto per essere pubblicata.
create or replace function public.controllo_qualita_annuncio(p_vehicle uuid)
returns table (portal_id text, portale text, problemi text[], pronto boolean)
language sql stable security invoker set search_path = ''
as $$
  with v as (select to_jsonb(x) as j, x.id, x.descrizione from public.vehicles x where x.id = p_vehicle),
  foto as (select count(*)::int as n from public.vehicle_photos where vehicle_id = p_vehicle),
  pr as (
    select p.*, op.attivo as portale_attivo
    from public.portals p
    join public.organization_portals op on op.portal_id = p.id
    join v on true
    where op.organization_id = (select organization_id from public.vehicles where id = p_vehicle)
  )
  select
    pr.id,
    pr.nome,
    array_remove(
      array(select 'Manca: ' || public.etichetta_campo(c) from unnest(pr.campi_obbligatori) c
            where coalesce(nullif(trim(v.j ->> c), ''), null) is null)
      || case when foto.n < pr.foto_min then array['Servono almeno ' || pr.foto_min || ' foto (ora ' || foto.n || ')'] else '{}'::text[] end
      || case when foto.n > pr.foto_max then array['Il portale accetta al massimo ' || pr.foto_max || ' foto: verranno inviate le prime ' || pr.foto_max] else '{}'::text[] end
      || case when length(coalesce(v.descrizione, '')) < greatest(pr.descrizione_min, 1)
              then array['Descrizione assente o troppo corta' || case when pr.descrizione_min > 0 then ' (minimo ' || pr.descrizione_min || ' caratteri)' else '' end]
              else '{}'::text[] end,
      null),
    -- Avvisi sulle foto oltre il massimo non bloccano
    not exists (
      select 1 from unnest(pr.campi_obbligatori) c where coalesce(nullif(trim(v.j ->> c), ''), null) is null
    ) and foto.n >= pr.foto_min and length(coalesce(v.descrizione, '')) >= greatest(pr.descrizione_min, 1)
  from pr cross join v cross join foto
  where pr.portale_attivo
  order by pr.ordine
$$;

-- ---------- Funzioni per il worker (solo chiave di servizio) ----------

-- Prende fino a p_limite job pronti, al massimo p_per_portale per portale, e li segna "in corso".
-- I job in corso da più di 10 minuti (worker caduto) tornano in coda.
create or replace function public.prendi_job_sync(p_limite integer default 30, p_per_portale integer default 10)
returns table (job_id uuid, listing_id uuid, operazione public.operazione_sync, tentativi integer,
               organization_id uuid, portal_id text, modalita public.modalita_portale, vehicle_id uuid)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  update public.sync_jobs set stato = 'in_coda', prossimo_tentativo_at = now()
  where stato = 'in_corso' and iniziato_at < now() - interval '10 minutes';

  return query
  with candidati as (
    select j.id, row_number() over (partition by vl.portal_id order by j.prossimo_tentativo_at) as n
    from public.sync_jobs j join public.vehicle_listings vl on vl.id = j.listing_id
    where j.stato = 'in_coda' and j.prossimo_tentativo_at <= now()
  ),
  scelti as (
    select j.id from public.sync_jobs j join candidati c on c.id = j.id
    where c.n <= p_per_portale
    order by j.prossimo_tentativo_at
    limit p_limite
    for update of j skip locked
  ),
  presi as (
    update public.sync_jobs j set stato = 'in_corso', iniziato_at = now(), tentativi = j.tentativi + 1
    from scelti where j.id = scelti.id
    returning j.id, j.listing_id, j.operazione, j.tentativi, j.organization_id
  )
  select p.id, p.listing_id, p.operazione, p.tentativi, p.organization_id, vl.portal_id, op.modalita, vl.vehicle_id
  from presi p
  join public.vehicle_listings vl on vl.id = p.listing_id
  join public.organization_portals op on op.organization_id = vl.organization_id and op.portal_id = vl.portal_id;
end $$;
revoke execute on function public.prendi_job_sync(integer, integer) from public, anon, authenticated;

-- Esito positivo di un job: aggiorna l'annuncio.
-- p_esito: { stato?, id_esterno?, url?, azione_manuale?, visualizzazioni?, contatti? }
create or replace function public.completa_job_sync(p_job uuid, p_esito jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  j public.sync_jobs;
begin
  update public.sync_jobs set stato = 'completato', finito_at = now(), errore = null
  where id = p_job returning * into j;
  if j.id is null then return; end if;

  update public.vehicle_listings set
    stato = coalesce((p_esito ->> 'stato')::public.stato_annuncio, stato),
    id_esterno = coalesce(p_esito ->> 'id_esterno', id_esterno),
    url = coalesce(p_esito ->> 'url', url),
    azione_manuale = case when p_esito ? 'azione_manuale' then p_esito ->> 'azione_manuale' else azione_manuale end,
    visualizzazioni = coalesce((p_esito ->> 'visualizzazioni')::int, visualizzazioni),
    contatti = coalesce((p_esito ->> 'contatti')::int, contatti),
    statistiche_at = case when j.operazione = 'stats' then now() else statistiche_at end,
    ultimo_sync_at = case when j.operazione <> 'stats' then now() else ultimo_sync_at end,
    pubblicato_at = case when (p_esito ->> 'stato') = 'pubblicato' then coalesce(pubblicato_at, now()) else pubblicato_at end,
    rimosso_at = case when (p_esito ->> 'stato') = 'rimosso' then now() else rimosso_at end,
    errore_messaggio = null
  where id = j.listing_id;

  update public.organization_portals op set stato_connessione = 'attivo', ultimo_errore = null, ultimo_controllo_at = now()
  from public.vehicle_listings vl
  where vl.id = j.listing_id and op.organization_id = vl.organization_id and op.portal_id = vl.portal_id
    and op.modalita <> 'manuale';
end $$;
revoke execute on function public.completa_job_sync(uuid, jsonb) from public, anon, authenticated;

-- Esito negativo: riprova con backoff esponenziale (1, 2, 4, 8, 16… minuti, max 6 ore);
-- dopo l'ultimo tentativo (o se l'errore è definitivo) l'annuncio va in errore e i manager ricevono una notifica.
create or replace function public.fallisci_job_sync(p_job uuid, p_messaggio text, p_definitivo boolean default false)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  j public.sync_jobs;
  vl record;
  dest uuid;
begin
  select * into j from public.sync_jobs where id = p_job;
  if j.id is null then return; end if;

  if not p_definitivo and j.tentativi < j.max_tentativi then
    update public.sync_jobs set stato = 'in_coda', errore = p_messaggio,
      prossimo_tentativo_at = now() + least(interval '1 minute' * power(2, j.tentativi - 1), interval '6 hours')
    where id = p_job;
    return;
  end if;

  update public.sync_jobs set stato = 'errore', errore = p_messaggio, finito_at = now() where id = p_job;
  update public.vehicle_listings set stato = 'errore', errore_messaggio = p_messaggio where id = j.listing_id;

  select l.organization_id, l.vehicle_id, p.nome as portale, v.marca, v.modello
    into vl
  from public.vehicle_listings l
  join public.portals p on p.id = l.portal_id
  join public.vehicles v on v.id = l.vehicle_id
  where l.id = j.listing_id;

  for dest in
    select user_id from public.profiles
    where organization_id = vl.organization_id and attivo and ruolo in ('titolare', 'responsabile_vendite')
  loop
    insert into public.notifications (organization_id, user_id, tipo, titolo, testo, link)
    values (vl.organization_id, dest, 'pubblicazione_errore',
            'Pubblicazione non riuscita su ' || vl.portale,
            vl.marca || ' ' || vl.modello || ': ' || p_messaggio,
            '/stock/' || vl.vehicle_id || '?tab=pubblicazione');
  end loop;

  insert into public.automations_log (organization_id, tipo, entita, entita_id, esito, dettagli)
  values (vl.organization_id, 'pubblicazione_' || j.operazione, 'vehicle_listing', j.listing_id, 'errore',
          jsonb_build_object('portale', vl.portale, 'messaggio', p_messaggio, 'tentativi', j.tentativi));
end $$;
revoke execute on function public.fallisci_job_sync(uuid, text, boolean) from public, anon, authenticated;

-- Credenziali del portale (decifrate da Vault): solo per le Edge Function con chiave di servizio.
create or replace function public.credenziali_portale(p_org uuid, p_portale text)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  sid uuid;
  segreto text;
begin
  select credenziali_secret_id into sid from public.organization_portals where organization_id = p_org and portal_id = p_portale;
  if sid is null then return null; end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where id = $1' into segreto using sid;
  return segreto;
end $$;
revoke execute on function public.credenziali_portale(uuid, text) from public, anon, authenticated;

-- Salvataggio credenziali da parte del titolare: finiscono cifrate in Vault, mai in chiaro nelle tabelle.
create or replace function public.salva_credenziali_portale(p_portale text, p_credenziali text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  org uuid := public.mia_org();
  sid uuid;
begin
  if not public.ha_ruolo('titolare') then
    raise exception 'Solo il titolare può gestire le credenziali dei portali' using errcode = '42501';
  end if;
  select credenziali_secret_id into sid from public.organization_portals where organization_id = org and portal_id = p_portale;
  if sid is null then
    execute 'select vault.create_secret($1, $2, $3)' into sid
      using p_credenziali, 'portale_' || p_portale || '_' || org, 'Credenziali ' || p_portale || ' (Sorpasso AI)';
    update public.organization_portals set credenziali_secret_id = sid, stato_connessione = 'attivo'
    where organization_id = org and portal_id = p_portale;
  else
    execute 'select vault.update_secret($1, $2)' using sid, p_credenziali;
  end if;
end $$;

-- "Pubblica ovunque": crea/riattiva gli annunci su tutti i portali attivi pronti per l'auto.
-- Restituisce i portali su cui è partita la pubblicazione e quelli saltati per il controllo qualità.
create or replace function public.pubblica_ovunque(p_vehicle uuid)
returns table (portal_id text, avviata boolean, problemi text[])
language plpgsql security invoker set search_path = ''
as $$
#variable_conflict use_column
declare
  q record;
begin
  if not public.e_manager() then
    raise exception 'Solo titolare e responsabile vendite possono pubblicare' using errcode = '42501';
  end if;
  for q in select * from public.controllo_qualita_annuncio(p_vehicle) loop
    portal_id := q.portal_id;
    problemi := q.problemi;
    avviata := q.pronto;
    if q.pronto then
      insert into public.vehicle_listings (vehicle_id, portal_id, attivo)
      values (p_vehicle, q.portal_id, true)
      on conflict (vehicle_id, portal_id) do update set attivo = true;
      -- Già attivo ma in errore/rimosso: ripubblica
      update public.vehicle_listings set errore_messaggio = null
      where vehicle_id = p_vehicle and vehicle_listings.portal_id = q.portal_id and stato in ('errore', 'rimosso', 'bozza');
      perform public.accoda_sync_pubblico(p_vehicle, q.portal_id);
    end if;
    return next;
  end loop;
end $$;

-- Ripubblicazione richiesta dall'utente (pulsanti "Riprova" e "Pubblica ovunque").
create or replace function public.accoda_sync_pubblico(p_vehicle uuid, p_portale text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  lid uuid;
  st public.stato_annuncio;
begin
  if not public.e_manager() then
    raise exception 'Operazione non consentita' using errcode = '42501';
  end if;
  select id, stato into lid, st from public.vehicle_listings
  where vehicle_id = p_vehicle and portal_id = p_portale and organization_id = public.mia_org() and attivo;
  if lid is null then return; end if;
  perform public.accoda_sync(lid, case when st in ('pubblicato', 'in_pubblicazione', 'sospeso') then 'update' else 'publish' end::public.operazione_sync, 'richiesta utente');
end $$;

-- Modalità manuale: l'utente conferma di aver fatto l'azione sul portale (eventualmente incollando l'URL).
create or replace function public.conferma_azione_manuale(p_listing uuid, p_url text default null)
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  if not public.e_manager() then
    raise exception 'Solo titolare e responsabile vendite possono aggiornare gli annunci' using errcode = '42501';
  end if;
  if p_url is not null and p_url !~* '^https?://' then
    raise exception 'Incolla l''indirizzo completo dell''annuncio (inizia con https://)' using errcode = 'P0001';
  end if;
  update public.vehicle_listings set
    url = coalesce(nullif(trim(p_url), ''), url),
    stato = case
      when azione_manuale = 'rimuovi' then 'rimosso'
      when azione_manuale = 'sospendi' then 'sospeso'
      when azione_manuale in ('pubblica', 'aggiorna') or p_url is not null then 'pubblicato'
      else stato end::public.stato_annuncio,
    pubblicato_at = case when azione_manuale in ('pubblica', 'aggiorna') or p_url is not null then coalesce(pubblicato_at, now()) else pubblicato_at end,
    rimosso_at = case when azione_manuale = 'rimuovi' then now() else rimosso_at end,
    azione_manuale = null,
    errore_messaggio = null,
    ultimo_sync_at = now()
  where id = p_listing and organization_id = public.mia_org();
end $$;

-- Statistiche: una volta al giorno per gli annunci pubblicati via API
create or replace function public.accoda_statistiche()
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  n integer := 0;
  l record;
begin
  for l in
    select vl.id from public.vehicle_listings vl
    join public.organization_portals op on op.organization_id = vl.organization_id and op.portal_id = vl.portal_id
    where vl.stato = 'pubblicato' and op.attivo and op.modalita = 'api'
      and (vl.statistiche_at is null or vl.statistiche_at < now() - interval '20 hours')
  loop
    perform public.accoda_sync(l.id, 'stats');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.accoda_statistiche() from public, anon, authenticated;

-- ---------- Report per portale ----------
-- Auto pubblicate, contatti, vendite e costo del portale nel periodo → costo per lead e per vendita.
create or replace function public.report_portali(p_da timestamptz, p_a timestamptz)
returns table (
  portal_id text, portale text, attivo boolean, auto_pubblicate integer, contatti integer,
  vendite integer, costo numeric, costo_per_lead numeric, costo_per_vendita numeric
)
language sql stable security invoker set search_path = ''
as $$
  with periodo as (
    -- mesi (anche frazionari) del periodo, per ripartire l'abbonamento mensile
    select greatest(extract(epoch from (least(p_a, now()) - p_da)) / (30.4375 * 86400), 0) as mesi
  ),
  l as (
    select le.*, coalesce(vl.portal_id, po.id) as portale_id
    from public.leads le
    left join public.vehicle_listings vl on vl.id = le.listing_id
    left join public.portals po on po.fonte_lead = le.fonte and po.id <> 'altro' and le.listing_id is null
    where le.created_at >= p_da and le.created_at < p_a
  )
  select
    p.id, p.nome, op.attivo,
    (select count(distinct vl.vehicle_id) from public.vehicle_listings vl
      where vl.portal_id = p.id and vl.pubblicato_at is not null and vl.pubblicato_at < p_a
        and (vl.rimosso_at is null or vl.rimosso_at >= p_da))::int,
    (select count(*) from l where l.portale_id = p.id)::int,
    (select count(*) from l where l.portale_id = p.id and l.stato = 'vinto')::int,
    round(op.costo_mensile * periodo.mesi, 2),
    round(op.costo_mensile * periodo.mesi / nullif((select count(*) from l where l.portale_id = p.id), 0), 2),
    round(op.costo_mensile * periodo.mesi / nullif((select count(*) from l where l.portale_id = p.id and l.stato = 'vinto'), 0), 2)
  from public.portals p
  join public.organization_portals op on op.portal_id = p.id and op.organization_id = public.mia_org()
  cross join periodo
  where public.e_manager()
  order by p.ordine
$$;

-- Portali predefiniti per ogni concessionaria (disattivati: li accende il titolare)
create or replace function public.crea_portali_predefiniti(p_org uuid)
returns void language sql security definer set search_path = ''
as $$
  insert into public.organization_portals (organization_id, portal_id, modalita, attivo)
  select p_org, p.id, p.modalita_predefinita, p.id = 'sito' from public.portals p
  on conflict (organization_id, portal_id) do nothing
$$;
revoke execute on function public.crea_portali_predefiniti(uuid) from public, anon, authenticated;

do $$
begin
  perform public.crea_portali_predefiniti(id) from public.organizations;
end $$;

create or replace function public.organizations_portali_predefiniti()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform public.crea_portali_predefiniti(new.id);
  return null;
end $$;

create trigger organizations_portali_predefiniti after insert on public.organizations
for each row execute function public.organizations_portali_predefiniti();

-- ---------- Vista stock: icone dei portali dove l'auto è online ----------
drop view public.vehicles_view;
create view public.vehicles_view with (security_invoker = true) as
select
  v.*,
  (coalesce(v.data_uscita, current_date) - v.data_ingresso) as giorni_giacenza,
  (v.stato <> 'venduto' and (current_date - v.data_ingresso) > o.soglia_giacenza_giorni) as oltre_soglia,
  o.soglia_giacenza_giorni,
  (select ph.storage_path from public.vehicle_photos ph
    where ph.vehicle_id = v.id order by ph.ordine, ph.created_at limit 1) as foto_copertina,
  (select count(*) from public.vehicle_photos ph where ph.vehicle_id = v.id)::int as numero_foto,
  (select count(*) from public.leads l
    where l.vehicle_id = v.id and l.stato not in ('vinto', 'perso'))::int as lead_aperti,
  coalesce((select array_agg(vl.portal_id order by p.ordine) from public.vehicle_listings vl
             join public.portals p on p.id = vl.portal_id
            where vl.vehicle_id = v.id and vl.stato = 'pubblicato'), '{}') as portali_online,
  exists (select 1 from public.vehicle_listings vl where vl.vehicle_id = v.id and vl.stato = 'errore') as pubblicazione_errore
from public.vehicles v
join public.organizations o on o.id = v.organization_id;

-- ---------- RLS ----------
alter table public.portals enable row level security;
alter table public.organization_portals enable row level security;
alter table public.vehicle_listings enable row level security;
alter table public.sync_jobs enable row level security;

create policy "portali: lettura" on public.portals for select to authenticated using (true);

-- Configurazione portali: la vedono i manager, la modifica il titolare
create policy "portali org: lettura manager" on public.organization_portals for select to authenticated
  using (organization_id = (select public.mia_org()) and (select public.e_manager()));
create policy "portali org: modifica titolare" on public.organization_portals for update to authenticated
  using (organization_id = (select public.mia_org()) and (select public.ha_ruolo('titolare')))
  with check (organization_id = (select public.mia_org()));

-- Annunci: tutti li vedono (icone nello stock), i manager li gestiscono
create policy "annunci: lettura" on public.vehicle_listings for select to authenticated
  using (organization_id = (select public.mia_org()));
create policy "annunci: inserimento manager" on public.vehicle_listings for insert to authenticated
  with check (organization_id = (select public.mia_org()) and (select public.e_manager()));
create policy "annunci: modifica manager" on public.vehicle_listings for update to authenticated
  using (organization_id = (select public.mia_org()) and (select public.e_manager()))
  with check (organization_id = (select public.mia_org()));

create policy "coda: lettura manager" on public.sync_jobs for select to authenticated
  using (organization_id = (select public.mia_org()) and (select public.e_manager()));

-- ---------- Pianificazione ----------
-- Il worker sync-portali va chiamato ogni minuto. Con pg_cron + pg_net la chiamata parte dal database
-- usando due segreti in Vault (vedi README): sorpasso_functions_url e sorpasso_sync_secret.
create or replace function public.avvia_sync_portali()
returns void language plpgsql security definer set search_path = ''
as $$
declare
  url text;
  segreto text;
begin
  if not exists (select 1 from public.sync_jobs where stato = 'in_coda' and prossimo_tentativo_at <= now()) then
    return;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = ''sorpasso_functions_url''' into url;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = ''sorpasso_sync_secret''' into segreto;
  if url is null or segreto is null then
    raise notice 'Configura i segreti sorpasso_functions_url e sorpasso_sync_secret in Vault';
    return;
  end if;
  execute 'select net.http_post(url := $1, headers := $2, body := ''{}''::jsonb, timeout_milliseconds := 55000)'
    using url || '/sync-portali', jsonb_build_object('Content-Type', 'application/json', 'x-sync-secret', segreto);
end $$;
revoke execute on function public.avvia_sync_portali() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('sorpasso-sync-portali', '* * * * *', 'select public.avvia_sync_portali()');
    perform cron.schedule('sorpasso-statistiche-portali', '17 3 * * *', 'select public.accoda_statistiche()');
  else
    raise notice 'pg_cron non disponibile: chiama la funzione sync-portali ogni minuto da uno scheduler esterno';
  end if;
end $$;
