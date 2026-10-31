-- =====================================================================
-- IMPORTAZIONE GUIDATA: contatti, richieste, immobili, acquisizioni, appuntamenti da Excel/CSV
-- Il file viene letto nel browser; le righe finiscono in import_rows e il database le pulisce,
-- riconosce i doppioni e le importa a blocchi (anche a pagina chiusa, con pg_cron).
-- Solo il titolare. I contatti importati hanno importato = true (niente benvenuto automatico).
-- Durante l'importazione niente promemoria automatici a pioggia (cose da fare, automazioni).
-- =====================================================================

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.get_my_agency_id() references public.agencies (id) on delete cascade,
  creato_da uuid default auth.uid(),
  tipo text not null check (tipo in ('contatti', 'richieste', 'immobili', 'acquisizioni', 'appuntamenti')),
  file_url text,
  nome_file text not null,
  righe_totali integer not null default 0,
  righe_importate integer not null default 0,
  righe_aggiornate integer not null default 0,
  righe_saltate integer not null default 0,
  righe_scartate integer not null default 0,
  mappatura_colonne jsonb not null default '{}',
  opzione_duplicati text not null default 'salta' check (opzione_duplicati in ('salta', 'aggiorna', 'crea')),
  stato text not null default 'caricato' check (stato in ('caricato', 'mappatura', 'anteprima', 'in_corso', 'completato', 'annullato', 'errore')),
  errore text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (id, agency_id),
  foreign key (creato_da, agency_id) references public.profiles (id, agency_id) on delete set null (creato_da)
);
create index on public.import_jobs (agency_id, created_at desc);
create index on public.import_jobs (creato_da, agency_id);
create index on public.import_jobs (stato) where stato = 'in_corso';

create table public.import_rows (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.get_my_agency_id() references public.agencies (id) on delete cascade,
  import_job_id uuid not null,
  numero_riga integer not null,
  dati_originali jsonb not null,
  esito text check (esito in ('ok', 'duplicato', 'errore')),
  azione text check (azione in ('creato', 'aggiornato', 'saltato')),
  messaggio text,
  chiave text,
  record_id uuid,
  -- Contatti creati di passaggio (es. il proprietario di un immobile), da togliere se si annulla
  record_extra uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (import_job_id, numero_riga),
  foreign key (import_job_id, agency_id) references public.import_jobs (id, agency_id) on delete cascade
);
create index on public.import_rows (import_job_id, numero_riga) where esito is null;
create index on public.import_rows (import_job_id, chiave);

create trigger import_jobs_updated_at before update on public.import_jobs for each row execute function public.set_updated_at();

alter table public.import_jobs enable row level security;
alter table public.import_rows enable row level security;

create policy "importazioni: titolare" on public.import_jobs
  for all to authenticated
  using (agency_id = (select public.get_my_agency_id()) and (select public.is_titolare()))
  with check (agency_id = (select public.get_my_agency_id()) and (select public.is_titolare()));
create policy "righe importazione: titolare" on public.import_rows
  for all to authenticated
  using (agency_id = (select public.get_my_agency_id()) and (select public.is_titolare()))
  with check (agency_id = (select public.get_my_agency_id()) and (select public.is_titolare()));

-- Esito, contatori e stato li scrive solo il database
revoke update on public.import_jobs from authenticated;
grant update (mappatura_colonne, opzione_duplicati, file_url) on public.import_jobs to authenticated;
revoke update on public.import_rows from authenticated;

-- ---------- File: bucket privato, una cartella per agenzia ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imports', 'imports', false, 20971520,
        array['text/csv', 'text/plain', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do nothing;

create policy "imports: lettura titolare" on storage.objects
  for select to authenticated
  using (bucket_id = 'imports' and (storage.foldername(name))[1] = (select public.get_my_agency_id())::text and (select public.is_titolare()));
create policy "imports: caricamento titolare" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'imports' and (storage.foldername(name))[1] = (select public.get_my_agency_id())::text and (select public.is_titolare()));

-- ---------- Niente promemoria a pioggia durante l'importazione ----------
create or replace function public.import_in_corso()
returns boolean language sql stable set search_path = '' as $$
  select coalesce(current_setting('mattonio.importazione', true), '') = 'on'
$$;

create or replace function public.import_skip_auto_tasks()
returns trigger language plpgsql set search_path = '' as $$
begin
  if public.import_in_corso() and new.origine = 'automatica' then return null; end if;
  return new;
end $$;
create trigger tasks_import_silenzio before insert on public.tasks
  for each row execute function public.import_skip_auto_tasks();

-- Le automazioni non partono per i dati importati, tranne i promemoria degli appuntamenti futuri
create or replace function public.import_skip_automation_runs()
returns trigger language plpgsql set search_path = '' as $$
begin
  if public.import_in_corso() and new.entita_tipo <> 'appointment' then return null; end if;
  return new;
end $$;
create trigger automation_runs_import_silenzio before insert on public.automation_runs
  for each row execute function public.import_skip_automation_runs();

-- ---------- Pulizia dei valori ----------
create or replace function public.imp_txt(t text)
returns text language sql immutable set search_path = '' as $$
  select nullif(btrim(regexp_replace(coalesce(t, ''), '\s+', ' ', 'g')), '')
$$;

create or replace function public.imp_nome(t text)
returns text language sql immutable set search_path = '' as $$
  select initcap(lower(public.imp_txt(t)))
$$;

-- Telefoni in formato internazionale: "333 123 4567" → "+39 3331234567"
create or replace function public.imp_telefono(t text)
returns text language plpgsql immutable set search_path = '' as $$
declare d text := regexp_replace(coalesce(t, ''), '\D', '', 'g');
begin
  if d = '' then return null; end if;
  if btrim(t) like '+%' then
    return case when d like '39%' then '+39 ' || substr(d, 3) else '+' || d end;
  end if;
  if d like '00%' then d := substr(d, 3); return case when d like '39%' then '+39 ' || substr(d, 3) else '+' || d end; end if;
  if d like '39%' and length(d) >= 11 then return '+39 ' || substr(d, 3); end if;
  if length(d) between 6 and 11 then return '+39 ' || d; end if;
  return d;
end $$;

create or replace function public.imp_email(t text)
returns text language sql immutable set search_path = '' as $$
  select case when lower(btrim(t)) ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then lower(btrim(t)) end
$$;

-- Numeri all'italiana: "€ 250.000,00" → 250000; "1.250,5" → 1250.5; "95 mq" → 95
create or replace function public.imp_numero(t text)
returns numeric language plpgsql immutable set search_path = '' as $$
declare s text := regexp_replace(coalesce(t, ''), '[^0-9,.\-]', '', 'g');
begin
  if s = '' or s = '-' then return null; end if;
  if s like '%,%' and s like '%.%' then
    if strpos(reverse(s), ',') < strpos(reverse(s), '.') then s := replace(replace(s, '.', ''), ',', '.');
    else s := replace(s, ',', ''); end if;
  elsif s like '%,%' then
    s := case when s ~ ',\d{1,2}$' and s !~ ',.*,' then replace(s, ',', '.') else replace(s, ',', '') end;
  elsif s ~ '^-?\d{1,3}(\.\d{3})+$' then
    s := replace(s, '.', '');
  end if;
  return s::numeric;
exception when others then return null;
end $$;

-- Date: 2026-03-15, 15/03/2026, 15-03-26, 15.03.2026
create or replace function public.imp_data(t text)
returns date language plpgsql immutable set search_path = '' as $$
declare s text := btrim(coalesce(t, '')); m text[];
begin
  if s = '' then return null; end if;
  if s ~ '^\d{4}-\d{1,2}-\d{1,2}' then return substr(s, 1, 10)::date; end if;
  m := regexp_match(s, '^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})');
  if m is not null then
    return make_date(case when length(m[3]) = 2 then 2000 + m[3]::int - case when m[3]::int > 50 then 100 else 0 end else m[3]::int end, m[2]::int, m[1]::int);
  end if;
  return null;
exception when others then return null;
end $$;

create or replace function public.imp_ora(t text)
returns time language plpgsql immutable set search_path = '' as $$
declare m text[] := regexp_match(coalesce(t, ''), '(\d{1,2})[:.](\d{2})');
begin
  if m is null then return null; end if;
  return make_time(m[1]::int, m[2]::int, 0);
exception when others then return null;
end $$;

-- Tipo di immobile dal testo libero ("Trilocale" è un appartamento, non un locale commerciale)
create or replace function public.imp_tipo_immobile(t text, p_default boolean)
returns text language sql immutable set search_path = '' as $$
  select case
    when lower(t) ~ 'monolocal|bilocal|trilocal|quadrilocal|pentalocal|appart|attico|mansard|loft' then 'appartamento'
    when lower(t) ~ 'villa|casa ind|villett|rustic|casale|masseri|trull' then 'villa'
    when lower(t) ~ 'negoz|locale|uffic|capann|magazz|laborat' then 'locale'
    when lower(t) ~ 'terren' then 'terreno'
    when lower(t) ~ 'box|garage|cantin|posto auto' then 'altro'
    when p_default then 'appartamento' end
$$;

-- ---------- Da riga del file a dati puliti ----------
-- Restituisce { d: {campi puliti}, note, errore, chiave (per i doppioni), avvisi }
create or replace function public.import_normalize(p_tipo text, p_map jsonb, p_row jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  v jsonb := '{}';
  note text[] := '{}';
  avvisi text[] := '{}';
  col text; campo text; val text;
  d jsonb := '{}';
  errore text;
  chiave text;
  parti text[];
  tel text; mail text; n numeric; dt date;
begin
  for col, val in select key, value #>> '{}' from jsonb_each(p_row) loop
    campo := p_map ->> col;
    if public.imp_txt(val) is null then continue; end if;
    if campo is null or campo = '' then
      note := note || format('%s: %s', col, public.imp_txt(val));
    elsif v ? campo then
      v := v || jsonb_build_object(campo, (v ->> campo) || ' ' || public.imp_txt(val));
    else
      v := v || jsonb_build_object(campo, public.imp_txt(val));
    end if;
  end loop;
  if v ? 'note' then note := array[v ->> 'note'] || note; end if;

  if p_tipo = 'contatti' then
    if v ? 'nome_completo' and not (v ? 'nome') then
      parti := regexp_split_to_array(v ->> 'nome_completo', '\s+');
      v := v || jsonb_build_object('nome', parti[1], 'cognome', array_to_string(parti[2:], ' '));
    elsif v ? 'cognome_nome' and not (v ? 'nome') then
      parti := regexp_split_to_array(v ->> 'cognome_nome', '\s+');
      v := v || jsonb_build_object('cognome', parti[1], 'nome', array_to_string(parti[2:], ' '));
    end if;
    tel := public.imp_telefono(v ->> 'telefono');
    mail := public.imp_email(v ->> 'email');
    if v ? 'email' and mail is null then avvisi := avvisi || format('Email non valida: %s', v ->> 'email'); note := note || format('Email scritta: %s', v ->> 'email'); end if;
    if public.imp_txt(v ->> 'nome') is null and public.imp_txt(v ->> 'cognome') is null then errore := 'Manca il nome'; end if;
    if tel is null and mail is null and errore is null then avvisi := avvisi || 'Né telefono né email'; end if;
    d := jsonb_strip_nulls(jsonb_build_object(
      'nome', coalesce(public.imp_nome(v ->> 'nome'), public.imp_nome(v ->> 'cognome')),
      'cognome', case when public.imp_txt(v ->> 'nome') is null then '' else coalesce(public.imp_nome(v ->> 'cognome'), '') end,
      'telefono', tel, 'email', mail,
      'tipo', case
        when lower(v ->> 'tipo') ~ 'entramb|tutti e due' then 'entrambi'
        when lower(v ->> 'tipo') ~ 'locator|affitta casa|proprietario affitto' then 'locatore'
        when lower(v ->> 'tipo') ~ 'inquilin|affittuar|cerca in affitto' then 'inquilino'
        when lower(v ->> 'tipo') ~ 'propr|vend|venditor' then 'proprietario'
        when lower(v ->> 'tipo') ~ 'collabor|notai|geometr|tecnic|banca' then 'collaboratore'
        when lower(v ->> 'tipo') ~ 'acquir|compra|cerca|client' or v ->> 'tipo' is null then 'acquirente'
        else 'altro' end,
      'fonte', case
        when lower(v ->> 'fonte') ~ 'immobiliare|idealista|casa\.it|portal|subito' then 'portale'
        when lower(v ->> 'fonte') ~ 'sito|web|google' then 'sito'
        when lower(v ->> 'fonte') ~ 'passapar|amic|conosc|referenz' then 'passaparola'
        when lower(v ->> 'fonte') ~ 'facebook|instagram|social|tiktok' then 'social'
        when v ->> 'fonte' is not null then 'altro' end,
      'temperatura', case when lower(v ->> 'temperatura') ~ 'cald|alt|urgent' then 'caldo'
                          when lower(v ->> 'temperatura') ~ 'fredd|bass' then 'freddo' else 'tiepido' end,
      'data_nascita', public.imp_data(v ->> 'data_nascita'),
      'etichette', case when v ? 'etichette' then to_jsonb(array(select lower(btrim(x)) from regexp_split_to_table(v ->> 'etichette', '[,;/]') x where btrim(x) <> '')) end));
    chiave := coalesce('t:' || public.phone_key(tel), 'e:' || mail);

  elsif p_tipo = 'richieste' then
    d := jsonb_strip_nulls(jsonb_build_object(
      'contatto_telefono', public.imp_telefono(v ->> 'contatto_telefono'),
      'contatto_email', public.imp_email(v ->> 'contatto_email'),
      'contatto_nome', public.imp_txt(v ->> 'contatto_nome'),
      'contratto', case when lower(v ->> 'contratto') ~ 'affitt|locaz' then 'affitto' else 'vendita' end,
      'zone', case when v ? 'zone' then to_jsonb(array(select initcap(btrim(x)) from regexp_split_to_table(v ->> 'zone', '[,;/]') x where btrim(x) <> '')) end,
      'budget_min', public.imp_numero(v ->> 'budget_min'),
      'budget_max', public.imp_numero(v ->> 'budget_max'),
      'mq_min', round(public.imp_numero(v ->> 'mq_min')),
      'locali_min', round(public.imp_numero(v ->> 'locali_min')),
      'tipo', public.imp_tipo_immobile(v ->> 'tipo_immobile', false)));
    if d ->> 'contatto_telefono' is null and d ->> 'contatto_email' is null and d ->> 'contatto_nome' is null then
      errore := 'Manca il cliente (telefono, email o nome)';
    end if;
    chiave := concat_ws('|', coalesce(public.phone_key(d ->> 'contatto_telefono'), d ->> 'contatto_email', lower(d ->> 'contatto_nome')), d ->> 'budget_max', d -> 'zone');

  elsif p_tipo in ('immobili', 'acquisizioni') then
    n := public.imp_numero(coalesce(v ->> 'prezzo', v ->> 'prezzo_richiesto'));
    d := jsonb_strip_nulls(jsonb_build_object(
      'titolo', public.imp_txt(v ->> 'titolo'),
      'indirizzo', public.imp_txt(v ->> 'indirizzo'),
      'citta', public.imp_nome(v ->> 'citta'),
      'zona', public.imp_txt(v ->> 'zona'),
      'prezzo', n,
      'prezzo_valutato', public.imp_numero(v ->> 'prezzo_valutato'),
      'mq', round(public.imp_numero(v ->> 'mq')),
      'locali', round(public.imp_numero(v ->> 'locali')),
      'bagni', round(public.imp_numero(v ->> 'bagni')),
      'tipo', public.imp_tipo_immobile(v ->> 'tipo_immobile', true),
      'contratto', case when lower(v ->> 'contratto') ~ 'affitt|locaz' then 'affitto' else 'vendita' end,
      'stato', case when lower(v ->> 'stato') ~ 'vendut' then 'venduto' when lower(v ->> 'stato') ~ 'affittat' then 'affittato'
                    when lower(v ->> 'stato') ~ 'trattativ|propost' then 'in_trattativa' when lower(v ->> 'stato') ~ 'sospes' then 'sospeso'
                    when lower(v ->> 'stato') ~ 'ritirat|scadut' then 'ritirato' else 'disponibile' end,
      'fase', case when lower(v ->> 'fase') ~ 'contatt' then 'primo_contatto' when lower(v ->> 'fase') ~ 'fissat' then 'valutazione_fissata'
                   when lower(v ->> 'fase') ~ 'valut' then 'valutazione_fatta' when lower(v ->> 'fase') ~ 'propost' then 'proposta_incarico'
                   else 'segnalazione' end,
      'fonte', case when lower(v ->> 'fonte') ~ 'cartell' then 'cartello' when lower(v ->> 'fonte') ~ 'portal|immobiliare|idealista|subito' then 'portale'
                    when lower(v ->> 'fonte') ~ 'telefon' then 'telefonata' when lower(v ->> 'fonte') ~ 'porta' then 'porta_a_porta'
                    when lower(v ->> 'fonte') ~ 'social|facebook|instagram' then 'social' when lower(v ->> 'fonte') ~ 'passapar|amic' then 'passaparola'
                    when v ->> 'fonte' is not null then 'altro' end,
      'descrizione', public.imp_txt(v ->> 'descrizione'),
      'piano', public.imp_txt(v ->> 'piano'),
      'classe_energetica', upper(public.imp_txt(v ->> 'classe_energetica')),
      'data_incarico', public.imp_data(v ->> 'data_incarico'),
      'scadenza_incarico', public.imp_data(v ->> 'scadenza_incarico'),
      'proprietario_nome', public.imp_nome(v ->> 'proprietario_nome'),
      'proprietario_telefono', public.imp_telefono(v ->> 'proprietario_telefono'),
      'proprietario_email', public.imp_email(v ->> 'proprietario_email')));
    if d ->> 'indirizzo' is null then errore := 'Manca l''indirizzo'; end if;
    if p_tipo = 'immobili' and errore is null and d ->> 'citta' is null then errore := 'Manca la città'; end if;
    if p_tipo = 'immobili' and errore is null and coalesce(n, 0) <= 0 then errore := 'Manca il prezzo'; end if;
    if p_tipo = 'acquisizioni' and lower(v ->> 'fase') ~ 'firmat|persa|pers' then
      avvisi := avvisi || 'Fase finale non importabile: messa in "Segnalazione"';
    end if;
    chiave := lower(regexp_replace(coalesce(d ->> 'indirizzo', ''), '[^[:alnum:]]', '', 'g')) || '|' || lower(coalesce(d ->> 'citta', ''));

  elsif p_tipo = 'appuntamenti' then
    dt := coalesce(public.imp_data(v ->> 'data'), public.imp_data(v ->> 'data_ora'));
    d := jsonb_strip_nulls(jsonb_build_object(
      'inizio', case when dt is not null then to_char(dt + coalesce(public.imp_ora(v ->> 'ora'), public.imp_ora(substr(v ->> 'data_ora', 11)), time '09:00'), 'YYYY-MM-DD"T"HH24:MI') end,
      'durata', coalesce(round(public.imp_numero(v ->> 'durata_minuti')), 60),
      'tipo', case when lower(v ->> 'tipo') ~ 'valut|stima' then 'valutazione' when lower(v ->> 'tipo') ~ 'firm|rogit|notai|compromes|prelim' then 'firma'
                   when lower(v ->> 'tipo') ~ 'visit|sopral' or v ->> 'tipo' is null then 'visita' else 'altro' end,
      'contatto_telefono', public.imp_telefono(v ->> 'contatto_telefono'),
      'contatto_email', public.imp_email(v ->> 'contatto_email'),
      'contatto_nome', public.imp_txt(v ->> 'contatto_nome'),
      'immobile_indirizzo', public.imp_txt(v ->> 'immobile_indirizzo')));
    if dt is null then errore := 'Manca la data o non si legge'; end if;
    chiave := concat_ws('|', d ->> 'inizio', coalesce(public.phone_key(d ->> 'contatto_telefono'), d ->> 'contatto_email', lower(d ->> 'contatto_nome')));
  else
    errore := 'Tipo di importazione sconosciuto';
  end if;

  return jsonb_build_object('d', d, 'note', nullif(array_to_string(note, E'\n'), ''), 'errore', errore,
                            'chiave', nullif(chiave, ''), 'avvisi', to_jsonb(avvisi));
end $$;

-- Trova un contatto dell'agenzia per telefono, email o nome
create or replace function public.import_find_contact(p_agency uuid, p_tel text, p_email text, p_nome text)
returns uuid language sql stable security definer set search_path = '' as $$
  select c.id from public.contacts c
  where c.agency_id = p_agency and (
    (p_tel is not null and public.phone_key(c.telefono) = public.phone_key(p_tel))
    or (p_email is not null and lower(c.email) = lower(p_email))
    or (p_tel is null and p_email is null and p_nome is not null and lower(btrim(c.nome || ' ' || c.cognome)) = lower(btrim(p_nome))))
  order by (p_tel is not null and public.phone_key(c.telefono) = public.phone_key(p_tel)) desc, c.created_at
  limit 1
$$;

-- Esiste già? (stesso telefono o email; stesso indirizzo; stesso appuntamento…)
create or replace function public.import_existing(p_tipo text, p_agency uuid, d jsonb)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare r uuid; cid uuid;
begin
  if p_tipo = 'contatti' then
    return public.import_find_contact(p_agency, d ->> 'telefono', d ->> 'email', null);
  elsif p_tipo = 'immobili' then
    select id into r from public.properties where agency_id = p_agency
      and lower(regexp_replace(indirizzo, '[^[:alnum:]]', '', 'g')) = lower(regexp_replace(d ->> 'indirizzo', '[^[:alnum:]]', '', 'g'))
      and lower(citta) = lower(coalesce(d ->> 'citta', citta)) limit 1;
  elsif p_tipo = 'acquisizioni' then
    select id into r from public.acquisitions where agency_id = p_agency
      and lower(regexp_replace(indirizzo, '[^[:alnum:]]', '', 'g')) = lower(regexp_replace(d ->> 'indirizzo', '[^[:alnum:]]', '', 'g')) limit 1;
  elsif p_tipo = 'richieste' then
    cid := public.import_find_contact(p_agency, d ->> 'contatto_telefono', d ->> 'contatto_email', d ->> 'contatto_nome');
    select id into r from public.search_criteria where contact_id = cid
      and budget_max is not distinct from (d ->> 'budget_max')::numeric
      and zone = coalesce(array(select jsonb_array_elements_text(d -> 'zone')), '{}') limit 1;
  elsif p_tipo = 'appuntamenti' then
    cid := public.import_find_contact(p_agency, d ->> 'contatto_telefono', d ->> 'contatto_email', d ->> 'contatto_nome');
    select id into r from public.appointments where agency_id = p_agency
      and inizio = ((d ->> 'inizio')::timestamp at time zone 'Europe/Rome') and contact_id is not distinct from cid limit 1;
  end if;
  return r;
end $$;

-- ---------- Anteprima: prime 20 righe pulite e conteggi su tutto il file ----------
create or replace function public.import_preview(p_job uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  j public.import_jobs;
  r public.import_rows;
  x jsonb;
  visti text[] := '{}';
  valide int := 0; duplicati int := 0; errori int := 0;
  righe jsonb := '[]';
  dup boolean;
  cid uuid;
  err text;
begin
  select * into j from public.import_jobs where id = p_job and agency_id = public.get_my_agency_id();
  if j.id is null or not public.is_titolare() then raise exception 'Importazione non trovata' using errcode = 'P0002'; end if;
  for r in select * from public.import_rows where import_job_id = j.id order by numero_riga loop
    x := public.import_normalize(j.tipo, j.mappatura_colonne, r.dati_originali);
    err := x ->> 'errore';
    if err is null and j.tipo in ('richieste') then
      cid := public.import_find_contact(j.agency_id, x -> 'd' ->> 'contatto_telefono', x -> 'd' ->> 'contatto_email', x -> 'd' ->> 'contatto_nome');
      if cid is null then err := 'Cliente non trovato: importa prima i contatti'; end if;
    end if;
    dup := false;
    if err is null then
      dup := (x ->> 'chiave' is not null and x ->> 'chiave' = any (visti)) or public.import_existing(j.tipo, j.agency_id, x -> 'd') is not null;
      if x ->> 'chiave' is not null then visti := visti || (x ->> 'chiave'); end if;
    end if;
    if err is not null then errori := errori + 1; elsif dup then duplicati := duplicati + 1; else valide := valide + 1; end if;
    if jsonb_array_length(righe) < 20 then
      righe := righe || jsonb_build_object('numero', r.numero_riga, 'd', x -> 'd', 'note', x -> 'note', 'errore', err, 'duplicato', dup, 'avvisi', x -> 'avvisi');
    end if;
  end loop;
  update public.import_jobs set stato = 'anteprima' where id = j.id and stato in ('caricato', 'mappatura', 'anteprima');
  return jsonb_build_object('totale', valide + duplicati + errori, 'valide', valide, 'duplicati', duplicati, 'errori', errori, 'righe', righe);
end $$;

-- ---------- Importazione di un blocco di righe ----------
create or replace function public.import_process(p_job uuid, p_limite integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  j public.import_jobs;
  r public.import_rows;
  x jsonb; d jsonb;
  esistente uuid; nuovo uuid; cid uuid; pid uuid;
  extra uuid[];
  v_esito text; v_azione text; v_msg text;
  restanti integer;
begin
  select * into j from public.import_jobs where id = p_job for update;
  if j.id is null then return 0; end if;
  -- Dall'app: solo il titolare della stessa agenzia. Da pg_cron (nessun utente): tutte.
  if (select auth.uid()) is not null and not (j.agency_id = public.get_my_agency_id() and public.is_titolare()) then
    raise exception 'Solo il titolare può importare' using errcode = '42501';
  end if;
  if j.stato = 'anteprima' then update public.import_jobs set stato = 'in_corso' where id = j.id; j.stato := 'in_corso'; end if;
  if j.stato <> 'in_corso' then return 0; end if;

  perform set_config('mattonio.importazione', 'on', true);

  for r in select * from public.import_rows where import_job_id = j.id and esito is null
           order by numero_riga limit greatest(1, least(p_limite, 2000)) for update skip locked loop
    x := public.import_normalize(j.tipo, j.mappatura_colonne, r.dati_originali);
    d := x -> 'd';
    v_esito := 'ok'; v_azione := 'creato'; v_msg := null; nuovo := null; esistente := null; extra := '{}';
    begin
      if x ->> 'errore' is not null then
        v_esito := 'errore'; v_azione := null; v_msg := x ->> 'errore';
      else
        -- Doppione nel file (riga già importata in questo stesso lavoro) o già presente in Mattonio
        select ir.record_id into esistente from public.import_rows ir
        where ir.import_job_id = j.id and ir.chiave = x ->> 'chiave' and ir.esito = 'ok' and ir.record_id is not null limit 1;
        if esistente is null then esistente := public.import_existing(j.tipo, j.agency_id, d); end if;

        if esistente is not null and j.opzione_duplicati = 'salta' then
          v_esito := 'duplicato'; v_azione := 'saltato'; v_msg := 'Già presente'; nuovo := esistente;
        elsif esistente is not null and j.opzione_duplicati = 'aggiorna' then
          v_azione := 'aggiornato'; nuovo := esistente; v_msg := 'Completati i campi vuoti';
          if j.tipo = 'contatti' then
            update public.contacts set
              cognome = case when cognome = '' then coalesce(d ->> 'cognome', '') else cognome end,
              telefono = coalesce(telefono, d ->> 'telefono'), email = coalesce(email, d ->> 'email'),
              fonte = coalesce(fonte, (d ->> 'fonte')::public.fonte_contatto),
              data_nascita = coalesce(data_nascita, (d ->> 'data_nascita')::date),
              note = coalesce(note, x ->> 'note')
            where id = esistente;
          elsif j.tipo = 'immobili' then
            update public.properties set mq = coalesce(mq, (d ->> 'mq')::int), locali = coalesce(locali, (d ->> 'locali')::int),
              bagni = coalesce(bagni, (d ->> 'bagni')::int), descrizione = coalesce(descrizione, d ->> 'descrizione'),
              piano = coalesce(piano, d ->> 'piano'), classe_energetica = coalesce(classe_energetica, d ->> 'classe_energetica'),
              scadenza_incarico = coalesce(scadenza_incarico, (d ->> 'scadenza_incarico')::date)
            where id = esistente;
          elsif j.tipo = 'acquisizioni' then
            update public.acquisitions set mq_stimati = coalesce(mq_stimati, (d ->> 'mq')::int),
              prezzo_richiesto = coalesce(prezzo_richiesto, (d ->> 'prezzo')::numeric), note = coalesce(note, x ->> 'note')
            where id = esistente;
          else
            v_esito := 'duplicato'; v_azione := 'saltato'; v_msg := 'Già presente';
          end if;
        else
          -- Creazione
          if j.tipo = 'contatti' then
            insert into public.contacts (agency_id, agente_id, nome, cognome, telefono, email, tipo, fonte, temperatura, data_nascita, etichette, note, importato)
            values (j.agency_id, j.creato_da, d ->> 'nome', coalesce(d ->> 'cognome', ''), d ->> 'telefono', d ->> 'email',
                    (d ->> 'tipo')::public.tipo_contatto, (d ->> 'fonte')::public.fonte_contatto, (d ->> 'temperatura')::public.temperatura_contatto,
                    (d ->> 'data_nascita')::date, coalesce(array(select jsonb_array_elements_text(d -> 'etichette')), '{}'), x ->> 'note', true)
            returning id into nuovo;

          elsif j.tipo = 'richieste' then
            cid := public.import_find_contact(j.agency_id, d ->> 'contatto_telefono', d ->> 'contatto_email', d ->> 'contatto_nome');
            if cid is null then raise exception 'Cliente non trovato: importa prima i contatti' using errcode = 'P0001'; end if;
            insert into public.search_criteria (agency_id, contact_id, contratto, zone, budget_min, budget_max, mq_min, locali_min, tipo, note)
            values (j.agency_id, cid, (d ->> 'contratto')::public.tipo_contratto, coalesce(array(select jsonb_array_elements_text(d -> 'zone')), '{}'),
                    (d ->> 'budget_min')::numeric, (d ->> 'budget_max')::numeric, (d ->> 'mq_min')::int, (d ->> 'locali_min')::int,
                    (d ->> 'tipo')::public.tipo_immobile, x ->> 'note')
            returning id into nuovo;
            update public.contacts set tipo = 'entrambi' where id = cid and tipo in ('proprietario', 'locatore');

          elsif j.tipo in ('immobili', 'acquisizioni') then
            -- Proprietario: si collega se esiste, altrimenti si crea (se c'è almeno il nome)
            cid := public.import_find_contact(j.agency_id, d ->> 'proprietario_telefono', d ->> 'proprietario_email', d ->> 'proprietario_nome');
            if cid is null and (d ->> 'proprietario_nome' is not null or d ->> 'proprietario_telefono' is not null) then
              insert into public.contacts (agency_id, agente_id, nome, cognome, telefono, email, tipo, importato)
              values (j.agency_id, j.creato_da, coalesce(split_part(d ->> 'proprietario_nome', ' ', 1), 'Proprietario'),
                      coalesce(nullif(btrim(substr(d ->> 'proprietario_nome', length(split_part(d ->> 'proprietario_nome', ' ', 1)) + 1)), ''), ''),
                      d ->> 'proprietario_telefono', d ->> 'proprietario_email', 'proprietario', true)
              returning id into cid;
              extra := array[cid];
            end if;
            if j.tipo = 'immobili' then
              insert into public.properties (agency_id, agente_id, titolo, indirizzo, citta, zona, prezzo, mq, locali, bagni, tipo, contratto, stato,
                                             descrizione, piano, classe_energetica, data_incarico, scadenza_incarico, owner_id)
              values (j.agency_id, j.creato_da,
                      coalesce(d ->> 'titolo', initcap(d ->> 'tipo') || coalesce(' di ' || (d ->> 'mq') || ' mq', '') || ' in ' || (d ->> 'indirizzo')),
                      d ->> 'indirizzo', d ->> 'citta', coalesce(d ->> 'zona', d ->> 'citta'), (d ->> 'prezzo')::numeric, (d ->> 'mq')::int,
                      (d ->> 'locali')::int, (d ->> 'bagni')::int, (d ->> 'tipo')::public.tipo_immobile, (d ->> 'contratto')::public.tipo_contratto,
                      (d ->> 'stato')::public.stato_immobile,
                      nullif(concat_ws(E'\n\n', d ->> 'descrizione', case when x ->> 'note' is not null then 'Altri dati importati:' || E'\n' || (x ->> 'note') end), ''),
                      d ->> 'piano', d ->> 'classe_energetica', (d ->> 'data_incarico')::date, (d ->> 'scadenza_incarico')::date, cid)
              returning id into nuovo;
            else
              insert into public.acquisitions (agency_id, agente_id, contact_id, indirizzo, citta, zona, tipo_immobile, mq_stimati,
                                               prezzo_richiesto, prezzo_valutato, fonte, fase, note)
              values (j.agency_id, j.creato_da, cid, d ->> 'indirizzo', d ->> 'citta', d ->> 'zona', (d ->> 'tipo')::public.tipo_immobile,
                      (d ->> 'mq')::int, (d ->> 'prezzo')::numeric, (d ->> 'prezzo_valutato')::numeric,
                      (d ->> 'fonte')::public.fonte_acquisizione, (d ->> 'fase')::public.fase_acquisizione, x ->> 'note')
              returning id into nuovo;
            end if;

          elsif j.tipo = 'appuntamenti' then
            cid := public.import_find_contact(j.agency_id, d ->> 'contatto_telefono', d ->> 'contatto_email', d ->> 'contatto_nome');
            select id into pid from public.properties where agency_id = j.agency_id and d ->> 'immobile_indirizzo' is not null
              and lower(indirizzo) like '%' || lower(d ->> 'immobile_indirizzo') || '%' limit 1;
            insert into public.appointments (agency_id, agente_id, contact_id, property_id, tipo, inizio, fine, note)
            values (j.agency_id, j.creato_da, cid, pid, (d ->> 'tipo')::public.tipo_appuntamento,
                    (d ->> 'inizio')::timestamp at time zone 'Europe/Rome',
                    ((d ->> 'inizio')::timestamp + make_interval(mins => (d ->> 'durata')::int)) at time zone 'Europe/Rome',
                    nullif(concat_ws(E'\n', x ->> 'note', case when cid is null and d ->> 'contatto_nome' is not null then 'Cliente: ' || (d ->> 'contatto_nome') end), ''))
            returning id into nuovo;
          end if;
          if esistente is not null then v_msg := 'Creato anche se già presente'; end if;
        end if;
        if jsonb_array_length(x -> 'avvisi') > 0 and v_esito = 'ok' then
          v_msg := concat_ws(' · ', v_msg, (select string_agg(a, ' · ') from jsonb_array_elements_text(x -> 'avvisi') a));
        end if;
      end if;
    exception when others then
      v_esito := 'errore'; v_azione := null; nuovo := null; extra := '{}';
      v_msg := case when sqlstate = 'P0001' then sqlerrm else 'Dati non validi: ' || left(sqlerrm, 150) end;
    end;
    update public.import_rows set esito = v_esito, azione = v_azione, messaggio = v_msg, chiave = x ->> 'chiave', record_id = nuovo, record_extra = extra
    where id = r.id;
  end loop;

  select count(*) into restanti from public.import_rows where import_job_id = j.id and esito is null;
  update public.import_jobs set
    righe_importate = (select count(*) from public.import_rows where import_job_id = j.id and azione = 'creato'),
    righe_aggiornate = (select count(*) from public.import_rows where import_job_id = j.id and azione = 'aggiornato'),
    righe_saltate = (select count(*) from public.import_rows where import_job_id = j.id and esito = 'duplicato'),
    righe_scartate = (select count(*) from public.import_rows where import_job_id = j.id and esito = 'errore'),
    stato = case when restanti = 0 then 'completato' else stato end,
    completed_at = case when restanti = 0 then now() else completed_at end
  where id = j.id;
  return restanti;
end $$;

-- Avvio: salva le scelte e passa "in corso" (il resto lo fa import_process, anche da pg_cron)
create or replace function public.import_start(p_job uuid, p_mappatura jsonb, p_duplicati text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.import_jobs set mappatura_colonne = p_mappatura, opzione_duplicati = p_duplicati, stato = 'in_corso',
         righe_totali = (select count(*) from public.import_rows where import_job_id = p_job)
  where id = p_job and agency_id = public.get_my_agency_id() and public.is_titolare() and stato in ('caricato', 'mappatura', 'anteprima');
  if not found then raise exception 'Importazione non trovata o già avviata' using errcode = 'P0002'; end if;
end $$;

-- Annulla entro 24 ore: elimina solo ciò che questo lavoro ha creato (gli aggiornamenti restano)
create or replace function public.import_undo(p_job uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  j public.import_jobs;
  ids uuid[];
  extra uuid[];
  n integer;
begin
  select * into j from public.import_jobs where id = p_job and agency_id = public.get_my_agency_id();
  if j.id is null or not public.is_titolare() then raise exception 'Importazione non trovata' using errcode = 'P0002'; end if;
  if j.stato <> 'completato' then raise exception 'Si può annullare solo un''importazione completata' using errcode = '23514'; end if;
  if j.completed_at < now() - interval '24 hours' then raise exception 'Sono passate più di 24 ore: l''importazione non si può più annullare' using errcode = '23514'; end if;
  select array_agg(record_id), array_agg(e) filter (where e is not null) into ids, extra
  from public.import_rows ir left join lateral unnest(ir.record_extra) e on true
  where ir.import_job_id = j.id and ir.azione = 'creato' and ir.record_id is not null;
  ids := coalesce(ids, '{}'); n := cardinality(ids);
  if j.tipo = 'contatti' then delete from public.contacts where id = any (ids) and agency_id = j.agency_id;
  elsif j.tipo = 'richieste' then delete from public.search_criteria where id = any (ids) and agency_id = j.agency_id;
  elsif j.tipo = 'immobili' then delete from public.properties where id = any (ids) and agency_id = j.agency_id;
  elsif j.tipo = 'acquisizioni' then delete from public.acquisitions where id = any (ids) and agency_id = j.agency_id;
  elsif j.tipo = 'appuntamenti' then delete from public.appointments where id = any (ids) and agency_id = j.agency_id;
  end if;
  if cardinality(coalesce(extra, '{}')) > 0 then
    delete from public.contacts c where c.id = any (extra) and c.agency_id = j.agency_id and c.importato
      and not exists (select 1 from public.properties p where p.owner_id = c.id)
      and not exists (select 1 from public.acquisitions a where a.contact_id = c.id);
  end if;
  update public.import_jobs set stato = 'annullato' where id = j.id;
  return n;
end $$;

-- pg_cron: porta avanti le importazioni in corso anche a pagina chiusa
create or replace function public.import_tick()
returns void language plpgsql security definer set search_path = '' as $$
declare j record;
begin
  for j in select id from public.import_jobs where stato = 'in_corso' order by created_at limit 5 loop
    perform public.import_process(j.id, 1500);
  end loop;
end $$;

-- Dopo 30 giorni: via i dati delle righe (i file li cancella la Edge Function "importazione")
create or replace function public.import_cleanup()
returns setof text language plpgsql security definer set search_path = '' as $$
begin
  delete from public.import_rows ir using public.import_jobs j
  where j.id = ir.import_job_id and j.created_at < now() - interval '30 days';
  update public.import_jobs set file_url = null where created_at < now() - interval '30 days' and file_url is not null;
  return query select o.name from storage.objects o where o.bucket_id = 'imports' and o.created_at < now() - interval '30 days';
end $$;

revoke execute on function public.import_skip_auto_tasks() from public, anon, authenticated;
revoke execute on function public.import_skip_automation_runs() from public, anon, authenticated;
revoke execute on function public.import_find_contact(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.import_existing(text, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.import_tick() from public, anon, authenticated;
revoke execute on function public.import_cleanup() from public, anon, authenticated;
grant execute on function public.import_cleanup() to service_role;
revoke execute on function public.import_preview(uuid) from public, anon;
revoke execute on function public.import_process(uuid, integer) from public, anon;
revoke execute on function public.import_start(uuid, jsonb, text) from public, anon;
revoke execute on function public.import_undo(uuid) from public, anon;
grant execute on function public.import_preview(uuid), public.import_process(uuid, integer), public.import_start(uuid, jsonb, text),
  public.import_undo(uuid) to authenticated;

select cron.schedule('importazioni', '* * * * *', $cron$ select public.import_tick() where exists (select 1 from public.import_jobs where stato = 'in_corso') $cron$);
select cron.schedule('importazioni-pulizia', '17 3 * * *', $cron$
  select net.http_post(
    url := 'https://bwpgpsrcddlngpskyajr.supabase.co/functions/v1/importazione',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-automazioni-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'automazioni_cron_secret')),
    body := '{"azione": "pulizia"}'::jsonb, timeout_milliseconds := 10000)
$cron$);
