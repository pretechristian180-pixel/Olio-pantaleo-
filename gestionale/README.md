# Mattonio — gestionale per agenzie immobiliari

> Il nome del prodotto è in `src/config/app.ts` (interfaccia), `index.html` (titolo e metadati),
> `public/manifest.webmanifest` (app installabile) e `supabase/templates/` (email di sistema).
> Il progetto Supabase si chiama ancora "Casalista": è solo il nome interno nel pannello Supabase.

Interfaccia grafica e navigazione del gestionale, con dati finti realistici (immobili in Puglia).
Il backend (Supabase, autenticazione, più agenzie) verrà collegato in una fase successiva.

## Avvio

```bash
cd gestionale
cp .env.example .env.local   # URL e chiave pubblicabile del progetto Supabase "Casalista"
npm install
npm run dev        # http://localhost:3000
npm run build      # controllo dei tipi + build di produzione
npm run anteprima  # dist-anteprima/mattonio.html: anteprima in un file unico con dati di esempio
```

L'anteprima usa lo stesso codice dell'app, ma sostituisce il collegamento a Supabase con dati di
esempio in memoria (`src/demo/`): serve per mostrare l'app dove Supabase non è raggiungibile.

## Backend: Supabase

- **Progetto**: "Casalista" (`bwpgpsrcddlngpskyajr`, Francoforte).
- **Schema e sicurezza**: `supabase/migrations/`. Ogni tabella operativa ha `agency_id`;
  RLS attiva su tutte le tabelle, con la funzione `get_my_agency_id()` in ogni policy.
  Le chiavi esterne composte `(id, agency_id)` impediscono di collegare dati di agenzie diverse.
- **Permessi**: il titolare vede e modifica tutto della sua agenzia, gestisce utenti e dati
  dell'agenzia. L'agente vede tutti gli immobili e gli appuntamenti dell'agenzia, ma **solo i propri
  contatti** (con la loro ricerca e cronologia), **le proprie trattative** e le proprie "cose da fare";
  modifica solo ciò che ha assegnato (`agente_id`).
- **Registrazione**: chi si registra crea l'agenzia e ne diventa titolare (trigger `handle_new_user`).
- **Inviti**: Impostazioni → Utenti → "Invita un agente" chiama la Edge Function
  `supabase/functions/invita-agente`, che invia l'email; l'agente sceglie la password ed entra già
  collegato all'agenzia.
- **Automatismi** (trigger nel database): cronologia per nuovo contatto, nuovo immobile, nuova trattativa,
  cambio fase e nuovo appuntamento; promemoria automatici "Chiama…" per i nuovi acquirenti e
  "Richiama…, ha visto l'immobile" dopo la fase Visita. Chiamate e WhatsApp sono registrati dall'app.
- **Foto**: bucket privato `property-photos`, percorso `{agency_id}/{property_id}/…`; le foto sono
  ridotte a 1600px e compresse in JPEG prima del caricamento. I loghi stanno nel bucket `agency-logos`.

### Da configurare nel pannello Supabase prima di usarlo con clienti veri

1. **Authentication → URL Configuration**: Site URL = indirizzo dove pubblicherai l'app
   (per lo sviluppo `http://localhost:3000`, già predefinito) e, tra i Redirect URL,
   `<indirizzo app>/imposta-password` e `<indirizzo app>/`.
2. **Authentication → Emails → SMTP**: collega un servizio email (es. Resend, Brevo, Postmark) e
   imposta come nome del mittente **Mattonio**. Senza SMTP Supabase invia le email (conferma
   registrazione, inviti, recupero password) solo agli indirizzi dei membri del team Supabase, con un
   limite di pochi messaggi l'ora.
3. **Authentication → Emails → Templates**: incolla i modelli in italiano di `supabase/templates/`
   (l'oggetto da usare è scritto nella prima riga di ogni file):

   | Modello Supabase | File |
   |---|---|
   | Confirm signup | `conferma.html` |
   | Invite user | `invito.html` |
   | Reset password | `recupero.html` |
   | Change email address | `cambio-email.html` |

## Struttura

```
src/
  app/              rotte (router.tsx) e pagina 404
  components/
    ui/             componenti base shadcn/ui
    layout/         AppShell, menu laterale, barra in basso con "+", ricerca globale
    shared/         EmptyState, ErrorState, PageHeader, StatCard, Avatar, foto immobile
  features/
    auth/           accesso, registrazione, recupero e scelta password, protezione rotte
    today/ properties/ contacts/ deals/ agenda/ settings/
  services/api.ts   UNICO punto di accesso ai dati (query Supabase → oggetti dell'interfaccia)
  lib/              client Supabase, messaggi di errore in italiano, compressione foto, formattazione
  types/            database.ts (tipi generati dallo schema) e domain.ts (modello dell'interfaccia)
supabase/
  migrations/       schema, RLS, trigger, storage, indici
  functions/        invita-agente (Edge Function)
  templates/        email di sistema in italiano (da incollare nel pannello Supabase)
```
