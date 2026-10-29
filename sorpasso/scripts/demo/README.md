# Demo navigabile del gestionale

Una versione del gestionale in **un unico file HTML**, con i dati della concessionaria demo incorporati:
si apre da un link, senza login e senza Supabase. Le modifiche mostrano il messaggio di conferma ma non vengono salvate
(banner in alto). Nella build normale tutto questo codice è assente (`src/demo/config.ts`: `DEMO` è false).

Come funziona (`src/demo/`):
- `prepara.ts` intercetta le chiamate a Supabase e risponde con le registrazioni; sposta l'orologio al momento
  della registrazione, così "in attesa da 15 minuti" resta vero;
- il router è in memoria (`createMemoryRouter`), la sessione del titolare è pre-caricata (`memoria.ts`).

## Rifarla (dopo nuove funzioni o nuovi dati)

1. Un database con i dati di `npm run seed` e l'app che punta a quell'API (`VITE_SUPABASE_URL=… npx vite --port 5174`).
2. `APP=http://localhost:5174 API=<url api> PGDATABASE=<db> node scripts/demo/registra.cjs`
   → `registrazioni.json` e `meta.json` (con `AGGIUNGI=1` completa una registrazione esistente).
3. `node scripts/demo/build.mjs scripts/demo/registrazioni.json scripts/demo/meta.json dist-demo/sorpasso-demo.html`

Limiti: si entra solo come titolare; scaricamenti (CSV, PDF) e link esterni dipendono da dove viene aperta la pagina.
