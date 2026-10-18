alter type subscription_billing_cycle add value if not exists 'semiannual';
alter table public.subscriptions
  add column if not exists tracking text not null default 'sms' check (tracking in ('sms','ask','log')),
  add column if not exists reminder boolean not null default true,
  add column if not exists trial_end date,
  add column if not exists ends_on date,
  add column if not exists paused_at timestamptz,
  add column if not exists price_history jsonb not null default '[]'::jsonb,
  add column if not exists pending_plan_from date,
  add column if not exists shared_with text[],
  add column if not exists my_share numeric;
