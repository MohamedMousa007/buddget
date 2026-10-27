-- B1/P2b D1 server-side link: old app builds keep creating an expense and a debt_payment as two unlinked rows
-- (the double-debit in balance.ts). These triggers set expenses.linked_debt_payment_id when exactly the matching
-- pair exists: same user, expenses.linked_debt_id = debt_payments.debt_id, expense_date = payment_date, amount equal,
-- same payment_method_id. Additive: no column changes, no row rewrites; existing rows are NOT backfilled (repair
-- stays a separate, audit-first step).
--  * BEFORE INSERT on expenses (covers sync upserts: the BEFORE INSERT trigger also fires for ON CONFLICT upserts,
--    so a stale device re-pushing linked_debt_payment_id = NULL is re-linked, same expense id excluded from the claim).
--  * AFTER INSERT on debt_payments (payment arriving after its expense; sync order is not guaranteed across batches).
-- Idempotent: only acts while linked_debt_payment_id IS NULL; a payment already claimed by another live expense is
-- never claimed twice; ties pick the oldest unclaimed payment (created_at, id).
-- Amount match accepts debt_payments.amount (legacy, same-currency) OR amount_in_base / original_amount when the
-- 0197 columns exist (read through to_jsonb so this file applies before or after 0197).
--
-- AUDIT BEFORE APPLY (SELECT only; live 2026-10-27 counts in brackets):
--   -- unlinked debt-payment expenses [4 total live]; with linked_debt_id set [1]:
--   select count(*) from expenses where is_debt_payment and linked_debt_payment_id is null and deleted_at is null;
--   select count(*) from expenses where is_debt_payment and linked_debt_payment_id is null and linked_debt_id is not null and deleted_at is null;
--   -- of those, pairs this trigger WOULD link if inserted today [0 on amount equality; trigger only sees NEW rows]:
--   select e.id, p.id from expenses e join debt_payments p on p.user_id = e.user_id and p.debt_id = e.linked_debt_id
--     and p.payment_date = e.expense_date and p.deleted_at is null and p.payment_method_id is not distinct from e.payment_method_id
--     and abs(p.amount - e.amount) < 0.01
--     where e.is_debt_payment and e.linked_debt_payment_id is null and e.deleted_at is null;
--   -- ambiguity (two unlinked expenses could claim one payment; expect 0):
--   select p.id, count(*) from expenses e join debt_payments p on p.user_id = e.user_id and p.debt_id = e.linked_debt_id
--     and p.payment_date = e.expense_date and abs(p.amount - e.amount) < 0.01
--     where e.is_debt_payment and e.linked_debt_payment_id is null and e.deleted_at is null group by 1 having count(*) > 1;
-- AFTER ROLLOUT (weekly, expect to stay ~0 once old builds are gone):
--   select count(*) from expenses where is_debt_payment and linked_debt_payment_id is null and linked_debt_id is not null
--     and deleted_at is null and created_at > '<apply timestamp>';

CREATE OR REPLACE FUNCTION public.find_unclaimed_debt_payment(
  p_user uuid, p_debt uuid, p_date date, p_amount numeric, p_pm uuid, p_expense_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT p.id FROM public.debt_payments p
  WHERE p.user_id = p_user AND p.debt_id = p_debt AND p.deleted_at IS NULL
    AND p.payment_date = p_date
    AND p.payment_method_id IS NOT DISTINCT FROM p_pm
    AND (abs(p.amount - p_amount) < 0.01
         OR abs(COALESCE((to_jsonb(p) ->> 'amount_in_base')::numeric, -1) - p_amount) < 0.01
         OR abs(COALESCE((to_jsonb(p) ->> 'original_amount')::numeric, -1) - p_amount) < 0.01)
    AND NOT EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.linked_debt_payment_id = p.id AND e.deleted_at IS NULL AND e.id <> p_expense_id)
  ORDER BY p.created_at, p.id
  LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.expenses_autolink_debt_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.linked_debt_payment_id IS NULL AND NEW.is_debt_payment AND NEW.linked_debt_id IS NOT NULL
     AND NEW.deleted_at IS NULL THEN
    NEW.linked_debt_payment_id := public.find_unclaimed_debt_payment(
      NEW.user_id, NEW.linked_debt_id, NEW.expense_date, NEW.amount, NEW.payment_method_id, NEW.id);
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.debt_payments_autolink_expense()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.deleted_at IS NULL AND NOT EXISTS (
    SELECT 1 FROM public.expenses WHERE linked_debt_payment_id = NEW.id AND deleted_at IS NULL) THEN
    UPDATE public.expenses SET linked_debt_payment_id = NEW.id
    WHERE id = (
      SELECT e.id FROM public.expenses e
      WHERE e.user_id = NEW.user_id AND e.is_debt_payment AND e.linked_debt_payment_id IS NULL
        AND e.deleted_at IS NULL AND e.linked_debt_id = NEW.debt_id
        AND e.expense_date = NEW.payment_date
        AND e.payment_method_id IS NOT DISTINCT FROM NEW.payment_method_id
        AND (abs(e.amount - NEW.amount) < 0.01
             OR abs(COALESCE((to_jsonb(NEW) ->> 'amount_in_base')::numeric, -1) - e.amount) < 0.01
             OR abs(COALESCE((to_jsonb(NEW) ->> 'original_amount')::numeric, -1) - e.amount) < 0.01)
      ORDER BY e.created_at, e.id
      LIMIT 1);
  END IF;
  RETURN NULL;
END $function$;

DROP TRIGGER IF EXISTS expenses_autolink_debt_payment ON public.expenses;
CREATE TRIGGER expenses_autolink_debt_payment
  BEFORE INSERT ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.expenses_autolink_debt_payment();

DROP TRIGGER IF EXISTS debt_payments_autolink_expense ON public.debt_payments;
CREATE TRIGGER debt_payments_autolink_expense
  AFTER INSERT ON public.debt_payments
  FOR EACH ROW EXECUTE FUNCTION public.debt_payments_autolink_expense();

-- Internal only: nothing here is an API surface.
REVOKE ALL ON FUNCTION public.find_unclaimed_debt_payment(uuid, uuid, date, numeric, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expenses_autolink_debt_payment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.debt_payments_autolink_expense() FROM PUBLIC, anon, authenticated;
