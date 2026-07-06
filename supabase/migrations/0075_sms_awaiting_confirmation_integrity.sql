-- 0075: awaiting_confirmation integrity.
--
-- awaiting_confirmation=true is the review chip's single gate. It is legitimate on:
--   * add_failed rows (rescue path — nothing was created yet)
--   * currency_provisional rows (transaction exists; user still confirms the currency)
-- It is stale on rows where a transaction exists and nothing is left to confirm.
-- Clear those (0 rows at time of writing; defensive guard for future drift).
UPDATE public.sms_parse_log
SET awaiting_confirmation = false
WHERE awaiting_confirmation = true
  AND (expense_id IS NOT NULL OR income_id IS NOT NULL OR debt_payment_id IS NOT NULL)
  AND status IN ('confirmed', 'tapped')
  AND failure_code IS DISTINCT FROM 'currency_provisional';
