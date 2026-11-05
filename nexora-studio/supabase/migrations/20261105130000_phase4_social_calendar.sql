-- ═══════════════════════════════════════════════════════════════════════════
-- Nexora Studio — Fase 4: social collegati, calendario e pubblicazione (Metricool)
-- ═══════════════════════════════════════════════════════════════════════════

-- Collegamento Metricool per azienda: un "brand" Metricool per workspace (una sola pagina
-- per social, come prevede Metricool). Scritto solo dal team Nexora / service role.
alter table public.workspaces
  add column metricool_blog_id         text unique,
  add column metricool_connect_url     text,         -- link temporaneo (71 h) per collegare i social
  add column metricool_connect_expires timestamptz;

-- ───────────────────────────────────────────────────────────────────────────
-- social_accounts: i profili collegati (letti da Metricool, sincronizzati dal worker)
-- ───────────────────────────────────────────────────────────────────────────
create table public.social_accounts (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null references public.workspaces (id) on delete cascade,
  platform             text not null check (platform in ('instagram', 'facebook', 'tiktok', 'youtube', 'linkedin')),
  handle               text,
  provider_account_id  text,                 -- identificativo presso Metricool
  status               text not null default 'connected' check (status in ('connected', 'expired', 'error', 'disconnected')),
  enabled              boolean not null default true,   -- l'azienda può escludere un social dalla pubblicazione
  connected_at         timestamptz not null default now(),
  last_checked_at      timestamptz,
  unique (workspace_id, platform)
);

-- ───────────────────────────────────────────────────────────────────────────
-- scheduled_posts: un post per video e per social. Tutti i post di un video condividono
-- l'orario (lo sposta il drag & drop del calendario).
-- ───────────────────────────────────────────────────────────────────────────
create table public.scheduled_posts (
  id                 uuid primary key default gen_random_uuid(),
  video_id           uuid not null references public.videos (id) on delete cascade,
  workspace_id       uuid not null references public.workspaces (id) on delete cascade,
  social_account_id  uuid not null references public.social_accounts (id) on delete cascade,
  scheduled_at       timestamptz not null,
  status             text not null default 'scheduled' check (status in (
                       'scheduled',    -- in calendario, modificabile
                       'publishing',   -- consegnato a Metricool (bloccato: non si sposta più)
                       'published',
                       'failed',
                       'canceled')),
  provider_post_id   text,
  permalink          text,
  error              text,
  published_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (video_id, social_account_id)
);

create index scheduled_posts_calendar_idx on public.scheduled_posts (workspace_id, scheduled_at);
create index scheduled_posts_due_idx on public.scheduled_posts (scheduled_at) where status = 'scheduled';

create trigger scheduled_posts_updated_at
  before update on public.scheduled_posts
  for each row execute function public.set_updated_at();

-- Nuovo tipo di job: sincronizzazione dei social collegati da Metricool.
alter table public.jobs drop constraint jobs_type_check;
alter table public.jobs add constraint jobs_type_check check (type in (
  'generate_scripts', 'send_email', 'transcribe', 'edit', 'render', 'publish', 'sync_social'));

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS: lettura membri; scritture dal server (controlla stati, orari e approvazione)
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.social_accounts enable row level security;
alter table public.scheduled_posts enable row level security;

create policy "social: lettura membri o admin"
  on public.social_accounts for select to authenticated
  using (public.is_workspace_member(workspace_id) or public.is_admin());

create policy "posts: lettura membri o admin"
  on public.scheduled_posts for select to authenticated
  using (public.is_workspace_member(workspace_id) or public.is_admin());

-- Le colonne Metricool del workspace non sono modificabili dai clienti (il grant di Fase 1
-- elenca già solo le colonne permesse: nessuna modifica necessaria).

-- Regola di sicurezza in database: un post può esistere solo per un video approvato.
create or replace function public.ensure_video_approved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.videos v
    where v.id = new.video_id and v.status in ('approved', 'scheduled', 'published')
  ) then
    raise exception 'Niente viene pubblicato senza approvazione.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger scheduled_posts_require_approval
  before insert on public.scheduled_posts
  for each row execute function public.ensure_video_approved();

revoke execute on function public.ensure_video_approved() from public, anon, authenticated;
