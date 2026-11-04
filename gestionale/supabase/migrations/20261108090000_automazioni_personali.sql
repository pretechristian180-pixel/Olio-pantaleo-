-- Automazioni create dall'agenzia in autonomia: il motore applica i filtri anche alle esecuzioni
-- "a calendario", registra correttamente le azioni dei lead e rispetta l'interruttore dell'admin.

-- 1) Le azioni nate da un lead (cose da fare, messaggi) si collegano al contatto e all'immobile del lead
do $patch$
declare def text;
begin
  def := pg_get_functiondef('public.automation_finish(uuid, text, text, text, text, text)'::regprocedure);
  def := replace(def, $r$    when 'match' then (select to_jsonb(x) from public.matches x where x.id = run.entita_id)
  end;$r$, $r$    when 'match' then (select to_jsonb(x) from public.matches x where x.id = run.entita_id)
    when 'lead' then (select to_jsonb(x) from public.leads x where x.id = run.entita_id)
  end;$r$);
  if position('public.leads x' in def) = 0 then raise exception 'automation_finish: modifica non applicata'; end if;
  execute def;

  -- 2) I filtri scelti dall'agenzia (tipo, fonte, interesse, contratto…) valgono anche per compleanni, clienti non sentiti,
  --    immobili senza visite e invii periodici
  def := pg_get_functiondef('public.automation_sweep()'::regprocedure);
  def := replace(def, $r$      where c.agency_id = a.agency_id and c.data_nascita is not null and x.giorno >= oggi$r$,
                      $r$      where c.agency_id = a.agency_id and c.data_nascita is not null and x.giorno >= oggi
        and public.auto_conditions_ok(a.trigger_condizioni, to_jsonb(c))$r$);
  def := replace(def, $r$      where p.agency_id = a.agency_id and p.stato = 'disponibile' and p.created_at < now() - make_interval(days => giorni)
        and not exists$r$,
                      $r$      where p.agency_id = a.agency_id and p.stato = 'disponibile' and p.created_at < now() - make_interval(days => giorni)
        and public.auto_conditions_ok(a.trigger_condizioni, to_jsonb(p))
        and not exists$r$);
  def := replace(def, $r$        and c.created_at < now() - make_interval(days => giorni)
        and not exists$r$,
                      $r$        and c.created_at < now() - make_interval(days => giorni)
        and public.auto_conditions_ok(a.trigger_condizioni, to_jsonb(c))
        and (not a.richiede_consenso or c.consenso_marketing)
        and not exists$r$);
  def := replace(def, $r$      where p.agency_id = a.agency_id and p.stato = 'disponibile' and p.owner_id is not null
        and p.created_at < now() - make_interval(days => giorni)$r$,
                      $r$      where p.agency_id = a.agency_id and p.stato = 'disponibile' and p.owner_id is not null
        and p.created_at < now() - make_interval(days => giorni)
        and public.auto_conditions_ok(a.trigger_condizioni, to_jsonb(p))$r$);
  if (length(def) - length(replace(def, 'auto_conditions_ok(a.trigger_condizioni', ''))) / length('auto_conditions_ok(a.trigger_condizioni') < 6 then
    raise exception 'automation_sweep: modifica non applicata';
  end if;
  execute def;
end $patch$;

-- 3) Se l'admin ha spento le automazioni dell'agenzia, una nuova automazione nasce spenta
create or replace function public.automations_insert_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() and (select auth.uid()) is not null
     and not coalesce((select automazioni_attive from public.agencies where id = new.agency_id), true) then
    new.attiva := false;
  end if;
  return new;
end $$;
create trigger automations_insert_guard before insert on public.automations for each row execute function public.automations_insert_guard();
revoke execute on function public.automations_insert_guard() from public, anon, authenticated;
