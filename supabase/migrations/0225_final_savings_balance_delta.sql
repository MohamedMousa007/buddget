-- W7 option A (owner approved): savings_accounts.current_balance becomes server-derived from the savings_transactions
-- ledger DELTAS, so a stale device's absolute balance write can no longer erase a server-side movement (cron month-carry,
-- goal funding, another device). NO client change is needed: installed builds keep upserting `current_balance`; while the
-- kill switch is ON the server ignores that absolute value on UPDATE and applies the ledger rows they send instead.
--
-- KILL SWITCH: platform_settings key 'savings_balance_delta_enabled' (jsonb true / false, default false, missing = false).
-- While it is not exactly `true`, BOTH triggers are complete no-ops and every rewritten function takes its old branch
-- unchanged. This migration writes NO savings row (no backfill, no recompute): the pocket with a balance and no ledger rows
-- (live 2026-10-30: QNB 40,000 EGP; none on 2026-11-04) is left exactly as is. It does insert ONE platform_settings
-- row (value false) so the switch is visible; nothing else changes while it is false.
--
-- WHAT IT ADDS
--  * private.savings_delta_enabled()          reads the switch (security definer).
--  * private.savings_tx_signed()              signed ledger effect of one row: deposit +amount, withdraw/withdrawal -amount,
--                                             soft-deleted rows 0, 'correct' 0 (server RPCs own that absolute set).
--  * trigger trg_savings_tx_delta  (AFTER INSERT | UPDATE OF amount,kind,account_id,deleted_at | DELETE on savings_transactions)
--                                             applies (new effect - old effect) to the pocket exactly once. Unchanged retry upserts
--                                             give a 0 delta; soft delete reverses once; un-delete re-applies; hard DELETE reverses;
--                                             an account_id move reverses on the old pocket and applies on the new one.
--  * trigger a_balance_guard (BEFORE INSERT | UPDATE on savings_accounts, security INVOKER)
--                                             only for current_user authenticated/anon: UPDATE keeps OLD.current_balance, INSERT
--                                             stores 0 (see "NEW POCKET" below). postgres / service_role / SECURITY DEFINER functions
--                                             and the delta trigger (which also sets the transaction-local flag
--                                             buddget.balance_writer=1) pass through unchanged. Named a_balance_guard so it sorts
--                                             before a_suppress_noop_updates (a reverted balance then makes the row a true no-op).
--  * private.savings_balance_drift() + public.savings_balance_drift() (service_role only) reconcile report, read-only.
--
-- NEW POCKET (deliberate deviation from "INSERTs keep the client's opening balance"): every client-created pocket is inserted
-- with current_balance = B AND a separate 'deposit' opening row of +B (store.addSavingsAccount, migrateHoldings; verified
-- below: all live pockets with a balance carry ledger rows summing to it). Keeping B on INSERT would count it twice (pocket
-- carries B, then the ledger delta adds B again) and nothing distinguishes the opening row from an ordinary deposit. So with
-- the switch ON an authenticated/anon INSERT stores 0 and the ledger rows that follow in the same flush (level2 after level1)
-- build B exactly once. Server inserts (service_role/postgres: cron month-carry, goal-funding pockets) keep their value as sent.
-- Known cost: a pocket inserted with a balance and NO ledger rows (never produced by the current client) lands at 0, and a
-- pull between the pocket write and the ledger write briefly shows 0. A LOG line (pocket id only, no amount) marks each case.
--
-- WRITER INVENTORY (every writer of savings_accounts.current_balance, live pg_proc + src grep, 2026-10-30)
--  client sync.ts emitSavingsAccounts          pocket upsert: absolute current_balance (inserts, full rows) or balance-less rows
--                                              (metaOnly) -> ignored by the guard when ON.
--  client store actions (deposit, withdraw, transfer, correct/edit sheet, deleteSavingsTransaction, addSavingsAccount opening,
--                       reverse-on-income-delete, migrateHoldings)   all write BOTH the pocket balance and DELTA ledger rows
--                                              (kind deposit|withdrawal, amount>0; a correction is a delta row with is_cash_flow
--                                              false, an opening balance is a deposit row with is_cash_flow false).
--  public.adjust_pocket_balance (service_role; cron month-carry + allocateGoalFunding via lib/server/pocketLedger.ts)
--                                              balance += delta AND ledger row -> now ledger row only when ON (trigger moves it).
--  public.deposit_to_savings_v2 / withdraw_from_savings_v2 (authenticated, client never calls)  same pairing -> ledger only when ON.
--  public.deposit_to_savings / withdraw_from_savings (service_role only since 0198, auth.uid() based)  same -> ledger only when ON.
--  public.correct_savings_balance / _v2        absolute set + ledger kind 'correct' -> unchanged (the trigger ignores 'correct').
--  allocateGoalFunding / month-carry inserts   pockets with balance 0 (service_role) -> untouched.
--  No other function or trigger references the column (housekeeping only hard-deletes tombstones >90d, effect 0).
--
-- savings_transactions.kind enum (live): deposit, withdraw, correct, withdrawal.
--   deposit   +amount (client + server)                    withdrawal -amount (client + server)
--   withdraw  -amount (legacy server spelling)             correct    server-only RPC row: amount = |new-old|, balance_after = new
--                                                           absolute balance, sign not recoverable -> trigger ignores it
--   is_cash_flow only affects net-worth flow, not the balance. No live "correct" rows.
--
-- AUDIT (all SELECT, project ydihurtbcnoflhormgzi; first run 2026-10-30, re-run 2026-11-04 after the live data had been reset):
--  1) select enum_range(null::savings_transaction_kind)  -> {deposit,withdraw,correct,withdrawal}
--  2) 2026-10-30: deposit 27 (8 soft-deleted), withdrawal 5, no transfer legs, no correct rows; live pockets 31 (11 users), every live
--     pocket equals opening + live ledger net EXCEPT QNB EGP 7ff62863-5fac-4117-9bec-3cff9a217f85 (40000 vs 0, no ledger rows).
--     2026-11-04: 12 pockets, 14 ledger rows (deposit 9, withdrawal 5, none soft-deleted), 0 ledger-less pockets, 0 drift
--     (QNB no longer exists). The migration must still leave any ledger-less pocket untouched: tested with a synthetic 40000 pocket.
--  3) existing triggers: savings_accounts a_suppress_noop_updates, link_guard_savings_accounts, trg_savings_accounts_updated_at;
--     savings_transactions a_suppress_noop_updates, link_guard_savings_transactions, trg_savings_transactions_updated_at.
--  4) rows written by this migration: 0 savings rows, 1 platform_settings row (insert, value false, on conflict do nothing).
--  5) after applying and BEFORE enabling, run: select * from public.savings_balance_drift();  (service_role) and review it.
--
-- ENABLE (after the migration, and after reviewing the drift report):
--   update platform_settings set value = 'true'::jsonb, updated_at = now() where key = 'savings_balance_delta_enabled';
-- ROLLBACK: update ... set value = 'false'::jsonb (instant, restores today's behaviour). Full removal:
--   drop trigger a_balance_guard on public.savings_accounts; drop trigger trg_savings_tx_delta on public.savings_transactions;
--   drop function private.guard_savings_balance(), private.apply_savings_tx_delta(), private.savings_tx_signed(...),
--   private.savings_delta_enabled(), public.savings_balance_drift(), private.savings_balance_drift();
--   then re-run the adjust_pocket_balance body from 0198_savings_rpc_v2.sql, the three _v2 bodies from 0198, and the two old
--   deposit_to_savings / withdraw_from_savings bodies (their UPDATE ran unconditionally).
-- Caveats: a pocket soft-deleted BEFORE enabling keeps its old balance while its ledger rows are tombstoned, so un-deleting
-- both afterwards would apply the rows on top of that balance (the client only undoes within seconds; deletes made after
-- enabling reverse row by row and round-trip cleanly). Concurrent transfers in opposite directions can deadlock on the two
-- pocket rows; PostgreSQL aborts one, the client retries.

-- ---------------------------------------------------------------- kill switch
INSERT INTO public.platform_settings (key, value)
VALUES ('savings_balance_delta_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION private.savings_delta_enabled()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE((SELECT value = 'true'::jsonb FROM public.platform_settings WHERE key = 'savings_balance_delta_enabled'), false)
$function$;

CREATE OR REPLACE FUNCTION private.savings_tx_signed(p_kind public.savings_transaction_kind, p_amount numeric, p_deleted_at timestamptz)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT CASE
    WHEN p_deleted_at IS NOT NULL THEN 0
    WHEN p_kind = 'deposit' THEN p_amount
    WHEN p_kind IN ('withdraw', 'withdrawal') THEN -p_amount
    ELSE 0
  END
$function$;

-- ---------------------------------------------------------------- delta trigger (ledger -> balance)
CREATE OR REPLACE FUNCTION private.apply_savings_tx_delta()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  d_old numeric := 0;
  d_new numeric := 0;
  prev text;

  -- local helper: move one pocket by p_delta with the writer flag set, so the guard lets it through
BEGIN
  IF NOT private.savings_delta_enabled() THEN RETURN NULL; END IF;
  -- 'correct' rows belong to the server RPCs (absolute set); any transition touching one is not a delta.
  IF TG_OP = 'UPDATE' AND (OLD.kind = 'correct' OR NEW.kind = 'correct') THEN RETURN NULL; END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN d_old := private.savings_tx_signed(OLD.kind, OLD.amount, OLD.deleted_at); END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN d_new := private.savings_tx_signed(NEW.kind, NEW.amount, NEW.deleted_at); END IF;

  prev := COALESCE(current_setting('buddget.balance_writer', true), '');
  PERFORM set_config('buddget.balance_writer', '1', true);

  IF TG_OP = 'UPDATE' AND OLD.account_id = NEW.account_id THEN
    IF d_new - d_old <> 0 THEN
      UPDATE public.savings_accounts SET current_balance = current_balance + (d_new - d_old)
        WHERE id = NEW.account_id AND user_id = NEW.user_id;
    END IF;
  ELSE
    IF d_old <> 0 THEN
      UPDATE public.savings_accounts SET current_balance = current_balance - d_old
        WHERE id = OLD.account_id AND user_id = OLD.user_id;
    END IF;
    IF d_new <> 0 THEN
      UPDATE public.savings_accounts SET current_balance = current_balance + d_new
        WHERE id = NEW.account_id AND user_id = NEW.user_id;
    END IF;
  END IF;

  PERFORM set_config('buddget.balance_writer', prev, true);
  RETURN NULL;
END $function$;

DROP TRIGGER IF EXISTS trg_savings_tx_delta ON public.savings_transactions;
CREATE TRIGGER trg_savings_tx_delta
  AFTER INSERT OR DELETE OR UPDATE OF amount, kind, account_id, deleted_at ON public.savings_transactions
  FOR EACH ROW EXECUTE FUNCTION private.apply_savings_tx_delta();

-- ---------------------------------------------------------------- guard trigger (ignore client absolute balance)
CREATE OR REPLACE FUNCTION private.guard_savings_balance()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Only ordinary client roles are guarded. postgres, service_role and SECURITY DEFINER functions (current_user = owner) pass.
  IF current_user NOT IN ('authenticated', 'anon') THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.current_balance IS NOT DISTINCT FROM OLD.current_balance THEN RETURN NEW; END IF;
    IF COALESCE(current_setting('buddget.balance_writer', true), '') = '1' THEN RETURN NEW; END IF;
    IF private.savings_delta_enabled() THEN NEW.current_balance := OLD.current_balance; END IF;
  ELSIF NEW.current_balance <> 0 AND private.savings_delta_enabled() THEN
    -- The ledger rows that follow build the balance; the proposed value is dropped (see header, NEW POCKET).
    IF NOT EXISTS (SELECT 1 FROM public.savings_accounts WHERE id = NEW.id) THEN
      RAISE LOG 'savings_balance_delta: opening balance of new pocket % left to the ledger', NEW.id;
    END IF;
    NEW.current_balance := 0;
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS a_balance_guard ON public.savings_accounts;
CREATE TRIGGER a_balance_guard
  BEFORE INSERT OR UPDATE ON public.savings_accounts
  FOR EACH ROW EXECUTE FUNCTION private.guard_savings_balance();

-- ---------------------------------------------------------------- reconcile report (read-only)
CREATE OR REPLACE FUNCTION private.savings_balance_drift()
 RETURNS TABLE (id uuid, current_balance numeric, ledger_expected numeric)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT a.id, a.current_balance, a.opening_balance + COALESCE(l.net, 0)
  FROM public.savings_accounts a
  LEFT JOIN LATERAL (
    SELECT sum(private.savings_tx_signed(t.kind, t.amount, t.deleted_at)) AS net
    FROM public.savings_transactions t WHERE t.account_id = a.id
  ) l ON true
  WHERE a.deleted_at IS NULL
    AND abs(a.current_balance - (a.opening_balance + COALESCE(l.net, 0))) > 0.00005
$function$;

CREATE OR REPLACE FUNCTION public.savings_balance_drift()
 RETURNS TABLE (id uuid, current_balance numeric, ledger_expected numeric)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT * FROM private.savings_balance_drift()
$function$;

-- ---------------------------------------------------------------- adjust_pocket_balance (same signature, same return)
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
  IF private.savings_delta_enabled() AND p_kind IN ('deposit', 'withdraw', 'withdrawal') THEN
    -- Delta mode: this function only writes the ledger row; trg_savings_tx_delta moves the balance (exactly once).
    IF (p_kind = 'deposit') <> (p_delta > 0) THEN RAISE EXCEPTION 'delta sign does not match kind %', p_kind; END IF;
    SELECT current_balance, currency INTO bal, cur FROM savings_accounts
      WHERE id = p_pocket AND user_id = p_user AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'pocket not found'; END IF;
    bal := COALESCE(bal, 0) + p_delta;
    INSERT INTO savings_transactions (user_id, account_id, kind, amount, currency, balance_after, transaction_date, notes, transfer_group_id, payment_method_id, occurred_at, source)
      VALUES (p_user, p_pocket, p_kind, abs(p_delta), cur, bal, p_date, p_note, p_group, p_payment_method, now(), p_source);
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

-- ---------------------------------------------------------------- deposit_to_savings_v2 (own UPDATE only when the switch is off)
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

  -- Delta mode: the insert above already moved the balance through trg_savings_tx_delta.
  IF NOT private.savings_delta_enabled() THEN
    UPDATE public.savings_accounts SET current_balance = v_new WHERE id = p_account_id;
  END IF;
  RETURN p_transaction_id;
END $function$;

-- ---------------------------------------------------------------- withdraw_from_savings_v2
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

  IF NOT private.savings_delta_enabled() THEN
    UPDATE public.savings_accounts SET current_balance = v_new WHERE id = p_account_id;
  END IF;
  RETURN p_transaction_id;
END $function$;

-- ---------------------------------------------------------------- old deposit/withdraw (service_role only, auth.uid() based)
CREATE OR REPLACE FUNCTION public.deposit_to_savings(p_account_id uuid, p_amount numeric, p_currency currency_code, p_notes text DEFAULT NULL::text, p_date date DEFAULT CURRENT_DATE, p_transaction_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_tx_id uuid := COALESCE(p_transaction_id, gen_random_uuid());
  v_acc public.savings_accounts;
BEGIN
  SELECT * INTO v_acc FROM public.savings_accounts WHERE id = p_account_id;
  IF v_acc IS NULL OR v_acc.user_id <> v_user THEN
    RAISE EXCEPTION 'Savings account not found or not owned by caller';
  END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Deposit amount must be positive'; END IF;

  INSERT INTO public.savings_transactions (id, user_id, account_id, kind, amount, currency, transaction_date, notes)
  VALUES (v_tx_id, v_user, p_account_id, 'deposit', p_amount, p_currency, p_date, p_notes);

  IF NOT private.savings_delta_enabled() THEN
    UPDATE public.savings_accounts
    SET current_balance = current_balance + p_amount
    WHERE id = p_account_id;
  END IF;
  RETURN v_tx_id;
END $function$;

CREATE OR REPLACE FUNCTION public.withdraw_from_savings(p_account_id uuid, p_amount numeric, p_currency currency_code, p_notes text DEFAULT NULL::text, p_date date DEFAULT CURRENT_DATE, p_transaction_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_tx_id uuid := COALESCE(p_transaction_id, gen_random_uuid());
  v_acc public.savings_accounts;
BEGIN
  SELECT * INTO v_acc FROM public.savings_accounts WHERE id = p_account_id;
  IF v_acc IS NULL OR v_acc.user_id <> v_user THEN
    RAISE EXCEPTION 'Savings account not found or not owned by caller';
  END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Withdraw amount must be positive'; END IF;

  INSERT INTO public.savings_transactions (id, user_id, account_id, kind, amount, currency, transaction_date, notes)
  VALUES (v_tx_id, v_user, p_account_id, 'withdrawal', p_amount, p_currency, p_date, p_notes);

  IF NOT private.savings_delta_enabled() THEN
    UPDATE public.savings_accounts
    SET current_balance = current_balance - p_amount
    WHERE id = p_account_id;
  END IF;
  RETURN v_tx_id;
END $function$;

-- ---------------------------------------------------------------- grants
REVOKE ALL ON FUNCTION private.savings_delta_enabled() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.savings_delta_enabled() TO authenticated, service_role; -- the guard trigger runs as the client role
REVOKE ALL ON FUNCTION private.savings_tx_signed(public.savings_transaction_kind, numeric, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.savings_tx_signed(public.savings_transaction_kind, numeric, timestamptz) TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.apply_savings_tx_delta() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.guard_savings_balance() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.savings_balance_drift() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.savings_balance_drift() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.savings_balance_drift() TO service_role;
-- adjust_pocket_balance, the _v2 functions and the old deposit/withdraw keep their ACL (CREATE OR REPLACE preserves it).
