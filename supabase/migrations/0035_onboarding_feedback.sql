-- Dedicated store for onboarding / budget-preview user feedback (AI memory + product analytics).
-- RLS: users insert and read only their own rows.

create table if not exists public.onboarding_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  context text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.onboarding_feedback is
  'User-submitted onboarding and budget-preview notes; append-only per user.';

create index if not exists onboarding_feedback_user_created_idx
  on public.onboarding_feedback (user_id, created_at desc);

alter table public.onboarding_feedback enable row level security;

create policy "onboarding_feedback_insert_own"
  on public.onboarding_feedback for insert
  with check (auth.uid() = user_id);

create policy "onboarding_feedback_select_own"
  on public.onboarding_feedback for select
  using (auth.uid() = user_id);
