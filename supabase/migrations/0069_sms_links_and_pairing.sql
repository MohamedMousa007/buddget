-- SMS link columns + atomic pairing RPC for transfer/FX two-leg reconciliation.
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS sms_log_id uuid;

ALTER TABLE sms_parse_log ADD COLUMN IF NOT EXISTS paired_log_id uuid;
ALTER TABLE sms_parse_log ADD COLUMN IF NOT EXISTS debt_payment_id uuid;
ALTER TABLE sms_parse_log ADD COLUMN IF NOT EXISTS savings_transaction_id uuid;
ALTER TABLE sms_parse_log ADD COLUMN IF NOT EXISTS counterparty_last4 text;

CREATE INDEX IF NOT EXISTS idx_sms_parse_log_pairing
  ON sms_parse_log (user_id, received_at)
  WHERE paired_log_id IS NULL;

-- Atomically claim an unpaired sibling leg and link both rows.
-- Used for own_transfer (equal amount) and currency_exchange (cross-currency, amounts differ).
-- Returns the sibling row (id + identifying fields) or no rows when none match.
CREATE OR REPLACE FUNCTION sms_try_pair(
  p_user_id uuid,
  p_log_id uuid,
  p_received_at timestamptz,
  p_window_seconds integer,
  p_amount numeric,
  p_require_equal_amount boolean,
  p_match_kinds text[]
)
RETURNS TABLE (sibling_id uuid, sibling_kind text, sibling_expense_id uuid, sibling_income_id uuid, sibling_status text)
LANGUAGE plpgsql
AS $$
DECLARE
  v_sibling sms_parse_log%ROWTYPE;
BEGIN
  SELECT * INTO v_sibling
  FROM sms_parse_log s
  WHERE s.user_id = p_user_id
    AND s.id <> p_log_id
    AND s.paired_log_id IS NULL
    AND s.parsed_ok = true
    AND s.kind = ANY(p_match_kinds)
    AND s.received_at BETWEEN p_received_at - make_interval(secs => p_window_seconds)
                          AND p_received_at + make_interval(secs => p_window_seconds)
    AND (NOT p_require_equal_amount OR s.amount = p_amount)
  ORDER BY abs(extract(epoch FROM (s.received_at - p_received_at)))
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE sms_parse_log SET paired_log_id = v_sibling.id WHERE id = p_log_id;
  UPDATE sms_parse_log SET paired_log_id = p_log_id WHERE id = v_sibling.id;

  sibling_id := v_sibling.id;
  sibling_kind := v_sibling.kind;
  sibling_expense_id := v_sibling.expense_id;
  sibling_income_id := v_sibling.income_id;
  sibling_status := v_sibling.status;
  RETURN NEXT;
END;
$$;
