-- 0122 — activations follow the app-wide soft-delete rule so the sync diff can tombstone them.
-- One live row per cycle: uniqueness now ignores soft-deleted rows.
alter table public.budget_plan_activations add column if not exists deleted_at timestamptz;
alter table public.budget_plan_activations drop constraint if exists budget_plan_activations_user_id_effective_from_key;
create unique index if not exists budget_plan_activations_cycle_uidx
  on public.budget_plan_activations (user_id, effective_from) where deleted_at is null;
