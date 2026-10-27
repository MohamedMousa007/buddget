-- B1/P2b Q6 + W8 + W9: savings RPC hardening. New deposit/withdraw/correct *_v2 functions carry the safe behaviour
-- (ownership, currency equality, deleted-pocket and overdraft checks, balance_after, idempotency). The three OLD
-- deposit_to_savings / withdraw_from_savings / correct_savings_balance functions are CLOSED to API roles at the end
-- of this file (REVOKE EXECUTE from PUBLIC/anon/authenticated; service_role keeps it). Caller audit (review F6): the
-- only references are the dead wrappers in src/lib/supabase/remote/rpc.ts (zero importers), the generated
-- database.types.ts and Buddgy tool names of the same spelling (client-side store actions, not RPCs). No supabase
-- function, cron route, script or doc calls them, so the unhardened path is shut instead of patched.
-- adjust_pocket_balance keeps its signature (service_role only) and changes behaviour on apply, see
-- "adjust_pocket_balance behaviour change" below. The client does NOT call the v2 functions yet.
--
-- adjust_pocket_balance behaviour change on apply (live cron month-carry and goal funding call it), each with a guard:
--  (a) a tombstoned (deleted) row with the same (pocket, group) now counts as "already posted": a carry the user
--      deleted is never re-posted and the caller sees the stored balance. Guard: allocateGoalFunding.test.ts
--      "a tombstoned carry row counts as posted".
--  (b) p_delta = 0 no longer inserts a zero-amount ledger row; it returns the current balance (or raises if the pocket
--      is missing/deleted). Guard: allocateGoalFunding.test.ts "records a missed cycle" (client never sends a zero delta; asserts no ledger row).
--  (c) a p_payment_method not owned by p_user now raises 'payment method not owned'. Guard: allocateGoalFunding.test.ts
--      "a payment method the server rejects releases the claim".
--  (d) concurrent same-key calls serialise on an advisory lock; the unique index below is the backstop.
--
-- AUDIT BEFORE APPLY (run on project ydihurtbcnoflhormgzi, all SELECT):
--  1) Rows the W9 unique index would reject. Live 2026-10-27: 0 / 0.
--     select account_id, transfer_group_id, count(*) from savings_transactions
--       where transfer_group_id is not null and deleted_at is null group by 1,2 having count(*) > 1;
--  2) Tombstones the idempotent lookup will honour (informational, "stay deleted" semantics):
--     select count(*) from savings_transactions where transfer_group_id is not null and deleted_at is not null;
--  3) Rows migration touches: this file rewrites 1 function body (adjust_pocket_balance), adds 1 index, adds 3
--     functions. It updates ZERO table rows. Expected: no change in `select count(*) from savings_transactions`.
--  4) Confirm old signatures untouched afterwards (expect 3 old + 3 new rows, no PGRST203 overload clash because the
--     v2 names differ):
--     select proname, pg_get_function_identity_arguments(oid) from pg_proc
--       where pronamespace = 'public'::regnamespace and proname ~ '^(deposit_to_savings|withdraw_from_savings|correct_savings_balance)';
--
-- Rule decisions (v2): currency must EQUAL the pocket currency (no silent conversion; client sends the
-- pocket-currency amount); p_local_date is REQUIRED (client local date, no UTC default); p_transaction_id is REQUIRED
-- (idempotency key = savings_transactions.id PK); replay returns the existing id and changes nothing, tombstoned
-- rows included (a deleted transaction is not resurrected by a retry).

-- ---------------------------------------------------------------- W9 index
-- Live rows only, so a soft-deleted move never blocks the pair; the tombstone check lives in adjust_pocket_balance.
create unique index if not exists uq_savings_tx_live_group
  on public.savings_transactions (user_id, account_id, transfer_group_id)
  where transfer_group_id is not null and deleted_at is null;

-- ---------------------------------------------------------------- W9 adjust_pocket_balance (same signature)
CREATE OR REPLACE FUNCTION public.adjust_pocket_balance(p_user uuid, p_pocket uuid, p_delta numeric, p_kind savings_transaction_kind, p_group uuid, p_payment_method uuid DEFAULT NULL::uuid, p_date date DEFAULT CURRENT_DATE, p_note text DEFAULT NULL::text, p_source text DEFAULT 'server'::text)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE bal numeric; cur currency_code;
BEGIN
  IF p_group IS NOT NULL THEN
    -- Serialise concurrent runs of the same (pocket, group) key; the unique index is the backstop.
    PERFORM pg_advisory_xact_lock(hashtextextended(p_pocket::text || ':' || p_group::text, 0));
    -- Tombstones count: a move the user deleted is not re-posted by a cron retry.
    SELECT balance_after INTO bal FROM savings_transactions
      WHERE user_id = p_user AND account_id = p_pocket AND transfer_group_id = p_group
      ORDER BY (deleted_at IS NOT NULL), created_at LIMIT 1;
    IF FOUND THEN RETURN bal; END IF;
  END IF;
  IF p_payment_method IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM payment_methods WHERE id = p_payment_method AND user_id = p_user
  ) THEN RAISE EXCEPTION 'payment method not owned'; END IF;
  IF p_delta = 0 THEN
    SELECT current_balance INTO bal FROM savings_accounts WHERE id = p_pocket AND user_id = p_user AND deleted_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'pocket not found'; END IF;
    RETURN bal;
  END IF;
  UPDATE savings_accounts SET current_balance = COALESCE(current_balance, 0) + p_delta
    WHERE id = p_pocket AND user_id = p_user AND deleted_at IS NULL
    RETURNING current_balance, currency INTO bal, cur;
  IF NOT FOUND THEN RAISE EXCEPTION 'pocket not found'; END IF;
  INSERT INTO savings_transactions (user_id, account_id, kind, amount, currency, balance_after, transaction_date, notes, transfer_group_id, payment_method_id, occurred_at, source)
    VALUES (p_user, p_pocket, p_kind, abs(p_delta), cur, bal, p_date, p_note, p_group, p_payment_method, now(), p_source);
  RETURN bal;
END $function$;

-- ---------------------------------------------------------------- Q6/W8 deposit_to_savings_v2
CREATE OR REPLACE FUNCTION public.deposit_to_savings_v2(
  p_account_id uuid, p_amount numeric, p_currency public.currency_code, p_local_date date,
  p_transaction_id uuid, p_notes text DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_acc public.savings_accounts;
  v_ex public.savings_transactions;
  v_new numeric;
  v_rows int;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Deposit amount must be positive'; END IF;
  IF p_local_date IS NULL OR p_transaction_id IS NULL THEN RAISE EXCEPTION 'local date and transaction id are required'; END IF;

  SELECT * INTO v_acc FROM public.savings_accounts
    WHERE id = p_account_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Savings account not found or not owned by caller'; END IF;

  SELECT * INTO v_ex FROM public.savings_transactions WHERE id = p_transaction_id;
  IF FOUND THEN
    IF v_ex.user_id <> v_user OR v_ex.account_id <> p_account_id OR v_ex.kind <> 'deposit' THEN
      RAISE EXCEPTION 'transaction id already used';
    END IF;
    RETURN v_ex.id;
  END IF;

  IF v_acc.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Savings account is deleted'; END IF;
  IF p_currency IS DISTINCT FROM v_acc.currency THEN RAISE EXCEPTION 'currency mismatch: pocket is %', v_acc.currency; END IF;

  v_new := COALESCE(v_acc.current_balance, 0) + p_amount;
  INSERT INTO public.savings_transactions (id, user_id, account_id, kind, amount, currency, transaction_date, balance_after, notes, occurred_at)
  VALUES (p_transaction_id, v_user, p_account_id, 'deposit', p_amount, v_acc.currency, p_local_date, v_new, p_notes, now())
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RAISE EXCEPTION 'transaction id already used'; END IF;

  UPDATE public.savings_accounts SET current_balance = v_new WHERE id = p_account_id;
  RETURN p_transaction_id;
END $function$;

-- ---------------------------------------------------------------- Q6/W8 withdraw_from_savings_v2
CREATE OR REPLACE FUNCTION public.withdraw_from_savings_v2(
  p_account_id uuid, p_amount numeric, p_currency public.currency_code, p_local_date date,
  p_transaction_id uuid, p_notes text DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_acc public.savings_accounts;
  v_ex public.savings_transactions;
  v_new numeric;
  v_rows int;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Withdraw amount must be positive'; END IF;
  IF p_local_date IS NULL OR p_transaction_id IS NULL THEN RAISE EXCEPTION 'local date and transaction id are required'; END IF;

  SELECT * INTO v_acc FROM public.savings_accounts
    WHERE id = p_account_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Savings account not found or not owned by caller'; END IF;

  SELECT * INTO v_ex FROM public.savings_transactions WHERE id = p_transaction_id;
  IF FOUND THEN
    IF v_ex.user_id <> v_user OR v_ex.account_id <> p_account_id OR v_ex.kind <> 'withdrawal' THEN
      RAISE EXCEPTION 'transaction id already used';
    END IF;
    RETURN v_ex.id;
  END IF;

  IF v_acc.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Savings account is deleted'; END IF;
  IF p_currency IS DISTINCT FROM v_acc.currency THEN RAISE EXCEPTION 'currency mismatch: pocket is %', v_acc.currency; END IF;

  v_new := COALESCE(v_acc.current_balance, 0) - p_amount;
  IF v_new < 0 THEN RAISE EXCEPTION 'insufficient balance'; END IF;

  INSERT INTO public.savings_transactions (id, user_id, account_id, kind, amount, currency, transaction_date, balance_after, notes, occurred_at)
  VALUES (p_transaction_id, v_user, p_account_id, 'withdrawal', p_amount, v_acc.currency, p_local_date, v_new, p_notes, now())
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RAISE EXCEPTION 'transaction id already used'; END IF;

  UPDATE public.savings_accounts SET current_balance = v_new WHERE id = p_account_id;
  RETURN p_transaction_id;
END $function$;

-- ---------------------------------------------------------------- Q6 correct_savings_balance_v2
CREATE OR REPLACE FUNCTION public.correct_savings_balance_v2(
  p_account_id uuid, p_new_balance numeric, p_local_date date,
  p_transaction_id uuid, p_notes text DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_acc public.savings_accounts;
  v_ex public.savings_transactions;
  v_rows int;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_new_balance IS NULL OR p_new_balance < 0 THEN RAISE EXCEPTION 'balance must be zero or positive'; END IF;
  IF p_local_date IS NULL OR p_transaction_id IS NULL THEN RAISE EXCEPTION 'local date and transaction id are required'; END IF;

  SELECT * INTO v_acc FROM public.savings_accounts
    WHERE id = p_account_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Savings account not found or not owned by caller'; END IF;

  SELECT * INTO v_ex FROM public.savings_transactions WHERE id = p_transaction_id;
  IF FOUND THEN
    IF v_ex.user_id <> v_user OR v_ex.account_id <> p_account_id OR v_ex.kind <> 'correct' THEN
      RAISE EXCEPTION 'transaction id already used';
    END IF;
    RETURN v_ex.id;
  END IF;

  IF v_acc.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Savings account is deleted'; END IF;

  INSERT INTO public.savings_transactions (id, user_id, account_id, kind, amount, currency, transaction_date, balance_after, notes, occurred_at)
  VALUES (p_transaction_id, v_user, p_account_id, 'correct', ABS(p_new_balance - COALESCE(v_acc.current_balance, 0)), v_acc.currency, p_local_date, p_new_balance, p_notes, now())
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RAISE EXCEPTION 'transaction id already used'; END IF;

  UPDATE public.savings_accounts SET current_balance = p_new_balance WHERE id = p_account_id;
  RETURN p_transaction_id;
END $function$;

-- ---------------------------------------------------------------- grants (new functions: authenticated only)
REVOKE ALL ON FUNCTION public.deposit_to_savings_v2(uuid, numeric, public.currency_code, date, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.withdraw_from_savings_v2(uuid, numeric, public.currency_code, date, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.correct_savings_balance_v2(uuid, numeric, date, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deposit_to_savings_v2(uuid, numeric, public.currency_code, date, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_from_savings_v2(uuid, numeric, public.currency_code, date, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.correct_savings_balance_v2(uuid, numeric, date, uuid, text) TO authenticated;
-- adjust_pocket_balance ACL is unchanged by CREATE OR REPLACE (live: postgres + service_role only).

-- ---------------------------------------------------------------- Q6 close the old unhardened RPCs
REVOKE ALL ON FUNCTION public.deposit_to_savings(uuid, numeric, public.currency_code, text, date, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.withdraw_from_savings(uuid, numeric, public.currency_code, text, date, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.correct_savings_balance(uuid, numeric, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deposit_to_savings(uuid, numeric, public.currency_code, text, date, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.withdraw_from_savings(uuid, numeric, public.currency_code, text, date, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.correct_savings_balance(uuid, numeric, text, uuid) TO service_role;
