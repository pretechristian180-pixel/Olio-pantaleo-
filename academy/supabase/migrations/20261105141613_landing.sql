-- Landing di vendita generate con l'IA.
-- Una landing per corso (per ora). Le sezioni sono JSON validato dall'app; lo staff dell'academy
-- le modifica, chiunque legge quelle pubblicate.

create table public.landing_pages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  course_id uuid not null unique references public.courses (id) on delete cascade,
  stato public.course_status not null default 'draft',
  brief jsonb not null default '{}'::jsonb,
  sezioni jsonb not null default '[]'::jsonb check (jsonb_typeof(sezioni) = 'array'),
  generata_il timestamptz,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);
create index landing_pages_tenant_idx on public.landing_pages (tenant_id);
create trigger landing_pages_aggiornato_il before update on public.landing_pages
  for each row execute function private.set_aggiornato_il();
create trigger landing_pages_set_tenant before insert or update of course_id on public.landing_pages
  for each row execute function private.set_tenant_from_course();

-- Ogni chiamata all'IA, per i limiti dei piani e per sapere quanto costa.
create table public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  tipo text not null check (tipo in ('landing', 'sezione')),
  modello text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  creato_il timestamptz not null default now()
);
create index ai_generations_tenant_mese_idx on public.ai_generations (tenant_id, tipo, creato_il desc);

alter table public.platform_plans
  add column max_landing_ai_mese integer check (max_landing_ai_mese >= 0),
  add column max_sezioni_ai_mese integer check (max_sezioni_ai_mese >= 0);
update public.platform_plans set max_landing_ai_mese = 5, max_sezioni_ai_mese = 50 where codice = 'start';
update public.platform_plans set max_landing_ai_mese = 30, max_sezioni_ai_mese = null where codice = 'pro';
update public.platform_plans set max_landing_ai_mese = 100, max_sezioni_ai_mese = null where codice = 'business';

alter table public.landing_pages enable row level security;
alter table public.ai_generations enable row level security;
revoke all on public.ai_generations from anon, authenticated;
grant select on public.ai_generations to authenticated;
revoke all on public.landing_pages from anon;
grant select on public.landing_pages to anon;

create policy landing_pages_select on public.landing_pages
  for select to anon, authenticated
  using (stato = 'published' or private.is_staff(tenant_id));
create policy landing_pages_staff_write on public.landing_pages
  for all to authenticated
  using (private.is_staff(tenant_id))
  with check (private.is_staff(tenant_id));

-- Lo staff vede quante generazioni ha usato; le scrive solo il server.
create policy ai_generations_select on public.ai_generations
  for select to authenticated using (private.is_staff(tenant_id));
