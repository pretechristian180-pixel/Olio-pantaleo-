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
- **Matching** (migrazione `20261029130000_matching.sql`):
  - le zone si scelgono da una lista unica dell'agenzia (`zones`, gestita in Impostazioni → Agenzia);
  - `match_eval` calcola un punteggio 0-100 con i motivi: contratto, budget (+10% di margine), metri quadri
    (−10%) e zona sono obbligatori; budget, metri quadri, locali e tipo aggiungono o tolgono punti;
  - i match finiscono in `matches` con uno stato (da proporre, proposto, interessato, scartato) e si
    ricalcolano da soli quando cambia un immobile o una ricerca; chi ha scartato un immobile non se lo
    vede riproporre;
  - ogni agente riceve una "cosa da fare" quando compaiono match per i suoi clienti (anche se l'immobile
    l'ha inserito un collega), senza vedere i clienti degli altri;
  - "Proponi su WhatsApp" apre WhatsApp con il messaggio già scritto e segna il match come proposto.
- **Foto**: bucket privato `property-photos`, percorso `{agency_id}/{property_id}/…`; le foto sono
  ridotte a 1600px e compresse in JPEG prima del caricamento. I loghi stanno nel bucket `agency-logos`.

### Pannello admin della piattaforma (`/admin`)

Per chi gestisce Mattonio: elenco di tutte le agenzie con piano, stato e numeri; creazione di una nuova
agenzia con invito via email al titolare; modifica di dati e piano; sospensione/riattivazione
dell'agenzia (gli utenti vengono bloccati, i dati restano); gestione degli utenti di ogni agenzia
(invito, ruolo titolare/agente, disattivazione, "reinvia invito").

- Gli amministratori sono nella tabella `platform_admins` (per email confermata). Il loro account non
  appartiene a nessuna agenzia: dopo l'accesso finiscono direttamente nel pannello admin.
- Letture e modifiche passano da funzioni SQL riservate (`admin_*`, migrazione `20261029140000_admin_piattaforma.sql`);
  creazione agenzie e inviti dalla Edge Function `supabase/functions/admin-piattaforma`.
- Ogni agenzia conserva sempre almeno un titolare attivo.
- Per creare il proprio account admin: Supabase → Authentication → Users → **Add user**, con l'email
  registrata in `platform_admins`, una password e "Auto Confirm User". Poi si accede da `/accedi`.
  Per aggiungere un altro admin: `insert into public.platform_admins (email) values ('nome@dominio.it');`

### Studio: video social degli immobili (`/studio`) — Fase 1

Reel verticali 9:16 con l'avatar AI del titolare (inizio e chiusura) e, nel mezzo, **solo le foto
reali dell'immobile** animate con movimenti di camera (zoom lento, panoramica, parallasse leggera).
Nessun modello che genera o modifica gli ambienti: l'unica parte generata è l'avatar.

- Creazione in 3 passi (`/studio/nuovo/:immobile`): foto in ordine (trascinamento, avvisi sotto 5 foto
  o a bassa risoluzione) → testo proposto dall'AI (Edge Function `studio-script`, solo dati della scheda,
  modificabile, "Rigenera") → riepilogo e "Genera video".
- Approvazione (`/studio/video/:id`): "Approva e programma", "Chiedi modifiche" (con nota), "Scarta".
  Solo il titolare o l'approvatore scelto nel brand; ogni decisione in `video_approvals` e `activities`.
- Link WhatsApp monouso (7 giorni) che apre `/approva/:token` senza login: Edge Function
  `studio-approvazione`; nel database c'è solo l'impronta SHA-256 del token.
- Calendario settimanale/mensile con trascinamento per cambiare giorno ai post non ancora pubblicati.
- Impostazioni Studio (`/studio/impostazioni`): avatar (video di training, consenso firmato con PDF,
  revoca), stile/brand, account social, utilizzo del mese.
- **Fase 1**: la generazione è simulata (`studio_tick` completa i lavori dopo pochi secondi e il player
  mostra un'anteprima nel browser). Fase 2: HeyGen + servizio di rendering. Fase 3: pubblicazione sui social.
- Controlli lato server (migrazione `20261030090000_studio_fase1.sql`): niente generazione senza avatar
  con consenso valido; limite di generazioni ogni 24 ore per piano (`plan_limits`, modificabile senza
  codice); niente post senza un'approvazione con esito "approvato".

### Acquisizioni (`/trattative/acquisizioni`)

Seconda pipeline accanto alle Vendite (voce di menu **Pipeline**, schede Vendite / Acquisizioni): serve
a trovare il proprietario e ottenere l'incarico.

- Fasi: segnalazione → primo contatto → valutazione fissata → valutazione fatta → proposta di incarico →
  incarico firmato (oppure persa, con motivo obbligatorio). Le card mostrano indirizzo, proprietario,
  prezzo e giorni nella fase (in arancio oltre 14 giorni).
- Inserimento rapido con 3 campi (anche dal pulsante "+"): indirizzo, nome e telefono del proprietario.
  Stesso telefono (anche con +39) = stesso contatto.
- "Incarico firmato" crea l'immobile con i dati raccolti, collega il proprietario e apre `/immobili/:id/foto`.
- In OGGI la card "Acquisizioni da seguire" (prossima azione scaduta o di oggi); in fondo alla pagina
  le statistiche del mese.
- Tabella `acquisitions` (migrazione `20261101090000_acquisizioni.sql`): l'agente vede e modifica solo
  le proprie, il titolare tutte. Fase, motivo di perdita e immobile collegato cambiano solo con la funzione
  `acquisition_set_phase()`, che fa i controlli lato server. Ogni cambio finisce nelle attività del proprietario.

### Schede complete (contatti, richieste, immobili, documenti, visite)

- Contatti: ruoli locatore/inquilino/collaboratore/altro, etichette con filtro, compleanno, consenso alle
  comunicazioni, modifica della scheda; più richieste per cliente con caratteristiche desiderate (il matching
  usa la richiesta migliore e le caratteristiche).
- Immobili: stato "Sospeso", caratteristiche, modifica, link a Google Maps; "Cosa dicono i visitatori".
- Documenti: tabella `documents` + bucket privato `documenti` ({agency_id}/...), per contatto, immobile,
  trattativa o acquisizione, con scadenze.
- Checklist (`checklist_items`): documenti dell'immobile e antiriciclaggio della trattativa
  (`/trattative/vendita/:id`), voci standard preparate da `checklist_prepare()`, chi e quando ha completato.
- Scheda visita (`visit_feedback`): "Com'è andata la visita?" sugli appuntamenti passati.
- In OGGI: "Documenti da sistemare". L'analisi completa delle richieste è in `docs/analisi-funzionalita.md`.

### Automazioni (`/impostazioni/automazioni`)

"Quando succede X, aspetta Y, fai Z", con 15 ricette pronte create per ogni agenzia (10 già accese).
- Tabelle: `automations`, `automation_runs`, `message_templates`, `opt_outs`, `messaging_settings`
  (migrazioni `20261103090000`–`20261103093000`).
- I trigger sulle tabelle creano le esecuzioni; `automation_sweep()` crea quelle a calendario (scadenze,
  compleanni, inattività, report ogni 15 giorni, festività). La Edge Function `automazioni` gira ogni 5 minuti
  (pg_cron, segreto nel Vault) e invia.
- Prima di ogni invio (`automation_prepare`): contatto escluso → saltata; evento cambiato → annullata; niente
  invii 21:00–8:30 né la domenica; al massimo 1 messaggio automatico al giorno per contatto; consenso per i
  messaggi promozionali. Ogni esecuzione finisce nelle attività del contatto.
- WhatsApp solo con l'API ufficiale (Cloud API) e modelli approvati da Meta; altrimenti email (Resend);
  altrimenti una cosa da fare per l'agente. Codice dei fornitori in `supabase/functions/automazioni/providers.ts`.
- Risposte WhatsApp e "STOP": Edge Function `whatsapp-webhook`. Questionario dopo la visita (`/questionario/:token`)
  e disiscrizione dalle email (`/disiscrizione/:token`): Edge Function `automazioni-pubblico`.
- I contatti con `importato = true` non ricevono il benvenuto.

### Importazione guidata (`/impostazioni/importa`, solo titolare)

Contatti, richieste, immobili, acquisizioni e appuntamenti da Excel (.xlsx) o CSV, fino a 10.000 righe.
- Tabelle `import_jobs` e `import_rows`, bucket privato `imports` (una cartella per agenzia, file eliminati
  dopo 30 giorni). Migrazioni `20261104090000`–`20261104091000`.
- Quattro passi: tipo (ordine consigliato, avviso se mancano i contatti) → file (letto nel browser,
  `src/lib/spreadsheet.ts`) → colonne (proposte dall'AI con la Edge Function `importazione`, altrimenti
  riconoscimento automatico in `src/features/import/fields.ts`; le colonne non importate vanno nelle note)
  → controllo (`import_preview`: prime 20 righe pulite, conteggi di pronte, doppioni ed errori).
- Pulizia nel database: telefoni in formato internazionale, email minuscole, nomi con la maiuscola,
  prezzi e metri quadri come numeri. Doppioni = stesso telefono o stessa email: salta, completa i campi
  vuoti o crea comunque.
- L'importazione va a blocchi (`import_process`): dall'app finché la pagina è aperta, poi da pg_cron ogni
  minuto (`import_tick`). Durante l'importazione niente cose da fare né messaggi automatici a pioggia.
- Riepilogo con Excel delle righe non importate e del motivo; "Annulla importazione" entro 24 ore
  (`import_undo`) elimina solo le schede create da quel file.

### Da configurare nel pannello Supabase prima di usarlo con clienti veri

1. **Authentication → URL Configuration**: Site URL = indirizzo dove pubblicherai l'app
   (per lo sviluppo `http://localhost:3000`, già predefinito) e, tra i Redirect URL,
   `<indirizzo app>/imposta-password` e `<indirizzo app>/`.
   Le pagine `/approva/...` dei link WhatsApp usano lo stesso indirizzo dell'app.
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

4. **Edge Functions → Secrets**: `ANTHROPIC_API_KEY` per i testi AI di Studio (senza chiave si usa un
   testo di base costruito con i dati della scheda).
5. **Testo del consenso avatar**, dopo la revisione legale:
   `insert into public.consent_templates (versione, testo, attivo) values ('1.0', '…testo…', true);`
   (per una nuova versione: prima `update public.consent_templates set attivo = false where attivo;`).

6. **Automazioni** (Edge Functions → Secrets): `APP_URL` (indirizzo dell'app, per i link di questionario e
   disiscrizione), `RESEND_API_KEY` e `EMAIL_FROM` (email), `WHATSAPP_TOKEN`, `WHATSAPP_WABA_ID`,
   `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` (WhatsApp). Webhook su Meta:
   `https://bwpgpsrcddlngpskyajr.supabase.co/functions/v1/whatsapp-webhook`.
7. **Importazione guidata**: `ANTHROPIC_API_KEY` (lo stesso di Studio) per l'abbinamento delle colonne con
   l'AI; senza chiave si usa il riconoscimento automatico. Nessun'altra configurazione: i job programmati
   `importazioni` e `importazioni-pulizia` sono già attivi.

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
