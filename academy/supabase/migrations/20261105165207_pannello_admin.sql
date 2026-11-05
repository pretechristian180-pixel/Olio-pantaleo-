-- Pannello admin: numeri, studenti, accesso manuale, domande.
-- Funzioni SECURITY DEFINER perché leggono le email da auth.users: ognuna controlla per prima
-- cosa che chi chiama sia staff (o admin) di quell'academy.

-- ---------------------------------------------------------------------------
-- Numeri della panoramica
-- ---------------------------------------------------------------------------
create or replace function public.admin_overview(p_tenant uuid)
returns table (
  vendite_mese_cents bigint,
  ordini_mese integer,
  vendite_totali_cents bigint,
  studenti_totali integer,
  studenti_attivi integer,
  completamento_medio integer,
  domande_aperte integer,
  lezione_abbandoni text,
  lezione_abbandoni_corso text
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_staff(p_tenant) then
    raise exception 'Non autorizzato' using errcode = '42501';
  end if;
  return query
  with ordini as (
    select o.importo_cents, o.pagato_il
    from public.orders o
    where o.tenant_id = p_tenant and o.stato = 'pagato'
  ),
  lezioni_corso as (
    select l.course_id, count(*)::numeric as n
    from public.lessons l join public.courses c on c.id = l.course_id
    where c.tenant_id = p_tenant
    group by l.course_id
  ),
  completamento as (
    select e.user_id, e.course_id,
      coalesce(100 * count(lp.lesson_id) filter (where lp.completata) / nullif(lc.n, 0), 0) as perc
    from public.enrollments e
    join lezioni_corso lc on lc.course_id = e.course_id
    left join public.lessons l on l.course_id = e.course_id
    left join public.lesson_progress lp on lp.lesson_id = l.id and lp.user_id = e.user_id
    where e.tenant_id = p_tenant
    group by e.user_id, e.course_id, lc.n
  ),
  -- Ultima lezione toccata da ogni iscritto, se ferma da più di 7 giorni e non completata.
  ultime as (
    select distinct on (lp.user_id, l.course_id) lp.lesson_id, lp.completata, lp.aggiornato_il
    from public.lesson_progress lp
    join public.lessons l on l.id = lp.lesson_id
    join public.courses c on c.id = l.course_id
    where c.tenant_id = p_tenant
    order by lp.user_id, l.course_id, lp.aggiornato_il desc, l.ordine desc
  ),
  abbandoni as (
    select u.lesson_id, count(*) as n
    from ultime u
    where not u.completata and u.aggiornato_il < now() - interval '7 days'
    group by u.lesson_id
    order by n desc
    limit 1
  )
  select
    coalesce((select sum(importo_cents) from ordini where pagato_il >= date_trunc('month', now())), 0)::bigint,
    (select count(*) from ordini where pagato_il >= date_trunc('month', now()))::integer,
    coalesce((select sum(importo_cents) from ordini), 0)::bigint,
    (select count(*) from public.memberships m where m.tenant_id = p_tenant and m.ruolo = 'student')::integer,
    (select count(distinct lp.user_id)
       from public.lesson_progress lp
       join public.lessons l on l.id = lp.lesson_id
       join public.courses c on c.id = l.course_id
      where c.tenant_id = p_tenant and lp.aggiornato_il >= now() - interval '30 days')::integer,
    (select round(avg(perc))::integer from completamento),
    (select count(*) from public.questions q where q.tenant_id = p_tenant and q.stato = 'aperta')::integer,
    (select l.titolo from abbandoni a join public.lessons l on l.id = a.lesson_id),
    (select c.titolo from abbandoni a join public.lessons l on l.id = a.lesson_id
       join public.courses c on c.id = l.course_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Elenco studenti con email, corsi e avanzamento
-- ---------------------------------------------------------------------------
create or replace function public.admin_students(p_tenant uuid, p_cerca text default null)
returns table (
  user_id uuid,
  nome text,
  cognome text,
  email text,
  ruolo public.user_role,
  iscritto_il timestamptz,
  ultima_attivita timestamptz,
  corsi integer,
  completamento integer,
  consenso_marketing boolean
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_cerca text := nullif(trim(coalesce(p_cerca, '')), '');
begin
  if not private.is_staff(p_tenant) then
    raise exception 'Non autorizzato' using errcode = '42501';
  end if;
  return query
  select
    m.user_id,
    p.nome,
    p.cognome,
    u.email::text,
    m.ruolo,
    m.creato_il,
    (select max(lp.aggiornato_il)
       from public.lesson_progress lp
       join public.lessons l on l.id = lp.lesson_id
       join public.courses c on c.id = l.course_id
      where lp.user_id = m.user_id and c.tenant_id = p_tenant),
    (select count(*) from public.enrollments e where e.user_id = m.user_id and e.tenant_id = p_tenant)::integer,
    (select round(100.0 * count(*) filter (where lp.completata) / nullif(count(l.id), 0))::integer
       from public.enrollments e
       join public.lessons l on l.course_id = e.course_id
       left join public.lesson_progress lp on lp.lesson_id = l.id and lp.user_id = e.user_id
      where e.user_id = m.user_id and e.tenant_id = p_tenant),
    m.consenso_marketing
  from public.memberships m
  join public.profiles p on p.id = m.user_id
  join auth.users u on u.id = m.user_id
  where m.tenant_id = p_tenant
    and (
      v_cerca is null
      or u.email ilike '%' || v_cerca || '%'
      or coalesce(p.nome, '') || ' ' || coalesce(p.cognome, '') ilike '%' || v_cerca || '%'
    )
  order by m.creato_il desc
  limit 500;
end;
$$;

-- Corsi a cui è iscritto uno studente, con avanzamento (per la scheda studente).
create or replace function public.admin_student_courses(p_tenant uuid, p_user uuid)
returns table (
  course_id uuid,
  titolo text,
  fonte public.enrollment_source,
  iscritto_il timestamptz,
  lezioni integer,
  completate integer
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_staff(p_tenant) then
    raise exception 'Non autorizzato' using errcode = '42501';
  end if;
  return query
  select e.course_id, c.titolo, e.fonte, e.creato_il,
    (select count(*) from public.lessons l where l.course_id = e.course_id)::integer,
    (select count(*) from public.lesson_progress lp join public.lessons l on l.id = lp.lesson_id
      where l.course_id = e.course_id and lp.user_id = e.user_id and lp.completata)::integer
  from public.enrollments e
  join public.courses c on c.id = e.course_id
  where e.tenant_id = p_tenant and e.user_id = p_user
  order by e.creato_il desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Accesso manuale a un corso (bonifico, omaggio, cliente aziendale)
-- ---------------------------------------------------------------------------
create or replace function public.admin_grant_access(p_course uuid, p_email text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_tenant uuid;
  v_user uuid;
begin
  select c.tenant_id into v_tenant from public.courses c where c.id = p_course;
  if v_tenant is null or not private.is_staff(v_tenant) then
    raise exception 'Non autorizzato' using errcode = '42501';
  end if;
  select u.id into v_user from auth.users u where lower(u.email) = lower(trim(p_email)) limit 1;
  if v_user is null then
    return 'nessun_account';
  end if;
  insert into public.memberships (user_id, tenant_id, ruolo)
  values (v_user, v_tenant, 'student')
  on conflict (user_id, tenant_id) do nothing;
  insert into public.enrollments (user_id, course_id, fonte)
  values (v_user, p_course, 'manuale')
  on conflict (user_id, course_id) do nothing;
  return 'ok';
end;
$$;

-- ---------------------------------------------------------------------------
-- Domande degli studenti, con contesto
-- ---------------------------------------------------------------------------
create or replace function public.admin_questions(p_tenant uuid, p_stato public.question_status default null)
returns table (
  id uuid,
  testo text,
  stato public.question_status,
  creato_il timestamptz,
  autore text,
  corso text,
  corso_slug text,
  lezione text,
  lezione_slug text,
  risposte integer
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_staff(p_tenant) then
    raise exception 'Non autorizzato' using errcode = '42501';
  end if;
  return query
  select q.id, q.testo, q.stato, q.creato_il,
    trim(coalesce(p.nome, '') || ' ' || coalesce(p.cognome, '')),
    c.titolo, c.slug, l.titolo, l.slug,
    (select count(*) from public.answers a where a.question_id = q.id)::integer
  from public.questions q
  join public.courses c on c.id = q.course_id
  join public.lessons l on l.id = q.lesson_id
  left join public.profiles p on p.id = q.user_id
  where q.tenant_id = p_tenant and (p_stato is null or q.stato = p_stato)
  order by (q.stato = 'aperta') desc, q.creato_il desc
  limit 300;
end;
$$;

revoke all on function public.admin_overview(uuid) from public, anon;
revoke all on function public.admin_students(uuid, text) from public, anon;
revoke all on function public.admin_student_courses(uuid, uuid) from public, anon;
revoke all on function public.admin_grant_access(uuid, text) from public, anon;
revoke all on function public.admin_questions(uuid, public.question_status) from public, anon;
grant execute on function public.admin_overview(uuid) to authenticated;
grant execute on function public.admin_students(uuid, text) to authenticated;
grant execute on function public.admin_student_courses(uuid, uuid) to authenticated;
grant execute on function public.admin_grant_access(uuid, text) to authenticated;
grant execute on function public.admin_questions(uuid, public.question_status) to authenticated;
