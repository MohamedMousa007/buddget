-- Part of the database audit follow-up (DB-6 + api_rate_limits / backfill_issues cleanup).
--
-- 1. `backups_20260416` schema — a one-off snapshot taken on 2026-04-16
--    before the v16→v17 normalisation migration. All tables carry
--    anon-accessible RLS policies (10 security-advisor warnings) and
--    the data is either redundant with `public` or recoverable via
--    Supabase PITR. Drop the whole schema.
--
-- 2. `public.backfill_issues` — empty audit table for the same
--    migration. RLS enabled, zero policies → unreadable by any client.
--    Dead table; drop it.
--
-- 3. `public.api_rate_limits` — RLS enabled, zero policies. The only
--    writer is the SECURITY DEFINER `api_rate_hit` RPC which bypasses
--    RLS. Add an explicit policy that denies *all* client access so
--    the linter's "RLS enabled, no policy" warning goes away and the
--    intent ("server-only table") is documented in SQL.

-- 1. Wipe the legacy-migration backup schema. CASCADE because the
--    tables carry their own policies, triggers, FK constraints, etc.
DROP SCHEMA IF EXISTS backups_20260416 CASCADE;

-- 2. Dead audit table from the same migration.
DROP TABLE IF EXISTS public.backfill_issues;

-- 3. Explicit "no client access" policy for api_rate_limits so the
--    linter doesn't flag it as unpoliced. SECURITY DEFINER RPCs
--    (`api_rate_hit`) still bypass RLS and can read/write freely.
--    If a future feature needs per-user rate-limit visibility, add a
--    scoped policy beside this one.
DROP POLICY IF EXISTS api_rate_limits_client_denied ON public.api_rate_limits;
CREATE POLICY api_rate_limits_client_denied ON public.api_rate_limits
  FOR ALL TO authenticated, anon
  USING (false)
  WITH CHECK (false);
