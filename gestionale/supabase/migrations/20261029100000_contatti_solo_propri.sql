-- Ogni agente vede solo i propri contatti; il titolare li vede tutti.
-- Di conseguenza anche "cosa cerca" e la cronologia di un contatto
-- sono visibili solo a chi può vedere quel contatto.
-- (ALTER POLICY invece di DROP/CREATE: stesse regole di scrittura, cambia solo la lettura.)

alter policy "contacts: lettura agenzia" on public.contacts
  using (agency_id = (select public.get_my_agency_id())
    and ((select public.is_titolare()) or agente_id = (select auth.uid())));
alter policy "contacts: lettura agenzia" on public.contacts
  rename to "contacts: lettura propri o titolare";

-- La sottoquery su contacts rispetta a sua volta la policy qui sopra
alter policy "ricerche: lettura agenzia" on public.search_criteria
  using (agency_id = (select public.get_my_agency_id())
    and exists (select 1 from public.contacts c where c.id = search_criteria.contact_id));
alter policy "ricerche: lettura agenzia" on public.search_criteria
  rename to "ricerche: lettura se vede il contatto";

alter policy "attivita: lettura agenzia" on public.activities
  using (agency_id = (select public.get_my_agency_id())
    and (activities.contact_id is null
      or exists (select 1 from public.contacts c where c.id = activities.contact_id)));
alter policy "attivita: lettura agenzia" on public.activities
  rename to "attivita: lettura se vede il contatto";
