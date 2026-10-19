#!/usr/bin/env bash
# Rebuilds the QA database: stub auth + the public tables the admin code touches + the three admin migrations.
set -euo pipefail
cd "$(dirname "$0")"
export PGHOST="${PGHOST:-/var/tmp/pgqa}" PGPORT="${PGPORT:-54329}" PGUSER=postgres
psql -qc "drop database if exists qa" -c "create database qa" >/dev/null
export PGDATABASE=qa
psql -q -v ON_ERROR_STOP=1 -f base.sql -f schema.public.sql -f schema.stubs.sql \
  -f ../../supabase/migrations/0123_admin_portal_core.sql \
  -f ../../supabase/migrations/0124_admin_support_monetization.sql \
  -f ../../supabase/migrations/0125_admin_analytics_functions.sql \
  -f ../../supabase/migrations/0126_admin_rate_hit.sql \
  -f ../../supabase/migrations/0127_admin_analytics_perf.sql \
  -f ../../supabase/migrations/0130_admin_sso_email_codes.sql
echo "qa database ready"
