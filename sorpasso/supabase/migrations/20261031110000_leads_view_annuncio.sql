-- leads_view era stata creata prima di leads.listing_id: la si ricrea perché l.* includa
-- l'annuncio di provenienza (stessa definizione, nessun'altra modifica).
drop view public.leads_view;
create view public.leads_view with (security_invoker = true) as
select
  l.*,
  c.nome as contatto_nome,
  c.cognome as contatto_cognome,
  c.telefono as contatto_telefono,
  c.email as contatto_email,
  v.marca as veicolo_marca,
  v.modello as veicolo_modello,
  v.versione as veicolo_versione,
  v.prezzo_vendita as veicolo_prezzo,
  p.nome as assegnato_nome,
  (l.stato = 'nuovo' and l.primo_contatto_at is null
    and l.created_at < now() - make_interval(mins => o.tempo_max_risposta_min)) as in_ritardo,
  (l.stato not in ('vinto', 'perso') and l.prossima_azione_at is null) as senza_prossima_azione,
  o.tempo_max_risposta_min
from public.leads l
join public.organizations o on o.id = l.organization_id
join public.contacts c on c.id = l.contact_id
left join public.vehicles v on v.id = l.vehicle_id
left join public.profiles p on p.user_id = l.assegnato_a;
