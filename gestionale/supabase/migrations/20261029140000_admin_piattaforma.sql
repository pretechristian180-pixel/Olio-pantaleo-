-- =====================================================================
-- Pannello admin della piattaforma (gestione di tutte le agenzie)
-- - platform_admins: chi gestisce Mattonio (Nexora), riconosciuto per email confermata
-- - agenzie sospendibili: con agencies.attiva = false nessun utente dell'agenzia accede ai dati
-- - inviti con ruolo: l'admin crea un'agenzia invitandone il titolare
-- - funzioni di lettura/modifica riservate all'admin (le scritture su Auth passano
--   dalla Edge Function "admin-piattaforma")
-- =====================================================================

create table public.platform_admins (
  email text primary key check (email = lower(trim(email))),
  created_at timestamptz not null default now()
);
-- Nessun accesso dall'app: la tabella si legge solo con le funzioni qui sotto
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;

insert into public.platform_admins (email) values ('info@crmcpecomgroup.cloud');

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from auth.users u
    join public.platform_admins pa on pa.email = lower(u.email)
    where u.id = (select auth.uid()) and u.email_confirmed_at is not null
  )
$$;
revoke execute on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

-- ---------- Agenzie sospendibili ----------
alter table public.agencies add column attiva boolean not null default true;

-- Un'agenzia sospesa "sparisce" per i suoi utenti: tutte le policy usano queste due funzioni
create or replace function public.get_my_agency_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select p.agency_id
  from public.profiles p
  join public.agencies a on a.id = p.agency_id
  where p.id = (select auth.uid()) and p.attivo and a.attiva
$$;

create or replace function public.is_titolare()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    join public.agencies a on a.id = p.agency_id
    where p.id = (select auth.uid()) and p.attivo and a.attiva and p.ruolo = 'titolare'
  )
$$;

-- ---------- Inviti con ruolo ----------
alter table public.invitations add column ruolo public.ruolo_utente not null default 'agente';

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  inv public.invitations;
  new_agency uuid;
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  -- Gli amministratori della piattaforma non appartengono a nessuna agenzia
  if exists (select 1 from public.platform_admins where email = lower(new.email)) then
    return new;
  end if;

  select * into inv from public.invitations i
  where lower(i.email) = lower(new.email) and i.accepted_at is null
  order by i.created_at desc limit 1;

  if found then
    insert into public.profiles (id, agency_id, nome, cognome, ruolo)
    values (new.id, inv.agency_id, coalesce(inv.nome, ''), coalesce(inv.cognome, ''), inv.ruolo);
  else
    insert into public.agencies (nome, email)
    values (coalesce(nullif(trim(meta ->> 'agency_name'), ''), 'La mia agenzia'), new.email)
    returning id into new_agency;
    insert into public.profiles (id, agency_id, nome, cognome, ruolo)
    values (new.id, new_agency, coalesce(trim(meta ->> 'nome'), ''), coalesce(trim(meta ->> 'cognome'), ''), 'titolare');
  end if;
  return new;
end $$;

-- ---------- Funzioni dell'admin ----------
create or replace function public.assert_platform_admin()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Riservato agli amministratori di Mattonio' using errcode = '42501';
  end if;
end $$;

-- Elenco delle agenzie con i numeri principali
create or replace function public.admin_list_agencies()
returns table (
  id uuid, nome text, piano public.piano_agenzia, attiva boolean, email text, telefono text, indirizzo text,
  created_at timestamptz, utenti integer, utenti_attivi integer, immobili integer, contatti integer,
  titolare_nome text, titolare_email text, ultima_attivita timestamptz
) language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_platform_admin();
  return query
  select a.id, a.nome, a.piano, a.attiva, a.email, a.telefono, a.indirizzo, a.created_at,
    (select count(*)::int from public.profiles p where p.agency_id = a.id),
    (select count(*)::int from public.profiles p where p.agency_id = a.id and p.attivo),
    (select count(*)::int from public.properties x where x.agency_id = a.id),
    (select count(*)::int from public.contacts x where x.agency_id = a.id),
    (select trim(p.nome || ' ' || p.cognome) from public.profiles p where p.agency_id = a.id and p.ruolo = 'titolare' order by p.created_at limit 1),
    (select u.email::text from public.profiles p join auth.users u on u.id = p.id
      where p.agency_id = a.id and p.ruolo = 'titolare' order by p.created_at limit 1),
    (select max(x.created_at) from public.activities x where x.agency_id = a.id)
  from public.agencies a
  order by a.created_at desc;
end $$;

-- Utenti di un'agenzia, con email e stato dell'accesso
create or replace function public.admin_agency_users(aid uuid)
returns table (
  id uuid, nome text, cognome text, email text, ruolo public.ruolo_utente, attivo boolean,
  created_at timestamptz, ultimo_accesso timestamptz, in_attesa boolean
) language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_platform_admin();
  return query
  select p.id, p.nome, p.cognome, u.email::text, p.ruolo, p.attivo, p.created_at, u.last_sign_in_at,
    exists (select 1 from public.invitations i
            where i.agency_id = p.agency_id and lower(i.email) = lower(u.email) and i.accepted_at is null)
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.agency_id = aid
  order by (p.ruolo = 'titolare') desc, p.created_at;
end $$;

-- Modifica dei dati di un'agenzia (compreso piano e sospensione)
create or replace function public.admin_update_agency(
  aid uuid, p_nome text, p_piano public.piano_agenzia, p_email text, p_telefono text, p_indirizzo text, p_attiva boolean
) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_platform_admin();
  if length(trim(coalesce(p_nome, ''))) = 0 then
    raise exception 'Il nome dell''agenzia è obbligatorio' using errcode = '23514';
  end if;
  update public.agencies
  set nome = trim(p_nome), piano = p_piano, email = nullif(trim(p_email), ''),
      telefono = nullif(trim(p_telefono), ''), indirizzo = nullif(trim(p_indirizzo), ''), attiva = p_attiva
  where id = aid;
  if not found then raise exception 'Agenzia non trovata' using errcode = 'P0002'; end if;
end $$;

-- Ruolo e accesso di un utente (l'admin può cambiare anche i titolari)
create or replace function public.admin_set_user(uid uuid, p_ruolo public.ruolo_utente, p_attivo boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  aid uuid;
begin
  perform public.assert_platform_admin();
  select agency_id into aid from public.profiles where id = uid;
  if aid is null then raise exception 'Utente non trovato' using errcode = 'P0002'; end if;
  -- Ogni agenzia deve conservare almeno un titolare attivo
  if (p_ruolo <> 'titolare' or not p_attivo) and not exists (
    select 1 from public.profiles where agency_id = aid and id <> uid and ruolo = 'titolare' and attivo
  ) and exists (select 1 from public.profiles where id = uid and ruolo = 'titolare' and attivo) then
    raise exception 'L''agenzia deve avere almeno un titolare attivo: nomina prima un altro titolare' using errcode = '23514';
  end if;
  -- Il controllo del trigger "solo il titolare cambia ruoli" vale per gli utenti delle agenzie, non per l'admin
  perform set_config('mattonio.admin', 'on', true);
  update public.profiles set ruolo = p_ruolo, attivo = p_attivo where id = uid;
end $$;

create or replace function public.guard_profile_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_setting('mattonio.admin', true) = 'on' and public.is_platform_admin() then
    return new;
  end if;
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

-- L'invito si considera accettato quando l'utente sceglie la password (anche dopo un "reinvia")
create or replace function public.accept_my_invitation()
returns void language sql security definer set search_path = '' as $$
  update public.invitations
  set accepted_at = now()
  where lower(email) = lower((select auth.jwt() ->> 'email'))
    and accepted_at is null
    and agency_id = (select p.agency_id from public.profiles p where p.id = (select auth.uid()))
$$;

revoke execute on function public.assert_platform_admin() from public, anon, authenticated;
revoke execute on function public.admin_list_agencies() from public, anon;
revoke execute on function public.admin_agency_users(uuid) from public, anon;
revoke execute on function public.admin_update_agency(uuid, text, public.piano_agenzia, text, text, text, boolean) from public, anon;
revoke execute on function public.admin_set_user(uuid, public.ruolo_utente, boolean) from public, anon;
grant execute on function public.admin_list_agencies() to authenticated;
grant execute on function public.admin_agency_users(uuid) to authenticated;
grant execute on function public.admin_update_agency(uuid, text, public.piano_agenzia, text, text, text, boolean) to authenticated;
grant execute on function public.admin_set_user(uuid, public.ruolo_utente, boolean) to authenticated;
