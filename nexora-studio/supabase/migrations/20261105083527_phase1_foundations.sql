-- ═══════════════════════════════════════════════════════════════════════════
-- Nexora Studio — Fase 1: fondamenta
-- Profili, piani, workspace, membri e inviti, profilo brand, audit log,
-- funzioni di supporto per la RLS, bucket di storage privati.
--
-- Le tabelle di script, upload, video, social, job e contatori arrivano
-- nelle migrazioni delle rispettive fasi.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists citext with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ───────────────────────────────────────────────────────────────────────────
-- Utility: updated_at automatico
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- profiles: un record per utente di auth.users
-- ───────────────────────────────────────────────────────────────────────────
create table public.profiles (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  phone       text,
  is_admin    boolean not null default false,  -- team Nexora
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Crea il profilo alla registrazione (nome da email/password o da Google).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────────────────────────────────────────────────────────
-- plans: limiti modificabili dall'admin, mai hardcoded nel codice
-- ───────────────────────────────────────────────────────────────────────────
create table public.plans (
  id                       text primary key,          -- 'start' | 'pro' | 'business'
  name                     text not null,
  price_monthly_cents      integer not null check (price_monthly_cents >= 0),
  price_yearly_cents       integer not null check (price_yearly_cents >= 0),
  videos_per_month         integer not null check (videos_per_month >= 0),
  social_accounts_max      integer not null check (social_accounts_max >= 0),
  broll_credits_month      integer not null check (broll_credits_month >= 0),
  brands_max               integer not null check (brands_max >= 1),
  stripe_price_monthly_id  text,
  stripe_price_yearly_id   text,
  sort_order               integer not null default 0,
  active                   boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create trigger plans_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

-- Annuale = 10 mensilità.
insert into public.plans
  (id, name, price_monthly_cents, price_yearly_cents, videos_per_month,
   social_accounts_max, broll_credits_month, brands_max, sort_order)
values
  ('start',    'Start',     7900,  79000,  8, 2,   0, 1, 1),
  ('pro',      'Pro',      14900, 149000, 12, 4,  36, 1, 2),
  ('business', 'Business', 29900, 299000, 25, 6, 100, 3, 3);

-- ───────────────────────────────────────────────────────────────────────────
-- workspaces: l'azienda cliente
-- ───────────────────────────────────────────────────────────────────────────
create table public.workspaces (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null check (char_length(name) between 2 and 120),
  slug                    text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  sector                  text check (sector in (
                            'ristorazione', 'automotive', 'immobiliare',
                            'studio_professionale', 'retail', 'beauty_benessere',
                            'fitness', 'artigianato', 'turismo', 'altro')),
  city                    text,
  website                 text,
  instagram_handle        text,
  logo_url                text,          -- percorso nel bucket privato 'brand'
  brand_colors            jsonb not null default '[]'::jsonb,  -- ["#112233", ...]

  -- Preferenze di pubblicazione (onboarding passo 6)
  posts_per_week          smallint not null default 3 check (posts_per_week between 2 and 4),
  posting_days            smallint[] not null default '{1,3,5}',  -- ISO: 1 = lunedì … 7 = domenica
  posting_time            time not null default '12:30',
  timezone                text not null default 'Europe/Rome',

  -- Abbonamento (scritto solo da webhook Stripe / admin)
  plan_id                 text references public.plans (id),
  stripe_customer_id      text unique,
  stripe_subscription_id  text unique,
  subscription_status     text not null default 'trial' check (subscription_status in (
                            'trial', 'active', 'past_due', 'canceled', 'incomplete', 'unpaid')),
  period_start            timestamptz,
  period_end              timestamptz,
  founding_member         boolean not null default false,
  trial_videos_left       smallint not null default 3 check (trial_videos_left >= 0),

  -- Operatività Nexora
  manual_review           boolean not null default true,  -- durante il test ogni video passa dal team

  -- Onboarding: passo a cui riprendere (1 = azienda … 5 = fine), completato quando valorizzato
  onboarding_step         smallint not null default 2 check (onboarding_step between 1 and 10),
  onboarding_completed_at timestamptz,
  created_by              uuid references auth.users (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint posting_days_valid check (posting_days <@ '{1,2,3,4,5,6,7}'::smallint[])
);

create trigger workspaces_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- workspace_members
-- ───────────────────────────────────────────────────────────────────────────
create table public.workspace_members (
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  role          text not null check (role in ('owner', 'member')),
  invited_at    timestamptz,
  joined_at     timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_idx on public.workspace_members (user_id);

-- ───────────────────────────────────────────────────────────────────────────
-- workspace_invitations: inviti via email per la pagina Team
-- ───────────────────────────────────────────────────────────────────────────
create table public.workspace_invitations (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  email         extensions.citext not null,
  role          text not null default 'member' check (role in ('owner', 'member')),
  token         uuid not null unique default gen_random_uuid(),
  invited_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '7 days',
  accepted_at   timestamptz,
  revoked_at    timestamptz
);

-- Un solo invito aperto per email e workspace.
create unique index workspace_invitations_open_idx
  on public.workspace_invitations (workspace_id, email)
  where accepted_at is null and revoked_at is null;

-- ───────────────────────────────────────────────────────────────────────────
-- brand_profiles: 1:1 con workspace
-- ───────────────────────────────────────────────────────────────────────────
create table public.brand_profiles (
  workspace_id      uuid primary key references public.workspaces (id) on delete cascade,
  tone_of_voice     text,
  target_audience   text,
  services          text,
  do_not_say        text,
  -- { pace, subtitles: { style, font, size, position }, music, broll_usage, ... }
  edit_style        jsonb not null default '{}'::jsonb,
  reference_videos  text[] not null default '{}',  -- percorsi nel bucket 'brand'
  updated_at        timestamptz not null default now()
);

create trigger brand_profiles_updated_at
  before update on public.brand_profiles
  for each row execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- audit_log
-- ───────────────────────────────────────────────────────────────────────────
create table public.audit_log (
  id            bigint generated always as identity primary key,
  workspace_id  uuid references public.workspaces (id) on delete cascade,
  user_id       uuid references auth.users (id) on delete set null,
  action        text not null,
  details       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index audit_log_workspace_idx on public.audit_log (workspace_id, created_at desc);

-- ═══════════════════════════════════════════════════════════════════════════
-- Funzioni di supporto per la RLS
-- security definer: leggono membership/admin senza ricorsione nelle policy.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.user_id = (select auth.uid())),
    false
  );
$$;

create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_workspace_owner(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = (select auth.uid()) and m.role = 'owner'
  );
$$;

-- Utenti che condividono almeno un workspace (per vedere i nomi del team).
create or replace function public.shares_workspace_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members a
    join public.workspace_members b on b.workspace_id = a.workspace_id
    where a.user_id = (select auth.uid()) and b.user_id = other
  );
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Row Level Security
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.profiles              enable row level security;
alter table public.plans                 enable row level security;
alter table public.workspaces            enable row level security;
alter table public.workspace_members     enable row level security;
alter table public.workspace_invitations enable row level security;
alter table public.brand_profiles        enable row level security;
alter table public.audit_log             enable row level security;

-- profiles ----------------------------------------------------------------
create policy "profiles: lettura propria, del team o admin"
  on public.profiles for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.shares_workspace_with(user_id)
    or public.is_admin()
  );

create policy "profiles: modifica propria o admin"
  on public.profiles for update to authenticated
  using (user_id = (select auth.uid()) or public.is_admin())
  with check (user_id = (select auth.uid()) or public.is_admin());

-- is_admin non è modificabile dall'utente: grant solo sulle colonne sicure.
revoke update on public.profiles from authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- plans --------------------------------------------------------------------
create policy "plans: lettura pubblica dei piani attivi"
  on public.plans for select to anon, authenticated
  using (active or public.is_admin());

create policy "plans: gestione admin"
  on public.plans for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- workspaces ---------------------------------------------------------------
create policy "workspaces: lettura membri o admin"
  on public.workspaces for select to authenticated
  using (public.is_workspace_member(id) or public.is_admin());

-- La creazione passa da create_workspace() (crea anche owner e brand profile).
create policy "workspaces: modifica owner o admin"
  on public.workspaces for update to authenticated
  using (public.is_workspace_owner(id) or public.is_admin())
  with check (public.is_workspace_owner(id) or public.is_admin());

create policy "workspaces: eliminazione admin"
  on public.workspaces for delete to authenticated
  using (public.is_admin());

-- Abbonamento, piano, prova, founding e manual_review: solo service role.
revoke update on public.workspaces from authenticated;
grant update (
  name, sector, city, website, instagram_handle, logo_url, brand_colors,
  posts_per_week, posting_days, posting_time, timezone, onboarding_step, onboarding_completed_at
) on public.workspaces to authenticated;

-- workspace_members --------------------------------------------------------
create policy "members: lettura membri dello stesso workspace o admin"
  on public.workspace_members for select to authenticated
  using (public.is_workspace_member(workspace_id) or public.is_admin());

create policy "members: owner cambia i ruoli"
  on public.workspace_members for update to authenticated
  using (public.is_workspace_owner(workspace_id) or public.is_admin())
  with check (public.is_workspace_owner(workspace_id) or public.is_admin());

create policy "members: owner rimuove, il membro può uscire"
  on public.workspace_members for delete to authenticated
  using (
    public.is_workspace_owner(workspace_id)
    or user_id = (select auth.uid())
    or public.is_admin()
  );

revoke update on public.workspace_members from authenticated;
grant update (role) on public.workspace_members to authenticated;

-- Ogni workspace deve conservare almeno un owner.
create or replace function public.ensure_owner_remains()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid := coalesce(old.workspace_id, new.workspace_id);
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and exists (select 1 from public.workspaces w where w.id = ws)  -- non durante il cascade
     and not exists (
       select 1 from public.workspace_members m
       where m.workspace_id = ws and m.role = 'owner' and m.user_id <> old.user_id
     )
  then
    raise exception 'Il workspace deve avere almeno un titolare.'
      using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger workspace_members_keep_owner
  after update or delete on public.workspace_members
  for each row execute function public.ensure_owner_remains();

-- workspace_invitations ----------------------------------------------------
create policy "invitations: owner e admin vedono gli inviti"
  on public.workspace_invitations for select to authenticated
  using (public.is_workspace_owner(workspace_id) or public.is_admin());

create policy "invitations: owner crea inviti"
  on public.workspace_invitations for insert to authenticated
  with check (
    (public.is_workspace_owner(workspace_id) or public.is_admin())
    and invited_by = (select auth.uid())
  );

create policy "invitations: owner revoca inviti"
  on public.workspace_invitations for update to authenticated
  using (public.is_workspace_owner(workspace_id) or public.is_admin())
  with check (public.is_workspace_owner(workspace_id) or public.is_admin());

revoke update on public.workspace_invitations from authenticated;
grant update (revoked_at) on public.workspace_invitations to authenticated;

-- brand_profiles -----------------------------------------------------------
create policy "brand: lettura membri o admin"
  on public.brand_profiles for select to authenticated
  using (public.is_workspace_member(workspace_id) or public.is_admin());

-- Owner e member possono aggiornare il brand (il member ci lavora ogni giorno).
create policy "brand: modifica membri o admin"
  on public.brand_profiles for update to authenticated
  using (public.is_workspace_member(workspace_id) or public.is_admin())
  with check (public.is_workspace_member(workspace_id) or public.is_admin());

-- audit_log ----------------------------------------------------------------
create policy "audit: lettura owner o admin"
  on public.audit_log for select to authenticated
  using (
    (workspace_id is not null and public.is_workspace_owner(workspace_id))
    or public.is_admin()
  );
-- Nessuna policy di scrittura: scrivono solo le funzioni security definer e il service role.

-- ═══════════════════════════════════════════════════════════════════════════
-- Funzioni RPC (operazioni che toccano più tabelle in modo atomico)
-- ═══════════════════════════════════════════════════════════════════════════

-- Slug unico a partire dal nome: "Pizzeria Da Mario" → "pizzeria-da-mario(-2)"
create or replace function public.unique_workspace_slug(base_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text;
  candidate text;
  n int := 1;
begin
  -- dizionario esplicito: con search_path vuoto unaccent(text) non lo trova
  base := lower(extensions.unaccent('extensions.unaccent'::regdictionary, base_name));
  base := regexp_replace(base, '[^a-z0-9]+', '-', 'g');
  base := trim(both '-' from base);
  if base = '' then base := 'azienda'; end if;
  base := left(base, 48);
  candidate := base;
  while exists (select 1 from public.workspaces where slug = candidate) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  return candidate;
end;
$$;

-- Crea workspace + owner + profilo brand vuoto. Usata dall'onboarding.
create or replace function public.create_workspace(
  p_name text,
  p_sector text default null,
  p_city text default null,
  p_website text default null,
  p_instagram_handle text default null
)
returns public.workspaces
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  ws public.workspaces;
begin
  if uid is null then
    raise exception 'Accesso richiesto.' using errcode = '42501';
  end if;

  insert into public.workspaces (name, slug, sector, city, website, instagram_handle, created_by)
  values (
    trim(p_name), public.unique_workspace_slug(p_name), p_sector, nullif(trim(p_city), ''),
    nullif(trim(p_website), ''), nullif(trim(both '@ ' from p_instagram_handle), ''), uid
  )
  returning * into ws;

  insert into public.workspace_members (workspace_id, user_id, role) values (ws.id, uid, 'owner');
  insert into public.brand_profiles (workspace_id) values (ws.id);
  insert into public.audit_log (workspace_id, user_id, action)
    values (ws.id, uid, 'workspace.created');

  return ws;
end;
$$;

-- Accetta un invito: l'email dell'utente deve coincidere con quella invitata.
create or replace function public.accept_invitation(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  user_email text;
  inv public.workspace_invitations;
begin
  if uid is null then
    raise exception 'Accesso richiesto.' using errcode = '42501';
  end if;

  select email into user_email from auth.users where id = uid;

  select * into inv from public.workspace_invitations
  where token = p_token
    and accepted_at is null
    and revoked_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Invito non valido o scaduto.' using errcode = 'P0002';
  end if;

  if lower(inv.email::text) <> lower(user_email) then
    raise exception 'Questo invito è per un altro indirizzo email.' using errcode = '42501';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, invited_at)
  values (inv.workspace_id, uid, inv.role, inv.created_at)
  on conflict (workspace_id, user_id) do nothing;

  update public.workspace_invitations set accepted_at = now() where id = inv.id;

  insert into public.audit_log (workspace_id, user_id, action, details)
  values (inv.workspace_id, uid, 'member.joined', jsonb_build_object('role', inv.role));

  return inv.workspace_id;
end;
$$;

-- Anteprima di un invito per la pagina /invito/<token>, anche prima dell'accesso.
-- Restituisce solo nome dell'azienda, email invitata e stato: niente altri dati.
create or replace function public.get_invitation(p_token uuid)
returns table (workspace_name text, email text, role text, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    w.name,
    i.email::text,
    i.role,
    case
      when i.accepted_at is not null then 'accepted'
      when i.revoked_at is not null then 'revoked'
      when i.expires_at <= now() then 'expired'
      else 'open'
    end
  from public.workspace_invitations i
  join public.workspaces w on w.id = i.workspace_id
  where i.token = p_token;
$$;

revoke execute on function public.get_invitation(uuid) from public;
grant execute on function public.get_invitation(uuid) to anon, authenticated;

-- Le funzioni RPC sono per utenti autenticati, non per anon.
revoke execute on function public.create_workspace(text, text, text, text, text) from public, anon;
revoke execute on function public.accept_invitation(uuid) from public, anon;
revoke execute on function public.unique_workspace_slug(text) from public, anon, authenticated;
grant execute on function public.create_workspace(text, text, text, text, text) to authenticated;
grant execute on function public.accept_invitation(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Storage: bucket privati, percorsi "<workspace_id>/..."
--   brand  → logo, video di esempio (membri: lettura e scrittura)
--   raw    → girato grezzo        (membri: lettura e caricamento)
--   output → video montati        (membri: sola lettura; scrive il worker)
-- Nessun URL pubblico: solo URL firmati a scadenza.
-- ═══════════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('brand',  'brand',  false,  524288000,
     array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml',
           'video/mp4', 'video/quicktime', 'video/webm']),
  ('raw',    'raw',    false, 2147483648,
     array['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska']),
  ('output', 'output', false, 2147483648,
     array['video/mp4', 'image/jpeg', 'image/png', 'image/webp', 'text/vtt', 'application/json'])
on conflict (id) do nothing;

create or replace function public.storage_workspace_id(object_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when (storage.foldername(object_name))[1] ~ '^[0-9a-f-]{36}$'
    then ((storage.foldername(object_name))[1])::uuid
  end;
$$;

create policy "storage: lettura membri (brand, raw, output)"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('brand', 'raw', 'output')
    and (public.is_workspace_member(public.storage_workspace_id(name)) or public.is_admin())
  );

create policy "storage: caricamento membri (brand, raw)"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('brand', 'raw')
    and public.is_workspace_member(public.storage_workspace_id(name))
  );

create policy "storage: sostituzione membri (brand, raw)"
  on storage.objects for update to authenticated
  using (
    bucket_id in ('brand', 'raw')
    and public.is_workspace_member(public.storage_workspace_id(name))
  )
  with check (
    bucket_id in ('brand', 'raw')
    and public.is_workspace_member(public.storage_workspace_id(name))
  );

create policy "storage: eliminazione membri (brand) o admin"
  on storage.objects for delete to authenticated
  using (
    (bucket_id = 'brand' and public.is_workspace_member(public.storage_workspace_id(name)))
    or (bucket_id in ('brand', 'raw', 'output') and public.is_admin())
  );
