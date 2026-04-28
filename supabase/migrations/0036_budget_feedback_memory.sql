-- Budget preview / regenerate memory: user feedback plus optional before/after plan snapshots (JSON).
-- RLS: authenticated users insert and read only their own rows.

create table if not exists public.budget_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  feedback_text text not null,
  budget_before jsonb,
  budget_after jsonb,
  created_at timestamptz not null default now()
);

comment on table public.budget_feedback is
  'User feedback on budget plans with optional serialized plan state before and after AI or manual edits.';

create index if not exists budget_feedback_user_created_idx
  on public.budget_feedback (user_id, created_at desc);

alter table public.budget_feedback enable row level security;

create policy "budget_feedback_insert_own"
  on public.budget_feedback for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "budget_feedback_select_own"
  on public.budget_feedback for select to authenticated
  using ((select auth.uid()) = user_id);
