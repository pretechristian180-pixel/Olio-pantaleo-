-- Confronto dei telefoni senza spazi, simboli e prefisso italiano (+39 / 0039):
-- "333 111 2222" e "+39 333 1112222" sono lo stesso numero.
create or replace function public.phone_key(t text)
returns text language sql immutable set search_path = '' as $$
  select nullif(regexp_replace(regexp_replace(coalesce(t, ''), '\D', '', 'g'), '^(00)?39(?=\d{9,})', ''), '')
$$;

create index if not exists contacts_phone_key on public.contacts (agency_id, public.phone_key(telefono));

create or replace function public.acquisition_quick_add(p_indirizzo text, p_nome text, p_telefono text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  cid uuid;
  aid uuid;
  nome text := trim(coalesce(p_nome, ''));
  tel text := nullif(trim(coalesce(p_telefono, '')), '');
begin
  if length(trim(coalesce(p_indirizzo, ''))) = 0 then
    raise exception 'Scrivi l''indirizzo dell''immobile' using errcode = '23514';
  end if;
  if length(nome) > 0 then
    -- Stesso telefono = stesso proprietario (tra i contatti che posso vedere)
    if tel is not null then
      select c.id into cid from public.contacts c
      where c.agency_id = public.get_my_agency_id() and public.phone_key(c.telefono) = public.phone_key(tel)
      limit 1;
    end if;
    if cid is null then
      insert into public.contacts (nome, cognome, telefono, tipo)
      values (split_part(nome, ' ', 1), trim(substr(nome, length(split_part(nome, ' ', 1)) + 1)), tel, 'proprietario')
      returning id into cid;
    end if;
  end if;
  insert into public.acquisitions (indirizzo, contact_id) values (trim(p_indirizzo), cid) returning id into aid;
  return aid;
end $$;
