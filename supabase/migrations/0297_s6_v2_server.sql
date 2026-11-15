-- S6 v2 designs: the server pieces the approved boards need (docs/launch/S6-design-board.md).
-- A rejected founder candidate cannot be proposed again: loyalty_grant_founders already skips any existing candidate row.

alter table public.founders
  add column if not exists credit_name_requested text,
  add column if not exists credit_name_status text not null default 'none' check (credit_name_status in ('none', 'pending', 'approved', 'rejected'));
update public.founders set credit_name_status = 'approved' where credit_name is not null and credit_name_status = 'none';

-- The next number an approval would issue; null when all are issued or the program has no window.
create or replace function public.loyalty_next_founder_number()
returns smallint
language sql
stable
security definer
set search_path to 'public'
as $$
  select case when p.founder_cap is null then null
              when coalesce((select max(number) from public.founders), 0) + 1 > p.founder_cap then null
              else (coalesce((select max(number) from public.founders), 0) + 1)::smallint end
  from (select (select founder_cap from public.loyalty_program limit 1) as founder_cap) p
$$;

-- A founder asks for a display name on the credits list; it shows only after an admin approves it.
create or replace function public.loyalty_request_credit_name(p_name text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  u uuid := auth.uid();
  v_name text := nullif(left(btrim(coalesce(p_name, '')), 60), '');
begin
  if u is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.founders where user_id = u and retired_at is null) then return 'not_founder'; end if;
  if v_name is null then
    update public.founders set credit_name_requested = null, credit_name_status = 'none', credit_name = null where user_id = u;
    return 'cleared';
  end if;
  update public.founders set credit_name_requested = v_name, credit_name_status = 'pending', credit_name = null where user_id = u;
  return 'pending';
end;
$$;

create or replace function public.loyalty_decide_credit_name(p_user uuid, p_approve boolean)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare f public.founders%rowtype;
begin
  select * into f from public.founders where user_id = p_user for update;
  if not found or f.credit_name_status <> 'pending' then raise exception 'not_pending'; end if;
  if p_approve then
    update public.founders set credit_name = credit_name_requested, credit_name_status = 'approved' where user_id = p_user;
    return 'approved';
  end if;
  update public.founders set credit_name_status = 'rejected' where user_id = p_user;
  return 'rejected';
end;
$$;

-- The credits list: founder numbers, with a name only where one was approved. Founders and beta testers may read it.
create or replace function public.loyalty_credits()
returns table (number smallint, credit_name text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select f.number, case when f.credit_name_status = 'approved' then f.credit_name end
  from public.founders f
  where f.retired_at is null
    and (exists (select 1 from public.founders me where me.user_id = auth.uid()) or exists (select 1 from public.beta_testers b where b.user_id = auth.uid()))
  order by f.number
$$;

-- What the weekly check sheet shows, computed on the server from the same rules as loyalty_record_week_check.
create or replace function public.loyalty_week_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  u uuid := auth.uid();
  v_tz text;
  v_wsd smallint;
  v_today date;
  v_this date;
  v_last date;
  v_acc public.loyalty_accounts%rowtype;
begin
  if u is null then raise exception 'not_authenticated'; end if;
  select timezone, week_start_day into v_tz, v_wsd from public.user_settings where user_id = u;
  v_today := public.loyalty_local_day(now(), v_tz);
  v_this := public.loyalty_week_start(v_today, v_wsd);
  v_last := v_this - 7;
  select * into v_acc from public.loyalty_accounts where user_id = u;
  return jsonb_build_object(
    'thisWeek', v_this, 'lastWeek', v_last,
    'lastWeekOpen', v_today <= v_this + 2,
    'thisWeekKept', coalesce(v_acc.last_kept_week = v_this::text, false),
    'lastWeekKept', coalesce(v_acc.last_kept_week = v_last::text, false),
    'unconfirmedThisWeek', (select count(*) from public.sms_parse_log l where l.user_id = u and l.awaiting_confirmation and public.loyalty_local_day(l.created_at, v_tz) between v_this and v_this + 6),
    'unconfirmedLastWeek', (select count(*) from public.sms_parse_log l where l.user_id = u and l.awaiting_confirmation and public.loyalty_local_day(l.created_at, v_tz) between v_last and v_last + 6),
    'streakWeeks', coalesce(v_acc.streak_weeks, 0), 'freezesBanked', coalesce(v_acc.freezes_banked, 0), 'keptWeeksTotal', coalesce(v_acc.kept_weeks_total, 0)
  );
end;
$$;

-- Admin counts: trials granted and paywall views per day, with paywall views by country.
create or replace function public.admin_billing_counts(p_days integer default 30)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'trialsPerDay', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'count', granted) order by day desc) from public.admin_trial_grants_daily(p_days)), '[]'::jsonb),
    'paywallViewsPerDay', coalesce((select jsonb_agg(jsonb_build_object('day', d, 'count', c) order by d desc) from (select (viewed_at at time zone 'UTC')::date d, count(*) c from public.paywall_views where viewed_at >= now() - make_interval(days => greatest(p_days, 1)) group by 1) q), '[]'::jsonb),
    'paywallViewsByCountry', coalesce((select jsonb_agg(jsonb_build_object('country', coalesce(country, 'unknown'), 'count', c) order by c desc) from (select country, count(*) c from public.paywall_views where viewed_at >= now() - make_interval(days => greatest(p_days, 1)) group by 1) q), '[]'::jsonb)
  )
$$;

revoke all on function public.loyalty_next_founder_number(), public.loyalty_decide_credit_name(uuid, boolean), public.admin_billing_counts(integer) from public, anon, authenticated;
grant execute on function public.loyalty_next_founder_number(), public.loyalty_decide_credit_name(uuid, boolean), public.admin_billing_counts(integer) to service_role;
revoke all on function public.loyalty_request_credit_name(text), public.loyalty_credits(), public.loyalty_week_summary() from public, anon;
grant execute on function public.loyalty_request_credit_name(text), public.loyalty_credits(), public.loyalty_week_summary() to authenticated, service_role;
