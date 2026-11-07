-- Academy in omaggio e funzioni personalizzate, decise dal super-admin.
-- funzioni: solo le voci che differiscono dal piano (null = illimitato), il resto viene dal piano.

alter table public.tenants
  add column omaggio boolean not null default false,
  add column omaggio_fine_il timestamptz,
  add column funzioni jsonb not null default '{}'::jsonb
    check (jsonb_typeof(funzioni) = 'object' and pg_column_size(funzioni) < 2000);

-- Leggibili dall'app (servono per applicare limiti e marchio); le modifica solo il super-admin.
grant select (omaggio, omaggio_fine_il, funzioni) on public.tenants to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Creazione azienda: prova o omaggio, con funzioni personalizzate
-- ---------------------------------------------------------------------------
drop function if exists public.platform_create_tenant(text, text, text, text, integer);
create function public.platform_create_tenant(
  p_nome text,
  p_slug text,
  p_piano text,
  p_admin_email text,
  p_giorni_prova integer default 14,
  p_omaggio boolean default false,
  p_omaggio_fine timestamptz default null,
  p_funzioni jsonb default '{}'::jsonb
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_tenant uuid;
  v_piano uuid;
  v_user uuid;
  v_slug text := lower(trim(p_slug));
begin
  if not private.is_platform_admin() then
    raise exception 'Non autorizzato' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_nome, ''))) not between 2 and 120 then
    raise exception 'Nome non valido' using errcode = '22023';
  end if;
  if not public.slug_disponibile(v_slug) then
    raise exception 'Indirizzo non disponibile' using errcode = '23505';
  end if;
  select id into v_piano from public.platform_plans where codice = p_piano;
  if v_piano is null then
    raise exception 'Piano sconosciuto' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_funzioni, '{}'::jsonb)) <> 'object' then
    raise exception 'Funzioni non valide' using errcode = '22023';
  end if;
  select u.id into v_user from auth.users u where lower(u.email) = lower(trim(p_admin_email)) limit 1;
  if v_user is null then
    raise exception 'Nessun account' using errcode = 'P0002';
  end if;

  insert into public.tenants (nome, slug, stato, piano_id, prova_fine_il, omaggio, omaggio_fine_il, funzioni, brand)
  values (
    trim(p_nome), v_slug,
    case when p_omaggio then 'attivo'::public.tenant_status else 'prova'::public.tenant_status end,
    v_piano,
    case when p_omaggio then null
         else now() + make_interval(days => least(greatest(coalesce(p_giorni_prova, 14), 1), 365)) end,
    coalesce(p_omaggio, false),
    case when p_omaggio then p_omaggio_fine else null end,
    coalesce(p_funzioni, '{}'::jsonb),
    jsonb_build_object('logo_text', upper(left(trim(p_nome), 24)))
  )
  returning id into v_tenant;

  insert into public.memberships (user_id, tenant_id, ruolo)
  values (v_user, v_tenant, 'admin');

  return v_tenant;
end;
$$;

-- Omaggio e funzioni di un'academy esistente.
create or replace function public.platform_set_offer(
  p_tenant uuid,
  p_omaggio boolean,
  p_omaggio_fine timestamptz,
  p_funzioni jsonb
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Non autorizzato' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_funzioni, '{}'::jsonb)) <> 'object' then
    raise exception 'Funzioni non valide' using errcode = '22023';
  end if;
  update public.tenants t set
    omaggio = p_omaggio,
    omaggio_fine_il = case when p_omaggio then p_omaggio_fine else null end,
    funzioni = coalesce(p_funzioni, '{}'::jsonb),
    -- Omaggio attivato: l'academy è attiva. Omaggio tolto senza abbonamento: torna da attivare.
    stato = case
      when p_omaggio and t.stato in ('prova', 'insoluto', 'sospeso') then 'attivo'::public.tenant_status
      when not p_omaggio and t.omaggio and t.stripe_subscription_id is null then 'prova'::public.tenant_status
      else t.stato end,
    prova_fine_il = case
      when not p_omaggio and t.omaggio and t.stripe_subscription_id is null then now()
      else t.prova_fine_il end
  where t.id = p_tenant;
end;
$$;

-- ---------------------------------------------------------------------------
-- Elenco e numeri della piattaforma con l'omaggio
-- ---------------------------------------------------------------------------
drop function if exists public.platform_tenants(text, public.tenant_status);
create function public.platform_tenants(p_cerca text default null, p_stato public.tenant_status default null)
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
  admin_email text,
  omaggio boolean,
  omaggio_fine_il timestamptz,
  funzioni jsonb
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
      where m.tenant_id = t.id and m.ruolo = 'admin' order by m.creato_il limit 1),
    t.omaggio,
    t.omaggio_fine_il,
    t.funzioni
  from public.tenants t
  left join public.platform_plans p on p.id = t.piano_id
  where (p_stato is null or t.stato = p_stato)
    and (v_cerca is null or t.nome ilike '%' || v_cerca || '%' or t.slug ilike '%' || v_cerca || '%')
  order by t.creato_il desc
  limit 1000;
end;
$$;

drop function if exists public.platform_overview();
create function public.platform_overview()
returns table (
  academy_totali integer,
  in_prova integer,
  attive integer,
  insolute integer,
  sospese integer,
  prove_in_scadenza integer,
  mrr_cents bigint,
  studenti_totali integer,
  vendite_mese_cents bigint,
  omaggi integer
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
      where o.stato = 'pagato' and o.pagato_il >= date_trunc('month', now())), 0)::bigint,
    (select count(*) from clienti where omaggio)::integer;
end;
$$;

revoke all on function public.platform_create_tenant(text, text, text, text, integer, boolean, timestamptz, jsonb) from public, anon;
grant execute on function public.platform_create_tenant(text, text, text, text, integer, boolean, timestamptz, jsonb) to authenticated;
revoke all on function public.platform_set_offer(uuid, boolean, timestamptz, jsonb) from public, anon;
grant execute on function public.platform_set_offer(uuid, boolean, timestamptz, jsonb) to authenticated;
revoke all on function public.platform_tenants(text, public.tenant_status) from public, anon;
grant execute on function public.platform_tenants(text, public.tenant_status) to authenticated;
revoke all on function public.platform_overview() from public, anon;
grant execute on function public.platform_overview() to authenticated;
