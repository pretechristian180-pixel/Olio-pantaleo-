# Sorpasso AI — gestionale per concessionarie auto

Gestionale SaaS multi-azienda per concessionarie italiane (nuovo e usato): lead, stock, agenda, clienti,
pratiche, report e funzioni AI. Obiettivo: nessun lead perso, risposta immediata, follow-up automatici,
stock sotto controllo e numeri chiari per il titolare.

**Stack:** React 19 · TypeScript · Vite · Tailwind CSS v4 · componenti shadcn/ui (Radix) · TanStack Query ·
react-hook-form + zod · dnd-kit · Recharts · pdf-lib · Supabase (Auth, Postgres con RLS, Storage, Edge Functions).

## Avvio rapido

```bash
cd sorpasso
npm install
cp .env.example .env.local     # compila URL e chiave anon del progetto Supabase
npm run dev                    # http://localhost:5173
```

### 1. Database

Con la [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase link --project-ref <id-progetto>
supabase db push               # applica supabase/migrations
```

La migrazione crea tabelle, viste, trigger, policy RLS, bucket Storage (`vehicle-photos`, `documents`, privati)
e pianifica con `pg_cron` il controllo dei lead in ritardo ogni 5 minuti
(abilita l'estensione **pg_cron** dal pannello Database → Extensions se la migrazione lo segnala).

### 2. Autenticazione

In **Authentication → URL Configuration**:

- *Site URL*: l'indirizzo dell'app (es. `https://app.sorpasso.it` o `http://localhost:5173`)
- *Redirect URLs*: `<sito>/benvenuto`, `<sito>/imposta-password`, `<sito>/invito`

### 3. Edge Functions e chiave AI

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-... SITE_URL=https://app.sorpasso.it
# facoltativi: AI_MODEL (default claude-opus-5-5), ALLOWED_ORIGIN (default *)
supabase functions deploy ai
supabase functions deploy invita-utente
```

La chiave AI vive solo nei secrets di Supabase: il browser chiama la funzione `ai` con il token dell'utente,
la funzione legge i dati **con i permessi dell'utente** (RLS) e poi interroga il modello.

### 4. Dati demo

```bash
# in .env.local: VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
npm run seed
```

Crea "Autosalone Levante (demo)" con 6 utenti (password `Sorpasso2026!`):

| Ruolo | Email |
|---|---|
| Titolare | `titolare@demo.sorpasso.it` |
| Responsabile vendite | `responsabile@demo.sorpasso.it` |
| Venditori | `venditore1@…`, `venditore2@…`, `venditore3@demo.sorpasso.it` |
| Amministrazione | `amministrazione@demo.sorpasso.it` |

…più 25 auto (alcune oltre soglia di giacenza, con storico prezzi), 40 lead in tutte le fasi con storico attività,
preventivi, 4 vendite con pratica, appuntamenti della settimana corrente. Lo script è ripetibile: cancella e ricrea
solo la concessionaria demo.

## Struttura

```
sorpasso/
  supabase/
    migrations/                 schema, RLS, trigger, viste, funzioni, storage, pg_cron
    functions/
      _shared/prompts.ts        ← TUTTI I PROMPT AI (modificabili qui)
      _shared/http.ts           CORS, client Supabase utente/servizio, errori
      ai/                       descrizione annuncio, suggerisci risposta, riassunto lead
      invita-utente/            invito colleghi (solo titolare)
  scripts/seed.ts               dati demo
  src/
    app/router.tsx              rotte, accesso protetto, limiti per ruolo
    components/ui|layout|shared componenti base, menu (sidebar + barra in basso), stati vuoti/errore
    features/<sezione>/         una cartella per sezione: pagine + api.ts (query e mutation)
      oggi, leads, stock, agenda, clienti, pratiche, report, impostazioni, auth
    lib/                        supabase, auth, errori in italiano, formattazione, etichette, AI, storage, zod
    types/db.ts                 tipi delle tabelle
```

## Pagine

| Rotta | Pagina |
|---|---|
| `/` | **Oggi** — lead da contattare (rossi se in ritardo), lead senza prossima azione, follow-up di oggi, appuntamenti, auto ferme; KPI del mese per titolare/responsabile |
| `/lead`, `/lead/:id`, `/lead/:id/preventivo` | Kanban trascinabile e tabella con filtri · scheda lead con azioni rapide e AI · preventivo con PDF |
| `/stock`, `/stock/nuovo`, `/stock/:id` | Griglia con badge giacenza · scheda auto con foto, AI annuncio, lead interessati, clienti compatibili, storico prezzo |
| `/agenda` | Settimana per venditore (giorno su telefono) |
| `/clienti`, `/clienti/:id` | Contatti con storico acquisti, lead, documenti e consensi |
| `/pratiche`, `/pratiche/:id` | Vendite chiuse con checklist, avanzamento e documenti |
| `/report` | Fonti, venditori, mesi, conversione, motivi di perdita |
| `/impostazioni` | Profilo, azienda, utenti e ruoli, soglie e automazioni, template messaggi |

## Regole automatiche (nel database)

| Regola | Dove |
|---|---|
| Nuovo lead → venditore attivo con meno lead aperti (round robin, disattivabile) | trigger `leads_prima_di_inserire` |
| Il venditore che inserisce un lead lo tiene per sé | idem |
| Prima chiamata/WhatsApp/email → `primo_contatto_at`, lead da "nuovo" a "contattato" | trigger `activities_dopo_inserimento` |
| Ogni cambio di fase finisce nello storico | trigger `leads_dopo` |
| Lead senza prossima azione → evidenziato in Oggi | vista `leads_view.senza_prossima_azione` |
| Lead non contattato oltre il tempo massimo → notifica a venditore e responsabile | `controlla_lead_in_ritardo()` via pg_cron |
| Auto oltre la soglia di giacenza → segnalata in Oggi e Stock | vista `vehicles_view.oltre_soglia` |
| Nuova auto → clienti potenzialmente interessati (lead aperti o persi ≤ 90 gg compatibili) | funzione `clienti_compatibili()` |
| Test drive fissato / preventivo creato → il lead avanza di fase | trigger su `appointments` e `quotes` |
| Vendita chiusa → auto "venduta", lead "vinto", avviso sugli altri lead della stessa auto | trigger `deals_dopo_inserimento` |
| Punteggio lead 0-100 calcolato da budget, tempistica, fase… | `calcola_punteggio()` |

Ogni automazione scrive in `automations_log` (visibile in Impostazioni → Soglie e automazioni).

## Ruoli e permessi (RLS)

| | Titolare | Resp. vendite | Venditore | Amministrazione |
|---|---|---|---|---|
| Lead, attività, preventivi | tutto | tutto | solo i propri | lettura |
| Contatti | tutto | tutto | i propri | lettura |
| Stock | gestione | gestione | lettura + foto | lettura |
| Prezzo di acquisto / margine | ✓ | ✓ | — | — |
| Pratiche e documenti | tutto | tutto | lettura delle proprie | tutto |
| Utenti, inviti, impostazioni azienda | gestione | lettura | lettura | lettura |

Lo storico (`activities`) non si modifica né si cancella e resta all'azienda anche se il venditore se ne va.

## Qualità

- Validazione dei form con zod, messaggi in italiano.
- Errori tradotti (`src/lib/errors.ts`) e mostrati con toast; nei log finisce solo il codice dell'errore, mai dati personali.
- Skeleton durante i caricamenti, stati vuoti con un'azione chiara.
- Foto ridotte nel browser prima del caricamento (rete lenta in piazzale), file privati con URL firmati temporanei.
