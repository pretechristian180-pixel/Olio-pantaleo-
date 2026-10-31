-- Offerta nella cronologia con il punto delle migliaia (280.000 €)
create or replace function public.log_visit_feedback()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  c public.contacts;
  indirizzo text;
begin
  select * into c from public.contacts where id = new.contact_id;
  select p.indirizzo into indirizzo from public.properties p where p.id = new.property_id;
  if new.contact_id is not null then
    insert into public.activities (agency_id, utente_id, contact_id, property_id, tipo, descrizione)
    values (new.agency_id, auth.uid(), new.contact_id, new.property_id, 'visita',
            concat_ws(' · ', format('Com''è andata la visita%s', coalesce(' in ' || indirizzo, '')),
              case new.intenzione when 'proposta' then 'vuole fare una proposta' when 'ci_pensa' then 'ci sta pensando'
                when 'altro_immobile' then 'preferisce vedere altro' when 'non_interessato' then 'non interessato' end,
              case new.giudizio_prezzo when 'basso' then 'prezzo giudicato buono' when 'giusto' then 'prezzo giusto'
                when 'alto' then 'prezzo giudicato alto' end,
              case when new.offerta is not null then format('offrirebbe %s €', replace(to_char(new.offerta, 'FM999,999,999'), ',', '.')) end));
  end if;
  if new.intenzione = 'proposta' and c.id is not null then
    insert into public.tasks (agency_id, assegnato_a, contact_id, property_id, titolo, scadenza, origine)
    values (new.agency_id, coalesce(new.agente_id, auth.uid()), c.id, new.property_id,
            trim(format('Prepara la proposta di %s %s', c.nome, c.cognome)) || coalesce(format(' per %s', indirizzo), ''),
            (now() at time zone 'Europe/Rome')::date, 'automatica');
  end if;
  return new;
end $$;