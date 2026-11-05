# Changelog

## Produzione (2026-11-05)

### Modificato
- Il modello di Whisper del worker si sceglie con la variabile `WHISPER_LOCAL_MODEL`, che Railway passa alla build dell'immagine: `large-v3-turbo` è il predefinito e serve circa 3 GB di RAM, `medium` circa 2 GB, `small` circa 1 GB.
- Nuova variabile `WHISPER_BEAM_SIZE` (predefinito 5): con 1 la trascrizione usa meno memoria ed è più veloce.

## Teleprompter (2026-11-05)

### Aggiunto
- **Registrazione dal browser con il teleprompter** (`/video/registra`):
  - nella pagina dello script c'è "Registra con il teleprompter", e la pagina Carica ha un collegamento rapido;
  - si usa la fotocamera frontale a tutto schermo, con l'anteprima a specchio, mentre il video registrato resta normale;
  - il testo (frase d'apertura e script) scorre in alto, vicino all'obiettivo, ed è regolabile in velocità (lenta, media, veloce) e dimensione, con pausa;
  - prima di partire c'è un conto alla rovescia di 3 secondi, e lo schermo resta acceso dove il browser lo consente;
  - la registrazione si ferma da sola a 10 minuti;
  - finita la ripresa si rivede il video e si sceglie "Rifai" o "Usa questo": il caricamento riprende da solo se la connessione cade e il montaggio parte come per i video dalla galleria;
  - il testo a schermo non finisce nel video;
  - se il piano non consente nuovi montaggi lo diciamo prima di registrare; se il browser non supporta la registrazione resta il caricamento dalla galleria.
- Formato: MP4 dove il browser lo supporta (iPhone, Chrome recenti), altrimenti WebM. Il montaggio li gestisce entrambi; nessuna modifica al database.
- Test `tests/e2e/flow-teleprompter.cjs`, con fotocamera e microfono finti di Chrome: apertura, scorrimento del testo, "Rifai", "Usa questo", caricamento, script segnato come girato, montaggio avviato. Il video prodotto è stato montato fino in fondo dal worker locale.

## Trascrizione sul worker (2026-11-05)

### Cambiato
- **Whisper gira sul worker** (faster-whisper, modello `large-v3-turbo`, CPU int8) invece che sull'API OpenAI.
  - L'audio dei clienti non lascia il server e non serve nessun account esterno.
  - Il modello viene scaricato durante la build dell'immagine Railway.
  - In prova, 11 secondi di parlato sono stati trascritti in circa 9 secondi su 4 CPU, tempo di caricamento compreso. Per un girato di 3 minuti si stimano 1-2 minuti.
- La trascrizione la decodifica FFmpeg (`packages/video-engine/python/transcribe.py`). Il provider è `TRANSCRIPTION_PROVIDER=local`, predefinito quando manca `OPENAI_API_KEY`.
- Il costo per video stima il calcolo con `LOCAL_TRANSCRIBE_USD_PER_MIN` (predefinito 0,002 $ al minuto).
- Informativa privacy: OpenAI tolta dai fornitori; Railway ora indicata anche per la trascrizione.

## Aziende create dal team (2026-11-05)

### Aggiunto
- **`/admin/aziende`**: il team crea l'azienda di un cliente e ne compila l'onboarding (azienda, brand, esempi, pubblicazione). Poi invita il cliente come titolare con un'email.
- Il cliente si registra dal link, accetta e trova tutto pronto. Il team passa da solo da titolare a collaboratore, quindi non riceve più le email di fatturazione. Il cliente sceglie e paga il piano in app con Stripe, e può togliere il team dalla pagina Team.
- Elenco "Aziende che segui tu" (stato del profilo, invito, piano) e "Tutte le altre aziende".
- Nessuna migrazione: l'admin poteva già creare più aziende (`create_workspace`).
- Test `tests/e2e/flow-aziende.cjs`.

## Allineamento ai Termini di servizio (2026-11-05)

### Aggiunto
- **Tolleranza di 2 giorni dopo un pagamento fallito** (art. 5.4, portato da 7 a 2 giorni nei Termini).
  - Nei primi 2 giorni si continua a lavorare, con un avviso e la scadenza in Home, Carica e Piano.
  - Dopo, si fermano i nuovi montaggi, gli script e le clip b-roll. Non si cancella nulla.
  - Anche l'email di pagamento fallito indica i 2 giorni.
- **Modifiche oltre le 2 incluse** (art. 4.4).
  - "Chiedi un'altra modifica" dice quale video si consuma (del piano o della prova) e quanti ne restano.
  - Se il nuovo montaggio fallisce, il video torna disponibile, una volta sola.
- **"Scarica il video"** nella pagina del video (art. 6.4).
- **Marcatura AI** (art. 9.2, AI Act art. 50): ogni video esportato porta nei metadati la dichiarazione di montaggio con AI (`comment`, `ai_generated=edited`, `ai_system`).
- **Conservazione dei dati**, job notturno `retention`:
  - il girato originale e la sua trascrizione si cancellano dopo 90 giorni; il video finito resta, ma non si può più rimontare;
  - abbonamento chiuso: 7 giorni prima l'email "Scarica i tuoi video"; 30 giorni dopo la fine del periodo pagato si cancellano file, video, script e testi del brand;
  - restano account, fatturazione e registro attività. Chi si riabbona prima non perde nulla, e ogni passaggio finisce nel registro attività.

### Database
- Migrazione `20261105170000_terms_alignment.sql` (applicata anche online), senza cancellazioni:
  - nuove colonne: `video_feedback.quota_kind` e `billed_period_start`, `raw_uploads.purged_at`, `workspaces.content_purge_warned_at` e `content_purged_at`;
  - nuovo tipo di job `retention`;
  - funzioni `billing_allows_work` e `release_feedback_quota`; `reserve_video` e `use_broll_credits` ora applicano la tolleranza.

### Test
- `tests/e2e/flow-termini.cjs`: "Scarica il video", modifica extra con restituzione, girato oltre i 90 giorni, cessazione (avviso, email, cancellazione, account conservato).
- `flow-fase5.cjs` (tolleranza e blocco dopo 3 giorni) e `billing_phase5.sql` (30 controlli) aggiornati.

## Fase 7 — Rifinitura e lancio (2026-11-05)

### Aggiunto
- **Landing completa** (`/`):
  - apertura con anteprima di un video da approvare;
  - come funziona, cosa fa il montaggio e per quali attività;
  - prezzi letti dalla tabella `plans` (mensile o annuale);
  - 7 domande frequenti e invito finale;
  - metadati per la condivisione, `robots.txt` e `sitemap.xml` (area cliente e admin escluse).
- **Monitoraggio errori con Sentry**: server, browser e richieste nell'app; nel worker solo i job falliti in modo definitivo e gli errori fatali.
  - Attivo solo con `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`.
  - Nessun dato personale: niente utenti, cookie, intestazioni né contenuti delle richieste, ed email oscurate nei messaggi.
- **Pagine di errore in italiano**: errore di una pagina (con "Riprova"), errore generale e "Pagina non trovata".
- **Backup cifrati**: `scripts/backup.sh` (pg_dump e cifratura AES-256) e il workflow notturno `.github/workflows/nexora-studio-backup.yml`, con copie tenute 30 giorni. Backup e ripristino sono stati provati in locale. Guida in `docs/BACKUP.md`.
- **Dominio** `studio.nexoragruppodigitale.it` (CNAME su Aruba) come indirizzo dell'app su Vercel.
- **`docs/LANCIO.md`**: configurazione da completare, stato dei criteri di accettazione dell'MVP, prove da fare prima di aprire ai clienti.

- **Pagine legali** con i testi di Nexora:
  - Termini e condizioni, Informativa privacy, Cookie policy (con l'elenco reale dei cookie e del local storage usati) e Accordo sul trattamento dei dati (`/trattamento-dati`, nuovo);
  - i link stanno nel piè di pagina, nella mappa del sito e in `robots.txt`.
- **Registrazione**: due caselle obbligatorie.
  - La prima: attività con partita IVA, Termini, accordo sul trattamento dei dati e presa visione della privacy.
  - La seconda: approvazione specifica delle clausole (artt. 1341 e 1342 c.c.).
  - Versione dei testi e momento dell'accettazione restano salvati sull'utente.

## Fase 6 — Area admin e metriche (2026-11-05)

### Aggiunto
- **Dashboard** (`/admin`), ultimi 30 giorni, aggiornata ogni minuto:
  - ricavi ricorrenti a prezzi di listino, aziende abbonate per piano, aziende in prova, margine indicativo (ricavi meno costi dei fornitori);
  - grafico dei video caricati al giorno, con dettaglio al passaggio del mouse e tabella dei dati;
  - tempi dal caricamento alla prima versione pronta: mediana, 9 video su 10, quota entro 15 minuti;
  - costo medio per video, costi del periodo, coda dei job, job falliti nelle 24 ore, video in errore;
  - avvisi se il worker sembra fermo (job in coda da 5 minuti e nessuno in lavorazione) e per le aziende con pagamento fallito.
- **Monitor dei job** (`/admin/job`):
  - filtri per stato e tipo, con il conteggio per stato; errore completo e dati del job; aggiornamento ogni 15 secondi;
  - "Riprova" su un job fallito: torna in coda da zero tentativi. Se è un montaggio, il video torna "in montaggio" e non viene riaddebitato;
  - "Annulla" su un job in coda: se è un montaggio, il video va in errore e torna disponibile al cliente;
  - la pubblicazione non si riprova da qui, ma dal calendario o dalla pagina del video.
- **Costi per video** (`/admin/costi`, 7, 30 o 90 giorni):
  - ogni video montato con il costo per passaggio (trascrizione, piano di montaggio, b-roll, render, pubblicazione), versioni comprese;
  - costi fuori dai video (script) e aziende che costano di più;
  - costi convertiti da dollari al cambio `USD_EUR_RATE`.
- **Piani** (`/admin/piani`): limiti e prezzi modificabili dal team e validi da subito in tutta l'app; si può anche togliere un piano dalla vendita. Dopo un cambio di prezzo il messaggio ricorda di lanciare `npm run stripe:setup`.
- **Registro attività**: riprova, annulla e modifiche ai piani finiscono in `audit_log`, con lo stato prima e dopo.
- **Menu dell'area admin** con tutte le sezioni; chi non è del team riceve "pagina non trovata" (404).
- **Dominio** `studio.nexoragruppodigitale.it` collegato al progetto Vercel (manca il record CNAME su Aruba).

### Database
- Nessuna migrazione: le metriche usano tabelle già esistenti (`provider_costs`, `jobs`, `videos`, `workspaces`, `plans`).

### Test
- `tests/e2e/flow-fase6.cjs`, flusso completo:
  - dashboard e grafico;
  - un job fallito riprovato ed eseguito dal worker, un job in coda annullato, entrambe le azioni registrate;
  - costi per video;
  - modifica di un piano;
  - 404 su tutte le pagine admin per un cliente;
  - dashboard da telefono senza scorrimento orizzontale.

## Fase 5 — Abbonamenti (2026-11-05)

### Aggiunto
- **Adapter dei pagamenti con Stripe** (`packages/shared/src/providers/stripe.ts`): pagina di pagamento ospitata da Stripe, portale clienti (carta, fatture, disdetta), cambio piano con conguaglio, webhook con firma verificata. C'è anche un provider dimostrativo (`BILLING_PROVIDER=demo`) per sviluppo e test. Guida in `docs/STRIPE.md`.
- **Webhook** `/api/billing/webhook`:
  - ogni evento è elaborato una sola volta (`stripe_events`); un evento ripetuto viene ignorato, uno fallito viene rielaborato al nuovo invio di Stripe;
  - lo stato dell'abbonamento viene sempre riletto da Stripe, perché gli eventi possono arrivare in disordine;
  - pagamento fallito: email al titolare con il link per aggiornare la carta.
- **Limiti per piano**, letti dalla tabella `plans` e validi per ciascun brand:
  - video al mese: raggiunto il limite, il caricamento si ferma con un messaggio e l'invito all'upgrade;
  - social inclusi: oltre il limite i più recenti restano collegati ma esclusi dalla pubblicazione;
  - clip b-roll: finite le clip, il video esce comunque, senza b-roll.
- **Contatori per periodo** (`usage_counters`): ripartono a ogni rinnovo e lo storico resta. Un montaggio fallito restituisce il video, una volta sola.
- **Prova gratuita**: 3 video senza carta, poi blocco con "Scegli il piano". Un utente può creare da solo una sola azienda: i brand in più passano dall'abbonamento.
- **Blocchi**: con pagamento fallito, abbonamento disdetto o non attivo si fermano i nuovi montaggi e gli script settimanali. Video, calendario e post programmati restano.
- **Piano Business con più brand**: un solo abbonamento copre fino a 3 brand ("Aggiungi brand" nella pagina del piano, poi l'onboarding del nuovo brand). Piano, stato e periodo arrivano ai brand collegati in automatico.
- **Pagina "Piano e fatturazione"**: piano attuale, consumi del periodo, scelta mensile o annuale (10 mesi invece di 12), cambio piano, portale Stripe, elenco dei brand.
- **Messaggi chiari in Home, Carica e Script** quando un limite è raggiunto, con il pulsante giusto (scegli, aggiorna il pagamento, riattiva, vedi i piani).
- **Founding member**: il team lo attiva in `/admin/abbonamenti`; al checkout si applica il coupon permanente (`STRIPE_FOUNDING_COUPON_ID`).
- **`npm run stripe:setup`**: crea prodotti e prezzi dai piani e scrive gli id nella tabella `plans`. Crea anche il coupon founding, il webhook e la configurazione del portale. Si può rilanciare senza duplicare nulla.

### Database
- Migrazione `20261105150000_phase5_billing.sql` (applicata anche online). Nessun dato cancellato.
  - `workspaces`: `billing_workspace_id`, `billing_interval`, `cancel_at_period_end`, `payment_failed_at`.
  - Nuove tabelle `usage_counters` (lettura per i membri) e `stripe_events` (solo server).
  - `videos`: `quota_kind`, `billed_period_start`.
- Funzioni solo server: `reserve_video`, `release_video`, `release_reservation`, `use_broll_credits`. Per gli utenti: `create_brand`, che controlla titolare, abbonamento attivo e numero di brand. `create_workspace` ora rifiuta una seconda azienda.

### Test
- `supabase/tests/billing_phase5.sql`: 28 controlli SQL (prova, limiti per brand, brand in più, permessi, restituzione, b-roll, pagamento fallito, rinnovo, disdetta).
- `tests/e2e/flow-fase5.cjs`: flusso completo, dalla prova finita alla scelta del piano, upgrade, secondo brand, webhook (pagamento fallito, evento ripetuto, firma non valida), rinnovo e disdetta.
- Test unitari dell'adapter (stati Stripe, periodo nelle API vecchie e nuove, firma demo): 15 test in `@nexora/shared`.

## Fase 4 — Calendario e pubblicazione (2026-11-05)

### Aggiunto
- **Adapter di pubblicazione con Metricool** (`packages/shared/src/providers/metricool.ts`):
  - video pubblicati come Reel o Short su Instagram, Facebook, TikTok, YouTube e LinkedIn, in pubblicazione automatica;
  - data e ora nel fuso dell'azienda;
  - c'è anche un provider dimostrativo per sviluppo e test.

  Guida in `docs/METRICOOL.md`.
- **Social collegati**: un brand Metricool per azienda.
  - Il team incolla blogId e link di collegamento in `/admin/social`. Il cliente collega i profili dal link, senza account Metricool, e può escludere un social dalla pubblicazione.
  - Il worker sincronizza ogni ora e su richiesta ("Ho collegato, aggiorna"). Se il link manca o è scaduto, il cliente lo richiede al team con un tocco.
- **Programmazione automatica**:
  - all'approvazione il video entra nel primo spazio libero (giorni e orario dell'onboarding, al massimo un video al giorno), calcolato in ora italiana anche al cambio d'ora;
  - senza social collegati il video resta "da programmare";
  - **un trigger nel database impedisce di programmare un video non approvato.**
- **Calendario** (`/calendario`):
  - vista settimana e mese, trascinamento tra i giorni (anche da telefono, tenendo premuta la maniglia), "Sposta" con data e ora per tastiera e lettori di schermo;
  - filtri per social e lista dei video approvati da programmare;
  - un post si sposta fino a 20 minuti prima dell'uscita.
- **Pubblicazione nel worker**:
  1. 15 minuti prima dell'orario il video viene consegnato a Metricool (link firmato valido 48 ore);
  2. dopo l'orario l'esito si verifica ogni 5 minuti per un'ora;
  3. se un social non va a buon fine il post va in errore, parte un'email all'azienda e il video si può riprogrammare dalla sua pagina.
- **Dettaglio del video**: scheda "Pubblicazione" con data, social e stato per social, link ai post pubblicati, "Sposta nel calendario" e "Togli dal calendario".
- **Home**: prossimi post delle 3 settimane successive.

### Database
- `20261105130000_phase4_social_calendar.sql` (approvata):
  - colonne Metricool su `workspaces`;
  - tabelle `social_accounts` e `scheduled_posts`;
  - nuovo tipo di job `sync_social`;
  - trigger `ensure_video_approved`.

  Applicata anche al progetto online.

### Verificato
- Test: spazi di pubblicazione (ora solare, legale e giorno del cambio, giorni occupati, anticipo minimo) e corpo dei post Metricool.
- End-to-end (`tests/e2e/flow-fase4.cjs`): video approvato senza social, social collegati dal team, programmazione, trascinamento nel calendario, spostamento troppo vicino all'uscita rifiutato, consegna e verifica della pubblicazione su 3 social.

## Fase 3 — Caricamento e montaggio (2026-11-05)

### Aggiunto
- **Motore di montaggio** `packages/video-engine`. È un modulo indipendente, pronto da spostare nel repository `nexora-video-engine`:
  - `edit_spec`: la timeline di un montaggio, validata con Zod;
  - tagli per intervalli di parole, con le pause lunghe accorciate in automatico;
  - sottotitoli animati (`.ass`): stile pulito, evidenziato o karaoke; tre grandezze; parole chiave nel colore del brand;
  - **i sottotitoli e la frase d'apertura evitano i volti**: rilevamento con YuNet/OpenCV, 2 fotogrammi al secondo, posizione scelta blocco per blocco;
  - render FFmpeg in 9:16 (riempimento per i video verticali, sfondo sfocato per gli orizzontali), musica che si abbassa quando si parla, volume a -14 LUFS, chiusura con il logo, b-roll già previsto nella timeline;
  - copertina ed estrazione dell'audio per la trascrizione.
- **Libreria musicale originale**: 6 brani (energica, rilassata, elegante) composti da un generatore procedurale (`python/music_gen.py`), nessun diritto di terzi. Il worker li genera durante la build Docker.
- **Trascrizione**: adapter Whisper (`whisper-1`, parola per parola, costo registrato) e trascrittore dimostrativo per lo sviluppo.
- **Decisioni di montaggio con Claude** (`worker/src/pipeline/plan.ts`):
  - riceve la trascrizione numerata e decide cosa tenere (false partenze, ripetizioni, errori), parole da evidenziare, frase d'apertura, musica, didascalia e hashtag;
  - nelle modifiche riceve il montaggio precedente e la richiesta del cliente;
  - le decisioni diventano una timeline al centesimo di secondo, con controlli e un ripiego (solo taglio dei silenzi) se la risposta non è valida.
- **Pipeline nel worker**: `transcribe` → `edit` → `render`, ogni passo ripetibile.
  - il girato viene scaricato in streaming e tenuto in cache sul worker, i volti calcolati una volta per girato;
  - errore definitivo: stato "Problema", video di prova restituito, avviso al team. Se una modifica fallisce, il cliente ritrova la versione precedente.
- **Caricamento** (`/video/carica`):
  - scelta dello script (o "video libero");
  - controlli nel browser: formato, 2 GB, 10 minuti, avviso per i video orizzontali;
  - caricamento riprendibile (TUS) con avanzamento; avvio del montaggio e consumo di un video di prova.
- **Pagina Video**:
  - schede per stato e copertine con link firmati;
  - dettaglio con player, avanzamento del montaggio, **Approva**, **Chiedi una modifica** (con suggerimenti, massimo 2 giri), didascalia e hashtag modificabili, storico delle versioni;
  - email "Il tuo video è pronto da approvare".
- **Revisione del team Nexora** (`/admin/revisione`, solo `is_admin`): video in controllo interno di tutte le aziende, note del montaggio, "Invia al cliente" e "Rimonta" (non consuma i giri del cliente).
- **Home** con i video da approvare.

### Database
- Migrazione `20261105104604_phase3_uploads_videos.sql` (approvata), con una correzione: il cliente vede la scheda del video anche durante il controllo interno (come "In montaggio"), ma non le versioni finché il team non le invia.

### Verificato
- Test del motore (9): timeline, tagli, sottotitoli, posizione anti-volto, conversioni di inquadratura, argomenti FFmpeg, e un **render reale con un volto vero** in alto e in basso.
- End-to-end (`tests/e2e/flow-fase3.cjs`), circa 35 secondi in tutto:
  - onboarding con logo, script, caricamento, trascrizione, montaggio, render;
  - revisione del team e email al cliente;
  - modifica della didascalia, richiesta "sottotitoli più grandi" che produce la versione 2, approvazione.
- Prestazioni su un girato di 3 minuti (4 core): rilevamento volti 19 s, render 39 s. Il requisito è sotto i 15 minuti.

### B-roll (Pexels)
- Adapter `BrollProvider` con Pexels: clip verticali stock, licenza gratuita per uso commerciale, nessun credito consumato. C'è anche un provider dimostrativo per lo sviluppo.
- Claude propone dove mettere le clip e cosa mostrare (ricerca in inglese) entro il massimo dello stile scelto ("mai" 0, "ogni tanto" 2, "spesso" 4). Regole fisse: niente nei primi 3 secondi né nell'ultimo, 2-4 secondi per clip, almeno 1,5 secondi tra due clip.
- Le clip vengono salvate accanto al video e riusate nelle versioni successive. Senza chiave Pexels il video esce senza b-roll. Verificato con un render reale.

### Messa online
- Migrazioni delle Fasi 1-3 applicate al progetto Supabase `nexora studio` (eu-west-1).
- `20261105122500_security_hardening.sql`: chiude le funzioni interne segnalate dal linter Supabase. Le funzioni dei trigger non sono più richiamabili via API; gli helper della RLS non lo sono più per gli anonimi.

### Non ancora fatto
- Build Docker del worker non verificata in questo ambiente (pacchetti Debian non raggiungibili dal sandbox).

## Fase 2 — Script (2026-11-05)

### Aggiunto
- **Adapter LLM su Anthropic** (`packages/shared/src/providers/anthropic.ts`), modello `claude-opus-5-5`:
  - output strutturato validato con Zod;
  - prompt caching sulla parte fissa delle istruzioni;
  - fallback lato server (`fallbacks: "default"`) se il modello rifiuta;
  - errori tipizzati: ritentabili oppure no;
  - costo di ogni chiamata calcolato in USD.
- **Motore degli script** (`packages/shared/src/scripts/`):
  - le istruzioni fisse non contengono dati dell'azienda (per la cache); a ogni richiesta si aggiungono brand, città, servizi e cose da non dire;
  - calendario italiano: Pasqua e feste mobili, Festa della mamma, Black Friday, saldi solo per i negozi, stagione;
  - ogni script ha hook di 3 secondi, testo da dire, chiusura, note di ripresa strutturate e formato.
- **Anti-ripetizione su due livelli**: Claude riceve gli script delle ultime 8 settimane, e dopo la generazione un controllo di somiglianza su titoli, hook e temi fa riscrivere quelli troppo vicini.
- **Riscrittura di un singolo script**, con il motivo facoltativo: massimo 3 a settimana per azienda, e il tentativo viene restituito se l'AI non risponde.
- **Worker**:
  - coda `jobs` con presa senza conflitti tra worker, 3 tentativi con attesa crescente (1, 4, 16 minuti), recupero dei job bloccati, avviso email agli admin quando un job fallisce definitivamente;
  - pianificazione in ora italiana: domenica dalle 18 prepara la settimana dopo; lunedì dalle 8 manda l'email "I tuoi video della settimana" a tutti i membri. Il fine settimana non genera la settimana che sta finendo.
- **Prima settimana subito**: a fine onboarding la generazione parte in automatico (nel fine settimana per la settimana successiva).
- **Pagina Script**:
  - settimana corrente e precedenti;
  - stato "Stiamo scrivendo i tuoi script", che si aggiorna da solo;
  - errore con "Riprova" per il titolare; prova gratuita esaurita con invito al piano.
- **Dettaglio dello script**: frase d'apertura in evidenza, testo riga per riga, note di ripresa (dove, inquadratura, luce, durata, consigli), "Carica il girato", "Salta questo video", "Riscrivi questo script".
- **Home** con gli script della settimana.
- **Email del lunedì** nello stile del brand, con versione solo testo. Adapter email spostato in `@nexora/shared/server` e usato da app e worker.
- **Provider per lo sviluppo**: `LLM_PROVIDER=demo` (script finti, nessun costo) ed `EMAIL_PROVIDER=mailpit`. Sono bloccati in produzione salvo il permesso esplicito `ALLOW_DEMO_PROVIDERS=true`, pensato solo per i test locali.

### Database
- Migrazione `20261105101922_phase2_scripts_jobs.sql` (approvata):
  - tabelle `script_batches`, `scripts`, `jobs`, `provider_costs`;
  - funzioni della coda `enqueue_job`, `claim_job`, `complete_job`, `fail_job`;
  - contatore delle riscritture, gestito solo dal server.

### Verificato
- Test automatici:
  - pacchetto condiviso, 6 test: calendario, somiglianza, sostituzione delle ripetizioni, riscrittura;
  - worker, 3 test: orari di Roma con ora legale e solare, settimane da preparare, orario dell'email.
- SQL su Supabase locale:
  - coda: deduplica, 3 tentativi e poi `failed`, ripresa dei job bloccati;
  - quarta riscrittura rifiutata;
  - il collaboratore cambia solo lo stato e non vede la coda;
  - un'altra azienda non vede niente.
- End-to-end (`tests/e2e/flow-fase2.cjs`): onboarding, script generati dal worker, pagina Script, Home, dettaglio, riscrittura con il contatore che scende, "Salta", email ricevuta.

## Fase 1 — Fondamenta (2026-11-05)

### Aggiunto
- **Accesso**:
  - registrazione con email e password e conferma via email;
  - accesso, password dimenticata e reimpostazione;
  - uscita dall'account.
  - Le email di Supabase sono in italiano e nello stile del brand (`supabase/templates/`). Il link funziona anche se l'email si apre in un altro browser, ad esempio nell'app di Gmail. Il login con Google è rimandato.
- **Protezione delle pagine**: il proxy (`src/proxy.ts`) manda a `/accedi` chi non ha fatto l'accesso. Ogni pagina e ogni Server Action ricontrolla l'utente, e la RLS resta la garanzia finale.
- **Onboarding in 4 passi** (`/onboarding`), che riprende dal punto in cui ci si è fermati:
  1. dati dell'azienda;
  2. brand: logo caricato nello storage privato, colori estratti in automatico dal logo e modificabili, tono di voce con suggerimenti, pubblico, servizi, cose da non dire;
  3. da 1 a 3 video di esempio, con caricamento riprendibile (TUS, blocchi da 6 MB, ripresa dopo un'interruzione);
  4. frequenza (2, 3 o 4 video a settimana), giorni e orario.

  Alla fine c'è una pagina di conferma. Il collegamento dei social arriva in Fase 4.
- **Area cliente con dati reali**:
  - utente e azienda attiva;
  - cambio azienda per chi ne ha più di una;
  - contatore dei video di prova nella Home.
- **Pagina Brand**: azienda, brand, stile di montaggio (ritmo, sottotitoli, musica, b-roll, logo finale), video di esempio e pubblicazione. Il collaboratore vede i dati dell'azienda e la pubblicazione in sola lettura.
- **Team**:
  - inviti via email (adapter Resend; senza chiave compare un link da copiare), annullamento degli inviti;
  - cambio ruolo e rimozione di un membro, uscita dal team;
  - modifica del proprio profilo;
  - pagina `/invito/<token>` per accettare, anche partendo dalla registrazione.
- Adapter email (`src/lib/email`) con il layout del brand.
- Pagine legali provvisorie (`/termini`, `/privacy`, `/cookie`).
- Test end-to-end (`tests/e2e/`): il flusso completo da mobile e 21 controlli di isolamento sulle API Supabase.

### Database
- Migrazione `20261105083527_phase1_foundations.sql` (approvata) con due aggiunte:
  - `workspaces.onboarding_step` (passo da cui riprendere l'onboarding);
  - funzione `get_invitation(token)`, che mostra la pagina di invito prima dell'accesso e restituisce solo il nome dell'azienda, l'email e lo stato.
- Tipi TypeScript del database in `packages/shared/src/database.types.ts`, da rigenerare con `npm run db:types` quando il progetto è collegato.

### Corretto
- Dopo un errore i form non si svuotano più. Con React 19 un form con Server Action azzerava i campi a ogni invio, quindi una password sbagliata cancellava anche l'email. Ora tutti i form usano `ActionForm`.

### Verificato (Supabase locale, Postgres 17)
- Migrazione applicata senza errori.
- Flusso completo su iPhone simulato: registrazione, email di conferma, onboarding, video da 16 MB caricato a blocchi, pagina Brand, invito, registrazione del collaboratore, accettazione dell'invito, uscita e nuovo accesso.
- Isolamento: un'altra azienda non vede né modifica dati, file, membri o inviti. Il collaboratore non cambia piano, prova, ruoli o flag admin. Il titolare non si cambia il piano da solo.

## Base grafica (2026-11-05)

### Aggiunto
- Identità visiva dal logo Nexora:
  - marchio "N" in vettoriale;
  - favicon, icona app, icona Apple e immagine di anteprima per i link;
  - manifest per installare l'app sul telefono.
- Design token definitivi: blu Nexora `#0A5CFF`, riflesso ciano, blu profondo, argento e inchiostro. Gradienti brand e argento, bagliore blu nel tema scuro.
- Font: Sora (titoli), Inter (testo), Michroma (scritta NEXORA).
- Tema scuro di base, chiaro e "sistema", con il selettore nel menu account.
- Libreria UI: pulsanti (variante `brand`), campi di form accessibili, card, badge, avvisi, barra di avanzamento, skeleton, avatar, menu, notifiche.
- Struttura dell'area cliente:
  - barra laterale su desktop e barra in basso su mobile, con il tasto "Carica il video";
  - pagine Home, Script, Video, Carica, Calendario, Brand, Social, Piano e Team, con stati vuoti che spiegano il passo successivo. Per ora mostrano dati dimostrativi, da collegare in Fase 1.
- Landing provvisoria, pagina `/design-system` e `docs/BRAND.md`.

### Cambiato
- I colori e il font provvisori della Fase 0 sono sostituiti da quelli del brand.

## Fase 1 — Schema (bozza, non applicata)
- Migrazione `supabase/migrations/20261105083527_phase1_foundations.sql` e test RLS locali in `supabase/tests/`.

## Fase 0 — Setup (2026-11-05)

### Aggiunto
- Monorepo `nexora-studio/` con npm workspaces: `app`, `worker`, `packages/shared`.
- App Next.js 16.3 (App Router, TypeScript, Tailwind CSS v4, ESLint, Prettier con plugin Tailwind).
- shadcn/ui configurato a mano (`components.json`, `cn`, componente `Button`). Il registry
  `ui.shadcn.com` non era raggiungibile dall'ambiente di sviluppo: gli altri componenti si
  aggiungono con `npx shadcn add` quando c'è rete.
- Design token chiaro/scuro (scuro di default) con colori e font provvisori.
- Integrazione Supabase SSR: client browser e server, `proxy.ts` (ex middleware) per il rinnovo
  della sessione.
- Route `GET /api/health`.
- Pacchetto `@nexora/shared`: tipi di dominio (ruoli, piattaforme, stati video e job) e interfacce
  degli adapter `TranscriptionProvider`, `LLMProvider`, `BrollProvider`, `PublishingProvider`,
  con tracciamento del costo per chiamata (`ProviderCost`).
- Worker Node: scheletro con ciclo di polling, controllo di FFmpeg, spegnimento pulito,
  `Dockerfile` con FFmpeg e `railway.json`.
- Supabase CLI (`supabase/config.toml`): upload fino a 2 GiB, redirect per localhost e
  `studio.nexoragruppodigitale.it`.
- `.env.example` con tutte le variabili previste.

### Da fare
- Deploy di prova su Vercel (rimandato).
