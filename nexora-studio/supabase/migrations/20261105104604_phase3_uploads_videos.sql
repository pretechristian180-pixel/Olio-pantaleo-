-- ═══════════════════════════════════════════════════════════════════════════
-- Nexora Studio — Fase 3: girati, video montati, versioni, richieste di modifica
-- BOZZA da approvare.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- raw_uploads: il girato caricato dall'azienda (bucket privato "raw")
-- ───────────────────────────────────────────────────────────────────────────
create table public.raw_uploads (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  script_id     uuid references public.scripts (id) on delete set null,   -- null = "video libero"
  uploaded_by   uuid references auth.users (id) on delete set null,
  storage_path  text not null unique,           -- "<workspace_id>/<uuid>/<nome>.mp4"
  file_name     text not null,
  size_bytes    bigint,
  mime_type     text,
  -- Letti dal worker con ffprobe (non ci fidiamo dei dati del browser)
  duration_s    numeric(8, 2),
  width         integer,
  height        integer,
  orientation   text check (orientation in ('portrait', 'landscape', 'square')),
  source        text not null default 'upload' check (source in ('upload', 'drive')),
  status        text not null default 'uploaded' check (status in (
                  'uploaded', 'processing', 'ready', 'error')),
  error         text,
  -- Trascrizione parola per parola (Whisper): { language, text, words: [{text,start,end}] }
  transcript    jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index raw_uploads_workspace_idx on public.raw_uploads (workspace_id, created_at desc);

create trigger raw_uploads_updated_at
  before update on public.raw_uploads
  for each row execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- videos: il video "logico" (uno per girato), con le sue versioni
-- ───────────────────────────────────────────────────────────────────────────
create table public.videos (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces (id) on delete cascade,
  script_id           uuid references public.scripts (id) on delete set null,
  raw_upload_id       uuid not null references public.raw_uploads (id) on delete restrict,
  status              text not null default 'queued' check (status in (
                        'queued',             -- in coda per il montaggio
                        'editing',            -- trascrizione / edit_spec / render in corso
                        'internal_review',    -- manual_review: lo controlla prima il team Nexora
                        'review',             -- da approvare dall'azienda
                        'changes_requested',  -- richiesta modifica: nuova versione in arrivo
                        'approved',
                        'scheduled',
                        'published',
                        'error')),
  current_version     smallint not null default 0,   -- 0 = nessuna versione pronta
  change_rounds_used  smallint not null default 0 check (change_rounds_used between 0 and 2),
  caption             text,
  hashtags            text[] not null default '{}',
  broll_credits_used  smallint not null default 0,
  error               text,
  approved_by         uuid references auth.users (id) on delete set null,
  approved_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index videos_workspace_status_idx on public.videos (workspace_id, status, created_at desc);
create unique index videos_raw_upload_idx on public.videos (raw_upload_id);

create trigger videos_updated_at
  before update on public.videos
  for each row execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- video_versions: ogni montaggio (v1, v2 dopo una modifica, ...)
-- ───────────────────────────────────────────────────────────────────────────
create table public.video_versions (
  id              uuid primary key default gen_random_uuid(),
  video_id        uuid not null references public.videos (id) on delete cascade,
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,
  version         smallint not null check (version >= 1),
  -- Timeline generata dall'LLM: tagli, ordine, sottotitoli, parole evidenziate, b-roll, musica
  edit_spec       jsonb,
  feedback_id     uuid,                -- richiesta di modifica che ha prodotto questa versione
  status          text not null default 'pending' check (status in ('pending', 'ready', 'error')),
  output_path     text,                -- bucket "output"
  thumbnail_path  text,
  duration_s      numeric(8, 2),
  render_ms       integer,             -- tempo di montaggio (obiettivo: < 15 min per 3 min di girato)
  created_at      timestamptz not null default now(),
  unique (video_id, version)
);

-- ───────────────────────────────────────────────────────────────────────────
-- video_feedback: richieste di modifica in testo libero
-- ───────────────────────────────────────────────────────────────────────────
create table public.video_feedback (
  id          uuid primary key default gen_random_uuid(),
  video_id    uuid not null references public.videos (id) on delete cascade,
  version     smallint not null,
  user_id     uuid references auth.users (id) on delete set null,
  message     text not null check (char_length(message) between 3 and 1000),
  created_at  timestamptz not null default now()
);

alter table public.video_versions
  add constraint video_versions_feedback_fk
  foreign key (feedback_id) references public.video_feedback (id) on delete set null;

alter table public.provider_costs
  add constraint provider_costs_video_fk
  foreign key (video_id) references public.videos (id) on delete set null;

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.raw_uploads    enable row level security;
alter table public.videos         enable row level security;
alter table public.video_versions enable row level security;
alter table public.video_feedback enable row level security;

-- Girati: i membri li vedono e li registrano (dopo il caricamento nello storage).
create policy "raw: lettura membri o admin"
  on public.raw_uploads for select to authenticated
  using (public.is_workspace_member(workspace_id) or public.is_admin());

create policy "raw: registrazione membri"
  on public.raw_uploads for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and uploaded_by = (select auth.uid())
    and storage_path like workspace_id::text || '/%'
    and status = 'uploaded'
  );

revoke insert on public.raw_uploads from authenticated;
grant insert (workspace_id, script_id, uploaded_by, storage_path, file_name, size_bytes, mime_type, source)
  on public.raw_uploads to authenticated;

-- Video: lettura membri. Le azioni (approva, chiedi modifica, didascalia) passano dal server,
-- che controlla stato e limiti: nessuna scrittura diretta dal client.
create policy "videos: lettura membri o admin"
  on public.videos for select to authenticated
  using (
    (public.is_workspace_member(workspace_id) and status <> 'internal_review')
    or public.is_admin()
  );

create policy "versions: lettura membri o admin"
  on public.video_versions for select to authenticated
  using (
    exists (
      select 1 from public.videos v
      where v.id = video_id
        and ((public.is_workspace_member(v.workspace_id) and v.status <> 'internal_review')
             or public.is_admin())
    )
  );

create policy "feedback: lettura membri o admin"
  on public.video_feedback for select to authenticated
  using (
    exists (
      select 1 from public.videos v
      where v.id = video_id and (public.is_workspace_member(v.workspace_id) or public.is_admin())
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- Prova gratuita: un video montato consuma uno dei 3 video di prova.
-- Il consumo avviene alla creazione del video (prenotazione) e viene restituito se il
-- montaggio fallisce definitivamente. Chiamate solo dal server (service role).
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.reserve_trial_video(p_workspace_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws public.workspaces;
begin
  select * into ws from public.workspaces where id = p_workspace_id for update;
  if not found then return false; end if;
  if ws.plan_id is not null then return true; end if;   -- piani a pagamento: limiti in Fase 5
  if ws.trial_videos_left <= 0 then return false; end if;
  update public.workspaces set trial_videos_left = trial_videos_left - 1 where id = p_workspace_id;
  return true;
end;
$$;

create or replace function public.release_trial_video(p_workspace_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.workspaces
  set trial_videos_left = least(3, trial_videos_left + 1)
  where id = p_workspace_id and plan_id is null;
$$;

revoke execute on function public.reserve_trial_video(uuid) from public, anon, authenticated;
revoke execute on function public.release_trial_video(uuid) from public, anon, authenticated;

-- Bucket "music": libreria musicale di Nexora (lettura solo dal worker con service role).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('music', 'music', false, 52428800, array['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/aac'])
on conflict (id) do nothing;
