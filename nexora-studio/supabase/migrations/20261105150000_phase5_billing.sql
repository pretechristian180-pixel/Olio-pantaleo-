-- ═══════════════════════════════════════════════════════════════════════════
-- Fase 5 — Abbonamenti: un abbonamento può coprire più brand (piano Business),
-- contatori mensili per brand, eventi Stripe idempotenti, blocchi e restituzioni.
-- Nessun dato esistente viene cancellato.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- workspaces: chi paga e stato del pagamento
-- ───────────────────────────────────────────────────────────────────────────
alter table public.workspaces
  add column billing_workspace_id uuid references public.workspaces (id) on delete set null,
  add column billing_interval     text check (billing_interval in ('month', 'year')),
  add column cancel_at_period_end boolean not null default false,
  add column payment_failed_at    timestamptz,
  add constraint workspaces_billing_not_self check (billing_workspace_id <> id);

create index workspaces_billing_workspace_idx on public.workspaces (billing_workspace_id);

comment on column public.workspaces.billing_workspace_id is
  'Azienda che paga l''abbonamento (piano con più brand). Null: il brand paga per sé.';

-- I brand collegati ricevono piano, stato e periodo dell'azienda che paga: tutto il codice
-- che legge workspaces.plan_id / subscription_status continua a funzionare per ogni brand.
create or replace function public.propagate_billing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.workspaces c
  set plan_id = new.plan_id,
      subscription_status = new.subscription_status,
      period_start = new.period_start,
      period_end = new.period_end,
      billing_interval = new.billing_interval,
      cancel_at_period_end = new.cancel_at_period_end,
      payment_failed_at = new.payment_failed_at
  where c.billing_workspace_id = new.id;
  return new;
end;
$$;

create trigger workspaces_propagate_billing
  after update of plan_id, subscription_status, period_start, period_end,
                  billing_interval, cancel_at_period_end, payment_failed_at
  on public.workspaces
  for each row
  when (new.billing_workspace_id is null)
  execute function public.propagate_billing();

revoke execute on function public.propagate_billing() from public, anon, authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- usage_counters: consumi per brand e per periodo di abbonamento.
-- Una riga nuova a ogni rinnovo: i contatori ripartono da zero, lo storico resta.
-- ───────────────────────────────────────────────────────────────────────────
create table public.usage_counters (
  workspace_id        uuid not null references public.workspaces (id) on delete cascade,
  period_start        timestamptz not null,
  period_end          timestamptz not null,
  videos_used         integer not null default 0 check (videos_used >= 0),
  broll_credits_used  integer not null default 0 check (broll_credits_used >= 0),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  primary key (workspace_id, period_start)
);

create trigger usage_counters_updated_at
  before update on public.usage_counters
  for each row execute function public.set_updated_at();

alter table public.usage_counters enable row level security;

-- Lettura per i membri del brand e dell'azienda che paga; scrittura solo dal server.
create policy "usage: lettura membri o admin"
  on public.usage_counters for select to authenticated
  using (
    public.is_workspace_member(workspace_id)
    or exists (
      select 1 from public.workspaces w
      where w.id = usage_counters.workspace_id
        and w.billing_workspace_id is not null
        and public.is_workspace_member(w.billing_workspace_id)
    )
    or public.is_admin()
  );

-- ───────────────────────────────────────────────────────────────────────────
-- videos: da quale quota è stato preso il video (per restituirlo se fallisce)
-- ───────────────────────────────────────────────────────────────────────────
alter table public.videos
  add column quota_kind          text check (quota_kind in ('trial', 'plan')),
  add column billed_period_start timestamptz;

-- ───────────────────────────────────────────────────────────────────────────
-- stripe_events: ogni evento una sola volta (Stripe può ripetere le consegne)
-- ───────────────────────────────────────────────────────────────────────────
create table public.stripe_events (
  id            text primary key,           -- id dell'evento Stripe (evt_…)
  type          text not null,
  payload       jsonb not null,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz,
  error         text
);

alter table public.stripe_events enable row level security;
-- Nessuna policy: solo service role.

-- ═══════════════════════════════════════════════════════════════════════════
-- Quote: riserva e restituzione di un video, crediti b-roll.
-- Chiamate solo dal server (service role).
-- ═══════════════════════════════════════════════════════════════════════════

-- Periodo corrente del brand: quello dell'abbonamento, o il mese solare se manca.
create or replace function public.usage_period(ws public.workspaces)
returns table (period_start timestamptz, period_end timestamptz)
language sql
stable
set search_path = ''
as $$
  select
    coalesce(ws.period_start, date_trunc('month', now())),
    coalesce(ws.period_end, date_trunc('month', now()) + interval '1 month');
$$;

/**
 * Riserva un video. Esito (jsonb):
 *   { ok: true, kind: 'trial'|'plan', period_start }
 *   { ok: false, reason: 'trial_over'|'payment_failed'|'inactive'|'limit_reached', limit? }
 * Un pagamento fallito blocca i nuovi montaggi ma non cancella nulla.
 */
create or replace function public.reserve_video(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws public.workspaces;
  pl public.plans;
  per record;
  used integer;
begin
  select * into ws from public.workspaces where id = p_workspace_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'inactive'); end if;

  if ws.plan_id is null then
    if ws.trial_videos_left <= 0 then
      return jsonb_build_object('ok', false, 'reason', 'trial_over');
    end if;
    update public.workspaces set trial_videos_left = trial_videos_left - 1 where id = ws.id;
    return jsonb_build_object('ok', true, 'kind', 'trial');
  end if;

  if ws.subscription_status in ('past_due', 'unpaid') then
    return jsonb_build_object('ok', false, 'reason', 'payment_failed');
  end if;
  if ws.subscription_status <> 'active' then
    return jsonb_build_object('ok', false, 'reason', 'inactive');
  end if;

  select * into pl from public.plans where id = ws.plan_id;
  select * into per from public.usage_period(ws);

  insert into public.usage_counters (workspace_id, period_start, period_end)
  values (ws.id, per.period_start, per.period_end)
  on conflict (workspace_id, period_start) do nothing;

  select videos_used into used from public.usage_counters
  where workspace_id = ws.id and period_start = per.period_start
  for update;

  if used >= pl.videos_per_month then
    return jsonb_build_object('ok', false, 'reason', 'limit_reached', 'limit', pl.videos_per_month);
  end if;

  update public.usage_counters set videos_used = videos_used + 1
  where workspace_id = ws.id and period_start = per.period_start;
  return jsonb_build_object('ok', true, 'kind', 'plan', 'period_start', per.period_start);
end;
$$;

-- Restituisce il video riservato (montaggio fallito o non avviato). Idempotente.
create or replace function public.release_video(p_video_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.videos;
begin
  update public.videos set quota_kind = null
  where id = p_video_id and quota_kind is not null
  returning * into v;
  if not found then return; end if;

  -- Prova gratuita: nessun periodo; piano: il periodo da cui era stato preso
  if v.billed_period_start is null then
    update public.workspaces set trial_videos_left = least(3, trial_videos_left + 1)
    where id = v.workspace_id;
  else
    update public.usage_counters set videos_used = greatest(0, videos_used - 1)
    where workspace_id = v.workspace_id and period_start = v.billed_period_start;
  end if;
end;
$$;

-- Restituzione di una prenotazione per cui il video non è stato creato.
create or replace function public.release_reservation(p_workspace_id uuid, p_period_start timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_period_start is null then
    update public.workspaces set trial_videos_left = least(3, trial_videos_left + 1)
    where id = p_workspace_id;
  else
    update public.usage_counters set videos_used = greatest(0, videos_used - 1)
    where workspace_id = p_workspace_id and period_start = p_period_start;
  end if;
end;
$$;

/**
 * Crediti b-roll: concede fino a p_count clip (0 se finiti). La prova gratuita non ha
 * limite di crediti (3 video in tutto); senza abbonamento attivo: 0.
 */
create or replace function public.use_broll_credits(p_workspace_id uuid, p_count integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws public.workspaces;
  pl public.plans;
  per record;
  granted integer;
begin
  if p_count <= 0 then return 0; end if;
  select * into ws from public.workspaces where id = p_workspace_id;
  if not found then return 0; end if;
  if ws.plan_id is null then return p_count; end if;
  if ws.subscription_status <> 'active' then return 0; end if;

  select * into pl from public.plans where id = ws.plan_id;
  select * into per from public.usage_period(ws);
  insert into public.usage_counters (workspace_id, period_start, period_end)
  values (ws.id, per.period_start, per.period_end)
  on conflict (workspace_id, period_start) do nothing;

  select greatest(0, pl.broll_credits_month - broll_credits_used) into granted
  from public.usage_counters
  where workspace_id = ws.id and period_start = per.period_start
  for update;
  granted := least(p_count, granted);

  if granted > 0 then
    update public.usage_counters set broll_credits_used = broll_credits_used + granted
    where workspace_id = ws.id and period_start = per.period_start;
  end if;
  return granted;
end;
$$;

-- reserve_trial_video / release_trial_video restano per compatibilità con il worker già avviato.
revoke execute on function public.usage_period(public.workspaces) from public, anon, authenticated;
revoke execute on function public.reserve_video(uuid) from public, anon, authenticated;
revoke execute on function public.release_video(uuid) from public, anon, authenticated;
revoke execute on function public.release_reservation(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.use_broll_credits(uuid, integer) from public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Brand: un utente crea da solo un'azienda sola (la prova gratuita è per azienda).
-- I brand in più passano da create_brand, con il piano che lo consente.
-- ═══════════════════════════════════════════════════════════════════════════
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
  if not public.is_admin() and exists (
    select 1 from public.workspace_members m where m.user_id = uid and m.role = 'owner'
  ) then
    raise exception 'Hai già un''azienda. Per aggiungere un brand serve il piano Business.'
      using errcode = 'P0001';
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

-- Nuovo brand coperto dall'abbonamento dell'azienda che paga (owner di quell'azienda).
create or replace function public.create_brand(p_billing_workspace_id uuid, p_name text)
returns public.workspaces
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  payer public.workspaces;
  pl public.plans;
  brands integer;
  ws public.workspaces;
begin
  if uid is null then
    raise exception 'Accesso richiesto.' using errcode = '42501';
  end if;
  if not public.is_workspace_owner(p_billing_workspace_id) then
    raise exception 'Solo il titolare può aggiungere brand.' using errcode = '42501';
  end if;

  select * into payer from public.workspaces where id = p_billing_workspace_id for update;
  if payer.billing_workspace_id is not null then
    raise exception 'Aggiungi il brand dall''azienda che paga l''abbonamento.' using errcode = 'P0001';
  end if;
  if payer.plan_id is null or payer.subscription_status <> 'active' then
    raise exception 'Per aggiungere un brand serve un abbonamento attivo.' using errcode = 'P0001';
  end if;

  select * into pl from public.plans where id = payer.plan_id;
  select 1 + count(*) into brands from public.workspaces where billing_workspace_id = payer.id;
  if brands >= pl.brands_max then
    raise exception 'Il piano % include % brand.', pl.name, pl.brands_max using errcode = 'P0001';
  end if;

  insert into public.workspaces (
    name, slug, created_by, billing_workspace_id, plan_id, subscription_status,
    period_start, period_end, billing_interval, cancel_at_period_end, payment_failed_at,
    trial_videos_left, onboarding_step
  )
  values (
    trim(p_name), public.unique_workspace_slug(p_name), uid, payer.id, payer.plan_id,
    payer.subscription_status, payer.period_start, payer.period_end, payer.billing_interval,
    payer.cancel_at_period_end, payer.payment_failed_at, 0, 1
  )
  returning * into ws;

  insert into public.workspace_members (workspace_id, user_id, role) values (ws.id, uid, 'owner');
  insert into public.brand_profiles (workspace_id) values (ws.id);
  insert into public.audit_log (workspace_id, user_id, action, details)
    values (ws.id, uid, 'brand.created', jsonb_build_object('billing_workspace_id', payer.id));

  return ws;
end;
$$;

revoke execute on function public.create_brand(uuid, text) from public, anon;
grant execute on function public.create_brand(uuid, text) to authenticated;
