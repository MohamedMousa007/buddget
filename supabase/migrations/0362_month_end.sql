-- 0362_month_end.sql  (LOGIC_SPEC v2 §3.1, §3.2 P6, §4.4, I-7, I-9, I-12)
-- PURPOSE
--   The month-end card. One savings_month_summary row per (user, cycle) holds the proposal, its apply and its undo:
--     profiles.savings_split jsonb      [{target_id, pct}], Σ ≤ 100 (checked by the only writer, POST /api/month-end
--                                       op 'split'); the rest goes to Monthly savings. Server-written: profileToRow
--                                       never sends it, so a stale phone cannot overwrite it.
--     savings_month_summary + status ('legacy' | 'empty' | 'proposed' | 'applied' | 'undone'), version (CAS, I-9),
--       cycle_start / cycle_end, rates (C.rates, base per unit) / rates_apply, figures, lines (proposal),
--       applied_lines, capped, held_snapshot, auto_apply_at, applied_at, applied_by ('user' | 'auto'), undone_at,
--       achieved_by_proposal. Existing rows read 'legacy' (column default, no UPDATE, updated_at untouched).
--     month_key of a new row = its cycle_start 'YYYY-MM-DD' (legacy rows keep 'YYYY-MM'): after a start-day change two
--       cycles can start in one month (T35), and the unique (user_id, month_key) must tell them apart.
--   RPCs (SECURITY DEFINER, service_role only; every one filters on p_user and checks ownership of what it touches):
--     month_end_due_users(p_after, p_limit, p_user)  keyset over user_settings_pkey: users whose next cycle has ended
--       with no row for it (anti-join on savings_month_summary_user_month_key). Scans at most 2,000 users per call
--       and returns next_after so the cron continues; p_user = one user's state (the route), due or not.
--     month_end_ledger(p_user, p_cycle_start)         one round trip: accounts, live parts, goals, debts, and every
--       ledger row dated on or after the floor = the day before the earliest base (latest anchor before the cycle,
--       else the opening) of any tracked account, plus the whole history of the user's credit cards and card plans
--       (owed(c) sums it, §4.1); held aggregates; the latest 6 summaries. Each list is capped at 20,000 rows and
--       `truncated` is set if one hits it (the caller then proposes nothing).
--     apply_month_end(...)  one transaction: summary FOR UPDATE, CAS on status + version ('conflict'); every live part
--       in the touched accounts FOR UPDATE and held per account compared with p_held ('stale': a label landed since);
--       new parts INSERT … ON CONFLICT (id) (ids are partId(); the 0355 partial indexes skip tombstones, so they
--       cannot be the conflict target); month_end labels through label_part, key md5(id:part)::uuid; goals the TS
--       flagged as completing → achieved (updated_at only) and listed in achieved_by_proposal.
--     undo_month_end(p_user, p_id)  one transaction: only while 'applied' and no spent / move_out label landed on an
--       applied part after the apply (N3, 'blocked'; also 'close'. 'release' does not block: T34 undoes after one); buddget.month_end_undo = '1' (transaction-local) so 0357 lets
--       the completions it caused go back to 'active' (edited_at = now(), so an older device copy cannot re-push
--       'achieved'); month_end_undo labels of min(amount, part balance), key md5(id:part:undo)::uuid; status 'undone'.
--   Server writes to synced tables (parts, labels, goals) never run inside a client sync batch.
--   No new synced table: sync and a0 trigger lists unchanged. savings_month_summary stays select-only for
--   authenticated (0316).
--
-- BEFORE-COUNTS (_checks/p6_counts.sql, section 0362; expected in brackets)
--   savings_month_summary rows [small, all legacy]; legacy rows by month_key [last ~3 months]; user_settings rows;
--   user_settings rows with an invalid timezone [0; sms_safe_tz falls back to Cairo]; columns already present [0].
--
-- EXPECTED ROWS TOUCHED
--   None (columns with constant defaults are metadata-only; functions and indexes only).
--
-- EXPLAIN (without ANALYZE, on live, after applying; _checks/p6_counts.sql section AFTER)
--   month_end_due_users: Limit → Nested Loop over Index Scan using user_settings_pkey (user_id > p_after), with
--     savings_month_summary probed by Index Scan using savings_month_summary_user_month_key. No Seq Scan on
--     savings_month_summary.
--   month_end_ledger: each list is an Index Scan on its live user index (idx_expenses_live, idx_income_events_user_received,
--     idx_savings_transactions_live, idx_debt_payments_live, idx_account_adjustments_pm, idx_savings_accounts_live,
--     idx_goals_live, idx_debts_live, idx_payment_methods_live) filtered by date. Bound: one user's rows since the floor.
--   due proposals (cron, PostgREST): Index Scan using savings_month_summary_due_idx.
--
-- ROLLBACK
--   drop function if exists public.undo_month_end(uuid, uuid);
--   drop function if exists public.apply_month_end(uuid, uuid, int, jsonb, jsonb, jsonb, jsonb, text);
--   drop function if exists public.month_end_ledger(uuid, date);
--   drop function if exists public.month_end_due_users(uuid, int, uuid);
--   drop function if exists private.month_boundary_after(date, int), private.month_boundary_at_or_before(date, int);
--   drop index if exists public.savings_month_summary_due_idx;
--   alter table public.savings_month_summary drop constraint if exists savings_month_summary_status_check,
--     drop constraint if exists savings_month_summary_applied_by_check,
--     drop column if exists status, drop column if exists version, drop column if exists cycle_start,
--     drop column if exists cycle_end, drop column if exists rates, drop column if exists rates_apply,
--     drop column if exists figures, drop column if exists lines, drop column if exists applied_lines,
--     drop column if exists capped, drop column if exists held_snapshot, drop column if exists auto_apply_at,
--     drop column if exists applied_at, drop column if exists applied_by, drop column if exists undone_at,
--     drop column if exists achieved_by_proposal;
--   alter table public.profiles drop constraint if exists profiles_savings_split_array, drop column if exists savings_split;
--   (Labels written by apply/undo stay; they are ordinary month_end / month_end_undo rows.)

-- 1. Columns ------------------------------------------------------------------------------------------------------
alter table public.profiles
  add column if not exists savings_split jsonb not null default '[]'::jsonb;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_savings_split_array') then
    alter table public.profiles add constraint profiles_savings_split_array check (jsonb_typeof(savings_split) = 'array');
  end if;
end $$;

alter table public.savings_month_summary
  add column if not exists status text not null default 'legacy',
  add column if not exists version int not null default 1,
  add column if not exists cycle_start date,
  add column if not exists cycle_end date,
  add column if not exists rates jsonb,
  add column if not exists rates_apply jsonb,
  add column if not exists figures jsonb,
  add column if not exists lines jsonb,
  add column if not exists applied_lines jsonb,
  add column if not exists capped jsonb,
  add column if not exists held_snapshot jsonb,
  add column if not exists auto_apply_at timestamptz,
  add column if not exists applied_at timestamptz,
  add column if not exists applied_by text,
  add column if not exists undone_at timestamptz,
  add column if not exists achieved_by_proposal uuid[] not null default '{}';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'savings_month_summary_status_check') then
    alter table public.savings_month_summary add constraint savings_month_summary_status_check
      check (status in ('legacy', 'empty', 'proposed', 'applied', 'undone'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'savings_month_summary_applied_by_check') then
    alter table public.savings_month_summary add constraint savings_month_summary_applied_by_check
      check (applied_by is null or applied_by in ('user', 'auto'));
  end if;
end $$;

-- 2. Indexes ------------------------------------------------------------------------------------------------------
create index if not exists savings_month_summary_due_idx
  on public.savings_month_summary (auto_apply_at) where status = 'proposed';

-- 3. Cycle boundaries (mirror src/lib/savings/carryDateLogic.ts; the caller clamps the day to 1-28) ---------------
create or replace function private.month_boundary_after(p date, p_day int)
 returns date language sql immutable set search_path to 'pg_temp'
as $$
  select case when make_date(extract(year from p)::int, extract(month from p)::int, p_day) > p
              then make_date(extract(year from p)::int, extract(month from p)::int, p_day)
              else (make_date(extract(year from p)::int, extract(month from p)::int, p_day) + interval '1 month')::date end
$$;
create or replace function private.month_boundary_at_or_before(p date, p_day int)
 returns date language sql immutable set search_path to 'pg_temp'
as $$
  select case when make_date(extract(year from p)::int, extract(month from p)::int, p_day) <= p
              then make_date(extract(year from p)::int, extract(month from p)::int, p_day)
              else (make_date(extract(year from p)::int, extract(month from p)::int, p_day) - interval '1 month')::date end
$$;
revoke all on function private.month_boundary_after(date, int), private.month_boundary_at_or_before(date, int) from public, anon, authenticated;

-- 4. month_end_due_users ------------------------------------------------------------------------------------------
-- Due = (a) the next cycle after the latest month-end row (nextCycle: [cycle_end, first boundary after it)) has
-- ended, or (b) with no month-end row yet, the newest ended standard cycle has no row (new or legacy key).
-- due_start / due_end name the cycle for (b); for (a) TypeScript's dueCycle picks the newest ended cycle after
-- latest_end, by the same test, so the two never disagree on whether a user is due.
create or replace function public.month_end_due_users(p_after uuid default null, p_limit int default 25, p_user uuid default null)
 returns jsonb
 language sql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
  with page as materialized (
    select us.user_id, us.month_start_day, us.timezone, us.language::text as language
    from public.user_settings us
    where (p_user is null or us.user_id = p_user)
      and (p_after is null or us.user_id > p_after)
    order by us.user_id
    limit case when p_user is null then 2000 else 1 end
  ), facts as (
    select p.user_id, p.language,
           least(28, greatest(1, coalesce(p.month_start_day, 1))) as d,
           public.sms_safe_tz(p.timezone) as tz,
           (now() at time zone public.sms_safe_tz(p.timezone))::date as today,
           l.cycle_start as latest_start, l.cycle_end as latest_end
    from page p
    left join lateral (
      select s.cycle_start, s.cycle_end from public.savings_month_summary s
      where s.user_id = p.user_id and s.cycle_end is not null order by s.cycle_end desc limit 1) l on true
  ), judged as (
    select f.*,
           private.month_boundary_at_or_before(f.today, f.d) as closed_end,
           (private.month_boundary_at_or_before(f.today, f.d) - interval '1 month')::date as closed_start
    from facts f
  ), due as (
    select j.*,
           case
             when j.latest_end is not null then private.month_boundary_after(j.latest_end, j.d) <= j.today
             else not exists (
               select 1 from public.savings_month_summary s
               where s.user_id = j.user_id
                 and s.month_key in (to_char(j.closed_start, 'YYYY-MM-DD'), to_char(j.closed_start, 'YYYY-MM')))
           end as is_due
    from judged j
  ), picked as (
    select * from due where p_user is not null or is_due order by user_id limit greatest(1, least(coalesce(p_limit, 25), 100))
  )
  select jsonb_build_object(
    'users', (select coalesce(jsonb_agg(jsonb_build_object(
                'user_id', x.user_id, 'month_start_day', x.d, 'timezone', x.tz, 'language', x.language, 'today', x.today,
                'latest_start', x.latest_start, 'latest_end', x.latest_end, 'due', x.is_due,
                'due_start', case when x.latest_end is null then x.closed_start end,
                'due_end', case when x.latest_end is null then x.closed_end end) order by x.user_id), '[]'::jsonb) from picked x),
    -- A full due list: continue after its last user (due users later in the window are never skipped). Otherwise the
    -- window's end when the 2,000-user window was full, else null (the scan is done).
    'next_after', case
      when (select count(*) from picked) >= greatest(1, least(coalesce(p_limit, 25), 100)) then (select max(user_id::text)::uuid from picked)
      when (select count(*) from page) >= 2000 then (select max(user_id::text)::uuid from page)
    end)
$function$;

-- 5. month_end_ledger ---------------------------------------------------------------------------------------------
create or replace function public.month_end_ledger(p_user uuid, p_cycle_start date)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_limit constant int := 20000;
  v_floor date;
  v_cards uuid[];
  v_card_debts uuid[];
  v_tz text;
  r jsonb;
begin
  if p_user is null or p_cycle_start is null then raise exception 'month_end_ledger: user and cycle start are required'; end if;
  select public.sms_safe_tz(us.timezone) into v_tz from public.user_settings us where us.user_id = p_user;
  v_tz := coalesce(v_tz, 'Africa/Cairo');

  -- The day before the earliest base any tracked account restarts from before the cycle.
  select least(p_cycle_start, coalesce(min(coalesce(a.at, (pm.opening_at at time zone v_tz)::date)), p_cycle_start)) - 1
    into v_floor
  from public.payment_methods pm
  left join lateral (
    select (max(j.occurred_at) at time zone v_tz)::date as at from public.account_adjustments j
    where j.user_id = p_user and j.payment_method_id = pm.id and j.deleted_at is null
      and j.anchor_balance is not null and j.occurred_at < p_cycle_start
  ) a on true
  where pm.user_id = p_user and pm.deleted_at is null and pm.opening_balance is not null;

  select coalesce(array_agg(id), '{}') into v_cards from public.payment_methods
    where user_id = p_user and type = 'credit_card';
  select coalesce(array_agg(id), '{}') into v_card_debts from public.debts
    where user_id = p_user and deleted_at is null and (debt_type = 'credit_card' or installment_provider = 'credit_card');

  select jsonb_build_object(
    'floor', v_floor,
    'profile', (select jsonb_build_object('base_currency', p.base_currency, 'created_at', p.created_at, 'savings_split', p.savings_split)
                from public.profiles p where p.id = p_user),
    'payment_methods', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from (
        select * from public.payment_methods where user_id = p_user and deleted_at is null limit 1000) x),
    'savings_accounts', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from (
        select * from public.savings_accounts where user_id = p_user and deleted_at is null limit 5000) x),
    'goals', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from (
        select * from public.goals where user_id = p_user and deleted_at is null limit 1000) x),
    'debts', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from (
        select * from public.debts where user_id = p_user and deleted_at is null limit 5000) x),
    'expenses', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from (
        select * from public.expenses
        where user_id = p_user and deleted_at is null
          and (expense_date >= v_floor or payment_method_id = any(v_cards) or linked_debt_id = any(v_card_debts))
        order by expense_date desc limit v_limit) x),
    'income_events', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from (
        select * from public.income_events
        where user_id = p_user and deleted_at is null and (received_date >= v_floor or occurrence_date >= v_floor)
        order by received_date desc limit v_limit) x),
    'debt_payments', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from (
        select * from public.debt_payments
        where user_id = p_user and deleted_at is null and (payment_date >= v_floor or debt_id = any(v_card_debts))
        order by payment_date desc limit v_limit) x),
    'savings_transactions', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from (
        select * from public.savings_transactions
        where user_id = p_user and deleted_at is null and transaction_date >= v_floor
        order by transaction_date desc limit v_limit) x),
    'account_adjustments', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from (
        select * from public.account_adjustments
        where user_id = p_user and deleted_at is null and occurred_at >= v_floor
        order by occurred_at desc limit v_limit) x),
    'held', (select coalesce(jsonb_agg(jsonb_build_object('held_in', h.held_in_payment_method_id, 'currency', h.currency, 'held', h.held)), '[]')
             from (select held_in_payment_method_id, currency, sum(current_balance) as held from public.savings_accounts
                   where user_id = p_user and deleted_at is null and held_in_payment_method_id is not null
                   group by held_in_payment_method_id, currency) h),
    'summaries', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from (
        select * from public.savings_month_summary where user_id = p_user order by created_at desc limit 6) x)
  ) into r;

  return r || jsonb_build_object('truncated',
    jsonb_array_length(r->'expenses') >= v_limit or jsonb_array_length(r->'income_events') >= v_limit
    or jsonb_array_length(r->'debt_payments') >= v_limit or jsonb_array_length(r->'savings_transactions') >= v_limit
    or jsonb_array_length(r->'account_adjustments') >= v_limit);
end $function$;

-- 6. apply_month_end ----------------------------------------------------------------------------------------------
-- p_lines: [{kind: 'goal'|'pocket'|'ms', target_id, part_id, account_id, currency, amount, amount_base, completes_goal}]
-- p_held:  {account_id: held} for every account the caller computed caps for (as it read them).
create or replace function public.apply_month_end(
  p_user uuid, p_id uuid, p_version int, p_lines jsonb, p_held jsonb, p_rates jsonb,
  p_capped jsonb default '[]'::jsonb, p_by text default 'user')
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  s public.savings_month_summary;
  l jsonb;
  v_part uuid;
  v_goal uuid;
  v_acc uuid;
  v_amount numeric;
  v_achieved uuid[] := '{}';
  v_complete uuid[] := '{}';
  v_today date;
  v_applied jsonb := '[]'::jsonb;
  v_accounts uuid[];
  k text;
  v_held numeric;
  src public.savings_accounts;
begin
  if p_user is null or p_id is null then raise exception 'apply_month_end: user and id are required'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_typeof(p_held) <> 'object' then raise exception 'apply_month_end: bad lines or held'; end if;
  if p_by not in ('user', 'auto') then raise exception 'apply_month_end: bad applied_by'; end if;

  select * into s from public.savings_month_summary where id = p_id and user_id = p_user for update;
  if not found then return jsonb_build_object('outcome', 'not_found'); end if;
  if s.status <> 'proposed' or s.version <> p_version then
    return jsonb_build_object('outcome', 'conflict', 'status', s.status, 'version', s.version);
  end if;
  select (now() at time zone public.sms_safe_tz(us.timezone))::date into v_today from public.user_settings us where us.user_id = p_user;
  v_today := coalesce(v_today, (now() at time zone 'Africa/Cairo')::date);
  -- Every line's account must have been measured: the held recheck is what keeps the caps true (I-7).
  if exists (select 1 from jsonb_array_elements(p_lines) e where not (p_held ? (e->>'account_id'))) then
    raise exception 'apply_month_end: a line''s account is missing from p_held';
  end if;

  -- Lock every live part in the accounts the caller measured (and those of the lines), then compare held (I-7).
  select coalesce(array_agg(distinct q.x::uuid), '{}') into v_accounts from (
    select jsonb_object_keys(p_held) as x
    union select e->>'account_id' from jsonb_array_elements(p_lines) e) q;
  perform 1 from public.savings_accounts
    where user_id = p_user and deleted_at is null and held_in_payment_method_id = any(v_accounts)
    order by id for update;
  for k in select jsonb_object_keys(p_held) loop
    select coalesce(sum(current_balance), 0) into v_held from public.savings_accounts
      where user_id = p_user and deleted_at is null and held_in_payment_method_id = k::uuid;
    if abs(v_held - coalesce((p_held->>k)::numeric, 0)) > 0.005 then
      return jsonb_build_object('outcome', 'stale');
    end if;
  end loop;

  for l in select * from jsonb_array_elements(p_lines) loop
    v_acc := (l->>'account_id')::uuid;
    v_amount := (l->>'amount')::numeric;
    if v_amount is null or v_amount <= 0 then continue; end if;
    -- The account must still be the user's, live, counted, and in the line's currency (I-2, I-11).
    if not exists (
      select 1 from public.payment_methods pm
      where pm.id = v_acc and pm.user_id = p_user and pm.deleted_at is null and pm.closed_at is null
        and pm.opening_balance is not null and pm.opening_at is not null and not pm.excluded and not pm.provisional
        and pm.type in ('cash', 'bank_account', 'wallet', 'prepaid_card') and pm.currency::text = l->>'currency'
    ) then raise exception 'apply_month_end: account % cannot hold parts', v_acc; end if;

    v_part := null;
    v_goal := nullif(l->>'target_id', '')::uuid;
    if l->>'kind' = 'pocket' then
      select id into v_part from public.savings_accounts
        where id = (l->>'part_id')::uuid and user_id = p_user and deleted_at is null and goal_id is null
          and not is_monthly_savings and held_in_payment_method_id = v_acc;
      if v_part is null then raise exception 'apply_month_end: pocket % not in account %', l->>'part_id', v_acc; end if;
    elsif l->>'kind' in ('goal', 'ms') then
      if l->>'kind' = 'goal' and not exists (
        select 1 from public.goals where id = v_goal and user_id = p_user and deleted_at is null and status = 'active'
      ) then raise exception 'apply_month_end: goal % is not active', v_goal; end if;
      select id into v_part from public.savings_accounts
        where user_id = p_user and deleted_at is null and held_in_payment_method_id = v_acc
          and case when l->>'kind' = 'goal' then goal_id = v_goal else is_monthly_savings end
        limit 1;
      if v_part is null then
        -- A new part copies the look of another part of the same owner; its id is partId(owner, account).
        select * into src from public.savings_accounts
          where user_id = p_user and deleted_at is null
            and case when l->>'kind' = 'goal' then goal_id = v_goal else is_monthly_savings end
          order by created_at limit 1;
        insert into public.savings_accounts (
          id, user_id, name, category, type, icon, color, currency, current_balance, opening_balance,
          held_in_payment_method_id, goal_id, is_monthly_savings, is_emergency_cover)
        values (
          (l->>'part_id')::uuid, p_user,
          coalesce(src.name, case when l->>'kind' = 'goal' then (select name from public.goals where id = v_goal) else 'Monthly Savings' end),
          'savings', coalesce(src.type, 'vault'), src.icon, src.color, (l->>'currency')::public.currency_code, 0, 0,
          v_acc, case when l->>'kind' = 'goal' then v_goal end, l->>'kind' = 'ms', false)
        on conflict (id) do update set deleted_at = null, updated_at = now()
          where savings_accounts.user_id = p_user and savings_accounts.held_in_payment_method_id = v_acc
        returning id into v_part;
        if v_part is null then raise exception 'apply_month_end: part id % is taken', l->>'part_id'; end if;
        if l->>'kind' = 'goal' then
          update public.goals set linked_savings_account_ids = array_append(linked_savings_account_ids, v_part), updated_at = now()
            where id = v_goal and user_id = p_user and not (v_part = any(linked_savings_account_ids));
        end if;
      end if;
    else
      raise exception 'apply_month_end: bad line kind %', l->>'kind';
    end if;

    perform public.label_part(p_user, v_part, v_amount, 'deposit', 'month_end',
      md5(p_id::text || ':' || v_part::text)::uuid, null, v_today, 'Month end · ' || coalesce(s.cycle_start::text, s.month_key));
    v_applied := v_applied || jsonb_build_array(jsonb_set(l, '{part_id}', to_jsonb(v_part::text)));

    if l->>'kind' = 'goal' and coalesce((l->>'completes_goal')::boolean, false) and not (v_goal = any(v_complete)) then
      v_complete := v_complete || v_goal;
    end if;
  end loop;

  -- After every line: a goal with two lines (two accounts) is still active when its second line is checked.
  with done as (
    update public.goals set status = 'achieved', achieved_at = now(), updated_at = now()
    where id = any(v_complete) and user_id = p_user and status = 'active' and deleted_at is null
    returning id)
  select coalesce(array_agg(id), '{}') into v_achieved from done;

  update public.savings_month_summary set
    status = 'applied', version = s.version + 1, applied_lines = v_applied, capped = p_capped, rates_apply = p_rates,
    applied_at = now(), applied_by = p_by, achieved_by_proposal = v_achieved
  where id = p_id;
  return jsonb_build_object('outcome', 'applied', 'version', s.version + 1, 'achieved', to_jsonb(v_achieved));
end $function$;

-- 7. undo_month_end -----------------------------------------------------------------------------------------------
create or replace function public.undo_month_end(p_user uuid, p_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  s public.savings_month_summary;
  l jsonb;
  v_part uuid;
  v_bal numeric;
  v_take numeric;
  v_parts uuid[];
  v_left jsonb := '[]'::jsonb;
  v_today date;
begin
  if p_user is null or p_id is null then raise exception 'undo_month_end: user and id are required'; end if;
  select (now() at time zone public.sms_safe_tz(us.timezone))::date into v_today from public.user_settings us where us.user_id = p_user;
  v_today := coalesce(v_today, (now() at time zone 'Africa/Cairo')::date);
  select * into s from public.savings_month_summary where id = p_id and user_id = p_user for update;
  if not found then return jsonb_build_object('outcome', 'not_found'); end if;
  if s.status <> 'applied' then return jsonb_build_object('outcome', 'not_applied', 'status', s.status); end if;

  select coalesce(array_agg((e->>'part_id')::uuid), '{}') into v_parts from jsonb_array_elements(coalesce(s.applied_lines, '[]'::jsonb)) e;
  -- N3: a shortfall answer used this money.
  if exists (
    select 1 from public.savings_transactions t
    where t.user_id = p_user and t.account_id = any(v_parts) and t.deleted_at is null
      and t.source in ('spent', 'move_out', 'close') and t.created_at > s.applied_at
  ) then return jsonb_build_object('outcome', 'blocked'); end if;

  perform set_config('buddget.month_end_undo', '1', true);
  -- Parts in id order: the same lock order as apply, so two writers never deadlock.
  for l in select e from jsonb_array_elements(coalesce(s.applied_lines, '[]'::jsonb)) e order by e->>'part_id' loop
    v_part := (l->>'part_id')::uuid;
    select current_balance into v_bal from public.savings_accounts
      where id = v_part and user_id = p_user and deleted_at is null for update;
    v_take := least((l->>'amount')::numeric, greatest(coalesce(v_bal, 0), 0));
    if v_take > 0 then
      perform public.label_part(p_user, v_part, v_take, 'withdrawal', 'month_end_undo',
        md5(p_id::text || ':' || v_part::text || ':undo')::uuid, null, v_today, 'Month end undone');
    end if;
    if (l->>'amount')::numeric - v_take > 0 then
      v_left := v_left || jsonb_build_array(jsonb_build_object('part_id', v_part, 'amount', (l->>'amount')::numeric - v_take, 'currency', l->>'currency'));
    end if;
  end loop;

  update public.goals set status = 'active', achieved_at = null, updated_at = now(), edited_at = now()
    where user_id = p_user and id = any(s.achieved_by_proposal) and status = 'achieved' and deleted_at is null;
  update public.savings_month_summary set status = 'undone', version = s.version + 1, undone_at = now() where id = p_id;
  return jsonb_build_object('outcome', 'undone', 'not_undone', v_left, 'reverted', to_jsonb(s.achieved_by_proposal));
end $function$;

-- 8. Grants (0315: nothing for anon/authenticated; server only) ----------------------------------------------------
revoke all on function public.month_end_due_users(uuid, int, uuid) from public, anon, authenticated;
revoke all on function public.month_end_ledger(uuid, date) from public, anon, authenticated;
revoke all on function public.apply_month_end(uuid, uuid, int, jsonb, jsonb, jsonb, jsonb, text) from public, anon, authenticated;
revoke all on function public.undo_month_end(uuid, uuid) from public, anon, authenticated;
grant execute on function public.month_end_due_users(uuid, int, uuid) to service_role;
grant execute on function public.month_end_ledger(uuid, date) to service_role;
grant execute on function public.apply_month_end(uuid, uuid, int, jsonb, jsonb, jsonb, jsonb, text) to service_role;
grant execute on function public.undo_month_end(uuid, uuid) to service_role;
