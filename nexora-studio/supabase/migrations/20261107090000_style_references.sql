-- ═══════════════════════════════════════════════════════════════════════════
-- Indicazioni del cliente e video di riferimento per il montaggio.
-- ═══════════════════════════════════════════════════════════════════════════

-- Come il cliente vuole il montaggio di questo video (facoltativo)
alter table public.videos
  add column edit_notes text check (char_length(edit_notes) <= 1000);

-- Il video di riferimento è una clip del video di tipo 'reference' (al massimo una)
alter table public.video_clips drop constraint video_clips_kind_check;
alter table public.video_clips add constraint video_clips_kind_check
  check (kind in ('speech', 'cover', 'reference'));

-- Analisi dello stile di un video di riferimento (anche gli esempi del brand), fatta una volta sola
create table public.style_profiles (
  bucket       text not null check (bucket in ('raw', 'brand')),
  storage_path text not null,
  profile      jsonb not null,
  created_at   timestamptz not null default now(),
  primary key (bucket, storage_path)
);
alter table public.style_profiles enable row level security;
revoke all on public.style_profiles from authenticated, anon;
