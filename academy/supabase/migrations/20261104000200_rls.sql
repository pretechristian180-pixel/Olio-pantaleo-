-- Nexora Academy — Row Level Security
-- Regola generale:
--   * chiunque legge i corsi pubblicati, i moduli e le lezioni in anteprima gratuita;
--   * lo studente legge i contenuti dei corsi a cui ha accesso e scrive solo i propri dati;
--   * instructor e admin gestiscono tutto nel proprio tenant.
-- Le funzioni di controllo stanno nello schema "private", non esposto dalle API.

grant usage on schema private to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Funzioni di controllo
-- ---------------------------------------------------------------------------
create or replace function private.is_staff(p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.tenant_id = p_tenant
      and p.ruolo in ('instructor', 'admin')
  );
$$;

create or replace function private.is_admin(p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.tenant_id = p_tenant and p.ruolo = 'admin'
  );
$$;

create or replace function private.course_tenant(p_course uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.tenant_id from public.courses c where c.id = p_course;
$$;

create or replace function private.course_is_published(p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.courses c where c.id = p_course and c.stato = 'published');
$$;

-- Accesso pieno a un corso: iscrizione valida o abbonamento attivo del tenant.
create or replace function private.has_course_access(p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    exists (
      select 1 from public.enrollments e
      where e.user_id = auth.uid()
        and e.course_id = p_course
        and (e.scade_il is null or e.scade_il > now())
    )
    or exists (
      select 1
      from public.subscriptions s
      join public.plans pl on pl.id = s.plan_id
      join public.courses c on c.tenant_id = pl.tenant_id
      where s.user_id = auth.uid()
        and c.id = p_course
        and c.stato = 'published'
        and s.stato in ('active', 'trialing')
        and (s.periodo_fine is null or s.periodo_fine > now())
    )
  );
$$;

create or replace function private.can_view_lesson(p_lesson uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.lessons l
    join public.courses c on c.id = l.course_id
    where l.id = p_lesson
      and (
        private.is_staff(c.tenant_id)
        or private.has_course_access(c.id)
        or (l.is_free_preview and c.stato = 'published')
      )
  );
$$;

create or replace function private.lesson_tenant(p_lesson uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.tenant_id
  from public.lessons l
  join public.courses c on c.id = l.course_id
  where l.id = p_lesson;
$$;

create or replace function private.question_context(p_question uuid, out tenant_id uuid, out course_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select q.tenant_id, q.course_id from public.questions q where q.id = p_question;
$$;

revoke all on all functions in schema private from public;
grant execute on function
  private.is_staff(uuid),
  private.is_admin(uuid),
  private.course_tenant(uuid),
  private.course_is_published(uuid),
  private.has_course_access(uuid),
  private.can_view_lesson(uuid),
  private.lesson_tenant(uuid),
  private.question_context(uuid)
to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Privilegi di base (difesa in profondità oltre alle policy)
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
grant select on
  public.tenants, public.instructors, public.courses, public.modules,
  public.lessons, public.lesson_resources, public.plans
to anon;

-- Il profilo si modifica solo nei campi personali: ruolo e tenant restano fuori.
revoke insert, update, delete on public.profiles from authenticated;
grant update (nome, cognome, avatar_url, consenso_marketing, consenso_marketing_il, ultimo_accesso_il)
  on public.profiles to authenticated;

-- Tabelle scritte solo dal server (service role).
revoke insert, update, delete on public.orders, public.subscriptions, public.certificates
  from authenticated;
revoke all on public.stripe_events from anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.instructors enable row level security;
alter table public.courses enable row level security;
alter table public.modules enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_resources enable row level security;
alter table public.orders enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.enrollments enable row level security;
alter table public.stripe_events enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.notes enable row level security;
alter table public.questions enable row level security;
alter table public.answers enable row level security;
alter table public.certificates enable row level security;

-- tenants: nome e brand sono pubblici; modifiche solo dal server.
create policy tenants_select on public.tenants
  for select to anon, authenticated using (true);

-- profiles
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or private.is_staff(tenant_id));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- instructors
create policy instructors_select on public.instructors
  for select to anon, authenticated using (true);
create policy instructors_staff_write on public.instructors
  for all to authenticated
  using (private.is_staff(tenant_id))
  with check (private.is_staff(tenant_id));

-- courses
create policy courses_select on public.courses
  for select to anon, authenticated
  using (stato = 'published' or private.is_staff(tenant_id) or private.has_course_access(id));
create policy courses_staff_insert on public.courses
  for insert to authenticated with check (private.is_staff(tenant_id));
create policy courses_staff_update on public.courses
  for update to authenticated
  using (private.is_staff(tenant_id)) with check (private.is_staff(tenant_id));
create policy courses_admin_delete on public.courses
  for delete to authenticated using (private.is_admin(tenant_id));

-- modules: i titoli dei moduli dei corsi pubblicati sono visibili a tutti (programma).
create policy modules_select on public.modules
  for select to anon, authenticated
  using (
    private.course_is_published(course_id)
    or private.has_course_access(course_id)
    or private.is_staff(private.course_tenant(course_id))
  );
create policy modules_staff_write on public.modules
  for all to authenticated
  using (private.is_staff(private.course_tenant(course_id)))
  with check (private.is_staff(private.course_tenant(course_id)));

-- lessons: contenuto completo solo con accesso; anteprime gratuite per tutti.
-- Il programma pubblico usa la funzione course_outline() qui sotto.
create policy lessons_select on public.lessons
  for select to anon, authenticated
  using (
    (is_free_preview and private.course_is_published(course_id))
    or private.has_course_access(course_id)
    or private.is_staff(private.course_tenant(course_id))
  );
create policy lessons_staff_write on public.lessons
  for all to authenticated
  using (private.is_staff(private.course_tenant(course_id)))
  with check (private.is_staff(private.course_tenant(course_id)));

-- lesson_resources
create policy lesson_resources_select on public.lesson_resources
  for select to anon, authenticated using (private.can_view_lesson(lesson_id));
create policy lesson_resources_staff_write on public.lesson_resources
  for all to authenticated
  using (private.is_staff(private.lesson_tenant(lesson_id)))
  with check (private.is_staff(private.lesson_tenant(lesson_id)));

-- orders: lettura propria o dello staff; scrittura solo dal webhook (service role).
create policy orders_select on public.orders
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_staff(tenant_id));

-- plans
create policy plans_select on public.plans
  for select to anon, authenticated using (attivo or private.is_staff(tenant_id));
create policy plans_admin_write on public.plans
  for all to authenticated
  using (private.is_admin(tenant_id)) with check (private.is_admin(tenant_id));

-- subscriptions
create policy subscriptions_select on public.subscriptions
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_staff((select pl.tenant_id from public.plans pl where pl.id = plan_id))
  );

-- enrollments: lo studente le legge; solo lo staff le crea a mano (o il webhook).
create policy enrollments_select on public.enrollments
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_staff(tenant_id));
create policy enrollments_staff_write on public.enrollments
  for all to authenticated
  using (private.is_staff(tenant_id)) with check (private.is_staff(tenant_id));

-- lesson_progress
create policy lesson_progress_select on public.lesson_progress
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_staff(private.lesson_tenant(lesson_id)));
create policy lesson_progress_insert_own on public.lesson_progress
  for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_view_lesson(lesson_id));
create policy lesson_progress_update_own on public.lesson_progress
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and private.can_view_lesson(lesson_id));
create policy lesson_progress_delete_own on public.lesson_progress
  for delete to authenticated using (user_id = (select auth.uid()));

-- notes: private, solo l'autore.
create policy notes_own on public.notes
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and private.can_view_lesson(lesson_id));

-- questions: visibili a chi ha accesso al corso; si chiede solo con accesso pieno.
create policy questions_select on public.questions
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.has_course_access(course_id)
    or private.is_staff(tenant_id)
  );
create policy questions_insert on public.questions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (private.has_course_access(course_id) or private.is_staff(tenant_id))
  );
create policy questions_update on public.questions
  for update to authenticated
  using (user_id = (select auth.uid()) or private.is_staff(tenant_id))
  with check (user_id = (select auth.uid()) or private.is_staff(tenant_id));
create policy questions_delete on public.questions
  for delete to authenticated
  using (user_id = (select auth.uid()) or private.is_staff(tenant_id));

-- answers
create policy answers_select on public.answers
  for select to authenticated
  using (exists (select 1 from public.questions q where q.id = question_id));
create policy answers_insert on public.answers
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      private.is_staff((private.question_context(question_id)).tenant_id)
      or private.has_course_access((private.question_context(question_id)).course_id)
    )
  );
create policy answers_update on public.answers
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy answers_delete on public.answers
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_staff((private.question_context(question_id)).tenant_id)
  );

-- certificates: il titolare e lo staff; la verifica pubblica passa da verify_certificate().
create policy certificates_select on public.certificates
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_staff(private.course_tenant(course_id)));

-- ---------------------------------------------------------------------------
-- Funzioni pubbliche (RPC)
-- ---------------------------------------------------------------------------

-- Programma di un corso pubblicato, senza id video né descrizioni.
create or replace function public.course_outline(p_course_id uuid)
returns table (
  module_id uuid,
  module_titolo text,
  module_ordine integer,
  lesson_id uuid,
  lesson_slug text,
  lesson_titolo text,
  durata_sec integer,
  is_free_preview boolean,
  lesson_ordine integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.titolo, m.ordine, l.id, l.slug, l.titolo, l.durata_sec, l.is_free_preview, l.ordine
  from public.courses c
  join public.modules m on m.course_id = c.id
  left join public.lessons l on l.module_id = m.id
  where c.id = p_course_id
    and (c.stato = 'published' or private.is_staff(c.tenant_id) or private.has_course_access(c.id))
  order by m.ordine, m.creato_il, l.ordine, l.creato_il;
$$;

-- Verifica pubblica di un attestato: solo i dati stampati sull'attestato.
create or replace function public.verify_certificate(p_codice text)
returns table (
  codice text,
  nome_intestatario text,
  corso_titolo text,
  rilasciato_il timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select ce.codice, ce.nome_intestatario, co.titolo, ce.rilasciato_il
  from public.certificates ce
  join public.courses co on co.id = ce.course_id
  where ce.codice = upper(trim(p_codice));
$$;

revoke all on function public.course_outline(uuid), public.verify_certificate(text) from public;
grant execute on function public.course_outline(uuid), public.verify_certificate(text)
  to anon, authenticated;
