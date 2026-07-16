-- Let sms_try_pair match two legs whose amounts differ by a transfer fee.
--
-- Paying a credit card by Instapay produces two SMS: the funding bank debits 12,012 EGP
-- (12,000 + a 12 EGP fee) and the card bank reports a 12,000 payment. The existing
-- predicate demanded exact equality, so the legs never merged and the user saw the same
-- payoff twice.
--
-- DROP before CREATE is mandatory: adding a parameter to an existing function creates a
-- second OVERLOAD rather than replacing it, and PostgREST then cannot choose between them
-- (PGRST203 "Could not choose the best candidate function"). A DEFAULT does not help — it
-- makes the 8-arg form match a 7-key body too.
DROP FUNCTION IF EXISTS public.sms_try_pair(uuid, uuid, timestamptz, integer, numeric, boolean, text[]);

CREATE FUNCTION sms_try_pair(
  p_user_id uuid,
  p_log_id uuid,
  p_received_at timestamptz,
  p_window_seconds integer,
  p_amount numeric,
  p_require_equal_amount boolean,
  p_match_kinds text[],
  -- Absolute amount slack. 0 keeps own_transfer's exact-match behaviour; cc_payoff passes
  -- a fee-sized allowance. Ignored entirely when p_require_equal_amount is false
  -- (currency_exchange, where the two legs are in different currencies).
  p_amount_tolerance numeric DEFAULT 0
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
    AND (NOT p_require_equal_amount OR abs(s.amount - p_amount) <= COALESCE(p_amount_tolerance, 0))
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
