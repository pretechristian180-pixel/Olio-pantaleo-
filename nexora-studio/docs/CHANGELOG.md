# Changelog

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
