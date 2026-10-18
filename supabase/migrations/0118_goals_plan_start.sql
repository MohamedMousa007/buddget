-- 0118 — Goals v3: plan_start = when the current plan began (set on replan); earlier cycles stop counting as behind.
alter table public.goals add column if not exists plan_start date;
