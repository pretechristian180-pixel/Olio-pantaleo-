-- ═══════════════════════════════════════════════════════════════════════════
-- Più clip per video: riprese in cui si parla (unite dal worker nell'ordine deciso dall'AI)
-- e clip di copertura (messe sopra la voce come b-roll). Un video resta 1 video del piano.
-- I video con un solo girato non hanno righe qui e funzionano come prima.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.video_clips (
  id             uuid primary key default gen_random_uuid(),
  video_id       uuid not null references public.videos (id) on delete cascade,
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,
  raw_upload_id  uuid not null unique references public.raw_uploads (id) on delete restrict,
  kind           text not null check (kind in ('speech', 'cover')),
  position       smallint not null check (position between 1 and 10),
  play_order     smallint,
  description    text check (char_length(description) <= 200),
  created_at     timestamptz not null default now(),
  unique (video_id, position)
);

create index video_clips_video_idx on public.video_clips (video_id);

alter table public.video_clips enable row level security;

-- Lettura per i membri dell'azienda e per il team; scrittura solo dal server (service role).
create policy "clips: lettura membri o admin"
  on public.video_clips for select to authenticated
  using (public.is_workspace_member(workspace_id) or public.is_admin());

revoke insert, update, delete on public.video_clips from authenticated, anon;

-- Il girato unito dal worker è un raw_upload con origine 'combined'.
alter table public.raw_uploads drop constraint raw_uploads_source_check;
alter table public.raw_uploads add constraint raw_uploads_source_check
  check (source in ('upload', 'drive', 'combined'));

-- I membri non possono registrare da sé un girato "unito": lo crea solo il worker.
drop policy "raw: registrazione membri" on public.raw_uploads;
create policy "raw: registrazione membri"
  on public.raw_uploads for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and uploaded_by = (select auth.uid())
    and storage_path like workspace_id::text || '/%'
    and status = 'uploaded'
    and source in ('upload', 'drive')
  );
