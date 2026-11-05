# Backup e ripristino

## Cosa c'è già

- **Supabase** fa un backup giornaliero del database sui piani a pagamento (Pro: 7 giorni). Con
  l'opzione Point-in-Time Recovery si torna a un minuto preciso. Per il lancio: **piano Pro**.
- **Backup nostro, cifrato**, ogni notte con GitHub Actions
  (`.github/workflows/nexora-studio-backup.yml`): una copia indipendente da Supabase, tenuta 30 giorni.

## Backup notturno (GitHub Actions)

Contiene gli schemi `public` (aziende, script, video, calendario, abbonamenti, costi), `auth`
(utenti) e `storage` (elenco dei file). Il file è cifrato con AES-256 prima di lasciare il server:
senza la passphrase non si apre.

Attivazione, una volta sola, in GitHub → Settings → Secrets and variables → Actions:

| Segreto | Valore |
| --- | --- |
| `NEXORA_DB_URL` | Supabase → Project Settings → Database → Connection string → "Session pooler" (porta 5432), con la password del database |
| `NEXORA_BACKUP_PASSPHRASE` | Una frase lunga e casuale. **Conservala fuori da GitHub** (gestore di password): senza, i backup sono illeggibili |

GitHub esegue le pianificazioni solo dal **ramo predefinito** del repository: il workflow parte
quando questo ramo viene unito a quello predefinito. Da lì si può anche lanciare a mano (Actions →
"Nexora Studio — backup database" → Run workflow). I file stanno negli "Artifacts" di ogni esecuzione.

A mano, da qualsiasi computer con `pg_dump` 17 e `gpg`:

```bash
SUPABASE_DB_URL="postgresql://…" BACKUP_PASSPHRASE="…" nexora-studio/scripts/backup.sh backups
```

## File video e loghi

I bucket (`raw`, `output`, `brand`) non sono nel backup del database: i girati pesano fino a 2 GB
l'uno. Il girato originale resta nel bucket `raw`, così ogni video si può rimontare. Per una copia
dei file si può attivare la replica dei bucket verso un servizio S3 esterno (es. Cloudflare R2);
il backup del database ne conserva comunque l'elenco.

## Ripristino

```bash
gpg --decrypt nexora-AAAA-MM-GG-HHMM.dump.gpg > nexora.dump      # chiede la passphrase
pg_restore --list nexora.dump | less                              # cosa contiene
# Su un progetto Supabase nuovo (con le migrazioni già applicate): solo i dati
pg_restore --data-only --disable-triggers --no-owner \
  --schema=public --schema=auth -d "$SUPABASE_DB_URL" nexora.dump
```

Prima di ripristinare in produzione, prova su un progetto Supabase di prova. La procedura è stata
verificata in locale: dopo il ripristino aziende, video e costi coincidono con l'originale.
