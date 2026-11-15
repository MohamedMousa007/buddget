-- S6 phase 5 (S5c section 14, items 19 to 26; S5b sections 5 and 8). Tiers stay off (rows seeded as draft). The founder window
-- is not opened here: loyalty_program has no row until the launch migration writes one, so the nightly job proposes nobody.
-- Checked before writing (live, 2026-11-15): loyalty_accounts, loyalty_ledger and loyalty_tiers are empty; 4 active staff.

-- Item 19: an SMS item the user confirmed needs a server-set time. The confirm route stamps it.
alter table public.sms_parse_log add column if not exists user_confirmed_at timestamptz;

create or replace function public.loyalty_local_day(p_ts timestamptz, p_tz text)
returns date
language plpgsql
stable
set search_path to 'public'
as $$
begin
  return (p_ts at time zone coalesce(nullif(p_tz, ''), 'UTC'))::date;
exception when others then
  return (p_ts at time zone 'UTC')::date;
end;
$$;

create or replace function public.loyalty_week_start(p_day date, p_week_start smallint)
returns date
language sql
immutable
as $$ select p_day - ((extract(dow from p_day)::int - coalesce(p_week_start, 1) + 7) % 7) $$;

-- Item 19: an active day is a day, in the user's timezone, with a server-observed user action: a record created or edited by
-- hand (server-set updated_at; SMS-written, recurring, subscription, template-generated and auto-saved rows are left out),
-- an SMS item the user confirmed, or a finished weekly check. analytics_touch rows never count.
create view public.loyalty_action_days as
  select e.user_id, public.loyalty_local_day(e.updated_at, us.timezone) as day, 'expense'::text as source
    from public.expenses e left join public.user_settings us on us.user_id = e.user_id
    where e.deleted_at is null and e.sms_log_id is null and not coalesce(e.is_recurring, false) and e.linked_subscription_id is null
  union all
  select i.user_id, public.loyalty_local_day(i.updated_at, us.timezone), 'income'
    from public.income_events i left join public.user_settings us on us.user_id = i.user_id
    where i.deleted_at is null and i.sms_log_id is null and i.template_id is null
  union all
  select s.user_id, public.loyalty_local_day(s.updated_at, us.timezone), 'savings'
    from public.savings_transactions s left join public.user_settings us on us.user_id = s.user_id
    where s.deleted_at is null and s.source is null and not coalesce(s.is_auto_save, false)
  union all
  select l.user_id, public.loyalty_local_day(l.user_confirmed_at, us.timezone), 'sms_confirmed'
    from public.sms_parse_log l left join public.user_settings us on us.user_id = l.user_id
    where l.user_confirmed_at is not null;
revoke all on public.loyalty_action_days from anon, authenticated;
grant select on public.loyalty_action_days to service_role;

create table public.loyalty_program (
  id boolean primary key default true check (id),
  founder_window_opens timestamptz not null,
  founder_window_closes timestamptz not null,
  founder_cap smallint not null default 100
);
alter table public.loyalty_program enable row level security;
revoke all on public.loyalty_program from anon, authenticated;
grant all on public.loyalty_program to service_role;

create table public.founders (
  number smallint primary key check (number between 1 and 100),
  user_id uuid unique references auth.users (id) on delete set null,
  cohort text not null check (cohort in ('beta', 'public')),
  qualified_at timestamptz not null,
  granted_at timestamptz not null default now(),
  credit_name text,
  retired_at timestamptz,
  retired_reason text check (retired_reason in ('deleted', 'duplicate', 'fraud'))
);
create table public.founder_candidates (
  user_id uuid primary key references auth.users (id) on delete cascade,
  qualified_at timestamptz not null,
  proposed_at timestamptz not null default now(),
  decided_at timestamptz,
  decision text check (decision in ('approved', 'rejected')),
  decided_by uuid
);
create table public.beta_testers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_at timestamptz not null default now()
);
create table public.loyalty_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('week_kept', 'week_frozen', 'week_check_abandoned', 'budget_set', 'month_tracked', 'founder_granted', 'review_prompt')),
  period_key text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index loyalty_events_once_uidx on public.loyalty_events (user_id, kind, period_key)
  where kind in ('week_kept', 'week_frozen', 'budget_set', 'month_tracked', 'founder_granted');

alter table public.founders enable row level security;
alter table public.founder_candidates enable row level security;
alter table public.beta_testers enable row level security;
alter table public.loyalty_events enable row level security;
alter table public.loyalty_accounts enable row level security;
alter table public.loyalty_ledger enable row level security;
alter table public.loyalty_tiers enable row level security;
create policy founders_own on public.founders for select to authenticated using (user_id = (select auth.uid()));
create policy beta_testers_own on public.beta_testers for select to authenticated using (user_id = (select auth.uid()));
create policy loyalty_events_own on public.loyalty_events for select to authenticated using (user_id = (select auth.uid()));
create policy loyalty_accounts_own on public.loyalty_accounts for select to authenticated using (user_id = (select auth.uid()));
create policy loyalty_ledger_own on public.loyalty_ledger for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.founders, public.founder_candidates, public.beta_testers, public.loyalty_events, public.loyalty_accounts, public.loyalty_ledger, public.loyalty_tiers from anon, authenticated;
grant select on public.founders, public.beta_testers, public.loyalty_events, public.loyalty_accounts, public.loyalty_ledger to authenticated;
grant all on public.founders, public.founder_candidates, public.beta_testers, public.loyalty_events, public.loyalty_accounts, public.loyalty_ledger, public.loyalty_tiers to service_role;
revoke all on sequence public.loyalty_ledger_id_seq from anon, authenticated;

alter table public.loyalty_accounts
  add column if not exists streak_weeks integer not null default 0,
  add column if not exists streak_best integer not null default 0,
  add column if not exists freezes_banked smallint not null default 0 check (freezes_banked between 0 and 2),
  add column if not exists kept_weeks_total integer not null default 0,
  add column if not exists last_kept_week text;
create unique index if not exists loyalty_ledger_earn_once_uidx on public.loyalty_ledger (user_id, reason, ref) where actor_id is null and ref is not null;

-- Tiers stay off: seeded as draft, so admin_adjust_loyalty_points and loyalty_award assign nobody a tier.
insert into public.loyalty_tiers (key, name, description, min_points, status, sort_order) values
  ('seed', 'Seed', 'Everyone starts here.', 0, 'draft', 0),
  ('sprout', 'Sprout', 'Placeholder threshold; set at switch-on.', 300, 'draft', 1),
  ('tree', 'Tree', 'Placeholder threshold; set at switch-on.', 1000, 'draft', 2)
on conflict (key) do nothing;

-- Item 26: the Beta tester badge, granted to every account that exists now except staff. Never a reward for testing.
insert into public.beta_testers (user_id)
select u.id from auth.users u where not exists (select 1 from public.admin_staff s where s.user_id = u.id)
on conflict (user_id) do nothing;

-- Earn rows (S5b 8.7): the same body as admin_adjust_loyalty_points, plus the ref that makes an event pay once.
create or replace function public.loyalty_award(p_user uuid, p_points integer, p_reason text, p_ref text)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_acc public.loyalty_accounts%rowtype;
  v_lifetime integer;
  v_tier text;
  v_n integer;
begin
  if p_points <= 0 then return 0; end if;
  insert into public.loyalty_ledger (user_id, delta, reason, ref, actor_id) values (p_user, p_points, left(p_reason, 200), p_ref, null)
  on conflict (user_id, reason, ref) where actor_id is null and ref is not null do nothing;
  get diagnostics v_n = row_count;
  if v_n = 0 then return 0; end if;
  insert into public.loyalty_accounts (user_id) values (p_user) on conflict (user_id) do nothing;
  select * into v_acc from public.loyalty_accounts where user_id = p_user for update;
  v_lifetime := v_acc.lifetime_points + p_points;
  if v_acc.tier_locked then
    v_tier := v_acc.tier_key;
  else
    select t.key into v_tier from public.loyalty_tiers t where t.status = 'active' and t.min_points <= v_lifetime order by t.min_points desc limit 1;
  end if;
  update public.loyalty_accounts set points_balance = points_balance + p_points, lifetime_points = v_lifetime, tier_key = v_tier, updated_at = now() where user_id = p_user;
  return p_points;
end;
$$;

-- Item 19, 21: who is on the founder bar (S5b 2.1): 7 action days on at least 2 calendar weeks, staff excluded. qualified_at = the 7th action day.
create or replace function public.loyalty_founder_bar()
returns table (user_id uuid, qualified_at timestamptz, action_days integer, weeks integer)
language sql
stable
security definer
set search_path to 'public'
as $$
  with d as (select distinct a.user_id, a.day from public.loyalty_action_days a),
  ranked as (select d.user_id, d.day, row_number() over (partition by d.user_id order by d.day) rn, date_trunc('week', d.day::timestamp) wk from d)
  select r.user_id,
         (min(r.day) filter (where r.rn = 7))::timestamptz,
         count(*)::integer,
         count(distinct r.wk)::integer
  from ranked r
  where not exists (select 1 from public.admin_staff s where s.user_id = r.user_id)
  group by r.user_id
  having count(*) >= 7 and count(distinct r.wk) >= 2
$$;

-- Item 20: the nightly job proposes; it never issues a number.
create or replace function public.loyalty_grant_founders()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  p public.loyalty_program%rowtype;
  n integer;
begin
  select * into p from public.loyalty_program;
  if not found or now() < p.founder_window_opens or now() > p.founder_window_closes then return 0; end if;
  perform pg_advisory_xact_lock(hashtextextended('founders', 0));
  if (select count(*) from public.founders) >= p.founder_cap then return 0; end if;
  insert into public.founder_candidates (user_id, qualified_at)
  select b.user_id, b.qualified_at from public.loyalty_founder_bar() b
  where exists (select 1 from public.loyalty_action_days a where a.user_id = b.user_id and a.day >= p.founder_window_opens::date)
    and not exists (select 1 from public.founders f where f.user_id = b.user_id)
  on conflict (user_id) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Item 20: one admin action per account, in approval order. A number is never reissued (deleted users keep theirs with a null user).
create or replace function public.loyalty_decide_founder(p_user uuid, p_actor uuid, p_approve boolean, p_credit_name text default null)
returns smallint
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  p public.loyalty_program%rowtype;
  c public.founder_candidates%rowtype;
  v_number smallint;
begin
  perform pg_advisory_xact_lock(hashtextextended('founders', 0));
  select * into c from public.founder_candidates where user_id = p_user for update;
  if not found or c.decision is not null then raise exception 'not_pending'; end if;
  if not p_approve then
    update public.founder_candidates set decision = 'rejected', decided_at = now(), decided_by = p_actor where user_id = p_user;
    return null;
  end if;
  select * into p from public.loyalty_program;
  if not found then raise exception 'program_closed'; end if;
  if exists (select 1 from public.admin_staff s where s.user_id = p_user) then raise exception 'staff'; end if;
  select coalesce(max(number), 0) + 1 into v_number from public.founders;
  if v_number > p.founder_cap then raise exception 'cap_reached'; end if;
  insert into public.founders (number, user_id, cohort, qualified_at, credit_name)
  values (v_number, p_user, case when exists (select 1 from public.beta_testers b where b.user_id = p_user) then 'beta' else 'public' end, c.qualified_at, nullif(left(btrim(coalesce(p_credit_name, '')), 60), ''));
  update public.founder_candidates set decision = 'approved', decided_at = now(), decided_by = p_actor where user_id = p_user;
  insert into public.loyalty_events (user_id, kind, period_key, meta) values (p_user, 'founder_granted', v_number::text, '{}'::jsonb) on conflict do nothing;
  return v_number;
end;
$$;

-- Item 20: what the admin sees per candidate (sign-in method, creation date, action days, record count, whether SMS is on).
create or replace function public.admin_founder_candidates()
returns table (user_id uuid, qualified_at timestamptz, proposed_at timestamptz, provider text, account_created timestamptz, action_days integer, record_count integer, sms_on boolean)
language sql
stable
security definer
set search_path to 'public'
as $$
  select c.user_id, c.qualified_at, c.proposed_at,
         coalesce(u.raw_app_meta_data ->> 'provider', 'unknown'),
         u.created_at,
         (select count(distinct a.day)::integer from public.loyalty_action_days a where a.user_id = c.user_id),
         (select count(*)::integer from public.loyalty_action_days a where a.user_id = c.user_id and a.source in ('expense', 'income', 'savings', 'sms_confirmed')),
         coalesce((select us.sms_tracking_enabled from public.user_settings us where us.user_id = c.user_id), false)
  from public.founder_candidates c join auth.users u on u.id = c.user_id
  where c.decision is null
  order by c.qualified_at, u.created_at
$$;

-- Item 22: the weekly check. The server derives the week from the user's settings; the argument is only checked against it.
create or replace function public.loyalty_record_week_check(p_week text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  u uuid := auth.uid();
  v_tz text;
  v_wsd smallint;
  v_today date;
  v_this date;
  v_w date;
  v_acc public.loyalty_accounts%rowtype;
  v_has_record boolean;
  v_gap integer;
  v_streak integer;
  v_freezes smallint;
  v_total integer;
  v_event bigint;
  v_points integer := 0;
  i integer;
begin
  if u is null then raise exception 'not_authenticated'; end if;
  begin v_w := p_week::date; exception when others then return jsonb_build_object('status', 'invalid_week'); end;
  select timezone, week_start_day into v_tz, v_wsd from public.user_settings where user_id = u;
  v_today := public.loyalty_local_day(now(), v_tz);
  v_this := public.loyalty_week_start(v_today, v_wsd);
  if v_w <> v_this and not (v_w = v_this - 7 and v_today <= v_this + 2) then return jsonb_build_object('status', 'out_of_window'); end if;

  insert into public.loyalty_accounts (user_id) values (u) on conflict (user_id) do nothing;
  select * into v_acc from public.loyalty_accounts where user_id = u for update;
  if v_acc.last_kept_week is not null and (v_w - v_acc.last_kept_week::date) < 5 then
    return jsonb_build_object('status', case when v_acc.last_kept_week::date = v_w then 'already_kept' else 'too_soon' end);
  end if;
  if exists (select 1 from public.sms_parse_log l where l.user_id = u and l.awaiting_confirmation
             and public.loyalty_local_day(l.created_at, v_tz) between v_w and v_w + 6) then
    return jsonb_build_object('status', 'unconfirmed_items');
  end if;

  v_has_record := exists (select 1 from public.expenses e where e.user_id = u and e.deleted_at is null and e.expense_date between v_w and v_w + 6)
    or exists (select 1 from public.income_events x where x.user_id = u and x.deleted_at is null and x.received_date between v_w and v_w + 6)
    or exists (select 1 from public.savings_transactions s where s.user_id = u and s.deleted_at is null and s.transaction_date between v_w and v_w + 6);

  insert into public.loyalty_events (user_id, kind, period_key, meta) values (u, 'week_kept', v_w::text, jsonb_build_object('has_record', v_has_record))
  on conflict do nothing returning id into v_event;
  if v_event is null then return jsonb_build_object('status', 'already_kept'); end if;

  v_freezes := v_acc.freezes_banked;
  if v_acc.last_kept_week is null then
    v_streak := 1;
  else
    v_gap := ((v_w - v_acc.last_kept_week::date) / 7) - 1;
    if v_gap <= 0 then v_streak := v_acc.streak_weeks + 1;
    elsif v_gap <= v_freezes then
      for i in 1..v_gap loop
        insert into public.loyalty_events (user_id, kind, period_key) values (u, 'week_frozen', (v_acc.last_kept_week::date + 7 * i)::text) on conflict do nothing;
      end loop;
      v_freezes := v_freezes - v_gap;
      v_streak := v_acc.streak_weeks + 1;
    else v_streak := 1;
    end if;
  end if;
  v_total := v_acc.kept_weeks_total + 1;
  if v_total % 8 = 0 then v_freezes := least(2, v_freezes + 1); end if;
  update public.loyalty_accounts
    set streak_weeks = v_streak, streak_best = greatest(streak_best, v_streak), freezes_banked = v_freezes, kept_weeks_total = v_total, last_kept_week = v_w::text, updated_at = now()
    where user_id = u;
  -- A week with no record keeps the streak and pays nothing.
  if v_has_record then v_points := public.loyalty_award(u, 10, 'week_kept', v_event::text); end if;
  return jsonb_build_object('status', 'kept', 'streak', v_streak, 'points', v_points, 'freezes', v_freezes);
end;
$$;

-- Item 23: the nightly close. budget_set (10 points) once per cycle if a budget is active for it by day 7 and the user created,
-- activated or edited it in that cycle or the one before; month_tracked (40) when a budget_set cycle has ended with at least 3
-- kept weeks (a freeze counts) and nothing in it still unconfirmed. Cycles follow the user's month start day.
create or replace function public.loyalty_close_periods()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  r record;
  v_today date;
  v_start date;
  v_prev date;
  v_key text;
  v_active boolean;
  v_touched boolean;
  v_weeks integer;
  v_paid integer := 0;
  v_event bigint;
begin
  for r in select us.user_id, us.timezone tz, coalesce(us.month_start_day, 1) msd from public.user_settings us
           where exists (select 1 from public.budget_plan_activations b where b.user_id = us.user_id and b.deleted_at is null) loop
    v_today := public.loyalty_local_day(now(), r.tz);
    v_start := make_date(extract(year from v_today)::int, extract(month from v_today)::int, least(r.msd, 28));
    if v_start > v_today then v_start := (v_start - interval '1 month')::date; end if;
    v_prev := (v_start - interval '1 month')::date;
    if v_today >= v_start + 7 then
      v_key := to_char(v_start, 'YYYY-MM');
      v_active := exists (select 1 from public.budget_plan_activations b where b.user_id = r.user_id and b.deleted_at is null and b.effective_from <= v_start + 6);
      v_touched := exists (select 1 from public.budget_plan_activations b where b.user_id = r.user_id and b.deleted_at is null
                           and public.loyalty_local_day(greatest(b.created_at, coalesce(b.edited_at, b.created_at)), r.tz) between v_prev and v_start + 27);
      if v_active and v_touched then
        v_event := null;
        insert into public.loyalty_events (user_id, kind, period_key) values (r.user_id, 'budget_set', v_key) on conflict do nothing returning id into v_event;
        if v_event is not null then v_paid := v_paid + public.loyalty_award(r.user_id, 10, 'budget_set', v_event::text); end if;
      end if;
    end if;
    v_key := to_char(v_prev, 'YYYY-MM');
    if exists (select 1 from public.loyalty_events e where e.user_id = r.user_id and e.kind = 'budget_set' and e.period_key = v_key) then
      select count(*) into v_weeks from public.loyalty_events e
        where e.user_id = r.user_id and e.kind in ('week_kept', 'week_frozen') and e.period_key::date >= v_prev and e.period_key::date < v_start;
      if v_weeks >= 3 and not exists (select 1 from public.sms_parse_log l where l.user_id = r.user_id and l.awaiting_confirmation
                                      and public.loyalty_local_day(l.created_at, r.tz) >= v_prev and public.loyalty_local_day(l.created_at, r.tz) < v_start) then
        v_event := null;
        insert into public.loyalty_events (user_id, kind, period_key) values (r.user_id, 'month_tracked', v_key) on conflict do nothing returning id into v_event;
        if v_event is not null then v_paid := v_paid + public.loyalty_award(r.user_id, 40, 'month_tracked', v_event::text); end if;
      end if;
    end if;
  end loop;
  return v_paid;
end;
$$;

revoke all on function public.loyalty_award(uuid, integer, text, text), public.loyalty_founder_bar(), public.loyalty_grant_founders(),
  public.loyalty_decide_founder(uuid, uuid, boolean, text), public.admin_founder_candidates(), public.loyalty_close_periods(),
  public.loyalty_local_day(timestamptz, text), public.loyalty_week_start(date, smallint) from public, anon, authenticated;
grant execute on function public.loyalty_award(uuid, integer, text, text), public.loyalty_founder_bar(), public.loyalty_grant_founders(),
  public.loyalty_decide_founder(uuid, uuid, boolean, text), public.admin_founder_candidates(), public.loyalty_close_periods(),
  public.loyalty_local_day(timestamptz, text), public.loyalty_week_start(date, smallint) to service_role;
revoke all on function public.loyalty_record_week_check(text) from public, anon;
grant execute on function public.loyalty_record_week_check(text) to authenticated, service_role;
