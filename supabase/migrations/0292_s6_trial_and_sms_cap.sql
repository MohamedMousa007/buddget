-- S6 phase 3 (S5c section 14, items 2, 17, 18): the one-time trial and the free SMS account cap.
-- Both are dormant until platform_settings.billing.enabled is true: the trial is not granted and the cap is not applied.
-- Checked before writing (live, 2026-11-15): 6 of 47 accounts track more than 2 top-level non-cash accounts by SMS (the
-- most is 5). The cap trigger never touches an existing row, and every account holds a promo Plus entitlement (0290), so
-- nobody loses a tracked account when the cap is switched on while that preview runs.

-- Item 2: no device key. One claim per normalised email (lower case; for Gmail dots and anything from + removed).
create table public.trial_claims (
  email_key text primary key,
  user_id uuid references auth.users (id) on delete set null,
  claimed_at timestamptz not null default now()
);
alter table public.trial_claims enable row level security;
revoke all on public.trial_claims from anon, authenticated;
grant all on public.trial_claims to service_role;
create index trial_claims_day_idx on public.trial_claims (claimed_at);

-- Item 17: a cap on trials granted per day (the number is data, editable without a deploy).
insert into public.platform_settings (key, value) values ('trial_limits', '{"dailyCap": 200}'::jsonb) on conflict (key) do nothing;

-- Open a trial allowance (ledger 1, kind 'trial'): closes the free calendar-month row so the trial is 60, not 60 + 20.
create or replace function public.spark_open_trial(p_user uuid, p_start timestamptz, p_end timestamptz, p_granted integer)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare n integer;
begin
  update public.spark_allowances
    set period_end = greatest(period_start, now())
    where user_id = p_user and kind = 'plan' and ref = 'monthly' and period_start <= now() and period_end > now();
  insert into public.spark_allowances (user_id, kind, granted, period_start, period_end, ref)
  values (p_user, 'trial', greatest(p_granted, 0), p_start, p_end, 'trial')
  on conflict (user_id, kind, period_start) do nothing;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

-- Grant the trial. The caller (the server route) has already checked the sign-in is verified and normalised the email.
-- Returns {status}: billing_off, already_entitled, daily_cap, already_claimed, granted.
create or replace function public.trial_claim(p_user uuid, p_email_key text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_days integer;
  v_end timestamptz;
  v_cap integer;
  v_n integer;
  v_sparks integer;
  v_ent public.user_entitlements%rowtype;
begin
  if p_email_key is null or length(p_email_key) < 3 then return jsonb_build_object('status', 'invalid_email'); end if;
  if not public.billing_enabled() then return jsonb_build_object('status', 'billing_off'); end if;
  perform pg_advisory_xact_lock(hashtextextended('trial:' || p_user::text, 0));

  select * into v_ent from public.user_entitlements where user_id = p_user;
  if found and v_ent.source <> 'default' and (
       (v_ent.status = 'active' and (v_ent.current_period_end is null or v_ent.current_period_end > now()))
    or (v_ent.status = 'trialing' and (v_ent.trial_ends_at is null or v_ent.trial_ends_at > now()))
    or v_ent.status in ('canceled', 'past_due', 'paused')
  ) then
    return jsonb_build_object('status', 'already_entitled');
  end if;

  select coalesce((value ->> 'dailyCap')::integer, 200) into v_cap from public.platform_settings where key = 'trial_limits';
  select count(*) into v_n from public.trial_claims where claimed_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  if v_n >= coalesce(v_cap, 200) then return jsonb_build_object('status', 'daily_cap'); end if;

  insert into public.trial_claims (email_key, user_id) values (p_email_key, p_user) on conflict (email_key) do nothing;
  get diagnostics v_n = row_count;
  if v_n = 0 then return jsonb_build_object('status', 'already_claimed'); end if;

  select trial_days, coalesce((limits ->> 'sparks_per_month')::integer, 0) into v_days, v_sparks from public.plans where key = 'plus_trial';
  v_end := now() + make_interval(days => coalesce(v_days, 14));
  insert into public.user_entitlements (user_id, plan_key, status, source, trial_ends_at, current_period_end, note)
  values (p_user, 'plus_trial', 'trialing', 'default', v_end, null, 'S6: 14-day trial')
  on conflict (user_id) do update
    set plan_key = 'plus_trial', status = 'trialing', source = 'default', trial_ends_at = v_end, current_period_end = null,
        canceled_at = null, note = 'S6: 14-day trial', updated_at = now();
  perform public.spark_open_trial(p_user, now(), v_end, v_sparks);
  return jsonb_build_object('status', 'granted', 'trial_ends_at', v_end);
end;
$$;

-- Trials granted per day, for the admin portal.
create or replace function public.admin_trial_grants_daily(p_days integer default 30)
returns table (day date, granted bigint)
language sql
stable
security definer
set search_path to 'public'
as $$
  select (claimed_at at time zone 'UTC')::date as day, count(*) as granted
  from public.trial_claims
  where claimed_at >= now() - make_interval(days => greatest(p_days, 1))
  group by 1 order by 1 desc
$$;

revoke all on function public.spark_open_trial(uuid, timestamptz, timestamptz, integer), public.trial_claim(uuid, text),
  public.admin_trial_grants_daily(integer) from public, anon, authenticated;
grant execute on function public.spark_open_trial(uuid, timestamptz, timestamptz, integer), public.trial_claim(uuid, text),
  public.admin_trial_grants_daily(integer) to service_role;

-- Item 18: one tracked account = track_sms, not cash, not deleted or closed, no parent (cards come with their account).
-- The default becomes false: the client always sends true on a save, the trigger below decides. It stores false at the
-- cap and never raises, so a save is never blocked. Existing rows are untouched.
alter table public.payment_methods alter column track_sms set default false;

create or replace function public.payment_methods_sms_cap()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_max numeric;
  v_count integer;
begin
  if new.track_sms is not true then return new; end if;
  if tg_op = 'UPDATE' and old.track_sms is true then return new; end if;
  if new.parent_id is not null or new.type = 'cash' or new.deleted_at is not null or new.closed_at is not null then return new; end if;
  if not public.billing_enabled() then return new; end if;
  v_max := (public.ai_effective_limits(new.user_id) ->> 'sms_accounts_max')::numeric;
  if v_max is null then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('smscap:' || new.user_id::text, 0));
  select count(*) into v_count from public.payment_methods p
    where p.user_id = new.user_id and p.id <> new.id and p.track_sms and p.type <> 'cash'
      and p.deleted_at is null and p.closed_at is null and p.parent_id is null;
  if v_count >= v_max then new.track_sms := false; end if;
  return new;
end;
$$;
revoke all on function public.payment_methods_sms_cap() from public, anon, authenticated;
create trigger payment_methods_sms_cap before insert or update on public.payment_methods
  for each row execute function public.payment_methods_sms_cap();

-- Item 18 (last sentence) and item 27: the time a user first turned SMS on. Set by the server, never by the client.
alter table public.user_settings add column if not exists sms_first_enabled_at timestamptz;
update public.user_settings us
  set sms_first_enabled_at = coalesce((select min(t.created_at) from public.sms_ingest_tokens t where t.user_id = us.user_id), us.updated_at)
  where us.sms_tracking_enabled is true and us.sms_first_enabled_at is null;

create or replace function public.user_settings_sms_first_on()
returns trigger
language plpgsql
as $$
begin
  new.sms_first_enabled_at := case when tg_op = 'UPDATE' then old.sms_first_enabled_at else null end;
  if new.sms_first_enabled_at is null and new.sms_tracking_enabled is true then new.sms_first_enabled_at := now(); end if;
  return new;
end;
$$;
create trigger user_settings_sms_first_on before insert or update on public.user_settings
  for each row execute function public.user_settings_sms_first_on();
