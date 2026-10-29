-- Indici che coprono le chiavi esterne composte (colonna, agency_id),
-- usati sia nei filtri sia nelle cancellazioni a cascata.
-- Gli indici su una sola colonna creati nella migrazione precedente restano.
create index contacts_agente_idx on public.contacts (agente_id, agency_id);
create index properties_agente_idx on public.properties (agente_id, agency_id);
create index properties_owner_idx on public.properties (owner_id, agency_id);
create index property_photos_property_idx on public.property_photos (property_id, agency_id, ordine);
create index search_criteria_contact_idx on public.search_criteria (contact_id, agency_id);
create index deals_agente_idx on public.deals (agente_id, agency_id);
create index deals_contact_idx on public.deals (contact_id, agency_id);
create index deals_property_idx on public.deals (property_id, agency_id);
create index appointments_agente_idx on public.appointments (agente_id, agency_id);
create index appointments_contact_idx on public.appointments (contact_id, agency_id);
create index appointments_property_idx on public.appointments (property_id, agency_id);
create index activities_contact_idx on public.activities (contact_id, agency_id, created_at desc);
create index activities_property_idx on public.activities (property_id, agency_id);
create index activities_deal_idx on public.activities (deal_id, agency_id);
create index activities_utente_idx on public.activities (utente_id, agency_id);
create index tasks_assegnato_idx on public.tasks (assegnato_a, agency_id, completato);
create index tasks_contact_idx on public.tasks (contact_id, agency_id);
create index tasks_property_idx on public.tasks (property_id, agency_id);
create index invitations_invitato_da_idx on public.invitations (invitato_da);
