-- Nexora Academy — dati di esempio (solo sviluppo locale / primo avvio)
-- Un tenant (Nexora), un docente e il corso "CRM e automazioni per PMI" con 6 moduli.

insert into public.tenants (id, nome, slug, brand)
values (
  '00000000-0000-4000-8000-000000000001',
  'Nexora Gruppo Digitale',
  'nexora',
  '{"primary": "#0042ed", "dark": "#1d2124", "logo_text": "NEXORA"}'::jsonb
)
on conflict (id) do nothing;

insert into public.instructors (id, tenant_id, nome, qualifica, bio)
values (
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000001',
  'Christian Prete',
  'Founder di Nexora Gruppo Digitale',
  'Costruisco gestionali, CRM e automazioni per piccole e medie imprese italiane. '
  'In questo corso ti mostro il metodo che usiamo ogni giorno con i nostri clienti: '
  'meno strumenti, processi chiari, numeri che si leggono in un minuto.'
)
on conflict (id) do nothing;

do $$
declare
  v_tenant uuid := '00000000-0000-4000-8000-000000000001';
  v_course uuid := '00000000-0000-4000-8000-000000000201';
  v_module uuid;
  m record;
  v_lesson_ordine integer;
begin
  if exists (select 1 from public.courses where id = v_course) then
    return;
  end if;

  insert into public.courses (
    id, tenant_id, slug, titolo, sottotitolo, descrizione, risultati,
    prezzo_cents, valuta, stato, docente_id, ordine, pubblicato_il
  ) values (
    v_course, v_tenant, 'crm-e-automazioni-per-pmi',
    'CRM e automazioni per PMI',
    'Metti ordine in contatti, trattative e follow-up. E lascia che il lavoro ripetitivo lo faccia il sistema.',
    'Un percorso pratico per chi gestisce una piccola o media impresa e ha i clienti sparsi tra '
    'Excel, WhatsApp e la memoria di qualcuno. Scegli lo strumento giusto, disegni la tua pipeline, '
    'importi i dati senza perderli e costruisci le prime automazioni che ti fanno risparmiare ore ogni settimana.',
    array[
      'Una pipeline di vendita disegnata sul tuo processo reale',
      'I contatti in un unico posto, puliti e senza doppioni',
      'Cinque automazioni pronte da attivare dal primo giorno',
      'Un cruscotto con i tre numeri da guardare ogni lunedì',
      'Un piano di adozione per far usare il CRM alla tua squadra'
    ],
    19700, 'EUR', 'published', '00000000-0000-4000-8000-000000000101', 1, now()
  );

  for m in
    select * from (values
      (1, 'Perché un CRM (e quando non serve)', array[
        ['benvenuto', 'Benvenuto: come funziona il corso', '240', 'true'],
        ['i-segnali', 'I segnali che ti serve un sistema', '540', 'true'],
        ['quanto-costa-non-averlo', 'Quanto ti costa non averlo', '480', 'false']
      ]),
      (2, 'Scegliere lo strumento giusto', array[
        ['criteri-di-scelta', 'I cinque criteri di scelta', '660', 'false'],
        ['su-misura-o-pronto', 'Su misura o pronto all''uso', '600', 'false'],
        ['budget-realistico', 'Un budget realistico', '420', 'false']
      ]),
      (3, 'Pipeline e processi di vendita', array[
        ['disegna-la-pipeline', 'Disegna la tua pipeline', '780', 'false'],
        ['fasi-e-regole', 'Fasi, regole e responsabilità', '720', 'false'],
        ['follow-up', 'Il follow-up che non si dimentica', '540', 'false'],
        ['esercizio-pipeline', 'Esercizio: la tua pipeline in 30 minuti', '360', 'false']
      ]),
      (4, 'Dati, contatti e importazione', array[
        ['pulire-i-dati', 'Pulire i dati prima di importarli', '600', 'false'],
        ['importazione', 'Importare da Excel senza perdere nulla', '720', 'false'],
        ['campi-utili', 'I campi che servono davvero', '480', 'false']
      ]),
      (5, 'Automazioni che fanno risparmiare tempo', array[
        ['prima-automazione', 'La tua prima automazione', '660', 'false'],
        ['email-e-whatsapp', 'Email e WhatsApp automatici, senza spam', '840', 'false'],
        ['promemoria-e-attivita', 'Promemoria e attività per la squadra', '600', 'false'],
        ['errori-da-evitare', 'Gli errori da evitare', '420', 'false']
      ]),
      (6, 'Misurare e migliorare', array[
        ['tre-numeri', 'I tre numeri da guardare ogni lunedì', '540', 'false'],
        ['adozione', 'Far usare il CRM alla squadra', '660', 'false'],
        ['piano-90-giorni', 'Il tuo piano dei prossimi 90 giorni', '480', 'false']
      ])
    ) as t(ordine, titolo, lezioni)
  loop
    insert into public.modules (course_id, titolo, ordine)
    values (v_course, m.titolo, m.ordine)
    returning id into v_module;

    v_lesson_ordine := 0;

    for i in 1 .. array_length(m.lezioni, 1) loop
      v_lesson_ordine := v_lesson_ordine + 1;
      insert into public.lessons (module_id, course_id, slug, titolo, descrizione, durata_sec, is_free_preview, ordine)
      values (
        v_module,
        v_course,
        m.lezioni[i][1],
        m.lezioni[i][2],
        'In questa lezione: ' || lower(m.lezioni[i][2]) || '. Guardala fino in fondo, poi apri i materiali.',
        m.lezioni[i][3]::integer,
        m.lezioni[i][4]::boolean,
        v_lesson_ordine
      );
    end loop;
  end loop;
end;
$$;
