#!/usr/bin/env bash
# The release gate, run locally. GitHub Actions is not relied on, so this is the check that must pass before pushing
# to dev/main and before a native build. It runs the same jobs .github/workflows/ci.yml defines, minus the Postgres suites
# (`npm run test:pg` needs Docker).
# Usage: npm run verify
set -euo pipefail
cd "$(dirname "$0")/.."

step() { printf '\n== %s\n' "$1"; }

step "lint";                      npm run lint
step "types";                     npx tsc --noEmit
step "tests + coverage floor (Africa/Cairo)"; TZ=Africa/Cairo npx vitest run --coverage
step "tests (America/New_York)";  TZ=America/New_York npx vitest run
step "migrations";                node scripts/check-migrations.mjs
step "dependency audit";          node scripts/audit-gate.mjs
step "production build (dummy Supabase env)"
NEXT_PUBLIC_SUPABASE_URL=https://dummy.supabase.co \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=dummy-publishable-key \
NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy-anon-key \
SUPABASE_SECRET_KEY=dummy-secret-key \
NEXT_PUBLIC_APP_URL=https://my.buddget.app \
  npm run build

printf '\nAll checks passed.\n'
