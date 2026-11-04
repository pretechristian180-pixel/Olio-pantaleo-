-- Nexora Academy — schema di base
-- Multi-tenant fin dall'inizio: ogni dato "di proprietà" ricava il tenant dal corso
-- tramite trigger, così non può essere falsificato dal client.

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Tipi
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('student', 'instructor', 'admin');
create type public.course_status as enum ('draft', 'published');
create type public.enrollment_source as enum ('stripe', 'manuale', 'azienda', 'abbonamento');
create type public.order_status as enum ('in_attesa', 'pagato', 'rimborsato', 'fallito');
create type public.question_status as enum ('aperta', 'risposta', 'chiusa');

-- ---------------------------------------------------------------------------
-- Funzioni di servizio
-- ---------------------------------------------------------------------------
create or replace function private.set_aggiornato_il()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.aggiornato_il := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tenant
-- ---------------------------------------------------------------------------
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  brand jsonb not null default '{}'::jsonb,
  creato_il timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profili (1:1 con auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  nome text not null default '' check (char_length(nome) <= 80),
  cognome text not null default '' check (char_length(cognome) <= 80),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 500),
  ruolo public.user_role not null default 'student',
  consenso_marketing boolean not null default false,
  consenso_marketing_il timestamptz,
  ultimo_accesso_il timestamptz,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);
create index profiles_tenant_ruolo_idx on public.profiles (tenant_id, ruolo);
create trigger profiles_aggiornato_il before update on public.profiles
  for each row execute function private.set_aggiornato_il();

-- Crea il profilo alla registrazione. Il ruolo è sempre "student":
-- la promozione a instructor/admin avviene solo lato server.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_consenso boolean := coalesce((new.raw_user_meta_data ->> 'consenso_marketing')::boolean, false);
begin
  select t.id into v_tenant
  from public.tenants t
  where t.slug = coalesce(new.raw_user_meta_data ->> 'tenant', 'nexora');

  if v_tenant is null then
    select t.id into v_tenant from public.tenants t order by t.creato_il limit 1;
  end if;

  if v_tenant is null then
    raise exception 'Nessun tenant configurato';
  end if;

  insert into public.profiles (id, tenant_id, nome, cognome, consenso_marketing, consenso_marketing_il)
  values (
    new.id,
    v_tenant,
    left(coalesce(new.raw_user_meta_data ->> 'nome', ''), 80),
    left(coalesce(new.raw_user_meta_data ->> 'cognome', ''), 80),
    v_consenso,
    case when v_consenso then now() end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Docenti (scheda pubblica, separata dal profilo privato)
-- ---------------------------------------------------------------------------
create table public.instructors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  profile_id uuid unique references public.profiles (id) on delete set null,
  nome text not null check (char_length(nome) between 1 and 120),
  qualifica text check (char_length(qualifica) <= 160),
  bio text check (char_length(bio) <= 4000),
  foto_path text,
  creato_il timestamptz not null default now()
);
create index instructors_tenant_idx on public.instructors (tenant_id);

-- ---------------------------------------------------------------------------
-- Corsi, moduli, lezioni, materiali
-- ---------------------------------------------------------------------------
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  titolo text not null check (char_length(titolo) between 1 and 160),
  sottotitolo text check (char_length(sottotitolo) <= 300),
  descrizione text check (char_length(descrizione) <= 20000),
  -- Sopratitolo della pagina corso, es. "Organizzazione aziendale".
  categoria text check (char_length(categoria) <= 60),
  -- "Cosa porti a casa": [{"titolo": "...", "testo": "..."}]
  risultati jsonb not null default '[]'::jsonb check (jsonb_typeof(risultati) = 'array'),
  copertina_path text,
  trailer_video_id text,
  prezzo_cents integer not null default 0 check (prezzo_cents >= 0),
  valuta char(3) not null default 'EUR' check (valuta = upper(valuta)),
  stato public.course_status not null default 'draft',
  stripe_price_id text,
  docente_id uuid references public.instructors (id) on delete set null,
  ordine integer not null default 0,
  pubblicato_il timestamptz,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now(),
  unique (tenant_id, slug)
);
create index courses_tenant_stato_idx on public.courses (tenant_id, stato, ordine);
create trigger courses_aggiornato_il before update on public.courses
  for each row execute function private.set_aggiornato_il();

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  titolo text not null check (char_length(titolo) between 1 and 160),
  ordine integer not null default 0,
  creato_il timestamptz not null default now()
);
create index modules_course_ordine_idx on public.modules (course_id, ordine);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  -- Copiato dal modulo tramite trigger: semplifica URL, RLS e statistiche.
  course_id uuid not null references public.courses (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  titolo text not null check (char_length(titolo) between 1 and 160),
  descrizione text check (char_length(descrizione) <= 20000),
  bunny_video_id text,
  durata_sec integer not null default 0 check (durata_sec >= 0),
  is_free_preview boolean not null default false,
  ordine integer not null default 0,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now(),
  unique (course_id, slug)
);
create index lessons_module_ordine_idx on public.lessons (module_id, ordine);
create index lessons_course_idx on public.lessons (course_id);
create trigger lessons_aggiornato_il before update on public.lessons
  for each row execute function private.set_aggiornato_il();

create or replace function private.lessons_set_course()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select m.course_id into new.course_id from public.modules m where m.id = new.module_id;
  return new;
end;
$$;
create trigger lessons_set_course before insert or update of module_id, course_id on public.lessons
  for each row execute function private.lessons_set_course();

create table public.lesson_resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 200),
  tipo text not null default 'file' check (char_length(tipo) <= 100),
  storage_path text not null unique,
  dimensione_bytes bigint not null default 0 check (dimensione_bytes >= 0),
  ordine integer not null default 0,
  creato_il timestamptz not null default now()
);
create index lesson_resources_lesson_idx on public.lesson_resources (lesson_id, ordine);

-- ---------------------------------------------------------------------------
-- Vendite, abbonamenti, iscrizioni
-- ---------------------------------------------------------------------------
create or replace function private.set_tenant_from_course()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.course_id is not null then
    select c.tenant_id into new.tenant_id from public.courses c where c.id = new.course_id;
  end if;
  return new;
end;
$$;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  -- Gli ordini restano per obblighi fiscali anche se l'utente cancella l'account.
  user_id uuid references public.profiles (id) on delete set null,
  course_id uuid references public.courses (id) on delete set null,
  email text,
  importo_cents integer not null check (importo_cents >= 0),
  valuta char(3) not null default 'EUR',
  stato public.order_status not null default 'in_attesa',
  stripe_session_id text unique,
  stripe_payment_intent_id text,
  creato_il timestamptz not null default now(),
  pagato_il timestamptz
);
create index orders_tenant_creato_idx on public.orders (tenant_id, creato_il desc);
create index orders_user_idx on public.orders (user_id);
create trigger orders_set_tenant before insert or update of course_id on public.orders
  for each row execute function private.set_tenant_from_course();

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 120),
  stripe_price_id text unique,
  intervallo text not null check (intervallo in ('month', 'year')),
  prezzo_cents integer not null check (prezzo_cents >= 0),
  valuta char(3) not null default 'EUR',
  attivo boolean not null default false,
  creato_il timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_id uuid not null references public.plans (id) on delete restrict,
  stripe_subscription_id text unique,
  stato text not null check (stato in ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'unpaid')),
  periodo_fine timestamptz,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);
create index subscriptions_user_idx on public.subscriptions (user_id);
create trigger subscriptions_aggiornato_il before update on public.subscriptions
  for each row execute function private.set_aggiornato_il();

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  fonte public.enrollment_source not null,
  stripe_session_id text unique,
  order_id uuid references public.orders (id) on delete set null,
  creato_il timestamptz not null default now(),
  scade_il timestamptz,
  unique (user_id, course_id)
);
create index enrollments_course_idx on public.enrollments (course_id);
create index enrollments_tenant_creato_idx on public.enrollments (tenant_id, creato_il desc);
create trigger enrollments_set_tenant before insert or update of course_id on public.enrollments
  for each row execute function private.set_tenant_from_course();

-- Idempotenza del webhook Stripe: un evento si elabora una sola volta.
create table public.stripe_events (
  id text primary key,
  tipo text not null,
  ricevuto_il timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Studio: avanzamento, note, domande, attestati
-- ---------------------------------------------------------------------------
create table public.lesson_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  ultimo_secondo integer not null default 0 check (ultimo_secondo >= 0),
  secondi_visti integer not null default 0 check (secondi_visti >= 0),
  completata boolean not null default false,
  completata_il timestamptz,
  aggiornato_il timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index lesson_progress_lesson_idx on public.lesson_progress (lesson_id);
create index lesson_progress_user_aggiornato_idx on public.lesson_progress (user_id, aggiornato_il desc);
create trigger lesson_progress_aggiornato_il before update on public.lesson_progress
  for each row execute function private.set_aggiornato_il();

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  secondo integer not null default 0 check (secondo >= 0),
  testo text not null check (char_length(testo) between 1 and 5000),
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);
create index notes_user_lesson_idx on public.notes (user_id, lesson_id, secondo);
create trigger notes_aggiornato_il before update on public.notes
  for each row execute function private.set_aggiornato_il();

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  testo text not null check (char_length(testo) between 1 and 4000),
  stato public.question_status not null default 'aperta',
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);
create index questions_lesson_idx on public.questions (lesson_id, creato_il);
create index questions_tenant_stato_idx on public.questions (tenant_id, stato, creato_il);
create trigger questions_aggiornato_il before update on public.questions
  for each row execute function private.set_aggiornato_il();

create or replace function private.questions_set_context()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select l.course_id, c.tenant_id into new.course_id, new.tenant_id
  from public.lessons l
  join public.courses c on c.id = l.course_id
  where l.id = new.lesson_id;
  return new;
end;
$$;
create trigger questions_set_context before insert or update of lesson_id, course_id, tenant_id
  on public.questions
  for each row execute function private.questions_set_context();

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  testo text not null check (char_length(testo) between 1 and 6000),
  -- Calcolato dal ruolo dell'autore: non impostabile dal client.
  is_docente boolean not null default false,
  creato_il timestamptz not null default now()
);
create index answers_question_idx on public.answers (question_id, creato_il);

create or replace function private.answers_set_docente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select p.ruolo in ('instructor', 'admin') into new.is_docente
  from public.profiles p
  where p.id = new.user_id;
  new.is_docente := coalesce(new.is_docente, false);
  return new;
end;
$$;
create trigger answers_set_docente before insert or update of user_id, is_docente on public.answers
  for each row execute function private.answers_set_docente();

create or replace function private.answers_mark_question()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_docente then
    update public.questions set stato = 'risposta' where id = new.question_id and stato = 'aperta';
  end if;
  return new;
end;
$$;
create trigger answers_mark_question after insert on public.answers
  for each row execute function private.answers_mark_question();

create or replace function private.new_certificate_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'NX-' || upper(
    substr(h, 1, 4) || '-' || substr(h, 5, 4) || '-' || substr(h, 9, 4)
  )
  from (select replace(gen_random_uuid()::text, '-', '') as h) s;
$$;

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  codice text not null unique default private.new_certificate_code(),
  nome_intestatario text not null check (char_length(nome_intestatario) between 1 and 200),
  pdf_path text,
  rilasciato_il timestamptz not null default now(),
  unique (user_id, course_id)
);
