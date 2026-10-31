-- =====================================================================
-- AUTOMAZIONI (3/3): ricette pronte, modelli di messaggio, lavoro ogni 5 minuti
-- Le ricette nascono per ogni agenzia (anche le nuove) e sono già attive, tranne quelle promozionali
-- o che richiedono un dato dell'agenzia (link recensioni).
-- =====================================================================

create or replace function public.automation_install_recipes(p_agency uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.messaging_settings (agency_id) values (p_agency) on conflict do nothing;

  insert into public.message_templates (agency_id, codice, nome, canale, oggetto, testo, whatsapp_template_name) values
    (p_agency, 'benvenuto', 'Benvenuto al nuovo contatto', 'whatsapp', null,
     'Ciao {{nome}}, sono {{nome_agente}} di {{nome_agenzia}}. Ho ricevuto la tua richiesta e ti chiamo a breve. Se preferisci, rispondi qui con l''orario migliore per sentirci.',
     'mattonio_benvenuto'),
    (p_agency, 'promemoria_visita', 'Promemoria della visita', 'whatsapp', null,
     'Ciao {{nome}}, ti ricordo la visita di domani, {{data_appuntamento}} alle {{ora_appuntamento}}, in {{indirizzo_immobile}}. A presto! {{nome_agente}}, {{nome_agenzia}}',
     'mattonio_promemoria_visita'),
    (p_agency, 'feedback_visita', 'Com''è andata la visita', 'whatsapp', null,
     'Ciao {{nome}}, grazie per aver visto l''immobile in {{indirizzo_immobile}}. Com''è andata? Bastano 30 secondi: {{link_questionario}}',
     'mattonio_feedback_visita'),
    (p_agency, 'report_proprietario', 'Aggiornamento al proprietario', 'email', 'Come sta andando il suo immobile in {{indirizzo_immobile}}',
     E'Gentile {{nome}},\necco come sta andando il suo immobile in {{indirizzo_immobile}} negli ultimi 15 giorni:\n\n• visite fatte: {{visite}}\n• nuovi acquirenti interessati: {{richieste}}\n• giorni sul mercato: {{giorni_online}}\n\nPer qualsiasi domanda sono a sua disposizione.\n{{nome_agente}}, {{nome_agenzia}}',
     null),
    (p_agency, 'recensione', 'Richiesta di recensione', 'whatsapp', null,
     'Ciao {{nome}}, grazie per averci scelto! Se ti sei trovato bene, ci aiuteresti con una breve recensione? {{link_recensioni}}',
     'mattonio_recensione'),
    (p_agency, 'compleanno', 'Auguri di compleanno', 'whatsapp', null,
     'Tanti auguri di buon compleanno, {{nome}}! Un caro saluto da {{nome_agente}} e da tutta {{nome_agenzia}}.',
     'mattonio_compleanno'),
    (p_agency, 'festivita', 'Auguri per le feste', 'whatsapp', null,
     'Ciao {{nome}}, {{nome_agenzia}} ti augura {{festivita}}!',
     'mattonio_festivita'),
    (p_agency, 'immobile_compatibile', 'Immobile adatto al cliente', 'whatsapp', null,
     'Ciao {{nome}}, è appena entrato un immobile che potrebbe interessarti: {{indirizzo_immobile}}, {{prezzo_immobile}}. Vuoi vederlo? Rispondi qui e organizziamo la visita. {{nome_agente}}',
     'mattonio_immobile_compatibile')
  on conflict (agency_id, codice) do nothing;

  insert into public.automations (agency_id, ricetta_codice, nome, descrizione, attiva, trigger_tipo, trigger_entita, trigger_condizioni,
                                  attesa_valore, attesa_unita, attesa_direzione, azione_tipo, azione_destinatario, azione_contenuto, richiede_consenso) values
    (p_agency, 'lead_benvenuto', 'Rispondiamo subito ai nuovi contatti',
     'Quando arriva un contatto dal portale o dal sito, gli scriviamo subito su WhatsApp (il promemoria per richiamarlo lo trovi già tra le cose da fare).',
     true, 'creazione', 'contact', '{"fonte": ["portale", "sito"]}', 0, 'minuti', 'dopo', 'whatsapp', 'contatto',
     '{"template": "benvenuto"}', false),
    (p_agency, 'lead_non_richiamato', 'Avvisiamo il titolare se un nuovo contatto non viene richiamato',
     'Se dopo 2 ore lavorative nessuno ha chiamato o scritto al nuovo contatto, il titolare riceve un avviso.',
     true, 'nessuna_risposta', 'contact', '{"fonte": ["portale", "sito"]}', 2, 'ore_lavorative', 'dopo', 'notifica_interna', 'titolare',
     '{"titolo": "Nuovo contatto non ancora richiamato: {{nome}} {{cognome}} (arrivato alle {{ora_creazione}})"}', false),
    (p_agency, 'promemoria_visita', 'Ricordiamo la visita al cliente il giorno prima',
     'Il giorno prima di ogni visita mandiamo al cliente un promemoria su WhatsApp con data, ora e indirizzo.',
     true, 'data_evento', 'appointment', '{"tipo": "visita"}', 24, 'ore', 'prima', 'whatsapp', 'contatto',
     '{"template": "promemoria_visita"}', false),
    (p_agency, 'feedback_visita', 'Il giorno dopo la visita chiediamo com''è andata',
     'Un giorno lavorativo dopo la visita mandiamo al cliente un breve questionario: le risposte finiscono nella scheda del cliente e dell''immobile.',
     true, 'data_evento', 'appointment', '{"tipo": "visita"}', 1, 'giorni_lavorativi', 'dopo', 'whatsapp', 'contatto',
     '{"template": "feedback_visita", "questionario": true, "task_aggiuntivo": "Chiedi a {{nome}} {{cognome}} com''è andata la visita in {{indirizzo_immobile}}"}', false),
    (p_agency, 'report_proprietario', 'Ogni 15 giorni aggiorniamo il proprietario',
     'Per ogni immobile disponibile mandiamo al proprietario un''email con visite, acquirenti interessati e giorni sul mercato.',
     true, 'periodico', 'property', '{"giorni": 15}', 15, 'giorni', 'dopo', 'email', 'proprietario',
     '{"template": "report_proprietario"}', false),
    (p_agency, 'immobile_fermo', 'Ti avvisiamo se un immobile non riceve visite da 21 giorni',
     'Quando un immobile disponibile resta 21 giorni senza visite, l''agente riceve un promemoria per rivedere prezzo o foto.',
     true, 'inattivita', 'property', '{"giorni": 21}', 21, 'giorni', 'dopo', 'notifica_interna', 'agente_assegnato',
     '{"titolo": "{{indirizzo_immobile}}: nessuna visita da 21 giorni. Valuta di rivedere prezzo o foto"}', false),
    (p_agency, 'incarico_scadenza', 'Ti ricordiamo di rinnovare gli incarichi',
     '30 giorni prima della scadenza dell''incarico, l''agente trova tra le cose da fare "Proponi il rinnovo".',
     true, 'data_campo', 'property', '{"campo": "scadenza_incarico"}', 30, 'giorni', 'prima', 'task', 'agente_assegnato',
     '{"titolo": "Proponi il rinnovo dell''incarico di {{indirizzo_immobile}} (scade il {{data_scadenza}})"}', false),
    (p_agency, 'acquisizione_ferma', 'Ti ricordiamo di seguire le valutazioni fatte',
     'Se un''acquisizione resta in "Valutazione fatta" per 3 giorni, l''agente trova un promemoria per proporre l''incarico.',
     true, 'cambio_fase', 'acquisition', '{"fase": "valutazione_fatta"}', 3, 'giorni', 'dopo', 'task', 'agente_assegnato',
     '{"titolo": "Segui {{indirizzo_immobile}}: valutazione fatta da 3 giorni, proponi l''incarico"}', false),
    (p_agency, 'documenti_rogito', 'Ti ricordiamo i documenti prima della firma',
     '20 giorni prima di un appuntamento di firma, l''agente trova "Controlla i documenti".',
     true, 'data_evento', 'appointment', '{"tipo": "firma"}', 20, 'giorni', 'prima', 'task', 'agente_assegnato',
     '{"titolo": "Controlla i documenti per la firma del {{data_appuntamento}} ({{indirizzo_immobile}})"}', false),
    (p_agency, 'dopo_rogito', 'Dopo il rogito chiediamo una recensione',
     'Il giorno dopo il rogito ringraziamo il cliente e gli chiediamo una recensione su Google. Si attiva quando inserisci il link delle recensioni.',
     false, 'cambio_fase', 'deal', '{"fase": "rogito"}', 1, 'giorni', 'dopo', 'whatsapp', 'contatto',
     '{"template": "recensione"}', false),
    (p_agency, 'compleanno', 'Facciamo gli auguri di compleanno',
     'Il giorno del compleanno mandiamo gli auguri, solo ai contatti che hanno dato il consenso.',
     false, 'data_campo', 'contact', '{"campo": "data_nascita"}', 0, 'giorni', 'dopo', 'whatsapp', 'contatto',
     '{"template": "compleanno"}', true),
    (p_agency, 'festivita_natale', 'Facciamo gli auguri di Natale',
     'Il 23 dicembre mandiamo gli auguri, solo ai contatti che hanno dato il consenso.',
     false, 'data_fissa', 'contact', '{"festa": "natale"}', 0, 'giorni', 'dopo', 'whatsapp', 'contatto',
     '{"template": "festivita"}', true),
    (p_agency, 'festivita_pasqua', 'Facciamo gli auguri di Pasqua',
     'Il sabato prima di Pasqua mandiamo gli auguri, solo ai contatti che hanno dato il consenso.',
     false, 'data_fissa', 'contact', '{"festa": "pasqua"}', 0, 'giorni', 'dopo', 'whatsapp', 'contatto',
     '{"template": "festivita"}', true),
    (p_agency, 'cliente_non_sentito', 'Ti ricordiamo i clienti che non senti da 30 giorni',
     'Se un cliente che cerca casa non viene sentito da 30 giorni, l''agente trova "Risentilo" tra le cose da fare.',
     true, 'inattivita', 'contact', '{"giorni": 30}', 30, 'giorni', 'dopo', 'task', 'agente_assegnato',
     '{"titolo": "Risenti {{nome}} {{cognome}}: nessun contatto da 30 giorni"}', false),
    (p_agency, 'immobili_compatibili', 'Mandiamo al cliente gli immobili giusti per lui',
     'Quando entra un immobile compatibile con la sua richiesta, lo segnaliamo al cliente su WhatsApp. Spento all''inizio: l''agente riceve comunque il promemoria.',
     false, 'creazione', 'match', '{}', 30, 'minuti', 'dopo', 'whatsapp', 'contatto',
     '{"template": "immobile_compatibile"}', false)
  on conflict (agency_id, ricetta_codice) do nothing;
end $$;

create or replace function public.automation_recipes_for_new_agency()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.automation_install_recipes(new.id);
  return new;
end $$;
create trigger agencies_automazioni after insert on public.agencies
  for each row execute function public.automation_recipes_for_new_agency();

select public.automation_install_recipes(id) from public.agencies;

revoke execute on function public.automation_install_recipes(uuid) from public, anon, authenticated;
revoke execute on function public.automation_recipes_for_new_agency() from public, anon, authenticated;

-- ---------- Segreti e lavoro ogni 5 minuti ----------
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'automazioni_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'automazioni_cron_secret', 'Automazioni: chiamate di pg_cron');
  end if;
  if not exists (select 1 from vault.secrets where name = 'automazioni_link_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'automazioni_link_secret', 'Automazioni: firma di questionari e disiscrizioni');
  end if;
end $$;

select cron.schedule(
  'automazioni',
  '*/5 * * * *',
  $cron$
  select net.http_post(
    url := 'https://bwpgpsrcddlngpskyajr.supabase.co/functions/v1/automazioni',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-automazioni-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'automazioni_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $cron$
);
