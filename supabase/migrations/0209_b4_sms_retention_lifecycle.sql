-- QA2 B4 / N2 N3 N13 N19 Q17 LF6 DT2 DT3 (C3 O3 Q1 duplicates): SMS data lifecycle, SCHEMA + FUNCTION ONLY.
--
-- RETENTION STAYS DISABLED. sms_retention() returns 0 immediately until
-- platform_settings.sms_retention_enabled is the jsonb value true. Applying this file purges nothing.
-- (Live today the nightly job fails because raw_body is NOT NULL; dropping NOT NULL alone would make it
-- succeed and wipe every row older than 30 days whose harvested_at is set, which is true for ALL rows, so this
-- file replaces the function in the SAME transaction.)
--
-- DEPLOY ORDER
--   Additive part (columns, settings keys, audit table, helpers, view-free): apply BEFORE the code that writes
--   masked_body / masked_version / learned_at ships (an upsert with an unknown column returns PGRST204).
--   The function rewrite is restrictive-in-effect but inert while the flag is false. Flipping the flag is the
--   LAST step of B4 (owner approved), after: LF3 backfill done, LF6 leak scan passed (set
--   sms_leak_scan_passed_at), and `select private.sms_retention_preflight()` looks right.
--   Native builds in the wild are unaffected (they never read these columns).
--
-- AUDIT SELECTs (run first; expected counts on the day of writing in brackets)
--   select is_nullable from information_schema.columns where table_name='sms_parse_log' and column_name='raw_body';  -- NO
--   select count(*) from sms_parse_log;                                           -- ~873
--   select count(*) from sms_parse_log where harvested_at is not null;            -- = all rows (so it is NOT a "learned" flag)
--   select count(*) from sms_parse_log where raw_body is not null and received_at < now()-interval '30 days'; -- ~680+
--   select count(*) filter (where seen_count < 3), count(*) from sms_corpus;      -- ~464 of ~527
--   select count(*) from platform_settings where key like 'sms\_%';               -- 0
--   select count(*) from information_schema.columns where table_name='sms_parse_log' and column_name in ('masked_body','masked_version','learned_at','raw_expires_at'); -- 0
--
-- EVERY READER OF raw_body (NULL handling)
--   SQL  : sms_retention() (rewritten here); sms_try_pair() IPN reference ILIKE (NULL => no match, made
--          explicit with coalesce in 0211). Live pg_get_functiondef scan finds no other SQL function or view that
--          reads raw_body (detect_zero_variance_templates keys on sms_hash, not raw_body).
--   Code : api/sms/parse/route.ts (writer), lib/sms/dispatch.ts (in-flight row only, safe), api/sms/confirm/route.ts
--          (reload: a NULL body must refuse or degrade explicitly), hooks/useSmsConfirmations.ts + SmsReviewSheet.tsx
--          (shows nothing when NULL), hooks/usePaymentMethodDetector.ts (paymentTypeFromSms(null)),
--          lib/sms/runAdjudication.ts (NULL => verdict unclear), lib/sms/matchSalary.ts:210 (evidence loses the
--          counterparty), lib/sms/harvest.ts (select ... not null: purged rows can never be harvested),
--          api/admin/sms/logs (reveal returns null: UI must say purged), undo route (uses ids, not the body),
--          corrections (redacted_body in sms_corrections, own copy).
--
-- ROLLBACK
--   Disabling: update platform_settings set value='false'::jsonb where key='sms_retention_enabled'.
--   Full revert: drop the 4 new columns + audit table + helper functions; restore the previous
--   sms_retention() text (kept at the bottom of this file). Rows already purged cannot be restored; the
--   flag is the only protection, which is why it ships false. raw_body NOT NULL can be re-added only while no
--   row is NULL.

BEGIN;

-- 1. Schema (additive) ------------------------------------------------------------------------------------
ALTER TABLE public.sms_parse_log ALTER COLUMN raw_body DROP NOT NULL;

ALTER TABLE public.sms_parse_log
  ADD COLUMN IF NOT EXISTS masked_version smallint,      -- masker version that produced masked_body; NULL = never masked
  ADD COLUMN IF NOT EXISTS learned_at timestamptz,       -- stamped ONLY by the LF3 backfill / fixed harvester (not harvested_at)
  ADD COLUMN IF NOT EXISTS raw_expires_at timestamptz,   -- optional explicit expiry of raw_body (honoured regardless of class)
  ADD COLUMN IF NOT EXISTS masked_body text,             -- the masked shape that replaces raw_body after the parsed-class window
  ADD COLUMN IF NOT EXISTS skeleton_key text;            -- sms_corpus.skeleton_key of masked_body, for replay and coverage

COMMENT ON COLUMN public.sms_parse_log.learned_at IS
  'Set when the masked shape was written to the corpus with masker >= sms_masked_version_min. harvested_at (set at ingest on every row) does NOT mean learned.';

ALTER TABLE public.sms_corpus ADD COLUMN IF NOT EXISTS masked_version smallint;

CREATE INDEX IF NOT EXISTS sms_parse_log_raw_purge_idx
  ON public.sms_parse_log (received_at) WHERE raw_body IS NOT NULL;

-- 2. Policy keys (idempotent, retention OFF) ---------------------------------------------------------------
INSERT INTO public.platform_settings (key, value) VALUES
  ('sms_retention_enabled',        'false'::jsonb),
  ('sms_raw_keep_days_parsed',     '30'::jsonb),
  ('sms_raw_keep_days_rejected',   '7'::jsonb),
  ('sms_raw_hard_cap_days',        '60'::jsonb),
  ('sms_corpus_keep_days',         '180'::jsonb),
  ('sms_masked_version_min',       '1'::jsonb),
  ('sms_failed_keep_days',         '35'::jsonb),     -- >= the Android queue max age (30 d), so a late replay still hits the (user_id, sms_hash) dedup
  ('sms_leak_scan_passed_at',      'null'::jsonb)    -- ISO timestamp stamped by the harvest cron ONLY after a full corpus + corrections scan with zero leaks; must be < 7 days old
ON CONFLICT (key) DO NOTHING;

-- 2b. Monthly pattern review ledger (admin route writes 'reviewed'/'skipped' rows; service role only) ---------
-- The retention purge reads it directly: parsed raw text is masked only once a closed review covers its day
-- (period_end >= the row's day) or the hard cap is reached. No trigger or flag: the hold is derived from the rows.
CREATE TABLE IF NOT EXISTS public.sms_pattern_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date,
  period_end date,
  status text CHECK (status IN ('pending', 'reviewed', 'skipped')),
  notes text,
  report jsonb,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.sms_pattern_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sms_pattern_reviews FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_pattern_reviews TO service_role;

-- 3. Audit table (service role only: RLS on, no policy, anon/authenticated revoked) -------------------------
CREATE TABLE IF NOT EXISTS public.sms_retention_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_at timestamptz NOT NULL DEFAULT now(),
  outcome text NOT NULL,                       -- ran | blocked_leak_scan | disabled_noop (never written)
  rejected_purged integer NOT NULL DEFAULT 0,
  rejected_cap_fired integer NOT NULL DEFAULT 0,   -- rejected rows purged at the cap because never learned
  parsed_masked integer NOT NULL DEFAULT 0,
  parsed_held boolean NOT NULL DEFAULT false,
  never_learned_purged integer NOT NULL DEFAULT 0, -- WARNING: learning pipeline is broken when > 0
  failed_blanked integer NOT NULL DEFAULT 0,
  failed_deleted integer NOT NULL DEFAULT 0,
  corpus_dropped integer NOT NULL DEFAULT 0,
  explicit_expired integer NOT NULL DEFAULT 0
);
ALTER TABLE public.sms_retention_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sms_retention_audit FROM anon, authenticated;
GRANT SELECT, INSERT ON public.sms_retention_audit TO service_role;

-- 4. Helpers (private schema: not exposed through the REST API) ---------------------------------------------
CREATE OR REPLACE FUNCTION private.sms_setting_num(p_key text, p_default numeric)
RETURNS numeric LANGUAGE sql STABLE SET search_path TO 'public', 'pg_temp' AS $$
  SELECT coalesce(
    (SELECT CASE WHEN jsonb_typeof(value) = 'number' THEN (value #>> '{}')::numeric END
       FROM public.platform_settings WHERE key = p_key),
    p_default)
$$;

CREATE OR REPLACE FUNCTION private.sms_leak_scan_ok()
RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public', 'pg_temp' AS $$
  SELECT coalesce(
    (SELECT jsonb_typeof(value) = 'string' AND (value #>> '{}')::timestamptz > now() - interval '7 days'
       FROM public.platform_settings WHERE key = 'sms_leak_scan_passed_at'),
    false)
$$;

CREATE OR REPLACE FUNCTION private.sms_review_covers(p_received timestamptz)
RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public', 'pg_temp' AS $$
  SELECT EXISTS (SELECT 1 FROM public.sms_pattern_reviews
                  WHERE status IN ('reviewed', 'skipped') AND period_end >= p_received::date)
$$;

-- What the owner checks before flipping sms_retention_enabled.
CREATE OR REPLACE FUNCTION private.sms_retention_preflight()
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public', 'pg_temp' AS $$
  SELECT jsonb_build_object(
    'leak_scan_ok', private.sms_leak_scan_ok(),
    'parsed_awaiting_review', (SELECT count(*) FROM public.sms_parse_log
        WHERE raw_body IS NOT NULL AND status NOT IN ('rejected', 'failed', 'processing')
          AND received_at < now() - make_interval(days => private.sms_setting_num('sms_raw_keep_days_parsed', 30)::int)
          AND NOT private.sms_review_covers(received_at)),
    'raw_rows', (SELECT count(*) FROM public.sms_parse_log WHERE raw_body IS NOT NULL),
    'parsed_due_unlearned', (SELECT count(*) FROM public.sms_parse_log
        WHERE raw_body IS NOT NULL AND status NOT IN ('rejected', 'failed', 'processing')
          AND received_at < now() - make_interval(days => private.sms_setting_num('sms_raw_keep_days_parsed', 30)::int)
          AND (learned_at IS NULL OR masked_body IS NULL
               OR coalesce(masked_version, 0) < private.sms_setting_num('sms_masked_version_min', 1))),
    'rows_masker_stale', (SELECT count(*) FROM public.sms_parse_log
        WHERE coalesce(masked_version, 0) < private.sms_setting_num('sms_masked_version_min', 1)),
    'corpus_would_drop', (SELECT count(*) FROM public.sms_corpus
        WHERE seen_count < 3 AND last_seen < now() - make_interval(days => private.sms_setting_num('sms_corpus_keep_days', 180)::int))
  )
$$;

REVOKE ALL ON FUNCTION private.sms_setting_num(text, numeric), private.sms_leak_scan_ok(),
  private.sms_review_covers(timestamptz), private.sms_retention_preflight() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.sms_setting_num(text, numeric), private.sms_leak_scan_ok(),
  private.sms_review_covers(timestamptz), private.sms_retention_preflight() TO service_role;

-- 5. sms_retention(): rewritten from the LIVE definition (UPDATE raw_body/push_result, then corpus cleanup) ---
-- Same name, same signature, same integer return (rows whose raw text was removed). Scheduled by the existing
-- 'sms-retention' job at 00:50; no cron change.
CREATE OR REPLACE FUNCTION public.sms_retention()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_rej_days int := private.sms_setting_num('sms_raw_keep_days_rejected', 7)::int;
  v_parsed_days int := private.sms_setting_num('sms_raw_keep_days_parsed', 30)::int;
  v_cap_days int := private.sms_setting_num('sms_raw_hard_cap_days', 60)::int;
  v_corpus_days int := private.sms_setting_num('sms_corpus_keep_days', 180)::int;
  v_failed_days int := private.sms_setting_num('sms_failed_keep_days', 35)::int;
  v_min_version numeric := private.sms_setting_num('sms_masked_version_min', 1);
  v_held boolean := false;
  v_rej int := 0; v_rej_cap int := 0; v_parsed int := 0; v_never int := 0;
  v_fail_blank int := 0; v_fail_del int := 0; v_corpus int := 0; v_expl int := 0;
BEGIN
  IF NOT coalesce((SELECT value = 'true'::jsonb FROM platform_settings WHERE key = 'sms_retention_enabled'), false) THEN
    RETURN 0;
  END IF;
  IF NOT private.sms_leak_scan_ok() THEN
    INSERT INTO sms_retention_audit (outcome) VALUES ('blocked_leak_scan');
    RETURN 0;
  END IF;

  -- Explicit expiry (any class, not subject to the review hold).
  WITH t AS (SELECT id FROM sms_parse_log WHERE raw_body IS NOT NULL AND raw_expires_at <= now() LIMIT 5000 FOR UPDATE SKIP LOCKED),
       u AS (UPDATE sms_parse_log l SET raw_body = NULL, push_result = NULL FROM t WHERE l.id = t.id RETURNING 1)
  SELECT count(*) INTO v_expl FROM u;

  -- Rejected / OTP / marketing: raw goes as soon as the shape is learned; hard cap otherwise.
  WITH t AS (SELECT id FROM sms_parse_log
              WHERE status = 'rejected' AND raw_body IS NOT NULL
                AND (learned_at IS NOT NULL OR received_at < now() - make_interval(days => v_rej_days))
              LIMIT 5000 FOR UPDATE SKIP LOCKED),
       u AS (UPDATE sms_parse_log l SET raw_body = NULL, push_result = NULL FROM t WHERE l.id = t.id RETURNING l.learned_at)
  SELECT count(*), count(*) FILTER (WHERE learned_at IS NULL) INTO v_rej, v_rej_cap FROM u;

  -- Failed attempts (N19/Q17): the body is useless after the cap; the row tail is pruned.
  WITH t AS (SELECT id FROM sms_parse_log
              WHERE status = 'failed' AND raw_body IS NOT NULL AND received_at < now() - make_interval(days => v_rej_days)
              LIMIT 5000 FOR UPDATE SKIP LOCKED),
       u AS (UPDATE sms_parse_log l SET raw_body = NULL, push_result = NULL FROM t WHERE l.id = t.id RETURNING 1)
  SELECT count(*) INTO v_fail_blank FROM u;
  WITH d AS (DELETE FROM sms_parse_log
              WHERE id IN (SELECT id FROM sms_parse_log
                            WHERE status = 'failed' AND received_at < now() - make_interval(days => v_failed_days)
                              AND expense_id IS NULL AND income_id IS NULL AND debt_payment_id IS NULL
                              AND savings_transaction_id IS NULL AND paired_log_id IS NULL
                            LIMIT 5000)
              RETURNING 1)
  SELECT count(*) INTO v_fail_del FROM d;

  -- Parsed transactions: raw replaced by the masked shape (kept in the same row) after the keep window.
  -- Needs a fresh masked_body from a current masker, a learned stamp AND a closed pattern review covering the row's day,
  -- and the row must not still be awaiting the user's confirmation; otherwise it waits for the hard cap.
  WITH t AS (SELECT id FROM sms_parse_log
              WHERE status NOT IN ('rejected', 'failed', 'processing') AND raw_body IS NOT NULL
                AND coalesce(awaiting_confirmation, false) = false
                AND received_at < now() - make_interval(days => v_parsed_days)
                AND learned_at IS NOT NULL AND masked_body IS NOT NULL AND coalesce(masked_version, 0) >= v_min_version
                AND private.sms_review_covers(received_at)
              LIMIT 5000 FOR UPDATE SKIP LOCKED),
       u AS (UPDATE sms_parse_log l SET raw_body = NULL, push_result = NULL FROM t WHERE l.id = t.id RETURNING 1)
  SELECT count(*) INTO v_parsed FROM u;
  SELECT EXISTS (SELECT 1 FROM sms_parse_log
                  WHERE status NOT IN ('rejected', 'failed', 'processing') AND raw_body IS NOT NULL
                    AND received_at < now() - make_interval(days => v_parsed_days)
                    AND NOT private.sms_review_covers(received_at)) INTO v_held;

  -- Hard cap: never-learned rows (learning pipeline broken) are purged anyway, and the audit row is the alert.
  -- Not subject to the review (the 60-day cap always wins).
  WITH t AS (SELECT id FROM sms_parse_log
              WHERE status NOT IN ('rejected', 'failed', 'processing') AND raw_body IS NOT NULL
                AND received_at < now() - make_interval(days => v_cap_days)
              LIMIT 5000 FOR UPDATE SKIP LOCKED),
       u AS (UPDATE sms_parse_log l SET raw_body = NULL, push_result = NULL FROM t WHERE l.id = t.id RETURNING 1)
  SELECT count(*) INTO v_never FROM u;

  DELETE FROM sms_corpus WHERE seen_count < 3 AND last_seen < now() - make_interval(days => v_corpus_days);
  GET DIAGNOSTICS v_corpus = ROW_COUNT;

  INSERT INTO sms_retention_audit (outcome, rejected_purged, rejected_cap_fired, parsed_masked, parsed_held,
                                   never_learned_purged, failed_blanked, failed_deleted, corpus_dropped, explicit_expired)
  VALUES ('ran', v_rej, v_rej_cap, v_parsed, v_held, v_never, v_fail_blank, v_fail_del, v_corpus, v_expl);

  RETURN v_rej + v_parsed + v_never + v_fail_blank + v_expl;
END $function$;

-- Previous (live, broken) definition, for rollback:
--   UPDATE sms_parse_log SET raw_body = NULL, push_result = NULL
--    WHERE id IN (SELECT id FROM sms_parse_log WHERE received_at < now() - interval '30 days'
--                 AND harvested_at IS NOT NULL AND raw_body IS NOT NULL LIMIT 5000);
--   DELETE FROM sms_corpus WHERE seen_count < 3 AND last_seen < now() - interval '30 days';

-- 6. Assertions ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF (SELECT is_nullable FROM information_schema.columns
       WHERE table_name = 'sms_parse_log' AND column_name = 'raw_body') <> 'YES' THEN
    RAISE EXCEPTION '0209: raw_body should be nullable';
  END IF;
  IF (SELECT value FROM public.platform_settings WHERE key = 'sms_retention_enabled') <> 'false'::jsonb THEN
    RAISE EXCEPTION '0209: retention must stay disabled when this migration is applied';
  END IF;
  IF public.sms_retention() <> 0 THEN
    RAISE EXCEPTION '0209: sms_retention() must be a no-op while disabled';
  END IF;
END $$;

COMMIT;
