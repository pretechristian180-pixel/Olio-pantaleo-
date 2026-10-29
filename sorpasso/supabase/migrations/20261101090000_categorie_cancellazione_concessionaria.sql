-- Le categorie economiche di sistema non si modificano né si cancellano una per una,
-- ma devono sparire insieme alla concessionaria (cancellazione a cascata dell'organizzazione):
-- in quel caso l'organizzazione non esiste più quando il trigger scatta.
create or replace function public.categorie_proteggi_sistema()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.organizations where id = old.organization_id) then
    return old;
  end if;
  if old.di_sistema and (tg_op = 'DELETE' or new.nome <> old.nome or new.tipo <> old.tipo or not new.attiva) then
    raise exception 'La categoria «%» è usata nei calcoli e non si può modificare', old.nome using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
