-- Make the fee tolerance a property of the PAIR, not of whichever leg happens to arrive
-- second.
--
-- 0087 derived the tolerance from the calling leg's kind, so it only worked when the
-- cc_payoff leg arrived last. If the funding leg arrived last it called in as
-- `own_transfer` with tolerance 0, and 12,012 vs 12,000 never matched — the user still saw
-- the payoff twice, just less often.
--
-- The ordering is genuinely non-deterministic: SmsForwardWorker retries with WorkManager
-- backoff on a 502 or on network loss, so a leg the bank sent first can be delivered second.
--
-- The tolerance should apply exactly when ONE OF THE TWO legs is a cc_payoff — that is the
-- only case where a transfer fee can legitimately separate two reports of the same money.
-- The caller knows its own kind; only SQL knows the candidate's. So both are considered
-- here, and `own_transfer` <-> `own_transfer` keeps matching exactly.
DROP FUNCTION IF EXISTS public.sms_try_pair(uuid, uuid, timestamptz, integer, numeric, boolean, text[], numeric);

CREATE FUNCTION sms_try_pair(
  p_user_id uuid,
  p_log_id uuid,
  p_received_at timestamptz,
  p_window_seconds integer,
  p_amount numeric,
  p_require_equal_amount boolean,
  p_match_kinds text[],
  p_amount_tolerance numeric DEFAULT 0,
  -- Kind of the CALLING leg. Only used to decide whether the pair may differ by a fee.
  p_self_kind text DEFAULT NULL
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
    AND (
      NOT p_require_equal_amount
      OR abs(s.amount - p_amount) <= CASE
           WHEN 'cc_payoff' IN (COALESCE(p_self_kind, ''), COALESCE(s.kind, ''))
             THEN COALESCE(p_amount_tolerance, 0)
           ELSE 0
         END
    )
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
