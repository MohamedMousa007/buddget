-- S2d (finding N9, invariants I3, I7): a wallet top-up that carries a fee pairs.
--
-- The bank leg (a purchase at the user's own wallet, debited amount + fee) and the wallet's own message (credited
-- amount) differ by the fee, and sms_try_pair paired own transfers on the exact amount only, so the wallet credit was
-- booked as income. The caller (pairing.ts) now passes p_fee_proven = true, together with p_sibling_id, only after it
-- has read both legs and checked that the debit is a purchase at the user's own wallet and the credit names the same
-- wallet. When p_fee_proven is true the amount tolerance applies; nothing else in the function changes.
--
-- The 14-argument signature is dropped and replaced by one with p_fee_proven added last, defaulted to false, so the app
-- version already deployed (which calls with named arguments and never sends it) keeps working unchanged.

DROP FUNCTION IF EXISTS public.sms_try_pair(uuid, uuid, timestamptz, integer, numeric, boolean, text[], numeric, text, text, boolean, text, text, uuid);

CREATE OR REPLACE FUNCTION public.sms_try_pair(p_user_id uuid, p_log_id uuid, p_received_at timestamp with time zone, p_window_seconds integer, p_amount numeric, p_require_equal_amount boolean, p_match_kinds text[], p_amount_tolerance numeric DEFAULT 0, p_self_kind text DEFAULT NULL::text, p_reference text DEFAULT NULL::text, p_require_registered_sibling boolean DEFAULT false, p_direction text DEFAULT NULL::text, p_currency text DEFAULT NULL::text, p_sibling_id uuid DEFAULT NULL::uuid, p_fee_proven boolean DEFAULT false)
 RETURNS TABLE(sibling_id uuid, sibling_kind text, sibling_expense_id uuid, sibling_income_id uuid, sibling_status text)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_sibling sms_parse_log%ROWTYPE;
  v_self sms_parse_log%ROWTYPE;
  v_self_direction text;
  v_self_currency text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('sms_try_pair:' || p_user_id::text, 0));

  SELECT * INTO v_self FROM sms_parse_log s WHERE s.id = p_log_id;
  IF v_self.paired_log_id IS NOT NULL THEN
    RETURN;
  END IF;

  v_self_direction := coalesce(p_direction, public.sms_leg_direction(v_self.kind, v_self.leg_direction));
  v_self_currency := coalesce(p_currency, v_self.currency);

  SELECT * INTO v_sibling
  FROM sms_parse_log s
  WHERE s.user_id = p_user_id
    AND s.id <> p_log_id
    AND s.paired_log_id IS NULL
    AND s.parsed_ok = true
    AND s.kind = ANY(p_match_kinds)
    AND coalesce(s.is_duplicate, false) = false
    AND coalesce(s.status, '') NOT IN ('failed', 'rejected')
    AND coalesce(s.awaiting_confirmation, false) = false
    AND (p_sibling_id IS NULL OR s.id = p_sibling_id)
    AND s.received_at BETWEEN p_received_at - make_interval(secs => p_window_seconds)
                          AND p_received_at + make_interval(secs => p_window_seconds)
    AND (
      (p_reference IS NOT NULL AND coalesce(s.raw_body, '') ILIKE '%' || p_reference || '%')
      OR (p_reference IS NULL AND (
        NOT p_require_equal_amount
        OR abs(s.amount - p_amount) <= CASE
             WHEN p_require_registered_sibling OR p_fee_proven THEN COALESCE(p_amount_tolerance, 0)
             WHEN public.sms_repayment_fee_proven(v_self, s, p_self_kind) THEN COALESCE(p_amount_tolerance, 0)
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
    AND public.sms_pair_guards_ok(v_self, s, p_self_kind, v_self_direction, v_self_currency)
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

REVOKE ALL ON FUNCTION public.sms_try_pair(uuid, uuid, timestamptz, integer, numeric, boolean, text[], numeric, text, text, boolean, text, text, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sms_try_pair(uuid, uuid, timestamptz, integer, numeric, boolean, text[], numeric, text, text, boolean, text, text, uuid, boolean) TO service_role;
