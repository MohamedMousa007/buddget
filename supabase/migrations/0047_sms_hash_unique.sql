-- Unique constraint: one non-duplicate parse per hash per user.
-- Prevents concurrent WorkManager + JS listener calls from both writing
-- an expense for the same SMS (race condition dedup).
CREATE UNIQUE INDEX IF NOT EXISTS sms_parse_log_hash_unique_idx
  ON public.sms_parse_log (user_id, sms_hash)
  WHERE is_duplicate = false;
