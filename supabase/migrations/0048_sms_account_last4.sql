-- Add account_last4 to sms_parse_log for payment method detection.
-- The server validates this field to a maximum of 4 digits before writing.
ALTER TABLE public.sms_parse_log
  ADD COLUMN IF NOT EXISTS account_last4 text;

COMMENT ON COLUMN public.sms_parse_log.account_last4 IS
  'Last 4 digits of the bank account or card detected in the SMS (server-validated, never full number).';
