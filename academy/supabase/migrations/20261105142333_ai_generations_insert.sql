-- Lo staff registra le proprie generazioni IA (servono solo a contare i limiti del piano).
grant insert on public.ai_generations to authenticated;
create policy ai_generations_insert_own on public.ai_generations
  for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_staff(tenant_id));
