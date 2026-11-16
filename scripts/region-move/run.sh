#!/usr/bin/env bash
# Copies the Buddget database from the old Supabase project to a new one (Supabase's documented CLI path).
# Needs: Docker Desktop running, the Supabase CLI, psql 16+.
# Usage (in your own terminal, so the passwords never leave it):
#   export OLD_DB_URL='postgresql://postgres.<old-ref>:<password>@<old-pooler-host>:5432/postgres'
#   export NEW_DB_URL='postgresql://postgres.<new-ref>:<password>@<new-pooler-host>:5432/postgres'
#   bash scripts/region-move/run.sh dump      # read-only on the old project
#   bash scripts/region-move/run.sh restore   # writes the new project (must be empty)
#   bash scripts/region-move/run.sh verify    # row counts, both sides
set -euo pipefail
: "${OLD_DB_URL:?export OLD_DB_URL first}"
: "${NEW_DB_URL:?export NEW_DB_URL first}"
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="${OUT:-$HOME/Backups/buddget/region-move}"
mkdir -p "$OUT"
cd "$OUT"

case "${1:-}" in
  dump)
    supabase db dump --db-url "$OLD_DB_URL" -f roles.sql --role-only
    supabase db dump --db-url "$OLD_DB_URL" -f schema.sql
    supabase db dump --db-url "$OLD_DB_URL" -f data.sql --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
    supabase db dump --db-url "$OLD_DB_URL" -f history_schema.sql --schema supabase_migrations
    supabase db dump --db-url "$OLD_DB_URL" -f history_data.sql --use-copy --data-only --schema supabase_migrations
    ls -lh "$OUT"
    ;;
  restore)
    psql --single-transaction --variable ON_ERROR_STOP=1 \
      --file roles.sql --file schema.sql \
      --command 'SET session_replication_role = replica' \
      --file data.sql --dbname "$NEW_DB_URL"
    psql --single-transaction --variable ON_ERROR_STOP=1 --file history_schema.sql --file history_data.sql --dbname "$NEW_DB_URL"
    psql --variable ON_ERROR_STOP=1 --file "$HERE/post-restore.sql" --dbname "$NEW_DB_URL"
    ;;
  verify)
    q="select 'auth.users', count(*) from auth.users union all select 'expenses', count(*) from public.expenses
       union all select 'income_events', count(*) from public.income_events union all select 'payment_methods', count(*) from public.payment_methods
       union all select 'sms_parse_log', count(*) from public.sms_parse_log union all select 'cron jobs', count(*) from cron.job"
    echo "OLD"; psql -At --dbname "$OLD_DB_URL" -c "$q"
    echo "NEW"; psql -At --dbname "$NEW_DB_URL" -c "$q"
    ;;
  *) echo "usage: run.sh dump|restore|verify"; exit 1 ;;
esac
