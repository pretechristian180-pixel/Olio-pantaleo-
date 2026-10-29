# Fatturazione automatica Stripe → Fatture in Cloud

Ogni pagamento **incassato** su Stripe diventa una fattura elettronica su Fatture in Cloud (FIC), verificata e inviata allo SDI senza interventi manuali. I rimborsi diventano note di credito collegate alla fattura originale.

```
Stripe ──webhook──▶ stripe-webhook ──▶ invoice_jobs (coda)
                                          │  pg_cron ogni 2 minuti
                                          ▼
                                   invoice-agent ──▶ Stripe API (fattura, righe, incasso)
                                          │        ──▶ FIC: cliente → documento → xml_verify → invio SDI
                                          │        ──▶ invoices + email di cortesia con PDF
FIC ──notifica esito SDI──▶ fic-webhook ──▶ invoices.stato_sdi (+ avviso se scartata)
Pannello admin (React) ──▶ billing-admin / fic-subscribe
```

## Struttura

| Percorso | Contenuto |
|---|---|
| `supabase/migrations/20261101100000_fatturazione.sql` | Tabelle, RLS solo admin, funzioni coda/backoff, pg_cron |
| `supabase/functions/stripe-webhook` | Firma Stripe, idempotenza su `stripe_events`, accodamento fatture e note di credito |
| `supabase/functions/invoice-agent` | Elabora la coda, controllo esiti giornaliero, riepilogo del lunedì (chiamata da pg_cron) |
| `supabase/functions/fic-webhook` | Riceve gli esiti SDI da FIC e rilegge lo stato via API |
| `supabase/functions/fic-subscribe` | Registra la subscription FIC per gli esiti SDI |
| `supabase/functions/billing-admin` | Azioni del pannello: riprova, reinvia, correggi e reinvia, PDF, link FIC, sincronizzazione Stripe |
| `supabase/functions/_shared` | Logica (pura e testata): validazione, mappatura Stripe→FIC, client Stripe/FIC, agente, email, mascheramento log |
| `pannello/` | Pannello amministratore (Vite + React + Tailwind) |

## Sicurezza

- Le chiavi (Stripe, FIC, Resend) stanno **solo** nei secrets delle Edge Functions. Il pannello usa solo URL e chiave anon di Supabase.
- Tutte le tabelle hanno RLS: leggono solo gli utenti in `app_admins`. Gli amministratori modificano solo dati di fatturazione, configurazione fiscale e stato degli avvisi; il resto lo scrivono solo le Edge Functions (service role).
- **Doppio interruttore per l'invio reale**: si invia allo SDI solo se `EINVOICE_LIVE=true` **e** la chiave Stripe è `sk_live_…`. In tutti gli altri casi l'invio usa `dry_run=true` e l'email di cortesia va all'amministratore con oggetto `[PROVA]`.
- Un pagamento non può generare due fatture: evento Stripe registrato una sola volta, indice univoco *una fattura per invoice Stripe* e *una nota per rimborso*, id del documento FIC salvato appena creato (una ripresa dopo un errore non lo ricrea).
- Log in `operation_logs` per ogni operazione, con P.IVA, codice fiscale, email e nomi mascherati.

## Configurazione

### 1. Database

```bash
supabase db push        # applica la migrazione
```

Estensioni richieste: `pg_cron`, `pg_net` (attivale da Dashboard → Database → Extensions **prima** della migrazione, che pianifica i job solo se sono presenti).

Poi, dall'SQL editor, i due segreti usati da pg_cron:

```sql
select vault.create_secret('https://<progetto>.supabase.co/functions/v1', 'fatturazione_functions_url');
select vault.create_secret('<stessa stringa di CRON_SECRET>', 'fatturazione_cron_secret');
-- amministratore del pannello (utente creato prima in Authentication)
insert into public.app_admins (user_id, email) select id, email from auth.users where email = 'tu@azienda.it';
```

Pianificazioni: coda ogni 2 minuti, controllo esiti in ritardo ogni giorno alle 07:15 UTC, riepilogo il lunedì alle 06:45 UTC. Se la migrazione è stata applicata prima di attivare pg_cron, pianificale a mano:

```sql
select cron.schedule('fatturazione-coda', '*/2 * * * *', 'select public.chiama_agente_fatturazione(''coda'')');
select cron.schedule('fatturazione-esiti', '15 7 * * *', 'select public.chiama_agente_fatturazione(''controllo_esiti'')');
select cron.schedule('fatturazione-riepilogo', '45 6 * * 1', 'select public.chiama_agente_fatturazione(''riepilogo_settimanale'')');
```

### 2. Secrets delle Edge Functions

```bash
supabase secrets set \
  STRIPE_SECRET_KEY=sk_test_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  FIC_ACCESS_TOKEN=... \
  FIC_COMPANY_ID=123456 \
  EINVOICE_LIVE=false \
  CRON_SECRET=<stringa casuale lunga> \
  FIC_WEBHOOK_TOKEN=<altra stringa casuale lunga> \
  RESEND_API_KEY=re_... \
  EMAIL_MITTENTE="Fatturazione <fatture@tuodominio.it>" \
  AVVISI_EMAIL_A=amministrazione@tuodominio.it,tu@tuodominio.it \
  PANNELLO_URL=https://fatturazione.tuodominio.it \
  ALLOWED_ORIGIN=https://fatturazione.tuodominio.it
```

Facoltativi: `FUNCTIONS_URL` (predefinito `${SUPABASE_URL}/functions/v1`), `FIC_URL_DOCUMENTO` (vedi «Da verificare»).

Token FIC: token di accesso dell'app su Fatture in Cloud con permessi su clienti, documenti emessi, fatture elettroniche, impostazioni (lettura di tipi IVA e conti) e webhooks.

### 3. Deploy delle funzioni

```bash
supabase functions deploy stripe-webhook --no-verify-jwt   # firmato da Stripe
supabase functions deploy invoice-agent  --no-verify-jwt   # protetto da CRON_SECRET
supabase functions deploy fic-webhook    --no-verify-jwt   # protetto dal token nell'URL + rilettura via API
supabase functions deploy fic-subscribe                    # JWT admin (o CRON_SECRET)
supabase functions deploy billing-admin                    # JWT admin
```

### 4. Stripe

Dashboard → Developers → Webhooks → endpoint `https://<progetto>.supabase.co/functions/v1/stripe-webhook`, eventi:

- `invoice.paid` → fattura (solo a pagamento incassato, mai alla creazione dell'abbonamento)
- `charge.refunded` → nota di credito per i rimborsi riusciti
- `refund.updated` → nota di credito per i rimborsi SEPA che diventano riusciti dopo

Le chiamate all'API Stripe sono fissate alla versione `2025-02-24.acacia` (`_shared/stripe.ts`): un cambio di versione dell'account non cambia la forma dei dati.

I dati di fatturazione del cliente stanno in `billing_profiles` e, uguali, nei **metadata del Customer** Stripe (`ragione_sociale`, `partita_iva`, `codice_fiscale`, `indirizzo`, `cap`, `comune`, `provincia`, `nazione`, `codice_destinatario`, `pec`, `email_amministrativa`, `tipo`). Se il profilo manca nel database l'agente lo crea dai metadata; se manca un dato obbligatorio il job va in `dati_mancanti` con avviso.

### 5. Pannello

```bash
cd pannello
cp .env.example .env    # VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm install
npm run dev             # oppure npm run build → dist/
```

Al primo accesso: **Configurazione fiscale** (compilare tutto con il commercialista, scegliere tipo IVA e conto di incasso letti da FIC), poi **Avvisi → Collega esiti SDI**.

## Prova senza fatture vere

1. Stripe in modalità test (`sk_test_…`) e `EINVOICE_LIVE=false`.
2. `stripe listen --forward-to https://<progetto>.supabase.co/functions/v1/stripe-webhook` oppure l'endpoint di test della Dashboard.
3. Crea un Customer di test con i metadata di fatturazione (o il profilo dal pannello) e fai pagare un abbonamento di test con la carta `4242 4242 4242 4242`. `stripe trigger invoice.paid` funziona ma crea un cliente senza dati: il job finirà correttamente in `dati_mancanti`.
4. Entro 2 minuti: documento creato su FIC, `xml_verify` eseguito, invio con `dry_run=true` (nessun invio allo SDI), riga in **Fatture** con badge «Prova», email `[PROVA]` all'amministratore.

I documenti creati in prova restano su FIC (non inviati): cancellali da FIC prima di andare in produzione se consumano la numerazione.

## Andare in produzione

1. Configurazione fiscale verificata dal commercialista.
2. `supabase secrets set STRIPE_SECRET_KEY=sk_live_... STRIPE_WEBHOOK_SECRET=whsec_(live) EINVOICE_LIVE=true`
3. Webhook Stripe live con gli stessi tre eventi.

Basta rimettere `EINVOICE_LIVE=false` per tornare in prova.

## Stati del job

`in_coda` → `in_lavorazione` → `emessa` (prova) / `inviata` → `accettata` | `scartata`
Fermi: `dati_mancanti` (dati cliente), `da_controllare` (XML con errori, configurazione incompleta, importi che non tornano al centesimo, errore definitivo dell'API), `errore` (5 tentativi falliti con backoff 2, 4, 8, 16 minuti). Ogni fermo genera un avviso email immediato.

## Test eseguiti

- `deno test _shared/` — 26 test: validazione P.IVA/CF/codice destinatario, mappatura importi (lordo/netto, sconti, bollo, note di credito, scorporo), e test end-to-end dell'agente con fetch simulato di Stripe, FIC e Resend (emissione in prova, invio live, XML con errori → `da_controllare`, dati mancanti → `dati_mancanti`, backoff fino a `errore`, ripresa senza duplicati, note di credito, scarto SDI).
- `deno check` di tutte le funzioni.
- Migrazione applicata su un Postgres 16 vuoto, con test SQL di idempotenza, presa dei job, backoff, passaggio a `errore` con avviso e RLS (admin / non admin).
- `npx tsc -b` e `npx vite build` del pannello.

```bash
cd supabase/functions && deno test --no-lock _shared/
```

## Da verificare

Punti non verificabili sulla documentazione ufficiale accessibile durante lo sviluppo (spec OpenAPI di FIC non raggiungibile; usato come riferimento l'SDK ufficiale `@fattureincloud/fattureincloud-ts-sdk` 2.1.3):

1. **Webhook FIC** (`functions/fic-webhook/index.ts`, costanti in cima al file): nome dell'header della sfida di verifica, formato della risposta e corpo della notifica. La firma JWT delle notifiche non è verificata: al suo posto un token segreto nell'URL e la rilettura dello stato via API (una notifica falsa non può cambiare nulla).
2. **Note di credito** (`_shared/mappatura.ts`): che `ei_data.invoice_number` / `invoice_date` producano `DatiFattureCollegate` nell'XML. Controllare il primo XML di prova.
3. **Link «Apri su Fatture in Cloud»** (`functions/billing-admin/index.ts`): formato dell'indirizzo del documento nell'app web; impostare `FIC_URL_DOCUMENTO` con `{id}` (es. copiando l'URL di una fattura aperta su FIC). Senza, apre la home di FIC.

## Da concordare con il commercialista

- **Prezzi IVA inclusa o esclusa** su Stripe (`prezzi_stripe_ivati`): in fattura gli importi devono coincidere al centesimo con l'incassato, altrimenti la fattura non parte.
- **Sconti/coupon**: riportati come righe negative «Sconto …» (FIC le accetta nel documento; controllare l'XML di prova).
- **Marca da bollo**: applicata solo a operazioni senza IVA (natura) oltre la soglia; se addebitata al cliente deve esistere su Stripe una voce con metadata `bollo=true`, che diventa `stamp_duty` e non una riga.
- **Numerazione**: la assegna FIC (sezionali configurabili per fatture e note di credito).
- **Data fattura**: data di incasso (Europe/Rome); per le note di credito la data del rimborso.
- **Modalità di pagamento**: codici FatturaPA per carta, SEPA e altri metodi (es. MP08, MP19, MP05).
