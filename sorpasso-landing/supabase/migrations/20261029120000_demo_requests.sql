-- Richieste di demo dalla landing di Sorpasso AI.
-- Il pubblico (anon) può SOLO inserire: nessuna lettura, modifica o cancellazione dal sito.
-- Le richieste si consultano dal pannello Supabase o con la chiave di servizio.

create table public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 2 and 80),
  concessionaria text not null check (length(trim(concessionaria)) between 2 and 120),
  citta text not null check (length(trim(citta)) between 2 and 80),
  telefono text not null check (telefono ~ '^\+?[0-9 ./-]{8,20}$'),
  venditori integer not null check (venditori between 1 and 500),
  lead_mese text not null check (lead_mese in ('Meno di 50', '50–150', '150–400', 'Più di 400')),
  consenso_privacy boolean not null check (consenso_privacy),
  consenso_privacy_at timestamptz not null default now(),
  utm_source text check (length(utm_source) <= 120),
  utm_medium text check (length(utm_medium) <= 120),
  utm_campaign text check (length(utm_campaign) <= 120),
  user_agent text check (length(user_agent) <= 300),
  -- Gestione interna (dal pannello): stato della richiesta
  stato text not null default 'nuova' check (stato in ('nuova', 'contattata', 'demo_fissata', 'demo_fatta', 'scartata')),
  created_at timestamptz not null default now()
);

create index demo_requests_created_idx on public.demo_requests (created_at desc);

alter table public.demo_requests enable row level security;

-- Solo inserimento, e solo con i campi di stato ai valori iniziali
create policy "demo: inserimento dal sito" on public.demo_requests
  for insert to anon, authenticated
  with check (stato = 'nuova' and consenso_privacy);

-- Nessuna policy di select/update/delete: dal sito non si legge nulla.
revoke select, update, delete on public.demo_requests from anon, authenticated;
