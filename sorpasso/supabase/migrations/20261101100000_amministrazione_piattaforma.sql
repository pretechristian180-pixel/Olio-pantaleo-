-- =====================================================================
-- Sorpasso AI – amministrazione della piattaforma (super admin)
--
-- Gli amministratori della piattaforma (il team di Sorpasso) gestiscono tutte le
-- concessionarie: creazione, piano e prova, sospensione, utenti e accessi.
-- Non appartengono a nessuna concessionaria e non vedono i dati operativi
-- (lead, clienti, documenti): solo anagrafica, utenti e numeri d'uso aggregati.
-- Le operazioni sugli account (inviti, password, link di accesso) passano dalla
-- Edge Function `piattaforma`, che usa la chiave di servizio dopo aver verificato il ruolo.
-- =====================================================================

create type public.stato_organizzazione as enum ('prova', 'attiva', 'sospesa', 'disdetta');

alter table public.organizations
  add column stato public.stato_organizzazione not null default 'attiva',
  add column piano text not null default 'pro' check (piano in ('start', 'pro', 'dealer_ai')),
  add column prova_fino_al date,
  add column max_utenti integer check (max_utenti > 0),
  add column referente_nome text,
  add column referente_email text,
  add column referente_telefono text,
  add column note_piattaforma text,
  add column motivo_sospensione text,
  add column sospesa_at timestamptz;

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  created_at timestamptz not null default now()
);

create table public.platform_audit (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users (id) on delete set null,
  azione text not null,
  organization_id uuid references public.organizations (id) on delete set null,
  dettagli jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index platform_audit_org_idx on public.platform_audit (organization_id, created_at desc);

create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()))
$$;

-- Una concessionaria sospesa, disdetta o con la prova scaduta non dà più accesso ai dati:
-- mia_org() restituisce null e tutte le policy RLS negano.
create or replace function public.organizzazione_abilitata(p_org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.organizations o
    where o.id = p_org
      and (o.stato = 'attiva' or (o.stato = 'prova' and (o.prova_fino_al is null or o.prova_fino_al >= current_date)))
  )
$$;

create or replace function public.mia_org()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.organization_id from public.profiles p
  where p.user_id = (select auth.uid()) and p.attivo and public.organizzazione_abilitata(p.organization_id)
$$;

-- Stato dell'accesso dell'utente corrente, per mostrare il messaggio giusto nell'app.
create or replace function public.stato_mio_accesso()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'admin_piattaforma', public.is_platform_admin(),
    'ha_profilo', p.user_id is not null,
    'profilo_attivo', coalesce(p.attivo, false),
    'stato_organizzazione', o.stato,
    'prova_scaduta', o.stato = 'prova' and o.prova_fino_al < current_date,
    'nome_organizzazione', o.nome
  )
  from (select (select auth.uid()) as uid) u
  left join public.profiles p on p.user_id = u.uid
  left join public.organizations o on o.id = p.organization_id
$$;

-- ---------- Letture per il pannello (solo admin di piattaforma) ----------

create or replace function public.piattaforma_organizzazioni()
returns table (
  id uuid, nome text, piva text, comune text, stato public.stato_organizzazione, piano text,
  prova_fino_al date, max_utenti integer, referente_nome text, referente_email text, created_at timestamptz,
  titolare_nome text, titolare_email text, utenti_attivi integer, auto_in_stock integer,
  lead_30gg integer, vendite_30gg integer, ultimo_accesso timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Riservato agli amministratori della piattaforma' using errcode = '42501';
  end if;
  return query
  select
    o.id, o.nome, o.piva, o.comune, o.stato, o.piano, o.prova_fino_al, o.max_utenti, o.referente_nome, o.referente_email, o.created_at,
    (select p.nome from public.profiles p where p.organization_id = o.id and p.ruolo = 'titolare' order by p.created_at limit 1),
    (select p.email from public.profiles p where p.organization_id = o.id and p.ruolo = 'titolare' order by p.created_at limit 1),
    (select count(*) from public.profiles p where p.organization_id = o.id and p.attivo)::int,
    (select count(*) from public.vehicles v where v.organization_id = o.id and v.stato <> 'venduto')::int,
    (select count(*) from public.leads l where l.organization_id = o.id and l.created_at > now() - interval '30 days')::int,
    (select count(*) from public.deals d where d.organization_id = o.id and d.data_vendita > current_date - 30)::int,
    (select max(u.last_sign_in_at) from public.profiles p join auth.users u on u.id = p.user_id where p.organization_id = o.id)
  from public.organizations o
  order by o.created_at desc;
end $$;

create or replace function public.piattaforma_utenti(p_org uuid)
returns table (
  user_id uuid, nome text, email text, ruolo public.ruolo, telefono text, attivo boolean,
  created_at timestamptz, ultimo_accesso timestamptz, email_confermata boolean, invitato_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Riservato agli amministratori della piattaforma' using errcode = '42501';
  end if;
  return query
  select p.user_id, p.nome, coalesce(p.email, u.email::text), p.ruolo, p.telefono, p.attivo, p.created_at,
         u.last_sign_in_at, u.email_confirmed_at is not null, u.invited_at
  from public.profiles p
  join auth.users u on u.id = p.user_id
  where p.organization_id = p_org
  order by (p.ruolo = 'titolare') desc, p.nome;
end $$;

-- Scheda completa di una concessionaria (anagrafica + numeri d'uso).
create or replace function public.piattaforma_organizzazione(p_org uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  r jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Riservato agli amministratori della piattaforma' using errcode = '42501';
  end if;
  select to_jsonb(o) || jsonb_build_object(
    'utenti_attivi', (select count(*) from public.profiles p where p.organization_id = o.id and p.attivo),
    'auto_in_stock', (select count(*) from public.vehicles v where v.organization_id = o.id and v.stato <> 'venduto'),
    'lead_30gg', (select count(*) from public.leads l where l.organization_id = o.id and l.created_at > now() - interval '30 days'),
    'vendite_30gg', (select count(*) from public.deals d where d.organization_id = o.id and d.data_vendita > current_date - 30),
    'ultimo_accesso', (select max(u.last_sign_in_at) from public.profiles p join auth.users u on u.id = p.user_id where p.organization_id = o.id)
  ) into r
  from public.organizations o where o.id = p_org;
  if r is null then
    raise exception 'Concessionaria non trovata' using errcode = 'P0001';
  end if;
  return r;
end $$;

-- Modifica dei dati di una concessionaria (anagrafica, piano, prova, stato).
create or replace function public.piattaforma_aggiorna_organizzazione(p_org uuid, p_dati jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  prima public.organizations;
begin
  if not public.is_platform_admin() then
    raise exception 'Riservato agli amministratori della piattaforma' using errcode = '42501';
  end if;
  select * into prima from public.organizations where id = p_org;
  if prima.id is null then
    raise exception 'Concessionaria non trovata' using errcode = 'P0001';
  end if;
  if p_dati ? 'stato' and p_dati ->> 'stato' = 'sospesa' and coalesce(trim(p_dati ->> 'motivo_sospensione'), '') = '' then
    raise exception 'Indica il motivo della sospensione' using errcode = 'P0001';
  end if;

  update public.organizations set
    nome = coalesce(nullif(trim(p_dati ->> 'nome'), ''), nome),
    piva = case when p_dati ? 'piva' then nullif(trim(p_dati ->> 'piva'), '') else piva end,
    indirizzo = case when p_dati ? 'indirizzo' then nullif(trim(p_dati ->> 'indirizzo'), '') else indirizzo end,
    comune = case when p_dati ? 'comune' then nullif(trim(p_dati ->> 'comune'), '') else comune end,
    telefono = case when p_dati ? 'telefono' then nullif(trim(p_dati ->> 'telefono'), '') else telefono end,
    email = case when p_dati ? 'email' then nullif(trim(p_dati ->> 'email'), '') else email end,
    piano = coalesce(p_dati ->> 'piano', piano),
    stato = coalesce((p_dati ->> 'stato')::public.stato_organizzazione, stato),
    prova_fino_al = case when p_dati ? 'prova_fino_al' then (nullif(p_dati ->> 'prova_fino_al', ''))::date else prova_fino_al end,
    max_utenti = case when p_dati ? 'max_utenti' then (nullif(p_dati ->> 'max_utenti', ''))::int else max_utenti end,
    referente_nome = case when p_dati ? 'referente_nome' then nullif(trim(p_dati ->> 'referente_nome'), '') else referente_nome end,
    referente_email = case when p_dati ? 'referente_email' then nullif(trim(p_dati ->> 'referente_email'), '') else referente_email end,
    referente_telefono = case when p_dati ? 'referente_telefono' then nullif(trim(p_dati ->> 'referente_telefono'), '') else referente_telefono end,
    note_piattaforma = case when p_dati ? 'note_piattaforma' then nullif(trim(p_dati ->> 'note_piattaforma'), '') else note_piattaforma end,
    motivo_sospensione = case
      when (p_dati ->> 'stato') = 'sospesa' then trim(p_dati ->> 'motivo_sospensione')
      when p_dati ? 'stato' then null else motivo_sospensione end,
    sospesa_at = case
      when (p_dati ->> 'stato') = 'sospesa' and prima.stato <> 'sospesa' then now()
      when p_dati ? 'stato' and (p_dati ->> 'stato') <> 'sospesa' then null else sospesa_at end
  where id = p_org;

  insert into public.platform_audit (admin_id, azione, organization_id, dettagli)
  values (auth.uid(),
          case when (p_dati ->> 'stato') = 'sospesa' and prima.stato <> 'sospesa' then 'sospensione'
               when p_dati ? 'stato' and prima.stato = 'sospesa' and (p_dati ->> 'stato') <> 'sospesa' then 'riattivazione'
               else 'modifica_concessionaria' end,
          p_org,
          -- nel registro solo i nomi dei campi cambiati (e lo stato), non i valori anagrafici
          jsonb_build_object('campi', (select coalesce(jsonb_agg(k), '[]') from jsonb_object_keys(p_dati) k),
                             'stato_prima', prima.stato, 'stato_dopo', coalesce(p_dati ->> 'stato', prima.stato::text)));
end $$;

-- Ruolo e attivazione di un utente di una concessionaria.
create or replace function public.piattaforma_aggiorna_utente(p_user uuid, p_ruolo public.ruolo default null, p_attivo boolean default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  org uuid;
  ruolo_prima public.ruolo;
begin
  if not public.is_platform_admin() then
    raise exception 'Riservato agli amministratori della piattaforma' using errcode = '42501';
  end if;
  select organization_id, ruolo into org, ruolo_prima from public.profiles where user_id = p_user;
  if org is null then
    raise exception 'Utente non trovato' using errcode = 'P0001';
  end if;
  -- Ogni concessionaria deve restare con almeno un titolare attivo
  if (ruolo_prima = 'titolare' and ((p_ruolo is not null and p_ruolo <> 'titolare') or p_attivo = false))
     and not exists (select 1 from public.profiles where organization_id = org and ruolo = 'titolare' and attivo and user_id <> p_user) then
    raise exception 'La concessionaria resterebbe senza titolare: nomina prima un altro titolare' using errcode = 'P0001';
  end if;
  update public.profiles set ruolo = coalesce(p_ruolo, ruolo), attivo = coalesce(p_attivo, attivo) where user_id = p_user;
  insert into public.platform_audit (admin_id, azione, organization_id, dettagli)
  values (auth.uid(), 'modifica_utente', org, jsonb_build_object('user_id', p_user, 'ruolo', p_ruolo, 'attivo', p_attivo));
end $$;

create or replace function public.piattaforma_registro(p_org uuid)
returns table (id uuid, azione text, dettagli jsonb, created_at timestamptz, admin_nome text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Riservato agli amministratori della piattaforma' using errcode = '42501';
  end if;
  return query
  select a.id, a.azione, a.dettagli, a.created_at, pa.nome
  from public.platform_audit a left join public.platform_admins pa on pa.user_id = a.admin_id
  where a.organization_id = p_org
  order by a.created_at desc
  limit 100;
end $$;

-- ---------- RLS ----------
alter table public.platform_admins enable row level security;
alter table public.platform_audit enable row level security;

create policy "admin piattaforma: vede se stesso" on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()));
-- platform_audit: nessuna policy: si legge solo tramite piattaforma_registro(), si scrive dalle funzioni.

revoke execute on function public.piattaforma_organizzazioni() from anon;
revoke execute on function public.piattaforma_utenti(uuid) from anon;
revoke execute on function public.piattaforma_organizzazione(uuid) from anon;
revoke execute on function public.piattaforma_aggiorna_organizzazione(uuid, jsonb) from anon;
revoke execute on function public.piattaforma_aggiorna_utente(uuid, public.ruolo, boolean) from anon;
revoke execute on function public.piattaforma_registro(uuid) from anon;
