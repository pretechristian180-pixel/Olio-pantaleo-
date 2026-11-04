-- Thread delle domande di una lezione, con il nome breve dell'autore ("Luca B.").
-- I profili restano privati: la funzione espone solo nome e iniziale del cognome,
-- e solo a chi ha accesso al corso (o allo staff del tenant).

create or replace function public.lesson_thread(p_lesson_id uuid)
returns table (
  tipo text,
  id uuid,
  question_id uuid,
  autore text,
  is_docente boolean,
  is_mio boolean,
  testo text,
  stato text,
  creato_il timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with ctx as (
    select l.id as lesson_id, c.id as course_id, c.tenant_id
    from public.lessons l
    join public.courses c on c.id = l.course_id
    where l.id = p_lesson_id
      and (private.has_course_access(c.id) or private.is_staff(c.tenant_id))
  ),
  autori as (
    select p.id,
      nullif(trim(p.nome || ' ' || coalesce(left(nullif(p.cognome, ''), 1) || '.', '')), '') as nome
    from public.profiles p
  )
  select 'domanda', q.id, q.id, coalesce(a.nome, 'Studente'), false,
         q.user_id = auth.uid(), q.testo, q.stato::text, q.creato_il
  from public.questions q
  join ctx on ctx.lesson_id = q.lesson_id
  left join autori a on a.id = q.user_id
  union all
  select 'risposta', r.id, r.question_id, coalesce(a.nome, 'Studente'), r.is_docente,
         r.user_id = auth.uid(), r.testo, null, r.creato_il
  from public.answers r
  join public.questions q on q.id = r.question_id
  join ctx on ctx.lesson_id = q.lesson_id
  left join autori a on a.id = r.user_id
  order by 9;
$$;

revoke all on function public.lesson_thread(uuid) from public, anon;
grant execute on function public.lesson_thread(uuid) to authenticated;
