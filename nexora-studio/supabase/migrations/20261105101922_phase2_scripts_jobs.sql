-- ═══════════════════════════════════════════════════════════════════════════
-- Nexora Studio — Fase 2: script settimanali, coda di lavoro, costi dei provider
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- script_batches: gli script di una settimana per un'azienda
-- ───────────────────────────────────────────────────────────────────────────
create table public.script_batches (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null references public.workspaces (id) on delete cascade,
  week_start           date not null check (extract(isodow from week_start) = 1),  -- sempre un lunedì
  status               text not null default 'draft' check (status in ('draft', 'sent', 'done')),
  regenerations_used   smallint not null default 0 check (regenerations_used between 0 and 3),
  notified_at          timestamptz,     -- email del lunedì inviata
  created_at           timestamptz not null default now(),
  unique (workspace_id, week_start)
);

create index script_batches_workspace_week_idx on public.script_batches (workspace_id, week_start desc);

-- ───────────────────────────────────────────────────────────────────────────
-- scripts
-- ───────────────────────────────────────────────────────────────────────────
create table public.scripts (
  id              uuid primary key default gen_random_uuid(),
  batch_id        uuid not null references public.script_batches (id) on delete cascade,
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,
  position        smallint not null default 0,
  title           text not null,
  hook            text not null,
  body            text not null,
  call_to_action  text,
  -- { location, framing, light, duration_seconds, tips[] }
  shooting_notes  jsonb not null default '{}'::jsonb,
  format          text not null check (format in (
                    'talking_head', 'tutorial', 'behind_the_scenes', 'product', 'testimonial')),
  topic_tags      text[] not null default '{}',   -- per l'anti-ripetizione tra settimane
  status          text not null default 'to_shoot' check (status in ('to_shoot', 'uploaded', 'skipped')),
  regenerated     smallint not null default 0,    -- quante volte è stato riscritto
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index scripts_batch_idx on public.scripts (batch_id, position);
create index scripts_workspace_idx on public.scripts (workspace_id, created_at desc);

create trigger scripts_updated_at
  before update on public.scripts
  for each row execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- jobs: coda di lavoro su Postgres, consumata dal worker
-- ───────────────────────────────────────────────────────────────────────────
create table public.jobs (
  id            uuid primary key default gen_random_uuid(),
  type          text not null check (type in (
                  'generate_scripts', 'send_email', 'transcribe', 'edit', 'render', 'publish')),
  workspace_id  uuid references public.workspaces (id) on delete cascade,
  payload       jsonb not null default '{}'::jsonb,
  status        text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  attempts      smallint not null default 0,
  max_attempts  smallint not null default 3,
  last_error    text,
  run_after     timestamptz not null default now(),
  locked_by     text,
  locked_at     timestamptz,
  -- Idempotenza: un solo job per chiave (es. "generate_scripts:<ws>:2026-11-09")
  dedupe_key    text unique,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  finished_at   timestamptz
);

create index jobs_ready_idx on public.jobs (run_after) where status = 'queued';
create index jobs_workspace_idx on public.jobs (workspace_id, created_at desc);

create trigger jobs_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- provider_costs: ogni chiamata a un fornitore esterno (LLM, trascrizione, render, b-roll)
-- Base per il "costo per video" e le metriche admin.
-- ───────────────────────────────────────────────────────────────────────────
create table public.provider_costs (
  id            bigint generated always as identity primary key,
  workspace_id  uuid references public.workspaces (id) on delete set null,
  job_id        uuid references public.jobs (id) on delete set null,
  video_id      uuid,            -- FK aggiunta in Fase 3 con la tabella videos
  operation     text not null,   -- generate_scripts, regenerate_script, transcribe, ...
  provider      text not null,
  model         text,
  cost_usd      numeric(12, 6) not null default 0,
  units         jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index provider_costs_workspace_idx on public.provider_costs (workspace_id, created_at desc);

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.script_batches enable row level security;
alter table public.scripts        enable row level security;
alter table public.jobs           enable row level security;
alter table public.provider_costs enable row level security;

create policy "batches: lettura membri o admin"
  on public.script_batches for select to authenticated
  using (public.is_workspace_member(workspace_id) or public.is_admin());

create policy "scripts: lettura membri o admin"
  on public.scripts for select to authenticated
  using (public.is_workspace_member(workspace_id) or public.is_admin());

-- I membri cambiano solo lo stato (girato / saltato). Testo e rigenerazioni passano dal server.
create policy "scripts: stato modificabile dai membri"
  on public.scripts for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

revoke update on public.scripts from authenticated;
grant update (status) on public.scripts to authenticated;

-- Coda e costi: solo team Nexora (lettura). Scrive il service role (worker e server).
create policy "jobs: lettura admin"
  on public.jobs for select to authenticated
  using (public.is_admin());

create policy "costs: lettura admin"
  on public.provider_costs for select to authenticated
  using (public.is_admin());

-- ═══════════════════════════════════════════════════════════════════════════
-- Funzioni della coda (chiamate dal worker con il service role)
-- ═══════════════════════════════════════════════════════════════════════════

-- Accoda un job; con dedupe_key già presente non fa nulla e restituisce il job esistente.
create or replace function public.enqueue_job(
  p_type text,
  p_workspace_id uuid,
  p_payload jsonb default '{}'::jsonb,
  p_dedupe_key text default null,
  p_run_after timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_id uuid;
begin
  insert into public.jobs (type, workspace_id, payload, dedupe_key, run_after)
  values (p_type, p_workspace_id, p_payload, p_dedupe_key, p_run_after)
  on conflict (dedupe_key) do nothing
  returning id into job_id;

  if job_id is null then
    select id into job_id from public.jobs where dedupe_key = p_dedupe_key;
  end if;
  return job_id;
end;
$$;

-- Prende il prossimo job pronto senza conflitti tra worker (FOR UPDATE SKIP LOCKED).
-- Recupera anche i job "running" rimasti bloccati da un worker morto (lock più vecchio di 15 min).
create or replace function public.claim_job(p_worker text, p_types text[] default null)
returns setof public.jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.jobs j
  set status = 'running',
      attempts = j.attempts + 1,
      locked_by = p_worker,
      locked_at = now()
  where j.id = (
    select id from public.jobs
    where (
        (status = 'queued' and run_after <= now())
        or (status = 'running' and locked_at < now() - interval '15 minutes')
      )
      and (p_types is null or type = any (p_types))
    order by run_after
    for update skip locked
    limit 1
  )
  returning j.*;
end;
$$;

create or replace function public.complete_job(p_job_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.jobs
  set status = 'done', finished_at = now(), locked_by = null, locked_at = null, last_error = null
  where id = p_job_id;
$$;

-- Errore: ritenta con backoff esponenziale (1, 4, 16 minuti) fino a max_attempts, poi 'failed'.
create or replace function public.fail_job(p_job_id uuid, p_error text, p_retryable boolean default true)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  j public.jobs;
begin
  select * into j from public.jobs where id = p_job_id for update;
  if not found then return null; end if;

  if p_retryable and j.attempts < j.max_attempts then
    update public.jobs
    set status = 'queued',
        last_error = left(p_error, 2000),
        locked_by = null,
        locked_at = null,
        run_after = now() + (power(4, j.attempts - 1) * interval '1 minute')
    where id = p_job_id;
    return 'queued';
  end if;

  update public.jobs
  set status = 'failed', last_error = left(p_error, 2000), finished_at = now(),
      locked_by = null, locked_at = null
  where id = p_job_id;
  return 'failed';
end;
$$;

-- Solo il service role usa la coda.
revoke execute on function public.enqueue_job(text, uuid, jsonb, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.claim_job(text, text[]) from public, anon, authenticated;
revoke execute on function public.complete_job(uuid) from public, anon, authenticated;
revoke execute on function public.fail_job(uuid, text, boolean) from public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rigenerazione: massimo 3 a settimana per azienda (contatore atomico)
-- Chiamate solo dal server (service role) dopo aver verificato che l'utente è membro:
-- così nessuno può azzerarsi il contatore chiamando l'API direttamente.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.use_script_regeneration(p_script_id uuid)
returns smallint   -- rigenerazioni rimaste
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.script_batches;
begin
  select sb.* into b
  from public.scripts s
  join public.script_batches sb on sb.id = s.batch_id
  where s.id = p_script_id
  for update of sb;

  if not found then
    raise exception 'Script non trovato.' using errcode = 'P0002';
  end if;
  if b.regenerations_used >= 3 then
    raise exception 'Hai già usato le 3 rigenerazioni di questa settimana.' using errcode = 'P0001';
  end if;

  update public.script_batches set regenerations_used = regenerations_used + 1 where id = b.id;
  return 3 - (b.regenerations_used + 1);
end;
$$;

-- Restituisce una rigenerazione se la chiamata all'AI è fallita.
create or replace function public.refund_script_regeneration(p_script_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.script_batches sb
  set regenerations_used = greatest(0, sb.regenerations_used - 1)
  from public.scripts s
  where s.id = p_script_id and sb.id = s.batch_id;
$$;

revoke execute on function public.use_script_regeneration(uuid) from public, anon, authenticated;
revoke execute on function public.refund_script_regeneration(uuid) from public, anon, authenticated;
