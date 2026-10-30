-- =====================================================================
-- ACQUISIZIONI: pipeline per trovare il proprietario e ottenere l'incarico
-- Usa le tabelle esistenti (contacts per il proprietario, properties per l'incarico,
-- activities per la cronologia). Stesse regole di accesso delle trattative:
-- l'agente vede e modifica solo le proprie, il titolare tutte.
-- =====================================================================

create type public.fonte_acquisizione as enum ('passaparola', 'cartello', 'portale', 'telefonata', 'porta_a_porta', 'social', 'altro');
create type public.fase_acquisizione as enum (
  'segnalazione', 'primo_contatto', 'valutazione_fissata', 'valutazione_fatta', 'proposta_incarico', 'incarico_firmato', 'persa'
);
create type public.motivo_perdita_acquisizione as enum ('prezzo', 'altra_agenzia', 'non_vende_piu', 'privato', 'altro');

create table public.acquisitions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.get_my_agency_id() references public.agencies (id) on delete cascade,
  agente_id uuid default auth.uid(),
  contact_id uuid,
  indirizzo text not null check (length(trim(indirizzo)) > 0),
  citta text,
  zona text,
  tipo_immobile public.tipo_immobile,
  mq_stimati integer check (mq_stimati is null or mq_stimati > 0),
  prezzo_richiesto numeric(12, 2) check (prezzo_richiesto is null or prezzo_richiesto >= 0),
  prezzo_valutato numeric(12, 2) check (prezzo_valutato is null or prezzo_valutato >= 0),
  fonte public.fonte_acquisizione,
  fase public.fase_acquisizione not null default 'segnalazione',
  fase_dal timestamptz not null default now(),
  motivo_perdita public.motivo_perdita_acquisizione,
  temperatura public.temperatura_contatto not null default 'tiepido',
  prossima_azione text,
  prossima_azione_data date,
  property_id uuid,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, agency_id),
  check (fase <> 'persa' or motivo_perdita is not null),
  foreign key (agente_id, agency_id) references public.profiles (id, agency_id) on delete set null (agente_id),
  foreign key (contact_id, agency_id) references public.contacts (id, agency_id) on delete set null (contact_id),
  foreign key (property_id, agency_id) references public.properties (id, agency_id) on delete set null (property_id)
);

create index on public.acquisitions (agency_id, fase);
create index on public.acquisitions (agente_id, agency_id);
create index on public.acquisitions (contact_id, agency_id);
create index on public.acquisitions (property_id, agency_id);
create index on public.acquisitions (agency_id, prossima_azione_data) where fase not in ('incarico_firmato', 'persa');

create trigger acquisitions_updated_at before update on public.acquisitions
  for each row execute function public.set_updated_at();

-- ---------- RLS ----------
alter table public.acquisitions enable row level security;

create policy "acquisizioni: lettura proprie o titolare" on public.acquisitions
  for select to authenticated
  using (agency_id = (select public.get_my_agency_id())
    and ((select public.is_titolare()) or agente_id = (select auth.uid())));
create policy "acquisizioni: inserimento" on public.acquisitions
  for insert to authenticated
  with check (agency_id = (select public.get_my_agency_id())
    and ((select public.is_titolare()) or agente_id = (select auth.uid()))
    and fase not in ('incarico_firmato', 'persa') and property_id is null);
create policy "acquisizioni: modifica titolare o assegnato" on public.acquisitions
  for update to authenticated
  using (agency_id = (select public.get_my_agency_id())
    and ((select public.is_titolare()) or agente_id = (select auth.uid())))
  with check (agency_id = (select public.get_my_agency_id())
    and ((select public.is_titolare()) or agente_id = (select auth.uid())));
create policy "acquisizioni: eliminazione titolare o assegnato" on public.acquisitions
  for delete to authenticated
  using (agency_id = (select public.get_my_agency_id())
    and ((select public.is_titolare()) or agente_id = (select auth.uid())));

-- Fase, data della fase, motivo di perdita e immobile collegato cambiano solo con acquisition_set_phase()
revoke update on public.acquisitions from authenticated;
grant update (agente_id, contact_id, indirizzo, citta, zona, tipo_immobile, mq_stimati, prezzo_richiesto, prezzo_valutato,
              fonte, temperatura, prossima_azione, prossima_azione_data, note)
  on public.acquisitions to authenticated;

-- ---------- Etichette e cronologia ----------
create or replace function public.fase_acquisizione_label(f public.fase_acquisizione)
returns text language sql immutable set search_path = '' as $$
  select case f
    when 'segnalazione' then 'Segnalazione'
    when 'primo_contatto' then 'Primo contatto'
    when 'valutazione_fissata' then 'Valutazione fissata'
    when 'valutazione_fatta' then 'Valutazione fatta'
    when 'proposta_incarico' then 'Proposta di incarico'
    when 'incarico_firmato' then 'Incarico firmato'
    when 'persa' then 'Persa'
  end
$$;

create or replace function public.log_acquisition_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.contact_id is null then return new; end if;
  if tg_op = 'INSERT' then
    insert into public.activities (agency_id, utente_id, contact_id, tipo, descrizione)
    values (new.agency_id, auth.uid(), new.contact_id, 'nota', format('Nuova acquisizione: %s', new.indirizzo));
  elsif new.fase is distinct from old.fase then
    insert into public.activities (agency_id, utente_id, contact_id, property_id, tipo, descrizione)
    values (new.agency_id, auth.uid(), new.contact_id, new.property_id, 'cambio_fase',
            format('Acquisizione di %s: da "%s" a "%s"', new.indirizzo,
                   public.fase_acquisizione_label(old.fase), public.fase_acquisizione_label(new.fase)));
  elsif old.contact_id is null then
    insert into public.activities (agency_id, utente_id, contact_id, tipo, descrizione)
    values (new.agency_id, auth.uid(), new.contact_id, 'nota', format('Collegato come proprietario: %s', new.indirizzo));
  end if;
  return new;
end $$;

create trigger acquisitions_log after insert or update on public.acquisitions
  for each row execute function public.log_acquisition_change();

-- ---------- Inserimento rapido: indirizzo + nome + telefono ----------
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
      where regexp_replace(c.telefono, '\D', '', 'g') = regexp_replace(tel, '\D', '', 'g')
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

-- ---------- Cambio fase (con i controlli lato server) ----------
-- Persa → motivo obbligatorio. Incarico firmato → crea l'immobile con i dati raccolti e collega il proprietario.
-- Restituisce l'id dell'immobile creato (solo per "incarico_firmato").
create or replace function public.acquisition_set_phase(p_id uuid, p_fase public.fase_acquisizione, p_motivo public.motivo_perdita_acquisizione)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  a public.acquisitions;
  prezzo numeric;
  pid uuid;
begin
  select * into a from public.acquisitions
  where id = p_id and agency_id = public.get_my_agency_id()
    and (public.is_titolare() or agente_id = (select auth.uid()))
  for update;
  if a.id is null then raise exception 'Acquisizione non trovata' using errcode = 'P0002'; end if;
  if a.fase = p_fase then return a.property_id; end if;
  if a.fase = 'incarico_firmato' then
    raise exception 'L''incarico è già firmato: l''immobile è tra gli Immobili' using errcode = '23514';
  end if;

  if p_fase = 'persa' then
    if p_motivo is null then raise exception 'Scegli il motivo per cui è persa' using errcode = '23514'; end if;
    update public.acquisitions set fase = 'persa', motivo_perdita = p_motivo, fase_dal = now() where id = a.id;
    return null;
  end if;

  if p_fase = 'incarico_firmato' then
    prezzo := coalesce(a.prezzo_valutato, a.prezzo_richiesto);
    if a.contact_id is null then raise exception 'Aggiungi il proprietario prima di segnare l''incarico firmato' using errcode = '23514'; end if;
    if length(trim(coalesce(a.citta, ''))) = 0 then raise exception 'Scrivi la città dell''immobile' using errcode = '23514'; end if;
    if prezzo is null then raise exception 'Scrivi il prezzo dell''incarico' using errcode = '23514'; end if;

    insert into public.properties (agency_id, agente_id, tipo, titolo, indirizzo, citta, zona, mq, prezzo, owner_id,
                                   data_incarico, scadenza_incarico, descrizione)
    values (a.agency_id, coalesce(a.agente_id, (select auth.uid())), coalesce(a.tipo_immobile, 'appartamento'),
            initcap(coalesce(a.tipo_immobile::text, 'immobile')) || coalesce(' di ' || a.mq_stimati || ' mq', '') || ' in ' || a.indirizzo,
            a.indirizzo, a.citta, coalesce(nullif(trim(a.zona), ''), a.citta), a.mq_stimati, prezzo, a.contact_id,
            (now() at time zone 'Europe/Rome')::date, (now() at time zone 'Europe/Rome')::date + 180, a.note)
    returning id into pid;

    -- Il proprietario resta tale anche se era stato inserito come acquirente
    update public.contacts set tipo = 'entrambi' where id = a.contact_id and tipo = 'acquirente';

    update public.acquisitions
    set fase = 'incarico_firmato', fase_dal = now(), motivo_perdita = null, property_id = pid,
        prossima_azione = null, prossima_azione_data = null
    where id = a.id;
    return pid;
  end if;

  update public.acquisitions set fase = p_fase, fase_dal = now(), motivo_perdita = null where id = a.id;
  return null;
end $$;

revoke execute on function public.acquisition_set_phase(uuid, public.fase_acquisizione, public.motivo_perdita_acquisizione) from public, anon;
revoke execute on function public.acquisition_quick_add(text, text, text) from public, anon;
revoke execute on function public.log_acquisition_change() from public, anon, authenticated;
grant execute on function public.acquisition_set_phase(uuid, public.fase_acquisizione, public.motivo_perdita_acquisizione),
  public.acquisition_quick_add(text, text, text) to authenticated;
