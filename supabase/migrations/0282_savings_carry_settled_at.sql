-- Carry settle time. Additive and idempotent; the deployed code ignores the column.
-- savings_month_summary.updated_at is moved by a trigger on every write, so it cannot say when a month's carry was last
-- brought up to date (a released claim would hide a stale month). This column can: it is written only by a tap or a later close.
alter table public.savings_month_summary add column if not exists carry_settled_at timestamptz;
comment on column public.savings_month_summary.carry_settled_at is
  'When the carry of this month was last brought up to date by a tap or a later close. null = never, the close time (closed_at) counts.';
