-- Richieste di demo dalla landing page di Mattonio.
-- Chiunque (anche senza account) può inviare il form; nessuno può leggere o modificare
-- le richieste dall'app: si consultano dal pannello Supabase (Table Editor).
create table public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 2 and 120),
  agenzia text not null check (length(trim(agenzia)) between 2 and 160),
  citta text not null check (length(trim(citta)) between 2 and 120),
  telefono text not null check (telefono ~ '^[0-9 +().-]{6,25}$'),
  numero_agenti text not null check (numero_agenti in ('1', '2-3', '4-5', '6-10', 'più di 10')),
  created_at timestamptz not null default now()
);

create index on public.demo_requests (created_at desc);

alter table public.demo_requests enable row level security;

-- Solo inserimento: niente lettura, modifica o cancellazione dall'esterno
revoke all on public.demo_requests from anon, authenticated;
grant insert (nome, agenzia, citta, telefono, numero_agenti) on public.demo_requests to anon, authenticated;

create policy "demo: invio dal form" on public.demo_requests
  for insert to anon, authenticated
  with check (created_at > now() - interval '1 minute');
