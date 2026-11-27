-- 0363_split_backfill.sql  (LOGIC_SPEC v2 §3.2 P6, §8 OQ-2)
-- PURPOSE
--   Seeds profiles.savings_split (0362) from the retired allocator, once per user, only where it is still '[]':
--     share goals (funding_mode 'share', active, live, share_pct > 0) at share_pct, scaled by 100/Σ when Σ > 100 and
--     rounded down to 0.01; lines that round to 0 are dropped; ordered by priority.
--     The user's default carry pocket, when it is not the system vault (systemVaultId = the user id read backwards),
--     is a live pocket (no goal, not Monthly savings) and Σ < 100, gets 100 − Σ.
--     Fixed-amount goals (monthly_contribution) get no line (OQ-2: the split screen shows a one-time note instead).
--   Idempotent: a second run touches nothing (savings_split is no longer '[]'). updated_at only (no edited_at:
--   profiles is not in the 0241 lists; the client never writes savings_split).
--
-- BEFORE-COUNTS (_checks/p6_counts.sql, section 0363; expected in brackets)
--   users with default_carry_pocket_id ≠ systemVaultId [small]; share goals and Σ pct per user [small];
--   share lines that would round to 0 [0]; users whose Σ > 100 [0–few]; fixed-amount goals (OQ-2 notes) [small].
--
-- EXPECTED ROWS TOUCHED
--   profiles: = query 0363.5 (users with at least one line), about the number of users with share goals or a
--   non-vault default pocket.
--
-- ROLLBACK
--   Save the ids first (_checks/p6_counts.sql 0363.5), then:
--   update public.profiles set savings_split = '[]'::jsonb, updated_at = now() where id = any('{<saved ids>}');

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
update public.profiles pr
set savings_split = b.split, updated_at = now()
from built b
where pr.id = b.user_id
  and pr.savings_split = '[]'::jsonb
  and jsonb_array_length(b.split) > 0;
