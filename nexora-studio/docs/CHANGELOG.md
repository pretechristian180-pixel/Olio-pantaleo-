# Changelog

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
- Colori e font ufficiali del brand Nexora.
