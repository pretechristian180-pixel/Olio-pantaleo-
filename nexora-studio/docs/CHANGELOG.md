# Changelog

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
