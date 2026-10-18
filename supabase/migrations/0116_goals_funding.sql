-- 0116 — Goals v3 funding model.
-- funding_mode: 'share' (share_pct of period savings), 'fixed' (monthly_contribution), 'manual'.
-- Existing rows stay manual. Totals of share_pct may exceed 100; priority (asc) resolves shortfalls.
alter table public.goals
  add column if not exists funding_mode text not null default 'manual'
    check (funding_mode in ('share', 'fixed', 'manual')),
  add column if not exists share_pct numeric(5,2)
    check (share_pct is null or share_pct >= 0),
  add column if not exists frequency text not null default 'monthly'
    check (frequency in ('monthly', 'quarterly'));

-- One row per goal per period = idempotent allocation + the cycle history behind
-- "behind N months" and streaks. period is 'YYYY-MM' (monthly) or 'YYYY-Qn' (quarterly).
create table if not exists public.goal_allocation_runs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  goal_id     uuid not null references public.goals(id) on delete cascade,
  period      text not null,
  planned     numeric not null default 0,
  amount      numeric not null default 0,
  created_at  timestamptz not null default now(),
  unique (goal_id, period)
);

create index if not exists goal_allocation_runs_user_idx on public.goal_allocation_runs (user_id);

alter table public.goal_allocation_runs enable row level security;

-- Read-only for the owner; inserts come from the service-role cron.
drop policy if exists goal_allocation_runs_read on public.goal_allocation_runs;
create policy goal_allocation_runs_read on public.goal_allocation_runs
  for select using ((select auth.uid()) = user_id);
