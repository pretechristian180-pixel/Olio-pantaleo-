-- =====================================================================
-- Casalista – schema iniziale multi-agenzia
-- Ogni tabella operativa ha agency_id; RLS attiva su tutte le tabelle.
-- Le chiavi esterne composte (id, agency_id) impediscono di collegare
-- righe di agenzie diverse (es. una trattativa a un contatto di un'altra agenzia).
-- =====================================================================

-- ---------- Tipi ----------
create type public.piano_agenzia as enum ('start', 'pro', 'elite');
create type public.ruolo_utente as enum ('titolare', 'agente');
create type public.tipo_immobile as enum ('appartamento', 'villa', 'locale', 'terreno', 'altro');
create type public.tipo_contratto as enum ('vendita', 'affitto');
create type public.stato_immobile as enum ('disponibile', 'in_trattativa', 'venduto', 'affittato', 'ritirato');
create type public.tipo_contatto as enum ('acquirente', 'proprietario', 'entrambi');
create type public.temperatura_contatto as enum ('caldo', 'tiepido', 'freddo');
create type public.fonte_contatto as enum ('portale', 'sito', 'passaparola', 'social', 'altro');
create type public.fase_trattativa as enum ('nuovo', 'visita', 'proposta', 'compromesso', 'rogito', 'persa');
create type public.tipo_appuntamento as enum ('visita', 'valutazione', 'firma', 'altro');
create type public.tipo_attivita as enum ('chiamata', 'whatsapp', 'email', 'visita', 'nota', 'cambio_fase');
create type public.origine_task as enum ('manuale', 'automatica');

-- ---------- Tabelle ----------
create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  logo_url text,
  telefono text,
  email text,
  indirizzo text,
  piano public.piano_agenzia not null default 'start',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  agency_id uuid not null references public.agencies (id) on delete cascade,
  nome text not null default '',
  cognome text not null default '',
  telefono text,
  ruolo public.ruolo_utente not null default 'agente',
  avatar_url text,
  attivo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, agency_id)
);

-- Funzioni di accesso: definite qui perché servono come valori predefiniti delle colonne.
create or replace function public.get_my_agency_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.agency_id from public.profiles p where p.id = (select auth.uid()) and p.attivo
$$;

create or replace function public.is_titolare()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.attivo and p.ruolo = 'titolare'
  )
$$;

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.get_my_agency_id() references public.agencies (id) on delete cascade,
  agente_id uuid default auth.uid(),
  nome text not null check (length(trim(nome)) > 0),
  cognome text not null default '',
  telefono text,
  email text,
  tipo public.tipo_contatto not null default 'acquirente',
  temperatura public.temperatura_contatto not null default 'tiepido',
  fonte public.fonte_contatto,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, agency_id),
  foreign key (agente_id, agency_id) references public.profiles (id, agency_id) on delete set null (agente_id)
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.get_my_agency_id() references public.agencies (id) on delete cascade,
  agente_id uuid default auth.uid(),
  owner_id uuid,
  titolo text not null,
  descrizione text,
  tipo public.tipo_immobile not null default 'appartamento',
  contratto public.tipo_contratto not null default 'vendita',
  prezzo numeric(12, 2) not null check (prezzo >= 0),
  mq integer check (mq > 0),
  locali integer check (locali >= 0),
  bagni integer check (bagni >= 0),
  piano text,
  indirizzo text not null,
  citta text not null,
  zona text,
  stato public.stato_immobile not null default 'disponibile',
  classe_energetica text,
  data_incarico date,
  scadenza_incarico date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, agency_id),
  foreign key (agente_id, agency_id) references public.profiles (id, agency_id) on delete set null (agente_id),
  foreign key (owner_id, agency_id) references public.contacts (id, agency_id) on delete set null (owner_id)
);

create table public.property_photos (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.get_my_agency_id() references public.agencies (id) on delete cascade,
  property_id uuid not null,
  url text not null,
  ordine integer not null default 0,
  foreign key (property_id, agency_id) references public.properties (id, agency_id) on delete cascade
);

create table public.search_criteria (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.get_my_agency_id() references public.agencies (id) on delete cascade,
  contact_id uuid not null unique,
  contratto public.tipo_contratto,
  tipo public.tipo_immobile,
  zone text[] not null default '{}',
  budget_min numeric(12, 2),
  budget_max numeric(12, 2),
  mq_min integer,
  locali_min integer,
  foreign key (contact_id, agency_id) references public.contacts (id, agency_id) on delete cascade
);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.get_my_agency_id() references public.agencies (id) on delete cascade,
  agente_id uuid default auth.uid(),
  contact_id uuid not null,
  property_id uuid,
  fase public.fase_trattativa not null default 'nuovo',
  valore numeric(12, 2),
  provvigione_prevista numeric(12, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, agency_id),
  foreign key (agente_id, agency_id) references public.profiles (id, agency_id) on delete set null (agente_id),
  foreign key (contact_id, agency_id) references public.contacts (id, agency_id) on delete cascade,
  foreign key (property_id, agency_id) references public.properties (id, agency_id) on delete set null (property_id)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.get_my_agency_id() references public.agencies (id) on delete cascade,
  agente_id uuid default auth.uid(),
  contact_id uuid,
  property_id uuid,
  tipo public.tipo_appuntamento not null default 'visita',
  inizio timestamptz not null,
  fine timestamptz not null,
  esito text,
  note text,
  check (fine > inizio),
  foreign key (agente_id, agency_id) references public.profiles (id, agency_id) on delete set null (agente_id),
  foreign key (contact_id, agency_id) references public.contacts (id, agency_id) on delete cascade,
  foreign key (property_id, agency_id) references public.properties (id, agency_id) on delete set null (property_id)
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.get_my_agency_id() references public.agencies (id) on delete cascade,
  utente_id uuid default auth.uid(),
  contact_id uuid,
  property_id uuid,
  deal_id uuid,
  tipo public.tipo_attivita not null,
  descrizione text not null,
  created_at timestamptz not null default now(),
  foreign key (utente_id, agency_id) references public.profiles (id, agency_id) on delete set null (utente_id),
  foreign key (contact_id, agency_id) references public.contacts (id, agency_id) on delete cascade,
  foreign key (property_id, agency_id) references public.properties (id, agency_id) on delete set null (property_id),
  foreign key (deal_id, agency_id) references public.deals (id, agency_id) on delete set null (deal_id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.get_my_agency_id() references public.agencies (id) on delete cascade,
  assegnato_a uuid default auth.uid(),
  contact_id uuid,
  property_id uuid,
  titolo text not null,
  scadenza date,
  completato boolean not null default false,
  origine public.origine_task not null default 'manuale',
  created_at timestamptz not null default now(),
  foreign key (assegnato_a, agency_id) references public.profiles (id, agency_id) on delete set null (assegnato_a),
  foreign key (contact_id, agency_id) references public.contacts (id, agency_id) on delete cascade,
  foreign key (property_id, agency_id) references public.properties (id, agency_id) on delete set null (property_id)
);

-- Inviti agli agenti: li crea la funzione "invita-agente" (solo titolare).
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  email text not null,
  nome text,
  cognome text,
  invitato_da uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (agency_id, email)
);

-- ---------- Indici ----------
create index on public.profiles (agency_id);
create index on public.contacts (agency_id, tipo);
create index on public.contacts (agency_id, temperatura);
create index on public.contacts (agency_id, created_at desc);
create index on public.contacts (agente_id);
create index on public.properties (agency_id, stato);
create index on public.properties (agency_id, contratto);
create index on public.properties (agency_id, zona);
create index on public.properties (agency_id, scadenza_incarico);
create index on public.properties (agente_id);
create index on public.properties (owner_id);
create index on public.property_photos (agency_id);
create index on public.property_photos (property_id, ordine);
create index on public.search_criteria (agency_id);
create index on public.deals (agency_id, fase);
create index on public.deals (agente_id);
create index on public.deals (contact_id);
create index on public.deals (property_id);
create index on public.appointments (agency_id, inizio);
create index on public.appointments (agente_id);
create index on public.appointments (contact_id);
create index on public.appointments (property_id);
create index on public.activities (agency_id, created_at desc);
create index on public.activities (contact_id, created_at desc);
create index on public.activities (property_id);
create index on public.activities (deal_id);
create index on public.activities (utente_id);
create index on public.tasks (agency_id, scadenza);
create index on public.tasks (assegnato_a, completato);
create index on public.tasks (contact_id);
create index on public.tasks (property_id);
create index on public.invitations (agency_id);
create index on public.invitations (lower(email));

-- ---------- updated_at automatico ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger contacts_updated_at before update on public.contacts for each row execute function public.set_updated_at();
create trigger properties_updated_at before update on public.properties for each row execute function public.set_updated_at();
create trigger deals_updated_at before update on public.deals for each row execute function public.set_updated_at();

-- ---------- Funzioni di supporto per le policy ----------
create or replace function public.can_edit_property(pid uuid)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.properties p
    where p.id = pid
      and p.agency_id = public.get_my_agency_id()
      and (public.is_titolare() or p.agente_id = (select auth.uid()))
  )
$$;

create or replace function public.can_edit_contact(cid uuid)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.contacts c
    where c.id = cid
      and c.agency_id = public.get_my_agency_id()
      and (public.is_titolare() or c.agente_id = (select auth.uid()))
  )
$$;

-- ---------- Row Level Security ----------
alter table public.agencies enable row level security;
alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.properties enable row level security;
alter table public.property_photos enable row level security;
alter table public.search_criteria enable row level security;
alter table public.deals enable row level security;
alter table public.appointments enable row level security;
alter table public.activities enable row level security;
alter table public.tasks enable row level security;
alter table public.invitations enable row level security;

-- agencies: si vede solo la propria; solo il titolare la modifica.
-- La creazione avviene alla registrazione (trigger), l'eliminazione non è permessa.
create policy "agenzia: lettura propria" on public.agencies
  for select to authenticated using (id = (select public.get_my_agency_id()));
create policy "agenzia: modifica solo titolare" on public.agencies
  for update to authenticated
  using (id = (select public.get_my_agency_id()) and (select public.is_titolare()))
  with check (id = (select public.get_my_agency_id()));

-- profiles: si vedono i colleghi della stessa agenzia.
-- Ognuno modifica il proprio profilo; il titolare modifica quelli della sua agenzia.
create policy "profili: lettura agenzia" on public.profiles
  for select to authenticated using (agency_id = (select public.get_my_agency_id()));
create policy "profili: modifica propria o titolare" on public.profiles
  for update to authenticated
  using (agency_id = (select public.get_my_agency_id()) and (id = (select auth.uid()) or (select public.is_titolare())))
  with check (agency_id = (select public.get_my_agency_id()));

-- Macro per le tabelle con agente_id: lettura per tutta l'agenzia,
-- scrittura solo per il titolare o per l'agente assegnato.
do $$
declare t text;
begin
  foreach t in array array['properties', 'contacts', 'deals', 'appointments'] loop
    execute format($f$
      create policy "%1$s: lettura agenzia" on public.%1$I
        for select to authenticated using (agency_id = (select public.get_my_agency_id()));
      create policy "%1$s: inserimento" on public.%1$I
        for insert to authenticated
        with check (agency_id = (select public.get_my_agency_id())
          and ((select public.is_titolare()) or agente_id = (select auth.uid())));
      create policy "%1$s: modifica titolare o assegnato" on public.%1$I
        for update to authenticated
        using (agency_id = (select public.get_my_agency_id())
          and ((select public.is_titolare()) or agente_id = (select auth.uid())))
        with check (agency_id = (select public.get_my_agency_id())
          and ((select public.is_titolare()) or agente_id = (select auth.uid())));
      create policy "%1$s: eliminazione titolare o assegnato" on public.%1$I
        for delete to authenticated
        using (agency_id = (select public.get_my_agency_id())
          and ((select public.is_titolare()) or agente_id = (select auth.uid())));
    $f$, t);
  end loop;
end $$;

-- property_photos: seguono i permessi dell'immobile.
create policy "foto: lettura agenzia" on public.property_photos
  for select to authenticated using (agency_id = (select public.get_my_agency_id()));
create policy "foto: inserimento se modifica immobile" on public.property_photos
  for insert to authenticated
  with check (agency_id = (select public.get_my_agency_id()) and public.can_edit_property(property_id));
create policy "foto: modifica se modifica immobile" on public.property_photos
  for update to authenticated
  using (agency_id = (select public.get_my_agency_id()) and public.can_edit_property(property_id))
  with check (agency_id = (select public.get_my_agency_id()) and public.can_edit_property(property_id));
create policy "foto: eliminazione se modifica immobile" on public.property_photos
  for delete to authenticated
  using (agency_id = (select public.get_my_agency_id()) and public.can_edit_property(property_id));

-- search_criteria: seguono i permessi del contatto.
create policy "ricerche: lettura agenzia" on public.search_criteria
  for select to authenticated using (agency_id = (select public.get_my_agency_id()));
create policy "ricerche: inserimento se modifica contatto" on public.search_criteria
  for insert to authenticated
  with check (agency_id = (select public.get_my_agency_id()) and public.can_edit_contact(contact_id));
create policy "ricerche: modifica se modifica contatto" on public.search_criteria
  for update to authenticated
  using (agency_id = (select public.get_my_agency_id()) and public.can_edit_contact(contact_id))
  with check (agency_id = (select public.get_my_agency_id()) and public.can_edit_contact(contact_id));
create policy "ricerche: eliminazione se modifica contatto" on public.search_criteria
  for delete to authenticated
  using (agency_id = (select public.get_my_agency_id()) and public.can_edit_contact(contact_id));

-- activities: tutta l'agenzia legge la cronologia; ognuno scrive a proprio nome.
create policy "attivita: lettura agenzia" on public.activities
  for select to authenticated using (agency_id = (select public.get_my_agency_id()));
create policy "attivita: inserimento a proprio nome" on public.activities
  for insert to authenticated
  with check (agency_id = (select public.get_my_agency_id()) and utente_id = (select auth.uid()));
create policy "attivita: modifica autore o titolare" on public.activities
  for update to authenticated
  using (agency_id = (select public.get_my_agency_id()) and ((select public.is_titolare()) or utente_id = (select auth.uid())))
  with check (agency_id = (select public.get_my_agency_id()));
create policy "attivita: eliminazione autore o titolare" on public.activities
  for delete to authenticated
  using (agency_id = (select public.get_my_agency_id()) and ((select public.is_titolare()) or utente_id = (select auth.uid())));

-- tasks: l'agente vede e gestisce le proprie cose da fare, il titolare tutte.
do $$
begin
  create policy "task: lettura propri o titolare" on public.tasks
    for select to authenticated
    using (agency_id = (select public.get_my_agency_id()) and ((select public.is_titolare()) or assegnato_a = (select auth.uid())));
  create policy "task: inserimento" on public.tasks
    for insert to authenticated
    with check (agency_id = (select public.get_my_agency_id()) and ((select public.is_titolare()) or assegnato_a = (select auth.uid())));
  create policy "task: modifica propri o titolare" on public.tasks
    for update to authenticated
    using (agency_id = (select public.get_my_agency_id()) and ((select public.is_titolare()) or assegnato_a = (select auth.uid())))
    with check (agency_id = (select public.get_my_agency_id()) and ((select public.is_titolare()) or assegnato_a = (select auth.uid())));
  create policy "task: eliminazione propri o titolare" on public.tasks
    for delete to authenticated
    using (agency_id = (select public.get_my_agency_id()) and ((select public.is_titolare()) or assegnato_a = (select auth.uid())));
end $$;

-- invitations: solo il titolare le vede e le annulla (le crea la Edge Function).
create policy "inviti: lettura titolare" on public.invitations
  for select to authenticated
  using (agency_id = (select public.get_my_agency_id()) and (select public.is_titolare()));
create policy "inviti: eliminazione titolare" on public.invitations
  for delete to authenticated
  using (agency_id = (select public.get_my_agency_id()) and (select public.is_titolare()));

-- ---------- Permessi sulle colonne ----------
-- Nessun accesso per gli utenti non autenticati.
revoke all on all tables in schema public from anon;
-- Il piano dell'agenzia non è modificabile dall'app; agency_id e id mai.
revoke update on public.agencies from authenticated;
grant update (nome, logo_url, telefono, email, indirizzo) on public.agencies to authenticated;
revoke insert, delete on public.agencies from authenticated;
revoke update on public.profiles from authenticated;
grant update (nome, cognome, telefono, avatar_url, ruolo, attivo) on public.profiles to authenticated;
revoke insert, delete on public.profiles from authenticated;
revoke insert, update on public.invitations from authenticated;

-- Ruolo e stato attivo li cambia solo il titolare, e mai su se stesso (per non chiudersi fuori).
create or replace function public.guard_profile_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.ruolo is distinct from old.ruolo or new.attivo is distinct from old.attivo) then
    if not public.is_titolare() then
      raise exception 'Solo il titolare può cambiare ruolo o stato di un utente';
    end if;
    if new.id = (select auth.uid()) then
      raise exception 'Non puoi cambiare il tuo ruolo o disattivarti';
    end if;
  end if;
  return new;
end $$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ---------- Registrazione: nuova agenzia o agente invitato ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  inv public.invitations;
  new_agency uuid;
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  select * into inv from public.invitations i
  where lower(i.email) = lower(new.email) and i.accepted_at is null
  order by i.created_at desc limit 1;

  if found then
    insert into public.profiles (id, agency_id, nome, cognome, ruolo)
    values (new.id, inv.agency_id, coalesce(inv.nome, ''), coalesce(inv.cognome, ''), 'agente');
  else
    insert into public.agencies (nome, email)
    values (coalesce(nullif(trim(meta ->> 'agency_name'), ''), 'La mia agenzia'), new.email)
    returning id into new_agency;
    insert into public.profiles (id, agency_id, nome, cognome, ruolo)
    values (new.id, new_agency, coalesce(trim(meta ->> 'nome'), ''), coalesce(trim(meta ->> 'cognome'), ''), 'titolare');
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- L'agente invitato, dopo aver impostato la password, segna l'invito come accettato.
create or replace function public.accept_my_invitation()
returns void language sql security definer set search_path = '' as $$
  update public.invitations
  set accepted_at = now()
  where lower(email) = lower((select auth.jwt() ->> 'email'))
    and accepted_at is null
    and agency_id = public.get_my_agency_id()
$$;

-- ---------- Automatismi: cronologia e cose da fare ----------
create or replace function public.fase_label(f public.fase_trattativa)
returns text language sql immutable set search_path = '' as $$
  select case f
    when 'nuovo' then 'Nuovo contatto'
    when 'visita' then 'Visita fatta'
    when 'proposta' then 'Proposta'
    when 'compromesso' then 'Compromesso'
    when 'rogito' then 'Rogito'
    when 'persa' then 'Persa'
  end
$$;

create or replace function public.log_deal_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  c public.contacts;
  indirizzo text;
begin
  if tg_op = 'INSERT' then
    insert into public.activities (agency_id, utente_id, contact_id, property_id, deal_id, tipo, descrizione)
    values (new.agency_id, auth.uid(), new.contact_id, new.property_id, new.id, 'nota', 'Aperta una nuova trattativa');
    return new;
  end if;

  if new.fase is distinct from old.fase then
    insert into public.activities (agency_id, utente_id, contact_id, property_id, deal_id, tipo, descrizione)
    values (new.agency_id, auth.uid(), new.contact_id, new.property_id, new.id, 'cambio_fase',
            format('Trattativa spostata da "%s" a "%s"', public.fase_label(old.fase), public.fase_label(new.fase)));

    -- Dopo una visita: promemoria automatico per richiamare il cliente il giorno dopo
    if new.fase = 'visita' then
      select * into c from public.contacts where id = new.contact_id;
      select p.indirizzo into indirizzo from public.properties p where p.id = new.property_id;
      insert into public.tasks (agency_id, assegnato_a, contact_id, property_id, titolo, scadenza, origine)
      values (new.agency_id, coalesce(new.agente_id, auth.uid()), new.contact_id, new.property_id,
              trim(format('Richiama %s %s', c.nome, c.cognome))
                || coalesce(format(', ha visto l''immobile in %s', indirizzo), ''),
              (now() at time zone 'Europe/Rome')::date + 1, 'automatica');
    end if;
  end if;
  return new;
end $$;

create trigger deals_log after insert or update on public.deals
  for each row execute function public.log_deal_change();

create or replace function public.log_new_appointment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.contact_id is not null then
    insert into public.activities (agency_id, utente_id, contact_id, property_id, tipo, descrizione)
    values (new.agency_id, auth.uid(), new.contact_id, new.property_id, 'nota',
            format('Fissato appuntamento (%s) il %s',
                   new.tipo, to_char(new.inizio at time zone 'Europe/Rome', 'DD/MM/YYYY "alle" HH24:MI')));
  end if;
  return new;
end $$;

create trigger appointments_log after insert on public.appointments
  for each row execute function public.log_new_appointment();

create or replace function public.on_new_contact()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.activities (agency_id, utente_id, contact_id, tipo, descrizione)
  values (new.agency_id, auth.uid(), new.id, 'nota', 'Contatto aggiunto');

  -- Nuovo acquirente: promemoria automatico per chiamarlo oggi
  if new.tipo in ('acquirente', 'entrambi') then
    insert into public.tasks (agency_id, assegnato_a, contact_id, titolo, scadenza, origine)
    values (new.agency_id, coalesce(new.agente_id, auth.uid()), new.id,
            trim(format('Chiama %s %s', new.nome, new.cognome))
              || coalesce(format(', nuovo contatto da %s', new.fonte), ''),
            (now() at time zone 'Europe/Rome')::date, 'automatica');
  end if;
  return new;
end $$;

create trigger contacts_new after insert on public.contacts
  for each row execute function public.on_new_contact();

create or replace function public.on_new_property()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.activities (agency_id, utente_id, contact_id, property_id, tipo, descrizione)
  values (new.agency_id, auth.uid(), new.owner_id, new.id, 'nota',
          format('Nuovo incarico: %s, %s', new.indirizzo, new.citta));
  return new;
end $$;

create trigger properties_new after insert on public.properties
  for each row execute function public.on_new_property();

-- Le funzioni interne non sono richiamabili dall'esterno.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.log_deal_change() from public, anon, authenticated;
revoke execute on function public.log_new_appointment() from public, anon, authenticated;
revoke execute on function public.on_new_contact() from public, anon, authenticated;
revoke execute on function public.on_new_property() from public, anon, authenticated;
revoke execute on function public.guard_profile_update() from public, anon, authenticated;
revoke execute on function public.get_my_agency_id() from public, anon;
revoke execute on function public.is_titolare() from public, anon;
revoke execute on function public.accept_my_invitation() from public, anon;
grant execute on function public.get_my_agency_id() to authenticated;
grant execute on function public.is_titolare() to authenticated;
grant execute on function public.accept_my_invitation() to authenticated;

-- ---------- Storage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('property-photos', 'property-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('agency-logos', 'agency-logos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']);

-- Percorso foto: {agency_id}/{property_id}/{nome file}
create policy "foto immobili: lettura agenzia" on storage.objects
  for select to authenticated
  using (bucket_id = 'property-photos'
    and (storage.foldername(name))[1] = (select public.get_my_agency_id())::text);
create policy "foto immobili: caricamento" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'property-photos'
    and (storage.foldername(name))[1] = (select public.get_my_agency_id())::text
    and public.can_edit_property(((storage.foldername(name))[2])::uuid));
create policy "foto immobili: modifica" on storage.objects
  for update to authenticated
  using (bucket_id = 'property-photos'
    and (storage.foldername(name))[1] = (select public.get_my_agency_id())::text
    and public.can_edit_property(((storage.foldername(name))[2])::uuid));
create policy "foto immobili: eliminazione" on storage.objects
  for delete to authenticated
  using (bucket_id = 'property-photos'
    and (storage.foldername(name))[1] = (select public.get_my_agency_id())::text
    and public.can_edit_property(((storage.foldername(name))[2])::uuid));

-- Percorso logo: {agency_id}/{nome file}; lo cambia solo il titolare.
create policy "loghi: lettura agenzia" on storage.objects
  for select to authenticated
  using (bucket_id = 'agency-logos'
    and (storage.foldername(name))[1] = (select public.get_my_agency_id())::text);
create policy "loghi: caricamento titolare" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'agency-logos'
    and (storage.foldername(name))[1] = (select public.get_my_agency_id())::text
    and (select public.is_titolare()));
create policy "loghi: modifica titolare" on storage.objects
  for update to authenticated
  using (bucket_id = 'agency-logos'
    and (storage.foldername(name))[1] = (select public.get_my_agency_id())::text
    and (select public.is_titolare()));
create policy "loghi: eliminazione titolare" on storage.objects
  for delete to authenticated
  using (bucket_id = 'agency-logos'
    and (storage.foldername(name))[1] = (select public.get_my_agency_id())::text
    and (select public.is_titolare()));
