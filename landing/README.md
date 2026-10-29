# Mattonio — landing page

Pagina di vendita di Mattonio. Un solo obiettivo: far prenotare una demo gratuita.

- `index.html`: tutta la pagina (stili e script inclusi), nessuna fase di build.
- `icone.js`: icone lucide usate dalla pagina, generate con
  `node scripts/icone.mjs ../gestionale/node_modules/lucide-react/dist/esm/icons`.
- `favicon.svg`: i tre mattoni su fondo blu notte.

Per pubblicarla basta caricare la cartella su qualsiasi hosting statico (Netlify, Vercel, Cloudflare Pages…).
Per provarla in locale: `npx serve landing` dalla radice del repository.

`node scripts/anteprima.mjs` crea `dist/anteprima.html`, la versione in un file unico usata per
l'anteprima condivisibile: lì il form mostra la conferma senza inviare nulla.

## Form "Prenota la demo"

Le richieste finiscono nella tabella `demo_requests` del progetto Supabase (migrazione
`gestionale/supabase/migrations/20261029120000_demo_requests.sql`). La tabella accetta solo inserimenti
dall'esterno: nessuno può leggere, modificare o cancellare le richieste dal sito.
Si consultano da Supabase → Table Editor → `demo_requests`.
Il form ha anche un campo nascosto anti-bot: le richieste che lo compilano vengono scartate.

## Da completare prima della pubblicazione

Tutti i testi tra parentesi quadre sono segnaposto da sostituire con dati veri:

| Segnaposto | Dove |
|---|---|
| `[SCONTO ANNUALE]` | Prezzi: imposta `SCONTO_ANNUALE` nello script (es. `0.15`) e i prezzi annuali si calcolano da soli |
| `[CITAZIONE]`, `[NOME AGENZIA]`, `[CITTÀ]` | Testimonianze: solo recensioni reali, con il permesso delle agenzie |
| `[TEMPO DI RISPOSTA]`, `[DURATA DEMO]` | Sezione finale e messaggio di conferma |
| `[TEMPI MEDI DI ATTIVAZIONE]`, `[CONDIZIONI DI DISDETTA]`, `[DETTAGLI SU BACKUP E GDPR]`, `[DETTAGLI SULLE INTEGRAZIONI…]` | FAQ |
| `[PORTALE 1]`, `[PORTALE 2]`, `[N]` | Schermate di esempio nella sezione Funzioni |
| `[LINK SITO NEXORA]`, `[LINK PRIVACY]`, `[LINK COOKIE]`, `[EMAIL]`, `[TELEFONO]` | Box Nexora, form e footer |
