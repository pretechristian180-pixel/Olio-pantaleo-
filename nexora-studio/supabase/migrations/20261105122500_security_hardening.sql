-- ═══════════════════════════════════════════════════════════════════════════
-- Sicurezza: funzioni interne non richiamabili via API da chi non ne ha bisogno
-- (avvisi 0028/0029 del linter Supabase).
-- - Funzioni dei trigger: nessuno deve chiamarle direttamente (i trigger scattano comunque).
-- - Helper della RLS: servono agli utenti autenticati (le policy girano col loro ruolo), non ad anon.
--   is_admin() resta per anon: la policy di lettura pubblica dei piani la usa.
-- ═══════════════════════════════════════════════════════════════════════════
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.ensure_owner_remains() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

revoke execute on function public.is_workspace_member(uuid) from public, anon;
revoke execute on function public.is_workspace_owner(uuid) from public, anon;
revoke execute on function public.shares_workspace_with(uuid) from public, anon;
revoke execute on function public.storage_workspace_id(text) from public, anon;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_owner(uuid) to authenticated;
grant execute on function public.shares_workspace_with(uuid) to authenticated;
grant execute on function public.storage_workspace_id(text) to authenticated;
