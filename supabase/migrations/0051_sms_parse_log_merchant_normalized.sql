-- Canonical merchant name for grouping across branch/location variants.
-- Enables merchant-level spending analytics (e.g. "Carrefour Maadi" and "Carrefour Egypt" group together).
ALTER TABLE public.sms_parse_log
  ADD COLUMN IF NOT EXISTS merchant_normalized text;

CREATE INDEX IF NOT EXISTS sms_parse_log_merchant_norm_idx
  ON public.sms_parse_log (user_id, merchant_normalized)
  WHERE merchant_normalized IS NOT NULL AND parsed_ok = true;

COMMENT ON COLUMN public.sms_parse_log.merchant_normalized IS
  'Canonical merchant name without branch/location suffix, extracted by Gemini. Null for ATM withdrawals and transfers.';
