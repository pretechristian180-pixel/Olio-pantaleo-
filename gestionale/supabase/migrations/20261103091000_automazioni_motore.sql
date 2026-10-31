-- =====================================================================
-- AUTOMAZIONI (2/3): il motore
--  - i trigger sulle tabelle creano le esecuzioni (automation_runs) quando succede qualcosa
--  - automation_sweep() crea quelle "a calendario" (scadenze, compleanni, inattività, report periodici, festività)
--  - la Edge Function "automazioni" (ogni 5 minuti) prende quelle scadute, chiede automation_prepare()
--    se e come eseguirle, invia, e chiude con automation_finish()
-- Regole sempre applicate: contatti esclusi, evento ancora valido, niente invii 21:00-8:30 e la domenica,
-- al massimo 1 messaggio automatico al giorno per contatto, ogni esecuzione scritta nelle attività.
-- =====================================================================

-- ---------- Tempi ----------
create or replace function public.auto_add(base timestamptz, valore integer, unita text, direzione text)
returns timestamptz language plpgsql immutable set search_path = '' as $$
declare
  segno integer := case when direzione = 'prima' then -1 else 1 end;
  t timestamp := base at time zone 'Europe/Rome';
  restanti integer := coalesce(valore, 0);
begin
  if unita = 'minuti' then return base + make_interval(mins => segno * restanti); end if;
  if unita = 'ore' then return base + make_interval(hours => segno * restanti); end if;
  if unita = 'giorni' then return (t + make_interval(days => segno * restanti)) at time zone 'Europe/Rome'; end if;
  if unita = 'giorni_lavorativi' then
    while restanti > 0 loop
      t := t + make_interval(days => segno);
      if extract(isodow from t) < 6 then restanti := restanti - 1; end if;
    end loop;
    return t at time zone 'Europe/Rome';
  end if;
  if unita = 'ore_lavorative' then
    -- Conta solo le ore tra le 9 e le 19, dal lunedì al sabato
    while restanti > 0 loop
      t := t + make_interval(hours => segno);
      if extract(isodow from t) < 7 and extract(hour from t) between 9 and 18 then restanti := restanti - 1; end if;
    end loop;
    return t at time zone 'Europe/Rome';
  end if;
  return base;
end $$;

-- Nessun messaggio ai clienti tra le 21:00 e le 8:30 né la domenica: si sposta al primo orario utile
create or replace function public.auto_quiet_shift(ts timestamptz)
returns timestamptz language plpgsql immutable set search_path = '' as $$
declare
  t timestamp := ts at time zone 'Europe/Rome';
begin
  if t::time >= time '21:00' then t := (t::date + 1) + time '08:30';
  elsif t::time < time '08:30' then t := t::date + time '08:30';
  end if;
  if extract(isodow from t) = 7 then t := (t::date + 1) + time '08:30'; end if;
  return t at time zone 'Europe/Rome';
end $$;

-- Data di Pasqua (algoritmo di Gauss/Meeus)
create or replace function public.auto_easter(y integer)
returns date language plpgsql immutable set search_path = '' as $$
declare a int; b int; c int; d int; e int; f int; g int; h int; i int; k int; l int; m int; mese int; giorno int;
begin
  a := y % 19; b := y / 100; c := y % 100; d := b / 4; e := b % 4; f := (b + 8) / 25; g := (b - f + 1) / 3;
  h := (19 * a + b - d - g + 15) % 30; i := c / 4; k := c % 4; l := (32 + 2 * e + 2 * i - h - k) % 7;
  m := (a + 11 * h + 22 * l) / 451; mese := (h + l - 7 * m + 114) / 31; giorno := ((h + l - 7 * m + 114) % 31) + 1;
  return make_date(y, mese, giorno);
end $$;

-- Le condizioni confrontano le colonne della riga: valore singolo = uguale, elenco = uno dei valori.
-- Le chiavi che non sono colonne (campo, giorni, festa…) servono ad altri tipi di regola e qui si ignorano.
create or replace function public.auto_conditions_ok(cond jsonb, r jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare k text; v jsonb;
begin
  for k, v in select * from jsonb_each(coalesce(cond, '{}')) loop
    if not (r ? k) then continue; end if;
    if jsonb_typeof(v) = 'array' then
      if not exists (select 1 from jsonb_array_elements_text(v) x where x = r ->> k) then return false; end if;
    elsif (r ->> k) is distinct from (v #>> '{}') then
      return false;
    end if;
  end loop;
  return true;
end $$;

-- ---------- Creazione delle esecuzioni sugli eventi ----------
create or replace function public.automation_on_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  entita text := case tg_table_name when 'contacts' then 'contact' when 'properties' then 'property' when 'deals' then 'deal'
                   when 'acquisitions' then 'acquisition' when 'appointments' then 'appointment' when 'matches' then 'match' end;
  r jsonb := to_jsonb(new);
  o jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
  a public.automations;
  fase_nuova text := coalesce(r ->> 'fase', r ->> 'stato');
  fase_cambiata boolean := tg_op = 'UPDATE' and coalesce(o ->> 'fase', o ->> 'stato') is distinct from fase_nuova;
  data_cambiata boolean := tg_op = 'INSERT' or (tg_op = 'UPDATE' and (o ->> 'inizio', o ->> 'fine', o ->> 'tipo') is distinct from (r ->> 'inizio', r ->> 'fine', r ->> 'tipo'));
  contatto uuid;
  base timestamptz;
  quando timestamptz;
begin
  contatto := case entita when 'contact' then new.id
                when 'property' then (r ->> 'owner_id')::uuid
                else (r ->> 'contact_id')::uuid end;

  for a in select * from public.automations x
           where x.agency_id = (r ->> 'agency_id')::uuid and x.attiva and x.trigger_entita = entita
             and x.trigger_tipo in ('creazione', 'nessuna_risposta', 'cambio_fase', 'data_evento') loop
    if not public.auto_conditions_ok(a.trigger_condizioni, r) then continue; end if;

    if a.trigger_tipo in ('creazione', 'nessuna_risposta') and tg_op = 'INSERT' then
      -- I contatti importati non ricevono il benvenuto
      if entita = 'contact' and coalesce((r ->> 'importato')::boolean, false) then continue; end if;
      insert into public.automation_runs (agency_id, automation_id, entita_tipo, entita_id, contact_id, chiave, esegui_alle)
      values (a.agency_id, a.id, entita, new.id, contatto, 'creazione', public.auto_add(now(), a.attesa_valore, a.attesa_unita, 'dopo'))
      on conflict do nothing;

    elsif a.trigger_tipo = 'cambio_fase' and fase_cambiata then
      insert into public.automation_runs (agency_id, automation_id, entita_tipo, entita_id, contact_id, chiave, esegui_alle)
      values (a.agency_id, a.id, entita, new.id, contatto, format('fase:%s:%s', fase_nuova, extract(epoch from now())::bigint),
              public.auto_add(now(), a.attesa_valore, a.attesa_unita, 'dopo'))
      on conflict do nothing;

    elsif a.trigger_tipo = 'data_evento' and entita = 'appointment' and data_cambiata then
      -- Appuntamento spostato: le esecuzioni ancora in attesa si rifanno sulla nuova data
      update public.automation_runs set stato = 'annullata', motivo = 'Appuntamento spostato'
      where automation_id = a.id and entita_id = new.id and stato = 'in_attesa';
      base := case when a.attesa_direzione = 'prima' then (r ->> 'inizio')::timestamptz else (r ->> 'fine')::timestamptz end;
      quando := public.auto_add(base, a.attesa_valore, a.attesa_unita, a.attesa_direzione);
      if quando > now() then
        insert into public.automation_runs (agency_id, automation_id, entita_tipo, entita_id, contact_id, chiave, esegui_alle)
        values (a.agency_id, a.id, entita, new.id, contatto, 'evento:' || extract(epoch from base)::bigint, quando)
        on conflict (automation_id, entita_id, chiave) do update set stato = 'in_attesa', motivo = null, esegui_alle = excluded.esegui_alle;
      end if;
    end if;
  end loop;
  return new;
exception when others then
  -- Un errore delle automazioni non deve mai bloccare il lavoro dell'agente
  raise warning 'automazioni: %', sqlerrm;
  return new;
end $$;

create trigger contacts_automazioni after insert or update of tipo, temperatura on public.contacts
  for each row execute function public.automation_on_event();
create trigger properties_automazioni after insert or update of stato on public.properties
  for each row execute function public.automation_on_event();
create trigger deals_automazioni after insert or update of fase on public.deals
  for each row execute function public.automation_on_event();
create trigger acquisitions_automazioni after insert or update of fase on public.acquisitions
  for each row execute function public.automation_on_event();
create trigger appointments_automazioni after insert or update of inizio, fine, tipo on public.appointments
  for each row execute function public.automation_on_event();
create trigger matches_automazioni after insert on public.matches
  for each row execute function public.automation_on_event();

-- ---------- Esecuzioni "a calendario" ----------
create or replace function public.automation_sweep()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  a public.automations;
  oggi date := (now() at time zone 'Europe/Rome')::date;
  anno integer := extract(year from oggi);
  giorni integer;
  periodo bigint;
  festa text;
  giorno_festa date;
  creati integer := 0;
  n integer;
begin
  for a in select * from public.automations where attiva and trigger_tipo in ('data_campo', 'inattivita', 'periodico', 'data_fissa') loop
    giorni := greatest(1, coalesce((a.trigger_condizioni ->> 'giorni')::int, a.attesa_valore, 7));
    periodo := floor(extract(epoch from now()) / (giorni * 86400));

    if a.trigger_tipo = 'data_campo' and a.trigger_entita = 'property' then
      insert into public.automation_runs (agency_id, automation_id, entita_tipo, entita_id, contact_id, chiave, esegui_alle)
      select a.agency_id, a.id, 'property', p.id, p.owner_id, 'campo:' || p.scadenza_incarico,
             greatest(now(), public.auto_add((p.scadenza_incarico + time '09:00') at time zone 'Europe/Rome', a.attesa_valore, a.attesa_unita, a.attesa_direzione))
      from public.properties p
      where p.agency_id = a.agency_id and p.scadenza_incarico is not null and p.scadenza_incarico >= oggi
        and p.stato in ('disponibile', 'in_trattativa', 'sospeso')
        and public.auto_conditions_ok(a.trigger_condizioni, to_jsonb(p))
        and public.auto_add((p.scadenza_incarico + time '09:00') at time zone 'Europe/Rome', a.attesa_valore, a.attesa_unita, a.attesa_direzione) <= now() + interval '2 days'
      on conflict do nothing;
      get diagnostics n = row_count; creati := creati + n;

    elsif a.trigger_tipo = 'data_campo' and a.trigger_entita = 'contact' then
      -- Compleanno (data_nascita) di quest'anno; il 29 febbraio diventa il 28 negli anni non bisestili
      insert into public.automation_runs (agency_id, automation_id, entita_tipo, entita_id, contact_id, chiave, esegui_alle)
      select a.agency_id, a.id, 'contact', c.id, c.id, 'anno:' || anno,
             greatest(now(), public.auto_add((x.giorno + time '09:30') at time zone 'Europe/Rome', a.attesa_valore, a.attesa_unita, a.attesa_direzione))
      from public.contacts c
      cross join lateral (select make_date(anno, extract(month from c.data_nascita)::int,
                            least(extract(day from c.data_nascita)::int,
                                  extract(day from (make_date(anno, extract(month from c.data_nascita)::int, 1) + interval '1 month - 1 day'))::int)) as giorno) x
      where c.agency_id = a.agency_id and c.data_nascita is not null and x.giorno >= oggi
        and (not a.richiede_consenso or c.consenso_marketing)
        and public.auto_add((x.giorno + time '09:30') at time zone 'Europe/Rome', a.attesa_valore, a.attesa_unita, a.attesa_direzione) <= now() + interval '2 days'
      on conflict do nothing;
      get diagnostics n = row_count; creati := creati + n;

    elsif a.trigger_tipo = 'inattivita' and a.trigger_entita = 'property' then
      -- Immobile disponibile senza visite negli ultimi N giorni
      insert into public.automation_runs (agency_id, automation_id, entita_tipo, entita_id, contact_id, chiave, esegui_alle)
      select a.agency_id, a.id, 'property', p.id, p.owner_id, 'periodo:' || periodo, now()
      from public.properties p
      where p.agency_id = a.agency_id and p.stato = 'disponibile' and p.created_at < now() - make_interval(days => giorni)
        and not exists (select 1 from public.appointments ap where ap.property_id = p.id and ap.tipo = 'visita'
                        and ap.inizio > now() - make_interval(days => giorni))
      on conflict do nothing;
      get diagnostics n = row_count; creati := creati + n;

    elsif a.trigger_tipo = 'inattivita' and a.trigger_entita = 'contact' then
      -- Cliente che cerca casa, non freddo, senza nessuna attività da N giorni
      insert into public.automation_runs (agency_id, automation_id, entita_tipo, entita_id, contact_id, chiave, esegui_alle)
      select a.agency_id, a.id, 'contact', c.id, c.id, 'periodo:' || periodo, now()
      from public.contacts c
      where c.agency_id = a.agency_id and c.tipo in ('acquirente', 'entrambi', 'inquilino') and c.temperatura <> 'freddo'
        and c.created_at < now() - make_interval(days => giorni)
        and not exists (select 1 from public.activities x where x.contact_id = c.id and x.created_at > now() - make_interval(days => giorni))
      on conflict do nothing;
      get diagnostics n = row_count; creati := creati + n;

    elsif a.trigger_tipo = 'periodico' and a.trigger_entita = 'property' then
      -- Ogni N giorni per gli immobili disponibili con proprietario (es. report al proprietario)
      insert into public.automation_runs (agency_id, automation_id, entita_tipo, entita_id, contact_id, chiave, esegui_alle)
      select a.agency_id, a.id, 'property', p.id, p.owner_id, 'periodo:' || periodo, public.auto_quiet_shift(greatest(now(), (oggi + time '10:00') at time zone 'Europe/Rome'))
      from public.properties p
      where p.agency_id = a.agency_id and p.stato = 'disponibile' and p.owner_id is not null
        and p.created_at < now() - make_interval(days => giorni)
      on conflict do nothing;
      get diagnostics n = row_count; creati := creati + n;

    elsif a.trigger_tipo = 'data_fissa' and a.trigger_entita = 'contact' then
      festa := coalesce(a.trigger_condizioni ->> 'festa', 'natale');
      giorno_festa := case festa when 'pasqua' then public.auto_easter(anno) - 1 when 'capodanno' then make_date(anno, 12, 31) else make_date(anno, 12, 23) end;
      if giorno_festa = oggi then
        insert into public.automation_runs (agency_id, automation_id, entita_tipo, entita_id, contact_id, chiave, esegui_alle)
        select a.agency_id, a.id, 'contact', c.id, c.id, format('festa:%s:%s', festa, anno), greatest(now(), (oggi + time '10:00') at time zone 'Europe/Rome')
        from public.contacts c
        where c.agency_id = a.agency_id and (not a.richiede_consenso or c.consenso_marketing)
          and public.auto_conditions_ok(a.trigger_condizioni, to_jsonb(c))
        on conflict do nothing;
        get diagnostics n = row_count; creati := creati + n;
      end if;
    end if;
  end loop;
  return creati;
end $$;

-- ---------- Presa in carico ----------
create or replace function public.automation_claim(p_limite integer)
returns setof public.automation_runs language plpgsql security definer set search_path = '' as $$
begin
  return query
  update public.automation_runs r set bloccato_fino = now() + interval '5 minutes', tentativi = r.tentativi + 1
  where r.id in (
    select x.id from public.automation_runs x
    where x.stato = 'in_attesa' and x.esegui_alle <= now() and (x.bloccato_fino is null or x.bloccato_fino < now())
    order by x.esegui_alle
    limit greatest(1, least(p_limite, 100))
    for update skip locked
  )
  returning r.*;
end $$;

-- ---------- Cosa fare con un'esecuzione ----------
-- Restituisce la decisione (esegui / rimanda / annulla / salta) con destinatario, variabili e modello.
create or replace function public.automation_prepare(p_run uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  run public.automation_runs;
  a public.automations;
  e jsonb;
  c public.contacts;           -- destinatario se è un contatto
  p public.properties;
  ap public.appointments;
  agente public.profiles;
  titolare public.profiles;
  ag public.agencies;
  ms public.messaging_settings;
  tpl public.message_templates;
  dest_id uuid;
  messaggio boolean;
  canale text;
  vars jsonb;
  quando timestamptz;
  indirizzo text;
  prezzo numeric;
  chiave_fase text;
  esito text := 'esegui';
  motivo text;
  oggi date := (now() at time zone 'Europe/Rome')::date;
begin
  select * into run from public.automation_runs where id = p_run;
  if run.id is null or run.stato <> 'in_attesa' then return jsonb_build_object('esito', 'annulla', 'motivo', 'Esecuzione non più in attesa'); end if;
  select * into a from public.automations where id = run.automation_id;
  if not a.attiva then return jsonb_build_object('esito', 'annulla', 'motivo', 'Automazione disattivata'); end if;
  select * into ag from public.agencies where id = run.agency_id;
  if not ag.attiva then return jsonb_build_object('esito', 'rimanda', 'quando', now() + interval '1 day', 'motivo', 'Agenzia sospesa'); end if;
  select * into ms from public.messaging_settings where agency_id = run.agency_id;

  -- Entità e dati collegati
  e := case run.entita_tipo
    when 'contact' then (select to_jsonb(x) from public.contacts x where x.id = run.entita_id)
    when 'property' then (select to_jsonb(x) from public.properties x where x.id = run.entita_id)
    when 'deal' then (select to_jsonb(x) from public.deals x where x.id = run.entita_id)
    when 'acquisition' then (select to_jsonb(x) from public.acquisitions x where x.id = run.entita_id)
    when 'appointment' then (select to_jsonb(x) from public.appointments x where x.id = run.entita_id)
    when 'match' then (select to_jsonb(x) from public.matches x where x.id = run.entita_id)
  end;
  if e is null then return jsonb_build_object('esito', 'annulla', 'motivo', 'Non esiste più'); end if;

  if run.entita_tipo = 'property' then select * into p from public.properties where id = run.entita_id;
  elsif e ? 'property_id' and e ->> 'property_id' is not null then select * into p from public.properties where id = (e ->> 'property_id')::uuid;
  end if;
  if run.entita_tipo = 'appointment' then select * into ap from public.appointments where id = run.entita_id; end if;
  indirizzo := coalesce(p.indirizzo, e ->> 'indirizzo');
  prezzo := coalesce(p.prezzo, (e ->> 'prezzo_valutato')::numeric, (e ->> 'prezzo_richiesto')::numeric);

  -- Agente e titolare
  select * into agente from public.profiles where id = coalesce((e ->> 'agente_id')::uuid,
    (select x.agente_id from public.contacts x where x.id = run.contact_id)) and attivo;
  select * into titolare from public.profiles where agency_id = run.agency_id and ruolo = 'titolare' and attivo order by created_at limit 1;
  if agente.id is null then agente := titolare; end if;

  -- Destinatario
  dest_id := case a.azione_destinatario
    when 'contatto' then case run.entita_tipo when 'contact' then run.entita_id when 'property' then p.owner_id else (e ->> 'contact_id')::uuid end
    when 'proprietario' then case run.entita_tipo when 'acquisition' then (e ->> 'contact_id')::uuid else p.owner_id end
    else null end;
  if dest_id is not null then select * into c from public.contacts where id = dest_id; end if;

  -- ---------- L'evento è ancora valido? ----------
  if a.trigger_tipo = 'nessuna_risposta' and exists (
    select 1 from public.activities x where x.contact_id = run.contact_id and x.utente_id is not null and x.created_at >= run.created_at) then
    return jsonb_build_object('esito', 'annulla', 'motivo', 'Il cliente è già stato contattato');
  end if;
  if a.trigger_tipo = 'cambio_fase' then
    chiave_fase := split_part(run.chiave, ':', 2);
    if coalesce(e ->> 'fase', e ->> 'stato') is distinct from chiave_fase then
      return jsonb_build_object('esito', 'annulla', 'motivo', 'La fase è cambiata');
    end if;
  end if;
  if a.trigger_tipo = 'data_evento' and run.chiave <> 'evento:' || extract(epoch from case when a.attesa_direzione = 'prima' then ap.inizio else ap.fine end)::bigint then
    return jsonb_build_object('esito', 'annulla', 'motivo', 'Appuntamento spostato');
  end if;
  if a.trigger_tipo = 'data_evento' and a.attesa_direzione = 'prima' and ap.inizio < now() then
    return jsonb_build_object('esito', 'annulla', 'motivo', 'L''appuntamento è già passato');
  end if;
  if a.trigger_tipo = 'data_campo' and run.entita_tipo = 'property' and run.chiave <> 'campo:' || p.scadenza_incarico then
    return jsonb_build_object('esito', 'annulla', 'motivo', 'La scadenza è cambiata');
  end if;
  if a.trigger_tipo in ('periodico', 'inattivita') and run.entita_tipo = 'property' and p.stato <> 'disponibile' then
    return jsonb_build_object('esito', 'annulla', 'motivo', 'L''immobile non è più disponibile');
  end if;
  if (a.azione_contenuto ->> 'questionario')::boolean and exists (select 1 from public.visit_feedback f where f.appointment_id = ap.id) then
    return jsonb_build_object('esito', 'salta', 'motivo', 'Impressioni già registrate');
  end if;
  if run.entita_tipo = 'match' and (e ->> 'stato') <> 'da_proporre' then
    return jsonb_build_object('esito', 'annulla', 'motivo', 'Immobile già proposto o scartato');
  end if;

  -- ---------- Messaggi ai clienti: consenso, esclusioni, orari, 1 al giorno ----------
  messaggio := a.azione_tipo in ('whatsapp', 'email');
  canale := case a.azione_tipo when 'whatsapp' then 'whatsapp' when 'email' then 'email'
                               when 'cambio_temperatura' then 'temperatura' when 'evento_agenda' then 'agenda' else 'task' end;
  if messaggio then
    if c.id is null then return jsonb_build_object('esito', 'salta', 'motivo', 'Nessun contatto a cui scrivere'); end if;
    if a.richiede_consenso and not c.consenso_marketing then
      return jsonb_build_object('esito', 'salta', 'motivo', 'Senza consenso alle comunicazioni');
    end if;
    if exists (select 1 from public.opt_outs o where o.contact_id = c.id and o.canale = 'tutti') then
      return jsonb_build_object('esito', 'salta', 'motivo', 'Contatto escluso dai messaggi automatici');
    end if;
    if a.ricetta_codice = 'dopo_rogito' and ms.link_recensioni is null then
      return jsonb_build_object('esito', 'salta', 'motivo', 'Manca il link delle recensioni Google');
    end if;
    quando := public.auto_quiet_shift(now());
    if quando > now() + interval '1 minute' then
      return jsonb_build_object('esito', 'rimanda', 'quando', quando, 'motivo', 'Fuori dagli orari consentiti');
    end if;
    if exists (select 1 from public.automation_runs x where x.contact_id = c.id and x.stato = 'eseguita'
               and x.canale in ('whatsapp', 'email') and (x.eseguita_at at time zone 'Europe/Rome')::date = oggi) then
      return jsonb_build_object('esito', 'rimanda', 'quando', public.auto_quiet_shift(((oggi + 1) + time '09:30') at time zone 'Europe/Rome'),
                                'motivo', 'Già un messaggio automatico oggi');
    end if;
    select * into tpl from public.message_templates where agency_id = run.agency_id and codice = a.azione_contenuto ->> 'template';
    if tpl.id is null then return jsonb_build_object('esito', 'salta', 'motivo', 'Modello di messaggio mancante'); end if;
  end if;

  vars := jsonb_strip_nulls(jsonb_build_object(
    'nome', coalesce(c.nome, (select x.nome from public.contacts x where x.id = run.contact_id)),
    'cognome', coalesce(c.cognome, (select x.cognome from public.contacts x where x.id = run.contact_id)),
    'nome_agente', trim(agente.nome || ' ' || agente.cognome),
    'telefono_agente', agente.telefono,
    'nome_agenzia', ag.nome,
    'telefono_agenzia', ag.telefono,
    'indirizzo_immobile', indirizzo,
    'prezzo_immobile', case when prezzo is not null then replace(to_char(prezzo, 'FM999,999,999'), ',', '.') || ' €' end,
    'data_appuntamento', case when ap.id is not null then to_char(ap.inizio at time zone 'Europe/Rome', 'DD/MM/YYYY') end,
    'ora_appuntamento', case when ap.id is not null then to_char(ap.inizio at time zone 'Europe/Rome', 'HH24:MI') end,
    'data_scadenza', case when p.scadenza_incarico is not null then to_char(p.scadenza_incarico, 'DD/MM/YYYY') end,
    'ora_creazione', to_char(run.created_at at time zone 'Europe/Rome', 'HH24:MI'),
    'link_recensioni', ms.link_recensioni,
    'visite', case when p.id is not null then (select count(*) from public.appointments x where x.property_id = p.id and x.tipo = 'visita'
                 and x.inizio > now() - make_interval(days => greatest(1, coalesce((a.trigger_condizioni ->> 'giorni')::int, 15))) and x.inizio <= now())::text end,
    'richieste', case when p.id is not null then (select count(*) from public.matches x where x.property_id = p.id
                 and x.created_at > now() - make_interval(days => greatest(1, coalesce((a.trigger_condizioni ->> 'giorni')::int, 15))))::text end,
    'giorni_online', case when p.id is not null then greatest(0, oggi - (p.created_at at time zone 'Europe/Rome')::date)::text end,
    'festivita', case a.trigger_condizioni ->> 'festa' when 'pasqua' then 'una buona Pasqua' when 'capodanno' then 'un felice anno nuovo'
                   else 'buon Natale e un felice anno nuovo' end
  ));

  return jsonb_build_object(
    'esito', esito,
    'motivo', motivo,
    'agency_id', run.agency_id,
    'automazione', a.nome,
    'azione', a.azione_tipo,
    'canale', canale,
    'contenuto', a.azione_contenuto,
    'questionario_appuntamento', case when (a.azione_contenuto ->> 'questionario')::boolean then ap.id end,
    'destinatario', case when c.id is not null then jsonb_build_object(
      'id', c.id, 'nome', trim(c.nome || ' ' || c.cognome), 'telefono', c.telefono, 'email', c.email,
      'escluso_whatsapp', exists (select 1 from public.opt_outs o where o.contact_id = c.id and o.canale = 'whatsapp'),
      'escluso_email', exists (select 1 from public.opt_outs o where o.contact_id = c.id and o.canale = 'email')) end,
    'agente', trim(agente.nome || ' ' || agente.cognome),
    'modello', case when tpl.id is not null then jsonb_build_object(
      'testo', tpl.testo, 'oggetto', tpl.oggetto, 'whatsapp_nome', tpl.whatsapp_template_name, 'whatsapp_stato', tpl.whatsapp_template_stato) end,
    'whatsapp_phone_number_id', ms.whatsapp_phone_number_id,
    'email_risposta', coalesce(ms.email_risposta, ag.email),
    'vars', vars
  );
end $$;

-- Chiude un'esecuzione e fa l'azione sul database (attività, cosa da fare, temperatura, appuntamento)
create or replace function public.automation_finish(p_run uuid, p_stato text, p_motivo text, p_canale text, p_testo text, p_task_aggiuntivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  run public.automation_runs;
  a public.automations;
  e jsonb;
  dest uuid;
  agente uuid;
  prop uuid;
begin
  select * into run from public.automation_runs where id = p_run for update;
  if run.id is null or run.stato <> 'in_attesa' then return; end if;
  select * into a from public.automations where id = run.automation_id;

  e := case run.entita_tipo
    when 'contact' then (select to_jsonb(x) from public.contacts x where x.id = run.entita_id)
    when 'property' then (select to_jsonb(x) from public.properties x where x.id = run.entita_id)
    when 'deal' then (select to_jsonb(x) from public.deals x where x.id = run.entita_id)
    when 'acquisition' then (select to_jsonb(x) from public.acquisitions x where x.id = run.entita_id)
    when 'appointment' then (select to_jsonb(x) from public.appointments x where x.id = run.entita_id)
    when 'match' then (select to_jsonb(x) from public.matches x where x.id = run.entita_id)
  end;
  prop := case when run.entita_tipo = 'property' then run.entita_id else (e ->> 'property_id')::uuid end;
  dest := case a.azione_destinatario
    when 'contatto' then case run.entita_tipo when 'contact' then run.entita_id
                              when 'property' then (select x.owner_id from public.properties x where x.id = run.entita_id)
                              else (e ->> 'contact_id')::uuid end
    when 'proprietario' then case run.entita_tipo when 'acquisition' then (e ->> 'contact_id')::uuid
                                  else (select x.owner_id from public.properties x where x.id = prop) end
    else run.contact_id end;
  select x.id into agente from public.profiles x
  where x.attivo and x.agency_id = run.agency_id and (
    (a.azione_destinatario = 'titolare' and x.ruolo = 'titolare')
    or (a.azione_destinatario <> 'titolare' and x.id = coalesce((e ->> 'agente_id')::uuid, (select c.agente_id from public.contacts c where c.id = run.contact_id))))
  order by x.created_at limit 1;
  if agente is null then
    select x.id into agente from public.profiles x where x.agency_id = run.agency_id and x.ruolo = 'titolare' and x.attivo order by x.created_at limit 1;
  end if;

  update public.automation_runs
  set stato = p_stato, motivo = p_motivo, canale = p_canale, testo = left(p_testo, 4000),
      eseguita_at = case when p_stato in ('eseguita', 'fallita', 'saltata', 'annullata') then now() end, bloccato_fino = null
  where id = run.id;

  if p_stato <> 'eseguita' then return; end if;

  if p_canale in ('whatsapp', 'email') then
    insert into public.activities (agency_id, utente_id, contact_id, property_id, tipo, descrizione)
    values (run.agency_id, null, dest, prop, p_canale::public.tipo_attivita,
            left(format('Messaggio automatico (%s): %s', a.nome, p_testo), 2000));
  elsif p_canale = 'task' then
    insert into public.tasks (agency_id, assegnato_a, contact_id, property_id, titolo, scadenza, origine)
    values (run.agency_id, agente, run.contact_id, prop, left(p_testo, 300), (now() at time zone 'Europe/Rome')::date, 'automatica');
  elsif p_canale = 'temperatura' and run.contact_id is not null then
    update public.contacts set temperatura = coalesce((a.azione_contenuto ->> 'temperatura')::public.temperatura_contatto, 'freddo')
    where id = run.contact_id;
    insert into public.activities (agency_id, utente_id, contact_id, tipo, descrizione)
    values (run.agency_id, null, run.contact_id, 'nota', format('Automazione "%s": temperatura cambiata', a.nome));
  elsif p_canale = 'agenda' then
    insert into public.appointments (agency_id, agente_id, contact_id, property_id, tipo, inizio, fine, note)
    values (run.agency_id, agente, run.contact_id, prop, 'altro',
            (((now() at time zone 'Europe/Rome')::date + 1) + time '09:00') at time zone 'Europe/Rome',
            (((now() at time zone 'Europe/Rome')::date + 1) + time '09:30') at time zone 'Europe/Rome', left(p_testo, 500));
  end if;

  if coalesce(trim(p_task_aggiuntivo), '') <> '' then
    insert into public.tasks (agency_id, assegnato_a, contact_id, property_id, titolo, scadenza, origine)
    values (run.agency_id, agente, run.contact_id, prop, left(p_task_aggiuntivo, 300), (now() at time zone 'Europe/Rome')::date, 'automatica');
  end if;
end $$;

create or replace function public.automation_postpone(p_run uuid, p_quando timestamptz, p_motivo text)
returns void language sql security definer set search_path = '' as $$
  update public.automation_runs set esegui_alle = p_quando, motivo = p_motivo, bloccato_fino = null
  where id = p_run and stato = 'in_attesa'
$$;

-- ---------- Risposte e disiscrizioni (solo dalle Edge Functions) ----------
-- Messaggio WhatsApp in arrivo: finisce nella cronologia; "STOP" esclude il contatto dai messaggi WhatsApp
create or replace function public.whatsapp_inbound(p_phone_number_id text, p_from text, p_testo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  ag uuid;
  stop boolean := upper(regexp_replace(coalesce(p_testo, ''), '[^[:alpha:]]', '', 'g')) in ('STOP', 'BASTA', 'ANNULLA', 'DISISCRIVI', 'CANCELLAMI');
  n integer := 0;
  c record;
begin
  select agency_id into ag from public.messaging_settings where whatsapp_phone_number_id = p_phone_number_id;
  if ag is null then return jsonb_build_object('ok', false, 'motivo', 'numero non collegato'); end if;
  for c in select id from public.contacts where agency_id = ag and public.phone_key(telefono) = public.phone_key(p_from) loop
    n := n + 1;
    insert into public.activities (agency_id, utente_id, contact_id, tipo, descrizione)
    values (ag, null, c.id, 'whatsapp', left(format('Ha risposto su WhatsApp: %s', p_testo), 2000));
    if stop then
      insert into public.opt_outs (agency_id, contact_id, canale, motivo) values (ag, c.id, 'whatsapp', 'Ha risposto STOP')
      on conflict do nothing;
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'contatti', n, 'stop', stop);
end $$;

create or replace function public.email_opt_out(p_contact uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  c public.contacts;
begin
  select * into c from public.contacts where id = p_contact;
  if c.id is null then return null; end if;
  insert into public.opt_outs (agency_id, contact_id, canale, motivo) values (c.agency_id, c.id, 'email', 'Link di disiscrizione')
  on conflict do nothing;
  insert into public.activities (agency_id, utente_id, contact_id, tipo, descrizione)
  values (c.agency_id, null, c.id, 'nota', 'Si è disiscritto dalle email automatiche');
  return (select nome from public.agencies where id = c.agency_id);
end $$;

-- Questionario dopo la visita (link nel messaggio): dati per la pagina e salvataggio delle risposte
create or replace function public.questionario_info(p_appointment uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'agenzia', ag.nome, 'indirizzo', p.indirizzo, 'citta', p.citta, 'nome', c.nome,
    'gia_compilato', exists (select 1 from public.visit_feedback f where f.appointment_id = ap.id),
    'scaduto', ap.fine < now() - interval '14 days')
  from public.appointments ap
  join public.agencies ag on ag.id = ap.agency_id
  left join public.properties p on p.id = ap.property_id
  left join public.contacts c on c.id = ap.contact_id
  where ap.id = p_appointment and ap.tipo = 'visita'
$$;

create or replace function public.questionario_save(
  p_appointment uuid, p_voto integer, p_piaciuto text, p_non_piaciuto text, p_prezzo text, p_offerta numeric, p_intenzione text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  ap public.appointments;
begin
  select * into ap from public.appointments where id = p_appointment and tipo = 'visita' and fine > now() - interval '14 days';
  if ap.id is null or exists (select 1 from public.visit_feedback where appointment_id = ap.id) then return false; end if;
  insert into public.visit_feedback (agency_id, appointment_id, contact_id, property_id, agente_id, voto, piaciuto, non_piaciuto,
                                     giudizio_prezzo, offerta, intenzione, fonte)
  values (ap.agency_id, ap.id, ap.contact_id, ap.property_id, ap.agente_id,
          case when p_voto between 1 and 5 then p_voto end, nullif(left(trim(p_piaciuto), 1000), ''), nullif(left(trim(p_non_piaciuto), 1000), ''),
          case when p_prezzo in ('basso', 'giusto', 'alto') then p_prezzo end, case when p_offerta > 0 then p_offerta end,
          case when p_intenzione in ('proposta', 'ci_pensa', 'altro_immobile', 'non_interessato') then p_intenzione end, 'cliente');
  return true;
end $$;

-- Segreti interni (cron, firma dei link) letti dal Vault
create or replace function public.app_secret(p_name text)
returns text language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_name and p_name in ('automazioni_cron_secret', 'automazioni_link_secret')
$$;

-- Contatore per le card: esecuzioni di questo mese per automazione
create or replace function public.automation_stats()
returns table (automation_id uuid, eseguite bigint)
language sql stable security invoker set search_path = '' as $$
  select r.automation_id, count(*) from public.automation_runs r
  where r.stato = 'eseguita' and r.eseguita_at >= date_trunc('month', now() at time zone 'Europe/Rome') at time zone 'Europe/Rome'
  group by r.automation_id
$$;

-- ---------- Permessi ----------
revoke execute on function public.automation_on_event() from public, anon, authenticated;
revoke execute on function public.automation_sweep() from public, anon, authenticated;
revoke execute on function public.automation_claim(integer) from public, anon, authenticated;
revoke execute on function public.automation_prepare(uuid) from public, anon, authenticated;
revoke execute on function public.automation_finish(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.automation_postpone(uuid, timestamptz, text) from public, anon, authenticated;
revoke execute on function public.whatsapp_inbound(text, text, text) from public, anon, authenticated;
revoke execute on function public.email_opt_out(uuid) from public, anon, authenticated;
revoke execute on function public.questionario_info(uuid) from public, anon, authenticated;
revoke execute on function public.questionario_save(uuid, integer, text, text, text, numeric, text) from public, anon, authenticated;
revoke execute on function public.app_secret(text) from public, anon, authenticated;
grant execute on function public.automation_sweep(), public.automation_claim(integer), public.automation_prepare(uuid),
  public.automation_finish(uuid, text, text, text, text, text), public.automation_postpone(uuid, timestamptz, text),
  public.whatsapp_inbound(text, text, text), public.email_opt_out(uuid), public.questionario_info(uuid),
  public.questionario_save(uuid, integer, text, text, text, numeric, text), public.app_secret(text) to service_role;
revoke execute on function public.automation_stats() from public, anon;
grant execute on function public.automation_stats() to authenticated;
