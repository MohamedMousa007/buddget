-- Persist Gemini-extracted kind, clean_title, and raw_sms_summary for richer queries and UI.
-- Previously these were used only in push notification payloads but never stored.
ALTER TABLE public.sms_parse_log
  ADD COLUMN IF NOT EXISTS kind             text,
  ADD COLUMN IF NOT EXISTS clean_title      text,
  ADD COLUMN IF NOT EXISTS raw_sms_summary  text;

COMMENT ON COLUMN public.sms_parse_log.kind IS
  'Gemini transaction kind: purchase | online_purchase | atm_withdrawal | instant_transfer_out | instant_transfer_in | income | refund | fee | other';
COMMENT ON COLUMN public.sms_parse_log.clean_title IS
  'Short human-readable title from Gemini (e.g. "Carrefour Egypt", "Transfer to Ali Hassan").';
COMMENT ON COLUMN public.sms_parse_log.raw_sms_summary IS
  'One-sentence plain-English summary of the SMS, stripped of reference numbers, used as expense notes.';
