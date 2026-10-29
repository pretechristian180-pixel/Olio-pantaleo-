-- =====================================================================
-- Sorpasso AI – schema iniziale multi-azienda (concessionarie auto)
--
-- Regole generali
-- * Ogni tabella operativa ha organization_id, compilato in automatico
--   con l'organizzazione dell'utente (default public.mia_org()).
-- * Le chiavi esterne composte (id, organization_id) impediscono di collegare
--   righe di concessionarie diverse.
-- * RLS attiva su tutte le tabelle. Ruoli:
--     titolare             vede e gestisce tutto, utenti e impostazioni
--     responsabile_vendite vede tutti i lead, i venditori e lo stock
--     venditore            vede i propri lead/contatti e lo stock
--     amministrazione      pratiche e documenti, il resto in sola lettura
-- * Lo storico (activities) non si modifica e non si cancella.
-- =====================================================================

-- ---------- Tipi ----------
create type public.ruolo as enum ('titolare', 'responsabile_vendite', 'venditore', 'amministrazione');
create type public.tipo_veicolo as enum ('nuovo', 'usato', 'km0');
create type public.stato_veicolo as enum ('disponibile', 'prenotato', 'venduto', 'in_preparazione');
create type public.alimentazione as enum ('benzina', 'diesel', 'gpl', 'metano', 'ibrida', 'ibrida_plugin', 'elettrica');
create type public.cambio as enum ('manuale', 'automatico');
create type public.fonte_lead as enum (
  'autoscout24', 'subito', 'sito', 'facebook', 'instagram', 'telefono', 'salone', 'passaparola', 'altro'
);
-- L'ordine conta: gli stati si confrontano con < e > per far avanzare la pipeline.
create type public.stato_lead as enum (
  'nuovo', 'contattato', 'qualificato', 'test_drive', 'preventivo', 'trattativa', 'vinto', 'perso'
);
create type public.tempistica as enum ('subito', 'entro_1_mese', 'entro_3_mesi', 'oltre', 'non_definita');
create type public.tipo_attivita as enum ('chiamata', 'whatsapp', 'email', 'nota', 'test_drive', 'preventivo', 'cambio_stato');
create type public.tipo_appuntamento as enum ('test_drive', 'consegna', 'valutazione_permuta', 'officina');
create type public.stato_appuntamento as enum ('programmato', 'completato', 'annullato', 'non_presentato');
create type public.stato_preventivo as enum ('bozza', 'inviato', 'accettato', 'rifiutato');
create type public.tipo_documento as enum ('carta_identita', 'patente', 'codice_fiscale', 'libretto', 'contratto', 'altro');
create type public.canale_messaggio as enum ('whatsapp', 'email');
create type public.esito_automazione as enum ('ok', 'saltato', 'errore');

-- ---------- Organizzazioni e profili ----------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  piva text check (piva is null or piva ~ '^[0-9]{11}$'),
  indirizzo text,
  comune text,
  telefono text,
  email text,
  logo_url text,
  marchi text[] not null default '{}',
  soglia_giacenza_giorni integer not null default 60 check (soglia_giacenza_giorni between 1 and 3650),
  tempo_max_risposta_min integer not null default 15 check (tempo_max_risposta_min between 1 and 10080),
  round_robin_attivo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  email text,
  ruolo public.ruolo not null default 'venditore',
  telefono text,
  attivo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, organization_id)
);
create index profiles_org_idx on public.profiles (organization_id);

-- Funzioni di accesso usate da RLS e dai valori predefiniti delle colonne.
-- security definer: leggono profiles senza passare dalle sue policy (evita ricorsione).
create or replace function public.mia_org()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.organization_id from public.profiles p where p.user_id = (select auth.uid()) and p.attivo
$$;

create or replace function public.mio_ruolo()
returns public.ruolo
language sql stable security definer set search_path = ''
as $$
  select p.ruolo from public.profiles p where p.user_id = (select auth.uid()) and p.attivo
$$;

create or replace function public.ha_ruolo(variadic ruoli public.ruolo[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select p.ruolo = any (ruoli) from public.profiles p
                   where p.user_id = (select auth.uid()) and p.attivo), false)
$$;

-- Titolare e responsabile vendite vedono tutta la parte commerciale.
create or replace function public.e_manager()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.ha_ruolo('titolare', 'responsabile_vendite')
$$;

-- Un contatto creato da un venditore gli resta assegnato.
create or replace function public.venditore_predefinito()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select case when public.mio_ruolo() = 'venditore' then (select auth.uid()) end
$$;

-- ---------- Veicoli ----------
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.mia_org() references public.organizations (id) on delete cascade,
  marca text not null check (length(trim(marca)) > 0),
  modello text not null check (length(trim(modello)) > 0),
  versione text,
  anno integer check (anno between 1950 and 2100),
  km integer not null default 0 check (km >= 0),
  alimentazione public.alimentazione,
  cambio public.cambio,
  colore text,
  targa text,
  telaio text check (telaio is null or length(telaio) = 17),
  tipo public.tipo_veicolo not null default 'usato',
  prezzo_vendita numeric(12, 2) check (prezzo_vendita >= 0),
  stato public.stato_veicolo not null default 'disponibile',
  data_ingresso date not null default current_date,
  data_uscita date,
  descrizione text,
  note_interne text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);
create unique index vehicles_targa_uq on public.vehicles (organization_id, upper(targa)) where targa is not null;
create unique index vehicles_telaio_uq on public.vehicles (organization_id, upper(telaio)) where telaio is not null;
create index vehicles_org_stato_idx on public.vehicles (organization_id, stato, data_ingresso);

-- Il prezzo di acquisto è un dato riservato (margine): vive in una tabella
-- separata visibile solo a titolare e responsabile vendite.
create table public.vehicle_costs (
  vehicle_id uuid primary key,
  organization_id uuid not null default public.mia_org() references public.organizations (id) on delete cascade,
  prezzo_acquisto numeric(12, 2) check (prezzo_acquisto >= 0),
  updated_at timestamptz not null default now(),
  foreign key (vehicle_id, organization_id) references public.vehicles (id, organization_id) on delete cascade
);

create table public.vehicle_photos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.mia_org() references public.organizations (id) on delete cascade,
  vehicle_id uuid not null,
  storage_path text not null,
  ordine integer not null default 0,
  created_at timestamptz not null default now(),
  foreign key (vehicle_id, organization_id) references public.vehicles (id, organization_id) on delete cascade
);
create index vehicle_photos_vehicle_idx on public.vehicle_photos (vehicle_id, ordine);

create table public.vehicle_price_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vehicle_id uuid not null,
  prezzo_precedente numeric(12, 2),
  prezzo_nuovo numeric(12, 2),
  autore_id uuid,
  created_at timestamptz not null default now(),
  foreign key (vehicle_id, organization_id) references public.vehicles (id, organization_id) on delete cascade
);
create index vehicle_price_history_vehicle_idx on public.vehicle_price_history (vehicle_id, created_at);

-- ---------- Contatti ----------
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.mia_org() references public.organizations (id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  cognome text not null default '',
  telefono text,
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  comune text,
  consenso_privacy boolean not null default false,
  consenso_privacy_at timestamptz,
  consenso_marketing boolean not null default false,
  consenso_marketing_at timestamptz,
  fonte public.fonte_lead,
  venditore_assegnato uuid default public.venditore_predefinito(),
  tag text[] not null default '{}',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (telefono is not null or email is not null),
  unique (id, organization_id),
  foreign key (venditore_assegnato, organization_id)
    references public.profiles (user_id, organization_id) on delete set null (venditore_assegnato)
);
create index contacts_org_idx on public.contacts (organization_id, cognome, nome);
create index contacts_telefono_idx on public.contacts (organization_id, telefono);
create index contacts_venditore_idx on public.contacts (venditore_assegnato);

-- ---------- Lead ----------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.mia_org() references public.organizations (id) on delete cascade,
  contact_id uuid not null,
  vehicle_id uuid,
  fonte public.fonte_lead not null default 'altro',
  stato public.stato_lead not null default 'nuovo',
  motivo_perso text,
  richiesta text,
  marca_interesse text,
  modello_interesse text,
  budget numeric(12, 2) check (budget >= 0),
  permuta boolean not null default false,
  -- { marca, modello, anno, km, note }
  permuta_dati jsonb,
  finanziamento boolean not null default false,
  tempistica public.tempistica not null default 'non_definita',
  punteggio integer not null default 0 check (punteggio between 0 and 100),
  assegnato_a uuid,
  creato_da uuid default auth.uid(),
  primo_contatto_at timestamptz,
  ultimo_contatto_at timestamptz,
  prossima_azione_at timestamptz,
  prossima_azione_nota text,
  chiuso_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (stato <> 'perso' or length(trim(coalesce(motivo_perso, ''))) > 0),
  unique (id, organization_id),
  foreign key (contact_id, organization_id) references public.contacts (id, organization_id) on delete cascade,
  foreign key (vehicle_id, organization_id) references public.vehicles (id, organization_id) on delete set null (vehicle_id),
  foreign key (assegnato_a, organization_id)
    references public.profiles (user_id, organization_id) on delete set null (assegnato_a)
);
create index leads_org_stato_idx on public.leads (organization_id, stato);
create index leads_assegnato_idx on public.leads (assegnato_a, stato);
create index leads_contact_idx on public.leads (contact_id);
create index leads_vehicle_idx on public.leads (vehicle_id);
create index leads_prossima_azione_idx on public.leads (organization_id, prossima_azione_at);
create index leads_created_idx on public.leads (organization_id, created_at);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.mia_org() references public.organizations (id) on delete cascade,
  lead_id uuid not null,
  tipo public.tipo_attivita not null,
  contenuto text not null default '',
  autore_id uuid default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (lead_id, organization_id) references public.leads (id, organization_id) on delete cascade
);
create index activities_lead_idx on public.activities (lead_id, created_at desc);

-- ---------- Appuntamenti ----------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.mia_org() references public.organizations (id) on delete cascade,
  tipo public.tipo_appuntamento not null,
  lead_id uuid,
  contact_id uuid,
  vehicle_id uuid,
  assegnato_a uuid default auth.uid(),
  inizio timestamptz not null,
  fine timestamptz not null,
  stato public.stato_appuntamento not null default 'programmato',
  note text,
  created_at timestamptz not null default now(),
  check (fine > inizio),
  foreign key (lead_id, organization_id) references public.leads (id, organization_id) on delete set null (lead_id),
  foreign key (contact_id, organization_id) references public.contacts (id, organization_id) on delete set null (contact_id),
  foreign key (vehicle_id, organization_id) references public.vehicles (id, organization_id) on delete set null (vehicle_id),
  foreign key (assegnato_a, organization_id)
    references public.profiles (user_id, organization_id) on delete set null (assegnato_a)
);
create index appointments_org_inizio_idx on public.appointments (organization_id, inizio);
create index appointments_assegnato_idx on public.appointments (assegnato_a, inizio);
create index appointments_lead_idx on public.appointments (lead_id);

-- ---------- Preventivi ----------
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.mia_org() references public.organizations (id) on delete cascade,
  lead_id uuid not null,
  vehicle_id uuid,
  prezzo numeric(12, 2) not null check (prezzo >= 0),
  sconto numeric(12, 2) not null default 0 check (sconto >= 0),
  permuta_valutata numeric(12, 2) not null default 0 check (permuta_valutata >= 0),
  anticipo numeric(12, 2) not null default 0 check (anticipo >= 0),
  finanziamento boolean not null default false,
  durata_mesi integer check (durata_mesi between 6 and 120),
  tan numeric(5, 2) check (tan between 0 and 30),
  rata numeric(12, 2),
  -- prezzo dell'auto al cliente
  totale numeric(12, 2) generated always as (prezzo - sconto) stored,
  -- quanto resta da pagare (o finanziare) dopo permuta e anticipo
  saldo numeric(12, 2) generated always as (prezzo - sconto - permuta_valutata - anticipo) stored,
  stato public.stato_preventivo not null default 'bozza',
  pdf_path text,
  note text,
  creato_da uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (sconto <= prezzo),
  foreign key (lead_id, organization_id) references public.leads (id, organization_id) on delete cascade,
  foreign key (vehicle_id, organization_id) references public.vehicles (id, organization_id) on delete set null (vehicle_id)
);
create index quotes_lead_idx on public.quotes (lead_id, created_at desc);

-- ---------- Pratiche (vendite chiuse) ----------
create table public.deals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.mia_org() references public.organizations (id) on delete cascade,
  lead_id uuid not null,
  vehicle_id uuid not null,
  contact_id uuid not null,
  venditore_id uuid default auth.uid(),
  prezzo_finale numeric(12, 2) not null check (prezzo_finale >= 0),
  data_vendita date not null default current_date,
  data_consegna date,
  -- ogni voce: 'da_fare' | 'in_corso' | 'fatto'
  checklist jsonb not null default '{
    "contratto": "da_fare",
    "documenti_cliente": "da_fare",
    "finanziamento_approvato": "da_fare",
    "passaggio_proprieta": "da_fare",
    "assicurazione": "da_fare",
    "preparazione_auto": "da_fare",
    "consegna": "da_fare"
  }'::jsonb,
  avanzamento integer generated always as ((
      (checklist ->> 'contratto' = 'fatto')::int
    + (checklist ->> 'documenti_cliente' = 'fatto')::int
    + (checklist ->> 'finanziamento_approvato' = 'fatto')::int
    + (checklist ->> 'passaggio_proprieta' = 'fatto')::int
    + (checklist ->> 'assicurazione' = 'fatto')::int
    + (checklist ->> 'preparazione_auto' = 'fatto')::int
    + (checklist ->> 'consegna' = 'fatto')::int
  ) * 100 / 7) stored,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id),
  unique (id, organization_id),
  foreign key (lead_id, organization_id) references public.leads (id, organization_id) on delete cascade,
  foreign key (vehicle_id, organization_id) references public.vehicles (id, organization_id) on delete restrict,
  foreign key (contact_id, organization_id) references public.contacts (id, organization_id) on delete restrict,
  foreign key (venditore_id, organization_id)
    references public.profiles (user_id, organization_id) on delete set null (venditore_id)
);
create index deals_org_data_idx on public.deals (organization_id, data_vendita desc);
create index deals_contact_idx on public.deals (contact_id);

-- ---------- Documenti ----------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.mia_org() references public.organizations (id) on delete cascade,
  contact_id uuid,
  deal_id uuid,
  tipo public.tipo_documento not null,
  nome_file text not null,
  storage_path text not null unique,
  dimensione_byte bigint,
  caricato_da uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (contact_id is not null or deal_id is not null),
  foreign key (contact_id, organization_id) references public.contacts (id, organization_id) on delete cascade,
  foreign key (deal_id, organization_id) references public.deals (id, organization_id) on delete cascade
);
create index documents_contact_idx on public.documents (contact_id);
create index documents_deal_idx on public.documents (deal_id);

-- ---------- Notifiche, inviti, template, log ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  tipo text not null,
  titolo text not null,
  testo text,
  link text,
  lead_id uuid references public.leads (id) on delete cascade,
  letta_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, letta_at, created_at desc);
create unique index notifications_lead_tipo_uq on public.notifications (lead_id, user_id, tipo) where lead_id is not null;

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.mia_org() references public.organizations (id) on delete cascade,
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  nome text not null,
  ruolo public.ruolo not null check (ruolo <> 'titolare'),
  token uuid not null default gen_random_uuid() unique,
  invitato_da uuid default auth.uid(),
  accettato_at timestamptz,
  scade_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);
create unique index invitations_aperti_uq on public.invitations (organization_id, lower(email)) where accettato_at is null;

create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.mia_org() references public.organizations (id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  canale public.canale_messaggio not null,
  oggetto text,
  testo text not null,
  created_at timestamptz not null default now()
);
create index message_templates_org_idx on public.message_templates (organization_id, canale);

create table public.automations_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  tipo text not null,
  entita text not null,
  entita_id uuid,
  esito public.esito_automazione not null default 'ok',
  dettagli jsonb,
  created_at timestamptz not null default now()
);
create index automations_log_org_idx on public.automations_log (organization_id, created_at desc);

-- =====================================================================
-- Trigger
-- =====================================================================

create or replace function public.tocca_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger vehicles_updated before update on public.vehicles for each row execute function public.tocca_updated_at();
create trigger contacts_updated before update on public.contacts for each row execute function public.tocca_updated_at();
create trigger leads_updated before update on public.leads for each row execute function public.tocca_updated_at();
create trigger deals_updated before update on public.deals for each row execute function public.tocca_updated_at();
create trigger vehicle_costs_updated before update on public.vehicle_costs for each row execute function public.tocca_updated_at();

-- Data dei consensi privacy/marketing: registrata quando il consenso viene dato.
create or replace function public.contacts_consensi()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.consenso_privacy and (tg_op = 'INSERT' or not old.consenso_privacy) then
    new.consenso_privacy_at := coalesce(new.consenso_privacy_at, now());
  elsif not new.consenso_privacy then
    new.consenso_privacy_at := null;
  end if;
  if new.consenso_marketing and (tg_op = 'INSERT' or not old.consenso_marketing) then
    new.consenso_marketing_at := coalesce(new.consenso_marketing_at, now());
  elsif not new.consenso_marketing then
    new.consenso_marketing_at := null;
  end if;
  return new;
end $$;

create trigger contacts_consensi before insert or update on public.contacts
for each row execute function public.contacts_consensi();

-- Storico prezzi: ogni variazione del prezzo di vendita viene registrata.
create or replace function public.vehicles_storico_prezzo()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.prezzo_vendita is distinct from old.prezzo_vendita then
    insert into public.vehicle_price_history (organization_id, vehicle_id, prezzo_precedente, prezzo_nuovo, autore_id)
    values (new.organization_id, new.id,
            case when tg_op = 'UPDATE' then old.prezzo_vendita end,
            new.prezzo_vendita, auth.uid());
  end if;
  return null;
end $$;

create trigger vehicles_storico_prezzo after insert or update of prezzo_vendita on public.vehicles
for each row execute function public.vehicles_storico_prezzo();

-- Punteggio del lead (0-100): quanto è "caldo". Calcolato in automatico.
create or replace function public.calcola_punteggio(l public.leads)
returns integer language plpgsql immutable set search_path = ''
as $$
declare
  p integer := 20;
begin
  if l.stato = 'vinto' then return 100; end if;
  if l.stato = 'perso' then return 0; end if;
  if l.budget is not null then p := p + 10; end if;
  if l.vehicle_id is not null or l.marca_interesse is not null then p := p + 10; end if;
  if l.finanziamento then p := p + 5; end if;
  if l.permuta then p := p + 5; end if;
  p := p + case l.tempistica
    when 'subito' then 20 when 'entro_1_mese' then 15 when 'entro_3_mesi' then 5 else 0 end;
  p := p + case l.stato
    when 'qualificato' then 5 when 'test_drive' then 12 when 'preventivo' then 18 when 'trattativa' then 25 else 0 end;
  return least(p, 99);
end $$;

-- Prima dell'inserimento: assegnazione automatica (round robin) e punteggio.
create or replace function public.leads_prima_di_inserire()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  rr boolean;
  scelto uuid;
begin
  if new.assegnato_a is null then
    if public.mio_ruolo() = 'venditore' then
      -- Il venditore che inserisce un lead (es. cliente in salone) lo tiene per sé.
      new.assegnato_a := auth.uid();
    else
      select o.round_robin_attivo into rr from public.organizations o where o.id = new.organization_id;
      if rr then
        -- Venditore attivo con meno lead aperti; a parità, quello che ne ha ricevuto uno meno di recente.
        select p.user_id into scelto
        from public.profiles p
        left join public.leads l
          on l.assegnato_a = p.user_id and l.stato not in ('vinto', 'perso')
        where p.organization_id = new.organization_id and p.ruolo = 'venditore' and p.attivo
        group by p.user_id
        order by count(l.id),
                 (select max(l2.created_at) from public.leads l2 where l2.assegnato_a = p.user_id) nulls first
        limit 1;

        new.assegnato_a := scelto;
        insert into public.automations_log (organization_id, tipo, entita, entita_id, esito, dettagli)
        values (new.organization_id, 'assegnazione_round_robin', 'lead', new.id,
                case when scelto is null then 'saltato' else 'ok' end::public.esito_automazione,
                case when scelto is null then jsonb_build_object('motivo', 'nessun venditore attivo')
                     else jsonb_build_object('assegnato_a', scelto) end);
      end if;
    end if;
  end if;

  if new.stato in ('vinto', 'perso') then
    new.chiuso_at := coalesce(new.chiuso_at, now());
  end if;
  new.punteggio := public.calcola_punteggio(new);
  return new;
end $$;

create trigger leads_prima_di_inserire before insert on public.leads
for each row execute function public.leads_prima_di_inserire();

create or replace function public.leads_prima_di_aggiornare()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.stato is distinct from old.stato then
    if new.stato in ('vinto', 'perso') then
      new.chiuso_at := now();
    else
      new.chiuso_at := null;
      new.motivo_perso := null;
    end if;
  end if;
  new.punteggio := public.calcola_punteggio(new);
  return new;
end $$;

create trigger leads_prima_di_aggiornare before update on public.leads
for each row execute function public.leads_prima_di_aggiornare();

-- Dopo l'inserimento/aggiornamento: storico cambi di stato e venditore sul contatto.
create or replace function public.leads_dopo()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.stato is distinct from old.stato then
    insert into public.activities (organization_id, lead_id, tipo, contenuto, autore_id)
    values (new.organization_id, new.id, 'cambio_stato',
            old.stato || ' → ' || new.stato
              || case when new.stato = 'perso' then ' (motivo: ' || new.motivo_perso || ')' else '' end,
            auth.uid());
  end if;

  if new.assegnato_a is not null and (tg_op = 'INSERT' or new.assegnato_a is distinct from old.assegnato_a) then
    update public.contacts c set venditore_assegnato = new.assegnato_a
    where c.id = new.contact_id and c.venditore_assegnato is null;
  end if;
  return null;
end $$;

create trigger leads_dopo after insert or update on public.leads
for each row execute function public.leads_dopo();

-- Attività di contatto: aggiornano primo/ultimo contatto e fanno uscire il lead da "nuovo".
create or replace function public.activities_dopo_inserimento()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.tipo in ('chiamata', 'whatsapp', 'email', 'test_drive') then
    update public.leads l set
      primo_contatto_at = coalesce(l.primo_contatto_at, new.created_at),
      ultimo_contatto_at = greatest(coalesce(l.ultimo_contatto_at, new.created_at), new.created_at),
      stato = case when l.stato = 'nuovo' then 'contattato'::public.stato_lead else l.stato end
    where l.id = new.lead_id;
  end if;
  return null;
end $$;

create trigger activities_dopo_inserimento after insert on public.activities
for each row execute function public.activities_dopo_inserimento();

-- Fa avanzare un lead fino a uno stato (mai indietro, mai da vinto/perso).
create or replace function public.avanza_lead(p_lead uuid, p_stato public.stato_lead)
returns void language sql security definer set search_path = ''
as $$
  update public.leads set stato = p_stato where id = p_lead and stato < p_stato and stato not in ('vinto', 'perso')
$$;
revoke execute on function public.avanza_lead(uuid, public.stato_lead) from public, anon, authenticated;

-- Appuntamento su un lead: compare nello storico e diventa la prossima azione;
-- un test drive fa avanzare il lead, una consegna aggiorna la data nella pratica.
create or replace function public.appointments_dopo_inserimento()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.lead_id is not null then
    insert into public.activities (organization_id, lead_id, tipo, contenuto, autore_id)
    values (new.organization_id, new.lead_id, 'nota',
            'Appuntamento fissato: ' || replace(new.tipo::text, '_', ' ') || ' il '
              || to_char(new.inizio at time zone 'Europe/Rome', 'DD/MM/YYYY "alle" HH24:MI'),
            auth.uid());
    update public.leads set
      prossima_azione_at = new.inizio,
      prossima_azione_nota = initcap(replace(new.tipo::text, '_', ' '))
    where id = new.lead_id and (prossima_azione_at is null or prossima_azione_at < now() or prossima_azione_at > new.inizio);
    if new.tipo = 'test_drive' then
      perform public.avanza_lead(new.lead_id, 'test_drive');
    end if;
    -- Consegna fissata in agenda: la data finisce anche nella pratica.
    if new.tipo = 'consegna' then
      update public.deals set data_consegna = (new.inizio at time zone 'Europe/Rome')::date where lead_id = new.lead_id;
    end if;
  end if;
  return null;
end $$;

create trigger appointments_dopo_inserimento after insert on public.appointments
for each row execute function public.appointments_dopo_inserimento();

-- Preventivo creato: storico + avanzamento a "preventivo".
create or replace function public.quotes_dopo_inserimento()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.activities (organization_id, lead_id, tipo, contenuto, autore_id)
  values (new.organization_id, new.lead_id, 'preventivo',
          'Preventivo di ' || translate(to_char(new.totale, 'FM999,999,990.00'), ',.', '.,') || ' €', auth.uid());
  perform public.avanza_lead(new.lead_id, 'preventivo');
  return null;
end $$;

create trigger quotes_dopo_inserimento after insert on public.quotes
for each row execute function public.quotes_dopo_inserimento();

-- Pratica creata: auto venduta, lead vinto, altri lead aperti sulla stessa auto avvisati nello storico.
create or replace function public.deals_dopo_inserimento()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.vehicles set stato = 'venduto', data_uscita = new.data_vendita where id = new.vehicle_id;
  update public.leads set stato = 'vinto', vehicle_id = new.vehicle_id
  where id = new.lead_id and stato <> 'vinto';

  insert into public.activities (organization_id, lead_id, tipo, contenuto)
  select l.organization_id, l.id, 'nota', 'Attenzione: l''auto di interesse è stata venduta a un altro cliente.'
  from public.leads l
  where l.vehicle_id = new.vehicle_id and l.id <> new.lead_id and l.stato not in ('vinto', 'perso');

  insert into public.automations_log (organization_id, tipo, entita, entita_id, dettagli)
  values (new.organization_id, 'vendita_chiusa', 'deal', new.id, jsonb_build_object('vehicle_id', new.vehicle_id));
  return null;
end $$;

create trigger deals_dopo_inserimento after insert on public.deals
for each row execute function public.deals_dopo_inserimento();

-- Contact_id e venditore della pratica sono sempre quelli del lead.
create or replace function public.deals_prima_di_inserire()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  select l.contact_id, coalesce(new.venditore_id, l.assegnato_a)
    into new.contact_id, new.venditore_id
  from public.leads l where l.id = new.lead_id;
  return new;
end $$;

create trigger deals_prima_di_inserire before insert on public.deals
for each row execute function public.deals_prima_di_inserire();

-- =====================================================================
-- Onboarding
-- =====================================================================

-- Chiamata subito dopo la registrazione: crea la concessionaria e rende l'utente titolare.
create or replace function public.crea_organizzazione(
  p_nome_azienda text,
  p_nome_utente text,
  p_piva text default null,
  p_telefono text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  org uuid;
begin
  if uid is null then
    raise exception 'Accesso richiesto' using errcode = '28000';
  end if;
  if exists (select 1 from public.profiles where user_id = uid) then
    raise exception 'Il tuo account è già collegato a una concessionaria' using errcode = 'P0001';
  end if;

  insert into public.organizations (nome, piva, telefono)
  values (trim(p_nome_azienda), nullif(trim(coalesce(p_piva, '')), ''), p_telefono)
  returning id into org;

  insert into public.profiles (user_id, organization_id, nome, email, ruolo, telefono)
  values (uid, org, trim(p_nome_utente), (select u.email from auth.users u where u.id = uid), 'titolare', p_telefono);

  perform public.crea_template_predefiniti(org);
  return org;
end $$;

create or replace function public.crea_template_predefiniti(p_org uuid)
returns void language sql security definer set search_path = ''
as $$
  insert into public.message_templates (organization_id, nome, canale, oggetto, testo) values
  (p_org, 'Primo contatto', 'whatsapp', null,
   'Buongiorno {nome}, sono {venditore} di {azienda}. Ho visto la sua richiesta per {auto}: è ancora disponibile. Quando le farebbe comodo vederla o fare un giro di prova?'),
  (p_org, 'Invito test drive', 'whatsapp', null,
   'Ciao {nome}, la {auto} è pronta per un test drive. Ti va bene passare in salone domani? Dimmi tu l''orario che preferisci.'),
  (p_org, 'Follow-up preventivo', 'whatsapp', null,
   'Buongiorno {nome}, ha avuto modo di guardare il preventivo per la {auto}? Se vuole possiamo rivedere insieme permuta e finanziamento.'),
  (p_org, 'Primo contatto', 'email', 'La sua richiesta per {auto}',
   E'Gentile {nome},\n\ngrazie per l''interesse verso la {auto}. L''auto è disponibile e saremo felici di fargliela vedere dal vivo o di organizzare un test drive.\n\nPuò rispondere a questa email o chiamarmi direttamente.\n\nCordiali saluti,\n{venditore}\n{azienda}');
$$;
revoke execute on function public.crea_template_predefiniti(uuid) from public, anon, authenticated;

-- Utente creato da un invito: il profilo nasce con il ruolo scelto dal titolare.
create or replace function public.gestisci_nuovo_utente()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  inv public.invitations;
begin
  if new.raw_user_meta_data ? 'invito_token' then
    select * into inv from public.invitations i
    where i.token = (new.raw_user_meta_data ->> 'invito_token')::uuid
      and lower(i.email) = lower(new.email)
      and i.accettato_at is null
      and i.scade_at > now();
    if found then
      insert into public.profiles (user_id, organization_id, nome, email, ruolo)
      values (new.id, inv.organization_id, inv.nome, new.email, inv.ruolo)
      on conflict (user_id) do nothing;
      update public.invitations set accettato_at = now() where id = inv.id;
    end if;
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.gestisci_nuovo_utente();

-- =====================================================================
-- Viste (security_invoker: rispettano le policy RLS di chi le interroga)
-- =====================================================================

create view public.vehicles_view with (security_invoker = true) as
select
  v.*,
  (coalesce(v.data_uscita, current_date) - v.data_ingresso) as giorni_giacenza,
  (v.stato <> 'venduto' and (current_date - v.data_ingresso) > o.soglia_giacenza_giorni) as oltre_soglia,
  o.soglia_giacenza_giorni,
  (select ph.storage_path from public.vehicle_photos ph
    where ph.vehicle_id = v.id order by ph.ordine, ph.created_at limit 1) as foto_copertina,
  (select count(*) from public.leads l
    where l.vehicle_id = v.id and l.stato not in ('vinto', 'perso'))::int as lead_aperti
from public.vehicles v
join public.organizations o on o.id = v.organization_id;

create view public.leads_view with (security_invoker = true) as
select
  l.*,
  c.nome as contatto_nome,
  c.cognome as contatto_cognome,
  c.telefono as contatto_telefono,
  c.email as contatto_email,
  v.marca as veicolo_marca,
  v.modello as veicolo_modello,
  v.versione as veicolo_versione,
  v.prezzo_vendita as veicolo_prezzo,
  p.nome as assegnato_nome,
  (l.stato = 'nuovo' and l.primo_contatto_at is null
    and l.created_at < now() - make_interval(mins => o.tempo_max_risposta_min)) as in_ritardo,
  (l.stato not in ('vinto', 'perso') and l.prossima_azione_at is null) as senza_prossima_azione,
  o.tempo_max_risposta_min
from public.leads l
join public.organizations o on o.id = l.organization_id
join public.contacts c on c.id = l.contact_id
left join public.vehicles v on v.id = l.vehicle_id
left join public.profiles p on p.user_id = l.assegnato_a;

-- =====================================================================
-- Funzioni per le schermate
-- =====================================================================

-- Clienti potenzialmente interessati a un'auto: lead aperti, o persi negli ultimi
-- 90 giorni, con marca/modello o budget compatibili.
create or replace function public.clienti_compatibili(p_vehicle uuid)
returns table (
  lead_id uuid,
  contatto text,
  telefono text,
  stato public.stato_lead,
  budget numeric,
  interesse text,
  motivo_perso text,
  motivo_match text
)
language sql stable security invoker set search_path = ''
as $$
  with v as (select * from public.vehicles where id = p_vehicle)
  select
    l.id,
    trim(c.nome || ' ' || c.cognome),
    c.telefono,
    l.stato,
    l.budget,
    coalesce(lv.marca || ' ' || lv.modello, trim(coalesce(l.marca_interesse, '') || ' ' || coalesce(l.modello_interesse, ''))),
    l.motivo_perso,
    concat_ws(' · ',
      case when lower(coalesce(lv.modello, l.modello_interesse, '')) = lower(v.modello) then 'stesso modello'
           when lower(coalesce(lv.marca, l.marca_interesse, '')) = lower(v.marca) then 'stessa marca' end,
      case when l.budget is not null and v.prezzo_vendita is not null
                and v.prezzo_vendita between l.budget * 0.85 and l.budget * 1.10 then 'budget compatibile' end)
  from v
  join public.leads l on l.organization_id = v.organization_id and l.vehicle_id is distinct from v.id
  join public.contacts c on c.id = l.contact_id
  left join public.vehicles lv on lv.id = l.vehicle_id
  where (l.stato not in ('vinto', 'perso')
         or (l.stato = 'perso' and l.chiuso_at > now() - interval '90 days'))
    and (
      lower(coalesce(lv.marca, l.marca_interesse, '')) = lower(v.marca)
      or (l.budget is not null and v.prezzo_vendita is not null
          and v.prezzo_vendita between l.budget * 0.85 and l.budget * 1.10)
    )
  order by
    (lower(coalesce(lv.modello, l.modello_interesse, '')) = lower(v.modello)) desc,
    (lower(coalesce(lv.marca, l.marca_interesse, '')) = lower(v.marca)) desc,
    l.punteggio desc
  limit 20
$$;

-- Numeri per dashboard e report nel periodo [p_da, p_a). Rispetta RLS:
-- il titolare vede tutta l'azienda, il venditore solo i propri lead.
create or replace function public.report_periodo(p_da timestamptz, p_a timestamptz)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with l as (
    select * from public.leads where created_at >= p_da and created_at < p_a
  ),
  vinti as (
    select * from public.leads where stato = 'vinto' and chiuso_at >= p_da and chiuso_at < p_a
  ),
  vendute as (
    select * from public.deals where data_vendita >= p_da::date and data_vendita < p_a::date
  )
  select jsonb_build_object(
    'lead_ricevuti', (select count(*) from l),
    'lead_vinti', (select count(*) from l where stato = 'vinto'),
    'lead_persi', (select count(*) from l where stato = 'perso'),
    'tasso_conversione', (select case when count(*) = 0 then 0
                                  else round(100.0 * count(*) filter (where stato = 'vinto') / count(*), 1) end from l),
    'auto_vendute', (select count(*) from vendute),
    'fatturato', (select coalesce(sum(prezzo_finale), 0) from vendute),
    'tempo_medio_risposta_min', (select round(avg(extract(epoch from (primo_contatto_at - created_at)) / 60)::numeric, 0)
                                 from l where primo_contatto_at is not null),
    'giacenza_media_giorni', (select round(avg(current_date - data_ingresso)::numeric, 0)
                              from public.vehicles where stato <> 'venduto'),
    'per_fonte', (select coalesce(jsonb_agg(x order by x.lead desc), '[]'::jsonb) from (
        select fonte, count(*) as lead, count(*) filter (where stato = 'vinto') as vinti,
               case when count(*) = 0 then 0
                    else round(100.0 * count(*) filter (where stato = 'vinto') / count(*), 1) end as conversione
        from l group by fonte) x),
    'per_venditore', (select coalesce(jsonb_agg(x order by x.vinti desc, x.lead desc), '[]'::jsonb) from (
        select coalesce(p.nome, 'Non assegnato') as venditore, count(*) as lead,
               count(*) filter (where l.stato = 'vinto') as vinti,
               count(*) filter (where l.stato not in ('vinto', 'perso')) as aperti,
               round(avg(extract(epoch from (l.primo_contatto_at - l.created_at)) / 60)::numeric, 0) as risposta_min
        from l left join public.profiles p on p.user_id = l.assegnato_a
        group by p.user_id, p.nome) x),
    'motivi_perso', (select coalesce(jsonb_agg(x order by x.lead desc), '[]'::jsonb) from (
        select motivo_perso as motivo, count(*) as lead from l where stato = 'perso' group by motivo_perso) x),
    'per_mese', (select coalesce(jsonb_agg(x order by x.mese), '[]'::jsonb) from (
        select to_char(date_trunc('month', l.created_at at time zone 'Europe/Rome'), 'YYYY-MM') as mese,
               count(*) as lead,
               count(*) filter (where l.stato = 'vinto') as vinti
        from l group by 1) x),
    'vinti_nel_periodo', (select count(*) from vinti)
  )
$$;

-- Controllo periodico: lead "nuovi" non contattati oltre il tempo massimo di risposta.
-- Notifica in app al venditore assegnato e ai responsabili (o al titolare se non c'è un responsabile).
create or replace function public.controlla_lead_in_ritardo()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  n integer := 0;
  destinatario uuid;
begin
  for r in
    select l.id, l.organization_id, l.assegnato_a, c.nome, c.cognome, o.tempo_max_risposta_min
    from public.leads l
    join public.organizations o on o.id = l.organization_id
    join public.contacts c on c.id = l.contact_id
    where l.stato = 'nuovo' and l.primo_contatto_at is null
      and l.created_at < now() - make_interval(mins => o.tempo_max_risposta_min)
      and l.created_at > now() - interval '7 days'
      and not exists (select 1 from public.notifications nt where nt.lead_id = l.id and nt.tipo = 'lead_in_ritardo')
  loop
    for destinatario in
      select r.assegnato_a where r.assegnato_a is not null
      union
      select p.user_id from public.profiles p
      where p.organization_id = r.organization_id and p.attivo and p.ruolo = 'responsabile_vendite'
      union
      select p.user_id from public.profiles p
      where p.organization_id = r.organization_id and p.attivo and p.ruolo = 'titolare'
        and not exists (select 1 from public.profiles q where q.organization_id = r.organization_id
                        and q.attivo and q.ruolo = 'responsabile_vendite')
    loop
      insert into public.notifications (organization_id, user_id, tipo, titolo, testo, link, lead_id)
      values (r.organization_id, destinatario, 'lead_in_ritardo',
              'Lead da contattare subito',
              trim(r.nome || ' ' || r.cognome) || ' aspetta da più di ' || r.tempo_max_risposta_min || ' minuti',
              '/lead/' || r.id, r.id)
      on conflict do nothing;
    end loop;

    insert into public.automations_log (organization_id, tipo, entita, entita_id)
    values (r.organization_id, 'notifica_lead_in_ritardo', 'lead', r.id);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.controlla_lead_in_ritardo() from public, anon, authenticated;

-- Per la sessione corrente: segna tutte le notifiche come lette.
create or replace function public.segna_notifiche_lette()
returns void language sql security invoker set search_path = ''
as $$
  update public.notifications set letta_at = now() where user_id = auth.uid() and letta_at is null
$$;

-- =====================================================================
-- Row Level Security
-- =====================================================================

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.vehicle_costs enable row level security;
alter table public.vehicle_photos enable row level security;
alter table public.vehicle_price_history enable row level security;
alter table public.contacts enable row level security;
alter table public.leads enable row level security;
alter table public.activities enable row level security;
alter table public.appointments enable row level security;
alter table public.quotes enable row level security;
alter table public.deals enable row level security;
alter table public.documents enable row level security;
alter table public.notifications enable row level security;
alter table public.invitations enable row level security;
alter table public.message_templates enable row level security;
alter table public.automations_log enable row level security;

-- organizations
create policy "org: lettura" on public.organizations for select to authenticated
  using (id = (select public.mia_org()));
create policy "org: modifica titolare" on public.organizations for update to authenticated
  using (id = (select public.mia_org()) and (select public.ha_ruolo('titolare')))
  with check (id = (select public.mia_org()));

-- profiles: tutti vedono i colleghi; solo il titolare gestisce ruoli e attivazione.
create policy "profili: lettura" on public.profiles for select to authenticated
  using (organization_id = (select public.mia_org()) or user_id = (select auth.uid()));
create policy "profili: modifica titolare" on public.profiles for update to authenticated
  using (organization_id = (select public.mia_org()) and (select public.ha_ruolo('titolare')))
  with check (organization_id = (select public.mia_org()));
create policy "profili: modifica propri dati" on public.profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and ruolo = (select public.mio_ruolo()) and attivo);

-- vehicles: tutti leggono lo stock; titolare e responsabile lo gestiscono.
create policy "veicoli: lettura" on public.vehicles for select to authenticated
  using (organization_id = (select public.mia_org()));
create policy "veicoli: inserimento" on public.vehicles for insert to authenticated
  with check (organization_id = (select public.mia_org()) and (select public.e_manager()));
create policy "veicoli: modifica" on public.vehicles for update to authenticated
  using (organization_id = (select public.mia_org()) and (select public.e_manager()))
  with check (organization_id = (select public.mia_org()));
create policy "veicoli: eliminazione" on public.vehicles for delete to authenticated
  using (organization_id = (select public.mia_org()) and (select public.ha_ruolo('titolare')));

create policy "costi: solo manager" on public.vehicle_costs for all to authenticated
  using (organization_id = (select public.mia_org()) and (select public.e_manager()))
  with check (organization_id = (select public.mia_org()) and (select public.e_manager()));

create policy "foto: lettura" on public.vehicle_photos for select to authenticated
  using (organization_id = (select public.mia_org()));
create policy "foto: inserimento" on public.vehicle_photos for insert to authenticated
  with check (organization_id = (select public.mia_org()) and not (select public.ha_ruolo('amministrazione')));
create policy "foto: modifica" on public.vehicle_photos for update to authenticated
  using (organization_id = (select public.mia_org()) and not (select public.ha_ruolo('amministrazione')))
  with check (organization_id = (select public.mia_org()));
create policy "foto: eliminazione" on public.vehicle_photos for delete to authenticated
  using (organization_id = (select public.mia_org()) and not (select public.ha_ruolo('amministrazione')));

create policy "storico prezzi: lettura" on public.vehicle_price_history for select to authenticated
  using (organization_id = (select public.mia_org()));

-- leads: il venditore vede e lavora solo i propri.
create policy "lead: lettura" on public.leads for select to authenticated
  using (organization_id = (select public.mia_org())
         and ((select public.ha_ruolo('titolare', 'responsabile_vendite', 'amministrazione'))
              or assegnato_a = (select auth.uid())));
create policy "lead: inserimento" on public.leads for insert to authenticated
  with check (organization_id = (select public.mia_org()) and not (select public.ha_ruolo('amministrazione')));
create policy "lead: modifica" on public.leads for update to authenticated
  using (organization_id = (select public.mia_org())
         and ((select public.e_manager()) or assegnato_a = (select auth.uid())))
  with check (organization_id = (select public.mia_org())
              and ((select public.e_manager()) or assegnato_a = (select auth.uid())));
create policy "lead: eliminazione" on public.leads for delete to authenticated
  using (organization_id = (select public.mia_org()) and (select public.ha_ruolo('titolare')));

-- contacts
create policy "contatti: lettura" on public.contacts for select to authenticated
  using (organization_id = (select public.mia_org())
         and ((select public.ha_ruolo('titolare', 'responsabile_vendite', 'amministrazione'))
              or venditore_assegnato = (select auth.uid())
              or exists (select 1 from public.leads l
                         where l.contact_id = contacts.id and l.assegnato_a = (select auth.uid()))));
create policy "contatti: inserimento" on public.contacts for insert to authenticated
  with check (organization_id = (select public.mia_org()) and not (select public.ha_ruolo('amministrazione')));
create policy "contatti: modifica" on public.contacts for update to authenticated
  using (organization_id = (select public.mia_org())
         and ((select public.e_manager())
              or venditore_assegnato = (select auth.uid())
              or exists (select 1 from public.leads l
                         where l.contact_id = contacts.id and l.assegnato_a = (select auth.uid()))))
  with check (organization_id = (select public.mia_org()));
create policy "contatti: eliminazione" on public.contacts for delete to authenticated
  using (organization_id = (select public.mia_org()) and (select public.ha_ruolo('titolare')));

-- activities: si leggono e si aggiungono sui lead visibili. Niente modifica né cancellazione.
create policy "attività: lettura" on public.activities for select to authenticated
  using (organization_id = (select public.mia_org())
         and exists (select 1 from public.leads l where l.id = activities.lead_id));
create policy "attività: inserimento" on public.activities for insert to authenticated
  with check (organization_id = (select public.mia_org())
              and autore_id = (select auth.uid())
              and tipo <> 'cambio_stato'
              and not (select public.ha_ruolo('amministrazione'))
              and exists (select 1 from public.leads l where l.id = activities.lead_id));

-- appointments
create policy "appuntamenti: lettura" on public.appointments for select to authenticated
  using (organization_id = (select public.mia_org())
         and ((select public.ha_ruolo('titolare', 'responsabile_vendite', 'amministrazione'))
              or assegnato_a = (select auth.uid())));
create policy "appuntamenti: inserimento" on public.appointments for insert to authenticated
  with check (organization_id = (select public.mia_org())
              and ((select public.e_manager()) or assegnato_a = (select auth.uid())));
create policy "appuntamenti: modifica" on public.appointments for update to authenticated
  using (organization_id = (select public.mia_org())
         and ((select public.e_manager()) or assegnato_a = (select auth.uid())))
  with check (organization_id = (select public.mia_org())
              and ((select public.e_manager()) or assegnato_a = (select auth.uid())));
create policy "appuntamenti: eliminazione" on public.appointments for delete to authenticated
  using (organization_id = (select public.mia_org())
         and ((select public.e_manager()) or assegnato_a = (select auth.uid())));

-- quotes: seguono la visibilità del lead.
create policy "preventivi: lettura" on public.quotes for select to authenticated
  using (organization_id = (select public.mia_org())
         and exists (select 1 from public.leads l where l.id = quotes.lead_id));
create policy "preventivi: inserimento" on public.quotes for insert to authenticated
  with check (organization_id = (select public.mia_org())
              and not (select public.ha_ruolo('amministrazione'))
              and exists (select 1 from public.leads l where l.id = quotes.lead_id));
create policy "preventivi: modifica" on public.quotes for update to authenticated
  using (organization_id = (select public.mia_org())
         and not (select public.ha_ruolo('amministrazione'))
         and exists (select 1 from public.leads l where l.id = quotes.lead_id))
  with check (organization_id = (select public.mia_org()));

-- deals: il venditore chiude la vendita dei propri lead e la consulta; amministrazione e manager la gestiscono.
create policy "pratiche: lettura" on public.deals for select to authenticated
  using (organization_id = (select public.mia_org())
         and ((select public.ha_ruolo('titolare', 'responsabile_vendite', 'amministrazione'))
              or venditore_id = (select auth.uid())));
create policy "pratiche: inserimento" on public.deals for insert to authenticated
  with check (organization_id = (select public.mia_org())
              and not (select public.ha_ruolo('amministrazione'))
              and exists (select 1 from public.leads l where l.id = deals.lead_id));
create policy "pratiche: modifica" on public.deals for update to authenticated
  using (organization_id = (select public.mia_org())
         and (select public.ha_ruolo('titolare', 'responsabile_vendite', 'amministrazione')))
  with check (organization_id = (select public.mia_org()));
create policy "pratiche: eliminazione" on public.deals for delete to authenticated
  using (organization_id = (select public.mia_org()) and (select public.ha_ruolo('titolare')));

-- documents
create policy "documenti: lettura" on public.documents for select to authenticated
  using (organization_id = (select public.mia_org())
         and ((select public.ha_ruolo('titolare', 'responsabile_vendite', 'amministrazione'))
              or exists (select 1 from public.deals d where d.id = documents.deal_id)
              or exists (select 1 from public.contacts c where c.id = documents.contact_id)));
create policy "documenti: inserimento" on public.documents for insert to authenticated
  with check (organization_id = (select public.mia_org())
              and caricato_da = (select auth.uid())
              and ((select public.ha_ruolo('titolare', 'responsabile_vendite', 'amministrazione'))
                   or exists (select 1 from public.deals d where d.id = documents.deal_id)
                   or exists (select 1 from public.contacts c where c.id = documents.contact_id)));
create policy "documenti: eliminazione" on public.documents for delete to authenticated
  using (organization_id = (select public.mia_org())
         and (select public.ha_ruolo('titolare', 'responsabile_vendite', 'amministrazione')));

-- notifications: ognuno vede e segna come lette solo le proprie.
create policy "notifiche: lettura" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "notifiche: segna letta" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- invitations: solo il titolare.
create policy "inviti: titolare" on public.invitations for all to authenticated
  using (organization_id = (select public.mia_org()) and (select public.ha_ruolo('titolare')))
  with check (organization_id = (select public.mia_org()) and (select public.ha_ruolo('titolare')));

-- message_templates
create policy "template: lettura" on public.message_templates for select to authenticated
  using (organization_id = (select public.mia_org()));
create policy "template: gestione" on public.message_templates for all to authenticated
  using (organization_id = (select public.mia_org()) and (select public.e_manager()))
  with check (organization_id = (select public.mia_org()) and (select public.e_manager()));

-- automations_log: in sola lettura per i manager; scrivono solo i trigger.
create policy "log automazioni: lettura" on public.automations_log for select to authenticated
  using (organization_id = (select public.mia_org()) and (select public.e_manager()));

-- =====================================================================
-- Storage: file organizzati per cartella {organization_id}/...
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('vehicle-photos', 'vehicle-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('documents', 'documents', false, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy "foto auto: lettura" on storage.objects for select to authenticated
  using (bucket_id = 'vehicle-photos' and (storage.foldername(name))[1] = (select public.mia_org())::text);
create policy "foto auto: caricamento" on storage.objects for insert to authenticated
  with check (bucket_id = 'vehicle-photos' and (storage.foldername(name))[1] = (select public.mia_org())::text
              and not (select public.ha_ruolo('amministrazione')));
create policy "foto auto: eliminazione" on storage.objects for delete to authenticated
  using (bucket_id = 'vehicle-photos' and (storage.foldername(name))[1] = (select public.mia_org())::text
         and not (select public.ha_ruolo('amministrazione')));

-- Documenti: si scaricano solo se la riga in public.documents è visibile (stesse regole RLS),
-- i PDF dei preventivi se il preventivo è visibile.
create policy "documenti: download" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select public.mia_org())::text
         and (exists (select 1 from public.documents d where d.storage_path = objects.name)
              or exists (select 1 from public.quotes q where q.pdf_path = objects.name)));
create policy "documenti: caricamento" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select public.mia_org())::text);
create policy "documenti: eliminazione file" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select public.mia_org())::text
         and (select public.ha_ruolo('titolare', 'responsabile_vendite', 'amministrazione')));

-- =====================================================================
-- Pianificazione: controllo lead in ritardo ogni 5 minuti (pg_cron)
-- =====================================================================
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('sorpasso-lead-in-ritardo', '*/5 * * * *', 'select public.controlla_lead_in_ritardo()');
  else
    raise notice 'pg_cron non disponibile: pianifica public.controlla_lead_in_ritardo() altrove';
  end if;
end $$;
