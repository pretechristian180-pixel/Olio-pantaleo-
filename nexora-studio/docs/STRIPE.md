# Pagamenti con Stripe

Nexora Studio usa Stripe per gli abbonamenti. Pagina di pagamento, carte, fatture e disdetta stanno
su Stripe: l'app non vede né salva mai i dati delle carte.

## Attivazione (una volta sola)

1. **Account Stripe**: crea l'account e completa i dati dell'azienda. Per le prove resta in
   **modalità test** (chiavi `sk_test_…`); con quella dal vivo (`sk_live_…`) i pagamenti sono reali.
2. **Chiave segreta**: Stripe → Sviluppatori → Chiavi API → "Chiave segreta". Va solo nelle variabili
   d'ambiente (Vercel e `app/.env.local`), mai nel codice o in chat:
   ```
   BILLING_PROVIDER=stripe
   STRIPE_SECRET_KEY=sk_test_...
   ```
3. **Prodotti, prezzi, webhook e portale** in un solo comando, dalla cartella `nexora-studio`:
   ```bash
   npm run stripe:setup -- --webhook-url https://<dominio>/api/billing/webhook
   # facoltativo: --founding-percent 20  (coupon permanente −20% per i founding member)
   ```
   Lo script legge i piani dalla tabella `plans` (prezzi, video, social, brand), crea su Stripe un
   prodotto per piano con il prezzo mensile e annuale in euro (IVA esclusa) e scrive gli id dei prezzi
   in `plans`. A fine esecuzione stampa:
   - `STRIPE_WEBHOOK_SECRET=whsec_…`: mettilo nelle variabili d'ambiente;
   - `STRIPE_FOUNDING_COUPON_ID=…`, se hai chiesto il coupon.

   Si può rilanciare quando cambi un prezzo in `plans`: crea il nuovo prezzo, mentre chi è già
   abbonato resta al prezzo vecchio.
4. **IVA**: da attivare in Stripe → Tax, se vuoi che Stripe calcoli l'IVA in fattura. La pagina di
   pagamento chiede già indirizzo di fatturazione e partita IVA.
5. **Ridistribuisci** l'app su Vercel dopo aver aggiunto le variabili.

## Come funziona

| Momento | Cosa succede |
| --- | --- |
| "Scegli il piano" | Pagina di pagamento Stripe. Al ritorno il webhook attiva il piano su azienda e brand collegati. |
| "Passa a …" | Cambio di prezzo sull'abbonamento esistente con conguaglio. I nuovi limiti valgono subito. |
| "Pagamento e fatture" | Portale Stripe: carta, fatture, dati di fatturazione, disdetta a fine periodo. |
| Rinnovo (`invoice.paid`) | Nuovo periodo: i contatori ripartono da zero. |
| Pagamento fallito (`invoice.payment_failed`) | Stato "pagamento fallito": nuovi montaggi e script in pausa, email al titolare. Stripe riprova da solo. |
| Disdetta | Avviso con la data di fine. Alla chiusura l'abbonamento non è più attivo: niente nuovi montaggi, i dati restano. |

Eventi del webhook: `checkout.session.completed`, `customer.subscription.created|updated|deleted|paused|resumed`,
`invoice.paid`, `invoice.payment_failed`. Ogni evento viene elaborato una volta sola (tabella
`stripe_events`). Se l'elaborazione fallisce, il webhook risponde 500 e Stripe ritenta.

## Piani e limiti

I limiti stanno nella tabella `plans` (video al mese, social, clip b-roll, brand) e valgono per
ciascun brand. Il piano Business copre fino a 3 brand con un solo abbonamento: i brand in più si
aggiungono da "Piano e fatturazione". Founding member: il team lo attiva in `/admin/abbonamenti`
prima del pagamento, e al checkout si applica il coupon.

## Prove in locale senza Stripe

Con `BILLING_PROVIDER=demo` e `STRIPE_WEBHOOK_SECRET` impostato a una stringa qualsiasi, "Scegli il
piano" attiva subito l'abbonamento, senza pagamento. I webhook di prova sono JSON firmati con HMAC
(header `x-demo-signature`): vedi `tests/e2e/flow-fase5.cjs`. In produzione il demo è bloccato.

Con Stripe vero in locale: `stripe listen --forward-to localhost:3000/api/billing/webhook` (Stripe
CLI), poi usa il `whsec_…` che stampa come `STRIPE_WEBHOOK_SECRET`. Carta di prova: `4242 4242 4242 4242`.
