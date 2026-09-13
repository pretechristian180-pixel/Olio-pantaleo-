# Pantaleo — Sito ufficiale

Redesign completo del sito Pantaleo, azienda olearia pugliese: esperienza digitale editoriale
costruita con Next.js (App Router), TypeScript e Tailwind CSS.

## Stack

- **Next.js 16** (App Router, React Server Components)
- **TypeScript**
- **Tailwind CSS v4** (design system basato su token in `src/app/globals.css`)
- Nessun servizio esterno richiesto per lo sviluppo locale: prodotti, ricette, articoli e
  contenuti del quiz vivono come dati tipizzati in `src/lib/data/`, pensati per essere sostituiti
  in futuro da un CMS headless o dalle API di un backend e-commerce senza toccare la UI.

## Avvio del progetto

```bash
npm install
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000).

Per una build di produzione:

```bash
npm run build
npm run start
```

## Struttura principale

```
src/
  app/                 Route (App Router): home, storia, la-puglia, prodotti,
                       trova-il-tuo-olio, cucina, magazine, aziende, carrello,
                       checkout, account, cerca, sitemap.ts, robots.ts
  components/          Componenti UI (Header, Footer, catalogo prodotti, quiz,
                       carrello, timeline con scroll-reveal, illustrazioni SVG)
  lib/
    data/              Prodotti, ricette, articoli magazine, timeline, quiz
    cart-context.tsx   Stato carrello (persistito in localStorage)
    orders.ts          Storico ordini locale (usato da checkout e account)
    analytics.ts       Wrapper tipizzato per gli eventi di tracking
```

## Note

- Il carrello, il checkout e lo storico ordini funzionano interamente lato client
  (localStorage) in assenza di un backend Shopify collegato: la UX è completa e pronta per
  essere collegata a un vero provider di pagamento e a un ordine reale.
- L'identità visiva non utilizza fotografie stock: la direzione creativa si basa su
  illustrazioni vettoriali originali, tipografia editoriale e campiture di colore.
