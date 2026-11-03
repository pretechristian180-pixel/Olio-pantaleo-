-- =====================================================================
-- ASSISTENTE AI: domande in linguaggio naturale sui propri dati e testi pronti.
-- L'assistente legge SOLO con le funzioni qui sotto, eseguite con i permessi di chi chiede
-- (security invoker: valgono le stesse regole RLS dell'app). Non scrive mai nulla.
-- La chiave AI resta nella Edge Function "assistente". Limite di domande al giorno.
-- =====================================================================

-- ---------- Limite di utilizzo ----------
create table public.assistant_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  agency_id uuid not null references public.agencies (id) on delete cascade,
  giorno date not null default (now() at time zone 'Europe/Rome')::date,
  domande integer not null default 0,
  primary key (user_id, giorno)
);
create index on public.assistant_usage (agency_id, giorno);
alter table public.assistant_usage enable row level security;
create policy "uso assistente: il proprio" on public.assistant_usage for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update on public.assistant_usage from authenticated, anon;

-- Conta una domanda; errore se si supera il limite (60 al giorno a persona, 300 per agenzia)
create or replace function public.assistente_consuma()
returns integer language plpgsql security definer set search_path = '' as $$
declare ag uuid := public.get_my_agency_id(); oggi date := (now() at time zone 'Europe/Rome')::date; n integer;
begin
  if ag is null then raise exception 'Non autorizzato' using errcode = '42501'; end if;
  if (select coalesce(sum(domande), 0) from public.assistant_usage where agency_id = ag and giorno = oggi) >= 300 then
    raise exception 'La tua agenzia ha usato tutte le domande di oggi: riprova domani' using errcode = '54000';
  end if;
  insert into public.assistant_usage (user_id, agency_id, giorno, domande) values (auth.uid(), ag, oggi, 1)
  on conflict (user_id, giorno) do update set domande = public.assistant_usage.domande + 1
  returning domande into n;
  if n > 60 then raise exception 'Hai fatto molte domande oggi: riprova domani' using errcode = '54000'; end if;
  return 60 - n;
end $$;
revoke execute on function public.assistente_consuma() from public, anon;
grant execute on function public.assistente_consuma() to authenticated;

-- ---------- Letture (con i permessi di chi chiede) ----------

-- Clienti da risentire: nessun contatto (chiamata, WhatsApp, email, visita) da N giorni
create or replace function public.assistente_da_risentire(p_giorni integer, p_tipo text)
returns table (id uuid, nome text, telefono text, tipo text, temperatura text, ultimo_contatto timestamptz, giorni integer)
language sql stable security invoker set search_path = '' as $$
  select c.id, btrim(c.nome || ' ' || c.cognome), c.telefono, c.tipo::text, c.temperatura::text, u.ultimo,
         ((now()::date - coalesce(u.ultimo, c.created_at)::date))::int
  from public.contacts c
  left join lateral (select max(a.created_at) ultimo from public.activities a
                     where a.contact_id = c.id and a.utente_id is not null and a.tipo in ('chiamata', 'whatsapp', 'email', 'visita')) u on true
  where coalesce(u.ultimo, c.created_at) < now() - make_interval(days => greatest(1, coalesce(p_giorni, 30)))
    and (p_tipo is null or c.tipo::text = p_tipo or (p_tipo = 'acquirente' and c.tipo::text in ('acquirente', 'entrambi', 'inquilino')))
  order by case c.temperatura when 'caldo' then 0 when 'tiepido' then 1 else 2 end, coalesce(u.ultimo, c.created_at)
  limit 40
$$;

-- Immobili con i numeri che servono per decidere (giorni sul mercato, visite, richieste, incarico, report)
create or replace function public.assistente_immobili(p_stato text, p_citta text, p_contratto text, p_prezzo_min numeric, p_prezzo_max numeric, p_ordine text, p_limite integer)
returns table (id uuid, titolo text, indirizzo text, citta text, zona text, prezzo numeric, contratto text, stato text, mq integer, locali integer,
               giorni_sul_mercato integer, visite_30_giorni integer, ultima_visita timestamptz, visite_totali integer, richieste_compatibili integer,
               scadenza_incarico date, ultimo_report timestamptz, proprietario text)
language sql stable security invoker set search_path = '' as $$
  select p.id, p.titolo, p.indirizzo, p.citta, p.zona, p.prezzo, p.contratto::text, p.stato::text, p.mq, p.locali,
         ((now() at time zone 'Europe/Rome')::date - coalesce(p.data_incarico, p.created_at::date))::int,
         (select count(*) from public.appointments a where a.property_id = p.id and a.tipo = 'visita' and a.inizio between now() - interval '30 days' and now())::int,
         (select max(a.inizio) from public.appointments a where a.property_id = p.id and a.tipo = 'visita' and a.inizio < now()),
         (select count(*) from public.appointments a where a.property_id = p.id and a.tipo = 'visita' and a.inizio < now())::int,
         (select count(*) from public.matches m where m.property_id = p.id and m.stato <> 'scartato')::int,
         p.scadenza_incarico,
         (select max(r.created_at) from public.owner_reports r where r.property_id = p.id),
         (select btrim(o.nome || ' ' || o.cognome) from public.contacts o where o.id = p.owner_id)
  from public.properties p
  where (p_stato is null or p.stato::text = p_stato)
    and (p_citta is null or p.citta ilike '%' || p_citta || '%' or p.zona ilike '%' || p_citta || '%')
    and (p_contratto is null or p.contratto::text = p_contratto)
    and (p_prezzo_min is null or p.prezzo >= p_prezzo_min)
    and (p_prezzo_max is null or p.prezzo <= p_prezzo_max)
  order by
    case when p_ordine = 'meno_visite' then (select count(*) from public.appointments a where a.property_id = p.id and a.tipo = 'visita' and a.inizio between now() - interval '30 days' and now()) end asc nulls last,
    case when p_ordine = 'poche_richieste' then (select count(*) from public.matches m where m.property_id = p.id and m.stato <> 'scartato') end asc nulls last,
    case when p_ordine = 'scadenza_incarico' then p.scadenza_incarico end asc nulls last,
    case when p_ordine = 'prezzo' then p.prezzo end asc nulls last,
    coalesce(p.data_incarico, p.created_at::date) asc
  limit least(greatest(coalesce(p_limite, 20), 1), 50)
$$;

grant execute on function public.assistente_da_risentire(integer, text), public.assistente_immobili(text, text, text, numeric, numeric, text, integer) to authenticated;
revoke execute on function public.assistente_da_risentire(integer, text), public.assistente_immobili(text, text, text, numeric, numeric, text, integer) from public, anon;
