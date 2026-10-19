-- 0121 — Budget v2: blocks, linked lines, plan lifecycle, activation history, Buddgy memory.
-- Additive only. Existing plans stay 'ready'; existing lines default to the 'everyday' block.
-- No silent regrouping: the app offers an "upgrade my plan" review instead of guessing from names.

alter table public.budget_plans
  add column if not exists status text not null default 'ready'
    check (status in ('draft', 'ready', 'archived')),
  add column if not exists intent text not null default 'custom'
    check (intent in ('balanced', 'saver', 'debt_crusher', 'custom')),
  add column if not exists origin text not null default 'manual'
    check (origin in ('ai', 'manual', 'template', 'clone')),
  add column if not exists income_override numeric check (income_override is null or income_override >= 0),
  add column if not exists rationale jsonb,
  add column if not exists engine_version text;

alter table public.budget_categories
  add column if not exists block text not null default 'everyday'
    check (block in ('bills', 'subscriptions', 'debts', 'everyday', 'safety', 'goals', 'grow')),
  add column if not exists link_type text not null default 'none'
    check (link_type in ('none', 'subscriptions', 'debts', 'goal', 'emergency')),
  add column if not exists link_ids uuid[] not null default '{}',
  add column if not exists due_day smallint check (due_day is null or due_day between 1 and 31),
  add column if not exists essential boolean not null default false,
  add column if not exists locked boolean not null default false,
  add column if not exists rationale text,
  add column if not exists confidence text check (confidence is null or confidence in ('high', 'estimated')),
  add column if not exists expense_categories text[] not null default '{}';

-- Savings rows keep their meaning: the flag, not the name, is what round-trips.
update public.budget_categories set is_savings = true where lower(trim(name)) = 'savings' and not is_savings;
update public.budget_categories
  set block = case when lower(name) like '%emergency%' then 'safety' else 'grow' end
  where is_savings and block = 'everyday';

alter table public.budget_feedback
  add column if not exists plan_id uuid references public.budget_plans(id) on delete set null,
  add column if not exists ops jsonb,
  add column if not exists outcome text check (outcome is null or outcome in ('applied', 'undone', 'dismissed'));

alter table public.profiles add column if not exists financial_profile jsonb;

-- Which plan was active from which cycle. Each month resolves to the latest row at or before it
-- (months before the first row use the first plan). One row per cycle: the last switch wins.
create table if not exists public.budget_plan_activations (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  plan_id        uuid not null references public.budget_plans(id) on delete cascade,
  effective_from date not null,
  created_at     timestamptz not null default now(),
  unique (user_id, effective_from)
);
create index if not exists budget_plan_activations_user_idx on public.budget_plan_activations (user_id, effective_from desc);
create index if not exists budget_plan_activations_plan_idx on public.budget_plan_activations (plan_id);
alter table public.budget_plan_activations enable row level security;
drop policy if exists budget_plan_activations_own on public.budget_plan_activations;
create policy budget_plan_activations_own on public.budget_plan_activations
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

insert into public.budget_plan_activations (user_id, plan_id, effective_from)
select p.id, p.active_budget_plan_id, date_trunc('month', bp.created_at)::date
from public.profiles p
join public.budget_plans bp on bp.id = p.active_budget_plan_id and bp.deleted_at is null
on conflict do nothing;

-- What Buddgy remembers, only with consent. 'proposed' rows are suggestions the user has not accepted.
create table if not exists public.buddgy_memories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  text       text not null check (char_length(text) between 1 and 280),
  kind       text not null default 'fact' check (kind in ('fact', 'preference', 'constraint')),
  source     text not null default 'chat' check (source in ('budget', 'chat', 'settings')),
  status     text not null default 'active' check (status in ('proposed', 'active')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists buddgy_memories_user_idx on public.buddgy_memories (user_id) where deleted_at is null;
alter table public.buddgy_memories enable row level security;
drop policy if exists buddgy_memories_own on public.buddgy_memories;
create policy buddgy_memories_own on public.buddgy_memories
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
