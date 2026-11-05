-- L'app chiede se l'utente collegato è super-admin (per mostrare o nascondere /piattaforma).
create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$ select private.is_platform_admin() $$;
revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;
