-- 0119 — Goals v3 notification switches: milestone/celebration pushes and behind-plan alerts.
alter table public.user_settings
  add column if not exists goal_progress_alerts boolean not null default true,
  add column if not exists goal_alerts boolean not null default true;
