# Test end-to-end

Girano contro **Supabase locale** e l'app su `http://localhost:3000`.

```bash
npx supabase start                       # dalla cartella nexora-studio (serve Docker)
cp .env.example app/.env.local           # URL e chiave publishable da `npx supabase status`
npm run build -w @nexora/app && npm run start -w @nexora/app
tests/e2e/prepara.sh                     # logo e video di prova
node tests/e2e/flow-fase1.cjs            # registrazione → email → onboarding → brand → team → invito
SUPABASE_PUBLISHABLE_KEY=... SUPABASE_SECRET_KEY=... \
  node tests/e2e/isolamento.mjs <email-titolare> <email-collaboratore>   # 21 controlli RLS
```

- `flow-fase4.cjs`: approvazione senza social (resta da programmare) → il team collega il brand Metricool in `/admin/social` → programmazione nel primo spazio libero → trascinamento sul calendario → "Sposta" a meno di 20 minuti rifiutato → consegna e verifica della pubblicazione. Nel worker `PUBLISHING_PROVIDER=demo`; serve `SUPABASE_SECRET_KEY` per accorciare l'attesa. Dura fino a ~15 minuti.
- `flow-fase3.cjs`: caricamento del girato → montaggio → revisione del team → modifica → approvazione. Prima: `crea-admin.mjs team@nexora.test Team2026!`; nel worker `TRANSCRIPTION_PROVIDER=demo`, `MUSIC_DIR`, `PYTHON_BIN` (Python con opencv). File in `E2E_ASSETS`: `logo.png`, `girato-verticale.mov`.
- `flow-fase2.cjs`: onboarding → script generati dal worker → pagina Script → riscrittura → email. Richiede il worker attivo con `LLM_PROVIDER=demo`, `EMAIL_PROVIDER=mailpit` e `ALLOW_DEMO_PROVIDERS=true` (anche nell'app).
- `flow-fase1.cjs` legge le email di conferma da Mailpit (`http://127.0.0.1:54324`). Gli screenshot finiscono in `tests/e2e/.assets`.
- `isolamento.mjs` crea una terza azienda e verifica che non veda né modifichi i dati delle altre, e che il collaboratore non possa toccare piano, ruoli o admin.
- I test SQL senza Docker sono in `supabase/tests/` (`run_local.sh`, su un Postgres qualsiasi).
