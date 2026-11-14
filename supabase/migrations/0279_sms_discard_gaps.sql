-- S2d: sms_discard_message gap C and the savings-withdrawal reversal of gap A. Same signature, grants and return keys;
-- two keys are added (savings_withdrawals_reversed, sibling_held), so the deployed route that reads the existing keys keeps working.
--
-- A. A debt payment this discard retires that was funded from a savings pocket (funded_from_savings_tx_id, 0239) now
--    takes its pocket withdrawal with it: the savings_transactions row is soft-deleted, as the app does when the user
--    deletes such a payment (deleteDebtPayment drops the withdrawal and returns the money). The pocket balance follows
--    through trg_savings_tx_delta (0227). A withdrawal another live payment or expense still points at is kept. An
--    expense carrying the link is not reversed: the app does not reverse it on a manual delete either.
-- B. No change: income_events_template_occurrence_uniq (0082) is partial on deleted_at IS NULL and matchSalary reads
--    only live rows, so a soft-deleted salary row does not hold its payday.
-- C. When the sibling is left with no live expense, income or debt payment (a leg that never had a row, or whose row this
--    discard retired), its log is held for the user (awaiting_confirmation, parsed_ok, status 'logged', failure_code
--    'pair_undone') instead of staying 'confirmed' with no row. The held list and /api/sms/confirm book it as usual.

CREATE OR REPLACE FUNCTION public.sms_discard_message(p_user_id uuid, p_log_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_log public.sms_parse_log;
  v_sib public.sms_parse_log;
  v_debt public.debts;
  r record;
  v_exp_ids uuid[] := '{}';
  v_inc_ids uuid[] := '{}';
  v_pay_ids uuid[] := '{}';
  v_pm_ids uuid[] := '{}';
  v_restored uuid;
  v_total numeric; v_paid numeric;
  v_sib_body text;
  v_n_exp int := 0; v_n_inc int := 0; v_n_pay int := 0;
  v_reopened int := 0; v_left_cleared int := 0;
  v_stamps int := 0; v_restored_rows int := 0; v_retagged int := 0; v_fees int := 0; v_backfill int := 0;
  v_subs int := 0; v_reports int := 0; v_accounts int := 0; v_withdrawals int := 0; v_held int := 0;
  v_rows int;
  v_changed int;
  v_had_work boolean;
BEGIN
  IF p_user_id IS NULL OR p_log_id IS NULL THEN
    RAISE EXCEPTION 'user and sms log are required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('sms_try_pair:' || p_user_id::text, 0));

  SELECT * INTO v_log FROM public.sms_parse_log WHERE id = p_log_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false, 'nothing_to_do', true);
  END IF;
  -- An undone message is finished. Returning before any write means a later run can never delete a row the user
  -- re-created for it.
  IF v_log.status = 'undone' THEN
    RETURN jsonb_build_object('found', true, 'nothing_to_do', true);
  END IF;

  PERFORM set_config('sms.discarding', '1', true);

  -- 1. Rows this message owns, including its transfer fee row. No marker: this is the user's own decision.
  -- The snapshot also holds a row the app has just deleted (that is what fires the trigger), so the steps below can
  -- still follow its debt payment, subscription and account. Only rows still live are deleted here.
  SELECT coalesce(array_agg(id), '{}') INTO v_exp_ids
    FROM public.expenses WHERE user_id = p_user_id AND sms_log_id = p_log_id AND retracted_by_sms_log_id IS NULL;
  SELECT coalesce(array_agg(id), '{}') INTO v_inc_ids
    FROM public.income_events WHERE user_id = p_user_id AND sms_log_id = p_log_id AND retracted_by_sms_log_id IS NULL;
  UPDATE public.expenses SET deleted_at = now() WHERE id = ANY (v_exp_ids) AND deleted_at IS NULL;
  GET DIAGNOSTICS v_n_exp = ROW_COUNT;
  UPDATE public.income_events SET deleted_at = now() WHERE id = ANY (v_inc_ids) AND deleted_at IS NULL;
  GET DIAGNOSTICS v_n_inc = ROW_COUNT;

  -- 2. The debt payment this message booked, and the debt it cleared. A payment with another message's id is not ours.
  SELECT coalesce(array_agg(DISTINCT dp.id), '{}') INTO v_pay_ids
    FROM public.debt_payments dp
   WHERE dp.user_id = p_user_id AND dp.deleted_at IS NULL
     AND (dp.sms_log_id = p_log_id
          OR (dp.sms_log_id IS NULL
              AND (dp.id = v_log.debt_payment_id
                   OR dp.id IN (SELECT e.linked_debt_payment_id FROM public.expenses e WHERE e.id = ANY (v_exp_ids)))));
  UPDATE public.debt_payments SET deleted_at = now() WHERE id = ANY (v_pay_ids);
  GET DIAGNOSTICS v_n_pay = ROW_COUNT;

  UPDATE public.savings_transactions st SET deleted_at = now()
   WHERE st.user_id = p_user_id AND st.deleted_at IS NULL AND st.kind IN ('withdraw', 'withdrawal')
     AND st.id IN (SELECT funded_from_savings_tx_id FROM public.debt_payments WHERE id = ANY (v_pay_ids) AND funded_from_savings_tx_id IS NOT NULL)
     AND NOT EXISTS (SELECT 1 FROM public.debt_payments x WHERE x.funded_from_savings_tx_id = st.id AND x.deleted_at IS NULL)
     AND NOT EXISTS (SELECT 1 FROM public.expenses x WHERE x.funded_from_savings_tx_id = st.id AND x.deleted_at IS NULL);
  GET DIAGNOSTICS v_withdrawals = ROW_COUNT;

  -- The booking marks a fully paid non-card debt cleared with cleared_at = the payment date (0210). Reopen it only when
  -- the debt is cleared, is no longer fully paid without this payment, and its cleared_at matches that payment's date
  -- (within a day, the cast depends on the session time zone). A debt the user cleared by hand some other day is left.
  FOR r IN SELECT id, debt_id, payment_date FROM public.debt_payments WHERE id = ANY (v_pay_ids) LOOP
    SELECT * INTO v_debt FROM public.debts WHERE id = r.debt_id AND user_id = p_user_id AND deleted_at IS NULL FOR UPDATE;
    IF FOUND AND v_debt.status = 'cleared' AND v_debt.debt_type <> 'credit_card' THEN
      v_total := coalesce(v_debt.starting_balance, v_debt.amount);
      SELECT coalesce(sum(coalesce(amount_in_debt_unit, amount)), 0) INTO v_paid
        FROM public.debt_payments WHERE debt_id = r.debt_id AND deleted_at IS NULL;
      IF v_total IS NOT NULL AND v_total > 0 AND v_paid < v_total - 0.005
         AND v_debt.cleared_at IS NOT NULL AND r.payment_date IS NOT NULL
         AND abs(v_debt.cleared_at::date - r.payment_date) <= 1 THEN
        UPDATE public.debts SET status = 'active', cleared_at = NULL WHERE id = r.debt_id;
        v_reopened := v_reopened + 1;
      ELSE
        v_left_cleared := v_left_cleared + 1;
      END IF;
    END IF;
  END LOOP;

  -- 3. Refund stamps this message placed on other rows.
  UPDATE public.expenses
     SET refunded_at = NULL, refund_kind = NULL, refund_sms_log_id = NULL, refunded_amount = NULL
   WHERE user_id = p_user_id AND refund_sms_log_id = p_log_id AND sms_log_id IS DISTINCT FROM p_log_id;
  GET DIAGNOSTICS v_stamps = ROW_COUNT;

  -- 4. The pair. The sibling is the log this one points at, or the one pointing at this one.
  IF v_log.paired_log_id IS NOT NULL THEN
    SELECT * INTO v_sib FROM public.sms_parse_log WHERE id = v_log.paired_log_id AND user_id = p_user_id;
  END IF;
  IF v_sib.id IS NULL THEN
    SELECT * INTO v_sib FROM public.sms_parse_log WHERE user_id = p_user_id AND paired_log_id = p_log_id AND id <> p_log_id LIMIT 1;
  END IF;

  IF v_sib.id IS NOT NULL THEN
    -- The sibling's own row that the pairing retracted: restored only when the marker names this pair, and only when
    -- the sibling has no live row of that kind (the unique index allows one).
    SELECT e.id INTO v_restored FROM public.expenses e
     WHERE e.user_id = p_user_id AND e.sms_log_id = v_sib.id AND e.deleted_at IS NOT NULL
       AND e.retracted_by_sms_log_id IN (p_log_id, v_sib.id) AND e.description IS DISTINCT FROM 'Transfer fee'
       AND NOT EXISTS (SELECT 1 FROM public.expenses x WHERE x.sms_log_id = v_sib.id AND x.deleted_at IS NULL AND x.description IS DISTINCT FROM 'Transfer fee')
     ORDER BY e.deleted_at DESC LIMIT 1;
    IF v_restored IS NOT NULL THEN
      UPDATE public.expenses SET deleted_at = NULL, retracted_by_sms_log_id = NULL WHERE id = v_restored;
      UPDATE public.sms_parse_log SET expense_id = v_restored WHERE id = v_sib.id AND expense_id IS NULL;
      v_restored_rows := v_restored_rows + 1;
    END IF;

    v_restored := NULL;
    SELECT i.id INTO v_restored FROM public.income_events i
     WHERE i.user_id = p_user_id AND i.sms_log_id = v_sib.id AND i.deleted_at IS NOT NULL
       AND i.retracted_by_sms_log_id IN (p_log_id, v_sib.id)
       AND NOT EXISTS (SELECT 1 FROM public.income_events x WHERE x.sms_log_id = v_sib.id AND x.deleted_at IS NULL)
     ORDER BY i.deleted_at DESC LIMIT 1;
    IF v_restored IS NOT NULL THEN
      UPDATE public.income_events SET deleted_at = NULL, retracted_by_sms_log_id = NULL WHERE id = v_restored;
      UPDATE public.sms_parse_log SET income_id = v_restored WHERE id = v_sib.id AND income_id IS NULL;
      v_restored_rows := v_restored_rows + 1;
    END IF;

    -- A transfer-out the pairing retagged as Transfer goes back to what a plain transfer out gets
    -- (the same rule as mapKindToCategory and isEgyptianInstapay in createSmsExpense.ts).
    IF v_sib.kind = 'instant_transfer_out' THEN
      v_sib_body := coalesce(v_sib.raw_body, v_sib.masked_body);
      UPDATE public.expenses
         SET category = (CASE WHEN v_sib_body ~* '\mIPN\M|تحويل\s+لحظ[يى]|instapay' THEN 'Instapay' ELSE 'Remittance' END)::public.expense_category
       WHERE user_id = p_user_id AND sms_log_id = v_sib.id AND deleted_at IS NULL
         AND category = 'Transfer' AND description IS DISTINCT FROM 'Transfer fee';
      GET DIAGNOSTICS v_retagged = ROW_COUNT;
    END IF;

    IF v_sib.kind = 'cc_payoff' OR v_log.kind = 'cc_payoff' THEN
      -- The fee row was computed from the two legs together; with one gone it no longer describes anything.
      UPDATE public.expenses SET deleted_at = now()
       WHERE user_id = p_user_id AND sms_log_id = v_sib.id AND deleted_at IS NULL AND description = 'Transfer fee';
      GET DIAGNOSTICS v_fees = ROW_COUNT;
    END IF;

    -- This message was the funding leg: it had filled the repayment's funding account in. Take that back, but only
    -- where the account is still the one this message supplied.
    IF v_sib.kind = 'cc_payoff' AND v_log.payment_method_id IS NOT NULL THEN
      UPDATE public.expenses SET payment_method_id = NULL
       WHERE user_id = p_user_id AND sms_log_id = v_sib.id AND deleted_at IS NULL
         AND description IS DISTINCT FROM 'Transfer fee' AND payment_method_id = v_log.payment_method_id;
      GET DIAGNOSTICS v_backfill = ROW_COUNT;
      IF v_sib.debt_payment_id IS NOT NULL THEN
        UPDATE public.debt_payments SET payment_method_id = NULL
         WHERE id = v_sib.debt_payment_id AND user_id = p_user_id AND payment_method_id = v_log.payment_method_id;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        v_backfill := v_backfill + v_rows;
      END IF;
    END IF;

    IF v_sib.status <> 'undone' AND v_sib.parsed_ok
       AND NOT EXISTS (SELECT 1 FROM public.expenses WHERE user_id = p_user_id AND deleted_at IS NULL AND (sms_log_id = v_sib.id OR id = v_sib.expense_id))
       AND NOT EXISTS (SELECT 1 FROM public.income_events WHERE user_id = p_user_id AND deleted_at IS NULL AND (sms_log_id = v_sib.id OR id = v_sib.income_id))
       AND NOT EXISTS (SELECT 1 FROM public.debt_payments WHERE user_id = p_user_id AND deleted_at IS NULL AND (sms_log_id = v_sib.id OR id = v_sib.debt_payment_id)) THEN
      UPDATE public.sms_parse_log
         SET awaiting_confirmation = true, parsed_ok = true, status = 'logged', failure_code = 'pair_undone',
             expense_id = NULL, income_id = NULL, debt_payment_id = NULL
       WHERE id = v_sib.id;
      v_held := 1;
    ELSIF v_sib.status = 'paired' THEN
      UPDATE public.sms_parse_log SET status = 'confirmed' WHERE id = v_sib.id;
    END IF;
  END IF;

  -- Unpair both logs (and any other log still pointing here), and clear an open or settled own-transfer verdict.
  UPDATE public.sms_parse_log
     SET paired_log_id = NULL,
         own_transfer_verdict = CASE WHEN own_transfer_verdict = 'settle' THEN 'undone'
                                     WHEN own_transfer_verdict IN ('ask', 'ask_account') THEN 'none'
                                     ELSE own_transfer_verdict END,
         own_transfer_candidate = CASE WHEN own_transfer_verdict IN ('ask', 'ask_account', 'settle') THEN NULL
                                       ELSE own_transfer_candidate END
   WHERE user_id = p_user_id
     AND (id = p_log_id OR id = v_sib.id OR paired_log_id = p_log_id);

  -- 5. A subscription's pending plan change. Nothing stored ties it to a message, so it is cleared only when it
  -- matches the discarded charge exactly (the day and the amount dispatch wrote).
  UPDATE public.subscriptions s
     SET pending_plan_id = NULL, pending_amount = NULL, pending_plan_from = NULL
    FROM public.expenses e
   WHERE e.id = ANY (v_exp_ids) AND e.linked_subscription_id = s.id AND s.user_id = p_user_id
     AND s.pending_plan_from = e.expense_date AND s.pending_amount = e.amount;
  GET DIAGNOSTICS v_subs = ROW_COUNT;

  -- 6. The balance report this message wrote (the table links it by sms_parse_log_id and has no soft delete).
  DELETE FROM public.account_balance_reports WHERE sms_parse_log_id = p_log_id AND user_id = p_user_id;
  GET DIAGNOSTICS v_reports = ROW_COUNT;

  -- 7. A provisional account the discarded rows pointed at, when nothing else of the user's points at it.
  SELECT coalesce(array_agg(DISTINCT c.pm), '{}') INTO v_pm_ids FROM (
    SELECT payment_method_id AS pm FROM public.expenses WHERE id = ANY (v_exp_ids)
    UNION SELECT to_payment_method_id FROM public.expenses WHERE id = ANY (v_exp_ids)
    UNION SELECT payment_method_id FROM public.income_events WHERE id = ANY (v_inc_ids)
    UNION SELECT payment_method_id FROM public.debt_payments WHERE id = ANY (v_pay_ids)
    UNION SELECT v_log.payment_method_id
  ) c WHERE c.pm IS NOT NULL;
  FOR r IN SELECT id FROM public.payment_methods
            WHERE id = ANY (v_pm_ids) AND user_id = p_user_id AND provisional AND deleted_at IS NULL LOOP
    IF NOT EXISTS (SELECT 1 FROM public.expenses WHERE user_id = p_user_id AND deleted_at IS NULL AND (payment_method_id = r.id OR to_payment_method_id = r.id))
       AND NOT EXISTS (SELECT 1 FROM public.income_events WHERE user_id = p_user_id AND deleted_at IS NULL AND payment_method_id = r.id)
       AND NOT EXISTS (SELECT 1 FROM public.debt_payments WHERE user_id = p_user_id AND deleted_at IS NULL AND payment_method_id = r.id)
       AND NOT EXISTS (SELECT 1 FROM public.sms_parse_log WHERE user_id = p_user_id AND id <> p_log_id AND payment_method_id = r.id)
       AND NOT EXISTS (SELECT 1 FROM public.debts WHERE user_id = p_user_id AND deleted_at IS NULL AND linked_payment_method_id = r.id)
       AND NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = p_user_id AND deleted_at IS NULL AND payment_method_id = r.id) THEN
      UPDATE public.payment_methods SET deleted_at = now() WHERE id = r.id;
      v_accounts := v_accounts + 1;
    END IF;
  END LOOP;

  -- 8. The log. A log that held nothing and was waiting for nothing keeps its status: there was nothing to undo.
  v_changed := v_n_exp + v_n_inc + v_n_pay + v_withdrawals + v_stamps + v_restored_rows + v_retagged + v_fees + v_backfill + v_subs + v_reports + v_accounts;
  v_had_work := v_changed > 0 OR v_sib.id IS NOT NULL OR v_log.expense_id IS NOT NULL OR v_log.income_id IS NOT NULL
                OR v_log.debt_payment_id IS NOT NULL OR v_log.awaiting_confirmation;
  IF v_had_work THEN
    -- parsed_ok = false keeps sms_try_pair (which claims only parsed_ok rows) and the confirm claim off a discarded leg.
    UPDATE public.sms_parse_log
       SET expense_id = NULL, income_id = NULL, debt_payment_id = NULL, awaiting_confirmation = false,
           parsed_ok = false, discard_requested_at = NULL, status = 'undone'
     WHERE id = p_log_id;
  END IF;

  PERFORM set_config('sms.discarding', '', true);

  RETURN jsonb_build_object(
    'found', true,
    'nothing_to_do', NOT v_had_work,
    'sibling_id', v_sib.id,
    'expenses_deleted', v_n_exp,
    'income_deleted', v_n_inc,
    'debt_payments_deleted', v_n_pay,
    'debts_reopened', v_reopened,
    'debts_left_cleared', v_left_cleared,
    'refund_stamps_cleared', v_stamps,
    'sibling_rows_restored', v_restored_rows,
    'sibling_retagged', v_retagged,
    'fee_rows_deleted', v_fees,
    'funding_account_cleared', v_backfill,
    'subscriptions_cleared', v_subs,
    'balance_reports_deleted', v_reports,
    'accounts_removed', v_accounts,
    'savings_withdrawals_reversed', v_withdrawals,
    'sibling_held', v_held);
END $function$;

REVOKE ALL ON FUNCTION public.sms_discard_message(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sms_discard_message(uuid, uuid) TO service_role;
