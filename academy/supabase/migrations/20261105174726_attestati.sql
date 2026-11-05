-- Rilascio degli attestati: quando lo studente ha completato tutte le lezioni del corso.
-- Lo studente non può inserire attestati da sé: passa da questa funzione, che fa i controlli.

create or replace function public.claim_certificate(p_course uuid)
returns table (codice text, rilasciato_il timestamptz, nuovo boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_totale integer;
  v_fatte integer;
  v_nome text;
  v_codice text;
  v_il timestamptz;
begin
  if v_user is null then
    raise exception 'Accesso richiesto' using errcode = '42501';
  end if;

  select ce.codice, ce.rilasciato_il into v_codice, v_il
  from public.certificates ce where ce.user_id = v_user and ce.course_id = p_course;
  if v_codice is not null then
    return query select v_codice, v_il, false;
    return;
  end if;

  if not private.has_course_access(p_course) then
    raise exception 'Nessun accesso al corso' using errcode = '42501';
  end if;
  select count(*) into v_totale from public.lessons l where l.course_id = p_course;
  select count(*) into v_fatte
  from public.lesson_progress lp join public.lessons l on l.id = lp.lesson_id
  where l.course_id = p_course and lp.user_id = v_user and lp.completata;
  if v_totale = 0 or v_fatte < v_totale then
    return; -- corso non ancora completato: nessuna riga
  end if;

  select nullif(trim(coalesce(p.nome, '') || ' ' || coalesce(p.cognome, '')), '') into v_nome
  from public.profiles p where p.id = v_user;
  if v_nome is null then
    raise exception 'Nome mancante' using errcode = 'P0001';
  end if;

  insert into public.certificates (user_id, course_id, nome_intestatario)
  values (v_user, p_course, left(v_nome, 200))
  on conflict (user_id, course_id) do nothing
  returning certificates.codice, certificates.rilasciato_il into v_codice, v_il;

  if v_codice is null then
    select ce.codice, ce.rilasciato_il into v_codice, v_il
    from public.certificates ce where ce.user_id = v_user and ce.course_id = p_course;
    return query select v_codice, v_il, false;
  else
    return query select v_codice, v_il, true;
  end if;
end;
$$;

-- Dati stampati sull'attestato (pubblici con il codice): servono per PDF e pagina di verifica.
create or replace function public.certificate_details(p_codice text)
returns table (
  codice text,
  nome_intestatario text,
  corso text,
  academy text,
  academy_slug text,
  colore text,
  docente text,
  lezioni integer,
  durata_sec integer,
  rilasciato_il timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select ce.codice, ce.nome_intestatario, co.titolo, t.nome, t.slug,
    coalesce(t.brand ->> 'primary', '#0042ed'),
    i.nome,
    (select count(*) from public.lessons l where l.course_id = co.id)::integer,
    (select coalesce(sum(l.durata_sec), 0) from public.lessons l where l.course_id = co.id)::integer,
    ce.rilasciato_il
  from public.certificates ce
  join public.courses co on co.id = ce.course_id
  join public.tenants t on t.id = co.tenant_id
  left join public.instructors i on i.id = co.docente_id
  where ce.codice = upper(trim(p_codice));
$$;

revoke all on function public.claim_certificate(uuid) from public, anon;
grant execute on function public.claim_certificate(uuid) to authenticated;
revoke all on function public.certificate_details(text) from public;
grant execute on function public.certificate_details(text) to anon, authenticated;
