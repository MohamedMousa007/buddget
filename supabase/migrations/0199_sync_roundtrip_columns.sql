-- B1/P4 L11 + W22: columns the client already holds but the sync round trip drops.
-- Additive only. Apply BEFORE the client code that writes them ships.
alter table public.expenses
  add column if not exists category_label text,
  add column if not exists subcategory text,
  add column if not exists shared_plan_id uuid,
  add column if not exists is_recurring boolean not null default false;

alter table public.savings_accounts
  add column if not exists target_amount numeric,
  add column if not exists emoji text;

-- Goals can be cancelled; the enum only had active | paused | achieved, so cancelled was written as paused.
alter type public.goal_status add value if not exists 'cancelled';
