-- =====================================================================
-- ATTIVITÀ E SQUADRA
-- - Cose da fare con stato (da iniziare, in corso, fatta), priorità, note e chi le ha create
-- - Si possono assegnare ai colleghi: chi le crea le segue anche dopo averle assegnate
-- - Cruscotto della squadra: il titolare vede tutti, l'agente solo i propri numeri
-- =====================================================================

alter table public.tasks add column if not exists stato text not null default 'da_iniziare' check (stato in ('da_iniziare', 'in_corso', 'fatta'));
alter table public.tasks add column if not exists priorita text not null default 'normale' check (priorita in ('normale', 'alta'));
alter table public.tasks add column if not exists note text check (note is null or length(note) <= 1000);
alter table public.tasks add column if not exists creato_da uuid default auth.uid();
alter table public.tasks add column if not exists completato_at timestamptz;
alter table public.tasks add column if not exists updated_at timestamptz not null default now();
update public.tasks set stato = 'fatta', completato_at = coalesce(completato_at, created_at) where completato and stato <> 'fatta';
create index if not exists tasks_creato_da_idx on public.tasks (creato_da, agency_id);
create index if not exists tasks_assegnato_stato_idx on public.tasks (assegnato_a, stato);
alter table public.tasks add constraint tasks_creato_da_fkey foreign key (creato_da, agency_id) references public.profiles (id, agency_id) on delete set null (creato_da);

-- "Fatta" e la spunta restano sempre allineate (l'app vecchia usa la spunta, la nuova lo stato)
create or replace function public.tasks_stato_sync()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.completato then new.stato := 'fatta'; elsif new.stato = 'fatta' then new.completato := true; end if;
  elsif new.completato is distinct from old.completato then
    new.stato := case when new.completato then 'fatta' when old.stato = 'fatta' then 'da_iniziare' else new.stato end;
  elsif new.stato is distinct from old.stato then
    new.completato := new.stato = 'fatta';
  end if;
  new.completato_at := case when new.completato then coalesce(new.completato_at, now()) end;
  new.updated_at := now();
  return new;
end $$;
create trigger tasks_stato_sync before insert or update on public.tasks for each row execute function public.tasks_stato_sync();
revoke execute on function public.tasks_stato_sync() from public, anon, authenticated;

-- Chi ha creato una cosa da fare la vede e la segue anche se l'ha data a un collega
alter policy "task: lettura propri o titolare" on public.tasks
  using (agency_id = (select public.get_my_agency_id()) and ((select public.is_titolare()) or assegnato_a = (select auth.uid()) or creato_da = (select auth.uid())));
alter policy "task: inserimento" on public.tasks
  with check (agency_id = (select public.get_my_agency_id()) and ((select public.is_titolare()) or assegnato_a = (select auth.uid())
              or (creato_da = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = assegnato_a and p.agency_id = (select public.get_my_agency_id()) and p.attivo))));
alter policy "task: modifica propri o titolare" on public.tasks
  using (agency_id = (select public.get_my_agency_id()) and ((select public.is_titolare()) or assegnato_a = (select auth.uid()) or creato_da = (select auth.uid())))
  with check (agency_id = (select public.get_my_agency_id()) and ((select public.is_titolare()) or assegnato_a = (select auth.uid()) or creato_da = (select auth.uid())));
alter policy "task: eliminazione propri o titolare" on public.tasks
  using (agency_id = (select public.get_my_agency_id()) and ((select public.is_titolare()) or assegnato_a = (select auth.uid()) or creato_da = (select auth.uid())));

-- Nessuno si attribuisce una cosa da fare "creata da" un altro
create or replace function public.tasks_creato_da_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null then
    if tg_op = 'INSERT' then new.creato_da := auth.uid();
    else new.creato_da := old.creato_da; end if;
  end if;
  return new;
end $$;
create trigger tasks_creato_da_guard before insert or update on public.tasks for each row execute function public.tasks_creato_da_guard();
revoke execute on function public.tasks_creato_da_guard() from public, anon, authenticated;

-- ---------- Cruscotto della squadra ----------
create or replace function public.squadra_cruscotto(p_giorni integer)
returns table (
  agente_id uuid, nome text, ruolo text, chiamate integer, messaggi integer, visite integer, appuntamenti_prossimi integer,
  nuovi_contatti integer, lead integer, lead_risposta_minuti integer, incarichi integer, proposte integer, rogiti integer,
  cose_fatte integer, cose_aperte integer, cose_in_ritardo integer, ultima_attivita timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare
  ag uuid := public.get_my_agency_id();
  dal timestamptz := now() - make_interval(days => least(greatest(coalesce(p_giorni, 7), 1), 365));
  oggi date := (now() at time zone 'Europe/Rome')::date;
begin
  if ag is null then raise exception 'Non autorizzato' using errcode = '42501'; end if;
  return query
  select p.id, btrim(p.nome || ' ' || p.cognome), p.ruolo::text,
    (select count(*) from public.activities a where a.utente_id = p.id and a.tipo = 'chiamata' and a.created_at >= dal)::int,
    (select count(*) from public.activities a where a.utente_id = p.id and a.tipo in ('whatsapp', 'email') and a.created_at >= dal)::int,
    (select count(*) from public.appointments x where x.agente_id = p.id and x.tipo = 'visita' and x.inizio >= dal and x.inizio < now())::int,
    (select count(*) from public.appointments x where x.agente_id = p.id and x.inizio >= now() and x.inizio < now() + interval '7 days')::int,
    (select count(*) from public.contacts c where c.agente_id = p.id and c.created_at >= dal and not c.importato)::int,
    (select count(*) from public.leads l where l.agente_id = p.id and l.created_at >= dal and l.stato <> 'spam' and l.canale <> 'prova')::int,
    (select round(extract(epoch from percentile_cont(0.5) within group (order by l.primo_contatto_at - l.created_at)) / 60)::int
       from public.leads l where l.agente_id = p.id and l.created_at >= dal and l.primo_contatto_at is not null),
    (select count(*) from public.acquisitions q where q.agente_id = p.id and q.fase = 'incarico_firmato' and q.fase_dal >= dal)::int,
    (select count(*) from public.deals d where d.agente_id = p.id and d.fase in ('proposta', 'compromesso') and d.updated_at >= dal)::int,
    (select count(*) from public.deals d where d.agente_id = p.id and d.fase = 'rogito' and d.updated_at >= dal)::int,
    (select count(*) from public.tasks t where t.assegnato_a = p.id and t.completato_at >= dal)::int,
    (select count(*) from public.tasks t where t.assegnato_a = p.id and not t.completato)::int,
    (select count(*) from public.tasks t where t.assegnato_a = p.id and not t.completato and t.scadenza < oggi)::int,
    (select max(a.created_at) from public.activities a where a.utente_id = p.id)
  from public.profiles p
  where p.agency_id = ag and p.attivo and (public.is_titolare() or p.id = auth.uid())
  order by p.ruolo desc, p.nome;
end $$;
revoke execute on function public.squadra_cruscotto(integer) from public, anon;
grant execute on function public.squadra_cruscotto(integer) to authenticated;
