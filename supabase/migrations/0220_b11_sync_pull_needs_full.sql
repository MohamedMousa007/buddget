-- B11 / Q15: a device whose sync cursor is older than the tombstone window must do a full resync. NOT YET APPLIED.
-- Audit (live, read-only, 2026-10-29): housekeeping() hard-deletes tombstones older than 90 days, so a delta from a cursor older than that
-- never carries the deletion and the device can re-push the stale row. Live sync_pull(timestamptz) (17 lists + budget rows, SECURITY INVOKER,
-- STABLE) is left untouched; this adds sync_pull_v2 as a thin wrapper, so the old signature keeps serving installed builds and the new
-- function always inherits the live pull. Margin: 60 days (< the 90-day purge).
-- Response when the cursor is too old: {"needs_full": true, "cursor": now()}; otherwise exactly sync_pull's payload.
-- Not done here: per-table paging of the full pull (separate change; today's largest account is small).
-- Apply BEFORE the client that calls sync_pull_v2 ships. Idempotent.

CREATE OR REPLACE FUNCTION public.sync_pull_v2(p_since timestamptz DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path = public, pg_temp AS $$
BEGIN
  IF p_since IS NOT NULL AND p_since < now() - interval '60 days' THEN
    RETURN jsonb_build_object('needs_full', true, 'cursor', now());
  END IF;
  RETURN public.sync_pull(p_since);
END $$;
REVOKE ALL ON FUNCTION public.sync_pull_v2(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_pull_v2(timestamptz) TO authenticated;
