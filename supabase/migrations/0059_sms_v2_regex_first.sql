-- SMS v2: regex-first pipeline. Dedup gating removed; curated tier added;
-- learned templates become global; custom keywords feature dropped.

-- 1. Remove the dedup gate (claim/23505 flow deleted from the route).
DROP INDEX IF EXISTS public.sms_parse_log_hash_unique_idx;

-- 2. parse_method gains 'curated' (code-shipped pattern library tier).
ALTER TABLE public.sms_parse_log DROP CONSTRAINT IF EXISTS sms_parse_log_parse_method_check;
ALTER TABLE public.sms_parse_log ADD CONSTRAINT sms_parse_log_parse_method_check
  CHECK (parse_method IN ('ai', 'static', 'curated'));

-- 3. New extraction fields.
ALTER TABLE public.sms_parse_log
  ADD COLUMN IF NOT EXISTS payment_instrument text
    CHECK (payment_instrument IN ('card', 'account', 'wallet')),
  ADD COLUMN IF NOT EXISTS pattern_id text;
COMMENT ON COLUMN public.sms_parse_log.pattern_id IS
  'Curated pattern id (e.g. hsbc-ipn-out-1) when parse_method=curated.';

-- 4. Learned templates become GLOBAL (table is empty — no de-dupe needed; verified 0 rows).
UPDATE public.sms_tracking_templates_ai SET user_id = NULL;
DROP INDEX IF EXISTS idx_sms_templates_user_sender_pattern;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_templates_sender_pattern
  ON public.sms_tracking_templates_ai (sender, md5(regex_pattern));

-- 5. Custom keywords feature removed end-to-end.
ALTER TABLE public.user_settings DROP COLUMN IF EXISTS custom_sms_keywords;
