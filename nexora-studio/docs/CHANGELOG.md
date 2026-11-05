# Changelog

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
