-- QA2 B4 / D8 D21 N11 Q18: atomic, idempotent SMS booking of a debt payment + its expense, and uniqueness on sms_log_id.
--
-- What it does
--   1. debt_payments.sms_log_id (nullable uuid, additive; no FK so sync ordering is unaffected).
--   2. New RPC add_sms_debt_payment_with_expense(p_user_id, p_sms_log_id, p_payment, p_expense): ONE transaction,
--      keyed on sms_log_id (a replay returns the rows that already exist, and completes a half-posted pair), locks the
--      debt row, refuses an overpay, marks the debt cleared when fully paid. SERVICE ROLE ONLY (the SMS routes run
--      with the service client, auth.uid() is null, so ownership is checked against p_user_id explicitly).
--      The live add_debt_payment_with_expense(jsonb, jsonb) (client RPC) is NOT touched: new function name, old kept.
--   3. Partial unique indexes on live rows (deleted_at IS NULL, sms_log_id IS NOT NULL):
--        expenses       : unique (sms_log_id, (description = 'Transfer fee'))  -> at most ONE main row and ONE fee row
--                         per SMS. dispatch.postTransferFee writes the fee as its own expense that SHARES the payoff
--                         leg's sms_log_id with description 'Transfer fee', so a plain unique(sms_log_id) would break it.
--        income_events  : unique (sms_log_id)
--        debt_payments  : unique (sms_log_id)
--
-- DEPLOY ORDER: RESTRICTIVE (unique indexes) + additive (column, function). Apply AFTER the code that tolerates
--   23505 on those inserts and falls back from a missing RPC (PGRST202) is deployed and verified. Installed native
--   builds never write these tables with an sms_log_id (only the server routes do), so they are unaffected.
--   If a client edits a fee row's description away from 'Transfer fee' the row is then counted as a main row and the
--   edit fails on sync with 23505 (edge case, accepted; fee rows are read-only in practice).
--
-- AUDIT SELECTs (expected counts on the day of writing in brackets; the migration asserts the duplicates ones)
--   select count(*) from (select sms_log_id from expenses where sms_log_id is not null and deleted_at is null
--                         group by sms_log_id, (description = 'Transfer fee') having count(*) > 1) x;      -- 0
--   select count(*) from (select sms_log_id from income_events where sms_log_id is not null and deleted_at is null
--                         group by 1 having count(*) > 1) x;                                               -- 0
--   select count(*) from expenses where description = 'Transfer fee' and sms_log_id is not null;           -- 0 (fee rows share sms_log_id)
--   select count(*) from information_schema.columns where table_name='debt_payments' and column_name='sms_log_id'; -- 0
--   select proname from pg_proc where proname = 'add_sms_debt_payment_with_expense';                       -- none
--
-- ROLLBACK
--   drop function public.add_sms_debt_payment_with_expense(uuid, uuid, jsonb, jsonb);
--   drop index if exists public.expenses_sms_log_unique_idx, public.income_events_sms_log_unique_idx, public.debt_payments_sms_log_unique_idx;
--   alter table public.debt_payments drop column sms_log_id;   -- only if no row carries one you want to keep

BEGIN;

DO $$
DECLARE d1 int; d2 int;
BEGIN
  SELECT count(*) INTO d1 FROM (SELECT 1 FROM public.expenses WHERE sms_log_id IS NOT NULL AND deleted_at IS NULL
                                GROUP BY sms_log_id, (description = 'Transfer fee') HAVING count(*) > 1) x;
  SELECT count(*) INTO d2 FROM (SELECT 1 FROM public.income_events WHERE sms_log_id IS NOT NULL AND deleted_at IS NULL
                                GROUP BY sms_log_id HAVING count(*) > 1) x;
  IF d1 <> 0 OR d2 <> 0 THEN
    RAISE EXCEPTION '0210: live duplicate sms_log_id rows exist (expenses %, income_events %); resolve before indexing', d1, d2;
  END IF;
END $$;

ALTER TABLE public.debt_payments ADD COLUMN IF NOT EXISTS sms_log_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS expenses_sms_log_unique_idx
  ON public.expenses (sms_log_id, ((description = 'Transfer fee')))
  WHERE sms_log_id IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS income_events_sms_log_unique_idx
  ON public.income_events (sms_log_id) WHERE sms_log_id IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS debt_payments_sms_log_unique_idx
  ON public.debt_payments (sms_log_id) WHERE sms_log_id IS NOT NULL AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.add_sms_debt_payment_with_expense(
  p_user_id uuid, p_sms_log_id uuid, p_payment jsonb, p_expense jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_debt public.debts;
  v_debt_id uuid := (p_payment ->> 'debt_id')::uuid;
  v_pay_id uuid; v_exp_id uuid;
  v_pay_existed boolean := false; v_exp_existed boolean := false;
  v_new numeric := coalesce((p_payment ->> 'amount_in_debt_unit')::numeric, (p_payment ->> 'amount')::numeric);
  v_total numeric; v_paid numeric; v_cleared boolean := false;
  v_pay_date date := coalesce((p_payment ->> 'payment_date')::date, CURRENT_DATE);
BEGIN
  IF p_user_id IS NULL OR p_sms_log_id IS NULL THEN
    RAISE EXCEPTION 'user and sms log are required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sms_parse_log WHERE id = p_sms_log_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'sms log not found or not owned';
  END IF;

  SELECT * INTO v_debt FROM public.debts WHERE id = v_debt_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR v_debt.user_id <> p_user_id THEN
    RAISE EXCEPTION 'Debt not found or not owned by user';
  END IF;
  PERFORM public.assert_payment_method_owned(NULLIF(p_payment ->> 'payment_method_id', '')::uuid, p_user_id);
  PERFORM public.assert_payment_method_owned(NULLIF(p_expense ->> 'payment_method_id', '')::uuid, p_user_id);

  -- Idempotency: reuse whatever an earlier (possibly partial) attempt already wrote for this SMS.
  SELECT id INTO v_pay_id FROM public.debt_payments
   WHERE sms_log_id = p_sms_log_id AND user_id = p_user_id AND deleted_at IS NULL;
  v_pay_existed := v_pay_id IS NOT NULL;
  SELECT id INTO v_exp_id FROM public.expenses
   WHERE sms_log_id = p_sms_log_id AND user_id = p_user_id AND deleted_at IS NULL AND description IS DISTINCT FROM 'Transfer fee';
  v_exp_existed := v_exp_id IS NOT NULL;

  IF NOT v_pay_existed THEN
    -- Overpay guard: revolving cards have no fixed total; every other debt is capped at its starting balance.
    IF v_debt.debt_type <> 'credit_card' THEN
      v_total := coalesce(v_debt.starting_balance, v_debt.amount);
      SELECT coalesce(sum(coalesce(amount_in_debt_unit, amount)), 0) INTO v_paid
        FROM public.debt_payments WHERE debt_id = v_debt_id AND deleted_at IS NULL;
      IF v_total IS NOT NULL AND v_total > 0 AND v_paid + v_new > v_total + 0.01 THEN
        RETURN jsonb_build_object('outcome', 'overpay', 'remaining', greatest(v_total - v_paid, 0));
      END IF;
    END IF;

    v_pay_id := coalesce(NULLIF(p_payment ->> 'id', '')::uuid, gen_random_uuid());
    INSERT INTO public.debt_payments (
      id, user_id, debt_id, payment_method_id, amount, currency, payment_date, occurred_at, notes,
      amount_in_debt_unit, original_amount, original_currency, amount_in_base, rate_at_entry, sms_log_id
    ) VALUES (
      v_pay_id, p_user_id, v_debt_id, NULLIF(p_payment ->> 'payment_method_id', '')::uuid,
      (p_payment ->> 'amount')::numeric, (p_payment ->> 'currency')::public.currency_code, v_pay_date,
      NULLIF(p_payment ->> 'occurred_at', '')::timestamptz, p_payment ->> 'notes',
      (p_payment ->> 'amount_in_debt_unit')::numeric, (p_payment ->> 'original_amount')::numeric,
      NULLIF(p_payment ->> 'original_currency', '')::public.currency_code,
      (p_payment ->> 'amount_in_base')::numeric, (p_payment ->> 'rate_at_entry')::numeric, p_sms_log_id
    );
  END IF;

  IF NOT v_exp_existed THEN
    v_exp_id := coalesce(NULLIF(p_expense ->> 'id', '')::uuid, gen_random_uuid());
    INSERT INTO public.expenses (
      id, user_id, description, category, amount, currency, expense_date, occurred_at, payment_method_id,
      is_debt_payment, linked_debt_id, linked_debt_payment_id, notes, sms_log_id
    ) VALUES (
      v_exp_id, p_user_id,
      coalesce(p_expense ->> 'description', 'Debt payment: ' || v_debt.name),
      (p_expense ->> 'category')::public.expense_category,
      (p_expense ->> 'amount')::numeric, (p_expense ->> 'currency')::public.currency_code,
      coalesce((p_expense ->> 'expense_date')::date, v_pay_date),
      NULLIF(p_expense ->> 'occurred_at', '')::timestamptz,
      NULLIF(p_expense ->> 'payment_method_id', '')::uuid,
      true, v_debt_id, v_pay_id, p_expense ->> 'notes', p_sms_log_id
    );
  END IF;

  -- Settle: a fully paid non-revolving debt is cleared (same rule as the client's clearIfFullyPaid).
  IF v_debt.debt_type <> 'credit_card' AND v_debt.status = 'active' THEN
    v_total := coalesce(v_debt.starting_balance, v_debt.amount);
    SELECT coalesce(sum(coalesce(amount_in_debt_unit, amount)), 0) INTO v_paid
      FROM public.debt_payments WHERE debt_id = v_debt_id AND deleted_at IS NULL;
    IF v_total IS NOT NULL AND v_total > 0 AND v_paid >= v_total - 0.005 THEN
      UPDATE public.debts SET status = 'cleared', cleared_at = v_pay_date::timestamptz, updated_at = now()
       WHERE id = v_debt_id;
      v_cleared := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'outcome', CASE WHEN v_pay_existed AND v_exp_existed THEN 'replayed' ELSE 'created' END,
    'debt_payment_id', v_pay_id, 'expense_id', v_exp_id, 'debt_cleared', v_cleared);
END $function$;

REVOKE ALL ON FUNCTION public.add_sms_debt_payment_with_expense(uuid, uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_sms_debt_payment_with_expense(uuid, uuid, jsonb, jsonb) TO service_role;

DO $$
BEGIN
  IF (SELECT count(*) FROM pg_proc WHERE proname = 'add_sms_debt_payment_with_expense') <> 1 THEN
    RAISE EXCEPTION '0210: expected exactly one add_sms_debt_payment_with_expense overload';
  END IF;
END $$;

COMMIT;
