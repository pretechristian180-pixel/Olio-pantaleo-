-- =====================================================================
-- LEAD: casella unica delle richieste in arrivo (modulo del sito, Facebook/Instagram Lead Ads,
-- email dei portali), assegnazione automatica, punteggio di qualità.
-- I lead entrano SOLO dalla Edge Function "lead-ingresso" (service role) tramite lead_ingest().
-- Il titolare vede tutti i lead; l'agente solo quelli assegnati a lui.
-- I token delle pagine Facebook stanno nel Vault, mai in tabella né nel frontend.
-- =====================================================================

-- ---------- Impostazioni per agenzia ----------
create table public.lead_settings (
  agency_id uuid primary key references public.agencies (id) on delete cascade,
  -- Codice pubblico dell'agenzia per il modulo del sito e l'indirizzo email dei portali (non è un segreto)
  token text not null unique default encode(extensions.gen_random_bytes(9), 'hex'),
  assegnazione text not null default 'agente_immobile' check (assegnazione in ('rotazione', 'agente_immobile', 'titolare')),
  -- Agenti nella rotazione: vuoto = tutti gli utenti attivi
  agenti_rotazione uuid[] not null default '{}',
  ultimo_assegnato uuid,
  updated_at timestamptz not null default now()
);
insert into public.lead_settings (agency_id) select id from public.agencies on conflict do nothing;

create or replace function public.lead_settings_new_agency()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.lead_settings (agency_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger agencies_lead_settings after insert on public.agencies
  for each row execute function public.lead_settings_new_agency();

-- ---------- Pagine Facebook/Instagram collegate (il token è nel Vault) ----------
create table public.lead_sources (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  piattaforma text not null default 'meta' check (piattaforma = 'meta'),
  pagina_id text not null unique,
  nome text not null,
  instagram boolean not null default false,
  stato text not null default 'collegata' check (stato in ('collegata', 'da_ricollegare')),
  collegata_at timestamptz not null default now()
);
create index on public.lead_sources (agency_id);

-- ---------- I lead ----------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  contact_id uuid,
  agente_id uuid,
  property_id uuid,
  canale text not null check (canale in ('sito', 'facebook', 'instagram', 'portale', 'email', 'prova')),
  portale text,
  nome text not null default '',
  cognome text not null default '',
  telefono text,
  email text,
  messaggio text,
  riferimento text,
  punteggio integer not null default 0 check (punteggio between 0 and 100),
  motivi text[] not null default '{}',
  stato text not null default 'nuovo' check (stato in ('nuovo', 'contattato', 'appuntamento', 'acquisito', 'perso', 'spam')),
  motivo_perso text,
  primo_contatto_at timestamptz,
  -- Quante volte la stessa persona ha scritto di nuovo (nei 7 giorni)
  ripetuto integer not null default 1,
  esterno_id text,
  ip_hash text,
  consenso_privacy_at timestamptz,
  dati_grezzi jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, agency_id),
  unique (agency_id, esterno_id),
  foreign key (contact_id, agency_id) references public.contacts (id, agency_id) on delete set null (contact_id),
  foreign key (agente_id, agency_id) references public.profiles (id, agency_id) on delete set null (agente_id),
  foreign key (property_id, agency_id) references public.properties (id, agency_id) on delete set null (property_id)
);
create index on public.leads (agency_id, created_at desc);
create index on public.leads (agente_id, stato);
create index on public.leads (contact_id, agency_id);
create index on public.leads (property_id, agency_id);
create index on public.leads (agency_id, ip_hash, created_at) where ip_hash is not null;
create trigger leads_updated_at before update on public.leads for each row execute function public.set_updated_at();

alter table public.lead_settings enable row level security;
alter table public.lead_sources enable row level security;
alter table public.leads enable row level security;

create policy "impostazioni lead: titolare" on public.lead_settings for select to authenticated
  using (agency_id = (select public.get_my_agency_id()) and (select public.is_titolare()));
create policy "pagine collegate: titolare" on public.lead_sources for select to authenticated
  using (agency_id = (select public.get_my_agency_id()) and (select public.is_titolare()));
create policy "lead: titolare tutti, agente i propri" on public.leads for select to authenticated
  using (agency_id = (select public.get_my_agency_id()) and ((select public.is_titolare()) or agente_id = (select auth.uid())));

-- Scritture solo dalle funzioni qui sotto
revoke insert, update, delete on public.lead_settings, public.lead_sources, public.leads from authenticated, anon;
revoke all on public.lead_settings, public.lead_sources, public.leads from anon;

-- ---------- Punteggio di qualità (0-100) con i motivi ----------
create or replace function public.lead_punteggio(p_canale text, p_tel text, p_email text, p_msg text, p_immobile boolean, p_noto boolean,
                                                 out punteggio integer, out motivi text[])
language plpgsql immutable set search_path = '' as $$
declare m text := lower(coalesce(p_msg, ''));
begin
  punteggio := 0; motivi := '{}';
  if p_tel is not null then punteggio := punteggio + 30; motivi := motivi || 'Ha lasciato il telefono'; end if;
  if p_email is not null then punteggio := punteggio + 10; motivi := motivi || 'Ha lasciato l''email'; end if;
  if p_immobile then punteggio := punteggio + 20; motivi := motivi || 'Chiede di un immobile preciso'; end if;
  if m ~ '(visit|vedere|vederl|appuntament|sopralluog|quando posso|disponibil)' then punteggio := punteggio + 15; motivi := motivi || 'Vuole visitare'; end if;
  if m ~ '(mutuo (gia |già )?(approvat|deliberat)|pre.?approvat|contanti|liquidit|subito|urgent|entro (il|fine|giugno|luglio|settembre|dicembre))' then
    punteggio := punteggio + 15; motivi := motivi || 'Pronto a comprare';
  end if;
  if m ~ '(vender|vendita della mia|vendo |valutazion|quanto vale|stima)' then punteggio := punteggio + 15; motivi := motivi || 'Vuole vendere: possibile incarico'; end if;
  if length(m) >= 40 then punteggio := punteggio + 5; motivi := motivi || 'Messaggio dettagliato'; end if;
  if p_noto then punteggio := punteggio + 5; motivi := motivi || 'Già nei tuoi contatti'; end if;
  if m ~ '(https?://|www\.)' then punteggio := punteggio - 20; motivi := motivi || 'Contiene link: possibile spam'; end if;
  punteggio := greatest(0, least(100, punteggio));
end $$;

-- ---------- Scelta dell'agente ----------
create or replace function public.lead_scegli_agente(p_agency uuid, p_property uuid, p_contact uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  s public.lead_settings;
  scelto uuid;
  candidati uuid[];
  i integer;
begin
  -- Cliente già seguito da qualcuno: resta suo
  select c.agente_id into scelto from public.contacts c join public.profiles p on p.id = c.agente_id and p.attivo
  where c.id = p_contact;
  if scelto is not null then return scelto; end if;

  insert into public.lead_settings (agency_id) values (p_agency) on conflict do nothing;
  select * into s from public.lead_settings where agency_id = p_agency for update;

  if s.assegnazione = 'titolare' then
    return (select id from public.profiles where agency_id = p_agency and ruolo = 'titolare' and attivo order by created_at limit 1);
  end if;
  if s.assegnazione = 'agente_immobile' and p_property is not null then
    select pr.agente_id into scelto from public.properties pr join public.profiles p on p.id = pr.agente_id and p.attivo where pr.id = p_property;
    if scelto is not null then return scelto; end if;
  end if;

  -- Rotazione: il prossimo dopo l'ultimo assegnato
  select array_agg(id order by created_at) into candidati from public.profiles
  where agency_id = p_agency and attivo and (cardinality(s.agenti_rotazione) = 0 or id = any (s.agenti_rotazione));
  if candidati is null then
    return (select id from public.profiles where agency_id = p_agency and ruolo = 'titolare' and attivo order by created_at limit 1);
  end if;
  i := coalesce(array_position(candidati, s.ultimo_assegnato), 0);
  scelto := candidati[(i % cardinality(candidati)) + 1];
  update public.lead_settings set ultimo_assegnato = scelto where agency_id = p_agency;
  return scelto;
end $$;

-- ---------- Ingresso di un lead (solo dalla Edge Function, service role) ----------
-- p_dati: nome, cognome, nome_completo, telefono, email, messaggio, riferimento, property_id, portale,
--         esterno_id, ip_hash, privacy (bool), grezzi (jsonb)
create or replace function public.lead_ingest(p_agency uuid, p_canale text, p_dati jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_nome text; v_cognome text; parti text[];
  tel text := public.imp_telefono(p_dati ->> 'telefono');
  mail text := public.imp_email(p_dati ->> 'email');
  msg text := left(nullif(btrim(coalesce(p_dati ->> 'messaggio', '')), ''), 3000);
  rif text := left(nullif(btrim(coalesce(p_dati ->> 'riferimento', '')), ''), 200);
  portale text := left(nullif(btrim(coalesce(p_dati ->> 'portale', '')), ''), 60);
  esterno text := left(nullif(p_dati ->> 'esterno_id', ''), 200);
  ip text := nullif(p_dati ->> 'ip_hash', '');
  prop uuid; cid uuid; agente uuid; esistente public.leads; nuovo uuid;
  noto boolean;
  sc record;
  etichetta text;
  fonte public.fonte_contatto;
  temp public.temperatura_contatto;
  tipo public.tipo_contatto;
begin
  if p_canale not in ('sito', 'facebook', 'instagram', 'portale', 'email', 'prova') then raise exception 'Canale sconosciuto'; end if;
  if not exists (select 1 from public.agencies where id = p_agency and attiva) then raise exception 'Agenzia non attiva'; end if;
  if tel is null and mail is null then raise exception 'Serve un telefono o un''email' using errcode = '22023'; end if;

  -- Stesso lead già arrivato (es. Meta rimanda lo stesso webhook)
  if esterno is not null then
    select * into esistente from public.leads where agency_id = p_agency and esterno_id = esterno;
    if esistente.id is not null then return jsonb_build_object('id', esistente.id, 'duplicato', true); end if;
  end if;

  -- Limite contro gli invii a raffica dal modulo del sito
  if ip is not null and (select count(*) from public.leads where agency_id = p_agency and ip_hash = ip and created_at > now() - interval '10 minutes') >= 3 then
    raise exception 'Troppi invii, riprova tra qualche minuto' using errcode = '54000';
  end if;
  if p_canale = 'sito' and (select count(*) from public.leads where agency_id = p_agency and canale = 'sito' and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'Troppi invii, riprova più tardi' using errcode = '54000';
  end if;

  -- Nome
  v_nome := public.imp_nome(p_dati ->> 'nome');
  v_cognome := public.imp_nome(p_dati ->> 'cognome');
  if v_nome is null and nullif(btrim(coalesce(p_dati ->> 'nome_completo', '')), '') is not null then
    parti := regexp_split_to_array(btrim(p_dati ->> 'nome_completo'), '\s+');
    v_nome := public.imp_nome(parti[1]);
    v_cognome := coalesce(v_cognome, public.imp_nome(array_to_string(parti[2:], ' ')));
  end if;
  v_nome := coalesce(v_nome, split_part(coalesce(mail, ''), '@', 1), 'Lead');
  if v_nome = '' then v_nome := 'Lead'; end if;
  v_cognome := coalesce(v_cognome, '');

  -- Immobile: indicato dal modulo, oppure dal riferimento (codice o indirizzo, se ne trova uno solo)
  if (p_dati ->> 'property_id') ~ '^[0-9a-f-]{36}$' then
    select id into prop from public.properties where id = (p_dati ->> 'property_id')::uuid and agency_id = p_agency;
  end if;
  if prop is null and rif is not null and length(rif) >= 4 then
    select (array_agg(id))[1] into prop from public.properties
    where agency_id = p_agency and (id::text like lower(rif) || '%' or indirizzo ilike '%' || rif || '%' or titolo ilike '%' || rif || '%')
    having count(*) = 1;
  end if;

  cid := public.import_find_contact(p_agency, tel, mail, null);
  noto := cid is not null;
  etichetta := coalesce(portale, case p_canale when 'sito' then 'sito' when 'facebook' then 'Facebook' when 'instagram' then 'Instagram'
                                              when 'portale' then 'portale' when 'prova' then 'prova' else 'email' end);

  -- La stessa persona ha già scritto negli ultimi 7 giorni e il lead è ancora aperto: lo aggiorniamo
  if cid is not null then
    select * into esistente from public.leads
    where agency_id = p_agency and contact_id = cid and stato in ('nuovo', 'contattato') and created_at > now() - interval '7 days'
    order by created_at desc limit 1;
    if esistente.id is not null then
      update public.leads set
        ripetuto = ripetuto + 1,
        messaggio = concat_ws(E'\n\n', messaggio, format('[%s, %s] %s', etichetta, to_char(now() at time zone 'Europe/Rome', 'DD/MM HH24:MI'), coalesce(msg, '(senza messaggio)'))),
        property_id = coalesce(property_id, prop),
        punteggio = least(100, punteggio + 10),
        motivi = case when 'Ha scritto più volte' = any (motivi) then motivi else motivi || 'Ha scritto più volte' end
      where id = esistente.id;
      insert into public.activities (agency_id, contact_id, property_id, tipo, descrizione)
      values (p_agency, cid, prop, 'nota', left(format('Ha scritto di nuovo (%s): %s', etichetta, coalesce(msg, 'senza messaggio')), 500));
      return jsonb_build_object('id', esistente.id, 'duplicato', true, 'contatto', cid);
    end if;
  end if;

  sc := public.lead_punteggio(p_canale, tel, mail, msg, prop is not null, noto);
  agente := public.lead_scegli_agente(p_agency, prop, cid);
  temp := case when sc.punteggio >= 60 then 'caldo' when sc.punteggio >= 35 then 'tiepido' else 'freddo' end;
  fonte := case p_canale when 'sito' then 'sito' when 'facebook' then 'social' when 'instagram' then 'social'
                         when 'portale' then 'portale' else 'altro' end;
  tipo := case when lower(coalesce(msg, '')) ~ '(vender|vendo |valutazion|quanto vale)' then 'proprietario' else 'acquirente' end;

  if cid is null then
    -- Il promemoria lo crea il lead qui sotto (non quello generico del nuovo contatto)
    perform set_config('mattonio.importazione', 'on', true);
    insert into public.contacts (agency_id, agente_id, nome, cognome, telefono, email, tipo, temperatura, fonte, note,
                                 consenso_marketing, consenso_marketing_at)
    values (p_agency, agente, v_nome, v_cognome, tel, mail, tipo, temp, fonte, msg, false, null)
    returning id into cid;
    perform set_config('mattonio.importazione', '', true);
  else
    update public.contacts set agente_id = coalesce(agente_id, agente),
           temperatura = case when temp = 'caldo' then 'caldo' else temperatura end
    where id = cid;
  end if;

  insert into public.leads (agency_id, contact_id, agente_id, property_id, canale, portale, nome, cognome, telefono, email, messaggio,
                            riferimento, punteggio, motivi, esterno_id, ip_hash, consenso_privacy_at, dati_grezzi)
  values (p_agency, cid, agente, prop, p_canale, portale, v_nome, v_cognome, tel, mail, msg, rif, sc.punteggio, sc.motivi, esterno, ip,
          case when (p_dati ->> 'privacy')::boolean then now() end, coalesce(p_dati -> 'grezzi', '{}'))
  returning id into nuovo;

  insert into public.activities (agency_id, contact_id, property_id, tipo, descrizione)
  values (p_agency, cid, prop, 'nota', left(format('Nuovo lead da %s: %s', etichetta, coalesce(msg, 'senza messaggio')), 500));
  insert into public.tasks (agency_id, assegnato_a, contact_id, property_id, titolo, scadenza, origine)
  values (p_agency, agente, cid, prop, trim(format('Richiama %s %s, lead da %s', v_nome, v_cognome, etichetta)),
          (now() at time zone 'Europe/Rome')::date, 'automatica');

  return jsonb_build_object('id', nuovo, 'duplicato', false, 'contatto', cid, 'agente', agente, 'punteggio', sc.punteggio);
end $$;

-- ---------- Lo stato del lead segue il lavoro dell'agente ----------
create or replace function public.lead_on_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.utente_id is not null and new.contact_id is not null and new.tipo in ('chiamata', 'whatsapp', 'email', 'visita') then
    update public.leads set primo_contatto_at = coalesce(primo_contatto_at, new.created_at),
                            stato = case when stato = 'nuovo' then 'contattato' else stato end
    where contact_id = new.contact_id and stato in ('nuovo', 'contattato') and created_at <= new.created_at;
  end if;
  return new;
end $$;
create trigger activities_lead after insert on public.activities for each row execute function public.lead_on_activity();

create or replace function public.lead_on_appointment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.contact_id is not null then
    update public.leads set stato = 'appuntamento', primo_contatto_at = coalesce(primo_contatto_at, now())
    where contact_id = new.contact_id and stato in ('nuovo', 'contattato');
  end if;
  return new;
end $$;
create trigger appointments_lead after insert on public.appointments for each row execute function public.lead_on_appointment();

create or replace function public.lead_on_deal()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.leads set stato = 'acquisito', primo_contatto_at = coalesce(primo_contatto_at, now())
  where contact_id = new.contact_id and stato in ('nuovo', 'contattato', 'appuntamento');
  return new;
end $$;
create trigger deals_lead after insert on public.deals for each row execute function public.lead_on_deal();

-- ---------- Azioni dall'app ----------
create or replace function public.lead_mio(p_lead uuid)
returns public.leads language plpgsql stable security definer set search_path = '' as $$
declare l public.leads;
begin
  select * into l from public.leads where id = p_lead and agency_id = public.get_my_agency_id()
    and (public.is_titolare() or agente_id = (select auth.uid()));
  if l.id is null then raise exception 'Lead non trovato' using errcode = 'P0002'; end if;
  return l;
end $$;

-- Ho chiamato / scritto: finisce nella cronologia del contatto e ferma l'allarme
create or replace function public.lead_segna_contattato(p_lead uuid, p_canale text)
returns void language plpgsql security definer set search_path = '' as $$
declare l public.leads := public.lead_mio(p_lead);
begin
  if p_canale not in ('chiamata', 'whatsapp', 'email') then raise exception 'Canale non valido'; end if;
  if l.contact_id is null then raise exception 'Il contatto del lead non esiste più' using errcode = 'P0002'; end if;
  insert into public.activities (agency_id, utente_id, contact_id, property_id, tipo, descrizione)
  values (l.agency_id, auth.uid(), l.contact_id, l.property_id, p_canale::public.tipo_attivita,
          case p_canale when 'chiamata' then 'Chiamato per il lead' when 'whatsapp' then 'Scritto su WhatsApp per il lead' else 'Scritto via email per il lead' end);
  update public.tasks set completato = true
  where contact_id = l.contact_id and not completato and origine = 'automatica' and titolo like 'Richiama %, lead da %';
end $$;

create or replace function public.lead_cambia_stato(p_lead uuid, p_stato text, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare l public.leads := public.lead_mio(p_lead);
begin
  if p_stato not in ('nuovo', 'contattato', 'perso', 'spam') then raise exception 'Stato non valido'; end if;
  if p_stato = 'perso' and nullif(btrim(coalesce(p_motivo, '')), '') is null then raise exception 'Scrivi il motivo' using errcode = '23514'; end if;
  update public.leads set stato = p_stato, motivo_perso = case when p_stato = 'perso' then left(btrim(p_motivo), 300) end where id = l.id;
  if p_stato in ('perso', 'spam') then
    update public.tasks set completato = true
    where contact_id = l.contact_id and not completato and origine = 'automatica' and titolo like 'Richiama %, lead da %';
    update public.automation_runs set stato = 'annullata', motivo = 'Lead chiuso'
    where entita_id = l.id and stato = 'in_attesa';
  end if;
  if p_stato = 'perso' and l.contact_id is not null then
    insert into public.activities (agency_id, utente_id, contact_id, tipo, descrizione)
    values (l.agency_id, auth.uid(), l.contact_id, 'nota', left('Lead chiuso: ' || btrim(p_motivo), 500));
  end if;
end $$;

-- Solo il titolare riassegna
create or replace function public.lead_assegna(p_lead uuid, p_agente uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare l public.leads := public.lead_mio(p_lead);
begin
  if not public.is_titolare() then raise exception 'Solo il titolare può riassegnare' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = p_agente and agency_id = l.agency_id and attivo) then
    raise exception 'Agente non trovato' using errcode = 'P0002';
  end if;
  update public.leads set agente_id = p_agente where id = l.id;
  update public.contacts set agente_id = p_agente where id = l.contact_id and (agente_id is null or agente_id = l.agente_id);
  update public.tasks set assegnato_a = p_agente
  where contact_id = l.contact_id and not completato and origine = 'automatica' and titolo like 'Richiama %, lead da %';
end $$;

-- Impostazioni (titolare)
create or replace function public.lead_salva_impostazioni(p_assegnazione text, p_agenti uuid[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_titolare() then raise exception 'Solo il titolare' using errcode = '42501'; end if;
  insert into public.lead_settings (agency_id) values (public.get_my_agency_id()) on conflict do nothing;
  update public.lead_settings set assegnazione = p_assegnazione,
    agenti_rotazione = coalesce((select array_agg(id) from public.profiles where id = any (coalesce(p_agenti, '{}')) and agency_id = public.get_my_agency_id()), '{}'),
    updated_at = now()
  where agency_id = public.get_my_agency_id();
end $$;

-- Numeri degli ultimi 30 giorni (titolare: tutti; agente: i propri)
create or replace function public.lead_statistiche()
returns jsonb language sql stable security definer set search_path = '' as $$
  with l as (
    select * from public.leads
    where agency_id = public.get_my_agency_id() and created_at > now() - interval '30 days' and canale <> 'prova' and stato <> 'spam'
      and (public.is_titolare() or agente_id = (select auth.uid()))
  )
  select jsonb_build_object(
    'totale', (select count(*) from l),
    'per_canale', coalesce((select jsonb_object_agg(k, n) from (select coalesce(portale, canale) k, count(*) n from l group by 1) x), '{}'),
    'risposta_minuti', (select round(extract(epoch from percentile_cont(0.5) within group (order by primo_contatto_at - created_at)) / 60)
                        from l where primo_contatto_at is not null),
    'entro_un_ora', (select count(*) from l where primo_contatto_at < created_at + interval '1 hour'),
    'appuntamenti', (select count(*) from l where stato in ('appuntamento', 'acquisito')),
    'da_gestire', (select count(*) from l where stato = 'nuovo')
  )
$$;

-- Lead di prova, per vedere il giro completo
create or replace function public.lead_prova()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_titolare() then raise exception 'Solo il titolare' using errcode = '42501'; end if;
  return public.lead_ingest(public.get_my_agency_id(), 'prova', jsonb_build_object(
    'nome', 'Prova', 'cognome', 'Mattonio', 'telefono', '+39 333 000 ' || lpad((floor(random() * 10000))::int::text, 4, '0'),
    'messaggio', 'Buongiorno, vorrei visitare l''immobile questa settimana. Ho il mutuo già approvato.', 'portale', 'Lead di prova'));
end $$;

-- ---------- Per la Edge Function (service role) ----------
create or replace function public.lead_agenzia_da_token(p_token text)
returns uuid language sql stable security definer set search_path = '' as $$
  select s.agency_id from public.lead_settings s join public.agencies a on a.id = s.agency_id and a.attiva where s.token = p_token
$$;

create or replace function public.lead_meta_salva(p_agency uuid, p_pagina text, p_nome text, p_instagram boolean, p_token text)
returns void language plpgsql security definer set search_path = '' as $$
declare nome_segreto text := 'meta_pagina_' || p_pagina; sid uuid;
begin
  if p_pagina !~ '^\d+$' then raise exception 'Pagina non valida'; end if;
  insert into public.lead_sources (agency_id, pagina_id, nome, instagram, stato, collegata_at)
  values (p_agency, p_pagina, left(p_nome, 200), p_instagram, 'collegata', now())
  on conflict (pagina_id) do update set agency_id = excluded.agency_id, nome = excluded.nome, instagram = excluded.instagram,
                                        stato = 'collegata', collegata_at = now();
  select id into sid from vault.secrets where name = nome_segreto;
  if sid is null then perform vault.create_secret(p_token, nome_segreto, 'Lead Ads: token della pagina Facebook');
  else perform vault.update_secret(sid, p_token); end if;
end $$;

create or replace function public.lead_meta_token(p_pagina text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('agency_id', s.agency_id, 'token', v.decrypted_secret)
  from public.lead_sources s join vault.decrypted_secrets v on v.name = 'meta_pagina_' || s.pagina_id
  where s.pagina_id = p_pagina and s.stato = 'collegata'
$$;

create or replace function public.lead_meta_da_ricollegare(p_pagina text)
returns void language sql security definer set search_path = '' as $$
  update public.lead_sources set stato = 'da_ricollegare' where pagina_id = p_pagina
$$;

-- Scollega una pagina (titolare): via anche il token dal Vault
create or replace function public.lead_meta_scollega(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.lead_sources;
begin
  select * into s from public.lead_sources where id = p_id and agency_id = public.get_my_agency_id();
  if s.id is null or not public.is_titolare() then raise exception 'Pagina non trovata' using errcode = 'P0002'; end if;
  delete from vault.secrets where name = 'meta_pagina_' || s.pagina_id;
  delete from public.lead_sources where id = s.id;
end $$;

-- ---------- Permessi delle funzioni ----------
revoke execute on function public.lead_settings_new_agency(), public.lead_on_activity(), public.lead_on_appointment(), public.lead_on_deal(),
  public.lead_scegli_agente(uuid, uuid, uuid), public.lead_ingest(uuid, text, jsonb), public.lead_agenzia_da_token(text),
  public.lead_meta_salva(uuid, text, text, boolean, text), public.lead_meta_token(text), public.lead_meta_da_ricollegare(text),
  public.lead_mio(uuid), public.lead_punteggio(text, text, text, text, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.lead_ingest(uuid, text, jsonb), public.lead_agenzia_da_token(text),
  public.lead_meta_salva(uuid, text, text, boolean, text), public.lead_meta_token(text), public.lead_meta_da_ricollegare(text)
  to service_role;

revoke execute on function public.lead_segna_contattato(uuid, text), public.lead_cambia_stato(uuid, text, text), public.lead_assegna(uuid, uuid),
  public.lead_salva_impostazioni(text, uuid[]), public.lead_statistiche(), public.lead_prova(), public.lead_meta_scollega(uuid)
  from public, anon;
grant execute on function public.lead_segna_contattato(uuid, text), public.lead_cambia_stato(uuid, text, text), public.lead_assegna(uuid, uuid),
  public.lead_salva_impostazioni(text, uuid[]), public.lead_statistiche(), public.lead_prova(), public.lead_meta_scollega(uuid)
  to authenticated;
