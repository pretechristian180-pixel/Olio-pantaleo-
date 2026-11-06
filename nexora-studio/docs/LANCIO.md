# Checklist di lancio

## 1. Configurazione (da fare una volta)

| # | Dove | Cosa | Stato |
| --- | --- | --- | --- |
| 1 | Aruba DNS | CNAME `studio` → `fca20ce1798a7663.vercel-dns-017.com.` | fatto |
| 2 | Supabase → Authentication → URL Configuration | Site URL `https://studio.nexoragruppodigitale.it`, Redirect URLs `https://studio.nexoragruppodigitale.it/**` | da fare |
| 3 | Supabase → Authentication → Email Templates | Incollare i testi di `supabase/templates/` (conferma, recupero, cambio email) | da fare |
| 4 | Supabase → Authentication → SMTP | Resend come SMTP (mittente `studio@nexoragruppodigitale.it`), così le email di accesso partono dal vostro dominio | da fare |
| 5 | Supabase → Storage → Settings | Piano Pro attivo. **Global file size limit a 2 GB**: il valore predefinito (50 MB) fa rifiutare quasi ogni girato | piano fatto; limite da impostare (bloccante) |
| 6 | Vercel → Environment Variables | `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` (vedi `.env.example`) | fatto: Supabase, Resend, Anthropic; mancano Stripe e Sentry |
| 7 | Railway | Servizio dal repository con `railway.json`; variabili del worker (Supabase, Anthropic, Metricool, Resend, Sentry; trascrizione già inclusa nell'immagine). Piano Hobby: il Trial non ha memoria sufficiente per Whisper e FFmpeg | fatto: montaggio completo verificato in produzione; mancano Metricool e Sentry |
| 8 | Stripe | `npm run stripe:setup -- --webhook-url https://studio.nexoragruppodigitale.it/api/billing/webhook` (vedi `docs/STRIPE.md`) | da fare |
| 9 | Metricool | Piano con API, token e user id nel worker (vedi `docs/METRICOOL.md`) | da fare |
| 10 | Sentry | Progetto Next.js, DSN su Vercel e Railway | da fare |
| 11 | GitHub → Secrets | `NEXORA_DB_URL`, `NEXORA_BACKUP_PASSPHRASE` (vedi `docs/BACKUP.md`) | da fare |
| 12 | Pagine legali | Termini, privacy, cookie e accordo sul trattamento dei dati pubblicati; regioni di Railway (Paesi Bassi) e Sentry (Germania) da scegliere così alla creazione | fatto |

Per andare dal vivo: `BILLING_PROVIDER=stripe` con chiavi `sk_live_…`, e nessun provider `demo`
(`ALLOW_DEMO_PROVIDERS` non impostata).

## 2. Criteri di accettazione dell'MVP

| Criterio | Come è verificato | Stato |
| --- | --- | --- |
| Onboarding da telefono in meno di 10 minuti | `flow-fase1.cjs` su iPhone (4 passi, campi essenziali) | flusso verificato; tempo da misurare con un cliente vero |
| Dal girato (3 min) alla revisione in meno di 15 minuti | Render di 3 minuti in circa 1 minuto in locale; la dashboard misura i tempi reali | da confermare con Whisper e Claude veri |
| I sottotitoli non coprono i volti | Rilevamento dei volti e posizionamento dei sottotitoli (test del motore video) | verificato sui video di prova |
| Nessun utente vede dati di un altro workspace | `isolamento.mjs` (21 controlli) e `billing_phase5.sql` | verificato |
| Nessun post senza approvazione | Trigger nel database e `flow-fase4.cjs` | verificato |
| Pagamento fallito: stop ai nuovi montaggi, nulla cancellato | `flow-fase5.cjs` e `billing_phase5.sql` | verificato (pagamenti simulati) |
| Costo per video registrato | `provider_costs` per ogni passaggio; pagina `/admin/costi` | verificato |

## 3. Prove prima di aprire ai clienti

- [ ] Un ciclo completo con le chiavi vere: registrazione → script → girato reale → montaggio → approvazione → pubblicazione su un profilo di prova.
- [ ] Da iPhone (Safari) e Android (Chrome) veri: i test automatici emulano lo schermo del telefono, non i browser.
- [ ] Caricamento di un file da 1-2 GB interrompendo la connessione a metà: deve riprendere da dove era arrivato.
- [ ] Stripe in modalità test: pagamento, cambio piano, carta rifiutata (`4000 0000 0000 0341`), disdetta dal portale.
- [ ] Email ricevute e leggibili su Gmail e Outlook (conferma, script del lunedì, video pronto, pagamento fallito).
- [ ] Un errore di prova arriva su Sentry senza email o dati personali.
- [ ] Il backup notturno compare tra gli Artifacts e si apre con la passphrase.

## 4. Test automatici

```bash
npm run lint && npm run typecheck
npm test -w @nexora/shared && npm test -w @nexora/video-engine
psql "$LOCAL_DB" -f supabase/tests/billing_phase5.sql
node tests/e2e/flow-fase1.cjs   # … fino a flow-fase6.cjs (vedi tests/e2e/README.md)
```
