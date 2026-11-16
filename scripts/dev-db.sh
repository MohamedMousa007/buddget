#!/usr/bin/env bash
# Local Supabase for migrations, type generation and proof runs: nothing in development touches production.
# Needs Docker Desktop (or OrbStack/Colima). Usage: scripts/dev-db.sh up | reset | types | down
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f supabase/config.toml ] || supabase init --force --with-intellij-settings=false --with-vscode-settings=false >/dev/null
case "${1:-}" in
  up)    supabase start ;;
  reset) supabase db reset ;;                 # replays supabase/migrations on the local database
  types) supabase gen types typescript --local > src/lib/supabase/database.types.ts ;;
  down)  supabase stop ;;
  *) echo "usage: $0 up|reset|types|down" >&2; exit 2 ;;
esac
