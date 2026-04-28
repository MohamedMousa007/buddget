-- Budget feedback memory for AI regenerate (idempotent with 0036_budget_feedback_memory.sql).
-- Tightens JSON columns, unified RLS policy, and index name alignment.

create table if not exists public.budget_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  feedback_text text not null,
  budget_before jsonb not null default '{}'::jsonb,
  budget_after jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.budget_feedback is
  'User feedback on budget plans with serialized plan state before and after AI adjustments.';

-- Backfill nulls when migrating from 0036 (nullable jsonb).
update public.budget_feedback
set budget_before = coalesce(budget_before, '{}'::jsonb),
    budget_after = coalesce(budget_after, '{}'::jsonb)
where budget_before is null or budget_after is null;

alter table public.budget_feedback
  alter column budget_before set default '{}'::jsonb,
  alter column budget_after set default '{}'::jsonb;

alter table public.budget_feedback
  alter column budget_before set not null,
  alter column budget_after set not null;

drop policy if exists "budget_feedback_insert_own" on public.budget_feedback;
drop policy if exists "budget_feedback_select_own" on public.budget_feedback;

alter table public.budget_feedback enable row level security;

create policy "budget_feedback_own" on public.budget_feedback
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index if not exists budget_feedback_user_created
  on public.budget_feedback (user_id, created_at desc);
