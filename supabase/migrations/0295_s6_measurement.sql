-- S6 phase 6 (S5c item 27): what launch gate 3 and the price tests need. The SMS switch-on time is user_settings.sms_first_enabled_at (0292).

-- Paywall views by country. The country is read from the profile on the server, never taken from the client.
create table public.paywall_views (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  country text,
  platform text check (platform in ('ios', 'android', 'web')),
  source text,
  viewed_at timestamptz not null default now()
);
create index paywall_views_day_idx on public.paywall_views (viewed_at);
alter table public.paywall_views enable row level security;
revoke all on public.paywall_views from anon, authenticated;
grant all on public.paywall_views to service_role;

create or replace function public.record_paywall_view(p_user uuid, p_platform text, p_source text)
returns void
language sql
security definer
set search_path to 'public'
as $$
  insert into public.paywall_views (user_id, country, platform, source)
  select p_user, (select country from public.profiles where id = p_user),
         case when p_platform in ('ios', 'android', 'web') then p_platform end, left(p_source, 40)
$$;
revoke all on function public.record_paywall_view(uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_paywall_view(uuid, text, text) to service_role;

-- Launch gate 3 is behaviour, not a survey: per user per month, (a) how many bank accounts received a booked SMS item,
-- so a third tracked account receiving messages shows as 3 or more, and (b) Sparks used.
create view public.gate3_preview_monthly as
  with sms as (
    select e.user_id, date_trunc('month', e.created_at)::date as month, count(distinct e.payment_method_id) as sms_accounts_receiving
    from public.expenses e where e.sms_log_id is not null and e.payment_method_id is not null group by 1, 2
  ), sp as (
    select user_id, date_trunc('month', created_at)::date as month, sum(sparks)::integer as sparks_used
    from public.spark_spend group by 1, 2
  )
  select coalesce(sms.user_id, sp.user_id) as user_id, coalesce(sms.month, sp.month) as month,
         coalesce(sms.sms_accounts_receiving, 0) as sms_accounts_receiving, coalesce(sp.sparks_used, 0) as sparks_used,
         coalesce(sms.sms_accounts_receiving, 0) > 2 as third_account_receiving,
         coalesce(sp.sparks_used, 0) > 0 as used_sparks
  from sms full join sp on sp.user_id = sms.user_id and sp.month = sms.month;
revoke all on public.gate3_preview_monthly from anon, authenticated;
grant select on public.gate3_preview_monthly to service_role;
