-- 0218 B10c (Q13, D22): drop dead DB objects. NOT YET APPLIED.
--
-- Audit (live, project ydihurtbcnoflhormgzi, read-only, 2026-10-29):
--   public.ai_tmp_probe()                      exists; zero callers in src/, supabase/, cron.job, other function bodies.
--   public.fx_rates                            0 rows, 0 policies, 0 FKs, 0 dependent views; zero references in src/.
--   public.live_market_data                    3 rows -> KEPT (rule: drop only at 0 rows). Revisit separately.
--   RPCs add_debt_payment_with_expense, add_income_with_debt, add_subscription_with_recurring_expense,
--        cancel_subscription, reactivate_subscription, update_subscription_and_re:
--        only caller was src/lib/supabase/remote/rpc.ts (deleted in this package, itself imported only by its
--        own test); zero callers in src/, supabase/functions, scripts, cron.job, or other function bodies.
--   Enum leftovers (savings_transaction_kind 'withdraw', savings_type 'bond'): 0 rows use them, but the
--        mappers still read both values and Postgres cannot drop enum values in place -> KEPT.
--   Kept (live callers via Buddgy tool names are unrelated): deposit_to_savings, withdraw_from_savings,
--        correct_savings_balance stay; they are not in the D22 dead list.
--
-- Deploy order: restrictive. Apply AFTER the code removing rpc.ts is deployed. Old native builds never
-- called these RPCs (no client caller exists in any shipped bundle of this repo).
--
-- Rollback: functions cannot be recreated from this file. Before applying, save their definitions:
--   select pg_get_functiondef(oid) from pg_proc where pronamespace='public'::regnamespace
--     and proname in ('ai_tmp_probe','add_debt_payment_with_expense','add_income_with_debt',
--       'add_subscription_with_recurring_expense','cancel_subscription','reactivate_subscription',
--       'update_subscription_and_re');
-- and re-run them. fx_rates is empty; rollback = the create table in 0169_ai_cost_capture.sql
-- (plus its enable RLS and the select grant from 0176/0201).

do $$
begin
  if (select count(*) from public.fx_rates) <> 0 then
    raise exception 'fx_rates is not empty; refusing to drop';
  end if;
end $$;

drop function if exists public.ai_tmp_probe();
-- kept for installed native builds that may still call it: drop function if exists public.add_debt_payment_with_expense(jsonb, jsonb);
-- kept for installed native builds that may still call it: drop function if exists public.add_income_with_debt(jsonb, jsonb);
-- kept for installed native builds that may still call it: drop function if exists public.add_subscription_with_recurring_expense(jsonb, jsonb);
-- kept for installed native builds that may still call it: drop function if exists public.cancel_subscription(uuid);
-- kept for installed native builds that may still call it: drop function if exists public.reactivate_subscription(uuid);
-- kept for installed native builds that may still call it: drop function if exists public.update_subscription_and_re(uuid, jsonb, jsonb);
drop table if exists public.fx_rates;
