-- Pro, Rewards, Founders and Invites (docs/launch/PRO_REWARDS_SPEC.md section 2): the five tiers (switched on), tier assignment
-- kept current on every points and Pro change, the streak multiplier, a kept week needs 3 records, freezes by tier, seasonal
-- freezes, Spark gifts, and the points shop. Mirrored in src/lib/loyalty/rules.ts (pinned by rules.test.ts).
--
-- AUDIT SELECT (live, 2026-11-17, before applying):
--   select count(*) from loyalty_accounts;   -- 0: no account references the draft tiers, so they can be replaced
--   select count(*) from loyalty_ledger;     -- 0
--   select count(*) from loyalty_events;     -- 0

-- ---------------------------------------------------------------- tiers
alter table public.loyalty_tiers
  add column if not exists requires_pro boolean not null default false,
  add column if not exists requires_founder boolean not null default false,
  add column if not exists sparks_gift integer not null default 0 check (sparks_gift >= 0);
delete from public.loyalty_tiers where key in ('seed', 'sprout', 'tree');
insert into public.loyalty_tiers (key, name, description, min_points, status, sort_order, requires_pro, requires_founder, sparks_gift, perks) values
  ('silver', 'Silver', 'Everyone starts here.', 0, 'active', 0, false, false, 0, '[]'::jsonb),
  ('emerald', 'Emerald', 'A streak freeze every 4 kept weeks.', 300, 'active', 1, false, false, 10, '["freeze_every_4"]'::jsonb),
  ('diamond', 'Diamond', 'Pro members get +20% Sparks on packs.', 800, 'active', 2, false, false, 20, '["freeze_every_4", "loyal_pack_bonus"]'::jsonb),
  ('elite', 'Elite', 'For active Pro members (the trial counts).', 1500, 'active', 3, true, false, 30, '["freeze_every_4", "loyal_pack_bonus", "elite_card"]'::jsonb),
  ('founder', 'Elite Founder', 'A founder who reaches Elite.', 1500, 'active', 4, true, true, 0, '["freeze_every_4", "loyal_pack_bonus", "elite_card", "founder_card"]'::jsonb)
on conflict (key) do update set name = excluded.name, description = excluded.description, min_points = excluded.min_points, status = 'active',
  sort_order = excluded.sort_order, requires_pro = excluded.requires_pro, requires_founder = excluded.requires_founder, sparks_gift = excluded.sparks_gift, perks = excluded.perks;

insert into public.platform_settings (key, value) values ('tiers', '{"enabled": true}'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

alter table public.loyalty_accounts
  add column if not exists multiplier_step smallint not null default 0 check (multiplier_step between 0 and 2),
  -- the highest tier rank whose Spark gift was paid (0 = none); keeps the refresh from re-checking gifts
  add column if not exists gifted_rank smallint not null default 0,
  add column if not exists card_finish text not null default 'standard',
  add column if not exists buddgy_look text not null default 'classic';
-- The nightly refresh only revisits accounts that can hold a Pro-gated tier.
create index if not exists loyalty_accounts_lifetime_idx on public.loyalty_accounts (lifetime_points);
-- The kept-week rule counts a week's income by date.
create index if not exists idx_income_events_user_received on public.income_events (user_id, received_date) where deleted_at is null;

-- The tier for a set of facts: the highest active tier whose threshold and conditions are met (five rows).
create or replace function public.loyalty_tier_key(p_lifetime integer, p_pro boolean, p_founder boolean)
returns text language sql stable set search_path to 'public' as $$
  select t.key from public.loyalty_tiers t
  where t.status = 'active' and t.min_points <= coalesce(p_lifetime, 0)
    and (not t.requires_pro or coalesce(p_pro, false)) and (not t.requires_founder or coalesce(p_founder, false))
  order by t.sort_order desc limit 1
$$;

create or replace function public.loyalty_pro_active(p_user uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce((select e.plan_key in ('plus', 'plus_trial') and public.entitlement_grants(e.status, e.trial_ends_at, e.current_period_end, e.grace_ends_at, now())
                   from public.user_entitlements e where e.user_id = p_user), false)
$$;

create or replace function public.loyalty_tiers_enabled()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce((select (value ->> 'enabled')::boolean from public.platform_settings where key = 'tiers'), true)
$$;

-- Recomputes one account's tier (unless locked) and pays the Spark gift of each tier reached for the first time. Called after
-- every points change, by the entitlement and founder triggers, and by the nightly job for Pro that ran out.
create or replace function public.loyalty_refresh_tier(p_user uuid)
returns text language plpgsql security definer set search_path to 'public' as $$
declare a record; v_new text; v_rank smallint; g record;
begin
  select tier_key, tier_locked, lifetime_points, gifted_rank into a from public.loyalty_accounts where user_id = p_user for update;
  if not found then return null; end if;
  if a.tier_locked then return a.tier_key; end if;
  v_new := case when public.loyalty_tiers_enabled() then public.loyalty_tier_key(a.lifetime_points, public.loyalty_pro_active(p_user),
                  exists (select 1 from public.founders f where f.user_id = p_user and f.retired_at is null)) end;
  if v_new is distinct from a.tier_key then
    update public.loyalty_accounts set tier_key = v_new, updated_at = now() where user_id = p_user;
  end if;
  -- Elite Founder pays the Elite gift (same rank for gifts).
  select least(t.sort_order, 3) into v_rank from public.loyalty_tiers t where t.key = v_new;
  if v_rank is not null and v_rank > a.gifted_rank then
    for g in select key, sparks_gift from public.loyalty_tiers where sort_order > a.gifted_rank and sort_order <= v_rank and sparks_gift > 0 and status = 'active' loop
      perform public.spark_grant_reward(p_user, g.sparks_gift, 'tier:' || g.key, 'Reached ' || g.key);
    end loop;
    update public.loyalty_accounts set gifted_rank = v_rank where user_id = p_user;
  end if;
  return v_new;
end;
$$;

-- Earn rows: pay once per (reason, ref), then refresh the tier.
create or replace function public.loyalty_award(p_user uuid, p_points integer, p_reason text, p_ref text)
returns integer language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare v_n integer;
begin
  if p_points <= 0 then return 0; end if;
  insert into public.loyalty_ledger (user_id, delta, reason, ref, actor_id) values (p_user, p_points, left(p_reason, 200), p_ref, null)
  on conflict (user_id, reason, ref) where actor_id is null and ref is not null do nothing;
  get diagnostics v_n = row_count;
  if v_n = 0 then return 0; end if;
  insert into public.loyalty_accounts (user_id) values (p_user) on conflict (user_id) do nothing;
  update public.loyalty_accounts set points_balance = points_balance + p_points, lifetime_points = lifetime_points + p_points, updated_at = now() where user_id = p_user;
  perform public.loyalty_refresh_tier(p_user);
  return p_points;
end;
$$;

create or replace function public.admin_adjust_loyalty_points(p_user uuid, p_delta integer, p_reason text, p_actor uuid)
returns table (balance integer, tier text) language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare v_balance integer;
begin
  insert into public.loyalty_accounts (user_id) values (p_user) on conflict (user_id) do nothing;
  select points_balance + p_delta into v_balance from public.loyalty_accounts where user_id = p_user for update;
  if v_balance < 0 then raise exception 'insufficient_points'; end if;
  update public.loyalty_accounts set points_balance = v_balance, lifetime_points = lifetime_points + greatest(p_delta, 0), updated_at = now() where user_id = p_user;
  insert into public.loyalty_ledger (user_id, delta, reason, actor_id) values (p_user, p_delta, left(p_reason, 200), p_actor);
  return query select v_balance, public.loyalty_refresh_tier(p_user);
end;
$$;

-- Pro and founder changes move the tier (Elite needs Pro; Elite Founder needs a founder).
create or replace function public.loyalty_tier_on_change()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_op in ('INSERT', 'UPDATE') and new.user_id is not null then perform public.loyalty_refresh_tier(new.user_id); end if;
  if tg_op in ('UPDATE', 'DELETE') and old.user_id is not null and (tg_op = 'DELETE' or old.user_id is distinct from new.user_id) then perform public.loyalty_refresh_tier(old.user_id); end if;
  return null;
end;
$$;
drop trigger if exists user_entitlements_loyalty_tier on public.user_entitlements;
create trigger user_entitlements_loyalty_tier after insert or delete or update of plan_key, status, trial_ends_at, current_period_end, grace_ends_at
  on public.user_entitlements for each row execute function public.loyalty_tier_on_change();
drop trigger if exists founders_loyalty_tier on public.founders;
create trigger founders_loyalty_tier after insert or delete or update of user_id, retired_at
  on public.founders for each row execute function public.loyalty_tier_on_change();

-- ---------------------------------------------------------------- seasonal freezes
-- A listed week freezes itself: a missed week that overlaps a row never breaks the streak and spends no banked freeze.
create table if not exists public.loyalty_seasonal_freezes (
  id smallint generated always as identity primary key,
  label text not null,
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  unique (label, starts_on)
);
alter table public.loyalty_seasonal_freezes enable row level security;
revoke all on public.loyalty_seasonal_freezes from anon, authenticated;
grant select on public.loyalty_seasonal_freezes to authenticated;
grant all on public.loyalty_seasonal_freezes to service_role;
create policy loyalty_seasonal_freezes_read on public.loyalty_seasonal_freezes for select to authenticated using (true);
-- Approximate (moon-sighting) dates; staff can edit the rows. Ramadan's first week and both Eids.
insert into public.loyalty_seasonal_freezes (label, starts_on, ends_on) values
  ('Ramadan 2027 (first week)', '2027-02-08', '2027-02-14'),
  ('Eid al-Fitr 2027', '2027-03-09', '2027-03-13'),
  ('Eid al-Adha 2027', '2027-05-15', '2027-05-20'),
  ('Ramadan 2028 (first week)', '2028-01-28', '2028-02-03'),
  ('Eid al-Fitr 2028', '2028-02-26', '2028-03-01'),
  ('Eid al-Adha 2028', '2028-05-04', '2028-05-09')
on conflict (label, starts_on) do nothing;

-- Weeks in [p_from, p_to] (week starts, step 7) not covered by a week_frozen event (a repair or an earlier freeze) or a seasonal
-- row. At most 60 weeks are examined; a longer gap counts as all uncovered. Reads the unique (user_id, kind, period_key) index.
create or replace function public.loyalty_gap_uncovered(p_user uuid, p_from date, p_to date)
returns integer language sql stable security definer set search_path to 'public' as $$
  select case when p_to < p_from then 0
              when (p_to - p_from) / 7 > 60 then ((p_to - p_from) / 7 + 1)
              else (select count(*)::integer from generate_series(p_from, p_to, interval '7 days') g(w)
                    where not exists (select 1 from public.loyalty_events e where e.user_id = p_user and e.kind = 'week_frozen' and e.period_key = g.w::date::text)
                      and not exists (select 1 from public.loyalty_seasonal_freezes s where s.starts_on <= g.w::date + 6 and s.ends_on >= g.w::date))
         end
$$;

-- ---------------------------------------------------------------- the weekly check
-- Kept = at least 3 records (expenses and income) in the week, nothing unconfirmed. Points 10 x the multiplier (x1 / x1.5 from week 4
-- / x2 from week 8). A gap is covered by repairs and seasonal weeks first, then banked freezes (only if they cover all of it);
-- otherwise the streak restarts at 1 and the multiplier drops one step per uncovered week. Freezes: 1 per 8 kept weeks (max 2),
-- 1 per 4 from Emerald. Streak Spark gifts at 12, 26 and 52 weeks, once each.
create or replace function public.loyalty_record_week_check(p_week text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  u uuid := auth.uid();
  v_tz text; v_wsd smallint; v_today date; v_this date; v_w date;
  v_acc public.loyalty_accounts%rowtype;
  v_records integer; v_needed integer; v_streak integer; v_step smallint; v_freezes smallint; v_total integer;
  v_every integer; v_event bigint; v_points integer; v_gift integer;
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
             and l.received_at >= v_w::timestamp - interval '2 days'
             and public.loyalty_local_day(l.created_at, v_tz) between v_w and v_w + 6) then
    return jsonb_build_object('status', 'unconfirmed_items');
  end if;

  v_records := (select count(*) from public.expenses e where e.user_id = u and e.deleted_at is null and e.expense_date between v_w and v_w + 6)
             + (select count(*) from public.income_events x where x.user_id = u and x.deleted_at is null and x.received_date between v_w and v_w + 6);
  if v_records < 3 then return jsonb_build_object('status', 'too_few_records', 'records', v_records, 'needed', 3); end if;

  insert into public.loyalty_events (user_id, kind, period_key, meta) values (u, 'week_kept', v_w::text, jsonb_build_object('records', v_records))
  on conflict do nothing returning id into v_event;
  if v_event is null then return jsonb_build_object('status', 'already_kept'); end if;

  v_freezes := v_acc.freezes_banked;
  v_step := v_acc.multiplier_step;
  if v_acc.last_kept_week is null then
    v_streak := 1;
  else
    v_needed := public.loyalty_gap_uncovered(u, v_acc.last_kept_week::date + 7, v_w - 7);
    if v_needed = 0 then
      v_streak := v_acc.streak_weeks + 1;
    elsif v_needed <= v_freezes then
      insert into public.loyalty_events (user_id, kind, period_key, meta)
      select u, 'week_frozen', g.w::date::text, '{"source": "bank"}'::jsonb
      from generate_series(v_acc.last_kept_week::date + 7, v_w - 7, interval '7 days') g(w)
      on conflict do nothing;
      v_freezes := v_freezes - v_needed;
      v_streak := v_acc.streak_weeks + 1;
    else
      v_streak := 1;
      v_step := greatest(0, v_step - v_needed);
    end if;
  end if;
  v_step := greatest(v_step, case when v_streak >= 8 then 2 when v_streak >= 4 then 1 else 0 end);
  v_total := v_acc.kept_weeks_total + 1;
  v_every := case when coalesce((select t.sort_order from public.loyalty_tiers t where t.key = v_acc.tier_key), 0) >= 1 then 4 else 8 end;
  if v_total % v_every = 0 then v_freezes := least(2, v_freezes + 1); end if;
  update public.loyalty_accounts
    set streak_weeks = v_streak, streak_best = greatest(streak_best, v_streak), freezes_banked = v_freezes, kept_weeks_total = v_total,
        last_kept_week = v_w::text, multiplier_step = v_step, updated_at = now()
    where user_id = u;
  v_points := public.loyalty_award(u, case v_step when 2 then 20 when 1 then 15 else 10 end, 'week_kept', v_event::text);
  v_gift := case v_streak when 12 then 10 when 26 then 20 when 52 then 40 else 0 end;
  if v_gift > 0 then v_gift := public.spark_grant_reward(u, v_gift, 'streak:' || v_streak, v_streak || '-week streak'); end if;
  return jsonb_build_object('status', 'kept', 'streak', v_streak, 'points', v_points, 'freezes', v_freezes,
    'multiplier', case v_step when 2 then 2 when 1 then 1.5 else 1 end, 'sparksGift', v_gift);
end;
$$;

create or replace function public.loyalty_week_summary()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare
  u uuid := auth.uid(); v_tz text; v_wsd smallint; v_today date; v_this date; v_last date; v_acc public.loyalty_accounts%rowtype;
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
    'unconfirmedThisWeek', (select count(*) from public.sms_parse_log l where l.user_id = u and l.awaiting_confirmation and l.received_at >= now() - interval '16 days' and public.loyalty_local_day(l.created_at, v_tz) between v_this and v_this + 6),
    'unconfirmedLastWeek', (select count(*) from public.sms_parse_log l where l.user_id = u and l.awaiting_confirmation and l.received_at >= now() - interval '16 days' and public.loyalty_local_day(l.created_at, v_tz) between v_last and v_last + 6),
    'recordsThisWeek', (select count(*) from public.expenses e where e.user_id = u and e.deleted_at is null and e.expense_date between v_this and v_this + 6)
                     + (select count(*) from public.income_events x where x.user_id = u and x.deleted_at is null and x.received_date between v_this and v_this + 6),
    'recordsLastWeek', (select count(*) from public.expenses e where e.user_id = u and e.deleted_at is null and e.expense_date between v_last and v_last + 6)
                     + (select count(*) from public.income_events x where x.user_id = u and x.deleted_at is null and x.received_date between v_last and v_last + 6),
    'recordsNeeded', 3,
    'multiplier', case coalesce(v_acc.multiplier_step, 0) when 2 then 2 when 1 then 1.5 else 1 end,
    'streakWeeks', coalesce(v_acc.streak_weeks, 0), 'freezesBanked', coalesce(v_acc.freezes_banked, 0), 'keptWeeksTotal', coalesce(v_acc.kept_weeks_total, 0)
  );
end;
$$;

-- ---------------------------------------------------------------- the points shop
create table if not exists public.loyalty_shop_items (
  key text primary key,
  kind text not null check (kind in ('repair', 'freeze', 'card_finish', 'buddgy_look')),
  item_key text,
  cost integer not null check (cost > 0),
  active boolean not null default true,
  sort_order smallint not null default 0
);
insert into public.loyalty_shop_items (key, kind, item_key, cost, sort_order) values
  ('repair_week', 'repair', null, 120, 0),
  ('streak_freeze', 'freeze', null, 80, 1),
  ('card_finish_aurora', 'card_finish', 'aurora', 150, 2),
  ('buddgy_look_midnight', 'buddgy_look', 'midnight', 120, 3)
on conflict (key) do update set kind = excluded.kind, item_key = excluded.item_key, cost = excluded.cost, sort_order = excluded.sort_order;

-- What a user owns: card finishes and Buddgy looks from the shop, milestones (the Connector finish) or staff.
create table if not exists public.loyalty_owned_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('card_finish', 'buddgy_look')),
  item_key text not null,
  source text not null check (source in ('shop', 'milestone', 'admin')),
  acquired_at timestamptz not null default now(),
  primary key (user_id, kind, item_key)
);
alter table public.loyalty_shop_items enable row level security;
alter table public.loyalty_owned_items enable row level security;
revoke all on public.loyalty_shop_items, public.loyalty_owned_items from anon, authenticated;
grant select on public.loyalty_shop_items, public.loyalty_owned_items to authenticated;
grant all on public.loyalty_shop_items, public.loyalty_owned_items to service_role;
create policy loyalty_shop_items_read on public.loyalty_shop_items for select to authenticated using (active);
create policy loyalty_owned_items_own on public.loyalty_owned_items for select to authenticated using (user_id = (select auth.uid()));

-- The week a repair would cover now (the last week, missed, in the 48 hours after its keep window closed), or null.
create or replace function public.loyalty_repairable_week(p_user uuid)
returns date language plpgsql stable security definer set search_path to 'public' as $$
declare v_tz text; v_wsd smallint; v_today date; v_this date; v_w date; a record;
begin
  select timezone, week_start_day into v_tz, v_wsd from public.user_settings where user_id = p_user;
  v_today := public.loyalty_local_day(now(), v_tz);
  v_this := public.loyalty_week_start(v_today, v_wsd);
  v_w := v_this - 7;
  if v_today <= v_this + 2 or v_today > v_this + 4 then return null; end if;
  select last_kept_week, freezes_banked into a from public.loyalty_accounts where user_id = p_user;
  if a.last_kept_week is null or a.last_kept_week::date >= v_w then return null; end if;
  if public.loyalty_gap_uncovered(p_user, v_w, v_w) = 0 then return null; end if;
  if public.loyalty_gap_uncovered(p_user, a.last_kept_week::date + 7, v_w - 7) > a.freezes_banked then return null; end if;
  return v_w;
end;
$$;

-- Spends points_balance (never lifetime_points, so the tier never drops). Statuses: ok, unknown_item, insufficient_points,
-- freezes_full, nothing_to_repair, already_owned.
create or replace function public.loyalty_shop_buy(p_item text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare u uuid := auth.uid(); it public.loyalty_shop_items%rowtype; a public.loyalty_accounts%rowtype; v_week date;
begin
  if u is null then raise exception 'not_authenticated'; end if;
  select * into it from public.loyalty_shop_items where key = p_item and active;
  if not found then return jsonb_build_object('status', 'unknown_item'); end if;
  insert into public.loyalty_accounts (user_id) values (u) on conflict (user_id) do nothing;
  select * into a from public.loyalty_accounts where user_id = u for update;
  if a.points_balance < it.cost then return jsonb_build_object('status', 'insufficient_points', 'balance', a.points_balance); end if;
  case it.kind
    when 'freeze' then
      if a.freezes_banked >= 2 then return jsonb_build_object('status', 'freezes_full'); end if;
      update public.loyalty_accounts set freezes_banked = freezes_banked + 1 where user_id = u;
    when 'repair' then
      v_week := public.loyalty_repairable_week(u);
      if v_week is null then return jsonb_build_object('status', 'nothing_to_repair'); end if;
      insert into public.loyalty_events (user_id, kind, period_key, meta) values (u, 'week_frozen', v_week::text, '{"source": "repair"}'::jsonb) on conflict do nothing;
    else
      insert into public.loyalty_owned_items (user_id, kind, item_key, source) values (u, it.kind, it.item_key, 'shop') on conflict do nothing;
      if not found then return jsonb_build_object('status', 'already_owned'); end if;
  end case;
  update public.loyalty_accounts set points_balance = points_balance - it.cost, updated_at = now() where user_id = u;
  insert into public.loyalty_ledger (user_id, delta, reason, ref) values (u, -it.cost, 'shop:' || it.key, null);
  return jsonb_build_object('status', 'ok', 'balance', a.points_balance - it.cost, 'week', v_week);
end;
$$;

-- Applies a card finish or a Buddgy look the user owns ('standard' and 'classic' are always owned). Returns ok, not_owned or invalid.
create or replace function public.loyalty_apply_cosmetic(p_kind text, p_key text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'not_authenticated'; end if;
  if p_kind not in ('card_finish', 'buddgy_look') or p_key is null then return 'invalid'; end if;
  if not ((p_kind = 'card_finish' and p_key = 'standard') or (p_kind = 'buddgy_look' and p_key = 'classic')
          or exists (select 1 from public.loyalty_owned_items o where o.user_id = u and o.kind = p_kind and o.item_key = p_key)) then
    return 'not_owned';
  end if;
  insert into public.loyalty_accounts (user_id) values (u) on conflict (user_id) do nothing;
  if p_kind = 'card_finish' then update public.loyalty_accounts set card_finish = p_key, updated_at = now() where user_id = u;
  else update public.loyalty_accounts set buddgy_look = p_key, updated_at = now() where user_id = u; end if;
  return 'ok';
end;
$$;

-- Nightly: tiers that changed because Pro ran out without a row change (a trial or promo end passing). Set-based over the accounts
-- that can hold a Pro-gated tier (lifetime at or above the lowest Pro-gated threshold), via loyalty_accounts_lifetime_idx.
create or replace function public.loyalty_refresh_pro_tiers()
returns integer language plpgsql security definer set search_path to 'public' as $$
declare v_min integer; n integer;
begin
  if not public.loyalty_tiers_enabled() then return 0; end if;
  select min(min_points) into v_min from public.loyalty_tiers where requires_pro and status = 'active';
  if v_min is null then return 0; end if;
  update public.loyalty_accounts a set tier_key = x.k, updated_at = now()
  from (select a2.user_id, public.loyalty_tier_key(a2.lifetime_points, public.loyalty_pro_active(a2.user_id),
                 exists (select 1 from public.founders f where f.user_id = a2.user_id and f.retired_at is null)) k
        from public.loyalty_accounts a2 where a2.lifetime_points >= v_min and not a2.tier_locked) x
  where a.user_id = x.user_id and a.tier_key is distinct from x.k;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.loyalty_tier_key(integer, boolean, boolean), public.loyalty_pro_active(uuid), public.loyalty_tiers_enabled(),
  public.loyalty_refresh_tier(uuid), public.loyalty_gap_uncovered(uuid, date, date), public.loyalty_repairable_week(uuid),
  public.loyalty_refresh_pro_tiers(), public.loyalty_tier_on_change() from public, anon, authenticated;
grant execute on function public.loyalty_tier_key(integer, boolean, boolean), public.loyalty_pro_active(uuid), public.loyalty_tiers_enabled(),
  public.loyalty_refresh_tier(uuid), public.loyalty_gap_uncovered(uuid, date, date), public.loyalty_repairable_week(uuid),
  public.loyalty_refresh_pro_tiers() to service_role;
revoke all on function public.loyalty_shop_buy(text), public.loyalty_apply_cosmetic(text, text) from public, anon;
grant execute on function public.loyalty_shop_buy(text), public.loyalty_apply_cosmetic(text, text) to authenticated, service_role;
