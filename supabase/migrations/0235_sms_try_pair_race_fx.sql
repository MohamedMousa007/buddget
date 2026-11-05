-- SMS3 (pairing race) and SMS4 (currency_exchange pairs with any FX leg).
--
-- SMS3: two legs that arrive together each publish their kind, then each searches for the other. Leg B can fail its
-- search (A has not published yet) and keep posting, while leg A claims B a moment later. A used to see B with no
-- posted row, post nothing, and B then posted as plain income. Now:
--   * claims are serialised per user (advisory xact lock), so two legs can never both miss each other through
--     SKIP LOCKED, and a deadlock between two claims is impossible;
--   * a leg that was ALREADY claimed by another leg claims nothing: the claimer owns the reconcile and the claimed
--     leg just posts its own row normally;
--   * the claimer sees the sibling's status ('processing' = not posted yet) and waits for it to settle before it
--     reconciles (src/lib/sms/pairing.ts), so exactly one non-spend row represents the pair.
-- SMS4: a currency_exchange leg pairs only with an FX leg of the OPPOSITE direction and a DIFFERENT currency. A leg
-- whose direction or currency is unknown never pairs (it posts alone: a visible non-spend row, never a stranded one).
-- No rate band: no rate source exists server-side for this and none is invented here.

DROP FUNCTION IF EXISTS public.sms_try_pair(uuid, uuid, timestamptz, integer, numeric, boolean, text[], numeric, text, text, boolean);

CREATE OR REPLACE FUNCTION public.sms_try_pair(p_user_id uuid, p_log_id uuid, p_received_at timestamp with time zone, p_window_seconds integer, p_amount numeric, p_require_equal_amount boolean, p_match_kinds text[], p_amount_tolerance numeric DEFAULT 0, p_self_kind text DEFAULT NULL::text, p_reference text DEFAULT NULL::text, p_require_registered_sibling boolean DEFAULT false, p_direction text DEFAULT NULL::text, p_currency text DEFAULT NULL::text)
 RETURNS TABLE(sibling_id uuid, sibling_kind text, sibling_expense_id uuid, sibling_income_id uuid, sibling_status text)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_sibling sms_parse_log%ROWTYPE;
  v_self_paired uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('sms_try_pair:' || p_user_id::text, 0));

  SELECT s.paired_log_id INTO v_self_paired FROM sms_parse_log s WHERE s.id = p_log_id;
  IF v_self_paired IS NOT NULL THEN
    RETURN;
  END IF;

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
      (p_reference IS NOT NULL AND coalesce(s.raw_body, '') ILIKE '%' || p_reference || '%')
      OR (p_reference IS NULL AND (
        NOT p_require_equal_amount
        OR abs(s.amount - p_amount) <= CASE
             WHEN p_require_registered_sibling THEN COALESCE(p_amount_tolerance, 0)
             WHEN 'cc_payoff' IN (COALESCE(p_self_kind, ''), COALESCE(s.kind, ''))
               THEN COALESCE(p_amount_tolerance, 0)
             ELSE 0
           END
      ))
    )
    AND (
      NOT p_require_registered_sibling
      OR (
        SELECT count(*) FROM payment_methods pm
        WHERE pm.user_id = p_user_id
          AND public.sms_last4_match(pm.last4, s.account_last4)
          AND pm.deleted_at IS NULL
      ) = 1
    )
    AND (
      p_self_kind IS DISTINCT FROM 'currency_exchange'
      OR (
        p_direction IS NOT NULL AND s.leg_direction IS NOT NULL AND s.leg_direction <> p_direction
        AND p_currency IS NOT NULL AND s.currency IS NOT NULL AND upper(s.currency) <> upper(p_currency)
      )
    )
  ORDER BY abs(extract(epoch FROM (s.received_at - p_received_at)))
  FOR UPDATE
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
$function$;

REVOKE ALL ON FUNCTION public.sms_try_pair(uuid, uuid, timestamptz, integer, numeric, boolean, text[], numeric, text, text, boolean, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sms_try_pair(uuid, uuid, timestamptz, integer, numeric, boolean, text[], numeric, text, text, boolean, text, text) TO service_role;
