alter table public.buddgy_memories
  add column if not exists plan_id uuid references public.budget_plans(id) on delete set null;
create index if not exists buddgy_memories_plan_id_idx on public.buddgy_memories(plan_id) where plan_id is not null;
