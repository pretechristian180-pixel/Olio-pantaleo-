-- Nexora Academy diventa una piattaforma multi-azienda (SaaS):
--   * ogni azienda cliente è un tenant con piano, stato e sottodominio;
--   * una persona può appartenere a più aziende, con un ruolo diverso in ciascuna (memberships);
--   * il profilo è personale e unico, ruolo e consensi marketing sono per azienda;
--   * chi crea un'academy self-service ne diventa admin, in prova.

-- ---------------------------------------------------------------------------
-- Piani della piattaforma (quello che i clienti pagano a Nexora)
-- ---------------------------------------------------------------------------
create table public.platform_plans (
  id uuid primary key default gen_random_uuid(),
  codice text not null unique check (codice ~ '^[a-z0-9_]+$'),
  nome text not null,
  descrizione text,
  prezzo_mese_cents integer not null check (prezzo_mese_cents >= 0),
  prezzo_anno_cents integer check (prezzo_anno_cents >= 0),
  stripe_price_mese_id text unique,
  stripe_price_anno_id text unique,
  -- Limiti: null = illimitato.
  max_ore_video integer check (max_ore_video > 0),
  max_studenti_attivi integer check (max_studenti_attivi > 0),
  max_staff integer check (max_staff > 0),
  dominio_personalizzato boolean not null default false,
  senza_marchio_nexora boolean not null default false,
  abbonamenti_studenti boolean not null default false,
  ordine integer not null default 0,
  attivo boolean not null default true,
  creato_il timestamptz not null default now()
);

create type public.tenant_status as enum ('prova', 'attivo', 'insoluto', 'sospeso', 'chiuso');

alter table public.tenants
  add column stato public.tenant_status not null default 'attivo',
  add column piano_id uuid references public.platform_plans (id) on delete restrict,
  add column prova_fine_il timestamptz,
  add column dominio_personalizzato text unique
    check (dominio_personalizzato is null or dominio_personalizzato ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'),
  add column email_contatto text,
  -- Abbonamento del cliente verso Nexora.
  add column stripe_customer_id text unique,
  add column stripe_subscription_id text unique,
  -- Conto Stripe Connect del cliente, dove arrivano i pagamenti dei suoi studenti.
  add column stripe_account_id text unique,
  add column stripe_pagamenti_attivi boolean not null default false,
  add column aggiornato_il timestamptz not null default now();

-- Sottodominio: 3-30 caratteri; il controllo sulle parole riservate è in create_tenant().
alter table public.tenants
  add constraint tenants_slug_lunghezza check (char_length(slug) between 3 and 30);

create trigger tenants_aggiornato_il before update on public.tenants
  for each row execute function private.set_aggiornato_il();

-- ---------------------------------------------------------------------------
-- Appartenenze persona ↔ azienda
-- ---------------------------------------------------------------------------
create table public.memberships (
  user_id uuid not null references public.profiles (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  ruolo public.user_role not null default 'student',
  consenso_marketing boolean not null default false,
  consenso_marketing_il timestamptz,
  ultimo_accesso_il timestamptz,
  creato_il timestamptz not null default now(),
  primary key (user_id, tenant_id)
);
create index memberships_tenant_ruolo_idx on public.memberships (tenant_id, ruolo);

insert into public.memberships (user_id, tenant_id, ruolo, consenso_marketing, consenso_marketing_il, ultimo_accesso_il)
select id, tenant_id, ruolo, consenso_marketing, consenso_marketing_il, ultimo_accesso_il
from public.profiles;

-- Amministratori della piattaforma (Nexora). Gestiti solo dal server.
create table public.platform_admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  creato_il timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profilo personale: senza tenant, ruolo e consensi (ora nelle appartenenze)
-- ---------------------------------------------------------------------------
drop policy profiles_select on public.profiles;
drop policy profiles_update_own on public.profiles;
drop index if exists public.profiles_tenant_ruolo_idx;
alter table public.profiles
  drop column tenant_id,
  drop column ruolo,
  drop column consenso_marketing,
  drop column consenso_marketing_il,
  drop column ultimo_accesso_il;

-- ---------------------------------------------------------------------------
-- Funzioni di controllo: stesse firme, ora basate sulle appartenenze.
-- Tutte le policy esistenti continuano a funzionare senza modifiche.
-- ---------------------------------------------------------------------------
create or replace function private.is_platform_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.platform_admins a where a.user_id = auth.uid());
$$;

create or replace function private.is_staff(p_tenant uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and m.tenant_id = p_tenant
      and m.ruolo in ('instructor', 'admin')
  );
$$;

create or replace function private.is_admin(p_tenant uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.tenant_id = p_tenant and m.ruolo = 'admin'
  );
$$;

-- La persona indicata appartiene a un'azienda in cui io sono staff?
create or replace function private.shares_tenant_as_staff(p_user uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships theirs
    join public.memberships mine on mine.tenant_id = theirs.tenant_id
    where theirs.user_id = p_user
      and mine.user_id = auth.uid()
      and mine.ruolo in ('instructor', 'admin')
  );
$$;

-- "Risposta del docente": l'autore è staff dell'azienda a cui appartiene la domanda.
create or replace function private.answers_set_docente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select exists (
    select 1
    from public.questions q
    join public.memberships m on m.tenant_id = q.tenant_id
    where q.id = new.question_id
      and m.user_id = new.user_id
      and m.ruolo in ('instructor', 'admin')
  ) into new.is_docente;
  return new;
end;
$$;

revoke all on function private.is_platform_admin(), private.shares_tenant_as_staff(uuid) from public;
grant execute on function private.is_platform_admin(), private.shares_tenant_as_staff(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Registrazione: profilo personale + appartenenza all'azienda da cui ti iscrivi
-- ---------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_consenso boolean := coalesce((new.raw_user_meta_data ->> 'consenso_marketing')::boolean, false);
begin
  insert into public.profiles (id, nome, cognome)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'nome', ''), 80),
    left(coalesce(new.raw_user_meta_data ->> 'cognome', ''), 80)
  );

  select t.id into v_tenant
  from public.tenants t
  where t.slug = new.raw_user_meta_data ->> 'tenant'
    and t.stato in ('prova', 'attivo', 'insoluto');

  if v_tenant is not null then
    insert into public.memberships (user_id, tenant_id, ruolo, consenso_marketing, consenso_marketing_il)
    values (new.id, v_tenant, 'student', v_consenso, case when v_consenso then now() end);
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privilegi e RLS delle nuove tabelle
-- ---------------------------------------------------------------------------
-- tenants: solo le colonne pubbliche sono leggibili da anon e utenti; i dati di
-- fatturazione li legge il server. L'admin del tenant modifica nome e marchio.
revoke all on public.tenants from anon, authenticated;
grant select (id, nome, slug, brand, stato, dominio_personalizzato, piano_id, prova_fine_il, stripe_pagamenti_attivi)
  on public.tenants to anon, authenticated;
grant update (nome, brand, email_contatto) on public.tenants to authenticated;
create policy tenants_admin_update on public.tenants
  for update to authenticated
  using (private.is_admin(id) or private.is_platform_admin())
  with check (private.is_admin(id) or private.is_platform_admin());

alter table public.platform_plans enable row level security;
revoke all on public.platform_plans from anon, authenticated;
grant select on public.platform_plans to anon, authenticated;
create policy platform_plans_select on public.platform_plans
  for select to anon, authenticated using (attivo or private.is_platform_admin());

alter table public.memberships enable row level security;
revoke all on public.memberships from anon;
revoke insert, update, delete on public.memberships from authenticated;
-- Lo studente aggiorna solo il proprio consenso marketing e l'ultimo accesso.
grant update (consenso_marketing, consenso_marketing_il, ultimo_accesso_il) on public.memberships to authenticated;
create policy memberships_select on public.memberships
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_staff(tenant_id) or private.is_platform_admin());
create policy memberships_update_own on public.memberships
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;

create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or private.shares_tenant_as_staff(id)
    or private.is_platform_admin()
  );
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
revoke update on public.profiles from authenticated;
grant update (nome, cognome, avatar_url) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- RPC
-- ---------------------------------------------------------------------------

-- Entrare come studente nell'academy che stai visitando (stesso account, altra azienda).
create or replace function public.join_tenant(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Accesso richiesto' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.tenants t
    where t.id = p_tenant_id and t.stato in ('prova', 'attivo', 'insoluto')
  ) then
    raise exception 'Academy non disponibile' using errcode = 'P0002';
  end if;
  insert into public.memberships (user_id, tenant_id, ruolo)
  values (auth.uid(), p_tenant_id, 'student')
  on conflict (user_id, tenant_id) do nothing;
end;
$$;

-- Sottodomini che nessun cliente può prendere.
create or replace function private.slug_riservato(p_slug text)
returns boolean language sql immutable set search_path = ''
as $$
  select p_slug = any (array[
    'www', 'app', 'api', 'admin', 'academy', 'nexora', 'nexoragruppodigitale', 'mail', 'email',
    'smtp', 'ftp', 'cdn', 'static', 'assets', 'media', 'video', 'help', 'aiuto', 'supporto',
    'support', 'status', 'blog', 'docs', 'dev', 'test', 'staging', 'demo', 'login', 'accedi',
    'registrati', 'auth', 'billing', 'fatture', 'pagamenti', 'stripe', 'dashboard', 'root',
    'piattaforma', 'crea', 'prezzi', 'privacy', 'cookie', 'legal'
  ]);
$$;

create or replace function public.slug_disponibile(p_slug text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select p_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and char_length(p_slug) between 3 and 30
    and not private.slug_riservato(p_slug)
    and not exists (select 1 from public.tenants t where t.slug = p_slug);
$$;

-- Creazione self-service di una nuova academy, in prova per 14 giorni.
create or replace function public.create_tenant(p_nome text, p_slug text, p_piano text default 'start')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_piano uuid;
  v_slug text := lower(trim(p_slug));
begin
  if auth.uid() is null then
    raise exception 'Accesso richiesto' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_nome, ''))) not between 2 and 120 then
    raise exception 'Nome non valido' using errcode = '22023';
  end if;
  if not public.slug_disponibile(v_slug) then
    raise exception 'Indirizzo non disponibile' using errcode = '23505';
  end if;
  -- Limite anti-abuso: al massimo 3 academy create per persona.
  if (select count(*) from public.memberships m where m.user_id = auth.uid() and m.ruolo = 'admin') >= 3 then
    raise exception 'Hai raggiunto il numero massimo di academy' using errcode = '53400';
  end if;

  select id into v_piano from public.platform_plans where codice = p_piano and attivo;
  if v_piano is null then
    select id into v_piano from public.platform_plans where attivo order by ordine limit 1;
  end if;

  insert into public.tenants (nome, slug, stato, piano_id, prova_fine_il, brand)
  values (trim(p_nome), v_slug, 'prova', v_piano, now() + interval '14 days',
          jsonb_build_object('logo_text', upper(left(trim(p_nome), 24))))
  returning id into v_tenant;

  insert into public.memberships (user_id, tenant_id, ruolo)
  values (auth.uid(), v_tenant, 'admin');

  return v_tenant;
end;
$$;

revoke all on function public.join_tenant(uuid), public.create_tenant(text, text, text) from public, anon;
grant execute on function public.join_tenant(uuid), public.create_tenant(text, text, text) to authenticated;
revoke all on function public.slug_disponibile(text) from public;
grant execute on function public.slug_disponibile(text) to anon, authenticated;
revoke all on function private.slug_riservato(text) from public;

-- ---------------------------------------------------------------------------
-- Piani proposti (prezzi IVA esclusa, in centesimi). Gli id Stripe si aggiungono in Fase 3.
-- ---------------------------------------------------------------------------
insert into public.platform_plans
  (codice, nome, descrizione, prezzo_mese_cents, prezzo_anno_cents, max_ore_video, max_studenti_attivi, max_staff,
   dominio_personalizzato, senza_marchio_nexora, abbonamenti_studenti, ordine)
values
  ('start', 'Start', 'Per partire con il primo corso.', 4900, 49000, 10, 100, 1, false, false, false, 1),
  ('pro', 'Pro', 'Per chi vende con continuità.', 12900, 129000, 50, 1000, 3, true, true, false, 2),
  ('business', 'Business', 'Per accademie strutturate e formazione aziendale.', 29900, 299000, 200, 5000, 10, true, true, true, 3);

-- Nexora è il cliente n. 1: piano Business, sempre attivo.
update public.tenants
set piano_id = (select id from public.platform_plans where codice = 'business'), stato = 'attivo'
where slug = 'nexora';
