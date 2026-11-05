-- Nexora Academy — dati di esempio (solo sviluppo locale / primo avvio)
-- Un tenant (Nexora), un docente e il corso "CRM e automazioni per PMI":
-- 6 moduli e 32 lezioni, con i testi dei mockup in design/.

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
  'Founder e CEO di Nexora Gruppo Digitale',
  'Founder di Nexora Gruppo Digitale. Ogni giorno costruisce CRM, automazioni e sistemi per '
  'aziende italiane: nel corso ti mostra come li fa.'
)
on conflict (id) do nothing;

do $$
declare
  v_tenant uuid := '00000000-0000-4000-8000-000000000001';
  v_course uuid := '00000000-0000-4000-8000-000000000201';
  v_modules uuid[] := '{}';
  v_titoli text[] := array[
    'Perché la tua azienda perde clienti',
    'Scegliere e impostare il CRM',
    'Pipeline e fasi di vendita',
    'Automazioni che lavorano al posto tuo',
    'AI nel processo commerciale',
    'Numeri, report e decisioni'
  ];
  v_id uuid;
begin
  if exists (select 1 from public.courses where id = v_course) then
    return;
  end if;

  insert into public.courses (
    id, tenant_id, slug, titolo, sottotitolo, descrizione, categoria, risultati,
    prezzo_cents, valuta, stato, docente_id, ordine, pubblicato_il
  ) values (
    v_course, v_tenant, 'crm-e-automazioni-per-pmi',
    'CRM e automazioni per PMI',
    'Smetti di gestire clienti tra WhatsApp, email e fogli sparsi. Costruisci un sistema che ti '
    'dice ogni giorno quanti clienti entrano e dove li perdi.',
    'Un percorso pratico per chi guida una piccola o media impresa. Scegli e imposti il CRM, '
    'disegni la pipeline sul tuo processo reale, attivi le prime automazioni e impari a leggere '
    'i numeri che contano.',
    'Organizzazione aziendale',
    '[
      {"titolo": "Un CRM configurato", "testo": "Pipeline, fasi di vendita e campi pronti sulla tua attività."},
      {"titolo": "Le prime automazioni", "testo": "Follow-up, promemoria e messaggi che partono da soli."},
      {"titolo": "Numeri leggibili", "testo": "Sai quanti contatti entrano, quanti chiudi e dove li perdi."},
      {"titolo": "Un metodo per il team", "testo": "Regole chiare su chi fa cosa, anche quando tu non ci sei."}
    ]'::jsonb,
    19700, 'EUR', 'published', '00000000-0000-4000-8000-000000000101', 1, now()
  );

  for i in 1 .. array_length(v_titoli, 1) loop
    insert into public.modules (course_id, titolo, ordine)
    values (v_course, v_titoli[i], i)
    returning id into v_id;
    v_modules := v_modules || v_id;
  end loop;

  -- (modulo, ordine, slug, titolo, durata in secondi, anteprima gratuita)
  insert into public.lessons (module_id, course_id, slug, titolo, descrizione, durata_sec, is_free_preview, ordine)
  select v_modules[t.modulo], v_course, t.slug, t.titolo,
         'In questa lezione: ' || lower(t.titolo) || '. Guardala fino in fondo, poi apri i materiali.',
         t.durata, t.gratis, t.ordine
  from (values
    (1, 1, 'il-costo-dei-clienti-che-non-richiami', 'Il costo dei clienti che non richiami', 460, true),
    (1, 2, 'la-mappa-del-caos', 'WhatsApp, email, fogli: la mappa del caos', 665, false),
    (1, 3, 'le-tre-domande-del-titolare', 'Le tre domande che ogni titolare deve saper rispondere', 560, false),
    (1, 4, 'misura-il-punto-di-partenza', 'Esercizio: misura il tuo punto di partenza', 375, false),

    (2, 1, 'i-criteri-di-scelta', 'I cinque criteri per scegliere il CRM', 660, false),
    (2, 2, 'su-misura-o-pronto', 'Su misura o pronto all''uso', 600, false),
    (2, 3, 'quanto-costa-davvero', 'Quanto costa davvero', 420, false),
    (2, 4, 'importare-i-contatti', 'Importare i contatti senza perderli', 720, false),
    (2, 5, 'i-campi-che-servono', 'I campi che servono davvero', 480, false),
    (2, 6, 'il-tuo-crm-in-un-ora', 'Esercizio: il tuo CRM in un''ora', 360, false),

    (3, 1, 'cos-e-una-pipeline', 'Cos''è una pipeline (e cosa non è)', 510, false),
    (3, 2, 'disegnare-le-fasi', 'Disegnare le fasi sul tuo processo', 730, false),
    (3, 3, 'quando-un-contatto-cambia-fase', 'Quando un contatto cambia fase', 630, false),
    (3, 4, 'le-pipeline-di-vendita-nel-crm', 'Le pipeline di vendita nel CRM', 1170, false),
    (3, 5, 'pipeline-per-piu-venditori', 'Pipeline per più venditori', 530, false),
    (3, 6, 'la-tua-pipeline-in-30-minuti', 'Esercizio: la tua pipeline in 30 minuti', 360, false),

    (4, 1, 'la-prima-automazione', 'La tua prima automazione', 660, false),
    (4, 2, 'follow-up-dopo-il-preventivo', 'Il follow-up automatico dopo il preventivo', 780, false),
    (4, 3, 'email-e-whatsapp-senza-spam', 'Email e WhatsApp automatici, senza spam', 840, false),
    (4, 4, 'promemoria-per-la-squadra', 'Promemoria e attività per la squadra', 600, false),
    (4, 5, 'errori-da-evitare', 'Gli errori da evitare', 420, false),
    (4, 6, 'tre-automazioni-in-un-pomeriggio', 'Esercizio: tre automazioni in un pomeriggio', 360, false),

    (5, 1, 'dove-l-ai-aiuta', 'Dove l''AI aiuta davvero', 540, false),
    (5, 2, 'riassumere-chiamate-ed-email', 'Riassumere chiamate ed email', 600, false),
    (5, 3, 'bozze-di-risposta', 'Bozze di risposta pronte', 570, false),
    (5, 4, 'classificare-i-contatti', 'Classificare i contatti in arrivo', 520, false),
    (5, 5, 'regole-e-privacy', 'Regole e privacy', 440, false),

    (6, 1, 'i-tre-numeri-del-lunedi', 'I tre numeri da guardare ogni lunedì', 540, false),
    (6, 2, 'dove-perdi-i-clienti', 'Dove perdi i clienti: leggere la pipeline', 660, false),
    (6, 3, 'report-per-il-team', 'Report per il team', 480, false),
    (6, 4, 'far-usare-il-crm', 'Far usare il CRM alla squadra', 660, false),
    (6, 5, 'piano-dei-90-giorni', 'Il tuo piano dei prossimi 90 giorni', 480, false)
  ) as t(modulo, ordine, slug, titolo, durata, gratis);
end;
$$;

-- Nexora è il cliente n. 1 della piattaforma: piano Business, sempre attivo.
update public.tenants
set piano_id = (select id from public.platform_plans where codice = 'business'), stato = 'attivo'
where slug = 'nexora' and piano_id is null;
