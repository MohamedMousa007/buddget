-- 0355_savings_parts.sql  (LOGIC_SPEC v2 §3.1, §3.2 P2, OQ-4 verdict §8)
-- PURPOSE
--   A part is one savings_accounts row with one home. Its owner is now a column, not the goal-side array:
--     goal_id             -> goals(id) on delete set null  (NULL = a pocket, unless it is Monthly savings)
--     is_monthly_savings  -> the user's system vault (id = systemVaultId(user_id), the user id read backwards)
--   Backfills (all re-runnable; §8 re-runs this file's backfill after P6):
--     1. goal_id from goals.linked_savings_account_ids, only where exactly one live goal links the pocket.
--     2. is_monthly_savings = true on the system vault row.
--     3. OQ-4: each live targeted pocket that no live goal links becomes a goal (same name, currency and target,
--        category quality_of_life), linked by id (goal id = md5 of the pocket id), never by name. The goal also gets
--        linked_savings_account_ids = {pocket} because readers use that array until P5. target_amount stays until 0364.
--   Unique partial indexes (I-13) in the last section, created only when the data has no duplicates. (§8 also lists
--   "final unique indexes" at contract time; §3.2 puts them here, so they are here, as a separable last section.)
--   Vault rows or goal links an old build writes after this migration stay unflagged until the §8 re-run.
--   Backfill writes bump updated_at only, never edited_at: reject_stale_write (0241) would otherwise drop users'
--   pending offline edits. Old builds do not send goal_id / is_monthly_savings, so their upserts leave them alone.
--   No new table: sync_pull_v2 / sync_table_delta return whole rows (to_jsonb), sync_changed_since reads updated_at,
--   and the a0_stamp_insert / a0_reject_stale_write lists (0241) are unchanged.
--   link_guard_savings_accounts gains goal_id (0244's args plus goal_id, goals): another user's goal is refused (23503),
--   the same convention as every other link column.
--
-- BEFORE-COUNTS (supabase/migrations/_checks/p2_counts.sql, section 0355; expected in brackets)
--   goals with >= 2 linked pockets [0]; pockets linked by >= 2 live goals [0]; targeted pockets with no goal [~0];
--   duplicate (goal, holder) after backfill [0]; system vault rows per user [<= 1]; live link_guard_savings_accounts
--   definition [linked_payment_method_id, held_in_payment_method_id; if it differs, merge before applying].
--
-- EXPECTED ROWS TOUCHED
--   savings_accounts.goal_id      = live pockets linked by exactly one live goal (query 0355.6) + OQ-4 pockets (0355.3).
--   savings_accounts.is_monthly_savings = system vault rows (query 0355.5).
--   goals inserted                = targeted pockets with no goal (query 0355.3), expected 0.
--
-- ROLLBACK (nothing is dropped or overwritten, so rollback only removes what was added)
--   drop index if exists public.uq_savings_parts_goal_home, public.uq_savings_parts_ms_home, public.savings_accounts_goal_id_idx;
--   delete from public.goals g where g.id = md5('p2-oq4-goal:' || (g.linked_savings_account_ids[1])::text)::uuid;  -- OQ-4 goals only
--   alter table public.savings_accounts drop column if exists goal_id, drop column if exists is_monthly_savings;
--   re-create link_guard_savings_accounts with 0244's args (linked_payment_method_id, held_in_payment_method_id).

-- 1. Columns ------------------------------------------------------------------------------------------------------
alter table public.savings_accounts
  add column if not exists goal_id uuid references public.goals (id) on delete set null,
  add column if not exists is_monthly_savings boolean not null default false;

-- FK index: covers the ON DELETE SET NULL lookup and "parts of goal G".
create index if not exists savings_accounts_goal_id_idx
  on public.savings_accounts (goal_id) where goal_id is not null;

-- 2. Cross-tenant link guard (0221/0244 convention; a missing goal is left to the FK) --------------------------------
drop trigger if exists link_guard_savings_accounts on public.savings_accounts;
create trigger link_guard_savings_accounts before insert or update on public.savings_accounts
  for each row execute function private.assert_link_owner(
    'linked_payment_method_id', 'payment_methods', 'held_in_payment_method_id', 'payment_methods', 'goal_id', 'goals');

-- 3. Backfill goal_id from the goal-side array (exactly one live goal per pocket; ambiguous pockets stay NULL) --------
-- Safe to re-run with uq_savings_parts_goal_home in place: per (goal, holder) only the oldest unlinked pocket is linked,
-- and only when no live part of that goal already sits in that holder (a second one stays a pocket; count 0355.4).
with links as (
  select (x)::uuid as pocket_id, g.id as goal_id, g.user_id
  from public.goals g
  cross join lateral unnest(g.linked_savings_account_ids) as x
  where g.deleted_at is null
),
single as (
  select pocket_id, min(goal_id::text)::uuid as goal_id, min(user_id::text)::uuid as user_id
  from links
  group by pocket_id
  having count(distinct goal_id) = 1
),
cand as (
  select s.id, o.goal_id, s.held_in_payment_method_id as held_in,
         row_number() over (partition by o.goal_id, s.held_in_payment_method_id order by s.created_at, s.id) as rn
  from single o
  join public.savings_accounts s on s.id = o.pocket_id and s.user_id = o.user_id
  where s.deleted_at is null and s.goal_id is null
)
update public.savings_accounts s
set goal_id = c.goal_id,
    updated_at = now()
from cand c
where s.id = c.id
  and (c.held_in is null or (c.rn = 1 and not exists (
    select 1 from public.savings_accounts d
    where d.goal_id = c.goal_id and d.held_in_payment_method_id = c.held_in and d.deleted_at is null)));

-- 4. Monthly savings flag on the system vault (pocketIdentity.ts#systemVaultId: the user id's hex read backwards) -----
update public.savings_accounts s
set is_monthly_savings = true,
    updated_at = now()
from public.profiles p
where s.id = reverse(replace(p.id::text, '-', ''))::uuid
  and s.user_id = p.id
  and not s.is_monthly_savings;

-- 5. OQ-4: targeted pockets with no goal become goals, linked by id --------------------------------------------------
-- A goal the user later deletes is not re-created on a re-run: its tombstone keeps the id, ON CONFLICT skips it.
with cand as (
  select s.id, s.user_id, s.name, s.currency, s.target_amount
  from public.savings_accounts s
  where s.deleted_at is null
    and s.goal_id is null
    and not s.is_monthly_savings
    and s.target_amount is not null and s.target_amount > 0
    and not exists (
      select 1 from public.goals g
      where g.user_id = s.user_id and g.deleted_at is null
        and s.id::text = any (g.linked_savings_account_ids::text[])
    )
),
ins as (
  insert into public.goals (id, user_id, name, category, currency, target_amount, linked_savings_account_ids)
  select md5('p2-oq4-goal:' || c.id::text)::uuid, c.user_id, c.name, 'quality_of_life', c.currency, c.target_amount, array[c.id]
  from cand c
  on conflict (id) do nothing
  returning id, user_id, (linked_savings_account_ids[1])::uuid as pocket_id
)
update public.savings_accounts s
set goal_id = ins.id,
    updated_at = now()
from ins
where s.id = ins.pocket_id
  and s.user_id = ins.user_id
  and s.goal_id is null;

-- 6. One part per home (I-13). Created only when the data allows; otherwise a NOTICE, and the index waits for the
--    contract migration after the duplicates are repaired. Never raises.
do $$
begin
  if exists (
    select 1 from public.savings_accounts
    where goal_id is not null and held_in_payment_method_id is not null and deleted_at is null
    group by goal_id, held_in_payment_method_id having count(*) > 1
  ) then
    raise notice '0355: duplicate (goal_id, held_in) parts exist; uq_savings_parts_goal_home NOT created';
  else
    create unique index if not exists uq_savings_parts_goal_home
      on public.savings_accounts (goal_id, held_in_payment_method_id)
      where goal_id is not null and held_in_payment_method_id is not null and deleted_at is null;
  end if;

  if exists (
    select 1 from public.savings_accounts
    where is_monthly_savings and held_in_payment_method_id is not null and deleted_at is null
    group by user_id, held_in_payment_method_id having count(*) > 1
  ) then
    raise notice '0355: duplicate Monthly savings parts per (user, held_in) exist; uq_savings_parts_ms_home NOT created';
  else
    create unique index if not exists uq_savings_parts_ms_home
      on public.savings_accounts (user_id, held_in_payment_method_id)
      where is_monthly_savings and deleted_at is null;
  end if;
end $$;
