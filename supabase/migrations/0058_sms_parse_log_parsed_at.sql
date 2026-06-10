-- parsed_at: records when the claim row was inserted.
-- Used by the stale-processing takeover CAS: if a 'processing' claim is
-- older than 2 minutes (WorkManager crashed mid-parse), the next retry can
-- atomically take it over instead of inserting a new row.
ALTER TABLE public.sms_parse_log
  ADD COLUMN IF NOT EXISTS parsed_at timestamptz;

COMMENT ON COLUMN public.sms_parse_log.parsed_at IS
  'When parsing was claimed (claim row inserted). Stale claims (processing > 2 min) can be retaken by a retry.';

-- Fix the template unique index to be scoped per-user.
-- The old (sender, pattern) index without user_id blocked two different users
-- from learning templates for the same bank sender.
DROP INDEX IF EXISTS idx_sms_templates_sender_pattern;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_templates_user_sender_pattern
  ON public.sms_tracking_templates_ai (user_id, sender, md5(regex_pattern));
