-- Ogni agente vede solo le proprie trattative; il titolare le vede tutte.
-- (ALTER POLICY: cambia solo la lettura, le regole di scrittura restano uguali.)
alter policy "deals: lettura agenzia" on public.deals
  using (agency_id = (select public.get_my_agency_id())
    and ((select public.is_titolare()) or agente_id = (select auth.uid())));
alter policy "deals: lettura agenzia" on public.deals
  rename to "deals: lettura proprie o titolare";
