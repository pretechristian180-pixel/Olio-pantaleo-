#!/usr/bin/env bash
# Backup cifrato del database di Nexora Studio: schemi public, auth e storage (elenco dei file).
# I file video nei bucket non sono inclusi: vedi docs/BACKUP.md.
#
#   SUPABASE_DB_URL="postgresql://postgres.<ref>:<password>@<host>:5432/postgres" \
#   BACKUP_PASSPHRASE="..." scripts/backup.sh [cartella]
#
# Serve pg_dump 17 (come il database) e gpg. Il risultato è <cartella>/nexora-AAAA-MM-GG-HHMM.dump.gpg
set -euo pipefail
: "${SUPABASE_DB_URL:?Manca SUPABASE_DB_URL}"
: "${BACKUP_PASSPHRASE:?Manca BACKUP_PASSPHRASE}"
OUT="${1:-backups}"
mkdir -p "$OUT"
FILE="$OUT/nexora-$(date -u +%Y-%m-%d-%H%M).dump"

pg_dump "$SUPABASE_DB_URL" \
  --format=custom --compress=9 --no-owner --no-privileges \
  --schema=public --schema=auth --schema=storage \
  --file="$FILE"

gpg --batch --yes --symmetric --cipher-algo AES256 \
  --passphrase-fd 3 --output "$FILE.gpg" "$FILE" 3<<<"$BACKUP_PASSPHRASE"
rm -f "$FILE"
echo "Backup: $FILE.gpg ($(du -h "$FILE.gpg" | cut -f1))"
