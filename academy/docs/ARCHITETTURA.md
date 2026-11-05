# Nexora Academy — Architettura

## Struttura delle cartelle

```
academy/
├── src/
│   ├── app/
│   │   ├── (public)/              Sito pubblico con header scuro e footer
│   │   │   ├── page.tsx           Home: claim + catalogo
│   │   │   └── corsi/             /corsi (catalogo) e /corsi/[slug] (pagina corso, SEO)
│   │   ├── accedi/ registrati/    (Fase 2) Login, registrazione, magic link, reset password
│   │   ├── auth/callback/         (Fase 2) Ritorno da magic link / conferma email
│   │   ├── app/                   Area studente (sidebar scura, tab bar su mobile)
│   │   │   ├── page.tsx           Dashboard
│   │   │   ├── corsi/             I miei corsi · (Fase 2) [slug]/[lezione] = player
│   │   │   ├── attestati/ community/ profilo/
│   │   ├── admin/                 Area admin (sidebar chiara)
│   │   │   ├── page.tsx           Panoramica
│   │   │   ├── corsi/ studenti/ vendite/ domande/ impostazioni/
│   │   ├── api/                   (Fasi 2-5) Route Handlers
│   │   │   ├── video/[lessonId]/token   URL embed Bunny firmato
│   │   │   ├── stripe/webhook           checkout.session.completed
│   │   │   ├── bunny/upload             credenziali TUS firmate per l'admin
│   │   │   └── cron/promemoria          email a chi non entra da 7 giorni
│   │   ├── attestati/[codice]/    (Fase 5) Verifica pubblica dell'attestato
│   │   ├── design-system/         Vetrina di token e componenti (noindex)
│   │   ├── layout.tsx             Font Michroma + Montserrat, metadati
│   │   └── globals.css            Token del brand (Tailwind v4 @theme)
│   ├── components/
│   │   ├── ui/                    Button, Card, Badge, ProgressBar, Eyebrow, Logo, Stat, Price, EmptyState, Avatar
│   │   ├── layout/                StudentSidebar, StudentTopbar, TabBar, AdminSidebar, PageHeader
│   │   ├── course/                CourseCard, CourseGrid, PurchaseCard, CourseProgram, InstructorCard, BusinessBox
│   │   ├── dashboard/             ResumeCard, CourseProgressCard
│   │   ├── admin/                 AdminStats
│   │   └── public/                PublicHeader, PublicFooter
│   ├── lib/
│   │   ├── env.ts / env.server.ts Variabili validate con zod (pubbliche / segrete)
│   │   ├── supabase/              Client server, browser, admin (service role), middleware
│   │   ├── data/                  Query lato server (corsi, ...)
│   │   ├── course-outline.ts      Logica pura sul programma (testata)
│   │   └── utils.ts               cn, prezzi, durate, minutaggi
│   └── middleware.ts              Rinnovo sessione (+ protezione rotte in Fase 2)
├── design/                    Mockup HTML di riferimento (Main, Corso, Lezione, Login, Admin, Mobile)
├── supabase/
│   ├── config.toml                Configurazione Supabase CLI
│   ├── migrations/                Migration SQL versionate
│   ├── seed.sql                   Tenant Nexora + corso di esempio
│   └── tests/rls_test.sql         Test pgTAP delle policy (46 controlli)
├── tests/unit/                    Vitest
├── tests/e2e/                     (Fase 5) Playwright
└── docs/                          Questa documentazione
```

## Schema del database

```
tenants ─┬─< profiles (= auth.users)          ruolo: student | instructor | admin
         ├─< instructors (scheda pubblica docente, opz. legata a un profilo)
         ├─< courses ─┬─< modules ─< lessons ─< lesson_resources
         │            │                 │
         │            │                 ├─< lesson_progress  (user_id, lesson_id) PK
         │            │                 ├─< notes
         │            │                 └─< questions ─< answers
         │            ├─< enrollments    (user_id, course_id) UNIQUE
         │            ├─< orders
         │            └─< certificates   codice univoco NX-XXXX-XXXX-XXXX
         ├─< plans ─< subscriptions      (predisposti per gli abbonamenti)
         └   stripe_events               idempotenza webhook
```

| Tabella            | Campi principali                                                                                                                                                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tenants`          | id, nome, slug, brand jsonb                                                                                                                                                                                                        |
| `profiles`         | id (= auth.users.id), tenant_id, nome, cognome, avatar_url, ruolo, consenso_marketing, consenso_marketing_il, ultimo_accesso_il                                                                                                    |
| `instructors`      | tenant_id, profile_id, nome, qualifica, bio, foto_path                                                                                                                                                                             |
| `courses`          | tenant_id, slug, titolo, sottotitolo, descrizione, categoria, risultati jsonb ({titolo, testo}), copertina_path, trailer_video_id, prezzo_cents, valuta, stato draft/published, stripe_price_id, docente_id, ordine, pubblicato_il |
| `modules`          | course_id, titolo, ordine                                                                                                                                                                                                          |
| `lessons`          | module_id, course_id (dal trigger), slug, titolo, descrizione, bunny_video_id, durata_sec, is_free_preview, ordine                                                                                                                 |
| `lesson_resources` | lesson_id, nome, tipo, storage_path, dimensione_bytes, ordine                                                                                                                                                                      |
| `enrollments`      | tenant_id (dal trigger), user_id, course_id, fonte stripe/manuale/azienda/abbonamento, stripe_session_id, order_id, creato_il, scade_il                                                                                            |
| `orders`           | tenant_id, user_id, course_id, email, importo_cents, valuta, stato, stripe_session_id, stripe_payment_intent_id, pagato_il                                                                                                         |
| `lesson_progress`  | user_id, lesson_id, ultimo_secondo, secondi_visti, completata, completata_il, aggiornato_il                                                                                                                                        |
| `notes`            | user_id, lesson_id, secondo, testo                                                                                                                                                                                                 |
| `questions`        | tenant_id/course_id (dal trigger), lesson_id, user_id, testo, stato aperta/risposta/chiusa                                                                                                                                         |
| `answers`          | question_id, user_id, testo, is_docente (dal trigger, dal ruolo dell'autore)                                                                                                                                                       |
| `certificates`     | user_id, course_id, codice, nome_intestatario, pdf_path, rilasciato_il                                                                                                                                                             |
| `plans`            | tenant_id, nome, stripe_price_id, intervallo, prezzo_cents, attivo                                                                                                                                                                 |
| `subscriptions`    | user_id, plan_id, stripe_subscription_id, stato, periodo_fine                                                                                                                                                                      |
| `stripe_events`    | id evento Stripe, tipo, ricevuto_il                                                                                                                                                                                                |

### Sicurezza (RLS)

- Funzioni di controllo nello schema `private` (non esposto dalle API): `is_staff`, `is_admin`,
  `has_course_access` (iscrizione valida o abbonamento attivo), `can_view_lesson`.
- Visitatori: corsi pubblicati, titoli dei moduli, lezioni `is_free_preview`. Il programma completo
  si legge con la RPC `course_outline()` che **non** restituisce id video né descrizioni.
- Studenti: contenuti dei corsi a cui hanno accesso; scrivono solo avanzamento, note, domande e
  risposte proprie. Il profilo è modificabile solo nei campi personali (ruolo e tenant esclusi a
  livello di privilegi di colonna).
- Instructor/admin: tutto nel proprio tenant. Ordini, attestati e abbonamenti li scrive solo il
  server con la chiave segreta (webhook, cron).
- Tenant, corso e flag "docente" sono calcolati da trigger: il client non può falsificarli.
- Storage: `copertine` pubblico in lettura; `materiali` privato, file scaricabile solo se esiste in
  `lesson_resources` e la lezione è visibile all'utente.
- Verifica attestati: RPC pubblica `verify_certificate(codice)` con i soli dati stampati.

## Decisioni prese

- **Next.js 15.5** come richiesto (la 16 è uscita, ma lo stack non si cambia senza il tuo ok).
- **Tailwind v4** (token in `globals.css` con `@theme`), compatibile con shadcn/ui.
- **Nomi colonne in italiano** come nelle tue specifiche; nomi tabelle in inglese.
- **Docenti in una tabella separata** (`instructors`): la scheda pubblica non espone il profilo privato.
- **`lessons.course_id`** ridondante (riempito da trigger) per URL `/app/corsi/[slug]/[lezione]` e RLS veloci.
- **Ordini conservati** anche se l'utente cancella l'account (obblighi fiscali): `user_id` diventa null.
- Progetto in **cartella separata `academy/`** perché il repository contiene già altri progetti.

## Decisioni della Fase 2

- **Login dal browser** (supabase-js nel client) e non da Server Action: i limiti anti-tentativi di
  Supabase Auth valgono per l'IP di chi prova; dal server sarebbero condivisi da tutti gli utenti.
- **"Ricordami"**: cookie-marcatore `nx_ricordami` (persistente se acceso, di sessione se spento).
  Se al ritorno ci sono i cookie Supabase ma non il marcatore, il middleware chiude la sessione.
- **Link di accesso via email** solo per account esistenti (`shouldCreateUser: false`), con lo
  stesso messaggio che l'email esista o no.
- **Lezione gratuita**: serve un account gratuito (le pagine `/app` sono protette). Così ogni
  anteprima porta un contatto.
- **Video**: l'URL embed Bunny viene firmato sul server (`src/lib/bunny.ts`, scadenza 2 ore) solo
  se la select della lezione passa le RLS. Senza chiavi Bunny o senza video il player mostra
  "Il video arriva a breve".
- **Avanzamento**: il player (player.js) manda il minuto ogni 10 s, alla pausa, a fine video e
  quando lasci la pagina (`fetch` con `keepalive`) a `POST /api/progress`. Contano solo i secondi
  guardati in continuità (max 15 per invio); completata oltre il 90% o con il pulsante.
- **Domande**: la funzione `lesson_thread()` mostra solo "Nome I." degli autori, a chi ha accesso
  al corso; i profili restano privati.

## Decisioni della Fase 3 (pagamenti)

- **Abbonamenti Nexora**: Stripe Checkout in modalità abbonamento. Prezzi IVA esclusa con
  `lookup_key` `nexora_<piano>_<mese|anno>`, IVA 22% come aliquota fissa (`STRIPE_TAX_RATE_ID`).
  Chi attiva durante la prova paga dalla fine della prova. Fatture, carta, cambio piano e disdetta
  dal portale clienti Stripe. Stato dell'academy dal webhook: active → attivo, trialing → prova,
  past_due/unpaid → insoluto, canceled → sospeso.
- **Vendite dei clienti con Stripe Connect**: conto collegato Accounts v2 (configurazione "merchant") con dashboard Stripe completa; il
  cliente è il venditore e paga le commissioni Stripe, **Nexora non trattiene nulla** (direct
  charge senza application fee). I corsi Nexora si incassano sul conto della piattaforma.
- **Acquisto corso**: ordine `in_attesa` → Checkout → al ritorno (`/acquisto/completato`) e dal
  webhook l'ordine diventa `pagato` e nasce l'iscrizione. Entrambi idempotenti.
- **Webhook**: `/api/stripe/webhook` (conto Nexora) e `/api/stripe/connect` (conti collegati).
  Con il segreto di firma si verifica la firma; senza, l'evento si rilegge da Stripe con la chiave
  segreta. `stripe_events` evita di elaborare due volte lo stesso evento.
- Ordini, iscrizioni e dati di fatturazione li scrive solo il server con `SUPABASE_SECRET_KEY`:
  senza quella chiave il pulsante "Acquista" resta disattivato.

## Email (Resend)

- Mittente `noreply@nexoragruppodigitale.it`, con il nome dell'academy come nome visualizzato.
- Inviate dal server (`src/lib/email.ts`), mai bloccanti: se l'invio fallisce l'acquisto resta valido.
- Conferma di acquisto allo studente e avviso di vendita agli admin dell'academy, solo quando
  l'ordine passa davvero a "pagato" (aggiornamento condizionato + chiave anti-duplicato Resend).
- Benvenuto a chi crea un'academy. Testi in `src/lib/email-templates.ts` (testati).

## Pannelli di gestione (Fase 4)

- **Admin dell'academy** (`/admin`): panoramica con vendite del mese, studenti attivi (30 giorni),
  completamento medio e lezione dove gli studenti si fermano; studenti con ricerca, scheda e
  accesso manuale ai corsi; vendite con export CSV; domande con risposta (email allo studente).
  I numeri arrivano da funzioni del database (`admin_*`) che controllano che chi chiede sia staff.
- **Piattaforma** (`/piattaforma`, solo dominio principale, solo `platform_admins`): tutte le
  academy dei clienti con stato, piano, Stripe, studenti, corsi e vendite; incasso mensile
  ricorrente; scheda azienda con team, prolungamento prova, cambio piano, sospensione e accesso
  al pannello dell'academy per assistenza (`platform_*`).

## Attestati (Fase 5)

- Rilascio automatico quando lo studente completa tutte le lezioni (`claim_certificate`, idempotente):
  dal player, dal pulsante "Segna come completata" e alla visita di /app/attestati. Email allo studente.
- Nome stampato = nome e cognome del profilo (se mancano, l'app chiede di completarli).
- PDF A4 generato al volo (`pdf-lib`, `/attestati/[codice]/pdf`) con colore dell'academy, codice e QR.
- Verifica pubblica `/attestati/[codice]` con i soli dati stampati (`certificate_details`).

## Documenti legali

- Dati legali di ogni academy (`tenants.dati_legali`: ragione sociale, P.IVA, sede, email, PEC,
  foro) inseriti dal pannello Impostazioni; footer e pagine legali li leggono da lì.
- Piattaforma (solo dominio principale): `/condizioni-servizio` (B2B), `/dpa` (art. 28 GDPR con
  elenco dei sub-responsabili in `src/lib/legal.ts`).
- Ogni academy: `/condizioni-vendita` (B2C, recesso), `/privacy` (titolare = academy, Nexora
  responsabile), `/cookie` (solo tecnici, niente banner).
- Acquisto: casella obbligatoria di rinuncia al recesso per l'accesso immediato (art. 59 lett. o
  Codice del Consumo), salvata in `orders.recesso_rinuncia_il`.
- Creazione academy: versione e data delle condizioni accettate in `tenants.termini_*`.
- Sono bozze da far verificare a un legale.
