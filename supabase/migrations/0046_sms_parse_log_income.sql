-- Track income entries created from SMS credits, and flag time-based duplicate SMS.
--
-- is_duplicate: set true when a second SMS with the same amount+currency arrives
--   within 3 minutes (InstaPay/Vodafone Cash sends one from the service + one from
--   the bank; the second is logged here and discarded from the ledger).
--
-- income_id: parallel to expense_id — populated when an inbound-credit SMS
--   auto-creates a row in income_sources instead of expenses.

ALTER TABLE public.sms_parse_log
  ADD COLUMN IF NOT EXISTS is_duplicate boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS income_id uuid REFERENCES public.income_sources (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS sms_parse_log_time_dedup_idx
  ON public.sms_parse_log (user_id, amount, currency, created_at DESC)
  WHERE parsed_ok = true AND is_duplicate = false;
