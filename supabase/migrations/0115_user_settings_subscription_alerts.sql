alter table public.user_settings
  add column if not exists sub_due_reminders boolean not null default true,
  add column if not exists sub_price_alerts boolean not null default true;
