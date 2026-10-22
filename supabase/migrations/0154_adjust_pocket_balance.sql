-- Accounts refactor 5/5: atomic, idempotent pocket balance change for server jobs (goal funding, month-carry).
-- Replaces read-modify-write of savings_accounts.current_balance. Service role only; one transfer_group_id applies once.
CREATE OR REPLACE FUNCTION public.adjust_pocket_balance(
  p_user uuid, p_pocket uuid, p_delta numeric, p_kind savings_transaction_kind,
  p_group uuid, p_payment_method uuid DEFAULT NULL, p_date date DEFAULT CURRENT_DATE, p_note text DEFAULT NULL
) RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE bal numeric; cur currency_code;
BEGIN
  IF p_group IS NOT NULL THEN
    SELECT balance_after INTO bal FROM savings_transactions
      WHERE user_id = p_user AND account_id = p_pocket AND transfer_group_id = p_group AND deleted_at IS NULL LIMIT 1;
    IF FOUND THEN RETURN bal; END IF;
  END IF;
  UPDATE savings_accounts SET current_balance = COALESCE(current_balance, 0) + p_delta
    WHERE id = p_pocket AND user_id = p_user AND deleted_at IS NULL
    RETURNING current_balance, currency INTO bal, cur;
  IF NOT FOUND THEN RAISE EXCEPTION 'pocket not found'; END IF;
  INSERT INTO savings_transactions (user_id, account_id, kind, amount, currency, balance_after, transaction_date, notes, transfer_group_id, payment_method_id, occurred_at, source)
    VALUES (p_user, p_pocket, p_kind, abs(p_delta), cur, bal, p_date, p_note, p_group, p_payment_method, now(), 'server');
  RETURN bal;
END $$;
REVOKE ALL ON FUNCTION public.adjust_pocket_balance(uuid, uuid, numeric, savings_transaction_kind, uuid, uuid, date, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_pocket_balance(uuid, uuid, numeric, savings_transaction_kind, uuid, uuid, date, text) TO service_role;
