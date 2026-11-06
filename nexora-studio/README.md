# Nexora Studio

Piattaforma SaaS di Nexora Gruppo Digitale. Ogni settimana le aziende ricevono gli script dei video
da girare, caricano il girato (anche in più clip: riprese parlate, che l'AI mette in ordine, e
clip di copertura) e ricevono i video montati con l'AI. Li approvano e la piattaforma li
programma sui loro social.

> Stato: **Fase 7 completata** (landing, Sentry, backup, checklist di lancio). Su
> `https://studio.nexoragruppodigitale.it` con il database Supabase online. Prima di aprire ai clienti:
> `docs/LANCIO.md` (chiavi dei fornitori, worker su Railway, testi legali).
> Vedi `docs/CHANGELOG.md`.

## Area admin (team Nexora)

Profili con `is_admin`, da `/admin`:

| Pagina | A cosa serve |
| --- | --- |
| Aziende | Crea l'azienda di un cliente, compila tu il profilo e invita il titolare (all'accettazione il team diventa collaboratore) |
| Dashboard | Ricavi ricorrenti, aziende abbonate e in prova, margine, video al giorno, tempi di montaggio (obiettivo 15 minuti), costo medio per video, salute della coda e avviso se il worker è fermo |
| Revisione | Video in controllo interno prima dell'invio al cliente |
| Job | Coda del worker con filtri, errori, "Riprova" (job falliti) e "Annulla" (job in coda) |
| Costi | Costo di ogni video per passaggio (trascrizione, montaggio AI, b-roll, render, pubblicazione) e aziende che costano di più |
| Abbonamenti | Stato del pagamento di ogni azienda e founding member |
| Piani | Limiti e prezzi della tabella `plans` |
| Social | Brand Metricool e link di collegamento per azienda |

Le azioni del team finiscono nel registro attività (`audit_log`).

## Documentazione

| File | Contenuto |
| --- | --- |
| `docs/LANCIO.md` | Checklist di lancio: configurazione, criteri di accettazione, prove finali |
| `docs/STRIPE.md` | Abbonamenti e pagamenti |
| `docs/METRICOOL.md` | Collegamento dei social e pubblicazione |
| `docs/BACKUP.md` | Backup cifrati e ripristino |
| `docs/BRAND.md` | Identità visiva |
| `docs/CHANGELOG.md` | Cosa è stato fatto in ogni fase |

## Struttura

```
nexora-studio/
  app/               Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui → Vercel
    src/app/         Route (interfaccia in italiano)
    src/components/  Componenti UI (shadcn in components/ui)
    src/lib/         Supabase (client, server, proxy), env, utility
    src/proxy.ts     Proxy di Next 16 (ex middleware): rinnovo della sessione Supabase
  worker/            Servizio Node + FFmpeg per i job (trascrizione, montaggio, render,
                     pubblicazione) → Railway (Dockerfile + railway.json)
  packages/shared/   Tipi di dominio e interfacce degli adapter, usati da app e worker:
                     TranscriptionProvider, LLMProvider, BrollProvider, PublishingProvider
  packages/video-engine/  Motore di montaggio (timeline, sottotitoli anti-volto, render FFmpeg,
                     libreria musicale): futuro repository nexora-video-engine
  supabase/          Configurazione della CLI e migrazioni SQL
  docs/              CHANGELOG e documentazione
```

npm workspaces: un solo `npm install` dalla cartella `nexora-studio/`.

## Fornitori (dietro adapter sostituibili)

| Adapter | Prima implementazione |
| --- | --- |
| `LLMProvider` | Anthropic Claude (`claude-opus-5-5`) |
| `TranscriptionProvider` | Whisper sul worker (faster-whisper, `large-v3-turbo`): l'audio non esce dal server. In alternativa API OpenAI |
| `BrollProvider` | Pexels (stock gratuito); Horacle in futuro per il b-roll AI |
| `PublishingProvider` | Metricool (vedi `docs/METRICOOL.md`) |
| `BillingProvider` | Stripe (vedi `docs/STRIPE.md`) |

Le interfacce sono in `packages/shared/src/providers/`. Il codice solo server (SDK Anthropic, servizi,
email) si importa da `@nexora/shared/server`.

## Avvio in locale

Requisiti: Node 22+, npm 10+. FFmpeg è necessario solo per il worker.

```bash
cd nexora-studio
npm install                       # compila anche @nexora/shared
cp .env.example app/.env.local    # compila URL e chiavi Supabase
npm run dev                       # http://localhost:3000
```

Worker:

```bash
cp .env.example worker/.env       # SUPABASE_URL, SUPABASE_SECRET_KEY, ANTHROPIC_API_KEY…
npm run worker:dev
```

Senza chiave Anthropic, in locale: `LLM_PROVIDER=demo` (script finti) ed `EMAIL_PROVIDER=mailpit`
(email su http://127.0.0.1:54324). Con `next start` serve anche `ALLOW_DEMO_PROVIDERS=true`.

Controlli:

```bash
npm run lint
npm run typecheck
npm run build
npm test -w @nexora/shared && npm test -w @nexora/worker
```

`GET /api/health` risponde con lo stato dell'app e indica se Supabase è configurato.

## Supabase

### In locale (consigliato per sviluppare)

```bash
npx supabase start          # serve Docker: database, auth, storage, Mailpit per leggere le email
npx supabase status         # URL e chiavi locali da mettere in app/.env.local
```

Le email di conferma si leggono su Mailpit: http://127.0.0.1:54324

### Progetto online

- Progetto Supabase `nexora-studio` (`zpbdaodsyufmndprcbdk`), con tutte le migrazioni applicate.
- Da completare: template email, Site URL e Redirect URLs (vedi `docs/LANCIO.md`).
- Le migrazioni stanno in `supabase/migrations/`. Ogni schema viene approvato prima di applicarlo.
- Tipi TypeScript del database: `npm run db:types` (richiede `supabase link`).
- Nell'app si usa solo la chiave **publishable** (con RLS). La chiave **secret** serve solo al
  worker e alle route server.

## Deploy

- **App → Vercel**: root directory `nexora-studio/app`, install command `cd .. && npm install`.
  Da configurare nella fase di deploy.
- **Worker → Railway**: build dal `worker/Dockerfile` con contesto `nexora-studio/`
  (`railway.json` nella radice di `nexora-studio/`: impostare la root directory del servizio Railway su `nexora-studio`).
- Dominio previsto: `studio.nexoragruppodigitale.it`.

## Design

Base grafica ricavata dal logo Nexora: blu elettrico, argento, nero profondo. Tema scuro di base con
versione chiara. Token in `app/src/app/globals.css`, guida in `docs/BRAND.md`, anteprima viva su
`/design-system`.
