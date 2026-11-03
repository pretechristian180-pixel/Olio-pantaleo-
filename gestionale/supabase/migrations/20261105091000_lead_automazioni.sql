-- I lead entrano nel motore delle Automazioni come nuova entità "lead":
-- la risposta automatica e l'allarme "nessuno ha richiamato" partono per ogni lead,
-- anche se la persona era già tra i contatti.

alter table public.automations drop constraint automations_trigger_entita_check;
alter table public.automations add constraint automations_trigger_entita_check
  check (trigger_entita in ('contact', 'property', 'deal', 'acquisition', 'appointment', 'match', 'lead'));

-- Le due funzioni del motore restano identiche, con in più il caso "lead"
do $patch$
declare def text;
begin
  def := pg_get_functiondef('public.automation_on_event()'::regprocedure);
  def := replace(def, $r$when 'matches' then 'match' end;$r$, $r$when 'matches' then 'match' when 'leads' then 'lead' end;$r$);
  if position($r$'leads' then 'lead'$r$ in def) = 0 then raise exception 'automation_on_event: modifica non applicata'; end if;
  execute def;

  def := pg_get_functiondef('public.automation_prepare(uuid)'::regprocedure);
  def := replace(def, $r$when 'match' then (select to_jsonb(x) from public.matches x where x.id = run.entita_id)$r$,
                      $r$when 'match' then (select to_jsonb(x) from public.matches x where x.id = run.entita_id)
    when 'lead' then (select to_jsonb(x) from public.leads x where x.id = run.entita_id)$r$);
  if position('public.leads x' in def) = 0 then raise exception 'automation_prepare: modifica non applicata'; end if;
  execute def;
end $patch$;

create trigger leads_automazioni after insert on public.leads
  for each row execute function public.automation_on_event();

-- Lead chiuso o già contattato prima dell'invio: la risposta automatica non parte
do $patch$
declare def text;
begin
  def := pg_get_functiondef('public.automation_prepare(uuid)'::regprocedure);
  def := replace(def, $r$  if e is null then return jsonb_build_object('esito', 'annulla', 'motivo', 'Non esiste più'); end if;$r$,
                      $r$  if e is null then return jsonb_build_object('esito', 'annulla', 'motivo', 'Non esiste più'); end if;
  if run.entita_tipo = 'lead' and e ->> 'stato' in ('perso', 'spam') then
    return jsonb_build_object('esito', 'annulla', 'motivo', 'Lead chiuso');
  end if;$r$);
  if position($r$'Lead chiuso'$r$ in def) = 0 then raise exception 'automation_prepare: controllo lead non applicato'; end if;
  execute def;
end $patch$;

-- Le ricette di benvenuto e di allarme ora partono dai lead (sito, Facebook, Instagram, portali, email)
update public.automations set
  trigger_entita = 'lead', trigger_condizioni = '{}',
  descrizione = 'Quando arriva un lead (sito, Facebook, Instagram, portali), gli scriviamo subito su WhatsApp; senza modello approvato, un''email. Il promemoria per richiamarlo lo trovi tra le cose da fare.'
where ricetta_codice = 'lead_benvenuto';
update public.automations set
  trigger_entita = 'lead', trigger_condizioni = '{}',
  nome = 'Avvisiamo il titolare se un lead non viene richiamato',
  descrizione = 'Se dopo 2 ore lavorative nessuno ha chiamato o scritto al nuovo lead, il titolare riceve un avviso.',
  azione_contenuto = '{"titolo": "Lead non ancora richiamato: {{nome}} {{cognome}} (arrivato alle {{ora_creazione}})"}'
where ricetta_codice = 'lead_non_richiamato';

-- Stesse ricette per le nuove agenzie
do $patch$
declare def text;
begin
  def := pg_get_functiondef('public.automation_install_recipes(uuid)'::regprocedure);
  def := replace(def, $r$'Quando arriva un contatto dal portale o dal sito, gli scriviamo subito su WhatsApp (il promemoria per richiamarlo lo trovi già tra le cose da fare).',
     true, 'creazione', 'contact', '{"fonte": ["portale", "sito"]}'$r$,
     $r$'Quando arriva un lead (sito, Facebook, Instagram, portali), gli scriviamo subito su WhatsApp; senza modello approvato, un''email. Il promemoria per richiamarlo lo trovi tra le cose da fare.',
     true, 'creazione', 'lead', '{}'$r$);
  def := replace(def, $r$'Avvisiamo il titolare se un nuovo contatto non viene richiamato',
     'Se dopo 2 ore lavorative nessuno ha chiamato o scritto al nuovo contatto, il titolare riceve un avviso.',
     true, 'nessuna_risposta', 'contact', '{"fonte": ["portale", "sito"]}'$r$,
     $r$'Avvisiamo il titolare se un lead non viene richiamato',
     'Se dopo 2 ore lavorative nessuno ha chiamato o scritto al nuovo lead, il titolare riceve un avviso.',
     true, 'nessuna_risposta', 'lead', '{}'$r$);
  def := replace(def, $r$'{"titolo": "Nuovo contatto non ancora richiamato: {{nome}} {{cognome}} (arrivato alle {{ora_creazione}})"}'$r$,
                      $r$'{"titolo": "Lead non ancora richiamato: {{nome}} {{cognome}} (arrivato alle {{ora_creazione}})"}'$r$);
  if (length(def) - length(replace(def, $r$'lead', '{}'$r$, ''))) / length($r$'lead', '{}'$r$) <> 2 then
    raise exception 'automation_install_recipes: modifica non applicata';
  end if;
  execute def;
end $patch$;
