# Sorpasso AI — landing page

Pagina di vendita con un solo obiettivo: far prenotare la **demo gratuita di 20 minuti**.
Vite + React + TypeScript + Tailwind CSS v4, font Manrope (titoli) e Inter (testo), nessuna immagine pesante
(il mockup del gestionale è HTML/CSS/SVG).

## Avvio

```bash
cd sorpasso-landing
npm install
cp .env.example .env.local     # URL e chiave anon del progetto Supabase; ID Meta Pixel e GA4 facoltativi
npm run dev                    # http://localhost:5173
npm run build                  # controllo tipi + build in dist/
```

## Dove modificare testi e prezzi

Tutto in **`src/contenuti.ts`**: titoli, problemi, calcolatore (valori iniziali e ipotesi del +20%), passaggi,
funzionalità, prova sociale, **prezzi dei pacchetti**, FAQ, dati aziendali del footer. Le voci marcate
`[SEGNAPOSTO]` vanno sostituite prima di pubblicare (dati Nexora Gruppo Digitale, prezzi, testimonianza, numeri del
caso pilota). Per la testimonianza video compila `provaSociale.testimonianza.videoUrl` (URL embed YouTube/Vimeo o
file .mp4).

Da aggiornare anche in `index.html`: dominio in `canonical` e `og:url`/`og:image`, dati del JSON-LD.
L'immagine di condivisione è `public/og-image.png` (sorgente modificabile: `public/og-image.svg`).

## Variabili d'ambiente

| Variabile | A cosa serve |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | salvataggio delle richieste di demo |
| `VITE_GA4_ID` | Google Analytics 4 (es. `G-XXXXXXX`), caricato solo con consenso "statistiche" |
| `VITE_META_PIXEL_ID` | Meta Pixel, caricato solo con consenso "marketing" |

Senza ID non viene caricato nessuno script di tracciamento. Le conversioni (`generate_lead` su GA4, `Lead` su Meta)
partono all'invio del modulo, solo se l'utente ha dato il relativo consenso.

## Supabase: tabella e notifica email

1. Applica la migrazione `supabase/migrations/…_demo_requests.sql` (`supabase db push` sul progetto della landing).
   Il sito può **solo inserire** richieste: nessuna lettura pubblica. Le richieste si consultano dal pannello
   Supabase (Table editor → `demo_requests`), con il campo `stato` per seguirle.
2. Crea un account [Resend](https://resend.com), verifica il dominio mittente e imposta i secrets:
   ```bash
   supabase secrets set RESEND_API_KEY=re_... NOTIFICA_EMAIL_A=vendite@tuodominio.it \
     NOTIFICA_EMAIL_DA="Sorpasso AI <demo@tuodominio.it>" WEBHOOK_SEGRETO=$(openssl rand -hex 24)
   supabase functions deploy notifica-demo --no-verify-jwt
   ```
3. Pannello Supabase → **Database → Webhooks → Create a new hook**:
   - tabella `demo_requests`, evento **Insert**;
   - tipo **HTTP Request**, metodo POST, URL `https://<progetto>.supabase.co/functions/v1/notifica-demo`;
   - header `x-webhook-segreto` = lo stesso valore di `WEBHOOK_SEGRETO`.

La funzione rifiuta chiamate senza il segreto e non scrive dati personali nei log.

## Deploy

È un sito statico (`dist/`): Vercel, Netlify, Cloudflare Pages o qualunque hosting. Serve una regola di
fallback a `index.html` per i percorsi `/privacy` e `/cookie-policy` (su Netlify: `_redirects` con
`/* /index.html 200`; su Vercel è automatico per i progetti Vite con rewrite `{"source": "/(.*)", "destination": "/"}`).

## Privacy e cookie

- Banner conforme alle linee guida del Garante: "Accetta tutti" e "Rifiuta" con lo stesso peso, "Personalizza" per
  categoria (necessari, statistiche, marketing). Scelta salvata in `localStorage` con data e versione
  (`VERSIONE_CONSENSO` in `src/lib/consenso.ts`: cambiandola il banner ricompare a tutti). "Preferenze cookie" nel footer.
- Google Consent Mode v2 con tutti i consensi a `denied` di default.
- Le pagine `/privacy` e `/cookie-policy` sono testi di base con dati del titolare come segnaposto: **vanno verificate
  da un consulente privacy** prima della pubblicazione.
