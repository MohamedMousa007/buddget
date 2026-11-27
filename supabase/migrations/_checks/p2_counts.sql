-- p2_counts.sql: read-only checks before applying P2 (0355-0359). Counts and ids only, no names, emails or amounts.
-- Run each statement on its own (not as one script), off peak. EXPLAIN is never ANALYZE. Expected values in brackets.
-- Section "AFTER" runs once the migrations are applied (the columns and indexes do not exist before).

-- ================================================================ 0 · environment
-- 0.1 delta mode must be on, or label_part refuses to run [true]
select private.savings_delta_enabled() as delta_enabled;
-- 0.2 type of the goal-side array (0355 casts either way) [uuid[] or text[]]
select data_type, udt_name from information_schema.columns
where table_schema = 'public' and table_name = 'goals' and column_name = 'linked_savings_account_ids';
-- 0.3 live trigger definitions on the touched tables (0355 replaces link_guard_savings_accounts: its args must be
--     linked_payment_method_id, held_in_payment_method_id; anything else must be merged into 0355 first)
select c.relname, t.tgname, pg_get_triggerdef(t.oid) as def
from pg_trigger t join pg_class c on c.oid = t.tgrelid
where c.relnamespace = 'public'::regnamespace
  and c.relname in ('savings_accounts', 'savings_transactions', 'goals', 'account_adjustments')
  and not t.tgisinternal
order by c.relname, t.tgname;
-- 0.4 none of the new names exist yet [0 rows each]
select table_name, column_name from information_schema.columns
where table_schema = 'public' and (table_name, column_name) in (
  ('savings_accounts', 'goal_id'), ('savings_accounts', 'is_monthly_savings'),
  ('savings_transactions', 'idempotency_key'), ('savings_transactions', 'pair_id'), ('savings_transactions', 'account_amount'),
  ('account_adjustments', 'anchor_balance'), ('expenses', 'account_amount'), ('expenses', 'to_account_amount'),
  ('income_events', 'account_amount'));
select proname from pg_proc where proname in ('label_part', 'clamp_label_withdrawal', 'keep_goal_achieved');

-- ================================================================ 0355 · savings parts
-- 0355.1 goals with >= 2 linked pockets [0]
select count(*) from public.goals
where deleted_at is null and cardinality(linked_savings_account_ids) >= 2;
-- 0355.2 pockets linked by >= 2 live goals (left NULL by the backfill) [0]; ids for repair
select (x)::uuid as pocket_id, count(distinct g.id) as goals
from public.goals g cross join lateral unnest(g.linked_savings_account_ids) x
where g.deleted_at is null
group by 1 having count(distinct g.id) >= 2
limit 50;
-- 0355.3 OQ-4: live targeted pockets that no live goal links (each becomes a goal) [~0]; ids only
select s.id as pocket_id, s.user_id
from public.savings_accounts s
where s.deleted_at is null and s.target_amount is not null and s.target_amount > 0
  and s.id <> reverse(replace(s.user_id::text, '-', ''))::uuid
  and not exists (
    select 1 from public.goals g
    where g.user_id = s.user_id and g.deleted_at is null
      and s.id::text = any (g.linked_savings_account_ids::text[]))
limit 50;
-- 0355.4 duplicate (goal, holder) once the backfill runs [0]; if > 0 the unique index is skipped with a NOTICE
with links as (
  select (x)::uuid as pocket_id, g.id as goal_id
  from public.goals g cross join lateral unnest(g.linked_savings_account_ids) x
  where g.deleted_at is null
)
select l.goal_id, s.held_in_payment_method_id, count(*) as parts
from links l join public.savings_accounts s on s.id = l.pocket_id
where s.deleted_at is null and s.held_in_payment_method_id is not null
group by 1, 2 having count(*) > 1
limit 50;
-- 0355.5 system vault rows (rows the MS flag touches) and live 'Monthly Savings' vault-type rows per user [<= 1 each]
select count(*) as system_vault_rows,
       count(*) filter (where s.deleted_at is null) as live_system_vault_rows
from public.savings_accounts s join public.profiles p on p.id = s.user_id
where s.id = reverse(replace(p.id::text, '-', ''))::uuid;
select n as vaults_per_user, count(*) as users from (
  select user_id, count(*) as n from public.savings_accounts
  where deleted_at is null and type = 'vault' and name = 'Monthly Savings'
  group by user_id) v
group by n order by n;
-- 0355.6 rows the goal_id backfill touches (live pockets linked by exactly one live goal)
with links as (
  select (x)::uuid as pocket_id, g.id as goal_id
  from public.goals g cross join lateral unnest(g.linked_savings_account_ids) x
  where g.deleted_at is null
), single as (select pocket_id from links group by pocket_id having count(distinct goal_id) = 1)
select count(*) from single o join public.savings_accounts s on s.id = o.pocket_id where s.deleted_at is null;
-- 0355.7 linked ids that point at no live pocket (dangling; not backfilled) [report only]
select count(*) from public.goals g cross join lateral unnest(g.linked_savings_account_ids) x
where g.deleted_at is null
  and not exists (select 1 from public.savings_accounts s where s.id = (x)::uuid and s.deleted_at is null);
-- 0355.8 plan of the MS backfill's join (same join and WHERE as the UPDATE; the new column does not exist yet)
explain select s.id from public.savings_accounts s join public.profiles p
  on s.id = reverse(replace(p.id::text, '-', ''))::uuid and s.user_id = p.id;

-- ================================================================ 0356 · labels
-- 0356.1 carry rows, live and deleted [6 live]
select count(*) filter (where deleted_at is null) as live, count(*) filter (where deleted_at is not null) as deleted
from public.savings_transactions where source = 'carry';
-- 0356.2 rows the carry backfill touches (carry rows with a transfer_group_id) [~6]
select count(*) from public.savings_transactions where source = 'carry' and transfer_group_id is not null;
-- 0356.3 rows per (user, part, group) > 1, tombstones included [0]
select count(*) from (
  select user_id, account_id, transfer_group_id from public.savings_transactions
  where transfer_group_id is not null
  group by 1, 2, 3 having count(*) > 1) d;
-- 0356.4 rows that already carry a label source (old builds never write these) [0 rows]
select source, count(*) from public.savings_transactions
where source in ('set_aside', 'opening', 'move_in', 'move_out', 'month_end', 'month_end_undo', 'release', 'spent', 'close')
group by source;
-- 0356.5 amount check accepts 0, which the clamp can write [check (amount >= 0 and amount < 1e16)]
select conname, pg_get_constraintdef(oid) from pg_constraint
where conrelid = 'public.savings_transactions'::regclass and contype = 'c';
-- 0356.6 plan of the carry backfill's filter (same WHERE as the UPDATE; the new column does not exist yet)
explain select id from public.savings_transactions where source = 'carry' and transfer_group_id is not null;
-- 0356.7 non-carry rows sharing a transfer_group_id with a carry row [0]
select count(*) from public.savings_transactions o
where o.source is distinct from 'carry' and o.transfer_group_id in (
  select c.transfer_group_id from public.savings_transactions c where c.source = 'carry' and c.transfer_group_id is not null);
-- 0356.8 indexes on savings_transactions (0356 adds an account_id index only if none leads with account_id)
select indexname, indexdef from pg_indexes where schemaname = 'public' and tablename = 'savings_transactions' order by 1;
-- 0356.9 parts whose ledger sum and current_balance disagree (the clamp uses the larger) [report; service_role]
select count(*) from public.savings_balance_drift();

-- ================================================================ 0357 · achieved is final
-- 0357.1 achieved goals [report]
select count(*) filter (where deleted_at is null) as live_achieved,
       count(*) filter (where deleted_at is not null) as deleted_achieved,
       count(*) filter (where achieved_at is null) as achieved_without_date
from public.goals where status = 'achieved';

-- ================================================================ 0358 · anchors
-- 0358.1 adjustments by reason [report]
select reason, count(*) filter (where deleted_at is null) as live, count(*) filter (where deleted_at is not null) as deleted
from public.account_adjustments group by reason order by reason;

-- ================================================================ 0359 · booked amounts (diagnostic: one at a time, off peak)
-- 0359.1 expenses whose currency differs from the source account's [total < ~20 → fix by hand]
select count(*) from public.expenses e join public.payment_methods pm on pm.id = e.payment_method_id
where e.deleted_at is null and e.currency <> pm.currency;
-- 0359.2 transfers whose currency differs from the destination account's
select count(*) from public.expenses e join public.payment_methods pm on pm.id = e.to_payment_method_id
where e.deleted_at is null and e.currency <> pm.currency;
-- 0359.3 income events whose currency differs from the receiving account's
select count(*) from public.income_events i join public.payment_methods pm on pm.id = i.payment_method_id
where i.deleted_at is null and i.currency <> pm.currency;
-- 0359.4 ids, only if the three counts total < ~20
select 'expense' as tbl, e.id from public.expenses e join public.payment_methods pm on pm.id = e.payment_method_id
where e.deleted_at is null and e.currency <> pm.currency
union all
select 'transfer', e.id from public.expenses e join public.payment_methods pm on pm.id = e.to_payment_method_id
where e.deleted_at is null and e.currency <> pm.currency
union all
select 'income', i.id from public.income_events i join public.payment_methods pm on pm.id = i.payment_method_id
where i.deleted_at is null and i.currency <> pm.currency
limit 50;

-- ================================================================ AFTER applying (index use of the new queries)
-- A.1 label_part key lookup (tombstones included) → an index leading with account_id, never a seq scan
explain select balance_after from public.savings_transactions
where user_id = '00000000-0000-0000-0000-000000000001' and account_id = '00000000-0000-0000-0000-000000000002'
  and idempotency_key = '00000000-0000-0000-0000-000000000003'
order by (deleted_at is not null), created_at limit 1;
-- A.2 latest anchor of an account → account_adjustments_anchor_idx
explain select anchor_balance, occurred_at from public.account_adjustments
where payment_method_id = '00000000-0000-0000-0000-000000000004'
  and anchor_balance is not null and deleted_at is null and occurred_at <= now()
order by occurred_at desc limit 1;
-- A.3 parts of a goal → savings_accounts_goal_id_idx
explain select id from public.savings_accounts where goal_id = '00000000-0000-0000-0000-000000000005' and deleted_at is null;
-- A.4 move pair lookup → savings_transactions_pair_id_idx
explain select id from public.savings_transactions where pair_id = '00000000-0000-0000-0000-000000000006';
-- A.5 results: columns set, indexes created (a NOTICE in 0355 means a unique index was skipped)
select count(*) filter (where goal_id is not null) as parts_with_goal,
       count(*) filter (where is_monthly_savings) as ms_parts
from public.savings_accounts where deleted_at is null;
select indexname from pg_indexes where schemaname = 'public' and indexname in (
  'savings_accounts_goal_id_idx', 'uq_savings_parts_goal_home', 'uq_savings_parts_ms_home',
  'uq_savings_tx_idempotency', 'savings_transactions_pair_id_idx', 'account_adjustments_anchor_idx');  -- [6 rows]
select count(*) from public.savings_transactions where source = 'carry' and idempotency_key is not null;  -- [= 0356.2]
-- A.6 then run get_advisors (security + performance) and fix what it reports.
