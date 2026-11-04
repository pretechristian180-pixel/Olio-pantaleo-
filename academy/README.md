# Nexora Academy

Piattaforma di videocorsi di Nexora Gruppo Digitale. Next.js 15 · TypeScript · Tailwind v4 ·
Supabase · Bunny Stream · Stripe · Resend · Vercel.

- Architettura, cartelle e schema del database: [`docs/ARCHITETTURA.md`](docs/ARCHITETTURA.md)
- Mockup di riferimento: [`design/`](design/)
- Account da creare e chiavi: [`docs/ACCOUNT-E-CHIAVI.md`](docs/ACCOUNT-E-CHIAVI.md)

## Avvio in locale

```bash
cd academy
npm install
cp .env.example .env.local   # compila almeno le tre variabili Supabase
npm run dev                  # http://localhost:3000
```

Senza Supabase il sito parte lo stesso e mostra gli stati vuoti.

### Database in locale (serve Docker)

```bash
npm run db:start    # avvia Supabase in locale e stampa URL e chiavi da mettere in .env.local
npm run db:reset    # applica migration + seed (corso "CRM e automazioni per PMI")
npm run db:test     # test pgTAP delle policy RLS
npm run db:types    # rigenera i tipi TypeScript dal database
```

## Comandi

| Comando             | Cosa fa               |
| ------------------- | --------------------- |
| `npm run dev`       | Sviluppo              |
| `npm run build`     | Build di produzione   |
| `npm run lint`      | ESLint                |
| `npm run typecheck` | Controllo tipi        |
| `npm run format`    | Prettier              |
| `npm test`          | Test unitari (Vitest) |

## Pagine della Fase 1

| URL              | Cosa vedi                                     |
| ---------------- | --------------------------------------------- |
| `/`              | Home pubblica con claim e catalogo            |
| `/corsi`         | Catalogo                                      |
| `/corsi/[slug]`  | Pagina corso (come mockup Corso)              |
| `/aziende`       | Offerta per le aziende                        |
| `/app`           | Dashboard studente (stati vuoti)              |
| `/admin`         | Panoramica admin; `/admin/corsi` elenco corsi |
| `/design-system` | Token e componenti                            |

## Avanzamento

- [x] Fase 1 — Fondamenta
- [ ] Fase 2 — Auth e area studente
- [ ] Fase 3 — Pagamenti
- [ ] Fase 4 — Admin
- [ ] Fase 5 — Rifinitura e deploy
