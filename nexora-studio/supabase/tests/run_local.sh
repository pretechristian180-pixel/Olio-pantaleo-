#!/usr/bin/env bash
# Applica le migrazioni su un Postgres locale con stub di Supabase ed esegue i test RLS.
# Variabili: PGHOST, PGPORT, PGUSER (database di prova "nexora_rls_test", ricreato ogni volta).
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
DB=nexora_rls_test
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
psql -q -d $DB -v ON_ERROR_STOP=1 -f "$DIR/00_local_stub.sql"
for f in "$DIR"/../migrations/*.sql; do psql -q -d $DB -v ON_ERROR_STOP=1 -f "$f"; done
echo "Migrazioni applicate."
for t in "$DIR"/rls_*.sql; do psql -q -d $DB -f "$t" 2>&1 | grep -v '^\s*$'; done
