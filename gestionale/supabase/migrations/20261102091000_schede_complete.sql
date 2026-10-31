-- =====================================================================
-- Schede complete (2/2)
--  - Contatti: etichette, compleanno, consenso al marketing
--  - Richieste: caratteristiche, nome, attiva (più richieste per cliente: vedi 20261102092000)
--  - Immobili: caratteristiche, posizione sulla mappa
--  - Matching: tiene conto delle caratteristiche e di più richieste per cliente
--  - Archivio documenti, checklist documentale e antiriciclaggio
--  - Scheda della visita (impressioni del cliente)
-- Tutte le nuove tabelle hanno agency_id e RLS con get_my_agency_id().
-- =====================================================================

-- ---------- Contatti ----------
alter table public.contacts add column if not exists etichette text[] not null default '{}';
alter table public.contacts add column if not exists data_nascita date;
alter table public.contacts add column if not exists consenso_marketing boolean not null default false;
alter table public.contacts add column if not exists consenso_marketing_at timestamptz;
create index if not exists contacts_etichette on public.contacts using gin (etichette);

create or replace function public.contacts_consenso_data()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.consenso_marketing and (tg_op = 'INSERT' or not old.consenso_marketing) then
    new.consenso_marketing_at := now();
  elsif not new.consenso_marketing then
    new.consenso_marketing_at := null;
  end if;
  return new;
end $$;
create trigger contacts_consenso before insert or update of consenso_marketing on public.contacts
  for each row execute function public.contacts_consenso_data();

-- ---------- Richieste ----------
alter table public.search_criteria add column if not exists nome text;
alter table public.search_criteria add column if not exists caratteristiche text[] not null default '{}';
alter table public.search_criteria add column if not exists attiva boolean not null default true;
alter table public.search_criteria add column if not exists note text;
alter table public.search_criteria add column if not exists created_at timestamptz not null default now();

-- ---------- Immobili ----------
alter table public.properties add column if not exists caratteristiche text[] not null default '{}';
alter table public.properties add column if not exists lat numeric(9, 6) check (lat is null or lat between -90 and 90);
alter table public.properties add column if not exists lng numeric(9, 6) check (lng is null or lng between -180 and 180);

-- ---------- Matching ----------
create or replace function public.match_eval(
  p public.properties, sc public.search_criteria, out punteggio integer, out motivi text[]
) language plpgsql immutable set search_path = '' as $$
declare
  s integer := 45;
  m text[] := '{}';
  zone_cliente text[];
  diff integer;
  volute text[];
  presenti text[];
  mancanti text[];
begin
  punteggio := null;
  motivi := '{}';

  if not coalesce(sc.attiva, true) then return; end if;
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

  -- Caratteristiche desiderate (balcone, box, ascensore…): punti per quelle presenti, meno per quelle che mancano
  volute := array(select lower(trim(x)) from unnest(coalesce(sc.caratteristiche, '{}')) x where trim(x) <> '');
  if cardinality(volute) > 0 then
    presenti := array(select v from unnest(volute) v where v = any (array(select lower(trim(y)) from unnest(coalesce(p.caratteristiche, '{}')) y)));
    mancanti := array(select v from unnest(volute) v where not (v = any (presenti)));
    if cardinality(presenti) > 0 then
      s := s + least(12, 4 * cardinality(presenti));
      m := m || format('Ha %s', array_to_string(presenti, ', '));
    end if;
    if cardinality(mancanti) > 0 then
      s := s - least(12, 3 * cardinality(mancanti));
      m := m || format('Senza %s', array_to_string(mancanti, ', '));
    end if;
  end if;

  punteggio := greatest(0, least(100, s));
  motivi := m;
end $$;

-- Più richieste per cliente: per ogni coppia immobile/cliente vale la richiesta con il punteggio migliore
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
    select distinct on (sc.contact_id) sc.contact_id, e.punteggio, e.motivi
    from public.search_criteria sc
    join public.contacts c on c.id = sc.contact_id
    cross join lateral public.match_eval(p, sc) e
    where sc.agency_id = p.agency_id
      and c.tipo in ('acquirente', 'entrambi', 'inquilino')
      and c.id is distinct from p.owner_id
      and e.punteggio is not null
    order by sc.contact_id, e.punteggio desc
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

create or replace function public.refresh_matches_for_contact(cid uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  c public.contacts;
  nuovi integer := 0;
begin
  select * into c from public.contacts where id = cid;
  if c.id is null or c.tipo not in ('acquirente', 'entrambi', 'inquilino')
     or not exists (select 1 from public.search_criteria where contact_id = cid and attiva) then
    delete from public.matches where contact_id = cid and stato = 'da_proporre';
    return 0;
  end if;

  with cand as (
    select distinct on (p.id) p.id as property_id, e.punteggio, e.motivi
    from public.search_criteria sc
    join public.properties p on p.agency_id = c.agency_id and p.stato = 'disponibile' and p.owner_id is distinct from cid
    cross join lateral public.match_eval(p, sc) e
    where sc.contact_id = cid and e.punteggio is not null
    order by p.id, e.punteggio desc
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

create or replace function public.on_search_for_matching()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_matches_for_contact(old.contact_id);
    return old;
  end if;
  perform public.refresh_matches_for_contact(new.contact_id);
  return new;
end $$;

create or replace trigger properties_matching
  after insert or update of prezzo, stato, mq, locali, zona, citta, tipo, contratto, owner_id, caratteristiche on public.properties
  for each row execute function public.on_property_for_matching();

-- =====================================================================
-- Archivio documenti
-- =====================================================================
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.get_my_agency_id() references public.agencies (id) on delete cascade,
  caricato_da uuid default auth.uid(),
  contact_id uuid,
  property_id uuid,
  deal_id uuid,
  acquisition_id uuid,
  categoria text not null default 'altro' check (categoria in (
    'identita', 'provenienza', 'catasto', 'planimetria', 'ape', 'urbanistica', 'impianti', 'condominio',
    'incarico', 'proposta', 'preliminare', 'rogito', 'antiriciclaggio', 'foto', 'altro')),
  nome text not null check (length(trim(nome)) > 0),
  file_path text not null,
  mime text,
  dimensione integer,
  scadenza date,
  note text,
  created_at timestamptz not null default now(),
  unique (id, agency_id),
  check (num_nonnulls(contact_id, property_id, deal_id, acquisition_id) >= 1),
  foreign key (caricato_da, agency_id) references public.profiles (id, agency_id) on delete set null (caricato_da),
  foreign key (contact_id, agency_id) references public.contacts (id, agency_id) on delete cascade,
  foreign key (property_id, agency_id) references public.properties (id, agency_id) on delete cascade,
  foreign key (deal_id, agency_id) references public.deals (id, agency_id) on delete cascade,
  foreign key (acquisition_id, agency_id) references public.acquisitions (id, agency_id) on delete cascade
);
create index on public.documents (contact_id, agency_id);
create index on public.documents (property_id, agency_id);
create index on public.documents (deal_id, agency_id);
create index on public.documents (acquisition_id, agency_id);
create index on public.documents (caricato_da, agency_id);
create index on public.documents (agency_id, scadenza) where scadenza is not null;

alter table public.documents enable row level security;

-- Si vede un documento se si vede ciò a cui è collegato (le policy di contatti, trattative e acquisizioni filtrano già per agente)
create policy "documenti: lettura" on public.documents
  for select to authenticated
  using (agency_id = (select public.get_my_agency_id()) and (
    (select public.is_titolare()) or caricato_da = (select auth.uid())
    or (contact_id is not null and exists (select 1 from public.contacts c where c.id = contact_id))
    or (deal_id is not null and exists (select 1 from public.deals d where d.id = deal_id))
    or (acquisition_id is not null and exists (select 1 from public.acquisitions a where a.id = acquisition_id))
    or (property_id is not null and contact_id is null and deal_id is null and acquisition_id is null)
  ));
create policy "documenti: inserimento" on public.documents
  for insert to authenticated
  with check (agency_id = (select public.get_my_agency_id()) and caricato_da = (select auth.uid()));
create policy "documenti: modifica autore o titolare" on public.documents
  for update to authenticated
  using (agency_id = (select public.get_my_agency_id()) and ((select public.is_titolare()) or caricato_da = (select auth.uid())))
  with check (agency_id = (select public.get_my_agency_id()));
create policy "documenti: eliminazione autore o titolare" on public.documents
  for delete to authenticated
  using (agency_id = (select public.get_my_agency_id()) and ((select public.is_titolare()) or caricato_da = (select auth.uid())));

-- File in un bucket privato, una cartella per agenzia: {agency_id}/{uuid}.{ext}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documenti', 'documenti', false, 20971520,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic',
              'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do nothing;

create policy "documenti: file lettura agenzia" on storage.objects
  for select to authenticated
  using (bucket_id = 'documenti' and (storage.foldername(name))[1] = (select public.get_my_agency_id())::text);
create policy "documenti: file caricamento agenzia" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documenti' and (storage.foldername(name))[1] = (select public.get_my_agency_id())::text);
create policy "documenti: file eliminazione autore o titolare" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documenti' and (storage.foldername(name))[1] = (select public.get_my_agency_id())::text
    and (owner_id = (select auth.uid())::text or (select public.is_titolare())));

-- =====================================================================
-- Checklist: documenti dell'immobile e antiriciclaggio della trattativa
-- =====================================================================
create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.get_my_agency_id() references public.agencies (id) on delete cascade,
  property_id uuid,
  deal_id uuid,
  tipo text not null check (tipo in ('documenti', 'antiriciclaggio')),
  voce text not null check (length(trim(voce)) > 0),
  aiuto text,
  obbligatoria boolean not null default false,
  stato text not null default 'da_fare' check (stato in ('da_fare', 'fatto', 'non_serve')),
  document_id uuid,
  scadenza date,
  nota text,
  completato_da uuid,
  completato_at timestamptz,
  ordine integer not null default 0,
  created_at timestamptz not null default now(),
  check (num_nonnulls(property_id, deal_id) = 1),
  foreign key (property_id, agency_id) references public.properties (id, agency_id) on delete cascade,
  foreign key (deal_id, agency_id) references public.deals (id, agency_id) on delete cascade,
  foreign key (document_id, agency_id) references public.documents (id, agency_id) on delete set null (document_id),
  foreign key (completato_da, agency_id) references public.profiles (id, agency_id) on delete set null (completato_da)
);
create index on public.checklist_items (property_id, agency_id);
create index on public.checklist_items (deal_id, agency_id);
create index on public.checklist_items (document_id, agency_id);
create index on public.checklist_items (completato_da, agency_id);
create index on public.checklist_items (agency_id, stato) where stato = 'da_fare';

alter table public.checklist_items enable row level security;

create policy "checklist: lettura" on public.checklist_items
  for select to authenticated
  using (agency_id = (select public.get_my_agency_id()) and (
    property_id is not null or exists (select 1 from public.deals d where d.id = deal_id)));
create policy "checklist: inserimento" on public.checklist_items
  for insert to authenticated
  with check (agency_id = (select public.get_my_agency_id()) and (
    (select public.is_titolare())
    or (property_id is not null and public.can_edit_property(property_id))
    or (deal_id is not null and exists (select 1 from public.deals d where d.id = deal_id and d.agente_id = (select auth.uid())))));
create policy "checklist: modifica" on public.checklist_items
  for update to authenticated
  using (agency_id = (select public.get_my_agency_id()) and (
    (select public.is_titolare())
    or (property_id is not null and public.can_edit_property(property_id))
    or (deal_id is not null and exists (select 1 from public.deals d where d.id = deal_id and d.agente_id = (select auth.uid())))))
  with check (agency_id = (select public.get_my_agency_id()));
create policy "checklist: eliminazione" on public.checklist_items
  for delete to authenticated
  using (agency_id = (select public.get_my_agency_id()) and (
    (select public.is_titolare())
    or (property_id is not null and public.can_edit_property(property_id))
    or (deal_id is not null and exists (select 1 from public.deals d where d.id = deal_id and d.agente_id = (select auth.uid())))));

-- Chi ha completato una voce e quando (registrazione per l'antiriciclaggio)
create or replace function public.checklist_stamp()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.stato is distinct from old.stato then
    if new.stato = 'da_fare' then
      new.completato_da := null;
      new.completato_at := null;
    else
      new.completato_da := (select auth.uid());
      new.completato_at := now();
    end if;
  end if;
  return new;
end $$;
create trigger checklist_items_stamp before update on public.checklist_items
  for each row execute function public.checklist_stamp();

-- Prepara la checklist standard (una volta sola per immobile o trattativa)
create or replace function public.checklist_prepare(p_property uuid, p_deal uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  ag uuid := public.get_my_agency_id();
  p public.properties;
begin
  if p_property is not null then
    select * into p from public.properties where id = p_property and agency_id = ag;
    if p.id is null then raise exception 'Immobile non trovato' using errcode = 'P0002'; end if;
    if exists (select 1 from public.checklist_items where property_id = p.id and tipo = 'documenti') then return; end if;
    insert into public.checklist_items (agency_id, property_id, tipo, voce, aiuto, obbligatoria, ordine)
    select ag, p.id, 'documenti', v.voce, v.aiuto, v.obbl, v.ord
    from (values
      ('Documento d''identità e codice fiscale dei proprietari', 'Di tutti gli intestatari', true, 1, true),
      ('Incarico di mediazione firmato', null, true, 2, true),
      ('Atto di provenienza', 'Rogito di acquisto, successione o donazione', true, 3, p.contratto = 'vendita'),
      ('Visura catastale aggiornata', null, true, 4, true),
      ('Planimetria catastale', null, true, 5, true),
      ('APE – Attestato di prestazione energetica', 'Vale 10 anni: segna la scadenza', true, 6, true),
      ('Conformità urbanistica e catastale', 'Relazione del tecnico', false, 7, p.contratto = 'vendita'),
      ('Certificato di agibilità', null, false, 8, p.contratto = 'vendita'),
      ('Dichiarazioni di conformità degli impianti', null, false, 9, true),
      ('Spese condominiali e ultime delibere', 'Ultimi 2 anni, con eventuali lavori deliberati', false, 10, p.tipo = 'appartamento'),
      ('Regolamento di condominio', null, false, 11, p.tipo = 'appartamento')
    ) as v(voce, aiuto, obbl, ord, serve)
    where v.serve;
  end if;

  if p_deal is not null then
    if not exists (select 1 from public.deals where id = p_deal and agency_id = ag) then
      raise exception 'Trattativa non trovata' using errcode = 'P0002';
    end if;
    if exists (select 1 from public.checklist_items where deal_id = p_deal and tipo = 'antiriciclaggio') then return; end if;
    insert into public.checklist_items (agency_id, deal_id, tipo, voce, aiuto, obbligatoria, ordine)
    select ag, p_deal, 'antiriciclaggio', v.voce, v.aiuto, v.obbl, v.ord
    from (values
      ('Identificazione del cliente', 'Documento d''identità valido, in copia', true, 1),
      ('Codice fiscale verificato', null, true, 2),
      ('Titolare effettivo', 'Solo se il cliente è una società o un ente', false, 3),
      ('Verifica persona politicamente esposta (PEP)', null, true, 4),
      ('Scopo e natura dell''operazione', null, true, 5),
      ('Origine dei fondi e modalità di pagamento', 'Mutuo, risparmi, vendita di altro immobile…', true, 6),
      ('Profilo di rischio assegnato', 'Basso, medio o alto, con motivazione nella nota', true, 7),
      ('Conservazione di dati e documenti', 'Per 10 anni', true, 8),
      ('Valutazione di eventuale operazione sospetta', 'Solo se ci sono anomalie', false, 9)
    ) as v(voce, aiuto, obbl, ord);
  end if;
end $$;

revoke execute on function public.checklist_prepare(uuid, uuid) from public, anon;
grant execute on function public.checklist_prepare(uuid, uuid) to authenticated;

-- =====================================================================
-- Scheda della visita: le impressioni del cliente
-- =====================================================================
alter table public.appointments add constraint appointments_id_agency_id_key unique (id, agency_id);

create table public.visit_feedback (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.get_my_agency_id() references public.agencies (id) on delete cascade,
  appointment_id uuid not null,
  contact_id uuid,
  property_id uuid,
  agente_id uuid default auth.uid(),
  voto smallint check (voto between 1 and 5),
  piaciuto text,
  non_piaciuto text,
  criticita text,
  giudizio_prezzo text check (giudizio_prezzo in ('basso', 'giusto', 'alto')),
  offerta numeric(12, 2) check (offerta is null or offerta >= 0),
  intenzione text check (intenzione in ('proposta', 'ci_pensa', 'altro_immobile', 'non_interessato')),
  altri_immobili text,
  fonte text not null default 'agente' check (fonte in ('agente', 'cliente')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (appointment_id),
  foreign key (appointment_id, agency_id) references public.appointments (id, agency_id) on delete cascade,
  foreign key (contact_id, agency_id) references public.contacts (id, agency_id) on delete set null (contact_id),
  foreign key (property_id, agency_id) references public.properties (id, agency_id) on delete set null (property_id),
  foreign key (agente_id, agency_id) references public.profiles (id, agency_id) on delete set null (agente_id)
);
create index on public.visit_feedback (contact_id, agency_id);
create index on public.visit_feedback (property_id, agency_id);
create index on public.visit_feedback (agente_id, agency_id);

create trigger visit_feedback_updated_at before update on public.visit_feedback
  for each row execute function public.set_updated_at();

alter table public.visit_feedback enable row level security;

-- Le impressioni sull'immobile servono a tutta l'agenzia (es. report al proprietario)
create policy "visite: lettura agenzia" on public.visit_feedback
  for select to authenticated using (agency_id = (select public.get_my_agency_id()));
create policy "visite: inserimento" on public.visit_feedback
  for insert to authenticated
  with check (agency_id = (select public.get_my_agency_id())
    and ((select public.is_titolare()) or agente_id = (select auth.uid())));
create policy "visite: modifica autore o titolare" on public.visit_feedback
  for update to authenticated
  using (agency_id = (select public.get_my_agency_id()) and ((select public.is_titolare()) or agente_id = (select auth.uid())))
  with check (agency_id = (select public.get_my_agency_id()));
create policy "visite: eliminazione autore o titolare" on public.visit_feedback
  for delete to authenticated
  using (agency_id = (select public.get_my_agency_id()) and ((select public.is_titolare()) or agente_id = (select auth.uid())));

-- Cronologia del cliente e, se vuole fare una proposta, una cosa da fare subito
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
create trigger visit_feedback_log after insert on public.visit_feedback
  for each row execute function public.log_visit_feedback();

revoke execute on function public.log_visit_feedback() from public, anon, authenticated;
revoke execute on function public.checklist_stamp() from public, anon, authenticated;
revoke execute on function public.contacts_consenso_data() from public, anon, authenticated;
