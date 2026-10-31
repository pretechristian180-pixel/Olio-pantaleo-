-- Più richieste per lo stesso cliente (es. "casa in città" e "casa al mare"):
-- si toglie il vincolo "una richiesta per contatto". Nessun dato viene cancellato.
alter table public.search_criteria drop constraint if exists search_criteria_contact_id_key;
create index if not exists search_criteria_contact on public.search_criteria (contact_id, agency_id);
