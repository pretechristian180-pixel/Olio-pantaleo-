-- ═══════════════════════════════════════════════════════════════════════════
-- Allineamento ai Termini di servizio:
--   art. 5.4  tolleranza di 2 giorni dopo un pagamento fallito
--   art. 4.4  modifiche oltre le 2 incluse: consumano un video del piano (restituito se fallisce)
--   art. 6.4 e DPA  girato originale conservato 90 giorni; contenuti cancellati 30 giorni dopo la cessazione
-- Nessun dato esistente viene cancellato da questa migrazione.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.video_feedback
  add column quota_kind          text check (quota_kind in ('trial', 'plan')),
  add column billed_period_start timestamptz;

comment on column public.video_feedback.quota_kind is
  'Modifica oltre quelle incluse: da quale quota è stato preso il video (null = inclusa o già restituita).';

alter table public.raw_uploads
  add column purged_at timestamptz;

comment on column public.raw_uploads.purged_at is
  'Girato originale e trascrizione cancellati (90 giorni dal caricamento).';

alter table public.workspaces
  add column content_purge_warned_at timestamptz,
  add column content_purged_at       timestamptz;

-- Nuovo job notturno di conservazione dei dati.
alter table public.jobs drop constraint jobs_type_check;
alter table public.jobs add constraint jobs_type_check check (type in (
  'generate_scripts', 'send_email', 'transcribe', 'edit', 'render', 'publish', 'sync_social', 'retention'));

-- ───────────────────────────────────────────────────────────────────────────
-- Tolleranza sul pagamento fallito: per 2 giorni si continua a lavorare normalmente.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.billing_allows_work(ws public.workspaces)
returns boolean
language sql
stable
set search_path = ''
as $$
  select ws.subscription_status = 'active'
      or (ws.subscription_status in ('past_due', 'unpaid')
          and coalesce(ws.payment_failed_at, now()) > now() - interval '2 days');
$$;

revoke execute on function public.billing_allows_work(public.workspaces) from public, anon, authenticated;

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

  if not public.billing_allows_work(ws) then
    if ws.subscription_status in ('past_due', 'unpaid') then
      return jsonb_build_object('ok', false, 'reason', 'payment_failed');
    end if;
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
  if not public.billing_allows_work(ws) then return 0; end if;

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

-- Restituisce il video preso per una modifica extra (montaggio fallito). Idempotente.
create or replace function public.release_feedback_quota(p_feedback_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  fb public.video_feedback;
  ws_id uuid;
begin
  update public.video_feedback set quota_kind = null
  where id = p_feedback_id and quota_kind is not null
  returning * into fb;
  if not found then return; end if;
  select workspace_id into ws_id from public.videos where id = fb.video_id;
  perform public.release_reservation(ws_id, fb.billed_period_start);
end;
$$;

revoke execute on function public.release_feedback_quota(uuid) from public, anon, authenticated;
