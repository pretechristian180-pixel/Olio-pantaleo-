-- =====================================================================
-- REPORT AI PROPRIETARI: un PDF con visite, impressioni dei visitatori, richieste compatibili,
-- lead e proposte del periodo. Si prepara dalla scheda dell'immobile o parte da solo ogni 15 giorni
-- (ricetta "report_proprietario" delle Automazioni). Il PDF lo crea la Edge Function "report-proprietari".
-- Nel report non compaiono mai nomi o recapiti dei visitatori (privacy): solo date, giudizi e cifre.
-- =====================================================================

create table public.owner_reports (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  property_id uuid not null,
  contact_id uuid,
  agente_id uuid,
  periodo_dal timestamptz not null,
  periodo_al timestamptz not null,
  dati jsonb not null,
  commento text check (commento is null or length(commento) <= 2000),
  -- Numeri letti dal titolare/agente sui portali (dove il portale li mostra): visualizzazioni, contatti, preferiti
  portali jsonb not null default '{}',
  pdf_path text,
  token text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  stato text not null default 'pronto' check (stato in ('pronto', 'inviato')),
  canale_invio text check (canale_invio in ('email', 'whatsapp', 'automatico')),
  inviato_at timestamptz,
  aperto_at timestamptz,
  aperture integer not null default 0,
  origine text not null default 'manuale' check (origine in ('manuale', 'automatico')),
  creato_da uuid,
  created_at timestamptz not null default now(),
  unique (id, agency_id),
  foreign key (property_id, agency_id) references public.properties (id, agency_id) on delete cascade,
  foreign key (contact_id, agency_id) references public.contacts (id, agency_id) on delete set null (contact_id),
  foreign key (agente_id, agency_id) references public.profiles (id, agency_id) on delete set null (agente_id),
  foreign key (creato_da, agency_id) references public.profiles (id, agency_id) on delete set null (creato_da)
);
create index on public.owner_reports (property_id, agency_id, created_at desc);
create index on public.owner_reports (contact_id, agency_id);
create index on public.owner_reports (agente_id, agency_id);
create index on public.owner_reports (creato_da, agency_id);

alter table public.owner_reports enable row level security;
create policy "report: chi segue l'immobile" on public.owner_reports for select to authenticated
  using (agency_id = (select public.get_my_agency_id()) and ((select public.is_titolare()) or public.can_edit_property(property_id)));
revoke insert, update on public.owner_reports from authenticated, anon;
revoke all on public.owner_reports from anon;

-- PDF: bucket privato, letto solo dalla Edge Function (link firmati a tempo)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report', 'report', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

-- ---------- I dati del periodo ----------
create or replace function public.report_dati(p_property uuid, p_dal timestamptz, p_al timestamptz)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  p public.properties;
  ag public.agencies;
  ag_p public.profiles;
  o public.contacts;
  inizio date;
begin
  select * into p from public.properties where id = p_property;
  select * into ag from public.agencies where id = p.agency_id;
  select * into ag_p from public.profiles where id = p.agente_id;
  if ag_p.id is null then
    select * into ag_p from public.profiles where agency_id = p.agency_id and ruolo = 'titolare' and attivo order by created_at limit 1;
  end if;
  select * into o from public.contacts where id = p.owner_id;
  inizio := coalesce(p.data_incarico, (p.created_at at time zone 'Europe/Rome')::date);

  return jsonb_build_object(
    'immobile', jsonb_build_object('titolo', p.titolo, 'indirizzo', p.indirizzo, 'citta', p.citta, 'zona', p.zona, 'prezzo', p.prezzo,
                                   'contratto', p.contratto, 'mq', p.mq, 'locali', p.locali, 'stato', p.stato,
                                   'foto', (select f.url from public.property_photos f where f.property_id = p.id order by f.ordine limit 1)),
    'agenzia', jsonb_build_object('nome', ag.nome, 'telefono', ag.telefono, 'email', ag.email, 'indirizzo', ag.indirizzo, 'logo', ag.logo_url),
    'agente', jsonb_build_object('nome', btrim(ag_p.nome || ' ' || ag_p.cognome), 'telefono', ag_p.telefono),
    'proprietario', jsonb_build_object('nome', btrim(coalesce(o.nome, '') || ' ' || coalesce(o.cognome, ''))),
    'periodo', jsonb_build_object('dal', p_dal, 'al', p_al),
    'giorni_sul_mercato', greatest(0, (now() at time zone 'Europe/Rome')::date - inizio),
    'visite_periodo', (select count(*) from public.appointments a where a.property_id = p.id and a.tipo = 'visita' and a.inizio >= p_dal and a.inizio < least(p_al, now())),
    'visite_totali', (select count(*) from public.appointments a where a.property_id = p.id and a.tipo = 'visita' and a.inizio < now()),
    'visite_in_programma', (select count(*) from public.appointments a where a.property_id = p.id and a.tipo = 'visita' and a.inizio >= now()),
    -- Solo data e giudizi: niente nomi dei visitatori
    'visite', coalesce((select jsonb_agg(jsonb_build_object('data', a.inizio, 'voto', f.voto, 'prezzo', f.giudizio_prezzo, 'intenzione', f.intenzione,
                                                             'piaciuto', f.piaciuto, 'non_piaciuto', f.non_piaciuto) order by a.inizio)
                        from public.appointments a left join public.visit_feedback f on f.appointment_id = a.id
                        where a.property_id = p.id and a.tipo = 'visita' and a.inizio >= p_dal and a.inizio < least(p_al, now())), '[]'),
    'giudizio_prezzo', jsonb_build_object(
        'basso', (select count(*) from public.visit_feedback f where f.property_id = p.id and f.giudizio_prezzo = 'basso'),
        'giusto', (select count(*) from public.visit_feedback f where f.property_id = p.id and f.giudizio_prezzo = 'giusto'),
        'alto', (select count(*) from public.visit_feedback f where f.property_id = p.id and f.giudizio_prezzo = 'alto')),
    'voto_medio', (select round(avg(f.voto), 1) from public.visit_feedback f where f.property_id = p.id and f.voto is not null),
    'piaciuto', coalesce((select jsonb_agg(x.t) from (select f.piaciuto t from public.visit_feedback f
                          where f.property_id = p.id and nullif(btrim(f.piaciuto), '') is not null order by f.created_at desc limit 5) x), '[]'),
    'non_piaciuto', coalesce((select jsonb_agg(x.t) from (select coalesce(nullif(btrim(f.non_piaciuto), ''), f.criticita) t from public.visit_feedback f
                          where f.property_id = p.id and nullif(btrim(coalesce(f.non_piaciuto, f.criticita, '')), '') is not null order by f.created_at desc limit 5) x), '[]'),
    'offerte', coalesce((select jsonb_agg(f.offerta order by f.offerta desc) from public.visit_feedback f where f.property_id = p.id and f.offerta > 0), '[]'),
    'richieste_compatibili', (select count(*) from public.matches m where m.property_id = p.id and m.stato <> 'scartato'),
    'richieste_nuove', (select count(*) from public.matches m where m.property_id = p.id and m.created_at >= p_dal and m.created_at < p_al),
    'proposto_a', (select count(*) from public.matches m where m.property_id = p.id and m.proposto_at >= p_dal and m.proposto_at < p_al),
    'interessati', (select count(*) from public.matches m where m.property_id = p.id and m.stato = 'interessato'),
    'lead', (select count(*) from public.leads l where l.property_id = p.id and l.created_at >= p_dal and l.created_at < p_al and l.stato <> 'spam'),
    'trattative', (select count(*) from public.deals d where d.property_id = p.id and d.fase in ('proposta', 'compromesso')),
    'miglior_proposta', (select max(d.valore) from public.deals d where d.property_id = p.id and d.fase in ('proposta', 'compromesso', 'rogito'))
  );
end $$;

-- Periodo: dall'ultimo report (o dall'incarico, al massimo 15 giorni indietro) a oggi
create or replace function public.report_periodo_dal(p_property uuid)
returns timestamptz language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select max(r.periodo_al) from public.owner_reports r where r.property_id = p_property),
    (select greatest(now() - interval '15 days', coalesce(p.data_incarico::timestamptz, p.created_at)) from public.properties p where p.id = p_property))
$$;

-- ---------- Creazione dall'app (chi segue l'immobile) ----------
create or replace function public.report_crea(p_property uuid, p_commento text, p_portali jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare p public.properties; dal timestamptz; nuovo uuid; portali jsonb := '{}';
begin
  if not public.can_edit_property(p_property) then raise exception 'Immobile non trovato' using errcode = 'P0002'; end if;
  select * into p from public.properties where id = p_property;
  -- Solo numeri interi positivi dai portali
  select coalesce(jsonb_object_agg(k, v::int), '{}') into portali
  from jsonb_each_text(coalesce(p_portali, '{}')) as e(k, v)
  where k in ('visualizzazioni', 'contatti', 'preferiti') and v ~ '^\d{1,7}$';
  dal := public.report_periodo_dal(p.id);
  insert into public.owner_reports (agency_id, property_id, contact_id, agente_id, periodo_dal, periodo_al, dati, commento, portali, origine, creato_da)
  values (p.agency_id, p.id, p.owner_id, p.agente_id, dal, now(), public.report_dati(p.id, dal, now()),
          nullif(left(btrim(coalesce(p_commento, '')), 2000), ''), portali, 'manuale', auth.uid())
  returning id into nuovo;
  return nuovo;
end $$;

-- ---------- Creazione automatica (Edge Function, service role) ----------
create or replace function public.report_crea_auto(p_property uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare p public.properties; r public.owner_reports; dal timestamptz;
begin
  select * into p from public.properties where id = p_property;
  if p.id is null then raise exception 'Immobile non trovato'; end if;
  -- Se c'è già un report recente non inviato (es. un nuovo tentativo), si riusa
  select * into r from public.owner_reports where property_id = p.id and created_at > now() - interval '2 days' and stato = 'pronto'
  order by created_at desc limit 1;
  if r.id is null then
    dal := public.report_periodo_dal(p.id);
    insert into public.owner_reports (agency_id, property_id, contact_id, agente_id, periodo_dal, periodo_al, dati, origine)
    values (p.agency_id, p.id, p.owner_id, p.agente_id, dal, now(), public.report_dati(p.id, dal, now()), 'automatico')
    returning * into r;
  end if;
  return jsonb_build_object('id', r.id, 'token', r.token, 'agency_id', r.agency_id, 'pdf_path', r.pdf_path);
end $$;

create or replace function public.report_imposta_pdf(p_report uuid, p_path text)
returns void language sql security definer set search_path = '' as $$
  update public.owner_reports set pdf_path = p_path where id = p_report
$$;

-- Dati per costruire il PDF (Edge Function)
create or replace function public.report_per_pdf(p_report uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', r.id, 'agency_id', r.agency_id, 'token', r.token, 'dati', r.dati, 'commento', r.commento, 'portali', r.portali,
                            'creato', r.created_at)
  from public.owner_reports r where r.id = p_report
$$;

-- Segnato come inviato (dall'app: email o WhatsApp dell'agente; dalle automazioni: automatico)
create or replace function public.report_segna_inviato(p_report uuid, p_canale text)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.owner_reports;
begin
  select * into r from public.owner_reports where id = p_report and agency_id = public.get_my_agency_id();
  if r.id is null or not public.can_edit_property(r.property_id) then raise exception 'Report non trovato' using errcode = 'P0002'; end if;
  if p_canale not in ('email', 'whatsapp') then raise exception 'Canale non valido'; end if;
  update public.owner_reports set stato = 'inviato', canale_invio = p_canale, inviato_at = now() where id = r.id;
  if r.contact_id is not null then
    insert into public.activities (agency_id, utente_id, contact_id, property_id, tipo, descrizione)
    values (r.agency_id, auth.uid(), r.contact_id, r.property_id, p_canale::public.tipo_attivita, 'Inviato il report sull''andamento dell''immobile');
  end if;
end $$;

create or replace function public.report_inviato_auto(p_report uuid)
returns void language sql security definer set search_path = '' as $$
  update public.owner_reports set stato = 'inviato', canale_invio = 'automatico', inviato_at = coalesce(inviato_at, now()) where id = p_report
$$;

-- Il proprietario apre il link: lo segniamo (e lo diciamo all'agente la prima volta)
create or replace function public.report_apri(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.owner_reports;
begin
  select * into r from public.owner_reports where token = p_token;
  if r.id is null or r.pdf_path is null then return null; end if;
  update public.owner_reports set aperture = aperture + 1, aperto_at = coalesce(aperto_at, now()) where id = r.id;
  if r.aperto_at is null and r.contact_id is not null then
    insert into public.activities (agency_id, contact_id, property_id, tipo, descrizione)
    values (r.agency_id, r.contact_id, r.property_id, 'nota', 'Ha aperto il report sull''andamento dell''immobile');
  end if;
  return jsonb_build_object('pdf_path', r.pdf_path, 'agenzia', r.dati -> 'agenzia' ->> 'nome', 'indirizzo', r.dati -> 'immobile' ->> 'indirizzo',
                            'dal', r.periodo_dal, 'al', r.periodo_al);
end $$;

-- ---------- Permessi ----------
revoke execute on function public.report_dati(uuid, timestamptz, timestamptz), public.report_periodo_dal(uuid), public.report_crea_auto(uuid),
  public.report_imposta_pdf(uuid, text), public.report_per_pdf(uuid), public.report_inviato_auto(uuid), public.report_apri(text)
  from public, anon, authenticated;
grant execute on function public.report_crea_auto(uuid), public.report_imposta_pdf(uuid, text), public.report_per_pdf(uuid),
  public.report_inviato_auto(uuid), public.report_apri(text) to service_role;
revoke execute on function public.report_crea(uuid, text, jsonb), public.report_segna_inviato(uuid, text) from public, anon;
grant execute on function public.report_crea(uuid, text, jsonb), public.report_segna_inviato(uuid, text) to authenticated;

-- ---------- Ricetta dei 15 giorni: ora allega il report ----------
update public.automations set
  azione_contenuto = azione_contenuto || '{"report": true}',
  descrizione = 'Per ogni immobile disponibile mandiamo al proprietario un''email con il link al report PDF: visite, impressioni dei visitatori, acquirenti interessati e giorni sul mercato.'
where ricetta_codice = 'report_proprietario';
update public.message_templates set
  testo = testo || E'\n\nIl report completo, con le impressioni dei visitatori, lo trova qui: {{link_report}}'
where codice = 'report_proprietario' and position('{{link_report}}' in testo) = 0;

do $patch$
declare def text;
begin
  def := pg_get_functiondef('public.automation_install_recipes(uuid)'::regprocedure);
  def := replace(def, $r$'{"template": "report_proprietario"}'$r$, $r$'{"template": "report_proprietario", "report": true}'$r$);
  def := replace(def, $r$'Per ogni immobile disponibile mandiamo al proprietario un''email con visite, acquirenti interessati e giorni sul mercato.'$r$,
                      $r$'Per ogni immobile disponibile mandiamo al proprietario un''email con il link al report PDF: visite, impressioni dei visitatori, acquirenti interessati e giorni sul mercato.'$r$);
  def := replace(def, $r$Per qualsiasi domanda sono a sua disposizione.\n{{nome_agente}}, {{nome_agenzia}}',$r$,
                      $r$Il report completo, con le impressioni dei visitatori, lo trova qui: {{link_report}}\n\nPer qualsiasi domanda sono a sua disposizione.\n{{nome_agente}}, {{nome_agenzia}}',$r$);
  if position('"report": true' in def) = 0 or position('{{link_report}}' in def) = 0 then
    raise exception 'automation_install_recipes: modifica non applicata';
  end if;
  execute def;
end $patch$;
