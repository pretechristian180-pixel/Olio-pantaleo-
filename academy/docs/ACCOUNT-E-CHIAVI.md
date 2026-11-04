# Account da creare e chiavi da recuperare

Ogni chiave va in `.env.local` (sviluppo) e in Vercel (produzione). Vedi `.env.example`.

## 1. Supabase — serve da subito (Fase 1)

1. Vai su supabase.com, crea un account e un progetto nuovo, regione **Frankfurt (eu-central-1)**.
   Salva la password del database.
2. **Project Settings → API Keys**:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `Publishable key` (o "anon" sui progetti vecchi) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `Secret key` (o "service_role") → `SUPABASE_SECRET_KEY` (**solo server**, mai nel browser)
3. Applica migration e seed dal tuo computer:
   ```bash
   cd academy
   npx supabase login
   npx supabase link --project-ref <ref-del-progetto>
   npx supabase db push --include-seed
   ```
4. **Authentication → URL Configuration**: Site URL = l'indirizzo del sito; Redirect URLs =
   `http://localhost:3000/auth/callback` e `https://<tuo-dominio>/auth/callback`.
5. **Authentication → Emails → SMTP**: in Fase 3 collega Resend come SMTP, così anche le email di
   login partono dal tuo dominio.
6. Per diventare admin, dopo la registrazione esegui nell'SQL Editor:
   ```sql
   update public.profiles set ruolo = 'admin'
   where id = (select id from auth.users where email = 'tua@email.it');
   ```

## 2. Bunny Stream — Fase 2 (player) e Fase 4 (upload)

1. bunny.net → crea account → **Stream → Add Video Library** (regione Europa).
2. Nella library, **API**: `Library ID` → `BUNNY_STREAM_LIBRARY_ID`, `API Key` → `BUNNY_STREAM_API_KEY`,
   `CDN Hostname` → `BUNNY_STREAM_CDN_HOSTNAME`.
3. **Security**: attiva **Embed view token authentication** e copia la `Token Authentication Key`
   → `BUNNY_STREAM_TOKEN_KEY`. Aggiungi i tuoi domini in **Allowed domains**.
   Disattiva "Direct play" e il download MP4.

## 3. Stripe — Fase 3

1. stripe.com → account → resta in **Test mode** finché non sei pronto.
2. **Developers → API keys**: `Secret key` (sk_test_…) → `STRIPE_SECRET_KEY`.
3. **Developers → Webhooks → Add endpoint**: URL `https://<tuo-dominio>/api/stripe/webhook`, evento
   `checkout.session.completed` (più `customer.subscription.*` per gli abbonamenti). Copia il
   `Signing secret` (whsec_…) → `STRIPE_WEBHOOK_SECRET`.
   In locale: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
4. **Settings → Payment methods**: attiva Carte, Klarna, PayPal se vuoi le rate.
5. Il prodotto/prezzo per ogni corso lo crea l'admin (Fase 4) o lo crei a mano e incolli il
   `price_…` nel corso.

## 4. Resend — Fase 3

1. resend.com → account → **Domains → Add domain** (es. `academy.tuodominio.it`), aggiungi i record
   DNS (SPF, DKIM) e attendi la verifica.
2. **API Keys → Create** → `RESEND_API_KEY`. Mittente in `EMAIL_FROM`.

## 5. Vercel — deploy (Fase 5, ma puoi collegarlo già ora)

1. vercel.com → **Add New Project** → importa il repository GitHub.
2. **Root Directory**: `academy`. Framework: Next.js.
3. **Environment Variables**: tutte quelle di `.env.example`, con `NEXT_PUBLIC_SITE_URL` = dominio reale.
4. **Domains**: collega il dominio (es. `academy.nexoragruppodigitale.it`).
5. `CRON_SECRET`: genera una stringa casuale (`openssl rand -hex 32`).
