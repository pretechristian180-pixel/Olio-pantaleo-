-- =====================================================================
-- L'admin della piattaforma decide le automazioni di ogni agenzia:
-- - interruttore generale per agenzia (agencies.automazioni_attive): spento = non parte nulla
-- - ogni automazione accesa/spenta, e "bloccata" perché il titolare non possa cambiarla
-- - alla creazione: consigliate / solo promemoria interni / tutte spente
-- =====================================================================

alter table public.agencies add column if not exists automazioni_attive boolean not null default true;
alter table public.automations add column if not exists bloccata boolean not null default false;

-- Il titolare non cambia un'automazione bloccata dall'admin (né accende nulla se l'agenzia ha le automazioni spente)
create or replace function public.automations_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_platform_admin() or (select auth.uid()) is null then return new; end if;
  if old.bloccata and new.attiva is distinct from old.attiva then
    raise exception 'Questa automazione è gestita da Mattonio: per cambiarla scrivi all''assistenza' using errcode = '42501';
  end if;
  if new.attiva and not old.attiva and not (select automazioni_attive from public.agencies where id = new.agency_id) then
    raise exception 'Le automazioni della tua agenzia sono disattivate: per riattivarle scrivi all''assistenza' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger automations_guard before update on public.automations for each row execute function public.automations_guard();
revoke execute on function public.automations_guard() from public, anon, authenticated;

-- Il motore salta le agenzie con le automazioni spente
do $patch$
declare def text;
begin
  def := pg_get_functiondef('public.automation_on_event()'::regprocedure);
  def := replace(def, $r$where x.agency_id = (r ->> 'agency_id')::uuid and x.attiva and x.trigger_entita = entita$r$,
                      $r$where x.agency_id = (r ->> 'agency_id')::uuid and x.attiva and x.trigger_entita = entita
             and exists (select 1 from public.agencies g where g.id = x.agency_id and g.automazioni_attive)$r$);
  if position('g.automazioni_attive' in def) = 0 then raise exception 'automation_on_event: modifica non applicata'; end if;
  execute def;

  def := pg_get_functiondef('public.automation_sweep()'::regprocedure);
  def := replace(def, $r$for a in select * from public.automations where attiva and trigger_tipo in ('data_campo', 'inattivita', 'periodico', 'data_fissa') loop$r$,
                      $r$for a in select * from public.automations x where x.attiva and x.trigger_tipo in ('data_campo', 'inattivita', 'periodico', 'data_fissa')
             and exists (select 1 from public.agencies g where g.id = x.agency_id and g.automazioni_attive) loop$r$);
  if position('g.automazioni_attive' in def) = 0 then raise exception 'automation_sweep: modifica non applicata'; end if;
  execute def;

  def := pg_get_functiondef('public.automation_prepare(uuid)'::regprocedure);
  def := replace(def, $r$  if not ag.attiva then return jsonb_build_object('esito', 'rimanda', 'quando', now() + interval '1 day', 'motivo', 'Agenzia sospesa'); end if;$r$,
                      $r$  if not ag.attiva then return jsonb_build_object('esito', 'rimanda', 'quando', now() + interval '1 day', 'motivo', 'Agenzia sospesa'); end if;
  if not ag.automazioni_attive then return jsonb_build_object('esito', 'annulla', 'motivo', 'Automazioni disattivate per l''agenzia'); end if;$r$);
  if position('ag.automazioni_attive' in def) = 0 then raise exception 'automation_prepare: modifica non applicata'; end if;
  execute def;
end $patch$;

-- ---------- Funzioni dell'admin ----------
create or replace function public.admin_agency_automations(aid uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_platform_admin();
  return jsonb_build_object(
    'attive', (select automazioni_attive from public.agencies where id = aid),
    'automazioni', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'nome', a.nome, 'descrizione', a.descrizione, 'attiva', a.attiva,
                                                                 'bloccata', a.bloccata, 'ricetta', a.ricetta_codice, 'azione', a.azione_tipo)
                                              order by a.ricetta_codice is null, a.created_at)
                             from public.automations a where a.agency_id = aid), '[]'));
end $$;

create or replace function public.admin_set_agency_automations(aid uuid, p_attive boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_platform_admin();
  update public.agencies set automazioni_attive = p_attive where id = aid;
  if not found then raise exception 'Agenzia non trovata' using errcode = 'P0002'; end if;
  if not p_attive then
    update public.automation_runs set stato = 'annullata', motivo = 'Automazioni disattivate per l''agenzia'
    where agency_id = aid and stato = 'in_attesa';
  end if;
end $$;

create or replace function public.admin_set_automation(p_id uuid, p_attiva boolean, p_bloccata boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_platform_admin();
  update public.automations set attiva = p_attiva, bloccata = p_bloccata where id = p_id;
  if not found then raise exception 'Automazione non trovata' using errcode = 'P0002'; end if;
  if not p_attiva then
    update public.automation_runs set stato = 'annullata', motivo = 'Automazione spenta' where automation_id = p_id and stato = 'in_attesa';
  end if;
end $$;

-- Scelta rapida (alla creazione o dopo): consigliate = come le ricette appena installate
create or replace function public.admin_apply_automation_preset(aid uuid, p_preset text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_platform_admin();
  if p_preset not in ('consigliate', 'solo_promemoria', 'spente') then raise exception 'Scelta non valida'; end if;
  if p_preset = 'spente' then
    perform public.admin_set_agency_automations(aid, false);
    return;
  end if;
  update public.agencies set automazioni_attive = true where id = aid;
  if p_preset = 'solo_promemoria' then
    -- Nessun messaggio ai clienti: restano solo cose da fare e avvisi interni
    update public.automations set attiva = azione_tipo in ('task', 'notifica_interna', 'evento_agenda', 'cambio_temperatura')
    where agency_id = aid;
  else
    update public.automations set attiva = ricetta_codice in ('lead_benvenuto', 'lead_non_richiamato', 'promemoria_visita', 'feedback_visita',
      'report_proprietario', 'immobile_fermo', 'incarico_scadenza', 'acquisizione_ferma', 'documenti_rogito', 'cliente_non_sentito')
    where agency_id = aid and ricetta_codice is not null;
  end if;
end $$;

revoke execute on function public.admin_agency_automations(uuid), public.admin_set_agency_automations(uuid, boolean),
  public.admin_set_automation(uuid, boolean, boolean), public.admin_apply_automation_preset(uuid, text) from public, anon;
grant execute on function public.admin_agency_automations(uuid), public.admin_set_agency_automations(uuid, boolean),
  public.admin_set_automation(uuid, boolean, boolean), public.admin_apply_automation_preset(uuid, text) to authenticated;
