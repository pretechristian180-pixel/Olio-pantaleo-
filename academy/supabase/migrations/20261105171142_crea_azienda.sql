-- Il super-admin crea un'academy per un cliente e ne nomina l'amministratore (per email).
-- Restituisce l'id della nuova academy; errore P0002 se l'email non ha ancora un account.
create or replace function public.platform_create_tenant(
  p_nome text,
  p_slug text,
  p_piano text,
  p_admin_email text,
  p_giorni_prova integer default 14
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
  select u.id into v_user from auth.users u where lower(u.email) = lower(trim(p_admin_email)) limit 1;
  if v_user is null then
    raise exception 'Nessun account' using errcode = 'P0002';
  end if;

  insert into public.tenants (nome, slug, stato, piano_id, prova_fine_il, brand)
  values (trim(p_nome), v_slug, 'prova', v_piano,
          now() + make_interval(days => least(greatest(coalesce(p_giorni_prova, 14), 1), 365)),
          jsonb_build_object('logo_text', upper(left(trim(p_nome), 24))))
  returning id into v_tenant;

  insert into public.memberships (user_id, tenant_id, ruolo)
  values (v_user, v_tenant, 'admin');

  return v_tenant;
end;
$$;

revoke all on function public.platform_create_tenant(text, text, text, text, integer) from public, anon;
grant execute on function public.platform_create_tenant(text, text, text, text, integer) to authenticated;
