-- Pair the two legs of an account-to-account IPN transfer between the user's OWN accounts.
--
-- IPN SMS never carry the OTHER account's number — the outbound leg names the recipient only
-- by name, the inbound leg names no sender — so the counterparty-last4 join (step 1 in
-- dispatch) can never see them, and an own transfer was booked as Remittance + income.
--
-- Two new ways to claim a sibling, both stricter than the amount+time match:
--   p_reference: both legs carry the SAME IPN reference ("with reference b3abc23b" /
--     "Ref# b3abc23b"). The inbound SMS reaches this phone ONLY because the receiving account
--     is the user's own, so identical references across an out+in leg = own transfer, for
--     certain. Amount equality is ignored (the transfer fee makes the legs differ).
--   p_require_registered_sibling: fallback when a bank garbles the reference — the sibling's
--     OWN account must be a registered payment method (the caller checks its own the same way),
--     and the fee tolerance is applied to the amount.
--
-- Both params default to the pre-0089 behaviour, so existing callers are unaffected.
DROP FUNCTION IF EXISTS public.sms_try_pair(uuid, uuid, timestamptz, integer, numeric, boolean, text[], numeric, text);

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
  p_self_kind text DEFAULT NULL,
  -- When set, claim the sibling whose raw_body contains this IPN reference; amount ignored.
  p_reference text DEFAULT NULL,
  -- When true, the sibling's own account must be a registered payment method.
  p_require_registered_sibling boolean DEFAULT false
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
      -- Reference is definitive: same IPN ref on both legs, amount left to the fee.
      (p_reference IS NOT NULL AND s.raw_body ILIKE '%' || p_reference || '%')
      OR (p_reference IS NULL AND (
        NOT p_require_equal_amount
        OR abs(s.amount - p_amount) <= CASE
             -- fee margin applies to the registered-account fallback and to cc_payoff pairs.
             WHEN p_require_registered_sibling THEN COALESCE(p_amount_tolerance, 0)
             WHEN 'cc_payoff' IN (COALESCE(p_self_kind, ''), COALESCE(s.kind, ''))
               THEN COALESCE(p_amount_tolerance, 0)
             ELSE 0
           END
      ))
    )
    AND (
      NOT p_require_registered_sibling
      OR EXISTS (
        SELECT 1 FROM payment_methods pm
        WHERE pm.user_id = p_user_id
          AND pm.last4 = s.account_last4
          AND pm.deleted_at IS NULL
      )
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
