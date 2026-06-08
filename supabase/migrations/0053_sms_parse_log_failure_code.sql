-- Diagnostic failure code for SMS parse attempts.
-- Lets tech support see exactly why an SMS didn't log without guessing.
ALTER TABLE public.sms_parse_log
  ADD COLUMN IF NOT EXISTS failure_code text;

COMMENT ON COLUMN public.sms_parse_log.failure_code IS
  'Diagnostic code when parsed_ok=false or row is a skipped duplicate:
   gemini_error | not_transaction | null_amount | low_confidence | duplicate | log_insert_failed | parse_exception';
