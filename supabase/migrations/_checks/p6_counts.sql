-- p6_counts.sql: read-only checks before applying P6 (0362-0363). Counts and ids only, no names, emails or amounts.
-- Run each statement on its own (not as one script), off peak. EXPLAIN is never ANALYZE. Expected values in brackets.
-- Section "AFTER" runs once 0362 is applied (the new columns and functions do not exist before).

-- ================================================================ 0 · environment
-- 0.1 none of the new columns exist yet [0 rows]
select table_name, column_name from information_schema.columns
where table_schema = 'public'
  and ((table_name = 'profiles' and column_name = 'savings_split')
    or (table_name = 'savings_month_summary' and column_name in ('status', 'version', 'cycle_start', 'cycle_end', 'lines', 'applied_lines', 'achieved_by_proposal')));
-- 0.2 P2 objects 0362 relies on exist [label_part, sms_safe_tz, keep_goal_achieved: 3 rows]
select n.nspname, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where (n.nspname = 'public' and p.proname in ('label_part', 'sms_safe_tz')) or (n.nspname = 'private' and p.proname = 'keep_goal_achieved');
-- 0.3 the summary's unique index (the anti-join) [savings_month_summary_user_month_key present]
select indexname from pg_indexes where schemaname = 'public' and tablename = 'savings_month_summary';
-- 0.4 savings delta mode on (label_part refuses otherwise) [true]
select private.savings_delta_enabled();

-- ================================================================ 0362 · month end
-- 0362.1 summary rows (all become 'legacy') [small]
select count(*) from public.savings_month_summary;
-- 0362.2 legacy rows per month_key [last ~3 months; MONTH_CARRY_WRITES has been off since 2026-11-27]
select month_key, count(*) from public.savings_month_summary group by month_key order by month_key desc limit 12;
-- 0362.3 user_settings rows (the cron's keyset) [= users]
select count(*) from public.user_settings;
-- 0362.4 invalid timezones (sms_safe_tz falls back to Cairo) [0]
select count(*) from public.user_settings
where timezone is not null and timezone <> '' and timezone not in (select name from pg_timezone_names);
-- 0362.5 month_start_day outside 1-28 (clamped to 28 by the cycle logic) [small]
select month_start_day, count(*) from public.user_settings where month_start_day not between 1 and 28 group by 1;
-- 0362.6 tombstoned goal / Monthly savings parts (apply revives one when its partId comes back) [0+]
select count(*) from public.savings_accounts where deleted_at is not null and (goal_id is not null or is_monthly_savings);

-- ================================================================ 0363 · split backfill
-- 0363.1 users whose default carry pocket is not the system vault [small]
select count(*) from public.profiles p
where p.default_carry_pocket_id is not null
  and p.default_carry_pocket_id <> (
    select (substr(h, 1, 8) || '-' || substr(h, 9, 4) || '-' || substr(h, 13, 4) || '-' || substr(h, 17, 4) || '-' || substr(h, 21))::uuid
    from (select reverse(replace(p.id::text, '-', '')) as h) v);
-- 0363.2 share goals and Σ pct per user (ids only) [small]
select user_id, count(*) as goals, sum(share_pct) as total_pct from public.goals
where deleted_at is null and status = 'active' and funding_mode = 'share' and coalesce(share_pct, 0) > 0
group by user_id order by total_pct desc limit 200;
-- 0363.3 share lines that round to 0 after scaling (dropped) [0]
with s as (select user_id, share_pct::numeric as pct from public.goals
           where deleted_at is null and status = 'active' and funding_mode = 'share' and coalesce(share_pct, 0) > 0),
t as (select user_id, sum(pct) as total from s group by user_id)
select count(*) from s join t using (user_id)
where floor(s.pct * case when t.total > 100 then 100 / t.total else 1 end * 100) / 100 <= 0;
-- 0363.4 fixed-amount goals (OQ-2: no line; the split screen shows a note) [small]
select count(*) from public.goals
where deleted_at is null and status = 'active' and funding_mode = 'fixed' and coalesce(monthly_contribution, 0) > 0;
-- 0363.5 the exact write set of 0363 (same CTE, no limit): SAVE THESE IDS for rollback. Run after 0362 (the column exists).
with share as (
  select g.user_id, g.id, g.priority, g.share_pct::numeric as pct
  from public.goals g
  where g.deleted_at is null and g.status = 'active' and g.funding_mode = 'share' and coalesce(g.share_pct, 0) > 0
), totals as (
  select user_id, sum(pct) as total from share group by user_id
), lines as (
  select s.user_id, s.id, s.priority,
         floor(s.pct * case when t.total > 100 then 100 / t.total else 1 end * 100) / 100 as pct
  from share s join totals t using (user_id)
), kept as (
  select * from lines where pct > 0
), goal_split as (
  select user_id, jsonb_agg(jsonb_build_object('target_id', id, 'pct', pct) order by priority, id) as split, sum(pct) as total
  from kept group by user_id
), pocket as (
  select p.id as user_id, p.default_carry_pocket_id as pocket_id
  from public.profiles p
  join public.savings_accounts sa
    on sa.id = p.default_carry_pocket_id and sa.user_id = p.id and sa.deleted_at is null
   and sa.category = 'savings' and sa.goal_id is null and not sa.is_monthly_savings
  where p.default_carry_pocket_id is not null
    and p.default_carry_pocket_id <> (
      select (substr(h, 1, 8) || '-' || substr(h, 9, 4) || '-' || substr(h, 13, 4) || '-' || substr(h, 17, 4) || '-' || substr(h, 21))::uuid
      from (select reverse(replace(p.id::text, '-', '')) as h) v)
), built as (
  select coalesce(g.user_id, po.user_id) as user_id,
         coalesce(g.split, '[]'::jsonb)
         || case when po.pocket_id is not null and 100 - coalesce(g.total, 0) > 0
                 then jsonb_build_array(jsonb_build_object('target_id', po.pocket_id, 'pct', 100 - coalesce(g.total, 0)))
                 else '[]'::jsonb end as split
  from goal_split g
  full join pocket po on po.user_id = g.user_id
)
select b.user_id
from built b join public.profiles pr on pr.id = b.user_id
where pr.savings_split = '[]'::jsonb and jsonb_array_length(b.split) > 0
order by b.user_id;

-- ================================================================ AFTER (0362 applied)
-- A.1 every old row reads legacy [= 0362.1]
select status, count(*) from public.savings_month_summary group by status;
-- A.2 grants: service_role only [4 rows]
select p.proname, p.proacl from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('month_end_due_users', 'month_end_ledger', 'apply_month_end', 'undo_month_end');
-- A.3 EXPLAIN the due scan (the function body, inlined): Index Scan using user_settings_pkey; savings_month_summary only
--     through savings_month_summary_user_month_key; no Seq Scan on savings_month_summary.
explain
  with page as materialized (
    select us.user_id, us.month_start_day, us.timezone from public.user_settings us
    where us.user_id > '00000000-0000-0000-0000-000000000000'::uuid order by us.user_id limit 2000)
  select p.user_id,
         (select s.cycle_end from public.savings_month_summary s where s.user_id = p.user_id and s.cycle_end is not null order by s.cycle_end desc limit 1),
         exists (select 1 from public.savings_month_summary s where s.user_id = p.user_id and s.month_key in ('2026-11-01', '2026-11'))
  from page p limit 25;
-- A.4 EXPLAIN the ledger lists for one QA user (replace the id): each an Index Scan on its live user index.
explain select * from public.expenses where user_id = '00000000-0000-0000-0000-000000000000' and deleted_at is null
  and (expense_date >= '2026-10-31' or payment_method_id = any('{}'::uuid[]) or linked_debt_id = any('{}'::uuid[]))
  order by expense_date desc limit 20000;
explain select * from public.savings_transactions where user_id = '00000000-0000-0000-0000-000000000000' and deleted_at is null
  and transaction_date >= '2026-10-31' order by transaction_date desc limit 20000;
explain select * from public.income_events where user_id = '00000000-0000-0000-0000-000000000000' and deleted_at is null
  and (received_date >= '2026-10-31' or occurrence_date >= '2026-10-31') order by received_date desc limit 20000;
explain select * from public.debt_payments where user_id = '00000000-0000-0000-0000-000000000000' and deleted_at is null
  and (payment_date >= '2026-10-31' or debt_id = any('{}'::uuid[])) order by payment_date desc limit 20000;
-- A.5 EXPLAIN the cron's due proposals: Index Scan using savings_month_summary_due_idx
explain select id, user_id, version from public.savings_month_summary
  where status = 'proposed' and auto_apply_at <= now() order by auto_apply_at limit 25;
-- A.6 after 0363: users with a split, and any stored Σ > 100 (read clamps it and flags "over 100%") [0 over]
select count(*) filter (where jsonb_array_length(savings_split) > 0) as with_split,
       count(*) filter (where (select coalesce(sum((e->>'pct')::numeric), 0) from jsonb_array_elements(savings_split) e) > 100) as over_100
from public.profiles;
-- A.7 get_advisors (security + performance) after 0362: fix anything new it reports.
