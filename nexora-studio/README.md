# Nexora Studio

Piattaforma SaaS di Nexora Gruppo Digitale. Ogni settimana le aziende ricevono gli script dei video
da girare, caricano il girato e ricevono i video montati con l'AI. Li approvano e la piattaforma li
programma sui loro social.

> Stato: Fase 0 completata, base grafica pronta, schema della Fase 1 in attesa di approvazione.
> Vedi `docs/CHANGELOG.md`.

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
  supabase/          Configurazione della CLI e migrazioni SQL
  docs/              CHANGELOG e documentazione
```

npm workspaces: un solo `npm install` dalla cartella `nexora-studio/`.

## Fornitori (dietro adapter sostituibili)

| Adapter | Prima implementazione |
| --- | --- |
| `LLMProvider` | Anthropic Claude |
| `TranscriptionProvider` | Whisper via API OpenAI |
| `BrollProvider` | Horacle (AI + stock) |
| `PublishingProvider` | Metricool |

Le interfacce sono in `packages/shared/src/providers/`. Le implementazioni arrivano nelle fasi
2-4.

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
cp .env.example worker/.env
npm run worker:dev                # Node legge worker/.env solo se esportato nell'ambiente
```

Controlli:

```bash
npm run lint
npm run typecheck
npm run build
```

`GET /api/health` risponde con lo stato dell'app e indica se Supabase è configurato.

## Supabase

- Progetto: `nexora-studio`, organizzazione NEXORA, regione `eu-central-1`.
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
