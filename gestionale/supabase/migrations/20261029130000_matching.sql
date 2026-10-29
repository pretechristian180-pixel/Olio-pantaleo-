-- =====================================================================
-- Matching automatico immobili ↔ acquirenti
-- 1. Zone dell'agenzia da una lista (niente più "Murat" vs "Bari – Murat")
-- 2. Punteggio calcolato nel database, con i motivi leggibili
-- 3. Archivio dei match con stato (da proporre, proposto, interessato, scartato)
--    e promemoria automatici all'agente che segue ciascun acquirente
-- =====================================================================

-- ---------- 1. Zone ----------
create table public.zones (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.get_my_agency_id() references public.agencies (id) on delete cascade,
  nome text not null check (length(trim(nome)) between 2 and 80),
  created_at timestamptz not null default now()
);
create unique index zones_agency_nome_idx on public.zones (agency_id, lower(trim(nome)));

alter table public.zones enable row level security;
create policy "zone: lettura agenzia" on public.zones
  for select to authenticated using (agency_id = (select public.get_my_agency_id()));
-- Chiunque in agenzia può aggiungere una zona mentre inserisce un immobile o un cliente
create policy "zone: inserimento agenzia" on public.zones
  for insert to authenticated with check (agency_id = (select public.get_my_agency_id()));
create policy "zone: modifica titolare" on public.zones
  for update to authenticated
  using (agency_id = (select public.get_my_agency_id()) and (select public.is_titolare()))
  with check (agency_id = (select public.get_my_agency_id()));
create policy "zone: eliminazione titolare" on public.zones
  for delete to authenticated
  using (agency_id = (select public.get_my_agency_id()) and (select public.is_titolare()));
revoke all on public.zones from anon;

-- Le zone già usate entrano nella lista
insert into public.zones (agency_id, nome)
select distinct agency_id, trim(zona) from public.properties where length(trim(coalesce(zona, ''))) >= 2
on conflict do nothing;
insert into public.zones (agency_id, nome)
select distinct sc.agency_id, trim(z) from public.search_criteria sc, unnest(sc.zone) z where length(trim(z)) >= 2
on conflict do nothing;

-- Ogni zona scritta su un immobile o in una ricerca finisce nella lista
create or replace function public.sync_zones()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'properties' then
    if length(trim(coalesce(new.zona, ''))) >= 2 then
      insert into public.zones (agency_id, nome) values (new.agency_id, trim(new.zona)) on conflict do nothing;
    end if;
  else
    insert into public.zones (agency_id, nome)
    select new.agency_id, trim(z) from unnest(new.zone) z where length(trim(z)) >= 2
    on conflict do nothing;
  end if;
  return new;
end $$;

create trigger properties_zones after insert or update of zona on public.properties
  for each row execute function public.sync_zones();
create trigger search_criteria_zones after insert or update of zone on public.search_criteria
  for each row execute function public.sync_zones();

-- ---------- 2. Punteggio ----------
-- Requisiti obbligatori (se mancano, nessun match): contratto, budget con il 10% di margine,
-- metri quadri con il 10% di margine, zona (se il cliente ne ha indicate).
-- Il resto aggiunge o toglie punti. Restituisce punteggio null se l'immobile non è compatibile.
create or replace function public.match_eval(
  p public.properties, sc public.search_criteria, out punteggio integer, out motivi text[]
) language plpgsql immutable set search_path = '' as $$
declare
  s integer := 45;
  m text[] := '{}';
  zone_cliente text[];
  diff integer;
begin
  punteggio := null;
  motivi := '{}';

  if sc.contratto is not null and sc.contratto <> p.contratto then return; end if;
  if sc.budget_max is not null and p.prezzo > sc.budget_max * 1.10 then return; end if;
  if sc.mq_min is not null and p.mq is not null and p.mq < sc.mq_min * 0.9 then return; end if;

  zone_cliente := array(select lower(trim(z)) from unnest(sc.zone) z where trim(z) <> '');
  if cardinality(zone_cliente) > 0 then
    if lower(trim(coalesce(p.zona, ''))) = any (zone_cliente) or lower(trim(p.citta)) = any (zone_cliente) then
      s := s + 15;
      m := m || 'Zona giusta'::text;
    else
      return;
    end if;
  end if;

  if sc.budget_max is not null then
    if p.prezzo <= sc.budget_max then
      s := s + 20;
      m := m || 'Nel budget'::text;
    else
      s := s + 5;
      m := m || format('%s%% sopra il budget', ceil((p.prezzo / sc.budget_max - 1) * 100));
    end if;
  end if;
  if sc.budget_min is not null and p.prezzo < sc.budget_min * 0.8 then
    s := s - 10;
    m := m || 'Sotto il budget minimo'::text;
  end if;

  if sc.mq_min is not null and p.mq is not null then
    if p.mq >= sc.mq_min then
      s := s + 10;
      m := m || format('%s mq', p.mq);
    else
      m := m || format('%s mq, poco meno dei %s chiesti', p.mq, sc.mq_min);
    end if;
  end if;

  if sc.locali_min is not null and p.locali is not null then
    diff := p.locali - sc.locali_min;
    if diff >= 0 then
      s := s + 10;
      m := m || (case when diff = 0 then 'Locali giusti' when diff = 1 then '1 locale in più' else format('%s locali in più', diff) end);
    else
      s := s - 10;
      m := m || (case when diff = -1 then '1 locale in meno' else format('%s locali in meno', -diff) end);
    end if;
  end if;

  if sc.tipo is not null then
    if sc.tipo = p.tipo then
      s := s + 10;
      m := m || 'Tipo giusto'::text;
    else
      s := s - 15;
      m := m || 'Tipo diverso'::text;
    end if;
  end if;

  punteggio := greatest(0, least(100, s));
  motivi := m;
end $$;

-- ---------- 3. Archivio dei match ----------
create type public.stato_match as enum ('da_proporre', 'proposto', 'interessato', 'scartato');

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  property_id uuid not null,
  contact_id uuid not null,
  punteggio integer not null check (punteggio between 0 and 100),
  motivi text[] not null default '{}',
  stato public.stato_match not null default 'da_proporre',
  proposto_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, contact_id),
  foreign key (property_id, agency_id) references public.properties (id, agency_id) on delete cascade,
  foreign key (contact_id, agency_id) references public.contacts (id, agency_id) on delete cascade
);
create index matches_agency_stato_idx on public.matches (agency_id, stato);
create index matches_property_idx on public.matches (property_id, agency_id, punteggio desc);
create index matches_contact_idx on public.matches (contact_id, agency_id, punteggio desc);

alter table public.matches enable row level security;
-- Si vedono i match dei contatti che si possono vedere (l'agente i suoi, il titolare tutti)
create policy "match: lettura se vede il contatto" on public.matches
  for select to authenticated
  using (agency_id = (select public.get_my_agency_id())
    and exists (select 1 from public.contacts c where c.id = matches.contact_id));
-- Lo stato lo cambia chi segue il cliente (o il titolare)
create policy "match: modifica stato" on public.matches
  for update to authenticated
  using (agency_id = (select public.get_my_agency_id()) and public.can_edit_contact(contact_id))
  with check (agency_id = (select public.get_my_agency_id()) and public.can_edit_contact(contact_id));
create policy "match: eliminazione titolare" on public.matches
  for delete to authenticated
  using (agency_id = (select public.get_my_agency_id()) and (select public.is_titolare()));
-- I match li crea solo il database: dall'app si cambia soltanto lo stato
revoke all on public.matches from anon;
revoke insert, update on public.matches from authenticated;
grant update (stato) on public.matches to authenticated;

create trigger matches_updated_at before update on public.matches
  for each row execute function public.set_updated_at();

-- Ricalcola i match di un immobile. Non tocca quelli già proposti, interessati o scartati:
-- chi ha scartato un immobile non se lo vede riproporre.
-- Avvisa ogni agente con una "cosa da fare" quando compaiono nuovi acquirenti suoi.
create or replace function public.refresh_matches_for_property(pid uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  p public.properties;
  avvisi integer := 0;
begin
  select * into p from public.properties where id = pid;
  if not found then return 0; end if;

  if p.stato <> 'disponibile' then
    delete from public.matches where property_id = pid and stato = 'da_proporre';
    return 0;
  end if;

  with cand as (
    select sc.contact_id, e.punteggio, e.motivi
    from public.search_criteria sc
    join public.contacts c on c.id = sc.contact_id
    cross join lateral public.match_eval(p, sc) e
    where sc.agency_id = p.agency_id
      and c.tipo in ('acquirente', 'entrambi')
      and c.id is distinct from p.owner_id
      and e.punteggio is not null
  ), vecchi as (
    delete from public.matches m
    where m.property_id = pid and m.stato = 'da_proporre'
      and not exists (select 1 from cand where cand.contact_id = m.contact_id)
  ), ins as (
    insert into public.matches as m (agency_id, property_id, contact_id, punteggio, motivi)
    select p.agency_id, pid, contact_id, punteggio, motivi from cand
    on conflict (property_id, contact_id) do update
      set punteggio = excluded.punteggio, motivi = excluded.motivi
      where m.stato = 'da_proporre'
    returning m.contact_id, (xmax = 0) as nuovo
  )
  insert into public.tasks (agency_id, assegnato_a, property_id, titolo, scadenza, origine)
  select p.agency_id, c.agente_id, pid,
         case when count(*) = 1 then format('1 acquirente compatibile per %s', p.indirizzo)
              else format('%s acquirenti compatibili per %s', count(*), p.indirizzo) end,
         (now() at time zone 'Europe/Rome')::date, 'automatica'
  from ins join public.contacts c on c.id = ins.contact_id
  where ins.nuovo and c.agente_id is not null
  group by c.agente_id;
  get diagnostics avvisi = row_count;
  return avvisi;
end $$;

-- Ricalcola i match di un acquirente (quando cambia cosa cerca)
create or replace function public.refresh_matches_for_contact(cid uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  c public.contacts;
  sc public.search_criteria;
  nuovi integer := 0;
begin
  select * into c from public.contacts where id = cid;
  select * into sc from public.search_criteria where contact_id = cid;
  if c.id is null or sc.id is null or c.tipo = 'proprietario' then
    delete from public.matches where contact_id = cid and stato = 'da_proporre';
    return 0;
  end if;

  with cand as (
    select p.id as property_id, e.punteggio, e.motivi
    from public.properties p
    cross join lateral public.match_eval(p, sc) e
    where p.agency_id = c.agency_id
      and p.stato = 'disponibile'
      and p.owner_id is distinct from cid
      and e.punteggio is not null
  ), vecchi as (
    delete from public.matches m
    where m.contact_id = cid and m.stato = 'da_proporre'
      and not exists (select 1 from cand where cand.property_id = m.property_id)
  ), ins as (
    insert into public.matches as m (agency_id, property_id, contact_id, punteggio, motivi)
    select c.agency_id, property_id, cid, punteggio, motivi from cand
    on conflict (property_id, contact_id) do update
      set punteggio = excluded.punteggio, motivi = excluded.motivi
      where m.stato = 'da_proporre'
    returning (xmax = 0) as nuovo
  )
  select count(*) filter (where nuovo) into nuovi from ins;

  if nuovi > 0 and c.agente_id is not null then
    insert into public.tasks (agency_id, assegnato_a, contact_id, titolo, scadenza, origine)
    values (c.agency_id, c.agente_id, cid,
            case when nuovi = 1 then trim(format('1 immobile compatibile per %s %s', c.nome, c.cognome))
                 else trim(format('%s immobili compatibili per %s %s', nuovi, c.nome, c.cognome)) end,
            (now() at time zone 'Europe/Rome')::date, 'automatica');
  end if;
  return nuovi;
end $$;

-- Quando cambiare un dato può cambiare i match
create or replace function public.on_property_for_matching()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.refresh_matches_for_property(new.id);
  return new;
end $$;
create trigger properties_matching
  after insert or update of prezzo, stato, mq, locali, zona, citta, tipo, contratto, owner_id on public.properties
  for each row execute function public.on_property_for_matching();

create or replace function public.on_search_for_matching()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    delete from public.matches where contact_id = old.contact_id and stato = 'da_proporre';
    return old;
  end if;
  perform public.refresh_matches_for_contact(new.contact_id);
  return new;
end $$;
create trigger search_criteria_matching after insert or update or delete on public.search_criteria
  for each row execute function public.on_search_for_matching();

create or replace function public.on_contact_for_matching()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.refresh_matches_for_contact(new.id);
  return new;
end $$;
create trigger contacts_matching after update of tipo on public.contacts
  for each row execute function public.on_contact_for_matching();

-- Cambio di stato del match: data della proposta e riga in cronologia
create or replace function public.on_match_status()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  p public.properties;
  testo text;
begin
  if new.stato is not distinct from old.stato then return new; end if;
  select * into p from public.properties where id = new.property_id;
  testo := format('%s, %s (%s €)', p.indirizzo, p.citta, replace(to_char(p.prezzo, 'FM999,999,999'), ',', '.'));
  if new.stato = 'proposto' then
    update public.matches set proposto_at = now() where id = new.id and proposto_at is null;
    insert into public.activities (agency_id, utente_id, contact_id, property_id, tipo, descrizione)
    values (new.agency_id, auth.uid(), new.contact_id, new.property_id, 'whatsapp', 'Proposto su WhatsApp: ' || testo);
  elsif new.stato = 'interessato' then
    insert into public.activities (agency_id, utente_id, contact_id, property_id, tipo, descrizione)
    values (new.agency_id, auth.uid(), new.contact_id, new.property_id, 'nota', 'Interessato a ' || testo);
  elsif new.stato = 'scartato' then
    insert into public.activities (agency_id, utente_id, contact_id, property_id, tipo, descrizione)
    values (new.agency_id, auth.uid(), new.contact_id, new.property_id, 'nota', 'Non interessato a ' || testo);
  end if;
  return new;
end $$;
create trigger matches_status after update of stato on public.matches
  for each row execute function public.on_match_status();

-- Funzioni interne: solo per i trigger
revoke execute on function public.sync_zones() from public, anon, authenticated;
revoke execute on function public.refresh_matches_for_property(uuid) from public, anon, authenticated;
revoke execute on function public.refresh_matches_for_contact(uuid) from public, anon, authenticated;
revoke execute on function public.on_property_for_matching() from public, anon, authenticated;
revoke execute on function public.on_search_for_matching() from public, anon, authenticated;
revoke execute on function public.on_contact_for_matching() from public, anon, authenticated;
revoke execute on function public.on_match_status() from public, anon, authenticated;
revoke execute on function public.match_eval(public.properties, public.search_criteria) from public, anon;

-- Match per i dati già presenti
select public.refresh_matches_for_property(id) from public.properties where stato = 'disponibile';
