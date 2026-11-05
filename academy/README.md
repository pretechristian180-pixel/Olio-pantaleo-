# Nexora Academy

Piattaforma di videocorsi di Nexora Gruppo Digitale. Next.js 15 · TypeScript · Tailwind v4 ·
Supabase · Bunny Stream · Stripe · Resend · Vercel.

- Architettura, cartelle e schema del database: [`docs/ARCHITETTURA.md`](docs/ARCHITETTURA.md)
- Mockup di riferimento: [`design/`](design/)
- Account da creare e chiavi: [`docs/ACCOUNT-E-CHIAVI.md`](docs/ACCOUNT-E-CHIAVI.md)

## Progetto Supabase

Progetto `nexora-academy` (ref `vxgfjfxfoyulpjwtqjlw`, Francoforte) nell'organizzazione NEXORA:
migration e seed già applicati. URL e chiave pubblica vanno in `.env.local` e su Vercel; la chiave
segreta si copia da Project Settings → API Keys.

## Deploy (Vercel)

Progetto Vercel `nexora-academy` (cartella `academy`, regione funzioni Francoforte), collegato al
repository: ogni push sul branch di produzione pubblica una nuova versione. Variabili impostate:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_TENANT_SLUG`,
`NEXT_PUBLIC_ROOT_DOMAIN`. Gli indirizzi `*.vercel.app` sono protetti da Vercel Authentication.

Domini: `academy.nexoragruppodigitale.it` (piattaforma + academy Nexora) e
`*.academy.nexoragruppodigitale.it` (academy dei clienti) sono sul progetto. Il DNS resta su Aruba
con due CNAME (`academy` e `*.academy` → `cname.vercel-dns.com`). Il certificato jolly richiede i
DNS di Vercel, quindi ogni nuova academy registra il proprio sottodominio sul progetto
(`src/lib/vercel-domains.ts`, serve `VERCEL_API_TOKEN`) e Vercel emette il suo certificato.
Su Supabase: Site URL `https://academy.nexoragruppodigitale.it` e Redirect URLs
`https://academy.nexoragruppodigitale.it/**`, `https://*.academy.nexoragruppodigitale.it/**`.

## Rami e rilasci

| Ramo | A cosa serve | Dove va online |
| ---- | ------------ | -------------- |
| `claude/nexora-academy-platform-kf66dg` | Sviluppo: ogni modifica nasce qui | Anteprima Vercel (protetta da login Vercel) |
| `academy-produzione` | Versione ufficiale | `academy.nexoragruppodigitale.it` e tutte le academy dei clienti |

Per rilasciare: pull request da sviluppo verso `academy-produzione`, controllo dell'anteprima,
merge. Vercel pubblica da solo. Le modifiche al database (cartella `supabase/migrations`) vanno
applicate prima del merge. Vercel salta la build quando un push non tocca la cartella `academy`.

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

| URL                                               | Cosa vedi                                      |
| ------------------------------------------------- | ---------------------------------------------- |
| `/`                                               | Home pubblica con claim e catalogo             |
| `/corsi`                                          | Catalogo                                       |
| `/corsi/[slug]`                                   | Pagina corso (come mockup Corso)               |
| `/aziende`                                        | Offerta per le aziende                         |
| `/app`                                            | Dashboard studente (stati vuoti)               |
| `/admin`                                          | Panoramica admin; `/admin/corsi` elenco corsi  |
| `/design-system`                                  | Token e componenti                             |
| `/accedi`, `/registrati`, `/password-dimenticata` | Accesso (Fase 2)                               |
| `/prezzi`, `/crea-academy`                        | Piani e creazione self-service di un'academy   |
| `/admin/impostazioni`                             | Indirizzo, piano, stato e marchio dell'academy |
| `/app/corsi/[slug]/[lezione]`                     | Player della lezione (Fase 2)                  |

## Avanzamento

- [x] Fase 1 — Fondamenta
- [x] Fase 2 — Auth e area studente
- [ ] Fase 3 — Pagamenti (codice pronto: servono `SUPABASE_SECRET_KEY` e il permesso Connect sulla chiave Stripe)
- [x] Fase 4 — Admin (pannello academy + pannello piattaforma `/piattaforma`)
- [ ] Fase 5 — Rifinitura e deploy
