-- S2c step 3 (invariants I3, I7): sms_try_pair refuses pairs that cannot be one movement of money.
--
-- Until now a candidate leg was accepted on kind, time and amount alone. Each guard below refuses one false pair
-- and nothing else. Every guard is read under I7: a value that is null on either side is "unknown", an unknown
-- value passes, and a guard refuses only when both sides are known and conflict.
--
--   a. A duplicate, a failed or rejected row, and a row held for the user's confirmation are never claimed. A row
--      still being processed IS claimable: the claimer waits for it (pairing race fix, migration 0235).
--   b. The claim may name the one sibling the caller read (p_sibling_id), so a leg that decided on one candidate
--      cannot end up claiming another.
--   c. Two legs on the same known account are one account's own movement, not a transfer between two accounts
--      (a currency exchange legitimately has both legs on the same bank, so it is exempt).
--   d. Two known, different currencies are not one movement (an exchange is the opposite: it needs them different,
--      and that clause is unchanged).
--   e. Two transfers out, or two transfers in, are not a pair. Direction comes from the kind where the kind is
--      certain (transfer in and card repayment are credits, transfer out is a debit), else the direction the leg
--      published.
--   f. A card repayment pairs only with a funding leg that could have paid it. A transfer that names digits other
--      than the card's, or names another person, is somebody else's money. The transfer-fee allowance on the amount
--      applies only when the digits agree or both legs carry the same payment reference; otherwise the amounts must
--      be exactly equal.
--
-- The same rules exist as a pure function, pairGuardsAllow in src/lib/sms/pairing.ts, used by tests and by the
-- replay. This file is the enforcing copy: change both together.
--
-- The caller's own row is read once (v_self) and its published facts are used, so the caller must publish them
-- before claiming (publishTransferLeg and tryPairLeg do). The 13-argument signature is dropped and replaced by one
-- with p_sibling_id added last, defaulted, so the app version already deployed keeps working.
-- own_transfer_verdict has no check constraint (0266), so the new value 'ask_account' needs none.

DROP FUNCTION IF EXISTS public.sms_try_pair(uuid, uuid, timestamptz, integer, numeric, boolean, text[], numeric, text, text, boolean, text, text);

COMMENT ON COLUMN public.sms_parse_log.own_transfer_verdict IS
  'settle (strong evidence, booked as an own transfer), ask (middle evidence between two legs, the user is asked once), ask_account (one leg whose counterparty digits are the user''s own account: booked as its plain kind and the user is asked once), none, undone or declined (the user said no).';

-- Direction of one leg: certain from the kind where the kind says so, else what the leg published (may be null).
CREATE OR REPLACE FUNCTION public.sms_leg_direction(p_kind text, p_leg_direction text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
 SET search_path TO 'pg_temp'
AS $$
  SELECT CASE
    WHEN p_kind IN ('instant_transfer_in', 'cc_payoff') THEN 'credit'
    WHEN p_kind = 'instant_transfer_out' THEN 'debit'
    ELSE p_leg_direction
  END
$$;

-- True when exactly one of the two legs is a card repayment and the funding leg's digits name the card, or both legs
-- carry one payment reference: the only cases where a transfer fee may separate the two amounts.
CREATE OR REPLACE FUNCTION public.sms_repayment_fee_proven(p_self public.sms_parse_log, p_sib public.sms_parse_log, p_self_kind text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_self_is_card boolean := coalesce(coalesce(p_self_kind, p_self.kind), '') = 'cc_payoff';
  v_sib_is_card boolean := coalesce(p_sib.kind, '') = 'cc_payoff';
  v_funding_digits text;
  v_card_digits text;
BEGIN
  IF v_self_is_card = v_sib_is_card THEN
    RETURN false;
  END IF;
  IF v_self_is_card THEN
    v_funding_digits := p_sib.counterparty_last4;
    v_card_digits := p_self.account_last4;
  ELSE
    v_funding_digits := p_self.counterparty_last4;
    v_card_digits := p_sib.account_last4;
  END IF;
  RETURN (coalesce(length(v_funding_digits), 0) >= 3 AND coalesce(length(v_card_digits), 0) >= 3
          AND public.sms_last4_match(v_funding_digits, v_card_digits))
      OR (p_self.reference_hash IS NOT NULL AND p_self.reference_hash = p_sib.reference_hash);
END;
$$;

-- Guards c, d, e and f (the refusals that compare the two legs). Guards a and b are plain conditions in sms_try_pair.
-- Tails shorter than 3 digits cannot be compared (sms_last4_match needs 3), so they count as unknown here.
CREATE OR REPLACE FUNCTION public.sms_pair_guards_ok(p_self public.sms_parse_log, p_sib public.sms_parse_log, p_self_kind text, p_self_direction text, p_self_currency text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_kind text := coalesce(p_self_kind, p_self.kind);
  v_sib_direction text := public.sms_leg_direction(p_sib.kind, p_sib.leg_direction);
  v_self_is_card boolean := coalesce(v_kind, '') = 'cc_payoff';
  v_sib_is_card boolean := coalesce(p_sib.kind, '') = 'cc_payoff';
  v_funding_digits text;
  v_funding_hash text;
  v_funding_is_self boolean;
  v_card_digits text;
BEGIN
  IF p_self_kind IS NOT DISTINCT FROM 'currency_exchange' THEN
    RETURN true;
  END IF;

  IF p_self.account_last4 IS NOT NULL AND p_sib.account_last4 IS NOT NULL
     AND public.sms_last4_match(p_sib.account_last4, p_self.account_last4) THEN
    RETURN false;
  END IF;

  IF p_self_currency IS NOT NULL AND p_sib.currency IS NOT NULL
     AND upper(p_self_currency) <> upper(p_sib.currency) THEN
    RETURN false;
  END IF;

  IF p_self_direction IS NOT NULL AND v_sib_direction IS NOT NULL AND p_self_direction = v_sib_direction THEN
    RETURN false;
  END IF;

  IF v_self_is_card <> v_sib_is_card THEN
    IF v_self_is_card THEN
      v_funding_digits := p_sib.counterparty_last4;
      v_funding_hash := p_sib.counterparty_hash;
      v_funding_is_self := p_sib.counterparty_is_self;
      v_card_digits := p_self.account_last4;
    ELSE
      v_funding_digits := p_self.counterparty_last4;
      v_funding_hash := p_self.counterparty_hash;
      v_funding_is_self := p_self.counterparty_is_self;
      v_card_digits := p_sib.account_last4;
    END IF;
    IF coalesce(length(v_funding_digits), 0) >= 3 AND coalesce(length(v_card_digits), 0) >= 3
       AND NOT public.sms_last4_match(v_funding_digits, v_card_digits) THEN
      RETURN false;
    END IF;
    -- A transfer that names a person who is known not to be the user is somebody else's money.
    IF v_funding_hash IS NOT NULL AND v_funding_is_self = false THEN
      RETURN false;
    END IF;
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.sms_try_pair(p_user_id uuid, p_log_id uuid, p_received_at timestamp with time zone, p_window_seconds integer, p_amount numeric, p_require_equal_amount boolean, p_match_kinds text[], p_amount_tolerance numeric DEFAULT 0, p_self_kind text DEFAULT NULL::text, p_reference text DEFAULT NULL::text, p_require_registered_sibling boolean DEFAULT false, p_direction text DEFAULT NULL::text, p_currency text DEFAULT NULL::text, p_sibling_id uuid DEFAULT NULL::uuid)
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
             WHEN p_require_registered_sibling THEN COALESCE(p_amount_tolerance, 0)
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

REVOKE ALL ON FUNCTION public.sms_leg_direction(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sms_leg_direction(text, text) TO service_role;
REVOKE ALL ON FUNCTION public.sms_repayment_fee_proven(public.sms_parse_log, public.sms_parse_log, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sms_repayment_fee_proven(public.sms_parse_log, public.sms_parse_log, text) TO service_role;
REVOKE ALL ON FUNCTION public.sms_pair_guards_ok(public.sms_parse_log, public.sms_parse_log, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sms_pair_guards_ok(public.sms_parse_log, public.sms_parse_log, text, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.sms_try_pair(uuid, uuid, timestamptz, integer, numeric, boolean, text[], numeric, text, text, boolean, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sms_try_pair(uuid, uuid, timestamptz, integer, numeric, boolean, text[], numeric, text, text, boolean, text, text, uuid) TO service_role;
