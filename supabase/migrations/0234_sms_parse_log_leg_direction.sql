-- SMS4: the ledger direction of a two-leg movement, published with the leg so the sibling search can require
-- OPPOSITE directions for a currency exchange (debit in one currency, credit in the other).
-- NULL = the leg's direction could not be read; a currency exchange never pairs on an unknown direction.
ALTER TABLE public.sms_parse_log
  ADD COLUMN IF NOT EXISTS leg_direction text
  CONSTRAINT sms_parse_log_leg_direction_check CHECK (leg_direction IS NULL OR leg_direction IN ('credit', 'debit'));
