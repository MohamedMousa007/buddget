-- S2c step 7 (invariants I4, I1; review finding P1-6): one reverse operation for "forget this message".
--
-- Two operations exist. unpair(log) means "this is not an own transfer": both legs come back as their plain rows and
-- the link is cleared; it lives in src/lib/sms/reverse.ts (unpairOwnTransfer). discard(log) means "forget this
-- message": everything the message wrote goes, and its sibling goes back to being an independent message with its own
-- plain row. discard is this function, in SQL, so its two callers (the /api/sms/undo route and the trigger below that
-- catches the app deleting a row) run the same code and cannot drift. A row delete made in the app, possibly offline,
-- reaches the server as a plain synced UPDATE of deleted_at, so only the database can see it.
--
-- Restores follow I4: only a row whose retracted_by_sms_log_id names this message or its sibling is brought back, and
-- the marker is cleared with deleted_at. A row deleted with no marker was deleted by the user and stays deleted.
-- Discarding the user's own rows sets deleted_at WITHOUT a marker: it is the user's decision, not a pairing's.
--
-- Two callers, two timings. The route discards at once. The app's own row delete does NOT: the app shows an Undo toast
-- for about 8 seconds and a delete syncs within a second or two, so discarding straight away would restore the
-- sibling and unlink the pair, and a tap on Undo would then revive the row and leave the Transfer row AND the restored
-- income standing. Instead the delete trigger only stamps sms_parse_log.discard_requested_at; a revive clears it; and
-- the pg_cron job sms_run_pending_discards (every minute) discards a message 30 seconds after the request, only when
-- none of its rows is live any more.
--
-- Recursion guard. The trigger fires for a soft delete that carries no marker. This function soft-deletes rows the
-- same way, so two guards keep it from re-entering itself: pg_trigger_depth() > 1 covers the case where the trigger
-- called this function, and a transaction-local setting (sms.discarding) covers a direct call from the route, where
-- the function's own deletes fire the trigger at depth 1. The pipeline's retractions set deleted_at and the marker in
-- one UPDATE, which the trigger's WHEN clause never matches.
--
-- Every write below leaves edited_at alone, so each passes the stale-write trigger as a server write (0269) and
-- reaches other devices as an ordinary delta.
--
-- It takes the same per-user advisory lock as sms_try_pair, so a discard cannot interleave with a claim.
-- Idempotent: a second call finds nothing left and returns the same shape with nothing_to_do = true.
--
-- sms_parse_log.status gains 'undone'. The live check (0074) does not allow it.
--
-- ROLLBACK
--   drop trigger if exists sms_discard_on_expense_delete on public.expenses;
--   drop trigger if exists sms_discard_on_income_delete on public.income_events;
--   drop trigger if exists sms_discard_on_expense_revive on public.expenses;
--   drop trigger if exists sms_discard_on_income_revive on public.income_events;
--   select cron.unschedule('sms-pending-discards');
--   drop function if exists public.sms_run_pending_discards();
--   drop function if exists private.sms_discard_on_row_revive();
--   drop function if exists private.sms_discard_on_row_delete();
--   drop function if exists public.sms_discard_message(uuid, uuid);
--   (and re-add the old status check without 'undone' once no row carries it)

BEGIN;

ALTER TABLE public.sms_parse_log ADD COLUMN IF NOT EXISTS discard_requested_at timestamptz;
COMMENT ON COLUMN public.sms_parse_log.discard_requested_at IS
  'Set when the app deletes a row this message created; a scheduled job discards the message once the Undo window has passed and the row is still deleted.';
CREATE INDEX IF NOT EXISTS sms_parse_log_discard_requested_idx
  ON public.sms_parse_log (discard_requested_at) WHERE discard_requested_at IS NOT NULL;

ALTER TABLE public.sms_parse_log DROP CONSTRAINT IF EXISTS sms_parse_log_status_check;
ALTER TABLE public.sms_parse_log ADD CONSTRAINT sms_parse_log_status_check
  CHECK (status = ANY (ARRAY[
    'processing', 'rejected', 'failed', 'logged', 'notified',
    'rendered', 'confirmed', 'add_failed', 'tapped', 'paired', 'undone'
  ]));

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
  v_subs int := 0; v_reports int := 0; v_accounts int := 0;
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
     SET refunded_at = NULL, refund_kind = NULL, refund_sms_log_id = NULL
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

    IF v_sib.status = 'paired' THEN
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
  v_changed := v_n_exp + v_n_inc + v_n_pay + v_stamps + v_restored_rows + v_retagged + v_fees + v_backfill + v_subs + v_reports + v_accounts;
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
    'accounts_removed', v_accounts);
END $function$;

REVOKE ALL ON FUNCTION public.sms_discard_message(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sms_discard_message(uuid, uuid) TO service_role;

-- The app's row delete: an UPDATE of deleted_at on a row a message created, with no marker. It only records the request.
-- Skipped rows: a "Transfer fee" row (a part of a pair, not a message's own row), and the refund placeholder. The
-- flag-action refund_match route stamps the chosen purchase with the placeholder's message id and then soft-deletes the
-- placeholder with no marker; discarding there would clear the stamp it has just placed (step 3).
-- Field references stay inside the table-name branches because the function is shared by two tables.
CREATE OR REPLACE FUNCTION private.sms_discard_on_row_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF pg_trigger_depth() > 1 OR coalesce(current_setting('sms.discarding', true), '') = '1' THEN
    RETURN NULL;
  END IF;
  IF tg_table_name = 'expenses' THEN
    IF new.description IS NOT DISTINCT FROM 'Transfer fee' THEN
      RETURN NULL;
    END IF;
    IF new.refund_kind IS NOT DISTINCT FROM 'refunded' AND coalesce('refund_unmatched' = ANY (new.sms_flags), false) THEN
      RETURN NULL;
    END IF;
  END IF;
  UPDATE public.sms_parse_log SET discard_requested_at = now()
   WHERE id = new.sms_log_id AND user_id = new.user_id AND status IS DISTINCT FROM 'undone';
  RETURN NULL;
END $function$;

-- A revive (the app's Undo toast) withdraws the request.
CREATE OR REPLACE FUNCTION private.sms_discard_on_row_revive()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF coalesce(current_setting('sms.discarding', true), '') = '1' THEN
    RETURN NULL;
  END IF;
  UPDATE public.sms_parse_log SET discard_requested_at = NULL
   WHERE id = new.sms_log_id AND user_id = new.user_id AND discard_requested_at IS NOT NULL;
  RETURN NULL;
END $function$;

REVOKE ALL ON FUNCTION private.sms_discard_on_row_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.sms_discard_on_row_revive() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sms_discard_on_expense_delete ON public.expenses;
CREATE TRIGGER sms_discard_on_expense_delete
  AFTER UPDATE OF deleted_at ON public.expenses
  FOR EACH ROW
  WHEN (old.deleted_at IS NULL AND new.deleted_at IS NOT NULL AND new.sms_log_id IS NOT NULL AND new.retracted_by_sms_log_id IS NULL)
  EXECUTE FUNCTION private.sms_discard_on_row_delete();

DROP TRIGGER IF EXISTS sms_discard_on_income_delete ON public.income_events;
CREATE TRIGGER sms_discard_on_income_delete
  AFTER UPDATE OF deleted_at ON public.income_events
  FOR EACH ROW
  WHEN (old.deleted_at IS NULL AND new.deleted_at IS NOT NULL AND new.sms_log_id IS NOT NULL AND new.retracted_by_sms_log_id IS NULL)
  EXECUTE FUNCTION private.sms_discard_on_row_delete();

DROP TRIGGER IF EXISTS sms_discard_on_expense_revive ON public.expenses;
CREATE TRIGGER sms_discard_on_expense_revive
  AFTER UPDATE OF deleted_at ON public.expenses
  FOR EACH ROW
  WHEN (old.deleted_at IS NOT NULL AND new.deleted_at IS NULL AND new.sms_log_id IS NOT NULL)
  EXECUTE FUNCTION private.sms_discard_on_row_revive();

DROP TRIGGER IF EXISTS sms_discard_on_income_revive ON public.income_events;
CREATE TRIGGER sms_discard_on_income_revive
  AFTER UPDATE OF deleted_at ON public.income_events
  FOR EACH ROW
  WHEN (old.deleted_at IS NOT NULL AND new.deleted_at IS NULL AND new.sms_log_id IS NOT NULL)
  EXECUTE FUNCTION private.sms_discard_on_row_revive();

-- Discards the messages whose row the app deleted and which stayed deleted past the Undo window. A message that still
-- has a live row (the user revived it, or re-created it) is left alone. One failing message does not stop the batch.
CREATE OR REPLACE FUNCTION public.sms_run_pending_discards()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  r record;
  v_done int := 0;
BEGIN
  FOR r IN SELECT id, user_id FROM public.sms_parse_log
            WHERE discard_requested_at IS NOT NULL AND discard_requested_at <= now() - interval '30 seconds'
            ORDER BY discard_requested_at LIMIT 200 FOR UPDATE SKIP LOCKED LOOP
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM public.expenses WHERE sms_log_id = r.id AND deleted_at IS NULL AND description IS DISTINCT FROM 'Transfer fee')
         AND NOT EXISTS (SELECT 1 FROM public.income_events WHERE sms_log_id = r.id AND deleted_at IS NULL) THEN
        PERFORM public.sms_discard_message(r.user_id, r.id);
        v_done := v_done + 1;
      END IF;
      UPDATE public.sms_parse_log SET discard_requested_at = NULL WHERE id = r.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'sms_run_pending_discards: log % failed: %', r.id, SQLERRM;
      UPDATE public.sms_parse_log SET discard_requested_at = NULL WHERE id = r.id;
    END;
  END LOOP;
  RETURN v_done;
END $function$;

REVOKE ALL ON FUNCTION public.sms_run_pending_discards() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sms_run_pending_discards() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('sms-pending-discards', '* * * * *', 'SELECT public.sms_run_pending_discards()');
  END IF;
END $$;

COMMIT;
