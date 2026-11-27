-- 0358_balance_anchors.sql  (LOGIC_SPEC v2 I-1, §3.1, §3.2 P2, §4.1)
-- PURPOSE
--   account_adjustments.anchor_balance: an absolute "the bank says X at occurred_at". balance(A, t) = latest anchor
--   <= t + the legs after it. delta is still written (= anchor - ledger at write) for display and audit; readers
--   derive the gap at read time. Existing rows keep anchor_balance NULL and stay delta legs (no backfill).
--   Index for "latest anchor of account A at or before t": (payment_method_id, occurred_at) on live anchors only.
--   Nullable column, no default, nothing raises: old builds' upserts never send it. Synced table already in every
--   list (sync_pull_v2 whole rows, sync_changed_since, a0 triggers); no list changes.
--
-- BEFORE-COUNTS (_checks/p2_counts.sql, section 0358)
--   adjustments by reason, live and deleted.
--
-- EXPECTED ROWS TOUCHED: 0.
--
-- ROLLBACK
--   drop index if exists public.account_adjustments_anchor_idx;
--   alter table public.account_adjustments drop column if exists anchor_balance;

alter table public.account_adjustments
  add column if not exists anchor_balance numeric;

create index if not exists account_adjustments_anchor_idx
  on public.account_adjustments (payment_method_id, occurred_at)
  where anchor_balance is not null and deleted_at is null;
