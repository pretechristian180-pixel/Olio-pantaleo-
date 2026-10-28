# Casalista — gestionale per agenzie immobiliari

> "Casalista" è un nome di lavoro: si cambia in `src/config/app.ts` (e nel `<title>` di `index.html`).

Interfaccia grafica e navigazione del gestionale, con dati finti realistici (immobili in Puglia).
Il backend (Supabase, autenticazione, più agenzie) verrà collegato in una fase successiva.

## Avvio

```bash
cd gestionale
npm install
npm run dev        # http://localhost:5173
npm run build      # controllo dei tipi + build di produzione
```

Aggiungi `?vuoto` all'indirizzo per vedere gli **stati vuoti** (e `?pieno` per tornare ai dati di esempio).

## Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · componenti in stile shadcn/ui (Radix) ·
React Router · Sonner (toast) · dnd-kit (kanban) · Inter.

## Struttura

```
src/
  app/              rotte (router.tsx) e pagina 404
  components/
    ui/             componenti base shadcn/ui: Button, Card, Badge, Input/Select, Dialog, Skeleton…
    layout/         AppShell, menu laterale, barra in basso con "+", ricerca globale
    shared/         pezzi riusati tra le sezioni: EmptyState, PageHeader, StatCard, Avatar, foto immobile
  features/
    today/          1. Oggi
    properties/     2. Immobili (lista, scheda, inserimento a 4 passaggi)
    contacts/       3. Contatti (lista con schede, scheda contatto, nuovo contatto)
    deals/          4. Trattative (kanban trascinabile; su telefono colonne scorrevoli)
    agenda/         5. Agenda (giorno/settimana, finestra "Nuovo appuntamento")
  services/
    api.ts          UNICO punto di accesso ai dati (funzioni asincrone)
    store.ts        archivio in memoria che simula il database
  data/mock.ts      dati finti
  types/domain.ts   modello dati (ogni entità ha agencyId)
  hooks/            useQuery, useMediaQuery
  lib/              formattazione (€, date in italiano), etichette e colori
```

## Collegamento a Supabase (prossimo passo)

- Le pagine non leggono mai i dati finti direttamente: passano tutte da `src/services/api.ts`.
  Basterà sostituire il corpo di quelle funzioni con le query Supabase, senza toccare l'interfaccia.
- Ogni entità ha `agencyId` → colonna `agency_id` con policy RLS per separare le agenzie.
- Le foto hanno già il campo `url` (Supabase Storage); senza url viene mostrata un'illustrazione.
- L'autenticazione si innesta in `src/app/router.tsx` avvolgendo `AppShell` in una rotta protetta.
- Le variabili d'ambiente da compilare sono in `.env.example`.

## Regole di design seguite

- Una sola azione principale per schermata, pulsanti alti almeno 48px, testo base 16px.
- Massimo 5 voci di menu, sempre con testo (mai icone da sole).
- Blu `#2563EB` unico colore principale; verde = fatto, arancione = avviso, rosso solo per gli errori.
- Card al posto delle tabelle, skeleton al posto degli spinner, toast in basso per confermare.
