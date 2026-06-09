-- Raw-body hash dedup: claim-before-parse unique gate.
-- sms_hash semantics change from sha256(cents:merchant:day) to
-- sha256(normalized raw SMS body) — claimed BEFORE any Gemini call so
-- concurrent/retried requests for the same SMS cost zero AI tokens.

-- 1) Demote historical same-hash duplicates so the unique index can build.
WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY user_id, sms_hash ORDER BY created_at ASC
  ) AS rn
  FROM public.sms_parse_log
  WHERE sms_hash IS NOT NULL AND is_duplicate = false
)
UPDATE public.sms_parse_log l
SET is_duplicate = true,
    failure_code = COALESCE(l.failure_code, 'duplicate')
FROM ranked r
WHERE l.id = r.id AND r.rn > 1;

-- 2) The atomic-claim gate (same definition as the never-applied 0047).
DROP INDEX IF EXISTS public.sms_parse_log_hash_unique_idx;
CREATE UNIQUE INDEX sms_parse_log_hash_unique_idx
  ON public.sms_parse_log (user_id, sms_hash)
  WHERE is_duplicate = false;

-- 3) Document the failure-code vocabulary (includes new claim-flow codes).
COMMENT ON COLUMN public.sms_parse_log.failure_code IS
  'gemini_error | not_transaction | null_amount | low_confidence | duplicate |
   log_insert_failed | parse_exception | processing | rate_limited | not_configured';
