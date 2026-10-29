-- =====================================================================
-- Sorpasso AI – scheda veicolo come "centro di controllo" dell'auto
--
-- * Scheda tecnica completa (allestimento, potenza, optional, garanzia…)
-- * Documenti privati del veicolo (libretto, certificato di proprietà, perizia)
-- * Conto economico: registro costi e ricavi per auto, categorie modificabili,
--   costo di giacenza, regime IVA, prezzo minimo e prezzo obiettivo
-- * Pagina pubblica della scheda (token non indovinabile)
-- * Dati economici visibili solo a titolare, responsabile vendite e amministrazione
-- =====================================================================

-- ---------- Nuovi valori dei tipi ----------
-- (aggiunti ma non usati in questa migrazione: Postgres non lo consente nella stessa transazione)
alter type public.tipo_veicolo add value if not exists 'aziendale';
alter type public.tipo_documento add value if not exists 'certificato_proprieta';
alter type public.tipo_documento add value if not exists 'perizia';

create type public.regime_iva as enum ('ordinario', 'margine');
create type public.tipo_voce_economica as enum ('costo', 'ricavo');

-- ---------- Impostazioni della concessionaria ----------
alter table public.organizations
  add column whatsapp text,
  add column costo_giacenza_giorno numeric(8, 2) not null default 15 check (costo_giacenza_giorno >= 0),
  add column margine_obiettivo_pct numeric(5, 2) not null default 10 check (margine_obiettivo_pct between 0 and 90),
  -- 'nessuno' = compilazione a mano; gli altri provider sono in supabase/functions/_shared/decoder
  add column decoder_provider text not null default 'nessuno';

-- ---------- Scheda tecnica ----------
alter table public.vehicles
  add column allestimento text,
  add column carrozzeria text,
  add column porte smallint check (porte between 1 and 6),
  add column posti smallint check (posti between 1 and 9),
  add column mese_immatricolazione smallint check (mese_immatricolazione between 1 and 12),
  add column cilindrata integer check (cilindrata between 0 and 10000),
  add column potenza_kw integer check (potenza_kw between 0 and 2000),
  add column trazione text check (trazione in ('anteriore', 'posteriore', 'integrale')),
  add column classe_euro text,
  add column consumo_misto numeric(5, 2) check (consumo_misto >= 0),
  add column emissioni_co2 integer check (emissioni_co2 between 0 and 1000),
  add column colore_interni text,
  add column numero_proprietari smallint check (numero_proprietari between 0 and 20),
  add column tagliandi_certificati boolean not null default false,
  add column garanzia_mesi smallint check (garanzia_mesi between 0 and 120),
  add column garanzia_tipo text,
  add column neopatentati boolean not null default false,
  add column optional text[] not null default '{}',
  add column optional_extra text,
  add column difetti text,
  add column descrizione_breve text,
  add column regime_iva public.regime_iva not null default 'margine',
  -- Sconto massimo che il venditore può concedere senza chiedere (visibile a tutti)
  add column sconto_max numeric(12, 2) check (sconto_max >= 0),
  add column pubblica boolean not null default true,
  add column token_pubblico uuid not null default gen_random_uuid();

create unique index vehicles_token_pubblico_uq on public.vehicles (token_pubblico);

-- Massimo 50 foto per auto
create or replace function public.vehicle_photos_limite()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if (select count(*) from public.vehicle_photos where vehicle_id = new.vehicle_id) >= 50 then
    raise exception 'Puoi caricare al massimo 50 foto per auto' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger vehicle_photos_limite before insert on public.vehicle_photos
for each row execute function public.vehicle_photos_limite();

-- ---------- Documenti del veicolo (privati) ----------
alter table public.documents add column vehicle_id uuid;
alter table public.documents
  add constraint documents_vehicle_fk foreign key (vehicle_id, organization_id)
    references public.vehicles (id, organization_id) on delete cascade;
alter table public.documents drop constraint documents_check;
alter table public.documents add constraint documents_collegamento_check
  check (contact_id is not null or deal_id is not null or vehicle_id is not null);
create index documents_vehicle_idx on public.documents (vehicle_id);

-- Le policy esistenti già escludono il venditore dai documenti del solo veicolo
-- (servono un contatto o una pratica visibili). L'inserimento dei documenti veicolo
-- è riservato ai ruoli con accesso ai dati economici/amministrativi.
drop policy "documenti: inserimento" on public.documents;
create policy "documenti: inserimento" on public.documents for insert to authenticated
  with check (organization_id = (select public.mia_org())
              and caricato_da = (select auth.uid())
              and ((select public.ha_ruolo('titolare', 'responsabile_vendite', 'amministrazione'))
                   or (vehicle_id is null
                       and (exists (select 1 from public.deals d where d.id = documents.deal_id)
                            or exists (select 1 from public.contacts c where c.id = documents.contact_id)))));

-- ---------- Conto economico ----------

-- Il vecchio vehicle_costs conteneva solo il prezzo di acquisto: diventa una voce "Acquisto".
alter table public.vehicle_costs rename to vehicle_costs_vecchio;
drop policy "costi: solo manager" on public.vehicle_costs_vecchio;
drop trigger vehicle_costs_updated on public.vehicle_costs_vecchio;

create table public.categorie_economiche (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.mia_org() references public.organizations (id) on delete cascade,
  tipo public.tipo_voce_economica not null,
  nome text not null check (length(trim(nome)) > 0),
  ordine integer not null default 0,
  -- Le categorie di sistema ("Acquisto", "Prezzo di vendita") non si rinominano né si eliminano:
  -- i calcoli le riconoscono per nome.
  di_sistema boolean not null default false,
  attiva boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, tipo, nome)
);

create table public.vehicle_costs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.mia_org() references public.organizations (id) on delete cascade,
  vehicle_id uuid not null,
  data date not null default current_date,
  categoria text not null check (length(trim(categoria)) > 0),
  descrizione text,
  fornitore text,
  -- Imponibile (netto IVA)
  importo numeric(12, 2) not null check (importo >= 0),
  iva_aliquota numeric(5, 2) not null default 22 check (iva_aliquota between 0 and 100),
  importo_iva numeric(12, 2) generated always as (round(importo * iva_aliquota / 100, 2)) stored,
  importo_lordo numeric(12, 2) generated always as (importo + round(importo * iva_aliquota / 100, 2)) stored,
  -- Fattura nel bucket documents: {org}/costi/{vehicle_id}/...
  allegato_path text,
  creato_da uuid default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (vehicle_id, organization_id) references public.vehicles (id, organization_id) on delete cascade
);
create index vehicle_costs_vehicle_idx on public.vehicle_costs (vehicle_id, data);
create index vehicle_costs_org_data_idx on public.vehicle_costs (organization_id, data);

create table public.vehicle_revenues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.mia_org() references public.organizations (id) on delete cascade,
  vehicle_id uuid not null,
  data date not null default current_date,
  categoria text not null check (length(trim(categoria)) > 0),
  descrizione text,
  -- Importo incassato dal cliente (IVA compresa, se dovuta)
  importo numeric(12, 2) not null check (importo >= 0),
  -- Per "Prezzo di vendita" in regime del margine l'IVA si calcola sul margine, non sull'importo
  iva_aliquota numeric(5, 2) not null default 22 check (iva_aliquota between 0 and 100),
  deal_id uuid references public.deals (id) on delete set null,
  creato_da uuid default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (vehicle_id, organization_id) references public.vehicles (id, organization_id) on delete cascade
);
create index vehicle_revenues_vehicle_idx on public.vehicle_revenues (vehicle_id, data);
create unique index vehicle_revenues_vendita_uq on public.vehicle_revenues (vehicle_id) where categoria = 'Prezzo di vendita';

insert into public.vehicle_costs (organization_id, vehicle_id, data, categoria, descrizione, importo, iva_aliquota)
select c.organization_id, c.vehicle_id, v.data_ingresso, 'Acquisto', 'Prezzo di acquisto', c.prezzo_acquisto,
       case when v.regime_iva = 'ordinario' then 22 else 0 end
from public.vehicle_costs_vecchio c
join public.vehicles v on v.id = c.vehicle_id
where c.prezzo_acquisto is not null;

drop table public.vehicle_costs_vecchio;

-- Categorie predefinite (anche per le concessionarie già esistenti)
create or replace function public.crea_categorie_predefinite(p_org uuid)
returns void language sql security definer set search_path = ''
as $$
  insert into public.categorie_economiche (organization_id, tipo, nome, ordine, di_sistema)
  select p_org, x.tipo::public.tipo_voce_economica, x.nome, x.ordine, x.sistema
  from (values
    ('costo', 'Acquisto', 1, true),
    ('costo', 'Trasporto', 2, false),
    ('costo', 'Passaggio di proprietà e pratiche', 3, false),
    ('costo', 'Revisione', 4, false),
    ('costo', 'Meccanica', 5, false),
    ('costo', 'Carrozzeria', 6, false),
    ('costo', 'Pneumatici', 7, false),
    ('costo', 'Preparazione e lavaggio', 8, false),
    ('costo', 'Garanzia', 9, false),
    ('costo', 'Pubblicità e portali', 10, false),
    ('costo', 'Provvigione venditore', 11, false),
    ('costo', 'Altro', 12, false),
    ('ricavo', 'Prezzo di vendita', 1, true),
    ('ricavo', 'Provvigione finanziamento', 2, false),
    ('ricavo', 'Garanzie e assicurazioni', 3, false),
    ('ricavo', 'Accessori', 4, false),
    ('ricavo', 'Altro', 5, false)
  ) as x(tipo, nome, ordine, sistema)
  on conflict (organization_id, tipo, nome) do nothing
$$;
revoke execute on function public.crea_categorie_predefinite(uuid) from public, anon, authenticated;

do $$
begin
  perform public.crea_categorie_predefinite(id) from public.organizations;
end $$;

-- Onboarding: alle nuove concessionarie servono anche le categorie.
create or replace function public.crea_organizzazione(
  p_nome_azienda text,
  p_nome_utente text,
  p_piva text default null,
  p_telefono text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  org uuid;
begin
  if uid is null then
    raise exception 'Accesso richiesto' using errcode = '28000';
  end if;
  if exists (select 1 from public.profiles where user_id = uid) then
    raise exception 'Il tuo account è già collegato a una concessionaria' using errcode = 'P0001';
  end if;

  insert into public.organizations (nome, piva, telefono, whatsapp)
  values (trim(p_nome_azienda), nullif(trim(coalesce(p_piva, '')), ''), p_telefono, p_telefono)
  returning id into org;

  insert into public.profiles (user_id, organization_id, nome, email, ruolo, telefono)
  values (uid, org, trim(p_nome_utente), (select u.email from auth.users u where u.id = uid), 'titolare', p_telefono);

  perform public.crea_template_predefiniti(org);
  perform public.crea_categorie_predefinite(org);
  return org;
end $$;

-- Le categorie di sistema non si rinominano né si eliminano.
create or replace function public.categorie_proteggi_sistema()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if old.di_sistema and (tg_op = 'DELETE' or new.nome <> old.nome or new.tipo <> old.tipo or not new.attiva) then
    raise exception 'La categoria «%» è usata nei calcoli e non si può modificare', old.nome using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create trigger categorie_proteggi_sistema before update or delete on public.categorie_economiche
for each row execute function public.categorie_proteggi_sistema();

-- Vendita chiusa: il prezzo finale diventa il ricavo "Prezzo di vendita" dell'auto.
create or replace function public.deals_ricavo_vendita()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.vehicle_revenues (organization_id, vehicle_id, data, categoria, descrizione, importo, deal_id, creato_da)
  values (new.organization_id, new.vehicle_id, new.data_vendita, 'Prezzo di vendita', 'Da pratica di vendita',
          new.prezzo_finale, new.id, auth.uid())
  on conflict (vehicle_id) where categoria = 'Prezzo di vendita'
  do update set importo = excluded.importo, data = excluded.data, deal_id = excluded.deal_id;
  return null;
end $$;

create trigger deals_ricavo_vendita after insert or update of prezzo_finale, data_vendita on public.deals
for each row execute function public.deals_ricavo_vendita();

-- Vendite già chiuse prima di questa migrazione
insert into public.vehicle_revenues (organization_id, vehicle_id, data, categoria, descrizione, importo, deal_id)
select d.organization_id, d.vehicle_id, d.data_vendita, 'Prezzo di vendita', 'Da pratica di vendita', d.prezzo_finale, d.id
from public.deals d
on conflict (vehicle_id) where categoria = 'Prezzo di vendita' do nothing;

-- ---------- Calcoli economici ----------
-- Formule (a = aliquota IVA, C = costi effettivi, G = costo di giacenza, P = prezzo al cliente IVA inclusa):
--   regime ordinario: IVA vendita = P·a/(100+a); i costi contano al netto (IVA detraibile)
--   regime del margine: IVA = (P − C)·a/(100+a) se positivo; i costi contano al lordo
--   margine = ricavo netto vendita + altri ricavi netti − C
--   prezzo minimo (pareggio con la giacenza maturata):
--     ordinario: (C+G)·(1+a/100)         margine: C + G·(1+a/100)
--   prezzo obiettivo (margine m% sul ricavo netto): Pn = (C+G)/(1−m)
--     ordinario: Pn·(1+a/100)            margine: (Pn − C·a/(100+a))·(100+a)/100
-- Nota per l'utente: verificare sempre i criteri fiscali con il commercialista.
create or replace function public.calcola_economia(
  p_regime public.regime_iva,
  p_prezzo numeric,
  p_aliquota numeric,
  p_costi numeric,
  p_altri_ricavi_netti numeric,
  p_giacenza numeric,
  p_obiettivo_pct numeric
)
returns table (
  iva_vendita numeric,
  ricavo_vendita_netto numeric,
  margine numeric,
  margine_pct numeric,
  prezzo_minimo numeric,
  prezzo_obiettivo numeric
)
language sql immutable set search_path = ''
as $$
  with x as (
    select
      case
        when p_prezzo is null then null
        when p_regime = 'ordinario' then p_prezzo * p_aliquota / (100 + p_aliquota)
        else greatest(p_prezzo - p_costi, 0) * p_aliquota / (100 + p_aliquota)
      end as iva,
      (p_costi + p_giacenza) / (1 - p_obiettivo_pct / 100) as pn_obiettivo
  )
  select
    round(x.iva, 2),
    round(p_prezzo - x.iva, 2),
    round(p_prezzo - x.iva + p_altri_ricavi_netti - p_costi, 2),
    case when coalesce(p_prezzo - x.iva + p_altri_ricavi_netti, 0) > 0
         then round((p_prezzo - x.iva + p_altri_ricavi_netti - p_costi) * 100 / (p_prezzo - x.iva + p_altri_ricavi_netti), 1) end,
    ceil(case when p_regime = 'ordinario' then (p_costi + p_giacenza) * (1 + p_aliquota / 100)
              else p_costi + p_giacenza * (1 + p_aliquota / 100) end),
    ceil(case when p_regime = 'ordinario' then x.pn_obiettivo * (1 + p_aliquota / 100)
              else (x.pn_obiettivo - p_costi * p_aliquota / (100 + p_aliquota)) * (100 + p_aliquota) / 100 end)
  from x
$$;

-- Una riga per auto con tutti i numeri del conto economico.
-- security_invoker + filtro sul ruolo: chi non ha accesso ai dati economici non vede righe.
create view public.vehicle_economics with (security_invoker = true) as
with base as (
  select
    v.id as vehicle_id,
    v.organization_id,
    v.marca, v.modello, v.versione, v.targa, v.tipo, v.stato, v.regime_iva,
    v.prezzo_vendita as prezzo_listino,
    v.sconto_max,
    v.data_ingresso,
    v.data_uscita,
    (coalesce(v.data_uscita, current_date) - v.data_ingresso) as giorni_stock,
    o.costo_giacenza_giorno,
    o.margine_obiettivo_pct,
    d.id as deal_id,
    d.data_vendita,
    d.venditore_id,
    p.nome as venditore_nome,
    coalesce(c.netti, 0) as costi_netti,
    coalesce(c.iva, 0) as costi_iva,
    coalesce(c.lordi, 0) as costi_lordi,
    -- Costi che pesano davvero: netti in regime ordinario (IVA detraibile), lordi nel regime del margine
    case when v.regime_iva = 'ordinario' then coalesce(c.netti, 0) else coalesce(c.lordi, 0) end as costi_effettivi,
    coalesce(c.acquisto, 0) as costo_acquisto,
    rv.importo as vendita_registrata,
    coalesce(rv.iva_aliquota, 22) as aliquota_vendita,
    coalesce(ra.lordi, 0) as altri_ricavi_lordi,
    coalesce(ra.netti, 0) as altri_ricavi_netti
  from public.vehicles v
  join public.organizations o on o.id = v.organization_id
  left join public.deals d on d.vehicle_id = v.id
  left join public.profiles p on p.user_id = d.venditore_id
  left join lateral (
    select sum(x.importo) as netti, sum(x.importo_iva) as iva, sum(x.importo_lordo) as lordi,
           sum(case when x.categoria = 'Acquisto' then x.importo_lordo else 0 end) as acquisto
    from public.vehicle_costs x where x.vehicle_id = v.id
  ) c on true
  left join lateral (
    select x.importo, x.iva_aliquota from public.vehicle_revenues x
    where x.vehicle_id = v.id and x.categoria = 'Prezzo di vendita'
  ) rv on true
  left join lateral (
    select sum(x.importo) as lordi, sum(x.importo * 100 / (100 + x.iva_aliquota)) as netti
    from public.vehicle_revenues x where x.vehicle_id = v.id and x.categoria <> 'Prezzo di vendita'
  ) ra on true
  where public.ha_ruolo('titolare', 'responsabile_vendite', 'amministrazione')
)
select
  b.*,
  (b.vendita_registrata is not null) as venduta,
  coalesce(b.vendita_registrata, b.prezzo_listino) as prezzo_riferimento,
  round(b.giorni_stock * b.costo_giacenza_giorno, 2) as costo_giacenza,
  e.iva_vendita,
  e.ricavo_vendita_netto,
  e.margine,
  e.margine_pct,
  round(e.margine - b.giorni_stock * b.costo_giacenza_giorno, 2) as margine_dopo_giacenza,
  e.prezzo_minimo,
  e.prezzo_obiettivo,
  case
    when e.margine is null then null
    when e.margine < 0 then 'rosso'
    when e.margine_pct >= b.margine_obiettivo_pct then 'verde'
    else 'giallo'
  end as semaforo
from base b
cross join lateral public.calcola_economia(
  b.regime_iva,
  coalesce(b.vendita_registrata, b.prezzo_listino),
  b.aliquota_vendita,
  b.costi_effettivi,
  b.altri_ricavi_netti,
  b.giorni_stock * b.costo_giacenza_giorno,
  b.margine_obiettivo_pct
) e;

-- La vista stock va ricreata per includere le nuove colonne di vehicles.
drop view public.vehicles_view;
create view public.vehicles_view with (security_invoker = true) as
select
  v.*,
  (coalesce(v.data_uscita, current_date) - v.data_ingresso) as giorni_giacenza,
  (v.stato <> 'venduto' and (current_date - v.data_ingresso) > o.soglia_giacenza_giorni) as oltre_soglia,
  o.soglia_giacenza_giorni,
  (select ph.storage_path from public.vehicle_photos ph
    where ph.vehicle_id = v.id order by ph.ordine, ph.created_at limit 1) as foto_copertina,
  (select count(*) from public.vehicle_photos ph where ph.vehicle_id = v.id)::int as numero_foto,
  (select count(*) from public.leads l
    where l.vehicle_id = v.id and l.stato not in ('vinto', 'perso'))::int as lead_aperti
from public.vehicles v
join public.organizations o on o.id = v.organization_id;

-- ---------- RLS dati economici ----------
alter table public.categorie_economiche enable row level security;
alter table public.vehicle_costs enable row level security;
alter table public.vehicle_revenues enable row level security;

create policy "categorie: ruoli economici" on public.categorie_economiche for all to authenticated
  using (organization_id = (select public.mia_org())
         and (select public.ha_ruolo('titolare', 'responsabile_vendite', 'amministrazione')))
  with check (organization_id = (select public.mia_org())
              and (select public.ha_ruolo('titolare', 'responsabile_vendite', 'amministrazione')));

create policy "costi: ruoli economici" on public.vehicle_costs for all to authenticated
  using (organization_id = (select public.mia_org())
         and (select public.ha_ruolo('titolare', 'responsabile_vendite', 'amministrazione')))
  with check (organization_id = (select public.mia_org())
              and (select public.ha_ruolo('titolare', 'responsabile_vendite', 'amministrazione')));

create policy "ricavi: ruoli economici" on public.vehicle_revenues for all to authenticated
  using (organization_id = (select public.mia_org())
         and (select public.ha_ruolo('titolare', 'responsabile_vendite', 'amministrazione')))
  with check (organization_id = (select public.mia_org())
              and (select public.ha_ruolo('titolare', 'responsabile_vendite', 'amministrazione')));

-- ---------- Storage ----------
-- Le fatture dei costi stanno nel bucket documents: si scaricano solo se il costo è visibile.
drop policy "documenti: download" on storage.objects;
create policy "documenti: download" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select public.mia_org())::text
         and (exists (select 1 from public.documents d where d.storage_path = objects.name)
              or exists (select 1 from public.quotes q where q.pdf_path = objects.name)
              or exists (select 1 from public.vehicle_costs c where c.allegato_path = objects.name)));

-- Riordino foto (aggiornamento dell'oggetto non serve: si aggiorna solo vehicle_photos.ordine).
-- Loghi delle concessionarie: bucket pubblico (compaiono su PDF e pagina pubblica).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('loghi', 'loghi', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

create policy "loghi: caricamento titolare" on storage.objects for insert to authenticated
  with check (bucket_id = 'loghi' and (storage.foldername(name))[1] = (select public.mia_org())::text
              and (select public.ha_ruolo('titolare')));
create policy "loghi: eliminazione titolare" on storage.objects for delete to authenticated
  using (bucket_id = 'loghi' and (storage.foldername(name))[1] = (select public.mia_org())::text
         and (select public.ha_ruolo('titolare')));
