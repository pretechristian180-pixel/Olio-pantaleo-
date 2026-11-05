-- Pannello della piattaforma (super-admin Nexora): tutte le academy dei clienti.
-- Ogni funzione verifica per prima cosa private.is_platform_admin().

create or replace function public.platform_overview()
returns table (
  academy_totali integer,
  in_prova integer,
  attive integer,
  insolute integer,
  sospese integer,
  prove_in_scadenza integer,
  mrr_cents bigint,
  studenti_totali integer,
  vendite_mese_cents bigint
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Non autorizzato' using errcode = '42501';
  end if;
  return query
  with clienti as (
    select t.* from public.tenants t
    where t.slug <> 'nexora' and t.stato <> 'chiuso'
  )
  select
    (select count(*) from clienti)::integer,
    (select count(*) from clienti where stato = 'prova')::integer,
    (select count(*) from clienti where stato = 'attivo')::integer,
    (select count(*) from clienti where stato = 'insoluto')::integer,
    (select count(*) from clienti where stato = 'sospeso')::integer,
    (select count(*) from clienti
      where stato = 'prova' and prova_fine_il between now() and now() + interval '7 days')::integer,
    coalesce((select sum(p.prezzo_mese_cents) from clienti c
      join public.platform_plans p on p.id = c.piano_id
      where c.stato in ('attivo', 'insoluto') and c.stripe_subscription_id is not null), 0)::bigint,
    (select count(*) from public.memberships m join clienti c on c.id = m.tenant_id
      where m.ruolo = 'student')::integer,
    coalesce((select sum(o.importo_cents) from public.orders o join clienti c on c.id = o.tenant_id
      where o.stato = 'pagato' and o.pagato_il >= date_trunc('month', now())), 0)::bigint;
end;
$$;

create or replace function public.platform_tenants(p_cerca text default null, p_stato public.tenant_status default null)
returns table (
  id uuid,
  nome text,
  slug text,
  stato public.tenant_status,
  piano text,
  piano_codice text,
  prova_fine_il timestamptz,
  creato_il timestamptz,
  dominio_personalizzato text,
  abbonamento_attivo boolean,
  stripe_collegato boolean,
  pagamenti_attivi boolean,
  stripe_customer_id text,
  stripe_account_id text,
  studenti integer,
  corsi integer,
  vendite_totali_cents bigint,
  admin_email text
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_cerca text := nullif(trim(coalesce(p_cerca, '')), '');
begin
  if not private.is_platform_admin() then
    raise exception 'Non autorizzato' using errcode = '42501';
  end if;
  return query
  select t.id, t.nome, t.slug, t.stato, p.nome, p.codice, t.prova_fine_il, t.creato_il,
    t.dominio_personalizzato,
    t.stripe_subscription_id is not null,
    t.stripe_account_id is not null,
    t.stripe_pagamenti_attivi,
    t.stripe_customer_id,
    t.stripe_account_id,
    (select count(*) from public.memberships m where m.tenant_id = t.id and m.ruolo = 'student')::integer,
    (select count(*) from public.courses c where c.tenant_id = t.id)::integer,
    coalesce((select sum(o.importo_cents) from public.orders o
      where o.tenant_id = t.id and o.stato = 'pagato'), 0)::bigint,
    (select u.email::text from public.memberships m join auth.users u on u.id = m.user_id
      where m.tenant_id = t.id and m.ruolo = 'admin' order by m.creato_il limit 1)
  from public.tenants t
  left join public.platform_plans p on p.id = t.piano_id
  where (p_stato is null or t.stato = p_stato)
    and (v_cerca is null or t.nome ilike '%' || v_cerca || '%' or t.slug ilike '%' || v_cerca || '%')
  order by t.creato_il desc
  limit 1000;
end;
$$;

create or replace function public.platform_tenant_team(p_tenant uuid)
returns table (user_id uuid, nome text, email text, ruolo public.user_role, dal timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Non autorizzato' using errcode = '42501';
  end if;
  return query
  select m.user_id, trim(coalesce(p.nome, '') || ' ' || coalesce(p.cognome, '')), u.email::text,
    m.ruolo, m.creato_il
  from public.memberships m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.id = m.user_id
  where m.tenant_id = p_tenant and m.ruolo in ('admin', 'instructor')
  order by m.ruolo, m.creato_il;
end;
$$;

-- Modifiche manuali di un'academy: stato, piano, fine prova. NULL = lascia com'è.
create or replace function public.platform_update_tenant(
  p_tenant uuid,
  p_stato public.tenant_status default null,
  p_piano text default null,
  p_prova_fine timestamptz default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_piano uuid;
begin
  if not private.is_platform_admin() then
    raise exception 'Non autorizzato' using errcode = '42501';
  end if;
  if p_piano is not null then
    select id into v_piano from public.platform_plans where codice = p_piano;
    if v_piano is null then
      raise exception 'Piano sconosciuto' using errcode = '22023';
    end if;
  end if;
  update public.tenants t set
    stato = coalesce(p_stato, t.stato),
    piano_id = coalesce(v_piano, t.piano_id),
    prova_fine_il = coalesce(p_prova_fine, t.prova_fine_il)
  where t.id = p_tenant;
end;
$$;

-- Il super-admin entra nel pannello di un'academy (per assistenza) come amministratore.
create or replace function public.platform_join_as_admin(p_tenant uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Non autorizzato' using errcode = '42501';
  end if;
  insert into public.memberships (user_id, tenant_id, ruolo)
  values (auth.uid(), p_tenant, 'admin')
  on conflict (user_id, tenant_id) do update set ruolo = 'admin';
end;
$$;

revoke all on function public.platform_overview() from public, anon;
revoke all on function public.platform_tenants(text, public.tenant_status) from public, anon;
revoke all on function public.platform_tenant_team(uuid) from public, anon;
revoke all on function public.platform_update_tenant(uuid, public.tenant_status, text, timestamptz) from public, anon;
revoke all on function public.platform_join_as_admin(uuid) from public, anon;
grant execute on function public.platform_overview() to authenticated;
grant execute on function public.platform_tenants(text, public.tenant_status) to authenticated;
grant execute on function public.platform_tenant_team(uuid) to authenticated;
grant execute on function public.platform_update_tenant(uuid, public.tenant_status, text, timestamptz) to authenticated;
grant execute on function public.platform_join_as_admin(uuid) to authenticated;
