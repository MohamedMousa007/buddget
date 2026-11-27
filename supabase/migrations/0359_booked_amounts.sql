-- 0359_booked_amounts.sql  (LOGIC_SPEC v2 I-10, §3.1, §3.2 P2)
-- PURPOSE
--   Booked amounts for cross-currency rows written after P2 (I-10). Reads use them; NULL falls back to the live rate.
--     expenses.account_amount       amount in the source account's currency (payment_method_id)
--     expenses.to_account_amount    amount in the destination account's currency (to_payment_method_id, transfers)
--     income_events.account_amount  amount in the receiving account's currency
--   (savings_transactions.account_amount is added in 0356.)
--   Columns only, no backfill, no index (read with their row, never filtered on). Nullable, no default, nothing raises.
--   Synced tables already in every list (whole-row sync_pull_v2, sync_changed_since, a0 triggers); no list changes.
--
-- BEFORE-COUNTS (_checks/p2_counts.sql, section 0359; diagnostic, run one at a time, off peak)
--   old cross-currency rows: expenses vs source account currency, transfers vs destination account currency, income
--   events vs receiving account currency. Fewer than about 20 in total: fix by hand from the SMS text (separate,
--   owner-approved statements). Otherwise leave them on the live-rate fallback.
--
-- EXPECTED ROWS TOUCHED: 0.
--
-- ROLLBACK
--   alter table public.expenses drop column if exists account_amount, drop column if exists to_account_amount;
--   alter table public.income_events drop column if exists account_amount;

alter table public.expenses
  add column if not exists account_amount numeric,
  add column if not exists to_account_amount numeric;

alter table public.income_events
  add column if not exists account_amount numeric;
