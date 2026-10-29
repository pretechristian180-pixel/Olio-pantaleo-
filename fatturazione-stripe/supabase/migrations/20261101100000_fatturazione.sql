-- =====================================================================
-- Fatturazione automatica Stripe → Fatture in Cloud (SDI)
--
--   billing_profiles   dati di fatturazione dei clienti (copia anche nei metadata del Customer Stripe)
--   fiscal_settings    configurazione fiscale dell'emittente (UNA riga, nessun valore fisso nel codice)
--   stripe_events      ogni evento Stripe ricevuto, chiave = event id → idempotenza
--   invoice_jobs       coda: una fattura per Stripe invoice, una nota di credito per refund
--   invoices           documenti emessi su Fatture in Cloud e loro stato SDI
--   fic_subscriptions  subscription webhook registrate su Fatture in Cloud
--   avvisi             avvisi per l'amministratore (anche via email)
--   operation_logs     registro di ogni operazione, senza dati sensibili completi
--   app_admins         chi può usare il pannello
--
-- RLS ovunque: solo gli amministratori leggono; le Edge Function usano la service role.
-- =====================================================================

-- ---------- Amministratori ----------
create table public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()))
$$;

-- ---------- Tipi ----------
create type public.tipo_documento_fiscale as enum ('fattura', 'nota_credito');
create type public.stato_job_fattura as enum (
  'in_coda', 'in_lavorazione', 'emessa', 'inviata', 'accettata', 'scartata', 'errore', 'dati_mancanti', 'da_controllare'
);
create type public.tipo_soggetto as enum ('azienda', 'persona', 'pa');

create or replace function public.tocca_aggiornato()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- Dati di fatturazione dei clienti ----------
-- I controlli formali completi (cifra di controllo P.IVA e codice fiscale) sono nel codice
-- (_shared/validazione.ts); qui solo i vincoli di forma, per non salvare dati palesemente errati.
create table public.billing_profiles (
  id uuid primary key default gen_random_uuid(),
  stripe_customer_id text not null unique check (stripe_customer_id ~ '^cus_'),
  tipo public.tipo_soggetto not null default 'azienda',
  ragione_sociale text,
  partita_iva text check (partita_iva is null or partita_iva ~ '^[0-9A-Z]{8,15}$'),
  codice_fiscale text check (codice_fiscale is null or codice_fiscale ~ '^([A-Z0-9]{16}|[0-9]{11})$'),
  via text,
  cap text,
  comune text,
  provincia text check (provincia is null or provincia ~ '^[A-Z]{2}$'),
  nazione text not null default 'IT' check (nazione ~ '^[A-Z]{2}$'),
  codice_destinatario text check (codice_destinatario is null or codice_destinatario ~ '^[A-Z0-9]{6,7}$'),
  pec text check (pec is null or pec ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  email_amministrativa text check (email_amministrativa is null or email_amministrativa ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  fic_client_id bigint,
  sincronizzato_stripe_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger billing_profiles_aggiornato before update on public.billing_profiles
for each row execute function public.tocca_aggiornato();

-- ---------- Configurazione fiscale (una sola riga) ----------
-- Tutti i valori sono null finché l'amministratore non li compila dal pannello:
-- l'agente non emette nulla con una configurazione incompleta.
create table public.fiscal_settings (
  id smallint primary key default 1 check (id = 1),
  -- Emittente
  emittente_ragione_sociale text,
  emittente_partita_iva text,
  emittente_codice_fiscale text,
  emittente_indirizzo text,
  emittente_cap text,
  emittente_comune text,
  emittente_provincia text,
  emittente_iban text,
  -- Regime e IVA
  regime_fiscale text check (regime_fiscale is null or regime_fiscale ~ '^RF[0-9]{2}$'),
  -- Aliquota IVA in % (es. 22) OPPURE natura dell'operazione (es. N2.2) con aliquota 0
  aliquota_iva numeric(5, 2) check (aliquota_iva is null or aliquota_iva between 0 and 100),
  natura_iva text check (natura_iva is null or natura_iva ~ '^N[1-7](\.[0-9])?$'),
  -- Id del tipo IVA su Fatture in Cloud (/c/{company_id}/info/vat_types) che corrisponde ad aliquota/natura
  fic_vat_id bigint,
  dicitura text,
  -- true se i prezzi su Stripe sono IVA inclusa (gli importi Stripe diventano prezzi lordi)
  prezzi_stripe_ivati boolean,
  -- Marca da bollo
  bollo_applicato boolean,
  bollo_importo numeric(10, 2) check (bollo_importo is null or bollo_importo >= 0),
  bollo_soglia numeric(10, 2) check (bollo_soglia is null or bollo_soglia >= 0),
  bollo_addebitato_cliente boolean,
  -- Cassa previdenziale (facoltativa)
  cassa_tipo text check (cassa_tipo is null or cassa_tipo ~ '^TC[0-9]{2}$'),
  cassa_aliquota numeric(5, 2) check (cassa_aliquota is null or cassa_aliquota between 0 and 100),
  -- Fatture in Cloud
  fic_numerazione text,
  fic_numerazione_note_credito text,
  fic_payment_account_id bigint,
  -- Codici FatturaPA della modalità di pagamento per metodo Stripe (es. carta, SEPA)
  codice_pagamento_carta text check (codice_pagamento_carta is null or codice_pagamento_carta ~ '^MP[0-9]{2}$'),
  codice_pagamento_sepa text check (codice_pagamento_sepa is null or codice_pagamento_sepa ~ '^MP[0-9]{2}$'),
  codice_pagamento_altro text check (codice_pagamento_altro is null or codice_pagamento_altro ~ '^MP[0-9]{2}$'),
  updated_at timestamptz not null default now(),
  check (aliquota_iva is null or natura_iva is null or aliquota_iva = 0)
);
insert into public.fiscal_settings (id) values (1);
create trigger fiscal_settings_aggiornato before update on public.fiscal_settings
for each row execute function public.tocca_aggiornato();

-- ---------- Eventi Stripe (idempotenza) ----------
create table public.stripe_events (
  id text primary key check (id ~ '^evt_'),
  tipo text not null,
  livemode boolean not null,
  oggetto_id text,
  ricevuto_at timestamptz not null default now(),
  elaborato_at timestamptz,
  esito text
);

-- Registra un evento: true se è nuovo, false se era già stato ricevuto (va ignorato).
create or replace function public.registra_evento_stripe(p_id text, p_tipo text, p_livemode boolean, p_oggetto text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.stripe_events (id, tipo, livemode, oggetto_id) values (p_id, p_tipo, p_livemode, p_oggetto);
  return true;
exception when unique_violation then
  return false;
end $$;
revoke execute on function public.registra_evento_stripe(text, text, boolean, text) from public, anon, authenticated;

-- ---------- Documenti emessi ----------
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  tipo public.tipo_documento_fiscale not null,
  stripe_invoice_id text not null,
  stripe_customer_id text not null,
  stripe_refund_id text unique,
  fattura_originale_id uuid references public.invoices (id),
  fic_document_id bigint not null unique,
  numero text,
  data date,
  imponibile numeric(12, 2),
  iva numeric(12, 2),
  totale numeric(12, 2),
  -- ei_status di Fatture in Cloud (sent, accepted, rejected, discarded, …)
  stato_sdi text,
  sdi_motivo text,
  sdi_soluzione text,
  sdi_codice text,
  pdf_url text,
  dry_run boolean not null default true,
  inviata_at timestamptz,
  esito_at timestamptz,
  email_cliente_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index invoices_una_fattura_per_stripe on public.invoices (stripe_invoice_id) where tipo = 'fattura';
create index invoices_data_idx on public.invoices (data desc);
create index invoices_cliente_idx on public.invoices (stripe_customer_id);
create trigger invoices_aggiornato before update on public.invoices
for each row execute function public.tocca_aggiornato();

-- ---------- Coda ----------
create table public.invoice_jobs (
  id uuid primary key default gen_random_uuid(),
  tipo public.tipo_documento_fiscale not null,
  stripe_invoice_id text not null,
  stripe_customer_id text,
  stripe_charge_id text,
  stripe_refund_id text,
  importo_rimborso_cents bigint check (importo_rimborso_cents is null or importo_rimborso_cents > 0),
  stripe_event_id text references public.stripe_events (id),
  stato public.stato_job_fattura not null default 'in_coda',
  tentativi integer not null default 0,
  max_tentativi integer not null default 5,
  prossimo_tentativo_at timestamptz not null default now(),
  iniziato_at timestamptz,
  ultimo_errore text,
  -- campi mancanti, errori XML, motivo scarto… (mai dati personali completi)
  dettaglio jsonb,
  invoice_id uuid references public.invoices (id),
  fic_document_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (tipo = 'fattura' or stripe_refund_id is not null)
);
-- Un pagamento non genera mai due fatture; un rimborso non genera mai due note di credito
create unique index invoice_jobs_una_fattura on public.invoice_jobs (stripe_invoice_id) where tipo = 'fattura';
create unique index invoice_jobs_una_nota_per_rimborso on public.invoice_jobs (stripe_refund_id) where tipo = 'nota_credito';
create index invoice_jobs_coda_idx on public.invoice_jobs (stato, prossimo_tentativo_at);
create trigger invoice_jobs_aggiornato before update on public.invoice_jobs
for each row execute function public.tocca_aggiornato();

-- Prende fino a p_limite job pronti e li segna "in_lavorazione" (lock: due agenti non prendono lo stesso job).
-- I job rimasti "in_lavorazione" da più di 10 minuti (agente interrotto) tornano in coda.
create or replace function public.prendi_job_fatturazione(p_limite integer default 10)
returns setof public.invoice_jobs
language plpgsql security definer set search_path = ''
as $$
begin
  update public.invoice_jobs set stato = 'in_coda'
  where stato = 'in_lavorazione' and iniziato_at < now() - interval '10 minutes';

  return query
  update public.invoice_jobs j set stato = 'in_lavorazione', iniziato_at = now(), tentativi = j.tentativi + 1
  where j.id in (
    select x.id from public.invoice_jobs x
    where x.stato = 'in_coda' and x.prossimo_tentativo_at <= now()
    order by x.prossimo_tentativo_at
    limit p_limite
    for update skip locked
  )
  returning j.*;
end $$;
revoke execute on function public.prendi_job_fatturazione(integer) from public, anon, authenticated;

-- Errore temporaneo: riprova con backoff esponenziale (2, 4, 8, 16 minuti…).
-- Dopo max_tentativi il job va in "errore" e nasce un avviso. Restituisce lo stato finale.
create or replace function public.riprova_job_fatturazione(p_job uuid, p_errore text)
returns public.stato_job_fattura
language plpgsql security definer set search_path = ''
as $$
declare
  j public.invoice_jobs;
begin
  select * into j from public.invoice_jobs where id = p_job for update;
  if j.id is null then return null; end if;
  if j.tentativi < j.max_tentativi then
    update public.invoice_jobs set stato = 'in_coda', ultimo_errore = p_errore,
      prossimo_tentativo_at = now() + interval '2 minutes' * power(2, greatest(j.tentativi - 1, 0))
    where id = p_job;
    return 'in_coda';
  end if;
  update public.invoice_jobs set stato = 'errore', ultimo_errore = p_errore where id = p_job;
  insert into public.avvisi (tipo, titolo, testo, job_id)
  values ('errore_dopo_tentativi',
          case when j.tipo = 'fattura' then 'Fattura non emessa dopo ' else 'Nota di credito non emessa dopo ' end
            || j.tentativi || ' tentativi',
          'Pagamento Stripe ' || j.stripe_invoice_id || ': ' || p_errore, p_job);
  return 'errore';
end $$;
revoke execute on function public.riprova_job_fatturazione(uuid, text) from public, anon, authenticated;

-- ---------- Subscription webhook Fatture in Cloud ----------
create table public.fic_subscriptions (
  id text primary key,
  sink text not null,
  tipi text[] not null,
  verificata boolean not null default false,
  created_at timestamptz not null default now(),
  verificata_at timestamptz
);

-- ---------- Avvisi e log ----------
create table public.avvisi (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in (
    'dati_mancanti', 'xml_non_valido', 'scarto_sdi', 'errore_dopo_tentativi', 'esito_in_ritardo',
    'configurazione', 'importi_non_coerenti', 'riepilogo_settimanale'
  )),
  titolo text not null,
  testo text not null,
  job_id uuid references public.invoice_jobs (id) on delete set null,
  invoice_id uuid references public.invoices (id) on delete set null,
  email_inviata_at timestamptz,
  risolto_at timestamptz,
  created_at timestamptz not null default now()
);
create index avvisi_aperti_idx on public.avvisi (created_at desc) where risolto_at is null;

create table public.operation_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  livello text not null default 'info' check (livello in ('info', 'avviso', 'errore')),
  operazione text not null,
  -- id Stripe / job / documento: permettono di ricostruire la storia di un pagamento
  riferimento text,
  messaggio text not null,
  -- solo dati mascherati (es. P.IVA IT0123****789)
  dettagli jsonb
);
create index operation_logs_riferimento_idx on public.operation_logs (riferimento, created_at);
create index operation_logs_data_idx on public.operation_logs (created_at desc);

-- ---------- Viste per il pannello ----------
create view public.riepilogo_settimana with (security_invoker = true) as
select
  (select coalesce(sum(totale), 0) from public.invoices where tipo = 'fattura' and created_at > now() - interval '7 days') as incassato,
  (select count(*) from public.invoices where tipo = 'fattura' and created_at > now() - interval '7 days') as fatture,
  (select count(*) from public.invoices where tipo = 'nota_credito' and created_at > now() - interval '7 days') as note_credito,
  (select count(*) from public.invoices where stato_sdi in ('rejected', 'discarded') and updated_at > now() - interval '7 days') as scarti,
  (select count(*) from public.invoice_jobs where stato in ('errore', 'dati_mancanti', 'da_controllare')) as job_da_gestire;

-- ---------- RLS ----------
alter table public.app_admins enable row level security;
alter table public.billing_profiles enable row level security;
alter table public.fiscal_settings enable row level security;
alter table public.stripe_events enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_jobs enable row level security;
alter table public.fic_subscriptions enable row level security;
alter table public.avvisi enable row level security;
alter table public.operation_logs enable row level security;

create policy "admin: lettura" on public.app_admins for select to authenticated using ((select public.is_admin()));
-- Dati modificabili dal pannello
create policy "admin: profili" on public.billing_profiles for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin: lettura configurazione" on public.fiscal_settings for select to authenticated using ((select public.is_admin()));
create policy "admin: modifica configurazione" on public.fiscal_settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin: avvisi" on public.avvisi for select to authenticated using ((select public.is_admin()));
create policy "admin: risolvi avvisi" on public.avvisi for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
-- Sola lettura (scrivono solo le Edge Function)
create policy "admin: eventi" on public.stripe_events for select to authenticated using ((select public.is_admin()));
create policy "admin: documenti" on public.invoices for select to authenticated using ((select public.is_admin()));
create policy "admin: coda" on public.invoice_jobs for select to authenticated using ((select public.is_admin()));
create policy "admin: subscription" on public.fic_subscriptions for select to authenticated using ((select public.is_admin()));
create policy "admin: log" on public.operation_logs for select to authenticated using ((select public.is_admin()));

-- ---------- Pianificazione (pg_cron + pg_net) ----------
-- La URL delle funzioni e il segreto condiviso stanno in Vault (vedi README):
--   select vault.create_secret('https://<progetto>.supabase.co/functions/v1', 'fatturazione_functions_url');
--   select vault.create_secret('<stringa casuale lunga>', 'fatturazione_cron_secret');
create or replace function public.chiama_agente_fatturazione(p_azione text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  url text;
  segreto text;
begin
  if p_azione = 'coda' and not exists (
    select 1 from public.invoice_jobs where stato = 'in_coda' and prossimo_tentativo_at <= now()
  ) then
    return;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = ''fatturazione_functions_url''' into url;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = ''fatturazione_cron_secret''' into segreto;
  if url is null or segreto is null then
    raise notice 'Configura in Vault fatturazione_functions_url e fatturazione_cron_secret';
    return;
  end if;
  execute 'select net.http_post(url := $1, headers := $2, body := $3, timeout_milliseconds := 120000)'
    using url || '/invoice-agent',
          jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', segreto),
          jsonb_build_object('azione', p_azione);
end $$;
revoke execute on function public.chiama_agente_fatturazione(text) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- coda ogni 2 minuti
    perform cron.schedule('fatturazione-coda', '*/2 * * * *', 'select public.chiama_agente_fatturazione(''coda'')');
    -- controllo esiti SDI in ritardo: ogni giorno alle 07:15 UTC
    perform cron.schedule('fatturazione-esiti', '15 7 * * *', 'select public.chiama_agente_fatturazione(''controllo_esiti'')');
    -- riepilogo del lunedì alle 06:45 UTC
    perform cron.schedule('fatturazione-riepilogo', '45 6 * * 1', 'select public.chiama_agente_fatturazione(''riepilogo_settimanale'')');
  else
    raise notice 'pg_cron non disponibile: abilita pg_cron e pg_net e riesegui la pianificazione (README)';
  end if;
end $$;
